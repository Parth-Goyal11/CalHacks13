import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { explainSkyFigure, type SkyFigure } from "@calhacks13/lib";
import { ApiInputError, inputErrorResponse, isCaptureMeta, readJsonBody } from "@/lib/api-input";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

const KINDS = new Set(["constellation", "asterism", "planet", "star", "moon", "satellite", "galaxy", "meteor", "other"]);

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 32 * 1024);
    const figure = body.figure as Record<string, unknown> | null;
    if (!figure || typeof figure !== "object" || Array.isArray(figure) ||
        typeof figure.name !== "string" || !figure.name.trim() || figure.name.length > 180 ||
        typeof figure.kind !== "string" || !KINDS.has(figure.kind) ||
        typeof figure.summary !== "string" || figure.summary.length > 4000 ||
        typeof figure.description !== "string" || figure.description.length > 8000 ||
        !isCaptureMeta(body.meta) ||
        (body.question !== undefined && (typeof body.question !== "string" || body.question.length > 2000))) {
      throw new ApiInputError("Send a valid sky object, photo metadata and question.");
    }
    const text = await explainSkyFigure({
      figure: figure as Pick<SkyFigure, "name" | "kind" | "summary" | "description">,
      meta: body.meta,
      question: body.question as string | undefined,
    });
    return Response.json({ text });
  } catch (error) {
    const invalid = inputErrorResponse(error);
    if (invalid) return invalid;
    console.error("[figure-detail]", error);
    const status = error instanceof Error && error.message.includes("XAI_API_KEY") ? 503 : 500;
    return Response.json({ error: "Could not load more details. Please try again." }, { status });
  }
}
