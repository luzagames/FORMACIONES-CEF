#!/usr/bin/env node
/* Servidor local opcional (sin dependencias, solo Node 16 o superior).
   Sirve el panel y el overlay por http://localhost y retransmite los mensajes
   entre ambos. Guarda la última alineación en estado.json.

   Uso:   node server.js            (puerto 4455)
          PORT=5000 node server.js   (otro puerto)
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 4455;
const HOST = '127.0.0.1'; // solo esta computadora
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, 'estado.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'
};
const PUBLIC_DIRS = ['/js/', '/css/', '/fonts/'];
const PUBLIC_FILES = ['/panel.html', '/overlay.html'];

let last = null; // último estado enviado por el panel (con "visible" real)
try { last = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { last = null; }

const clients = new Set();
let saveTimer = null;

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!last) return;
    // En disco nunca queda "en pantalla": al reiniciar todo arranca oculto
    const copy = Object.assign({}, last, { visible: false });
    fs.writeFile(STATE_FILE, JSON.stringify(copy), () => {});
  }, 500);
}

function broadcast(env) {
  const data = 'data: ' + JSON.stringify(env) + '\n\n';
  for (const res of clients) res.write(data);
}

function readBody(req, limit, cb) {
  let size = 0; const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => cb(Buffer.concat(chunks).toString('utf8')));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }

  if (p === '/api/last') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(last));
  }

  if (p === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    res.write('retry: 1500\n\n');
    clients.add(res);
    const ka = setInterval(() => res.write(': ka\n\n'), 20000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  if (p === '/api/msg' && req.method === 'POST') {
    return readBody(req, 8 * 1024 * 1024, (body) => {
      try {
        const env = JSON.parse(body);
        if (env && env.msg && typeof env.msg.type === 'string') {
          if (env.msg.type === 'state' && env.msg.state) { last = env.msg.state; saveSoon(); }
          broadcast(env);
        }
        res.writeHead(204); res.end();
      } catch (e) { res.writeHead(400); res.end(); }
    });
  }

  // Archivos estáticos (solo los del proyecto que hacen falta)
  let file = p === '/' ? '/panel.html' : p;
  const allowed = PUBLIC_FILES.includes(file) || PUBLIC_DIRS.some((d) => file.startsWith(d));
  const full = path.join(ROOT, file);
  if (!allowed || !full.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('No encontrado'); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n  Alineaciones para OBS');
  console.log('  Panel   (Custom Browser Dock):  http://localhost:' + PORT + '/panel.html');
  console.log('  Overlay (Fuente de navegador):  http://localhost:' + PORT + '/overlay.html');
  console.log('  Tamaño recomendado del overlay: 1080 x 1350\n');
});
