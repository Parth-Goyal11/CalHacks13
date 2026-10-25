import type { SkyCaptureMeta } from "@calhacks13/lib";

export class ApiInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function inputErrorResponse(error: unknown): Response | null {
  return error instanceof ApiInputError
    ? Response.json({ error: error.message }, { status: error.status })
    : null;
}

/** Count incoming bytes before decoding/JSON parsing, including chunked requests. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiInputError("Send a JSON request.", 415);
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiInputError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiInputError("Invalid JSON.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ApiInputError("Request is too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Not an object");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError("Invalid JSON.");
  } finally { reader.releaseLock(); }
}

export function isCaptureMeta(meta: unknown): meta is SkyCaptureMeta {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  const m = meta as Record<string, unknown>;
  return typeof m.latitude === "number" && Number.isFinite(m.latitude) && Math.abs(m.latitude) <= 90 &&
    typeof m.longitude === "number" && Number.isFinite(m.longitude) && Math.abs(m.longitude) <= 180 &&
    typeof m.takenAt === "string" && m.takenAt.length <= 64 && Number.isFinite(Date.parse(m.takenAt)) &&
    [["facingDegrees", 0, 360], ["elevationDegrees", 0, 90], ["fovDegrees", 1, 180]].every(([key, min, max]) => {
      const value = m[key as string];
      return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= (min as number) && value <= (max as number));
    }) && [["notes", 2000], ["locationLabel", 180]].every(([key, max]) => {
      const value = m[key as string];
      return value === undefined || (typeof value === "string" && value.length <= (max as number));
    });
}

/** Accept image bytes only; SDK string inputs may otherwise be interpreted as URLs. */
export function decodeSkyImage(value: unknown, requestedMime: unknown): { imageBytes: Uint8Array; mimeType: "image/jpeg" | "image/png" } {
  const mimeType = requestedMime ?? "image/jpeg";
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") throw new ApiInputError("Choose a JPEG or PNG image.", 415);
  if (typeof value !== "string") throw new ApiInputError("imageBase64 is required.");
  let raw = value;
  if (raw.startsWith("data:")) {
    const prefix = `data:${mimeType};base64,`;
    if (!raw.startsWith(prefix)) throw new ApiInputError("Image data does not match its MIME type.");
    raw = raw.slice(prefix.length);
  }
  const padding = raw.indexOf("=");
  if (raw.length < 500 || raw.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(raw) ||
      (padding !== -1 && (padding < raw.length - 2 || !/^={1,2}$/.test(raw.slice(padding))))) {
    throw new ApiInputError("Send a valid base64 JPEG or PNG image.");
  }
  const bytes = Buffer.from(raw, "base64");
  if (bytes.toString("base64") !== raw) throw new ApiInputError("Send a valid base64 image.");
  const valid = mimeType === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!valid) throw new ApiInputError("Image bytes do not match a JPEG or PNG image.");
  return { imageBytes: new Uint8Array(bytes), mimeType };
}
