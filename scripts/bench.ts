/**
 * Performance target of SPEC Section 12: 64x64 modules of 5x5 unites
 * (102 400 unites, 3 etages) generates in < 1 s and renders in < 2 s.
 */

import process from 'node:process';
import type { Params } from '../src/core/types.js';
import { generate } from '../src/index.js';
import { getPalette } from '../src/palette/index.js';
import { renderSVG } from '../src/render/svg.js';

export const paramsBench: Params = {
  version: 1,
  seed: 'bench-01',
  palette: 'alphabet-6x12',
  champ: { modulesX: 64, modulesY: 64 },
  module: { colonnes: 5, rangees: 5 },
  parcours: { inter: { type: 'rayonnement' }, intra: { type: 'boustrophedon' } },
  unite: { etages: 3, joint: 0.04 },
  inversion: { mode: 'permutation', amplitude: 0.4, niveau: 'intra' },
  etages: [
    {
      couleur: {
        gamme: {
          base: 'B',
          inter: { mode: 'permutation', amplitude: 0.6, ensemble: ['B', 'R', 'J', 'V'] },
        },
        nuance: { base: 6, intra: { mode: 'aleatoire', amplitude: 0.3 } },
      },
    },
    {
      couleur: { gamme: { base: 'W' }, nuance: { base: 1 } },
      forme: {
        type: {
          base: 'c',
          intra: { mode: 'aleatoire', amplitude: 0.7, ensemble: ['c', 'o', 'l', 't', 'r', 'e'] },
        },
        grandeur: { base: 22, inter: { mode: 'progression', amplitude: 0.3 } },
        rotation: { base: 0, intra: { mode: 'aleatoire', amplitude: 0.3 } },
      },
    },
    {
      couleur: { gamme: { base: 'K' }, nuance: { base: 1 } },
      forme: {
        type: { base: 'o' },
        grandeur: { base: 14, intra: { mode: 'progression', amplitude: 0.25, onde: 'sinus' } },
      },
    },
  ],
};

const t0 = performance.now();
const prog = generate(paramsBench);
const t1 = performance.now();
const svg = renderSVG(prog, getPalette('alphabet-6x12'), { joint: paramsBench.unite.joint ?? 0 });
const t2 = performance.now();

const ms = (n: number): string => `${n.toFixed(0)} ms`;
process.stdout.write(
  [
    `unites:   ${prog.unites.length}`,
    `etages:   ${paramsBench.unite.etages} (fond + ${prog.unites[0]?.etages.length ?? 0} noyaux)`,
    `generate: ${ms(t1 - t0)}  (target < 1000 ms)`,
    `render:   ${ms(t2 - t1)}  (target < 2000 ms)`,
    `svg:      ${(svg.length / 1e6).toFixed(1)} MB`,
    '',
  ].join('\n'),
);
