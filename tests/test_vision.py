"""Recorded-response unit tests for the vision judge. No network."""

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path

import httpx

from sky_photo.astrometry import SolveResult
from sky_photo.models import Identity
from sky_photo.pipeline import process_sky_photo
from sky_photo.vision import (
    HttpVisionClient,
    JudgmentOutcome,
    analyze,
    analyze_outcome,
    apply_judgment,
    infer_subjects,
    parse_judgment,
)

FIX = Path(__file__).resolve().parent / "fixtures"

RUBRIC = {
    "clarity": 8,
    "tracking": 9,
    "exposure": 7,
    "noise": 6,
    "framing": 8,
    "conditions": 6,
}
CRITIQUE = {
    "strengths": [
        "Stars stay points across the middle of the frame.",
        "Orion sits with room around the belt.",
    ],
    "improvements": [
        "Shorten the exposure to about 8 seconds so the brighter stars stay tight.",
        "Brace the phone on a railing so the horizon stays level.",
    ],
}


class ScriptedJudge:
    """VisionClient stand-in that returns canned complete() replies."""

    def __init__(self, replies: list[str]) -> None:
        self.replies = list(replies)
        self.calls = 0
        self.last_system: str | None = None
        self.last_user_text: str | None = None

    def complete(self, *, system: str, user_text: str, image_jpeg: bytes) -> str:
        self.calls += 1
        self.last_system = system
        self.last_user_text = user_text
        if not self.replies:
            raise AssertionError("judge called more times than scripted")
        return self.replies.pop(0)


def _night_payload(**overrides: object) -> str:
    payload: dict[str, object] = {
        "is_night_sky": True,
        "reason": "Star field.",
        "identity_method": "model-estimate",
        "confidence": 0.95,
        "constellations": ["Orion", "Taurus", "Canis Major"],
        "named_stars": ["Betelgeuse", "Rigel", "Bellatrix", "Sirius", "Aldebaran"],
        "brightest_object": "Betelgeuse",
        "other_objects": ["Milky Way"],
        "rubric": RUBRIC,
        "critique": CRITIQUE,
        "caption": "Orion over a dark sky.",
        "score": 99,
        "rarity": "Legendary",
    }
    payload.update(overrides)
    return json.dumps(payload)


def _fallback() -> Identity:
    return Identity(
        method="model-estimate",
        confidence=0.0,
        other=["solve pending vision estimate"],
    )


class TestParseJudgment(unittest.TestCase):
    def test_strips_fences_and_drops_score_fields(self) -> None:
        raw = "```json\n" + _night_payload() + "\n```"
        judgment = parse_judgment(raw)
        self.assertTrue(judgment.is_night_sky)
        self.assertEqual(judgment.rubric.clarity, 8)  # type: ignore[union-attr]
        dumped = judgment.model_dump()
        self.assertNotIn("score", dumped)
        self.assertNotIn("rarity", dumped)

    def test_daytime_may_omit_rubric(self) -> None:
        judgment = parse_judgment(
            json.dumps({"is_night_sky": False, "reason": "Daytime scene."})
        )
        self.assertFalse(judgment.is_night_sky)
        self.assertIsNone(judgment.rubric)

    def test_night_sky_without_rubric_rejected(self) -> None:
        with self.assertRaises(Exception):
            parse_judgment(json.dumps({"is_night_sky": True, "reason": "stars"}))


class TestAnalyzeOutcome(unittest.TestCase):
    def test_retries_once_then_accepts(self) -> None:
        judge = ScriptedJudge(["not json", _night_payload()])
        outcome = analyze_outcome(b"jpeg", {"solver": None}, client=judge)
        self.assertEqual(judge.calls, 2)
        self.assertEqual(outcome.attempts, 2)
        self.assertFalse(outcome.needs_review)
        self.assertFalse(outcome.skipped)
        self.assertIsNotNone(outcome.judgment)

    def test_second_failure_needs_review(self) -> None:
        judge = ScriptedJudge(["nope", "still nope"])
        outcome = analyze_outcome(b"jpeg", {"solver": None}, client=judge)
        self.assertEqual(judge.calls, 2)
        self.assertTrue(outcome.needs_review)
        self.assertIsNone(outcome.judgment)
        applied = apply_judgment(
            solve=None,
            outcome=outcome,
            area_lat=None,
            matches_logged_pass=False,
            has_exif_time=True,
            fallback_identity=_fallback(),
        )
        self.assertIsNone(applied.rubric)
        self.assertIsNone(applied.score)
        self.assertTrue(applied.needs_review)

    def test_missing_key_skips_without_network(self) -> None:
        saved = {
            name: os.environ.pop(name, None)
            for name in ("VISION_API_KEY", "XAI_API_KEY", "VISION_PROVIDER")
        }
        try:
            outcome = analyze_outcome(b"jpeg", {"solver": None})
        finally:
            for name, value in saved.items():
                if value is not None:
                    os.environ[name] = value
        self.assertTrue(outcome.skipped)
        self.assertEqual(outcome.attempts, 0)
        self.assertTrue(outcome.needs_review)
        self.assertIn("VISION_API_KEY", outcome.error or "")


