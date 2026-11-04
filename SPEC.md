# Graphisme Génératif — Specification v1

Status: draft for implementation · Language of the codebase: TypeScript (ESM, strict)

This document is the single source of truth for the generator. Where code and spec disagree, the spec wins until the spec is amended.

---

## 1. Purpose and scope

Graphisme Génératif produces abstract compositions by applying the *programmation* method described for Victor Vasarely's plastic alphabet: a finite vocabulary of form-colour units, placed on a grid, varied by explicit rules (permutation, progression), and recorded as a letter–number code before being rendered.

The system has two strictly separated stages, mirroring the historical workflow (coded study on graph paper → execution by the studio):

1. **Programmation** — a pure, deterministic function `params → programmation`. Output is a data structure (and a compact text notation). No geometry, no pixels.
2. **Réalisation** — a renderer `programmation + palette → SVG`. No randomness, no decisions.

### Non-goals

- Reproducing, approximating or "re-creating" any specific existing artwork. No presets, examples or tests may target a known work, and no preset may be named after a work or series title.
- Shipping or referencing images of Vasarely's works anywhere in the repository (including tests and fixtures).
- Machine learning. The generator is rule-based; it is not trained on any image corpus.

---

## 2. Glossary

| Term | Meaning in this system |
|---|---|
| **unité** (unité plastique) | One grid cell. Consists of a *fond* and a chain of 0–2 *noyaux*. |
| **étage** | A layer of a unité. Étage 0 is the fond; étage 1 is the first noyau; étage 2 is a noyau nested inside étage 1. Max depth: 3 étages. |
| **fond** (carré-fond) | The coloured square background of a unité (étage 0). |
| **noyau** (noyau-forme) | A coloured form placed inside the previous étage (étages 1–2). |
| **forme** | One of the six alphabet forms: carré, cercle, losange, triangle, rectangle, ellipse. |
| **grandeur** | Discrete size step of a forme, 1–30, relative to the box of its parent étage. |
| **gamme** | A named hue scale in a palette, identified by one uppercase letter. |
| **nuance** | A value step within a gamme: 1 (lightest) … 12 (darkest), plus `N` (noir coloré). |
| **module** | A rectangular group of `colonnes × rangées` unités (e.g. 2×2, 3×3, 5×5). |
| **champ** | The whole field: a grid of module slots. |
| **échelle** | Unit scale of a module: 1 or 2. An échelle-2 module uses double-size unités and occupies 2×2 module slots. |
| **parcours** | Traversal order that assigns each unité (within a module) or each module (within the champ) a rank and a normalised position `t ∈ [0,1]`. |
| **variation** | A rule that changes one axis (e.g. noyau nuance) as a function of position along a parcours. Modes: constant, progression, permutation, aléatoire. |
| **inversion** | Swapping the colours of fond and étage 1 (positive ↔ negative). |
| **programmation** | The generated code grid (canonical JSON + text notation). |
| **réalisation** | The rendering of a programmation (SVG). |

Identifiers in code use these French terms without diacritics (`etage`, `aleatoire`, `parcours`, …). Prose and documentation keep the diacritics.

---

## 3. Structural model

### 3.1 Hierarchy

```
champ  (modulesX × modulesY module slots)
 └─ module  (colonnes × rangees unités, échelle 1|2)
     └─ unité  (fond + up to 2 nested noyaux)
```

Base unit size is 1. An échelle-1 module occupies one slot of `colonnes × rangees` base units. An échelle-2 module occupies 2×2 slots and contains the same number of unités, each 2×2 base units.

### 3.2 Échelle placement

Module slots are visited in the inter-module parcours order (§5). For each slot not already occupied:

1. Determine the desired échelle from the échelle rule (§6.5).
2. If échelle 2 is desired and the 2×2 block anchored at this slot (extending right and down) is fully free and inside the champ, place an échelle-2 module there.
3. Otherwise place an échelle-1 module.

This is deterministic. The rank and `t` of an échelle-2 module are those of its anchor slot.

> **Implementation decision (v1).** Slots are visited in strict parcours order (rank ascending, ties broken row-major). A consequence worth knowing: with a centre-out inter parcours (`rayonnement`), the inner slots are always occupied before any outer anchor is considered, so the 2×2 block of an outer-ring anchor always overlaps an occupied slot and **no échelle-2 module is ever placed**. Échelle 2 is effective with parcours whose free region stays a contiguous right/down area (`lignes`, `colonnes`, `boustrophedon`, `diagonale`). This follows from §3.2 as written and is kept rather than special-cased.

### 3.3 Unité and étages

A unité has `etages` layers (param, 1–3, constant for the whole champ in v1).

- Étage 0: fond colour only, fills the unité square (minus the joint, §8).
- Étage k ≥ 1: a forme with a colour, centred in the **box** of étage k−1.

The **box** of an étage is the axis-aligned square that its *untransformed* forme inscribes:

