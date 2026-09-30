// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — cliente
// Dibuja el mundo, mueve al propio duende (respuesta inmediata) y le habla al
// servidor (functions/mmo/world.js) por WebSocket. Todo lo que da o quita
// algo (daño, oro, experiencia, compras) lo decide el servidor.
// ═══════════════════════════════════════════════════════
import {
  VH, SUELO, FIS, HOJAS, MONSTRUOS, MAPAS, SKINS, ARMAS, PODERES, ATAQUE_CD_MS, MISIONES,
  statsMonstruo, sueloEn, zonaDe,
} from './data.js';

const $ = id => document.getElementById(id);
const A = '/assets/';
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
if (TG) {
  try { TG.ready(); TG.expand(); TG.disableVerticalSwipes && TG.disableVerticalSwipes(); TG.setHeaderColor && TG.setHeaderColor('#0a0418'); } catch (e) {}
  // Dentro de Telegram, "volver" lleva al hub de la Mini App, no a la web.
  const volver = () => { location.href = '/telegram/index.html' + (location.hash || ''); };
  try { TG.BackButton.show(); TG.BackButton.onClick(volver); } catch (e) {}
  const casa = document.querySelector('#botones a[href="/game.html"]');
  if (casa) casa.href = '/telegram/index.html' + (location.hash || '');
}

const TACTIL = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (TACTIL) document.body.classList.add('tactil');

// ── VISTA ──
// En vertical (movil) la vista es casi cuadrada: se ve menos mapa a los lados
// pero todo se dibuja mas grande. El alto logico no cambia (el mapa no tiene
// scroll vertical).
// En vertical, ademas, la vista crece hacia arriba (OY px de cielo extra)
// para llenar la pantalla del telefono en vez de dejar franjas vacias: el
// mundo sigue midiendo 450 de alto y se dibuja desplazado OY hacia abajo.
let VW = 800, OY = 0;
const cv = $('gc');
const g = cv.getContext('2d');
if (TACTIL) {
  const f1 = $('t-fila1');
  f1.insertBefore($('interactuar'), f1.firstChild);
  f1.insertBefore($('poderes'), f1.firstChild);
}
function ajustarVista() {
  const vertical = innerHeight > innerWidth * 1.1;
  VW = vertical ? 400 : 800;
  const esc = $('escena');
  const aw = esc.clientWidth, ah = esc.clientHeight;
  OY = vertical ? Math.max(0, Math.min(330, Math.floor(ah / (aw / VW)) - VH)) : 0;
  cv.width = VW; cv.height = VH + OY;
  g.imageSmoothingEnabled = false;
  const k = Math.min(aw / VW, ah / (VH + OY));
  const w = Math.floor(VW * k), h = Math.floor((VH + OY) * k);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const hud = $('hud');
  hud.style.left = ((aw - w) / 2) + 'px'; hud.style.top = ((ah - h) / 2) + 'px';
  hud.style.width = w + 'px'; hud.style.height = h + 'px';
  hud.style.right = 'auto'; hud.style.bottom = 'auto';
}
addEventListener('resize', ajustarVista);

// ── ASSETS ──
const IMG = {};
let porCargar = 0, cargadas = 0;
function cargar(k, src) {
  porCargar++;
  const im = new Image();
  im.onload = im.onerror = () => { cargadas++; pintarCarga(); };
  im.src = src;
  IMG[k] = im;
}
function pintarCarga() {
  const p = porCargar ? cargadas / porCargar : 1;
  $('carga-i').style.width = Math.round(p * 100) + '%';
}
Object.keys(HOJAS).forEach(k => cargar('sh_' + k, A + 'enemigos/sheets/' + k + '.png'));
['skin_hero', 'skin_tactico', 'skin_necromancer', 'skin_king', 'skin_berserker', 'skin_legendariafull'].forEach(k => cargar(k, A + 'skins/' + k + '.png'));
cargar('anim', A + 'skins/duende_anim.png');
[...new Set(Object.values(MAPAS).map(m => m.fondo))].forEach(f => { cargar('lejos_' + f, A + 'fondos/' + f + '_lejos.png'); cargar('cerca_' + f, A + 'fondos/' + f + '_cerca.png'); });
['item_potion', 'item_shield', 'item_skill', 'skill_fire'].forEach(k => cargar(k, A + 'items/' + k + '.png'));
cargar('katana_comun', A + 'armas/katana_comun_item.png');
cargar('katana_spark', A + 'armas/katana_spark_item.png');
cargar('coin', A + 'ui/coin.png');
const FX = { corte_h: [65, 40, 5, 2], corte_arriba: [52, 56, 5, 2], corte_giro: [52, 48, 6, 2], muerte: [64, 64, 8, 3], rayo: [128, 96, 9, 2] };
Object.keys(FX).forEach(k => cargar('fx_' + k, A + 'fx/' + k + '.png'));
let ANIM = null;
fetch(A + 'skins/duende_anim.json').then(r => r.json()).then(d => { ANIM = d; }).catch(() => {});
const ANIM_IDX = { reposo: [1, 2, 3], camina: [4, 5, 6, 7, 8, 9], ataca: [10, 11, 12, 13, 14], herido: [15, 16, 17] };

// Copias teñidas en cache (mismo truco que el arcade: tiñe sin perder volumen).
const _tinte = new Map();
function tenido(k, hex) {
  const key = k + hex;
  if (_tinte.has(key)) return _tinte.get(key);
  const src = IMG[k];
  if (!src || !src.naturalWidth) return src;
  const c = document.createElement('canvas');
  c.width = src.naturalWidth; c.height = src.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .45; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(src, 0, 0);
  _tinte.set(key, c);
  return c;
}
function blanco(k) { return tenido(k, '#ffffff'); }

// ── SONIDO ──
let sonido = localStorage.getItem('dq_mmo_sonido') !== '0';
const SFX = {};
['corte', 'corte2', 'golpe', 'muerte', 'moneda', 'salto', 'caida', 'boton', 'explosion'].forEach(k => {
  SFX[k] = { pool: [0, 1, 2].map(() => { const a = new Audio('/audio/sfx/' + k + '.ogg'); a.preload = 'auto'; a.volume = .45; return a; }), i: 0 };
});
function sfx(k, vol) {
  if (!sonido || !SFX[k]) return;
  const s = SFX[k]; const a = s.pool[s.i]; s.i = (s.i + 1) % s.pool.length;
  try { a.currentTime = 0; a.volume = vol || .45; a.play().catch(() => {}); } catch (e) {}
}
const musica = new Audio('/audio/bg_music.ogg'); musica.loop = true; musica.volume = .25;
function pintarSonido() { $('b-sonido').textContent = sonido ? '🔊' : '🔇'; }
$('b-sonido').onclick = () => {
  sonido = !sonido; localStorage.setItem('dq_mmo_sonido', sonido ? '1' : '0'); pintarSonido();
  if (sonido) musica.play().catch(() => {}); else musica.pause();
};
pintarSonido();

// ── ESTADO ──
let ws = null, miId = 0, yo = null, mapaId = 'pueblo', conectado = false, reintentos = 0, fatal = false;
const otros = new Map();   // id -> jugador remoto
const mons = new Map();    // id -> monstruo
let textos = [], parts = [], efectos = [], burbujas = new Map(), monedas = [];
let jefeVivo = null;
const cdPoder = {};        // id -> ms fin
let frame = 0;

// Jugador local
const P = {
  x: 950, y: SUELO, vx: 0, vy: 0, suelo: true, saltos: 0, f: 1,
  dash: 0, dashCd: 0, atk: 0, paso: 0, comboT: 0, atkCdHasta: 0, herido: 0, muerto: false,
  hp: 100, maxHp: 100, escudo: false, fuego: false,
};
let camX = 0;

