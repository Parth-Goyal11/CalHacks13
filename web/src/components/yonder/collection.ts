import { figureIdentity, findConstellationPattern } from "@calhacks13/lib";
import type { CelestialObject } from "./sky-data";
import type { SkyPhotoResult } from "./photo-types";

export const COLLECTION_TIERS = ["F", "E", "D", "C", "B", "A", "S"] as const;
export type CollectionTier = (typeof COLLECTION_TIERS)[number];

/** Game perks for a caught star pattern. The tier comes from the coded score. */
export const TIER_PERKS: Record<CollectionTier, { perk: string; detail: string }> = {
  F: { perk: "Shadow", detail: "Only an unfinished outline is kept." },
  E: { perk: "Spark", detail: "A few stars are remembered with the outline." },
  D: { perk: "Trail", detail: "The stick-figure lines stay on the map." },
  C: { perk: "Lantern", detail: "The creature keeps one signature color." },
  B: { perk: "Beacon", detail: "A solid creature model is saved on this device." },
  A: { perk: "Crown", detail: "Named stars and a finished model lead the collection." },
  S: { perk: "Myth", detail: "The full star map, every name, and a finished creature stay at the front." },
};

const RANK: Record<CollectionTier, number> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };

const FORM: Record<CollectionTier, string> = {
  F: "Unfinished shadow",
  E: "Thin sketch",
  D: "Stick-figure body",
  C: "Painted figurine",
  B: "Solid model",
  A: "Finished character",
  S: "Fully modeled body",
};

/** Qualities this tier is allowed to record. F keeps one. S keeps the whole catch. */
const TRACKED: Record<CollectionTier, string[]> = {
  F: ["form"],
  E: ["form", "stars"],
  D: ["form", "stars", "lines"],
  C: ["form", "stars", "lines", "color"],
  B: ["form", "stars", "lines", "color", "model"],
  A: ["form", "stars", "lines", "color", "model", "light", "names"],
  S: ["form", "stars", "lines", "color", "model", "light", "names", "place"],
};

export type QualityTrack = {
  key: string;
  label: string;
  value: string;
};

export type StoredCreature = {
  id: string;
  name: string;
  motif: string;
  tier: CollectionTier;
  perk: string;
  perkDetail: string;
  points: number;
  caughtAt: string;
  accent?: string;
  tracks?: QualityTrack[];
  image?: Blob;
};

export function tierForPoints(points: number): CollectionTier {
  if (points >= 32) return "S";
  if (points >= 26) return "A";
  if (points >= 20) return "B";
  if (points >= 14) return "C";
  if (points >= 10) return "D";
  if (points >= 6) return "E";
  return "F";
}

export function tierRank(tier: CollectionTier) {
  return RANK[tier];
}

export function qualityTracks(creature: Pick<StoredCreature, "name" | "tier" | "motif">): QualityTrack[] {
  const pattern = findConstellationPattern(creature.name);
  const starNames = pattern?.stars.map((star) => star.name) ?? [];
  const lineCount = pattern?.lines.length ?? 0;
  const all: Record<string, QualityTrack> = {
    form: { key: "form", label: "Form", value: FORM[creature.tier] },
    stars: {
      key: "stars",
      label: "Stars",
      value: starNames.length ? `${starNames.length} mapped` : "Marked in the photo",
    },
    lines: {
      key: "lines",
      label: "Map",
      value: creature.tier === "S" ? `${lineCount || "All"} classic lines` : "Partial stick figure",
    },
    color: { key: "color", label: "Color", value: pattern?.accent ?? creature.motif },
    model: {
      key: "model",
      label: "Model",
      value: creature.tier === "S" ? "Museum render" : "Saved figurine",
    },
    light: {
      key: "light",
      label: "Light",
      value: creature.tier === "S" ? "Starlight crown" : "Rim light",
    },
    names: {
      key: "names",
      label: "Names",
      value: starNames.length ? starNames.join(", ") : creature.name,
    },
    place: { key: "place", label: "Place", value: "Front of the collection" },
  };
  return TRACKED[creature.tier].map((key) => all[key]);
}

export function creatureFromObject(object: CelestialObject): StoredCreature | null {
  if (object.kind !== "constellation" && object.kind !== "asterism") return null;
  const points = object.highlightPoints ?? 0;
  const tier = tierForPoints(points);
  const perk = TIER_PERKS[tier];
  const look = figureIdentity(object.name, object.kind);
  const draft = {
    id: object.name.toLowerCase(),
    name: object.name,
    motif: object.motif || look.motif,
    tier,
    perk: perk.perk,
    perkDetail: perk.detail,
    points,
    caughtAt: new Date().toISOString(),
    accent: object.accent || look.accent,
  };
  return { ...draft, tracks: qualityTracks(draft) };
}

export function creaturesFrom(result: SkyPhotoResult): StoredCreature[] {
  const reveal = result.reveal;
  if (!reveal) return [];
  const highlights = reveal.score.highlights ?? [];
  return reveal.analysis.figures
    .filter(
      (figure) =>
        figure.id !== "none-confident" &&
        (figure.kind === "constellation" || figure.kind === "asterism"),
    )
    .map((figure) => {
      const highlight = highlights.find((item) => item.figureId === figure.id);
      const draft = creatureFromObject({
        id: figure.id,
        name: figure.name,
        kind: figure.kind,
        detail: "",
        motif: figureIdentity(figure.name, figure.kind).motif,
        accent: figureIdentity(figure.name, figure.kind).accent,
        highlightPoints: highlight?.points ?? 0,
      });
      return draft!;
    });
}
