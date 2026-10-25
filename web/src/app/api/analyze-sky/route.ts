import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { analyzeNightSky } from "@calhacks13/lib";
import { ApiInputError, decodeSkyImage, inputErrorResponse, isCaptureMeta, readJsonBody } from "@/lib/api-input";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 12 * 1024 * 1024);
    if (!isCaptureMeta(body.meta)) throw new ApiInputError("Valid photo location, time and optional camera angles are required.");
    const { imageBytes, mimeType } = decodeSkyImage(body.imageBase64, body.mimeType);
    const { analysis, score, verification, prediction, fovCheck } = await analyzeNightSky({ imageBytes, mimeType, meta: body.meta });
    return Response.json({ analysis, score, verification, prediction, fovCheck });
  } catch (error) {
    const invalid = inputErrorResponse(error);
    if (invalid) return invalid;
    console.error("[analyze-sky]", error);
    const status = error instanceof Error && error.message.includes("XAI_API_KEY") ? 503 : 500;
    return Response.json({ error: status === 503 ? "XAI_API_KEY is not configured." : "Sky analysis failed. Please try again." }, { status });
  }
}
