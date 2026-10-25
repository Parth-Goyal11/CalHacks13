"""Download CelesTrak general-perturbation elements and upsert them."""

from __future__ import annotations

import csv
import hashlib
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.types.json import Json
from skyfield.api import EarthSatellite, Loader, wgs84

from nightsky.db import insert_landing
from nightsky.paths import CELESTRAK, SKYFIELD

GROUPS = {
    "stations": "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=csv",
    "visual": "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=csv",
}
SATCAT_GROUPS = {
    "satcat-stations": "https://celestrak.org/satcat/records.php?GROUP=stations&FORMAT=csv",
    "satcat-visual": "https://celestrak.org/satcat/records.php?GROUP=visual&FORMAT=csv",
}
MAX_AGE_SECONDS = 3 * 24 * 3600

_FILL = {
    "MEAN_MOTION_DOT": "0",
    "MEAN_MOTION_DDOT": "0",
    "BSTAR": "0",
    "EPHEMERIS_TYPE": "0",
    "CLASSIFICATION_TYPE": "U",
    "ELEMENT_SET_NO": "999",
    "REV_AT_EPOCH": "0",
}


def load_satellites(conn: psycopg.Connection, force: bool = False) -> int:
    timescale = Loader(str(SKYFIELD)).timescale()
    for name, url in GROUPS.items():
        path = _download(name, url, force=force)
        raw = path.read_bytes()
        rows, skipped = _parse(path, timescale)
        _upsert(conn, rows)
        insert_landing(
            conn,
            source=f"celestrak:{name}",
            checksum=hashlib.sha256(raw).hexdigest(),
            body={
                "url": url,
                "filename": path.name,
                "parsed": len(rows),
                "skipped": skipped,
                "records": rows,
            },
            status="ok" if rows else "error",
            error=None if rows else "no satellite rows parsed",
        )
    try:
        satcat_rows = refresh_satcat(conn, force=force)
    except Exception as exc:
        insert_landing(
            conn,
            source="celestrak:satcat",
            checksum=None,
            body={},
            status="error",
            error=str(exc),
        )
        satcat_rows = []
    else:
        insert_landing(
            conn,
            source="celestrak:satcat",
            checksum=None,
            body={"parsed": len(satcat_rows)},
            status="ok" if satcat_rows else "error",
            error=None if satcat_rows else "no satellite catalog rows parsed",
        )
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("select count(*) from satellites")
        return int(cur.fetchone()[0])


def refresh_satcat(conn: psycopg.Connection, force: bool = False) -> list[dict]:
    """Attach launch date, object class, owner, and orbit size from the public catalog."""
    rows = []
    for name, url in SATCAT_GROUPS.items():
        path = _download_cached(name, url, force)
        rows.extend(_parse_satcat(path))
    _apply_satcat(conn, rows)
    return rows


def propagate(norad_id: int, elements: dict, when: datetime, latitude: float, longitude: float, elevation_m: float = 0.0):
    """Return (ra_deg, dec_deg, alt_deg) for one satellite."""
    loader = Loader(str(SKYFIELD))
    planets = loader("de421.bsp")
    timescale = loader.timescale()
    satellite = satellite_from_elements(elements, timescale)
    return observe_satellite(
        satellite,
        planets,
        timescale,
        when,
        latitude,
        longitude,
        elevation_m,
    )


def satellite_from_elements(elements: dict, timescale) -> EarthSatellite:
    fields = {key: "" if value is None else str(value) for key, value in elements.items()}
    fields["EPOCH"] = _normalize_epoch(fields["EPOCH"])
    for key, value in _FILL.items():
        if not fields.get(key):
            fields[key] = value
    satellite = EarthSatellite.from_omm(timescale, fields)
    satellite.name = fields.get("OBJECT_NAME")
    return satellite


def observe_satellite(satellite, _planets, timescale, when: datetime, latitude: float, longitude: float, elevation_m: float):
    # Satellites are already geocentric, so the observer is a geographic point.
    site = wgs84.latlon(latitude, longitude, elevation_m=elevation_m)
    moment = timescale.from_datetime(when.astimezone(timezone.utc))
    topocentric = (satellite - site).at(moment)
    ra, dec, _distance = topocentric.radec()
    alt, _az, _distance = topocentric.altaz()
    return ra.hours * 15.0, dec.degrees, alt.degrees


