/**
 * Project catalog figures and alt/az targets into a phone camera frame.
 * Reuses the same FOV geometry as sky-fov (Layer 2 photo analysis).
 */

import { BRIGHT_SKY_CATALOG, localSiderealHours } from "./sky-context";
import type { PredictedFigure } from "./sky-fov";
import { buildFovPrediction } from "./sky-fov";
import type { CelestialEventKind, RankedCelestialEvent } from "./celestial-events";

const DEFAULT_FOV_DEG = 70;

export interface ScreenPoint {
  x: number;
  y: number;
  inFrame: boolean;
  offsetAzDeg: number;
  offsetElDeg: number;
}

export interface ProjectedEventMarker extends ScreenPoint {
  event: RankedCelestialEvent;
  /** Compass bearing from observer toward the event (deg, 0=N). */
  targetAzimuthDeg: number;
  targetAltitudeDeg: number;
  /** Degrees to turn left(−)/right(+) to face the target. */
  turnDeg: number;
}

function wrap360(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function deltaAzDegrees(objectAz: number, facing: number): number {
  return ((objectAz - facing + 540) % 360) - 180;
}

/** Horizontal FOV uses full value; vertical is 0.75× (matches sky-fov). */
export function projectAltAzToScreen(opts: {
  objectAlt: number;
  objectAz: number;
  facingAz: number;
  cameraElevation: number;
  fovDegrees?: number;
}): ScreenPoint {
  const fov = opts.fovDegrees ?? DEFAULT_FOV_DEG;
  const fovH = fov;
  const fovV = fov * 0.75;
  const offsetAz = deltaAzDegrees(opts.objectAz, opts.facingAz);
  const offsetEl = opts.objectAlt - opts.cameraElevation;
  const x = 0.5 + offsetAz / fovH;
  const y = 0.5 - offsetEl / fovV;
  const inFrame =
    opts.objectAlt > -5 &&
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
    offsetAzDeg: Math.round(offsetAz * 10) / 10,
    offsetElDeg: Math.round(offsetEl * 10) / 10,
  };
}

/** Great-circle initial bearing from A → B (degrees, 0=N). */
export function bearingDegrees(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return wrap360((Math.atan2(y, x) * 180) / Math.PI);
}

/** Rough altitude to aim for when an event only has a ground location. */
export function defaultAltitudeForKind(kind: CelestialEventKind): number {
  switch (kind) {
    case "iss_pass":
      return 55;
    case "meteor_shower":
      return 65;
    case "aurora_window":
      return 28;
    case "launch":
      return 22;
    case "solar_eclipse":
      return 35;
    case "lunar_eclipse":
    case "full_moon":
    case "supermoon":
      return 42;
    case "new_moon":
      return 55;
    case "planetary_conjunction":
      return 38;
    case "comet":
      return 40;
    default:
      return 40;
  }
}

/** Bright catalog figures with predicted screen coords for the live finder. */
export function projectCatalogToScreen(opts: {
  latitude: number;
  longitude: number;
  takenAt: string;
  facingAz: number;
  cameraElevation: number;
  fovDegrees?: number;
}): PredictedFigure[] {
  const prediction = buildFovPrediction({
    latitude: opts.latitude,
    longitude: opts.longitude,
    takenAt: opts.takenAt,
    facingDegrees: opts.facingAz,
    elevationDegrees: opts.cameraElevation,
    fovDegrees: opts.fovDegrees ?? DEFAULT_FOV_DEG,
  });
  return [...prediction.inFrame, ...prediction.outOfFrame].filter(
    (p) => p.predictedX != null && p.predictedY != null
  );
}

export function projectSkyToScreen(opts: {
  latitude: number;
  longitude: number;
  takenAt?: string;
  facingAz: number;
  cameraElevation: number;
  fovDegrees?: number;
  events?: RankedCelestialEvent[];
}): {
  figures: PredictedFigure[];
  events: ProjectedEventMarker[];
  localSiderealHours: number;
} {
  const takenAt = opts.takenAt ?? new Date().toISOString();
  const figures = projectCatalogToScreen({
    latitude: opts.latitude,
    longitude: opts.longitude,
    takenAt,
    facingAz: opts.facingAz,
    cameraElevation: opts.cameraElevation,
    fovDegrees: opts.fovDegrees,
  });

  const events: ProjectedEventMarker[] = [];
  for (const event of opts.events ?? []) {
    let targetAz: number;
    let targetAlt: number;

    if (event.kind === "aurora_window") {
      targetAz = 0;
      targetAlt = defaultAltitudeForKind(event.kind);
    } else if (event.location) {
      targetAz = bearingDegrees(
        opts.latitude,
        opts.longitude,
        event.location.lat,
        event.location.lon
      );
      targetAlt = defaultAltitudeForKind(event.kind);
    } else if (event.globalVisibility) {
      // Overhead / all-sky targets: park near zenith so looking up reveals them.
      targetAz = opts.facingAz;
      targetAlt = Math.max(55, defaultAltitudeForKind(event.kind));
    } else {
      continue;
    }

    const screen = projectAltAzToScreen({
      objectAlt: targetAlt,
      objectAz: targetAz,
      facingAz: opts.facingAz,
      cameraElevation: opts.cameraElevation,
      fovDegrees: opts.fovDegrees,
    });

    events.push({
      ...screen,
      event,
      targetAzimuthDeg: Math.round(targetAz * 10) / 10,
      targetAltitudeDeg: targetAlt,
      turnDeg: screen.offsetAzDeg,
    });
  }

  events.sort(
    (a, b) =>
      Math.hypot(a.offsetAzDeg, a.offsetElDeg) -
      Math.hypot(b.offsetAzDeg, b.offsetElDeg)
  );

  return {
    figures,
    events,
    localSiderealHours: localSiderealHours(takenAt, opts.longitude),
  };
}

/** Catalog size for UI copy (hackathon bright-sky set). */
export const SKY_FINDER_CATALOG_COUNT = BRIGHT_SKY_CATALOG.length;
