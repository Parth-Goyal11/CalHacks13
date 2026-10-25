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

/** Points a clearer photo needs before this creature can climb. S has no next tier. */
const NEXT_POINTS: Record<CollectionTier, number | null> = {
  F: 6,
  E: 10,
  D: 14,
  C: 20,
  B: 26,
  A: 32,
  S: null,
};

/** Coded collection bonus. Higher tiers are worth more, so a better photo changes the score. */
const TIER_BOOST: Record<CollectionTier, { name: string; score: number; quest: string }> = {
  F: { name: "Shadow mark", score: 5, quest: "Photograph it again and the outline can wake." },
  E: { name: "Spark", score: 10, quest: "Catch a few more of its stars to grow a trail." },
  D: { name: "Trail", score: 20, quest: "A clearer figure keeps the stick-map." },
  C: { name: "Lantern", score: 35, quest: "Hold its color in a sharper photo." },
  B: { name: "Beacon", score: 55, quest: "One stronger catch turns the model into a crown." },
  A: { name: "Crown", score: 80, quest: "Name the stars cleanly to reach Myth." },
  S: { name: "Mythic aura", score: 120, quest: "This one leads the collection. Raise another sky to join it." },
};

const EPITHETS: Record<CollectionTier, string[]> = {
  F: ["a sleeping outline", "a lost shadow", "an unfinished hush", "a faint echo"],
  E: ["a first spark", "a thin light", "a waking sketch", "a shy glimmer"],
  D: ["a traced path", "a walking line", "a drawn trail", "a mapped stride"],
  C: ["a kept color", "a lantern body", "a painted night", "a glowing coat"],
  B: ["a standing model", "a signal beast", "a solid watch", "a beacon form"],
  A: ["a named crown", "a finished guard", "a starlit lead", "a crowned shape"],
  S: ["a living myth", "a sky legend", "a full night", "a museum creature"],
};

export type CreatureGift = {
  epithet: string;
  boost: string;
  score: number;
  quest: string;
  gap: number | null;
  nextTier: CollectionTier | null;
};

function nameHash(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** A title unique to this constellation, plus the tier bonus and the points left to evolve. */
export function creatureGift(creature: Pick<StoredCreature, "name" | "tier" | "points">): CreatureGift {
  const boost = TIER_BOOST[creature.tier];
  const epithets = EPITHETS[creature.tier];
  const nextTier = COLLECTION_TIERS[RANK[creature.tier] + 1] ?? null;
  const need = NEXT_POINTS[creature.tier];
  return {
    epithet: epithets[nameHash(creature.name) % epithets.length],
    boost: boost.name,
    score: boost.score,
    quest: boost.quest,
    gap: need == null ? null : Math.max(0, need - creature.points),
    nextTier,
  };
}

export function collectionPower(creatures: Pick<StoredCreature, "name" | "tier" | "points">[]) {
  return creatures.reduce((sum, creature) => sum + creatureGift(creature).score, 0);
}

export function nextEvolution(creatures: StoredCreature[]) {
  const open = creatures
    .map((creature) => ({ creature, gift: creatureGift(creature) }))
    .filter((item): item is { creature: StoredCreature; gift: CreatureGift & { gap: number } } => item.gift.gap != null)
    .sort((a, b) => a.gift.gap - b.gift.gap || a.creature.name.localeCompare(b.creature.name));
  return open[0] ?? null;
}

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
