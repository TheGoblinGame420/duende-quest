// Resistencia: N bots al azar (Torre, mazmorras, pesca, expediciones,
// duelos, grupos...) contra el world.js real, con reloj controlado y sin red.
// Cuenta las excepciones de tick() y de recibir().
//   node --no-warnings tools/soak_mmo.mjs 30 10     (30 bots, 10 min simulados)
// tools/ no se publica (.assetsignore).
import { MmoWorld } from '../functions/mmo/world.js';
import * as D from '../mmo/js/data.js';
let reloj = 1_800_000_000_000 + 7 * 60 * 1000;
Date.now = () => reloj;
const almacen = new Map();
const state = { storage: { get: async k => almacen.get(k), put: async (k, v) => { almacen.set(k, v); }, delete: async k => almacen.delete(k), setAlarm: async () => {}, getAlarm: async () => null }, blockConcurrencyWhile: f => f() };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: null }) });
class WsFalso { constructor() { this.l = {}; } accept() {} addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send() {} close() {} emitir(t, ev) { for (const f of this.l[t] || []) f(ev); } }
const espera = () => new Promise(r => setImmediate(r));
const mundo = new MmoWorld(state, {});
const errores = [];
const tickReal = mundo.tick.bind(mundo);
const N = +(process.argv[2] || 30), MIN = +(process.argv[3] || 10);
const bots = [];
for (let i = 0; i < N; i++) {
  const ws = new WsFalso();
  mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok: (1000 + i).toString(16).padStart(32, 'a').slice(-32) }, nombre: 'Soak' + i }) });
  for (let k = 0; k < 300 && !s.c; k++) await espera();
  for (let k = 0; k < 300 && !s.c; k++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  const cl = ['guerrero', 'mago', 'sacerdote', 'picaro'][i % 4];
  s.c.clase = cl; s.c.nivel = [5, 12, 25, 40, 60][i % 5]; s.c.oro = 1e6; s.st = mundo.stats(s.c); s.hp = s.st.maxHp; mundo.recursoInicial(s);
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)).catch(e => errores.push('recibir ' + o.t + ': ' + e.message)); };
  bots.push(s);
}
const azar = a => a[Math.floor(Math.random() * a.length)];
const acciones = [
  s => s.mandar({ t: 'mv', x: Math.round(s.x + (Math.random() - .5) * 200), y: D.SUELO, f: 1, a: 1 }),
  s => s.mandar({ t: 'atk', s: Math.floor(Math.random() * 3) }),
  s => s.mandar({ t: 'hab', id: azar(D.HABS.filter(h => h.clase === s.c.clase)).id, tg: 0 }),
  s => { mundo.entrarMapa(s, 'pueblo', 795); return s.mandar({ t: 'torre' }); },
  s => { mundo.entrarMapa(s, 'pueblo', 795); return s.mandar({ t: 'mazmorra', id: azar(Object.keys(D.MAZMORRAS)) }); },
  s => { const p = D.pesqueroDe(s.c.mapa); if (p) { s.x = p.x; } return s.mandar({ t: 'pescar' }); },
  s => s.mandar({ t: 'tirar' }),
  s => s.mandar({ t: 'exped', h: azar([1, 4, 8]), d: azar(['bosque', 'mina', 'lago']) }),
  s => s.mandar({ t: 'exped', recoger: 1 }),
  s => s.mandar({ t: 'portal', i: Math.floor(Math.random() * 3) }),
  s => s.mandar({ t: 'revivir' }),
  s => s.mandar({ t: 'pw', i: Math.floor(Math.random() * 4) }),
  s => s.mandar({ t: 'invitar', p: azar(bots).id }),
  s => s.mandar({ t: 'grupoResp', si: true }),
  s => s.mandar({ t: 'retar', p: azar(bots).id }),
  s => s.mandar({ t: 'retoResp', si: true }),
  s => s.mandar({ t: 'ranking' }),
  s => s.mandar({ t: 'gesto', id: 'saludar' }),
  s => s.mandar({ t: 'inspeccionar', p: azar(bots).id }),
  s => s.mandar({ t: 'recolectar', i: Math.floor(Math.random() * 4) }),
  s => { mundo.entrarMapa(s, azar(Object.keys(D.MAPAS).filter(k => !D.MAPAS[k].instancia)), 600); },
];
const pasos = MIN * 60 * 10;
for (let p = 0; p < pasos; p++) {
  reloj += 100;
  for (const s of bots) if (Math.random() < 0.15) { try { await acciones[Math.floor(Math.random() * acciones.length)](s); } catch (e) { errores.push('accion: ' + e.message); } }
  try { tickReal(); } catch (e) { errores.push('tick: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  if (p % 50 === 0) await espera();
}
const uniq = [...new Set(errores)];
console.log(`bots ${N}, ${MIN} min simulados, errores ${errores.length} (${uniq.length} distintos)`);
for (const e of uniq.slice(0, 15)) console.log(' -', e);
console.log('torres abiertas', Object.values(mundo.mundo).filter(w => w.torre).length, '· instancias', Object.values(mundo.mundo).filter(w => w.inst).length);
process.exit(0);
