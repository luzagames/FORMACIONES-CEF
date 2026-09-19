/* overlay.js: recibe el estado del panel y dibuja la gráfica */
(function () {
  'use strict';

  var host = document.getElementById('stage');
  var hint = document.getElementById('hint');
  var demo = new URLSearchParams(location.search).has('demo');

  var renderer = LU.createRenderer(host, { uid: 'ov' });
  var sync = LU.createSync('overlay');
  var current = LU.normalize(null);
  var lastSent = 0;
  var gotData = false;

  // El tablero gris y el texto de espera son solo para pruebas en un navegador: se activan con ?tablero
  if (new URLSearchParams(location.search).has('tablero')) document.body.classList.add('is-browser');

  function fit() {
    var s = Math.min(window.innerWidth / LU.STAGE.w, window.innerHeight / LU.STAGE.h);
    host.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  function apply(state) {
    if (!state) return;
    var sent = state._sent || 0;
    if (sent && sent <= lastSent) return; // mensaje viejo o repetido
    lastSent = sent || lastSent;
    gotData = true;
    current = LU.normalize(state);
    renderer.update(current);
    hint.classList.remove('on');
  }

  sync.on(function (m) {
    if (m && m.type === 'state') apply(m.state);
  });

  // Estado inicial (por si el panel está cerrado). Nunca arranca "en pantalla" por su cuenta.
  renderer.update(current);
  sync.ready.then(function () {
    return sync.loadState();
  }).then(function (s) {
    if (s && !gotData) {
      if (sync.mode === 'local') s.visible = false; // con servidor o relay, la última alineación es la real
      current = LU.normalize(s);
      renderer.update(current);
    } else if (!s && demo) {
      current = LU.normalize(null);
      current.visible = true;
      renderer.update(current);
    }
    if (!s && !demo) hint.classList.add('on');
    // Avisar al panel: si está abierto, responde con el estado real (incluido si está en pantalla)
    sync.send({ type: 'hello' });
  });

  // Con el relay: al conectar (y al reconectar) se pide la última alineación y se avisa al panel
  sync.onOpen(function () {
    sync.loadState().then(function (s) { if (s) apply(s); });
    sync.send({ type: 'hello' });
  });

  // Latido: el panel lo usa para mostrar "Overlay conectado" (el relay no lo necesita: avisa solo)
  setInterval(function () {
    sync.send({ type: 'presence', visible: current.visible, sent: lastSent });
  }, 2000);

  // Si OBS vuelve a mostrar la fuente, repetir la animación de entrada
  window.addEventListener('obsSourceVisibleChanged', function (e) {
    if (e.detail && e.detail.visible) renderer.replay();
  });
})();
