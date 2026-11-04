import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SORTIE, construitExemple, nomsExemples } from '../scripts/examples.js';
import { decode } from '../src/notation/decode.js';
import { encode } from '../src/notation/encode.js';
import { validate } from '../src/validate/validate.js';

const noms = nomsExemples();

function golden(nom: string, ext: string): string {
  return readFileSync(join(SORTIE, `${nom}.${ext}`), 'utf8');
}

describe('examples', () => {
  it('ships the four profiles of SPEC Section 6.6', () => {
    expect(noms).toEqual(['constant', 'glissement', 'module', 'radical']);
  });

  for (const nom of noms) {
    describe(nom, () => {
      const s = construitExemple(nom);

      it('has valid params', () => {
        expect(validate(s.params).ok).toBe(true);
      });

      it('matches the committed canonical JSON', () => {
        expect(s.json).toBe(golden(nom, 'json'));
      });

      it('matches the committed notation', () => {
        expect(s.notation).toBe(golden(nom, 'txt'));
      });

      it('matches the committed SVG', () => {
        expect(s.svg).toBe(golden(nom, 'svg'));
      });

      it('round-trips through the notation', () => {
        expect(encode(decode(s.notation))).toBe(s.notation);
      });

      it('fills the champ exactly once', () => {
        const cellules = new Set<number>();
        for (const u of s.programmation.unites) {
          for (let dy = 0; dy < u.echelle; dy++) {
            for (let dx = 0; dx < u.echelle; dx++) {
              const k = (u.y + dy) * s.programmation.largeur + (u.x + dx);
              expect(cellules.has(k)).toBe(false);
              cellules.add(k);
            }
          }
        }
        expect(cellules.size).toBe(s.programmation.largeur * s.programmation.hauteur);
      });
    });
  }

  it('places echelle-2 modules in the radical profile only', () => {
    const grands = (nom: string): number =>
      construitExemple(nom).programmation.unites.filter((u) => u.echelle === 2).length;
    expect(grands('radical')).toBeGreaterThan(0);
    for (const nom of ['constant', 'glissement', 'module']) expect(grands(nom)).toBe(0);
  });
});
