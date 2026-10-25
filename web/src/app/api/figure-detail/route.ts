import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { explainSkyFigure, type SkyCaptureMeta, type SkyFigure } from "@calhacks13/lib";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

interface DetailBody {
  figure: Pick<SkyFigure, "name" | "kind" | "summary" | "description">;
  meta: SkyCaptureMeta;
  question?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DetailBody;
    if (!body?.figure?.name || !body?.meta) {
      return Response.json({ error: "figure and meta are required" }, { status: 400 });
    }

    const text = await explainSkyFigure({
      figure: body.figure,
      meta: body.meta,
      question: body.question,
    });

    return Response.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detail request failed";
    console.error("[figure-detail]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
