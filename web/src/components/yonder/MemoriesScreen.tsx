/* eslint-disable @next/next/no-img-element -- Memories display original photos from local Blob storage. */
import type { SkyPhoto } from "./sky-data";
import { SkyIcon } from "./SkyIcon";

export default function MemoriesScreen({
  savedPhotos,
  onOpen,
  onCapture,
}: {
  savedPhotos: SkyPhoto[];
  onOpen: (photo: SkyPhoto) => void;
  onCapture: () => void;
}) {
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
