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
from nightsky.starfacts import story_for
from nightsky.stars import distance_ly
from nightsky.wcs import angular_separation_deg

POLARIS_ID = "11767"
STAR_MAG_LIMIT = 6.0
# Stick figures use Hipparcos ids. The lines are the familiar naked-eye
# patterns, not a licensed chart. A star fainter than the map limit is omitted.
FIGURES = (
    {"name": "Ursa Major", "paths": [["54061", "53910", "58001", "59774", "54061"], ["59774", "62956", "65378", "67301"]]},
    {"name": "Ursa Minor", "paths": [["11767", "85822", "82080", "77055", "72607", "75097", "79822", "77055"]]},
    {"name": "Cassiopeia", "paths": [["746", "3179", "4427", "6686", "8886"]]},
    {
        "name": "Orion",
        "paths": [
            ["27989", "25428", "25336"],
            ["27989", "26727"],
            ["25336", "25930", "26311", "26727", "27366", "24436", "25930"],
        ],
    },
    {"name": "Cygnus", "paths": [["102098", "100453", "95947"], ["102488", "100453", "97165"]]},
    {"name": "Leo", "paths": [["50583", "54872", "57632"], ["50583", "54879", "57632"]]},
    {"name": "Summer Triangle", "paths": [["91262", "102098", "97649", "91262"]]},
)
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
    for row in objects:
        _attach_story(row)
    polaris = next((row for row in stars if row["catalog_id"] == POLARIS_ID), None)
    return {
        "ok": True,
        "latitude": latitude,
        "longitude": longitude,
        "taken_at": moment,
        "declination_deg": declination_deg(latitude, longitude, moment),
        "sidereal_deg": local_sidereal_deg(longitude, moment),
        "polaris": polaris,
        "objects": objects,
        "figures": list(FIGURES),
    }


def galactic_lb(ra_deg: float, dec_deg: float) -> tuple[float, float]:
    """Galactic longitude and latitude in degrees. The same matrix is in the sky shader."""
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    cos_dec = math.cos(dec)
    equatorial = (
        cos_dec * math.cos(ra),
        cos_dec * math.sin(ra),
        math.sin(dec),
    )
    matrix = (
        (-0.0548756, -0.8734371, -0.4838350),
        (0.4941094, -0.4448296, 0.7469822),
        (-0.8676661, -0.1980764, 0.4559838),
    )
    galactic = [sum(row[i] * equatorial[i] for i in range(3)) for row in matrix]
    latitude = math.degrees(math.asin(min(1.0, max(-1.0, galactic[2]))))
    longitude = math.degrees(math.atan2(galactic[1], galactic[0])) % 360.0
    return longitude, latitude


def _attach_story(row: dict) -> None:
    record = row.pop("satcat", None)
    story = story_for(str(row["catalog_id"]), row["object_type"], row.get("name"), record)
    if not story:
        return
    row["constellation"] = story.get("constellation")
    row["about"] = story["about"]
    row["facts"] = list(story["facts"])
    if story.get("distance"):
        row["distance_label"] = story["distance"]


def local_sidereal_deg(longitude: float, when: datetime) -> float:
    """Local sidereal time in degrees, matching the star altitude and azimuth."""
    moment = when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    timescale = Loader(str(SKYFIELD)).timescale()
    return (timescale.from_datetime(moment.astimezone(timezone.utc)).gast * 15.0 + longitude) % 360.0


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
            select catalog_id, name, ra_deg, dec_deg, mag, parallax, pm_ra, pm_dec, spectral_type
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
    parallax = [row[5] for row in rows]
    pm_ra = [row[6] for row in rows]
    pm_dec = [row[7] for row in rows]
    spectral = [row[8] for row in rows]
    altitude, azimuth = _equatorial_to_altaz(ra, dec, latitude, longitude, when)
    found = []
    for index, hip in enumerate(catalog_id):
        found.append(
            {
                "catalog_id": hip,
                "name": name[index] or f"HIP {hip}",
                "object_type": "star",
                "mag": mag[index],
                "parallax_mas": parallax[index],
                "pm_ra": pm_ra[index],
                "pm_dec": pm_dec[index],
                "spectral_type": spectral[index],
                "distance_ly": distance_ly(parallax[index]),
                "ra_deg": float(ra[index]),
                "dec_deg": float(dec[index]),
                "alt_deg": float(altitude[index]),
                "az_deg": float(azimuth[index]),
                "anchor": hip == POLARIS_ID,
            }
        )
    return found


