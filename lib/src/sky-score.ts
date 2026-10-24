/**
 * Score, subject bonus, rarity, and award points.
 * Mirrors sky_photo/score.py / docs/sky-photo-design.md.
 * The vision model never returns score/rarity/points — only this module does.
 */

import type { FigureAlignment } from "./align-figures";
import type { SkyAnalysis, SkyCaptureMeta, SkyFigure } from "./sky-analysis";

export type RarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

export type IdentityMethod = "plate-solved" | "model-estimate";

export type SubjectKey =
  | "plate_solved_star_field"
  | "naked_eye_deep_sky"
  | "milky_way_core"
  | "planet_moon_or_pair"
  | "satellite_logged_pass"
  | "meteor_streak"
  | "aurora_below_50_lat"
  | "naked_eye_comet"
  | "iss_crossing_moon_or_sun";

export const WEIGHT_CLARITY = 0.25;
export const WEIGHT_TRACKING = 0.2;
export const WEIGHT_EXPOSURE = 0.15;
export const WEIGHT_NOISE = 0.1;
export const WEIGHT_FRAMING = 0.2;
export const WEIGHT_CONDITIONS = 0.1;

/** Rubric weights for UI / explainability (must sum to 1). */
export const RUBRIC_WEIGHTS = {
  clarity: WEIGHT_CLARITY,
  tracking: WEIGHT_TRACKING,
  exposure: WEIGHT_EXPOSURE,
  noise: WEIGHT_NOISE,
  framing: WEIGHT_FRAMING,
  conditions: WEIGHT_CONDITIONS,
} as const;

/** Final-score → rarity thresholds (before caps). */
export const RARITY_THRESHOLDS: { min: number; rarity: RarityName }[] = [
  { min: 90, rarity: "Legendary" },
  { min: 75, rarity: "Epic" },
  { min: 60, rarity: "Rare" },
  { min: 45, rarity: "Uncommon" },
  { min: 0, rarity: "Common" },
];

export const SUBJECT_BONUS: Record<SubjectKey, number> = {
  plate_solved_star_field: 0,
  naked_eye_deep_sky: 8,
  milky_way_core: 10,
  planet_moon_or_pair: 10,
  satellite_logged_pass: 15,
  meteor_streak: 15,
  aurora_below_50_lat: 20,
  naked_eye_comet: 25,
  iss_crossing_moon_or_sun: 30,
};

export const AWARD_POINTS: Record<RarityName, number> = {
  Common: 5,
  Uncommon: 10,
  Rare: 20,
  Epic: 35,
  Legendary: 60,
};

const TIER_ORDER: RarityName[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
];

const CAP_MODEL_ESTIMATE: RarityName = "Rare";
const CAP_NO_EXIF_TIME: RarityName = "Uncommon";

const DEEP_SKY_HINTS = [
  "pleiades",
  "m45",
  "andromeda",
  "m31",
  "orion nebula",
  "m42",
];

export interface AwardResult {
  badge: string;
  points: number;
  cardFoil: string | null;
}

/** Points earned for one identified figure (constellation / object). */
export interface FigureAward {
  figureId: string;
  figureName: string;
  kind: string;
  starsIdentified: number;
  catalogStars: number;
  catalogMatched: number;
  alignmentScore: number | null;
  points: number;
  breakdown: string[];
  missingCatalogStars: string[];
}

export interface ScoreResult {
  score: number | null;
  subjectBonus: number | null;
  finalScore: number | null;
  /** Tier from finalScore before identity/EXIF caps. */
  uncappedRarity: RarityName | null;
  rarity: RarityName | null;
  award: AwardResult | null;
  subjects: SubjectKey[];
  identityMethod: IdentityMethod | null;
  hasExifTime: boolean | null;
  /** Human-readable reasons a cap lowered rarity (empty if none). */
  capNotes: string[];
  /** Per-constellation / object find points. */
  figureAwards: FigureAward[];
  /** Sum of figureAwards.points. */
  figurePointsTotal: number;
  /** Rubric ints used for the weighted quality score (0–10). */
  rubric: {
    clarity: number;
    tracking: number;
    exposure: number;
    noise: number;
    framing: number;
    conditions: number;
  } | null;
}

