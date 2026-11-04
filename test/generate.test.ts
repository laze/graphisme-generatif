import { describe, expect, it } from 'vitest';
import { ParamsError } from '../src/core/generate.js';
import type { Params, UnitePlacee } from '../src/core/types.js';
import { generate } from '../src/index.js';
import { exempleAleatoire, exempleTravaille } from './fixtures.js';

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe('determinism', () => {
  it('produces byte-identical canonical JSON for identical params', () => {
    for (const p of [exempleTravaille(), exempleAleatoire()]) {
      const a = JSON.stringify(generate(clone(p)));
      const b = JSON.stringify(generate(clone(p)));
      expect(a).toBe(b);
    }
  });

  it('changes with the seed', () => {
    const p = exempleAleatoire();
    const a = JSON.stringify(generate({ ...p, seed: 'un' }));
    const b = JSON.stringify(generate({ ...p, seed: 'deux' }));
    expect(a).not.toBe(b);
  });

  it('does not depend on the order of optional keys in params', () => {
    const p = exempleTravaille();
    const reordonne: Params = {
      etages: p.etages,
      unite: p.unite,
      parcours: p.parcours,
      module: p.module,
      champ: p.champ,
      palette: p.palette,
      seed: p.seed,
      version: p.version,
    };
    expect(JSON.stringify(generate(reordonne))).toBe(JSON.stringify(generate(p)));
  });
});

describe('structure', () => {
  it('fills the champ exactly once, sorted by y then x', () => {
    const p = exempleAleatoire();
    const prog = generate(p);
    expect(prog.largeur).toBe(p.champ.modulesX * p.module.colonnes);
    expect(prog.hauteur).toBe(p.champ.modulesY * p.module.rangees);

    const couvert = new Set<number>();
    for (const u of prog.unites) {
      for (let dy = 0; dy < u.echelle; dy++) {
        for (let dx = 0; dx < u.echelle; dx++) {
          const k = (u.y + dy) * prog.largeur + (u.x + dx);
          expect(couvert.has(k)).toBe(false);
          couvert.add(k);
        }
      }
    }
    expect(couvert.size).toBe(prog.largeur * prog.hauteur);

    for (let i = 1; i < prog.unites.length; i++) {
      const a = prog.unites[i - 1] as UnitePlacee;
      const b = prog.unites[i] as UnitePlacee;
      expect(a.y < b.y || (a.y === b.y && a.x < b.x)).toBe(true);
    }
  });

  it('gives every unite one fond and etages - 1 nested formes', () => {
    const prog = generate(exempleAleatoire());
    for (const u of prog.unites) {
      expect(u.fond).toMatch(/^[A-Z](N|\d{1,2})$/);
      expect(u.etages).toHaveLength(2);
      for (const e of u.etages) {
        expect(e.couleur).toMatch(/^[A-Z](N|\d{1,2})$/);
        expect(e.forme.grandeur).toBeGreaterThanOrEqual(1);
        expect(e.forme.grandeur).toBeLessThanOrEqual(30);
        expect(e.forme.rotation).toBeGreaterThanOrEqual(0);
        expect(e.forme.rotation).toBeLessThan(360);
        expect(e.forme.aspect).toBeGreaterThanOrEqual(0.2);
        expect(e.forme.aspect).toBeLessThanOrEqual(1);
      }
    }
  });

  it('respects the contrast rule everywhere', () => {
    const prog = generate(exempleAleatoire());
    const nuance = (code: string) => (code[1] === 'N' ? 13 : Number.parseInt(code.slice(1), 10));
    for (const u of prog.unites) {
      const chaine = [u.fond, ...u.etages.map((e) => e.couleur)];
      for (let k = 0; k + 1 < chaine.length; k++) {
        const a = chaine[k] as string;
        const b = chaine[k + 1] as string;
        if (a[0] === b[0]) expect(Math.abs(nuance(a) - nuance(b))).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('turns carres into losanges from the centre outwards on the worked example', () => {
    const prog = generate(exempleTravaille());
    const rotations = new Set(prog.unites.map((u) => u.etages[0]!.forme.rotation));
    expect(rotations.has(0)).toBe(true);
    expect(rotations.has(45)).toBe(true);
  });
});

describe('stream isolation', () => {
  function nuancesFond(p: Params): string[] {
    return generate(p).unites.map((u) => u.fond);
  }

  it('changing one axis rule leaves another axis unchanged', () => {
    const base = exempleAleatoire();
    const avant = nuancesFond(base);

    const modifie = clone(base);
    // touch only etage 2's grandeur rule
    modifie.etages[2]!.forme!.grandeur.intra = { mode: 'aleatoire', amplitude: 0.9 };
    expect(nuancesFond(modifie)).toEqual(avant);
  });

  it('adding a rule on a different etage does not move another etage draws', () => {
    const base = exempleAleatoire();
    const formes = generate(base).unites.map((u) => u.etages[0]!.forme.type);

    const modifie = clone(base);
    modifie.etages[0]!.couleur.nuance.intra = { mode: 'aleatoire', amplitude: 0.9 };
    expect(generate(modifie).unites.map((u) => u.etages[0]!.forme.type)).toEqual(formes);
  });

  it('changing the inter parcours does not disturb intra draws within a module', () => {
    const base = exempleAleatoire();
    base.echelle = { mode: 'constant', part: 0 };
    const avant = generate(base).unites.map((u) => u.etages[0]!.forme.type);

    const modifie = clone(base);
    modifie.parcours.inter = { type: 'lignes' };
    const apres = generate(modifie).unites.map((u) => u.etages[0]!.forme.type);
    // same module grid, same intra streams: the multiset of types is unchanged
    expect([...avant].sort()).toEqual([...apres].sort());
  });
});

describe('inversion', () => {
  it('swaps fond and etage 1 colours for the whole module at niveau inter', () => {
    // Different gammes on the two etages, so the contrast rule never fires and
    // the swap is observable on its own.
    const base = exempleTravaille();
    base.etages[1]!.couleur.gamme.base = 'J';
    const p = clone(base);
    p.inversion = { mode: 'constant', amplitude: 1, niveau: 'inter' };

    const droit = generate(base);
    const inverse = generate(p);
    expect(inverse.diagnostics.contrasteCorrections).toBe(0);
    for (let i = 0; i < droit.unites.length; i++) {
      const a = droit.unites[i] as UnitePlacee;
      const b = inverse.unites[i] as UnitePlacee;
      expect(b.fond).toBe(a.etages[0]!.couleur);
      expect(b.etages[0]!.couleur).toBe(a.fond);
    }
  });

  it('does nothing at amplitude 0', () => {
    const p = exempleTravaille();
    p.inversion = { mode: 'aleatoire', amplitude: 0, niveau: 'intra' };
    expect(JSON.stringify(generate(p).unites)).toBe(
      JSON.stringify(generate(exempleTravaille()).unites),
    );
  });
});

describe('errors', () => {
  it('throws ParamsError with JSON paths on invalid params', () => {
    const p = exempleTravaille() as unknown as Record<string, unknown>;
    p.champ = { modulesX: 0, modulesY: 4 };
    try {
      generate(p as unknown as Params);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ParamsError);
      expect((e as ParamsError).erreurs[0]?.chemin).toBe('/champ/modulesX');
    }
  });

  it('rejects a gamme that the palette does not define', () => {
    const p = exempleTravaille();
    p.etages[0]!.couleur.gamme.base = 'Z';
    expect(() => generate(p)).toThrow(ParamsError);
  });
});
