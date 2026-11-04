import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { paramsSchema } from '../src/validate/schema.js';
import {
  CLES_AXIS,
  CLES_CHAMP,
  CLES_CONTRASTE,
  CLES_COULEUR,
  CLES_ECHELLE,
  CLES_ETAGE,
  CLES_FORME,
  CLES_GAMME,
  CLES_INVERSION,
  CLES_MODULE,
  CLES_PALETTE,
  CLES_PARAMS,
  CLES_PARCOURS,
  CLES_UNITE,
  CLES_VARIATION,
} from '../src/validate/validate.js';

type Noeud = Record<string, unknown>;

const defs = paramsSchema.$defs as Record<string, Noeud>;
const props = (n: Noeud): string[] => Object.keys(n.properties as Noeud).sort();
const trie = (l: readonly string[]) => [...l].sort();

describe('schema / type sync', () => {
  it('committed schema/params.schema.json matches paramsSchema', () => {
    const fichier = readFileSync(resolve(process.cwd(), 'schema/params.schema.json'), 'utf8');
    expect(fichier).toBe(`${JSON.stringify(paramsSchema, null, 2)}\n`);
  });

  it('every object in the schema exposes exactly the validator key list', () => {
    const paires: [Noeud, readonly string[]][] = [
      [paramsSchema as Noeud, CLES_PARAMS],
      [(paramsSchema.properties as Noeud).champ as Noeud, CLES_CHAMP],
      [(paramsSchema.properties as Noeud).module as Noeud, CLES_MODULE],
      [(paramsSchema.properties as Noeud).unite as Noeud, CLES_UNITE],
      [(paramsSchema.properties as Noeud).contraste as Noeud, CLES_CONTRASTE],
      [defs.variationNumerique as Noeud, CLES_VARIATION],
      [defs.variationGamme as Noeud, CLES_VARIATION],
      [defs.variationType as Noeud, CLES_VARIATION],
      [defs.axeNuance as Noeud, CLES_AXIS],
      [defs.axeGamme as Noeud, CLES_AXIS],
      [defs.parcours as Noeud, CLES_PARCOURS],
      [defs.echelle as Noeud, CLES_ECHELLE],
      [defs.inversion as Noeud, CLES_INVERSION],
      [defs.etage as Noeud, CLES_ETAGE],
      [(defs.etage!.properties as Noeud).couleur as Noeud, CLES_COULEUR],
      [defs.forme as Noeud, CLES_FORME],
      [defs.palette as Noeud, CLES_PALETTE],
      [defs.gamme as Noeud, CLES_GAMME],
    ];
    for (const [noeud, cles] of paires) {
      expect(props(noeud)).toEqual(trie(cles));
      expect(noeud.additionalProperties).toBe(false);
    }
  });

  it('every required key is also a declared property', () => {
    const visite = (n: unknown): void => {
      if (typeof n !== 'object' || n === null) return;
      if (Array.isArray(n)) {
        for (const x of n) visite(x);
        return;
      }
      const o = n as Noeud;
      if (Array.isArray(o.required) && o.properties) {
        for (const k of o.required as string[]) {
          expect(Object.keys(o.properties as Noeud)).toContain(k);
        }
      }
      for (const v of Object.values(o)) visite(v);
    };
    visite(paramsSchema);
  });

  it('every $ref points at an existing $def', () => {
    const noms = new Set(Object.keys(defs));
    const visite = (n: unknown): void => {
      if (typeof n !== 'object' || n === null) return;
      if (Array.isArray(n)) {
        for (const x of n) visite(x);
        return;
      }
      const o = n as Noeud;
      if (typeof o.$ref === 'string') {
        expect(noms).toContain(o.$ref.replace('#/$defs/', ''));
      }
      for (const v of Object.values(o)) visite(v);
    };
    visite(paramsSchema);
  });
});