def _download_cached(name: str, url: str, force: bool) -> Path:
    path = CELESTRAK / f"{name}.csv"
    try:
        return _download(name, url, force)
    except Exception:
        if path.exists() and path.stat().st_size > 0:
            return path
        raise


def _parse_satcat(path: Path) -> list[dict]:
    rows = []
    with path.open(newline="") as handle:
        for raw in csv.DictReader(handle):
            norad = (raw.get("NORAD_CAT_ID") or "").strip()
            if not norad:
                continue
            rows.append(
                {
                    "norad_id": int(norad),
                    "object_class": _blank(raw.get("OBJECT_TYPE")),
                    "ops_status": _blank(raw.get("OPS_STATUS_CODE")),
                    "owner": _blank(raw.get("OWNER")),
                    "launch_date": _blank(raw.get("LAUNCH_DATE")),
                    "launch_site": _blank(raw.get("LAUNCH_SITE")),
                    "perigee_km": _float(raw.get("PERIGEE")),
                    "apogee_km": _float(raw.get("APOGEE")),
                    "period_min": _float(raw.get("PERIOD")),
                    "orbit_center": _blank(raw.get("ORBIT_CENTER")),
                    "orbit_type": _blank(raw.get("ORBIT_TYPE")),
                }
            )
    return rows


def _apply_satcat(conn: psycopg.Connection, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                update satellites set
                    object_class = %s,
                    ops_status = %s,
                    owner = %s,
                    launch_date = %s,
                    launch_site = %s,
                    perigee_km = %s,
                    apogee_km = %s,
                    period_min = %s,
                    orbit_center = %s,
                    orbit_type = %s
                where norad_id = %s
                """,
                (
                    row["object_class"],
                    row["ops_status"],
                    row["owner"],
                    row["launch_date"],
                    row["launch_site"],
                    row["perigee_km"],
                    row["apogee_km"],
                    row["period_min"],
                    row["orbit_center"],
                    row["orbit_type"],
                    row["norad_id"],
                ),
            )


def _blank(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _float(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    return float(text)


def _download(name: str, url: str, force: bool) -> Path:
    path = CELESTRAK / f"{name}.csv"
    if path.exists() and path.stat().st_size > 0 and not force:
        age = time.time() - path.stat().st_mtime
        if age < MAX_AGE_SECONDS:
            return path
    request = urllib.request.Request(url, headers={"User-Agent": "nightsky/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        path.write_bytes(response.read())
    return path


def _parse(path: Path, timescale) -> tuple[list[dict], int]:
    rows = []
    skipped = 0
    with path.open(newline="") as handle:
        for raw in csv.DictReader(handle):
            fields = {key: (value or "").strip() for key, value in raw.items() if key}
            if not fields.get("NORAD_CAT_ID") or not fields.get("EPOCH"):
                skipped += 1
                continue
            fields["EPOCH"] = _normalize_epoch(fields["EPOCH"])
            for key, value in _FILL.items():
                if not fields.get(key):
                    fields[key] = value
            try:
                EarthSatellite.from_omm(timescale, fields)
                epoch = datetime.strptime(fields["EPOCH"], "%Y-%m-%dT%H:%M:%S.%f").replace(tzinfo=timezone.utc)
                norad_id = int(fields["NORAD_CAT_ID"])
            except Exception:
                skipped += 1
                continue
            rows.append(
                {
                    "norad_id": norad_id,
                    "name": fields.get("OBJECT_NAME") or None,
                    "intl_desig": fields.get("OBJECT_ID") or None,
                    "epoch": epoch.isoformat(),
                    "elements": fields,
                }
            )
    return rows, skipped


def _upsert(conn: psycopg.Connection, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                insert into satellites (norad_id, name, intl_desig, epoch, elements, updated_at)
                values (%s, %s, %s, %s, %s, now())
                on conflict (norad_id) do update set
                    name = excluded.name,
                    intl_desig = excluded.intl_desig,
                    epoch = excluded.epoch,
                    elements = excluded.elements,
                    updated_at = now()
                where satellites.epoch < excluded.epoch
                """,
                (
                    row["norad_id"],
                    row["name"],
                    row["intl_desig"],
                    row["epoch"],
                    Json(row["elements"]),
                ),
            )


def _normalize_epoch(value: str) -> str:
    text = value.strip().replace("Z", "")
    if "." not in text:
        text += ".0"
    return text