| Parent forme | Box side factor `k` (× parent bbox side) |
|---|---|
| fond (unité square) | 1 |
| carré | 1 |
| cercle | 1/√2 |
| ellipse | `min(1, aspect) / √2` |
| losange | 1/2 |
| rectangle | `min(1, aspect)` |
| triangle | 0.5 (inscribed square of an isosceles triangle with base = height, rounded down) |

The forme of étage k has bbox side `box(k−1) × grandeur / 30`. Transforms (rotation, aspect, cisaillement) are applied around the centre after sizing. Containment under shear or large rotation is not enforced; the validator emits a warning (§9) when an étage's transformed bbox exceeds its parent box by more than 5 %.

> **Implementation decision (v1).**
> - The box side factor is keyed on the **type code** exactly as the table above states, so `carré` keeps factor 1 and `cercle` keeps 1/√2 even when `aspect < 1` narrows them. Where that over-estimates the box, the 5 % warning is the safety net.
> - The warning compares the axis-aligned bounding box of the forme after shear and then rotation (`bbox = 2·max(bw, bh)` with `bw = (hw + |s|·hh)·|cos θ| + hh·|sin θ|`, `bh = (hw + |s|·hh)·|sin θ| + hh·|cos θ|`) against the parent box side. It is an approximation, deliberately cheap, because it only drives a diagnostic.
> - `diagnostics.avertissements` holds **distinct** messages in first-seen order, capped at 32. Messages name the étage, not the cell, so a champ of 100 000 unités produces a short list.
> - Transform order is **shear first, then rotation**, both about the forme centre.

### 3.4 The alphabet

| Forme | Code | Canonical geometry (bbox side 1, centred) |
|---|---|---|
| carré | `c` | square |
| cercle | `o` | circle, diameter 1 |
| losange | `l` | square rotated 45°, scaled so its bbox is 1 |
| triangle | `t` | isosceles, base 1 at bottom, apex top centre |
| rectangle | `r` | width = aspect, height 1 (default aspect 0.6) |
| ellipse | `e` | horizontal radius aspect/2, vertical 1/2 (default aspect 0.6) |

Transforms per forme:

- `rotation` degrees, 0–360 (applied clockwise).
- `aspect` 0.2–1.0 (meaningful for rectangle, ellipse; for carré/cercle it turns them into rectangle/ellipse geometry without changing the type code).
- `cisaillement` (horizontal shear) −0.5…0.5.

Progressive continuity between forms is a core property: carré with rotation 0→45 travels to losange geometry; cercle with aspect 1→0.4 travels to an ellipse; rectangle with cisaillement 0→0.3 travels to a parallelogram. These continuous paths are what **progression** uses; jumping between type codes is what **permutation** uses.

> **Implementation decision (v1).** `aspect` scales the **horizontal extent** of every forme type (`width = bbox × aspect`, `height = bbox`), not only rectangle and ellipse, so the continuity above also works for losange and triangle. Default `aspect` is 0.6 for `r` and `e`, 1 for the others; when `forme.aspect` is omitted from the params, the default of the *evaluated* type is recorded. Omitted `rotation` and `cisaillement` record 0.

---

## 4. Colour model

### 4.1 Palette

A palette is data:

```ts
interface Palette {
  id: string;                         // e.g. "alphabet-6x12"
  label: string;
  gammes: Record<string, Gamme>;      // key: single uppercase letter A–Z
}
interface Gamme {
  label: string;
  nuances: string[];                  // hex "#rrggbb", index 0 = nuance 1 (lightest)
  noir?: string;                      // hex for nuance "N" (noir coloré), optional
}
```

A gamme may have 1–15 nuances. Neutral single-nuance gammes are allowed.

### 4.2 Default palette `alphabet-6x12`

Six chromatic gammes of 12 nuances each, each with a noir coloré, plus two neutrals. Values are **our own OKLCH approximations of the named hues**, not measured historical pigments, and must be documented as such.

| Letter | Label | OKLCH hue (°) | Peak chroma |
|---|---|---|---|
| `J` | jaune de chrome | 95 | 0.17 |
| `V` | vert émeraude | 160 | 0.14 |
| `B` | bleu outremer | 265 | 0.19 |
| `M` | violet de cobalt | 305 | 0.16 |
| `R` | rouge | 28 | 0.20 |
| `G` | gris | — | 0 |
| `K` | noir (1 nuance) | — | 0 |
| `W` | blanc (1 nuance) | — | 0 |

Generation (script `scripts/build-palette.ts`, output committed as `src/palette/alphabet-6x12.json`):

- Lightness for nuance n (1…12): `L = 0.96 − (n − 1) × (0.96 − 0.30) / 11`.
- Chroma: `C = Cpeak × sin(π × (n − 0.5) / 12)` (low at both ends, peak mid-scale).
- Noir coloré: `L = 0.20`, `C = 0.035`, same hue. Gris has none.
- `K` = `#111111`, `W` = `#f4f2ee`.
- Convert OKLCH → sRGB, clip to gamut by reducing chroma (binary search), round to hex.

