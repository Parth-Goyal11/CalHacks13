"""Render a synthetic star field and find its peaks."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from nightsky.wcs import WCS, sky_to_pixel


def render_starfield(stars, wcs: WCS) -> np.ndarray:
    """Draw catalog stars as Gaussians. Peak brightness follows magnitude."""
    image = np.zeros((wcs.height, wcs.width), dtype=np.float32)
    height, width = image.shape
    for star in stars:
        x, y = sky_to_pixel(star.ra_deg, star.dec_deg, wcs)
        if x < -4 or y < -4 or x >= width + 4 or y >= height + 4:
            continue
        # Cap the peak so a bright star stays a single pixel maximum after PNG clipping.
        peak = min(180.0, 400.0 * 10 ** (-0.4 * (star.mag - 1.0)))
        if peak < 3:
            continue
        _stamp_gaussian(image, x, y, peak, sigma=1.35)
    return image


def _stamp_gaussian(image: np.ndarray, x: float, y: float, peak: float, sigma: float) -> None:
    radius = 4
    height, width = image.shape
    x0 = max(0, int(math_floor(x) - radius))
    x1 = min(width, int(math_floor(x) + radius + 1))
    y0 = max(0, int(math_floor(y) - radius))
    y1 = min(height, int(math_floor(y) + radius + 1))
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    stamp = peak * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma * sigma))
    image[y0:y1, x0:x1] += stamp.astype(np.float32)


def math_floor(value: float) -> int:
    return int(np.floor(value))


def display_gray(image: np.ndarray) -> np.ndarray:
    """Remove sky glow so the background goes dark and each star stands out.

    Solving still uses the original pixels. This is only the picture on screen.
    """
    gray = image.astype(np.float32)
    residual = gray - _box_mean(_box_mean(gray, 36), 36)
    sample = residual[::6, ::6]
    middle = float(np.median(sample))
    sigma = float(1.4826 * np.median(np.abs(sample - middle)))
    clean = np.clip(residual - middle - 3.0 * max(sigma, 0.0), 0, None)
    hi = float(np.percentile(clean, 99.9))
    if hi < 1:
        hi = float(clean.max())
    if hi < 1:
        return np.zeros_like(gray)
    scaled = np.clip(clean / hi, 0, 1)
    return (np.power(scaled, 0.55) * 255.0).astype(np.float32)


def save_gray_png(image: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(image, 0, 255).astype(np.uint8)
    Image.fromarray(clipped, mode="L").save(path)


def load_gray_png(path: Path) -> np.ndarray:
    with Image.open(path) as handle:
        return np.asarray(handle.convert("L"), dtype=np.float32)


def _box_mean(image: np.ndarray, radius: int) -> np.ndarray:
    radius = max(1, int(radius))
    padded = np.pad(image, radius, mode="edge")
    integral = np.pad(padded, ((1, 0), (1, 0)), mode="constant")
    integral = np.cumsum(np.cumsum(integral, axis=0), axis=1)
    height, width = image.shape
    y0 = np.arange(height)
    x0 = np.arange(width)
    y1 = y0 + 2 * radius + 1
    x1 = x0 + 2 * radius + 1
    total = (
        integral[np.ix_(y1, x1)]
        - integral[np.ix_(y0, x1)]
        - integral[np.ix_(y1, x0)]
        + integral[np.ix_(y0, x0)]
    )
    return total / float((2 * radius + 1) ** 2)


def detect_stars(image: np.ndarray, limit: int = 80, min_peak: float = 14.0):
    """Compact peaks above the local sky. Streetlights and windows are left out."""
    residual = image.astype(np.float32) - _box_mean(image.astype(np.float32), 31)
    height, width = residual.shape
    padded = np.pad(residual, 1, mode="constant")
    center = padded[1:-1, 1:-1]
    is_max = np.ones((height, width), dtype=bool)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            is_max &= center > padded[1 + dy : 1 + dy + height, 1 + dx : 1 + dx + width]
    ys, xs = np.nonzero(is_max & (residual >= min_peak))
    found = []
    clipped = np.clip(residual, 0, None)
    for y, x in zip(ys.tolist(), xs.tolist()):
        peak = float(residual[y, x])
        wide = residual[max(0, y - 6) : y + 7, max(0, x - 6) : x + 7]
        core = residual[max(0, y - 1) : y + 2, max(0, x - 1) : x + 2]
        wide_sum = float(np.clip(wide, 0, None).sum())
        core_sum = float(np.clip(core, 0, None).sum())
        hot = int((wide > 0.5 * peak).sum())
        if wide_sum <= 0 or core_sum / wide_sum < 0.42 or hot > 9:
            continue
        found.append((peak, *_centroid(clipped, int(x), int(y))))
    for x, y, count, _blob_peak in _saturated_centers(image):
        if not 2 <= count <= 30:
            continue
        yi, xi = int(round(y)), int(round(x))
        if yi < 0 or xi < 0 or yi >= height or xi >= width:
            continue
        peak = float(residual[yi, xi])
        if peak < min_peak:
            continue
        wide = residual[max(0, yi - 6) : yi + 7, max(0, xi - 6) : xi + 7]
        core = residual[max(0, yi - 1) : yi + 2, max(0, xi - 1) : xi + 2]
        wide_sum = float(np.clip(wide, 0, None).sum())
        core_sum = float(np.clip(core, 0, None).sum())
        # A burned-out star stays compact. A streetlight's light is spread out.
        if wide_sum <= 0 or core_sum / wide_sum < 0.30:
            continue
        found = [item for item in found if (item[1] - x) ** 2 + (item[2] - y) ** 2 >= 36]
        found.append((peak, x, y))
    found.sort(reverse=True)
    return [(x, y, peak) for peak, x, y in found[:limit]]


def _saturated_centers(image: np.ndarray, level: float = 245.0):
    """Center of each small saturated core. A flat disk has no single brightest pixel."""
    ys, xs = np.nonzero(image >= level)
    if len(xs) == 0:
        return []
    points = set(zip(ys.tolist(), xs.tolist()))
    seen: set[tuple[int, int]] = set()
    centers = []
    for seed in points:
        if seed in seen:
            continue
        stack = [seed]
        seen.add(seed)
        blob = []
        while stack:
            y, x = stack.pop()
            blob.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nxt = (y + dy, x + dx)
                    if nxt in points and nxt not in seen:
                        seen.add(nxt)
                        stack.append(nxt)
        yy = np.array([point[0] for point in blob])
        xx = np.array([point[1] for point in blob])
        weight = image[yy, xx].astype(np.float64)
        total = float(weight.sum())
        if total <= 0:
            continue
        centers.append((float((xx * weight).sum() / total), float((yy * weight).sum() / total), len(blob), float(weight.max())))
    return centers


def detect_sources(image: np.ndarray, threshold: float = 8.0, limit: int = 20):
    """Return the brightest local maxima as (x, y, flux), brightest first."""
    height, width = image.shape
    padded = np.pad(image, 1, mode="constant")
    center = padded[1:-1, 1:-1]
    is_max = np.ones((height, width), dtype=bool)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            is_max &= center > padded[1 + dy : 1 + dy + height, 1 + dx : 1 + dx + width]
    ys, xs = np.nonzero(is_max & (center >= threshold))
    if len(xs) == 0:
        return []
    fluxes = center[ys, xs]
    order = np.argsort(fluxes)[::-1][:limit]
    found = []
    for index in order:
        x_i = int(xs[index])
        y_i = int(ys[index])
        found.append((*_centroid(image, x_i, y_i), float(fluxes[index])))
    return found


def _centroid(image: np.ndarray, x: int, y: int, radius: int = 2) -> tuple[float, float]:
    height, width = image.shape
    x0, x1 = max(0, x - radius), min(width, x + radius + 1)
    y0, y1 = max(0, y - radius), min(height, y + radius + 1)
    patch = image[y0:y1, x0:x1]
    total = float(patch.sum())
    if total <= 0:
        return float(x), float(y)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    return float((xx * patch).sum() / total), float((yy * patch).sum() / total)


def draw_labels(
    gray: np.ndarray,
    labels: list[tuple[float, float, str]],
    path: Path,
    color: tuple[int, int, int] = (255, 220, 80),
) -> None:
    rgb = np.stack([gray, gray, gray], axis=-1)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    image = Image.fromarray(rgb, mode="RGB")
    draw = ImageDraw.Draw(image)
    font = _label_font()
    for x, y, text in labels:
        radius = 8
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=2)
        if text:
            draw.text((x + 10, y - 8), text, fill=(255, 255, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def _label_font():
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, 15)
    return ImageFont.load_default()
