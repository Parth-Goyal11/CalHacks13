"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SkyPhotoResult = {
  photo_id?: string;
  is_night_sky?: boolean;
  needs_review?: boolean;
  detail?: string;
  identity?: {
    method?: string;
    confidence?: number;
    constellations?: string[];
    named_stars?: string[];
  };
  metrics?: {
    sharpness?: number;
    star_count?: number;
    trailing?: number;
  };
  rarity?: string | null;
  final_score?: number | null;
  annotated_image_url?: string | null;
  _phase?: number;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [claimedTarget, setClaimedTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkyPhotoResult | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus(null);

    const form = new FormData();
    form.append("image", file);
    if (claimedTarget.trim()) {
      form.append("claimed_target", claimedTarget.trim());
    }

    try {
      const res = await fetch("/api/sky-photo", { method: "POST", body: form });
      setStatus(res.status);
      const data = (await res.json()) as SkyPhotoResult;
      setResult(data);
      if (!res.ok && data.detail) {
        setError(data.detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const annotatedSrc =
    result?.annotated_image_url && result.photo_id
      ? result.annotated_image_url.startsWith("/")
        ? result.annotated_image_url
        : `/api/sky-photo/${result.photo_id}/annotated`
      : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 px-6 py-12 font-sans text-zinc-100">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← SkyScore
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload a sky photo
          </h1>
          <p className="text-zinc-400">
            Proxies to the local FastAPI Sky Photo service (plate-solve,
            metrics, vision judge). Start uvicorn on port 8000 first.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-400">Image (JPEG / PNG / HEIC)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
              onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-sm file:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-400">
              Claimed target (optional)
            </span>
            <input
              type="text"
              value={claimedTarget}
              onChange={(ev) => setClaimedTarget(ev.target.value)}
              placeholder="e.g. Orion, ISS"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-zinc-500"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !file}
            className="rounded-md bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Analyzing… (solver can take up to ~60s)" : "Analyze photo"}
          </button>
        </form>

        {error && (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {status ? `${status}: ` : ""}
            {error}
          </p>
        )}

        {result && !error && (
          <section className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
            <p className="text-zinc-400">
              HTTP {status}
              {result.photo_id ? ` · ${result.photo_id}` : ""}
              {result.identity?.method
                ? ` · ${result.identity.method}`
                : ""}
              {result.rarity ? ` · ${result.rarity}` : ""}
              {result.final_score != null
                ? ` · score ${result.final_score}`
                : ""}
            </p>
            {result.needs_review ? (
              <p className="rounded border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-amber-100">
                Needs review — vision judge unavailable or returned invalid
                JSON. Metrics and solve data are still shown.
              </p>
            ) : null}
            {result.identity?.constellations?.length ? (
              <p>
                Constellations:{" "}
                {result.identity.constellations.join(", ")}
              </p>
            ) : null}
            {result.identity?.named_stars?.length ? (
              <p>Named stars: {result.identity.named_stars.join(", ")}</p>
            ) : null}
            {result.metrics ? (
              <p className="text-zinc-400">
                Stars {result.metrics.star_count ?? "—"} · sharpness{" "}
                {result.metrics.sharpness?.toFixed?.(1) ??
                  result.metrics.sharpness ??
                  "—"}
              </p>
            ) : null}
            {annotatedSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={annotatedSrc}
                alt="Annotated sky photo"
                className="mt-2 w-full rounded border border-zinc-800"
              />
            ) : null}
            <details className="text-zinc-500">
              <summary className="cursor-pointer">Raw JSON</summary>
              <pre className="mt-2 max-h-64 overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </main>
    </div>
  );
}