// ── RED ──
function urlWs() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mmo/ws'; }
function mandar(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

async function autenticacion() {
  if (TG) return { auth: { k: 'tg', d: TG.initData } };
  const tok = await tokenWeb();
  if (tok) return { auth: { k: 'web', tok } };
  let inv = localStorage.getItem('dq_mmo_tok');
  if (!/^[a-f0-9]{32}$/.test(inv || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    inv = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('dq_mmo_tok', inv);
  }
  return { auth: { k: 'inv', tok: inv }, nombre: localStorage.getItem('dq_mmo_nombre') || '' };
}

let _sb = null;
async function tokenWeb() {
  try {
    if (!window.supabase || !window.SUPABASE_URL) return null;
    _sb = _sb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data } = await _sb.auth.getSession();
    return data?.session?.access_token || null;
  } catch (e) { return null; }
}

async function conectar() {
  if (ws && ws.readyState <= 1) return;
  const hola = await autenticacion();
  ws = new WebSocket(urlWs());
  ws.onopen = () => { conectado = true; reintentos = 0; mandar({ t: 'hola', ...hola }); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } recibir(m); };
  ws.onclose = () => {
    conectado = false;
    if (fatal) return;
    if (reintentos++ < 6) setTimeout(conectar, Math.min(8000, 600 * reintentos));
    else mostrarError('Se perdió la conexión con el servidor.');
  };
}

function recibir(m) {
  switch (m.t) {
    case 'bienvenido':
      miId = m.id; yo = m.yo; online = m.on || 0;
      $('m-inicio').classList.remove('on');
      pintarHud();
      if (m.nuevo) aviso('¡Bienvenido, ' + yo.nombre + '! Habla con el Guardia Tito si necesitas ayuda.');
      if (m.regaladas && m.regaladas.length) aviso('🎁 Skins de tu cuenta desbloqueadas: ' + m.regaladas.map(k => SKINS[k].nombre).join(', '), 'ok');
      break;
    case 'mapa': entrarMapa(m); break;
    case 'yo': {
      const antes = yo; yo = m.yo;
      if (yo.muerto && !(antes && antes.muerto)) morir();
      if (!yo.muerto) $('m-muerte').classList.remove('on');
      pintarHud(); if ($('m-tienda').classList.contains('on')) pintarTienda(); if ($('m-inv').classList.contains('on')) pintarInventario();
      if ($('m-mision').classList.contains('on')) pintarMision();
      break;
    }
    case 's': snapshot(m); break;
    case 'pj': agregarOtro(m.p); break;
    case 'pl': otros.delete(m.id); break;
    case 'ms': agregarMon(m.m); break;
    case 'md': {
      const o = mons.get(m.id);
      if (o) { o.muereT = performance.now(); o.st = 2; lanzarFX('muerte', o.x, o.y - o.alto * .45, o.alto / 60, false); sfx('muerte', .35); }
      if (o && MONSTRUOS[o.k].jefe) jefeVivo = null;
      break;
    }
    case 'at': ataqueRemoto(m); break;
    case 'gana':
      for (let i = 0; i < Math.min(8, 2 + Math.floor(m.oro / 15)); i++) monedas.push({ x: m.x, y: m.y + 20, vx: (Math.random() - .5) * 5, vy: -4 - Math.random() * 3, t: 0 });
      flotante(m.x, m.y, '+' + m.xp + ' XP', '#00ff88', 10);
      flotante(m.x, m.y + 14, '+' + m.oro + ' oro', '#ffe600', 10);
      if (m.drops && m.drops.length) m.drops.forEach(d => { const pd = PODERES.find(p => p.id === d); if (pd) aviso('🎁 Encontraste: ' + pd.nombre, 'ok'); });
      sfx('moneda', .3);
      break;
    case 'ph': {
      if (m.p === miId) {
        P.herido = 18; sfx('golpe', .45); flotante(P.x, P.y - 70, '-' + m.d, '#ff3344', 11);
        // Retroceso: el golpe te aparta del monstruo (y corta el combo de pegado).
        const o = mons.get(m.from);
        if (o) { P.vx = (P.x < o.x ? -1 : 1) * 7; if (P.suelo) { P.vy = -4; P.suelo = false; } }
        sacudir = Math.max(sacudir, 4);
        if (TG && TG.HapticFeedback) try { TG.HapticFeedback.impactOccurred('medium'); } catch (e) {}
      }
      else { const o = otros.get(m.p); if (o) { o.herido = 18; flotante(o.x, o.y - 70, '-' + m.d, '#ff7777', 9); } }
      break;
    }
    case 'pm': if (m.p !== miId) { const o = otros.get(m.p); if (o) o.muerto = true; } break;
    case 'lv': {
      const quien = m.p === miId ? P : otros.get(m.p);
      if (quien) {
        for (let i = 0; i < 40; i++) particula(quien.x, quien.y - 30, ['#ffe600', '#00ff88', '#ff3cf0'][i % 3], 5);
        flotante(quien.x, quien.y - 95, '¡NIVEL ' + m.lv + '!', '#ffe600', 14);
      }
      if (m.p === miId) { aviso('⬆️ ¡Subiste a nivel ' + m.lv + '!', 'ok'); sfx('explosion', .4); }
      else if (quien) quien.lv = m.lv;
      break;
    }
    case 'pa': { const o = otros.get(m.p); if (o) { o.sk = m.sk; o.ar = m.ar; o.mx = m.mx; } break; }
    case 'pw': efectoPoder(m.p, m.i); break;
    case 'cd': cdPoder[m.id] = performance.now() + m.hasta; break;
    case 'chat': lineaChat(m.n, m.m, m.p); burbujas.set(m.p, { txt: m.m, hasta: performance.now() + 5000 }); break;
    case 'on': online = m.n; pintarSubMapa(); break;
    case 'toast': aviso(m.m, m.ok ? 'ok' : ''); break;
    case 'aviso': aviso(m.m, 'jefe'); lineaChat(null, m.m); break;
    case 'snap': P.x = m.x; P.y = m.y; P.vx = 0; P.vy = 0; break;
    case 'ranking': pintarRanking(m.r); break;
    case 'err':
      if (m.fatal) { fatal = true; mostrarError(m.m); }
      else aviso(m.m);
      break;
  }
}

function entrarMapa(m) {
  mapaId = m.mapa;
  otros.clear(); mons.clear(); efectos = []; textos = []; burbujas.clear(); jefeVivo = null;
  P.x = m.x; P.y = SUELO; P.vx = 0; P.vy = 0; P.suelo = true;
  m.jugadores.forEach(agregarOtro);
  m.mons.forEach(agregarMon);
  const mp = MAPAS[mapaId];
  $('h-mapa').textContent = mp.nombre;
  pintarSubMapa();
  camX = Math.max(0, Math.min(mp.ancho - VW, P.x - VW / 2));
  $('carga').style.display = 'none';
  aviso('📍 ' + mp.nombre);
}

let online = 0;
function pintarSubMapa() {
  const mp = MAPAS[mapaId];
  const base = mp.zona ? 'Nivel ' + mp.nv[0] + '-' + mp.nv[1] : 'Zona segura';
  $('h-mapa-sub').textContent = base + (online ? ' · 👥 ' + online + ' en línea' : '');
}

function agregarOtro(p) {
  if (p.id === miId) return;
  otros.set(p.id, { id: p.id, n: p.n, lv: p.lv, sk: p.sk, ar: p.ar, x: p.x, y: p.y, f: p.f, a: 0, hp: p.hp, mx: p.mx, muerto: p.muerto, buf: [{ t: performance.now(), x: p.x, y: p.y }], herido: 0, atk: 0, paso: 0 });
}

function agregarMon(d) {
  const st = statsMonstruo(d.k);
  const o = { id: d.id, k: d.k, x: d.x, y: d.y, f: d.f, hp: d.hp, mx: d.mx, st: d.st, alto: st.alto, w: st.w, h: st.h, buf: [{ t: performance.now(), x: d.x, y: d.y }], nace: performance.now(), muereT: 0, golpeT: 0 };
  mons.set(d.id, o);
  if (MONSTRUOS[d.k].jefe) jefeVivo = o;
}

