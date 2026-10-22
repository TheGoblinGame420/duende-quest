// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — cliente
// Dibuja el mundo, mueve al propio duende (respuesta inmediata) y le habla al
// servidor (functions/mmo/world.js) por WebSocket. Todo lo que da o quita
// algo (daño, oro, experiencia, compras) lo decide el servidor.
// ═══════════════════════════════════════════════════════
import {
  VH, SUELO, FIS, HOJAS, MONSTRUOS, MAPAS, SKINS, ARMAS, PODERES, ATAQUE_CD_MS, ALCANCE_BASE, MISIONES, DIARIA,
  statsMonstruo, sueloEn, zonaDe, premioDiaria, FORJA_MAX, costoForja, multForja,
  RANURAS, RAREZAS, BOLSA_MAX, nombreItem, iconoItem, precioVenta, textoBonos, LOGROS, temporadaDe, TEMPORADAS, TINTES, MASCOTAS, NOVEDADES, PASE, premioPase, ambulanteActivo, ambulanteOferta, semanaUTC, GESTOS, horaFelizTiempos, CHICHA, CONJUNTOS, piezasConjunto, textoConjunto, LOGIN_PREMIOS, multLogin, NIVEL_MAX, DESAFIO_MAX, multDesafio, AFIJOS, afijosSemana, DES_SEM_MIN, premioDesSem, BOVEDA_UMBRALES, opcionesBoveda,
  MTON_POR_TON, RETIRO_MIN_MTON, MTON_NIVEL_MIN, WALLET_ESPERA_MS,
  RETIRO_MAX_MTON, RETIRO_CADA_MS, TOPE_DIARIO_PCT, PAQUETES, estrellasDe,
  CLASES, RECURSOS, HABS, habsDe, habPorId, costoHab, costoCambioClase, GCD_MS, VARA, HOGAR_MS, FJ, FM, AURAS, MAZMORRAS, HERM_COSTO, HERM_NIVEL,
  ESPECS, ESPEC_NIVEL, especDe, MONTURAS, velMontura, MATERIALES, RECETAS, PESCA, pesqueroDe, TORRE, premioTorreSem, zonaDeNivel, progresoLogro, proximoMundial, mundialDe, HORA_FELIZ, EXPEDICION, premioExpedicion,
  TALENTOS, TALENTO_MAX, TALENTO_NIVEL, puntosTalento, costoReinicioTalentos, talento, BESTIARIO_HITOS, premioBestiario,
  premioAmigo, BANDA_MAX, BANDA_MONTURA, RUNAS, RUNA_NIVEL, RUNA_MAX, RUNA_PCT, costoRuna,
  GESTA_UMBRALES, GESTA_NOMBRES, GESTA_PUNTOS, GESTA_MIN, premioGesta,
  statsJugador,
} from './data.js?v=128';

// Durante un despliegue puede llegar este JS con un HTML de la version
// anterior (y al reves): si falta un elemento, se usa uno suelto en vez de
// reventar al cargar y dejar la pantalla de carga colgada.
const $ = id => document.getElementById(id) || (() => { const e = document.createElement(id === 'mini' ? 'canvas' : 'div'); e.id = id; return e; })();
const A = '/assets/';
// El HUD se repinta cada fotograma: tocar el DOM aunque el valor no cambie
// obliga al navegador a recalcular estilos 60 veces por segundo. Estas dos
// solo escriben cuando hay un cambio real.
function ponTxt(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
function ponCss(el, prop, v) { const k = '_c' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } }
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
if (TG) {
  try { TG.ready(); TG.expand(); TG.disableVerticalSwipes && TG.disableVerticalSwipes(); TG.setHeaderColor && TG.setHeaderColor('#0a0418'); } catch (e) {}
  // Dentro de Telegram, "volver" cierra primero la ventana abierta (tienda,
  // equipo...) y, si no hay ninguna, lleva al hub de la Mini App.
  const volver = () => {
    const abierta = document.querySelector('.modal.on:not(#m-inicio):not(#m-muerte):not(#m-error)');
    if (abierta && !(abierta.id === 'm-clase' && yo && !yo.clase)) { cerrarModales(); return; }
    location.href = '/telegram/index.html' + (location.hash || '');
  };
  try { TG.BackButton.show(); TG.BackButton.onClick(volver); } catch (e) {}
  const casa = document.querySelector('#botones a[href="/game.html"]');
  if (casa) casa.href = '/telegram/index.html' + (location.hash || '');
}

// Telegram: al llegar a Nv 3 se pide permiso para que el bot pueda escribir
// (sin el, quien abrio el juego por un enlace nunca recibe los avisos de
// vuelta) y a Nv 5 se ofrece ponerlo en la pantalla de inicio. Una vez por
// dispositivo y solo si la version de Telegram lo admite.
function permisosTg(nv) {
  if (!TG || !TG.isVersionAtLeast) return;
  const visto = k => { try { return !!localStorage.getItem(k); } catch (e) { return true; } };
  const marcar = k => { try { localStorage.setItem(k, '1'); } catch (e) {} };
  try {
    if (nv >= 3 && !visto('dq_tg_escribir') && TG.isVersionAtLeast('6.9') && TG.requestWriteAccess) { marcar('dq_tg_escribir'); TG.requestWriteAccess(); return; }
    if (nv >= 5 && !visto('dq_tg_inicio') && TG.isVersionAtLeast('8.0') && TG.addToHomeScreen) {
      if (TG.checkHomeScreenStatus) TG.checkHomeScreenStatus(st => { if (st === 'unknown') return; marcar('dq_tg_inicio'); if (st === 'missed') TG.addToHomeScreen(); });
      else { marcar('dq_tg_inicio'); TG.addToHomeScreen(); }
    }
  } catch (e) {}
}

// Vibracion de Telegram en los momentos buenos (subir de nivel, logro,
// ganar un duelo): en la mini app se nota en la mano, como un juego nativo.
function vibrar(tipo) { if (TG && TG.HapticFeedback) try { TG.HapticFeedback.notificationOccurred(tipo || 'success'); } catch (e) {} }

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
// Opaco: el fondo se pinta entero cada fotograma y asi el navegador no
// tiene que mezclar el lienzo con la pagina.
const g = cv.getContext('2d', { alpha: false });
if (TACTIL) {
  const f1 = $('t-fila1');
  f1.insertBefore($('interactuar'), f1.firstChild);
  f1.insertBefore($('consumibles'), f1.firstChild);
  $('t-fila0').appendChild($('acciones'));
} else {
  // En PC la barra de accion y la de lanzamiento van en una franja bajo el
  // mundo (asi no tapan los nombres que se dibujan en el suelo).
  $('pie').insertBefore($('lanzar'), $('pie').firstChild);
}
// La barra de lanzamiento: en PC su hueco queda reservado (visibility) para
// que el lienzo no cambie de tamaño cada vez que aparece.
function verLanzar(si) {
  if (TACTIL) ponCss($('lanzar'), 'display', si ? 'block' : 'none');
  else { ponCss($('lanzar'), 'display', 'block'); ponCss($('lanzar'), 'visibility', si ? 'visible' : 'hidden'); }
}
verLanzar(false);
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
  // Pantalla angosta (movil en vertical): el marco del objetivo baja bajo
  // el del jugador y el minimapa se achica.
  hud.classList.toggle('estrecho', w < 600);
}
addEventListener('resize', ajustarVista);
// La barra de abajo (#pie) toma su alto final despues del primer ajuste: si
// #escena cambia de tamaño sin que cambie la ventana, se vuelve a encajar.
if (typeof ResizeObserver === 'function') new ResizeObserver(() => ajustarVista()).observe($('escena'));

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
// Crear una copia teñida es caro (un lienzo del tamaño de toda la hoja): si
// se hacia la primera vez que se golpeaba a cada monstruo, ese golpe daba un
// tiron. Se preparan todas mientras carga, de a poco para no congelar.
function precalentarTintes() {
  const tareas = [];
  for (const k in HOJAS) { tareas.push(['sh_' + k, '#ffffff'], ['sh_' + k, '#ff3344']); }
  for (const k in MONSTRUOS) if (MONSTRUOS[k].tinte) tareas.push(['sh_' + MONSTRUOS[k].hoja, MONSTRUOS[k].tinte]);
  for (const k in MONTURAS) if (MONTURAS[k].tinte) tareas.push(['sh_' + MONTURAS[k].hoja, MONTURAS[k].tinte]);
  for (const f in FX) for (const sk in SKINS) if (sk !== 'comun') tareas.push(['fx_' + f, SKINS[sk].color]);
  const paso = () => { const t0 = performance.now(); while (tareas.length && performance.now() - t0 < 8) { const [k, c] = tareas.shift(); tenido(k, c); } if (tareas.length) setTimeout(paso, 16); };
  paso();
}

// ── SONIDO ──
let sonido = localStorage.getItem('dq_mmo_sonido') !== '0';
// Efectos con Web Audio: se decodifican una vez y cada golpe es un nodo
// barato. Con <audio> (currentTime = 0 + play() en cada golpe) el iPhone y
// varios Android congelaban el hilo principal un instante en cada impacto:
// ese era el "lag al pegar".
const SFX_NOMBRES = ['corte', 'corte2', 'golpe', 'muerte', 'moneda', 'salto', 'caida', 'boton', 'explosion'];
const AC = window.AudioContext || window.webkitAudioContext;
let actx = null;
const SFX = {};
const sfxUltimo = {};
function iniciarAudio() {
  if (actx || !AC) { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); return; }
  try { actx = new AC(); } catch (e) { return; }
  SFX_NOMBRES.forEach(k => {
    // mp3 y no ogg: Safari de iPhone no siempre decodifica Ogg Vorbis.
    fetch('/audio/sfx/' + k + '.mp3').then(r => r.arrayBuffer())
      .then(b => new Promise((ok, mal) => actx.decodeAudioData(b, ok, mal)))
      .then(buf => { SFX[k] = buf; }).catch(() => {});
  });
}
['touchstart', 'pointerdown', 'keydown'].forEach(ev => addEventListener(ev, iniciarAudio, { passive: true }));
function sfx(k, vol) {
  if (!sonido || !actx || !SFX[k] || actx.state !== 'running') return;
  // El mismo sonido mas de una vez cada 45 ms no se oye distinto y solo gasta.
  const ahora = performance.now();
  if (ahora - (sfxUltimo[k] || 0) < 45) return;
  sfxUltimo[k] = ahora;
  try {
    const src = actx.createBufferSource(); src.buffer = SFX[k];
    const gan = actx.createGain(); gan.gain.value = vol || .45;
    src.connect(gan); gan.connect(actx.destination); src.start();
  } catch (e) {}
}
// Tonos sintetizados para lo que no tiene archivo de sonido (lanzar,
// interrumpido, error, subir de nivel, portal, esquiva, montar, curar):
// osciladores de Web Audio, sin descargar nada.
const TONOS = {
  lanzar:  [['sine', 320, 620, .22, .10]],
  cortado: [['square', 420, 140, .16, .06]],
  error:   [['square', 190, 170, .07, .05], ['square', 160, 150, .08, .05, .1]],
  nivel:   [['triangle', 523, 523, .12, .12], ['triangle', 659, 659, .12, .12, .11], ['triangle', 784, 784, .12, .12, .22], ['triangle', 1047, 1047, .3, .12, .33]],
  portal:  [['sine', 200, 900, .4, .08], ['triangle', 300, 1200, .4, .04]],
  esquiva: [['sine', 900, 1500, .09, .06]],
  montar:  [['triangle', 330, 330, .08, .1], ['triangle', 440, 440, .1, .1, .1]],
  cura:    [['sine', 880, 880, .25, .07], ['sine', 1320, 1320, .3, .05, .05]],
};
const tonoUltimo = {};
function tono(k) {
  if (!sonido || !actx || actx.state !== 'running' || !TONOS[k]) return;
  const ahora = performance.now();
  if (ahora - (tonoUltimo[k] || 0) < 120) return;
  tonoUltimo[k] = ahora;
  try {
    const t0 = actx.currentTime;
    for (const [tipo, f0, f1, dura, vol, ret] of TONOS[k]) {
      const o = actx.createOscillator(), gan = actx.createGain();
      const t = t0 + (ret || 0);
      o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dura);
      gan.gain.setValueAtTime(vol, t); gan.gain.exponentialRampToValueAtTime(0.001, t + dura);
      o.connect(gan); gan.connect(actx.destination); o.start(t); o.stop(t + dura + .02);
    }
  } catch (e) {}
}
// Musica: se pide al darle al sonido o al entrar (no al cargar la pagina:
// pesa ~600 KB) y en mp3 donde no hay Ogg (Safari de iPhone).
const musica = new Audio(); musica.preload = 'none'; musica.loop = true; musica.volume = .25;
function sonarMusica() {
  if (!musica.src) musica.src = musica.canPlayType('audio/ogg; codecs="vorbis"') ? '/audio/bg_music.ogg' : '/audio/bg_music.mp3';
  musica.play().catch(() => {});
}
function pintarSonido() { $('b-sonido').textContent = sonido ? '🔊' : '🔇'; }
$('b-sonido').onclick = () => {
  sonido = !sonido; localStorage.setItem('dq_mmo_sonido', sonido ? '1' : '0'); pintarSonido();
  if (sonido) sonarMusica(); else musica.pause();
};
pintarSonido();

// ── ESTADO ──
let ws = null, miId = 0, yo = null, mapaId = 'pueblo', conectado = false, reintentos = 0, fatal = false;
// Si el servidor no logra verificar la cuenta (initData de Telegram viejo,
// sesion web caducada), se entra como invitado en vez de quedar bloqueado.
let forzarInvitado = false;
const otros = new Map();   // id -> jugador remoto
const mons = new Map();    // id -> monstruo
let textos = [], parts = [], efectos = [], burbujas = new Map(), monedas = [], balas = [];
let jefeVivo = null;
const cdPoder = {};        // id -> ms fin
let frame = 0;

// ── OBJETIVO, LANZAMIENTOS Y AURAS (estilo WoW) ──
let objetivo = null;            // { k: 'm' (monstruo) | 'p' (jugador), id }
let jugaronHoy = 0;             // jugadores distintos de hoy (servidor, cada 10 s)
let duelo = null;               // { con, ini, fin } (ini/fin en performance.now())
let castYo = null;              // { id, nombre, ini, fin } (tiempos de performance.now)
let castPend = 0;               // hasta cuando esperamos el 'cast' de un hechizo pedido (sin retroceso)
const castOtros = new Map();    // id de jugador -> { id, ini, fin }
const castMon = new Map();      // id de monstruo -> { nombre, ini, fin, int }
let gcdHasta = 0;
const aurasP = new Map();       // id de jugador -> { aura: fin }
const aurasM = new Map();       // id de monstruo -> { aura: fin }
let proyectiles = [];           // disparos de vara y hechizos en vuelo
let zonas = [];                 // zonas de peligro en el suelo (jefes de mazmorra)

// Jugador local
const P = {
  x: 950, y: SUELO, vx: 0, vy: 0, suelo: true, saltos: 0, f: 1,
  dash: 0, dashCd: 0, atk: 0, paso: 0, comboT: 0, atkCdHasta: 0, herido: 0, muerto: false,
  hp: 100, maxHp: 100, escudo: false, fuego: false, rec: 0, recMax: 0, combo: 0, fl: 0,
};
let camX = 0;

// ── RED ──
function urlWs() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mmo/ws'; }
function mandar(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

let soyInvitado = false;
async function autenticacion() {
  soyInvitado = false;
  // Si hubo partida de invitado en este dispositivo, su token viaja tambien:
  // la cuenta nueva hereda ese personaje en vez de empezar de cero.
  const previo = localStorage.getItem('dq_mmo_tok');
  const inv0 = /^[a-f0-9]{32}$/.test(previo || '') ? previo : undefined;
  if (TG && !forzarInvitado) return { auth: { k: 'tg', d: TG.initData }, inv: inv0 };
  const tok = forzarInvitado ? null : await tokenWeb();
  if (tok) return { auth: { k: 'web', tok }, inv: inv0 };
  let inv = localStorage.getItem('dq_mmo_tok');
  if (!/^[a-f0-9]{32}$/.test(inv || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    inv = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('dq_mmo_tok', inv);
  }
  let nombreTg = '';
  try { const u = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user; if (u) nombreTg = u.username || u.first_name || ''; } catch (e) {}
  soyInvitado = true;
  return { auth: { k: 'inv', tok: inv }, nombre: localStorage.getItem('dq_mmo_nombre') || nombreTg };
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
  // reintentos se reinicia al recibir 'bienvenido', no al abrir: si el
  // servidor aceptaba el socket y lo cerraba enseguida, se reintentaba sin fin.
  const ref = (/[?&]ref=([a-z0-9]{6})/.exec(location.search) || [])[1];
  ws.onopen = () => { conectado = true; mandar({ t: 'hola', ...hola, ref }); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } recibir(m); };
  ws.onclose = () => {
    conectado = false;
    if (fatal || pausado) return;
    if (reintentos++ < 6) setTimeout(conectar, Math.min(8000, 600 * reintentos));
    else mostrarError('No se pudo conectar con el servidor. Revisa tu conexión a internet y pulsa RECONECTAR.');
  };
}

function recibir(m) {
  switch (m.t) {
    case 'bienvenido':
      miId = m.id; yo = m.yo; online = m.on || 0; reintentos = 0;
      $('m-inicio').classList.remove('on');
      pintarHud();
      if (m.nuevo) aviso('¡Bienvenido, ' + yo.nombre + '! Habla con el Guardia Tito si necesitas ayuda.');
      if (m.heredado) { aviso('☁️ Tu progreso de invitado pasó a tu cuenta.', 'ok'); try { localStorage.removeItem('dq_mmo_tok'); } catch (e) {} }
      if (m.regaladas && m.regaladas.length) aviso('🎁 Skins de tu cuenta desbloqueadas: ' + m.regaladas.map(k => SKINS[k].nombre).join(', '), 'ok');
      // Personaje sin clase (nuevo, o de antes de las clases): a elegir.
      if (!yo.clase) setTimeout(() => abrirClases(true), 300);
      mandar({ t: 'contactos' });
      break;
    case 'mapa': entrarMapa(m); break;
    case 'yo': {
      const antes = yo; yo = m.yo;
      if (yo.muerto && !(antes && antes.muerto)) morir();
      if (!yo.muerto) { $('m-muerte').classList.remove('on'); P.muerto = false; }
      if (!antes || antes.clase !== yo.clase || antes.nivel !== yo.nivel) $('acciones').innerHTML = '';
      if (antes && yo.nivel > antes.nivel) { vibrar(); setTimeout(() => permisosTg(yo.nivel), 2500); }
      // Una vez, a Nv 8: que existen las skins con poderes (informativo).
      if (antes && antes.nivel < 8 && yo.nivel >= 8 && (yo.skins || []).length <= 1) setTimeout(() => aviso('🎭 ¿Sabías? Las skins del Mercader dan poderes (más oro, ataque, defensa...). Míralas en su pestaña SKINS; con «Probar» te ves con ellas.', 'ok'), 6000);
      // Invitado: su personaje vive solo en este navegador. Se le recuerda
      // en algunos niveles como no perderlo (y recibir avisos y mTON).
      if (antes && yo.nivel > antes.nivel && soyInvitado && [5, 10, 15, 25].includes(yo.nivel)) setTimeout(() => aviso('☁️ Juegas como invitado: tu personaje vive solo en este navegador. Inicia sesión en el juego (🏠) o entra por @duendequest_bot en Telegram y se pasará a tu cuenta.', 'ok'), 4000);
      if ($('m-libro').classList.contains('on')) pintarLibro();
      if (yo.clase && $('m-clase').classList.contains('on') && antes && !antes.clase) cerrarModales();
      if (yo.clase && loginPend) { const lp = loginPend; loginPend = null; setTimeout(() => mostrarLogin(lp), 900); }
      pintarHud(); if ($('m-tienda').classList.contains('on')) pintarTienda(); if ($('m-inv').classList.contains('on')) pintarInventario();
      if ($('m-mision').classList.contains('on')) pintarMision();
      if ($('m-wallet').classList.contains('on')) pintarWallet();
      if ($('m-arte').classList.contains('on')) abrirArtesana();
      if ($('m-boveda').classList.contains('on')) abrirBoveda();
      revisarBoveda();
      revisarNovedades();
      break;
    }
    case 's': snapshot(m); break;
    case 'pj': agregarOtro(m.p); break;
    case 'pl':
      otros.delete(m.id); castOtros.delete(m.id); aurasP.delete(m.id);
      if (objetivo && objetivo.k === 'p' && objetivo.id === m.id) objetivo = null;
      break;
    case 'ms': agregarMon(m.m); break;
    case 'md': {
      const o = mons.get(m.id);
      if (m.fuera) { mons.delete(m.id); castMon.delete(m.id); aurasM.delete(m.id); if (objetivo && objetivo.k === 'm' && objetivo.id === m.id) objetivo = null; break; }
      if (o) { o.muereT = performance.now(); o.st = 2; lanzarFX('muerte', o.x, o.y - o.alto * .45, o.alto / 60, false); sfx('muerte', .35); }
      if (o && MONSTRUOS[o.k].jefe) jefeVivo = null;
      castMon.delete(m.id); aurasM.delete(m.id);
      if (objetivo && objetivo.k === 'm' && objetivo.id === m.id) objetivo = null;
      break;
    }
    case 'at': ataqueRemoto(m); break;
    case 'gana':
      if (m.coop) { flotante(m.x, m.y, '+' + m.xp + ' XP (grupo)', '#00eeff', 9); break; }
      for (let i = 0; i < Math.min(8, 2 + Math.floor(m.oro / 15)); i++) monedas.push({ x: m.x, y: m.y + 20, vx: (Math.random() - .5) * 5, vy: -4 - Math.random() * 3, t: 0 });
      flotante(m.x, m.y, '+' + m.xp + ' XP', '#c084fc', 10);
      if (m.chi) { flotante(m.x - 18, m.y - 44, '+' + m.chi + ' 🥤', '#c084fc', 9); if (yo && yo.chicha) { yo.chicha.p += m.chi; yo.chicha.hoy += m.chi; } }
      if (m.cal) { const tp = TEMPORADAS.find(x => x.id === m.tp) || temporadaDe() || TEMPORADAS[0]; flotante(m.x + 18, m.y - 30, '+' + m.cal + ' ' + tp.emoji, tp.color, 10); if (yo) yo[tp.campo] = (yo[tp.campo] || 0) + m.cal; }
      if (m.oro > 0) flotante(m.x, m.y + 14, '+' + m.oro + ' oro', '#ffe600', 10);
      if (m.drops && m.drops.length) m.drops.forEach(d => { const pd = PODERES.find(p => p.id === d); if (pd) aviso('🎁 Encontraste: ' + pd.nombre, 'ok'); });
      if (m.item) {
        const rz = RAREZAS[m.item.r];
        flotante(m.x, m.y - 16, '★ ' + nombreItem(m.item), rz.color, m.item.r >= 2 ? 11 : 9);
        aviso('🎁 ' + rz.nombre + ': ' + nombreItem(m.item) + ' Nv' + m.item.nv + ' (' + textoBonos(m.item.b) + ')', m.item.r >= 2 ? 'jefe' : 'ok');
        if (m.item.r >= 2) { sfx('explosion', .3); for (let i = 0; i < 24; i++) particula(m.x, m.y, rz.color, 4); }
        if (m.item.r >= 3) ofrecerPresumir('🌟 ¡Me cayó un objeto LEGENDARIO: ' + nombreItem(m.item) + '!');
      }
      sfx('moneda', .3);
      break;
    case 'ph': {
      const yoMismo = m.p === miId;
      const q = yoMismo ? P : otros.get(m.p);
      if (!q) break;
      if (m.esq) { flotante(q.x, q.y - 70, 'ESQUIVA', '#ffffff', 9); if (yoMismo) tono('esquiva'); break; }
      if (m.ab) flotante(q.x + 14, q.y - 84, '(' + m.ab + ' absorbido)', '#ffe9a8', 7);
      if (!m.d) break;
      if (yoMismo) {
        P.herido = 18; sfx('caida', .5); flotante(P.x, P.y - 70, '-' + m.d, '#ff3344', 11);
        // Retroceso: el golpe te aparta del monstruo (y corta el combo de pegado).
        const o = mons.get(m.from);
        // Ni durante un lanzamiento ni mientras llega su confirmacion: el
        // retroceso movia al jugador y el servidor cancelaba el hechizo.
        if (o && !castYo && performance.now() > castPend) { P.vx = (P.x < o.x ? -1 : 1) * 7; if (P.suelo) { P.vy = -4; P.suelo = false; } }
        sacudir = Math.max(sacudir, 4);
        if (TG && TG.HapticFeedback) try { TG.HapticFeedback.impactOccurred('medium'); } catch (e) {}
      } else { q.herido = 18; flotante(q.x, q.y - 70, '-' + m.d, '#ff7777', 9); }
      break;
    }
    case 'cu': {
      // Curacion: numero verde sobre el curado (como en WoW).
      const q = m.p === miId ? P : otros.get(m.p);
      if (q) {
        flotante(q.x + (Math.random() - .5) * 14, q.y - 78, '+' + m.n + (m.c ? '!' : ''), '#4ade80', m.c ? 12 : 10);
        if (q === P || m.de === miId) tono('cura');
        for (let i = 0; i < 8; i++) particula(q.x + (Math.random() - .5) * 26, q.y - 10 - Math.random() * 40, '#4ade80', 1.5);
      }
      break;
    }
    case 'pm':
      if (m.p !== miId) { const o = otros.get(m.p); if (o) o.muerto = true; }
      castOtros.delete(m.p); aurasP.delete(m.p);
      if (m.p === miId) castYo = null;
      break;
    case 'res': {
      const q = m.p === miId ? P : otros.get(m.p);
      if (q) { for (let i = 0; i < 40; i++) particula(q.x, q.y - 30, i % 2 ? '#ffe600' : '#ffffff', 4); flotante(q.x, q.y - 90, '¡RESUCITADO!', '#ffe600', 12); }
      if (m.p === miId) { P.muerto = false; $('m-muerte').classList.remove('on'); aviso('✝ ' + (m.de || 'Un sacerdote') + ' te devolvió la vida.', 'ok'); sfx('explosion', .4); }
      else { const o = otros.get(m.p); if (o) o.muerto = false; }
      break;
    }
    case 'lv': {
      const quien = m.p === miId ? P : otros.get(m.p);
      if (quien) {
        for (let i = 0; i < 40; i++) particula(quien.x, quien.y - 30, ['#ffe600', '#00ff88', '#ff3cf0'][i % 3], 5);
        flotante(quien.x, quien.y - 95, '¡NIVEL ' + m.lv + '!', '#ffe600', 14);
      }
      if (m.p === miId) { aviso('⬆️ ¡Subiste a nivel ' + m.lv + '!', 'ok'); tono('nivel'); }
      else if (quien) { quien.lv = m.lv; if (m.mx) quien.mx = m.mx; if (m.rmx) quien.rmx = m.rmx; }
      break;
    }
    case 'pa': { const o = otros.get(m.p); if (o) { o.sk = m.sk; o.ar = m.ar; o.mx = m.mx; o.ti = m.ti || ''; o.cl = m.cl || ''; o.rmx = m.rmx || 0; o.hn = m.hn || ''; o.mo = m.mo || ''; o.es = m.es || ''; o.tn = m.tn || ''; o.ma = m.ma || ''; } break; }
    case 'hb': habilidadRemota(m); break;
    case 'cast': {
      const h = m.id === 'hogar' ? { nombre: 'Piedra de Hogar' } : m.id === 'montar' ? { nombre: 'Invocar montura' } : m.id === 'recolectar' ? { nombre: 'Recogiendo' } : m.id === 'pescar' ? { nombre: '🎣 Pescando' } : habPorId(m.id);
      const c = { id: m.id, nombre: h ? h.nombre : '', ini: performance.now(), fin: performance.now() + m.ms, tg: m.tg };
      if (m.p === miId) { castYo = c; castPend = 0; verLanzar(true); $('lanzar').classList.remove('mal'); tono(m.id === 'montar' ? 'montar' : 'lanzar'); }
      else castOtros.set(m.p, c);
      break;
    }
    // Pesca: pico. Hay que tirar (E o el boton) antes de que acabe la ventana.
    // Torre del Duende: el piso en el que vais (y cuanto le queda).
    case 'torre':
      // Marca nueva de la semana cada 5 pisos: ofrecer presumirla (con tu enlace).
      if (m.mejor >= 5 && m.mejor % 5 === 0 && m.piso === m.mejor && m.mejor > ((torreInfo && torreInfo.mejor) || 0)) ofrecerPresumir(`🗼 ¡Llegué al piso ${m.mejor} de la Torre del Duende! ¿Me superas?`);
      torreInfo = { piso: m.piso, fin: m.limpio ? 0 : m.en ? performance.now() + m.en : (torreInfo ? torreInfo.fin : 0), mejor: m.mejor !== undefined ? m.mejor : (torreInfo ? torreInfo.mejor : 0) };
      pintarSubMapa();
      break;
    case 'pica':
      castYo = { id: 'pica', nombre: '🐟 ¡PICA!', ini: performance.now(), fin: performance.now() + m.ms, tg: 0 };
      verLanzar(true); $('lanzar').classList.remove('mal');
      tono('nivel'); vibrar('warning');
      { const p = pesqueroDe(mapaId); if (p) for (let k = 0; k < 10; k++) particula(p.x, SUELO - 14, '#93c5fd', 2); }
      break;
    case 'pescado': {
      const p = pesqueroDe(mapaId);
      if (p) for (let k = 0; k < 18; k++) particula(p.x, SUELO - 8, m.dorado ? '#facc15' : '#93c5fd', 3);
      flotante(P.x, P.y - 80, m.dorado ? '🐟 ¡Pez Dorado!' : '🐟 +' + m.cant, m.dorado ? '#facc15' : '#93c5fd', 12);
      sfx('moneda', .4);
      break;
    }
    case 'castFin':
      if (m.p === miId) {
        if (castYo && !m.ok) { tono('cortado'); $('lanzar').classList.add('mal'); ponTxt($('lanzar-t'), 'Interrumpido'); setTimeout(() => { if (!castYo) verLanzar(false); }, 450); }
        else verLanzar(false);
        castYo = null;
      } else castOtros.delete(m.p);
      break;
    case 'mcast': castMon.set(m.id, { nombre: m.nombre, ini: performance.now(), fin: performance.now() + m.ms, int: !!m.int }); break;
    case 'mcastFin': {
      castMon.delete(m.id);
      const o = mons.get(m.id);
      if (o && m.int) { flotante(o.x, o.y - o.alto - 20, '¡INTERRUMPIDO!', '#ffae00', 10); sfx('golpe', .4); }
      break;
    }
    case 'au': {
      const mapaA = m.k === 'm' ? aurasM : aurasP;
      const id = m.k === 'p' && m.id === miId ? miId : m.id;
      let a = mapaA.get(id);
      if (!a) { a = {}; mapaA.set(id, a); }
      if (m.ms === 0) delete a[m.a];
      else a[m.a] = m.ms < 0 ? Infinity : performance.now() + m.ms;
      break;
    }
    case 'no': errorRojo(m.m); break;
    case 'mton':
      if (yo) yo.mton = m.total;
      flotante(P.x, P.y - 110, '+' + m.n + ' mTON', '#00eeff', 12);
      aviso('💎 +' + m.n + ' mTON (tienes ' + tonTxt(m.total) + ' TON) — ' + ({ jefe: 'por el jefe', mundial: 'por el jefe mundial', diaria: 'por la caza del día' }[m.motivo] || ''), 'ok');
      sfx('moneda', .5);
      for (let i = 0; i < 20; i++) particula(P.x, P.y - 40, '#00eeff', 4);
      pintarHud();
      break;
    case 'factura': abrirFactura(m); break;
    case 'pedidoSol': mostrarPedidoSol(m); break;
    case 'fondo': fondoInfo = m; if ($('m-wallet').classList.contains('on')) pintarWallet(); break;
    case 'login': mostrarLogin(m); break;
    case 'logro':
      aviso('🏅 ¡Logro: "' + m.titulo + '"! +' + m.oro.toLocaleString('es') + ' oro · ponte el título en 🎒', 'ok');
      vibrar();
      ofrecerPresumir('🏅 ¡Conseguí el logro «' + m.titulo + '»!');
      sfx('explosion', .35);
      for (let i = 0; i < 30; i++) particula(P.x, P.y - 40, ['#ffe600', '#ff3cf0', '#00ff88'][i % 3], 5);
      break;
    case 'mundial': mundial = { vivo: m.vivo, en: m.en ? m.en - Date.now() + performance.now() : 0, k: m.k || '' }; break;
    case 'pw': efectoPoder(m.p, m.i); break;
    case 'cd': cdPoder[m.id] = performance.now() + m.hasta; break;
    case 'chat': mensajeChat(m); break;
    case 'grupo': grupo = m.g; pintarSocial(); break;
    case 'invitacion': mostrarInvitacion(m); break;
    // No tapa una invitacion de verdad (grupo, hermandad, duelo) sin contestar.
    case 'lfgAviso': if (!grupo && !($('invitacion').style.display === 'block' && $('invitacion').dataset.tipo !== 'lfg')) mostrarInvitacion({ ...m, lfg: 1, ms: 30000 }); break;
    case 'lfg': lfgLista = m.l || []; pintarLfg(); break;
    case 'herm': hermandad = m.h; pintarSocial(); break;
    case 'hermInv': mostrarInvitacion({ ...m, herm: 1 }); break;
    case 'reto': mostrarInvitacion({ ...m, duelo: 1 }); break;
    case 'duelo': empiezaDuelo(m); break;
    case 'dueloFin': finDuelo(m); break;
    case 'critDuelo': { const q = m.p === miId ? P : otros.get(m.p); if (q) flotante(q.x, q.y - 92, '¡CRÍTICO!', '#ffd34d', 10); break; }
    case 'buscador': abrirBuscador(); break;
    case 'amigos': pintarAmigos(m); if (presumirPend && m.ref) { presumirPend = false; ofrecerPresumir(presumirTxt); aviso('📣 Listo: toca «Compartir logro» otra vez para compartir.'); } break;
    case 'muerte': resumenMuerte(m); break;
    case 'nodos': recibirNodos(m.l); break;
    case 'recogido': { const n = nodos.find(x => x.i === m.i); if (n) { n.listo = performance.now() + m.en; for (let k = 0; k < 14; k++) particula(n.x, SUELO - 14, m.tipo === 'hierba' ? '#4ade80' : '#cbd5e1', 3); } sfx('moneda', .3); break; }
    case 'tareas': if (yo) { yo.tareas = m; pintarHud(); if ($('m-mision').classList.contains('on')) pintarMision(); } break;
    case 'muros': muros = m.muros || []; if (instancia) instancia.hechos = m.hechos; pintarHud(); break;
    case 'mmx': { const o = mons.get(m.id); if (o) { o.mx = m.mx; o.hp = m.hp; } break; }
    case 'emote': emote(m.m); break;
    case 'completada': completada(m); break;
    case 'ev': case 'cofres': case 'cofreA': recibirMundoAbierto(m); break;
    case 'quien': quienLista = m.r || []; pintarSocial(); break;
    case 'contactos': contactos = m.l || []; pintarSocial(); break;
    case 'inspeccion': pintarInspeccion(m); break;
    case 'pase': if (yo) { yo.pase = m.pase; if ($('m-mision').classList.contains('on')) pintarMision(); } break;
    case 'gesto': if (GESTOS[m.id]) { gestos.set(m.p, { id: m.id, t: performance.now() }); if (m.p === miId) sfx('boton', .25); } break;
    case 'on': online = m.n; if (m.h) jugaronHoy = m.h; pintarSubMapa(); break;
    case 'toast': aviso(m.m, m.ok ? 'ok' : ''); if (m.hab) { $('acciones').innerHTML = ''; pintarHud(); } break;
    case 'aviso': aviso(m.m, 'jefe'); lineaChat(null, m.m); sfx('explosion', .3); break;
    case 'snap':
      if (m.carga) {
        // Carga del guerrero: estela desde donde estaba hasta el objetivo.
        for (let i = 0; i < 18; i++) { const k = i / 18; particula(P.x + (m.x - P.x) * k, P.y - 30, '#c79c6e', 2); }
        sfx('corte2', .45); sacudir = Math.max(sacudir, 6);
      }
      P.x = m.x; P.y = m.y; P.vx = 0; P.vy = 0; if (m.f) P.f = m.f;
      break;
    case 'ranking': pintarRanking(m.r, m.sem, m.finSem, m.des, m.dsem, m.af, m.duel, m.elo, m.torre, m.tmax, m.herm); break;
    case 'err':
      if (m.auth && m.auth !== 'inv' && !forzarInvitado) {
        // El servidor cierra el socket; onclose reconecta solo, ya como invitado.
        forzarInvitado = true; reintentos = 0;
        aviso('No pudimos verificar tu cuenta: entras como invitado (tu personaje de la cuenta no se toca). Cierra y vuelve a abrir el juego para entrar con ella.');
        break;
      }
      if (m.fatal) { fatal = true; dormido = !!m.inactivo; mostrarError(m.m); }
      else aviso(m.m);
      break;
  }
}

let fundido = 0;
function entrarMapa(m) {
  if (m.mapa !== mapaId) { fundido = 1; if (mapaId) tono('portal'); }
  mapaId = m.mapa;
  otros.clear(); mons.clear(); efectos = []; textos = []; balas = []; burbujas.clear(); jefeVivo = null;
  objetivo = null; duelo = null; castOtros.clear(); castMon.clear(); aurasM.clear(); proyectiles = []; zonas = [];
  muros = m.muros || []; instancia = m.inst || null; nodos = [];
  for (const id of [...aurasP.keys()]) if (id !== miId) aurasP.delete(id);
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
let torreInfo = null;   // { piso, fin, mejor } dentro de la Torre
const textoMinutos = ms => Math.floor(ms / 60000) + ' min' + (ms % 60000 ? ' y ' + Math.round(ms % 60000 / 1000) + ' s' : '');
function pintarSubMapa() {
  const mp = MAPAS[mapaId];
  if (!mp.torre) torreInfo = null;
  const base = mp.torre ? '🗼 Piso ' + (torreInfo ? torreInfo.piso : 0) + (torreInfo && torreInfo.mejor ? ' · tu marca: ' + torreInfo.mejor : '') : mp.instancia ? (MAZMORRAS[mp.mazmorra] && MAZMORRAS[mp.mazmorra].banda ? 'Banda' : 'Mazmorra') + (instancia ? ' · Nv ' + instancia.nv + (instancia.k ? ' · ⚡+' + instancia.k : '') : '') : mp.zona && mp.nv ? 'Nivel ' + mp.nv[0] + '-' + mp.nv[1] : 'Zona segura';
  $('h-mapa-sub').textContent = base + (online ? ' · 👥 ' + online + ' en línea' : '') + (jugaronHoy > online ? ' · ' + jugaronHoy + ' hoy' : '');
}

// Auras que llegan con el jugador/monstruo (las que ya tenia puestas).
function aurasDeServidor(au) {
  const r = {}, ahora = performance.now();
  for (const a in (au || {})) r[a] = au[a] < 0 ? Infinity : ahora + au[a];
  return r;
}

function agregarOtro(p) {
  if (p.id === miId) return;
  otros.set(p.id, { id: p.id, n: p.n, lv: p.lv, sk: p.sk, ar: p.ar, ti: p.ti || '', cl: p.cl || '', hn: p.hn || '', mo: p.mo || '', es: p.es || '', tn: p.tn || '', ma: p.ma || '', rmx: p.rmx || 0, rec: 0, fl: 0, x: p.x, y: p.y, f: p.f, a: 0, hp: p.hp, mx: p.mx, muerto: p.muerto, buf: [{ t: performance.now(), x: p.x, y: p.y }], herido: 0, atk: 0, paso: 0 });
  aurasP.set(p.id, aurasDeServidor(p.au));
}

function agregarMon(d) {
  const st = statsMonstruo(d.k, d.nv);
  const o = { id: d.id, k: d.k, nv: d.nv || MONSTRUOS[d.k].nivel, x: d.x, y: d.y, f: d.f, hp: d.hp, mx: d.mx, st: d.st, fl: 0, alto: st.alto, w: st.w, h: st.h, buf: [{ t: performance.now(), x: d.x, y: d.y }], nace: performance.now(), muereT: 0, golpeT: 0 };
  if (d.ex) o.ex = d.ex;   // invasor, capitan o raro (ver MUNDO ABIERTO)
  mons.set(d.id, o);
  aurasM.set(d.id, aurasDeServidor(d.au));
  if (MONSTRUOS[d.k].jefe) jefeVivo = o;
}

function snapshot(m) {
  const t = performance.now();
  for (const r of m.p) {
    const [id, x, y, f, a, hp, mx, fl, rec, rmx, cp] = r;
    if (id === miId) {
      P.hp = hp; P.maxHp = mx; P.fl = fl; P.escudo = !!(fl & FJ.escudo); P.fuego = !!(fl & FJ.fuego);
      P.rec = rec || 0; P.recMax = rmx || 0; P.combo = cp || 0;
      // El "yo" ya no llega tras cada golpe: se mantiene al dia aqui para que
      // pintarHud (que copia de yo) no vuelva un instante a la vida vieja.
      if (yo) { yo.hp = hp; yo.maxHp = mx; yo.rec = P.rec; yo.recMax = P.recMax; yo.combo = P.combo; }
      continue;
    }
    const o = otros.get(id);
    if (!o) continue;
    o.buf.push({ t, x, y }); if (o.buf.length > 4) o.buf.shift();
    o.f = f; o.a = a; o.hp = hp; o.mx = mx; o.fl = fl; o.escudo = !!(fl & FJ.escudo); o.fuego = !!(fl & FJ.fuego); o.muerto = !!(fl & FJ.muerto);
    o.rec = rec || 0; o.rmx = rmx || 0;
  }
  const vistos = new Set();
  for (const r of m.m) {
    const [id, x, y, f, st, hp, fl] = r;
    vistos.add(id);
    const o = mons.get(id);
    if (!o) continue;
    o.buf.push({ t, x, y }); if (o.buf.length > 4) o.buf.shift();
    o.f = f; if (hp < o.hp) o.golpeT = t; o.hp = hp; o.fl = fl || 0;
    if (st === 2 && !o.muereT) o.muereT = t;
    o.st = st;
  }
  for (const [id, o] of mons) if (!vistos.has(id) && (!o.muereT || t - o.muereT > 2000)) { mons.delete(id); aurasM.delete(id); }
  balas = (m.b || []).map(([id, x, y, vx, vy, jefe]) => ({ id, x, y, vx, vy, jefe, t }));
  zonas = (m.z || []).map(([id, x0, x1, act, color, j]) => ({ id, x0, x1, act, color, j }));
  if (jefeVivo && !mons.has(jefeVivo.id)) jefeVivo = null;
  if (objetivo && objetivo.k === 'm' && !mons.has(objetivo.id)) objetivo = null;
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

// Colores de los numeros de daño: 0 normal, 1 critico, 2 rayo/chispa,
// 3 aura de skin, 4 habilidad, 5 daño en el tiempo (sombras).
const COLOR_GOLPE = ['#ffffff', '#ff9900', '#00eeff', '#ff3cf0', '#ffe600', '#c084fc'];
function ataqueRemoto(m) {
  const quien = m.p === miId ? P : otros.get(m.p);
  const ahora = performance.now();
  if (m.vara) {
    // Disparo de vara: un proyectil del color de la clase hasta el objetivo.
    const o = m.varaP ? blancoJug(m.varaP === miId ? P : otros.get(m.varaP)) : mons.get(m.vara);
    if (quien && o) {
      const cl = m.p === miId ? (yo && yo.clase) : quien.cl;
      proyectiles.push({ x0: quien.x + (m.f || 1) * 14, y0: quien.y - 36, o, ini: ahora, dur: 180, color: cl === 'sacerdote' ? '#ffe9a8' : '#a78bfa', r: 4 });
      if (m.p === miId) sfx('corte2', .2);
      if (quien !== P) { quien.atk = 10; quien.f = m.f; }
    }
  } else if (m.p !== miId && quien && m.s >= 0) {
    quien.atk = 14; quien.paso = m.s; quien.f = m.f;
    lanzarFX(['corte_h', 'corte_arriba', 'corte_giro'][m.s], quien.x + m.f * 42, quien.y - 32, 1.05, m.f < 0, false, colorCorte(quien.sk));
  }
  for (const [id, dmg, tipo] of m.h) {
    const o = mons.get(id);
    if (!o) continue;
    o.golpeT = ahora;
    if (m.p === miId && quien) {
      o.empuje = { t: ahora, d: o.x >= quien.x ? 1 : -1 };
      // Pausa de impacto en el critico: un instante quieto que se siente.
      if (tipo === 1) pausaGolpe = ahora + 70;
    }
    const col = COLOR_GOLPE[tipo] || '#ffffff';
    const retraso = m.vara ? 170 : 0;
    const pintar = () => {
      // Por encima del nombre del monstruo (antes lo tapaba), y el critico
      // con su palabra y su sonido: se tiene que notar.
      flotante(o.x + (Math.random() - .5) * 16, o.y - o.alto - 30, (tipo === 1 ? '¡' : '') + dmg + (tipo === 1 ? '!' : ''), col, tipo === 1 ? 14 : tipo === 5 ? 9 : 11);
      if (tipo === 1 && m.p === miId) { flotante(o.x, o.y - o.alto - 50, '¡CRÍTICO!', '#ffd34d', 8); sfx('explosion', .18); }
      for (let i = 0; i < 4; i++) particula(o.x, o.y - o.alto / 2, col, 3);
    };
    if (retraso) setTimeout(pintar, retraso); else pintar();
    if (tipo === 2 && m.s !== -1) lanzarFX('rayo', o.x, o.y - o.alto / 2, .5, false);
    // Sin objetivo elegido, el primero que golpeas pasa a serlo.
    if (m.p === miId && !objetivo && tipo !== 5) objetivo = { k: 'm', id };
  }
  if (m.h.length && m.p === miId && !(performance.now() - (P.golpePredicho || 0) < 600)) sfx('golpe', .35);
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

function congelado() { return !!(P.fl & FJ.bloque); }
function fisica() {
  if (!yo || P.muerto) return;
  const mp = MAPAS[mapaId];
  const izq = !congelado() && (teclas.ArrowLeft || teclas.KeyA || tIzq);
  const der = !congelado() && (teclas.ArrowRight || teclas.KeyD || tDer);
  let obj = 0;
  const vel = FIS.vel * velMontura(yo.montado) * (1 + talento(yo, 'agilidad'));
  if (izq) obj -= vel; if (der) obj += vel;
  if (obj) P.f = obj > 0 ? 1 : -1;
  // Moverse cancela el lanzamiento (el servidor tambien lo hace; aqui se
  // ve al instante).
  if (obj && castYo) { if (castYo.id === 'pescar' || castYo.id === 'pica') errorRojo('Te moviste: se cortó el sedal.'); castYo = null; mandar({ t: 'cancelar' }); verLanzar(false); }
  viajePorBorde(izq, der);
  if (P.dash > 0) { P.dash--; P.vx = P.f * FIS.dashVel; }
  else P.vx += (obj - P.vx) * .3;
  if (P.dashCd > 0) P.dashCd--;
  P.vy += FIS.grav; if (P.vy > 16) P.vy = 16;
  const antesY = P.y;
  P.x = Math.max(12, Math.min(mp.ancho - 12, Math.min(topeMuros(), P.x + P.vx)));
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
  if (!yo || P.muerto || chatAbierto() || congelado()) return;
  if (castYo) { castYo = null; mandar({ t: 'cancelar' }); verLanzar(false); }
  if (P.suelo) { P.vy = FIS.salto; P.suelo = false; P.saltos = 1; sfx('salto', .3); }
  else if (P.saltos < 2) { P.vy = FIS.dobleSalto; P.saltos = 2; sfx('salto', .25); for (let i = 0; i < 8; i++) particula(P.x, P.y, '#c084fc', 3); }
}
function dash() {
  if (!yo || P.muerto || P.dashCd > 0 || congelado()) return;
  P.dash = FIS.dashT; P.dashCd = FIS.dashCd;
  for (let i = 0; i < 10; i++) particula(P.x - P.f * 10, P.y - 25, '#00eeff', 3);
}
function atacar() {
  if (!yo || P.muerto || chatAbierto() || congelado()) return;
  const ahora = performance.now();
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  if (ahora < P.atkCdHasta) return;
  const cl = CLASES[yo.clase];
  if (cl && cl.basico === 'vara') {
    // Magos y sacerdotes: disparo de vara al objetivo (o al mas cercano).
    if (castYo) return;
    const o = enemigoParaUsar(VARA.rango);
    if (!o) { errorRojo('No hay ningún enemigo al alcance de tu vara.'); P.atkCdHasta = ahora + 400; return; }
    P.atkCdHasta = ahora + VARA.cdMs * arma.cd;
    P.atk = 10; P.f = o.x >= P.x ? 1 : -1;
    mandar({ t: 'atk', s: 0, tg: o.id, tk: esRival(o) ? 'p' : undefined });
    return;
  }
  P.paso = P.comboT > 0 ? (P.paso + 1) % 3 : 0;
  P.comboT = 40;
  P.atk = 14;
  P.atkCdHasta = ahora + ATAQUE_CD_MS * arma.cd;
  mandar({ t: 'atk', s: P.paso });
  const tipo = ['corte_h', 'corte_arriba', 'corte_giro'][P.paso];
  const esc = (arma.alcance || 1) * (P.paso === 2 ? 1.25 : 1.05);
  lanzarFX(tipo, P.x + P.f * 40 * arma.alcance, P.y - 32, esc, P.f < 0, true, colorCorte(yo.skin));
  sfx(P.paso === 1 ? 'corte2' : 'corte', .35);
  // Respuesta inmediata: el destello y el sonido del impacto salen ya, con la
  // misma caja de golpe que usa el servidor; los numeros de daño llegan con
  // su respuesta. Antes todo esperaba el viaje de ida y vuelta (100-300 ms
  // en movil) y cada golpe se sentia con retraso.
  const alcance = ALCANCE_BASE[P.paso] * arma.alcance;
  const alto = 72 * (yo.arma === 'odachi' ? 1.4 : 1);
  const x0 = P.f > 0 ? P.x - 8 : P.x - 8 - alcance, x1 = P.f > 0 ? P.x + 8 + alcance : P.x + 8;
  let acierta = false;
  for (const o of mons.values()) {
    if (o.muereT || o.x + o.w / 2 < x0 || o.x - o.w / 2 > x1 || o.y < P.y - alto || o.y - o.h > P.y + 8) continue;
    o.golpeT = ahora; acierta = true;
  }
  if (acierta) { sfx('golpe', .35); P.golpePredicho = ahora; }
}
function usarPoder(i) {
  if (!yo || P.muerto) return;
  mandar({ t: 'pw', i });
}
function colorCorte(skin) { return (SKINS[skin] && skin !== 'comun') ? SKINS[skin].color : null; }

// ── OBJETIVO ──
// Misma medida que el servidor: del centro del duende al borde del monstruo.
function distMon(o) {
  const dx = Math.max(0, Math.abs(o.x - P.x) - o.w / 2);
  const dy = Math.max(0, Math.abs((o.y - o.h / 2) - (P.y - FIS.jugH / 2)) - o.h / 2);
  return Math.hypot(dx, dy);
}
function distJug(q) { return Math.hypot(q.x - P.x, (q.y - P.y) * 0.7); }
function monObjetivo() { return objetivo && objetivo.k === 'm' ? mons.get(objetivo.id) : null; }
function jugObjetivo() { return objetivo && objetivo.k === 'p' ? (objetivo.id === miId ? null : otros.get(objetivo.id)) : null; }
// Enemigo para una habilidad: el objetivo elegido (aunque este lejos: el
// servidor dira "fuera de alcance", como en WoW), o si no hay ninguno el mas
// cercano al alcance, que pasa a ser el objetivo.
function enemigoParaUsar(rango) {
  const riv = rivalDuelo();
  if (riv && (!objetivo || (objetivo.k === 'p' && objetivo.id === riv.id) || (distJug(riv) <= rango && !monObjetivo()))) { objetivo = { k: 'p', id: riv.id }; return riv; }
  const o = monObjetivo();
  if (o && !o.muereT) return o;
  let mejor = null, md = Infinity;
  for (const m of mons.values()) {
    if (m.muereT) continue;
    const d = distMon(m);
    if (d > rango) continue;
    const k = d + ((m.x - P.x) * P.f < 0 ? 150 : 0);
    if (k < md) { md = k; mejor = m; }
  }
  if (mejor) objetivo = { k: 'm', id: mejor.id };
  return mejor;
}
function cicloObjetivo() {
  const lista = [...mons.values()].filter(o => !o.muereT && Math.abs(o.x - P.x) < 650).sort((a, b) => distMon(a) - distMon(b));
  if (!lista.length) { objetivo = null; return; }
  const i = objetivo && objetivo.k === 'm' ? lista.findIndex(o => o.id === objetivo.id) : -1;
  objetivo = { k: 'm', id: lista[(i + 1) % lista.length].id };
  sfx('boton', .2);
}
// Tocar o hacer clic en el lienzo elige lo que haya debajo.
function elegirEnPantalla(ev) {
  if (!yo) return;
  const r = cv.getBoundingClientRect();
  const lx = (ev.clientX - r.left) * cv.width / r.width;
  const ly = (ev.clientY - r.top) * cv.height / r.height - OY;
  const wx = lx + camX, wy = ly;
  let mejor = null, md = Infinity;
  for (const o of mons.values()) {
    if (o.muereT) continue;
    const dx = Math.abs(wx - o.x), arriba = o.y - Math.max(o.alto, o.h) - 12;
    if (dx < Math.max(o.w / 2, 22) + 10 && wy > arriba && wy < o.y + 14 && dx < md) { md = dx; mejor = { k: 'm', id: o.id }; }
  }
  for (const q of [...otros.values(), P]) {
    const dx = Math.abs(wx - q.x);
    if (dx < 26 && wy > q.y - 72 && wy < q.y + 20 && dx < md) { md = dx; mejor = { k: 'p', id: q === P ? miId : q.id }; }
  }
  if (mejor) { objetivo = mejor; sfx('boton', .2); }
}
cv.addEventListener('pointerdown', elegirEnPantalla);

// Portales / NPCs / aliados caidos cercanos
function cercano() {
  const mp = MAPAS[mapaId];
  // El sacerdote ve "Resucitar" junto a un aliado caido.
  if (yo && yo.clase === 'sacerdote' && yo.nivel >= habPorId('resurreccion').nv) {
    for (const q of otros.values()) if (q.muerto && distJug(q) < habPorId('resurreccion').rango) return { tipo: 'res', q };
  }
  for (let i = 0; i < mp.portales.length; i++) if (Math.abs(P.x - mp.portales[i].x) < 70) return { tipo: 'portal', i, p: mp.portales[i] };
  for (const n of (mp.npcs || [])) if (Math.abs(P.x - n.x) < 90) return { tipo: 'npc', n };
  return nodoCercano() || pesqueroCercano() || cofreCercano();
}
// ── PESCA ── (ver PESCA en data.js)
function pesqueroCercano() {
  const p = pesqueroDe(mapaId);
  return p && Math.abs(P.x - p.x) < PESCA.radio - 10 ? { tipo: 'pesca', p } : null;
}
function dibujarPesquero() {
  const p = pesqueroDe(mapaId);
  if (!p) return;
  const x = p.x - camX;
  if (x < -80 || x > VW + 80) return;
  g.globalAlpha = .85;
  g.fillStyle = '#1e40af';
  g.beginPath(); g.ellipse(x, SUELO - 2, 48, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3b82f6';
  g.beginPath(); g.ellipse(x, SUELO - 3, 40, 6, 0, 0, Math.PI * 2); g.fill();
  // Ondas
  const r = (frame % 90) / 90;
  g.globalAlpha = .5 * (1 - r);
  g.strokeStyle = '#bfdbfe'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(x + 10, SUELO - 3, 6 + r * 22, 1.5 + r * 4, 0, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  emoji('🎣', 24, x - 60, SUELO - 6);
}
// El sedal y el corcho de quien pesca (el corcho se hunde al picar).
function dibujarSedal(x, pies, f, pica) {
  const p = pesqueroDe(mapaId);
  if (!p) return;
  // El corcho cae delante, dentro del agua; la caña apunta hacia el.
  const cx = p.x - camX, d = Math.abs(x - cx) < 12 ? f : (cx > x ? 1 : -1);
  const bx = Math.max(cx - 38, Math.min(cx + 38, x + d * 55));
  const by = SUELO - 5 + (pica ? 3 + Math.sin(frame * .9) * 2 : Math.sin(frame * .08) * 1.2);
  const px = x + d * 22, py = pies - 52;
  g.strokeStyle = '#8b5a2b'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x + d * 6, pies - 28); g.lineTo(px, py); g.stroke();
  g.strokeStyle = 'rgba(229,231,235,.8)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo((px + bx) / 2, by - 10, bx, by); g.stroke();
  g.fillStyle = '#ef4444'; g.beginPath(); g.arc(bx, by - 2, 3, Math.PI, 0); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by - 2, 3, 0, Math.PI); g.fill();
}
function interactuar() {
  if (!yo || P.muerto) return;
  const c = cercano();
  if (!c) return;
  sfx('boton', .3);
  if (c.tipo === 'res') { usarHabDef(habPorId('resurreccion'), c.q.id); return; }
  if (c.tipo === 'cofre') { abrirCofre(c.c); return; }
  if (c.tipo === 'nodo') { if (performance.now() < c.n.listo) errorRojo('Todavía no ha vuelto a crecer.'); else mandar({ t: 'recolectar', i: c.n.i }); return; }
  if (c.tipo === 'pesca') {
    // Tirar si esta pescando (antes de que pique, el servidor dice que se asusto).
    if (castYo && (castYo.id === 'pica' || castYo.id === 'pescar')) { mandar({ t: 'tirar' }); return; }
    P.f = c.p.x >= P.x ? 1 : -1;
    mandar({ t: 'pescar' });
    return;
  }
  if (c.tipo === 'portal' && c.p.buscador) { abrirBuscador(); return; }
  if (c.tipo === 'portal') { mandar({ t: 'portal', i: c.i }); }
  else if (c.n.tipo === 'tienda') abrirTienda();
  else if (c.n.tipo === 'ranking') abrirRanking();
  else if (c.n.tipo === 'artesania') abrirArtesana();
  else abrirMision();
}

// ── ENTRADA ──
function chatAbierto() { return document.activeElement === $('chat-in'); }
const TECLAS_PODER = { KeyQ: 0, KeyF: 1, KeyG: 2, KeyT: 3 };
addEventListener('keydown', e => {
  if (chatAbierto()) {
    if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) enviarChat(v); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    return;
  }
  if (document.querySelector('.modal.on')) {
    if (e.key === 'Escape' && !($('m-clase').classList.contains('on') && yo && !yo.clase)) cerrarModales();
    if (e.code === 'KeyP' && $('m-libro').classList.contains('on')) cerrarModales();
    if (e.code === 'KeyO' && $('m-social').classList.contains('on')) cerrarModales();
    if (e.code === 'KeyM' && $('m-mapa').classList.contains('on')) cerrarModales();
    if (e.code === 'KeyL' && $('m-mision').classList.contains('on')) cerrarModales();
    return;
  }
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) cicloObjetivo(); return; }
  if (e.repeat && ['KeyZ', 'KeyJ'].indexOf(e.code) < 0) { teclas[e.code] = true; return; }
  teclas[e.code] = true;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); const c = cercano(); if (e.code !== 'Space' && c && c.tipo === 'portal') interactuar(); else saltar(); }
  if (e.code === 'KeyZ' || e.code === 'KeyJ') atacar();
  if (e.code === 'KeyX' || e.code === 'KeyK' || e.code === 'ShiftLeft') dash();
  if (e.code === 'KeyE') interactuar();
  if (e.code === 'KeyI') abrirInventario();
  if (e.code === 'KeyP') abrirLibro();
  if (e.code === 'KeyO') abrirSocial();
  if (e.code === 'KeyM') abrirMapaMundo();
  if (e.code === 'KeyL') abrirMision();
  if (e.code === 'KeyY') montar();
  if (e.code === 'KeyH') $('t-auto').onclick();
  if (e.code === 'KeyR') volverAlPueblo();
  if (e.code === 'Escape') objetivo = null;
  if (e.code === 'Enter') { e.preventDefault(); abrirChat(); }
  if (/^Digit[1-8]$/.test(e.code)) usarHab(+e.code.slice(5) - 1);
  if (e.code in TECLAS_PODER) usarPoder(TECLAS_PODER[e.code]);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { teclas[e.code] = false; });
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; tIzq = tDer = false; });

