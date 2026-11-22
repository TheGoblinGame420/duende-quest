// ═══════════════════════════════════════════════════════
// CHICHA WARS — juego (v1)
// Bucle: las ollas cocinan chicha (gastan maiz morado), los vasos van a las
// jarras del mostrador, los clientes los compran y los duendes ladrones
// llegan por oleadas a robarlos: se espantan tocandolos.
// Guardado en el navegador (cw_estado). La cuenta compartida con Duende Quest,
// el pase premium y el mercado entre jugadores llegan con el servidor.
// ═══════════════════════════════════════════════════════
import * as D from './datos.js?v=401';
import * as A from './arte.js?v=401';
import { pedir } from './red.js?v=401';
import { abrirCuenta } from '/js/cuenta.js?v=401';   // la misma cuenta de Duende Quest, sin salir del juego
import * as R from './rig.js?v=401';

const W = 540, PISO = 360;
let H = 640, Y_OLLA = 505, Y_CH = 590;   // la escena llena el alto libre de la pantalla: ajustar() recalcula H y baja ollas y chichera
const $ = id => document.getElementById(id);
const lienzo = $('escena'), x = lienzo.getContext('2d');
const NUM = new Intl.NumberFormat('es-PE');   // un solo formateador: toLocaleString creaba uno en cada llamada (2-3 por cuadro en el HUD)
const fmt = n => NUM.format(Math.floor(n));
const hoyPeru = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const azar = (a, b) => a + Math.random() * (b - a);

// ── ESTADO ──
function nuevo() {
  return {
    v: 1, monedas: D.MONEDAS_INICIO, maiz: D.MAIZ_INICIO, stock: 0,
    nv: { ollas: [0, 0, 0, 0], fuego: 0, hornillas: 0, receta: 0, cucharon: 0, toldo: 0, ayudante: 0 },
    ollas: [{ fin: 0, lista: false }, { fin: 0, lista: false }, { fin: 0, lista: false }, { fin: 0, lista: false }],
    oleada: 1, pase: { xp: 0, premium: false, g: [], p: [] }, mis: null, racha: { dia: '', n: 0, cobrado: '' },
    stats: { vasos: 0, duendes: 0, tandas: 0, mejoras: 0, oleadas: 0, dorados: 0, jefes: 0, pociones: 0, herencias: 0, oleadaMax: 0 },
    ing: { pina: 0, manzana: 0, canela: 0, limon: 0, azucar: 0, clavo: 0 }, poc: {}, act: {}, fama: { n: 1, p: 0 }, rs: 0, ganado: 0, logros: [],
    saz: { n: 1, xp: 0, hab: {}, pend: 0, dur: {} },
    chacra: [null, null, null, null, null, null, null, null, null], parc: D.PARCELAS.inicio, semilla: 'maiz', esp: { n: 0, mult: 1, nom: '' },
    eq: { cucharon: 0, tabla: 0, exprimidor: 0, colador: 0, vaso: 0, jarra: 0 }, rafaga: 0,
    personaje: 'chichera', skin: { chichera: 'clasica', chichero: 'clasico' }, skins: ['clasica', 'clasico'],
    t: Date.now(), sonido: true, elegido: false,
  };
}
let E;
try { E = JSON.parse(localStorage.getItem('cw_estado') || 'null'); } catch (e) { E = null; }
if (!E || E.v !== 1) E = nuevo();
E = Object.assign(nuevo(), E);
E.eq = Object.assign({ cucharon: 0, tabla: 0, exprimidor: 0, colador: 0, vaso: 0, jarra: 0 }, E.eq);
E.stats = Object.assign(nuevo().stats, E.stats); E.ing = Object.assign(nuevo().ing, E.ing); E.pase.d = E.pase.d || [];
E.stats.cosechas = E.stats.cosechas || 0; E.stats.chichas = E.stats.chichas || 0;
if (!Array.isArray(E.chacra)) E.chacra = nuevo().chacra;
while (E.chacra.length < D.PARCELAS.max) E.chacra.push(null); E.chacra.length = D.PARCELAS.max;
E.saz = Object.assign(nuevo().saz, E.saz); E.saz.dur = E.saz.dur || {};
for (const id in E.saz.hab) if (E.saz.dur[id] == null) E.saz.dur[id] = D.usosMax(id, E.saz.hab[id]);   // partidas de antes del desgaste: empiezan enteros
E.parc = Math.max(D.PARCELAS.inicio, Math.min(D.PARCELAS.max, E.parc | 0)); if (!D.CULTIVOS[E.semilla]) E.semilla = 'maiz'; E.esp = Object.assign({ n: 0, mult: 1, nom: '' }, E.esp);
E.eq.cucharon = Math.max(E.eq.cucharon, Math.min(4, E.nv.cucharon || 0));   // el cucharon de pelea de la v1 pasa a ser la herramienta
function guardar() { E.t = Date.now(); try { localStorage.setItem('cw_estado', JSON.stringify(E)); } catch (e) {} }
setInterval(guardar, 5000);
addEventListener('pagehide', guardar);
document.addEventListener('visibilitychange', () => { if (document.hidden) guardar(); });

// ── CUENTA EN EL SERVIDOR (red.js → functions/mmo/chichawars.js) ──
// La partida se guarda tambien en tu cuenta de Duende Quest cada 30 s: si abres el juego en otro aparato
// con la misma cuenta, sigues donde te quedaste. Lo que llega de fuera (ventas, pase) son abonos.
const NUBE = { ok: false, cuenta: false, dueno: false, premium: false, cod: '', cambio: 0, ack: [], mercado: [], mios: [], tipoM: 'maiz' };
E.abHechos = E.abHechos || [];
function aplicar(r) {
  if (!r || !r.ok) { if (r && r.m && !r.red && r.auth !== false) aviso(r.m, 'err'); return false; }
  NUBE.ok = true; NUBE.cuenta = !!r.cuenta; NUBE.dueno = !!r.dueno; NUBE.cod = r.cod || ''; NUBE.cambio = r.cambio || 0;
  if (r.premium && !E.pase.premium) { E.pase.premium = true; marcarTab('pase'); }
  NUBE.premium = !!r.premium;
  for (const ab of r.abonos || []) {
    if (!E.abHechos.includes(ab.id)) {
      E.abHechos.push(ab.id); if (E.abHechos.length > 80) E.abHechos.shift();
      if (ab.monedas) E.monedas += ab.monedas;
      if (ab.premium) E.pase.premium = true;
      if (ab.txt) aviso(ab.txt, 'ok');
      son('moneda');
    }
    if (!NUBE.ack.includes(ab.id)) NUBE.ack.push(ab.id);
  }
  if (r.hecho) { for (const k of ['monedas', 'maiz', 'stock']) if (r.hecho[k]) E[k] = Math.max(0, E[k] + r.hecho[k]); }
  if (r.mercado) NUBE.mercado = r.mercado;
  if (r.mios) NUBE.mios = r.mios;
  return true;
}
async function subir() {
  guardar();
  const ack = NUBE.ack.slice();
  const r = await pedir('guardar', { est: E, ack });
  // Sin señal a media partida: se avisa una vez (el juego sigue y guarda en el aparato) y otra al volver.
  if (r && r.red) { if (NUBE.ok && !NUBE.sinRed) { NUBE.sinRed = true; aviso('Sin conexión: tu partida se sigue guardando en este aparato.', ''); } }
  else if (NUBE.sinRed && r && r.ok) { NUBE.sinRed = false; aviso('✓ Conexión de vuelta: partida guardada.', 'ok'); }
  if (aplicar(r)) NUBE.ack = NUBE.ack.filter(id => !ack.includes(id));
  guardar();
}
async function bajar() {
  const r = await pedir('cargar');
  if (!r || !r.ok) return;
  // La partida de la cuenta es mas nueva (otro aparato): se usa esa (una vez por sesion, sin bucles).
  let ya = ''; try { ya = sessionStorage.getItem('cw_bajado') || ''; } catch (e) {}
  if (r.est && (r.est.t || 0) > (E.t || 0) + 5000 && !ya) {
    try { sessionStorage.setItem('cw_bajado', '1'); localStorage.setItem('cw_estado', JSON.stringify(r.est)); } catch (e) {}
    location.reload(); return;
  }
  aplicar(r); pintarPanel(); subir();
}
setInterval(subir, 30000);

// ── SONIDO (sintetizado, sin archivos) ──
let AC = null, SALIDA = null, voces = 0, colgado = false;
const ultSon = {};   // ultimo instante (ms) de cada tipo de sonido
// Sin saturar: en una oleada grande sonaban decenas de golpes y monedas a la vez (se sumaban hasta distorsionar).
// Ahora: el mismo sonido no se repite antes de 45 ms, hay como mucho 10 voces a la vez y todo pasa por un compresor
// suave (un sonido solo queda por debajo de su umbral: suena igual que antes).
const SON_MIN_MS = 45, SON_MAX_VOCES = 10;
function son(tipo) {
  if (!E.sonido) return;
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      try { SALIDA = AC.createDynamicsCompressor(); SALIDA.threshold.value = -18; SALIDA.knee.value = 12; SALIDA.ratio.value = 6; SALIDA.attack.value = 0.003; SALIDA.release.value = 0.2; SALIDA.connect(AC.destination); } catch (e) { SALIDA = null; }
      AC.onstatechange = () => { if (AC.state === 'running') colgado = false; };
    }
    if (AC.state !== 'running') {   // iPhone lo suspende al cambiar de app o con una llamada; el siguiente toque lo despierta
      if (AC.resume) { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); }
      if (colgado) return;   // mientras sigue dormido, solo uno en cola: al despertar no suena todo junto
      colgado = true;
    }
    const ahora = performance.now();
    if (voces >= SON_MAX_VOCES && ahora - (ultSon._voz || 0) > 2000) voces = 0;   // por si algun final no llego: nunca se queda mudo
    if (ahora - (ultSon[tipo] || -1e9) < SON_MIN_MS || voces >= SON_MAX_VOCES) return;
    ultSon._voz = ahora;
    ultSon[tipo] = ahora;
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
    const P = { golpe: ['square', 220, 90, 0.12], moneda: ['triangle', 880, 1320, 0.12], robo: ['sawtooth', 300, 120, 0.25], lista: ['sine', 660, 990, 0.18], mejora: ['triangle', 523, 1046, 0.25], nivel: ['sine', 523, 1568, 0.45], tap: ['sine', 400, 300, 0.05] }[tipo] || ['sine', 440, 440, 0.1];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t0); o.frequency.exponentialRampToValueAtTime(P[2], t0 + P[3]);
    g.gain.setValueAtTime(0.08, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + P[3]);
    o.connect(g).connect(SALIDA || AC.destination); voces++; o.onended = () => { voces = Math.max(0, voces - 1); try { o.disconnect(); g.disconnect(); } catch (e) {} };
    o.start(t0); o.stop(t0 + P[3] + 0.02);
  } catch (e) {}
}
const vibrar = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ── VALORES DERIVADOS ──
const HR = id => D.HERRAMIENTAS[id].niv[E.eq[id]];
const nOllas = () => D.HORNILLAS[E.nv.hornillas].n;
// Hervor Cosmico (cucharon legendario): x3 de velocidad 10 s de cada minuto.
const hervor = () => !!HR('cucharon').hervor && (Date.now() / 1000) % 60 < 10;
const activo = id => (E.act[id] || 0) > Date.now();
const estr = id => E.saz.hab[id] || 0;   // estrellas de un utensilio de batalla (aunque este gastado)
// Estrellas que cuentan: un utensilio gastado pelea a medias (la mitad de sus estrellas) hasta que lo repares.
// (Medido con jugador simulado: si no hiciera nada, un jugador que toca poco entra en espiral: sin utensilios no
// espanta duendes, sin Sazon no recibe utensilios nuevos y sin monedas no puede reparar.)
const hab = id => (E.saz.dur[id] > 0 ? estr(id) : estr(id) * 0.5);
const habTotal = () => Object.keys(E.saz.hab).reduce((a, id) => a + hab(id), 0);
function gastar(id) {
  if (!(E.saz.dur[id] > 0)) return;
  if (--E.saz.dur[id] <= 0) { E.saz.dur[id] = 0; aviso('🔧 Se gastó tu ' + D.HABILIDADES[id].nombre + ': pelea a medias hasta que lo repares en el Taller', 'err'); marcarTab('taller'); son('robo'); }
}   // pocion del Taller en efecto
const segTanda = () => D.FUEGOS[E.nv.fuego].seg / (1 + HR('cucharon').coccion) / (1 + HR('tabla').corte * 0.25) / (hervor() ? 3 : 1) / (activo('fuego') ? 2 : 1) / (1 + E.rs * D.HERENCIA.coccion) / (1 + hab('fuego') * 0.08);
const vasosOlla = i => Math.round(D.OLLAS[E.nv.ollas[i]].vasos * (1 + HR('cucharon').prod));
const maizOlla = i => D.OLLAS[E.nv.ollas[i]].vasos * D.MAIZ.porVaso * (1 - HR('tabla').ahorro);
const precio = () => D.RECETAS[E.nv.receta].precio * (1 + HR('vaso').venta) * (1 + HR('colador').calidad) * (HR('colador').nectar ? 2 : 1) * (1 + (HR('jarra').temp || 0)) * (activo('receta') ? 1.5 : 1) * (1 + E.rs * D.HERENCIA.precio) * (1 + hab('fiesta') * 0.08);
const capStock = () => Math.round(D.STOCK_BASE * (1 + HR('jarra').cap));
const horaPunta = () => (Date.now() / 1000) % D.HORA_PUNTA.cada < D.HORA_PUNTA.dura;
const segCliente = () => D.TOLDOS[E.nv.toldo].seg / (1 + HR('colador').rep) / (horaPunta() ? D.HORA_PUNTA.mult : 1) / (activo('reloj') ? 2 : 1);
const PUESTOS = [118, 238, 352];
const SPR_PJ = { chichera: 'chichera_maestra', chichero: 'agricultor' };   // donde se paran los clientes (las jarras van a la derecha del mostrador)
const dano = () => HR('cucharon').dano;
const fmtP = n => n >= 100 ? fmt(n) : NUM.format(Math.round(n * 10) / 10);
const coma = n => String(Math.round(n * 10) / 10).replace('.', ',');
// Chicha especial: de los n vasos que se venden, los que quedan de la tanda especial pagan el extra.
function extraEspecial(n) { const s = E.esp; if (!(s.n > 0)) return 0; const k = Math.min(n, s.n); s.n -= k; return k * precio() * (s.mult - 1); }
const ayud = () => D.AYUDANTES[E.nv.ayudante];
let HOJA_CH = null;   // hoja de sprites de la chichera (12 poses junto a su olla): assets/chicha-wars/chichera_hoja.json
const conHoja = () => !!HOJA_CH && E.personaje === 'chichera' && !!A.img('chichera_hoja');
const xOlla = i => conHoja() ? 236 + i * 80 : 182 + i * 92;
const nivelPase = () => Math.min(D.PASE.niveles, Math.floor(E.pase.xp / D.PASE.xpNivel));

// ── EVENTOS DE PROGRESO (misiones y pase) ──
function sumar(id, n = 1) {
  const fp = D.FAMA_PTS[id]; if (fp) ganarFama(fp * (id === 'vende' ? n : 1));
  if (!E.mis) return;
  for (const m of E.mis.l) if (m.id === id && !m.hecho) { m.prog += n; if (m.prog >= m.n) { m.prog = m.n; m.hecho = true; aviso('✓ Misión cumplida: ' + D.MISIONES.find(x => x.id === id).txt(m.n), 'ok'); pintarPanel(); } }
}
function xp(n) {
  const antes = nivelPase();
  E.pase.xp += n;
  const ahora = nivelPase();
  if (ahora > antes) { aviso('⭐ ¡Pase nivel ' + ahora + '! Reclama tu premio en «Pase».', 'ok'); son('nivel'); pose('celebra', 1.6); marcarTab('pase'); }
}

// ── FAMA DEL PUESTO ──
function ganarFama(pts) {
  E.fama.p += pts;
  while (E.fama.p >= D.famaReq(E.fama.n)) {
    E.fama.p -= D.famaReq(E.fama.n); E.fama.n++;
    const pr = D.premioFama(E.fama.n); E.monedas += pr.monedas; darIng(pr.ing);
    aviso('🏅 ¡Fama nivel ' + E.fama.n + '! +' + fmt(pr.monedas) + ' monedas y ' + pr.ing + ' ingredientes', 'ok'); son('nivel'); pose('celebra', 1.4);
    for (const [id, po] of Object.entries(D.POCIONES)) if (po.fama === E.fama.n) { setTimeout(() => aviso('🧪 Nueva poción en el Taller: ' + po.nombre, 'ok'), 1500); marcarTab('taller'); }
  }
}
// Ingredientes al azar (los sueltan los duendes y la fama).
function darIng(n, px, py) {
  const ks = Object.keys(D.INGREDIENTES), got = {};
  for (let i = 0; i < n; i++) { const k = ks[Math.floor(Math.random() * ks.length)]; E.ing[k]++; got[k] = (got[k] || 0) + 1; }
  if (px != null) Object.entries(got).forEach(([k, c], j) => texto(px, py - j * 22, '+' + c + ' ' + D.INGREDIENTES[k].nombre, '#ffcc80', 18));
}
// Valor de una estadistica para logros y desafios.
function stat(k) {
  if (k === 'fama') return E.fama.n;
  if (k === 'oleadaMax') return Math.max(E.stats.oleadaMax || 0, E.oleada);
  if (k === 'herrEpica') return Object.values(E.eq).filter(r => r >= 3).length;
  if (k === 'herrLeg') return Object.values(E.eq).filter(r => r >= 4).length;
  return E.stats[k] || 0;
}
const logrosVisibles = () => { const g = {}; for (const l of D.LOGROS) if (!E.logros.includes(l.id) && !g[l.g]) g[l.g] = l; return Object.values(g); };
const logrosListos = () => logrosVisibles().filter(l => stat(l.stat) >= l.n);
const desafiosListos = () => D.DESAFIOS.filter(d => !E.pase.d.includes(d.id) && stat(d.stat) >= d.n);
const paseListos = () => { const nv = nivelPase(); let n = 0; for (let i = 1; i <= nv; i++) { if (!E.pase.g.includes(i)) n++; if (E.pase.premium && !E.pase.p.includes(i)) n++; } return n; };
const avisados = new Set();
setInterval(() => {
  if (!E.elegido) return;
  for (const l of logrosListos()) if (!avisados.has(l.id)) { avisados.add(l.id); aviso('🏆 Logro: ' + l.txt + ' · cóbralo en «Misiones»', 'ok'); marcarTab('misiones'); }
  for (const d of desafiosListos()) if (!avisados.has(d.id)) { avisados.add(d.id); aviso('⭐ Desafío de temporada cumplido: ' + d.txt, 'ok'); marcarTab('pase'); }
}, 2500);

