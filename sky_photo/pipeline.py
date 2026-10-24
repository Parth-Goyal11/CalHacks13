"""Phase-2 pipeline: ingest → measure → (early exit) → plate-solve → annotate.

Vision / rubric / final scoring stay stubbed until phase 3.
"""

from __future__ import annotations

import io
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from sky_photo.astrometry import (
    AstrometryAuthError,
    SolveHints,
    SolveResult,
    solve_image,
)
from sky_photo.ingest import (
    IngestResult,
    UnsupportedImageError,
    field_width_deg_from_focal_length,
    ingest_image,
    parse_iso_time,
    zenith_radec,
)
from sky_photo.metrics import ImageMetrics, is_night_sky, measure
from sky_photo.models import (
    Area,
    Evidence,
    Identity,
    Metrics,
    SkyPhotoRecord,
)
from sky_photo.overlay import save_annotated_jpeg

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "photos"


@dataclass
class PipelineOutcome:
    record: SkyPhotoRecord
    status_code: int
    ingest: IngestResult | None = None
    metrics: ImageMetrics | None = None
    solve: SolveResult | None = None


def _hints_from_ingest(ingest: IngestResult) -> SolveHints | None:
    hints = SolveHints()
    has_any = False

    when = parse_iso_time(ingest.exif.datetime_original)
    if (
        ingest.area_lat is not None
        and ingest.area_lon is not None
        and when is not None
    ):
        ra, dec = zenith_radec(ingest.area_lat, ingest.area_lon, when)
        hints.center_ra = ra
        hints.center_dec = dec
        hints.radius_deg = 45.0
        has_any = True

    fl = ingest.exif.focal_length_mm
    if fl is not None and fl > 0:
        try:
            fov = field_width_deg_from_focal_length(fl)
            hints.scale_lower = max(0.1, fov * 0.4)
            hints.scale_upper = max(hints.scale_lower + 0.1, fov * 2.5)
            hints.scale_units = "degwidth"
            has_any = True
        except ValueError:
            pass

    return hints if has_any else None


def _full_jpeg_bytes(ingest: IngestResult) -> bytes:
    """Encode full-res RGB as JPEG for the solver (EXIF already stripped)."""
    img = Image.fromarray(ingest.full_rgb, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95, optimize=True)
    return buf.getvalue()


def _metrics_model(m: ImageMetrics) -> Metrics:
    return Metrics(
        sharpness=round(m.sharpness, 4),
        trailing=round(m.trailing, 4),
        clipped_pct=round(m.clipped_pct, 4),
        crushed_pct=round(m.crushed_pct, 4),
        noise_sigma=round(m.noise_sigma, 4),
        star_count=m.star_count,
        horizon_tilt_deg=(
            round(m.horizon_tilt_deg, 3) if m.horizon_tilt_deg is not None else None
        ),
        mean_brightness=round(m.mean_brightness, 3),
    )


def _identity_from_solve(solve: SolveResult | None) -> Identity:
    if solve is not None and solve.solved:
        other = list(solve.other)
        for name in solve.deep_sky:
            label = f"deep-sky: {name}"
            if label not in other:
                other.append(label)
        return Identity(
            method="plate-solved",
            confidence=0.95,
            center_ra_deg=solve.center_ra_deg,
            center_dec_deg=solve.center_dec_deg,
            field_width_deg=solve.field_width_deg,
            rotation_deg=solve.rotation_deg,
            constellations=solve.constellations,
            named_stars=solve.named_stars,
            brightest_object=(
                solve.named_stars[0]
                if solve.named_stars
                else (solve.deep_sky[0] if solve.deep_sky else None)
            ),
            other=other,
        )
    # Failed / timed-out / skipped solve → labelled estimate placeholder.
    # Vision (phase 3) will fill text; confidence capped at 0.6 per design.
    err = None if solve is None else solve.error
    return Identity(
        method="model-estimate",
        confidence=0.0,
        constellations=[],
        named_stars=[],
        other=[
            "solve pending vision estimate"
            if err is None
            else f"solve failed: {err}"
        ],
    )


