"use client";

import type { FovCrossCheck, FovPrediction } from "@calhacks13/lib";

interface AngleFovPanelProps {
  prediction: FovPrediction;
  fovCheck: FovCrossCheck | null;
}

export function AngleFovPanel({ prediction, fovCheck }: AngleFovPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Location + angle layer
        </p>
        <p className="text-xs text-zinc-500">
          {prediction.facingKnown
            ? `facing ${prediction.facingDegrees?.toFixed(0)}° · elev ${prediction.elevationDegrees.toFixed(0)}° · FOV ${prediction.fovDegrees.toFixed(0)}°`
            : `elev ${prediction.elevationDegrees.toFixed(0)}° · FOV ${prediction.fovDegrees.toFixed(0)}° · facing unknown`}
        </p>
      </div>

      <p className="text-sm text-zinc-400">
        Predicted what should sit in the photo from your lat/lon, time, facing,
        and camera elevation — then cross-checked against verified detections.
      </p>

      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Expected in frame ({prediction.inFrame.length})
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {prediction.inFrame.map((p) => (
            <li
              key={p.name}
              className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-300"
              title={`alt ${p.altitudeDeg}° · az ${p.azimuthDeg}° · Δaz ${p.offsetAzDeg}°`}
            >
              {p.name}
              {p.predictedX != null && p.predictedY != null ? (
                <span className="ml-1 text-[10px] text-zinc-600">
                  ({p.predictedX.toFixed(2)}, {p.predictedY.toFixed(2)})
                </span>
              ) : null}
            </li>
          ))}
          {prediction.inFrame.length === 0 ? (
            <li className="text-xs text-zinc-600">None strongly in FOV.</li>
          ) : null}
        </ul>
      </div>

      {fovCheck ? (
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded border border-zinc-800/80 px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Detected as expected
            </p>
            <p className="mt-1 text-sky-300">
              {fovCheck.expectedDetected.length
                ? fovCheck.expectedDetected.join(", ")
                : "—"}
            </p>
          </div>
          <div className="rounded border border-zinc-800/80 px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Expected but missing
            </p>
            <p className="mt-1 text-amber-200/80">
              {fovCheck.expectedMissing.length
                ? fovCheck.expectedMissing.join(", ")
                : "—"}
            </p>
          </div>
          <div className="rounded border border-zinc-800/80 px-2 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Outside FOV flags
            </p>
            <p className="mt-1 text-rose-300/80">
              {fovCheck.unexpected.length
                ? fovCheck.unexpected.join(", ")
                : "—"}
            </p>
          </div>
        </div>
      ) : null}

      {fovCheck ? (
        <p className="text-xs text-zinc-500">{fovCheck.summary}</p>
      ) : null}
    </div>
  );
}
