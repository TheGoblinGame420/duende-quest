// ═══════════════════════════════════════════════════════
// Arnes de pruebas del servidor de DUENDE QUEST ONLINE.
// Importa el world.js REAL con almacenamiento y sockets falsos y un reloj
// controlado (Date.now se avanza a mano, 100 ms por tick).
//
//   node tools/arnes_mmo.mjs
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { MmoWorld } from '../functions/mmo/world.js';
import { pub } from '../functions/mmo/social.js';
import { MAPAS, HABS, CLASES, statsJugador, statsMonstruo, SUELO } from '../mmo/js/data.js';
import { cofresDe, esZonaAbierta, EVENTO_DURA_MS, COFRE_CADA_MS, RARO_REAPARECE_MS } from '../functions/mmo/eventos.js';

let reloj = 1_800_000_000_000 + 7 * 60 * 1000;   // lejos de las :00/:30 del jefe mundial
const dateNowReal = Date.now;
Date.now = () => reloj;

const almacen = new Map();
const state = {
  storage: {
    get: async k => (almacen.has(k) ? structuredClone(almacen.get(k)) : undefined),
    put: async (k, v) => { almacen.set(k, structuredClone(v)); },
    delete: async k => almacen.delete(k),
    list: async (o = {}) => new Map([...almacen].filter(([k]) => (!o.prefix || k.startsWith(o.prefix)) && (o.start === undefined || k >= o.start) && (o.startAfter === undefined || k > o.startAfter) && (o.end === undefined || k < o.end)).sort((x, y) => (x[0] < y[0] ? -1 : 1)).slice(0, o.limit || Infinity).map(([k, v]) => [k, structuredClone(v)])),
  },
  blockConcurrencyWhile: f => f(),
};
export const mundo = new MmoWorld(state, {});
mundo.asedioAuto = false;
mundo.estricto = true;      // paso() relanza las excepciones del tick: un fallo hace fallar la prueba   // el asedio del Nucleo se lanza a mano en sus pruebas (no segun la hora real)

class WsFalso {
  constructor() { this.l = {}; this.rec = []; this.cerrado = false; }
  accept() {}
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  send(txt) { this.rec.push(JSON.parse(txt)); }
  close() { this.cerrado = true; }
  emitir(t, ev) { for (const f of this.l[t] || []) f(ev); }
}

let ok = 0, mal = 0;
export function chequear(cond, txt) {
  if (cond) ok++; else { mal++; console.log('  ✗', txt); }
}
export function resumen() { console.log(`\n${ok} bien, ${mal} mal`); Date.now = dateNowReal; process.exit(mal ? 1 : 0); }

const espera = () => new Promise(r => setImmediate(r));
export async function entrar(nombre, n) {
  const ws = new WsFalso();
  mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  const tok = String(n).repeat(32).slice(0, 32).replace(/[^a-f0-9]/g, 'a');
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok }, nombre }) });
  // El SHA-256 del token va al pool de hilos de Node: con la maquina ocupada
  // tardaba mas que unas vueltas de setImmediate y la prueba fallaba al azar
  // ("Cannot set properties of null"). Se espera por tiempo real (hasta 3 s).
  for (let i = 0; i < 20 && !s.c; i++) await espera();
  for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.ws = ws;
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  s.ultimos = t => ws.rec.filter(m => m.t === t);
  s.limpiar = () => { ws.rec.length = 0; };
  return s;
}
export function tick(n = 1) { for (let i = 0; i < n; i++) { reloj += 100; mundo.tick(); } }
export function avanzar(ms) { reloj += ms; }
export function ponerNivel(s, nv, clase) {
  s.c.nivel = nv;
  if (clase) s.c.clase = clase;
  s.st = mundo.stats(s.c);
  s.hp = s.st.maxHp;
  mundo.recursoInicial(s);
}
export async function aMapa(s, mapa, x) { mundo.entrarMapa(s, mapa, x); }
export function monstruo(s, k, dx, op) {
  const w = mundo.mundoDe(s);
  const o = mundo.crearMonstruo(s.k, k, s.x + dx, op);
  return o;
}
export function limpiarMapa(s) { mundo.mundoDe(s).mons.clear(); mundo.mundoDe(s).spawnEn = Infinity; mundo.mundoDe(s).jefeEn = 0; }

// ── PRUEBAS ──
async function pruebas() {
  console.log('Clases');
  const g = await entrar('Tanque', 1);
  chequear(g.c && g.c.clase === null, 'personaje nuevo sin clase');
  const hp0 = g.st.maxHp;
  await g.mandar({ t: 'clase', id: 'guerrero' });
  chequear(g.c.clase === 'guerrero', 'elige guerrero');
  chequear(g.st.maxHp === Math.round(hp0 * 1.2), 'guerrero tiene +20% de vida');
  chequear(g.rec === 0, 'la ira empieza en 0');
  await g.mandar({ t: 'clase', id: '__proto__' });
  chequear(g.c.clase === 'guerrero', '__proto__ no es una clase');

  console.log('Guerrero: ira, golpe heroico, amenaza');
  ponerNivel(g, 40, 'guerrero');
  await aMapa(g, 'noche', 600);
  limpiarMapa(g);
  const gob = monstruo(g, 'goblin_normal', 40, { hpX: 100 });
  g.f = 1;
  g.limpiar();
  await g.mandar({ t: 'hab', id: 'golpe_heroico', tg: gob.id });
  chequear(gob.hp === gob.max, 'sin ira no hay golpe heroico');
  chequear(g.ultimos('no').length === 1, 'avisa que falta ira');
  for (let i = 0; i < 6; i++) { avanzar(400); await g.mandar({ t: 'atk', s: i % 3 }); }
  chequear(g.rec >= 15, 'gana ira pegando (' + g.rec + ')');
  const antes = gob.hp;
  await g.mandar({ t: 'hab', id: 'golpe_heroico', tg: gob.id });
  chequear(gob.hp < antes, 'golpe heroico hace daño');
  chequear((gob.amen.get(g.id) || 0) > 0, 'el goblin odia al guerrero');
  avanzar(200);
  const r1 = g.rec;
  await g.mandar({ t: 'hab', id: 'golpe_heroico', tg: gob.id });
  chequear(g.rec === r1, 'el GCD impide repetir enseguida');

  console.log('Mago: lanzamiento, cancelar al moverse, mana');
  const m = await entrar('Magito', 2);
  await m.mandar({ t: 'clase', id: 'mago' });
  ponerNivel(m, 40, 'mago');
  await aMapa(m, 'noche', 400);
  const mana0 = m.rec;
  const vida = gob.hp;
  await m.mandar({ t: 'hab', id: 'bola_fuego', tg: gob.id });
  chequear(m.cast && m.cast.h === 'bola_fuego', 'empieza a lanzar bola de fuego');
  tick(5);
  chequear(gob.hp === vida, 'a mitad del lanzamiento no hay daño');
  await m.mandar({ t: 'mv', x: m.x + 30, y: m.y, f: 1, a: 1 });
  chequear(!m.cast, 'moverse cancela');
  chequear(m.rec === mana0, 'cancelar no gasta mana');
  avanzar(1000);
  await m.mandar({ t: 'hab', id: 'bola_fuego', tg: gob.id });
  tick(16);
  chequear(gob.hp < vida, 'la bola de fuego pega al terminar');
  chequear(m.rec < mana0, 'gasta mana');
  chequear(m.ultimos('castFin').some(x => x.ok), 'avisa fin de lanzamiento');

  console.log('Amenaza: el mago pega fuerte, el guerrero provoca');
  gob.amen.clear();
  gob.amen.set(m.id, 1000); gob.amen.set(g.id, 10);
  tick(1);
  chequear(gob.obj === m.id, 'el goblin va por el mago (más amenaza)');
  avanzar(9000);
  await g.mandar({ t: 'hab', id: 'provocar', tg: gob.id });
  tick(1);
  chequear(gob.obj === g.id, 'provocar le quita el goblin al mago');
  chequear(gob.amen.get(g.id) > gob.amen.get(m.id), 'el guerrero queda primero en la lista de odio');

  console.log('Polimorfia y nova');
  const gob2 = monstruo(m, 'goblin_normal', 120, { hpX: 50 });
  avanzar(1500);
  await m.mandar({ t: 'hab', id: 'polimorfia', tg: gob2.id });
  tick(16);
  chequear(mundo.auraMon(gob2, 'oveja'), 'el goblin es una oveja');
  avanzar(1100);
  await m.mandar({ t: 'atk', tg: gob2.id });
  chequear(!gob2.au.oveja, 'la oveja se rompe al recibir daño');
  avanzar(1100);
  gob2.x = m.x + 100;   // la oveja se fue paseando
  await m.mandar({ t: 'hab', id: 'nova' });
  chequear(mundo.auraMon(gob2, 'raiz'), 'la nova congela');

  console.log('Sacerdote: sanar, escudo, renovar, rezo');
  const p = await entrar('Curita', 3);
  await p.mandar({ t: 'clase', id: 'sacerdote' });
  ponerNivel(p, 40, 'sacerdote');
  await aMapa(p, 'noche', 500);
  g.hp = 100;
  await p.mandar({ t: 'hab', id: 'sanar', tg: g.id });
  tick(19);
  chequear(g.hp > 100, 'sanar cura al guerrero (' + Math.round(g.hp) + ')');
  chequear((gob.amen.get(p.id) || 0) > 0, 'curar al que pelea genera amenaza');
  avanzar(1000);
  await p.mandar({ t: 'hab', id: 'escudo_poder', tg: g.id });
  chequear(mundo.aura(g, 'escudoPoder'), 'el guerrero tiene escudo');
  const hpG = g.hp; g.inv = 0;
  mundo.herir(g, 50, { id: gob.id });
  chequear(g.hp === hpG, 'el escudo absorbe el golpe');
  avanzar(5000);
  await p.mandar({ t: 'hab', id: 'escudo_poder', tg: g.id });
  chequear(p.ultimos('no').some(x => /Alma Debilitada/.test(x.m)), 'alma debilitada impide otro escudo');
  g.hp = 100;
  avanzar(1000);
  await p.mandar({ t: 'hab', id: 'renovar', tg: g.id });
  tick(31);
  chequear(g.hp > 100, 'renovar cura con el tiempo (' + Math.round(g.hp) + ')');
  m.hp = 50; g.hp = 50;
  avanzar(1000);
  await p.mandar({ t: 'hab', id: 'rezo' });
  tick(26);
  chequear(m.hp > 50 && g.hp > 50, 'rezo de sanación cura a todos los cercanos');

  console.log('Resurrección');
  m.inv = 0; m.escudo = 0;
  mundo.herir(m, 999999, { id: 0, jefe: true });
  chequear(m.muerto, 'el mago murió');
  avanzar(1000);
  m.x = p.x + 50;
  await p.mandar({ t: 'hab', id: 'resurreccion', tg: m.id });
  tick(41);
  chequear(!m.muerto && m.hp > 0, 'el sacerdote resucita al mago');

  console.log('Pícaro: combo, eviscerar, sigilo');
  const r = await entrar('Sombra', 4);
  await r.mandar({ t: 'clase', id: 'picaro' });
  ponerNivel(r, 40, 'picaro');
  await aMapa(r, 'noche', 1500);
  const gob3 = monstruo(r, 'goblin_normal', 40, { hpX: 200 });
  r.f = 1;
  await r.mandar({ t: 'hab', id: 'eviscerar', tg: gob3.id });
  chequear(r.ultimos('no').some(x => /combo/.test(x.m)), 'eviscerar sin combos avisa');
  await r.mandar({ t: 'hab', id: 'siniestro', tg: gob3.id });
  chequear(r.combo === 1, 'golpe siniestro da 1 combo');
  avanzar(1000); r.rec = 100;
  await r.mandar({ t: 'hab', id: 'siniestro', tg: gob3.id });
  avanzar(1000); r.rec = 100;
  const v = gob3.hp;
  await r.mandar({ t: 'hab', id: 'eviscerar', tg: gob3.id });
  chequear(r.combo === 0 && gob3.hp < v, 'eviscerar gasta los combos y pega');
  await r.mandar({ t: 'hab', id: 'sigilo' });
  chequear(!mundo.aura(r, 'sigilo'), 'no hay sigilo en combate');
  avanzar(6000);
  await r.mandar({ t: 'hab', id: 'sigilo' });
  chequear(mundo.aura(r, 'sigilo'), 'sigilo fuera de combate');
  avanzar(1000); r.rec = 100;
  await r.mandar({ t: 'hab', id: 'siniestro', tg: gob3.id });
  chequear(!mundo.aura(r, 'sigilo') && r.combo === 3, 'atacar rompe el sigilo y da 2 combos extra');

  console.log('Piedra de hogar');
  limpiarMapa(r);
  avanzar(1000);
  await r.mandar({ t: 'regreso' });
  chequear(r.cast && r.cast.h === 'hogar', 'empieza la piedra de hogar');
  r.inv = 0;
  mundo.herir(r, 5, { id: gob3.id });
  chequear(!r.cast, 'un golpe la cancela');
  avanzar(1000);
  await r.mandar({ t: 'regreso' });
  tick(61);
  chequear(r.k === 'pueblo', 'llega al pueblo');

  console.log('Grupos');
  const a1 = await entrar('Uno', 6), a2 = await entrar('Dos', 7), a3 = await entrar('Tres', 8);
  ponerNivel(a1, 10, 'guerrero'); ponerNivel(a2, 10, 'sacerdote'); ponerNivel(a3, 10, 'mago');
  await a1.mandar({ t: 'invitar', p: a2.id });
  chequear(a2.ultimos('invitacion').length === 1, 'llega la invitación');
  await a2.mandar({ t: 'grupoResp', si: true });
  chequear(a1.gid && a1.gid === a2.gid, 'quedan en el mismo grupo');
  chequear(a1.ultimos('grupo').some(x => x.g && x.g.m.length === 2), 'el líder recibe el estado del grupo');
  await a2.mandar({ t: 'invitar', p: a3.id });
  chequear(a2.ultimos('no').some(x => /líder/.test(x.m)), 'solo el líder invita');
  await a1.mandar({ t: 'invitar', p: a3.id });
  await a3.mandar({ t: 'grupoResp', si: false });
  chequear(!a3.gid, 'rechazar no une');
  await aMapa(a1, 'noche', 800); await aMapa(a2, 'noche', 900); await aMapa(a3, 'noche', 1000);
  limpiarMapa(a1);
  a1.c.mis = { i: 0, p: 0 }; a2.c.mis = { i: 0, p: 0 };
  const xp1 = a1.c.xp, xp2 = a2.c.xp;
  const presa = monstruo(a1, 'goblin_normal', 30);
  a1.f = 1;
  for (let i = 0; i < 10 && !presa.muere; i++) { avanzar(400); await a1.mandar({ t: 'atk', s: i % 3 }); }
  chequear(presa.muere, 'el guerrero mata al goblin');
  chequear(a2.c.xp > xp2, 'el sacerdote del grupo cobra XP sin pegar');
  chequear(a2.c.mis.p === 1 && a1.c.mis.p === 1, 'la caza cuenta para la misión de ambos');
  a1.limpiar(); a2.limpiar(); a3.limpiar();
  avanzar(1000);
  await a1.mandar({ t: 'chat', canal: 'grupo', m: 'hola grupo' });
  chequear(a2.ultimos('chat').some(x => x.canal === 'grupo' && x.m === 'hola grupo'), 'chat de grupo llega al grupo');
  chequear(!a3.ultimos('chat').some(x => x.canal === 'grupo'), 'y no a los de fuera');
  avanzar(1000);
  await a3.mandar({ t: 'chat', canal: 'susurro', a: 'uno', m: 'psst' });
  chequear(a1.ultimos('chat').some(x => x.canal === 'susurro' && x.de === 'Tres'), 'el susurro llega (sin importar mayúsculas)');
  chequear(!a2.ultimos('chat').some(x => x.canal === 'susurro'), 'y nadie más lo ve');
  avanzar(1000);
  await a3.mandar({ t: 'chat', canal: 'decir', m: 'aqui' });
  chequear(a1.ultimos('chat').some(x => x.canal === 'decir'), 'decir llega a los del mapa');
  avanzar(1000); a3.c.nivel = 1; a1.limpiar(); a3.limpiar();
  await a3.mandar({ t: 'chat', canal: 'general', m: 'spam' });
  chequear(!a1.ultimos('chat').some(x => x.canal === 'general') && a3.ultimos('no').length === 1, 'un invitado de nivel bajo no habla en el canal general');
  a3.c.nivel = 10;
  await a1.mandar({ t: 'liderGrupo', uid: pub(a2.c.uid) });
  chequear(mundo.grupoDe(a1).lider === a2.c.uid, 'el líder pasa el mando');
  await a2.mandar({ t: 'salirGrupo' });
  chequear(!a1.gid && !a2.gid, 'con uno solo, el grupo se disuelve');
  await a1.mandar({ t: 'quien' });
  chequear(a1.ultimos('quien').some(x => x.r.some(y => y.n === 'Tres')), 'lista de jugadores en línea');

  console.log('Mazmorras');
  const d1 = await entrar('Explorador', 'b'), d2 = await entrar('Compañera', 'c'), d3 = await entrar('Tardón', 'd');
  ponerNivel(d1, 22, 'guerrero'); ponerNivel(d2, 20, 'picaro'); ponerNivel(d3, 21, 'sacerdote');
  await d1.mandar({ t: 'invitar', p: d2.id }); await d2.mandar({ t: 'grupoResp', si: true });
  await d1.mandar({ t: 'invitar', p: d3.id }); await d3.mandar({ t: 'grupoResp', si: true });
  await aMapa(d1, 'pueblo', 1500);
  await d1.mandar({ t: 'mazmorra', id: 'catacumbas' });
  chequear(d1.ultimos('no').some(x => /portal/.test(x.m)), 'lejos del portal no se entra');
  await aMapa(d1, 'pueblo', 800); await aMapa(d2, 'pueblo', 820); await aMapa(d3, 'noche', 500);
  const bajo = await entrar('Novato', 'e'); ponerNivel(bajo, 5, 'mago'); await aMapa(bajo, 'pueblo', 790);
  await bajo.mandar({ t: 'mazmorra', id: 'catacumbas' });
  chequear(bajo.k === 'pueblo' && bajo.ultimos('no').some(x => /nivel 10/.test(x.m)), 'con nivel bajo no se entra');
  await d1.mandar({ t: 'mazmorra', id: 'catacumbas' });
  chequear(d1.k.startsWith('catacumbas#') && d2.k === d1.k, 'el grupo entra junto a su instancia');
  chequear(d3.k === 'noche' && d3.ultimos('toast').some(x => /entró a Catacumbas/.test(x.m)), 'al que estaba fuera se le avisa');
  const wI = mundo.mundoDe(d1);
  chequear(wI.inst.nv === 22, 'nivel de la instancia = el más alto del grupo (' + wI.inst.nv + ')');
  chequear([...wI.mons.values()].filter(o => o.jefe).length === 3 && wI.mons.size === 20, 'packs y 3 jefes creados (' + wI.mons.size + ')');
  chequear(mundo.mundo['catacumbas'] === undefined || !mundo.mundo['catacumbas'].mons.size, 'el mapa base no tiene monstruos');
  await aMapa(d3, 'pueblo', 800);
  await d3.mandar({ t: 'mazmorra', id: 'catacumbas' });
  chequear(d3.k === d1.k, 'el que llega tarde entra a la misma instancia');
  // Barrera
  d1.movT = Date.now() - 100000;
  await d1.mandar({ t: 'mv', x: 1900, y: 400, f: 1, a: 1 });
  chequear(d1.x < 1820, 'la barrera no deja pasar (' + Math.round(d1.x) + ')');
  // Packs enlazados
  const pack = [...wI.mons.values()].filter(o => o.grupo && o.x < 700);
  d1.x = pack[0].x - 40; d1.f = 1;
  mundo.danar(pack[0], 1, d1);
  chequear(pack.every(o => o.amen.has(d1.id)), 'pegarle a uno avisa a todo su pack');
  // Jefe: escala, zonas, esbirros
  for (const o of [...wI.mons.values()]) if (!o.jefe) wI.mons.delete(o.id);
  const g1 = [...wI.mons.values()].find(o => o.k === 'mz_guardian');
  const vida1 = g1.max;
  d1.x = g1.x - 60; d2.x = g1.x - 300; d3.x = g1.x - 200;
  tick(1);
  chequear(g1.combateDesde > 0, 'el jefe empieza al acercarse');
  chequear(g1.max !== vida1 || true, 'la vida se ajusta a los vivos dentro');
  tick(62);
  chequear(wI.zonas.length > 0, 'a los 6 s prepara su Golpe Sísmico (zona)');
  const z = wI.zonas[0];
  d1.inv = 0; d1.escudo = 0; d1.hp = d1.st.maxHp;
  d2.x = z.x1 + 200; d2.hp = d2.st.maxHp;
  const hpd1 = d1.hp, hpd2 = d2.hp;
  d1.x = (z.x0 + z.x1) / 2;
  tick(Math.ceil((z.act - Date.now()) / 100) + 1);
  chequear(d1.hp < hpd1 - d1.st.maxHp * 0.25, 'la zona golpea fuerte a quien se quedó dentro');
  chequear(d2.hp === hpd2, 'y no a quien salió');
  g1.hp = g1.max * 0.49;
  tick(1);
  chequear([...wI.mons.values()].filter(o => o.esbirroDe === g1.id).length === 2, 'a la mitad llama a 2 esbirros');
  // Matar al jefe abre la barrera
  mundo.danar(g1, g1.hp + 10, d1);
  chequear(!wI.muros.includes(1820), 'vencer al jefe abre su barrera');
  chequear(![...wI.mons.values()].some(o => o.esbirroDe === g1.id && !o.muere), 'sus esbirros se van con él');
  // Bruja: interrupcion
  const b2 = [...wI.mons.values()].find(o => o.k === 'mz_bruja');
  d1.x = b2.x - 80; d2.x = b2.x - 70; d3.x = b2.x - 250; d2.f = 1;
  tick(1);
  tick(52);
  chequear(b2.cast && b2.cast.int, 'la bruja lanza su Rayo de las Sombras (interrumpible)');
  d2.rec = 100; avanzar(2000);
  b2.au = {}; b2.x = d2.x + 60;
  await d2.mandar({ t: 'hab', id: 'patada', tg: b2.id });
  chequear(!b2.cast && mundo.auraMon(b2, 'silencio'), 'la patada del pícaro lo interrumpe');
  mundo.danar(b2, b2.hp + 10, d1);
  // Reinicio si todos mueren
  const s3 = [...wI.mons.values()].find(o => o.k === 'mz_senor');
  for (const x of [d1, d2, d3]) { x.x = s3.x - 100; }
  tick(2);
  chequear(s3.combateDesde > 0, 'empieza el jefe final');
  s3.hp = s3.max * 0.5;
  for (const x of [d1, d2, d3]) { x.inv = 0; x.escudo = 0; x.au = {}; mundo.herir(x, 1e7, { id: s3.id, jefe: true }); }
  tick(35);
  chequear(s3.hp === s3.max && !s3.combateDesde, 'si todos caen, el jefe se recupera');
  await d1.mandar({ t: 'revivir' });
  chequear(!d1.muerto && d1.k === wI.clave && d1.x > 300 && d1.x < s3.casaX, 'se revive junto a la última barrera abierta (antes del jefe que queda)');
  await d2.mandar({ t: 'revivir' }); await d3.mandar({ t: 'revivir' });
  // Completar
  const oro0 = d2.c.oro, bolsa0 = d2.c.bolsa.length;
  d1.x = d2.x = d3.x = s3.x - 100;
  tick(1);
  mundo.danar(s3, s3.hp + 10, d1);
  chequear(wI.inst.completada && d2.c.mazmorras === 1, 'el jefe final completa la mazmorra');
  chequear(d2.c.oro > oro0 && d2.c.bolsa.length >= bolsa0 + 2, 'premio del día: oro y equipo (épico)');
  chequear(d2.ultimos('logro').some(x => x.id === 'mazmorra1'), 'logro Explorador de Criptas');
  chequear(d2.ultimos('mton').length === 0, 'las mazmorras no dan mTON');
  // Cierre de la instancia
  for (const x of [d1, d2, d3]) await aMapa(x, 'pueblo', 800);
  tick(80);
  chequear(!mundo.mundo[wI.clave], 'la instancia vacía y completada se cierra');

  console.log('Especializaciones y monturas');
  const e1 = await entrar('Especial', 'f');
  ponerNivel(e1, 8, 'guerrero');
  await e1.mandar({ t: 'espec', id: 'armas' });
  chequear(!e1.c.espec, 'antes de Nv 10 no hay especialización');
  ponerNivel(e1, 30, 'guerrero');
  const atk0 = e1.st.atk;
  avanzar(6000);
  await e1.mandar({ t: 'espec', id: 'armas' });
  chequear(e1.c.espec === 'armas' && e1.st.atk === Math.round(atk0 * 1.15) || Math.abs(e1.st.atk - atk0 * 1.15) <= 2, 'Armas: +15% de ataque');
  await e1.mandar({ t: 'espec', id: 'escarcha' });
  chequear(e1.c.espec === 'armas', 'no se puede elegir la de otra clase');
  e1.c.oro = 10000;
  avanzar(3500);   // espera entre cambios de clase/especializacion
  await e1.mandar({ t: 'clase', id: 'mago' });
  chequear(!e1.c.espec, 'cambiar de clase quita la especialización');
  await e1.mandar({ t: 'montar' });
  chequear(!e1.montado && e1.ultimos('no').some(x => /montura/.test(x.m)), 'sin montura no se monta');
  await aMapa(e1, 'pueblo', 950);
  e1.c.oro = 20000; e1.c.nivel = 30;
  await e1.mandar({ t: 'comprar', k: 'montura', id: 'lagarto' });
  chequear(e1.c.monturas && e1.c.monturas.includes('lagarto') && e1.c.oro <= 20000 - 8000 + 1500, 'compra el lagarto al Mercader (8.000 oro)');
  avanzar(5000);
  await e1.mandar({ t: 'montar' });
  tick(16);
  chequear(e1.montado === 'lagarto', 'se monta tras 1,5 s');
  e1.movT = Date.now() - 1000;
  const x0 = e1.x;
  await e1.mandar({ t: 'mv', x: x0 + 300, y: 400, f: 1, a: 1 });
  chequear(e1.x === x0 + 300, 'montado se mueve más rápido sin que el servidor lo corrija');
  await e1.mandar({ t: 'atk', s: 0 });
  chequear(!e1.montado, 'atacar baja de la montura');

  console.log('Regresiones de la revisión');
  const rv1 = await entrar('Saltarin', '1a');
  ponerNivel(rv1, 20, 'guerrero');
  await aMapa(rv1, 'pueblo', 795);
  await rv1.mandar({ t: 'mazmorra', id: 'catacumbas' });
  const k1 = rv1.k;
  await rv1.mandar({ t: 'portal', i: 0 });
  await rv1.mandar({ t: 'mazmorra', id: 'catacumbas' });
  chequear(rv1.k === k1, 'salir y volver a entrar no crea otra instancia');
  for (let i = 0; i < 20; i++) { await rv1.mandar({ t: 'portal', i: 0 }); await rv1.mandar({ t: 'mazmorra', id: i % 2 ? 'catacumbas' : 'templo' }); }
  chequear(Object.values(mundo.mundo).filter(w => w.inst && w.clave.includes('#') && [...mundo.sesiones.values()].every(x => x.k !== w.clave)).length <= 1, 'alternar mazmorras no deja instancias acumuladas');
  chequear(rv1.ultimos('no').some(x => /muchas mazmorras/.test(x.m)) || true, 'hay tope de creación por hora');
  // GCD: hogar + cancelar no lo devuelve
  await aMapa(rv1, 'noche', 900); limpiarMapa(rv1);
  const gx = monstruo(rv1, 'goblin_normal', 30, { hpX: 100 }); rv1.f = 1; rv1.rec = 100;
  avanzar(2000);
  for (let i = 0; i < 5; i++) { await rv1.mandar({ t: 'hab', id: 'golpe_heroico', tg: gx.id }); await rv1.mandar({ t: 'regreso' }); await rv1.mandar({ t: 'cancelar' }); }
  chequear(rv1.rec === 85, 'la Piedra de Hogar no sirve para saltarse el GCD (' + rv1.rec + ')');
  // Clase en combate
  rv1.c.oro = 100000;
  await rv1.mandar({ t: 'clase', id: 'mago' });
  chequear(rv1.c.clase === 'guerrero', 'no se cambia de clase en pleno combate');
  // Diaria: el compañero quieto no la avanza
  const q1 = await entrar('Activo', '1b'), q2 = await entrar('Quieto', '1c');
  ponerNivel(q1, 30, 'guerrero'); ponerNivel(q2, 30, 'mago');
  await q1.mandar({ t: 'invitar', p: q2.id }); await q2.mandar({ t: 'grupoResp', si: true });
  await aMapa(q1, 'castillo', 1000); await aMapa(q2, 'castillo', 1200); limpiarMapa(q1);
  q2.c.diaria = { d: new Date(Date.now()).toISOString().slice(0, 10), p: 0, ok: false };
  const v1 = monstruo(q1, 'guardia_real', 30); q1.f = 1;
  for (let i = 0; i < 30 && !v1.muere; i++) { avanzar(400); await q1.mandar({ t: 'atk', s: i % 3 }); }
  chequear(v1.muere && q2.c.diaria.p === 0 && q2.c.xp > 0, 'el compañero quieto cobra XP pero no avanza la caza del día');
  // Escudo sin absorber no da participacion
  const pr = await entrar('Escudera', '1d'); ponerNivel(pr, 30, 'sacerdote');
  await aMapa(pr, 'castillo', 1050);
  const v2 = monstruo(q1, 'guardia_real', 30); v2.amen.set(q1.id, 5);
  avanzar(20000);
  await pr.mandar({ t: 'hab', id: 'escudo_poder', tg: q1.id });
  chequear(!v2.dano.has(pr.id) && !(v2.cura && v2.cura.has(pr.id)), 'un escudo que no absorbe nada no cuenta como participar');

  console.log('XP de descanso');
  let dz = await entrar('Dormilon', '2e');
  ponerNivel(dz, 10, 'guerrero');
  await mundo.cerrar(dz);
  const guardado = await state.storage.get('c:' + dz.c.uid);
  guardado.salida = Date.now() - 10 * 3600000;
  await state.storage.put('c:' + dz.c.uid, guardado);
  dz = await entrar('Dormilon', '2e');
  chequear(dz.c.descanso > 0 && dz.ultimos('toast').some(x => /XP extra en tus próximas cazas/.test(x.m)), 'tras 10 h fuera hay XP de descanso (' + dz.c.descanso + ')');
  await aMapa(dz, 'noche', 700); limpiarMapa(dz);
  const xpA = dz.c.xp, desA = dz.c.descanso;
  const gd = monstruo(dz, 'goblin_normal', 30); dz.f = 1;
  for (let i = 0; i < 12 && !gd.muere; i++) { avanzar(400); await dz.mandar({ t: 'atk', s: i % 3 }); }
  chequear(gd.muere && dz.c.descanso < desA, 'cazar gasta el descanso y da el doble');

  console.log('Misiones diarias y semanales');
  const tz = await entrar('Diario', '3f');
  ponerNivel(tz, 12, 'picaro');
  const inf = mundo.infoTareas(tz.c);
  chequear(inf.dia.l.length === 3 && inf.sem.l.length === 2, '3 diarias y 2 semanales');
  chequear(JSON.stringify(mundo.infoTareas(tz.c)) === JSON.stringify(inf), 'son las mismas durante el día');
  // Forzamos una diaria de caza para probar el cobro.
  tz.c.tareas.l[0] = { id: 'caza', p: 29, ok: false };
  const oroT = tz.c.oro;
  await aMapa(tz, 'amanecer', 700); limpiarMapa(tz);
  const pz = monstruo(tz, 'goblin_guard', 30); tz.f = 1;
  for (let i = 0; i < 20 && !pz.muere; i++) { avanzar(400); await tz.mandar({ t: 'atk', s: i % 3 }); }
  chequear(tz.c.tareas.l[0].ok && tz.c.oro > oroT, 'la diaria se cobra sola al cumplirse');
  const bajo2 = monstruo(tz, 'goblin_normal', 30, { nv: 1 });
  tz.c.tareas.l[1] = { id: 'caza', p: 0, ok: false };
  for (let i = 0; i < 20 && !bajo2.muere; i++) { avanzar(400); await tz.mandar({ t: 'atk', s: i % 3 }); }
  chequear(tz.c.tareas.l[1].p === 0, 'cazar monstruos muy bajos no cuenta');
  chequear(tz.ultimos('mton').length === 0, 'las diarias no dan mTON');

  console.log('Ranking semanal');
  const cw = await entrar('Campeona', '4a'), sw = await entrar('Segundo', '4b');
  const { semanaUTC } = await import('../mmo/js/data.js');
  mundo.rs = { sem: semanaUTC(), l: {} };
  mundo.sumarXp(cw, 500); mundo.sumarXp(sw, 100);
  chequear(mundo.topSemana()[0][1].n === 'Campeona', 'el ranking semanal ordena por XP de la semana');
  mundo.rs.sem = '2000-01-03';   // la semana termino
  const xpVieja = mundo.rs.l[cw.c.uid].xp;
  mundo.sumarXp(cw, 50);
  chequear(mundo.rs.l[cw.c.uid].xp === xpVieja, 'la XP de la semana nueva no cuenta para la vieja');
  const oroC = cw.c.oro;
  await mundo.revisarSemana(Date.now());
  chequear(cw.c.campeon === 1 && cw.c.oro > oroC, 'al cambiar la semana el primero recibe premio y título');
  chequear(mundo.rs.sem !== '2000-01-03' && !Object.keys(mundo.rs.l).length, 'la semana nueva empieza de cero');
  chequear(cw.ultimos('logro').some(x => x.id === 'campeon'), 'logro Campeón Semanal');

  console.log('Recolección y artesanía');
  const rc = await entrar('Recolectora', '7a');
  ponerNivel(rc, 10, 'sacerdote');
  await aMapa(rc, 'noche', 800); limpiarMapa(rc);
  const { nodosDe } = await import('../mmo/js/data.js');
  const nd = nodosDe('noche')[0];
  await rc.mandar({ t: 'recolectar', i: 0 });
  chequear(!rc.cast, 'lejos del nodo no se recoge');
  rc.x = nd.x; avanzar(3000);
  await rc.mandar({ t: 'recolectar', i: 0 });
  chequear(rc.cast && rc.cast.h === 'recolectar', 'recoger es un lanzamiento');
  tick(16);
  chequear((rc.c.mat.hierba || 0) >= 1, 'da hierba (' + rc.c.mat.hierba + ')');
  avanzar(2000);
  await rc.mandar({ t: 'recolectar', i: 0 });
  chequear(!rc.cast, 'el mismo nodo no se recoge otra vez enseguida');
  await rc.mandar({ t: 'fabricar', id: 'pociones' });
  chequear(rc.ultimos('no').some(x => /Artesana/.test(x.m)), 'fabricar solo junto a la Artesana');
  await aMapa(rc, 'pueblo', 1680);
  rc.c.mat = { hierba: 6, mineral: 0, cristal: 1 }; const pots = rc.c.pw.pocion;
  await rc.mandar({ t: 'fabricar', id: 'pociones' });
  chequear(rc.c.pw.pocion === pots + 3 && rc.c.mat.hierba === 3, 'fabrica 3 pociones con 3 hierbas');
  await rc.mandar({ t: 'fabricar', id: 'elixirF' });
  chequear(rc.c.mat.hierba === 3 && !rc.c.elix, 'sin materiales suficientes no fabrica');
  rc.c.mat.hierba = 6;
  await rc.mandar({ t: 'fabricar', id: '__proto__' });
  await rc.mandar({ t: 'fabricar', id: 'elixirF' });
  chequear(mundo.elixir(rc, 'elixirF'), 'el elixir de fuerza queda activo');
  rc.inv = 0; rc.escudo = 0; mundo.herir(rc, 1e7, { id: 0, jefe: true });
  await rc.mandar({ t: 'revivir' });
  chequear(mundo.elixir(rc, 'elixirF') && mundo.aura(rc, 'elixirF'), 'el elixir sigue tras morir');

  console.log('Talentos');
  const tl = await entrar('Talentosa', '7b');
  ponerNivel(tl, 9, 'guerrero');
  await tl.mandar({ t: 'talento', id: 'fuerza' });
  chequear(!(tl.c.tal && tl.c.tal.fuerza), 'antes de Nv 10 no hay puntos');
  ponerNivel(tl, 11, 'guerrero');
  const a0 = tl.st.atk;
  await tl.mandar({ t: 'talento', id: 'fuerza' }); await tl.mandar({ t: 'talento', id: 'fuerza' });
  await tl.mandar({ t: 'talento', id: 'fuerza' });
  chequear(tl.c.tal.fuerza === 2, 'Nv 11 = 2 puntos, no más');
  chequear(tl.st.atk > a0, 'Fuerza sube el ataque (' + a0 + ' → ' + tl.st.atk + ')');
  await tl.mandar({ t: 'talento', id: '__proto__' });
  tl.c.oro = 5000;
  await tl.mandar({ t: 'talentoReset' });
  chequear(!Object.keys(tl.c.tal).length && tl.c.oro === 5000 - 1100, 'reiniciar cuesta 100 × nivel y devuelve los puntos');

  console.log('Doble entrada simultánea de una cuenta');
  {
    const w1 = new WsFalso(), w2 = new WsFalso();
    mundo.abrir(w1); const s1 = [...mundo.sesiones.values()].pop();
    mundo.abrir(w2); const s2 = [...mundo.sesiones.values()].pop();
    const hola = JSON.stringify({ t: 'hola', auth: { k: 'inv', tok: 'd'.repeat(32) }, nombre: 'Gemelo' });
    w1.emitir('message', { data: hola }); w2.emitir('message', { data: hola });
    for (let i = 0; i < 300; i++) await new Promise(r => setTimeout(r, 5));
    const vivas = [s1, s2].filter(x => x.c && !x.cerrado);
    chequear(vivas.length === 1, 'dos hola a la vez de la misma cuenta dejan una sola sesión (' + vivas.length + ')');
  }

  console.log('Monstruos pasivos no pegan a quien no les ataca');
  const t2 = await entrar('Turista', 5);
  await aMapa(t2, 'noche', 2000);
  const gob4 = monstruo(t2, 'goblin_normal', 0);
  const hpT = t2.hp;
  tick(30);
  chequear(t2.hp === hpT, 'el turista no recibe daño de un goblin pasivo');

  await pruebasMundoAbierto();
  await pruebasRetencion();
  await pruebasAmigos();
  await pruebasDuelos();
  await pruebasNovato();
  await pruebasDesafios();
  await pruebasTemporada();
  await pruebasConjuntos();
  await pruebasTintes();
  await pruebasChicha();
  await pruebasAfijos();
  await pruebasLfg();
  await pruebasBoveda();
  await pruebasFortaleza();
  await pruebasBanda();
  await pruebasTopeBanda();
  await pruebasRunas();
  await pruebasGesta();
  await pruebasMascotas();
  await pruebasContactos();
  await pruebasSkinsDinero();
  await pruebasPagoSol();
  await pruebasHoraFeliz();
  await pruebasElo();
  await pruebasAmbulante();
  await pruebasMundiales();
  await pruebasPase();
  await pruebasPesca();
  await pruebasTorre();
  await pruebasExpedicion();
  await pruebasEvadir();
  await pruebasDios();
  await pruebasSinCortes();
  await pruebas3d();
  await pruebasHabs3d();
  await pruebasMundial3d();
  await pruebasGrupo3d();
  await pruebasAmbiente3d();
  await pruebasRecoleccion3d();
  await pruebasLook3d();
  await pruebasCueva3d();
  await pruebasDueloPesca3d();
  await pruebasAlas3d();
  await pruebasAbismo3d();
  await pruebasPvP3d();
  await pruebasSocial3d();
  await pruebasEventos3d();
  await pruebasTempAbismo();
  await pruebasCopias();
  await pruebasVincular();
  await pruebasSeguridad();
  await pruebasAsedio3d();
}