const FRASES = ['¡Hola! 👋', '¿Hacemos grupo?', '¿Mazmorra? 🏰', '¡Gracias! 🙏', '¡Bien jugado! ⚔️', '¡Ayuda aquí!', 'Me voy, ¡nos vemos! 👋'];
function abrirChat() {
  const i = $('chat-in'); i.style.display = 'block'; i.focus();
  // Movil: con el chat abierto se ve el historial entero.
  if ($('hud').classList.contains('estrecho')) $('chat-log').classList.add('abierto');
  // En el movil, frases de un toque encima del teclado.
  if (TACTIL) {
    const f = $('frases');
    const rotulo = t => { const d = document.createElement('div'); d.style.cssText = 'flex-basis:100%;font:600 11px var(--sans);color:#e2e8f0;margin:2px 0 0;padding:2px 6px;background:rgba(10,14,24,.85);border-radius:6px;text-shadow:1px 1px 0 #000'; d.textContent = t; return d; };
    if (!f.children.length) f.appendChild(rotulo('Gestos (solo se ven sobre tu duende):'));
    if (f.children.length === 1) for (const [k, gs] of Object.entries(GESTOS)) { const b = document.createElement('button'); b.className = 'bt'; b.textContent = gs.e; b.title = '/' + k; b.onmousedown = b.ontouchstart = e => { e.preventDefault(); mandar({ t: 'gesto', id: k }); cerrarChat(); }; f.appendChild(b); }
    if (f.children.length <= Object.keys(GESTOS).length + 1) { f.appendChild(rotulo('Frases al chat general:')); FRASES.forEach(t => { const b = document.createElement('button'); b.className = 'bt'; b.textContent = t; b.onmousedown = b.ontouchstart = e => { e.preventDefault(); mandar({ t: 'chat', canal: 'general', m: t }); cerrarChat(); }; f.appendChild(b); }); }
    ponCss(f, 'display', 'flex');
  }
}
// Movil: tocar el chat lo despliega 8 s.
$('chat-log').addEventListener('click', () => {
  if (!$('hud').classList.contains('estrecho')) return;
  const l = $('chat-log');
  l.classList.toggle('abierto');
  clearTimeout(l._t);
  if (l.classList.contains('abierto')) l._t = setTimeout(() => l.classList.remove('abierto'), 8000);
});
function cerrarChat() {
  $('chat-log').classList.remove('abierto'); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; ponCss($('frases'), 'display', 'none'); }
$('chat-in').addEventListener('blur', () => setTimeout(() => ponCss($('frases'), 'display', 'none'), 150));
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
function volverAlPueblo() {
  if (!yo || P.muerto) return;
  if (mapaId === 'pueblo') { aviso('Ya estás en el pueblo.'); return; }
  if (castYo) return;
  sfx('boton', .3); mandar({ t: 'regreso' });
}
$('b-regreso').onclick = volverAlPueblo;
$('b-inv').onclick = abrirInventario;
$('b-libro').onclick = () => abrirLibro();
$('b-rank').onclick = abrirRanking;
$('b-ayuda').onclick = () => abrir('m-ayuda');
{ const bn = $('b-novedades'); if (bn) bn.onclick = () => abrirNovedades(); }
$('b-wallet').onclick = abrirWallet;
$('h-mton-c').onclick = abrirWallet;
$('uf-yo').addEventListener('click', () => { objetivo = { k: 'p', id: miId }; });

// ── BARRA DE ACCION ──
// 7 habilidades de la clase (teclas 1-7) y 4 consumibles (Q F G T). Cada
// boton muestra su enfriamiento, si falta recurso (azulado), si el objetivo
// esta lejos (tecla en rojo) y si un remate esta listo (brillo).
function boton(icono, tecla, titulo, alUsar) {
  const d = document.createElement('div');
  d.className = 'pw';
  d.title = titulo;
  d.innerHTML = `<span class="k">${tecla}</span><img src="${icono}" alt=""><span class="n"></span><div class="cd"></div><span class="cdt"></span>`;
  const usar = e => { e.preventDefault(); d.classList.add('on'); setTimeout(() => d.classList.remove('on'), 120); alUsar(); };
  d.addEventListener('touchstart', usar, { passive: false });
  d.addEventListener('mousedown', usar);
  return d;
}
function montar() {
  if (!yo || P.muerto || chatAbierto()) return;
  if (!yo.montado && !(yo.monturas || []).length) { errorRojo('No tienes montura: el Mercader las vende desde nivel 20.'); return; }
  if (castYo) return;
  mandar({ t: 'montar' });
}
function pintarPoderes() {
  const cont = $('consumibles');
  if (!cont.children.length) {
    PODERES.forEach((p, i) => cont.appendChild(boton(A + 'items/' + p.icono + '.png', p.tecla, p.nombre + ' (' + p.tecla + ') — ' + p.desc, () => usarPoder(i))));
    const bm = boton(A + 'items/equipo/S_Buff09.png', 'Y', 'Montar / desmontar (Y)', montar);
    bm.id = 'b-montar';
    cont.appendChild(bm);
  }
  if (!yo) return;
  const bm = $('b-montar');
  ponCss(bm, 'display', (yo.monturas || []).length ? 'flex' : 'none');
  ponClase(bm, 'listo', !!yo.montado);
  PODERES.forEach((p, i) => {
    const d = cont.children[i];
    const n = yo.pw[p.id] || 0;
    ponTxt(d.querySelector('.n'), String(n));
    d.classList.toggle('vacio', n <= 0);
  });
}
function pintarAcciones() {
  const cont = $('acciones');
  if (!yo || !yo.clase) { if (cont.children.length) cont.innerHTML = ''; return; }
  const habs = habsDe(yo.clase);
  if (!cont.children.length) {
    habs.forEach((h, i) => {
      const d = boton(A + 'items/equipo/' + h.icono + '.png', i + 1, h.nombre + ' — ' + h.desc, () => usarHab(i));
      d.classList.add('ac');
      cont.appendChild(d);
    });
  }
  // Solo se ve la siguiente por desbloquear: siete casillas grises
  // ("Nv4…Nv36") llenaban la barra del novato.
  const prox = habs.findIndex(h => yo.nivel < h.nv);
  habs.forEach((h, i) => {
    const d = cont.children[i];
    const bloq = yo.nivel < h.nv;
    d.classList.toggle('vacio', bloq);
    ponCss(d, 'display', bloq && i !== prox ? 'none' : '');
    ponTxt(d.querySelector('.n'), bloq ? 'Nv' + h.nv : '');
  });
}
function usarHab(i) {
  if (!yo || !yo.clase) { if (yo) abrirClases(true); return; }
  const h = habsDe(yo.clase)[i];
  if (h) usarHabDef(h);
}
function usarHabDef(h, tgForzado) {
  if (!yo || P.muerto || chatAbierto() || !h) return;
  const ahora = performance.now();
  if (yo.nivel < h.nv) { errorRojo('Aprendes ' + h.nombre + ' a nivel ' + h.nv + '.'); return; }
  if (congelado()) { errorRojo('Estás dentro del Bloque de Hielo: espera a que se rompa.'); return; }
  if (castYo) { errorRojo('Ya estás lanzando otro hechizo.'); return; }
  if (ahora < (cdPoder['h_' + h.id] || 0)) { errorRojo(h.nombre + ' todavía no está lista.'); return; }
  if (h.gcd !== false && ahora < gcdHasta) return;
  const costo = costoHab(h, P.recMax || 0, yo.espec);
  if (P.rec < costo) { errorRojo('No tienes suficiente ' + RECURSOS[CLASES[yo.clase].recurso].nombre.toLowerCase() + '.'); return; }
  let tg = 0, tk;
  if (h.obj === 'enemigo') {
    const o = enemigoParaUsar(h.rango);
    if (!o) { errorRojo('No hay ningún enemigo al alcance.'); return; }
    if ((esRival(o) ? distJug(o) : distMon(o)) > h.rango + 20) { errorRojo('Fuera de alcance.'); return; }
    tg = o.id;
    if (esRival(o)) tk = 'p';
    if (h.cast) P.f = o.x >= P.x ? 1 : -1;
  } else if (h.obj === 'aliado' || h.obj === 'muerto') {
    tg = tgForzado || (objetivo && objetivo.k === 'p' ? objetivo.id : 0);
    const q = tg && tg !== miId ? otros.get(tg) : null;
    if (q && distJug(q) > h.rango + 20) { errorRojo('Tu aliado está demasiado lejos.'); return; }
  }
  if (h.id === 'eviscerar' && !(P.combo > 0)) { errorRojo('Necesitas puntos de combo (usa Golpe Siniestro).'); return; }
  if (h.gcd !== false) gcdHasta = ahora + GCD_MS;
  tuto.usoHab = true;
  // La carga mueve al guerrero: el servidor lo pone junto al objetivo.
  if (h.cast) castPend = ahora + 600;
  mandar({ t: 'hab', id: h.id, tg, tk });
}
function pintarCooldowns() {
  const ahora = performance.now();
  const cont = $('acciones');
  if (yo && yo.clase && cont.children.length) {
    const habs = habsDe(yo.clase);
    const o = monObjetivo();
    habs.forEach((h, i) => {
      const d = cont.children[i];
      if (!d) return;
      const fin = cdPoder['h_' + h.id] || 0;
      const enCd = fin > ahora;
      const gcd = h.gcd !== false && gcdHasta > ahora && !enCd;
      const k = enCd ? (fin - ahora) / h.cd : gcd ? (gcdHasta - ahora) / GCD_MS : 0;
      ponCss(d._cd || (d._cd = d.querySelector('.cd')), 'transform', 'scaleY(' + Math.round(k * 100) / 100 + ')');
      ponTxt(d._cdt || (d._cdt = d.querySelector('.cdt')), enCd && fin - ahora > 1500 ? String(Math.ceil((fin - ahora) / 1000)) : '');
      const bloq = yo.nivel < h.nv;
      d.classList.toggle('sinrec', !bloq && P.rec < costoHab(h, P.recMax || 0, yo.espec));
      const lejos = h.obj === 'enemigo' && o && !o.muereT && distMon(o) > h.rango;
      (d._k || (d._k = d.querySelector('.k'))).classList.toggle('lejos', !!lejos);
      const listo = !bloq && ((h.id === 'eviscerar' && P.combo >= 5) || (h.bajo && o && !o.muereT && o.hp / o.mx <= h.bajo));
      d.classList.toggle('listo', !!listo);
    });
  }
  if (frame % 30 === 0) { pintarMundial(); pintarEvento(); }
  const pc = $('consumibles'); if (!pc.children.length) return;
  PODERES.forEach((p, i) => {
    const fin = cdPoder[p.id] || 0;
    const k = fin > ahora ? (fin - ahora) / p.cd : 0;
    const e = pc.children[i];
    ponCss(e._cd || (e._cd = e.querySelector('.cd')), 'transform', 'scaleY(' + Math.round(k * 100) / 100 + ')');
  });
}

// Efectos de las habilidades (propias y de los demas).
function habilidadRemota(m) {
  const mio = m.p === miId;
  const quien = mio ? P : otros.get(m.p);
  const contraJug = m.tk === 'p' && (habPorId(m.id) || {}).obj === 'enemigo';
  const o = m.tk === 'm' || (!m.tk && m.tg) ? mons.get(m.tg) : contraJug ? blancoJug(m.tg === miId ? P : otros.get(m.tg)) : null;
  const aliado = m.tk === 'p' ? (m.tg === miId ? P : otros.get(m.tg)) : null;
  if (quien) {
    const col = colorCorte(mio ? yo.skin : quien.sk);
    if (!mio) { quien.atk = 14; quien.f = m.f; }
    else P.atk = 14;
    switch (m.id) {
      case 'golpe_heroico': if (o) lanzarFX('corte_h', o.x, o.y - o.alto / 2, 1.8, m.f < 0, false, '#ff9933'); sfx('corte2', .45); break;
      case 'ejecutar': if (o) { lanzarFX('corte_giro', o.x, o.y - o.alto / 2, 2.4, false, false, '#ff3344'); flotante(o.x, o.y - o.alto - 24, '¡EJECUTAR!', '#ff3344', 10); } sfx('explosion', .45); if (mio) sacudir = 8; break;
      case 'carga': if (o) lanzarFX('corte_h', o.x, o.y - o.alto / 2, 1.4, m.f < 0, false, '#c79c6e'); break;
      case 'provocar': if (o) { flotante(o.x, o.y - o.alto - 24, '¡PROVOCADO!', '#ff3344', 9); for (let k = 0; k < 16; k++) particula(o.x, o.y - o.alto, '#ff3344', 3); } flotante(quien.x, quien.y - 90, '¡AQUÍ!', '#c79c6e', 10); sfx('golpe', .4); break;
      case 'torbellino': lanzarFX('corte_giro', quien.x, quien.y - 34, 3, false, mio, col); lanzarFX('corte_giro', quien.x, quien.y - 34, 2.2, true, mio, col); sfx('corte2', .4); break;
      case 'grito': for (let k = 0; k < 36; k++) particula(quien.x + Math.cos(k / 36 * 6.28) * 30, quien.y - 40 + Math.sin(k / 36 * 6.28) * 30, '#ff6633', 4); flotante(quien.x, quien.y - 95, '¡POR EL DUENDE!', '#ff9933', 10); sfx('explosion', .35); break;
      case 'muro': for (let k = 0; k < 20; k++) particula(quien.x, quien.y - 30, '#cbd5e1', 3); sfx('golpe', .4); break;
      case 'bola_fuego': if (o) proyectiles.push({ x0: quien.x + m.f * 16, y0: quien.y - 40, o, ini: performance.now(), dur: 260, color: '#ff7a1a', r: 8, fuego: 1 }); sfx('explosion', .3); break;
      case 'misiles': if (o) for (let k = 0; k < 3; k++) proyectiles.push({ x0: quien.x + m.f * 14, y0: quien.y - 40 - k * 8, o, ini: performance.now() + k * 110, dur: 200, color: '#c084fc', r: 5 }); sfx('corte2', .35); break;
      case 'nova': for (let k = 0; k < 48; k++) particula(quien.x + Math.cos(k / 48 * 6.28) * 22, quien.y - 20, '#9be7ff', 6); sfx('explosion', .35); if (mio) sacudir = 5; break;
      case 'polimorfia': if (o) for (let k = 0; k < 24; k++) particula(o.x, o.y - o.alto / 2, '#ff9cf5', 4); sfx('boton', .5); break;
      case 'evocacion': for (let k = 0; k < 30; k++) particula(quien.x, quien.y - 30, '#60a5fa', 4); break;
      case 'bloque': for (let k = 0; k < 30; k++) particula(quien.x, quien.y - 30, '#9be7ff', 4); sfx('golpe', .4); break;
      case 'meteoros':
        for (let k = 0; k < 8; k++) lanzarFX('rayo', quien.x + (k - 3.5) * 105, quien.y - 70 - (k % 2) * 40, 1.3, k % 2 === 0, false, '#ff7a1a');
        sfx('explosion', .5); if (mio) sacudir = 12; break;
      case 'castigo': if (o) { for (let k = 0; k < 22; k++) particula(o.x + (Math.random() - .5) * 20, o.y - o.alto - 30 + k * 4, '#ffe9a8', 2); lanzarFX('rayo', o.x, o.y - o.alto / 2, .8, false, false, '#ffe9a8'); } sfx('explosion', .25); break;
      case 'sanar': case 'renovar': case 'escudo_poder': case 'supresion': {
        const q = aliado || quien;
        const c = m.id === 'escudo_poder' ? '#ffe9a8' : m.id === 'supresion' ? '#e0e7ff' : '#4ade80';
        for (let k = 0; k < 18; k++) particula(q.x + (Math.random() - .5) * 30, q.y - Math.random() * 50, c, 2.5);
        sfx('moneda', .25); break;
      }
      case 'rezo': for (let k = 0; k < 50; k++) particula(quien.x + (Math.random() - .5) * 300, quien.y - Math.random() * 60, '#4ade80', 2.5); sfx('moneda', .35); break;
      case 'dolor': if (o) for (let k = 0; k < 18; k++) particula(o.x, o.y - o.alto / 2, '#7c3aed', 3); break;
      case 'resurreccion': break;
      case 'siniestro': if (o) lanzarFX('corte_h', o.x, o.y - o.alto / 2, 1.2, m.f < 0, false, '#fff569'); sfx('corte', .4); break;
      case 'eviscerar': if (o) { lanzarFX('corte_giro', o.x, o.y - o.alto / 2, 1.2 + (m.cp || 0) * .25, false, false, '#ff3344'); if (m.cp >= 5) flotante(o.x, o.y - o.alto - 24, '¡5 COMBOS!', '#fff569', 10); } sfx('corte2', .45); break;
      case 'patada': case 'zurrar': if (o) lanzarFX('corte_arriba', o.x, o.y - o.alto / 2, 1, false, false, m.id === 'zurrar' ? '#c79c6e' : '#fff569'); sfx('golpe', .4); break;
      case 'contrahechizo': if (o) { for (let k = 0; k < 20; k++) particula(o.x, o.y - o.alto / 2, '#69ccf0', 4); flotante(o.x, o.y - o.alto - 30, '¡CONTRAHECHIZO!', '#69ccf0', 9); } sfx('boton', .5); break;
      case 'silencio': if (o) { for (let k = 0; k < 20; k++) particula(o.x, o.y - o.alto / 2, '#7c3aed', 4); flotante(o.x, o.y - o.alto - 30, '¡SILENCIO!', '#c084fc', 9); } sfx('boton', .5); break;
      case 'abanico': for (let k = 0; k < 24; k++) particula(quien.x, quien.y - 30, '#e5e7eb', 6); lanzarFX('corte_giro', quien.x, quien.y - 34, 2.4, false, mio, '#e5e7eb'); sfx('corte', .45); break;
      case 'evasion': case 'sigilo': case 'desvanecer': for (let k = 0; k < 20; k++) particula(quien.x, quien.y - 30, '#64748b', 3); sfx('salto', .3); break;
    }
  }
  // Los proyectiles marcan su daño al llegar; lo demas, en el acto.
  const viaja = m.id === 'bola_fuego' || m.id === 'misiles';
  if (viaja) setTimeout(() => ataqueRemoto({ p: m.p, s: -1, f: m.f, h: m.h }), 240);
  else ataqueRemoto({ p: m.p, s: -1, f: m.f, h: m.h });
}

