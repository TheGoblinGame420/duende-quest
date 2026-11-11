// ═══════════════════════════════════════════════════════
// Equilibrio del combate de ORIGINS (3D) tras los arquetipos y los remates
// (mmo/js/combate3d.js): ¿cuánto cambian el tiempo para matar y el daño
// recibido contra presas normales de tu nivel? Usa el world.js REAL con reloj
// simulado. La columna «base» apaga lo nuevo (sin arquetipos ni remates: así
// peleaban antes); «nuevo» lo deja encendido. Mismas semillas en las dos.
//
// El bot pega con el básico y lanza sus habilidades de daño en cuanto puede.
// «maña» es la probabilidad de que reaccione bien a lo nuevo: salir de la
// forma roja a tiempo e ir a cortar al curandero (0 = nunca, 1 = siempre).
//
//   node --no-warnings tools/sim_combate3d.mjs [repeticiones=10]
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { MmoWorld } from '../functions/mmo/world.js';
import { MONSTRUOS, MAPAS, habsDe, CLASES } from '../mmo/js/data.js';
import { campamentos } from '../mmo/js/mundo3d.js';
import { ARQUETIPOS, ARQ_NIVEL_MIN, dentroForma } from '../mmo/js/combate3d.js';

const REP = +(process.argv[2] || 10);
let reloj = 1_800_000_000_000 + 7 * 60 * 1000;
Date.now = () => reloj;
// Azar con semilla: las dos columnas ven los mismos dados.
let semilla = 1;
const azarReal = Math.random;
Math.random = () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const log = console.log; console.log = () => {};   // el mundo avisa cosas del cron: aquí no interesan

const almacen = new Map();
const state = { storage: { get: async k => structuredClone(almacen.get(k)), put: async (k, v) => { almacen.set(k, structuredClone(v)); }, delete: async k => almacen.delete(k), list: async () => new Map() }, blockConcurrencyWhile: f => f() };
const mundo = new MmoWorld(state, {});
mundo.asedioAuto = false;
class WsF { constructor() { this.l = {}; } accept() {} addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send() {} close() {} emitir(t, e) { for (const f of this.l[t] || []) f(e); } }
let nTok = 0;
async function entrar3d(nombre) {
  const ws = new WsF(); mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  const tok = (++nTok).toString(16).padStart(32, 'c');
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok }, nombre, modo: '3d' }) });
  for (let i = 0; i < 600 && !s.c; i++) await new Promise(r => setTimeout(r, 5));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  return s;
}

const arqReal = mundo.arq3d.bind(mundo), remReal = mundo.remate3d.bind(mundo);
function modo(base) {
  mundo.arq3d = base ? (() => null) : arqReal;
  mundo.remate3d = base ? (() => 1) : remReal;
}
const campo = campamentos(MAPAS, MONSTRUOS).find(c => c.zona === 'amanecer' && !c.jefe);
const B = { x: campo.x + 40, z: campo.z };
const VEL = 0.6;   // m por tick (6 m/s, lo que corre el duende)

