"""Vision judge adapter.

The model returns identity text, a 0–10 rubric, and a critique. It never
returns a score, rarity, or points — ``score.py`` does that.

``VISION_PROVIDER`` is ``grok`` (default) or ``anthropic``.
``VISION_API_KEY`` (Grok also accepts ``XAI_API_KEY``). Temperature 0, JSON
only. Invalid JSON is retried once, then the record is marked needs_review
with rubric left null.
"""

from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from sky_photo.astrometry import SolveResult
from sky_photo.models import Critique, Identity, Rubric
from sky_photo.score import IdentityMethod, ScoreResult, score_photo

PROMPT_PATH = (
    Path(__file__).resolve().parent.parent / "docs" / "sky-photo-vision-prompt.md"
)

_SYSTEM_PROMPT_FALLBACK = """You are the sky-photo judge for OrbitQuest, a game about finding real things in the night sky. You receive one photo and a JSON context block. Return ONE JSON object and nothing else.

WHAT YOU ARE GIVEN
- solver: the plate-solve result, or null. When present it is ground truth: center RA/Dec, field width, rotation, and lists of constellations, named stars and deep-sky objects in the frame.
- metrics: numbers computed from the pixels: sharpness (Laplacian variance; >150 is crisp for a phone photo, <40 is soft), trailing (star elongation ratio; 1.0 round, >1.5 clearly trailed), clipped_pct (share of blown-out pixels), noise_sigma (higher is noisier; >8 is grainy), star_count, horizon_tilt_deg or null.
- exif: capture time, exposure time, ISO, focal length when known.
- claimed_target: what the player says they photographed, or null. Treat it as a claim to check, not a fact.

RULES
1. First decide is_night_sky. A daytime scene, an indoor shot, a screen, a planetarium, a drawing or a rendered star map is false. Then fill only is_night_sky, reason, and stop.
2. Identity. If solver is present, use ONLY its names. Do not add stars or constellations it did not list. You may add non-stellar objects you can see: a planet (name it only if its position fits the solved field; otherwise "bright planet, unidentified"), the Moon, a satellite or aircraft streak, a meteor, aurora, the Milky Way, clouds. If solver is null, you may name at most one constellation and up to three stars as a GUESS, set identity_method to "model-estimate", and never give confidence above 0.6. If you are not sure, say "unidentified" rather than guess.
3. Never confirm a claimed_target you cannot see evidence for. A satellite is a streak or a dot; you cannot tell the ISS from another satellite by looks. Say "streak consistent with a satellite" at most.
4. Rubric sub-scores are integers 0 to 10 using the anchors in the rubric below. Start from the metrics; move by at most 2 points based on what you see, and say why in the critique when you do.
5. Critique: exactly two strengths and two improvements, each one sentence, each concrete and doable with a phone (exposure length, ISO, bracing, timing, framing, where to stand). Friendly, no jargon without a gloss, no exclamation marks.
6. Do not output a total score, a rarity, points, or a verdict on the player. Those are computed elsewhere.
7. Output must be valid JSON matching the schema. No markdown fences, no commentary.

RUBRIC ANCHORS (0-10)
clarity: 0-2 nothing is in focus; 3-5 stars are soft blobs; 6-8 stars are points with slight softness at the edges; 9-10 pin-sharp across the frame.
tracking: 0-2 long streaks everywhere; 3-5 visible elongation; 6-8 slight elongation only when zoomed; 9-10 round stars.
exposure: 0-2 black frame or washed white; 3-5 sky grey and bright stars blown; 6-8 good sky tone, a few clipped highlights; 9-10 full tonal range, faint stars visible, highlights intact.
noise: 0-2 grain hides faint stars; 3-5 obvious grain; 6-8 fine grain only in shadows; 9-10 clean.
framing (alignment): 0-2 target cut off or absent; 3-5 target off to the edge or horizon tilted more than 5 degrees; 6-8 target in frame with room around it, horizon within 2 degrees; 9-10 target well placed, balanced foreground or clean sky, level horizon.
conditions: 0-2 clouds or glare dominate; 3-5 strong light-pollution gradient or Moon glare; 6-8 mild gradient; 9-10 dark, even sky.

OUTPUT SCHEMA
{
  "is_night_sky": boolean,
  "reason": string,
  "identity_method": "plate-solved" | "model-estimate" | "none",
  "confidence": number,
  "constellations": string[],
  "named_stars": string[],
  "brightest_object": string | null,
  "other_objects": string[],
  "claimed_target_check": { "claim": string | null, "supported": "yes" | "partly" | "no" | "cannot_tell", "note": string },
  "rubric": { "clarity": int, "tracking": int, "exposure": int, "noise": int, "framing": int, "conditions": int },
  "critique": { "strengths": [string, string], "improvements": [string, string] },
  "caption": string
}
"""


