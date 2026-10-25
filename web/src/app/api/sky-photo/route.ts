import { NextResponse } from "next/server";

const DEFAULT_SKY_PHOTO_URL = "http://127.0.0.1:8000";

function skyPhotoBase(): string {
  return (process.env.SKY_PHOTO_URL ?? DEFAULT_SKY_PHOTO_URL).replace(
    /\/$/,
    "",
  );
}

/** Thin proxy: browser → Next → FastAPI Sky Photo service. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Send a multipart image upload." },
      { status: 400 },
    );
  }
  const image = form.get("image");
  if (!(image instanceof File) || !image.size)
    return NextResponse.json(
      { detail: "Choose an image to analyze." },
      { status: 400 },
    );
  if (image.size > 20 * 1024 * 1024)
    return NextResponse.json(
      { detail: "Choose a photo smaller than 20 MB." },
      { status: 413 },
    );
  let upstream: Response;
  try {
    upstream = await fetch(`${skyPhotoBase()}/api/sky-photo`, {
      method: "POST",
      body: form,
      // Multipart boundary is set automatically from FormData.
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(240000)]),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json(
      {
        detail: `Sky Photo service unavailable at ${skyPhotoBase()}. Start uvicorn (see README). ${message}`,
      },
      { status: 502 },
    );
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}