// Una pelea: n presas de la especie k contra un jugador de su nivel. Devuelve [segundos, daño recibido / vida máxima].
async function pelea(s, k, n, mana, sem) {
  semilla = sem;
  const W = mundo.iniciar3d();
  for (const o of [...W.mons.values()]) if (o.campo === 9001) W.mons.delete(o.id);
  const nv = MONSTRUOS[k].nivel, clase = s.c.clase;
  s.c.nivel = nv; s.st = mundo.stats(s.c); s.hp = s.st.maxHp; s.muerto = false; s.au = {}; mundo.recursoInicial(s);
  s.cdHab = {}; s.gcdHasta = 0; s.atkT = 0; s.cast = null; s.inv = 0; s.escudo = 0; s.combo = 0; s.h = 0;
  const lejos = CLASES[clase].basico === 'vara';
  s.p = { x: B.x, z: B.z }; s.movBud = undefined;
  const vivos = new Set();
  const os = [];
  for (let i = 0; i < n; i++) {
    const o = mundo.crear3d({ id: 9001, x: B.x, z: B.z, k, n, jefe: false, vivos, zona: 'amanecer' });
    const a = i * 2.1, d0 = lejos ? 14 : 3;
    o.x = B.x + d0 + Math.cos(a) * (i ? 2 : 0); o.z = B.z + Math.sin(a) * (i ? 2 : 0); o.hx = B.x + d0; o.hz = B.z; o.noct = 0; o.paseo = reloj + 1e9; o.destino = null;
    os.push(o);
  }
  const habs = habsDe(clase).filter(h => h.nv <= nv && h.obj === 'enemigo' && h.id !== 'polimorfia' && h.id !== 'provocar');
  const area = habsDe(clase).filter(h => h.nv <= nv && (h.obj === 'area' || h.radio) && h.obj !== 'aliado' && h.mult);
  let t = 0, dano = 0;
  const decidido = new Map();   // especial o cantico ya visto -> ¿reacciona bien?
  while (os.some(o => !o.muere) && t < 180000) {
    let tg = os.find(o => !o.muere);
    // Curandero cantando: con maña, va por él.
    for (const o of os) if (!o.muere && o.cura3) {
      if (!decidido.has(o.cura3)) decidido.set(o.cura3, Math.random() < mana);
      if (decidido.get(o.cura3)) tg = o;
    }
    // Forma roja en el suelo: con maña, sale de ella.
    let huye = null;
    for (const o of os) if (!o.muere && o.tel && dentroForma(o.tel, s.p.x, s.p.z)) {
      if (!decidido.has(o.tel)) decidido.set(o.tel, Math.random() < mana);
      if (decidido.get(o.tel)) huye = o.tel;
    }
    let dx = 0, dz = 0;
    if (huye) {
      if (huye.f === 'l') { const sx = Math.sin(huye.ry), sz = Math.cos(huye.ry); const lado = ((s.p.x - huye.x) * sz - (s.p.z - huye.z) * sx) >= 0 ? 1 : -1; dx = sz * lado; dz = -sx * lado; }
      else { dx = s.p.x - huye.x; dz = s.p.z - huye.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; }
    } else {
      const d = Math.hypot(tg.x - s.p.x, tg.z - s.p.z), quiero = lejos ? 20 : 2.4;
      if (d > quiero) { dx = (tg.x - s.p.x) / d; dz = (tg.z - s.p.z) / d; const paso = Math.min(VEL, d - quiero + 0.2); dx *= paso / VEL; dz *= paso / VEL; }
    }
    const semueve = Math.hypot(dx, dz) > 0.05;
    if (semueve && !(s.cast && !huye)) { s.p = { x: s.p.x + dx * VEL, z: s.p.z + dz * VEL }; if (s.cast) mundo.cancelarCast && mundo.cancelarCast(s, 'Te moviste.'); }
    for (const h of habs) await s.mandar({ t: 'hab3', id: h.id, tg: tg.id });
    if (n > 1) for (const h of area) await s.mandar({ t: 'hab3', id: h.id });
    await s.mandar({ t: 'atk3', tg: tg.id });
    const hp0 = s.hp = s.st.maxHp; s.muerto = false;
    if (t % 5000 === 0) for (const c in jug) jug[c].actT = reloj;   // los que esperan su turno no caen por inactividad
    reloj += 100; mundo.tick(); t += 100;
    if (s.hp < hp0) dano += hp0 - s.hp;
    if (t % 2000 === 0) await new Promise(r => setImmediate(r));
  }
  if (t >= 180000 && process.env.DEPURA) { const o = os.find(x => !x.muere); log('ATASCO', k, n, s.c.clase, 'nv', s.c.nivel, JSON.stringify({ p: s.p, muerto: s.muerto, cerrado: s.cerrado, m3: s.m3, i3: s.i3, h: s.h, cast: s.cast, rec: s.rec, atkT: s.atkT - reloj, au: s.au, montado: s.montado, o: o && { x: o.x, z: o.z, hp: o.hp, max: o.max, vuelve: o.vuelve, obj: o.obj, hx: o.hx, hz: o.hz, st: o.st, tel: o.tel, cura3: o.cura3, dormido: o.dormido } })); process.exit(1); }
  for (const o of os) W.mons.delete(o.id);
  return [t / 1000, dano / s.st.maxHp];
}

const especies = Object.keys(MONSTRUOS).filter(k => !MONSTRUOS[k].jefe && !MONSTRUOS[k].mazmorra && MONSTRUOS[k].nivel >= ARQ_NIVEL_MIN && MONSTRUOS[k].nivel <= 60 && MAPAS && Object.values(MAPAS).some(m => (m.monstruos || []).includes(k)));
const clases = Object.keys(CLASES);
const jug = {};
for (const c of clases) { const s = await entrar3d('Sim' + c); await s.mandar({ t: 'clase', id: c }); jug[c] = s; }

const MANAS = [0, 0.5, 1];
const acum = {};   // clave -> { tb, tn, db, dn, k }
const suma = (clave, tb, tn, db, dn) => { const a = acum[clave] || (acum[clave] = { tb: 0, tn: 0, db: 0, dn: 0, k: 0 }); a.tb += tb; a.tn += tn; a.db += db; a.dn += dn; a.k++; };
let sem = 1000;
for (const k of especies) {
  const arq = ARQUETIPOS[k] || 'perseguidor';
  for (const n of [1, 3]) for (const c of clases) for (let r = 0; r < REP; r++) {
    sem += 7;
    modo(true); const [tb, db] = await pelea(jug[c], k, n, 0, sem);
    for (const mana of MANAS) {
      modo(false); const [tn, dn] = await pelea(jug[c], k, n, mana, sem);
      suma(`${arq}|${n}|${mana}`, tb, tn, db, dn);
      suma(`TODAS|${n}|${mana}`, tb, tn, db, dn);
      suma(`TODAS|1 y 3|${mana}`, tb, tn, db, dn);
    }
  }
}
console.log = log;
const pct = (a, b) => (b ? ((a / b - 1) * 100) : 0).toFixed(1) + ' %';
const filas = Object.entries(acum).map(([clave, a]) => {
  const [arq, n, mana] = clave.split('|');
  return { arquetipo: arq, presas: n, 'maña': mana, peleas: a.k, 'seg base': (a.tb / a.k).toFixed(1), 'seg nuevo': (a.tn / a.k).toFixed(1), 'Δ tiempo': pct(a.tn, a.tb), 'daño base (vidas)': (a.db / a.k).toFixed(2), 'daño nuevo': (a.dn / a.k).toFixed(2), 'Δ daño': pct(a.dn, a.db) };
}).sort((x, y) => (x.arquetipo === 'TODAS') - (y.arquetipo === 'TODAS') || x.arquetipo.localeCompare(y.arquetipo) || String(x.presas).localeCompare(String(y.presas)) || x['maña'] - y['maña']);
console.log(`Especies de campamento Nv ${ARQ_NIVEL_MIN}+: ${especies.length} (${especies.filter(k => ARQUETIPOS[k]).length} con arquetipo). ${REP} repeticiones por especie, clase y tamaño de grupo.`);
console.table(filas);
Math.random = azarReal;
process.exit(0);
