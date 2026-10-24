/**
 * Lightweight location/time sky prior for Grok: local sidereal time +
 * which bright constellations / named stars are likely above the horizon.
 * Not a plate solve — used only as a naming hint in the vision prompt.
 */

import type { SkyCaptureMeta } from "./sky-analysis";

export interface SkyCatalogEntry {
  name: string;
  kind: "constellation" | "asterism";
  /** Right ascension center, hours 0–24. */
  raHours: number;
  /** Declination center, degrees. */
  decDeg: number;
  /** Approximate angular size (degrees) for framing hints. */
  sizeDeg: number;
  stars: string[];
}

/** Naked-eye bright figures with classic stick-figure stars. */
export const BRIGHT_SKY_CATALOG: SkyCatalogEntry[] = [
  {
    name: "Orion",
    kind: "constellation",
    raHours: 5.6,
    decDeg: 0,
    sizeDeg: 20,
    stars: [
      "Betelgeuse",
      "Rigel",
      "Bellatrix",
      "Alnitak",
      "Alnilam",
      "Mintaka",
      "Saiph",
    ],
  },
  {
    name: "Canis Major",
    kind: "constellation",
    raHours: 6.7,
    decDeg: -20,
    sizeDeg: 18,
    stars: ["Sirius", "Mirzam", "Wezen", "Adhara"],
  },
  {
    name: "Taurus",
    kind: "constellation",
    raHours: 4.5,
    decDeg: 16,
    sizeDeg: 22,
    stars: ["Aldebaran", "Elnath"],
  },
  {
    name: "Pleiades",
    kind: "asterism",
    raHours: 3.78,
    decDeg: 24.1,
    sizeDeg: 2,
    stars: ["Alcyone", "Atlas", "Electra", "Maia", "Merope"],
  },
  {
    name: "Gemini",
    kind: "constellation",
    raHours: 7.3,
    decDeg: 22,
    sizeDeg: 20,
    stars: ["Castor", "Pollux", "Alhena"],
  },
  {
    name: "Leo",
    kind: "constellation",
    raHours: 10.7,
    decDeg: 16,
    sizeDeg: 22,
    stars: ["Regulus", "Denebola", "Algieba"],
  },
  {
    name: "Ursa Major",
    kind: "constellation",
    raHours: 11.3,
    decDeg: 55,
    sizeDeg: 25,
    stars: [
      "Dubhe",
      "Merak",
      "Phecda",
      "Megrez",
      "Alioth",
      "Mizar",
      "Alkaid",
    ],
  },
  {
    name: "Big Dipper",
    kind: "asterism",
    raHours: 11.5,
    decDeg: 55,
    sizeDeg: 20,
    stars: [
      "Dubhe",
      "Merak",
      "Phecda",
      "Megrez",
      "Alioth",
      "Mizar",
      "Alkaid",
    ],
  },
  {
    name: "Boötes",
    kind: "constellation",
    raHours: 14.5,
    decDeg: 30,
    sizeDeg: 18,
    stars: ["Arcturus"],
  },
  {
    name: "Virgo",
    kind: "constellation",
    raHours: 13.4,
    decDeg: -5,
    sizeDeg: 25,
    stars: ["Spica"],
  },
  {
    name: "Scorpius",
    kind: "constellation",
    raHours: 16.9,
    decDeg: -30,
    sizeDeg: 25,
    stars: ["Antares", "Shaula", "Sargas"],
  },
  {
    name: "Sagittarius",
    kind: "constellation",
    raHours: 19.0,
    decDeg: -25,
    sizeDeg: 20,
    stars: ["Kaus Australis", "Nunki"],
  },
  {
    name: "Cygnus",
    kind: "constellation",
    raHours: 20.6,
    decDeg: 40,
    sizeDeg: 22,
    stars: ["Deneb", "Sadr", "Gienah", "Albireo"],
  },
  {
    name: "Lyra",
    kind: "constellation",
    raHours: 18.6,
    decDeg: 38,
    sizeDeg: 8,
    stars: ["Vega"],
  },
  {
    name: "Aquila",
    kind: "constellation",
    raHours: 19.7,
    decDeg: 5,
    sizeDeg: 18,
    stars: ["Altair"],
  },
  {
    name: "Summer Triangle",
    kind: "asterism",
    raHours: 19.5,
    decDeg: 28,
    sizeDeg: 35,
    stars: ["Vega", "Deneb", "Altair"],
  },
  {
    name: "Cassiopeia",
    kind: "constellation",
    raHours: 1.0,
    decDeg: 60,
    sizeDeg: 18,
    stars: ["Schedar", "Caph", "Gamma Cas", "Ruchbah", "Segin"],
  },
  {
    name: "Andromeda",
    kind: "constellation",
    raHours: 1.0,
    decDeg: 38,
    sizeDeg: 25,
    stars: ["Alpheratz", "Mirach", "Almach"],
  },
  {
    name: "Pegasus",
    kind: "constellation",
    raHours: 22.7,
    decDeg: 20,
    sizeDeg: 25,
    stars: ["Markab", "Scheat", "Algenib", "Alpheratz"],
  },
  {
    name: "Perseus",
    kind: "constellation",
    raHours: 3.4,
    decDeg: 45,
    sizeDeg: 20,
    stars: ["Mirfak", "Algol"],
  },
  {
    name: "Auriga",
    kind: "constellation",
    raHours: 5.8,
    decDeg: 42,
    sizeDeg: 18,
    stars: ["Capella", "Menkalinan"],
  },
  {
    name: "Southern Cross",
    kind: "asterism",
    raHours: 12.5,
    decDeg: -60,
    sizeDeg: 8,
    stars: ["Acrux", "Mimosa", "Gacrux", "Delta Crucis"],
  },
  {
    name: "Crux",
    kind: "constellation",
    raHours: 12.5,
    decDeg: -60,
    sizeDeg: 8,
    stars: ["Acrux", "Mimosa", "Gacrux", "Delta Crucis"],
  },
  {
    name: "Centaurus",
    kind: "constellation",
    raHours: 13.5,
    decDeg: -50,
    sizeDeg: 30,
    stars: ["Alpha Centauri", "Hadar", "Menkent"],
  },
];

