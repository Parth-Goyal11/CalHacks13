"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { creatureGift, qualityTracks, type StoredCreature } from "./collection";
import ConstellationMap from "./ConstellationMap";
import CreaturePortrait from "./CreaturePortrait";

export default function CreatureCatch({
  creature,
  durationMs,
  settle,
  onFormed,
}: {
  creature: StoredCreature;
  durationMs: number;
  settle: boolean;
  onFormed?: (creature: StoredCreature) => void;
}) {
  const [animation, setAnimation] = useState({ id: creature.id, progress: 0 });
  const reduced = usePrefersReducedMotion();
  const progress = settle || reduced ? 1 : animation.id === creature.id ? animation.progress : 0;
  const formed = useRef(new Set<string>());
  const notifyFormed = useEffectEvent(() => onFormed?.(creature));
  const tracks = creature.tracks?.length ? creature.tracks : qualityTracks(creature);
  const gift = creatureGift(creature);

  useEffect(() => {
    if (settle || reduced) {
      if (!formed.current.has(creature.id)) {
        formed.current.add(creature.id);
        notifyFormed();
      }
      return;
    }
    const start = performance.now();
    let frame = 0;
    let cancel = false;
    const tick = (now: number) => {
      if (cancel) return;
      const next = Math.min(1, (now - start) / Math.max(durationMs, 1));
      setAnimation({ id: creature.id, progress: next });
      if (next < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (!formed.current.has(creature.id)) {
        formed.current.add(creature.id);
        notifyFormed();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancel = true;
      cancelAnimationFrame(frame);
    };
  }, [creature.id, durationMs, settle, reduced]);

  return (
    <article
      className={`catch-pair tier-${creature.tier.toLowerCase()}`}
      style={{ ["--form" as string]: progress.toFixed(3) }}
    >
      <ConstellationMap
        name={creature.name}
        tier={creature.tier}
        progress={progress}
        accent={creature.accent}
      />
      <div className="forming-portrait">
        <p className="catch-name">
          {creature.name} · Tier {creature.tier}
        </p>
        <CreaturePortrait creature={creature} />
        <p className="catch-added">
          {progress >= 1
            ? `${gift.epithet} · +${gift.score} ${gift.boost}`
            : "Forming with the stars"}
        </p>
        {progress >= 1 ? (
          <ul className="quality-tracks">
            {tracks.map((track) => (
              <li key={track.key}>
                <span>{track.label}</span> {track.value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