function snapshot(m) {
  const t = performance.now();
  for (const r of m.p) {
    const [id, x, y, f, a, hp, mx, fl] = r;
    if (id === miId) {
      P.hp = hp; P.maxHp = mx; P.escudo = !!(fl & 1); P.fuego = !!(fl & 2);
      continue;
    }
    const o = otros.get(id);
    if (!o) continue;
    o.buf.push({ t, x, y }); if (o.buf.length > 4) o.buf.shift();
    o.f = f; o.a = a; o.hp = hp; o.mx = mx; o.escudo = !!(fl & 1); o.fuego = !!(fl & 2); o.muerto = !!(fl & 4);
  }
  const vistos = new Set();
  for (const r of m.m) {
    const [id, x, y, f, st, hp] = r;
    vistos.add(id);
    const o = mons.get(id);
    if (!o) continue;
    o.buf.push({ t, x, y }); if (o.buf.length > 4) o.buf.shift();
    o.f = f; if (hp < o.hp) o.golpeT = t; o.hp = hp;
    if (st === 2 && !o.muereT) o.muereT = t;
    o.st = st;
  }
  for (const [id, o] of mons) if (!vistos.has(id) && (!o.muereT || t - o.muereT > 2000)) mons.delete(id);
  if (jefeVivo && !mons.has(jefeVivo.id)) jefeVivo = null;
}

// Posicion interpolada ~110 ms en el pasado: los otros se ven suaves aunque
// el servidor solo mande 10 fotos por segundo.
function interpolar(o) {
  const t = performance.now() - 110;
  const b = o.buf;
  if (b.length === 1 || t <= b[0].t) { o.x = b[0].x; o.y = b[0].y; return; }
  for (let i = b.length - 1; i > 0; i--) {
    if (t >= b[i - 1].t) {
      const a = b[i - 1], c = b[i];
      const k = Math.min(1, (t - a.t) / Math.max(1, c.t - a.t));
      o.x = a.x + (c.x - a.x) * k; o.y = a.y + (c.y - a.y) * k;
      return;
    }
  }
}

function ataqueRemoto(m) {
  const quien = m.p === miId ? P : otros.get(m.p);
  if (m.p !== miId && quien && m.s >= 0) {
    quien.atk = 14; quien.paso = m.s; quien.f = m.f;
    lanzarFX(['corte_h', 'corte_arriba', 'corte_giro'][m.s], quien.x + m.f * 42, quien.y - 32, 1.05, m.f < 0, false, colorCorte(quien.sk));
  }
  for (const [id, dmg, tipo] of m.h) {
    const o = mons.get(id);
    if (!o) continue;
    o.golpeT = performance.now();
    const col = tipo === 1 ? '#ff9900' : tipo === 2 ? '#00eeff' : tipo === 3 ? '#ff3cf0' : '#ffffff';
    flotante(o.x + (Math.random() - .5) * 16, o.y - o.alto - 6, (tipo === 1 ? '¡' : '') + dmg + (tipo === 1 ? '!' : ''), col, tipo === 1 ? 13 : 10);
    for (let i = 0; i < 6; i++) particula(o.x, o.y - o.alto / 2, col, 3);
    if (tipo === 2 && m.s !== -1) lanzarFX('rayo', o.x, o.y - o.alto / 2, .5, false);
  }
  if (m.h.length && m.p === miId) sfx('golpe', .35);
}

function efectoPoder(pid, i) {
  const quien = pid === miId ? P : otros.get(pid);
  if (!quien) return;
  const colores = ['#00ff88', '#00eeff', '#00eeff', '#ff6400'];
  for (let k = 0; k < 24; k++) particula(quien.x, quien.y - 30, colores[i], 5);
  if (i === 2) { lanzarFX('rayo', quien.x, quien.y - 60, 2.2, false); sfx('explosion', .5); if (pid === miId) sacudir = 10; }
  if (i === 0 && pid === miId) flotante(P.x, P.y - 80, '+HP', '#00ff88', 11);
}

// ── JUGADOR LOCAL ──
const teclas = {};
let tIzq = false, tDer = false;
let enviadoT = 0, ultimoEnviado = '';
let sacudir = 0;

function fisica() {
  if (!yo || P.muerto) return;
  const mp = MAPAS[mapaId];
  const izq = teclas.ArrowLeft || teclas.KeyA || tIzq;
  const der = teclas.ArrowRight || teclas.KeyD || tDer;
  let obj = 0;
  if (izq) obj -= FIS.vel; if (der) obj += FIS.vel;
  if (obj) P.f = obj > 0 ? 1 : -1;
  if (P.dash > 0) { P.dash--; P.vx = P.f * FIS.dashVel; }
  else P.vx += (obj - P.vx) * .3;
  if (P.dashCd > 0) P.dashCd--;
  P.vy += FIS.grav; if (P.vy > 16) P.vy = 16;
  const antesY = P.y;
  P.x = Math.max(12, Math.min(mp.ancho - 12, P.x + P.vx));
  P.y += P.vy;
  const piso = sueloEn(mp, P.x, antesY, P.vy >= 0);
  if (P.y >= piso && antesY <= piso + 1 && P.vy >= 0) {
    if (!P.suelo && P.vy > 6) sfx('caida', .2);
    P.y = piso; P.vy = 0; P.suelo = true; P.saltos = 0;
  } else if (P.y < piso) P.suelo = false;
  if (P.y > SUELO) { P.y = SUELO; P.vy = 0; P.suelo = true; P.saltos = 0; }
  if (P.atk > 0) P.atk--;
  if (P.comboT > 0) P.comboT--;
  if (P.herido > 0) P.herido--;

  // Enviar posicion (hasta ~12 veces por segundo, solo si cambio).
  const ahora = performance.now();
  const est = !P.suelo ? 2 : P.atk > 0 ? 3 : Math.abs(P.vx) > .5 ? 1 : 0;
  const clave = Math.round(P.x) + ',' + Math.round(P.y) + ',' + P.f + ',' + est;
  if (ahora - enviadoT > 80 && clave !== ultimoEnviado) {
    mandar({ t: 'mv', x: Math.round(P.x), y: Math.round(P.y), f: P.f, a: est });
    enviadoT = ahora; ultimoEnviado = clave;
  }
}

function saltar() {
  if (!yo || P.muerto || chatAbierto()) return;
  if (P.suelo) { P.vy = FIS.salto; P.suelo = false; P.saltos = 1; sfx('salto', .3); }
  else if (P.saltos < 2) { P.vy = FIS.dobleSalto; P.saltos = 2; sfx('salto', .25); for (let i = 0; i < 8; i++) particula(P.x, P.y, '#c084fc', 3); }
}
function dash() {
  if (!yo || P.muerto || P.dashCd > 0) return;
  P.dash = FIS.dashT; P.dashCd = FIS.dashCd;
  for (let i = 0; i < 10; i++) particula(P.x - P.f * 10, P.y - 25, '#00eeff', 3);
}
function atacar() {
  if (!yo || P.muerto || chatAbierto()) return;
  const ahora = performance.now();
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  if (ahora < P.atkCdHasta) return;
  P.paso = P.comboT > 0 ? (P.paso + 1) % 3 : 0;
  P.comboT = 40;
  P.atk = 14;
  P.atkCdHasta = ahora + ATAQUE_CD_MS * arma.cd;
  mandar({ t: 'atk', s: P.paso });
  const tipo = ['corte_h', 'corte_arriba', 'corte_giro'][P.paso];
  const esc = (arma.alcance || 1) * (P.paso === 2 ? 1.25 : 1.05);
  lanzarFX(tipo, P.x + P.f * 40 * arma.alcance, P.y - 32, esc, P.f < 0, true, colorCorte(yo.skin));
  sfx(P.paso === 1 ? 'corte2' : 'corte', .35);
}
function usarPoder(i) {
  if (!yo || P.muerto) return;
  mandar({ t: 'pw', i });
}
function colorCorte(skin) { return (SKINS[skin] && skin !== 'comun') ? SKINS[skin].color : null; }

