// ═══════════════════════════════════════════════════════
// Simulacion de combates contra los jefes de mazmorra con bots de cada
// clase, sobre el world.js REAL (reloj controlado, sin red). Sirve para
// equilibrar: cuanto tarda cada jefe, cuantas veces se muere y cuantas
// pociones se gastan, solo y en grupo.
//
//   node tools/sim_mazmorra.mjs                 (todo)
//   node tools/sim_mazmorra.mjs catacumbas 20   (una mazmorra a un nivel)
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { MmoWorld } from '../functions/mmo/world.js';
import { MAZMORRAS, MONSTRUOS, HABS, costoHab, FIS, SUELO } from '../mmo/js/data.js';

let reloj = 1_800_000_000_000 + 7 * 60 * 1000;
Date.now = () => reloj;
const almacen = new Map();
const state = { storage: { get: async k => almacen.get(k), put: async (k, v) => { almacen.set(k, v); }, delete: async k => almacen.delete(k) }, blockConcurrencyWhile: f => f() };

class WsFalso { constructor() { this.l = {}; } accept() {} addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send() {} close() {} emitir(t, ev) { for (const f of this.l[t] || []) f(ev); } }
const espera = () => new Promise(r => setImmediate(r));
let sig = 1;
async function bot(mundo, clase, nivel) {
  const ws = new WsFalso();
  mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  const tok = (sig++).toString(16).padStart(32, '0').slice(-32);
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok }, nombre: 'Bot' + clase + sig }) });
  for (let i = 0; i < 300 && !s.c; i++) await espera();
  // Con la maquina cargada el SHA-256 tarda mas: se espera por tiempo real.
  for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.c.clase = clase; s.c.nivel = nivel; s.c.pw = { pocion: 10, escudo: 0, rayo: 0, fuego: 0 };
  s.st = mundo.stats(s.c); s.hp = s.st.maxHp; mundo.recursoInicial(s);
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  s.bot = { pociones: 0, muertes: 0, atkT: 0 };
  return s;
}

