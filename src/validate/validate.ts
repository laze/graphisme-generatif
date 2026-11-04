/**
 * Hand-written params validator (SPEC Sections 8, 11). Zero dependencies.
 *
 * Returns every error it finds, each with a JSON path. The key lists exported
 * here are the single source of truth for `additionalProperties` and are
 * cross-checked against `schema/params.schema.json` by a test.
 */

import {
  type Axis,
  ECHELLE_MODES,
  type Erreur,
  type EtageSpec,
  FORME_TYPES,
  MODES,
  NIVEAUX,
  ONDES,
  PARCOURS_TYPES,
  PLAGES,
  type Palette,
  type Params,
  SYMETRIES,
  type ValidationResult,
  type Variation,
} from '../core/types.js';

// --- key lists (kept in sync with the types by the schema sync test) --------

export const CLES_PARAMS = [
  'version',
  'seed',
  'palette',
  'champ',
  'module',
  'echelle',
  'parcours',
  'unite',
  'etages',
  'contraste',
  'inversion',
] as const satisfies readonly (keyof Params)[];

export const CLES_VARIATION = [
  'mode',
  'amplitude',
  'onde',
  'periode',
  'sens',
  'ensemble',
  'pas',
] as const satisfies readonly (keyof Variation<unknown>)[];

export const CLES_AXIS = [
  'base',
  'inter',
  'intra',
] as const satisfies readonly (keyof Axis<unknown>)[];

export const CLES_PARCOURS = ['type', 'inverse', 'symetrie'] as const;
export const CLES_CHAMP = ['modulesX', 'modulesY'] as const;
export const CLES_MODULE = ['colonnes', 'rangees'] as const;
export const CLES_ECHELLE = ['mode', 'part'] as const;
export const CLES_UNITE = ['etages', 'joint'] as const;
export const CLES_ETAGE = ['couleur', 'forme'] as const satisfies readonly (keyof EtageSpec)[];
export const CLES_COULEUR = ['gamme', 'nuance'] as const;
export const CLES_FORME = ['type', 'grandeur', 'rotation', 'aspect', 'cisaillement'] as const;
export const CLES_CONTRASTE = ['minNuance'] as const;
export const CLES_INVERSION = ['mode', 'amplitude', 'niveau'] as const;
export const CLES_PALETTE = ['id', 'label', 'gammes'] as const satisfies readonly (keyof Palette)[];
export const CLES_GAMME = ['label', 'nuances', 'noir'] as const;

// --- small helpers ---------------------------------------------------------

class Collecteur {
  readonly erreurs: Erreur[] = [];
  ajoute(chemin: string, code: string, message: string): void {
    this.erreurs.push({ chemin, message, code });
  }
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cles(
  c: Collecteur,
  chemin: string,
  obj: Record<string, unknown>,
  autorisees: readonly string[],
): void {
  for (const k of Object.keys(obj)) {
    if (!autorisees.includes(k)) {
      c.ajoute(`${chemin}/${k}`, 'cle-inconnue', `unknown key "${k}"`);
    }
  }
}

function objet(
  c: Collecteur,
  chemin: string,
  v: unknown,
  autorisees: readonly string[],
): Record<string, unknown> | undefined {
  if (!estObjet(v)) {
    c.ajoute(chemin, 'type', 'expected an object');
    return undefined;
  }
  cles(c, chemin, v, autorisees);
  return v;
}

function nombre(
  c: Collecteur,
  chemin: string,
  v: unknown,
  min: number,
  max: number,
  entier: boolean,
): boolean {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    c.ajoute(chemin, 'type', 'expected a finite number');
    return false;
  }
  if (entier && !Number.isInteger(v)) {
    c.ajoute(chemin, 'entier', 'expected an integer');
    return false;
  }
  if (v < min || v > max) {
    c.ajoute(chemin, 'plage', `expected a value in [${min}, ${max}], got ${v}`);
    return false;
  }
  return true;
}

function enumere<T extends string>(
  c: Collecteur,
  chemin: string,
  v: unknown,
  valeurs: readonly T[],
): boolean {
  if (typeof v !== 'string' || !(valeurs as readonly string[]).includes(v)) {
    c.ajoute(chemin, 'enum', `expected one of ${valeurs.map((x) => `"${x}"`).join(', ')}`);
    return false;
  }
  return true;
}

function booleen(c: Collecteur, chemin: string, v: unknown): void {
  if (typeof v !== 'boolean') c.ajoute(chemin, 'type', 'expected a boolean');
}

