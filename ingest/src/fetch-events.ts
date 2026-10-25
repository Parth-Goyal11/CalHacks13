/**
 * Build the celestial-events catalog from shared astronomy + launch feed logic.
 * Indexed without an observer (global catalog; ISS passes stay observer-specific at query time).
 */

import {
  getUpcomingCelestialEvents,
  RARITY_RANK,
  type CelestialEvent,
} from "@calhacks13/lib/celestial-events";

/** Document shape written to the celestial-events Elasticsearch index. */
export interface IndexedCelestialEvent {
  id: string;
  kind: string;
  title: string;
  summary: string;
  /** Lexical catch-all for BM25 (title + kind + summary + tip). */
  searchBlob: string;
  startsAt: string;
  endsAt: string;
  rarity: string;
  rarityRank: number;
  points: number;
  location?: { lat: number; lon: number };
  locationLabel?: string;
  globalVisibility: boolean;
  visibilityRadiusKm?: number;
  source: string;
  photoTip: string;
}

export function toIndexedCelestialEvent(
  event: CelestialEvent
): IndexedCelestialEvent {
  const kindWords = event.kind.replace(/_/g, " ");
  const doc: IndexedCelestialEvent = {
    id: event.id,
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    searchBlob: [
      event.title,
      kindWords,
      event.summary,
      event.photoTip,
      event.rarity,
      event.location?.label ?? "",
    ]
      .filter(Boolean)
      .join(" "),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    rarity: event.rarity,
    rarityRank: RARITY_RANK[event.rarity],
    points: event.points,
    globalVisibility: Boolean(event.globalVisibility),
    source: event.source,
    photoTip: event.photoTip,
  };

  if (event.location) {
    doc.location = { lat: event.location.lat, lon: event.location.lon };
    if (event.location.label) doc.locationLabel = event.location.label;
  }
  if (event.visibilityRadiusKm != null) {
    doc.visibilityRadiusKm = event.visibilityRadiusKm;
  }

  return doc;
}

export async function fetchCelestialEventsForIndex(): Promise<
  IndexedCelestialEvent[]
> {
  const ranked = await getUpcomingCelestialEvents({
    observer: null,
    days: 90,
    skyVisibleOnly: true,
    sort: "soonest",
  });

  // Strip ranking fields — index stores the base CelestialEvent payload only.
  return ranked.map((event) => {
    const {
      distanceKm: _d,
      inRange: _i,
      sortScore: _s,
      ...base
    } = event;
    return toIndexedCelestialEvent(base);
  });
}
