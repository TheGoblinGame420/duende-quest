// Carga: muchos jugadores juntos contra el world.js real (reloj simulado, sin
// red). La mayoria del 3D se amontona en el pueblo (el peor caso de fotos3d);
// los del 2D, en el pueblo 2D. Mide lo que tarda cada tick() y los bytes que
// recibe cada jugador. FALLA (codigo 1) si el p99 del tick pasa de 50 ms o si
// un jugador recibe de media mas de 15 KB/s.
//   node --no-warnings tools/carga_mmo.mjs            (200 en 3D + 40 en 2D, 30 s; 240 es el tope de invitados)
//   node --no-warnings tools/carga_mmo.mjs 220 20 60  (3D, 2D, segundos)
// tools/ no se publica (.assetsignore).
import { MmoWorld } from '../functions/mmo/world.js';
import { SPAWN3D } from '../mmo/js/mundo3d.js';
import { SUELO } from '../mmo/js/data.js';

const N3 = +(process.argv[2] || 200), N2 = +(process.argv[3] || 40), SEG = +(process.argv[4] || 30);
const P99_MAX = 50, KBS_MAX = 15;
let reloj = 1_800_000_000_000 + 7 * 60 * 1000;
Date.now = () => reloj;
const almacen = new Map();
const state = { storage: { get: async k => almacen.get(k), put: async (k, v) => { almacen.set(k, v); }, delete: async k => almacen.delete(k), list: async () => new Map(), setAlarm: async () => {}, getAlarm: async () => null }, blockConcurrencyWhile: f => f() };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: null }) });
// WebSocket falso que cuenta los bytes enviados a cada jugador.
class WsCuenta {
  constructor() { this.l = {}; this.bytes = 0; this.medir = false; }
  accept() {} close() {}
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  send(txt) { this.ultimo = txt; if (this.medir) this.bytes += typeof txt === 'string' ? Buffer.byteLength(txt) : (txt.byteLength || 0); }
  emitir(t, ev) { for (const f of this.l[t] || []) f(ev); }
}
const espera = () => new Promise(r => setImmediate(r));
const mundo = new MmoWorld(state, {});
const bots = [];
async function entrar(i, modo) {
  const ws = new WsCuenta();
  mundo.abrir(ws, '10.' + (i >> 8 & 255) + '.' + (i & 255) + '.1');
  const s = [...mundo.sesiones.values()].pop();
  const hola = { t: 'hola', auth: { k: 'inv', tok: (5000 + i).toString(16).padStart(32, 'c').slice(-32) }, nombre: 'Carga' + i };
  if (modo === '3d') hola.modo = '3d';
  if (mundo.altasIp) mundo.altasIp.total = 0;   // sin la prueba de trabajo de las altas en masa (aqui son bots a proposito)
  ws.emitir('message', { data: JSON.stringify(hola) });
  for (let k = 0; k < 300 && !s.c; k++) await espera();
  for (let k = 0; k < 300 && !s.c; k++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  if (!s.c) throw new Error('el bot ' + i + ' no entro: ' + String(ws.ultimo).slice(0, 200));
  s.wsC = ws; s.modo = modo;
  bots.push(s);
  return s;
}
for (let i = 0; i < N3; i++) {
  const s = await entrar(i, '3d');
  // 70 % amontonados en el pueblo (radio 25 m); el resto, repartidos por el mapa.
  const a = Math.random() * Math.PI * 2, r = i % 10 < 7 ? Math.random() * 25 : 40 + Math.random() * 300;
  s.p = { x: SPAWN3D.x + Math.cos(a) * r, z: SPAWN3D.z + Math.sin(a) * r };
  s.rumbo = Math.random() * Math.PI * 2;
}
for (let i = 0; i < N2; i++) {
  const s = await entrar(N3 + i, '2d');
  s.x = 200 + Math.random() * 1400; s.y = SUELO;
}
console.log(`dentro: ${bots.filter(s => s.modo === '3d').length} en 3D, ${bots.filter(s => s.modo === '2d').length} en 2D`);
// Calentamiento (presentaciones pj3 de golpe) sin medir; luego, SEG segundos medidos.
const tiempos = [];
const pasos = 20 + SEG * 10;
for (let p = 0; p < pasos; p++) {
  const medir = p >= 20;
  if (p === 20) for (const s of bots) { s.wsC.medir = true; s.wsC.bytes = 0; }
  reloj += 100;
  // Caminan a 4 m/s (3D) o 200 px/s (2D) y cambian de rumbo de vez en cuando.
  for (const s of bots) {
    if (s.cerrado) continue;
    if (s.modo === '3d') {
      if (Math.random() < 0.05) s.rumbo += (Math.random() - 0.5) * 2;
      s.p.x += Math.cos(s.rumbo) * 0.4; s.p.z += Math.sin(s.rumbo) * 0.4; s.ry = s.rumbo; s.a = 1; s.movT = reloj;
    } else {
      s.x = Math.max(40, Math.min(1900, s.x + (Math.random() < 0.5 ? -20 : 20))); s.a = 1;
    }
  }
  const t0 = performance.now();
  mundo.tick();
  const dt = performance.now() - t0;
  if (medir) tiempos.push(dt);
  if (p % 10 === 0) await espera();
}
tiempos.sort((a, b) => a - b);
const pc = q => tiempos[Math.min(tiempos.length - 1, Math.floor(tiempos.length * q))];
const kbs = bots.filter(s => !s.cerrado).map(s => ({ s, kbs: s.wsC.bytes / 1024 / SEG }));
const media = l => l.reduce((a, x) => a + x.kbs, 0) / Math.max(1, l.length);
const k3 = kbs.filter(x => x.s.modo === '3d'), k2 = kbs.filter(x => x.s.modo === '2d');
const peor = kbs.reduce((m, x) => Math.max(m, x.kbs), 0);
console.log(`tick: p50 ${pc(0.5).toFixed(1)} ms · p95 ${pc(0.95).toFixed(1)} ms · p99 ${pc(0.99).toFixed(1)} ms · max ${tiempos[tiempos.length - 1].toFixed(1)} ms`);
console.log(`bajada por jugador: 3D ${media(k3).toFixed(1)} KB/s · 2D ${media(k2).toFixed(1)} KB/s · el que mas ${peor.toFixed(1)} KB/s`);
const fallos = [];
if (pc(0.99) > P99_MAX) fallos.push(`p99 del tick ${pc(0.99).toFixed(1)} ms > ${P99_MAX} ms`);
if (media(k3) > KBS_MAX) fallos.push(`3D: ${media(k3).toFixed(1)} KB/s por jugador > ${KBS_MAX}`);
if (media(k2) > KBS_MAX) fallos.push(`2D: ${media(k2).toFixed(1)} KB/s por jugador > ${KBS_MAX}`);
if (fallos.length) { console.log('FALLA:\n - ' + fallos.join('\n - ')); process.exit(1); }
console.log('OK');
process.exit(0);
