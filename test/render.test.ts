import { describe, expect, it } from 'vitest';
import type { FormePlacee, Programmation, UnitePlacee } from '../src/core/types.js';
import { generate } from '../src/index.js';
import { getPalette } from '../src/palette/index.js';
import { hexDeCouleur, renderSVG } from '../src/render/svg.js';
import { exempleAleatoire, paletteTest } from './fixtures.js';

const palette = getPalette('alphabet-6x12');

const forme = (f: Partial<FormePlacee>): FormePlacee => ({
  type: 'c',
  grandeur: 30,
  rotation: 0,
  aspect: 1,
  cisaillement: 0,
  ...f,
});

function prog(u: Partial<UnitePlacee>, largeur = 1, hauteur = 1): Programmation {
  return {
    version: 1,
    seed: 's',
    palette: 'alphabet-6x12',
    largeur,
    hauteur,
    unites: [{ x: 0, y: 0, echelle: 1, module: [0, 0], fond: 'K1', etages: [], ...u }],
    diagnostics: { contrasteCorrections: 0, avertissements: [] },
  };
}

/** The element lines of the single unite, without the <g>/</g> wrapper. */
function corps(svg: string): string[] {
  const l = svg.split('\n');
  const i = l.findIndex((x) => x.startsWith('<g '));
  return l.slice(i + 1, l.indexOf('</g>', i));
}

describe('hexDeCouleur', () => {
  it('resolves nuances and noir colore', () => {
    expect(hexDeCouleur(palette, 'K1')).toBe('#111111');
    expect(hexDeCouleur(palette, 'W1')).toBe('#f4f2ee');
    expect(hexDeCouleur(palette, 'B7')).toBe(palette.gammes.B?.nuances[6]);
    expect(hexDeCouleur(palette, 'RN')).toBe(palette.gammes.R?.noir);
  });

  it('rejects codes the palette cannot serve', () => {
    expect(() => hexDeCouleur(palette, 'Z1')).toThrow(/no gamme/);
    expect(() => hexDeCouleur(palette, 'K9')).toThrow(/nuance out of range/);
    expect(() => hexDeCouleur(paletteTest, 'BN')).toThrow(/no noir/);
  });
});

describe('document', () => {
  it('writes the viewBox in base units and the size from taille', () => {
    const svg = renderSVG(prog({}, 3, 2), palette, { taille: 10 });
    expect(svg.split('\n')[0]).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" width="30" height="20" preserveAspectRatio="xMidYMid slice">',
    );
    expect(svg.endsWith('</svg>\n')).toBe(true);
  });

  it('defaults taille to 24 and honours preserveAspectRatio', () => {
    const svg = renderSVG(prog({}, 2, 2), palette, { preserveAspectRatio: 'none' });
    expect(svg).toContain('width="48" height="48"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('emits a title only when asked, with escaping', () => {
    expect(renderSVG(prog({}), palette)).not.toContain('<title>');
    expect(renderSVG(prog({}), palette, { titre: 'a & b <c>' })).toContain(
      '<title>a &amp; b &lt;c&gt;</title>',
    );
  });

  it('fills the joint gap with fondJoint', () => {
    const svg = renderSVG(prog({}), palette, { fondJoint: 'W1' });
    expect(svg.split('\n')[1]).toBe(
      '<rect x="0" y="0" width="1" height="1" fill="#f4f2ee" shape-rendering="crispEdges"/>',
    );
  });

  it('wraps every unite in a translated <g>', () => {
    const p = prog({});
    p.unites.push({ x: 1, y: 0, echelle: 1, module: [0, 0], fond: 'W1', etages: [] });
    const svg = renderSVG(p, palette, {});
    expect(svg).toContain('<g transform="translate(0,0)">');
    expect(svg).toContain('<g transform="translate(1,0)">');
    expect(svg.match(/<g /g)?.length).toBe(2);
  });
});

describe('fond', () => {
  it('fills the whole unite square when there is no joint', () => {
    expect(corps(renderSVG(prog({}), palette))).toEqual([
      '<rect x="0" y="0" width="1" height="1" fill="#111111" shape-rendering="crispEdges"/>',
    ]);
  });

  it('insets the fond by the joint, centred', () => {
    expect(corps(renderSVG(prog({}), palette, { joint: 0.1 }))).toEqual([
      '<rect x="0.05" y="0.05" width="0.9" height="0.9" fill="#111111" shape-rendering="crispEdges"/>',
    ]);
  });

  it('scales with echelle', () => {
    expect(corps(renderSVG(prog({ echelle: 2 }), palette, { joint: 0.1 }))).toEqual([
      '<rect x="0.1" y="0.1" width="1.8" height="1.8" fill="#111111" shape-rendering="crispEdges"/>',
    ]);
  });
});

