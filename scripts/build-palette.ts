/**
 * Builds `src/palette/alphabet-6x12.json` (SPEC Section 4.2).
 *
 * The values are our own OKLCH approximations of the named hues. They are not
 * measured historical pigments and must not be presented as such.
 *
 * The OKLCH -> sRGB conversion lives here only: the runtime never converts
 * colours, it reads hex values from palette data.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Gamme, Palette } from '../src/core/types.js';

// --- OKLCH -> sRGB ---------------------------------------------------------

/** OKLab -> linear sRGB (Bjorn Ottosson's matrices). */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

const EPS = 1e-6;

function dansGamut(L: number, C: number, hDeg: number): boolean {
  const h = (hDeg * Math.PI) / 180;
  const [r, g, b] = oklabToLinearSrgb(L, C * Math.cos(h), C * Math.sin(h));
  return r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;
}

/** Largest chroma <= C that stays in the sRGB gamut, by binary search. */
function clipChroma(L: number, C: number, hDeg: number): number {
  if (dansGamut(L, C, hDeg)) return C;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (dansGamut(L, mid, hDeg)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function canal(x: number): number {
  return Math.min(255, Math.max(0, Math.round(linearToSrgb(x) * 255)));
}

export function oklchToHex(L: number, C: number, hDeg: number): string {
  const c = clipChroma(L, C, hDeg);
  const h = (hDeg * Math.PI) / 180;
  const [r, g, b] = oklabToLinearSrgb(L, c * Math.cos(h), c * Math.sin(h));
  return `#${[canal(r), canal(g), canal(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// --- the palette -----------------------------------------------------------

const NUANCES = 12;

/** L for nuance n (1..12): 0.96 down to 0.30 (SPEC Section 4.2). */
export function lightness(n: number): number {
  return 0.96 - ((n - 1) * (0.96 - 0.3)) / (NUANCES - 1);
}

/** C for nuance n: low at both ends, peak mid-scale (SPEC Section 4.2). */
export function chroma(cPeak: number, n: number): number {
  return cPeak * Math.sin((Math.PI * (n - 0.5)) / NUANCES);
}

interface Def {
  lettre: string;
  label: string;
  hue: number;
  cPeak: number;
  noir: boolean;
}

const DEFS: Def[] = [
  { lettre: 'J', label: 'jaune de chrome', hue: 95, cPeak: 0.17, noir: true },
  { lettre: 'V', label: 'vert émeraude', hue: 160, cPeak: 0.14, noir: true },
  { lettre: 'B', label: 'bleu outremer', hue: 265, cPeak: 0.19, noir: true },
  { lettre: 'M', label: 'violet de cobalt', hue: 305, cPeak: 0.16, noir: true },
  { lettre: 'R', label: 'rouge', hue: 28, cPeak: 0.2, noir: true },
  { lettre: 'G', label: 'gris', hue: 0, cPeak: 0, noir: false },
];

export function construitPalette(): Palette {
  const gammes: Record<string, Gamme> = {};
  for (const d of DEFS) {
    const nuances: string[] = [];
    for (let n = 1; n <= NUANCES; n++) {
      nuances.push(oklchToHex(lightness(n), chroma(d.cPeak, n), d.hue));
    }
    const g: Gamme = { label: d.label, nuances };
    if (d.noir) g.noir = oklchToHex(0.2, 0.035, d.hue);
    gammes[d.lettre] = g;
  }
  gammes.K = { label: 'noir', nuances: ['#111111'] };
  gammes.W = { label: 'blanc', nuances: ['#f4f2ee'] };
  return {
    id: 'alphabet-6x12',
    label: 'Alphabet 6 x 12 — OKLCH approximations of named hues (not historical pigments)',
    gammes,
  };
}

const sortie = resolve(process.cwd(), 'src/palette/alphabet-6x12.json');
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, `${JSON.stringify(construitPalette(), null, 2)}\n`, 'utf8');
console.log(`wrote ${sortie}`);
