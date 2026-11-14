// ═══════════════════════════════════════════════════════
// CHICHA WARS — juego (v1)
// Bucle: las ollas cocinan chicha (gastan maiz morado), los vasos van a las
// jarras del mostrador, los clientes los compran y los duendes ladrones
// llegan por oleadas a robarlos: se espantan tocandolos.
// Guardado en el navegador (cw_estado). La cuenta compartida con Duende Quest,
// el pase premium y el mercado entre jugadores llegan con el servidor.
// ═══════════════════════════════════════════════════════
import * as D from './datos.js?v=383';
import * as A from './arte.js?v=383';
import { pedir } from './red.js?v=383';

const W = 540, H = 640, PISO = 360;
const $ = id => document.getElementById(id);
const lienzo = $('escena'), x = lienzo.getContext('2d');
const fmt = n => Math.floor(n).toLocaleString('es-PE');
const hoyPeru = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const azar = (a, b) => a + Math.random() * (b - a);

// ── ESTADO ──
function nuevo() {
  return {
    v: 1, monedas: D.MONEDAS_INICIO, maiz: D.MAIZ_INICIO, stock: 0,
    nv: { ollas: [0, 0, 0, 0], fuego: 0, hornillas: 0, receta: 0, cucharon: 0, toldo: 0, ayudante: 0 },
    ollas: [{ fin: 0, lista: false }, { fin: 0, lista: false }, { fin: 0, lista: false }, { fin: 0, lista: false }],
    oleada: 1, pase: { xp: 0, premium: false, g: [], p: [] }, mis: null, racha: { dia: '', n: 0, cobrado: '' },
    stats: { vasos: 0, duendes: 0, tandas: 0, mejoras: 0, oleadas: 0 },
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
let AC = null;
function son(tipo) {
  if (!E.sonido) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime;
    const P = { golpe: ['square', 220, 90, 0.12], moneda: ['triangle', 880, 1320, 0.12], robo: ['sawtooth', 300, 120, 0.25], lista: ['sine', 660, 990, 0.18], mejora: ['triangle', 523, 1046, 0.25], nivel: ['sine', 523, 1568, 0.45], tap: ['sine', 400, 300, 0.05] }[tipo] || ['sine', 440, 440, 0.1];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t0); o.frequency.exponentialRampToValueAtTime(P[2], t0 + P[3]);
    g.gain.setValueAtTime(0.08, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + P[3]);
    o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + P[3] + 0.02);
  } catch (e) {}
}
const vibrar = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ── VALORES DERIVADOS ──
const HR = id => D.HERRAMIENTAS[id].niv[E.eq[id]];
const nOllas = () => D.HORNILLAS[E.nv.hornillas].n;
// Hervor Cosmico (cucharon legendario): x3 de velocidad 10 s de cada minuto.
const hervor = () => !!HR('cucharon').hervor && (Date.now() / 1000) % 60 < 10;
const segTanda = () => D.FUEGOS[E.nv.fuego].seg / (1 + HR('cucharon').coccion) / (1 + HR('tabla').corte * 0.25) / (hervor() ? 3 : 1);
const vasosOlla = i => Math.round(D.OLLAS[E.nv.ollas[i]].vasos * (1 + HR('cucharon').prod));
const maizOlla = i => D.OLLAS[E.nv.ollas[i]].vasos * D.MAIZ.porVaso * (1 - HR('tabla').ahorro);
const precio = () => D.RECETAS[E.nv.receta].precio * (1 + HR('vaso').venta) * (1 + HR('colador').calidad) * (HR('colador').nectar ? 2 : 1) * (1 + (HR('jarra').temp || 0));
const capStock = () => Math.round(D.STOCK_BASE * (1 + HR('jarra').cap));
const segCliente = () => D.TOLDOS[E.nv.toldo].seg / (1 + HR('colador').rep);
const dano = () => HR('cucharon').dano;
const fmtP = n => n >= 100 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString('es-PE');
const ayud = () => D.AYUDANTES[E.nv.ayudante];
const xOlla = i => 150 + i * 98;
const Y_OLLA = 505;
const nivelPase = () => Math.min(D.PASE.niveles, Math.floor(E.pase.xp / D.PASE.xpNivel));

