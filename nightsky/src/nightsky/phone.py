"""Turn a phone's orientation sensors into the lens aim.

The angles are the W3C deviceorientation values: alpha, beta, and gamma, in
an East-North-Up frame whose north is true north. The camera looks out the
back of the phone. Screen angle is the clockwise rotation of the page from
the phone's natural portrait, from screen.orientation.angle.

iOS does not report an absolute alpha. Its webkitCompassHeading is the
magnetic heading of the top of the phone; alpha_from_compass turns that into
the alpha this module expects.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class PhonePose:
    azimuth_deg: float
    altitude_deg: float
    roll_deg: float


def alpha_from_compass(magnetic_heading_deg: float, declination_deg: float) -> float:
    """W3C alpha for a phone whose top points along a magnetic compass heading.

    Declination is degrees east of true north, the same sign as the sky chart.
    """
    true_heading = (magnetic_heading_deg + declination_deg) % 360.0
    return (360.0 - true_heading) % 360.0


def phone_pose(alpha_deg: float, beta_deg: float, gamma_deg: float, screen_deg: float = 0.0) -> PhonePose:
    """Azimuth, altitude, and roll of the rear camera for one orientation sample."""
    matrix = _rotation_matrix(alpha_deg, beta_deg, gamma_deg)
    forward = -matrix[:, 2]
    screen = math.radians(screen_deg)
    screen_up = matrix @ np.array([math.sin(screen), math.cos(screen), 0.0])
    return _pose_from_vectors(forward, screen_up)


def _rotation_matrix(alpha_deg: float, beta_deg: float, gamma_deg: float) -> np.ndarray:
    """Device axes in Earth coordinates. Columns are the device x, y, and z axes."""
    x_angle = math.radians(beta_deg)
    y_angle = math.radians(gamma_deg)
    z_angle = math.radians(alpha_deg)
    cosine_x, sine_x = math.cos(x_angle), math.sin(x_angle)
    cosine_y, sine_y = math.cos(y_angle), math.sin(y_angle)
    cosine_z, sine_z = math.cos(z_angle), math.sin(z_angle)
    return np.array(
        [
            [
                cosine_z * cosine_y - sine_z * sine_x * sine_y,
                -cosine_x * sine_z,
                cosine_y * sine_z * sine_x + cosine_z * sine_y,
            ],
            [
                cosine_y * sine_z + cosine_z * sine_x * sine_y,
                cosine_z * cosine_x,
                sine_z * sine_y - cosine_z * cosine_y * sine_x,
            ],
            [
                -cosine_x * sine_y,
                sine_x,
                cosine_x * cosine_y,
            ],
        ],
        dtype=float,
    )


def _pose_from_vectors(forward: np.ndarray, screen_up: np.ndarray) -> PhonePose:
    length = float(np.linalg.norm(forward))
    if length < 1e-8:
        return PhonePose(0.0, 0.0, 0.0)
    forward = forward / length
    altitude = math.degrees(math.asin(min(1.0, max(-1.0, float(forward[2])))))
    east, north = float(forward[0]), float(forward[1])
    if math.hypot(east, north) < 1e-6:
        east, north = 0.0, 0.0
    azimuth = math.degrees(math.atan2(east, north)) % 360.0
    right, up = _level_basis(forward, azimuth)
    lifted = screen_up - forward * float(np.dot(screen_up, forward))
    lifted_length = float(np.linalg.norm(lifted))
    if lifted_length < 1e-5:
        roll = 0.0
    else:
        lifted = lifted / lifted_length
        roll = math.degrees(math.atan2(float(np.dot(lifted, right)), float(np.dot(lifted, up))))
        if abs(roll + 180.0) < 1e-6:
            roll = 180.0
    return PhonePose(azimuth, altitude, roll)


def _level_basis(forward: np.ndarray, azimuth_deg: float):
    """Match horizon._basis before roll is applied, including the zenith fallback."""
    world_up = np.array([0.0, 0.0, 1.0])
    right = np.cross(forward, world_up)
    if float(np.linalg.norm(right)) < 1e-4:
        azimuth = math.radians(azimuth_deg)
        heading = np.array([math.sin(azimuth), math.cos(azimuth), 0.0])
        right = np.cross(forward, heading)
    right = right / np.linalg.norm(right)
    up = np.cross(right, forward)
    up = up / np.linalg.norm(up)
    return right, up
