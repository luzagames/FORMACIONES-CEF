/* Relay de alineaciones: Cloudflare Worker + Durable Object.

   Rutas:
     GET  /sala/<codigo>?rol=panel|overlay   WebSocket: reenvía los mensajes a los demás de la sala
     GET  /sala/<codigo>/ultimo              última alineación guardada (JSON, o null)

   El código de sala hace de contraseña: usa uno largo y aleatorio (el panel genera uno de 12). */
import { DurableObject } from "cloudflare:workers";

const CODIGO = /^[A-Za-z0-9_-]{8,64}$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

function origenPermitido(request, env) {
  if (!env.ORIGENES) return true;
  const lista = String(env.ORIGENES).split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const origen = request.headers.get("Origin");
  return !!origen && lista.includes(origen);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const m = url.pathname.match(/^\/sala\/([^/]+)(\/ultimo)?$/);
    if (!m) return new Response("Relay de alineaciones", { status: 200, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
    if (!CODIGO.test(m[1])) return new Response("Código de sala no válido (8 a 64 letras, números, - o _)", { status: 400, headers: CORS });
    if (!origenPermitido(request, env)) return new Response("Origen no permitido", { status: 403, headers: CORS });

    const stub = env.SALA.get(env.SALA.idFromName(m[1]));
    const resp = await stub.fetch(request);
    if (resp.status === 101) return resp; // WebSocket: no se tocan los encabezados
    const headers = new Headers(resp.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(resp.body, { status: resp.status, headers });
  },
};

export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Los "ping" de los clientes se contestan solos, sin despertar el objeto (no consumen cuota).
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.ctx.blockConcurrencyWhile(async () => {
      this.last = (await this.ctx.storage.get("last")) || null;
      // Si nadie está conectado (objeto recién creado), nunca se recupera una alineación "en pantalla" vieja.
      if (this.last && this.ctx.getWebSockets().length === 0) this.last = { ...this.last, visible: false };
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const rol = url.searchParams.get("rol") === "overlay" ? "overlay" : "panel";
      const pair = new WebSocketPair();
      const [cliente, servidor] = Object.values(pair);
      this.ctx.acceptWebSocket(servidor, [rol]);
      this.avisarPresencia(null);
      return new Response(null, { status: 101, webSocket: cliente });
    }

    if (url.pathname.endsWith("/ultimo")) {
      return new Response(JSON.stringify(this.last || null), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return new Response("No encontrado", { status: 404 });
  }

  async webSocketMessage(ws, mensaje) {
    if (typeof mensaje !== "string") return;
    let msg;
    try { msg = JSON.parse(mensaje); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "state" && msg.state && typeof msg.state === "object") {
      this.last = msg.state;
      // Se guarda como máximo cada 2 segundos, aunque se esté arrastrando un jugador
      if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 2000);
    }
    for (const otro of this.ctx.getWebSockets()) {
      if (otro !== ws) { try { otro.send(mensaje); } catch { /* conexión caída */ } }
    }
  }

  async alarm() {
    if (!this.last) return;
    const texto = JSON.stringify(this.last);
    if (texto.length < 1900000) await this.ctx.storage.put("last", this.last); // límite de 2 MB por valor
  }

  async webSocketClose(ws, codigo, motivo) {
    try { ws.close(codigo, motivo); } catch { /* ya cerrada */ }
    this.avisarPresencia(ws);
  }

  async webSocketError(ws) {
    this.avisarPresencia(ws);
  }

  // Le dice a los paneles cuántos overlays hay conectados (sin latidos: solo cuando alguien entra o sale)
  avisarPresencia(excluir) {
    const overlays = this.ctx.getWebSockets("overlay").filter((w) => w !== excluir).length;
    const texto = JSON.stringify({ type: "relay-presence", overlays });
    for (const p of this.ctx.getWebSockets("panel")) {
      if (p !== excluir) { try { p.send(texto); } catch { /* conexión caída */ } }
    }
  }
}
