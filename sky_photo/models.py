"""Pydantic models for the Sky Photo record (design doc shape)."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class IdentityMethod(str, Enum):
    PLATE_SOLVED = "plate-solved"
    MODEL_ESTIMATE = "model-estimate"


class Rarity(str, Enum):
    COMMON = "Common"
    UNCOMMON = "Uncommon"
    RARE = "Rare"
    EPIC = "Epic"
    LEGENDARY = "Legendary"


class Identity(BaseModel):
    method: Literal["plate-solved", "model-estimate"]
    confidence: float = Field(ge=0.0, le=1.0)
    center_ra_deg: float | None = None
    center_dec_deg: float | None = None
    field_width_deg: float | None = None
    rotation_deg: float | None = None
    constellations: list[str] = Field(default_factory=list)
    named_stars: list[str] = Field(default_factory=list)
    brightest_object: str | None = None
    other: list[str] = Field(default_factory=list)


class Metrics(BaseModel):
    sharpness: float
    trailing: float
    clipped_pct: float
    crushed_pct: float | None = None  # share of pixels ≤ 5
    noise_sigma: float
    star_count: int
    horizon_tilt_deg: float | None = None
    mean_brightness: float | None = None


class Rubric(BaseModel):
    clarity: int = Field(ge=0, le=10)
    tracking: int = Field(ge=0, le=10)
    exposure: int = Field(ge=0, le=10)
    noise: int = Field(ge=0, le=10)
    framing: int = Field(ge=0, le=10)
    conditions: int = Field(ge=0, le=10)


class Critique(BaseModel):
    strengths: list[str]
    improvements: list[str]


class Award(BaseModel):
    badge: str
    points: int
    card_foil: str | None = None


class Area(BaseModel):
    lat: float
    lon: float


class Evidence(BaseModel):
    exif_time: str | None = None
    area: Area | None = None
    matches_logged_pass: bool = False


class PhotoAnnotation(BaseModel):
    """Solver point normalized to the EXIF-oriented image, not a model guess."""

    name: str
    kind: str
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)


class SkyPhotoRecord(BaseModel):
    """Full Sky Photo result record written to data/photos/<photo_id>.json."""

    photo_id: str
    is_night_sky: bool
    identity: Identity | None = None
    metrics: Metrics | None = None
    rubric: Rubric | None = None
    critique: Critique | None = None
    score: int | None = None
    subject_bonus: int | None = None
    final_score: int | None = None
    rarity: (
        Literal["Common", "Uncommon", "Rare", "Epic", "Legendary"] | None
    ) = None
    award: Award | None = None
    evidence: Evidence | None = None
    needs_review: bool = False
    # Annotated overlay (plate-solved only; omitted / null on model-estimate).
    annotated_path: str | None = None
    annotated_image_url: str | None = None
    annotations: list[PhotoAnnotation] = Field(default_factory=list)
