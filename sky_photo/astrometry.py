"""Astrometry.net (nova) web API client: login → upload → poll → annotations."""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

API_BASE = "https://nova.astrometry.net/api"
POLL_INTERVAL_S = 5.0
POLL_TIMEOUT_S = 60.0
REFERER = "https://nova.astrometry.net/api/login"

# Rough constellation name set for splitting tags / objects_in_field.
CONSTELLATIONS = {
    "Andromeda", "Antlia", "Apus", "Aquarius", "Aquila", "Ara", "Aries",
    "Auriga", "Boötes", "Bootes", "Caelum", "Camelopardalis", "Cancer",
    "Canes Venatici", "Canis Major", "Canis Minor", "Capricornus", "Carina",
    "Cassiopeia", "Centaurus", "Cepheus", "Cetus", "Chamaeleon", "Circinus",
    "Columba", "Coma Berenices", "Corona Australis", "Corona Borealis",
    "Corvus", "Crater", "Crux", "Cygnus", "Delphinus", "Dorado", "Draco",
    "Equuleus", "Eridanus", "Fornax", "Gemini", "Grus", "Hercules",
    "Horologium", "Hydra", "Hydrus", "Indus", "Lacerta", "Leo", "Leo Minor",
    "Lepus", "Libra", "Lupus", "Lynx", "Lyra", "Mensa", "Microscopium",
    "Monoceros", "Musca", "Norma", "Octans", "Ophiuchus", "Orion", "Pavo",
    "Pegasus", "Perseus", "Phoenix", "Pictor", "Pisces", "Piscis Austrinus",
    "Puppis", "Pyxis", "Reticulum", "Sagitta", "Sagittarius", "Scorpius",
    "Sculptor", "Scutum", "Serpens", "Sextans", "Taurus", "Telescopium",
    "Triangulum", "Triangulum Australe", "Tucana", "Ursa Major", "Ursa Minor",
    "Vela", "Virgo", "Volans", "Vulpecula",
}

DEEP_SKY_PREFIXES = ("NGC", "IC", "M ", "Messier", "PGC", "UGC", "Barnard")
NAMED_STAR_HINTS = (
    # Common naked-eye names that may appear in tags
    "Sirius", "Canopus", "Arcturus", "Vega", "Capella", "Rigel", "Procyon",
    "Betelgeuse", "Achernar", "Hadar", "Altair", "Acrux", "Aldebaran",
    "Spica", "Antares", "Pollux", "Fomalhaut", "Deneb", "Regulus",
    "Bellatrix", "Alnilam", "Alnitak", "Mintaka", "Saiph", "Castor",
    "Polaris", "Dubhe", "Mirak", "Phecda", "Megrez", "Alioth", "Mizar",
)


class AstrometryError(Exception):
    """Base error for Astrometry.net client failures."""


class AstrometryAuthError(AstrometryError):
    pass


class AstrometryTimeout(AstrometryError):
    """Solve did not finish within POLL_TIMEOUT_S."""


@dataclass
class SolveHints:
    center_ra: float | None = None
    center_dec: float | None = None
    radius_deg: float | None = None
    scale_lower: float | None = None
    scale_upper: float | None = None
    scale_units: str = "degwidth"


@dataclass(frozen=True)
class AnnotationPoint:
    """Solver annotation with pixel coordinates in the uploaded image frame."""

    name: str
    pixel_x: float
    pixel_y: float
    kind: str  # named_star | deep_sky | constellation | other
    radius: float = 0.0


@dataclass
class SolveResult:
    solved: bool
    timed_out: bool = False
    job_id: int | None = None
    submission_id: int | None = None
    center_ra_deg: float | None = None
    center_dec_deg: float | None = None
    field_width_deg: float | None = None
    rotation_deg: float | None = None
    radius_deg: float | None = None
    pixscale_arcsec: float | None = None
    constellations: list[str] = field(default_factory=list)
    named_stars: list[str] = field(default_factory=list)
    deep_sky: list[str] = field(default_factory=list)
    other: list[str] = field(default_factory=list)
    annotation_points: list[AnnotationPoint] = field(default_factory=list)
    raw_info: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


def _api_key() -> str:
    key = os.environ.get("ASTROMETRY_API_KEY", "").strip()
    if not key:
        raise AstrometryAuthError(
            "ASTROMETRY_API_KEY is not set; cannot plate-solve"
        )
    return key