// ── EVENTOS DE PROGRESO (misiones y pase) ──
function sumar(id, n = 1) {
  if (!E.mis) return;
  for (const m of E.mis.l) if (m.id === id && !m.hecho) { m.prog += n; if (m.prog >= m.n) { m.prog = m.n; m.hecho = true; aviso('✓ Misión cumplida: ' + D.MISIONES.find(x => x.id === id).txt(m.n), 'ok'); pintarPanel(); } }
}
function xp(n) {
  const antes = nivelPase();
  E.pase.xp += n;
  const ahora = nivelPase();
  if (ahora > antes) { aviso('⭐ ¡Pase nivel ' + ahora + '! Reclama tu premio en «Pase».', 'ok'); son('nivel'); pose('celebra', 1.6); marcarTab('pase'); }
}

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
  const ganado = Math.round(vendidos * precio());
  E.maiz -= gastoMaiz; E.stock = Math.min(capStock(), E.stock + vasos - vendidos); E.monedas += ganado;
  E.stats.vasos += vendidos; E.stats.tandas += tandas;
  for (const o of E.ollas) { o.fin = 0; o.lista = false; }
  return { min: Math.round(dt / 60000), tandas, vendidos, ganado, gastoMaiz, horas: jr.offH, tope: dt >= jr.offH * 3600000 - 60000, sinMaiz: E.maiz < maizOlla(0) };
}
const vuelta = offline();

// ── ENTIDADES DE LA ESCENA ──
let duendes = [], clientes = [], parts = [], textos = [];
let proxCliente = 2, proxOleada = 12, colaSpawn = [], tSpawn = 0, ayudT = 0;
let poseAct = 'quieta', poseHasta = 0, T = 0;
function pose(p, seg) { poseAct = p; poseHasta = T + seg; }

function particulas(px, py, n, color, opc = {}) {
  for (let i = 0; i < n; i++) parts.push({ x: px, y: py, vx: azar(-1, 1) * (opc.vel || 160), vy: azar(-1.2, -0.2) * (opc.vel || 160), g: opc.g ?? 420, vida: opc.vida || 0.7, t: 0, r: azar(2, opc.r || 5), color, moneda: opc.moneda });
}
function texto(px, py, txt, color = '#ffe082', tam = 26) { textos.push({ x: px, y: py, txt, color, tam, t: 0 }); }

