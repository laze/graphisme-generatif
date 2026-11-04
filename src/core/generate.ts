/**
 * Programmation stage: params -> programmation (SPEC Sections 3, 6, 7, 9.1).
 *
 * Pure and deterministic. Produces data only; no geometry, no pixels.
 */

import { type Couleur, ajusteNuance, appliqueContraste, codeCouleur } from './contraste.js';
import { type Classement, classement } from './parcours.js';
import { placer } from './placement.js';
import { stream } from './prng.js';
import {
  type Axis,
  type Erreur,
  type EtageSpec,
  type FormePlacee,
  type FormeType,
  PLAGES,
  type Palette,
  type Params,
  type Plage,
  type Programmation,
  type UnitePlacee,
  type ValidationResult,
  type Variation,
} from './types.js';
import {
  type ContexteCellule,
  contexte,
  finaliser,
  nbTirages,
  offsetNumerique,
  selectionne,
  tirages,
  valeurCategorique,
} from './variation.js';

/** Box side factor of an etage's forme, as a fraction of its bbox side (SPEC Section 3.3). */
export function facteurBoite(type: FormeType, aspect: number): number {
  switch (type) {
    case 'c':
      return 1;
    case 'o':
      return 1 / Math.SQRT2;
    case 'e':
      return Math.min(1, aspect) / Math.SQRT2;
    case 'l':
      return 1 / 2;
    case 'r':
      return Math.min(1, aspect);
    case 't':
      return 0.5;
  }
}

/** Default aspect of a forme type (SPEC Section 3.4). */
export function aspectDefaut(type: FormeType): number {
  return type === 'r' || type === 'e' ? 0.6 : 1;
}

export class ParamsError extends Error {
  readonly erreurs: Erreur[];
  constructor(erreurs: Erreur[]) {
    super(
      `invalid params: ${erreurs.length} error(s)\n${erreurs
        .map((e) => `  ${e.chemin}: ${e.message}`)
        .join('\n')}`,
    );
    this.name = 'ParamsError';
    this.erreurs = erreurs;
  }
}

// ---------------------------------------------------------------------------
// Axis plumbing
// ---------------------------------------------------------------------------

const AXES_NUM = [
  'couleur.nuance',
  'forme.grandeur',
  'forme.rotation',
  'forme.aspect',
  'forme.cisaillement',
] as const;
type NomAxeNum = (typeof AXES_NUM)[number];

const PLAGE_PAR_AXE: Record<NomAxeNum, Plage> = {
  'couleur.nuance': PLAGES.nuance,
  'forme.grandeur': PLAGES.grandeur,
  'forme.rotation': PLAGES.rotation,
  'forme.aspect': PLAGES.aspect,
  'forme.cisaillement': PLAGES.cisaillement,
};

function axeNum(e: EtageSpec, nom: NomAxeNum): Axis<number> | undefined {
  switch (nom) {
    case 'couleur.nuance':
      return e.couleur.nuance;
    case 'forme.grandeur':
      return e.forme?.grandeur;
    case 'forme.rotation':
      return e.forme?.rotation;
    case 'forme.aspect':
      return e.forme?.aspect;
    case 'forme.cisaillement':
      return e.forme?.cisaillement;
  }
}

type Tir = Map<number, number[]>;
const VIDE: Tir = new Map();

function creerTirages(
  v: Variation<unknown> | undefined,
  categorique: boolean,
  cls: Classement,
  seed: string,
  chemin: string[],
): Tir {
  if (!v || nbTirages(v, categorique) === 0) return VIDE;
  return tirages(v, categorique, cls, stream(seed, ...chemin));
}

interface TirEtage {
  gamme: Tir;
  type: Tir;
  num: Record<NomAxeNum, Tir>;
}

function tiragesEtage(
  e: EtageSpec,
  k: number,
  niveau: 'inter' | 'intra',
  cls: Classement,
  seed: string,
  prefixe: string[],
): TirEtage {
  const choisir = <T>(a: Axis<T> | undefined): Variation<T> | undefined =>
    niveau === 'inter' ? a?.inter : a?.intra;
  const chemin = (nom: string) => [...prefixe, `etage${k}`, nom];
  const num = {} as Record<NomAxeNum, Tir>;
  for (const nom of AXES_NUM) {
    num[nom] = creerTirages(choisir(axeNum(e, nom)), false, cls, seed, chemin(nom));
  }
  return {
    gamme: creerTirages(choisir(e.couleur.gamme), true, cls, seed, chemin('couleur.gamme')),
    type: creerTirages(choisir(e.forme?.type), true, cls, seed, chemin('forme.type')),
    num,
  };
}

