# Graphisme Génératif

Generative graphics based on Victor Vasarely's *programmation* principles: recursive *unités plastiques* (fond + noyau), colour *gammes* and *nuances*, permutation and progression rules. A deterministic, seed-driven TypeScript core outputs a letter–number *programmation*, rendered to SVG.

> **Status:** core, notation, validator, renderer and CLI implemented. See [SPEC.md](SPEC.md) for the full specification and [examples/](examples) for ready-made parameter files and their output.

## How it works

The generator separates two stages, as the historical method did:

1. **Programmation** — parameters and a seed go in; a coded grid comes out. Every cell is a *unité*: a coloured square (*fond*) carrying up to two nested forms (*noyaux*) from a six-form alphabet. Units are grouped into *modules* (2×2, 3×3, 5×5 …), modules into the *champ*. Each property — form, size, rotation, colour scale, value — is varied by explicit rules: constant, progression, permutation or seeded randomness, along a chosen traversal order (rows, spiral, concentric radiation …), separately within modules and across them.
2. **Réalisation** — the coded grid is rendered to SVG. Rendering makes no decisions.

The same parameters and seed always produce the same result, byte for byte. A programmation can be exported as a compact text code, e.g. `R4>c24:K1>r14x0.5s0.2:J2`.

```ts
import { generate, renderSVG, getPalette, encode } from 'graphisme-generatif';

const p = generate(params);
const svg = renderSVG(p, getPalette('alphabet-6x12'));
const code = encode(p);
```

From the command line:

```
graphisme-generatif generate examples/glissement.json --out out.svg --notation out.txt
graphisme-generatif render out.txt --out again.svg --taille 32
graphisme-generatif validate examples/radical.json
```

## Playground

`npm run playground` builds the bundle and serves a single static page at
<http://localhost:5173/playground/>: edit the params on the left with live validation, step or
randomise the seed, and download the SVG, the canonical JSON or the notation.

## Independence statement

This is an independent research experiment. It is **not affiliated with, endorsed by or approved by** the Fondation Vasarely (Aix-en-Provence), the Michèle Vasarely Foundation, the heirs of Victor Vasarely, or ADAGP.

- The software implements a *method* — a rule system for combining forms and colours — as described in published sources. It contains no reproductions of Vasarely's works, and it is not trained on images of them.
- Generated images are new compositions. They are not works by Victor Vasarely and must not be presented as such.
- No preset, example or test aims to reproduce a specific artwork, and none is named after one.
- The default palette is an approximation of named hues computed in OKLCH; it is not a reproduction of historical pigments.

## Sources

- Michèle Vasarely Foundation — *Periods* (text by Arnauld Pierre) and *Programmations*: https://vasarely.com/artist/vasarely/periods, https://vasarely.com/artist/vasarely/programmations
- Centre Pompidou — *Victor Vasarely, archi-total*: https://www.centrepompidou.fr/fr/pompidou-plus/magazine/article/victor-vasarely-archi-total
- Encyclopædia Universalis — *Vasarely Victor*: https://www.universalis.fr/encyclopedie/victor-vasarely/

## License

Code: [MIT](LICENSE). Images you generate are yours.
