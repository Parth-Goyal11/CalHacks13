/**
 * Logical matching test against the stick-figure star configuration database.
 * Runs AFTER Grok proposes figures and BEFORE score / UI generation.
 * Only stars that fit catalog geometry (or are lone objects without a pattern)
 * are kept on the analysis.
 */

import type { FigureAlignment } from "./align-figures";
import type { SkyAnalysis, SkyFigure, SkyStar } from "./sky-analysis";
import {
  findConstellationPattern,
  normalizeStarName,
  type ConstellationPattern,
} from "./star-catalog";

/** Max normalized image distance from catalog-predicted location. */
const MAX_STAR_RESIDUAL = 0.085;
/** Minimum similarity score for a constellation figure to pass. */
const MIN_FIGURE_FIT = 0.5;
/** Need at least this many catalog-matched stars for a pattern figure. */
const MIN_MATCHED_FOR_PATTERN = 3;

export interface StarVerdict {
  figureId: string;
  figureName: string;
  starId: string;
  starName: string;
  x: number;
  y: number;
  brightness: number;
  accepted: boolean;
  reason: string;
  residual: number | null;
  catalogName: string | null;
}

export interface FigureVerdict {
  figureId: string;
  figureName: string;
  kind: string;
  accepted: boolean;
  reason: string;
  alignmentScore: number | null;
}

export interface VerificationReport {
  /** True when at least one star / figure survived. */
  passed: boolean;
  acceptedStars: StarVerdict[];
  rejectedStars: StarVerdict[];
  figureVerdicts: FigureVerdict[];
  summary: string;
}

export interface VerifyResult {
  analysis: SkyAnalysis;
  verification: VerificationReport;
}

function matchCatalogStar(
  star: SkyStar,
  pattern: ConstellationPattern
): { catalogName: string; cx: number; cy: number } | null {
  const key = normalizeStarName(star.name ?? star.id);
  for (const c of pattern.stars) {
    const cn = normalizeStarName(c.name);
    if (cn === key || key.includes(cn) || cn.includes(key)) {
      return { catalogName: c.name, cx: c.x, cy: c.y };
    }
  }
  return null;
}

function fitSimilarity(
  pairs: { cx: number; cy: number; ix: number; iy: number }[]
): {
  score: number;
  residual: number;
  apply: (cx: number, cy: number) => { x: number; y: number };
} | null {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const meanC = {
    x: pairs.reduce((a, p) => a + p.cx, 0) / n,
    y: pairs.reduce((a, p) => a + p.cy, 0) / n,
  };
  const meanI = {
    x: pairs.reduce((a, p) => a + p.ix, 0) / n,
    y: pairs.reduce((a, p) => a + p.iy, 0) / n,
  };

  let sxx = 0;
  let sxy = 0;
  let syx = 0;
  let syy = 0;
  let cVar = 0;
  for (const p of pairs) {
    const cx = p.cx - meanC.x;
    const cy = p.cy - meanC.y;
    const ix = p.ix - meanI.x;
    const iy = p.iy - meanI.y;
    sxx += cx * ix;
    sxy += cx * iy;
    syx += cy * ix;
    syy += cy * iy;
    cVar += cx * cx + cy * cy;
  }
  if (cVar < 1e-12) return null;

  const a = sxx + syy;
  const b = sxy - syx;
  const rNorm = Math.hypot(a, b) || 1e-12;
  const cos = a / rNorm;
  const sin = b / rNorm;
  const s = (sxx * cos + sxy * sin + syx * -sin + syy * cos) / cVar;

  const apply = (cx: number, cy: number) => {
    const dx = cx - meanC.x;
    const dy = cy - meanC.y;
    return {
      x: meanI.x + s * (cos * dx - sin * dy),
      y: meanI.y + s * (sin * dx + cos * dy),
    };
  };

  let err = 0;
  for (const p of pairs) {
    const pred = apply(p.cx, p.cy);
    err += Math.hypot(pred.x - p.ix, pred.y - p.iy);
  }
  const residual = err / n;
  const score = Math.max(0, Math.min(1, 1 - residual / 0.12));
  return { score, residual, apply };
}

