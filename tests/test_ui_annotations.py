"""The interactive UI must use solver coordinates in the oriented image frame."""

import math
import unittest
from types import SimpleNamespace

import numpy as np

from sky_photo.astrometry import AnnotationPoint, SolveResult
from sky_photo.pipeline import _ui_annotations


class TestUiAnnotations(unittest.TestCase):
    def setUp(self):
        self.image = SimpleNamespace(full_rgb=np.zeros((200, 400, 3), dtype=np.uint8))

    def test_normalizes_solver_points_and_deduplicates(self):
        solve = SolveResult(solved=True, named_stars=["Vega"], annotation_points=[
            AnnotationPoint("Vega", 100, 150, "named_star"),
            AnnotationPoint("Vega", 200, 100, "named_star"),
        ])
        points = _ui_annotations(self.image, solve)
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0].model_dump(), {"name": "Vega", "kind": "named_star", "x": 0.25, "y": 0.75})

    def test_unsolved_and_missing_positions_never_invent_markers(self):
        self.assertEqual(_ui_annotations(self.image, None), [])
        self.assertEqual(_ui_annotations(self.image, SolveResult(solved=True, named_stars=["Vega"])), [])
        self.assertEqual(_ui_annotations(self.image, SolveResult(solved=False, annotation_points=[AnnotationPoint("Vega", 50, 50, "named_star")])), [])

    def test_invalid_and_out_of_frame_points_are_excluded(self):
        solve = SolveResult(solved=True, annotation_points=[
            AnnotationPoint("Bad x", math.nan, 50, "named_star"),
            AnnotationPoint("Bad y", 50, math.inf, "named_star"),
            AnnotationPoint("Left", -1, 50, "named_star"),
            AnnotationPoint("Right", 400, 50, "named_star"),
            AnnotationPoint("Bottom", 50, 200, "named_star"),
            AnnotationPoint("Valid", 0, 0, "named_star"),
        ])
        points = _ui_annotations(self.image, solve)
        self.assertEqual([point.name for point in points], ["Valid"])


if __name__ == "__main__":
    unittest.main()