class TestAnalyzeDict(unittest.TestCase):
    """Public ``analyze(image_bytes, context) -> dict`` adapter."""

    def test_success_dict_includes_needs_review_false(self) -> None:
        judge = ScriptedJudge([_night_payload()])
        payload = analyze(b"jpeg", {"solver": None}, client=judge)
        self.assertFalse(payload["needs_review"])
        self.assertTrue(payload["is_night_sky"])
        self.assertEqual(payload["rubric"]["clarity"], 8)
        self.assertEqual(payload["critique"]["strengths"][0].startswith("Stars"), True)
        self.assertNotIn("score", payload)
        self.assertNotIn("rarity", payload)

    def test_invalid_json_dict_marks_needs_review(self) -> None:
        judge = ScriptedJudge(["{", "{"])
        payload = analyze(b"jpeg", {"solver": None}, client=judge)
        self.assertTrue(payload["needs_review"])
        self.assertIsNone(payload["rubric"])
        self.assertIsNone(payload["critique"])
        self.assertEqual(payload["identity_method"], "none")

    def test_accepts_context_json_string(self) -> None:
        judge = ScriptedJudge([_night_payload()])
        payload = analyze(b"jpeg", json.dumps({"solver": None}), client=judge)
        self.assertFalse(payload["needs_review"])
        self.assertIn("solver", judge.last_user_text or "")


class TestHttpVisionClient(unittest.TestCase):
    """HttpVisionClient against recorded httpx responses (no network)."""

    def test_grok_posts_json_object_temperature_zero(self) -> None:
        seen: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["url"] = str(request.url)
            seen["auth"] = request.headers.get("authorization")
            body = json.loads(request.content.decode("utf-8"))
            seen["body"] = body
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"content": _night_payload()}},
                    ]
                },
            )

        transport = httpx.MockTransport(handler)
        http = httpx.Client(transport=transport)
        client = HttpVisionClient(
            provider="grok",
            api_key="test-key",
            model="grok-2-vision-1212",
            base_url="https://api.x.ai/v1",
            http=http,
        )
        try:
            raw = client.complete(
                system="sys",
                user_text="Judge this photo.",
                image_jpeg=b"fake-jpeg",
            )
        finally:
            http.close()

        self.assertEqual(seen["url"], "https://api.x.ai/v1/chat/completions")
        self.assertEqual(seen["auth"], "Bearer test-key")
        body = seen["body"]
        assert isinstance(body, dict)
        self.assertEqual(body["temperature"], 0)
        self.assertEqual(body["response_format"], {"type": "json_object"})
        judgment = parse_judgment(raw)
        self.assertTrue(judgment.is_night_sky)

    def test_anthropic_reads_content_blocks(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.headers.get("x-api-key"), "anth-key")
            self.assertTrue(str(request.url).endswith("/messages"))
            body = json.loads(request.content.decode("utf-8"))
            self.assertEqual(body["temperature"], 0)
            return httpx.Response(
                200,
                json={
                    "content": [
                        {"type": "text", "text": _night_payload()},
                    ]
                },
            )

        transport = httpx.MockTransport(handler)
        http = httpx.Client(transport=transport)
        client = HttpVisionClient(
            provider="anthropic",
            api_key="anth-key",
            model="claude-sonnet-4-5",
            base_url="https://api.anthropic.com/v1",
            http=http,
        )
        try:
            raw = client.complete(
                system="sys",
                user_text="Judge this photo.",
                image_jpeg=b"fake-jpeg",
            )
        finally:
            http.close()

        self.assertTrue(parse_judgment(raw).is_night_sky)


