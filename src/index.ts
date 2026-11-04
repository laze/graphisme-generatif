/**
 * Public API (SPEC Section 11).
 */

import { type GenerateDeps, ParamsError, generateAvec } from './core/generate.js';
import type { Params, Programmation } from './core/types.js';
import { getPalette, palettes } from './palette/index.js';
import { validate, valideGammes } from './validate/validate.js';

const deps: GenerateDeps = { getPalette, validate };

/** params -> programmation. Throws `ParamsError` on invalid input. */
export function generate(params: Params): Programmation {
  const p = generateAvec(params, deps);
  const palette = typeof params.palette === 'string' ? getPalette(params.palette) : params.palette;
  const erreurs = valideGammes(params, palette);
  if (erreurs.length > 0) throw new ParamsError(erreurs);
  return p;
}

export { validate, ParamsError, getPalette, palettes };
export { encode } from './notation/encode.js';
export { decode } from './notation/decode.js';
export { paramsSchema } from './validate/schema.js';

export type {
  Axis,
  Diagnostics,
  Erreur,
  EtagePlace,
  EtageSpec,
  FormePlacee,
  FormeSpec,
  FormeType,
  Gamme,
  InversionSpec,
  Palette,
  Params,
  Parcours,
  ParcoursType,
  Programmation,
  UnitePlacee,
  ValidationResult,
  Variation,
} from './core/types.js';
