/**
 * Upcoming celestial events for the photography game.
 * Sources are live / ephemeris-backed — not hand-curated fixtures.
 *
 * - Moon phases & eclipses: astronomy-engine (VSOP87 / ELP analytical models)
 * - Meteor peaks: IMO working-list solar longitudes → SearchSunLongitude
 * - Launches: The Space Devs Launch Library 2
 * - Aurora: NOAA SWPC planetary Kp forecast
 * - ISS: Celestrak NORAD TLE + satellite.js elevation search
 */

import * as Astronomy from "astronomy-engine";
import * as satellite from "satellite.js";
import {
  AWARD_POINTS,
  SUBJECT_BONUS,
  type RarityName,
  type SubjectKey,
} from "./sky-score";

export type EventRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type CelestialEventKind =
  | "full_moon"
  | "new_moon"
  | "supermoon"
  | "meteor_shower"
  | "lunar_eclipse"
  | "solar_eclipse"
  | "iss_pass"
  | "launch"
  | "planetary_conjunction"
  | "comet"
  | "aurora_window";

/** Same ladder as photo scoring (`sky-score` AWARD_POINTS). */
const EVENT_RARITY_NAME: Record<EventRarity, RarityName> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/**
 * Map event kinds → photo subject bonuses from main's scoring system.
 * Event payout = AWARD_POINTS[rarity] + SUBJECT_BONUS[kind].
 */
const KIND_SUBJECT: Partial<Record<CelestialEventKind, SubjectKey>> = {
  full_moon: "planet_moon_or_pair",
  supermoon: "planet_moon_or_pair",
  new_moon: "milky_way_core",
  planetary_conjunction: "planet_moon_or_pair",
  lunar_eclipse: "planet_moon_or_pair",
  solar_eclipse: "iss_crossing_moon_or_sun",
  meteor_shower: "meteor_streak",
  iss_pass: "satellite_logged_pass",
  launch: "satellite_logged_pass",
  aurora_window: "aurora_below_50_lat",
  comet: "naked_eye_comet",
};

/** Award points by rarity — sourced from `AWARD_POINTS` in sky-score.ts. */
export const RARITY_POINTS: Record<EventRarity, number> = {
  common: AWARD_POINTS.Common,
  uncommon: AWARD_POINTS.Uncommon,
  rare: AWARD_POINTS.Rare,
  epic: AWARD_POINTS.Epic,
  legendary: AWARD_POINTS.Legendary,
};

/** Points for capturing this event: rarity award + subject bonus (main sky-score). */
export function pointsForEvent(
  kind: CelestialEventKind,
  rarity: EventRarity
): number {
  const base = AWARD_POINTS[EVENT_RARITY_NAME[rarity]];
  const subject = KIND_SUBJECT[kind];
  const bonus = subject ? SUBJECT_BONUS[subject] : 0;
  return base + bonus;
}

export interface CelestialEvent {
  id: string;
  kind: CelestialEventKind;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  rarity: EventRarity;
  /** Payout from main sky-score: AWARD_POINTS[rarity] + SUBJECT_BONUS[kind]. */
  points: number;
  /** Best-view / path center; omit if globally visible. */
  location?: { lat: number; lon: number; label?: string };
  /** If true, treat as visible from observer (distance ≈ 0 when in band). */
  globalVisibility?: boolean;
  /** Rough max distance (km) where the event is photographable. */
  visibilityRadiusKm?: number;
  source: string;
  photoTip: string;
}

export interface RankedCelestialEvent extends CelestialEvent {
  distanceKm: number | null;
  /** true if likely photographable from observer location */
  inRange: boolean;
  sortScore: number;
}

export const RARITY_RANK: Record<EventRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