// Error corto en rojo arriba al centro (como "No tienes suficiente maná").
function errorRojo(txt) {
  const c = $('errores');
  for (const d of c.children) if (d.textContent === txt && performance.now() - (d._t || 0) < 1500) return;
  const d = document.createElement('div');
  d.textContent = txt; d._t = performance.now();
  c.appendChild(d);
  tono('error');
  setTimeout(() => d.remove(), 1600);
  while (c.children.length > 2) c.firstChild.remove();
}

// ── GRUPO, CHAT POR CANALES Y LISTA DE JUGADORES ──
let grupo = null;               // { id, lider (uid), m: [{ uid, on, id, n, lv, cl, hp, mx, rec, rmx, mapa, muerto }] }
let ultimoSusurro = '';
const COLOR_CANAL = { general: '#e9d5ff', decir: '#ffffff', grupo: '#7dd3fc', hermandad: '#4ade80', susurro: '#f9a8d4' };
const ETIQUETA_CANAL = { general: '', decir: '', grupo: '[Grupo] ', hermandad: '[Hermandad] ', susurro: '' };

function miUid() { return yo ? yo.pid : null; }
function soyLider() { return !!(grupo && grupo.lider === miUid()); }

// Lo que se escribe en el chat: /d decir (tu mapa), /g grupo, /h hermandad,
// /s Nombre susurro, /r responder al ultimo susurro. Sin barra: general.
function enviarChat(v) {
  const m = /^\/(\w+)\s*(.*)$/s.exec(v);
  if (!m) { mandar({ t: 'chat', canal: 'general', m: v }); return; }
  const cmd = m[1].toLowerCase(), resto = m[2].trim();
  if (Object.hasOwn(GESTOS, cmd)) return mandar({ t: 'gesto', id: cmd });
  if (['d', 'decir'].includes(cmd)) return resto && mandar({ t: 'chat', canal: 'decir', m: resto });
  if (['g', 'grupo', 'p'].includes(cmd)) return resto && mandar({ t: 'chat', canal: 'grupo', m: resto });
  if (['h', 'hermandad'].includes(cmd)) return resto && mandar({ t: 'chat', canal: 'hermandad', m: resto });
  if (['s', 'susurrar', 'w'].includes(cmd)) {
    const sp = resto.indexOf(' ');
    if (sp < 1) { errorRojo('Escribe: /s Nombre mensaje'); return; }
    return mandar({ t: 'chat', canal: 'susurro', a: resto.slice(0, sp), m: resto.slice(sp + 1) });
  }
  if (cmd === 'r') { if (!ultimoSusurro) { errorRojo('Nadie te ha susurrado todavía.'); return; } return resto && mandar({ t: 'chat', canal: 'susurro', a: ultimoSusurro, m: resto }); }
  if (cmd === 'invitar' || cmd === 'inv') { const q = [...otros.values()].find(x => x.n.toLowerCase() === resto.toLowerCase()); if (q) mandar({ t: 'invitar', p: q.id }); else errorRojo('Para invitar, ese jugador tiene que estar en tu mapa (o usa 👥).'); return; }
  if (cmd === 'salir') { mandar({ t: 'salirGrupo' }); return; }
  errorRojo('Comandos: /d decir · /g grupo · /h hermandad · /s Nombre susurro · /r responder · gestos: ' + Object.keys(GESTOS).map(k => '/' + k).join(' '));
}
function mensajeChat(m) {
  const canal = m.canal || 'general';
  if (m.sis) { lineaChat(null, m.m, canal); return; }
  let quien = m.n;
  if (canal === 'susurro') {
    if (m.de) { quien = m.de + ' te susurra'; ultimoSusurro = m.de; sfx('boton', .4); }
    else quien = 'Susurras a ' + m.a;
  } else if (canal === 'general' && m.mapa && m.mapa !== mapaId && MAPAS[m.mapa]) quien = m.n + ' (' + MAPAS[m.mapa].nombre + ')';
  lineaChat(ETIQUETA_CANAL[canal] + quien, m.m, canal, CLASES[m.cl] ? CLASES[m.cl].color : null);
  if (canal !== 'susurro' && (!m.mapa || m.mapa === mapaId)) burbujas.set(m.p, { txt: m.m, hasta: performance.now() + 5000 });
}

// Invitacion a un grupo: aviso arriba con Aceptar / Rechazar (se puede
// seguir jugando mientras tanto).
function mostrarInvitacion(m) {
  const cl = CLASES[m.cl];
  $('invitacion').dataset.tipo = m.lfg ? 'lfg' : m.duelo ? 'duelo' : m.herm ? 'herm' : 'grupo';
  $('invitacion').dataset.pid = m.pid || '';
  $('inv-si').textContent = m.lfg ? 'Unirme' : 'Aceptar';
  $('inv-no').textContent = m.lfg ? 'Ahora no' : 'Rechazar';
  $('inv-txt').innerHTML = m.lfg
    ? `📢 <b style="color:${cl ? cl.color : 'var(--txt)'}">${esc(m.n)}</b> (Nv ${m.nv}${cl ? ' ' + esc(cl.nombre) : ''}) busca grupo para <b style="color:var(--ok)">${esc((MAZMORRAS[m.id] || {}).nombre || 'una mazmorra')}</b> (${m.m}/${m.mx || 5})`
    : m.duelo
    ? `⚔️ <b style="color:${cl ? cl.color : 'var(--txt)'}">${esc(m.de)}</b> (Nv ${m.nv}${cl ? ' ' + esc(cl.nombre) : ''}) te reta a un <b style="color:var(--err)">duelo</b>`
    : m.herm
    ? `<b>${esc(m.de)}</b> te invita a la hermandad <b style="color:var(--ok)">&lt;${esc(m.nombre)}&gt;</b>`
    : `<b style="color:${cl ? cl.color : 'var(--txt)'}">${esc(m.de)}</b> (Nv ${m.nv}${cl ? ' ' + esc(cl.nombre) : ''}) te invita a su grupo`;
  ponCss($('invitacion'), 'display', 'block');
  sfx('moneda', .4);
  clearTimeout(mostrarInvitacion.t);
  mostrarInvitacion.t = setTimeout(() => ponCss($('invitacion'), 'display', 'none'), m.ms || 60000);
}
const respInv = si => {
  const tipo = $('invitacion').dataset.tipo;
  if (tipo === 'lfg') { if (si) mandar({ t: 'lfgUnir', pid: $('invitacion').dataset.pid }); }
  else mandar({ t: { herm: 'hermResp', duelo: 'retoResp' }[tipo] || 'grupoResp', si });
  ponCss($('invitacion'), 'display', 'none'); if (si) sfx('boton', .3);
};
$('inv-si').onclick = () => respInv(true);
$('inv-no').onclick = () => respInv(false);

// Marcos del grupo (a la izquierda): vida y recurso de cada compañero.
function pintarGrupo() {
  const cont = $('grupo');
  const lista = grupo ? grupo.m.filter(x => x.id !== miId) : [];
  const clave = lista.map(x => x.uid + (x.on ? 1 : 0) + (x.cl || '')).join('|') + (grupo ? grupo.lider : '');
  if (cont._clave !== clave) {
    cont._clave = clave;
    cont.innerHTML = lista.map(x => {
      const cl = CLASES[x.cl];
      return `<div class="gm" data-uid="${esc(x.uid)}"><div class="nm"><span style="color:${cl ? cl.color : 'var(--txt2)'}">${grupo.lider === x.uid ? '👑 ' : ''}${esc(x.n || '?')}</span><small></small></div>
        <div class="barra hp"><i></i><span></span></div><div class="barra rc"><i style="background:${cl ? RECURSOS[cl.recurso].color : 'var(--borde)'}"></i></div></div>`;
    }).join('');
    cont.querySelectorAll('.gm').forEach(d => d.onclick = () => {
      const x = grupo && grupo.m.find(y => y.uid === d.dataset.uid);
      if (x && x.on && otros.has(x.id)) { objetivo = { k: 'p', id: x.id }; sfx('boton', .2); }
      else if (x && x.on) errorRojo((x.n || 'Tu compañero') + ' está en otro mapa.');
    });
  }
  ponCss(cont, 'display', lista.length ? 'block' : 'none');
  ponClase(cont, 'compacto', lista.length > 4);
  lista.forEach((x, i) => {
    const d = cont.children[i];
    if (!d) return;
    // En el mismo mapa la foto del servidor es mas fresca que el aviso del grupo.
    const q = x.on ? otros.get(x.id) : null;
    const hp = q ? q.hp : x.hp, mx = q ? q.mx : x.mx, rec = q ? q.rec : x.rec, rmx = q ? q.rmx : x.rmx, muerto = q ? q.muerto : x.muerto;
    const sub = !x.on ? 'Desconectado' : muerto ? 'Caído' : (!q && x.mapa && MAPAS[x.mapa] ? MAPAS[x.mapa].nombre : 'Nv ' + x.lv);
    ponTxt(d.querySelector('small'), sub);
    ponClase(d, 'lejos', !q);
    ponClase(d, 'caido', !x.on || !!muerto);
    pintarBarra(d.querySelector('.hp'), x.on && !muerto && mx ? hp / mx : 0, x.on && mx ? Math.max(0, Math.ceil(hp)) + '/' + mx : '');
    ponClase(d.querySelector('.hp'), 'bajo', mx && hp / mx < .3);
    pintarBarra(d.querySelector('.rc'), x.on && rmx ? rec / rmx : 0);
    ponClase(d, 'sel', !!(objetivo && objetivo.k === 'p' && objetivo.id === x.id));
  });
}

// Botones del marco del objetivo cuando es otro jugador.
function pintarAccionesObjetivo() {
  const q = jugObjetivo();
  const ver = !!(q && !q.muerto);
  ponCss($('o-acc'), 'display', ver ? 'flex' : 'none');
  if (!ver) return;
  const enMiGrupo = grupo && grupo.m.some(x => x.id === q.id);
  ponCss($('o-invitar'), 'display', !enMiGrupo && (!grupo || soyLider()) ? 'block' : 'none');
  const r = miRangoHerm();
  ponCss($('o-herm'), 'display', (r === 'lider' || r === 'oficial') && !q.hn ? 'block' : 'none');
  { const q = jugObjetivo(); const ya = q && contactos.some(x => x.on && x.id === q.id); ponTxt($('o-amigo'), ya ? '★' : '☆'); $('o-amigo').title = ya ? 'Quitar de tus amigos' : 'Añadir a tu lista de amigos'; }
  ponCss($('o-duelo'), 'display', !duelo && !instancia && !MAPAS[mapaId].instancia ? 'block' : 'none');
}
$('o-insp').onclick = () => { const q = jugObjetivo(); if (q) { mandar({ t: 'inspeccionar', p: q.id }); sfx('boton', .3); } };
$('o-amigo').onclick = () => {
  const q = jugObjetivo();
  if (!q) return;
  const ya = contactos.find(x => x.on && x.id === q.id);
  mandar(ya ? { t: 'contactoQuitar', uid: ya.uid } : { t: 'contactoAdd', p: q.id });
  if (ya) aviso('Quitaste a ' + q.n + ' de tus amigos.');
  sfx('boton', .3);
};
$('o-duelo').onclick = () => { const q = jugObjetivo(); if (q) { mandar({ t: 'retar', p: q.id }); sfx('boton', .3); } };

// ── DUELOS ──
// El rival, si el duelo ya empezo (tras la cuenta atras).
function rivalDuelo() {
  if (!duelo || performance.now() < duelo.ini) return null;
  return otros.get(duelo.con) || null;
}
const esRival = q => !!q && q === rivalDuelo();
// Los jugadores no tienen "alto" como los monstruos: para los efectos.
const blancoJug = q => q && { get x() { return q.x; }, get y() { return q.y; }, alto: 60, h: 60, w: 30 };
function empiezaDuelo(m) {
  const otro = m.a === miId ? m.b : m.b === miId ? m.a : 0;
  if (!otro) return;
  const ahora = performance.now();
  duelo = { con: otro, ini: ahora + m.en, fin: ahora + m.en + m.ms };
  objetivo = { k: 'p', id: otro };
  ponCss($('invitacion'), 'display', 'none');
  const n = (otros.get(otro) || {}).n || 'tu rival';
  aviso(`⚔️ Duelo contra ${n}: 90 s, gana quien deje al otro a 1 de vida.`, 'jefe');
  for (let i = 0; i < 3; i++) setTimeout(() => { if (duelo) { flotante(P.x, P.y - 110, String(3 - i), '#ffe600', 18); sfx('boton', .4); } }, i * 1000);
  setTimeout(() => { if (duelo) { flotante(P.x, P.y - 110, '¡A LUCHAR!', '#ff3344', 16); sfx('explosion', .3); } }, m.en);
}
// Marcador del duelo arriba: tiempo que queda y la vida de los dos.
function dibujarDuelo() {
  if (!duelo) return;
  const ahora = performance.now();
  const r = otros.get(duelo.con);
  const pct = q => q && q.mx ? Math.max(0, Math.round(q.hp / q.mx * 100)) : 0;
  const txt = ahora < duelo.ini ? '⚔️ El duelo empieza en ' + Math.ceil((duelo.ini - ahora) / 1000)
    : '⚔️ ' + Math.max(0, Math.ceil((duelo.fin - ahora) / 1000)) + ' s · Tú ' + Math.round(P.hp / (P.maxHp || 1) * 100) + '% · ' + ((r && r.n) || 'Rival') + ' ' + pct(r) + '%';
  etiqueta(VW / 2, 74, txt, '#ffd34d', 8);
}
function finDuelo(m) {
  if (m.a !== miId && m.b !== miId) return;
  duelo = null;
  aviso(m.m, m.g === miId ? 'ok' : '');
  vibrar(m.g === miId ? 'success' : 'warning');
  if (m.g === miId) { sfx('moneda', .5); for (let i = 0; i < 24; i++) particula(P.x, P.y - 40, '#ffe600', 4); }
}
$('o-invitar').onclick = () => { const q = jugObjetivo(); if (q) { mandar({ t: 'invitar', p: q.id }); sfx('boton', .3); } };
$('o-susurrar').onclick = () => { const q = jugObjetivo(); if (!q) return; abrirChat(); $('chat-in').value = '/s ' + q.n + ' '; };

// ── VENTANA SOCIAL (👥, tecla O) ──
let tabSocial = 'grupo', quienLista = [];
document.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => { tabSocial = b.dataset.stab; document.querySelectorAll('[data-stab]').forEach(x => x.classList.toggle('on', x === b)); if (tabSocial === 'online') { mandar({ t: 'quien' }); mandar({ t: 'contactos' }); } pintarSocial(); });
function abrirSocial(tab) {
  if (!yo) return;
  if (tab) { tabSocial = tab; document.querySelectorAll('[data-stab]').forEach(x => x.classList.toggle('on', x.dataset.stab === tab)); }
  abrir('m-social');
  if (tabSocial === 'online') { mandar({ t: 'quien' }); mandar({ t: 'contactos' }); }
  if (tabSocial === 'hermandad') mandar({ t: 'herm' });
  pintarSocial();
}
// Probador de skins (solo se ve en tu pantalla, 10 s).
let probando = null;
// Lo que cambiaria en tus estadisticas con otra skin.
function difSkin(id) {
  if (!yo || !yo.clase) return '';
  const a = statsJugador(yo.nivel, yo.skin, yo.eq, yo.clase, yo.espec, yo.tal, yo.runas);
  const b = statsJugador(yo.nivel, id, yo.eq, yo.clase, yo.espec, yo.tal, yo.runas);
  const l = [];
  const v = (x, y, t) => `<span style="font-weight:700;color:${y > x ? 'var(--ok)' : 'var(--err)'}">${t}</span>`;
  if (b.atk !== a.atk) l.push(`Ataque ${a.atk} → ${v(a.atk, b.atk, b.atk)}`);
  if (b.maxHp !== a.maxHp) l.push(`Vida ${a.maxHp} → ${v(a.maxHp, b.maxHp, b.maxHp)}`);
  if (b.def !== a.def) l.push(`Defensa ${a.def} → ${v(a.def, b.def, b.def)}`);
  if (Math.abs(b.crit - a.crit) > 0.001) l.push(`Crítico ${Math.round(a.crit * 100)}% → ${v(a.crit, b.crit, Math.round(b.crit * 100) + '%')}`);
  return l.length ? '<br><span style="font-size:12px">' + l.map(x => '<span style="white-space:nowrap">' + x + '</span>').join(' · ') + '</span>' : '';
}
const gestos = new Map();   // id de jugador -> { id del gesto, t }
let contactos = [];   // tu lista de amigos [{ uid, n, on, id, lv, cl, mapa, g }]
function conectarListaSocial(L) {
  L.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { mandar({ t: 'invitar', p: +b.dataset.inv }); b.disabled = true; });
  L.querySelectorAll('[data-sus]').forEach(b => b.onclick = () => { cerrarModales(); abrirChat(); $('chat-in').value = '/s ' + b.dataset.sus + ' '; });
  L.querySelectorAll('[data-qamigo]').forEach(b => b.onclick = () => { mandar({ t: 'contactoQuitar', uid: b.dataset.qamigo }); });
}
function pintarSocial() {
  if (!$('m-social').classList.contains('on')) return;
  const L = $('social-lista');
  if (tabSocial === 'grupo') {
    if (!grupo) {
      L.innerHTML = '<p class="centro" style="margin:10px 0">No estás en un grupo.</p><p class="centro" style="font-size:12px;color:var(--txt2)">Toca a otro jugador y pulsa ➕ en su marco, o búscalo en la pestaña «En línea». En grupo compartís la experiencia y las misiones de cada presa (con un 10% extra por miembro) y podéis entrar juntos a las mazmorras.</p>';
      return;
    }
    const tope = grupo.banda ? BANDA_MAX : 5;
    let h = `<p style="font:600 13px var(--sans);color:var(--txt);margin:2px 0 6px">${grupo.banda ? '⚔️ Banda' : '👥 Grupo'} (${grupo.m.length}/${tope})</p>`;
    if (soyLider() && !grupo.banda) h += `<button class="btn sec" id="b-banda" style="width:100%;margin-bottom:8px">⚔️ Convertir en banda (hasta ${BANDA_MAX})</button>`;
    else if (soyLider() && grupo.m.length <= 5) h += '<button class="btn sec" id="b-banda" style="width:100%;margin-bottom:8px">👥 Volver a grupo (hasta 5)</button>';
    for (const x of grupo.m) {
      const cl = CLASES[x.cl];
      const yoEs = x.id === miId && x.on;
      const acc = !soyLider() || yoEs ? '' : `<button class="btn sec" data-lider="${esc(x.uid)}">Hacer líder</button><button class="btn sec" data-echar="${esc(x.uid)}" style="color:var(--err);border-color:var(--err)">Expulsar</button>`;
      h += tarjeta(`<img src="${A}items/equipo/${cl ? cl.icono : 'S_Buff06'}.png">`,
        `<span style="color:${cl ? cl.color : 'var(--txt2)'}">${grupo.lider === x.uid ? '👑 ' : ''}${esc(x.n || '?')}${yoEs ? ' (tú)' : ''}</span>`,
        x.on ? `Nv ${x.lv} ${cl ? esc(cl.nombre) : ''} · ${esc(MAPAS[x.mapa] ? MAPAS[x.mapa].nombre : '')}` : 'Desconectado', acc);
    }
    h += '<button class="btn sec" id="b-salir-grupo" style="width:100%;margin-top:8px">Salir del grupo</button>';
    L.innerHTML = h;
    L.querySelectorAll('[data-lider]').forEach(b => b.onclick = () => mandar({ t: 'liderGrupo', uid: b.dataset.lider }));
    L.querySelectorAll('[data-echar]').forEach(b => b.onclick = () => mandar({ t: 'expulsarGrupo', uid: b.dataset.echar }));
    $('b-salir-grupo').onclick = () => { mandar({ t: 'salirGrupo' }); };
    const bb = $('b-banda'); if (bb) bb.onclick = () => { mandar({ t: 'banda', si: !grupo.banda }); sfx('boton', .3); };
  } else if (tabSocial === 'online') {
    // Arriba, tus amigos (conectados o no); debajo, todos los conectados.
    let h = '<p style="font:600 13px var(--sans);color:var(--txt);margin:2px 0 6px">⭐ Tus amigos</p>';
    h += contactos.length ? contactos.map(x => {
      const cl = CLASES[x.cl];
      const puede = x.on && !x.g && (!grupo || soyLider());
      return tarjeta(`<img src="${A}items/equipo/${cl ? cl.icono : 'S_Buff06'}.png" style="${x.on ? '' : 'filter:grayscale(1);opacity:.5'}">`,
        `<span style="color:${x.on ? (cl ? cl.color : 'var(--txt)') : 'var(--txt3)'}">${esc(x.n)}</span>${x.on ? ' <span style="color:var(--txt2)">Nv ' + x.lv + '</span>' : ''}`,
        x.on ? esc((cl ? cl.nombre + ' · ' : '') + x.mapa + (x.g ? ' · en grupo' : '')) : 'Desconectado',
        (puede ? `<button class="btn" data-inv="${x.id}">Invitar</button>` : '') + (x.on ? `<button class="btn sec" data-sus="${esc(x.n)}">💬</button>` : '') + `<button class="btn sec" data-qamigo="${esc(x.uid)}" title="Quitar de amigos">✕</button>`);
    }).join('') : '<p style="font-size:12px;color:var(--txt2);margin-bottom:8px">Toca a otro jugador y pulsa ⭐ en su marco: verás cuándo se conecta.</p>';
    h += '<p style="font:600 13px var(--sans);color:var(--txt);margin:10px 0 6px">🟢 Conectados</p>';
    if (!quienLista.length) { L.innerHTML = h + '<p class="centro">No hay nadie más conectado ahora mismo.</p>'; conectarListaSocial(L); return; }
    L.innerHTML = h + quienLista.map(x => {
      const cl = CLASES[x.cl];
      const puede = !x.g && (!grupo || soyLider());
      return tarjeta(`<img src="${A}items/equipo/${cl ? cl.icono : 'S_Buff06'}.png">`, `<span style="color:${cl ? cl.color : 'var(--txt2)'}">${esc(x.n)}</span> <span style="color:var(--txt2)">Nv ${x.lv}</span>`,
        esc((cl ? cl.nombre + ' · ' : '') + x.mapa + (x.h ? ' · <' + x.h + '>' : '') + (x.g ? ' · en grupo' : '')),
        (puede ? `<button class="btn" data-inv="${x.id}">Invitar</button>` : '') + `<button class="btn sec" data-sus="${esc(x.n)}">💬</button>`);
    }).join('');
    conectarListaSocial(L);
  } else if (tabSocial === 'amigos') {
    // Se pide una vez (pintarSocial se llama a menudo, p. ej. con el grupo).
    if (amigosInfo) pintarAmigos(amigosInfo); else L.innerHTML = '<p class="centro">Cargando…</p>';
    if (performance.now() - amigosPedidoT > 10000) { amigosPedidoT = performance.now(); mandar({ t: 'amigos' }); }
  }
  else if (pintarHermandad) pintarHermandad(L);
}
// Invita a un amigo: enlace propio (por el bot en Telegram, directo en la web).
let amigosInfo = null, amigosPedidoT = -1e9;
function pintarAmigos(m) {
  amigosInfo = m;
  if (!$('m-social').classList.contains('on') || tabSocial !== 'amigos') return;
  const L = $('social-lista');
  if (!m.ref) { L.innerHTML = '<p class="centro">No se pudo crear tu enlace ahora. Prueba en un momento.</p>'; return; }
  const enlTg = 'https://t.me/duendequest_bot?start=mmo_' + m.ref;
  const enlWeb = location.origin + '/mmo/?ref=' + m.ref;
  const texto = 'Juguemos juntos a DUENDE QUEST ONLINE, el MMORPG de duendes: gratis, en Telegram o en el navegador. 🧝';
  L.innerHTML = `<div class="mis-caja" style="margin-top:0"><b>🤝 Invita a tus amigos</b>
    <p style="font-size:12px">Cuando un amigo que entre con tu enlace llegue a <b style="display:inline">nivel ${m.nivel}</b>, los dos ganan oro: tu amigo, <b style="display:inline">${premioAmigo(m.nivel).oro.toLocaleString('es')} oro</b>, y tú, <b style="display:inline">${premioAmigo(yo ? yo.nivel : 1).oro.toLocaleString('es')} oro</b> a tu nivel actual (sube con tu nivel)${m.max ? ', por tus primeros ' + m.max + ' amigos' : ''}. Al 5º amigo te regalamos el <b style="display:inline">Conejo Saltarín</b> de montura y un título.</p>
    <p style="font-size:12px;margin-top:6px">Amigos que ya llegaron: <b style="display:inline;color:var(--ok)">${m.amigos}</b></p></div>
    <button class="btn" id="b-comp-tg" style="width:100%;padding:12px;margin-bottom:8px">Compartir por Telegram</button>
    <button class="btn sec" id="b-comp-copiar" style="width:100%;margin-bottom:6px">Copiar enlace</button>
    <p style="font-size:11px;word-break:break-all;color:var(--txt2)">${esc(TG ? enlTg : enlWeb)}</p>`;
  $('b-comp-tg').onclick = () => {
    const u = 'https://t.me/share/url?url=' + encodeURIComponent(enlTg) + '&text=' + encodeURIComponent(texto);
    if (TG && TG.openTelegramLink) TG.openTelegramLink(u); else window.open(u, '_blank');
  };
  $('b-comp-copiar').onclick = () => { try { navigator.clipboard.writeText(TG ? enlTg : enlWeb); aviso('📋 Enlace copiado', 'ok'); } catch (e) {} };
}
// ── PRESUMIR ──
// Tras un logro, una mazmorra o un objeto legendario sale un boton unos
// segundos para compartirlo con tu enlace de invitacion (si el amigo llega a
// Nv 10, premio para los dos). Es la forma de que el mundo tenga mas gente.
let presumirTxt = '', presumirPend = false;
function ofrecerPresumir(txt) {
  presumirTxt = txt;
  // El enlace se pide ya: al pulsar, compartir debe ser inmediato (el
  // navegador bloquea compartir si espera a una respuesta del servidor).
  if (!(amigosInfo && amigosInfo.ref) && performance.now() - amigosPedidoT > 10000) { amigosPedidoT = performance.now(); mandar({ t: 'amigos' }); }
  ponCss($('presumir'), 'display', 'block');
  clearTimeout(ofrecerPresumir.t);
  ofrecerPresumir.t = setTimeout(() => ponCss($('presumir'), 'display', 'none'), 12000);
}
function compartirPresumir(info) {
  const enlTg = 'https://t.me/duendequest_bot?start=mmo_' + info.ref;
  const txt = presumirTxt + ' Juega gratis conmigo a DUENDE QUEST ONLINE. 🧝';
  if (TG && TG.openTelegramLink) return TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(enlTg) + '&text=' + encodeURIComponent(txt));
  const enlWeb = location.origin + '/mmo/?ref=' + info.ref;
  const copiar = () => { try { navigator.clipboard.writeText(txt + ' ' + enlWeb).then(() => aviso('📋 Texto y enlace copiados: pégalo donde quieras.', 'ok'), () => {}); } catch (e) {} };
  if (navigator.share) navigator.share({ title: 'DUENDE QUEST ONLINE', text: txt, url: enlWeb }).catch(e => { if (!e || e.name !== 'AbortError') copiar(); });
  else window.open('https://t.me/share/url?url=' + encodeURIComponent(enlWeb) + '&text=' + encodeURIComponent(txt), '_blank');
}
$('presumir').onclick = () => {
  ponCss($('presumir'), 'display', 'none');
  if (amigosInfo && amigosInfo.ref) compartirPresumir(amigosInfo);
  else { presumirPend = true; mandar({ t: 'amigos' }); }
};

$('b-social').onclick = () => abrirSocial();
$('b-mapa').onclick = () => abrirMapaMundo();

// Hermandades: se completa en su seccion (justo debajo).
let pintarHermandad = L => { L.innerHTML = ''; };
// ── HERMANDAD ──
// Gesta semanal de la hermandad: barra con Bronce/Plata/Oro, tu aporte y
// quienes mas suman.
function htmlGesta(hm) {
  const G = hm.gesta;
  if (!G) return '';
  const tope = GESTA_UMBRALES[GESTA_UMBRALES.length - 1];
  const mio = G.c[yo.pid] || 0;
  const nombre = uid => { const x = hm.m.find(y => y.uid === uid); return x ? x.n : '?'; };
  const top = Object.entries(G.c).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let h = '<div style="margin-top:8px;border-top:1px solid var(--borde);padding-top:8px"><b>🏆 Gesta semanal</b>';
  // Una barra por tramo (Bronce, Plata, Oro): cada etiqueta bajo el suyo.
  const cob = yo.gestaCob && yo.gestaCob.sem === G.sem ? yo.gestaCob.n : 0;
  h += '<div style="display:flex;gap:4px;margin:6px 0">' + GESTA_UMBRALES.map((u, i) => {
    const ant = i ? GESTA_UMBRALES[i - 1] : 0;
    const pc = Math.max(0, Math.min(100, (G.p - ant) / (u - ant) * 100));
    return `<div class="mis-barra" style="flex:1;margin:0"><i style="width:${pc}%"></i></div>`;
  }).join('') + '</div>';
  h += '<div style="display:flex;gap:4px;font-size:11px">' + GESTA_UMBRALES.map((u, i) =>
    `<span style="flex:1;color:${G.p >= u ? 'var(--ok)' : 'var(--txt2)'}">${GESTA_NOMBRES[i]} ${u.toLocaleString('es')}<br><span style="color:var(--txt3)">🪙 ${premioGesta(i, yo.nivel).oro.toLocaleString('es')}</span>${G.p >= u ? `<br><span style="color:${i < cob ? 'var(--ok)' : 'var(--warn)'}">${i < cob ? '✓ cobrado' : 'por cobrar'}</span>` : ''}</span>`).join('') + '</div>';
  h += `<p style="font-size:12px;margin-top:6px">${G.p.toLocaleString('es')} puntos · tu aporte: <b style="display:inline;color:${mio >= GESTA_MIN ? 'var(--ok)' : 'var(--warn)'}">${mio}</b>${mio < GESTA_MIN ? ` (cobras desde ${GESTA_MIN})` : ''}</p><p style="font-size:11px;color:var(--txt3)">Se cobra al aportar ${GESTA_MIN} puntos y llevar un día en la hermandad (si no, al volver a entrar o al seguir sumando).</p>`;
  if (top.length) h += '<p style="font-size:12px;color:var(--txt2)">Más aportan: ' + top.map(([u, p]) => `${esc(nombre(u))} ${p}`).join(' · ') + '</p>';
  h += `<p style="font-size:11px;color:var(--txt3);margin-top:4px">${GESTA_PUNTOS.caza} punto por monstruo de tu nivel (o hasta 10 por debajo), ${GESTA_PUNTOS.jefe} por jefe, ${GESTA_PUNTOS.mazmorra} por mazmorra completada y ${GESTA_PUNTOS.pesca} por pez. Se reinicia el lunes.</p></div>`;
  return h;
}
let hermandad = null;           // { id, nombre, motd, m: [{ uid, n, lv, cl, r, on }] }
const RANGO = { lider: '👑 Líder', oficial: '⭐ Oficial', miembro: 'Miembro' };
function miRangoHerm() {
  if (!hermandad || !yo) return null;
  const yoM = hermandad.m.find(x => x.on && x.n === yo.nombre);
  return yoM ? yoM.r : null;
}
pintarHermandad = L => {
  if (!yo) return;
  if (!hermandad) {
    const puede = yo.nivel >= HERM_NIVEL;
    L.innerHTML = `<p class="centro" style="margin:8px 0">No estás en una hermandad.</p>
      <p class="centro" style="font-size:12px;color:var(--txt2)">Una hermandad es tu clan: chat propio (/h), su nombre bajo el tuyo y compañeros con quienes hacer mazmorras. Pide a un líder u oficial que te invite, o funda la tuya.</p>
      <input class="nombre" id="in-herm" maxlength="20" placeholder="Nombre de tu hermandad" ${puede ? '' : 'disabled'}>
      <button class="btn" id="b-herm-crear" style="width:100%;padding:12px" ${puede && yo.oro >= HERM_COSTO ? '' : 'disabled'}>Fundar (${HERM_COSTO.toLocaleString('es')} oro)</button>
      ${puede ? '' : `<p class="centro" style="font-size:12px;color:var(--warn);margin-top:6px">Necesitas nivel ${HERM_NIVEL} para fundar una.</p>`}`;
    const i = $('in-herm');
    i.addEventListener('keydown', e => e.stopPropagation());
    $('b-herm-crear').onclick = () => { const n = i.value.trim(); if (n.length < 3) { i.focus(); return; } if (confirm('¿Fundar la hermandad "' + n + '" por ' + HERM_COSTO.toLocaleString('es') + ' oro?')) mandar({ t: 'hermCrear', nombre: n }); };
    return;
  }
  const r = miRangoHerm();
  const manda = r === 'lider' || r === 'oficial';
  const on = hermandad.m.filter(x => x.on).length;
  let h = `<div class="mis-caja" style="margin-top:0"><b>🛡️ &lt;${esc(hermandad.nombre)}&gt;</b><p style="font-size:12px">${hermandad.m.length} miembros · ${on} en línea · tu rango: ${esc(RANGO[r] || '—')}</p>`;
  h += `<p style="font-size:12px;margin-top:6px;color:var(--txt2)">📜 ${esc(hermandad.motd || 'Sin mensaje del día.')}</p>`;
  h += htmlGesta(hermandad);
  if (manda) h += `<div style="display:flex;gap:6px;margin-top:6px"><input class="nombre" id="in-motd" maxlength="140" placeholder="Nuevo mensaje del día" style="margin:0;font-size:9px;padding:8px"><button class="btn sec" id="b-motd">Guardar</button></div>`;
  h += '</div>';
  for (const x of hermandad.m) {
    const cl = CLASES[x.cl];
    const yoEs = x.on && x.n === yo.nombre;
    let acc = '';
    if (!yoEs && r === 'lider') acc += x.r === 'miembro' ? `<button class="btn sec" data-hr="${esc(x.uid)}" data-r="oficial">Ascender</button>` : x.r === 'oficial' ? `<button class="btn sec" data-hr="${esc(x.uid)}" data-r="miembro">Degradar</button><button class="btn sec" data-hr="${esc(x.uid)}" data-r="lider">Hacer líder</button>` : '';
    if (!yoEs && manda && x.r !== 'lider' && !(r === 'oficial' && x.r === 'oficial')) acc += `<button class="btn sec" data-hx="${esc(x.uid)}" style="color:var(--err);border-color:var(--err)">Expulsar</button>`;
    h += tarjeta(`<img src="${A}items/equipo/${cl ? cl.icono : 'S_Buff06'}.png" style="${x.on ? '' : 'filter:grayscale(1);opacity:.5'}">`,
      `<span style="color:${cl ? cl.color : 'var(--txt2)'}">${esc(x.n)}</span>${yoEs ? ' (tú)' : ''} <span style="color:var(--txt2)">Nv ${x.lv}</span>`,
      `${esc(RANGO[x.r] || '')}${cl ? ' · ' + esc(cl.nombre) : ''} · ${x.on ? '<span style="color:var(--ok)">en línea</span>' : 'desconectado'}`, acc);
  }
  h += `<button class="btn sec" id="b-herm-salir" style="width:100%;margin-top:8px">Dejar la hermandad</button>`;
  L.innerHTML = h;
  L.querySelectorAll('[data-hr]').forEach(b => b.onclick = () => { if (b.dataset.r !== 'lider' || confirm('¿Pasarle el liderazgo?')) mandar({ t: 'hermRango', uid: b.dataset.hr, r: b.dataset.r }); });
  L.querySelectorAll('[data-hx]').forEach(b => b.onclick = () => { if (confirm('¿Expulsar de la hermandad?')) mandar({ t: 'hermExpulsar', uid: b.dataset.hx }); });
  const bm = $('b-motd');
  if (bm) { $('in-motd').addEventListener('keydown', e => e.stopPropagation()); bm.onclick = () => mandar({ t: 'hermMotd', m: $('in-motd').value }); }
  $('b-herm-salir').onclick = () => { if (confirm('¿Dejar la hermandad?' + (r === 'lider' && hermandad.m.length > 1 ? ' El liderazgo pasará a otro miembro.' : r === 'lider' ? ' Eres el último: se disolverá.' : ''))) mandar({ t: 'hermSalir' }); };
};
$('o-herm').onclick = () => { const q = jugObjetivo(); if (q) { mandar({ t: 'hermInvitar', p: q.id }); sfx('boton', .3); } };


