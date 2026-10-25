"use client";

/* eslint-disable @next/next/no-img-element -- Original local blob photos and solver JPEGs must render without the Next image optimizer. */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { ScoreResult, SkyAnalysis, SkyFigure } from "@calhacks13/lib";
import { dataUrlToBase64 } from "@/lib/image";
import type { SceneSketch } from "@/lib/sample-scene";
import { sampleScene } from "@/lib/sample-scene";
import { SkyAmbience } from "@/lib/sky-ambience";
import { catchTier } from "@/components/sky/catch-show";
import { FeatureReveal } from "@/components/sky/FeatureReveal";
import { IdentifyScan } from "@/components/sky/IdentifyScan";
import { SkyOverlay } from "@/components/sky/SkyOverlay";
import YourSkyShell from "./YourSkyShell";
import { SkyIcon } from "./SkyIcon";
import { learningFor, objectsFromResult, sampleObjects, sampleResult, type PhotoObject } from "./photo-discoveries";
import { loadPlace } from "./place-store";
import type { SkyPhotoResult } from "./photo-types";
import { previewPlace } from "./tonight-data";
import styles from "./YourSky.module.css";
import capture from "./Capture.module.css";

type Photo = { file: File | null; url: string; demo: boolean };
type Step = "start" | "review" | "analyzing" | "result";

type LiveAnalysis = {
  analysis: SkyAnalysis;
  score: ScoreResult;
};