The runtime never converts colours; it only reads hex values from palette data.

### 4.3 Colour code

`<gamme letter><nuance>` — e.g. `B7`, `J2`, `RN` (noir coloré of rouge), `K1`, `W1`.

> **Implementation decision (v1).** The nuance axis range is 1–13 for every gamme (§6.1), but a gamme offers only `1…nuances.length`, plus 13 when it defines a `noir`. After clamping to the axis range, a nuance is snapped to the **nearest value the gamme actually offers** (ties to the lower one). So a 1-nuance gamme such as `K` always yields `K1`, and `G13` becomes `G12` because gris has no noir coloré.

### 4.4 Contrast rule

Adjacent étages (k and k+1) must be distinguishable. If they share a gamme, `|nuance(k) − nuance(k+1)| ≥ contraste.minNuance` (default 3). Noir coloré counts as nuance 13 for this rule.

Resolution when violated (deterministic): move the **inner** étage's nuance away from the outer one in the direction that stays within range, by the minimal amount; if both directions are out of range, switch the inner étage to the next gamme in the palette's key order. The validator counts these corrections (§9).

> **Implementation decision (v1).** "Minimal amount" is made precise as: among the nuances the gamme offers that satisfy `|n − nuance(outer)| ≥ minNuance`, take the one minimising `|n − nuance(inner)|`; ties prefer the side the inner étage is already on (`n ≥ outer` when `inner ≥ outer`, otherwise `n ≤ outer`). If that candidate set is empty, the inner étage switches to the next gamme in `Object.keys(palette.gammes)` order (wrapping) and its nuance is snapped to that gamme's valid set (§4.3). Pairs are processed outward to inward (0↔1, then the corrected 1↔2), so a correction can cascade.

---

## 5. Parcours (traversal)

A parcours maps the cells of a grid (`w × h`) to an integer **rank** (0…N−1, ties allowed) and a normalised position **t ∈ [0,1]**. It is applied twice: **intra** (unités within one module) and **inter** (module slots within the champ).

```ts
interface Parcours {
  type: 'lignes' | 'colonnes' | 'boustrophedon' | 'diagonale' | 'rayonnement' | 'spirale';
  inverse?: boolean;                                   // reverse direction (t → 1 − t)
  symetrie?: 'aucune' | 'horizontale' | 'verticale' | 'centrale';
}
```

| Type | Order |
|---|---|
| `lignes` | left→right, top→bottom |
| `colonnes` | top→bottom, left→right |
| `boustrophedon` | rows, alternating direction |
| `diagonale` | anti-diagonals (`x + y`), ties share rank |
| `rayonnement` | Chebyshev distance from the grid centre; equal distance = equal rank (concentric rings) |
| `spirale` | clockwise inward spiral from top-left |

`t = rank / maxRank` (0 if maxRank = 0).

**Symétrie** folds coordinates before ranking: `horizontale` mirrors x around the vertical centre line (`x' = min(x, w−1−x)`), `verticale` mirrors y, `centrale` does both. Folded grids are ranked on the folded size.

> **Implementation decision (v1).**
> - Ranking is defined by an integer **ordering key** per folded cell; the rank is the index of that key among the distinct keys present, ascending. This gives ties exactly where the table says ties occur, and `maxRank = distinctKeys − 1`.
> - `rayonnement` measures Chebyshev distance from the geometric centre `((w−1)/2, (h−1)/2)`, computed doubled (`max(|2x−(w−1)|, |2y−(h−1)|)`) to stay integral. On an even side the two central rows/columns share rank 0.
> - `spirale` starts at `(0,0)`, runs right along the top row, down the right column, left along the bottom, up the left column, then repeats one ring inwards. Every cell gets a distinct rank.
> - `inverse` reverses the **rank** as well as `t`: `rank' = maxRank − rank`, which makes `t' = 1 − t` automatically and also reverses permutation indices.
> - The folded size is `ceil(w/2)` and/or `ceil(h/2)`; on an odd side the middle row/column is its own fold target.
> - `ordre` (the order in which cells draw from a PRNG stream, §7) is the full grid sorted by rank ascending, ties row-major.

---

## 6. Variation

### 6.1 Axes

Every variable quantity is an **axis** with a base value and up to two variations:

```ts
interface Axis<T> {
  base: T;
  inter?: Variation<T>;   // driven by the module's t / rank in the champ
  intra?: Variation<T>;   // driven by the unité's t / rank in its module
}
```

Axes per étage:

| Axis | Type | Range | Applies to |
|---|---|---|---|
| `couleur.gamme` | categorical (gamme letter) | palette keys | all étages |
| `couleur.nuance` | integer (13 = N) | 1–13 | all étages |
| `forme.type` | categorical | `c o l t r e` | étages ≥ 1 |
| `forme.grandeur` | integer | 1–30 | étages ≥ 1 |
| `forme.rotation` | number | 0–360 (wraps) | étages ≥ 1 |
| `forme.aspect` | number | 0.2–1.0 | étages ≥ 1 |
| `forme.cisaillement` | number | −0.5–0.5 | étages ≥ 1 |

