/**
 * Verify / correct constellation stick figures against the alignment catalog.
 * Fits a similarity transform (scale + rotation + translation) from catalog
 * atlas coords → image pixel coords using name-matched stars.
 */

import type { SkyAnalysis, SkyFigure, SkyStar } from "./sky-analysis";
import {
  findConstellationPattern,
  normalizeStarName,
  type ConstellationPattern,
} from "./star-catalog";

export interface FigureAlignment {
  figureId: string;
  figureName: string;
  catalogName: string | null;
  matchedStars: number;
  catalogStars: number;
  /** 0–1; null if too few matches to verify. */
  alignmentScore: number | null;
  meanResidual: number | null;
  linesCorrected: boolean;
  missingCatalogStars: string[];
  notes: string[];
}

export interface AlignResult {
  analysis: SkyAnalysis;
  alignments: FigureAlignment[];
}

function matchStar(
  star: SkyStar,
  pattern: ConstellationPattern
): { catalogName: string; cx: number; cy: number } | null {
  const key = normalizeStarName(star.name ?? star.id);
  for (const c of pattern.stars) {
    if (normalizeStarName(c.name) === key) {
      return { catalogName: c.name, cx: c.x, cy: c.y };
    }
  }
  // Partial: "Betelgeuse (α Ori)" etc.
  for (const c of pattern.stars) {
    const cn = normalizeStarName(c.name);
    if (key.includes(cn) || cn.includes(key)) {
      return { catalogName: c.name, cx: c.x, cy: c.y };
    }
  }
  return null;
}

/**
 * Similarity fit: image ≈ s * R(catalog) + t
 * Using Kabsch-style 2D closed form on matched pairs.
 */
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

  // 2D similarity from covariance (Umeyama-style)
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
  // Score: residual 0 → 1, residual 0.12 → ~0
  const score = Math.max(0, Math.min(1, 1 - residual / 0.12));

  return { score, residual, apply };
}

function alignOne(figure: SkyFigure): {
  figure: SkyFigure;
  alignment: FigureAlignment;
} {
  const pattern = findConstellationPattern(figure.name);
  const notes: string[] = [];

  if (!pattern) {
    return {
      figure,
      alignment: {
        figureId: figure.id,
        figureName: figure.name,
        catalogName: null,
        matchedStars: 0,
        catalogStars: 0,
        alignmentScore: null,
        meanResidual: null,
        linesCorrected: false,
        missingCatalogStars: [],
        notes: ["No catalog pattern for this figure — lines left as model output."],
      },
    };
  }

  const pairs: {
    cx: number;
    cy: number;
    ix: number;
    iy: number;
    starId: string;
    catalogName: string;
  }[] = [];
  const idByCatalog = new Map<string, string>();

  const stars: SkyStar[] = figure.stars.map((star) => {
    const m = matchStar(star, pattern);
    if (m) {
      pairs.push({
        cx: m.cx,
        cy: m.cy,
        ix: star.x,
        iy: star.y,
        starId: star.id,
        catalogName: m.catalogName,
      });
      idByCatalog.set(normalizeStarName(m.catalogName), star.id);
      return { ...star, name: m.catalogName };
    }
    return star;
  });

  const matchedNames = new Set(pairs.map((p) => normalizeStarName(p.catalogName)));
  const missingCatalogStars = pattern.stars
    .filter((s) => !matchedNames.has(normalizeStarName(s.name)))
    .map((s) => s.name);

  const fit = fitSimilarity(pairs);
  let linesCorrected = false;
  let lines = figure.lines;
  let alignmentScore: number | null = null;
  let meanResidual: number | null = null;

  if (fit && pairs.length >= 2) {
    alignmentScore = fit.score;
    meanResidual = fit.residual;
    if (fit.score >= 0.45) {
      // Rebuild classic lines using matched star ids only.
      const catalogLines = pattern.lines
        .map((l) => {
          const from = idByCatalog.get(normalizeStarName(l.from));
          const to = idByCatalog.get(normalizeStarName(l.to));
          if (!from || !to) return null;
          return { from, to };
        })
        .filter((l): l is { from: string; to: string } => l !== null);
      if (catalogLines.length > 0) {
        lines = catalogLines;
        linesCorrected = true;
        notes.push(
          `Aligned to ${pattern.name} catalog (${pairs.length}/${pattern.stars.length} stars, residual ${(fit.residual * 100).toFixed(1)}%).`
        );
      }
    } else {
      notes.push(
        `Weak geometry vs ${pattern.name} catalog (residual ${(fit.residual * 100).toFixed(1)}%) — kept model lines.`
      );
    }
  } else {
    notes.push(
      `Only ${pairs.length} catalog name match(es) for ${pattern.name} — need ≥2 to verify alignment.`
    );
  }

  if (missingCatalogStars.length > 0) {
    notes.push(
      `Catalog stars not marked: ${missingCatalogStars.slice(0, 6).join(", ")}${
        missingCatalogStars.length > 6 ? "…" : ""
      }.`
    );
  }

  const labelX = stars.reduce((a, s) => a + s.x, 0) / Math.max(stars.length, 1);
  const labelY = stars.reduce((a, s) => a + s.y, 0) / Math.max(stars.length, 1);

  return {
    figure: {
      ...figure,
      name: pattern.name,
      kind: pattern.kind,
      stars,
      lines,
      labelX,
      labelY,
    },
    alignment: {
      figureId: figure.id,
      figureName: pattern.name,
      catalogName: pattern.name,
      matchedStars: pairs.length,
      catalogStars: pattern.stars.length,
      alignmentScore,
      meanResidual,
      linesCorrected,
      missingCatalogStars,
      notes,
    },
  };
}

/** Run catalog alignment on every figure; correct lines when geometry fits. */
export function alignAnalysisToCatalog(analysis: SkyAnalysis): AlignResult {
  const figures: SkyFigure[] = [];
  const alignments: FigureAlignment[] = [];

  for (const fig of analysis.figures) {
    if (fig.id === "none-confident") {
      figures.push(fig);
      continue;
    }
    const { figure, alignment } = alignOne(fig);
    figures.push(figure);
    alignments.push(alignment);
  }

  return {
    analysis: {
      ...analysis,
      figures,
    },
    alignments,
  };
}
