"use client";

import type { CelestialEventKind } from "@calhacks13/lib";

/**
 * Naked-eye night-sky stills — framed like you’re outside looking up.
 */
const V = "v2";

export const KIND_SCENE: Record<CelestialEventKind, { image: string; caption: string }> = {
  full_moon: {
    image: `/yonder/events/full_moon.jpg?${V}`,
    caption: "Full moon overhead",
  },
  supermoon: {
    image: `/yonder/events/supermoon.jpg?${V}`,
    caption: "Supermoon overhead",
  },
  new_moon: {
    image: `/yonder/events/new_moon.jpg?${V}`,
    caption: "Dark-sky milky way",
  },
  meteor_shower: {
    image: `/yonder/events/meteor_shower.jpg?${V}`,
    caption: "Meteors across the sky",
  },
  lunar_eclipse: {
    image: `/yonder/events/lunar_eclipse.jpg?${V}`,
    caption: "Blood moon",
  },
  solar_eclipse: {
    image: `/yonder/events/solar_eclipse.jpg?${V}`,
    caption: "Totality corona",
  },
  iss_pass: {
    image: `/yonder/events/iss.jpg?${V}`,
    caption: "ISS pass overhead",
  },
  launch: {
    image: `/yonder/events/launch.jpg?${V}`,
    caption: "Distant night launch",
  },
  planetary_conjunction: {
    image: `/yonder/events/conjunction.jpg?${V}`,
    caption: "Planets close in the sky",
  },
  comet: {
    image: `/yonder/events/comet.jpg?${V}`,
    caption: "Comet in the stars",
  },
  aurora_window: {
    image: `/yonder/events/aurora.jpg?${V}`,
    caption: "Northern lights",
  },
};

export function EventSkyArt({
  kind,
  title,
}: {
  kind: CelestialEventKind;
  title: string;
}) {
  const scene = KIND_SCENE[kind] ?? KIND_SCENE.full_moon;

  return (
    <div className="yonder-event-visual">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="yonder-event-visual-photo"
        src={scene.image}
        alt=""
        loading="lazy"
      />
      <span className="yonder-event-visual-shade" aria-hidden />
      <span className="yonder-event-visual-grain" aria-hidden />
      <span className="sr-only">{title} — {scene.caption}</span>
    </div>
  );
}