### 6.2 Variation modes

```ts
interface Variation<T> {
  mode: 'constant' | 'progression' | 'permutation' | 'aleatoire';
  amplitude: number;          // 0–1
  onde?: 'rampe' | 'triangle' | 'sinus';   // progression only, default 'rampe'
  periode?: number;           // progression: cycles across t ∈ [0,1], default 1
  sens?: 1 | -1;              // progression on numeric axes, default 1
  ensemble?: T[];             // permutation / aleatoire / categorical progression
  pas?: number;               // permutation step, integer ≥ 1, default 1
}
```

Wave function `w(t)` ∈ [0,1], with `u = t × periode`:

- `rampe`: `u − floor(u)` (for `periode = 1` and `t = 1`, `w = 1`)
- `triangle`: `1 − |2 × (u − floor(u)) − 1|`
- `sinus`: `(1 − cos(2π u)) / 2`

**Numeric axes** (span = max − min of the axis range):

| Mode | Offset added to the value |
|---|---|
| constant | 0 |
| progression | `sens × amplitude × span × w(t)` |
| permutation | requires `ensemble` (list of offsets); `ensemble[(rank × pas) mod len]` applied to a deterministic subset of cells whose share equals `amplitude` (subset chosen by the PRNG stream for that axis) |
| aléatoire | `amplitude × span × (2u − 1)`, `u` from the PRNG stream |

Integers are rounded half away from zero after summation. Values are clamped to the axis range (rotation wraps instead).

**Categorical axes** (`ensemble` is required for every non-constant mode and defines the ordered set; for `permutation`, the value it starts from — base or module value — should be a member; if it is not, the start index is 0 and the validator emits a warning):

| Mode | Result |
|---|---|
| constant | base |
| progression | `ensemble[floor(w(t) × len)]` clamped to `len − 1`, applied when `amplitude ≥ 0.5`; otherwise base. (Categorical progression moves in ordered blocks.) |
| permutation | `ensemble[(indexOf(base) + rank × pas) mod len]` for a PRNG-selected share `amplitude` of cells; others keep base |
| aléatoire | uniform pick from `ensemble` for a PRNG-selected share `amplitude` of cells; others keep base |

> **Implementation decision (v1).**
> - "A PRNG-selected share `amplitude`" means: each cell draws one value `u` from the axis' stream and is selected when `u < amplitude`.
> - The number of values a cell draws is **fixed by the mode**, never by the amplitude or by whether the cell was selected: `constant` and `progression` draw 0, `permutation` draws 1 (the selector), numeric `aléatoire` draws 1 (the value), categorical `aléatoire` draws 2 (selector, then pick). Stream positions therefore never shift when an amplitude changes.
> - A categorical `aléatoire` pick is `ensemble[min(floor(u × len), len − 1)]`.
> - A non-constant mode with a missing or empty `ensemble` is a validation error on categorical axes and on numeric `permutation`; where it can still occur it is a no-op.
> - `rampe` returns 1 (not 0) whenever `u > 0` and `u` is a whole number, so `t = 1, periode = 1` reaches the full amplitude.

### 6.3 Combination of inter and intra

Evaluation per unité, per axis:

1. `v = base`.
2. Apply **inter** variation using the module's rank/t → module value `vm`. (Categorical: `vm` replaces `v`.)
3. Apply **intra** variation using the unité's rank/t, starting from `vm`. Numeric: offsets add. Categorical: the intra rule operates with `vm` as its base (so permutation indices are relative to `vm`).
4. Clamp/wrap, then apply the contrast rule (§4.4) after all étages are computed.

### 6.4 Inversion

```ts
inversion?: { mode: 'constant' | 'progression' | 'permutation' | 'aleatoire'; amplitude: number; niveau: 'inter' | 'intra' };
```

When a cell (or every cell of a module, for `niveau: 'inter'`) is selected, the colours of étage 0 and étage 1 are swapped after evaluation. Selection: `constant` → all cells if amplitude ≥ 0.5, else none; `progression` → cells with `w(t) ≥ 1 − amplitude`; `permutation` → cells with even rank, inverted pattern on odd rank, on a PRNG-selected share `amplitude` of cells; `aleatoire` → PRNG share `amplitude`. Inversion is applied before the contrast rule.

> **Implementation decision (v1).**
> - `permutation` is read as: a cell is inverted when it falls in the PRNG-selected share **and** its rank is even; odd-rank cells keep the non-inverted pattern. At `amplitude = 1` this is a rank checkerboard, and selection grows monotonically with amplitude.
> - `amplitude = 0` selects nothing in every mode (this overrides the literal `w(t) ≥ 1` of `progression`).
> - With fewer than 2 étages there is nothing to swap; the validator rejects such params.

