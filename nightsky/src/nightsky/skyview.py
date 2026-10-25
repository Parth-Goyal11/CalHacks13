"""A labeled sky for one place, time, and camera aim.

Stars, planets, and satellites are placed by altitude and azimuth. The phone
supplies the direction of the lens. Polaris marks true north: its altitude is
the observer's latitude.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np
import psycopg
from skyfield.api import Loader, wgs84

from nightsky.horizon import Aim, project_altaz, search_radius_deg
from nightsky.magnetic import declination_deg
from nightsky.paths import SKYFIELD
from nightsky.planets import open_ephemeris
from nightsky.satellites import satellite_from_elements
from nightsky.solve import Star
from nightsky.wcs import angular_separation_deg

POLARIS_ID = "11767"
STAR_MAG_LIMIT = 5.0
_BODIES = (
    ("moon", "Moon", "moon"),
    ("mercury", "Mercury", "planet"),
    ("venus", "Venus", "planet"),
    ("mars", "Mars", "planet"),
    ("jupiter barycenter", "Jupiter", "planet"),
    ("saturn barycenter", "Saturn", "planet"),
)


def sky_chart(conn: psycopg.Connection, latitude: float, longitude: float, when: datetime) -> dict:
    """Catalog objects above the horizon, plus the compass correction for this place."""
    moment = when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    moment = moment.astimezone(timezone.utc)
    stars = _star_altaz(conn, latitude, longitude, moment)
    moving = _planet_altaz(latitude, longitude, moment) + _satellite_altaz(conn, latitude, longitude, moment)
    objects = [row for row in stars + moving if row["alt_deg"] > -1.0]
    objects.sort(key=lambda row: (row["mag"] is None, row["mag"] if row["mag"] is not None else 99))
    polaris = next((row for row in stars if row["catalog_id"] == POLARIS_ID), None)
    return {
        "ok": True,
        "latitude": latitude,
        "longitude": longitude,
        "taken_at": moment,
        "declination_deg": declination_deg(latitude, longitude, moment),
        "polaris": polaris,
        "objects": objects,
    }


def direction_radec(latitude: float, longitude: float, when: datetime, azimuth_deg: float, altitude_deg: float):
    """Right ascension and declination at the center of the lens."""
    moment = when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    timescale = Loader(str(SKYFIELD)).timescale()
    observer = wgs84.latlon(latitude, longitude).at(timescale.from_datetime(moment.astimezone(timezone.utc)))
    ra, dec, _distance = observer.from_altaz(alt_degrees=altitude_deg, az_degrees=azimuth_deg).radec()
    return ra.hours * 15.0, dec.degrees


def stars_in_view(stars: list[Star], ra_deg: float, dec_deg: float, aim: Aim) -> list[Star]:
    """Keep the catalog patch the phone is pointing at, with room for compass error."""
    radius = search_radius_deg(aim)
    return [
        star
        for star in stars
        if angular_separation_deg(star.ra_deg, star.dec_deg, ra_deg, dec_deg) <= radius
    ]


def _star_altaz(conn, latitude: float, longitude: float, when: datetime) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select catalog_id, name, ra_deg, dec_deg, mag
            from stars
            where mag <= %s
            """,
            (STAR_MAG_LIMIT,),
        )
        rows = cur.fetchall()
    if not rows:
        return []
    catalog_id = [row[0] for row in rows]
    name = [row[1] for row in rows]
    ra = np.array([row[2] for row in rows], dtype=float)
    dec = np.array([row[3] for row in rows], dtype=float)
    mag = [row[4] for row in rows]
    altitude, azimuth = _equatorial_to_altaz(ra, dec, latitude, longitude, when)
    found = []
    for index, hip in enumerate(catalog_id):
        found.append(
            {
                "catalog_id": hip,
                "name": name[index] or f"HIP {hip}",
                "object_type": "star",
                "mag": mag[index],
                "alt_deg": float(altitude[index]),
                "az_deg": float(azimuth[index]),
                "anchor": hip == POLARIS_ID,
            }
        )
    return found


