"use client";

import { useEffect, useRef, useState } from "react";
import type { SkyAnalysis, SkyCaptureMeta, SkyFigure } from "@calhacks13/lib";
import {
  dataUrlToBase64,
  fileToResizedDataUrl,
  localInputToIso,
  toDatetimeLocalValue,
} from "@/lib/image";
import { DropZone } from "./DropZone";
import { FigurePanel } from "./FigurePanel";
import { LocationSearch, type GeocodedPlace } from "./LocationSearch";
import { SkyOverlay } from "./SkyOverlay";

type Step = "capture" | "meta" | "result";

const fieldClass =
  "rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-sky-600";

export function SkyExplorer() {
  const [step, setStep] = useState<Step>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analysis, setAnalysis] = useState<SkyAnalysis | null>(null);
  const [selected, setSelected] = useState<SkyFigure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingSeconds, setPendingSeconds] = useState(0);
  const [ingestBusy, setIngestBusy] = useState(false);

  const [place, setPlace] = useState<GeocodedPlace | null>(null);
  const [takenAt, setTakenAt] = useState("");
  const [facingDegrees, setFacingDegrees] = useState("");
  const [notes, setNotes] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function ingestFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please drop or choose an image file.");
      return;
    }
    setError(null);
    setIngestBusy(true);
    try {
      const resized = await fileToResizedDataUrl(file);
      setDataUrl(resized.dataUrl);
      setMimeType(resized.mimeType);
      setPreviewUrl(resized.dataUrl);
      setAnalysis(null);
      setSelected(null);
      setTakenAt(toDatetimeLocalValue(new Date()));
      stopCamera();
      setStep("meta");
    } catch {
      setError("Could not read that image. Try another file.");
    } finally {
      setIngestBusy(false);
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera access denied. Drop a photo or upload instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function snapPhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) return;
    stopCamera();
    await ingestFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  }

  function buildMeta(): SkyCaptureMeta | null {
    const takenAtIso = localInputToIso(takenAt);
    if (!place || !takenAtIso) return null;
    const facing = facingDegrees.trim() === "" ? undefined : Number(facingDegrees);
    return {
      latitude: place.latitude,
      longitude: place.longitude,
      takenAt: takenAtIso,
      locationLabel: place.label,
      facingDegrees:
        facing !== undefined && Number.isFinite(facing) ? facing : undefined,
      notes: notes.trim() || undefined,
    };
  }

  async function runAnalysis() {
    const meta = buildMeta();
    if (!meta || !dataUrl) {
      setError(
        "Search and select a location on the map, set when the photo was taken, and make sure a photo is loaded."
      );
      return;
    }
    setError(null);
    setPending(true);
    setPendingSeconds(0);
    const started = Date.now();
    const tick = setInterval(
      () => setPendingSeconds(Math.floor((Date.now() - started) / 1000)),
      250
    );
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch("/api/analyze-sky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrlToBase64(dataUrl),
          mimeType,
          meta,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis as SkyAnalysis);
      setSelected(null);
      setStep("result");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out (~60s). Retry, or check the terminal for API errors.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed");
      }
    } finally {
      clearInterval(tick);
      clearTimeout(abortTimer);
      setPending(false);
    }
  }

  function resetToCapture() {
    setStep("capture");
    setAnalysis(null);
    setSelected(null);
    setPreviewUrl(null);
    setDataUrl(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const meta = buildMeta();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:max-w-5xl sm:px-6">
      <header className="max-w-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-400/80">
          Night sky reveal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Illuminate what&apos;s overhead
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Drop in a night-sky photo, add where and when, and Grok lights up what
          it can actually see in the frame.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {step === "capture" ? (
        <section className="flex flex-col gap-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingestFile(f);
            }}
          />

          {cameraOn ? (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="flex flex-wrap gap-3 border-t border-zinc-800 p-4">
                <button
                  type="button"
                  onClick={snapPhoto}
                  className="rounded-md bg-sky-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
                >
                  Take picture
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <DropZone
              onFile={(f) => void ingestFile(f)}
              disabled={ingestBusy}
              className="group relative flex aspect-[4/3] max-h-[min(28rem,70vh)] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-6 text-center"
            >
              <button
                type="button"
                disabled={ingestBusy}
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                aria-label="Upload night sky photo"
              />
              <div className="pointer-events-none relative z-10 flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/80 text-sky-300/90 group-data-[dragging=true]:border-sky-400/60">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16.5V18a2 2 0 002 2h12a2 2 0 002-2v-1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-zinc-200">
                    {ingestBusy
                      ? "Preparing photo…"
                      : "Drop a night-sky photo here"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    or click to browse · JPG / PNG
                  </p>
                </div>
              </div>
            </DropZone>
          )}

          {!cameraOn ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={ingestBusy}
                className="rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
              >
                Browse files
              </button>
              <button
                type="button"
                onClick={startCamera}
                disabled={ingestBusy}
                className="rounded-md border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-50"
              >
                Use camera
              </button>
              <p className="text-sm text-zinc-600">
                Clear skies work best — avoid heavy light pollution in frame.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "meta" && previewUrl ? (
        <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected sky photo"
              className="w-full rounded-xl border border-zinc-800"
            />
            <button
              type="button"
              onClick={resetToCapture}
              className="mt-3 text-sm text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              Choose a different photo
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              Where & when
            </h2>

            <LocationSearch
              value={place}
              onChange={setPlace}
              onError={(msg) => setError(msg || null)}
            />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">When was this taken?</span>
              <input
                type="datetime-local"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">
                Facing direction (degrees, optional)
              </span>
              <input
                value={facingDegrees}
                onChange={(e) => setFacingDegrees(e.target.value)}
                inputMode="numeric"
                placeholder="0 = North, 90 = East"
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. looking toward the bay"
                className={`resize-y ${fieldClass}`}
              />
            </label>

            <button
              type="button"
              onClick={runAnalysis}
              disabled={pending}
              className="mt-1 rounded-md bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? `Grok is reading the sky… ${pendingSeconds}s`
                : "Analyze with Grok"}
            </button>
          </div>
        </section>
      ) : null}

      {step === "result" && previewUrl && analysis ? (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">
                {analysis.headline}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
                {analysis.overview}
              </p>
              {analysis.skyConditions ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {analysis.skyConditions}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={resetToCapture}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              New photo
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <SkyOverlay
              key={
                analysis.headline + analysis.figures.map((f) => f.id).join("-")
              }
              imageUrl={previewUrl}
              analysis={analysis}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-3">
              {!selected ? (
                <p className="text-sm text-zinc-500">
                  Tap a lit star or a chip for details.
                </p>
              ) : null}
              <ul className="flex flex-wrap gap-2">
                {analysis.figures.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(f)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        selected?.id === f.id
                          ? "border-sky-400 bg-sky-500/20 text-sky-200"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <FigurePanel
              figure={selected}
              meta={meta}
              onClose={() => setSelected(null)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