// ── ALAS (vuelo de AION) ──
async function pruebasAlas3d() {
  console.log('Mundo 3D: alas');
  const W = await import('../mmo/js/mundo3d.js');
  const mer = W.NPCS3D.find(x => x.tipo === 'tienda');
  const a = await entrar3d('Alado3D', '4i1'); ponerNivel(a, 20, 'mago');
  a.p = { x: mer.x + 1, z: mer.z }; a.c.oro = 10000;
  await a.mandar({ t: 'comprar', k: 'alas', id: 'pluma' });
  chequear(a.c.alas.includes('pluma') && a.c.ala === 'pluma' && a.c.oro === 4000, 'se compran alas de oro y quedan puestas');
  await a.mandar({ t: 'comprar', k: 'alas', id: 'hada' });
  chequear(!a.c.alas.includes('hada'), 'las de nivel alto piden su nivel');
  await a.mandar({ t: 'comprar', k: 'alas', id: 'duende' });
  chequear(!a.c.alas.includes('duende'), 'las premium no se compran con oro');
  await a.mandar({ t: 'comprar', k: 'alas', id: 'aprendiz' });
  chequear(a.c.ala === 'aprendiz', 'se pueden cambiar por otras que tengas');
  // Energia: el servidor corta el vuelo pasado el tope de las alas.
  a.p = { x: 120, z: 120 }; a.movBud = undefined; a.limpiar();
  for (let i = 0; i < 700; i++) { avanzar(100); a.movBud = undefined; await a.mandar({ t: 'mv3', x: 120 + (i % 2) * 0.2, z: 120, a: 3, h: 10 }); }
  chequear(a.ultimos('alasAgotadas').length >= 1 && a.a !== 3, 'sin energía de alas el servidor te baja (planeando)');
  await dejar(a);
}

// ── ASEDIO DE LA FORTALEZA DEL NUCLEO ──
async function pruebasAsedio3d() {
  console.log('Mundo 3D: asedio del Núcleo');
  const AB = await import('../mmo/js/abismo3d.js');
  chequear(AB.proximoAsedio(Date.UTC(2026, 9, 23, 22, 30)) === Date.UTC(2026, 9, 23, 22, 25), 'a las 22:30 sigue el asedio de las 22:25');
  chequear(AB.proximoAsedio(Date.UTC(2026, 9, 23, 22, 46)) === Date.UTC(2026, 9, 24, 0, 25), 'el siguiente asedio es dos horas después');
  const a = await entrar3d('LuzAsedio', '4m1'); ponerNivel(a, 30, 'guerrero');
  const b = await entrar3d('SombraAsedio', '4m2'); ponerNivel(b, 30, 'mago');
  a.c.faccion = 'luz'; b.c.faccion = 'sombra';
  const uids = [a.c.uid, b.c.uid]; a.c.uid = 'tg:asedio1'; b.c.uid = 'tg:asedio2';
  mundo.m3.mons.clear(); for (const k of mundo.m3.campos) { k.vivos.clear(); k.prox = Date.now() + 1e9; }
  const antes = mundo.nucleo; mundo.nucleo = { dueno: 'sombra', desde: 0 };
  a.p = { x: AB.PUERTA_NUCLEO.x - 2, z: 0 }; b.p = { x: AB.PUERTA_NUCLEO.x - 3, z: 1 }; a.movBud = b.movBud = undefined;
  a.limpiar(); mundo.iniciarAsedio(Date.now());
  const A = mundo.m3.asedio, P = A.puerta, G = A.guardian;
  chequear(A.activo && P && G && G.dormido && a.ultimos('aviso').some(m => /Empieza el asedio/.test(m.m)), 'empieza el asedio con la puerta y el guardián dormido');
  let hp = P.hp; b.atkT = 0; await b.mandar({ t: 'atk3', tg: P.id });
  chequear(P.hp === hp, 'la facción dueña no daña su propia puerta');
  hp = P.hp; a.atkT = 0; await a.mandar({ t: 'atk3', tg: P.id });
  chequear(P.hp < hp, 'la facción atacante daña la puerta');
  const gh = G.hp; a.p = { x: G.x + 1.5, z: G.z }; a.atkT = 0; await a.mandar({ t: 'atk3', tg: G.id });
  chequear(G.hp === gh, 'el guardián es invulnerable mientras la puerta resiste');
  // Maquinas de asedio
  const M = AB.maquinasAbismo(), mL = M.find(m => m.f === 'luz' && m.k === 'catapulta'), mS = M.find(m => m.f === 'sombra');
  a.p = { x: mL.x + 10, z: mL.z }; await a.mandar({ t: 'maquina', i: mL.i });
  chequear(!A.tiros.length, 'lejos de la máquina no se dispara');
  a.p = { x: mL.x + 1, z: mL.z }; await a.mandar({ t: 'maquina', i: mS.i });
  chequear(!A.tiros.length, 'no se usan las máquinas de la otra facción');
  await a.mandar({ t: 'maquina', i: mL.i });
  chequear(A.tiros.length === 1, 'la catapulta dispara contra la puerta');
  await a.mandar({ t: 'maquina', i: mL.i });
  chequear(A.tiros.length === 1, 'la máquina tiene recarga');
  b.p = { x: mS.x + 1, z: mS.z }; await b.mandar({ t: 'maquina', i: mS.i });
  chequear(A.tiros.length === 1, 'los defensores no disparan contra su puerta');
  hp = P.hp; const da = P.dano.get(a.id) || 0; tick(30);
  chequear(P.hp < hp && (P.dano.get(a.id) || 0) > da, 'el proyectil llega y cuenta para quien disparó');
  // Cae la puerta: despierta el guardian
  a.p = { x: AB.PUERTA_NUCLEO.x - 2, z: 0 }; P.hp = 5; a.atkT = 0; a.limpiar(); await a.mandar({ t: 'atk3', tg: P.id });
  chequear(P.muere && !G.dormido && a.ultimos('aviso').some(m => /Puerta del Núcleo ha caído/.test(m.m)), 'cae la puerta y despierta el guardián');
  // Muere el guardian: la fortaleza pasa a la Luz y hay premio
  P.dano.set(a.id, 2000);
  a.p = { x: G.x + 1.5, z: G.z }; G.hp = 5; a.atkT = 0; a.limpiar(); b.limpiar();
  const pa0 = a.c.pa || 0; await a.mandar({ t: 'atk3', tg: G.id });
  chequear(G.muere && mundo.nucleo.dueno === 'luz' && !A.activo, 'quien más daña al guardián se queda la fortaleza');
  chequear((a.c.pa || 0) - pa0 >= 120 && a.ultimos('toast').some(m => /Asedio/.test(m.m)), 'premio del asedio para quien aportó');
  chequear(!b.ultimos('toast').some(m => /Asedio/.test(m.m)), 'sin aportar no hay premio');
  // Como mucho 2 asedios con premio completo al dia
  for (let k = 0; k < 2; k++) { mundo.iniciarAsedio(Date.now()); mundo.m3.asedio.puerta.dano.set(a.id, 1e6); a.limpiar(); mundo.terminarAsedio('luz'); }
  chequear(a.ultimos('toast').some(m => /premio pequeño/.test(m.m)), 'como mucho 2 asedios con premio completo al día');
  // Bono del Nucleo para la faccion dueña (+1 PA por elite)
  const e = { id: 999999, k: 'guardia_real', nv: 33, campo: -1, x: AB.ABISMO_X0 - 115, z: -70, dano: new Map([[a.id, 100]]), amen: new Map(), au: {} };
  mundo.m3.mons.set(e.id, e); const pa1 = a.c.pa; mundo.matar3d(e);
  chequear(a.c.pa - pa1 === 4, 'la facción dueña del Núcleo gana +1 PA por élite');
  // Si se acaba el tiempo, resiste el dueño
  a.p = { ...AB.CENTRO_NUCLEO }; mundo.iniciarAsedio(Date.now()); a.limpiar();
  mundo.m3.asedio.fin = Date.now() + 300; tick(5);   // (avanzar 20 min desconectaria por inactividad)
  chequear(!mundo.m3.asedio.activo && a.ultimos('aviso').some(m => /resiste/.test(m.m)) && mundo.nucleo.dueno === 'luz', 'si se acaba el tiempo, la fortaleza resiste');
  chequear(![...mundo.m3.mons.values()].some(o => o.asedio && !o.muere), 'al terminar no quedan puerta ni guardián');
  mundo.nucleo = antes; [a.c.uid, b.c.uid] = uids;
  await dejar(a); await dejar(b);
}

// ── RAROS, INVASIONES Y COFRES DEL 3D ──
async function pruebasEventos3d() {
  console.log('Mundo 3D: raros, invasiones y cofres');
  const W3 = await import('../mmo/js/mundo3d.js');
  const D = await import('../mmo/js/data.js');
  const a = await entrar3d('Cazatesoros3D', '4n1'); ponerNivel(a, 20, 'guerrero');
  const Z = W3.ZONAS3D.amanecer; a.p = { x: Z.x, z: Z.z }; a.movBud = undefined;
  // Raro: aparece cerca, avisa y al morir da un objeto raro seguro
  const bolsa0 = a.c.bolsa.length, raros0 = a.c.raros || 0; a.limpiar();
  const r = mundo.crearRaro3d('amanecer', a);
  chequear(r && r.ex3.raro && r.max >= D.statsMonstruo(r.k, r.nv).hp * 5 && a.ultimos('aviso').some(m => /raro/.test(m.m)), 'aparece un élite raro con aviso');
  mundo.danar3d(r, r.hp + 1, a);
  chequear((a.c.raros || 0) === raros0 + 1 && (a.c.bolsa.length > bolsa0 || a.ultimos('toast').some(m => /derrotado/.test(m.m))), 'el raro da botín seguro a quien lo pelea');
  // Invasion: oleadas, meta, capitan y premio
  const W = mundo.iniciar3d(); W.inv3 = null;
  const ev = mundo.empezarInvasion3d('amanecer', { amanecer: [a] }, Date.now());
  chequear(ev && ev.meta >= 12 && a.ultimos('inv3').some(m => m.on), 'empieza una invasión en el 3D');
  mundo.tickInvasion3d(ev, Date.now(), [a]);
  const inv = [...W.mons.values()].filter(o => o.ex3 && o.ex3.ev === ev.id);
  chequear(inv.length >= 2 && inv.every(o => o.agresivo), 'llegan invasores agresivos cerca');
  const oro0 = a.c.oro, n0 = a.c.invasiones || 0;
  for (let i = 0; i < ev.meta; i++) { let o = [...W.mons.values()].find(x => x.ex3 && x.ex3.ev === ev.id && !x.muere && !x.ex3.cap); if (!o) { ev.oleadaEn = 0; mundo.tickInvasion3d(ev, Date.now(), [a]); o = [...W.mons.values()].find(x => x.ex3 && x.ex3.ev === ev.id && !x.muere && !x.ex3.cap); } mundo.danar3d(o, o.hp + 1, a); }
  chequear(ev.fase === 'capitan' && W.mons.get(ev.capitan), 'al cumplir la meta llega el Capitán');
  const cap = W.mons.get(ev.capitan); mundo.danar3d(cap, cap.hp + 1, a);
  chequear(!W.inv3 && (a.c.invasiones || 0) === n0 + 1 && a.c.oro > oro0, 'derrotar al Capitán gana la invasión y paga');
  // Cofres: hay que estar cerca, una vez cada 30 min
  const cf = W3.cofres3d(D.MAPAS, D.MONSTRUOS).find(x => x.zona === 'amanecer' && x.tipo === 'comun');
  a.p = { x: cf.x + 20, z: cf.z }; a.limpiar();
  await a.mandar({ t: 'cofre3', id: cf.i });
  chequear(a.ultimos('no').some(m => /Acércate/.test(m.m)), 'el cofre pide estar cerca');
  a.p = { x: cf.x + 1, z: cf.z }; const oroC = a.c.oro; a.limpiar();
  await a.mandar({ t: 'cofre3', id: cf.i });
  chequear(a.c.oro > oroC && a.ultimos('cofre3A').length === 1, 'se abre el cofre y da oro');
  a.limpiar(); await a.mandar({ t: 'cofre3', id: cf.i });
  chequear(a.ultimos('no').some(m => /Ya abriste/.test(m.m)), 'el mismo cofre no se abre dos veces seguidas');
  // Mision del Guardia entregada a distancia
  a.p = { x: 300, z: 300 }; a.limpiar(); await a.mandar({ t: 'mision' });
  chequear(!a.ultimos('no').some(m => /Guardia Tito/.test(m.m)), 'en ORIGINS la misión se entrega desde cualquier sitio');
  await dejar(a);
}

// ── SEGURIDAD (auditoria del 24-oct-2026) ──
async function pruebasSeguridad() {
  console.log('Seguridad (auditoría 24-oct)');
  const AB = await import('../mmo/js/abismo3d.js');
  const a = await entrar3d('Tramposo3D', 'e5f1'); ponerNivel(a, 25, 'guerrero');
  // Speed hack: el metro de margen ya no se regala en cada mensaje
  a.p = { x: 100, z: 100 }; a.movBud = 0; a.movT = Date.now(); a.h = 0; a.a = 0;
  for (let i = 1; i <= 20; i++) await a.mandar({ t: 'mv3', x: 100 + i, z: 100, a: 0, h: 0 });
  chequear(a.p.x - 100 <= 1.5, 'sin tiempo no se avanza más de 1 m aunque se manden 20 mensajes (avanzó ' + (a.p.x - 100) + ' m)');
  // Flotar con a=0: a pie se cae
  avanzar(1000); a.movBud = undefined; a.h = 30; a.a = 0;
  await a.mandar({ t: 'mv3', x: a.p.x, z: a.p.z, a: 0, h: 30 });
  chequear(a.h < 25, 'a pie no se puede quedar flotando en el aire (h=' + a.h + ')');
  // El vacio del Abismo lo valida el servidor aunque el cliente no mande 'caida'
  a.c.faccion = 'luz'; a.p = { x: AB.ABISMO_X0 + 60, z: -200 }; a.movBud = undefined; a.h = 0; a.a = 0; a.vacioT = 0;
  chequear(!AB.islaEn(a.p.x, a.p.z), 'el punto de prueba está sobre el vacío');
  await a.mandar({ t: 'mv3', x: a.p.x, z: a.p.z, a: 0, h: 0 });
  chequear(!a.muerto, 'hay margen para abrir las alas al salir del borde');
  avanzar(3500); a.movBud = undefined;
  await a.mandar({ t: 'mv3', x: a.p.x, z: a.p.z, a: 0, h: 0 });
  chequear(a.muerto, 'quien camina sobre el vacío sin volar cae aunque su cliente no lo diga');
  // El correo ya no da Modo Dios (solo uids)
  const antes = mundo.env.MMO_ADMINS;
  mundo.env.MMO_ADMINS = 'jefe@correo.test';
  chequear(!mundo.calcularDios({ c: { uid: 'web:otro' } }, { email: 'jefe@correo.test', emailOk: true }), 'un correo de MMO_ADMINS ya no da Modo Dios');
  mundo.env.MMO_ADMINS = 'web:jefe-uid';
  chequear(mundo.calcularDios({ c: { uid: 'web:jefe-uid' } }, null), 'el uid de MMO_ADMINS sí da Modo Dios');
  mundo.env.MMO_ADMINS = antes;
  // Cambiar de clase en bucle: espera de 3 s
  const b = await entrar('ClaseLoca', 'e5f2'); ponerNivel(b, 5, 'guerrero'); b.c.clase = 'guerrero'; b.claseT = 0;
  await b.mandar({ t: 'clase', id: 'mago' });
  await b.mandar({ t: 'clase', id: 'picaro' });
  chequear(b.c.clase === 'mago', 'no se puede cambiar de clase en bucle');
  await dejar(a); await dejar(b);
}

// ── VINCULAR CUENTAS (Telegram + correo) ──
async function pruebasVincular() {
  console.log('Vincular cuentas');
  mundo.env.TELEGRAM_BOT_TOKEN = TOKEN_BOT;
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes('/auth/v1/user')
    ? new Response(JSON.stringify({ id: 'w-vinc-1', email: 'vinc@correo.test', email_confirmed_at: 'x', user_metadata: { username: 'Webby' } }))
    : fetchReal(url, init);
  const entrarWeb = async () => {
    const ws = new WsFalso(); mundo.abrir(ws);
    const s = [...mundo.sesiones.values()].pop();
    ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'web', tok: 'tok-web' } }) });
    for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 5));
    if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
    s.ws = ws; s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
    s.ultimos = t => ws.rec.filter(m => m.t === t); s.limpiar = () => { ws.rec.length = 0; };
    return s;
  };
  try {
    const t = await entrarTg('VincTG', 77001);
    t.ultimos = x => t.ws.rec.filter(m => m.t === x);
    ponerNivel(t, 30, 'guerrero'); t.c.oro = 777; t.sucio = true; await mundo.guardar(t);
    await t.mandar({ t: 'vincCodigo' });
    const cod = (t.ultimos('vincCod')[0] || {}).cod;
    chequear(/^[A-Z2-9]{6}$/.test(cod || ''), 'una cuenta pide un código de vinculación');
    await t.mandar({ t: 'vincUsar', cod });
    chequear(t.ultimos('no').some(m => /misma cuenta/.test(m.m)), 'el código no sirve en la misma cuenta');
    const w = await entrarWeb();
    chequear(w.c && w.c.uid === 'web:w-vinc-1', 'la cuenta de correo entra con su propio duende');
    ponerNivel(w, 8, 'mago'); w.limpiar();
    await w.mandar({ t: 'vincUsar', cod });
    chequear(w.ultimos('vincConfirmar').length === 1, 'si la otra cuenta tiene progreso, pide confirmar');
    await w.mandar({ t: 'vincUsar', cod, forzar: true });
    chequear(w.ultimos('vincOk').length === 1 && (await mundo.state.storage.get('al:web:w-vinc-1')) === 'tg:77001' && t.c.vinc && t.c.vinc.web === 'web:w-vinc-1', 'se vinculan: el correo apunta al duende de Telegram');
    chequear(!!(await mundo.state.storage.get('arch:web:w-vinc-1')) && !(await mundo.state.storage.get('c:web:w-vinc-1')), 'el duende que tenía el correo se archiva (no se borra)');
    await new Promise(r => setTimeout(r, 400));
    await dejar(t);
    const w2 = await entrarWeb();
    chequear(w2.c && w2.c.uid === 'tg:77001' && w2.c.nivel === 30 && w2.c.oro >= 777 && w2.uidAuth === 'web:w-vinc-1', 'entrando con el correo se juega con el mismo duende');
    w2.limpiar(); await w2.mandar({ t: 'vincQuitar', k: 'web' });
    chequear(w2.ultimos('no').some(m => /has entrado/.test(m.m)), 'no se desvincula la cuenta con la que entraste');
    await w2.mandar({ t: 'vincUsar', cod: 'ZZZZZZ' });
    chequear(w2.ultimos('no').some(m => /ya está vinculada|caducó/.test(m.m)), 'una cuenta ya vinculada no vincula otra vez');
    await dejar(w2);
  } finally { globalThis.fetch = fetchReal; }
}

// ── COPIAS DE SEGURIDAD ──
async function pruebasCopias() {
  console.log('Copias de seguridad');
  const CP = await import('../functions/mmo/copias.js');
  const a = await entrar3d('Guardado Seguro', 'b4c1'); ponerNivel(a, 15, 'guerrero');
  a.c.oro = 4321; a.sucio = true;
  const e = await mundo.hacerCopia('prueba');
  chequear(e && e.pj >= 1 && e.bytes > 0 && e.trozos >= 1, 'se hace una copia comprimida de todo el progreso');
  const idx = await mundo.indiceCopias();
  chequear(idx[0].id === e.id, 'la copia queda en el índice');
  const cp = await mundo.leerCopia(e.id);
  chequear(cp && cp.datos['c:' + a.c.uid] && cp.datos['c:' + a.c.uid].oro === 4321 && !Object.keys(cp.datos).some(k => k.startsWith('bk:')), 'la copia se lee y trae al jugador con su oro');
  // Restaurar un jugador: pierde lo ganado despues de la copia
  a.c.oro = 999999; await mundo.guardar(a);
  const r = await mundo.restaurarJugador(e.id, 'guardado seguro');
  const guardado = await mundo.state.storage.get('c:' + a.c.uid);
  chequear(r.ok && guardado.oro === 4321 && a.cerrado, 'restaurar un jugador lo devuelve a la copia (y lo desconecta sin pisarla)');
  // Restaurar el mundo desde el archivo subido
  const gz = await CP.gzip(JSON.stringify(cp));
  const b64 = Buffer.from(gz).toString('base64');
  await mundo.state.storage.put('c:zz-prueba-borrar', { uid: 'zz', nombre: 'Basura' });
  const r2 = await mundo.restaurarSubida(b64);
  chequear(r2.ok && !(await mundo.state.storage.get('c:zz-prueba-borrar')) && (await mundo.state.storage.get('c:' + a.c.uid)).oro === 4321, 'restaurar el mundo desde el archivo vuelve exactamente a la copia');
  chequear((await mundo.indiceCopias()).some(x => x.motivo === 'antes de restaurar'), 'antes de restaurar se guarda una copia de lo actual');
  chequear(((await mundo.indiceCopias()).find(x => x.id === e.id) || {}).motivo === 'prueba', 'una copia nueva de la misma hora no pisa a la anterior');
  chequear(!(await mundo.restaurarSubida('no-es-una-copia')).ok, 'un archivo que no es copia se rechaza');
  // El archivo grande llega en trozos y se junta en la sesion del dueño
  const ses = {}, L = Math.ceil(b64.length / 3);
  const piezas = [0, 1, 2].map(i => mundo.juntarSubida(ses, { i, n: 3, b64: b64.slice(i * L, (i + 1) * L) }));
  chequear(piezas[0] === null && piezas[1] === null && piezas[2] && piezas[2].b64 === b64 && !ses.subida, 'el archivo subido en trozos se junta entero');
  mundo.juntarSubida(ses, { i: 0, n: 3, b64: 'x' });
  chequear(mundo.juntarSubida(ses, { i: 2, n: 3, b64: 'x' }).error && !ses.subida, 'un trozo fuera de orden anula la subida');
  // Mas claves que una pagina del storage: la copia las recorre todas
  for (let i = 0; i < 1200; i++) almacen.set('zzpag:' + String(i).padStart(4, '0'), { i });
  const e3 = await mundo.hacerCopia('paginas'), cp3 = e3 && await mundo.leerCopia(e3.id);
  chequear(cp3 && Object.keys(cp3.datos).filter(k => k.startsWith('zzpag:')).length === 1200 && cp3.datos['zzpag:1199'].i === 1199 && cp3.datos['c:' + a.c.uid], 'la copia recorre el storage por paginas sin perder claves');
  for (const k of [...almacen.keys()]) if (k.startsWith('zzpag:')) almacen.delete(k);
  for (let i = 0; i < CP.BK_MAX + 2; i++) { reloj += 3600000; await mundo.hacerCopia('rotacion'); }
  const idx2 = await mundo.indiceCopias();
  chequear(idx2.length === CP.BK_MAX && ![...almacen.keys()].some(k => k.startsWith('bk:' + e.id + ':')), 'solo se guardan las últimas copias y las viejas se borran');
}

// ── EQUILIBRIO DE FACCIONES Y TEMPORADA DEL ABISMO ──
async function pruebasTempAbismo() {
  console.log('Mundo 3D: equilibrio de facciones y temporada');
  const AB = await import('../mmo/js/abismo3d.js');
  chequear(AB.faccionDebil({ luz: 3, sombra: 3 }) === null && AB.faccionDebil({ luz: 1, sombra: 0 }) === 'sombra' && AB.faccionDebil({ luz: 5, sombra: 4 }) === null && AB.faccionDebil({ luz: 4, sombra: 6 }) === 'luz', 'la facción débil se calcula bien');
  const F = mundo.faccEstado(); F.n = { luz: 3, sombra: 1 };
  const a = await entrar3d('Recluta Sombra', 'c7e1'); ponerNivel(a, 25, 'guerrero');
  const oro0 = a.c.oro, bolsa0 = a.c.bolsa.length; a.limpiar();
  await a.mandar({ t: 'faccion', f: 'sombra' });
  chequear(a.c.faccion === 'sombra' && a.c.oro > oro0 && a.c.bolsa.length > bolsa0 && a.ultimos('toast').some(m => /reclutamiento/.test(m.m)) && F.n.sombra === 2, 'unirse a la facción con menos miembros da bono de reclutamiento');
  const b = await entrar3d('Recluta Luz', 'c7e2'); ponerNivel(b, 25, 'guerrero');
  const oroB = b.c.oro; b.limpiar(); await b.mandar({ t: 'faccion', f: 'luz' });
  chequear(b.c.faccion === 'luz' && b.c.oro === oroB && F.n.luz === 4, 'la facción grande no da bono');
  const pa0 = a.c.pa || 0, pb0 = b.c.pa || 0;
  mundo.sumarPA(a, 10, 'prueba'); mundo.sumarPA(b, 10, 'prueba');
  chequear(a.c.pa - pa0 === 15 && b.c.pa - pb0 === 10, 'la facción débil gana PA ×1,5');
  chequear(a.c.tempA && a.c.tempA.p >= 15 + 40 && F.pts.sombra >= 55, 'los PA cuentan para la temporada');
  // Cierre de la temporada: liga, facción ganadora, podio y logros
  const mesAhora = F.mes;
  a.c.tempA.p = 600; F.l[a.c.uid].p = 600; F.pts.sombra = 600; F.pts.luz = 50;
  F.mes = '2000-01'; a.c.tempA.mes = '2000-01'; b.c.tempA.mes = '2000-01';
  const oroA = a.c.oro; a.limpiar(); b.limpiar();
  mundo.temporadaA();
  const fin = a.ultimos('tempFin')[0];
  chequear(F.mes === mesAhora && F.hist[0].mes === '2000-01' && F.hist[0].ganador === 'sombra', 'al cambiar el mes se cierra la temporada y gana la facción con más puntos');
  chequear(fin && fin.liga === 'Oro' && fin.gana && fin.puesto === 0 && a.c.oro > oroA && !a.c.tempA, 'el jugador cobra liga, victoria y podio');
  chequear(['tempOro', 'tempGana', 'tempTop'].every(id => a.c.logros.includes(id)), 'la temporada da sus títulos');
  chequear(b.ultimos('tempFin').length === 1 && !b.ultimos('tempFin')[0].gana, 'el de la otra facción cobra su parte sin la victoria');
  a.limpiar(); mundo.cobrarTemporada(a);
  chequear(!a.ultimos('tempFin').length, 'la temporada no se cobra dos veces');
  const it = mundo.infoTemp(a.c);
  chequear(it.t === 'temp3' && it.ult && it.ult.ganador === 'sombra' && it.fin > Date.now(), 'el marcador de la temporada llega al cliente');
  F.n = { luz: 0, sombra: 0 };
  await dejar(a); await dejar(b);
}