const HEX = /^#[0-9a-f]{6}$/;
const LETTRE_GAMME = /^[A-Z]$/;

// --- variation / axis ------------------------------------------------------

type SorteAxe = 'nuance' | 'grandeur' | 'rotation' | 'aspect' | 'cisaillement' | 'gamme' | 'type';

function estNumerique(sorte: SorteAxe): sorte is keyof typeof PLAGES {
  return sorte !== 'gamme' && sorte !== 'type';
}

function valeurAxe(c: Collecteur, chemin: string, v: unknown, sorte: SorteAxe): void {
  if (estNumerique(sorte)) {
    const p = PLAGES[sorte];
    nombre(c, chemin, v, p.min, p.max, p.entier);
    return;
  }
  if (sorte === 'gamme') {
    if (typeof v !== 'string' || !LETTRE_GAMME.test(v)) {
      c.ajoute(chemin, 'gamme', 'expected a single uppercase letter A-Z');
    }
    return;
  }
  enumere(c, chemin, v, FORME_TYPES);
}

function variation(c: Collecteur, chemin: string, v: unknown, sorte: SorteAxe): void {
  const o = objet(c, chemin, v, CLES_VARIATION);
  if (!o) return;
  const modeOk = enumere(c, `${chemin}/mode`, o.mode, MODES);
  nombre(c, `${chemin}/amplitude`, o.amplitude, 0, 1, false);
  if (o.onde !== undefined) enumere(c, `${chemin}/onde`, o.onde, ONDES);
  if (o.periode !== undefined) nombre(c, `${chemin}/periode`, o.periode, 0.0001, 64, false);
  if (o.sens !== undefined && o.sens !== 1 && o.sens !== -1) {
    c.ajoute(`${chemin}/sens`, 'enum', 'expected 1 or -1');
  }
  if (o.pas !== undefined) nombre(c, `${chemin}/pas`, o.pas, 1, 1024, true);

  const categorique = !estNumerique(sorte);
  if (o.ensemble !== undefined) {
    if (!Array.isArray(o.ensemble) || o.ensemble.length === 0) {
      c.ajoute(`${chemin}/ensemble`, 'type', 'expected a non-empty array');
    } else {
      o.ensemble.forEach((x, i) => {
        if (categorique) {
          valeurAxe(c, `${chemin}/ensemble/${i}`, x, sorte);
        } else if (typeof x !== 'number' || !Number.isFinite(x)) {
          c.ajoute(`${chemin}/ensemble/${i}`, 'type', 'expected a finite number (an offset)');
        }
      });
    }
  }

  if (!modeOk) return;
  const mode = o.mode as Variation<unknown>['mode'];
  const besoin =
    mode === 'permutation' || (categorique && (mode === 'aleatoire' || mode === 'progression'));
  if (besoin && o.ensemble === undefined) {
    c.ajoute(`${chemin}/ensemble`, 'requis', `mode "${mode}" requires "ensemble" on this axis`);
  }
  if (!categorique && o.sens !== undefined && mode !== 'progression') {
    c.ajoute(`${chemin}/sens`, 'inutile', '"sens" only applies to mode "progression"');
  }
}

function axe(c: Collecteur, chemin: string, v: unknown, sorte: SorteAxe): void {
  const o = objet(c, chemin, v, CLES_AXIS);
  if (!o) return;
  if (o.base === undefined) c.ajoute(`${chemin}/base`, 'requis', 'missing "base"');
  else valeurAxe(c, `${chemin}/base`, o.base, sorte);
  if (o.inter !== undefined) variation(c, `${chemin}/inter`, o.inter, sorte);
  if (o.intra !== undefined) variation(c, `${chemin}/intra`, o.intra, sorte);
}

function axeOptionnel(c: Collecteur, chemin: string, v: unknown, sorte: SorteAxe): void {
  if (v !== undefined) axe(c, chemin, v, sorte);
}

// --- parcours / palette ----------------------------------------------------

function parcours(c: Collecteur, chemin: string, v: unknown): void {
  const o = objet(c, chemin, v, CLES_PARCOURS);
  if (!o) return;
  enumere(c, `${chemin}/type`, o.type, PARCOURS_TYPES);
  if (o.inverse !== undefined) booleen(c, `${chemin}/inverse`, o.inverse);
  if (o.symetrie !== undefined) enumere(c, `${chemin}/symetrie`, o.symetrie, SYMETRIES);
}

