// Botones Copiar con respaldo para navegadores internos (TikTok, Instagram).
(function () {
  var botones = document.querySelectorAll('.btn-copiar');
  if (!botones.length) return;

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

  Array.prototype.forEach.call(botones, function (btn) {
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
})();

// Código de desbloqueo: compara el SHA-256 de "<slug>:<codigo>" con el hash de la página.
(function () {
  var form = document.getElementById('desbloqueo');
  if (!form) return;
  var input = form.querySelector('input');
  var enviar = form.querySelector('button[type="submit"]');
  var estado = document.getElementById('codigo-estado');
  var abierto = false;
  form.hidden = false;

  function aviso(msg) { estado.textContent = msg; }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }
  function sha256(texto) {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)).then(hex);
  }
  function marcar(malo) {
    if (malo) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function abrir() {
    abierto = true;
    marcar(false);
    input.readOnly = true;
    enviar.disabled = true;
    var modo = form.getAttribute('data-modo');
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
    sha256(form.getAttribute('data-slug') + ':' + codigo).then(function (h) {
      if (h === form.getAttribute('data-hash')) {
        abrir();
      } else {
        marcar(true);
        aviso('Ese código no es el correcto. Míralo otra vez al final del video e inténtalo de nuevo.');
        input.focus();
        input.select();
      }
    }, function () {
      aviso('No pudimos verificar el código. Inténtalo de nuevo.');
    });
  });
})();