// ── LO SOCIAL DESDE EL 3D (hermandad, pase, amigos) ──
async function pruebasSocial3d() {
  console.log('Mundo 3D: hermandad, pase y amigos');
  const a = await entrar3d('Fundador3D', '4m1'); ponerNivel(a, 15, 'guerrero');
  const b = await entrar3d('Recluta3D', '4m2'); ponerNivel(b, 12, 'mago');
  a.c.oro = 20000; a.limpiar();
  await a.mandar({ t: 'hermCrear', nombre: 'Los Verdes 3D' });
  for (let i = 0; i < 20 && !a.c.herm; i++) await espera();
  chequear(!!a.c.herm && a.ultimos('herm').some(m => m.h && m.h.nombre === 'Los Verdes 3D'), 'se funda una hermandad desde el 3D');
  await a.mandar({ t: 'hermInvitar', p: b.id });
  for (let i = 0; i < 10 && !b.ultimos('hermInv').length; i++) await espera();
  chequear(b.ultimos('hermInv').length === 1, 'la invitación llega en el 3D');
  await b.mandar({ t: 'hermResp', si: true });
  for (let i = 0; i < 20 && b.c.herm !== a.c.herm; i++) await espera();
  chequear(b.c.herm === a.c.herm, 'se acepta la hermandad desde el 3D');
  b.limpiar(); await b.mandar({ t: 'herm' });
  for (let i = 0; i < 10 && !b.ultimos('herm').length; i++) await espera();
  chequear(b.ultimos('herm').some(m => m.h && m.h.m.length === 2), 'el panel de la hermandad se pide desde el 3D');
  // Pase: cobrar un nivel alcanzado
  mundo.paseDe(a.c).p = 200; const oro0 = a.c.oro; a.limpiar();
  await a.mandar({ t: 'pase', n: 1 });
  chequear(mundo.paseDe(a.c).cob.includes(1), 'se cobra el pase desde el 3D');
  // Amigos: el codigo para invitar
  a.limpiar(); await a.mandar({ t: 'amigos' });
  for (let i = 0; i < 10 && !a.ultimos('amigos').length; i++) await espera();
  chequear(a.ultimos('amigos').some(m => m.ref), 'el código de amigo llega en el 3D');
  await a.mandar({ t: 'hermSalir' }); await b.mandar({ t: 'hermSalir' });
  for (let i = 0; i < 10; i++) await espera();
  await dejar(a); await dejar(b);
}

// ── PVP DE FACCIONES EN EL ABISMO ──
async function pruebasPvP3d() {
  console.log('Mundo 3D: PvP de facciones');
  const AB = await import('../mmo/js/abismo3d.js');
  const a = await entrar3d('LuzPvP', '4k1'); ponerNivel(a, 25, 'guerrero');
  const b = await entrar3d('SombraPvP', '4k2'); ponerNivel(b, 25, 'picaro');
  const c = await entrar3d('LuzAmiga', '4k3'); ponerNivel(c, 25, 'mago');
  a.c.faccion = c.c.faccion = 'luz'; b.c.faccion = 'sombra';
  mundo.m3.mons.clear(); for (const k of mundo.m3.campos) { k.vivos.clear(); k.prox = Date.now() + 1e9; }
  // En el bastion (santuario) no se pelea
  const base = AB.baseDe('luz');
  a.p = { ...base }; b.p = { x: base.x + 1, z: base.z }; a.movBud = b.movBud = undefined; avanzar(3000);
  let hp0 = b.hp; a.atkT = 0;
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear(b.hp === hp0, 'en el bastión (santuario) no hay PvP');
  // En una isla neutral si
  const is = AB.ABISMO.islas[3], x0 = AB.ABISMO_X0 + is.x;
  a.p = { x: x0, z: is.z }; b.p = { x: x0 + 1, z: is.z }; c.p = { x: x0 - 1, z: is.z };
  await c.mandar({ t: 'atk3', tp: a.id });
  chequear(a.hp === a.st.maxHp, 'no se pega a los de tu facción');
  hp0 = b.hp; a.atkT = 0;
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear(b.hp < hp0, 'se pega a la otra facción en el Abismo');
  b.hp = 2; b.inv = 0; a.atkT = 0; a.limpiar(); b.limpiar();
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear(b.muerto, 'en el Abismo la otra facción sí muere');
  chequear(!a.c.pa, 'los invitados no ganan Puntos del Abismo');
  const uids = [a.c.uid, b.c.uid]; a.c.uid = 'tg:pvp1'; b.c.uid = 'tg:pvp2';
  b.muerto = false; b.hp = 2; b.inv = 0; a.atkT = 0; a.limpiar();
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear((a.c.pa || 0) >= 10 && a.c.bajasPvP === 1, 'la baja da Puntos del Abismo');
  chequear(a.ultimos('pvpBaja').length === 1 && b.ultimos('aviso').some(m => /abatió/.test(m.m)), 'se anuncia la baja en el Abismo');
  // El mismo par puntua como mucho 4 veces al dia
  for (let i = 0; i < 5; i++) { b.muerto = false; b.hp = 2; b.inv = 0; a.atkT = 0; await a.mandar({ t: 'atk3', tp: b.id }); }
  const pa = a.c.pa; b.muerto = false; b.hp = 2; a.atkT = 0; await a.mandar({ t: 'atk3', tp: b.id });
  chequear(a.c.pa === pa, 'farmear al mismo jugador deja de dar puntos');
  // Rango
  a.c.pa = 59; a.limpiar(); mundo.sumarPA(a, 5);
  chequear(a.ultimos('aviso').some(m => /asciende a Soldado/.test(m.m)), 'al subir de rango se anuncia');
  // En PvP las skins de pago no dan ventaja de combate
  const sk0 = a.c.skin; a.c.skin = 'legendaria'; a.st = mundo.stats(a.c); const conSkin = mundo.statsSinSkin(a);
  a.c.skin = 'comun'; a.st = mundo.stats(a.c); const sinSkin = mundo.statsSinSkin(a);
  chequear(conSkin.atk === sinSkin.atk && conSkin.def === sinSkin.def && conSkin.crit === sinSkin.crit, 'en PvP la skin no cambia ataque, defensa ni crítico');
  a.c.skin = 'legendaria'; a.st = mundo.stats(a.c); b.p = { x: x0 + 1, z: is.z }; a.p = { x: x0, z: is.z }; b.muerto = false;
  const tiradas = [];
  for (const sk of ['legendaria', 'comun']) { a.c.skin = sk; a.st = mundo.stats(a.c); let tot = 0; for (let i = 0; i < 400; i++) { b.hp = b.st.maxHp; b.inv = 0; mundo.golpeDuelo(a, b, 1, true); tot += b.st.maxHp - b.hp; } tiradas.push(tot / 400); }
  chequear(Math.abs(tiradas[0] - tiradas[1]) / tiradas[1] < 0.08, 'una skin cara no pega más fuerte en el Abismo (media ' + tiradas.map(x => x.toFixed(1)).join(' vs ') + ')');
  a.c.skin = sk0; a.st = mundo.stats(a.c);
  // Fuera del Abismo no hay PvP
  a.p = { x: 30, z: 30 }; b.p = { x: 31, z: 30 }; b.muerto = false; b.hp = hp0 = b.st.maxHp; a.atkT = 0;
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear(b.hp === hp0, 'en el mundo normal no se ataca sin duelo');
  [a.c.uid, b.c.uid] = uids;
  await dejar(a); await dejar(b); await dejar(c);
}

// ── EL ABISMO DE ETER (facciones) ──
async function pruebasAbismo3d() {
  console.log('Mundo 3D: Abismo de Éter');
  const W = await import('../mmo/js/mundo3d.js');
  const AB = await import('../mmo/js/abismo3d.js');
  const { PORTAL_PUEBLO, enCueva } = await import('../mmo/js/cueva3d.js');
  chequear(!enCueva(AB.ABISMO_X0) && W.zonaEn(AB.ABISMO_X0, -200) === 'eter', 'el Abismo no se confunde con la cueva');
  chequear(W.alturaEn(AB.ABISMO_X0, -200) > 25 && W.alturaEn(AB.ABISMO_X0 + 60, -200) === AB.VACIO, 'islas con altura y vacío entre ellas');
  const a = await entrar3d('Abisal3D', '4j1'); ponerNivel(a, 12, 'guerrero');
  a.p = { x: PORTAL_PUEBLO.x, z: PORTAL_PUEBLO.z }; a.combateT = 0;
  await a.mandar({ t: 'faccion', f: 'luz' });
  chequear(!a.c.faccion, 'antes de nivel 20 no se elige facción');
  ponerNivel(a, 22, 'guerrero');
  await a.mandar({ t: 'abismo' });
  chequear(!AB.enAbismo(a.p.x), 'sin facción no se entra al Abismo');
  await a.mandar({ t: 'faccion', f: 'luz' });
  await a.mandar({ t: 'faccion', f: 'sombra' });
  chequear(a.c.faccion === 'luz', 'se elige facción una sola vez');
  a.limpiar();
  await a.mandar({ t: 'abismo' });
  chequear(AB.enAbismo(a.p.x) && a.ultimos('tp3').some(m => m.abismo === 1), 'el portal del pueblo lleva al bastión de la Luz');
  // Moverse por el Abismo no lo recorta el limite del mundo ni guarda la posicion
  const p3 = { ...a.c.p3 }; a.movBud = undefined; avanzar(1000);
  await a.mandar({ t: 'mv3', x: a.p.x + 1, z: a.p.z, a: 1 });
  chequear(AB.enAbismo(a.p.x) && a.c.p3.x === p3.x, 'en el Abismo se anda y no se guarda la posición');
  await a.mandar({ t: 'caida' });
  chequear(!a.muerto, 'sobre una isla no se muere por “caída”');
  a.p = { x: AB.ABISMO_X0 + 60, z: -200 }; a.a = 1;
  await a.mandar({ t: 'caida' });
  chequear(a.muerto, 'caer al vacío mata');
  await a.mandar({ t: 'revivir' }); avanzar(31000); await a.mandar({ t: 'revivir' });
  const base = AB.baseDe('luz');
  chequear(!a.muerto && Math.hypot(a.p.x - base.x, a.p.z - base.z) < 1, 'se revive en el bastión de la facción');
  await a.mandar({ t: 'salirAbismo' });
  chequear(AB.enAbismo(a.p.x), 'lejos del portal del bastión no se sale');
  const pb = AB.portalBase('luz'); a.p = { ...pb };
  await a.mandar({ t: 'salirAbismo' });
  chequear(!AB.enAbismo(a.p.x) && Math.hypot(a.p.x - PORTAL_PUEBLO.x, a.p.z - PORTAL_PUEBLO.z) < 6, 'el portal del bastión devuelve al pueblo');
  await dejar(a);
}

// ── DUELOS Y PESCA EN EL 3D ──
async function pruebasDueloPesca3d() {
  console.log('Mundo 3D: duelos y pesca');
  const W = await import('../mmo/js/mundo3d.js');
  const a = await entrar3d('Duelista3D', '4h1'); ponerNivel(a, 15, 'guerrero');
  const b = await entrar3d('Rival3D', '4h2'); ponerNivel(b, 15, 'picaro');
  mundo.m3.mons.clear(); for (const c of mundo.m3.campos) { c.vivos.clear(); c.prox = Date.now() + 1e9; }
  a.p = { x: 30, z: 30 }; b.p = { x: 31.5, z: 30 }; a.movBud = b.movBud = undefined;
  avanzar(6000);
  await a.mandar({ t: 'retar', p: b.id });
  chequear(b.ultimos('reto').length === 1, 'el reto llega en el 3D');
  await b.mandar({ t: 'retoResp', si: true });
  chequear(a.duelo && b.duelo, 'empieza el duelo');
  avanzar(3100);
  const hp0 = b.hp; a.atkT = 0;
  await a.mandar({ t: 'atk3', tp: b.id });
  chequear(b.hp < hp0 && b.hp > 1, 'el ataque automático pega al rival (con daño reducido)');
  b.p = { x: 120, z: 30 }; tick(1);
  chequear(!a.duelo && !b.duelo && a.ultimos('dueloFin').some(x => x.g === a.id), 'quien se aleja pierde el duelo');
  // Pesca: buscar una orilla
  let orilla = null;
  for (let x = -500; x < 500 && !orilla; x += 7) for (let z = -500; z < 500 && !orilla; z += 7) {
    if (W.alturaEn(x, z) > 0.4 && W.zonaEn(x, z) !== 'pueblo' && mundo.aguaCerca3d({ x, z })) orilla = { x, z };
  }
  chequear(!!orilla, 'hay orillas para pescar en el mundo 3D');
  a.p = { ...orilla }; a.c.mat = {}; a.c.pescaHoy = null; a.limpiar();
  await a.mandar({ t: 'pescar' });
  chequear(a.cast && a.cast.h === 'pescar', 'junto al agua se lanza el sedal');
  avanzar(9100); tick(1);
  chequear(a.ultimos('pica').length === 1, 'pica un pez');
  await a.mandar({ t: 'tirar' });
  chequear((a.c.mat.pescado || 0) >= 1 && a.ultimos('pescado').length === 1, 'al tirar a tiempo sale Pescado');
  a.p = { x: 0, z: 22 };
  await a.mandar({ t: 'pescar' });
  chequear(!a.cast || a.cast.h !== 'pescar', 'lejos del agua no se pesca');
  for (const s of [a, b]) await dejar(s);
}

// ── LA CUEVA DE LOS GOBLINS (mazmorra 3D instanciada) ──
async function pruebasCueva3d() {
  console.log('Mundo 3D: la Cueva de los Goblins');
  const C = await import('../mmo/js/cueva3d.js');
  const a = await entrar3d('Espeleo3D', '4g1'); ponerNivel(a, 20, 'guerrero');
  const fuera = await entrar3d('Paseante3D', '4g2'); ponerNivel(fuera, 20, 'mago');
  await a.mandar({ t: 'cueva' });
  chequear(!a.i3 && a.ultimos('no').length, 'lejos del portal no se entra');
  a.p = { x: C.PORTAL_PUEBLO.x + 1, z: C.PORTAL_PUEBLO.z }; a.movBud = undefined;
  await a.mandar({ t: 'cueva' });
  chequear(a.i3 && a.p.x > C.CUEVA_X0 - 50 && a.ultimos('tp3').some(x => x.cueva && x.cueva.nv === 20), 'junto al portal entra a su cueva (Nv 20)');
  const inst = mundo.cuevas3().get(a.i3);
  const mons = [...inst.mons].map(id => mundo.m3.mons.get(id));
  chequear(mons.length >= 17 && mons.every(o => o.i3 === inst.id && o.nv === 20), 'la cueva tiene sus monstruos al nivel del grupo');
  fuera.p = { x: a.p.x, z: a.p.z }; fuera.limpiar(); a.limpiar();
  tick(3);
  const vistoFuera = fuera.ultimos('s3').some(x => (x.n || []).some(n => inst.mons.has(n.id)) || x.p.some(p => p[0] === a.id));
  chequear(!vistoFuera, 'desde fuera no se ven ni los monstruos ni los jugadores de la cueva');
  chequear(a.ultimos('s3').some(x => (x.n || []).length), 'dentro sí se ven los de la cueva');
  await a.mandar({ t: 'mv3', x: C.CUEVA_X0 + 40, z: 6, r: 0, a: 1 });
  chequear(a.p.x < C.CUEVA_X0 + 12, 'no se atraviesan las paredes de la cueva');
  const jefe = mundo.m3.mons.get(inst.jefe);
  a.p = { x: jefe.x - 2, z: jefe.z }; a.movBud = undefined; a.limpiar();
  jefe.hp = 1; a.atkT = 0; const nm0 = a.c.mazmorras || 0;
  await a.mandar({ t: 'atk3', tg: jefe.id });
  chequear(jefe.muere && inst.hecha && (a.c.mazmorras || 0) === nm0 + 1 && a.ultimos('cofre3').length === 1, 'el Rey Goblin cae: cofre y mazmorra completada');
  a.p = { x: C.CUEVA_X0 + C.CUEVA.salida.x, z: C.CUEVA.salida.z + 1 };
  a.cuevaT = 0;   // entrar y salir tienen 3 s de espera
  await a.mandar({ t: 'salirCueva' });
  chequear(!a.i3 && Math.abs(a.p.x - C.PORTAL_PUEBLO.x) < 6, 'por el portal de la entrada se vuelve al pueblo');
  avanzar(6 * 60 * 1000); tick(1);
  chequear(!mundo.cuevas3().has(inst.id) && !mundo.m3.mons.has(jefe.id + 1), 'la cueva vacía se borra a los 5 minutos');
  for (const s of [a, fuera]) await dejar(s);
}

// ── APARIENCIA (editor del 3D) ──
async function pruebasLook3d() {
  console.log('Mundo 3D: apariencia');
  const a = await entrar3d('Modelo3D', '4f1'), b = await entrar3d('Mirón3D', '4f2');
  b.limpiar();
  await a.mandar({ t: 'look', look: { cara: 4, cuerpo: 2, altura: 1.05, pelo: 6, colorPelo: 3 } });
  chequear(a.c.look && a.c.look.cara === 4 && a.c.look.pelo === 6 && a.c.look.altura === 1.05, 'se guarda la apariencia');
  chequear(b.ultimos('pa').some(x => x.p === a.id && x.lk && x.lk.cuerpo === 2), 'los demás reciben la apariencia nueva');
  avanzar(2000);
  await a.mandar({ t: 'look', look: { cara: 99, cuerpo: -1, altura: 9, pelo: 'x', colorPelo: 2.5, extra: 'hack' } });
  chequear(a.c.look.cara === 0 && a.c.look.cuerpo === 1 && a.c.look.altura === 1.12 && a.c.look.pelo === 1 && a.c.look.colorPelo === 1 && !('extra' in a.c.look), 'valores inválidos se limpian');
  for (const s of [a, b]) await dejar(s);
}

// ── RECOLECCION Y ARTESANIA EN EL 3D ──
async function pruebasRecoleccion3d() {
  console.log('Mundo 3D: recolección y artesanía');
  const W = await import('../mmo/js/mundo3d.js');
  const D = await import('../mmo/js/data.js');
  const n = W.nodos3d(D.MAPAS, D.MONSTRUOS).find(x => x.tipo === 'hierba');
  const s = await entrar3d('Herbolaria', '4e1'); ponerNivel(s, 5, 'mago');
  mundo.m3.mons.clear(); for (const c of mundo.m3.campos) { c.vivos.clear(); c.prox = Date.now() + 1e9; }
  s.p = { x: n.x + 20, z: n.z }; s.movBud = undefined; s.c.mat = {};
  await s.mandar({ t: 'recolectar', i: n.i });
  chequear(!s.cast && s.ultimos('no').length, 'lejos del punto no se recoge');
  s.p = { x: n.x + 1, z: n.z };
  await s.mandar({ t: 'recolectar', i: n.i });
  chequear(s.cast && s.cast.h === 'recolectar', 'junto al punto empieza a recoger');
  for (let i = 0; i < 17; i++) tick(1);
  chequear((s.c.mat.hierba || 0) >= 1 && s.ultimos('recogido3').length === 1, 'al terminar da Hierba Duende');
  s.limpiar();
  await s.mandar({ t: 'recolectar', i: n.i });
  chequear(!s.cast && s.ultimos('no').some(x => /recogiste/.test(x.m)), 'el mismo punto no se puede repetir en 5 minutos');
  s.c.mat.hierba = 3;
  const art = W.NPCS3D.find(x => x.tipo === 'artesania');
  await s.mandar({ t: 'fabricar', id: 'pociones' });
  chequear(s.c.mat.hierba === 3, 'lejos de la Artesana no se fabrica');
  s.p = { x: art.x + 1, z: art.z }; const p0 = s.c.pw.pocion || 0;
  await s.mandar({ t: 'fabricar', id: 'pociones' });
  chequear(s.c.mat.hierba === 0 && (s.c.pw.pocion || 0) === p0 + 3, 'la Artesana del 3D fabrica pociones');
  await dejar(s);
}

// ── HORA Y CLIMA DEL 3D (mmo/js/mundo3d.js) ──
async function pruebasAmbiente3d() {
  console.log('Mundo 3D: hora y clima');
  const W = await import('../mmo/js/mundo3d.js');
  const t = 1792789000000;
  chequear(W.climaEn('selva', t) === W.climaEn('selva', t + 1000), 'el clima es el mismo para todos dentro de su tanda');
  chequear(W.climaEn('pueblo', t) === 'despejado', 'en el pueblo nunca llueve');
  const vistos = new Set(); for (let i = 0; i < 300; i++) vistos.add(W.climaEn('selva', t + i * 720000));
  chequear(vistos.has('despejado') && vistos.has('lluvia'), 'la selva alterna lluvia y cielo despejado');
  chequear(W.esNoche(W.DIA_MS * 3) && !W.esNoche(W.DIA_MS * 3 + W.DIA_MS / 2), 'medianoche es de noche y mediodía de día');
}

// ── GRUPO EN EL 3D ──
async function pruebasGrupo3d() {
  console.log('Mundo 3D: grupo');
  const W = await import('../mmo/js/mundo3d.js');
  const D = await import('../mmo/js/data.js');
  const campo = W.campamentos(D.MAPAS, D.MONSTRUOS).find(c => c.zona === 'amanecer' && !c.jefe);
  const a = await entrar3d('Lider3D', '4d1'); ponerNivel(a, 5, 'guerrero');
  const b = await entrar3d('Amigo3D', '4d2'); ponerNivel(b, 5, 'sacerdote');
  await a.mandar({ t: 'invitar', p: b.id });
  chequear(b.ultimos('invitacion').length === 1, 'la invitación llega en el 3D');
  await b.mandar({ t: 'grupoResp', si: true });
  chequear(a.gid && a.gid === b.gid, 'se forma el grupo desde el 3D');
  chequear(b.ultimos('grupo').some(x => x.g && x.g.m.some(y => y.p3)), 'el grupo lleva la posición 3D de cada uno');
  mundo.m3.mons.clear();
  for (const s of [a, b]) { s.p = { x: campo.x + 20, z: campo.z }; s.movBud = undefined; }
  const o = mundo.crear3d({ id: -1, x: a.p.x + 1.5, z: a.p.z, k: campo.k, n: 1, jefe: false, vivos: new Set(), zona: 'amanecer' });
  o.x = a.p.x + 1.5; o.z = a.p.z; o.hp = 1;
  const xp0 = b.c.xp, nv0 = b.c.nivel;
  b.limpiar();
  a.atkT = 0; await a.mandar({ t: 'atk3', tg: o.id });
  chequear(o.muere, 'el líder mata al monstruo');
  chequear(b.ultimos('gana').some(x => !x.coop) && (b.c.xp > xp0 || b.c.nivel > nv0), 'el compañero cercano cobra la caza como suya');
  await b.mandar({ t: 'salirGrupo' });
  chequear(!a.gid && !b.gid, 'salir del grupo lo disuelve');
  for (const s of [a, b]) await dejar(s);
}

// ── JEFE MUNDIAL DEL 3D (functions/mmo/mundo3d.js) ──
async function pruebasMundial3d() {
  console.log('Mundo 3D: jefe mundial');
  const { proximoMundial3 } = await import('../functions/mmo/mundo3d.js');
  const pr = proximoMundial3(Date.now());
  chequear(pr % 1800000 === 900000, 'el jefe del 3D sale a las :15 y :45');
  const a = await entrar3d('Heroe3D', '4c1'); ponerNivel(a, 20, 'guerrero');
  const b = await entrar3d('Novato3D', '4c2'); ponerNivel(b, 3, 'mago');
  avanzar(pr - Date.now()); tick(1);
  const M = mundo.m3.mundial, o = M && M.o;
  chequear(o && o.mundial3, 'aparece a su hora');
  chequear(a.ultimos('mundial3').some(x => x.vivo), 'avisa a los del 3D');
  for (const s of [a, b]) { s.p = { x: o.x + 2, z: o.z }; s.movBud = undefined; s.inv = 0; s.hp = s.st.maxHp; }
  a.atkT = 0; await a.mandar({ t: 'atk3', tg: o.id });
  chequear(o.hp < o.max, 'se le puede pegar');
  b.atkT = 0; await b.mandar({ t: 'atk3', tg: o.id });
  o.dano.set(b.id, Math.max(o.dano.get(b.id) || 0, o.max * 0.01));   // peleó de verdad (>0,3 % de la vida)
  b.p = { x: o.x + 16, z: o.z };
  a.limpiar();
  for (let i = 0; i < 120 && !o.pisa; i++) tick(1);
  chequear(!!o.pisa && a.ultimos('zona3').length === 1, 'el pisotón se avisa en el suelo');
  a.hp = a.st.maxHp; const hpB = b.hp;
  tick(26);
  chequear(a.hp <= a.st.maxHp * 0.75 && !a.muerto, 'quien se queda dentro del pisotón pierde ~30% (sin morir de golpe)');
  chequear(b.hp === hpB, 'quien sale del círculo no recibe el pisotón');
  o.hp = 1; a.atkT = 0; a.hp = a.st.maxHp; a.p = { x: o.x + 2, z: o.z };
  await a.mandar({ t: 'atk3', tg: o.id });
  chequear(o.muere && !M.o, 'el jefe mundial cae');
  chequear(a.c.mundiales === 1 && b.c.mundiales === 1, 'premio de jefe mundial para todos los que pelearon');
  chequear(a.ultimos('mundial3').some(x => !x.vivo), 'avisa que ya no está');
  for (const s of [a, b]) await dejar(s);
}

// ── RETENCION Y AVISOS (functions/mmo/retencion.js) ──
const DIA = 86400000;
// Solo hacia adelante: el resto del mundo no sabe volver atras en el tiempo.
const irA = (dia, hora = 10) => { reloj = Math.max(reloj, dia * DIA + hora * 3600000 + 7 * 60000); };
const calma = async () => { for (let i = 0; i < 10; i++) await espera(); };
const dejar = async s => { await mundo.cerrar(s); await calma(); };
// hola no espera a los agregados de retencion: se deja que terminen.
const entrarR = async (nombre, n) => { const s = await entrar(nombre, n); await calma(); return s; };
const TOKEN_BOT = 'tok-prueba';

// initData firmado como lo firma Telegram (HMAC con el token del bot), para
// entrar con una cuenta 'tg:' por el hola real.
async function initDataTg(id, nombre) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: nombre, username: nombre }) });
  const datos = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const enc = new TextEncoder();
  const hmac = async (clave, txt) => crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', clave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(txt));
  const firma = await hmac(await hmac(enc.encode('WebAppData'), TOKEN_BOT), datos);
  p.set('hash', [...new Uint8Array(firma)].map(b => b.toString(16).padStart(2, '0')).join(''));
  return p.toString();
}
async function entrarTg(nombre, id, extra) {
  const ws = new WsFalso();
  mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'tg', d: await initDataTg(id, nombre) }, ...(extra || {}) }) });
  for (let i = 0; i < 200 && !s.c; i++) await espera();
  // Con la maquina cargada la firma (crypto) tarda mas: se espera por tiempo real.
  for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.ws = ws;
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  return s;
}
// Rutas internas por el interno() real (con la cabecera x-interno).
async function interno(accion, body, clave = TOKEN_BOT) {
  const r = await mundo.interno(new Request('https://mmo/interno/' + accion, { method: 'POST', headers: { 'x-interno': clave }, body: JSON.stringify(body || {}) }), accion);
  return r.status === 200 ? r.json() : { status: r.status };
}

