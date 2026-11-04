/**
 * Regenerates `examples/out/*.svg|.json|.txt` from `examples/*.json`.
 * The output is committed and compared byte for byte by a golden test.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { SORTIE, construitExemple, nomsExemples } from './examples.js';

mkdirSync(SORTIE, { recursive: true });

for (const nom of nomsExemples()) {
  const s = construitExemple(nom);
  writeFileSync(join(SORTIE, `${nom}.json`), s.json, 'utf8');
  writeFileSync(join(SORTIE, `${nom}.svg`), s.svg, 'utf8');
  writeFileSync(join(SORTIE, `${nom}.txt`), s.notation, 'utf8');
  const a = s.programmation.diagnostics;
  process.stdout.write(
    `${nom}: ${s.programmation.unites.length} unites, ` +
      `${a.contrasteCorrections} contrast corrections, ` +
      `${a.avertissements.length} warnings\n`,
  );
}
