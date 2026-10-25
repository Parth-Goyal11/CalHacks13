"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { SignificantFeature, SkyAnalysis, SkyFigure } from "@calhacks13/lib";
import { figureIdentity } from "@calhacks13/lib";
import { creatureFromObject, type StoredCreature } from "@/components/yonder/collection";
import CreatureCatch from "@/components/yonder/CreatureCatch";
import { SkyOverlay } from "./SkyOverlay";

const BEAT_MS = 2400;
const INTRO_MS = 650;
const TOTAL_MS = 1400;

interface FeatureRevealProps {
  imageUrl: string;
  analysis: SkyAnalysis;
  highlights: SignificantFeature[];
  totalPoints: number;
  selectedId: string | null;
  onSelect: (figure: SkyFigure) => void;
  revealedStarIds?: ReadonlySet<string> | null;
  onSettled?: () => void;
  /** Frame-level rarity, kept for callers. Details open on a tap. */
  frameRarity?: string | null;
  /** Fired once each catch lands in the diagram. */
  onCatch?: (feature: SignificantFeature) => void;
  /** Fired once a constellation's creature has finished forming. */
  onCreature?: (creature: StoredCreature) => void;
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
  onCatch,
  onCreature,
}: FeatureRevealProps) {
  // Weakest first so the highest-point catch lands last.
  const order = useMemo(
    () => [...highlights].sort((a, b) => a.points - b.points || b.rank - a.rank),
    [highlights],
  );
  const creatures = useMemo(
    () =>
      order.map((feature) =>
        creatureFromObject({
          id: feature.figureId,
          name: feature.figureName,
          kind: feature.kind,
          detail: "",
          motif: figureIdentity(feature.figureName, feature.kind).motif,
          accent: figureIdentity(feature.figureName, feature.kind).accent,
          highlightPoints: feature.points,
        }),
      ),
    [order],
  );
  const [animatedStep, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();
  const settledAt = order.length + 2;
  const step = reduced ? settledAt : animatedStep;
  const notifySettled = useEffectEvent(() => onSettled?.());
  const settledOnce = useRef(false);

  useEffect(() => {
    if (reduced || step >= settledAt) return;
    const delay =
      step === 0 ? INTRO_MS : step === order.length + 1 ? TOTAL_MS : BEAT_MS;
    const timer = window.setTimeout(() => setStep((current) => current + 1), delay);
    return () => window.clearTimeout(timer);
  }, [step, settledAt, order.length, reduced]);

  useEffect(() => {
    if (step >= settledAt && !settledOnce.current) {
      settledOnce.current = true;
      notifySettled();
    }
  }, [step, settledAt]);

  const featureIndex = step - 1;
  const showingFeature = step >= 1 && step <= order.length;
  const showingTotal = step === order.length + 1;
  const settled = step >= settledAt;
  const active = showingFeature ? order[featureIndex] : null;
  const notifyCatch = useEffectEvent((feature: SignificantFeature) => onCatch?.(feature));
  const flourishedId = useRef<string | null>(null);
  useEffect(() => {
    if (!active || flourishedId.current === active.figureId) return;
    flourishedId.current = active.figureId;
    notifyCatch(active);
  }, [active]);
  const unlocked = useMemo(() => {
    if (settled || reduced) return null;
    const ids = new Set<string>();
    const through = showingTotal ? order.length : featureIndex;
    for (let i = 0; i < through; i++) ids.add(order[i].figureId);
    return ids;
  }, [settled, reduced, showingTotal, featureIndex, order]);

  const spot = active
    ? analysis.figures.find((figure) => figure.id === active.figureId)
    : null;
  const look = active ? figureIdentity(active.figureName, active.kind) : null;
  const accent = look?.accent ?? "#ffd678";
  const spotX = spot ? `${Math.round(spot.labelX * 100)}%` : "50%";
  const spotY = spot ? `${Math.round(spot.labelY * 100)}%` : "40%";

  function skip() {
    setStep(settledAt);
  }

  const forming = showingFeature ? creatures[featureIndex] ?? null : null;
  const shownCreatures = (settled || reduced ? creatures : creatures.slice(0, Math.max(featureIndex, 0))).filter(
    (creature): creature is StoredCreature => creature !== null,
  );

  void totalPoints;

  return (
    <div className="flex flex-col gap-3">
      <section className="catch-hero" aria-label="Creatures forming from this sky">
        {forming ? (
          <CreatureCatch
            key={forming.id}
            creature={forming}
            durationMs={BEAT_MS}
            settle={false}
            onFormed={onCreature}
          />
        ) : null}
        {shownCreatures
          .filter((creature) => creature.id !== forming?.id)
          .map((creature) => (
            <CreatureCatch
              key={creature.id}
              creature={creature}
              durationMs={BEAT_MS}
              settle
              onFormed={onCreature}
            />
          ))}
        {!forming && shownCreatures.length === 0 ? (
          <p className="catch-added">The creature is gathering.</p>
        ) : null}
      </section>
      <p className="text-xs uppercase tracking-[0.16em] text-amber-200/70">
        Tap a pattern
      </p>
      <ul className="flex flex-wrap gap-2">
        {highlights.map((feature) => {
          const lit =
            settled ||
            reduced ||
            unlocked?.has(feature.figureId) ||
            active?.figureId === feature.figureId;
          const chip = figureIdentity(feature.figureName, feature.kind);
          const current =
            selectedId === feature.figureId || active?.figureId === feature.figureId;
          return (
            <li key={feature.figureId}>
              <button
                type="button"
                onClick={() => {
                  const fig = analysis.figures.find((item) => item.id === feature.figureId);
                  if (fig) onSelect(fig);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  current ? "text-zinc-50" : lit ? "text-zinc-100" : "border-zinc-800 text-zinc-600"
                }`}
                style={
                  lit
                    ? {
                        borderColor: chip.accent,
                        backgroundColor: current ? `${chip.accent}40` : `${chip.accent}18`,
                      }
                    : undefined
                }
              >
                {feature.figureName}
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
