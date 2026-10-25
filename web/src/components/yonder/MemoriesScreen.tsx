/* eslint-disable @next/next/no-img-element -- Memories display original photos from local Blob storage. */
import { useState } from "react";
import { COLLECTION_TIERS, collectionPower, creatureGift, nextEvolution, qualityTracks, TIER_PERKS, type StoredCreature } from "./collection";
import ConstellationMap from "./ConstellationMap";
import CreaturePortrait from "./CreaturePortrait";
import { demoSkies, type SkyPhoto } from "./sky-data";
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
  const galleryById = new Map(savedPhotos.map((photo) => [photo.id, photo]));
  for (const photo of demoSkies) {
    if (!galleryById.has(photo.id)) galleryById.set(photo.id, photo);
  }
  const galleryPhotos = [...galleryById.values()];
  const openCreature = creatures.find((creature) => creature.id === openId) ?? null;
  const openTracks = openCreature
    ? openCreature.tracks?.length
      ? openCreature.tracks
      : qualityTracks(openCreature)
    : [];
  const power = collectionPower(creatures);
  const evolve = nextEvolution(creatures);
  const openGift = openCreature ? creatureGift(openCreature) : null;
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
          <strong>{galleryPhotos.length}</strong>
          <small>skies</small>
        </span>
      </header>

      {creatures.length > 0 && (
        <section className="memory-collection" aria-label="Creature collection">
          <div className="memory-intro">
            <p>
              {creatures.length
                ? `${power} power · ${
                    evolve
                      ? evolve.gift.gap === 0
                        ? `photograph ${evolve.creature.name} again`
                        : `${evolve.creature.name} needs ${evolve.gift.gap} pts`
                      : "every creature is Myth"
                  }`
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
                    {tier} · {TIER_PERKS[tier].perk} · +{creatureGift({ name: tier, tier, points: 0 }).score}
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
                const gift = creatureGift(creature);
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
                        <small>{gift.epithet}</small>
                        <span className="creature-boost">
                          +{gift.score} {gift.boost}
                        </span>
                        <span className="evolve-note">
                          {gift.gap == null
                            ? "Myth tier"
                            : gift.gap === 0
                              ? `Photograph again for ${gift.nextTier}`
                              : `${gift.gap} pts to ${gift.nextTier}`}
                        </span>
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
              {openGift ? <p className="evolve-note">{openGift.quest}</p> : null}
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
      )}

      {galleryPhotos.length ? (
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
            {galleryPhotos.map((photo) => (
              <button
                type="button"
                className="gallery-photo"
                key={photo.id}
                onClick={() => onOpen(photo)}
              >
                <span className="gallery-thumbnail">
                  <img src={photo.image} alt={`${photo.title} night sky`} loading="lazy" />
                </span>
                <span className="gallery-meta">
                  <strong>{photo.title}</strong>
                  <small>
                    {photo.curated
                      ? [photo.objects[0]?.name, `${photo.objects.length} ${photo.objects.length === 1 ? "highlight" : "highlights"}`].filter(Boolean).join(" · ")
                      : [photo.date.split("·")[0], `${photo.objects.length} objects`].filter(Boolean).join(" · ")}
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