function validePalette(c: Collecteur, chemin: string, v: unknown): void {
  const o = objet(c, chemin, v, CLES_PALETTE);
  if (!o) return;
  if (typeof o.id !== 'string' || o.id.length === 0) {
    c.ajoute(`${chemin}/id`, 'type', 'expected a non-empty string');
  }
  if (typeof o.label !== 'string') c.ajoute(`${chemin}/label`, 'type', 'expected a string');
  // gammes is a free-form map: its keys are the gamme letters, checked below.
  if (!estObjet(o.gammes)) {
    c.ajoute(`${chemin}/gammes`, 'type', 'expected an object');
    return;
  }
  const g = o.gammes;
  const lettres = Object.keys(g);
  if (lettres.length === 0) {
    c.ajoute(`${chemin}/gammes`, 'vide', 'a palette needs at least one gamme');
  }
  for (const lettre of lettres) {
    const cg = `${chemin}/gammes/${lettre}`;
    if (!LETTRE_GAMME.test(lettre)) {
      c.ajoute(cg, 'gamme', 'gamme keys are single uppercase letters A-Z');
    }
    const gg = objet(c, cg, g[lettre], CLES_GAMME);
    if (!gg) continue;
    if (typeof gg.label !== 'string') c.ajoute(`${cg}/label`, 'type', 'expected a string');
    if (!Array.isArray(gg.nuances) || gg.nuances.length < 1 || gg.nuances.length > 15) {
      c.ajoute(`${cg}/nuances`, 'plage', 'expected 1 to 15 nuances');
    } else {
      gg.nuances.forEach((n, i) => {
        if (typeof n !== 'string' || !HEX.test(n)) {
          c.ajoute(`${cg}/nuances/${i}`, 'hex', 'expected a hex colour "#rrggbb" (lowercase)');
        }
      });
    }
    if (gg.noir !== undefined && (typeof gg.noir !== 'string' || !HEX.test(gg.noir))) {
      c.ajoute(`${cg}/noir`, 'hex', 'expected a hex colour "#rrggbb" (lowercase)');
    }
  }
}

// --- etages ----------------------------------------------------------------

function etage(c: Collecteur, chemin: string, v: unknown, k: number): void {
  const o = objet(c, chemin, v, CLES_ETAGE);
  if (!o) return;
  const coul = objet(c, `${chemin}/couleur`, o.couleur, CLES_COULEUR);
  if (coul) {
    if (coul.gamme === undefined) {
      c.ajoute(`${chemin}/couleur/gamme`, 'requis', 'missing "gamme"');
    } else {
      axe(c, `${chemin}/couleur/gamme`, coul.gamme, 'gamme');
    }
    if (coul.nuance === undefined) {
      c.ajoute(`${chemin}/couleur/nuance`, 'requis', 'missing "nuance"');
    } else {
      axe(c, `${chemin}/couleur/nuance`, coul.nuance, 'nuance');
    }
  }

  if (k === 0) {
    if (o.forme !== undefined) {
      c.ajoute(`${chemin}/forme`, 'interdit', 'etage 0 is the fond and carries no forme');
    }
    return;
  }
  if (o.forme === undefined) {
    c.ajoute(`${chemin}/forme`, 'requis', `etage ${k} requires a "forme"`);
    return;
  }
  const f = objet(c, `${chemin}/forme`, o.forme, CLES_FORME);
  if (!f) return;
  if (f.type === undefined) c.ajoute(`${chemin}/forme/type`, 'requis', 'missing "type"');
  else axe(c, `${chemin}/forme/type`, f.type, 'type');
  if (f.grandeur === undefined)
    c.ajoute(`${chemin}/forme/grandeur`, 'requis', 'missing "grandeur"');
  else axe(c, `${chemin}/forme/grandeur`, f.grandeur, 'grandeur');
  axeOptionnel(c, `${chemin}/forme/rotation`, f.rotation, 'rotation');
  axeOptionnel(c, `${chemin}/forme/aspect`, f.aspect, 'aspect');
  axeOptionnel(c, `${chemin}/forme/cisaillement`, f.cisaillement, 'cisaillement');
}

// --- entry point -----------------------------------------------------------

