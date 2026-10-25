import type { SkyPhotoResult } from "./photo-types";

export type { SkyPhotoResult };

/** The existing FastAPI contract stays behind the same-origin Next.js proxy. */
export async function analyzeSky(
  image: File,
  signal: AbortSignal,
): Promise<SkyPhotoResult> {
  const form = new FormData();
  form.append("image", image);
  const response = await fetch("/api/sky-photo", {
    method: "POST",
    body: form,
    signal,
  });
  let result: SkyPhotoResult;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The analysis service returned an unreadable response. Please try again.",
    );
  }
  if (!result || typeof result !== "object")
    throw new Error("The analysis service returned an unreadable response.");
  if (response.status === 422 || result.is_night_sky === false) {
    throw new Error(
      "We could not recognize a night sky. Try a darker photo with a clearer view of the stars.",
    );
  }
  if (response.status === 415)
    throw new Error("We could not read this image. Try a JPEG or PNG photo.");
  // A solver timeout can still contain useful metrics and a model estimate.
  if (
    (!response.ok && response.status !== 504) ||
    (!result.identity && !result.metrics)
  ) {
    throw new Error(
      response.status >= 500
        ? "Sky analysis is unavailable right now. Your photo is still here. Try again in a moment."
        : "We could not analyze this photo. Please try another image.",
    );
  }
  return result;
}

export function annotationUrl(result?: SkyPhotoResult): string | undefined {
  return result?.identity?.method === "plate-solved" &&
    /^ph_[a-zA-Z0-9_-]+$/.test(result.photo_id ?? "") &&
    result.annotated_image_url
    ? `/api/sky-photo/${encodeURIComponent(result.photo_id!)}/annotated`
    : undefined;
}

export function identificationLabel(result?: SkyPhotoResult): string {
  if (!result) return "Sample sky";
  if (result.reveal) return result.needs_review ? "No objects identified" : "Catalog-checked · model estimate";
  if (result.identity?.method === "plate-solved")
    return result.needs_review
      ? "Plate-solved · review pending"
      : "Plate-solved";
  return result.needs_review ? "Needs review" : "Model estimate";
}
