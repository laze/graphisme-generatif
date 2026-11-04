/**
 * Realisation stage: programmation -> SVG (SPEC Section 10).
 *
 * This stage makes no decisions. Every colour, forme and position is already
 * fixed in the programmation; here they only become geometry and text. Output
 * is deterministic: fixed element and attribute order, numbers at most 4
 * decimals, '\n' line endings.
 */

import { parseCouleur } from '../core/contraste.js';
import { facteurBoite } from '../core/generate.js';
import {
  type FormePlacee,
  NUANCE_NOIR,
  type Palette,
  type Programmation,
  type UnitePlacee,
} from '../core/types.js';

export interface RenderOptions {
  /** px per base unit, default 24 */
  taille?: number;
  /** gap as a fraction of a unit, 0-0.2; the programmation does not carry it */
  joint?: number;
  /** colour code shown in the joint gap, default 'K1' */
  fondJoint?: string;
  /** default 'xMidYMid slice' */
  preserveAspectRatio?: string;
  /** <title> for accessibility; omitted when absent */
  titre?: string;
}

const TAILLE_DEFAUT = 24;
const FOND_JOINT_DEFAUT = 'K1';
const PRESERVE_DEFAUT = 'xMidYMid slice';

/** Minimal decimal representation, at most 4 decimals, '.' as separator. */
function num(n: number): string {
  const r = Math.round(n * 10000) / 10000;
  return String(Object.is(r, -0) ? 0 : r);
}

function echappe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Resolves a colour code against a palette (SPEC Section 4.3). */
export function hexDeCouleur(palette: Palette, code: string): string {
  const { gamme, nuance } = parseCouleur(code);
  const g = palette.gammes[gamme];
  if (!g) {
    throw new Error(
      `colour ${JSON.stringify(code)}: palette has no gamme ${JSON.stringify(gamme)}`,
    );
  }
  if (nuance === NUANCE_NOIR) {
    if (!g.noir) throw new Error(`colour ${JSON.stringify(code)}: gamme has no noir`);
    return g.noir;
  }
  const hex = g.nuances[nuance - 1];
  if (!hex) throw new Error(`colour ${JSON.stringify(code)}: nuance out of range`);
  return hex;
}

/**
 * Single transform matrix of a forme: shear first, then rotation, both about
 * the forme centre (SPEC Section 3.3). Empty when the forme is untransformed.
 */
function transforme(f: FormePlacee, cx: number, cy: number): string {
  const s = f.cisaillement;
  const deg = f.rotation % 360;
  if (s === 0 && deg === 0) return '';
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const a = cos;
  const b = sin;
  const c = s * cos - sin;
  const d = s * sin + cos;
  const e = cx - (a * cx + c * cy);
  const g = cy - (b * cx + d * cy);
  return ` transform="matrix(${num(a)},${num(b)},${num(c)},${num(d)},${num(e)},${num(g)})"`;
}

/**
 * One forme as a single SVG element. `cote` is the bbox side; the horizontal
 * extent is scaled by `aspect` (SPEC Section 3.4).
 */
function elementForme(f: FormePlacee, centre: number, cote: number, fill: string): string {
  const w = cote * f.aspect;
  const h = cote;
  const x0 = centre - w / 2;
  const y0 = centre - h / 2;
  const t = transforme(f, centre, centre);

  switch (f.type) {
    case 'c':
    case 'r':
      return `<rect x="${num(x0)}" y="${num(y0)}" width="${num(w)}" height="${num(
        h,
      )}" fill="${fill}"${t} shape-rendering="crispEdges"/>`;
    case 'o':
    case 'e': {
      const rx = w / 2;
      const ry = h / 2;
      if (rx === ry) {
        return `<circle cx="${num(centre)}" cy="${num(centre)}" r="${num(rx)}" fill="${fill}"${t}/>`;
      }
      return `<ellipse cx="${num(centre)}" cy="${num(centre)}" rx="${num(rx)}" ry="${num(
        ry,
      )}" fill="${fill}"${t}/>`;
    }
    case 'l': {
      const pts = [
        [centre, y0],
        [x0 + w, centre],
        [centre, y0 + h],
        [x0, centre],
      ];
      return `<polygon points="${points(pts)}" fill="${fill}"${t}/>`;
    }
    case 't': {
      const pts = [
        [centre, y0],
        [x0 + w, y0 + h],
        [x0, y0 + h],
      ];
      return `<polygon points="${points(pts)}" fill="${fill}"${t}/>`;
    }
  }
}

function points(pts: number[][]): string {
  return pts.map((p) => `${num(p[0] as number)},${num(p[1] as number)}`).join(' ');
}

/** One unite: a <g> translated to its origin, etages drawn back to front. */
function elementUnite(u: UnitePlacee, palette: Palette, joint: number): string {
  const taille = u.echelle;
  const centre = taille / 2;
  let boite = taille * (1 - joint);

  const lignes = [`<g transform="translate(${num(u.x)},${num(u.y)})">`];
  const bord = (taille - boite) / 2;
  lignes.push(
    `<rect x="${num(bord)}" y="${num(bord)}" width="${num(boite)}" height="${num(
      boite,
    )}" fill="${hexDeCouleur(palette, u.fond)}" shape-rendering="crispEdges"/>`,
  );

  for (const etage of u.etages) {
    const f = etage.forme;
    const cote = boite * (f.grandeur / 30);
    lignes.push(elementForme(f, centre, cote, hexDeCouleur(palette, etage.couleur)));
    boite = cote * facteurBoite(f.type, f.aspect);
  }

  lignes.push('</g>');
  return lignes.join('\n');
}

/** programmation -> SVG document (SPEC Section 10). */
export function renderSVG(p: Programmation, palette: Palette, opts: RenderOptions = {}): string {
  const taille = opts.taille ?? TAILLE_DEFAUT;
  const joint = opts.joint ?? 0;
  const preserve = opts.preserveAspectRatio ?? PRESERVE_DEFAUT;
  const fondJoint = hexDeCouleur(palette, opts.fondJoint ?? FOND_JOINT_DEFAUT);

  const lignes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(p.largeur)} ${num(
      p.hauteur,
    )}" width="${num(p.largeur * taille)}" height="${num(
      p.hauteur * taille,
    )}" preserveAspectRatio="${preserve}">`,
  ];
  if (opts.titre !== undefined) lignes.push(`<title>${echappe(opts.titre)}</title>`);
  lignes.push(
    `<rect x="0" y="0" width="${num(p.largeur)}" height="${num(
      p.hauteur,
    )}" fill="${fondJoint}" shape-rendering="crispEdges"/>`,
  );

  for (const u of p.unites) lignes.push(elementUnite(u, palette, joint));

  lignes.push('</svg>', '');
  return lignes.join('\n');
}
