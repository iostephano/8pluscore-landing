# Versión en inglés

El sitio está en español. La versión en inglés (`/en/` y `/en/privacy.html`) se genera a partir de las páginas en español.

## Cómo cambiar un texto

1. Cambia el texto en español en `index.html` o `privacidad.html`.
2. En `i18n/en.json`, cambia la clave con el texto nuevo en español y su traducción.
3. Corre `node tools/build-en.mjs`.
4. Sube los cambios junto con `en/index.html` y `en/privacy.html`.

Si una clave de `en.json` ya no aparece en la página en español, el script se detiene y muestra cuál es. Así el inglés no queda desfasado.

No edites a mano los archivos de `en/`: se sobrescriben cada vez que corre el script.

## Notas

- `structure` cambia rutas, idioma y enlaces; `texts` tiene las traducciones.
- Las secciones ocultas (`#apps`, `#recursos`, `#aprende`) no están traducidas. Si se activan, hay que agregar sus textos a `texts`.
- La política de privacidad en inglés es una traducción; prevalece la versión en español.
- Esta carpeta no se publica (`_config.yml`).
