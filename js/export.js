/* export.js: exporta la gráfica como imagen (JPG o PNG).

   La gráfica se dibuja en un canvas usando las medidas de una copia real de la gráfica (fuera de pantalla),
   así el resultado coincide con lo que se ve. No usa librerías externas ni necesita internet. */
(function (global) {
  'use strict';

  var LU = global.LU;

  var STRETCH = [['ultra-condensed', 50], ['extra-condensed', 62.5], ['condensed', 75], ['semi-condensed', 87.5],
    ['normal', 100], ['semi-expanded', 112.5], ['expanded', 125]];
  function stretchKeyword(pct) {
    var best = STRETCH[4];
    STRETCH.forEach(function (s) { if (Math.abs(s[1] - pct) < Math.abs(best[1] - pct)) best = s; });
    return best[0];
  }

  function cargarImagen(src, cors) {
    return new Promise(function (res, rej) {
      var i = new Image();
      if (cors) i.crossOrigin = 'anonymous';
      i.onload = function () { res(i); };
      i.onerror = function () { rej(new Error('No se pudo cargar una imagen')); };
      i.src = src;
    });
  }

  // Firefox necesita ancho y alto explícitos para dibujar un SVG en un canvas
  function svgAImagen(svg, w, h) {
    var s = svg.replace('<svg ', '<svg width="' + w + '" height="' + h + '" ');
    return cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s), false);
  }

  function asegurarEstilo() {
    if (document.getElementById('lu-export-style')) return;
    var st = document.createElement('style');
    st.id = 'lu-export-style';
    st.textContent = '.lu-exporting, .lu-exporting * { transition: none !important; animation: none !important; }';
    document.head.appendChild(st);
  }

  // Escribe el texto de un elemento en su lugar exacto, con el mismo ancho que tiene en pantalla
  function dibujarTexto(ctx, el, ox, oy, sombra) {
    var cs = getComputedStyle(el), b = el.getBoundingClientRect();
    var texto = el.textContent;
    if (!texto) return;
    if (cs.textTransform === 'uppercase') texto = texto.toLocaleUpperCase('es');
    var size = parseFloat(cs.fontSize);
    ctx.save();
    ctx.font = cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
    if ('fontStretch' in ctx) ctx.fontStretch = stretchKeyword(parseFloat(cs.fontStretch) || 100);
    if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    if (sombra) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }

    var w = ctx.measureText(texto).width;
    var m = ctx.measureText('Hg'), A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
    // línea base: igual que el navegador, que reparte el interlineado sobrante arriba y abajo
    var base = (A != null && D != null)
      ? (b.top - oy) + (b.height - (A + D)) / 2 + A
      : (b.top - oy) + b.height * 0.5 + size * 0.35;
    var k = w > 0 ? b.width / w : 1; // igualar el ancho (por si el texto se condensó para entrar)
    ctx.translate(b.left - ox, base);
    ctx.scale(k, 1);
    ctx.fillText(texto, 0, 0);
    ctx.restore();
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Nombre del archivo: título y director técnico, por ejemplo "probable-once-leonardo-ponzio.jpg".
  // Si el DT está oculto o vacío se usa solo el título; sin ninguno de los dos, "formacion-<esquema>".
  LU.nombreArchivo = function (state, ext) {
    var partes = [slug(state.title)];
    if (state.showCoach && state.coach) partes.push(slug(state.coach));
    var base = partes.filter(Boolean).join('-') || ('formacion-' + state.formation);
    return base + '.' + ext;
  };

  /*
    exportImage(state, { formato: 'jpeg' | 'png', escala: 1 | 2 })
    Devuelve { blob, ancho, alto, avisos }.
  */
  LU.exportImage = async function (state, opts) {
    opts = opts || {};
    var formato = opts.formato === 'png' ? 'png' : 'jpeg';
    var escala = opts.escala === 2 ? 2 : 1;
    var avisos = [];
    var W = LU.STAGE.w, H = LU.STAGE.h;

    asegurarEstilo();
    var host = document.createElement('div');
    host.className = 'lu-exporting';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none;';
    document.body.appendChild(host);

    try {
      var r = LU.createRenderer(host, { uid: 'exp' });
      // Que las tipografías estén cargadas (incluidos los acentos y letras raras de los nombres)
      var todo = [state.title, state.coach, state.coachLabel].concat(state.players.map(function (p) { return p.name + p.number; })).join(' ');
      await Promise.all(['900 92px', '800 30px', '500 38px'].map(function (f) {
        return document.fonts && document.fonts.load ? document.fonts.load(f + ' "Archivo Variable"', todo).catch(function () {}) : null;
      }));
      r.update(state, { forceVisible: true });
      await new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); });
      r.update(state, { forceVisible: true }); // repite el ajuste de textos largos con las tipografías ya cargadas

      var card = r.card, hb = host.getBoundingClientRect(), ox = hb.left, oy = hb.top;
      var rel = function (el) { var b = el.getBoundingClientRect(); return { x: b.left - ox, y: b.top - oy, w: b.width, h: b.height }; };
      var cc = getComputedStyle(card);
      var lineas = cc.getPropertyValue('--lines').trim() || '#e6e6e6';
      var transparente = card.dataset.transparent === 'true';

      var canvas = document.createElement('canvas');
      canvas.width = W * escala; canvas.height = H * escala;
      var ctx = canvas.getContext('2d');
      ctx.scale(escala, escala);

      // Fondo. El JPG no tiene transparencia: usa el color de fondo elegido.
      if (formato === 'jpeg') { ctx.fillStyle = LU.color(state.theme.bg, '#ffffff'); ctx.fillRect(0, 0, W, H); }
      else if (!transparente) { ctx.fillStyle = cc.getPropertyValue('--bg').trim() || '#ffffff'; ctx.fillRect(0, 0, W, H); }

      // Cancha
      var pr = rel(card.querySelector('.lu-pitch'));
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.strokeStyle = lineas; ctx.fillStyle = lineas; ctx.lineWidth = 5;
      var punto = function (x, y, rad) { ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); };
      ctx.strokeRect(3, 3, 954, 999);
      ctx.beginPath(); ctx.moveTo(3, 502.5); ctx.lineTo(957, 502.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(480, 502.5, 135, 0, Math.PI * 2); ctx.stroke();
      punto(480, 502.5, 7);
      ctx.strokeRect(200, 3, 560, 200); ctx.strokeRect(345, 3, 270, 72);
      ctx.beginPath(); ctx.arc(480, 140, 96, Math.atan2(63, -72), Math.atan2(63, 72), true); ctx.stroke();
      punto(480, 140, 6);
      ctx.strokeRect(200, 802, 560, 200); ctx.strokeRect(345, 930, 270, 72);
      ctx.beginPath(); ctx.arc(480, 865, 96, Math.atan2(-63, -72), Math.atan2(-63, 72), false); ctx.stroke();
      punto(480, 865, 6);
      ctx.restore();

      // Escudo
      var crestBox = card.querySelector('.lu-crest');
      if (!crestBox.hidden) {
        var cb = rel(crestBox), src = LU.safeImg(state.crest), pintado = false;
        if (src) {
          try {
            var img = await cargarImagen(src, /^https?:/i.test(src)); // por dirección web, solo se puede exportar si el sitio lo permite
            var f = Math.min(cb.w / img.naturalWidth, cb.h / img.naturalHeight);
            var dw = img.naturalWidth * f, dh = img.naturalHeight * f;
            ctx.drawImage(img, cb.x + (cb.w - dw) / 2, cb.y + (cb.h - dh) / 2, dw, dh);
            pintado = true;
          } catch (e) {
            avisos.push('El escudo puesto por dirección web no se pudo incluir (el sitio no lo permite). Sube el archivo del escudo desde Diseño.');
          }
        }
        if (!pintado) {
          var ph = rel(card.querySelector('.lu-crest-ph'));
          var phImg = await svgAImagen(LU.crestPlaceholder(state.kit, 'exp'), 100, 120);
          ctx.drawImage(phImg, ph.x, ph.y, ph.w, ph.h);
        }
      }

      // Título
      var sombra = transparente;
      if (!card.querySelector('.lu-title').hidden) dibujarTexto(ctx, card.querySelector('.lu-title span'), ox, oy, sombra);

      // Jugadores
      var cache = {};
      var players = card.querySelectorAll('.lu-player');
      for (var i = 0; i < players.length; i++) {
        var pl = state.players[i], kit = (i === 0 && !state.gkSame) ? state.gkKit : state.kit;
        var host2 = players[i].querySelector('.lu-shirt-host'), sb = rel(host2);
        var key = JSON.stringify(kit);
        if (!cache[key]) cache[key] = await svgAImagen(LU.jerseySVG(kit, '', 'exp' + i, false), 100, 100);
        ctx.drawImage(cache[key], sb.x, sb.y, sb.w, sb.h);
        if (state.showNumbers && pl.number) {
          var len = String(pl.number).length, fs = len > 2 ? 26 : (len === 2 ? 34 : 40), k = sb.w / 100;
          ctx.save();
          ctx.font = '900 ' + (fs * k) + 'px "Archivo Variable", Arial, sans-serif';
          ctx.fillStyle = LU.color(kit.numberColor, '#1a1a1a');
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(pl.number, sb.x + 50 * k, sb.y + 76 * k);
          ctx.restore();
        }
        dibujarTexto(ctx, players[i].querySelector('.lu-name'), ox, oy, sombra);
      }

      // Director técnico
      var foot = card.querySelector('.lu-foot');
      if (!foot.hidden) {
        dibujarTexto(ctx, foot.querySelector('.lbl'), ox, oy, sombra);
        dibujarTexto(ctx, foot.querySelector('b'), ox, oy, sombra);
      }

      var blob = await new Promise(function (ok, fail) {
        try {
          canvas.toBlob(function (b) { b ? ok(b) : fail(new Error('El navegador no pudo crear la imagen')); },
            formato === 'png' ? 'image/png' : 'image/jpeg', 0.92);
        } catch (e) { fail(e); }
      });
      return { blob: blob, ancho: canvas.width, alto: canvas.height, avisos: avisos };
    } finally {
      host.remove();
    }
  };
})(window);
