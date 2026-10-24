"""Annotated overlay: solver pixel coords only; no fake labels."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np

from sky_photo.astrometry import AnnotationPoint, split_annotations
from sky_photo.overlay import render_annotated, save_annotated_jpeg, select_labels


class TestSelectLabels(unittest.TestCase):
    def test_prefers_named_stars_with_coords(self) -> None:
        points = [
            AnnotationPoint("Betelgeuse", 10, 20, "named_star"),
            AnnotationPoint("Rigel", 30, 40, "named_star"),
            AnnotationPoint("NGC 1976", 50, 60, "deep_sky"),
        ]
        selected = select_labels(points, named_stars=["Rigel", "Betelgeuse"])
        names = [p.name for p in selected]
        self.assertEqual(names, ["Rigel", "Betelgeuse"])

    def test_no_points_means_no_labels(self) -> None:
        self.assertEqual(select_labels([]), [])


class TestRenderAnnotated(unittest.TestCase):
    def test_draws_on_copy_not_inventing(self) -> None:
        img = np.zeros((120, 160, 3), dtype=np.uint8)
        points = [AnnotationPoint("Rigel", 80, 60, "named_star")]
        out = render_annotated(img, points, named_stars=["Rigel"])
        self.assertIsNotNone(out)
        assert out is not None
        self.assertEqual(out.shape, img.shape)
        # Marker neighborhood should be brighter than pure black.
        self.assertGreater(int(out[60, 80].max()), 0)
        # Original unchanged.
        self.assertEqual(int(img[60, 80].sum()), 0)

    def test_model_estimate_no_points_returns_none(self) -> None:
        img = np.zeros((80, 80, 3), dtype=np.uint8)
        self.assertIsNone(render_annotated(img, []))

    def test_save_jpeg(self) -> None:
        img = np.full((100, 100, 3), 10, dtype=np.uint8)
        points = [AnnotationPoint("Vega", 50, 50, "named_star")]
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "ann.jpg"
            path = save_annotated_jpeg(img, points, dest, named_stars=["Vega"])
            self.assertEqual(path, dest)
            self.assertTrue(dest.is_file())
            self.assertGreater(dest.stat().st_size, 0)


class TestSplitAnnotationsPixels(unittest.TestCase):
    def test_points_require_pixel_coords(self) -> None:
        annotations = [
            {
                "type": "hd",
                "names": ["HD 1 / Betelgeuse"],
                "pixelx": 100.5,
                "pixely": 200.25,
                "radius": 0.0,
            },
            {
                "type": "ngc",
                "names": ["NGC 1976"],
                "pixelx": 10,
                "pixely": 20,
            },
        ]
        constellations, named, deep, other, points = split_annotations(
            annotations=annotations,
            objects_in_field=["Orion"],
            tags=["Orion"],
        )
        self.assertIn("Orion", constellations)
        self.assertTrue(any("Betelgeuse" in n or n.startswith("HD") for n in named))
        self.assertIn("NGC 1976", deep)
        self.assertEqual(len(points), 2)
        self.assertTrue(all(p.pixel_x > 0 for p in points))


if __name__ == "__main__":
    unittest.main()
