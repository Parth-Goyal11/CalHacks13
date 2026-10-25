"""Turn an uploaded photo into a plate solution and a labeled preview."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psycopg
from PIL import Image, ImageOps

from nightsky.imageutil import detect_stars, display_gray, draw_labels, load_gray_png, save_gray_png
from nightsky.match import display_name, identify_capture, label_marks
from nightsky.paths import OUTPUT
from nightsky.pipeline import DEMO_KEY, store_solved_capture
from nightsky.solve import solve_image
from nightsky.stars import bright_stars

MAX_EDGE = 1400


def load_photo(path: Path) -> tuple[np.ndarray, bool]:
    """Return a grayscale array and whether it was shrunk to MAX_EDGE."""
    with Image.open(path) as handle:
        image = ImageOps.exif_transpose(handle).convert("L")
        resized = max(image.size) > MAX_EDGE
        if resized:
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        return np.asarray(image, dtype=np.float32), resized


def read_exif(path: Path) -> dict:
    """Read a camera timestamp and GPS fix. EXIF time has no zone and is returned as UTC."""
    found = {"taken_at": None, "latitude": None, "longitude": None, "time_assumed_utc": False}
    try:
        with Image.open(path) as image:
            exif = image.getexif()
            if not exif:
                return found
            raw_time = exif.get(36867) or exif.get(306)
            parsed = _parse_exif_time(raw_time)
            if parsed is not None:
                found["taken_at"] = parsed
                found["time_assumed_utc"] = True
            gps = exif.get_ifd(0x8825)
            if gps:
                found["latitude"] = _gps_degrees(gps.get(2), gps.get(1))
                found["longitude"] = _gps_degrees(gps.get(4), gps.get(3))
    except Exception:
        return found
    return found


def identify_photo(
    conn: psycopg.Connection,
    path: Path,
    taken_at: datetime | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    elevation_m: float | None = None,
    exposure_seconds: float | None = None,
) -> dict:
    """Solve one photo. A failed solve still returns the frame and the peaks that were found."""
    exif = read_exif(path)
    hints = {"taken_at": None, "location": None, "time_assumed_utc": False}
    if taken_at is None and exif["taken_at"] is not None:
        taken_at = exif["taken_at"]
        hints["taken_at"] = "exif"
        hints["time_assumed_utc"] = True
    elif taken_at is not None:
        hints["taken_at"] = "typed"
    if latitude is None and longitude is None and exif["latitude"] is not None and exif["longitude"] is not None:
        latitude = exif["latitude"]
        longitude = exif["longitude"]
        hints["location"] = "exif"
    elif latitude is not None and longitude is not None:
        hints["location"] = "typed"

    pixels, resized = load_photo(path)
    key = f"uploads/{uuid.uuid4().hex}"
    plain = OUTPUT / f"{key}.png"
    labeled = OUTPUT / f"{key}_labeled.png"
    shown = display_gray(pixels)
    save_gray_png(shown, plain)
    detections = detect_stars(pixels, limit=160)
    try:
        solved = solve_image(pixels, bright_stars(conn, mag_limit=5.6))
    except RuntimeError as exc:
        draw_labels(shown, [], labeled)
        if max(pixels.shape) >= 200:
            save_gray_png(pixels, OUTPUT / f"{key}_sensor.png")
        return {
            "ok": False,
            "error": str(exc),
            "image_key": f"{key}.png",
            "labeled_key": f"{key}_labeled.png",
            "width": int(pixels.shape[1]),
            "height": int(pixels.shape[0]),
            "resized": resized,
            "detections": len(detections),
            "solve": None,
            "taken_at": taken_at,
            "latitude": latitude,
            "longitude": longitude,
            "hints": hints,
            "identifications": [],
        }

    capture_id = store_solved_capture(
        conn,
        solved,
        f"{key}.png",
        taken_at,
        latitude,
        longitude,
        elevation_m,
        exposure_seconds,
    )
    rows = identify_capture(
        conn,
        capture_id,
        pixels,
        solved,
        taken_at,
        latitude,
        longitude,
        elevation_m,
        exposure_seconds,
        mag_limit=8.0,
    )
    draw_labels(shown, label_marks(rows), labeled)
    view = capture_view(conn, capture_id)
    view.update(
        {
            "ok": True,
            "error": None,
            "resized": resized,
            "detections": len(detections),
            "hints": hints,
        }
    )
    return view


def demo_view(conn: psycopg.Connection) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            "select id from captures where image_key = %s order by id desc limit 1",
            (DEMO_KEY,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    view = capture_view(conn, int(row[0]))
    view["ok"] = True
    view["error"] = None
    view["resized"] = False
    view["hints"] = {"taken_at": "demo", "location": "demo", "time_assumed_utc": False}
    return view


def catalog_counts(conn: psycopg.Connection) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute("select count(*) from stars")
        stars = int(cur.fetchone()[0])
        cur.execute("select count(*) from satellites")
        satellites = int(cur.fetchone()[0])
    return {"stars": stars, "satellites": satellites}


def capture_view(conn: psycopg.Connection, capture_id: int) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            select c.image_key, c.taken_at, c.latitude, c.longitude, c.elevation_m, c.exposure_seconds,
                   p.center_ra_deg, p.center_dec_deg, p.pixel_scale_arcsec, p.rotation_deg
            from captures c
            left join plate_solutions p on p.capture_id = c.id
            where c.id = %s
            """,
            (capture_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise KeyError(capture_id)
        (
            image_key,
            taken_at,
            latitude,
            longitude,
            elevation_m,
            exposure_seconds,
            ra,
            dec,
            scale,
            rotation,
        ) = row
        cur.execute(
            """
            select i.object_type, i.catalog_id,
                   coalesce(s.name, sat.name),
                   s.mag, i.pixel_x, i.pixel_y, i.separation_arcsec, i.confidence
            from identifications i
            left join stars s on i.object_type = 'star' and s.catalog_id = i.catalog_id
            left join satellites sat on i.object_type = 'satellite' and sat.norad_id::text = i.catalog_id
            where i.capture_id = %s
            order by i.confidence desc nulls last, s.mag nulls last, i.catalog_id
            """,
            (capture_id,),
        )
        identifications = [
            {
                "object_type": object_type,
                "catalog_id": catalog_id,
                "name": display_name(object_type, catalog_id, name),
                "mag": mag,
                "pixel_x": pixel_x,
                "pixel_y": pixel_y,
                "separation_arcsec": separation,
                "confidence": confidence,
            }
            for object_type, catalog_id, name, mag, pixel_x, pixel_y, separation, confidence in cur.fetchall()
        ]
    image_file, labeled_file = _files_for(image_key)
    width, height = _png_size(OUTPUT / image_file)
    detections = 0
    if (OUTPUT / image_file).exists():
        detections = len(detect_stars(load_gray_png(OUTPUT / image_file), limit=160))
    solve = None
    if ra is not None:
        solve = {
            "center_ra_deg": ra,
            "center_dec_deg": dec,
            "pixel_scale_arcsec": scale,
            "rotation_deg": rotation,
        }
    return {
        "capture_id": capture_id,
        "image_key": image_file,
        "labeled_key": labeled_file,
        "width": width,
        "height": height,
        "detections": detections,
        "solve": solve,
        "taken_at": taken_at,
        "latitude": latitude,
        "longitude": longitude,
        "elevation_m": elevation_m,
        "exposure_seconds": exposure_seconds,
        "identifications": identifications,
    }


def _files_for(image_key: str) -> tuple[str, str]:
    if image_key == DEMO_KEY:
        return "orion.png", "orion_labeled.png"
    path = Path(image_key)
    return image_key, str(path.with_name(path.stem + "_labeled" + path.suffix))


def _png_size(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    with Image.open(path) as handle:
        return handle.size


def _parse_exif_time(raw) -> datetime | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _gps_degrees(value, ref) -> float | None:
    if not value or not ref:
        return None
    try:
        degrees, minutes, seconds = (float(part) for part in value)
    except (TypeError, ValueError):
        return None
    sign = -1.0 if str(ref).upper() in {"S", "W"} else 1.0
    return sign * (degrees + minutes / 60.0 + seconds / 3600.0)