// Portales / NPCs cercanos
function cercano() {
  const mp = MAPAS[mapaId];
  for (let i = 0; i < mp.portales.length; i++) if (Math.abs(P.x - mp.portales[i].x) < 70) return { tipo: 'portal', i, p: mp.portales[i] };
  for (const n of (mp.npcs || [])) if (Math.abs(P.x - n.x) < 90) return { tipo: 'npc', n };
  return null;
}
function interactuar() {
  if (!yo || P.muerto) return;
  const c = cercano();
  if (!c) return;
  sfx('boton', .3);
  if (c.tipo === 'portal') { mandar({ t: 'portal', i: c.i }); }
  else if (c.n.tipo === 'tienda') abrirTienda();
  else if (c.n.tipo === 'ranking') abrirRanking();
  else abrirMision();
}

// ── ENTRADA ──
function chatAbierto() { return document.activeElement === $('chat-in'); }
addEventListener('keydown', e => {
  if (chatAbierto()) {
    if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) mandar({ t: 'chat', m: v }); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    return;
  }
  if (document.querySelector('.modal.on')) { if (e.key === 'Escape') cerrarModales(); return; }
  if (e.repeat && ['KeyZ', 'KeyJ'].indexOf(e.code) < 0) { teclas[e.code] = true; return; }
  teclas[e.code] = true;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); const c = cercano(); if (e.code !== 'Space' && c && c.tipo === 'portal') interactuar(); else saltar(); }
  if (e.code === 'KeyZ' || e.code === 'KeyJ') atacar();
  if (e.code === 'KeyX' || e.code === 'KeyK' || e.code === 'ShiftLeft') dash();
  if (e.code === 'KeyE') interactuar();
  if (e.code === 'KeyI') abrirInventario();
  if (e.code === 'Enter') { e.preventDefault(); abrirChat(); }
  if (/^Digit[1-4]$/.test(e.code)) usarPoder(+e.code.slice(5) - 1);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { teclas[e.code] = false; });
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; tIzq = tDer = false; });

function abrirChat() { const i = $('chat-in'); i.style.display = 'block'; i.focus(); }
function botonTactil(id, abajo, arriba) {
  const b = $(id);
  const on = e => { e.preventDefault(); b.classList.add('on'); abajo && abajo(); };
  const off = e => { e.preventDefault(); b.classList.remove('on'); arriba && arriba(); };
  b.addEventListener('touchstart', on, { passive: false });
  b.addEventListener('touchend', off, { passive: false });
  b.addEventListener('touchcancel', off, { passive: false });
  b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', e => { if (b.classList.contains('on')) off(e); });
}
botonTactil('t-l', () => { tIzq = true; }, () => { tIzq = false; });
botonTactil('t-r', () => { tDer = true; }, () => { tDer = false; });
let atkRepetir = null;
botonTactil('t-atk', () => { atacar(); atkRepetir = setInterval(atacar, 120); }, () => { clearInterval(atkRepetir); });
botonTactil('t-jump', saltar);
botonTactil('t-dash', dash);
botonTactil('t-chat', abrirChat);
$('interactuar').onclick = interactuar;
$('b-inv').onclick = abrirInventario;
$('b-rank').onclick = abrirRanking;
$('b-ayuda').onclick = () => abrir('m-ayuda');

// Poderes (HUD)
function pintarPoderes() {
  const cont = $('poderes');
  if (!cont.children.length) {
    PODERES.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'pw'; d.title = p.nombre + ' — ' + p.desc;
      d.innerHTML = `<span class="k">${i + 1}</span><img src="${A}items/${p.icono}.png" alt=""><span class="n">0</span><div class="cd" style="height:0"></div>`;
      d.addEventListener('click', () => usarPoder(i));
      d.addEventListener('touchstart', e => { e.preventDefault(); usarPoder(i); }, { passive: false });
      cont.appendChild(d);
    });
  }
  if (!yo) return;
  PODERES.forEach((p, i) => {
    const d = cont.children[i];
    const n = yo.pw[p.id] || 0;
    d.querySelector('.n').textContent = n;
    d.classList.toggle('vacio', n <= 0);
  });
}
function pintarCooldowns() {
  const cont = $('poderes'); if (!cont.children.length) return;
  const ahora = performance.now();
  PODERES.forEach((p, i) => {
    const fin = cdPoder[p.id] || 0;
    const k = fin > ahora ? (fin - ahora) / p.cd : 0;
    cont.children[i].querySelector('.cd').style.height = Math.round(k * 100) + '%';
  });
}

// ── EFECTOS ──
function flotante(x, y, txt, color, tam) { textos.push({ x, y, txt, color, tam: tam || 10, t: 0 }); if (textos.length > 80) textos.shift(); }
function particula(x, y, color, vel) {
  parts.push({ x, y, vx: (Math.random() - .5) * vel * 2, vy: (Math.random() - .8) * vel * 1.6, color, vida: 30 + Math.random() * 20, t: 0 });
  if (parts.length > 400) parts.shift();
}
function lanzarFX(tipo, x, y, escala, flip, sigue, tinte) {
  efectos.push({ tipo, x, y, escala, flip, sigue, tinte, t: 0, dx: sigue ? x - P.x : 0, dy: sigue ? y - P.y : 0 });
  if (efectos.length > 60) efectos.shift();
}

// ── DIBUJO ──
function dibujarCapa(img, desplaz, sobreSuelo) {
  if (!img || !img.naturalWidth) return;
  const e = VH / 320;
  const w = img.naturalWidth * e, h = img.naturalHeight * e;
  const y = SUELO - h + sobreSuelo * e;
  // Enteros y 1 px de solape: con coordenadas fraccionarias quedaba una
  // costura vertical visible entre mosaico y mosaico.
  let x = Math.floor(-((desplaz % w) + w) % w);
  const wi = Math.ceil(w), yi = Math.round(y), hi = Math.round(h);
  while (x < VW) { g.drawImage(img, x, yi, wi + 1, hi); x += wi; }
}

function dibujarFondo(mp) {
  const gr = g.createLinearGradient(0, -OY, 0, VH);
  gr.addColorStop(0, mp.paleta.cielo[0]); gr.addColorStop(1, mp.paleta.cielo[1]);
  g.fillStyle = gr; g.fillRect(0, -OY, VW, VH + OY);
  // Estrellas fijas (semilla por mapa).
  g.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 40 + Math.round(OY / 8); i++) {
    const sx = ((i * 137 + mapaId.length * 53) % 997) / 997 * VW;
    const sy = ((i * 71) % 211) / 211 * (200 + OY) - OY;
    const par = .5 + .5 * Math.sin(frame * .03 + i);
    g.globalAlpha = .2 + .4 * par; g.fillRect((sx - camX * .05 + VW * 4) % VW, sy, 2, 2);
  }
  g.globalAlpha = 1;
  dibujarCapa(IMG['lejos_' + mp.fondo], camX * .25, 46);
  dibujarCapa(IMG['cerca_' + mp.fondo], camX * .5, 16);
}

function dibujarSuelo(mp) {
  g.fillStyle = mp.paleta.suelo; g.fillRect(0, SUELO, VW, VH - SUELO);
  g.fillStyle = mp.paleta.linea; g.fillRect(0, SUELO, VW, 3);
  g.globalAlpha = .12;
  for (let x = -((camX * 1) % 40); x < VW; x += 40) g.fillRect(x, SUELO + 12, 20, 2);
  g.globalAlpha = 1;
  for (const [px, py, pw] of mp.plataformas) {
    const x = px - camX;
    if (x > VW || x + pw < 0) continue;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 3, py + 4, pw, 14);
    g.fillStyle = mp.paleta.suelo; g.fillRect(x, py, pw, 14);
    g.fillStyle = mp.paleta.linea; g.fillRect(x, py, pw, 3);
    g.globalAlpha = .3; g.fillRect(x, py + 14, pw, 2); g.globalAlpha = 1;
  }
}

