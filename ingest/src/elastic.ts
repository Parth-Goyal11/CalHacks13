import { Client } from "@elastic/elasticsearch";

/** Elastic track — celestial event catalog for mission board + semantic search. */
export const CELESTIAL_EVENTS_INDEX = "celestial-events";

const JINA_EMBEDDINGS_INFERENCE_ID = ".jina-embeddings-v5-text-small";

export function createElasticClient() {
  const node = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!node || !apiKey) {
    throw new Error(
      "ELASTIC_URL and ELASTIC_API_KEY must be set. Copy .env.example to .env."
    );
  }

  return new Client({
    node,
    auth: { apiKey },
  });
}

export async function ensureCelestialEventsIndex(
  client: Client,
  opts?: { recreate?: boolean }
) {
  const exists = await client.indices.exists({ index: CELESTIAL_EVENTS_INDEX });
  if (exists && opts?.recreate) {
    await client.indices.delete({ index: CELESTIAL_EVENTS_INDEX });
  } else if (exists) {
    return;
  }

  await client.indices.create({
    index: CELESTIAL_EVENTS_INDEX,
    mappings: {
      properties: {
        id: { type: "keyword" },
        kind: { type: "keyword" },
        rarity: { type: "keyword" },
        rarityRank: { type: "integer" },
        points: { type: "integer" },
        title: { type: "text" },
        summary: {
          type: "semantic_text",
          inference_id: JINA_EMBEDDINGS_INFERENCE_ID,
        },
        searchBlob: { type: "text" },
        photoTip: { type: "text" },
        startsAt: { type: "date" },
        endsAt: { type: "date" },
        location: { type: "geo_point" },
        locationLabel: { type: "keyword" },
        globalVisibility: { type: "boolean" },
        visibilityRadiusKm: { type: "float" },
        source: { type: "keyword" },
      },
    },
  });
}

/** Drop legacy demo index if present (replaced by celestial-events). */
export async function deleteLegacySpaceEventsIndex(client: Client) {
  const legacy = "space-events";
  const exists = await client.indices.exists({ index: legacy });
  if (exists) {
    await client.indices.delete({ index: legacy });
    console.log(`Deleted legacy index ${legacy}.`);
  }
}