function spawnDuende(k) {
  const n = E.oleada;
  const VAR = { ladron: ['pirata', 'vampiro', 'esqueleto'], rapido: ['lobo'], gordo: ['momia'], gancho: ['bruja'], jefe: ['jefe'] }[k] || ['pirata'];
  duendes.push({ k, var: VAR[Math.floor(Math.random() * VAR.length)], x: W + 40, y: azar(480, 600), vida: D.vidaDuende(k, n), max: D.vidaDuende(k, n), vel: D.DUENDES[k].vel * azar(0.9, 1.1), lleva: 0, huye: false, golpe: 0, robaT: 0 });
}
function golpear(d, n) {
  d.vida -= n; d.golpe = 0.35;
  particulas(d.x, d.y - 60, 6, '#d65caa', { vel: 200 });
  texto(d.x, d.y - 110, '-' + n, '#ff8a80', 24);
  if (d.vida <= 0) {
    const pr = D.premioDuende(d.k, E.oleada);
    E.monedas += pr; E.stats.duendes++; sumar('espanta'); xp(D.XP.duende);
    if (d.lleva) { E.stock += d.lleva; texto(d.x, d.y - 140, '+' + d.lleva + ' vasos recuperados', '#c5e1a5', 20); }
    if (D.DUENDES[d.k].jefe) { xp(D.XP.jefe); pose('celebra', 2); aviso('👑 ¡Venciste al Rey de los Ladrones! +' + pr + ' monedas', 'ok'); vibrar(80); }
    particulas(d.x, d.y - 50, 14, '#ffd54a', { vel: 260, moneda: true });
    particulas(d.x, d.y - 50, 10, '#e0e0e0', { vel: 120, g: -60, vida: 0.9, r: 10 });
    texto(d.x, d.y - 90, '+' + pr, '#ffd54a', 28);
    d.muerto = true;
  }
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
  if (mejor) { golpear(mejor, dano()); pose('espanta', 0.35); son('golpe'); vibrar(15); return; }
  // 2. una olla lista
  for (let i = 0; i < nOllas(); i++) {
    const o = E.ollas[i];
    if (Math.abs(px - xOlla(i)) < 55 && py > Y_OLLA - 130 && py < Y_OLLA + 40) {
      if (o.lista) { recoger(i); return; }
      if (o.fin) { o.fin = Math.max(Date.now(), o.fin - segTanda() * 1000 * 0.12); pose('remueve', 0.4); particulas(xOlla(i), Y_OLLA - 70, 5, '#d65caa', { vel: 110 }); texto(xOlla(i), Y_OLLA - 100, '¡A remover!', '#f8bbd0', 16); return; }
    }
  }
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
  if (E.rafaga > 0) { E.rafaga--; crit = true; } else if (Math.random() < ex.crit) crit = true;
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
let ultimo = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora; T += dt;
  if (E.elegido) logica(dt);
  dibujar();
  requestAnimationFrame(cuadro);
}
function logica(dt) {
  const ahoraMs = Date.now();
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
  if (proxCliente <= 0 && clientes.length < 4) { proxCliente = segCliente() * azar(0.8, 1.2); clientes.push({ i: Math.floor(Math.random() * A.N_CLIENTES), x: -40, meta: W / 2 - 40 + clientes.length * 26, est: 'llega', t: 0, feliz: false }); }
  for (const c of clientes) {
    c.t += dt;
    if (c.est === 'llega') { c.x += 120 * dt; if (c.x >= c.meta) { c.x = c.meta; c.est = 'espera'; c.t = 0; } }
    else if (c.est === 'espera') {
      if (E.stock > 0 && c.t > 0.5) {
        const n = Math.min(E.stock, 1 + Math.floor(Math.random() * 3));
        let pago = Math.max(1, Math.round(n * precio()));
        const vs = HR('vaso');
        if (Math.random() < vs.propina[0]) { const extra = Math.max(1, Math.round(pago * vs.propina[1])); pago += extra; texto(c.x, PISO - 222, '¡Propina +' + fmt(extra) + '!', '#c5e1a5', 18); }
        E.stock -= n; E.monedas += pago; E.stats.vasos += n; sumar('vende', n); xp(D.XP.vaso * n);
        texto(c.x, PISO - 190, '+' + fmt(pago), '#ffd54a', 26); particulas(c.x, PISO - 170, 6, '#ffd54a', { vel: 150, moneda: true }); son('moneda');
        c.est = 'va'; c.feliz = true;
      } else if (c.t > 8) { c.est = 'va'; texto(c.x, PISO - 190, '¡No hay chicha!', '#ffab91', 18); }
    } else c.x += 140 * dt;
  }
  clientes = clientes.filter(c => c.x < W + 60);
  // Jarra legendaria: al llenarse, se vende sola.
  if (HR('jarra').autoventa && E.stock >= capStock()) { const g = Math.round(E.stock * precio()); E.monedas += g; E.stats.vasos += E.stock; sumar('vende', E.stock); E.stock = 0; texto(W / 2 + 20, PISO - 120, 'Autoventa +' + fmt(g), '#ffd54a', 22); son('moneda'); }
  // oleadas
  proxOleada -= dt;
  if (proxOleada <= 0) {
    colaSpawn.push(...D.oleada(E.oleada)); proxOleada = D.OLEADA_SEG;
    if (E.oleada % 10 === 0) aviso('👑 ¡Llega el Rey de los Ladrones! Tócalo muchas veces.', 'err');
  }
  tSpawn -= dt;
  if (colaSpawn.length && tSpawn <= 0) { spawnDuende(colaSpawn.shift()); tSpawn = 0.9; if (!colaSpawn.length) { E.oleada++; E.stats.oleadas++; sumar('oleada'); } }
  // duendes
  const metaX = W / 2 + 10;
  for (const d of duendes) {
    if (d.muerto) continue;
    d.golpe = Math.max(0, d.golpe - dt);
    const def = D.DUENDES[d.k];
    if (d.huye) { d.x += d.vel * 1.15 * dt; continue; }
    const alcance = def.alcance || 0;
    if (d.x > metaX + alcance) { if (d.golpe <= 0) d.x -= d.vel * dt; }
    else {
      d.robaT += dt;
      if (d.robaT > (alcance ? 1.5 : 0.4)) {
        let n = Math.min(def.roba + Math.floor(E.oleada / 5), E.stock);
        if (n > 0) E.stock -= n;
        else { const o = E.ollas.find((oo, i) => i < nOllas() && oo.lista); if (o) { n = def.roba; o.lista = false; o.fin = 0; } }
        d.lleva = n; d.huye = true;
        if (n > 0) { texto(d.x, d.y - 120, '-' + n + ' vasos', '#ff5252', 22); pose('susto', 0.8); son('robo'); vibrar(40); }
        else texto(d.x, d.y - 120, '¡Nada!', '#bdbdbd', 18);
      }
    }
  }
  duendes = duendes.filter(d => !d.muerto && d.x < W + 80);
  // ayudante con honda
  if (ayud().golpe) { ayudT -= dt; if (ayudT <= 0) { ayudT = 2; const d = duendes.filter(dd => !dd.muerto).sort((a, b) => a.x - b.x)[0]; if (d) { particulas(d.x, d.y - 60, 4, '#9e9e9e', { vel: 90 }); golpear(d, ayud().golpe); } } }
  // particulas y textos
  for (const p of parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  parts = parts.filter(p => p.t < p.vida);
  for (const tx of textos) tx.t += dt;
  textos = textos.filter(tx => tx.t < 1.1);
  pintarHud();
}
function dibujar() {
  x.setTransform(lienzo.width / W, 0, 0, lienzo.height / H, 0, 0);
  const noche = new Date().getHours() >= 19 || new Date().getHours() < 6;
  A.fondo(x, W, H, PISO, T, noche, E.nv.toldo);
  for (const c of clientes) A.cliente(x, c.x, PISO - 20, 0.85, c.i, T, c.est !== 'espera', c.feliz);
  A.mostrador(x, W, PISO);
  A.estante(x, W / 2 + 20, PISO - 62, E.stock, capStock(), E.eq.jarra);
  A.VASO_SPR.k = 'vaso_' + (E.eq.vaso + 1);
  // cartel de la chicheria
  x.save(); x.font = '22px "Lilita One", system-ui'; x.textAlign = 'center'; x.fillStyle = '#fff3c4'; x.strokeStyle = '#3e2716'; x.lineWidth = 5;
  x.strokeText('CHICHA MORADA', W / 2, PISO - 268); x.fillText('CHICHA MORADA', W / 2, PISO - 268); x.restore();
  // ollas y fuegos
  for (let i = 0; i < nOllas(); i++) {
    const o = E.ollas[i], cocina = !!o.fin;
    if (!A.tieneSpr('olla_' + (E.nv.ollas[i] + 1))) A.fuego(x, xOlla(i), Y_OLLA + 30, 0.8, E.nv.fuego, T, cocina || o.lista);
    A.olla(x, xOlla(i), Y_OLLA + 6, 0.8, E.nv.ollas[i], cocina || o.lista ? 1 : 0, o.lista, T);
    if (cocina) {
      const k = 1 - (o.fin - Date.now()) / (segTanda() * 1000);
      x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.roundRect(xOlla(i) - 36, Y_OLLA - 124, 72, 10, 5); x.fill();
      x.fillStyle = hervor() ? '#7dd3fc' : '#d65caa'; x.beginPath(); x.roundRect(xOlla(i) - 35, Y_OLLA - 123, 70 * Math.max(0, Math.min(1, k)), 8, 4); x.fill(); x.restore();
      if (Math.random() < 0.25) parts.push({ x: xOlla(i) + azar(-20, 20), y: Y_OLLA - 50, vx: azar(-8, 8), vy: -40, g: -10, vida: 1.2, t: 0, r: azar(6, 12), color: 'rgba(255,255,255,.35)', vapor: true });
    } else if (!o.lista && E.maiz < maizOlla(i)) {
      x.save(); x.font = '15px "Lilita One", system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffab91'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText('Sin maíz', xOlla(i), Y_OLLA - 120); x.fillText('Sin maíz', xOlla(i), Y_OLLA - 120); x.restore();
    }
  }
  // personajes ordenados por profundidad
  const orden = [...duendes.filter(d => !d.muerto).map(d => ({ y: d.y, f: () => {
    A.duende(x, d.x, d.y, 0.8, d.k, T, { corre: !d.robaT || d.huye, lleva: d.lleva, golpe: d.golpe, huye: d.huye, var: d.var });
    const hb = A.altoDuende(d.k, 0.8) + 8;
    if (d.max > 1) { x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(d.x - 24, d.y - hb, 48, 6); x.fillStyle = '#ef5350'; x.fillRect(d.x - 24, d.y - hb, 48 * Math.max(0, d.vida / d.max), 6); }
  } })), { y: 590, f: () => (E.personaje === 'chichero' ? A.chichero : A.chichera)(x, 70, 590, 0.82, poseAct, T, { ...D.SKINS[E.skin[E.personaje]].paleta, filtro: D.SKINS[E.skin[E.personaje]].filtro }) }];
  if (E.nv.ayudante > 0 && A.tieneSpr('ayudante')) orden.push({ y: 455, f: () => A.personaAnimada(x, 'ayudante', W - 46, 455, 112, ayudT > 1.7 ? 'espanta' : 'quieta', T + 1.3) });
  orden.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const p of parts) {
    x.globalAlpha = Math.max(0, 1 - p.t / p.vida);
    if (p.moneda) { x.beginPath(); x.ellipse(p.x, p.y, p.r * 1.2, p.r * 1.2 * Math.abs(Math.cos(p.t * 12)), 0, 0, Math.PI * 2); x.fillStyle = p.color; x.fill(); x.strokeStyle = '#a66d00'; x.lineWidth = 1.5; x.stroke(); }
    else { x.beginPath(); x.arc(p.x, p.y, p.r * (p.vapor ? 1 + p.t : 1), 0, Math.PI * 2); x.fillStyle = p.color; x.fill(); }
  }
  x.globalAlpha = 1;
  for (const tx of textos) {
    const k = tx.t / 1.1;
    x.save(); x.globalAlpha = 1 - k * k; x.font = `${tx.tam * (k < 0.15 ? 0.6 + k * 2.7 : 1)}px "Lilita One", system-ui`; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#2a1712'; x.fillStyle = tx.color;
    x.strokeText(tx.txt, tx.x, tx.y - k * 50); x.fillText(tx.txt, tx.x, tx.y - k * 50); x.restore();
  }
  if (!E.elegido) return;
  // proxima oleada
  x.save(); x.font = '17px "Lilita One", system-ui'; x.textAlign = 'right'; x.lineWidth = 4; x.strokeStyle = '#000'; x.fillStyle = colaSpawn.length ? '#ff8a80' : '#fff';
  const tOl = colaSpawn.length ? '¡Oleada ' + E.oleada + '!' : 'Oleada ' + E.oleada + ' en ' + Math.ceil(proxOleada) + ' s';
  x.strokeText(tOl, W - 12, PISO + 24); x.fillText(tOl, W - 12, PISO + 24); x.restore();
}