def _equatorial_to_altaz(ra_deg: np.ndarray, dec_deg: np.ndarray, latitude: float, longitude: float, when: datetime):
    sidereal = local_sidereal_deg(longitude, when)
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


def _altaz_to_equatorial(altitude_deg: float, azimuth_deg: float, latitude: float, longitude: float, when: datetime):
    """Inverse of _equatorial_to_altaz for one direction."""
    sidereal = local_sidereal_deg(longitude, when)
    altitude = math.radians(altitude_deg)
    azimuth = math.radians(azimuth_deg)
    phi = math.radians(latitude)
    sin_dec = math.sin(altitude) * math.sin(phi) + math.cos(altitude) * math.cos(phi) * math.cos(azimuth)
    sin_dec = min(1.0, max(-1.0, sin_dec))
    declination = math.asin(sin_dec)
    cosine = math.cos(declination)
    if cosine < 1e-8:
        hour = 0.0
    else:
        sine_hour = -math.sin(azimuth) * math.cos(altitude) / cosine
        cosine_hour = (
            math.cos(phi) * math.sin(altitude) - math.sin(phi) * math.cos(altitude) * math.cos(azimuth)
        ) / cosine
        hour = math.atan2(sine_hour, cosine_hour)
    return (sidereal - math.degrees(hour)) % 360.0, math.degrees(declination)


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
        ra, dec, separation = apparent.radec()
        if object_type == "moon":
            distance_label = f"{separation.km / 1000:.0f} thousand km away"
        else:
            distance_label = f"{separation.au:.2f} astronomical units away"
        found.append(
            {
                "catalog_id": label.lower(),
                "name": label,
                "object_type": object_type,
                "mag": None,
                "ra_deg": float(ra.hours * 15.0),
                "dec_deg": float(dec.degrees),
                "alt_deg": float(alt.degrees),
                "az_deg": float(az.degrees) % 360.0,
                "anchor": False,
                "distance_label": distance_label,
            }
        )
    return found


def _satellite_altaz(conn, latitude: float, longitude: float, when: datetime) -> list[dict]:
    loader = Loader(str(SKYFIELD))
    timescale = loader.timescale()
    site = wgs84.latlon(latitude, longitude)
    moment = timescale.from_datetime(when)
    with conn.cursor() as cur:
        cur.execute(
            """
            select norad_id, name, intl_desig, elements,
                   object_class, ops_status, owner, launch_date, launch_site,
                   perigee_km, apogee_km, period_min, orbit_center, orbit_type
            from satellites
            """
        )
        rows = cur.fetchall()
    found = []
    for (
        norad_id,
        name,
        intl_desig,
        elements,
        object_class,
        ops_status,
        owner,
        launch_date,
        launch_site,
        perigee_km,
        apogee_km,
        period_min,
        orbit_center,
        orbit_type,
    ) in rows:
        try:
            satellite = satellite_from_elements(elements, timescale)
            topocentric = (satellite - site).at(moment)
            alt, az, _distance = topocentric.altaz()
            ra, dec, _separation = topocentric.radec()
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
                "ra_deg": float(ra.hours * 15.0),
                "dec_deg": float(dec.degrees),
                "alt_deg": float(alt.degrees),
                "az_deg": float(az.degrees) % 360.0,
                "anchor": False,
                "satcat": {
                    "intl_desig": intl_desig,
                    "object_class": object_class,
                    "ops_status": ops_status,
                    "owner": owner,
                    "launch_date": launch_date,
                    "launch_site": launch_site,
                    "perigee_km": perigee_km,
                    "apogee_km": apogee_km,
                    "period_min": period_min,
                    "orbit_center": orbit_center,
                    "orbit_type": orbit_type,
                },
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
