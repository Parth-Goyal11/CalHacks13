import type {
  CelestialEventKind,
  EventRarity,
  RankedCelestialEvent,
} from "@calhacks13/lib";
import {
  CELESTIAL_EVENTS_INDEX,
  createElasticClient,
  JINA_RERANKER_INFERENCE_ID,
  type EsCelestialEventDoc,
} from "@/lib/elastic";

function docToEvent(
  doc: EsCelestialEventDoc,
  sortScore: number
): RankedCelestialEvent {
  const globalVisibility = Boolean(doc.globalVisibility);
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
    distanceKm: globalVisibility ? 0 : null,
    inRange: globalVisibility,
    sortScore,
  };
}

/** Map casual search phrases → indexed kind keywords. */
function kindsForQuery(q: string): string[] {
  const t = q.toLowerCase();
  const kinds = new Set<string>();
  if (/meteor|perseid|geminid|leonid|quadrantid|lyrid|orionid/.test(t)) {
    kinds.add("meteor_shower");
  }
  if (/super\s*moon|supermoon/.test(t)) kinds.add("supermoon");
  if (/new\s*moon|milky\s*way/.test(t)) kinds.add("new_moon");
  if (/full\s*moon/.test(t)) kinds.add("full_moon");
  if (/\bmoon\b|lunar/.test(t)) {
    kinds.add("full_moon");
    kinds.add("new_moon");
    kinds.add("supermoon");
    kinds.add("lunar_eclipse");
  }
  if (/solar\s*eclipse/.test(t)) kinds.add("solar_eclipse");
  if (/lunar\s*eclipse|blood\s*moon/.test(t)) kinds.add("lunar_eclipse");
  if (/\beclipse\b/.test(t)) {
    kinds.add("lunar_eclipse");
    kinds.add("solar_eclipse");
  }
  if (/launch|rocket|falcon|starlink/.test(t)) kinds.add("launch");
  if (/aurora|northern\s*lights/.test(t)) kinds.add("aurora_window");
  if (/\biss\b|space\s*station/.test(t)) kinds.add("iss_pass");
  if (/planet|jupiter|saturn|conjunction/.test(t)) {
    kinds.add("planetary_conjunction");
  }
  if (/comet/.test(t)) kinds.add("comet");
  return [...kinds];
}

function lexicalQuery(q: string) {
  const kinds = kindsForQuery(q);
  const should: object[] = [
    {
      multi_match: {
        query: q,
        fields: ["title^4", "searchBlob^2", "photoTip"],
        fuzziness: "AUTO",
        operator: "or",
      },
    },
    {
      match_phrase: {
        title: {
          query: q,
          boost: 6,
          slop: 2,
        },
      },
    },
  ];

  if (kinds.length > 0) {
    should.push({
      terms: {
        kind: kinds,
        boost: 8,
      },
    });
  }

  return {
    bool: {
      should,
      minimum_should_match: 1,
    },
  };
}

/**
 * Hybrid search over celestial-events (Elastic track):
 * RRF(BM25 lexical + semantic summary) → Jina text_similarity_reranker.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (!q) {
      return Response.json(
        { error: "Missing required query parameter q." },
        { status: 400 }
      );
    }

    const size = Math.min(
      30,
      Math.max(1, Number(searchParams.get("size") ?? "15"))
    );

    const client = createElasticClient();
    const result = await client.search<EsCelestialEventDoc>({
      index: CELESTIAL_EVENTS_INDEX,
      size,
      retriever: {
        text_similarity_reranker: {
          retriever: {
            rrf: {
              retrievers: [
                {
                  standard: {
                    query: lexicalQuery(q),
                  },
                },
                {
                  standard: {
                    query: {
                      semantic: {
                        field: "summary",
                        query: q,
                      },
                    },
                  },
                },
              ],
              rank_window_size: 50,
              rank_constant: 20,
            },
          },
          field: "summary",
          inference_id: JINA_RERANKER_INFERENCE_ID,
          inference_text: q,
          rank_window_size: 30,
        },
      },
    });

    // Prefer docs that the lexical stage can justify (kind/title/tip),
    // then fill with strong semantic/rerank hits.
    const kinds = new Set(kindsForQuery(q));
    const qTokens = q
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);

    const events = result.hits.hits
      .map((hit, i) => {
        const doc = hit._source;
        if (!doc) return null;
        return docToEvent(doc, hit._score ?? 1 / (i + 1));
      })
      .filter((e): e is RankedCelestialEvent => e != null)
      .filter((e) => {
        // If the query maps to known kinds, keep those only (avoids
        // "meteor shower" also matching new-moon tips that mention meteors).
        if (kinds.size > 0) return kinds.has(e.kind);
        const blob = `${e.title} ${e.summary} ${e.photoTip}`.toLowerCase();
        return qTokens.some((t) => blob.includes(t));
      })
      .sort((a, b) => b.sortScore - a.sortScore);

    return Response.json({
      query: q,
      count: events.length,
      events,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search events";
    console.error("[search-events]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
