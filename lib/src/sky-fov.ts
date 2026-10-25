/**
 * Layer 2 analysis: predict which catalog figures fall inside the photo
 * given observer location, time, facing azimuth, and camera elevation.
 */

import type { SkyAnalysis, SkyCaptureMeta, SkyFigure } from "./sky-analysis";
import {
  BRIGHT_SKY_CATALOG,
  localSiderealHours,
  type SkyCatalogEntry,
} from "./sky-context";
import { normalizeStarName } from "./star-catalog";

const DEFAULT_ELEVATION_DEG = 40;
const DEFAULT_FOV_DEG = 70;

export interface PredictedFigure {
  name: string;
  kind: "constellation" | "asterism";
  altitudeDeg: number;
  azimuthDeg: number;
  /** Degrees left(−)/right(+) of facing. */
  offsetAzDeg: number;
  /** Degrees above(+)/below(−) camera elevation. */
  offsetElDeg: number;
  /** Predicted normalized image coords (0–1); null if outside frame. */
  predictedX: number | null;
  predictedY: number | null;
  inFrame: boolean;
  stars: string[];
  sizeDeg: number;
}

export interface FovPrediction {
  facingDegrees: number | null;
  elevationDegrees: number;
  fovDegrees: number;
  localSiderealHours: number;
  facingKnown: boolean;
  inFrame: PredictedFigure[];
  outOfFrame: PredictedFigure[];
  promptBlock: string;
}

export interface FovFigureCheck {
  figureName: string;
  status: "expected" | "unexpected" | "unknown";
  detail: string;
  predictedX: number | null;
  predictedY: number | null;
}

export interface FovCrossCheck {
  expectedDetected: string[];
  expectedMissing: string[];
  unexpected: string[];
  figureChecks: FovFigureCheck[];
  summary: string;
}

