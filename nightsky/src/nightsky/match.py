"""Project catalog objects through a solved WCS and store identifications."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import psycopg
from skyfield.api import wgs84

from nightsky.imageutil import detect_sources, detect_stars
from nightsky.planets import open_ephemeris
from nightsky.satellites import observe_satellite, satellite_from_elements
from nightsky.wcs import WCS, pixel_to_sky, ra_interval, sky_to_pixel

_BODIES = (
    ("moon", "moon", "moon"),
    ("mercury", "mercury", "planet"),
    ("venus", "venus", "planet"),
    ("mars", "mars", "planet"),
    ("jupiter barycenter", "jupiter", "planet"),
    ("saturn barycenter", "saturn", "planet"),
)


def identify_capture(
    conn: psycopg.Connection,
    capture_id: int,
    image,
    wcs: WCS,
    taken_at: datetime | None,
    latitude: float | None,
    longitude: float | None,
    elevation_m: float | None,
    exposure_seconds: float | None,
    mag_limit: float = 6.0,
) -> list[dict]:
    detections = detect_stars(image, limit=160)
    if len(detections) < 4:
        detections = detect_sources(image, threshold=8.0, limit=40)
    found = _name_each_detection(conn, wcs, detections, mag_limit)
    if taken_at is not None and latitude is not None and longitude is not None:
        found.extend(
            _moving_objects(
                conn,
                wcs,
                detections,
                taken_at,
                latitude,
                longitude,
                elevation_m or 0.0,
                exposure_seconds or 0.0,
            )
        )
    with conn.cursor() as cur:
        cur.execute("delete from identifications where capture_id = %s", (capture_id,))
        for row in found:
            cur.execute(
                """
                insert into identifications
                    (capture_id, object_type, catalog_id, pixel_x, pixel_y, separation_arcsec, confidence)
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    capture_id,
                    row["object_type"],
                    row["catalog_id"],
                    row["pixel_x"],
                    row["pixel_y"],
                    row["separation_arcsec"],
                    row["confidence"],
                ),
            )
    conn.commit()
    return found


def _name_each_detection(conn, wcs: WCS, detections, mag_limit: float) -> list[dict]:
    """Give each visible peak its own catalog star. The photo is not matched as one stored picture."""
    stars = _stars_in_frame(conn, wcs, mag_limit)
    stars.sort(key=lambda star: star["mag"] if star["mag"] is not None else 99)
    used = set()
    tolerance_px = 8.0
    found = []
    for star in stars:
        px, py = sky_to_pixel(star["ra_deg"], star["dec_deg"], wcs)
        if not (math.isfinite(px) and math.isfinite(py)):
            continue
        best_i = None
        best_d = tolerance_px
        for index, (x, y, _flux) in enumerate(detections):
            if index in used:
                continue
            distance = math.hypot(px - x, py - y)
            if distance < best_d:
                best_d = distance
                best_i = index
        if best_i is None:
            continue
        used.add(best_i)
        x, y, _flux = detections[best_i]
        found.append(
            _row(
                "star",
                star["catalog_id"],
                star["name"],
                x,
                y,
                best_d * wcs.scale_arcsec,
                wcs,
                mag=star["mag"],
            )
        )
    return found


def _stars_in_frame(conn, wcs: WCS, mag_limit: float) -> list[dict]:
    samples = [
        pixel_to_sky(x, y, wcs)
        for x in (0, wcs.width - 1, wcs.crpix_x)
        for y in (0, wcs.height - 1, wcs.crpix_y)
    ]
    start, end, wraps = ra_interval([ra for ra, _dec in samples])
    pad_ra = 0.6
    if wraps:
        start = (start - pad_ra) % 360.0
        end = (end + pad_ra) % 360.0
        ra_clause = "(ra_deg >= %s or ra_deg <= %s)"
    else:
        start -= pad_ra
        end += pad_ra
        if start < 0 or end >= 360:
            start %= 360.0
            end %= 360.0
            ra_clause = "(ra_deg >= %s or ra_deg <= %s)"
        else:
            ra_clause = "ra_deg between %s and %s"
    dec_min = min(dec for _ra, dec in samples) - 0.6
    dec_max = max(dec for _ra, dec in samples) + 0.6
    with conn.cursor() as cur:
        cur.execute(
            f"""
            select catalog_id, name, ra_deg, dec_deg, mag
            from stars
            where mag <= %s
              and dec_deg between %s and %s
              and {ra_clause}
            """,
            (mag_limit, dec_min, dec_max, start, end),
        )
        rows = cur.fetchall()
    return [
        {"catalog_id": catalog_id, "name": name, "ra_deg": ra_deg, "dec_deg": dec_deg, "mag": mag}
        for catalog_id, name, ra_deg, dec_deg, mag in rows
    ]


