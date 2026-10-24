"""Offline unit tests for Astrometry client helpers (no network)."""

from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock

from sky_photo.astrometry import AstrometryClient, SolveHints, split_annotations


class TestAstrometryClientMocked(unittest.TestCase):
    def test_login_upload_poll_success(self) -> None:
        http = MagicMock()

        def post(url, data=None, files=None):
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            if url.endswith("/login"):
                resp.json.return_value = {
                    "status": "success",
                    "session": "sess123",
                }
            elif url.endswith("/upload"):
                resp.json.return_value = {"status": "success", "subid": 99}
            else:
                resp.json.return_value = {"status": "error"}
            return resp

        def get(url):
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            if "submissions/99" in url:
                resp.json.return_value = {
                    "jobs": [7],
                    "processing_finished": "now",
                }
            elif url.endswith("/jobs/7"):
                resp.json.return_value = {"status": "success"}
            elif "jobs/7/info" in url:
                resp.json.return_value = {
                    "status": "success",
                    "calibration": {
                        "ra": 83.8,
                        "dec": 5.4,
                        "radius": 10.0,
                        "orientation": 12.0,
                        "pixscale": 2.0,
                    },
                    "objects_in_field": ["Orion", "Betelgeuse"],
                    "machine_tags": ["Orion", "Betelgeuse"],
                    "tags": ["Orion", "Betelgeuse"],
                }
            elif "annotations" in url:
                resp.json.return_value = {
                    "annotations": [
                        {
                            "type": "hd",
                            "names": ["Betelgeuse"],
                            "pixelx": 100.0,
                            "pixely": 200.0,
                            "radius": 0.0,
                        }
                    ]
                }
            else:
                resp.json.return_value = {}
            return resp

        http.post.side_effect = post
        http.get.side_effect = get

        client = AstrometryClient(
            api_key="test-key",
            poll_interval_s=0.01,
            poll_timeout_s=2.0,
            client=http,
        )
        result = client.solve(b"fake-jpeg-bytes", hints=SolveHints(center_ra=80, center_dec=5))
        self.assertTrue(result.solved)
        self.assertEqual(result.job_id, 7)
        self.assertAlmostEqual(result.center_ra_deg or 0, 83.8)
        self.assertIn("Betelgeuse", result.named_stars)
        self.assertEqual(len(result.annotation_points), 1)
        self.assertEqual(result.annotation_points[0].pixel_x, 100.0)

        # Upload request-json should include session + optional hints.
        upload_calls = [
            c for c in http.post.call_args_list if str(c.args[0]).endswith("/upload")
        ]
        self.assertTrue(upload_calls)
        files = upload_calls[0].kwargs.get("files") or {}
        req = files.get("request-json")
        self.assertIsNotNone(req)
        payload = json.loads(req[1])
        self.assertEqual(payload["session"], "sess123")
        self.assertEqual(payload["center_ra"], 80)


class TestSplitEmpty(unittest.TestCase):
    def test_empty(self) -> None:
        c, n, d, o, p = split_annotations(
            annotations=[], objects_in_field=[], tags=[]
        )
        self.assertEqual(c, [])
        self.assertEqual(n, [])
        self.assertEqual(d, [])
        self.assertEqual(o, [])
        self.assertEqual(p, [])


if __name__ == "__main__":
    unittest.main()
