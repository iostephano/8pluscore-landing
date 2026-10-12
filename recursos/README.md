# Recursos de los videos

Cada video entrega un recurso en `8pluscore.com/r/<slug>/`. No hay página índice ni enlace desde el menú, el footer o `index.html`. Solo llega quien tiene la dirección exacta que se da en el video.

## Regla de publicación

Publica cada recurso solo cuando salga su video. No hagas commit ni push del JSON (ni de su página generada) antes de ese momento. Las páginas llevan `noindex, nofollow` y no entran a `sitemap.xml`.

## Agregar un recurso nuevo

1. Crea `recursos/<slug>.json`. El nombre del archivo debe ser igual al `slug` (minúsculas, números y guiones).
2. Genera las páginas:

   ```
   node tools/build-recursos.mjs
   ```

   (Node 18 o superior.) Crea o actualiza `r/<slug>/index.html` para cada JSON y avisa si falta algo.
3. Ábrelo en local: `open r/<slug>/index.html`.
4. Revisa en celular (390 px) y en escritorio, haz commit del JSON y de `r/<slug>/`, y publica cuando salga el video.

## Campos del JSON

Comunes a todos los tipos:

| Campo | Qué es |
| --- | --- |
| `slug` | Dirección corta |
| `tipo` | `pdf_tercero`, `pdf_propio` o `repo` |
| `titulo` | Título del video |
| `descripcion` | Opcional. Meta description y Open Graph (si falta, se usa el inicio del primer párrafo) |
| `resumen` | Lista de 1 a 4 párrafos |
| `cierre_session` | Opcional, por defecto `true`. Con `false` se omite todo el cierre de la Session |
| `session_url` | Enlace a la página de Sessions. Vacío deshabilita el botón del cierre |

Sin guiones largos ni rayas en ningún texto: el script lo rechaza.

### `pdf_tercero`

`etiqueta` (texto del botón) y `url` (fuente original, https). No se aloja material de terceros.

### `pdf_propio`

`archivo` (nombre del PDF dentro de `assets/recursos/<slug>/`) y, opcional, `etiqueta` (por defecto "Descargar PDF").

### `repo`

- `que_es`: qué es el recurso.
- `requisitos`: qué se necesita (Claude Code).
- `prompt`: el prompt corto. Debe pedir a Claude que explique qué va a instalar y espere confirmación, y que use la versión fija de `ref`. El script lo valida.
- `repo_url`: enlace al repo.
- `ref`: versión fija (tag o commit) que el prompt debe mencionar.
- `imagen` e `imagen_alt`: opcionales, archivo dentro de `assets/recursos/<slug>/`.

## Archivos

- `tools/build-recursos.mjs`: generador.
- `assets/recursos.css` y `assets/recursos.js` (solo el botón Copiar).
- `404.html` en la raíz: página para direcciones que no existen.