def _equatorial_to_altaz(ra_deg: np.ndarray, dec_deg: np.ndarray, latitude: float, longitude: float, when: datetime):
    timescale = Loader(str(SKYFIELD)).timescale()
    sidereal = (timescale.from_datetime(when).gast * 15.0 + longitude) % 360.0
    hour = np.radians((sidereal - ra_deg + 180.0) % 360.0 - 180.0)
    dec = np.radians(dec_deg)
    phi = math.radians(latitude)
    sin_alt = np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.cos(hour)
    sin_alt = np.clip(sin_alt, -1.0, 1.0)
    altitude = np.degrees(np.arcsin(sin_alt))
    east = -np.cos(dec) * np.sin(hour)
    north = np.sin(dec) * np.cos(phi) - np.cos(dec) * np.sin(phi) * np.cos(hour)
    azimuth = np.degrees(np.atan2(east, north)) % 360.0
    return altitude, azimuth


def _planet_altaz(latitude: float, longitude: float, when: datetime) -> list[dict]:
    loader, planets = open_ephemeris()
    timescale = loader.timescale()
    site = planets["earth"] + wgs84.latlon(latitude, longitude)
    time = timescale.from_datetime(when)
    found = []
    for key, label, object_type in _BODIES:
        if key not in planets:
            continue
        apparent = site.at(time).observe(planets[key]).apparent()
        alt, az, _distance = apparent.altaz()
        found.append(
            {
                "catalog_id": label.lower(),
                "name": label,
                "object_type": object_type,
                "mag": None,
                "alt_deg": float(alt.degrees),
                "az_deg": float(az.degrees) % 360.0,
                "anchor": False,
            }
        )
    return found


def _satellite_altaz(conn, latitude: float, longitude: float, when: datetime) -> list[dict]:
    loader = Loader(str(SKYFIELD))
    timescale = loader.timescale()
    site = wgs84.latlon(latitude, longitude)
    moment = timescale.from_datetime(when)
    with conn.cursor() as cur:
        cur.execute("select norad_id, name, elements from satellites")
        rows = cur.fetchall()
    found = []
    for norad_id, name, elements in rows:
        try:
            satellite = satellite_from_elements(elements, timescale)
            topocentric = (satellite - site).at(moment)
            alt, az, _distance = topocentric.altaz()
        except Exception:
            continue
        if alt.degrees <= -1.0:
            continue
        found.append(
            {
                "catalog_id": str(norad_id),
                "name": name or str(norad_id),
                "object_type": "satellite",
                "mag": None,
                "alt_deg": float(alt.degrees),
                "az_deg": float(az.degrees) % 360.0,
                "anchor": False,
            }
        )
    return found


def overlay_marks(chart: dict, aim: Aim) -> list[tuple[float, float, str]]:
    """Pixel marks for objects inside the photo, plus the cardinal directions."""
    marks = []
    for row in chart["objects"]:
        if row["alt_deg"] < 0:
            continue
        pixel = project_altaz(row["alt_deg"], row["az_deg"], aim)
        if pixel is None or not _inside(*pixel, aim):
            continue
        marks.append((pixel[0], pixel[1], row["name"] if _label_text(row) else ""))
    for name, azimuth in (("N", 0.0), ("E", 90.0), ("S", 180.0), ("W", 270.0)):
        pixel = project_altaz(0.0, azimuth, aim)
        if pixel is not None and _inside(*pixel, aim):
            marks.append((pixel[0], pixel[1], name))
    return marks


def overlay_rows(chart: dict, aim: Aim) -> list[dict]:
    rows = []
    for row in chart["objects"]:
        if row["alt_deg"] < 0:
            continue
        pixel = project_altaz(row["alt_deg"], row["az_deg"], aim)
        if pixel is None or not _inside(*pixel, aim):
            continue
        rows.append(
            {
                "object_type": row["object_type"],
                "catalog_id": row["catalog_id"],
                "name": row["name"],
                "mag": row["mag"],
                "pixel_x": pixel[0],
                "pixel_y": pixel[1],
                "separation_arcsec": None,
                "confidence": 0.7,
                "grade": "predicted",
            }
        )
    return rows


def _label_text(row: dict) -> bool:
    if row.get("anchor") or row["object_type"] != "star":
        return True
    if row["name"] and not str(row["name"]).startswith("HIP "):
        return True
    return row["mag"] is not None and row["mag"] <= 2.5


def _inside(x: float, y: float, aim: Aim) -> bool:
    return 0 <= x < aim.width and 0 <= y < aim.height