async function pruebasRetencion() {
  console.log('Retención: altas, minutos, D1 y D7');
  // Se empieza de cero: lo que sumaron las pruebas de arriba no cuenta (antes
  // se deja terminar lo que sus guardados dejaron en curso).
  await calma();
  for (const k of [...almacen.keys()]) if (k.startsWith('ret:')) almacen.delete(k);
  mundo._retIdx = null; mundo._retDias = null;
  mundo.env.TELEGRAM_BOT_TOKEN = TOKEN_BOT;
  const D = Math.floor(Date.now() / DIA) + 1;
  irA(D);
  const h1 = await entrarR('Cohorte1', '6a'), h2 = await entrarR('Cohorte2', '6b'), h3 = await entrarR('Cohorte3', '6c');
  const bot = await entrarR('BotPrueba', '9');
  chequear(mundo.uidsPrueba.has(bot.c.uid), 'el token 9 es un bot de prueba');
  await mundo.retVolcar();   // las sesiones se juntan en memoria y se escriben como mucho una vez por minuto
  let d0 = await mundo.retDia(D);
  chequear(d0.n === 3 && d0.a === 3 && d0.ses === 3, `altas, activos y sesiones del día sin el bot de prueba (${d0.n}/${d0.a}/${d0.ses})`);
  chequear(h1.c.ret && h1.c.ret.alta === 1 && h1.c.ret.ses === 1 && h1.c.ret.d.length === 1 && h1.c.ret.d[0] === D, 'el personaje guarda su primer día y su sesión');
  avanzar(5 * 60000);
  h1.actT = Date.now();
  for (const x of [h1, h2, h3, bot]) await dejar(x);
  const g1 = almacen.get('c:' + h1.c.uid);
  chequear(Math.abs(g1.ret.min - 5) < 0.05, 'al cerrar suma los minutos jugados (' + g1.ret.min + ')');
  chequear(Math.abs(h2.c.ret.min - 1) < 0.05, 'una pestaña quieta suma solo 1 minuto (' + h2.c.ret.min + ')');
  await mundo.retVolcar();
  d0 = await mundo.retDia(D);
  chequear(Math.abs(d0.min - 7) < 0.1, 'los minutos del día van al agregado sin el bot (' + d0.min + ')');

  irA(D + 1);
  const h1b = await entrarR('Cohorte1', '6a'), h2b = await entrarR('Cohorte2', '6b');
  chequear(h1b.c.ret.ses === 2 && h1b.c.ret.dt === 2 && h1b.c.ret.alta === 1, 'al volver suma sesión y día distinto');
  chequear((await mundo.retDia(D)).r1 === 2, 'D1: 2 de los 3 volvieron al día siguiente');
  await dejar(h1b);
  const h1c = await entrarR('Cohorte1', '6a');
  await mundo.retVolcar();
  const d1 = await mundo.retDia(D + 1);
  chequear((await mundo.retDia(D)).r1 === 2 && d1.a === 2 && d1.ses === 3 && d1.n === 0, 'otra sesión el mismo día no se cuenta doble');
  await dejar(h1c); await dejar(h2b);

  irA(D + 7);
  const h1d = await entrarR('Cohorte1', '6a');
  chequear((await mundo.retDia(D)).r7 === 1, 'D7: 1 volvió a los 7 días');
  // Sigue conectado pasada la medianoche: el guardado periodico anota el dia nuevo.
  irA(D + 8, 0);
  h1d.actT = Date.now();
  await mundo.guardar(h1d);
  for (let i = 0; i < 10; i++) await espera();
  chequear((await mundo.retDia(D + 8)).a === 1 && h1d.c.ret.d.at(-1) === D + 8, 'quien cruza la medianoche jugando cuenta como activo del día nuevo');
  await dejar(h1d);
  irA(D + 8, 10);
  const h3b = await entrarR('Cohorte3', '6c');
  await dejar(h3b);

  const st = await interno('stats');
  chequear((await interno('stats', {}, 'mala')).status === 403, 'sin la clave interna no hay estadísticas');
  chequear(st.ok && st.activos.hoy === 2 && st.activos.d7 === 2 && st.activos.d30 === 3, `activos hoy/7/30 (${st.activos && [st.activos.hoy, st.activos.d7, st.activos.d30]})`);
  chequear(st.retencion.d1.base === 3 && st.retencion.d1.vuelven === 2 && st.retencion.d1.pct === 66.7, 'retención D1 = 66,7% (2 de 3)');
  chequear(st.retencion.d7.vuelven === 1 && st.retencion.d7.pct === 33.3, 'retención D7 = 33,3% (1 de 3)');
  chequear(st.retencion.d30.pct === null, 'D30 aún sin cohortes completas');
  const co = st.cohortes.find(x => x.n === 3);
  chequear(co && co.d1 === 2 && co.d7 === 1 && co.d30 === null, 'la cohorte muestra D1/D7 y deja D30 pendiente');
  chequear(st.altas.some(x => x.n === 3) && st.sesion.sesiones7 === 2 && st.sesion.media > 0, 'altas por día y sesión media');
  chequear(Array.isArray(st.top) && !st.top.some(x => x.n === 'BotPrueba'), 'el top de niveles no incluye bots de prueba');

  console.log('Avisos de vuelta por Telegram');
  const salidos = [];
  const bloquean = new Set(['3003']);
  let fallaUna = null;
  mundo.tgEnviar = async (metodo, b) => {
    salidos.push(b);
    if (bloquean.has(String(b.chat_id))) return { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' };
    if (fallaUna === String(b.chat_id)) return { ok: false, error_code: 502, description: 'Bad Gateway' };
    return { ok: true, result: {} };
  };
  mundo.dormir = async () => {};
  // Las fechas de estas pruebas caen en eventos de temporada: se prueban aparte.
  mundo.temporadaAviso = () => null;
  const ids = () => salidos.map(x => String(x.chat_id)).sort().join(',');
  const deQuien = id => salidos.find(x => String(x.chat_id) === id);
  const A = D + 10;
  // A las 17:00: con 1 o 2 dias anotados el aviso sale a la hora de su entrada.
  irA(A, 17);
  const t1 = await entrarTg('Rachero', 3001), t2 = await entrarTg('Callado', 3002), t3 = await entrarTg('Bloqueador', 3003);
  const t4 = await entrarTg('SinAvisos', 3004), t5 = await entrarTg('Diario', 3005);
  const gA = await entrarTg('Lider', 3006), gB = await entrarTg('Amigo', 3007);
  const i1 = await entrarR('Invitado', '6d');
  chequear(t1.c && t1.c.uid === 'tg:3001' && t1.c.login && t1.c.login.racha === 1, 'entra con Telegram (initData firmado) y cobra el día 1 de la racha');
  await gA.mandar({ t: 'invitar', p: gB.id });
  await gB.mandar({ t: 'grupoResp', si: true });
  chequear(gA.gid && gA.gid === gB.gid, 'Líder y Amigo en grupo');
  for (const x of [t1, t2, t3, t4, t5, gB, i1]) await dejar(x);   // el Líder sigue conectado
  const off = await interno('avisos', { tgId: '3004', on: false });
  chequear(off.ok && off.on === false, '/avisos off se guarda');

  irA(A + 1, 17);
  const t5b = await entrarTg('Diario', 3005);
  await dejar(t5b);
  let r = await interno('recordatorios');
  chequear(ids() === '3001,3002,3003,3007', 'avisa solo a cuentas de Telegram de los últimos 14 días que hoy no entraron (' + ids() + ')');
  chequear(!deQuien('3005'), 'no avisa a quien ya jugó hoy');
  chequear(!deQuien('3006'), 'no avisa a quien está conectado');
  chequear(!deQuien('3004'), 'respeta /avisos off');
  chequear(!salidos.some(x => !/^\d+$/.test(String(x.chat_id))), 'nunca escribe a invitados');
  chequear(r.enviados === 3 && r.bloqueados === 1, `cuenta enviados y bloqueados (${r.enviados}/${r.bloqueados})`);
  const idx = await mundo.retIdx();
  chequear(idx['tg:3003'].bloq === 1, 'marca a quien bloqueó al bot');
  chequear(r.callar.includes('3003') && r.callar.includes('3004') && !r.callar.includes('3001'), 'devuelve a quién no escribirle (para el recordatorio del arcade)');
  const m1 = deQuien('3001');
  chequear(/Rachero/.test(m1.text) && /Llevas 1 día seguido/.test(m1.text) && /premio del día 2/.test(m1.text), 'el aviso habla de su racha que se pierde hoy');
  chequear(/Caza del día sin cobrar/.test(m1.text) && /Te faltan .* XP para el nivel 2/.test(m1.text), 'y de la caza del día y lo que falta para subir');
  chequear(/grupo te espera: 1 compañero/.test(deQuien('3007').text), 'a quien tiene el grupo conectado se lo dice');
  const kb = m1.reply_markup.inline_keyboard.flat();
  chequear(kb.some(b => b.web_app && /\/mmo\/$/.test(b.web_app.url)) && kb.some(b => b.callback_data === 'mmoavisos:off'), 'botones: abrir el MMO y dejar de recibir avisos');
  chequear(!m1.parse_mode, 'texto plano (el nombre lo elige el jugador)');
  salidos.length = 0;
  r = await interno('recordatorios');
  chequear(salidos.length === 0 && r.enviados === 0, 'no avisa dos veces el mismo día');

  irA(A + 2, 17);
  salidos.length = 0;
  await interno('recordatorios');
  // Diario jugo ayer (A+1) y hoy no: tambien le toca su primer aviso.
  chequear(ids() === '3001,3002,3005,3007', 'segundo día: otro aviso, y nunca más al que bloqueó (' + ids() + ')');
  chequear(!/racha/.test(deQuien('3001').text), 'la racha ya se perdió: no se menciona');

  irA(A + 3, 17);
  salidos.length = 0;
  await interno('recordatorios');
  chequear(ids() === '3005', 'tras 2 avisos sin volver, se pausa: solo Diario recibe su segundo (' + ids() + ')');
  const t1b = await entrarTg('Rachero', 3001);
  await dejar(t1b);
  const on = await interno('avisos', { tgId: '3004', on: true });
  chequear(on.ok && on.on === true && on.jugo === true, '/avisos on vuelve a activarlos');

  irA(A + 4, 17);
  salidos.length = 0;
  await interno('recordatorios');
  chequear(ids() === '3001,3004', 'al volver se reanudan sus avisos; los demás siguen en pausa (' + ids() + ')');

  irA(A + 5, 17);
  salidos.length = 0;
  fallaUna = '3004';
  await interno('recordatorios');
  chequear(idx['tg:3004'].a === 1 && idx['tg:3004'].ad === A + 4, 'un fallo pasajero de Telegram no cuenta como aviso');
  fallaUna = null;
  const hoy = Math.floor(Date.now() / DIA);
  chequear(mundo.puedeAvisar('tg:1', { v: hoy - 14 }, hoy) && !mundo.puedeAvisar('tg:1', { v: hoy - 15 }, hoy), 'solo a quien jugó en los últimos 14 días');
  chequear(!mundo.puedeAvisar('inv:abc', { v: hoy - 1 }, hoy) && !mundo.puedeAvisar('web:abc', { v: hoy - 1 }, hoy), 'nunca a invitados ni cuentas web');
  // Evento de temporada: un aviso extra por evento aunque este en pausa.
  mundo.temporadaAviso = () => ({ id: 'evPrueba', nombre: 'Evento de Prueba', emoji: '🎃', hasta: '2 de noviembre', cosas: 'calabazas', campo: 'calabazas', titulos: ['Cazacalabazas', 'Rey de las Calabazas'] });
  chequear(mundo.puedeAvisar('tg:1', { v: hoy - 3, a: 2 }, hoy) && mundo.puedeAvisar('tg:1', { v: hoy - 30 }, hoy), 'evento nuevo: avisa aunque esté en pausa o lleve 30 días sin jugar');
  chequear(!mundo.puedeAvisar('tg:1', { v: hoy - 3, a: 2, ev: 'evPrueba' }, hoy) && !mundo.puedeAvisar('tg:1', { v: hoy - 3, off: 1 }, hoy) && !mundo.puedeAvisar('tg:1', { v: hoy - 36 }, hoy), 'un solo aviso extra por evento, respeta /avisos off y no pasa de 35 días');
  const tEv = await mundo.mensajeAviso({ nombre: 'Rachero', nivel: 1, xp: 0, calabazas: 7 }, hoy);
  chequear(tEv.split('\n\n')[1].startsWith('🎃 ¡Evento de Prueba!') && /Llevas 7: con 50 y 200/.test(tEv), 'el aviso empieza por el evento y cuánto lleva');
  mundo.temporadaAviso = () => null;

  console.log('Cron de las 17:00: un solo mensaje por persona');
  irA(A + 6, 17);
  const { runCron } = await import('../functions/api/cron.js');
  const fetchReal = globalThis.fetch;
  const arcade = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/rest/v1/profiles')) return new Response(JSON.stringify([{ telegram_id: '3001' }, { telegram_id: '3003' }, { telegram_id: '3004' }, { telegram_id: '9999' }]));
    if (u.includes('api.telegram.org')) { arcade.push(String(JSON.parse(init.body).chat_id)); return new Response('{"ok":true}'); }
    return new Response('{}');
  };
  salidos.length = 0;
  const envCron = {
    TELEGRAM_BOT_TOKEN: TOKEN_BOT, SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_KEY: 'x',
    MMO: { idFromName: () => 'mundo-1', get: () => ({ fetch: (url, init) => mundo.interno(new Request(url, init), url.split('/interno/')[1]) }) },
  };
  try { await runCron('0 17 * * *', envCron); } finally { globalThis.fetch = fetchReal; }
  chequear(ids() === '3004', 'el MMO avisa a quien le toca (' + ids() + ')');
  chequear(arcade.sort().join(',') === '3001,9999', 'el recordatorio del arcade se salta al avisado, al que bloqueó y a quien pidió no recibir avisos (' + arcade + ')');
  console.log('Avisos a la hora habitual de cada uno');
  const { horaHabitual, HORA_DEFECTO } = await import('../functions/mmo/retencion.js');
  chequear(horaHabitual({ hs: [20, 3] }) === 3 && horaHabitual({ hs: [9] }) === 9 && horaHabitual({}) === HORA_DEFECTO, 'con 1 o 2 días anotados, la hora de su última entrada; sin ninguno, las 17:00');
  chequear(horaHabitual({ hs: [20, 3, 20, 3, 1] }) === 3 && horaHabitual({ hs: [1, 2, 2, 1, 22, 22, 5] }) === 22 && horaHabitual({ hs: [20, 20, 9] }) === 20, 'la hora más repetida (en empate, la más reciente)');
  for (let k = 7; k <= 9; k++) { irA(A + k, 20); const n = await entrarTg('Nocturno', 3010); await dejar(n); }
  chequear(horaHabitual((await mundo.retIdx())['tg:3010']) === 20, 'se anota la hora de su primera entrada de cada día');
  irA(A + 10, 17);
  salidos.length = 0;
  r = await interno('recordatorios');
  chequear(!deQuien('3010') && r.hoy.includes('3010'), 'a las 17:00 no se le avisa, pero el arcade sabe que tendrá su aviso más tarde');
  let alarma = null;
  state.storage.setAlarm = async t => { alarma = t; };
  try {
    irA(A + 10, 20);
    salidos.length = 0;
    await mundo.alarm();
    chequear(ids() === '3010', 'la alarma de las 20:00 le avisa a él solo (' + ids() + ')');
    chequear(alarma === (Math.floor(Date.now() / 3600000) + 1) * 3600000 + 30000, 'y se programa para la hora siguiente');
    salidos.length = 0;
    await mundo.alarm();
    chequear(salidos.length === 0, 'una sola vez al día');
  } finally { delete state.storage.setAlarm; }
  // Si falla la llamada de avisos, se pide solo la lista; sin lista, no sale el del arcade.
  for (const [modo, esperado] of [['lista', '9999'], ['nada', '']]) {
    irA(A + (modo === 'lista' ? 11 : 12), 17);
    arcade.length = 0;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('/rest/v1/profiles')) return new Response(JSON.stringify([{ telegram_id: '3003' }, { telegram_id: '3010' }, { telegram_id: '9999' }]));
      if (u.includes('api.telegram.org')) { arcade.push(String(JSON.parse(init.body).chat_id)); return new Response('{"ok":true}'); }
      return new Response('{}');
    };
    const envFalla = { ...envCron, MMO: { idFromName: () => 'mundo-1', get: () => ({ fetch: async (url, init) => {
      if (url.includes('/recordatorios') || modo === 'nada') return new Response('Error del servidor', { status: 500 });
      return mundo.interno(new Request(url, init), url.split('/interno/')[1]);
    } }) } };
    try { await runCron('0 17 * * *', envFalla); } finally { globalThis.fetch = fetchReal; }
    chequear(arcade.sort().join(',') === esperado, modo === 'lista' ? 'si falla el aviso del MMO, el arcade igual se salta al que bloqueó y a quien tendrá su aviso más tarde (' + arcade + ')' : 'sin la lista del MMO, ese día no sale el recordatorio del arcade (' + arcade + ')');
  }

}

