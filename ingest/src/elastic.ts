import { Client } from "@elastic/elasticsearch";

export const SPACE_EVENTS_INDEX = "space-events";

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

export async function ensureSpaceEventsIndex(client: Client) {
  const exists = await client.indices.exists({ index: SPACE_EVENTS_INDEX });
  if (exists) return;

  await client.indices.create({
    index: SPACE_EVENTS_INDEX,
    mappings: {
      properties: {
        id: { type: "keyword" },
        type: { type: "keyword" },
        title: { type: "text" },
        description: { type: "text" },
        startsAt: { type: "date" },
        endsAt: { type: "date" },
        location: { type: "geo_point" },
        source: { type: "keyword" },
        raw: { type: "object", enabled: false },
      },
    },
  });
}
