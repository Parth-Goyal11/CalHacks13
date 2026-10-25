"""Telescope photograph for the sky map.

The picture is Axel Mellinger's all-sky color mosaic, served by the CDS
hips2fits service. Hubble and JWST frames cover only a few arcminutes, so
they cannot fill a view tens of degrees wide. Schmidt-plate surveys cover
the sky, but the plate edges show up as a grid at this width. The cutout is
turned so celestial north lies in the same direction as on the camera.
"""

from __future__ import annotations

import hashlib
import math
import urllib.parse
import urllib.request
from datetime import datetime

import numpy as np

from nightsky.horizon import Aim, project_altaz, vertical_fov_deg
from nightsky.paths import OUTPUT
from nightsky.skyview import _altaz_to_equatorial, _equatorial_to_altaz

SURVEY = "CDS/P/Mellinger/color"
_SERVICE = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits"
_CACHE = OUTPUT / "backdrop"


def survey_rotation_deg(latitude: float, longitude: float, when: datetime, aim: Aim) -> float:
    """Clockwise degrees from screen-up to celestial north, for the survey image."""
    ra, dec = _altaz_to_equatorial(aim.altitude_deg, aim.azimuth_deg, latitude, longitude, when)
    step = 0.35 if dec < 89 else -0.35
    altitude, azimuth = _equatorial_to_altaz(
        np.array([ra, ra]),
        np.array([dec, dec + step]),
        latitude,
        longitude,
        when,
    )
    center = project_altaz(float(altitude[0]), float(azimuth[0]), aim)
    north = project_altaz(float(altitude[1]), float(azimuth[1]), aim)
    if center is None or north is None:
        return 0.0
    dx = north[0] - center[0]
    dy = north[1] - center[1]
    if step < 0:
        dx, dy = -dx, -dy
    if dx * dx + dy * dy < 1e-6:
        return 0.0
    return math.degrees(math.atan2(dx, -dy))


def survey_jpeg(latitude: float, longitude: float, when: datetime, aim: Aim) -> bytes:
    """Return a JPEG of the telescope survey aligned to this aim."""
    _CACHE.mkdir(parents=True, exist_ok=True)
    fov = max(aim.fov_deg, vertical_fov_deg(aim))
    rotation = survey_rotation_deg(latitude, longitude, when, aim)
    ra, dec = _altaz_to_equatorial(aim.altitude_deg, aim.azimuth_deg, latitude, longitude, when)
    key = hashlib.sha256(
        f"v3|{SURVEY}|{latitude:.2f}|{longitude:.2f}|{ra:.2f}|{dec:.2f}|{-rotation:.1f}|{fov:.1f}|{aim.width}|{aim.height}".encode()
    ).hexdigest()[:24]
    path = _CACHE / f"{key}.jpg"
    if path.is_file() and path.stat().st_size > 1000:
        return path.read_bytes()
    query = urllib.parse.urlencode(
        {
            "hips": SURVEY,
            "ra": f"{ra:.5f}",
            "dec": f"{dec:.5f}",
            "fov": f"{fov:.4f}",
            "width": aim.width,
            "height": aim.height,
            "projection": "TAN",
            "coordsys": "icrs",
            "rotation_angle": f"{-rotation:.3f}",
            "format": "jpg",
            "stretch": "sqrt",
            "min_cut": "1%",
            "max_cut": "99.5%",
        }
    )
    request = urllib.request.Request(f"{_SERVICE}?{query}", headers={"User-Agent": "nightsky/0.1"})
    with urllib.request.urlopen(request, timeout=25) as response:
        body = response.read()
    if not body.startswith(b"\xff\xd8"):
        raise RuntimeError("The sky survey did not return a photograph.")
    path.write_bytes(body)
    return body