### 6.5 Échelle rule

```ts
echelle: { mode: 'constant' | 'progression' | 'aleatoire'; part: number }   // part ∈ [0,1]
```

- `constant`: all modules échelle 2 if `part ≥ 0.5`, else all échelle 1.
- `progression`: échelle 2 desired where inter `t ≥ 1 − part` (with `rayonnement`, this enlarges the outer ring; with `inverse: true`, the centre).
- `aleatoire`: échelle 2 desired with probability `part` per anchor slot.

Placement then follows §3.2. Échelle never varies within a module.

> **Implementation decision (v1).** Every anchor slot draws exactly one value from the `echelle` stream whatever the mode, so the stream position does not depend on `part` or on the mode. `part = 0` never wants échelle 2. `progression` compares the raw inter `t` (not a wave) against `1 − part`, as written above. See the note in §3.2 for which parcours can actually accommodate échelle 2.

### 6.6 Radicality as a usage pattern

"Radical" versus "gentle" change is not a separate switch; it emerges from the mode and amplitude choice. The documentation (not the API) describes the spectrum:

- *Constant*: all modes constant.
- *Glissement* (gentle): progression with low amplitude on nuance, rotation, aspect or cisaillement; types and gammes constant.
- *Modulé*: progression on nuance plus categorical progression on gamme; small permutation share on forme type.
- *Radical*: permutation or aléatoire on forme type over the full alphabet, gamme permutation across the palette, inversion active.

Example parameter files in `examples/` use these neutral names only.

---

## 7. Determinism and randomness

- Seed: arbitrary string. Hash with `cyrb128` → 4×32-bit state → `sfc32` generator.
- **Stream isolation**: every random decision draws from a stream derived from a path, e.g. `stream(seed, 'inter', 'etage1', 'couleur.nuance')`, by hashing `seed + '|' + path.join('/')`. Cells draw from their stream in rank order (ties broken by row-major order). Consequence: changing one axis's rule never changes random outcomes of other axes.
- No use of `Math.random`, `Date`, locale-dependent formatting or iteration over unordered collections anywhere in the programmation stage.
- Floating-point outputs that end up in the programmation are rounded to 4 decimals.
- Invariant (tested): identical `params` → byte-identical canonical JSON and notation, across Node and browsers.

> **Implementation decision (v1).** Stream paths are fixed strings, joined with `/` after `seed + '|'`:
>
> | Decision | Path |
> |---|---|
> | échelle placement | `echelle` |
> | inter axis | `inter / etage<k> / <axis>` |
> | intra axis | `intra / module:<ax>,<ay> / etage<k> / <axis>` |
> | inversion, inter | `inversion / inter` |
> | inversion, intra | `inversion / intra / module:<ax>,<ay>` |
>
> `<axis>` is one of `couleur.gamme`, `couleur.nuance`, `forme.type`, `forme.grandeur`, `forme.rotation`, `forme.aspect`, `forme.cisaillement`; `<k>` is the étage index, 0-based.
>
> **Intra streams are per module.** A module's unités therefore draw the same values wherever that module sits and whatever the champ around it does, which makes the isolation property hold across changes to the champ size and to the inter parcours as well as across axes. Each stream discards 8 warm-up values after seeding, so neighbouring paths decorrelate immediately.

---

## 8. Parameters

```ts
interface Params {
  version: 1;
  seed: string;
  palette: string | Palette;                  // id of a bundled palette or an inline palette
  champ: { modulesX: number; modulesY: number };          // 1–64 each
  module: { colonnes: number; rangees: number };          // 1–12 each
  echelle?: { mode: 'constant' | 'progression' | 'aleatoire'; part: number };  // default constant/0
  parcours: { inter: Parcours; intra: Parcours };
  unite: { etages: 1 | 2 | 3; joint?: number };           // joint: gap as fraction of unit, 0–0.2, default 0
  etages: EtageSpec[];                                    // length === unite.etages
  contraste?: { minNuance: number };                      // default 3
  inversion?: InversionSpec;
}

interface EtageSpec {
  couleur: { gamme: Axis<string>; nuance: Axis<number> };
  forme?: {                                               // required for étages ≥ 1, forbidden for étage 0
    type: Axis<'c' | 'o' | 'l' | 't' | 'r' | 'e'>;
    grandeur: Axis<number>;
    rotation?: Axis<number>;
    aspect?: Axis<number>;
    cisaillement?: Axis<number>;
  };
}
```

A JSON Schema (`schema/params.schema.json`, draft 2020-12) is exported and kept in sync with the types by a test. Validation is hand-written (zero runtime dependencies) and returns structured errors with JSON paths.