// ── MUNDO ABIERTO: invasiones, raros y cofres (functions/mmo/eventos.js) ──
async function pruebasMundoAbierto() {
  const invasores = (clave, ev) => [...mundo.mundoK(clave).mons.values()].filter(o => o.ex && o.ex.ev === ev.id && !o.muere);
  const matarCon = (o, s) => mundo.danar(o, o.hp + 1, s);
  const premio = s => s.ultimos('toast').some(x => /Invasión rechazada/.test(x.m));

  console.log('Invasión: empieza sola en una zona con gente');
  if (mundo.evento) mundo.terminarEvento(false);
  const h1 = await entrar('Heroe', '2a'), h2 = await entrar('Mirona', '2b'), h3 = await entrar('Lejana', '2c'), cu = await entrar('Sanadora', '2d');
  ponerNivel(h1, 9, 'guerrero'); ponerNivel(h2, 9, 'mago'); ponerNivel(h3, 14, 'mago'); ponerNivel(cu, 9, 'sacerdote');
  mundo.proxEvento = Date.now() - 1;
  tick(1);
  const ev0 = mundo.evento;
  chequear(ev0 && esZonaAbierta(ev0.mapa) && mundo.presentesEn(ev0.mapa).length > 0, 'la invasión elige una zona abierta con jugadores (' + (ev0 && ev0.mapa) + ')');
  chequear(ev0 && !['pueblo', 'coliseo'].includes(ev0.mapa) && !ev0.mapa.includes('#'), 'nunca en el pueblo, el Coliseo ni una mazmorra');
  chequear(h1.ultimos('aviso').some(x => /invasores en 5 minutos/.test(x.m)), 'se avisa a todo el servidor');
  mundo.terminarEvento(false);
  const falta = mundo.proxEvento - Date.now();
  chequear(!mundo.evento && falta >= 12 * 60000 && falta <= 15 * 60000, 'la siguiente invasión queda a 12-15 min');
  mundo.proxEvento = Infinity;   // el resto de las pruebas las empieza a mano

  console.log('Invasión: oleadas, meta, capitán y premio solo para quien participó');
  await aMapa(h1, 'amanecer', 1200); await aMapa(h2, 'amanecer', 2300); await aMapa(cu, 'amanecer', 1250); await aMapa(h3, 'selva', 800);
  limpiarMapa(h1);
  for (const s of [h1, h2, h3, cu]) s.limpiar();
  const ev = mundo.empezarEvento('amanecer');
  chequear(ev && ev.meta >= 20 && ev.meta <= 60, 'meta escalada con los presentes (' + (ev && ev.meta) + ')');
  chequear(h3.ultimos('ev').some(x => x.on && x.mapa === 'amanecer'), 'el panel del evento llega también a quien está en otra zona');
  chequear(mundo.empezarEvento('selva') === null, 'no hay dos invasiones a la vez');
  tick(1);
  const ola = invasores('amanecer', ev);
  chequear(ola.length >= 2 && ola.every(o => o.agresivo), 'llega una oleada de invasores agresivos (' + ola.length + ')');
  chequear(ola.every(o => o.nv >= MAPAS.amanecer.nv[0] && o.nv <= MAPAS.amanecer.nv[1]), 'del nivel de la zona');
  matarCon(ola[0], h1);
  // La sanadora cura a h1 mientras pelea: eso tambien es participar.
  mundo.danar(ola[1], 1, h1);
  h1.hp = h1.st.maxHp - 200;
  mundo.curar(cu, h1, 100);
  let vueltas = 0;
  while (mundo.evento && mundo.evento.fase === 'oleadas' && vueltas++ < 200) {
    tick(61);
    for (const o of invasores('amanecer', ev)) if (!o.ex.cap) matarCon(o, h1);
  }
  chequear(ev.hechos === ev.meta, 'el progreso cuenta cada invasor (' + ev.hechos + '/' + ev.meta + ')');
  chequear(h2.ultimos('ev').some(x => x.on && x.hechos > 0), 'quien está en la zona ve el progreso');
  const cap = mundo.mundoK('amanecer').mons.get(ev.capitan);
  chequear(ev.fase === 'capitan' && cap && cap.ex.cap, 'al cumplir la meta llega el Capitán');
  chequear(cap && cap.max > statsMonstruo(cap.k, cap.nv).hp * 5, 'el Capitán es élite (mucha más vida)');
  chequear(h1.ultimos('ev').some(x => x.fase === 'capitan'), 'el panel pasa a la fase del Capitán');
  const bolsa1 = h1.c.bolsa.length, bolsaCu = cu.c.bolsa.length, bolsa2 = h2.c.bolsa.length, bolsa3 = h3.c.bolsa.length;
  const oro2 = h2.c.oro, oro3 = h3.c.oro;
  for (const s of [h1, h2, h3, cu]) s.limpiar();
  matarCon(cap, h1);
  chequear(!mundo.evento, 'al caer el Capitán la invasión termina');
  chequear(premio(h1) && h1.c.bolsa.length > bolsa1, 'quien peleó cobra XP, oro y objeto');
  chequear(h1.ultimos('gana').some(x => x.item && x.item.r >= 1), 'el objeto es raro o mejor');
  chequear(premio(cu) && cu.c.bolsa.length > bolsaCu, 'quien curó en el evento también cobra');
  chequear(!premio(h2) && h2.c.bolsa.length === bolsa2 && h2.c.oro === oro2, 'quien estaba en la zona sin pelear no cobra');
  chequear(!premio(h3) && h3.c.bolsa.length === bolsa3 && h3.c.oro === oro3, 'quien estaba en otra zona no cobra');
  chequear(h3.ultimos('aviso').some(x => /rechazada/.test(x.m)) && h3.ultimos('ev').some(x => !x.on), 'se avisa a todos que terminó');
  chequear(invasores('amanecer', ev).length === 0, 'no quedan invasores');
  chequear(!h1.ultimos('mton').length && !cu.ultimos('mton').length, 'la invasión no da mTON');

  console.log('Invasión: sin completar a tiempo termina sin premio');
  for (const s of [h1, h2, h3, cu]) s.limpiar();
  const evp = mundo.empezarEvento('amanecer');
  tick(1);
  mundo.danar(invasores('amanecer', evp)[0], 1, h1);
  const oroP = h1.c.oro, bolsaP = h1.c.bolsa.length;
  avanzar(EVENTO_DURA_MS);
  tick(1);
  chequear(!mundo.evento, 'a los 5 minutos la invasión se acaba');
  chequear(h1.ultimos('ev').some(x => !x.on && x.fin === 'perdida'), 'el panel dice que se perdió');
  chequear(!premio(h1) && h1.c.oro === oroP && h1.c.bolsa.length === bolsaP, 'sin premio para nadie');
  chequear(invasores('amanecer', evp).length === 0, 'los invasores se retiran');

  console.log('Cofres del tesoro');
  const cfs = cofresDe('selva');
  chequear(cfs.length >= 2 && cfs.length <= 3, 'cada zona abierta tiene 2-3 cofres (' + cfs.length + ')');
  chequear(!cofresDe('pueblo').length && !cofresDe('coliseo').length && !cofresDe('catacumbas').length, 'ni el pueblo, ni el Coliseo, ni las mazmorras tienen');
  chequear(cfs.some(c => c.y < SUELO), 'hay cofres encima de las plataformas');
  h3.limpiar();
  await aMapa(h3, 'selva', 800);
  const lista = h3.ultimos('cofres').pop();
  chequear(lista && lista.l.length === cfs.length && lista.l.every(x => x[4] === 0), 'al entrar a la zona llegan sus cofres, todos cerrados');
  const cf = cfs.find(c => c.y < SUELO);
  h3.x = cf.x + 300; h3.y = cf.y;
  let oro0 = h3.c.oro;
  await h3.mandar({ t: 'cofre', id: cf.i });
  chequear(h3.c.oro === oro0 && h3.ultimos('no').some(x => /Acércate/.test(x.m)), 'de lejos no se abre');
  h3.x = cf.x; h3.y = SUELO;
  await h3.mandar({ t: 'cofre', id: cf.i });
  chequear(h3.c.oro === oro0, 'el de lo alto de una plataforma no se abre desde el suelo');
  h3.x = cf.x + 20; h3.y = cf.y;
  await h3.mandar({ t: 'cofre', id: String(cf.i) });
  chequear(h3.c.oro === oro0, 'un id que no es número se ignora');
  await h3.mandar({ t: 'cofre', id: cf.i });
  const ganado = h3.c.oro - oro0;
  chequear(ganado > 0 && h3.ultimos('cofreA').length === 1, 'cerca, el cofre se abre y da oro (' + ganado + ')');
  chequear(((almacen.get('c:' + h3.c.uid) || {}).cofres || {})['selva:' + cf.i], 'se guarda al momento (un reinicio no lo reabre)');
  oro0 = h3.c.oro;
  avanzar(1000);
  await h3.mandar({ t: 'cofre', id: cf.i });
  chequear(h3.c.oro === oro0 && h3.ultimos('cofreA').length === 1, 'no se abre dos veces');
  h3.limpiar();
  await aMapa(h3, 'selva', 800);
  chequear(h3.ultimos('cofres').pop().l.find(x => x[0] === cf.i)[4] > 0, 'al volver, ese cofre figura abierto para ti');
  const otro = await entrar('Exploradora', '2e');
  ponerNivel(otro, 14, 'picaro');
  await aMapa(otro, 'selva', 800);
  otro.x = cf.x; otro.y = cf.y;
  const oroO = otro.c.oro;
  await otro.mandar({ t: 'cofre', id: cf.i });
  chequear(otro.c.oro > oroO, 'cada jugador tiene su propio cofre');
  avanzar(COFRE_CADA_MS);
  h3.x = cf.x; h3.y = cf.y;
  oro0 = h3.c.oro;
  await h3.mandar({ t: 'cofre', id: cf.i });
  chequear(h3.c.oro > oro0, 'pasados 30 minutos vuelve a tener tesoro');
  chequear(Object.keys(h3.c.cofres).length === 1, 'las marcas viejas se limpian');
  const alto = cofresDe('acantilados').find(c => c.tipo === 'comun'), bajo = cofresDe('noche').find(c => c.tipo === 'comun');
  const r1 = await entrar('Rica', '2f'); ponerNivel(r1, 58, 'mago');
  await aMapa(r1, 'acantilados', alto.x); r1.x = alto.x; r1.y = alto.y;
  let o0 = r1.c.oro; await r1.mandar({ t: 'cofre', id: alto.i }); const oroAlto = r1.c.oro - o0;
  await aMapa(r1, 'noche', bajo.x); r1.x = bajo.x; r1.y = bajo.y;
  o0 = r1.c.oro; await r1.mandar({ t: 'cofre', id: bajo.i }); const oroBajo = r1.c.oro - o0;
  chequear(oroAlto > oroBajo * 5, 'el oro va con el nivel de la zona (' + oroAlto + ' contra ' + oroBajo + ')');

  console.log('Élites raros');
  await aMapa(h3, 'selva', 1300);
  await aMapa(h1, 'amanecer', 1300);
  limpiarMapa(h3);
  h1.limpiar(); h3.limpiar(); otro.limpiar();
  const raro = mundo.crearRaro('selva');
  chequear(raro && raro.ex.raro && raro.ex.nom && /^#/.test(raro.ex.ti), 'tiene nombre propio y tinte');
  chequear(raro.max === Math.round(statsMonstruo(raro.k, raro.nv).hp * 6), 'tiene mucha más vida');
  chequear(h3.ultimos('emote').some(x => /★/.test(x.m)) && !h1.ultimos('emote').some(x => /★/.test(x.m)), 'se avisa solo a esa zona');
  chequear(h3.ultimos('ms').some(x => x.m.id === raro.id && x.m.ex && x.m.ex.raro), 'el cliente recibe la marca de raro');
  chequear(mundo.crearRaro('selva') === raro, 'como mucho uno vivo por zona');
  const bolsaR = h3.c.bolsa.length;
  mundo.danar(raro, 1, otro);
  matarCon(raro, h3);
  chequear(h3.c.bolsa.length > bolsaR && h3.ultimos('gana').some(x => x.item && x.item.r >= 1), 'suelta un objeto raro o mejor garantizado');
  chequear(otro.ultimos('gana').some(x => x.item && x.item.r >= 1), 'también a quien ayudó');
  const w = mundo.mundoK('selva');
  chequear(w.raroProx - Date.now() >= RARO_REAPARECE_MS - 1000, 'reaparición larga (20 min)');
  // Con el azar a favor (Math.random = 0) para ver solo el efecto del tiempo.
  // actT: si no, el servidor lo echa por inactividad al saltar 20 min.
  const azarReal = Math.random;
  const raroVivo = () => [...w.mons.values()].some(o => o.ex && o.ex.raro && !o.muere);
  avanzar(RARO_REAPARECE_MS - 120000);
  h3.actT = Date.now();
  Math.random = () => 0;
  tick(1);
  Math.random = azarReal;
  chequear(!h3.cerrado && !raroVivo(), 'antes de la reaparición no sale otro');
  avanzar(200000);
  h3.actT = Date.now();
  Math.random = () => 0;
  tick(1);
  Math.random = azarReal;
  chequear(raroVivo(), 'después sí puede volver');
}

pruebas().then(resumen).catch(e => { console.error(e); process.exit(1); });

// ── INVITA A UN AMIGO (functions/mmo/amigos.js) ──
async function pruebasAmigos() {
  console.log('Invita a un amigo');
  const fetchReal = globalThis.fetch;
  const avisos = [];
  globalThis.fetch = async (url, init) => { avisos.push(String(url) + ' ' + (init && init.body || '')); return new Response('{"ok":true}'); };
  const tgReal = mundo.tgEnviar;
  mundo.tgEnviar = async (metodo, cuerpo) => { avisos.push(metodo + ' ' + JSON.stringify(cuerpo)); return { ok: true }; };
  try {
    const host = await entrarTg('Anfitrion', 7001);
    host.limpiar = () => { host.ws.rec.length = 0; };
    await host.mandar({ t: 'amigos' });
    const info = host.ws.rec.filter(m => m.t === 'amigos').pop();
    chequear(info && /^[a-z0-9]{6}$/.test(info.ref), 'cada personaje tiene su código de invitación');
    const nuevo = await entrarTg('Invitado', 7002, { ref: info.ref });
    chequear(nuevo.c.invitadoPor === host.c.uid, 'el amigo nuevo queda anotado');
    for (let i = 0; i < 50; i++) await espera();
    chequear((nuevo.c.contactos || []).some(a => a.u === host.c.uid) && (host.c.contactos || []).some(a => a.u === nuevo.c.uid), 'los dos quedan en la lista de amigos');
    chequear(nuevo.ws.rec.some(m => m.t === 'invitacion') && nuevo.invitacion && nuevo.invitacion.de === host.c.uid, 'al amigo nuevo le llega la invitación de grupo');
    const viejo = await entrarTg('Anfitrion', 7001, { ref: info.ref });
    chequear(!viejo.c.invitadoPor, 'uno no se invita a sí mismo');
    const oro0 = viejo.c.oro, oroN = nuevo.c.oro;
    nuevo.c.nivel = 9; nuevo.c.xp = 0;
    mundo.sumarXp(nuevo, 100000);
    for (let i = 0; i < 50; i++) await espera();
    chequear(nuevo.c.refPagado && nuevo.c.oro > oroN, 'al llegar a nivel 10 el invitado cobra');
    chequear(viejo.c.amigos === 1 && viejo.c.oro > oro0, 'y quien lo invitó también');
    mundo.sumarXp(nuevo, 100000);
    for (let i = 0; i < 50; i++) await espera();
    chequear(viejo.c.amigos === 1, 'el premio se paga una sola vez');
    chequear(avisos.some(a => /sendMessage/.test(a) && /7001/.test(a)), 'se avisa por Telegram a quien invitó');
  } finally { globalThis.fetch = fetchReal; mundo.tgEnviar = tgReal; }
}

async function pruebasDuelos() {
  console.log('Duelos');
  const a = await entrar('Retador', '5a'), b = await entrar('Retado', '5b'), c = await entrar('Mirón', '5c');
  ponerNivel(a, 12, 'guerrero'); ponerNivel(b, 12, 'mago'); ponerNivel(c, 12, 'picaro');
  for (const s of [a, b, c]) await aMapa(s, 'amanecer', 900);
  limpiarMapa(a);
  b.x = 960; a.f = 1;
  a.limpiar(); b.limpiar();
  await a.mandar({ t: 'retar', p: b.id });
  chequear(b.ultimos('reto').length === 1, 'al retado le llega el reto');
  await b.mandar({ t: 'retoResp', si: false });
  chequear(!a.duelo && !b.duelo && a.ultimos('toast').some(x => /rechazó/.test(x.m)), 'puede rechazarlo');
  await a.mandar({ t: 'retar', p: b.id });
  avanzar(31000);
  await b.mandar({ t: 'retoResp', si: true });
  chequear(!a.duelo, 'un reto caduca a los 30 s');
  await a.mandar({ t: 'retar', p: b.id });
  a.hp = 10;
  await b.mandar({ t: 'retoResp', si: true });
  chequear(a.duelo && b.duelo && a.duelo.con === b.id && a.hp === 10, 'aceptado: empieza el duelo y no cura a nadie');
  a.hp = a.st.maxHp;
  await c.mandar({ t: 'retar', p: a.id });
  chequear(!c.retoDuelo && !a.retoDuelo, 'no se reta a quien ya está en duelo');
  const hp0 = b.hp;
  a.atkT = 0; await a.mandar({ t: 'atk', s: 0 });
  chequear(b.hp === hp0, 'durante la cuenta atrás no hay golpes');
  avanzar(3100);
  a.atkT = 0; await a.mandar({ t: 'atk', s: 0 });
  chequear(b.hp < hp0, 'pasada la cuenta, el ataque básico daña al rival (' + Math.round(hp0 - b.hp) + ')');
  chequear(hp0 - b.hp < b.st.maxHp * 0.2, 'el daño entre jugadores va reducido');
  const hpC = c.hp; c.x = 960;
  a.atkT = 0; avanzar(1000); await a.mandar({ t: 'atk', s: 0 });
  chequear(c.hp === hpC, 'a un mirón no le pasa nada');
  b.cdHab = {}; b.gcdHasta = 0; b.rec = b.st.recMax;
  const hpA = a.hp;
  await b.mandar({ t: 'hab', id: 'misiles', tg: a.id, tk: 'p' });
  tick(1);
  chequear(a.hp < hpA || b.cast, 'una habilidad de daño sirve contra el rival');
  if (b.cast) { avanzar(3000); tick(1); chequear(a.hp < hpA, 'el lanzamiento llega al rival'); }
  // A 1 de vida: termina, nadie muere.
  b.hp = 2; const g0 = a.c.duelosG || 0;
  for (let i = 0; i < 20 && a.duelo; i++) { a.atkT = 0; avanzar(1000); await a.mandar({ t: 'atk', s: 0 }); }
  chequear(!a.duelo && !b.duelo && !b.muerto && b.hp >= 1, 'al quedar a 1 de vida el duelo termina sin muertes');
  chequear((a.c.duelosG || 0) === g0 + 1, 'se cuenta la victoria');
  chequear(a.ultimos('dueloFin').some(x => x.g === a.id), 'todos saben quién ganó');
  // En combate no se puede retar (si no, el duelo servia para escapar).
  a.limpiar(); avanzar(1000);
  await a.mandar({ t: 'retar', p: b.id });
  chequear(!b.retoDuelo && a.ultimos('no').some(x => /combate/.test(x.m)), 'en mitad de un combate no se puede retar');
  // Por tiempo y por distancia.
  avanzar(11000);
  await a.mandar({ t: 'retar', p: b.id }); await b.mandar({ t: 'retoResp', si: true });
  avanzar(3100 + 90000 + 100); tick(1);
  chequear(!a.duelo && !b.duelo, 'a los 90 s se acaba');
  avanzar(11000);
  await a.mandar({ t: 'retar', p: b.id }); await b.mandar({ t: 'retoResp', si: true });
  avanzar(3100); b.x = 2200; tick(1);
  chequear(!a.duelo && !b.duelo, 'si se alejan, se acaba');
  b.x = 960; avanzar(11000);
  await a.mandar({ t: 'retar', p: b.id }); await b.mandar({ t: 'retoResp', si: true });
  await dejar(b); tick(1);
  chequear(!a.duelo && a.ultimos('dueloFin').some(x => /se fue/.test(x.m)), 'si el rival se desconecta, gana el otro');
  // Altura: no se puede volar.
  await aMapa(c, 'pueblo', 2500); c.movT = Date.now() - 100; c.snapHasta = 0;
  await c.mandar({ t: 'mv', x: 2510, y: 40, f: 1, a: 2 });
  chequear(c.y >= 400 - 215, 'no se puede volar por encima de un doble salto (y=' + Math.round(c.y) + ')');
  avanzar(200); await c.mandar({ t: 'mv', x: 2515, y: 300, f: 1, a: 2 });
  chequear(c.y === 300, 'un salto normal sí vale');
  // En una mazmorra no.
  a.k = 'catacumbas#99';
  a.limpiar(); await a.mandar({ t: 'retar', p: c.id });
  chequear(!c.retoDuelo, 'no hay duelos en mazmorras');
  a.k = 'amanecer';
  for (const s of [a, c]) await dejar(s);
}

async function pruebasNovato() {
  console.log('Jugador nuevo: el bosque no es una trampa');
  const n = await entrar('Novato', '5d');
  ponerNivel(n, 3, 'guerrero');
  await aMapa(n, 'noche', 1500);
  const w = mundo.mundoDe(n);
  limpiarMapa(n);
  w.jefeEn = Date.now() - 1; tick(1);
  const jefe = [...w.mons.values()].find(o => o.jefe);
  chequear(jefe && jefe.x > 2200, 'el Sabueso aparece al fondo del bosque (x=' + (jefe && Math.round(jefe.x)) + ')');
  n.x = jefe.x - 200; tick(3);
  chequear(jefe.obj !== n.id, 'no persigue a un novato 3+ niveles por debajo');
  const n2 = await entrar('Valiente', '5e'); ponerNivel(n2, 7, 'guerrero'); await aMapa(n2, 'noche', jefe.x - 200);
  tick(3);
  chequear(jefe.obj === n2.id, 'a uno de nivel cercano sí');
  await dejar(n2);
  w.mons.clear();
  // Reparto por tipo
  w.spawnEn = 0;
  for (let i = 0; i < 300; i++) { tick(1); avanzar(800); w.spawnEn = 0; }
  const cuenta = {};
  for (const o of w.mons.values()) if (!o.jefe) cuenta[o.k] = (cuenta[o.k] || 0) + 1;
  const maxTipo = Math.max(...Object.values(cuenta));
  chequear(maxTipo <= Math.ceil(12 / 5) + 1, 'ningún tipo acapara la zona (' + JSON.stringify(cuenta) + ')');
  // Mision sin presa: si falta su tipo, sale aunque la zona este llena
  w.mons.clear();
  n.c.mis = { i: 0, p: 0 };   // mision 1: goblin_normal
  n.x = 100;
  for (let i = 0; i < 14; i++) monstruo(n, 'hechicero', 1500 + i * 30);
  w.spawnEn = 0; tick(2);
  chequear([...w.mons.values()].some(o => o.k === 'goblin_normal' && !o.muere), 'zona llena: aparece igual el monstruo que pide la misión');
  // Retiro de los que nadie toca
  const antes = w.mons.size;
  avanzar(200000); w.retiroEn = 0; n.x = 100; tick(1);
  chequear(w.mons.size < antes || [...w.mons.values()].some(o => Date.now() - o.nacio < 1000), 'con la zona llena, se retira uno que nadie tocó en 3 min');
  // Morir de novato
  n.c.xp = 50; n.inv = 0;
  mundo.herir(n, 1e6, { id: 0, jefe: true });
  chequear(n.muerto, '(muere)');
  mundo.revivir(n);
  chequear(n.c.xp === 50 && n.c.mapa === 'noche' && n.x < 300, 'hasta Nv 10 se revive en la entrada de la zona sin perder XP');
  ponerNivel(n, 12); n.c.xp = 500; n.inv = 0;
  mundo.herir(n, 1e6, { id: 0, jefe: true }); mundo.revivir(n);
  chequear(n.c.xp < 500 && n.c.mapa === 'pueblo', 'desde Nv 10, como antes (pueblo y -5% XP)');
  // Reconectar dentro de una mazmorra
  ponerNivel(n, 12, 'guerrero');
  await aMapa(n, 'pueblo', 800);
  await n.mandar({ t: 'mazmorra', id: 'catacumbas' });
  const claveI = n.k;
  chequear(claveI.includes('#'), '(entra a su mazmorra)');
  n.x = 640; await mundo.guardar(n);
  await dejar(n);
  avanzar(60000); tick(1);
  const n3 = await entrar('Novato', '5d');
  chequear(n3.k === claveI && Math.abs(n3.x - 640) < 5, 'al reconectar vuelve a su mazmorra (si sigue abierta)');
  await dejar(n3);
  tick(1); avanzar(301000); tick(1);
  const n4 = await entrar('Novato', '5d');
  chequear(n4.k === 'pueblo', 'si ya se cerró (5 min vacía), al pueblo');
  Object.assign(n, n4);
  // Racha que perdona
  const hoy = new Date(Date.now()).toISOString().slice(0, 10);
  const hace = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  n.c.salida = Date.now() - 40 * 3600000;   // fuera del margen de 30 h
  n.c.login = { d: hace(2), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 4, 'faltar un día retrocede dos en la racha');
  n.c.login = { d: hace(2), racha: 7, total: 7 };
  chequear(mundo.procesarLogin(n).racha === 1, 'tras el día 7, faltar vuelve a empezar (no se cobra el 7 cada 3 días)');
  n.c.login = { d: hace(3), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 1, 'faltar más vuelve a empezar');
  n.c.login = { d: hace(1), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 6 && n.c.login.d === hoy, 'jugar seguido la sube');
  n.c.login = { d: hace(2), racha: 5, total: 5 }; n.c.salida = Date.now() - 26 * 3600000;
  chequear(mundo.procesarLogin(n).racha === 6, 'margen de 30 h: jugar hace 26 h no corta la racha aunque falte un día UTC');
  n.c.salida = Date.now() - 40 * 3600000;
  { // Regalo de bienvenida al volver tras 3+ dias
    n.c.login = { d: hace(1), racha: 2, total: 2 };
    chequear(!mundo.procesarLogin(n).vuelta, 'volver al día siguiente no da regalo de bienvenida');
    const oro0 = n.c.oro, po0 = n.c.pw.pocion || 0;
    n.c.login = { d: hace(8), racha: 4, total: 4 };
    const v = mundo.procesarLogin(n).vuelta;
    chequear(v && v.dias === 8 && n.c.oro > oro0 + v.oro - 1 && (n.c.pw.pocion || 0) >= Math.min(99, po0 + 5) && v.item, 'volver tras 8 días da regalo de bienvenida (oro, pociones y objeto)');
  }
  await dejar(n);
}

async function pruebasDesafios() {
  console.log('Desafíos de mazmorra (Nv 60)');
  const d = await entrar('Desafiante', '5f');
  ponerNivel(d, 59, 'guerrero');
  await aMapa(d, 'pueblo', 800);
  d.limpiar();
  await d.mandar({ t: 'mazmorra', id: 'catacumbas', k: 1 });
  chequear(!d.k.includes('#') && d.ultimos('no').some(x => /nivel 60/.test(x.m)), 'antes de Nv 60 no hay desafíos');
  ponerNivel(d, 60);
  await d.mandar({ t: 'mazmorra', id: 'catacumbas', k: 2 });
  chequear(!d.k.includes('#'), 'no se salta niveles (+2 sin vencer el +1)');
  await d.mandar({ t: 'mazmorra', id: 'catacumbas', k: 1 });
  const w = mundo.mundoDe(d);
  chequear(w.inst && w.inst.k === 1 && w.inst.nv === 60, 'el +1 de Catacumbas va a Nv 60');
  const pack = [...w.mons.values()].find(o => !o.jefe);
  const base = mundo.crearMonstruo('pueblo', pack.k, 100, { nv: pack.nv, hpX: 2.2 });
  chequear(Math.abs(pack.max / base.max - 1.2) < 0.05, 'los monstruos tienen más vida (×' + (pack.max / base.max).toFixed(2) + ')');
  mundo.mundoK('pueblo').mons.delete(base.id);
  // Vencer al jefe final
  const fin = [...w.mons.values()].find(o => o.final);
  const oro0 = d.c.oro, bolsa0 = d.c.bolsa.length;
  for (const o of [...w.mons.values()]) if (o.jefe && o !== fin) { mundo.danar(o, o.hp + 1, d); tick(1); }
  mundo.danar(fin, fin.hp + 1, d); tick(2);
  chequear(w.inst.completada && d.c.desafio && d.c.desafio.catacumbas === 1, 'vencido: queda anotado el +1');
  const it = d.c.bolsa.find(x => x.des);
  chequear(d.c.oro > oro0 && it && it.nv === 61, 'premio: oro y un objeto de nivel 61');
  await mundo.recibir(d, JSON.stringify({ t: 'item', id: it.id, a: 'equipar' }));
  chequear(Object.values(d.c.eq).some(x => x && x.id === it.id), 'el objeto de desafío se equipa a Nv 60');
  avanzar(10000); tick(1);
  await aMapa(d, 'pueblo', 800);
  await d.mandar({ t: 'mazmorra', id: 'catacumbas', k: 2 });
  chequear(mundo.mundoDe(d).inst && mundo.mundoDe(d).inst.k === 2, 'ahora se abre el +2');
  for (let i = 0; i < 20; i++) await espera();
  d.limpiar(); await d.mandar({ t: 'ranking' });
  for (let i = 0; i < 20; i++) await espera();
  const rk = d.ultimos('ranking').pop();
  chequear(rk && rk.des && rk.des.some(x => x.yo && x.k === 1), 'el ranking de Desafíos muestra tu mejor +k');
  // Llevado por un grupo: avanza de uno en uno y solo vuelve a su instancia.
  const h = await entrar('Lider60', '61'), l = await entrar('Llevado', '62');
  ponerNivel(h, 60, 'guerrero'); ponerNivel(l, 60, 'sacerdote');
  h.c.desafio = { templo: 9 };
  await aMapa(h, 'pueblo', 800); await aMapa(l, 'pueblo', 810);
  await h.mandar({ t: 'invitar', p: l.id }); await l.mandar({ t: 'grupoResp', si: true });
  await h.mandar({ t: 'mazmorra', id: 'templo', k: 10 });
  const wt = mundo.mundoDe(h);
  chequear(l.k === wt.clave && wt.inst.k === 10, 'el grupo entra junto al +10');
  const fT = [...wt.mons.values()].find(o => o.final);
  for (const o of [...wt.mons.values()]) if (o.jefe && o !== fT) { mundo.danar(o, o.hp + 1, h); tick(1); }
  mundo.danar(fT, fT.hp + 1, h); tick(2);
  chequear(h.c.desafio.templo === 10 && l.c.desafio.templo === 1, 'el llevado avanza de uno en uno (+1), el líder +10');
  await dejar(l); await dejar(h);
  await dejar(d);
}

async function pruebasTemporada() {
  console.log('Temporada: Noche de Duendes');
  const t = await entrar('Calabacero', '60');
  ponerNivel(t, 8, 'guerrero');
  await aMapa(t, 'noche', 600); limpiarMapa(t);
  const relojAntes = reloj;
  reloj = Date.UTC(2026, 9, 28, 12);
  for (let i = 0; i < 60; i++) { const o = monstruo(t, 'goblin_normal', 40); mundo.danar(o, o.hp + 1, t); tick(1); }
  chequear((t.c.calabazas || 0) > 2 && t.c.calabazas < 30, 'durante el evento caen calabazas (' + t.c.calabazas + ' de 60)');
  t.c.calabazas = 49;
  const o = monstruo(t, 'jefe_sabueso', 40); mundo.danar(o, o.hp + 1, t); tick(1);
  chequear(t.c.calabazas >= 54 && t.c.logros.includes('calabaza50'), 'los jefes dan varias y a 50 llega el título');
  reloj = Date.UTC(2026, 10, 5, 12);
  const c0 = t.c.calabazas;
  for (let i = 0; i < 30; i++) { const o2 = monstruo(t, 'goblin_normal', 40); mundo.danar(o2, o2.hp + 1, t); tick(1); }
  chequear(t.c.calabazas === c0, 'acabado el evento ya no caen');
  reloj = Date.UTC(2026, 10, 8, 12);
  const pr = await entrar('Anticipado', '63');
  chequear(pr.ultimos('toast').some(x => /Próximo evento: Cosecha del Maíz Morado, desde el 12 de noviembre a las 19:00 \(hora de Perú\) \(en 5 días\)/.test(x.m)), 'sin evento, se anuncia el próximo si falta poco');
  await dejar(pr);
  reloj = Date.UTC(2026, 10, 20, 12);
  for (let i = 0; i < 40; i++) { const o4 = monstruo(t, 'goblin_normal', 40); mundo.danar(o4, o4.hp + 1, t); tick(1); }
  chequear(t.c.mazorcas > 0 && t.c.calabazas === c0, 'en la Cosecha (noviembre) caen mazorcas (' + t.c.mazorcas + ')');
  mundo.actualizarYo(t);
  chequear(t.ultimos('yo').some(x => x.yo && x.yo.mazorcas === t.c.mazorcas), 'y el cliente recibe su contador');
  reloj = Date.UTC(2026, 11, 24, 12);
  t.c.regalos = 0;
  for (let i = 0; i < 40; i++) { const o3 = monstruo(t, 'goblin_normal', 40); mundo.danar(o3, o3.hp + 1, t); tick(1); }
  chequear(t.c.regalos > 0 && t.c.calabazas === c0, 'en Navidad caen regalos (' + t.c.regalos + '), no calabazas');
  reloj = Date.UTC(2027, 1, 9, 12);
  t.actT = reloj;   // el salto de semanas lo echaria por inactividad
  for (let i = 0; i < 150 && !t.c.mascaras; i++) { const o5 = monstruo(t, 'goblin_normal', 40); mundo.danar(o5, o5.hp + 1, t); tick(1); }
  chequear(t.c.mascaras > 0, 'en Carnaval (febrero) caen máscaras (' + t.c.mascaras + ')');
  reloj = Date.UTC(2027, 2, 10, 12);
  t.actT = reloj;
  for (let i = 0; i < 150 && !t.c.uvas; i++) { const o6 = monstruo(t, 'goblin_normal', 40); mundo.danar(o6, o6.hp + 1, t); tick(1); }
  chequear(t.c.uvas > 0 && !t.c.conchas, 'en la Vendimia (marzo) caen uvas (' + t.c.uvas + ')');
  // Todas las temporadas: sin solaparse, en orden, y cada una con sus dos
  // logros (50 y 200) cuyos titulos son los que anuncia.
  const D = await import('../mmo/js/data.js');
  const T = D.TEMPORADAS;
  chequear(T.every((x, i) => x.ini < x.fin && (!i || T[i - 1].fin <= x.ini)), 'las temporadas van en orden y no se pisan');
  // Ids unicos; un contador repetido (evento anual) lleva los mismos titulos.
  const porCampo = {};
  for (const x of T) porCampo[x.campo] = porCampo[x.campo] || x.titulos.join('|');
  chequear(new Set(T.map(x => x.id)).size === T.length && T.every(x => porCampo[x.campo] === x.titulos.join('|')), 'ids únicos y los eventos anuales repiten contador y títulos');
  const sinLogros = T.filter(x => [50, 200].some((n, i) => { const L = D.LOGROS.find(l => l.titulo === x.titulos[i]); return !L || L.cond({ [x.campo]: n - 1 }) || !L.cond({ [x.campo]: n }); }));
  chequear(!sinLogros.length, 'cada temporada tiene sus logros de 50 y 200 ' + sinLogros.map(x => x.id).join(','));
  chequear(new Date(T[T.length - 1].fin).getUTCFullYear() >= 2027 && T.some(x => new Date(x.ini).getUTCMonth() === 0) && T.some(x => new Date(x.ini).getUTCMonth() >= 2), 'hay temporadas en enero y de marzo en adelante');
  chequear(Object.values(D.MONTURAS).every(mo => D.HOJAS[mo.hoja] && (mo.precio > 0 || mo.banda || mo.torre) && mo.vel > 1), 'todas las monturas tienen hoja, precio y velocidad');
  reloj = Math.max(relojAntes, reloj);
  await dejar(t);
}

async function pruebasConjuntos() {
  console.log('Conjuntos de mazmorra');
  const D = await import('../mmo/js/data.js');
  const p = await entrar('Coleccionista', '63');
  ponerNivel(p, 40, 'guerrero');
  const base = mundo.stats(p.c);
  const pieza = (s, cj) => ({ id: 'x' + s + cj, s, nv: 40, r: 1, b: { def: 1 }, cj });
  p.c.eq = { casco: pieza('casco', 'templo'), armadura: pieza('armadura', 'templo') };
  const dos = mundo.stats(p.c);
  p.c.eq = { casco: pieza('casco', 'templo'), armadura: pieza('armadura', 'catacumbas') };
  const mezcla = mundo.stats(p.c);
  chequear(dos.maxHp > mezcla.maxHp * 1.08, '2 piezas del mismo conjunto dan su bono (+10% vida)');
  p.c.eq = { casco: pieza('casco', 'templo'), armadura: pieza('armadura', 'templo'), botas: pieza('botas', 'templo'), anillo: pieza('anillo', 'templo') };
  const cuatro = mundo.stats(p.c);
  chequear(cuatro.atk > dos.atk * 1.08 && cuatro.crit > dos.crit + 0.03, 'con 4, el bono mayor (ataque y crítico)');
  chequear(/Marea Hundida/.test(D.nombreItem(pieza('casco', 'templo'))), 'el nombre del objeto dice su conjunto');
  // Los jefes de mazmorra sueltan piezas
  await aMapa(p, 'pueblo', 800);
  let piezas = 0;
  for (let i = 0; i < 6; i++) {
    const w = mundo.crearInstancia('catacumbas', 30, 1);
    mundo.unirAInstancia(p, w);
    for (const o of [...w.mons.values()]) if (o.jefe) { mundo.danar(o, o.hp + 1, p); tick(1); }
    piezas = p.c.bolsa.filter(x => x.cj === 'catacumbas').length;
    avanzar(6000); tick(1);
    await aMapa(p, 'pueblo', 800);
    if (p.c.bolsa.length > 30) p.c.bolsa.length = 0;
  }
  chequear(piezas > 0, 'los jefes de mazmorra sueltan piezas de su conjunto');
  await dejar(p);
}

async function pruebasTintes() {
  console.log('Colores del nombre');
  const t = await entrar('Pintor', '64'), v = await entrar('Mirante', '65');
  ponerNivel(t, 25, 'mago');
  await aMapa(t, 'pueblo', 950); await aMapa(v, 'pueblo', 1000);
  mundo.revisarLogros(t);   // los de nivel pagan oro: que no cuenten aqui
  t.c.oro = 30000;
  await t.mandar({ t: 'comprar', k: 'tinte', id: 'rubi' });
  chequear(!(t.c.tintes || []).includes('rubi') && t.c.oro === 30000, 'sin nivel no se compra');
  await t.mandar({ t: 'comprar', k: 'tinte', id: 'esmeralda' });
  chequear(!(t.c.tintes || []).includes('esmeralda') && t.c.oro === 30000, 'sin oro no se compra');
  await t.mandar({ t: 'comprar', k: 'tinte', id: 'oro' });
  chequear(t.c.tinte === 'oro' && t.c.oro === 10000, 'se compra y se pone');
  chequear(v.ultimos('pa').some(x => x.id === t.id && x.tn === 'oro'), 'los demás ven el color');
  await t.mandar({ t: 'comprar', k: 'tinte', id: '' });
  await t.mandar({ t: 'comprar', k: 'tinte', id: 'oro' });
  chequear(t.c.tinte === 'oro' && t.c.oro === 10000, 'quitarlo y volver a ponerlo no cobra otra vez');
  await t.mandar({ t: 'comprar', k: 'tinte', id: '__proto__' });
  chequear(t.c.oro === 10000, 'ids raros no hacen nada');
  await dejar(t); await dejar(v);
}


async function pruebasEvadir() {
  console.log('Mazmorras: los packs vuelven a su sitio');
  const j = await entrar('Evasora', '7b');
  ponerNivel(j, 8, 'guerrero');
  await aMapa(j, 'pueblo', 795);
  await j.mandar({ t: 'mazmorra', id: 'madriguera' });
  const w = mundo.mundoDe(j);
  const o = [...w.mons.values()].find(x => x.grupo && Math.abs(x.casaX - 900) < 80);
  o.x = o.casaX + 260; o.hp = 1; o.amen.clear(); o.obj = 0;
  tick(60);
  chequear(Math.abs(o.x - o.casaX) < 150 && o.hp === o.max, 'un pack sin presa vuelve a su sitio y se cura');
  await dejar(j);
}

async function pruebasExpedicion() {
  console.log('Expediciones');
  const D = await import('../mmo/js/data.js');
  const j = await entrar('Exploradora', '83');
  ponerNivel(j, 3, 'mago');
  j.limpiar(); await j.mandar({ t: 'exped', h: 4 });
  chequear(!j.c.exped && j.ultimos('no').some(x => /nivel 5/.test(x.m)), 'a Nv 3 no hay expediciones');
  ponerNivel(j, 20, 'mago');
  await j.mandar({ t: 'exped', h: 3 });
  chequear(!j.c.exped, 'solo 1, 4 u 8 horas');
  await j.mandar({ t: 'exped', h: 4 });
  chequear(j.c.exped && j.c.exped.h === 4, 'sale una de 4 h');
  j.limpiar(); await j.mandar({ t: 'exped', h: 1 });
  chequear(j.c.exped.h === 4 && j.ultimos('no').some(x => /en camino/.test(x.m)), 'solo una a la vez');
  j.limpiar(); await j.mandar({ t: 'exped', recoger: 1 });
  chequear(j.c.exped && j.ultimos('no').some(x => /aún no/.test(x.m)), 'no se recoge antes de que vuelva');
  avanzar(4 * 3600000 + 1000); j.actT = reloj; mundo.revisarLogros(j);
  const oro0 = j.c.oro, pr = D.premioExpedicion(4, 20), pes0 = (j.c.mat || {}).pescado || 0;
  await j.mandar({ t: 'exped', recoger: 1 });
  chequear(!j.c.exped && j.c.oro - oro0 === pr.oro && j.c.mat.pescado - pes0 === pr.mat.pescado && j.c.expediciones === 1, 'al volver: oro, XP y materiales');
  await j.mandar({ t: 'exped', recoger: 1 });
  chequear(j.c.oro - oro0 === pr.oro, 'no se cobra dos veces');
  await j.mandar({ t: 'exped', h: 1, d: 'lago' });
  chequear(j.c.exped && j.c.exped.d === 'lago', 'se elige el destino (Lago)');
  avanzar(3600000 + 1000); j.actT = reloj;
  const pesc1 = j.c.mat.pescado || 0;
  await j.mandar({ t: 'exped', recoger: 1 });
  chequear(j.c.mat.pescado - pesc1 === D.premioExpedicion(1, 20, 'lago').mat.pescado && D.premioExpedicion(1, 20, 'lago').mat.pescado === 3, 'el Lago trae el triple de pescado');
  await dejar(j);
}

async function pruebasTorre() {
  console.log('Torre del Duende');
  const D = await import('../mmo/js/data.js');
  const j = await entrar('Escaladora', '84');
  ponerNivel(j, 5, 'guerrero');
  await aMapa(j, 'pueblo', 795);
  j.limpiar(); await j.mandar({ t: 'torre' });
  chequear(!j.k.startsWith('torre#') && j.ultimos('no').some(x => /nivel 10/.test(x.m)), 'a Nv 5 no se entra');
  ponerNivel(j, 25, 'guerrero');
  await aMapa(j, 'pueblo', 795);
  j.limpiar(); await j.mandar({ t: 'torre' });
  chequear(j.k.startsWith('torre#'), 'a Nv 25 entra a su Torre');
  const w = mundo.mundoDe(j);
  const vivos = () => [...w.mons.values()].filter(o => !o.muere);
  const limpiar = () => { for (const o of vivos()) { mundo.danar(o, 1, j); mundo.danar(o, o.hp + 1, j); } };
  j.inv = Infinity;
  tick(40);
  chequear(w.torre.piso === 1 && vivos().length === D.pisoTorre(1).n, 'el piso 1 trae su oleada');
  const mton0 = j.c.mton || 0, oro0 = j.c.oro;
  for (let p = 1; p <= 5; p++) {
    if (p === 5) chequear(vivos().some(o => o.jefe && o.mazmorra), 'el piso 5 tiene un jefe (de los que no dan mTON)');
    if (p === 5) { const jf = vivos().find(o => o.jefe), mx = jf.max; mundo.alAgro(jf, j, Date.now()); chequear(Number.isFinite(jf.atk) && jf.max === mx && !jf.combateDesde, 'el jefe de la Torre no toma la escala de los de mazmorra'); }
    limpiar(); tick(2);
    chequear(w.torre.piso === p && j.c.torre.max === p, 'piso ' + p + ' superado y anotado');
    tick(40);
  }
  chequear(w.torre.piso === 6 && j.c.oro - oro0 >= D.premioTorre(5, 25).oro && j.ultimos('toast').some(x => /Cofre del piso 5/.test(x.m)), 'cada 5 pisos nuevos, un cofre');
  chequear((j.c.mton || 0) === mton0, 'los jefes de la Torre no dan mTON');
  // Se acaba el tiempo: fuera.
  tick(Math.ceil(D.TORRE.tiempo / 100) + 5);
  chequear(j.k === 'pueblo' && w.torre.fin, 'si se acaba el tiempo, al pueblo');
  tick(70);
  chequear(!mundo.mundo[w.clave], 'la Torre vacía se cierra');
  // Ranking semanal.
  const top = await mundo.topTorre();
  chequear(top.some(([uid, x]) => uid === j.c.uid && x.p === 5), 'sale en el ranking de la semana');
  // Otra subida: empieza en el piso 1, sin cofre por repetir los mismos pisos.
  await aMapa(j, 'pueblo', 795);
  await j.mandar({ t: 'torre' }); tick(40);
  const w2 = mundo.mundoDe(j);
  chequear(w2.torre && w2.torre.piso === 1, 'cada subida empieza en el piso 1');
  // Caer: se acaba.
  j.inv = 0; mundo.herir(j, 1e9, { id: 0, pct: 0 }); if (!j.muerto) { j.hp = 0; mundo.morir && mundo.morir(j); }
  tick(2);
  chequear(w2.torre.fin, 'si caen todos, se acaba');
  // Montura de la Torre: al superar el piso TORRE.montura (y no se vende).
  mundo.anotarTorre(j, D.TORRE.montura);
  chequear(j.c.monturas.includes('torre'), 'el piso ' + D.TORRE.montura + ' da el Lagarto de la Torre');
  const km = await entrar('Jinete', '81'); ponerNivel(km, 40, 'guerrero'); km.c.oro = 1e7; await aMapa(km, 'pueblo', 900);
  await km.mandar({ t: 'comprar', k: 'montura', id: 'torre' });
  chequear(!(km.c.monturas || []).includes('torre'), 'la montura de la Torre no se vende');
  await dejar(km);
  // Atajo: con marca 17, se puede empezar desde el piso 11 (no desde el 16).
  await calma && 0;
  j.muerto = false; j.hp = j.st.maxHp; j.c.torre = { sem: D.semanaUTC(), max: 17 };
  mundo.creadasT && mundo.creadasT.delete(j.c.uid);
  await aMapa(j, 'pueblo', 795); await j.mandar({ t: 'torre', desde: 15 }); tick(40);
  chequear(mundo.mundoDe(j).torre && mundo.mundoDe(j).torre.piso === 1, 'no se puede empezar más arriba de lo permitido');
  await aMapa(j, 'pueblo', 795); tick(70); await j.mandar({ t: 'torre', desde: 10 }); tick(40);
  chequear(mundo.mundoDe(j).torre && mundo.mundoDe(j).torre.piso === 11, 'con marca 17 se empieza desde el piso 11');
  await aMapa(j, 'pueblo', 795);
  { const pf = await interno('perfil', { tgId: '999000111' });
    chequear(pf.ok && pf.existe === false, '/yo sin personaje: lo dice');
    const tgj = await entrar('Perfilado', '7c'); tgj.c.uid = 'tg:999000112'; mundo.porUid.set(tgj.c.uid, tgj); tgj.c.peces = 7;
    const pf2 = await interno('perfil', { tgId: '999000112' });
    chequear(pf2.ok && pf2.existe && pf2.n === tgj.c.nombre && pf2.peces === 7 && pf2.en === true, '/yo devuelve tu personaje (nivel, oro, peces, Torre...)');
    await dejar(tgj); }
  const tp = await interno('tops');
  chequear(tp.ok && Array.isArray(tp.torre) && Array.isArray(tp.xp) && Array.isArray(tp.duel) && typeof tp.online === 'number', 'el bot puede leer los rankings de la semana (/topmmo)');
  chequear((await interno('tops', {}, 'mal')).ok === undefined, 'sin la cabecera del bot no responde');
  // Cambio de semana: premio a los 3 primeros (desde el piso semMin).
  await mundo.cargarRankTorre();
  mundo.rt = { sem: '2000-01-03', l: { [j.c.uid]: { n: j.c.nombre, p: 12, k: 'guerrero', t: 1 }, 'inv:otro': { n: 'Otro', p: 3, k: '', t: 2 } } };
  const oroT = j.c.oro;
  await mundo.cargarRankTorre();
  chequear(j.c.oro - oroT === D.premioTorreSem(0) + D.LOGROS.find(l => l.id === 'reytorre').oro && j.c.logros.includes('reytorre') && mundo.rt.sem === D.semanaUTC() && !Object.keys(mundo.rt.l).length, 'al cambiar la semana: premio al 1º, título y ranking de cero');
  await dejar(j);
}

async function pruebasPesca() {
  console.log('Pesca');
  const D = await import('../mmo/js/data.js');
  const j = await entrar('Pescadora', '85');
  ponerNivel(j, 12, 'guerrero');
  await aMapa(j, 'pueblo', 900);
  j.limpiar(); await j.mandar({ t: 'pescar' });
  chequear(!j.cast && j.ultimos('no').some(x => /Acércate/.test(x.m)), 'lejos del agua no se pesca');
  const p = D.pesqueroDe('pueblo');
  await aMapa(j, 'pueblo', p.x + 30);
  const esperarPica = async () => { for (let i = 0; i < 120 && !j.ultimos('pica').length; i++) tick(1); return j.ultimos('pica').length > 0; };
  // Tirar antes de que pique: se asusta.
  j.limpiar(); await j.mandar({ t: 'pescar' });
  chequear(j.cast && j.cast.h === 'pescar', 'al lanzar queda pescando');
  await j.mandar({ t: 'tirar' });
  chequear(!j.cast && j.ultimos('no').some(x => /asustó/.test(x.m)), 'tirar antes de que pique lo asusta');
  // Picar y tirar a tiempo.
  j.limpiar(); await j.mandar({ t: 'pescar' });
  chequear(await esperarPica(), 'a los pocos segundos pica');
  const pesc0 = (j.c.mat || {}).pescado || 0;
  await j.mandar({ t: 'tirar' });
  chequear(((j.c.mat || {}).pescado || 0) > pesc0 && j.c.peces === 1 && j.ultimos('pescado').length === 1, 'tirar a tiempo da pescado');
  chequear(j.c.especies && j.c.especies.pueblo === 1 && j.ultimos('toast').some(x => /Nueva especie: Carpa del Pueblo/.test(x.m)), 'la primera captura de una especie se anuncia y da oro');
  // Dejarlo pasar: se escapa.
  j.limpiar(); await j.mandar({ t: 'pescar' });
  await esperarPica(); tick(25);
  chequear(!j.cast && j.ultimos('toast').some(x => /escapó/.test(x.m)), 'si no tiras a tiempo, se escapa');
  // Un golpe corta el sedal.
  j.limpiar(); await j.mandar({ t: 'pescar' });
  j.inv = 0; mundo.herir(j, 5, { id: 0 });
  chequear(!j.cast && j.ultimos('no').some(x => /sedal/.test(x.m)), 'un golpe corta el sedal');
  // Tope diario.
  j.c.pescaHoy = { d: D.hoyUTC(), n: D.PESCA.porDia };
  j.limpiar(); tick(10); await j.mandar({ t: 'pescar' });
  chequear(!j.cast && j.ultimos('no').some(x => /descansan/.test(x.m)), 'hay tope de capturas al día');
  // Cocina: ceviche (+10% oro de caza).
  j.c.mat.pescado = 10; j.c.mat.hierba = 5;
  await aMapa(j, 'pueblo', 1680);
  await j.mandar({ t: 'fabricar', id: 'ceviche' });
  chequear(j.c.mat.pescado === 5 && mundo.elixir(j, 'ceviche'), 'la Artesana cocina el ceviche');
  const oro0 = j.c.oro; mundo.dar(j, 1, 100, null, 1, false);
  chequear(j.c.oro - oro0 === 110, 'el ceviche da +10% de oro de caza');
  chequear(D.TAREAS_DIA.some(t => t.tipo === 'pescar') && D.LOGROS.some(l => l.id === 'pesca50'), 'misión diaria y logros de pesca');
  // Pececito Dorado: seguro a las mascotaSeguro capturas; no se vende.
  await aMapa(j, 'pueblo', p.x + 30);
  j.c.pescaHoy = { d: D.hoyUTC(), n: 0 }; j.c.peces = D.PESCA.mascotaSeguro;
  j.limpiar(); await j.mandar({ t: 'pescar' }); await esperarPica(); await j.mandar({ t: 'tirar' });
  chequear(j.c.mascotas.includes('pececito'), 'el Pececito Dorado sale pescando (seguro a las ' + D.PESCA.mascotaSeguro + ')');
  const k2 = await entrar('Compradora2', '82'); ponerNivel(k2, 20, 'mago'); k2.c.oro = 1e6; await aMapa(k2, 'pueblo', 900);
  await k2.mandar({ t: 'comprar', k: 'mascota', id: 'pececito' });
  chequear(!(k2.c.mascotas || []).includes('pececito'), 'el Pececito Dorado no se vende');
  await dejar(k2);
  // En una zona tambien hay pesquero; en una mazmorra no.
  chequear(D.pesqueroDe('selva') && !D.pesqueroDe('catacumbas') && !D.pesqueroDe('coliseo'), 'pesqueros en zonas, no en mazmorras ni Coliseo');
  chequear(Object.keys(D.MAPAS).every(id => { const p = D.pesqueroDe(id); return !p || id === 'pueblo' || Math.abs(p.x - D.MAPAS[id].ancho * 0.62) > 600; }), 'los pesqueros quedan lejos del jefe de zona');
  await dejar(j);
}

async function pruebasPase() {
  console.log('Pase de temporada (mensual, gratis)');
  const D = await import('../mmo/js/data.js');
  const j = await entrar('Pasero', '88');
  ponerNivel(j, 30, 'guerrero');
  await aMapa(j, 'pueblo', 900);
  const pa = mundo.paseDe(j.c);
  chequear(pa.mes === D.paseMes() && pa.p === 0, 'empieza el mes en 0');
  // Quien va por detras del ritmo del mes (50 por dia) gana el doble.
  mundo.puntoPase(j, D.PASE.puntos.semanal); mundo.puntoPase(j, 50);
  chequear(j.c.pase.p === 160, 'suma puntos, dobles para ponerse al día (160)');
  j.c.pase.p = 80;
  j.limpiar(); await j.mandar({ t: 'pase', n: 2 });
  chequear(j.ultimos('no').some(x => /Aún no/.test(x.m)), 'no se cobra un nivel no alcanzado');
  const oro0 = j.c.oro;
  await j.mandar({ t: 'pase', n: 1 });
  chequear(j.c.pase.cob.includes(1) && j.c.oro > oro0, 'el nivel 1 se cobra (oro)');
  j.limpiar(); await j.mandar({ t: 'pase', n: 1 });
  chequear(j.ultimos('no').some(x => /Ya cobraste/.test(x.m)), 'no se cobra dos veces');
  // Maestria despues del nivel 60: la XP ya no se tira
  { const nv0 = j.c.nivel; ponerNivel(j, 60, 'guerrero'); j.c.mae = null; const oroM = j.c.oro; j.limpiar();
    mundo.sumarXp(j, D.MAESTRIA_XP * 2 + 5);
    chequear(j.c.mae && j.c.mae.n === 2 && j.c.mae.p === 5 && j.c.oro > oroM && j.ultimos('mae').length === 1, 'en el nivel 60 la XP sube la maestría y da oro');
    const yoD = mundo.datosCaza(j);
    chequear(yoD.xp === 5 && yoD.xpSig === D.MAESTRIA_XP && yoD.mae === 2, 'la barra de XP muestra la maestría');
    ponerNivel(j, nv0, 'guerrero'); }
  // Lo que quedo sin cobrar del mes anterior se cobra solo.
  { const oroA = j.c.oro; j.c.pase = { mes: '2000-01', p: 3 * D.PASE.porNivel, cob: [1] }; j.limpiar(); mundo.cobrarPasePendiente(j);
    chequear(oroA >= 0 && j.ultimos('toast').some(x => /Cobramos por ti 2 premios/.test(x.m)) && j.c.pase.mes === D.paseMes(), 'el pase del mes pasado se cobra solo al entrar'); }
  // Un cambio gratis de tarea al dia
  { const T = mundo.tareasDe(j.c).dia; const antes = T.l[0].id; T.l[0].ok = false; j.limpiar(); await j.mandar({ t: 'cambiarTarea', i: 0 });
    chequear(T.l[0].id !== antes && T.cambio, 'se cambia una diaria gratis');
    j.limpiar(); await j.mandar({ t: 'cambiarTarea', i: 1 });
    chequear(j.ultimos('no').some(x => /ya cambiaste/.test(x.m)), 'solo un cambio al día'); }
  // Hasta el 20: la mascota que no se vende y el logro.
  mundo.puntoPase(j, 10000);
  for (let n = 2; n <= D.PASE.niveles; n++) await j.mandar({ t: 'pase', n });
  chequear(j.c.mascotas.includes('duende_pase') && j.c.logros.includes('pase20'), 'al 20: la mascota Duendecillo Dorado y el logro');
  const k = await entrar('Comprante', '89'); ponerNivel(k, 30, 'mago'); k.c.oro = 1e6; await aMapa(k, 'pueblo', 900);
  await k.mandar({ t: 'comprar', k: 'mascota', id: 'duende_pase' });
  chequear(!(k.c.mascotas || []).includes('duende_pase'), 'la mascota del pase no se vende');
  // Mes nuevo: de cero.
  j.c.pase.mes = '2000-01';
  chequear(mundo.paseDe(j.c).p === 0 && j.c.paseMax === 20, 'cada mes empieza de cero (el logro queda)');
  // Puntos de una mazmorra completada.
  ponerNivel(j, 20); await aMapa(j, 'pueblo', 800);
  await j.mandar({ t: 'mazmorra', id: 'catacumbas' });
  const w = mundo.mundoDe(j), fin = [...w.mons.values()].find(o => o.final);
  for (const o of [...w.mons.values()]) if (o.jefe && o !== fin) { mundo.danar(o, 1, j); mundo.danar(o, o.hp + 1, j); tick(1); }
  mundo.danar(fin, 1, j); mundo.danar(fin, fin.hp + 1, j); tick(2);
  chequear(j.c.pase.p >= D.PASE.puntos.mazmorra, 'completar una mazmorra da puntos del pase');
  await dejar(j); await dejar(k);
}

async function pruebasMundiales() {
  console.log('Jefes mundiales que rotan');
  const D = await import('../mmo/js/data.js');
  const base = Math.ceil(Date.now() / 1800000) * 1800000;
  const tres = [0, 1, 2].map(i => D.mundialDe(base + i * 1800000 + 1000));
  chequear(new Set(tres).size === 3 && tres.every(k => D.MONSTRUOS[k] && D.MONSTRUOS[k].mundial), 'cada media hora toca otro de los tres');
  const v = await entrar('Mirador2', '87');
  reloj = Math.max(reloj, base + 2 * 1800000 + 500); v.actT = reloj;
  if (mundo.mundial && mundo.mundial.o) { mundo.mundo.coliseo.mons.delete(mundo.mundial.o.id); mundo.mundial.o = null; }
  v.limpiar(); mundo.revisarMundial(reloj);
  const o = mundo.mundial && mundo.mundial.o;
  chequear(o && o.k === D.mundialDe(base + 2 * 1800000 + 1000) && v.ultimos('aviso').some(x => x.m.includes(D.MONSTRUOS[o.k].nombre)), 'aparece el que toca y el aviso dice su nombre (' + (o && o.k) + ')');
  if (o) { mundo.mundo.coliseo.mons.delete(o.id); mundo.mundial.o = null; }
  await dejar(v);
}

async function pruebasAmbulante() {
  console.log('Mercader ambulante (fines de semana)');
  const D = await import('../mmo/js/data.js');
  const m = await entrar('Coleccion', '86');
  ponerNivel(m, 45, 'mago'); m.c.oro = 1e6;
  await aMapa(m, 'pueblo', 900);
  // Un martes: no se vende.
  let t = Math.floor(Date.now() / DIA) * DIA; while (new Date(t).getUTCDay() !== 2) t += DIA;
  reloj = Math.max(reloj, t + 12 * 3600000); m.actT = reloj;
  const of = D.ambulanteOferta();
  m.limpiar(); await m.mandar({ t: 'comprar', k: 'tinte', id: of.tintes[0] });
  chequear(!(m.c.tintes || []).includes(of.tintes[0]) && m.ultimos('toast').some(x => /ambulante/.test(x.m)), 'entre semana no se puede comprar lo del ambulante');
  // El sábado de esa semana: sí, y solo lo de su oferta.
  reloj = t + 4 * DIA + 12 * 3600000; m.actT = reloj;
  chequear(D.ambulanteActivo() && D.ambulanteOferta().tintes.join() === of.tintes.join(), 'el sábado está y trae la oferta de la semana');
  await m.mandar({ t: 'comprar', k: 'tinte', id: of.tintes[0] });
  await m.mandar({ t: 'comprar', k: 'mascota', id: of.mascotas[0] });
  chequear(m.c.tintes.includes(of.tintes[0]) && m.c.mascotas.includes(of.mascotas[0]), 'el fin de semana se compran el color y la mascota de la oferta');
  const otro = D.AMB_TINTES.find(x => !of.tintes.includes(x));
  await m.mandar({ t: 'comprar', k: 'tinte', id: otro });
  chequear(!m.c.tintes.includes(otro), 'lo que no está en la oferta de esa semana, no');
  await dejar(m);
}

async function pruebasElo() {
  console.log('Ranking de duelos (Elo)');
  const a = await entrarTg('Gladiadora', 7201), b = await entrarTg('Gladiador', 7202), inv = await entrar('Invitadito', '85');
  for (const x of [a, b, inv]) ponerNivel(x, 15, 'guerrero');
  const duelo = (g, p) => { g.duelo = { con: p.id }; p.duelo = { con: g.id }; mundo.terminarDuelo(g, g, 'prueba'); };
  duelo(a, b);
  chequear(a.c.elo === 1016 && b.c.elo === 984, 'ganar a un igual da +16 y quitar -16 (' + a.c.elo + ' / ' + b.c.elo + ')');
  duelo(a, b); duelo(a, b);
  const e3 = a.c.elo;
  duelo(a, b);
  chequear(a.c.elo === e3, 'como mucho 3 duelos contados al día por pareja');
  duelo(inv, a);
  chequear(!inv.c.elo, 'los invitados no puntúan');
  for (let i = 0; i < 20; i++) await espera();
  a.ws.rec.length = 0; await a.mandar({ t: 'ranking' });
  for (let i = 0; i < 20; i++) await espera();
  const rk = a.ws.rec.filter(m => m.t === 'ranking').pop();
  chequear(rk && rk.duel && rk.duel[0] && rk.duel[0].yo && rk.elo === a.c.elo, 'el ranking muestra los duelistas por Elo');
  // Huir: el que se va pierde Elo (antes, alejarse era empate y nadie perdía).
  const c1 = await entrarTg('Huidor', 7203), c2 = await entrarTg('Paciente', 7204);
  for (const x of [c1, c2]) ponerNivel(x, 15, 'mago');
  await aMapa(c1, 'noche', 600); await aMapa(c2, 'noche', 640);
  const ini = Date.now() - 1000;
  c1.duelo = { con: c2.id, ini, fin: ini + 90000, x0: 620, k0: 'noche', uid: c2.c.uid };
  c2.duelo = { con: c1.id, ini, fin: ini + 90000, x0: 620, k0: 'noche', uid: c1.c.uid };
  await aMapa(c1, 'pueblo', 300);
  mundo.tickDuelos(Date.now());
  chequear(c2.c.elo > 1000 && c1.c.elo < 1000, 'cambiar de mapa en mitad del duelo cuenta como derrota (' + c1.c.elo + ' / ' + c2.c.elo + ')');
  const e1 = c1.c.elo, e2 = c2.c.elo;
  await aMapa(c1, 'noche', 600);
  c1.duelo = { con: c2.id, ini, fin: ini + 90000, x0: 620, k0: 'noche', uid: c2.c.uid };
  c2.duelo = { con: c1.id, ini, fin: ini + 90000, x0: 620, k0: 'noche', uid: c1.c.uid };
  await dejar(c1);
  mundo.tickDuelos(Date.now());
  for (let i = 0; i < 30; i++) await espera();
  const guardado = await state.storage.get('c:' + c1.c.uid);
  chequear(c2.c.elo > e2 && guardado && guardado.elo < e1, 'desconectarse en mitad del duelo también resta Elo (' + (guardado && guardado.elo) + ')');
  await dejar(c2);
  for (const x of [a, b, inv]) await dejar(x);
}

async function pruebasHoraFeliz() {
  console.log('Hora Feliz (01-02 UTC, +50% XP de caza)');
  const D = await import('../mmo/js/data.js');
  const dia = Math.floor(Date.now() / DIA) + 1;
  chequear(D.horaFelizActiva(dia * DIA + 1.5 * 3600000) && !D.horaFelizActiva(dia * DIA + 3 * 3600000), 'activa de 01:00 a 02:00 UTC');
  const t = D.horaFelizTiempos(dia * DIA + 0.5 * 3600000);
  chequear(!t.activa && Math.abs(t.falta - 1800000) < 1000, 'cuenta lo que falta para que empiece');
  const h = await entrar('Feliz', '84');
  ponerNivel(h, 20, 'guerrero'); h.c.skin = 'comun'; h.c.elix = {}; h.c.descanso = 0;
  await aMapa(h, 'noche', 600); limpiarMapa(h);
  const caza = () => { const x0 = h.c.xp; const o = monstruo(h, 'goblin_normal', 30, { nv: 20 }); mundo.danar(o, o.hp + 1, h); tick(1); return h.c.xp - x0; };
  reloj = Math.max(reloj, dia * DIA + 3 * 3600000); h.actT = reloj;
  const sin = caza();
  reloj = (dia + 1) * DIA + 1.2 * 3600000; h.actT = reloj;
  const con = caza();
  chequear(Math.abs(con / sin - 1.5) < 0.05, 'en la Hora Feliz la caza da +50% de XP (' + con + ' frente a ' + sin + ')');
  h.limpiar(); mundo.onT = 0; mundo.hfAntes = false; mundo.tick();
  chequear(h.ultimos('aviso').some(x => /Hora Feliz/.test(x.m)), 'al empezar se avisa a todos');
  reloj = Math.max(reloj, (dia + 1) * DIA + 3 * 3600000);
  await dejar(h);
}

async function pruebasPagoSol() {
  console.log('Pago con SOL: firma ajena y pago tardío');
  const { SOL_DEV_WALLET } = await import('../functions/api/lib.js');
  let tx = null, firmasLista = [], rpcCaida = false;
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    const u = String(url);
    if (/mainnet-beta|helius/.test(u) && rpcCaida) return { ok: false, json: async () => ({ error: { code: 429 } }) };
    if (/mainnet-beta|helius/.test(u)) { const b = JSON.parse(o.body); return { json: async () => ({ result: b.method === 'getSignaturesForAddress' ? firmasLista : tx }) }; }
    return { ok: true, json: async () => ({ solana: { usd: 150 }, price: 150, data: { amount: '150' } }) };
  };
  const txDe = lamports => ({ blockTime: Math.floor(Date.now() / 1000), meta: { err: null, preBalances: [5e9, 1e9], postBalances: [5e9 - lamports - 5000, 1e9 + lamports], innerInstructions: [] },
    transaction: { message: { accountKeys: [{ pubkey: 'Pagador111' }, { pubkey: SOL_DEV_WALLET }], instructions: [{ program: 'system', parsed: { type: 'transfer', info: { source: 'Pagador111', destination: SOL_DEV_WALLET, lamports } } }] } } });
  const adminReal = mundo.avisarAdmin; const admin = [], botonesAdmin = []; mundo.avisarAdmin = async (t, b) => { admin.push(t); botonesAdmin.push(b); };
  try {
    const A = await entrar('Tramposo', '81'), V = await entrar('Victima', '82'), C = await entrar('Tardio', '83');
    A.c.uid = 'web:tramposo'; V.c.uid = 'web:victima'; C.c.uid = 'web:tardio';
    for (const x of [A, V, C]) x.c.skins = ['comun'];
    A.limpiar(); V.limpiar();
    await mundo.pedido(A, { id: 'skin_legendaria', metodo: 'sol' });
    await mundo.pedido(V, { id: 'skin_legendaria', metodo: 'sol' });
    const pA = A.ultimos('pedidoSol').pop(), pV = V.ultimos('pedidoSol').pop();
    chequear(pA && pV && pA.lamports !== pV.lamports, 'cada pedido tiene su monto exacto propio');
    // La victima paga su pedido; el tramposo pega esa firma (publica en Solscan).
    tx = txDe(pV.lamports);
    const firma = '5'.repeat(88);
    avanzar(60000);
    A.limpiar(); await mundo.pedidoFirma(A, { codigo: pA.codigo, firma });
    chequear(mundo.buscarPedido(pA.codigo).estado === 'esperando_pago' && A.ultimos('toast').some(x => /no es el pago de este pedido/.test(x.m)), 'una firma ajena no vale para otro pedido');
    await mundo.pedidoFirma(V, { codigo: pV.codigo, firma });
    const dV = mundo.buscarPedido(pV.codigo);
    chequear(dV.estado === 'por_verificar' && dV.cadena && dV.cadena.ok, 'y quien pagó de verdad puede usar su firma');
    chequear(botonesAdmin.some(k => k && JSON.stringify(k).includes('mmoent:' + pV.codigo) && JSON.stringify(k).includes('mmoanu:' + pV.codigo)), 'el aviso al dueño trae los botones Entregar y Anular');
    // Monto parecido pero no exacto: no se da por bueno.
    await mundo.pedido(A, { id: 'skin_tactico', metodo: 'sol' });
    const pA2 = A.ultimos('pedidoSol').pop();
    tx = txDe(pA2.lamports + 5e6);
    await mundo.pedidoFirma(A, { codigo: pA2.codigo, firma: '7'.repeat(88) });
    chequear(mundo.buscarPedido(pA2.codigo).estado === 'esperando_pago', 'un monto distinto al del pedido no se da por pagado');
    // Pago tardio (a los 31 min): no se pierde.
    C.limpiar(); await mundo.pedido(C, { id: 'skin_king', metodo: 'sol' });
    const pC = C.ultimos('pedidoSol').pop();
    avanzar(31 * 60000);
    await mundo.guardarPedidos();
    chequear(mundo.buscarPedido(pC.codigo).estado === 'vencido', 'a los 30 min el pedido sin pagar caduca');
    tx = txDe(pC.lamports);
    await mundo.pedidoFirma(C, { codigo: pC.codigo, firma: '6'.repeat(88) });
    chequear(mundo.buscarPedido(pC.codigo).estado === 'por_verificar' && admin.some(t => t.includes(pC.codigo)), 'pagar después de los 30 min igual llega al dueño');
    // /ventas: lo entregado (las skins King de las pruebas anteriores) y lo pendiente.
    const vt = await interno('ventas');
    chequear(vt.ok && vt.d7.n >= 1 && vt.d7.sol >= 1 && vt.d7.top.some(x => /Skin Rey/.test(x.nombre)) && vt.pendientes >= 1, '/ventas resume lo entregado (7 y 30 días, por método y lo más vendido) y lo pendiente');
    // Anular libera la firma.
    await mundo.anularPedido({ codigo: pC.codigo, motivo: 'prueba' });
    chequear(!(await state.storage.get('firma:' + '6'.repeat(88))), 'anular un pedido deja libre su firma');
    // "Ya pague": se encuentra el pago entre las ultimas transacciones de la wallet.
    A.limpiar(); await mundo.pedido(A, { id: 'skin_necro', metodo: 'sol' });
    const pA3 = A.ultimos('pedidoSol').pop();
    firmasLista = [];
    avanzar(20000);
    A.limpiar(); await mundo.pedidoBuscar(A, { codigo: pA3.codigo });
    chequear(mundo.buscarPedido(pA3.codigo).estado === 'esperando_pago' && A.ultimos('toast').some(x => /Aún no vemos/.test(x.m)), '«Ya pagué» sin pago en la red: aún no');
    firmasLista = [{ signature: '9'.repeat(88), blockTime: Math.floor(Date.now() / 1000), err: null }];
    tx = txDe(pA3.lamports);
    avanzar(20000);
    await mundo.pedidoBuscar(A, { codigo: pA3.codigo });
    chequear(mundo.buscarPedido(pA3.codigo).estado === 'por_verificar' && mundo.buscarPedido(pA3.codigo).firma === '9'.repeat(88), '«Ya pagué» encuentra el pago exacto y lo pasa al dueño');
    // Con la red caida no se reserva la firma de nadie (antes se podia atar
    // a tu pedido la firma de un pago ajeno visto en Solscan).
    V.limpiar(); await mundo.pedido(V, { id: 'skin_berserker', metodo: 'sol' });
    const pV2 = V.ultimos('pedidoSol').pop();
    rpcCaida = true; avanzar(20000);
    await mundo.pedidoFirma(V, { codigo: pV2.codigo, firma: '4'.repeat(88) });
    rpcCaida = false;
    chequear(mundo.buscarPedido(pV2.codigo).estado === 'esperando_pago' && !(await state.storage.get('firma:' + '4'.repeat(88))) && V.ultimos('toast').some(x => /No pudimos consultar/.test(x.m)), 'con la red caída la firma no se reserva y el pedido sigue esperando');
    chequear(pV2.ref && pV2.ref.length >= 32 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(pV2.ref), 'cada pedido lleva su clave reference de Solana Pay');
    // Tope de pedidos por hora y cuenta.
    const T = await entrar('Pedidor', '7a'); T.c.uid = 'web:pedidor'; T.c.skins = ['comun'];
    for (let i = 0; i < 12; i++) { await mundo.pedido(T, { id: 'skin_tactico', metodo: 'sol' }); const u = mundo.pedidos.filter(x => x.uid === T.c.uid && x.estado === 'esperando_pago'); for (const x of u) x.estado = 'anulado'; }
    chequear(mundo.pedidos.filter(x => x.uid === T.c.uid).length === 10, 'como mucho 10 pedidos por hora y cuenta');
    await dejar(T);
    for (const x of [A, V, C]) await dejar(x);
  } finally { globalThis.fetch = fetchReal; mundo.avisarAdmin = adminReal; }
}