/** Haversine distance in km. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function inWindow(start: Date, end: Date, from: Date, to: Date) {
  return end >= from && start <= to;
}

// --- Moon phases (astronomy-engine) ---

async function moonEvents(from: Date, to: Date): Promise<CelestialEvent[]> {
  const out: CelestialEvent[] = [];
  let cursor = Astronomy.MakeTime(from);

  // Walk primary quarters: 0=new, 1=first, 2=full, 3=third
  for (let i = 0; i < 16; i++) {
    const q = Astronomy.SearchMoonQuarter(cursor);
    const t = q.time.date;
    if (t > to) break;

    if (q.quarter === 0 || q.quarter === 2) {
      const start = new Date(
        t.getTime() - (q.quarter === 0 ? 12 : 3) * 3600_000
      );
      const end = new Date(
        t.getTime() + (q.quarter === 0 ? 36 : 3) * 3600_000
      );
      if (inWindow(start, end, from, to)) {
        if (q.quarter === 2) {
          // Supermoon ≈ full moon near perigee (within ~1.5 days)
          let isSuper = false;
          try {
            const apsis = Astronomy.SearchLunarApsis(q.time);
            const deltaH =
              Math.abs(apsis.time.tt - q.time.tt) * 24;
            isSuper = apsis.kind === 0 /* Perigee */ && deltaH < 36;
          } catch {
            isSuper = false;
          }

          out.push({
            id: `full-moon-${t.toISOString().slice(0, 10)}`,
            kind: isSuper ? "supermoon" : "full_moon",
            title: isSuper ? "Supermoon" : "Full Moon",
            summary: isSuper
              ? "Near-perigee full moon (astronomy-engine) — brighter disk, easy wide-field target."
              : "Full moon computed from lunar ephemeris — clean disc capture.",
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            rarity: isSuper ? "uncommon" : "common",
            points: pointsForEvent(
              isSuper ? "supermoon" : "full_moon",
              isSuper ? "uncommon" : "common"
            ),
            globalVisibility: true,
            source: "astronomy-engine",
            photoTip:
              "Expose for the disc, not the sky — brace the phone or use a tripod.",
          });
        } else {
          out.push({
            id: `new-moon-${t.toISOString().slice(0, 10)}`,
            kind: "new_moon",
            title: "New Moon — Milky Way window",
            summary:
              "No moonlight washout (astronomy-engine new moon) — faint sky targets and meteors are easier.",
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            rarity: "common",
            points: pointsForEvent("new_moon", "common"),
            globalVisibility: true,
            source: "astronomy-engine",
            photoTip:
              "Face the galactic core after dusk; ISO up, short enough to avoid star trails.",
          });
        }
      }
    }

    cursor = Astronomy.MakeTime(new Date(t.getTime() + 6 * 3600_000));
  }

  return out;
}

// --- Meteor showers (IMO solar longitudes → astronomy-engine) ---

const IMO_SHOWERS: Array<{
  id: string;
  name: string;
  /** Solar longitude of maximum (IMO working list, degrees). */
  lambdaMax: number;
  durationHours: number;
  rarity: EventRarity;
  tip: string;
}> = [
  {
    id: "quadrantids",
    name: "Quadrantids peak",
    lambdaMax: 283.15,
    durationHours: 18,
    rarity: "uncommon",
    tip: "Short intense peak — dress warm, face northeast after midnight.",
  },
  {
    id: "lyrids",
    name: "Lyrids peak",
    lambdaMax: 32.32,
    durationHours: 36,
    rarity: "uncommon",
    tip: "Modest rates; look near Lyra after midnight.",
  },
  {
    id: "perseids",
    name: "Perseids peak",
    lambdaMax: 140.0,
    durationHours: 48,
    rarity: "rare",
    tip: "Crowd favorite — lie back, wide lens, radiant in Perseus.",
  },
  {
    id: "orionids",
    name: "Orionids peak",
    lambdaMax: 208.0,
    durationHours: 36,
    rarity: "uncommon",
    tip: "Halley dust — radiant near Orion after midnight.",
  },
  {
    id: "leonids",
    name: "Leonids peak",
    lambdaMax: 235.27,
    durationHours: 24,
    rarity: "rare",
    tip: "Fast meteors; occasional outbursts. Face Leo pre-dawn.",
  },
  {
    id: "geminids",
    name: "Geminids peak",
    lambdaMax: 262.2,
    durationHours: 48,
    rarity: "rare",
    tip: "Often the best shower of the year — radiant near Castor/Pollux.",
  },
];

