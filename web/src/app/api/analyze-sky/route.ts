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

    const { analysis, score, verification } = await analyzeNightSky({
      imageBase64: raw,
      mimeType: body.mimeType ?? "image/jpeg",
      meta: body.meta,
    });

    return Response.json({ analysis, score, verification });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze-sky]", err);
    const status = message.includes("XAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
