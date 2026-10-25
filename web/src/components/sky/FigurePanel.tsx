"use client";

import { useState } from "react";
import type { SkyCaptureMeta, SkyFigure } from "@calhacks13/lib";

interface FigurePanelProps {
  figure: SkyFigure | null;
  meta: SkyCaptureMeta | null;
  onClose: () => void;
}

export function FigurePanel({ figure, meta, onClose }: FigurePanelProps) {
  const figureId = figure?.id ?? null;
  const [extraById, setExtraById] = useState<{ id: string; text: string } | null>(
    null
  );
  const [errorById, setErrorById] = useState<{ id: string; message: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const extra = figureId && extraById?.id === figureId ? extraById.text : null;
  const error =
    figureId && errorById?.id === figureId ? errorById.message : null;

  async function askGrokMore() {
    if (!meta || !figure) return;
    const id = figure.id;
    setLoading(true);
    setErrorById(null);
    try {
      const res = await fetch("/api/figure-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          figure: {
            name: figure.name,
            kind: figure.kind,
            summary: figure.summary,
            description: figure.description,
          },
          meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setExtraById({ id, text: data.text as string });
    } catch (e) {
      setErrorById({
        id,
        message: e instanceof Error ? e.message : "Could not load more",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!figure) {
    return (
      <aside className="hidden rounded-lg border border-zinc-800 bg-zinc-950/80 p-5 text-sm text-zinc-500 lg:flex lg:flex-col lg:justify-center">
        <p>Select a star or constellation chip to learn what you&apos;re seeing.</p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-sky-900/50 bg-zinc-950/90 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-400/80">
            {figure.kind}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            {figure.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Confidence {Math.round(figure.confidence * 100)}%
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Close details"
        >
          Close
        </button>
      </div>

      <p className="text-base leading-relaxed text-zinc-300">{figure.summary}</p>
      <p className="text-sm leading-relaxed text-zinc-400">{figure.description}</p>

      {figure.mythology ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">
            Story
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            {figure.mythology}
          </p>
        </div>
      ) : null}

      {figure.stars.length > 0 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">
            Structure · {figure.stars.length} stars
            {figure.lines.length
              ? ` · ${figure.lines.length} links`
              : ""}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {figure.stars.map((s) => (
              <li
                key={s.id}
                className="rounded border border-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
              >
                {s.name ?? s.id}
              </li>
            ))}
          </ul>
          {figure.lines.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
              {figure.lines.map((l, i) => {
                const from =
                  figure.stars.find((s) => s.id === l.from)?.name ?? l.from;
                const to =
                  figure.stars.find((s) => s.id === l.to)?.name ?? l.to;
                return (
                  <li key={`${l.from}-${l.to}-${i}`}>
                    {from} — {to}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {extra ? (
        <div className="rounded border border-sky-900/50 bg-sky-950/30 p-3">
          <h3 className="text-xs uppercase tracking-wider text-sky-400/90">
            Grok
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {extra}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <button
        type="button"
        onClick={askGrokMore}
        disabled={loading || !meta}
        className="mt-auto rounded bg-sky-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Asking Grok…" : "Ask Grok for more"}
      </button>
    </aside>
  );
}