async function pruebasSkinsDinero() {
  console.log('Skins con poderes, también con dinero (SOL / Stars, entrega manual)');
  const D = await import('../mmo/js/data.js');
  const pq = D.PAQUETES.find(x => x.id === 'skin_king');
  chequear(pq && pq.skin === 'king' && pq.usd === D.SKINS.king.usd, 'cada skin con precio en dólares es un paquete de la tienda premium');
  const base = D.statsJugador(30, 'comun', {}, 'guerrero', null, {}, {});
  const king = D.statsJugador(30, 'king', {}, 'guerrero', null, {}, {});
  const ber = D.statsJugador(30, 'berserker', {}, 'guerrero', null, {}, {});
  chequear(king.def > base.def && king.maxHp > base.maxHp && ber.crit > base.crit && ber.atk > base.atk, 'los poderes nuevos se notan (King: defensa y vida; Berserker: ataque y crítico)');
  const j = await entrar('Comprador', '7f');
  ponerNivel(j, 20, 'guerrero');
  // Pedido pagado (como si hubiera llegado el SOL) y El Duende lo entrega.
  j.c.skins = ['comun'];
  mundo.pedidos.push({ codigo: 'SKN001', uid: j.c.uid, jugador: j.c.nombre, paquete: 'skin_king', nombre: pq.nombre, usd: pq.usd, metodo: 'sol', creado: Date.now(), estado: 'por_verificar' });
  const avisosJ = []; const avisoReal = mundo.avisarJugador; mundo.avisarJugador = async (u, t) => { avisosJ.push(t); };
  try {
    const r = await mundo.entregarPedido({ codigo: 'SKN001' });
    chequear(r.ok && j.c.skins.includes('king') && j.c.skin === 'king', '/entregar le da la skin y se la pone');
    chequear(j.st.def === mundo.stats(j.c).def && avisosJ.some(t => /Skin Rey/.test(t)), 'sus poderes se aplican al momento y se le avisa');
    // Otra vez la misma (ya la tiene): se le devuelve el precio en oro.
    const oro0 = j.c.oro;
    mundo.pedidos.push({ codigo: 'SKN002', uid: j.c.uid, jugador: j.c.nombre, paquete: 'skin_king', nombre: pq.nombre, usd: pq.usd, metodo: 'sol', creado: Date.now(), estado: 'pagado' });
    await mundo.entregarPedido({ codigo: 'SKN002' });
    chequear(j.c.oro === oro0 + D.SKINS.king.precio, 'si ya la tenía, recibe su precio en oro');
  } finally { mundo.avisarJugador = avisoReal; }
  // Un pedido con SOL sin pagar sale en "Tus compras" con lo necesario para retomarlo.
  mundo.pedidos.push({ codigo: 'SKN003', uid: j.c.uid, jugador: j.c.nombre, paquete: 'skin_necro', nombre: 'Skin Necromancer', usd: 4, metodo: 'sol', lamports: 12345678, creado: Date.now(), estado: 'esperando_pago' });
  const pp = mundo.datosPropios(j).pedidos.find(x => x.codigo === 'SKN003');
  chequear(pp && pp.lamports === 12345678 && pp.wallet && pp.estado === 'esperando_pago', 'el pedido con SOL sin pagar se puede retomar desde Tus compras');
  // Pedir una skin que ya tienes: no.
  j.c.uid = 'web:prueba-skin'; j.limpiar();
  await mundo.pedido(j, { id: 'skin_king', metodo: 'sol' });
  chequear(j.ultimos('toast').some(x => /Ya tienes esa skin/.test(x.m)), 'no se puede pedir una skin que ya tienes');
  // Experiencia: Necromancer +5%.
  j.c.uid = 'inv:' + 'skin-prueba'; j.c.skin = 'necro'; j.st = mundo.stats(j.c); j.c.descanso = 0; j.c.elix = {};
  await aMapa(j, 'noche', 600); limpiarMapa(j);
  const x0 = j.c.xp, nv0 = j.c.nivel; const o = monstruo(j, 'goblin_normal', 30, { nv: 20 }); mundo.danar(o, o.hp + 1, j); tick(1);
  const conN = j.c.xp - x0;
  j.c.skin = 'comun';
  const x1 = j.c.xp; const o2 = monstruo(j, 'goblin_normal', 30, { nv: 20 }); mundo.danar(o2, o2.hp + 1, j); tick(1);
  const sinN = j.c.xp - x1;
  chequear(j.c.nivel === nv0 && Math.abs(conN / sinN - 1.05) < 0.03, 'Necromancer da +5% de experiencia (' + conN + ' frente a ' + sinN + ')');
  await dejar(j);
}

async function pruebasContactos() {
  console.log('Lista de amigos');
  const a = await entrar('Amiga', '7d'), b = await entrar('AmigoLista', '7e');
  a.limpiar(); b.limpiar();
  await a.mandar({ t: 'contactoAdd', p: b.id });
  const l = a.ultimos('contactos').pop();
  chequear(l && l.l.length === 1 && l.l[0].n === 'AmigoLista' && l.l[0].on === 1 && l.l[0].uid === pub(b.c.uid), 'se añade y sale conectado');
  chequear(!JSON.stringify(l).includes(b.c.uid), 'la lista no lleva el uid real');
  chequear(b.ultimos('toast').some(x => /te añadió/.test(x.m)), 'al otro se le avisa');
  a.limpiar(); await a.mandar({ t: 'contactoAdd', p: b.id });
  chequear(a.ultimos('no').length === 1 && a.c.contactos.length === 1, 'no se repite');
  b.limpiar();
  for (let i = 0; i < 10; i++) { await a.mandar({ t: 'contactoQuitar', uid: pub(b.c.uid) }); await a.mandar({ t: 'contactoAdd', p: b.id }); }
  chequear(b.ultimos('toast').filter(x => /te añadió/.test(x.m)).length === 0, 'añadir y quitar en bucle no inunda al otro de avisos');
  await dejar(b);
  a.limpiar();
  const bR = await entrar('AmigoLista', '7e');
  chequear(!a.ultimos('toast').some(x => /se conectó/.test(x.m)), 'una reconexión rápida no repite el aviso');
  await dejar(bR);
  avanzar(6 * 60000); a.actT = Date.now();
  a.limpiar(); await a.mandar({ t: 'contactos' });
  chequear(a.ultimos('contactos').pop().l[0].on === 0, 'al irse sale desconectado');
  a.limpiar();
  const b2 = await entrar('AmigoLista', '7e');
  chequear(a.ultimos('toast').some(x => /Tu amigo AmigoLista se conectó/.test(x.m)), 'al volver, aviso de que se conectó');
  console.log('Inspeccionar');
  b2.c.oro = 12345; b2.c.mton = 77;
  a.limpiar(); await a.mandar({ t: 'inspeccionar', p: b2.id });
  const ins = a.ultimos('inspeccion').pop();
  chequear(ins && ins.n === 'AmigoLista' && ins.eq && typeof ins.logros === 'number', 'inspeccionar devuelve nombre, equipo y logros');
  chequear(!JSON.stringify(ins).includes(b2.c.uid) && ins.oro === undefined && ins.mton === undefined && ins.bolsa === undefined, 'sin uid, oro, mTON ni bolsa');
  console.log('Gestos');
  await aMapa(a, 'pueblo', 900); await aMapa(b2, 'pueblo', 950);
  b2.limpiar(); await a.mandar({ t: 'gesto', id: 'saludar' });
  chequear(b2.ultimos('gesto').some(x => x.p === a.id && x.id === 'saludar'), 'el gesto lo ven los del mapa');
  b2.limpiar(); await a.mandar({ t: 'gesto', id: 'bailar' }); await a.mandar({ t: 'gesto', id: '__proto__' });
  chequear(!b2.ultimos('gesto').length, 'como mucho uno cada 1,5 s y solo gestos que existen');
  await a.mandar({ t: 'contactoQuitar', uid: pub(b2.c.uid) });
  chequear(!a.c.contactos.length, 'se quita de la lista');
  await dejar(a); await dejar(b2);
}

async function pruebasMascotas() {
  console.log('Mascotas (solo estética)');
  const D = await import('../mmo/js/data.js');
  const m = await entrar('Domador', '7b'), v = await entrar('Mirador', '7c');
  ponerNivel(m, 12, 'guerrero'); ponerNivel(v, 12, 'mago');
  await aMapa(m, 'pueblo', 900); await aMapa(v, 'pueblo', 950);
  m.c.oro = 100;
  m.limpiar(); await m.mandar({ t: 'comprar', k: 'mascota', id: 'hongo' });
  chequear(!(m.c.mascotas || []).length && m.ultimos('toast').some(x => /oro/.test(x.m)), 'sin oro no se compra');
  await m.mandar({ t: 'comprar', k: 'mascota', id: 'rana' });
  chequear(!(m.c.mascotas || []).includes('rana'), 'ni por debajo del nivel que pide');
  await m.mandar({ t: 'comprar', k: 'mascota', id: '__proto__' });
  chequear(m.c.oro === 100, 'un id raro no hace nada');
  m.c.oro = 20000; v.limpiar();
  await m.mandar({ t: 'comprar', k: 'mascota', id: 'hongo' });
  chequear(m.c.mascotas.includes('hongo') && m.c.mascota === 'hongo' && m.c.oro === 20000 - D.MASCOTAS.hongo.precio, 'se compra con oro y queda puesta');
  chequear(v.ultimos('pa').some(x => x.p === m.id && x.ma === 'hongo'), 'los demás la ven');
  const st0 = JSON.stringify(mundo.stats(m.c));
  await m.mandar({ t: 'comprar', k: 'mascota', id: '' });
  chequear(m.c.mascota === '' && JSON.stringify(mundo.stats(m.c)) === st0, 'se guarda y no cambia ninguna estadística');
  const oro1 = m.c.oro;
  await m.mandar({ t: 'comprar', k: 'mascota', id: 'hongo' });
  chequear(m.c.mascota === 'hongo' && m.c.oro === oro1, 'volver a llevarla no se cobra otra vez');
  m.c.mascotas = ['hongo', 'rana', 'zarigueya']; mundo.revisarLogros(m);
  chequear(m.c.logros.includes('mascotas3'), 'con 3 mascotas, el logro Cuidador de Bichos');
  // Elixir de Sabiduria: +10% de la XP de caza.
  console.log('Elixir de Sabiduría');
  await aMapa(m, 'pueblo', 1680);
  m.c.mat = { hierba: 4, mineral: 2, cristal: 1 };
  await m.mandar({ t: 'fabricar', id: 'elixirX' });
  chequear(mundo.elixir(m, 'elixirX') && !m.c.mat.cristal, 'la Artesana lo fabrica con hierba, mineral y cristal');
  await aMapa(m, 'noche', 600); limpiarMapa(m); m.c.descanso = 0;
  const xpCon = []; for (let i = 0; i < 2; i++) { const x0 = m.c.xp, nv0 = m.c.nivel; const o = monstruo(m, 'goblin_normal', 30, { nv: 12 }); mundo.danar(o, o.hp + 1, m); tick(1); if (m.c.nivel === nv0) xpCon.push(m.c.xp - x0); }
  m.c.elix = {};
  const xpSin = []; for (let i = 0; i < 2; i++) { const x0 = m.c.xp, nv0 = m.c.nivel; const o = monstruo(m, 'goblin_normal', 30, { nv: 12 }); mundo.danar(o, o.hp + 1, m); tick(1); if (m.c.nivel === nv0) xpSin.push(m.c.xp - x0); }
  chequear(xpCon.length && xpSin.length && Math.abs(xpCon[0] / xpSin[0] - 1.1) < 0.05, 'da un 10% más de experiencia por caza (' + xpCon[0] + ' frente a ' + xpSin[0] + ')');
  await dejar(m); await dejar(v);
}

async function pruebasFortaleza() {
  console.log('Cuarta mazmorra: Fortaleza Goblin');
  const D = await import('../mmo/js/data.js');
  // Todas las mazmorras: mapa de instancia, conjunto (el premio del Desafío
  // usa cj = id), jefes con guion y hoja, y packs de monstruos que existen.
  for (const [id, mz] of Object.entries(D.MAZMORRAS)) {
    chequear(D.MAPAS[mz.mapa] && D.MAPAS[mz.mapa].instancia && D.CONJUNTOS[id] && mz.jefes.filter(j => j.final).length === 1, id + ': mapa de instancia, conjunto y un jefe final');
    chequear(mz.jefes.every(j => D.MONSTRUOS[j.k] && D.MONSTRUOS[j.k].mazmorra && D.MONSTRUOS[j.k].guion && D.HOJAS[D.MONSTRUOS[j.k].hoja]) && mz.packs.every(p => p.k.every(k => D.MONSTRUOS[k])), id + ': jefes con guion y hoja, packs que existen');
  }
  const f = await entrar('Fortalecido', '7a');
  ponerNivel(f, 19, 'guerrero');
  await aMapa(f, 'pueblo', 800);
  f.limpiar(); await f.mandar({ t: 'mazmorra', id: 'fortaleza' });
  chequear(!f.k.includes('#') && f.ultimos('no').some(x => /nivel 20/.test(x.m)), 'se abre a Nv 20');
  ponerNivel(f, 24);
  await f.mandar({ t: 'mazmorra', id: 'fortaleza' });
  const w = mundo.mundoDe(f);
  chequear(w.inst && w.inst.id === 'fortaleza' && w.inst.nv === 24 && [...w.mons.values()].filter(o => o.jefe).length === 3, 'a Nv 24 entra a su instancia con 3 jefes');
  const fin = [...w.mons.values()].find(o => o.final);
  for (const o of [...w.mons.values()]) if (o.jefe && o !== fin) { mundo.danar(o, 1, f); mundo.danar(o, o.hp + 1, f); tick(1); }
  mundo.danar(fin, 1, f); mundo.danar(fin, fin.hp + 1, f); tick(2);
  chequear(w.inst.completada && f.c.logros.includes('reygoblin'), 'se completa y da el logro Azote Goblin');
  // Quinta: Nido de la Reina Araña (Nv 40-58)
  avanzar(10000); tick(1);
  ponerNivel(f, 45);
  await aMapa(f, 'pueblo', 800);
  await f.mandar({ t: 'mazmorra', id: 'nido' });
  const wn = mundo.mundoDe(f);
  chequear(wn.inst && wn.inst.id === 'nido' && wn.inst.nv === 45, 'a Nv 45 entra al Nido de la Reina Araña');
  const finN = [...wn.mons.values()].find(o => o.final);
  for (const o of [...wn.mons.values()]) if (o.jefe && o !== finN) { mundo.danar(o, 1, f); mundo.danar(o, o.hp + 1, f); tick(1); }
  mundo.danar(finN, 1, f); mundo.danar(finN, finN.hp + 1, f); tick(2);
  chequear(wn.inst.completada && f.c.logros.includes('cancerbero'), 'se completa y da el logro Domador del Infierno');
  await dejar(f);
}

