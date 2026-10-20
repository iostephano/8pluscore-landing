(function () {
  // ---- Botones Copiar con respaldo para navegadores internos (TikTok, Instagram) ----
  function seleccionar(fuente) {
    var sel = window.getSelection();
    var rango = document.createRange();
    rango.selectNodeContents(fuente);
    sel.removeAllRanges();
    sel.addRange(rango);
  }
  function respaldo(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, texto.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  // Activa los botones Copiar dentro de "raiz" (la página, o el contenido recién desbloqueado).
  function iniciarCopiar(raiz) {
    Array.prototype.forEach.call(raiz.querySelectorAll('.btn-copiar'), function (btn) {
      var fuente = document.getElementById(btn.getAttribute('data-target'));
      var estado = document.getElementById(btn.getAttribute('data-estado'));
      var original = btn.textContent;
      btn.hidden = false;

      function aviso(msg) { if (estado) estado.textContent = msg; }
      function listo() {
        btn.textContent = 'Copiado';
        aviso('Copiado.');
        setTimeout(function () { btn.textContent = original; }, 2000);
      }
      function manual() {
        seleccionar(fuente);
        aviso('Tu navegador no deja copiar solo. Mantén presionado el texto seleccionado y elige Copiar.');
      }

      btn.addEventListener('click', function () {
        var texto = fuente.textContent;
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(texto).then(listo, function () {
            if (respaldo(texto)) listo(); else manual();
          });
        } else if (respaldo(texto)) {
          listo();
        } else {
          manual();
        }
      });
    });
  }
  iniciarCopiar(document);

  // ---- Código de desbloqueo ----
  var form = document.getElementById('desbloqueo');
  if (!form) return;
  var modo = form.getAttribute('data-modo');
  var input = form.querySelector('input');
  var enviar = form.querySelector('button[type="submit"]');
  var estado = document.getElementById('codigo-estado');
  var abierto = false;
  form.hidden = false;

  function aviso(msg) { estado.textContent = msg; }
  function marcar(malo) {
    if (malo) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
  function bytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }
  function cerrar() {
    abierto = true;
    marcar(false);
    input.readOnly = true;
    enviar.disabled = true;
  }

  // Modos "descarga" y "pestana": compara el SHA-256 de "<slug>:<codigo>" con el hash de la página.
  function verificarHash(codigo) {
    var texto = new TextEncoder().encode(form.getAttribute('data-slug') + ':' + codigo);
    return window.crypto.subtle.digest('SHA-256', texto).then(function (buf) {
      return hex(buf) === form.getAttribute('data-hash');
    });
  }
  function entregarArchivo() {
    cerrar();
    var enlace = document.createElement('a');
    enlace.className = 'btn btn-descarga';
    enlace.href = form.getAttribute('data-href');
    enlace.textContent = form.getAttribute('data-etiqueta');
    if (modo === 'pestana') {
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
    } else {
      enlace.setAttribute('download', '');
    }
    form.appendChild(enlace);
    aviso(modo === 'pestana'
      ? 'Código correcto. Se abre el documento en una pestaña nueva. Si no se abre, usa el botón.'
      : 'Código correcto. Tu descarga empieza ahora. Si no empieza, usa el botón.');
    enlace.click();
    enlace.focus();
  }

  // Modo "contenido": el código es la clave (PBKDF2 y AES-GCM). Si descifra, el código es correcto.
  function descifrar(codigo) {
    var subtle = window.crypto.subtle;
    return subtle.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: bytes(form.getAttribute('data-salt')), iterations: parseInt(form.getAttribute('data-iter'), 10), hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
        );
      })
      .then(function (clave) {
        return subtle.decrypt({ name: 'AES-GCM', iv: bytes(form.getAttribute('data-iv')) }, clave, bytes(form.getAttribute('data-datos')))
          .then(function (buf) { return new TextDecoder().decode(buf); }, function () { return null; });
      });
  }
  function mostrarContenido(html) {
    cerrar();
    var caja = document.getElementById('contenido');
    caja.innerHTML = html; // HTML generado y cifrado por el generador, autenticado por AES-GCM
    iniciarCopiar(caja);
    aviso('Código correcto. Aquí tienes el prompt y los comandos.');
    caja.focus();
  }

  function incorrecto() {
    marcar(true);
    aviso('Ese código no es el correcto. Míralo otra vez al final del video e inténtalo de nuevo.');
    input.focus();
    input.select();
  }

  input.addEventListener('input', function () {
    var limpio = input.value.replace(/\D/g, '').slice(0, 5);
    if (limpio !== input.value) input.value = limpio;
    marcar(false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (abierto) return;
    var codigo = input.value;
    if (!/^\d{5}$/.test(codigo)) {
      marcar(true);
      aviso('El código tiene 5 números. Lo encuentras al final del video.');
      input.focus();
      return;
    }
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) {
      aviso('Este navegador no puede verificar el código. Abre la página en otro navegador, con conexión segura.');
      return;
    }
    var fallo = function () { aviso('No pudimos verificar el código. Inténtalo de nuevo.'); };
    if (modo === 'contenido') {
      descifrar(codigo).then(function (html) {
        if (html === null) incorrecto(); else mostrarContenido(html);
      }).catch(fallo);
    } else {
      verificarHash(codigo).then(function (ok) {
        if (ok) entregarArchivo(); else incorrecto();
      }).catch(fallo);
    }
  });
})();
