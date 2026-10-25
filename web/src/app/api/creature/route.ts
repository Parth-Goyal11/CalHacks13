import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { grok } from "@calhacks13/lib";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

const TIERS = new Set(["F", "E", "D", "C", "B", "A"]);

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Send a JSON pattern name." }, { status: 415 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    motif?: unknown;
    tier?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const motif = typeof body?.motif === "string" ? body.motif.trim().slice(0, 80) : "";
  const tier = typeof body?.tier === "string" && TIERS.has(body.tier) ? body.tier : "";
  if (!name || !tier) {
    return Response.json({ error: "Name a pattern and a tier." }, { status: 400 });
  }
  if (!process.env.XAI_API_KEY) {
    return Response.json(
      { error: "The creature model needs an xAI API key on the server." },
      { status: 503 },
    );
  }
  const prompt = [
    `A single original fantasy creature inspired by the star pattern ${name}`,
    motif ? `, known as ${motif}` : "",
    ". Collectible 3D character model, studio render, three-quarter view,",
    " dark background, clay and starlight, no text, no letters, no watermark, no logo.",
  ].join("");
  try {
    const image = await grok.imagine(prompt);
    return Response.json(image);
  } catch {
    return Response.json(
      { error: "Grok Imagine did not return a creature model." },
      { status: 502 },
    );
  }
}
