# Params — a human guide

This is the readable companion to [`schema/params.schema.json`](schema/params.schema.json) and to
[SPEC.md](SPEC.md). The schema says what is *accepted*; this page says what each field *does* and
what you can build with it. SPEC.md remains the source of truth — where the two disagree, SPEC.md
wins.

A params file plus a seed is the whole input. The same pair always produces the same output, byte
for byte.

```
graphisme-generatif validate my-params.json
graphisme-generatif generate my-params.json --out out.svg --notation out.txt
```

---

## 1. The shape of the thing

```
champ                          the whole picture: modulesX x modulesY module slots
 └─ module                     colonnes x rangees unites, at echelle 1 or 2
     └─ unite                  one coloured square (the fond) plus up to 2 nested formes
         └─ etage 0            the fond: colour only
            etage 1, 2         a forme with its own colour, centred in the box of the etage below
```

A minimal, complete params file — a plain blue grid:

```json
{
  "version": 1,
  "seed": "essai-01",
  "palette": "alphabet-6x12",
  "champ": { "modulesX": 4, "modulesY": 4 },
  "module": { "colonnes": 4, "rangees": 4 },
  "parcours": { "inter": { "type": "lignes" }, "intra": { "type": "lignes" } },
  "unite": { "etages": 1 },
  "etages": [{ "couleur": { "gamme": { "base": "B" }, "nuance": { "base": 8 } } }]
}
```

That is 4 × 4 modules of 4 × 4 unités = 16 × 16 base units = 256 unités.

---

## 2. Top-level fields

| Field | Required | Meaning | Bounds |
|---|---|---|---|
| `version` | yes | Format version. | exactly `1` |
| `seed` | yes | Drives every random decision. Change it, get a different picture from the same rules. | non-empty string |
| `palette` | yes | A bundled palette id (`"alphabet-6x12"`) **or** a whole palette object inline (§6). | — |
| `champ` | yes | `{ modulesX, modulesY }` — how many module slots. | 1–64 each, integers |
| `module` | yes | `{ colonnes, rangees }` — how many unités inside one module. | 1–12 each, integers |
| `echelle` | no | Which modules are drawn at double size (§8). | default `{ mode: "constant", part: 0 }` |
| `parcours` | yes | `{ inter, intra }` — the two traversal orders that drive every variation (§4). | — |
| `unite` | yes | `{ etages, joint? }` — layers per unité, and the gap between unités. | `etages` 1\|2\|3; `joint` 0–0.2 |
| `etages` | yes | One entry per layer. **Length must equal `unite.etages`.** | 1–3 entries |
| `contraste` | no | `{ minNuance }` — how far apart adjacent étages must be in the same gamme (§7). | 0–12 integer, default 3 |
| `inversion` | no | Swaps the colours of étage 0 and étage 1 on selected cells (§9). | needs at least 2 étages |

`joint` is the gap around each unité, as a fraction of a unit. It is a *rendering* value: the
programmation does not carry it, so the CLI passes it when it renders what it just generated, and
`renderSVG` takes it in its options. The gap shows the `fondJoint` colour (default `K1`).

---

## 3. Axes: `base`, `inter`, `intra`

Everything that can vary is an **axis**, and every axis has the same shape:

```json
{ "base": <value>, "inter": <variation>, "intra": <variation> }
```

- **`base`** — the value with no variation at all.
- **`inter`** — varies from **module to module**, driven by the module's position in the champ.
- **`intra`** — varies from **unité to unité inside a module**, driven by the unité's position in
  its module.

Both are optional. `{ "base": 8 }` means "8 everywhere".

Because inter repeats per module and intra repeats inside every module, the two together give you
the characteristic double rhythm: a slow drift across the picture with a fast pattern inside each
tile.

### How they combine

Per unité, per axis:

