# Recursos de los videos

Cada video entrega un recurso en `8pluscore.com/r/<slug>/`. No hay página índice ni enlace desde el menú, el footer o `index.html`. Solo llega quien tiene la dirección exacta que se da en el video.

## Regla de publicación

Puedes preparar el recurso en una rama y un PR en borrador. No hagas merge a main antes de que salga el video. Las páginas llevan `noindex, nofollow` y no entran a `sitemap.xml`.

## Agregar un recurso nuevo

1. Crea `recursos/<slug>.json`. El nombre del archivo debe ser igual al `slug` (minúsculas, números y guiones).
2. Genera las páginas:

   ```
   node tools/build-recursos.mjs
   ```

   (Node 18 o superior.) Crea o actualiza `r/<slug>/index.html` para cada JSON y avisa si falta algo. Las páginas de `r/` salen siempre del generador: no se editan a mano.
3. Ábrelo en local. Si el recurso lleva código, sírvelo con `python3 -m http.server` y entra por `http://localhost:8000/r/<slug>/`, porque la verificación del código necesita `https` o `localhost`.
4. Revisa en celular (390 px) y en escritorio, haz commit del JSON y de `r/<slug>/` en una rama, abre un PR en borrador y haz merge cuando salga el video.

## Campos del JSON

Comunes a todos los tipos:

| Campo | Qué es |
| --- | --- |
| `slug` | Dirección corta |
| `tipo` | `pdf_tercero`, `pdf_propio` o `repo` |
| `titulo` | Título del video |
| `descripcion` | Opcional. Meta description y Open Graph (si falta, se usa el inicio del primer párrafo) |
| `kit` | Opcional. Etiqueta pequeña sobre el título, por ejemplo `Kit #01 · 💻 Computadora` |
| `resumen` | Lista de 1 a 4 párrafos. En `repo` es opcional porque `que_es` hace de resumen |
| `codigo` | Opcional. Palabra o código de desbloqueo de exactamente 5 caracteres, entre comillas (ver más abajo) |
| `cierre_session` | Opcional, por defecto `true`. Con `false` se omite el bloque de promoción del final |

`session_url` está obsoleto: el generador lo rechaza. El bloque final sale de `recursos/_promo.json`.

Sin guiones largos ni rayas en ningún texto: el script lo rechaza.

### `pdf_tercero`

`etiqueta` (texto del botón) y `url` (fuente original, https). No se aloja material de terceros.

### `pdf_propio`

`archivo` (nombre del PDF dentro de `assets/recursos/<slug>/`) y, opcional, `etiqueta` (por defecto "Descargar PDF").

### `repo`

- `que_es`: qué es el recurso.
- `requisitos`: qué se necesita (Claude Code).
- `seguridad`: opcional. Párrafo que explica qué hace y qué no hace el recurso, para dar confianza antes de instalar.
- `prompt`: el prompt corto que se copia y se pega en Claude Code. Obligatorio, salvo con `zip: true`. Debe pedir a Claude que explique qué va a instalar y espere confirmación, y que use la versión fija de `ref`. El script lo valida.
- `comandos`: opcional. Lista de comandos para quien prefiere escribirlos en la terminal. Cada uno sale en su propia caja con botón Copiar.
- `repo_url`: enlace al repo.
- `ref`: versión fija (tag o commit) que el prompt debe mencionar.
- `zip`: opcional, `true` o `false`. Con `true` la entrega es el ZIP de la versión fija y no se muestran prompt ni comandos (ver más abajo).
- `imagen` e `imagen_alt`: opcionales, archivo dentro de `assets/recursos/<slug>/`.

## Código de desbloqueo (opcional)

Con `"codigo": "Ab3x9"` la página pide la palabra o el código que se dice al final del video antes de entregar el archivo. Reglas del valor:

- Exactamente 5 caracteres: letras (sin tildes ni ñ) y/o números, como texto entre comillas (así no se pierden ceros iniciales). El generador rechaza cualquier otra cosa.
- Al comparar no importan las mayúsculas ni los espacios al inicio o al final: `Ab3x9`, `ab3x9` y `" AB3X9 "` valen lo mismo. El generador normaliza a minúsculas antes de calcular el hash o la clave, y el navegador hace lo mismo con lo que escribe la persona.
- Cuidado con los caracteres que se parecen en voz alta o en pantalla (la letra O y el cero, la I y el uno): elige un valor que no se confunda.

