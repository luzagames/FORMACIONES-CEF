/* panel.js: panel de control (se usa como dock de OBS o en una pestaña) */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    if (text != null) e.textContent = text;
    return e;
  }

  var sync = LU.createSync('panel');
  var state = LU.normalize(null);
  var touched = false;   // hasta que el usuario cambie algo, "en pantalla" copia lo que dice el overlay
  var booted = false;

  var previewBox = $('#preview');
  var previewStage = $('#previewStage');
  var renderer = LU.createRenderer(previewStage, {
    uid: 'pv',
    editable: true,
    onMove: function (i, x, y) { state.players[i].x = x; state.players[i].y = y; commit(); },
    onSelect: function (i) { pickPlayer(i); }
  });

  /* ---------- envío y guardado ---------- */
  var sendTimer = null, persistTimer = null, lastSendAt = 0;

  function sendNow() {
    lastSendAt = Date.now();
    state._sent = LU.rev();
    sync.send({ type: 'state', state: state });
  }
  function scheduleSend() {
    if (sendTimer) return;
    var wait = Math.max(0, 40 - (Date.now() - lastSendAt));
    sendTimer = setTimeout(function () { sendTimer = null; sendNow(); }, wait);
  }
  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      var c = LU.clone(state); c.visible = false; // nunca se guarda "en pantalla"
      sync.saveState(c);
    }, 400);
  }
  function renderPreview() {
    renderer.update(state, { forceVisible: true });
    previewBox.classList.toggle('is-transparent', !!state.theme.transparent);
  }
  function commit() {
    touched = true;
    renderPreview();
    scheduleSend();
    schedulePersist();
  }

  /* ---------- vista previa ---------- */
  function fitPreview() {
    var w = previewBox.parentElement.clientWidth;
    var maxH = Math.max(240, Math.min(640, window.innerHeight * 0.62));
    var s = Math.min(w / LU.STAGE.w, maxH / LU.STAGE.h);
    if (!(s > 0)) return;
    previewStage.style.transform = 'scale(' + s + ')';
    previewBox.style.width = Math.round(LU.STAGE.w * s) + 'px';
    previewBox.style.height = Math.round(LU.STAGE.h * s) + 'px';
  }
  window.addEventListener('resize', fitPreview);
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(previewBox.parentElement);

  /* ---------- botón de aire y estado del overlay ---------- */
  function updateLive() {
    var on = state.visible;
    $('#liveBtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('#liveState').textContent = on ? 'En pantalla' : 'Fuera de pantalla';
    $('#liveAction').textContent = on ? 'Ocultar alineación' : 'Mostrar alineación';
  }
  $('#liveBtn').addEventListener('click', function () {
    state.visible = !state.visible;
    updateLive();
    commit();
  });

  var lastPresence = 0, bootAt = Date.now(), relayOverlays = 0;
  function updateLink() {
    var viaRelay = sync.mode === 'relay';
    var on = (viaRelay && relayOverlays > 0) || Date.now() - lastPresence < 6000;
    $('#link').classList.toggle('on', on);
    var texto;
    if (viaRelay && !sync.relayOk) texto = 'Sin conexión con el relay';
    else if (on) texto = viaRelay ? 'Overlay conectado (relay)' : (sync.mode === 'server' ? 'Overlay conectado (servidor local)' : 'Overlay conectado');
    else texto = viaRelay ? 'Relay conectado, esperando al overlay' : 'Sin señal del overlay';
    $('#linkText').textContent = texto;
    $('#linkHelp').hidden = on || viaRelay || sync.mode === 'server' || Date.now() - bootAt < 8000;
  }
  setInterval(updateLink, 1000);

  sync.on(function (m) {
    if (m && m.type === 'relay-presence') { relayOverlays = m.overlays | 0; updateLink(); return; }
    if (!m || !booted) return;
    if (m.type === 'presence') {
      lastPresence = Date.now();
      if (!touched && typeof m.visible === 'boolean' && m.visible !== state.visible) {
        state.visible = m.visible; updateLive();
      }
      updateLink();
    } else if (m.type === 'hello') {
      lastPresence = Date.now();
      updateLink();
      sendNow(); // el overlay se acaba de abrir: le paso el estado real
    }
  });

  /* ---------- pestañas ---------- */
  var TABS = ['lineup', 'design', 'saved', 'conn'];
  function showTab(name) {
    TABS.forEach(function (n) {
      var sel = n === name, t = $('#tab-' + n);
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      t.tabIndex = sel ? 0 : -1;
      $('#pane-' + n).hidden = !sel;
    });
  }
  TABS.forEach(function (n, i) {
    var t = $('#tab-' + n);
    t.addEventListener('click', function () { showTab(n); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var next = TABS[(i + d + TABS.length) % TABS.length];
      showTab(next); $('#tab-' + next).focus();
    });
  });

  /* ---------- formación ---------- */
  function buildFormationChips() {
    var box = $('#formationChips');
    LU.FORMATIONS.forEach(function (f) {
      var b = el('button', { type: 'button', class: 'chip', 'data-f': f }, f);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { setFormation(f, false); });
      box.appendChild(b);
    });
  }
  function refreshFormationUI() {
    $$('#formationChips .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.f === state.formation ? 'true' : 'false');
    });
  }
  function setFormation(f, fromText) {
    if (!LU.applyFormation(state, f)) return;
    if (!fromText) { $('#formationTxt').value = ''; $('#formationMsg').hidden = true; }
    refreshFormationUI();
    buildRoster();
    commit();
  }
  var formationTxt = $('#formationTxt');
  formationTxt.addEventListener('input', function () {
    var v = formationTxt.value.trim();
    var parts = LU.parseFormation(v);
    if (parts) { $('#formationMsg').hidden = true; setFormation(parts.join('-'), true); }
  });
  formationTxt.addEventListener('change', function () {
    var v = formationTxt.value.trim();
    $('#formationMsg').hidden = !v || !!LU.parseFormation(v);
  });

  /* ---------- textos ---------- */
  function bindText(id, get, set) {
    var inp = $(id);
    inp.addEventListener('input', function () { set(inp.value); commit(); });
    return function () { inp.value = get(); };
  }
  function bindCheck(id, get, set, after) {
    var inp = $(id);
    inp.addEventListener('change', function () { set(inp.checked); if (after) after(); commit(); });
    return function () { inp.checked = !!get(); };
  }

  /* ---------- jugadores ---------- */
  function buildRoster() {
    var box = $('#roster');
    box.innerHTML = '';
    LU.groups(LU.parseFormation(state.formation)).forEach(function (g) {
      var wrap = el('div', { class: 'grp' });
      wrap.appendChild(el('div', { class: 'grp-title' }, g.label === 'Arquero' ? 'Arquero' : g.label + ' (' + g.n + ')'));
      for (var k = 0; k < g.n; k++) {
        (function (i) {
          var row = el('div', { class: 'prow', 'data-i': i });
          var num = el('input', { type: 'text', class: 'num', inputmode: 'numeric', maxlength: '3', placeholder: '#', autocomplete: 'off', 'aria-label': 'Número del jugador ' + (i + 1) });
          var nm = el('input', { type: 'text', class: 'nm', placeholder: 'Apellido', autocomplete: 'off', 'aria-label': 'Apellido del jugador ' + (i + 1) });
          num.value = state.players[i].number;
          nm.value = state.players[i].name;
          num.addEventListener('input', function () { state.players[i].number = num.value; commit(); });
          nm.addEventListener('input', function () { state.players[i].name = nm.value; commit(); });
          nm.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var all = $$('#roster .nm'), at = all.indexOf(nm);
            var next = all[at + 1];
            if (next) { next.focus(); next.select(); }
          });
          row.appendChild(num); row.appendChild(nm);
          wrap.appendChild(row);
        })(g.from + k);
      }
      box.appendChild(wrap);
    });
  }
  function pickPlayer(i) {
    showTab('lineup');
    var row = $('#roster .prow[data-i="' + i + '"]');
    if (!row) return;
    var nm = $('.nm', row);
    nm.focus(); nm.select();
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('is-picked');
    setTimeout(function () { row.classList.remove('is-picked'); }, 1400);
  }
  $('#resetPos').addEventListener('click', function () { setFormation(state.formation, true); });

  /* ---------- camiseta ---------- */
  var kitRefresh = {};
  function buildKitEditor(host, key) {
    host.innerHTML = '';
    var wrap = el('div', { class: 'kit' });
    var pats = el('div', { class: 'pats', role: 'group', 'aria-label': 'Diseño de la camiseta' });
    var patBtns = LU.PATTERNS.map(function (p) {
      var b = el('button', { type: 'button', class: 'pat', 'data-p': p[0], 'aria-pressed': 'false' });
      b.addEventListener('click', function () { state[key].pattern = p[0]; kitRefresh[key](); commit(); });
      pats.appendChild(b);
      return { btn: b, id: p[0], label: p[1] };
    });
    var colors = el('div', { class: 'colors' });
    var inputs = [['base', 'Base'], ['accent', 'Motivo'], ['trim', 'Borde'], ['numberColor', 'Número']].map(function (c) {
      var lab = el('label', { class: 'color' });
      lab.appendChild(el('span', {}, c[1]));
      var inp = el('input', { type: 'color' });
      inp.addEventListener('input', function () { state[key][c[0]] = inp.value; kitRefresh[key](); commit(); });
      lab.appendChild(inp); colors.appendChild(lab);
      return { inp: inp, k: c[0] };
    });
    wrap.appendChild(pats); wrap.appendChild(colors); host.appendChild(wrap);

    kitRefresh[key] = function () {
      var kit = state[key];
      patBtns.forEach(function (p) {
        var preview = Object.assign({}, kit, { pattern: p.id });
        p.btn.innerHTML = LU.jerseySVG(preview, '', 'k' + key + p.id, false) + '<span>' + p.label + '</span>';
        p.btn.setAttribute('aria-pressed', kit.pattern === p.id ? 'true' : 'false');
      });
      inputs.forEach(function (i) { i.inp.value = LU.color(kit[i.k], '#000000'); });
      refreshCrest();
    };
  }

  /* ---------- escudo ---------- */
  function refreshCrest() {
    var thumb = $('#crestThumb');
    thumb.innerHTML = '';
    var src = LU.safeImg(state.crest);
    if (src) {
      var img = new Image(); img.alt = ''; img.src = src; thumb.appendChild(img);
    } else {
      thumb.innerHTML = LU.crestPlaceholder(state.kit, 'thumb');
    }
    $('#crestUrl').value = (src && src.indexOf('data:') !== 0) ? src : '';
  }
  function loadCrest(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || 320, h = img.naturalHeight || 320;
        var s = Math.min(1, 360 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        state.crest = c.toDataURL('image/png');
        state.showCrest = true; $('#showCrest').checked = true;
        refreshCrest(); commit();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  $('#crestBtn').addEventListener('click', function () { $('#crestFile').click(); });
  $('#crestFile').addEventListener('change', function (e) { loadCrest(e.target.files[0]); e.target.value = ''; });
  $('#crestClear').addEventListener('click', function () { state.crest = ''; refreshCrest(); commit(); });
  $('#crestUrl').addEventListener('change', function (e) {
    var v = e.target.value.trim();
    state.crest = v && LU.safeImg(v) ? v : '';
    refreshCrest(); commit();
  });
  var dropZone = $('#pane-design');
  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); $('#crestDrop').classList.add('is-over'); });
  dropZone.addEventListener('dragleave', function (e) { if (e.target === dropZone) $('#crestDrop').classList.remove('is-over'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault(); $('#crestDrop').classList.remove('is-over');
    if (e.dataTransfer && e.dataTransfer.files[0]) loadCrest(e.dataTransfer.files[0]);
  });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) { loadCrest(items[i].getAsFile()); e.preventDefault(); return; }
    }
  });

  /* ---------- tema ---------- */
  function buildThemeChips() {
    var box = $('#themeChips');
    Object.keys(LU.THEMES).forEach(function (k) {
      var t = LU.THEMES[k];
      var b = el('button', { type: 'button', class: 'chip', 'data-t': k }, t.label);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        Object.assign(state.theme, { preset: k, bg: t.bg, lines: t.lines, text: t.text });
        refreshTheme(); commit();
      });
      box.appendChild(b);
    });
  }
  function refreshTheme() {
    var t = state.theme;
    $$('#themeChips .chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.t === t.preset ? 'true' : 'false'); });
    $('#thBg').value = LU.color(t.bg, '#ffffff');
    $('#thLines').value = LU.color(t.lines, '#e6e6e6');
    $('#thText').value = LU.color(t.text, '#111111');
    $('#thTransparent').checked = !!t.transparent;
    $('#thUpper').checked = !!t.upper;
    $('#thShirt').value = t.shirtSize; $('#thShirtOut').textContent = t.shirtSize + ' px';
    $('#thName').value = t.nameSize; $('#thNameOut').textContent = t.nameSize + ' px';
  }
  [['#thBg', 'bg'], ['#thLines', 'lines'], ['#thText', 'text']].forEach(function (c) {
    $(c[0]).addEventListener('input', function (e) {
      state.theme[c[1]] = e.target.value; state.theme.preset = 'custom'; refreshTheme(); commit();
    });
  });
  $('#thTransparent').addEventListener('change', function (e) { state.theme.transparent = e.target.checked; commit(); });
  $('#thUpper').addEventListener('change', function (e) { state.theme.upper = e.target.checked; commit(); });
  $('#thShirt').addEventListener('input', function (e) { state.theme.shirtSize = +e.target.value; refreshTheme(); commit(); });
  $('#thName').addEventListener('input', function (e) { state.theme.nameSize = +e.target.value; refreshTheme(); commit(); });

  /* ---------- guardadas ---------- */
  function getSaved() {
    try { var l = JSON.parse(localStorage.getItem(LU.KEYS.saved) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  function putSaved(list) {
    try { localStorage.setItem(LU.KEYS.saved, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function say(text) {
    var m = $('#saveMsg'); m.textContent = text; m.hidden = !text;
  }
  function renderSaved() {
    var list = getSaved(), ul = $('#savedList');
    ul.innerHTML = '';
    $('#savedEmpty').hidden = list.length > 0;
    list.forEach(function (item) {
      var li = el('li');
      var name = el('div', { class: 'nm' });
      name.appendChild(document.createTextNode(item.name));
      var when = el('span', { class: 'when' }, new Date(item.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
      name.appendChild(when);
      var load = el('button', { type: 'button', class: 'btn' }, 'Cargar');
      var del = el('button', { type: 'button', class: 'btn ghost' }, 'Eliminar');
      var armed = null;
      load.addEventListener('click', function () {
        var vis = state.visible;
        state = LU.normalize(item.state); state.visible = vis;
        refreshControls(); commit();
        say('Cargada: ' + item.name);
      });
      del.addEventListener('click', function () {
        if (!armed) {
          del.textContent = '¿Seguro?'; del.classList.add('danger'); armed = setTimeout(function () { armed = null; del.textContent = 'Eliminar'; del.classList.remove('danger'); }, 3000);
          return;
        }
        clearTimeout(armed);
        putSaved(getSaved().filter(function (x) { return x.id !== item.id; }));
        renderSaved();
      });
      li.appendChild(name); li.appendChild(load); li.appendChild(del);
      ul.appendChild(li);
    });
  }
  function saveCurrent() {
    var list = getSaved();
    var name = $('#saveName').value.trim() || ('Alineación ' + (list.length + 1));
    var snap = LU.clone(state); delete snap._sent; snap.visible = false;
    var existing = list.filter(function (x) { return x.name === name; })[0];
    if (existing) { existing.state = snap; existing.at = Date.now(); }
    else list.unshift({ id: Date.now().toString(36), name: name, at: Date.now(), state: snap });
    if (putSaved(list)) { say(existing ? 'Actualizada: ' + name : 'Guardada: ' + name); $('#saveName').value = ''; }
    else say('No se pudo guardar: el almacenamiento está lleno. Elimina alguna alineación guardada.');
    renderSaved();
  }
  $('#saveBtn').addEventListener('click', saveCurrent);
  $('#saveName').addEventListener('keydown', function (e) { if (e.key === 'Enter') saveCurrent(); });

  /* ---------- exportar como imagen ---------- */
  var expTimer = null;
  function expDecir(texto, aviso) {
    var m = $('#expMsg');
    m.textContent = texto; m.hidden = !texto; m.classList.toggle('warn', !!aviso);
    clearTimeout(expTimer);
    if (texto) expTimer = setTimeout(function () { m.hidden = true; }, aviso ? 9000 : 5000);
  }
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  function exportar(formato) {
    var botones = [$('#expJpg'), $('#expPng')];
    botones.forEach(function (b) { b.disabled = true; });
    expDecir('Generando la imagen…', false);
    var ext = formato === 'png' ? 'png' : 'jpg';
    LU.exportImage(LU.clone(state), { formato: formato, escala: +$('#expSize').value })
      .then(function (r) {
        var nombre = LU.nombreArchivo(state, ext);
        descargar(r.blob, nombre);
        expDecir(r.avisos.length ? 'Imagen generada (' + nombre + '). ' + r.avisos.join(' ')
          : 'Imagen generada: ' + nombre + ' (' + r.ancho + '×' + r.alto + ')', r.avisos.length > 0);
      })
      .catch(function (e) { expDecir('No se pudo generar la imagen: ' + (e && e.message ? e.message : e), true); })
      .then(function () { botones.forEach(function (b) { b.disabled = false; }); });
  }
  $('#expJpg').addEventListener('click', function () { exportar('jpeg'); });
  $('#expPng').addEventListener('click', function () { exportar('png'); });

  /* ---------- conexión por internet (relay) ---------- */
  function dirBase() { return location.href.split(/[?#]/)[0].replace(/[^/]*$/, ''); }
  function urlDe(pagina) {
    var r = sync.relay, u = dirBase() + pagina + '?sala=' + encodeURIComponent(r.sala);
    if (r.fromQuery) u += '&relay=' + encodeURIComponent(r.http);
    return u;
  }
  function copiar(inputSel, btnSel) {
    var inp = $(inputSel), btn = $(btnSel);
    function listo() { btn.textContent = 'Copiado'; setTimeout(function () { btn.textContent = 'Copiar'; }, 1600); }
    inp.focus(); inp.select();
    var respaldo = function () { try { if (document.execCommand('copy')) listo(); } catch (e) { /* ignorar */ } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(listo, respaldo);
    else respaldo();
  }
  function cambiarSala(codigo) {
    try { localStorage.setItem(LU.KEYS.sala, codigo); } catch (e) { /* ignorar */ }
    var u = new URL(location.href); u.searchParams.delete('sala');
    location.href = u.toString();
  }
  function buildConn() {
    var info = $('#connInfo'), body = $('#connBody');
    if (!sync.relay) {
      info.textContent = 'Todavía no hay un relay configurado. Sirve para manejar el panel desde otro navegador u otra computadora ' +
        'y mandar la gráfica a OBS por internet. Los pasos están en el README, sección "Relay".';
      body.hidden = true; return;
    }
    info.textContent = 'El panel y el overlay se comunican a través del relay. Cada uno puede estar en un navegador o en un equipo distinto.';
    body.hidden = false;
    $('#salaInp').value = sync.relay.sala;
    $('#ovUrl').value = urlDe('overlay.html');
    $('#pnUrl').value = urlDe('panel.html');
    $('#ovCopy').addEventListener('click', function () { copiar('#ovUrl', '#ovCopy'); });
    $('#pnCopy').addEventListener('click', function () { copiar('#pnUrl', '#pnCopy'); });
    $('#salaInp').addEventListener('change', function () {
      var v = this.value.trim(), m = $('#salaMsg');
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
        m.textContent = 'El código debe tener de 8 a 64 letras, números, guion o guion bajo.'; m.hidden = false;
        this.value = sync.relay.sala; return;
      }
      m.hidden = true;
      if (v !== sync.relay.sala) cambiarSala(v);
    });
    var armado = null, nuevo = $('#salaNew');
    nuevo.addEventListener('click', function () {
      if (!armado) {
        nuevo.textContent = '¿Seguro? Se desconecta el overlay actual'; nuevo.classList.add('danger');
        armado = setTimeout(function () { armado = null; nuevo.textContent = 'Código nuevo'; nuevo.classList.remove('danger'); }, 4000);
        return;
      }
      clearTimeout(armado);
      cambiarSala(LU.newSala());
    });
  }
  sync.onOpen(function () { if (touched) sendNow(); updateLink(); }); // al reconectar, lo último que edité vuelve a salir
  sync.onStatus(updateLink);

  /* ---------- enlaces entre estado y controles ---------- */
  var textRefreshers = [];
  function buildBindings() {
    textRefreshers = [
      bindText('#titleInp', function () { return state.title; }, function (v) { state.title = v; }),
      bindText('#coachLbl', function () { return state.coachLabel; }, function (v) { state.coachLabel = v; }),
      bindText('#coachInp', function () { return state.coach; }, function (v) { state.coach = v; }),
      bindCheck('#showCoach', function () { return state.showCoach; }, function (v) { state.showCoach = v; }),
      bindCheck('#showCrest', function () { return state.showCrest; }, function (v) { state.showCrest = v; }),
      bindCheck('#showNumbers', function () { return state.showNumbers; }, function (v) { state.showNumbers = v; }),
      bindCheck('#gkSame', function () { return state.gkSame; }, function (v) { state.gkSame = v; }, function () { $('#gkEditor').hidden = state.gkSame; })
    ];
  }
  function refreshControls() {
    textRefreshers.forEach(function (f) { f(); });
    $('#gkEditor').hidden = state.gkSame;
    formationTxt.value = '';
    $('#formationMsg').hidden = true;
    refreshFormationUI();
    buildRoster();
    kitRefresh.kit(); kitRefresh.gkKit();
    refreshTheme();
    refreshCrest();
    renderPreview();
    updateLive();
  }

  /* ---------- arranque ---------- */
  buildFormationChips();
  buildThemeChips();
  buildKitEditor($('#kitEditor'), 'kit');
  buildKitEditor($('#gkEditor'), 'gkKit');
  buildBindings();
  renderSaved();
  buildConn();
  showTab('lineup');

  sync.ready.then(function () { return sync.loadState(); }).then(function (s) {
    state = LU.normalize(s || null);
    if (sync.mode === 'local') state.visible = false; // solo en modo local: con servidor o relay se respeta lo que está al aire
    refreshControls();
    fitPreview();
    booted = true;
    updateLink();
  });
})();