function dibujarPortales(mp) {
  const cerca = cercano();
  mp.portales.forEach((p, i) => {
    const x = p.x - camX, y = SUELO - 48;
    if (x < -80 || x > VW + 80) return;
    g.save();
    g.translate(x, y);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = ['#c084fc', '#00eeff', '#ff3cf0'][k];
      g.lineWidth = 3; g.globalAlpha = .55;
      g.beginPath();
      g.ellipse(0, 0, 24 - k * 5, 44 - k * 8, 0, frame * .05 * (k % 2 ? -1 : 1) + k, frame * .05 * (k % 2 ? -1 : 1) + k + Math.PI * 1.5);
      g.stroke();
    }
    const rg = g.createRadialGradient(0, 0, 2, 0, 0, 40);
    rg.addColorStop(0, 'rgba(192,132,252,.55)'); rg.addColorStop(1, 'rgba(192,132,252,0)');
    g.fillStyle = rg; g.globalAlpha = .8 + Math.sin(frame * .08) * .2;
    g.beginPath(); g.ellipse(0, 0, 30, 50, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    const activo = cerca && cerca.tipo === 'portal' && cerca.i === i;
    etiqueta(x, y - 62, p.etiqueta + (p.nv ? ' · Nv ' + p.nv : ''), activo ? '#ffe600' : '#c084fc', 7);
  });
}

function etiqueta(x, y, txt, color, tam) {
  g.font = (tam || 7) + 'px "Press Start 2P", monospace';
  g.textAlign = 'center';
  const w = g.measureText(txt).width;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 4, y - (tam || 7) - 3, w + 8, (tam || 7) + 7);
  g.fillStyle = color || '#fff'; g.fillText(txt, x, y);
}

function dibujarHoja(k, hoja, fila, col, alto, x, y, f, alpha, tinte, blancoFlash) {
  let img = IMG['sh_' + k];
  if (!img || !img.naturalWidth) return;
  if (blancoFlash) img = blanco('sh_' + k); else if (tinte) img = tenido('sh_' + k, tinte);
  const e = alto / hoja.ideal;
  const dw = hoja.fw * e, dh = hoja.fh * e;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(f > 0 ? 1 : -1, 1);
  g.drawImage(img, col * hoja.fw, fila * hoja.fh, hoja.fw, hoja.fh, -dw / 2, -dh, dw, dh);
  g.restore();
}

function dibujarNPCs(mp) {
  const cerca = cercano();
  for (const n of (mp.npcs || [])) {
    const x = n.x - camX;
    if (x < -80 || x > VW + 80) continue;
    const hoja = HOJAS[n.hoja];
    sombra(x, SUELO, 20);
    const col = hoja.mov[1] + (Math.floor(frame / 14) % 2);
    dibujarHoja(n.hoja, hoja, hoja.mov[0], col, 62, x, SUELO + Math.sin(frame * .05) * 1, P.x > n.x ? 1 : -1, 1, null, false);
    const activo = cerca && cerca.tipo === 'npc' && cerca.n === n;
    etiqueta(x, SUELO - 72, n.nombre, activo ? '#ffe600' : '#00ff88', 7);
    if (n.tipo === 'tienda') { g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('🛒', x, SUELO - 90 + Math.sin(frame * .1) * 3); }
    if (n.tipo === 'ranking') { g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('🏆', x, SUELO - 90 + Math.sin(frame * .1) * 3); }
    if (n.tipo === 'guia') { g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('❔', x, SUELO - 90 + Math.sin(frame * .1) * 3); }
  }
}

function sombra(x, pies, ancho) {
  const k = 1 - Math.min(1, (SUELO - pies) / 140);
  if (k <= .05) return;
  g.save(); g.fillStyle = '#000'; g.globalAlpha = .35 * k;
  g.beginPath(); g.ellipse(x, sueloEn(MAPAS[mapaId], x + camX, pies, true) + 2, ancho * k, 5 * k, 0, 0, Math.PI * 2); g.fill(); g.restore();
}

function dibujarMonstruo(o) {
  interpolar(o);
  const x = o.x - camX;
  if (x < -150 || x > VW + 150) return;
  const def = MONSTRUOS[o.k];
  const hoja = HOJAS[def.hoja];
  const ahora = performance.now();
  let fila = hoja.mov[0], col = hoja.mov[1] + Math.floor(frame / 6) % hoja.mov[2], alpha = 1;
  const golpeado = ahora - o.golpeT < 260;
  if (o.muereT) {
    const k = Math.min(1, (ahora - o.muereT) / 1500);
    fila = hoja.golpe[0]; col = hoja.muerte[0] + Math.min(hoja.muerte[1] - 1, Math.floor(k * hoja.muerte[1]));
    alpha = 1 - k;
  } else if (golpeado || o.st === 3) {
    fila = hoja.golpe[0]; col = hoja.golpe[1] + Math.floor((ahora - o.golpeT) / 130) % hoja.golpe[2];
  }
  if (!def.vuela) sombra(x + camX - camX, o.y, o.w * .45);
  else sombra(x, o.y, o.w * .3);
  const nace = Math.min(1, (ahora - o.nace) / 400);
  const temblor = o.st === 3 ? (Math.random() - .5) * 5 : 0;
  if (def.jefe && !o.muereT) {
    // Aura de jefe
    g.save(); g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(x, o.y - o.alto / 2, 5, x, o.y - o.alto / 2, o.alto * .8);
    const c = o.st === 3 ? '255,60,60' : '255,60,240';
    rg.addColorStop(0, `rgba(${c},.28)`); rg.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = rg; g.fillRect(x - o.alto, o.y - o.alto * 1.4, o.alto * 2, o.alto * 1.6); g.restore();
  }
  dibujarHoja(def.hoja, hoja, fila, col, o.alto * (0.4 + 0.6 * nace), x + temblor, o.y, o.f, alpha * nace, def.tinte || (o.st === 3 ? '#ff3344' : null), golpeado && !o.muereT && (ahora - o.golpeT) < 70);
  if (o.muereT) return;
  // Vida y nivel
  if (!def.jefe) {
    const w = 40, y = o.y - o.alto - 12;
    if (o.hp < o.mx) {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle = '#ff3344'; g.fillRect(x - w / 2, y, w * Math.max(0, o.hp / o.mx), 4);
    }
    g.font = '6px "Press Start 2P", monospace'; g.textAlign = 'center';
    const dif = def.nivel - (yo ? yo.nivel : 1);
    g.fillStyle = dif >= 5 ? '#ff3344' : dif >= 2 ? '#ff9900' : dif <= -5 ? '#888' : '#fff';
    g.fillText('Nv' + def.nivel, x, y - 4);
  } else {
    etiqueta(x, o.y - o.alto - 10, '👑 ' + def.nombre, '#ff3cf0', 7);
  }
}

