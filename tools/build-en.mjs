#!/usr/bin/env node
// Genera la versión en inglés del sitio (en/index.html y en/privacy.html)
// a partir de las páginas en español y de los textos de i18n/en.json.
//
// Uso: node tools/build-en.mjs
//
// El español es la fuente: si cambias un texto en index.html o privacidad.html,
// cambia también su clave en i18n/en.json. Si una clave ya no existe en la página,
// el script se detiene y dice cuál es, para que el inglés nunca quede desfasado.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'i18n', 'en.json'), 'utf8'));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Reemplaza todas las claves en una sola pasada, de la más larga a la más corta,
// para que el resultado de un reemplazo nunca vuelva a reemplazarse.
function applyMap(html, map, source) {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const hits = new Map(keys.map((key) => [key, 0]));
  const pattern = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
  const output = html.replace(pattern, (match) => {
    hits.set(match, hits.get(match) + 1);
    return map[match];
  });
  const missing = keys.filter((key) => hits.get(key) === 0);
  if (missing.length > 0) {
    const list = missing.map((key) => `  - ${key}`).join('\n');
    throw new Error(`${source}: estas claves de i18n/en.json no aparecen en la página:\n${list}`);
  }
  return output;
}

// Comprueba que no quede ninguna ruta relativa que se rompería dentro de /en/.
function assertNoRelativePaths(html, output) {
  const relative = html.match(/(?:href|src)="(?!https?:|mailto:|#|\/)[^"]+"|url\('(?!https?:|data:|\/)[^']+'\)/g);
  if (relative) {
    throw new Error(`${output}: quedan rutas relativas que no funcionan en /en/:\n  - ${relative.join('\n  - ')}`);
  }
}

const banner = (source) =>
  `<!-- Generado por tools/build-en.mjs desde ${source} e i18n/en.json. No editar a mano. -->\n`;

try {
  for (const page of config.pages) {
    const sourceHtml = readFileSync(join(root, page.source), 'utf8');
    let html = applyMap(sourceHtml, page.structure, page.source);
    html = applyMap(html, page.texts, page.source);
    assertNoRelativePaths(html, page.output);
    html = html.replace(/^<!DOCTYPE html>\n/i, (doctype) => doctype + banner(page.source));

    const outputPath = join(root, page.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, html);
    console.log(`OK  ${page.source} -> ${page.output}`);
  }
} catch (error) {
  console.error(`ERROR  ${error.message}`);
  process.exit(1);
}
