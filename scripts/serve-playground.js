/**
 * Static file server for the playground. Zero dependencies, development only:
 * it serves the repository root so `playground/index.html` can import the
 * built bundle from `dist/` and fetch the files under `examples/`.
 *
 *   node scripts/serve-playground.js [port]
 */

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import process from 'node:process';

const RACINE = resolve(process.cwd());
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function cheminSur(url) {
  const brut = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const chemin = resolve(RACINE, `.${normalize(brut)}`);
  return chemin === RACINE || chemin.startsWith(RACINE + sep) ? chemin : null;
}

const serveur = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed\n');
    return;
  }

  let chemin = cheminSur(req.url ?? '/');
  if (chemin === null) {
    res.writeHead(403).end('forbidden\n');
    return;
  }

  let info;
  try {
    info = statSync(chemin);
    if (info.isDirectory()) {
      chemin = join(chemin, 'index.html');
      info = statSync(chemin);
    }
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found\n');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(chemin).pipe(res);
});

serveur.listen(PORT, () => {
  process.stdout.write(`playground: http://localhost:${PORT}/playground/\n`);
});