function clampInt(n: number, lo = 0, hi = 10): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function weightedScore(
  clarity: number,
  tracking: number,
  exposure: number,
  noise: number,
  framing: number,
  conditions: number
): number {
  const weighted =
    WEIGHT_CLARITY * clarity +
    WEIGHT_TRACKING * tracking +
    WEIGHT_EXPOSURE * exposure +
    WEIGHT_NOISE * noise +
    WEIGHT_FRAMING * framing +
    WEIGHT_CONDITIONS * conditions;
  return Math.round((100 * weighted) / 10);
}

export function subjectBonusFor(subjects: Iterable<string>): number {
  let best = 0;
  for (const key of subjects) {
    if (!(key in SUBJECT_BONUS)) {
      throw new Error(`Unknown subject bonus key: ${key}`);
    }
    best = Math.max(best, SUBJECT_BONUS[key as SubjectKey]);
  }
  return best;
}

export function tierForFinalScore(finalScore: number): RarityName {
  if (finalScore < 45) return "Common";
  if (finalScore < 60) return "Uncommon";
  if (finalScore < 75) return "Rare";
  if (finalScore < 90) return "Epic";
  return "Legendary";
}

function tierIndex(tier: RarityName): number {
  return TIER_ORDER.indexOf(tier);
}

export function applyCaps(
  tier: RarityName,
  opts: { identityMethod: IdentityMethod; hasExifTime: boolean }
): RarityName {
  let capped = tier;
  if (
    opts.identityMethod === "model-estimate" &&
    tierIndex(capped) > tierIndex(CAP_MODEL_ESTIMATE)
  ) {
    capped = CAP_MODEL_ESTIMATE;
  }
  if (
    !opts.hasExifTime &&
    tierIndex(capped) > tierIndex(CAP_NO_EXIF_TIME)
  ) {
    capped = CAP_NO_EXIF_TIME;
  }
  return capped;
}

export function awardFor(
  rarity: RarityName,
  cardFoil: string | null = null
): AwardResult {
  return {
    badge: `${rarity} Frame`,
    points: AWARD_POINTS[rarity],
    cardFoil,
  };
}

export function scorePhoto(opts: {
  isNightSky: boolean;
  clarity: number;
  tracking: number;
  exposure: number;
  noise: number;
  framing: number;
  conditions: number;
  subjects?: Iterable<string>;
  identityMethod?: IdentityMethod;
  hasExifTime?: boolean;
  cardFoil?: string | null;
}): ScoreResult {
  const subjects = [...(opts.subjects ?? [])] as SubjectKey[];
  const identityMethod = opts.identityMethod ?? "plate-solved";
  const hasExifTime = opts.hasExifTime ?? true;

  if (!opts.isNightSky) {
    return {
      score: null,
      subjectBonus: null,
      finalScore: null,
      uncappedRarity: null,
      rarity: null,
      award: null,
      subjects: [],
      identityMethod: null,
      hasExifTime: null,
      capNotes: [],
      figureAwards: [],
      figurePointsTotal: 0,
      rubric: null,
    };
  }

  const rubric = {
    clarity: clampInt(opts.clarity),
    tracking: clampInt(opts.tracking),
    exposure: clampInt(opts.exposure),
    noise: clampInt(opts.noise),
    framing: clampInt(opts.framing),
    conditions: clampInt(opts.conditions),
  };

  const score = weightedScore(
    rubric.clarity,
    rubric.tracking,
    rubric.exposure,
    rubric.noise,
    rubric.framing,
    rubric.conditions
  );
  const subjectBonus = subjectBonusFor(subjects);
  const finalScore = Math.min(100, score + subjectBonus);
  const uncappedRarity = tierForFinalScore(finalScore);
  const rarity = applyCaps(uncappedRarity, {
    identityMethod,
    hasExifTime,
  });

  const capNotes: string[] = [];
  if (
    identityMethod === "model-estimate" &&
    tierIndex(uncappedRarity) > tierIndex(CAP_MODEL_ESTIMATE)
  ) {
    capNotes.push(
      `Model-estimate identity caps rarity at ${CAP_MODEL_ESTIMATE} (raw tier ${uncappedRarity}).`
    );
  }
  if (!hasExifTime && tierIndex(uncappedRarity) > tierIndex(CAP_NO_EXIF_TIME)) {
    capNotes.push(
      `Missing capture time caps rarity at ${CAP_NO_EXIF_TIME}.`
    );
  }

  return {
    score,
    subjectBonus,
    finalScore,
    uncappedRarity,
    rarity,
    award: awardFor(rarity, opts.cardFoil ?? null),
    subjects,
    identityMethod,
    hasExifTime,
    capNotes,
    figureAwards: [],
    figurePointsTotal: 0,
    rubric,
  };
}