// ── HUD ──
let hudPrev = '';
function pintarHud() {
  const nv = nivelPase(), k = (E.pase.xp % D.PASE.xpNivel) / D.PASE.xpNivel;
  const s = fmt(E.monedas) + '|' + fmt(E.maiz) + '|' + E.stock + '|' + nv + '|' + Math.round(k * 50) + '|' + tab;
  if (s === hudPrev) return; hudPrev = s;
  $('h-monedas').textContent = fmt(E.monedas); $('h-maiz').textContent = E.maiz >= 10000 ? Math.floor(E.maiz / 1000) + 'k' : fmt(E.maiz); $('h-vasos').textContent = E.stock;
  const mj = mejorAsequible(); document.querySelector('.tab[data-t="mejoras"]').classList.toggle('punto', !!mj && tab !== 'mejoras');
  $('h-pase').textContent = nv >= D.PASE.niveles ? 'MAX' : nv; $('h-pase-b').style.width = (nv >= D.PASE.niveles ? 100 : k * 100) + '%';
  if (tab === 'mejoras' || tab === 'cocina' || tab === 'mercado') pintarPanelSuave();
}
let avisoT = 0;
function aviso(t, tipo) {
  const el = document.createElement('div'); el.className = 'aviso ' + (tipo || ''); el.textContent = t;
  const caja = $('avisos'); caja.appendChild(el); while (caja.children.length > 2) caja.firstChild.remove();
  setTimeout(() => el.classList.add('fuera'), 2600); setTimeout(() => el.remove(), 3000);
}