1. start from `base`;
2. apply **inter** using the *module's* rank and `t`;
3. apply **intra** using the *unité's* rank and `t`, starting from the result of step 2;
4. finalise: round, then wrap (`rotation`) or clamp (everything else);
5. for colours, snap the nuance to what the gamme actually offers, then apply the contrast rule.

Numeric axes **add offsets** (inter offset + intra offset). Categorical axes **replace the value**,
so intra's permutation indices count from whatever inter produced.

### The axes

Numeric axes — these accumulate offsets:

| Axis | Where | Range | Notes |
|---|---|---|---|
| `nuance` | `etages[k].couleur.nuance` | 1–13, integer | 13 = `N`, the *noir coloré* of the gamme |
| `grandeur` | `etages[k].forme.grandeur` | 1–30, integer | 30 = fills the parent box completely |
| `rotation` | `etages[k].forme.rotation` | 0–360, float | **wraps** instead of clamping; clockwise |
| `aspect` | `etages[k].forme.aspect` | 0.2–1, float | scales the horizontal extent of any forme |
| `cisaillement` | `etages[k].forme.cisaillement` | −0.5–0.5, float | horizontal shear |

Categorical axes — these replace the value:

| Axis | Where | Values |
|---|---|---|
| `gamme` | `etages[k].couleur.gamme` | a single uppercase letter that exists in the palette |
| `type` | `etages[k].forme.type` | `c` `o` `l` `t` `r` `e` (§5) |

---

## 4. Variation: the four modes

```json
{ "mode": "...", "amplitude": 0.5, "onde": "rampe", "periode": 1, "sens": 1,
  "ensemble": [...], "pas": 1 }
```

`mode` and `amplitude` are required; the rest depends on the mode.

`amplitude` is **not** a strength dial in every mode. For `progression` and `aleatoire` it scales the
size of the change; for `permutation` (and for `inversion`/`echelle` selection) it is the **share of
cells that change at all**. `amplitude: 0` never changes anything, in any mode.

### `constant`

Nothing varies. Equivalent to omitting the variation.

### `progression` — continuous drift

The value moves along a wave of the traversal position `t ∈ [0,1]`.

| Key | Meaning | Default |
|---|---|---|
| `onde` | `rampe` (saw, 0→1), `triangle` (0→1→0), `sinus` (smooth 0→1→0) | `rampe` |
| `periode` | how many cycles of the wave fit across `t` | `1` (greater than 0, up to 64) |
| `sens` | `1` or `-1`, the direction of the drift — **numeric axes only** | `1` |

Numeric: `offset = sens × amplitude × (max − min) × w(t)`. So `amplitude: 0.125` on `rotation`
(range 360) reaches 45° at the far end — carrés turning into losanges.

Categorical: needs an `ensemble`. Below `amplitude: 0.5` nothing happens; above it, the value is
`ensemble[floor(w(t) × ensemble.length)]` — the set is walked through in order.

### `permutation` — hard jumps on a share of the cells

A cell changes when it falls in the PRNG-selected share `amplitude`. Which value it gets depends on
its **rank**, not on chance, so the result is a pattern rather than noise.

| Key | Meaning | Default |
|---|---|---|
| `ensemble` | **required**. Numeric: a list of *offsets*. Categorical: a list of *values*. | — |
| `pas` | how many steps along the ensemble each rank advances | `1` (1–1024) |

Numeric: `offset = ensemble[(rank × pas) mod n]`.
Categorical: `value = ensemble[(indexOf(previous) + rank × pas) mod n]`.

With `amplitude: 1` every cell changes and you get a strict cycle through the ensemble. A two-item
ensemble with `pas: 1` alternates; combine that with a parcours whose rank is `x + y` (`diagonale`)
and you get a perfect checkerboard regardless of the module size.

### `aleatoire` — seeded randomness

| | Rule |
|---|---|
| Numeric | `offset = amplitude × (max − min) × (2u − 1)` — a symmetric jitter around the current value, every cell affected |
| Categorical | needs an `ensemble`; a share `amplitude` of cells is selected, and each selected cell picks uniformly from the ensemble |

