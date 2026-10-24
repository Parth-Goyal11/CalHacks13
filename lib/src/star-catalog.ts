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
    stars: [
      S("Betelgeuse", 0.72, 0.18, 0.5),
      S("Bellatrix", 0.28, 0.22, 1.6),
      S("Mintaka", 0.42, 0.48, 2.2),
      S("Alnilam", 0.5, 0.5, 1.7),
      S("Alnitak", 0.58, 0.52, 1.8),
      S("Saiph", 0.68, 0.78, 2.1),
      S("Rigel", 0.32, 0.82, 0.2),
    ],
    lines: [
      L("Betelgeuse", "Bellatrix"),
      L("Bellatrix", "Mintaka"),
      L("Mintaka", "Alnilam"),
      L("Alnilam", "Alnitak"),
      L("Alnitak", "Saiph"),
      L("Saiph", "Rigel"),
      L("Rigel", "Mintaka"),
      L("Betelgeuse", "Alnitak"),
    ],
  },
  {
    name: "Ursa Major",
    aliases: ["ursa major", "great bear", "big bear"],
    kind: "constellation",
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
    aliases: ["lyra"],
    kind: "constellation",
    stars: [
      S("Vega", 0.5, 0.2, 0.0),
      S("Sheliak", 0.35, 0.55, 3.5),
      S("Sulafat", 0.55, 0.62, 3.2),
    ],
    lines: [
      L("Vega", "Sheliak"),
      L("Sheliak", "Sulafat"),
      L("Sulafat", "Vega"),
    ],
  },
  {
    name: "Aquila",
    aliases: ["aquila", "the eagle"],
    kind: "constellation",
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
    stars: [
      S("Regulus", 0.35, 0.62, 1.4),
      S("Algieba", 0.42, 0.38, 2.0),
      S("Adhafera", 0.48, 0.28, 3.4),
      S("Rasalas", 0.55, 0.22, 3.9),
      S("Denebola", 0.88, 0.48, 2.1),
      S("Zosma", 0.72, 0.32, 2.6),
    ],
    lines: [
      L("Regulus", "Algieba"),
      L("Algieba", "Adhafera"),
      L("Adhafera", "Rasalas"),
      L("Algieba", "Zosma"),
      L("Zosma", "Denebola"),
    ],
  },
  {
    name: "Taurus",
    aliases: ["taurus", "the bull"],
    kind: "constellation",
    stars: [
      S("Aldebaran", 0.55, 0.55, 0.9),
      S("Elnath", 0.72, 0.18, 1.7),
      S("Ain", 0.42, 0.42, 3.5),
    ],
    lines: [L("Aldebaran", "Ain"), L("Ain", "Elnath")],
  },
  {
    name: "Pleiades",
    aliases: ["pleiades", "m45", "seven sisters", "subaru"],
    kind: "asterism",
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
    stars: [
      S("Castor", 0.42, 0.22, 1.6),
      S("Pollux", 0.58, 0.28, 1.2),
      S("Alhena", 0.55, 0.62, 1.9),
      S("Wasat", 0.48, 0.48, 3.5),
    ],
    lines: [
      L("Castor", "Pollux"),
      L("Castor", "Wasat"),
      L("Pollux", "Alhena"),
      L("Wasat", "Alhena"),
    ],
  },
  {
    name: "Canis Major",
    aliases: ["canis major", "great dog"],
    kind: "constellation",
    stars: [
      S("Sirius", 0.45, 0.35, -1.5),
      S("Mirzam", 0.22, 0.42, 2.0),
      S("Wezen", 0.62, 0.58, 1.8),
      S("Adhara", 0.48, 0.72, 1.5),
    ],
    lines: [
      L("Mirzam", "Sirius"),
      L("Sirius", "Wezen"),
      L("Wezen", "Adhara"),
      L("Adhara", "Sirius"),
    ],
  },
  {
    name: "Scorpius",
    aliases: ["scorpius", "scorpio", "the scorpion"],
    kind: "constellation",
    stars: [
      S("Antares", 0.4, 0.35, 1.1),
      S("Dschubba", 0.28, 0.22, 2.3),
      S("Shaula", 0.72, 0.78, 1.6),
      S("Sargas", 0.62, 0.68, 1.9),
    ],
    lines: [
      L("Dschubba", "Antares"),
      L("Antares", "Sargas"),
      L("Sargas", "Shaula"),
    ],
  },
  {
    name: "Pegasus",
    aliases: ["pegasus", "great square", "square of pegasus"],
    kind: "constellation",
    stars: [
      S("Markab", 0.35, 0.62, 2.5),
      S("Scheat", 0.35, 0.28, 2.4),
      S("Algenib", 0.72, 0.65, 2.8),
      S("Alpheratz", 0.72, 0.3, 2.1),
    ],
    lines: [
      L("Markab", "Scheat"),
      L("Scheat", "Alpheratz"),
      L("Alpheratz", "Algenib"),
      L("Algenib", "Markab"),
    ],
  },
  {
    name: "Andromeda",
    aliases: ["andromeda"],
    kind: "constellation",
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
    stars: [
      S("Capella", 0.45, 0.28, 0.1),
      S("Menkalinan", 0.62, 0.42, 1.9),
      S("Elnath", 0.55, 0.72, 1.7),
    ],
    lines: [
      L("Capella", "Menkalinan"),
      L("Menkalinan", "Elnath"),
      L("Elnath", "Capella"),
    ],
  },
  {
    name: "Boötes",
    aliases: ["bootes", "boötes", "the herdsman"],
    kind: "constellation",
    stars: [
      S("Arcturus", 0.5, 0.72, 0.2),
      S("Izar", 0.48, 0.42, 2.4),
      S("Seginus", 0.42, 0.22, 3.0),
      S("Muphrid", 0.35, 0.62, 2.7),
    ],
    lines: [
      L("Seginus", "Izar"),
      L("Izar", "Arcturus"),
      L("Arcturus", "Muphrid"),
    ],
  },
  {
    name: "Crux",
    aliases: ["crux", "southern cross"],
    kind: "constellation",
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
    aliases: ["southern cross"],
    kind: "asterism",
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
    aliases: ["sagittarius", "teapot", "the teapot"],
    kind: "constellation",
    stars: [
      S("Kaus Australis", 0.45, 0.72, 1.8),
      S("Nunki", 0.62, 0.48, 2.0),
      S("Ascella", 0.55, 0.58, 2.6),
      S("Kaus Media", 0.4, 0.55, 2.7),
      S("Kaus Borealis", 0.38, 0.38, 2.8),
    ],
    lines: [
      L("Kaus Borealis", "Kaus Media"),
      L("Kaus Media", "Kaus Australis"),
      L("Kaus Australis", "Ascella"),
      L("Ascella", "Nunki"),
      L("Nunki", "Kaus Borealis"),
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