// ── PANELES ──
let tab = 'cocina';
function marcarTab(id) { const b = document.querySelector(`.tab[data-t="${id}"]`); if (b && tab !== id) b.classList.add('punto'); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; b.classList.remove('punto'); document.querySelectorAll('.tab').forEach(o => o.classList.toggle('on', o === b)); son('tap'); pintarPanel(); if (tab === 'mercado' && NUBE.cuenta) cargarMercado(); });
let panelPrev = '';
function pintarPanelSuave() { const h = htmlPanel(); if (h !== panelPrev) { panelPrev = h; $('panel').innerHTML = h; } }
function pintarPanel() { panelPrev = htmlPanel(); $('panel').innerHTML = panelPrev; $('panel').scrollTop = 0; }
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
let subMej = 'herr';
function filaMejora(titulo, actual, sig, costo, act, datos, ico) {
  return `<div class="card">${ico.startsWith('<') ? ico : `<div class="ico">${ico}</div>`}<div class="tx"><b>${titulo}</b><small>${actual}</small>${sig ? `<small class="sig">→ ${sig}</small>` : '<small class="max">Nivel máximo</small>'}</div>${sig ? costoBtn(costo, act, datos) : ''}</div>`;
}
function htmlPanel() {
  if (tab === 'cocina') {
    let h = `<div class="resumen"><div><b>${E.stock}/${capStock()}</b><small>vasos en jarras</small></div><div><b>${fmt(E.maiz)} kg</b><small>maíz morado</small></div><div><b>${fmtP(precio())}</b><small>monedas por vaso</small></div></div>`;
    const mj = mejorAsequible(), sig = mejorasPosibles()[0];
    if (mj) h += `<div class="card mejora-ya">${imgCard(mj[4])}<div class="tx"><b>⬆ ¡Ya puedes mejorar!</b><small>${mj[1]}</small></div>${btn(`<span class="mon"></span>${fmt(mj[0])}`, mj[2], mj[3], false, 'oro')}</div>`;
    else if (sig) h += `<div class="card">${imgCard(sig[4])}<div class="tx"><b>Próxima mejora: ${sig[1]}</b><div class="barra"><i style="width:${Math.min(100, E.monedas / sig[0] * 100)}%"></i></div><small>${fmt(E.monedas)} / ${fmt(sig[0])} monedas</small></div>${btn('Ver todo', 'ir', { t: 'mejoras' })}</div>`;
    if (E.maiz < maizOlla(0) * 2) h += `<div class="card alerta"><div class="tx"><b>Te queda poco maíz morado</b><small>Sin maíz las ollas no cocinan. Cómpralo en el Mercado.</small></div>${btn('Comprar', 'ir', { t: 'mercado' })}</div>`;
    const rh = E.racha, cobr = rh.cobrado === rh.dia, dia = ((rh.n - 1) % 7);
    h += `<div class="card"><div class="ico">📅</div><div class="tx"><b>Racha: día ${rh.n}</b><small>${D.RACHA_MAIZ.includes(dia) ? (D.RACHA[dia]) + ' kg de maíz' : D.RACHA[dia] + ' monedas'} · vuelve mañana para el día ${rh.n + 1}</small></div>${btn(cobr ? '✓ Cobrado' : 'Cobrar', 'racha', {}, cobr, cobr ? '' : 'oro')}</div>`;
    h += `<div class="card">${imgCard('ico_fogata')}<div class="tx"><b>${D.FUEGOS[E.nv.fuego].nombre} · ${fmtP(segTanda())} s por tanda${hervor() ? ' · ¡Hervor Cósmico!' : ''}</b><small>${nOllas()} ${nOllas() > 1 ? 'ollas' : 'olla'} cocinando · ${D.RECETAS[E.nv.receta].nombre}</small></div></div>`;
    h += `<div class="consejo">Toca una olla que hierve para removerla y que esté antes. Toca a los duendes para espantarlos; si te roban, tócalos mientras huyen y recuperas los vasos.</div>`;
    return h;
  }
  if (tab === 'mejoras') {
    let h = `<div class="elige">${btn('Herramientas', 'subMej', { k: 'herr' }, false, subMej === 'herr' ? 'on' : '')}${btn('Puesto y ollas', 'subMej', { k: 'puesto' }, false, subMej === 'puesto' ? 'on' : '')}</div>`;
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
    h += m('ayudante', D.AYUDANTES, imgCard('ayudante'), c => c.golpe ? `recoge ollas y espanta (${c.golpe} de daño)` : c.recoge ? 'recoge las ollas listas' : 'nadie te ayuda', s => s.nombre);
    return h;
  }
  if (tab === 'misiones') {
    let h = '<div class="sub">Se renuevan a medianoche (hora de Perú)</div>';
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
    h += htmlCuenta();
    h += `<a class="card enlace" href="${D.WHATSAPP_CHICHA}" target="_blank" rel="noopener"><div class="ico">🥤</div><div class="tx"><b>¿Quieres chicha morada de verdad?</b><small>Pídela por WhatsApp al +51 916 778 731 (número oficial)</small></div></a>`;
    return h;
  }
  return '';
}
// Cambio a oro y mercado entre jugadores (necesitan la cuenta de Duende Quest).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function htmlCuenta() {
  let h = '';
  if (!NUBE.ok) return `<div class="card proximo"><div class="ico">☁</div><div class="tx"><b>Conectando con tu cuenta…</b><small>El cambio a oro y el mercado entre jugadores necesitan conexión.</small></div></div>`;
  if (!NUBE.cuenta) return `<a class="card enlace" href="/mmo/" target="_blank" rel="noopener"><div class="ico">👤</div><div class="tx"><b>Entra con tu cuenta de Duende Quest</b><small>Juegas como invitado. Con tu cuenta (correo o Telegram) guardas la partida en la nube, cambias monedas por oro de Duende Quest y usas el mercado entre jugadores.</small></div></a>`;
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
new MutationObserver(() => { document.querySelectorAll('canvas.mini').forEach(c => { if (c.dataset.ok) return; c.dataset.ok = 1; const g = c.getContext('2d'), s = D.SKINS[c.dataset.skin]; g.scale(0.4, 0.4); (s.para === 'chichero' ? A.chichero : A.chichera)(g, 112, 268, 1, 'quieta', 1, s.paleta); }); }).observe($('panel'), { childList: true });

