import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { creatureFromObject } from "../web/src/components/yonder/collection";
import { collectOne, readCreature, saveCreatureImage } from "../web/src/components/yonder/memory-store";

async function main() {
  const base = creatureFromObject({ id: "orion", name: "Orion", kind: "constellation", detail: "", highlightPoints: 1 })!;
  const upgraded = creatureFromObject({ id: "orion", name: "Orion", kind: "constellation", detail: "", highlightPoints: 32 })!;
  const oldImage = new Blob(["old-tier portrait"], { type: "image/png" });
  const newImage = new Blob(["new-tier portrait"], { type: "image/png" });

  await collectOne(base);
  await saveCreatureImage(base, oldImage);
  assert.equal(await (await readCreature(base.id))?.image?.text(), "old-tier portrait");
  await collectOne(upgraded);
  assert.equal((await readCreature(base.id))?.tier, "S");
  assert.equal((await readCreature(base.id))?.image, undefined, "An upgrade must invalidate the previous tier's portrait");

  await saveCreatureImage(base, oldImage);
  assert.equal((await readCreature(base.id))?.image, undefined, "Late lower-tier generation must not populate the upgraded cache");
  await saveCreatureImage(upgraded, newImage);
  await collectOne(base);
  assert.equal((await readCreature(base.id))?.tier, "S", "An older catch must not downgrade a creature");
  assert.equal(await (await readCreature(base.id))?.image?.text(), "new-tier portrait");

  for (let index = 0; index < 8; index++) {
    const low = { ...base, id: `concurrent-${index}` };
    const high = { ...upgraded, id: low.id };
    await collectOne(low);
    await Promise.all(index % 2
      ? [collectOne(high), saveCreatureImage(low, oldImage)]
      : [saveCreatureImage(low, oldImage), collectOne(high)]);
    const stored = await readCreature(low.id);
    assert.equal(stored?.tier, "S", "Concurrent image writes must not overwrite the new tier");
    assert.equal(stored?.image, undefined, "The upgraded tier must await its own portrait");
  }
  console.log("Yonder memory regression passed: tier upgrades, stale portrait rejection, and concurrent cache writes.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