> **Implementation decision (v1).**
> - `seed` must be a **non-empty** string. The notation's `token` production requires at least one character, so an empty seed could not round-trip.
> - The schema is built in `src/validate/schema.ts` from the same key lists the validator uses for `additionalProperties`, and type-level assertions make the typecheck fail when a key is added to or removed from an interface. `schema/params.schema.json` is the committed serialisation, regenerated with `npm run schema` and compared byte for byte by a test.
> - `validate` checks that a gamme letter is a single `A–Z` and, for an inline palette, that it exists. A bundled palette id cannot be resolved by `validate` alone, so `generate` re-checks every reachable gamme letter (`base` and every `ensemble` member) against the resolved palette and throws `ParamsError` if one is unknown.
> - `contraste.minNuance` is an integer in 0–12; `periode` is in (0, 64]; `pas` is an integer in 1–1024. `sens` on a non-`progression` numeric variation is rejected as a likely mistake.
> - An `Erreur` is `{ chemin, message, code }`, where `chemin` is a JSON Pointer (`""` for the root) and `code` is a short stable tag (`type`, `plage`, `entier`, `enum`, `requis`, `interdit`, `cle-inconnue`, `longueur`, `gamme`, `gamme-inconnue`, `hex`, `vide`, `inutile`, `version`).

### Worked example (gentle, 2 étages)

```json
{
  "version": 1,
  "seed": "atelier-01",
  "palette": "alphabet-6x12",
  "champ": { "modulesX": 6, "modulesY": 4 },
  "module": { "colonnes": 3, "rangees": 3 },
  "parcours": {
    "inter": { "type": "rayonnement" },
    "intra": { "type": "lignes" }
  },
  "unite": { "etages": 2 },
  "etages": [
    {
      "couleur": {
        "gamme": { "base": "B" },
        "nuance": { "base": 3, "inter": { "mode": "progression", "amplitude": 0.5 } }
      }
    },
    {
      "couleur": {
        "gamme": { "base": "B" },
        "nuance": { "base": 9, "intra": { "mode": "progression", "amplitude": 0.15, "onde": "triangle" } }
      },
      "forme": {
        "type": { "base": "c" },
        "grandeur": { "base": 20 },
        "rotation": { "base": 0, "inter": { "mode": "progression", "amplitude": 0.125 } }
      }
    }
  ]
}
```

Here the rotation range is 0–360, so amplitude 0.125 reaches 45° at the outermost ring: carrés become losanges from the centre outwards.

---

## 9. Output: programmation

### 9.1 Canonical JSON

```ts
interface Programmation {
  version: 1;
  seed: string;
  palette: string;                 // palette id (inline palettes are embedded under paletteInline)
  paletteInline?: Palette;
  largeur: number;                 // champ width in base units
  hauteur: number;                 // champ height in base units
  unites: UnitePlacee[];           // sorted by y, then x
  diagnostics: { contrasteCorrections: number; avertissements: string[] };
}

interface UnitePlacee {
  x: number; y: number;            // top-left, base units
  echelle: 1 | 2;
  module: [number, number];        // anchor slot of its module
  fond: string;                    // colour code
  etages: { forme: FormePlacee; couleur: string }[];   // étage 1…n
}

interface FormePlacee {
  type: 'c' | 'o' | 'l' | 't' | 'r' | 'e';
  grandeur: number;
  rotation: number;
  aspect: number;
  cisaillement: number;
}
```

Canonical serialisation: keys in the declared order, no insignificant whitespace (a pretty-printed variant is allowed for files).

> **Implementation decision (v1).** Files are written in the compact canonical form, never pretty-printed, with a single trailing newline, so a golden snapshot can be compared byte for byte. `JSON.stringify` is enough: every object is built in the declared key order.

### 9.2 Text notation

A compact, human-readable code in the spirit of the historical letter–number sheets. Grammar (EBNF):

```
notation   = header , NL , ligne , { NL , ligne } ;
header     = "GG1" , SP , "seed=" , token , SP , "palette=" , token , SP , "unites=" , int , "x" , int ;
ligne      = cellule , { SP , cellule } ;            (* one line per row of base units *)
cellule    = [ "2*" ] , unite | "." ;                (* "." = covered by an échelle-2 unité *)
unite      = couleur , { ">" , etage } ;
etage      = forme , ":" , couleur ;
forme      = type , int , [ "@" , num ] , [ "x" , num ] , [ "s" , num ] ;
type       = "c" | "o" | "l" | "t" | "r" | "e" ;
couleur    = gamme , ( int | "N" ) ;
gamme      = "A" … "Z" ;
```

Defaults are omitted (`@0`, `x1`, `s0`; rectangle/ellipse default aspect 0.6 is omitted when equal). Numbers use `.` as decimal separator and minimal digits (max 4 decimals). `token` is URL-safe (`[A-Za-z0-9._-]+`); seeds outside this set are percent-encoded.

Example cell: `R4>c24:K1>r14x0.5s0.2:J2` — red fond nuance 4, black carré of grandeur 24, inside it a sheared yellow rectangle.

