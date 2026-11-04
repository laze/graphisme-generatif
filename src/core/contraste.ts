/**
 * Contrast rule between adjacent etages (SPEC Section 4.4).
 *
 * If two adjacent etages share a gamme, their nuances must differ by at least
 * `minNuance`. The inner etage moves by the minimal amount to a valid nuance,
 * preferring the side it is already on; if no nuance works, it switches to the
 * next gamme in the palette's key order.
 */

import { NUANCE_NOIR, type Palette } from './types.js';

export interface Couleur {
  gamme: string;
  nuance: number;
}

/** Nuances a gamme actually offers: 1..nuances.length, plus 13 when it has a noir. */
export function nuancesValides(palette: Palette, gamme: string): number[] {
  const g = palette.gammes[gamme];
  if (!g) return [1];
  const out: number[] = [];
  for (let n = 1; n <= g.nuances.length; n++) out.push(n);
  if (g.noir) out.push(NUANCE_NOIR);
  return out;
}

/** Clamps a raw nuance onto the gamme's valid set (nearest, ties to the lower). */
export function ajusteNuance(palette: Palette, gamme: string, nuance: number): number {
  const valides = nuancesValides(palette, gamme);
  let best = valides[0] ?? 1;
  let bestD = Math.abs(best - nuance);
  for (const v of valides) {
    const d = Math.abs(v - nuance);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

function gammeSuivante(palette: Palette, gamme: string): string {
  const cles = Object.keys(palette.gammes);
  if (cles.length === 0) return gamme;
  const i = cles.indexOf(gamme);
  return cles[(i + 1) % cles.length] ?? gamme;
}

export interface ResultatContraste {
  couleurs: Couleur[];
  corrections: number;
}

/**
 * Applies the rule to a chain of etages, outer to inner. Returns the corrected
 * chain and how many corrections were made.
 */
export function appliqueContraste(
  couleurs: readonly Couleur[],
  palette: Palette,
  minNuance: number,
): ResultatContraste {
  const out: Couleur[] = couleurs.map((c) => ({ ...c }));
  let corrections = 0;

  for (let k = 0; k + 1 < out.length; k++) {
    const exterieur = out[k];
    const interieur = out[k + 1];
    if (!exterieur || !interieur) continue;
    if (exterieur.gamme !== interieur.gamme) continue;
    if (Math.abs(exterieur.nuance - interieur.nuance) >= minNuance) continue;

    const candidats = nuancesValides(palette, interieur.gamme).filter(
      (n) => Math.abs(n - exterieur.nuance) >= minNuance,
    );

    if (candidats.length > 0) {
      // Minimal move; prefer the side the inner etage is already on.
      const cote = interieur.nuance >= exterieur.nuance ? 1 : -1;
      let best = candidats[0] as number;
      let bestKey: [number, number] = [
        Math.abs(best - interieur.nuance),
        Math.sign(best - exterieur.nuance) === cote ? 0 : 1,
      ];
      for (const n of candidats) {
        const key: [number, number] = [
          Math.abs(n - interieur.nuance),
          Math.sign(n - exterieur.nuance) === cote ? 0 : 1,
        ];
        if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
          best = n;
          bestKey = key;
        }
      }
      interieur.nuance = best;
    } else {
      const g = gammeSuivante(palette, interieur.gamme);
      interieur.gamme = g;
      interieur.nuance = ajusteNuance(palette, g, interieur.nuance);
    }
    corrections++;
  }

  return { couleurs: out, corrections };
}

/** Colour code "<gamme><nuance|N>" (SPEC Section 4.3). */
export function codeCouleur(c: Couleur): string {
  return c.nuance === NUANCE_NOIR ? `${c.gamme}N` : `${c.gamme}${c.nuance}`;
}

export function parseCouleur(code: string): Couleur {
  const m = /^([A-Z])(N|\d{1,2})$/.exec(code);
  if (!m) throw new Error(`invalid colour code: ${JSON.stringify(code)}`);
  const gamme = m[1] as string;
  const reste = m[2] as string;
  return { gamme, nuance: reste === 'N' ? NUANCE_NOIR : Number.parseInt(reste, 10) };
}
