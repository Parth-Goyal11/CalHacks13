"use client";

/* eslint-disable @next/next/no-img-element -- User photo object URLs need no image optimizer. */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { SkyPhotoResult } from "./analysis";
import { analyzeReveal } from "./reveal-analysis";
import CaptureDetails, { captureMeta, type CaptureDraft } from "./CaptureDetails";
import { toDatetimeLocalValue } from "@/lib/image";
import type { Place } from "./tonight-data";
import { IconButton, SkyIcon } from "./SkyIcon";
import LoadingScreen from "./LoadingScreen";

export default function CameraFlow({
  onClose,
  onComplete,
  onKeep,
  place,
  initialNotes = "",
  initialFile = null,
}: {
  onClose: () => void;
  onComplete: (file: File, result: SkyPhotoResult) => void;
  onKeep?: (file: File) => void;
  place?: Place;
  initialNotes?: string;
  initialFile?: File | null;
}) {
  const [draft, setDraft] = useState<CaptureDraft>(() => ({ latitude: place ? String(place.latitude) : "", longitude: place ? String(place.longitude) : "", takenAt: toDatetimeLocalValue(new Date()), facing: "", elevation: "", fov: "", notes: typeof initialNotes === "string" ? initialNotes : "" }));
  const [step, setStep] = useState<"live" | "preview" | "loading">(
    initialFile ? "preview" : "live",
  );
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [retryCamera, setRetryCamera] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const request = useRef<AbortController | null>(null);
  const requestSerial = useRef(0);
  const generation = useRef(0);
  const photoUrl = useRef("");
  const keptFile = useRef<File | null>(null);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    if (initialFile) selectPhoto(initialFile);
    return () => {
      generation.current += 1;
      requestSerial.current += 1;
      request.current?.abort("navigation");
      stream.current?.getTracks().forEach((track) => track.stop());
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    };
  }, []);

  useEffect(() => {
    if (step !== "live") return;
    const current = ++generation.current;
    async function connect() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera requires HTTPS or localhost.");
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing } },
        });
        if (current !== generation.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        const feed = video.current;
        if (feed) {
          feed.srcObject = media;
          const markReady = () => {
            if (current === generation.current && feed.videoWidth > 0)
              setReady(true);
          };
          feed.onloadedmetadata = markReady;
          feed.onplaying = markReady;
          try {
            await feed.play();
          } catch {
            /* A later shutter tap retries playback. */
          }
          markReady();
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (current === generation.current)
          setCanFlip(
            devices.filter((device) => device.kind === "videoinput").length > 1,
          );
      } catch (error) {
        if (current !== generation.current) return;
        stream.current?.getTracks().forEach((track) => track.stop());
        const denied =
          error instanceof DOMException && error.name === "NotAllowedError";
        setCameraError(
          denied
            ? "Camera access is off. Choose a photo, or allow camera access in your browser settings."
            : "We could not open the camera. You can use your phone camera or choose a photo instead.",
        );
      }
    }
    function onVisibility() {
      if (!document.hidden) return;
      generation.current += 1;
      stream.current?.getTracks().forEach((track) => track.stop());
      setReady(false);
      setCameraError(
        "Camera paused while you were away. Tap Try camera again to resume.",
      );
    }
    void connect();
    const watch = window.setInterval(() => {
      if (video.current && video.current.videoWidth > 0) setReady(true);
    }, 300);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(watch);
      generation.current += 1;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [step, facing, retryCamera]);

  function selectPhoto(file?: File) {
    if (!file) return;
    const type = file.type.toLowerCase();
    const valid =
      [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/heic",
        "image/heif",
      ].includes(type) ||
      (!type && /\.(jpe?g|png|heic|heif)$/i.test(file.name));
    if (!valid || !file.size || file.size > 20 * 1024 * 1024) {
      setCameraError("Choose a JPEG, PNG or HEIC photo smaller than 20 MB.");
      setStep("live");
      return;
    }
    const normalized = type
      ? file
      : new File([file], file.name, {
          type: /\.png$/i.test(file.name)
            ? "image/png"
            : /\.hei[cf]$/i.test(file.name)
              ? "image/heic"
              : "image/jpeg",
        });
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    const url = URL.createObjectURL(normalized);
    photoUrl.current = url;
    setPhoto({ file: normalized, url });
    setPreviewFailed(false);
    setAnalysisError("");
    setCameraError("");
    setStep("preview");
    if (keptFile.current !== normalized) {
      keptFile.current = normalized;
      setStored(true);
      onKeep?.(normalized);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    selectPhoto(event.target.files?.[0]);
    event.target.value = "";
  }

  async function takePhoto() {
    const feed = video.current;
    if (!feed) {
      setCameraError("The camera is not ready. Upload a photo instead.");
      return;
    }
    if (feed.paused || !feed.videoWidth) {
      try {
        await feed.play();
      } catch {
        /* The frame check below explains what to do next. */
      }
    }
    if (!feed.videoWidth || !feed.videoHeight) {
      setCameraError(
        "The camera has no picture yet. Allow camera access, or upload a photo.",
      );
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = feed.videoWidth;
    canvas.height = feed.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError(
        "We could not capture this frame. Choose a photo instead.",
      );
      return;
    }
    if (facing === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(feed, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setCameraError("The photo could not be captured. Try again.");
      return;
    }
    selectPhoto(
      new File([blob], `yonder-${Date.now()}.jpg`, { type: "image/jpeg" }),
    );
  }

  function retake() {
    request.current?.abort("cancel");
    requestSerial.current += 1;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = "";
    setPhoto(null);
    setStored(false);
    setAnalysisError("");
    setCameraError("");
    setReady(false);
    setStep("live");
  }

  function cancelAnalysis() {
    request.current?.abort("cancel");
    requestSerial.current += 1;
    setStep("preview");
  }

  async function analyze() {
    if (!photo || step === "loading") return;
    const meta = captureMeta(draft);
    if (!meta) {
      setContextOpen(true);
      setAnalysisError("Enter a valid photo location and time. Check any optional camera angles too.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const serial = ++requestSerial.current;
    setAnalysisError("");
    setStep("loading");
    const timer = window.setTimeout(() => controller.abort("timeout"), 105000);
    try {
      const result = await analyzeReveal(photo.file, meta, controller.signal);
      if (serial === requestSerial.current && !controller.signal.aborted)
        onComplete(photo.file, result);
    } catch (error) {
      if (serial !== requestSerial.current) return;
      setAnalysisError(
        controller.signal.reason === "timeout"
          ? "Analysis took too long. Your photo is still here. Please try again."
          : error instanceof Error && error.name !== "TypeError"
            ? error.message
            : "We could not reach sky analysis. Your photo is still here. Please try again.",
      );
      setStep("preview");
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <dialog
      ref={dialog}
      className={`camera-flow overlay-dialog ${step === "preview" ? "camera-review" : ""}`}
      aria-label="Camera"
      onCancel={(event) => {
        event.preventDefault();
        if (step === "loading") cancelAnalysis();
        else onClose();
      }}
    >
      {step === "loading" ? (
        <LoadingScreen onCancel={cancelAnalysis} />
      ) : (
        <>
          {step === "live" ? (
            <>
              <video
                ref={video}
                className="camera-video"
                autoPlay
                muted
                playsInline
                aria-label="Camera preview"
                onCanPlay={() => setReady(true)}
                style={{
                  transform: facing === "user" ? "scaleX(-1)" : undefined,
                }}
              />
              <div className="camera-shade" />
              <div className="camera-topbar">
                <IconButton
                  label="Close camera"
                  icon="close"
                  onClick={onClose}
                />
                <span>Camera</span>
                <button
                  className="camera-flip"
                  type="button"
                  aria-label="Switch camera"
                  disabled={!canFlip}
                  onClick={() => {
                    setReady(false);
                    setCameraError("");
                    setFacing((value) =>
                      value === "user" ? "environment" : "user",
                    );
                  }}
                >
                  <SkyIcon name="camera" size={21} />
                </button>
              </div>
              {cameraError && (
                <div className="camera-error-panel" role="alert">
                  <SkyIcon name="camera" size={28} />
                  <h2>Your sky, through your lens.</h2>
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraError("");
                      setReady(false);
                      setRetryCamera((value) => value + 1);
                    }}
                  >
                    Try camera again
                  </button>
                  <button
                    type="button"
                    onClick={() => nativeInput.current?.click()}
                  >
                    Use phone camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                  >
                    Choose a photo
                  </button>
                </div>
              )}
              <div className="camera-controls">
                <button
                  type="button"
                  className="gallery-picker"
                  aria-label="Upload a photo"
                  onClick={() => fileInput.current?.click()}
                >
                  <SkyIcon name="gallery" size={20} />
                  <span>Upload</span>
                </button>
                <button
                  className={`shutter${ready ? " shutter-ready" : ""}`}
                  type="button"
                  aria-label="Take photo"
                  aria-disabled={!ready}
                  onClick={() => void takePhoto()}
                >
                  <span />
                </button>
                <span className="camera-control-spacer" />
              </div>
            </>
          ) : (
            <>
              {photo && !previewFailed && (
                <img
                  className="capture-preview"
                  src={photo.url}
                  alt="Your selected sky photo"
                  onError={() => setPreviewFailed(true)}
                />
              )}
              <div className="camera-shade" />
              <div className="capture-preview-top">
                <IconButton
                  label="Close preview"
                  icon="close"
                  onClick={onClose}
                />
                <span>{stored ? "Saved in Memories" : "Your sky"}</span>
                <span />
              </div>
              {previewFailed && (
                <p className="preview-message">
                  Your browser cannot preview this image. You can still analyze
                  it.
                </p>
              )}
              <details
                className="capture-context"
                open={contextOpen}
                onToggle={(event) => {
                  const details = event.currentTarget;
                  setContextOpen(
                    details instanceof HTMLDetailsElement
                      ? details.open
                      : event.newState === "open",
                  );
                }}
              >
                <summary>Photo location & time <span>{draft.latitude && draft.longitude ? "Review" : "Add details"}</span></summary>
                <CaptureDetails draft={draft} onChange={setDraft} error={analysisError} />
              </details>
              {analysisError && !contextOpen && <div className="analysis-error" role="alert">{analysisError}</div>}
              <div className="capture-actions">
                <button type="button" onClick={retake}>
                  Retake
                </button>
                <button
                  className="analyze-button"
                  type="button"
                  onClick={() => void analyze()}
                >
                  <SkyIcon name="spark" size={18} />
                  {analysisError ? "Try again" : "Analyze sky"}
                </button>
              </div>
            </>
          )}
        </>
      )}
      <input
        ref={fileInput}
        type="file"
        className="visually-hidden"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        aria-label="Choose a night sky photo"
        onChange={chooseFile}
        tabIndex={-1}
      />
      <input
        ref={nativeInput}
        type="file"
        className="visually-hidden"
        accept="image/*"
        capture="environment"
        aria-label="Use phone camera"
        onChange={chooseFile}
        tabIndex={-1}
      />
    </dialog>
  );
}
