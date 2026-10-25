import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createElasticClient,
  ensureCelestialEventsIndex,
  deleteLegacySpaceEventsIndex,
  CELESTIAL_EVENTS_INDEX,
} from "./elastic.js";
import { fetchCelestialEventsForIndex } from "./fetch-events.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(root, ".env") });

async function main() {
  const events = await fetchCelestialEventsForIndex();
  console.log(`Fetched ${events.length} celestial event(s) (90d, no observer).`);

  const client = createElasticClient();
  await deleteLegacySpaceEventsIndex(client);
  // Recreate so mapping stays in sync (e.g. searchBlob for BM25).
  await ensureCelestialEventsIndex(client, { recreate: true });

  if (events.length === 0) {
    console.warn("Nothing to index.");
    return;
  }

  const operations = events.flatMap((event) => [
    { index: { _index: CELESTIAL_EVENTS_INDEX, _id: event.id } },
    event,
  ]);

  const result = await client.bulk({ refresh: true, operations });

  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error);
    console.error("Bulk index had errors:", JSON.stringify(failed, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Indexed ${events.length} document(s) into ${CELESTIAL_EVENTS_INDEX}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
