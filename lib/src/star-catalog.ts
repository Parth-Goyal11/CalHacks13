/**
 * Classic stick-figure star alignment database.
 * Relative (x,y) are unit-square atlas coords used for topology / similarity
 * checks against Grok pixel placements (not a plate solve).
 */

export interface CatalogStar {
  name: string;
  x: number;
  y: number;
  /** Approximate visual magnitude; lower = brighter. */
  mag: number;
}

export interface CatalogLine {
  from: string;
  to: string;
}

export interface ConstellationPattern {
  name: string;
  aliases: string[];
  kind: "constellation" | "asterism";
  /** Short identity used in the award animation, e.g. "The Hunter". */
  motif: string;
  /** Signature color for this figure's lines and medal. */
  accent: string;
  stars: CatalogStar[];
  lines: CatalogLine[];
}

function S(name: string, x: number, y: number, mag: number): CatalogStar {
  return { name, x, y, mag };
}

function L(from: string, to: string): CatalogLine {
  return { from, to };
}

/** Core naked-eye patterns used for alignment verification. */
export const CONSTELLATION_PATTERNS: ConstellationPattern[] = [
  {
    name: "Orion",
    aliases: ["orion", "the hunter"],
    kind: "constellation",
    motif: "The Hunter",
    accent: "#ffb020",
    stars: [
      S("Meissa", 0.5, 0.08, 3.4),
      S("Betelgeuse", 0.72, 0.22, 0.5),
      S("Bellatrix", 0.28, 0.24, 1.6),
      S("Mintaka", 0.4, 0.48, 2.2),
      S("Alnilam", 0.5, 0.5, 1.7),
      S("Alnitak", 0.6, 0.52, 1.8),
      S("Saiph", 0.7, 0.82, 2.1),
      S("Rigel", 0.3, 0.84, 0.2),
    ],
    lines: [
      L("Betelgeuse", "Meissa"),
      L("Meissa", "Bellatrix"),
      L("Bellatrix", "Mintaka"),
      L("Mintaka", "Alnilam"),
      L("Alnilam", "Alnitak"),
      L("Alnitak", "Betelgeuse"),
      L("Alnitak", "Saiph"),
      L("Saiph", "Rigel"),
      L("Rigel", "Mintaka"),
    ],
  },
  {
    name: "Ursa Major",
    aliases: ["ursa major", "great bear", "big bear"],
    kind: "constellation",
    motif: "The Great Bear",
    accent: "#7dffb3",
    stars: [
      S("Dubhe", 0.22, 0.28, 1.8),
      S("Merak", 0.22, 0.42, 2.3),
      S("Phecda", 0.4, 0.48, 2.4),
      S("Megrez", 0.48, 0.36, 3.3),
      S("Alioth", 0.62, 0.32, 1.8),
      S("Mizar", 0.78, 0.28, 2.2),
      S("Alkaid", 0.92, 0.22, 1.9),
    ],
    lines: [
      L("Dubhe", "Merak"),
      L("Merak", "Phecda"),
      L("Phecda", "Megrez"),
      L("Megrez", "Dubhe"),
      L("Megrez", "Alioth"),
      L("Alioth", "Mizar"),
      L("Mizar", "Alkaid"),
    ],
  },
  {
    name: "Big Dipper",
    aliases: ["big dipper", "the plough", "plough", "saucepan"],
    kind: "asterism",
    motif: "The Dipper",
    accent: "#b6ff7a",
    stars: [
      S("Dubhe", 0.22, 0.28, 1.8),
      S("Merak", 0.22, 0.42, 2.3),
      S("Phecda", 0.4, 0.48, 2.4),
      S("Megrez", 0.48, 0.36, 3.3),
      S("Alioth", 0.62, 0.32, 1.8),
      S("Mizar", 0.78, 0.28, 2.2),
      S("Alkaid", 0.92, 0.22, 1.9),
    ],
    lines: [
      L("Dubhe", "Merak"),
      L("Merak", "Phecda"),
      L("Phecda", "Megrez"),
      L("Megrez", "Dubhe"),
      L("Megrez", "Alioth"),
      L("Alioth", "Mizar"),
      L("Mizar", "Alkaid"),
    ],
  },
  {
    name: "Cassiopeia",
    aliases: ["cassiopeia", "cass", "w shape", "the w"],
    kind: "constellation",
    motif: "The Queen",
    accent: "#d7b4ff",
    stars: [
      S("Caph", 0.08, 0.42, 2.3),
      S("Schedar", 0.28, 0.28, 2.2),
      S("Gamma Cas", 0.5, 0.48, 2.2),
      S("Ruchbah", 0.72, 0.32, 2.7),
      S("Segin", 0.92, 0.45, 3.4),
    ],
    lines: [
      L("Caph", "Schedar"),
      L("Schedar", "Gamma Cas"),
      L("Gamma Cas", "Ruchbah"),
      L("Ruchbah", "Segin"),
    ],
  },
  {
    name: "Cygnus",
    aliases: ["cygnus", "northern cross", "the swan"],
    kind: "constellation",
    motif: "The Swan",
    accent: "#9fd4ff",
    stars: [
      S("Deneb", 0.5, 0.12, 1.3),
      S("Sadr", 0.5, 0.4, 2.2),
      S("Gienah", 0.18, 0.48, 2.5),
      S("Delta Cyg", 0.82, 0.48, 2.9),
      S("Albireo", 0.5, 0.88, 3.1),
    ],
    lines: [
      L("Deneb", "Sadr"),
      L("Sadr", "Albireo"),
      L("Gienah", "Sadr"),
      L("Sadr", "Delta Cyg"),
    ],
  },
  {
    name: "Summer Triangle",
    aliases: ["summer triangle"],
    kind: "asterism",
    motif: "The Triangle",
    accent: "#7ee7ff",
    stars: [
      S("Vega", 0.2, 0.2, 0.0),
      S("Deneb", 0.75, 0.15, 1.3),
      S("Altair", 0.55, 0.85, 0.8),
    ],
    lines: [
      L("Vega", "Deneb"),
      L("Deneb", "Altair"),
      L("Altair", "Vega"),
    ],
  },
  {
    name: "Lyra",
    aliases: ["lyra", "the lyre"],
    kind: "constellation",
    motif: "The Lyre",
    accent: "#6ee7ff",
    stars: [
      S("Vega", 0.62, 0.16, 0.0),
      S("Zeta Lyr", 0.48, 0.36, 4.3),
      S("Sheliak", 0.26, 0.62, 3.5),
      S("Sulafat", 0.52, 0.78, 3.2),
      S("Delta Lyr", 0.74, 0.5, 4.2),
    ],
    lines: [
      L("Vega", "Zeta Lyr"),
      L("Zeta Lyr", "Sheliak"),
      L("Sheliak", "Sulafat"),
      L("Sulafat", "Delta Lyr"),
      L("Delta Lyr", "Zeta Lyr"),
    ],
  },
  {
    name: "Aquila",
    aliases: ["aquila", "the eagle"],
    kind: "constellation",
    motif: "The Eagle",
    accent: "#ffd36e",
    stars: [
      S("Altair", 0.5, 0.4, 0.8),
      S("Tarazed", 0.42, 0.28, 2.7),
      S("Alshain", 0.58, 0.55, 3.7),
    ],
    lines: [L("Tarazed", "Altair"), L("Altair", "Alshain")],
  },
  {
    name: "Leo",
    aliases: ["leo", "the lion"],
    kind: "constellation",
    motif: "The Lion",
    accent: "#ffcf70",
    stars: [
      S("Regulus", 0.28, 0.62, 1.4),
      S("Algieba", 0.38, 0.4, 2.0),
      S("Adhafera", 0.46, 0.26, 3.4),
      S("Rasalas", 0.56, 0.18, 3.9),
      S("Zosma", 0.68, 0.34, 2.6),
      S("Chertan", 0.74, 0.55, 3.3),
      S("Denebola", 0.9, 0.42, 2.1),
    ],
    lines: [
      L("Regulus", "Algieba"),
      L("Algieba", "Adhafera"),
      L("Adhafera", "Rasalas"),
      L("Algieba", "Zosma"),
      L("Zosma", "Chertan"),
      L("Chertan", "Denebola"),
      L("Denebola", "Zosma"),
    ],
  },
  {
    name: "Taurus",
    aliases: ["taurus", "the bull"],
    kind: "constellation",
    motif: "The Bull",
    accent: "#ff8a5b",
    stars: [
      S("Aldebaran", 0.46, 0.62, 0.9),
      S("Ain", 0.3, 0.46, 3.5),
      S("Hyadum", 0.58, 0.4, 3.6),
      S("Elnath", 0.78, 0.16, 1.7),
    ],
    lines: [
      L("Ain", "Aldebaran"),
      L("Aldebaran", "Hyadum"),
      L("Hyadum", "Elnath"),
    ],
  },
  {
    name: "Pleiades",
    aliases: ["pleiades", "m45", "seven sisters", "subaru"],
    kind: "asterism",
    motif: "The Sisters",
    accent: "#dbe7ff",
    stars: [
      S("Alcyone", 0.55, 0.48, 2.9),
      S("Atlas", 0.72, 0.52, 3.6),
      S("Electra", 0.35, 0.45, 3.7),
      S("Maia", 0.45, 0.35, 3.9),
      S("Merope", 0.52, 0.58, 4.2),
      S("Taygeta", 0.38, 0.32, 4.3),
      S("Pleione", 0.7, 0.45, 5.1),
    ],
    lines: [
      L("Electra", "Maia"),
      L("Maia", "Taygeta"),
      L("Maia", "Alcyone"),
      L("Alcyone", "Merope"),
      L("Alcyone", "Atlas"),
      L("Atlas", "Pleione"),
    ],
  },
  {
    name: "Gemini",
    aliases: ["gemini", "the twins"],
    kind: "constellation",
    motif: "The Twins",
    accent: "#9eb6ff",
    stars: [
      S("Castor", 0.34, 0.16, 1.6),
      S("Pollux", 0.62, 0.22, 1.2),
      S("Mebsuta", 0.32, 0.4, 3.1),
      S("Wasat", 0.46, 0.52, 3.5),
      S("Alhena", 0.58, 0.72, 1.9),
    ],
    lines: [
      L("Castor", "Pollux"),
      L("Castor", "Mebsuta"),
      L("Pollux", "Wasat"),
      L("Wasat", "Alhena"),
    ],
  },
  {
    name: "Canis Major",
    aliases: ["canis major", "great dog", "the great dog"],
    kind: "constellation",
    motif: "The Great Dog",
    accent: "#8ec5ff",
    stars: [
      S("Sirius", 0.38, 0.32, -1.5),
      S("Mirzam", 0.18, 0.4, 2.0),
      S("Wezen", 0.62, 0.52, 1.8),
      S("Adhara", 0.46, 0.68, 1.5),
      S("Aludra", 0.78, 0.78, 2.4),
    ],
    lines: [
      L("Mirzam", "Sirius"),
      L("Sirius", "Wezen"),
      L("Wezen", "Adhara"),
      L("Adhara", "Sirius"),
      L("Wezen", "Aludra"),
    ],
  },
  {
    name: "Scorpius",
    aliases: ["scorpius", "scorpio", "the scorpion"],
    kind: "constellation",
    motif: "The Scorpion",
    accent: "#ff5d6c",
    stars: [
      S("Acrab", 0.16, 0.16, 2.6),
      S("Dschubba", 0.28, 0.26, 2.3),
      S("Antares", 0.4, 0.42, 1.1),
      S("Sargas", 0.58, 0.62, 1.9),
      S("Shaula", 0.74, 0.8, 1.6),
      S("Lesath", 0.84, 0.7, 2.7),
    ],
    lines: [
      L("Acrab", "Dschubba"),
      L("Dschubba", "Antares"),
      L("Antares", "Sargas"),
      L("Sargas", "Shaula"),
      L("Shaula", "Lesath"),
    ],
  },
  {
    name: "Pegasus",
    aliases: ["pegasus", "great square", "square of pegasus", "the winged horse"],
    kind: "constellation",
    motif: "The Winged Horse",
    accent: "#f0c27a",
    stars: [
      S("Markab", 0.32, 0.64, 2.5),
      S("Scheat", 0.32, 0.28, 2.4),
      S("Algenib", 0.68, 0.66, 2.8),
      S("Alpheratz", 0.68, 0.3, 2.1),
      S("Enif", 0.9, 0.42, 2.4),
    ],
    lines: [
      L("Markab", "Scheat"),
      L("Scheat", "Alpheratz"),
      L("Alpheratz", "Algenib"),
      L("Algenib", "Markab"),
      L("Scheat", "Enif"),
    ],
  },
  {
    name: "Andromeda",
    aliases: ["andromeda", "the chained maiden"],
    kind: "constellation",
    motif: "The Chained Maiden",
    accent: "#c4b5fd",
    stars: [
      S("Alpheratz", 0.2, 0.35, 2.1),
      S("Mirach", 0.5, 0.48, 2.1),
      S("Almach", 0.82, 0.42, 2.1),
    ],
    lines: [L("Alpheratz", "Mirach"), L("Mirach", "Almach")],
  },
  {
    name: "Auriga",
    aliases: ["auriga", "the charioteer"],
    kind: "constellation",
    motif: "The Charioteer",
    accent: "#ffe08a",
    stars: [
      S("Capella", 0.42, 0.22, 0.1),
      S("Menkalinan", 0.68, 0.34, 1.9),
      S("Elnath", 0.62, 0.7, 1.7),
      S("Hassaleh", 0.22, 0.46, 2.7),
      S("Mahasim", 0.72, 0.58, 2.6),
    ],
    lines: [
      L("Capella", "Menkalinan"),
      L("Menkalinan", "Mahasim"),
      L("Mahasim", "Elnath"),
      L("Elnath", "Hassaleh"),
      L("Hassaleh", "Capella"),
    ],
  },
  {
    name: "Boötes",
    aliases: ["bootes", "boötes", "the herdsman"],
    kind: "constellation",
    motif: "The Herdsman",
    accent: "#ff9b54",
    stars: [
      S("Nekkar", 0.58, 0.16, 3.5),
      S("Seginus", 0.34, 0.28, 3.0),
      S("Izar", 0.5, 0.42, 2.4),
      S("Arcturus", 0.48, 0.78, 0.2),
      S("Muphrid", 0.3, 0.66, 2.7),
    ],
    lines: [
      L("Seginus", "Nekkar"),
      L("Nekkar", "Izar"),
      L("Izar", "Seginus"),
      L("Izar", "Arcturus"),
      L("Arcturus", "Muphrid"),
    ],
  },
  {
    name: "Crux",
    aliases: ["crux", "southern cross"],
    kind: "constellation",
    motif: "The Cross",
    accent: "#ffffff",
    stars: [
      S("Acrux", 0.5, 0.78, 0.8),
      S("Mimosa", 0.72, 0.42, 1.3),
      S("Gacrux", 0.5, 0.22, 1.6),
      S("Delta Crucis", 0.28, 0.45, 2.8),
    ],
    lines: [L("Gacrux", "Acrux"), L("Delta Crucis", "Mimosa")],
  },
  {
    name: "Southern Cross",
    aliases: ["the southern cross"],
    kind: "asterism",
    motif: "The Cross",
    accent: "#f4f7ff",
    stars: [
      S("Acrux", 0.5, 0.78, 0.8),
      S("Mimosa", 0.72, 0.42, 1.3),
      S("Gacrux", 0.5, 0.22, 1.6),
      S("Delta Crucis", 0.28, 0.45, 2.8),
    ],
    lines: [L("Gacrux", "Acrux"), L("Delta Crucis", "Mimosa")],
  },
  {
    name: "Sagittarius",
    aliases: ["sagittarius", "teapot", "the teapot", "the archer"],
    kind: "constellation",
    motif: "The Archer",
    accent: "#ff7ad9",
    stars: [
      S("Kaus Borealis", 0.42, 0.28, 2.8),
      S("Kaus Media", 0.36, 0.5, 2.7),
      S("Kaus Australis", 0.4, 0.72, 1.8),
      S("Ascella", 0.56, 0.62, 2.6),
      S("Nunki", 0.66, 0.46, 2.0),
      S("Alnasl", 0.82, 0.4, 2.9),
    ],
    lines: [
      L("Kaus Borealis", "Kaus Media"),
      L("Kaus Media", "Kaus Australis"),
      L("Kaus Australis", "Ascella"),
      L("Ascella", "Nunki"),
      L("Nunki", "Kaus Borealis"),
      L("Nunki", "Alnasl"),
    ],
  },
];

