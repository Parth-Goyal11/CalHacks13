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
  return (
    <section
      className="screen scroll-screen my-sky"
      aria-labelledby="sky-title"
    >
      <section className="creature-collection" aria-label="Creature collection">
        <div className="collection-heading">
          <h2>Creatures</h2>
          <button type="button" onClick={() => setPerksOpen((open) => !open)}>
            {perksOpen ? "Hide tiers" : "Tier perks"}
          </button>
        </div>
        {perksOpen ? (
          <ul className="tier-list">
            {[...COLLECTION_TIERS].reverse().map((tier) => (
              <li key={tier} className={`tier-${tier.toLowerCase()}`}>
                <strong>{tier}</strong> {TIER_PERKS[tier].perk}
                <span>{TIER_PERKS[tier].detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {creatures.length ? (
          <ul className="creature-row">
            {creatures.map((creature) => {
              const tracks = creature.tracks?.length ? creature.tracks : qualityTracks(creature);
              const open = openId === creature.id;
              return (
                <li key={creature.id} className={`creature-card caught-pair tier-${creature.tier.toLowerCase()}`}>
                  <ConstellationMap
                    name={creature.name}
                    tier={creature.tier}
                    progress={1}
                    accent={creature.accent}
                  />
                  <div>
                    <button
                      type="button"
                      className={open ? "is-open" : ""}
                      onClick={() => setOpenId((current) => (current === creature.id ? null : creature.id))}
                    >
                      <span className="collection-copy">
                        <b>
                          Tier {creature.tier} · {creature.name}
                        </b>
                        <small>{open ? "Hide what was kept" : creature.perk}</small>
                      </span>
                    </button>
                    <CreaturePortrait creature={creature} />
                    {open ? (
                      <ul className="quality-tracks">
                        {tracks.map((track) => (
                          <li key={track.key}>
                            <span>{track.label}</span> {track.value}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="collection-empty">Catch a constellation and its creature forms here, beside its star map.</p>
        )}
      </section>
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
                className={`gallery-photo photo-${index % 3}`}
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
        <div className="empty-state">
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