def load_system_prompt(path: Path | None = None) -> str:
    """Load system prompt from docs/sky-photo-vision-prompt.md (fallback embedded)."""
    target = path or PROMPT_PATH
    try:
        text = target.read_text(encoding="utf-8")
    except OSError:
        return _SYSTEM_PROMPT_FALLBACK
    start = text.find("## System prompt")
    if start < 0:
        return _SYSTEM_PROMPT_FALLBACK
    body = text[start + len("## System prompt") :]
    end = body.find("## User message template")
    if end >= 0:
        body = body[:end]
    prompt = body.strip()
    return prompt or _SYSTEM_PROMPT_FALLBACK


SYSTEM_PROMPT = load_system_prompt()

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)

_NAKED_EYE_DEEP_SKY = (
    "pleiades",
    "m45",
    "andromeda",
    "m31",
    "orion nebula",
    "m42",
)

_MILKY_WAY_CONSTELLATIONS = {"sagittarius", "scorpius", "scorpio"}


class ClaimedTargetCheck(BaseModel):
    claim: str | None = None
    supported: str = "cannot_tell"
    note: str = ""

    @field_validator("supported")
    @classmethod
    def _supported(cls, value: str) -> str:
        allowed = {"yes", "partly", "no", "cannot_tell"}
        if value not in allowed:
            raise ValueError(f"supported must be one of {sorted(allowed)}")
        return value


class VisionJudgment(BaseModel):
    """Parsed model output. Rubric is required only when the scene is night sky."""

    is_night_sky: bool
    reason: str = ""
    identity_method: str = "none"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    constellations: list[str] = Field(default_factory=list)
    named_stars: list[str] = Field(default_factory=list)
    brightest_object: str | None = None
    other_objects: list[str] = Field(default_factory=list)
    claimed_target_check: ClaimedTargetCheck | None = None
    rubric: Rubric | None = None
    critique: Critique | None = None
    caption: str = ""

    @field_validator("identity_method")
    @classmethod
    def _method(cls, value: str) -> str:
        allowed = {"plate-solved", "model-estimate", "none"}
        if value not in allowed:
            raise ValueError(f"identity_method must be one of {sorted(allowed)}")
        return value

    def model_post_init(self, context: Any) -> None:
        if not self.is_night_sky:
            return
        if self.rubric is None or self.critique is None:
            raise ValueError("night-sky judgment requires rubric and critique")
        if len(self.critique.strengths) != 2 or len(self.critique.improvements) != 2:
            raise ValueError(
                "critique needs exactly two strengths and two improvements"
            )


class VisionClient(Protocol):
    def complete(self, *, system: str, user_text: str, image_jpeg: bytes) -> str:
        """Return the model's raw text (JSON)."""


@dataclass
class JudgmentOutcome:
    judgment: VisionJudgment | None
    needs_review: bool
    skipped: bool
    error: str | None
    attempts: int


