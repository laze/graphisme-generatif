import { describe, expect, it } from 'vitest';
import { stream, cyrb128, sfc32 } from '../src/core/prng.js';

function premiers(n: number, ...chemin: string[]): number[] {
  const f = stream('graine', ...chemin);
  return Array.from({ length: n }, () => f.suivant());
}

describe('cyrb128', () => {
  it('is deterministic and returns four unsigned 32-bit words', () => {
    const a = cyrb128('abc');
    expect(cyrb128('abc')).toEqual(a);
    for (const w of a) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('separates near-identical inputs', () => {
    expect(cyrb128('abc')).not.toEqual(cyrb128('abd'));
    expect(cyrb128('a|b/c')).not.toEqual(cyrb128('a|b/d'));
  });
});

describe('sfc32', () => {
  it('produces values in [0,1)', () => {
    const f = sfc32(1, 2, 3, 4);
    for (let i = 0; i < 10000; i++) {
      const v = f.suivant();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has a roughly uniform mean over many draws', () => {
    const f = sfc32(...cyrb128('uniformite'));
    let somme = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) somme += f.suivant();
    expect(somme / n).toBeGreaterThan(0.49);
    expect(somme / n).toBeLessThan(0.51);
  });
});

describe('stream', () => {
  it('is reproducible for the same seed and path', () => {
    expect(premiers(5, 'inter', 'etage1', 'couleur.nuance')).toEqual(
      premiers(5, 'inter', 'etage1', 'couleur.nuance'),
    );
  });

  it('differs when any path segment differs', () => {
    const base = premiers(5, 'inter', 'etage1', 'couleur.nuance');
    expect(premiers(5, 'intra', 'etage1', 'couleur.nuance')).not.toEqual(base);
    expect(premiers(5, 'inter', 'etage2', 'couleur.nuance')).not.toEqual(base);
    expect(premiers(5, 'inter', 'etage1', 'forme.grandeur')).not.toEqual(base);
  });

  it('differs when the seed differs', () => {
    const a = Array.from({ length: 5 }, (_, i) => i);
    const f1 = stream('a', 'x');
    const f2 = stream('b', 'x');
    expect(a.map(() => f1.suivant())).not.toEqual(a.map(() => f2.suivant()));
  });
});
