/** Writes `schema/params.schema.json` from `paramsSchema` (SPEC Section 8). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { paramsSchema } from '../src/validate/schema.js';

const sortie = resolve(process.cwd(), 'schema/params.schema.json');
mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, `${JSON.stringify(paramsSchema, null, 2)}\n`, 'utf8');
console.log(`wrote ${sortie}`);
