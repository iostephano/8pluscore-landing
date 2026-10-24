#!/usr/bin/env node
// Genera r/<slug>/index.html a partir de recursos/*.json. Sin dependencias, Node >= 18.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://8pluscore.com';
const TIPOS = ['pdf_tercero', 'pdf_propio', 'repo'];
const RAYAS = /[\u2013\u2014]/;
const ITERACIONES = 200000; // PBKDF2 del código que cifra el prompt y los comandos
const REPO_GITHUB = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+?(\.git)?\/?$/;

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
    for (const k of ['que_es', 'requisitos', 'repo_url', 'ref'])
      if (!need(k)) return fail(file, `repo requiere ${k}`);
    if (!r.zip && !need('prompt')) return fail(file, 'repo requiere prompt (o "zip": true para entregar el ZIP)');
    if (!/^https:\/\//.test(r.repo_url)) return fail(file, 'repo_url debe ser https');
    if (r.zip && !REPO_GITHUB.test(r.repo_url)) return fail(file, 'con "zip": true, repo_url debe ser un repo de github.com (https://github.com/usuario/repo)');
    if (r.prompt !== undefined) {
      if (!need('prompt')) return fail(file, 'prompt debe ser un texto');
      if (!r.prompt.includes(r.ref)) return fail(file, 'el prompt debe mencionar la versión fija indicada en "ref"');
      if (!/confirm/i.test(r.prompt) || !/(explic|expl[ií]c)/i.test(r.prompt))
        return fail(file, 'el prompt debe pedir que Claude explique qué va a instalar y espere confirmación');
    }
    if (r.comandos !== undefined && (!Array.isArray(r.comandos) || !r.comandos.every((c) => typeof c === 'string' && c.trim())))
      return fail(file, 'comandos debe ser una lista de textos');
    if (r.imagen && !existsSync(path.join(root, 'assets/recursos', r.slug, r.imagen))) return fail(file, `no existe assets/recursos/${r.slug}/${r.imagen}`);
  }
  if (r.zip !== undefined && typeof r.zip !== 'boolean') return fail(file, 'zip debe ser true o false');
  if (r.zip && r.tipo !== 'repo') return fail(file, 'zip solo aplica al tipo repo');
  if (r.codigo !== undefined) {
    if (typeof r.codigo !== 'string' || !/^[A-Za-z0-9]{5}$/.test(r.codigo)) return fail(file, 'codigo debe ser un texto de exactamente 5 caracteres: letras sin tildes ni ñ y/o números (por ejemplo "Ab3x9" o "04821")');
  }
  if (r.cierre_session !== undefined && typeof r.cierre_session !== 'boolean') return fail(file, 'cierre_session debe ser true o false');
  if (r.session_url !== undefined) return fail(file, 'session_url está obsoleto: elimínalo (el bloque final sale de recursos/_promo.json)');
  if (RAYAS.test(JSON.stringify(r))) return fail(file, 'no uses guiones largos ni rayas en los textos');
  return true;
}

function validarPromo(p, file) {
  const need = (k) => typeof p[k] === 'string' && p[k].trim() !== '';
  if (!p || typeof p !== 'object' || Array.isArray(p)) return fail(file, 'debe ser un objeto JSON');
  for (const k of ['titulo', 'texto', 'boton']) if (!need(k)) return fail(file, `falta ${k}`);
  if (!/^https:\/\//.test(p.url || '')) return fail(file, 'url debe ser https');
  if (p.activo !== undefined && typeof p.activo !== 'boolean') return fail(file, 'activo debe ser true o false');
  if (p.imagen !== undefined) {
    if (!need('imagen')) return fail(file, 'imagen debe ser un texto (ruta dentro de assets/)');
    if (!existsSync(path.join(root, 'assets', p.imagen))) return fail(file, `no existe assets/${p.imagen}`);
  }
  if (p.imagen_alt !== undefined && typeof p.imagen_alt !== 'string') return fail(file, 'imagen_alt debe ser un texto');
  if (RAYAS.test(JSON.stringify(p))) return fail(file, 'no uses guiones largos ni rayas en los textos');
  return true;
}

// El código se compara sin distinguir mayúsculas de minúsculas ni espacios en los extremos:
// se normaliza a minúsculas antes de calcular el hash o la clave (el navegador hace lo mismo).
const codigoNormal = (r) => r.codigo.trim().toLowerCase();

// Hash del código: SHA-256 de "<slug>:<codigo normalizado>". El navegador calcula lo mismo con crypto.subtle.
const hashCodigo = (r) => createHash('sha256').update(`${r.slug}:${codigoNormal(r)}`).digest('hex');

// Cifra un texto con AES-256-GCM. La clave sale del código con PBKDF2-SHA256 (mismos parámetros en el navegador).
// Salt e IV son deterministas para que regenerar la página no cambie el HTML: el salt depende del slug y el IV
// del contenido, así que una misma clave nunca cifra dos textos distintos con el mismo IV.
function cifrar(r, texto) {
  const salt = createHash('sha256').update(`8pluscore:salt:${r.slug}`).digest().subarray(0, 16);
  const clave = pbkdf2Sync(codigoNormal(r), salt, ITERACIONES, 32, 'sha256');
  const iv = createHash('sha256').update(Buffer.concat([salt, Buffer.from(texto, 'utf8')])).digest().subarray(0, 12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final(), c.getAuthTag()]); // el navegador espera texto cifrado + etiqueta
  return { salt: salt.toString('base64'), iv: iv.toString('base64'), datos: datos.toString('base64') };
}