function verifyPatternFigure(figure: SkyFigure): {
  figure: SkyFigure | null;
  accepted: StarVerdict[];
  rejected: StarVerdict[];
  figureVerdict: FigureVerdict;
} {
  const pattern = findConstellationPattern(figure.name);
  if (!pattern) {
    const rejected = figure.stars.map((s) => ({
      figureId: figure.id,
      figureName: figure.name,
      starId: s.id,
      starName: s.name ?? s.id,
      x: s.x,
      y: s.y,
      brightness: s.brightness ?? 0.65,
      accepted: false,
      reason: `No star-configuration entry for “${figure.name}” — rejected until catalog match.`,
      residual: null,
      catalogName: null,
    }));
    return {
      figure: null,
      accepted: [],
      rejected,
      figureVerdict: {
        figureId: figure.id,
        figureName: figure.name,
        kind: figure.kind,
        accepted: false,
        reason: "No constellation configuration in the alignment database.",
        alignmentScore: null,
      },
    };
  }

  type Pair = {
    star: SkyStar;
    catalogName: string;
    cx: number;
    cy: number;
  };
  const named: Pair[] = [];
  const unnamedRejected: StarVerdict[] = [];

  for (const star of figure.stars) {
    const m = matchCatalogStar(star, pattern);
    if (!m) {
      unnamedRejected.push({
        figureId: figure.id,
        figureName: pattern.name,
        starId: star.id,
        starName: star.name ?? star.id,
        x: star.x,
        y: star.y,
        brightness: star.brightness ?? 0.65,
        accepted: false,
        reason: `Name “${star.name ?? star.id}” not in ${pattern.name} configuration database.`,
        residual: null,
        catalogName: null,
      });
      continue;
    }
    named.push({
      star: { ...star, name: m.catalogName },
      catalogName: m.catalogName,
      cx: m.cx,
      cy: m.cy,
    });
  }

  if (named.length < MIN_MATCHED_FOR_PATTERN) {
    const rejected = [
      ...unnamedRejected,
      ...named.map((p) => ({
        figureId: figure.id,
        figureName: pattern.name,
        starId: p.star.id,
        starName: p.catalogName,
        x: p.star.x,
        y: p.star.y,
        brightness: p.star.brightness ?? 0.65,
        accepted: false,
        reason: `Only ${named.length} catalog name matches — need ≥${MIN_MATCHED_FOR_PATTERN} for ${pattern.name}.`,
        residual: null,
        catalogName: p.catalogName,
      })),
    ];
    return {
      figure: null,
      accepted: [],
      rejected,
      figureVerdict: {
        figureId: figure.id,
        figureName: pattern.name,
        kind: pattern.kind,
        accepted: false,
        reason: `Failed match test: ${named.length}/${pattern.stars.length} named — need ≥${MIN_MATCHED_FOR_PATTERN}.`,
        alignmentScore: null,
      },
    };
  }

  const fit = fitSimilarity(
    named.map((p) => ({
      cx: p.cx,
      cy: p.cy,
      ix: p.star.x,
      iy: p.star.y,
    }))
  );

  if (!fit || fit.score < MIN_FIGURE_FIT) {
    const rejected = [
      ...unnamedRejected,
      ...named.map((p) => ({
        figureId: figure.id,
        figureName: pattern.name,
        starId: p.star.id,
        starName: p.catalogName,
        x: p.star.x,
        y: p.star.y,
        brightness: p.star.brightness ?? 0.65,
        accepted: false,
        reason: `Configuration geometry failed for ${pattern.name} (fit ${fit ? (fit.score * 100).toFixed(0) : 0}%).`,
        residual: fit?.residual ?? null,
        catalogName: p.catalogName,
      })),
    ];
    return {
      figure: null,
      accepted: [],
      rejected,
      figureVerdict: {
        figureId: figure.id,
        figureName: pattern.name,
        kind: pattern.kind,
        accepted: false,
        reason: `Stick-figure geometry does not match ${pattern.name} database (fit ${Math.round((fit?.score ?? 0) * 100)}%).`,
        alignmentScore: fit?.score ?? null,
      },
    };
  }

  const accepted: StarVerdict[] = [];
  const rejected: StarVerdict[] = [...unnamedRejected];
  const keptStars: SkyStar[] = [];
  const idByCatalog = new Map<string, string>();

  for (const p of named) {
    const pred = fit.apply(p.cx, p.cy);
    const residual = Math.hypot(pred.x - p.star.x, pred.y - p.star.y);
    if (residual > MAX_STAR_RESIDUAL) {
      rejected.push({
        figureId: figure.id,
        figureName: pattern.name,
        starId: p.star.id,
        starName: p.catalogName,
        x: p.star.x,
        y: p.star.y,
        brightness: p.star.brightness ?? 0.65,
        accepted: false,
        reason: `Location off catalog prediction for ${p.catalogName} (Δ ${(residual * 100).toFixed(1)}%).`,
        residual,
        catalogName: p.catalogName,
      });
      continue;
    }
    keptStars.push(p.star);
    idByCatalog.set(normalizeStarName(p.catalogName), p.star.id);
    accepted.push({
      figureId: figure.id,
      figureName: pattern.name,
      starId: p.star.id,
      starName: p.catalogName,
      x: p.star.x,
      y: p.star.y,
      brightness: p.star.brightness ?? 0.65,
      accepted: true,
      reason: `Catalog match · ${pattern.name} · Δ ${(residual * 100).toFixed(1)}%`,
      residual,
      catalogName: p.catalogName,
    });
  }

  if (keptStars.length < MIN_MATCHED_FOR_PATTERN) {
    for (const a of accepted) {
      rejected.push({
        ...a,
        accepted: false,
        reason: `Dropped: fewer than ${MIN_MATCHED_FOR_PATTERN} stars survived location test for ${pattern.name}.`,
      });
    }
    return {
      figure: null,
      accepted: [],
      rejected,
      figureVerdict: {
        figureId: figure.id,
        figureName: pattern.name,
        kind: pattern.kind,
        accepted: false,
        reason: `Location test left ${keptStars.length} stars — need ≥${MIN_MATCHED_FOR_PATTERN}.`,
        alignmentScore: fit.score,
      },
    };
  }

  const lines = pattern.lines
    .map((l) => {
      const from = idByCatalog.get(normalizeStarName(l.from));
      const to = idByCatalog.get(normalizeStarName(l.to));
      if (!from || !to) return null;
      return { from, to };
    })
    .filter((l): l is { from: string; to: string } => l !== null);

  const labelX =
    keptStars.reduce((a, s) => a + s.x, 0) / Math.max(keptStars.length, 1);
  const labelY =
    keptStars.reduce((a, s) => a + s.y, 0) / Math.max(keptStars.length, 1);

  return {
    figure: {
      ...figure,
      name: pattern.name,
      kind: pattern.kind,
      stars: keptStars,
      lines,
      labelX,
      labelY,
      confidence: Math.min(figure.confidence, 0.55 + fit.score * 0.4),
    },
    accepted,
    rejected,
    figureVerdict: {
      figureId: figure.id,
      figureName: pattern.name,
      kind: pattern.kind,
      accepted: true,
      reason: `Passed ${pattern.name} configuration test (${keptStars.length} stars, fit ${(fit.score * 100).toFixed(0)}%).`,
      alignmentScore: fit.score,
    },
  };
}

