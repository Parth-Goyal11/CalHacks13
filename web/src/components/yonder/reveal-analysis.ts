import type { SkyAnalysisWithScore, SkyCaptureMeta } from "@calhacks13/lib";
import { dataUrlToBase64, fileToResizedDataUrl } from "@/lib/image";
import type { SkyPhotoResult } from "./photo-types";

export type SkyRevealResult = SkyAnalysisWithScore & { meta: SkyCaptureMeta };

export function revealFigures(reveal: SkyRevealResult) {
  return reveal.analysis.figures.filter((figure) => figure.id !== "none-confident");
}

/** Keep Ben's full response; summary fields let existing Memories remain compatible. */
export function toPhotoResult(reveal: SkyRevealResult): SkyPhotoResult {
  const figures = revealFigures(reveal);
  return {
    reveal,
    identity: {
      method: "catalog-checked-model",
      constellations: figures.filter((f) => f.kind === "constellation").map((f) => f.name),
      named_stars: figures.filter((f) => f.kind === "star").map((f) => f.name),
      other: figures.filter((f) => f.kind !== "constellation" && f.kind !== "star").map((f) => f.name),
    },
    needs_review: figures.length === 0,
    rubric: reveal.score.rubric,
    score: reveal.score.score,
    final_score: reveal.score.finalScore,
    rarity: reveal.score.rarity,
  };
}

export async function analyzeReveal(file: File, meta: SkyCaptureMeta, signal: AbortSignal): Promise<SkyPhotoResult> {
  let image;
  try {
    image = await fileToResizedDataUrl(file);
  } catch {
    throw new Error("This browser cannot decode that photo. Choose a JPEG or PNG copy and try again.");
  }
  signal.throwIfAborted();
  const response = await fetch("/api/analyze-sky", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: dataUrlToBase64(image.dataUrl), mimeType: image.mimeType, meta }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(response.status === 503
    ? "Sky analysis needs an xAI API key on the server. Your photo is still here."
    : "Sky analysis could not finish. Your photo is still here. Please try again.");
  if (!data.analysis || !Array.isArray(data.analysis.figures) || !data.score || !data.verification)
    throw new Error("Sky analysis returned an incomplete response. Please try again.");
  return toPhotoResult({ ...data, meta });
}
