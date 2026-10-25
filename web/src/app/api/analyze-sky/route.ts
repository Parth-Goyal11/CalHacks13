import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { analyzeNightSky, type SkyCaptureMeta } from "@calhacks13/lib";

// Monorepo root .env when running `next` from /web
loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

interface AnalyzeBody {
  imageBase64: string;
  mimeType?: string;
  meta: SkyCaptureMeta;
}

function isValidMeta(meta: unknown): meta is SkyCaptureMeta {
  if (!meta || typeof meta !== "object") return false;
  const m = meta as Record<string, unknown>;
  return (
    typeof m.latitude === "number" &&
    typeof m.longitude === "number" &&
    typeof m.takenAt === "string" &&
    Number.isFinite(m.latitude) &&
    Number.isFinite(m.longitude) &&
    Math.abs(m.latitude) <= 90 &&
    Math.abs(m.longitude) <= 180 &&
    Number.isFinite(Date.parse(m.takenAt)) &&
    [ ["facingDegrees", 0, 360], ["elevationDegrees", 0, 90], ["fovDegrees", 1, 180] ].every(([key, min, max]) => {
      const value = m[key as string];
      return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= (min as number) && value <= (max as number));
    })
  );
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Send a JSON image and capture metadata." }, { status: 415 });
  }
  // The client resizes to 1280px; guard direct callers before a paid model call.
  const rawBody = await request.text();
  if (rawBody.length > 12 * 1024 * 1024) return Response.json({ error: "Image request is too large." }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  try {
    const body = parsed as AnalyzeBody;

    if (!body?.imageBase64 || typeof body.imageBase64 !== "string") {
      return Response.json({ error: "imageBase64 is required" }, { status: 400 });
    }
    if (!isValidMeta(body.meta)) {
      return Response.json(
        { error: "meta.latitude, meta.longitude, and meta.takenAt are required" },
        { status: 400 }
      );
    }

    const raw = body.imageBase64.includes(",")
      ? body.imageBase64.slice(body.imageBase64.indexOf(",") + 1)
      : body.imageBase64;
    if (raw.length < 500) {
      return Response.json(
        { error: "imageBase64 looks empty or too small — re-upload the photo." },
        { status: 400 }
      );
    }

    console.log(
      `[analyze-sky] imageBytes≈${Math.round((raw.length * 3) / 4)} mime=${body.mimeType ?? "image/jpeg"} → Grok`
    );

    const { analysis, score, verification, prediction, fovCheck } =
      await analyzeNightSky({
        imageBase64: raw,
        mimeType: body.mimeType ?? "image/jpeg",
        meta: body.meta,
      });

    return Response.json({
      analysis,
      score,
      verification,
      prediction,
      fovCheck,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze-sky]", err);
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return Response.json({ error: status === 503 ? "XAI_API_KEY is not configured." : "Sky analysis failed. Please try again." }, { status });
  }
}
