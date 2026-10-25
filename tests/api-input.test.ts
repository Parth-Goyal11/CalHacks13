/** Offline request-boundary checks; provider calls are intercepted locally. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POST as analyze } from "../web/src/app/api/analyze-sky/route";
import { POST as detail } from "../web/src/app/api/figure-detail/route";
import { POST as creature } from "../web/src/app/api/creature/route";
import { ApiInputError, decodeSkyImage, readJsonBody } from "../web/src/lib/api-input";

const meta = { latitude: 37.87, longitude: -122.27, takenAt: "2026-10-25T05:00:00Z" };
const figure = { name: "Orion", kind: "constellation", summary: "A winter pattern.", description: "A recognizable belt of stars." };
const jpeg = readFileSync(new URL("./fixtures/sharp_orion.jpg", import.meta.url));
const imageBase64 = jpeg.toString("base64");
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("http://localhost/api/test", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});

async function main() {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.XAI_API_KEY;
  const originalLog = console.error;
  let providerCalls = 0;
  process.env.XAI_API_KEY = "offline-test-placeholder";
  globalThis.fetch = async () => {
    providerCalls += 1;
    return Response.json({ code: "bad_request", error: "private-provider-detail" }, { status: 400 });
  };
  console.error = () => undefined;
  try {
    for (const route of [analyze, detail, creature]) {
      assert.equal((await route(new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).status, 400);
      assert.equal((await route(request({}, { "content-type": "text/plain" }))).status, 415);
      assert.equal((await route(request([]))).status, 400);
    }
    for (const [route, limit] of [[analyze, 12 * 1024 * 1024], [detail, 32 * 1024], [creature, 16 * 1024]] as const) {
      assert.equal((await route(request({}, { "content-length": String(limit + 1) }))).status, 413);
    }
    // Byte limits apply to chunked bodies before JSON parsing, not just Content-Length.
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(64).fill(32)); },
      cancel() { cancelled = true; },
    });
    const chunked = new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit & { duplex: string });
    await assert.rejects(() => readJsonBody(chunked, 100), (error: unknown) => error instanceof ApiInputError && error.status === 413);
    assert.equal(cancelled, true, "Stop reading an oversized stream");
    const exactBody = '{"name":"é"}';
    assert.deepEqual(await readJsonBody(new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: exactBody }), Buffer.byteLength(exactBody)), { name: "é" });
    await assert.rejects(() => readJsonBody(new Request("http://localhost/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: exactBody }), exactBody.length), (error: unknown) => error instanceof ApiInputError && error.status === 413);

    assert.deepEqual(Buffer.from(decodeSkyImage(imageBase64, "image/jpeg").imageBytes), jpeg);
    assert.deepEqual(Buffer.from(decodeSkyImage(`data:image/jpeg;base64,${imageBase64}`, "image/jpeg").imageBytes), jpeg);
    for (const invalid of ["https://example.com/image?" + "a".repeat(600), "!".repeat(600), "A".repeat(599), Buffer.from("not an image".repeat(100)).toString("base64"), `data:image/png;base64,${imageBase64}`]) {
      assert.equal((await analyze(request({ imageBase64: invalid, mimeType: "image/jpeg", meta }))).status, 400);
    }
    assert.equal((await analyze(request({ imageBase64, mimeType: "image/svg+xml", meta }))).status, 415);
    assert.equal((await analyze(request({ imageBase64, mimeType: "image/png", meta }))).status, 400);
    assert.equal((await analyze(request({ imageBase64, meta: { ...meta, latitude: 91 } }))).status, 400);
    for (const patch of [{ figure: { ...figure, name: "x".repeat(181) } }, { figure: { ...figure, kind: "invalid" } }, { figure: { ...figure, summary: [] } }, { figure: { ...figure, description: "x".repeat(8001) } }, { meta: { ...meta, notes: [] } }, { question: "x".repeat(2001) }]) {
      assert.equal((await detail(request({ figure, meta, ...patch }))).status, 400);
    }
    assert.equal((await creature(request({ name: "Orion", tier: "invalid" }))).status, 400);
    assert.equal(providerCalls, 0, "Invalid input never invokes the paid provider");

    // A provider failure must not expose its private message to the browser.
    const failed = await detail(request({ figure, meta }));
    assert.equal(failed.status, 500);
    assert.equal(JSON.stringify(await failed.json()).includes("private-provider-detail"), false);
    assert.equal(providerCalls, 1);
    console.log("API boundary checks passed: byte limits, malformed requests, image bytes, metadata/figure validation, no paid calls on invalid input, and generic provider errors.");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalLog;
    if (originalKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
