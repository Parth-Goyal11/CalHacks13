"""Gnomonic (TAN) projection: north up and east left when rotation is 0."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class WCS:
    ra0: float
    dec0: float
    scale_arcsec: float
    rotation_deg: float
    width: int
    height: int

    @property
    def crpix_x(self) -> float:
        return (self.width - 1) / 2.0

    @property
    def crpix_y(self) -> float:
        return (self.height - 1) / 2.0

    def as_dict(self) -> dict:
        return {
            "projection": "TAN",
            "ra0": self.ra0,
            "dec0": self.dec0,
            "scale_arcsec": self.scale_arcsec,
            "rotation_deg": self.rotation_deg,
            "width": self.width,
            "height": self.height,
            "crpix_x": self.crpix_x,
            "crpix_y": self.crpix_y,
        }


def _scale_rad(wcs: WCS) -> float:
    return math.radians(wcs.scale_arcsec / 3600.0)


def sky_to_pixel(ra_deg, dec_deg, wcs: WCS):
    """Map sky coordinates to 0-based pixel coordinates. Inputs may be arrays."""
    ra = np.radians(np.asarray(ra_deg, dtype=float))
    dec = np.radians(np.asarray(dec_deg, dtype=float))
    ra0 = math.radians(wcs.ra0)
    dec0 = math.radians(wcs.dec0)
    dra = ra - ra0
    denom = np.sin(dec0) * np.sin(dec) + np.cos(dec0) * np.cos(dec) * np.cos(dra)
    xi = np.cos(dec) * np.sin(dra) / denom
    eta = (
        np.cos(dec0) * np.sin(dec) - np.sin(dec0) * np.cos(dec) * np.cos(dra)
    ) / denom
    rot = math.radians(wcs.rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    xr = -xi * cos_r + eta * sin_r
    yr = -xi * sin_r - eta * cos_r
    scale = _scale_rad(wcs)
    x = wcs.crpix_x + xr / scale
    y = wcs.crpix_y + yr / scale
    if np.ndim(x) == 0:
        return float(x), float(y)
    return x, y


def pixel_to_sky(x, y, wcs: WCS) -> tuple[float, float]:
    scale = _scale_rad(wcs)
    xr = (float(x) - wcs.crpix_x) * scale
    yr = (float(y) - wcs.crpix_y) * scale
    rot = math.radians(wcs.rotation_deg)
    cos_r = math.cos(rot)
    sin_r = math.sin(rot)
    xi = -xr * cos_r - yr * sin_r
    eta = xr * sin_r - yr * cos_r
    rho = math.hypot(xi, eta)
    ra0 = math.radians(wcs.ra0)
    dec0 = math.radians(wcs.dec0)
    if rho < 1e-15:
        return wcs.ra0 % 360.0, wcs.dec0
    c = math.atan(rho)
    dec = math.asin(
        math.cos(c) * math.sin(dec0) + (eta * math.sin(c) * math.cos(dec0)) / rho
    )
    ra = ra0 + math.atan2(
        xi * math.sin(c),
        rho * math.cos(dec0) * math.cos(c) - eta * math.sin(dec0) * math.sin(c),
    )
    return math.degrees(ra) % 360.0, math.degrees(dec)


def angular_separation_deg(ra1, dec1, ra2, dec2) -> float:
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    cos_c = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(r1 - r2)
    cos_c = min(1.0, max(-1.0, cos_c))
    return math.degrees(math.acos(cos_c))


def sky_position_angle(ra1, dec1, ra2, dec2) -> float:
    """Position angle from north toward east, in radians."""
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    dra = r2 - r1
    east = math.sin(dra) * math.cos(d2)
    north = math.cos(d1) * math.sin(d2) - math.sin(d1) * math.cos(d2) * math.cos(dra)
    return math.atan2(east, north)


def ra_interval(ra_values: list[float]) -> tuple[float, float, bool]:
    """Return (start, end, wraps) covering the sample, across 0/360 if needed."""
    ras = sorted({v % 360.0 for v in ra_values})
    if len(ras) == 1:
        return ras[0], ras[0], False
    best_gap = -1.0
    start = ras[0]
    end = ras[-1]
    for i, value in enumerate(ras):
        nxt = ras[(i + 1) % len(ras)]
        gap = (nxt - value) % 360.0
        if gap > best_gap:
            best_gap = gap
            start = nxt
            end = value
    return start, end, start > end
