import type { Palette, Params } from '../src/core/types.js';

/** The worked example of SPEC Section 8. */
export function exempleTravaille(): Params {
  return {
    version: 1,
    seed: 'atelier-01',
    palette: 'alphabet-6x12',
    champ: { modulesX: 6, modulesY: 4 },
    module: { colonnes: 3, rangees: 3 },
    parcours: {
      inter: { type: 'rayonnement' },
      intra: { type: 'lignes' },
    },
    unite: { etages: 2 },
    etages: [
      {
        couleur: {
          gamme: { base: 'B' },
          nuance: { base: 3, inter: { mode: 'progression', amplitude: 0.5 } },
        },
      },
      {
        couleur: {
          gamme: { base: 'B' },
          nuance: {
            base: 9,
            intra: { mode: 'progression', amplitude: 0.15, onde: 'triangle' },
          },
        },
        forme: {
          type: { base: 'c' },
          grandeur: { base: 20 },
          rotation: { base: 0, inter: { mode: 'progression', amplitude: 0.125 } },
        },
      },
    ],
  };
}

/** A params set that exercises every random mode at both levels. */
export function exempleAleatoire(): Params {
  return {
    version: 1,
    seed: 'graine-test',
    palette: 'alphabet-6x12',
    champ: { modulesX: 4, modulesY: 3 },
    module: { colonnes: 2, rangees: 2 },
    echelle: { mode: 'aleatoire', part: 0.4 },
    parcours: {
      inter: { type: 'spirale' },
      intra: { type: 'boustrophedon' },
    },
    unite: { etages: 3, joint: 0.05 },
    inversion: { mode: 'aleatoire', amplitude: 0.3, niveau: 'intra' },
    contraste: { minNuance: 3 },
    etages: [
      {
        couleur: {
          gamme: {
            base: 'B',
            inter: { mode: 'permutation', amplitude: 0.6, ensemble: ['B', 'R', 'J'], pas: 1 },
          },
          nuance: { base: 4, intra: { mode: 'aleatoire', amplitude: 0.3 } },
        },
      },
      {
        couleur: {
          gamme: { base: 'J', intra: { mode: 'aleatoire', amplitude: 0.5, ensemble: ['J', 'V'] } },
          nuance: { base: 9, inter: { mode: 'progression', amplitude: 0.3, onde: 'sinus' } },
        },
        forme: {
          type: {
            base: 'c',
            intra: { mode: 'permutation', amplitude: 0.5, ensemble: ['c', 'o', 'l', 't'] },
          },
          grandeur: { base: 22, inter: { mode: 'aleatoire', amplitude: 0.2 } },
          rotation: { base: 0, intra: { mode: 'progression', amplitude: 0.1 } },
        },
      },
      {
        couleur: {
          gamme: { base: 'W' },
          nuance: { base: 1 },
        },
        forme: {
          type: { base: 'o' },
          grandeur: { base: 14, intra: { mode: 'aleatoire', amplitude: 0.25 } },
          aspect: { base: 1, inter: { mode: 'progression', amplitude: 0.4, sens: -1 } },
          cisaillement: { base: 0, intra: { mode: 'aleatoire', amplitude: 0.3 } },
        },
      },
    ],
  };
}

export const paletteTest: Palette = {
  id: 'test',
  label: 'test',
  gammes: {
    A: {
      label: 'a',
      nuances: ['#000000', '#111111', '#222222', '#333333', '#444444'],
      noir: '#010101',
    },
    B: { label: 'b', nuances: ['#555555', '#666666'] },
  },
};
