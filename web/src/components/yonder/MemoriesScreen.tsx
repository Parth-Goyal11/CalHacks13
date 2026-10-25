/* eslint-disable @next/next/no-img-element -- Memories display original photos from local Blob storage. */
import { useState } from "react";
import { COLLECTION_TIERS, TIER_PERKS, type StoredCreature } from "./collection";
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
  const opened = creatures.find((creature) => creature.id === openId) ?? null;
  return (
    <section
      className="screen scroll-screen my-sky"
      aria-labelledby="sky-title"
    >
      <section className="creature-collection" aria-label="Creature collection">
        <div className="collection-heading">
          <h2>Collection</h2>
          <button type="button" onClick={() => setPerksOpen((open) => !open)}>
            {perksOpen ? "Hide tiers" : "Tier perks"}
          </button>
        </div>
        {perksOpen ? (
          <ul className="tier-list">
            {COLLECTION_TIERS.map((tier) => (
              <li key={tier}>
                <strong>{tier}</strong> {TIER_PERKS[tier].perk}
                <span>{TIER_PERKS[tier].detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {creatures.length ? (
          <ul className="creature-row">
            {creatures.map((creature) => (
              <li key={creature.id}>
                <button
                  type="button"
                  className={openId === creature.id ? "is-open" : ""}
                  onClick={() => setOpenId((current) => (current === creature.id ? null : creature.id))}
                >
                  <b>{creature.tier}</b>
                  {creature.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="collection-empty">Patterns you catch become creatures.</p>
        )}
        {opened ? (
          <div className="creature-card">
            <p>
              Tier {opened.tier} · {opened.perk}
            </p>
            <CreaturePortrait creature={opened} />
            <p>{opened.perkDetail}</p>
          </div>
        ) : null}
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