// ── MAZMORRAS ──
let muros = [];                 // barreras cerradas de la instancia (x)
let instancia = null;           // { id, nv, hechos }
function topeMuros() { return muros.length ? Math.min(...muros) - 22 : Infinity; }
// Inspeccionar a otro jugador: su equipo puesto, conjuntos y lo que ha hecho.
function pintarInspeccion(m) {
  const cl = CLASES[m.cl];
  let h = `<p style="font:600 15px var(--sans);color:${cl ? cl.color : 'var(--txt)'};margin-bottom:2px">${esc(m.n)} <span style="color:var(--txt2);font-weight:400">Nv ${m.lv}${cl ? ' · ' + esc(cl.nombre) : ''}</span></p>`;
  const extra = [m.ti ? '«' + m.ti + '»' : '', m.herm ? '<' + m.herm + '>' : ''].filter(Boolean).join(' · ');
  if (extra) h += `<p style="font-size:12px;color:var(--txt2);margin-bottom:8px">${esc(extra)}</p>`;
  for (const k in RANURAS) {
    const it = (m.eq || {})[k];
    if (!it || !RAREZAS[it.r]) { h += tarjeta('<span style="color:var(--txt3)">—</span>', `<span style="color:var(--txt3)">${RANURAS[k].nombre}</span>`, 'Vacío', ''); continue; }
    const rz = RAREZAS[it.r];
    h += tarjeta(htmlItem(it), `<span style="color:${rz.color}">${esc(nombreItem(it))}</span> <span style="color:var(--txt2)">Nv${it.nv}</span>`,
      `${rz.nombre} · ${RANURAS[k].nombre} · ${textoBonos(it.b)}${it.cj && CONJUNTOS[it.cj] ? '<br><span style="color:' + CONJUNTOS[it.cj].color + '">' + esc(CONJUNTOS[it.cj].nombre) + '</span>' : ''}`, '');
  }
  const pz = piezasConjunto(m.eq || {});
  for (const id in pz) if (pz[id] >= 2 && CONJUNTOS[id]) h += `<p style="font-size:12px;color:${CONJUNTOS[id].color};margin-top:4px">${esc(CONJUNTOS[id].nombre)}: ${pz[id]} piezas</p>`;
  h += `<p style="font-size:12px;color:var(--txt2);margin-top:8px">🏆 ${m.logros} logros · 🏰 ${m.mazmorras} mazmorras${m.desafioMax ? ' · ⚡ Desafío +' + m.desafioMax : ''}${m.duelos ? ' · ⚔️ ' + m.duelos + ' duelos ganados' : ''}</p>`;
  const ru = m.runas || {};
  const txtRunas = Object.entries(RUNAS).filter(([k]) => ru[k]).map(([k, r]) => `${esc(r.nombre)} ${ru[k]}/${RUNA_MAX}`).join(' · ');
  if (txtRunas || m.titanes || m.pionero) h += `<p style="font-size:12px;color:var(--txt2);margin-top:4px">${txtRunas ? '✨ ' + txtRunas : ''}${m.titanes ? (txtRunas ? ' · ' : '') + '⚔️ Titán vencido ' + m.titanes + ' ' + (m.titanes === 1 ? 'vez' : 'veces') : ''}${m.pionero ? ' · 🌟 Pionero del Abismo' : ''}</p>`;
  $('insp-lista').innerHTML = h;
  abrir('m-inspeccion');
}
// Novedades: una vez por dispositivo y version de NOVEDADES, cuando no hay
// otra ventana abierta (la clase, la recompensa diaria...). Al personaje
// recien creado no: para el todo es nuevo.
// Ventanas que se abren solas (Bóveda, Novedades): una cada vez, con aire entre ellas.
let ventanaAutoT = -1e9;
let ultCastT = -1e9;
function revisarNovedades() {
  if (!yo || !yo.clase || revisarNovedades.hecho || !NOVEDADES.length) return;
  revisarNovedades.hecho = true;
  let visto = 0;
  try { visto = +localStorage.getItem('dq_mmo_nov') || 0; } catch (e) {}
  const ult = NOVEDADES[0].n;
  const guardar = () => { try { localStorage.setItem('dq_mmo_nov', String(ult)); } catch (e) {} };
  if (visto >= ult) return;
  if (yo.nivel < 3 && (yo.kills || 0) < 20) { guardar(); return; }
  let n = 0;
  const t = setInterval(() => {
    if (castYo) ultCastT = performance.now();
    const seguro = !MAPAS[mapaId].zona && !P.muerto && !castYo && performance.now() - ultCastT > 15000;
    if (seguro && !document.querySelector('.modal.on') && performance.now() - ventanaAutoT > 3000) { clearInterval(t); ventanaAutoT = performance.now(); abrirNovedades(); guardar(); }
    else if (++n > 450) clearInterval(t);
  }, 2000);
}
// Calendario: lo que pasa a su hora (en la hora local del jugador).
function htmlCalendario() {
  const ahora = Date.now();
  const hora = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dia = t => new Date(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const l = [];
  const hf = horaFelizTiempos(ahora);
  const hfIni = Date.UTC(new Date(ahora).getUTCFullYear(), new Date(ahora).getUTCMonth(), new Date(ahora).getUTCDate(), HORA_FELIZ.ini);
  l.push(`⚡ <b>Hora Feliz</b> (+50% XP): ${hf.activa ? '<span style="color:var(--ok)">¡ahora mismo!</span>' : 'cada día de ' + hora(hfIni) + ' a ' + hora(hfIni + 3600000)}.`);
  let t = proximoMundial(ahora);
  const jefes = [];
  for (let i = 0; i < 3; i++, t += 1800000) jefes.push(`${hora(t)} ${esc((MONSTRUOS[mundialDe(t + 1000)] || {}).nombre || '')}`);
  l.push(`👹 <b>Jefes mundiales</b> en el Coliseo: ${jefes.join(' · ')}.`);
  l.push(`🧳 <b>Mercader ambulante</b>: ${ambulanteActivo() ? '<span style="color:var(--ok)">está aquí este fin de semana</span>' : 'de viernes a domingo'}.`);
  const lunes = Date.parse(semanaUTC() + 'T00:00:00Z') + 7 * 86400000;
  l.push(`🏆 <b>Cierre de los rankings semanales</b> (experiencia, Torre, Desafíos; premios y todo de cero): ${dia(lunes)} a las ${hora(lunes)}.`);
  const tp = TEMPORADAS.find(x => x.fin > ahora);
  if (tp) l.push(tp.ini <= ahora ? `${tp.emoji} <b>${esc(tp.nombre)}</b>: en marcha hasta el ${esc(tp.hasta)}.` : `${tp.emoji} <b>${esc(tp.nombre)}</b>: empieza el ${dia(tp.ini)}.`);
  return '<div class="mis-caja" style="margin-top:0"><b>📅 Calendario</b><ul style="padding-left:18px;margin-top:4px;font:13px/1.5 var(--sans);color:var(--txt2)">' + l.map(x => `<li>${x}</li>`).join('') + '</ul><p style="font-size:11px;color:var(--txt3)">Horas en la hora de tu dispositivo.</p></div>';
}
function abrirNovedades() {
  let h = htmlCalendario();
  for (const nv of NOVEDADES) {
    h += `<p style="font:600 13px var(--sans);color:var(--txt);margin:6px 0">${esc(nv.fecha)}</p><ul style="padding-left:18px;font:13px/1.5 var(--sans);color:var(--txt2)">`;
    h += nv.items.map(x => `<li style="margin-bottom:4px">${esc(x)}</li>`).join('') + '</ul>';
  }
  $('nov-lista').innerHTML = h;
  abrir('m-novedades');
}
// Boveda semanal: elegir UNO de los objetos que abrieron tus mazmorras de
// la semana pasada. Se ofrece sola una vez por sesion al entrar.
function revisarBoveda() {
  if (!yo || !yo.clase || !yo.bovedaOpc || !yo.bovedaOpc.length || revisarBoveda.hecho) return;
  revisarBoveda.hecho = true;
  // Espera a que se cierre lo que haya abierto (la recompensa diaria, la
  // clase...); si tarda mucho, queda el aviso.
  let n = 0;
  const t = setInterval(() => {
    if (!document.querySelector('.modal.on') && performance.now() - ventanaAutoT > 3000) { clearInterval(t); if (yo.bovedaOpc && yo.bovedaOpc.length) { ventanaAutoT = performance.now(); abrirBoveda(); } }
    else if (++n > 45) { clearInterval(t); aviso('🗝️ Tu Bóveda semanal te espera: ábrela en el portal de mazmorras del pueblo.', 'ok'); }
  }, 2000);
}
function htmlProgresoBoveda() {
  const b = yo.boveda || { n: 0 };
  const sig = BOVEDA_UMBRALES.find(u => b.n < u);
  return `🗝️ <span style="font-weight:700;color:var(--txt)">Bóveda semanal:</span> ${b.n} mazmorra${b.n === 1 ? '' : 's'} esta semana → ${opcionesBoveda(b.n)} de 3 objetos para elegir el lunes${sig ? ` (el siguiente con ${sig})` : ''}.${b.k ? ' Desafío +' + b.k + ': objetos de nivel ' + (NIVEL_MAX + b.k) + '.' : ''}`;
}
function abrirBoveda() {
  if (!yo) return;
  const opc = yo.bovedaOpc || [];
  let h = '';
  if (!opc.length) h += '<p class="centro" style="color:var(--txt2)">Ahora no hay nada que elegir.</p>';
  else {
    h += '<p class="centro" style="margin-bottom:8px;font-size:13px">Tus mazmorras de la semana pasada abrieron estos objetos. <b>Elige uno</b> (los demás se pierden).</p>';
    opc.forEach((it, i) => {
      const rz = RAREZAS[it.r];
      h += tarjeta(htmlItem(it), `<span style="color:${rz.color}">${esc(nombreItem(it))}</span> <span style="color:var(--txt2)">Nv${it.nv}</span>`,
        `${rz.nombre} · ${RANURAS[it.s].nombre} · ${textoBonos(it.b)}`, `<button class="btn" data-bov="${i}">Elegir</button>`);
    });
  }
  h += `<p style="font-size:12px;color:var(--txt2);margin-top:10px">${htmlProgresoBoveda()}</p>`;
  $('boveda-lista').innerHTML = h;
  $('boveda-lista').querySelectorAll('[data-bov]').forEach(b => b.onclick = () => { sfx('moneda', .4); mandar({ t: 'boveda', i: +b.dataset.bov }); cerrarModales(); });
  abrir('m-boveda');
}
// Buscar grupo: anunciarse para una mazmorra y la lista de quien busca.
let lfgLista = [];
function pintarLfg() {
  const L = $('maz-lfg');
  if (!L || !yo) return;
  const mio = lfgLista.find(x => x.yo);
  const abiertas = Object.keys(MAZMORRAS).filter(id => yo.nivel >= MAZMORRAS[id].nv[0]);
  let h = '<b>👥 Buscar grupo</b>';
  if (!abiertas.length) h += `<p style="color:var(--txt2)">Se abre con la primera mazmorra (Nv ${MAZMORRAS[Object.keys(MAZMORRAS)[0]].nv[0]}).</p>`;
  else if (mio) h += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="flex:1;font-size:13px;color:var(--ok)">📢 Buscas grupo para ${esc(MAZMORRAS[mio.id].nombre)} (${mio.m}/${mio.mx || 5})</span><button class="btn sec" id="lfg-quitar">Dejar de buscar</button></div>`;
  else if (!grupo || grupo.lider === yo.pid) h += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><select id="lfg-maz" style="flex:1;min-width:120px">${abiertas.map(id => `<option value="${id}">${esc(MAZMORRAS[id].nombre)}</option>`).join('')}</select><button class="btn" id="lfg-anunciar">📢 Anunciarme</button></div><p style="font-size:12px;color:var(--txt2);margin-top:4px">Se avisa a los conectados con nivel; quien quiera se une a tu grupo con un toque.</p>`;
  const otros = lfgLista.filter(x => !x.yo);
  if (otros.length) h += otros.map(x => { const cl = CLASES[x.cl]; return `<div class="fila" style="align-items:center"><span><b style="color:${cl ? cl.color : 'var(--txt)'}">${esc(x.n)}</b> Nv ${x.nv} · ${esc(MAZMORRAS[x.id].nombre)} · ${x.m}/${x.mx || 5}</span>${grupo ? '' : `<button class="btn" data-lfg="${esc(x.pid)}">Unirme</button>`}</div>`; }).join('');
  else h += '<p style="font-size:12px;color:var(--txt2);margin-top:6px">Nadie más está buscando grupo ahora.</p>';
  L.innerHTML = h;
  const an = $('lfg-anunciar'); if (an) an.onclick = () => { mandar({ t: 'lfg', id: $('lfg-maz').value }); sfx('boton', .3); };
  const qu = $('lfg-quitar'); if (qu) qu.onclick = () => mandar({ t: 'lfgQuitar' });
  L.querySelectorAll('[data-lfg]').forEach(b => b.onclick = () => { mandar({ t: 'lfgUnir', pid: b.dataset.lfg }); sfx('boton', .3); });
}
function abrirBuscador() {
  if (!yo) return;
  const L = $('maz-lista');
  let h = `<p class="centro" style="margin-bottom:8px;font-size:12px">${grupo ? '👥 Entraréis juntos los del grupo que estén en el pueblo (los demás podrán unirse después por este portal).' : 'Entras solo: la mazmorra se ajusta a ti. Con un grupo es más fácil y más divertido (👥).'}</p>`;
  h += '<div class="mis-caja" id="maz-lfg"></div>';
  h += `<div class="mis-caja" style="font-size:13px;color:var(--txt2)">${htmlProgresoBoveda()}${yo.bovedaOpc && yo.bovedaOpc.length ? '<br><button class="btn" id="b-boveda" style="margin-top:8px">🗝️ Abrir la Bóveda</button>' : ''}</div>`;
  // Torre del Duende: pisos sin fin (functions/mmo/torre.js).
  {
    const bloq = yo.nivel < TORRE.nv;
    const tj = tarjeta('<div style="font-size:34px;line-height:52px;text-align:center">🗼</div>', `Torre del Duende <span style="color:${bloq ? 'var(--warn)' : 'var(--txt2)'}">Nv ${TORRE.nv}+</span>`,
      `Pisos sin fin: oleadas de monstruos de tu nivel cada vez más duras y un jefe cada ${TORRE.jefeCada}. Limpia cada piso en ${textoMinutos(TORRE.tiempo)}. Solo o con tu grupo.<br><span style="color:var(--txt2)">Esta semana: piso ${yo.torreSem || 0} · tu récord: ${yo.torreMax || 0}</span><br><span style="color:var(--ok)">Cada 5 pisos nuevos de la semana: cofre con oro y equipo (épico desde el 15).</span>`,
      bloq ? `<span class="precio" style="color:var(--txt3)">🔒 Nv ${TORRE.nv} (te faltan ${TORRE.nv - yo.nivel})</span>` : '<button class="btn" data-torre="1">Subir</button>');
    h += bloq ? tj.replace('<div class="item">', '<div class="item" style="opacity:.55">') : tj;
  }
  let hBanda = '';
  const posBanda = h.length;
  for (const id in MAZMORRAS) {
    const mz = MAZMORRAS[id];
    const bloq = yo.nivel < mz.nv[0];
    if (mz.banda) { hBanda += htmlBanda(id, mz, bloq); continue; }
    const jefes = mz.jefes.map(j => MONSTRUOS[j.k].nombre).join(' · ');
    const hecha = yo.mazDia && yo.mazDia.d === new Date().toISOString().slice(0, 10) && (yo.mazDia.hechas || []).includes(id);
    const estado = bloq ? `<span style="color:var(--warn)">🔒 Se abre a Nv ${mz.nv[0]} (te faltan ${mz.nv[0] - yo.nivel})</span>`
      : `<span style="color:${hecha ? 'var(--txt2)' : 'var(--ok)'}">${hecha ? '✓ Premio del día cobrado' : 'Premio del día disponible: XP, oro y un objeto épico'}</span>`;
    const tj = tarjeta(`<img src="${A}items/equipo/${mz.icono}.png" style="${bloq ? 'filter:grayscale(1);opacity:.4' : ''}">`,
      `${esc(mz.nombre)} <span style="color:${bloq ? 'var(--warn)' : 'var(--txt2)'}">Nv ${mz.nv[0]}-${mz.nv[1]}</span>`,
      `${esc(mz.desc)}<br><span style="color:var(--txt2)">👑 ${esc(jefes)}</span><br>${estado}`,
      bloq ? `<span class="precio" style="color:var(--txt3)">🔒 Nv ${mz.nv[0]}</span>` : `<button class="btn" data-maz="${id}">Entrar</button>`);
    h += bloq ? tj.replace('<div class="item">', '<div class="item" style="opacity:.55">') : tj;
    // Desafios a Nv 60: elegir el +k (hasta uno mas que el mejor vencido).
    if (yo.nivel >= NIVEL_MAX) {
      const mejor = (yo.desafio || {})[id] || 0, tope = Math.min(DESAFIO_MAX, mejor + 1);
      let ops = '';
      for (let k = tope; k >= 1; k--) ops += `<option value="${k}">+${k} · vida ×${multDesafio(k).vida.toFixed(1)}</option>`;
      h += `<div class="mis-caja" style="margin:-4px 0 10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:var(--txt)">⚡ Desafío</b><span style="font-size:12px;color:var(--txt2)">${mejor ? 'Mejor: +' + mejor : 'Aún ninguno'}</span><select data-dk="${id}" style="flex:1;min-width:120px">${ops}</select><button class="btn sec" data-mazk="${id}">Entrar</button></div>`;
    }
  }
  if (yo.nivel >= NIVEL_MAX) {
    h += '<p style="font-size:12px;color:var(--txt2);margin-top:6px">⚡ Desafíos: la misma mazmorra a Nv 60 con monstruos más duros en cada paso. Vencer el +k abre el siguiente y da oro y un objeto de nivel 60+k (se equipa a Nv 60). Logros a +5, +10 y +20.</p>';
    h += htmlAfijos(afijosSemana());
  }
  // A Nv 60 la banda va arriba (abajo quedaba tras 5 mazmorras y los afijos).
  if (yo.nivel >= NIVEL_MAX) h = h.slice(0, posBanda) + hBanda + h.slice(posBanda); else h += hBanda;
  h += '<ul style="padding-left:18px;margin-top:10px;font-size:12px"><li>Aquí los monstruos atacan solos y en packs: tira de uno y vendrá todo su grupo.</li><li>Cada jefe guarda una barrera. Lee sus avisos: <b style="color:var(--warn)">sal de las zonas marcadas</b> en el suelo e <b>interrumpe</b> (Patada, Zurrar, Contrahechizo o Silencio) los hechizos con barra naranja.</li><li>Si caéis todos, revivís en la entrada y el jefe se recupera.</li><li>Cada jefe da equipo a cada uno; el último, épico.</li><li>En la banda, las <b style="color:#facc15">zonas doradas</b> se aguantan <b>juntos</b>: el golpe se reparte entre los que estén dentro.</li></ul>';
  L.innerHTML = h;
  L.querySelectorAll('[data-maz]').forEach(b => b.onclick = () => { sfx('explosion', .3); mandar({ t: 'mazmorra', id: b.dataset.maz }); cerrarModales(); });
  L.querySelectorAll('[data-torre]').forEach(b => b.onclick = () => { sfx('explosion', .3); mandar({ t: 'torre' }); cerrarModales(); });
  pintarLfg();
  mandar({ t: 'lfgLista' });
  const bb = $('b-boveda'); if (bb) bb.onclick = abrirBoveda;
  L.querySelectorAll('[data-mazk]').forEach(b => b.onclick = () => { const sel = L.querySelector(`[data-dk="${b.dataset.mazk}"]`); sfx('explosion', .35); mandar({ t: 'mazmorra', id: b.dataset.mazk, k: +sel.value }); cerrarModales(); });
  abrir('m-mazmorras');
}
// La banda en el portal: sus jefes con el botin de la semana ya cobrado
// (✓), la montura del Titan y el boton para entrar.
function htmlBanda(id, mz, bloq) {
  const b = yo.banda || { j: [], t: 0 };
  const jefes = mz.jefes.map(j => `${b.j.includes(j.k) ? '✓' : '·'} ${esc(MONSTRUOS[j.k].nombre)}`).join(' ');
  const lleva = b.t >= BANDA_MONTURA || (yo.monturas || []).includes('abismo');
  const tj = tarjeta(`<img src="${A}items/equipo/${mz.icono}.png" style="${bloq ? 'filter:grayscale(1);opacity:.4' : ''}">`,
    `⚔️ ${esc(mz.nombre)} <span style="color:${bloq ? 'var(--warn)' : 'var(--txt2)'}">BANDA · Nv ${mz.nv[0]} · 1-${BANDA_MAX}</span>`,
    `${esc(mz.desc.replace(/^BANDA de 1 a 10 jugadores\. /, ''))}<br><span style="color:var(--txt2)">Botín de esta semana (✓ = cobrado): ${jefes}</span><br><span style="color:${lleva ? 'var(--ok)' : 'var(--txt2)'}">🦇 ${esc(MONTURAS.abismo.nombre)}: ${lleva ? '¡ya es tuyo!' : 'Titán vencido ' + b.t + '/' + BANDA_MONTURA + ' semanas'}</span>`,
    bloq ? `<span class="precio" style="color:var(--txt3)">🔒 Nv ${mz.nv[0]}</span>` : `<button class="btn" data-maz="${id}">Entrar</button>`);
  return '<p style="font:600 13px var(--sans);color:var(--txt);margin:12px 0 6px">⚔️ Banda</p>' + (bloq ? tj.replace('<div class="item">', '<div class="item" style="opacity:.55">') : tj)
    + (grupo && !grupo.banda && soyLider() && !bloq ? '<p style="font-size:12px;color:var(--txt2);margin:-4px 0 10px">Para ser más de 5, convierte tu grupo en banda (👥 Social > Grupo) o anúnciate para la banda en el buscador.</p>' : '');
}
// Afijos de la semana de los Desafios (cambian cada lunes UTC).
function htmlAfijos(af) {
  return '<div class="mis-caja" style="margin-top:8px;font-size:12px"><b style="color:var(--txt)">Afijos de esta semana</b>'
    + af.map(a => `<div style="margin-top:4px">${AFIJOS[a].emoji} <b style="color:var(--txt)">${AFIJOS[a].nombre}</b> <span style="color:var(--txt3)">(desde +${AFIJOS[a].desde})</span><br><span style="color:var(--txt2)">${esc(AFIJOS[a].desc)}</span></div>`).join('')
    + `<div style="margin-top:6px;color:var(--txt2)">El mejor +k de la semana entra al ranking semanal de Desafíos (🏆 en el pueblo): el top 3 desde el +${DES_SEM_MIN} gana oro cada lunes.</div></div>`;
}
// Aviso grande en naranja (las mecanicas de los jefes), como los avisos de banda de WoW.
function emote(txt) {
  const c = $('emotes');
  const d = document.createElement('div');
  d.textContent = txt;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3200);
  while (c.children.length > 3) c.firstChild.remove();
  sfx('boton', .35);
}
function completada(m) {
  emote(m.txt);
  ofrecerPresumir('🏆 ' + (MAZMORRAS[m.id] ? 'Completé ' + MAZMORRAS[m.id].nombre + '.' : 'Completé una mazmorra.'));
  aviso(m.txt, 'ok');
  sfx('explosion', .5);
  for (let i = 0; i < 80; i++) particula(P.x + (Math.random() - .5) * 200, P.y - 40 - Math.random() * 60, ['#ffe600', '#ff3cf0', '#00ff88', '#00eeff'][i % 4], 6);
  sacudir = 10;
}
// Barreras magicas: cortinas de luz que se abren al caer su jefe.
function dibujarMuros() {
  for (const mx of muros) {
    const x = mx - camX;
    if (x < -40 || x > VW + 40) continue;
    g.save();
    g.globalCompositeOperation = aditivo();
    const gr = g.createLinearGradient(x - 18, 0, x + 18, 0);
    gr.addColorStop(0, 'rgba(192,132,252,0)'); gr.addColorStop(.5, 'rgba(192,132,252,.55)'); gr.addColorStop(1, 'rgba(192,132,252,0)');
    g.fillStyle = gr; g.fillRect(x - 18, -OY, 36, SUELO + OY);
    g.fillStyle = '#e9d5ff';
    for (let i = 0; i < 9; i++) { const y = (SUELO - ((frame * 1.6 + i * 47) % SUELO)); g.globalAlpha = .7; g.fillRect(x - 2 + Math.sin(frame * .1 + i) * 6, y, 3, 8); }
    g.restore();
  }
}

// ── MAPA DEL MUNDO (tecla M o 🗺️) ──
// Las zonas en orden de nivel, con su jefe; donde estas tu y tu grupo; y las
// mazmorras. Desde aqui se ve de un vistazo a donde ir.
function abrirMapaMundo() {
  if (!yo) return;
  const enGrupo = {};
  if (grupo) for (const x of grupo.m) if (x.on && x.id !== miId && x.mapa) (enGrupo[x.mapa] = enGrupo[x.mapa] || []).push(x.n);
  const zonas = Object.entries(MAPAS).filter(([, m]) => m.zona && !m.instancia && !m.coliseo).sort((a, b) => a[1].nv[0] - b[1].nv[0]);
  const fila = (id, mp, sub, extra) => {
    const aqui = mapaId === id;
    const grupoAqui = enGrupo[id] ? `<br><span style="color:var(--cian)">👥 ${esc(enGrupo[id].join(', '))}</span>` : '';
    const nivelOk = !mp.nv || (yo.nivel >= mp.nv[0] - 2 && yo.nivel <= mp.nv[1] + 4);
    return `<div class="zm ${aqui ? 'aqui' : ''}">
      <b style="color:${mp.paleta.linea}">${aqui ? '📍 ' : ''}${esc(mp.nombre)}</b><small>${sub}${grupoAqui}</small>${extra ? `<i style="color:${nivelOk ? 'var(--ok)' : 'var(--txt2)'}">${extra}</i>` : ''}</div>`;
  };
  let h = '<p class="centro" style="font-size:12px;margin-bottom:8px">Del pueblo salen portales a cada zona; cada zona lleva a la siguiente. En verde, las de tu nivel.</p><div class="mapa-mundo">';
  h += fila('pueblo', MAPAS.pueblo, 'Zona segura · Mercader, Guardia Tito, Sabio y portales', '');
  for (const [id, mp] of zonas) {
    const jefe = mp.jefe ? MONSTRUOS[mp.jefe] : null;
    h += fila(id, mp, jefe ? '👑 ' + esc(jefe.nombre) + ' (Nv ' + jefe.nivel + ')' : '', 'Nv ' + mp.nv[0] + '-' + mp.nv[1]);
  }
  h += '</div><p style="margin:12px 0 6px;font-size:12px;color:var(--txt);font-weight:600">🏰 Mazmorras (portal dorado del pueblo)</p><div class="mapa-mundo">';
  for (const id in MAZMORRAS) {
    const mz = MAZMORRAS[id];
    const mp = MAPAS[mz.mapa];
    h += fila(mz.mapa, mp, (mz.banda ? '⚔️ Banda (1-10) · ' : '') + mz.jefes.map(j => esc(MONSTRUOS[j.k].nombre)).join(' · '), mz.nv[0] === mz.nv[1] ? 'Nv ' + mz.nv[0] : 'Nv ' + mz.nv[0] + '-' + mz.nv[1]);
  }
  h += '</div>';
  h += fila('coliseo', MAPAS.coliseo, '👹 Jefe mundial a las :00 y :30 — todos los niveles', '').replace('class="zm', 'style="margin-top:8px" class="zm');
  $('mapa-lista').innerHTML = h;
  abrir('m-mapa');
}

// ── MUNDO ABIERTO: INVASIONES, ELITES RAROS Y COFRES ──
// El servidor (functions/mmo/eventos.js) decide todo: cuando empieza una
// invasion, quien cobra y que hay en cada cofre. Aqui solo se dibuja, se
// muestra el panel del evento y se pide abrir un cofre.
// Ganchos fuera de esta seccion: recibir (ev/cofres/cofreA), agregarMon
// (o.ex), dibujarMonstruo (tinte), dibujar (cofres y marcas), cercano /
// interactuar (cofre), dibujarMinimapa y pintarCooldowns (panel).
let evento = null;          // { on, mapa, nombre, fin, meta, hechos, fase } o { on: false, txt, hasta } al acabar
let cofres = [];            // { id, x, y, tipo, hasta } (hasta: abierto PARA TI hasta ese momento)
let cofresMapa = '';
const COFRE = {
  comun:      { img: 'cofre_comun',     nombre: 'Cofre común',      color: '#d0d0d0', luz: '220,220,220' },
  epico:      { img: 'cofre_epico',     nombre: 'Cofre épico',      color: '#c084fc', luz: '192,132,252' },
  legendario: { img: 'cofrelegendario', nombre: 'Cofre legendario', color: '#ffd84a', luz: '255,216,74' },
};
for (const k in COFRE) cargar(COFRE[k].img, A + 'cofres/' + COFRE[k].img + '.png');
const COFRE_ALTO = 30;      // alto en pantalla (los dibujos miden 120 px)

function recibirMundoAbierto(m) {
  const ahora = performance.now();
  if (m.t === 'ev') {
    if (m.on) evento = { on: true, mapa: m.mapa, nombre: m.nombre, fin: ahora + m.ms, meta: m.meta, hechos: m.hechos, fase: m.fase };
    else if (m.fin && evento && evento.on) {
      // Queda unos segundos el resultado en el panel.
      evento = { on: false, txt: m.fin === 'ganada' ? '🏆 ¡Invasión rechazada!' : '⌛ La invasión terminó sin premio', ok: m.fin === 'ganada', hasta: ahora + 8000 };
      if (m.mapa === mapaId) sacudir = Math.max(sacudir, m.fin === 'ganada' ? 8 : 0);
    } else if (!m.fin && evento && evento.on) evento = null;
    pintarEvento();
  } else if (m.t === 'cofres') {
    cofres = m.l.map(([id, x, y, tipo, ms]) => ({ id, x, y, tipo, hasta: ms ? ahora + ms : 0 }));
    if (cofresMapa !== m.mapa) { cofresMapa = m.mapa; precalentarZona(m.mapa); }
  } else if (m.t === 'cofreA') {
    const cf = cofres.find(c => c.id === m.id);
    if (!cf) return;
    cf.hasta = ahora + m.ms;
    const C = COFRE[m.tipo] || COFRE.comun;
    sfx('moneda', .5); sfx('explosion', .25);
    for (let i = 0; i < 26; i++) particula(cf.x, cf.y - 16, i % 2 ? C.color : '#ffe600', 4);
    for (let i = 0; i < Math.min(8, 3 + Math.floor(m.oro / 40)); i++) monedas.push({ x: cf.x, y: cf.y - 10, vx: (Math.random() - .5) * 5, vy: -4 - Math.random() * 3, t: 0 });
    flotante(cf.x, cf.y - 40, '+' + m.oro + ' oro', '#ffe600', 11);
    let txt = '🗝️ ' + C.nombre + ': +' + m.oro.toLocaleString('es') + ' oro';
    if (m.pociones) { flotante(cf.x, cf.y - 54, '+' + m.pociones + ' poción', '#ff6b9d', 9); txt += ' · +' + m.pociones + ' poción' + (m.pociones > 1 ? 'es' : ''); }
    if (m.item) {
      const rz = RAREZAS[m.item.r];
      flotante(cf.x, cf.y - 68, '★ ' + nombreItem(m.item), rz.color, 10);
      txt += ' · ' + rz.nombre + ': ' + nombreItem(m.item);
    }
    aviso(txt, 'ok');
  }
}

// Las copias teñidas (raro dorado/plateado, capitan) se preparan al entrar a
// la zona y de a una: crearlas cuando aparece el raro daba un tiron.
function precalentarZona(id) {
  const mp = MAPAS[id];
  if (!mp || !mp.monstruos) return;
  const tareas = [];
  for (const k of mp.monstruos) for (const t of ['#ffd84a', '#e5e7eb', '#ff5a1f']) tareas.push(['sh_' + MONSTRUOS[k].hoja, t]);
  const paso = () => { const t = tareas.shift(); if (!t) return; tenido(t[0], t[1]); setTimeout(paso, 30); };
  setTimeout(paso, 200);
}

function cofreCercano() {
  const ahora = performance.now();
  for (const c of cofres) if (c.hasta <= ahora && Math.abs(P.x - c.x) < 60 && Math.abs(P.y - c.y) < 60) return { tipo: 'cofre', c };
  return null;
}
function abrirCofre(c) { mandar({ t: 'cofre', id: c.id }); }

function dibujarCofres() {
  const ahora = performance.now();
  for (const c of cofres) {
    const x = c.x - camX;
    if (x < -60 || x > VW + 60) continue;
    const C = COFRE[c.tipo] || COFRE.comun;
    const im = IMG[C.img];
    const abierto = c.hasta > ahora;
    const cerca = Math.abs(P.x - c.x) < 200;
    if (!abierto) {
      // Luz que late y alguna chispa: se ve de lejos que hay algo que abrir.
      g.save(); g.globalCompositeOperation = aditivo();
      const rg = g.createRadialGradient(x, c.y - 14, 2, x, c.y - 14, 42);
      rg.addColorStop(0, `rgba(${C.luz},${.32 + Math.sin(frame * .08) * .12})`); rg.addColorStop(1, `rgba(${C.luz},0)`);
      g.fillStyle = rg; g.fillRect(x - 44, c.y - 58, 88, 70); g.restore();
      if (frame % 20 === 0) particula(c.x + (Math.random() - .5) * 30, c.y - 20 - Math.random() * 12, C.color, 1.2);
    }
    if (im && im.naturalWidth) {
      const h = COFRE_ALTO, w = im.naturalWidth * h / im.naturalHeight;
      const flota = abierto ? 0 : Math.sin(frame * .06 + c.id) * 1.5;
      g.save(); g.globalAlpha = abierto ? .35 : 1;
      g.drawImage(im, x - w / 2, c.y - h + 2 + flota, w, h);
      g.restore();
    }
    if (cerca) {
      if (abierto) etiqueta(x, c.y - COFRE_ALTO - 8, '✓ ' + Math.ceil((c.hasta - ahora) / 60000) + ' min', 'rgba(255,255,255,.55)', 6);
      else etiqueta(x, c.y - COFRE_ALTO - 8, C.nombre, C.color, 6);
    }
  }
}

// Marcas sobre los monstruos especiales: el raro (★, con destellos de su
// color), el Capitan de la invasion y una llamita sobre cada invasor.
function dibujarMarcasEspeciales() {
  for (const o of mons.values()) {
    const ex = o.ex;
    if (!ex || o.muereT) continue;
    const x = o.x - camX;
    if (x < -150 || x > VW + 150) continue;
    const arriba = o.y - o.alto - 24;
    // El nombre no se sale por el borde (en movil la vista mide 400).
    const xe = Math.max(80, Math.min(VW - 80, x));
    if (ex.raro) {
      if (frame % 6 === 0) particula(o.x + (Math.random() - .5) * o.w, o.y - Math.random() * o.alto, ex.ti || '#ffd84a', 1.4);
      etiqueta(xe, arriba, '★ Raro · ' + ex.nom, ex.ti || '#ffd84a', 6);
    } else if (ex.cap) {
      etiqueta(xe, arriba, '⚔ ' + ex.nom, '#ff7a3c', 7);
      barraMini(x, arriba + 4, 60, o.hp / o.mx, '#ff7a3c');
    } else if (ex.ev) {
      emoji('🔥', 10, x, arriba - 2 + Math.sin(frame * .15 + o.id) * 2);
    }
  }
}

function dibujarMiniMundoAbierto(k, y) {
  const ahora = performance.now();
  for (const c of cofres) {
    mg.fillStyle = c.hasta > ahora ? 'rgba(255,255,255,.25)' : (COFRE[c.tipo] || COFRE.comun).color;
    mg.fillRect(4 + c.x * k - 2, y - 7, 4, 4);
  }
  for (const o of mons.values()) {
    if (!o.ex || o.muereT) continue;
    const mx = 4 + o.x * k;
    if (o.ex.raro || o.ex.cap) {
      // Rombo: el raro de su color, el Capitan en rojo.
      mg.fillStyle = o.ex.raro ? (o.ex.ti || '#ffd84a') : '#ff5a1f';
      mg.beginPath(); mg.moveTo(mx, y - 6); mg.lineTo(mx + 4, y); mg.lineTo(mx, y + 6); mg.lineTo(mx - 4, y); mg.fill();
    } else if (o.ex.ev) { mg.fillStyle = '#ff9a3c'; mg.fillRect(mx - 1, y + 3, 2, 3); }
  }
  // Invasion en esta zona: el borde del minimapa se enciende.
  if (evento && evento.on && evento.mapa === mapaId) {
    mg.strokeStyle = `rgba(255,122,60,${.5 + Math.sin(frame * .2) * .3})`; mg.lineWidth = 2;
    mg.strokeRect(1, 1, mini.width - 2, mini.height - 2);
  }
}

// Panel del evento en el seguimiento de la derecha (bajo la mision).
function pintarEvento() {
  const el = $('h-evento');
  const ahora = performance.now();
  if (evento && !evento.on && ahora > evento.hasta) evento = null;
  if (!evento) { ponCss(el, 'display', 'none'); return; }
  if (!el.firstChild) el.innerHTML = '<b></b><span></span><i><u></u></i>';
  ponCss(el, 'display', 'block');
  const [t1, t2, barra] = el.children;
  if (!evento.on) {
    ponTxt(t1, evento.txt); ponTxt(t2, '');
    ponCss(barra, 'display', 'none');
    ponClase(el, 'lista', !!evento.ok); ponClase(el, 'aqui', false);
    return;
  }
  const ms = Math.max(0, evento.fin - ahora);
  const reloj = Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  const aqui = evento.mapa === mapaId;
  const zona = MAPAS[evento.mapa] ? MAPAS[evento.mapa].nombre : '';
  ponTxt(t1, '🔥 ' + evento.nombre + (aqui ? '' : ' · ' + zona));
  ponTxt(t2, '⏱ ' + reloj + ' · ' + (evento.fase === 'capitan' ? '¡Derrota al Capitán!' : 'Invasores ' + evento.hechos + '/' + evento.meta));
  ponCss(barra, 'display', 'block');
  ponCss(barra.firstChild, 'width', (evento.fase === 'capitan' ? 100 : Math.round(evento.hechos / evento.meta * 100)) + '%');
  ponClase(el, 'lista', evento.fase === 'capitan' || ms < 60000);
  ponClase(el, 'aqui', aqui);
}