class TestApplyJudgment(unittest.TestCase):
    def test_model_estimate_caps_names_and_confidence(self) -> None:
        outcome = analyze_outcome(
            b"jpeg", {"solver": None}, client=ScriptedJudge([_night_payload()])
        )
        applied = apply_judgment(
            solve=None,
            outcome=outcome,
            area_lat=None,
            matches_logged_pass=False,
            has_exif_time=True,
            fallback_identity=_fallback(),
        )
        assert applied.identity is not None
        self.assertEqual(applied.identity.method, "model-estimate")
        self.assertLessEqual(applied.identity.confidence, 0.6)
        self.assertEqual(applied.identity.constellations, ["Orion"])
        self.assertEqual(
            applied.identity.named_stars,
            ["Betelgeuse", "Rigel", "Bellatrix"],
        )
        self.assertEqual(applied.score.rarity, "Rare")  # type: ignore[union-attr]
        self.assertEqual(applied.score.final_score, 76)  # type: ignore[union-attr]
        self.assertNotEqual(applied.score.final_score, 99)  # type: ignore[union-attr]

    def test_solver_names_win_and_milky_way_bonus(self) -> None:
        solve = SolveResult(
            solved=True,
            constellations=["Sagittarius"],
            named_stars=["Kaus Australis"],
            deep_sky=["Lagoon Nebula"],
            center_ra_deg=270.0,
            center_dec_deg=-30.0,
        )
        payload = _night_payload(
            identity_method="plate-solved",
            constellations=["Orion"],
            named_stars=["Sirius"],
            brightest_object="Sirius",
            other_objects=["Milky Way", "bright planet, unidentified"],
        )
        outcome = analyze_outcome(
            b"jpeg", {"solver": {}}, client=ScriptedJudge([payload])
        )
        applied = apply_judgment(
            solve=solve,
            outcome=outcome,
            area_lat=37.8,
            matches_logged_pass=False,
            has_exif_time=True,
            fallback_identity=_fallback(),
        )
        assert applied.identity is not None
        self.assertEqual(applied.identity.method, "plate-solved")
        self.assertEqual(applied.identity.constellations, ["Sagittarius"])
        self.assertEqual(applied.identity.named_stars, ["Kaus Australis"])
        self.assertNotIn("Sirius", applied.identity.named_stars)
        self.assertIn("Milky Way", applied.identity.other)
        self.assertEqual(applied.identity.brightest_object, "Kaus Australis")
        self.assertIn("milky_way_core", applied.subjects)
        self.assertEqual(applied.score.subject_bonus, 10)  # type: ignore[union-attr]
        self.assertEqual(applied.score.rarity, "Epic")  # type: ignore[union-attr]

    def test_vision_rejects_scene(self) -> None:
        outcome = JudgmentOutcome(
            judgment=parse_judgment(
                json.dumps({"is_night_sky": False, "reason": "A screen, not the sky."})
            ),
            needs_review=False,
            skipped=False,
            error=None,
            attempts=1,
        )
        applied = apply_judgment(
            solve=None,
            outcome=outcome,
            area_lat=None,
            matches_logged_pass=False,
            has_exif_time=False,
            fallback_identity=_fallback(),
        )
        self.assertFalse(applied.is_night_sky)
        self.assertIsNone(applied.score)

    def test_infer_subjects_skips_unconfirmed_iss(self) -> None:
        keys = infer_subjects(
            solved=True,
            constellations=["Orion"],
            deep_sky=[],
            other=["streak consistent with a satellite"],
            area_lat=37.9,
            matches_logged_pass=False,
        )
        self.assertNotIn("satellite_logged_pass", keys)
        self.assertNotIn("iss_crossing_moon_or_sun", keys)


class TestPipelineVision(unittest.TestCase):
    def test_sharp_fixture_scores_from_recorded_judge(self) -> None:
        path = FIX / "sharp_orion.jpg"
        if not path.is_file():
            self.skipTest("missing sharp_orion.jpg")
        judge = ScriptedJudge([_night_payload()])
        outcome = process_sky_photo(
            path.read_bytes(),
            content_type="image/jpeg",
            skip_solve=True,
            vision_client=judge,
        )
        self.assertEqual(judge.calls, 1)
        self.assertEqual(outcome.status_code, 200)
        record = outcome.record
        self.assertTrue(record.is_night_sky)
        self.assertFalse(record.needs_review)
        assert record.identity is not None
        self.assertEqual(record.identity.method, "model-estimate")
        self.assertLessEqual(record.identity.confidence, 0.6)
        self.assertEqual(len(record.identity.constellations), 1)
        self.assertLessEqual(len(record.identity.named_stars), 3)
        self.assertEqual(record.final_score, 76)
        # Synthetic fixture has no EXIF time, so the Uncommon cap wins over Rare.
        self.assertIsNone(record.evidence.exif_time if record.evidence else None)
        self.assertEqual(record.rarity, "Uncommon")
        self.assertIsNone(record.annotated_path)

    def test_judge_can_reject_after_metrics_pass(self) -> None:
        path = FIX / "sharp_orion.jpg"
        if not path.is_file():
            self.skipTest("missing sharp_orion.jpg")
        judge = ScriptedJudge(
            [json.dumps({"is_night_sky": False, "reason": "Planetarium screen."})]
        )
        outcome = process_sky_photo(
            path.read_bytes(),
            content_type="image/jpeg",
            skip_solve=True,
            vision_client=judge,
        )
        self.assertEqual(outcome.status_code, 422)
        self.assertFalse(outcome.record.is_night_sky)
        self.assertIsNone(outcome.record.score)
        self.assertIsNone(outcome.record.annotated_path)

    def test_daytime_fixture_never_calls_judge(self) -> None:
        path = FIX / "daytime_cat.jpg"
        if not path.is_file():
            self.skipTest("missing daytime_cat.jpg")
        judge = ScriptedJudge([_night_payload()])
        outcome = process_sky_photo(
            path.read_bytes(),
            content_type="image/jpeg",
            skip_solve=True,
            vision_client=judge,
        )
        self.assertEqual(judge.calls, 0)
        self.assertEqual(outcome.status_code, 422)
        self.assertFalse(outcome.record.is_night_sky)


if __name__ == "__main__":
    unittest.main()
