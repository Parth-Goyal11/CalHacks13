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

export {
  AWARD_POINTS,
  SUBJECT_BONUS,
  applyCaps,
  awardFor,
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
  IdentityMethod,
  RarityName,
  ScoreResult,
  SubjectKey,
} from "./sky-score";