- La página muestra el campo "Escribe la palabra o el código del final del video" y el botón "Desbloquear". El campo no usa teclado numérico, pone las letras en mayúscula al escribir (solo en pantalla) y desactiva el autocompletado y el corrector. Si el valor es correcto, la descarga empieza sola y queda a la vista el botón por si el navegador la bloquea. Si no, aparece un aviso amable que habla de "palabra o código".
- El código no está en el HTML. Para descargas y pestañas se guarda el SHA-256 de `<slug>:<codigo en minúsculas>` y el navegador lo compara con `crypto.subtle`. Esto necesita `https` (o `localhost`).
- Con descargas, el enlace no se muestra en pantalla hasta acertar, pero sigue en el código fuente de la página. Es una puerta de cortesía y no una protección fuerte: 5 caracteres se pueden adivinar. No lo uses para material que deba ser realmente privado.
- Sin JavaScript, la página avisa que se necesita JavaScript.
- Qué entrega cada tipo al acertar: `pdf_propio` descarga el PDF de `assets/recursos/<slug>/`; `pdf_tercero` abre la `url` original en una pestaña nueva; `repo` con `zip: true` descarga el ZIP; `repo` sin `zip` muestra la caja del prompt y los comandos (ver más abajo).
- Sin `codigo`, la página funciona como siempre (los recursos `tablero` y `playbook` no llevan código).

### Prompt y comandos con código (`repo` sin `zip`)

Si un `repo` lleva `codigo` y no lleva `zip`, el código desbloquea la caja del prompt y los comandos. Aquí el contenido no está en el HTML en texto plano: el generador lo cifra y la página lo descifra con el código.

- Se cifra el HTML de las cajas con AES-256-GCM. La clave sale del código (en minúsculas) con PBKDF2-SHA256 (200000 iteraciones) y un salt que depende del slug.
- El IV sale del contenido, así que regenerar la página no cambia el HTML y una misma clave nunca cifra dos textos con el mismo IV.
- En la página quedan solo el salt, el IV y el texto cifrado (con su etiqueta de autenticación), en atributos `data-`. El navegador deriva la clave con el código que escribe la persona y descifra: si el código es incorrecto, el descifrado falla y la página avisa.
- El código no se guarda en ninguna parte. La protección es la de un código de 5 caracteres: hay 60466176 combinaciones posibles (36 a la quinta), así que alguien con ganas y equipo podría probarlas fuera de la página, aunque cada intento cuesta las 200000 iteraciones. Con descargas y pestañas (solo un hash) es más fácil todavía. Tampoco es para material realmente privado.
- Los demás campos (`que_es`, `requisitos`, `seguridad`, `repo_url`) siguen a la vista.

### ZIP en `repo`

Con `"zip": true` el botón descarga el ZIP de la versión fija de GitHub:

- Si `ref` es un tag: `<repo_url>/archive/refs/tags/<ref>.zip`.
- Si `ref` es un commit (7 a 40 caracteres hexadecimales): `<repo_url>/archive/<ref>.zip`.

`repo_url` debe ser un repo de `github.com`. La página agrega la nota "Mejor ábrelo en tu computadora." Sin `zip`, el repo se comporta como siempre (prompt y comandos).

## Bloque de promoción (`recursos/_promo.json`)

Al final de cada página, debajo de la entrega, sale una tarjeta que invita a los eventos de 8+Core. Su contenido vive en `recursos/_promo.json` y es el mismo para todos los recursos:

| Campo | Qué es |
| --- | --- |
| `titulo` | Encabezado de la tarjeta |
| `texto` | Un párrafo corto |
| `boton` | Texto del botón |
| `url` | Enlace del botón (https) |
| `imagen` | Opcional. Ruta dentro de `assets/`, por ejemplo `capsula-s1.png` |
| `imagen_alt` | Opcional. Texto alternativo de la imagen (vacío si es decorativa) |

- Los archivos de `recursos/` que empiezan con `_` no generan página: son configuración.
- Para ocultar la tarjeta en un recurso, pon `"cierre_session": false` en su JSON (por ejemplo `tablero`).
- Si falta `_promo.json`, las páginas salen sin tarjeta y el generador avisa.
- No pongas fechas, precios ni cupos en el texto: cambian y ahí no se actualizan solos. Para eso está la página de eventos.

## Archivos

- `tools/build-recursos.mjs`: generador.
- `recursos/_promo.json`: bloque de promoción.
- `assets/recursos.css` y `assets/recursos.js` (botón Copiar y desbloqueo por código).
- `404.html` en la raíz: página para direcciones que no existen.