export function validate(params: unknown): ValidationResult {
  const c = new Collecteur();
  const o = objet(c, '', params, CLES_PARAMS);
  if (!o) return { ok: false, erreurs: c.erreurs };

  if (o.version !== 1) c.ajoute('/version', 'version', 'expected version 1');
  if (typeof o.seed !== 'string' || o.seed.length === 0) {
    c.ajoute('/seed', 'type', 'expected a non-empty string');
  }

  if (typeof o.palette === 'string') {
    if (o.palette.length === 0) c.ajoute('/palette', 'type', 'expected a non-empty palette id');
  } else if (o.palette === undefined) {
    c.ajoute('/palette', 'requis', 'missing "palette"');
  } else {
    validePalette(c, '/palette', o.palette);
  }

  const champ = objet(c, '/champ', o.champ, CLES_CHAMP);
  if (champ) {
    nombre(c, '/champ/modulesX', champ.modulesX, 1, 64, true);
    nombre(c, '/champ/modulesY', champ.modulesY, 1, 64, true);
  }

  const mod = objet(c, '/module', o.module, CLES_MODULE);
  if (mod) {
    nombre(c, '/module/colonnes', mod.colonnes, 1, 12, true);
    nombre(c, '/module/rangees', mod.rangees, 1, 12, true);
  }

  if (o.echelle !== undefined) {
    const e = objet(c, '/echelle', o.echelle, CLES_ECHELLE);
    if (e) {
      enumere(c, '/echelle/mode', e.mode, ECHELLE_MODES);
      nombre(c, '/echelle/part', e.part, 0, 1, false);
    }
  }

  const par = objet(c, '/parcours', o.parcours, ['inter', 'intra']);
  if (par) {
    parcours(c, '/parcours/inter', par.inter);
    parcours(c, '/parcours/intra', par.intra);
  }

  let nEtages: number | undefined;
  const unite = objet(c, '/unite', o.unite, CLES_UNITE);
  if (unite) {
    if (unite.etages === 1 || unite.etages === 2 || unite.etages === 3) {
      nEtages = unite.etages;
    } else {
      c.ajoute('/unite/etages', 'enum', 'expected 1, 2 or 3');
    }
    if (unite.joint !== undefined) nombre(c, '/unite/joint', unite.joint, 0, 0.2, false);
  }

  if (!Array.isArray(o.etages)) {
    c.ajoute('/etages', 'type', 'expected an array');
  } else {
    if (nEtages !== undefined && o.etages.length !== nEtages) {
      c.ajoute(
        '/etages',
        'longueur',
        `expected ${nEtages} entries to match unite.etages, got ${o.etages.length}`,
      );
    }
    o.etages.forEach((e, k) => etage(c, `/etages/${k}`, e, k));
  }

  if (o.contraste !== undefined) {
    const ct = objet(c, '/contraste', o.contraste, CLES_CONTRASTE);
    if (ct) nombre(c, '/contraste/minNuance', ct.minNuance, 0, 12, true);
  }

  if (o.inversion !== undefined) {
    const iv = objet(c, '/inversion', o.inversion, CLES_INVERSION);
    if (iv) {
      enumere(c, '/inversion/mode', iv.mode, MODES);
      nombre(c, '/inversion/amplitude', iv.amplitude, 0, 1, false);
      enumere(c, '/inversion/niveau', iv.niveau, NIVEAUX);
    }
    if (nEtages !== undefined && nEtages < 2) {
      c.ajoute('/inversion', 'inutile', 'inversion needs at least 2 etages');
    }
  }

  if (c.erreurs.length > 0) return { ok: false, erreurs: c.erreurs };
  return { ok: true, params: params as Params };
}

/**
 * Checks that every gamme letter the params can produce exists in the resolved
 * palette. Needs the palette, so it runs after resolution (SPEC Section 4.1).
 */
export function valideGammes(params: Params, palette: Palette): Erreur[] {
  const c = new Collecteur();
  const connues = new Set(Object.keys(palette.gammes));
  params.etages.forEach((e, k) => {
    const verifie = (chemin: string, g: unknown): void => {
      if (typeof g === 'string' && !connues.has(g)) {
        c.ajoute(chemin, 'gamme-inconnue', `gamme "${g}" is not in palette "${palette.id}"`);
      }
    };
    const base = `/etages/${k}/couleur/gamme`;
    verifie(`${base}/base`, e.couleur.gamme.base);
    for (const niveau of ['inter', 'intra'] as const) {
      const v = e.couleur.gamme[niveau];
      v?.ensemble?.forEach((g, i) => verifie(`${base}/${niveau}/ensemble/${i}`, g));
    }
  });
  return c.erreurs;
}
