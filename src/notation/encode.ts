/**
 * Compact text notation (SPEC Section 9.2), in the spirit of the historical
 * letter-number sheets. One line per row of base units.
 */

import { aspectDefaut } from '../core/generate.js';
import type { FormePlacee, Programmation, UnitePlacee } from '../core/types.js';

/** Minimal decimal representation, at most 4 decimals, '.' as separator. */
export function num(n: number): string {
  const r = Math.round(n * 10000) / 10000;
  const v = Object.is(r, -0) ? 0 : r;
  if (Number.isInteger(v)) return String(v);
  return String(v).replace(/0+$/, '').replace(/\.$/, '');
}

const SUR: RegExp = /[^A-Za-z0-9._-]/;

/** URL-safe token; anything else is percent-encoded over its UTF-8 bytes. */
export function encodeToken(s: string): string {
  if (s.length > 0 && !SUR.test(s)) return s;
  const octets = new TextEncoder().encode(s);
  let out = '';
  for (const b of octets) {
    const c = String.fromCharCode(b);
    out += /[A-Za-z0-9._-]/.test(c) ? c : `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export function encodeForme(f: FormePlacee): string {
  let s = `${f.type}${f.grandeur}`;
  if (f.rotation !== 0) s += `@${num(f.rotation)}`;
  if (f.aspect !== aspectDefaut(f.type)) s += `x${num(f.aspect)}`;
  if (f.cisaillement !== 0) s += `s${num(f.cisaillement)}`;
  return s;
}

export function encodeUnite(u: UnitePlacee): string {
  let s = u.fond;
  for (const e of u.etages) s += `>${encodeForme(e.forme)}:${e.couleur}`;
  return u.echelle === 2 ? `2*${s}` : s;
}

/**
 * Serialises a programmation. Throws for an inline palette: the header carries
 * a palette id only, so an inline palette could not be recovered.
 */
export function encode(p: Programmation): string {
  if (p.paletteInline) {
    throw new Error('encode: the text notation cannot carry an inline palette');
  }
  const grille: (string | null)[] = new Array(p.largeur * p.hauteur).fill(null);
  for (const u of p.unites) {
    const k = u.y * p.largeur + u.x;
    if (grille[k] !== null) {
      throw new Error(`encode: two unites at (${u.x}, ${u.y})`);
    }
    grille[k] = encodeUnite(u);
    if (u.echelle === 2) {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const kk = (u.y + dy) * p.largeur + (u.x + dx);
        if (kk < grille.length) grille[kk] = '.';
      }
    }
  }

  const lignes: string[] = [
    `GG1 seed=${encodeToken(p.seed)} palette=${encodeToken(p.palette)} unites=${p.largeur}x${p.hauteur}`,
  ];
  for (let y = 0; y < p.hauteur; y++) {
    const cellules: string[] = [];
    for (let x = 0; x < p.largeur; x++) {
      const c = grille[y * p.largeur + x];
      if (c === null || c === undefined) {
        throw new Error(`encode: no unite covers (${x}, ${y})`);
      }
      cellules.push(c);
    }
    lignes.push(cellules.join(' '));
  }
  return lignes.join('\n');
}
