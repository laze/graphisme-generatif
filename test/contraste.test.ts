import { describe, expect, it } from 'vitest';
import {
  ajusteNuance,
  appliqueContraste,
  codeCouleur,
  nuancesValides,
  parseCouleur,
} from '../src/core/contraste.js';
import { getPalette } from '../src/palette/index.js';
import { paletteTest } from './fixtures.js';

const alphabet = getPalette('alphabet-6x12');

describe('nuances valides', () => {
  it('lists 1..n plus 13 when the gamme has a noir', () => {
    expect(nuancesValides(alphabet, 'B')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(nuancesValides(alphabet, 'G')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(nuancesValides(alphabet, 'K')).toEqual([1]);
  });

  it('clamps a raw nuance onto the valid set', () => {
    expect(ajusteNuance(alphabet, 'K', 9)).toBe(1);
    expect(ajusteNuance(alphabet, 'G', 13)).toBe(12);
    expect(ajusteNuance(alphabet, 'B', 13)).toBe(13);
  });
});

describe('colour codes', () => {
  it('round-trips', () => {
    for (const c of [
      { gamme: 'B', nuance: 7 },
      { gamme: 'R', nuance: 13 },
      { gamme: 'K', nuance: 1 },
    ]) {
      expect(parseCouleur(codeCouleur(c))).toEqual(c);
    }
    expect(codeCouleur({ gamme: 'R', nuance: 13 })).toBe('RN');
  });

  it('rejects malformed codes', () => {
    expect(() => parseCouleur('b7')).toThrow();
    expect(() => parseCouleur('B')).toThrow();
  });
});

describe('contrast rule', () => {
  it('leaves distinguishable etages alone', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 3 },
        { gamme: 'B', nuance: 9 },
      ],
      alphabet,
      3,
    );
    expect(r.corrections).toBe(0);
    expect(r.couleurs[1]).toEqual({ gamme: 'B', nuance: 9 });
  });

  it('leaves different gammes alone however close the nuances', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 5 },
        { gamme: 'R', nuance: 5 },
      ],
      alphabet,
      3,
    );
    expect(r.corrections).toBe(0);
  });

  it('moves the inner etage by the minimal amount, away from the outer one', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 5 },
        { gamme: 'B', nuance: 6 },
      ],
      alphabet,
      3,
    );
    expect(r.corrections).toBe(1);
    expect(r.couleurs[1]).toEqual({ gamme: 'B', nuance: 8 });
  });

  it('moves downward when the inner etage is the lighter one', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 6 },
        { gamme: 'B', nuance: 5 },
      ],
      alphabet,
      3,
    );
    expect(r.couleurs[1]).toEqual({ gamme: 'B', nuance: 3 });
  });

  it('is minimal: an equal pair moves by exactly minNuance', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 7 },
        { gamme: 'B', nuance: 7 },
      ],
      alphabet,
      4,
    );
    expect(r.couleurs[1]).toEqual({ gamme: 'B', nuance: 11 });
  });

  it('takes the other side when the preferred one runs out of range', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 12 },
        { gamme: 'B', nuance: 13 },
      ],
      alphabet,
      5,
    );
    expect(r.couleurs[1]).toEqual({ gamme: 'B', nuance: 7 });
  });

  it('switches to the next gamme in key order when no nuance works', () => {
    // paletteTest gamme B has only 2 nuances, so minNuance 4 is unreachable.
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 1 },
        { gamme: 'B', nuance: 2 },
      ],
      paletteTest,
      4,
    );
    expect(r.corrections).toBe(1);
    expect(r.couleurs[1]?.gamme).toBe('A');
  });

  it('applies outward to inward across three etages', () => {
    const r = appliqueContraste(
      [
        { gamme: 'B', nuance: 1 },
        { gamme: 'B', nuance: 2 },
        { gamme: 'B', nuance: 3 },
      ],
      alphabet,
      3,
    );
    expect(r.corrections).toBe(2);
    expect(r.couleurs).toEqual([
      { gamme: 'B', nuance: 1 },
      { gamme: 'B', nuance: 4 },
      { gamme: 'B', nuance: 1 },
    ]);
  });

  it('is deterministic', () => {
    const entree = [
      { gamme: 'R', nuance: 6 },
      { gamme: 'R', nuance: 6 },
      { gamme: 'R', nuance: 7 },
    ];
    const a = appliqueContraste(entree, alphabet, 3);
    const b = appliqueContraste(entree, alphabet, 3);
    expect(a).toEqual(b);
  });

  it('never mutates its input', () => {
    const entree = [
      { gamme: 'B', nuance: 5 },
      { gamme: 'B', nuance: 6 },
    ];
    appliqueContraste(entree, alphabet, 3);
    expect(entree[1]).toEqual({ gamme: 'B', nuance: 6 });
  });
});
