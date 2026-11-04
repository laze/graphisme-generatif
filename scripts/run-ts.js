// Runs a TypeScript script with no extra dev dependency: bundles it with tsup
// into .tmp/ and executes the result with the current Node. Keeps the dev
// dependency list of SPEC Section 12 intact.
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import process from 'node:process';

const [entry, ...rest] = process.argv.slice(2);
if (!entry) {
  console.error('usage: node scripts/run-ts.js <script.ts> [args...]');
  process.exit(2);
}

const outDir = '.tmp';
const build = spawnSync(
  'npx',
  ['tsup', entry, '--format', 'esm', '--out-dir', outDir, '--silent', '--no-config'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const js = resolve(process.cwd(), outDir, `${basename(entry).replace(/\.ts$/, '')}.js`);
const run = spawnSync(process.execPath, [js, ...rest], { stdio: 'inherit' });
process.exit(run.status ?? 1);
