"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SkyFigure } from "@calhacks13/lib";
import { AngleFovPanel } from "../sky/AngleFovPanel";
import { FigurePanel } from "../sky/FigurePanel";
import { IdentificationFeed } from "../sky/IdentificationFeed";
import { ScoreBreakdown } from "../sky/ScoreBreakdown";
import { SkyOverlay } from "../sky/SkyOverlay";
import { StarStructure } from "../sky/StarStructure";
import { IconButton } from "./SkyIcon";
import type { DiscoveryProps } from "./Discovery";
import { revealFigures } from "./reveal-analysis";

/** Ben's original result components inside Yonder's modal and Memories actions. */
export default function RevealDiscovery({ photo, saved, saving, error, onSave, onClose }: DiscoveryProps) {
  const reveal = photo.result!.reveal!;
  const { score, verification, prediction, fovCheck, meta } = reveal;
  const analysis = useMemo(() => ({ ...reveal.analysis, figures: revealFigures(reveal) }), [reveal]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<SkyFigure | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const total = verification.acceptedStars.length;
  const revealing = revealedCount < total;
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!revealing) return;
    const timer = window.setTimeout(() => setRevealedCount((count) => count + 1), revealedCount === 0 ? 400 : 550);
    return () => window.clearTimeout(timer);
  }, [revealing, revealedCount]);
  const revealedStarIds = useMemo(() => new Set(verification.acceptedStars.slice(0, revealedCount).map((star) => star.starId)), [verification, revealedCount]);
  return <dialog ref={dialog} className="overlay-dialog yonder-reveal" aria-label={`Discover ${photo.title}`} onCancel={(event) => { event.preventDefault(); if (selected) setSelected(null); else onClose(); }}>
    <header className="reveal-toolbar">
      <IconButton label="Close discovery" icon="close" onClick={onClose} />
      <span>Your sky</span>
      <button type="button" disabled={saving} onClick={onSave}>{saving ? "Saving…" : saved ? "Saved · remove" : "Save memory"}</button>
    </header>
    <main className="reveal-content">
      <div><p className="reveal-eyebrow">Catalog-checked · model estimate</p><h1>{analysis.headline}</h1><p>{analysis.overview}</p>{analysis.skyConditions && <p>{analysis.skyConditions}</p>}</div>
      <div className="reveal-image"><SkyOverlay imageUrl={photo.image} analysis={analysis} selectedId={selected?.id ?? null} onSelect={setSelected} revealedStarIds={revealedStarIds} progressive /></div>
      <IdentificationFeed verification={verification} revealedCount={revealedCount} revealing={revealing} />
      {revealing && <button className="reveal-skip" type="button" onClick={() => setRevealedCount(total)}>Show all results</button>}
      {!analysis.figures.length && <p>No objects could be confidently identified in this photo. You can save it or try a clearer night-sky image.</p>}
      <div className="reveal-figures">{analysis.figures.map((figure) => <button key={figure.id} type="button" aria-pressed={selected?.id === figure.id} onClick={() => setSelected(figure)}>{figure.name}</button>)}</div>
      <FigurePanel key={selected?.id ?? "none"} figure={selected} meta={meta} onClose={() => setSelected(null)} />
      {!revealing && <><ScoreBreakdown score={score} /><StarStructure analysis={analysis} selected={selected} onSelect={setSelected} /></>}
      {prediction && <AngleFovPanel prediction={prediction} fovCheck={fovCheck} />}
      <p className="reveal-footnote">Catalog checks compare model detections with star patterns. These results are estimates, not an Astrometry plate solve. Camera direction is {meta.facingDegrees == null ? "unknown" : `${meta.facingDegrees}°`}; elevation {meta.elevationDegrees ?? 40}° and field of view {meta.fovDegrees ?? 70}°{meta.elevationDegrees == null || meta.fovDegrees == null ? " include assumed values" : ""}.</p>
      {error && <p role="alert">{error}</p>}
    </main>
  </dialog>;
}
