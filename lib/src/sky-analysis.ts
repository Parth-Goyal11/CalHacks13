import { generateText } from "ai";
import { z } from "zod";
import { alignAnalysisToCatalog } from "./align-figures";
import { createGrokClient } from "./grok";
import { buildSkyLocationContext } from "./sky-context";
import { catalogPromptBlock } from "./star-catalog";
import { scoreSkyAnalysis, type ScoreResult } from "./sky-score";

/** Normalized image coords: (0,0) top-left → (1,1) bottom-right. */
export const skyStarSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  brightness: z.number().min(0).max(1).optional(),
});

export const skyLineSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const skyFigureSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum([
    "constellation",
    "asterism",
    "planet",
    "star",
    "moon",
    "satellite",
    "galaxy",
    "meteor",
    "other",
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  description: z.string(),
  mythology: z.string().optional(),
  labelX: z.number().min(0).max(1),
  labelY: z.number().min(0).max(1),
  stars: z.array(skyStarSchema),
  lines: z.array(skyLineSchema),
});

export const skyAnalysisSchema = z.object({
  headline: z.string(),
  overview: z.string(),
  skyConditions: z.string().optional(),
  /** Empty is allowed — model may honestly find nothing in-frame. */
  figures: z.array(skyFigureSchema).default([]),
});

export type SkyStar = z.infer<typeof skyStarSchema>;
export type SkyLine = z.infer<typeof skyLineSchema>;
export type SkyFigure = z.infer<typeof skyFigureSchema>;
export type SkyAnalysis = z.infer<typeof skyAnalysisSchema>;

export interface SkyCaptureMeta {
  latitude: number;
  longitude: number;
  takenAt: string;
  locationLabel?: string;
  facingDegrees?: number;
  notes?: string;
}

/** Fast non-reasoning model with image input. Override via SKY_VISION_MODEL. */
export const VISION_MODEL: string =
  (typeof process !== "undefined" && process.env.SKY_VISION_MODEL) ||
  "grok-4.20-0309-non-reasoning";

const ANALYSIS_TIMEOUT_MS = 70_000;
const MIN_CONFIDENCE = 0.4;

