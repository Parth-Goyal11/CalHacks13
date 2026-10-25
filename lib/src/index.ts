export { createGrokClient, grok } from "./grok";
export type { CoreMessage } from "./grok";

export {
  analyzeNightSky,
  explainSkyFigure,
  skyAnalysisSchema,
  skyFigureSchema,
  VISION_MODEL,
} from "./sky-analysis";
export type {
  SkyAnalysis,
  SkyAnalysisWithScore,
  SkyCaptureMeta,
  SkyFigure,
  SkyLine,
  SkyStar,
} from "./sky-analysis";

export { verifyAgainstStarDatabase } from "./verify-stars";
export type {
  FigureVerdict,
  StarVerdict,
  VerificationReport,
  VerifyResult,
} from "./verify-stars";

export {
  AWARD_POINTS,
  RARITY_THRESHOLDS,
  RUBRIC_WEIGHTS,
  SUBJECT_BONUS,
  applyCaps,
  awardFor,
  awardForFigure,
  inferSubjectsFromAnalysis,
  rubricFromAnalysis,
  scorePhoto,
  scoreSkyAnalysis,
  subjectBonusFor,
  tierForFinalScore,
  weightedScore,
} from "./sky-score";
export type {
  AwardResult,
  FigureAward,
  IdentityMethod,
  RarityName,
  ScoreResult,
  SubjectKey,
} from "./sky-score";

export {
  BRIGHT_SKY_CATALOG,
  buildSkyLocationContext,
  localSiderealHours,
} from "./sky-context";
export type {
  SkyCatalogEntry,
  SkyLocationContext,
  VisibleSkyHint,
} from "./sky-context";

export {
  CONSTELLATION_PATTERNS,
  catalogPromptBlock,
  findConstellationPattern,
  normalizeStarName,
} from "./star-catalog";
export type {
  CatalogLine,
  CatalogStar,
  ConstellationPattern,
} from "./star-catalog";

export { alignAnalysisToCatalog } from "./align-figures";
export type { AlignResult, FigureAlignment } from "./align-figures";

export { buildFovPrediction, crossCheckWithFov } from "./sky-fov";
export type {
  FovCrossCheck,
  FovFigureCheck,
  FovPrediction,
  PredictedFigure,
} from "./sky-fov";
