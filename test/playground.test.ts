import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const page = readFileSync(join(resolve(process.cwd(), 'playground'), 'index.html'), 'utf8');

describe('playground', () => {
  it('is a single static page importing the built ESM bundle', () => {
    expect(page).toContain("from '../dist/index.js'");
    expect(page.match(/<script\b/g)?.length).toBe(1);
    expect(page).toContain('<script type="module">');
  });

  it('pulls in no framework and no external asset', () => {
    expect(page).not.toMatch(/<script[^>]*\ssrc=/);
    expect(page).not.toMatch(/<link[^>]*stylesheet/);
    expect(page).not.toMatch(/(?:src|href)="https?:/);
    expect(page).not.toContain('@import');
  });

  it('uses the public API only', () => {
    const importe = /import\s*\{([^}]*)\}\s*from\s*'\.\.\/dist\/index\.js'/.exec(page);
    expect(importe).not.toBe(null);
    const noms = (importe?.[1] as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    expect(noms).toEqual(['encode', 'generate', 'getPalette', 'renderSVG', 'validate']);
  });

  it('offers the seed controls and the three downloads', () => {
    for (const id of ['seed', 'prec', 'suiv', 'alea', 'params', 'dl-svg', 'dl-json', 'dl-txt']) {
      expect(page).toContain(`id="${id}"`);
    }
  });

  it('supports light and dark mode', () => {
    expect(page).toContain('prefers-color-scheme: dark');
    expect(page).toContain('color-scheme: light dark');
  });
});