async function meteorEvents(from: Date, to: Date): Promise<CelestialEvent[]> {
  const out: CelestialEvent[] = [];
  // Search a bit before `from` so peaks just starting still appear.
  const searchStart = new Date(from.getTime() - 40 * 24 * 3600_000);

  for (const shower of IMO_SHOWERS) {
    try {
      let startTime = Astronomy.MakeTime(searchStart);
      for (let n = 0; n < 3; n++) {
        const peak = Astronomy.SearchSunLongitude(
          shower.lambdaMax,
          startTime,
          400
        );
        if (!peak) break;
        const peakDate = peak.date;
        const start = new Date(
          peakDate.getTime() - shower.durationHours * 0.35 * 3600_000
        );
        const end = new Date(
          peakDate.getTime() + shower.durationHours * 0.65 * 3600_000
        );
        if (inWindow(start, end, from, to)) {
          out.push({
            id: `${shower.id}-${peakDate.getUTCFullYear()}`,
            kind: "meteor_shower",
            title: shower.name,
            summary: `${shower.name.replace(" peak", "")} meteor shower peak (IMO λ☉=${shower.lambdaMax}° via astronomy-engine).`,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            rarity: shower.rarity,
            points: pointsForEvent("meteor_shower", shower.rarity),
            globalVisibility: true,
            source: "imo+astronomy-engine",
            photoTip: shower.tip,
          });
        }
        startTime = Astronomy.MakeTime(
          new Date(peakDate.getTime() + 20 * 24 * 3600_000)
        );
        if (peakDate > to) break;
      }
    } catch {
      // skip shower if search fails
    }
  }
  return out;
}

// --- Eclipses (astronomy-engine) ---

async function eclipseEvents(from: Date, to: Date): Promise<CelestialEvent[]> {
  const out: CelestialEvent[] = [];

  try {
    let t = Astronomy.MakeTime(new Date(from.getTime() - 5 * 24 * 3600_000));
    for (let i = 0; i < 4; i++) {
      const eclipse = Astronomy.SearchLunarEclipse(t);
      const peak = eclipse.peak.date;
      if (peak > to) break;
      const start = new Date(peak.getTime() - 3 * 3600_000);
      const end = new Date(peak.getTime() + 3 * 3600_000);
      if (inWindow(start, end, from, to) && eclipse.kind !== "penumbral") {
        const total = eclipse.kind === "total";
        out.push({
          id: `lunar-eclipse-${peak.toISOString().slice(0, 10)}`,
          kind: "lunar_eclipse",
          title: total ? "Total lunar eclipse" : "Partial lunar eclipse",
          summary: `${total ? "Total" : "Partial"} lunar eclipse (astronomy-engine) — photograph the umbra progression.`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          rarity: total ? "epic" : "rare",
          points: pointsForEvent(
            "lunar_eclipse",
            total ? "epic" : "rare"
          ),
          globalVisibility: true,
          source: "astronomy-engine",
          photoTip: "Bracket exposures as brightness drops through the eclipse.",
        });
      }
      t = Astronomy.MakeTime(new Date(peak.getTime() + 10 * 24 * 3600_000));
    }
  } catch {
    // ignore
  }

  try {
    let t = Astronomy.MakeTime(new Date(from.getTime() - 5 * 24 * 3600_000));
    for (let i = 0; i < 4; i++) {
      const eclipse = Astronomy.SearchGlobalSolarEclipse(t);
      const peak = eclipse.peak.date;
      if (peak > to) break;
      const start = new Date(peak.getTime() - 2 * 3600_000);
      const end = new Date(peak.getTime() + 2 * 3600_000);
      if (inWindow(start, end, from, to)) {
        const total = eclipse.kind === "total" || eclipse.kind === "annular";
        const lat = eclipse.latitude;
        const lon = eclipse.longitude;
        const hasPath =
          typeof lat === "number" &&
          typeof lon === "number" &&
          Number.isFinite(lat) &&
          Number.isFinite(lon);
        out.push({
          id: `solar-eclipse-${peak.toISOString().slice(0, 10)}`,
          kind: "solar_eclipse",
          title:
            eclipse.kind === "annular"
              ? "Annular solar eclipse (path)"
              : total
                ? "Total solar eclipse (path)"
                : "Partial solar eclipse",
          summary: `${eclipse.kind} solar eclipse peak (astronomy-engine). Path-dependent — travel to the corridor for the legendary shot.`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          rarity: total ? "legendary" : "epic",
          points: pointsForEvent(
            "solar_eclipse",
            total ? "legendary" : "epic"
          ),
          location: hasPath
            ? {
                lat,
                lon,
                label: `Eclipse path center (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`,
              }
            : undefined,
          visibilityRadiusKm: total ? 400 : 2500,
          source: "astronomy-engine",
          photoTip: "Solar filter until totality only — never look unfiltered.",
        });
      }
      t = Astronomy.MakeTime(new Date(peak.getTime() + 20 * 24 * 3600_000));
    }
  } catch {
    // ignore
  }

  return out;
}

