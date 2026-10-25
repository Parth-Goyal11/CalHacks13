import { findConstellationPattern } from "@calhacks13/lib";

export type CatchMotion =
  | "slash"
  | "dip"
  | "zigzag"
  | "wings"
  | "bloom"
  | "vibrate"
  | "dive"
  | "prowl"
  | "charge"
  | "spark"
  | "mirror"
  | "wag"
  | "curl"
  | "gallop"
  | "drift"
  | "spin"
  | "rise"
  | "flash"
  | "loose";

const MOTION: Record<string, CatchMotion> = {
  Orion: "slash",
  "Ursa Major": "dip",
  "Big Dipper": "dip",
  Cassiopeia: "zigzag",
  Cygnus: "wings",
  "Summer Triangle": "bloom",
  Lyra: "vibrate",
  Aquila: "dive",
  Leo: "prowl",
  Taurus: "charge",
  Pleiades: "spark",
  Gemini: "mirror",
  "Canis Major": "wag",
  Scorpius: "curl",
  Pegasus: "gallop",
  Andromeda: "drift",
  Auriga: "spin",
  "Boötes": "rise",
  Crux: "flash",
  "Southern Cross": "flash",
  Sagittarius: "loose",
};

export function catchMotion(name: string): CatchMotion {
  const pattern = findConstellationPattern(name);
  if (pattern && MOTION[pattern.name]) return MOTION[pattern.name];
  return "drift";
}

export interface CatchTier {
  name: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  ink: string;
}

/** Rarity of this catch from the points it actually collected. */
export function catchTier(points: number, kind: string): CatchTier {
  let weight = points;
  if (kind === "galaxy" || kind === "meteor") weight += 10;
  else if (kind === "planet" || kind === "moon") weight += 6;
  if (weight >= 32) return { name: "Legendary", ink: "#fde68a" };
  if (weight >= 26) return { name: "Epic", ink: "#d8b4fe" };
  if (weight >= 20) return { name: "Rare", ink: "#7dd3fc" };
  if (weight >= 14) return { name: "Uncommon", ink: "#86efac" };
  return { name: "Common", ink: "#d4d4d8" };
}