class AstrometryClient:
    """Thin httpx client for nova.astrometry.net."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = API_BASE,
        poll_interval_s: float = POLL_INTERVAL_S,
        poll_timeout_s: float = POLL_TIMEOUT_S,
        client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else _api_key()
        self.base_url = base_url.rstrip("/")
        self.poll_interval_s = poll_interval_s
        self.poll_timeout_s = poll_timeout_s
        self._client = client or httpx.Client(
            timeout=30.0,
            headers={"Referer": REFERER},
        )
        self._owns_client = client is None
        self._session: str | None = None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> AstrometryClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = self._client.post(
            url, data={"request-json": json.dumps(payload)}
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "error":
            raise AstrometryError(data.get("errormessage") or str(data))
        return data

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = self._client.get(url)
        resp.raise_for_status()
        return resp.json()

    def login(self) -> str:
        data = self._post_json("login", {"apikey": self.api_key})
        session = data.get("session")
        if not session:
            raise AstrometryAuthError(f"Login failed: {data}")
        self._session = session
        return session

    def upload(
        self,
        image_bytes: bytes,
        *,
        filename: str = "sky.jpg",
        hints: SolveHints | None = None,
    ) -> int:
        if not self._session:
            self.login()
        assert self._session is not None

        args: dict[str, Any] = {
            "session": self._session,
            "allow_commercial_use": "d",
            "allow_modifications": "d",
            "publicly_visible": "n",
        }
        if hints is not None:
            if hints.center_ra is not None and hints.center_dec is not None:
                args["center_ra"] = hints.center_ra
                args["center_dec"] = hints.center_dec
                args["radius"] = hints.radius_deg if hints.radius_deg is not None else 30.0
            if hints.scale_lower is not None and hints.scale_upper is not None:
                args["scale_units"] = hints.scale_units
                args["scale_type"] = "ul"
                args["scale_lower"] = hints.scale_lower
                args["scale_upper"] = hints.scale_upper

        files = {
            "request-json": (None, json.dumps(args), "text/plain"),
            "file": (filename, image_bytes, "application/octet-stream"),
        }
        url = f"{self.base_url}/upload"
        resp = self._client.post(url, files=files)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "error":
            raise AstrometryError(data.get("errormessage") or str(data))
        subid = data.get("subid")
        if subid is None:
            raise AstrometryError(f"Upload missing subid: {data}")
        return int(subid)

    def poll_until_solved(self, submission_id: int) -> int:
        """Poll submission/jobs until success. Returns job_id. Raises on timeout."""
        deadline = time.monotonic() + self.poll_timeout_s
        known_jobs: set[int] = set()
        while True:
            sub = self._get(f"submissions/{submission_id}")
            for job in sub.get("jobs") or []:
                if job is not None:
                    known_jobs.add(int(job))

            for job_id in sorted(known_jobs):
                status = self._get(f"jobs/{job_id}").get("status")
                if status == "success":
                    return job_id
                if status == "failure":
                    logger.info("Astrometry job %s failed", job_id)

            # All jobs finished with failure and processing done.
            if (
                sub.get("processing_finished")
                and known_jobs
                and all(
                    self._get(f"jobs/{j}").get("status") == "failure"
                    for j in known_jobs
                )
            ):
                raise AstrometryError(
                    f"All solve jobs failed for submission {submission_id}"
                )

            if time.monotonic() >= deadline:
                raise AstrometryTimeout(
                    f"No successful solve within {self.poll_timeout_s:.0f}s "
                    f"(submission {submission_id})"
                )
            time.sleep(self.poll_interval_s)

    def fetch_result(self, job_id: int) -> SolveResult:
        info = self._get(f"jobs/{job_id}/info/")
        annotations_payload = self._get(f"jobs/{job_id}/annotations/")
        calibration = info.get("calibration") or {}
        annotations = annotations_payload.get("annotations") or []
        objects = list(info.get("objects_in_field") or [])
        tags = list(info.get("machine_tags") or info.get("tags") or [])

        (
            constellations,
            named_stars,
            deep_sky,
            other,
            points,
        ) = split_annotations(
            annotations=annotations,
            objects_in_field=objects,
            tags=tags,
        )

        radius = calibration.get("radius")
        pixscale = calibration.get("pixscale")
        # field width ≈ 2 * radius when radius is half-diagonal-ish; use 2*radius.
        field_width = float(radius) * 2.0 if radius is not None else None

        return SolveResult(
            solved=True,
            job_id=job_id,
            center_ra_deg=_f(calibration.get("ra")),
            center_dec_deg=_f(calibration.get("dec")),
            field_width_deg=field_width,
            rotation_deg=_f(calibration.get("orientation")),
            radius_deg=_f(radius),
            pixscale_arcsec=_f(pixscale),
            constellations=constellations,
            named_stars=named_stars,
            deep_sky=deep_sky,
            other=other,
            annotation_points=points,
            raw_info=info,
        )

    def solve(
        self,
        image_bytes: bytes,
        *,
        filename: str = "sky.jpg",
        hints: SolveHints | None = None,
    ) -> SolveResult:
        """Full login → upload → poll → annotations pipeline."""
        try:
            self.login()
            subid = self.upload(image_bytes, filename=filename, hints=hints)
            job_id = self.poll_until_solved(subid)
            result = self.fetch_result(job_id)
            result.submission_id = subid
            return result
        except AstrometryTimeout as exc:
            return SolveResult(
                solved=False,
                timed_out=True,
                submission_id=locals().get("subid"),
                error=str(exc),
            )
        except AstrometryError as exc:
            return SolveResult(
                solved=False,
                timed_out=False,
                submission_id=locals().get("subid"),
                error=str(exc),
            )


def _f(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _classify_kind(name: str, ann_type: str = "") -> str:
    stripped = name.strip()
    if not stripped:
        return "other"
    if stripped in CONSTELLATIONS or stripped.title() in CONSTELLATIONS:
        return "constellation"
    upper = stripped.upper()
    at = ann_type.lower()
    if at in {"ngc", "ic", "m"}:
        return "deep_sky"
    if at in {"hd", "hip", "tycho", "tyc"}:
        return "named_star"
    if any(upper.startswith(p.upper()) for p in DEEP_SKY_PREFIXES):
        return "deep_sky"
    if upper.startswith("M") and not upper.startswith("MESSIER"):
        rest = upper[1:].lstrip()
        if rest[:1].isdigit():
            return "deep_sky"
    if stripped in NAMED_STAR_HINTS or any(
        stripped.startswith(n) for n in NAMED_STAR_HINTS
    ):
        return "named_star"
    if upper.startswith("HD ") or upper.startswith("HIP ") or upper.startswith("TYC"):
        return "named_star"
    return "other"


def split_annotations(
    *,
    annotations: list[dict[str, Any]],
    objects_in_field: list[str],
    tags: list[str],
) -> tuple[
    list[str], list[str], list[str], list[str], list[AnnotationPoint]
]:
    """Split solver labels into buckets + pixel-backed AnnotationPoints.

    Pixel points come only from annotations that include pixelx/pixely —
    never invented for tag-only names.
    """
    constellations: list[str] = []
    named_stars: list[str] = []
    deep_sky: list[str] = []
    other: list[str] = []
    points: list[AnnotationPoint] = []

    def add_unique(bucket: list[str], name: str) -> None:
        if name and name not in bucket:
            bucket.append(name)

    def add_name(name: str, kind: str) -> None:
        stripped = name.strip()
        if not stripped:
            return
        if kind == "constellation":
            label = stripped if stripped in CONSTELLATIONS else stripped.title()
            add_unique(constellations, label)
        elif kind == "named_star":
            add_unique(named_stars, stripped)
        elif kind == "deep_sky":
            add_unique(deep_sky, stripped)
        else:
            add_unique(other, stripped)

    for ann in annotations:
        names = ann.get("names") or []
        ann_type = (ann.get("type") or "").lower()
        px = _f(ann.get("pixelx"))
        py = _f(ann.get("pixely"))
        radius = _f(ann.get("radius")) or 0.0
        for name in names:
            kind = _classify_kind(name, ann_type)
            add_name(name, kind)
            if px is not None and py is not None:
                points.append(
                    AnnotationPoint(
                        name=name.strip(),
                        pixel_x=px,
                        pixel_y=py,
                        kind=kind,
                        radius=radius,
                    )
                )

    for name in objects_in_field + tags:
        add_name(name, _classify_kind(name))

    return constellations, named_stars, deep_sky, other, points


def solve_image(
    image_bytes: bytes,
    *,
    hints: SolveHints | None = None,
    filename: str = "sky.jpg",
) -> SolveResult:
    """Convenience wrapper using ASTROMETRY_API_KEY from the environment."""
    with AstrometryClient() as client:
        return client.solve(image_bytes, filename=filename, hints=hints)
