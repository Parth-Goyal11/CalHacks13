"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SignificantFeature, SkyAnalysis, SkyFigure } from "@calhacks13/lib";
import { figureIdentity, findConstellationPattern } from "@calhacks13/lib";
import { catchMotion, catchTier } from "./catch-show";
import { SkyOverlay } from "./SkyOverlay";

const BEAT_MS = 2400;
const INTRO_MS = 650;
const TOTAL_MS = 1400;

const RANK_TITLE: Record<number, string> = {
  1: "Prime catch",
  2: "Strong signal",
  3: "Locked",
  4: "Spotted",
  5: "Echo",
};

interface FeatureRevealProps {
  imageUrl: string;
  analysis: SkyAnalysis;
  highlights: SignificantFeature[];
  totalPoints: number;
  selectedId: string | null;
  onSelect: (figure: SkyFigure) => void;
  revealedStarIds?: ReadonlySet<string> | null;
  onSettled?: () => void;
  /** Frame-level rarity, shown when the total lands. */
  frameRarity?: string | null;
  /** Fired once each catch's points hit the screen. */
  onCatch?: (feature: SignificantFeature) => void;
}

function ConstellationMark({ name, accent }: { name: string; accent: string }) {
  const pattern = findConstellationPattern(name);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!pattern) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setProgress(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setProgress(1 - (1 - t) ** 2.2);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setProgress(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [name, pattern]);

  if (!pattern) return null;
  const xs = pattern.stars.map((star) => star.x);
  const ys = pattern.stars.map((star) => star.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.18, maxX - minX);
  const spanY = Math.max(0.18, maxY - minY);
  const pad = 10;
  const sx = (x: number) => pad + ((x - minX) / spanX) * (100 - pad * 2);
  const sy = (y: number) => pad + ((y - minY) / spanY) * (100 - pad * 2);

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden>
      {pattern.lines.map((line, index) => {
        const from = pattern.stars.find((star) => star.name === line.from);
        const to = pattern.stars.find((star) => star.name === line.to);
        if (!from || !to) return null;
        const start = index / Math.max(pattern.lines.length, 1);
        const t = Math.max(0, Math.min(1, (progress - start * 0.55) / 0.45));
        const x1 = sx(from.x);
        const y1 = sy(from.y);
        return (
          <line
            key={`${line.from}-${line.to}`}
            x1={x1}
            y1={y1}
            x2={x1 + (sx(to.x) - x1) * t}
            y2={y1 + (sy(to.y) - y1) * t}
            stroke={accent}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        );
      })}
      {pattern.stars.map((star) => (
        <circle
          key={star.name}
          cx={sx(star.x)}
          cy={sy(star.y)}
          r={star.mag < 1.2 ? 2.6 : 1.7}
          fill={accent}
          opacity={progress > 0.05 ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

export function FeatureReveal({
  imageUrl,
  analysis,
  highlights,
  totalPoints,
  selectedId,
  onSelect,
  revealedStarIds = null,
  onSettled,
  frameRarity = null,
  onCatch,
}: FeatureRevealProps) {
  // Weakest first so the highest-point catch lands last.
  const order = useMemo(
    () => [...highlights].sort((a, b) => a.points - b.points || b.rank - a.rank),
    [highlights]
  );
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);
  const settledAt = order.length + 2;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setReduced(true);
      setStep(settledAt);
    }
  }, [settledAt]);

  useEffect(() => {
    if (reduced || step >= settledAt) return;
    const delay =
      step === 0 ? INTRO_MS : step === order.length + 1 ? TOTAL_MS : BEAT_MS;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step, settledAt, order.length, reduced]);

  useEffect(() => {
    if (step >= settledAt) onSettledRef.current?.();
  }, [step, settledAt]);

  const featureIndex = step - 1;
  const showingFeature = step >= 1 && step <= order.length;
  const showingTotal = step === order.length + 1;
  const settled = step >= settledAt;
  const active = showingFeature ? order[featureIndex] : null;
  const onCatchRef = useRef(onCatch);
  const flourishedId = useRef<string | null>(null);
  onCatchRef.current = onCatch;
  useEffect(() => {
    if (!active || flourishedId.current === active.figureId) return;
    flourishedId.current = active.figureId;
    onCatchRef.current?.(active);
  }, [active]);
  const unlocked = useMemo(() => {
    if (settled || reduced) return null;
    const ids = new Set<string>();
    const through = showingTotal ? order.length : featureIndex;
    for (let i = 0; i < through; i++) ids.add(order[i].figureId);
    return ids;
  }, [settled, reduced, showingTotal, featureIndex, order]);

  const runningTarget = useMemo(() => {
    if (settled || showingTotal) return totalPoints;
    return order
      .slice(0, Math.max(0, featureIndex))
      .reduce((sum, feature) => sum + feature.points, 0);
  }, [settled, showingTotal, totalPoints, order, featureIndex]);

  const counted = useCountUp(
    active?.points ?? (showingTotal || settled ? totalPoints : runningTarget),
    showingFeature || showingTotal || settled
  );
  const bank = showingFeature ? runningTarget : counted;

  const spot = active
    ? analysis.figures.find((figure) => figure.id === active.figureId)
    : null;
  const spotX = spot ? `${Math.round(spot.labelX * 100)}%` : "50%";
  const spotY = spot ? `${Math.round(spot.labelY * 100)}%` : "40%";

  function skip() {
    setStep(settledAt);
  }

  const title = active
    ? (RANK_TITLE[active.rank] ?? "Noted")
    : showingTotal || settled
      ? "Frame score"
      : "Reading the frame";
  const look = active ? figureIdentity(active.figureName, active.kind) : null;
  const accent = look?.accent ?? "#ffd678";
  const motion = active ? catchMotion(active.figureName) : "drift";
  const tier = active ? catchTier(active.points, active.kind) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-amber-200/80">
          {settled
            ? `Scored on these ${highlights.length} features`
            : `Awarding ${highlights.length} catches`}
        </p>
        <p className="text-sm font-semibold tabular-nums text-amber-100">
          +{showingFeature ? runningTarget + counted : settled ? totalPoints : bank} pts
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {highlights.map((feature) => {
          const lit =
            settled ||
            reduced ||
            unlocked?.has(feature.figureId) ||
            active?.figureId === feature.figureId;
          const chip = figureIdentity(feature.figureName, feature.kind);
          const tierChip = catchTier(feature.points, feature.kind);
          const current = active?.figureId === feature.figureId;
          return (
            <li key={feature.figureId}>
              <button
                type="button"
                onClick={() => {
                  const fig = analysis.figures.find((item) => item.id === feature.figureId);
                  if (fig) onSelect(fig);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  current
                    ? "sky-chip-pop text-zinc-50"
                    : lit
                      ? "text-zinc-100"
                      : "border-zinc-800 text-zinc-600"
                }`}
                style={
                  lit
                    ? {
                        borderColor: chip.accent,
                        backgroundColor: current
                          ? `${chip.accent}40`
                          : `${chip.accent}18`,
                      }
                    : undefined
                }
              >
                #{feature.rank} {feature.figureName}
                {lit ? (
                  <span className="ml-1 tabular-nums opacity-80">
                    {tierChip.name} +{feature.points}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative overflow-hidden rounded-lg border border-amber-500/20">
        <SkyOverlay
          imageUrl={imageUrl}
          analysis={analysis}
          selectedId={selectedId}
          onSelect={onSelect}
          revealedStarIds={revealedStarIds}
          highlights={highlights}
          spotlightId={active?.figureId ?? null}
          unlockedIds={unlocked}
          progressive
        />

        {!settled && active ? (
          <div
            className="sky-vignette pointer-events-none absolute inset-0 z-20"
            style={{
              ["--spot-x" as string]: spotX,
              ["--spot-y" as string]: spotY,
              ["--spot-color" as string]: accent,
            }}
          />
        ) : null}

        {!settled ? (
          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 sm:p-4">
            <div
              key={active?.figureId ?? (showingTotal ? "total" : "intro")}
              className="sky-award-card w-full max-w-lg rounded-2xl border bg-zinc-950/90 px-4 py-3 text-zinc-50 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
              style={{ borderColor: tier ? tier.ink : `${accent}99` }}
            >
              <div className="flex items-center gap-3">
                {active && look ? (
                  <div className={`sky-motion sky-motion-${motion} relative shrink-0`}>
                    {motion === "mirror" ? (
                      <div className="flex -space-x-6">
                        <ConstellationMark name={active.figureName} accent={accent} />
                        <ConstellationMark name={active.figureName} accent={accent} />
                      </div>
                    ) : (
                      <ConstellationMark name={active.figureName} accent={accent} />
                    )}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    {showingFeature
                      ? `Catch ${featureIndex + 1} of ${order.length}`
                      : showingTotal
                        ? "All catches locked"
                        : "Night scan"}
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-tight">
                    {active ? active.figureName : title}
                  </p>
                  <p
                    className="mt-0.5 text-xs uppercase tracking-[0.14em]"
                    style={{ color: accent }}
                  >
                    {look ? look.motif : showingTotal && frameRarity ? `${frameRarity} frame` : title}
                    {active ? ` · ${title}` : ""}
                  </p>
                  {tier ? (
                    <p
                      className={`sky-rarity-stamp mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        tier.name === "Legendary" ? "sky-rarity-legendary" : ""
                      }`}
                      style={{ color: tier.ink, borderColor: tier.ink }}
                    >
                      {tier.name}
                    </p>
                  ) : showingTotal && frameRarity ? (
                    <p className="sky-rarity-stamp mt-2 inline-flex rounded-full border border-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      {frameRarity} frame
                    </p>
                  ) : null}
                  {active ? (
                    <p className="mt-1 text-xs text-zinc-300/80">{active.reason}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Points</p>
                  <p
                    className="text-4xl font-semibold tabular-nums leading-none"
                    style={{ color: tier?.ink ?? accent }}
                  >
                    +{showingFeature ? counted : showingTotal ? counted : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!settled ? (
          <button
            type="button"
            onClick={skip}
            className="absolute right-3 top-3 z-30 rounded-full border border-zinc-700/80 bg-zinc-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-300 backdrop-blur hover:text-zinc-100"
          >
            Skip
          </button>
        ) : null}
      </div>
    </div>
  );
}