// --- Aurora (NOAA SWPC Kp forecast) ---

async function auroraEvents(from: Date, to: Date): Promise<CelestialEvent[]> {
  try {
    const res = await fetch(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      time_tag: string;
      kp: string | number;
      observed?: string;
    }>;

    // First row can be a header in some SWPC products; skip non-numeric.
    const points = rows
      .map((r) => ({
        t: new Date(r.time_tag),
        kp: Number(r.kp),
      }))
      .filter((p) => Number.isFinite(p.kp) && !Number.isNaN(p.t.getTime()));

    const elevated = points.filter(
      (p) => p.kp >= 5 && p.t >= from && p.t <= to
    );
    if (elevated.length === 0) return [];

    // Collapse contiguous elevated windows into events.
    const events: CelestialEvent[] = [];
    let windowStart = elevated[0]!;
    let windowEnd = elevated[0]!;
    let maxKp = elevated[0]!.kp;

    const flush = () => {
      const start = new Date(windowStart.t.getTime() - 1 * 3600_000);
      const end = new Date(windowEnd.t.getTime() + 3 * 3600_000);
      const epic = maxKp >= 7;
      events.push({
        id: `aurora-kp-${windowStart.t.toISOString().slice(0, 13)}`,
        kind: "aurora_window",
        title: epic
          ? `Strong aurora watch (Kp ${maxKp.toFixed(1)})`
          : `Aurora watch (Kp ${maxKp.toFixed(1)})`,
        summary: `NOAA SWPC planetary Kp forecast peaks at ${maxKp.toFixed(1)} — mid/high latitudes may see aurora.`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        rarity: epic ? "legendary" : "epic",
        points: pointsForEvent(
          "aurora_window",
          epic ? "legendary" : "epic"
        ),
        location: {
          lat: 64.84,
          lon: -147.72,
          label: "Auroral oval (high latitudes)",
        },
        visibilityRadiusKm: 2800,
        source: "noaa-swpc",
        photoTip: "North horizon, high ISO, 5–15s exposures while Kp is elevated.",
      });
    };

    for (let i = 1; i < elevated.length; i++) {
      const p = elevated[i]!;
      const gapH =
        (p.t.getTime() - windowEnd.t.getTime()) / 3600_000;
      if (gapH <= 6) {
        windowEnd = p;
        maxKp = Math.max(maxKp, p.kp);
      } else {
        flush();
        windowStart = p;
        windowEnd = p;
        maxKp = p.kp;
      }
    }
    flush();
    return events;
  } catch {
    return [];
  }
}

// --- ISS (Celestrak TLE + satellite.js) ---