function dibujarDuende(q, esYo) {
  const x = q.x - camX, pies = q.y;
  if (x < -120 || x > VW + 120) return;
  const skin = esYo ? yo.skin : q.sk;
  const muerto = esYo ? P.muerto : q.muerto;
  const herido = (esYo ? P.herido : q.herido) > 0;
  const f = esYo ? P.f : q.f;
  const atk = esYo ? P.atk : q.atk;
  const anda = esYo ? Math.abs(P.vx) > .5 && P.suelo : q.a === 1;
  const enAire = esYo ? !P.suelo : q.a === 2;
  sombra(x, pies, 18);
  g.save();
  if (muerto) g.globalAlpha = .35;
  else if (herido && Math.floor(frame / 3) % 2) g.globalAlpha = .55;
  const escudo = esYo ? P.escudo : q.escudo;
  const fuego = esYo ? P.fuego : q.fuego;
  if (skin === 'legendaria' && !muerto) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(x, pies - 30, 4, x, pies - 30, 60);
    rg.addColorStop(0, 'rgba(255,60,240,.3)'); rg.addColorStop(1, 'rgba(255,60,240,0)');
    g.fillStyle = rg; g.fillRect(x - 60, pies - 90, 120, 120); g.restore();
  }
  if (skin === 'comun' && ANIM && IMG.anim.naturalWidth) {
    // Duende base: la hoja animada de verdad (reposo / caminar / atacar / herido).
    let lista = ANIM_IDX.reposo, vel = 14;
    if (atk > 0) { const t = 1 - atk / 14; lista = ANIM_IDX.ataca; }
    else if (herido) { lista = ANIM_IDX.herido; vel = 6; }
    else if (anda || enAire) { lista = ANIM_IDX.camina; vel = 5; }
    const idx = atk > 0 ? lista[Math.min(lista.length - 1, Math.floor((1 - atk / 14) * lista.length))] : lista[Math.floor(frame / vel) % lista.length];
    const [cw, ch] = ANIM.celda;
    const alto = FIS.jugH / (ANIM.altoDePie || 1);
    const ancho = alto * (cw / ch);
    g.translate(x, pies);
    if (f < 0) g.scale(-1, 1);
    g.drawImage(IMG.anim, idx * cw, 0, cw, ch, -ancho / 2, -alto, ancho, alto);
  } else {
    // Skins de pago: una sola imagen, animada por codigo (respira, rebota al
    // andar, se inclina al golpear) igual que en el arcade.
    const img = IMG[SKINS[skin] ? SKINS[skin].img : 'skin_hero'];
    if (img && img.naturalWidth) {
      const h = 66, w = Math.min(h * img.naturalWidth / img.naturalHeight, 110);
      const rebote = anda ? Math.abs(Math.sin(frame * .25)) * 4 : Math.sin(frame * .06) * 1.2;
      const incl = atk > 0 ? .18 : anda ? Math.sin(frame * .25) * .04 : 0;
      g.translate(x, pies - rebote);
      if (f < 0) g.scale(-1, 1);
      g.rotate(incl);
      const sq = enAire ? .06 : 0;
      g.drawImage(img, -w / 2, -h * (1 + sq), w, h * (1 + sq));
    }
  }
  g.restore();
  if (escudo) { g.save(); g.strokeStyle = '#00eeff'; g.globalAlpha = .6 + Math.sin(frame * .2) * .2; g.lineWidth = 2; g.beginPath(); g.ellipse(x, pies - 30, 30, 40, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
  if (fuego) { for (let i = 0; i < 2; i++) particula(q.x + (Math.random() - .5) * 20, pies - 20 - Math.random() * 30, Math.random() < .5 ? '#ff6400' : '#ffe600', 1.5); }
  // Nombre y nivel
  const nom = esYo ? yo.nombre : q.n, lv = esYo ? yo.nivel : q.lv;
  etiqueta(x, pies + 16, nom + ' · Nv' + lv, esYo ? '#ffe600' : (SKINS[skin] ? SKINS[skin].color : '#fff'), 6);
  if (!esYo && q.hp < q.mx) {
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 18, pies - 76, 36, 5);
    g.fillStyle = '#ff3344'; g.fillRect(x - 17, pies - 75, 34 * Math.max(0, q.hp / q.mx), 3);
  }
  const bb = burbujas.get(esYo ? miId : q.id);
  if (bb && performance.now() < bb.hasta) burbuja(x, pies - 82, bb.txt);
}

function burbuja(x, y, txt) {
  g.font = '11px system-ui, sans-serif';
  const lineas = [];
  let l = '';
  for (const p of txt.split(' ')) { if (g.measureText(l + ' ' + p).width > 150) { lineas.push(l); l = p; } else l = l ? l + ' ' + p : p; }
  if (l) lineas.push(l);
  const w = Math.min(160, Math.max(...lineas.map(s => g.measureText(s).width))) + 12;
  const h = lineas.length * 13 + 8;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h, w, h, 6) : g.rect(x - w / 2, y - h, w, h); g.fill();
  g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.fill();
  g.fillStyle = '#111'; g.textAlign = 'center';
  lineas.forEach((s, i) => g.fillText(s, x, y - h + 15 + i * 13));
}

function dibujarEfectos() {
  efectos = efectos.filter(f => {
    const [fw, fh, n, tpf] = FX[f.tipo];
    const img = f.tinte ? tenido('fx_' + f.tipo, f.tinte) : IMG['fx_' + f.tipo];
    const i = Math.floor(f.t / tpf);
    f.t++;
    if (i >= n) return false;
    if (!img || !img.width) return true;
    const x = (f.sigue ? P.x + f.dx : f.x) - camX, y = f.sigue ? P.y + f.dy : f.y;
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); if (f.flip) g.scale(-1, 1);
    g.drawImage(img, i * fw, 0, fw, fh, -fw * f.escala / 2, -fh * f.escala / 2, fw * f.escala, fh * f.escala);
    g.restore();
    return true;
  });
  parts = parts.filter(p => {
    p.t++; p.x += p.vx; p.y += p.vy; p.vy += .15; p.vx *= .97;
    if (p.t > p.vida) return false;
    g.globalAlpha = 1 - p.t / p.vida; g.fillStyle = p.color; g.fillRect(p.x - camX, p.y, 3, 3);
    return true;
  });
  g.globalAlpha = 1;
  // Monedas que saltan del monstruo y vuelan hacia el duende.
  monedas = monedas.filter(c => {
    c.t++;
    if (c.t > 22) { c.vx += (P.x - c.x) * .012; c.vy += ((P.y - 30) - c.y) * .012; c.vx *= .9; c.vy *= .9; }
    else { c.vy += .35; if (c.y > SUELO - 4) { c.y = SUELO - 4; c.vy *= -.45; } }
    c.x += c.vx; c.y += c.vy;
    if (c.t > 70 || (c.t > 22 && Math.hypot(P.x - c.x, P.y - 30 - c.y) < 14)) return false;
    const img = IMG.coin;
    if (img && img.naturalWidth) { const s = 11 * Math.abs(Math.cos(c.t * .25)) + 2; g.drawImage(img, c.x - camX - s / 2, c.y - 6, s, 12); }
    return true;
  });
  textos = textos.filter(t => {
    t.t++; t.y -= .7;
    if (t.t > 60) return false;
    g.globalAlpha = Math.min(1, (60 - t.t) / 20);
    g.font = t.tam + 'px "Press Start 2P", monospace'; g.textAlign = 'center';
    g.fillStyle = '#000'; g.fillText(t.txt, t.x - camX + 1, t.y + 1);
    g.fillStyle = t.color; g.fillText(t.txt, t.x - camX, t.y);
    return true;
  });
  g.globalAlpha = 1;
}

