"""FastAPI service for Sky Photo (phase 2: ingest + metrics + solve + overlay)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from sky_photo.models import SkyPhotoRecord
from sky_photo.pipeline import DATA_DIR, process_sky_photo
from sky_photo.score import score_photo

app = FastAPI(
    title="OrbitQuest Sky Photo",
    version="0.2.0",
    description=(
        "Phase 2: ingest, OpenCV metrics, Astrometry.net solve, annotated overlay. "
        "Vision judge arrives in phase 3."
    ),
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sky-photo")
async def sky_photo(
    image: UploadFile = File(...),
    claimed_target: str | None = Form(None),
    logged_pass_start: str | None = Form(None),
) -> JSONResponse:
    """Multipart: image + optional claimed_target / logged_pass_start.

    Runs ingest → measure → early night-sky exit → plate-solve → annotate.
    Vision/rubric/score remain stubbed (needs_review=True).
    """
    content_type = (image.content_type or "").lower()
    data = await image.read()
    if not data:
        return JSONResponse(
            status_code=415,
            content={"detail": "Empty upload"},
        )

    outcome = process_sky_photo(
        data,
        content_type=content_type,
        claimed_target=claimed_target,
        logged_pass_start=logged_pass_start,
    )
    payload = outcome.record.model_dump()
    payload["_phase"] = 2
    if outcome.status_code == 415:
        payload["detail"] = "Unsupported or undecodable image"
    elif outcome.status_code == 422:
        payload["detail"] = "Not a night-sky photo"
    elif outcome.status_code == 504:
        payload["detail"] = "Plate-solve timed out; metrics retained"
    return JSONResponse(status_code=outcome.status_code, content=payload)


@app.get("/api/sky-photo/{photo_id}/annotated", response_model=None)
def get_annotated(photo_id: str):
    """Serve the labeled JPEG for a plate-solved photo, if it exists."""
    # Guard path traversal: photo_id is expected ph_<hex>.
    if "/" in photo_id or "\\" in photo_id or ".." in photo_id:
        return JSONResponse(status_code=400, content={"detail": "Invalid photo_id"})
    path = DATA_DIR / f"{photo_id}_annotated.jpg"
    if not path.is_file():
        return JSONResponse(
            status_code=404,
            content={
                "detail": (
                    "Annotated image not found. Labels are only produced after "
                    "a successful plate-solve with annotation pixel coordinates."
                )
            },
        )
    return FileResponse(path, media_type="image/jpeg", filename=path.name)


@app.post("/debug/score")
async def debug_score(body: dict[str, object]) -> dict:
    """Dev helper to exercise score.py without the full pipeline."""
    result = score_photo(
        is_night_sky=bool(body.get("is_night_sky", True)),
        clarity=int(body["clarity"]),  # type: ignore[arg-type]
        tracking=int(body["tracking"]),  # type: ignore[arg-type]
        exposure=int(body["exposure"]),  # type: ignore[arg-type]
        noise=int(body["noise"]),  # type: ignore[arg-type]
        framing=int(body["framing"]),  # type: ignore[arg-type]
        conditions=int(body["conditions"]),  # type: ignore[arg-type]
        subjects=list(body.get("subjects") or []),  # type: ignore[arg-type]
        identity_method=body.get("identity_method", "plate-solved"),  # type: ignore[arg-type]
        has_exif_time=bool(body.get("has_exif_time", True)),
        card_foil=body.get("card_foil"),  # type: ignore[arg-type]
    )
    award = None
    if result.award is not None:
        award = {
            "badge": result.award.badge,
            "points": result.award.points,
            "card_foil": result.award.card_foil,
        }
    return {
        "score": result.score,
        "subject_bonus": result.subject_bonus,
        "final_score": result.final_score,
        "rarity": result.rarity,
        "award": award,
    }


def export_json_schema(path: Path | None = None) -> Path:
    """Write SkyPhotoRecord JSON Schema to docs/sky-photo.schema.json."""
    target = path or (
        Path(__file__).resolve().parent.parent / "docs" / "sky-photo.schema.json"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    schema = SkyPhotoRecord.model_json_schema()
    target.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    return target


if __name__ == "__main__":
    path = export_json_schema()
    print(f"Wrote schema → {path}")
