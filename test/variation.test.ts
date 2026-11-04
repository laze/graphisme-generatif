import { describe, expect, it } from 'vitest';
import { classement } from '../src/core/parcours.js';
import { stream } from '../src/core/prng.js';
import { PLAGES, type Variation } from '../src/core/types.js';
import {
  arrondiEntier,
  contexte,
  finaliser,
  nbTirages,
  offsetNumerique,
  onde,
  selectionne,
  tirages,
  valeurCategorique,
} from '../src/core/variation.js';

const CTX = { rang: 0, t: 0, tirages: [] as number[] };
const ctx = (rang: number, t: number, tir: number[] = []) => ({ rang, t, tirages: tir });

describe('onde', () => {
  it('rampe climbs from 0 to 1 and reaches 1 at t = 1', () => {
    expect(onde('rampe', 0, 1)).toBe(0);
    expect(onde('rampe', 0.5, 1)).toBeCloseTo(0.5);
    expect(onde('rampe', 1, 1)).toBe(1);
  });

  it('triangle peaks at the middle', () => {
    expect(onde('triangle', 0, 1)).toBe(0);
    expect(onde('triangle', 0.5, 1)).toBeCloseTo(1);
    expect(onde('triangle', 1, 1)).toBeCloseTo(0);
  });

  it('sinus is smooth and bounded', () => {
    for (let i = 0; i <= 20; i++) {
      const v = onde('sinus', i / 20, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(onde('sinus', 0.5, 1)).toBeCloseTo(1);
  });

  it('periode repeats the cycle', () => {
    expect(onde('triangle', 0.25, 2)).toBeCloseTo(onde('triangle', 0.75, 2));
  });
});

describe('arrondiEntier', () => {
  it('rounds half away from zero', () => {
    expect(arrondiEntier(0.5)).toBe(1);
    expect(arrondiEntier(-0.5)).toBe(-1);
    expect(arrondiEntier(1.5)).toBe(2);
    expect(arrondiEntier(-1.5)).toBe(-2);
    expect(arrondiEntier(2.4)).toBe(2);
  });
});

describe('finaliser', () => {
  it('clamps numeric axes into range', () => {
    expect(finaliser(99, PLAGES.nuance)).toBe(13);
    expect(finaliser(-5, PLAGES.nuance)).toBe(1);
    expect(finaliser(0, PLAGES.aspect)).toBe(0.2);
    expect(finaliser(5, PLAGES.cisaillement)).toBe(0.5);
    expect(finaliser(-5, PLAGES.cisaillement)).toBe(-0.5);
  });

  it('wraps rotation instead of clamping', () => {
    expect(finaliser(370, PLAGES.rotation)).toBe(10);
    expect(finaliser(-10, PLAGES.rotation)).toBe(350);
    expect(finaliser(720, PLAGES.rotation)).toBe(0);
  });

  it('rounds integer axes and keeps 4 decimals on float axes', () => {
    expect(finaliser(12.5, PLAGES.grandeur)).toBe(13);
    expect(finaliser(0.123456, PLAGES.cisaillement)).toBe(0.1235);
  });
});

describe('numeric axes', () => {
  it('constant adds nothing', () => {
    const v: Variation<number> = { mode: 'constant', amplitude: 1 };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(3, 0.7))).toBe(0);
  });

  it('progression scales with amplitude, span and the wave', () => {
    const v: Variation<number> = { mode: 'progression', amplitude: 0.5 };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 0))).toBe(0);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 1))).toBeCloseTo(0.5 * 12);
  });

  it('progression honours sens', () => {
    const v: Variation<number> = { mode: 'progression', amplitude: 0.5, sens: -1 };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 1))).toBeCloseTo(-6);
  });

  it('progression reaches 45 degrees on rotation at amplitude 0.125', () => {
    const v: Variation<number> = { mode: 'progression', amplitude: 0.125 };
    expect(offsetNumerique(v, PLAGES.rotation, ctx(0, 1))).toBeCloseTo(45);
  });

  it('permutation cycles the ensemble by rank, only on selected cells', () => {
    const v: Variation<number> = {
      mode: 'permutation',
      amplitude: 1,
      ensemble: [0, 2, -2],
      pas: 1,
    };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 0, [0]))).toBe(0);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(1, 0, [0]))).toBe(2);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(2, 0, [0]))).toBe(-2);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(3, 0, [0]))).toBe(0);
    // outside the drawn share
    const partiel: Variation<number> = { ...v, amplitude: 0.5 };
    expect(offsetNumerique(partiel, PLAGES.nuance, ctx(1, 0, [0.9]))).toBe(0);
  });

  it('permutation pas skips through the ensemble', () => {
    const v: Variation<number> = { mode: 'permutation', amplitude: 1, ensemble: [0, 1, 2], pas: 2 };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(1, 0, [0]))).toBe(2);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(2, 0, [0]))).toBe(1);
  });

  it('aleatoire spans +/- amplitude * span', () => {
    const v: Variation<number> = { mode: 'aleatoire', amplitude: 0.5 };
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 0, [0]))).toBeCloseTo(-6);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 0, [0.5]))).toBeCloseTo(0);
    expect(offsetNumerique(v, PLAGES.nuance, ctx(0, 0, [1]))).toBeCloseTo(6);
  });
});