$('panel').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-act],a[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act, d = b.dataset;
  if (a === 'mejora') {
    const k = d.k, lista = { olla: D.OLLAS, hornillas: D.HORNILLAS, fuego: D.FUEGOS, receta: D.RECETAS, cucharon: D.CUCHARONES, toldo: D.TOLDOS, ayudante: D.AYUDANTES }[k];
    const n = k === 'olla' ? E.nv.ollas[+d.i] : E.nv[k], s = lista[n + 1];
    if (!s || E.monedas < s.costo) return;
    E.monedas -= s.costo; if (k === 'olla') E.nv.ollas[+d.i]++; else E.nv[k]++;
    E.stats.mejoras++; sumar('mejora'); son('mejora'); pose('celebra', 1.2); aviso('✓ ' + (s.nombre || 'Mejora comprada'), 'ok');
  } else if (a === 'maiz') { const c = +d.c; if (E.monedas < c) return; E.monedas -= c; E.maiz += +d.kg; son('moneda'); aviso('🌽 +' + d.kg + ' kg de maíz morado', 'ok'); }
  else if (a === 'mision') { const m = E.mis.l[+d.i]; if (!m.hecho || m.cobrado) return; m.cobrado = true; const def = D.MISIONES.find(x => x.id === m.id); E.monedas += def.premio; xp(D.XP.mision); son('moneda'); }
  else if (a === 'racha') { const rh = E.racha; if (rh.cobrado === rh.dia) return; rh.cobrado = rh.dia; const dia = (rh.n - 1) % 7; if (D.RACHA_MAIZ.includes(dia)) E.maiz += D.RACHA[dia]; else E.monedas += D.RACHA[dia]; son('moneda'); aviso('📅 Premio del día ' + rh.n + ' cobrado', 'ok'); }
  else if (a === 'pase') {
    const n = +d.n, r = D.PREMIOS_PASE[n - 1], c = d.c, lista = c === 'g' ? E.pase.g : E.pase.p, p = c === 'g' ? r.gratis : r.premium;
    if (nivelPase() < n || lista.includes(n) || (c === 'p' && !E.pase.premium)) return;
    lista.push(n);
    if (p.tipo === 'monedas') E.monedas += p.n; else if (p.tipo === 'maiz') E.maiz += p.n; else if (!E.skins.includes(p.id)) { E.skins.push(p.id); aviso('👑 ¡Skin nueva: ' + D.SKINS[p.id].nombre + '! Póntela en «Skins».', 'ok'); }
    son('mejora');
  } else if (a === 'premium') { pedirPremium(); return; }
  else if (a === 'personaje') { E.personaje = d.k; son('tap'); }
  else if (a === 'skin') { E.skin[E.personaje] = d.id; son('mejora'); pose('celebra', 1); }
  else if (a === 'ir') { document.querySelector(`.tab[data-t="${d.t}"]`).click(); return; }
  else if (a === 'subMej') { subMej = d.k; pintarPanel(); return; }
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
    if (aplicar(r)) {
      son('mejora');
      aviso(a === 'cambiar' ? `✓ +${r.hecho.oro} oro en tu duende de Duende Quest` : a === 'vender' ? '✓ Publicado en el mercado' : a === 'comprar' ? '✓ Compra hecha' : a === 'retirar' ? '✓ Venta retirada' : '✓ ' + ((r.hecho && r.hecho.ok) || 'Hecho'), 'ok');
      guardar();
      if (a !== 'cambiar' && a !== 'darPase') await cargarMercado();
    }
  } finally { ocupado = false; pintarPanel(); pintarHud(); }
}
async function pedirPremium() {
  if (E.pase.premium) return;
  if (!NUBE.cuenta) { abrirModal(`<h2>★ Pase premium · S/ 10</h2><p>Duplica los premios de la temporada y trae skins exclusivas (Reina de la chicha, Pirata del Callao y Chichera dorada).</p><p>Para comprarlo necesitas entrar con tu cuenta de Duende Quest (correo o Telegram): así el pase queda guardado aunque cambies de celular.</p><p><a href="/mmo/" target="_blank" rel="noopener" style="color:#ffd166">Entrar o crear mi cuenta →</a></p>`); return; }
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
$('b-sonido').onclick = () => { E.sonido = !E.sonido; $('b-sonido').textContent = E.sonido ? '🔊' : '🔇'; guardar(); };
$('b-sonido').textContent = E.sonido ? '🔊' : '🔇';

function inicio() {
  if (!E.elegido) {
    abrirModal(`<div class="logo">CHICHA WARS</div><p>Prepara la mejor chicha morada del pueblo… y no dejes que los duendes te la roben.</p><p><b>¿Quién atiende el puesto?</b></p><div class="elige grande">${btn('Chichera', 'x', { k: 'chichera' }, false, 'on')}${btn('Chichero', 'x', { k: 'chichero' })}</div>`, { txt: '¡A cocinar!', f: () => { E.elegido = true; guardar(); aviso('Tus ollas ya están en el fuego: toca a los duendes cuando lleguen.', ''); } });
    $('modal-c').querySelectorAll('.elige .b').forEach(b => b.onclick = () => { E.personaje = b.dataset.k; $('modal-c').querySelectorAll('.elige .b').forEach(o => o.classList.toggle('on', o === b)); });
  } else if (vuelta) {
    abrirModal(`<h2>Mientras no estabas</h2><p>Tu puesto siguió abierto ${vuelta.min >= 60 ? Math.floor(vuelta.min / 60) + ' h ' + (vuelta.min % 60) + ' min' : vuelta.min + ' min'}${vuelta.tope ? ` (tu Jarra guarda hasta ${vuelta.horas} h: mejórala para más)` : ''}.</p>
      <div class="resumen"><div><b>${vuelta.tandas}</b><small>tandas</small></div><div><b>${vuelta.vendidos}</b><small>vasos vendidos</small></div><div><b>+${fmt(vuelta.ganado)}</b><small>monedas</small></div></div>
      ${vuelta.sinMaiz ? '<p class="alerta-t">Se te acabó el maíz morado: compra más en el Mercado.</p>' : ''}`, { txt: 'Cobrar', f: () => { son('moneda'); pose('celebra', 1.2); } });
  }
  pintarPanel(); pintarHud();
}

// ── TAMAÑO ──
function ajustar() {
  const r = lienzo.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  lienzo.width = Math.round(r.width * dpr); lienzo.height = Math.round(r.height * dpr);
}
addEventListener('resize', ajustar); ajustar();
A.cargarSprites('/assets/chicha-wars/').then(n => { if (n) console.info('[CW] sprites del dueño:', n); });
if (document.fonts && document.fonts.load) document.fonts.load('20px "Lilita One"').catch(() => {});
inicio();
requestAnimationFrame(cuadro);
bajar();
// Para pruebas (consola): __cw.avanzar(segundos) corre el juego sin esperar.
window.__cw = { E, get duendes() { return duendes; }, avanzar(seg) { for (let i = 0; i < seg * 20; i++) { T += 0.05; logica(0.05); } dibujar(); }, oleadaYa() { proxOleada = 0.01; } };