Random, but reproducible: the same seed gives the same draws. Each axis draws from its **own** PRNG
stream, keyed by the path `inter/etage<k>/<axis>` or `intra/module:<x>,<y>/etage<k>/<axis>`
(SPEC §7). That is why tuning one axis never disturbs the others, and why the number of draws per
cell is fixed per mode rather than per amplitude.

---

## 5. Parcours — the order that drives everything

```json
{ "type": "lignes", "inverse": false, "symetrie": "aucune" }
```

Every variation needs to know *where* a cell is in the sequence. The parcours turns a position into
a **rank** (0, 1, 2, …) and a **`t`** (rank / maxRank, in `[0,1]`). `parcours.inter` orders the
module slots in the champ; `parcours.intra` orders the unités inside a module.

| `type` | Order |
|---|---|
| `lignes` | row by row, always left to right |
| `colonnes` | column by column, always top to bottom |
| `boustrophedon` | row by row, alternating direction (snake) |
| `diagonale` | by `x + y` — anti-diagonal bands |
| `rayonnement` | concentric, from the centre outwards (Chebyshev rings) |
| `spirale` | from the top-left corner, clockwise, inwards |

| Modifier | Effect |
|---|---|
| `inverse: true` | reverses both rank and `t`: the end becomes the beginning. With `rayonnement` this means outside-in. |
| `symetrie` | `aucune`, `horizontale`, `verticale`, `centrale` — folds the grid so the pattern mirrors instead of running once across it |

Two things worth knowing:

- Cells that share a rank share every rank-driven decision. `diagonale` gives whole diagonal bands
  the same value; `rayonnement` gives whole rings the same value.
- With `rayonnement` as the **inter** parcours, échelle 2 can never be placed (§8).

---

## 6. Colour

A colour is a **gamme** (a letter, i.e. a hue scale) plus a **nuance** (a number, i.e. a step on that
scale). The colour code is `B7`, `J2`, `K1`; `RN` is the *noir coloré* of the red gamme, which is
nuance 13.

```json
"couleur": { "gamme": { "base": "B" }, "nuance": { "base": 7 } }
```

### The bundled palette `alphabet-6x12`

OKLCH approximations of the named hues — **not** reproductions of historical pigments. Regenerate
with `npm run palette`; the recipe lives in `scripts/build-palette.ts`.

| Letter | Label | Nuances | Noir coloré |
|---|---|---|---|
| `J` | jaune de chrome | 12 | yes |
| `V` | vert émeraude | 12 | yes |
| `B` | bleu outremer | 12 | yes |
| `M` | violet de cobalt | 12 | yes |
| `R` | rouge | 12 | yes |
| `G` | gris | 12 | no |
| `K` | noir | 1 | no |
| `W` | blanc | 1 | no |

Nuance 1 is the lightest, 12 the darkest, 13 (`N`) the noir coloré. A nuance the gamme does not
offer is snapped to the nearest one it does, ties going to the lower: `G13` becomes `G12`, and `K`
is always `K1`. So you can point any axis at any gamme without checking its length first.

Read the data from code:

```js
import { getPalette, palettes } from 'graphisme-generatif';
Object.keys(palettes);                       // the bundled ids
getPalette('alphabet-6x12').gammes.B.nuances // ['#ecf2ff', ... ]
```

### Your own palette

Pass an object instead of an id:

```json
"palette": {
  "id": "mien",
  "label": "My scale",
  "gammes": {
    "A": { "label": "warm", "nuances": ["#fff0e0", "#e08040", "#602000"], "noir": "#1a0c04" },
    "Z": { "label": "cold", "nuances": ["#eef4ff", "#4060a0"] }
  }
}
```

Gamme keys are single uppercase letters; each gamme holds 1–15 lowercase `#rrggbb` nuances and an
optional `noir`. Note that the text notation records a palette **id** only, so an inline palette
cannot be exported as notation.

