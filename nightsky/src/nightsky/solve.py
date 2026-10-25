"""Blind plate solver.

The first pass matches the brightest points to catalog stars of magnitude
3.5 and brighter. If that pattern is not in the photo, a second pass tries
tighter triangles down to magnitude 5 and keeps the sky only when every
strong guess agrees. A weak or split vote names nothing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from nightsky.imageutil import detect_sources, detect_stars
from nightsky.wcs import (
    WCS,
    angular_separation_deg,
    pixel_to_sky,
    sky_position_angle,
    sky_to_pixel,
)


@dataclass(frozen=True)
class Star:
    catalog_id: str
    name: str | None
    ra_deg: float
    dec_deg: float
    mag: float


@dataclass
class _Tri:
    ratio_m: float
    ratio_s: float
    chirality: int
    ordered: tuple
    long_deg: float


_INDEXES: dict[tuple[str, ...], dict] = {}
_FAINT_INDEXES: dict[tuple[str, ...], dict] = {}


def solve_image(image, stars: list[Star]) -> WCS:
    height, width = image.shape
    detections = detect_stars(image, limit=80)
    if len(detections) < 4:
        detections = detect_sources(image, threshold=8.0, limit=12)
    if len(detections) < 4:
        raise RuntimeError(
            f"only {len(detections)} star-like points were found, so no star was named"
        )
    solvers = [star for star in stars if star.mag is not None and star.mag <= 3.5]
    voters = [star for star in stars if star.mag is not None and star.mag <= 4.5] or solvers
    solved = _solve_bright(image, detections, solvers, voters)
    if solved is None:
        faint = [star for star in stars if star.mag is not None and star.mag <= 5.0]
        faint_voters = [star for star in stars if star.mag is not None and star.mag <= 5.6] or faint
        if len(faint) > len(solvers):
            solved = _solve_faint(image, detections, faint, faint_voters)
    if solved is None:
        raise RuntimeError(
            f"Found {len(detections)} star-like points. No single patch of the catalog fits them, "
            "so no star was named."
        )
    return solved


def _solve_bright(image, detections, solvers: list[Star], voters: list[Star]) -> WCS | None:
    """Match the brightest points to stars of magnitude 3.5 and brighter."""
    height, width = image.shape
    index = _solver_index(solvers)
    if not index:
        return None
    ra = np.array([star.ra_deg for star in voters], dtype=float)
    dec = np.array([star.dec_deg for star in voters], dtype=float)
    detx = np.array([item[0] for item in detections[:80]], dtype=float)
    dety = np.array([item[1] for item in detections[:80]], dtype=float)
    best_hits = 0
    best_wcs = None
    for tri in _detection_triangles(detections[:8]):
        for candidate in _lookup(index, tri):
            sky_pix = [
                (star.ra_deg, star.dec_deg, pix[0], pix[1])
                for star, pix in zip(candidate.ordered, tri["ordered"])
            ]
            wcs = fit_wcs(sky_pix, width, height, polish=False)
            if wcs is None or not 15.0 <= wcs.scale_arcsec <= 800.0:
                continue
            hits = _vote_unique(wcs, ra, dec, detx, dety, width, height, tolerance=4.0)
            if hits > best_hits:
                best_hits = hits
                best_wcs = wcs
    if best_wcs is None or best_hits < 8 or best_wcs.scale_arcsec > 500:
        return None
    solved = _finish(best_wcs, voters, detections, width, height)
    if solved.scale_arcsec > 500:
        return None
    confirmed = _vote_unique(
        solved,
        ra,
        dec,
        detx,
        dety,
        width,
        height,
        tolerance=4.0,
    )
    if confirmed < 8:
        return None
    return solved


def _solve_faint(image, detections, solvers: list[Star], voters: list[Star]) -> WCS | None:
    """Match a tight asterism of stars down to magnitude 5.

    A zoomed photo often has no triangle of magnitude-3.5 stars. This pass
    accepts a solution only when every strong hypothesis lands on the same
    sky, so a chance alignment is still refused.
    """
    height, width = image.shape
    index = _faint_index(solvers)
    if not index or len(detections) < 4:
        return None
    ra = np.array([star.ra_deg for star in voters], dtype=float)
    dec = np.array([star.dec_deg for star in voters], dtype=float)
    sample = detections[:80]
    detx = np.array([item[0] for item in sample], dtype=float)
    dety = np.array([item[1] for item in sample], dtype=float)
    found: list[tuple[int, float, float, float, WCS]] = []
    for tri in _detection_triangles(detections[:8]):
        ordered = tri["ordered"]
        pix_long = max(math.hypot(ordered[0][0] - ordered[1][0], ordered[0][1] - ordered[1][1]), 1.0)
        for candidate in _lookup(index, tri):
            rough_scale = candidate.long_deg * 3600.0 / pix_long
            if not 15.0 <= rough_scale <= 180.0:
                continue
            sky_pix = [
                (star.ra_deg, star.dec_deg, pix[0], pix[1])
                for star, pix in zip(candidate.ordered, ordered)
            ]
            wcs = fit_wcs(sky_pix, width, height, polish=False)
            if wcs is None or not 15.0 <= wcs.scale_arcsec <= 180.0:
                continue
            hits = _vote_unique(wcs, ra, dec, detx, dety, width, height)
            if hits >= 7:
                found.append((hits, wcs.ra0, wcs.dec0, wcs.scale_arcsec, wcs))
    chosen = _consensus(found)
    if chosen is None:
        return None
    return _finish(chosen, voters, detections, width, height)


def _finish(wcs: WCS, voters: list[Star], detections, width: int, height: int) -> WCS:
    inliers = _inliers(wcs, voters, detections[:80], tolerance_px=4.5)
    polished = fit_wcs(inliers, width, height)
    if polished is None:
        return wcs
    return polished


def _consensus(found: list[tuple[int, float, float, float, WCS]]) -> WCS | None:
    """Keep the leading sky when no equally good hypothesis points somewhere else."""
    if not found:
        return None
    found.sort(key=lambda item: -item[0])
    best_hits, best_ra, best_dec, best_scale, best_wcs = found[0]
    if best_hits < 9:
        return None
    support = 0
    for hits, ra, dec, scale, _wcs in found:
        if hits < best_hits - 1:
            break
        same_scale = best_scale > 0 and abs(math.log(scale / best_scale)) <= math.log(1.15)
        same_sky = angular_separation_deg(ra, dec, best_ra, best_dec) <= 1.5 and same_scale
        if same_sky:
            support += 1
            continue
        if angular_separation_deg(ra, dec, best_ra, best_dec) > 2.5:
            return None
    if support < 2 and best_hits < 12:
        return None
    return best_wcs


def _solver_index(stars: list[Star]) -> dict:
    key = tuple(star.catalog_id for star in stars)
    cached = _INDEXES.get(key)
    if cached is None:
        cached = _catalog_triangles(stars, max_side_deg=40.0)
        _INDEXES[key] = cached
    return cached


def _faint_index(stars: list[Star]) -> dict:
    key = tuple(star.catalog_id for star in stars)
    cached = _FAINT_INDEXES.get(key)
    if cached is None:
        cached = _catalog_triangles(stars, max_side_deg=8.0)
        _FAINT_INDEXES[key] = cached
    return cached


def _vote(wcs: WCS, ra, dec, detx, dety, width: int, height: int, tolerance: float = 3.5) -> int:
    px, py = sky_to_pixel(ra, dec, wcs)
    inside = np.isfinite(px) & np.isfinite(py) & (px >= 0) & (py >= 0) & (px < width) & (py < height)
    if int(inside.sum()) < 8 or len(detx) == 0:
        return 0
    dx = px[inside, None] - detx[None, :]
    dy = py[inside, None] - dety[None, :]
    return int(np.any(dx * dx + dy * dy <= tolerance * tolerance, axis=1).sum())


def _vote_unique(wcs: WCS, ra, dec, detx, dety, width: int, height: int, tolerance: float = 4.5) -> int:
    """Count catalog stars that land on a detection, using each detection once."""
    px, py = sky_to_pixel(ra, dec, wcs)
    inside = np.isfinite(px) & np.isfinite(py) & (px >= 0) & (py >= 0) & (px < width) & (py < height)
    indexes = np.nonzero(inside)[0]
    if len(indexes) == 0 or len(detx) == 0:
        return 0
    distance = np.hypot(px[indexes, None] - detx[None, :], py[indexes, None] - dety[None, :])
    pairs = []
    for row, star_index in enumerate(indexes):
        detection = int(np.argmin(distance[row]))
        if distance[row, detection] <= tolerance:
            pairs.append((float(distance[row, detection]), int(star_index), detection))
    pairs.sort()
    used_stars: set[int] = set()
    used_detections: set[int] = set()
    hits = 0
    for _distance, star_index, detection in pairs:
        if star_index in used_stars or detection in used_detections:
            continue
        used_stars.add(star_index)
        used_detections.add(detection)
        hits += 1
    return hits


def fit_wcs(pairs, width: int, height: int, polish: bool = True) -> WCS | None:
    """Fit scale, rotation, and center so catalog positions land on pixels."""
    usable = [(ra, dec, x, y) for ra, dec, x, y in pairs]
    if len(usable) < 2:
        return None
    scales = []
    rotations = []
    for i, (ra1, dec1, x1, y1) in enumerate(usable):
        for ra2, dec2, x2, y2 in usable[i + 1 :]:
            pix = math.hypot(x2 - x1, y2 - y1)
            if pix < 8:
                continue
            ang = angular_separation_deg(ra1, dec1, ra2, dec2) * 3600.0
            if ang <= 0:
                continue
            scales.append(ang / pix)
            pa_sky = sky_position_angle(ra1, dec1, ra2, dec2)
            pa_pix = math.atan2(-(x2 - x1), -(y2 - y1))
            rotations.append(_wrap_pi(pa_sky - pa_pix))
    if not scales or not rotations:
        return None
    scale = _median(scales)
    rotation = math.degrees(_circular_mean(rotations))
    anchor = min(usable, key=lambda item: (item[2] - (width - 1) / 2) ** 2 + (item[3] - (height - 1) / 2) ** 2)
    center = _center_from_anchor(anchor, scale, rotation, width, height)
    if center is None:
        return None
    ra0, dec0 = center
    wcs = WCS(ra0, dec0, scale, rotation, width, height)
    if not polish:
        return wcs
    return _polish(wcs, usable)


def _center_from_anchor(anchor, scale, rotation_deg, width, height):
    ra_s, dec_s, x, y = anchor
    ra0, dec0 = ra_s, dec_s
    for _ in range(15):
        wcs = WCS(ra0, dec0, scale, rotation_deg, width, height)
        px, py = sky_to_pixel(ra_s, dec_s, wcs)
        ex, ey = px - x, py - y
        if ex * ex + ey * ey < 1e-4:
            return ra0 % 360.0, dec0
        eps = 1e-4
        px1, py1 = sky_to_pixel(ra_s, dec_s, WCS(ra0 + eps, dec0, scale, rotation_deg, width, height))
        px2, py2 = sky_to_pixel(ra_s, dec_s, WCS(ra0, dec0 + eps, scale, rotation_deg, width, height))
        j00 = (px1 - px) / eps
        j10 = (py1 - py) / eps
        j01 = (px2 - px) / eps
        j11 = (py2 - py) / eps
        det = j00 * j11 - j01 * j10
        if abs(det) < 1e-9:
            return None
        dra = (-ex * j11 + ey * j01) / det
        ddec = (-j00 * ey + j10 * ex) / det
        ra0 += dra
        dec0 += ddec
        if abs(dec0) > 89:
            return None
    return ra0 % 360.0, dec0


def _polish(wcs: WCS, pairs) -> WCS:
    current = wcs
    best = _rms(current, pairs)
    steps = (
        ("rotation_deg", 0.4),
        ("rotation_deg", 0.1),
        ("scale_arcsec", current.scale_arcsec * 0.004),
        ("ra0", 0.02),
        ("dec0", 0.02),
        ("ra0", 0.005),
        ("dec0", 0.005),
    )
    for name, step in steps:
        improved = True
        while improved:
            improved = False
            for sign in (1, -1):
                trial = _replace(current, name, getattr(current, name) + sign * step)
                if name == "ra0":
                    trial = _replace(trial, "ra0", trial.ra0 % 360.0)
                error = _rms(trial, pairs)
                if error + 1e-6 < best:
                    current = trial
                    best = error
                    improved = True
                    break
    return current


def _replace(wcs: WCS, name: str, value: float) -> WCS:
    data = wcs.as_dict()
    data[name] = value
    return WCS(
        ra0=data["ra0"],
        dec0=data["dec0"],
        scale_arcsec=data["scale_arcsec"],
        rotation_deg=data["rotation_deg"],
        width=wcs.width,
        height=wcs.height,
    )


def _rms(wcs: WCS, pairs) -> float:
    if not pairs:
        return 1e9
    total = 0.0
    for ra, dec, x, y in pairs:
        px, py = sky_to_pixel(ra, dec, wcs)
        total += (px - x) ** 2 + (py - y) ** 2
    return math.sqrt(total / len(pairs))


def _inliers(wcs: WCS, catalog: list[Star], detections, tolerance_px: float):
    pairs = []
    used = set()
    for star in catalog:
        px, py = sky_to_pixel(star.ra_deg, star.dec_deg, wcs)
        if px < 0 or py < 0 or px >= wcs.width or py >= wcs.height:
            continue
        best_i = None
        best_d = tolerance_px
        for i, (x, y, _flux) in enumerate(detections):
            if i in used:
                continue
            dist = math.hypot(px - x, py - y)
            if dist < best_d:
                best_d = dist
                best_i = i
        if best_i is not None:
            used.add(best_i)
            x, y, _flux = detections[best_i]
            pairs.append((star.ra_deg, star.dec_deg, x, y))
    return pairs


def _catalog_triangles(stars: list[Star], max_side_deg: float) -> dict:
    index: dict[tuple[int, int], list[_Tri]] = {}
    limited = stars
    for i, first in enumerate(limited):
        neighbors = []
        for second in limited[i + 1 :]:
            if angular_separation_deg(first.ra_deg, first.dec_deg, second.ra_deg, second.dec_deg) <= max_side_deg:
                neighbors.append(second)
        for j, second in enumerate(neighbors):
            for third in neighbors[j + 1 :]:
                if angular_separation_deg(second.ra_deg, second.dec_deg, third.ra_deg, third.dec_deg) > max_side_deg:
                    continue
                tri = _sky_triangle(first, second, third)
                if tri is None:
                    continue
                index.setdefault(_key(tri.ratio_m, tri.ratio_s), []).append(tri)
    return index


def _sky_triangle(a: Star, b: Star, c: Star) -> _Tri | None:
    def sep(p, q):
        return angular_separation_deg(p.ra_deg, p.dec_deg, q.ra_deg, q.dec_deg)

    ordered = _order_vertices(a, b, c, sep)
    if ordered is None:
        return None
    near, far, opposite, long, med, short = ordered
    if long < 0.4 or (long - med) / long < 0.015:
        return None
    return _Tri(med / long, short / long, _star_chirality(near, far, opposite), (near, far, opposite), long)


def _detection_triangles(detections):
    found = []
    for i, first in enumerate(detections):
        for j in range(i + 1, len(detections)):
            second = detections[j]
            for k in range(j + 1, len(detections)):
                third = detections[k]
                tri = _pixel_triangle(first, second, third)
                if tri is not None:
                    found.append(tri)
    return found


def _pixel_triangle(a, b, c):
    def sep(p, q):
        return math.hypot(p[0] - q[0], p[1] - q[1])

    ordered = _order_vertices(a, b, c, sep)
    if ordered is None:
        return None
    near, far, opposite, long, med, short = ordered
    if long < 12 or (long - med) / long < 0.015:
        return None
    chirality = _pixel_chirality(near, far, opposite)
    return {
        "ratio_m": med / long,
        "ratio_s": short / long,
        "chirality": chirality,
        "ordered": (near, far, opposite),
    }


def _order_vertices(a, b, c, sep):
    sides = [
        (sep(a, b), a, b, c),
        (sep(a, c), a, c, b),
        (sep(b, c), b, c, a),
    ]
    sides.sort(key=lambda item: -item[0])
    long, v1, v2, _opposite = sides[0]
    med_len, m1, m2, _ = sides[1]
    short = sides[2][0]
    med_ids = {id(m1), id(m2)}
    if id(v1) in med_ids and id(v2) not in med_ids:
        near, far = v1, v2
    elif id(v2) in med_ids and id(v1) not in med_ids:
        near, far = v2, v1
    else:
        return None
    opposite = m1 if id(m1) not in {id(v1), id(v2)} else m2
    return near, far, opposite, long, med_len, short


def _star_chirality(near: Star, far: Star, opposite: Star) -> int:
    # Local east/north of `far` and `opposite` as seen from `near`.
    pa_far = sky_position_angle(near.ra_deg, near.dec_deg, far.ra_deg, far.dec_deg)
    pa_opp = sky_position_angle(near.ra_deg, near.dec_deg, opposite.ra_deg, opposite.dec_deg)
    return 1 if math.sin(pa_far - pa_opp) >= 0 else -1


def _pixel_chirality(near, far, opposite) -> int:
    # rot=0 pixel position angle uses atan2(-dx, -dy), matching sky_position_angle.
    def pa(p, q):
        return math.atan2(-(q[0] - p[0]), -(q[1] - p[1]))

    return 1 if math.sin(pa(near, far) - pa(near, opposite)) >= 0 else -1


def _lookup(index: dict, tri: dict):
    hits = []
    base_m = int(round(tri["ratio_m"] * 100))
    base_s = int(round(tri["ratio_s"] * 100))
    for dm in range(-3, 4):
        for ds in range(-3, 4):
            for candidate in index.get((base_m + dm, base_s + ds), []):
                if candidate.chirality != tri["chirality"]:
                    continue
                if abs(candidate.ratio_m - tri["ratio_m"]) > 0.03:
                    continue
                if abs(candidate.ratio_s - tri["ratio_s"]) > 0.03:
                    continue
                hits.append(candidate)
    return hits


def _key(ratio_m: float, ratio_s: float) -> tuple[int, int]:
    return int(round(ratio_m * 100)), int(round(ratio_s * 100))


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return 0.5 * (ordered[mid - 1] + ordered[mid])


def _circular_mean(angles: list[float]) -> float:
    east = sum(math.sin(angle) for angle in angles)
    north = sum(math.cos(angle) for angle in angles)
    return math.atan2(east, north)


def _wrap_pi(angle: float) -> float:
    return (angle + math.pi) % (2 * math.pi) - math.pi


def center_of(wcs: WCS) -> tuple[float, float]:
    return pixel_to_sky(wcs.crpix_x, wcs.crpix_y, wcs)
