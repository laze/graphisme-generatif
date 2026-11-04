/**
 * Parcours: traversal orders over a w x h grid (SPEC Section 5).
 *
 * A parcours maps every cell to an integer rank (0..N-1, ties allowed) and a
 * normalised position t = rank / maxRank. Symetrie folds coordinates before
 * ranking; inverse reverses both rank and t.
 */

import { type Parcours, type ParcoursType, type Symetrie, assertNever } from './types.js';

export interface Cellule {
  x: number;
  y: number;
}

export interface Classement {
  largeur: number;
  hauteur: number;
  maxRang: number;
  rang(x: number, y: number): number;
  t(x: number, y: number): number;
  /** every cell of the full grid, ordered by rank then row-major (SPEC Section 7). */
  ordre: readonly Cellule[];
}

function plier(x: number, y: number, w: number, h: number, symetrie: Symetrie): Cellule {
  switch (symetrie) {
    case 'aucune':
      return { x, y };
    case 'horizontale':
      return { x: Math.min(x, w - 1 - x), y };
    case 'verticale':
      return { x, y: Math.min(y, h - 1 - y) };
    case 'centrale':
      return { x: Math.min(x, w - 1 - x), y: Math.min(y, h - 1 - y) };
    default:
      return assertNever(symetrie, 'unknown symetrie');
  }
}

function tailleRepliee(w: number, h: number, symetrie: Symetrie): [number, number] {
  switch (symetrie) {
    case 'aucune':
      return [w, h];
    case 'horizontale':
      return [Math.ceil(w / 2), h];
    case 'verticale':
      return [w, Math.ceil(h / 2)];
    case 'centrale':
      return [Math.ceil(w / 2), Math.ceil(h / 2)];
    default:
      return assertNever(symetrie, 'unknown symetrie');
  }
}

/** Clockwise inward spiral from the top-left cell. */
function ordreSpirale(w: number, h: number): Cellule[] {
  const out: Cellule[] = [];
  let x0 = 0;
  let y0 = 0;
  let x1 = w - 1;
  let y1 = h - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push({ x, y: y0 });
    for (let y = y0 + 1; y <= y1; y++) out.push({ x: x1, y });
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push({ x, y: y1 });
    if (x1 > x0) for (let y = y1 - 1; y >= y0 + 1; y--) out.push({ x: x0, y });
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}

/**
 * Ordering key on the folded grid. Lower key = earlier. Equal keys share a rank.
 */
function cle(type: ParcoursType, w: number, h: number): (x: number, y: number) => number {
  switch (type) {
    case 'lignes':
      return (x, y) => y * w + x;
    case 'colonnes':
      return (x, y) => x * h + y;
    case 'boustrophedon':
      return (x, y) => y * w + (y % 2 === 0 ? x : w - 1 - x);
    case 'diagonale':
      return (x, y) => x + y;
    case 'rayonnement': {
      // Chebyshev distance from the grid centre, doubled to stay integral.
      const cx = w - 1;
      const cy = h - 1;
      return (x, y) => Math.max(Math.abs(2 * x - cx), Math.abs(2 * y - cy));
    }
    case 'spirale': {
      const index = new Map<number, number>();
      ordreSpirale(w, h).forEach((c, i) => index.set(c.y * w + c.x, i));
      return (x, y) => index.get(y * w + x) ?? 0;
    }
    default:
      return assertNever(type, 'unknown parcours type');
  }
}

export function classement(p: Parcours, largeur: number, hauteur: number): Classement {
  if (largeur < 1 || hauteur < 1) throw new Error('parcours grid must be at least 1x1');
  const symetrie = p.symetrie ?? 'aucune';
  const [fw, fh] = tailleRepliee(largeur, hauteur, symetrie);
  const fn = cle(p.type, fw, fh);

  // Distinct keys actually present on the folded grid, ascending.
  const presentes = new Set<number>();
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) presentes.add(fn(x, y));
  }
  const triees = [...presentes].sort((a, b) => a - b);
  const rangParCle = new Map<number, number>();
  triees.forEach((k, i) => rangParCle.set(k, i));
  const maxRang = triees.length - 1;

  const brut = (x: number, y: number): number => {
    const f = plier(x, y, largeur, hauteur, symetrie);
    return rangParCle.get(fn(f.x, f.y)) ?? 0;
  };
  const rang = p.inverse ? (x: number, y: number) => maxRang - brut(x, y) : brut;
  const t = (x: number, y: number): number => (maxRang === 0 ? 0 : rang(x, y) / maxRang);

  const cellules: Cellule[] = [];
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) cellules.push({ x, y });
  }
  // Stable sort by rank; the source order is already row-major, so ties keep it.
  const ordre = cellules
    .map((c, i) => ({ c, i, r: rang(c.x, c.y) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.c);

  return { largeur, hauteur, maxRang, rang, t, ordre };
}
