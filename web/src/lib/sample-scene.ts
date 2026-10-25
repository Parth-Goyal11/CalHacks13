/** Light sampled from the photo itself, before any catalog names exist. */

export interface BrightPoint {
  x: number;
  y: number;
  brightness: number;
}

export interface SceneSketch {
  points: BrightPoint[];
  /** Average luminance, 0–1. */
  luminance: number;
  /** 0 cool blue, 1 warm amber. */
  warmth: number;
  /** Spread of luminance, 0 flat … 1 crisp. */
  contrast: number;
  /** Soft, low-contrast glow (haze, moon, light pollution). */
  haze: number;
}

export async function sampleScene(dataUrl: string): Promise<SceneSketch> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const w = Math.min(img.width || 480, 520);
  const h = Math.max(64, Math.round((w * img.height) / Math.max(img.width, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { points: [], luminance: 0.2, warmth: 0.4, contrast: 0.3, haze: 0.4 };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const lum = new Float32Array(w * h);
  let sum = 0;
  let sumSq = 0;
  let sumR = 0;
  let sumB = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lum[i] = y;
    sum += y;
    sumSq += y * y;
    sumR += r;
    sumB += b;
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const contrast = Math.min(1, Math.sqrt(variance) * 4.2);
  const warmth = Math.min(1, Math.max(0, ((sumR - sumB) / (n * 255)) * 2.2 + 0.5));
  const thresh = Math.min(0.85, Math.max(0.1, mean + Math.max(0.06, contrast * 0.35)));
  const found: BrightPoint[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = lum[y * w + x] ?? 0;
      if (v < thresh) continue;
      let peak = true;
      for (let dy = -1; dy <= 1 && peak; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if ((lum[(y + dy) * w + (x + dx)] ?? 0) > v) peak = false;
        }
      }
      if (peak) found.push({ x: x / (w - 1), y: y / (h - 1), brightness: v });
    }
  }
  found.sort((a, b) => b.brightness - a.brightness);
  const points: BrightPoint[] = [];
  for (const point of found) {
    const crowded = points.some((kept) => {
      const dx = kept.x - point.x;
      const dy = kept.y - point.y;
      return dx * dx + dy * dy < 0.0018;
    });
    if (crowded) continue;
    points.push(point);
    if (points.length >= 36) break;
  }
  const haze = Math.min(1, Math.max(0, 1 - contrast * 1.35 + mean * 0.25));
  return { points, luminance: mean, warmth, contrast, haze };
}
