"use client";

import type { StarVerdict, VerificationReport } from "@calhacks13/lib";

interface IdentificationFeedProps {
  verification: VerificationReport;
  /** How many accepted stars have been revealed so far (1-based count). */
  revealedCount: number;
  revealing: boolean;
}

export function IdentificationFeed({
  verification,
  revealedCount,
  revealing,
}: IdentificationFeedProps) {
  const accepted = verification.acceptedStars;
  const shown = accepted.slice(0, revealedCount);
  const current = shown.length > 0 ? shown[shown.length - 1] : null;
  const rejectedPreview = verification.rejectedStars.slice(0, 6);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Catalog match · identify
        </p>
        <p className="text-xs text-zinc-500">
          {revealing
            ? `Locating ${Math.min(revealedCount, accepted.length)} / ${accepted.length}`
            : verification.summary}
        </p>
      </div>

      {current ? (
        <p className="text-sm text-sky-200">
          <span className="text-zinc-500">Identified · </span>
          {current.starName}
          <span className="text-zinc-500"> in {current.figureName}</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            {current.reason}
          </span>
        </p>
      ) : revealing ? (
        <p className="text-sm text-zinc-500">Running configuration match test…</p>
      ) : (
        <p className="text-sm text-zinc-500">No verified stars to reveal.</p>
      )}

      <ol className="max-h-40 space-y-1 overflow-y-auto text-xs">
        {shown.map((s: StarVerdict, i) => (
          <li
            key={`${s.figureId}-${s.starId}-${i}`}
            className="flex items-baseline justify-between gap-2 border-b border-zinc-900/80 py-1 text-zinc-300"
          >
            <span>
              <span className="text-sky-400/80">✓</span> {s.starName}
              <span className="ml-1 text-zinc-600">{s.figureName}</span>
            </span>
            <span className="tabular-nums text-zinc-600">
              ({s.x.toFixed(2)}, {s.y.toFixed(2)})
            </span>
          </li>
        ))}
      </ol>

      {!revealing && rejectedPreview.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
            Rejected by match test
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-600">
            {rejectedPreview.map((s) => (
              <li key={`rej-${s.figureId}-${s.starId}`}>
                ✗ {s.starName}: {s.reason}
              </li>
            ))}
            {verification.rejectedStars.length > rejectedPreview.length ? (
              <li>
                …and {verification.rejectedStars.length - rejectedPreview.length}{" "}
                more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