/** Points for one figure from stars found + catalog alignment quality. */
export function awardForFigure(
  figure: SkyFigure,
  alignment?: FigureAlignment
): FigureAward {
  const breakdown: string[] = [];
  let points = 0;
  const kind = figure.kind;
  const starsIdentified = figure.stars.length;
  const catalogStars = alignment?.catalogStars ?? 0;
  const catalogMatched = alignment?.matchedStars ?? 0;
  const alignmentScore = alignment?.alignmentScore ?? null;

  if (kind === "constellation" || kind === "asterism") {
    points += 5;
    breakdown.push("base constellation/asterism +5");
    const starPts = Math.min(14, starsIdentified * 2);
    points += starPts;
    breakdown.push(`${starsIdentified} stars marked +${starPts}`);
    if (catalogMatched > 0) {
      const matchPts = Math.min(10, catalogMatched * 2);
      points += matchPts;
      breakdown.push(
        `${catalogMatched}/${catalogStars || "?"} catalog matches +${matchPts}`
      );
    }
    if (alignmentScore != null) {
      const alignPts = Math.round(alignmentScore * 10);
      points += alignPts;
      breakdown.push(
        `alignment ${(alignmentScore * 100).toFixed(0)}% +${alignPts}`
      );
    }
  } else if (kind === "planet" || kind === "moon") {
    points += 8;
    breakdown.push(`${kind} +8`);
  } else if (kind === "galaxy" || kind === "meteor") {
    points += 12;
    breakdown.push(`${kind} +12`);
  } else if (kind === "star") {
    points += 3 + Math.min(4, Math.max(0, starsIdentified - 1) * 2);
    breakdown.push(`named star field +${points}`);
  } else {
    points += 2;
    breakdown.push("other object +2");
  }

  return {
    figureId: figure.id,
    figureName: figure.name,
    kind,
    starsIdentified,
    catalogStars,
    catalogMatched,
    alignmentScore,
    points,
    breakdown,
    missingCatalogStars: alignment?.missingCatalogStars ?? [],
  };
}

function realFigures(analysis: SkyAnalysis): SkyFigure[] {
  return analysis.figures.filter(
    (f) => f.id !== "none-confident" && f.stars.length > 0
  );
}

