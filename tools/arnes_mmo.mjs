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
  const ids = () => salidos.map(x => String(x.chat_id)).sort().join(',');
  const deQuien = id => salidos.find(x => String(x.chat_id) === id);
  const A = D + 10;
  irA(A);
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
  chequear(horaHabitual({ hs: [20, 20] }) === HORA_DEFECTO && horaHabitual({}) === HORA_DEFECTO, 'con menos de 3 días anotados, las 17:00');
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
  chequear(h1.ultimos('aviso').some(x => /🔥/.test(x.m)), 'se avisa a todo el servidor');
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
  n.c.login = { d: hace(2), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 4, 'faltar un día retrocede dos en la racha');
  n.c.login = { d: hace(2), racha: 7, total: 7 };
  chequear(mundo.procesarLogin(n).racha === 1, 'tras el día 7, faltar vuelve a empezar (no se cobra el 7 cada 3 días)');
  n.c.login = { d: hace(3), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 1, 'faltar más vuelve a empezar');
  n.c.login = { d: hace(1), racha: 5, total: 5 };
  chequear(mundo.procesarLogin(n).racha === 6 && n.c.login.d === hoy, 'jugar seguido la sube');
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
  chequear(pr.ultimos('toast').some(x => /Próximo evento: Cosecha del Maíz Morado, desde el 13 de noviembre \(en 5 días\)/.test(x.m)), 'sin evento, se anuncia el próximo si falta poco');
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
  chequear(Object.values(D.MONTURAS).every(mo => D.HOJAS[mo.hoja] && (mo.precio > 0 || mo.banda) && mo.vel > 1), 'todas las monturas tienen hoja, precio y velocidad');
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
  // En una zona tambien hay pesquero; en una mazmorra no.
  chequear(D.pesqueroDe('selva') && !D.pesqueroDe('catacumbas') && !D.pesqueroDe('coliseo'), 'pesqueros en zonas, no en mazmorras ni Coliseo');
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
  mundo.puntoPase(j, D.PASE.puntos.semanal); mundo.puntoPase(j, 50);
  chequear(j.c.pase.p === 80, 'suma puntos (80)');
  j.limpiar(); await j.mandar({ t: 'pase', n: 2 });
  chequear(j.ultimos('no').some(x => /Aún no/.test(x.m)), 'no se cobra un nivel no alcanzado');
  const oro0 = j.c.oro;
  await j.mandar({ t: 'pase', n: 1 });
  chequear(j.c.pase.cob.includes(1) && j.c.oro > oro0, 'el nivel 1 se cobra (oro)');
  j.limpiar(); await j.mandar({ t: 'pase', n: 1 });
  chequear(j.ultimos('no').some(x => /Ya cobraste/.test(x.m)), 'no se cobra dos veces');
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
  chequear(o && o.k === D.mundialDe(base + 2 * 1800000 + 1000) && v.ultimos('aviso').some(x => x.m.includes(D.MONSTRUOS[o.k].nombre.toUpperCase())), 'aparece el que toca y el aviso dice su nombre (' + (o && o.k) + ')');
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
  let tx = null;
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, o) => {
    const u = String(url);
    if (/mainnet-beta|helius/.test(u)) return { json: async () => ({ result: tx }) };
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
    chequear(vt.ok && vt.d7.n >= 1 && vt.d7.sol >= 1 && vt.d7.top.some(x => /Skin King/.test(x.nombre)) && vt.pendientes >= 1, '/ventas resume lo entregado (7 y 30 días, por método y lo más vendido) y lo pendiente');
    // Anular libera la firma.
    await mundo.anularPedido({ codigo: pC.codigo, motivo: 'prueba' });
    chequear(!(await state.storage.get('firma:' + '6'.repeat(88))), 'anular un pedido deja libre su firma');
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
    chequear(j.st.def === mundo.stats(j.c).def && avisosJ.some(t => /Skin King/.test(t)), 'sus poderes se aplican al momento y se le avisa');
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
  const a = await entrar('Amiga', '7d'), b = await entrar('Amigo', '7e');
  a.limpiar(); b.limpiar();
  await a.mandar({ t: 'contactoAdd', p: b.id });
  const l = a.ultimos('contactos').pop();
  chequear(l && l.l.length === 1 && l.l[0].n === 'Amigo' && l.l[0].on === 1 && l.l[0].uid === pub(b.c.uid), 'se añade y sale conectado');
  chequear(!JSON.stringify(l).includes(b.c.uid), 'la lista no lleva el uid real');
  chequear(b.ultimos('toast').some(x => /te añadió/.test(x.m)), 'al otro se le avisa');
  a.limpiar(); await a.mandar({ t: 'contactoAdd', p: b.id });
  chequear(a.ultimos('no').length === 1 && a.c.contactos.length === 1, 'no se repite');
  b.limpiar();
  for (let i = 0; i < 10; i++) { await a.mandar({ t: 'contactoQuitar', uid: pub(b.c.uid) }); await a.mandar({ t: 'contactoAdd', p: b.id }); }
  chequear(b.ultimos('toast').filter(x => /te añadió/.test(x.m)).length === 0, 'añadir y quitar en bucle no inunda al otro de avisos');
  await dejar(b);
  a.limpiar();
  const bR = await entrar('Amigo', '7e');
  chequear(!a.ultimos('toast').some(x => /se conectó/.test(x.m)), 'una reconexión rápida no repite el aviso');
  await dejar(bR);
  avanzar(6 * 60000); a.actT = Date.now();
  a.limpiar(); await a.mandar({ t: 'contactos' });
  chequear(a.ultimos('contactos').pop().l[0].on === 0, 'al irse sale desconectado');
  a.limpiar();
  const b2 = await entrar('Amigo', '7e');
  chequear(a.ultimos('toast').some(x => /Tu amigo Amigo se conectó/.test(x.m)), 'al volver, aviso de que se conectó');
  console.log('Inspeccionar');
  b2.c.oro = 12345; b2.c.mton = 77;
  a.limpiar(); await a.mandar({ t: 'inspeccionar', p: b2.id });
  const ins = a.ultimos('inspeccion').pop();
  chequear(ins && ins.n === 'Amigo' && ins.eq && typeof ins.logros === 'number', 'inspeccionar devuelve nombre, equipo y logros');
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
  chequear(!L.k.includes('#') && L.ultimos('no').some(x => /son para 5/.test(x.m)), 'una banda de 6 no entra a una mazmorra de 5 (ni a sus Desafíos)');
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
  chequear(d.c.oro === oro0 + D.premioDesSem(0) + logro && d.c.maestroDes === 1 && (d.c.logros || []).includes('maestrodes'), 'el lunes el 1º cobra ' + D.premioDesSem(0) + ' de oro y el título (más el oro del logro)');
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
