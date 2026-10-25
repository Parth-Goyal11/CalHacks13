"use client";

import { useEffect, useRef, useState } from "react";
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
  const [progress, setProgress] = useState(settle ? 1 : 0);
  const formed = useRef(false);
  const creatureRef = useRef(creature);
  const onFormedRef = useRef(onFormed);
  creatureRef.current = creature;
  onFormedRef.current = onFormed;
  const tracks = creature.tracks?.length ? creature.tracks : qualityTracks(creature);
  const gift = creatureGift(creature);

  useEffect(() => {
    if (settle) {
      setProgress(1);
      if (!formed.current) {
        formed.current = true;
        onFormedRef.current?.(creatureRef.current);
      }
      return;
    }
    const start = performance.now();
    let frame = 0;
    let cancel = false;
    const tick = (now: number) => {
      if (cancel) return;
      const next = Math.min(1, (now - start) / Math.max(durationMs, 1));
      setProgress(next);
      if (next < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (!formed.current) {
        formed.current = true;
        onFormedRef.current?.(creatureRef.current);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancel = true;
      cancelAnimationFrame(frame);
    };
  }, [creature.id, durationMs, settle]);

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