@dataclass
class AppliedJudgment:
    is_night_sky: bool
    identity: Identity | None
    rubric: Rubric | None
    critique: Critique | None
    score: ScoreResult | None
    needs_review: bool
    subjects: list[str]


class HttpVisionClient:
    """Grok (OpenAI-compatible) or Anthropic messages. No score fields are requested."""

    def __init__(
        self,
        *,
        provider: str,
        api_key: str,
        model: str,
        base_url: str,
        timeout_s: float = 60.0,
        http: httpx.Client | None = None,
    ) -> None:
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self._http = http
        self._owns_http = http is None

    def close(self) -> None:
        if self._owns_http and self._http is not None:
            self._http.close()

    def complete(self, *, system: str, user_text: str, image_jpeg: bytes) -> str:
        client = self._http or httpx.Client(timeout=self.timeout_s)
        created = self._http is None
        try:
            if self.provider == "anthropic":
                return self._anthropic(client, system, user_text, image_jpeg)
            return self._grok(client, system, user_text, image_jpeg)
        finally:
            if created:
                client.close()

    def _grok(
        self,
        client: httpx.Client,
        system: str,
        user_text: str,
        image_jpeg: bytes,
    ) -> str:
        b64 = base64.b64encode(image_jpeg).decode("ascii")
        response = client.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64}"
                                },
                            },
                        ],
                    },
                ],
            },
        )
        response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        return _content_to_text(content)

    def _anthropic(
        self,
        client: httpx.Client,
        system: str,
        user_text: str,
        image_jpeg: bytes,
    ) -> str:
        b64 = base64.b64encode(image_jpeg).decode("ascii")
        response = client.post(
            f"{self.base_url}/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.model,
                "max_tokens": 1024,
                "temperature": 0,
                "system": system,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": user_text},
                        ],
                    }
                ],
            },
        )
        response.raise_for_status()
        body = response.json()
        return _content_to_text(body.get("content"))


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") in (None, "text"):
                parts.append(str(block.get("text") or block.get("content") or ""))
        return "".join(parts)
    if content is None:
        return ""
    return str(content)


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def client_from_env() -> HttpVisionClient | None:
    """Build a client, or None when no API key is configured."""
    provider = (_env("VISION_PROVIDER") or "grok").lower()
    if provider not in {"grok", "anthropic"}:
        provider = "grok"
    api_key = _env("VISION_API_KEY")
    if provider == "grok" and not api_key:
        api_key = _env("XAI_API_KEY")
    if not api_key:
        return None
    if provider == "anthropic":
        model = _env("VISION_MODEL") or "claude-sonnet-4-5"
        base = _env("VISION_API_BASE") or "https://api.anthropic.com/v1"
    else:
        model = _env("VISION_MODEL") or "grok-2-vision-1212"
        base = _env("VISION_API_BASE") or "https://api.x.ai/v1"
    return HttpVisionClient(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base,
    )


def user_message(context: dict[str, Any]) -> str:
    return "Judge this photo. Context:\n" + json.dumps(
        context, separators=(",", ":"), default=str
    )


