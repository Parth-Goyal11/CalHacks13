/* eslint-disable @next/next/no-img-element -- Memories display original photos from local Blob storage. */
import { useState } from "react";
import { COLLECTION_TIERS, qualityTracks, TIER_PERKS, type StoredCreature } from "./collection";
import ConstellationMap from "./ConstellationMap";
import CreaturePortrait from "./CreaturePortrait";
import type { SkyPhoto } from "./sky-data";
import { SkyIcon } from "./SkyIcon";

export default function MemoriesScreen({
  savedPhotos,
  creatures,
  onOpen,
  onCapture,
}: {
  savedPhotos: SkyPhoto[];
  creatures: StoredCreature[];
  onOpen: (photo: SkyPhoto) => void;
  onCapture: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [perksOpen, setPerksOpen] = useState(false);
  const openCreature = creatures.find((creature) => creature.id === openId) ?? null;
  const openTracks = openCreature
    ? openCreature.tracks?.length
      ? openCreature.tracks
      : qualityTracks(openCreature)
    : [];
  return (
    <section
      className="screen scroll-screen my-sky"
      aria-labelledby="sky-title"
    >
      <header className="page-header gallery-header">
        <div>
          <p className="eyebrow">Your sky archive</p>
          <h1 id="sky-title">Memories</h1>
        </div>
        <span className="photo-count">
          <strong>{savedPhotos.length}</strong>
          <small>skies</small>
        </span>
      </header>

      <section className="memory-collection" aria-label="Creature collection">
        <div className="memory-intro">
          <p>
            {creatures.length
              ? `${creatures.length} ${creatures.length === 1 ? "creature" : "creatures"}, each beside its star map.`
              : "Catch a constellation and its creature forms here."}
          </p>
          <button type="button" onClick={() => setPerksOpen((open) => !open)}>
            {perksOpen ? "Hide tiers" : "Tier perks"}
          </button>
        </div>
        {perksOpen ? (
          <ul className="tier-rail">
            {[...COLLECTION_TIERS].reverse().map((tier) => (
              <li key={tier} className={`tier-${tier.toLowerCase()}`}>
                <strong>
                  {tier} · {TIER_PERKS[tier].perk}
                </strong>
                <span>{TIER_PERKS[tier].detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {creatures.length ? (
          <ul className="memory-rail">
            {creatures.map((creature) => {
              const open = openId === creature.id;
              return (
                <li key={creature.id} className={`memory-card tier-${creature.tier.toLowerCase()}`}>
                  <button
                    type="button"
                    aria-pressed={open}
                    onClick={() => setOpenId((current) => (current === creature.id ? null : creature.id))}
                  >
                    <ConstellationMap
                      name={creature.name}
                      tier={creature.tier}
                      progress={1}
                      accent={creature.accent}
                    />
                    <CreaturePortrait creature={creature} />
                    <span className="memory-copy">
                      <b>{creature.name}</b>
                      <small>
                        Tier {creature.tier} · {creature.perk}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {openCreature ? (
          <div className="memory-detail">
            <p>
              {openCreature.name} · Tier {openCreature.tier}
            </p>
            <ul className="quality-tracks">
              {openTracks.map((track) => (
                <li key={track.key}>
                  <span>{track.label}</span> {track.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {savedPhotos.length ? (
        <>
          <div className="gallery-intro">
            <p>A quiet record of where you looked up.</p>
            <button
              type="button"
              aria-label="Add another sky photo"
              onClick={() => onCapture()}
            >
              <SkyIcon name="plus" size={20} />
            </button>
          </div>
          <div className="photo-grid">
            {savedPhotos.map((photo, index) => (
              <button
                type="button"
                className="gallery-photo"
                key={photo.id}
                onClick={() => onOpen(photo)}
              >
                <img src={photo.image} alt={`${photo.title} night sky`} />
                <span className="gallery-shade" />
                <span className="gallery-meta">
                  <strong>{photo.title}</strong>
                  <small>
                    {photo.date.split("·")[0]} · {photo.objects.length} objects
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state memory-empty">
          <span>
            <SkyIcon name="gallery" size={30} />
          </span>
          <h2>No sky photos yet</h2>
          <p>Your saved photos and celestial discoveries will gather here.</p>
          <button type="button" onClick={() => onCapture()}>
            Capture the sky
          </button>
        </div>
      )}
    </section>
  );
}
