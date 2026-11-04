/**
 * Variation rules (SPEC Section 6): how one axis changes along a parcours.
 *
 * Numeric axes accumulate offsets (inter then intra) and are clamped or
 * wrapped at the end; categorical axes are replaced step by step.
 */

import type { Classement } from './parcours.js';
import type { Flux } from './prng.js';
import { type Onde, type Plage, type Variation, assertNever } from './types.js';

/** Wave function w(t) in [0,1], with u = t * periode (SPEC Section 6.2). */
export function onde(o: Onde, t: number, periode: number): number {
  const u = t * periode;
  switch (o) {
    case 'rampe': {
      const f = u - Math.floor(u);
      // for periode = 1 and t = 1, w = 1
      return u > 0 && f === 0 ? 1 : f;
    }
    case 'triangle':
      return 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
    case 'sinus':
      return (1 - Math.cos(2 * Math.PI * u)) / 2;
    default:
      return assertNever(o, 'unknown onde');
  }
}

/** Rounds half away from zero (SPEC Section 6.2). */
export function arrondiEntier(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Rounds a float that reaches the programmation to 4 decimals (SPEC Section 7). */
export function arrondi4(x: number): number {
  const r = Math.round(x * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

/** Clamps or wraps a value into its axis range and rounds integer axes. */
export function finaliser(valeur: number, plage: Plage): number {
  let v = valeur;
  if (plage.wrap) {
    const span = plage.max - plage.min;
    v = ((((v - plage.min) % span) + span) % span) + plage.min;
  } else {
    v = Math.min(plage.max, Math.max(plage.min, v));
  }
  return plage.entier ? arrondiEntier(v) : arrondi4(v);
}

/**
 * Number of PRNG values a cell consumes for this variation. Fixed per
 * variation so that stream positions never depend on amplitude or on which
 * cells happen to be selected.
 */
export function nbTirages(v: Variation<unknown>, categorique: boolean): number {
  switch (v.mode) {
    case 'constant':
    case 'progression':
      return 0;
    case 'permutation':
      return 1;
    case 'aleatoire':
      return categorique ? 2 : 1;
    default:
      return assertNever(v.mode, 'unknown mode');
  }
}

/**
 * Pre-draws every cell's PRNG values in rank order (ties row-major),
 * keyed by `y * largeur + x` of the classement grid (SPEC Section 7).
 */
export function tirages(
  v: Variation<unknown>,
  categorique: boolean,
  cls: Classement,
  flux: Flux,
): Map<number, number[]> {
  const n = nbTirages(v, categorique);
  const out = new Map<number, number[]>();
  if (n === 0) return out;
  for (const c of cls.ordre) {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(flux.suivant());
    out.set(c.y * cls.largeur + c.x, vals);
  }
  return out;
}

const AUCUN: readonly number[] = [];

export interface ContexteCellule {
  rang: number;
  t: number;
  tirages: readonly number[];
}

export function contexte(
  cls: Classement,
  x: number,
  y: number,
  tir: Map<number, number[]>,
): ContexteCellule {
  return {
    rang: cls.rang(x, y),
    t: cls.t(x, y),
    tirages: tir.get(y * cls.largeur + x) ?? AUCUN,
  };
}

/** Offset contributed by one variation on a numeric axis (SPEC Section 6.2). */
export function offsetNumerique(
  v: Variation<number> | undefined,
  plage: Plage,
  ctx: ContexteCellule,
): number {
  if (!v) return 0;
  const span = plage.max - plage.min;
  switch (v.mode) {
    case 'constant':
      return 0;
    case 'progression': {
      const sens = v.sens ?? 1;
      return sens * v.amplitude * span * onde(v.onde ?? 'rampe', ctx.t, v.periode ?? 1);
    }
    case 'permutation': {
      const ens = v.ensemble;
      if (!ens || ens.length === 0) return 0;
      const u = ctx.tirages[0] ?? 1;
      if (u >= v.amplitude) return 0;
      const pas = v.pas ?? 1;
      const i = (((ctx.rang * pas) % ens.length) + ens.length) % ens.length;
      return ens[i] ?? 0;
    }
    case 'aleatoire': {
      const u = ctx.tirages[0] ?? 0;
      return v.amplitude * span * (2 * u - 1);
    }
    default:
      return assertNever(v.mode, 'unknown mode');
  }
}

/** Value produced by one variation on a categorical axis (SPEC Section 6.2). */
export function valeurCategorique<T>(
  v: Variation<T> | undefined,
  base: T,
  ctx: ContexteCellule,
  avertir?: (message: string) => void,
): T {
  if (!v) return base;
  const ens = v.ensemble;
  switch (v.mode) {
    case 'constant':
      return base;
    case 'progression': {
      if (!ens || ens.length === 0) return base;
      if (v.amplitude < 0.5) return base;
      const w = onde(v.onde ?? 'rampe', ctx.t, v.periode ?? 1);
      const i = Math.min(Math.floor(w * ens.length), ens.length - 1);
      return ens[i] ?? base;
    }
    case 'permutation': {
      if (!ens || ens.length === 0) return base;
      const u = ctx.tirages[0] ?? 1;
      if (u >= v.amplitude) return base;
      let start = ens.indexOf(base);
      if (start < 0) {
        start = 0;
        avertir?.(
          `permutation: start value ${JSON.stringify(base)} is not a member of ensemble; index 0 used`,
        );
      }
      const pas = v.pas ?? 1;
      const i = (((start + ctx.rang * pas) % ens.length) + ens.length) % ens.length;
      return ens[i] ?? base;
    }
    case 'aleatoire': {
      if (!ens || ens.length === 0) return base;
      const u = ctx.tirages[0] ?? 1;
      if (u >= v.amplitude) return base;
      const p = ctx.tirages[1] ?? 0;
      const i = Math.min(Math.floor(p * ens.length), ens.length - 1);
      return ens[i] ?? base;
    }
    default:
      return assertNever(v.mode, 'unknown mode');
  }
}

/** Selection predicate shared by inversion and echelle (SPEC Sections 6.4, 6.5). */
export function selectionne(
  mode: Variation<unknown>['mode'],
  amplitude: number,
  ctx: ContexteCellule,
  onde_: Onde = 'rampe',
  periode = 1,
): boolean {
  if (amplitude <= 0) return false;
  switch (mode) {
    case 'constant':
      return amplitude >= 0.5;
    case 'progression':
      return onde(onde_, ctx.t, periode) >= 1 - amplitude;
    case 'permutation': {
      const u = ctx.tirages[0] ?? 1;
      return u < amplitude && ctx.rang % 2 === 0;
    }
    case 'aleatoire': {
      const u = ctx.tirages[0] ?? 1;
      return u < amplitude;
    }
    default:
      return assertNever(mode, 'unknown mode');
  }
}
