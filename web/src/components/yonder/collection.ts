import { figureIdentity } from "@calhacks13/lib";
import type { CelestialObject } from "./sky-data";
import type { SkyPhotoResult } from "./photo-types";

export const COLLECTION_TIERS = ["F", "E", "D", "C", "B", "A"] as const;
export type CollectionTier = (typeof COLLECTION_TIERS)[number];

/** Game perks for a caught star pattern. The tier comes from the coded score. */
export const TIER_PERKS: Record<CollectionTier, { perk: string; detail: string }> = {
  F: { perk: "Ember", detail: "The pattern is kept as a silhouette." },
  E: { perk: "Spark", detail: "A small light marks this pattern in the collection." },
  D: { perk: "Trail", detail: "The stick figure stays with this creature." },
  C: { perk: "Lantern", detail: "The creature model is saved on this device." },
  B: { perk: "Beacon", detail: "This creature marks the brightest star in the pattern." },
  A: { perk: "Crown", detail: "This creature stays at the front of the collection." },
};

const RANK: Record<CollectionTier, number> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5 };

export type StoredCreature = {
  id: string;
  name: string;
  motif: string;
  tier: CollectionTier;
  perk: string;
  perkDetail: string;
  points: number;
  caughtAt: string;
  image?: Blob;
};

export function tierForPoints(points: number): CollectionTier {
  if (points >= 32) return "A";
  if (points >= 26) return "B";
  if (points >= 20) return "C";
  if (points >= 14) return "D";
  if (points >= 8) return "E";
  return "F";
}

export function tierRank(tier: CollectionTier) {
  return RANK[tier];
}

export function creatureFromObject(object: CelestialObject): StoredCreature | null {
  if (object.kind !== "constellation" && object.kind !== "asterism") return null;
  const points = object.highlightPoints ?? 0;
  const tier = tierForPoints(points);
  const perk = TIER_PERKS[tier];
  const look = figureIdentity(object.name, object.kind);
  return {
    id: object.name.toLowerCase(),
    name: object.name,
    motif: object.motif || look.motif,
    tier,
    perk: perk.perk,
    perkDetail: perk.detail,
    points,
    caughtAt: new Date().toISOString(),
  };
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
        highlightPoints: highlight?.points ?? 0,
      });
      return draft!;
    });
}
