"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  figureIdentity,
  type SignificantFeature,
  type SkyAnalysis,
  type SkyFigure,
  type SkyStar,
} from "@calhacks13/lib";

interface SkyOverlayProps {
  imageUrl: string;
  analysis: SkyAnalysis;
  selectedId: string | null;
  onSelect: (figure: SkyFigure) => void;
  /** When set, these figures stay bright and the rest recede. Points use this set. */
  highlights?: SignificantFeature[] | null;
  /** Feature currently being awarded. Others stay dark until unlocked. */
  spotlightId?: string | null;
  /** Highlights whose award beat has already played. */
  unlockedIds?: ReadonlySet<string> | null;
  /** When set, only these star ids are drawn (progressive identify). */
  revealedStarIds?: ReadonlySet<string> | null;
  /** Soften the global fade-in when doing one-at-a-time reveal. */
  progressive?: boolean;
}

type Point = { id: string; x: number; y: number; brightness: number };

function easeOut(t: number) {
  return 1 - (1 - t) ** 2.2;
}

function pointsForFigure(
  figure: SkyFigure,
  revealed: ReadonlySet<string> | null | undefined
): Point[] {
  const stars =
    revealed && revealed.size >= 0
      ? figure.stars.filter((s) => revealed.has(s.id))
      : figure.stars;

  if (stars.length > 0) {
    return stars.map((s: SkyStar) => ({
      id: s.id,
      x: clamp01(s.x),
      y: clamp01(s.y),
      brightness: s.brightness ?? 0.65,
    }));
  }

  // During progressive reveal, hide figure anchors until a star appears.
  if (revealed) return [];

  return [
    {
      id: `${figure.id}-anchor`,
      x: clamp01(figure.labelX),
      y: clamp01(figure.labelY),
      brightness: 0.8,
    },
  ];
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function SkyOverlay({
  imageUrl,
  analysis,
  selectedId,
  onSelect,
  revealedStarIds = null,
  progressive = false,
  highlights = null,
  spotlightId = null,
  unlockedIds = null,
}: SkyOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const [revealFrame, setReveal] = useState({ imageUrl, value: 0 });
  const [drawFrame, setDraw] = useState({ id: spotlightId, value: 0 });
  const reveal = progressive || reduced ? 1 : revealFrame.imageUrl === imageUrl ? revealFrame.value : 0;
  const draw = !spotlightId || reduced ? 1 : drawFrame.id === spotlightId ? drawFrame.value : 0;
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!spotlightId || reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setDraw({ id: spotlightId, value: easeOut(t) });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spotlightId, reduced]);

  useEffect(() => {
    if (progressive || reduced) return;
    let raf = 0;
    const start = performance.now();
    const duration = 4000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setReveal({ imageUrl, value: easeOut(t) });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressive, reduced, imageUrl]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const starT = progressive ? 1 : Math.min(1, reveal / 0.55);
  const ceremonyOn = unlockedIds != null || spotlightId != null;
  const lineT = ceremonyOn
    ? 1
    : progressive
      ? revealedStarIds && revealedStarIds.size > 1
        ? 1
        : 0
      : Math.max(0, (reveal - 0.35) / 0.65);
  const labelT = progressive
    ? 1
    : Math.max(0, (reveal - 0.55) / 0.45);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w < 2 || size.h < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size.w;
    canvas.height = size.h;
    ctx.clearRect(0, 0, size.w, size.h);

    const highlightIds = new Set((highlights ?? []).map((h) => h.figureId));
    const hasHighlights = highlightIds.size > 0;
    const ceremony = unlockedIds != null;

    for (const figure of analysis.figures) {
      const live = ceremony && figure.id === spotlightId;
      const banked = ceremony && unlockedIds.has(figure.id) && !live;
      const featured = ceremony
        ? live || banked
        : !hasHighlights || highlightIds.has(figure.id);
      const showStars =
        live || banked ? null : revealedStarIds;
      const dim =
        (selectedId !== null && selectedId !== figure.id ? 0.22 : 1) *
        (live ? 1 : featured ? 0.72 : ceremony ? 0.08 : 0.28);
      const focused = selectedId === null || selectedId === figure.id;
      const accent = figureIdentity(figure.name, figure.kind).accent;
      const points = pointsForFigure(figure, showStars);
      const starMap = new Map(points.map((p) => [p.id, p]));

      for (const p of points) {
        const px = p.x * size.w;
        const py = p.y * size.h;
        const baseR = (0.035 + p.brightness * 0.04) * size.w;
        const r = baseR * (0.5 + 0.5 * starT);
        const a = starT * dim * (focused ? 1 : 0.4);

        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(255, 248, 230, ${0.55 * a})`);
        g.addColorStop(0.15, `rgba(230, 235, 255, ${0.32 * a})`);
        g.addColorStop(0.4, `rgba(160, 190, 255, ${0.14 * a})`);
        g.addColorStop(0.7, `rgba(100, 140, 220, ${0.05 * a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (lineT <= 0.001) continue;
      ctx.save();
      ctx.globalAlpha = lineT * dim * (focused ? 0.7 : 0.45);
      ctx.strokeStyle = featured
        ? accent
        : focused
          ? "rgba(210, 225, 255, 0.55)"
          : "rgba(190, 210, 240, 0.4)";
      ctx.lineWidth = Math.max(
        1,
        size.w *
          (featured ? 0.0024 : focused && selectedId === figure.id ? 0.0018 : 0.001)
      );
      ctx.lineCap = "round";

      for (const line of figure.lines) {
        if (
          !live &&
          !banked &&
          revealedStarIds &&
          (!revealedStarIds.has(line.from) || !revealedStarIds.has(line.to))
        ) {
          continue;
        }
        const a = starMap.get(line.from);
        const b = starMap.get(line.to);
        if (!a || !b) continue;
        const x1 = a.x * size.w;
        const y1 = a.y * size.h;
        const progress = live ? draw : 1;
        const x2 = x1 + (b.x * size.w - x1) * progress;
        const y2 = y1 + (b.y * size.h - y1) * progress;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      if (!live || points.length === 0) continue;
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      const px = cx * size.w;
      const py = cy * size.h;
      const ring = (0.08 + draw * 0.16) * Math.min(size.w, size.h);
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - draw * 0.35);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, ring, 0, Math.PI * 2 * Math.max(draw, 0.08));
      ctx.stroke();
      ctx.restore();
    }
  }, [
    analysis,
    selectedId,
    size,
    starT,
    lineT,
    revealedStarIds,
    highlights,
    spotlightId,
    unlockedIds,
    draw,
  ]);

  return (
    <div ref={stageRef} className="sky-stage relative w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Night sky capture"
        className="sky-photo block h-auto w-full select-none"
        draggable={false}
        style={{
          filter: `brightness(${1 + 0.05 * starT})`,
        }}
      />

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "screen" }}
        aria-hidden
      />

      <div className="absolute inset-0 z-10">
        {analysis.figures.map((figure) => {
          const highlight = (highlights ?? []).find((h) => h.figureId === figure.id);
          const accent = figureIdentity(figure.name, figure.kind).accent;
          const ceremony = unlockedIds != null;
          const live = ceremony && figure.id === spotlightId;
          const banked = ceremony && unlockedIds.has(figure.id);
          const featured = ceremony
            ? live || banked
            : !highlights?.length || highlight != null;
          const dim = selectedId !== null && selectedId !== figure.id;
          const points = pointsForFigure(
            figure,
            live || banked ? null : revealedStarIds
          );
          if (points.length === 0) return null;
          const lx = clamp01(figure.labelX) * 100;
          const ly = clamp01(figure.labelY) * 100;
          const showLabel =
            featured &&
            (!revealedStarIds ||
              live ||
              banked ||
              figure.stars.some((s) => revealedStarIds.has(s.id)));

          return (
            <div key={figure.id}>
              {points.map((p) => {
                const starName =
                  figure.stars.find((s) => s.id === p.id)?.name ?? null;
                const showStarLabel = Boolean(starName);
                return (
                  <div key={`${figure.id}-${p.id}`}>
                    <button
                      type="button"
                      aria-label={
                        starName ? `${starName} in ${figure.name}` : figure.name
                      }
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent"
                      style={{
                        left: `${p.x * 100}%`,
                        top: `${p.y * 100}%`,
                        width: 44,
                        height: 44,
                      }}
                      onClick={() => onSelect(figure)}
                    />
                    {showStarLabel ? (
                      <span
                        className="pointer-events-none absolute -translate-x-1/2 text-[9px] tracking-wide text-zinc-100/90 sm:text-[10px]"
                        style={{
                          left: `${p.x * 100}%`,
                          top: `${p.y * 100}%`,
                          marginTop: 14,
                          opacity: labelT * (live ? 1 : dim || !featured ? 0.15 : 0.75),
                          textShadow:
                            "0 0 8px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)",
                        }}
                      >
                        {starName}
                      </span>
                    ) : null}
                  </div>
                );
              })}

              {live && highlight ? (
                <span
                  className="sky-medal pointer-events-none absolute"
                  style={{
                    left: `${lx}%`,
                    top: `${ly}%`,
                    ["--medal" as string]: accent,
                  }}
                >
                  #{highlight.rank}
                </span>
              ) : null}

              {showLabel && !live ? (
                <button
                  type="button"
                  onClick={() => onSelect(figure)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-1.5 py-0.5 text-left"
                  style={{
                    left: `${lx}%`,
                    top: `${ly}%`,
                    opacity: labelT * (dim ? 0.35 : featured ? 0.96 : 0.28),
                  }}
                >
                  <span
                    className="block whitespace-nowrap text-[11px] font-medium tracking-wide sm:text-xs"
                    style={{
                      color: highlight ? accent : "rgba(230, 238, 255, 0.92)",
                      textShadow: highlight
                        ? `0 0 12px rgba(0,0,0,0.9), 0 0 18px ${accent}`
                        : "0 0 12px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.85), 0 0 24px rgba(140,180,255,0.35)",
                    }}
                  >
                    {highlight ? `#${highlight.rank} ` : ""}
                    {figure.name}
                    {highlight ? ` · +${highlight.points}` : ""}
                  </span>
                  <span
                    className="mt-0.5 block text-[9px] uppercase tracking-[0.14em] text-sky-200/70"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                  >
                    {figure.kind.replace("_", " ")}
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