### The contrast rule

Two adjacent étages that share a gamme must differ by at least `contraste.minNuance` (default 3),
otherwise the inner one would disappear into the outer one. When the rule is violated the **inner**
étage moves, by the smallest step that satisfies it, preferring the side it is already on. If no
nuance works, it switches to the next gamme in the palette's key order. Corrections are counted in
`diagnostics.contrasteCorrections`.

The rule only fires **within one gamme**, so alternating between different gammes is never
"corrected".

---

## 7. Formes

Étage 0 is the fond and carries no `forme` — that is an error. Étages 1 and 2 require one.

```json
{ "couleur": { "gamme": { "base": "K" }, "nuance": { "base": 1 } },
  "forme": { "type": { "base": "c" }, "grandeur": { "base": 20 },
             "rotation": { "base": 0 }, "aspect": { "base": 1 },
             "cisaillement": { "base": 0 } } }
```

| Code | Forme | Geometry at bbox 1 |
|---|---|---|
| `c` | carré | square |
| `o` | cercle | circle |
| `l` | losange | square turned 45°, scaled back to bbox 1 |
| `t` | triangle | isosceles, base at the bottom |
| `r` | rectangle | width = `aspect`, height 1 (default `aspect` 0.6) |
| `e` | ellipse | horizontal radius `aspect`/2, vertical 1/2 (default `aspect` 0.6) |

`type`, `grandeur` are required; `rotation`, `aspect` and `cisaillement` are optional and default to
0, the type's own default, and 0.

### Size and nesting

Each étage is drawn inside the **box** of the one below it. `grandeur` is that box's side in
thirtieths: `grandeur: 30` fills the parent box, `grandeur: 15` is half of it. The next box is then
the square the forme itself inscribes:

| Parent forme | Box factor |
|---|---|
| fond (the unité square) | 1 |
| carré | 1 |
| rectangle | `min(1, aspect)` |
| cercle | 1 / √2 |
| ellipse | `min(1, aspect)` / √2 |
| losange | 1/2 |
| triangle | 0.5 |

Containment is not enforced. Rotation and shear can push a forme past its parent box; when the
overflow exceeds 5 % the generator records a note in `diagnostics.avertissements` (distinct
messages only, first-seen order, capped at 32) and carries on. Overflowing is a legitimate effect,
not a failure.

### Continuity

The alphabet is built so forms travel into each other, which is what `progression` exploits:

- carré with `rotation` 0 → 45 arrives at losange geometry;
- cercle with `aspect` 1 → 0.4 arrives at an ellipse;
- rectangle with `cisaillement` 0 → 0.3 arrives at a parallelogram.

Jumping between type codes is what `permutation` and `aleatoire` do instead.

---

## 8. `echelle` — modules at double size

```json
"echelle": { "mode": "constant" | "progression" | "aleatoire", "part": 0.3 }
```

An échelle-2 module occupies 2 × 2 slots and holds the same number of unités, each 2 × 2 base units
— so it reads as a coarser patch inside the same grid.

| `mode` | Which modules want échelle 2 |
|---|---|
| `constant` | all of them if `part ≥ 0.5`, none otherwise |
| `progression` | those with inter `t ≥ 1 − part` |
| `aleatoire` | each anchor slot with probability `part` |

Wanting it is not getting it: slots are visited in inter parcours order, and a module only grows if
its whole 2 × 2 block is still free and inside the champ. Two consequences:

- `part = 0` never produces one;
- with `rayonnement` (centre-out) the inner slots are always taken first, so **no échelle-2 module
  is ever placed**. Use `lignes`, `colonnes`, `boustrophedon` or `diagonale` when you want them.

---

## 9. `inversion` — swapping fond and noyau

```json
"inversion": { "mode": "permutation", "amplitude": 0.5, "niveau": "intra" }
```