function buildPrompt(meta: SkyCaptureMeta): string {
  const sky = buildSkyLocationContext(meta);
  const alignDb = catalogPromptBlock(sky.visible.map((v) => v.name));

  return `Night-sky photo identification for OrbitQuest. The image may be contrast-stretched so fainter stars are visible — mark them too.

${sky.promptBlock}

${alignDb}

RULES:
1. Mark every star/planet you can SEE as a pixel, including fainter ones (roughly mag ≤ 3.5). Put x,y on those pixels (0=left/top, 1=right/bottom). Set brightness 0–1 from how bright it looks.
2. LOCATION + ALIGNMENT DB are PRIMARY FOR NAMING: when a pattern matches, use the catalog star names and classic lines exactly. Include ALL catalog stars that are visible — not just the brightest 3.
3. Still photo-grounded: do NOT invent stars that are not points in the image. If a prior figure is not recognizable, omit it.
4. Prefer 3–8 figures when the sky is rich. Include lone bright stars/planets as kind "star"/"planet".
5. Constellation/asterism: ≥3 visible stars + classic lines[] between listed star ids (use alignment DB topology).
6. Star ids should be stable short slugs (e.g. "betelgeuse"); names are classic proper names.
7. confidence < 0.4 → omit. Short text. overview must mention location/time guidance.

Return ONLY JSON (no fences):
{
  "headline": string,
  "overview": string,
  "skyConditions": string,
  "figures": [
    {
      "id": string,
      "name": string,
      "kind": "constellation"|"asterism"|"planet"|"star"|"moon"|"satellite"|"galaxy"|"meteor"|"other",
      "confidence": 0-1,
      "summary": string,
      "description": string,
      "mythology": string,
      "labelX": 0-1,
      "labelY": 0-1,
      "stars": [{"id": string, "name": string, "x": 0-1, "y": 0-1, "brightness"?: 0-1}],
      "lines": [{"from": string, "to": string}]
    }
  ]
}`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Grok did not return JSON. Try again with a clearer sky photo.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out after ${Math.round(ms / 1000)}s. Retry, or set SKY_VISION_MODEL.`
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Drop weak guesses and illegal lines; keep labels on real star centroids. */
function sanitize(analysis: SkyAnalysis): SkyAnalysis {
  const figures: SkyFigure[] = [];

  for (const fig of analysis.figures) {
    if (fig.confidence < MIN_CONFIDENCE) continue;

    const stars = fig.stars
      .filter(
        (s) =>
          Number.isFinite(s.x) &&
          Number.isFinite(s.y) &&
          s.x >= 0 &&
          s.x <= 1 &&
          s.y >= 0 &&
          s.y <= 1
      )
      .map((s, i) => ({
        ...s,
        id: s.id || `${fig.id}-s${i}`,
        name: s.name?.trim() || s.id || `Star ${i + 1}`,
        x: Math.min(1, Math.max(0, s.x)),
        y: Math.min(1, Math.max(0, s.y)),
      }));

    if (stars.length === 0) continue;

    let kind = fig.kind;
    let name = fig.name;
    // Keep partial patterns as named stars instead of dropping them.
    if (
      (kind === "constellation" || kind === "asterism") &&
      stars.length < 3
    ) {
      kind = "star";
      name = stars[0]?.name ?? fig.name;
    }

    const ids = new Set(stars.map((s) => s.id));
    const lines =
      kind === "constellation" || kind === "asterism"
        ? fig.lines
            .filter((l) => ids.has(l.from) && ids.has(l.to) && l.from !== l.to)
            .slice(0, Math.max(stars.length, 1) * 3)
        : [];

    const labelX = stars.reduce((a, s) => a + s.x, 0) / stars.length;
    const labelY = stars.reduce((a, s) => a + s.y, 0) / stars.length;

    figures.push({
      ...fig,
      kind,
      name,
      stars,
      lines,
      labelX,
      labelY,
    });
  }

  if (figures.length === 0) {
    figures.push({
      id: "none-confident",
      name: "Nothing clearly identified",
      kind: "other",
      confidence: 0.4,
      summary:
        "No constellation or object could be matched confidently to bright points in this photo.",
      description:
        analysis.overview ||
        "Something may be above the horizon from this location, but it was not clearly recognizable in the frame.",
      labelX: 0.5,
      labelY: 0.12,
      stars: [],
      lines: [],
    });
  }

  return {
    headline: analysis.headline,
    overview: analysis.overview,
    skyConditions: analysis.skyConditions,
    figures,
  };
}

export interface SkyAnalysisWithScore {
  analysis: SkyAnalysis;
  /** Coded score / rarity / award points (never returned by the model). */
  score: ScoreResult;
}

/**
 * Single-pass vision analysis — photo-first rules, fast model.
 * SpaceXAI track: Grok vision for celestial figure detection.
 * Points / rarity are computed in sky-score.ts after sanitize.
 */
export async function analyzeNightSky(options: {
  imageBase64: string;
  mimeType?: string;
  meta: SkyCaptureMeta;
  model?: string;
}): Promise<SkyAnalysisWithScore> {
  const xai = createGrokClient();
  const modelId = options.model ?? VISION_MODEL;
  const model = xai(modelId);
  const mimeType = options.mimeType ?? "image/jpeg";
  const base64 = options.imageBase64.startsWith("data:")
    ? options.imageBase64.slice(options.imageBase64.indexOf(",") + 1)
    : options.imageBase64;

  console.log(`[sky-analysis] ${modelId}…`);
  const started = Date.now();

  const result = await withTimeout(
    generateText({
      model,
      maxTokens: 3200,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(options.meta) },
            { type: "image", image: base64, mimeType },
          ],
        },
      ],
    }),
    ANALYSIS_TIMEOUT_MS,
    "Sky analysis"
  );

  console.log(`[sky-analysis] done in ${Date.now() - started}ms`);

  const raw = extractJson(result.text) as Record<string, unknown>;
  // Models sometimes omit figures entirely when unsure
  if (!Array.isArray(raw.figures)) raw.figures = [];
  const parsed = skyAnalysisSchema.parse(raw);
  const sanitized = sanitize(parsed);
  const { analysis, alignments } = alignAnalysisToCatalog(sanitized);
  const score = scoreSkyAnalysis(analysis, options.meta, { alignments });
  console.log(
    `[sky-analysis] figures=${analysis.figures.length} aligned=${alignments.filter((a) => a.linesCorrected).length} figurePts=${score.figurePointsTotal}`
  );
  return { analysis, score };
}

/** Deeper Grok narration when the user taps a figure. */
export async function explainSkyFigure(options: {
  figure: Pick<SkyFigure, "name" | "kind" | "summary" | "description">;
  meta: SkyCaptureMeta;
  question?: string;
}): Promise<string> {
  const xai = createGrokClient();
  const model = xai(
    process.env.SKY_CHAT_MODEL || "grok-4.20-0309-non-reasoning"
  );

  const { text } = await withTimeout(
    generateText({
      model,
      maxTokens: 500,
      system:
        "Careful night-sky guide. Do not invent certainty. 2–3 short paragraphs. No markdown headings.",
      prompt: `Observer lat ${options.meta.latitude}, lon ${options.meta.longitude}, photo ${options.meta.takenAt}.
Figure: ${options.figure.name} (${options.figure.kind}).
${options.figure.summary}
${options.figure.description}

User: ${options.question ?? "What might I be looking at? What should I not over-claim?"}`,
    }),
    35_000,
    "Figure detail"
  );

  return text;
}