describe('formes', () => {
  const avec = (f: Partial<FormePlacee>): string =>
    corps(renderSVG(prog({ etages: [{ forme: forme(f), couleur: 'W1' }] }), palette))[1] as string;

  it('emits a rect for carre and rectangle, with crispEdges', () => {
    expect(avec({ type: 'c' })).toBe(
      '<rect x="0" y="0" width="1" height="1" fill="#f4f2ee" shape-rendering="crispEdges"/>',
    );
    expect(avec({ type: 'r', aspect: 0.6 })).toBe(
      '<rect x="0.2" y="0" width="0.6" height="1" fill="#f4f2ee" shape-rendering="crispEdges"/>',
    );
  });

  it('emits a circle when the radii are equal and an ellipse otherwise', () => {
    expect(avec({ type: 'o' })).toBe('<circle cx="0.5" cy="0.5" r="0.5" fill="#f4f2ee"/>');
    expect(avec({ type: 'o', aspect: 0.5 })).toBe(
      '<ellipse cx="0.5" cy="0.5" rx="0.25" ry="0.5" fill="#f4f2ee"/>',
    );
    expect(avec({ type: 'e', aspect: 1 })).toBe(
      '<circle cx="0.5" cy="0.5" r="0.5" fill="#f4f2ee"/>',
    );
  });

  it('emits polygons for losange and triangle', () => {
    expect(avec({ type: 'l' })).toBe('<polygon points="0.5,0 1,0.5 0.5,1 0,0.5" fill="#f4f2ee"/>');
    expect(avec({ type: 't' })).toBe('<polygon points="0.5,0 1,1 0,1" fill="#f4f2ee"/>');
  });

  it('sizes the forme from grandeur / 30 of the parent box', () => {
    expect(avec({ grandeur: 15 })).toBe(
      '<rect x="0.25" y="0.25" width="0.5" height="0.5" fill="#f4f2ee" shape-rendering="crispEdges"/>',
    );
  });

  it('nests etage 2 in the box of etage 1', () => {
    const lignes = corps(
      renderSVG(
        prog({
          etages: [
            { forme: forme({ type: 'c', grandeur: 30 }), couleur: 'W1' },
            { forme: forme({ type: 'c', grandeur: 15 }), couleur: 'K1' },
          ],
        }),
        palette,
      ),
    );
    // carre box factor 1, so etage 2 is 15/30 of the unite square.
    expect(lignes[2]).toBe(
      '<rect x="0.25" y="0.25" width="0.5" height="0.5" fill="#111111" shape-rendering="crispEdges"/>',
    );
  });

  it('shrinks the box through a cercle parent (1/sqrt 2)', () => {
    const lignes = corps(
      renderSVG(
        prog({
          etages: [
            { forme: forme({ type: 'o', grandeur: 30 }), couleur: 'W1' },
            { forme: forme({ type: 'c', grandeur: 30 }), couleur: 'K1' },
          ],
        }),
        palette,
      ),
    );
    // 1/sqrt(2) = 0.7071..., centred: 0.5 - 0.7071/2 = 0.1464...
    expect(lignes[2]).toBe(
      '<rect x="0.1464" y="0.1464" width="0.7071" height="0.7071" fill="#111111" shape-rendering="crispEdges"/>',
    );
  });
});

describe('transform', () => {
  const avec = (f: Partial<FormePlacee>): string =>
    corps(renderSVG(prog({ etages: [{ forme: forme(f), couleur: 'W1' }] }), palette))[1] as string;

  it('is omitted when the forme is untransformed', () => {
    expect(avec({})).not.toContain('transform');
    expect(avec({ rotation: 360 })).not.toContain('transform');
  });

  it('rotates clockwise about the forme centre', () => {
    expect(avec({ rotation: 90 })).toContain('transform="matrix(0,1,-1,0,1,0)"');
  });

  it('shears horizontally about the forme centre', () => {
    expect(avec({ cisaillement: 0.5 })).toContain('transform="matrix(1,0,0.5,1,-0.25,0)"');
  });

  it('applies the shear first, then the rotation', () => {
    // With theta = 90: a=0, b=1, c = s*cos - sin = -1, d = s*sin + cos = s.
    expect(avec({ rotation: 90, cisaillement: 0.4 })).toContain('matrix(0,1,-1,0.4,1,-0.2)');
  });
});

describe('output contract', () => {
  it('is byte-identical across runs', () => {
    const p = generate(exempleAleatoire());
    expect(renderSVG(p, palette, { joint: 0.05 })).toBe(renderSVG(p, palette, { joint: 0.05 }));
  });

  it('never writes more than 4 decimals', () => {
    const svg = renderSVG(generate(exempleAleatoire()), palette, { joint: 0.05 });
    expect(svg.match(/\d+\.\d{5,}/)).toBe(null);
  });

  it('uses crispEdges on rectangles only', () => {
    const svg = renderSVG(generate(exempleAleatoire()), palette, { joint: 0.05 });
    for (const ligne of svg.split('\n')) {
      if (ligne.includes('crispEdges')) expect(ligne.startsWith('<rect ')).toBe(true);
    }
  });
});