On selected cells the colours of étage 0 and étage 1 trade places. `niveau: "inter"` selects whole
modules, `niveau: "intra"` selects individual unités. Needs at least 2 étages.

Selection uses the same four modes: `constant` (all if `amplitude ≥ 0.5`), `progression`
(`w(t) ≥ 1 − amplitude`), `permutation` (even rank, on a PRNG share `amplitude`), `aleatoire` (a
PRNG share `amplitude`). Inversion happens **before** the contrast rule.

`permutation` with `amplitude: 1` is the classic figure/ground checkerboard.

---

## 10. Recipes

The four committed profiles in [`examples/`](examples) are the starting points — `constant`,
`glissement`, `module`, `radical` — and `examples/out/` holds their output. A few patterns worth
knowing beyond them:

**A pure background, no formes.** `"unite": { "etages": 1 }` and a single étage: the champ is just
coloured squares.

**Checkerboard of two gammes.** `diagonale` as the intra parcours makes rank `x + y`, so parity
alternates perfectly:

```json
"gamme": { "base": "B",
  "intra": { "mode": "permutation", "amplitude": 1, "ensemble": ["B", "J"], "pas": 1 } }
```

**Marching bands of five hues.** The same idea with a longer ensemble and a different `pas` at each
level; `diagonale` at both levels gives diagonal bands that shift module by module:

```json
"inter": { "mode": "permutation", "amplitude": 1, "ensemble": ["B","J","R","V","M"], "pas": 1 },
"intra": { "mode": "permutation", "amplitude": 1, "ensemble": ["B","J","R","V","M"], "pas": 2 }
```

**Maximum churn.** Random gamme *and* random nuance per cell:

```json
"gamme":  { "base": "B", "intra": { "mode": "aleatoire", "amplitude": 1,
            "ensemble": ["B","J","R","V","M","G"] } },
"nuance": { "base": 7, "intra": { "mode": "aleatoire", "amplitude": 0.9 } }
```

**A slow wash across the picture.** `progression` on `nuance` at the inter level with
`rayonnement`: the value drifts from the centre outwards, every module in a ring sharing it.

**For a web background.** Generate a champ large enough for the widest viewport you support and let
`preserveAspectRatio="xMidYMid slice"` crop it. Do not regenerate on resize — output that depends on
the layout is no longer reproducible from the seed.

---

## 11. When it does not validate

`validate` returns **every** error, each with a JSON Pointer path and a stable code:

| Code | Meaning |
|---|---|
| `version` | `version` is not 1 |
| `type` | wrong JSON type, or an empty string where one is required |
| `plage` | a number outside its allowed range |
| `entier` | a non-integer where an integer is required |
| `enum` | not one of the allowed literals |
| `requis` | a required key is missing |
| `interdit` | a key that is not allowed here (a `forme` on étage 0) |
| `cle-inconnue` | an unknown key — typos are errors, not ignored |
| `longueur` | `etages` does not match `unite.etages` |
| `gamme` | not a single uppercase letter |
| `gamme-inconnue` | a gamme letter the resolved palette does not have |
| `hex` | not a lowercase `#rrggbb` colour |
| `vide` | an empty collection where one is not allowed |
| `inutile` | a key that has no effect here (`sens` outside `progression`, `inversion` with one étage) |

`generate` throws a `ParamsError` carrying the same list. The CLI prints them one per line as
`<path>: <message> [<code>]` and exits 1.

---

## 12. Where to look next

- [SPEC.md](SPEC.md) — the normative specification, including every implementation decision taken
  where the spec was ambiguous.
- [`schema/params.schema.json`](schema/params.schema.json) — JSON Schema draft 2020-12, usable in
  editors for completion and inline validation. Exported as `graphisme-generatif/schema`.
- [`examples/`](examples) — the four profiles and their committed output.
- `npm run playground` — edit params in the browser with live validation and download the result.