const STAR_ALIASES: Record<string, string> = {
  "alpha ori": "betelgeuse",
  "alpha orionis": "betelgeuse",
  "beta ori": "rigel",
  "beta orionis": "rigel",
  "gamma ori": "bellatrix",
  "delta ori": "mintaka",
  "epsilon ori": "alnilam",
  "zeta ori": "alnitak",
  "kappa ori": "saiph",
  "alpha cma": "sirius",
  "alpha cyg": "deneb",
  "alpha lyr": "vega",
  "alpha aql": "altair",
  "alpha uma": "dubhe",
  "beta uma": "merak",
  "gamma uma": "phecda",
  "delta uma": "megrez",
  "epsilon uma": "alioth",
  "zeta uma": "mizar",
  "eta uma": "alkaid",
  benetnasch: "alkaid",
  "alpha tau": "aldebaran",
  "alpha leo": "regulus",
  "beta leo": "denebola",
  "alpha boo": "arcturus",
  "alpha aur": "capella",
  "alpha sco": "antares",
  "alpha gem": "castor",
  "beta gem": "pollux",
  navi: "gamma cas",
  elnath: "elnath",
  "el nath": "elnath",
  "beta tau": "elnath",
  "alpha and": "alpheratz",
  sirrah: "alpheratz",
  "delta cru": "delta crucis",
  "alpha cru": "acrux",
  "beta cru": "mimosa",
  "gamma cru": "gacrux",
  "lambda ori": "meissa",
  "lambda orionis": "meissa",
  "theta leo": "chertan",
  "gamma tau": "hyadum",
  "hyadum i": "hyadum",
  "prima hyadum": "hyadum",
  "epsilon gem": "mebsuta",
  "epsilon geminorum": "mebsuta",
  "eta cma": "aludra",
  "eta canis majoris": "aludra",
  "beta sco": "acrab",
  graffias: "acrab",
  "upsilon sco": "lesath",
  "epsilon peg": "enif",
  "iota aur": "hassaleh",
  "theta aur": "mahasim",
  "beta boo": "nekkar",
  "beta bootis": "nekkar",
  "gamma sgr": "alnasl",
  "gamma sagittarii": "alnasl",
  "beta lyr": "sheliak",
  "beta lyrae": "sheliak",
  "gamma lyr": "sulafat",
  "gamma lyrae": "sulafat",
  "zeta lyrae": "zeta lyr",
  "delta lyrae": "delta lyr",
};