// ── CLASES Y LIBRO DE HECHIZOS ──
function abrirClases(obligatorio) {
  if (!yo) return;
  const cont = $('clases');
  const costo = yo.clase ? costoCambioClase(yo.nivel) : 0;
  $('clase-cerrar').style.display = obligatorio ? 'none' : '';
  $('clase-txt').textContent = yo.clase
    ? (costo ? 'Cambiar de clase a tu nivel cuesta ' + costo.toLocaleString('es') + ' oro.' : 'Hasta nivel 10 cambiar de clase es gratis.')
    : 'Cada clase juega distinto y cumple un papel en el grupo: el tanque aguanta, el sanador cura y los demás hacen daño. Hasta nivel 10 puedes cambiarla gratis.';
  cont.innerHTML = Object.entries(CLASES).map(([id, cl]) => {
    const habs = habsDe(id).map(h => `<img src="${A}items/equipo/${h.icono}.png" title="${esc(h.nombre)} (Nv ${h.nv})">`).join('');
    return `<div class="clase ${yo.clase === id ? 'sel' : ''}" data-clase="${id}" style="--c:${cl.color}">
      <div class="cab"><img src="${A}items/equipo/${cl.icono}.png" alt=""><div><b>${esc(cl.nombre)}</b><small>${esc(cl.rol)} · ${esc(RECURSOS[cl.recurso].nombre)}</small></div></div>
      ${!yo.clase && id === 'guerrero' ? '<span class="reco">Recomendada para empezar</span>' : ''}<p>${esc(cl.desc)}</p><div class="habs">${habs}</div></div>`;
  }).join('');
  if (!yo.clase) cont.insertAdjacentHTML('afterbegin', '<p class="centro" style="grid-column:1/-1;font-size:13px;color:var(--txt2);margin:0">Toca una clase para elegirla.</p>');
  cont.querySelectorAll('[data-clase]').forEach(b => b.onclick = () => {
    const id = b.dataset.clase;
    if (id === yo.clase) { cerrarModales(); return; }
    if (yo.clase && costo && !confirm('¿Cambiar a ' + CLASES[id].nombre + ' por ' + costo.toLocaleString('es') + ' oro?')) return;
    sfx('explosion', .35);
    mandar({ t: 'clase', id });
    cerrarModales();
  });
  abrir('m-clase');
}
function abrirLibro() {
  if (!yo) return;
  if (!yo.clase) { abrirClases(true); return; }
  abrir('m-libro');
  pintarLibro();
}
function pintarLibro() {
  const cl = CLASES[yo.clase];
  $('libro-t').innerHTML = `📖 <span style="color:${cl.color}">${esc(cl.nombre.toUpperCase())}</span>`;
  // "PÍCARO": la fuente pixel no tiene letras con tilde.
  $('libro-t').classList.toggle('sans', /[^ -~]/.test(cl.nombre));
  const rec = RECURSOS[cl.recurso].nombre;
  let h = `<p class="centro" style="margin-bottom:6px">${esc(cl.rol)} · recurso: <b style="color:${RECURSOS[cl.recurso].color}">${esc(rec)}</b></p>`;
  // Especializaciones (desde Nv 10).
  h += `<p style="font-size:12px;margin:6px 0 4px;color:var(--txt);font-weight:600">✨ Especialización ${yo.nivel < ESPEC_NIVEL ? '(desde nivel ' + ESPEC_NIVEL + ')' : '(cambio gratis fuera de combate)'}</p><div class="clases" style="margin-bottom:10px">`;
  for (const [id, e] of Object.entries(ESPECS[yo.clase])) {
    const sel = yo.espec === id && yo.nivel >= ESPEC_NIVEL;
    h += `<div class="clase ${sel ? 'sel' : ''}" data-espec="${id}" style="--c:${cl.color};${yo.nivel < ESPEC_NIVEL ? 'opacity:.5;cursor:default' : ''}">
      <div class="cab"><img src="${A}items/equipo/${e.icono}.png" alt=""><div><b>${esc(e.nombre)}${sel ? ' ✓' : ''}</b><small>${esc(e.rol)}</small></div></div><p style="display:block">${esc(e.desc)}</p></div>`;
  }
  h += '</div>';
  for (const hb of HABS.filter(x => x.clase === yo.clase)) {
    const bloq = yo.nivel < hb.nv;
    const costo = costoHab(hb, P.recMax || yo.recMax || 0, yo.espec);
    const datos = [hb.costo ? costo + ' ' + rec.toLowerCase() : 'sin costo', hb.cast ? (hb.cast / 1000).toLocaleString('es') + ' s de lanzamiento' : 'instantánea', hb.cd ? 'recarga ' + Math.round(hb.cd / 1000) + ' s' : '', hb.rango ? 'alcance ' + hb.rango : ''].filter(Boolean).join(' · ');
    const ico = `<img src="${A}items/equipo/${hb.icono}.png" style="${bloq ? 'filter:grayscale(1);opacity:.4' : ''}">`;
    const tecla = hb.barra === false ? 'Botón de acción' : 'Tecla ' + (habsDe(yo.clase).indexOf(hb) + 1);
    h += tarjeta(ico, esc(hb.nombre) + ` <span style="color:${bloq ? 'var(--warn)' : 'var(--txt2)'}">Nv ${hb.nv}</span>`, esc(hb.desc) + '<br><span style="color:var(--txt2)">' + esc(datos) + '</span>',
      `<span class="precio" style="color:${bloq ? 'var(--txt3)' : 'var(--txt)'}">${bloq ? '🔒' : esc(tecla)}</span>`);
  }
  // Talentos: un punto por nivel desde el 10.
  const tal = yo.tal || {};
  const libres = puntosTalento(yo.nivel) - Object.values(tal).reduce((a, b) => a + b, 0);
  h += `<p style="font-size:12px;margin:12px 0 4px;color:var(--txt);font-weight:600">🌟 Talentos ${yo.nivel < TALENTO_NIVEL ? '(desde nivel ' + TALENTO_NIVEL + ')' : '· puntos libres: <b>' + libres + '</b>'}</p><div class="talentos">`;
  for (const t of TALENTOS) {
    const r = tal[t.id] || 0;
    h += `<div class="tal ${r ? 'on' : ''}"><img src="${A}items/equipo/${t.icono}.png" alt=""><div><b>${esc(t.nombre)} ${r}/${TALENTO_MAX}</b><small>${esc(t.txt)} por rango</small></div><button class="btn sec" data-tal="${t.id}" ${libres > 0 && r < TALENTO_MAX ? '' : 'disabled'}>+</button></div>`;
  }
  h += '</div>';
  if (Object.keys(tal).length) h += `<button class="btn sec" id="b-tal-reset" style="width:100%;margin-top:6px">Reiniciar talentos (${costoReinicioTalentos(yo.nivel).toLocaleString('es')} oro)</button>`;
  const costoC = costoCambioClase(yo.nivel);
  h += `<button class="btn sec" id="b-cambiar-clase" style="width:100%;margin-top:8px">Cambiar de clase${costoC ? ' (' + costoC.toLocaleString('es') + ' oro)' : ' (gratis hasta Nv 10)'}</button>`;
  $('libro-lista').innerHTML = h;
  $('b-cambiar-clase').onclick = () => abrirClases(false);
  $('libro-lista').querySelectorAll('[data-tal]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'talento', id: b.dataset.tal }); });
  const br = $('b-tal-reset'); if (br) br.onclick = () => { if (confirm('¿Reiniciar todos tus talentos por ' + costoReinicioTalentos(yo.nivel).toLocaleString('es') + ' oro?')) mandar({ t: 'talentoReset' }); };
  $('libro-lista').querySelectorAll('[data-espec]').forEach(b => b.onclick = () => { if (yo.nivel >= ESPEC_NIVEL && yo.espec !== b.dataset.espec) { sfx('explosion', .3); mandar({ t: 'espec', id: b.dataset.espec }); } });
}

// ── GUIA: flecha hacia el objetivo y tutorial del jugador nuevo ──
// Lo que mas hacia abandonar en la primera partida era no saber adonde ir:
// la mision decia "Bosque Nocturno" pero nada señalaba el camino. La flecha
// amarilla apunta siempre al siguiente paso: el portal correcto (buscando
// la ruta entre zonas), la presa de la mision o el Guardia Tito.

// Primer portal del camino mas corto hasta otro mapa (por portales).
function portalHacia(destino) {
  if (mapaId === destino || !MAPAS[destino]) return null;
  const prev = { [mapaId]: null };
  const cola = [mapaId];
  while (cola.length) {
    const m = cola.shift();
    if (m === destino) break;
    MAPAS[m].portales.forEach((p, i) => {
      if (!p.a || p.fin || !MAPAS[p.a] || MAPAS[p.a].instancia || p.a in prev) return;
      prev[p.a] = { de: m, i };
      cola.push(p.a);
    });
  }
  if (!(destino in prev)) return null;
  let m = destino;
  while (prev[m] && prev[m].de !== mapaId) m = prev[m].de;
  return prev[m] ? MAPAS[mapaId].portales[prev[m].i] : null;
}
function objetivoGuia() {
  if (!yo || !yo.clase || P.muerto || instancia || !yo.mis) return null;
  const q = MISIONES[yo.mis.i];
  if (!q) return null;
  if (yo.mis.p >= q.n) {
    const tito = MAPAS.pueblo.npcs.find(n => n.tipo === 'guia');
    if (mapaId === 'pueblo') return { x: tito.x, txt: '❗ Entrega: Guardia Tito' };
    const p = portalHacia('pueblo');
    return p ? { x: p.x, y: SUELO - 150, txt: 'Vuelve al pueblo (o 🌀)' } : null;
  }
  const zona = zonaDe(q.tipo);
  if (zona && mapaId !== zona) {
    const p = portalHacia(zona);
    return p ? { x: p.x, y: SUELO - 150, txt: '> ' + MAPAS[zona].nombre } : null;
  }
  const def = MONSTRUOS[q.tipo];
  let mejor = null, md = Infinity;
  for (const o of mons.values()) if (o.k === q.tipo && !o.muereT && Math.abs(o.x - P.x) < md) { md = Math.abs(o.x - P.x); mejor = o; }
  if (mejor) return { x: mejor.x, y: mejor.y - mejor.alto - 18, txt: def.nombre, mon: mejor };
  if (def.jefe && MAPAS[mapaId].jefe === q.tipo) return { x: MAPAS[mapaId].ancho * 0.62, txt: def.nombre + ' (reaparece pronto)' };
  // Ninguno a la vista: donde suelen salir (su tramo del mapa, como en el servidor).
  const lista = MAPAS[mapaId].monstruos || [];
  const i = lista.indexOf(q.tipo);
  if (i >= 0) { const tramo = (MAPAS[mapaId].ancho - 500) / lista.length; return { x: 250 + tramo * (i + 0.5), txt: def.nombre + ' (reaparecen aquí)' }; }
  return null;
}
// La guia se recalcula 4 veces por segundo (busca rutas entre zonas); en
// cada fotograma solo se sigue al monstruo elegido.
let guiaCache = null, guiaT = 0;
function guiaActual() {
  const ahora = performance.now();
  if (ahora - guiaT > 250) { guiaT = ahora; guiaCache = objetivoGuia(); }
  const ob = guiaCache;
  if (ob && ob.mon) {
    if (ob.mon.muereT || !mons.has(ob.mon.id)) { guiaT = 0; return null; }
    ob.x = ob.mon.x; ob.y = ob.mon.y - ob.mon.alto - 18;
  }
  return ob;
}
function dibujarGuia() {
  if (MAPAS[mapaId].torre) return;   // en la Torre solo cuenta el piso
  const ob = guiaActual();
  if (!ob) return;
  const x = ob.x - camX;
  const bote = Math.sin(frame * .12) * 4;
  g.save();
  g.fillStyle = '#ffe600'; g.strokeStyle = '#000'; g.lineWidth = 2;
  if (x > 24 && x < VW - 24) {
    // A la vista: flecha que rebota sobre el objetivo.
    const y = (ob.y || SUELO - 110) + bote;
    if (!ob.mon || Math.abs(ob.x - P.x) > 60) {
      g.beginPath(); g.moveTo(x - 9, y - 14); g.lineTo(x + 9, y - 14); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke();
      etiqueta(x, y - 20, ob.txt, '#ffe600', 6);
    }
  } else {
    // Fuera de la vista: flecha en el borde con la distancia.
    const der = x >= VW - 24;
    // Por encima de los iconos de los NPC (el ? de Tito caia encima).
    const ex = der ? VW - 14 + bote * .5 : 14 - bote * .5, y = SUELO - 150;
    g.beginPath();
    if (der) { g.moveTo(ex, y); g.lineTo(ex - 16, y - 11); g.lineTo(ex - 16, y + 11); }
    else { g.moveTo(ex, y); g.lineTo(ex + 16, y - 11); g.lineTo(ex + 16, y + 11); }
    g.closePath(); g.fill(); g.stroke();
    // De 5 en 5 m: cada metro distinto era otro texto que dibujar y guardar.
    const dist = Math.max(5, Math.round(Math.abs(ob.x - P.x) / 50) * 5);
    const t = ob.txt + ' · ' + dist + ' m';
    const w = spriteTexto(t, TAM_MIN(6), '#ffe600', true, false).width - 8;   // misma cache que etiqueta()
    etiqueta(der ? ex - 24 - w / 2 : ex + 24 + w / 2, y + 3, t, '#ffe600', 6);
  }
  g.restore();
}

// Tutorial de los primeros minutos: un consejo cada vez, que se cumple solo
// al hacerlo. Se guarda por personaje en este dispositivo.
const TUTORIAL = [
  { id: 'mover', txt: () => TACTIL ? '👆 Muévete con ◀ ▶' : '⌨️ Muévete con ← → (o A / D)', hecho: t => Math.abs(P.x - t.x0) > 120 },
  { id: 'ir', txt: () => '🟡 Sigue la flecha amarilla: te lleva a tu misión', hecho: t => (yo.kills || 0) > t.k0 || (MAPAS[mapaId].zona && !instancia) },
  { id: 'atacar', txt: () => TACTIL ? '⚔️ Pega con el botón rojo (mantenlo pulsado)' : '⚔️ Pega con Z (o J); Tab elige al enemigo', hecho: t => (yo.kills || 0) > t.k0 },
  { id: 'habilidad', txt: () => '✨ Usa tu habilidad: ' + (TACTIL ? 'el primer botón de la barra' : 'tecla 1'), hecho: t => t.usoHab },
  { id: 'mision', txt: () => (yo.mis && MISIONES[yo.mis.i] && yo.mis.p >= MISIONES[yo.mis.i].n ? '✅ ¡Misión cumplida! Sigue la flecha y entrégasela al Guardia Tito' : '📜 Completa la misión y la flecha te llevará al Guardia Tito'), hecho: () => (yo.mis && yo.mis.i >= 1) },
];
const tuto = { i: -1, x0: 0, k0: 0, usoHab: false, clave: '' };
function pintarTutorial() {
  const el = $('consejo');
  if (!yo || !yo.clase || yo.nivel > 6 || $('m-clase').classList.contains('on')) { ponCss(el, 'display', 'none'); return; }
  const clave = 'dq_tuto_' + (yo.pid || '');
  if (tuto.clave !== clave) {
    tuto.clave = clave;
    let i = 0; try { i = +(localStorage.getItem(clave) || 0); } catch (e) {}
    tuto.i = i; tuto.x0 = P.x; tuto.k0 = yo.kills || 0; tuto.usoHab = false;
  }
  const paso = TUTORIAL[tuto.i];
  if (!paso) { ponCss(el, 'display', 'none'); return; }
  if (paso.hecho(tuto)) {
    tuto.i++; tuto.x0 = P.x; tuto.k0 = yo.kills || 0;
    try { localStorage.setItem(clave, String(tuto.i)); } catch (e) {}
    sfx('moneda', .3);
    return;
  }
  ponCss(el, 'display', 'block');
  ponTxt(el, paso.txt() + '  (' + (tuto.i + 1) + '/' + TUTORIAL.length + ')');
}

// Mundo abierto: caminar contra el borde de una zona pasa a la siguiente
// por su portal, sin tener que pararse a pulsar "entrar".
// Tras cada viaje hay que soltar la direccion: si no, al llegar junto al
// portal de vuelta (pueblo ↔ bosque) se rebotaba entre los dos mapas. En
// las mazmorras no: alejarse a la izquierda te sacaba sin querer.
let bordeT = 0, bordeSoltar = false;
function viajePorBorde(izq, der) {
  const mp = MAPAS[mapaId];
  if (!izq && !der) { bordeSoltar = false; return; }
  if (bordeSoltar || instancia || mp.instancia || castYo || P.muerto || performance.now() - bordeT < 1500) return;
  const enBorde = (izq && P.x <= 16) || (der && P.x >= mp.ancho - 16);
  if (!enBorde) return;
  const i = mp.portales.findIndex(p => p.a && !p.buscador && !p.fin && Math.abs(p.x - P.x) < 85);
  if (i < 0) return;
  bordeT = performance.now(); bordeSoltar = true;
  const dest = MAPAS[mp.portales[i].a];
  if (dest && dest.nv && yo.nivel < dest.nv[0] - 5) { errorRojo(`⚠️ ${dest.nombre} es de nivel ${dest.nv[0]}-${dest.nv[1]}. Si de verdad quieres ir, entra por su portal (E).`); return; }
  mandar({ t: 'portal', i });
}

// Barra de XP: la parte de descanso se ve en azul por delante de la tuya.
function pintarDescanso() {
  const b = $('bxp');
  let d = b.querySelector('b');
  if (!d) { d = document.createElement('b'); d.className = 'desc'; b.appendChild(d); }
  if (!yo || !yo.xpSig) return;
  const ini = Math.min(100, yo.xp / yo.xpSig * 100);
  const w = Math.min(100 - ini, (yo.descanso || 0) / yo.xpSig * 100);
  ponCss(d, 'left', ini + '%');
  ponCss(d, 'width', Math.max(0, w) + '%');
  b.title = 'Experiencia: ' + yo.xp.toLocaleString('es') + ' / ' + yo.xpSig.toLocaleString('es') + ((yo.descanso || 0) > 0 ? ' · 😴 descanso: +' + yo.descanso.toLocaleString('es') + ' XP (cazas al doble)' : '');
}

// ── RECOLECCION Y ARTESANIA ──
// Plantas y vetas de la zona (el servidor dice cuando vuelve a estar lista
// cada una para ti) y la ventana de la Artesana Lila.
let nodos = [];
['I_Leaf', 'I_Rock01', 'I_Crystal01'].forEach(k => cargar('ico_' + k, A + 'items/equipo/' + k + '.png'));
function recibirNodos(l) { const t = performance.now(); nodos = (l || []).map(n => ({ ...n, listo: t + (n.en || 0) })); }
function nodoCercano() {
  for (const n of nodos) if (Math.abs(P.x - n.x) < 55) return { tipo: 'nodo', n };
  return null;
}
function dibujarNodos() {
  const ahora = performance.now();
  for (const n of nodos) {
    const x = n.x - camX;
    if (x < -30 || x > VW + 30) continue;
    const listo = ahora >= n.listo;
    const img = IMG['ico_' + MATERIALES[n.tipo].icono];
    // Sin 'lighter' (mezcla cara en el movil) ni save/restore por nodo.
    if (listo) {
      g.globalAlpha = .25 + Math.sin(frame * .08 + n.i) * .1;
      g.fillStyle = n.tipo === 'hierba' ? '#4ade80' : '#cbd5e1';
      g.beginPath(); g.ellipse(x, SUELO - 10, 18, 7, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = listo ? 1 : .3;
    if (img && img.naturalWidth) g.drawImage(img, x - 12, SUELO - 26 + (listo ? Math.sin(frame * .05 + n.i) * 1.5 : 0), 24, 24);
  }
  g.globalAlpha = 1;
}
function abrirArtesana() {
  if (!yo) return;
  const mat = yo.mat || {};
  let h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-bottom:10px">' +
    Object.entries(MATERIALES).map(([k, m]) => `<span style="display:flex;align-items:center;gap:4px;font:12px/1.3 var(--sans);color:var(--txt2)"><img src="${A}items/equipo/${m.icono}.png" style="width:22px;height:22px;image-rendering:pixelated">${esc(m.nombre)}: ${mat[k] || 0}</span>`).join('') + '</div>';
  for (const r of RECETAS) {
    const pide = Object.entries(r.pide).map(([k, n]) => `<span style="color:${(mat[k] || 0) >= n ? 'var(--ok)' : 'var(--err)'}">${n} ${esc(MATERIALES[k].nombre)}</span>`).join(' + ');
    const puede = Object.entries(r.pide).every(([k, n]) => (mat[k] || 0) >= n);
    h += tarjeta(`<img src="${A}${r.dir || 'items/equipo/'}${r.icono}.png">`, esc(r.nombre), esc(r.desc) + '<br>' + pide,
      `<button class="btn" data-receta="${r.id}" ${puede ? '' : 'disabled'}>Fabricar</button>`);
  }
  // Runas: mejoras permanentes de nivel alto (+2% por rango).
  h += `<p style="font:600 13px var(--sans);color:var(--txt);margin:12px 0 6px">✨ Runas permanentes${yo.nivel < RUNA_NIVEL ? ` <span style="color:var(--warn)">(desde Nv ${RUNA_NIVEL})</span>` : ''}</p>`;
  for (const [id, ru] of Object.entries(RUNAS)) {
    const r = (yo.runas || {})[id] || 0;
    let det = r ? `Rango ${r}/${RUNA_MAX}: +${Math.round(r * RUNA_PCT * 100)}% de ${ru.desc}.` : `Sin grabar (hasta +${Math.round(RUNA_MAX * RUNA_PCT * 100)}% de ${ru.desc}).`;
    let acc = '<span class="precio" style="color:var(--ok)">✓ Máxima</span>';
    if (r < RUNA_MAX) {
      const cos = costoRuna(id, r + 1);
      const pide = Object.entries(cos.mat).map(([k, n]) => `<span style="color:${(mat[k] || 0) >= n ? 'var(--ok)' : 'var(--err)'}">${n} ${esc(MATERIALES[k].nombre)}</span>`).join(' + ')
        + ` + <span style="color:${yo.oro >= cos.oro ? 'var(--ok)' : 'var(--err)'}">🪙 ${cos.oro.toLocaleString('es')}</span>`;
      const puede = yo.nivel >= RUNA_NIVEL && yo.oro >= cos.oro && Object.entries(cos.mat).every(([k, n]) => (mat[k] || 0) >= n);
      det += `<br>Rango ${r + 1} (+${Math.round((r + 1) * RUNA_PCT * 100)}%): ${pide}`;
      acc = `<button class="btn" data-runa="${id}" ${puede ? '' : 'disabled'}>Grabar</button>`;
    }
    h += tarjeta(`<img src="${A}items/equipo/${ru.icono}.png">`, esc(ru.nombre), det, acc);
  }
  h += '<p style="margin-top:8px;font-size:12px;color:var(--txt2)">Las plantas 🌿 y vetas ⛏️ brillan en el suelo de cada zona: acércate y pulsa E (o RECOGER). El pescado sale de los pesqueros 🎣 (uno en el pueblo y otro en cada zona; no se agotan, hasta 80 capturas al día). Cada una vuelve a crecer a los 5 minutos. El Cristal Arcano sale a veces al recoger, o se refina con 8 minerales. En las zonas de Nv 30+ salen también Flor de Luna y Mithril; la Esencia Abisal la sueltan los jefes de mazmorras de nivel 40 o más a quien pelea (y el doble los de la banda).</p>';
  const ven = $('arte-lista').closest('.ventana'), sc = ven ? ven.scrollTop : 0, scl = $('arte-lista').scrollTop;
  $('arte-lista').innerHTML = h;
  $('arte-lista').querySelectorAll('[data-receta]').forEach(b => b.onclick = () => { sfx('moneda', .4); mandar({ t: 'fabricar', id: b.dataset.receta }); });
  $('arte-lista').querySelectorAll('[data-runa]').forEach(b => b.onclick = () => { sfx('moneda', .5); mandar({ t: 'runa', id: b.dataset.runa }); });
  abrir('m-arte');
  // Al recibir "yo" se repinta: que no salte arriba (las runas van al final).
  if (ven) ven.scrollTop = sc;
  $('arte-lista').scrollTop = scl;
}

// ── BESTIARIO ──
// Premio fisico: un litro de chicha morada (functions/mmo/chicha.js).
function pintarChicha() {
  const ch = yo.chicha || { p: 0, hoy: 0, rec: [] };
  const cuenta = TG || !soyInvitado;
  // Invitado: el aviso va arriba, con el boton para seguir en Telegram.
  let h = cuenta ? '' : '<div class="seguridad centro" style="margin-top:0;color:var(--txt)">Juegas como invitado: los puntos de chicha se juntan solo con cuenta de Telegram.<a class="btn" href="https://t.me/duendequest_bot" target="_blank" rel="noopener" style="display:block;margin-top:10px;text-decoration:none;color:#fff">Abrir en Telegram</a></div>';
  h += `<div class="mis-caja" style="margin-top:0;text-align:center"><div style="font-size:40px">🥤</div><b style="color:var(--txt);font:600 16px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin-bottom:0">Un litro de chicha morada, enviado a tu casa</b>
    <p style="font-size:12px;color:var(--txt2);margin-top:4px">Promoción gratuita y opcional: no hay que comprar nada.</p>
    <p style="font-size:12px;margin-top:6px">Cada monstruo que cazas suelta su chicha: <b style="display:inline">1 punto</b>, <b style="display:inline">3</b> si es de tu nivel o más, <b style="display:inline">25</b> un jefe. Desde nivel ${CHICHA.nvPuntos}, hasta ${CHICHA.porDia} puntos al día.</p>
    <p style="font-size:22px;color:var(--oro);margin:8px 0">${ch.p.toLocaleString('es')} puntos</p>
    <p style="font-size:12px;color:var(--txt2)">Hoy: ${ch.hoy}/${CHICHA.porDia}</p></div>`;
  for (const meta of CHICHA.niveles) {
    const hecho = (ch.rec || []).includes(meta);
    const pct = Math.min(100, Math.round(ch.p / meta * 100));
    const acc = hecho ? '<span class="precio" style="color:var(--ok)">✓ Reclamado</span>'
      : ch.p >= meta ? `<button class="btn" data-chicha="${meta}">Reclamar</button>` : `<span class="precio">${pct}%</span>`;
    h += tarjeta('<div style="font-size:30px">🥤</div>', `${meta.toLocaleString('es')} puntos`, `Un litro de chicha morada peruana enviado a tu casa.<div class="mis-barra"><i style="width:${pct}%"></i></div>`, acc);
  }
  h += `<ul style="padding-left:18px;margin-top:8px;font-size:12px;line-height:1.45;color:var(--txt2)">
    <li>Promoción gratuita: no hay que comprar nada. Los puntos no se compran, no se venden y no se gastan al reclamar.</li>
    <li>Para reclamar: nivel ${CHICHA.nvReclamo}, personaje de 2 días y entrar con Telegram. El equipo te escribirá por Telegram para pedirte la dirección; nunca te pediremos pagos ni contraseñas.</li>
    <li>Envíos desde Perú, revisados uno a uno (las trampas o bots quedan fuera). Hay ${CHICHA.mesMax} litros al mes: si se acaban, tus puntos te esperan al mes siguiente.</li></ul>`;
  h += '<p class="centro" style="font-size:12px;color:var(--txt2);margin-top:10px">🔒 Nunca te pediremos contraseñas, frases semilla ni pagos por mensaje privado.</p>';
  $('inv-lista').innerHTML = h;
  $('inv-lista').querySelectorAll('[data-chicha]').forEach(b => b.onclick = () => { if (confirm('¿Reclamar tu litro de chicha morada? El equipo te escribirá por Telegram.')) { mandar({ t: 'chicha', meta: +b.dataset.chicha }); b.disabled = true; } });
}

function pintarBestiario() {
  const best = yo.best || {};
  const lista = Object.entries(MONSTRUOS).filter(([, m]) => !m.mundial).sort((a, b) => a[1].nivel - b[1].nivel);
  const vistos = lista.filter(([k]) => best[k]).length;
  let h = `<p class="centro" style="margin-bottom:8px">${vistos} de ${lista.length} monstruos cazados · hitos de ${BESTIARIO_HITOS.join(', ')} con premio de oro</p>`;
  for (const [k, m] of lista) {
    const n = best[k] || 0;
    const sig = BESTIARIO_HITOS.find(x => x > n);
    const i = BESTIARIO_HITOS.indexOf(sig);
    const desc = n ? (sig ? `${n} / ${sig} · próximo premio: ${premioBestiario(m.nivel, i).toLocaleString('es')} oro` : `${n} · ✓ completo`) : `Sin cazar · Nv ${m.nivel}${m.jefe ? ' · jefe' : ''}`;
    h += tarjeta(n ? `<canvas data-best="${k}" width="52" height="52"></canvas>` : '❔', n ? esc(m.nombre) + ` <span style="color:var(--txt2)">Nv ${m.nivel}</span>` : '<span style="color:var(--txt3)">???</span>', desc,
      `<span class="precio" style="color:${!sig && n ? 'var(--ok)' : 'var(--oro)'}">${'★'.repeat(BESTIARIO_HITOS.filter(x => x <= n).length)}${'☆'.repeat(BESTIARIO_HITOS.filter(x => x > n).length)}</span>`);
  }
  $('inv-lista').innerHTML = h;
  $('inv-lista').querySelectorAll('canvas[data-best]').forEach(c => {
    const m = MONSTRUOS[c.dataset.best], hoja = HOJAS[m.hoja];
    const img = m.tinte ? tenido('sh_' + m.hoja, m.tinte) : IMG['sh_' + m.hoja];
    if (!img || !(img.naturalWidth || img.width)) return;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const e = Math.min(46 / hoja.ideal, 70 / hoja.fw);
    x.save(); x.translate(26, 50); if (hoja.izq) x.scale(-1, 1);
    x.drawImage(img, hoja.mov[1] * hoja.fw, hoja.mov[0] * hoja.fh, hoja.fw, hoja.fh, -hoja.fw * e / 2, -hoja.fh * e, hoja.fw * e, hoja.fh * e);
    x.restore();
  });
}

// ── TITULOS / LOGROS ──
function tituloDe(id) { const L = LOGROS.find(x => x.id === id); return L ? L.titulo : ''; }
function pintarLogros() {
  const tienen = yo.logros || [];
  let h = `<p class="centro" style="margin-bottom:8px">${tienen.length} de ${LOGROS.length} logros · cada uno da oro y un título para lucir sobre tu nombre</p>`;
  if (yo.titulo) h += `<button class="btn sec" data-titulo="" style="width:100%;margin-bottom:8px">Quitar título</button>`;
  for (const L of LOGROS) {
    const ok = tienen.includes(L.id);
    const acc = !ok ? `<span class="precio" style="color:var(--txt3)">🔒 +${L.oro.toLocaleString('es')}</span>`
      : yo.titulo === L.id ? '<span class="precio" style="color:var(--ok)">✓ En uso</span>'
      : `<button class="btn sec" data-titulo="${L.id}">Usar título</button>`;
    // Los que se cuentan: barra de progreso mientras no se tienen.
    const pr = !ok && progresoLogro(L.id, { ...yo, amigos: yo.amigosN || 0 });
    const barra = pr && pr[0] > 0 ? `<div class="mis-barra"><i style="width:${Math.round(pr[0] / pr[1] * 100)}%"></i></div><small style="color:var(--txt2)">${pr[0].toLocaleString('es')} / ${pr[1].toLocaleString('es')}</small>` : '';
    h += tarjeta(ok ? '🏅' : '🔒', esc(L.titulo), esc(L.desc) + barra, acc);
  }
  $('inv-lista').innerHTML = h;
  $('inv-lista').querySelectorAll('[data-titulo]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'titulo', id: b.dataset.titulo }); });
}

// ── EQUIPO ──
const puntaje = b => (b.atk || 0) * 3 + (b.def || 0) * 2 + (b.hp || 0) * 0.3 + (b.crit || 0) * 300;
function htmlItem(it) {
  const rz = RAREZAS[it.r];
  return `<img src="${A}items/equipo/${iconoItem(it)}.png" style="filter:drop-shadow(0 0 4px ${rz.color})">`;
}
// Se puede usar a tu nivel (lo de los Desafios, nivel 60+k, se usa a Nv 60).
const puedeUsar = it => it.nv <= yo.nivel || (!!it.des && yo.nivel >= NIVEL_MAX);
function pintarEquipo() {
  const eq = yo.eq || {}, bolsa = yo.bolsa || [];
  // Tus estadisticas de un vistazo (y lo que pone tu skin).
  const sk = SKINS[yo.skin];
  let h = `<div class="mis-caja" style="margin-top:0;font-size:13px;display:flex;flex-wrap:wrap;gap:4px 14px"><span>⚔️ Ataque <b>${yo.atk}</b></span><span>🛡️ Defensa <b>${yo.def}</b></span><span>❤️ Vida <b>${yo.maxHp}</b></span><span>🎯 Crítico <b>${Math.round((yo.crit || 0) * 100)}%</b></span>${sk && sk.buffs ? `<span style="flex-basis:100%;color:${sk.color}">Skin ${esc(sk.nombre)}: ${esc(sk.desc)}</span>` : ''}</div>`;
  h += '<div class="ranuras">';
  for (const k in RANURAS) {
    const it = eq[k];
    h += it
      ? `<div class="ranura" data-quitar="${k}" title="Quitar" style="border-color:${RAREZAS[it.r].color}">${htmlItem(it)}<small>${RANURAS[k].nombre}</small></div>`
      : `<div class="ranura vacia"><span>—</span><small>${RANURAS[k].nombre}</small></div>`;
  }
  h += '</div>';
  // Conjuntos que llevas puestos (aunque sea una pieza): cuantas y su bono.
  const pz = piezasConjunto(eq);
  for (const id in pz) {
    const cj = CONJUNTOS[id];
    h += `<p class="centro" style="margin:4px 0;font-size:12px;color:${cj.color}">◆ ${esc(cj.nombre)} ${pz[id]}/5 — ${pz[id] >= 4 ? 'bono completo' : pz[id] >= 2 ? 'bono de 2 activo' : 'sin bono aún'}<br><span style="color:var(--txt2)">${esc(textoConjunto(cj))}</span></p>`;
  }
  h += `<p class="centro" style="margin:6px 0">🎒 Bolsa ${bolsa.length}/${BOLSA_MAX} · toca una pieza puesta para quitarla</p>`;
  const comunes = bolsa.filter(x => x.r === 0);
  // Lo mejor de la bolsa para cada ranura (que se pueda usar a tu nivel).
  const mejoras = Object.keys(RANURAS).map(k => {
    const puesto = eq[k];
    // No se rompe un conjunto activo (2+ piezas) por una pieza suelta.
    const protege = puesto && puesto.cj && piezasConjunto(eq)[puesto.cj] >= 2;
    const cand = bolsa.filter(x => x.s === k && puedeUsar(x) && (!protege || x.cj === puesto.cj)).sort((a, b) => puntaje(b.b) - puntaje(a.b))[0];
    return cand && (!puesto || puntaje(cand.b) > puntaje(puesto.b)) ? cand : null;
  }).filter(Boolean);
  if (mejoras.length) h += `<button class="btn" id="b-equipar-mejor" style="width:100%;margin-bottom:8px">▲ Equipar lo mejor (${mejoras.length})</button>`;
  if (comunes.length) h += `<button class="btn sec" id="b-vender-comunes" style="width:100%;margin-bottom:8px">Vender ${comunes.length} comunes (+${comunes.reduce((a, x) => a + precioVenta(x), 0).toLocaleString('es')} oro)</button>`;
  if (!bolsa.length) h += '<p class="centro" style="color:var(--txt2)">Los monstruos sueltan equipo al morir, y los jefes siempre.</p>';
  const orden = [...bolsa].sort((a, b) => b.r - a.r || b.nv - a.nv);
  for (const it of orden) {
    const rz = RAREZAS[it.r];
    const puesto = eq[it.s];
    const dif = puntaje(it.b) - (puesto ? puntaje(puesto.b) : 0);
    const rompe = puesto && puesto.cj && puesto.cj !== it.cj && piezasConjunto(eq)[puesto.cj] >= 2;
    const flecha = dif > 0 && !rompe ? '<span style="color:var(--ok)"> ▲ Mejor</span>' : dif > 0 ? '<span style="color:var(--warn)"> ⚠ rompe tu conjunto</span>' : '';
    const puede = puedeUsar(it);
    const acc = (puede ? `<button class="btn" data-eq="${it.id}">Equipar</button>` : `<span class="precio" style="color:var(--warn)">Nv ${it.nv}</span>`)
      + `<button class="btn sec" data-vender="${it.id}">Vender ${precioVenta(it)}</button>`;
    h += tarjeta(htmlItem(it), `<span style="color:${rz.color}">${esc(nombreItem(it))}</span> <span style="color:var(--txt2)">Nv${it.nv}</span>${flecha}`,
      `${rz.nombre} · ${RANURAS[it.s].nombre} · ${textoBonos(it.b)}${it.cj && CONJUNTOS[it.cj] ? '<br><span style="color:' + CONJUNTOS[it.cj].color + '">Conjunto: ' + esc(textoConjunto(CONJUNTOS[it.cj])) + '</span>' : ''}`, acc);
  }
  $('inv-lista').innerHTML = h;
  const L = $('inv-lista');
  L.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'item', a: 'equipar', id: b.dataset.eq }); });
  L.querySelectorAll('[data-vender]').forEach(b => b.onclick = () => { sfx('moneda', .3); mandar({ t: 'item', a: 'vender', id: b.dataset.vender }); });
  L.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'item', a: 'quitar', ranura: b.dataset.quitar }); });
  const bm = $('b-equipar-mejor');
  if (bm) bm.onclick = () => { sfx('boton', .4); mejoras.forEach(x => mandar({ t: 'item', a: 'equipar', id: x.id })); };
  const bv = $('b-vender-comunes');
  if (bv) bv.onclick = () => { sfx('moneda', .4); comunes.forEach(x => mandar({ t: 'item', a: 'vender', id: x.id })); };
}

// ── RECOMPENSA DIARIA ──
// El premio diario de un personaje sin clase espera a que la elija: si no,
// la ventana de clase lo tapaba y el novato nunca veia el calendario.
let loginPend = null;
function mostrarLogin(m) {
  if (!yo || !yo.clase) { loginPend = m; return; }
  let h = '<div class="dias">';
  LOGIN_PREMIOS.forEach((pr, i) => {
    const n = i + 1;
    const cls = n < m.racha ? 'hecho' : n === m.racha ? 'hoy' : '';
    h += `<div class="dia ${cls}"><b>Día ${n}</b><span>${n === 7 ? '🎁' : pr.oro ? '🪙' : '🧪'}</span><small>${esc(pr.txt)}</small></div>`;
  });
  h += '</div>';
  let txt = 'Hoy recibes ' + m.txt + '.';
  if (m.oro) txt = 'Hoy recibes ' + m.oro.toLocaleString('es') + ' oro' + (m.item ? ' y ' + RAREZAS[m.item.r].nombre.toLowerCase() + ': ' + nombreItem(m.item) : '') + '.';
  ponTxt($('login-ok'), m.oro ? 'Recoger ' + m.oro.toLocaleString('es') + ' oro' : 'Recoger');
  $('login-cuerpo').innerHTML = h + `<p class="centro" style="margin-top:12px;color:var(--ok);font-weight:600">${esc(txt)}</p><p class="centro" style="font-size:12px;color:var(--txt2)">Vuelve mañana para el día ${m.racha % 7 + 1}. Si faltas un día, retrocede dos; si faltas más, vuelve a empezar. El oro crece con tu nivel.</p>`;
  abrir('m-login');
  sfx('moneda', .5);
}

