"use client";

import { useEffect, useRef, useState } from "react";
import { CONSTELLATION_PATTERNS } from "@calhacks13/lib";
import type { BrightPoint, SceneSketch } from "@/lib/sample-scene";

const EMPTY_POINTS: BrightPoint[] = [];

const NAMES = CONSTELLATION_PATTERNS.map((pattern) => pattern.name);

interface IdentifyScanProps {
  imageUrl: string;
  elapsed: number;
  sketch: SceneSketch | null;
  muted: boolean;
  onToggleMute: () => void;
}

function phaseCopy(elapsed: number, shown: number, total: number): { title: string; detail: string } {
  if (total === 0 && elapsed < 2) {
    return {
      title: "Reading the frame",
      detail: "Sampling light across the photo before any name is assigned.",
    };
  }
  if (elapsed < 4) {
    return {
      title: "Pass A · bright anchors",
      detail: `Locking the strongest lights${total ? ` · ${shown} of ${total}` : ""}.`,
    };
  }
  if (elapsed < 9) {
    const name = NAMES[Math.floor(elapsed / 1.6) % NAMES.length] ?? "the catalog";
    return {
      title: "Pass B · stick figures",
      detail: `Comparing neighbor lights with ${name}.`,
    };
  }
  if (elapsed < 14) {
    return {
      title: "Pass C · edges",
      detail: "Checking corners for planets and stars that sit alone.",
    };
  }
  return {
    title: "Catalog match",
    detail: "Holding the lights that fit. Names arrive when the match finishes.",
  };
}

export function IdentifyScan({
  imageUrl,
  elapsed,
  sketch,
  muted,
  onToggleMute,
}: IdentifyScanProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);
  const points = sketch?.points ?? EMPTY_POINTS;
  const shown = points.length === 0 ? 0 : Math.min(points.length, Math.max(1, Math.ceil(points.length * Math.min(1, elapsed / 11))));
  const copy = phaseCopy(elapsed, shown, points.length);
  const step =
    elapsed < 4 ? 0 : elapsed < 9 ? 1 : elapsed < 14 ? 2 : 3;

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
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">
            Identification · {elapsed}s
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-50">{copy.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">{copy.detail}</p>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-300 hover:text-zinc-100"
        >
          {muted ? "Play sky piece" : "Silence"}
        </button>
      </div>

      <ol className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.12em] sm:grid-cols-4">
        {["Bright anchors", "Stick figures", "Edges", "Catalog match"].map((label, index) => (
          <li
            key={label}
            className={`rounded-full border px-3 py-1 ${
              index === step
                ? "border-sky-300/70 bg-sky-400/15 text-sky-100"
                : index < step
                  ? "border-zinc-700 text-zinc-300"
                  : "border-zinc-800 text-zinc-600"
            }`}
          >
            {index < step ? "✓ " : ""}
            {label}
          </li>
        ))}
      </ol>

      <div ref={stageRef} className="relative overflow-hidden rounded-lg border border-sky-500/20 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Sky photo being identified" className="block h-auto w-full" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ mixBlendMode: "screen" }}
          aria-hidden
        />
          <p className="absolute bottom-3 left-3 right-3 text-xs text-zinc-200/90" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>
            {sketch == null
              ? "Looking for points of light…"
              : points.length
                ? `${points.length} lights in this frame. Lines are guesses until the catalog answers.`
                : "No sharp points stood out yet. The catalog match is still running."}
          </p>
      </div>
      <p className="text-xs text-zinc-500">
        A quiet piece is playing from this photo’s color and light. It settles onto the named stars when they arrive.
      </p>
    </section>
  );
}
