"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ScoreResult,
  SkyAnalysis,
  SkyCaptureMeta,
  SkyFigure,
} from "@calhacks13/lib";
import {
  dataUrlToBase64,
  fileToResizedDataUrl,
  localInputToIso,
  toDatetimeLocalValue,
} from "@/lib/image";
import { FigurePanel } from "./FigurePanel";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { SkyOverlay } from "./SkyOverlay";
import { StarStructure } from "./StarStructure";

type Step = "capture" | "meta" | "result";

export function SkyExplorer() {
  const [step, setStep] = useState<Step>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analysis, setAnalysis] = useState<SkyAnalysis | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [selected, setSelected] = useState<SkyFigure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingSeconds, setPendingSeconds] = useState(0);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [facingDegrees, setFacingDegrees] = useState("");
  const [notes, setNotes] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);

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
    setError(null);
    const resized = await fileToResizedDataUrl(file);
    setDataUrl(resized.dataUrl);
    setMimeType(resized.mimeType);
    setPreviewUrl(resized.dataUrl);
    setAnalysis(null);
    setScore(null);
    setSelected(null);
    setTakenAt(toDatetimeLocalValue(new Date()));
    setStep("meta");
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
      setError("Camera access denied. You can upload a photo instead.");
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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(5));
        setLongitude(pos.coords.longitude.toFixed(5));
        setGeoBusy(false);
      },
      () => {
        setError("Could not read location. Enter lat/lon manually.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function buildMeta(): SkyCaptureMeta | null {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const takenAtIso = localInputToIso(takenAt);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !takenAtIso) return null;
    const facing = facingDegrees.trim() === "" ? undefined : Number(facingDegrees);
    return {
      latitude: lat,
      longitude: lon,
      takenAt: takenAtIso,
      locationLabel: locationLabel.trim() || undefined,
      facingDegrees:
        facing !== undefined && Number.isFinite(facing) ? facing : undefined,
      notes: notes.trim() || undefined,
    };
  }

  async function runAnalysis() {
    const meta = buildMeta();
    if (!meta || !dataUrl) {
      setError(
        "Enter latitude, longitude, and when the photo was taken, and make sure a photo is loaded."
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
    const abortTimer = setTimeout(() => controller.abort(), 95_000);
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
      setScore((data.score as ScoreResult) ?? null);
      setSelected(null);
      setStep("result");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request timed out (~95s). Retry, or check the terminal for API errors.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed");
      }
    } finally {
      clearInterval(tick);
      clearTimeout(abortTimer);
      setPending(false);
    }
  }

  const meta = buildMeta();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-400/80">
          Night sky reveal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Illuminate what&apos;s overhead
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">
          Capture or upload a night-sky photo, tell us where and when it was
          taken, and Grok maps constellations onto your image — click a figure
          to learn more.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      {step === "capture" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              1 · Photo
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
              >
                Upload picture
              </button>
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  Use camera
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="rounded bg-sky-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
                  >
                    Take picture
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300"
                  >
                    Cancel camera
                  </button>
                </>
              )}
            </div>
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
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full rounded-lg bg-black object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/40 text-sm text-zinc-500">
                Night sky photo appears here
              </div>
            )}
          </div>
          <div className="text-sm leading-relaxed text-zinc-500">
            <p>
              Tip: shoot away from streetlights and note the direction you were
              facing. Accurate lat/lon and time drive which constellations we
              expect overhead — Grok uses that prior to name more of the stars
              in your frame.
            </p>
          </div>
        </section>
      ) : null}

      {step === "meta" && previewUrl ? (
        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Preview
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected sky photo"
              className="w-full rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                setStep("capture");
                setPreviewUrl(null);
                setDataUrl(null);
              }}
              className="mt-3 text-sm text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
            >
              Choose a different photo
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
              2 · Where & when
            </h2>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Place name (optional)</span>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g. Berkeley hills"
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Latitude</span>
                <input
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  inputMode="decimal"
                  placeholder="37.87"
                  className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-400">Longitude</span>
                <input
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  inputMode="decimal"
                  placeholder="-122.27"
                  className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoBusy}
              className="self-start text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50"
            >
              {geoBusy ? "Locating…" : "Use my current location"}
            </button>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">When was this taken?</span>
              <input
                type="datetime-local"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
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
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-400">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. looking toward the bay, Orion seemed left of frame"
                className="resize-y rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
              />
            </label>

            <button
              type="button"
              onClick={runAnalysis}
              disabled={pending}
              className="mt-2 rounded bg-sky-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? `Grok is reading the sky… ${pendingSeconds}s`
                : "Analyze with Grok"}
            </button>
          </div>
        </section>
      ) : null}

      {step === "result" && previewUrl && analysis ? (
        <section className="flex flex-col gap-4">
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
              onClick={() => {
                setStep("capture");
                setAnalysis(null);
                setScore(null);
                setSelected(null);
                setPreviewUrl(null);
                setDataUrl(null);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              New photo
            </button>
          </div>

          {score ? <ScoreBreakdown score={score} /> : null}

          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <SkyOverlay
              key={analysis.headline + analysis.figures.map((f) => f.id).join("-")}
              imageUrl={previewUrl}
              analysis={analysis}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>

          <StarStructure
            analysis={analysis}
            selected={selected}
            onSelect={setSelected}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-3">
              {!selected ? (
                <p className="text-sm text-zinc-500">
                  Watch the sky brighten — then faint lines appear. Tap a lit
                  star or a chip below for details; selected figures show named
                  star labels on the photo.
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
                      {f.stars.length > 0 ? (
                        <span className="ml-1 text-zinc-600">
                          {f.stars.length}
                        </span>
                      ) : null}
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