function urlZip(r) {
  const base = r.repo_url.replace(/\.git$/, '').replace(/\/$/, '');
  return /^[0-9a-f]{7,40}$/i.test(r.ref) ? `${base}/archive/${r.ref}.zip` : `${base}/archive/refs/tags/${r.ref}.zip`;
}

// Cómo se entrega el archivo: enlace, texto del botón, si abre pestaña nueva y nota.
function acceso(r) {
  if (r.tipo === 'pdf_tercero') return { href: r.url, etiqueta: r.etiqueta, pestana: true, nota: 'Se abre en una pestaña nueva, en el sitio original.' };
  if (r.tipo === 'pdf_propio') return {
    href: `../../assets/recursos/${encodeURIComponent(r.slug)}/${encodeURIComponent(r.archivo)}`,
    etiqueta: r.etiqueta || 'Descargar PDF', pestana: false, nota: 'Si no se descarga, ábrelo en tu navegador.'
  };
  return { href: urlZip(r), etiqueta: 'Descargar ZIP', pestana: false, nota: 'Mejor ábrelo en tu computadora.' };
}

// Campo de la palabra o código del final del video (el mismo en todos los recursos).
// Sin inputmode numérico: el código puede llevar letras. maxlength deja margen para pegar con espacios.
function campoCodigo() {
  return `        <label for="codigo">Escribe la palabra o el código del final del video</label>
        <div class="desbloqueo-fila">
          <input class="campo" id="codigo" name="codigo" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" required aria-describedby="codigo-estado">
          <button class="btn" type="submit">Desbloquear</button>
        </div>
        <p class="nota" id="codigo-estado" role="status" aria-live="polite"></p>`;
}