function verifyLoneFigure(figure: SkyFigure): {
  figure: SkyFigure | null;
  accepted: StarVerdict[];
  rejected: StarVerdict[];
  figureVerdict: FigureVerdict;
} {
  // Planets / moons / lone stars: accept finite in-frame points; no stick-figure DB.
  const accepted: StarVerdict[] = [];
  const rejected: StarVerdict[] = [];
  const kept: SkyStar[] = [];

  for (const s of figure.stars) {
    const ok =
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      s.x >= 0 &&
      s.x <= 1 &&
      s.y >= 0 &&
      s.y <= 1;
    const verdict: StarVerdict = {
      figureId: figure.id,
      figureName: figure.name,
      starId: s.id,
      starName: s.name ?? s.id,
      x: s.x,
      y: s.y,
      brightness: s.brightness ?? 0.65,
      accepted: ok,
      reason: ok
        ? `Accepted ${figure.kind} point (no stick-figure config required).`
        : "Coordinates out of frame — rejected.",
      residual: null,
      catalogName: null,
    };
    if (ok) {
      accepted.push(verdict);
      kept.push(s);
    } else {
      rejected.push(verdict);
    }
  }

  if (kept.length === 0) {
    return {
      figure: null,
      accepted: [],
      rejected,
      figureVerdict: {
        figureId: figure.id,
        figureName: figure.name,
        kind: figure.kind,
        accepted: false,
        reason: "No in-frame points.",
        alignmentScore: null,
      },
    };
  }

  return {
    figure: { ...figure, stars: kept, lines: [] },
    accepted,
    rejected,
    figureVerdict: {
      figureId: figure.id,
      figureName: figure.name,
      kind: figure.kind,
      accepted: true,
      reason: `Accepted as ${figure.kind} (location in frame).`,
      alignmentScore: null,
    },
  };
}

