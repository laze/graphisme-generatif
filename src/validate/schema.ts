/**
 * JSON Schema (draft 2020-12) for Params (SPEC Section 8).
 *
 * The schema is built from the same key lists the hand-written validator uses,
 * and the type-level assertions at the bottom fail the typecheck as soon as a
 * key is added to or removed from an interface. `schema/params.schema.json` is
 * the committed serialisation of `paramsSchema`; a test keeps the file equal.
 */

import {
  type Axis,
  ECHELLE_MODES,
  type EchelleSpec,
  type EtageSpec,
  FORME_TYPES,
  type FormeSpec,
  type Gamme,
  type InversionSpec,
  MODES,
  NIVEAUX,
  ONDES,
  PARCOURS_TYPES,
  PLAGES,
  type Palette,
  type Params,
  type Parcours,
  SYMETRIES,
  type Variation,
} from '../core/types.js';
import {
  type CLES_AXIS,
  CLES_CHAMP,
  CLES_CONTRASTE,
  CLES_COULEUR,
  CLES_ECHELLE,
  type CLES_ETAGE,
  type CLES_FORME,
  type CLES_GAMME,
  CLES_INVERSION,
  CLES_MODULE,
  CLES_PALETTE,
  type CLES_PARAMS,
  type CLES_PARCOURS,
  type CLES_UNITE,
  type CLES_VARIATION,
} from './validate.js';

export type JsonSchema = Record<string, unknown>;

type Proprietes<L extends readonly string[]> = Record<L[number], JsonSchema>;

const ref = (nom: string): JsonSchema => ({ $ref: `#/$defs/${nom}` });

const HEX = { type: 'string', pattern: '^#[0-9a-f]{6}$' } satisfies JsonSchema;

function variation(categorique: boolean, items: JsonSchema): JsonSchema {
  const properties: Proprietes<typeof CLES_VARIATION> = {
    mode: { enum: [...MODES] },
    amplitude: { type: 'number', minimum: 0, maximum: 1 },
    onde: { enum: [...ONDES], default: 'rampe' },
    periode: { type: 'number', exclusiveMinimum: 0, maximum: 64, default: 1 },
    sens: { enum: [1, -1], default: 1 },
    ensemble: {
      type: 'array',
      minItems: 1,
      items: categorique ? items : { type: 'number' },
      description: categorique
        ? 'ordered set of values'
        : 'ordered set of offsets added to the axis value',
    },
    pas: { type: 'integer', minimum: 1, maximum: 1024, default: 1 },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['mode', 'amplitude'],
    properties,
  };
}

function axe(valeur: JsonSchema, nomVariation: string): JsonSchema {
  const properties: Proprietes<typeof CLES_AXIS> = {
    base: valeur,
    inter: ref(nomVariation),
    intra: ref(nomVariation),
  };
  return { type: 'object', additionalProperties: false, required: ['base'], properties };
}

const VALEUR_GAMME: JsonSchema = { type: 'string', pattern: '^[A-Z]$' };
const VALEUR_TYPE: JsonSchema = { enum: [...FORME_TYPES] };

function valeurNumerique(nom: keyof typeof PLAGES): JsonSchema {
  const p = PLAGES[nom];
  return { type: p.entier ? 'integer' : 'number', minimum: p.min, maximum: p.max };
}

const proprietesParams: Proprietes<typeof CLES_PARAMS> = {
  version: { const: 1 },
  seed: { type: 'string', minLength: 1 },
  palette: {
    oneOf: [{ type: 'string', minLength: 1 }, ref('palette')],
    description: 'id of a bundled palette, or an inline palette',
  },
  champ: {
    type: 'object',
    additionalProperties: false,
    required: [...CLES_CHAMP],
    properties: {
      modulesX: { type: 'integer', minimum: 1, maximum: 64 },
      modulesY: { type: 'integer', minimum: 1, maximum: 64 },
    } satisfies Proprietes<typeof CLES_CHAMP>,
  },
  module: {
    type: 'object',
    additionalProperties: false,
    required: [...CLES_MODULE],
    properties: {
      colonnes: { type: 'integer', minimum: 1, maximum: 12 },
      rangees: { type: 'integer', minimum: 1, maximum: 12 },
    } satisfies Proprietes<typeof CLES_MODULE>,
  },
  echelle: ref('echelle'),
  parcours: {
    type: 'object',
    additionalProperties: false,
    required: ['inter', 'intra'],
    properties: { inter: ref('parcours'), intra: ref('parcours') },
  },
  unite: {
    type: 'object',
    additionalProperties: false,
    required: ['etages'],
    properties: {
      etages: { enum: [1, 2, 3] },
      joint: { type: 'number', minimum: 0, maximum: 0.2, default: 0 },
    } satisfies Proprietes<typeof CLES_UNITE>,
  },
  etages: {
    type: 'array',
    minItems: 1,
    maxItems: 3,
    items: ref('etage'),
    description: 'length must equal unite.etages; index 0 is the fond and carries no forme',
  },
  contraste: {
    type: 'object',
    additionalProperties: false,
    required: [...CLES_CONTRASTE],
    properties: {
      minNuance: { type: 'integer', minimum: 0, maximum: 12, default: 3 },
    } satisfies Proprietes<typeof CLES_CONTRASTE>,
  },
  inversion: ref('inversion'),
};