def _moving_objects(conn, wcs, detections, taken_at, latitude, longitude, elevation_m, exposure_seconds):
    found = []
    moments = [taken_at]
    if exposure_seconds > 0:
        moments.append(taken_at + timedelta(seconds=exposure_seconds / 2))
        moments.append(taken_at + timedelta(seconds=exposure_seconds))
    loader, planets = open_ephemeris()
    timescale = loader.timescale()
    site = planets["earth"] + wgs84.latlon(latitude, longitude, elevation_m=elevation_m)
    for key, catalog_id, object_type in _BODIES:
        if key not in planets:
            continue
        body = planets[key]
        placed = _place_body(site, body, timescale, moments, wcs)
        if placed is None:
            continue
        px, py = placed
        found.append(
            _row(object_type, catalog_id, catalog_id, px, py, _separation_arcsec(px, py, detections, wcs), wcs)
        )
    with conn.cursor() as cur:
        cur.execute("select norad_id, name, elements from satellites")
        satellites = cur.fetchall()
    prepared = []
    for norad_id, name, elements in satellites:
        try:
            prepared.append((norad_id, name, satellite_from_elements(elements, timescale)))
        except Exception:
            continue
    for norad_id, name, satellite in prepared:
        placed = None
        failed = False
        for moment in moments:
            try:
                ra_deg, dec_deg, alt_deg = observe_satellite(
                    satellite, planets, timescale, moment, latitude, longitude, elevation_m
                )
            except Exception:
                failed = True
                break
            if alt_deg < 0:
                continue
            px, py = sky_to_pixel(ra_deg, dec_deg, wcs)
            if _inside(px, py, wcs):
                placed = (px, py)
        if failed or placed is None:
            continue
        found.append(
            _row(
                "satellite",
                str(norad_id),
                name,
                placed[0],
                placed[1],
                _separation_arcsec(placed[0], placed[1], detections, wcs),
                wcs,
            )
        )
    return found


def _place_body(site, body, timescale, moments, wcs: WCS):
    placed = None
    for moment in moments:
        when = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
        time = timescale.from_datetime(when.astimezone(timezone.utc))
        apparent = site.at(time).observe(body).apparent()
        alt, _az, _distance = apparent.altaz()
        if alt.degrees < 0:
            continue
        ra, dec, _distance = apparent.radec()
        px, py = sky_to_pixel(ra.hours * 15.0, dec.degrees, wcs)
        if _inside(px, py, wcs):
            placed = (px, py)
    return placed


def _inside(x: float, y: float, wcs: WCS) -> bool:
    return 0 <= x < wcs.width and 0 <= y < wcs.height


def _separation_arcsec(x: float, y: float, detections, wcs: WCS) -> float | None:
    if not detections:
        return None
    nearest = min(math.hypot(x - dx, y - dy) for dx, dy, _flux in detections)
    return nearest * wcs.scale_arcsec


def display_name(object_type: str, catalog_id: str, name: str | None) -> str | None:
    """Proper name when the catalog has one. Otherwise the Hipparcos number, never a guessed name."""
    if name:
        return name
    if object_type == "star" and catalog_id:
        return f"HIP {catalog_id}"
    return None


def label_marks(rows: list[dict]) -> list[tuple[float, float, str]]:
    """Circle every matched star. Skip a fainter name when it would sit on a brighter one."""
    marks = []
    placed: list[tuple[float, float]] = []
    ordered = sorted(
        rows,
        key=lambda row: (
            row.get("mag") is None,
            row.get("mag") if row.get("mag") is not None else 99,
            row.get("catalog_id") or "",
        ),
    )
    for row in ordered:
        if (row.get("confidence") or 0) < 0.9:
            continue
        text = display_name(row["object_type"], row["catalog_id"], row.get("name"))
        if not text:
            continue
        x, y = row["pixel_x"], row["pixel_y"]
        if any(math.hypot(x - px, y - py) < 18 for px, py in placed):
            text = ""
        else:
            placed.append((x, y))
        marks.append((x, y, text))
    return marks


def _row(object_type, catalog_id, name, x, y, separation, wcs: WCS, mag: float | None = None):
    if separation is None:
        confidence = 0.4
    elif separation <= 8 * wcs.scale_arcsec:
        confidence = 0.95
    else:
        confidence = max(0.15, 1.0 - separation / (8 * wcs.scale_arcsec))
    return {
        "object_type": object_type,
        "catalog_id": catalog_id,
        "name": name,
        "mag": mag,
        "pixel_x": x,
        "pixel_y": y,
        "separation_arcsec": separation,
        "confidence": confidence,
    }