describe('categorical axes', () => {
  const ens = ['c', 'o', 'l', 't'];

  it('constant keeps the base', () => {
    expect(valeurCategorique({ mode: 'constant', amplitude: 1 }, 'c', CTX)).toBe('c');
  });

  it('progression moves in ordered blocks only at amplitude >= 0.5', () => {
    const v: Variation<string> = { mode: 'progression', amplitude: 0.5, ensemble: ens };
    expect(valeurCategorique(v, 'c', ctx(0, 0))).toBe('c');
    expect(valeurCategorique(v, 'c', ctx(0, 0.3))).toBe('o');
    expect(valeurCategorique(v, 'c', ctx(0, 1))).toBe('t');
    const faible: Variation<string> = { ...v, amplitude: 0.4 };
    expect(valeurCategorique(faible, 'c', ctx(0, 1))).toBe('c');
  });

  it('permutation steps from the base index by rank', () => {
    const v: Variation<string> = { mode: 'permutation', amplitude: 1, ensemble: ens };
    expect(valeurCategorique(v, 'o', ctx(0, 0, [0]))).toBe('o');
    expect(valeurCategorique(v, 'o', ctx(1, 0, [0]))).toBe('l');
    expect(valeurCategorique(v, 'o', ctx(3, 0, [0]))).toBe('c');
    const partiel: Variation<string> = { ...v, amplitude: 0.5 };
    expect(valeurCategorique(partiel, 'o', ctx(1, 0, [0.9]))).toBe('o');
  });

  it('permutation warns when the start value is outside the ensemble', () => {
    const msgs: string[] = [];
    const v: Variation<string> = { mode: 'permutation', amplitude: 1, ensemble: ens };
    expect(valeurCategorique(v, 'r', ctx(1, 0, [0]), (m) => msgs.push(m))).toBe('o');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('not a member of ensemble');
  });

  it('aleatoire picks from the ensemble on the selected share', () => {
    const v: Variation<string> = { mode: 'aleatoire', amplitude: 0.5, ensemble: ens };
    expect(valeurCategorique(v, 'c', ctx(0, 0, [0.1, 0]))).toBe('c');
    expect(valeurCategorique(v, 'c', ctx(0, 0, [0.1, 0.99]))).toBe('t');
    expect(valeurCategorique(v, 'c', ctx(0, 0, [0.9, 0.99]))).toBe('c');
  });
});

describe('tirages', () => {
  it('consumes a fixed number of values per cell, whatever the amplitude', () => {
    expect(nbTirages({ mode: 'constant', amplitude: 1 }, false)).toBe(0);
    expect(nbTirages({ mode: 'progression', amplitude: 1 }, true)).toBe(0);
    expect(nbTirages({ mode: 'permutation', amplitude: 0 }, false)).toBe(1);
    expect(nbTirages({ mode: 'aleatoire', amplitude: 0 }, true)).toBe(2);
  });

  it('draws in rank order, not row-major order', () => {
    const cls = classement({ type: 'colonnes' }, 2, 2);
    const t = tirages({ mode: 'aleatoire', amplitude: 1 }, false, cls, stream('s', 'x'));
    const attendu = Array.from({ length: 4 }, () => 0);
    const f = stream('s', 'x');
    for (let i = 0; i < 4; i++) attendu[i] = f.suivant();
    // colonnes order: (0,0) (0,1) (1,0) (1,1)
    expect(t.get(0)![0]).toBe(attendu[0]);
    expect(t.get(2)![0]).toBe(attendu[1]);
    expect(t.get(1)![0]).toBe(attendu[2]);
    expect(t.get(3)![0]).toBe(attendu[3]);
  });

  it('contexte reads the draws of its own cell', () => {
    const cls = classement({ type: 'lignes' }, 2, 2);
    const t = tirages({ mode: 'aleatoire', amplitude: 1 }, false, cls, stream('s', 'y'));
    expect(contexte(cls, 1, 1, t).tirages).toEqual(t.get(3));
  });
});

describe('selectionne', () => {
  it('constant is all or nothing', () => {
    expect(selectionne('constant', 0.5, CTX)).toBe(true);
    expect(selectionne('constant', 0.49, CTX)).toBe(false);
  });

  it('amplitude 0 never selects', () => {
    for (const m of ['constant', 'progression', 'permutation', 'aleatoire'] as const) {
      expect(selectionne(m, 0, ctx(0, 1, [0]))).toBe(false);
    }
  });

  it('progression selects the tail of the wave', () => {
    expect(selectionne('progression', 0.25, ctx(0, 1))).toBe(true);
    expect(selectionne('progression', 0.25, ctx(0, 0.5))).toBe(false);
  });

  it('permutation selects even ranks inside the drawn share', () => {
    expect(selectionne('permutation', 1, ctx(0, 0, [0]))).toBe(true);
    expect(selectionne('permutation', 1, ctx(1, 0, [0]))).toBe(false);
    expect(selectionne('permutation', 0.5, ctx(0, 0, [0.9]))).toBe(false);
  });

  it('aleatoire selects the drawn share', () => {
    expect(selectionne('aleatoire', 0.3, ctx(0, 0, [0.2]))).toBe(true);
    expect(selectionne('aleatoire', 0.3, ctx(0, 0, [0.4]))).toBe(false);
  });
});