export const paramsSchema: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://github.com/graphisme-generatif/schema/params.schema.json',
  title: 'Params',
  description: 'Input parameters of the programmation stage (SPEC Section 8).',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'seed', 'palette', 'champ', 'module', 'parcours', 'unite', 'etages'],
  properties: proprietesParams,
  $defs: {
    variationNumerique: variation(false, { type: 'number' }),
    variationGamme: variation(true, VALEUR_GAMME),
    variationType: variation(true, VALEUR_TYPE),
    axeNuance: axe(valeurNumerique('nuance'), 'variationNumerique'),
    axeGrandeur: axe(valeurNumerique('grandeur'), 'variationNumerique'),
    axeRotation: axe(valeurNumerique('rotation'), 'variationNumerique'),
    axeAspect: axe(valeurNumerique('aspect'), 'variationNumerique'),
    axeCisaillement: axe(valeurNumerique('cisaillement'), 'variationNumerique'),
    axeGamme: axe(VALEUR_GAMME, 'variationGamme'),
    axeType: axe(VALEUR_TYPE, 'variationType'),
    parcours: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { enum: [...PARCOURS_TYPES] },
        inverse: { type: 'boolean', default: false },
        symetrie: { enum: [...SYMETRIES], default: 'aucune' },
      } satisfies Proprietes<typeof CLES_PARCOURS>,
    },
    echelle: {
      type: 'object',
      additionalProperties: false,
      required: [...CLES_ECHELLE],
      properties: {
        mode: { enum: [...ECHELLE_MODES] },
        part: { type: 'number', minimum: 0, maximum: 1 },
      } satisfies Proprietes<typeof CLES_ECHELLE>,
    },
    inversion: {
      type: 'object',
      additionalProperties: false,
      required: [...CLES_INVERSION],
      properties: {
        mode: { enum: [...MODES] },
        amplitude: { type: 'number', minimum: 0, maximum: 1 },
        niveau: { enum: [...NIVEAUX] },
      } satisfies Proprietes<typeof CLES_INVERSION>,
    },
    etage: {
      type: 'object',
      additionalProperties: false,
      required: ['couleur'],
      properties: {
        couleur: {
          type: 'object',
          additionalProperties: false,
          required: [...CLES_COULEUR],
          properties: {
            gamme: ref('axeGamme'),
            nuance: ref('axeNuance'),
          } satisfies Proprietes<typeof CLES_COULEUR>,
        },
        forme: ref('forme'),
      } satisfies Proprietes<typeof CLES_ETAGE>,
    },
    forme: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'grandeur'],
      properties: {
        type: ref('axeType'),
        grandeur: ref('axeGrandeur'),
        rotation: ref('axeRotation'),
        aspect: ref('axeAspect'),
        cisaillement: ref('axeCisaillement'),
      } satisfies Proprietes<typeof CLES_FORME>,
    },
    palette: {
      type: 'object',
      additionalProperties: false,
      required: [...CLES_PALETTE],
      properties: {
        id: { type: 'string', minLength: 1 },
        label: { type: 'string' },
        gammes: {
          type: 'object',
          minProperties: 1,
          propertyNames: { pattern: '^[A-Z]$' },
          additionalProperties: ref('gamme'),
        },
      } satisfies Proprietes<typeof CLES_PALETTE>,
    },
    gamme: {
      type: 'object',
      additionalProperties: false,
      required: ['label', 'nuances'],
      properties: {
        label: { type: 'string' },
        nuances: { type: 'array', minItems: 1, maxItems: 15, items: HEX },
        noir: HEX,
      } satisfies Proprietes<typeof CLES_GAMME>,
    },
  },
};

// --- compile-time sync between the key lists and the interfaces ------------

type Egal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;

export type SyncParams = Assert<Egal<(typeof CLES_PARAMS)[number], keyof Params>>;
export type SyncVariation = Assert<Egal<(typeof CLES_VARIATION)[number], keyof Variation<unknown>>>;
export type SyncAxis = Assert<Egal<(typeof CLES_AXIS)[number], keyof Axis<unknown>>>;
export type SyncParcours = Assert<Egal<(typeof CLES_PARCOURS)[number], keyof Parcours>>;
export type SyncChamp = Assert<Egal<(typeof CLES_CHAMP)[number], keyof Params['champ']>>;
export type SyncModule = Assert<Egal<(typeof CLES_MODULE)[number], keyof Params['module']>>;
export type SyncEchelle = Assert<Egal<(typeof CLES_ECHELLE)[number], keyof EchelleSpec>>;
export type SyncUnite = Assert<Egal<(typeof CLES_UNITE)[number], keyof Params['unite']>>;
export type SyncEtage = Assert<Egal<(typeof CLES_ETAGE)[number], keyof EtageSpec>>;
export type SyncCouleur = Assert<Egal<(typeof CLES_COULEUR)[number], keyof EtageSpec['couleur']>>;
export type SyncForme = Assert<Egal<(typeof CLES_FORME)[number], keyof FormeSpec>>;
export type SyncContraste = Assert<
  Egal<(typeof CLES_CONTRASTE)[number], keyof NonNullable<Params['contraste']>>
>;
export type SyncInversion = Assert<Egal<(typeof CLES_INVERSION)[number], keyof InversionSpec>>;
export type SyncPalette = Assert<Egal<(typeof CLES_PALETTE)[number], keyof Palette>>;
export type SyncGamme = Assert<Egal<(typeof CLES_GAMME)[number], keyof Gamme>>;
