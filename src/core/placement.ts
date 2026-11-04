/**
 * Echelle rule and module placement (SPEC Sections 3.2 and 6.5).
 *
 * Module slots are visited in inter-parcours order. The first free slot that
 * wants echelle 2 and has a free, in-bounds 2x2 block takes it; everything
 * else is echelle 1. Echelle never varies within a module.
 */

import type { Classement } from './parcours.js';
import type { Flux } from './prng.js';
import { type EchelleSpec, assertNever } from './types.js';

export interface ModulePlace {
  /** anchor slot */
  ax: number;
  ay: number;
  echelle: 1 | 2;
  /** rank and t of the anchor slot in the inter parcours */
  rang: number;
  t: number;
}

export interface ResultatPlacement {
  modules: ModulePlace[];
  /** slot key (ay * modulesX + ax) -> index into `modules`, for every covered slot */
  parSlot: Map<number, number>;
}

/** Desired echelle for an anchor slot, before availability is checked. */
function veutEchelle2(spec: EchelleSpec, t: number, tirage: number): boolean {
  if (spec.part <= 0) return false;
  switch (spec.mode) {
    case 'constant':
      return spec.part >= 0.5;
    case 'progression':
      return t >= 1 - spec.part;
    case 'aleatoire':
      return tirage < spec.part;
    default:
      return assertNever(spec.mode, 'unknown echelle mode');
  }
}

export function placer(
  spec: EchelleSpec,
  cls: Classement,
  modulesX: number,
  modulesY: number,
  flux: Flux,
): ResultatPlacement {
  // One draw per anchor slot in parcours order, whatever the mode, so the
  // stream position never depends on `part`.
  const tiragesParSlot = new Map<number, number>();
  for (const c of cls.ordre) tiragesParSlot.set(c.y * modulesX + c.x, flux.suivant());

  const modules: ModulePlace[] = [];
  const parSlot = new Map<number, number>();

  for (const c of cls.ordre) {
    const k = c.y * modulesX + c.x;
    if (parSlot.has(k)) continue;
    const t = cls.t(c.x, c.y);
    const rang = cls.rang(c.x, c.y);
    const veut = veutEchelle2(spec, t, tiragesParSlot.get(k) ?? 1);
    const tient =
      veut &&
      c.x + 1 < modulesX &&
      c.y + 1 < modulesY &&
      !parSlot.has(c.y * modulesX + c.x + 1) &&
      !parSlot.has((c.y + 1) * modulesX + c.x) &&
      !parSlot.has((c.y + 1) * modulesX + c.x + 1);

    const echelle: 1 | 2 = tient ? 2 : 1;
    const index = modules.length;
    modules.push({ ax: c.x, ay: c.y, echelle, rang, t });
    parSlot.set(k, index);
    if (echelle === 2) {
      parSlot.set(c.y * modulesX + c.x + 1, index);
      parSlot.set((c.y + 1) * modulesX + c.x, index);
      parSlot.set((c.y + 1) * modulesX + c.x + 1, index);
    }
  }

  return { modules, parSlot };
}