def _evidence(
    ingest: IngestResult,
    *,
    logged_pass_start: str | None,
) -> Evidence:
    area = None
    if ingest.area_lat is not None and ingest.area_lon is not None:
        area = Area(lat=ingest.area_lat, lon=ingest.area_lon)

    # Geographic match needs observer coords (not in the form yet) → False.
    matches = False
    if logged_pass_start and ingest.exif.datetime_original:
        pass_dt = parse_iso_time(logged_pass_start)
        exif_dt = parse_iso_time(ingest.exif.datetime_original)
        if pass_dt and exif_dt:
            _ = abs((exif_dt - pass_dt).total_seconds())
            matches = False

    return Evidence(
        exif_time=ingest.exif.datetime_original,
        area=area,
        matches_logged_pass=matches,
    )


def _persist(record: SkyPhotoRecord) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{record.photo_id}.json"
    path.write_text(record.model_dump_json(indent=2), encoding="utf-8")


def _maybe_annotate(
    photo_id: str,
    ingest: IngestResult,
    solve: SolveResult | None,
) -> tuple[str | None, str | None]:
    """Write annotated JPEG when plate-solved with pixel annotations.

    Returns (annotated_path, annotated_image_url). Both None when labels
    cannot be drawn honestly (failed solve / no pixel coords).
    """
    if solve is None or not solve.solved or not solve.annotation_points:
        return None, None

    dest = DATA_DIR / f"{photo_id}_annotated.jpg"
    written = save_annotated_jpeg(
        ingest.full_rgb,
        solve.annotation_points,
        dest,
        named_stars=solve.named_stars,
        include_constellations=False,
    )
    if written is None:
        return None, None
    rel = f"data/photos/{photo_id}_annotated.jpg"
    url = f"/api/sky-photo/{photo_id}/annotated"
    return rel, url


def process_sky_photo(
    image_bytes: bytes,
    *,
    content_type: str | None = None,
    claimed_target: str | None = None,
    logged_pass_start: str | None = None,
    skip_solve: bool = False,
) -> PipelineOutcome:
    """Run ingest + metrics + optional plate-solve + annotate.

    Status codes:
    - 200 success (metrics filled; identity from solve or model-estimate stub)
    - 415 unsupported image type / decode failure
    - 422 not night-sky (early exit before solve/model)
    - 504 solver timeout (metrics + model-estimate identity still returned)
    """
    photo_id = f"ph_{uuid.uuid4().hex[:16]}"
    _ = claimed_target  # forwarded to vision in phase 3

    try:
        ingest = ingest_image(image_bytes, content_type)
    except UnsupportedImageError:
        record = SkyPhotoRecord(
            photo_id=photo_id,
            is_night_sky=False,
            needs_review=True,
        )
        return PipelineOutcome(record=record, status_code=415)

    metrics = measure(ingest.full_gray)
    metrics_model = _metrics_model(metrics)

    if not is_night_sky(metrics):
        record = SkyPhotoRecord(
            photo_id=photo_id,
            is_night_sky=False,
            metrics=metrics_model,
            evidence=_evidence(ingest, logged_pass_start=logged_pass_start),
            needs_review=False,
        )
        _persist(record)
        return PipelineOutcome(
            record=record,
            status_code=422,
            ingest=ingest,
            metrics=metrics,
        )

    solve: SolveResult | None = None
    status_code = 200
    if skip_solve:
        solve = SolveResult(solved=False, error="solve skipped")
    else:
        hints = _hints_from_ingest(ingest)
        try:
            jpeg = _full_jpeg_bytes(ingest)
            solve = solve_image(jpeg, hints=hints, filename=f"{photo_id}.jpg")
            if solve.timed_out:
                status_code = 504
        except AstrometryAuthError as exc:
            logger.warning("Astrometry unavailable: %s", exc)
            solve = SolveResult(solved=False, error=str(exc))
        except Exception as exc:  # network / unexpected
            logger.exception("Astrometry solve failed: %s", exc)
            solve = SolveResult(solved=False, error=str(exc))

    identity = _identity_from_solve(solve)
    annotated_path, annotated_url = _maybe_annotate(photo_id, ingest, solve)

    record = SkyPhotoRecord(
        photo_id=photo_id,
        is_night_sky=True,
        identity=identity,
        metrics=metrics_model,
        rubric=None,  # vision phase 3
        critique=None,
        score=None,
        subject_bonus=None,
        final_score=None,
        rarity=None,
        award=None,
        evidence=_evidence(ingest, logged_pass_start=logged_pass_start),
        needs_review=True,  # no vision/rubric yet
        annotated_path=annotated_path,
        annotated_image_url=annotated_url,
    )
    _persist(record)
    return PipelineOutcome(
        record=record,
        status_code=status_code,
        ingest=ingest,
        metrics=metrics,
        solve=solve,
    )