function dibujar() {
  const mp = MAPAS[mapaId];
  const objCam = Math.max(0, Math.min(mp.ancho - VW, P.x - VW / 2));
  camX += (objCam - camX) * .15;
  if (mp.ancho <= VW) camX = (mp.ancho - VW) / 2;
  g.save();
  g.translate(0, OY);
  if (sacudir > 0) { g.translate((Math.random() - .5) * sacudir, (Math.random() - .5) * sacudir); sacudir *= .85; if (sacudir < .5) sacudir = 0; }
  dibujarFondo(mp);
  dibujarSuelo(mp);
  dibujarPortales(mp);
  dibujarNPCs(mp);
  for (const o of mons.values()) dibujarMonstruo(o);
  for (const q of otros.values()) { interpolar(q); if (q.atk > 0) q.atk--; if (q.herido > 0) q.herido--; dibujarDuende(q, false); }
  if (yo) dibujarDuende(P, true);
  dibujarEfectos();
  g.restore();
  // Barra del jefe
  if (jefeVivo && !jefeVivo.muereT) {
    $('jefe-bar').style.display = 'block';
    $('jefe-n').textContent = '👑 ' + MONSTRUOS[jefeVivo.k].nombre + ' · Nv ' + MONSTRUOS[jefeVivo.k].nivel;
    $('jefe-bar').querySelector('i').style.width = Math.max(0, jefeVivo.hp / jefeVivo.mx * 100) + '%';
  } else $('jefe-bar').style.display = 'none';
  // Boton contextual
  const c = cercano();
  const bi = $('interactuar');
  // visibility y no display: en la barra tactil ocupa su hueco siempre, asi
  // los botones de al lado no saltan de sitio cada vez que aparece.
  bi.style.display = 'block';
  if (c && yo && !P.muerto) {
    bi.style.visibility = 'visible';
    bi.textContent = c.tipo === 'portal' ? (TACTIL ? '🚪 ENTRAR' : 'E · ENTRAR') : (TACTIL ? '💬 HABLAR' : 'E · HABLAR');
  } else bi.style.visibility = 'hidden';
}

// ── HUD ──
function pintarHud() {
  if (!yo) return;
  P.maxHp = yo.maxHp; P.hp = yo.hp; P.muerto = yo.muerto;
  $('h-nombre').textContent = yo.nombre;
  $('h-nivel').textContent = 'Nv ' + yo.nivel;
  $('h-oro').textContent = yo.oro.toLocaleString('es');
  const pxp = yo.xpSig ? Math.floor(yo.xp / yo.xpSig * 100) : 100;
  $('bxp').querySelector('i').style.width = pxp + '%';
  $('h-xp').textContent = 'XP ' + pxp + '%';
  const q = MISIONES[yo.mis ? yo.mis.i : 0];
  const hm = $('h-mision');
  if (!q) { hm.textContent = '📜 ¡Todas las misiones completas!'; hm.className = ''; }
  else {
    const lista = yo.mis.p >= q.n;
    hm.textContent = lista ? '📜 ' + q.nombre + ' ✓ — vuelve con Tito' : '📜 ' + q.nombre + ' ' + yo.mis.p + '/' + q.n;
    hm.className = lista ? 'lista' : '';
  }
  pintarPoderes();
}

// ── MISIONES ──
function abrirMision() { if (!yo) return; abrir('m-mision'); pintarMision(); }
function pintarMision() {
  const i = yo.mis ? yo.mis.i : 0, q = MISIONES[i];
  const cuerpo = $('mision-cuerpo');
  if (!q) { cuerpo.innerHTML = '<p class="centro">¡Completaste las ' + MISIONES.length + ' misiones! Eres una leyenda del Pueblo Duende. 👑</p>'; return; }
  const def = MONSTRUOS[q.tipo];
  const zona = MAPAS[zonaDe(q.tipo)];
  const lista = yo.mis.p >= q.n;
  const extra = q.pw ? ' · ' + Object.entries(q.pw).map(([k, v]) => v + ' ' + PODERES.find(p => p.id === k).nombre).join(', ') : '';
  const pide = def.jefe ? 'Participa en la caída de <b style="display:inline;color:#fff">' + esc(def.nombre) + '</b>' : 'Derrota ' + q.n + ' × <b style="display:inline;color:#fff">' + esc(def.nombre) + '</b>';
  cuerpo.innerHTML =
    '<p>Misión ' + (i + 1) + ' de ' + MISIONES.length + '</p>' +
    '<div class="mis-caja"><b>' + esc(q.nombre) + '</b>' +
    '<p>' + pide + ' en ' + esc(zona ? zona.nombre : '?') + ' (Nv ' + def.nivel + ').</p>' +
    '<div class="mis-barra"><i style="width:' + Math.round(yo.mis.p / q.n * 100) + '%"></i></div>' +
    '<p>' + yo.mis.p + ' / ' + q.n + '</p>' +
    '<p style="color:#ffe600">Recompensa: +' + q.xp + ' XP · +' + q.oro + ' oro' + esc(extra) + '</p></div>' +
    (lista ? '<button class="btn" id="b-entregar" style="width:100%;padding:12px">✅ ENTREGAR MISIÓN</button>' : '<p class="centro">Vuelve cuando la termines.</p>');
  const b = $('b-entregar');
  if (b) b.onclick = () => { sfx('boton', .3); mandar({ t: 'mision' }); };
}

// ── MINIMAPA ──
const mini = $('mini'), mg = mini.getContext('2d');
function dibujarMinimapa() {
  const mp = MAPAS[mapaId];
  const W = mini.width, H = mini.height, k = (W - 8) / mp.ancho, y = H / 2;
  mg.clearRect(0, 0, W, H);
  mg.fillStyle = 'rgba(255,255,255,.12)'; mg.fillRect(4, y - 1, W - 8, 2);
  mg.strokeStyle = 'rgba(255,255,255,.3)'; mg.lineWidth = 1; mg.strokeRect(4 + camX * k + .5, 2.5, Math.min(W - 8, VW * k), H - 5);
  for (const p of mp.portales) { mg.fillStyle = '#c084fc'; mg.fillRect(4 + p.x * k - 2, y - 5, 4, 10); }
  for (const n of (mp.npcs || [])) { mg.fillStyle = '#00ff88'; mg.fillRect(4 + n.x * k - 1.5, y - 2, 3, 4); }
  for (const o of mons.values()) if (MONSTRUOS[o.k].jefe && !o.muereT) { mg.fillStyle = '#ff3cf0'; mg.beginPath(); mg.arc(4 + o.x * k, y, 4, 0, 7); mg.fill(); }
  for (const q of otros.values()) { mg.fillStyle = '#00eeff'; mg.fillRect(4 + q.x * k - 1.5, y - 3, 3, 6); }
  mg.fillStyle = '#ffe600'; mg.fillRect(4 + P.x * k - 2, y - 4, 4, 8);
}
function pintarVida() {
  const k = P.maxHp ? P.hp / P.maxHp : 1;
  $('bhp').querySelector('i').style.width = Math.max(0, k * 100) + '%';
  $('h-hp').textContent = Math.max(0, Math.ceil(P.hp)) + '/' + P.maxHp;
}

function aviso(txt, tipo) {
  const d = document.createElement('div');
  d.className = 'aviso';
  if (tipo === 'ok') d.style.borderColor = '#00ff88';
  if (tipo === 'jefe') { d.style.borderColor = '#ff3cf0'; d.style.color = '#ff9cf5'; }
  d.textContent = txt;
  $('avisos').appendChild(d);
  setTimeout(() => d.remove(), 3700);
  while ($('avisos').children.length > 4) $('avisos').firstChild.remove();
}

function lineaChat(nombre, txt) {
  const d = document.createElement('div');
  if (nombre) { const b = document.createElement('b'); b.textContent = nombre + ': '; d.appendChild(b); d.appendChild(document.createTextNode(txt)); }
  else { d.className = 'sis'; d.textContent = txt; }
  $('chat-log').appendChild(d);
  while ($('chat-log').children.length > 8) $('chat-log').firstChild.remove();
}

// ── VENTANAS ──
function abrir(id) { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'm-muerte') m.classList.remove('on'); }); $(id).classList.add('on'); for (const k in teclas) teclas[k] = false; tIzq = tDer = false; }
function cerrarModales() { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'm-muerte' && m.id !== 'm-inicio' && m.id !== 'm-error') m.classList.remove('on'); }); }
document.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = cerrarModales);
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) cerrarModales(); }));

