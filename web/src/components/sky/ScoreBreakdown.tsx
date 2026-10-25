"use client";

import {
  AWARD_POINTS,
  RARITY_THRESHOLDS,
  RUBRIC_WEIGHTS,
  type ScoreResult,
} from "@calhacks13/lib";

const RUBRIC_LABELS: Record<keyof typeof RUBRIC_WEIGHTS, string> = {
  clarity: "Clarity",
  tracking: "Tracking",
  exposure: "Exposure",
  noise: "Noise",
  framing: "Framing",
  conditions: "Conditions",
};

const SUBJECT_LABELS: Record<string, string> = {
  plate_solved_star_field: "Plate-solved field",
  naked_eye_deep_sky: "Naked-eye deep sky",
  milky_way_core: "Milky Way core",
  planet_moon_or_pair: "Planet / moon pair",
  satellite_logged_pass: "Logged satellite pass",
  meteor_streak: "Meteor streak",
  aurora_below_50_lat: "Aurora below 50° lat",
  naked_eye_comet: "Naked-eye comet",
  iss_crossing_moon_or_sun: "ISS crossing Moon/Sun",
};

interface ScoreBreakdownProps {
  score: ScoreResult;
}

export function ScoreBreakdown({ score }: ScoreBreakdownProps) {
  if (
    score.finalScore == null ||
    !score.rarity ||
    !score.award ||
    !score.rubric
  ) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-500">
        No award points — nothing was confidently identified in-frame.
      </div>
    );
  }

  const rubric = score.rubric;
  const subjectBonus = score.subjectBonus ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            How points formed
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">
            {score.finalScore}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              final · {score.rarity} · +{score.award.points} pts
            </span>
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>{score.award.badge}</p>
          {score.identityMethod ? (
            <p className="mt-0.5">identity: {score.identityMethod}</p>
          ) : null}
        </div>
      </div>

      <ol className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            1 · Quality
          </p>
          <p className="mt-1 text-lg font-medium text-zinc-100">{score.score}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            weighted rubric × 10 → 0–100
          </p>
        </li>
        <li className="rounded border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            2 · Subject bonus
          </p>
          <p className="mt-1 text-lg font-medium text-zinc-100">
            +{subjectBonus}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {score.subjects.length
              ? score.subjects
                  .map((s) => SUBJECT_LABELS[s] ?? s)
                  .join(" · ")
              : "none matched"}
          </p>
        </li>
        <li className="rounded border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            3 · Award
          </p>
          <p className="mt-1 text-lg font-medium text-sky-300">
            +{score.award.points}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            from rarity table · badge “{score.award.badge}”
          </p>
        </li>
      </ol>

      {(score.figureAwards?.length ?? 0) > 0 ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Points by constellation / object
            </p>
            <p className="text-xs text-sky-300/90">
              identification total +{score.figurePointsTotal ?? 0}
            </p>
          </div>
          <ul className="mt-2 divide-y divide-zinc-900 overflow-hidden rounded border border-zinc-800">
            {[...(score.figureAwards ?? [])]
              .sort((a, b) => b.points - a.points)
              .map((fig) => (
                <li
                  key={fig.figureId}
                  className="flex flex-col gap-1 bg-zinc-950/60 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-100">
                      {fig.figureName}
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        {fig.kind}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {fig.starsIdentified} stars
                      {fig.catalogStars > 0
                        ? ` · ${fig.catalogMatched}/${fig.catalogStars} catalog`
                        : ""}
                      {fig.alignmentScore != null
                        ? ` · align ${(fig.alignmentScore * 100).toFixed(0)}%`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                      {fig.breakdown.join(" · ")}
                    </p>
                    {fig.missingCatalogStars.length > 0 ? (
                      <p className="mt-1 text-[11px] text-amber-200/70">
                        Still missing:{" "}
                        {fig.missingCatalogStars.slice(0, 5).join(", ")}
                        {fig.missingCatalogStars.length > 5 ? "…" : ""}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-sky-300">
                    +{fig.points}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Rubric (0–10)
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(RUBRIC_WEIGHTS) as (keyof typeof RUBRIC_WEIGHTS)[]).map(
            (key) => {
              const value = rubric[key];
              const weight = RUBRIC_WEIGHTS[key];
              const contribution = Math.round(100 * weight * value) / 10;
              return (
                <li key={key} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-zinc-300">
                      {RUBRIC_LABELS[key]}
                      <span className="ml-1 text-zinc-600">
                        ×{(weight * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span className="tabular-nums text-zinc-400">
                      {value}/10 → {contribution}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
                    <div
                      className="h-full rounded bg-sky-500/80"
                      style={{ width: `${value * 10}%` }}
                    />
                  </div>
                </li>
              );
            }
          )}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Quality {score.score}
          {subjectBonus > 0 ? ` + subject ${subjectBonus}` : ""} = final{" "}
          {score.finalScore} (capped at 100)
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Rarity ladder
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {[...RARITY_THRESHOLDS].reverse().map((tier) => {
            const active = tier.rarity === score.rarity;
            const wasRaw =
              score.uncappedRarity === tier.rarity &&
              score.uncappedRarity !== score.rarity;
            return (
              <li
                key={tier.rarity}
                className={`rounded border px-2 py-1 text-xs ${
                  active
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
                    : wasRaw
                      ? "border-amber-700/50 text-amber-200/80 line-through"
                      : "border-zinc-800 text-zinc-500"
                }`}
              >
                {tier.rarity}
                <span className="ml-1 text-[10px] opacity-70">
                  ≥{tier.min} · {AWARD_POINTS[tier.rarity]}pts
                </span>
              </li>
            );
          })}
        </ul>
        {score.capNotes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
            {score.capNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : score.uncappedRarity &&
          score.uncappedRarity !== score.rarity ? (
          <p className="mt-2 text-xs text-amber-200/80">
            Raw tier {score.uncappedRarity} → capped to {score.rarity}.
          </p>
        ) : null}
      </div>

      {score.subjects.length === 0 ? (
        <p className="text-xs text-zinc-600">
          Subject bonuses unlock for deep-sky, meteor, aurora, comet, and similar
          finds — none applied on this frame.
        </p>
      ) : null}
    </div>
  );
}