// Un paso de decision de un bot (cada 100 ms).
function decidir(mundo, s, jefe, w) {
  if (s.muerto) return;
  const ahora = Date.now();
  // 1) Salir de las zonas que estan por estallar.
  // Zonas doradas (banda): se aguantan juntos, hay que entrar.
  const zj = w.zonas.find(z => !z.hecho && z.junta);
  if (zj && (s.x < zj.x0 + 25 || s.x > zj.x1 - 25)) {
    const meta = (zj.x0 + zj.x1) / 2;
    const paso = Math.sign(meta - s.x) * Math.min(Math.abs(meta - s.x), FIS.vel * 6);
    s.movT = ahora - 100;
    s.mandar({ t: 'mv', x: Math.round(s.x + paso), y: SUELO, f: paso > 0 ? 1 : -1, a: 1 });
    return;
  }
  const z = w.zonas.find(z => !z.hecho && !z.junta && s.x > z.x0 - 30 && s.x < z.x1 + 30);
  if (z) {
    const izq = z.x0 - 40, der = z.x1 + 40;
    const meta = Math.abs(s.x - izq) < Math.abs(s.x - der) ? izq : der;
    const paso = Math.sign(meta - s.x) * Math.min(Math.abs(meta - s.x), FIS.vel * 6);
    s.movT = ahora - 100;
    s.mandar({ t: 'mv', x: Math.round(s.x + paso), y: SUELO, f: paso > 0 ? 1 : -1, a: 1 });
    return;
  }
  // 2) Pocion si hace falta.
  if (s.hp < s.st.maxHp * 0.4 && (s.c.pw.pocion || 0) > 0 && ahora >= (s.cdPw.pocion || 0) && !mundo.aura(s, 'aturdido')) { s.mandar({ t: 'pw', i: 0 }); s.bot.pociones++; }
  if (s.cast) return;
  // Objetivo: un esbirro vivo (si hay) o el jefe.
  const esb = [...w.mons.values()].find(o => !o.muere && o.esbirroDe === jefe.id);
  const o = esb || jefe;
  const dist = Math.abs(o.x - s.x);
  const rango = ['mago', 'sacerdote'].includes(s.c.clase) ? 260 : 40;
  // Acercarse / alejarse.
  if (dist > rango + o.w / 2 + 10 || dist < (rango > 100 ? 150 : 0)) {
    const meta = o.x + (s.x < o.x ? -1 : 1) * (rango + o.w / 2);
    const paso = Math.sign(meta - s.x) * Math.min(Math.abs(meta - s.x), FIS.vel * 6);
    if (Math.abs(paso) > 2) { s.movT = ahora - 100; s.mandar({ t: 'mv', x: Math.round(s.x + paso), y: SUELO, f: o.x > s.x ? 1 : -1, a: 1 }); }
  }
  s.f = o.x > s.x ? 1 : -1;
  const usar = id => {
    const h = HABS.find(x => x.id === id);
    if (!h || s.c.nivel < h.nv || ahora < (s.cdHab[id] || 0) || s.rec < costoHab(h, s.st.recMax)) return false;
    if (h.gcd !== false && ahora < s.gcdHasta) return false;
    s.mandar({ t: 'hab', id, tg: h.obj === 'enemigo' ? o.id : h.obj === 'aliado' ? s.bot.cura || 0 : 0 });
    return true;
  };
  const yo = s.c.clase;
  if (yo === 'guerrero') {
    if (s.hp < s.st.maxHp * 0.35) usar('muro');
    if (jefe.cast && jefe.cast.int) usar('zurrar') || (dist > 70 && usar('carga'));
    if (o.hp / o.max < 0.25) usar('ejecutar');
    if (esb) usar('torbellino');
    usar('golpe_heroico') || usar('grito');
  } else if (yo === 'picaro') {
    if (jefe.cast && jefe.cast.int) usar('patada');
    if (s.hp < s.st.maxHp * 0.45) usar('evasion');
    if (s.combo >= 5) usar('eviscerar'); else if (esb) usar('abanico') || usar('siniestro'); else usar('siniestro');
  } else if (yo === 'mago') {
    if (jefe.cast && jefe.cast.int) usar('contrahechizo');
    if (s.hp < s.st.maxHp * 0.2) usar('bloque');
    if (s.rec < s.st.recMax * 0.15) usar('evocacion');
    if (dist < 120) usar('nova');
    usar('misiles') || (esb && usar('meteoros')) || usar('bola_fuego');
  } else if (yo === 'sacerdote') {
    if (jefe.cast && jefe.cast.int) usar('silencio');
    const herido = s.bot.grupo ? s.bot.grupo.filter(x => !x.muerto).sort((a, b) => a.hp / a.st.maxHp - b.hp / b.st.maxHp)[0] : s;
    s.bot.cura = herido && herido !== s ? herido.id : 0;
    if (herido && herido.hp < herido.st.maxHp * 0.85 && !mundo.aura(herido, 'escudoPoder') && !mundo.aura(herido, 'almaDebil')) { if (usar('escudo_poder')) return; }
    if (herido && herido.hp < herido.st.maxHp * 0.6) { if (usar('sanar')) return; }
    if (herido && herido.hp < herido.st.maxHp * 0.9 && !mundo.aura(herido, 'renovar')) { if (usar('renovar')) return; }
    s.bot.cura = 0;
    if (!mundo.auraMon(o, 'dolor')) { if (usar('dolor')) return; }
    usar('castigo');
  }
  // Ataque basico cuando se puede.
  if (ahora - s.bot.atkT > 340) { s.bot.atkT = ahora; s.mandar({ t: 'atk', s: (s.bot.paso = ((s.bot.paso || 0) + 1) % 3), tg: o.id }); }
}

