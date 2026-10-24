/** Resize + clarify a night-sky photo for Grok vision upload. */

export async function fileToResizedDataUrl(
  file: Blob,
  maxEdge = 1400,
  quality = 0.9
): Promise<{ dataUrl: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  clarifyNightSky(ctx, width, height);

  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, quality);
  return { dataUrl, mimeType };
}

/**
 * Stretch contrast and gently boost star-like peaks so fainter stars
 * survive JPEG + vision compression without inventing structure.
 */
function clarifyNightSky(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const n = width * height;
  if (n < 16) return;

  // Sample luminances for percentile black/white points.
  const step = Math.max(1, Math.floor(n / 8000));
  const samples: number[] = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    samples.push(0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]);
  }
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.985)] ?? 255;
  const span = Math.max(12, hi - lo);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let r = data[o];
    let g = data[o + 1];
    let b = data[o + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Percentile stretch
    let t = (y - lo) / span;
    t = Math.min(1, Math.max(0, t));
    // Mild gamma lift in the mid-darks so mag ~3 stars pop
    t = Math.pow(t, 0.82);

    const scale = y > 1e-3 ? (t * 255) / y : 1;
    r = clampByte(r * scale);
    g = clampByte(g * scale);
    b = clampByte(b * scale);

    // Soft star core boost for already-bright pixels
    const y2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (y2 > 40) {
      const boost = 1 + Math.min(0.35, ((y2 - 40) / 215) * 0.35);
      r = clampByte(r * boost);
      g = clampByte(g * boost);
      b = clampByte(b * boost);
    }

    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }

  ctx.putImageData(image, 0, 0);
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/** Local datetime-local input value → ISO string. Returns null if empty/invalid. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
