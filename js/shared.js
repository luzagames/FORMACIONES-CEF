/* ============================================================
   shared.js
   Lógica común del panel y del overlay.
   Sin módulos ES a propósito: así también funciona abriendo los
   archivos locales (file://) dentro de OBS.
   ============================================================ */
(function (global) {
  'use strict';

  var LU = {};
  LU.STAGE = { w: 1080, h: 1350 };
  LU.KEYS = {
    live: 'lineup-obs:live',         // último estado enviado (respaldo de sincronización)
    state: 'lineup-obs:state',       // estado guardado por el panel (sin "visible")
    saved: 'lineup-obs:saved',       // alineaciones guardadas por el usuario
    presence: 'lineup-obs:presence', // latido del overlay (respaldo de sincronización)
    sala: 'lineup-obs:sala'          // código de sala del relay (lo guarda el panel)
  };

  LU.PATTERNS = [
    ['sash', 'Banda /'],
    ['sash-inv', 'Banda \\'],
    ['stripes', 'Rayas verticales'],
    ['hoops', 'Rayas horizontales'],
    ['halves', 'Mitades'],
    ['band', 'Franja'],
    ['sleeves', 'Mangas'],
    ['solid', 'Lisa']
  ];

  LU.FORMATIONS = [
    '4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '4-3-2-1', '4-4-1-1',
    '4-1-2-1-2', '3-5-2', '3-4-3', '3-4-2-1', '5-3-2', '5-4-1'
  ];

  LU.THEMES = {
    claro:  { label: 'Claro',  bg: '#ffffff', lines: '#e6e6e6', text: '#111111' },
    oscuro: { label: 'Oscuro', bg: '#11151b', lines: '#2b323d', text: '#f4f6f8' },
    cesped: { label: 'Césped', bg: '#1d7a41', lines: '#7cc394', text: '#ffffff' }
  };

  /* ---------- utilidades ---------- */
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function num(v, fb) { v = Number(v); return isFinite(v) ? v : fb; }
  function str(v, fb) { return typeof v === 'string' ? v : (v == null ? fb : String(v)); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  LU.color = function (v, fb) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fb;
  };
  LU.safeImg = function (v) {
    return typeof v === 'string' &&
      /^(data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,|https?:\/\/)/i.test(v) ? v : '';
  };
  var seq = 0;
  LU.rev = function () { return Date.now() * 1000 + (seq++ % 1000); };
  LU.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ---------- formaciones ---------- */
  // "4-2-3-1" -> [4,2,3,1] (de la defensa al ataque). Devuelve null si no es válida.
  LU.parseFormation = function (text) {
    var parts = String(text || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    if (parts.length < 2 || parts.length > 6) return null;
    if (parts.some(function (n) { return n < 1 || n > 6; })) return null;
    if (parts.reduce(function (a, b) { return a + b; }, 0) !== 10) return null;
    return parts;
  };

  // Posiciones (en % del campo) para el arquero + cada línea. y=0 es el arco rival.
  LU.layoutFor = function (parts) {
    var pos = [{ x: 50, y: 89 }];
    var L = parts.length, yDef = 74, yAtk = 14;
    parts.forEach(function (n, li) {
      var y = yDef - li * (yDef - yAtk) / (L - 1);
      var step = n === 1 ? 0 : Math.min(29, 84 / (n - 1));
      for (var i = 0; i < n; i++) {
        pos.push({ x: round1(50 + (i - (n - 1) / 2) * step), y: round1(y) });
      }
    });
    return pos;
  };

  // Grupos para la lista de jugadores del panel
  LU.groups = function (parts) {
    var g = [{ label: 'Arquero', from: 0, n: 1 }], idx = 1;
    parts.forEach(function (n, li) {
      var role = li === 0 ? 'Defensa' : (li === parts.length - 1 ? 'Ataque' : 'Mediocampo');
      g.push({ label: role, from: idx, n: n });
      idx += n;
    });
    return g;
  };

  LU.applyFormation = function (state, text) {
    var parts = LU.parseFormation(text);
    if (!parts) return false;
    var lay = LU.layoutFor(parts);
    state.formation = parts.join('-');
    state.players.forEach(function (p, i) { p.x = lay[i].x; p.y = lay[i].y; });
    return true;
  };

  /* ---------- estado ---------- */
  var SAMPLE = ['BELTRÁN', 'ACUÑA', 'M. QUARTA', 'OTAMENDI', 'MONTIEL',
    'VERA', 'ALMADA', 'GALVÁN', 'CORREA', 'ANDRADA', 'DRIUSSI'];

  LU.defaults = function () {
    var f = '4-2-3-1', lay = LU.layoutFor(LU.parseFormation(f));
    return {
      _sent: 0,
      visible: false,
      title: 'PROBABLE ONCE',
      showCrest: true,
      crest: '',
      showCoach: true,
      coachLabel: 'DT',
      coach: 'LEONARDO PONZIO',
      formation: f,
      players: SAMPLE.map(function (n, i) {
        return { name: n, number: '', x: lay[i].x, y: lay[i].y };
      }),
      showNumbers: false,
      kit: { pattern: 'sash', base: '#ffffff', accent: '#e2001a', trim: '#1a1a1a', numberColor: '#1a1a1a' },
      gkSame: true,
      gkKit: { pattern: 'solid', base: '#f2b800', accent: '#1a1a1a', trim: '#1a1a1a', numberColor: '#1a1a1a' },
      theme: {
        preset: 'claro', bg: '#ffffff', lines: '#e6e6e6', text: '#111111',
        transparent: false, upper: true, shirtSize: 104, nameSize: 30
      }
    };
  };

  function merge(base, over) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!isObj(over)) return out;
    Object.keys(over).forEach(function (k) {
      if (isObj(base[k]) && isObj(over[k])) out[k] = merge(base[k], over[k]);
      else if (over[k] !== undefined) out[k] = over[k];
    });
    return out;
  }

  // Completa lo que falte y sanea los datos (sirve para estados viejos o incompletos)
  LU.normalize = function (s) {
    var d = LU.defaults(), out = merge(d, s || {});
    var parts = LU.parseFormation(out.formation);
    if (!parts) { out.formation = d.formation; parts = LU.parseFormation(d.formation); }
    var lay = LU.layoutFor(parts);
    var src = s && Array.isArray(s.players) ? s.players : null;
    out.players = d.players.map(function (dp, i) {
      var p = src ? (src[i] || {}) : dp;
      return {
        name: str(p.name, ''),
        number: str(p.number, '').slice(0, 3),
        x: clamp(num(p.x, lay[i].x), 0, 100),
        y: clamp(num(p.y, lay[i].y), 0, 100)
      };
    });
    out.title = str(out.title, ''); out.coach = str(out.coach, ''); out.coachLabel = str(out.coachLabel, '');
    out.visible = !!out.visible;
    out.theme.shirtSize = clamp(num(out.theme.shirtSize, 104), 60, 160);
    out.theme.nameSize = clamp(num(out.theme.nameSize, 30), 16, 48);
    return out;
  };

  /* ---------- camiseta (SVG) ---------- */
  var BODY = 'M35 8 L17 16 L3 40 L20 50 L26 43 L26 93 Q26 96 30 96 L70 96 Q74 96 74 93 L74 43 L80 50 L97 40 L83 16 L65 8 Q50 24 35 8 Z';

  function patternMarkup(pattern, a) {
    var p = '', i;
    switch (pattern) {
      case 'sash':     p = '<polygon points="58,0 84,0 43,100 17,100" fill="' + a + '"/>'; break;
      case 'sash-inv': p = '<polygon points="42,0 16,0 57,100 83,100" fill="' + a + '"/>'; break;
      case 'stripes':
        for (i = 1; i < 7; i += 2) p += '<rect x="' + (i * 100 / 7).toFixed(2) + '" y="0" width="' + (100 / 7).toFixed(2) + '" height="100" fill="' + a + '"/>';
        break;
      case 'hoops':
        for (i = 1; i < 8; i += 2) p += '<rect x="0" y="' + (i * 12.5) + '" width="100" height="12.5" fill="' + a + '"/>';
        break;
      case 'halves':   p = '<rect x="0" y="0" width="50" height="100" fill="' + a + '"/>'; break;
      case 'band':     p = '<rect x="26" y="44" width="48" height="18" fill="' + a + '"/>'; break; // solo el torso: no invade las mangas
      case 'sleeves':  p = '<rect x="0" y="0" width="26" height="100" fill="' + a + '"/><rect x="74" y="0" width="26" height="100" fill="' + a + '"/>'; break;
      default: p = '';
    }
    return p;
  }

  LU.jerseySVG = function (kit, number, uid, showNumber) {
    var b = LU.color(kit.base, '#ffffff'), a = LU.color(kit.accent, '#e2001a'),
      t = LU.color(kit.trim, '#1a1a1a'), n = LU.color(kit.numberColor, '#1a1a1a');
    var id = 'lu-clip-' + uid, txt = '';
    if (showNumber && number) {
      var len = String(number).length, fs = len > 2 ? 26 : (len === 2 ? 34 : 40);
      txt = '<text x="50" y="76" text-anchor="middle" font-family="Archivo Variable, Archivo, Arial, sans-serif" ' +
        'font-weight="900" font-size="' + fs + '" fill="' + n + '">' + esc(number) + '</text>';
    }
    return '<svg class="lu-shirt" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><path d="' + BODY + '"/></clipPath></defs>' +
      '<path d="' + BODY + '" fill="' + b + '"/>' +
      '<g clip-path="url(#' + id + ')">' + patternMarkup(kit.pattern, a) + '</g>' +
      '<path d="' + BODY + '" fill="none" stroke="' + t + '" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<path d="M35 8 Q50 24 65 8" fill="none" stroke="' + t + '" stroke-width="5" stroke-linecap="round"/>' +
      txt + '</svg>';
  };

  // Escudo genérico (con los colores de la camiseta) para cuando no se subió uno
  LU.crestPlaceholder = function (kit, uid) {
    var b = LU.color(kit.base, '#ffffff'), a = LU.color(kit.accent, '#e2001a'), t = LU.color(kit.trim, '#1a1a1a');
    var d = 'M50 5 L92 17 V58 C92 88 70 106 50 116 C30 106 8 88 8 58 V17 Z', id = 'lu-crest-' + uid;
    return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><path d="' + d + '"/></clipPath></defs>' +
      '<path d="' + d + '" fill="' + b + '"/>' +
      '<g clip-path="url(#' + id + ')"><polygon points="62,0 96,0 38,120 4,120" fill="' + a + '"/></g>' +
      '<path d="' + d + '" fill="none" stroke="' + t + '" stroke-width="5" stroke-linejoin="round"/></svg>';
  };

  /* ---------- ajuste de texto largo ---------- */
  // Condensa con el eje de ancho de la fuente y, si aún no entra, con un escalado horizontal.
  LU.fitText = function (el, maxW) {
    el.style.fontStretch = '100%';
    el.style.setProperty('--fit', 1);
    var w = el.offsetWidth;
    if (!w || w <= maxW) return;
    var s = Math.max(62, Math.floor(100 * maxW / w));
    el.style.fontStretch = s + '%';
    w = el.offsetWidth;
    if (w > maxW) el.style.setProperty('--fit', (maxW / w).toFixed(3));
  };

  LU.fontsReady = function () {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('900 40px "Archivo Variable"'),
      document.fonts.load('800 30px "Archivo Variable"'),
      document.fonts.load('500 30px "Archivo Variable"')
    ]).catch(function () {});
  };

  /* ---------- dibujo de la gráfica ---------- */
  var TEMPLATE =
    '<div class="lu-card" data-visible="false" data-case="upper" data-transparent="false">' +
      '<header class="lu-head">' +
        '<div class="lu-crest"><img alt="" hidden><div class="lu-crest-ph"></div></div>' +
        '<h1 class="lu-title"><span></span></h1>' +
      '</header>' +
      '<div class="lu-pitch">' +
        '<svg class="lu-lines" viewBox="0 0 960 1005" aria-hidden="true">' +
          '<rect x="3" y="3" width="954" height="999"/>' +
          '<line x1="3" y1="502.5" x2="957" y2="502.5"/>' +
          '<circle cx="480" cy="502.5" r="135"/><circle class="dot" cx="480" cy="502.5" r="7"/>' +
          '<rect x="200" y="3" width="560" height="200"/><rect x="345" y="3" width="270" height="72"/>' +
          '<path d="M408 203 A96 96 0 0 0 552 203"/><circle class="dot" cx="480" cy="140" r="6"/>' +
          '<rect x="200" y="802" width="560" height="200"/><rect x="345" y="930" width="270" height="72"/>' +
          '<path d="M408 802 A96 96 0 0 1 552 802"/><circle class="dot" cx="480" cy="865" r="6"/>' +
        '</svg>' +
      '</div>' +
      '<footer class="lu-foot"><span class="lu-coach"><span class="lbl"></span><b></b></span></footer>' +
    '</div>';

  /*
    createRenderer(root, opts)
      opts.uid       prefijo para ids únicos de SVG
      opts.editable  permite arrastrar jugadores (vista previa del panel)
      opts.onMove(i, x, y)   mientras se arrastra
      opts.onSelect(i)       clic sin arrastrar
  */
  LU.createRenderer = function (root, opts) {
    opts = opts || {};
    var uid = opts.uid || ('r' + Math.random().toString(36).slice(2, 6));
    root.innerHTML = TEMPLATE;
    var card = root.querySelector('.lu-card'),
      pitch = card.querySelector('.lu-pitch'),
      titleEl = card.querySelector('.lu-title span'),
      crestBox = card.querySelector('.lu-crest'),
      crestImg = crestBox.querySelector('img'),
      crestPh = crestBox.querySelector('.lu-crest-ph'),
      coachBox = card.querySelector('.lu-coach'),
      coachLbl = coachBox.querySelector('.lbl'),
      coachName = coachBox.querySelector('b'),
      foot = card.querySelector('.lu-foot');

    var players = [];
    for (var i = 0; i < 11; i++) {
      var el = document.createElement('div');
      el.className = 'lu-player';
      el.dataset.i = i;
      el.style.setProperty('--i', i);
      el.innerHTML = '<span class="lu-shirt-host"></span><span class="lu-name"></span>';
      pitch.appendChild(el);
      players.push({ el: el, host: el.firstChild, name: el.lastChild, key: '' });
    }

    function fitAll() {
      LU.fitText(titleEl, card.querySelector('.lu-title').clientWidth);
      players.forEach(function (p) { LU.fitText(p.name, 200); });
      LU.fitText(coachName, 760);
    }

    function update(state, flags) {
      flags = flags || {};
      var t = state.theme;
      card.style.setProperty('--bg', t.transparent ? 'transparent' : LU.color(t.bg, '#ffffff'));
      card.style.setProperty('--lines', LU.color(t.lines, '#e6e6e6'));
      card.style.setProperty('--text', LU.color(t.text, '#111111'));
      card.style.setProperty('--shirt', t.shirtSize + 'px');
      card.style.setProperty('--nm', t.nameSize + 'px');
      card.dataset.visible = (flags.forceVisible || state.visible) ? 'true' : 'false';
      card.dataset.case = t.upper ? 'upper' : 'as-is';
      card.dataset.transparent = t.transparent ? 'true' : 'false';

      titleEl.textContent = state.title;
      card.querySelector('.lu-title').hidden = !state.title;

      // escudo
      crestBox.hidden = !state.showCrest;
      var img = LU.safeImg(state.crest);
      if (img) {
        if (crestImg.getAttribute('src') !== img) crestImg.src = img;
        crestImg.hidden = false; crestPh.hidden = true;
      } else {
        crestImg.hidden = true; crestPh.hidden = false;
        var phKey = JSON.stringify(state.kit);
        if (crestPh.dataset.key !== phKey) { crestPh.innerHTML = LU.crestPlaceholder(state.kit, uid); crestPh.dataset.key = phKey; }
      }

      // DT
      foot.hidden = !state.showCoach || (!state.coach && !state.coachLabel);
      coachLbl.textContent = state.coachLabel ? state.coachLabel + ':' : '';
      coachName.textContent = state.coach;

      // jugadores
      state.players.forEach(function (pl, idx) {
        var v = players[idx], kit = (idx === 0 && !state.gkSame) ? state.gkKit : state.kit;
        v.el.style.left = pl.x + '%';
        v.el.style.top = pl.y + '%';
        v.name.textContent = pl.name;
        var key = JSON.stringify(kit) + '|' + pl.number + '|' + state.showNumbers;
        if (v.key !== key) { v.host.innerHTML = LU.jerseySVG(kit, pl.number, uid + '-' + idx, state.showNumbers); v.key = key; }
      });

      fitAll();
      LU.fontsReady().then(fitAll);
    }

    function replay() {
      var was = card.dataset.visible;
      if (was !== 'true') return;
      card.dataset.visible = 'false';
      void card.offsetWidth;
      requestAnimationFrame(function () { card.dataset.visible = 'true'; });
    }

    /* arrastrar jugadores (solo vista previa) */
    if (opts.editable) {
      card.classList.add('is-editing');
      var drag = null;
      pitch.addEventListener('pointerdown', function (e) {
        var pl = e.target.closest('.lu-player');
        if (!pl) return;
        drag = { i: +pl.dataset.i, el: pl, sx: e.clientX, sy: e.clientY, moved: false };
        pl.setPointerCapture(e.pointerId);
        pl.classList.add('dragging');
        e.preventDefault();
      });
      pitch.addEventListener('pointermove', function (e) {
        if (!drag) return;
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) drag.moved = true;
        if (!drag.moved) return;
        var r = pitch.getBoundingClientRect();
        var x = clamp((e.clientX - r.left) / r.width * 100, 2, 98);
        var y = clamp((e.clientY - r.top) / r.height * 100, 2, 98);
        if (opts.onMove) opts.onMove(drag.i, round1(x), round1(y));
      });
      var end = function (e) {
        if (!drag) return;
        drag.el.classList.remove('dragging');
        if (!drag.moved && opts.onSelect) opts.onSelect(drag.i);
        drag = null;
      };
      pitch.addEventListener('pointerup', end);
      pitch.addEventListener('pointercancel', end);
    }

    return { update: update, replay: replay, card: card, pitch: pitch };
  };

  /* ---------- relay por internet (Cloudflare Worker) ---------- */
  // Código de sala: 12 caracteres al azar sin letras confusas. Hace de contraseña de la sala.
  LU.newSala = function () {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', out = '', b = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (var i = 0; i < b.length; i++) out += abc.charAt(b[i] % abc.length);
    return out;
  };

  // Devuelve { http, ws, sala, fromQuery } si hay relay configurado (js/config.js o ?relay=) y sala; si no, null.
  // El panel crea y recuerda su sala; el overlay la recibe siempre en la dirección (?sala=).
  LU.relayConfig = function (role) {
    var q = new URLSearchParams(location.search);
    var fromQuery = !!q.get('relay');
    var base = (q.get('relay') || (window.LU_CONFIG && window.LU_CONFIG.relay) || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(base)) return null;
    var sala = (q.get('sala') || '').trim();
    if (!sala && role === 'panel') { try { sala = localStorage.getItem(LU.KEYS.sala) || ''; } catch (e) { sala = ''; } }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(sala)) {
      if (role !== 'panel') return null;
      sala = LU.newSala();
    }
    if (role === 'panel') { try { localStorage.setItem(LU.KEYS.sala, sala); } catch (e) { /* ignorar */ } }
    return { http: base, ws: base.replace(/^http/i, 'ws'), sala: sala, fromQuery: fromQuery };
  };

  /* ---------- sincronización panel <-> overlay ----------
     Cuatro caminos, para que funcione en cualquier configuración:
       1) BroadcastChannel (instantáneo, mismo navegador)
       2) localStorage + evento "storage" (respaldo)
       3) Servidor local (server.js) con SSE, si las páginas se abren por http://
       4) Relay en internet (carpeta relay/): panel y overlay en navegadores o equipos distintos
  ------------------------------------------------------------ */
  LU.createSync = function (role) {
    var id = Math.random().toString(36).slice(2);
    var handlers = [], mode = 'local', bc = null, es = null;
    var api = { mode: 'local', relay: null, relayOk: false };

    // --- relay por internet ---
    var relay = LU.relayConfig(role);
    api.relay = relay;
    var ws = null, wsOk = false, wsPending = null, wsRetry = 0, wsTimer = null, wsBeat = null;
    var openHandlers = [], statusHandlers = [];

    function setRelayStatus(ok) {
      wsOk = ok; api.relayOk = ok;
      statusHandlers.forEach(function (h) { try { h(ok); } catch (e) { console.error(e); } });
    }
    function retryRelay() {
      if (wsTimer) return;
      wsTimer = setTimeout(connectRelay, Math.min(5000, 500 * Math.pow(2, wsRetry++)));
    }
    function connectRelay() {
      clearTimeout(wsTimer); wsTimer = null;
      var mine;
      try { mine = ws = new WebSocket(relay.ws + '/sala/' + relay.sala + '?rol=' + role); } catch (e) { retryRelay(); return; }
      mine.onopen = function () {
        if (mine !== ws) return;
        wsRetry = 0; setRelayStatus(true);
        clearInterval(wsBeat);
        // "ping" cada 25 s: mantiene viva la conexión y el relay lo contesta solo, sin gastar cuota
        wsBeat = setInterval(function () { try { mine.send('ping'); } catch (e) { /* ignorar */ } }, 25000);
        if (wsPending) { var p = wsPending; wsPending = null; sendRelay(p); }
        openHandlers.forEach(function (h) { try { h(); } catch (e) { console.error(e); } });
      };
      mine.onmessage = function (e) {
        if (e.data === 'pong') return;
        try { var m = JSON.parse(e.data); if (m && m.type) emit(m); } catch (err) { /* ignorar */ }
      };
      mine.onclose = function () {
        if (mine !== ws) return;
        clearInterval(wsBeat); setRelayStatus(false); retryRelay();
      };
      mine.onerror = function () { try { mine.close(); } catch (e) { /* ignorar */ } };
    }
    function sendRelay(msg) {
      if (msg.type === 'presence') return; // el relay ya avisa quién está conectado: sin latidos, sin gasto de cuota
      if (wsOk) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* ignorar */ } }
      else if (msg.type === 'state') wsPending = msg; // si no hay conexión, se manda lo último al reconectar
    }
    api.onOpen = function (fn) { openHandlers.push(fn); };
    api.onStatus = function (fn) { statusHandlers.push(fn); };

    function emit(m) {
      handlers.forEach(function (h) { try { h(m); } catch (e) { console.error(e); } });
    }

    try {
      bc = new BroadcastChannel('lineup-obs');
      bc.onmessage = function (e) { if (e.data && e.data.type) emit(e.data); };
    } catch (e) { bc = null; }

    window.addEventListener('storage', function (e) {
      if (!e.newValue) return;
      try {
        if (e.key === LU.KEYS.live && role === 'overlay') emit({ type: 'state', state: JSON.parse(e.newValue) });
        if (e.key === LU.KEYS.presence && role === 'panel') emit(JSON.parse(e.newValue));
      } catch (err) { /* ignorar */ }
    });

    function post(msg) {
      try {
        fetch('api/msg', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: id, msg: msg })
        }).catch(function () {});
      } catch (e) { /* ignorar */ }
    }

    var liveTimer = null, livePending = null;
    function queueLive(state) {
      livePending = state;
      if (liveTimer) return;
      liveTimer = setTimeout(function () {
        liveTimer = null;
        try { localStorage.setItem(LU.KEYS.live, JSON.stringify(livePending)); } catch (e) { /* ignorar */ }
      }, 200);
    }

    api.on = function (fn) { handlers.push(fn); };

    api.send = function (msg) {
      if (bc) { try { bc.postMessage(msg); } catch (e) { /* ignorar */ } }
      if (mode === 'server') post(msg);
      if (mode === 'relay') sendRelay(msg);
      if (msg.type === 'state') queueLive(msg.state);
      if (msg.type === 'presence' || msg.type === 'hello') {
        try { localStorage.setItem(LU.KEYS.presence, JSON.stringify(Object.assign({ t: Date.now() + Math.random() }, msg))); } catch (e) { /* ignorar */ }
      }
    };

    api.loadState = function () {
      var local = null;
      try {
        var raw = localStorage.getItem(role === 'panel' ? LU.KEYS.state : LU.KEYS.live);
        local = raw ? JSON.parse(raw) : null;
      } catch (e) { local = null; }
      if (mode === 'relay') {
        return fetch(relay.http + '/sala/' + relay.sala + '/ultimo', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (st) { return st || local; }).catch(function () { return local; });
      }
      if (mode !== 'server') return Promise.resolve(local);
      return fetch('api/last').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (s) { return s || local; }).catch(function () { return local; });
    };

    api.saveState = function (state) {
      try { localStorage.setItem(LU.KEYS.state, JSON.stringify(state)); } catch (e) { /* ignorar */ }
    };

    var canPing = location.protocol.indexOf('http') === 0;
    api.ready = (relay ? Promise.resolve('relay') : canPing
      ? fetch('api/ping').then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { return t === 'ok' ? 'server' : 'local'; }).catch(function () { return 'local'; })
      : Promise.resolve('local')
    ).then(function (m) {
      mode = m; api.mode = m;
      if (m === 'relay') connectRelay();
      if (m === 'server') {
        es = new EventSource('events');
        es.onmessage = function (e) {
          try {
            var env = JSON.parse(e.data);
            if (env.from !== id && env.msg) emit(env.msg);
          } catch (err) { /* ignorar */ }
        };
      }
      return m;
    });

    return api;
  };

  global.LU = LU;
})(window);
