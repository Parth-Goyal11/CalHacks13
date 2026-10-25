/**
 * Upcoming celestial events for the photography game (Elastic / Spacetime precursor).
 * Mix of computed astronomy + live launch feed + location-aware scoring.
 */

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

export interface CelestialEvent {
  id: string;
  kind: CelestialEventKind;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  rarity: EventRarity;
  /** Base photo points before distance/timing multipliers. */
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

export const RARITY_POINTS: Record<EventRarity, number> = {
  common: 50,
  uncommon: 120,
  rare: 300,
  epic: 750,
  legendary: 2000,
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

// --- Moon phases (simple synodic approximation) ---

/** Known new moon near J2000 reference (2000-01-06 18:14 UTC) */
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MS = 29.530588853 * 24 * 60 * 60 * 1000;

function nextPhaseAfter(
  after: Date,
  phaseOffset: number
): Date {
  // phaseOffset: 0 = new, 0.5 = full, 0.25 = first quarter, etc.
  const t = after.getTime();
  const k = Math.floor((t - REF_NEW_MOON) / SYNODIC_MS);
  for (let i = k; i < k + 8; i++) {
    const phaseTime = REF_NEW_MOON + (i + phaseOffset) * SYNODIC_MS;
    if (phaseTime > t + 60_000) return new Date(phaseTime);
  }
  return new Date(t + SYNODIC_MS);
}

function moonEvents(from: Date, to: Date): CelestialEvent[] {
  const out: CelestialEvent[] = [];
  let cursor = from;

  for (let n = 0; n < 6; n++) {
    const full = nextPhaseAfter(cursor, 0.5);
    if (full > to) break;
    const isSuper =
      full.getUTCMonth() === 7 ||
      full.getUTCMonth() === 10 ||
      full.getUTCDate() <= 3; // lightweight heuristic for demo supermoon tagging
    out.push({
      id: `full-moon-${full.toISOString().slice(0, 10)}`,
      kind: isSuper ? "supermoon" : "full_moon",
      title: isSuper ? "Supermoon" : "Full Moon",
      summary: isSuper
        ? "Near-perigee full moon — brighter disk, easy wide-field target."
        : "Classic full moon. Common, but great for scoring a clean capture.",
      startsAt: new Date(full.getTime() - 3 * 3600_000).toISOString(),
      endsAt: new Date(full.getTime() + 3 * 3600_000).toISOString(),
      rarity: isSuper ? "uncommon" : "common",
      points: isSuper ? RARITY_POINTS.uncommon : RARITY_POINTS.common,
      globalVisibility: true,
      source: "computed-moon",
      photoTip: "Expose for the disc, not the sky — brace the phone or use a tripod.",
    });
    cursor = new Date(full.getTime() + 24 * 3600_000);
  }

  cursor = from;
  for (let n = 0; n < 6; n++) {
    const neu = nextPhaseAfter(cursor, 0);
    if (neu > to) break;
    out.push({
      id: `new-moon-${neu.toISOString().slice(0, 10)}`,
      kind: "new_moon",
      title: "New Moon — Milky Way window",
      summary:
        "No moonlight washout: the Milky Way and faint meteors are actually visible if skies are dark.",
      startsAt: new Date(neu.getTime() - 12 * 3600_000).toISOString(),
      endsAt: new Date(neu.getTime() + 36 * 3600_000).toISOString(),
      rarity: "common",
      points: RARITY_POINTS.common,
      globalVisibility: true,
      source: "computed-moon",
      photoTip: "Face the galactic core after dusk; ISO up, short enough to avoid star trails.",
    });
    cursor = new Date(neu.getTime() + 24 * 3600_000);
  }

  return out;
}

// --- Annual meteor showers (peaks; year rolled to window) ---

const METEOR_SHOWERS: Array<{
  id: string;
  name: string;
  month: number; // 1-12
  day: number;
  durationHours: number;
  rarity: EventRarity;
  tip: string;
}> = [
  {
    id: "quadrantids",
    name: "Quadrantids peak",
    month: 1,
    day: 3,
    durationHours: 18,
    rarity: "uncommon",
    tip: "Short intense peak — dress warm, face northeast after midnight.",
  },
  {
    id: "lyrids",
    name: "Lyrids peak",
    month: 4,
    day: 22,
    durationHours: 36,
    rarity: "uncommon",
    tip: "Modest rates; look near Lyra after midnight.",
  },
  {
    id: "perseids",
    name: "Perseids peak",
    month: 8,
    day: 12,
    durationHours: 48,
    rarity: "rare",
    tip: "Crowd favorite — lie back, wide lens, radiant in Perseus.",
  },
  {
    id: "orionids",
    name: "Orionids peak",
    month: 10,
    day: 21,
    durationHours: 36,
    rarity: "uncommon",
    tip: "Halley dust — radiant near Orion after midnight.",
  },
  {
    id: "leonids",
    name: "Leonids peak",
    month: 11,
    day: 17,
    durationHours: 24,
    rarity: "rare",
    tip: "Fast meteors; occasional outbursts. Face Leo pre-dawn.",
  },
  {
    id: "geminids",
    name: "Geminids peak",
    month: 12,
    day: 14,
    durationHours: 48,
    rarity: "rare",
    tip: "Often the best shower of the year — radiant near Castor/Pollux.",
  },
];

function meteorEvents(from: Date, to: Date): CelestialEvent[] {
  const out: CelestialEvent[] = [];
  const years = [from.getUTCFullYear(), from.getUTCFullYear() + 1];

  for (const year of years) {
    for (const shower of METEOR_SHOWERS) {
      const peak = new Date(Date.UTC(year, shower.month - 1, shower.day, 8, 0, 0));
      const start = new Date(peak.getTime() - shower.durationHours * 0.35 * 3600_000);
      const end = new Date(peak.getTime() + shower.durationHours * 0.65 * 3600_000);
      if (end < from || start > to) continue;
      out.push({
        id: `${shower.id}-${year}`,
        kind: "meteor_shower",
        title: shower.name,
        summary: `${shower.name.replace(" peak", "")} meteor shower peak window.`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        rarity: shower.rarity,
        points: RARITY_POINTS[shower.rarity],
        globalVisibility: true,
        source: "meteor-calendar",
        photoTip: shower.tip,
      });
    }
  }
  return out;
}

/** Hand-curated near-term notable events (path centers are approximate). */
function curatedNotables(from: Date, to: Date): CelestialEvent[] {
  const catalog: CelestialEvent[] = [
    {
      id: "lunar-eclipse-2026-03",
      kind: "lunar_eclipse",
      title: "Total lunar eclipse",
      summary: "Blood-moon total eclipse — photograph the umbra progression.",
      startsAt: "2026-03-03T07:00:00.000Z",
      endsAt: "2026-03-03T12:00:00.000Z",
      rarity: "epic",
      points: RARITY_POINTS.epic,
      globalVisibility: true,
      source: "curated-ephemeris",
      photoTip: "Bracket exposures as brightness drops through totality.",
    },
    {
      id: "solar-eclipse-2026-08",
      kind: "solar_eclipse",
      title: "Total solar eclipse (path)",
      summary: "Totality corridor across the North Atlantic / Europe — legendary capture.",
      startsAt: "2026-08-12T16:30:00.000Z",
      endsAt: "2026-08-12T19:30:00.000Z",
      rarity: "legendary",
      points: RARITY_POINTS.legendary,
      location: { lat: 65.0, lon: -20.0, label: "Totality path (Iceland / N. Atlantic)" },
      visibilityRadiusKm: 400,
      source: "curated-ephemeris",
      photoTip: "Solar filter until totality only — plan travel to the path.",
    },
    {
      id: "jupiter-opposition-2026",
      kind: "planetary_conjunction",
      title: "Jupiter near opposition",
      summary: "Jupiter at its brightest for the year — easy phone telephoto target.",
      startsAt: "2026-01-10T00:00:00.000Z",
      endsAt: "2026-01-20T00:00:00.000Z",
      rarity: "uncommon",
      points: RARITY_POINTS.uncommon,
      globalVisibility: true,
      source: "curated-ephemeris",
      photoTip: "Stabilize and zoom; moons may show as dots on a long zoom.",
    },
    {
      id: "saturn-ring-tilt-2026",
      kind: "planetary_conjunction",
      title: "Saturn evening apparition",
      summary: "Saturn well placed after dusk — rings challenge for small lenses.",
      startsAt: "2026-09-15T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
      rarity: "uncommon",
      points: RARITY_POINTS.uncommon,
      globalVisibility: true,
      source: "curated-ephemeris",
      photoTip: "Look southwest after sunset; binoculars help.",
    },
    {
      id: "aurora-equinox-2026",
      kind: "aurora_window",
      title: "Equinox aurora watch window",
      summary: "Geomagnetic activity often rises near equinox — high-latitude bonus.",
      startsAt: "2026-03-15T00:00:00.000Z",
      endsAt: "2026-03-25T00:00:00.000Z",
      rarity: "epic",
      points: RARITY_POINTS.epic,
      location: { lat: 64.84, lon: -147.72, label: "Auroral oval (e.g. Fairbanks belt)" },
      visibilityRadiusKm: 2500,
      source: "curated-ephemeris",
      photoTip: "North horizon, high ISO, 5–15s exposures if KP rises.",
    },
  ];

  return catalog.filter((e) => {
    const s = new Date(e.startsAt);
    const en = new Date(e.endsAt);
    return en >= from && s <= to;
  });
}

/** Next single bright ISS-like pass for the observer (until live TLE wired). */
function issPassesForObserver(
  observer: ObserverLocation,
  from: Date,
  _days: number
): CelestialEvent[] {
  const seed =
    Math.abs(Math.sin(observer.latitude * 12.9898 + observer.longitude * 78.233)) *
    10000;
  const hoursAhead = 6 + (seed % 40); // one pass in the next ~2 days
  const start = new Date(from.getTime() + hoursAhead * 3600_000);
  const end = new Date(start.getTime() + 6 * 60_000);
  const day = start.toISOString().slice(0, 10);

  return [
    {
      id: `iss-next-${observer.latitude.toFixed(2)}-${observer.longitude.toFixed(2)}-${day}`,
      kind: "iss_pass",
      title: "ISS bright pass",
      summary: `Next predicted visible ISS pass near ${observer.label ?? "your location"}.`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      rarity: "uncommon",
      points: RARITY_POINTS.uncommon,
      location: {
        lat: observer.latitude,
        lon: observer.longitude,
        label: observer.label ?? "Your sky",
      },
      visibilityRadiusKm: 800,
      source: "iss-model",
      photoTip:
        "Look for a steady bright “star” crossing — no blinking. Sweep with video.",
    },
  ];
}

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
    url.searchParams.set("limit", "12");
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
      const lon = launch.pad?.longitude ? Number(launch.pad.longitude) : undefined;
      const padLabel =
        launch.pad?.location?.name || launch.pad?.name || "Launch site";

      // Only night / twilight launches — daytime ones aren't useful sky photos for this game
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
        endsAt: launch.window_end || new Date(start.getTime() + 2 * 3600_000).toISOString(),
        rarity: "rare",
        points: RARITY_POINTS.rare,
        location:
          lat !== undefined &&
          lon !== undefined &&
          Number.isFinite(lat) &&
          Number.isFinite(lon)
            ? { lat, lon, label: padLabel }
            : undefined,
        visibilityRadiusKm: 350,
        source: "thespacedevs",
        photoTip: "Clear low horizon toward the pad; shoot the rising plume and lingering trail.",
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

    // Blend: rarer + closer + sooner
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
    // rarity: higher rarity first, then closer, then sooner
    return (
      RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] ||
      (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) ||
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  });

  return ranked;
}

/** Kinds that are naked-eye / camera targets in the actual sky. */
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

  const [launches] = await Promise.all([fetchUpcomingLaunches(to)]);

  let collected: CelestialEvent[] = [
    ...moonEvents(from, to),
    ...meteorEvents(from, to),
    ...curatedNotables(from, to),
    ...launches,
  ];

  if (observer) {
    collected.push(...issPassesForObserver(observer, from, Math.min(days, 14)));
  }

  if (options.skyVisibleOnly !== false) {
    collected = collected.filter((e) => SKY_VISIBLE_KINDS.has(e.kind));
  }

  // de-dupe by id
  const byId = new Map<string, CelestialEvent>();
  for (const e of collected) byId.set(e.id, e);

  return rankEvents(
    [...byId.values()],
    observer,
    options.sort ?? "distance"
  );
}
