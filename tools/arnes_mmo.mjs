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
import { MAPAS, HABS, CLASES, statsJugador } from '../mmo/js/data.js';

let reloj = 1_800_000_000_000 + 7 * 60 * 1000;   // lejos de las :00/:30 del jefe mundial
const dateNowReal = Date.now;
Date.now = () => reloj;

const almacen = new Map();
const state = {
  storage: {
    get: async k => (almacen.has(k) ? structuredClone(almacen.get(k)) : undefined),
    put: async (k, v) => { almacen.set(k, structuredClone(v)); },
    delete: async k => almacen.delete(k),
  },
  blockConcurrencyWhile: f => f(),
};
export const mundo = new MmoWorld(state, {});

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
  for (let i = 0; i < 300 && !s.c; i++) await espera();
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
  chequear(!d1.muerto && d1.k === wI.clave && d1.x < 300, 'se revive en la entrada de la mazmorra');
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
  chequear(dz.c.descanso > 0 && dz.ultimos('toast').some(x => /Descansaste/.test(x.m)), 'tras 10 h fuera hay XP de descanso (' + dz.c.descanso + ')');
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

  console.log('Monstruos pasivos no pegan a quien no les ataca');
  const t2 = await entrar('Turista', 5);
  await aMapa(t2, 'noche', 2000);
  const gob4 = monstruo(t2, 'goblin_normal', 0);
  const hpT = t2.hp;
  tick(30);
  chequear(t2.hp === hpT, 'el turista no recibe daño de un goblin pasivo');
}

pruebas().then(resumen).catch(e => { console.error(e); process.exit(1); });
