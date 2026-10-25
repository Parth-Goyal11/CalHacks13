import type { EventRarity, RankedCelestialEvent } from "@calhacks13/lib";
import type { GeocodedPlace } from "@/components/sky/location-types";

export const RARITY_ORDER: EventRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export const RARITY_META: Record<
  EventRarity,
  { label: string; blurb: string; chip: string; active: string; color: string }
> = {
  common: {
    label: "Common",
    blurb: "Full moons & dark-sky nights — easy naked-eye targets.",
    chip: "border-zinc-600 text-zinc-300 hover:border-zinc-400",
    active: "border-zinc-300 bg-zinc-200 text-zinc-950",
    color: "#a1a1aa",
  },
  uncommon: {
    label: "Uncommon",
    blurb: "ISS passes, bright planets, modest meteor peaks.",
    chip: "border-emerald-700/70 text-emerald-300 hover:border-emerald-500",
    active: "border-emerald-300 bg-emerald-300 text-zinc-950",
    color: "#34d399",
  },
  rare: {
    label: "Rare",
    blurb: "Big showers (Perseids/Geminids) and night launches.",
    chip: "border-sky-700/70 text-sky-300 hover:border-sky-500",
    active: "border-sky-300 bg-sky-300 text-zinc-950",
    color: "#38bdf8",
  },
  epic: {
    label: "Epic",
    blurb: "Lunar eclipses & strong aurora windows.",
    chip: "border-violet-600/70 text-violet-300 hover:border-violet-400",
    active: "border-violet-300 bg-violet-300 text-zinc-950",
    color: "#a78bfa",
  },
  legendary: {
    label: "Legendary",
    blurb: "Path-dependent solar eclipses — travel to see them.",
    chip: "border-amber-500/70 text-amber-200 hover:border-amber-400",
    active: "border-amber-300 bg-amber-300 text-zinc-950",
    color: "#fbbf24",
  },
};

export type RarityFilter = "all" | EventRarity;

export function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDistance(event: RankedCelestialEvent) {
  if (event.globalVisibility) return "Visible in your sky";
  if (event.distanceKm == null) return "Set location to measure";
  if (event.distanceKm < 1) return "Overhead / on site";
  if (event.distanceKm < 100) return `${Math.round(event.distanceKm)} km away`;
  if (event.distanceKm < 1000)
    return `${Math.round(event.distanceKm / 10) * 10} km away`;
  return `${(event.distanceKm / 1000).toFixed(1)}k km away`;
}

export function byClosest(a: RankedCelestialEvent, b: RankedCelestialEvent) {
  const da = a.globalVisibility ? 0 : a.distanceKm ?? Number.POSITIVE_INFINITY;
  const db = b.globalVisibility ? 0 : b.distanceKm ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

/** Stable hash → small lat/lon jitter so stacked global events fan out. */
function jitter(id: string): { dLat: number; dLon: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h % 1000) / 1000) * 2 - 1;
  const b = ((((h / 1000) | 0) % 1000) / 1000) * 2 - 1;
  return { dLat: a * 4, dLon: b * 6 };
}

export interface GlobePoint {
  id: string;
  lat: number;
  lng: number;
  rarity: EventRarity;
  title: string;
  color: string;
  size: number;
  event: RankedCelestialEvent;
}

export function eventsToGlobePoints(
  events: RankedCelestialEvent[],
  place: GeocodedPlace | null
): GlobePoint[] {
  const points: GlobePoint[] = [];

  for (const event of events) {
    let lat: number | null = null;
    let lng: number | null = null;

    if (event.location) {
      lat = event.location.lat;
      lng = event.location.lon;
    } else if (event.globalVisibility && place) {
      const j = jitter(event.id);
      lat = place.latitude + j.dLat;
      lng = place.longitude + j.dLon;
    }

    if (lat == null || lng == null) continue;

    const size =
      event.rarity === "legendary"
        ? 1.1
        : event.rarity === "epic"
          ? 0.95
          : event.rarity === "rare"
            ? 0.8
            : event.rarity === "uncommon"
              ? 0.7
              : 0.55;

    points.push({
      id: event.id,
      lat,
      lng,
      rarity: event.rarity,
      title: event.title,
      color: RARITY_META[event.rarity].color,
      size,
      event,
    });
  }

  return points;
}
