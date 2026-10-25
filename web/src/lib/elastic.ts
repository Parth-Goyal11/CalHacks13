import { Client } from "@elastic/elasticsearch";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

export const CELESTIAL_EVENTS_INDEX = "celestial-events";

export const JINA_EMBEDDINGS_INFERENCE_ID = ".jina-embeddings-v5-text-small";
export const JINA_RERANKER_INFERENCE_ID = ".jina-reranker-v3.5";

let cached: Client | null = null;

export function createElasticClient(): Client {
  if (cached) return cached;

  const node = process.env.ELASTIC_URL;
  const apiKey = process.env.ELASTIC_API_KEY;

  if (!node || !apiKey) {
    throw new Error(
      "ELASTIC_URL and ELASTIC_API_KEY must be set. Copy .env.example to .env."
    );
  }

  cached = new Client({
    node,
    auth: { apiKey },
  });
  return cached;
}

/** Raw document stored in celestial-events. */
export interface EsCelestialEventDoc {
  id: string;
  kind: string;
  title: string;
  summary: string;
  searchBlob?: string;
  startsAt: string;
  endsAt: string;
  rarity: string;
  rarityRank?: number;
  points: number;
  location?: { lat: number; lon: number };
  locationLabel?: string;
  globalVisibility?: boolean;
  visibilityRadiusKm?: number;
  source: string;
  photoTip: string;
}
