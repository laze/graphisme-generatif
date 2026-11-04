import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aspectDefaut } from '../src/core/generate.js';
import { FORME_TYPES, type Programmation, type UnitePlacee } from '../src/core/types.js';
import { generate } from '../src/index.js';
import { MODULE_INCONNU, decode } from '../src/notation/decode.js';
import { encode, encodeToken, num } from '../src/notation/encode.js';
import { exempleAleatoire, exempleTravaille } from './fixtures.js';

/** A programmation minus what the notation does not carry (SPEC Section 9.2). */
function projete(p: Programmation): unknown {
  return {
    ...p,
    diagnostics: undefined,
    unites: p.unites.map((u) => ({ ...u, module: undefined })),
  };
}

const arbNum4 = (min: number, max: number) =>
  fc.integer({ min: Math.round(min * 10000), max: Math.round(max * 10000) }).map((n) => n / 10000);

const arbCouleur = fc
  .tuple(
    fc.constantFrom('A', 'B', 'J', 'K', 'R', 'V', 'W'),
    fc.oneof(fc.integer({ min: 1, max: 12 }).map(String), fc.constant('N')),
  )
  .map(([g, n]) => `${g}${n}`);

const arbForme = fc.record({
  type: fc.constantFrom(...FORME_TYPES),
  grandeur: fc.integer({ min: 1, max: 30 }),
  rotation: arbNum4(0, 359.9999),
  aspect: arbNum4(0.2, 1),
  cisaillement: arbNum4(-0.5, 0.5),
});

/** Builds a full, non-overlapping champ of the given size. */
const arbProgrammation = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !s.includes('\n')),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 0, max: 2 }),
    fc.array(fc.tuple(arbCouleur, fc.array(fc.tuple(arbForme, arbCouleur), { maxLength: 2 })), {
      minLength: 36,
      maxLength: 36,
    }),
    fc.array(fc.boolean(), { minLength: 36, maxLength: 36 }),
  )
  .map(([seed, largeur, hauteur, nEtages, cellules, grands]): Programmation => {
    const pris = new Set<number>();
    const unites: UnitePlacee[] = [];
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const k = y * largeur + x;
        if (pris.has(k)) continue;
        const c = cellules[k % cellules.length]!;
        const veut = grands[k % grands.length] === true;
        const place =
          veut &&
          x + 1 < largeur &&
          y + 1 < hauteur &&
          !pris.has(k + 1) &&
          !pris.has(k + largeur) &&
          !pris.has(k + largeur + 1);
        pris.add(k);
        if (place) {
          pris.add(k + 1);
          pris.add(k + largeur);
          pris.add(k + largeur + 1);
        }
        unites.push({
          x,
          y,
          echelle: place ? 2 : 1,
          module: [...MODULE_INCONNU],
          fond: c[0],
          etages: c[1]
            .slice(0, nEtages)
            .map(([forme, couleur]) => ({ forme: { ...forme }, couleur })),
        });
      }
    }
    return {
      version: 1,
      seed,
      palette: 'alphabet-6x12',
      largeur,
      hauteur,
      unites,
      diagnostics: { contrasteCorrections: 0, avertissements: [] },
    };
  });

describe('num', () => {
  it('uses minimal digits and a dot separator', () => {
    expect(num(0)).toBe('0');
    expect(num(45)).toBe('45');
    expect(num(0.5)).toBe('0.5');
    expect(num(-0.25)).toBe('-0.25');
    expect(num(0.123456)).toBe('0.1235');
    expect(num(-0)).toBe('0');
  });
});

describe('tokens', () => {
  it('leaves URL-safe seeds alone', () => {
    expect(encodeToken('atelier-01')).toBe('atelier-01');
    expect(encodeToken('a.b_c-1')).toBe('a.b_c-1');
  });

  it('percent-encodes everything else over UTF-8 bytes', () => {
    expect(encodeToken('a b')).toBe('a%20b');
    expect(encodeToken('é')).toBe('%C3%A9');
  });
});

describe('notation', () => {
  it('matches the shape of the SPEC example cell', () => {
    const u: UnitePlacee = {
      x: 0,
      y: 0,
      echelle: 1,
      module: [0, 0],
      fond: 'R4',
      etages: [
        {
          forme: { type: 'c', grandeur: 24, rotation: 0, aspect: 1, cisaillement: 0 },
          couleur: 'K1',
        },
        {
          forme: { type: 'r', grandeur: 14, rotation: 0, aspect: 0.5, cisaillement: 0.2 },
          couleur: 'J2',
        },
      ],
    };
    const p: Programmation = {
      version: 1,
      seed: 's',
      palette: 'alphabet-6x12',
      largeur: 1,
      hauteur: 1,
      unites: [u],
      diagnostics: { contrasteCorrections: 0, avertissements: [] },
    };
    expect(encode(p).split('\n')[1]).toBe('R4>c24:K1>r14x0.5s0.2:J2');
  });

  it('omits defaults, including the aspect default of the forme type', () => {
    for (const type of FORME_TYPES) {
      const p: Programmation = {
        version: 1,
        seed: 's',
        palette: 'p',
        largeur: 1,
        hauteur: 1,
        unites: [
          {
            x: 0,
            y: 0,
            echelle: 1,
            module: [0, 0],
            fond: 'B1',
            etages: [
              {
                forme: {
                  type,
                  grandeur: 10,
                  rotation: 0,
                  aspect: aspectDefaut(type),
                  cisaillement: 0,
                },
                couleur: 'J1',
              },
            ],
          },
        ],
        diagnostics: { contrasteCorrections: 0, avertissements: [] },
      };
      expect(encode(p).split('\n')[1]).toBe(`B1>${type}10:J1`);
    }
  });

  it('marks echelle-2 unites and the cells they cover', () => {
    const p = generate({ ...exempleAleatoire(), echelle: { mode: 'constant', part: 1 } });
    const texte = encode(p);
    expect(texte).toContain('2*');
    expect(texte).toContain(' . ');
    expect(decode(texte).unites.filter((u) => u.echelle === 2).length).toBe(
      p.unites.filter((u) => u.echelle === 2).length,
    );
  });

  it('refuses an inline palette', () => {
    const p = generate(exempleTravaille());
    expect(() => encode({ ...p, paletteInline: { id: 'x', label: 'x', gammes: {} } })).toThrow();
  });

  it('round-trips the generated examples', () => {
    for (const params of [exempleTravaille(), exempleAleatoire()]) {
      const p = generate(params);
      const s = encode(p);
      expect(encode(decode(s))).toBe(s);
      expect(projete(decode(s))).toEqual(projete(p));
    }
  });

  it('rejects malformed input', () => {
    expect(() => decode('')).toThrow();
    expect(() => decode('GG2 seed=a palette=b unites=1x1\nB1')).toThrow();
    expect(() => decode('GG1 seed=a palette=b unites=2x1\nB1')).toThrow();
    expect(() => decode('GG1 seed=a palette=b unites=1x1\nb1')).toThrow();
  });
});

describe('notation round-trip (property-based)', () => {
  it('encode(decode(s)) === s', () => {
    fc.assert(
      fc.property(arbProgrammation, (p) => {
        const s = encode(p);
        expect(encode(decode(s))).toBe(s);
      }),
      { numRuns: 300 },
    );
  });

  it('decode(encode(p)) equals p minus diagnostics and module', () => {
    fc.assert(
      fc.property(arbProgrammation, (p) => {
        expect(projete(decode(encode(p)))).toEqual(projete(p));
      }),
      { numRuns: 300 },
    );
  });
});
