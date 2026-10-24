/**
 * Quick offline accuracy check for catalog match + scoring.
 * No Grok call — synthetic figures from the alignment DB.
 */
import {
  CONSTELLATION_PATTERNS,
  findConstellationPattern,
  normalizeStarName,
  scoreSkyAnalysis,
  verifyAgainstStarDatabase,
  type SkyAnalysis,
  type SkyFigure,
} from "../src/index.ts";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL  ${msg}`);
  }
}

function figureFromPattern(
  name: string,
  opts?: { jitter?: number; drop?: string[]; rename?: boolean }
): SkyFigure {
  const p = findConstellationPattern(name);
  if (!p) throw new Error(`missing pattern ${name}`);
  const jitter = opts?.jitter ?? 0;
  const drop = new Set((opts?.drop ?? []).map(normalizeStarName));
  const stars = p.stars
    .filter((s) => !drop.has(normalizeStarName(s.name)))
    .map((s, i) => ({
      id: normalizeStarName(s.name).replace(/\s+/g, "-"),
      name: opts?.rename === false ? `star-${i}` : s.name,
      x: Math.min(1, Math.max(0, s.x + (Math.random() - 0.5) * jitter)),
      y: Math.min(1, Math.max(0, s.y + (Math.random() - 0.5) * jitter)),
      brightness: Math.max(0.2, 1 - s.mag / 6),
    }));
  const ids = new Set(stars.map((s) => s.id));
  const idByName = new Map(
    stars.map((s) => [normalizeStarName(s.name), s.id] as const)
  );
  // If renamed away, map by order for lines later via catalog after verify
  const lines = p.lines
    .map((l) => {
      const from = idByName.get(normalizeStarName(l.from));
      const to = idByName.get(normalizeStarName(l.to));
      if (!from || !to || !ids.has(from) || !ids.has(to)) return null;
      return { from, to };
    })
    .filter((l): l is { from: string; to: string } => l !== null);

  return {
    id: normalizeStarName(name).replace(/\s+/g, "-"),
    name,
    kind: p.kind,
    confidence: 0.9,
    summary: `Synthetic ${name}`,
    description: "accuracy fixture",
    labelX: stars.reduce((a, s) => a + s.x, 0) / stars.length,
    labelY: stars.reduce((a, s) => a + s.y, 0) / stars.length,
    stars,
    lines,
  };
}

function analysisOf(...figures: SkyFigure[]): SkyAnalysis {
  return {
    headline: "fixture",
    overview: "offline accuracy",
    skyConditions: "clear",
    figures,
  };
}

const meta = {
  latitude: 37.87,
  longitude: -122.27,
  takenAt: "2026-10-24T06:00:00.000Z",
  locationLabel: "Berkeley",
};

console.log("\n=== 1. Catalog integrity ===");
assert(CONSTELLATION_PATTERNS.length >= 15, `patterns loaded (${CONSTELLATION_PATTERNS.length})`);
for (const p of ["Orion", "Big Dipper", "Cassiopeia", "Summer Triangle"]) {
  assert(Boolean(findConstellationPattern(p)), `find ${p}`);
}
assert(
  normalizeStarName("α Ori / Betelgeuse") === "betelgeuse" ||
    normalizeStarName("Betelgeuse").includes("betelgeuse"),
  "normalize Betelgeuse"
);
assert(normalizeStarName("alpha ori") === "betelgeuse", "alias alpha ori → betelgeuse");

console.log("\n=== 2. Perfect Orion should fully verify ===");
{
  const orion = figureFromPattern("Orion", { jitter: 0 });
  const { analysis, verification } = verifyAgainstStarDatabase(
    analysisOf(orion)
  );
  const fig = analysis.figures.find((f) => f.name === "Orion");
  assert(verification.passed, "verification passed");
  assert(Boolean(fig), "Orion figure kept");
  assert(
    (fig?.stars.length ?? 0) === orion.stars.length,
    `all Orion stars kept (${fig?.stars.length}/${orion.stars.length})`
  );
  assert(
    verification.acceptedStars.length === orion.stars.length,
    `accepted=${verification.acceptedStars.length}`
  );
  assert((fig?.lines.length ?? 0) >= 4, `classic lines restored (${fig?.lines.length})`);
}

console.log("\n=== 3. Jittered Big Dipper still verifies ===");
{
  // Fixed seed-ish jitter via small constant offsets alternating
  const p = findConstellationPattern("Big Dipper")!;
  const stars = p.stars.map((s, i) => ({
    id: `bd-${i}`,
    name: s.name,
    x: Math.min(1, Math.max(0, s.x + (i % 2 === 0 ? 0.02 : -0.015))),
    y: Math.min(1, Math.max(0, s.y + (i % 3 === 0 ? -0.02 : 0.018))),
    brightness: 0.7,
  }));
  const fig: SkyFigure = {
    id: "big-dipper",
    name: "Big Dipper",
    kind: "asterism",
    confidence: 0.85,
    summary: "jitter",
    description: "",
    labelX: 0.5,
    labelY: 0.4,
    stars,
    lines: [],
  };
  const { analysis, verification } = verifyAgainstStarDatabase(analysisOf(fig));
  const kept = analysis.figures.find((f) => f.name === "Big Dipper");
  assert(verification.passed, "jittered dipper passed");
  assert((kept?.stars.length ?? 0) >= 5, `kept ≥5 dipper stars (${kept?.stars.length})`);
  assert((kept?.lines.length ?? 0) >= 4, `dipper lines restored (${kept?.lines.length})`);
}

console.log("\n=== 4. Geometry assign recovers unnamed detections ===");
{
  const p = findConstellationPattern("Cassiopeia")!;
  // Name only 3; leave 2 unnamed but at catalog coords
  const stars = p.stars.map((s, i) => ({
    id: `cas-${i}`,
    name: i < 3 ? s.name : `blob-${i}`,
    x: s.x,
    y: s.y,
    brightness: 0.6,
  }));
  const fig: SkyFigure = {
    id: "cas",
    name: "Cassiopeia",
    kind: "constellation",
    confidence: 0.8,
    summary: "",
    description: "",
    labelX: 0.5,
    labelY: 0.4,
    stars,
    lines: [],
  };
  const { analysis, verification } = verifyAgainstStarDatabase(analysisOf(fig));
  const kept = analysis.figures.find((f) => f.name === "Cassiopeia");
  assert((kept?.stars.length ?? 0) >= 5, `assigned unnamed → ≥5 (${kept?.stars.length})`);
  const assigned = verification.acceptedStars.filter((s) =>
    s.reason.toLowerCase().includes("geometry assign")
  );
  assert(assigned.length >= 1, `geometry assign used (${assigned.length})`);
}

console.log("\n=== 5. Scrambled outlier should be rejected ===");
{
  const p = findConstellationPattern("Lyra")!;
  const stars = p.stars.map((s, i) => ({
    id: `lyr-${i}`,
    name: s.name,
    // Put Vega correctly, scramble the rest far away
    x: i === 0 ? s.x : (s.x + 0.45) % 1,
    y: i === 0 ? s.y : (s.y + 0.4) % 1,
    brightness: 0.7,
  }));
  const fig: SkyFigure = {
    id: "lyra",
    name: "Lyra",
    kind: "constellation",
    confidence: 0.7,
    summary: "",
    description: "",
    labelX: 0.5,
    labelY: 0.4,
    stars,
    lines: [],
  };
  const { verification } = verifyAgainstStarDatabase(analysisOf(fig));
  // Should keep at least the good anchor(s), not blindly accept all scrambled
  assert(
    verification.acceptedStars.length < stars.length,
    `rejected some outliers (accepted ${verification.acceptedStars.length}/${stars.length})`
  );
}

console.log("\n=== 6. Score awards per constellation ===");
{
  const { analysis, verification } = verifyAgainstStarDatabase(
    analysisOf(figureFromPattern("Orion"), figureFromPattern("Canis Major"))
  );
  const score = scoreSkyAnalysis(analysis, meta, { alignments: [] });
  assert(score.finalScore != null && score.finalScore > 0, `finalScore=${score.finalScore}`);
  assert(score.rarity != null, `rarity=${score.rarity}`);
  assert(score.award != null && score.award.points > 0, `award=${score.award?.points}`);
  assert(score.figureAwards.length >= 1, `figureAwards=${score.figureAwards.length}`);
  assert(score.figurePointsTotal > 0, `figurePointsTotal=${score.figurePointsTotal}`);
  assert(verification.acceptedStars.length >= 8, `combined stars=${verification.acceptedStars.length}`);
}

console.log("\n=== 7. Location context LST sanity (Berkeley evening) ===");
{
  const { buildSkyLocationContext } = await import("../src/sky-context.ts");
  const ctx = buildSkyLocationContext({
    latitude: 37.87,
    longitude: -122.27,
    takenAt: "2026-01-15T06:00:00.000Z", // winter morning UTC ~ evening prior PST-ish; just check non-empty
    facingDegrees: 180,
  });
  assert(ctx.localSiderealHours >= 0 && ctx.localSiderealHours < 24, `LST=${ctx.localSiderealHours.toFixed(2)}`);
  assert(ctx.visible.length > 0, `visible priors=${ctx.visible.length}`);
  assert(ctx.promptBlock.includes("LOCATION"), "prompt block present");
}

console.log(`\n——— ${passed} passed, ${failed} failed ———\n`);
process.exit(failed > 0 ? 1 : 0);