let tabTienda = 'pw';
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tabTienda = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); pintarTienda(); });
function abrirTienda() { abrir('m-tienda'); pintarTienda(); }
function tarjeta(ico, nombre, desc, derecha) {
  return `<div class="item"><div class="ico">${ico}</div><div class="txt"><b>${nombre}</b><small>${desc}</small></div><div class="acc">${derecha}</div></div>`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pintarTienda() {
  if (!yo) return;
  $('t-oro').textContent = yo.oro.toLocaleString('es');
  const L = $('tienda-lista');
  let h = '';
  if (tabTienda === 'pw') {
    PODERES.forEach(p => {
      h += tarjeta(`<img src="${A}items/${p.icono}.png">`, p.nombre + ` <span style="color:#888">(tienes ${yo.pw[p.id] || 0})</span>`, p.desc,
        `<span class="precio">🪙 ${p.precio}</span><button class="btn" data-comprar="pw" data-id="${p.id}" data-n="1" ${yo.oro < p.precio ? 'disabled' : ''}>COMPRAR</button><button class="btn sec" data-comprar="pw" data-id="${p.id}" data-n="5" ${yo.oro < p.precio * 5 ? 'disabled' : ''}>x5</button>`);
    });
  } else {
    const tabla = tabTienda === 'arma' ? ARMAS : SKINS;
    const tiene = tabTienda === 'arma' ? yo.armas : yo.skins;
    const puesto = tabTienda === 'arma' ? yo.arma : yo.skin;
    for (const id in tabla) {
      const d = tabla[id];
      const ico = tabTienda === 'arma' ? `<img src="${A}armas/${d.icono}_item.png" style="${d.color && id !== 'katana' ? 'filter:drop-shadow(0 0 4px ' + d.color + ')' : ''}">` : `<img src="${A}skins/${d.img}.png">`;
      let acc;
      if (tiene.includes(id)) acc = puesto === id ? '<span class="precio" style="color:#00ff88">✓ EQUIPADO</span>' : `<button class="btn sec" data-equipar="${tabTienda}" data-id="${id}">EQUIPAR</button>`;
      else acc = `<span class="precio">🪙 ${d.precio.toLocaleString('es')}</span><button class="btn" data-comprar="${tabTienda}" data-id="${id}" ${yo.oro < d.precio ? 'disabled' : ''}>COMPRAR</button>`;
      h += tarjeta(ico, d.nombre, d.desc, acc);
    }
    if (tabTienda === 'skin') h += '<p style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.5)">Las skins que ya pagaste en el juego principal se desbloquean solas al entrar con tu cuenta.</p>';
  }
  L.innerHTML = h;
  L.querySelectorAll('[data-comprar]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'comprar', k: b.dataset.comprar, id: b.dataset.id, n: +b.dataset.n || 1 }); });
  L.querySelectorAll('[data-equipar]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'equipar', k: b.dataset.equipar, id: b.dataset.id }); });
}

let tabInv = 'skin';
document.querySelectorAll('[data-itab]').forEach(b => b.onclick = () => { tabInv = b.dataset.itab; document.querySelectorAll('[data-itab]').forEach(x => x.classList.toggle('on', x === b)); pintarInventario(); });
function abrirInventario() { if (!yo) return; abrir('m-inv'); pintarInventario(); }
function pintarInventario() {
  if (!yo) return;
  $('inv-stats').innerHTML =
    `<div class="fila"><span>NIVEL</span><span>${yo.nivel}</span></div>` +
    `<div class="fila"><span>VIDA</span><span>${yo.maxHp}</span></div>` +
    `<div class="fila"><span>ATAQUE</span><span>${yo.atk}</span></div>` +
    `<div class="fila"><span>DEFENSA</span><span>${yo.def}</span></div>` +
    `<div class="fila"><span>ARMA</span><span>${esc(ARMAS[yo.arma].nombre)}</span></div>` +
    `<div class="fila"><span>MONSTRUOS / JEFES</span><span>${yo.kills} / ${yo.jefes}</span></div>`;
  const tabla = tabInv === 'arma' ? ARMAS : SKINS;
  const tiene = tabInv === 'arma' ? yo.armas : yo.skins;
  const puesto = tabInv === 'arma' ? yo.arma : yo.skin;
  let h = '';
  for (const id in tabla) {
    const d = tabla[id];
    const ico = tabInv === 'arma' ? `<img src="${A}armas/${d.icono}_item.png">` : `<img src="${A}skins/${d.img}.png">`;
    const acc = !tiene.includes(id) ? '<span class="precio" style="color:#666">🔒 Mercader</span>'
      : puesto === id ? '<span class="precio" style="color:#00ff88">✓ EQUIPADO</span>'
      : `<button class="btn sec" data-equipar="${tabInv}" data-id="${id}">EQUIPAR</button>`;
    h += tarjeta(ico, d.nombre, d.desc, acc);
  }
  $('inv-lista').innerHTML = h;
  $('inv-lista').querySelectorAll('[data-equipar]').forEach(b => b.onclick = () => mandar({ t: 'equipar', k: b.dataset.equipar, id: b.dataset.id }));
}

function abrirRanking() { abrir('m-rank'); $('rank-lista').innerHTML = '<p class="centro">Cargando…</p>'; mandar({ t: 'ranking' }); }
function pintarRanking(r) {
  if (!r.length) { $('rank-lista').innerHTML = '<p class="centro">Todavía nadie sube de nivel. ¡Sé el primero!</p>'; return; }
  const med = ['🥇', '🥈', '🥉'];
  $('rank-lista').innerHTML = r.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>Nv ${x.lv} · ${x.k} caz.</span></div>`).join('');
}

function morir() {
  P.muerto = true;
  sfx('explosion', .4);
  setTimeout(() => $('m-muerte').classList.add('on'), 900);
}
$('b-revivir').onclick = () => { $('m-muerte').classList.remove('on'); mandar({ t: 'revivir' }); };

function mostrarError(txt) {
  $('error-txt').textContent = txt;
  $('m-error').classList.add('on');
  $('carga').style.display = 'none';
}
$('b-reconectar').onclick = () => { fatal = false; reintentos = 0; $('m-error').classList.remove('on'); conectar(); };

// ── INICIO ──
async function inicio() {
  ajustarVista();
  pintarPoderes();
  const esperar = () => new Promise(r => { const chk = () => (cargadas >= porCargar ? r() : setTimeout(chk, 100)); chk(); });
  await Promise.race([esperar(), new Promise(r => setTimeout(r, 12000))]);
  $('carga-s').textContent = 'Conectando…';
  const tokWeb = TG ? null : await tokenWeb();
  $('carga').style.display = 'none';
  if (TG || tokWeb) {
    $('inicio-invitado').style.display = 'none';
    $('inicio-cuenta').style.display = 'block';
    $('inicio-quien').textContent = TG ? 'Entrarás con tu cuenta de Telegram.' : 'Entrarás con tu cuenta de DUENDE QUEST.';
  } else {
    $('in-nombre').value = localStorage.getItem('dq_mmo_nombre') || '';
  }
  $('m-inicio').classList.add('on');
  const entrar = () => {
    const n = $('in-nombre').value.trim();
    if (!TG && !tokWeb) {
      if (n.length < 3) { $('in-nombre').focus(); $('in-nombre').style.borderColor = '#ff3344'; return; }
      localStorage.setItem('dq_mmo_nombre', n);
    }
    $('carga').style.display = 'flex'; $('carga-s').textContent = 'Entrando al mundo…';
    if (sonido) musica.play().catch(() => {});
    conectar();
  };
  $('b-jugar').onclick = entrar; $('b-jugar2').onclick = entrar;
  $('in-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); e.stopPropagation(); });
}

setInterval(() => mandar({ t: 'ping', ts: Date.now() }), 20000);

function bucle() {
  frame++;
  fisica();
  dibujar();
  if (frame % 3 === 0) dibujarMinimapa();
  pintarVida();
  pintarCooldowns();
  requestAnimationFrame(bucle);
}
inicio();
requestAnimationFrame(bucle);
