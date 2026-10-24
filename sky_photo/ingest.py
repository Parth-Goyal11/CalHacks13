"""Image ingest: decode, EXIF, privacy strip, model-size copy."""

from __future__ import annotations

import io
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np
from PIL import Image, ExifTags

# Register HEIC/HEIF when pillow-heif is available.
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:  # pragma: no cover - optional at import time
    pass

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
}

MODEL_MAX_EDGE = 2000

_TAG_NAME = {v: k for k, v in ExifTags.TAGS.items()}
_GPS_TAG_NAME = {v: k for k, v in ExifTags.GPSTAGS.items()}


@dataclass
class ExifSummary:
    datetime_original: str | None = None  # ISO-8601 UTC when parseable
    exposure_time: float | None = None
    iso: int | None = None
    focal_length_mm: float | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class IngestResult:
    """Decoded photo ready for solve + measure (GPS already stripped from pixels)."""

    full_rgb: np.ndarray  # HxWx3 uint8 RGB
    full_gray: np.ndarray  # HxW uint8
    model_jpeg_bytes: bytes  # ≤2000 px JPEG for vision (phase 3)
    model_rgb: np.ndarray
    exif: ExifSummary
    area_lat: float | None  # rounded to 0.1°
    area_lon: float | None
    content_type: str
    width: int
    height: int


class UnsupportedImageError(ValueError):
    pass


def _round_tenth(value: float) -> float:
    return round(value * 10) / 10


def _dms_to_deg(dms: tuple, ref: str) -> float:
    deg, minutes, seconds = (float(x) for x in dms)
    sign = -1.0 if ref in ("S", "W") else 1.0
    return sign * (deg + minutes / 60.0 + seconds / 3600.0)


def _parse_gps(gps_ifd: dict) -> tuple[float | None, float | None]:
    named = {_GPS_TAG_NAME.get(k, k): v for k, v in gps_ifd.items()}
    try:
        lat = _dms_to_deg(named["GPSLatitude"], named["GPSLatitudeRef"])
        lon = _dms_to_deg(named["GPSLongitude"], named["GPSLongitudeRef"])
        return lat, lon
    except (KeyError, TypeError, ValueError):
        return None, None


