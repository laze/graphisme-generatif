import { describe, expect, it } from 'vitest';
import { classement } from '../src/core/parcours.js';
import { PARCOURS_TYPES, type ParcoursType, SYMETRIES } from '../src/core/types.js';

function table(type: ParcoursType, w: number, h: number, opts = {}): number[][] {
  const c = classement({ type, ...opts }, w, h);
  const out: number[][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[] = [];
    for (let x = 0; x < w; x++) row.push(c.rang(x, y));
    out.push(row);
  }
  return out;
}

describe('parcours rank tables', () => {
  it('1x1 is rank 0 and t 0 for every type', () => {
    for (const type of PARCOURS_TYPES) {
      const c = classement({ type }, 1, 1);
      expect(c.maxRang).toBe(0);
      expect(c.rang(0, 0)).toBe(0);
      expect(c.t(0, 0)).toBe(0);
    }
  });

  it('lignes on 3x3', () => {
    expect(table('lignes', 3, 3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ]);
  });

  it('colonnes on 3x3', () => {
    expect(table('colonnes', 3, 3)).toEqual([
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
    ]);
  });

  it('boustrophedon on 3x3 alternates row direction', () => {
    expect(table('boustrophedon', 3, 3)).toEqual([
      [0, 1, 2],
      [5, 4, 3],
      [6, 7, 8],
    ]);
  });

  it('diagonale on 3x3 shares ranks on anti-diagonals', () => {
    expect(table('diagonale', 3, 3)).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
    ]);
  });

  it('rayonnement on 3x3 is concentric', () => {
    expect(table('rayonnement', 3, 3)).toEqual([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
  });

  it('spirale on 3x3 turns clockwise inward from the top-left', () => {
    expect(table('spirale', 3, 3)).toEqual([
      [0, 1, 2],
      [7, 8, 3],
      [6, 5, 4],
    ]);
  });

  it('lignes on 4x5', () => {
    expect(table('lignes', 4, 5)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9, 10, 11],
      [12, 13, 14, 15],
      [16, 17, 18, 19],
    ]);
  });

  it('rayonnement on 4x5 uses Chebyshev distance from the centre', () => {
    // centre (1.5, 2); the two middle columns of the middle row are closest
    expect(table('rayonnement', 4, 5)).toEqual([
      [3, 3, 3, 3],
      [2, 1, 1, 2],
      [2, 0, 0, 2],
      [2, 1, 1, 2],
      [3, 3, 3, 3],
    ]);
  });

  it('spirale on 4x5 visits every cell exactly once', () => {
    const t = table('spirale', 4, 5).flat();
    expect([...t].sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
  });

  it('diagonale on 4x5', () => {
    expect(table('diagonale', 4, 5)).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 5],
      [3, 4, 5, 6],
      [4, 5, 6, 7],
    ]);
  });
});

describe('inverse', () => {
  it('mirrors rank and t', () => {
    const a = classement({ type: 'lignes' }, 3, 3);
    const b = classement({ type: 'lignes', inverse: true }, 3, 3);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(b.rang(x, y)).toBe(a.maxRang - a.rang(x, y));
        expect(b.t(x, y)).toBeCloseTo(1 - a.t(x, y), 12);
      }
    }
  });

  it('inverse of rayonnement puts the centre last', () => {
    const c = classement({ type: 'rayonnement', inverse: true }, 3, 3);
    expect(c.rang(1, 1)).toBe(1);
    expect(c.rang(0, 0)).toBe(0);
  });
});

describe('symetrie', () => {
  it('horizontale folds x around the vertical centre line', () => {
    expect(table('lignes', 4, 2, { symetrie: 'horizontale' })).toEqual([
      [0, 1, 1, 0],
      [2, 3, 3, 2],
    ]);
  });

  it('verticale folds y', () => {
    expect(table('lignes', 2, 4, { symetrie: 'verticale' })).toEqual([
      [0, 1],
      [2, 3],
      [2, 3],
      [0, 1],
    ]);
  });

  it('centrale folds both axes', () => {
    expect(table('lignes', 4, 4, { symetrie: 'centrale' })).toEqual([
      [0, 1, 1, 0],
      [2, 3, 3, 2],
      [2, 3, 3, 2],
      [0, 1, 1, 0],
    ]);
  });

  it('odd sizes keep the middle row/column', () => {
    expect(table('lignes', 5, 1, { symetrie: 'horizontale' })).toEqual([[0, 1, 2, 1, 0]]);
  });

  it('t stays in [0,1] for every type, size and symetrie', () => {
    for (const type of PARCOURS_TYPES) {
      for (const symetrie of SYMETRIES) {
        for (const [w, h] of [
          [1, 1],
          [3, 3],
          [4, 5],
        ] as const) {
          const c = classement({ type, symetrie }, w, h);
          for (const cell of c.ordre) {
            const t = c.t(cell.x, cell.y);
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('ordre', () => {
  it('covers the grid once, sorted by rank then row-major', () => {
    const c = classement({ type: 'diagonale' }, 4, 5);
    expect(c.ordre).toHaveLength(20);
    const vus = new Set(c.ordre.map((o) => `${o.x},${o.y}`));
    expect(vus.size).toBe(20);
    for (let i = 1; i < c.ordre.length; i++) {
      const a = c.ordre[i - 1]!;
      const b = c.ordre[i]!;
      const ra = c.rang(a.x, a.y);
      const rb = c.rang(b.x, b.y);
      expect(ra).toBeLessThanOrEqual(rb);
      if (ra === rb) expect(a.y * 4 + a.x).toBeLessThan(b.y * 4 + b.x);
    }
  });
});