export function normalizeStarName(name: string): string {
  let n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (STAR_ALIASES[n]) n = STAR_ALIASES[n];
  return n;
}

export function findConstellationPattern(
  figureName: string
): ConstellationPattern | null {
  const key = normalizeStarName(figureName);
  for (const p of CONSTELLATION_PATTERNS) {
    if (normalizeStarName(p.name) === key) return p;
    if (p.aliases.some((a) => normalizeStarName(a) === key)) return p;
    if (key.includes(normalizeStarName(p.name))) return p;
  }
  return null;
}

const KIND_IDENTITY: Record<string, { motif: string; accent: string }> = {
  planet: { motif: "The Wanderer", accent: "#f6c945" },
  moon: { motif: "The Moon", accent: "#f4f1e8" },
  galaxy: { motif: "Island of stars", accent: "#c4b5fd" },
  meteor: { motif: "The Streak", accent: "#9af7ff" },
  satellite: { motif: "The Pass", accent: "#9aa4b2" },
  star: { motif: "Bright star", accent: "#e8f1ff" },
  other: { motif: "Sky mark", accent: "#d6e4ff" },
};

/** Motif and signature color for a named figure. Constellations each have their own. */
export function figureIdentity(
  figureName: string,
  kind?: string
): { motif: string; accent: string } {
  const pattern = findConstellationPattern(figureName);
  if (pattern) return { motif: pattern.motif, accent: pattern.accent };
  const key = (kind ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return KIND_IDENTITY[key] ?? { motif: "Sky mark", accent: "#d6e4ff" };
}

/** Compact stick-figure block for vision prompt (names + classic links). */
export function catalogPromptBlock(names: string[]): string {
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const p = findConstellationPattern(name);
    if (!p || seen.has(p.name)) continue;
    seen.add(p.name);
    const starList = [...p.stars]
      .sort((a, b) => a.mag - b.mag)
      .map((s) => `${s.name}(mag ${s.mag.toFixed(1)})`)
      .join(", ");
    const links = p.lines.map((l) => `${l.from}–${l.to}`).join(", ");
    blocks.push(
      `${p.name}: stars [${starList}]; classic lines [${links}]. Careful scan: mark EVERY listed star that is a real point in the photo, including faint ones (mag ≲ 4.5). Do not stop early.`
    );
  }
  if (blocks.length === 0) return "";
  return `STAR ALIGNMENT DATABASE (use these classic stick figures; match topology):\n${blocks.join("\n")}`;
}
