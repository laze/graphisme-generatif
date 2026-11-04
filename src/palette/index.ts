/**
 * Bundled palettes (SPEC Section 4). Data only: the runtime never converts
 * colours, it reads hex values. See `scripts/build-palette.ts` for generation.
 */

import type { Palette } from '../core/types.js';
import alphabet6x12 from './alphabet-6x12.json';

export const palettes: Record<string, Palette> = {
  'alphabet-6x12': alphabet6x12 as Palette,
};

export function getPalette(id: string): Palette {
  const p = palettes[id];
  if (!p) {
    throw new Error(
      `unknown palette ${JSON.stringify(id)}; available: ${Object.keys(palettes).join(', ')}`,
    );
  }
  return p;
}
