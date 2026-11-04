#!/usr/bin/env node
/**
 * CLI (SPEC Section 11).
 *
 *   graphisme-generatif generate <params.json> [--seed <s>] [--out <file.svg>]
 *                                [--json <file.json>] [--notation <file.txt>] [--taille <px>]
 *   graphisme-generatif render <programmation.json|.txt> [--out <file.svg>] [--taille <px>]
 *   graphisme-generatif validate <params.json>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { ParamsError } from '../core/generate.js';
import type { Palette, Programmation } from '../core/types.js';
import { generate } from '../index.js';
import { decode } from '../notation/decode.js';
import { encode } from '../notation/encode.js';
import { getPalette } from '../palette/index.js';
import { renderSVG } from '../render/svg.js';
import { validate } from '../validate/validate.js';

const USAGE = `graphisme-generatif <commande>

  generate <params.json> [--seed <s>] [--out <file.svg>] [--json <file.json>]
                         [--notation <file.txt>] [--taille <px>]
  render   <programmation.json|.txt> [--out <file.svg>] [--taille <px>]
  validate <params.json>
`;

class ErreurCli extends Error {}

interface Options {
  seed?: string;
  out?: string;
  json?: string;
  notation?: string;
  taille?: number;
}

const DRAPEAUX = ['--seed', '--out', '--json', '--notation', '--taille'] as const;
type Drapeau = (typeof DRAPEAUX)[number];

function analyse(args: string[], permis: readonly Drapeau[]): { entree: string; opts: Options } {
  let entree: string | undefined;
  const brut = new Map<Drapeau, string>();

  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (!a.startsWith('--')) {
      if (entree !== undefined) throw new ErreurCli(`unexpected argument ${JSON.stringify(a)}`);
      entree = a;
      continue;
    }
    if (!(DRAPEAUX as readonly string[]).includes(a)) {
      throw new ErreurCli(`unknown option ${JSON.stringify(a)}`);
    }
    const d = a as Drapeau;
    if (!permis.includes(d)) throw new ErreurCli(`option ${a} is not valid for this command`);
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) throw new ErreurCli(`option ${a} needs a value`);
    brut.set(d, v);
    i++;
  }

  if (entree === undefined) throw new ErreurCli('missing input file');

  const opts: Options = {};
  const seed = brut.get('--seed');
  if (seed !== undefined) opts.seed = seed;
  const out = brut.get('--out');
  if (out !== undefined) opts.out = out;
  const json = brut.get('--json');
  if (json !== undefined) opts.json = json;
  const notation = brut.get('--notation');
  if (notation !== undefined) opts.notation = notation;
  const taille = brut.get('--taille');
  if (taille !== undefined) {
    const n = Number(taille);
    if (!Number.isFinite(n) || n <= 0) throw new ErreurCli('--taille must be a positive number');
    opts.taille = n;
  }
  return { entree, opts };
}

function lire(chemin: string): string {
  try {
    return readFileSync(chemin, 'utf8');
  } catch {
    throw new ErreurCli(`cannot read ${JSON.stringify(chemin)}`);
  }
}

function lireJson(chemin: string): unknown {
  try {
    return JSON.parse(lire(chemin));
  } catch (e) {
    if (e instanceof ErreurCli) throw e;
    throw new ErreurCli(`${chemin} is not valid JSON`);
  }
}

function ecrire(chemin: string, contenu: string): void {
  try {
    writeFileSync(chemin, contenu, 'utf8');
  } catch {
    throw new ErreurCli(`cannot write ${JSON.stringify(chemin)}`);
  }
}

function paletteDe(p: Programmation): Palette {
  return p.paletteInline ?? getPalette(p.palette);
}

function listeErreurs(e: ParamsError): string {
  return e.erreurs.map((x) => `${x.chemin || '/'}: ${x.message} [${x.code}]`).join('\n');
}

function commandeGenerate(args: string[]): void {
  const { entree, opts } = analyse(args, ['--seed', '--out', '--json', '--notation', '--taille']);
  const brut = lireJson(entree);
  if (opts.seed !== undefined && typeof brut === 'object' && brut !== null) {
    (brut as Record<string, unknown>).seed = opts.seed;
  }

  const r = validate(brut);
  if (!r.ok) throw new ErreurCli(listeErreurs(new ParamsError(r.erreurs)));

  const params = r.params;
  const prog = generate(params);
  const joint = params.unite.joint ?? 0;

  const json = JSON.stringify(prog);
  const texte = prog.paletteInline ? undefined : encode(prog);

  if (opts.json !== undefined) ecrire(opts.json, `${json}\n`);
  if (opts.notation !== undefined) {
    if (texte === undefined) throw new ErreurCli('the notation cannot carry an inline palette');
    ecrire(opts.notation, texte);
  }
  if (opts.out !== undefined) {
    const svgOpts = opts.taille === undefined ? { joint } : { joint, taille: opts.taille };
    ecrire(opts.out, renderSVG(prog, paletteDe(prog), svgOpts));
  }

  if (opts.json === undefined && opts.notation === undefined && opts.out === undefined) {
    process.stdout.write(`${json}\n`);
  } else {
    for (const d of prog.diagnostics.avertissements) process.stderr.write(`warning: ${d}\n`);
  }
}

function commandeRender(args: string[]): void {
  const { entree, opts } = analyse(args, ['--out', '--taille']);
  const prog: Programmation = entree.endsWith('.txt')
    ? decode(lire(entree))
    : (lireJson(entree) as Programmation);
  const svg = renderSVG(
    prog,
    paletteDe(prog),
    opts.taille === undefined ? {} : { taille: opts.taille },
  );
  if (opts.out !== undefined) ecrire(opts.out, svg);
  else process.stdout.write(svg);
}

function commandeValidate(args: string[]): void {
  const { entree } = analyse(args, []);
  const r = validate(lireJson(entree));
  if (r.ok) {
    process.stdout.write('ok\n');
    return;
  }
  throw new ErreurCli(listeErreurs(new ParamsError(r.erreurs)));
}

function principal(argv: string[]): number {
  const commande = argv[0];
  const reste = argv.slice(1);
  try {
    switch (commande) {
      case 'generate':
        commandeGenerate(reste);
        return 0;
      case 'render':
        commandeRender(reste);
        return 0;
      case 'validate':
        commandeValidate(reste);
        return 0;
      case undefined:
      case '--help':
      case '-h':
      case 'help':
        process.stdout.write(USAGE);
        return commande === undefined ? 1 : 0;
      default:
        process.stderr.write(`unknown command ${JSON.stringify(commande)}\n\n${USAGE}`);
        return 1;
    }
  } catch (e) {
    const m =
      e instanceof ParamsError ? listeErreurs(e) : e instanceof Error ? e.message : String(e);
    process.stderr.write(`${m}\n`);
    return 1;
  }
}

process.exitCode = principal(process.argv.slice(2));