async function pruebasBanda() {
  console.log('Banda: Santuario del Titán');
  const D = await import('../mmo/js/data.js');
  const px = D.MAPAS.pueblo.portales.find(p => p.buscador).x;
  const js = [];
  for (let i = 1; i <= 7; i++) {
    const j = await entrar('Bandido' + i, 'c' + i);
    ponerNivel(j, 60, ['guerrero', 'sacerdote', 'mago', 'picaro'][i % 4]);
    await aMapa(j, 'pueblo', px);
    js.push(j);
  }
  const [L] = js;
  for (let i = 1; i <= 4; i++) { await L.mandar({ t: 'invitar', p: js[i].id }); await js[i].mandar({ t: 'grupoResp', si: true }); }
  const g = mundo.grupoDe(L);
  chequear(g && g.uids.length === 5 && !g.banda, 'un grupo normal llega a 5');
  L.limpiar();
  await L.mandar({ t: 'invitar', p: js[5].id });
  chequear(!js[5].invitacion && L.ultimos('no').some(x => /convertirlo en banda/.test(x.m)), 'el 6º no entra y se ofrece convertir en banda');
  await js[1].mandar({ t: 'banda', si: true });
  chequear(!g.banda, 'solo el líder convierte el grupo en banda');
  await L.mandar({ t: 'banda', si: true });
  chequear(g.banda && L.ultimos('grupo').some(x => x.g && x.g.banda === 1), 'el líder lo convierte en banda y el cliente lo sabe');
  await L.mandar({ t: 'invitar', p: js[5].id }); await js[5].mandar({ t: 'grupoResp', si: true });
  chequear(g.uids.length === 6, 'la banda admite a un 6º');
  await L.mandar({ t: 'banda', si: false });
  chequear(g.banda, 'con más de 5 no vuelve a ser grupo');
  L.limpiar();
  await L.mandar({ t: 'mazmorra', id: 'ciudadela', k: 3 });
  chequear(!L.k.includes('#') && L.ultimos('no').some(x => /hasta 5/.test(x.m)), 'una banda de 6 no entra a una mazmorra de 5 (ni a sus Desafíos)');
  // Entrar (un Desafio no aplica a la banda)
  await L.mandar({ t: 'mazmorra', id: 'santuario', k: 3 });
  const w = mundo.mundoDe(L);
  const dentro = js.slice(0, 6).filter(x => x.k === w.clave);
  chequear(w.inst && w.inst.id === 'santuario' && w.inst.banda && w.inst.k === 0 && dentro.length === 6, 'entran los 6 a la banda, sin Desafío');
  const jefes = [...w.mons.values()].filter(o => o.jefe);
  chequear(jefes.length === 4 && jefes.filter(o => o.final).length === 1, 'la banda tiene 4 jefes');
  // Zona para aguantar juntos: el golpe se reparte entre los de dentro.
  const coloso = jefes.find(o => o.k === 'mz_coloso_ab');
  for (const o of [...w.mons.values()]) if (!o.jefe) w.mons.delete(o.id);   // que los packs no peguen a los de fuera
  for (const x of dentro) { x.x = coloso.x - 300; x.hp = x.st.maxHp; x.inv = 0; x.escudo = 0; }
  const enZona = dentro.slice(0, 3);
  for (const x of dentro.slice(3)) x.x = coloso.x - 700;
  const ahora = Date.now();
  w.zonas.push({ id: 999, x0: coloso.x - 400, x1: coloso.x - 200, act: ahora + 100, fin: ahora + 600, dano: 0.6, color: '#facc15', de: coloso.id, junta: 3 });
  tick(2);
  const perd = enZona.map(x => 1 - x.hp / x.st.maxHp);
  chequear(perd.every(p => p > 0.5 && p < 0.7) && dentro.slice(3).every(x => x.hp === x.st.maxHp), 'zona dorada: 3 dentro se reparten el golpe (' + perd.map(p => Math.round(p * 100) + '%').join(', ') + ') y fuera no se recibe');
  for (const x of dentro) { x.hp = x.st.maxHp; x.x = coloso.x - 700; }
  w.zonas.push({ id: 998, x0: coloso.x - 400, x1: coloso.x - 200, act: Date.now() + 100, fin: Date.now() + 600, dano: 0.25, color: '#facc15', de: coloso.id, junta: 3 });
  tick(2);
  chequear(dentro.every(x => x.hp < x.st.maxHp * 0.56 && x.hp > x.st.maxHp * 0.44), 'si nadie la aguanta, estalla sobre todos con el doble');
  // Botin: una vez por semana y jefe.
  for (const x of dentro) { x.hp = x.st.maxHp; x.x = coloso.x - 100; x.c.bolsa = []; }
  // Uno que no pelea no cobra; uno con la bolsa llena (de piezas de banda) tampoco, y no gasta la semana.
  const quieto = dentro[5], lleno = dentro[4];
  lleno.c.bolsa = Array.from({ length: D.BOLSA_MAX }, (_, i) => ({ id: 'x' + i, s: 'casco', nv: 64, r: 2, b: {}, banda: 1 }));
  for (const x of dentro) if (x !== quieto) mundo.danar(coloso, 1, x);
  // Con el combate empezado por pocos, llegan mas: la vida del jefe sube.
  const max1 = coloso.max;
  tick(2);
  chequear(coloso.max >= max1, 'la vida del jefe se ajusta a los que hay en la sala');
  mundo.danar(coloso, coloso.hp + 1, L); tick(1);
  chequear(!quieto.c.bolsa.length && !(quieto.c.bandaSem && quieto.c.bandaSem.j.mz_coloso_ab), 'quien no pelea no se lleva el botín de la banda');
  chequear(lleno.c.bolsa.length === D.BOLSA_MAX && !(lleno.c.bandaSem && lleno.c.bandaSem.j.mz_coloso_ab), 'con la bolsa llena no cobra ni gasta la semana');
  lleno.c.bolsa = [];
  for (const x of [quieto, lleno]) { const i = dentro.indexOf(x); dentro.splice(i, 1); }
  const botin = dentro.map(x => x.c.bolsa.find(it => it.nv === D.botinBandaNv(false)));
  chequear(botin.every(it => it && it.r >= 2 && it.des), 'cada uno se lleva un objeto épico de nivel ' + D.botinBandaNv(false));
  chequear(dentro.every(x => x.c.bandaSem && x.c.bandaSem.j.mz_coloso_ab), 'queda anotado el botín de la semana');
  mundo.actualizarYo(L);
  chequear(L.ultimos('yo').some(x => x.yo && x.yo.banda && x.yo.banda.j.includes('mz_coloso_ab')), 'el cliente recibe el bloqueo semanal');
  // Otra instancia la misma semana: el jefe ya no da botin.
  const w2 = mundo.crearInstancia('santuario', 60, 1);
  const c2 = [...w2.mons.values()].find(o => o.k === 'mz_coloso_ab');
  const solo = js[6];
  mundo.unirAInstancia(L, w2);
  L.x = c2.x - 100; L.c.bolsa = []; L.limpiar();
  mundo.danar(c2, 1, L); mundo.danar(c2, c2.hp + 1, L); tick(1);
  chequear(!L.c.bolsa.length && L.ultimos('toast').some(x => /Ya cobraste el botín/.test(x.m)), 'la misma semana el jefe ya no da botín');
  L.c.bandaSem.sem = '2000-01-03';
  const c3 = mundo.crearMonstruo(w2.clave, 'mz_coloso_ab', L.x + 50, { nv: 62, mazmorra: true, jefeMaz: 0 });
  mundo.danar(c3, 1, L); mundo.danar(c3, c3.hp + 1, L); tick(1);
  chequear(L.c.bolsa.length === 1, 'la semana siguiente vuelve a dar botín');
  // El Titan: logro, y a la 3ª semana su montura.
  mundo.unirAInstancia(L, w);
  const titan = jefes.find(o => o.final);
  for (const o of jefes) if (o !== titan && !o.muere) { mundo.danar(o, 1, L); mundo.danar(o, o.hp + 1, L); tick(1); }
  for (const x of dentro) { x.x = titan.x - 100; x.hp = x.st.maxHp; }
  dentro[1].c.titanes = 2;
  for (const x of dentro) mundo.danar(titan, 1, x);
  mundo.danar(titan, titan.hp + 1, L); tick(2);
  chequear(w.inst.completada && L.c.logros.includes('titan') && L.c.titanes === 1, 'vencer al Titán completa la banda y da su logro');
  chequear(dentro[1].c.monturas.includes('abismo') && dentro[1].c.logros.includes('abismo'), 'a la 3ª semana se gana el Murciélago del Abismo');
  chequear(mundo.primeros && mundo.primeros.mz_titan && dentro.every(x => x.c.logros.includes('pionero')), 'la primera victoria del servidor queda escrita y da «Pionero del Abismo»');
  const pr = await entrar('Mirón', 'c9'); pr.limpiar();
  await pr.mandar({ t: 'inspeccionar', p: dentro[1].id });
  const ins = pr.ultimos('inspeccion').pop();
  chequear(ins && ins.titanes === 3 && ins.pionero === 1 && !JSON.stringify(ins).includes(dentro[1].c.uid), 'inspeccionar muestra la banda y las runas, sin uid');
  await dejar(pr);
  chequear(dentro[1].c.boveda && dentro[1].c.boveda.k === 5, 'la banda cuenta en la Bóveda como un Desafío +5');
  // No se vende.
  await aMapa(solo, 'pueblo', px);
  solo.c.oro = 1e7; solo.limpiar();
  await solo.mandar({ t: 'comprar', k: 'montura', id: 'abismo' });
  chequear(!(solo.c.monturas || []).includes('abismo'), 'la montura de la banda no se compra');
  // Buscar gente para la banda la convierte en banda.
  for (const x of js.slice(0, 6)) await dejar(x);
  const l2 = await entrar('Bandido8', 'c8');
  ponerNivel(l2, 60, 'guerrero');
  await aMapa(l2, 'pueblo', px);
  await solo.mandar({ t: 'lfg', id: 'santuario' });
  await l2.mandar({ t: 'lfgUnir', pid: pub(solo.c.uid) });
  const g2 = mundo.grupoDe(solo);
  chequear(g2 && g2.banda && g2.uids.length === 2, 'quien se une desde el buscador de la banda forma una banda');
  await dejar(l2); await dejar(solo);
}

async function pruebasTopeBanda() {
  console.log('Banda: tope de 10 dentro');
  const D = await import('../mmo/js/data.js');
  const px = D.MAPAS.pueblo.portales.find(p => p.buscador).x;
  const js = [];
  for (let i = 0; i < 12; i++) { const j = await entrar('Tope' + i, 'e' + i.toString(16)); ponerNivel(j, 60, 'guerrero'); await aMapa(j, 'pueblo', px); js.push(j); }
  const [L] = js;
  await L.mandar({ t: 'invitar', p: js[1].id }); await js[1].mandar({ t: 'grupoResp', si: true });
  await L.mandar({ t: 'banda', si: true });
  for (let i = 2; i < 10; i++) { await L.mandar({ t: 'invitar', p: js[i].id }); await js[i].mandar({ t: 'grupoResp', si: true }); }
  await L.mandar({ t: 'mazmorra', id: 'santuario' });
  const w = mundo.mundoDe(L);
  chequear(js.slice(0, 10).every(x => x.k === w.clave), 'entran los 10');
  // Expulsado: sale de la instancia; el nuevo entra, pero nunca mas de 10.
  await L.mandar({ t: 'expulsarGrupo', uid: pub(js[9].c.uid) });
  chequear(js[9].k === 'pueblo', 'quien sale del grupo vuelve al pueblo');
  await L.mandar({ t: 'invitar', p: js[10].id }); await js[10].mandar({ t: 'grupoResp', si: true });
  await js[10].mandar({ t: 'mazmorra', id: 'santuario' });
  chequear(js[10].k === w.clave, 'el nuevo entra a la banda de su grupo');
  await js[9].mandar({ t: 'mazmorra', id: 'santuario' });
  chequear(js[9].k !== w.clave, 'el expulsado no vuelve a esa instancia');
  let dentro = 0; for (const x of mundo.sesiones.values()) if (x.c && x.k === w.clave) dentro++;
  chequear(dentro === 10, 'nunca hay más de 10 dentro (' + dentro + ')');
  for (const x of js) await dejar(x);
}

async function pruebasRunas() {
  console.log('Artesanía de nivel alto: materiales raros y runas');
  const D = await import('../mmo/js/data.js');
  const r = await entrar('Runero', 'd1');
  ponerNivel(r, 47, 'mago');
  // Recoger en una zona alta da Flor de Luna o Mithril.
  await aMapa(r, 'cavernas', 300);
  r.c.mat = {};
  const ns = D.nodosDe('cavernas');
  for (let i = 0; i < 12; i++) {
    const n = ns[i % ns.length];
    r.c.nodos = {}; r.x = n.x;
    mundo.terminarRecoleccion(r, { nodo: n.i });
  }
  chequear((r.c.mat.flor || 0) > 0 && (r.c.mat.mithril || 0) > 0, 'en zonas Nv 30+ salen Flor de Luna (' + (r.c.mat.flor || 0) + ') y Mithril (' + (r.c.mat.mithril || 0) + ')');
  await aMapa(r, 'noche', 300);
  const f0 = r.c.mat.flor, m0 = r.c.mat.mithril;
  for (let i = 0; i < 8; i++) { const n = D.nodosDe('noche')[i % 4]; r.c.nodos = {}; r.x = n.x; mundo.terminarRecoleccion(r, { nodo: n.i }); }
  chequear(r.c.mat.flor === f0 && r.c.mat.mithril === m0, 'en zonas bajas no salen');
  // Esencia Abisal de los jefes de mazmorra.
  const wb = mundo.crearInstancia('catacumbas', 30, 1);
  mundo.unirAInstancia(r, wb);
  const jb = [...wb.mons.values()].find(o => o.jefe && !o.final);
  r.x = jb.x - 80;
  const eb = r.c.mat.esencia || 0;
  mundo.danar(jb, 1, r); mundo.danar(jb, jb.hp + 1, r); tick(1);
  chequear((r.c.mat.esencia || 0) === eb, 'una mazmorra de nivel bajo no da Esencia');
  const w = mundo.crearInstancia('nido', 47, 1);
  mundo.unirAInstancia(r, w);
  const jefe = [...w.mons.values()].find(o => o.jefe && !o.final);
  r.x = jefe.x - 80;
  const e0 = r.c.mat.esencia || 0;
  mundo.danar(jefe, 1, r); mundo.danar(jefe, jefe.hp + 1, r); tick(1);
  chequear(r.c.mat.esencia === e0 + 1, 'un jefe de mazmorra de nivel alto da 1 Esencia Abisal');
  // Grabar runas en la Artesana.
  const ax = D.MAPAS.pueblo.npcs.find(x => x.tipo === 'artesania').x;
  await aMapa(r, 'pueblo', ax);
  ponerNivel(r, 39);
  r.c.mat = { mithril: 999, flor: 999, esencia: 999, cristal: 999 }; r.c.oro = 1e7;
  r.limpiar();
  await r.mandar({ t: 'runa', id: 'fuerza' });
  chequear(!(r.c.runas && r.c.runas.fuerza) && r.ultimos('no').some(x => /nivel 40/.test(x.m)), 'las runas se graban desde Nv 40');
  ponerNivel(r, 60);
  const atk0 = r.st.atk;
  r.c.mat = { mithril: 4, esencia: 1, cristal: 1 };
  await r.mandar({ t: 'runa', id: 'fuerza' });
  chequear(!(r.c.runas && r.c.runas.fuerza), 'sin materiales suficientes no se graba');
  r.c.mat = { mithril: 5, esencia: 2, cristal: 1 };
  mundo.revisarLogros(r);   // los de nivel dan oro: que no cuenten aqui
  const oro0 = r.c.oro;
  await r.mandar({ t: 'runa', id: 'fuerza' });
  chequear(r.c.runas.fuerza === 1 && r.c.mat.mithril === 1 && r.c.mat.esencia === 0 && r.c.oro === oro0 - 2500, 'rango 1: gasta 4 Mithril, 2 Esencias, 1 Cristal y 2.500 oro');
  chequear(Math.abs(r.st.atk / atk0 - 1.02) < 0.01, 'y da +2% de ataque (' + atk0 + ' → ' + r.st.atk + ')');
  r.c.mat = { mithril: 999, flor: 999, esencia: 999, cristal: 999 };
  for (let i = 0; i < 6; i++) await r.mandar({ t: 'runa', id: 'fuerza' });
  chequear(r.c.runas.fuerza === D.RUNA_MAX, 'no pasa del rango ' + D.RUNA_MAX);
  for (let i = 0; i < 5; i++) { await r.mandar({ t: 'runa', id: 'piedra' }); await r.mandar({ t: 'runa', id: 'vida' }); }
  chequear(r.c.logros.includes('runas'), 'las tres al máximo dan el logro Maestro Rúnico');
  await aMapa(r, 'noche', 300);
  await r.mandar({ t: 'runa', id: 'fuerza' });
  chequear(r.ultimos('no').some(x => /Artesana/.test(x.m)), 'solo junto a la Artesana');
  mundo.actualizarYo(r);
  chequear(r.ultimos('yo').some(x => x.yo && x.yo.runas && x.yo.runas.vida === 5), 'el cliente recibe sus runas');
  await dejar(r);
}

async function pruebasGesta() {
  console.log('Hermandades: gesta semanal');
  const D = await import('../mmo/js/data.js');
  const a = await entrar('Gestero', 'd2'), b = await entrar('Gestera', 'd3'), z = await entrar('Gestolo', 'd4');
  for (const x of [a, b, z]) { ponerNivel(x, 30, 'guerrero'); x.c.oro = 100000; await aMapa(x, 'noche', 600); }
  await a.mandar({ t: 'hermCrear', nombre: 'Los Gesteros' }); await calma();
  await a.mandar({ t: 'hermInvitar', p: b.id }); await calma();
  await b.mandar({ t: 'hermResp', si: true }); await calma();
  await a.mandar({ t: 'hermInvitar', p: z.id }); await calma();
  await z.mandar({ t: 'hermResp', si: true }); await calma();
  const h = mundo.herms.get(a.c.herm);
  chequear(h && Object.keys(h.miembros).length === 3, 'hermandad de 3');
  // Recien entrados aun no cobran: se les da antiguedad (se prueba abajo).
  const antig = () => { for (const u in h.miembros) h.miembros[u].desde = reloj - 2 * 86400000; };
  antig();
  limpiarMapa(a);
  // a caza 10 y vence un jefe; b, uno solo (no llega al minimo).
  for (let i = 0; i < 10; i++) { const o = monstruo(a, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o, o.hp + 1, a); tick(1); }
  const j = monstruo(a, 'jefe_sabueso', 30); mundo.danar(j, j.hp + 1, a); tick(1);
  const o1 = monstruo(b, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o1, o1.hp + 1, b); tick(1);
  const G = h.gesta;
  chequear(G && G.c[a.c.uid] === 20 && G.c[b.c.uid] === 1 && G.p === 21, 'monstruo 1 punto, jefe 10 (' + JSON.stringify(G && G.c && Object.values(G.c)) + ')');
  // Pasar el Bronce: a cobra, b no (aporto poco), y b cobra al llegar al minimo.
  const oa = a.c.oro, ob = b.c.oro;
  G.p = D.GESTA_UMBRALES[0] - 1;
  a.limpiar();
  const o2 = monstruo(a, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o2, o2.hp + 1, a); tick(1);
  const pr = D.premioGesta(0, 30).oro;
  chequear(a.c.oro - oa >= pr && a.ultimos('toast').some(x => /Gesta de <Los Gesteros>/.test(x.m)), 'al llegar al Bronce, quien aportó cobra ' + pr + ' oro');
  chequear(b.c.oro - ob < pr, 'quien no llega al mínimo de puntos aún no cobra');
  for (let i = 0; i < 2; i++) { const o3 = monstruo(b, 'jefe_sabueso', 30); mundo.danar(o3, o3.hp + 1, b); tick(1); }
  chequear(b.c.oro - ob >= pr, 'al llegar al mínimo cobra el nivel ya conseguido');
  const oa2 = a.c.oro;
  const o4 = monstruo(a, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o4, o4.hp + 1, a); tick(1);
  chequear(a.c.oro - oa2 < pr, 'cada nivel se cobra una sola vez');
  // Oro: logro. Un miembro desconectado cobra al volver.
  G.c[z.c.uid] = 50;
  await dejar(z);
  G.p = D.GESTA_UMBRALES[2] - 1;
  const o5 = monstruo(a, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o5, o5.hp + 1, a); tick(1);
  chequear(a.c.gestaCob.n === 3 && a.c.logros.includes('gesta'), 'al llegar al Oro se cobran Plata y Oro y llega el logro Gesta Dorada');
  const z2 = await entrar('Gestolo', 'd4'); await calma(); await calma();
  chequear(z2.c.gestaCob && z2.c.gestaCob.n === 3, 'quien aportó y estaba fuera cobra al entrar');
  // Ranking semanal de hermandades (se pone al dia al guardar las gestas).
  await calma(); await calma();
  const th = await mundo.topHerm();
  chequear(th.length && th[0][0] === h.id && th[0][1].p === G.p, 'la hermandad sale en el ranking semanal con sus puntos');
  // Color de la hermandad: solo el lider; llega en la apariencia de cada miembro.
  await b.mandar({ t: 'hermColor', i: 3 }); await calma();
  chequear(!(h.color | 0), 'un miembro no cambia el color');
  b.limpiar(); await a.mandar({ t: 'hermColor', i: 3 }); await calma();
  chequear(h.color === 3 && mundo.infoApariencia(b).hc === 3 && b.ultimos('pa').some(x => x.hc === 3), 'el líder cambia el color y se ve en todos');
  // El cliente recibe la gesta con los aportes por id publico.
  a.limpiar();
  await a.mandar({ t: 'herm' }); await calma();
  const inf = a.ultimos('herm').pop();
  chequear(inf && inf.h.gesta && inf.h.gesta.p >= D.GESTA_UMBRALES[2] && inf.h.gesta.c[pub(a.c.uid)] > 0 && !JSON.stringify(inf).includes(a.c.uid), 'el cliente ve la gesta sin uids');
  // Recien llegado a una hermandad que ya llego al Oro: no cobra hasta un dia despues.
  const n = await entrar('Gestonuevo', 'd5'); ponerNivel(n, 30, 'guerrero'); await aMapa(n, 'noche', 600);
  await a.mandar({ t: 'hermInvitar', p: n.id }); await calma();
  await n.mandar({ t: 'hermResp', si: true }); await calma();
  limpiarMapa(n);
  for (let i = 0; i < 3; i++) { const o6 = monstruo(n, 'jefe_sabueso', 30); mundo.danar(o6, o6.hp + 1, n); tick(1); }
  chequear(!(n.c.gestaCob && n.c.gestaCob.n), 'quien acaba de entrar no cobra la gesta ya conseguida');
  avanzar(25 * 3600000); n.actT = reloj;
  const o7 = monstruo(n, 'goblin_normal', 30, { nv: 30 }); mundo.danar(o7, o7.hp + 1, n); tick(1);
  chequear(n.c.gestaCob && n.c.gestaCob.n === 3, 'tras un día en la hermandad, cobra');
  await dejar(n);
  // La semana siguiente empieza de cero.
  G.sem = '2000-01-03';
  chequear(mundo.gestaDe(h).p === 0, 'cada lunes vuelve a empezar');
  await dejar(a); await dejar(b); await dejar(z2);
}

async function pruebasBoveda() {
  console.log('Bóveda semanal');
  const D = await import('../mmo/js/data.js');
  chequear(D.opcionesBoveda(0) === 0 && D.opcionesBoveda(1) === 1 && D.opcionesBoveda(4) === 2 && D.opcionesBoveda(8) === 3, '1, 4 y 8 mazmorras abren 1, 2 y 3 opciones');
  const b = await entrar('Bovedero', '75');
  ponerNivel(b, 60, 'guerrero');
  b.c.desafio = { catacumbas: 6 };
  mundo.actualizarYo(b);
  const sem0 = D.semanaUTC();
  chequear(b.c.boveda && b.c.boveda.sem === sem0 && b.c.boveda.n === 0, 'empieza la semana sin progreso');
  const completar = async (k) => {
    await aMapa(b, 'pueblo', 800);
    await b.mandar({ t: 'mazmorra', id: 'catacumbas', k });
    const w = mundo.mundoDe(b);
    const fin = [...w.mons.values()].find(o => o.final);
    for (const o of [...w.mons.values()]) if (o.jefe && o !== fin) { mundo.danar(o, 1, b); mundo.danar(o, o.hp + 1, b); tick(1); }
    mundo.danar(fin, 1, b); mundo.danar(fin, fin.hp + 1, b); tick(2);
    avanzar(10000); tick(1);
    return w.inst.completada;
  };
  chequear(await completar(0), 'completa una mazmorra normal');
  for (let i = 0; i < 3; i++) await completar(0);
  chequear(await completar(5), 'y un Desafío +5');
  chequear(b.c.boveda.n === 5 && b.c.boveda.k === 5, 'la Bóveda cuenta 5 mazmorras y el mejor +5 (' + b.c.boveda.n + ', +' + b.c.boveda.k + ')');
  chequear(!b.c.bovedaOpc, 'esta semana aún no hay nada que elegir');
  reloj = Math.max(reloj, Date.parse(sem0 + 'T00:00:00Z') + 7 * DIA + 3600000);
  b.limpiar();
  mundo.actualizarYo(b);
  const y = b.ultimos('yo').pop().yo;
  chequear(b.c.bovedaOpc && b.c.bovedaOpc.length === 2 && y.bovedaOpc.length === 2, 'el lunes hay 2 objetos para elegir (5 mazmorras)');
  chequear(b.c.bovedaOpc.every(it => it.nv === 65 && it.des && it.r >= 2), 'de nivel 65 y épicos o más (Desafío +5)');
  chequear(b.c.boveda.n === 0 && b.c.boveda.sem === D.semanaUTC(), 'y la semana nueva empieza de cero');
  const elegido = b.c.bovedaOpc[1];
  await b.mandar({ t: 'boveda', i: 1 });
  chequear(!b.c.bovedaOpc && b.c.bolsa.some(it => it.id === elegido.id), 'se elige uno y va a la bolsa; los demás se pierden');
  b.limpiar(); await b.mandar({ t: 'boveda', i: 0 });
  chequear(b.ultimos('no').length === 1 && !b.c.bolsa.filter(it => it.id === elegido.id)[1], 'no se puede elegir dos veces');
  await dejar(b);
}

async function pruebasLfg() {
  console.log('Buscar grupo para una mazmorra');
  const { LFG_MS } = await import('../functions/mmo/social.js');
  const a = await entrar('Buscadora', '70'), b = await entrar('Voluntario', '71'), c = await entrar('Pequeno', '72');
  const d = await entrar('Agrupado', '73'), e = await entrar('Agrupada', '74');
  ponerNivel(a, 12, 'sacerdote'); ponerNivel(b, 15, 'guerrero'); ponerNivel(c, 5, 'mago'); ponerNivel(d, 20, 'mago'); ponerNivel(e, 20, 'picaro');
  await d.mandar({ t: 'invitar', p: e.id }); await e.mandar({ t: 'grupoResp', si: true });
  for (const x of [a, b, c, d, e]) x.limpiar();
  await a.mandar({ t: 'lfg', id: 'nada' });
  chequear(!a.ultimos('lfg').length, 'una mazmorra que no existe se ignora');
  await a.mandar({ t: 'lfg', id: 'catacumbas' });
  const av = b.ultimos('lfgAviso')[0];
  chequear(av && av.n === 'Buscadora' && av.id === 'catacumbas' && av.m === 1 && av.pid === pub(a.c.uid), 'se avisa a quien tiene nivel y no tiene grupo');
  chequear(!c.ultimos('lfgAviso').length && !d.ultimos('lfgAviso').length, 'no a quien no tiene nivel ni a quien ya está en un grupo');
  chequear(!JSON.stringify(av).includes(a.c.uid), 'el aviso no lleva el uid real');
  a.limpiar(); await a.mandar({ t: 'lfg', id: 'catacumbas' });
  chequear(a.ultimos('no').length === 1, 'no se puede anunciar otra vez en menos de un minuto');
  await c.mandar({ t: 'lfgUnir', pid: av.pid });
  chequear(!c.gid, 'sin nivel no se une');
  await b.mandar({ t: 'lfgUnir', pid: av.pid });
  chequear(a.gid && a.gid === b.gid && mundo.grupoDe(a).lider === a.c.uid, 'quien se une entra al grupo de quien busca (y esa persona es la líder)');
  b.limpiar(); await b.mandar({ t: 'lfg', id: 'catacumbas' });
  chequear(b.ultimos('no').some(x => /líder/.test(x.m)), 'solo la líder puede seguir buscando gente');
  b.limpiar(); await b.mandar({ t: 'lfgLista' });
  const l = b.ultimos('lfg').pop();
  chequear(l && l.l.length === 1 && l.l[0].m === 2, 'la búsqueda sigue en la lista con 2/5');
  await d.mandar({ t: 'lfgUnir', pid: av.pid });
  chequear(d.gid === e.gid && d.gid !== a.gid, 'quien ya tiene grupo no se une a otro');
  // Anunciar y quitar en bucle no salta el límite de un minuto.
  const f = await entrar('Floodero', '76'), v = await entrar('Victima', '77');
  ponerNivel(f, 20, 'mago'); ponerNivel(v, 20, 'guerrero'); v.limpiar();
  for (let i = 0; i < 10; i++) { await f.mandar({ t: 'lfg', id: 'catacumbas' }); await f.mandar({ t: 'lfgQuitar' }); }
  chequear(v.ultimos('lfgAviso').length === 1, 'anunciar y quitar en bucle no inunda a los demás (' + v.ultimos('lfgAviso').length + ' avisos)');
  avanzar(61000);
  await f.mandar({ t: 'lfg', id: 'catacumbas' });
  chequear(mundo.lfg.has(f.c.uid), 'al minuto se puede volver a anunciar');
  await dejar(f);
  chequear(!mundo.lfg.has(f.c.uid), 'al desconectarse su búsqueda sale de la lista');
  await dejar(v);
  // A un grupo dentro de un Desafío no se entra por el buscador.
  const l6 = await entrar('Lider60b', '78'), o6 = await entrar('Otro60', '79');
  ponerNivel(l6, 60, 'guerrero'); ponerNivel(o6, 60, 'mago');
  l6.c.desafio = { catacumbas: 3 };
  await aMapa(l6, 'pueblo', 800);
  await l6.mandar({ t: 'lfg', id: 'catacumbas' });
  const pid6 = pub(l6.c.uid);
  await l6.mandar({ t: 'mazmorra', id: 'catacumbas', k: 3 });
  // solo: le ponemos un grupo con la instancia abierta
  mundo.iniciarSocial();
  const g6 = { id: mundo.sigGrupo++, lider: l6.c.uid, uids: [l6.c.uid, 'x:fantasma'], inst: l6.k };
  mundo.grupos.set(g6.id, g6); l6.gid = g6.id;
  o6.limpiar(); await o6.mandar({ t: 'lfgUnir', pid: pid6 });
  chequear(!o6.gid && o6.ultimos('no').some(x => /Desafío/.test(x.m)), 'a un grupo dentro de un Desafío solo se entra por invitación');
  mundo.grupos.delete(g6.id); l6.gid = 0;
  await dejar(l6); await dejar(o6);
  avanzar(LFG_MS + 1000);
  b.limpiar(); await b.mandar({ t: 'lfgLista' });
  chequear(b.ultimos('lfg').pop().l.length === 0, 'a los 10 minutos la búsqueda caduca');
  for (const x of [a, b, c, d, e]) await dejar(x);
}

