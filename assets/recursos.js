// Botón Copiar con respaldo para navegadores internos (TikTok, Instagram).
(function () {
  var btn = document.getElementById('copiar');
  var estado = document.getElementById('copiar-estado');
  if (!btn) return;
  var fuente = document.getElementById(btn.getAttribute('data-target'));
  var original = btn.textContent;
  btn.hidden = false;

  function aviso(msg) {
    if (estado) estado.textContent = msg;
  }
  function seleccionar() {
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
  function listo() {
    btn.textContent = 'Copiado';
    aviso('Prompt copiado.');
    setTimeout(function () { btn.textContent = original; }, 2000);
  }
  function manual() {
    seleccionar();
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
})();
