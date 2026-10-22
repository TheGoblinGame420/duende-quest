// ═══════════════════════════════════════════════════════
// ¿Puede un jugador SOLO con el jefe de su mision? (world.js real, reloj
// simulado). Para cada jefe de zona, a su nivel y a 2 por debajo, con cada
// clase: pega, usa sus habilidades y bebe pociones como lo haria alguien
// normal. Esquivar la embestida avisada no se simula (el bot no salta), asi
// que el resultado es pesimista.
//   node --no-warnings tools/sim_jefe_solo.mjs
// ═══════════════════════════════════════════════════════
import { MmoWorld } from '../functions/mmo/world.js';
import { MONSTRUOS, MAPAS, habsDe, CLASES } from '../mmo/js/data.js';

let reloj = 1_800_000_000_000 + 7 * 60 * 1000;
Date.now = () => reloj;
const almacen = new Map();
const state = { storage: { get: async k => structuredClone(almacen.get(k)), put: async (k, v) => { almacen.set(k, structuredClone(v)); }, delete: async k => almacen.delete(k), list: async () => new Map() }, blockConcurrencyWhile: f => f() };
const mundo = new MmoWorld(state, {});
class WsF { constructor() { this.l = {}; } accept() {} addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send() {} close() {} emitir(t, e) { for (const f of this.l[t] || []) f(e); } }
const espera = () => new Promise(r => setImmediate(r));
let nTok = 0;
async function entrar(nombre) {
  const ws = new WsF(); mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  const tok = (++nTok).toString(16).padStart(32, 'b');
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok }, nombre }) });
  for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 5));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  return s;
}
const zonas = Object.keys(MAPAS).filter(k => MAPAS[k].jefe);
const filas = [];
for (const z of zonas.slice(0, +(process.argv[2] || 4))) {
  const k = MAPAS[z].jefe, nv = MONSTRUOS[k].nivel;
  for (const L of (process.argv[3] ? process.argv[3].split(',').map(d => nv - +d) : [nv - 2, nv])) for (const clase of Object.keys(CLASES)) {
    const s = await entrar('S' + clase.slice(0, 3) + L + z.slice(0, 3));
    await s.mandar({ t: 'clase', id: clase });
    s.c.nivel = L; s.st = mundo.stats(s.c); s.hp = s.st.maxHp; mundo.recursoInicial(s);
    s.c.pw.pocion = 5;
    mundo.entrarMapa(s, z, 600);
    const w = mundo.mundoDe(s); w.mons.clear(); w.spawnEn = Infinity; w.jefeEn = 0;
    const j = mundo.crearMonstruo(z, k, 900);
    const habs = habsDe(clase).filter(h => h.nv <= L);
    let t = 0;
    const lejos = CLASES[clase].basico === 'vara';
    while (!s.muerto && !j.muere && t < 180000) {
      s.x = j.x + (lejos ? -260 : -50); s.f = 1; s.snapHasta = 0;
      if (s.hp < s.st.maxHp * 0.35 && s.c.pw.pocion > 0) await s.mandar({ t: 'pw', i: 0 });
      for (const h of habs) {
        if (h.obj === 'aliado' || h.obj === 'muerto') { if (s.hp < s.st.maxHp * 0.6) await s.mandar({ t: 'hab', id: h.id, tg: s.id, tk: 'p' }); continue; }
        await s.mandar({ t: 'hab', id: h.id, tg: j.id });
      }
      await s.mandar({ t: 'atk', s: (t / 400 | 0) % 3, tg: j.id });
      reloj += 100; mundo.tick(); t += 100;
      if (t % 1000 === 0) await espera();
    }
    filas.push({ jefe: k, nvJefe: nv, clase, nv: L, gana: j.muere ? 'SÍ' : 'no', seg: Math.round(t / 1000), vidaJefe: Math.round(j.hp) + '/' + j.max, pociones: 5 - s.c.pw.pocion });
    await mundo.cerrar(s);
  }
}
console.table(filas);
process.exit(0);
