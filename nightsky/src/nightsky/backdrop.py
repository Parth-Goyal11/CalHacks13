"""Telescope photograph for the sky map.

The picture is Axel Mellinger's all-sky color mosaic, served by the CDS
hips2fits service. Hubble and JWST frames cover only a few arcminutes, so
they cannot fill a view tens of degrees wide. Schmidt-plate surveys cover
the sky, but the plate edges show up as a grid at this width. The cutout is
turned so celestial north lies in the same direction as on the camera.
Colors are then graded darker and more saturated, so faint dust and
nebulae read more like a processed telescope picture.
"""

from __future__ import annotations

import hashlib
import io
import math
import urllib.parse
import urllib.request
from datetime import datetime

import numpy as np
from PIL import Image

from nightsky.horizon import Aim, _basis, project_altaz, vertical_fov_deg
from nightsky.paths import OUTPUT
from nightsky.skyview import _altaz_to_equatorial, _equatorial_to_altaz

SURVEY = "CDS/P/Mellinger/color"
PANORAMA_WIDTH = 2048
PANORAMA_HEIGHT = 1024
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


def grade_telescope(image: Image.Image) -> Image.Image:
    """Push a pale sky survey toward a deeper, more saturated telescope view."""
    pixels = np.asarray(image.convert("RGB")).astype(np.float32) / 255.0
    black = float(np.percentile(pixels, 12))
    white = float(np.percentile(pixels, 99.3))
    pixels = np.clip((pixels - black) / max(white - black, 1e-3), 0.0, 1.0)
    pixels = np.power(pixels, 0.88)
    luma = pixels @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    pixels = np.clip(luma[..., None] + (pixels - luma[..., None]) * 2.3, 0.0, 1.0)
    pixels = np.clip((pixels - 0.5) * 1.12 + 0.5, 0.0, 1.0)
    return Image.fromarray((pixels * 255.0).round().astype(np.uint8), "RGB")


def pixel_radec(x: float, y: float, aim: Aim, latitude: float, longitude: float, when: datetime):
    """Right ascension and declination of a screen pixel. y increases downward."""
    right, up, forward = _basis(aim)
    focal = (aim.width / 2.0) / math.tan(math.radians(aim.fov_deg) / 2.0)
    center_x = (aim.width - 1) / 2.0
    center_y = (aim.height - 1) / 2.0
    across = (x - center_x) / focal
    climb = -(y - center_y) / focal
    length = math.sqrt(across * across + climb * climb + 1.0)
    across, climb, depth = across / length, climb / length, 1.0 / length
    east = across * right[0] + climb * up[0] + depth * forward[0]
    north = across * right[1] + climb * up[1] + depth * forward[1]
    zenith = across * right[2] + climb * up[2] + depth * forward[2]
    altitude = math.degrees(math.asin(min(1.0, max(-1.0, zenith))))
    azimuth = math.degrees(math.atan2(east, north)) % 360.0
    return _altaz_to_equatorial(altitude, azimuth, latitude, longitude, when)


def panorama_jpeg() -> bytes:
    """One graded all-sky photograph. The page redraws a view from it as the slider moves."""
    _CACHE.mkdir(parents=True, exist_ok=True)
    path = _CACHE / f"panorama-v5-{PANORAMA_WIDTH}.jpg"
    if path.is_file() and path.stat().st_size > 1000:
        return path.read_bytes()
    query = urllib.parse.urlencode(
        {
            "hips": SURVEY,
            "ra": "0",
            "dec": "0",
            "fov": "360",
            "width": PANORAMA_WIDTH,
            "height": PANORAMA_HEIGHT,
            "projection": "CAR",
            "coordsys": "icrs",
            "rotation_angle": "0",
            "format": "jpg",
            "stretch": "sqrt",
            "min_cut": "1%",
            "max_cut": "99.5%",
        }
    )
    request = urllib.request.Request(f"{_SERVICE}?{query}", headers={"User-Agent": "nightsky/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    if not body.startswith(b"\xff\xd8"):
        raise RuntimeError("The sky survey did not return a photograph.")
    graded = io.BytesIO()
    grade_telescope(Image.open(io.BytesIO(body))).save(graded, format="JPEG", quality=86)
    body = graded.getvalue()
    path.write_bytes(body)
    return body


def survey_jpeg(latitude: float, longitude: float, when: datetime, aim: Aim) -> bytes:
    """Return a JPEG of the telescope survey aligned to this aim."""
    _CACHE.mkdir(parents=True, exist_ok=True)
    fov = max(aim.fov_deg, vertical_fov_deg(aim))
    rotation = survey_rotation_deg(latitude, longitude, when, aim)
    ra, dec = _altaz_to_equatorial(aim.altitude_deg, aim.azimuth_deg, latitude, longitude, when)
    key = hashlib.sha256(
        f"v5|{SURVEY}|{latitude:.2f}|{longitude:.2f}|{ra:.2f}|{dec:.2f}|{-rotation:.1f}|{fov:.1f}|{aim.width}|{aim.height}".encode()
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
    graded = io.BytesIO()
    grade_telescope(Image.open(io.BytesIO(body))).save(graded, format="JPEG", quality=86)
    body = graded.getvalue()
    path.write_bytes(body)
    return body