def _rational_to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if hasattr(value, "numerator") and hasattr(value, "denominator"):
            den = float(value.denominator)
            return float(value.numerator) / den if den else None
        if isinstance(value, tuple) and len(value) == 2:
            den = float(value[1])
            return float(value[0]) / den if den else None
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _parse_exif_datetime(raw: str | None) -> str | None:
    """Parse EXIF DateTimeOriginal ('YYYY:MM:DD HH:MM:SS') to ISO-8601 UTC string.

    EXIF has no reliable timezone; treat as UTC for evidence matching.
    """
    if not raw:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(raw.strip()[:19], fmt).replace(tzinfo=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
    return None


def read_exif(image: Image.Image) -> tuple[ExifSummary, float | None, float | None]:
    """Extract summary EXIF and GPS; GPS is returned separately (never stored raw)."""
    exif = ExifSummary()
    lat = lon = None
    try:
        raw = image.getexif()
    except Exception:
        return exif, None, None
    if not raw:
        return exif, None, None

    named: dict[str, Any] = {}
    for tag_id, value in raw.items():
        name = ExifTags.TAGS.get(tag_id, str(tag_id))
        named[name] = value

    # GPS IFD
    gps_ifd = None
    try:
        gps_ifd = raw.get_ifd(ExifTags.IFD.GPSInfo)
    except Exception:
        gps_info_id = _TAG_NAME.get("GPSInfo")
        if gps_info_id is not None and gps_info_id in raw:
            gps_ifd = raw.get(gps_info_id)

    if isinstance(gps_ifd, dict) and gps_ifd:
        lat, lon = _parse_gps(gps_ifd)

    dt_raw = named.get("DateTimeOriginal") or named.get("DateTime")
    if isinstance(dt_raw, bytes):
        dt_raw = dt_raw.decode("utf-8", errors="replace")
    if isinstance(dt_raw, str):
        exif.datetime_original = _parse_exif_datetime(dt_raw)
        exif.raw["DateTimeOriginal"] = dt_raw

    exif.exposure_time = _rational_to_float(named.get("ExposureTime"))
    iso = named.get("ISOSpeedRatings") or named.get("PhotographicSensitivity")
    if isinstance(iso, (tuple, list)) and iso:
        iso = iso[0]
    try:
        exif.iso = int(iso) if iso is not None else None
    except (TypeError, ValueError):
        exif.iso = None
    exif.focal_length_mm = _rational_to_float(named.get("FocalLength"))

    for key in ("ExposureTime", "ISOSpeedRatings", "PhotographicSensitivity", "FocalLength"):
        if key in named:
            exif.raw[key] = str(named[key])

    return exif, lat, lon


def _resize_max_edge(image: Image.Image, max_edge: int) -> Image.Image:
    w, h = image.size
    longest = max(w, h)
    if longest <= max_edge:
        return image.copy()
    scale = max_edge / float(longest)
    new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def ingest_image(data: bytes, content_type: str | None = None) -> IngestResult:
    """Decode bytes → full-res arrays + EXIF + ≤2000 px model JPEG.

    Raises UnsupportedImageError when the payload cannot be decoded as an image.
    """
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct and ct not in ALLOWED_CONTENT_TYPES and ct != "application/octet-stream":
        raise UnsupportedImageError(f"Unsupported media type: {ct}")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception as exc:
        raise UnsupportedImageError(f"Could not decode image: {exc}") from exc

    # Normalize orientation from EXIF before stripping metadata.
    try:
        from PIL import ImageOps

        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    exif, lat, lon = read_exif(image)
    rgb = image.convert("RGB")
    full_rgb = np.asarray(rgb, dtype=np.uint8)
    full_gray = np.asarray(rgb.convert("L"), dtype=np.uint8)

    model_img = _resize_max_edge(rgb, MODEL_MAX_EDGE)
    model_rgb = np.asarray(model_img, dtype=np.uint8)
    buf = io.BytesIO()
    # Re-save without EXIF → GPS stripped from model copy and any stored JPEG.
    model_img.save(buf, format="JPEG", quality=90, optimize=True)
    model_jpeg = buf.getvalue()

    area_lat = _round_tenth(lat) if lat is not None else None
    area_lon = _round_tenth(lon) if lon is not None else None

    return IngestResult(
        full_rgb=full_rgb,
        full_gray=full_gray,
        model_jpeg_bytes=model_jpeg,
        model_rgb=model_rgb,
        exif=exif,
        area_lat=area_lat,
        area_lon=area_lon,
        content_type=ct or "application/octet-stream",
        width=int(full_rgb.shape[1]),
        height=int(full_rgb.shape[0]),
    )


def zenith_radec(
    lat_deg: float, lon_deg: float, when: datetime
) -> tuple[float, float]:
    """Approximate zenith RA/Dec (degrees) at lat/lon and UTC time.

    Used as an Astrometry.net center hint when GPS + capture time exist.
    """
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    when = when.astimezone(timezone.utc)

    # Julian date
    year, month, day = when.year, when.month, when.day
    hour = (
        when.hour
        + when.minute / 60.0
        + when.second / 3600.0
        + when.microsecond / 3.6e9
    )
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    jd = (
        int(365.25 * (year + 4716))
        + int(30.6001 * (month + 1))
        + day
        + hour / 24.0
        + b
        - 1524.5
    )
    t = (jd - 2451545.0) / 36525.0
    gmst_deg = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * t * t
        - (t ** 3) / 38710000.0
    ) % 360.0
    lst_deg = (gmst_deg + lon_deg) % 360.0
    return lst_deg, lat_deg


def field_width_deg_from_focal_length(
    focal_length_mm: float, *, sensor_width_mm: float = 36.0
) -> float:
    """Estimate field of view (long edge) from focal length assuming full-frame width."""
    if focal_length_mm <= 0:
        raise ValueError("focal_length_mm must be positive")
    return math.degrees(2.0 * math.atan(sensor_width_mm / (2.0 * focal_length_mm)))


def parse_iso_time(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
