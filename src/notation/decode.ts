/**
 * Parser for the text notation (SPEC Section 9.2).
 *
 * The notation is a projection: it records neither `diagnostics` nor module
 * membership, so decoded unites carry the sentinel module `[-1, -1]`.
 */

import { aspectDefaut } from '../core/generate.js';
import {
  type EtagePlace,
  FORME_TYPES,
  type FormePlacee,
  type FormeType,
  type Programmation,
  type UnitePlacee,
} from '../core/types.js';

/** Module anchor used for unites read back from the notation. */
export const MODULE_INCONNU: [number, number] = [-1, -1];

export function decodeToken(s: string): string {
  if (!s.includes('%')) return s;
  const octets: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '%') {
      const hex = s.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) throw new Error(`invalid percent escape in token: ${s}`);
      octets.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      octets.push((s.charCodeAt(i) & 0xff) as number);
    }
  }
  return new TextDecoder().decode(Uint8Array.from(octets));
}

const RE_HEADER = /^GG1 seed=([A-Za-z0-9._%-]+) palette=([A-Za-z0-9._%-]+) unites=(\d+)x(\d+)$/;
const RE_COULEUR = /^[A-Z](?:N|\d{1,2})$/;
const RE_FORME =
  /^([colter])(\d{1,2})(?:@(-?\d+(?:\.\d+)?))?(?:x(-?\d+(?:\.\d+)?))?(?:s(-?\d+(?:\.\d+)?))?$/;

function forme(s: string): FormePlacee {
  const m = RE_FORME.exec(s);
  if (!m) throw new Error(`invalid forme: ${JSON.stringify(s)}`);
  const type = m[1] as FormeType;
  if (!FORME_TYPES.includes(type)) throw new Error(`invalid forme type: ${type}`);
  return {
    type,
    grandeur: Number.parseInt(m[2] as string, 10),
    rotation: m[3] === undefined ? 0 : Number.parseFloat(m[3]),
    aspect: m[4] === undefined ? aspectDefaut(type) : Number.parseFloat(m[4]),
    cisaillement: m[5] === undefined ? 0 : Number.parseFloat(m[5]),
  };
}

function couleur(s: string): string {
  if (!RE_COULEUR.test(s)) throw new Error(`invalid colour code: ${JSON.stringify(s)}`);
  return s;
}

function cellule(s: string, x: number, y: number): UnitePlacee {
  const echelle: 1 | 2 = s.startsWith('2*') ? 2 : 1;
  const corps = echelle === 2 ? s.slice(2) : s;
  const parties = corps.split('>');
  const tete = parties[0];
  if (tete === undefined) throw new Error(`empty cell at (${x}, ${y})`);
  const etages: EtagePlace[] = [];
  for (const p of parties.slice(1)) {
    const i = p.indexOf(':');
    if (i < 0) throw new Error(`missing ":" in etage ${JSON.stringify(p)} at (${x}, ${y})`);
    etages.push({ forme: forme(p.slice(0, i)), couleur: couleur(p.slice(i + 1)) });
  }
  return { x, y, echelle, module: [...MODULE_INCONNU], fond: couleur(tete), etages };
}

export function decode(s: string): Programmation {
  const lignes = s.split('\n');
  const entete = lignes[0];
  if (entete === undefined) throw new Error('empty notation');
  const m = RE_HEADER.exec(entete);
  if (!m) throw new Error(`invalid header: ${JSON.stringify(entete)}`);
  const seed = decodeToken(m[1] as string);
  const palette = decodeToken(m[2] as string);
  const largeur = Number.parseInt(m[3] as string, 10);
  const hauteur = Number.parseInt(m[4] as string, 10);

  const corps = lignes.slice(1);
  if (corps.length !== hauteur) {
    throw new Error(`expected ${hauteur} rows, got ${corps.length}`);
  }

  const unites: UnitePlacee[] = [];
  for (let y = 0; y < hauteur; y++) {
    const cellules = (corps[y] as string).split(' ');
    if (cellules.length !== largeur) {
      throw new Error(`row ${y}: expected ${largeur} cells, got ${cellules.length}`);
    }
    for (let x = 0; x < largeur; x++) {
      const c = cellules[x] as string;
      if (c === '.') continue;
      unites.push(cellule(c, x, y));
    }
  }

  unites.sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    version: 1,
    seed,
    palette,
    largeur,
    hauteur,
    unites,
    diagnostics: { contrasteCorrections: 0, avertissements: [] },
  };
}
