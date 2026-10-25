"use client";

import { findConstellationPattern, type CatalogStar } from "@calhacks13/lib";
import type { CollectionTier } from "./collection";

const SHOWN: Record<CollectionTier, number> = {
  F: 0.28,
  E: 0.42,
  D: 0.55,
  C: 0.7,
  B: 0.85,
  A: 1,
  S: 1,
};

function fallbackStars(name: string): CatalogStar[] {
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 5 }, (_, index) => ({
    name: `${name} ${index + 1}`,
    x: 0.18 + ((hash >> (index * 3)) & 7) / 12,
    y: 0.16 + index * 0.16,
    mag: 2,
  }));
}

export default function ConstellationMap({
  name,
  tier,
  progress,
  accent,
}: {
  name: string;
  tier: CollectionTier;
  progress: number;
  accent?: string;
}) {
  const pattern = findConstellationPattern(name);
  const stars = pattern?.stars.length ? pattern.stars : fallbackStars(name);
  const lines =
    pattern?.lines ??
    stars.slice(1).map((star, index) => ({
      from: stars[index]?.name ?? "",
      to: star.name,
    }));
  const amount = Math.min(1, Math.max(0, progress)) * SHOWN[tier];
  const count = Math.max(tier === "F" ? 2 : 1, Math.ceil(stars.length * amount));
  const visible = stars.slice(0, Math.min(stars.length, count));
  const visibleNames = new Set(visible.map((star) => star.name));
  const color = tier === "F" ? "#8b93a7" : accent || pattern?.accent || "#ffd678";
  const drawLines = tier !== "F";
  const labelStars = tier === "A" || tier === "S";

  return (
    <svg
      className={`constellation-map tier-${tier.toLowerCase()}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${name} constellation map`}
    >
      <rect width="100" height="100" rx="8" fill="#07080d" />
      {drawLines
        ? lines.map((line) => {
            if (!visibleNames.has(line.from) || !visibleNames.has(line.to)) return null;
            const from = stars.find((star) => star.name === line.from);
            const to = stars.find((star) => star.name === line.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${line.from}-${line.to}`}
                x1={from.x * 100}
                y1={from.y * 100}
                x2={to.x * 100}
                y2={to.y * 100}
                stroke={color}
                strokeWidth={tier === "S" ? 1.4 : 0.8}
                strokeLinecap="round"
                opacity={tier === "S" ? 0.95 : 0.65}
              />
            );
          })
        : null}
      {visible.map((star) => (
        <g key={star.name}>
          <circle
            cx={star.x * 100}
            cy={star.y * 100}
            r={tier === "S" ? 1.8 : 1.15}
            fill={tier === "F" ? "#c5cad6" : "#fff8e7"}
          />
          {labelStars ? (
            <text x={star.x * 100 + 2.2} y={star.y * 100 - 1.6} fill={color} fontSize="3.2">
              {star.name}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
