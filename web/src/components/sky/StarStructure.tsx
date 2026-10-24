"use client";

import type { SkyAnalysis, SkyFigure } from "@calhacks13/lib";

interface StarStructureProps {
  analysis: SkyAnalysis;
  selected: SkyFigure | null;
  onSelect: (figure: SkyFigure) => void;
}

/** Compact stick-figure graph for a constellation / asterism. */
function StickFigure({ figure }: { figure: SkyFigure }) {
  const stars = figure.stars;
  if (stars.length === 0) {
    return (
      <p className="text-xs text-zinc-600">No star positions for this figure.</p>
    );
  }

  const pad = 0.08;
  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxX - minX < 0.02) {
    minX -= 0.05;
    maxX += 0.05;
  }
  if (maxY - minY < 0.02) {
    minY -= 0.05;
    maxY += 0.05;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const toSvg = (x: number, y: number) => {
    const nx = (x - minX) / spanX;
    const ny = (y - minY) / spanY;
    return {
      x: (pad + nx * (1 - 2 * pad)) * 100,
      y: (pad + ny * (1 - 2 * pad)) * 100,
    };
  };

  const byId = new Map(stars.map((s) => [s.id, s]));

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-40 w-full rounded border border-zinc-800 bg-zinc-950"
      role="img"
      aria-label={`Stick figure for ${figure.name}`}
    >
      {figure.lines.map((line, i) => {
        const a = byId.get(line.from);
        const b = byId.get(line.to);
        if (!a || !b) return null;
        const p1 = toSvg(a.x, a.y);
        const p2 = toSvg(b.x, b.y);
        return (
          <line
            key={`${line.from}-${line.to}-${i}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="rgba(180, 205, 255, 0.75)"
            strokeWidth={0.8}
          />
        );
      })}
      {stars.map((s) => {
        const p = toSvg(s.x, s.y);
        const r = 1.4 + (s.brightness ?? 0.6) * 1.2;
        return (
          <g key={s.id}>
            <circle cx={p.x} cy={p.y} r={r} fill="rgba(255, 248, 230, 0.95)" />
            <text
              x={p.x}
              y={p.y - r - 1.5}
              textAnchor="middle"
              fill="rgba(210, 220, 240, 0.9)"
              fontSize="3.2"
            >
              {s.name ?? s.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StarStructure({
  analysis,
  selected,
  onSelect,
}: StarStructureProps) {
  const realFigures = analysis.figures.filter(
    (f) => f.id !== "none-confident" && f.stars.length > 0
  );
  const allStars = realFigures.flatMap((f) =>
    f.stars.map((s) => ({
      figureId: f.id,
      figureName: f.name,
      kind: f.kind,
      star: s,
    }))
  );

  const focus = selected && selected.stars.length > 0 ? selected : realFigures[0] ?? null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Star structure
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {allStars.length} named point{allStars.length === 1 ? "" : "s"} across{" "}
          {realFigures.length} figure{realFigures.length === 1 ? "" : "s"} — lines
          verified against the stick-figure alignment catalog when geometry fits.
        </p>
      </div>

      {focus ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-200">{focus.name}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {focus.kind} · {focus.stars.length} stars · {focus.lines.length}{" "}
                links
              </p>
            </div>
            <StickFigure figure={focus} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Stars in this figure
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
              {focus.stars.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-2 border-b border-zinc-900 py-1 text-zinc-300"
                >
                  <span>{s.name ?? s.id}</span>
                  <span className="tabular-nums text-[10px] text-zinc-600">
                    ({s.x.toFixed(2)}, {s.y.toFixed(2)})
                  </span>
                </li>
              ))}
            </ul>
            {focus.lines.length > 0 ? (
              <>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Line segments
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {focus.lines.map((l, i) => {
                    const from =
                      focus.stars.find((s) => s.id === l.from)?.name ?? l.from;
                    const to =
                      focus.stars.find((s) => s.id === l.to)?.name ?? l.to;
                    return (
                      <li
                        key={`${l.from}-${l.to}-${i}`}
                        className="rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400"
                      >
                        {from} — {to}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No star structure to show yet.</p>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          All identified stars
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {allStars.map(({ figureId, figureName, star }) => (
            <li key={`${figureId}-${star.id}`}>
              <button
                type="button"
                onClick={() => {
                  const fig = analysis.figures.find((f) => f.id === figureId);
                  if (fig) onSelect(fig);
                }}
                className={`rounded border px-2 py-0.5 text-xs transition ${
                  selected?.id === figureId
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-100"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
                title={figureName}
              >
                {star.name ?? star.id}
                <span className="ml-1 text-[10px] text-zinc-600">
                  {figureName}
                </span>
              </button>
            </li>
          ))}
          {allStars.length === 0 ? (
            <li className="text-xs text-zinc-600">None identified.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
