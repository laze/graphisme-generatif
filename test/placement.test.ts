import { describe, expect, it } from 'vitest';
import { classement } from '../src/core/parcours.js';
import { placer } from '../src/core/placement.js';
import { stream } from '../src/core/prng.js';
import { ECHELLE_MODES, PARCOURS_TYPES } from '../src/core/types.js';

function verifie(
  modulesX: number,
  modulesY: number,
  mode: 'constant' | 'progression' | 'aleatoire',
  part: number,
  type: (typeof PARCOURS_TYPES)[number],
) {
  const cls = classement({ type }, modulesX, modulesY);
  const r = placer({ mode, part }, cls, modulesX, modulesY, stream('p', 'echelle'));

  const occupe = new Map<number, number>();
  for (let i = 0; i < r.modules.length; i++) {
    const m = r.modules[i]!;
    const slots: [number, number][] =
      m.echelle === 1
        ? [[m.ax, m.ay]]
        : [
            [m.ax, m.ay],
            [m.ax + 1, m.ay],
            [m.ax, m.ay + 1],
            [m.ax + 1, m.ay + 1],
          ];
    for (const [sx, sy] of slots) {
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThan(modulesX);
      expect(sy).toBeLessThan(modulesY);
      const k = sy * modulesX + sx;
      expect(occupe.has(k)).toBe(false);
      occupe.set(k, i);
    }
  }
  expect(occupe.size).toBe(modulesX * modulesY);
  return r;
}

describe('echelle placement', () => {
  it('never overlaps and never leaves the champ, across modes and parcours', () => {
    for (const mode of ECHELLE_MODES) {
      for (const part of [0, 0.3, 0.5, 1]) {
        for (const type of PARCOURS_TYPES) {
          for (const [mx, my] of [
            [1, 1],
            [3, 3],
            [4, 5],
            [6, 4],
          ] as const) {
            verifie(mx, my, mode, part, type);
          }
        }
      }
    }
  });

  it('constant with part < 0.5 places only echelle 1', () => {
    const r = verifie(4, 4, 'constant', 0.4, 'lignes');
    expect(r.modules.every((m) => m.echelle === 1)).toBe(true);
    expect(r.modules).toHaveLength(16);
  });

  it('constant with part >= 0.5 tiles echelle 2 where it fits', () => {
    const r = verifie(4, 4, 'constant', 0.5, 'lignes');
    expect(r.modules.filter((m) => m.echelle === 2)).toHaveLength(4);
    expect(r.modules.filter((m) => m.echelle === 1)).toHaveLength(0);
  });

  it('a 1x1 champ can never hold an echelle-2 module', () => {
    const r = verifie(1, 1, 'constant', 1, 'lignes');
    expect(r.modules[0]!.echelle).toBe(1);
  });

  it('an odd champ falls back to echelle 1 where the 2x2 block does not fit', () => {
    const r = verifie(3, 3, 'constant', 1, 'lignes');
    expect(r.modules.filter((m) => m.echelle === 2)).toHaveLength(1);
    expect(r.modules[0]).toMatchObject({ ax: 0, ay: 0, echelle: 2 });
  });

  it('progression only enlarges modules in the high-t region', () => {
    const cls = classement({ type: 'lignes' }, 5, 5);
    const r = placer({ mode: 'progression', part: 0.4 }, cls, 5, 5, stream('p', 'echelle'));
    const grands = r.modules.filter((m) => m.echelle === 2);
    expect(grands.length).toBeGreaterThan(0);
    for (const m of grands) expect(cls.t(m.ax, m.ay)).toBeGreaterThanOrEqual(0.6);
  });

  it('rayonnement leaves no room for echelle 2: inner slots are visited first', () => {
    // SPEC 3.2 visits slots in inter-parcours order, so with rayonnement the
    // 2x2 block of any outer-ring anchor always dips into occupied slots.
    const cls = classement({ type: 'rayonnement' }, 5, 5);
    const r = placer({ mode: 'progression', part: 0.4 }, cls, 5, 5, stream('p', 'echelle'));
    expect(r.modules.every((m) => m.echelle === 1)).toBe(true);
  });

  it('is reproducible for the same seed', () => {
    const cls = classement({ type: 'spirale' }, 5, 5);
    const a = placer({ mode: 'aleatoire', part: 0.5 }, cls, 5, 5, stream('s', 'echelle'));
    const b = placer({ mode: 'aleatoire', part: 0.5 }, cls, 5, 5, stream('s', 'echelle'));
    expect(a.modules).toEqual(b.modules);
  });

  it('keeps the anchor rank and t of its slot', () => {
    const cls = classement({ type: 'lignes' }, 4, 4);
    const r = placer({ mode: 'constant', part: 1 }, cls, 4, 4, stream('s', 'echelle'));
    for (const m of r.modules) {
      expect(m.rang).toBe(cls.rang(m.ax, m.ay));
      expect(m.t).toBe(cls.t(m.ax, m.ay));
    }
  });
});