async function pelea(idMaz, nivel, clases, iJefe) {
  const mundo = new MmoWorld(state, {});
  const bots = [];
  for (const cl of clases) bots.push(await bot(mundo, cl, nivel));
  for (const b of bots) b.bot.grupo = bots;
  const mz = MAZMORRAS[idMaz];
  const w = mundo.crearInstancia(idMaz, nivel, bots.length);
  for (const b of bots) mundo.unirAInstancia(b, w);
  for (const o of [...w.mons.values()]) if (!o.jefe) w.mons.delete(o.id);
  const jefe = [...w.mons.values()].find(o => o.k === mz.jefes[iJefe].k);
  for (const o of [...w.mons.values()]) if (o !== jefe) w.mons.delete(o.id);
  w.muros = [];
  bots.forEach((b, i) => { b.x = jefe.x - 200 - i * 30; });
  const t0 = Date.now();
  let muertes = 0;
  while (!jefe.muere && Date.now() - t0 < 240000) {
    reloj += 100;
    for (const b of bots) {
      if (b.muerto) { muertes++; b.bot.muertes++; await b.mandar({ t: 'revivir' }); b.x = jefe.casaX - 500; continue; }
      decidir(mundo, b, jefe, w);
    }
    mundo.tick();
  }
  const seg = Math.round((Date.now() - t0) / 1000);
  for (const b of bots) mundo.cerrar(b);
  return { seg, gana: jefe.muere, muertes, pociones: bots.reduce((a, b) => a + b.bot.pociones, 0) };
}

// Recorrido completo: los bots avanzan pack a pack y jefe a jefe.
async function completa(idMaz, nivel, clases, k = 0) {
  const mundo = new MmoWorld(state, {});
  const bots = [];
  for (const cl of clases) bots.push(await bot(mundo, cl, nivel));
  for (const b of bots) { b.bot.grupo = bots; b.c.pw.pocion = 20; }
  const w = mundo.crearInstancia(idMaz, nivel, bots.length, k);
  for (const b of bots) mundo.unirAInstancia(b, w);
  const t0 = Date.now();
  let muertes = 0;
  while (!w.inst.completada && Date.now() - t0 < 20 * 60000) {
    reloj += 100;
    const tope = mundo.topeMuros(bots[0]);
    const vivos = [...w.mons.values()].filter(o => !o.muere && o.x < tope + 400).sort((a, b) => a.x - b.x);
    const blanco = vivos[0];
    for (const b of bots) {
      if (b.muerto) { muertes++; await b.mandar({ t: 'revivir' }); continue; }
      if (blanco) decidir(mundo, b, blanco.esbirroDe ? w.mons.get(blanco.esbirroDe) || blanco : blanco, w);
    }
    mundo.tick();
  }
  const seg = Math.round((Date.now() - t0) / 1000);
  const pociones = bots.reduce((a, b) => a + b.bot.pociones, 0);
  for (const b of bots) mundo.cerrar(b);
  return { seg, gana: w.inst.completada, muertes, pociones, jefes: w.inst.hechos };
}

