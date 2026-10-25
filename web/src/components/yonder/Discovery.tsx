"use client";

/* eslint-disable @next/next/no-img-element -- Original user files and solver JPEGs must retain their geometry. */
import { useEffect, useRef, useState } from "react";
import { annotationUrl, identificationLabel } from "./analysis";
import { FeatureReveal } from "@/components/sky/FeatureReveal";
import { creatureFromObject, qualityTracks } from "./collection";
import ConstellationMap from "./ConstellationMap";
import CreaturePortrait from "./CreaturePortrait";
import type { StoredCreature } from "./collection";
import { IconButton, SkyIcon } from "./SkyIcon";
import type { CelestialObject, SkyPhoto } from "./sky-data";
import ObjectExplanation from "./ObjectExplanation";

export type DiscoveryProps = {
  photo: SkyPhoto;
  saved: boolean;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onClose: () => void;
  onCreature?: (creature: StoredCreature) => void;
};

export default function Discovery({
  photo,
  saved,
  saving,
  error,
  onSave,
  onClose,
  onCreature,
}: {
  photo: SkyPhoto;
  saved: boolean;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onClose: () => void;
  onCreature?: (creature: StoredCreature) => void;
}) {
  const [selected, setSelected] = useState<CelestialObject | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [annotationFailed, setAnnotationFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const detailClose = useRef<HTMLButtonElement>(null);
  const objectTrigger = useRef<HTMLElement | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const [imageFrame, setImageFrame] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const result = photo.result;
  const annotated = annotationUrl(result);
  const real = Boolean(result);

  useEffect(() => {
    dialog.current?.showModal();
    const element = dialog.current;
    if (!element) return;
    const observer = new ResizeObserver(updateImageFrame);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selected) detailClose.current?.focus();
    else objectTrigger.current?.focus();
  }, [selected]);

  function selectObject(object: CelestialObject) {
    objectTrigger.current = document.activeElement as HTMLElement | null;
    setSelected(object);
  }

  function updateImageFrame() {
    const element = image.current;
    if (!element?.naturalWidth || !element.naturalHeight) return;
    const scale = Math.min(
      element.clientWidth / element.naturalWidth,
      element.clientHeight / element.naturalHeight,
    );
    const width = element.naturalWidth * scale;
    const height = element.naturalHeight * scale;
    setImageFrame({
      left: (element.clientWidth - width) / 2,
      top: (element.clientHeight - height) / 2,
      width,
      height,
    });
  }

  return (
    <dialog
      ref={dialog}
      className={`discovery overlay-dialog ${real || photo.curated ? "real-discovery" : ""} ${result?.reveal ? "figma-discovery has-diagrams" : ""}`}
      aria-label={`Discover ${photo.title}`}
      onCancel={(event) => {
        event.preventDefault();
        if (selected) setSelected(null);
        else if (analysisOpen) setAnalysisOpen(false);
        else onClose();
      }}
    >
      {!result?.reveal && !imageFailed ? (
        <img
          ref={image}
          className="discovery-photo"
          src={
            showLabels && annotated && !annotationFailed
              ? annotated
              : photo.image
          }
          alt={
            showLabels && annotated && !annotationFailed
              ? "Your photo with plate-solved star labels"
              : `${photo.title} night sky`
          }
          onError={() => {
            if (showLabels && annotated && !annotationFailed)
              setAnnotationFailed(true);
            else setImageFailed(true);
          }}
          onLoad={updateImageFrame}
        />
      ) : (
        <div className="image-failure">
          Your photo cannot be previewed in this browser. Its analysis is
          available below.
        </div>
      )}
      {!result?.reveal && <div className="discovery-vignette" />}
      <div className="discovery-top">
        <IconButton label="Close discovery" icon="close" onClick={onClose} />
        <div>
          <p>{real ? "Your sky" : photo.curated ? "Sky highlights" : "Sample sky"}</p>
          <span>
            {result?.reveal ? <><i /> {photo.objects.length} objects found</> : real ? identificationLabel(result) : photo.curated ? "Photo highlights" : "Illustrative markers"}
          </span>
        </div>
        <button
          type="button"
          className={`icon-button ${saved ? "is-active" : ""}`}
          aria-label={
            saved ? "Remove photo from Memories" : "Save photo to Memories"
          }
          aria-pressed={saved}
          disabled={saving}
          onClick={onSave}
        >
          <SkyIcon name="bookmark" />
        </button>
      </div>
      {!result?.reveal && (
        <div className="photo-caption">
          <strong>{photo.title}</strong>
          <span>{photo.date}</span>
        </div>
      )}
      {result?.reveal && (
        <div className="discovery-reveal">
          <FeatureReveal
            imageUrl={photo.image}
            analysis={result.reveal.analysis}
            highlights={result.reveal.score.highlights}
            totalPoints={result.reveal.score.figurePointsTotal}
            selectedId={selected?.figureId ?? null}
            frameRarity={result.reveal.score.rarity}
            onSelect={(figure) => {
              const match = photo.objects.find((object) => object.figureId === figure.id);
              if (match) selectObject(match);
            }}
            onCreature={onCreature}
          />
        </div>
      )}
      {!result?.reveal && annotated && !annotationFailed && (
        <button
          type="button"
          className="annotation-toggle"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((value) => !value)}
        >
          {showLabels ? "Original photo" : "Show star labels"}
        </button>
      )}

      {!result?.reveal && !imageFailed && (
        <div
          className="verified-marker-plane"
          style={real || photo.curated ? imageFrame : { inset: 0 }}
        >
          {photo.objects
            .filter(
              (object) =>
                typeof object.x === "number" && typeof object.y === "number",
            )
            .map((object) => (
              <button
                type="button"
                key={object.id}
                aria-label={`Learn about ${object.name}`}
                aria-pressed={selected?.id === object.id}
                className={`sky-marker ${object.tone ?? ""} ${object.highlightRank ? "is-highlighted" : ""} ${selected?.id === object.id ? "selected" : ""}`}
                style={{ left: `${object.x}%`, top: `${object.y}%` }}
                onClick={() => selectObject(object)}
              >
                <span className="marker-ring" style={object.accent ? { borderColor: object.accent } : undefined} />
                <span className="marker-dot" style={object.accent ? { background: object.accent, boxShadow: `0 0 8px ${object.accent}` } : undefined} />
                <span className="marker-label">{object.name}</span>
              </button>
            ))}
        </div>
      )}

      {result?.reveal && !selected && (
        <button className="discovery-details-toggle" type="button" aria-expanded={analysisOpen} aria-controls="photo-analysis" onClick={() => setAnalysisOpen((open) => !open)}>
          <SkyIcon name="spark" size={15} /> {analysisOpen ? "Back to your sky" : photo.objects.length ? "Your discoveries" : "No objects identified"}
        </button>
      )}
      {real && (!result?.reveal || analysisOpen) && !selected && (
        <section id="photo-analysis" className="analysis-summary" aria-label="Photo analysis">
          {result?.reveal && <p className="review-note">{result.reveal.analysis.overview}</p>}
          {error && (
            <p role="alert" className="review-note">
              {error}
            </p>
          )}
          {result?.needs_review && (
            <p className="review-note">
              {result.identity?.method === "captured"
                ? "This photo is saved in Memories. Analyze it to identify the sky."
                : result.identity?.method === "plate-solved"
                  ? "Star positions are solved. The vision review is unavailable."
                  : "Identification needs review. Model suggestions are not confirmed detections."}
            </p>
          )}
          {photo.objects.length ? (
            <>
              <p className="result-label">
                {result?.identity?.method === "plate-solved"
                  ? "Identified in your photo"
                  : "Suggested in your photo"}
              </p>
              <div className="detection-list">
                {photo.objects.map((object) => (
                  <button
                    type="button"
                    key={object.id}
                    onClick={() => selectObject(object)}
                  >
                    <SkyIcon name="spark" size={16} />
                    <span>{object.name}</span>
                    <SkyIcon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="no-detections">
              <h2>No named objects confirmed</h2>
              <p>
                Your photo is kept as captured. Try a darker sky or a longer
                exposure for more detail.
              </p>
            </div>
          )}
          <details className="analysis-details">
            <summary>Photo details</summary>
            <dl>
              {typeof result?.metrics?.star_count === "number" && (
                <div>
                  <dt>Star-like points</dt>
                  <dd>{result.metrics.star_count}</dd>
                </div>
              )}
              {typeof result?.identity?.confidence === "number" && (
                <div>
                  <dt>Identification confidence</dt>
                  <dd>{Math.round(result.identity.confidence * 100)}%</dd>
                </div>
              )}
              {typeof (result?.final_score ?? result?.score) === "number" && (
                <div>
                  <dt>Photo score</dt>
                  <dd>{result?.final_score ?? result?.score}</dd>
                </div>
              )}
              {result?.rarity && (
                <div>
                  <dt>Rarity</dt>
                  <dd>{result.rarity}</dd>
                </div>
              )}
            </dl>
            {result?.reveal && <>
              <dl>
                {Object.entries(result.reveal.score.rubric ?? {}).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}/10</dd></div>)}
                <div><dt>Award points</dt><dd>{result.reveal.score.award?.points ?? 0}</dd></div>
              </dl>
              <p>{result.reveal.verification.summary}</p>
              <p>{result.reveal.fovCheck.summary}</p>
              <p>Catalog checks compare model detections with star patterns; this is not an Astrometry plate solve.</p>
              <p>{result.reveal.score.figurePointsTotal} identification points. {result.reveal.score.capNotes.join(" ")}</p>
              {(result.reveal.score.highlights ?? []).length > 0 && <div className="analysis-highlights" aria-label="Ben's scored sky highlights">
                <h3>Scored highlights</h3>
                {(result.reveal.score.highlights ?? []).map((feature) => <p key={feature.figureId}><strong>#{feature.rank} {feature.figureName}</strong> · +{feature.points} pts — {feature.reason}</p>)}
              </div>}
            </>}
            {result?.critique?.strengths?.map((text, index) => (
              <p key={`strength-${index}`}>{text}</p>
            ))}
            {result?.critique?.improvements?.map((text, index) => (
              <p key={`improvement-${index}`}>{text}</p>
            ))}
          </details>
          <p className="local-note">
            {saved
              ? "Saved on this device"
              : "Save to keep this photo on this device"}
          </p>
        </section>
      )}

      {selected && (
        <section
          className="object-sheet is-open"
          aria-label={`${selected.name} details`}
        >
          <span className="sheet-handle" />
          <div className="sheet-heading">
            <div>
              <p>{selected.kind}{selected.motif ? ` · ${selected.motif}` : ""}</p>
              {selected.highlightRank && <span className="selected-highlight">#{selected.highlightRank} scored highlight · +{selected.highlightPoints ?? 0} pts</span>}
              <h2>{selected.name}</h2>
              {creatureFromObject(selected) ? (
                <p className="creature-tier">
                  Tier {creatureFromObject(selected)?.tier} · {creatureFromObject(selected)?.perk}
                </p>
              ) : null}
            </div>
            <button
              ref={detailClose}
              type="button"
              className="icon-button"
              aria-label="Close object details"
              onClick={() => setSelected(null)}
            >
              <SkyIcon name="close" />
            </button>
          </div>
          {creatureFromObject(selected) ? (
            <div className={`caught-pair tier-${creatureFromObject(selected)!.tier.toLowerCase()}`}>
              <ConstellationMap
                name={selected.name}
                tier={creatureFromObject(selected)!.tier}
                progress={1}
                accent={creatureFromObject(selected)!.accent}
              />
              <div>
                <CreaturePortrait creature={creatureFromObject(selected)!} />
                <ul className="quality-tracks">
                  {(creatureFromObject(selected)!.tracks ?? qualityTracks(creatureFromObject(selected)!)).map((track) => (
                    <li key={track.key}>
                      <span>{track.label}</span> {track.value}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <details className="analysis-details">
            <summary>About this pattern</summary>
            <p className="object-detail">{selected.detail}</p>
            {selected.highlightReason && <p className="highlight-reason">{selected.highlightReason}</p>}
          </details>
          {result?.reveal && selected.figureId && <ObjectExplanation key={selected.id} reveal={result.reveal} figureId={selected.figureId} />}
          <div className="sheet-footer">
            <span>
              <SkyIcon name="spark" size={17} />
              {real ? "In your analysis" : "Sample discovery"}
            </span>
            <button type="button" disabled={saving} onClick={onSave}>
              {saving
                ? "Saving…"
                : saved
                  ? "Remove from Memories"
                  : "Save discovery"}
            </button>
          </div>
        </section>
      )}
    </dialog>
  );
}
