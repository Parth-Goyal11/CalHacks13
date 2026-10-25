"use client";

import { useEffect, useRef, useState } from "react";
import type { BrightPoint, SceneSketch } from "@/lib/sample-scene";

const EMPTY_POINTS: BrightPoint[] = [];

interface IdentifyScanProps {
  imageUrl: string;
  elapsed: number;
  sketch: SceneSketch | null;
  muted: boolean;
  onToggleMute: () => void;
}

function phaseCopy(elapsed: number, total: number): { title: string } {
  if (total === 0 && elapsed < 2) {
    return { title: "Reading the frame" };
  }
  if (elapsed < 4) {
    return { title: "Bright anchors" };
  }
  if (elapsed < 9) {
    return { title: "Stick figures" };
  }
  if (elapsed < 14) return { title: "Edges" };
  return { title: "Catalog match" };
}

export function IdentifyScan({
  imageUrl,
  elapsed,
  sketch,
}: IdentifyScanProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);
  const points = sketch?.points ?? EMPTY_POINTS;
  const copy = phaseCopy(elapsed, points.length);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const rect = stage.getBoundingClientRect();
      const w = Math.max(2, Math.round(rect.width));
      const h = Math.max(2, Math.round(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const t = (now - start) / 1000;
      const reveal = reduced ? 1 : Math.min(1, t / 11);
      const count = Math.ceil(points.length * reveal);

      if (!reduced && t < 20) {
        const y = ((t % 3.6) / 3.6) * (h + 40) - 20;
        const beam = ctx.createLinearGradient(0, y - 36, 0, y + 36);
        beam.addColorStop(0, "rgba(125, 211, 252, 0)");
        beam.addColorStop(0.5, "rgba(186, 230, 253, 0.38)");
        beam.addColorStop(1, "rgba(125, 211, 252, 0)");
        ctx.fillStyle = beam;
        ctx.fillRect(0, y - 36, w, 72);
      }

      if (t > 3.2) {
        ctx.lineWidth = 1.25;
        ctx.lineCap = "round";
        for (let i = 0; i < count; i++) {
          const from = points[i];
          if (!from) continue;
          let best = -1;
          let bestD = 0.048;
          for (let j = i + 1; j < count; j++) {
            const to = points[j];
            if (!to) continue;
            const dx = from.x - to.x;
            const dy = from.y - to.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = j;
            }
          }
          const to = points[best];
          if (!to) continue;
          const pulse = reduced ? 0.28 : 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.15 + i));
          ctx.strokeStyle = `rgba(186, 230, 253, ${pulse})`;
          ctx.beginPath();
          ctx.moveTo(from.x * w, from.y * h);
          ctx.lineTo(to.x * w, to.y * h);
          ctx.stroke();
        }
      }

      for (let i = 0; i < count; i++) {
        const point = points[i];
        if (!point) continue;
        const px = point.x * w;
        const py = point.y * h;
        const age = Math.min(1, reveal * points.length - i);
        const radius = (3 + point.brightness * 7) * (0.4 + 0.6 * age);
        const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 3.2);
        glow.addColorStop(0, `rgba(255, 248, 230, ${0.85 * age})`);
        glow.addColorStop(0.35, `rgba(186, 230, 253, ${0.35 * age})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, radius * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [points, reduced]);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">
        {copy.title} · {elapsed}s
      </p>
      <div ref={stageRef} className="relative overflow-hidden rounded-lg border border-sky-500/20 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Sky photo being identified" className="block h-auto w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ mixBlendMode: "screen" }}
          aria-hidden
        />
      </div>
    </section>
  );
}