// Botón de descarga directo, o formulario de código (el enlace solo lo conoce el navegador tras acertar).
function bloqueAcceso(r) {
  const a = acceso(r);
  if (!r.codigo) {
    const attrs = a.pestana ? ' target="_blank" rel="noopener noreferrer"' : ' download';
    return `      <a class="btn" href="${esc(a.href)}"${attrs}>${esc(a.etiqueta)}</a>
      <p class="nota">${a.nota}</p>`;
  }
  return `      <form class="desbloqueo" id="desbloqueo" novalidate hidden data-slug="${esc(r.slug)}" data-hash="${hashCodigo(r)}" data-href="${esc(a.href)}" data-etiqueta="${esc(a.etiqueta)}" data-modo="${a.pestana ? 'pestana' : 'descarga'}">
${campoCodigo()}
      </form>
      <noscript><p class="nota">Para desbloquear este recurso necesitas activar JavaScript en tu navegador.</p></noscript>
      <p class="nota">${a.nota}</p>`;
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

// Repo con código y sin ZIP: el prompt y los comandos viajan cifrados y se muestran al acertar el código.
function bloqueContenidoCifrado(r) {
  const c = cifrar(r, `${cajaCopiar('prompt', r.prompt, 'prompt-t')}${comandos(r)}`);
  return `      <h3 id="prompt-t">Pega esto en Claude Code</h3>
      <form class="desbloqueo" id="desbloqueo" novalidate hidden data-modo="contenido" data-iter="${ITERACIONES}" data-salt="${c.salt}" data-iv="${c.iv}" data-datos="${c.datos}">
${campoCodigo()}
      </form>
      <noscript><p class="nota">Para desbloquear este recurso necesitas activar JavaScript en tu navegador.</p></noscript>
      <div id="contenido" tabindex="-1"></div>`;
}

function entrega(r) {
  if (r.tipo === 'pdf_tercero' || r.tipo === 'pdf_propio') {
    return `
    <section class="entrega" aria-labelledby="entrega-t">
      <h2 id="entrega-t">El documento</h2>
${bloqueAcceso(r)}
    </section>`;
  }
  const img = r.imagen
    ? `\n      <img class="captura" src="../../assets/recursos/${encodeURIComponent(r.slug)}/${encodeURIComponent(r.imagen)}" alt="${esc(r.imagen_alt || 'Captura del recurso')}" loading="lazy">`
    : '';
  const cuerpo = r.zip
    ? `      <h3 id="zip-t">Descarga el ZIP</h3>
${bloqueAcceso(r)}`
    : r.codigo
      ? bloqueContenidoCifrado(r)
      : `      <h3 id="prompt-t">Pega esto en Claude Code</h3>
${cajaCopiar('prompt', r.prompt, 'prompt-t')}${comandos(r)}`;
  return `
    <section class="entrega" aria-labelledby="entrega-t">
      <h2 id="entrega-t">Qué es</h2>
      <p>${esc(r.que_es)}</p>${img}
      <h3>Requisitos</h3>
      <p>${esc(r.requisitos)}</p>
${r.seguridad ? `      <h3>Seguridad</h3>\n      <p>${esc(r.seguridad)}</p>\n` : ''}${cuerpo}
      <p><a class="enlace" href="${esc(r.repo_url)}" target="_blank" rel="noopener noreferrer">Ver el repo en GitHub</a></p>
      <p class="autoria">Creado por Stephano, @iOStephano, 8pluscore.com</p>
    </section>`;
}

// Bloque final de invitación, igual en todas las páginas salvo "cierre_session": false.
function promo(r, p) {
  if (!p || p.activo === false || r.cierre_session === false) return '';
  const img = p.imagen
    ? `\n      <img class="promo-img" src="../../assets/${p.imagen.split('/').map(encodeURIComponent).join('/')}" alt="${esc(p.imagen_alt || '')}" loading="lazy">`
    : '';
  return `
    <section class="promo" aria-labelledby="promo-t">
      <h2 id="promo-t">${esc(p.titulo)}</h2>
      <p>${esc(p.texto)}</p>${img}
      <a class="btn btn-promo" href="${esc(p.url)}">${esc(p.boton)}</a>
    </section>`;
}

function pagina(r, pr) {
  const desc = r.descripcion || (r.resumen ? r.resumen[0] : r.que_es).slice(0, 155);
  const titulo = `${r.titulo}, 8+Core`;
  const url = `${SITE}/r/${r.slug}/`;
  const parrafos = (r.resumen || []).map((p) => `      <p>${esc(p)}</p>`).join('\n');
  const kit = r.kit ? `    <p class="etiqueta-kit">${esc(r.kit)}</p>\n` : '';
  const bloqueResumen = parrafos ? `    <section class="resumen" aria-label="Resumen">\n${parrafos}\n    </section>\n` : '';
  const conJs = (r.tipo === 'repo' && !r.zip) || r.codigo;
  const js = conJs ? '\n  <script src="../../assets/recursos.js" defer></script>' : '';
  const cierre = promo(r, pr);
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
${bloqueResumen ? '\n' + bloqueResumen : ''}${entrega(r)}${cierre ? '\n' + cierre : ''}
  </main>
</body>
</html>
`;
}

const dir = path.join(root, 'recursos');
// Los archivos que empiezan con "_" (como _promo.json) son configuración, no recursos.
const archivos = (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
let pr = null;
const promoFile = path.join(dir, '_promo.json');
if (existsSync(promoFile)) {
  try {
    const p = JSON.parse(await readFile(promoFile, 'utf8'));
    if (validarPromo(p, '_promo.json')) {
      pr = p;
      if (p.activo === false) console.log('Promoción desactivada ("activo": false en _promo.json): las páginas salen sin tarjeta.');
    }
  } catch (e) { fail('_promo.json', `JSON inválido (${e.message})`); }
} else {
  console.warn('Aviso: no existe recursos/_promo.json, las páginas salen sin bloque de promoción.');
}
let n = 0;
for (const f of archivos) {
  let r;
  try { r = JSON.parse(await readFile(path.join(dir, f), 'utf8')); }
  catch (e) { fail(f, `JSON inválido (${e.message})`); continue; }
  if (!validar(r, f)) continue;
  const out = path.join(root, 'r', r.slug);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'index.html'), pagina(r, pr));
  console.log(`r/${r.slug}/index.html`);
  n++;
}
console.log(`${n} página(s) generada(s).`);
