"""Draw named-star labels on a copy of the player's upload (solver coords only)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from sky_photo.astrometry import AnnotationPoint

# Prefer named stars; optionally constellation names. Cap when crowded.
DEFAULT_MAX_LABELS = 20
KIND_PRIORITY = {"named_star": 0, "constellation": 1, "deep_sky": 2, "other": 3}


@dataclass(frozen=True)
class LabelPlacement:
    name: str
    x: int
    y: int
    text_x: int
    text_y: int


def select_labels(
    points: list[AnnotationPoint],
    *,
    named_stars: list[str] | None = None,
    include_constellations: bool = False,
    max_labels: int = DEFAULT_MAX_LABELS,
) -> list[AnnotationPoint]:
    """Pick overlay labels from solver annotation points only.

    Prefer entries whose names appear in ``named_stars``, then other named_star
    kind points. Never invent coordinates for names without pixel positions.
    """
    if not points:
        return []

    named_list = list(named_stars or [])
    named_rank = {n.lower(): i for i, n in enumerate(named_list)}
    candidates: list[AnnotationPoint] = []
    for p in points:
        if p.kind == "named_star":
            candidates.append(p)
        elif include_constellations and p.kind == "constellation":
            candidates.append(p)

    def sort_key(p: AnnotationPoint) -> tuple[int, int, int, str]:
        # Prefer order of identity.named_stars, then other named_star points.
        rank = named_rank.get(p.name.lower(), 10_000)
        in_named = 0 if p.name.lower() in named_rank else 1
        return (in_named, rank, KIND_PRIORITY.get(p.kind, 9), p.name)

    # Dedupe by name (first / preferred wins).
    candidates.sort(key=sort_key)
    seen: set[str] = set()
    unique: list[AnnotationPoint] = []
    for p in candidates:
        key = p.name.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
        if len(unique) >= max_labels:
            break
    return unique


def _nudge_placements(
    points: list[AnnotationPoint],
    *,
    width: int,
    height: int,
    font_scale: float,
) -> list[LabelPlacement]:
    """Place text with a simple vertical nudge to reduce overlap."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = max(1, int(round(font_scale * 2)))
    occupied: list[tuple[int, int, int, int]] = []
    placements: list[LabelPlacement] = []

    for p in points:
        x = int(round(p.pixel_x))
        y = int(round(p.pixel_y))
        (tw, th), baseline = cv2.getTextSize(p.name, font, font_scale, thickness)
        # Default: label to the right and slightly above the marker.
        tx = x + 12
        ty = y - 8
        box_h = th + baseline + 6
        box_w = tw + 8

        for _attempt in range(12):
            if tx < 4:
                tx = 4
            if ty - th < 4:
                ty = th + 4
            if tx + box_w > width - 4:
                tx = max(4, width - box_w - 4)
            if ty + baseline > height - 4:
                ty = height - baseline - 4

            box = (tx - 2, ty - th - 2, tx + box_w, ty + baseline + 2)
            if not any(_overlaps(box, other) for other in occupied):
                break
            ty += box_h + 4  # nudge down

        occupied.append((tx - 2, ty - th - 2, tx + box_w, ty + baseline + 2))
        placements.append(LabelPlacement(name=p.name, x=x, y=y, text_x=tx, text_y=ty))

    return placements


def _overlaps(
    a: tuple[int, int, int, int], b: tuple[int, int, int, int], pad: int = 2
) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return not (
        ax1 + pad < bx0
        or bx1 + pad < ax0
        or ay1 + pad < by0
        or by1 + pad < ay0
    )


def render_annotated(
    image_rgb: np.ndarray,
    points: list[AnnotationPoint],
    *,
    named_stars: list[str] | None = None,
    include_constellations: bool = False,
    max_labels: int = DEFAULT_MAX_LABELS,
) -> np.ndarray | None:
    """Return an RGB copy with markers + high-contrast labels, or None if nothing to draw.

    Uses solver pixel coordinates only. Empty / no usable points → None
    (caller should omit annotated image for model-estimate).
    """
    selected = select_labels(
        points,
        named_stars=named_stars,
        include_constellations=include_constellations,
        max_labels=max_labels,
    )
    if not selected:
        return None

    if image_rgb.ndim != 3 or image_rgb.shape[2] < 3:
        raise ValueError("render_annotated expects HxWx3 RGB")

    canvas = image_rgb.copy()
    h, w = canvas.shape[:2]
    # Scale font with image size for legibility on phone vs full-res.
    font_scale = float(np.clip(max(w, h) / 1600.0, 0.45, 1.2))
    thickness = max(1, int(round(font_scale * 2)))
    font = cv2.FONT_HERSHEY_SIMPLEX

    placements = _nudge_placements(
        selected, width=w, height=h, font_scale=font_scale
    )

    for place in placements:
        # Marker: filled cyan dot + dark ring (crosshair-ish).
        cv2.circle(canvas, (place.x, place.y), 5, (0, 0, 0), 2, lineType=cv2.LINE_AA)
        cv2.circle(canvas, (place.x, place.y), 4, (0, 255, 255), -1, lineType=cv2.LINE_AA)
        cv2.drawMarker(
            canvas,
            (place.x, place.y),
            (255, 255, 255),
            markerType=cv2.MARKER_CROSS,
            markerSize=12,
            thickness=1,
            line_type=cv2.LINE_AA,
        )
        # High-contrast label: black outline then bright fill.
        for dx, dy in (
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (-1, 1),
            (1, -1),
            (1, 1),
        ):
            cv2.putText(
                canvas,
                place.name,
                (place.text_x + dx, place.text_y + dy),
                font,
                font_scale,
                (0, 0, 0),
                thickness + 2,
                lineType=cv2.LINE_AA,
            )
        cv2.putText(
            canvas,
            place.name,
            (place.text_x, place.text_y),
            font,
            font_scale,
            (255, 255, 240),
            thickness,
            lineType=cv2.LINE_AA,
        )

    return canvas


def save_annotated_jpeg(
    image_rgb: np.ndarray,
    points: list[AnnotationPoint],
    dest: Path,
    *,
    named_stars: list[str] | None = None,
    include_constellations: bool = False,
    max_labels: int = DEFAULT_MAX_LABELS,
    quality: int = 92,
) -> Path | None:
    """Render and write ``dest`` JPEG without EXIF/GPS. Returns path or None."""
    annotated = render_annotated(
        image_rgb,
        points,
        named_stars=named_stars,
        include_constellations=include_constellations,
        max_labels=max_labels,
    )
    if annotated is None:
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    # OpenCV wants BGR for imencode.
    bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(
        ".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    )
    if not ok:
        raise RuntimeError(f"Failed to encode annotated JPEG for {dest}")
    dest.write_bytes(buf.tobytes())
    return dest