// ── JEFE MUNDIAL ──
let mundial = { vivo: false, en: 0 };
function pintarMundial() {
  const el = $('h-mundial');
  if (!yo) return;
  // En la Torre: el piso y el tiempo que le queda.
  if (MAPAS[mapaId].torre && torreInfo) {
    const ms = Math.max(0, torreInfo.fin - performance.now()), mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
    ponTxt(el, '🗼 Piso ' + torreInfo.piso + (torreInfo.piso && ms ? ' · ⏳ ' + mm + ':' + String(ss).padStart(2, '0') : ''));
    el.className = ms && ms < 30000 ? '' : 'lista';
    return;
  }
  // Hora Feliz: mientras dura, manda en esta linea (y 30 min antes, avisa).
  const hf = horaFelizTiempos(Date.now());
  const msM = mundial.en ? mundial.en - performance.now() : 0;
  // Con el jefe mundial en pie (o a menos de 5 min), primero el jefe.
  if ((hf.activa || hf.falta < 30 * 60000) && !mundial.vivo && !(msM > 0 && msM < 300000)) {
    const ms = hf.activa ? hf.acaba : hf.falta, mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
    ponTxt(el, hf.activa ? '⚡ Hora Feliz: +50% XP · ' + mm + ':' + String(ss).padStart(2, '0') : '⚡ Hora Feliz en ' + mm + ':' + String(ss).padStart(2, '0'));
    el.className = hf.activa ? 'lista' : '';
    return;
  }
  const extraHf = hf.activa ? ' · ⚡ +50% XP' : '';
  // Al novato el contador del jefe mundial solo le distrae de su mision.
  if (yo.nivel < 10) { ponTxt(el, ''); el.className = ''; return; }
  const nomM = (MONSTRUOS[mundial.k] || {}).nombre || 'Jefe mundial';
  if (mundial.vivo) { ponTxt(el, '👹 ' + nomM + ' en el Coliseo (portal del pueblo)' + extraHf); el.className = 'lista'; return; }
  const ms = mundial.en - performance.now();
  if (mundial.en && ms > 0) {
    const mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
    ponTxt(el, '👹 ' + nomM + ' en ' + mm + ':' + String(ss).padStart(2, '0') + extraHf);
    el.className = ms < 120000 ? 'lista' : '';
  } else { ponTxt(el, ''); el.className = ''; }
}

// ── mTON / WALLET TON / RETIROS ──
// La wallet se conecta con TON Connect (Tonkeeper, MyTonWallet, la wallet de
// Telegram...) tanto en Telegram como en la web; la libreria se carga solo
// al abrir esta ventana para no pesar en la carga del juego. El servidor
// guarda la direccion y decide todo lo demas (saldo, retiros).
let fondoInfo = null, tonUI = null;
// 6100 mTON -> "6,1" (con coma: "6.100 TON" se lee seis mil cien en español).
const tonTxt = mton => (mton / MTON_POR_TON).toLocaleString('es', { maximumFractionDigits: 3 });
function abrirWallet() { if (!yo) return; abrir('m-wallet'); mandar({ t: 'fondo' }); pintarWallet(); }
function cargarTonConnect() {
  if (window.TON_CONNECT_UI) return Promise.resolve();
  return new Promise((ok, mal) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/@tonconnect/ui@2/dist/tonconnect-ui.min.js';
    sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar TON Connect'));
    document.head.appendChild(sc);
  });
}
async function conectarWallet() {
  try {
    await cargarTonConnect();
    if (!tonUI) {
      tonUI = new window.TON_CONNECT_UI.TonConnectUI({ manifestUrl: 'https://duende-quest.alfonso12hc.workers.dev/tonconnect-manifest.json' });
      // Dentro de Telegram, al aprobar en la wallet hay que volver al bot.
      if (TG) tonUI.uiOptions = { actionsConfiguration: { twaReturnUrl: 'https://t.me/duendequest_bot' } };
      tonUI.onStatusChange(w => { if (w && w.account && w.account.address) mandar({ t: 'wallet', a: w.account.address }); });
    }
    if (tonUI.wallet && tonUI.wallet.account) { mandar({ t: 'wallet', a: tonUI.wallet.account.address }); return; }
    await tonUI.openModal();
  } catch (e) { aviso('No se pudo abrir la conexión de wallet: ' + (e.message || e)); }
}
function pintarWallet() {
  if (!yo) return;
  const el = yo.p2e || {};
  const mton = yo.mton || 0;
  const pct = Math.min(100, Math.round(mton / RETIRO_MIN_MTON * 100));
  const w = yo.wallet;
  const lista = w && Date.now() - w.desde >= WALLET_ESPERA_MS;
  const fila = (ok, txt) => `<div class="req"><span>${txt}</span><span class="${ok ? 'si' : 'no'}">${ok ? '✓' : '✗'}</span></div>`;
  let h = '<p class="centro" style="font-size:12px;color:var(--txt2);margin-bottom:8px">Recompensa opcional: los mTON solo se ganan jugando (no se compran) y salen de un fondo diario limitado.</p>';
  h += `<div class="saldo"><b>${mton.toLocaleString('es')} mTON</b><small>= ${tonTxt(mton)} TON · 1.000 mTON = 1 TON</small></div>`;
  h += `<div class="mis-barra"><i style="width:${pct}%"></i></div><p class="centro" style="font-size:12px">${pct}% del retiro mínimo (${RETIRO_MIN_MTON / MTON_POR_TON} TON)</p>`;
  if (!el.cuenta) {
    h += '<p class="centro" style="margin:12px 0;font-size:13px;color:var(--warn)">Juegas como invitado. Para recibir mTON y retirar TON, entra desde el bot de Telegram (@duendequest_bot) o inicia sesión en el juego web.</p>';
  }
  h += '<div style="margin:10px 0">' +
    fila(el.cuenta, 'Cuenta de Telegram o web') +
    fila(el.nivel, 'Nivel ' + MTON_NIVEL_MIN + ' o más (tienes ' + yo.nivel + ')') +
    fila(el.edad, 'Personaje con 2 días de vida') +
    fila(!!w, 'Wallet TON conectada') +
    fila(lista, 'Wallet conectada hace 3 días (seguridad)') +
    fila(mton >= RETIRO_MIN_MTON, 'Saldo de ' + (RETIRO_MIN_MTON / MTON_POR_TON) + ' TON') + '</div>';
  if (w) h += `<p class="centro" style="font-size:12px;word-break:break-all;margin-bottom:8px">👛 ${esc(w.a)}</p>`;
  if (el.cuenta) h += `<button class="btn sec" id="b-conectar" style="width:100%;margin-bottom:8px">${w ? 'Cambiar wallet TON' : 'Conectar wallet TON'}</button>`;
  const puede = el.cuenta && el.nivel && lista && mton >= RETIRO_MIN_MTON;
  const aRetirar = Math.min(Math.floor(mton), RETIRO_MAX_MTON);
  h += `<button class="btn" id="b-retirar" style="width:100%;padding:12px" ${puede ? '' : 'disabled'}>Retirar ${tonTxt(aRetirar)} TON</button>`;
  h += '<button class="btn sec" id="b-premium" style="width:100%;margin-top:8px">Tienda premium (oro y poderes)</button>';
  const tr = yo.transparencia;
  if (tr) h += `<div class="mis-caja" style="margin-top:12px"><b>📊 Transparencia</b><p style="font-size:12px;color:var(--txt2)">${tr.pct ? 'El fondo de cada día es el <b style="display:inline;color:var(--txt)">' + tr.pct + '%</b> de lo que entró al juego la semana anterior, más lo que aporta El Duende.' : 'El fondo de cada día lo aporta El Duende, el creador: no sale de lo que pagan otros jugadores.'} Nunca se reparte más de lo que hay. Pagado a jugadores hasta hoy: <b style="display:inline;color:var(--txt)">${tonTxt(tr.tonPagados * MTON_POR_TON)} TON</b> en ${tr.retirosPagados} retiro(s).</p></div>`;
  if (fondoInfo) {
    const resta = Math.max(0, fondoInfo.total - fondoInfo.gastado);
    h += `<p class="centro" style="margin-top:10px;font-size:12px;color:var(--txt2)">Fondo de hoy para todos: ${tonTxt(resta)} de ${tonTxt(fondoInfo.total)} TON por repartir</p>`;
    // Claridad: con el fondo a cero no se gana mTON, y se dice sin rodeos.
    if (!fondoInfo.total) h += `<p class="centro" style="font-size:12px;color:var(--warn)">⚠️ Hoy el fondo está vacío: nadie gana mTON hasta que entren ingresos al juego. El oro, los objetos y todo lo demás siguen igual.</p>`;
  }
  const rs = yo.retiros || [];
  if (rs.length) {
    h += '<div style="margin-top:10px">' + rs.slice().reverse().map(x => `<div class="fila"><span>#${esc(x.id)} · ${x.ton} TON</span><span style="color:${x.estado === 'pagado' ? 'var(--ok)' : x.estado === 'rechazado' ? 'var(--err)' : 'var(--warn)'}">${esc(x.estado.charAt(0).toUpperCase() + x.estado.slice(1).replace(/_/g, ' '))}</span></div>`).join('') + '</div>';
  }
  h += '<ul style="padding-left:18px;margin-top:12px;font-size:12px;line-height:1.45;color:var(--txt2)">' +
    '<li>Ganas mTON derrotando <b>jefes</b> (si haces al menos el 10% del daño), en el <b>jefe mundial</b> y al cobrar la <b>caza del día</b>.</li>' +
    `<li>Cada día se reparte un fondo limitado entre todos y nadie se lleva más del ${Math.round(TOPE_DIARIO_PCT * 100)}%: cuando se acaba, vuelve mañana.</li>` +
    `<li>Un retiro por semana, de ${RETIRO_MIN_MTON / MTON_POR_TON} a ${RETIRO_MAX_MTON / MTON_POR_TON} TON (lo que pase de ${RETIRO_MAX_MTON / MTON_POR_TON} queda para el siguiente).</li>` +
    '<li>Los retiros los revisa el equipo y se pagan a tu wallet en 24-48 h. Usar bots o varias cuentas anula el retiro.</li></ul>';
  $('wallet-cuerpo').innerHTML = h;
  const bc = $('b-conectar'); if (bc) bc.onclick = () => { sfx('boton', .3); conectarWallet(); };
  const bp = $('b-premium'); if (bp) bp.onclick = abrirPremium;
  const br = $('b-retirar');
  if (br) br.onclick = () => {
    if (!confirm('¿Retirar ' + tonTxt(aRetirar) + ' TON a ' + (w ? w.a : '') + '?')) return;
    sfx('moneda', .5); mandar({ t: 'retirar' });
  };
}

// ── TIENDA PREMIUM (Stars en Telegram, SOL en la web) ──
// Con dinero se compran cosas del juego, nunca mTON. Cada compra la revisa y
// entrega El Duende a mano: aqui solo se pide y se paga.
function htmlPremium() {
  const cuentaTg = !!TG && !forzarInvitado;
  const cuenta = yo && yo.p2e && yo.p2e.cuenta;
  let h = '<p style="font-size:13px;line-height:1.45;color:var(--txt2);margin-bottom:10px">Compras opcionales para apoyar el juego: recibes oro y poderes en tu personaje. Cada pago lo revisa <b>El Duende</b> en persona y te lo entrega en tu personaje (te avisamos aquí y por Telegram). Con dinero <b>no</b> se compran mTON: los TON solo se ganan jugando.</p>';
  for (const pq of PAQUETES) {
    let acc;
    if (pq.skin && yo && (yo.skins || []).includes(pq.skin)) acc = '<span class="precio" style="color:var(--ok)">✓ Ya la tienes</span>';
    else if (!cuenta) acc = '<a class="btn sec" href="/game.html" style="text-decoration:none">Iniciar sesión</a>';
    else if (cuentaTg) acc = `<span class="precio">⭐ ${estrellasDe(pq.usd)}</span><button class="btn" data-premium="${pq.id}" data-metodo="stars">Pagar con Stars</button>`;
    else acc = `<span class="precio">~$${pq.usd} en SOL</span><button class="btn" data-premium="${pq.id}" data-metodo="sol">Pagar con SOL</button>`;
    const ico = pq.skin ? `<img src="${A}skins/${pq.img}.png">` : `<img src="${A}items/equipo/${pq.icono}.png">`;
    h += tarjeta(ico, esc(pq.nombre), esc(pq.desc) + (pq.skin ? '<br><span style="color:var(--txt2)">Skin con poderes: también se consigue con oro.</span>' : ''), acc);
  }
  const ps = (yo && yo.pedidos) || [];
  if (ps.length) {
    const col = { pagado: 'var(--warn)', por_verificar: 'var(--warn)', entregado: 'var(--ok)', anulado: 'var(--err)', esperando_pago: 'var(--txt2)' };
    const txt = { pagado: 'Por entregar', por_verificar: 'En revisión', entregado: 'Entregado', anulado: 'Anulado', esperando_pago: 'Sin pagar' };
    h += '<p style="margin:12px 0 4px;font-size:12px">Tus compras:</p>' + ps.slice().reverse().map(x => `<div class="fila"><span>#${esc(x.codigo)} · ${esc(x.nombre)}</span><span style="color:${col[x.estado] || 'var(--txt)'}">${txt[x.estado] || esc(x.estado)}${x.estado === 'esperando_pago' && x.lamports ? ` <button class="btn sec" data-retomar="${esc(x.codigo)}" style="padding:4px 8px">Pagar</button>` : ''}</span></div>`).join('');
  }
  return h;
}
function conectarPremium(L) {
  // Retomar un pago con SOL que quedo a medias (p. ej. tras abrir el juego en Phantom).
  L.querySelectorAll('[data-retomar]').forEach(b => b.onclick = () => {
    const x = ((yo && yo.pedidos) || []).find(p => p.codigo === b.dataset.retomar);
    if (x && x.lamports) mostrarPedidoSol({ codigo: x.codigo, lamports: x.lamports, wallet: x.wallet, usd: x.usd, nombre: x.nombre });
  });
  L.querySelectorAll('[data-premium]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'pedido', id: b.dataset.premium, metodo: b.dataset.metodo }); });
}
function abrirPremium() {
  tabTienda = 'premium';
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === 'premium'));
  abrir('m-tienda'); pintarTienda();
}
// Telegram abre su propia ventana de pago de Stars.
function abrirFactura(m) {
  if (!TG || !TG.openInvoice) { window.open(m.link, '_blank'); return; }
  TG.openInvoice(m.link, st => {
    if (st === 'paid') aviso('Pago recibido. El Duende te entregará tu compra en breve.', 'ok');
    else if (st === 'failed') aviso('El pago no se completó.');
  });
}
// SOL: con Phantom (un toque) o desde cualquier wallet pegando la firma.
let pedidoSol = null;
function mostrarPedidoSol(m) {
  pedidoSol = m;
  const sol = (m.lamports / 1e9).toFixed(9);
  $('sol-cuerpo').innerHTML =
    `<p class="centro" style="margin-bottom:8px">${esc(m.nombre)} · pedido <b>#${esc(m.codigo)}</b></p>` +
    `<div class="saldo"><b>${sol} SOL</b><small>(~$${m.usd}) · paga el monto <b>exacto</b>: sus últimas cifras identifican tu pedido</small></div>` +
    `<button class="btn" id="b-phantom" style="width:100%;padding:12px;margin-bottom:10px">Pagar con Phantom${hayWalletSol() && !window.phantom ? ' / tu wallet' : ''}</button>` +
    (TACTIL && !hayWalletSol() ? `<button class="btn sec" id="b-solflare" style="width:100%;padding:10px;margin-bottom:10px">Pagar con Solflare</button>` : '') +
    `<p style="font-size:12px;margin:6px 0">¿Otra wallet? Envía <b>${sol} SOL</b> a la wallet de El Duende:</p>` +
    `<p style="font-size:11px;word-break:break-all;background:var(--bg);border:1px solid var(--borde);padding:8px;border-radius:6px">${esc(m.wallet)}</p>` +
    `<div style="display:flex;gap:6px;margin:6px 0"><button class="btn sec" id="b-copia-w" style="flex:1">Copiar wallet</button><button class="btn sec" id="b-copia-m" style="flex:1">Copiar monto</button></div>` +
    `<p style="font-size:12px;margin-top:8px">Y pega aquí la firma (signature) de la transacción:</p>` +
    `<input class="nombre" id="in-firma" placeholder="Firma de la transacción" style="font-size:10px;margin:6px 0">` +
    `<button class="btn sec" id="b-firma" style="width:100%">Enviar comprobante</button>` +
    `<p style="font-size:12px;color:var(--txt2);margin-top:8px">Tienes 30 minutos. El pago va directo a la wallet de El Duende y él te entrega la compra a mano.</p>`;
  abrir('m-sol');
  const copiar = t => { try { navigator.clipboard.writeText(t); aviso('📋 Copiado', 'ok'); } catch (e) {} };
  $('b-copia-w').onclick = () => copiar(m.wallet);
  $('b-copia-m').onclick = () => copiar(sol);
  $('b-firma').onclick = () => { const f = $('in-firma').value.trim(); if (f) mandar({ t: 'pedidoFirma', codigo: m.codigo, firma: f }); };
  $('in-firma').addEventListener('keydown', e => e.stopPropagation());
  $('b-phantom').onclick = () => pagarConPhantom(m);
  const bsf = $('b-solflare');
  if (bsf) bsf.onclick = () => {
    aviso('Abriendo el juego dentro de Solflare: entra con tu cuenta y, en la tienda premium → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
    window.location.href = 'https://solflare.com/ul/v1/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
  };
}
function cargarScript(src) {
  return new Promise((ok, mal) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(sc); });
}
// Wallet de Solana del navegador: Phantom, Solflare o la que inyecte
// window.solana (Backpack...). Todas aceptan connect y firmar.
function walletSol() {
  return (window.phantom && window.phantom.solana) || (window.solflare && window.solflare.isSolflare ? window.solflare : null) || window.solana || null;
}
function hayWalletSol() { return !!walletSol(); }
async function pagarConPhantom(m) {
  const prov = walletSol();
  if (!prov) {
    // En el movil el navegador no trae Phantom: se abre el juego dentro de
    // la app de Phantom (enlace universal), donde si se puede firmar; alli
    // se vuelve a pedir la compra (el pedido sin pagar caduca solo).
    if (TACTIL) {
      aviso('Abriendo el juego dentro de Phantom: entra con tu cuenta y, en la tienda premium → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
      window.location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
      return;
    }
    aviso('No encontramos Phantom en este navegador. Instálalo o paga desde otra wallet y pega la firma.'); window.open('https://phantom.app/', '_blank'); return;
  }
  try {
    if (!window.solanaWeb3) await cargarScript('https://unpkg.com/@solana/web3.js@1/lib/index.iife.min.js');
    const { Connection, PublicKey, Transaction, SystemProgram } = window.solanaWeb3;
    const r = await prov.connect();
    const publicKey = (r && r.publicKey) || prov.publicKey;
    if (!publicKey) throw new Error('la wallet no dio su dirección');
    const con = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(m.wallet), lamports: m.lamports }));
    tx.feePayer = publicKey;
    tx.recentBlockhash = (await con.getLatestBlockhash()).blockhash;
    let signature;
    if (prov.signAndSendTransaction) { const res = await prov.signAndSendTransaction(tx); signature = typeof res === 'string' ? res : res && res.signature; }
    else signature = await con.sendRawTransaction((await prov.signTransaction(tx)).serialize());
    if (!signature) throw new Error('la wallet no devolvió la firma');
    aviso('◎ Pago enviado. Comprobando…', 'ok');
    mandar({ t: 'pedidoFirma', codigo: m.codigo, firma: signature });
    cerrarModales();
  } catch (e) { aviso('No se completó el pago con tu wallet: ' + (e.message || e)); }
}

// ── EFECTOS ──
// Topes bajos a proposito: en un movil, 400 particulas y 80 textos a la vez
// (un combo contra un grupo) era lo que hacia caer los fotogramas.
function flotante(x, y, txt, color, tam) { textos.push({ x, y, txt, color, tam: tam || 10, t: 0 }); if (textos.length > 30) textos.shift(); }
function particula(x, y, color, vel) {
  if (parts.length >= (ligero ? 50 : 160)) return;
  parts.push({ x, y, vx: (Math.random() - .5) * vel * 2, vy: (Math.random() - .8) * vel * 1.6, color, vida: 24 + Math.random() * 16, t: 0 });
}
// Filtra en el sitio (sin crear un arreglo nuevo cada fotograma: menos
// recolector de basura, que en movil se nota como tirones).
function filtrar(arr, fn) { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; return arr; }
function lanzarFX(tipo, x, y, escala, flip, sigue, tinte) {
  efectos.push({ tipo, x, y, escala, flip, sigue, tinte, t: 0, dx: sigue ? x - P.x : 0, dy: sigue ? y - P.y : 0 });
  if (efectos.length > 60) efectos.shift();
}

// ── DIBUJO ──
function dibujarCapa(img, desplaz, sobreSuelo, fundir) {
  if (!img || !img.naturalWidth) return;
  const e = VH / 320;
  const w = img.naturalWidth * e, h = img.naturalHeight * e;
  const y = SUELO - h + sobreSuelo * e;
  // Enteros y 1 px de solape: con coordenadas fraccionarias quedaba una
  // costura vertical visible entre mosaico y mosaico.
  let x = Math.floor(-((desplaz % w) + w) % w);
  const wi = Math.ceil(w), yi = Math.round(y), hi = Math.round(h);
  while (x < VW) { g.drawImage(img, x, yi, wi + 1, hi); x += wi; }
  // En PC el lienzo es mas alto que la imagen: su borde de arriba se
  // funde con el cielo en vez de cortar en seco (la "franja" de las mazmorras).
  if (fundir && yi > -OY) {
    const gr = g.createLinearGradient(0, yi, 0, yi + 70 * e);
    gr.addColorStop(0, fundir); gr.addColorStop(1, fundir + '00');
    g.fillStyle = gr; g.fillRect(0, yi - 1, VW, 70 * e + 1);
  }
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
  // El fundido solo en las mazmorras (era donde se veia la franja; en los
  // mapas abiertos pintaba una banda sobre la capa lejana).
  dibujarCapa(IMG['lejos_' + mp.fondo], camX * .25, 46, mp.instancia ? mp.paleta.cielo[1] : null);
  dibujarCapa(IMG['cerca_' + mp.fondo], camX * .5, 16, mp.instancia ? mp.paleta.cielo[1] : null);
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

// La temporada activa: la que dice el servidor (si el reloj del movil va mal,
// igual se ve la correcta); sin dato, la del reloj local.
function temporadaYa() { return yo && yo.temp !== undefined ? TEMPORADAS.find(x => x.id === yo.temp) || null : temporadaDe(); }
// Temporada: su adorno (calabazas, arboles...) por el suelo de cada mapa.
function dibujarTemporada(mp) {
  const tp = temporadaYa();
  if (!tp) return;
  const spr = spriteTexto(tp.deco, 28, '#fff', false, false);
  for (let x = 170; x < mp.ancho; x += 520) {
    const sx = x - camX;
    if (sx < -40 || sx > VW + 40) continue;
    g.globalAlpha = .25 + .1 * Math.sin(frame / 20 + x); g.fillStyle = tp.color;
    g.beginPath(); g.arc(sx, SUELO - 14, 30, 0, 7); g.fill(); g.globalAlpha = 1;
    g.drawImage(spr, sx - spr.width / 2, SUELO - spr.height + 2);
  }
}

function dibujarPortales(mp) {
  const cerca = cercano();
  mp.portales.forEach((p, i) => {
    const x = p.x - camX, y = SUELO - 48;
    if (x < -80 || x > VW + 80) return;
    g.save();
    g.translate(x, y);
    g.globalCompositeOperation = aditivo();
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = (p.buscador ? ['#ffd84a', '#ff9900', '#ffe9a8'] : ['#c084fc', '#00eeff', '#ff3cf0'])[k];
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
    // Dos lineas (nombre / nivel): en una sola, los portales vecinos del
    // pueblo se pisaban las etiquetas.
    const sube = mp.portales.some(q => q !== p && q.x < p.x && p.x - q.x < 200) ? 30 : 0;
    etiqueta(x, y - 72 - sube, p.etiqueta, activo ? '#ffe600' : '#c084fc', 7);
    if (p.nv) etiqueta(x, y - 58 - sube, /^\d/.test(p.nv) ? 'Nv ' + p.nv : p.nv, activo ? '#ffe600' : 'rgba(255,255,255,.7)', 6);
  });
}

// Textos ya dibujados en un lienzo aparte: dibujar letras con fillText en
// cada fotograma era lo mas caro del juego en un movil lento (medido con
// la CPU 4x mas lenta). Una etiqueta se pinta una vez y luego solo se copia.
const _textos = new Map();
// En el movil la letra pixel de 6 px no se lee: minimo 7.
const TAM_MIN = t => (TACTIL ? Math.max(t, 7) : t);
// La letra pixel solo trae el latin basico: flechas, emojis y otros simbolos
// salian como "_". Esos textos van con la letra del sistema.
const FUERA_PIXEL = /[^\x00-\xff]/;
function spriteTexto(txt, tam, color, fondo, sombra) {
  tam = TAM_MIN(tam);
  const k = tam + '|' + color + '|' + (fondo ? 1 : 0) + (sombra ? 1 : 0) + '|' + txt;
  let c = _textos.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  const x = c.getContext('2d');
  const raro = FUERA_PIXEL.test(txt);
  const fs = raro ? tam + 3 : tam, baja = raro ? Math.ceil(fs * 0.25) : 0;   // la del sistema baja de la linea (g, p, emojis)
  const fu = raro ? 'bold ' + fs + 'px system-ui, sans-serif' : tam + 'px "Press Start 2P", monospace';
  x.font = fu;
  const w = Math.ceil(x.measureText(txt).width);
  c.width = w + (fondo ? 8 : 2); c.height = fs + baja + (fondo ? 7 : 3);
  x.font = fu; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  if (fondo) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, c.width, c.height); }
  const bx = fondo ? 4 : 0, by = fondo ? fs + 3 : fs;
  c._by = by;   // linea base: etiqueta() la alinea con la de la letra pixel
  if (sombra) { x.fillStyle = '#000'; x.fillText(txt, bx + 1, by + 1); }
  x.fillStyle = color; x.fillText(txt, bx, by);
  if (_textos.size > 600) _textos.delete(_textos.keys().next().value);
  _textos.set(k, c);
  return c;
}
// Las medidas tomadas antes de cargar la fuente pixel salen con la de
// respaldo: al cargarse, se tira la cache.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => _textos.clear()).catch(() => {});
// Arcoiris: 12 tonos que van rotando (pocos, para no llenar la cache de textos).
function colorTinte(tn) { return tn.color === 'arcoiris' ? 'hsl(' + (Math.floor(frame / 8) % 12) * 30 + ',90%,68%)' : tn.color; }
// Emoji ya dibujado en su lienzo (fillText de un emoji en cada fotograma es caro).
function emoji(txt, tam, x, y) {
  const c = spriteTexto(txt, tam - 3, '#fff', false, false);
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - tam));
}
function etiqueta(x, y, txt, color, tam) {
  tam = TAM_MIN(tam || 7);
  const c = spriteTexto(txt, tam, color || '#fff', true, false);
  // Que no se salga por los bordes (en el movil, con 400 de ancho, los
  // nombres de los NPC del borde salian cortados).
  const m = c.width / 2 + 2;
  if (x > -c.width && x < VW + c.width) x = Math.max(m, Math.min(VW - m, x));
  // Misma linea base que una etiqueta en letra pixel (tam + 3 desde arriba).
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - (c._by || tam + 3)));
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
  g.scale((f > 0) !== !!hoja.izq ? 1 : -1, 1);
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
    if (x > -10 && x < VW + 10) etiqueta(x, SUELO - 72, n.nombre, activo ? '#ffe600' : '#00ff88', 7);
    if (n.tipo === 'tienda') emoji('🛒', 14, x, SUELO - 90 + Math.sin(frame * .1) * 3);
    if (n.tipo === 'ranking') emoji('🏆', 14, x, SUELO - 90 + Math.sin(frame * .1) * 3);
    if (n.tipo === 'artesania') emoji('⚗️', 14, x, SUELO - 90 + Math.sin(frame * .1) * 3);
    if (n.tipo === 'guia') {
      // ❗ cuando hay una mision lista para entregar, como la bombilla de MapleStory.
      const q = yo && MISIONES[yo.mis.i];
      const dia = yo && yo.diaria;
      const lista = (q && yo.mis.p >= q.n) || (dia && !dia.ok && dia.p >= DIARIA.n);
      emoji(lista ? '❗' : '❔', lista ? 18 : 14, x, SUELO - 90 + Math.sin(frame * (lista ? .25 : .1)) * 3);
    }
  }
}

function sombra(x, pies, ancho) {
  const k = 1 - Math.min(1, (SUELO - pies) / 140);
  if (k <= .05) return;
  g.save(); g.fillStyle = '#000'; g.globalAlpha = .35 * k;
  g.beginPath(); g.ellipse(x, sueloEn(MAPAS[mapaId], x + camX, pies, true) + 2, ancho * k, 5 * k, 0, 0, Math.PI * 2); g.fill(); g.restore();
}

// Color del nivel segun la diferencia con el tuyo (gris = no da casi nada,
// rojo = peligro), como en WoW.
function colorNivel(nv) {
  const dif = nv - (yo ? yo.nivel : 1);
  return dif >= 5 ? '#ff3344' : dif >= 2 ? '#ff9900' : dif <= -8 ? '#888' : dif <= -3 ? '#4ade80' : '#ffe600';
}
// Anillo de seleccion bajo los pies del objetivo (rojo enemigo, verde aliado).
function anilloSeleccion(x, pies, ancho, color) {
  g.save();
  g.strokeStyle = color; g.lineWidth = 2; g.globalAlpha = .65 + Math.sin(frame * .15) * .25;
  g.beginPath(); g.ellipse(x, pies + 2, ancho, ancho * .28, 0, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = .18; g.fillStyle = color; g.fill();
  g.restore();
}
function barraMini(x, y, w, k, color) {
  g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  g.fillStyle = color; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, k)), 4);
}

function dibujarMonstruo(o) {
  interpolar(o);
  // Retroceso visual al recibir un golpe tuyo (se recupera en ~150 ms).
  let rx = 0;
  if (o.empuje) { const k = 1 - (performance.now() - o.empuje.t) / 150; if (k > 0) rx = o.empuje.d * 9 * k; else o.empuje = null; }
  const x = o.x - camX + rx;
  if (x < -150 || x > VW + 150) return;
  const def = MONSTRUOS[o.k];
  const hoja = HOJAS[def.hoja];
  const ahora = performance.now();
  const elegido = objetivo && objetivo.k === 'm' && objetivo.id === o.id;
  let fila = hoja.mov[0], col = hoja.mov[1] + Math.floor(frame / 6) % hoja.mov[2], alpha = 1;
  const golpeado = ahora - o.golpeT < 260;
  const aturdido = o.fl & FM.aturdido, oveja = o.fl & FM.oveja, raiz = o.fl & FM.raiz;
  if (o.muereT) {
    const k = Math.min(1, (ahora - o.muereT) / 1500);
    fila = hoja.golpe[0]; col = hoja.muerte[0] + Math.min(hoja.muerte[1] - 1, Math.floor(k * hoja.muerte[1]));
    alpha = 1 - k;
  } else if (golpeado || o.st === 3) {
    fila = hoja.golpe[0]; col = hoja.golpe[1] + Math.floor((ahora - o.golpeT) / 130) % hoja.golpe[2];
  } else if (aturdido || raiz) col = hoja.mov[1];
  if (!def.vuela) sombra(x, o.y, o.w * .45);
  else sombra(x, o.y, o.w * .3);
  if (elegido && !o.muereT) anilloSeleccion(x, def.vuela ? sueloEn(MAPAS[mapaId], o.x, o.y, true) : o.y, Math.max(22, o.w * .6), '#ff3344');
  const nace = Math.min(1, (ahora - o.nace) / 400);
  const temblor = o.st === 3 ? (Math.random() - .5) * 5 : 0;
  if (def.jefe && !o.muereT) {
    // Aura de jefe
    g.save(); g.globalCompositeOperation = aditivo();
    const rg = g.createRadialGradient(x, o.y - o.alto / 2, 5, x, o.y - o.alto / 2, o.alto * .8);
    const c = o.st === 3 ? '255,60,60' : '255,60,240';
    rg.addColorStop(0, `rgba(${c},.28)`); rg.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = rg; g.fillRect(x - o.alto, o.y - o.alto * 1.4, o.alto * 2, o.alto * 1.6); g.restore();
  }
  if (oveja && !o.muereT) {
    // Polimorfia: una oveja que pasea (se rompe al pegarle).
    g.save();
    g.translate(x, o.y - 4 + Math.abs(Math.sin(frame * .2)) * -3); if (o.f < 0) g.scale(-1, 1);
    emoji('🐑', 30, 0, 0); g.restore();
  } else {
    dibujarHoja(def.hoja, hoja, fila, col, o.alto * (0.4 + 0.6 * nace), x + temblor, o.y, o.f, alpha * nace, (o.ex && o.ex.ti) || def.tinte || (o.st === 3 ? '#ff3344' : null), golpeado && !o.muereT && (ahora - o.golpeT) < 70);
  }
  if (o.muereT) return;
  if (raiz) {
    // Congelado: escarcha a los pies.
    g.save(); g.globalAlpha = .55; g.fillStyle = '#9be7ff';
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 9 - 5, o.y + 2); g.lineTo(x + i * 9, o.y - 14 - (i & 1) * 6); g.lineTo(x + i * 9 + 5, o.y + 2); g.fill(); }
    g.globalAlpha = .25; g.fillRect(x - o.w / 2, o.y - o.h, o.w, o.h); g.restore();
  }
  if (aturdido) {
    // Aturdido: estrellitas girando sobre la cabeza.
    g.fillStyle = '#ffe600';
    for (let i = 0; i < 3; i++) { const a = frame * .12 + i * 2.1; g.fillRect(x + Math.cos(a) * 14 - 2, o.y - o.alto - 6 + Math.sin(a) * 4, 4, 4); }
  }
  if ((o.fl & FM.dolor) && frame % 9 === 0) particula(o.x + (Math.random() - .5) * o.w * .6, o.y - o.alto * Math.random(), '#7c3aed', 1);
  const cm = castMon.get(o.id);
  // Vida y nivel
  if (!def.jefe) {
    const w = 40, y = o.y - o.alto - 12;
    if (o.hp < o.mx || elegido) barraMini(x, y, w, o.hp / o.mx, '#ff3344');
    // Con el nombre solo cuando esta herido o elegido: todos a la vez llenaban la pantalla.
    const tn = spriteTexto('Nv' + o.nv + (o.hp < o.mx || elegido ? ' ' + def.nombre : ''), 6, colorNivel(o.nv), false, false);
    g.drawImage(tn, Math.round(x - tn.width / 2), Math.round(y - 4 - 6 - (o.etqNivel || 0) * 10));
    if (cm) barraMini(x, y + 7, w, (ahora - cm.ini) / (cm.fin - cm.ini), cm.int ? '#ffae00' : '#aaa');
  } else {
    etiqueta(x, o.y - o.alto - 10, '👑 ' + def.nombre, '#ff3cf0', 7);
    if (cm) barraMini(x, o.y - o.alto - 4, 70, (ahora - cm.ini) / (cm.fin - cm.ini), cm.int ? '#ffae00' : '#aaa');
  }
}

