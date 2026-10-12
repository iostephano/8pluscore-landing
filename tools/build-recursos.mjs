#!/usr/bin/env node
// Genera r/<slug>/index.html a partir de recursos/*.json. Sin dependencias, Node >= 18.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://8pluscore.com';
const TIPOS = ['pdf_tercero', 'pdf_propio', 'repo'];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function fail(file, msg) {
  console.error(`Error en ${file}: ${msg}`);
  process.exitCode = 1;
  return false;
}

function validar(r, file) {
  const need = (k) => typeof r[k] === 'string' && r[k].trim() !== '';
  if (!need('slug') || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) return fail(file, 'slug inválido (minúsculas, números y guiones)');
  if (r.slug !== path.basename(file, '.json')) return fail(file, 'el slug debe coincidir con el nombre del archivo');
  if (!TIPOS.includes(r.tipo)) return fail(file, `tipo debe ser uno de: ${TIPOS.join(', ')}`);
  if (!need('titulo')) return fail(file, 'falta titulo');
  const sinResumen = r.tipo === 'repo' && r.resumen === undefined; // en repo, "que_es" hace de resumen
  if (!sinResumen && (!Array.isArray(r.resumen) || r.resumen.length < 1 || r.resumen.length > 4 || !r.resumen.every((p) => typeof p === 'string' && p.trim())))
    return fail(file, 'resumen debe ser una lista de 1 a 4 párrafos');
  if (r.tipo === 'pdf_tercero') {
    if (!need('etiqueta') || !/^https:\/\//.test(r.url || '')) return fail(file, 'pdf_tercero requiere etiqueta y url https');
  }
  if (r.tipo === 'pdf_propio') {
    if (!need('archivo')) return fail(file, 'pdf_propio requiere archivo');
    if (!existsSync(path.join(root, 'assets/recursos', r.slug, r.archivo))) return fail(file, `no existe assets/recursos/${r.slug}/${r.archivo}`);
  }
  if (r.tipo === 'repo') {
    for (const k of ['que_es', 'requisitos', 'prompt', 'repo_url', 'ref'])
      if (!need(k)) return fail(file, `repo requiere ${k}`);
    if (!/^https:\/\//.test(r.repo_url)) return fail(file, 'repo_url debe ser https');
    if (!r.prompt.includes(r.ref)) return fail(file, 'el prompt debe mencionar la versión fija indicada en "ref"');
    if (!/confirm/i.test(r.prompt) || !/(explic|expl[ií]c)/i.test(r.prompt))
      return fail(file, 'el prompt debe pedir que Claude explique qué va a instalar y espere confirmación');
    if (r.comandos !== undefined && (!Array.isArray(r.comandos) || !r.comandos.every((c) => typeof c === 'string' && c.trim())))
      return fail(file, 'comandos debe ser una lista de textos');
    if (r.imagen && !existsSync(path.join(root, 'assets/recursos', r.slug, r.imagen))) return fail(file, `no existe assets/recursos/${r.slug}/${r.imagen}`);
  }
  if (r.cierre_session !== undefined && typeof r.cierre_session !== 'boolean') return fail(file, 'cierre_session debe ser true o false');
  if (r.session_url && !/^https:\/\//.test(r.session_url)) return fail(file, 'session_url debe estar vacío o ser https');
  const texto = JSON.stringify(r);
  if (/[–—]/.test(texto)) return fail(file, 'no uses guiones largos ni rayas en los textos');
  return true;
}

function cajaCopiar(id, texto, labelId) {
  return `      <div class="prompt-caja">
        <pre class="prompt" id="${id}" tabindex="0" aria-labelledby="${labelId}">${esc(texto)}</pre>
        <button class="btn btn-copiar" type="button" data-target="${id}" data-estado="${id}-estado" hidden>Copiar</button>
        <p class="nota" id="${id}-estado" role="status" aria-live="polite"></p>
      </div>`;
}

function comandos(r) {
  if (!r.comandos || r.comandos.length === 0) return '';
  const cajas = r.comandos.map((c, i) => cajaCopiar(`comando-${i + 1}`, c, 'comandos-t')).join('\n');
  return `
      <h3 id="comandos-t">Si prefieres escribirlo tú</h3>
      <p>Escribe estos comandos en la terminal, uno por uno.</p>
${cajas}`;
}

function entrega(r) {
  if (r.tipo === 'pdf_tercero') {
    return `
    <section class="entrega" aria-labelledby="entrega-t">
      <h2 id="entrega-t">El documento</h2>
      <a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.etiqueta)}</a>
      <p class="nota">Se abre en una pestaña nueva, en el sitio original.</p>
    </section>`;
  }
  if (r.tipo === 'pdf_propio') {
    const href = `../../assets/recursos/${encodeURIComponent(r.slug)}/${encodeURIComponent(r.archivo)}`;
    return `
    <section class="entrega" aria-labelledby="entrega-t">
      <h2 id="entrega-t">El documento</h2>
      <a class="btn" href="${href}" download>${esc(r.etiqueta || 'Descargar PDF')}</a>
      <p class="nota">Si no se descarga, ábrelo en tu navegador.</p>
    </section>`;
  }
  const img = r.imagen
    ? `\n      <img class="captura" src="../../assets/recursos/${encodeURIComponent(r.slug)}/${encodeURIComponent(r.imagen)}" alt="${esc(r.imagen_alt || 'Captura del recurso')}" loading="lazy">`
    : '';
  return `
    <section class="entrega" aria-labelledby="entrega-t">
      <h2 id="entrega-t">Qué es</h2>
      <p>${esc(r.que_es)}</p>${img}
      <h3>Requisitos</h3>
      <p>${esc(r.requisitos)}</p>
${r.seguridad ? `      <h3>Seguridad</h3>\n      <p>${esc(r.seguridad)}</p>\n` : ''}      <h3 id="prompt-t">Pega esto en Claude Code</h3>
${cajaCopiar('prompt', r.prompt, 'prompt-t')}${comandos(r)}
      <p><a class="enlace" href="${esc(r.repo_url)}" target="_blank" rel="noopener noreferrer">Ver el repo en GitHub</a></p>
      <p class="autoria">Creado por Stephano, @iOStephano, 8pluscore.com</p>
    </section>`;
}

function cierre(r) {
  if (r.cierre_session === false) return '';
  const boton = r.session_url
    ? `<a class="btn" href="${esc(r.session_url)}">Ver fechas de la Session 01</a>`
    : `<button class="btn" type="button" disabled>Próximamente: fechas de la Session 01</button>`;
  return `
    <section class="cierre" aria-labelledby="cierre-t">
      <h2 id="cierre-t">Siguiente paso</h2>
      <p>Esto es parte de lo que trabajamos en la Session 01 de 8+Core, Valida tu idea antes de construir.</p>
      ${boton}
    </section>`;
}

function pagina(r) {
  const desc = r.descripcion || (r.resumen ? r.resumen[0] : r.que_es).slice(0, 155);
  const titulo = `${r.titulo}, 8+Core`;
  const url = `${SITE}/r/${r.slug}/`;
  const parrafos = (r.resumen || []).map((p) => `      <p>${esc(p)}</p>`).join('\n');
  const kit = r.kit ? `    <p class="etiqueta-kit">${esc(r.kit)}</p>\n` : '';
  const bloqueResumen = parrafos ? `    <section class="resumen" aria-label="Resumen">\n${parrafos}\n    </section>\n` : '';
  const js = r.tipo === 'repo' ? '\n  <script src="../../assets/recursos.js" defer></script>' : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#F6F5F3">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="8+Core">
  <meta property="og:title" content="${esc(r.titulo)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Poppins:wght@600&display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="../../assets/favicon.svg">
  <link rel="apple-touch-icon" href="../../assets/apple-touch-icon.png">
  <link rel="stylesheet" href="../../assets/recursos.css">${js}
</head>
<body>
  <header class="header">
    <a href="../../index.html" class="brand-name">8+Core</a>
  </header>

  <main class="recurso">
${kit}    <h1>${esc(r.titulo)}</h1>
${bloqueResumen ? '\n' + bloqueResumen : ''}${entrega(r)}${cierre(r) ? '\n' + cierre(r) : ''}
  </main>
</body>
</html>
`;
}

const dir = path.join(root, 'recursos');
const archivos = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
let n = 0;
for (const f of archivos) {
  let r;
  try { r = JSON.parse(await readFile(path.join(dir, f), 'utf8')); }
  catch (e) { fail(f, `JSON inválido (${e.message})`); continue; }
  if (!validar(r, f)) continue;
  const out = path.join(root, 'r', r.slug);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'index.html'), pagina(r));
  console.log(`r/${r.slug}/index.html`);
  n++;
}
console.log(`${n} página(s) generada(s).`);
