import { generateText } from "ai";
import { z } from "zod";
import { alignAnalysisToCatalog } from "./align-figures";
import { createGrokClient } from "./grok";
import { buildSkyLocationContext } from "./sky-context";
import {
  buildFovPrediction,
  crossCheckWithFov,
  type FovCrossCheck,
  type FovPrediction,
} from "./sky-fov";
import { catalogPromptBlock } from "./star-catalog";
import { scoreSkyAnalysis, type ScoreResult } from "./sky-score";
import {
  verifyAgainstStarDatabase,
  type VerificationReport,
} from "./verify-stars";

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
  /** Compass facing: 0=N, 90=E, 180=S, 270=W. */
  facingDegrees?: number;
  /** Camera tilt above horizon (0=horizon, 90=zenith). Default ~40. */
  elevationDegrees?: number;
  /** Horizontal field of view in degrees. Default ~70 (phone). */
  fovDegrees?: number;
  notes?: string;
}

/** Fast non-reasoning model with image input. Override via SKY_VISION_MODEL. */
export const VISION_MODEL: string =
  (typeof process !== "undefined" && process.env.SKY_VISION_MODEL) ||
  "grok-4.20-0309-non-reasoning";

const ANALYSIS_TIMEOUT_MS = 100_000;
const MIN_CONFIDENCE = 0.28;

function buildPrompt(meta: SkyCaptureMeta): string {
  const sky = buildSkyLocationContext(meta);
  const fov = buildFovPrediction(meta);
  const alignNames = [
    ...fov.inFrame.map((f) => f.name),
    ...sky.visible.map((v) => v.name),
  ];
  const alignDb = catalogPromptBlock(alignNames);

  return `EXHAUSTIVE night-sky census for OrbitQuest. Examine the photo carefully — region by region — not a quick skim. Natural photo, no assumed filters.

${sky.promptBlock}

${fov.promptBlock}

${alignDb}

CAREFUL MULTI-PASS SCAN (do all three mentally before writing JSON):
Pass A — Bright anchors: mark the brightest stars/planets you can clearly see.
Pass B — Stick-figure fill: for EACH FOV-predicted / alignment-DB figure, re-examine that region pixel-by-pixel and mark every catalog star that is a real point (mag ≲ 4.5), including faint ones. Prefer searching near predicted (x,y) when given.
Pass C — Leftovers: scan corners/edges for lone bright stars/planets not yet listed; add them as kind "star"/"planet".

RULES:
1. x,y on real pixels only (0=left/top, 1=right/bottom). brightness 0–1 from THIS photo.
2. Use LOCATION + ANGLE FOV + ALIGNMENT DB names exactly (Betelgeuse, Rigel, Dubhe…). Never stop at 3 stars if more catalog stars are visible.
3. Do NOT invent stars that are not points in the image. Omit a figure only if its pattern is truly absent. Do not force out-of-FOV predictions into the frame.
4. Aim for completeness: 5–12 figures when the sky is rich. Each constellation's stars[] should be as complete as the photo allows.
5. lines[] = classic alignment-DB segments between listed star ids only.
6. Star ids = short slugs; names = classic proper names from the DB.
7. confidence < 0.28 → omit that figure. overview: how location + facing angle guided the IDs + which expected FOV figures were missing.

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
  /** Catalog configuration match test — runs before score/UI generation. */
  verification: VerificationReport;
  /** Location + facing/elevation FOV prediction layer. */
  prediction: FovPrediction;
  /** Cross-check of verified figures vs FOV prediction. */
  fovCheck: FovCrossCheck;
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
      maxTokens: 6000,
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
  const prediction = buildFovPrediction(options.meta);
  // 1) soft align → 2) catalog geometry verify → 3) FOV cross-check → 4) score
  const { analysis: aligned, alignments } = alignAnalysisToCatalog(sanitized);
  const { analysis, verification } = verifyAgainstStarDatabase(
    aligned,
    alignments
  );
  const fovCheck = crossCheckWithFov(analysis, prediction);
  const score = scoreSkyAnalysis(analysis, options.meta, { alignments });
  console.log(
    `[sky-analysis] verified=${verification.acceptedStars.length} rejected=${verification.rejectedStars.length} fovIn=${prediction.inFrame.length} fovMiss=${fovCheck.expectedMissing.length} figurePts=${score.figurePointsTotal}`
  );
  return { analysis, score, verification, prediction, fovCheck };
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
