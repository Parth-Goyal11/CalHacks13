"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type AttitudeSource = "device" | "manual" | "unavailable";

export interface SkyAttitude {
  /** Compass heading of the rear camera, degrees 0=N, 90=E. */
  azimuthDeg: number;
  /** Degrees above horizon the camera is aimed (negative = below). */
  elevationDeg: number;
  source: AttitudeSource;
  /** True after iOS permission grant or when listening on non-iOS. */
  permission: "unknown" | "granted" | "denied" | "unsupported";
  /** Absolute compass available (webkitCompassHeading or absolute alpha). */
  absolute: boolean;
  setManualAzimuth: (deg: number) => void;
  setManualElevation: (deg: number) => void;
  requestPermission: () => Promise<boolean>;
}

type Doe = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  absolute?: boolean;
};

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function getOrientationSupport() {
  const constructor = window.DeviceOrientationEvent as OrientationConstructor | undefined;
  if (!constructor) return "unsupported";
  return typeof constructor.requestPermission === "function" ? "gesture" : "automatic";
}

function subscribeToSupport() {
  // API availability does not change during a page session.
  return () => {};
}

function wrap360(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Convert DeviceOrientation to rear-camera sky attitude (portrait phone).
 * Elevation: upright ≈ horizon (0°); tilt top away ≈ look up.
 */
function attitudeFromOrientation(event: Doe): {
  azimuth: number;
  elevation: number;
  absolute: boolean;
} | null {
  const beta = event.beta;
  const alpha = event.alpha;
  if (beta == null || alpha == null || !Number.isFinite(beta) || !Number.isFinite(alpha)) return null;

  const compass = event.webkitCompassHeading;
  const absolute =
    typeof compass === "number" && Number.isFinite(compass)
      ? true
      : Boolean(event.absolute);

  let azimuth: number;
  if (typeof compass === "number" && Number.isFinite(compass)) {
    azimuth = wrap360(compass);
  } else {
    // alpha is CW from device default; invert for compass-style heading.
    azimuth = wrap360(360 - alpha);
  }

  // Portrait, rear camera: beta 90 → horizon; beta 180 → zenith.
  let elevation = beta - 90;
  if (elevation > 95) elevation -= 180;
  elevation = clamp(elevation, -90, 90);

  return { azimuth, elevation, absolute };
}

export function useDeviceSkyAttitude(
  enabled: boolean,
  initialAzimuth = 0,
  initialElevation = 35
): SkyAttitude {
  const [azimuthDeg, setAzimuthDeg] = useState(initialAzimuth);
  const [elevationDeg, setElevationDeg] = useState(initialElevation);
  const [source, setSource] = useState<AttitudeSource | null>(null);
  const [permissionResult, setPermission] = useState<SkyAttitude["permission"] | null>(null);
  const support = useSyncExternalStore(subscribeToSupport, getOrientationSupport, () => "unknown");
  const permission = support === "unsupported" ? "unsupported" : permissionResult ?? (support === "automatic" ? "granted" : "unknown");
  const [absolute, setAbsolute] = useState(false);
  const manualRef = useRef(false);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ az: number; el: number; abs: boolean } | null>(
    null
  );

  const setManualAzimuth = useCallback((deg: number) => {
    manualRef.current = true;
    setAzimuthDeg(wrap360(deg));
    setSource("manual");
  }, []);

  const setManualElevation = useCallback((deg: number) => {
    manualRef.current = true;
    setElevationDeg(clamp(deg, -20, 90));
    setSource("manual");
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const DOE = window.DeviceOrientationEvent as OrientationConstructor | undefined;
    if (!DOE) {
      setPermission("unsupported");
      setSource("unavailable");
      return false;
    }
    try {
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setPermission("denied");
          setSource("manual");
          return false;
        }
      }
      setPermission("granted");
      manualRef.current = false;
      return true;
    } catch {
      setPermission("denied");
      setSource("manual");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    const flush = () => {
      rafRef.current = 0;
      const pending = pendingRef.current;
      if (!pending || manualRef.current) return;
      setAzimuthDeg(pending.az);
      setElevationDeg(pending.el);
      setAbsolute(pending.abs);
      setSource("device");
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (manualRef.current) return;
      const next = attitudeFromOrientation(event as Doe);
      if (!next) return;
      pendingRef.current = {
        az: next.azimuth,
        el: next.elevation,
        abs: next.absolute,
      };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };

    window.addEventListener("deviceorientation", onOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      pendingRef.current = null;
    };
  }, [enabled, permission]);

  return {
    azimuthDeg,
    elevationDeg,
    source: source ?? (support === "unsupported" ? "unavailable" : "manual"),
    permission,
    absolute,
    setManualAzimuth,
    setManualElevation,
    requestPermission,
  };
}