`encode(decode(s)) === s` and `decode(encode(p))` deep-equals `p` minus `diagnostics` (property-tested).

> **Implementation decision (v1).** The notation is a **projection**: the grammar above carries no module membership and no palette data, so the round-trip identity is stated precisely as `decode(encode(p))` deep-equals `p` minus `diagnostics` **and minus `module`**.
> - Decoded unités carry the sentinel `module: [-1, -1]`, meaning "not recorded".
> - `encode` throws when `paletteInline` is set, rather than silently dropping it; the header records a palette **id** only.
> - A seed is percent-encoded over its UTF-8 bytes, escaping every byte outside `[A-Za-z0-9._-]` as `%XX` with uppercase hex.
> - `aspect` is omitted when it equals the default of its own type code (0.6 for `r`/`e`, 1 otherwise); `@0` and `s0` are omitted.

---

## 10. Réalisation (SVG renderer)

```ts
renderSVG(p: Programmation, palette: Palette, opts?: {
  taille?: number;              // px per base unit, default 24
  joint?: number;               // overrides params joint, fraction of unit
  fondJoint?: string;           // colour of the joint gap, default "K1"
  preserveAspectRatio?: string; // default "xMidYMid slice"
  titre?: string;               // <title> for accessibility
}): string
```

- `viewBox="0 0 largeur hauteur"` in base units; `width/height` from `taille`.
- One `<g>` per unité, `transform` translates to its origin; étages are drawn back-to-front.
- Shapes are emitted as `<rect>`, `<circle>`, `<ellipse>` or `<polygon>`; transforms via a single `transform` attribute per shape, rotation/shear about the shape centre.
- `shape-rendering="crispEdges"` on rectangles only.
- Output is deterministic text (fixed attribute order, numbers formatted to ≤ 4 decimals).
- Optional size optimisation: identical consecutive fill colours share a `<g fill>` wrapper (must not change output geometry).

> **Implementation decision (v1).**
> - The programmation does not carry `joint`, so the renderer uses `opts.joint ?? 0`. The CLI passes `params.unite.joint` when it renders what it has just generated; `render`, which starts from a programmation, has no joint source and therefore renders with no gap.
> - The joint gap is painted by one champ-sized `<rect>` in `fondJoint` emitted before the unités, always, even at `joint = 0`, so the element sequence does not depend on the joint. `fondJoint` defaults to `K1` and must exist in the palette.
> - Type codes map to elements as: `c`/`r` → `<rect>`, `l`/`t` → `<polygon>`, `o`/`e` → `<circle>` when the two radii are equal and `<ellipse>` otherwise.
> - The transform is a single `matrix(a,b,c,d,e,f)` equal to `T(centre) · R(rotation) · S(cisaillement) · T(−centre)`, and is omitted when `cisaillement = 0` and `rotation mod 360 = 0`.
> - Attribute order is fixed: `<svg xmlns viewBox width height preserveAspectRatio>`, `<rect x y width height fill [transform] shape-rendering>`, `<circle cx cy r fill [transform]>`, `<ellipse cx cy rx ry fill [transform]>`, `<polygon points fill [transform]>`. One element per line, `\n` endings, trailing newline.
> - `<title>` is emitted only when `titre` is given; `&`, `<` and `>` are escaped.
> - A colour code the palette cannot serve throws rather than falling back to a default.
> - The optional `<g fill>` grouping is **not** implemented in v1: it is explicitly optional, and keeping one element per unité étage makes the output contract easier to read and diff.

A canvas renderer and animated progression playback are out of scope for v1.

### Web background usage

For a responsive background, generate a champ large enough for the widest supported viewport at the chosen `taille`, and let `preserveAspectRatio="xMidYMid slice"` crop. Regenerating on resize is discouraged (layout-dependent output breaks reproducibility of a given seed).

---

## 11. Public API

```ts
export function generate(params: Params): Programmation;
export function validate(params: unknown): { ok: true; params: Params } | { ok: false; erreurs: Erreur[] };
export function encode(p: Programmation): string;
export function decode(s: string): Programmation;
export function renderSVG(p: Programmation, palette: Palette, opts?: RenderOptions): string;
export function getPalette(id: string): Palette;
export const palettes: Record<string, Palette>;
```

`generate` throws a typed `ParamsError` (with the same `erreurs`) on invalid input; it never returns a partially valid result.

CLI (`graphisme-generatif` bin):

```
graphisme-generatif generate <params.json> [--seed <s>] [--out <file.svg>] [--json <file.json>] [--notation <file.txt>] [--taille <px>]
graphisme-generatif render <programmation.json|.txt> [--out <file.svg>] [--taille <px>]
graphisme-generatif validate <params.json>
```