/** Values an etage inherits from its module (SPEC Section 6.3, step 2). */
interface ValeursInter {
  gamme: string;
  type: FormeType | undefined;
  offsets: Record<NomAxeNum, number>;
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

export interface GenerateDeps {
  /** resolves a bundled palette id; injected so core stays free of palette data */
  getPalette(id: string): Palette;
  validate(params: unknown): ValidationResult;
}

export function generateAvec(params: Params, deps: GenerateDeps): Programmation {
  const verdict = deps.validate(params);
  if (!verdict.ok) throw new ParamsError(verdict.erreurs);
  const p = verdict.params;

  const inline = typeof p.palette === 'string' ? undefined : p.palette;
  const palette = inline ?? deps.getPalette(p.palette as string);
  const seed = p.seed;
  const { modulesX, modulesY } = p.champ;
  const { colonnes, rangees } = p.module;
  const minNuance = p.contraste?.minNuance ?? 3;
  const nEtages = p.unite.etages;
  const joint = p.unite.joint ?? 0;

  const avertissements: string[] = [];
  const vus = new Set<string>();
  const avertir = (m: string): void => {
    if (vus.has(m) || vus.size >= 32) return;
    vus.add(m);
    avertissements.push(m);
  };

  const clsInter = classement(p.parcours.inter, modulesX, modulesY);
  const clsIntra = classement(p.parcours.intra, colonnes, rangees);

  const placement = placer(
    p.echelle ?? { mode: 'constant', part: 0 },
    clsInter,
    modulesX,
    modulesY,
    stream(seed, 'echelle'),
  );

  // --- inter level: one set of values per module --------------------------
  const tirInter = p.etages.map((e, k) => tiragesEtage(e, k, 'inter', clsInter, seed, ['inter']));
  const tirInversionInter =
    p.inversion && p.inversion.niveau === 'inter'
      ? creerTirages(
          { mode: p.inversion.mode, amplitude: p.inversion.amplitude },
          false,
          clsInter,
          seed,
          ['inversion', 'inter'],
        )
      : VIDE;

  const valeursInter: ValeursInter[][] = placement.modules.map((m) =>
    p.etages.map((e, k) => {
      const te = tirInter[k] as TirEtage;
      const ctxG = contexte(clsInter, m.ax, m.ay, te.gamme);
      const gamme = valeurCategorique(e.couleur.gamme.inter, e.couleur.gamme.base, ctxG, avertir);
      const ctxT = contexte(clsInter, m.ax, m.ay, te.type);
      const type = e.forme
        ? valeurCategorique(e.forme.type.inter, e.forme.type.base, ctxT, avertir)
        : undefined;
      const offsets = {} as Record<NomAxeNum, number>;
      for (const nom of AXES_NUM) {
        const ctx = contexte(clsInter, m.ax, m.ay, te.num[nom]);
        offsets[nom] = offsetNumerique(axeNum(e, nom)?.inter, PLAGE_PAR_AXE[nom], ctx);
      }
      return { gamme, type, offsets };
    }),
  );

  const inversionInter: boolean[] = placement.modules.map((m) => {
    if (!p.inversion || p.inversion.niveau !== 'inter') return false;
    const ctx = contexte(clsInter, m.ax, m.ay, tirInversionInter);
    return selectionne(p.inversion.mode, p.inversion.amplitude, ctx);
  });

  // --- intra level: per module, per unite ---------------------------------
  const unites: UnitePlacee[] = [];
  let contrasteCorrections = 0;

  for (let mi = 0; mi < placement.modules.length; mi++) {
    const m = placement.modules[mi] as (typeof placement.modules)[number];
    const cle = `module:${m.ax},${m.ay}`;
    const tirIntra = p.etages.map((e, k) =>
      tiragesEtage(e, k, 'intra', clsIntra, seed, ['intra', cle]),
    );
    const tirInversionIntra =
      p.inversion && p.inversion.niveau === 'intra'
        ? creerTirages(
            { mode: p.inversion.mode, amplitude: p.inversion.amplitude },
            false,
            clsIntra,
            seed,
            ['inversion', 'intra', cle],
          )
        : VIDE;

    const vi = valeursInter[mi] as ValeursInter[];
    const taille = m.echelle;
    const ox = m.ax * colonnes;
    const oy = m.ay * rangees;

    for (let cy = 0; cy < rangees; cy++) {
      for (let cx = 0; cx < colonnes; cx++) {
        const couleurs: Couleur[] = [];
        const formes: (FormePlacee | undefined)[] = [];

        for (let k = 0; k < nEtages; k++) {
          const e = p.etages[k] as EtageSpec;
          const te = tirIntra[k] as TirEtage;
          const base = vi[k] as ValeursInter;

          const ctxG = contexte(clsIntra, cx, cy, te.gamme);
          const gamme = valeurCategorique(e.couleur.gamme.intra, base.gamme, ctxG, avertir);

          const val = (nom: NomAxeNum, depart: number): number => {
            const ctx: ContexteCellule = contexte(clsIntra, cx, cy, te.num[nom]);
            const brut =
              depart +
              (base.offsets[nom] ?? 0) +
              offsetNumerique(axeNum(e, nom)?.intra, PLAGE_PAR_AXE[nom], ctx);
            return finaliser(brut, PLAGE_PAR_AXE[nom]);
          };

          const nuance = ajusteNuance(palette, gamme, val('couleur.nuance', e.couleur.nuance.base));
          couleurs.push({ gamme, nuance });

          if (e.forme && base.type) {
            const ctxT = contexte(clsIntra, cx, cy, te.type);
            const type = valeurCategorique(e.forme.type.intra, base.type, ctxT, avertir);
            const grandeur = val('forme.grandeur', e.forme.grandeur.base);
            const rotation = e.forme.rotation ? val('forme.rotation', e.forme.rotation.base) : 0;
            const aspect = e.forme.aspect
              ? val('forme.aspect', e.forme.aspect.base)
              : aspectDefaut(type);
            const cisaillement = e.forme.cisaillement
              ? val('forme.cisaillement', e.forme.cisaillement.base)
              : 0;
            formes.push({ type, grandeur, rotation, aspect, cisaillement });
          } else {
            formes.push(undefined);
          }
        }

        // Inversion (SPEC Section 6.4), applied before the contrast rule.
        let inverse = inversionInter[mi] ?? false;
        if (p.inversion && p.inversion.niveau === 'intra') {
          const ctx = contexte(clsIntra, cx, cy, tirInversionIntra);
          inverse = selectionne(p.inversion.mode, p.inversion.amplitude, ctx);
        }
        if (inverse && couleurs.length >= 2) {
          const a = couleurs[0] as Couleur;
          couleurs[0] = couleurs[1] as Couleur;
          couleurs[1] = a;
        }

        const ct = appliqueContraste(couleurs, palette, minNuance);
        contrasteCorrections += ct.corrections;

        // Containment check (SPEC Section 3.3).
        let boite = taille * (1 - joint);
        for (let k = 1; k < nEtages; k++) {
          const f = formes[k];
          if (!f) break;
          const cote = boite * (f.grandeur / 30);
          if (deborde(cote, f, boite)) {
            avertir(`etage ${k}: transformed bbox exceeds its parent box by more than 5%`);
          }
          boite = cote * facteurBoite(f.type, f.aspect);
        }

        unites.push({
          x: ox + cx * taille,
          y: oy + cy * taille,
          echelle: m.echelle,
          module: [m.ax, m.ay],
          fond: codeCouleur(ct.couleurs[0] as Couleur),
          etages: formes.slice(1, nEtages).map((f, i) => ({
            forme: f as FormePlacee,
            couleur: codeCouleur(ct.couleurs[i + 1] as Couleur),
          })),
        });
      }
    }
  }

  unites.sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    version: 1,
    seed,
    palette: typeof p.palette === 'string' ? p.palette : p.palette.id,
    ...(inline ? { paletteInline: inline } : {}),
    largeur: modulesX * colonnes,
    hauteur: modulesY * rangees,
    unites,
    diagnostics: { contrasteCorrections, avertissements },
  };
}

/**
 * Axis-aligned bbox of the sheared-then-rotated forme, compared with the parent
 * box side. An approximation, good enough for a warning.
 */
function deborde(cote: number, f: FormePlacee, boiteParent: number): boolean {
  const hw = (cote * f.aspect) / 2;
  const hh = cote / 2;
  const hwc = hw + Math.abs(f.cisaillement) * hh;
  const a = (f.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const bw = hwc * cos + hh * sin;
  const bh = hwc * sin + hh * cos;
  return 2 * Math.max(bw, bh) > boiteParent * 1.05;
}