export interface VisibleSkyHint {
  name: string;
  kind: "constellation" | "asterism";
  altitudeDeg: number;
  azimuthDeg: number;
  stars: string[];
}

export interface SkyLocationContext {
  localSiderealHours: number;
  seasonHint: string;
  hemisphere: "northern" | "southern" | "equatorial";
  visible: VisibleSkyHint[];
  /** Compact block for the vision prompt. */
  promptBlock: string;
}

function wrap24(h: number): number {
  let x = h % 24;
  if (x < 0) x += 24;
  return x;
}

/** Approximate local mean sidereal time in hours (good enough for priors). */
export function localSiderealHours(takenAtIso: string, longitudeDeg: number): number {
  const date = new Date(takenAtIso);
  if (Number.isNaN(date.getTime())) return 0;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const gmst =
    18.697374558 + 24.06570982441908 * d + ((date.getUTCSeconds() % 1) * 24) / 86400;
  return wrap24(gmst + longitudeDeg / 15);
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
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = (Math.asin(Math.min(1, Math.max(-1, sinAlt))) * 180) / Math.PI;
  const cosAz =
    (Math.sin(dec) - Math.sin(lat) * sinAlt) /
    (Math.cos(lat) * Math.cos((alt * Math.PI) / 180) || 1e-9);
  let az = (Math.acos(Math.min(1, Math.max(-1, cosAz))) * 180) / Math.PI;
  if (Math.sin(ha) > 0) az = 360 - az;
  return { alt, az };
}

function seasonHint(takenAtIso: string, lat: number): string {
  const m = new Date(takenAtIso).getUTCMonth(); // 0–11
  const north = lat >= 0;
  if (m === 11 || m <= 1) return north ? "northern winter sky" : "southern summer sky";
  if (m <= 4) return north ? "northern spring sky" : "southern autumn sky";
  if (m <= 7) return north ? "northern summer sky" : "southern winter sky";
  return north ? "northern autumn sky" : "southern spring sky";
}

function facingFilter(
  az: number,
  facingDegrees: number | undefined
): boolean {
  if (facingDegrees === undefined || !Number.isFinite(facingDegrees)) return true;
  let d = Math.abs(((az - facingDegrees + 540) % 360) - 180);
  // Allow ~100° FOV around facing
  return d <= 100;
}

/** Build location/time priors for the vision model. */
export function buildSkyLocationContext(meta: SkyCaptureMeta): SkyLocationContext {
  const lst = localSiderealHours(meta.takenAt, meta.longitude);
  const hemisphere =
    meta.latitude > 23.5
      ? "northern"
      : meta.latitude < -23.5
        ? "southern"
        : "equatorial";
  const season = seasonHint(meta.takenAt, meta.latitude);

  const visible: VisibleSkyHint[] = [];
  for (const entry of BRIGHT_SKY_CATALOG) {
    const { alt, az } = altitudeAzimuth(
      meta.latitude,
      lst,
      entry.raHours,
      entry.decDeg
    );
    if (alt < 8) continue;
    if (!facingFilter(az, meta.facingDegrees)) continue;
    visible.push({
      name: entry.name,
      kind: entry.kind,
      altitudeDeg: Math.round(alt),
      azimuthDeg: Math.round(az),
      stars: entry.stars,
    });
  }

  visible.sort((a, b) => b.altitudeDeg - a.altitudeDeg);
  const top = visible.slice(0, 10);

  const lines = top.map(
    (v) =>
      `- ${v.name} (${v.kind}): ~${v.altitudeDeg}° alt, az ${v.azimuthDeg}°; stars: ${v.stars.join(", ")}`
  );

  const facing =
    meta.facingDegrees !== undefined && Number.isFinite(meta.facingDegrees)
      ? `Facing ~${meta.facingDegrees}° (0=N, 90=E, 180=S, 270=W). Prefer figures near that azimuth.`
      : "Facing unknown — use whole sky above the horizon.";

  const promptBlock = `LOCATION SKY PRIOR (use to NAME stars you can see; do not invent pixels):
Observer: lat ${meta.latitude.toFixed(4)}, lon ${meta.longitude.toFixed(4)}${
    meta.locationLabel ? ` (${meta.locationLabel})` : ""
  }; time ${meta.takenAt}; LST≈${lst.toFixed(2)}h; ${season}; ${hemisphere} hemisphere.
${facing}${meta.notes ? `\nObserver notes: ${meta.notes}` : ""}

Likely above the horizon right now (highest first):
${lines.length ? lines.join("\n") : "- (sparse prior — still mark any bright points you see)"}

Matching rule: if a bright pattern in the photo matches a listed figure, identify ALL visible stick-figure stars with classic names and classic lines. Prefer more named stars over fewer.`;

  return {
    localSiderealHours: lst,
    seasonHint: season,
    hemisphere,
    visible: top,
    promptBlock,
  };
}
