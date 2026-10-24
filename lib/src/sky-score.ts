/**
 * Score, subject bonus, rarity, and award points.
 * Mirrors sky_photo/score.py / docs/sky-photo-design.md.
 * The vision model never returns score/rarity/points — only this module does.
 */

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

const WEIGHT_CLARITY = 0.25;
const WEIGHT_TRACKING = 0.2;
const WEIGHT_EXPOSURE = 0.15;
const WEIGHT_NOISE = 0.1;
const WEIGHT_FRAMING = 0.2;
const WEIGHT_CONDITIONS = 0.1;

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

export interface ScoreResult {
  score: number | null;
  subjectBonus: number | null;
  finalScore: number | null;
  rarity: RarityName | null;
  award: AwardResult | null;
  subjects: SubjectKey[];
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
  if (!opts.isNightSky) {
    return {
      score: null,
      subjectBonus: null,
      finalScore: null,
      rarity: null,
      award: null,
      subjects: [],
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
  const tier = tierForFinalScore(finalScore);
  const rarity = applyCaps(tier, {
    identityMethod: opts.identityMethod ?? "plate-solved",
    hasExifTime: opts.hasExifTime ?? true,
  });

  return {
    score,
    subjectBonus,
    finalScore,
    rarity,
    award: awardFor(rarity, opts.cardFoil ?? null),
    subjects,
    rubric,
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
  opts?: { identityMethod?: IdentityMethod }
): ScoreResult {
  const figs = realFigures(analysis);
  const isNightSky = figs.length > 0;
  const subjects = inferSubjectsFromAnalysis(analysis, meta);
  const rubric = rubricFromAnalysis(analysis);
  const foil =
    figs.find((f) => f.kind === "constellation" || f.kind === "asterism")
      ?.name.toLowerCase()
      .replace(/\s+/g, "-") ?? null;

  return scorePhoto({
    isNightSky,
    ...rubric,
    subjects,
    identityMethod: opts?.identityMethod ?? "model-estimate",
    hasExifTime: Boolean(meta.takenAt),
    cardFoil: foil,
  });
}
