import { figureIdentity, type SkyAnalysisWithScore, type SkyCaptureMeta } from "@calhacks13/lib";
import { dataUrlToBase64, fileToResizedDataUrl } from "@/lib/image";
import type { SkyPhotoResult } from "./photo-types";
import type { CelestialObject } from "./sky-data";

export type SkyRevealResult = SkyAnalysisWithScore & { meta: SkyCaptureMeta };

export function revealFigures(reveal: SkyRevealResult) {
  return reveal.analysis.figures.filter((figure) => figure.id !== "none-confident");
}

/** Present Ben's data as Figma's original rings and object sheets. */
export function revealObjects(reveal: SkyRevealResult): CelestialObject[] {
  const figures = revealFigures(reveal);
  const highlights = reveal.score.highlights ?? [];
  const objects: CelestialObject[] = figures.map((figure) => {
    const points = reveal.verification.acceptedStars.filter((star) => star.figureId === figure.id && Number.isFinite(star.x) && Number.isFinite(star.y) && star.x >= 0 && star.x <= 1 && star.y >= 0 && star.y <= 1);
    const identity = figureIdentity(figure.name, figure.kind);
    const highlight = highlights.find((feature) => feature.figureId === figure.id);
    return {
      id: `figure-${figure.id}`,
      figureId: figure.id,
      name: figure.name,
      kind: figure.kind,
      detail: [figure.summary, figure.description, figure.mythology].filter(Boolean).join("\n\n"),
      motif: identity.motif,
      accent: identity.accent,
      highlightRank: highlight?.rank,
      highlightReason: highlight?.reason,
      highlightPoints: highlight?.points,
      x: points.length ? points.reduce((sum, point) => sum + point.x, 0) / points.length * 100 : undefined,
      y: points.length ? points.reduce((sum, point) => sum + point.y, 0) / points.length * 100 : undefined,
    };
  });
  for (const star of reveal.verification.acceptedStars) {
    if (!figures.some((figure) => figure.id === star.figureId) || objects.some((object) => object.name.toLowerCase() === star.starName.toLowerCase()) || !Number.isFinite(star.x) || !Number.isFinite(star.y) || star.x < 0 || star.x > 1 || star.y < 0 || star.y > 1) continue;
    objects.push({ id: `star-${star.figureId}-${star.starId}`, figureId: star.figureId, name: star.starName, kind: `Star · ${star.figureName}`, detail: `A star identified within ${star.figureName}. This identification is a model estimate checked against the constellation’s star pattern.`, x: star.x * 100, y: star.y * 100 });
  }
  return objects;
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