/** Infer design-doc subject keys from Grok figures + capture meta. */
export function inferSubjectsFromAnalysis(
  analysis: SkyAnalysis,
  meta: SkyCaptureMeta
): SubjectKey[] {
  const figs = realFigures(analysis);
  const keys = new Set<SubjectKey>();
  const blob = figs
    .map((f) => `${f.name} ${f.kind} ${f.summary} ${f.description}`)
    .join(" ")
    .toLowerCase();

  const kinds = new Set(figs.map((f) => f.kind));

  if (
    DEEP_SKY_HINTS.some((h) => blob.includes(h)) ||
    kinds.has("galaxy")
  ) {
    keys.add("naked_eye_deep_sky");
  }
  if (
    blob.includes("milky way") ||
    (blob.includes("milky") &&
      (blob.includes("sagittarius") || blob.includes("scorpius")))
  ) {
    keys.add("milky_way_core");
  }
  if (kinds.has("planet") && kinds.has("moon")) {
    keys.add("planet_moon_or_pair");
  }
  if (kinds.has("meteor") || blob.includes("meteor")) {
    keys.add("meteor_streak");
  }
  if (
    (kinds.has("other") || blob.includes("aurora")) &&
    blob.includes("aurora") &&
    Math.abs(meta.latitude) < 50
  ) {
    keys.add("aurora_below_50_lat");
  }
  if (blob.includes("comet")) {
    keys.add("naked_eye_comet");
  }
  // Satellite / ISS bonuses need a logged pass match — not claimed from pixels alone.

  return [...keys];
}

/**
 * Build a 0–10 rubric from the Grok figure pass when OpenCV metrics are absent.
 * Uses confidence, star topology, and framing — not a model-returned total.
 */
export function rubricFromAnalysis(analysis: SkyAnalysis): {
  clarity: number;
  tracking: number;
  exposure: number;
  noise: number;
  framing: number;
  conditions: number;
} {
  const figs = realFigures(analysis);
  if (figs.length === 0) {
    return {
      clarity: 2,
      tracking: 2,
      exposure: 3,
      noise: 4,
      framing: 2,
      conditions: 3,
    };
  }

  const confidences = figs.map((f) => f.confidence);
  const avgConf =
    confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1);
  const clarity = clampInt(avgConf * 10);

  const patterned = figs.some(
    (f) =>
      (f.kind === "constellation" || f.kind === "asterism") &&
      f.lines.length > 0 &&
      f.stars.length >= 3
  );
  const tracking = patterned ? 7 : figs.some((f) => f.stars.length >= 2) ? 6 : 5;

  const centerBias =
    figs.reduce((acc, f) => {
      const dx = f.labelX - 0.5;
      const dy = f.labelY - 0.5;
      return acc + Math.sqrt(dx * dx + dy * dy);
    }, 0) / figs.length;
  const framing = clampInt(9 - centerBias * 8);

  const condText = (analysis.skyConditions ?? "").toLowerCase();
  let conditions = 6;
  if (/cloud|fog|haze|pollution|moon.?glare/.test(condText)) conditions = 4;
  if (/clear|dark|transparent/.test(condText)) conditions = 8;

  return {
    clarity,
    tracking,
    exposure: 6,
    noise: 6,
    framing,
    conditions,
  };
}

/** Full coded score for a night-sky Grok analysis (model-estimate path). */
export function scoreSkyAnalysis(
  analysis: SkyAnalysis,
  meta: SkyCaptureMeta,
  opts?: {
    identityMethod?: IdentityMethod;
    alignments?: FigureAlignment[];
  }
): ScoreResult {
  const figs = realFigures(analysis);
  const isNightSky = figs.length > 0;
  const subjects = inferSubjectsFromAnalysis(analysis, meta);
  const rubric = rubricFromAnalysis(analysis);
  const foil =
    figs.find((f) => f.kind === "constellation" || f.kind === "asterism")
      ?.name.toLowerCase()
      .replace(/\s+/g, "-") ?? null;

  const result = scorePhoto({
    isNightSky,
    ...rubric,
    subjects,
    identityMethod: opts?.identityMethod ?? "model-estimate",
    hasExifTime: Boolean(meta.takenAt),
    cardFoil: foil,
  });

  const byId = new Map(
    (opts?.alignments ?? []).map((a) => [a.figureId, a] as const)
  );
  const figureAwards = figs.map((f) => awardForFigure(f, byId.get(f.id)));
  const figurePointsTotal = figureAwards.reduce((a, f) => a + f.points, 0);

  return {
    ...result,
    figureAwards,
    figurePointsTotal,
  };
}