async function issPassesForObserver(
  observer: ObserverLocation,
  from: Date,
  days: number
): Promise<CelestialEvent[]> {
  try {
    const tleRes = await fetch(
      "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle"
    );
    if (!tleRes.ok) return [];
    const text = await tleRes.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 3) return [];
    const satrec = satellite.twoline2satrec(lines[1]!, lines[2]!);
    const gmst0 = satellite.gstime(from);

    const observerGd = {
      longitude: satellite.degreesToRadians(observer.longitude),
      latitude: satellite.degreesToRadians(observer.latitude),
      height: 0.05, // km
    };

    const stepMs = 30_000;
    const until = Math.min(
      from.getTime() + days * 24 * 3600_000,
      from.getTime() + 3 * 24 * 3600_000
    );
    const passes: CelestialEvent[] = [];
    let inPass = false;
    let passStart: Date | null = null;
    let maxEl = 0;

    for (let t = from.getTime(); t <= until && passes.length < 2; t += stepMs) {
      const date = new Date(t);
      const pv = satellite.propagate(satrec, date);
      const position = pv?.position;
      if (!position || typeof position === "boolean" || !("x" in position)) {
        continue;
      }
      const gmst = satellite.gstime(date);
      const ecf = satellite.eciToEcf(position, gmst);
      const look = satellite.ecfToLookAngles(observerGd, ecf);
      const elDeg = satellite.radiansToDegrees(look.elevation);

      // Rough darkness: sun altitude < -6°
      const obs = new Astronomy.Observer(
        observer.latitude,
        observer.longitude,
        0
      );
      const sun = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
      const hor = Astronomy.Horizon(date, obs, sun.ra, sun.dec, "normal");
      const dark = hor.altitude < -6;

      if (elDeg >= 20 && dark) {
        if (!inPass) {
          inPass = true;
          passStart = date;
          maxEl = elDeg;
        } else {
          maxEl = Math.max(maxEl, elDeg);
        }
      } else if (inPass && passStart) {
        const end = date;
        passes.push({
          id: `iss-${observer.latitude.toFixed(2)}-${observer.longitude.toFixed(2)}-${passStart.toISOString()}`,
          kind: "iss_pass",
          title: "ISS visible pass",
          summary: `Predicted ISS pass near ${observer.label ?? "your location"} (Celestrak TLE, max elev ~${Math.round(maxEl)}°).`,
          startsAt: passStart.toISOString(),
          endsAt: end.toISOString(),
          rarity: "uncommon",
          points: pointsForEvent("iss_pass", "uncommon"),
          location: {
            lat: observer.latitude,
            lon: observer.longitude,
            label: observer.label ?? "Your sky",
          },
          visibilityRadiusKm: 800,
          source: "celestrak+satellite.js",
          photoTip:
            "Look for a steady bright “star” crossing — no blinking. Sweep with video.",
        });
        inPass = false;
        passStart = null;
        maxEl = 0;
      }
    }

    void gmst0;
    return passes;
  } catch {
    return [];
  }
}

// --- Launches (The Space Devs) ---

interface LaunchLibraryLaunch {
  id: string;
  name: string;
  net: string;
  window_end?: string;
  pad?: {
    name?: string;
    latitude?: string | null;
    longitude?: string | null;
    location?: { name?: string };
  };
  mission?: { description?: string | null };
  status?: { name?: string };
}

