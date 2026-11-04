import { describe, expect, it } from 'vitest';
import type { Params } from '../src/core/types.js';
import { validate } from '../src/validate/validate.js';
import { exempleAleatoire, exempleTravaille, paletteTest } from './fixtures.js';

function erreurs(p: unknown): string[] {
  const r = validate(p);
  return r.ok ? [] : r.erreurs.map((e) => `${e.chemin}:${e.code}`);
}

function casse(muter: (p: Record<string, unknown>) => void): string[] {
  const p = exempleTravaille() as unknown as Record<string, unknown>;
  muter(p);
  return erreurs(p);
}

describe('valid params', () => {
  it('accepts the worked example and the random example', () => {
    expect(validate(exempleTravaille()).ok).toBe(true);
    expect(validate(exempleAleatoire()).ok).toBe(true);
  });

  it('accepts an inline palette', () => {
    const p = exempleTravaille();
    p.palette = paletteTest;
    p.etages[0]!.couleur.gamme.base = 'A';
    p.etages[1]!.couleur.gamme.base = 'A';
    expect(validate(p).ok).toBe(true);
  });
});

describe('invalid params', () => {
  it('rejects a non-object', () => {
    expect(erreurs(null)).toEqual([':type']);
    expect(erreurs(42)).toEqual([':type']);
  });

  it('reports unknown keys with their path', () => {
    expect(casse((p) => Object.assign(p, { couleurs: 1 }))).toContain('/couleurs:cle-inconnue');
  });

  it('checks version and seed', () => {
    expect(casse((p) => Object.assign(p, { version: 2 }))).toContain('/version:version');
    expect(casse((p) => Object.assign(p, { seed: '' }))).toContain('/seed:type');
    expect(casse((p) => Object.assign(p, { seed: 7 }))).toContain('/seed:type');
  });

  it('checks champ and module bounds', () => {
    expect(casse((p) => Object.assign(p, { champ: { modulesX: 0, modulesY: 4 } }))).toContain(
      '/champ/modulesX:plage',
    );
    expect(casse((p) => Object.assign(p, { champ: { modulesX: 65, modulesY: 4 } }))).toContain(
      '/champ/modulesX:plage',
    );
    expect(casse((p) => Object.assign(p, { module: { colonnes: 13, rangees: 3 } }))).toContain(
      '/module/colonnes:plage',
    );
    expect(casse((p) => Object.assign(p, { champ: { modulesX: 1.5, modulesY: 4 } }))).toContain(
      '/champ/modulesX:entier',
    );
  });

  it('checks the parcours enums', () => {
    expect(
      casse((p) => {
        (p.parcours as Record<string, unknown>).inter = { type: 'zigzag' };
      }),
    ).toContain('/parcours/inter/type:enum');
    expect(
      casse((p) => {
        (p.parcours as Record<string, unknown>).intra = { type: 'lignes', symetrie: 'diagonale' };
      }),
    ).toContain('/parcours/intra/symetrie:enum');
  });

  it('requires etages to match unite.etages', () => {
    expect(casse((p) => Object.assign(p, { unite: { etages: 3 } }))).toContain('/etages:longueur');
    expect(casse((p) => Object.assign(p, { unite: { etages: 4 } }))).toContain(
      '/unite/etages:enum',
    );
    expect(casse((p) => Object.assign(p, { unite: { etages: 2, joint: 0.5 } }))).toContain(
      '/unite/joint:plage',
    );
  });

  it('forbids a forme on etage 0 and requires one above it', () => {
    expect(
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[0] as Record<string, unknown>;
        e.forme = { type: { base: 'c' }, grandeur: { base: 10 } };
      }),
    ).toContain('/etages/0/forme:interdit');
    expect(
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[1] as Record<string, unknown>;
        e.forme = undefined;
      }),
    ).toContain('/etages/1/forme:requis');
  });

  it('checks axis ranges on base values', () => {
    expect(
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[0] as Record<string, unknown>;
        (e.couleur as Record<string, unknown>).nuance = { base: 20 };
      }),
    ).toContain('/etages/0/couleur/nuance/base:plage');
    expect(
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[1] as Record<string, unknown>;
        (e.forme as Record<string, unknown>).grandeur = { base: 0 };
      }),
    ).toContain('/etages/1/forme/grandeur/base:plage');
    expect(
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[0] as Record<string, unknown>;
        (e.couleur as Record<string, unknown>).gamme = { base: 'bb' };
      }),
    ).toContain('/etages/0/couleur/gamme/base:gamme');
  });

  it('checks variation fields', () => {
    const avec = (v: unknown) =>
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[0] as Record<string, unknown>;
        (e.couleur as Record<string, unknown>).nuance = { base: 3, inter: v };
      });
    expect(avec({ mode: 'spirale', amplitude: 0.5 })).toContain(
      '/etages/0/couleur/nuance/inter/mode:enum',
    );
    expect(avec({ mode: 'progression', amplitude: 2 })).toContain(
      '/etages/0/couleur/nuance/inter/amplitude:plage',
    );
    expect(avec({ mode: 'progression', amplitude: 0.5, onde: 'carre' })).toContain(
      '/etages/0/couleur/nuance/inter/onde:enum',
    );
    expect(avec({ mode: 'progression', amplitude: 0.5, sens: 0 })).toContain(
      '/etages/0/couleur/nuance/inter/sens:enum',
    );
    expect(avec({ mode: 'permutation', amplitude: 0.5 })).toContain(
      '/etages/0/couleur/nuance/inter/ensemble:requis',
    );
    expect(avec({ mode: 'permutation', amplitude: 0.5, ensemble: [], pas: 1 })).toContain(
      '/etages/0/couleur/nuance/inter/ensemble:type',
    );
    expect(avec({ mode: 'aleatoire', amplitude: 0.5, sens: 1 })).toContain(
      '/etages/0/couleur/nuance/inter/sens:inutile',
    );
  });

  it('requires an ensemble for non-constant categorical modes', () => {
    const avec = (v: unknown) =>
      casse((p) => {
        const e = (p.etages as Record<string, unknown>[])[1] as Record<string, unknown>;
        (e.forme as Record<string, unknown>).type = { base: 'c', intra: v };
      });
    expect(avec({ mode: 'progression', amplitude: 0.6 })).toContain(
      '/etages/1/forme/type/intra/ensemble:requis',
    );
    expect(avec({ mode: 'aleatoire', amplitude: 0.6 })).toContain(
      '/etages/1/forme/type/intra/ensemble:requis',
    );
    expect(avec({ mode: 'aleatoire', amplitude: 0.6, ensemble: ['c', 'z'] })).toContain(
      '/etages/1/forme/type/intra/ensemble/1:enum',
    );
  });

  it('checks echelle, contraste and inversion', () => {
    expect(
      casse((p) => Object.assign(p, { echelle: { mode: 'permutation', part: 0.5 } })),
    ).toContain('/echelle/mode:enum');
    expect(casse((p) => Object.assign(p, { echelle: { mode: 'constant', part: 2 } }))).toContain(
      '/echelle/part:plage',
    );
    expect(casse((p) => Object.assign(p, { contraste: { minNuance: 20 } }))).toContain(
      '/contraste/minNuance:plage',
    );
    expect(
      casse((p) =>
        Object.assign(p, { inversion: { mode: 'aleatoire', amplitude: 0.5, niveau: 'x' } }),
      ),
    ).toContain('/inversion/niveau:enum');
  });

  it('rejects inversion with a single etage', () => {
    const p = exempleTravaille() as unknown as Record<string, unknown>;
    p.unite = { etages: 1 };
    p.etages = [(p.etages as unknown[])[0]];
    p.inversion = { mode: 'constant', amplitude: 1, niveau: 'intra' };
    expect(erreurs(p)).toContain('/inversion:inutile');
  });

  it('validates an inline palette', () => {
    const p = exempleTravaille() as unknown as Record<string, unknown>;
    p.palette = { id: '', label: 'x', gammes: { a: { label: 'x', nuances: ['red'] } } };
    const e = erreurs(p);
    expect(e).toContain('/palette/id:type');
    expect(e).toContain('/palette/gammes/a:gamme');
    expect(e).toContain('/palette/gammes/a/nuances/0:hex');
  });

  it('collects every error, not just the first', () => {
    const p = { version: 2, seed: '' } as unknown as Params;
    const r = validate(p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.length).toBeGreaterThan(3);
  });
});
