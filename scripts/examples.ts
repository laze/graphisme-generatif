/**
 * Shared by `scripts/build-examples.ts` (which writes `examples/out/`) and by
 * the golden snapshot test (which compares against it), so the two can never
 * drift apart.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { Palette, Params, Programmation } from '../src/core/types.js';
import { generate } from '../src/index.js';
import { encode } from '../src/notation/encode.js';
import { getPalette } from '../src/palette/index.js';
import { renderSVG } from '../src/render/svg.js';

export const DOSSIER = resolve(process.cwd(), 'examples');
export const SORTIE = join(DOSSIER, 'out');

export interface SortiesExemple {
  params: Params;
  programmation: Programmation;
  json: string;
  svg: string;
  notation: string;
}

/** Example names, sorted, without the `.json` extension. */
export function nomsExemples(): string[] {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

function palettePour(p: Programmation): Palette {
  return p.paletteInline ?? getPalette(p.palette);
}

export function construitExemple(nom: string): SortiesExemple {
  const params = JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), 'utf8')) as Params;
  const programmation = generate(params);
  return {
    params,
    programmation,
    json: `${JSON.stringify(programmation)}\n`,
    svg: renderSVG(programmation, palettePour(programmation), {
      joint: params.unite.joint ?? 0,
    }),
    notation: encode(programmation),
  };
}
