import { NextResponse } from "next/server";

const DEFAULT_SKY_PHOTO_URL = "http://127.0.0.1:8000";

function skyPhotoBase(): string {
  return (process.env.SKY_PHOTO_URL ?? DEFAULT_SKY_PHOTO_URL).replace(/\/$/, "");
}

type RouteContext = { params: Promise<{ photoId: string }> };

/** Proxy annotated JPEG from the FastAPI Sky Photo service. */
export async function GET(_request: Request, context: RouteContext) {
  const { photoId } = await context.params;
  if (!photoId || photoId.includes("/") || photoId.includes("..")) {
    return NextResponse.json({ detail: "Invalid photo_id" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${skyPhotoBase()}/api/sky-photo/${encodeURIComponent(photoId)}/annotated`,
      { cache: "no-store" },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json(
      {
        detail: `Sky Photo service unavailable at ${skyPhotoBase()}. ${message}`,
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}
