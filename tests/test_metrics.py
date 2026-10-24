"""Metrics tests on fixtures (synthetic placeholders until Ben replaces them)."""

from __future__ import annotations

import unittest
from pathlib import Path

import cv2

from sky_photo.metrics import is_night_sky, measure

FIX = Path(__file__).resolve().parent / "fixtures"


def _load_gray(name: str):
    path = FIX / name
    if not path.is_file():
        raise unittest.SkipTest(
            f"Missing fixture {path}; run python3 tests/generate_fixtures.py"
        )
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise unittest.SkipTest(f"Could not read fixture {path}")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)


class TestFixtureMetrics(unittest.TestCase):
    def test_blurry_less_sharp_than_sharp(self) -> None:
        sharp = measure(_load_gray("sharp_orion.jpg"))
        blurry = measure(_load_gray("blurry_phone.jpg"))
        self.assertGreater(
            sharp.sharpness,
            blurry.sharpness,
            msg=(
                f"Expected sharp_orion sharpness ({sharp.sharpness}) > "
                f"blurry_phone ({blurry.sharpness})"
            ),
        )

    def test_daytime_cat_not_night_sky(self) -> None:
        cat = measure(_load_gray("daytime_cat.jpg"))
        self.assertFalse(
            is_night_sky(cat),
            msg=(
                f"daytime_cat should early-exit: star_count={cat.star_count}, "
                f"mean_brightness={cat.mean_brightness}"
            ),
        )
        self.assertLess(cat.star_count, 15)
        self.assertGreater(cat.mean_brightness, 80)

    def test_sharp_orion_is_night_sky(self) -> None:
        sharp = measure(_load_gray("sharp_orion.jpg"))
        self.assertTrue(is_night_sky(sharp))
        self.assertGreaterEqual(sharp.star_count, 15)

    def test_metric_fields_present(self) -> None:
        m = measure(_load_gray("sharp_orion.jpg"))
        self.assertIsInstance(m.sharpness, float)
        self.assertIsInstance(m.trailing, float)
        self.assertGreaterEqual(m.trailing, 1.0)
        self.assertGreaterEqual(m.clipped_pct, 0.0)
        self.assertGreaterEqual(m.crushed_pct, 0.0)
        self.assertGreaterEqual(m.noise_sigma, 0.0)
        self.assertIsInstance(m.star_count, int)


if __name__ == "__main__":
    unittest.main()
