# Sección Eventos (archivada)

Esta carpeta guarda completa la sección Eventos de 8pluscore.com (Sessions y Workshop online). Se archivó para quitarla del sitio publicado sin perder nada: Jekyll (GitHub Pages) ignora las carpetas que empiezan con guion bajo, así que nada de lo que hay aquí se publica. Mientras esté aquí, `/eventos/` y `/_archivo/eventos/` responden con la página 404.

## Qué contiene

- `index.html`: la página de eventos (lista de eventos, sala de asientos, reserva, pago con Yape, confirmación por WhatsApp y "Cómo funciona").
- `eventos.json`: todos los datos variables (WhatsApp, Yape, configuración, eventos, fechas, grupos, asientos, cápsulas).
- `privacidad/index.html`: el aviso de privacidad de Eventos.
- `afiches/`: los afiches de Session 01, Session 02 y Workshop (`s1.webp`, `s2.webp`, `w.webp`).
- `qr/yape.jpg`: el QR de Yape para el pago.

Lo que usa la página y no se movió: las imágenes de las cápsulas (`assets/capsula-s1.png`, `assets/capsula-s2.png`, `assets/capsula-w.png`), el favicon y el resto de `assets/`. Siguen en su lugar.

## Copia de seguridad

La rama `archivo-eventos` apunta al commit `63e7647` de `main`, el último antes de archivar, con la sección todavía en `eventos/`. Se intentó crear la etiqueta `eventos-v1` en ese mismo commit, pero no se pudo subir desde la sesión de trabajo (el servidor cortó la conexión). Si quieres la etiqueta, créala desde tu computadora:

```
git tag eventos-v1 63e7647
git push origin eventos-v1
```

## Cómo restaurar

1. Mueve la carpeta de vuelta, para conservar el historial:

   ```
   git mv _archivo/eventos eventos
   ```

2. En `index.html`, vuelve a poner el enlace del menú entre "Equipo" y "FAQ" (dentro de `<nav class="nav" aria-label="Principal">`):

   ```html
         <a href="/eventos/">Eventos</a>
   ```

3. En `sitemap.xml`, vuelve a agregar estas dos entradas dentro de `<urlset>` (después de la de `privacidad.html`), con la fecha del día en `lastmod`:

   ```xml
     <url>
       <loc>https://8pluscore.com/eventos/</loc>
       <lastmod>2026-10-16</lastmod>
     </url>
     <url>
       <loc>https://8pluscore.com/eventos/privacidad/</loc>
       <lastmod>2026-10-16</lastmod>
     </url>
   ```

4. En `privacidad.html`, sección "Qué datos recibimos", vuelve a poner este párrafo (texto exacto) justo después del primer párrafo de la sección, y actualiza la fecha de "Actualizada el":

   ```html
   <p>La sección <a href="/eventos/">Eventos</a> pide algunos datos para reservar un asiento. Esos datos no se envían desde el sitio: los armas en un mensaje y lo envías tú por WhatsApp. Está explicado en el <a href="/eventos/privacidad/">aviso de privacidad de Eventos</a>.</p>
   ```

5. En `recursos/_promo.json` pon `"activo": true` y regenera las páginas de recursos para que vuelva la tarjeta de promoción:

   ```
   node tools/build-recursos.mjs
   ```

   Haz commit de `recursos/_promo.json` y de los `r/*/index.html` que cambien.

6. Antes de reabrir, actualiza los datos de `eventos/eventos.json`:
   - Las fechas de `fechas` (Sessions) y `grupos` (Workshop): la página muestra siempre las próximas `maxOpciones` opciones abiertas, así que si ya pasaron todas verás "Próximamente".
   - Los asientos de cada fecha y grupo (`ocupados` y `en_validacion`): ponlos en el valor real o en 0 si empieza una ronda nueva.
   - Revisa `config.cierreHoras`, los precios, los horarios, el número de WhatsApp y el QR de Yape.
   - Pendientes de siempre: el plazo de conservación del aviso de privacidad (`[CONFIRMAR plazo]` en `eventos/privacidad/index.html`) y la revisión legal.

7. Comprueba en local (`python3 -m http.server`) a 390 px y a 1280 px, y haz commit, PR y merge.
