/**
 * Domain types for the programmation stage (SPEC Sections 3, 4, 5, 6, 8, 9).
 *
 * Domain identifiers use the French terms of SPEC Section 2 without diacritics.
 */

// ---------------------------------------------------------------------------
// Palette (SPEC Section 4.1)
// ---------------------------------------------------------------------------

export interface Gamme {
  label: string;
  /** hex "#rrggbb", index 0 = nuance 1 (lightest). 1-15 entries. */
  nuances: string[];
  /** hex for nuance "N" (noir colore), optional. */
  noir?: string;
}

export interface Palette {
  id: string;
  label: string;
  /** key: single uppercase letter A-Z. Key order is significant (SPEC 4.4). */
  gammes: Record<string, Gamme>;
}

// ---------------------------------------------------------------------------
// Alphabet (SPEC Section 3.4)
// ---------------------------------------------------------------------------

export const FORME_TYPES = ['c', 'o', 'l', 't', 'r', 'e'] as const;
export type FormeType = (typeof FORME_TYPES)[number];

// ---------------------------------------------------------------------------
// Parcours (SPEC Section 5)
// ---------------------------------------------------------------------------

export const PARCOURS_TYPES = [
  'lignes',
  'colonnes',
  'boustrophedon',
  'diagonale',
  'rayonnement',
  'spirale',
] as const;
export type ParcoursType = (typeof PARCOURS_TYPES)[number];

export const SYMETRIES = ['aucune', 'horizontale', 'verticale', 'centrale'] as const;
export type Symetrie = (typeof SYMETRIES)[number];

export interface Parcours {
  type: ParcoursType;
  /** reverse direction: rank -> maxRank - rank, t -> 1 - t */
  inverse?: boolean;
  symetrie?: Symetrie;
}

// ---------------------------------------------------------------------------
// Variation (SPEC Section 6)
// ---------------------------------------------------------------------------

export const MODES = ['constant', 'progression', 'permutation', 'aleatoire'] as const;
export type Mode = (typeof MODES)[number];

export const ONDES = ['rampe', 'triangle', 'sinus'] as const;
export type Onde = (typeof ONDES)[number];

export interface Variation<T> {
  mode: Mode;
  /** 0-1 */
  amplitude: number;
  /** progression only, default 'rampe' */
  onde?: Onde;
  /** progression: cycles across t in [0,1], default 1 */
  periode?: number;
  /** progression on numeric axes, default 1 */
  sens?: 1 | -1;
  /** permutation / aleatoire / categorical progression */
  ensemble?: T[];
  /** permutation step, integer >= 1, default 1 */
  pas?: number;
}

export interface Axis<T> {
  base: T;
  /** driven by the module's t / rank in the champ */
  inter?: Variation<T>;
  /** driven by the unite's t / rank in its module */
  intra?: Variation<T>;
}

// ---------------------------------------------------------------------------
// Params (SPEC Section 8)
// ---------------------------------------------------------------------------

export const ECHELLE_MODES = ['constant', 'progression', 'aleatoire'] as const;
export type EchelleMode = (typeof ECHELLE_MODES)[number];

export interface EchelleSpec {
  mode: EchelleMode;
  /** 0-1 */
  part: number;
}

export const NIVEAUX = ['inter', 'intra'] as const;
export type Niveau = (typeof NIVEAUX)[number];

export interface InversionSpec {
  mode: Mode;
  amplitude: number;
  niveau: Niveau;
}

export interface FormeSpec {
  type: Axis<FormeType>;
  grandeur: Axis<number>;
  rotation?: Axis<number>;
  aspect?: Axis<number>;
  cisaillement?: Axis<number>;
}

export interface EtageSpec {
  couleur: { gamme: Axis<string>; nuance: Axis<number> };
  /** required for etages >= 1, forbidden for etage 0 */
  forme?: FormeSpec;
}

export interface Params {
  version: 1;
  seed: string;
  /** id of a bundled palette or an inline palette */
  palette: string | Palette;
  champ: { modulesX: number; modulesY: number };
  module: { colonnes: number; rangees: number };
  echelle?: EchelleSpec;
  parcours: { inter: Parcours; intra: Parcours };
  unite: { etages: 1 | 2 | 3; joint?: number };
  /** length === unite.etages */
  etages: EtageSpec[];
  contraste?: { minNuance: number };
  inversion?: InversionSpec;
}

// ---------------------------------------------------------------------------
// Programmation (SPEC Section 9.1)
// ---------------------------------------------------------------------------

export interface FormePlacee {
  type: FormeType;
  grandeur: number;
  rotation: number;
  aspect: number;
  cisaillement: number;
}

export interface EtagePlace {
  forme: FormePlacee;
  couleur: string;
}

export interface UnitePlacee {
  /** top-left, base units */
  x: number;
  y: number;
  echelle: 1 | 2;
  /** anchor slot of its module */
  module: [number, number];
  /** colour code of etage 0 */
  fond: string;
  /** etage 1..n */
  etages: EtagePlace[];
}

export interface Diagnostics {
  contrasteCorrections: number;
  avertissements: string[];
}

export interface Programmation {
  version: 1;
  seed: string;
  /** palette id */
  palette: string;
  paletteInline?: Palette;
  /** champ width in base units */
  largeur: number;
  /** champ height in base units */
  hauteur: number;
  /** sorted by y, then x */
  unites: UnitePlacee[];
  diagnostics: Diagnostics;
}

// ---------------------------------------------------------------------------
// Validation (SPEC Section 11)
// ---------------------------------------------------------------------------

export interface Erreur {
  /** JSON path, e.g. "/etages/1/forme/grandeur/base" */
  chemin: string;
  message: string;
  code: string;
}

export type ValidationResult = { ok: true; params: Params } | { ok: false; erreurs: Erreur[] };

// ---------------------------------------------------------------------------
// Axis ranges (SPEC Section 6.1)
// ---------------------------------------------------------------------------

export interface Plage {
  min: number;
  max: number;
  /** integers are rounded half away from zero after summation */
  entier: boolean;
  /** rotation wraps instead of clamping */
  wrap: boolean;
}

export const PLAGES = {
  nuance: { min: 1, max: 13, entier: true, wrap: false },
  grandeur: { min: 1, max: 30, entier: true, wrap: false },
  rotation: { min: 0, max: 360, entier: false, wrap: true },
  aspect: { min: 0.2, max: 1, entier: false, wrap: false },
  cisaillement: { min: -0.5, max: 0.5, entier: false, wrap: false },
} as const satisfies Record<string, Plage>;

export type AxeNumerique = keyof typeof PLAGES;

/** nuance 13 is the noir colore "N" (SPEC Sections 4.3, 6.1). */
export const NUANCE_NOIR = 13;

export function assertNever(x: never, message = 'unexpected variant'): never {
  throw new Error(`${message}: ${JSON.stringify(x)}`);
}