function wrap360(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function deltaAzDegrees(objectAz: number, facing: number): number {
  return ((objectAz - facing + 540) % 360) - 180;
}

function altitudeAzimuth(
  latDeg: number,
  lstHours: number,
  raHours: number,
  decDeg: number
): { alt: number; az: number } {
  const lat = (latDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  let ha = ((lstHours - raHours) * Math.PI) / 12;
  while (ha > Math.PI) ha -= 2 * Math.PI;
  while (ha < -Math.PI) ha += 2 * Math.PI;
  const sinAlt =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = (Math.asin(Math.min(1, Math.max(-1, sinAlt))) * 180) / Math.PI;
  const cosAz =
    (Math.sin(dec) - Math.sin(lat) * sinAlt) /
    (Math.cos(lat) * Math.cos((alt * Math.PI) / 180) || 1e-9);
  let az = (Math.acos(Math.min(1, Math.max(-1, cosAz))) * 180) / Math.PI;
  if (Math.sin(ha) > 0) az = 360 - az;
  return { alt, az: wrap360(az) };
}

function projectToImage(
  offsetAz: number,
  offsetEl: number,
  fovH: number,
  fovV: number
): { x: number; y: number; inFrame: boolean } {
  const x = 0.5 + offsetAz / fovH;
  const y = 0.5 - offsetEl / fovV;
  const inFrame =
    Math.abs(offsetAz) <= fovH * 0.55 &&
    Math.abs(offsetEl) <= fovV * 0.55 &&
    x >= -0.05 &&
    x <= 1.05 &&
    y >= -0.05 &&
    y <= 1.05;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    inFrame,
  };
}

function predictOne(
  entry: SkyCatalogEntry,
  lat: number,
  lst: number,
  facing: number | null,
  elevation: number,
  fovH: number,
  fovV: number
): PredictedFigure {
  const { alt, az } = altitudeAzimuth(
    lat,
    lst,
    entry.raHours,
    entry.decDeg
  );
  const offsetAz = facing == null ? 0 : deltaAzDegrees(az, facing);
  const offsetEl = alt - elevation;
  const facingKnown = facing != null;

  let predictedX: number | null = null;
  let predictedY: number | null = null;
  let inFrame = alt > 2;

  if (facingKnown) {
    const proj = projectToImage(offsetAz, offsetEl, fovH, fovV);
    predictedX = proj.x;
    predictedY = proj.y;
    inFrame = alt > 2 && proj.inFrame;
  } else {
    // Without facing, anything above horizon is "possibly in frame"
    inFrame = alt > 8;
  }

  return {
    name: entry.name,
    kind: entry.kind,
    altitudeDeg: Math.round(alt * 10) / 10,
    azimuthDeg: Math.round(az * 10) / 10,
    offsetAzDeg: Math.round(offsetAz * 10) / 10,
    offsetElDeg: Math.round(offsetEl * 10) / 10,
    predictedX,
    predictedY,
    inFrame,
    stars: entry.stars,
    sizeDeg: entry.sizeDeg,
  };
}

/** Predict which bright figures sit in the photo FOV from location + angle. */
export function buildFovPrediction(meta: SkyCaptureMeta): FovPrediction {
  const lst = localSiderealHours(meta.takenAt, meta.longitude);
  const facing =
    meta.facingDegrees !== undefined && Number.isFinite(meta.facingDegrees)
      ? wrap360(meta.facingDegrees)
      : null;
  const elevation =
    meta.elevationDegrees !== undefined &&
    Number.isFinite(meta.elevationDegrees)
      ? meta.elevationDegrees
      : DEFAULT_ELEVATION_DEG;
  const fov =
    meta.fovDegrees !== undefined && Number.isFinite(meta.fovDegrees)
      ? meta.fovDegrees
      : DEFAULT_FOV_DEG;
  const fovH = fov;
  const fovV = fov * 0.75;

  const all = BRIGHT_SKY_CATALOG.map((e) =>
    predictOne(e, meta.latitude, lst, facing, elevation, fovH, fovV)
  );

  const inFrame = all
    .filter((p) => p.inFrame)
    .sort(
      (a, b) =>
        Math.hypot(a.offsetAzDeg, a.offsetElDeg) -
        Math.hypot(b.offsetAzDeg, b.offsetElDeg)
    );
  const outOfFrame = all
    .filter((p) => !p.inFrame && p.altitudeDeg > 0)
    .sort((a, b) => b.altitudeDeg - a.altitudeDeg)
    .slice(0, 8);

  const facingLine =
    facing != null
      ? `Camera facing ${facing.toFixed(0)}° (0=N, 90=E), elevation ~${elevation.toFixed(0)}° above horizon, FOV ~${fov.toFixed(0)}°.`
      : `Facing unknown — assumed elevation ~${elevation.toFixed(0)}°, FOV ~${fov.toFixed(0)}°. Enter facing for a tighter angle layer.`;

  const inLines = inFrame.map((p) => {
    const pos =
      p.predictedX != null && p.predictedY != null
        ? ` predicted image ~(${p.predictedX.toFixed(2)}, ${p.predictedY.toFixed(2)})`
        : "";
    return `- ${p.name}: alt ${p.altitudeDeg}°, az ${p.azimuthDeg}°, Δaz ${p.offsetAzDeg}°, Δel ${p.offsetElDeg}°${pos}; stars ${p.stars.join(", ")}`;
  });

  const outLines = outOfFrame.slice(0, 5).map(
    (p) =>
      `- ${p.name}: above horizon but outside this FOV (alt ${p.altitudeDeg}°, Δaz ${p.offsetAzDeg}°) — do NOT force it into the photo`
  );

  const promptBlock = `LAYER 2 — LOCATION + ANGLE FOV PREDICTION:
${facingLine}
Observer lat ${meta.latitude.toFixed(4)}, lon ${meta.longitude.toFixed(4)}${
    meta.locationLabel ? ` (${meta.locationLabel})` : ""
  }; time ${meta.takenAt}; LST≈${lst.toFixed(2)}h.

Expected IN FRAME (search these regions first; place labels near predicted coords when the pattern matches):
${inLines.length ? inLines.join("\n") : "- (none strongly in FOV — still mark what you see)"}

Above horizon but OUT of predicted FOV (omit unless clearly visible despite the angle prior):
${outLines.length ? outLines.join("\n") : "- none listed"}

Angle rule: prefer figures whose predicted (x,y) matches where you see the pattern. If facing is set, do not invent out-of-FOV constellations.`;

  return {
    facingDegrees: facing,
    elevationDegrees: elevation,
    fovDegrees: fov,
    localSiderealHours: lst,
    facingKnown: facing != null,
    inFrame,
    outOfFrame,
    promptBlock,
  };
}

/** Cross-check verified figures against the FOV prediction layer. */
export function crossCheckWithFov(
  analysis: SkyAnalysis,
  prediction: FovPrediction
): FovCrossCheck {
  const expected = new Map(
    prediction.inFrame.map((p) => [normalizeStarName(p.name), p] as const)
  );
  const outMap = new Map(
    prediction.outOfFrame.map((p) => [normalizeStarName(p.name), p] as const)
  );

  const detectedKeys = new Set<string>();
  const figureChecks: FovFigureCheck[] = [];
  const unexpected: string[] = [];
  const expectedDetected: string[] = [];

  const realFigures: SkyFigure[] = analysis.figures.filter(
    (f) => f.id !== "none-confident" && f.stars.length > 0
  );

  for (const fig of realFigures) {
    const key = normalizeStarName(fig.name);
    detectedKeys.add(key);
    const pred = expected.get(key);
    const out = outMap.get(key);

    if (pred) {
      expectedDetected.push(fig.name);
      const dx =
        pred.predictedX != null
          ? Math.abs(pred.predictedX - fig.labelX)
          : null;
      const dy =
        pred.predictedY != null
          ? Math.abs(pred.predictedY - fig.labelY)
          : null;
      const near =
        dx != null && dy != null ? dx < 0.35 && dy < 0.35 : null;
      figureChecks.push({
        figureName: fig.name,
        status: "expected",
        detail:
          near === false
            ? `In FOV prior, but label is offset from predicted (~${pred.predictedX?.toFixed(2)}, ${pred.predictedY?.toFixed(2)}).`
            : `Matches FOV prior (alt ${pred.altitudeDeg}°, Δaz ${pred.offsetAzDeg}°).`,
        predictedX: pred.predictedX,
        predictedY: pred.predictedY,
      });
    } else if (out && prediction.facingKnown) {
      unexpected.push(fig.name);
      figureChecks.push({
        figureName: fig.name,
        status: "unexpected",
        detail: `Predicted outside FOV (Δaz ${out.offsetAzDeg}°) for this facing — treat cautiously.`,
        predictedX: out.predictedX,
        predictedY: out.predictedY,
      });
    } else {
      figureChecks.push({
        figureName: fig.name,
        status: "unknown",
        detail: prediction.facingKnown
          ? "Not in bright FOV catalog for this angle (may still be valid)."
          : "Facing unknown — FOV prior is weak.",
        predictedX: null,
        predictedY: null,
      });
    }
  }

  const expectedMissing = prediction.inFrame
    .filter((p) => !detectedKeys.has(normalizeStarName(p.name)))
    // Skip near-duplicates (Ursa Major vs Big Dipper)
    .filter((p) => {
      const k = normalizeStarName(p.name);
      if (k === "ursa major" && detectedKeys.has("big dipper")) return false;
      if (k === "big dipper" && detectedKeys.has("ursa major")) return false;
      if (k === "crux" && detectedKeys.has("southern cross")) return false;
      if (k === "southern cross" && detectedKeys.has("crux")) return false;
      return true;
    })
    .map((p) => p.name);

  const summary = prediction.facingKnown
    ? `Angle layer: ${expectedDetected.length} expected detected, ${expectedMissing.length} expected missing, ${unexpected.length} outside-FOV flags.`
    : `Angle layer (facing unknown): ${realFigures.length} figure(s) checked against horizon prior only.`;

  return {
    expectedDetected,
    expectedMissing,
    unexpected,
    figureChecks,
    summary,
  };
}