> **Implementation decision (v1).**
> - `--seed` replaces `seed` in the params before validation, so an invalid seed is still reported with the path `/seed`.
> - `generate` with none of `--out`, `--json`, `--notation` writes the canonical JSON to stdout. With at least one of them it writes only the requested files and sends `diagnostics.avertissements` to stderr, one `warning: …` line each.
> - `generate --notation` fails when the params carry an inline palette, because the notation records a palette id only (§9.2).
> - `render` reads a `.txt` input as notation and any other input as canonical JSON; with no `--out` it writes the SVG to stdout.
> - Exit code 0 on success, 1 on any error (usage, I/O, validation). Validation errors print one per line as `<chemin>: <message> [<code>]`. `--help` prints the usage and exits 0; no command at all prints it and exits 1.

---

## 12. Engineering requirements

- Node ≥ 20, TypeScript strict, ESM only, `"sideEffects": false`.
- **Zero runtime dependencies.** Dev: `typescript`, `vitest`, `tsup`, `@biomejs/biome`, `fast-check`.

> **Implementation decision (v1).** `@types/node` is added to the dev dependencies: it ships only type declarations, so it does not widen the runtime or tooling surface, and the CLI and build scripts cannot typecheck without it. TypeScript-authored scripts (`scripts/*.ts`) are run through `scripts/run-ts.js`, which bundles them with the already-present `tsup` into `.tmp/` and executes the result, rather than adding a TS runner dependency.
- Layout:

```
src/
  core/       types.ts, prng.ts, parcours.ts, variation.ts, placement.ts, generate.ts, contraste.ts
  notation/   encode.ts, decode.ts
  palette/    index.ts, alphabet-6x12.json
  render/     svg.ts
  validate/   validate.ts
  cli/        index.ts
  index.ts
schema/       params.schema.json
scripts/      build-palette.ts
examples/     constant.json, glissement.json, module.json, radical.json, out/ (generated SVGs, committed)
playground/   index.html
test/
```

- Tests (vitest):
  - golden snapshots of canonical JSON + notation + SVG for every file in `examples/`;
  - determinism: generate twice, compare bytes; stream isolation: altering one axis rule leaves other axes' random outcomes unchanged;
  - parcours: rank/t tables for each type on 1×1, 3×3, 4×5 grids, with symétrie and inverse;
  - variation: each mode × axis kind, including clamping and rotation wrap;
  - contraste: corrections are minimal and deterministic;
  - placement: échelle-2 modules never overlap or exceed the champ;
  - notation round-trip (property-based with fast-check);
  - schema/type sync.
- Performance target: 64×64 modules of 5×5 unités (102 400 unités, 3 étages) generates in < 1 s and renders in < 2 s on a current laptop.
- CI: GitHub Actions, Node 20 and 22, lint + typecheck + test.

> **Implementation decision (v1).**
> - Every example is a 4×4 champ of 4×4-unité modules (16×16 base units), large enough to show the parcours and small enough to keep the committed snapshots readable.
> - `scripts/examples.ts` builds an example's three outputs; `scripts/build-examples.ts` writes them and the golden test compares against them, so the writer and the checker cannot drift apart.
> - `scripts/bench.ts` holds the params of the performance target and prints the two measured times.
> - `playground/index.html` is a single static page: one inline `<style>`, one inline `<script type="module">`, no framework, no external asset, no runtime dependency. It imports the built bundle from `../dist/index.js`, so `npm run playground` builds first and then serves the repository root over HTTP (`scripts/serve-playground.js`, zero dependencies, development only).
> - The playground's seed field works like the CLI's `--seed`: it overrides the params rather than rewriting the editor text, and it is re-synced from the text whenever the params' own `seed` value changes.
> - Previous/next step the seed's trailing integer, keeping its width and never going below 0; a seed without a trailing integer gains a `-0` / `-1` suffix. Random draws 6 bytes from `crypto.getRandomValues` and writes them as hex. The page is the only place where non-reproducible randomness is allowed, and it never reaches `src/`.
> - The editor starts from `examples/glissement.json`, falling back to an inline params object when the fetch fails. Validation errors are shown live; the last valid render stays on screen so a half-typed edit does not blank the preview.

---

## 13. Versioning

- `version: 1` in params and programmation. Any change that alters output for existing params is a breaking change → new major and a bumped format version.
- Golden snapshots are the contract; updating them requires a changelog entry stating why output changed.

---

## 14. Background and sources

The model follows published descriptions of Vasarely's method: the *unité plastique* as a coloured square carrying a form of another colour (patented 1959); the *alphabet plastique* of a small set of forms in progressive sizes; colour scales in which each pure hue is resolved into 12–15 values; and the *programmation* as a letter–number coded study executed by the studio, varied through permutation and progression. Concepts such as concentric radiation (`rayonnement`) and inversion are generalisations of recurring structural ideas, not reconstructions of individual works.

Primary reading: Michèle Vasarely Foundation — "Periods" (text by Arnauld Pierre) and "Programmations"; Centre Pompidou — "Victor Vasarely, archi-total"; Encyclopædia Universalis — "Vasarely Victor". See README for the independence statement.