// ── MISIONES Y RACHA DEL DIA ──
function revisarDia() {
  const hoy = hoyPeru();
  if (!E.mis || E.mis.dia !== hoy) {
    const dif = Math.min(2, Math.floor(E.stats.vasos / 600));
    const pool = [...D.MISIONES].sort(() => Math.random() - 0.5).slice(0, 3);
    E.mis = { dia: hoy, l: pool.map(m => ({ id: m.id, n: m.n[dif], prog: 0, hecho: false, cobrado: false })) };
  }
  if (E.racha.dia !== hoy) {
    const ayer = new Date(Date.parse(hoy + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    E.racha.n = E.racha.dia === ayer ? E.racha.n + 1 : 1;
    E.racha.dia = hoy;
  }
}
revisarDia();
setInterval(() => { revisarDia(); }, 60000);

// ── PROGRESO SIN CONEXION ──
function offline() {
  const jr = HR('jarra'), dt = Math.min(jr.offH * 3600000, Date.now() - (E.t || Date.now()));
  if (dt < 60000) return null;
  let vasos = 0, tandas = 0, gastoMaiz = 0;
  for (let i = 0; i < nOllas(); i++) {
    const posibles = Math.floor(dt / 1000 / segTanda()), porTanda = vasosOlla(i), maizT = maizOlla(i);
    const n = Math.min(posibles, Math.floor((E.maiz - gastoMaiz) / maizT));
    if (n > 0) { tandas += n; vasos += n * porTanda; gastoMaiz += n * maizT; }
  }
  const clientes = Math.floor(dt / 1000 / segCliente() * jr.efic);
  const vendidos = Math.min(E.stock + vasos, clientes * 2);
  const ganado = Math.round(vendidos * precio() + extraEspecial(vendidos));
  E.maiz -= gastoMaiz; E.stock = Math.min(capStock(), E.stock + vasos - vendidos); E.monedas += ganado; E.ganado = (E.ganado || 0) + ganado;
  E.stats.vasos += vendidos; E.stats.tandas += tandas;
  for (const o of E.ollas) { o.fin = 0; o.lista = false; }
  return { min: Math.round(dt / 60000), tandas, vendidos, ganado, gastoMaiz, horas: jr.offH, tope: dt >= jr.offH * 3600000 - 60000, sinMaiz: E.maiz < maizOlla(0) };
}
const vuelta = offline();

// ── ENTIDADES DE LA ESCENA ──
let duendes = [], clientes = [], parts = [], textos = [];
let proxCliente = 2, proxOleada = 12, colaSpawn = [], tSpawn = 0, ayudT = 0;
let poseAct = 'quieta', poseHasta = 0, T = 0;
const rigCh = R.rigNuevo(), rigAy = R.rigNuevo();
// Titeres: hojas de sprites con malla (rig.js). cuello y brazos en fracciones del dibujo; el primer brazo es el del cucharon.
const TIT = {
  chichera_maestra: { cuello: 0.30, falda: true, brazos: [{ pu: 0.30, pv: 0.40, cu: 0.10, cv: 0.30, r: 0.17, amp: 0.035 }, { pu: 0.70, pv: 0.42, cu: 0.88, cv: 0.36, r: 0.13, amp: 0.03, fase: 1.5 }] },
  _: { cuello: 0.27 },
};
const TITS = new Map();   // hoja ya hecha por imagen y modo: sin crear el campo (una funcion nueva) en cada cuadro
const titere = (k, im, modo) => { let m = TITS.get(im); if (!m) TITS.set(im, m = {}); return m[modo] || (m[modo] = R.hojaMalla(im, modo, modo === 'idle' ? 16 : 12, R.campo(TIT[k] || TIT._, modo))); };
let chVy = 0;
function pose(p, seg) {
  if (p === 'espanta') { rigCh.bend.golpe(3.4); rigCh.head.golpe(4); rigCh.sy.golpe(-2.2); }   // se lanza hacia los duendes
  if (p === 'celebra' && rigCh.dy >= 0) { chVy = -430; rigCh.sy.golpe(3.5); }                  // salta de alegria
  if (p === 'susto') { rigCh.sy.golpe(-3); rigCh.bend.golpe(-3); }                              // se echa atras
  if (p === 'remueve' && poseAct !== 'remueve') rigCh.bend.golpe(1.2);
  poseAct = p; poseHasta = T + seg;
}
// Jugo del juego: pausa de golpe, temblor de camara, combo y duendes que salen volando.
let paro = 0, temblor = 0, combo = 0, comboT = -9, comboVer = 0, voladores = [], piedras = [];
function temblar(n) { temblor = Math.max(temblor, n); }
function animarCh(dt) {
  const r = rigCh;
  r.breathe = Math.sin(T * 2.2) * 0.022;
  r.bend.obj = poseAct === 'remueve' ? Math.sin(T * 5) * 0.04 : poseAct === 'susto' ? -0.05 : 0;
  r.head.obj = poseAct === 'remueve' ? Math.sin(T * 5 - 0.7) * 0.06 : poseAct === 'susto' ? Math.sin(T * 38) * 0.06 : Math.sin(T * 1.3) * 0.03;
  r.sy.obj = poseAct === 'susto' ? 0.94 : 1;
  if (r.dy < 0 || chVy < 0) { chVy += 1500 * dt; r.dy += chVy * dt; if (r.dy >= 0) { r.dy = 0; chVy = 0; r.sy.golpe(-3.2); } }
  R.rigPaso(r, dt);
}

function particulas(px, py, n, color, opc = {}) {
  for (let i = 0; i < n; i++) parts.push({ x: px, y: py, vx: azar(-1, 1) * (opc.vel || 160), vy: azar(-1.2, -0.2) * (opc.vel || 160), g: opc.g ?? 420, vida: opc.moneda ? 1.1 : opc.vida || 0.7, t: 0, r: azar(2, opc.r || 5), color, moneda: opc.moneda });
}
// Posicion del contador de monedas en la escena (las monedas vuelan hasta el).
function hudMonedas() { const a = lienzo.getBoundingClientRect(), b = $('h-monedas').getBoundingClientRect(); return [(b.left - a.left + 6) / a.width * W, (b.top - a.top + b.height / 2) / a.height * H]; }
let hudM = [60, 26], pulsoT = 0;
setInterval(() => { try { hudM = hudMonedas(); } catch (e) {} }, 1000);
function texto(px, py, txt, color = '#ffe082', tam = 26) { textos.push({ x: px, y: py, txt, color, tam, t: 0 }); }

function spawnDuende(k) {
  const n = E.oleada;
  const VAR = { ladron: ['pirata', 'vampiro', 'esqueleto'], rapido: ['lobo'], gordo: ['momia'], gancho: ['bruja'], jefe: ['jefe'], dorado: ['lobo', 'pirata'] }[k] || ['pirata'];
  if (k === 'jefe') { alertaJefe = 2.8; vibrar(120); }
  if (k === 'dorado') { duendes.push({ rig: R.rigNuevo(), k, var: VAR[Math.floor(Math.random() * VAR.length)], x: W + 40, y: azar(Y_OLLA + 15, H - 30), vida: 1, max: 1, vel: D.DUENDES.dorado.vel, lleva: 0, huye: false, golpe: 0, robaT: 0 }); return; }
  duendes.push({ rig: R.rigNuevo(), k, var: VAR[Math.floor(Math.random() * VAR.length)], x: W + 40, y: azar(Y_OLLA - 25, H - 40), vida: D.vidaDuende(k, n), max: D.vidaDuende(k, n), vel: D.DUENDES[k].vel * azar(0.9, 1.1), lleva: 0, huye: false, golpe: 0, robaT: 0 });
}
function golpear(d, n, auto) {
  d.vida -= n; d.golpe = auto ? 0.18 : 0.35;
  d.rig.flash = 1; d.rig.sy.golpe(-4); d.rig.bend.golpe(5); d.rig.head.golpe(6); d.x += D.DUENDES[d.k].jefe ? 4 : 12;
  if (!auto) { paro = Math.max(paro, D.DUENDES[d.k].jefe ? 0.07 : 0.045); temblar(D.DUENDES[d.k].jefe ? 5 : 2.5); }
  parts.push({ x: d.x, y: d.y - A.altoDuende(d.k, 0.8) * 0.5, anillo: true, t: 0, vida: 0.3, r: 10, color: '#fff' });
  if (!auto) { combo = T - comboT < 0.9 ? combo + 1 : 1; comboT = T; if (combo >= 3) comboVer = 1; }
  particulas(d.x, d.y - 60, 6, '#d65caa', { vel: 200 });
  texto(d.x, d.y - 110, '-' + n, '#ff8a80', 24);
  if (d.vida <= 0) {
    const pr = Math.round((D.DUENDES[d.k].dorado ? D.premioDorado(E.oleada) : D.premioDuende(d.k, E.oleada)) * (1 + hab('oro') * 0.2));
    ganarSazon(D.SAZ_XP[d.k] || 1); if (D.DUENDES[d.k].jefe) setTimeout(ruleta, 1400);
    if (D.DUENDES[d.k].dorado) { aviso('✨ ¡Atrapaste al duende dorado! +' + pr + ' monedas', 'ok'); son('nivel'); particulas(d.x, d.y - 60, 24, '#ffd54a', { vel: 320, moneda: true }); }
    E.monedas += pr; E.stats.duendes++; sumar('espanta'); xp(D.XP.duende);
    const def = D.DUENDES[d.k]; if (def.jefe) E.stats.jefes++; if (def.dorado) E.stats.dorados++;
    const nI = def.jefe ? D.DROP.jefe : def.dorado ? D.DROP.dorado : (Math.random() < D.DROP.prob ? 1 : 0);
    if (nI) darIng(nI, d.x, d.y - 170);
    if (d.lleva) { E.stock += d.lleva; texto(d.x, d.y - 140, '+' + d.lleva + ' vasos recuperados', '#c5e1a5', 20); }
    if (d.llevaMon) { E.monedas += d.llevaMon; monPrev += d.llevaMon; texto(d.x, d.y - 140, '+' + d.llevaMon + ' monedas recuperadas', '#c5e1a5', 20); }
    if (D.DUENDES[d.k].jefe) { xp(D.XP.jefe); pose('celebra', 2); aviso('👑 ¡Venciste al Rey de los Ladrones! +' + pr + ' monedas', 'ok'); vibrar(80); }
    particulas(d.x, d.y - 50, 14, '#ffd54a', { vel: 260, moneda: true });
    particulas(d.x, d.y - 50, 10, '#e0e0e0', { vel: 120, g: -60, vida: 0.9, r: 10 });
    texto(d.x, d.y - 90, '+' + pr, '#ffd54a', 28);
    d.muerto = true;
    voladores.push({ k: d.k, var: d.var, x: d.x, y: d.y, vx: 160 + Math.random() * 120, vy: -380 - Math.random() * 120, rot: 0, vr: 7 + Math.random() * 5, rig: d.rig, t: 0 });
    if (!auto || D.DUENDES[d.k].jefe) temblar(D.DUENDES[d.k].jefe ? 9 : 4);
  }
}

// ── SAZON: espantar duendes llena la barra; al subir eliges 1 de 3 utensilios de batalla ──
let pausa = false, proy = [], rayos = [], alertaJefe = 0;
const cdA = {};
function ganarSazon(n) { const s = E.saz; s.xp += n; while (s.xp >= D.sazReq(s.n)) { s.xp -= D.sazReq(s.n); s.n++; s.pend++; } }
function opcionesHab() {
  const tengo = Object.keys(E.saz.hab).length;
  return Object.keys(D.HABILIDADES).filter(id => estr(id) < D.MAX_EST && (estr(id) > 0 || tengo < D.MAX_HAB)).sort(() => Math.random() - 0.5).slice(0, 3);
}
const estrellas = e => '★'.repeat(e) + '☆'.repeat(D.MAX_EST - e);
function elegirHab() {
  const ops = opcionesHab();
  if (!ops.length) { const g = 40 * E.oleada * E.saz.pend; E.monedas += g; E.saz.pend = 0; aviso('🌶 ¡Sazón al máximo! +' + fmt(g) + ' monedas', 'ok'); return; }
  pausa = true; son('nivel'); vibrar(40);
  $('modal-c').innerHTML = `<div class="hab-t">¡Sazón nivel ${E.saz.n - E.saz.pend + 1}!</div><p>Elige un utensilio para tu puesto</p><div class="habs">${ops.map(id => { const h = D.HABILIDADES[id], e = estr(id);
    return `<button class="habc${h.pasiva ? ' pas' : ''}" data-id="${id}">${e ? '' : '<i class="nuevo">¡Nuevo!</i>'}<img src="${IMG}${h.img}.webp" alt=""><b>${h.nombre}</b><span class="est">${estrellas(e + 1)}</span><small>${h.d(e + 1)}</small></button>`; }).join('')}</div>
    <small class="hab-pie">Tus utensilios pelean solos, pero se gastan con el uso: repáralos en el Taller con tu cosecha. Elegir uno lo deja como nuevo.</small>`;
  $('modal').classList.add('on');
  $('modal-c').querySelectorAll('.habc').forEach(b => b.onclick = () => {
    if (!pausa) return;   // un solo toque por eleccion
    const id = b.dataset.id; E.saz.hab[id] = Math.min(D.MAX_EST, estr(id) + 1); E.saz.dur[id] = D.usosMax(id, E.saz.hab[id]); E.saz.pend = Math.max(0, E.saz.pend - 1);
    $('modal').classList.remove('on'); $('modal-c').innerHTML = ''; pausa = false; ultimo = performance.now();
    son('mejora'); pose('celebra', 1); particulas(110, 420, 18, '#ffd54a', { vel: 260 }); aviso('✨ ' + D.HABILIDADES[id].nombre + ' ' + '★'.repeat(estr(id)), 'ok'); guardar();
  });
}
const vivos = () => duendes.filter(d => !d.muerto && !d.huye && !D.DUENDES[d.k].dorado && d.x < W + 10);
function armas(dt) {
  const V = vivos(), b = dano();
  for (const id of ['cucharon', 'limon', 'hervor', 'canela', 'tabla']) {
    const e = hab(id); if (!e) continue;
    cdA[id] = (cdA[id] ?? 1) - dt; if (cdA[id] > 0 || !V.length) continue;
    if (id === 'cucharon') { cdA[id] = 1.5; gastar(id); for (const d of [...V].sort((p, q) => p.x - q.x).slice(0, 1 + (e > 2) + (e > 4))) proy.push({ tipo: 'cuch', x: 96, y: Y_CH - 160, d, t: 0, dur: 0.36, dmg: b * (1 + e) }); rigCh.bend.golpe(3); }
    else if (id === 'limon') { cdA[id] = 3.2; gastar(id); for (const d of [...V].sort(() => Math.random() - 0.5).slice(0, 1 + e)) proy.push({ tipo: 'limon', d, t: 0, dur: 0.45, dmg: b * (1 + Math.ceil(e / 2)) }); }
    else if (id === 'hervor') { cdA[id] = 5; gastar(id); const d0 = V.reduce((p, q) => p.x < q.x ? p : q); rayos.push({ y: d0.y - 45, t: 0 }); for (const d of V) if (Math.abs(d.y - d0.y) < 50) golpear(d, b * (2 + 2 * e), true); son('golpe'); temblar(2); }
    else if (id === 'canela') { cdA[id] = 6; gastar(id); let m = V[0], mn = -1; for (const p of V) { const n = V.filter(q => Math.hypot(p.x - q.x, p.y - q.y) < 90).length; if (n > mn) { mn = n; m = p; } } proy.push({ tipo: 'canela', x: 96, y: Y_CH - 160, tx: m.x, ty: m.y - 40, t: 0, dur: 0.55, dmg: b * (3 + 3 * e), r: 80 + 8 * e }); }
    else if (id === 'tabla') { const cerca = V.filter(d => d.x < W / 2 + 150); if (!cerca.length) { cdA[id] = 0.3; continue; } cdA[id] = 9 - e; gastar(id); for (const d of cerca) { d.x += 150; d.robaT = 0; golpear(d, b, true); } parts.push({ x: 170, y: 470, anillo: true, t: 0, vida: 0.5, r: 60, color: '#ffe082' }); son('golpe'); }
  }
  for (const p of proy) {
    p.t += dt / p.dur; if (p.t < 1 || p.hecho) continue; p.hecho = true;
    if (p.tipo === 'canela') { for (const d of vivos()) if (Math.hypot(d.x - p.tx, d.y - 40 - p.ty) < p.r) golpear(d, p.dmg, true); particulas(p.tx, p.ty, 22, '#ff9a3c', { vel: 300 }); parts.push({ x: p.tx, y: p.ty, anillo: true, t: 0, vida: 0.4, r: p.r * 0.5, color: '#ffb74d' }); temblar(3); son('golpe'); }
    else if (!p.d.muerto) { golpear(p.d, p.dmg, true); if (p.tipo === 'limon') particulas(p.d.x, p.d.y - 60, 8, '#e6ee5a', { vel: 160 }); }
  }
  proy = proy.filter(p => p.t < 1); for (const ry of rayos) ry.t += dt; rayos = rayos.filter(ry => ry.t < 0.4);
  alertaJefe = Math.max(0, alertaJefe - dt);
}
// Ruleta de la Abuela: premio al vencer al Rey de los Ladrones.
function ruleta() {
  if (enPortada) return;
  const P = [['monedas', fmt(60 * E.oleada) + ' monedas', 'ico_monedas'], ['maiz', '80 kg de maíz', 'ing_maiz'], ['ing', '5 ingredientes', 'ico_ingredientes'], ['pocion', 'Una poción', 'ico_magia'],
    ['estrella', '+1 ★ a un utensilio', 'cucharon_5'], ['monedasG', fmt(200 * E.oleada) + ' monedas', 'ico_monedas'], ['ing8', '8 ingredientes', 'ing_pina'], ['maizG', '150 kg de maíz', 'ing_maiz']];
  const g = Math.floor(Math.random() * P.length), k = P[g][0]; let txt = P[g][1];
  if (k === 'monedas') E.monedas += 60 * E.oleada; else if (k === 'monedasG') E.monedas += 200 * E.oleada; else if (k === 'maiz') E.maiz += 80; else if (k === 'maizG') E.maiz += 150;
  else if (k === 'ing') darIng(5); else if (k === 'ing8') darIng(8);
  else if (k === 'pocion') { const ids = Object.keys(D.POCIONES).filter(id => D.POCIONES[id].fama <= Math.max(2, E.fama.n)), id = ids[Math.floor(Math.random() * ids.length)]; E.poc[id] = (E.poc[id] || 0) + 1; txt = 'Poción: ' + D.POCIONES[id].nombre; }
  else { const ids = Object.keys(E.saz.hab).filter(id => estr(id) < D.MAX_EST); if (ids.length) { const id = ids[Math.floor(Math.random() * ids.length)]; E.saz.hab[id]++; E.saz.dur[id] = D.usosMax(id, E.saz.hab[id]); txt = D.HABILIDADES[id].nombre + ' ' + '★'.repeat(estr(id)); } else { E.monedas += 200 * E.oleada; txt = fmt(200 * E.oleada) + ' monedas'; } }
  guardar(); pausa = true;
  abrirModal(`<div class="hab-t">Ruleta de la Abuela</div><p>¡Venciste al Rey! Te llevas un premio.</p><div class="ruleta">${P.map(q => `<div class="rul"><img src="${IMG}${q[2]}.webp" alt=""><small>${q[1]}</small></div>`).join('')}</div><p class="rul-res" id="rul-res">&nbsp;</p>`,
    { txt: 'Cobrar', f: () => { pausa = false; ultimo = performance.now(); pose('celebra', 1.5); pintarPanel(); } });
  const ok = $('modal-ok'), cel = [...$('modal-c').querySelectorAll('.rul')]; ok.disabled = true;
  let i = 0, total = P.length * 3 + g, ms = 55;
  const paso = () => { cel.forEach((c, j) => c.classList.toggle('on', j === i % P.length)); son('tap');
    if (i >= total) { cel[g].classList.add('gana'); $('rul-res').textContent = '🎁 ' + txt; ok.disabled = false; son('nivel'); vibrar(60); return; }
    i++; ms += i > total - 8 ? 45 : 4; setTimeout(paso, ms); };
  paso();
}

// ── TOQUES ──
function aEscena(ev) { const r = lienzo.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H]; }
lienzo.addEventListener('pointerdown', ev => {
  if (!E.elegido) return;
  const [px, py] = aEscena(ev);
  son('tap');
  // 1. un duende (el mas cercano al dedo)
  let mejor = null, md = 70;
  for (const d of duendes) { if (d.muerto) continue; const dd = Math.hypot(d.x - px, d.y - A.altoDuende(d.k, 0.8) * 0.5 - py); if (dd < md + (D.DUENDES[d.k].jefe ? 30 : 0)) { md = dd; mejor = d; } }
  if (mejor) { if ((E.tuto || 0) < 2) E.tuto = 2; golpear(mejor, dano()); pose('espanta', 0.35); son('golpe'); vibrar(15); return; }
  // 2. una olla lista
  for (let i = 0; i < nOllas(); i++) {
    const o = E.ollas[i];
    if (Math.abs(px - xOlla(i)) < 55 && py > Y_OLLA - 130 && py < Y_OLLA + 40) {
      if (o.lista) { recoger(i); return; }
      if (o.fin) { if (!E.tuto) E.tuto = 1; o.fin = Math.max(Date.now(), o.fin - segTanda() * 1000 * 0.12); pose('remueve', 0.4); particulas(xOlla(i), Y_OLLA - 70, 5, '#d65caa', { vel: 110 }); texto(xOlla(i), Y_OLLA - 100, '¡A remover!', '#f8bbd0', 16); return; }
    }
  }
  for (let i = 0; i < nOllas(); i++) if (Math.abs(px - xOlla(i)) < 55 && py > Y_OLLA - 130 && py < Y_OLLA + 40 && !E.ollas[i].fin && !E.ollas[i].lista && E.maiz < maizOlla(i)) { abrirHoja('mercado'); return; }
  if (conHoja() && Math.abs(px - 150) < 62 && py > Y_CH - 120 && py < Y_CH + 20) { abrirHoja('cocina'); return; }   // la olla de la abuela: chicha especial
  // 3. salpicon al aire: el toque nunca se siente muerto
  pose('espanta', 0.3); particulas(px, py, 6, '#d65caa', { vel: 120 });
});
let llenoT = 0;
function recoger(i) {
  const o = E.ollas[i];
  if (E.stock >= capStock()) { if (Date.now() - llenoT > 4000) { llenoT = Date.now(); aviso('Tus jarras están llenas: vende o mejora la Jarra para guardar más.', 'err'); } return; }
  let n = vasosOlla(i);
  // Exprimidor: tanda critica (la Rafaga Citrica del legendario da 5 seguidas cada 20 tandas).
  const ex = HR('exprimidor');
  E.tandaN = (E.tandaN || 0) + 1;
  if (ex.rafaga && E.tandaN % 20 === 0) { E.rafaga = 5; aviso('🍋 ¡Ráfaga Cítrica! 5 tandas críticas seguidas', 'ok'); }
  let crit = false;
  if (E.rafaga > 0) { E.rafaga--; crit = true; } else if (Math.random() < ex.crit + (activo('calidad') ? 0.25 : 0)) crit = true;
  if (crit) { n = Math.round(n * ex.mult); texto(xOlla(i), Y_OLLA - 150, '¡CRÍTICO! ×' + String(ex.mult).replace('.', ','), '#ffd54a', 26); vibrar(30); }
  if (HR('cucharon').duplica && Math.random() < HR('cucharon').duplica) { n *= 2; texto(xOlla(i), Y_OLLA - 175, '¡Tanda doble!', '#c5e1a5', 20); }
  n = Math.min(n, capStock() - E.stock);
  o.lista = false; o.fin = 0;
  E.stock += n; E.stats.tandas++; sumar('tanda'); xp(D.XP.tanda);
  texto(xOlla(i), Y_OLLA - 120, '+' + n + ' vasos', '#f8bbd0', 24);
  particulas(xOlla(i), Y_OLLA - 80, 10, '#d65caa', { vel: 180 });
  son('lista');
}

// ── BUCLE ──
let ultimo = performance.now(), enPortada = true;
let animExtra = null;   // animacion de una ventana (barra de la chicha especial): va en este mismo requestAnimationFrame
let granjaT = 0;        // segundos con la granja abierta: tapa la escena entera y no hace falta pintarla
// Calidad automatica: si el celular no llega a ~40 cuadros por segundo jugando, el lienzo baja de resolucion
// (2 → 1,5 → 1,25 pixeles por punto). El dibujo es el mismo, solo un poco menos nitido; en celulares que ya van bien no cambia.
const DPR_PASOS = [2, 1.5, 1.25], dts = new Float32Array(90); let dtsN = 0, dprPaso = 0, dprT = 0;
function vigilarRitmo(ms) {
  if (ms > 250 || document.hidden) return;   // pestaña dormida o pausa larga: no cuenta
  dts[dtsN++ % dts.length] = ms; dprT += ms;
  if (dtsN < dts.length || dprT < 6000 || dprPaso >= DPR_PASOS.length - 1) return;
  const o = Array.from(dts).sort((a, b) => a - b), med = o[o.length >> 1];
  dprT = 0; if (med <= 25) return;
  const antes = dprAct(); while (dprPaso < DPR_PASOS.length - 1 && dprAct() >= antes) dprPaso++;
  if (dprAct() < antes) { ajustar(); dtsN = 0; }
}
const dprAct = () => Math.min(DPR_PASOS[dprPaso], devicePixelRatio || 1);
function cuadro(ahora) {
  requestAnimationFrame(cuadro);   // primero: si un cuadro falla, el juego no se congela
  const ms = ahora - ultimo;
  let dt = Math.min(0.05, ms / 1000); ultimo = ahora;
  if (animExtra) animExtra(ahora);
  if (paro > 0) { paro -= dt; dt = dt * 0.08; }   // pausa de golpe: el mundo casi se congela un instante
  T += dt;
  if (E.elegido && !enPortada && !pausa) logica(dt); else { animarCh(dt); }
  granjaT = enGranja ? granjaT + dt : 0;
  // Con la portada o la granja encima la escena no se ve: no se pinta (la logica sigue). Al salir de la portada
  // se pinta durante su fundido.
  if ((enPortada && !portada.classList.contains('sale')) || granjaT > 0.4) return;
  dibujar();
  if (E.elegido && !enPortada && !pausa && !abierta) vigilarRitmo(ms);
}
let monPrev = E.monedas;
const ritmo = [];   // [seg, ganado] del ultimo minuto → monedas por minuto en el HUD
setInterval(() => {
  if (enPortada || !E.elegido) return;
  const s = Date.now() / 1000; ritmo.push([s, E.ganado]); while (ritmo.length > 1 && s - ritmo[0][0] > 60) ritmo.shift();
  const d = E.ganado - ritmo[0][1], seg = s - ritmo[0][0];
  if (d < 0) { ritmo.length = 0; return; }
  $('h-rate').textContent = seg >= 8 && d > 0 ? '+' + fmt(Math.round(d / seg * 60)) + '/min' : '';
}, 2000);
function logica(dt) {
  const ahoraMs = Date.now();
  if (E.monedas > monPrev) E.ganado += E.monedas - monPrev; monPrev = E.monedas;
  if (E.saz.pend > 0 && !$('modal').classList.contains('on')) { elegirHab(); if (pausa) return; }
  // ollas
  let cocinando = false;
  for (let i = 0; i < nOllas(); i++) {
    const o = E.ollas[i];
    if (o.lista) { if (ayud().recoge && (o.listaT = (o.listaT || 0) + dt) > 1) { o.listaT = 0; recoger(i); } continue; }
    if (!o.fin) {
      const gasto = maizOlla(i);
      if (E.maiz >= gasto) { E.maiz -= gasto; o.fin = ahoraMs + segTanda() * 1000; }
    } else if (ahoraMs >= o.fin) { o.lista = true; o.fin = 0; son('lista'); }
    else cocinando = true;
  }
  if (T > poseHasta) poseAct = cocinando ? 'remueve' : 'quieta';
  // clientes
  proxCliente -= dt;
  const libre = PUESTOS.findIndex(px => !clientes.some(c => c.puesto === px && c.est !== 'va'));
  if (proxCliente <= 0 && libre >= 0) { proxCliente = segCliente() * azar(0.8, 1.2); clientes.push({ i: (() => { const libres = [0, 1, 2, 3].filter(q => !clientes.some(c => c.i === q)); return libres.length ? libres[Math.floor(Math.random() * libres.length)] : Math.floor(Math.random() * 4); })(), x: -40, meta: PUESTOS[libre], puesto: PUESTOS[libre], est: 'llega', t: 0, feliz: false }); }
  // Aviso de hora punta (una vez por ventana)
  if (horaPunta() && !E._punta) { E._punta = true; aviso('🔔 ¡Hora punta! El doble de clientes durante 30 s', 'ok'); } else if (!horaPunta()) E._punta = false;
  for (const c of clientes) {
    c.t += dt;
    if (c.est === 'llega') { c.x += 120 * dt; if (c.x >= c.meta) { c.x = c.meta; c.est = 'espera'; c.t = 0; } }
    else if (c.est === 'espera') {
      if (E.stock > 0 && c.t > 0.5) {
        const n = Math.min(E.stock, 1 + Math.floor(Math.random() * 3) + Math.floor(E.stock / capStock() * 3));
        const esp = extraEspecial(n);
        let pago = Math.max(1, Math.round(n * precio() + esp));
        if (esp > 0) texto(c.x, PISO - 244, '★ Especial', '#ffd54a', 16);
        const vs = HR('vaso');
        if (Math.random() < vs.propina[0]) { const extra = Math.max(1, Math.round(pago * vs.propina[1])); pago += extra; texto(c.x, PISO - 222, '¡Propina +' + fmt(extra) + '!', '#c5e1a5', 18); }
        E.stock -= n; E.monedas += pago; E.stats.vasos += n; sumar('vende', n); xp(D.XP.vaso * n);
        texto(c.x, PISO - 190, '+' + fmt(pago), '#ffd54a', 26); particulas(c.x, PISO - 170, 6, '#ffd54a', { vel: 150, moneda: true }); son('moneda');
        c.est = 'va'; c.feliz = true; c.vy = -300; c.rig && c.rig.sy.golpe(3);
      } else if (c.t > 8) { c.est = 'va'; texto(c.x, PISO - 190, '¡No hay chicha!', '#ffab91', 18); }
    } else c.x += 140 * dt;
  }
  clientes = clientes.filter(c => c.x < W + 60);
  // Jarra legendaria: al llenarse, se vende sola.
  if (HR('jarra').autoventa && E.stock >= capStock()) { const g = Math.round(E.stock * precio()); E.monedas += g; E.stats.vasos += E.stock; sumar('vende', E.stock); E.stock = 0; texto(W / 2 + 20, PISO - 120, 'Autoventa +' + fmt(g), '#ffd54a', 22); son('moneda'); }
  // Duende dorado: cada 1,5-3 min cruza corriendo
  E._dorT = (E._dorT ?? 70) - dt;
  if (E._dorT <= 0) { E._dorT = azar(90, 180); spawnDuende('dorado'); aviso('✨ ¡Un duende dorado! Atrápalo antes de que escape', 'ok'); }
  // oleadas
  proxOleada -= dt;
  if (proxOleada <= 0) {
    colaSpawn.push(...D.oleada(E.oleada)); proxOleada = D.OLEADA_SEG;
    { const ht = habTotal(), tipos = D.oleada(E.oleada).filter(k => k !== 'jefe'); for (let i = 0; i < Math.min(30, Math.round(ht * 1.3)); i++) colaSpawn.splice(Math.floor(Math.random() * colaSpawn.length), 0, tipos[i % tipos.length]); }
    if (E.oleada % 10 === 0) aviso('👑 ¡Llega el Rey de los Ladrones! Tócalo muchas veces.', 'err');
  }
  tSpawn -= dt;
  if (colaSpawn.length && tSpawn <= 0) { spawnDuende(colaSpawn.shift()); tSpawn = Math.max(0.22, 0.9 - colaSpawn.length * 0.03); if (!colaSpawn.length) { E.oleada++; for (const id of ['oro', 'fuego', 'fiesta']) gastar(id); E.stats.oleadas++; E.stats.oleadaMax = Math.max(E.stats.oleadaMax || 0, E.oleada); sumar('oleada'); } }
  // duendes
  const metaX = W / 2 + 10;
  for (const d of duendes) {
    if (d.muerto) continue;
    d.golpe = Math.max(0, d.golpe - dt);
    const def = D.DUENDES[d.k];
    { const mov = d.huye || (d.x > metaX + (def.alcance || 0) && d.golpe <= 0), vel = d.huye ? 1.15 : 1;
      d.rig.legPh += mov ? d.vel * vel * dt * 0.11 : 0; d.rig.legAmp += ((mov ? (d.k === 'rapido' ? 0.13 : 0.09) : 0) - d.rig.legAmp) * Math.min(1, dt * 8);
      d.rig.lean.obj = mov ? -0.07 : 0;   /* se inclina hacia donde corre (al huir la imagen va volteada) */ d.rig.breathe = Math.sin(T * 3 + d.y) * 0.02;
      d.rig.dy = mov ? -Math.abs(Math.sin(d.rig.legPh)) * 7 : 0;
      if (D.DUENDES[d.k].jefe && mov && Math.abs(Math.sin(d.rig.legPh)) < 0.08) { temblar(3); if (Math.random() < 0.5) parts.push({ x: d.x + azar(-20, 20), y: d.y, vx: azar(-60, 60), vy: -60, g: 200, vida: 0.5, t: 0, r: azar(3, 6), color: 'rgba(160,120,80,.7)' }); }
      R.rigPaso(d.rig, dt); }
    if (def.dorado) { d.x -= d.vel * dt; if (d.x < -70) d.muerto = true; if (Math.random() < 0.3) parts.push({ x: d.x + azar(-10, 10), y: d.y - azar(20, 90), vx: 0, vy: -20, g: 0, vida: 0.6, t: 0, r: azar(1.5, 3.5), color: '#ffe082' }); continue; }
    if (d.huye) { d.x += d.vel * 1.15 * dt; continue; }
    const alcance = def.alcance || 0;
    if (d.x > metaX + alcance) { if (d.golpe <= 0) d.x -= d.vel * (activo('trampa') ? 0.5 : 1) * dt; }
    else {
      d.robaT += dt;
      if (d.robaT > (alcance ? 1.5 : 0.4)) {
        let n = Math.min(D.roboDuende(d.k, E.oleada), E.stock);
        if (n > 0) E.stock -= n;
        else { const o = E.ollas.find((oo, i) => i < nOllas() && oo.lista); if (o) { n = def.roba; o.lista = false; o.fin = 0; } }
        d.lleva = n; d.huye = true;
        if (n > 0) { texto(d.x, d.y - 120, '-' + n + ' vasos', '#ff5252', 22); pose('susto', 0.8); son('robo'); vibrar(40); }
        else { const m = D.roboMonedas(E.oleada, E.monedas);   // sin chicha que robar, se lleva monedas
          if (m > 0) { E.monedas -= m; d.llevaMon = m; texto(d.x, d.y - 120, '-' + fmt(m) + ' monedas', '#ff5252', 22); pose('susto', 0.8); son('robo'); vibrar(40); } else texto(d.x, d.y - 120, '¡Nada!', '#bdbdbd', 18); }
      }
    }
  }
  duendes = duendes.filter(d => !d.muerto && d.x < W + 80);
  armas(dt);
  // ayudante con honda
  if (ayud().golpe) { ayudT -= dt; if (ayudT <= 0) { ayudT = 2; const d = duendes.filter(dd => !dd.muerto).sort((a, b) => a.x - b.x)[0]; if (d) { piedras.push({ x0: W - 52, y0: 395, d, t: 0 }); rigAy.bend.golpe(-4); rigAy.sy.golpe(-2); } } }
  for (const pd of piedras) { pd.t += dt * 2.6; if (pd.t >= 1 && !pd.hecho) { pd.hecho = true; if (!pd.d.muerto) { particulas(pd.d.x, pd.d.y - 60, 5, '#9e9e9e', { vel: 110 }); golpear(pd.d, ayud().golpe); } } }
  piedras = piedras.filter(pd => pd.t < 1.05);
  rigAy.breathe = Math.sin(T * 2.6 + 1) * 0.025; rigAy.head.obj = Math.sin(T * 1.7) * 0.04; R.rigPaso(rigAy, dt);
  // duendes vencidos: salen volando girando y caen fuera de la pantalla
  for (const v of voladores) { v.t += dt; v.vy += 1100 * dt; v.x += v.vx * dt; v.y += v.vy * dt; v.rot += v.vr * dt; v.rig.alpha = Math.max(0, 1 - v.t / 1.4); R.rigPaso(v.rig, dt); }
  voladores = voladores.filter(v => v.t < 1.4 && v.y < H + 200);
  // clientes con paso y saltito al comprar
  for (const c of clientes) { c.rig = c.rig || R.rigNuevo(); const mv = c.est !== 'espera'; c.rig.legPh += mv ? dt * 10 : 0; c.rig.legAmp += ((mv ? 0.07 : 0) - c.rig.legAmp) * Math.min(1, dt * 8); c.rig.breathe = Math.sin(T * 2 + c.i) * 0.02;
    if (c.vy) { c.vy += 1200 * dt; c.rig.dy += c.vy * dt; if (c.rig.dy >= 0) { c.rig.dy = 0; c.vy = 0; c.rig.sy.golpe(-2.5); } } else c.rig.dy = mv ? -Math.abs(Math.sin(c.rig.legPh)) * 4 : 0;
    R.rigPaso(c.rig, dt); }
  animarCh(dt);
  if (T - comboT > 0.9 && combo) { if (combo >= 5) { const b = combo * 2; E.monedas += b; texto(W / 2, 150, 'Combo ×' + combo + ': +' + b, '#ffd54a', 22); } combo = 0; }
  comboVer = Math.max(0, comboVer - dt * 1.5);
  // particulas y textos
  for (const p of parts) {
    p.t += dt;
    if (p.moneda && p.t > 0.3) { const k = Math.min(1, (p.t - 0.3) / 0.55), e = k * k; p.x += (hudM[0] - p.x) * e; p.y += (hudM[1] - p.y) * e; if (k >= 1 && !p.llego) { p.llego = true; p.t = p.vida; pulsoT = 0.25; } }
    else { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  parts = parts.filter(p => p.t < p.vida);
  if (pulsoT > 0) { pulsoT -= dt; $('h-monedas').parentNode.classList.toggle('pulso', pulsoT > 0); }
  for (const tx of textos) tx.t += dt;
  textos = textos.filter(tx => tx.t < 1.1);
  pintarHud();
}
function dibujar() {
  x.setTransform(lienzo.width / W, 0, 0, lienzo.height / H, 0, 0);
  if (temblor > 0.05) { x.translate((Math.random() - 0.5) * temblor * 2, (Math.random() - 0.5) * temblor * 2); temblor *= 0.86; } else temblor = 0;
  const noche = new Date().getHours() >= 19 || new Date().getHours() < 6;
  A.fondo(x, W, H, PISO, T, noche, E.nv.toldo);
  for (const c of clientes) { const ks = A.clienteSpr(c.i), im = ks && A.img(ks); if (im && c.rig) { const mv = c.est !== 'espera'; R.dibujarCuadro(x, titere(ks, im, mv ? 'camina' : 'idle'), mv ? c.rig.legPh / (Math.PI * 2) * 12 : T * 5.5 + c.i * 3, c.x, PISO - 20, 150, c.rig, false); if (c.feliz) { x.save(); x.font = '22px "DQ Iconos", system-ui'; x.textAlign = 'center'; x.fillStyle = '#ff5c8a'; x.fillText('♥', c.x + 26, PISO - 182 + Math.sin(T * 6) * 3 + c.rig.dy); x.restore(); } } else A.cliente(x, c.x, PISO - 20, 0.85, c.i, T, c.est !== 'espera', c.feliz); }
  for (const c of clientes) if (c.est === 'espera') { const bx = c.x + 30, by = PISO - 200 + (c.rig ? c.rig.dy : 0); x.save(); x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = '#2a1712'; x.lineWidth = 2.5; x.beginPath(); x.roundRect(bx - 18, by - 22, 36, 30, 10); x.fill(); x.stroke(); x.beginPath(); x.moveTo(bx - 6, by + 8); x.lineTo(bx - 12, by + 16); x.lineTo(bx + 2, by + 8); x.fill(); x.restore(); A.dibujarVaso(x, bx, by + 4, 0.7); if (E.stock <= 0) { x.save(); x.strokeStyle = '#e53935'; x.lineWidth = 3; x.beginPath(); x.moveTo(bx - 12, by - 16); x.lineTo(bx + 12, by + 4); x.stroke(); x.restore(); } }
  A.mostrador(x, W, PISO);
  A.estante(x, W - 82, PISO - 62, E.stock, capStock(), E.eq.jarra);
  A.VASO_SPR.k = 'vaso_' + (E.eq.vaso + 1);
  if (E.esp.n > 0) { const te = '★ ×' + coma(E.esp.mult) + ' · ' + fmt(E.esp.n); x.save(); x.font = '15px "Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#2a1200'; x.fillStyle = '#ffd54a'; x.strokeText(te, W - 82, PISO - 30); x.fillText(te, W - 82, PISO - 30); x.restore(); }
  // cartel de la chicheria
  x.save(); x.font = '22px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.fillStyle = '#fff3c4'; x.strokeStyle = '#3e2716'; x.lineWidth = 5;
  /* el letrero se quito: ahi van la barra de sazon y los utensilios */ x.restore();
  // ollas y fuegos
  for (let i = 0; i < nOllas(); i++) {
    const o = E.ollas[i], cocina = !!o.fin;
    if (!A.tieneSpr('olla_' + (E.nv.ollas[i] + 1))) A.fuego(x, xOlla(i), Y_OLLA + 30, 0.8, E.nv.fuego, T, cocina || o.lista);
    if (cocina || o.lista) R.luzFuego(x, xOlla(i), Y_OLLA + 4, T, i, E.nv.ollas[i] >= 5 ? '120,160,255' : E.nv.ollas[i] >= 4 ? '200,120,255' : '255,150,60');
    A.olla(x, xOlla(i), Y_OLLA + 6, 0.8, E.nv.ollas[i], cocina || o.lista ? 1 : 0, o.lista, T);
    if (cocina) {
      const k = 1 - (o.fin - Date.now()) / (segTanda() * 1000);
      x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.roundRect(xOlla(i) - 36, Y_OLLA - 124, 72, 10, 5); x.fill();
      x.fillStyle = hervor() ? '#7dd3fc' : '#d65caa'; x.beginPath(); x.roundRect(xOlla(i) - 35, Y_OLLA - 123, 70 * Math.max(0, Math.min(1, k)), 8, 4); x.fill(); x.restore();
      if (Math.random() < 0.3) parts.push({ x: xOlla(i) + azar(-18, 18), y: Y_OLLA - 78, vx: azar(-10, 10), vy: -38, g: -8, vida: 1.6, t: 0, r: azar(12, 20), vapor: true });
    } else if (!o.lista && E.maiz < maizOlla(i)) {
      x.save(); x.font = '15px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffab91'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText('Sin maíz', xOlla(i), Y_OLLA - 120); x.fillText('Sin maíz', xOlla(i), Y_OLLA - 120); x.restore();
    }
  }
  // personajes ordenados por profundidad
  const orden = [...duendes.filter(d => !d.muerto).map(d => ({ y: d.y, f: () => {
    const im = A.img('duende_' + d.var);
    if (im) { (d.rig.legAmp > 0.04 ? R.dibujarHoja : R.dibujarRig)(x, im, d.x, d.y, A.altoDuende(d.k, 0.8), d.rig, !!d.huye, D.DUENDES[d.k].dorado ? 'sepia(1) saturate(3.2) hue-rotate(-8deg) brightness(1.15)' : '', d.rig.legPh); if (d.lleva && d.huye) A.dibujarVaso(x, d.x + 18, d.y - A.altoDuende(d.k, 0.8) * 0.6 + d.rig.dy, 0.8); }
    else A.duende(x, d.x, d.y, 0.8, d.k, T, { corre: !d.robaT || d.huye, lleva: d.lleva, golpe: d.golpe, huye: d.huye, var: d.var });
    const hb = A.altoDuende(d.k, 0.8) + 8;
    if (D.DUENDES[d.k].alcance && d.robaT > 0 && !d.huye) {   // la cuerda del gancho hasta las jarras
      const k = Math.min(1, d.robaT / 1.5), hx = d.x - 30, hy = d.y - 70, tx = hx + (W - 82 - hx) * k, ty = hy + (PISO - 80 - hy) * k - Math.sin(k * Math.PI) * 30;
      x.save(); x.strokeStyle = '#e8e0c8'; x.lineWidth = 2; x.beginPath(); x.moveTo(hx, hy); x.quadraticCurveTo((hx + tx) / 2, Math.min(hy, ty) - 40, tx, ty); x.stroke();
      x.lineWidth = 3; x.strokeStyle = '#9e9e9e'; x.beginPath(); x.arc(tx, ty + 6, 6, 0, Math.PI); x.stroke(); x.restore();
    }
    if (D.DUENDES[d.k].jefe) {   // corona y nombre del Rey de los Ladrones
      const cy = d.y - A.altoDuende(d.k, 0.8) * 0.93 + d.rig.dy, cx = d.x + d.rig.bend.v * 40;
      x.save(); x.translate(cx, cy); x.rotate(Math.sin(T * 3) * 0.08); x.beginPath(); x.moveTo(-22, 0); x.lineTo(-24, -24); x.lineTo(-11, -12); x.lineTo(0, -30); x.lineTo(11, -12); x.lineTo(24, -24); x.lineTo(22, 0); x.closePath();
      const gg = x.createLinearGradient(0, -30, 0, 0); gg.addColorStop(0, '#fff1a8'); gg.addColorStop(1, '#d4a017'); x.fillStyle = gg; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#5a3a00'; x.stroke();
      x.fillStyle = '#e53935'; x.beginPath(); x.arc(0, -8, 4, 0, Math.PI * 2); x.fill(); x.restore();
      x.save(); x.font = '14px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#2a1712'; x.fillStyle = '#ffd54a'; x.strokeText('Rey de los Ladrones', d.x, d.y - hb - 6); x.fillText('Rey de los Ladrones', d.x, d.y - hb - 6); x.restore();
    }
    if (d.max > 1) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(d.x - 24, d.y - hb, 48, 6); x.fillStyle = '#ef5350'; x.fillRect(d.x - 24, d.y - hb, 48 * Math.max(0, d.vida / d.max), 6); }
  } })), { y: Y_CH, f: () => { const sk = D.SKINS[E.skin[E.personaje]], im = A.img(SPR_PJ[E.personaje]);
    if (conHoja()) { const M = HOJA_CH, hi = A.img('chichera_hoja'), [cw, ch] = M.celda, s = 205 / M.altoPersona, ci = M.ciclo || [4, 5, 6, 7];
      const f = T < poseHasta && poseAct === 'celebra' ? 11 : poseAct === 'espanta' ? 2 : poseAct === 'susto' ? 0 : poseAct === 'remueve' ? ci[Math.floor(T * 6) % ci.length] : E.esp.n > 0 ? 10 : 3;
      x.save(); x.translate(150 - M.olla[0] * s, Y_CH + rigCh.dy); x.scale(1, 1 + rigCh.breathe * 0.5);
      x.drawImage(R.filtrada(hi, sk.filtro), (f % M.cols) * cw, Math.floor(f / M.cols) * ch, cw, ch, 0, -M.pie[1] * s, cw * s, ch * s); x.restore();
      if (puedeChicha) { const yy = Y_CH - 150 + Math.sin(T * 4) * 3; x.save(); x.font = '14px "Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#2a1200'; x.fillStyle = '#ffd54a'; x.strokeText('★ Preparar chicha', 150, yy); x.fillText('★ Preparar chicha', 150, yy); x.restore(); }
    } else if (im) { const acc = poseAct === 'remueve'; R.dibujarCuadro(x, titere(SPR_PJ[E.personaje], im, acc ? 'accion' : 'idle'), acc ? T * 9 : T * 5.5, 70, Y_CH, 205, rigCh, false, sk.filtro); } else (E.personaje === 'chichero' ? A.chichero : A.chichera)(x, 70, Y_CH, 0.82, poseAct, T, { ...sk.paleta, filtro: sk.filtro }); } }];
  if (E.nv.ayudante > 0 && A.img('ayudante')) orden.push({ y: 455, f: () => R.dibujarCuadro(x, titere('ayudante', A.img('ayudante'), 'idle'), T * 5.5 + 4, W - 46, 455, 112, rigAy, true) });
  for (const v of voladores) orden.push({ y: 999, f: () => { const im = A.img('duende_' + v.var); if (!im) return; x.save(); x.translate(v.x, v.y - 50); x.rotate(v.rot); x.translate(-v.x, -(v.y - 50)); R.dibujarRig(x, im, v.x, v.y, A.altoDuende(v.k, 0.8), v.rig, true); x.restore(); } });
  orden.sort((a, b) => a.y - b.y).forEach(o => o.f());
  // piedras del ayudante en arco
  for (const pd of piedras) { const k = Math.min(1, pd.t), tx = pd.d.x, ty = pd.d.y - 60, px = pd.x0 + (tx - pd.x0) * k, py = pd.y0 + (ty - pd.y0) * k - Math.sin(k * Math.PI) * 70; x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fillStyle = '#8d8d8d'; x.fill(); x.lineWidth = 2; x.strokeStyle = '#2a1712'; x.stroke(); }
  const vap = R.bocanada();
  for (const p of parts) {
    x.globalAlpha = Math.max(0, 1 - p.t / p.vida);
    if (p.anillo) { const k = p.t / p.vida; x.globalAlpha = 1 - k; x.beginPath(); x.arc(p.x, p.y, 10 + k * 46, 0, Math.PI * 2); x.lineWidth = 5 * (1 - k) + 1; x.strokeStyle = '#fff7d1'; x.stroke(); continue; }
    if (p.vapor) { const s = p.r * (1 + p.t * 1.4); x.globalAlpha = 0.85 * (1 - p.t / p.vida); x.drawImage(vap, p.x - s, p.y - s, s * 2, s * 2); continue; }
    if (p.moneda) { x.beginPath(); x.ellipse(p.x, p.y, p.r * 1.2, p.r * 1.2 * Math.abs(Math.cos(p.t * 12)), 0, 0, Math.PI * 2); x.fillStyle = p.color; x.fill(); x.strokeStyle = '#a66d00'; x.lineWidth = 1.5; x.stroke(); }
    else { x.beginPath(); x.arc(p.x, p.y, p.r * (p.vapor ? 1 + p.t : 1), 0, Math.PI * 2); x.fillStyle = p.color; x.fill(); }
  }
  x.globalAlpha = 1;
  for (const tx of textos) {
    const k = tx.t / 1.1;
    x.save(); x.globalAlpha = 1 - k * k; x.font = `${tx.tam * (k < 0.15 ? 0.6 + k * 2.7 : 1)}px "DQ Iconos","Lilita One", system-ui`; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#2a1712'; x.fillStyle = tx.color;
    x.strokeText(tx.txt, tx.x, tx.y - k * 50); x.fillText(tx.txt, tx.x, tx.y - k * 50); x.restore();
  }
  R.motas(x, W, H, T);
  // Guia: E.tuto 0 = aun no removio una olla, 1 = aun no golpeo a un duende, 2 = listo.
  // Primero lo urgente: un duende que viene a robar; luego una olla lista (en las 3 primeras tandas: el nuevo no sabe que se sirve tocando); luego remover.
  if (E.elegido && ((E.tuto || 0) < 2 || E.stats.tandas < 3)) {
    let gx = null, gy = 0, txt = '';
    const dg = (E.tuto || 0) < 2 && duendes.find(dd => !dd.muerto && !D.DUENDES[dd.k].dorado), ol = E.stats.tandas < 3 ? E.ollas.findIndex((o, i) => i < nOllas() && o.lista) : -1;
    if (dg) { gx = dg.x; gy = dg.y - A.altoDuende(dg.k, 0.8) * 0.5; txt = '¡Tócalo!'; }
    else if (ol >= 0) { gx = xOlla(ol); gy = Y_OLLA - 50; txt = '¡Toca para servir!'; }
    else if (!E.tuto && E.ollas[0].fin) { gx = xOlla(0); gy = Y_OLLA - 50; txt = '¡Toca para remover!'; }
    if (gx != null) {
      const k = (T * 1.4) % 1;
      x.save(); x.strokeStyle = '#ffd54a'; x.lineWidth = 4; x.globalAlpha = 1 - k; x.beginPath(); x.arc(gx, gy, 26 + k * 34, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 1; x.font = '24px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#2a1712'; x.fillStyle = '#fff3c4';
      const tx = Math.max(110, Math.min(W - 110, gx)), ty = gy - 58 + Math.sin(T * 5) * 4; x.strokeText(txt, tx, ty); x.fillText(txt, tx, ty); x.restore();
    }
  }
  for (const ry of rayos) { const al = 1 - ry.t / 0.4; x.save(); x.globalAlpha = al; const gr = x.createLinearGradient(0, ry.y - 22, 0, ry.y + 22); gr.addColorStop(0, 'rgba(214,92,170,0)'); gr.addColorStop(0.35, '#d65caa'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(0.65, '#d65caa'); gr.addColorStop(1, 'rgba(214,92,170,0)'); x.fillStyle = gr; x.fillRect(130, ry.y - 22, W, 44); x.restore(); }
  for (const p of proy) {
    const k = Math.min(1, p.t); let px, py, im, s = 40, rot = T * 18;
    if (p.tipo === 'cuch') { px = p.x + (p.d.x - p.x) * k; py = p.y + (p.d.y - 60 - p.y) * k - Math.sin(k * Math.PI) * 40; im = A.img('cucharon_' + (E.eq.cucharon + 1)); s = 46; }
    else if (p.tipo === 'limon') { px = p.d.x; py = p.d.y - 60 - (1 - k) * 280; im = A.img('ing_limon'); s = 28; rot = T * 6; }
    else { px = p.x + (p.tx - p.x) * k; py = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * 110; im = A.img('ing_canela'); s = 32; }
    if (im) { const q = s / Math.max(im.width, im.height); x.save(); x.translate(px, py); x.rotate(rot); x.drawImage(im, -im.width * q / 2, -im.height * q / 2, im.width * q, im.height * q); x.restore(); }
  }
  // COMBO grande al centro
  if (comboVer > 0 && combo >= 3) { const s = 1 + Math.max(0, comboVer - 0.8) * 2.5; x.save(); x.globalAlpha = Math.min(1, comboVer * 2); x.translate(W / 2, 205); x.scale(s, s); x.rotate(-0.06); x.font = '38px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 8; x.strokeStyle = '#3a1d00'; const g = x.createLinearGradient(0, -30, 0, 10); g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#f6a01e'); x.fillStyle = g; x.strokeText('COMBO ×' + combo, 0, 0); x.fillText('COMBO ×' + combo, 0, 0); x.restore(); }
  R.vineta(x, W, H);
  if (!E.elegido) return;
  { // barra de sazon (o la vida del Rey) y utensilios de batalla
    const jefe = duendes.find(d => !d.muerto && D.DUENDES[d.k].jefe), bx = 14, by = 70, bw = W - 28;
    x.save(); x.fillStyle = 'rgba(15,6,20,.78)'; x.beginPath(); x.roundRect(bx, by, bw, 16, 8); x.fill();
    const k = jefe ? Math.max(0, jefe.vida / jefe.max) : E.saz.xp / D.sazReq(E.saz.n), gr = x.createLinearGradient(bx, 0, bx + bw, 0);
    if (jefe) { gr.addColorStop(0, '#ffb300'); gr.addColorStop(1, '#e53935'); } else { gr.addColorStop(0, '#9be36f'); gr.addColorStop(1, '#2e9d57'); }
    if (k > 0.01) { x.fillStyle = gr; x.beginPath(); x.roundRect(bx + 1.5, by + 1.5, (bw - 3) * Math.min(1, k), 13, 6.5); x.fill(); }
    x.strokeStyle = '#ffe9b0'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(bx, by, bw, 16, 8); x.stroke();
    x.font = '14px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = '#1a0a1e'; x.fillStyle = '#fff';
    const tb = jefe ? '👑 Rey de los Ladrones' : 'Sazón ' + E.saz.n; x.strokeText(tb, W / 2, by + 13); x.fillText(tb, W / 2, by + 13);
    let ix = 14; for (const [id, e] of Object.entries(E.saz.hab)) { const im = A.img(D.HABILIDADES[id].img), du = (E.saz.dur[id] || 0) / D.usosMax(id, e);
      x.globalAlpha = du > 0 ? 1 : 0.45;
      x.fillStyle = 'rgba(15,6,20,.72)'; x.beginPath(); x.roundRect(ix, 89, 28, 28, 7); x.fill(); x.strokeStyle = e >= D.MAX_EST ? '#ffd54a' : 'rgba(255,233,176,.5)'; x.lineWidth = 1.5; x.stroke();
      if (im) { const q = 22 / Math.max(im.width, im.height); x.drawImage(im, ix + 14 - im.width * q / 2, 102 - im.height * q / 2, im.width * q, im.height * q); }
      x.font = '11px "Lilita One", system-ui'; x.textAlign = 'right'; x.lineWidth = 3; x.strokeStyle = '#1a0a1e'; x.fillStyle = '#ffd54a'; x.strokeText(e, ix + 27, 117); x.fillText(e, ix + 27, 117);
      x.globalAlpha = 1; x.fillStyle = 'rgba(15,6,20,.8)'; x.fillRect(ix + 2, 119, 24, 4); x.fillStyle = du > 0.3 ? '#7bd88f' : '#ff6b6b'; x.fillRect(ix + 2, 119, 24 * Math.max(0, Math.min(1, du)), 4); ix += 32; }
    x.restore();
    if (alertaJefe > 0) { const pu = 0.5 + 0.5 * Math.sin(T * 14); x.save(); x.fillStyle = `rgba(200,20,20,${0.12 + 0.12 * pu})`; x.fillRect(0, 0, W, H);
      x.translate(W / 2, 230); x.scale(1 + pu * 0.06, 1 + pu * 0.06); x.font = '40px "Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 8; x.strokeStyle = '#3a0000'; x.fillStyle = '#fff';
      x.strokeText('¡ASALTO DEL REY!', 0, 0); x.fillText('¡ASALTO DEL REY!', 0, 0); x.font = '54px "DQ Iconos", system-ui'; x.fillStyle = '#ffd54a'; x.strokeText('⚠', 0, -52); x.fillText('⚠', 0, -52); x.restore(); }
  }
  // proxima oleada
  x.save(); x.font = '19px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'right'; x.lineWidth = 4; x.strokeStyle = '#000'; x.fillStyle = colaSpawn.length ? '#ff8a80' : '#fff';
  if (horaPunta()) { x.save(); x.font = '16px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'left'; x.lineWidth = 4; x.strokeStyle = '#000'; x.fillStyle = '#ffd54a'; x.strokeText('🔔 Hora punta', 12, PISO + 24); x.fillText('🔔 Hora punta', 12, PISO + 24); x.restore(); }
  { let cx = W - 92; for (const [id, po] of Object.entries(D.POCIONES)) { const q = (E.act[id] || 0) - Date.now(); if (q <= 0) continue; const im = A.img(po.img);
      x.save(); x.fillStyle = 'rgba(20,10,8,.72)'; x.strokeStyle = '#ffd54a'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(cx, PISO + 36, 80, 30, 15); x.fill(); x.stroke();
      if (im) { const k = Math.min(26 / im.width, 26 / im.height); x.drawImage(im, cx + 16 - im.width * k / 2, PISO + 51 - im.height * k / 2, im.width * k, im.height * k); }
      const s = Math.ceil(q / 1000); x.font = '15px "Lilita One", system-ui'; x.textAlign = 'left'; x.lineWidth = 3; x.strokeStyle = '#000'; x.fillStyle = q < 10000 ? '#ff8a80' : '#ffe082';
      const tx = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); x.strokeText(tx, cx + 34, PISO + 57); x.fillText(tx, cx + 34, PISO + 57); x.restore(); cx -= 86; } }
  const tOl = colaSpawn.length ? '¡Oleada ' + E.oleada + '!' : 'Oleada ' + E.oleada + ' en ' + Math.ceil(proxOleada) + ' s';
  x.strokeText(tOl, W - 12, PISO + 24); x.fillText(tOl, W - 12, PISO + 24); x.restore();
}

// ── HUD ──
let hudPrev = '';
function pintarHud() {
  const nv = nivelPase(), k = (E.pase.xp % D.PASE.xpNivel) / D.PASE.xpNivel;
  const s = fmt(E.monedas) + '|' + fmt(E.maiz) + '|' + E.stock + '|' + nv + '|' + Math.round(k * 50) + '|' + tab + '|' + Math.floor(Date.now() / 1000) + '|' + E.fama.p;
  if (s === hudPrev) return; hudPrev = s;
  $('h-monedas').textContent = E.monedas >= 1e6 ? coma(E.monedas / 1e6) + ' M' : E.monedas >= 1e5 ? Math.floor(E.monedas / 1000) + 'k' : E.monedas >= 1e4 ? coma(Math.floor(E.monedas / 100) / 10) + 'k' : fmt(E.monedas); $('h-maiz').textContent = E.maiz >= 10000 ? Math.floor(E.maiz / 1000) + 'k' : fmt(E.maiz); $('h-vasos').textContent = E.stock;
  const mj = mejorAsequible(); document.querySelector('.tab[data-t="mejoras"]').classList.toggle('punto', !!mj && !(abierta && tab === 'mejoras'));
  $('h-pase').textContent = nv >= D.PASE.niveles ? 'MAX' : nv; $('h-pase-b').style.width = (nv >= D.PASE.niveles ? 100 : k * 100) + '%';
  if (abierta && (tab === 'mejoras' || tab === 'cocina' || tab === 'mercado' || tab === 'misiones' || tab === 'pase')) pintarPanelSuave();
}
let avisoT = 0;
function aviso(t, tipo) {
  const el = document.createElement('div'); el.className = 'aviso ' + (tipo || ''); el.textContent = t;
  const caja = $('avisos'); caja.appendChild(el); while (caja.children.length > 2) caja.firstChild.remove();
  const ms = Math.max(2600, Math.min(5000, 1600 + t.length * 38));   // los avisos largos duran lo que tardas en leerlos
  setTimeout(() => el.classList.add('fuera'), ms); setTimeout(() => el.remove(), ms + 400);
}

// ── PANELES ──
// Los paneles son ventanas emergentes: se abren desde la barra de abajo y se cierran con la X, tocando fuera o tocando otra vez su boton.
let tab = 'cocina', abierta = false;
const TIT_HOJA = { cocina: 'Cocina', taller: 'Taller', mejoras: 'Mejoras', mercado: 'Tienda', misiones: 'Misiones', pase: 'Pase de batalla', skins: 'Skins', semillas: 'Semillas' };
function marcarTab(id) { const b = document.querySelector(`.tab[data-t="${id === 'pase' ? 'misiones' : id === 'skins' ? 'mejoras' : id}"]`); if (b && !(abierta && tab === id)) b.classList.add('punto'); }
let enGranja = false;
function navOn() { document.querySelectorAll('.tab').forEach(o => o.classList.toggle('on', o.dataset.t === 'granja' ? enGranja && !abierta : abierta && o.dataset.t === tab)); }
function verGranja(si) { enGranja = si; $('granja').classList.toggle('on', si); navOn(); if (si) pintarChacra(true); }
function abrirHoja(t) {
  tab = t; abierta = true; $('hoja-t').textContent = TIT_HOJA[t] || '';
  document.querySelectorAll('.tab').forEach(o => { if (o.dataset.t === t) o.classList.remove('punto'); }); navOn();
  const h = $('hoja'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
  pintarPanel(); if (tab === 'mercado' && NUBE.cuenta) cargarMercado(); if (tab === 'misiones') cargarRanking();
}
function cerrarHoja() { abierta = false; $('hoja').classList.remove('on'); navOn(); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { son('tap');
  if (b.dataset.t === 'granja') { const ir = abierta ? true : !enGranja; cerrarHoja(); verGranja(ir); return; }
  if (abierta && tab === b.dataset.t) cerrarHoja(); else abrirHoja(b.dataset.t); });
$('h-pase-c').onclick = () => { son('tap'); abrirHoja('pase'); };
$('hoja-x').onclick = () => { son('tap'); cerrarHoja(); };
$('hoja').addEventListener('pointerdown', ev => { if (ev.target === $('hoja')) cerrarHoja(); });
let panelPrev = '';
function pintarPanelSuave() { const h = htmlPanel(); if (h !== panelPrev) { panelPrev = h; $('panel').innerHTML = h; } }
function pintarPanel() { panelPrev = htmlPanel(); const pn = $('panel'); pn.innerHTML = panelPrev; pn.scrollTop = 0; pn.classList.remove('entra'); void pn.offsetWidth; pn.classList.add('entra'); clearTimeout(pintarPanel.t); pintarPanel.t = setTimeout(() => pn.classList.remove('entra'), 450); }
const btn = (txt, act, datos, off, cls = '') => `<button class="b ${cls}" data-act="${act}"${Object.entries(datos || {}).map(([k, v]) => ` data-${k}="${v}"`).join('')}${off ? ' disabled' : ''}>${txt}</button>`;
const costoBtn = (c, act, datos) => btn(`<span class="mon"></span>${fmt(c)}`, act, datos, E.monedas < c, 'oro');

const IMG = '/assets/chicha-wars/';
const imgCard = (src, color) => `<div class="ico art"${color ? ` style="box-shadow:0 0 0 2px ${color} inset,0 0 14px ${color}55"` : ''}><img src="${IMG}${src}.webp" alt="" loading="lazy" onerror="this.remove()"></div>`;
const ING_REC = ['ing_maiz', 'ing_canela', 'ing_pina', 'ing_manzana', 'ing_limon', 'ing_azucar'];
// Todas las mejoras posibles ahora: [costo, titulo, act, datos]. La mas barata que alcanza se ofrece en Cocina.
function mejorasPosibles() {
  const l = [];
  for (let i = 0; i < nOllas(); i++) { const s = D.OLLAS[E.nv.ollas[i] + 1]; if (s) l.push([s.costo, `Olla ${i + 1}: ${s.nombre}`, 'mejora', { k: 'olla', i }, 'olla_' + (E.nv.ollas[i] + 2)]); }
  for (const [k, lista, nom, img] of [['hornillas', D.HORNILLAS, 'Una hornilla más', 'ico_reloj'], ['fuego', D.FUEGOS, null, 'ico_fogata'], ['receta', D.RECETAS, null, null], ['toldo', D.TOLDOS, null, 'ico_monedas'], ['ayudante', D.AYUDANTES, null, 'ayudante']]) {
    const s = lista[E.nv[k] + 1]; if (s) l.push([s.costo, nom || s.nombre, 'mejora', { k }, img || ING_REC[Math.min(5, E.nv.receta + 1)]]);
  }
  for (const id in D.HERRAMIENTAS) { const r = E.eq[id]; if (r < 4) l.push([D.costoHerr(id, r + 1), `${D.HERRAMIENTAS[id].nombre} ${D.RAREZAS[r + 1].nombre.toLowerCase()}`, 'herr', { id }, id + '_' + (r + 2)]); }
  return l.sort((a, b) => a[0] - b[0]);
}
function mejorAsequible() { return mejorasPosibles().find(m => m[0] <= E.monedas) || null; }
let subMej = 'herr', confirmaH = false;
const mmss = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const chipIng = (k, n, falta) => `<span class="ing${falta ? ' falta' : ''}"><img src="${IMG}${D.INGREDIENTES[k].img}.webp" alt="">${n}</span>`;
function htmlFama() {
  const req = D.famaReq(E.fama.n), pr = D.premioFama(E.fama.n + 1);
  const des = Object.values(D.POCIONES).filter(po => po.fama > E.fama.n).sort((a, b) => a.fama - b.fama)[0];
  return `<div class="card fama"><div class="ico grande">🏅</div><div class="tx"><b>Fama del puesto · nivel ${E.fama.n}</b><div class="barra"><i style="width:${E.fama.p / req * 100}%"></i></div><small>${fmt(E.fama.p)} / ${fmt(req)} · al subir: +${fmt(pr.monedas)} monedas y ${pr.ing} ingredientes${des ? ` · en Fama ${des.fama}: ${des.nombre}` : ''}</small></div></div>`;
}
function htmlHerencia() {
  const g = D.recetasPorGanar(E.ganado), min = D.HERENCIA.min, meta = D.ganadoPara(Math.max(min, g + 1)), ok = g >= min;
  return `<div class="card herencia${ok ? ' mejora-ya' : ''}">${imgCard('chichera_maestra')}<div class="tx"><b>Herencia de la Abuela</b>
    <small>Tienes <span class="dor">${E.rs}</span> Recetas Secretas: +${Math.round(E.rs * D.HERENCIA.precio * 100)} % de precio y +${Math.round(E.rs * D.HERENCIA.coccion * 100)} % de cocción para siempre.</small>
    <div class="barra"><i style="width:${Math.min(100, E.ganado / meta * 100)}%"></i></div>
    <small>${ok ? `Si heredas ahora recibes <span class="dor">${g}</span> Recetas Secretas. La siguiente, al ganar ${fmt(meta)} monedas.` : `Gana ${fmt(meta)} monedas en esta partida para heredar (llevas ${fmt(E.ganado)}).`}</small>
    <small class="sig">Reinicia el puesto y la oleada. Conservas herramientas, fama, pase, skins, ingredientes y chacra.</small></div>
    ${btn(confirmaH ? '¿Seguro? Toca otra vez' : 'Heredar +' + g, 'herencia', {}, !ok, ok ? 'oro' : '')}</div>`;
}
function htmlTaller() {
  let h = `<div class="sub">Tus ingredientes</div><div class="ings">${Object.keys(D.INGREDIENTES).map(k => chipIng(k, E.ing[k])).join('')}</div>`;
  if (E.fama.n < 2) return h + `<div class="card proximo">${imgCard('ico_ingredientes')}<div class="tx"><b>El Taller se abre en Fama 2</b><small>Vende chicha y espanta duendes para ganar fama. Los duendes sueltan ingredientes: guárdalos para tus pociones.</small></div></div>`;
  h += `<div class="consejo">Prepara pociones con ingredientes y úsalas cuando más convenga (por ejemplo, Reloj de Celeridad en la hora punta). Los duendes sueltan ingredientes (el Rey, 5) y el Agricultor los vende en la Tienda. También puedes sembrarlos en tu chacra.</div>`;
  for (const [id, po] of Object.entries(D.POCIONES)) {
    const bloq = E.fama.n < po.fama, puede = !bloq && Object.entries(po.receta).every(([k, n]) => E.ing[k] >= n), q = (E.act[id] || 0) - Date.now(), tiene = E.poc[id] || 0;
    h += `<div class="card pocion${bloq ? ' bloq' : ''}">${imgCard(po.img, q > 0 ? '#ffd54a' : '')}<div class="tx"><b>${po.nombre}${tiene ? ` <span class="cant">×${tiene}</span>` : ''}</b><small>${po.d} · ${po.seg} s${q > 0 ? ` · <span class="activa">activa ${mmss(q)}</span>` : ''}</small>
      ${bloq ? `<small class="max">Se desbloquea en Fama ${po.fama}</small>` : `<div class="rec">${Object.entries(po.receta).map(([k, n]) => chipIng(k, E.ing[k] + '/' + n, E.ing[k] < n)).join('')}</div>`}</div>
      ${bloq ? '' : `<div class="bts">${btn('Preparar', 'craft', { id }, !puede, puede ? 'oro' : '')}${btn('Usar', 'usar', { id }, !tiene)}</div>`}</div>`;
  }
  return h;
}
const chipMaiz = (kg) => `<span class="ing${E.maiz < kg ? ' falta' : ''}"><img src="${IMG}ing_maiz.webp" alt="">${kg} kg</span>`;
function htmlChichas() {
  const s = E.esp; let h = `<div class="sub">Prepara chicha especial con tu cosecha</div>`;
  if (s.n > 0) h += `<div class="card mejora-ya">${imgCard('jarra_' + (E.eq.jarra + 1), '#ffd54a')}<div class="tx"><b>${esc(s.nom || 'Chicha especial')} en tus jarras</b><small>Tus próximos <span class="dor">${fmt(s.n)}</span> vasos se venden a <span class="dor">×${coma(s.mult)}</span> del precio.</small></div></div>`;
  for (const [id, c] of Object.entries(D.CHICHAS)) {
    const bloq = E.fama.n < c.fama, puede = !bloq && E.maiz >= c.maiz && Object.entries(c.receta).every(([k, n]) => E.ing[k] >= n);
    h += `<div class="card pocion${bloq ? ' bloq' : ''}">${imgCard(c.img)}<div class="tx"><b>${c.nombre}</b><small>${c.vasos} vasos a ×${coma(c.mult)} del precio · hasta +50 % si te sale perfecta</small>
      ${bloq ? `<small class="max">Se desbloquea en Fama ${c.fama}</small>` : `<div class="rec">${chipMaiz(c.maiz)}${Object.entries(c.receta).map(([k, n]) => chipIng(k, E.ing[k] + '/' + n, E.ing[k] < n)).join('')}</div>`}</div>
      ${bloq ? '' : btn('Preparar', 'prep', { id }, !puede, puede ? 'oro' : '')}</div>`;
  }
  return h + `<div class="card">${imgCard('cul_pina_2')}<div class="tx"><b>¿Te faltan ingredientes?</b><small>Siémbralos en tu granja: maíz, canela, caña, limón, clavo, piña y manzana. También los sueltan los duendes y los vende el Agricultor.</small></div>${btn('Ir a la granja', 'granja', {}, false, 'oro')}</div>`;
}
function htmlSemillas() {
  let h = `<div class="consejo" style="margin-bottom:8px">Elige qué sembrar y toca una parcela vacía. Los cultivos crecen solos, también con el juego cerrado. Riégalos una vez (la gota azul) para que estén antes.</div>`;
  for (const [k, c] of Object.entries(D.CULTIVOS)) {
    const bloq = E.fama.n < c.fama, on = E.semilla === k, da = c.kg ? D.maizCosecha(E.fama.n) + ' kg de maíz' : c.da + ' de ' + D.INGREDIENTES[k].nombre.toLowerCase();
    h += `<div class="card semilla${on ? ' on' : ''}${bloq ? ' proximo' : ''}">${imgCard('cul_' + k + '_2')}<div class="tx"><b>${c.nombre}</b><small>Lista en ${mmss(c.seg * 1000)} · da ${da}</small><small class="${bloq ? 'max' : 'sig'}">${bloq ? 'Se desbloquea en Fama ' + c.fama : 'Semilla: ' + c.semilla + ' monedas'}</small></div>${bloq ? btn('🔒', 'nada', {}, true) : btn(on ? '✓ Elegida' : 'Elegir', 'semilla', { k }, false, on ? 'on' : 'oro')}</div>`;
  }
  return h;
}
function filaMejora(titulo, actual, sig, costo, act, datos, ico) {
  return `<div class="card">${ico.startsWith('<') ? ico : `<div class="ico">${ico}</div>`}<div class="tx"><b>${titulo}</b><small>${actual}</small>${sig ? `<small class="sig">→ ${sig}</small>` : '<small class="max">Nivel máximo</small>'}</div>${sig ? costoBtn(costo, act, datos) : ''}</div>`;
}
let subTal = 'ut';
function htmlUtensilios() {
  let h = `<div class="ings">${Object.keys(D.INGREDIENTES).map(k => chipIng(k, E.ing[k])).join('')}</div><div class="consejo" style="margin-bottom:8px">Fabrica utensilios de batalla con tu cosecha. Pelean solos, pero <b>se gastan con el uso</b>: cuando la barra llega a cero pelean a medias hasta que los repares. Puedes tener ${D.MAX_HAB} a la vez.</div>`;
  const tengo = Object.keys(E.saz.hab).length;
  for (const [id, u] of Object.entries(D.UTENSILIOS)) {
    const hb = D.HABILIDADES[id], e = estr(id), max = D.usosMax(id, e || 1), dur = E.saz.dur[id] || 0, c = D.costoUt(id, E.oleada, e > 0), lleno = e > 0 && dur >= max, uni = hb.pasiva ? 'oleadas' : 'usos';
    const ok = Object.entries(u.receta).every(([k, n]) => E.ing[k] >= n), puede = ok && E.monedas >= c && !lleno && (e > 0 || tengo < D.MAX_HAB);
    h += `<div class="card herr${e && !dur ? ' gastado' : ''}">${imgCard(hb.img, e ? (dur ? '#7bd88f' : '#ff6b6b') : '')}<div class="tx"><b>${hb.nombre}${e ? ` <span class="cant">${'★'.repeat(e)}</span>` : ''}</b><small>${hb.d(e || 1)}</small>
      ${e ? `<div class="ut-dur"><div class="barra${dur / max < 0.3 ? ' baja' : ''}"><i style="width:${dur / max * 100}%"></i></div><span>${dur ? dur + '/' + max + ' ' + uni : 'Gastado: pelea a medias'}</span></div>` : `<small class="sig">Dura ${max} ${uni}</small>`}
      <div class="rec">${Object.entries(u.receta).map(([k, n]) => chipIng(k, E.ing[k] + '/' + n, E.ing[k] < n)).join('')}</div></div>
      ${lleno ? btn('✓ Como nuevo', 'nada', {}, true) : btn(`${e ? 'Reparar' : 'Fabricar'}<br><span class="mon"></span>${fmt(c)}`, 'fabricar', { id }, !puede, puede ? 'oro' : '')}</div>`;
  }
  return h;
}
const htmlPanel = () => htmlPanelT(tab);
function htmlPanelT(tab) {
  if (tab === 'taller') return `<div class="elige">${btn('Utensilios', 'subTal', { k: 'ut' }, false, subTal === 'ut' ? 'on' : '')}${btn('Pociones', 'subTal', { k: 'poc' }, false, subTal === 'poc' ? 'on' : '')}</div>` + (subTal === 'ut' ? htmlUtensilios() : htmlTaller());
  if (tab === 'cocina') {
    let h = `<div class="resumen"><div><b>${E.stock}/${capStock()}</b><small>vasos en jarras</small></div><div><b>${fmt(E.maiz)} kg</b><small>maíz morado</small></div><div><b>${fmtP(precio())}</b><small>monedas por vaso</small></div></div>`;
    h += htmlChichas();
    h += htmlFama();
    if (D.recetasPorGanar(E.ganado) >= D.HERENCIA.min && E.stats.herencias < 1) h += htmlHerencia();
    { const id = Object.keys(D.POCIONES).find(k => (E.poc[k] || 0) > 0 && !activo(k)); if (id && !Object.keys(D.POCIONES).some(activo)) h += `<div class="card">${imgCard(D.POCIONES[id].img)}<div class="tx"><b>Tienes ${D.POCIONES[id].nombre} sin usar</b><small>${D.POCIONES[id].d} durante ${D.POCIONES[id].seg} s.</small></div>${btn('Usar', 'usar', { id }, false, 'oro')}</div>`; }
    if (E.stock >= capStock() * 0.6) h += `<div class="card">${imgCard('jarra_' + (E.eq.jarra + 1))}<div class="tx"><b>Vender al por mayor</b><small>${E.stock} vasos al ${Math.round(D.MAYORISTA * 100)} % del precio, ya mismo. Libera tus jarras.</small></div>${btn(`<span class="mon"></span>${fmt(Math.round(E.stock * precio() * D.MAYORISTA))}`, 'mayor', {}, false, 'oro')}</div>`;
    const mj = mejorAsequible(), sig = mejorasPosibles()[0];
    if (mj) h += `<div class="card mejora-ya">${imgCard(mj[4])}<div class="tx"><b>⬆ ¡Ya puedes mejorar!</b><small>${mj[1]}</small></div>${btn(`<span class="mon"></span>${fmt(mj[0])}`, mj[2], mj[3], false, 'oro')}</div>`;
    else if (sig) h += `<div class="card">${imgCard(sig[4])}<div class="tx"><b>Próxima mejora: ${sig[1]}</b><div class="barra"><i style="width:${Math.min(100, E.monedas / sig[0] * 100)}%"></i></div><small>${fmt(E.monedas)} / ${fmt(sig[0])} monedas</small></div>${btn('Ver todo', 'ir', { t: 'mejoras' })}</div>`;
    if (E.maiz < maizOlla(0) * 2) h += `<div class="card alerta"><div class="tx"><b>Te queda poco maíz morado</b><small>Sin maíz las ollas no cocinan. Siémbralo en tu chacra o cómpralo en la Tienda.</small></div>${btn('Comprar', 'ir', { t: 'mercado' })}</div>`;
    const rh = E.racha, cobr = rh.cobrado === rh.dia, dia = ((rh.n - 1) % 7);
    h += `<div class="card"><div class="ico">📅</div><div class="tx"><b>Racha: día ${rh.n}</b><small>${D.RACHA_MAIZ.includes(dia) ? (D.RACHA[dia]) + ' kg de maíz' : D.RACHA[dia] + ' monedas'} · vuelve mañana para el día ${rh.n + 1}</small></div>${btn(cobr ? '✓ Cobrado' : 'Cobrar', 'racha', {}, cobr, cobr ? '' : 'oro')}</div>`;
    h += `<div class="card">${imgCard('ico_fogata')}<div class="tx"><b>${D.FUEGOS[E.nv.fuego].nombre} · ${fmtP(segTanda())} s por tanda${hervor() ? ' · ¡Hervor Cósmico!' : ''}</b><small>${nOllas()} ${nOllas() > 1 ? 'ollas' : 'olla'} cocinando · ${D.RECETAS[E.nv.receta].nombre}</small></div></div>`;
    h += `<div class="consejo">Toca una olla que hierve para removerla y que esté antes. Toca a los duendes para espantarlos; si te roban, tócalos mientras huyen y recuperas los vasos.</div>`;
    return h;
  }
  if (tab === 'semillas') return htmlSemillas();
  if (tab === 'mejoras') {
    let h = `<div class="elige">${btn('Herramientas', 'subMej', { k: 'herr' }, false, subMej === 'herr' ? 'on' : '')}${btn('Puesto y ollas', 'subMej', { k: 'puesto' }, false, subMej === 'puesto' ? 'on' : '')}${btn('Skins', 'subMej', { k: 'skins' }, false, subMej === 'skins' ? 'on' : '')}</div>`;
    if (subMej === 'skins') return h + htmlPanelT('skins');
    if (subMej === 'herr') {
      const EF = {
        cucharon: n => `+${Math.round(n.coccion * 100)} % de velocidad de cocción · ${n.dano} de daño a los duendes`,
        tabla: n => `+${Math.round(n.corte * 100)} % de velocidad de corte`,
        exprimidor: n => `${Math.round(n.crit * 100)} % de tanda crítica`,
        colador: n => `+${Math.round(n.calidad * 100)} % de calidad (precio)`,
        vaso: n => `+${Math.round(n.venta * 100)} % de monedas por venta`,
        jarra: n => `+${Math.round(n.cap * 100)} % de reserva (${Math.round(D.STOCK_BASE * (1 + n.cap))} vasos)`,
      };
      for (const [id, hh] of Object.entries(D.HERRAMIENTAS)) {
        const r = E.eq[id], n = hh.niv[r], rz = D.RAREZAS[r], s = hh.niv[r + 1];
        h += `<div class="card herr">${imgCard(id + '_' + (r + 1), rz.color)}<div class="tx"><b>${hh.nombre} <span style="color:${rz.color}">${rz.nombre}</span></b><small>${n.d}</small><small class="sig">${EF[id](n)}${n.txt ? ' · ' + n.txt : ''}</small>${s ? `<small>→ <span style="color:${D.RAREZAS[r + 1].color}">${D.RAREZAS[r + 1].nombre}</span>: ${EF[id](s)}</small>` : '<small class="max">Rareza máxima</small>'}</div>${s ? costoBtn(D.costoHerr(id, r + 1), 'herr', { id }) : ''}</div>`;
      }
      return h;
    }
    for (let i = 0; i < nOllas(); i++) { const n = E.nv.ollas[i], s = D.OLLAS[n + 1]; h += filaMejora(`Olla ${i + 1}: ${D.OLLAS[n].nombre}`, `${D.OLLAS[n].vasos} vasos por tanda`, s && `${s.nombre}: ${s.vasos} vasos`, s && s.costo, 'mejora', { k: 'olla', i }, imgCard('olla_' + (n + 1))); }
    const m = (k, lista, ico, act, sig) => { const n = E.nv[k], s = lista[n + 1]; return filaMejora(lista[n].nombre || '', act(lista[n], n), s && sig(s, n + 1), s && s.costo, 'mejora', { k }, ico); };
    h += m('hornillas', D.HORNILLAS, imgCard('ico_reloj'), (c) => `${c.n} ${c.n > 1 ? 'hornillas' : 'hornilla'} (ollas a la vez)`, s => `${s.n} hornillas (una olla más)`).replace('<b></b>', '<b>Hornillas</b>');
    h += m('fuego', D.FUEGOS, imgCard('ico_fogata'), c => `${c.seg} s por tanda (sin herramientas)`, s => `${s.nombre}: ${s.seg} s`);
    h += m('receta', D.RECETAS, imgCard(ING_REC[E.nv.receta]), c => `${c.precio} monedas por vaso (base) · ${c.ing}`, s => `${s.nombre}: ${s.precio} de base`);
    h += m('toldo', D.TOLDOS, imgCard('ico_monedas'), c => `un cliente cada ${c.seg} s`, s => `${s.nombre}: cada ${s.seg} s`);
    h += htmlHerencia();
    h += m('ayudante', D.AYUDANTES, imgCard('ayudante'), c => c.golpe ? `recoge ollas y espanta (${c.golpe} de daño)` : c.recoge ? 'recoge las ollas listas' : 'nadie te ayuda', s => s.nombre);
    return h;
  }
  if (tab === 'misiones') {
    const npl = paseListos() + desafiosListos().length;
    let h = `<div class="card${npl ? ' mejora-ya' : ''}">${imgCard('ico_magia')}<div class="tx"><b>Pase de batalla · nivel ${nivelPase()}</b><small>${npl ? 'Tienes ' + npl + ' por reclamar.' : D.PASE.temporada}</small></div>${btn('Abrir', 'ir', { t: 'pase' }, false, npl ? 'oro' : '')}</div><div class="sub">Se renuevan a medianoche (hora de Perú)</div>`;
    h += htmlRanking();
    const lg = logrosVisibles();
    if (lg.length) {
      h += `<div class="sub">Logros (para siempre)</div>`;
      for (const l of lg) { const v = Math.min(l.n, stat(l.stat)), ok = v >= l.n;
        h += `<div class="card${ok ? ' mejora-ya' : ''}"><div class="ico">🏆</div><div class="tx"><b>${l.txt}</b><div class="barra"><i style="width:${v / l.n * 100}%"></i></div><small>${fmt(v)} / ${fmt(l.n)} · ${l.mon ? '+' + fmt(l.mon) + ' monedas y ' : ''}${l.ing} ingredientes</small></div>${btn('Cobrar', 'logro', { id: l.id }, !ok, ok ? 'oro' : '')}</div>`; }
    }
    h += '<div class="sub">Misiones de hoy</div>';
    for (const [i, m] of E.mis.l.entries()) {
      const def = D.MISIONES.find(x => x.id === m.id);
      h += `<div class="card"><div class="ico">${m.hecho ? '✓' : '🎯'}</div><div class="tx"><b>${def.txt(m.n)}</b><div class="barra"><i style="width:${m.prog / m.n * 100}%"></i></div><small>${fmt(m.prog)} / ${fmt(m.n)} · +${def.premio} monedas y ${D.XP.mision} XP de pase</small></div>${btn(m.cobrado ? '✓' : 'Cobrar', 'mision', { i }, !m.hecho || m.cobrado, m.hecho && !m.cobrado ? 'oro' : '')}</div>`;
    }
    return h;
  }
  if (tab === 'pase') {
    const nv = nivelPase();
    let h = `<div class="pase-cab"><b>${D.PASE.temporada}</b><small>Nivel ${nv} de ${D.PASE.niveles} · termina el 31 de diciembre</small><div class="barra"><i style="width:${(E.pase.xp % D.PASE.xpNivel) / D.PASE.xpNivel * 100}%"></i></div>
      ${E.pase.premium ? '<small class="premium-on">★ Pase premium activo</small>' : btn('★ Pase premium · S/ 10', 'premium', {}, false, 'premium')}</div>`;
    const txtP = p => p.tipo === 'skin' ? '👑 ' + D.SKINS[p.id].nombre : p.tipo === 'maiz' ? p.n + ' kg maíz' : fmt(p.n) + ' monedas';
    const nl = paseListos(); if (nl) h += `<div class="card mejora-ya"><div class="ico">🎁</div><div class="tx"><b>Tienes ${nl} ${nl > 1 ? 'premios' : 'premio'} por reclamar</b><small>Todos de un toque.</small></div>${btn('Reclamar todo', 'paseTodo', {}, false, 'oro')}</div>`;
    if (nv < D.PASE.niveles) { const rr = D.PREMIOS_PASE[nv], falta = (nv + 1) * D.PASE.xpNivel - E.pase.xp;
      h += `<div class="card proximo"><div class="ico">⭐</div><div class="tx"><b>Próximo: nivel ${nv + 1}</b><small>Gratis: ${txtP(rr.gratis)} · Premium: ${txtP(rr.premium)}</small><small>Te faltan ${fmt(falta)} XP: vende, cocina, espanta duendes y cumple desafíos.</small></div></div>`; }
    const dl = D.DESAFIOS.filter(dd => !E.pase.d.includes(dd.id));
    if (dl.length) { h += `<div class="sub">Desafíos de temporada · ${D.DESAFIOS.length - dl.length} de ${D.DESAFIOS.length}</div>`;
      for (const dd of dl.sort((a, b) => (stat(b.stat) >= b.n) - (stat(a.stat) >= a.n)).slice(0, 5)) { const v = Math.min(dd.n, stat(dd.stat)), ok = v >= dd.n;
        h += `<div class="card${ok ? ' mejora-ya' : ''}"><div class="ico">🎯</div><div class="tx"><b>${dd.txt}</b><div class="barra"><i style="width:${v / dd.n * 100}%"></i></div><small>${fmt(v)} / ${fmt(dd.n)} · +${dd.xp} XP de pase</small></div>${btn('Cobrar', 'desafio', { id: dd.id }, !ok, ok ? 'oro' : '')}</div>`; } }
    h += '<div class="sub">Premios por nivel</div>';
    for (const r of D.PREMIOS_PASE) {
      const alc = nv >= r.n, g = E.pase.g.includes(r.n), p = E.pase.p.includes(r.n);
      h += `<div class="pase-fila${alc ? ' alc' : ''}"><div class="pn">${r.n}</div>
        <div class="pp">${txtP(r.gratis)}${btn(g ? '✓' : alc ? 'Reclamar' : '🔒', 'pase', { n: r.n, c: 'g' }, !alc || g, alc && !g ? 'oro' : '')}</div>
        <div class="pp prem">${txtP(r.premium)}${btn(p ? '✓' : E.pase.premium && alc ? 'Reclamar' : '🔒', 'pase', { n: r.n, c: 'p' }, !E.pase.premium || !alc || p, E.pase.premium && alc && !p ? 'oro' : '')}</div></div>`;
    }
    return h;
  }
  if (tab === 'skins') {
    let h = `<div class="sub">Elige quién prepara la chicha</div><div class="elige">${Object.entries(D.PERSONAJES).map(([k, n]) => btn(n, 'personaje', { k }, false, E.personaje === k ? 'on' : '')).join('')}</div>`;
    for (const [id, s] of Object.entries(D.SKINS)) {
      if (s.para !== E.personaje) continue;
      const tiene = E.skins.includes(id), puesta = E.skin[E.personaje] === id;
      h += `<div class="card"><canvas class="mini" data-skin="${id}" width="90" height="110"></canvas><div class="tx"><b>${s.nombre}</b><small>${tiene ? (puesta ? 'La llevas puesta' : 'Ya es tuya') : 'Se gana en: ' + s.de}</small></div>${tiene ? btn(puesta ? '✓ Puesta' : 'Ponerme', 'skin', { id }, puesta) : btn('🔒', 'nada', {}, true)}</div>`;
    }
    return h;
  }
  if (tab === 'mercado') {
    let h = `<div class="card agricultor">${imgCard('agricultor')}<div class="tx"><b>El Agricultor</b><small>«Maíz morado fresquito para tu chicha, casera.»</small></div></div><div class="sub">Maíz morado para tus ollas</div>`;
    for (const [kg, c] of D.MAIZ.paquetes) h += `<div class="card">${imgCard('ing_maiz')}<div class="tx"><b>${kg} kg de maíz morado</b><small>Alcanza para ${Math.floor(kg / D.MAIZ.porVaso)} vasos</small></div>${costoBtn(c, 'maiz', { kg, c })}</div>`;
    if (E.fama.n >= 2) {
      h += `<div class="sub">Ingredientes para tus chichas y pociones</div>`;
      for (const [k, ig] of Object.entries(D.INGREDIENTES)) h += `<div class="card">${imgCard(ig.img)}<div class="tx"><b>${ig.nombre}</b><small>Tienes ${E.ing[k]}</small></div><div class="bts fila">${D.PAQ_ING.map(n => btn(`${n} · <span class="mon"></span>${fmt(D.precioIng(precio() / (activo('receta') ? 1.5 : 1), n))}`, 'ing', { k, n }, E.monedas < D.precioIng(precio() / (activo('receta') ? 1.5 : 1), n), 'oro')).join('')}</div></div>`;
    }
    h += htmlCuenta();
    h += `<a class="card enlace" href="${D.WHATSAPP_CHICHA}" target="_blank" rel="noopener"><div class="ico">🥤</div><div class="tx"><b>¿Quieres chicha morada de verdad?</b><small>Pídela por WhatsApp al +51 916 778 731 (número oficial)</small></div></a>`;
    return h;
  }
  return '';
}
// Cobra un premio del pase (c = 'g' gratis, 'p' premium). Devuelve true si se cobro.
function cobrarPase(n, c) {
  const r = D.PREMIOS_PASE[n - 1], lista = c === 'g' ? E.pase.g : E.pase.p, p = c === 'g' ? r.gratis : r.premium;
  if (!r || nivelPase() < n || lista.includes(n) || (c === 'p' && !E.pase.premium)) return false;
  lista.push(n);
  if (p.tipo === 'monedas') E.monedas += p.n; else if (p.tipo === 'maiz') E.maiz += p.n; else if (!E.skins.includes(p.id)) { E.skins.push(p.id); aviso('👑 ¡Skin nueva: ' + D.SKINS[p.id].nombre + '! Póntela en «Skins».', 'ok'); }
  return true;
}
// Ranking de la oleada mas alta (servidor: cwRanking).
let RANK = null;
async function cargarRanking() { const r = await pedir('ranking'); if (r && r.ok) { RANK = r; if (tab === 'misiones') pintarPanel(); } }
function htmlRanking() {
  if (!RANK) return '<div class="card proximo"><div class="ico">🏆</div><div class="tx"><b>Ranking de oleadas</b><small>Cargando…</small></div></div>';
  const fila = x => `<div class="rk${x.yo ? ' yo' : ''}"><b>${x.p}</b><span>${esc(x.n)}</span><i>Oleada ${x.o}</i></div>`;
  return `<div class="card rank"><div class="tx"><b>🏆 Ranking de oleadas</b><small>Aguanta más oleadas que nadie. ${RANK.mio ? 'Vas en el puesto ' + RANK.mio + '.' : 'Supera la oleada 2 para entrar.'}</small><div class="rks">${RANK.ranking.slice(0, 10).map(fila).join('') || '<small>Aún no hay nadie: ¡sé el primero!</small>'}</div></div></div>`;
}
// Cambio a oro y mercado entre jugadores (necesitan la cuenta de Duende Quest).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function htmlCuenta() {
  let h = '';
  if (!NUBE.ok) return `<div class="card proximo"><div class="ico">☁</div><div class="tx"><b>Conectando con tu cuenta…</b><small>El cambio a oro y el mercado entre jugadores necesitan conexión.</small></div></div>`;
  if (!NUBE.cuenta) return `<a class="card enlace" href="/mmo/" target="_blank" rel="noopener" data-dq-cuenta><div class="ico">👤</div><div class="tx"><b>Entra con tu cuenta de Duende Quest</b><small>Juegas como invitado. Con tu cuenta (correo o Telegram) guardas la partida en la nube, cambias monedas por oro de Duende Quest y usas el mercado entre jugadores.</small></div></a>`;
  const libre = 1000 - NUBE.cambio;
  h += `<div class="sub">Cambiar monedas por oro de Duende Quest</div><div class="card"><div class="ico">⇄</div><div class="tx"><b>10 monedas = 1 oro</b><small>Hoy puedes cambiar ${libre} oro más (máximo 1000 al día). Llega a tu duende al instante.</small></div></div>`;
  h += `<div class="elige">${[10, 100, 500].map(o => btn(`${o} oro`, 'cambiar', { o }, E.monedas < o * 10 || o > libre, 'oro')).join('')}</div>`;
  h += `<div class="sub">Mercado entre jugadores</div><div class="elige">${btn('Maíz morado', 'tipoM', { k: 'maiz' }, false, NUBE.tipoM === 'maiz' ? 'on' : '')}${btn('Vasos de chicha', 'tipoM', { k: 'vasos' }, false, NUBE.tipoM === 'vasos' ? 'on' : '')}</div>`;
  const uni = NUBE.tipoM === 'maiz' ? 'kg' : 'vasos', icoM = NUBE.tipoM === 'maiz' ? '🌽' : '🥤';
  const lista = NUBE.mercado.filter(x => !x.mio);
  h += lista.length ? lista.map(x => `<div class="card"><div class="ico">${icoM}</div><div class="tx"><b>${x.n} ${uni} · ${x.precio} c/u</b><small>Vende ${esc(x.quien)}</small></div>${costoBtn(Math.ceil(x.n * x.precio), 'comprar', { id: x.id })}</div>`).join('')
    : `<div class="consejo" style="margin-bottom:8px">Nadie vende ${NUBE.tipoM === 'maiz' ? 'maíz' : 'vasos'} ahora. ¡Sé el primero!</div>`;
  const tengo = NUBE.tipoM === 'maiz' ? Math.floor(E.maiz) : E.stock, rango = NUBE.tipoM === 'maiz' ? '0,5 a 5' : '1 a 40';
  h += `<div class="card vender"><div class="tx"><b>Vender ${NUBE.tipoM === 'maiz' ? 'maíz' : 'vasos'}</b><small>Tienes ${tengo} ${uni}. Precio por unidad de ${rango} monedas. El mercado se queda con el 5 %.</small>
    <div class="form"><label>Cantidad<input id="v-n" type="number" inputmode="numeric" min="5" value="${Math.min(50, Math.max(5, tengo))}"></label><label>Precio c/u<input id="v-p" type="number" inputmode="decimal" step="0.5" value="${NUBE.tipoM === 'maiz' ? 1.5 : 4}"></label>${btn('Publicar', 'vender', {}, tengo < 5, 'oro')}</div></div></div>`;
  if (NUBE.mios.length) h += `<div class="sub">Tus ventas</div>` + NUBE.mios.map(x => `<div class="card"><div class="ico">${x.tipo === 'maiz' ? '🌽' : '🥤'}</div><div class="tx"><b>${x.n} ${x.tipo === 'maiz' ? 'kg' : 'vasos'} · ${x.precio} c/u</b><small>Esperando comprador</small></div>${btn('Retirar', 'retirar', { id: x.id })}</div>`).join('');
  if (NUBE.dueno) h += `<div class="sub">Panel del dueño</div><div class="card"><div class="tx"><b>Activar pase premium</b><small>Cuando ya cobraste, pon el código que te mandó el jugador.</small><div class="form"><label>Código<input id="d-cod" placeholder="CW-XXXXXX" autocapitalize="characters"></label>${btn('Activar', 'darPase', {}, false, 'oro')}</div></div></div>`;
  return h;
}
// Dibujo de las miniaturas de skins (despues de pintar el panel).
new MutationObserver(() => { document.querySelectorAll('canvas.mini').forEach(c => { if (c.dataset.ok) return; c.dataset.ok = 1; const g = c.getContext('2d'), s = D.SKINS[c.dataset.skin], im = A.img(SPR_PJ[s.para]);
  if (im) { const h = 104, w = h * im.width / im.height; if (s.filtro) g.filter = s.filtro; g.drawImage(im, (90 - w) / 2, 110 - h - 3, w, h); return; }
  g.scale(0.4, 0.4); (s.para === 'chichero' ? A.chichero : A.chichera)(g, 112, 268, 1, 'quieta', 1, s.paleta); }); }).observe($('panel'), { childList: true });

$('panel').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-act],a[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act, d = b.dataset;
  if (a === 'mejora') {
    const k = d.k, lista = { olla: D.OLLAS, hornillas: D.HORNILLAS, fuego: D.FUEGOS, receta: D.RECETAS, cucharon: D.CUCHARONES, toldo: D.TOLDOS, ayudante: D.AYUDANTES }[k];
    const n = k === 'olla' ? E.nv.ollas[+d.i] : E.nv[k], s = lista[n + 1];
    if (!s || E.monedas < s.costo) return;
    E.monedas -= s.costo; if (k === 'olla') E.nv.ollas[+d.i]++; else E.nv[k]++;
    E.stats.mejoras++; sumar('mejora'); son('mejora'); pose('celebra', 1.2); aviso('✓ ' + (s.nombre || 'Mejora comprada'), 'ok');
  } else if (a === 'ing') { const n = +d.n, c = D.precioIng(precio() / (activo('receta') ? 1.5 : 1), n); if (E.monedas < c || !D.INGREDIENTES[d.k]) return; E.monedas -= c; E.ing[d.k] += n; son('moneda'); aviso('🧺 +' + n + ' ' + D.INGREDIENTES[d.k].nombre, 'ok'); }
  else if (a === 'maiz') { const c = +d.c; if (E.monedas < c) return; E.monedas -= c; E.maiz += +d.kg; son('moneda'); aviso('🌽 +' + d.kg + ' kg de maíz morado', 'ok'); }
  else if (a === 'mision') { const m = E.mis.l[+d.i]; if (!m.hecho || m.cobrado) return; m.cobrado = true; const def = D.MISIONES.find(x => x.id === m.id); E.monedas += def.premio; xp(D.XP.mision); son('moneda'); }
  else if (a === 'racha') { const rh = E.racha; if (rh.cobrado === rh.dia) return; rh.cobrado = rh.dia; const dia = (rh.n - 1) % 7; if (D.RACHA_MAIZ.includes(dia)) E.maiz += D.RACHA[dia]; else E.monedas += D.RACHA[dia]; son('moneda'); aviso('📅 Premio del día ' + rh.n + ' cobrado', 'ok'); }
  else if (a === 'pase') { if (!cobrarPase(+d.n, d.c)) return; son('mejora'); }
  else if (a === 'paseTodo') { let n = 0; for (let i = 1; i <= nivelPase(); i++) { n += cobrarPase(i, 'g') ? 1 : 0; if (E.pase.premium) n += cobrarPase(i, 'p') ? 1 : 0; } if (!n) return; son('nivel'); pose('celebra', 1.4); aviso('🎁 Reclamaste ' + n + ' premios del pase', 'ok'); }
  else if (a === 'desafio') { const dd = D.DESAFIOS.find(x => x.id === d.id); if (!dd || E.pase.d.includes(dd.id) || stat(dd.stat) < dd.n) return; E.pase.d.push(dd.id); xp(dd.xp); son('moneda'); aviso('⭐ +' + dd.xp + ' XP de pase', 'ok'); }
  else if (a === 'logro') { const l = D.LOGROS.find(x => x.id === d.id); if (!l || E.logros.includes(l.id) || stat(l.stat) < l.n) return; E.logros.push(l.id); E.monedas += l.mon; darIng(l.ing); son('nivel'); aviso('🏆 ' + l.txt + (l.mon ? ': +' + fmt(l.mon) + ' monedas' : '') + ' y ' + l.ing + ' ingredientes', 'ok'); }
  else if (a === 'craft') {
    const po = D.POCIONES[d.id]; if (!po || E.fama.n < po.fama || !Object.entries(po.receta).every(([k, n]) => E.ing[k] >= n)) return;
    for (const [k, n] of Object.entries(po.receta)) E.ing[k] -= n;
    E.poc[d.id] = (E.poc[d.id] || 0) + 1; son('mejora'); pose('remueve', 0.8); aviso('🧪 Preparaste ' + po.nombre, 'ok');
  } else if (a === 'usar') {
    const po = D.POCIONES[d.id]; if (!po || !(E.poc[d.id] > 0)) return;
    E.poc[d.id]--; E.act[d.id] = Math.min(Date.now() + D.TOPE_POCION * 1000, Math.max(Date.now(), E.act[d.id] || 0) + po.seg * 1000);
    E.stats.pociones++; sumar('pocion'); son('nivel'); pose('celebra', 1); particulas(W / 2, 300, 18, '#ffd54a', { vel: 240 }); aviso('✨ ' + po.nombre + ': ' + po.d.toLowerCase(), 'ok');
  } else if (a === 'herencia') {
    const g = D.recetasPorGanar(E.ganado); if (g < D.HERENCIA.min) return;
    if (!confirmaH) { confirmaH = true; pintarPanelSuave(); setTimeout(() => { confirmaH = false; }, 6000); return; }
    confirmaH = false; const b0 = nuevo();
    E.stats.oleadaMax = Math.max(E.stats.oleadaMax || 0, E.oleada); E.stats.herencias++;
    E.rs += g; E.ganado = 0; E.monedas = b0.monedas; E.maiz = b0.maiz; E.stock = 0; E.nv = b0.nv; E.saz = b0.saz; subTal = 'ut'; proy = []; rayos = []; E.ollas = b0.ollas; E.oleada = 1;
    duendes = []; colaSpawn = []; proxOleada = 12; monPrev = E.monedas; subMej = 'puesto';
    son('nivel'); pose('celebra', 2.5); temblar(6); particulas(W / 2, 260, 40, '#ffd54a', { vel: 360, moneda: true });
    abrirModal(`<h2>La herencia de la Abuela</h2><p>«Toma, ${E.personaje === 'chichero' ? 'hijito' : 'hijita'}: mis recetas secretas.» Recibes <b>${g}</b> Recetas Secretas. Ahora tienes ${E.rs}: tu chicha vale +${Math.round(E.rs * D.HERENCIA.precio * 100)} % y se cocina +${Math.round(E.rs * D.HERENCIA.coccion * 100)} % más rápido, para siempre.</p><p>Tu puesto vuelve a empezar, pero conservas tus herramientas, tu fama, el pase, tus pociones y tu chacra.</p>`);
  } else if (a === 'premium') { pedirPremium(); return; }
  else if (a === 'personaje') { E.personaje = d.k; son('tap'); }
  else if (a === 'skin') { E.skin[E.personaje] = d.id; son('mejora'); pose('celebra', 1); }
  else if (a === 'ir') { abrirHoja(d.t); return; }
  else if (a === 'granja') { cerrarHoja(); verGranja(true); return; }
  else if (a === 'prep') { prepararChicha(d.id); return; }
  else if (a === 'subMej') { subMej = d.k; pintarPanel(); return; }
  else if (a === 'subTal') { subTal = d.k; pintarPanel(); return; }
  else if (a === 'fabricar') {
    const u = D.UTENSILIOS[d.id]; if (!u) return; const e = estr(d.id), c = D.costoUt(d.id, E.oleada, e > 0);
    if (E.monedas < c || !Object.entries(u.receta).every(([k, n]) => E.ing[k] >= n) || (!e && Object.keys(E.saz.hab).length >= D.MAX_HAB) || (e && E.saz.dur[d.id] >= D.usosMax(d.id, e))) return;
    E.monedas -= c; for (const [k, n] of Object.entries(u.receta)) E.ing[k] -= n;
    if (!e) E.saz.hab[d.id] = 1; E.saz.dur[d.id] = D.usosMax(d.id, estr(d.id));
    son('mejora'); pose('celebra', 1); aviso((e ? '🔧 Reparaste ' : '🔨 Fabricaste ') + D.HABILIDADES[d.id].nombre, 'ok');
  }
  else if (a === 'mayor') { if (E.stock <= 0) return; const g = Math.round(E.stock * precio() * D.MAYORISTA); E.monedas += g; E.stats.vasos += E.stock; sumar('vende', E.stock); E.stock = 0; son('moneda'); aviso('🛒 Vendiste al por mayor: +' + fmt(g) + ' monedas', 'ok'); particulas(W - 82, PISO - 90, 16, '#ffd54a', { vel: 220, moneda: true }); }
  else if (a === 'herr') {
    const r = E.eq[d.id]; if (r >= 4) return;
    const c = D.costoHerr(d.id, r + 1); if (E.monedas < c) return;
    E.monedas -= c; E.eq[d.id]++; E.stats.mejoras++; sumar('mejora'); son('nivel'); pose('celebra', 1.4);
    aviso('✨ ' + D.HERRAMIENTAS[d.id].nombre + ' ' + D.RAREZAS[E.eq[d.id]].nombre.toLowerCase() + ': ' + D.HERRAMIENTAS[d.id].niv[E.eq[d.id]].d, 'ok');
  }
  else if (a === 'tipoM') { NUBE.tipoM = d.k; NUBE.mercado = []; pintarPanel(); cargarMercado(); return; }
  else if (['cambiar', 'vender', 'comprar', 'retirar', 'darPase'].includes(a)) { accionNube(a, d); return; }
  guardar(); pintarPanel(); pintarHud();
});

async function cargarMercado() { const r = await pedir('mercado', { tipo: NUBE.tipoM }); if (aplicar(r) && tab === 'mercado') pintarPanel(); }
let ocupado = false;
async function accionNube(a, d) {
  if (ocupado) return; ocupado = true;
  try {
    guardar();
    let datos = { est: E };
    if (a === 'cambiar') datos.oro = +d.o;
    if (a === 'vender') { datos.tipo = NUBE.tipoM; datos.n = +($('v-n') || {}).value; datos.precio = +($('v-p') || {}).value; }
    if (a === 'comprar' || a === 'retirar') datos.id = d.id;
    if (a === 'darPase') datos = { cod: ($('d-cod') || {}).value || '' };
    const r = await pedir(a, datos);
    if (r && r.red) aviso('Sin conexión: inténtalo cuando vuelva la señal.', 'err');
    if (aplicar(r)) {
      son('mejora');
      aviso(a === 'cambiar' ? `✓ +${r.hecho.oro} oro en tu duende de Duende Quest` : a === 'vender' ? '✓ Publicado en el mercado' : a === 'comprar' ? '✓ Compra hecha' : a === 'retirar' ? '✓ Venta retirada' : '✓ ' + ((r.hecho && r.hecho.ok) || 'Hecho'), 'ok');
      guardar();
      if (a !== 'cambiar' && a !== 'darPase') await cargarMercado();
    }
  } finally { ocupado = false; pintarPanel(); pintarHud(); }
}
// Enlaces de cuenta: la ventana rapida (js/cuenta.js) en vez de abrir CLASSIC en otra pestaña; el href queda de respaldo.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('[data-dq-cuenta]');
  if (!a) return;
  e.preventDefault();
  abrirCuenta({ modo: 'crear', alListo: () => location.reload() });
});
async function pedirPremium() {
  if (E.pase.premium) return;
  if (!NUBE.cuenta) { abrirModal(`<h2>★ Pase premium · S/ 10</h2><p>Duplica los premios de la temporada y trae skins exclusivas (Reina de la chicha, Pirata del Callao y Chichera dorada).</p><p>Para comprarlo necesitas entrar con tu cuenta de Duende Quest (correo o Telegram): así el pase queda guardado aunque cambies de celular.</p><p><a href="/mmo/" target="_blank" rel="noopener" style="color:#ffd166" data-dq-cuenta>Entrar o crear mi cuenta →</a></p>`); return; }
  const r = await pedir('pedirPase');
  if (!aplicar(r)) return;
  const txt = encodeURIComponent('Hola, quiero el pase premium de Chicha Wars (S/ 10). Mi código es ' + NUBE.cod);
  abrirModal(`<h2>★ Pase premium</h2><p>Duplica los premios de la temporada y trae skins exclusivas. Lo que ya ganaste en el carril premium se reclama en cuanto se active.</p>
    <p>Tu código de pedido:</p><div class="logo" style="font-size:30px">${NUBE.cod}</div>
    <p>Escríbele al creador del juego por WhatsApp con tu código: cuesta <b>S/ 10</b> por toda la temporada (hasta el 31 de diciembre), pago único por Yape o su equivalente en SOL o Stars. Cuando confirme tu pago, el pase se activa solo en tu cuenta.</p>
    <a class="b oro grande" href="https://wa.me/51900877863?text=${txt}" target="_blank" rel="noopener">WhatsApp +51 900 877 863</a>`);
}

// ── VENTANAS ──
function abrirModal(html, alCerrar) {
  $('modal-c').innerHTML = html + `<button class="b oro grande" id="modal-ok">${alCerrar ? alCerrar.txt : 'Entendido'}</button>`;
  $('modal').classList.add('on');
  $('modal-ok').onclick = () => { $('modal').classList.remove('on'); if (alCerrar) alCerrar.f(); };
}
// Musica de fondo (la de Duende Quest), baja; arranca con el primer toque (los navegadores no dejan antes).
const MUSICA = new Audio('/audio/bg_music.mp3'); MUSICA.loop = true; MUSICA.volume = 0.28;
const musica = () => { try { if (E.sonido && !document.hidden) MUSICA.play().catch(() => {}); else MUSICA.pause(); } catch (e) {} };
addEventListener('pointerdown', musica, { once: true });
document.addEventListener('visibilitychange', musica);
$('b-sonido').onclick = () => { E.sonido = !E.sonido; $('b-sonido').textContent = E.sonido ? '🔊' : '🔇'; musica(); guardar(); };
$('b-sonido').textContent = E.sonido ? '🔊' : '🔇';

// ── CHACRA: parcelas debajo del puesto. Siembras la semilla elegida, riegas una vez y cosechas. Todo va con el reloj real. ──
const chGrid = $('ch-grid'), chacraEl = $('granja');
let puedeChicha = false, cabPrev = '';
const costoParc = () => D.PARCELAS.costo[E.parc - D.PARCELAS.inicio];
const etapaCul = (p, ahora) => ahora >= p.fin ? 2 : (ahora - p.ini) / (p.fin - p.ini) < 0.3 ? 0 : 1;
let chPrev = '', chAviso = 0;
function pintarChacra(forzar) {
  const ahora = Date.now(), cs = D.CULTIVOS[E.semilla];
  puedeChicha = Object.values(D.CHICHAS).some(c => E.fama.n >= c.fama && E.maiz >= c.maiz && Object.entries(c.receta).every(([k, n]) => E.ing[k] >= n));
  const listasN = E.chacra.filter(p => p && ahora >= p.fin).length;
  document.querySelector('.tab[data-t="granja"]').classList.toggle('punto', listasN > 0 && !enGranja);
  if (!forzar && !enGranja) return;
  const cab = fmt(E.monedas) + '|' + Math.floor(E.maiz) + '|' + Object.values(E.ing).join();
  if (cab !== cabPrev) { cabPrev = cab; $('g-mon').textContent = fmt(E.monedas); $('ch-ings').innerHTML = `<span class="ing"><img src="${IMG}ing_maiz.webp" alt="">${fmt(E.maiz)} kg</span>` + Object.keys(D.INGREDIENTES).map(k => chipIng(k, E.ing[k])).join(''); }
  { const al = $('g-alerta'), pelea = colaSpawn.length > 0 || duendes.some(d => !d.muerto && !D.DUENDES[d.k].dorado), tx = pelea ? '⚠ ¡Duendes en tu puesto! Toca para volver' : 'Oleada ' + E.oleada + ' en ' + Math.max(0, Math.ceil(proxOleada)) + ' s'; if (al.textContent !== tx) al.textContent = tx; al.classList.toggle('roja', pelea); }
  const firma = [E.parc, E.semilla, E.fama.n, E.chacra.map(p => p ? p.k + etapaCul(p, ahora) + (p.r ? 'r' : '') : '-').join(), E.parc < D.PARCELAS.max && E.monedas >= costoParc()].join('|');
  if (forzar || firma !== chPrev) {
    const nace = chPrev.split('|')[3] || ''; chPrev = firma;
    { const bs = $('g-semillas'), sl = bs.scrollLeft, st = bs.scrollTop; bs.innerHTML = Object.entries(D.CULTIVOS).map(([k, c]) => { const bloq = E.fama.n < c.fama;
        return `<button class="sem${E.semilla === k ? ' on' : ''}${bloq ? ' bloq' : ''}" data-k="${k}"><img src="${IMG}cul_${k}_2.webp" alt=""><b>${c.nombre}</b><small>${bloq ? 'Fama ' + c.fama : mmss(c.seg * 1000) + ' · <span class="mon"></span>' + c.semilla}</small></button>`; }).join(''); bs.scrollLeft = sl; bs.scrollTop = st; }
    const antes = nace.split(',');
    chGrid.innerHTML = E.chacra.map((p, i) => {
      const base = `<img src="${IMG}parcela.webp" alt="">`;
      if (i > E.parc) return `<div class="parc cerrada lejos" data-i="${i}">${base}</div>`;
      if (i === E.parc && E.parc < D.PARCELAS.max) { const c = costoParc(); return `<button class="parc cerrada" data-i="${i}" aria-label="Comprar parcela">${base}<span class="precio${E.monedas >= c ? ' si' : ''}"><span class="mon"></span>${fmt(c)}</span></button>`; }
      if (!p) return `<button class="parc vacia" data-i="${i}" aria-label="Sembrar">${base}<span class="mas"><img src="${IMG}${cs.img}.webp" alt="">＋</span></button>`;
      const et = etapaCul(p, ahora), c = D.CULTIVOS[p.k], cambio = antes[i] !== p.k + et + (p.r ? 'r' : '') && antes[i] !== p.k + et;
      const cul = `<img class="cul${cambio ? ' nace' : ''}" src="${IMG}${et === 0 ? 'cul_brote' : 'cul_' + p.k + '_' + et}.webp" alt="">`;
      if (et === 2) return `<button class="parc lista-ya" data-i="${i}" aria-label="Cosechar ${c.nombre}">${base}${cul}<span class="lista"><img src="${IMG}${c.img}.webp" alt=""></span></button>`;
      return `<button class="parc crece" data-i="${i}" aria-label="${c.nombre} creciendo">${base}${cul}${p.r ? '' : '<span class="gota"></span>'}<em class="tm"></em><i class="pb"><b></b></i></button>`;
    }).join('');
  }
  chGrid.querySelectorAll('.parc.crece').forEach(b => { const p = E.chacra[+b.dataset.i]; if (!p) return; b.querySelector('.pb b').style.width = Math.min(100, (ahora - p.ini) / (p.fin - p.ini) * 100) + '%'; b.querySelector('.tm').textContent = mmss(Math.max(0, p.fin - ahora)); });
  const listas = E.chacra.filter(p => p && ahora >= p.fin && !p.av);
  if (listas.length && E.elegido && !enPortada && !enGranja && ahora - chAviso > 20000) { chAviso = ahora; for (const p of E.chacra) if (p && ahora >= p.fin) p.av = 1; aviso('🌱 Tu granja tiene cosecha lista', 'ok'); son('lista'); }
  const hr = new Date().getHours(); chacraEl.classList.toggle('noche', hr >= 19 || hr < 6);
}
function chSube(b, html) { const r = b.getBoundingClientRect(), c = chacraEl.getBoundingClientRect(), el = document.createElement('div'); el.className = 'ch-sube'; el.innerHTML = html; el.style.left = (r.left - c.left + r.width / 2) + 'px'; el.style.top = Math.max(4, r.top - c.top - 20) + 'px'; chacraEl.appendChild(el); setTimeout(() => el.remove(), 900); }
function sembrar(i, b) {
  const c = D.CULTIVOS[E.semilla];
  if (E.monedas < c.semilla) { aviso('Te faltan monedas para la semilla de ' + c.nombre.toLowerCase() + ' (' + c.semilla + ').', 'err'); return; }
  E.monedas -= c.semilla; const ahora = Date.now(); E.chacra[i] = { k: E.semilla, ini: ahora, fin: ahora + c.seg * 1000 };
  son('tap'); vibrar(10); if (b) chSube(b, '−' + c.semilla + ' <span class="mon"></span>');
}
function regar(i, b) {
  const p = E.chacra[i], ahora = Date.now(); if (!p || p.r || ahora >= p.fin) return;
  const quita = (p.fin - ahora) * D.RIEGO; p.fin -= quita; p.ini -= quita; p.r = 1; son('moneda'); vibrar(10);
  if (b) { const r = b.getBoundingClientRect(), c = chacraEl.getBoundingClientRect(); for (let j = 0; j < 7; j++) { const g = document.createElement('i'); g.className = 'ch-agua'; g.style.left = (r.left - c.left + r.width * (0.15 + 0.7 * Math.random())) + 'px'; g.style.top = (r.top - c.top - 26 + Math.random() * 14) + 'px'; g.style.animationDelay = (j * 0.05) + 's'; chacraEl.appendChild(g); setTimeout(() => g.remove(), 900); } chSube(b, '−' + mmss(quita)); }
}
function cosechar(i, b) {
  const p = E.chacra[i]; if (!p || Date.now() < p.fin) return;
  // el maiz cosechado crece con tus ollas (si no, la granja no alcanzaria nunca para las ollas grandes)
  const c = D.CULTIVOS[p.k], doble = Math.random() < D.COSECHA_DOBLE; let n = (c.kg ? D.maizCosecha(E.fama.n) + Math.round(E.ollas.slice(0, nOllas()).reduce((a, o, i) => a + maizOlla(i), 0) * 1.5) : c.da) * (doble ? 2 : 1);
  if (c.kg) E.maiz += n; else E.ing[p.k] += n;
  E.chacra[i] = null; E.stats.cosechas++; sumar('cosecha'); xp(2); son('lista'); vibrar(15);
  if (b) chSube(b, (doble ? '¡Doble! ' : '') + '+' + n + (c.kg ? ' kg' : '') + ` <img src="${IMG}${c.img}.webp" alt="">`);
}
chGrid.addEventListener('click', ev => {
  const b = ev.target.closest('.parc'); if (!b || !E.elegido) return;
  const i = +b.dataset.i;
  if (i > E.parc) return;
  if (i === E.parc) {
    const c = costoParc(); if (E.monedas < c) { aviso('Una parcela más cuesta ' + fmt(c) + ' monedas.', 'err'); return; }
    E.monedas -= c; E.parc++; E.stats.mejoras++; sumar('mejora'); son('mejora'); aviso('🌱 ¡Parcela nueva! Ya tienes ' + E.parc + '.', 'ok');
  } else if (!E.chacra[i]) sembrar(i, b);
  else if (Date.now() >= E.chacra[i].fin) cosechar(i, b);
  else if (!E.chacra[i].r) regar(i, b);
  else { aviso(D.CULTIVOS[E.chacra[i].k].nombre + ': falta ' + mmss(E.chacra[i].fin - Date.now()), ''); return; }
  pintarChacra(true); pintarHud(); guardar();
});
$('g-semillas').addEventListener('click', ev => { const b = ev.target.closest('.sem'); if (!b) return; const c = D.CULTIVOS[b.dataset.k];
  if (E.fama.n < c.fama) { aviso(c.nombre + ' se desbloquea en Fama ' + c.fama + ' (vas en ' + E.fama.n + ').', 'err'); return; }
  E.semilla = b.dataset.k; son('tap'); pintarChacra(true); guardar(); });
$('g-volver').onclick = () => { son('tap'); verGranja(false); };
$('g-alerta').onclick = () => { verGranja(false); };
$('g-cos').onclick = () => { let n = 0; chGrid.querySelectorAll('.parc').forEach(b => { const i = +b.dataset.i; if (i < E.parc && E.chacra[i] && Date.now() >= E.chacra[i].fin) { cosechar(i, b); n++; } }); if (!n) aviso('Todavía no hay nada listo para cosechar.', ''); pintarChacra(true); pintarHud(); guardar(); };
$('g-sem').onclick = () => { let n = 0; chGrid.querySelectorAll('.parc').forEach(b => { const i = +b.dataset.i; if (i < E.parc && !E.chacra[i] && E.monedas >= D.CULTIVOS[E.semilla].semilla) { sembrar(i, b); n++; } }); if (!n) aviso(E.chacra.slice(0, E.parc).some(q => !q) ? 'No te alcanza para la semilla.' : 'No hay parcelas vacías.', ''); pintarChacra(true); pintarHud(); guardar(); };
setInterval(pintarChacra, 500);
fetch(IMG + 'chichera_hoja.json', { cache: 'no-cache' }).then(q => q.ok ? q.json() : null).then(m => { if (m && m.celda && m.pie && m.olla && m.altoPersona) HOJA_CH = m; }).catch(() => {});

// ── PREPARAR CHICHA ESPECIAL: tres pasos de puntería (para la barra en la zona verde; en la dorada, mejor) ──
function prepararChicha(id) {
  const c = D.CHICHAS[id]; if (!c || E.fama.n < c.fama || E.maiz < c.maiz || !Object.entries(c.receta).every(([k, n]) => E.ing[k] >= n)) return;
  cerrarHoja(); pausa = true; son('tap');
  const pts = []; let paso = 0, t0 = 0, centro = 0.5, ancho = 0.3, vel = 1, vivo = true, pos = 0;
  $('modal-c').innerHTML = `<div class="hab-t">${c.nombre}</div>${HOJA_CH ? '<div class="pr-ch" id="pr-ch"></div>' : `<img class="pr-olla" src="${IMG}olla_${Math.min(6, E.nv.ollas[0] + 1)}.webp" alt="">`}<p id="pr-paso"></p>
    <div class="pr-barra"><div class="pr-zona" id="pr-zona"><i></i></div><div class="pr-punto" id="pr-punto"></div></div>
    <div class="pr-pasos">${D.PASOS_CHICHA.map((_, i) => `<span id="pr-s${i}">${i + 1}</span>`).join('')}</div>
    <button class="b oro grande" id="pr-ya">¡Ahora!</button><small class="hab-pie">Para la barra blanca dentro de la zona verde. En el centro dorado sale perfecta.</small>`;
  $('modal').classList.add('on');
  const poseCh = f => { const el = $('pr-ch'), M = HOJA_CH; if (!el || !M) return; el.style.aspectRatio = M.celda[0] + '/' + M.celda[1]; el.style.backgroundImage = `url(${IMG}chichera_hoja.webp)`; el.style.backgroundSize = M.cols * 100 + '% ' + M.filas * 100 + '%'; el.style.backgroundPosition = (f % M.cols) / (M.cols - 1) * 100 + '% ' + Math.floor(f / M.cols) / (M.filas - 1) * 100 + '%'; };
  const nuevoPaso = () => { poseCh([1, 5, 8][paso] ?? 5); ancho = 0.30 - paso * 0.06; centro = 0.2 + Math.random() * 0.6; vel = 0.75 + paso * 0.3; t0 = performance.now(); $('pr-paso').textContent = `Paso ${paso + 1} de ${D.PASOS_CHICHA.length} · ${D.PASOS_CHICHA[paso]}`; const z = $('pr-zona'); z.style.left = (centro - ancho / 2) * 100 + '%'; z.style.width = ancho * 100 + '%'; };
  const anim = ahora => { if (!vivo) { if (animExtra === anim) animExtra = null; return; } const u = ((ahora - t0) / 1000 * vel) % 2; pos = u < 1 ? u : 2 - u; const el = $('pr-punto'); if (el) el.style.left = pos * 100 + '%'; };   // la llama cuadro() (un solo requestAnimationFrame)
  const fin = () => {
    vivo = false; const suma = pts.reduce((a, b) => a + b, 0), q = suma >= 5 ? 2 : suma >= 3 ? 1 : 0, cal = D.CALIDAD[q];
    if (E.maiz < c.maiz || !Object.entries(c.receta).every(([k, n]) => E.ing[k] >= n)) { $('modal').classList.remove('on'); pausa = false; ultimo = performance.now(); return; }
    E.maiz -= c.maiz; for (const [k, n] of Object.entries(c.receta)) E.ing[k] -= n;
    const vasos = Math.round(c.vasos * (1 + cal.extra)), s = E.esp, total = Math.min(D.TOPE_ESPECIAL, s.n + vasos);
    s.mult = s.n > 0 ? (s.n * s.mult + vasos * c.mult) / (s.n + vasos) : c.mult; s.n = total; s.nom = c.nombre;
    E.stats.chichas++; sumar('chicha'); xp(15 + q * 10); guardar();
    abrirModal(`<div class="hab-t">¡Te salió ${cal.nombre.toLowerCase()}!</div><img class="pr-olla" src="${IMG}${c.img}.webp" alt=""><p><b>${c.nombre}</b>: tus próximos <b>${fmt(vasos)}</b> vasos se venden a <b>×${coma(c.mult)}</b> del precio${cal.extra ? ` (+${Math.round(cal.extra * 100)} % de vasos por la calidad)` : ''}.</p><p>Ahora tienes ${fmt(s.n)} vasos especiales a ×${coma(s.mult)}.</p>`,
      { txt: '¡A vender!', f: () => { pausa = false; ultimo = performance.now(); pose('celebra', 1.5); particulas(W - 82, PISO - 90, 20, '#ffd54a', { vel: 240 }); pintarChacra(true); pintarHud(); } });
    son('nivel'); vibrar(50);
  };
  $('pr-ya').onclick = () => {
    if (!vivo || paso >= D.PASOS_CHICHA.length) return;
    const d = Math.abs(pos - centro), s = d < ancho / 6 ? 2 : d < ancho / 2 ? 1 : 0; pts.push(s); if (s === 2) poseCh(11);
    const el = $('pr-s' + paso); el.className = 's' + s; el.textContent = s === 2 ? '¡Perfecto!' : s === 1 ? 'Bien' : 'Falló'; son(s ? 'lista' : 'robo'); vibrar(s ? 20 : 60);
    paso++; if (paso >= D.PASOS_CHICHA.length) { vivo = false; setTimeout(fin, 550); } else nuevoPaso();
  };
  nuevoPaso(); animExtra = anim;
}

// ── PORTADA (pantalla de inicio): el puesto no corre hasta que tocas JUGAR ──
const portada = $('portada');
function pintarPortada() {
  const nocheP = new Date().getHours() >= 19 || new Date().getHours() < 6;
  portada.querySelector('.p-fondo').style.backgroundImage = `url(/assets/chicha-wars/fondo_mercado_${nocheP ? 'noche' : 'dia'}.webp)`;
  $('p-pj').src = '/assets/chicha-wars/' + SPR_PJ[E.personaje] + '.webp';
  $('p-res').textContent = E.elegido ? `Fama ${E.fama.n} · Oleada ${E.oleada}${E.rs ? ' · ' + E.rs + ' Recetas Secretas' : ''} · ${fmt(E.monedas)} monedas` : 'Tu puesto te espera en la plaza';
  $('p-son').textContent = 'Sonido: ' + (E.sonido ? 'sí' : 'no');
  $('p-ver').textContent = 'v' + (new URL(import.meta.url).searchParams.get('v') || '');
}
let listo = false, primeraVez = true;
function portadaLista() { if (listo) return; listo = true; const b = $('p-jugar'); b.disabled = false; b.textContent = E.elegido ? 'CONTINUAR' : 'JUGAR'; }
function abrirPortada() { enPortada = true; cerrarHoja(); verGranja(false); guardar(); pintarPortada(); $('p-jugar').textContent = E.elegido ? 'CONTINUAR' : 'JUGAR'; portada.classList.remove('sale'); portada.classList.add('on'); }
$('p-jugar').onclick = () => {
  son('nivel'); portada.classList.add('sale');
  setTimeout(() => { portada.classList.remove('on', 'sale'); enPortada = false; ultimo = performance.now(); monPrev = E.monedas; if (primeraVez) { primeraVez = false; inicio(); } }, 430);
};
$('p-son').onclick = () => { $('b-sonido').click(); pintarPortada(); };
$('p-como').onclick = () => { son('tap'); abrirModal(`<h2>Cómo se juega</h2><ul class="como">
  <li><img src="/assets/chicha-wars/olla_1.webp" alt=""><span>Tus ollas cocinan solas. Tócalas para remover (salen antes) y para servir cuando están listas.</span></li>
  <li><img src="/assets/chicha-wars/casera.webp" alt=""><span>Los clientes compran los vasos de tus jarras. Si se llenan, vende al por mayor.</span></li>
  <li><img src="/assets/chicha-wars/duende_pirata.webp" alt=""><span>Los duendes vienen en oleadas a robarte: tócalos para espantarlos. Sueltan ingredientes.</span></li>
  <li><img src="/assets/chicha-wars/tabla_3.webp" alt=""><span>Cada duende espantado sube tu Sazón: eliges 1 de 3 utensilios que pelean solos. Se gastan con el uso; en el Taller los fabricas y reparas con tu cosecha.</span></li>
  <li><img src="/assets/chicha-wars/cul_maiz_2.webp" alt=""><span>El botón Granja te lleva a tu chacra: elige semilla, toca una parcela para sembrar, riégala (la gota azul) y cosecha maíz, canela, caña, limón, clavo, piña y manzana. Ojo: los duendes siguen llegando al puesto.</span></li>
  <li><img src="/assets/chicha-wars/vaso_3.webp" alt=""><span>En Cocina preparas chicha especial con tu cosecha: tres pasos de puntería y tus vasos se venden más caros.</span></li>
  <li><img src="/assets/chicha-wars/cucharon_3.webp" alt=""><span>Con las monedas mejora ollas, fuego, recetas y herramientas. Con ingredientes prepara también pociones en el Taller.</span></li>
  <li><img src="/assets/chicha-wars/ico_pergamino.webp" alt=""><span>Sube tu Fama, completa el Pase y, cuando quieras, recibe la Herencia de la Abuela para volver más fuerte.</span></li>
  <li><img src="/assets/chicha-wars/ico_reloj.webp" alt=""><span>Aunque cierres el juego, tu puesto sigue vendiendo unas horas.</span></li></ul>`); };
$('p-rank').onclick = async () => { son('tap'); abrirModal(htmlRanking()); await cargarRanking(); if ($('modal').classList.contains('on') && RANK) $('modal-c').innerHTML = htmlRanking() + '<button class="b oro grande" id="modal-ok">Cerrar</button>', $('modal-ok').onclick = () => $('modal').classList.remove('on'); };
$('b-menu').onclick = () => { son('tap'); abrirPortada(); };
pintarPortada();
setTimeout(portadaLista, 7000);   // por si alguna imagen tarda: nunca se queda en «Cargando»

function inicio() {
  if (!E.elegido) {
    abrirModal(`<div class="logo">CHICHA WARS</div><p>Prepara la mejor chicha morada del pueblo… y no dejes que los duendes te la roben.</p><p><b>¿Quién atiende el puesto?</b></p><div class="elige grande pj">${btn('<img src="/assets/chicha-wars/chichera_maestra.webp" alt="">Chichera', 'x', { k: 'chichera' }, false, 'on')}${btn('<img src="/assets/chicha-wars/agricultor.webp" alt="">Chichero', 'x', { k: 'chichero' })}</div>`, { txt: '¡A cocinar!', f: () => { E.elegido = true; guardar(); aviso('Tu olla ya está en el fuego: tócala para servir cuando esté lista y espanta a los duendes.', ''); setTimeout(() => aviso('🌱 Toca «Granja» para sembrar tus ingredientes.', 'ok'), 5000); pintarChacra(true); } });
    $('modal-c').querySelectorAll('.elige .b').forEach(b => b.onclick = () => { E.personaje = b.dataset.k; $('modal-c').querySelectorAll('.elige .b').forEach(o => o.classList.toggle('on', o === b)); });
  } else if (vuelta) {
    abrirModal(`<h2>Mientras no estabas</h2><p>Tu puesto siguió abierto ${vuelta.min >= 60 ? Math.floor(vuelta.min / 60) + ' h ' + (vuelta.min % 60) + ' min' : vuelta.min + ' min'}${vuelta.tope ? ` (tu Jarra guarda hasta ${vuelta.horas} h: mejórala para más)` : ''}.</p>
      <div class="resumen"><div><b>${vuelta.tandas}</b><small>tandas</small></div><div><b>${vuelta.vendidos}</b><small>vasos vendidos</small></div><div><b>+${fmt(vuelta.ganado)}</b><small>monedas</small></div></div>
      ${vuelta.sinMaiz ? '<p class="alerta-t">Se te acabó el maíz morado: siémbralo en tu chacra o cómpralo en la Tienda.</p>' : ''}${E.chacra.some(q => q && Date.now() >= q.fin) ? '<p>🌱 Tu granja tiene cosecha lista.</p>' : ''}`, { txt: 'Cobrar', f: () => { son('moneda'); pose('celebra', 1.2); } });
  }
  pintarPanel(); pintarHud();
}

// ── TAMAÑO ──
function ajustar() {
  // El lienzo llena el hueco libre; si el hueco es mas bajo que 540x640 (celular acostado) o mas alto que 540x1120,
  // se encoge a lo ancho o a lo alto y queda centrado: la escena nunca se deforma.
  const c = lienzo.parentElement.getBoundingClientRect(), dpr = dprAct();
  if (c.width > 0 && c.height > 0) {
    const h0 = Math.round(W * c.height / c.width); H = Math.max(640, Math.min(1120, h0)); const ex = H - 640; Y_OLLA = 505 + Math.round(ex * 0.3); Y_CH = 590 + Math.round(ex * 0.3);
    const cw = h0 < H ? c.height * W / H : c.width, ch = h0 > H ? c.width * H / W : c.height;
    lienzo.style.width = cw + 'px'; lienzo.style.height = ch + 'px'; lienzo.style.marginTop = Math.max(0, (c.height - ch) / 2) + 'px';
    document.documentElement.style.setProperty('--cw', Math.round(cw) + 'px');   // celular acostado: HUD y ventanas van a la derecha de la escena (index.html)
  }
  const r = lienzo.getBoundingClientRect();
  lienzo.width = Math.round(r.width * dpr); lienzo.height = Math.round(r.height * dpr);
}
addEventListener('resize', ajustar); ajustar();
// Hojas de los duendes (y su copia del destello) hechas de a una en ratos libres, no en medio de la primera oleada.
function precalentar() {
  const cola = ['pirata', 'vampiro', 'esqueleto', 'lobo', 'momia', 'bruja', 'jefe'];
  const uno = () => { const k = cola.shift(); if (!k) return; const im = A.img('duende_' + k); if (im) try { R.precalentar(im); } catch (e) {}
    if (cola.length) (window.requestIdleCallback || (f => setTimeout(f, 60)))(uno, { timeout: 1500 }); };
  setTimeout(uno, 1200);
}
// Que sprites se esperan antes de jugar: lo que se ve en la escena con TU partida (fondo de esta hora, tu toldo,
// tus ollas y herramientas, duendes, clientes, iconos). Lo demas baja despues (cargarSprites en arte.js).
function alInicio(k) {
  if (k.startsWith('fondo_mercado_')) { const h = new Date().getHours(); return k === 'fondo_mercado_' + (h >= 19 || h < 6 ? 'noche' : 'dia'); }
  if (k.startsWith('puesto_toldo_')) return k === 'puesto_toldo_' + Math.min(2, E.nv.toldo || 0);
  if (k === 'chichera_hoja') return E.personaje !== 'chichero';
  const m = /^(olla|jarra|vaso|cucharon|tabla|colador|exprimidor)_(\d)$/.exec(k); if (!m) return true;
  const usados = new Set([...Object.values(D.HABILIDADES), ...Object.values(D.POCIONES)].map(h => h.img));
  if (usados.has(k)) return true;
  const n = +m[2], eq = E.eq || {};
  if (m[1] === 'olla') return (E.nv.ollas || []).some(v => v + 1 === n);
  if (m[1] === 'jarra') return Math.min(5, eq.jarra || 0) + 1 === n;
  return (eq[m[1]] || 0) + 1 === n;
}
A.cargarSprites('/assets/chicha-wars/', alInicio).then(n => { if (n) console.info('[CW] sprites del dueño:', n); portadaLista(); precalentar();
  setTimeout(() => { const im = A.img(SPR_PJ[E.personaje]); if (im) { titere(SPR_PJ[E.personaje], im, 'idle'); titere(SPR_PJ[E.personaje], im, 'accion'); } }, 400); });
if (document.fonts && document.fonts.load) document.fonts.load('20px "Lilita One"').catch(() => {});
pintarPanel(); pintarHud(); pintarChacra(true);
requestAnimationFrame(cuadro);
bajar();
// Para pruebas (consola): __cw.avanzar(segundos) corre el juego sin esperar.
window.__cw = { E, get duendes() { return duendes; }, avanzar(seg) { for (let i = 0; i < seg * 20; i++) { T += 0.05; logica(0.05); } dibujar(); }, oleadaYa() { proxOleada = 0.01; }, abrir(t) { abrirHoja(t); }, cerrar() { cerrarHoja(); }, granja(si = true) { verGranja(si); }, get H() { return H; }, chacra(seg = 600) { for (const q of E.chacra) if (q) { q.ini -= seg * 1000; q.fin -= seg * 1000; } pintarChacra(true); }, prep(id) { prepararChicha(id); }, saz(n = 10) { ganarSazon(n); }, ruleta() { ruleta(); }, jugar() { portadaLista(); if (enPortada) $('p-jugar').click(); }, tocar() { for (const d of duendes) if (!d.muerto) golpear(d, dano()); }, recoger() { for (let i = 0; i < nOllas(); i++) if (E.ollas[i].lista) recoger(i); }, comprar() { const m = mejorAsequible(); if (m) { const b = document.createElement('button'); b.dataset.act = m[2]; for (const k in m[3]) b.dataset[k] = m[3][k]; $('panel').appendChild(b); b.click(); return m[1]; } }, ing(n = 10) { for (const k in E.ing) E.ing[k] += n; pintarPanel(); }, fama(p) { ganarFama(p); pintarPanel(); } };
