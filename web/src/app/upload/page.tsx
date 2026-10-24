"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Rubric = {
  clarity?: number;
  tracking?: number;
  exposure?: number;
  noise?: number;
  framing?: number;
  conditions?: number;
};

type Critique = {
  strengths?: string[];
  improvements?: string[];
};

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
    brightest_object?: string | null;
    other?: string[];
  };
  metrics?: {
    sharpness?: number;
    star_count?: number;
    trailing?: number;
  };
  rubric?: Rubric | null;
  critique?: Critique | null;
  rarity?: string | null;
  score?: number | null;
  final_score?: number | null;
  subject_bonus?: number | null;
  award?: { badge?: string; points?: number; card_foil?: string | null } | null;
  annotated_image_url?: string | null;
  _phase?: number;
};

const RUBRIC_KEYS: { key: keyof Rubric; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "tracking", label: "Tracking" },
  { key: "exposure", label: "Exposure" },
  { key: "noise", label: "Noise" },
  { key: "framing", label: "Framing" },
  { key: "conditions", label: "Conditions" },
];

const RARITY_FRAME: Record<string, string> = {
  Common: "border-zinc-600 bg-zinc-900/60",
  Uncommon: "border-emerald-700/80 bg-emerald-950/30",
  Rare: "border-sky-700/80 bg-sky-950/30",
  Epic: "border-violet-700/80 bg-violet-950/30",
  Legendary: "border-amber-600/80 bg-amber-950/30",
};

const RARITY_TEXT: Record<string, string> = {
  Common: "text-zinc-300",
  Uncommon: "text-emerald-300",
  Rare: "text-sky-300",
  Epic: "text-violet-300",
  Legendary: "text-amber-300",
};

function identityBadge(result: SkyPhotoResult): { label: string; className: string } {
  if (result.needs_review) {
    return {
      label: "Needs review",
      className: "border-amber-700/70 bg-amber-950/50 text-amber-100",
    };
  }
  const method = result.identity?.method;
  if (method === "plate-solved") {
    return {
      label: "Plate-solved",
      className: "border-sky-700/70 bg-sky-950/40 text-sky-100",
    };
  }
  if (method === "model-estimate") {
    return {
      label: "Model estimate",
      className: "border-zinc-600 bg-zinc-800/80 text-zinc-200",
    };
  }
  return {
    label: "Unlabeled",
    className: "border-zinc-700 bg-zinc-900 text-zinc-400",
  };
}

function RubricBars({ rubric }: { rubric: Rubric }) {
  return (
    <ul className="flex flex-col gap-2">
      {RUBRIC_KEYS.map(({ key, label }) => {
        const value = Math.max(0, Math.min(10, Number(rubric[key] ?? 0)));
        return (
          <li key={key} className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-2">
            <span className="text-xs text-zinc-400">{label}</span>
            <div className="h-1.5 overflow-hidden rounded-sm bg-zinc-800">
              <div
                className="h-full rounded-sm bg-zinc-200 transition-[width] duration-500 ease-out"
                style={{ width: `${value * 10}%` }}
              />
            </div>
            <span className="text-right text-xs tabular-nums text-zinc-300">
              {value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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

  const badge = result ? identityBadge(result) : null;
  const rarity = result?.rarity ?? null;
  const frameClass = rarity
    ? RARITY_FRAME[rarity] ?? "border-zinc-700 bg-zinc-900/50"
    : "border-zinc-800 bg-zinc-900/50";
  const rarityClass = rarity ? RARITY_TEXT[rarity] ?? "text-zinc-300" : "text-zinc-300";

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
            Add a photo
          </h1>
          <p className="text-zinc-400">
            Log a night-sky shot. The service plate-solves, measures quality,
            and judges with vision — start uvicorn on port 8000 first.
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
            <span className="text-zinc-400">Claimed target (optional)</span>
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
            {busy
              ? "Analyzing… (solver can take up to ~60s)"
              : "Analyze photo"}
          </button>
        </form>

        {error && (
          <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {status ? `${status}: ` : ""}
            {error}
          </p>
        )}

        {result && !error && (
          <section
            className={`flex flex-col gap-4 rounded-md border p-4 text-sm transition-colors duration-500 ${frameClass}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {badge ? (
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              ) : null}
              {rarity ? (
                <span className={`text-sm font-semibold ${rarityClass}`}>
                  {rarity}
                  {result.final_score != null
                    ? ` · ${result.final_score}`
                    : ""}
                </span>
              ) : null}
              {result.award?.points != null ? (
                <span className="text-xs text-zinc-500">
                  +{result.award.points} pts
                </span>
              ) : null}
            </div>

            {result.needs_review ? (
              <p className="rounded border border-amber-800/70 bg-amber-950/40 px-3 py-2 text-amber-100">
                Needs review — vision judge unavailable or returned invalid
                JSON. Metrics and solve data are still shown.
              </p>
            ) : null}

            {(result.identity?.constellations?.length ||
              result.identity?.named_stars?.length ||
              result.identity?.brightest_object) && (
              <div className="flex flex-col gap-1">
                {result.identity?.constellations?.length ? (
                  <p>
                    <span className="text-zinc-500">Constellations · </span>
                    {result.identity.constellations.join(", ")}
                  </p>
                ) : null}
                {result.identity?.named_stars?.length ? (
                  <p>
                    <span className="text-zinc-500">Named stars · </span>
                    {result.identity.named_stars.join(", ")}
                  </p>
                ) : null}
                {result.identity?.brightest_object ? (
                  <p>
                    <span className="text-zinc-500">Brightest · </span>
                    {result.identity.brightest_object}
                  </p>
                ) : null}
              </div>
            )}

            {result.rubric ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Quality
                </h2>
                <RubricBars rubric={result.rubric} />
              </div>
            ) : null}

            {result.critique ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Strengths
                  </h2>
                  <ul className="list-disc space-y-1 pl-4 text-zinc-200">
                    {(result.critique.strengths ?? []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Improvements
                  </h2>
                  <ul className="list-disc space-y-1 pl-4 text-zinc-200">
                    {(result.critique.improvements ?? []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {result.metrics ? (
              <p className="text-xs text-zinc-500">
                Stars {result.metrics.star_count ?? "—"} · sharpness{" "}
                {typeof result.metrics.sharpness === "number"
                  ? result.metrics.sharpness.toFixed(1)
                  : "—"}
                {result.photo_id ? ` · ${result.photo_id}` : ""}
              </p>
            ) : null}

            {annotatedSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={annotatedSrc}
                alt="Annotated sky photo"
                className="mt-1 w-full rounded border border-zinc-800"
              />
            ) : null}

            <details className="text-zinc-500">
              <summary className="cursor-pointer text-xs">Raw JSON</summary>
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