export default function CaptureExperience() {
  const [step, setStep] = useState<Step>("start");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<SkyPhotoResult | null>(null);
  const [live, setLive] = useState<LiveAnalysis | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sketch, setSketch] = useState<SceneSketch | null>(null);
  const [muted, setMuted] = useState(false);
  const [selectedFigure, setSelectedFigure] = useState<SkyFigure | null>(null);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const searchParams = useSearchParams();
  const missionTitle = searchParams.get("title") ?? "";
  const [claimedTarget, setClaimedTarget] = useState(missionTitle);
  const [selected, setSelected] = useState<PhotoObject | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotationFailed, setAnnotationFailed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const nativeCameraInput = useRef<HTMLInputElement>(null);
  const cameraDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const photoReader = useRef<FileReader | null>(null);
  const ambience = useRef<SkyAmbience | null>(null);

  useEffect(() => {
    if (missionTitle) setClaimedTarget(missionTitle);
  }, [missionTitle]);

  useEffect(() => () => { request.current?.abort("navigation"); photoReader.current?.abort(); stream.current?.getTracks().forEach((track) => track.stop()); ambience.current?.stop(); }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  useEffect(() => {
    const dialog = cameraDialog.current;
    if (!cameraOpen) { dialog?.close(); return; }
    dialog?.showModal();
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    async function connectCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
      } catch {
        if (!cancelled) setCameraError("We could not open the camera. Use your phone camera or choose an existing photo instead.");
      }
    }
    void connectCamera();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      document.body.style.overflow = previousOverflow;
    };
  }, [cameraOpen]);

  useEffect(() => {
    if (!selected) { detailDialog.current?.close(); return; }
    detailDialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);

  function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError("Choose a photo smaller than 20 MB."); return; }
    if (!/\.(jpe?g|png|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|heic|heif)$/.test(file.type)) {
      setError("Choose a JPEG, PNG or HEIC sky photo."); return;
    }
    request.current?.abort(); requestId.current += 1;
    photoReader.current?.abort();
    const reader = new FileReader(); photoReader.current = reader;
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPhoto({ file, url: reader.result, demo: false });
      setPreviewFailed(false); setAnnotationFailed(false); setResult(null); setLive(null); setError(""); setSelected(null); setSelectedFigure(null); setShowAnnotations(true); setStep("review");
      setCameraOpen(false);
    };
    reader.onerror = () => setError("We could not open this photo. Choose another image and try again.");
    reader.readAsDataURL(file);
  }

  function trySample() {
    photoReader.current?.abort(); request.current?.abort(); requestId.current += 1;
    stopPiece();
    setPhoto({ file: null, url: "/your-sky/night-sky.jpg", demo: true });
    setPreviewFailed(false); setResult(null); setLive(null); setError(""); setAnnotationFailed(false); setShowAnnotations(true); setStep("review");
  }

  function stopPiece() {
    ambience.current?.stop();
    ambience.current = null;
  }

  function cancelAnalysis() {
    request.current?.abort(); requestId.current += 1;
    stopPiece();
    setStep("review"); setError("");
  }

  function openFigure(figure: SkyFigure) {
    setSelectedFigure(figure);
    setSelected({
      id: figure.id,
      name: figure.name,
      kind: figure.kind,
      x: Math.round(figure.labelX * 100),
      y: Math.round(figure.labelY * 100),
    });
  }

  async function analyzePhoto() {
    if (!photo || step === "analyzing") return;
    setError(""); setSelected(null); setSelectedFigure(null); setAnnotationFailed(false); setLive(null);
    if (photo.demo) { setResult(sampleResult); setStep("result"); return; }
    if (!photo.url.startsWith("data:")) return;
    const controller = new AbortController(); request.current = controller;
    const id = ++requestId.current;
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    const started = Date.now();
    setElapsed(0);
    setSketch(null);
    setStep("analyzing");
    const clock = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    ambience.current?.stop();
    const piece = new SkyAmbience();
    ambience.current = piece;
    piece.arm();
    piece.setMuted(muted);
    const place = loadPlace();
    const sceneTask = sampleScene(photo.url).then((sampled) => {
      if (id !== requestId.current) return sampled;
      setSketch(sampled);
      piece.playScene(sampled);
      return sampled;
    }).catch(() => null);
    try {
      const response = await fetch("/api/analyze-sky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: dataUrlToBase64(photo.url),
          mimeType: photo.file?.type || "image/jpeg",
          meta: {
            latitude: place.latitude,
            longitude: place.longitude,
            takenAt: new Date().toISOString(),
            locationLabel: place.name || previewPlace.name,
            notes: claimedTarget.trim() || undefined,
          },
        }),
      });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "service");
      const analysis = data.analysis as SkyAnalysis;
      const score = data.score as ScoreResult | null;
      if (!score) throw new Error("Sky reading came back without a score. Hit analyze again.");
      const scene = await sceneTask;
      piece.playSky(analysis, score, scene);
      setLive({ analysis, score });
      setResult({
        is_night_sky: true,
        rarity: score?.rarity,
        final_score: score?.figurePointsTotal,
        award: score?.award ? { badge: score.award.badge, points: score.award.points, card_foil: score.award.cardFoil } : null,
        identity: {
          method: "grok",
          constellations: analysis.figures.filter((figure) => figure.kind === "constellation" || figure.kind === "asterism").map((figure) => figure.name),
          named_stars: analysis.figures.filter((figure) => figure.kind === "star").map((figure) => figure.name),
          other: analysis.figures.filter((figure) => figure.kind !== "constellation" && figure.kind !== "asterism" && figure.kind !== "star").map((figure) => figure.name),
        },
      });
      setStep("result");
    } catch (error) {
      if (id !== requestId.current) return;
      piece.stop();
      ambience.current = null;
      const message = error instanceof Error ? error.message : "";
      setError(controller.signal.reason === "navigation" ? "Analysis stopped when you left. Your photo is still here. You can try again." : controller.signal.aborted ? "Analysis took too long. Your photo is still here. Try again or choose another photo." : message && message !== "service" ? message : "We could not analyze this photo right now. Your photo is still here. Try again, or explore the sample sky.");
      setStep("review");
    } finally { window.clearInterval(clock); window.clearTimeout(timeout); }
  }

  function takePhoto() {
    const feed = video.current;
    if (!feed?.videoWidth || !feed.videoHeight) return;
    const canvas = document.createElement("canvas"); canvas.width = feed.videoWidth; canvas.height = feed.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("We could not capture this frame. Choose an existing photo instead."); return; }
    context.drawImage(feed, 0, 0);
    canvas.toBlob((blob) => {
      if (!cameraDialog.current?.open) return;
      if (blob) choosePhoto(new File([blob], `your-sky-${Date.now()}.jpg`, { type: "image/jpeg" }));
      else setCameraError("We could not save this frame. Try taking the photo again.");
    }, "image/jpeg", .94);
  }

  const place = loadPlace();
  const liveFigures = live?.analysis.figures ?? [];
  const objects = result
    ? photo?.demo
      ? sampleObjects
      : live
        ? liveFigures.map((figure) => ({
            id: figure.id,
            name: figure.name,
            kind: figure.kind,
            x: Math.round(figure.labelX * 100),
            y: Math.round(figure.labelY * 100),
          }))
        : objectsFromResult(result)
    : [];
  const visibleObjects = objects.slice(0, 12);
  const annotatedSrc = !photo?.demo && result?.annotated_image_url && result.photo_id
    ? `/api/sky-photo/${encodeURIComponent(result.photo_id)}/annotated` : null;
  const imageSrc = showAnnotations && annotatedSrc && !annotationFailed ? annotatedSrc : photo?.url;
  const certainty = photo?.demo ? "Sample discoveries" : live ? (live.analysis.headline || "Your sky") : "Possible discoveries";
  const learning = selected ? learningFor(selected) : null;
  const selectedAward = selectedFigure
    ? live?.score.highlights.find((feature) => feature.figureId === selectedFigure.id) ?? null
    : null;
  const selectedTier = selectedAward ? catchTier(selectedAward.points, selectedAward.kind) : null;
  const showLiveScan = step === "analyzing" && photo && !photo.demo;
  const showCeremony = step === "result" && photo && live && live.score.highlights.length > 0;

  return <YourSkyShell active="capture">
    <div className={capture.experience}>
      <header className={styles.pageHeading}>
        <div><h1 ref={heading} tabIndex={-1}>{step === "start" ? "Capture your sky" : step === "review" ? "Your view of the sky" : step === "analyzing" ? "Looking a little closer" : "Discover your sky"}</h1>
          <p className={styles.date}>{step === "start" ? "A moment outside. Something new to notice." : photo?.demo ? "Demo photo. Illustrative highlights, not a live analysis." : step === "review" ? "Keep the original. Discover what might be there." : step === "analyzing" ? "Your photo is being analyzed. This can take about a minute." : "A little closer to the sky above you."}</p></div>
      </header>
      <input ref={uploadInput} className={capture.fileInput} type="file" tabIndex={-1} aria-label="Choose a sky photo" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={nativeCameraInput} className={capture.fileInput} type="file" tabIndex={-1} aria-label="Take a photo with your phone camera" accept="image/*" capture="environment" onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} />

      {error && <div className={capture.error} role="alert"><p>{error}</p><button className={styles.textButton} onClick={trySample}>Try a sample sky</button></div>}

      {step === "start" ? <div className={capture.start}>
        <div className={capture.startImage}><Image src="/your-sky/night-sky.jpg" alt="An illustrative star-filled sky above mountains" fill preload sizes="(max-width: 767px) 100vw, 560px" /><div className={capture.startHint}><SkyIcon name="camera" /><span>Start with a clear view up.</span></div></div>
        <div className={capture.startActions}><button className={styles.primary} onClick={() => { setCameraError(""); setCameraReady(false); setCameraOpen(true); }}><SkyIcon name="camera" /><span>Take a photo</span></button>
          <button className={capture.secondary} onClick={() => uploadInput.current?.click()}><SkyIcon name="collection" />Choose a photo</button>
          {missionTitle ? <p className={capture.notice}>You're here to photograph {missionTitle}. Take or choose a photo, then analyze it.</p> : null}
          <p className={capture.helper}>Your camera opens only when you choose. Photos upload when you tap Analyze photo.</p>
          <button className={styles.textButton} onClick={trySample}>Try a sample sky<SkyIcon name="arrow" /></button>
        </div>
      </div> : photo ? <div className={capture.discoveryLayout}>
        <div>
          {showLiveScan ? (
            <IdentifyScan
              imageUrl={photo.url}
              elapsed={elapsed}
              sketch={sketch}
              muted={muted}
              onToggleMute={() => {
                const next = !muted;
                setMuted(next);
                ambience.current?.setMuted(next);
              }}
            />
          ) : showCeremony && live ? (
            <FeatureReveal
              imageUrl={photo.url}
              analysis={live.analysis}
              highlights={live.score.highlights}
              totalPoints={live.score.figurePointsTotal}
              selectedId={selectedFigure?.id ?? null}
              onSelect={openFigure}
              frameRarity={live.score.rarity}
              onCatch={(feature) => ambience.current?.flourish?.(feature.figureName)}
            />
          ) : (
            <>
              <div className={capture.photoStage} aria-busy={step === "analyzing"}>
                {step === "result" && live && !previewFailed ? (
                  <SkyOverlay
                    imageUrl={photo.url}
                    analysis={live.analysis}
                    selectedId={selectedFigure?.id ?? null}
                    onSelect={openFigure}
                  />
                ) : !previewFailed ? (
                  <img key={imageSrc} src={imageSrc} alt={photo.demo ? "Sample night sky used to demonstrate discovery controls" : "Your original sky photo"} onError={() => setPreviewFailed(true)} />
                ) : (
                  <div className={capture.previewFallback}><SkyIcon name="collection" /><p>This browser cannot preview the photo. You can still try analyzing it.</p></div>
                )}
                {photo.demo && step === "result" && showAnnotations && !previewFailed && sampleObjects.map((object, index) => <button key={object.id} className={capture.hotspot} style={{ left: `${object.x}%`, top: `${object.y}%`, animationDelay: `${index * 260}ms` }} aria-label={`Learn about ${object.name}`} onClick={() => { setSelectedFigure(null); setSelected(object); }}><span className={capture.targetRing} /><span>{object.name}</span></button>)}
              </div>
              <div className={capture.photoToolbar}><span>{photo.demo ? "Sample photo" : "Original photo preserved"}</span>{step === "result" && photo.demo && <button className={styles.textButton} aria-pressed={showAnnotations} onClick={() => setShowAnnotations((value) => !value)}>{showAnnotations ? "Hide highlights" : "Show highlights"}</button>}</div>
            </>
          )}
        </div>
        <div className={capture.taskPanel}>
          {step === "review" ? <>
            <h2>Ready to look closer?</h2>
            <p>We will look for recognizable objects and patterns, then score the ones that stand out. A dark or blurry photo may not have enough detail to identify them.</p>
            {!photo.demo && missionTitle ? <p className={capture.notice}>Photographing {missionTitle}. The name goes with the photo so the reading can look for it.</p> : null}
            {!photo.demo && <p className={capture.helper}>Matching this frame to {place.name}. Change the place on Tonight or Events if that is not where you were.</p>}
            {!photo.demo && <label className={capture.targetLabel}>What were you looking at? <span>Optional</span><input value={claimedTarget} name="claimed_target" autoComplete="off" maxLength={200} onChange={(event) => setClaimedTarget(event.target.value)} placeholder="For example, Orion or the Moon…" /></label>}
            <button className={styles.primary} onClick={() => void analyzePhoto()}>{photo.demo ? "Explore sample discoveries" : "Analyze photo"}<SkyIcon name="arrow" /></button>
            <button className={capture.secondary} onClick={() => { stopPiece(); setError(""); setStep("start"); setPhoto(null); }}>Choose another photo</button>
            {photo.demo && <p className={capture.helper}>This preview makes no API request. Its two markers demonstrate the interaction.</p>}
          </> : step === "analyzing" ? <div role="status" className={capture.analysisStatus}><h2>Reading the lights.</h2><p>Bright points, stick figures, then a catalog match. The quiet piece follows the photo until names arrive.</p><button className={capture.secondary} onClick={cancelAnalysis}>Cancel analysis</button></div> : <>
            <div className={capture.resultHeading}><h2>{certainty}</h2><span>{live ? `${live.score.figurePointsTotal} pts` : `${objects.length} ${objects.length === 1 ? "feature" : "features"}`}</span></div>
            <p>{photo.demo ? "Tap an illustrative marker or choose a feature below." : live ? live.analysis.overview : "These are suggestions, not confirmed sightings. Tap a feature to learn more."}</p>
            {live?.score.rarity && <p className={capture.notice}>Frame rarity {live.score.rarity}{live.score.award?.badge ? ` · ${live.score.award.badge}` : ""}. Caught at {place.name}.</p>}
            {live?.analysis.skyConditions && <p className={capture.helper}>{live.analysis.skyConditions}</p>}
            {visibleObjects.length ? <div className={capture.objectList}>{visibleObjects.map((object) => {
              const figure = liveFigures.find((item) => item.id === object.id);
              const award = live?.score.highlights.find((feature) => feature.figureId === object.id);
              const tier = award ? catchTier(award.points, award.kind) : null;
              return <button className={styles.discoveryRow} key={object.id} onClick={() => { if (figure) openFigure(figure); else { setSelectedFigure(null); setSelected(object); } }}><span className={styles.objectIcon}><SkyIcon name={object.kind === "constellation" || object.kind === "Constellation" ? "collection" : "star"} /></span><span><strong>{object.name}</strong><span>{tier ? `${tier.name} · +${award?.points}` : object.kind}</span></span><SkyIcon name="chevron" /></button>;
            })}</div> : <div className={capture.noObjects}><h3>No confident identification yet</h3><p>You still captured a night outside. Try a steadier photo with more of the sky and fewer nearby lights.</p></div>}
            {objects.length > 12 && <p className={capture.helper}>Showing the first 12 features.</p>}
            {live && <button className={styles.textButton} onClick={() => { const next = !muted; setMuted(next); ambience.current?.setMuted(next); }}>{muted ? "Play the sky piece" : "Silence the sky piece"}</button>}
            <button className={capture.secondary} onClick={() => { stopPiece(); setStep("review"); setResult(null); setLive(null); setError(""); }}>Back to photo</button>
          </>}
        </div>
      </div> : null}


      <dialog ref={cameraDialog} className={capture.camera} aria-labelledby="camera-title" onCancel={() => setCameraOpen(false)} onClose={() => setCameraOpen(false)}>
        <div className={capture.cameraView}>
          <video ref={video} autoPlay playsInline muted aria-label="Live camera preview" onLoadedData={() => setCameraReady(true)} />
          <div className={capture.cameraHeader}><h2 id="camera-title">Your sky</h2><button className={capture.cameraClose} aria-label="Close camera" onClick={() => setCameraOpen(false)}><SkyIcon name="close" /></button></div>
          {cameraError ? <div className={capture.cameraMessage} role="alert"><h3>Let’s use another way.</h3><p>{cameraError}</p><button className={styles.primary} onClick={() => nativeCameraInput.current?.click()}>Use phone camera</button><button className={capture.secondary} onClick={() => uploadInput.current?.click()}>Choose a photo</button></div> : <p className={capture.cameraGuide} role="status">{cameraReady ? "Hold steady. Leave nearby lights out of the frame." : "Waiting for camera access…"}</p>}
          <div className={capture.cameraControls}><button className={capture.galleryButton} aria-label="Choose an existing photo" onClick={() => uploadInput.current?.click()}><SkyIcon name="collection" /></button><button className={capture.shutter} aria-label="Take sky photo" disabled={!cameraReady || Boolean(cameraError)} onClick={takePhoto}><span /></button><span aria-hidden="true" /></div>
        </div>
      </dialog>

      <dialog ref={detailDialog} className={styles.sheet} aria-labelledby="photo-object-title" onCancel={() => { setSelected(null); setSelectedFigure(null); }} onClose={() => { setSelected(null); setSelectedFigure(null); }} onClick={(event) => { if (event.target === event.currentTarget) { setSelected(null); setSelectedFigure(null); } }}>
        {selected && selectedFigure ? <div className={styles.sheetContent}><button className={styles.closeButton} aria-label="Close object explanation" onClick={() => { setSelected(null); setSelectedFigure(null); }}><SkyIcon name="close" /></button><div className={styles.detailIcon}><SkyIcon name="star" /></div><h2 id="photo-object-title">{selectedFigure.name}</h2>{selectedTier && selectedAward ? <p className={capture.notice}>{selectedTier.name} · +{selectedAward.points} points</p> : null}<p className={styles.objectBody}>{selectedFigure.summary}</p><p className={styles.objectBody}>{selectedFigure.description}</p>{selectedFigure.mythology ? <div className={styles.localNote}><h3>Story</h3><p>{selectedFigure.mythology}</p></div> : null}{selectedAward?.reason ? <p className={capture.helper}>{selectedAward.reason}</p> : null}<button className={styles.primary} onClick={() => { setSelected(null); setSelectedFigure(null); }}>Back to your photo</button></div> : selected && learning ? <div className={styles.sheetContent}><button className={styles.closeButton} aria-label="Close object explanation" onClick={() => setSelected(null)}><SkyIcon name="close" /></button><div className={styles.detailIcon}><SkyIcon name="star" /></div><h2 id="photo-object-title">{selected.name}</h2><p className={styles.objectBody}>{learning.body}</p><div className={styles.localNote}><h3>For your night</h3><p>{learning.tip}</p></div><a className={styles.textButton} href={learning.source} target="_blank" rel="noreferrer">Learn more with NASA</a><p className={capture.helper}>Illustrative demo feature. This is a general explanation.</p><button className={styles.primary} onClick={() => setSelected(null)}>Back to your photo</button></div> : null}
      </dialog>
    </div>
  </YourSkyShell>;
}
