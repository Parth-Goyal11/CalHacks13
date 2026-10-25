"""JPL planetary kernel. Positions are computed on demand, not stored as rows."""

from __future__ import annotations

from pathlib import Path

from skyfield.api import Loader

from nightsky.paths import SKYFIELD

KERNEL = "de421.bsp"


def ensure_kernel() -> Path:
    loader = Loader(str(SKYFIELD))
    planets = loader(KERNEL)
    if "earth" not in planets or "moon" not in planets:
        raise RuntimeError("DE421 kernel is missing Earth or the Moon")
    return SKYFIELD / KERNEL


def open_ephemeris():
    loader = Loader(str(SKYFIELD))
    return loader, loader(KERNEL)