/**
 * Run the configuration matching test and rebuild analysis with only
 * stars/figures that pass. Call this before score / UI generation.
 */
export function verifyAgainstStarDatabase(
  analysis: SkyAnalysis,
  _alignments?: FigureAlignment[]
): VerifyResult {
  const figures: SkyFigure[] = [];
  const acceptedStars: StarVerdict[] = [];
  const rejectedStars: StarVerdict[] = [];
  const figureVerdicts: FigureVerdict[] = [];

  for (const fig of analysis.figures) {
    if (fig.id === "none-confident") continue;

    const isPattern =
      fig.kind === "constellation" ||
      fig.kind === "asterism" ||
      Boolean(findConstellationPattern(fig.name));

    const result = isPattern
      ? verifyPatternFigure(fig)
      : verifyLoneFigure(fig);

    acceptedStars.push(...result.accepted);
    rejectedStars.push(...result.rejected);
    figureVerdicts.push(result.figureVerdict);
    if (result.figure) figures.push(result.figure);
  }

  // Stable reveal order: brighter first within each accepted figure order.
  acceptedStars.sort((a, b) => {
    if (a.figureId !== b.figureId) return 0;
    return b.brightness - a.brightness;
  });

  if (figures.length === 0) {
    figures.push({
      id: "none-confident",
      name: "Nothing verified",
      kind: "other",
      confidence: 0.3,
      summary:
        "Grok proposals did not pass the star-configuration matching test.",
      description:
        rejectedStars.length > 0
          ? `Rejected ${rejectedStars.length} proposed point(s). Re-shoot or check location/time.`
          : "No figures to verify.",
      labelX: 0.5,
      labelY: 0.12,
      stars: [],
      lines: [],
    });
  }

  const passed = acceptedStars.length > 0;
  const summary = passed
    ? `Match test: ${acceptedStars.length} star(s) verified, ${rejectedStars.length} rejected, ${figureVerdicts.filter((f) => f.accepted).length} figure(s) kept.`
    : `Match test failed: 0 stars verified (${rejectedStars.length} rejected).`;

  return {
    analysis: {
      ...analysis,
      figures,
      overview: `${analysis.overview}\n\n${summary}`,
    },
    verification: {
      passed,
      acceptedStars,
      rejectedStars,
      figureVerdicts,
      summary,
    },
  };
}
