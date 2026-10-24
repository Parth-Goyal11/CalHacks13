"""Score, subject bonus, rarity tiers, caps, and award points.

The vision model never returns score, rarity, or points — only this module does.
Formula and tables match docs/sky-photo-design.md.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal

RarityName = Literal["Common", "Uncommon", "Rare", "Epic", "Legendary"]
IdentityMethod = Literal["plate-solved", "model-estimate"]

# Weighted quality score (rubric ints 0–10).
WEIGHT_CLARITY = 0.25
WEIGHT_TRACKING = 0.20
WEIGHT_EXPOSURE = 0.15
WEIGHT_NOISE = 0.10
WEIGHT_FRAMING = 0.20
WEIGHT_CONDITIONS = 0.10

# Subject bonus: largest that applies (key → points).
SUBJECT_BONUS: dict[str, int] = {
    "plate_solved_star_field": 0,
    "naked_eye_deep_sky": 8,
    "milky_way_core": 10,
    "planet_moon_or_pair": 10,
    "satellite_logged_pass": 15,
    "meteor_streak": 15,
    "aurora_below_50_lat": 20,
    "naked_eye_comet": 25,
    "iss_crossing_moon_or_sun": 30,
}

# Tier → award points (and badge label).
AWARD_POINTS: dict[RarityName, int] = {
    "Common": 5,
    "Uncommon": 10,
    "Rare": 20,
    "Epic": 35,
    "Legendary": 60,
}

TIER_ORDER: list[RarityName] = [
    "Common",
    "Uncommon",
    "Rare",
    "Epic",
    "Legendary",
]

# Cap ceilings by rule name.
CAP_MODEL_ESTIMATE: RarityName = "Rare"
CAP_NO_EXIF_TIME: RarityName = "Uncommon"


@dataclass(frozen=True)
class AwardResult:
    badge: str
    points: int
    card_foil: str | None = None


@dataclass(frozen=True)
class ScoreResult:
    score: int | None
    subject_bonus: int | None
    final_score: int | None
    rarity: RarityName | None
    award: AwardResult | None


def weighted_score(
    clarity: int,
    tracking: int,
    exposure: int,
    noise: int,
    framing: int,
    conditions: int,
) -> int:
    """Round weighted rubric to 0–100 quality score (before subject bonus)."""
    weighted = (
        WEIGHT_CLARITY * clarity
        + WEIGHT_TRACKING * tracking
        + WEIGHT_EXPOSURE * exposure
        + WEIGHT_NOISE * noise
        + WEIGHT_FRAMING * framing
        + WEIGHT_CONDITIONS * conditions
    )
    return round(100 * weighted / 10)


def subject_bonus_for(subjects: Iterable[str]) -> int:
    """Return the largest subject bonus that applies (0 if none / empty)."""
    best = 0
    for key in subjects:
        if key not in SUBJECT_BONUS:
            raise KeyError(f"Unknown subject bonus key: {key!r}")
        best = max(best, SUBJECT_BONUS[key])
    return best


def tier_for_final_score(final_score: int) -> RarityName:
    """Map final_score to rarity tier (before caps)."""
    if final_score < 45:
        return "Common"
    if final_score < 60:
        return "Uncommon"
    if final_score < 75:
        return "Rare"
    if final_score < 90:
        return "Epic"
    return "Legendary"


def _tier_index(tier: RarityName) -> int:
    return TIER_ORDER.index(tier)


def apply_caps(
    tier: RarityName,
    *,
    identity_method: IdentityMethod,
    has_exif_time: bool,
) -> RarityName:
    """Apply post-bonus rarity caps; return the capped tier."""
    capped = tier
    if identity_method == "model-estimate":
        if _tier_index(capped) > _tier_index(CAP_MODEL_ESTIMATE):
            capped = CAP_MODEL_ESTIMATE
    if not has_exif_time:
        if _tier_index(capped) > _tier_index(CAP_NO_EXIF_TIME):
            capped = CAP_NO_EXIF_TIME
    return capped


def award_for(rarity: RarityName, *, card_foil: str | None = None) -> AwardResult:
    """Badge name and points for a rarity tier."""
    return AwardResult(
        badge=f"{rarity} Frame",
        points=AWARD_POINTS[rarity],
        card_foil=card_foil,
    )


def score_photo(
    *,
    is_night_sky: bool,
    clarity: int,
    tracking: int,
    exposure: int,
    noise: int,
    framing: int,
    conditions: int,
    subjects: Iterable[str] = (),
    identity_method: IdentityMethod = "plate-solved",
    has_exif_time: bool = True,
    card_foil: str | None = None,
) -> ScoreResult:
    """Compute score, bonus, final_score, rarity (with caps), and award.

    If ``is_night_sky`` is false, returns nulls for all score fields (no award).
    """
    if not is_night_sky:
        return ScoreResult(
            score=None,
            subject_bonus=None,
            final_score=None,
            rarity=None,
            award=None,
        )

    score = weighted_score(
        clarity, tracking, exposure, noise, framing, conditions
    )
    bonus = subject_bonus_for(subjects)
    final_score = min(100, score + bonus)
    tier = tier_for_final_score(final_score)
    rarity = apply_caps(
        tier,
        identity_method=identity_method,
        has_exif_time=has_exif_time,
    )
    return ScoreResult(
        score=score,
        subject_bonus=bonus,
        final_score=final_score,
        rarity=rarity,
        award=award_for(rarity, card_foil=card_foil),
    )