// Monstruos amontonados: sus nombres se escalonan hacia arriba para que no
// se pisen ("Nv1 Gob1ab"). Se recalcula cada 6 fotogramas.
function escalonarEtiquetas() {
  const l = [];
  for (const o of mons.values()) if (!o.muereT && !MONSTRUOS[o.k].jefe && Math.abs(o.x - P.x) < VW) l.push(o);
  l.sort((a, b) => a.x - b.x);
  for (let i = 0; i < l.length; i++) {
    const o = l[i];
    let n = 0;
    for (let j = Math.max(0, i - 4); j < i; j++) {
      const p = l[j];
      if (o.x - p.x < 70 && Math.abs((p.y - p.alto) - (o.y - o.alto)) < 30) n = Math.max(n, (p.etqNivel || 0) + 1);
    }
    o.etqNivel = Math.min(n, 3);
  }
}
// Mascota: sigue al duende con retraso, a su espalda (las que vuelan, a la
// altura de la cabeza). El estado va en el propio duende (q.pet).
function dibujarMascota(q, id, f, pies, montado) {
  const ma = MASCOTAS[id];
  if (!ma) return;
  const hm = HOJAS[ma.hoja];
  if (!hm) return;
  const objX = q.x - f * (montado ? 64 : 34), objY = ma.vuela ? pies - 62 + Math.sin(frame * .07) * 6 : pies;
  const ahora = performance.now();
  const p = q.pet || (q.pet = { x: objX, y: objY, f, t: ahora });
  if (Math.abs(p.x - objX) > 500) { p.x = objX; p.y = objY; }
  const dx = objX - p.x;
  // Mismo ritmo con 60 o con 20 FPS: el paso depende del tiempo pasado.
  const k = Math.min(1, (ahora - (p.t || ahora)) / 16.7);
  p.t = ahora;
  p.x += dx * (1 - Math.pow(.92, k)); p.y += (objY - p.y) * (1 - Math.pow(.85, k));
  if (Math.abs(dx) > 2) p.f = dx > 0 ? 1 : -1;
  const anda = Math.abs(dx) > 3 || ma.vuela;
  const col = hm.mov[1] + (anda ? Math.floor(frame / 6) % hm.mov[2] : 0);
  dibujarHoja(ma.hoja, hm, hm.mov[0], col, ma.alto, p.x - camX, p.y, p.f, 1, ma.tinte || null, false);
}
function accesorioClase(clase, x, top, f) {
  if (clase !== 'mago' && clase !== 'sacerdote' && clase !== 'picaro') return;
  g.save();
  g.lineWidth = 1.5; g.strokeStyle = '#000';
  if (clase === 'mago') {
    // Sombrero puntiagudo con estrella.
    const b = top + 9;
    g.fillStyle = '#5b21b6';
    g.beginPath(); g.ellipse(x, b, 17, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 11, b - 1); g.lineTo(x + 11, b - 1); g.lineTo(x - f * 7, b - 27); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fde047'; g.fillRect(x - f * 2 - 1.5, b - 13, 3, 3);
  } else if (clase === 'sacerdote') {
    // Aureola dorada que flota sobre la cabeza.
    const y = top - 3 + Math.sin(frame * .08) * 1.5;
    g.strokeStyle = '#fde68a'; g.lineWidth = 3; g.globalAlpha = .95;
    g.beginPath(); g.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,240,180,.35)'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2); g.stroke();
  } else {
    // Capucha oscura con la cola al viento.
    const c = top + 13;
    g.fillStyle = '#1e293b';
    g.beginPath(); g.arc(x, c, 15, Math.PI, Math.PI * 2); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - f * 12, c - 6); g.lineTo(x - f * 30, c + 2 + Math.sin(frame * .2) * 3); g.lineTo(x - f * 12, c + 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff569'; g.fillRect(x - 14, c - 2, 28, 2);
  }
  g.restore();
}
function dibujarDuende(q, esYo) {
  const x = q.x - camX;
  let pies = q.y;
  if (x < -120 || x > VW + 120) return;
  const skin = esYo ? (probando && performance.now() < probando.hasta ? probando.skin : yo.skin) : q.sk;
  const muerto = esYo ? P.muerto : q.muerto;
  const herido = (esYo ? P.herido : q.herido) > 0;
  const f = esYo ? P.f : q.f;
  const atk = esYo ? P.atk : q.atk;
  const anda = esYo ? Math.abs(P.vx) > .5 && P.suelo : q.a === 1;
  const enAire = esYo ? !P.suelo : q.a === 2;
  const fl = esYo ? P.fl : (q.fl || 0);
  const id = esYo ? miId : q.id;
  const elegido = objetivo && objetivo.k === 'p' && objetivo.id === id;
  const clase = esYo ? yo.clase : q.cl;
  const mo = !muerto && MONTURAS[esYo ? yo.montado : q.mo];
  sombra(x, pies, mo ? 30 : 18);
  if (elegido) anilloSeleccion(x, pies, mo ? 34 : 24, duelo && duelo.con === id ? '#ff3344' : '#00ff88');
  if (mo) {
    // La montura camina bajo el duende, que va subido encima.
    const hm = HOJAS[mo.hoja];
    const col = anda ? hm.mov[1] + Math.floor(frame / 5) % hm.mov[2] : hm.mov[1];
    dibujarHoja(mo.hoja, hm, hm.mov[0], col, mo.alto, x, pies, f, 1, mo.tinte || null, false);
  }
  const piesOrig = pies;
  const masc = esYo ? (yo.exped ? '' : yo.mascota) : q.ma;   // de expedicion no se ve
  if (masc && !muerto && !(fl & FJ.sigilo)) dibujarMascota(q, masc, f, piesOrig, !!mo);
  pies = pies - (mo ? mo.dy : 0);
  g.save();
  if (muerto) g.globalAlpha = .35;
  else if (fl & FJ.sigilo) g.globalAlpha = esYo ? .45 : .2;
  else if (herido && Math.floor(frame / 3) % 2) g.globalAlpha = .55;
  const escudo = esYo ? P.escudo : q.escudo;
  const fuego = esYo ? P.fuego : q.fuego;
  if (skin === 'legendaria' && !muerto) {
    g.save(); g.globalCompositeOperation = aditivo();
    const rg = g.createRadialGradient(x, pies - 30, 4, x, pies - 30, 60);
    rg.addColorStop(0, 'rgba(255,60,240,.3)'); rg.addColorStop(1, 'rgba(255,60,240,0)');
    g.fillStyle = rg; g.fillRect(x - 60, pies - 90, 120, 120); g.restore();
  }
  if (skin === 'comun' && ANIM && IMG.anim.naturalWidth) {
    // Duende base: la hoja animada de verdad (reposo / caminar / atacar / herido).
    let lista = ANIM_IDX.reposo, vel = 14;
    if (atk > 0) lista = ANIM_IDX.ataca;
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
  // Todas las clases comparten el sprite del duende: un accesorio dibujado
  // las distingue de un vistazo (sombrero, aureola, capucha).
  if (!muerto && !(fl & FJ.sigilo && !esYo)) accesorioClase(clase, x, pies - (skin === 'comun' ? FIS.jugH : 66), f);
  if (escudo) { g.save(); g.strokeStyle = '#00eeff'; g.globalAlpha = .6 + Math.sin(frame * .2) * .2; g.lineWidth = 2; g.beginPath(); g.ellipse(x, pies - 30, 30, 40, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
  if (fl & FJ.escudoPoder) { g.save(); g.strokeStyle = '#ffe9a8'; g.fillStyle = 'rgba(255,233,168,.12)'; g.globalAlpha = .7 + Math.sin(frame * .12) * .2; g.lineWidth = 2; g.beginPath(); g.ellipse(x, pies - 30, 27, 37, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
  if (fl & FJ.bloque) { g.save(); g.globalAlpha = .55; g.fillStyle = '#9be7ff'; g.fillRect(x - 22, pies - 66, 44, 68); g.globalAlpha = .9; g.strokeStyle = '#e0f7ff'; g.lineWidth = 2; g.strokeRect(x - 22, pies - 66, 44, 68); g.restore(); }
  if (fl & FJ.muro) { g.save(); g.fillStyle = '#cbd5e1'; g.strokeStyle = '#475569'; g.globalAlpha = .85; const sx = x + f * 18; g.beginPath(); g.moveTo(sx - 9, pies - 46); g.lineTo(sx + 9, pies - 46); g.lineTo(sx + 9, pies - 26); g.lineTo(sx, pies - 16); g.lineTo(sx - 9, pies - 26); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  if ((fl & FJ.renovar) && frame % 8 === 0) particula(q.x + (Math.random() - .5) * 24, pies - Math.random() * 50, '#4ade80', 1);
  if ((fl & FJ.supresion) && frame % 6 === 0) particula(q.x + (Math.random() - .5) * 24, pies - Math.random() * 60, '#e0e7ff', 1);
  if ((fl & FJ.grito) && frame % 14 === 0) particula(q.x + (Math.random() - .5) * 20, pies - 4, '#ff6633', 1);
  if ((fl & FJ.evasion) && frame % 5 === 0) particula(q.x - f * 14, pies - 20 - Math.random() * 30, '#94a3b8', 1);
  if (fuego) { for (let i = 0; i < 2; i++) particula(q.x + (Math.random() - .5) * 20, pies - 20 - Math.random() * 30, Math.random() < .5 ? '#ff6400' : '#ffe600', 1.5); }
  // Lanzando: chispas en las manos (el color de la clase).
  const lanza = esYo ? castYo : castOtros.get(q.id);
  if (lanza && (lanza.id === 'pescar' || lanza.id === 'pica')) dibujarSedal(x, pies, f, lanza.id === 'pica');
  if (lanza && frame % 3 === 0) particula(q.x + f * 12, pies - 34, CLASES[clase] ? CLASES[clase].color : '#fff', 1.2);
  // Nombre y nivel
  const nom = esYo ? yo.nombre : q.n, lv = esYo ? yo.nivel : q.lv;
  // Si otro duende esta pegado al propio, su nombre baja una linea: antes
  // se encimaban ("ClaudeTest · Nv1Duendecillo Bot").
  const baja = !esYo && Math.abs(q.x - P.x) < 110 && Math.abs(q.y - P.y) < 40 ? 13 : 0;
  const tn = TINTES[esYo ? yo.tinte : q.tn];
  const colNom = tn ? colorTinte(tn) : esYo ? '#ffe600' : (CLASES[clase] ? CLASES[clase].color : (SKINS[skin] ? SKINS[skin].color : '#fff'));
  pies = piesOrig;
  etiqueta(x, pies + 16 + baja, (muerto ? '💀 ' : '') + nom + ' · Nv' + lv, colNom, 6);
  // Hermandad y titulo debajo; si otro duende esta pegado al tuyo, solo su
  // nombre (en el suelo no caben dos pilas de etiquetas).
  const hn = esYo ? (hermandad ? hermandad.nombre : '') : (baja ? '' : q.hn);
  let linea = pies + 29 + baja;
  if (hn) { etiqueta(x, linea, '<' + hn + '>', '#4ade80', 5); linea += 12; }
  const ti = esYo ? tituloDe(yo.titulo) : (baja ? '' : q.ti);
  if (ti) etiqueta(x, linea, '« ' + ti + ' »', '#c084fc', 5);
  if (!esYo && (q.hp < q.mx || elegido) && !muerto) barraMini(x, pies - 78, 36, q.hp / q.mx, '#4ade80');
  if (!esYo && lanza) barraMini(x, pies - 71, 36, (performance.now() - lanza.ini) / (lanza.fin - lanza.ini), '#ffe600');
  const ge = gestos.get(esYo ? miId : q.id);
  if (ge) {
    const k = (performance.now() - ge.t) / 2500;
    if (k >= 1) gestos.delete(esYo ? miId : q.id);
    else { const salto = ge.id === 'bailar' ? Math.abs(Math.sin(k * 18)) * 10 : Math.sin(k * 3.14) * 6; emoji(GESTOS[ge.id].e, 26, x + (ge.id === 'bailar' ? Math.sin(k * 24) * 6 : 0), pies - 92 - salto); }
  }
  const bb = burbujas.get(esYo ? miId : q.id);
  if (bb && performance.now() < bb.hasta) burbuja(x, pies - 84, bb.txt);
}

const _burbujas = new Map();   // texto -> { lineas, w } (medir cada fotograma costaba)
function burbuja(x, y, txt) {
  g.font = '11px system-ui, sans-serif';
  let m = _burbujas.get(txt);
  if (!m) {
    const lineas = [];
    let l = '';
    for (const p of txt.split(' ')) { if (g.measureText(l + ' ' + p).width > 150) { lineas.push(l); l = p; } else l = l ? l + ' ' + p : p; }
    if (l) lineas.push(l);
    m = { lineas, w: Math.min(160, Math.max(...lineas.map(s => g.measureText(s).width))) + 12 };
    if (_burbujas.size > 50) _burbujas.delete(_burbujas.keys().next().value);
    _burbujas.set(txt, m);
  }
  const { lineas, w } = m;
  const h = lineas.length * 13 + 8;
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - h, w, h, 6) : g.rect(x - w / 2, y - h, w, h); g.fill();
  g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.fill();
  g.fillStyle = '#111'; g.textAlign = 'center';
  lineas.forEach((s, i) => g.fillText(s, x, y - h + 15 + i * 13));
}

// Bolas de fuego: la posicion se extrapola desde la ultima foto del
// servidor con su velocidad, asi se mueven fluidas a 60 fps.
// La bola se dibuja una vez en un lienzo aparte y luego solo se copia: crear
// un degradado radial por bala y por fotograma costaba caro en movil.
const _bola = {};
function spriteBola(jefe) {
  const k = jefe ? 1 : 0;
  if (_bola[k]) return _bola[k];
  const r = (jefe ? 9 : 7) * 2.6, c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * 2);
  const x = c.getContext('2d'), col = jefe ? '255,60,240' : '192,132,252';
  const rg = x.createRadialGradient(r, r, 1, r, r, r);
  rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.35, `rgba(${col},.85)`); rg.addColorStop(1, `rgba(${col},0)`);
  x.fillStyle = rg; x.beginPath(); x.arc(r, r, r, 0, Math.PI * 2); x.fill();
  return (_bola[k] = c);
}
function dibujarBalas() {
  const ahora = performance.now();
  if (balas.length) g.globalCompositeOperation = aditivo();
  for (const b of balas) {
    const dt = Math.min(0.2, (ahora - b.t) / 1000);
    const x = b.x + b.vx * dt - camX, y = b.y + b.vy * dt;
    if (x < -20 || x > VW + 20) continue;
    const img = spriteBola(b.jefe);
    g.drawImage(img, x - img.width / 2, y - img.height / 2);
    if (frame % 3 === 0) particula(x + camX - Math.sign(b.vx) * 6, y, b.jefe ? '#ff3cf0' : '#c084fc', 1.2);
  }
  g.globalCompositeOperation = 'source-over';
}

function dibujarEfectos() {
  dibujarBalas();
  filtrar(efectos, f => {
    const [fw, fh, n, tpf] = FX[f.tipo];
    const img = f.tinte ? tenido('fx_' + f.tipo, f.tinte) : IMG['fx_' + f.tipo];
    const i = Math.floor(f.t / tpf);
    f.t++;
    if (i >= n) return false;
    if (!img || !img.width) return true;
    const x = (f.sigue ? P.x + f.dx : f.x) - camX, y = f.sigue ? P.y + f.dy : f.y;
    g.save(); g.globalCompositeOperation = aditivo(); g.translate(x, y); if (f.flip) g.scale(-1, 1);
    g.drawImage(img, i * fw, 0, fw, fh, -fw * f.escala / 2, -fh * f.escala / 2, fw * f.escala, fh * f.escala);
    g.restore();
    return true;
  });
  filtrar(parts, p => {
    p.t++; p.x += p.vx; p.y += p.vy; p.vy += .15; p.vx *= .97;
    if (p.t > p.vida) return false;
    g.globalAlpha = 1 - p.t / p.vida; g.fillStyle = p.color; g.fillRect(p.x - camX, p.y, 3, 3);
    return true;
  });
  g.globalAlpha = 1;
  // Monedas que saltan del monstruo y vuelan hacia el duende.
  filtrar(monedas, c => {
    c.t++;
    if (c.t > 22) { c.vx += (P.x - c.x) * .012; c.vy += ((P.y - 30) - c.y) * .012; c.vx *= .9; c.vy *= .9; }
    else { c.vy += .35; if (c.y > SUELO - 4) { c.y = SUELO - 4; c.vy *= -.45; } }
    c.x += c.vx; c.y += c.vy;
    if (c.t > 70 || (c.t > 22 && Math.hypot(P.x - c.x, P.y - 30 - c.y) < 14)) return false;
    const img = IMG.coin;
    if (img && img.naturalWidth) { const s = 11 * Math.abs(Math.cos(c.t * .25)) + 2; g.drawImage(img, c.x - camX - s / 2, c.y - 6, s, 12); }
    return true;
  });
  filtrar(textos, t => {
    t.t++; t.y -= .7;
    if (t.t > 60) return false;
    g.globalAlpha = Math.min(1, (60 - t.t) / 20);
    const c = t.spr || (t.spr = spriteTexto(t.txt, t.tam, t.color, false, true));
    g.drawImage(c, Math.round(t.x - camX - c.width / 2), Math.round(t.y - t.tam));
    return true;
  });
  g.globalAlpha = 1;
}

// Proyectiles de vara y hechizos: viajan del lanzador al objetivo (aunque
// este se mueva) y estallan al llegar.
function dibujarProyectiles() {
  const ahora = performance.now();
  if (!proyectiles.length) return;
  g.save(); g.globalCompositeOperation = aditivo();
  filtrar(proyectiles, p => {
    const k = (ahora - p.ini) / p.dur;
    if (k < 0) return true;
    const tx = p.o.x, ty = p.o.y - (p.o.alto || 50) / 2;
    if (k >= 1) {
      for (let i = 0; i < (p.fuego ? 16 : 6); i++) particula(tx, ty, p.color, p.fuego ? 4 : 2.5);
      return false;
    }
    const x = p.x0 + (tx - p.x0) * k - camX, y = p.y0 + (ty - p.y0) * k - Math.sin(k * Math.PI) * 14;
    g.globalAlpha = .35; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, p.r * 1.9, 0, 7); g.fill();
    g.globalAlpha = 1; g.beginPath(); g.arc(x, y, p.r, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, p.r * .45, 0, 7); g.fill();
    if (frame % 2 === 0) particula(x + camX, y, p.color, .8);
    return true;
  });
  g.restore();
}
// Zonas de peligro en el suelo (jefes de mazmorra): primero el aviso
// (borde rojo que parpadea), despues el golpe (relleno). Hay que salir.
function dibujarZonas() {
  for (const z of zonas) {
    const x0 = z.x0 - camX, x1 = z.x1 - camX;
    if (z.j && !z.act && (x1 < 0 || x0 > VW)) {
      // Zona dorada fuera de la pantalla: flecha en el borde.
      const der = x0 > VW, ax = der ? VW - 16 : 16, ay = SUELO - 70 + Math.sin(frame * .2) * 4;
      g.save(); g.fillStyle = '#facc15';
      g.beginPath(); g.moveTo(ax + (der ? 12 : -12), ay); g.lineTo(ax - (der ? 6 : -6), ay - 12); g.lineTo(ax - (der ? 6 : -6), ay + 12); g.fill();
      g.restore();
      etiqueta(der ? VW - 54 : 54, ay - 18, 'JUNTAOS', '#facc15', 7);
      continue;
    }
    if (x1 < -10 || x0 > VW + 10) continue;
    const col = z.color || '#ff3344';
    g.save();
    if (z.act) {
      g.globalAlpha = .35 + Math.random() * .15; g.fillStyle = col; g.fillRect(x0, SUELO - 130, x1 - x0, 132);
      g.globalAlpha = .9; g.fillRect(x0, SUELO - 4, x1 - x0, 6);
    } else if (z.j) {
      // Zona para aguantar JUNTOS (banda): columna dorada que llama a entrar.
      g.globalAlpha = .16 + Math.abs(Math.sin(frame * .12)) * .14; g.fillStyle = col; g.fillRect(x0, SUELO - 120, x1 - x0, 122);
      g.globalAlpha = .95; g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(x0, SUELO - 120, x1 - x0, 122);
      g.globalAlpha = 1; etiqueta((x0 + x1) / 2, SUELO - 128 - Math.abs(Math.sin(frame * .15)) * 6, 'JUNTAOS AQUI', col, 8);
    } else {
      g.globalAlpha = .18 + Math.abs(Math.sin(frame * .2)) * .25; g.fillStyle = col; g.fillRect(x0, SUELO - 6, x1 - x0, 8);
      g.globalAlpha = .9; g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(x0, SUELO - 120, x1 - x0, 122);
    }
    g.restore();
  }
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
  dibujarZonas();
  dibujarMuros();
  dibujarTemporada(mp);
  dibujarPortales(mp);
  dibujarNPCs(mp);
  dibujarCofres();
  dibujarNodos();
  dibujarPesquero();
  if (frame % 6 === 0) escalonarEtiquetas();
  for (const o of mons.values()) dibujarMonstruo(o);
  dibujarMarcasEspeciales();
  for (const q of otros.values()) { interpolar(q); if (q.atk > 0) q.atk--; if (q.herido > 0) q.herido--; dibujarDuende(q, false); }
  if (yo) dibujarDuende(P, true);
  dibujarProyectiles();
  dibujarEfectos();
  dibujarGuia();
  dibujarDuelo();
  g.restore();
  // Fundido al cruzar un portal.
  if (fundido > 0) { g.fillStyle = `rgba(7,3,15,${fundido})`; g.fillRect(0, 0, cv.width, cv.height); fundido = Math.max(0, fundido - .05); }
  // Barra del jefe
  // La barra de arriba es la del jefe mas cercano (en una mazmorra hay tres).
  let jc = null, dj = 1100;
  for (const o of mons.values()) if (MONSTRUOS[o.k].jefe && !o.muereT && Math.abs(o.x - P.x) < dj) { dj = Math.abs(o.x - P.x); jc = o; }
  jefeVivo = jc;
  if (jefeVivo && !jefeVivo.muereT && !duelo) {   // en duelo manda el marcador del duelo
    ponCss($('jefe-bar'), 'display', 'block');
    ponTxt($('jefe-n'), '👑 ' + MONSTRUOS[jefeVivo.k].nombre + ' · Nv ' + jefeVivo.nv);
    rellenar($('jefe-bar').querySelector('i'), jefeVivo.hp / jefeVivo.mx);
  } else ponCss($('jefe-bar'), 'display', 'none');
  // Boton contextual
  const c = cercano();
  const bi = $('interactuar');
  // visibility y no display: en la barra tactil ocupa su hueco siempre, asi
  // los botones de al lado no saltan de sitio cada vez que aparece.
  ponCss(bi, 'display', 'block');
  if (c && yo && !P.muerto) {
    ponCss(bi, 'visibility', 'visible');
    ponTxt(bi, c.tipo === 'res' ? '✝ RESUCITAR' : c.tipo === 'portal' ? (TACTIL ? '🚪 ENTRAR' : 'E · ENTRAR') : c.tipo === 'cofre' ? (TACTIL ? '🗝️ ABRIR' : 'E · ABRIR') : c.tipo === 'nodo' ? (TACTIL ? '⛏️ RECOGER' : 'E · RECOGER') : c.tipo === 'pesca' ? (castYo && castYo.id === 'pica' ? (TACTIL ? '🐟 ¡TIRA!' : 'E · ¡TIRA!') : castYo && castYo.id === 'pescar' ? '🎣 Espera…' : (TACTIL ? '🎣 PESCAR' : 'E · PESCAR')) : (TACTIL ? '💬 HABLAR' : 'E · HABLAR'));
  } else ponCss(bi, 'visibility', 'hidden');
}

// ── HUD ──
function pintarHud() {
  if (!yo) return;
  P.maxHp = yo.maxHp; P.hp = yo.hp; P.muerto = yo.muerto;
  if (yo.recMax !== undefined) { P.recMax = yo.recMax; P.rec = yo.rec; P.combo = yo.combo || 0; }
  ponTxt($('h-nombre'), yo.nombre);
  ponTxt($('h-nivel'), String(yo.nivel));
  const cl = CLASES[yo.clase];
  const sp = cl && yo.nivel >= ESPEC_NIVEL ? especDe(yo.clase, yo.espec) : null;
  ponTxt($('h-clase'), cl ? (sp ? sp.nombre : cl.nombre) : 'Sin clase');
  ponCss($('h-clase'), 'color', cl ? cl.color : 'var(--txt2)');
  const imgSkin = A + 'skins/' + (SKINS[yo.skin] ? SKINS[yo.skin].img : 'skin_hero') + '.png';
  if ($('ret-yo')._src !== imgSkin) { $('ret-yo')._src = imgSkin; $('ret-yo').src = imgSkin; }
  ponCss($('brec'), 'display', cl ? 'block' : 'none');
  if (cl) ponCss($('brec').querySelector('i'), 'background', RECURSOS[cl.recurso].color);
  ponTxt($('h-oro'), yo.oro.toLocaleString('es'));
  ponTxt($('h-mton'), (yo.mton || 0).toLocaleString('es') + ' mTON');
  const pxp = yo.xpSig ? Math.floor(yo.xp / yo.xpSig * 100) : 100;
  rellenar($('bxp').querySelector('i'), pxp / 100);
  $('bxp').title = 'Experiencia: ' + yo.xp.toLocaleString('es') + ' / ' + (yo.xpSig || 0).toLocaleString('es') + ' (' + pxp + '%)';
  const q = MISIONES[yo.mis ? yo.mis.i : 0];
  const hm = $('h-mision');
  if (instancia && MAZMORRAS[instancia.id]) {
    const mz = MAZMORRAS[instancia.id];
    hm.textContent = '🏰 ' + mz.nombre + ' (Nv ' + instancia.nv + ') · Jefes ' + (instancia.hechos || 0) + '/' + mz.jefes.length;
    hm.className = '';
  } else if (!q) {
    const d = yo.diaria || { p: 0, ok: false };
    hm.textContent = d.ok ? '📅 Caza del día ✓ — vuelve mañana' : '📅 ' + DIARIA.nombre + ' ' + Math.min(d.p, DIARIA.n) + '/' + DIARIA.n;
    hm.className = !d.ok && d.p >= DIARIA.n ? 'lista' : '';
  }
  else {
    const lista = yo.mis.p >= q.n;
    hm.textContent = lista ? '📜 ' + q.nombre + ' ✓ — vuelve con Tito' : '📜 ' + q.nombre + ' ' + yo.mis.p + '/' + q.n;
    hm.className = lista ? 'lista' : '';
  }
  const T = yo.tareas;
  if (T) {
    const hd = T.dia.l.filter(t => t.ok).length, hs = T.sem.l.filter(t => t.ok).length;
    const sig = T.dia.l.find(t => !t.ok);
    ponTxt($('h-tareas'), '☀️ Diarias ' + hd + '/' + T.dia.l.length + ' · 📆 ' + hs + '/' + T.sem.l.length + (sig ? ' — ' + sig.txt + ' ' + sig.p + '/' + sig.n : '') + (temporadaYa() ? ' · ' + temporadaYa().emoji + ' ' + (yo[temporadaYa().campo] || 0) : ''));
  }
  pintarPoderes();
  pintarAcciones();
  pintarDescanso();
}

// ── MISIONES ──
function abrirMision() { if (!yo) return; abrir('m-mision'); pintarMision(); }
// Tocar la mision o las tareas del seguimiento (derecha) abre el registro.
$('seguimiento').addEventListener('click', e => { if (e.target.closest('#h-mision,#h-tareas')) abrirMision(); });
function cajaDiaria() {
  const d = yo.diaria || { p: 0, ok: false };
  const pr = premioDiaria(yo.nivel);
  const lista = d.p >= DIARIA.n && !d.ok;
  return '<div class="mis-caja"><b>📅 ' + esc(DIARIA.nombre) + '</b>' +
    '<p>Derrota ' + DIARIA.n + ' monstruos de tu nivel (o hasta 5 por debajo). Se renueva cada día.</p>' +
    '<div class="mis-barra"><i style="width:' + Math.round(Math.min(1, d.p / DIARIA.n) * 100) + '%;background:var(--ok)"></i></div>' +
    '<p>' + Math.min(d.p, DIARIA.n) + ' / ' + DIARIA.n + (d.ok ? ' · ✓ cobrada hoy' : '') + '</p>' +
    '<p style="color:var(--oro)">Recompensa: +' + pr.xp + ' XP · +' + pr.oro + ' oro · +' + pr.pocion + ' pociones</p>' +
    (lista ? '<button class="btn" id="b-diaria" style="width:100%;padding:10px;margin-top:6px">Cobrar caza del día</button>' : '') + '</div>';
}
// Diarias y semanales: se cobran solas, aqui solo se ven.
function cajaTareas() {
  const T = yo.tareas;
  if (!T) return '';
  const fila = t => `<div class="fila" style="${t.ok ? 'color:var(--ok)' : ''}"><span>${t.ok ? '✓' : '•'} ${esc(t.txt)}</span><span>${t.p}/${t.n}</span></div>`;
  return '<div class="mis-caja"><b>☀️ Misiones del día</b>' + T.dia.l.map(fila).join('') +
    `<p style="font-size:12px;margin-top:6px">Cada una: +${T.premio.xp.toLocaleString('es')} XP y +${T.premio.oro.toLocaleString('es')} oro. Las 3: ${T.dia.bono ? '✓ bono cobrado' : 'objeto raro + pociones y escudos'}. Se renuevan cada día.</p></div>` +
    '<div class="mis-caja"><b>📆 Misiones de la semana</b>' + T.sem.l.map(fila).join('') +
    `<p style="font-size:12px;margin-top:6px">Cada una: +${T.premioSem.xp.toLocaleString('es')} XP y +${T.premioSem.oro.toLocaleString('es')} oro. Las 2: ${T.sem.bono ? '✓ bono cobrado' : 'objeto épico'}. Se renuevan los lunes.</p></div>`;
}
// Final de juego: lo que queda por hacer esta semana (y hoy), de un vistazo.
function cajaSemana() {
  if (!yo || yo.nivel < RUNA_NIVEL) return '';
  const fila = (ok, txt, dcha) => `<div class="fila" style="${ok ? 'color:var(--ok)' : ''}"><span>${ok ? '✓' : '•'} ${txt}</span><span>${dcha}</span></div>`;
  const hoy = new Date().toISOString().slice(0, 10);
  let h = '<div class="mis-caja"><b>🗓️ Tu semana</b>';
  const md = yo.mazDia && yo.mazDia.d === hoy ? (yo.mazDia.hechas || []).length : 0;
  h += fila(md > 0, '🏰 Premio del día de mazmorra (uno por mazmorra)', md + ' hoy');
  const b = yo.boveda || { n: 0 };
  h += fila(b.n >= BOVEDA_UMBRALES[BOVEDA_UMBRALES.length - 1], '🗝️ Bóveda: mazmorras de la semana', `${b.n}/${BOVEDA_UMBRALES[BOVEDA_UMBRALES.length - 1]} → ${opcionesBoveda(b.n)} de 3`);
  if (yo.nivel >= NIVEL_MAX) {
    const ba = yo.banda || { j: [], t: 0 };
    const nj = MAZMORRAS.santuario ? MAZMORRAS.santuario.jefes.length : 4;
    h += fila(ba.j.length >= nj, '⚔️ Botín de la banda', `${ba.j.length}/${nj}`);
    if (!(yo.monturas || []).includes('abismo')) h += fila(false, '🦇 Titán para el Murciélago del Abismo', `${ba.t}/${BANDA_MONTURA}`);
  }
  if (hermandad && hermandad.gesta) {
    const G = hermandad.gesta, n = GESTA_UMBRALES.filter(u => G.p >= u).length;
    h += fila(n === GESTA_UMBRALES.length, '🏆 Gesta de tu hermandad', n ? GESTA_NOMBRES[n - 1] : G.p + '/' + GESTA_UMBRALES[0]);
  }
  const ru = yo.runas || {}, tot = Object.keys(RUNAS).reduce((a, k) => a + (ru[k] || 0), 0), max = Object.keys(RUNAS).length * RUNA_MAX;
  h += fila(tot >= max, '✨ Runas de la Artesana', tot + '/' + max);
  return h + '<p style="font-size:12px;margin-top:6px">La Bóveda, la banda, los afijos y la gesta se renuevan los lunes (UTC).</p></div>';
}
// Pase de temporada: progreso y los 20 niveles con su premio (se cobran a mano).
// "Que hacer ahora": las 3 cosas que mas te convienen con tu nivel y lo que
// tienes pendiente (hay muchos sistemas y el novato no sabe por donde ir).
function sugerencias() {
  const l = [];
  const qm = yo.mis && MISIONES[yo.mis.i];
  if (qm && yo.mis.p >= qm.n) l.push('✅ Tu misión está cumplida: entrégasela al Guardia Tito en el pueblo.');
  const ex = yo.exped;
  if (ex && Date.now() >= ex.fin) l.push('🧭 Tu expedición volvió: recógela aquí abajo.');
  const pa = yo.pase;
  if (pa) { const nv = Math.min(PASE.niveles, Math.floor(pa.p / PASE.porNivel)), sin = nv - (pa.cob || []).filter(n => n <= nv).length; if (sin > 0) l.push(`🎟️ Cobra ${sin} premio${sin > 1 ? 's' : ''} del pase (más abajo).`); }
  if (yo.bovedaOpc && yo.bovedaOpc.length) l.push('🗝️ Elige tu objeto de la Bóveda semanal (portal de mazmorras).');
  const msM = mundial.en ? mundial.en - performance.now() : 0;
  if (yo.nivel >= 5 && mundial.vivo) l.push('👹 ¡El jefe mundial está en el Coliseo! Todos los niveles ganan.');
  else if (yo.nivel >= 5 && msM > 0 && msM < 600000) l.push(`👹 Jefe mundial en ${Math.ceil(msM / 60000)} min: ve al Coliseo (portal del pueblo).`);
  if (horaFelizTiempos(Date.now()).activa) l.push('⚡ Es la Hora Feliz: caza ahora, +50% de experiencia.');
  const t = yo.tareas, pend = t && t.dia ? t.dia.l.filter(x => !x.ok) : [];
  if (pend.length) l.push(`📅 Te ${pend.length > 1 ? 'quedan ' + pend.length + ' diarias' : 'queda 1 diaria'}: ${esc(pend[0].txt)} (${pend[0].p}/${pend[0].n}).`);
  if (yo.nivel >= 10) {
    const hoy = new Date().toISOString().slice(0, 10), hechas = yo.mazDia && yo.mazDia.d === hoy ? yo.mazDia.hechas || [] : [];
    const mz = Object.entries(MAZMORRAS).filter(([id, m]) => !m.banda && yo.nivel >= m.nv[0] && !hechas.includes(id)).sort((a, b) => b[1].nv[0] - a[1].nv[0])[0];
    if (mz) l.push(`🏰 ${esc(mz[1].nombre)}: premio del día sin cobrar (XP, oro y un épico).`);
    if (!yo.torreSem) l.push('🗼 Sube la Torre del Duende: cada 5 pisos nuevos de la semana, un cofre.');
  }
  const z = zonaDeNivel(yo.nivel);
  if (MAPAS[z] && mapaId !== z) l.push(`🗺️ Tu zona ahora: ${esc(MAPAS[z].nombre)} (Nv ${MAPAS[z].nv[0]}-${MAPAS[z].nv[1]}).`);
  if (!ex && yo.nivel >= EXPEDICION.nv) l.push('🧭 Antes de irte, manda una expedición (aquí abajo).');
  l.push('🎣 Para descansar: pesca en el estanque del pueblo y cocina con la Artesana.');
  return l.slice(0, 3);
}
function cajaSugerencias() {
  if (!yo || !yo.clase) return '';
  return '<div class="mis-caja"><b>💡 Qué hacer ahora</b><ul style="padding-left:18px;margin-top:4px;font-size:13px;line-height:1.45">' + sugerencias().map(x => `<li>${x}</li>`).join('') + '</ul></div>';
}
function cajaExpedicion() {
  if (!yo || yo.nivel < EXPEDICION.nv) return '';
  const ex = yo.exped;
  const quien = yo.mascota && MASCOTAS[yo.mascota] ? MASCOTAS[yo.mascota].nombre : 'Un duendecillo explorador';
  let h = '<div class="mis-caja"><b>🧭 Expedición</b>';
  if (!ex) {
    h += `<p style="font-size:12px;color:var(--txt2)">${esc(quien)} puede salir a explorar mientras no juegas. Vuelve con oro, experiencia y materiales.</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">`;
    for (const hh of EXPEDICION.horas) { const pr = premioExpedicion(hh, yo.nivel); h += `<button class="btn sec" data-exped="${hh}" style="flex:1;min-width:90px">${hh} h<br><small>🪙 ${pr.oro.toLocaleString('es')}</small></button>`; }
    h += '</div>';
  } else {
    const ms = ex.fin - Date.now();
    if (ms <= 0) h += `<p>${esc(quien)} ya volvió.</p><button class="btn" id="b-exped" style="width:100%;margin-top:6px">Recoger</button>`;
    else {
      const hh = Math.floor(ms / 3600000), mm = Math.ceil(ms % 3600000 / 60000);
      h += `<p style="font-size:12px;color:var(--txt2)">${esc(quien)} vuelve en ${hh ? hh + ' h ' : ''}${mm} min.</p><div class="mis-barra"><i style="width:${Math.round((1 - ms / (ex.fin - ex.ini)) * 100)}%"></i></div>`;
    }
  }
  return h + '</div>';
}
function cajaPase() {
  if (!yo || !yo.pase) return '';
  const pa = yo.pase, nv = Math.floor(pa.p / PASE.porNivel), tope = PASE.niveles * PASE.porNivel;
  const mes = new Date(pa.mes + '-01T00:00:00Z').toLocaleDateString('es', { month: 'long', timeZone: 'UTC' });
  let h = `<div class="mis-caja"><b>🎟️ Pase de temporada de ${esc(mes)}</b>`;
  h += `<p style="font-size:12px;color:var(--txt2)">Nivel ${nv} de ${PASE.niveles} · ${pa.p >= tope ? 'completo' : (pa.p % PASE.porNivel) + '/' + PASE.porNivel + ' puntos para el siguiente'}. Puntos: misión diaria ${PASE.puntos.diaria}, semanal ${PASE.puntos.semanal}, mazmorra ${PASE.puntos.mazmorra}, jefe mundial ${PASE.puntos.mundial}, cofre de la Torre ${PASE.puntos.torre}. Gratis; empieza de cero cada mes.</p>`;
  h += `<div class="mis-barra"><i style="width:${pa.p >= tope ? 100 : Math.round((pa.p % PASE.porNivel) / PASE.porNivel * 100)}%"></i></div>`;
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:8px">';
  for (let n = 1; n <= PASE.niveles; n++) {
    const pr = premioPase(n, yo.nivel), cob = pa.cob.includes(n), listo = nv >= n && !cob;
    h += `<div style="border:1px solid ${listo ? 'var(--ok)' : 'var(--borde)'};border-radius:8px;padding:6px;font-size:12px;${cob ? 'opacity:.5' : ''}"><b style="display:inline;color:var(--txt)">${n}</b> ${esc(pr.txt)}${listo ? `<br><button class="btn" data-pase="${n}" style="margin-top:4px;padding:4px 10px">Cobrar</button>` : cob ? ' ✓' : ''}</div>`;
  }
  return h + '</div></div>';
}
function cercaDeTito() { const t = MAPAS.pueblo.npcs.find(n => n.tipo === 'guia'); return mapaId === 'pueblo' && t && Math.abs(P.x - t.x) < 190; }
function pintarMision() {
  const i = yo.mis ? yo.mis.i : 0, q = MISIONES[i];
  const cuerpo = $('mision-cuerpo');
  const conectarDiaria = () => { const b = $('b-diaria'); if (b) b.onclick = () => { sfx('boton', .3); mandar({ t: 'mision', diaria: true }); }; };
  const conectarPase = () => {
    cuerpo.querySelectorAll('[data-pase]').forEach(b => b.onclick = () => { sfx('moneda', .4); mandar({ t: 'pase', n: +b.dataset.pase }); });
    cuerpo.querySelectorAll('[data-exped]').forEach(b => b.onclick = () => { sfx('boton', .4); mandar({ t: 'exped', h: +b.dataset.exped }); });
    const be = $('b-exped'); if (be) be.onclick = () => { sfx('moneda', .5); mandar({ t: 'exped', recoger: 1 }); };
  };
  if (!q) { cuerpo.innerHTML = '<p class="centro">Completaste las ' + MISIONES.length + ' misiones. Eres una leyenda del Pueblo Duende. 👑</p>' + cajaSugerencias() + cajaExpedicion() + cajaPase() + cajaSemana() + cajaDiaria() + cajaTareas(); conectarDiaria(); conectarPase(); return; }
  const def = MONSTRUOS[q.tipo];
  const zona = MAPAS[zonaDe(q.tipo)];
  const lista = yo.mis.p >= q.n;
  const extra = q.pw ? ' · ' + Object.entries(q.pw).map(([k, v]) => v + ' ' + PODERES.find(p => p.id === k).nombre).join(', ') : '';
  const pide = def.jefe ? 'Participa en la caída de <b style="display:inline;color:var(--txt)">' + esc(def.nombre) + '</b>' : 'Derrota ' + q.n + ' × <b style="display:inline;color:var(--txt)">' + esc(def.nombre) + '</b>';
  cuerpo.innerHTML =
    '<p>Misión ' + (i + 1) + ' de ' + MISIONES.length + '</p>' +
    '<div class="mis-caja"><b>' + esc(q.nombre) + '</b>' +
    '<p>' + pide + ' en ' + esc(zona ? zona.nombre : '?') + ' (Nv ' + def.nivel + ').</p>' +
    '<div class="mis-barra"><i style="width:' + Math.round(yo.mis.p / q.n * 100) + '%"></i></div>' +
    '<p>' + yo.mis.p + ' / ' + q.n + '</p>' +
    '<p style="color:var(--oro)">Recompensa: +' + q.xp + ' XP · +' + q.oro + ' oro' + esc(extra) + '</p></div>' +
    (lista && cercaDeTito() ? '<button class="btn" id="b-entregar" style="width:100%;padding:12px">Entregar misión</button>'
      : lista ? '<p class="centro" style="color:var(--ok)">✅ ¡Cumplida! Entrégasela al Guardia Tito en el pueblo (sigue la flecha amarilla o usa la Piedra de Hogar 🌀).</p>'
      : '<p class="centro">Vuelve cuando la termines.</p>') +
    cajaSugerencias() + cajaExpedicion() + cajaPase() + cajaSemana() + cajaDiaria() + cajaTareas();
  conectarPase();
  const b = $('b-entregar');
  if (b) b.onclick = () => { sfx('boton', .3); mandar({ t: 'mision' }); };
  conectarDiaria();
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
  for (const mx of muros) { mg.fillStyle = '#e9d5ff'; mg.fillRect(4 + mx * k - 1, 2, 2, H - 4); }
  for (const n of (mp.npcs || [])) { mg.fillStyle = '#00ff88'; mg.fillRect(4 + n.x * k - 1.5, y - 2, 3, 4); }
  for (const o of mons.values()) if (MONSTRUOS[o.k].jefe && !o.muereT) { mg.fillStyle = '#ff3cf0'; mg.beginPath(); mg.arc(4 + o.x * k, y, 4, 0, 7); mg.fill(); }
  for (const q of otros.values()) { mg.fillStyle = '#00eeff'; mg.fillRect(4 + q.x * k - 1.5, y - 3, 3, 6); }
  dibujarMiniMundoAbierto(k, y);
  mg.fillStyle = '#ffe600'; mg.fillRect(4 + P.x * k - 2, y - 4, 4, 8);
}
// ── MARCOS DE UNIDAD (cada fotograma; solo tocan el DOM si algo cambia) ──
function ponClase(el, c, on) { const k = '_cl' + c; if (el[k] !== on) { el[k] = on; el.classList.toggle(c, on); } }
// Relleno de una barra (0..1) con transform: sin recalcular el diseño.
function rellenar(i, k) { if (i) ponCss(i, 'transform', 'scaleX(' + Math.max(0, Math.min(100, Math.round(k * 100))) / 100 + ')'); }
function pintarBarra(el, k, txt) {
  rellenar(el._i || (el._i = el.querySelector('i')), k);
  if (txt !== undefined) ponTxt(el._s || (el._s = el.querySelector('span')), txt);
}
// Iconos de auras con los segundos que les quedan (verde = buena, rojo = mala).
function pintarAuras(el, au, extra) {
  const ahora = performance.now();
  const lista = [];
  for (const a of (extra || [])) lista.push([a, Infinity]);
  for (const a in (au || {})) if (au[a] > ahora && AURAS[a]) lista.push([a, au[a]]);
  const clave = lista.map(x => x[0]).join(',');
  if (el._clave !== clave) {
    el._clave = clave;
    el.innerHTML = lista.map(([a]) => { const d = AURAS[a]; return `<div class="au ${d.mala ? 'mala' : ''}" title="${esc(d.nombre)}"><img src="${A}${d.dir || 'items/equipo/'}${d.icono}.png" alt=""><span></span></div>`; }).join('');
  }
  if (frame % 10 === 0) lista.forEach(([, fin], i) => {
    const sp = el.children[i] && el.children[i].querySelector('span');
    if (sp) ponTxt(sp, fin === Infinity ? '' : String(Math.max(0, Math.ceil((fin - ahora) / 1000))));
  });
}
function pintarVida() {
  const k = P.maxHp ? P.hp / P.maxHp : 1;
  pintarBarra($('bhp'), k, Math.max(0, Math.ceil(P.hp)) + '/' + P.maxHp);
  ponClase($('bhp'), 'bajo', k < .3);
  if (P.recMax) pintarBarra($('brec'), P.rec / P.recMax, Math.floor(P.rec) + '/' + P.recMax);
  const cps = $('h-combo');
  if (yo && yo.clase === 'picaro') {
    if (cps.children.length !== 5) cps.innerHTML = '<i></i>'.repeat(5);
    for (let i = 0; i < 5; i++) ponClase(cps.children[i], 'on', i < P.combo);
  } else if (cps.children.length) cps.innerHTML = '';
  pintarAuras($('au-yo'), aurasP.get(miId), [P.escudo ? 'escudo' : '', P.fuego ? 'fuego' : ''].filter(Boolean));
  pintarObjetivo();
  pintarAccionesObjetivo();
  pintarGrupo();
  pintarLanzar();
  if (frame % 10 === 0) pintarTutorial();
}
let retratoDe = '';
function pintarObjetivo() {
  const uf = $('uf-obj');
  const o = monObjetivo();
  const q = !o && objetivo && objetivo.k === 'p' ? (objetivo.id === miId ? P : otros.get(objetivo.id)) : null;
  if ((!o || o.muereT) && !q) { ponCss(uf, 'display', 'none'); return; }
  ponCss(uf, 'display', 'flex');
  ponClase(uf, 'hostil', !!o); ponClase(uf, 'amigo', !o);
  const clave = o ? 'm' + o.id : 'p' + objetivo.id + (q === P ? yo.skin : q.sk);
  if (retratoDe !== clave) { retratoDe = clave; dibujarRetrato(o, q); }
  if (o) {
    const def = MONSTRUOS[o.k];
    ponTxt($('o-nombre'), def.nombre);
    ponCss($('o-nombre'), 'color', colorNivel(o.nv));
    ponTxt($('o-nivel'), def.jefe ? '☠' : String(o.nv));
    ponTxt($('o-tipo'), def.jefe ? 'Jefe' : 'Nv ' + o.nv);
    pintarBarra($('ohp'), o.hp / o.mx, Math.max(0, o.hp).toLocaleString('es') + '/' + o.mx.toLocaleString('es'));
    ponCss($('orec'), 'display', 'none');
    const cm = castMon.get(o.id);
    ponCss($('ocast'), 'display', cm ? 'block' : 'none');
    if (cm) {
      ponClase($('ocast'), 'noint', !cm.int);
      pintarBarra($('ocast'), (performance.now() - cm.ini) / (cm.fin - cm.ini), cm.nombre);
    }
    pintarAuras($('au-obj'), aurasM.get(o.id));
  } else {
    const yoMismo = q === P;
    const cl = CLASES[yoMismo ? yo.clase : q.cl];
    ponTxt($('o-nombre'), yoMismo ? yo.nombre : q.n);
    ponCss($('o-nombre'), 'color', cl ? cl.color : '#fff');
    ponTxt($('o-nivel'), String(yoMismo ? yo.nivel : q.lv));
    ponTxt($('o-tipo'), cl ? cl.nombre : 'Jugador');
    const hp = yoMismo ? P.hp : q.hp, mx = yoMismo ? P.maxHp : q.mx;
    pintarBarra($('ohp'), (q.muerto ? 0 : hp) / mx, q.muerto ? 'Caído' : Math.max(0, Math.ceil(hp)) + '/' + mx);
    const rec = yoMismo ? P.rec : q.rec, rmx = yoMismo ? P.recMax : q.rmx;
    ponCss($('orec'), 'display', cl && rmx ? 'block' : 'none');
    if (cl && rmx) { ponCss($('orec').querySelector('i'), 'background', RECURSOS[cl.recurso].color); pintarBarra($('orec'), rec / rmx, Math.floor(rec) + '/' + rmx); }
    ponCss($('ocast'), 'display', 'none');
    pintarAuras($('au-obj'), aurasP.get(objetivo.id));
  }
}
// Retrato del objetivo: el primer cuadro de su hoja (o la skin del jugador).
function dibujarRetrato(o, q) {
  const c = $('ret-obj'), x = c.getContext('2d');
  x.clearRect(0, 0, 64, 64);
  x.imageSmoothingEnabled = false;
  if (o) {
    const def = MONSTRUOS[o.k], hoja = HOJAS[def.hoja];
    const img = def.tinte ? tenido('sh_' + def.hoja, def.tinte) : IMG['sh_' + def.hoja];
    if (!img || !(img.naturalWidth || img.width)) return;
    const e = Math.min(52 / hoja.ideal, 80 / hoja.fw);
    const dw = hoja.fw * e, dh = hoja.fh * e;
    x.save(); x.translate(32, 60); if ((o.f > 0) === !!hoja.izq) x.scale(-1, 1);
    x.drawImage(img, hoja.mov[1] * hoja.fw, hoja.mov[0] * hoja.fh, hoja.fw, hoja.fh, -dw / 2, -dh, dw, dh);
    x.restore();
  } else {
    const skin = q === P ? yo.skin : q.sk;
    const img = IMG[SKINS[skin] ? SKINS[skin].img : 'skin_hero'];
    if (!img || !img.naturalWidth) return;
    const e = Math.min(60 / img.naturalWidth, 60 / img.naturalHeight);
    x.drawImage(img, 32 - img.naturalWidth * e / 2, 62 - img.naturalHeight * e, img.naturalWidth * e, img.naturalHeight * e);
  }
}
function pintarLanzar() {
  if (!castYo) return;
  const ahora = performance.now();
  const k = Math.min(1, (ahora - castYo.ini) / (castYo.fin - castYo.ini));
  if (castYo.id === 'pescar') { rellenar($('lanzar').querySelector('i'), .5 + Math.sin(ahora / 300) * .1); ponTxt($('lanzar-t'), '🎣 Espera a que pique…'); return; }
  if (castYo.id === 'pica') { rellenar($('lanzar').querySelector('i'), 1 - k); ponTxt($('lanzar-t'), '🐟 ¡PICA! Pulsa ' + (TACTIL ? '¡TIRA!' : 'E')); return; }
  rellenar($('lanzar').querySelector('i'), k);
  ponTxt($('lanzar-t'), castYo.nombre + '  ' + Math.max(0, (castYo.fin - ahora) / 1000).toFixed(1) + ' s');
}

function aviso(txt, tipo) {
  const d = document.createElement('div');
  d.className = 'aviso';
  if (tipo === 'ok') d.style.borderColor = 'var(--ok)';
  if (tipo === 'jefe') { d.style.borderColor = 'var(--warn)'; d.style.color = 'var(--txt)'; }
  d.textContent = txt;
  $('avisos').appendChild(d);
  setTimeout(() => d.remove(), 3700);
  while ($('avisos').children.length > 4) $('avisos').firstChild.remove();
}

function lineaChat(nombre, txt, canal, colorNombre) {
  const d = document.createElement('div');
  if (nombre) {
    const b = document.createElement('b'); b.textContent = nombre + ': ';
    if (colorNombre) b.style.color = colorNombre;
    d.appendChild(b); d.appendChild(document.createTextNode(txt));
    if (canal && COLOR_CANAL[canal]) d.style.color = COLOR_CANAL[canal];
  }
  else { d.className = 'sis'; d.textContent = txt; if (canal && COLOR_CANAL[canal]) d.style.color = COLOR_CANAL[canal]; }
  $('chat-log').appendChild(d);
  while ($('chat-log').children.length > 8) $('chat-log').firstChild.remove();
}

// ── VENTANAS ──
function abrir(id) { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'm-muerte') m.classList.remove('on'); }); $(id).classList.add('on'); for (const k in teclas) teclas[k] = false; tIzq = tDer = false; }
function cerrarModales() { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'm-muerte' && m.id !== 'm-inicio' && m.id !== 'm-error' && !(m.id === 'm-clase' && yo && !yo.clase)) m.classList.remove('on'); }); }
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
  if (tabTienda === 'premium') { L.innerHTML = htmlPremium(); conectarPremium(L); return; }
  let h = '';
  const nvF = id => (yo.forja || {})[id] || 0;
  if (tabTienda === 'forja') {
    for (const id of yo.armas) {
      const d = ARMAS[id], n = nvF(id);
      const ico = `<img src="${A}armas/${d.icono}_item.png" style="${id !== 'katana' ? 'filter:drop-shadow(0 0 4px ' + d.color + ')' : ''}">`;
      const desc = 'Daño ×' + multForja(n).toFixed(2) + (n < FORJA_MAX ? ' → ×' + multForja(n + 1).toFixed(2) : ' · máximo');
      const acc = n >= FORJA_MAX ? '<span class="precio" style="color:var(--ok)">✓ +' + FORJA_MAX + '</span>'
        : `<span class="precio">🪙 ${costoForja(n).toLocaleString('es')}</span><button class="btn" data-comprar="forja" data-id="${id}" ${yo.oro < costoForja(n) ? 'disabled' : ''}>Mejorar a +${n + 1}</button>`;
      h += tarjeta(ico, d.nombre + ' +' + n, desc, acc);
    }
    h += '<p style="margin-top:8px;font-size:12px;color:var(--txt2)">Cada mejora sale siempre bien: +7% de daño por nivel, hasta +' + FORJA_MAX + '. Compra más armas en la pestaña «Armas» para forjarlas también.</p>';
  } else if (tabTienda === 'tinte') {
    for (const [id, tn] of Object.entries(TINTES)) {
      const tiene = (yo.tintes || []).includes(id);
      if (tn.amb && !tiene) continue;   // los del ambulante, en su pestaña
      const muestra = tn.color === 'arcoiris' ? 'background:linear-gradient(90deg,#f43f5e,#facc15,#34d399,#38bdf8,#c084fc)' : 'background:' + tn.color;
      const ico = `<div style="width:40px;height:40px;border-radius:8px;${muestra}"></div>`;
      const acc = tiene ? (yo.tinte === id ? '<span class="precio" style="color:var(--ok)">✓ En uso</span>' : `<button class="btn sec" data-comprar="tinte" data-id="${id}">Usar</button>`)
        : yo.nivel < tn.nv ? `<span class="precio" style="color:var(--warn)">Nv ${tn.nv}</span><span class="precio">🪙 ${tn.precio.toLocaleString('es')}</span>`
        : `<span class="precio">🪙 ${tn.precio.toLocaleString('es')}</span><button class="btn" data-comprar="tinte" data-id="${id}" ${yo.oro < tn.precio ? 'disabled' : ''}>Comprar</button>`;
      h += tarjeta(ico, `<span style="color:${tn.color === 'arcoiris' ? '#facc15' : tn.color}">${esc(tn.nombre)}</span>`, 'Color de tu nombre sobre tu duende: lo ven todos. Solo estética.', acc);
    }
    if (yo.tinte) h += `<button class="btn sec" data-comprar="tinte" data-id="" style="width:100%;margin-top:6px">Volver al color de mi clase</button>`;
  } else if (tabTienda === 'mascota') {
    for (const [id, ma] of Object.entries(MASCOTAS)) {
      const tiene = (yo.mascotas || []).includes(id);
      if ((ma.amb || ma.pase || ma.pesca) && !tiene) continue;   // las del ambulante, en su pestaña; la del pase no se vende
      const ico = `<canvas data-hoja="${ma.hoja}" data-tinte="${ma.tinte || ''}" width="52" height="52"></canvas>`;
      const acc = tiene ? (yo.mascota === id ? '<span class="precio" style="color:var(--ok)">✓ Te acompaña</span>' : `<button class="btn sec" data-comprar="mascota" data-id="${id}">Llevar</button>`)
        : yo.nivel < ma.nv ? `<span class="precio" style="color:var(--warn)">Nv ${ma.nv}</span><span class="precio">🪙 ${ma.precio.toLocaleString('es')}</span>`
        : `<span class="precio">🪙 ${ma.precio.toLocaleString('es')}</span><button class="btn" data-comprar="mascota" data-id="${id}" ${yo.oro < ma.precio ? 'disabled' : ''}>Comprar</button>`;
      h += tarjeta(ico, esc(ma.nombre), 'Te sigue a todas partes y la ven todos. Solo estética: no da nada.', acc);
    }
    if (yo.mascota) h += `<button class="btn sec" data-comprar="mascota" data-id="" style="width:100%;margin-top:6px">Guardar a mi mascota</button>`;
  } else if (tabTienda === 'ambulante') {
    // Mercader ambulante: la oferta de esta semana; se compra de viernes a domingo (UTC).
    const activo = ambulanteActivo(), of = ambulanteOferta();
    h += `<p style="font-size:13px;color:var(--txt2);margin-bottom:8px">${activo ? '🧳 <b style="color:var(--ok)">El ambulante está aquí este fin de semana.</b>' : '🧳 El ambulante llega el <b>viernes</b> y se va el domingo (UTC).'} Cada semana trae otra cosa (solo estética). Su oferta de esta semana:</p>`;
    const fila = (k, id, d, ico, extra) => {
      const tiene = ((k === 'tinte' ? yo.tintes : yo.mascotas) || []).includes(id);
      const acc = tiene ? '<span class="precio" style="color:var(--ok)">✓ Ya es tuyo</span>'
        : yo.nivel < d.nv ? `<span class="precio" style="color:var(--warn)">Nv ${d.nv}</span><span class="precio">🪙 ${d.precio.toLocaleString('es')}</span>`
        : `<span class="precio">🪙 ${d.precio.toLocaleString('es')}</span><button class="btn" data-comprar="${k}" data-id="${id}" ${!activo || yo.oro < d.precio ? 'disabled' : ''}>${activo ? 'Comprar' : 'El viernes'}</button>`;
      h += tarjeta(ico, extra, k === 'tinte' ? 'Color de nombre exclusivo del ambulante.' : 'Mascota exclusiva del ambulante.', acc);
    };
    for (const id of of.tintes) { const tn = TINTES[id]; fila('tinte', id, tn, `<div style="width:40px;height:40px;border-radius:8px;background:${tn.color}"></div>`, `<span style="color:${tn.color}">${esc(tn.nombre)}</span>`); }
    for (const id of of.mascotas) { const ma = MASCOTAS[id]; fila('mascota', id, ma, `<canvas data-hoja="${ma.hoja}" data-tinte="${ma.tinte || ''}" width="52" height="52"></canvas>`, esc(ma.nombre)); }
  } else if (tabTienda === 'montura') {
    for (const [id, mo] of Object.entries(MONTURAS)) {
      const tiene = (yo.monturas || []).includes(id);
      const ico = `<canvas data-montura="${id}" width="52" height="52"></canvas>`;
      const acc = tiene ? (yo.montura === id ? '<span class="precio" style="color:var(--ok)">✓ En uso</span>' : `<button class="btn sec" data-comprar="montura" data-id="${id}">Usar</button>`)
        : mo.banda ? `<span class="precio" style="color:var(--txt2)">⚔️ Banda ${(yo.banda || {}).t || 0}/${BANDA_MONTURA}</span>`
        : yo.nivel < mo.nv ? `<span class="precio" style="color:var(--warn)">Nv ${mo.nv}</span><span class="precio">🪙 ${mo.precio.toLocaleString('es')}</span>`
        : `<span class="precio">🪙 ${mo.precio.toLocaleString('es')}</span><button class="btn" data-comprar="montura" data-id="${id}" ${yo.oro < mo.precio ? 'disabled' : ''}>Comprar</button>`;
      h += tarjeta(ico, esc(mo.nombre), `+${Math.round((mo.vel - 1) * 100)}% de velocidad · ` + (mo.banda ? `no se vende: vence al Titán de la banda en ${BANDA_MONTURA} semanas distintas` : `desde Nv ${mo.nv}`), acc);
    }
    h += '<p style="margin-top:8px;font-size:12px;color:var(--txt2)">Monta con la tecla Y o el botón 🐎 (1,5 s, fuera de combate). No se puede montar en mazmorras ni en el Coliseo.</p>';
  } else if (tabTienda === 'pw') {
    PODERES.forEach(p => {
      h += tarjeta(`<img src="${A}items/${p.icono}.png">`, p.nombre + ` <span style="color:var(--txt2)">(tienes ${yo.pw[p.id] || 0})</span>`, p.desc,
        `<span class="precio">🪙 ${p.precio}</span><button class="btn" data-comprar="pw" data-id="${p.id}" data-n="1" ${yo.oro < p.precio ? 'disabled' : ''}>Comprar</button><button class="btn sec" data-comprar="pw" data-id="${p.id}" data-n="5" ${yo.oro < p.precio * 5 ? 'disabled' : ''}>×5</button>`);
    });
  } else {
    const tabla = tabTienda === 'arma' ? ARMAS : SKINS;
    const tiene = tabTienda === 'arma' ? yo.armas : yo.skins;
    const puesto = tabTienda === 'arma' ? yo.arma : yo.skin;
    for (const id in tabla) {
      const d = tabla[id];
      const ico = tabTienda === 'arma' ? `<img src="${A}armas/${d.icono}_item.png" style="${d.color && id !== 'katana' ? 'filter:drop-shadow(0 0 4px ' + d.color + ')' : ''}">` : `<img src="${A}skins/${d.img}.png">`;
      let acc;
      if (tiene.includes(id)) acc = puesto === id ? '<span class="precio" style="color:var(--ok)">✓ Equipado</span>' : `<button class="btn sec" data-equipar="${tabTienda}" data-id="${id}">Equipar</button>`;
      else {
        acc = `<span class="precio">🪙 ${d.precio.toLocaleString('es')}</span><button class="btn" data-comprar="${tabTienda}" data-id="${id}" ${yo.oro < d.precio ? 'disabled' : ''}>Comprar</button>`;
        // Skins: tambien con dinero; el pago lo revisa El Duende y la entrega a mano.
        if (tabTienda === 'skin' && d.usd && yo.p2e && yo.p2e.cuenta) acc += (TG && !forzarInvitado)
          ? `<button class="btn sec" data-premium="skin_${id}" data-metodo="stars">⭐ ${estrellasDe(d.usd)}</button>`
          : `<button class="btn sec" data-premium="skin_${id}" data-metodo="sol">◎ ~$${d.usd} en SOL</button>`;
      }
      if (tabTienda === 'skin' && !tiene.includes(id)) acc += `<button class="btn sec" data-probar="${id}">Probar</button>`;
      h += tarjeta(ico, d.nombre, d.desc + (tabTienda === 'skin' && puesto !== id ? difSkin(id) : ''), acc);
    }
    if (tabTienda === 'skin') h += '<p style="margin-top:8px;font-size:12px;color:var(--txt2)">Cada skin da sus poderes mientras la llevas. Se compran con oro o, con tu cuenta, con dinero: ' + ((TG && !forzarInvitado) ? 'Telegram Stars' : 'SOL a la wallet de El Duende') + '; El Duende revisa el pago y te la entrega en tu personaje. Las skins que ya pagaste en el juego principal se desbloquean solas al entrar con tu cuenta.</p>';
  }
  L.innerHTML = h;
  // Retratos de las monturas (primer cuadro de su hoja).
  L.querySelectorAll('canvas[data-montura], canvas[data-hoja]').forEach(c => {
    const hoja = c.dataset.hoja || MONTURAS[c.dataset.montura].hoja;
    const hm = HOJAS[hoja], img = c.dataset.tinte ? tenido('sh_' + hoja, c.dataset.tinte) : IMG['sh_' + hoja];
    if (!img || !(img.naturalWidth || img.width)) return;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const e = Math.min(48 / hm.fw, 48 / hm.fh);
    x.save(); x.translate(26, 50); if (hm.izq) x.scale(-1, 1);
    x.drawImage(img, hm.mov[1] * hm.fw, hm.mov[0] * hm.fh, hm.fw, hm.fh, -hm.fw * e / 2, -hm.fh * e, hm.fw * e, hm.fh * e);
    x.restore();
  });
  L.querySelectorAll('[data-comprar]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'comprar', k: b.dataset.comprar, id: b.dataset.id, n: +b.dataset.n || 1 }); });
  conectarPremium(L);   // skins: el boton de pagar con dinero
  L.querySelectorAll('[data-probar]').forEach(b => b.onclick = () => {
    probando = { skin: b.dataset.probar, hasta: performance.now() + 10000 };
    cerrarModales(); sfx('boton', .3);
    aviso('👀 Probando ' + SKINS[b.dataset.probar].nombre + ' durante 10 s (solo lo ves tú).', 'ok');
  });
  L.querySelectorAll('[data-equipar]').forEach(b => b.onclick = () => { sfx('boton', .3); mandar({ t: 'equipar', k: b.dataset.equipar, id: b.dataset.id }); });
}