def parse_judgment(raw: str) -> VisionJudgment:
    text = raw.strip()
    text = _FENCE_RE.sub("", text).strip()
    # Models sometimes wrap JSON in prose. Take the outermost object.
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("response did not contain a JSON object")
    payload = json.loads(text[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("vision response must be a JSON object")
    # The model must not set the game score. Drop those keys if it tries.
    for banned in ("score", "final_score", "rarity", "award", "subject_bonus", "points"):
        payload.pop(banned, None)
    try:
        return VisionJudgment.model_validate(payload)
    except ValidationError:
        raise


def analyze_outcome(
    image_jpeg: bytes,
    context: dict[str, Any],
    *,
    client: VisionClient | None = None,
    judge: VisionClient | None = None,
) -> JudgmentOutcome:
    """Call the judge. Retry once on invalid JSON or schema failure.

    Pass ``client`` (or ``judge``) in tests. When omitted, the env client is
    used. No key → skipped, needs_review, no network.
    """
    chosen = judge if judge is not None else client
    active = chosen if chosen is not None else client_from_env()
    if active is None:
        return JudgmentOutcome(
            judgment=None,
            needs_review=True,
            skipped=True,
            error="VISION_API_KEY is not set",
            attempts=0,
        )

    if isinstance(context, str):
        context_obj: dict[str, Any] = json.loads(context)
    else:
        context_obj = context

    message = user_message(context_obj)
    last_error: str | None = None
    for attempt in (1, 2):
        try:
            raw = active.complete(
                system=SYSTEM_PROMPT,
                user_text=message,
                image_jpeg=image_jpeg,
            )
            return JudgmentOutcome(
                judgment=parse_judgment(raw),
                needs_review=False,
                skipped=False,
                error=None,
                attempts=attempt,
            )
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            last_error = str(exc)
        except Exception as exc:  # network / HTTP
            last_error = str(exc)
    return JudgmentOutcome(
        judgment=None,
        needs_review=True,
        skipped=False,
        error=last_error,
        attempts=2,
    )


def analyze(
    image_bytes: bytes,
    context_json: dict[str, Any] | str,
    *,
    client: VisionClient | None = None,
    judge: VisionClient | None = None,
) -> dict[str, Any]:
    """Public adapter: ``analyze(image_bytes, context_json) -> dict``.

    On success returns the validated judgment fields plus ``needs_review=False``.
    On missing key / invalid JSON after one retry: ``rubric=null``, ``needs_review=True``.
    """
    if isinstance(context_json, str):
        context: dict[str, Any] = json.loads(context_json)
    else:
        context = context_json
    outcome = analyze_outcome(
        image_bytes, context, client=client, judge=judge
    )
    if outcome.judgment is not None and not outcome.needs_review:
        payload = outcome.judgment.model_dump()
        payload["needs_review"] = False
        return payload
    return {
        "is_night_sky": True,
        "reason": outcome.error or "vision validation failed",
        "identity_method": "none",
        "confidence": 0.0,
        "constellations": [],
        "named_stars": [],
        "brightest_object": None,
        "other_objects": [],
        "claimed_target_check": None,
        "rubric": None,
        "critique": None,
        "caption": "",
        "needs_review": True,
    }


def infer_subjects(
    *,
    solved: bool,
    constellations: list[str],
    deep_sky: list[str],
    other: list[str],
    area_lat: float | None,
    matches_logged_pass: bool,
) -> list[str]:
    """Subject-bonus keys the design allows us to confirm without ephemeris.

    Planet pairs, comets, and ISS-on-disk need a published position or a
    logged silhouette. Those stay off until that check exists.
    """
    keys: list[str] = []
    if solved:
        keys.append("plate_solved_star_field")
    blob = " ".join([*deep_sky, *other]).lower()
    if solved and any(name in blob for name in _NAKED_EYE_DEEP_SKY):
        keys.append("naked_eye_deep_sky")
    const_l = {name.lower() for name in constellations}
    if (
        solved
        and "milky way" in blob
        and const_l & _MILKY_WAY_CONSTELLATIONS
    ):
        keys.append("milky_way_core")
    if "meteor" in blob:
        keys.append("meteor_streak")
    if (
        "aurora" in blob
        and area_lat is not None
        and abs(area_lat) < 50
    ):
        keys.append("aurora_below_50_lat")
    if matches_logged_pass and ("satellite" in blob or "streak" in blob):
        keys.append("satellite_logged_pass")
    return keys


def _claim_note(judgment: VisionJudgment) -> str | None:
    check = judgment.claimed_target_check
    if check is None or not check.claim:
        return None
    note = check.note.strip()
    suffix = f" ({note})" if note else ""
    return f"claim: {check.claim} — {check.supported}{suffix}"


def apply_judgment(
    *,
    solve: SolveResult | None,
    outcome: JudgmentOutcome,
    area_lat: float | None,
    matches_logged_pass: bool,
    has_exif_time: bool,
    fallback_identity: Identity,
) -> AppliedJudgment:
    """Merge a judgment onto solver identity and compute the coded score.

    Solver names win. A failed solve stays ``model-estimate`` with confidence
    at most 0.6. A skipped or invalid judge leaves rubric null and needs_review.
    """
    judgment = outcome.judgment
    if outcome.needs_review or judgment is None:
        return AppliedJudgment(
            is_night_sky=True,
            identity=fallback_identity,
            rubric=None,
            critique=None,
            score=None,
            needs_review=True,
            subjects=[],
        )

    if not judgment.is_night_sky:
        return AppliedJudgment(
            is_night_sky=False,
            identity=None,
            rubric=None,
            critique=None,
            score=None,
            needs_review=False,
            subjects=[],
        )

    assert judgment.rubric is not None
    solved = solve is not None and solve.solved
    claim = _claim_note(judgment)

    if solved:
        assert solve is not None
        allowed = {name.casefold() for name in solve.named_stars}
        allowed |= {name.casefold() for name in solve.deep_sky}
        allowed |= {name.casefold() for name in solve.constellations}
        other = list(solve.other)
        for name in solve.deep_sky:
            label = f"deep-sky: {name}"
            if label not in other:
                other.append(label)
        for extra in judgment.other_objects:
            if extra.casefold() in allowed:
                continue
            if extra not in other:
                other.append(extra)
        if claim and claim not in other:
            other.append(claim)
        brightest = judgment.brightest_object
        if brightest is None or brightest.casefold() not in {
            *(name.casefold() for name in solve.named_stars),
            *(name.casefold() for name in solve.deep_sky),
            *(item.casefold() for item in other),
        }:
            brightest = (
                solve.named_stars[0]
                if solve.named_stars
                else (solve.deep_sky[0] if solve.deep_sky else brightest)
            )
        identity = Identity(
            method="plate-solved",
            confidence=0.95,
            center_ra_deg=solve.center_ra_deg,
            center_dec_deg=solve.center_dec_deg,
            field_width_deg=solve.field_width_deg,
            rotation_deg=solve.rotation_deg,
            constellations=list(solve.constellations),
            named_stars=list(solve.named_stars),
            brightest_object=brightest,
            other=other,
        )
        method: IdentityMethod = "plate-solved"
        constellations = list(solve.constellations)
        deep_sky = list(solve.deep_sky)
    else:
        constellations = list(judgment.constellations[:1])
        named_stars = list(judgment.named_stars[:3])
        other = list(judgment.other_objects)
        if claim and claim not in other:
            other.append(claim)
        identity = Identity(
            method="model-estimate",
            confidence=min(0.6, max(0.0, judgment.confidence)),
            constellations=constellations,
            named_stars=named_stars,
            brightest_object=judgment.brightest_object,
            other=other,
        )
        method = "model-estimate"
        deep_sky = []

    subjects = infer_subjects(
        solved=solved,
        constellations=constellations,
        deep_sky=deep_sky,
        other=identity.other,
        area_lat=area_lat,
        matches_logged_pass=matches_logged_pass,
    )
    foil = constellations[0].lower().replace(" ", "-") if constellations else None
    rubric = judgment.rubric
    scored = score_photo(
        is_night_sky=True,
        clarity=rubric.clarity,
        tracking=rubric.tracking,
        exposure=rubric.exposure,
        noise=rubric.noise,
        framing=rubric.framing,
        conditions=rubric.conditions,
        subjects=subjects,
        identity_method=method,
        has_exif_time=has_exif_time,
        card_foil=foil,
    )
    return AppliedJudgment(
        is_night_sky=True,
        identity=identity,
        rubric=rubric,
        critique=judgment.critique,
        score=scored,
        needs_review=False,
        subjects=subjects,
    )
