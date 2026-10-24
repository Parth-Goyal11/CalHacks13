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
    Number.isFinite(m.longitude)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeBody;

    if (!body?.imageBase64 || typeof body.imageBase64 !== "string") {
      return Response.json({ error: "imageBase64 is required" }, { status: 400 });
    }
    if (!isValidMeta(body.meta)) {
      return Response.json(
        { error: "meta.latitude, meta.longitude, and meta.takenAt are required" },
        { status: 400 }
      );
    }

    const analysis = await analyzeNightSky({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      meta: body.meta,
    });

    return Response.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze-sky]", err);
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