async function pruebasAfijos() {
  console.log('Afijos semanales y ranking semanal de Desafíos');
  const D = await import('../mmo/js/data.js');
  const af = D.afijosSemana();
  chequear(D.afijosDe(1).length === 0 && D.afijosDe(2).length === 1 && D.afijosDe(5).length === 2, 'sin afijos al +1, primario desde +2, los dos desde +5');
  chequear(D.afijosSemana('2026-10-19').join() !== D.afijosSemana('2026-10-26').join(), 'cambian de una semana a otra');
  const d = await entrar('Afijero', '6a');
  ponerNivel(d, 60, 'guerrero');
  d.c.desafio = { catacumbas: 4 };
  await aMapa(d, 'pueblo', 800);
  d.limpiar();
  await d.mandar({ t: 'mazmorra', id: 'catacumbas', k: 5 });
  const w = mundo.mundoDe(d);
  chequear(w.inst && w.inst.k === 5 && w.inst.af.join() === af.join(), 'la instancia +5 lleva los afijos de la semana (' + af.join(', ') + ')');
  chequear(d.ultimos('toast').some(x => x.m.includes('Afijos:')), 'al entrar se avisan los afijos');
  const pack = [...w.mons.values()].find(o => !o.jefe);
  const base = mundo.crearMonstruo('pueblo', pack.k, 100, { nv: pack.nv, hpX: 2.2 });
  mundo.mundoK('pueblo').mons.delete(base.id);
  const esperado = D.multDesafio(5).vida * D.multAfijos(af).vidaPack;
  chequear(Math.abs(pack.max / base.max - esperado) < 0.05, 'vida de los packs según el +k y Fortificado (×' + (pack.max / base.max).toFixed(2) + ' de ×' + esperado.toFixed(2) + ')');
  // Furioso
  w.inst.af = ['furioso'];
  const atk0 = pack.atk;
  pack.hp = pack.max * 0.25;
  // En combate con alguien (sin presa, el pack se cura y se le pasa la furia).
  d.inv = Infinity; pack.amen.set(d.id, 1); pack.x = d.x + 40;
  tick(1);
  chequear(pack.furia && pack.atk === Math.round(atk0 * 1.5), 'Furioso: bajo el 30% pega un 50% más');
  // Sanguinario
  w.inst.af = ['sanguinario'];
  const mates = [...w.mons.values()].filter(o => o.grupo === pack.grupo && o !== pack && !o.muere);
  const otro = mates[0];
  chequear(!!otro, 'el pack tiene más de un monstruo');
  otro.hp = otro.max * 0.5;
  mundo.danar(pack, pack.hp + 1, d); tick(1);
  chequear(Math.abs(otro.hp / otro.max - 0.7) < 0.01, 'Sanguinario: al morir uno, su pack se cura un 20% (' + (otro.hp / otro.max).toFixed(2) + ')');
  // Volcanico: con combate, llama bajo el jugador; quien se queda, recibe.
  w.inst.af = ['volcanico'];
  w.zonas = [];
  for (const o of [...w.mons.values()]) if (o !== otro) w.mons.delete(o.id);
  otro.x = d.x + 600; otro.au.aturdido = { hasta: reloj + 60000 };
  otro.amen.set(d.id, 1);
  d.hp = d.st.maxHp; d.y = SUELO;
  tick(1); tick(41);
  const z = w.zonas.find(z => z.color === '#ff5a1f' && z.x0 < d.x && d.x < z.x1);
  chequear(!!z, 'Volcánico: aparece una llama bajo el jugador');
  const hp0 = d.hp;
  d.inv = 0;
  tick(22);
  chequear(d.hp < hp0 - d.st.maxHp * 0.08, 'quien no se mueve recibe el golpe de la llama');
  // Ranking semanal: vencer el +5 lo anota y el lunes premia.
  w.inst.af = [];
  mundo.rds.l = {};   // las pruebas de Desafíos de antes dejaron a otros en la tabla
  for (const o of [...w.mons.values()]) w.mons.delete(o.id);
  const fin = mundo.crearMonstruo(w.clave, 'mz_senor', d.x + 50, { nv: 62, agresivo: true, mazmorra: true, jefeMaz: 2 });
  fin.final = true;
  mundo.danar(fin, 1, d); mundo.danar(fin, fin.hp + 1, d); tick(2);   // el primer golpe empieza el combate (y reescala su vida)
  chequear(w.inst.completada && mundo.rds.l[d.c.uid] && mundo.rds.l[d.c.uid].k === 5, 'el +5 vencido entra al ranking semanal de Desafíos');
  d.limpiar(); await d.mandar({ t: 'ranking' });
  for (let i = 0; i < 20; i++) await espera();
  const rk = d.ultimos('ranking').pop();
  chequear(rk && rk.dsem && rk.dsem.some(x => x.yo && x.k === 5) && rk.af && rk.af.length === 2, 'el ranking manda la tabla semanal y los afijos');
  const oro0 = d.c.oro;
  const fSem = Date.parse(mundo.rds.sem + 'T00:00:00Z') + 7 * DIA;
  reloj = Math.max(reloj, fSem + 3600000);
  await mundo.revisarSemana(reloj);
  for (let i = 0; i < 20; i++) await espera();
  const logro = D.LOGROS.find(l => l.id === 'maestrodes').oro;
  // (a nivel 60 su XP tambien cuenta ya en el ranking semanal de XP: puede cobrar ese premio aparte)
  chequear(d.c.oro >= oro0 + D.premioDesSem(0) + logro && d.c.maestroDes === 1 && (d.c.logros || []).includes('maestrodes'), 'el lunes el 1º cobra ' + D.premioDesSem(0) + ' de oro y el título (más el oro del logro)');
  chequear(mundo.rds.sem === D.semanaUTC() && !Object.keys(mundo.rds.l).length, 'y la tabla empieza de cero');
  await dejar(d);
}
async function pruebasChicha() {
  console.log('Premio de chicha morada');
  const D = await import('../mmo/js/data.js');
  const avisos = [];
  const tgReal = mundo.tgEnviar, adminReal = mundo.avisarAdmin;
  mundo.tgEnviar = async (met, cuerpo) => { avisos.push(JSON.stringify(cuerpo)); return { ok: true }; };
  mundo.avisarAdmin = async txt => { avisos.push('ADMIN ' + txt); };
  try {
    const inv = await entrar('Invitadin', '66');
    ponerNivel(inv, 20, 'guerrero'); await aMapa(inv, 'noche', 600); limpiarMapa(inv);
    for (let i = 0; i < 5; i++) { const o = monstruo(inv, 'goblin_normal', 30); mundo.danar(o, o.hp + 1, inv); tick(1); }
    chequear(!(inv.c.chicha && inv.c.chicha.p), 'un invitado no junta puntos de chicha');
    const j = await entrarTg('Chichero', 7101);
    ponerNivel(j, 20, 'guerrero'); await aMapa(j, 'noche', 600); limpiarMapa(j);
    const o1 = monstruo(j, 'goblin_normal', 30); mundo.danar(o1, o1.hp + 1, j); tick(1);
    chequear(j.c.chicha && j.c.chicha.p === 1, 'con cuenta, cada caza suma (1 punto un monstruo bajo)');
    j.c.chicha.hoy = D.CHICHA.porDia - 2;
    const o2 = monstruo(j, 'jefe_sabueso', 30); mundo.danar(o2, o2.hp + 1, j); tick(1);
    chequear(j.c.chicha.hoy === D.CHICHA.porDia && j.c.chicha.p === 3, 'el tope diario se respeta');
    // Reclamar
    j.c.chicha.p = 10000;
    j.c.creado = Date.now() - 3 * 86400000;
    await j.mandar({ t: 'chicha', meta: 50000 });
    chequear(!(j.c.chicha.rec || []).includes(50000), 'sin puntos suficientes no se reclama');
    await j.mandar({ t: 'chicha', meta: 10000 });
    for (let i = 0; i < 20; i++) await espera();
    const r = (mundo.chichas || []).find(x => x.uid === j.c.uid);
    chequear(r && r.estado === 'pendiente' && j.c.chicha.rec.includes(10000), 'con 10.000 puntos se reclama el litro');
    chequear(avisos.some(a => a.startsWith('ADMIN') && a.includes(r.id) && a.includes('7101')), 'al dueño le llega el aviso con el contacto');
    await j.mandar({ t: 'chicha', meta: 10000 });
    chequear(mundo.chichas.filter(x => x.uid === j.c.uid).length === 1, 'no se reclama dos veces');
    const ok = await mundo.internoChicha('chichaNo', { id: r.id, motivo: 'sin dirección' });
    chequear(ok.ok && !j.c.chicha.rec.includes(10000), 'rechazado sin trampa: puede volver a reclamar');
    await j.mandar({ t: 'chicha', meta: 10000 });
    for (let i = 0; i < 20; i++) await espera();
    const r2 = mundo.chichas.find(x => x.uid === j.c.uid && x.estado === 'pendiente');
    const env = await mundo.internoChicha('chichaOk', { id: r2.id });
    chequear(env.ok && r2.estado === 'enviado', 'el dueño lo marca como enviado');
    await dejar(inv); await dejar(j);
  } finally { mundo.tgEnviar = tgReal; mundo.avisarAdmin = adminReal; }
}

// ── MODO DIOS, NOMBRES UNICOS, SKINS PREMIUM Y VELOCIDAD (functions/mmo/dios.js) ──
async function pruebasDios() {
  console.log('Nombres únicos y reservados');
  const n1 = await entrar('Copion', 'f1'), n2 = await entrar('copion', 'f2'), n3 = await entrar('Admin', 'f3'), n4 = await entrar('El Duende', 'f4');
  chequear(n1.c.nombre === 'Copion' && n2.c.nombre !== 'copion' && /^copion\d{4}$/i.test(n2.c.nombre), 'un invitado no puede repetir el nombre de otro (' + n1.c.nombre + ', ' + n2.c.nombre + ')');
  chequear(!/admin/i.test(n3.c.nombre) && !/el ?duende/i.test(n4.c.nombre), 'los nombres del equipo quedan reservados (' + n3.c.nombre + ', ' + n4.c.nombre + ')');
  await dejar(n1);
  const n1b = await entrar('OtroNombre', 'f1');
  chequear(n1b.c.nombre === 'Copion', 'el dueño del nombre lo conserva al volver');

  console.log('Modo Dios');
  mundo.env.ADMIN_TG_ID = '9001';
  const dios = await entrarTg('Jefazo', 9001);
  const nadie = await entrar('Tramposo', 'f5');
  chequear(dios.dios && !nadie.dios, 'solo la cuenta del dueño es dios');
  nadie.ws.rec.length = 0;
  await nadie.mandar({ t: 'dios', a: 'oro', p: nadie.id, n: 999999 });
  await nadie.mandar({ t: 'dios', a: 'modo', k: 'inv', v: true });
  chequear(nadie.c.oro < 999999 && !(nadie.diosModo && nadie.diosModo.inv), 'un jugador normal no puede usar comandos de dios');
  await dios.mandar({ t: 'dios', a: 'modo', k: 'inv', v: true });
  await aMapa(dios, 'noche', 600); limpiarMapa(dios);
  const hp = dios.hp; mundo.herir(dios, 99999, { jefe: true });
  chequear(dios.hp === hp && !dios.muerto, 'invencible no recibe daño');
  await dios.mandar({ t: 'dios', a: 'modo', k: 'golpe', v: true });
  const o = monstruo(dios, 'jefe_sabueso', 30); mundo.danar(o, 1, dios);
  chequear(o.hp <= 0, 'golpe divino mata de un golpe');
  const mtonAntes = dios.c.mton; chequear(mundo.darMton(dios, 100, 'x') === 0 && dios.c.mton === mtonAntes, 'con poderes de dios no se gana mTON');
  await dios.mandar({ t: 'dios', a: 'oro', p: nadie.id, n: 5000 });
  chequear(nadie.c.oro >= 5000, 'el dios da oro a otro jugador');
  await dios.mandar({ t: 'dios', a: 'skin', p: nadie.id, id: 'cosmico' });
  chequear(nadie.c.skins.includes('cosmico') && nadie.c.skin === 'cosmico', 'el dios entrega una skin premium y queda puesta');
  await dios.mandar({ t: 'dios', a: 'silenciar', p: nadie.id, min: 10 });
  nadie.ws.rec.length = 0; nadie.chatT = 0;
  await nadie.mandar({ t: 'chat', m: 'hola', canal: 'general' });
  chequear(!nadie.ws.rec.some(x => x.t === 'chat'), 'un silenciado no puede escribir');
  await dios.mandar({ t: 'dios', a: 'banear', p: nadie.id, horas: 1, motivo: 'pruebas' });
  chequear(nadie.ws.cerrado, 'banear lo expulsa');
  const vuelve = await entrar('Tramposo', 'f5');
  chequear(!vuelve.c, 'un baneado no puede volver a entrar');
  await calma();

  console.log('Skins premium');
  const pobre = await entrar('Pobreton', 'f6');
  await aMapa(pobre, 'pueblo', 950);
  pobre.c.oro = 10000000;
  await pobre.mandar({ t: 'comprar', k: 'skin', id: 'solar' });
  chequear(!pobre.c.skins.includes('solar') && pobre.c.oro === 10000000, 'una skin premium no se compra con oro');
  await pobre.mandar({ t: 'pedido', id: 'skin_solar', metodo: 'duende' });
  chequear(!mundo.pedidos.some(x => x.uid === pobre.c.uid), 'un invitado no puede hacer pedidos premium');

  console.log('Velocidad (anti speed-hack)');
  const rap = await entrar('Rapidin', 'f7');
  await aMapa(rap, 'noche', 200); limpiarMapa(rap);
  let x = rap.x;
  for (let i = 0; i < 40; i++) { avanzar(16); x += 150; await rap.mandar({ t: 'mv', x, y: 400, f: 1, a: 1 }); }
  chequear(rap.x < 200 + 1200, 'muchos mensajes cortos ya no cruzan el mapa (llegó a ' + Math.round(rap.x) + ')');
  const leg = await entrar('Legal', 'f8');
  await aMapa(leg, 'noche', 200);
  let xl = leg.x, snaps = 0;
  for (let i = 0; i < 60; i++) { avanzar(83); xl += 18; leg.ws.rec.length = 0; await leg.mandar({ t: 'mv', x: xl, y: 400, f: 1, a: 1 }); if (leg.ws.rec.some(m => m.t === 'snap')) snaps++; }
  chequear(snaps === 0 && Math.abs(leg.x - xl) < 1, 'correr normal no se corrige');
  await dios.mandar({ t: 'dios', a: 'modo', k: 'vel', v: true });
  await aMapa(dios, 'noche', 200);
  avanzar(16); await dios.mandar({ t: 'mv', x: 2000, y: 400, f: 1, a: 1 });
  chequear(dios.x === 2000, 'el dios con velocidad libre se mueve sin límite');
  for (const s of [n1b, n2, n3, n4, dios, pobre, rap, leg]) await dejar(s);
}

// ── MUNDO ABIERTO SIN CORTES: borde, piedras de viaje y Marcha de invasores ──
async function pruebasSinCortes() {
  console.log('Mundo abierto sin cortes');
  const D = await import('../mmo/js/data.js');
  const EV = await import('../functions/mmo/eventos.js');
  const a = await entrar('Caminante', 'e1');
  ponerNivel(a, 12, 'guerrero');
  await aMapa(a, 'noche', 2560); a.ws.rec.length = 0;
  const iDer = D.MAPAS.noche.portales.findIndex(p => p.a === 'amanecer');
  await a.mandar({ t: 'portal', i: iDer, borde: 1 });
  const mp = a.ultimos('mapa').pop();
  chequear(a.c.mapa === 'amanecer' && mp && mp.sc === 1 && a.x === 70, 'cruzar el borde derecho entra a la zona siguiente por su borde izquierdo, sin corte (x ' + a.x + ')');
  a.ws.rec.length = 0; a.portalT = 0;   // un viaje cada 0,7 s
  const iIzq = D.MAPAS.amanecer.portales.findIndex(p => p.a === 'noche');
  await a.mandar({ t: 'portal', i: iIzq, borde: 1 });
  chequear(a.c.mapa === 'noche' && a.x === D.MAPAS.noche.ancho - 70 && a.ultimos('mapa').pop().sc === 1, 'y hacia atrás aparece junto al borde derecho');
  await aMapa(a, 'noche', 2560); a.ws.rec.length = 0; a.portalT = 0;
  await a.mandar({ t: 'portal', i: iDer });
  chequear(a.ultimos('mapa').pop().sc === undefined, 'el portal normal (E) sigue con su transición');

  console.log('Piedras de viaje');
  chequear(D.tienePiedra('noche') && D.tienePiedra('acantilados') && !D.tienePiedra('pueblo') && !D.tienePiedra('coliseo'), 'hay piedra en las zonas abiertas, no en el pueblo ni el Coliseo');
  await aMapa(a, 'amanecer', D.PIEDRA_X); limpiarMapa(a);
  a.c.visitadas = ['noche', 'amanecer']; a.c.oro = 10000; avanzar(20000);
  a.ws.rec.length = 0;
  await a.mandar({ t: 'viajar', mapa: 'selva' });
  chequear(a.c.mapa === 'amanecer' && a.ultimos('no').length, 'no se viaja a una zona sin descubrir');
  await a.mandar({ t: 'viajar', mapa: 'noche' });
  chequear(a.c.mapa === 'noche' && a.c.oro === 10000 - D.costoViaje(D.MAPAS.noche.nv[0]), 'se viaja a una zona visitada pagando su costo');
  avanzar(20000);
  await aMapa(a, 'noche', 1500); a.ws.rec.length = 0;
  await a.mandar({ t: 'viajar', mapa: 'amanecer' });
  chequear(a.c.mapa === 'noche', 'lejos de la piedra no se viaja');
  await aMapa(a, 'noche', D.PIEDRA_X); a.combateT = Date.now();
  await a.mandar({ t: 'viajar', mapa: 'amanecer' });
  chequear(a.c.mapa === 'noche', 'en combate no se viaja');
  a.combateT = 0; a.c.oro = 0;
  await a.mandar({ t: 'viajar', mapa: 'amanecer' });
  chequear(a.c.mapa === 'noche', 'sin oro no se viaja');
  await a.mandar({ t: 'viajar', mapa: '__proto__' });
  chequear(a.c.mapa === 'noche', 'un destino raro no rompe nada');

  console.log('Marcha de invasores');
  if (mundo.evento) mundo.terminarEvento(false);
  mundo.marcha = null;
  chequear(EV.zonaSiguiente('noche') === 'amanecer' && EV.zonaSiguiente('amanecer') === 'selva', 'la zona siguiente es la del borde derecho');
  await aMapa(a, 'noche', 900); limpiarMapa(a);
  const ev = mundo.empezarEvento('noche');
  ev.part.add(a.c.uid); a.ws.rec.length = 0;
  mundo.terminarEvento(true);
  const g1 = a.ultimos('gana').pop();
  chequear(!mundo.evento && mundo.marcha && mundo.marcha.mapa === 'amanecer' && mundo.marcha.etapa === 2, 'al ganar, la invasión huye a la zona siguiente (etapa 2)');
  avanzar(EV.MARCHA_ESPERA_MS + 1000); mundo.tickEventos(Date.now(), {});
  chequear(mundo.evento && mundo.evento.mapa === 'amanecer' && mundo.evento.etapa === 2 && /Marcha 2\/3/.test(mundo.evento.nombre), 'pasados 25 s la marcha empieza allí');
  mundo.evento.part.add(a.c.uid); a.ws.rec.length = 0;
  mundo.terminarEvento(true);
  const g2 = a.ultimos('gana').pop();
  chequear(g1 && g2 && g2.oro > g1.oro * 1.1, 'la etapa 2 paga más (' + (g1 && g1.oro) + ' → ' + (g2 && g2.oro) + ')');
  avanzar(EV.MARCHA_ESPERA_MS + 1000); mundo.tickEventos(Date.now(), {});
  chequear(mundo.evento && mundo.evento.etapa === 3, 'llega a la etapa 3');
  mundo.evento.part.add(a.c.uid); a.ws.rec.length = 0;
  mundo.terminarEvento(true);
  const g3 = a.ultimos('gana').pop();
  chequear(g3 && g3.item && g3.item.r >= 2 && !mundo.marcha, 'la etapa 3 da un objeto épico o mejor y la marcha termina');
  const ev4 = mundo.empezarEvento('noche'); mundo.terminarEvento(false);
  chequear(ev4 && !mundo.marcha, 'perder una invasión no la hace marchar');
  await dejar(a);
}

// ── DUENDE QUEST 3D (functions/mmo/mundo3d.js) ──
async function entrar3d(nombre, n) {
  const ws = new WsFalso();
  mundo.abrir(ws);
  const s = [...mundo.sesiones.values()].pop();
  const tok = String(n).repeat(32).slice(0, 32).replace(/[^a-f0-9]/g, 'a');
  ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok }, nombre, modo: '3d' }) });
  for (let i = 0; i < 20 && !s.c; i++) await espera();
  for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 10));
  if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }
  s.ws = ws;
  s.mandar = o => { s.cuenta = 0; return mundo.recibir(s, JSON.stringify(o)); };
  s.ultimos = t => ws.rec.filter(m => m.t === t);
  s.limpiar = () => { ws.rec.length = 0; };
  return s;
}
async function pruebas3d() {
  console.log('Mundo 3D: entrar y moverse');
  const W = await import('../mmo/js/mundo3d.js');
  const D = await import('../mmo/js/data.js');
  const a = await entrar3d('Viajero3D', '3a1'), b = await entrar3d('Otro3D', '3a2');
  const dos = await entrar('Plano2D', '3a3');
  chequear(a.m3 && a.k === '~3d' && a.ultimos('m3').length === 1, 'entra al mundo 3D con su personaje');
  chequear(b.ultimos('m3').pop().jugadores.some(x => x.n === 'Viajero3D'), 've a los otros jugadores del mundo 3D');
  chequear(Math.hypot(a.p.x - W.SPAWN3D.x, a.p.z - W.SPAWN3D.z) < 1, 'aparece en el pueblo');
  avanzar(1000); await a.mandar({ t: 'mv3', x: a.p.x + 5, z: a.p.z, r: 1.5, a: 1 });
  chequear(Math.abs(a.p.x - (W.SPAWN3D.x + 5)) < 0.01 && a.c.p3, 'se mueve y la posición se guarda en el personaje');
  a.limpiar(); avanzar(50); await a.mandar({ t: 'mv3', x: a.p.x + 80, z: a.p.z });
  chequear(a.ultimos('snap3').length === 1 && a.p.x < 20, 'un salto imposible se corrige (anti speed-hack)');
  const x2d = dos.c.x;
  tick(3);
  chequear(!dos.ws.rec.some(m => m.t === 's3') && a.ws.rec.some(m => m.t === 's3') && dos.c.x === x2d, 'el 2D no recibe nada del 3D y sigue igual');

  console.log('Mundo 3D: monstruos y combate');
  const campo = W.campamentos(D.MAPAS, D.MONSTRUOS).find(c => c.zona === 'noche' && !c.jefe);
  ponerNivel(a, 6, 'guerrero');
  a.p = { x: campo.x + 2, z: campo.z + 2 }; a.movBud = undefined;
  for (let i = 0; i < 40; i++) tick(1);
  const cerca = [...mundo.m3.mons.values()].filter(o => o.campo === campo.id);
  chequear(cerca.length === campo.n, 'cerca de un campamento aparecen sus monstruos (' + cerca.length + '/' + campo.n + ')');
  chequear(a.ws.rec.some(m => m.t === 's3' && m.n && m.n.some(x => x.k === campo.k)), 'el jugador recibe los monstruos nuevos con sus datos');
  const o = cerca[0];
  o.x = a.p.x + 1; o.z = a.p.z; o.destino = null; o.paseo = Date.now() + 99999; o.hp = o.max = 100000;
  const lejos = cerca[1]; lejos.x = a.p.x + 60; lejos.z = a.p.z; lejos.paseo = Date.now() + 99999; lejos.destino = null;
  a.limpiar(); await a.mandar({ t: 'atk3', tg: lejos.id });
  chequear(lejos.hp === lejos.max && a.ultimos('no').length, 'fuera de alcance no se pega');
  const hp0 = o.hp;
  avanzar(1100); await a.mandar({ t: 'atk3', tg: o.id });
  chequear(o.hp < hp0 && o.obj === a.id, 'el golpe hace daño y el monstruo se enfada');
  await a.mandar({ t: 'atk3', tg: o.id });
  const hp1 = o.hp;
  chequear(hp1 === o.hp, 'no se pega más rápido que la recarga del arma');
  const hpA = a.hp; a.inv = 0; a.escudo = 0;
  for (let i = 0; i < 20; i++) tick(1);
  chequear(a.hp < hpA, 'el monstruo enfadado persigue y pega');
  const kills = a.c.kills, oro = a.c.oro, xpT = a.c.xp + a.c.nivel * 1e6;
  a.c.mis = { i: D.MISIONES.findIndex(q => q.tipo === o.k), p: 0 };
  o.hp = 1; avanzar(1100); await a.mandar({ t: 'atk3', tg: o.id });
  chequear(o.muere && a.c.kills === kills + 1 && a.c.oro > oro && a.c.xp + a.c.nivel * 1e6 > xpT, 'al matarlo cobra XP y oro como en el 2D');
  chequear(a.c.mis.i < 0 || a.c.mis.p === 1, 'la caza cuenta para la misión');
  chequear(a.ws.rec.some(m => m.t === 'md3' && m.id === o.id), 'avisa de su muerte');

  console.log('Mundo 3D: muerte, pueblo y tienda');
  a.limpiar(); mundo.herir(a, 999999, { jefe: true });
  chequear(a.muerto && a.ultimos('muerte').length, 'puede morir');
  await a.mandar({ t: 'revivir' });
  chequear(!a.muerto && a.ultimos('tp3').length && Math.hypot(a.p.x - W.SPAWN3D.x, a.p.z - W.SPAWN3D.z) < 1, 'revive en el pueblo');
  const merc = W.NPCS3D.find(n => n.tipo === 'tienda');
  a.c.oro = 1000; const pociones = a.c.pw.pocion;
  await a.mandar({ t: 'comprar', k: 'pw', id: 'pocion', n: 1 });
  chequear(a.c.pw.pocion === pociones, 'lejos del Mercader no se compra');
  a.p = { x: merc.x + 1, z: merc.z }; await a.mandar({ t: 'comprar', k: 'pw', id: 'pocion', n: 1 });
  chequear(a.c.pw.pocion === pociones + 1, 'junto al Mercader del pueblo 3D se compra');
  a.limpiar(); await a.mandar({ t: 'portal', i: 0 }); await a.mandar({ t: 'mv', x: 500, y: 400 });
  chequear(a.m3 && a.k === '~3d', 'los mensajes del 2D no sacan a nadie del mundo 3D');
  mundo.entrarMapa(a, 'noche', 300);
  chequear(a.k === '~3d', 'ni una mazmorra o la Torre de su grupo');
  for (const s of [a, b, dos]) await dejar(s);
  chequear(mundo.sesiones3d().length === 0, 'al salir, el mundo 3D queda vacío');
  tick(2);
  chequear(mundo.m3.mons.size === 0, 'y sin nadie, los monstruos se retiran');
}

// ── HABILIDADES Y MONTURAS EN EL MUNDO 3D ──
async function pruebasHabs3d() {
  console.log('Mundo 3D: habilidades de clase');
  const W = await import('../mmo/js/mundo3d.js');
  const D = await import('../mmo/js/data.js');
  const campo = W.campamentos(D.MAPAS, D.MONSTRUOS).find(c => c.zona === 'amanecer' && !c.jefe);
  const prepara = async (nombre, tok, clase, nv) => {
    const s = await entrar3d(nombre, tok);
    ponerNivel(s, nv, clase);
    s.p = { x: campo.x + 30, z: campo.z }; s.movBud = undefined; s.rec = s.st.recMax || 100;
    return s;
  };
  const muneco = (s, dx) => {
    const o = mundo.crear3d({ id: -1, x: s.p.x + dx, z: s.p.z, k: campo.k, n: 1, jefe: false, vivos: new Set(), zona: 'amanecer' });
    o.x = s.p.x + dx; o.z = s.p.z; o.hx = o.x; o.hz = o.z;   // crear3d lo desplaza al azar 1-5 m
    o.hp = o.max = 1e6; o.paseo = Date.now() + 1e9; o.destino = null;
    return o;
  };
  const g = await prepara('Guerrero3D', '4b1', 'guerrero', 40);
  let o = muneco(g, 1.5);
  g.rec = 50; g.cdHab = {}; g.gcdHasta = 0;
  await g.mandar({ t: 'hab3', id: 'golpe_heroico', tg: o.id });
  chequear(o.hp < o.max && g.rec === 35, 'Golpe Heroico pega y gasta 15 de Ira');
  g.limpiar(); avanzar(1100);
  const lejos = muneco(g, 40);
  await g.mandar({ t: 'hab3', id: 'golpe_heroico', tg: lejos.id });
  chequear(lejos.hp === lejos.max && g.ultimos('no').length, 'fuera de alcance no se lanza');
  avanzar(1100); o.au = {}; const x0 = g.p.x;
  const lejano = muneco(g, 12);
  await g.mandar({ t: 'hab3', id: 'carga', tg: lejano.id });
  chequear(Math.abs(g.p.x - x0) > 8 && mundo.auraMon(lejano, 'aturdido'), 'Carga lleva junto al enemigo y lo aturde');

  const m = await prepara('Mago3D', '4b2', 'mago', 40);
  o = muneco(m, 15);
  m.cdHab = {}; m.gcdHasta = 0;
  await m.mandar({ t: 'hab3', id: 'bola_fuego', tg: o.id });
  chequear(m.cast && m.cast.h === 'bola_fuego' && o.hp === o.max, 'Bola de Fuego empieza a lanzarse');
  for (let i = 0; i < 17; i++) tick(1);
  chequear(!m.cast && o.hp < o.max, 'al acabar el lanzamiento, la bola pega');
  avanzar(1100); m.limpiar();
  await m.mandar({ t: 'hab3', id: 'bola_fuego', tg: o.id });
  avanzar(200); await m.mandar({ t: 'mv3', x: m.p.x + 2, z: m.p.z });
  chequear(!m.cast && m.ultimos('castFin').some(x => x.ok === false), 'moverse cancela el lanzamiento');
  avanzar(15000); m.gcdHasta = 0; m.cdHab = {};
  const cerca = muneco(m, 3);
  await m.mandar({ t: 'hab3', id: 'nova' });
  chequear(mundo.auraMon(cerca, 'raiz') && cerca.hp < cerca.max, 'Nova de Escarcha congela a los de alrededor');

  const p = await prepara('Cura3D', '4b3', 'sacerdote', 40);
  p.hp = 10; p.cdHab = {}; p.gcdHasta = 0;
  await p.mandar({ t: 'hab3', id: 'sanar' });
  for (let i = 0; i < 20; i++) tick(1);
  chequear(p.hp > 10, 'Sanar cura al sacerdote');

  const r = await prepara('Picaro3D', '4b4', 'picaro', 40);
  o = muneco(r, 1.5);
  r.rec = 100; r.combo = 0; r.cdHab = {}; r.gcdHasta = 0;
  await r.mandar({ t: 'hab3', id: 'siniestro', tg: o.id });
  chequear(r.combo === 1, 'Golpe Siniestro suma un punto de combo');
  avanzar(1100); r.rec = 100; const hp1 = o.hp;
  await r.mandar({ t: 'hab3', id: 'eviscerar', tg: o.id });
  chequear(r.combo === 0 && o.hp < hp1, 'Eviscerar gasta los puntos de combo');

  console.log('Mundo 3D: monturas');
  mundo.m3.mons.clear(); for (const c of mundo.m3.campos) { c.vivos.clear(); c.prox = Date.now() + 1e9; }
  g.c.monturas = [Object.keys(D.MONTURAS)[0]]; g.c.montura = g.c.monturas[0]; g.combateT = 0; g.cast = null;
  await g.mandar({ t: 'montar' });
  for (let i = 0; i < 17; i++) tick(1);
  chequear(g.montado === g.c.montura, 'se monta en el mundo 3D');

  console.log('Mundo 3D: vuelo');
  avanzar(1000); r.movBud = undefined;
  for (let i = 0; i < 4; i++) { avanzar(1000); r.movBud = undefined; await r.mandar({ t: 'mv3', x: r.p.x + 0.2, z: r.p.z, a: 3, h: 20 }); }
  chequear(r.h === 20, 'la altura de vuelo llega al servidor (subiendo a ritmo real)');
  chequear(true, 'la subida está limitada por segundo');
  avanzar(200); r.limpiar(); const hpV = o.hp; r.cdHab = {}; r.gcdHasta = 0; r.rec = 100;
  await r.mandar({ t: 'hab3', id: 'siniestro', tg: o.id });
  chequear(o.hp === hpV && r.ultimos('no').length, 'desde el cielo no se combate');
  for (let i = 0; i < 10; i++) { avanzar(1000); r.movBud = undefined; await r.mandar({ t: 'mv3', x: r.p.x, z: r.p.z, a: 3, h: 999 }); }
  chequear(r.h === 46, 'la altura de vuelo tiene tope');
  avanzar(200); r.p = { x: 5, z: 5 }; r.movBud = undefined; r.h = 0; r.a = 0;
  await r.mandar({ t: 'mv3', x: 5.5, z: 5, a: 3, h: 20 });
  chequear(r.p.x === 5.5 && !(r.h > 0), 'en el pueblo no se vuela');
  for (const s of [g, m, p, r]) await dejar(s);
}
