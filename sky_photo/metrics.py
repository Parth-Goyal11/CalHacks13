"""OpenCV quality metrics on full-resolution grayscale frames."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class ImageMetrics:
    sharpness: float
    trailing: float
    clipped_pct: float
    crushed_pct: float
    noise_sigma: float
    star_count: int
    horizon_tilt_deg: float | None
    mean_brightness: float


def _ensure_gray(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        gray = image
    elif image.ndim == 3 and image.shape[2] >= 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        raise ValueError("Expected HxW or HxWx3 image array")
    if gray.dtype != np.uint8:
        gray = np.clip(gray, 0, 255).astype(np.uint8)
    return gray


def measure(image: np.ndarray) -> ImageMetrics:
    """Compute Sky Photo metrics on a grayscale (or RGB) full-res frame.

    Definitions (build brief):
    - sharpness = variance of Laplacian
    - trailing = median major/minor of up to 50 brightest star blobs; 1.0 is round
    - clipped_pct = share of pixels ≥ 250
    - crushed_pct = share of pixels ≤ 5 (reported alongside clipping)
    - noise_sigma = std of darkest 5% of 32×32 patches
    - star_count = blobs with area 2..200 px
    - horizon_tilt_deg = angle of strongest near-horizontal Hough line in lower
      third, or None
    """
    gray = _ensure_gray(image)
    h, w = gray.shape
    total = float(gray.size)

    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    clipped_pct = float(np.count_nonzero(gray >= 250)) * 100.0 / total
    crushed_pct = float(np.count_nonzero(gray <= 5)) * 100.0 / total
    mean_brightness = float(gray.mean())

    star_count, trailing = _star_blobs(gray)
    noise_sigma = _noise_sigma(gray)
    horizon_tilt_deg = _horizon_tilt(gray)

    return ImageMetrics(
        sharpness=sharpness,
        trailing=trailing,
        clipped_pct=clipped_pct,
        crushed_pct=crushed_pct,
        noise_sigma=noise_sigma,
        star_count=star_count,
        horizon_tilt_deg=horizon_tilt_deg,
        mean_brightness=mean_brightness,
    )


def is_night_sky(metrics: ImageMetrics) -> bool:
    """Early-exit guard: few stars + bright mean → not a night-sky photo."""
    if metrics.star_count < 15 and metrics.mean_brightness > 80:
        return False
    return True


def _star_blobs(gray: np.ndarray) -> tuple[int, float]:
    """Detect star-like blobs; return (count in area 2..200, trailing ratio)."""
    # Adaptive-ish threshold: pick bright outliers above local sky.
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Stars are local maxima well above median sky.
    sky = float(np.median(blur))
    thresh_val = min(250, max(int(sky + 25), int(sky * 1.5) + 10))
    _, mask = cv2.threshold(blur, thresh_val, 255, cv2.THRESH_BINARY)
    # Clean speckles
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask, connectivity=8
    )
    ratios: list[tuple[float, float]] = []  # (brightness, major/minor)
    count = 0
    for i in range(1, num_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < 2 or area > 200:
            continue
        count += 1
        ys, xs = np.where(labels == i)
        if len(xs) < 5:
            # Too few pixels for a reliable ellipse; treat as round.
            brightness = float(gray[ys, xs].mean()) if len(xs) else 0.0
            ratios.append((brightness, 1.0))
            continue
        pts = np.column_stack([xs.astype(np.float32), ys.astype(np.float32)])
        (_cx, _cy), (axis_a, axis_b), _angle = cv2.minAreaRect(pts)
        major = max(axis_a, axis_b)
        minor = min(axis_a, axis_b)
        ratio = float(major / minor) if minor > 1e-3 else 1.0
        brightness = float(gray[ys, xs].mean())
        ratios.append((brightness, ratio))

    if not ratios:
        return count, 1.0

    ratios.sort(key=lambda t: t[0], reverse=True)
    top = ratios[:50]
    trailing = float(np.median([r for _, r in top]))
    return count, trailing


def _noise_sigma(gray: np.ndarray) -> float:
    """Std of the darkest 5% of non-overlapping 32×32 patches."""
    h, w = gray.shape
    patch = 32
    if h < patch or w < patch:
        return float(gray.std())

    means: list[float] = []
    patches: list[np.ndarray] = []
    for y in range(0, h - patch + 1, patch):
        for x in range(0, w - patch + 1, patch):
            p = gray[y : y + patch, x : x + patch]
            means.append(float(p.mean()))
            patches.append(p)

    if not patches:
        return float(gray.std())

    order = np.argsort(np.asarray(means))
    n_dark = max(1, int(len(order) * 0.05))
    dark = order[:n_dark]
    # Concatenate darkest patches and take std.
    stacked = np.concatenate([patches[i].ravel() for i in dark])
    return float(stacked.std())


def _horizon_tilt(gray: np.ndarray) -> float | None:
    """Angle (deg) of strongest near-horizontal Hough line in the lower third."""
    h, w = gray.shape
    y0 = (2 * h) // 3
    roi = gray[y0:, :]
    edges = cv2.Canny(roi, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180.0, threshold=max(40, w // 20))
    if lines is None:
        return None

    best = None
    best_score = -1.0
    for rho_theta in lines[:50]:
        rho, theta = rho_theta[0]
        # Horizontal lines have theta near 0 or pi (in OpenCV: theta is normal angle;
        # a horizontal line has theta ≈ π/2). Angle of the line from horizontal:
        line_angle_deg = float(theta * 180.0 / np.pi - 90.0)
        # Normalize to [-90, 90]
        while line_angle_deg > 90:
            line_angle_deg -= 180
        while line_angle_deg < -90:
            line_angle_deg += 180
        if abs(line_angle_deg) > 25:
            continue
        # Prefer stronger (lower |rho| spread isn't available); use proximity to
        # horizontal as score proxy — first near-horizontal wins via max votes order.
        score = 25.0 - abs(line_angle_deg)
        if score > best_score:
            best_score = score
            best = line_angle_deg

    return best
