import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createElasticClient,
  ensureSpaceEventsIndex,
  SPACE_EVENTS_INDEX,
} from "./elastic.js";
import { fetchSpaceEvents } from "./fetch-events.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(root, ".env") });

async function main() {
  const events = await fetchSpaceEvents();
  console.log(`Fetched ${events.length} space event(s).`);

  const client = createElasticClient();
  await ensureSpaceEventsIndex(client);

  const operations = events.flatMap((event) => [
    { index: { _index: SPACE_EVENTS_INDEX, _id: event.id } },
    event,
  ]);

  const result = await client.bulk({ refresh: true, operations });

  if (result.errors) {
    const failed = result.items.filter((item) => item.index?.error);
    console.error("Bulk index had errors:", JSON.stringify(failed, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(`Indexed ${events.length} document(s) into ${SPACE_EVENTS_INDEX}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
