"use client";

/* eslint-disable @next/next/no-img-element -- Original local blob photos and solver JPEGs must render without the Next image optimizer. */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import YourSkyShell from "./YourSkyShell";
import { SkyIcon } from "./SkyIcon";
import { learningFor, objectsFromResult, sampleObjects, sampleResult, type PhotoObject } from "./photo-discoveries";
import type { SkyPhotoResult } from "./photo-types";
import styles from "./YourSky.module.css";
import capture from "./Capture.module.css";

type Photo = { file: File | null; url: string; demo: boolean };
type Step = "start" | "review" | "analyzing" | "result";

export default function CaptureExperience() {
  const [step, setStep] = useState<Step>("start");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [result, setResult] = useState<SkyPhotoResult | null>(null);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [claimedTarget, setClaimedTarget] = useState("");
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

  useEffect(() => () => { request.current?.abort("navigation"); photoReader.current?.abort(); stream.current?.getTracks().forEach((track) => track.stop()); }, []);
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
      setPreviewFailed(false); setAnnotationFailed(false); setResult(null); setError(""); setSelected(null); setShowAnnotations(true); setStep("review");
      setCameraOpen(false);
    };
    reader.onerror = () => setError("We could not open this photo. Choose another image and try again.");
    reader.readAsDataURL(file);
  }

  function trySample() {
    photoReader.current?.abort(); request.current?.abort(); requestId.current += 1;
    setPhoto({ file: null, url: "/your-sky/night-sky.jpg", demo: true });
    setPreviewFailed(false); setResult(null); setError(""); setAnnotationFailed(false); setShowAnnotations(true); setStep("review");
  }

  function cancelAnalysis() {
    request.current?.abort(); requestId.current += 1;
    setStep("review"); setError("");
  }

  async function analyzePhoto() {
    if (!photo || step === "analyzing") return;
    setError(""); setSelected(null); setAnnotationFailed(false);
    if (photo.demo) { setResult(sampleResult); setStep("result"); return; }
    if (!photo.file) return;
    const controller = new AbortController(); request.current = controller;
    const id = ++requestId.current;
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    setStep("analyzing");
    const form = new FormData(); form.append("image", photo.file);
    if (claimedTarget.trim()) form.append("claimed_target", claimedTarget.trim());
    try {
      const response = await fetch("/api/sky-photo", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json() as SkyPhotoResult;
      if (id !== requestId.current) return;
      if (response.status === 422 || data.is_night_sky === false) {
        setError("We could not recognize a night sky. Try a clearer view of the sky with fewer nearby lights."); setStep("review"); return;
      }
      if (!response.ok && !data.identity && !data.metrics) throw new Error("service");
      setResult(data); setStep("result");
    } catch {
      if (id !== requestId.current) return;
      setError(controller.signal.reason === "navigation" ? "Analysis stopped when you left. Your photo is still here. You can try again." : controller.signal.aborted ? "Analysis took too long. Your photo is still here. Try again or choose another photo." : "We could not analyze this photo right now. Your photo is still here. Try again, or explore the sample sky.");
      setStep("review");
    } finally { window.clearTimeout(timeout); }
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

  const objects = result ? (photo?.demo ? sampleObjects : objectsFromResult(result)) : [];
  const visibleObjects = objects.slice(0, 12);
  const annotatedSrc = !photo?.demo && result?.annotated_image_url && result.photo_id
    ? `/api/sky-photo/${encodeURIComponent(result.photo_id)}/annotated` : null;
  const imageSrc = showAnnotations && annotatedSrc && !annotationFailed ? annotatedSrc : photo?.url;
  const certainty = photo?.demo ? "Sample discoveries" : result?.identity?.method === "plate-solved" ? "Matched star field" : "Possible discoveries";
  const learning = selected ? learningFor(selected) : null;

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
          <p className={capture.helper}>Your camera opens only when you choose. Photos upload when you tap Analyze photo.</p>
          <button className={styles.textButton} onClick={trySample}>Try a sample sky<SkyIcon name="arrow" /></button>
        </div>
      </div> : photo ? <div className={capture.discoveryLayout}>
        <div>
          <div className={capture.photoStage} aria-busy={step === "analyzing"}>
            {!previewFailed ? <img key={imageSrc} src={imageSrc} alt={step === "result" && annotatedSrc && showAnnotations && !annotationFailed ? "Sky photo with solver-provided object annotations" : photo.demo ? "Sample night sky used to demonstrate discovery controls" : "Your original sky photo"} onError={() => { if (imageSrc === annotatedSrc) setAnnotationFailed(true); else setPreviewFailed(true); }} /> : <div className={capture.previewFallback}><SkyIcon name="collection" /><p>This browser cannot preview the photo. You can still try analyzing it.</p></div>}
            {photo.demo && step === "result" && showAnnotations && !previewFailed && sampleObjects.map((object, index) => <button key={object.id} className={capture.hotspot} style={{ left: `${object.x}%`, top: `${object.y}%`, animationDelay: `${index * 260}ms` }} aria-label={`Learn about ${object.name}`} onClick={() => setSelected(object)}><span className={capture.targetRing} /><span>{object.name}</span></button>)}
            {step === "analyzing" && <div className={capture.analysisOverlay}><SkyIcon name="search" /><span>Analyzing your photo…</span></div>}
          </div>
          <div className={capture.photoToolbar}><span>{photo.demo ? "Sample photo" : "Original photo preserved"}</span>{step === "result" && (photo.demo || annotatedSrc) && <button className={styles.textButton} aria-pressed={showAnnotations} onClick={() => setShowAnnotations((value) => !value)}>{showAnnotations ? "Hide highlights" : "Show highlights"}</button>}</div>
          {annotationFailed && <p className={capture.helper} role="status">The annotation image did not load. Your original photo is shown instead.</p>}
        </div>
        <div className={capture.taskPanel}>
          {step === "review" ? <>
            <h2>Ready to look closer?</h2><p>We will look for recognizable objects and patterns. A dark or blurry photo may not have enough detail to identify them.</p>
            {!photo.demo && <label className={capture.targetLabel}>What were you looking at? <span>Optional</span><input value={claimedTarget} name="claimed_target" autoComplete="off" maxLength={200} onChange={(event) => setClaimedTarget(event.target.value)} placeholder="For example, Orion or the Moon…" /></label>}
            <button className={styles.primary} onClick={() => void analyzePhoto()}>{photo.demo ? "Explore sample discoveries" : "Analyze photo"}<SkyIcon name="arrow" /></button>
            <button className={capture.secondary} onClick={() => { setError(""); setStep("start"); setPhoto(null); }}>Choose another photo</button>
            {photo.demo && <p className={capture.helper}>This preview makes no API request. Its two markers demonstrate the interaction.</p>}
          </> : step === "analyzing" ? <div role="status" className={capture.analysisStatus}><h2>A little patience, a new perspective.</h2><p>We will show the results when the analysis finishes. You can cancel and keep your photo.</p><button className={capture.secondary} onClick={cancelAnalysis}>Cancel analysis</button></div> : <>
            <div className={capture.resultHeading}><h2>{certainty}</h2><span>{objects.length} {objects.length === 1 ? "feature" : "features"}</span></div>
            <p>{photo.demo ? "Tap an illustrative marker or choose a feature below." : result?.identity?.method === "plate-solved" ? "The solver matched the star field. Tap an object below to learn more; additional model suggestions still need confirmation." : "These are suggestions, not confirmed sightings. Tap a feature to learn more."}</p>
            {result?.needs_review && <p className={capture.notice}>Some analysis needs review. Treat object suggestions with care.</p>}
            {visibleObjects.length ? <div className={capture.objectList}>{visibleObjects.map((object) => <button className={styles.discoveryRow} key={object.id} onClick={() => setSelected(object)}><span className={styles.objectIcon}><SkyIcon name={object.kind === "Constellation" ? "collection" : "star"} /></span><span><strong>{object.name}</strong><span>{object.kind}</span></span><SkyIcon name="chevron" /></button>)}</div> : <div className={capture.noObjects}><h3>No confident identification yet</h3><p>You still captured a night outside. Try a steadier photo with more of the sky and fewer nearby lights.</p></div>}
            {objects.length > 12 && <p className={capture.helper}>Showing the first 12 features. The complete response is available in Technical details.</p>}
            {!photo.demo && !annotatedSrc && <p className={capture.helper}>No reliable image positions were returned, so we have not placed markers on your photo.</p>}
            {!photo.demo && <details className={capture.resultDetails}><summary>Photo details</summary>{result?.metrics && <p>{result.metrics.star_count ?? "Unknown"} light points measured. These are not individually confirmed stars.</p>}{result?.critique?.improvements?.slice(0, 5).map((line, index) => <p key={index}>{line}</p>)}{result?.final_score != null && <p>Photo score: {result.final_score}{result.rarity ? ` · ${result.rarity}` : ""}</p>}<details><summary>Technical details</summary><pre>{JSON.stringify(result, null, 2)}</pre></details></details>}
            <button className={capture.secondary} onClick={() => { setStep("review"); setResult(null); setError(""); }}>Back to photo</button>
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

      <dialog ref={detailDialog} className={styles.sheet} aria-labelledby="photo-object-title" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        {selected && learning && <div className={styles.sheetContent}><button className={styles.closeButton} aria-label="Close object explanation" onClick={() => setSelected(null)}><SkyIcon name="close" /></button><div className={styles.detailIcon}><SkyIcon name="star" /></div><h2 id="photo-object-title">{selected.name}</h2><p className={styles.objectBody}>{learning.body}</p><div className={styles.localNote}><h3>For your night</h3><p>{learning.tip}</p></div><a className={styles.textButton} href={learning.source} target="_blank" rel="noreferrer">Learn more with NASA</a><p className={capture.helper}>{photo?.demo ? "Illustrative demo feature. This is a general explanation." : "General learning note. Personalized Grok explanations come next."}</p><button className={styles.primary} onClick={() => setSelected(null)}>Back to your photo</button></div>}
      </dialog>
    </div>
  </YourSkyShell>;
}
