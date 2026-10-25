"""Project altitude and azimuth into a camera pointed at the sky.

Azimuth is degrees clockwise from true north. Altitude is degrees above the
horizon. Roll is degrees clockwise as seen from behind the phone. The
horizontal field of view is the full lens width.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Aim:
    azimuth_deg: float
    altitude_deg: float
    roll_deg: float
    fov_deg: float
    width: int
    height: int


def project_altaz(altitude_deg: float, azimuth_deg: float, aim: Aim) -> tuple[float, float] | None:
    """Return pixel coordinates, or None when the object is behind the lens."""
    right, up, forward = _basis(aim)
    star = _unit(altitude_deg, azimuth_deg)
    depth = _dot(star, forward)
    if depth <= 0.02:
        return None
    focal = (aim.width / 2.0) / math.tan(math.radians(aim.fov_deg) / 2.0)
    x = (aim.width - 1) / 2.0 + focal * _dot(star, right) / depth
    y = (aim.height - 1) / 2.0 - focal * _dot(star, up) / depth
    return x, y


def project_many(altitude_deg: np.ndarray, azimuth_deg: np.ndarray, aim: Aim) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Vector form of project_altaz. The mask is true for objects in front of the lens."""
    right, up, forward = _basis(aim)
    east, north, zenith = _unit_array(altitude_deg, azimuth_deg)
    depth = east * forward[0] + north * forward[1] + zenith * forward[2]
    visible = depth > 0.02
    safe = np.where(visible, depth, 1.0)
    focal = (aim.width / 2.0) / math.tan(math.radians(aim.fov_deg) / 2.0)
    across = east * right[0] + north * right[1] + zenith * right[2]
    climb = east * up[0] + north * up[1] + zenith * up[2]
    x = (aim.width - 1) / 2.0 + focal * across / safe
    y = (aim.height - 1) / 2.0 - focal * climb / safe
    return x, y, visible


def vertical_fov_deg(aim: Aim) -> float:
    return math.degrees(2.0 * math.atan(math.tan(math.radians(aim.fov_deg) / 2.0) * aim.height / max(aim.width, 1)))


def search_radius_deg(aim: Aim) -> float:
    """Catalog cone wide enough for the lens plus a phone-compass miss."""
    half = 0.5 * math.hypot(aim.fov_deg, vertical_fov_deg(aim))
    return half + 18.0


def _basis(aim: Aim) -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    forward = _unit(aim.altitude_deg, aim.azimuth_deg)
    world_up = (0.0, 0.0, 1.0)
    right = _cross(forward, world_up)
    if _norm(right) < 1e-4:
        heading = (math.sin(math.radians(aim.azimuth_deg)), math.cos(math.radians(aim.azimuth_deg)), 0.0)
        right = _cross(forward, heading)
    right = _scale(right, 1.0 / _norm(right))
    up = _cross(right, forward)
    up = _scale(up, 1.0 / _norm(up))
    roll = math.radians(aim.roll_deg)
    cosine, sine = math.cos(roll), math.sin(roll)
    rolled_right = _add(_scale(right, cosine), _scale(up, -sine))
    rolled_up = _add(_scale(right, sine), _scale(up, cosine))
    return rolled_right, rolled_up, forward


def _unit(altitude_deg: float, azimuth_deg: float) -> tuple[float, float, float]:
    altitude = math.radians(altitude_deg)
    azimuth = math.radians(azimuth_deg)
    return (
        math.cos(altitude) * math.sin(azimuth),
        math.cos(altitude) * math.cos(azimuth),
        math.sin(altitude),
    )


def _unit_array(altitude_deg: np.ndarray, azimuth_deg: np.ndarray):
    altitude = np.radians(altitude_deg)
    azimuth = np.radians(azimuth_deg)
    cos_alt = np.cos(altitude)
    return cos_alt * np.sin(azimuth), cos_alt * np.cos(azimuth), np.sin(altitude)


def _dot(a, b) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _add(a, b) -> tuple[float, float, float]:
    return a[0] + b[0], a[1] + b[1], a[2] + b[2]


def _scale(vector, factor: float) -> tuple[float, float, float]:
    return vector[0] * factor, vector[1] * factor, vector[2] * factor


def _norm(vector) -> float:
    return math.sqrt(_dot(vector, vector))
