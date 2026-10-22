// ═══════════════════════════════════════════════════════
// Servidor local de DUENDE QUEST ONLINE para pruebas en el navegador.
//
// `wrangler dev` no puede correr Durable Objects en esta maquina Windows
// ("internal error" incluso con un DO minimo), asi que esto importa el
// world.js REAL, le da un almacenamiento en memoria (guardado en un JSON) y
// hace el handshake de WebSocket a mano, sin librerias. Sirve tambien los
// archivos del sitio, asi que http://localhost:PUERTO/mmo/ es el juego entero.
//
//   node tools/mmo_local.mjs            (puerto 8787)
//   PUERTO=9000 DATOS=/ruta/datos.json node tools/mmo_local.mjs
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MmoWorld } from '../functions/mmo/world.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = +(process.env.PUERTO || process.env.PORT || 8787);
const DATOS = process.env.DATOS || path.join(os.tmpdir(), 'dq_mmo_local.json');

// ── Almacenamiento del Durable Object (en memoria + archivo) ──
const almacen = new Map();
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(DATOS, 'utf8')))) almacen.set(k, v); } catch (e) {}
let guardarT = null;
function persistir() {
  clearTimeout(guardarT);
  guardarT = setTimeout(() => { try { fs.writeFileSync(DATOS, JSON.stringify(Object.fromEntries(almacen))); } catch (e) {} }, 500);
}
const state = {
  storage: {
    get: async k => (almacen.has(k) ? structuredClone(almacen.get(k)) : undefined),
    put: async (k, v) => { almacen.set(k, structuredClone(v)); persistir(); },
    delete: async k => { const r = almacen.delete(k); persistir(); return r; },
    list: async ({ prefix = '' } = {}) => new Map([...almacen].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
  },
  blockConcurrencyWhile: f => f(),
};
const mundo = new MmoWorld(state, {});

// ── WebSocket a mano (RFC 6455) con la forma que espera world.js ──
class WsLocal {
  constructor(sock) {
    this.sock = sock; this.l = { message: [], close: [], error: [] }; this.buf = Buffer.alloc(0); this.cerrado = false;
    sock.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.leer(); });
    sock.on('close', () => this.fin());
    sock.on('error', () => this.fin());
  }
  accept() {}
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  emitir(t, ev) { for (const f of this.l[t] || []) try { f(ev); } catch (e) { console.error(e); } }
  fin() { if (this.cerrado) return; this.cerrado = true; this.emitir('close', {}); }
  leer() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const op = b0 & 15, mask = b1 & 128;
      let len = b1 & 127, i = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); i = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); i = 10; }
      const k = mask ? this.buf.subarray(i, i + 4) : null;
      if (mask) i += 4;
      if (this.buf.length < i + len) return;
      const datos = Buffer.from(this.buf.subarray(i, i + len));
      if (k) for (let j = 0; j < datos.length; j++) datos[j] ^= k[j & 3];
      this.buf = this.buf.subarray(i + len);
      if (op === 1) this.emitir('message', { data: datos.toString('utf8') });
      else if (op === 8) { this.marco(8, Buffer.alloc(0)); this.sock.end(); this.fin(); }
      else if (op === 9) this.marco(10, datos);
    }
  }
  marco(op, datos) {
    if (this.sock.destroyed) return;
    const n = datos.length;
    const cab = n < 126 ? Buffer.from([128 | op, n]) : n < 65536 ? Buffer.from([128 | op, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 128 | op; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
    this.sock.write(Buffer.concat([cab, datos]));
  }
  send(txt) { if (!this.cerrado) this.marco(1, Buffer.from(String(txt), 'utf8')); }
  close(code) { if (this.cerrado) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); this.marco(8, b); setTimeout(() => this.sock.end(), 20); this.fin(); }
}

// ── Archivos ──
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/mmo/ws') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, online: mundo.contarOnline() })); return; }
  // Solo en este servidor local: ejecutar codigo sobre el mundo para preparar
  // pruebas (subir de nivel, dar oro, poner monstruos...). `jug(nombre)`
  // devuelve la sesion de un jugador conectado.
  if (p === '/__dev') {
    const js = new URL(req.url, 'http://x').searchParams.get('js') || '';
    let r;
    try {
      const jug = n => [...mundo.sesiones.values()].find(s => s.c && s.c.nombre === n);
      r = { ok: true, v: new Function('mundo', 'jug', 'return (' + js + ')')(mundo, jug) };
    } catch (e) { r = { ok: false, e: String(e && e.stack || e) }; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let txt; try { txt = JSON.stringify(r); } catch (e) { txt = JSON.stringify({ ok: true, v: String(r.v) }); }
    res.end(txt);
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || /[\\/](\.git|functions|recursos|tools|sql)[\\/]/.test(f.slice(RAIZ.length))) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(d);
  });
});
srv.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/mmo/ws') { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);
  mundo.abrir(new WsLocal(sock));
});
srv.listen(PUERTO, () => console.log(`DUENDE QUEST ONLINE local: http://localhost:${PUERTO}/mmo/  (datos en ${DATOS})`));
