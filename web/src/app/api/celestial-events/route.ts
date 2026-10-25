import {
  getUpcomingCelestialEvents,
  haversineKm,
} from "@calhacks13/lib/celestial-events";
import type {
  EventSortMode,
  ObserverLocation,
  RankedCelestialEvent,
  CelestialEventKind,
  EventRarity,
} from "@calhacks13/lib/celestial-events";
import {
  CELESTIAL_EVENTS_INDEX,
  createElasticClient,
  hasElasticConfig,
  type EsCelestialEventDoc,
} from "@/lib/elastic";

const PUBLIC_ERROR = "Sky events are unavailable. Please try again.";

const SKY_VISIBLE_KINDS = [
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
];

function clampDays(n: number) {
  return Math.min(180, Math.max(7, n));
}

function docToRanked(
  doc: EsCelestialEventDoc,
  observer: ObserverLocation | null,
  sortScore: number
): RankedCelestialEvent {
  const globalVisibility = Boolean(doc.globalVisibility);
  let distanceKm: number | null = null;
  let inRange = globalVisibility;

  if (observer && doc.location) {
    distanceKm = haversineKm(
      observer.latitude,
      observer.longitude,
      doc.location.lat,
      doc.location.lon
    );
    const radius = doc.visibilityRadiusKm ?? 500;
    inRange = distanceKm <= radius;
  } else if (globalVisibility) {
    distanceKm = 0;
    inRange = true;
  }

  return {
    id: doc.id,
    kind: doc.kind as CelestialEventKind,
    title: doc.title,
    summary: doc.summary,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    rarity: doc.rarity as EventRarity,
    points: doc.points,
    location: doc.location
      ? {
          lat: doc.location.lat,
          lon: doc.location.lon,
          label: doc.locationLabel,
        }
      : undefined,
    globalVisibility: globalVisibility || undefined,
    visibilityRadiusKm: doc.visibilityRadiusKm,
    source: doc.source,
    photoTip: doc.photoTip,
    distanceKm,
    inRange,
    sortScore,
  };
}

function buildQuery(
  observer: ObserverLocation | null,
  days: number,
  skyVisible: boolean,
  sort: EventSortMode
) {
  const filters: Record<string, unknown>[] = [
    { range: { endsAt: { gte: "now" } } },
    { range: { startsAt: { lte: `now+${days}d` } } },
  ];

  if (skyVisible) {
    filters.push({ terms: { kind: SKY_VISIBLE_KINDS } });
  }

  // Geo filter: skip when no observer; always include globally visible events.
  if (observer) {
    filters.push({
      bool: {
        should: [
          { term: { globalVisibility: true } },
          {
            geo_distance: {
              distance: "5000km",
              location: {
                lat: observer.latitude,
                lon: observer.longitude,
              },
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // Weight blend mirrors in-memory rarity / distance / soon scoring.
  const distanceWeight =
    sort === "distance" ? 2.2 : sort === "soonest" ? 0.8 : 1.0;
  const rarityWeight =
    sort === "rarity" ? 2.5 : sort === "distance" ? 1.0 : 1.2;
  const soonWeight =
    sort === "soonest" ? 2.2 : sort === "rarity" ? 0.8 : 1.0;

  const functions: Record<string, unknown>[] = [
    {
      field_value_factor: {
        field: "rarityRank",
        factor: rarityWeight,
        missing: 1,
        modifier: "none",
      },
    },
    {
      gauss: {
        startsAt: {
          origin: "now",
          scale: "14d",
          offset: "1d",
          decay: 0.5,
        },
      },
      weight: soonWeight,
    },
  ];

  if (observer) {
    functions.push({
      gauss: {
        location: {
          origin: {
            lat: observer.latitude,
            lon: observer.longitude,
          },
          scale: "500km",
          offset: "50km",
          decay: 0.5,
        },
      },
      weight: distanceWeight,
    });
  }

  return {
    function_score: {
      query: {
        bool: {
          filter: filters,
        },
      },
      functions,
      score_mode: "sum" as const,
      boost_mode: "replace" as const,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const label = searchParams.get("label") ?? undefined;
    const days = clampDays(Number(searchParams.get("days") ?? "90"));
    const sortParam = searchParams.get("sort") ?? "distance";
    const sort: EventSortMode =
      sortParam === "distance" ||
      sortParam === "soonest" ||
      sortParam === "rarity"
        ? sortParam
        : "distance";
    const skyVisible = searchParams.get("skyVisible") !== "0";

    const observer: ObserverLocation | null =
      lat != null &&
      lon != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lon))
        ? {
            latitude: Number(lat),
            longitude: Number(lon),
            label,
          }
        : null;

    let events: RankedCelestialEvent[] = [];
    let source: "elastic" | "live" = "live";

    if (hasElasticConfig()) {
      try {
        events = await loadFromElastic(observer, days, skyVisible, sort);
        source = "elastic";
      } catch (elasticErr) {
        console.warn(
          "[celestial-events] Elastic unavailable, using the live catalog:",
          elasticErr instanceof Error ? elasticErr.message : elasticErr,
        );
        events = await loadFromLive(observer, days, skyVisible, sort);
      }
    } else {
      events = await loadFromLive(observer, days, skyVisible, sort);
    }

    return Response.json({
      observer,
      count: events.length,
      events,
      source,
    });
  } catch (err) {
    console.error("[celestial-events]", err);
    return Response.json({ error: PUBLIC_ERROR }, { status: 500 });
  }
}

async function loadFromElastic(
  observer: ObserverLocation | null,
  days: number,
  skyVisible: boolean,
  sort: EventSortMode,
): Promise<RankedCelestialEvent[]> {
  const client = createElasticClient();
  const result = await client.search<EsCelestialEventDoc>({
    index: CELESTIAL_EVENTS_INDEX,
    size: 100,
    query: buildQuery(observer, days, skyVisible, sort),
  });

  return result.hits.hits
    .map((hit) => {
      const doc = hit._source;
      if (!doc) return null;
      return docToRanked(doc, observer, hit._score ?? 0);
    })
    .filter((event): event is RankedCelestialEvent => event != null);
}

async function loadFromLive(
  observer: ObserverLocation | null,
  days: number,
  skyVisible: boolean,
  sort: EventSortMode,
): Promise<RankedCelestialEvent[]> {
  return getUpcomingCelestialEvents({
    observer,
    days,
    skyVisibleOnly: skyVisible,
    sort,
  });
}