let tabInv = 'skin';
document.querySelectorAll('[data-itab]').forEach(b => b.onclick = () => { tabInv = b.dataset.itab; document.querySelectorAll('[data-itab]').forEach(x => x.classList.toggle('on', x === b)); pintarInventario(); });
function abrirInventario() { if (!yo) return; abrir('m-inv'); pintarInventario(); }
function pintarInventario() {
  if (!yo) return;
  if (tabInv === 'equipo' || tabInv === 'logros' || tabInv === 'bestiario' || tabInv === 'chicha') $('inv-stats').innerHTML = '';
  else $('inv-stats').innerHTML =
    `<div class="fila"><span>Nivel</span><span>${yo.nivel}</span></div>` +
    `<div class="fila"><span>Vida</span><span>${yo.maxHp}</span></div>` +
    `<div class="fila"><span>Ataque</span><span>${yo.atk}</span></div>` +
    `<div class="fila"><span>Defensa</span><span>${yo.def}</span></div>` +
    `<div class="fila"><span>Crítico</span><span>${Math.round((yo.crit || .12) * 100)}%</span></div>` +
    `<div class="fila"><span>Arma</span><span>${esc(ARMAS[yo.arma].nombre)} +${(yo.forja || {})[yo.arma] || 0}</span></div>` +
    `<div class="fila"><span>Monstruos / jefes</span><span>${yo.kills} / ${yo.jefes}</span></div>`;
  if (tabInv === 'equipo') return pintarEquipo();
  if (tabInv === 'logros') return pintarLogros();
  if (tabInv === 'bestiario') return pintarBestiario();
  if (tabInv === 'chicha') return pintarChicha();
  const tabla = tabInv === 'arma' ? ARMAS : SKINS;
  const tiene = tabInv === 'arma' ? yo.armas : yo.skins;
  const puesto = tabInv === 'arma' ? yo.arma : yo.skin;
  let h = '';
  for (const id in tabla) {
    const d = tabla[id];
    const ico = tabInv === 'arma' ? `<img src="${A}armas/${d.icono}_item.png">` : `<img src="${A}skins/${d.img}.png">`;
    const acc = !tiene.includes(id) ? '<span class="precio" style="color:var(--txt3)">🔒 Mercader</span>'
      : puesto === id ? '<span class="precio" style="color:var(--ok)">✓ Equipado</span>'
      : `<button class="btn sec" data-equipar="${tabInv}" data-id="${id}">Equipar</button>`;
    const mas = tabInv === 'arma' && tiene.includes(id) ? ' +' + ((yo.forja || {})[id] || 0) : '';
    h += tarjeta(ico, d.nombre + mas, d.desc, acc);
  }
  $('inv-lista').innerHTML = h;
  $('inv-lista').querySelectorAll('[data-equipar]').forEach(b => b.onclick = () => mandar({ t: 'equipar', k: b.dataset.equipar, id: b.dataset.id }));
}

function abrirRanking() { abrir('m-rank'); $('rank-lista').innerHTML = '<p class="centro">Cargando…</p>'; mandar({ t: 'ranking' }); }
// Dos rankings: el de la semana (experiencia ganada; premia al top 3 cada
// lunes, asi un jugador nuevo tambien puede ganar) y el de siempre (nivel).
function pintarRanking(r, sem, finSem, des, dsem, af, duel, elo, torre, tmax, herm) {
  const med = ['🥇', '🥈', '🥉'];
  let h = '<p style="font-size:12px;color:var(--txt);font-weight:600;margin-bottom:4px">🏆 Esta semana (experiencia ganada)</p>';
  if (finSem) { const ms = finSem - Date.now(); const d = Math.floor(ms / 86400000), hh = Math.floor(ms / 3600000) % 24; h += `<p style="font-size:12px;color:var(--txt2);margin-bottom:6px">Termina en ${d} d ${hh} h. Premios: 🥇 oro ×400 tu nivel, objeto épico y título · 🥈 ×200 · 🥉 ×100.</p>`; }
  h += (sem && sem.length) ? sem.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>${x.xp.toLocaleString('es')} XP · Nv ${x.lv}</span></div>`).join('') : '<p class="centro">Nadie ha cazado aún esta semana.</p>';
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">⭐ Los más fuertes (nivel)</p>';
  h += r.length ? r.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>Nv ${x.lv} · ${x.k} caz.</span></div>`).join('') : '<p class="centro">Todavía nadie sube de nivel.</p>';
  // Desafios de la semana (con sus afijos) y de siempre: el mejor +k de cada uno.
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">⚡ Desafíos de esta semana</p>';
  if (af && af.length) h += `<p style="font-size:12px;color:var(--txt2);margin-bottom:6px">Afijos: ${af.map(a => AFIJOS[a] ? AFIJOS[a].emoji + ' ' + AFIJOS[a].nombre : '').join(' · ')}. Premios desde el +${DES_SEM_MIN}: 🥇 ${premioDesSem(0).toLocaleString('es')} oro y título · 🥈 ${premioDesSem(1).toLocaleString('es')} · 🥉 ${premioDesSem(2).toLocaleString('es')}.</p>`;
  h += (dsem && dsem.length) ? dsem.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>⚡ +${x.k}</span></div>`).join('') : '<p class="centro" style="font-size:12px">Nadie ha vencido un Desafío esta semana.</p>';
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">⚡ Desafíos de mazmorra (mejor +k de siempre)</p>';
  h += (des && des.length) ? des.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>⚡ +${x.k}</span></div>`).join('') : '<p class="centro" style="font-size:12px">Nadie ha vencido aún un Desafío. Se abren a nivel 60 en el portal de mazmorras.</p>';
  // Torre del Duende: mejor piso de la semana.
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">🗼 Torre del Duende (esta semana)' + (tmax ? ' · tu marca: piso ' + tmax : '') + '</p>';
  h += `<p style="font-size:12px;color:var(--txt2);margin-bottom:4px">Premios el lunes (desde el piso ${TORRE.semMin}): 🥇 ${premioTorreSem(0).toLocaleString('es')} oro y título Rey de la Torre · 🥈 ${premioTorreSem(1).toLocaleString('es')} · 🥉 ${premioTorreSem(2).toLocaleString('es')}.</p>`;
  h += (torre && torre.length) ? torre.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>piso ${x.p}</span></div>`).join('') : '<p class="centro" style="font-size:12px">Nadie ha subido aún esta semana. Entra por el portal de mazmorras del pueblo (Nv 10+).</p>';
  // Hermandades: puntos de la gesta de esta semana.
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">🛡️ Hermandades (gesta de esta semana)</p>';
  h += (herm && herm.length) ? herm.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>${x.p.toLocaleString('es')} pts · ${x.m} miembros</span></div>`).join('') : '<p class="centro" style="font-size:12px">Ninguna hermandad ha sumado aún esta semana. Fúndala desde Social (Nv 10).</p>';
  // Duelos (Elo): se cuenta con cuenta y desde Nv 10; 3 al dia por pareja.
  h += '<p style="font-size:12px;color:var(--txt);font-weight:600;margin:12px 0 4px">⚔️ Duelistas (Elo)' + (elo ? ' · tu Elo: ' + elo : '') + '</p>';
  h += (duel && duel.length) ? duel.map((x, i) => `<div class="fila ${x.yo ? 'yo' : ''}"><span>${med[i] || '#' + (i + 1)} ${esc(x.n)}</span><span>${x.e} · ${x.g} victorias</span></div>`).join('') : '<p class="centro" style="font-size:12px">Nadie ha ganado aún un duelo que cuente. Reta a alguien desde su marco (⚔️): con cuenta y desde Nv 10.</p>';
  $('rank-lista').innerHTML = h;
}

// Resumen de la muerte: quien te mato, los ultimos golpes y un consejo.
// Morir sin entender por que es de lo que mas hace abandonar.
function resumenMuerte(m) {
  const g = m.golpes || [];
  const ult = g[g.length - 1];
  let h = '';
  if (ult) h += `<p>Te venció: <b style="color:var(--err)">${esc(ult.n)}${ult.nv ? ' (Nv ' + ult.nv + ')' : ''}</b></p>`;
  if (g.length) h += '<p style="font-size:12px;color:var(--txt2)">Últimos golpes: ' + g.map(x => esc(x.n) + ' −' + x.d).join(' · ') + '</p>';
  let consejo = '';
  if (ult && ult.nv && yo && ult.nv >= yo.nivel + 3) consejo = 'Ese enemigo es de nivel bastante más alto que tú: sube un par de niveles en una zona de tu nivel (🗺️ tecla M).';
  else if (m.pw > 0) consejo = 'Tenías ' + m.pw + ' pociones: úsalas (' + (TACTIL ? 'el primer consumible de la barra' : 'tecla Q') + ') cuando tu vida baje de la mitad.';
  else if (!m.pw) consejo = 'Te quedaste sin pociones: compra en el Mercader o fabrícalas con hierbas en la Artesana Lila.';
  if (m.inst) consejo = 'En las mazmorras, sal de las zonas marcadas en el suelo e interrumpe los hechizos con barra naranja. Revives en la entrada.';
  if (consejo) h += `<p style="margin-top:8px;color:var(--txt)">💡 ${esc(consejo)}</p>`;
  $('muerte-info').innerHTML = h;
  // Hasta Nv 10 se revive en la entrada de la misma zona (y sin perder XP).
  const novato = yo && yo.nivel < 10 && MAPAS[mapaId] && MAPAS[mapaId].zona && mapaId !== 'coliseo';
  $('b-revivir').textContent = m.inst ? '↺ Revivir en la entrada' : novato ? '↺ Revivir aquí (entrada de la zona)' : '↺ Revivir en el pueblo';
  if (novato && !m.inst) h += '<p style="margin-top:6px;font-size:12px;color:var(--ok)">Hasta nivel 10 morir no te quita experiencia.</p>';
  $('muerte-info').innerHTML = h;
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
$('b-reconectar').onclick = () => { fatal = false; dormido = false; reintentos = 0; $('m-error').classList.remove('on'); conectar(); };
// Desconectado por inactividad: cualquier toque o tecla vuelve a conectar
// (antes habia que encontrar y pulsar RECONECTAR).
let dormido = false;
const despertar = () => { if (dormido && $('m-error').classList.contains('on')) $('b-reconectar').onclick(); };
addEventListener('pointerdown', despertar, true);
addEventListener('keydown', despertar, true);

// ── INICIO ──
async function inicio() {
  ajustarVista();
  pintarPoderes();
  const esperar = () => new Promise(r => { const chk = () => (cargadas >= porCargar ? r() : setTimeout(chk, 100)); chk(); });
  await Promise.race([esperar(), new Promise(r => setTimeout(r, 12000))]);
  precalentarTintes();
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
      if (n.length < 3) { $('in-nombre').focus(); $('in-nombre').style.borderColor = 'var(--err)'; return; }
      localStorage.setItem('dq_mmo_nombre', n);
    }
    $('carga').style.display = 'flex'; $('carga-s').textContent = 'Entrando al mundo…';
    if (sonido) sonarMusica();
    conectar();
  };
  $('b-jugar').onclick = entrar; $('b-jugar2').onclick = entrar;
  $('in-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); e.stopPropagation(); });
}

setInterval(() => mandar({ t: 'ping', ts: Date.now() }), 20000);

// Pestaña oculta mas de 3 minutos (otra app, pantalla apagada): se suelta la
// conexion para no tener el servidor encendido por nadie, y al volver se
// reconecta sola.
let pausado = false, timerOculta = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // En una mazmorra se espera mas (8 min): en Telegram se cambia de chat a
    // menudo y perder la mazmorra por eso echaba a la gente.
    timerOculta = setTimeout(() => { if (ws && ws.readyState === 1) { pausado = true; ws.close(4100, 'oculta'); } }, instancia ? 480000 : 180000);
  } else {
    clearTimeout(timerOculta);
    if (pausado) { pausado = false; reintentos = 0; aviso('Reconectando…'); conectar(); }
  }
});

// Paso fijo de 60 Hz: la fisica iba por fotograma, asi que en una pantalla
// de 120/144 Hz el duende corria y saltaba al doble, y en una pestaña lenta
// iba a camara lenta. Ahora se acumula el tiempo real y se simula en pasos
// de 1/60 s; se dibuja solo cuando hubo al menos un paso.
const PASO = 1000 / 60;
let ultimoT = performance.now(), acum = 0;
// Modo ligero: si en dos tandas seguidas de 5 s la media no llega a ~36 FPS
// se dibujan menos particulas y sin mezcla aditiva; se apaga tras dos tandas
// a mas de ~50 FPS. Por tandas (y no al instante) para que un cambio de mapa
// o el recolector de basura no lo enciendan para siempre.
let ligero = false, tandaT = 0, tandaN = 0, tandaMs = 0, tandasMal = 0, tandasBien = 0;
function aditivo() { return ligero ? 'source-over' : 'lighter'; }
function medirLigero(dt) {
  if (document.hidden || dt <= 0 || dt > 250) return;
  tandaN++; tandaMs += dt;
  if ((tandaT += dt) < 5000) return;
  const media = tandaMs / tandaN;
  tandaT = tandaN = tandaMs = 0;
  if (media > 28) { tandasMal++; tandasBien = 0; } else if (media < 20) { tandasBien++; tandasMal = 0; } else { tandasMal = tandasBien = 0; }
  if (!ligero && tandasMal >= 2) ligero = true;
  else if (ligero && tandasBien >= 2) ligero = false;
}
let pausaGolpe = 0;
function bucle(t) {
  requestAnimationFrame(bucle);
  if (t < pausaGolpe) { ultimoT = t; return; }
  medirLigero(t - ultimoT);
  acum += Math.min(200, Math.max(0, t - ultimoT));
  ultimoT = t;
  let pasos = 0;
  while (acum >= PASO) { frame++; fisica(); acum -= PASO; pasos++; }
  if (!pasos) return;
  dibujar();
  if (frame % 3 === 0) dibujarMinimapa();
  pintarVida();
  pintarCooldowns();
  if (autoAtk && frame % 4 === 0) ataqueAuto();
}
// Ataque automatico (como el auto-ataque de WoW): mientras tengas un
// enemigo elegido al alcance, el duende le pega solo. En el movil,
// mantener pulsado el boton de ataque minutos seguidos cansa la mano.
let autoAtk = false;
try { autoAtk = localStorage.getItem('dq_auto') === '1'; } catch (e) {}
function ataqueAuto() {
  if (!yo || P.muerto || castYo || chatAbierto() || document.querySelector('.modal.on')) return;
  const o = monObjetivo();
  if (!o || o.muereT) return;
  const cl = CLASES[yo.clase];
  const rango = cl && cl.basico === 'vara' ? VARA.rango : 70;
  if (distMon(o) > rango) return;
  if (!(cl && cl.basico === 'vara')) P.f = o.x >= P.x ? 1 : -1;
  atacar();
}
function pintarAuto() { const b = $('t-auto'); b.classList.toggle('on', autoAtk); b.textContent = autoAtk ? '🔁 AUTO' : '🔁'; }
$('t-auto').onclick = () => {
  autoAtk = !autoAtk;
  try { localStorage.setItem('dq_auto', autoAtk ? '1' : '0'); } catch (e) {}
  pintarAuto();
  aviso(autoAtk ? '🔁 Ataque automático: elige un enemigo y tu duende le pegará solo.' : 'Ataque automático apagado.');
};
pintarAuto();
inicio();
requestAnimationFrame(bucle);
// Solo en el servidor local de pruebas (tools/mmo_local.mjs): acceso al
// estado para los scripts que prueban el juego.
if (location.hostname === 'localhost') window.__dq = { mandar, P, mons, otros, get yo() { return yo; }, get objetivo() { return objetivo; }, set objetivo(v) { objetivo = v; }, usarHab, usarHabDef, atacar };
