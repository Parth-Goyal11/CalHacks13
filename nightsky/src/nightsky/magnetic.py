"""Magnetic declination from the World Magnetic Model 2025.

The coefficient file is the public-domain NOAA/NCEI WMM2025 release.
The field is the standard spherical-harmonic synthesis used by that model.
Declination is east-positive: add it to a magnetic compass heading to get
true north.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

_COF = Path(__file__).with_name("wmm2025.cof")
_MAX = 12


def declination_deg(latitude: float, longitude: float, when: datetime, altitude_km: float = 0.0) -> float:
    """Return magnetic declination in degrees, positive east of true north."""
    model = _model()
    year = _decimal_year(when)
    north, east, _down = _field(model, latitude, longitude, altitude_km, year)
    return math.degrees(math.atan2(east, north))


def _decimal_year(when: datetime) -> float:
    moment = when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    moment = moment.astimezone(timezone.utc)
    start = datetime(moment.year, 1, 1, tzinfo=timezone.utc)
    end = datetime(moment.year + 1, 1, 1, tzinfo=timezone.utc)
    return moment.year + (moment - start).total_seconds() / (end - start).total_seconds()


@lru_cache(maxsize=1)
def _model():
    epoch = 2025.0
    gauss = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    secular = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    for line in _COF.read_text().splitlines():
        parts = line.split()
        if len(parts) == 3:
            epoch = float(parts[0])
        elif len(parts) == 6 and not parts[0].startswith("9999"):
            n, m = int(parts[0]), int(parts[1])
            g, h, gdot, hdot = (float(part) for part in parts[2:])
            gauss[m][n] = g
            secular[m][n] = gdot
            if m != 0:
                gauss[n][m - 1] = h
                secular[n][m - 1] = hdot
    # Schmidt coefficients become the unnormalized polynomials used below.
    scale = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    factor = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    scale[0][0] = 1.0
    for n in range(1, _MAX + 1):
        scale[0][n] = scale[0][n - 1] * (2.0 * n - 1) / n
        series = 2.0
        for m in range(n + 1):
            factor[m][n] = ((n - 1) * (n - 1) - m * m) / ((2.0 * n - 1) * (2.0 * n - 3.0))
            if m > 0:
                scale[m][n] = scale[m - 1][n] * math.sqrt(((n - m + 1.0) * series) / (n + m))
                series = 1.0
                gauss[n][m - 1] *= scale[m][n]
                secular[n][m - 1] *= scale[m][n]
            gauss[m][n] *= scale[m][n]
            secular[m][n] *= scale[m][n]
    return epoch, gauss, secular, factor


def _field(model, latitude: float, longitude: float, altitude_km: float, year: float):
    epoch, gauss, secular, factor = model
    elapsed = year - epoch
    major, minor = 6378.137, 6356.7523142
    major2, minor2 = major * major, minor * minor
    major4, minor4 = major2 * major2, minor2 * minor2
    sin_lat = math.sin(math.radians(latitude))
    cos_lat = math.cos(math.radians(latitude))
    sin_lon = math.sin(math.radians(longitude))
    cos_lon = math.cos(math.radians(longitude))
    curve = math.sqrt(major2 - (major2 - minor2) * sin_lat * sin_lat)
    q1 = altitude_km * curve
    ratio = ((q1 + major2) / (q1 + minor2)) ** 2
    cos_colat = sin_lat / math.sqrt(ratio * cos_lat * cos_lat + sin_lat * sin_lat)
    sin_colat = math.sqrt(max(0.0, 1.0 - cos_colat * cos_colat))
    radius = math.sqrt(altitude_km * altitude_km + 2.0 * q1 + (major4 - (major4 - minor4) * sin_lat * sin_lat) / (curve * curve))
    geodetic_radius = math.sqrt(major2 * cos_lat * cos_lat + minor2 * sin_lat * sin_lat)
    cos_delta = (altitude_km + geodetic_radius) / radius
    sin_delta = (major2 - minor2) * cos_lat * sin_lat / (radius * geodetic_radius)

    sine = [0.0] * (_MAX + 1)
    cosine = [0.0] * (_MAX + 1)
    cosine[0] = 1.0
    sine[1] = sin_lon
    cosine[1] = cos_lon
    for order in range(2, _MAX + 1):
        sine[order] = sine[1] * cosine[order - 1] + cosine[1] * sine[order - 1]
        cosine[order] = cosine[1] * cosine[order - 1] - sine[1] * sine[order - 1]

    polar = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    deriv = [[0.0 for _ in range(_MAX + 1)] for _ in range(_MAX + 1)]
    polar[0][0] = 1.0
    radial = theta = phi = pole = 0.0
    radius_power = 6371.2 / radius
    power = radius_power * radius_power
    for n in range(1, _MAX + 1):
        power *= radius_power
        for m in range(n + 1):
            if n == m:
                polar[m][n] = sin_colat * polar[m - 1][n - 1]
                deriv[m][n] = sin_colat * deriv[m - 1][n - 1] + cos_colat * polar[m - 1][n - 1]
            elif n == 1 and m == 0:
                polar[m][n] = cos_colat * polar[m][n - 1]
                deriv[m][n] = cos_colat * deriv[m][n - 1] - sin_colat * polar[m][n - 1]
            else:
                earlier = polar[m][n - 2] if m <= n - 2 else 0.0
                earlier_d = deriv[m][n - 2] if m <= n - 2 else 0.0
                polar[m][n] = cos_colat * polar[m][n - 1] - factor[m][n] * earlier
                deriv[m][n] = cos_colat * deriv[m][n - 1] - sin_colat * polar[m][n - 1] - factor[m][n] * earlier_d
            g = gauss[m][n] + elapsed * secular[m][n]
            h = 0.0 if m == 0 else gauss[n][m - 1] + elapsed * secular[n][m - 1]
            temp1 = g * cosine[m] + h * sine[m]
            temp2 = g * sine[m] - h * cosine[m]
            theta -= power * temp1 * deriv[m][n]
            phi += m * temp2 * power * polar[m][n]
            radial += (n + 1) * temp1 * power * polar[m][n]
            if sin_colat == 0.0 and m == 1:
                pole += m * temp2 * power * polar[m][n]
    if sin_colat == 0.0:
        phi = pole
    else:
        phi /= sin_colat
    north = -theta * cos_delta - radial * sin_delta
    east = phi
    down = theta * sin_delta - radial * cos_delta
    return north, east, down