const [, , soloMaz, soloNivel, modo] = process.argv;
// Desafios (Nv 60, sin equipo: pesimista):  node tools/sim_mazmorra.mjs ciudadela 0,3,6,10 desafio
if (modo === 'desafio') {
  for (const k of String(soloNivel || '0,3,6,10').split(',').map(Number)) {
    for (const comp of [['guerrero'], ['mago'], ['guerrero', 'sacerdote', 'mago']]) {
      const r = await completa(soloMaz || 'ciudadela', 60, comp, k);
      console.log(`${(soloMaz || 'ciudadela').padEnd(10)} +${String(k).padEnd(3)} ${comp.join('+').padEnd(26)} ${r.gana ? '✓ completada' : '✗ jefes ' + r.jefes + '/3'} en ${Math.floor(r.seg / 60)}m${String(r.seg % 60).padStart(2, '0')}s · muertes ${r.muertes} · pociones ${r.pociones}`);
    }
  }
  process.exit(0);
}
// Banda (Nv 60): node tools/sim_mazmorra.mjs santuario 60 banda
if (modo === 'banda') {
  const id = soloMaz || 'santuario';
  const comps = [['guerrero'], ['mago'], ['guerrero', 'sacerdote', 'mago'], ['guerrero', 'sacerdote', 'mago', 'picaro', 'mago'],
    ['guerrero', 'guerrero', 'sacerdote', 'sacerdote', 'mago', 'mago', 'mago', 'picaro', 'picaro', 'picaro']];
  for (const comp of comps) {
    const r = await completa(id, 60, comp);
    console.log(`${id.padEnd(10)} ${String(comp.length).padStart(2)} jug. ${comp.join('+').slice(0, 40).padEnd(40)} ${r.gana ? '✓ completada' : '✗ jefes ' + r.jefes + '/' + MAZMORRAS[id].jefes.length} en ${Math.floor(r.seg / 60)}m${String(r.seg % 60).padStart(2, '0')}s · muertes ${r.muertes} · pociones ${r.pociones}`);
  }
  for (const comp of [['guerrero'], ['guerrero', 'sacerdote', 'mago', 'picaro', 'mago']]) {
    const res = [];
    for (let j = 0; j < MAZMORRAS[id].jefes.length; j++) res.push(await pelea(id, 60, comp, j));
    console.log(`${String(comp.length).padStart(2)} jug. ` + res.map((r, j) => `${MONSTRUOS[MAZMORRAS[id].jefes[j].k].nombre.slice(0, 14).padEnd(14)} ${r.gana ? '✓' : '✗'} ${String(r.seg).padStart(3)}s ☠${r.muertes}`).join(' | '));
  }
  process.exit(0);
}
if (modo === 'completa') {
  for (const id in MAZMORRAS) {
    if (soloMaz && soloMaz !== 'todas' && id !== soloMaz) continue;
    const mz = MAZMORRAS[id];
    const nv = +soloNivel || mz.nv[0] + 2;
    for (const comp of [['guerrero'], ['picaro'], ['mago'], ['sacerdote'], ['guerrero', 'sacerdote', 'mago']]) {
      const r = await completa(id, nv, comp);
      console.log(`${id.padEnd(10)} Nv${String(nv).padEnd(3)} ${comp.join('+').padEnd(26)} ${r.gana ? '✓ completada' : '✗ jefes ' + r.jefes + '/3'} en ${Math.floor(r.seg / 60)}m${String(r.seg % 60).padStart(2, '0')}s · muertes ${r.muertes} · pociones ${r.pociones}`);
    }
  }
  process.exit(0);
}
const pruebas = [];
for (const id in MAZMORRAS) {
  if (soloMaz && id !== soloMaz) continue;
  const mz = MAZMORRAS[id];
  const niveles = soloNivel ? [+soloNivel] : [mz.nv[0] + 2, Math.round((mz.nv[0] + mz.nv[1]) / 2)];
  for (const nv of niveles) {
    for (const comp of [['guerrero'], ['picaro'], ['mago'], ['sacerdote'], ['guerrero', 'sacerdote', 'mago']]) pruebas.push([id, nv, comp]);
  }
}
for (const [id, nv, comp] of pruebas) {
  const res = [];
  for (let j = 0; j < MAZMORRAS[id].jefes.length; j++) res.push(await pelea(id, nv, comp, j));
  console.log(`${id.padEnd(10)} Nv${String(nv).padEnd(3)} ${comp.join('+').padEnd(26)} ` + res.map((r, j) => `${MONSTRUOS[MAZMORRAS[id].jefes[j].k].nombre.slice(0, 14).padEnd(14)} ${r.gana ? '✓' : '✗'} ${String(r.seg).padStart(3)}s ☠${r.muertes} 🧪${r.pociones}`).join(' | '));
}
process.exit(0);