async function fetchUpcomingLaunches(to: Date): Promise<CelestialEvent[]> {
  try {
    const url = new URL("https://ll.thespacedevs.com/2.2.0/launch/upcoming/");
    url.searchParams.set("limit", "20");
    url.searchParams.set("mode", "detailed");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: LaunchLibraryLaunch[] };
    const results = data.results ?? [];
    const out: CelestialEvent[] = [];

    for (const launch of results) {
      const start = new Date(launch.net);
      if (Number.isNaN(start.getTime()) || start > to) continue;
      const lat = launch.pad?.latitude ? Number(launch.pad.latitude) : undefined;
      const lon = launch.pad?.longitude
        ? Number(launch.pad.longitude)
        : undefined;
      const padLabel =
        launch.pad?.location?.name || launch.pad?.name || "Launch site";

      // Night / twilight launches are the photographable ones for this game
      const hour = start.getUTCHours();
      const nightish = hour >= 21 || hour <= 9;
      if (!nightish) continue;

      out.push({
        id: `launch-${launch.id}`,
        kind: "launch",
        title: launch.name,
        summary:
          launch.mission?.description?.slice(0, 180) ||
          `Night launch from ${padLabel} — plume and trail visible near the pad horizon.`,
        startsAt: launch.net,
        endsAt:
          launch.window_end ||
          new Date(start.getTime() + 2 * 3600_000).toISOString(),
        rarity: "rare",
        points: pointsForEvent("launch", "rare"),
        location:
          lat !== undefined &&
          lon !== undefined &&
          Number.isFinite(lat) &&
          Number.isFinite(lon)
            ? { lat, lon, label: padLabel }
            : undefined,
        visibilityRadiusKm: 350,
        source: "thespacedevs",
        photoTip:
          "Clear low horizon toward the pad; shoot the rising plume and lingering trail.",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export type EventSortMode = "rarity" | "distance" | "soonest";

export function rankEvents(
  events: CelestialEvent[],
  observer: ObserverLocation | null,
  sort: EventSortMode
): RankedCelestialEvent[] {
  const ranked: RankedCelestialEvent[] = events.map((event) => {
    let distanceKm: number | null = null;
    let inRange = Boolean(event.globalVisibility);

    if (observer && event.location) {
      distanceKm = haversineKm(
        observer.latitude,
        observer.longitude,
        event.location.lat,
        event.location.lon
      );
      const radius = event.visibilityRadiusKm ?? 500;
      inRange = distanceKm <= radius;
    } else if (event.globalVisibility) {
      distanceKm = 0;
      inRange = true;
    }

    const rarityScore = RARITY_RANK[event.rarity];
    const distanceScore =
      distanceKm == null ? 0 : 1 / (1 + distanceKm / 250);
    const hoursUntil = Math.max(
      0,
      (new Date(event.startsAt).getTime() - Date.now()) / 3600_000
    );
    const soonScore = 1 / (1 + hoursUntil / 72);

    const sortScore =
      rarityScore * 40 + distanceScore * 35 + soonScore * 25 + (inRange ? 10 : 0);

    return { ...event, distanceKm, inRange, sortScore };
  });

  ranked.sort((a, b) => {
    if (sort === "soonest") {
      return (
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        b.sortScore - a.sortScore
      );
    }
    if (sort === "distance") {
      const da = a.globalVisibility
        ? 0
        : a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.globalVisibility
        ? 0
        : b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da - db || RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
    }
    return (
      RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] ||
      (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) ||
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  });

  return ranked;
}

const SKY_VISIBLE_KINDS = new Set([
  "full_moon",
  "new_moon",
  "supermoon",
  "meteor_shower",
  "lunar_eclipse",
  "solar_eclipse",
  "iss_pass",
  "launch",
  "planetary_conjunction",
  "comet",
  "aurora_window",
]);

export async function getUpcomingCelestialEvents(options: {
  observer?: ObserverLocation | null;
  days?: number;
  sort?: EventSortMode;
  skyVisibleOnly?: boolean;
}): Promise<RankedCelestialEvent[]> {
  const days = clamp(options.days ?? 60, 7, 180);
  const from = new Date();
  const to = new Date(from.getTime() + days * 24 * 3600_000);
  const observer = options.observer ?? null;

  const [launches, moons, meteors, eclipses, auroras, iss] = await Promise.all([
    fetchUpcomingLaunches(to),
    moonEvents(from, to),
    meteorEvents(from, to),
    eclipseEvents(from, to),
    auroraEvents(from, to),
    observer
      ? issPassesForObserver(observer, from, Math.min(days, 3))
      : Promise.resolve([] as CelestialEvent[]),
  ]);

  let collected: CelestialEvent[] = [
    ...moons,
    ...meteors,
    ...eclipses,
    ...auroras,
    ...launches,
    ...iss,
  ];

  if (options.skyVisibleOnly !== false) {
    collected = collected.filter((e) => SKY_VISIBLE_KINDS.has(e.kind));
  }

  const byId = new Map<string, CelestialEvent>();
  for (const e of collected) byId.set(e.id, e);

  return rankEvents(
    [...byId.values()],
    observer,
    options.sort ?? "distance"
  );
}
