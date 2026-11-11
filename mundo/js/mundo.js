// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — cliente del mundo abierto (Three.js)
//
// Estilo Ragnarok Online / Octopath: el mundo es 3D (relieve, bosques, agua,
// el pueblo) y los personajes y monstruos son los sprites de siempre, de pie
// y girados hacia la camara. Asi se usa todo el arte del juego y va fluido en
// el movil.
//
// Es el MISMO personaje del MMO 2D (mismo servidor, mismo 'hola' con
// modo: '3d'). El servidor manda; aqui se predice el movimiento propio y se
// interpolan los demas. El terreno, las zonas y los campamentos salen de
// mmo/js/mundo3d.js, igual que en el servidor.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { esNocheDuendes, TEMPORADAS, temporadaDe, MAPAS, MONSTRUOS, HOJAS, SKINS, CLASES, PODERES, ARMAS, VARA, MISIONES, DIARIA, statsMonstruo, xpParaSubir,
  habsDe, habPorId, costoHab, RECURSOS, GCD_MS, MONTURAS, velMontura, MATERIALES, RECETAS, VASO, precioVaso, APARIENCIA, LOOK_BASE, limpiarLook, ALAS, alaDe,
  LOGIN_PREMIOS, multLogin, diaRacha, semanaRacha, multSemanaRacha, premioRacha, PASE, premioPase, paseMes, HERM_COSTO, HERM_NIVEL, HERM_MAX, HERM_COLORES, GESTA_UMBRALES, GESTA_NOMBRES, GESTA_MIN, CHICHA, RAREZAS, nombreItem, talento, LOGROS, premioAmigo, TINTES, GESTOS, MASCOTAS } from '/mmo/js/data.js?v=369';
import { iniciarVentanas, talentoPreElegido, TAL_PRE_NIVEL } from './ventanas.js?v=369';
import { TALENTOS, TALENTO_NIVEL } from '/mmo/js/data.js?v=369';   // meta del talento elegido a Nv 7 en la barra de XP
import { EXPEDICION, VERSION, horaFelizTiempos, premioDiaria, BESTIARIO_HITOS, progresoLogro, ESPEC_NIVEL, costoCambioClase, TAREAS_DIA, zonaDeNivel, DEBIL_EMO, statsJugador } from '/mmo/js/data.js?v=369';   // fila 🧭 de las misiones; VERSION: la del cliente frente a la del servidor
import { diaFiesta, diasFiesta, TEMP_DIAS, premioDiaFiesta, esNochebuena } from '/mmo/js/data.js?v=369';   // tarea del dia de la fiesta en la caja de misiones
import { waChicha, mesChicha } from '/mmo/js/data.js?v=369';   // WhatsApp de la chicha con el código de reclamo
import { NOVEDADES } from '/mmo/js/data.js?v=369';   // linea «Nuevo» de la tira diaria y aviso tras actualizar
import { iniciarRegalo } from '/mmo/js/regalo.js?v=369';
import { iniciarAvisoTg, escribirTgPendiente } from '/mmo/js/avisotg.js?v=369';
import { crearDuende, crearMonstruo, crearNpc, crearMontura, precalentar } from './modelos.js?v=369';
import { crearMusica } from './musica.js?v=369';
import { crearSonidos } from './sonidos.js?v=369';
import { construirCueva } from './cueva.js?v=369';
import { TAPA, transparentar } from './tapa.js?v=369';
import { construirAbismo } from './abismo.js?v=369';
import { crearParticulas } from './particulas.js?v=369';
import { PERF } from './perf.js?v=369';
import { cargarKenney, piezasCasa } from './kenney.js?v=369';
import { CORRIENTES, sueloRef, ABISMO, ABISMO_X0, FACCIONES, enAbismo, islaEn, portalBase, VACIO, RANGOS, rangoDe, santuario, PUERTA_NUCLEO, MAQUINA, MAQUINA_DIST, maquinasAbismo, TEMP_ABISMO, FACC_BONO, RECLUTA } from '/mmo/js/abismo3d.js?v=369';
const MAQUINAS = maquinasAbismo();
import { CUEVA, CUEVA_X0, caminable, enCueva } from '/mmo/js/cueva3d.js?v=369';
import { MUNDO, ZONAS3D, NPCS3D, NPC_DIST, CASAS, SPAWN3D, ARENA3D, horaMundo, esNoche, climaEn, nodos3d, RECOGER_DIST, alturaEn, zonaEn, mezclaEn, pendienteEn, campamentos, cofres3d, COFRE3D_DIST, revivirEn3d, corrientesMundo } from '/mmo/js/mundo3d.js?v=369';
import { encargosDe, hitoDe, ZONAS_ENC } from '/mmo/js/encargos3d.js?v=369';
import { SECUNDARIAS, INGREDIENTES, ingredientesDe, secundariaDe, contarPistas } from '/mmo/js/secundarias.js?v=369';
import { PISTAS } from '/mmo/js/caso.js?v=369';
import { htmlCaso } from './caso.js?v=369';
import { crearObjetivos, migrarClavesViejas, granMeta } from './objetivos.js?v=369';
import { LORE_ZONAS, LORE_NPC, LORE_NPC_CTX, LORE_HITOS, LORE_NIVEL60, LORE_TEMPORADA, AVENTUREROS, FRASES_AVENTUREROS, LORE_MISIONES, LORE_MONSTRUOS, LORE_TEMPORADA_LEYENDA, CAPITULOS, capituloDe, CAPITULOS_INTRIGA, ganchoCapitulo, finCapitulo, ganchoActual, epilogoDe, RECETA_DE_CASA } from './lore.js?v=369';
import { VECINOS, VOCES, comentarioNpc } from './vecinos.js?v=369';

const A = '/assets/';
const PX_M = 34;                       // pixeles del 2D por metro
const $ = id => document.getElementById(id);
const MOVIL = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
if (MOVIL) document.body.classList.add('movil');
// Compacto: HUD de movil tambien en ventanas estrechas sin pantalla tactil
// (Telegram de escritorio abre una ventana de ~560 px: con el HUD de PC no
// quedaba sitio para jugar). Los controles tactiles siguen siendo solo de MOVIL.
let COMPACTO = false;
function ajustarCompacto() { const c = MOVIL || innerWidth < 760; if (c === COMPACTO) return; COMPACTO = c; document.body.classList.toggle('compacto', c && !MOVIL); }
ajustarCompacto(); addEventListener('resize', ajustarCompacto); addEventListener('orientationchange', () => setTimeout(ajustarCompacto, 250));
// Texto de ayuda segun el control: tecla en PC, boton tactil en movil.
const K = (pc, tactil) => MOVIL ? tactil : pc;
// Solo dentro de Telegram de verdad (app: TelegramWebviewProxy; web y escritorio: iframe).
// Fuera, el SDK llena initData con un #tgWebAppData ajeno pegado en un enlace.
// El SDK se baja solo dentro de Telegram (index.html, window.__tgListo): se espera aqui, antes de leerlo.
if (window.__tgListo) await window.__tgListo;
const enTg =!!(window.TelegramWebviewProxy || window.parent !== window || (window.external && 'notify' in window.external));
const TG = enTg && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
// Modo anuncio (js/origen.js): quien llega de Meta no ve avisos de mTON ni nada cripto (solo se ocultan).
const modoAnuncio = () => { try { return !!(window.dqAnuncio && window.dqAnuncio()); } catch (e) { return false; } };
const imgLore = () => (modoAnuncio() ? '/assets/skins/skin_bruja.png' : '/assets/lore/chicha-duende-playa.jpg');
// Embudo de la carga (/js/origen.js → /mmo/ev): un aviso por paso y sesion. Sin origen.js no hace nada.
const paso = e => { try { if (window.dqPaso) window.dqPaso(e, 'origins'); } catch (er) {} };
let golpe1Ok = false;   // embudo: el primer 'atk3' mandado (paso 'golpe1') va una sola vez
paso('carga_ini');
// En Telegram los enlaces a CLASSIC llevan la sesion (el #tgWebAppData): sin ella entraba como invitado.
// Invitacion compartida desde ORIGINS (/mundo/?ref=): se manda en el hola como en CLASSIC (antes no contaba).
// Se guarda 14 dias (dq_ref, el mismo que CLASSIC): si entra como invitado y se registra despues, igual cuenta.
const ref3 = (() => {
  let r = (/[?&]ref=([a-z0-9]{6})/.exec(location.search) || [])[1];
  // Mini App abierta con t.me/duendequest_bot?startapp=r_xxxxxx: el mismo codigo de amigo ('premium' sigue aparte).
  if (!r) r = (/^r_([a-z0-9]{6})$/.exec((TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '') || [])[1];
  // Enlaces de «Invitar a mi grupo» ya compartidos (#g=codigo o startapp=g_codigo): tambien cuentan como amigo
  // (oro de bienvenida, Kit Compañero, premio de Nv 10). El servidor ignora el propio codigo, a quien ya tiene invitador y al duende de mas de 7 dias.
  if (!r) r = (/(?:^#|&)g=([a-z0-9]{6})(?:&|$)/.exec(location.hash) || /^g_([a-z0-9]{6})$/.exec((TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '') || [])[1];
  try {
    if (r) localStorage.setItem('dq_ref', JSON.stringify({ r, t: Date.now() }));
    else { const x = JSON.parse(localStorage.getItem('dq_ref') || 'null'); if (x && /^[a-z0-9]{6}$/.test(x.r) && Date.now() - x.t < 14 * 86400000) r = x.r; }
  } catch (e) {}
  // Si no, la invitacion del primer toque (origen.js, 30 dias).
  return r || (window.dqOrigen && window.dqOrigen().ref) || undefined;
})();
// 📲 «Invitar a mi grupo»: startapp=g_codigo en Telegram o #g=codigo fuera (el ?ref= de ese enlace solo cuenta como amigo/origen). Solo esta
// sesion (sin guardar como grupo; como amigo si, en ref3/dq_ref). Tambien el ?ref= recien abierto (enlace del bot
// start=m3d_): ese va callado (q) si no se puede, y una vez cada 10 minutos por codigo (dq_grefq).
// Se manda una vez al llegar el primer 'yo' con clase (unirmeRef); quien lo toca ve la invitacion y decide.
let refGrupo3 = (/^g_([a-z0-9]{6})$/.exec((TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param) || '') || [])[1] || '';
if (!refGrupo3 && !TG) refGrupo3 = (/(?:^#|&)g=([a-z0-9]{6})(?:&|$)/.exec(location.hash) || [])[1] || '';
const refGrupoQ = !refGrupo3;
if (!refGrupo3) refGrupo3 = (/[?&]ref=([a-z0-9]{6})/.exec(location.search) || [])[1] || '';
// El ?ref= se queda en la URL (boton del bot, recargas): callado y no se repite en 10 minutos con el mismo
// codigo en este equipo (dq_grefq con hora; el valor viejo sin JSON se tolera y se reemplaza).
if (refGrupoQ && refGrupo3) {
  try {
    let x = null;
    try { x = JSON.parse(localStorage.getItem('dq_grefq') || 'null'); } catch (e) { x = null; }
    if (x && typeof x === 'object' && x.c === refGrupo3 && Date.now() - x.t < 10 * 60000) refGrupo3 = '';
    else localStorage.setItem('dq_grefq', JSON.stringify({ c: refGrupo3, t: Date.now() }));
  } catch (e) {}
} else if (refGrupo3 && !TG) {
  // Enlace web /mundo/?ref=X#g=X: el #g= se limpia pero el ?ref= queda; asi al recargar no se repite (ni gasta un uso).
  try { localStorage.setItem('dq_grefq', JSON.stringify({ c: refGrupo3, t: Date.now() })); } catch (e) {}
}
// Navegador interno de Facebook/Instagram/Messenger (los anuncios abren ahi): el
// duende de invitado vive en su almacenamiento, que se borra a menudo. Se ofrece
// pasarlo a Chrome/Safari con el codigo de rescate en el hash (#r=), nunca en la query.
const esIAB = !TG && /FBAN|FBAV|FB_IAB|Instagram|Messenger|musical_ly|BytedanceWebview|TikTok|trill|WhatsApp/i.test(navigator.userAgent);
// Brillo de noche (Ajustes): 'claro' levanta la noche y quita la viñeta; por defecto en Facebook/Instagram,
// donde la pantalla suele ir con brillo bajo y el anuncio llega de noche.
let BRILLO = 'normal'; try { const b = localStorage.getItem('dq3_brillo'); BRILLO = b === 'claro' || b === 'normal' ? b : esIAB ? 'claro' : 'normal'; } catch (e) {}
const appIAB = /musical_ly|Bytedance|TikTok|trill/i.test(navigator.userAgent) ? 'TikTok' : /WhatsApp/i.test(navigator.userAgent) ? 'WhatsApp' : 'Facebook';
// #r=<codigo> (viene de ese aviso): se lee y se borra de la URL al instante, sin registrarlo.
let rescateHash = null;
if (!TG) {
  const mr = /(?:^#|&)r=([A-Za-z0-9-]{32,40})(?:&|$)/.exec(location.hash);
  if (mr) {
    const c = mr[1].replace(/[^a-f0-9]/gi, '').toLowerCase();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (/^[a-f0-9]{32}$/.test(c)) rescateHash = c;
  }
}
// Enlace directo a la tienda: /mundo/#premium o la Mini App con start_param=premium (v325).
let tiendaAlEntrar = /(^#|&)premium(&|$)/.test(location.hash) || !!(TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param === 'premium');
// Fue a CLASSIC a crear su cuenta (dq_volver) y vuelve por el enlace del correo: se borra la marca y,
// solo si venía de la tienda (#premium), se abre en el paquete que quería (&f=). '/mundo/' a secas no abre la tienda.
let vol = '';
try { vol = localStorage.getItem('dq_volver') || sessionStorage.getItem('dq_volver') || ''; if (vol) { localStorage.removeItem('dq_volver'); sessionStorage.removeItem('dq_volver'); } } catch (e) {}
if (/premium/.test(vol)) tiendaAlEntrar = true;
let focoAlEntrar = ((vol.match(/[#&]f=([\w-]+)/) || location.hash.match(/[#&]f=([\w-]+)/) || [])[1]) || '';
// El ⌂ (inicio web) va al menu de la Mini App, como en CLASSIC.
if (TG && location.hash) document.querySelectorAll('a[href="/mmo/"],a[href="/inicio/"]').forEach(a => { a.href = (a.getAttribute('href') === '/inicio/' ? '/telegram/index.html' : '/mmo/') + location.hash; });
// Y los que se pintan despues (guia de cuenta, ventana de mazmorras...): al tocarlos se les pone el hash.
const hashTg = TG ? location.hash : '';
if (hashTg) document.addEventListener('click', ev => { const a = ev.target && ev.target.closest && ev.target.closest('a[href^="/mmo/"]'); if (a && !a.getAttribute('href').includes('#')) a.setAttribute('href', a.getAttribute('href') + hashTg); }, true);
const TGV = v => !!(TG && TG.isVersionAtLeast && TG.isVersionAtLeast(v));
try { localStorage.setItem('dq_visto3d', '1'); } catch (e) {}
if (TG) {
  try { TG.ready(); TG.expand(); TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
  try { if (TGV('6.1')) { TG.setHeaderColor('#0a0418'); TG.setBackgroundColor('#0a0418'); } if (TGV('7.10') && TG.setBottomBarColor) TG.setBottomBarColor('#0a0418'); } catch (e) {}
  // Pantalla completa en el movil (Bot API 8.0): el HUD se aparta de los
  // botones de Telegram (zona segura del sistema + la de Telegram).
  const zonas = () => {
    const a = TG.safeAreaInset || {}, b = TG.contentSafeAreaInset || {}, fs = !!TG.isFullscreen, st = document.documentElement.style;
    document.body.classList.toggle('tgfs', fs);
    st.setProperty('--tg-top', fs ? ((a.top || 0) + (b.top || 0)) + 'px' : '0px');
    st.setProperty('--tg-bot', fs ? ((a.bottom || 0) + (b.bottom || 0)) + 'px' : '0px');
  };
  try {
    if (TGV('8.0') && /android|ios/.test(TG.platform || '') && TG.requestFullscreen) {
      for (const ev of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'fullscreenFailed']) TG.onEvent(ev, zonas);
      zonas(); setTimeout(zonas, 300);
      TG.requestFullscreen();
    }
  } catch (e) {}
}
// Vibracion de Telegram: golpes (suaves), criticos, heridas, nivel, muerte.
let vibT = 0;
function vib(t) {
  // Ajustes -> Vibracion: apagada, o suave (solo muerte, logros y errores).
  let modoVib = 'normal'; try { modoVib = localStorage.getItem('dq3_vib') || 'normal'; } catch (e) {}
  if (modoVib === 'off') return;
  if (modoVib === 'suave' && t !== 'heavy' && t !== 'success' && t !== 'error') return;
  const ahora = performance.now();
  // Fuera de Telegram (Android en el navegador) con la vibracion del sistema; iPhone no la tiene.
  // 'heavy' (confirmar la muerte) pasa aunque acabe de vibrar el golpe.
  if (t === 'heavy') vibT = 0;
  if (!TG || !TG.HapticFeedback || !TGV('6.1')) { if (MOVIL && navigator.vibrate && ahora - vibT >= 70) { vibT = ahora; try { navigator.vibrate(t === 'light' ? 8 : t === 'medium' ? 18 : t === 'heavy' ? 30 : t === 'error' ? [20, 40, 20] : 15); } catch (e) {} } return; }
  if (ahora - vibT < 70) return;
  vibT = ahora;
  try { if (t === 'success' || t === 'error' || t === 'warning') TG.HapticFeedback.notificationOccurred(t); else TG.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {}
}
// Tic suave de Telegram al cambiar de blanco.
function vibSel() { try { let vm = 'normal'; try { vm = localStorage.getItem('dq3_vib') || 'normal'; } catch (e) {} if (vm !== 'normal') return; if (TG && TG.HapticFeedback && TG.HapticFeedback.selectionChanged && TGV('6.1')) TG.HapticFeedback.selectionChanged(); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));   // a - b en (-PI, PI]
// Cabeza que mira (v351): fija m.mirar / m.mirarK del modelo con entrada y salida de ~200 ms.
// o guarda el ultimo t (ms) para sacar el dt sin depender de los FPS; obj = a quien mirar (o null).
function mirarSuave(f, o, t, ry, obj) {
  const m = f && f.modelo;
  if (!m) return;
  const dt = Math.min(0.1, Math.max(0, (t - (o._tMir || t)) / 1000)); o._tMir = t;
  const k = 1 - Math.exp(-dt / 0.2);
  if (obj) { const meta = angDif(Math.atan2(obj.x - o.x, obj.z - o.z), ry); m.mirar = (m.mirarK || 0) < 0.02 ? meta : (m.mirar || 0) + angDif(meta, m.mirar || 0) * k; }
  m.mirarK = (m.mirarK || 0) + ((obj ? 1 : 0) - (m.mirarK || 0)) * k;
  if (m.mirarK < 0.005) m.mirarK = 0;
}

// ── COLORES DE CADA ZONA ──
const SUELO = {
  pueblo: '#6fbf5a', noche: '#2c5a3b', amanecer: '#b5603f', selva: '#3fa34d', tormenta: '#6e6a85', desierto: '#e3c27a',
  castillo: '#7d7a72', cumbres: '#8f8799', cavernas: '#3e6670', abismo: '#d8c08a', acantilados: '#9a6fc4',
};
const CIELO = {
  pueblo: '#9ad0ff', noche: '#1d2756', amanecer: '#ffb48f', selva: '#a6e3b8', tormenta: '#6b6f9a', desierto: '#ffd9a0',
  castillo: '#7a6f8c', cumbres: '#c9b6e8', cavernas: '#2f4d5d', abismo: '#4a8fbf', acantilados: '#d9a8ff', cueva: '#07040c', eter: '#4b3a9a',
};
const LUZ = { noche: 0.8, cavernas: 0.8, tormenta: 0.85, cueva: 0.42 };
const C = h => new THREE.Color(h);
// Colores del suelo ya convertidos (colorSuelo corre en cada vertice del terreno y pixel del minimapa).
const SUELO_C = Object.fromEntries(Object.entries(SUELO).map(([k, v]) => [k, C(v)]));
const C_PLAZA = C('#cdb98a'), C_ROCA = C('#6b6460'), C_NIEVE = C('#f2f4ff'), C_ARENA = C('#e0cf96'), C_CAMINO = C('#a8865a');

// ── ESCENA ──
const lienzo = $('lienzo');
// ── CALIDAD GRAFICA ──
// baja: menos resolucion y vista corta; media: lo de siempre; alta: sombras
// del sol y mas resolucion. Se guarda en el navegador (cambiarla recarga).
const CALIDADES = {
  baja:  { px: 0.75, lejos: 130, aa: false, sombras: false },
  media: { px: 1,    lejos: 170, aa: false, sombras: false },
  alta:  { px: 1.5,  lejos: 230, aa: true,  sombras: true, post: true },
};
// Android flojo (poca memoria o pocos nucleos): empieza en baja. En iOS
// hardwareConcurrency no es fiable, asi que solo se mira Android.
// El navegador interno de Facebook/Instagram tambien (va justo de memoria).
const POBRE = esIAB || (/Android/i.test(navigator.userAgent) && ((navigator.deviceMemory || 4) <= 3 || (navigator.hardwareConcurrency || 8) <= 4));
let CAL = POBRE ? 'baja' : MOVIL ? 'media' : 'alta';
// La GPU dice mas que la memoria: Mali y Adreno antiguos, PowerVR baratos,
// Intel HD y los dibujantes por software (SwiftShader, llvmpipe) empiezan en
// baja; Intel UHD en PC, en media. Solo cambia el punto de partida: la
// eleccion manual de Ajustes (dq3_calidad) manda siempre.
function gpuNombre() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const n = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    const p = gl.getExtension('WEBGL_lose_context'); if (p) p.loseContext();
    return n;
  } catch (e) { return ''; }
}
const GPU = gpuNombre();
if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render|Mali-(4\d\d|T\d+|G(31|51|52|57|71|72))\b|Adreno \(TM\) ([1-5]\d\d|60\d|61[0-3])\b|Adreno ([1-5]\d\d|60\d|61[0-3])\b|PowerVR (Rogue )?(GE8|G6|SGX)|Intel\(R\) HD Graphics|Intel HD Graphics/i.test(GPU)) CAL = 'baja';
else if (CAL === 'alta' && /Intel\(R\) UHD|Intel UHD/i.test(GPU)) CAL = 'media';
try { const g = localStorage.getItem('dq3_calidad'); if (CALIDADES[g]) CAL = g; } catch (e) {}
const Q = CALIDADES[CAL];
// El vidrio (backdrop-filter) vuelve a difuminar el 3D en cada cuadro: en movil
// o fuera de alta, paneles opacos (index.html, body.sin-vidrio).
document.body.classList.toggle('sin-vidrio', MOVIL || CAL !== 'alta');
// Tope de cuadros: 60 (un monitor de 120/144 Hz no dibuja el doble) y 30 en baja.
const CUADRO_MS = CAL === 'baja' ? 33 : 16.4;
// Sin WebGL (o el driver lo niega) el modulo no puede seguir: se ofrece CLASSIC (red de seguridad de index.html).
let render;
try { render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: Q.aa, powerPreference: MOVIL ? 'low-power' : 'high-performance' }); }
catch (e) { paso('fallo_webgl'); if (window.__dqFallo) window.__dqFallo('Tu dispositivo no pudo abrir los gráficos 3D (WebGL). Puedes jugar con el mismo duende en CLASSIC (2D).'); throw e; }
// Contexto grafico perdido (GPU reiniciada, muchas pestañas): three lo recupera solo; si en 8 s no vuelve, se ofrece salir.
let glPerdidoT = 0;
lienzo.addEventListener('webglcontextlost', e => { e.preventDefault(); clearTimeout(glPerdidoT); glPerdidoT = setTimeout(() => { if (window.__dqFallo) window.__dqFallo('Se perdieron los gráficos 3D de tu dispositivo. Reintenta o juega con el mismo duende en CLASSIC (2D).'); }, 8000); });
lienzo.addEventListener('webglcontextrestored', () => { clearTimeout(glPerdidoT); const v = document.getElementById('dq-red'); if (v) v.remove(); });
render.setPixelRatio(Math.min(devicePixelRatio || 1, Q.px));
if (Q.sombras) { render.shadowMap.enabled = true; render.shadowMap.type = THREE.PCFSoftShadowMap; }
render.outputColorSpace = THREE.SRGBColorSpace;
// Si un shader propio (agua, estrellas, bruma) no compila en algun movil raro,
// se vuelve al material de siempre en vez de dejar un hueco en la escena.
// Cada shader lleva una marca (comentario GLSL «dq:nombre») y solo cae el que fallo.
const respaldosShader = [];
try {
  if (render.debug) render.debug.onShaderError = (gl, prog, vs, fs) => {
    let src = '';
    try { console.error('[3D] shader no compilo', gl.getProgramInfoLog(prog) || '', gl.getShaderInfoLog(vs) || '', gl.getShaderInfoLog(fs) || ''); src = (gl.getShaderSource(vs) || '') + (gl.getShaderSource(fs) || ''); } catch (e) {}
    for (let i = respaldosShader.length - 1; i >= 0; i--) {
      const [marca, f] = respaldosShader[i];
      if (src.includes('dq:' + marca)) { respaldosShader.splice(i, 1); try { f(); } catch (e) {} }
    }
  };
} catch (e) {}
const escena = new THREE.Scene();
escena.background = C(CIELO.pueblo);
escena.fog = new THREE.Fog(CIELO.pueblo, 40, Q.lejos);
const camara = new THREE.PerspectiveCamera(60, 1, 0.3, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a78, 1.0);
const sol = new THREE.DirectionalLight(0xfff2dd, 1.0);
sol.position.set(120, 200, 80);
escena.add(hemi, sol, sol.target);
if (Q.sombras) {
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  const sc = sol.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 400;
  sol.shadow.bias = -0.0015; sol.shadow.normalBias = 0.04;
}
const solDir = new THREE.Vector3(120, 200, 80);
// ── POST-PROCESO (solo en alta): resplandor de lo brillante (cristales,
// magia, portales), viñeta suave y algo mas de color. Se carga aparte: en
// baja y media no se descarga nada.
let composer = null;
// Sin post-proceso, una viñeta CSS (#vineta en index.html) da el mismo marco por casi nada.
document.body.classList.add('sin-post');
const GRADO = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uSat; varying vec2 vUv;
    void main() { vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat); vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVig * smoothstep(0.25, 0.75, dot(d, d) * 2.0); gl_FragColor = c; }`,
};
if (Q.post && !PRUEBA_SIN_POST()) {
  Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass', 'ShaderPass'].map(n => import('three/addons/postprocessing/' + n + '.js'))).then(([E, R, B, O, S]) => {
    const w = innerWidth, h = innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const c = new E.EffectComposer(render, rt);
    c.addPass(new R.RenderPass(escena, camara));
    c.addPass(new B.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.45, 0.92));
    c.addPass(new S.ShaderPass(GRADO));
    c.addPass(new O.OutputPass());
    c.setPixelRatio(render.getPixelRatio()); c.setSize(w, h);
    composer = c; document.body.classList.remove('sin-post');
  }).catch(e => console.warn('[3D] sin post-proceso', e));
}
function PRUEBA_SIN_POST() { return /[?&]sinPost=1/.test(location.search); }
// Resolucion dinamica: si el movil no llega a ~40 fps baja la resolucion
// (hasta un 60%) y la sube cuando sobra.
let pxAct = Math.min(devicePixelRatio || 1, Q.px), dtProm = 16, resT = 0;
// Distancia de vision dinamica: con la resolucion ya al minimo y aun lento,
// se acorta la niebla (cullFlora y las figuras usan fog.far) y se recupera sola.
let lejosDin = Q.lejos, avisoCal = false, lentas = 0, buenas = 0;
// Baja por escalones, de lo mas caro a lo mas visible: post-proceso, sombras,
// resolucion y vista. Los umbrales escalan con el tope (en baja, 30 fps es lo normal).
// El post y las sombras solo caen tras dos revisiones lentas seguidas (no por
// el tiron de compilar shaders al entrar) y no vuelven hasta recargar.
function resolucionDinamica(ms) {
  if (document.hidden || ms > 200) return;
  dtProm += (ms - dtProm) * 0.05; resT += ms;
  if (resT < 2000) return;
  resT = 0;
  const max = Math.min(devicePixelRatio || 1, Q.px), min = max * 0.6;
  const lento = 25 * CUADRO_MS / 16.4, muyLento = Math.max(38, lento + 10);
  lentas = dtProm > lento ? lentas + 1 : 0; buenas = dtProm < CUADRO_MS + 1.2 ? buenas + 1 : 0;
  if (lentas >= 2 && composer) { try { composer.dispose(); } catch (e) {} composer = null; document.body.classList.add('sin-post'); lentas = 0; console.info('[3D] post-proceso desactivado por rendimiento'); return; }
  if (lentas >= 2 && sol.castShadow) { sol.castShadow = false; render.shadowMap.enabled = false; lentas = 0; console.info('[3D] sombras desactivadas por rendimiento'); return; }
  // > 38 ms (< 26 fps): un movil topado a 30 Hz (ahorro de bateria) da ~33 ms aunque vaya sobrado; a ese no se le acorta la vista.
  if (dtProm > muyLento && pxAct <= min + 0.01 && lejosDin > 95) {
    lejosDin -= 20;
    try { musica.ligera(true); } catch (e) {}   // tambien la musica pasa a modo ligero
    if (!avisoCal && CAL !== 'baja') { avisoCal = true; aviso('El juego va justo: acortamos la vista. En ' + K('Ajustes (?)', 'Más (⋯) → ?') + ' puedes poner la calidad Baja.'); }
    return;
  }
  if (buenas >= 2 && lejosDin < Q.lejos) lejosDin = Math.min(Q.lejos, lejosDin + 10);
  // Sube solo tras 3 revisiones (6 s) pegado al tope, para no oscilar.
  const n = dtProm > lento ? Math.max(min, pxAct - 0.1) : buenas >= 3 ? Math.min(max, pxAct + 0.05) : pxAct;
  if (Math.abs(n - pxAct) < 0.01) return;
  pxAct = n; render.setPixelRatio(n); if (composer) composer.setPixelRatio(n); ajustar();
}
// ── DIA, NOCHE Y CLIMA ──
const BLANCO_H = C('#ffffff'), NOCHE_CIELO = C('#0b1030'), OCASO = C('#ff8a5c'), GRIS = C('#6c7380'), ARENA = C('#c9a46a');
// Estrellas que titilan: cada una con su fase y un tinte (blancas, azuladas,
// alguna dorada). El parpadeo se inyecta en el shader de PointsMaterial; si
// el codigo de three no trae lo esperado, quedan fijas como antes.
const estrellasT = { value: 0 };
const estrellas = (() => {
  const n = 700, pos = new Float32Array(n * 3), fase = new Float32Array(n), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.95 + 0.05);
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 420; pos[i * 3 + 1] = Math.sin(e) * 420; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 420;
    fase[i] = Math.random();
    const r = Math.random(), tn = r < 0.12 ? [1, 0.86, 0.62] : r < 0.4 ? [0.78, 0.86, 1] : [1, 1, 1];
    col.set(tn, i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('fase', new THREE.BufferAttribute(fase, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, vertexColors: true, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  mat.onBeforeCompile = sh => {
    try {
      const v = sh.vertexShader, f = sh.fragmentShader;
      if (!v.includes('gl_PointSize = size;') || !v.includes('#include <common>') || !f.includes('#include <color_fragment>') || !f.includes('#include <common>')) return;
      sh.uniforms.uT = estrellasT;
      sh.vertexShader = v.replace('#include <common>', '#include <common>\n// dq:estrellas\nattribute float fase; uniform float uT; varying float vTw;')
        .replace('gl_PointSize = size;', 'vTw = 0.6 + 0.4 * sin(uT * (1.2 + fase * 2.4) + fase * 40.0); gl_PointSize = size * (0.8 + 0.45 * vTw);');
      sh.fragmentShader = f.replace('#include <common>', '#include <common>\nvarying float vTw;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vTw;');
    } catch (e) {}
  };
  const p = new THREE.Points(g, mat);
  escena.add(p);
  respaldosShader.push(['estrellas', () => { const m2 = new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: p.material.opacity, fog: false, depthWrite: false }); const viejo = p.material; p.material = m2; setTimeout(() => { try { viejo.dispose(); } catch (e) {} }, 0); }]);
  return p;
})();
// ── CIELO: cupula con degradado (horizonte → cenit), halo y disco del sol, y
// nubes low-poly que derivan alto. La niebla usa el color del horizonte, asi
// el mundo se funde con el cielo.
const cielo = (() => {
  // uOca/uOcaK: banda calida del amanecer y el ocaso (mas fuerte del lado del
  // sol); uBruma: horizonte lechoso (Cumbres, niebla); la luna sale enfrente
  // del sol con su halo frio. Un pelo de ruido evita las franjas del degradado.
  const u = { uHor: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uSol: { value: new THREE.Vector3(0, 1, 0) }, uSolC: { value: new THREE.Color('#fff1c9') }, uNoche: { value: 0 },
    uOca: { value: new THREE.Color('#ff9a5a') }, uOcaK: { value: 0 }, uBruma: { value: 0.12 }, uLunaC: { value: new THREE.Color('#dfe8ff') } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // En baja: sin ruido de dithering ni los pow altos de sol y luna (smoothstep es mas barato en GPUs modestas).
    fragmentShader: (CAL === 'baja' ? '#define BAJA\n' : '') + `uniform vec3 uHor; uniform vec3 uTop; uniform vec3 uSol; uniform vec3 uSolC; uniform float uNoche;
      uniform vec3 uOca; uniform float uOcaK; uniform float uBruma; uniform vec3 uLunaC; varying vec3 vD;
      // dq:cielo
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        vec3 sd = normalize(uSol);
        vec3 c = mix(uHor, uTop, pow(smoothstep(-0.02, 0.7, h), 0.75));
        float lado = 0.5 + 0.5 * dot(normalize(d.xz + vec2(0.0001)), normalize(sd.xz + vec2(0.0001)));
        float banda = exp(-max(h, 0.0) * 5.0) * (0.3 + 0.7 * lado * lado);
        c = mix(c, uOca, clamp(banda * uOcaK, 0.0, 0.85));
        c = mix(c, uHor * 1.06, clamp(uBruma * exp(-abs(h) * 8.0), 0.0, 0.9));
        c = mix(c, uHor * 0.8, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, sd), 0.0);
        float l = max(dot(d, normalize(vec3(-sd.x, sd.y, -sd.z))), 0.0);
        #ifndef BAJA
        c += uSolC * (pow(s, 8.0) * 0.2 + pow(s, 60.0) * 0.3 + pow(s, 900.0) * 1.6) * (1.0 - uNoche);
        c += uLunaC * (pow(l, 14.0) * 0.1 + pow(l, 120.0) * 0.18 + smoothstep(0.9991, 0.9995, l) * 0.85) * uNoche;
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        #else
        c += uSolC * (pow(s, 8.0) * 0.2 + pow(s, 60.0) * 0.3 + smoothstep(0.9975, 0.9995, s) * 1.6) * (1.0 - uNoche);
        c += uLunaC * (pow(l, 14.0) * 0.1 + smoothstep(0.975, 1.0, l) * 0.18 + smoothstep(0.9991, 0.9995, l) * 0.85) * uNoche;
        #endif
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.renderOrder = -10; m.frustumCulled = false; escena.add(m);
  // Si la cupula no compila queda el color de fondo de la escena (como antes de tener cupula).
  respaldosShader.push(['cielo', () => { m.visible = false; }]);
  return { m, u };
})();
const nubes3 = (() => {
  const N = MOVIL ? 26 : 44, geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92, fog: false });
  const im = new THREE.InstancedMesh(geo, mat, N * 4);
  const l = [];
  for (let i = 0; i < N; i++) l.push({ x: (Math.random() - 0.5) * 1100, z: (Math.random() - 0.5) * 1100, y: 75 + Math.random() * 30, s: 9 + Math.random() * 10, v: 0.6 + Math.random() * 0.8 });
  im.frustumCulled = false; im.renderOrder = -5; escena.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const PUFF = [[0, 0, 0, 1], [0.9, -0.15, 0.2, 0.75], [-0.85, -0.2, -0.1, 0.7], [0.2, 0.25, -0.6, 0.6]];
  return {
    im, mat,
    mover(dt, cx, cz) {
      let k = 0;
      for (const n of l) {
        n.x += n.v * dt * 2;
        let dx = n.x - cx, dz = n.z - cz;
        if (dx > 550) n.x -= 1100; else if (dx < -550) n.x += 1100;
        if (dz > 550) n.z -= 1100; else if (dz < -550) n.z += 1100;
        for (const [ox, oy, oz, f] of PUFF) { p.set(n.x + ox * n.s, n.y + oy * n.s, n.z + oz * n.s); sc.set(n.s * f * 1.4, n.s * f * 0.7, n.s * f); m4.compose(p, q, sc); im.setMatrixAt(k++, m4); }
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
})();
// ── BRUMA DE ALTURA (Cumbres): un manto de niebla en los valles que se ve
// desde arriba, con las cimas asomando. Un disco con textura que deriva y se
// desvanece hacia el borde (alfa por vertice); en calidad baja no se crea.
const BRUMA_Y = 9;
const bruma = (() => {
  if (CAL === 'baja') return null;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 128, y = Math.random() * 128, r = 14 + Math.random() * 24;
      for (let ox = -128; ox <= 128; ox += 128) for (let oy = -128; oy <= 128; oy += 128) {   // repetible sin costuras
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.CircleGeometry(240, 28).rotateX(-Math.PI / 2), np = geo.attributes.position.count, ca = new Float32Array(np * 4);
    for (let i = 0; i < np; i++) { ca.set([1, 1, 1, i === 0 ? 1 : 0], i * 4); }   // centro opaco, borde transparente
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 4));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, color: 0xeef2fa, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 2; m.frustumCulled = false; escena.add(m);
    return { m, tex, k: 0 };
  } catch (e) { return null; }
})();
const FX = crearParticulas(escena, MOVIL ? 900 : 1800, MOVIL, POBRE || CAL === 'baja', CAL);
// Gotas (o copos): segmentos en una caja que sigue a la camara.
const lluvia = (() => {
  const n = MOVIL ? 700 : 1600, pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x, y + 0.7, z], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaabbdd, transparent: true, opacity: 0.5, depthWrite: false }));
  m.frustumCulled = false; m.visible = false;
  escena.add(m);
  return { m, n, pos };
})();
let fovGolpe = 0;
let nocheBonoAnt = null;   // ultimo estado del +10% XP nocturno (null: aun sin evaluar)
let climaAct = 'despejado', nocheK = 0, relampagoT = -1e9, sigRelampago = 0, hemiBase = 1, nieblaObj = [40, Q.lejos];
// Tinte de la niebla por zona (el horizonte de la cupula usa el mismo color),
// fuerza de la banda del ocaso y bruma del horizonte; ambiente() fija el objetivo
// y el bucle lo alcanza poco a poco.
const NIEBLA_TINTE = Object.fromEntries(Object.entries({
  pueblo: '#cfe6ff', noche: '#3b4f86', amanecer: '#ffc9a6', selva: '#b8e8c4', tormenta: '#8a8fb4', desierto: '#f4d9a6',
  castillo: '#9d93ad', cumbres: '#eef1fa', cavernas: '#4f8592', abismo: '#9fd0ee', acantilados: '#e6c8ff',
}).map(([k, v]) => [k, C(v)]));
const SOL_DIA = C('#fff2dd'), SOL_NOCHE = C('#9fb4ff'), SOL_PUEBLO = C('#ffcf8f'), CENIT_DIA = C('#2a4fb8'), CENIT_NOCHE = C('#02040e');
const nieblaTinteObj = C(CIELO.pueblo), nieblaAct = C(CIELO.pueblo);
let ocasoK = 0, ocasoAct = 0, brumaObj = 0.12;
const musica = crearMusica({ ligera: POBRE || CAL === 'baja' });
const NOMBRE_CLIMA = { despejado: '', lluvia: '🌧 Lluvia', tormenta: '⛈ Tormenta', nieve: '❄ Nieve', niebla: '🌫 Niebla', arena: '🌪 Tormenta de arena' };
// Para probar: ?clima=lluvia|tormenta|nieve|niebla|arena y ?hora=0..24
const PRUEBA = new URLSearchParams(location.search);
function ambiente(z) {
  const ahora = Date.now(), h = PRUEBA.has('hora') ? +PRUEBA.get('hora') : horaMundo(ahora);
  // Amanece a las 5, anochece a las 19:30; la curva en S suaviza la entrada y salida del dia.
  const sdia = clamp(Math.sin((h - 5) / 14.5 * Math.PI) * 1.3 + 0.06, 0, 1), dia = sdia * sdia * (3 - 2 * sdia);
  nocheK = 1 - dia;
  const ocaso = Math.min(1, Math.max(0, 1 - Math.abs(h - 18.8) / 1.3) + Math.max(0, 1 - Math.abs(h - 5.8) / 1.1));
  const luz = LUZ[z] || 1;
  const cl = z === 'cueva' || z === 'eter' ? 'despejado' : PRUEBA.get('clima') || climaEn(z, ahora);
  const nub = cl === 'tormenta' ? 0.55 : cl === 'lluvia' || cl === 'nieve' ? 0.75 : cl === 'niebla' || cl === 'arena' ? 0.85 : 1;
  hemiBase = 0.9 * luz * (BRILLO === 'claro' ? 0.5 + 0.5 * dia : 0.32 + 0.68 * dia) * (0.6 + 0.4 * nub);   // Ajustes > Brillo de noche
  sol.intensity = 2.0 * luz * (0.12 + 0.88 * dia) * nub;
  // Del sol blanco-dorado a la luz azul de luna sin salto; en el pueblo, una tarde mas calida.
  sol.color.copy(SOL_DIA).lerp(SOL_NOCHE, clamp((0.45 - dia) / 0.35, 0, 1)).lerp(OCASO, ocaso * 0.6);
  if (z === 'pueblo') sol.color.lerp(SOL_PUEBLO, 0.32 * dia * (1 - ocaso));
  const a = (h - 6) / 24 * Math.PI * 2;
  solDir.set(Math.cos(a) * 200, Math.max(60, Math.abs(Math.sin(a)) * 220), 80);
  const fijo = z === 'cueva' || z === 'eter';   // ni dia ni noche: siempre su cielo
  cieloObj.set(CIELO[z] || CIELO.pueblo).lerp(OCASO, fijo ? 0 : ocaso * 0.35).lerp(NOCHE_CIELO, fijo ? 0 : nocheK * 0.85);
  if (nub < 1) cieloObj.lerp(cl === 'arena' ? ARENA : GRIS, (1 - nub) * 1.2);
  nieblaTinteObj.copy(cieloObj);
  if (!fijo && NIEBLA_TINTE[z]) nieblaTinteObj.lerp(NIEBLA_TINTE[z], (z === 'cumbres' ? 0.4 : 0.22) * (1 - nocheK * 0.6));
  ocasoK = fijo ? 0 : ocaso * (0.35 + 0.65 * nub) * (1 - nocheK * 0.5);
  brumaObj = z === 'cueva' ? 0 : z === 'cumbres' ? 0.55 : cl === 'niebla' || cl === 'arena' ? 0.45 : cl === 'nieve' ? 0.3 : 0.12;
  estrellas.material.opacity = z === 'eter' ? 0.7 : z === 'cueva' ? 0 : nocheK * (cl === 'despejado' ? 0.9 : 0.2);
  if (z === 'cueva') { hemiBase = 0.6; sol.intensity = 0.3; }   // 0.6: un pelo mas sin las luces de las antorchas (ahora horneadas)
  hemi.color.copy(cieloObj).lerp(BLANCO_H, 0.55);
  hemi.groundColor.set(SUELO[z] || '#3a3040').multiplyScalar(0.5);
  const lejos = lejosDin;
  nieblaObj = z === 'eter' ? [90, 420] : z === 'cueva' ? [6, 55] : cl === 'niebla' ? [6, 75] : cl === 'arena' ? [5, 60] : cl === 'lluvia' || cl === 'tormenta' ? [25, lejos * 0.6] : cl === 'nieve' ? [20, lejos * 0.55] : [40, lejos];
  farolMat.color.set(nocheK > 0.45 ? '#ffd27a' : '#7a6a48');
  luzSueloMat.opacity = luzHaloMat.opacity = Math.min(1, Math.max(0, (nocheK - 0.3) * 2)) * 0.55;
  luzSueloMat.visible = luzHaloMat.visible = luzSueloMat.opacity > 0;   // de dia no se dibujan (moviles)
  const vin = document.getElementById('vineta'); if (vin) vin.style.display = BRILLO === 'claro' ? 'none' : '';
  if (cl !== climaAct) {
    climaAct = cl;
    lluvia.m.visible = cl === 'lluvia' || cl === 'tormenta' || cl === 'nieve';
    lluvia.m.material.color.set(cl === 'nieve' ? 0xffffff : 0xaabbdd);
    lluvia.m.material.opacity = cl === 'nieve' ? 0.9 : 0.5;
    if (NOMBRE_CLIMA[cl]) aviso(NOMBRE_CLIMA[cl] + ' en ' + (MAPAS[z] ? MAPAS[z].nombre : 'la zona'), undefined, antesMis2() ? 3 : 2);
  }
  // La cueva y el Eter con su propia musica (antes sonaba la alegre del pueblo).
  musica.zona(enCueva(P.x) ? 'cavernas' : enAbismo(P.x) ? 'cumbres' : z); musica.noche(nocheK > 0.5); musica.clima(cl);
  musica.evento((temporadaDe() || {}).id || '');   // T'anta Wawa / Cosecha: fiesta andina en el pueblo
  temaPueblo(z);
  // +10% de XP de noche: la misma regla que el servidor (esNoche), no la luz del cielo.
  const bonoNoche = esNoche(ahora), chico = document.body.classList.contains('movil') || document.body.classList.contains('compacto');
  if (nocheBonoAnt !== null && bonoNoche !== nocheBonoAnt && !fijo && !avisoTapado()) aviso(bonoNoche ? '🌙 Cae la noche: +10% de experiencia hasta el amanecer' : '☀ Amanece: termina el +10% de experiencia nocturna', 'ok');
  nocheBonoAnt = bonoNoche;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const hora3 = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), clima3 = NOMBRE_CLIMA[cl] ? ' · ' + NOMBRE_CLIMA[cl] : '';
  // Minimapa de 72-110 px en una sola linea con "…": primero la hora y los jugadores; el icono y el clima al final (los corta el "…")
  const larga3 = (bonoNoche ? '🌙 ' : nocheK > 0.5 ? '🌙 ' : '☀ ') + hora3 + (bonoNoche ? ' +10% XP' : '') + clima3
      + (enLinea3 > 1 ? ' · 👥 ' + enLinea3 + ' en línea' : '') + (hoy3 > enLinea3 ? ' · ' + hoy3 + ' hoy' : '');
  // Celular: solo hora y zona bajo el minimapa; clima, jugadores y bono nocturno se leen en el mapa grande (#mapa-info).
  const txt = chico ? hora3 + ' · ' + $('mini-z').textContent : larga3;
  if ($('mini-r')._h !== txt) { $('mini-r').textContent = txt; $('mini-r')._h = txt; }
  const info3 = $('mapa-info'), infoTxt = $('mini-z').textContent + ' · ' + larga3;
  if (info3 && info3._h !== infoTxt) { info3.textContent = infoTxt; info3._h = infoTxt; }
}
// Cae la lluvia (o la nieve): cada segmento baja y vuelve arriba al salir.
function moverLluvia(dt, t) {
  if (!lluvia.m.visible) return;
  const nieve = climaAct === 'nieve';
  const v = nieve ? 2.4 : climaAct === 'tormenta' ? 34 : 26, largo = nieve ? 0.09 : 0.7, p = lluvia.pos;
  for (let i = 0; i < lluvia.n; i++) {
    const k = i * 6;
    let y = p[k + 1] - v * dt;
    if (y < 0) y += 30;
    const dx = nieve ? Math.sin(t / 900 + i) * 0.3 * dt : -0.25 * v * dt * 0.05;
    p[k] += dx; p[k + 3] = p[k] + (nieve ? 0.04 : -0.12);
    p[k + 1] = y; p[k + 4] = y + largo;
  }
  lluvia.m.geometry.attributes.position.needsUpdate = true;
  lluvia.m.position.set(camara.position.x, camara.position.y - 12, camara.position.z);
  // Relampagos en la tormenta.
  if (climaAct === 'tormenta' && t > sigRelampago) { relampagoT = t; sigRelampago = t + 7000 + Math.random() * 12000; musica.trueno(); }
}
let fovBase = 60;
function ajustar() {
  const w = innerWidth, h = innerHeight;
  render.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camara.aspect = w / h;
  // En vertical (Telegram) 60 grados verticales dejaban unos 30 de ancho: se abre hasta 76.
  fovBase = camara.aspect < 1 ? Math.min(76, 60 + (1 - camara.aspect) * 30) : 60;
  camara.fov = fovBase; camara.updateProjectionMatrix();
}
addEventListener('resize', ajustar);
// Al girar el celular el tamaño llega tarde (sobre todo en Telegram/iOS): se reajusta varias veces.
const ajustarTarde = () => { ajustar(); setTimeout(ajustar, 250); setTimeout(ajustar, 700); };
try { if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', ajustarTarde); else addEventListener('orientationchange', ajustarTarde); } catch (e) {}
try { if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(ajustar, 120)); } catch (e) {}
ajustar();

const progreso = (k, txt) => { window.__dqProg = k + (txt || ''); $('carga-i').style.transition = ''; $('carga-i').style.transform = `scaleX(${k})`; if (k >= 0.7) $('carga-i').classList.add('latido'); if (txt) $('carga-s').textContent = Math.round(k * 100) + '% · ' + txt; };

// ── TERRENO ──
const LADO = MUNDO.lado, SEG = MOVIL ? 180 : 240;
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
// Caminos de tierra desde el pueblo a cada zona (guian al jugador).
const CAMINOS = Object.values(ZONAS3D).map(c => [0, 0, c.x * 0.72, c.z * 0.72]);
function enCamino(x, z) { let m = Infinity; for (const [a, b, c, d] of CAMINOS) m = Math.min(m, distSeg(x, z, a, b, c, d)); return m; }
function colorSuelo(x, z, h, out) {
  out.setRGB(0, 0, 0);
  for (const [id, k] of mezclaEn(x, z)) { const t = SUELO_C[id]; out.r += t.r * k; out.g += t.g * k; out.b += t.b * k; }
  // El pueblo: cesped claro que se funde con las zonas de alrededor y la plaza.
  const dp = Math.hypot(x, z);
  if (dp < MUNDO.pueblo.radio + 40) out.lerp(SUELO_C.pueblo, 1 - clamp((dp - MUNDO.pueblo.radio) / 40, 0, 1));
  if (dp < 26) out.lerp(C_PLAZA, 0.7);
  const p = pendienteEn(x, z);
  if (p > 0.6) out.lerp(C_ROCA, clamp((p - 0.6) * 1.5, 0, 0.85));       // roca en las laderas
  if (h > 26) out.lerp(C_NIEVE, clamp((h - 26) / 10, 0, 0.9));           // nieve en las cumbres
  if (h < 1.2 && h > -3) out.lerp(C_ARENA, clamp((1.2 - h) / 1.5, 0, 0.8)); // arena junto al agua
  const cam = enCamino(x, z);
  if (cam < 4 && Math.hypot(x, z) > 20) out.lerp(C_CAMINO, (1 - cam / 4) * 0.75);
  const v = 0.92 + 0.16 * (((x * 73856093 ^ z * 19349663) >>> 0) % 100) / 100;
  out.multiplyScalar(v);
  return out;
}
function crearTerreno() {
  const g = new THREE.PlaneGeometry(LADO, LADO, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = alturaEn(x, z);
    pos.setY(i, h);
    colorSuelo(x, z, h, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = Q.sombras;
  escena.add(m);
  const base = new THREE.MeshLambertMaterial({ color: 0x3a8fd0, transparent: true, opacity: 0.72 });
  let matAgua = base;
  try { matAgua = materialAgua(pos); } catch (e) { console.warn('[3D] agua simple', e); matAgua = base; }
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(LADO * 1.4, LADO * 1.4).rotateX(-Math.PI / 2), matAgua);
  agua.position.y = MUNDO.agua;
  escena.add(agua);
  // El material viejo se libera fuera del render en curso (onShaderError salta en plena compilacion).
  if (matAgua !== base) respaldosShader.push(['agua', () => { const viejo = agua.material; agua.material = base; if (viejo !== base) setTimeout(() => { try { viejo.dispose(); } catch (e) {} }, 0); }]);
  return agua;
}
// ── AGUA VIVA: color con profundidad (turquesa en la orilla, azul hondo mar
// adentro), cielo reflejado al mirar rasante, destellos del sol que se mueven
// con olas pequeñas y espuma suave en la orilla. La profundidad sale de las
// alturas del terreno ya calculadas (una textura, sin calculos extra). Sin
// luces de three: el brillo lo da uLuz (dia/noche/relampago) desde el bucle.
const AGUA_U = { uT: { value: 0 }, uCielo: { value: C(CIELO.pueblo) }, uSol: { value: new THREE.Vector3(0.5, 0.8, 0.3) }, uSolC: { value: C('#fff2dd') },
  uLuz: { value: 1 }, uProf: { value: null }, uEsc: { value: new THREE.Vector2(1, 0) } };
function materialAgua(pos) {
  const N = SEG + 1, datos = new Uint8Array(N * N * 4);
  for (let i = 0; i < pos.count; i++) {
    datos[i * 4] = Math.round(clamp((MUNDO.agua - pos.getY(i) + 2) / 12, 0, 1) * 255);   // 0 = 2 m sobre el agua · 1 = 10 m de hondo
    datos[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(datos, N, N);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  AGUA_U.uProf.value = tex;
  AGUA_U.uEsc.value.set(SEG / (LADO * N), (0.5 * SEG + 0.5) / N);
  const baja = CAL === 'baja';
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), AGUA_U),
    transparent: true, fog: true,
    vertexShader: `// dq:agua
      varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `// dq:agua
      uniform float uT; uniform vec3 uCielo; uniform vec3 uSol; uniform vec3 uSolC; uniform float uLuz; uniform sampler2D uProf; uniform vec2 uEsc;
      varying vec3 vW;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec2 q = vW.xz; float t = uT;
        vec2 uvP = q * uEsc.x + uEsc.y;
        float p = texture2D(uProf, uvP).r * 12.0 - 2.0;
        // Fuera del terreno (tras las montanas del borde) es mar abierto, no orilla con espuma.
        float fuera = max(max(-uvP.x, uvP.x - 1.0), max(-uvP.y, uvP.y - 1.0));
        p = mix(p, 10.0, smoothstep(0.0, 0.01, fuera));
        float hondo = clamp(p / 7.0, 0.0, 1.0);
        vec3 n = normalize(vec3(
          sin(q.x * 0.35 + t * 1.1) * 0.05 + sin(q.x * 0.9 + q.y * 0.6 + t * 1.7) * 0.035${baja ? '' : ' + sin((q.x - q.y) * 2.1 + t * 2.6) * 0.02'},
          1.0,
          cos(q.y * 0.4 + t * 0.9) * 0.05 + cos(q.y * 1.1 - q.x * 0.5 + t * 1.5) * 0.035${baja ? '' : ' + cos((q.x + q.y) * 2.3 - t * 2.2) * 0.02'}));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(vec3(0.07, 0.42, 0.44), vec3(0.012, 0.09, 0.24), hondo);
        col = mix(col, uCielo, 0.18 + 0.5 * fres) * uLuz;
        float spec = pow(max(dot(n, normalize(normalize(uSol) + v)), 0.0), 160.0);
        col += uSolC * spec * 1.3;
        float orilla = 1.0 - smoothstep(0.0, 1.1, p);
        float ola = 0.5 + 0.5 * sin(p * 9.0 - t * 1.8 + sin(q.x * 0.25 + q.y * 0.2) * 2.0);
        float espuma = orilla * (0.35 + 0.65 * ola);
        col = mix(col, vec3(0.85, 0.92, 0.95) * uLuz, espuma * 0.65);
        gl_FragColor = vec4(col, clamp(mix(0.5, 0.86, hondo) + fres * 0.1 + espuma * 0.35, 0.0, 0.95));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// ── VEGETACION Y DECORADO (instanciado: miles de arboles en pocas llamadas) ──
// En el Abismo no hay agua debajo (se cae al vacio).
const aguaEn = x => enAbismo(x) ? -1e4 : MUNDO.agua;
function hashR(x, z, s) { let h = (x | 0) * 374761393 + (z | 0) * 668265263 + s * 2654435761; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const FLORA = {
  noche:       [['pino', 0.42, '#2f6e4a'], ['hongo', 0.04, '#3f7a4a'], ['tocon', 0.03, '#3f6a3a']],
  amanecer:    [['redondo', 0.22, '#d9733a'], ['roca', 0.06], ['flor', 0.08, '#5aa845'], ['hierba', 0.08, '#8fbf4a']],
  selva:       [['redondo', 0.45, '#2f9e44'], ['arbusto', 0.25, '#3fbf55'], ['flor', 0.05, '#3fbf55'], ['hierba', 0.08, '#3fbf55']],
  tormenta:    [['muerto', 0.12, '#59546e'], ['roca', 0.16], ['tocon', 0.04, '#5d6b52']],
  desierto:    [['cactus', 0.07, '#4f9a3f'], ['roca', 0.07]],
  castillo:    [['pilar', 0.05, '#8b8578'], ['pino', 0.06, '#3e5a46'], ['roca', 0.08], ['tocon', 0.03, '#4f6a46']],
  cumbres:     [['nieve', 0.22, '#3d7458'], ['roca', 0.18]],
  cavernas:    [['cristal', 0.12, '#5eead4'], ['roca', 0.2]],
  abismo:      [['palma', 0.09, '#3fae6a'], ['roca', 0.05], ['hierba', 0.05, '#7ccf6a']],
  acantilados: [['magico', 0.24, '#e879f9'], ['cristal', 0.07, '#c084fc']],
  pueblo:      [['redondo', 0.05, '#4cae4c']],
};
// Con los kits CC0 de Kenney (mundo/js/kenney.js): variantes por tipo y su
// tamaño en metros (alto, o ancho si es 'a'). Las hojas se tiñen con el color
// de la zona. Sin el kit (no cargo) se usan las figuras de siempre.
let KIT = null;
const VAR_K = {
  pino: [['n_tree_pineTallA', 9], ['n_tree_pineTallC', 8.5], ['n_tree_pineTallA_detailed', 9]],
  nieve: [['n_tree_pineTallD', 7.5], ['n_tree_pineRoundC', 7]],
  redondo: [['n_tree_default', 7], ['n_tree_oak', 7.5], ['n_tree_tall', 7.5], ['n_tree_fat', 6.5]],
  arbusto: [['n_plant_bushLarge', 2.6, 'a'], ['n_plant_bushDetailed', 2.4, 'a']],
  muerto: [['n_tree_simple_dark', 6.5], ['n_tree_simple', 6]],
  cactus: [['n_cactus_tall', 3.6], ['n_cactus_short', 2.4]],
  pilar: [['n_statue_column', 5.5], ['n_statue_columnDamaged', 4.2], ['n_statue_obelisk', 5]],
  palma: [['n_tree_palmTall', 8], ['n_tree_palmBend', 7]],
  roca: [['n_rock_largeA', 2.8, 'a'], ['n_rock_largeB', 2.6, 'a'], ['n_stone_largeA', 2.6, 'a'], ['n_stone_tallA', 2.8], ['n_rock_largeC', 2.6, 'a']],
  flor: [['n_flower_purpleA', 0.8], ['n_flower_redA', 0.8], ['n_flower_yellowA', 0.8], ['n_flower_yellowB', 0.7]],
  hongo: [['n_mushroom_redGroup', 0.9], ['n_mushroom_tanGroup', 0.8], ['n_mushroom_red', 0.8]],
  hierba: [['n_grass_large', 0.8], ['n_grass_leafsLarge', 0.9]],
  tocon: [['n_stump_old', 1.1], ['n_log', 2.2, 'a'], ['n_stump_roundDetailed', 0.9]],
};
// La hierba de encima de las rocas, segun la zona.
const TINTE_ROCA = { desierto: '#b9a46a', cumbres: '#e3ecf3', tormenta: '#5d6b52', cavernas: '#4f6b6b', acantilados: '#9a6fb0', amanecer: '#8fbf4a' };
// Arboles altos en una rejilla de 8 m: la camara se acerca si uno se mete
// entre ella y el duende (como en WoW).
const REJ = 8, rejilla = new Map();
const TAPAN = { pino: 1.7, nieve: 1.8, redondo: 2.1, muerto: 0.5, cactus: 0.6, pilar: 1.1, palma: 0.5, magico: 1.9 };
// ── FISICA: colisionadores ──
// Circulos (troncos, rocas, cactus, pilares, PNJ, pilares del portal) en la
// rejilla de 8 m, y cajas giradas para las casas. El duende es un circulo de
// 0,45 m que se empuja fuera de cada uno: asi resbala por ellos.
const SOLIDO = { pino: 0.42, nieve: 0.42, redondo: 0.5, muerto: 0.4, cactus: 0.55, pilar: 0.85, palma: 0.38, magico: 0.48, roca: 1.05, cristal: 0.55 };
const solidos = new Map();
function ponerSolido(x, z, r) { const k = Math.floor(x / REJ) + ',' + Math.floor(z / REJ); let c = solidos.get(k); if (!c) solidos.set(k, c = []); c.push({ x, z, r }); }
const RADIO_DUENDE = 0.45;
let solidosExtra = [];
function empujarFuera(x, z) {
  for (const o of solidosExtra) {
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + RADIO_DUENDE;
    if (d < m && d > 1e-4) { x = o.x + dx / d * m; z = o.z + dz / d * m; }
  }
  // Circulos cercanos (3x3 celdas).
  const gx = Math.floor(x / REJ), gz = Math.floor(z / REJ);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const l = solidos.get((gx + i) + ',' + (gz + j));
    if (!l) continue;
    for (const o of l) {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + RADIO_DUENDE;
      if (d < m && d > 1e-4) { x = o.x + dx / d * m; z = o.z + dz / d * m; }
    }
  }
  // Casas: caja girada (se pasa a coordenadas de la casa y se saca por el lado mas cercano).
  for (const c of CASAS) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;
    const co = Math.cos(c.r), si = Math.sin(c.r);
    let lx = dx * co - dz * si, lz = dx * si + dz * co;
    const hx = c.w / 2 + RADIO_DUENDE, hz = c.d / 2 + RADIO_DUENDE;
    if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
      if (hx - Math.abs(lx) < hz - Math.abs(lz)) lx = Math.sign(lx || 1) * hx; else lz = Math.sign(lz || 1) * hz;
      x = c.x + lx * co + lz * si; z = c.z - lx * si + lz * co;
    }
  }
  return [x, z];
}
// En la cueva la camara no sale de salas y pasillos.
function choqueCueva(tx, tz, cx, cz) {
  const L = Math.hypot(cx - tx, cz - tz) || 1;
  let ult = 0;
  // La camara puede meterse en la fila de rocas (por dentro se ve a traves).
  for (let d = 0.4; d <= L; d += 0.4) { const k = d / L; if (!caminable(tx + (cx - tx) * k, tz + (cz - tz) * k, -0.7)) break; ult = k; }
  return clamp(ult, 0.4, 1);
}
// Colinas entre el duende y la camara: 8 muestras del rayo; corta en la primera bajo el suelo.
function choqueTerreno(tx, ty, tz, cx, cy, cz) {
  for (let i = 2; i <= 8; i++) {
    const k = i / 8, x = tx + (cx - tx) * k, z = tz + (cz - tz) * k;
    if (ty + (cy - ty) * k < Math.max(alturaEn(x, z), aguaEn(x)) + 0.6) return (i - 1) / 8;
  }
  return 1;
}
function crearFlora() {
  const tipos = {};
  const campos = campamentos(MAPAS, MONSTRUOS);
  const paso = CAL === 'baja' ? 11 : MOVIL ? 9 : 7;   // en baja, ~33% menos arboles y rocas
  for (let x = -600; x <= 600; x += paso) for (let z = -600; z <= 600; z += paso) {
    const jx = x + (hashR(x, z, 1) - 0.5) * paso, jz = z + (hashR(x, z, 2) - 0.5) * paso;
    const zona = zonaEn(jx, jz);
    const h = alturaEn(jx, jz);
    if (h < 0.5 || pendienteEn(jx, jz) > 0.95) continue;
    if (enCamino(jx, jz) < 5) continue;
    const dp = Math.hypot(jx, jz);
    if (dp < 34 || CASAS.some(c => Math.hypot(c.x - jx, c.z - jz) < 9)) continue;
    let r = hashR(x, z, 3);
    for (const [tipo, dens, color] of FLORA[zona] || []) {
      if (r < dens) {
        if (campos.some(c => Math.hypot(c.x - jx, c.z - jz) < 7) || VECINOS.some(v => Math.hypot(v.x - jx, v.z - jz) < 5)) break;
        const s = 0.75 + hashR(x, z, 4) * 0.6;
        (tipos[tipo] = tipos[tipo] || []).push({ x: jx, z: jz, y: h, s, rot: hashR(x, z, 5) * 6.28, color, zona });
        if (TAPAN[tipo]) { const kc = Math.floor(jx / REJ) + ',' + Math.floor(jz / REJ); let c = rejilla.get(kc); if (!c) rejilla.set(kc, c = []); c.push({ x: jx, z: jz, r: TAPAN[tipo] * s }); }
        if (SOLIDO[tipo]) ponerSolido(jx, jz, SOLIDO[tipo] * s);
        break;
      }
      r -= dens;
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const piezas = {
    pino: [[new THREE.CylinderGeometry(0.25, 0.35, 2, 5), '#5a3c25', 1], [new THREE.ConeGeometry(2, 6, 7), null, 4.6]],
    nieve: [[new THREE.CylinderGeometry(0.25, 0.35, 2, 5), '#5a3c25', 1], [new THREE.ConeGeometry(2.1, 6, 7), null, 4.6], [new THREE.ConeGeometry(1.1, 2.2, 7), '#f4f6ff', 6.9]],
    redondo: [[new THREE.CylinderGeometry(0.3, 0.45, 3, 6), '#6b4527', 1.5], [new THREE.IcosahedronGeometry(2.4, 0), null, 4.4]],
    arbusto: [[new THREE.IcosahedronGeometry(1.2, 0), null, 0.8]],
    muerto: [[new THREE.CylinderGeometry(0.15, 0.4, 5, 5), null, 2.5], [new THREE.CylinderGeometry(0.08, 0.15, 2.4, 4).rotateZ(0.9), null, 3.6]],
    cactus: [[new THREE.CylinderGeometry(0.45, 0.5, 3.2, 7), null, 1.6], [new THREE.CylinderGeometry(0.25, 0.25, 1.4, 6).rotateZ(1.57), null, 2]],
    pilar: [[new THREE.BoxGeometry(1.4, 5, 1.4), null, 2.5], [new THREE.BoxGeometry(2, 0.5, 2), null, 5.2]],
    cristal: [[new THREE.OctahedronGeometry(1.1, 0).scale(0.7, 1.8, 0.7), null, 1.6]],
    palma: [[new THREE.CylinderGeometry(0.2, 0.3, 6, 6), '#8a6a3f', 3], [new THREE.ConeGeometry(2.6, 1, 6), null, 6.1]],
    magico: [[new THREE.CylinderGeometry(0.25, 0.4, 3, 6), '#5b3a7a', 1.5], [new THREE.SphereGeometry(2.2, 7, 5), null, 4.4]],
    roca: [[new THREE.DodecahedronGeometry(1.3, 0), '#77716b', 0.5]],
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const matsF = {}, celdas = new Map();
  for (const tipo in tipos) {
    const todos = tipos[tipo];
    const porCelda = new Map();
    for (const t of todos) { const ck = Math.floor(t.x / TROZO) + '|' + Math.floor(t.z / TROZO); let l = porCelda.get(ck); if (!l) porCelda.set(ck, l = []); l.push(t); }
    let destino = 'mallas';
    if (KIT && VAR_K[tipo]) {
      const vars = VAR_K[tipo];
      for (const [ck, l] of porCelda) {
        const grupos = vars.map(() => []);
        for (const t of l) grupos[Math.min(vars.length - 1, Math.floor(hashR(t.x | 0, t.z | 0, 11) * vars.length))].push(t);
        grupos.forEach((g, vi) => {
          if (!g.length) return;
          const [n, tam, modo] = vars[vi], cj = KIT.caja(n);
          const base = tam / (modo === 'a' ? Math.max(cj.max[0] - cj.min[0], cj.max[2] - cj.min[2]) : cj.max[1] - cj.min[1]);
          const im = new THREE.InstancedMesh(KIT.geo(n), KIT.materialInst || KIT.material, g.length);
          g.forEach((t, i) => {
            e.set(0, t.rot, 0); q.setFromEuler(e);
            const k = t.s * base; sc.set(k, k, k); v.set(t.x, t.y - 0.12, t.z);
            m4.compose(v, q, sc); im.setMatrixAt(i, m4);
            col.set(t.color || TINTE_ROCA[t.zona] || '#5f8f4a').offsetHSL(0, 0, (hashR(t.x | 0, t.z | 0, 9) - 0.5) * 0.12);
            im.setColorAt(i, col);
          });
          im.computeBoundingSphere();
          if (Q.sombras && tam >= 5) im.castShadow = true;
          let c = celdas.get(ck);
          if (!c) { const [kx, kz] = ck.split('|').map(Number); celdas.set(ck, c = { x: (kx + 0.5) * TROZO, z: (kz + 0.5) * TROZO, mallas: [], cerca: [], lejos: [] }); }
          c.cerca.push(im);
          im.matrixAutoUpdate = false; im.matrixWorldAutoUpdate = false;   /* flora fija: three no recalcula su matriz en cada cuadro */
          escena.add(im);
        });
      }
      // Lejos (bajo la niebla) bastan las figuras sencillas: mucho menos vertices.
      if (!piezas[tipo]) continue;   // decorado pequeño: solo de cerca
      destino = 'lejos';
    }
    if (!piezas[tipo]) continue;   // sin kit: ese decorado pequeño no se dibuja
    for (const [ck, l] of porCelda) piezas[tipo].forEach(([geo, colorFijo, alto], pi) => {
      // Lejos sin el discard de la tapa (early-Z completo): con LOD_D >= 100 esas
      // celdas nunca quedan entre la camara (max 26 m) y el duende. En baja si.
      const sinTapa = destino === 'lejos' && CAL !== 'baja';
      const mk = tipo + pi + (sinTapa ? 'L' : '');
      const mt = matsF[mk] || (matsF[mk] = sinTapa ? mat.clone() : transparentar(mat.clone()));
      if (tipo === 'cristal' || tipo === 'magico') mt.emissive = C(l[0].color).multiplyScalar(0.35);
      const im = new THREE.InstancedMesh(geo, mt, l.length);
      l.forEach((t, i) => {
        e.set(0, t.rot, 0); q.setFromEuler(e);
        sc.set(t.s, t.s, t.s);
        v.set(t.x, t.y + alto * t.s, t.z);
        m4.compose(v, q, sc);
        im.setMatrixAt(i, m4);
        col.set(colorFijo || t.color || '#888888').offsetHSL(0, 0, (hashR(t.x | 0, t.z | 0, 9) - 0.5) * 0.12);
        im.setColorAt(i, col);
      });
      im.computeBoundingSphere();
      let c = celdas.get(ck);
      if (!c) { const [kx, kz] = ck.split('|').map(Number); celdas.set(ck, c = { x: (kx + 0.5) * TROZO, z: (kz + 0.5) * TROZO, mallas: [], cerca: [], lejos: [] }); }
      c[destino].push(im);
      im.matrixAutoUpdate = false; im.matrixWorldAutoUpdate = false;
      escena.add(im);
    });
  }
  trozosFlora.push(...celdas.values());
}
const TROZO = 96, trozosFlora = [];
// Las celdas de flora mas alla de la niebla no se dibujan.
// Con el kit: las celdas cercanas con sus modelos y las lejanas con figuras
// sencillas (LOD).
const LOD_D = { baja: 80, media: 100, alta: 125 }[CAL];
function cullFlora() {
  const lim2 = (escena.fog.far + TROZO * 0.75) ** 2, lod2 = LOD_D * LOD_D;
  const ver = (l, v) => { if (l.length && l[0].visible !== v) for (const im of l) im.visible = v; };
  for (const c of trozosFlora) {
    const d2 = (c.x - P.x) ** 2 + (c.z - P.z) ** 2, v = d2 < lim2, cerca = v && d2 < lod2;
    ver(c.mallas, v); ver(c.cerca, cerca); ver(c.lejos, v && !cerca);
  }
}
// El pueblo: casas, plaza, pozo y el portal a las mazmorras.
// Teja colonial y paja de ichu: el pueblo es andino.
const TECHOS = ['#a4472e', '#c9a24a', '#8a3b24', '#b88a3a', '#a4472e', '#c9a24a', '#7a3a22'];
// Ya no hay aspas (la torre es un campanario); queda null y todo uso va con if.
let molinoAspas = null;
// Banderines de aguayo colgados entre casas de la plaza: una sola malla
// instanciada (cuerda y banderines), con caida en catenaria.
const AGUAYO = ['#c0262d', '#f2c23a', '#2f62c0', '#2a8a4a', '#e86a1a'];
function crearBanderines() {
  // 0-4 no: esa cuerda atravesaba el campanario (-17, 31).
  const pares = [[2, 5], [1, 4], [5, 0]], paso = (CAL === 'baja' || POBRE) ? 2.2 : 1.1;
  const tramos = [];
  for (const [a, b] of pares) {
    const A = CASAS[a], B = CASAS[b]; if (!A || !B) continue;
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const ra = Math.min(A.w, A.d) / 2, rb = Math.min(B.w, B.d) / 2;
    const x0 = A.x + ux * ra, z0 = A.z + uz * ra, x1 = B.x - ux * rb, z1 = B.z - uz * rb;
    tramos.push({ x0, z0, x1, z1, y0: alturaEn(x0, z0) + 5.6, y1: alturaEn(x1, z1) + 5.6, L: L - ra - rb, ry: Math.atan2(-dz, dx) });
  }
  let n = 0;
  for (const t of tramos) n += Math.max(2, Math.floor(t.L / paso)) * 2;
  if (!n) return;
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.45, 0.02), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
  const o = new THREE.Object3D(), col = new THREE.Color(), cuerda = new THREE.Color('#5a3c25');
  const punto = (t, f) => {
    const x = t.x0 + (t.x1 - t.x0) * f, z = t.z0 + (t.z1 - t.z0) * f;
    const y = Math.max(t.y0 + (t.y1 - t.y0) * f - 0.6 * Math.sin(Math.PI * f), alturaEn(x, z) + 3.6);
    return [x, y, z];
  };
  let i = 0, k = 0;
  for (const t of tramos) {
    const m = Math.max(2, Math.floor(t.L / paso));
    for (let j = 0; j < m; j++) {
      const fa = j / m, fb = (j + 1) / m, fm = (j + 0.5) / m;
      const [ax, ay, az] = punto(t, fa), [bx, by, bz] = punto(t, fb), [mx, my, mz] = punto(t, fm);
      // Tramo de cuerda: una caja estirada entre dos puntos.
      const seg = Math.hypot(bx - ax, bz - az);
      o.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      o.rotation.set(0, t.ry, Math.atan2(by - ay, seg)); o.scale.set(Math.hypot(seg, by - ay) / 0.35, 0.05 / 0.45, 1.5);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i++, cuerda);
      // Banderin colgando bajo la cuerda.
      o.position.set(mx, my - 0.26, mz); o.rotation.set(0, t.ry, 0); o.scale.set(1, 1, 1);
      o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i++, col.set(AGUAYO[k++ % AGUAYO.length]));
    }
  }
  im.count = i; im.frustumCulled = false;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  escena.add(im);
}
// Dintel trapezoidal inca alrededor del portal: jambas inclinadas por fuera de
// los pilares (no tapan el paso ni cambian el choque) y una piedra arriba.
function dintelInca(px, py, pz, piedra) {
  const j1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.8, 1.3), piedra); j1.position.set(px - 3.0, py + 3.3, pz); j1.rotation.z = -0.12;
  const j2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.8, 1.3), piedra); j2.position.set(px + 3.0, py + 3.3, pz); j2.rotation.z = 0.12;
  const sup = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.8, 1.4), piedra); sup.position.set(px, py + 7.2, pz);
  escena.add(j1, j2, sup);
}
function crearPueblo() {
  if (KIT) return crearPuebloKit();
  const pared = transparentar(new THREE.MeshLambertMaterial({ color: 0xd9c39a })), techo = transparentar(new THREE.MeshLambertMaterial({ color: 0xa04a3a })), madera = transparentar(new THREE.MeshLambertMaterial({ color: 0x5a3c25 }));
  for (const c of CASAS) {
    const y = alturaEn(c.x, c.z);
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(c.w, 4, c.d), pared); cuerpo.position.y = 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(Math.max(c.w, c.d) * 0.78, 3.4, 4), techo); t.position.y = 5.7; t.rotation.y = Math.PI / 4;
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), madera); puerta.position.set(0, 1.2, c.d / 2 + 0.05);
    g.add(cuerpo, t, puerta);
    g.position.set(c.x, y, c.z); g.rotation.y = c.r;
    escena.add(g);
  }
  const pozo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0x9a948a }));
  pozo.position.set(0, alturaEn(0, 0) + 0.6, 0); escena.add(pozo);
  // Portal de mazmorras (por ahora, en el juego 2D).
  const px = 22, pz = -18, py = alturaEn(px, pz);
  const piedra = new THREE.MeshLambertMaterial({ color: 0x5b5470 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), piedra); p1.position.set(px - 2.2, py + 3, pz);
  const p2 = p1.clone(); p2.position.x = px + 2.2;
  const arco = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1, 1.2), piedra); arco.position.set(px, py + 6.3, pz);
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  velo.position.set(px, py + 2.9, pz);
  escena.add(p1, p2, arco, velo);
  dintelInca(px, py, pz, piedra); crearBanderines();
  return { x: px, z: pz, velo };
}

// El pueblo con el kit de Kenney: casas de piedra y entramado de madera con
// tejado a dos aguas, una fuente en la plaza, puestos de mercado, carros y un
// campanario (antes molino; ya sin aspas).
function crearPuebloKit() {
  const piedra = new THREE.MeshLambertMaterial({ color: 0x5b5470 });
  CASAS.forEach((c, i) => {
    const nx = Math.max(2, Math.round(c.w / 2.6)), nz = Math.max(2, Math.round(c.d / 2.6));
    const m = new THREE.Mesh(KIT.fundir(piezasCasa(nx, nz, i + 1, TECHOS[i % TECHOS.length])), KIT.material);
    // La puerta mira a la plaza (girar 180° no cambia la caja de choque).
    const deEspaldas = Math.sin(c.r) * c.x + Math.cos(c.r) * c.z > 0;
    m.scale.set(c.w / nx, 2.3, c.d / nz); m.position.set(c.x, alturaEn(c.x, c.z) - 0.25, c.z); m.rotation.y = c.r + (deEspaldas ? Math.PI : 0);
    if (Q.sombras) { m.castShadow = true; m.receiveShadow = true; }
    escena.add(m);
  });
  const pon = (piezas, x, z, ry, s, solido) => {
    const m = new THREE.Mesh(KIT.fundir(piezas), KIT.material);
    m.position.set(x, alturaEn(x, z) - 0.05, z); m.rotation.y = ry || 0; m.scale.setScalar(s || 1);
    if (Q.sombras) m.castShadow = true;
    escena.add(m);
    if (solido) ponerSolido(x, z, solido);
    return m;
  };
  // Faroles del kit (la luz de noche sigue siendo la misma pieza).
  for (const fa of faroles) {
    fa.p.visible = false;
    pon([{ n: 'p_lantern' }], fa.x, fa.z, 0, 2.2, 0.3);
    fa.f.position.y = fa.y + 2.95; fa.f.scale.setScalar(0.55); if (fa.halo) fa.halo.position.y = fa.f.position.y;
  }
  // Fuente de la plaza (donde estaba el pozo).
  pon([{ n: 'p_fountain-round-detail' }], 0, 0, 0, 2.4, 2.5);
  // Chichería de Mama Asiri: puesto, dos ollas de barro y la banderita morada en su palo.
  {
    const na = NPCS3D.find(n => n.tipo === 'chichera');
    if (na) {
      const dx = na.x / Math.hypot(na.x, na.z), dz = na.z / Math.hypot(na.x, na.z), bx = na.x + dx * 2.2, bz = na.z + dz * 2.2;
      pon([{ n: 'p_stall-green' }], bx, bz, Math.atan2(dx, dz) + Math.PI, 2.2, 1.3);
      const barro = new THREE.MeshLambertMaterial({ color: 0x8a4a2a }), morado = new THREE.MeshLambertMaterial({ color: 0x7c3aed, side: THREE.DoubleSide }), palo = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
      const olla = new THREE.CylinderGeometry(0.34, 0.26, 0.5, 10);
      for (const [ox, oz] of [[-dz * 1.6, dx * 1.6], [-dz * 2.2, dx * 2.2]]) { const m = new THREE.Mesh(olla, barro); m.position.set(na.x + ox, alturaEn(na.x + ox, na.z + oz) + 0.25, na.z + oz); escena.add(m); }
      const fx = na.x + dz * 1.9, fz = na.z - dx * 1.9, fy = alturaEn(fx, fz);
      const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), palo); asta.position.set(fx, fy + 1.7, fz); escena.add(asta);
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6), morado); tela.position.set(fx + 0.5, fy + 3.05, fz); escena.add(tela);
      ponerSolido(fx, fz, 0.3);
    }
  }
  // Mercado alrededor de la plaza, lejos de los PNJ y del portal.
  const libre = (x, z) => !NPCS3D.some(n => Math.hypot(n.x - x, n.z - z) < 5) && Math.hypot(x - 22, z + 18) > 8 && Math.hypot(x - SPAWN3D.x, z - SPAWN3D.z) > 5;
  const puestos = ['p_stall-red', 'p_stall-green', 'p_stall-red', 'p_stall-green', 'p_stall'];
  let k = 0;
  for (let a = 0.4; a < Math.PI * 2 && k < puestos.length; a += 0.55) {
    const x = Math.cos(a) * 12, z = Math.sin(a) * 12;
    if (!libre(x, z)) continue;
    const ry = Math.atan2(x, z) + Math.PI;
    pon([{ n: puestos[k] }, { n: 'p_stall-bench', x: 0.75 }, { n: 'p_stall-stool', x: -0.75, z: 0.2 }], x, z, ry, 2.4, 1.3);
    k++;
  }
  // Carros junto a dos casas.
  for (const [ci, n] of [[0, 'p_cart'], [3, 'p_cart-high']]) {
    const c = CASAS[ci], x = c.x + Math.cos(c.r) * (c.w / 2 + 2.2), z = c.z - Math.sin(c.r) * (c.w / 2 + 2.2);
    pon([{ n }], x, z, c.r + 0.4, 2.6, 1.2);
  }
  // Campanario: torre de tres plantas con teja colonial (sin aspas de molino).
  const mx = -17, mz = 31, my = alturaEn(mx, mz) - 0.25;
  const g = new THREE.Group(); g.position.set(mx, my, mz); g.rotation.y = 0.6;
  const torre = new THREE.Mesh(KIT.fundir(piezasCasa(2, 2, 9, '#a4472e', 3)), KIT.material);
  torre.scale.set(2.4, 2.3, 2.4); if (Q.sombras) torre.castShadow = true;
  molinoAspas = null;
  g.add(torre); escena.add(g);
  ponerSolido(mx, mz, 3);
  // Portal de mazmorras.
  const px = 22, pz = -18, py = alturaEn(px, pz);
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), piedra); p1.position.set(px - 2.2, py + 3, pz);
  const p2 = p1.clone(); p2.position.x = px + 2.2;
  const arco = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1, 1.2), piedra); arco.position.set(px, py + 6.3, pz);
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  velo.position.set(px, py + 2.9, pz);
  escena.add(p1, p2, arco, velo);
  dintelInca(px, py, pz, piedra); crearBanderines();
  return { x: px, z: pz, velo };
}

// ── PUNTOS DE RECOLECCION ──
// Matas con flores (hierba) y rocas con vetas (mineral). Los recogidos se
// esconden (escala 0) hasta que vuelven a crecer para este jugador.
const NODOS = nodos3d(MAPAS, MONSTRUOS);
const nodoListo = new Map();   // i -> performance.now() en que vuelve
const nodosMesh = (() => {
  const piezas = {
    hierba: [[new THREE.IcosahedronGeometry(0.75, 0).scale(1, 0.6, 1), '#3f8f3a', 0.4, false], [new THREE.OctahedronGeometry(0.22, 0), '#e879f9', 0.95, true]],
    mineral: [[new THREE.DodecahedronGeometry(0.9, 0).scale(1, 0.7, 1), '#6b6570', 0.5, false], [new THREE.OctahedronGeometry(0.3, 0).scale(0.6, 1.4, 0.6), '#fbbf24', 1.05, true]],
  };
  const out = {};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (const tipo of ['hierba', 'mineral']) {
    const l = NODOS.filter(n => n.tipo === tipo);
    out[tipo] = { l, mallas: [] };
    for (const [geo, color, alto, brilla] of piezas[tipo]) {
      const mat = brilla ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, flatShading: true });
      const im = new THREE.InstancedMesh(geo, mat, l.length * (brilla ? 3 : 1));
      let k = 0;
      for (const n of l) {
        const y = alturaEn(n.x, n.z);
        const veces = brilla ? 3 : 1;
        for (let j = 0; j < veces; j++) {
          const a = j * 2.1 + n.i, d = brilla ? 0.45 : 0;
          v.set(n.x + Math.cos(a) * d, y + alto + (brilla ? j * 0.08 : 0), n.z + Math.sin(a) * d);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
          m4.compose(v, q, sc); im.setMatrixAt(k++, m4);
        }
      }
      im.userData = { brilla, veces: brilla ? 3 : 1, alto };
      escena.add(im);
      out[tipo].mallas.push(im);
    }
  }
  return out;
})();
// Esconde o muestra un punto (todas sus piezas).
function mostrarNodo(n, si) {
  const T = nodosMesh[n.tipo], idx = T.l.indexOf(n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const im of T.mallas) {
    const { veces } = im.userData;
    for (let j = 0; j < veces; j++) {
      im.getMatrixAt(idx * veces + j, m4); m4.decompose(v, q, sc);
      sc.setScalar(si ? 1 : 0.0001); m4.compose(v, q, sc); im.setMatrixAt(idx * veces + j, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  }
}
function nodoCercano() {
  const ahora = performance.now();
  let mejor = null, md = RECOGER_DIST;
  for (const n of NODOS) {
    const d = Math.hypot(n.x - P.x, n.z - P.z);
    if (d < md && !(nodoListo.get(n.i) > ahora)) { md = d; mejor = n; }
  }
  return mejor;
}
function revisarNodos() {
  const ahora = performance.now();
  for (const [i, en] of nodoListo) if (en <= ahora) { nodoListo.delete(i); mostrarNodo(NODOS[i], true); }
}

// Faroles del pueblo: se encienden de noche.
const farolMat = new THREE.MeshBasicMaterial({ color: '#7a6a48' });
// Charcos de luz falsa (sin luces reales): una textura radial calida sumada al suelo.
// ambiente() sube su opacidad al anochecer; la comparten faroles y la linterna del duende.
const luzTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,210,122,1)'); g.addColorStop(0.45, 'rgba(255,210,122,.45)'); g.addColorStop(1, 'rgba(255,210,122,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const luzSueloMat = new THREE.MeshBasicMaterial({ map: luzTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
const luzHaloMat = new THREE.SpriteMaterial({ map: luzTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
const luzGeo7 = new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2);
const luzDuende = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), luzSueloMat);
luzDuende.visible = false; luzDuende.renderOrder = 2; escena.add(luzDuende);
const faroles = [];
(() => {
  const palo = transparentar(new THREE.MeshLambertMaterial({ color: 0x3b2a1a }));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * 27, z = Math.sin(a) * 27, y = alturaEn(x, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6), palo); p.position.set(x, y + 1.6, z);
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), farolMat); f.position.set(x, y + 3.35, z);
    const charco = new THREE.Mesh(luzGeo7, luzSueloMat); charco.position.set(x, y + 0.06, z); charco.renderOrder = 2;
    const halo = new THREE.Sprite(luzHaloMat); halo.scale.setScalar(2.5); halo.position.copy(f.position);
    escena.add(p, f, charco, halo); faroles.push({ p, f, x, y, z, halo });
  }
})();
// Claro del Titan: circulo de menhires donde aparece el jefe mundial.
(() => {
  const piedra = new THREE.MeshLambertMaterial({ color: 0x6b6478 });
  const runa = new THREE.MeshBasicMaterial({ color: 0xff6b3d });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = ARENA3D.x + Math.cos(a) * ARENA3D.r, z = ARENA3D.z + Math.sin(a) * ARENA3D.r;
    const alto = 4 + (i % 3) * 1.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, alto, 1), piedra);
    m.position.set(x, alturaEn(x, z) + alto / 2 - 0.3, z); m.rotation.y = -a; m.rotation.z = (i % 2 ? 0.06 : -0.05);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), runa);
    r.position.set(0, alto * 0.15, 0.51); m.add(r);
    escena.add(m);
  }
  const suelo = new THREE.Mesh(new THREE.RingGeometry(ARENA3D.r - 1.2, ARENA3D.r - 0.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6b3d, transparent: true, opacity: 0.35, depthWrite: false }));
  suelo.position.set(ARENA3D.x, alturaEn(ARENA3D.x, ARENA3D.z) + 0.2, ARENA3D.z);
  escena.add(suelo);
})();

// ── SPRITES (planos que miran a la camara, con la hoja de animacion) ──
const imagenes = {};
function cargarImg(src) {
  if (imagenes[src]) return imagenes[src];
  return (imagenes[src] = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
}
const texturas = new Map();
function textura(img) {
  if (texturas.has(img)) return texturas.get(img);
  const t = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: true });
  texturas.set(img, mat);
  return mat;
}
// Hoja del duende teñida para las skins premium (igual que el 2D).
function teñir(img, hue, sat) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, giro = (hue || 0) / 360;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) { const dd = mx - mn; s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h /= 6; }
    h = (h + giro) % 1; s = Math.min(1, s * (sat || 1));
    const q2 = l < .5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q2;
    const k = t => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < .5 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2; };
    p[i] = k(h + 1 / 3) * 255; p[i + 1] = k(h) * 255; p[i + 2] = k(h - 1 / 3) * 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}
const sombraTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }); })();
const anilloMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
const anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), anilloMat);
anillo.visible = false;
escena.add(anillo);
// Anillo pequeño "a tiro" (v344): bajo el monstruo mas cercano a menos de alcance+2 m.
// Amarillo = casi; verde (y late) = el golpe ya le llega.
const anilloTiroMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
const anilloTiro = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.66, 28).rotateX(-Math.PI / 2), anilloTiroMat);
anilloTiro.visible = false;
escena.add(anilloTiro);

// ── ALAS (vuelo estilo AION) ──
// Cada tipo de ALAS (data.js) tiene su forma: luz, plumas, mariposa o
// membrana de dragon; las que brillan suman luz (mezcla aditiva).
const GEO_ALA = {};
function geoAla(forma) {
  if (GEO_ALA[forma]) return GEO_ALA[forma];
  const S = () => new THREE.Shape();
  let formas;
  if (forma === 'pluma') {
    const s = S(); s.moveTo(0, 0); s.quadraticCurveTo(0.6, 0.9, 1.6, 1.05); s.quadraticCurveTo(2.3, 1.0, 2.5, 0.65);
    // Borde de plumas: dientes hacia atras.
    const p = [[2.25, 0.25], [2.05, 0.5], [1.85, 0.0], [1.6, 0.3], [1.35, -0.25], [1.1, 0.1], [0.85, -0.4], [0.55, -0.05], [0.3, -0.35], [0, 0]];
    for (const [x, y] of p) s.lineTo(x, y);
    formas = [s];
  } else if (forma === 'mariposa') {
    const a = S(); a.absellipse(1.05, 0.65, 1.0, 0.72, 0, Math.PI * 2, false, 0.35);
    const b = S(); b.absellipse(0.7, -0.45, 0.62, 0.45, 0, Math.PI * 2, false, -0.4);
    formas = [a, b];
  } else if (forma === 'membrana') {
    const s = S(); s.moveTo(0, 0.15); s.quadraticCurveTo(0.6, 1.0, 1.5, 1.2); s.lineTo(2.6, 0.95); s.lineTo(2.55, 0.25);
    s.quadraticCurveTo(2.1, 0.15, 1.9, -0.45); s.quadraticCurveTo(1.5, -0.2, 1.15, -0.75); s.quadraticCurveTo(0.8, -0.35, 0.4, -0.5); s.quadraticCurveTo(0.2, -0.15, 0, 0.15);
    formas = [s];
  } else {
    const s = S(); s.moveTo(0, 0); s.quadraticCurveTo(0.9, 0.9, 2.1, 0.7); s.quadraticCurveTo(1.4, 0.1, 1.9, -0.4); s.quadraticCurveTo(0.9, -0.3, 0, 0);
    formas = [s];
  }
  return (GEO_ALA[forma] = new THREE.ShapeGeometry(formas));
}
function nuevasAlas(id) {
  const A = ALAS[id] || ALAS.aprendiz;
  const g = new THREE.Group();
  const mat = A.brillo || A.forma === 'luz'
    ? new THREE.MeshBasicMaterial({ color: A.color, transparent: true, opacity: A.brillo ? 0.9 : 0.75, side: THREE.DoubleSide, depthWrite: false, blending: A.brillo ? THREE.AdditiveBlending : THREE.NormalBlending })
    : new THREE.MeshLambertMaterial({ color: A.color, side: THREE.DoubleSide, transparent: A.forma === 'mariposa', opacity: A.forma === 'mariposa' ? 0.88 : 1 });
  const geo = geoAla(A.forma);
  const izq = new THREE.Mesh(geo, mat), der = new THREE.Mesh(geo, mat);
  der.scale.x = -1;
  // Huesos de la membrana (dragon): varillas oscuras.
  if (A.forma === 'membrana') for (const m of [izq, der]) for (const [x, y] of [[2.55, 0.25], [1.9, -0.45], [1.15, -0.75]]) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, Math.hypot(x, y), 4), new THREE.MeshBasicMaterial({ color: 0x1b1030 }));
    v.position.set(x / 2, y / 2, 0.01); v.rotation.z = Math.atan2(y, x) - Math.PI / 2; m.add(v);
  }
  g.add(izq, der);
  g.visible = false;
  g.userData.id = id || 'aprendiz';
  escena.add(g);
  return g;
}
// Las alas propias se rehacen si cambias de alas.
let alasMesh = nuevasAlas('aprendiz');
// Libera geometrias y materiales propios (las geometrias de ala en cache no).
function liberar(obj) {
  const compartidas = new Set(Object.values(GEO_ALA));
  obj.traverse(o => {
    if (o.geometry && !compartidas.has(o.geometry)) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    if (o.isInstancedMesh) o.dispose();   // suelta tambien el bufer instanceMatrix en la GPU
  });
}
function quitarAlas(g) { if (g) { escena.remove(g); liberar(g); } }
function alasPropias() {
  const id = (yo && yo.ala) || 'aprendiz';
  if (alasMesh.userData.id === id) return;
  quitarAlas(alasMesh);
  alasMesh = nuevasAlas(id);
}
// Sombra en el suelo: se achica cuando la figura salta o vuela (base = tamano en tierra).
function ponerSombra(s, base, x, y, z) {
  const suelo = alturaEn(x, z), h = Math.max(0, y - suelo), k = 1 / (1 + h * 0.35);
  s.position.set(x, suelo + 0.05, z); s.scale.setScalar(base * k);
}
// Alas en la espalda (ry = hacia donde mira; con sprites, hacia la camara).
// modo: 'planea' = alas abiertas casi quietas, 'sube' = aleteo rapido, '' = aleteo normal.
function ponerAlas(g, x, y, z, ry, t, modo) {
  const bat = modo === 'planea' ? 0.12 + Math.sin(t / 450) * 0.04 : modo === 'sube' ? Math.sin(t / 70) * 0.6 : Math.sin(t / 120) * 0.5;
  g.position.set(x - Math.sin(ry) * 0.25, y + 1.15, z - Math.cos(ry) * 0.25); g.rotation.set(0, ry, 0);
  g.children[0].rotation.y = 0.5 + bat; g.children[1].rotation.y = -0.5 - bat;
}
class Figura {
  // ancho/alto en metros del cuadro entero de la hoja.
  constructor(mat, ancho, alto, cols, filas) {
    this.g = new THREE.PlaneGeometry(ancho, alto); this.g.translate(0, alto / 2, 0);
    this.m = new THREE.Mesh(this.g, mat);
    this.cols = cols; this.filas = filas; this.izq = false; this.f = 1; this.ultimo = '';
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), sombraTex);
    escena.add(this.m, this.sombra);
  }
  cuadro(col, fila, mirandoDer) {
    const k = col + ',' + fila + ',' + mirandoDer;
    if (k === this.ultimo) return;
    this.ultimo = k;
    let u0 = col / this.cols, u1 = (col + 1) / this.cols;
    if (mirandoDer === this.izq) [u0, u1] = [u1, u0];
    const v1 = 1 - fila / this.filas, v0 = 1 - (fila + 1) / this.filas;
    const uv = this.g.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }
  poner(x, y, z, yaw, escala) {
    this.m.position.set(x, y, z); this.m.rotation.set(0, yaw, 0);
    if (escala) this.m.scale.set(escala[0], escala[1], 1);
    ponerSombra(this.sombra, 1, x, y, z);
  }
  quitar() { escena.remove(this.m, this.sombra); this.g.dispose(); this.sombra.geometry.dispose(); }
}
// ── MODELOS 3D (mundo/js/modelos.js) ──
// Figura3D tiene la misma interfaz que Figura (poner, quitar y 'm' para
// elegir con el raton). Con ?sprites=1 se vuelve a los sprites de siempre.
let USAR_MODELOS = true;
try { if (/[?&]sprites=1/.test(location.search) || localStorage.getItem('dq3_sprites') === '1') USAR_MODELOS = false; } catch (e) {}
const golpeGeo = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
const golpeMat = new THREE.MeshBasicMaterial({ visible: false });
const sombraGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const vSilla = new THREE.Vector3();
class Figura3D {
  constructor(modelo, escala) {
    this.tipo = 'modelo'; this.modelo = modelo; this.escala = escala || 1;
    this.raiz = new THREE.Group(); this.raiz.add(modelo.obj); this.raiz.scale.setScalar(this.escala);
    this.alto = modelo.alto * this.escala;
    // Cilindro invisible para el clic (mas facil de acertar que las piezas).
    const r = Math.max(0.45, modelo.alto * 0.32);
    this.m = new THREE.Mesh(golpeGeo, golpeMat); this.m.scale.set(r, modelo.alto, r); this.raiz.add(this.m);
    this.sombraBase = Math.max(1.2, this.alto * 0.8);
    this.sombra = new THREE.Mesh(sombraGeo, sombraTex); this.sombra.scale.setScalar(this.sombraBase);
    this.lean = 0; this.leanV = 0; this.cab = 0; this.cabV = 0; this.raiz.rotation.order = 'YXZ';
    this.est = 'quieto'; this.tE = 0; this.montura = null; this.mId = '';
    if (Q.sombras) { modelo.obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.sombra.visible = false; }
    escena.add(this.raiz, this.sombra);
  }
  estado(e, t, forzar) { if (e !== this.est || forzar) { this.est = e; this.tE = t; } }
  // Montura bajo el jinete (id de MONTURAS o '').
  montar(id) {
    if (id === this.mId) return;
    if (this.montura) { escena.remove(this.montura.obj); this.montura.dispose(); this.montura = null; }
    this.mId = id || '';
    if (id) { try { this.montura = crearMontura(id); this.montura.ritmo = velMontura(id) / 1.5; if (Q.sombras) this.montura.obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); escena.add(this.montura.obj); } catch (e) { console.warn(e); this.mId = ''; } }
    // Invocacion (solo si la figura ya estaba en escena y cerca): anillo del color de la montura, tono y rebote.
    if (this.montura && this._t !== undefined) {
      const x = this._x, z = this._z, y = this._y;
      if (Math.hypot(x - P.x, z - P.z) < 30) {
        const d = MONTURAS[id], col = !d || d.banda || d.torre ? '#ffd84a' : d.tinte || '#fff3b0';
        FX.emitir(x, y + 0.2, z, { n: MOVIL ? 6 : 10, color: col, vel: 3, vida: 0.7, grav: -1, plano: true, radio: 0.9, tam: 1.4, forma: 'estrella' });
        SON.tocar('botin', { vol: 0.5, x, z, r: 1 });   /* campanita corta: 'nivel' sonaba a subir de nivel y su pausa de 400 ms podia tapar tu subida real */
        this.aplastaT = this._t; this.aplastaK = 0.14;
      }
    }
  }
  poner(x, y, z, ry, t, escala) {
    // Pausa de golpe (hitstop): mientras this.pausa, el reloj de la animacion no avanza.
    if (this.pausa && this.tUlt) { const dp = Math.min(100, Math.max(0, t - this.tUlt)); this.tE += dp; this.tOff = (this.tOff || 0) + dp; }
    this.tUlt = t;
    const ts = (t - (this.tOff || 0)) / 1000;
    const d = Math.hypot(x - P.x, z - P.z);
    // Inclinacion procedural: se ladea al girar corriendo y cabecea al arrancar/frenar (muelle critico).
    if (this._t === undefined) { this._t = t; this._ry = ry; this._x = x; this._y = y; this._z = z; this._v = 0; this._vy = 0; }
    if (t !== this._t) {
      const dt = clamp((t - this._t) / 1000, 0.001, 0.1);
      const v = Math.hypot(x - this._x, z - this._z) / dt, vy = (this._y - y) / dt;
      if (v > 40 || Math.abs(vy) > 60) { this.lean = this.leanV = this.cab = this.cabV = 0; this._v = 0; this._vy = 0; }
      else {
        const w = Math.atan2(Math.sin(ry - this._ry), Math.cos(ry - this._ry)) / dt;
        const kM = 60, cM = 2 * Math.sqrt(kM);
        const metaL = clamp(-w * v * 0.012, -0.22, 0.22);
        this.leanV += (kM * (metaL - this.lean) - cM * this.leanV) * dt; this.lean += this.leanV * dt;
        const metaC = clamp((v - this._v) / dt * 0.01, -0.12, 0.12);
        this.cabV += (kM * (metaC - this.cab) - cM * this.cabV) * dt; this.cab += this.cabV * dt;
        // Aterrizaje de otros (sin red): caia rapido y ahora casi no se mueve en vertical.
        if (this !== P.fig && this._vy > 6 && Math.abs(vy) < 1.5) { this.aplastaT = t; this.aplastaK = 0.1; }
        this._v = v; this._vy = vy;
        if (!Number.isFinite(this.lean + this.leanV + this.cab + this.cabV + v + vy)) { this.lean = this.leanV = this.cab = this.cabV = 0; this._v = 0; this._vy = 0; }
      }
      this._t = t; this._ry = ry; this._x = x; this._y = y; this._z = z;
    }
    // Tope de figuras (gama baja): fuera de los MAX_FIG mas cercanos solo queda la sombra-disco (el nombre va aparte, en etiquetas()).
    const enRango = d < escena.fog.far + 15, ver = enRango && this._cerca !== false;
    this.raiz.visible = ver; this.raiz.matrixWorldAutoUpdate = ver;   /* oculta: three se salta sus ~20 piezas al recalcular matrices */
    this.sombra.visible = enRango && (!Q.sombras || d > 24 || !ver);
    if (this.montura) this.montura.obj.visible = ver;
    if (!ver) { if (enRango) ponerSombra(this.sombra, this.sombraBase, x, y, z); return; }
    const animar = d < 45 || (cuadro + this.raiz.id) % 2 === 0;
    if (this.montura) {
      const mo = this.montura;
      mo.obj.position.set(x, y, z); mo.obj.rotation.set(0, ry, 0);
      if (animar) mo.animar(this.andaMontura ? 'corre' : 'quieto', ts, ts);
      mo.obj.updateMatrixWorld(true);
      mo.silla.getWorldPosition(vSilla);
      this.raiz.position.copy(vSilla);
    } else this.raiz.position.set(x, y - (this.est === 'nada' ? 0.45 : 0), z);
    this.raiz.rotation.set(0, ry, 0);
    if (d < 25) { const f = MENOS_MOV ? 0.4 : 1; this.raiz.rotation.z = this.lean * f; this.raiz.rotation.x = this.cab * f; }
    const k = escala === undefined ? 1 : escala;
    this.raiz.scale.setScalar(this.escala * k);
    if (this.aplastaT) {
      const a = (t - this.aplastaT) / 280;
      if (a >= 1 || a < 0) this.aplastaT = 0;
      else { const q = this.aplastaK * Math.sin(a * Math.PI) * (1 - a * 0.5); this.raiz.scale.y *= 1 - q; this.raiz.scale.x *= 1 + q * 0.5; this.raiz.scale.z *= 1 + q * 0.5; }
    }
    if (this.estira) { this.raiz.scale.y *= 1 + this.estira; this.raiz.scale.x *= 1 - this.estira * 0.4; this.raiz.scale.z *= 1 - this.estira * 0.4; }
    this.modelo.montaAnda = !!(this.montura && this.andaMontura);
    if (animar) this.modelo.animar(this.est, (t - this.tE) / 1000, ts);
    ponerSombra(this.sombra, this.sombraBase, x, y, z);
  }
  quitar() { this.montar(''); escena.remove(this.raiz, this.sombra); this.modelo.dispose(); }
}
function figuraModelo(crear, escala) {
  if (!USAR_MODELOS) return null;
  try { return new Figura3D(crear(), escala); } catch (e) { console.warn('Modelo 3D:', e); return null; }
}
const altoFig = f => f.alto || f.g.parameters.height * 0.85;
// Estado de animacion de un jugador.
function estadoJugador(q, esYo, t, anda) {
  if (esYo ? P.muerto : q.muerto) return 'muere';
  const dAtk = (q.fig && q.fig.modelo && q.fig.modelo.r && q.fig.modelo.r.tAtk ? q.fig.modelo.r.tAtk : 0.35) * 1250;
  if (t - (q.atkT || 0) < dAtk) return 'ataca';
  if (esYo ? !!lanzando : (q.lanza || 0) > t) return 'lanza';
  if (t - (q.heridoT || 0) < 250) return 'herido';
  if (esYo ? P.vuela || P.planea : q.a === 3 || q.a === 4) return 'vuela';
  if (esYo && !P.suelo && P.vy > -6) return 'salta';
  if (anda && alturaEn(q.x, q.z) < -0.7) return 'nada';
  return anda ? 'corre' : 'quieto';
}

// Cuadros de la hoja del duende (los mismos del 2D).
const ANIM_IDX = { reposo: [1, 2, 3], camina: [4, 5, 6, 7, 8, 9], ataca: [10, 11, 12, 13, 14], herido: [15, 16, 17] };
let ANIM = null, animP = null;
// La hoja del duende (472 KB) solo hace falta como plan B (sin modelos 3D): se pide al usarla.
const cargarAnim = () => animP || (animP = fetch(A + 'skins/duende_anim.json').then(r => r.json()).then(j => { ANIM = j; }).catch(() => {}));

// Figura de un jugador segun su skin.
async function figuraJugador(skin) {
  const sk = SKINS[skin] || SKINS.comun;
  if (skin === 'comun' || sk.anim) {
    const [img] = await Promise.all([cargarImg(A + 'skins/duende_anim.png'), cargarAnim()]);
    if (!img || !ANIM) return null;
    const fuente = sk.anim ? (imagenes['t:' + skin] = imagenes['t:' + skin] || teñir(img, sk.hue, sk.sat)) : img;
    const [cw, ch] = ANIM.celda;
    const alto = 1.75 / (ANIM.altoDePie || 0.69);
    const f = new Figura(textura(fuente).clone(), alto * cw / ch, alto, Math.round(img.width / cw), 1);
    f.tipo = 'anim';
    return f;
  }
  const img = await cargarImg(A + 'skins/' + sk.img + '.png');
  if (!img) return null;
  const alto = 66 / PX_M;
  const f = new Figura(textura(img).clone(), Math.min(alto * img.width / img.height, 110 / PX_M), alto, 1, 1);
  f.tipo = 'fija';
  return f;
}
async function figuraHoja(k, altoPx) {
  const hoja = HOJAS[k];
  if (!hoja) return null;
  const img = await cargarImg(A + 'enemigos/sheets/' + k + '.png');
  if (!img) return null;
  const e = altoPx / hoja.ideal;
  const f = new Figura(textura(img), hoja.fw * e / PX_M, hoja.fh * e / PX_M, Math.round(img.width / hoja.fw), Math.round(img.height / hoja.fh));
  f.izq = !!hoja.izq; f.hoja = hoja;
  return f;
}

// ── ETIQUETAS (HTML sobre el lienzo: nitidas y baratas) ──
const capa = $('capa');
function etiqueta(clase) { const d = document.createElement('div'); d.className = 'lbl ' + (clase || ''); capa.appendChild(d); return d; }
const vtmp = new THREE.Vector3();
function aPantalla(x, y, z) {
  vtmp.set(x, y, z).project(camara);
  if (vtmp.z > 1 || vtmp.z < -1) return null;
  return [(vtmp.x + 1) / 2 * innerWidth, (1 - vtmp.y) / 2 * innerHeight];
}
const poolNum = [];
// Cifras compactas: 1234 -> 1,2k; 12345 -> 12k (asi no tapan al monstruo en 360 px).
function cifraCorta(txt) {
  if (typeof txt !== 'string') return txt;
  return txt.replace(/\d{4,}/, s => { const n = +s; return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace('.', ',').replace(',0', '') + 'k'; });
}
// clave (opcional): golpes normales del mismo atacante al mismo monstruo se suman en un solo numero.
function numero(x, y, z, txt, color, grande, clave) {
  if (typeof txt === 'number') txt = String(txt);
  if (clave && !grande) {
    const val = parseInt(txt, 10);
    if (Number.isFinite(val)) {
      const v = numeros.find(n => n.k === clave && !n.g && n.t < 0.45);
      if (v) { v.suma += val; v.d.textContent = cifraCorta(String(v.suma)); v.t = 0.05; v.pop = 1; return; }
    }
  }
  // Prioridad: un golpe grande apaga antes a los chicos que siguen en pantalla.
  if (grande) for (const v of numeros) if (!v.g && v.k) v.t = Math.max(v.t, 0.7);
  if (numeros.length >= 24) { const i = numeros.findIndex(v => !v.g); const v = numeros.splice(i >= 0 ? i : 0, 1)[0]; v.d.style.display = 'none'; poolNum.push(v.d); }
  let d = poolNum.pop();
  if (!d) { d = document.createElement('div'); d.className = 'num'; capa.appendChild(d); }
  d.textContent = cifraCorta(txt); d.style.color = color || '#fff'; d.style.fontSize = grande ? (typeof grande === 'number' ? grande + 'px' : '22px') : ''; d.style.display = ''; d.style.opacity = 1;
  numeros.push({ d, x, y, z, t: 0, dx: (Math.random() - 0.5) * 0.8, g: !!grande, k: clave || null, suma: parseInt(txt, 10) || 0, pop: 0 });
}
let numeros = [];
// ── GESTOS: un emoji grande 2,5 s sobre el duende que lo hace (sin texto libre) ──
const gestosVivos = new Map();   // id del jugador -> { d, t }
function mostrarGesto(pid, gid) {
  const q = pid === miId ? P : otros.get(pid);
  // El cuerpo tambien se mueve (modelos.js animarRig): 2,5 s de pose, se corta si camina.
  const mo = q && q.fig && q.fig.modelo;
  if (mo) { mo.gesto = gid; mo.gestoT = performance.now(); }
  try { fiestaGesto(pid, gid, q); } catch (e) {}
  let g = gestosVivos.get(pid);
  if (!g) { const d = document.createElement('div'); d.className = 'num gesto3'; capa.appendChild(d); g = { d, t: 0 }; gestosVivos.set(pid, g); }
  g.d.textContent = GESTOS[gid].e; g.t = 0; g.d.style.display = ''; g.gid = gid; g.ts = performance.now();
  if (pid === miId) SON.tocar('clic', { vol: 0.6 });
}
// ── MARCAS 📍: pilar de luz de 6 s (sin texto libre) para tu grupo y los cercanos ──
// ataque (rojo) = tu objetivo, recurso (verde) = nodo o cofre cerca, ir (azul) =
// 6 m delante, caido (blanco) = «🆘 Pedir ayuda» desde la pantalla de muerte.
const MARCA_COL = { ataque: 0xff3b3b, recurso: 0x4ade80, ir: 0x60a5fa, caido: 0xffffff };
const MARCA_CSS = { ataque: '#ff3b3b', recurso: '#4ade80', ir: '#60a5fa', caido: '#ffffff' };
const MARCA_TXT = { ataque: '¡ataquen aquí!', recurso: 'recurso aquí', ir: 'vamos aquí', caido: '¡caí, ayúdenme!' };
let marcas3 = [], marcaGeo = null, marcaT = 0, ayudaT = 0;
// Revancha (servidor 'revancha3'): el monstruo que te derribó casi muerto queda herido 90 s; al revivir se marca 📍.
let revancha3 = null;
const TXT_REVANCHA = ': está herido 90 s, ve por la revancha 📍';
function marcarRevancha3() {
  const r = revancha3;
  if (!r || Date.now() >= r.hasta || !Number.isFinite(r.x) || !Number.isFinite(r.z)) return;
  if (r.x >= 2800 || Math.hypot(r.x - P.x, r.z - P.z) > 300) return;   // nunca en la Cueva ni a la otra punta del mapa
  mostrarMarca({ p: miId, k: 'ataque', x: r.x, z: r.z, silencio: 1 });
  const mk = marcas3[marcas3.length - 1]; if (mk && mk.p === miId) mk.vence = Math.min(r.hasta, Date.now() + 20000);
  setTimeout(() => aviso(`📍 Revancha: ${Math.round(Math.hypot(r.x - P.x, r.z - P.z))} m, aún está herido (${Math.max(1, Math.ceil((r.hasta - Date.now()) / 1000))} s)`, 'ok', 2), 600);
}
function recursoCerca3() {
  const ahora = performance.now(), ah = Date.now();
  let mejor = null, md = 15;
  for (const n of NODOS) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < md && !(nodoListo.get(n.i) > ahora)) { md = d; mejor = n; } }
  for (const c of COFRES3) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < md && c.listoEn <= ah) { md = d; mejor = c; } }
  return mejor;
}
function marcar3(k) {
  const ahora = Date.now();
  if (ahora - marcaT < 3000) return aviso('Espera un momento para marcar de nuevo.');
  let x = P.x, z = P.z;
  if (!k) {
    const o = objetivo ? mons.get(objetivo) : null, r = o && !o.muereT && o.st !== 3 ? null : recursoCerca3();
    if (o && !o.muereT && o.st !== 3) { k = 'ataque'; x = o.x; z = o.z; }
    else if (r) { k = 'recurso'; x = r.x; z = r.z; }
    else { k = 'ir'; x = P.x + Math.sin(P.ry || 0) * 6; z = P.z + Math.cos(P.ry || 0) * 6; }
  }
  marcaT = ahora;
  mandar({ t: 'marca', k, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
}
function mostrarMarca(m) {
  if (!MARCA_COL[m.k] || !Number.isFinite(m.x) || !Number.isFinite(m.z)) return;
  if (!marcaGeo) marcaGeo = new THREE.CylinderGeometry(0.35, 0.35, 30, 10, 1, true);
  // Una marca viva por jugador: la nueva reemplaza a la anterior.
  for (const a of marcas3.filter(a => a.p === m.p)) quitarMarca(a);
  const mat = new THREE.MeshBasicMaterial({ color: MARCA_COL[m.k], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false });
  const mesh = new THREE.Mesh(marcaGeo, mat);
  mesh.position.set(m.x, (alturaEn(m.x, m.z) || 0) + 15, m.z);
  escena.add(mesh);
  marcas3.push({ p: m.p, k: m.k, x: m.x, z: m.z, mesh, vence: Date.now() + 6000 });
  try { FX.emitir(m.x, (alturaEn(m.x, m.z) || 0) + 0.5, m.z, { n: 14, color: MARCA_CSS[m.k], vel: 2, vida: 0.9, grav: -2, sube: 1 }); } catch (e) {}
  const q = otros.get(m.p), g = grupo3 && grupo3.m ? grupo3.m.find(x => x.id === m.p) : null;
  const nom = String((q && q.n) || (g && g.n) || 'Un aliado').slice(0, 16);
  if (!m.silencio) {   // la marca de revancha sale sin aviso rojo ni sonido de amenaza
    aviso(m.p === miId ? `📍 Marcaste: ${MARCA_TXT[m.k]}` : `📍 ${nom} marcó: ${MARCA_TXT[m.k]}`, m.k === 'caido' || m.k === 'ataque' ? 'err' : 'ok', 2);
    try { SON.tocar(m.k === 'caido' || m.k === 'ataque' ? 'amenaza' : 'clic', { vol: 0.5 }); } catch (e) {}
  }
}
function quitarMarca(a) {
  escena.remove(a.mesh); a.mesh.material.dispose();
  const i = marcas3.indexOf(a); if (i >= 0) marcas3.splice(i, 1);
}
// Lo llama pintarMini (unas 10 veces por segundo): pulso y vencimiento.
function actualizarMarcas3() {
  if (!marcas3.length) return;
  const ah = Date.now();
  for (const a of marcas3.slice()) {
    if (ah >= a.vence) { quitarMarca(a); continue; }
    const resta = (a.vence - ah) / 6000;
    a.mesh.material.opacity = (0.35 + 0.25 * Math.sin(ah / 160)) * Math.min(1, resta * 4);
  }
}
// Fiesta en grupo (solo cliente, sin premios): mismo gesto de 2+ duendes en < 1,5 s y a < 6 m.
function fiestaGesto(pid, gid, q) {
  if (!q) return;
  const ahora = performance.now(), cerca = [q];
  for (const [p2, g2] of gestosVivos) {
    if (p2 === pid || g2.gid !== gid || ahora - (g2.ts || 0) > 1500) continue;
    const q2 = p2 === miId ? P : otros.get(p2);
    if (q2 && Math.hypot(q2.x - q.x, q2.z - q.z) < 6) cerca.push(q2);
  }
  // Una vez por fiesta; solo se repite si se suma gente (2 -> 3 = huayno).
  if (cerca.length < 2 || (ahora - (fiestaGesto.t || 0) < 2500 && cerca.length <= (fiestaGesto.n || 0))) return;
  fiestaGesto.t = ahora; fiestaGesto.n = cerca.length;
  let x = 0, z = 0;
  for (const c of cerca) { x += c.x; z += c.z; }
  x /= cerca.length; z /= cerca.length;
  numero(x, alturaEn(x, z) + 3.6, z, cerca.length >= 3 && gid === 'bailar' ? '🎉 ¡Huayno grupal!' : '🎉 ¡Fiesta!', '#ffd54a', true);
  SON.tocar('racha', { vol: 0.6 });
}
function moverGestos(dt) {
  for (const [pid, g] of gestosVivos) {
    g.t += dt;
    const q = pid === miId ? P : otros.get(pid);
    if (!q || g.t > 2.5) { g.d.remove(); gestosVivos.delete(pid); continue; }
    const s = aPantalla(q.x, (q === P ? P.y : (q.y || alturaEn(q.x, q.z))) + 3 + Math.sin(g.t * 5) * 0.08, q.z);
    if (!s) { g.d.style.display = 'none'; continue; }
    const k = g.t < 0.2 ? 0.5 + g.t * 2.5 : 1;
    g.d.style.display = ''; g.d.style.opacity = g.t > 2.1 ? (2.5 - g.t) / 0.4 : 1;
    g.d.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(2)})`;
  }
}

// ── SONIDO ──
let sonido = (() => { try { return localStorage.getItem('dq_mmo_sonido') !== '0'; } catch (e) { return true; } })();
const SFX = {};
// Efectos con WebAudio: cada sonido se descarga y decodifica una vez y se
// reproduce desde su buffer (antes cada golpe creaba un <audio> nuevo y en
// los combates se notaban tirones). Como mucho 8 voces y algo de variacion de tono.
let actx = null, voces = 0, fuera3 = false;   // fuera3: Telegram 'deactivated' (los efectos no deben reanudar el audio)
const cargandoSfx = {};
function ctxAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } return actx; }
function cargarSfx(n) {
  const c = ctxAudio();
  if (!c || cargandoSfx[n]) return;
  cargandoSfx[n] = fetch(A.replace('assets/', '') + 'audio/sfx/' + n + '.mp3').then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(buf => { SFX[n] = buf; }).catch(() => {});
}
// Sintetizados (cofre, botin, nivel, alas, agua...) y bus comun con compresor:
// todo sale por SON.salida(). El oyente es el jugador; el «derecha» sale de la camara.
const SON = crearSonidos({
  ctx: ctxAudio,
  puede: () => sonido && !fuera3 && !document.hidden,
  oyente: () => { const e = camara.matrixWorld.elements, l = Math.hypot(e[0], e[2]) || 1; return { x: P.x, z: P.z, rx: e[0] / l, rz: e[2] / l }; },
});
// x, z (opcional): suena desde ahi, con volumen por distancia y paneo estereo (lo de otros).
// tono (opcional): multiplica la velocidad de reproduccion (>1 agudo, <1 grave).
function sfx(n, vol, x, z, tono) {
  if (!sonido) return;
  const c = ctxAudio();
  if (!c || fuera3 || document.hidden) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const buf = SFX[n];
  if (!buf) { cargarSfx(n); return; }
  if (voces >= 8) return;
  let v = vol || 0.4, pan = 0;
  if (x != null) { const p = SON.pos(x, z); if (!p) return; v *= p.vol; pan = p.pan; if (v < 0.015) return; }
  try {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; src.playbackRate.value = SON.variar(0.06) * (tono || 1);
    g.gain.value = v;
    src.connect(g);
    if (pan && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(SON.salida()); }
    else g.connect(SON.salida());
    voces++; src.onended = () => { voces--; };
    src.start();
  } catch (e) {}
}
// Peso de cada arma al conectar (solo sensacion, nada de balance): p = ms de pausa del impacto,
// v = vibracion, s = sacudida de camara extra, tono = velocidad del sonido del corte.
// Las varas (magos) usan siempre el de la katana.
const PESO_ARMA = {
  dagas: { p: 18, v: 'light', tono: 1.3 },
  katana: { p: 40, v: 'light', tono: 1 },
  chispa: { p: 45, v: 'light', tono: 1.1 },
  odachi: { p: 85, v: 'medium', s: 0.08, tono: 0.78 },
};
function pesoArma() {
  if (!yo || (CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara')) return PESO_ARMA.katana;
  return PESO_ARMA[yo.arma || 'katana'] || PESO_ARMA.katana;
}
// Variantes de los paquetes CC0 (Kenney y OpenGameArt): una al azar.
const SFX_K = { paso_h: 5, paso_p: 5, paso_m: 5, paso_n: 5, g_carne: 5, g_metal: 5, g_critico: 3, desenv: 3, monedas: 2, libro: 3, tela: 4, puerta: 1,
  c_grunt: 5, c_hurt: 5, c_fant: 5, c_troll: 3, c_roar: 3, c_bug: 4, c_monster: 4, c_baba: 3, c_aullido: 2, c_grito: 2 };
// Variante al azar pero nunca la misma dos veces seguidas.
const ultK = {};
function sfxK(base, vol, x, z) { const n = SFX_K[base]; if (!n) return; let i = Math.floor(Math.random() * n); if (n > 1 && i === ultK[base]) i = (i + 1) % n; ultK[base] = i; sfx('k/' + base + i, vol, x, z); }
// Fanfarria de subir de nivel o de maestria (las cuatro notas del tono
// 'nivel' de CLASSIC): antes sonaba igual que recoger oro.
let fanfarriaT = 0;
const rachaBajas = { n: 0, t: 0 };   // bajas seguidas (< 2,5 s entre una y otra): el tono sube
function fanfarria() {
  if (!sonido) return;
  const c = ctxAudio();
  if (!c || c.state === 'closed' || fuera3 || document.hidden) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const ahora = performance.now();
  if (ahora - fanfarriaT < 400) return;
  fanfarriaT = ahora;
  if (musica.agachar) musica.agachar(1.6);   // la musica se hace a un lado para que se oiga la fanfarria
  SON.tocar('nivel');   // arpegio + acorde mantenido + brillo (sonidos.js)
}
// Voz de cada monstruo segun lo que es.
function vozDe(k) {
  const s = k + ' ' + ((MONSTRUOS[k] || {}).nombre || '').toLowerCase();
  if (/dragon|coloso|titan|angel|rey|lord|battlelord/.test(s)) return 'c_roar';
  if (/goblin|orco|troll|ogro|samurai|centurion/.test(s)) return Math.random() < 0.5 ? 'c_grunt' : 'c_troll';
  if (/esquelet|fantasma|espectro|halo|ghoul|hechicer/.test(s)) return 'c_fant';
  if (/arana|bug|murcielago|pajaro|aguila|saltador/.test(s)) return 'c_bug';
  if (/baba|slime|rana|pulpo|pez|cosa|hongo/.test(s)) return 'c_baba';
  if (/hell|lobo|perro|gato|zarig|conejo|lagarto|serpiente|cangrejo/.test(s)) return 'c_aullido';
  return 'c_monster';
}
// Los de combate, ya listos al primer gesto (el AudioContext pide un gesto).
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { for (const n of ['corte', 'corte2', 'golpe', 'muerte', 'moneda', 'boton', 'salto', 'explosion', 'caida']) cargarSfx(n); for (const b of ['paso_h', 'paso_p', 'g_carne', 'g_critico', 'desenv', 'monedas']) for (let i = 0; i < SFX_K[b]; i++) cargarSfx('k/' + b + i); }, { once: true });

// ── ESTADO ──
let ws = null, miId = 0, yo = null, conectado = false, reintentos = 0, fatal = false, forzarInvitado = false;
const P = { x: SPAWN3D.x, z: SPAWN3D.z, y: 1.5, vy: 0, suelo: true, ry: 0, anda: false, atkT: 0, heridoT: 0, fig: null, skin: '', lbl: null, muerto: false };
const otros = new Map();     // id -> { x, z, ry, a, hp, mx, n, lv, cl, sk, fig, lbl, tx, tz }
const mons = new Map();      // id -> { k, nv, x, z, ry, hp, mx, st, fig, lbl, tx, tz, muereT }
const npcs = [];
let atkBuf = 0, combo3T = 0;   // toque de ATACAR guardado justo antes de acabar la recarga; brillo del 3.er golpe
let objetivo = 0, autoAtk = false, sigAtk = 0, avisoLejosT = 0, avisoAlcT = 0, colaHab = null, colaHasta = 0;
let camYaw = Math.PI, camPitch = 0.42, camDist = COMPACTO ? 8.5 : 11, camReal = camDist, camHold = 0;
let camCombate = false, camCombGira = false;   // hay objetivo vivo cerca / la camara de combate esta girando
// Camara de combate: ultimo arrastre manual (no pelear con el jugador), zoom extra de contexto y su recalculo.
let camArrastreT = -1e9, camExtra = 0, camExtraMeta = 0, camExtraT = 0, camSube = 0;
let zonaActual = '';
let portal = null, agua = null, cueva = null, cuevaInfo = null, abismo = null, caidaEnviada = false;
let cuevaT0 = 0, cuevaFinM = null;   // cronometro de la cueva: cuando entraste y el resultado del servidor (cuevaFin)
const teclas = {};

// ── RED ──
function urlWs() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mmo/ws'; }
// La posicion va por cambios (cada ~190 ms): lo que el servidor mide por distancia
// se manda con la posicion al dia justo delante.
const POS_ANTES = new Set(['cofre3', 'recolectar', 'pescar', 'cueva', 'abismo', 'montar']);
function mandar(o) {
  if (!(ws && ws.readyState === 1)) return;
  if (POS_ANTES.has(o.t) && yo && !P.muerto) mandarPos(true);
  ws.send(JSON.stringify(o));
}
let _sb = null;
async function tokenWeb() {
  try {
    if (!window.supabase || !window.SUPABASE_URL) return null;
    _sb = _sb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data } = await _sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  } catch (e) { return null; }
}
function tokInvitado() {
  let inv = null;
  try { inv = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (!/^[a-f0-9]{32}$/.test(inv || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    inv = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('dq_mmo_tok', inv); } catch (e) {}
  }
  return inv;
}
let soyInvitado = false;
const codigoRescate = () => (tokInvitado().match(/.{4}/g) || []).join('-').toUpperCase();
async function autenticacion() {
  try { localStorage.setItem('dq_ultimo_juego', '/mundo/'); } catch (e) {}   // /inicio/ lo ofrece como CONTINUAR
  let previo = null; try { previo = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  const inv0 = /^[a-f0-9]{32}$/.test(previo || '') ? previo : undefined;
  if (TG && !forzarInvitado) { avisoTgViejo(); return { auth: { k: 'tg', d: TG.initData }, inv: inv0, heredar: heredarResp, vcod: vcodPend() }; }
  const tok = forzarInvitado ? null : await tokenWeb();
  if (tok) return { auth: { k: 'web', tok }, inv: inv0, heredar: heredarResp, vcod: vcodPend() };
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  soyInvitado = true;
  const tokI = tokInvitado();
  // El servidor pidio prueba de trabajo (muchas altas desde la misma red): se resuelve una vez.
  if (powCeros && powNonce == null) powNonce = await resolverPow(tokI, powCeros);
  return { auth: { k: 'inv', tok: tokI }, nombre, pow: powNonce == null ? undefined : powNonce };
}
let ultimoMsgT = performance.now(), conectando = false;
// Conexion en paralelo con la carga (inicio): lo que manda el servidor antes de que
// el mundo este dibujado se guarda aqui y se procesa, en orden, al terminar el arte.
// 'err' y 'heredar' no esperan: fijan retrasoRec/pow/forzarInvitado/pausaHeredar antes
// del onclose (si no, se reintentaba sin pow ni plazo y se gastaban los 12 intentos).
let arteListo = false;
const colaArte = [];
// Huella del dispositivo: con ella el servidor banea o silencia a un invitado sin
// tocar al resto de su IP (en Peru una IP de movil la comparten cientos).
function huellaDev() {
  let d = null; try { d = localStorage.getItem('dq_dev'); } catch (e) {}
  if (!/^[a-f0-9]{32}$/.test(d || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    d = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('dq_dev', d); } catch (e) {}
  }
  return d;
}
// Prueba de trabajo ligera (~4000 hashes, unos 200 ms en un movil) que el servidor
// pide al crear muchos invitados desde la misma red. Igual que powValida de world.js.
// rxN: mensajes recibidos (comprobarAlVolver mira si llega alguno tras el ping).
let powCeros = 0, powNonce = null, retrasoRec = 0, rxN = 0, timerRec3 = 0;
async function resolverPow(tok, ceros) {
  if (!(window.crypto && crypto.subtle)) return null;
  const h = Math.floor(Date.now() / 3600000), enc = new TextEncoder();
  for (let n = 0; n < 500000; n++) {
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('dq-pow:' + h + ':' + tok + ':' + n)));
    let ok = true;
    for (let i = 0; i < ceros && ok; i++) ok = ((i & 1) ? b[i >> 1] & 15 : b[i >> 1] >> 4) === 0;
    if (ok) return n;
  }
  return null;
}
// Pasar el duende de invitado a la cuenta: lo decide el jugador con un boton (nunca en silencio).
// Mientras el aviso esta abierto no se reconecta.
let heredarResp, pausaHeredar = false;
function preguntarHeredar(m) {
  pausaHeredar = true;
  $('carga').style.display = 'none';
  const cuenta = (m.k === 'tg' ? 'de Telegram ' : '') + (m.cuenta || 'nueva');
  const fondo = document.createElement('div');
  fondo.className = 'heredar-fondo';
  fondo.innerHTML = '<div class="heredar-caja" role="dialog" aria-modal="true"><h3>¿Pasar tu duende a esta cuenta?</h3><p class="heredar-txt"></p><button class="heredar-si"></button><button class="heredar-no">Empezar de cero</button></div>';
  fondo.querySelector('.heredar-txt').textContent = 'En este dispositivo jugaste como invitado con ' + (m.inv || 'un duende') + ' (Nv ' + m.nv + '). Has entrado con la cuenta ' + cuenta + ', que aún no tiene duende. Si esta cuenta no es tuya, elige empezar de cero.';
  fondo.querySelector('.heredar-si').textContent = 'Pasar mi duende (Nv ' + m.nv + ') a la cuenta ' + cuenta;
  const elegir = si => { heredarResp = si; pausaHeredar = false; fondo.remove(); $('carga').style.display = 'flex'; reintentos = 0; entradaPedida = true; conectar(); };
  fondo.querySelector('.heredar-si').onclick = () => elegir(true);
  fondo.querySelector('.heredar-no').onclick = () => { if (confirm('¿Empezar de cero en la cuenta ' + cuenta + '? Tu duende de invitado se queda en este dispositivo.')) elegir(false); };
  document.body.appendChild(fondo);
}
async function conectar() {
  // Un solo intento a la vez (volver a la app, 'online' y el temporizador podian
  // coincidir durante el await y abrir dos sockets: el servidor echaba a uno).
  if (conectando || pausaHeredar || (ws && ws.readyState <= 1)) return;
  // «Reintentar ahora» o volver a la app con un reintento pendiente: se anula el
  // temporizador viejo (si no, con el mundo lleno cada toque sumaba otra cadena de intentos).
  clearTimeout(timerRec3);
  conectando = true;
  let hola;
  // Un fallo aqui (supabase, almacenamiento) ya no deja la carga colgada: se reintenta a los 3 s.
  try { hola = await autenticacion(); }
  catch (e) { console.warn('[3D] autenticacion', e); if (!fatal) setTimeout(conectar, 3000); return; }
  finally { conectando = false; }
  if (ws && ws.readyState <= 1) return;
  const este = ws = new WebSocket(urlWs());
  este.onopen = () => { if (ws !== este) return; conectado = true; ultimoMsgT = performance.now(); if (puntoSenal) puntoSenal.title = 'Midiendo tu señal…';mandar({ t: 'hola', ...hola, modo: '3d', ref: ref3, iab: esIAB ? 1 : undefined, src: window.dqOrigen ? window.dqOrigen().src : 'org', camp: window.dqOrigen ? window.dqOrigen().camp || undefined : undefined, ad: window.dqOrigen ? window.dqOrigen().ad || undefined : undefined, med: window.dqOrigen ? window.dqOrigen().med : undefined, fbc: window.dqOrigen ? window.dqOrigen().fbc : undefined, dev: huellaDev() }); };
  este.onmessage = ev => { if (ws !== este) return; ultimoMsgT = performance.now(); rxN++; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'pong') { recibir(m); return; } if (!arteListo && m.t !== 'err' && m.t !== 'heredar') { colaArte.push(m); return; } recibir(m); };
  este.onclose = ev => {
    if (ws !== este) return;   // un socket viejo que el vigilante ya cambio por otro: no toca nada
    conectado = false;
    rttMs = null; if (puntoSenal) { puntoSenal.style.backgroundColor = '#888'; puntoSenal.title = 'Sin conexión'; }
    if (fatal || pausaHeredar) return;
    // 1012: el servidor se esta reiniciando (version nueva): no es un fallo del jugador.
    if (ev && ev.code === 1012) aviso('Actualizando el mundo…');
    // En segundo plano (Telegram minimizado, pantalla bloqueada) no se cuentan
    // intentos: se reconecta al volver.
    if (document.hidden) return;
    reintentos++;
    // Sin señal larga: no se rinde ni recarga el 3D; aviso con «Reintentar ahora» y sigue
    // probando cada 8-12 s (error() marca fatal: se quita para no cortar los reintentos).
    if (reintentos > 12) {
      if (reintentos === 13) { error('No hay conexión con el mundo. Seguimos intentando solos; revisa tu internet.', true); fatal = false; }
      // Si el servidor pidio esperar mas (reintentar), se respeta y no se queda para despues.
      const esperaLarga = Math.max(8000, retrasoRec) + Math.random() * 4000;
      retrasoRec = 0;
      timerRec3 = setTimeout(conectar, esperaLarga);
      return;
    }
    // Con azar (0,5-1,5x mas 0-2 s): tras un despliegue no vuelven todos en el mismo
    // milisegundo. Si el servidor dijo cuando volver (reintentar), se respeta.
    const espera = retrasoRec ? retrasoRec + Math.random() * 1000 : Math.min(8000, 600 * reintentos) * (0.5 + Math.random()) + Math.random() * 2000;
    retrasoRec = 0;
    timerRec3 = setTimeout(conectar, espera);
  };
}
// Al volver a la app (o recuperar la red), reconectar enseguida.
function volverAConectar() {
  if (!entradaPedida) return;
  if (document.hidden || (ws && ws.readyState <= 1)) return;
  if (fatal && !errorRed) return;
  if (fatal) { fatal = false; errorRed = false; cerrar('v-error'); }
  reintentos = 0; conectar();
}
let errorRed = false;
// Hasta que inicio() pide entrar (tras adoptar el rescate #r=), pageshow/focus/online no conectan.
let entradaPedida = false;
document.addEventListener('visibilitychange', volverAConectar);
addEventListener('online', volverAConectar);
// Vigilante de la conexion: el servidor manda una foto 's3' varias veces por
// segundo. Si en 8 s no llega nada, el socket esta medio abierto (cambio de wifi
// a datos, Telegram minimizado...): se cierra y se abre otro. A los 4 s se avisa.
const bandaRed = document.createElement('div');
bandaRed.textContent = 'Reconectando…';
bandaRed.setAttribute('role', 'status');
bandaRed.style.cssText = 'position:fixed;top:calc(8px + max(var(--tg-top, 0px), env(safe-area-inset-top, 0px)));left:50%;transform:translateX(-50%);z-index:60;padding:6px 14px;border-radius:8px;background:rgba(180,30,40,.85);color:#fff;font:600 13px system-ui,sans-serif;display:none;pointer-events:none';
document.body.appendChild(bandaRed);
let vigiaT = performance.now();
setInterval(() => {
  const ahora = performance.now();
  // El propio intervalo llego tarde (segundo plano o un tiron del hilo): se da margen.
  if (ahora - vigiaT > 4000) ultimoMsgT = ahora;
  vigiaT = ahora;
  bandaRed.style.display = yo && !fatal && (!conectado || ahora - ultimoMsgT > 4000) ? 'block' : 'none';
  if (document.hidden || fatal || !ws || ws.readyState !== 1) return;
  // Antes de 'bienvenido' el servidor puede tardar en verificar la cuenta: 35 s; ya dentro, 8 s.
  if (ahora - ultimoMsgT > (ws._listo ? 8000 : 35000)) {
    const viejo = ws; ws = null; conectado = false;
    try { viejo.close(); } catch (e) {}
    reintentos = 0; conectar();
  }
}, 2000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimoMsgT = performance.now(); });
addEventListener('focus', volverAConectar);
addEventListener('pageshow', volverAConectar);
// Vuelta de segundo plano con el socket aun "abierto": un ping y, si en 2,5 s no
// llega nada, esta medio muerto y se cambia (antes el vigilante tardaba 8 s).
let timerVuelta = 0;
function comprobarAlVolver() {
  if (document.hidden || fatal || pausaHeredar || timerVuelta || !ws || ws.readyState !== 1 || !ws._listo) return;
  const este = ws, n0 = rxN;
  mandarPing();
  timerVuelta = setTimeout(() => {
    timerVuelta = 0;
    if (ws !== este || rxN !== n0 || fatal || document.hidden) return;
    ws = null; conectado = false;
    try { este.close(); } catch (e) {}
    reintentos = 0; conectar();
  }, 2500);
}
document.addEventListener('visibilitychange', comprobarAlVolver);
addEventListener('pageshow', comprobarAlVolver);
addEventListener('focus', comprobarAlVolver);
// op.dup: el duende se abrio en otra pestaña/dispositivo (se ofrece 'Jugar aquí' o 'Cerrar', nunca se reconecta solo).
// op.tg: sesion de Telegram caducada (recargar no sirve: hay que reabrir desde el bot).
function error(txt, red, op) {
  $('carga').style.display = 'none';
  fatal = true; errorRed = !!red; $('error-txt').textContent = txt;
  const b = $('b-reconectar');
  b.textContent = op && op.dup ? 'Jugar aquí' : op && op.tg ? 'Cerrar el juego' : 'Volver a entrar';
  b.onclick = op && op.tg ? cerrarJuego : () => location.reload();
  // Fallo de red: reintentar sin recargar (recargar baja otra vez ~1 MB de 3D).
  if (red && !(op && (op.dup || op.tg))) {
    b.textContent = 'Reintentar ahora';
    // El aviso sigue abierto hasta 'bienvenido'; si falla otra vez vuelve el texto (intento 13).
    b.onclick = () => { fatal = false; reintentos = 12; clearTimeout(timerRec3); $('error-txt').textContent = 'Conectando…'; entradaPedida = true; conectar(); };
  }
  let bc = document.getElementById('b-cerrar-err');
  if (!bc) { bc = document.createElement('button'); bc.id = 'b-cerrar-err'; bc.className = 'btn'; bc.textContent = 'Cerrar'; bc.style.cssText = 'width:100%;margin-top:8px;opacity:.85'; bc.onclick = cerrarJuego; b.after(bc); }
  const arc = !!(op && op.lleno && !modoAnuncio());
  bc.textContent = arc ? 'Jugar el arcade mientras' : 'Cerrar';
  bc.onclick = arc ? () => { location.href = '/game.html'; } : cerrarJuego;
  bc.style.display = op && (op.dup || op.lleno) ? '' : 'none';
  abrir('v-error');
}
// Servidor lleno (lleno: 'lleno'), muchas conexiones desde la misma red ('ip') o
// sin plaza para invitados ('inv', fatal): texto claro con cuenta atras y el arcade.
// No es fatal: onclose reintenta solo pasado retrasoRec y 'bienvenido' cierra el aviso.
let llenoN = 0, llenoHasta = 0;
function avisoLleno(m) {
  const base = m.lleno === 'inv' ? (m.m || 'El servidor está lleno de invitados. Entra con tu correo o Telegram.')
    : m.lleno === 'ip' ? 'Muchos jugadores conectados desde tu red (wifi o datos compartidos).'
    : 'Servidor lleno (' + (m.on || m.max || 300) + '/' + (m.max || 300) + ').';
  if (m.fatal || m.lleno === 'inv') { llenoHasta = 0; error(base, false, { lleno: true }); return; }
  // Backoff: 1x, 1,5x, 2x... del plazo del servidor (tope 90 s), mas azar propio.
  llenoN++; reintentos = 0;
  retrasoRec = Math.min(90000, Math.max(5000, +m.reintentar || 30000) * (1 + 0.5 * Math.min(4, llenoN - 1)));
  llenoHasta = Date.now() + retrasoRec;
  error(base, false, { lleno: true });
  fatal = false;   // error() lo marca; aqui se sigue reintentando
  const b = $('b-reconectar');
  b.textContent = 'Reintentar ahora';
  b.onclick = () => { llenoHasta = 0; retrasoRec = 0; reintentos = 0; cerrar('v-error'); if (!yo) $('carga').style.display = 'flex'; entradaPedida = true; conectar(); };
  const pintar = () => {
    if (!llenoHasta || !$('v-error').classList.contains('on')) return;
    const s = Math.max(0, Math.ceil((llenoHasta - Date.now()) / 1000));
    $('error-txt').textContent = base + (s > 0 ? ' Reintento en ' + s + ' s.' : ' Reintentando…');
    if (s > 0) setTimeout(pintar, 1000);
  };
  pintar();
}
function cerrarJuego() { if (TG) { try { TG.close(); } catch (e) {} } else location.href = '/inicio/'; }
// La sesion de Telegram (initData) caduca a las 24 h: a las 23 h se avisa de reabrir desde el bot.
let avisoTgDado = false;
function avisoTgViejo() {
  const ad = +((TG && TG.initDataUnsafe && TG.initDataUnsafe.auth_date) || 0);
  if (avisoTgDado || !ad || Date.now() / 1000 - ad < 23 * 3600) return;
  avisoTgDado = true;
  setTimeout(() => aviso('Tu sesión de Telegram caduca pronto. Cierra el juego y vuelve a abrirlo desde el bot para seguir con tu duende.', 'err'), 3000);
}
// Una sola pestaña jugando: la que entra avisa a las demas del mismo navegador y estas se pausan
// (sin esto, dos pestañas se echaban una a otra sin fin al reconectar).
let canalJuego = null;
try { canalJuego = new BroadcastChannel('dq_juego'); } catch (e) {}
if (canalJuego) canalJuego.onmessage = ev => {
  const d = ev.data || {};
  if (d.t !== 'aqui' || !yo || fatal || d.n !== yo.nombre) return;
  const viejo = ws; ws = null; conectado = false;
  try { if (viejo) viejo.close(4000, 'otra'); } catch (e) {}
  error('Tu duende se abrió en otra pestaña. Juega allí o pulsa «Jugar aquí».', false, { dup: true });
};
// Señal (ping): cada 5 s solo con la pestaña a la vista; el rtt suavizado va en el
// propio ping y pinta un punto junto a la vida (verde <250, amarillo <=600, rojo).
let rttMs = null, puntoSenal = null;
function mandarPing() { mandar({ t: 'ping', ts: Date.now(), rtt: Math.round(rttMs || 0) }); }
function pintarSenal() {
  try {
    if (!puntoSenal) {
      const marco = document.getElementById('marco');
      if (!marco) return;
      puntoSenal = document.createElement('span');
      puntoSenal.id = 'senal3';
      puntoSenal.setAttribute('role', 'button');
      puntoSenal.style.cssText = 'position:absolute;top:-7px;right:-7px;width:9px;height:9px;padding:6px;box-sizing:content-box;background-clip:content-box;border-radius:50%;box-shadow:inset 0 0 0 6px transparent;background-color:#888;cursor:pointer;z-index:2;';
      puntoSenal.onclick = ev => { ev.stopPropagation(); aviso(!conectado ? 'Sin conexión: reconectando…' : rttMs == null ? 'Midiendo tu señal…' : 'Tu señal: ' + Math.round(rttMs) + ' ms. Con mejor señal tus golpes llegan antes.'); };
      if (getComputedStyle(marco).position === 'static') marco.style.position = 'relative';
      marco.appendChild(puntoSenal);
    }
    if (rttMs == null) return;
    puntoSenal.style.backgroundColor = rttMs < 250 ? '#3ddc5a' : rttMs <= 600 ? '#f2c230' : '#ff4a4a';
    puntoSenal.title = 'Señal: ' + Math.round(rttMs) + ' ms';
  } catch (e) {}
}
setInterval(() => { if (document.visibilityState === 'visible') mandarPing(); }, 5000);

// ── MENSAJES DEL SERVIDOR ──
let loginPend3 = null;   // premio diario guardado hasta que el jugador nuevo elija clase
function recibir(m) {
  switch (m.t) {
    case 'pong': {
      const d = Date.now() - (+m.ts || 0);
      if (m.ts && d >= 0 && d < 30000) { if (d > 3000) rttMs = Math.max(rttMs || 0, d); else rttMs = rttMs == null || rttMs > 3000 ? d : 0.7 * rttMs + 0.3 * d; pintarSenal(); }   // 3G muy mala: punto rojo, no «Midiendo…» eterno
      return;
    }
    case 'bienvenido':
      paso('bienvenido');
      try { sessionStorage.removeItem('dq_vcod'); } catch (e) {}   // llevar mi duende: el codigo ya se uso (o no valia)
      miId = m.id; yo = m.yo; reintentos = 0; if (ws) ws._listo = true;
      migrarClavesViejas(yo);
      if (yo && yo.mis && yo.mis.i === 0) paso('mis_0');   // embudo: aqui, porque 'yo' ya nunca llega con antes vacio
      enLinea3 = +m.on || 0;
      revisarVersion(+m.ver || 0);   // servidor con version nueva: recarga segura (abajo, VERSION NUEVA)
      if (llenoHasta || errorRed) { llenoHasta = 0; errorRed = false; cerrar('v-error'); }
      llenoN = 0;
      try { if (canalJuego) canalJuego.postMessage({ t: 'aqui', n: yo.nombre }); } catch (e) {}
      setTimeout(vaciarErrores, 1500);   // errores de la carga (antes de tener socket) llegan ahora al dueño
      if (!refAmigo) setTimeout(() => { if (!refAmigo) mandar({ t: 'amigos' }); }, 3000);   // el enlace de invitar listo antes de tocar 📣
      // Se guarda el nombre final (el elegido o el que puso el servidor): la proxima vez entra directo.
      setTimeout(() => despuesMision1(leyendaPrimeraVez), 2500);
      setTimeout(() => despuesMision1(historiaEntrada), 9000);   // la escena de tu capitulo, una vez (nunca una fila de tarjetas)
      setTimeout(() => despuesMision1(ofrecerInstalar), 4000);   // tras la mision 1 y el premio diario, una vez al dia
      setTimeout(() => despuesMision1(tarjetaBautizo), 6500);   // invitado: ponle nombre a tu duende (una vez)
      setTimeout(() => { if (yo && yo.clase) OBJ.alEntrar(); }, 4000);   // «Donde lo dejaste» al volver tras horas (sale a los 10 s, despues de la escena del capitulo; una vez por visita)
      if (soyInvitado) { setTimeout(avisoInvitado, 20000); if (!avisoInvT) avisoInvT = setInterval(avisoInvitado, 60000); try { localStorage.setItem('dq_mmo_nombre', yo.nombre); } catch (e) {} }
      { const cg = $('carga'); cg.classList.add('sale'); setTimeout(() => { cg.style.display = 'none'; cg.classList.remove('sale'); }, 360); }   // fundido de entrada al mundo
      cerrar('v-inicio');
      pintarHud(); pintarTemp3();
      document.body.classList.toggle('teclas-sabidas', (yo.nivel || 1) >= 15);   // PC: la linea de teclas acompaña al que empieza; luego deja de ocupar sitio
      // El nuevo entra ya como Guerrero (la recomendada): un paso menos antes de jugar. El que
      // vuelve sin clase (personaje antiguo) la elige como siempre.
      if (!yo.clase) { if (m.nuevo) { mandar({ t: 'clase', id: 'guerrero' }); setTimeout(() => despuesMision1(() => { aviso('⚔ Empiezas como Guerrero. Puedes cambiar de clase gratis hasta Nv 9 en ' + K('📖 (tecla P)', '⋯ → 📖') + ' → Clase.', 'ok', 1); setTimeout(ofrecerClases, 4000); }), 6000); } else abrirClases(); }
      // Quien cerro el juego antes de verla (ya paso la mision 1 y aun es Nv < 9): se le ofrece al volver.
      if (yo && yo.mis && yo.mis.i >= 1 && yo.nivel < 9) setTimeout(ofrecerClases, 20000);
      // Si el servidor no la pone (algo raro), a los 4 s se abre la ventana de siempre.
      if (!yo.clase && m.nuevo) setTimeout(() => { if (yo && !yo.clase && !$('v-clase').classList.contains('on')) abrirClases(); }, 4000);
      // Al nuevo se le da la bienvenida cuando ya eligio clase (antes quedaba detras de esa ventana).
      if (m.nuevo) { const bienv = () => { if (!yo || !yo.clase || avisoTapado()) return setTimeout(bienv, 1500); aviso('¡Bienvenido, ' + yo.nombre + '! Caza 5 goblins: sigue la luz amarilla ⬆', 'ok', 1); }; bienv(); }
      // Se recargo solo por una version nueva (revisarVersion): una vez, lo que gana quien vuelve.
      setTimeout(() => { try { if (sessionStorage.getItem('dq_recargaNov') !== '1') return; sessionStorage.removeItem('dq_recargaNov'); if (!yo || (yo.nivel || 1) < 3 || Date.now() - (+sessionStorage.getItem('dq_recargaVer') || 0) >= 120000) return; const nv = NOVEDADES[0]; if (nv) { aviso('✨ ¡Juego actualizado! ' + textoNov(nv, 90), 'ok'); try { localStorage.setItem('dq_3d_nov', String(nv.n)); } catch (e) {} } } catch (e) {} }, 4000);
      break;
    case 'm3':
      P.x = m.x; P.z = m.z; P.y = alturaEn(P.x, P.z); P.vx = P.vz = P.vy = 0; P.corrX = P.corrZ = 0;
      // Novato en su primera mision: la camara queda detras del duende mirando al campamento de goblins.
      try { if (yo && yo.mis && yo.mis.i === 0 && !(yo.kills > 0) && typeof CAMPOS3D !== 'undefined') { let cb = null, cd = 1e9; for (const c of CAMPOS3D) { if (c.k !== MISIONES[0].tipo) continue; const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < cd) { cd = d; cb = c; } } if (cb) { const a = Math.atan2(cb.x - P.x, cb.z - P.z); camYaw = a + Math.PI; P.ry = a; } } } catch (e) {}
      for (const o of [...otros.keys()]) quitarOtro(o);
      for (const id of [...mons.keys()]) quitarMon(id);
      for (const id of [...zonas3.keys()]) quitarZona3(id);
      for (const p of proyectiles) escena.remove(p.mesh); proyectiles = []; impactos = [];
      objetivo = 0; objetivoP = 0; autoAtk = false; dueloCon = 0; colaHab = null; gcdHasta = 0; atkBuf = 0;
      lanzando = null; $('lanzar').style.display = 'none'; quitarCorcho();
      if (P.vuela) volar(false); P.planea = false; cuevaInfo = null; zonaActual = '';
      camReal = camDist;
      pintarBarra(); pintarObjetivoP();
      for (const p of m.jugadores) agregarOtro(p);
      break;
    case 'yo': {
      const antes = yo; yo = m.yo; if (yo.vaso && yo.vaso.ms > 0) { P.au = P.au || {}; P.au.vaso = performance.now() + yo.vaso.ms; } pintarTemp3(); puntoTienda(); puntoMochila();
      if (esIAB) franjaIAB();   // tras la primera mision: pasar el duende a Chrome/Safari
      // Enlace de grupo (refGrupo3): una sola vez, ya con clase; se limpia el #g= de la barra.
      if (refGrupo3 && yo.clase) {
        const rg = refGrupo3; refGrupo3 = '';
        try { if (/(?:^#|&)g=/.test(location.hash)) { const h = location.hash.replace(/(?:^#|&)g=[a-z0-9]{6}/, '').replace(/^[#&]/, ''); history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : '')); } } catch (e) {}
        setTimeout(() => mandar({ t: 'unirmeRef', ref: rg, q: refGrupoQ }), 2500);
      }
      // Enlace con #premium (o start_param=premium de Telegram): la tienda se abre al entrar.
      if (tiendaAlEntrar && yo.clase) setTimeout(() => { if (tiendaAlEntrar && !hayVentana()) { tiendaAlEntrar = false; abrirTiendaHud('bot', focoAlEntrar); focoAlEntrar = ''; } }, 1200);   // con otra ventana abierta, se reintenta con el siguiente 'yo'
      // Nueva mision de la cadena: el Guardia Tito cuenta por que importa.
      if (antes && antes.mis && yo.mis && yo.mis.i !== antes.mis.i && LORE_MISIONES[yo.mis.i]) setTimeout(() => aviso('🛡 Tito: «' + LORE_MISIONES[yo.mis.i] + '»'), 2500);
      // Empieza un capitulo nuevo de la historia: su tarjeta de titulo (como al entrar a una zona).
      if (antes && antes.mis && yo.mis && yo.mis.i > antes.mis.i && capituloDe(yo.mis.i).n !== capituloDe(antes.mis.i).n) tarjetaCapitulo(capituloDe(yo.mis.i), 0);
      // Arco de la Receta y la Puerta: el gancho del jefe vencido y la escena del capitulo que se abre.
      if (antes && antes.mis && yo.mis && yo.mis.i > antes.mis.i) historiaAvance(antes.mis.i, yo.mis.i);
      // Termino la mision 1: ofrecer probar otra clase (sale sola si ya la vio o esta en pantalla).
      if (antes && antes.mis && antes.mis.i === 0 && yo.mis && yo.mis.i >= 1) setTimeout(ofrecerClases, 4000);
      // principiante: al completar la 3.a mision tambien sale «Listo por hoy» (una vez al dia de Lima)
      if (antes && antes.mis && yo.mis && antes.mis.i < 4 && yo.mis.i >= 4) { clearTimeout(tarjetaNoche3.t); tarjetaNoche3.t = setTimeout(tarjetaNoche3, 4000); }
      // Embudo de las primeras misiones (una vez por sesion): mis_0 al entrar de novato, el resto al llegar a cada una.
      if (yo.mis && yo.mis.i <= 5 && (antes ? antes.mis && yo.mis.i !== antes.mis.i : yo.mis.i === 0)) paso('mis_' + yo.mis.i);
      if (antes && antes.mis && yo.mis && yo.mis.i > antes.mis.i) OBJ.misionCumplida(antes.mis.i);
      if (antes && antes.diaria && yo.diaria && !antes.diaria.ok && yo.diaria.ok) OBJ.sugerir(DIARIA.nombre + ' cobrada');
      if (antes && antes.nivel < 60 && yo.nivel >= 60) { aviso('🏆 ' + LORE_NIVEL60, 'ok'); setTimeout(() => { const g = granMeta(yo, soyInvitado); if (!g.rec) aviso(g.listo ? '🥤 Ya puedes reclamar tus ' + g.litros + ' litros: toca la barra morada de la chicha.' : soyInvitado ? '🥤 Para reclamar tus ' + g.litros + ' litros de chicha falta tu cuenta gratis. Tu duende pasa contigo.' : '🥤 Para reclamar tus ' + g.litros + ' litros te falta jugar ' + g.falta + '.', 'ok'); }, 5000); }
      ALAS_MAX = (ALAS[yo.ala] || ALAS.aprendiz).vuelo; if (!antes) P.alas = ALAS_MAX; alasPropias();
      ALAS_MAX && (P.alas = Math.min(P.alas, ALAS_MAX));
      if (antes && antes.skins && yo.skins && yo.skins.length > antes.skins.length) { const nueva = yo.skins.find(k => !antes.skins.includes(k)); const sk = nueva && SKINS[nueva]; if (sk) setTimeout(() => ofrecerPresumir('¡Estrené la skin ' + (sk.nombre || nueva) + ' en Duende Quest 3D!', 'look'), 1500); }
      if (antes && (yo.skin !== antes.skin || yo.clase !== antes.clase || yo.arma !== antes.arma || JSON.stringify(yo.look) !== JSON.stringify(antes.look))) cambiarSkinPropia();
      // Al elegir clase (antes '!antes' nunca se cumplia: 'bienvenido' ya trae yo).
      // En movil no se abre solo: esta en ⋯ → 👤.
      if (antes && !antes.clase && yo.clase && !yo.look && !COMPACTO) { let visto = false; try { visto = localStorage.getItem('dq3_look_visto') === '1'; } catch (e) {} if (!visto) { const intentar = n => { if (!hayVentana() && !$('v-diario').classList.contains('on')) abrirLook(); else if (n < 20) setTimeout(() => intentar(n + 1), 1500); }; setTimeout(() => despuesMision1(() => intentar(0)), 1500); } }
      if (yo.muerto && !(antes && antes.muerto) && !P.muerto) morir();   // tras 'muerte' no borra su texto
      if (!yo.muerto) { if (P.muerto && pocionesTrasRevivir) { pocionesTrasRevivir = false; setTimeout(() => V.abrirTienda('pw'), 400); } if (P.muerto && bienvTrasRevivir) { bienvTrasRevivir = false; setTimeout(() => { if (yo && yo.puedeBienvenida && !yo.muerto && !enCombate3()) V.abrirTienda('premium', 'bienvenida', 'revivir'); }, 400); } chipBienvVisto = false; cerrar('v-muerte'); if (P.muerto && revancha3) { marcarRevancha3(); revancha3 = null; } P.muerto = false; }
      ofrecerBienvenida(antes);
      if (yo.clase) cerrar('v-clase');
      if (yo.clase && loginPend3) { const lp = loginPend3; loginPend3 = null; if (yo.mis && yo.mis.i === 0 && (lp.racha || 1) <= 1) despuesMision1(() => mostrarDiario(lp)); else setTimeout(() => mostrarDiario(lp), 900); if (lp.item && !lp.item.vendido) setTimeout(() => botinFuerte(lp.item), 3400); }
      pintarHud(); marcaPase();
      refrescarVentanas(true);
      break;
    }
    case 's3': foto(m); break;
    case 'pj3': agregarOtro(m.p); break;
    case 'pl': quitarOtro(m.id); break;
    case 'pa': { const o = otros.get(m.p); if (o) { const cambia = o.sk !== m.sk || o.cl !== (m.cl || '') || o.ar !== (m.ar || 'katana') || JSON.stringify(o.lk) !== JSON.stringify(m.lk || null); Object.assign(o, { sk: m.sk, cl: m.cl || '', ar: m.ar || 'katana', mo: m.mo || '', lk: m.lk || null, al: m.al || '', fc: m.fc || '', ra: m.ra || 0, hn: m.hn || '', hc: m.hc || 0, gm: m.gm || 0, ti: m.ti || '', tn: m.tn || '', ma: m.ma || '' }); if (cambia) rehacerFiguraOtro(o); } break; }
    case 'mundial3': mundial3 = { ...m, recibido: Date.now() }; break;
    case 'mmx3': { const o = mons.get(m.id); if (o) { o.mx = m.mx; o.hp = m.hp; } break; }   // el jefe mundial crece si llegan mas a pelear
    case 'asedio': asedio = m; if (m.activo) asedioHp = asedioHp || { p: 100, g: 100 }; else asedioHp = null; if (abismo) abismo.dueno(m.dueno); break;
    case 'enc': {
      const antes = encargos, nuevos = m.l || {};
      // Desde el segundo 'enc' (el primero es el estado al entrar): con {} vacio tambien, para el primer hito del novato.
      if (encRecibido) for (const k in nuevos) if (nuevos[k] === true && antes[k] !== true) {
        const [zk, tipo] = k.split(':');
        OBJ.sugerir('Encargo de ' + ((MAPAS[zk] || {}).nombre || 'la zona') + ' cumplido', { leve: true });
        if (tipo === 'hito') {
          try { localStorage.setItem('dq_mirador_' + zk, '1'); } catch (e) {}
          revelarNieblaZona(zk);
          aviso('✨ ' + (LORE_HITOS[zk] ? LORE_HITOS[zk] + ' ' : '') + 'El mapa de la zona se reveló: abre 🗺', 'ok');
        }
        // Vencer al jefe de la zona en su encargo devuelve su pedazo del Cantaro.
        if (tipo === 'jefe' && LORE_ZONAS[zk]) {
          const n = Object.keys(LORE_ZONAS).filter(z => nuevos[z + ':jefe'] === true).length;
          setTimeout(() => aviso(`🏺 Reliquia del Cántaro ${n}/10: ${LORE_ZONAS[zk].pedazo}`, 'ok'), 1200);
          // Las 10: el final de la historia lleva al Nucleo y al premio de verdad del nivel 60.
          if (n === 10) setTimeout(() => aviso(`🏺✨ ¡Las 10 reliquias reunidas! El Cántaro Eterno solo espera su último pedazo, que late en el Núcleo del Abismo. Al llegar a nivel ${CHICHA.nv60} se llena de nuevo… y tú te llevas ${CHICHA.litros60} litros de chicha morada de verdad.`, 'ok'), 6000);
        }
      }
      encargos = nuevos; encRecibido = true; encZonas = m.zonas || 0; $('misiones')._h = ''; break;
    }
    case 'asedioHp': asedioHp = m; if (asedio) asedio.dormido = !!m.d; break;
    case 'asedioTiro': tiroAsedio(m); break;
    case 'zona3': {
      // Pisoton: el circulo rojo se llena y, al llenarse, golpea.
      // Si llega otra vez el mismo id, se quita el anterior (evita el disco rojo fantasma).
      quitarZona3(m.id);
      if (!Number.isFinite(m.r) || !Number.isFinite(m.x) || !Number.isFinite(m.z) || m.r <= 0.5) break;
      geoZona();
      const y = alturaEn(m.x, m.z) + 0.18;
      // Disco unitario compartido (plano XZ tras rotateX): se escala en X y Z con el radio.
      const disco = new THREE.Mesh(GEO_ZONA_DISCO, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.12, depthWrite: false }));
      disco.scale.set(m.r, 1, m.r);
      const borde = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.35, m.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.9, depthWrite: false }));
      disco.position.set(m.x, y, m.z); borde.position.set(m.x, y + 0.01, m.z);
      // Filo blanco fino: el borde se distingue por luminancia (pantalla con poco brillo o daltonismo), no solo por color.
      const filo = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.05, m.r - 0.12), m.r + 0.05, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      filo.position.set(m.x, y + 0.015, m.z);
      // Anillo interno que crece de 0 a r: marca cuanto falta para el golpe.
      const anillo = new THREE.Mesh(GEO_ZONA_ANILLO, new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.85, depthWrite: false }));
      anillo.position.set(m.x, y + 0.02, m.z); anillo.scale.setScalar(0.01);
      escena.add(disco, borde, filo, anillo);
      zonas3.set(m.id, { disco, borde, filo, anillo, x: m.x, z: m.z, r: m.r, ini: performance.now(), ms: Number.isFinite(m.ms) && m.ms > 0 ? m.ms : 1500 });
      const dz = Math.hypot(P.x - m.x, P.z - m.z);
      zonaDentro[m.id] = !P.muerto && dz <= m.r;
      if (dz < m.r + 3) { aviso('¡Pisotón! Sal del círculo rojo.', 'err'); vib(dz <= m.r ? 'heavy' : 'medium'); }
      break;
    }
    case 'zona3f': quitarZona3(m.id, !m.no); break;   // no:1 = pisoton cancelado (Fase 2), sin explosion
    // Tras el pisoton el jefe queda expuesto (+25 % de daño): etiqueta sobre él para contraatacar.
    case 'expuesto': {
      const o = mons.get(m.id); if (!o || o.muereT) break;
      const y = (o.y || alturaEn(o.x, o.z)) + 4;
      numero(o.x, y, o.z, '¡AHORA!', '#ffe600', true);
      setTimeout(() => { const q = mons.get(m.id); if (q && !q.muereT) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 4, q.z, '¡Expuesto!', '#facc15'); }, 900);
      if (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 25) vib('light');
      break;
    }
    case 'md3': {
      // Un monstruo que huye (Duende Ladron, raro, jefe que se va) no cuenta
      // para el album ni explota como una muerte: solo una nubecita y un paso.
      if (m.huye) bestRec.delete(m.id); else bestDeMuerte(m.id);
      if (revancha3 && m.id === revancha3.id) revancha3 = null;   // ya cayó: no marcar una revancha vacía
      const o = mons.get(m.id); if (o) { o.muereT = performance.now(); o.st = 3; const y = (o.y || alturaEn(o.x, o.z)) + 1;
      if (m.huye) { FX.emitir(o.x, y, o.z, { n: 6, color: '#cbd5e1', vel: 1.2, vida: 0.6, grav: -1.5, tam: 1.6, forma: 'humo' }); try { sfxK('paso_h', 0.25, o.x, o.z); } catch (e) {} }
      else { if (m.id === objetivo || performance.now() - (o.predT || 0) < 600) { vib('heavy'); sacudir = Math.max(sacudir, 0.12); pausaGolpe(o, 90); } sfx('muerte', 0.36, o.x, o.z); if (Math.hypot(o.x - P.x, o.z - P.z) < 30) sfxK(Math.random() < 0.7 ? 'c_hurt' : 'c_grito', 0.32, o.x, o.z); FX.emitir(o.x, y, o.z, { n: 30, color: '#c084fc', vel: 5, vida: 0.9, grav: 3, sube: 1.5 }); FX.emitir(o.x, y, o.z, { n: 14, color: '#fde68a', vel: 1.6, vida: 1.4, grav: -2, tam: 1.6, forma: 'estrella' }); FX.emitir(o.x, y - 0.5, o.z, { n: 7, color: '#5b5266', vel: 1.1, vida: 1.1, grav: -1, tam: 3, radio: 0.4, forma: 'humo' }); }
      if (!m.huye && o.panicoT && performance.now() - o.panicoT < 1800) numero(o.x, y + 1.2, o.z, '¡Remate!', '#fbbf24');   // lo cazaste mientras huía (solo texto)
      const dj = MONSTRUOS[o.k];
      if (!m.huye && (o.j || (dj && dj.jefe)) && (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 30)) {
        numero(P.x, P.y + 3.4, P.z, '¡JEFE DERROTADO!', '#ffe600', true);
        try { finJefe(m.id); } catch (e) {}
        FX.emitir(o.x, y, o.z, { n: 60, color: '#ffd84a', vel: 4, vida: 1.2, grav: 3, sube: 2 });
        presumirTipo = 'jefe'; requestAnimationFrame(() => { try { if (presumirTipo === 'jefe') precargarPresumir(); } catch (e) {} });   // foto con la explosion
        setTimeout(() => vib('heavy'), 150); if (!(musica.remate && musica.remate('jefe'))) sfx('moneda', 0.6);   // remate musical en la escala de la zona
        const nomJ = dj && dj.nombre ? 'al jefe ' + dj.nombre : 'a un jefe';
        setTimeout(() => ofrecerPresumir('¡Vencí ' + nomJ + ' en Duende Quest 3D! ¿Te atreves?', 'jefe'), 1800);
      }
    } if (objetivo === m.id) { objetivo = 0; autoAtk = false; pintarBarra(); } break; }
    case 'mpan': {   // murio un compañero y este huye asustado 1,8 s (moral de manada)
      const o = mons.get(m.id); if (!o || o.muereT || !o.fig) break;
      o.panicoT = performance.now();
      numero(o.x, (o.y || alturaEn(o.x, o.z)) + 2.4, o.z, '💦', '#7dd3fc');
      try { sfxK(vozDe(o.k), 0.25, o.x, o.z); } catch (e) {}
      break;
    }
    case 'at3': ataqueVisto(m); break;
    case 'ph': golpeJugador(m); break;
    case 'b3': { const o = mons.get(m.de), q = m.a === miId ? P : otros.get(m.a); if (o && q) proyectil(o, q, '#c084fc'); break; }
    case 'muerte': morir(m); break;
    case 'revancha3': {
      // Llega justo tras 'muerte': completa la línea "aún tenía X %" que ya se pintó.
      revancha3 = { id: m.id, x: +m.x, z: +m.z, hasta: Date.now() + 90000 };
      const mt = $('muerte-txt'), sp = mt && P.muerto ? [...mt.children].find(e => e.textContent.includes('aún tenía') && !e.textContent.includes('revancha')) : null;
      if (sp) sp.innerHTML = sp.innerHTML.replace(/ de vida\.$/, ' de vida' + TXT_REVANCHA);
      break;
    }
    case 'tp3': case 'snap3':
      if (m.t === 'snap3' && Math.hypot(m.x - P.x, m.z - P.z) < 4) { P.corrX = m.x - P.x; P.corrZ = m.z - P.z; P.vx *= 0.5; P.vz *= 0.5; break; }
      P.x = m.x; P.z = m.z; P.y = (m.t === 'snap3' && P.vuela) ? Math.max(P.y, alturaEn(m.x, m.z) + 0.5) : alturaEn(P.x, P.z); P.corrX = P.corrZ = 0; P.vx = P.vz = 0;
      if (m.t === 'tp3' && !m.carga) { atkBuf = 0; if (P.vuela) volar(false); P.vy = 0; P.planea = false; camReal = camDist; caidaEnviada = false; }
      if (m.t === 'tp3' && m.abismo !== undefined) { zonaActual = ''; objetivo = 0; autoAtk = false; pintarBarra(); if (m.abismo) aviso('🌌 Entre las islas solo se pasa volando (' + K('V', 'VOLAR') + ') o planeando (' + K('mantén Espacio', 'mantén SALTO') + '). Las columnas de viento celestes recargan tus alas. ¡No caigas al vacío!', 'ok'); }
      if (m.t === 'tp3' && m.cueva !== undefined) {
        if (m.cueva && !cuevaInfo) paso('cueva_entra');
        cuevaInfo = m.cueva;
        cuevaT0 = m.cueva && !m.cueva.hecha ? Date.now() - Math.max(0, +m.cueva.ms || 0) : 0; cuevaFinM = null;
        if (cueva) { cueva.cofre.visible = !!(m.cueva && m.cueva.hecha); cueva.tapa.rotation.x = 0; }
        if (P.vuela) volar(false);
        objetivo = 0; autoAtk = false; pintarBarra();
        if (m.cueva) { camYaw = Math.PI; zonaActual = ''; }
      }
      break;
    case 'pvpBaja': vib('heavy'); sfx('explosion', 0.5); sacudir = Math.max(sacudir, 0.25); aviso(`⚔️ ¡Abatiste a ${m.n}!`, 'ok'); break;
    case 'cofres3': (m.l || []).forEach((ms, i) => { if (COFRES3[i]) COFRES3[i].listoEn = Date.now() + ms; }); break;
    case 'cofre3A': {
      const c = COFRES3[m.id]; if (c) { c.listoEn = Date.now() + m.ms; FX.emitir(c.x, alturaEn(c.x, c.z) + 0.8, c.z, { n: 40, color: '#ffd84a', vel: 4, vida: 1, grav: 4, sube: 2 }); }
      vib('success'); SON.tocar('cofre', { vol: 0.9 }); setTimeout(() => sfxK('monedas', 0.35), 280);
      aviso(`🧰 ¡${(NOMBRE_COFRE[m.tipo] || 'cofre').replace(/^./, x => x.toUpperCase())} abierto! +${m.oro} oro${m.pociones ? ` · +${m.pociones} pociones` : ''}${!m.item ? '' : typeof m.item === 'string' ? ' · ' + m.item : ' · ' + (RAREZAS[m.item.r] ? RAREZAS[m.item.r].nombre + ': ' : '') + (m.item.nombre || '') + (m.item.vendido ? ' (bolsa llena: vendido)' : '')}`, 'ok');
      // Objeto con rareza: el haz, la tarjeta de mejora y el presumir los pone botinFuerte (sin duplicar).
      const itC = m.item && typeof m.item === 'object' ? m.item : null;
      const fuerteC = itC && !itC.vendido && itC.r >= 2;
      if (itC && !itC.vendido) botinFuerte(itC);
      if (!fuerteC && m.tipo === 'legendario') { hazBotin('#ffae00'); setTimeout(() => ofrecerPresumir('¡Abrí un cofre legendario en lo alto del cielo en Duende Quest 3D!', 'cofre'), 1200); }
      break;
    }
    case 'temp3': temp3 = m; pintarRankPanel(); break;
    case 'on': enLinea3 = +m.n || 0; if (m.h) hoy3 = +m.h || 0; break;   // cuanta gente juega (reloj de arriba y ventana 👥)
    case 'tempFin': mostrarTempFin(m); break;
    case 'inv3yo': {
      // Medalla en vivo: bronce 1-2, plata 3-5, oro 6+ (el top 3 con plata pasa a oro al final, no se muestra).
      if (m.id && m.id !== invYo3Id) { invYo3Id = m.id; invYo3 = 0; }
      const antes = invYo3, n = m.n | 0;
      invYo3 = n;
      // Tras recargar la pagina no sabemos lo previo (antes 0 y n > 1): solo se pinta el HUD, sin aviso de subida falso.
      if (antes === 0 && n > 1) {}
      else if (antes < 6 && n >= 6) { aviso('🥇 ¡Subiste a ORO!', 'ok'); SON.tocar('logro'); }
      else if (antes < 3 && n >= 3) { aviso('🥈 ¡Subiste a PLATA en la invasión!', 'ok'); SON.tocar('logro'); }
      pintarMisiones();
      break;
    }
    case 'inv3': if (!m.on || !invasion3) invYo3 = 0; invasion3 = m.on ? { ...m, recibido: Date.now() } : null;invPre3 = !m.on && m.pre && m.zona ? { zona: m.zona, hasta: Date.now() + (m.ms || 0), gran: m.gran } : null; if (m.bend) { benditas3 = {}; for (const z in m.bend) benditas3[z] = Date.now() + m.bend[z]; } pintarMisiones(); break;
    case 'cofre3': if (cueva) { cueva.cofre.visible = true; cueva.tapa.rotation.x = 0; } if (cuevaInfo) cuevaInfo.hecha = 1; SON.tocar('cofre', { vol: 0.9 }); pintarMisiones(); break;
    case 'cuevaFin': cuevaFinM = m; if (cuevaInfo) cuevaInfo.hecha = 1; paso('cueva_ok'); if (m.primera) primeraCueva(m); if (yo && (m.hoy || 0) >= 3 && (yo.cuevaHoy || 0) < 3) { clearTimeout(tarjetaNoche3.t); tarjetaNoche3.t = setTimeout(tarjetaNoche3, 2500); } if (yo) { yo.cuevaRec = m.rec || yo.cuevaRec || 0; yo.cuevaHoy = m.hoy; } if (m.grp) aviso('👥 En grupo no cuenta para el ranking de la Cueva (solo en solitario)' + (m.pos ? ' · sigues #' + m.pos + ' de ' + m.tot + ' de tu clase' : ''), 'ok'); else if (m.pos) aviso('🏆 Puesto #' + m.pos + ' de ' + m.tot + ' de tu clase esta semana · míralo en 🏅', 'ok'); pintarMisiones(); break;
    case 'logro': aviso('🏅 Logro: ' + m.titulo + (m.oro ? ' · +' + m.oro.toLocaleString('es') + ' oro' : '') + ' (llévalo como título desde ' + (MOVIL ? '⋯ → 🏆' : '🏆 Logros') + ')', 'ok'); SON.tocar('logro'); setTimeout(() => ofrecerPresumir('¡Conseguí el logro «' + m.titulo + '» en Duende Quest 3D!', 'logro'), 1500); FX.emitir(P.x, P.y + 1.5, P.z, { n: 30, color: '#ffd84a', vel: 4, vida: 1, grav: -1 }); break;
    case 'resJefe': try { resumenJefe(m); } catch (e) {} break;
    case 'gana':
      // Golpe al Duende Ladron: solo las monedas (no es una baja: sin racha ni bestiario).
      if (m.lad) { ofrecerPresumir.lad = Date.now(); if (m.oro) { numero(P.x + 0.6, P.y + 2.2, P.z, '+' + m.oro + ' oro', '#ffd84a'); sfxK('monedas', 0.3); oroCaza3 = performance.now(); } break; }
      ganaSes++; peleaT3 = performance.now(); bestDeGana(m); clearTimeout(revisarCasi.t); revisarCasi.t = setTimeout(revisarCasi, 1600);   // tras el 'yoC' con las cazas al dia
      { const ahR = performance.now(); rachaBajas.n = ahR - rachaBajas.t < 2500 ? Math.min(8, rachaBajas.n + 1) : 0; rachaBajas.t = ahR; if (rachaBajas.n >= 1) SON.tocar('racha', { n: rachaBajas.n, vol: 0.8 }); }   // bajas seguidas: cada una un tono mas alto
      // Todo el botin de la baja en UNA linea (antes hasta 4 numeros encimados): "+12 XP · +5 oro · +1 🥤".
      const partes = [];
      if (m.xp) partes.push('+' + m.xp + ' XP');
      if (m.oro) { partes.push('+' + m.oro + ' oro'); sfxK('monedas', 0.22); }
      if (m.oro) oroCaza3 = performance.now();   // el oro de la caza ya sono: el contador no lanza la escalera de tics
      if (m.chi) partes.push('+' + m.chi + ' 🥤');   // puntos de chicha
      else if (m.chl) partes.push('🔒 🥤 Nv ' + CHICHA.nvPuntos + (soyInvitado ? ' con cuenta' : ''));   // candado: primeras cazas con Nv < 10
      // Objeto del evento de temporada (calabazas, t'anta wawas...): como en CLASSIC (client.js).
      if (m.cal) { const tp = TEMPORADAS.find(x => x.id === m.tp) || temporadaDe(); if (tp) { partes.push('+' + m.cal + ' ' + tp.emoji); if (yo) yo[tp.campo] = (yo[tp.campo] || 0) + m.cal; if (window.dqTempG) window.dqTempG.n += m.cal; pintarTemp3(); } }
      if (partes.length) numero(P.x, P.y + 3.1, P.z, partes.join(' · '), '#ffd84a');   // sin 'grande': no apaga los numeros de golpe y respeta texto grande
      if (m.item) vib('success');
      // Botin con su nombre y rareza (antes siempre decia "equipo nuevo", tambien si se vendio por bolsa llena).
      if (m.item && !m.primero) aviso('Botín: ' + (m.item.r !== undefined && RAREZAS[m.item.r] ? RAREZAS[m.item.r].nombre + ' · ' : '') + (m.item.nombre || nombreItem(m.item)) + (m.item.vendido ? ' (bolsa llena: vendido)' : ' (' + K('pulsa I', 'toca 🎒') + ' para verlo)'), 'ok');
      if (m.item && !m.item.vendido && m.primero !== 2) botinFuerte(m.item);   // primero===2: ya va equipado (no ofrecer «Equipar»)
      // Primera caza del personaje: botin garantizado (y nivel 2), con fiesta.
      if (m.primero) {
        paso('caza1');   // embudo: primera caza (ms desde el clic en entrar)
        aviso('🎉 ¡Primer botín!' + (m.item ? ' ' + (m.item.nombre || nombreItem(m.item)) + (m.primero === 2 ? ' ya va equipado.' : m.item.vendido ? ' (bolsa llena: vendido).' : ' está en tu bolsa.') : ''), 'ok');
        numero(P.x, P.y + 3.4, P.z, '¡PRIMER BOTÍN!', '#ffe600', true);
        FX.emitir(P.x, P.y + 1.5, P.z, { n: 50, color: '#ffe600', vel: 5, vida: 1.2, grav: -1 });
        FX.emitir(P.x, P.y + 1.5, P.z, { n: 30, color: '#c084fc', vel: 4, vida: 1, grav: -1 });
        setTimeout(() => vib('heavy'), 150); sfx('moneda', 0.6);   // tras el vib del botin (vib() descarta los de <70 ms)
        SON.tocar('botin', { r: 3, vol: 0.7 });
      }
      break;
    case 'lv': if (m.p === miId) {
      if (!MOVIL) aviso('¡Subiste al nivel ' + m.lv + '!', 'ok');
      const cn = $('cartel-nv');
      if (cn) {
        // Poder concreto ganado: ATQ y DEF de este nivel frente al anterior (solo lo que sube).
        let ganas = '';
        try { if (yo) { const a = statsJugador(m.lv - 1, yo.skin, yo.eq, yo.clase, yo.espec, yo.tal, yo.runas), b = statsJugador(m.lv, yo.skin, yo.eq, yo.clase, yo.espec, yo.tal, yo.runas); const da = (b.atk || 0) - (a.atk || 0), dd = (b.def || 0) - (a.def || 0); const p = []; if (da > 0) p.push('⚔ ATQ +' + da); if (dd > 0) p.push('🛡 DEF +' + dd); if (p.length) ganas = ' · <span style="color:#4ade80">' + p.slice(0, 2).join(' · ') + '</span>'; } } catch (e) {}
        cn.innerHTML = '¡NIVEL ' + m.lv + '!<small>' + (m.mx ? '❤ Vida máx ' + m.mx + ' · ' : '') + 'vida llena' + ganas + (m.lv >= 10 ? ' · 🌟 +1 talento' : '') + '</small>';
        cn.classList.remove('on'); void cn.offsetWidth; cn.classList.add('on');
      }
      numero(P.x, P.y + 3, P.z, 'NIVEL ' + m.lv, '#ffe600', true); subiNivel(m.lv); } else {
      const o = otros.get(m.p);
      if (o) {
        o.lv = m.lv;
        // Celebracion visible para los que estan cerca (sin sonido: no es tu logro).
        if (o.fig && P && Math.hypot((o.x || 0) - P.x, (o.z || 0) - P.z) < 25) {
          const oy = o.y || alturaEn(o.x, o.z);
          try { FX.emitir(o.x, oy + 1, o.z, { n: MENOS_MOV ? 10 : (MOVIL ? 18 : 30), color: '#ffd84a', vel: 4, vida: 1.2, grav: -1 }); } catch (e) {}
          numero(o.x, oy + 3, o.z, 'NIVEL ' + m.lv, '#ffe600');
        }
      }
    } break;
    case 'chicha_rec': verChicha(); break;   // ya reclamó: que vea su código y el botón de WhatsApp
    case 'toast': if (m.ofreceGrupo) { ofertaGrupo(m); break; }
      // Bono del día/semana y cofre semanal: el texto se guarda y se muestra al abrir el cofre (no estropea la sorpresa).
      if (/^(Semana|Día) completo\. Bono:|^📦 Cofre semanal \d\/3 abierto/.test(m.m || '')) { cofreSemTxt = (m.m || '').replace(/^📦 /, ''); clearTimeout(cofreSemTxtT); cofreSemTxtT =setTimeout(() => { if (cofreSemTxt) { aviso(cofreSemTxt, 'ok'); cofreSemTxt = ''; } }, 3000); break; }
      // Nombre aceptado (Ajustes o bautizo): la tarjeta de bautizo se cierra al momento, aunque la red tarde.
      if (m.miNombre) { paso('nombre_puesto'); try { localStorage.setItem('dq_bautizo_visto', '1'); } catch (e) {} const tb = $('tarjeta-bautizo'); if (tb) tb.remove(); }
      // Cuenta regresiva de Año Nuevo: cada numero reemplaza al anterior y nunca se encola (saldria tarde).
      if (/^🎆 \d+…$/.test(m.m || '')) { for (const c of [...avisos.children]) if (/^🎆 \d+…$/.test(c.textContent)) c.remove(); if (!avisoTapado() && avisos.children.length < (COMPACTO ? 2 : 4)) pintarAviso(m.m, 'ok', 2); break; }
      // Sello de zona, bestiario y Ayni: cada uno con su sonido de celebracion.
      if (/^🏅 ¡Sello de/.test(m.m || '')) { const tx = m.m; try { SON.tocar('logro'); FX.emitir(P.x, P.y + 1, P.z, { n: MOVIL ? 25 : 40, color: '#ffd84a', vel: 4, vida: 1.2, grav: -1 }); } catch (e) {} vib('success'); aviso(tx, 'ok', 1); setTimeout(() => ofrecerPresumir('¡Gané el ' + tx.replace(/^🏅 ¡/, '').replace(/[!(].*$/, '').trim() + ' en Duende Quest 3D!', 'logro'), 1500); break; }
      if (/^📖 ¡Nuevo en el bestiario/.test(m.m || '')) SON.tocar('botin', { r: 1, vol: 0.5 });
      else if (/^📖 Bestiario:/.test(m.m || '')) SON.tocar('logro', { vol: 0.6 });
      else if (/^🤝 Ayni/.test(m.m || '')) {
        SON.tocar('cura', { vol: 0.8 }); vib('light');
        // Hitos de Ayni (el servidor manda el total en m.ayni): ofrece presumirlo.
        const na = Number(m.ayni) || 0;
        if (na === 10 || na === 25 || na === 50) setTimeout(() => ofrecerPresumir('¡Ya ayudé ' + na + ' veces a otros duendes en Duende Quest 3D!', 'logro'), 1500);
      }
      else if (/^🙏 .+ te agradeció$/.test(m.m || '')) { SON.tocar('cura', { vol: 0.6 }); vib('light'); }
      if (m.ok && /^✅ Caza del día/.test(m.m || '')) { clearTimeout(tarjetaNoche3.t); tarjetaNoche3.t = setTimeout(tarjetaNoche3, 2500); }   // cobró la diaria: tarjeta «Listo por hoy»
      if (m.ok && /^(✅ (Compra realizada|Recompensa|Caza del día)|⚗️ Fabricaste|🔨 Reforjado|🧭 Volvió la expedición|Nueva montura|🎨 Tu nombre ahora|🐾 .+ te acompaña)| mejorada a \+\d+\./.test(m.m || '') && (!/\+[\d.]+ oro/.test(m.m || '') || performance.now() - oroCaza3 < 1500)) { try { sfx('moneda', 0.4); } catch (e) {} }   // la moneda suena cuando el servidor confirma, no al tocar (si el toast trae oro, ya suenan los tics del contador; tras una caza no hay tics y suena la moneda)
      if (/Kit Compañero|te invitó/.test(m.m || '')) { const tx = m.m; let n = 0; const esperaKit = () => { if (++n <= 40 && (!yo || !yo.clase || avisoTapado())) return setTimeout(esperaKit, 1500); aviso(tx, 'ok', n > 40 ? 2 : 1); try { sfx('moneda', 0.5); } catch (e) {} }; setTimeout(esperaKit, 7000); break; } if (!(modoAnuncio() && /mTON|\bSOL\b|\$DUENDE|[Ww]allet/.test(m.m || ''))) aviso(m.m, m.ok ? 'ok' : '', avisoTapado() ? 1 : 0); if (m.yapeOk) V.alPedido({ t: 'yapeOk', codigo: m.yapeOk }); if (m.ok && (m.inv || /^⚔️ Invasión rechazada/.test(m.m || ''))) { const iv = m.inv || {}, md = { b: '🥉', p: '🥈', o: '🥇' }[iv.med]; setTimeout(() => ofrecerPresumir('¡Defendimos el pueblo de una invasión en Duende Quest 3D!' + (iv.n > 1 ? ' Éramos ' + iv.n : '') + (md ? ' · Mi medalla ' + md : '') + (iv.prox > 0 ? ' · Próxima en ' + iv.prox + ' min' : ''), 'invasion'), 2000); } break;   // modo anuncio: sin avisos cripto
    // mTON ganados aqui (jefes, jefe mundial, caza del dia): antes no se avisaba nada en ORIGINS
    case 'mton': { if (yo) yo.mton = m.total; if (modoAnuncio()) break; const por = { jefe: 'por el jefe', mundial: 'por el jefe mundial', diaria: 'por la caza del día' }[m.motivo]; aviso('💎 +' + m.n + ' mTON (tienes ' + ((m.total || 0) / 1000).toLocaleString('es', { maximumFractionDigits: 3 }) + ' TON)' + (por ? ' — ' + por : ''), 'ok'); numero(P.x, P.y + 3, P.z, '+' + m.n + ' mTON', '#00eeff'); sfx('moneda', 0.5); break; }
    case 'aviso':
      if (/^¡FASE 2!/.test(m.m)) { sfxK('c_roar', 0.6); vib('heavy'); sacudir = Math.max(sacudir || 0, 0.35); aviso(m.m, 'err', 1); break; }
      if (/Furia x\d/.test(m.m)) { SON.tocar('amenaza', { vol: 0.8 }); aviso(m.m, 'err'); break; }
      if (/^💰 ¡Un Duende Ladrón huye/.test(m.m)) { sfxK('monedas', 0.7); SON.tocar('racha', { n: 6, vol: 0.9 }); vib('medium'); aviso(m.m, 'ok', 1); break; }
      if (/Ladrón/.test(m.m) && /escapó/.test(m.m)) { SON.tocar('alas', { vol: 0.6 }); if (Date.now() - (ofrecerPresumir.lad || 0) < 75000) setTimeout(() => ofrecerPresumir('😭 ¡Se me escapó un Duende Ladrón con todo su oro en Duende Quest 3D! ¿A ti también?', 'fail'), 1200); }   // fallo gracioso: solo a quien lo golpeo (el aviso va a toda la zona); compartir sigue siendo con un toque
      if (jefeLejano3(m.m)) break;
      aviso(m.m, undefined, antesMis2() && AVISO_MUNDO3.test(m.m) ? 3 : 2); break;
    case 'no':
      if (lanzando && lanzando.pre) lanzando = null;   // el lanzamiento previsto no empezo
      // "Fuera de alcance" se avisa como mucho una vez cada 3 s (mantener pulsado ATACAR reintenta cada golpe).
      if (m.m === 'Fuera de alcance.') { if (performance.now() - avisoAlcT < 3000) break; avisoAlcT = performance.now(); }
      aviso(m.m, 'err'); break;
    case 'amigos': if (m.invitados) { inv3 = m; pintarAmigos3(); } if (m.ref) { refAmigo = m.ref; window.dqRef = refAmigo; nivelAmigo = m.nivel || nivelAmigo; if (compartirPend) { const hist = compartirPend === 'h'; compartirPend = false; if (TG) compartir(hist); else { ofrecerPresumir(presumirTxt, undefined, true); aviso('Tu enlace está listo: toca el botón para enviarlo por WhatsApp.', 'ok'); } } } break;   // fuera de Telegram el navegador bloquea abrir WhatsApp sin un toque
    // Meta comunitaria «Entre todos» de la temporada (world.js tgInfo): la barra va en Logros.
    case 'tempG': if (m.tg && typeof m.tg.n === 'number') window.dqTempG = m.tg; break;
    // Año Nuevo en vivo (hora de Lima): fuegos a cada hora del 31 dic y gran final a las 00:00.
    case 'fuegos': fuegosArtificiales(false); break;
    case 'anoNuevo': fuegosArtificiales(true); vib('success'); setTimeout(() => fuegosArtificiales(false), 6500); break;
    case 'login': if (yo && yo.clase) { mostrarDiario(m); if (m.item && !m.item.vendido) setTimeout(() => botinFuerte(m.item), 2500); } else loginPend3 = m; setTimeout(() => despuesMision1(ofrecerInstalar), 4000); break;
    case 'buzon': regalo3.alBuzon(m); break;
    case 'regalo': regalo3.alRegalo(m); break;
    case 'avisoTg': {   // «Avísame por Telegram» (/mmo/js/avisotg.js)
      // Mismas reglas que avisotg.js: si la oferta no se va a pintar, no retrasa «Guarda tu duende».
      const iab = !(m && m.pedido) && !TG && /FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|BytedanceWebview/i.test(navigator.userAgent || '');
      let no7 = 0; try { no7 = +localStorage.getItem('dq_avtg_no') || 0; } catch (e) {}
      const sale = !!m && /^https:\/\/t\.me\/duendequest_bot\?start=av_[a-z0-9]{10}$/.test(m.url || '') && !iab &&!(!(m && m.pedido) && ((m && m.ya) || Date.now() - no7 < 7 * 86400000));
      if (sale) { avisoTgT3 = Date.now(); if (avisoTgT3 - ventanaAutoT >= 30000) ventanaAutoT = avisoTgT3; }
      else avisoTgT3 = -1;
      if (m && m.ya) tarjetaNoche3.tgYa = true;   // ya acepto avisos: la tarjeta de la noche no se los ofrece
      avisoTgPed3 = !!(m && m.pedido); avisoTg3.alOferta(m); break;
    }
    case 'avisoTgOk': tarjetaNoche3.tgYa = true; avisoTg3.alOk(m); break;
    case 'tareas': if (yo) {
      const semA = yo.tareas && yo.tareas.sem;   // medidor semanal anterior: si sube sin abrir cofre, mini barra de "falta poco"
      const diaA = yo.tareas && yo.tareas.dia;
      yo.tareas = m; pintarMisiones();
      if (diaA && m.dia && m.dia.l) { const nv = m.dia.l.find(t => t.ok && (diaA.l || []).some(o => o.id === t.id && !o.ok)); if (nv) OBJ.sugerir('Misión del día: ' + nv.txt, { leve: true }); }
      if (semA && m.sem && (m.sem.pts || 0) > (semA.pts || 0) && (m.sem.cof || 0) <= (semA.cof || 0)) metaCofreSem(m.sem.pts || 0, m.sem.cof || 0);
    } break;
    case 'cofreSem': cofreSem(m); break;
    case 'mae': if (yo) { yo.mae = m.n; aviso(`⭐ ¡Maestría ${m.n}!`, 'ok'); numero(P.x, P.y + 3, P.z, 'MAESTRÍA ' + m.n, '#ffd84a', true); subiNivel(0); pintarHud(); } break;
    case 'herm': hermInfo = m.h; if (yo) yo.herm = m.h ? m.h.id : null; pintarHerm(); pintarAmigos3(); break;
    case 'hermAbiertas': hermAb = Array.isArray(m.l) ? m.l : []; pintarHerm(); break;
    case 'hermInv':
      invitTipo = 'herm';
      $('invit3-t').textContent = `🛡️ ${m.de} te invita a la hermandad <${m.nombre}>.`;
      $('invit3').style.display = 'block'; vib('medium');
      clearTimeout(invitT); invitT = setTimeout(() => { $('invit3').style.display = 'none'; }, m.ms || 60000);
      break;
    case 'pase': if (yo) { yo.pase = m.pase; pintarPase(); } break;
    case 'yoC': if (yo) { Object.assign(yo, m.yo); pintarHud(); refrescarVentanas(); puntoMochila(); } break;
    case 'atkNo': sigAtk = performance.now() + (m.ms || 150); if (m.ms && atkRepN < 2) { atkRepN++; atkRepite = true; atkReintento = performance.now() + 700; } impactos = impactos.filter(i => i.t < performance.now() - 1); break;   // golpe descartado (lag o fuera de alcance): se reenvia sin repetir el tajo
    // Un monstruo va a pegarte en ~550-650 ms (m.ms): se agacha y brilla en rojo (retrocede para esquivarlo).
    case 'mpre': { const o = mons.get(m.id); if (!o || o.muereT || !o.fig) break; const ms = Math.min(800, m.ms || PRE_MON_MS); o.preT = performance.now(); o.preMs = ms; if (o.fig.modelo && o.fig.modelo.avisoRojo) o.fig.modelo.avisoRojo(ms);
      if (m.a && m.a !== miId) break;   // el golpe va a otro jugador (jefes): solo se ve el aviso rojo
      { const dMp = Math.hypot(o.x - P.x, o.z - P.z), ahMp = performance.now();
        if (dMp < 12 && !P.muerto && ahMp - mpreSonT >= 500) {   // grita su propia voz antes de pegarte (v357); sin voz, el sonido de amenaza
          mpreSonT = ahMp; const vzMp = vozDe(o.k);
          const nVz = (vzMp && SFX_K[vzMp]) || 0; let vzOk = nVz > 0; for (let i = 0; i < nVz; i++) if (!SFX['k/' + vzMp + i]) { vzOk = false; if (sonido) cargarSfx('k/' + vzMp + i); }   // sin cargar, sfx() calla: el aviso no puede quedar mudo
          if (vzOk && ahMp - (o.vozMpT || 0) > 4500) { o.vozMpT = ahMp; sfxK(vzMp, 0.32, o.x, o.z); } else SON.tocar('amenaza', { x: o.x, z: o.z, vol: 0.7 });   // la voz de cada monstruo como mucho cada 4,5 s; entre medio, el aviso corto para esquivar
          vib('light'); }
        if (dMp < 12 && !P.muerto && ahMp - avisoDirT >= 500) {   // aviso ambar en el borde: sin volumen o golpe que viene de fuera del encuadre
          let fueraMp = !sonido;
          if (!fueraMp) { try { const vMp = new THREE.Vector3(o.x, (o.y || alturaEn(o.x, o.z)) + 1, o.z).project(camara); fueraMp = vMp.z > 1 || Math.abs(vMp.x) > 0.95 || Math.abs(vMp.y) > 0.95; } catch (e) {} }
          if (fueraMp) { avisoDirT = ahMp; avisoDir(o, ms); } }
        if (!esqTuto && dMp < 9 && !P.muerto) esqPista(ms); }
      break; }
    // Saliste de su alcance tras el aviso rojo (tope: 1 cada 1,5 s).
    case 'esqp': { mesqT = performance.now(); esqAprendida(true); if (P.muerto) break; numero(P.x, P.y + 2.3, P.z, '¡Esquiva perfecta! Crítico listo', '#fde047', true); SON.tocar('esquivado'); vib('medium'); break; }   // ultimos 200 ms del aviso: +recurso y critico (el "¡Esquivado!" que sigue no se repite)
    case 'mesq': { const ah = performance.now(); if (!esqTuto && !P.muerto && esqHasta > ah) esqAprendida(true);   // salio del golpe rojo con 💨 reciente: esquiva aprendida
      if (P.muerto || ah - mesqT < 1500) break; mesqT = ah; numero(P.x, P.y + 2, P.z, '¡Esquivado!', '#4ade80', true); SON.tocar('esquivado'); vib('light'); break; }
    case 'habNo': gcdHasta = 0; break;
    case 'chat': lineaChat(m); break;
    case 'gesto': if (GESTOS[m.id]) mostrarGesto(m.p, m.id); break;
    case 'marca': mostrarMarca(m); break;   // social.js marca(): pilar de luz 📍 de 6 s
    case 'grupo': grupo3 = m.g; pintarGrupo(); pintarAmigos3(); break;
    case 'contactos': contactos3 = m.l || []; pintarAmigos3(); pintarObjetivoP(); break;
    case 'quien': quien3 = m.r || []; pintarAmigos3(); break;
    // Alas agotadas segun el servidor: a planear (antes caia en picado, mortal sobre el vacio).
    // Lanzamiento de un jefe (Sorbo del Cantaro): barra en su marco y aviso sobre su cabeza.
    case 'mcast': {
      const o = mons.get(m.id); if (!o) break;
      const nom = (MONSTRUOS[o.k] || {}).nombre || 'El jefe';
      // Como cortarlo segun lo que tienes: tu habilidad que interrumpe si ya la tienes; si no, pegarle fuerte.
      const corte = () => { const h = yo && yo.clase ? habsDe(yo.clase).find(x => x.interrumpe) : null; return h && (yo.nivel || 1) >= h.nv ? `¡Usa ${h.nombre} para cortarlo!` : '¡Pégale fuerte mientras bebe para tirarle el cántaro!'; };
      if (m.ms > 0) { o.cast = { ini: performance.now(), fin: performance.now() + m.ms, n: m.n || 'Hechizo' }; if (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 25) aviso(`🔮 ${nom} lanza ${o.cast.n}: ${corte()}`, 'err'); }
      else {
        o.cast = null;
        if (m.cortado && Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`✋ ¡${nom} no pudo beber: lanzamiento interrumpido!`, 'ok');
        if (m.cura && m.sg) { if (m.hp) o.hp = m.hp; FX.emitir(o.x, alturaEn(o.x, o.z) + 1, o.z, { n: 14, color: '#4ade80', vel: 2, vida: 0.8, grav: -3, radio: 1, tam: 1 }); if (Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`🩸 ${o.ra || nom} se curó al caer su esbirro: ¡mátalos a la vez o ve primero por el élite!`, 'err'); }
        else if (m.cura) { if (m.hp) o.hp = m.hp; if (Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`🥤 ${nom} bebió chicha robada y se curó. La próxima vez: ${corte()}`, 'err'); }
      }
      break;
    }
    // Misiones secundarias (mmo/js/secundarias.js): progreso y final con su historia.
    case 'sec': secundarias = m.l || {}; $('misiones')._h = ''; break;
    case 'secFin': { const q = SECUNDARIAS.find(x => x.id === m.id); if (q) { if (sinConfesar(q)) npcDice(q.quien, q.inicio, q.emoji); npcDice(q.quien, q.fin, q.emoji, false, q.sigue); sfxK('monedas', 0.4); vib('success'); historiaSecFin(q, m); OBJ.secundariaCumplida(q); } break; }
    // El Caso del Traidor (mmo/js/caso.js): pista hallada, final y estado del cuaderno.
    case 'caso': caso = { p: m.p || [], s: m.s || '', sN: m.sN || 0, res: m.res || 0 }; $('misiones')._h = ''; if ($('v-diario').classList.contains('on') && $('diario-c').querySelector('[data-caso]')) verCaso(); break;
    case 'pista': { const q = PISTAS.find(x => x.id === m.id); if (q && !m.calla) { npcDice('Tu cuaderno', [q.emoji + ' Pista ' + m.n + '/' + PISTAS.length + ': ' + q.titulo + '.', q.texto, q.efecto + '.'], '🕵', false, 'Premio: +' + (m.oro || q.oro) + ' oro' + Object.entries(m.mat || {}).map(([k, n]) => ' · +' + n + ' ' + ((MATERIALES[k] || {}).nombre || k)).join('') + '. Míralo en La Leyenda: El Caso del Traidor.'); vib('light'); } break; }
    case 'casoDia': npcDice('Tu cuaderno', 'Se puso al día con lo que ya viviste: ' + m.n + (m.n === 1 ? ' pista' : ' pistas') + ' y +' + m.oro + ' oro.', '🕵', false, 'Míralo en La Leyenda: El Caso del Traidor.'); break;
    case 'casoFin': npcDice('Tu cuaderno', ['El caso está resuelto.', m.txt || ''], '🕵', false, 'Lee la verdad entera en La Leyenda: El Caso del Traidor.'); break;
    case 'corriente': P.alas = ALAS_MAX; aviso('🌬 Corriente de viento: ¡alas recargadas!', 'ok'); sfxK('tela', 0.4); vib('light'); break;
    case 'alasAgotadas': if (P.vuela) { volar(false); P.planeoAuto = true; aviso('Tus alas se cansaron: planeas hacia el suelo.'); } P.alas = 0; break;
    case 'pica': pica = performance.now() + m.ms; aviso('🎣 ¡Pica! ' + K('Pulsa E', 'Toca ¡TIRAR!') + ' para tirar', 'ok'); SON.tocar('splash', { vol: 1, fuerza: 0.9 }); picaRecibida = performance.now(); vib('heavy'); break;
    case 'pescado': quitarCorcho(); SON.tocar('splash', { vol: 0.6, fuerza: 0.5 });
      if (m.perfecto) { sfxK('monedas', 0.5); vib('heavy'); numero(P.x, P.y + 3, P.z, '¡Perfecto!', '#7dd3fc', true); } else sfx('moneda', 0.5);
      break;
    case 'duelo':
      if (m.a === miId || m.b === miId) {
        dueloCon = m.a === miId ? m.b : m.a;
        objetivo = 0; objetivoP = dueloCon; autoAtk = false; pintarBarra(); pintarObjetivoP();
        aviso('⚔️ ¡Duelo! Empieza en 3 segundos. ' + K('Pulsa 1', 'Toca ATACAR') + ' para atacar.', 'ok');
        sfx('boton', 0.5);
      }
      break;
    case 'dueloFin':
      if (m.a === miId || m.b === miId) { dueloCon = 0; autoAtk = false; pintarBarra(); }
      aviso(m.m, m.g === miId ? 'ok' : '');
      if (m.g === miId && (m.a === miId || m.b === miId)) setTimeout(() => ofrecerPresumir('¡Gané un duelo en Duende Quest 3D! ¿Te atreves conmigo? ⚔️', 'duelo'), 1200);
      break;
    case 'atp3': { const de = m.p === miId ? P : otros.get(m.p), a = m.tg === miId ? P : otros.get(m.tg); if (de && !(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (de && a && m.v && !(de === P && performance.now() - (P.proyLocalT || 0) < 700)) proyectil(de, a, '#f0abfc'); break; }
    case 'nodos3': for (const [i, ms] of m.l) { if (!NODOS[i]) continue; nodoListo.set(i, performance.now() + ms); mostrarNodo(NODOS[i], false); } break;
    case 'recogido3': if (NODOS[m.i]) { nodoListo.set(m.i, performance.now() + m.en); mostrarNodo(NODOS[m.i], false); sfx('moneda', 0.3); } break;
    // Alguien busca grupo para la Cueva de los Goblins: aviso con «Unirme» (lfgUnir, como CLASSIC).
    // Peleando, muerto, en la cueva o ya en grupo se descarta (no se encola).
    case 'lfgAviso': {
      if (m.id !== 'cueva' || grupo3 || !yo || yo.muerto || cuevaInfo || enCombate3()) break;
      const d = document.createElement('div'); d.className = 'ok'; d._prio = 1;
      d.style.pointerEvents = 'auto';
      d.textContent = `📢 ${m.n} (Nv ${m.nv}) busca grupo para la ${m.nombre || 'Cueva de los Goblins'} (${m.m}/${m.mx || 5}) `;
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = '👥 Unirme';
      b.style.cssText = 'margin:6px 0 0;display:block;width:100%;min-height:40px;font-size:14px';
      b.onclick = e => { e.stopPropagation(); if (!grupo3) mandar({ t: 'lfgUnir', pid: m.pid }); d.remove(); try { sfx('boton', 0.3); } catch (er) {} };
      d.appendChild(b);
      for (const a of [...avisos.children]) if (a._lfg) a.remove();   // uno a la vez
      d._lfg = 1;
      avisos.appendChild(d);
      try { sfx('moneda', 0.3); } catch (er) {}
      setTimeout(() => d.remove(), 30000);
      break;
    }
    case 'reto': case 'invitacion': {
      invitTipo = m.t === 'reto' ? 'duelo' : 'grupo';
      if (m.t === 'invitacion') for (const a of [...avisos.children]) if (a._ofDe === m.de) a.remove();   // ya te invito: fuera su «¿Hacen grupo?» (si no, se invitaban los dos a la vez)
      $('invit3-t').textContent = m.t === 'reto' ? `⚔️ ${m.de} (Nv ${m.nv}) te reta a un duelo. Amistoso: nadie muere ni pierde objetos ni oro · sin pociones · nivel igualado · si te alejas, pierdes.` : `${m.de} (Nv ${m.nv}) te invita a su grupo.`;
      $('invit3').style.display = 'block';
      clearTimeout(invitT); invitT = setTimeout(() => { $('invit3').style.display = 'none'; }, m.ms || 30000);
      sfx('boton', 0.4);
      break;
    }
    case 'cd':
      if (String(m.id).startsWith('h_')) cdHab[m.id.slice(2)] = { fin: performance.now() + m.hasta, ms: m.hasta };
      else cdPoder[m.id] = performance.now() + m.hasta;
      break;
    case 'pedidoSol': case 'factura': case 'pedidoYape': V.alPedido(m); if (window.dqMedir) window.dqMedir('InitiateCheckout', {}, m.codigo); break;   // pixel de Meta con permiso (js/medir.js); mismo eventID que el servidor
    case 'pw': if (m.p === miId) { if (m.i === 0) SON.tocar('cura', { vol: 0.8 }); else sfx(m.i === 2 ? 'explosion' : 'boton', 0.4); } break;   // la pocion: campanitas de curacion
    case 'cast':
      if (m.p === miId) { atkBuf = 0; lanzando = { id: m.id, ini: performance.now(), fin: performance.now() + m.ms }; $('lanzar').style.display = 'block'; $('lanzar-t').textContent = m.id === 'montar' ? 'Invocar montura' : m.id === 'recolectar' ? 'Recolectando…' : m.id === 'pescar' ? 'Pescando… (' + K('E', '¡TIRAR!') + ' para tirar cuando pique)' : (habPorId(m.id) || {}).nombre || '';
        if (m.id === 'pescar') ponerCorcho(); }
      else { const o = otros.get(m.p); if (o) o.lanza = performance.now() + m.ms; }
      break;
    case 'castFin':
      if (m.p === miId) { lanzando = null; $('lanzar').style.display = 'none'; quitarCorcho(); }
      else { const o = otros.get(m.p); if (o) o.lanza = 0; }
      break;
    case 'hb': efectoHab(m); break;
    case 'vasoTomado': try { SON.tocar('cura'); vib('success'); FX.emitir(P.x, (P.y || alturaEn(P.x, P.z)) + 1, P.z, { n: MOVIL ? 20 : 34, color: '#c084fc', vel: 2.4, vida: 1.2, grav: -2.5, radio: 0.6, tam: 1.1 }); FX.brillo(P.x, (P.y || alturaEn(P.x, P.z)) + 1.1, P.z, '#a855f7', true); } catch (e) {} break;
    case 'cu': { const q = m.p === miId ? P : otros.get(m.p); if (q) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.4, q.z, '+' + m.n, '#4ade80', m.c); break; }
    case 'au': {
      const fin = m.ms < 0 ? Infinity : m.ms === 0 ? 0 : performance.now() + m.ms;
      const u = m.k === 'm' ? mons.get(m.id) : m.id === miId ? P : otros.get(m.id);
      if (u) { u.au = u.au || {}; if (fin) u.au[m.a] = fin; else delete u.au[m.a]; }
      break;
    }
    case 'res': if (m.p === miId) { aviso((m.de || 'Alguien') + ' te resucitó.', 'ok'); cerrar('v-muerte'); SON.tocar('cura'); vib('success'); try { FX.emitir(P.x, P.y + 1, P.z, { n: MOVIL ? 20 : 32, color: '#4ade80', vel: 2.5, vida: 1.1, grav: -2.5, radio: 0.6, tam: 1.1 }); } catch (e) {} } break;
    case 'tiendaTemp': V.alTiendaTemp(m); break;   // tienda de la fiesta (puesto de la Abuela)
    case 'ranking': rankDatos = m; if (npcAbierto === 'ranking') pintarRanking(m.r); pintarRankPanel(); break;
    case 'heredar': preguntarHeredar(m); break;
    case 'vincCod': if (m.inv) pintarLlevar(m); break;
    case 'invTraer': try { sessionStorage.setItem('dq_vcod', m.cod); } catch (e) {} aviso('📲 Trayendo a ' + (m.nombre || 'tu duende') + '…', 'ok', 1); setTimeout(() => location.reload(), 900); break;
    case 'vincConfirmar': if (confirm(`Esta cuenta ya tiene a ${m.nombre} (Nv ${m.nivel}). Si sigues, jugarás con ${m.destino} (Nv ${m.nivelDestino}) y ${m.nombre} quedará archivado (el equipo puede recuperarlo). ¿Seguir?`)) mandar({ t: 'vincUsar', cod: m.cod, forzar: true }); break;
    case 'vincOk': aviso('🔗 ¡Listo! Entrando con ' + m.nombre + '…', 'ok', 1); setTimeout(() => location.reload(), 1500); break;
    case 'err':
      // En Telegram no se cae en silencio a un invitado nuevo de nivel 1 (la sesion de mas de 24 h caduca): se pide reabrir.
      if (m.auth && m.auth !== 'inv' && TG) { error('Tu sesión de Telegram caducó. Cierra el juego y vuelve a abrirlo desde el bot: entrarás con tu duende.', false, { tg: true }); return; }
      if (m.dup) { error(m.m || 'Tu duende se abrió en otro dispositivo o pestaña.', false, { dup: true }); return; }
      if (m.auth && m.auth !== 'inv' && !forzarInvitado) { forzarInvitado = true; aviso('No pudimos verificar tu cuenta: entras como invitado.', 'err'); return; }
      // Mundo lleno o demasiadas conexiones desde tu red: se dice por que, se reintenta
      // solo (cada vez un poco mas tarde, con azar) y se ofrece el arcade mientras.
      if (m.lleno) { avisoLleno(m); return; }
      // Rechazo suave (servidor ocupado, la cuenta ya estaba entrando, prueba de
      // trabajo): el servidor cierra y onclose vuelve solo pasado 'reintentar' ms.
      if (m.reintentar && !m.fatal) {
        retrasoRec = Math.min(30000, Math.max(300, +m.reintentar || 1500));
        if (m.pow) { powCeros = Math.max(1, Math.min(5, m.pow | 0)); powNonce = null; }
        else aviso(m.m, 'err');
        return;
      }
      if (m.fatal) {
        error(m.m || 'Desconectado.');
        // Inactividad: tocar o pulsar una tecla vuelve a entrar (lo promete el aviso; antes no hacia nada).
        if (m.inactivo) { const volver = () => { removeEventListener('pointerdown', volver, true); removeEventListener('keydown', volver, true); location.reload(); }; setTimeout(() => { addEventListener('pointerdown', volver, true); addEventListener('keydown', volver, true); }, 500); }
      }
      else if (m.m) aviso(m.m === 'Error del servidor' ? 'Algo falló. Inténtalo otra vez en unos segundos.' : m.m, 'err', 1);
      break;
  }
}

// ── JUGADORES Y MONSTRUOS ──
let lookEditor = null;
const lookYo = () => lookEditor || (yo && yo.look) || LOOK_BASE;
// Probador de la tienda: skin puesta solo en tu pantalla (nunca se manda al servidor).
let skinPrueba = null;
let monturaPrueba = null;   // probador de monturas: id que ves bajo tu duende (solo en tu pantalla)
const skinYo = () => (skinPrueba && SKINS[skinPrueba] ? skinPrueba : yo.skin);
// Grado del equipo que se ve en el duende (0-3): la rareza mas alta puesta (Comun 0 ... Legendario 3)
// o la forja del arma (+4 = 1, +7 = 2, +10 maximo = 3). Solo en tu pantalla, no va al servidor.
function gradoYo() {
  let rz = 0;
  for (const it of Object.values(yo.eq || {})) if (it && RAREZAS[it.r]) rz = Math.max(rz, Math.min(3, it.r | 0));
  const fz = Number((yo.forja || {})[yo.arma || 'katana']) || 0;
  return Math.min(3, Math.max(rz, fz >= 10 ? 3 : fz >= 7 ? 2 : fz >= 4 ? 1 : 0));
}
const claveYo = () => skinYo() + '|' + (yo.clase || '') + '|' + (yo.arma || '') + '|' + JSON.stringify(lookYo()) + '|g' + gradoYo();
async function cambiarSkinPropia() {
  if (!yo) return;
  const clave = claveYo(), sk = skinYo();
  if (P.cargando === clave || (P.fig && P.skin === clave)) return;
  P.cargando = clave;
  const gr = gradoYo(), cgr = (RAREZAS[gr] || {}).color || null;   // grado 2 = Épico (violeta), 3 = Legendario (dorado)
  const f = figuraModelo(() => crearDuende({ skin: sk, clase: yo.clase || null, arma: yo.arma || 'katana', look: lookYo(), grado: gr, colorGrado: cgr, ligero: POBRE || CAL === 'baja' })) || await figuraJugador(sk);
  P.cargando = '';
  if (f && yo && claveYo() !== clave) { f.quitar(); cambiarSkinPropia(); return; }   /* la prueba terminó mientras cargaba */
  if (!f) return;
  if (P.fig) P.fig.quitar();
  P.fig = f; P.skin = clave;
}
async function agregarOtro(p) {
  if (!p || p.id === miId || p.p === miId) return;
  const id = p.id || p.p;
  quitarOtro(id);
  const o = { id, x: p.x, z: p.z, tx: p.x, tz: p.z, ry: p.r || 0, a: 0, hp: p.hp, mx: p.mx, n: p.n, lv: p.lv, cl: p.cl || '', sk: p.sk || 'comun', ar: p.ar || 'katana', mo: p.mo || '', lk: p.lk || null, al: p.al || '', fc: p.fc || '', ra: p.ra || 0, hn: p.hn || '', hc: p.hc || 0, gm: p.gm || 0, ti: p.ti || '', tn: p.tn || '', ma: p.ma || '', muerto: !!p.muerto, fig: null, lbl: etiqueta('pj'), f: 1 };
  otros.set(id, o);
  colaFig.push(o);   // se arma en bucle(), pocas por cuadro
}
// Cola de construccion de figuras: al llegar a un pueblo lleno entran decenas de
// pj3 seguidos; se arman 3 por cuadro (los mas cercanos primero) en vez de todas de golpe.
const colaFig = [];
function armarColaFig() {
  if (!colaFig.length) return;
  if (colaFig.length > 3) colaFig.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  for (let i = 0; i < 3 && colaFig.length; i++) { const o = colaFig.shift(); if (otros.get(o.id) === o && !o.fig) rehacerFiguraOtro(o); }
}
async function rehacerFiguraOtro(o) {
  const f = figuraModelo(() => crearDuende({ skin: o.sk, clase: o.cl || null, arma: o.ar || 'katana', look: o.lk || LOOK_BASE })) || await figuraJugador(o.sk);
  if (!otros.has(o.id)) { if (f) f.quitar(); return; }
  if (o.fig) o.fig.quitar();
  o.fig = f;
}
function quitarOtro(id) { const o = otros.get(id); if (!o) return; if (objetivoP === id) objetivoP = 0; quitarMascota(o); if (o.fig) o.fig.quitar(); if (o.alas) quitarAlas(o.alas); o.lbl.remove(); otros.delete(id); }
async function agregarMon(d) {
  if (mons.has(d.id)) return;
  const def = MONSTRUOS[d.k];
  if (!def) return;
  const st = statsMonstruo(d.k, d.nv);
  const o = { id: d.id, k: d.k, nv: d.nv, x: d.x, z: d.z, tx: d.x, tz: d.z, ry: 0, hp: d.hp, mx: d.mx, st: 0, j: d.j, fig: null, lbl: etiqueta(d.j ? 'jefe' : ''), nace: performance.now(), muereT: 0, golpeT: 0, f: 1 };
  mons.set(d.id, o);
  if (d.hp <= 0) o.muereT = performance.now() - 800;   // llega ya muriendo: solo el final de la animacion
  fijarDestino(o, d.x, d.z);
  o.mu = !!d.mu; o.ra = d.ra || ''; o.ti = d.ti || ''; o.iv = !!d.iv; o.af = d.af || ''; o.la = !!d.la; o.noct = d.noct ? 1 : 0;
  if (d.k === 'puerta_nucleo') {
    o.fig = new Figura3D(modeloPuerta(), 1);
    solidosExtra = solidosExtra.filter(x => x.id !== d.id).concat([-2.2, 0, 2.2].map(dz => ({ x: d.x, z: d.z + dz, r: 1.5, id: d.id })));
    return;
  }
  const esc3 = d.mu ? 2.4 : d.ra ? 1.35 : d.j ? 1.15 : 1;
  // Élite raro: el mismo aura de suelo que los jefes, en su color (algo mas ancha).
  o.fig = figuraModelo(() => { const m = crearMonstruo(d.k); if (d.ra && !m.jefe && m._aura) { m._aura(d.ti || '#ffd84a'); const me = m.mallas[m.mallas.length - 1]; if (me) { me.scale.multiplyScalar(1.15); me.userData.reposo[2] = me.scale.clone(); } } return m; }, esc3) || await figuraHoja(def.hoja, st.alto * esc3);
  if (mons.get(d.id) !== o) { if (o.fig) { o.fig.quitar(); o.fig = null; } return; }   // llegó otro con el mismo id mientras cargaba: este se descarta sin dejar fantasma
  if (d.noct && mons.get(d.id) === o) { tenirNocturno(o); avisoNocturno(); }
}
// Monstruo nocturno (servidor: 1 de cada 10 comunes de noche, +25 % de oro): mismo modelo
// con sus materiales clonados y teñidos de morado (sin luces ni sombras nuevas).
const MORADO_NOCT = new THREE.Color('#9b6bff');
function tenirNocturno(o) {
  const obj = o.fig && o.fig.modelo && o.fig.modelo.obj;
  if (!obj) return;
  const hechos = new Map();
  o.noctMats = [];
  const tenir = m => {
    if (!m || !m.color || (!m.isMeshLambertMaterial && !m.isMeshStandardMaterial && !m.isMeshPhongMaterial)) return m;
    if (hechos.has(m)) return hechos.get(m);
    const c = m.clone();
    c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey;
    c.userData = {};
    c.color.lerp(MORADO_NOCT, 0.45);
    if (c.emissive && !(c.emissiveIntensity >= 0.9)) { c.emissive.copy(MORADO_NOCT); c.emissiveIntensity = Math.max(c.emissiveIntensity || 0, 0.18); }
    hechos.set(m, c); o.noctMats.push(c);
    return c;
  };
  obj.traverse(me => {
    if (!me.isMesh) return;
    if (Array.isArray(me.material)) me.material = me.material.map(tenir); else me.material = tenir(me.material);
  });
}
// Aviso una vez al dia (dia de Lima de hace 6 h): la noche del mundo dura 20 min y vuelve cada 48, avisar en cada una cansaria.
let noctAvisada = '';
function avisoNocturno() {
  const k = new Date(Date.now() - 11 * 3600e3).toISOString().slice(0, 10);
  if (noctAvisada === k) return;
  noctAvisada = k;
  try { if (localStorage.getItem('dq3_noctAviso') === k) return; localStorage.setItem('dq3_noctAviso', k); } catch (e) {}
  aviso('🌙 Monstruos nocturnos rondan: dan +25% de oro');
}
// La Puerta del Nucleo: reja de hierro entre dos torres del kit de castillo
// (o un bloque si el kit no cargo). Encaja en el hueco oeste de la muralla.
function modeloPuerta() {
  const obj = new THREE.Group();
  let mesh;
  if (KIT) {
    const t = z => [['c_tower-square-base', 0], ['c_tower-square-mid', 1.01], ['c_tower-square-top-roof', 2.02]].map(([n, h]) => ({ n, y: h * 2.6, z, s: 2.6 }));
    mesh = new THREE.Mesh(KIT.fundir([{ n: 'c_metal-gate', sx: 8, sy: 8, sz: 6.4 }, ...t(-3.6), ...t(3.6)]), KIT.material);
  } else { mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 5.6), new THREE.MeshLambertMaterial({ color: 0x4b4560 })); mesh.position.y = 3; }
  if (Q.sombras) mesh.castShadow = true;
  obj.add(mesh);
  const x0 = mesh.position.x;
  // Al caer se hunde (y suelta polvo con el estallido de md3).
  return { obj, alto: 6, r: { tAtk: 0.35 }, animar(e, tt) { mesh.position.y = (KIT ? 0 : 3) - (e === 'muere' ? Math.min(7, tt * tt * 6) : 0); }, golpe() { mesh.position.x = x0 + 0.18; setTimeout(() => { mesh.position.x = x0; }, 90); }, dispose() {} };
}
function quitarMon(id) { solidosExtra = solidosExtra.filter(x => x.id !== id); const o = mons.get(id); if (!o) return; if (o.fig) o.fig.quitar(); if (o.noctMats) { for (const m of o.noctMats) m.dispose(); o.noctMats = null; } o.lbl.remove(); mons.delete(id); if (objetivo === id) { objetivo = 0; autoAtk = false; pintarBarra(); } }
function foto(m) {
  const enFoto = new Set();
  for (const [id, x, z, ry, a, hp, mx, muerto, h] of m.p) {
    enFoto.add(id);
    if (id === miId) continue;
    const o = otros.get(id);
    if (!o) continue;
    fijarDestino(o, x, z); o.ry = ry; o.a = a; o.hp = hp; o.mx = mx; o.muerto = !!muerto; o.h = h || 0;
  }
  for (const o of [...otros.values()]) { if (enFoto.has(o.id)) o.falta = 0; else if ((o.falta = (o.falta || 0) + 1) > 10) quitarOtro(o.id); }
  if (m.n) for (const d of m.n) agregarMon(d);
  for (const [id, x, z, ry, hp, st] of m.m) {
    const o = mons.get(id);
    if (!o) continue;
    fijarDestino(o, x, z); o.ry = ry; o.hp = hp; o.st = st;
    // st 3 = muriendo en el servidor: si el md3 no nos llego (entro en vista ya muerto), se marca aqui
    if (st === 3 && !o.muereT) { o.muereT = performance.now(); bestDeMuerte(id); if (objetivo === id) { objetivo = 0; autoAtk = false; pintarBarra(); } }
  }
  if (m.q) for (const id of m.q) quitarMon(id);
  if (yo) { yo.hp = m.hp; yo.rec = m.rec; P.rec = m.rec; yo.combo = m.cb || 0; pintarVida(); }
}
// ── INTERPOLACION ──
// Cada foto (cada ~200 ms) fija un tramo: desde donde se dibuja ahora hasta la
// posicion nueva, recorrido a velocidad constante en lo que tarda la foto
// siguiente (con hasta un 20 % de extrapolacion si se retrasa). Los saltos
// grandes (teletransporte, carga) se aplican al instante.
function fijarDestino(o, x, z) {
  const t = performance.now();
  if (o.tx === undefined || Math.hypot(x - o.x, z - o.z) > 10) { o.x = o.px = x; o.z = o.pz = z; }
  else { o.px = o.x; o.pz = o.z; }
  o.tx = x; o.tz = z;
  o.dur = clamp(t - (o.tU || t - 200), 120, 320); o.tU = t; o.t0 = t;
  o.vx = (x - o.px) / o.dur * 1000; o.vz = (z - o.pz) / o.dur * 1000;
}
function avanzarHacia(o, t) {
  if (o.t0 === undefined) return;
  const k = Math.min(1.15, (t - o.t0) / o.dur);
  const ix = o.px + (o.tx - o.px) * k, iz = o.pz + (o.tz - o.pz) * k;
  // Se sigue al punto interpolado con un filtro suave: con la red irregular del movil
  // el salto entre un paquete y el siguiente (y el pequeño exceso al extrapolar) se veia a tirones.
  const dt = Math.min(0.1, (t - (o.tR || t)) / 1000); o.tR = t;
  if (!dt || Math.hypot(ix - o.x, iz - o.z) > 6) { o.x = ix; o.z = iz; }
  else { const f = 1 - Math.exp(-dt * 16); o.x += (ix - o.x) * f; o.z += (iz - o.z) * f; }
  if (k >= 1.15) { o.vx = o.vz = 0; }
}
function ataqueVisto(m) {
  const o = mons.get(m.tg);
  if (!o) return;
  const de = m.p === miId ? P : otros.get(m.p);
  const corteYa = m.p === miId && P.corteLocal && P.corteLocal.tg === m.tg && performance.now() - P.corteLocal.t < 1500;
  const local = m.p === miId && (corteYa || performance.now() - (P.atkT || 0) < 600);   // el corte ya sono al tocar (golpeManual): no repetirlo
  if (corteYa) P.corteLocal = null;   // una sola confirmacion omitida por toque
  if (de) { if (!(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (m.v && !(de === P && performance.now() - (P.proyLocalT || 0) < 700)) proyectil(de, o, CLASES[(m.p === miId ? yo.clase : de.cl)] ? CLASES[(m.p === miId ? yo.clase : de.cl)].color : '#fff'); }
  if (m.d > 0) o.hp = Math.max(0, o.hp - m.d);
  if (m.d > 0 && Math.hypot(o.x - P.x, o.z - P.z) < 45) FX.golpe(o.x, (o.y || alturaEn(o.x, o.z)) + 1.1, o.z, { critico: m.c, color: m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff1c1' });
  // 3.er golpe del combo (el servidor lo marca con f): numero grande naranja con '!'.
  const fuerte = !!(m.f && m.p === miId && m.d > 0 && !m.c);
  if (m.p === miId || (o.id === objetivo && !(o.fig && o.fig._cerca === false))) {   // un monstruo oculto por el tope no suelta números ajenos
    // Golpe a su debilidad (servidor w): ¡DÉBIL! verde-amarillo, 30 % más grande y un clic agudo.
    // Golpe al jefe expuesto (servidor x, tras ¡AHORA!): ¡CONTRA! amarillo, grande, con peso.
    if (m.x && m.p === miId && m.d > 0) { numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.4, o.z, '¡CONTRA! ' + m.d, '#ffe600', true); sfxK('g_critico', 0.45); vib('medium'); sacudir = Math.max(sacudir, 0.25); pausaGolpe(o, 90); }
    else if (m.w && m.d > 0) { numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, '¡DÉBIL! ' + m.d, '#c8ff3a', m.c || fuerte ? 29 : 21); if (m.p === miId) SON.tocar('clic', { vol: 0.9 }); }
    else if (fuerte) numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, m.d + '!', '#ffb347', true);
    else numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, (m.c ? '¡' : '') + m.d + (m.c ? '!' : ''), m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff', m.c, m.c ? undefined : 'm' + o.id + ':' + m.p);
    if (fuerte && !m.x) { sfxK('g_critico', 0.3); pausaGolpe(o, 60); }
    if (m.p === miId) {
      // Cada arma pesa distinto al conectar: vibracion, sacudida y tono del corte (pesoArma).
      const pa = pesoArma();
      musica.combate(true); if (m.c) vib(TG && TG.HapticFeedback ? 'rigid' : 'medium'); else if (!autoAtk) vib(pa.v);
      if (!local || m.c || m.v) sfx(m.c ? 'corte2' : 'corte', 0.28, null, null, pa.tono);   // la vara no suena 'corte' al tocar
      sfxK(m.c ? 'g_critico' : 'g_carne', m.c ? 0.4 : local ? 0.18 : 0.3);
      if (pa.s) { sacudir = Math.max(sacudir, pa.s); if (m.d > 0) sfxK('g_metal', 0.18); }
      if (m.c) { sacudir = Math.max(sacudir, 0.15); fovGolpe = -3.5; } }
  }
  // Golpes de otros jugadores: suenan donde pasan (mas bajo y por su lado), como mucho ~8 por segundo.
  if (m.p !== miId && m.d > 0 && performance.now() - (ataqueVisto.sT || 0) > 120) { ataqueVisto.sT = performance.now(); sfxK(m.c ? 'g_critico' : 'g_carne', m.c ? 0.3 : 0.22, o.x, o.z); }
  // Tu golpe pesa: pausa corta (mas larga si es critico); si la prediccion ya pauso, solo el critico vuelve a pausar.
  if (m.p === miId && m.d > 0) { if (m.c || performance.now() - (o.predT || 0) >= 350) pausaGolpe(o, m.c ? Math.max(70, pesoArma().p) : pesoArma().p); }
  // Retroceso: desde quien pego (tu u otro jugador) y mas fuerte solo con tu critico.
  if (m.d > 0) { o.golpeC = m.p === miId && !!m.c; o.golpeDe = de || P; }
  // El destello ya salio con la prediccion: no repetirlo.
  if (!(m.p === miId && performance.now() - (o.predT || 0) < 350)) o.golpeT = performance.now();
}
// Borde rojo al recibir un golpe: mas fuerte cuanto mas duele y cargado
// hacia el lado de quien pega (aunque este fuera de la pantalla). Un golpe
// que quita mas del 12 % de la vida tambien sacude la camara.
function herida(d, mo) {
  const el = $('herida');
  if (!el || !el.animate || !yo) return;
  const parte = d / Math.max(1, yo.maxHp);
  let fondo = '';
  if (mo) {
    const dx = mo.x - P.x, dz = mo.z - P.z, l = Math.hypot(dx, dz) || 1;
    const de = (dx * Math.cos(camYaw) - dz * Math.sin(camYaw)) / l, al = (-dx * Math.sin(camYaw) - dz * Math.cos(camYaw)) / l;
    fondo = `radial-gradient(circle at ${Math.round(50 + de * 50)}% ${Math.round(50 - al * 50)}%, rgba(255,40,60,.55), transparent 45%)`;
  }
  el.style.background = fondo;
  try {
    const a = el.animate([{ opacity: clamp(parte * 4, 0.35, 1) }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
    el._a = a; a.onfinish = () => { if (el._a === a) el.style.background = ''; };
  } catch (e) {}
  if (parte > 0.12) sacudir = Math.max(sacudir, 0.2);
}
// Aviso ambar "!" en el borde hacia el monstruo que va a pegarte (sin sonido o fuera de camara).
// Uno solo a la vez: se reutiliza el mismo <i>.
let avisoDirT = 0, avisoDirTm = 0;
function avisoDir(o, ms) {
  try {
    const el = $('aviso-dir'); if (!el || !o) return;
    let i = el.firstChild; if (!i) { i = document.createElement('i'); i.textContent = '!'; el.appendChild(i); }
    const dx = o.x - P.x, dz = o.z - P.z, l = Math.hypot(dx, dz) || 1;
    const de = (dx * Math.cos(camYaw) - dz * Math.sin(camYaw)) / l, al = (-dx * Math.sin(camYaw) - dz * Math.cos(camYaw)) / l;
    const a = Math.atan2(de, al);
    i.style.left = clamp(50 + Math.sin(a) * 42, 8, 92) + '%';
    i.style.top = clamp(50 - Math.cos(a) * 40, 8, 92) + '%';
    el.classList.add('on');
    clearTimeout(avisoDirTm); avisoDirTm = setTimeout(() => el.classList.remove('on'), Math.max(250, ms || 600));
  } catch (e) {}
}
// Flechas en el borde: monstruos que te persiguen fuera de camara (rojo si te pego hace <1 s).
const flechasAmz = []; const vAmz = new THREE.Vector3();
function flechasAmenaza() {
  if (!flechasAmz.length) for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'flecha-amz'; d.style.display = 'none'; document.body.appendChild(d); flechasAmz.push(d); }
  let n = 0;
  if (yo && !P.muerto && !ventanaAb) {
    const ahora = performance.now(), W = innerWidth, H = innerHeight, cxp = W / 2, cyp = H / 2;
    for (const o of mons.values()) {
      if (n >= 4) break;
      if (o.muereT || !(o.st === 1 || o.st === 2) || Math.hypot(o.x - P.x, o.z - P.z) >= 15) continue;
      vAmz.set(o.x, (o.y || alturaEn(o.x, o.z)) + 1, o.z).project(camara);
      if (Math.abs(vAmz.x) <= 1 && Math.abs(vAmz.y) <= 1 && vAmz.z <= 1) continue;
      let ax = vAmz.x, ay = vAmz.y; if (vAmz.z > 1) { ax = -ax; ay = -ay; }
      const ang = Math.atan2(-ay, ax), c = Math.cos(ang), sn = Math.sin(ang);
      const k = Math.min((cxp - 24) / Math.max(1e-4, Math.abs(c)), (cyp - 24) / Math.max(1e-4, Math.abs(sn)));
      const d = flechasAmz[n++], rojo = ahora - (o.atkMeT || 0) < 1000;
      d.style.display = 'block';
      d.style.transform = `translate(${Math.round(cxp + c * k - 17)}px,${Math.round(cyp + sn * k - 17)}px) rotate(${ang}rad)`;
      if (rojo !== d.classList.contains('roja')) d.classList.toggle('roja', rojo);   // sin vib: golpeJugador ya vibra con el golpe
    }
  }
  for (let i = n; i < flechasAmz.length; i++) if (flechasAmz[i].style.display !== 'none') { flechasAmz[i].style.display = 'none'; flechasAmz[i].classList.remove('roja'); }
}
function golpeJugador(m) {
  // El tajo del monstruo cae justo cuando llega su golpe.
  const mo = m.from && mons.get(m.from);
  if (mo && mo.fig && mo.fig.tipo === 'modelo' && !mo.muereT) {
    const tA = (mo.fig.modelo.r && mo.fig.modelo.r.tAtk) || 0.35;
    mo.fig.est = 'ataca'; mo.fig.tE = performance.now() - tA * 800;
  }
  const q = m.p === miId ? P : otros.get(m.p);
  if (!q) return;
  if (m.d > 0 && q === P) musica.combate(true);   // musica de pelea mientras te pegan
  if (m.d > 0) { let verNum = q === P; if (!verNum) { try { verNum = m.p === dueloCon || m.p === objetivoP || enGrupo(m.p); } catch (e) {} } if (verNum) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.3, q.z, '-' + m.d, '#ff5a6a'); FX.emitir(q.x, (q.y || alturaEn(q.x, q.z)) + 1.1, q.z, { n: 8, color: '#ff4d5e', vel: 3.5, vida: 0.4 }); }
  if (m.esq && m.p === miId) numero(P.x, P.y + 2.3, P.z, 'Esquiva', '#7dd3fc');
  // Sin objetivo, quien te pega pasa a serlo: su marco dice quien es y el
  // ataque (1 o Z) y las habilidades van contra el.
  if (mo && m.p === miId && !mo.muereT && !objetivo && !objetivoP && !P.muerto) { objetivo = mo.id; pintarBarra(); }
  if (mo && m.p === miId && performance.now() - (mo.vozT || 0) > 5000 && performance.now() - (mo.vozMpT || 0) > 1500 && Math.random() < 0.6) { mo.vozT = performance.now(); sfxK(vozDe(mo.k), 0.3); }
  // El que pelea con otro tambien grita de vez en cuando, desde donde esta.
  else if (mo && m.p !== miId && performance.now() - (mo.vozT || 0) > 8000 && Math.random() < 0.35) { mo.vozT = performance.now(); sfxK(vozDe(mo.k), 0.3, mo.x, mo.z); }
  if (m.p === miId && mo) mo.atkMeT = performance.now();
  if (m.p === miId) { P.heridoT = performance.now(); if (m.d > 0) { vib('rigid'); sfx('golpe', 0.3, null, null, 0.82); } if (yo && yo.maxHp > 0 && m.d > 0 && m.d >= yo.maxHp * 0.15) sfxK('g_carne', 0.15); if (yo && m.d > 0) { herida(m.d, mo); yo.hp = Math.max(0, yo.hp - m.d); pintarVida(); } }
}
let impactos = [];
let asedio = null, asedioHp = null, tirosAsedio = [];
let proyectiles = [], efectos = [], lanzando = null, objetivoP = 0, mundial3 = null, sacudir = 0, grupo3 = null;
// Pausa de golpe (hitstop): hasta pausaAnim se congelan tu animacion y la del monstruo golpeado (pausaMon).
let pausaAnim = 0, pausaMon = 0;
// Movimiento reducido (ajuste del sistema): casi sin sacudida de camara y sin congelar el golpe.
const MENOS_MOV = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
function pausaGolpe(o, ms) { if (MENOS_MOV) return; pausaAnim = Math.max(pausaAnim, performance.now() + ms); if (o) pausaMon = o.id; }
const zonas3 = new Map();
// Pisotones: si estabas dentro del circulo al marcarse (zonaDentro) y sales a tiempo, cuenta como esquivado.
// jefeEsq se expone para el resumen del jefe (window.dqJefeEsq).
const zonaDentro = {};
const jefeEsq = { ok: 0, tot: 0 };
window.dqJefeEsq = jefeEsq;
// Geometrias unitarias compartidas por todos los pisotones (se crean una vez, nunca se liberan).
let GEO_ZONA_DISCO = null, GEO_ZONA_ANILLO = null;
function geoZona() {
  if (!GEO_ZONA_DISCO) GEO_ZONA_DISCO = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  if (!GEO_ZONA_ANILLO) GEO_ZONA_ANILLO = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
}
function quitarZona3(id, explota) {
  const z = zonas3.get(id); if (!z) return;
  const mallas = [z.disco, z.borde, z.filo, z.anillo].filter(Boolean);
  escena.remove(...mallas);
  for (const o of mallas) {
    if (o.geometry && o.geometry !== GEO_ZONA_DISCO && o.geometry !== GEO_ZONA_ANILLO) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
  zonas3.delete(id);
  if (zonaDentro[id] && explota) {
    jefeEsq.tot++;
    // El servidor manda el golpe ('ph') antes que zona3f: si acaba de herirte, no fue esquivado (lag).
    if (!P.muerto && Math.hypot(P.x - z.x, P.z - z.z) > z.r && performance.now() - (P.heridoT || 0) > 400) {
      jefeEsq.ok++;
      numero(P.x, P.y + 2, P.z, '¡Esquivado!', '#4ade80', true); SON.tocar('esquivado'); vib('light');
    }
    let visto = true; try { visto = !!localStorage.getItem('dq_tip_pisoton'); if (!visto) localStorage.setItem('dq_tip_pisoton', '1'); } catch (e) {}
    if (!visto) setTimeout(() => aviso('Los jefes marcan el suelo antes de golpear: sal del círculo y contraataca mientras está expuesto', 'ok'), 900);
  }
  delete zonaDentro[id];
  if (explota) { onda(z.x, z.z, z.r, '#ff5a2a'); sacudir = 0.5; sfx('explosion', 0.45); }
}
let tocandoSubir = false, tocandoBajar = false;
// Anillo que se expande (habilidades de area, curas en grupo...).
const GEO_ONDA = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
// Anillo fino para las habilidades de jugadores: el grueso rojo queda para pisotones de jefes.
const GEO_ONDA_FINA = new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2);
function onda(x, z, radio, color, propio, op) {
  const o = op ?? 0.8;
  const m = new THREE.Mesh(propio ? GEO_ONDA_FINA : GEO_ONDA, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
  m.position.set(x, alturaEn(x, z) + 0.15, z);
  escena.add(m);
  efectos.push({ m, t: 0, dura: 0.5, radio, op: o });
}
// Colores calidos/claros (sin rojo): el rojo-naranja avisa de peligro de monstruos y jefes.
const AREA = { torbellino: '#e2e8f0', abanico: '#cbd5e1', nova: '#9be7ff', meteoros: '#f59e0b', rezo: '#4ade80', grito: '#fbbf24' };
// Golpes firma con efecto propio (ver efectoFirma).
const FIRMA = { golpe_heroico: 1, siniestro: 1, sanar: 1, escudo_poder: 1, renovar: 1 };
function efectoFirma(m, de) {
  const baja = POBRE || CAL === 'baja', n = k => baja ? Math.max(1, Math.round(k / 2)) : k;
  // En gama baja, los golpes firma de otros que no te tocan ni a ti ni a tu objetivo no se dibujan.
  if (baja && m.p !== miId && m.tg !== miId && !(m.h || []).some(g => g[0] === objetivo)) return;
  if (m.id === 'golpe_heroico' || m.id === 'siniestro') {
    const g = (m.h || [])[0], o = g && mons.get(g[0]);
    if (!o) return;
    const y = alturaEn(o.x, o.z);
    if (m.id === 'golpe_heroico') {
      onda(o.x, o.z, 1.6, '#fcd34d', true);
      FX.emitir(o.x, y + 1.2, o.z, { n: n(8), color: '#fcd34d', vel: 4, vida: 0.4, grav: 4, forma: 'chispa' });
      if (m.p === miId) vib('light');
    } else {
      FX.emitir(o.x, y + 1.3, o.z, { n: n(4), color: '#fde047', vel: 1.5, vida: 0.25, tam: 1.6, forma: 'destello' });
      FX.emitir(o.x, y + 1.1, o.z, { n: n(6), color: '#facc15', vel: 3.5, vida: 0.3, grav: 3, forma: 'chispa' });
    }
    return;
  }
  // Curas y escudos: proyectil verde (o blanco del escudo) hacia el aliado; si es a si mismo, brillo que sube.
  if (!de) return;
  const col = m.id === 'escudo_poder' ? '#f8fafc' : '#4ade80';
  const al = m.tg === miId ? P : m.tg != null ? otros.get(m.tg) : null;
  if (al && al !== de) proyectil(de, al, col);
  else FX.emitir(de.x, (de.y || alturaEn(de.x, de.z)) + 0.6, de.z, { n: n(12), color: col, vel: 1.6, vida: 0.9, grav: -3, radio: 0.6, tam: 1.1 });
}
const A_DISTANCIA = { bola_fuego: '#ff7a1a', castigo: '#ffe9a8', misiles: '#c084fc', dolor: '#7c3aed', contrahechizo: '#7dd3fc', silencio: '#a78bfa', polimorfia: '#f9a8d4' };
function efectoHab(m) {
  const de = m.p === miId ? P : otros.get(m.p);
  const h = habPorId(m.id);
  if (de && !(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now();
  if (de && AREA[m.id]) {
    // Las de otros (que no pegan a tu objetivo) van tenues, y en gama baja ni se dibujan.
    const ajena = m.p !== miId && !(m.h || []).some(g => g[0] === objetivo);
    if (!(ajena && (POBRE || CAL === 'baja'))) onda(de.x, de.z, (h && h.radio ? h.radio / 17 : 6), AREA[m.id], true, ajena ? 0.3 : 0.8);
  }
  if (FIRMA[m.id]) { try { efectoFirma(m, de); } catch (e) {} }
  for (const [id, d, tipo, w] of m.h || []) {
    const o = mons.get(id);
    if (!o) continue;
    if (d > 0) o.hp = Math.max(0, o.hp - d);
    if (de && A_DISTANCIA[m.id]) proyectil(de, o, A_DISTANCIA[m.id]);
    if ((m.p === miId || id === objetivo) && w && d > 0) { numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.3, o.z, '¡DÉBIL! ' + d, '#c8ff3a', tipo === 1 ? 29 : 21); if (m.p === miId) SON.tocar('clic', { vol: 0.9 }); }
    else if (m.p === miId || id === objetivo) numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.3, o.z, (tipo === 1 ? '¡' : '') + d + (tipo === 1 ? '!' : ''), tipo === 1 ? '#ffd34d' : '#ffe600', tipo === 1);
    o.golpeT = performance.now();
  }
  // Lanzar: whoosh (o campanitas si cura); las de otros suenan desde ellos y mas bajo.
  if (h && h.cura) SON.tocar('cura', m.p === miId || !de ? { vol: 0.9 } : { vol: 0.5, x: de.x, z: de.z });
  else SON.tocar('hab', m.p === miId || !de ? { vol: 0.7 } : { vol: 0.4, x: de.x, z: de.z });
  if (m.p === miId) { sfx(AREA[m.id] ? 'explosion' : 'corte2', 0.35); if (m.cp) aviso('Tajo del Otorongo con ' + m.cp + ' puntos de combo', 'ok'); }
}
const NOMBRE_AURA = { grito: 'Grito', muro: 'Muralla', bloque: 'Ataúd', escudoPoder: 'Escudo', renovar: 'Renovar', supresion: 'Calma', evasion: 'Evasión', sigilo: 'Sigilo', aturdido: 'Aturdido', almaDebil: 'Alma débil', bendicion: 'Bendición', vaso: '🥤 Chicha' };
// Chicha activa: unas burbujas moradas suben de quien la tomó (tú y los que tengas cerca).
setInterval(() => {
  try {
    if (document.hidden || !yo) return;
    const ah = performance.now(), sube = q => FX.emitir(q.x, (q.y || alturaEn(q.x, q.z)) + 0.5, q.z, { n: MOVIL ? 2 : 3, color: '#c084fc', vel: 0.5, vida: 1.1, grav: -1.6, radio: 0.45, tam: 0.9 });
    if (P.au && P.au.vaso > ah) sube(P);
    let k = 0;
    for (const o of otros.values()) { if (k >= 4) break; if (o.au && o.au.vaso > ah && Math.abs(o.x - P.x) < 30 && Math.abs(o.z - P.z) < 30) { sube(o); k++; } }
  } catch (e) {}
}, 900);
function pintarAuras() {
  const ahora = performance.now();
  const l = Object.entries(P.au || {}).filter(([a, fin]) => fin > ahora && NOMBRE_AURA[a]);
  const html = l.map(([a, fin]) => `<span>${NOMBRE_AURA[a]}${fin === Infinity ? '' : fin - ahora >= 120000 ? ' ' + Math.ceil((fin - ahora) / 60000) + 'min' : ' ' + Math.ceil((fin - ahora) / 1000) + 's'}</span>`).join('');
  if ($('auras')._h !== html) { $('auras').innerHTML = html; $('auras')._h = html; }
  // Hora Feliz (+50% XP, 20:00-21:00 de Lima): activa o a menos de 30 min, va delante del jefe mundial.
  const hf = horaFelizTiempos();
  const hfMs = hf.activa ? hf.acaba : hf.falta;
  const hfMmss = Math.floor(hfMs / 60000) + ':' + String(Math.floor(hfMs / 1000) % 60).padStart(2, '0');
  const txtHf = hf.activa ? '⚡ Hora Feliz +50% XP · ' + hfMmss : hf.falta < 30 * 60000 ? '⚡ Hora Feliz en ' + hfMmss : '';
  let txtJefe = '';
  if (mundial3) {
    const def = MONSTRUOS[mundial3.k] || {};
    const ms = mundial3.vivo ? mundial3.hasta - Date.now() : mundial3.en - Date.now();
    const mmss = ms > 0 ? Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') : '';
    txtJefe = mundial3.vivo ? `👹 ¡${def.nombre} en el ${ARENA3D.nombre}! ${mmss}` : ms > 0 && ms < 30 * 60000 ? `👹 ${def.nombre}: ${mmss}` : '';
  }
  const txt = [txtHf, COMPACTO && txtHf ? '' : txtJefe].filter(Boolean).join(' · ');   // movil: solo la Hora Feliz (el jefe ya iba oculto ahi)
  if ($('mundial')._h !== txt) { const em = $('mundial'); em.textContent = txt; em._h = txt; em.classList.toggle('hf', !!txtHf); }
  // El marco del grupo va justo debajo del propio (que crece con auras y avisos).
  if (grupo3 && !COMPACTO) { const mc = $('marco'); $('grupo3').style.top = (mc.offsetTop + mc.offsetHeight + 8) + 'px'; }
  // Movil: misiones y chat apilados bajo el marco (que crece con auras y avisos).
  if (COMPACTO) {
    const mc = $('marco'); let y = mc.offsetTop + mc.offsetHeight + 6;
    // Hasta donde empieza el joystick (movil) o la barra de acciones (compacto con raton).
    // (En horizontal el joystick empieza a 90 px, bajo el marco: las misiones llegan hasta media pantalla.)
    const tope = MOVIL ? Math.max($('joy').getBoundingClientRect().top, innerWidth > innerHeight ? innerHeight * 0.55 : 0) : $('barra').getBoundingClientRect().top - 8;
    for (const id of ['alas', 'objp', 'grupo3', 'misiones', 'chat']) {   // (el objetivo va arriba al centro)
      const e = $(id); let h = e.offsetHeight; if (!h) continue;
      e.style.top = y + 'px'; e.style.bottom = 'auto';
      if (id === 'misiones') {   // cerrada se recorta antes del joystick: con grupo y objetivo el pulgar que iba a caminar la abria
        const abierta = e.classList.contains('abierto'), sitio = Math.floor(tope - e.offsetTop - 4);
        const mh = !abierta && sitio < (document.body.classList.contains('texto-grande') ? (e.classList.contains('con-tuto') ? 104 : 62) : (e.classList.contains('con-tuto') ? 76 : 62)) ? Math.max(28, sitio) + 'px' : '';   // su alto cerrado en movil (index.html)
        if (e.style.maxHeight !== mh) { e.style.maxHeight = mh; h = e.offsetHeight; }
        const pe = !abierta && sitio < 28 ? 'none' : '';   // sin sitio ni para una linea: el toque pasa al joystick
        if (e.style.pointerEvents !== pe) e.style.pointerEvents = pe;
      }
      y += h + 6;
    }
  }
  const cb = yo && yo.clase === 'picaro' ? yo.combo || 0 : 0;
  const ch = '<i></i>'.repeat(cb);
  if ($('combo')._h !== ch) { $('combo').innerHTML = ch; $('combo')._h = ch; }
  if (lanzando) { const k = clamp((ahora - lanzando.ini) / (lanzando.fin - lanzando.ini), 0, 1); $('lanzar').querySelector('i').style.transform = `scaleX(${k})`; if (k >= 1 && ahora > lanzando.fin + 600) { lanzando = null; $('lanzar').style.display = 'none'; } }
  const alas = $('alas');
  const verAlas = P.vuela || P.alas < ALAS_MAX - 0.5;
  alas.style.display = verAlas ? 'block' : 'none';
  if (verAlas) { alas.firstElementChild.style.transform = `scaleX(${(P.alas / ALAS_MAX).toFixed(3)})`; if (!COMPACTO) { const mc = $('marco'); alas.style.top = (mc.offsetTop + mc.offsetHeight + 4) + 'px'; } }
}
const GEO_BALA = new THREE.SphereGeometry(0.22, 8, 6), MAT_BALA = new Map();
const matBala = c => { if (!MAT_BALA.has(c)) MAT_BALA.set(c, new THREE.MeshBasicMaterial({ color: c })); return MAT_BALA.get(c); };
const GEO_PIEDRA = new THREE.DodecahedronGeometry(0.9, 0), MAT_PIEDRA = new THREE.MeshLambertMaterial({ color: 0x5b5470, flatShading: true });
function tiroAsedio(m) {
  const q = MAQUINAS[m.i];
  if (!q || !enAbismo(P.x)) return;
  const a = new THREE.Vector3(q.x, alturaEn(q.x, q.z) + 3, q.z), b = new THREE.Vector3(m.x, alturaEn(m.x, m.z) + 3, m.z);
  const mesh = new THREE.Mesh(GEO_PIEDRA, MAT_PIEDRA); mesh.position.copy(a); escena.add(mesh);
  tirosAsedio.push({ mesh, a, b, t0: performance.now(), ms: m.ms || 2500, alto: 25 + a.distanceTo(b) * 0.15 });
  if (Math.hypot(q.x - P.x, q.z - P.z) < 40) { sfx('explosion', 0.25); FX.emitir(q.x, a.y - 1.5, q.z, { n: 14, color: '#bfae8e', vel: 3, vida: 0.5, grav: 2, plano: true, radio: 1 }); }
}
function moverTirosAsedio(t) {
  tirosAsedio = tirosAsedio.filter(s => {
    const k = (t - s.t0) / s.ms;
    if (k >= 1) {
      escena.remove(s.mesh);
      FX.emitir(s.b.x, s.b.y, s.b.z, { n: 40, color: '#ff9a3c', vel: 8, vida: 0.8, grav: 6, sube: 2 });
      FX.emitir(s.b.x, s.b.y, s.b.z, { n: 20, color: '#8a8094', vel: 4, vida: 1.2, grav: 3, tam: 2, forma: 'humo' });
      const d = Math.hypot(s.b.x - P.x, s.b.z - P.z);
      if (d < 70) { sfx('explosion', 0.5 * (1 - d / 70)); if (d < 25) sacudir = Math.max(sacudir, 0.3); }
      return false;
    }
    s.mesh.position.lerpVectors(s.a, s.b, k); s.mesh.position.y += Math.sin(Math.PI * k) * s.alto;
    s.mesh.rotation.x = t / 120; s.mesh.rotation.z = t / 170;
    return true;
  });
}
function fmtT(ms) { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; }
// Lineas del asedio para el rastreador.
function asedioHtml() {
  if (!asedio) return '';
  const d = asedio.dueno, dn = d ? `<span style="color:${FACCIONES[d].color}">${FACCIONES[d].nombre}</span>` : 'sin dueño';
  if (!asedio.activo) return `<br>🏰 Núcleo: ${dn} · <small>próximo asedio en ${fmtT(asedio.ini - Date.now())}</small>`;
  const hp = asedioHp || {}, defiendo = yo && yo.faccion && yo.faccion === d;
  return `<br><b style="color:#fca5a5">⚔ ASEDIO DEL NÚCLEO</b> ${fmtT(asedio.fin - Date.now())} · ${dn}`
    + `<br>🚪 Puerta ${asedio.puerta ? (hp.p ?? 100) + '%' : '<b style="color:#4ade80">rota</b>'} · 🛡 Guardián ${asedio.guardian ? (asedio.dormido ? '💤 dormido' : (hp.g ?? 100) + '%') : '—'}`
    + `<br><span style="font-size:11px">${defiendo ? 'Tu facción defiende: protege la puerta (al oeste del Núcleo).' : 'Rompe la puerta (al oeste del Núcleo) y vence al Guardián. Usa las máquinas de tu bastión (' + K('E', 'botón FUEGO') + ').'}</span>`;
}
// Forma de la estela y del estallido segun el color del proyectil (fuego y sombra humean, magia brilla).
const FORMA_COLOR = { '#ff7a1a': 'humo', '#c084fc': 'estrella', '#ffe9a8': 'estrella', '#7c3aed': 'humo' };
function proyectil(de, a, color, forma) {
  const mesh = new THREE.Mesh(GEO_BALA, matBala(color));
  escena.add(mesh);
  const col = color || '#ffd34d', fo = forma || FORMA_COLOR[String(col).toLowerCase()] || 'chispa';
  proyectiles.push({ mesh, de: { x: de.x, z: de.z, y: (de.y || alturaEn(de.x, de.z)) + 1.2 }, a, t: 0, color: col, forma: fo, n: 0 });
}
let avisoXP_t = 0;   // cuando se dio el aviso de XP al morir (la pantalla puede repintarse en la misma caida)
let muerte1Rev = false;   // embudo: fue su primera caida y aun no pulso revivir
function morir(m) {
  atkMantener = false;   // al revivir no sigue pegando solo (ATACAR o el clic quedaron "pulsados")
  // Golpe sordo al caer (una sola vez aunque lleguen 'muerte' y 'yo' seguidos).
  if (!P.muerto) sfx('caida', 0.55);
  vib('error');
  if (P.vuela) volar(false);
  P.planea = false; P.planeoAuto = false; P.vx = P.vz = 0; colaHab = null; atkBuf = 0;
  // Caer ante un jefe: embudo del Sabueso, pista una vez por sesion y no cuenta para la oferta de bienvenida.
  const oj = !P.muerto && objetivo ? mons.get(objetivo) : null, dj = oj && MONSTRUOS[oj.k];
  if (!P.muerto) muerteJefeBienv = !!(dj && dj.jefe && performance.now() < 600000);
  if (dj && dj.jefe) {
    if (oj.k === 'jefe_sabueso') paso('jefe1_muere');
    if (!pistaJefeDada && yo && dj.nivel <= (yo.nivel || 1) + 4) {
      pistaJefeDada = true;
      const ne = (yo.pw && yo.pw.escudo) | 0;
      setTimeout(() => aviso('El jefe pisa fuerte: sal del círculo rojo, ' + (ne > 0 ? 'usa tu 🛡 escudo (tienes ' + ne + ')' : 'compra 🛡 escudos al Mercader') + ' o caza un poco más en la luz amarilla', undefined, 2), 1500);
    }
  }
  P.muerto = true; autoAtk = false;
  // Muerto no se apunta ni se lanza nada (antes el objetivo y la recarga seguian al revivir).
  objetivo = 0; objetivoP = 0; gcdHasta = 0;
  if (lanzando) { lanzando = null; $('lanzar').style.display = 'none'; }
  quitarCorcho();
  // Donde se revive (lo mismo que revivir3d): bastion en el Abismo, claro cercano o pueblo.
  const ab = enAbismo(P.x) && yo && yo.faccion, cerca = !ab && !enAbismo(P.x) && !enCueva(P.x) && yo ? revivirEn3d(P.x, P.z, yo.nivel || 1, MAPAS, MONSTRUOS) : null;
  const dondeRev = ab ? 'Revives en tu bastión.' : cerca ? `Revives ${(yo.nivel || 1) < 10 ? 'en la entrada' : 'cerca, en un claro seguro'} de ${MAPAS[cerca.zona] ? MAPAS[cerca.zona].nombre : 'la zona'} (a ${Math.round(Math.hypot(cerca.x - P.x, cerca.z - P.z))} m).` : 'Revives en el pueblo.';
  const quien = m && m.golpes && m.golpes.length ? 'Te derribó: ' + m.golpes.map(g => esc(g.n)).filter((v, i, l) => l.indexOf(v) === i).slice(0, 2).join(', ') + '.' : '';   // innerHTML: los nombres de jugadores van escapados
  // Diagnostico: cuanto le faltaba al monstruo y cuanto cuesta caer.
  const vida = m && m.vi && m.vn ? `${esc(m.vn)} aún tenía un ${m.vi}% de vida${revancha3 && Date.now() < revancha3.hasta ? TXT_REVANCHA : '.'}` : '';
  // Embudo: primera caida de este personaje en este aparato (y si luego revive).
  if (m) { let m1 = false; try { const k1 = 'dq3_m1_' + clavePj(); if (!localStorage.getItem(k1)) { localStorage.setItem(k1, '1'); m1 = true; } } catch (e) {} if (m1) { paso('muerte1'); muerte1Rev = true; } }
  if (m && cuevaInfo && enCueva(P.x)) paso('cueva_muere');
  const xp = !m ? '' : m.pvp ? 'Ante la otra facción no pierdes experiencia.' : m.primera ? '✨ Todos caen la primera vez: revives con la Bendición del Duende (−25 % de daño, 3 min).' : m.espiral ? '✨ Tres caídas seguidas: esta vez no pierdes XP y revives con la Bendición del Duende (−25% de daño, 3 min).'
    : m.novato ? 'Hasta Nv 10 no pierdes XP.' : m.xp > 0 ? `Revivir cuesta −${fmtN(m.xp)} XP.` : '';
  // Consejo util: enemigo muy alto -> sube antes; con pociones sin usar -> usalas (tecla Q); sin pociones -> Mercader.
  const nvYo = (yo && yo.nivel) || 1, nvMax = Math.max(0, ...((m && m.golpes) || []).map(g => g.nv || 0));
  const zt = m && !m.pvp && nvMax >= nvYo + 3 ? Object.values(MAPAS).filter(z => z.zona && !z.instancia && !z.coliseo && z.nv && z.nv[0] <= nvYo).sort((a, b) => b.nv[0] - a.nv[0])[0] : null;
  // Primera caida desde Nv 10 (no PvP): aqui se explica la perdida de XP, justo cuando importa (antes era un aviso mas al subir a Nv 10).
  let avisoXP = '';
  if (m && !m.pvp && nvYo >= 10) {
    let visto = true; try { visto = !!localStorage.getItem('dq3_muerteXP_' + clavePj()); if (!visto) localStorage.setItem('dq3_muerteXP_' + clavePj(), '1'); } catch (e) {}
    if (!visto) avisoXP_t = Date.now();
    if (Date.now() - avisoXP_t < 60000) avisoXP = '⚠ Desde nivel 10, morir te quita un poco de XP (5 % del nivel). Toma pociones bajo la mitad de vida y no pelees con enemigos 3+ niveles más altos.';
  }
  const consejo = !m ? '' : m.pvp ? '⚔ Te venció alguien de la otra facción. Ve con tu grupo o vuelve al portal para estar a salvo.' : dj && dj.jefe && dj.nivel && !dj.mazmorra && !dj.mundial && !dj.asedio ? `${esc(dj.nombre || 'El jefe')} es Nv ${dj.nivel}: ${nvYo < dj.nivel - 2 ? `llega a Nv ${dj.nivel - 2}+ cazando, ` : 've en grupo, '}sal del círculo rojo y pégale cuando diga ¡AHORA!${(m.pw || 0) > 0 ? ` Tenías ${m.pw} ${m.pw === 1 ? 'poción' : 'pociones'} sin usar: ${K('pulsa Q', 'toca el botón de la poción en la barra')} cuando tu vida baje de la mitad.` : ''}` : nvMax >= nvYo + 3 ? `Ese enemigo es Nv ${nvMax} y tú Nv ${nvYo}: ${zt ? `sube antes en <b>${esc(zt.nombre)}</b> (Nv ${zt.nv[0]}-${zt.nv[1]})` : 'sube antes en una zona de tu nivel'} o ve en grupo.`
    : (m.pw || 0) > 0 ? `Tenías ${m.pw} ${m.pw === 1 ? 'poción' : 'pociones'} sin usar: ${K('pulsa Q', 'toca el botón de la poción en la barra')} cuando tu vida baje de la mitad.` : 'Sin pociones: cómpralas en el Mercader del pueblo.';
  $('muerte-txt').innerHTML = [quien, vida, `<b>${dondeRev}</b>`, xp, m && m.rep > 0 ? 'Reparar tu equipo cuesta ' + m.rep + ' oro.' : '', avisoXP, consejo].filter(Boolean).map(t => `<span style="display:block;margin:3px 0">${t}</span>`).join('');
  $('b-revivir').textContent = ab ? 'Revivir en el bastión' : cerca ? ((yo.nivel || 1) < 10 ? 'Revivir en la entrada' : 'Revivir aquí cerca') : 'Revivir en el pueblo';
  // Comprar pociones: revive en el pueblo (solo alli se compra) y abre la tienda de consumibles.
  const bp = $('b-revivir-pociones');
  if (bp) bp.style.display = ab || enCueva(P.x) || (m && m.inst) ? 'none' : '';
  // 🆘 Pedir ayuda: marca blanca 'caido' en tu sitio para tu grupo y los que estén a 60 m (1 vez cada 20 s).
  let bAy = $('b-ayuda-caido');
  if (!bAy && $('b-revivir')) {
    bAy = document.createElement('button'); bAy.id = 'b-ayuda-caido'; bAy.type = 'button'; bAy.className = 'btn sec';
    bAy.style.cssText = 'width:100%;margin-top:8px'; bAy.textContent = '🆘 Pedir ayuda';
    bAy.onclick = () => {
      const ah = Date.now();
      if (ah - ayudaT < 20000) return aviso(`Ya pediste ayuda: espera ${Math.ceil((20000 - (ah - ayudaT)) / 1000)} s.`);
      ayudaT = ah; marcaT = 0; marcar3('caido');
      bAy.textContent = '🆘 Ayuda pedida'; setTimeout(() => { bAy.textContent = '🆘 Pedir ayuda'; }, 20000);
    };
    // Va debajo de «Comprar pociones» para que la compra quede en el primer vistazo.
    const refAy = $('b-revivir-pociones');
    if (refAy && refAy.parentNode) refAy.parentNode.insertBefore(bAy, refAy.nextSibling);
    else $('b-revivir').parentNode.appendChild(bAy);
  }
  // Solo tiene sentido si hay alguien que pueda venir: tu grupo o un jugador a 60 m.
  if (bAy) bAy.style.display = ((grupo3 && grupo3.m && grupo3.m.length > 1) || [...otros.values()].some(q => q && Math.hypot(q.x - P.x, q.z - P.z) < 60)) ? '' : 'none';
  chipBienvMuerte(m);
  abrir('v-muerte');
}
// Recordatorio pequeño (no modal) en la pantalla de revivir: moriste sin pociones, el
// Pack de bienvenida sigue disponible y su oferta ya se vio. Como mucho 1 vez al dia.
let bienvTrasRevivir = false, chipBienvVisto = false;   // chipBienvVisto: ya salio en esta muerte ('yo' y 'muerte' llaman a morir dos veces)
function chipBienvMuerte(m) {
  let ch = $('chip-bienv');
  if (chipBienvVisto) return;
  if (ch) ch.style.display = 'none';
  // Sin 'm' (llamada desde 'yo') aun no se sabe si fue PvP: se espera al mensaje 'muerte'.
  if (!m || m.pvp || !yo || !yo.puedeBienvenida || !(yo.p2e && yo.p2e.cuenta) || ((m.pw != null ? m.pw : (yo.pw && yo.pw.pocion)) || 0) > 0) return;
  const d = new Date(), dia = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  try { if (localStorage.getItem('dq_bienv_ofrecida') !== '1' || localStorage.getItem('dq_bienv_chip') === dia) return; localStorage.setItem('dq_bienv_chip', dia); } catch (e) { return; }
  const ref = $('b-revivir-pociones') || $('b-revivir');
  if (!ref) return;
  if (!ch) {
    ch = document.createElement('button');
    ch.id = 'chip-bienv'; ch.type = 'button';
    ch.style.cssText = 'display:block;margin:10px auto 0;max-width:100%;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,216,74,.55);background:rgba(255,216,74,.12);color:#fde68a;font:600 12px var(--sans,system-ui);cursor:pointer;white-space:normal;line-height:1.3';
    ch.textContent = '🎁 Tu Pack de bienvenida (10 pociones) sigue disponible';
    // La tienda va debajo de esta pantalla: se revive como con el boton principal y se abre al volver.
    ch.onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); ch.style.display = 'none'; pocionesTrasRevivir = false; bienvTrasRevivir = true; pasoRevivir1(); mandar({ t: 'revivir' }); };
    ref.insertAdjacentElement('afterend', ch);
  }
  ch.style.display = 'block'; chipBienvVisto = true;
}
// La ventana se cierra cuando el servidor confirma (llega 'yo' vivo): sin conexion no te quedas muerto y sin boton.
let pocionesTrasRevivir = false;
function pasoRevivir1() { if (muerte1Rev) { muerte1Rev = false; paso('revivir1'); } }
$('b-revivir').onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); pocionesTrasRevivir = false; pasoRevivir1(); mandar({ t: 'revivir' }); };
if ($('b-revivir-pociones')) $('b-revivir-pociones').onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); pocionesTrasRevivir = true; pasoRevivir1(); mandar({ t: 'revivir', pueblo: 1 }); };

// ── HUD ──
// Premio real siempre a la vista: al llegar a nivel 60, 2 litros de chicha
// morada (functions/mmo/chicha.js, meta 'nv60'). Tocarlo cuenta la leyenda o reclama.
let chicha3Txt = '';
function pintarChicha3() {
  const b = $('chicha3'), nv = yo.nivel || 1, g = granMeta(yo, soyInvitado), est = g.q && g.q.estado;
  const corto = document.body.classList.contains('movil') && matchMedia('(orientation:portrait)').matches;
  // «¡Reclama!» solo cuando el servidor lo aceptaría: con Nv 60 aún pueden faltar la cuenta, los días o las horas.
  const t = g.rec ? (est === 'rechazado' ? `🥤 Reclamo de ${CHICHA.litros60} L no aprobado` : est === 'enviado' ? `🥤 ${CHICHA.litros60} L de chicha en camino ✓` : `🥤 ${CHICHA.litros60} L de chicha reclamados ✓`) : g.listo ? `🥤 ¡Reclama tus ${CHICHA.litros60} L de chicha morada!` : nv >= CHICHA.nv60 ? (soyInvitado ? `🥤 Nv ${CHICHA.nv60} ✓ · para reclamar, crea tu cuenta` : `🥤 Nv ${CHICHA.nv60} ✓ · te falta jugar ${g.falta}`) : corto ? `🥤 ${CHICHA.litros60} L chicha real · Nv ${nv}/${CHICHA.nv60}` : `🥤 Nv ${CHICHA.nv60} = ${CHICHA.litros60} L de chicha morada real · Nv ${nv}/${CHICHA.nv60}`;
  if (t === chicha3Txt) return;
  chicha3Txt = t; b.textContent = t; b.title = `🥤 Nv ${CHICHA.nv60} = ${CHICHA.litros60} L de chicha morada real`; b.classList.toggle('listo', g.listo);
}
// Al girar el telefono la pildora cambia entre texto corto (vertical) y largo.
addEventListener('orientationchange', () => setTimeout(() => { chicha3Txt = ''; try { if (yo) pintarChicha3(); } catch (e) {} }, 300));
// Cada reclamo con su código y, si sigue abierto, el botón de WhatsApp con el mensaje ya escrito.
function reclamos3(ch) {
  return (ch.rcl || []).map(r => {
    const que = r.meta === 'nv60' ? r.l + ' litros de nivel ' + CHICHA.nv60 : r.meta.toLocaleString('es') + ' puntos';
    if (r.estado === 'enviado') return `<p class="vv-p" style="text-align:center;font-size:12px;margin:6px 0"><b style="color:#4ade80">Tu chicha ya va en camino</b> (#${esc(r.id)} · ${que})</p>`;
    if (r.estado === 'rechazado') return `<p class="vv-p" style="text-align:center;font-size:12px;margin:6px 0">Tu reclamo #${esc(r.id)} (${que}) no se pudo completar${r.motivo ? ': ' + esc(r.motivo) : ''}.</p>`;
    return `<div style="margin:8px 0;padding:10px;border-radius:10px;text-align:center;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.5)"><small>Tu código de reclamo (${que})</small><div style="font-size:22px;font-weight:800;color:#fde68a;margin:2px 0;overflow-wrap:anywhere">#${esc(r.id)}</div>${r.meta === 'nv60' && ch.q60 && ch.q60.id === r.id ? `<small style="display:block">Puesto ${ch.q60.p} de ${ch.q60.n} en la revisión${r.cola && r.me ? ' · cupo lleno: envío estimado para ' + mesChicha(r.me) : r.me ? ' · cupo de ' + mesChicha(r.me) : ''}.</small>` : ''}${r.coord ? '<small style="display:block;color:#4ade80">Envío ya coordinado con el equipo.</small>' : ''}${r.cl ? `<details style="margin:6px 0"><summary style="cursor:pointer;font-weight:700;padding:12px 0">Ver mi clave de entrega</summary><div style="font-size:20px;font-weight:800;letter-spacing:2px;color:#fde68a;margin:2px 0;user-select:text;-webkit-user-select:text">${esc(r.cl)}</div><small style="display:block">Te la pedimos por WhatsApp antes de tomar tu dirección. Es solo para el ${CHICHA.whatsappVer}: no se la des a nadie más, ni la muestres en capturas o en el chat. Si otro número te la pide, es una estafa.</small></details>` : ''}<a class="btn" data-wa href="${esc(waChicha(r.id, yo.nombre || 'duende', r.l))}" target="_blank" rel="noopener" style="display:block;margin:6px 0;text-decoration:none;background:#25d366;border-color:#25d366;color:#fff">Coordinar el envío por WhatsApp</a><small>Al ${CHICHA.whatsappVer}, con tu código y tu nombre de duende. El equipo revisa y aprueba cada reclamo a mano. Envío gratis: no hay nada que pagar.</small></div>`;
  }).join('');
}
// Ventana de la chicha en ORIGINS: puntos, los tres premios y como se reclaman.
function verChicha() {
  if (!yo) return;
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const ch = yo.chicha || { p: 0, hoy: 0, rec: [] }, rec = ch.rec || [], nv = yo.nivel || 1, gm = granMeta(yo, soyInvitado);
  // Rechazado por trampa: el premio sigue en rec (no se puede repetir), pero no se enseña como reclamado.
  const noAprobado = meta => (ch.rcl || []).some(r => r.estado === 'rechazado' && (r.meta === meta || r.meta === CHICHA.antes[CHICHA.niveles.indexOf(meta)]));
  const fila = (meta, tit, txt, pct, listo, falta) => {
    const hecho = rec.includes(meta);
    const acc = hecho ? (noAprobado(meta) ? '<b style="color:#fca5a5">No aprobado</b>' : '<b style="color:#4ade80">✓ Reclamado</b>') : falta ? `<small style="flex:none;max-width:34%;text-align:right;color:#fde68a">${falta}</small>` : listo ? `<button class="btn" data-chi="${meta}" style="padding:6px 10px">Reclamar</button>` : `<b style="color:#fde68a">${pct}%</b>`;
    return `<div style="display:flex;gap:8px;align-items:center;margin:8px 0;padding:8px;border-radius:10px;background:rgba(124,58,237,.15);border:1px solid rgba(192,132,252,.35)"><div style="flex:1;min-width:0"><b style="color:#e9d5ff">${tit}</b><br><small>${txt}</small><div style="height:5px;background:rgba(0,0,0,.4);border-radius:3px;margin-top:4px"><i style="display:block;height:100%;width:${pct}%;background:#a855f7;border-radius:3px"></i></div></div>${acc}</div>`;
  };
  let h = `<img src="${imgLore()}" alt="" style="display:block;width:100%;max-height:120px;object-fit:${modoAnuncio() ? 'contain' : 'cover'};border-radius:10px;margin-bottom:8px">`;
  if (soyInvitado) h += `<p class="vv-p" style="color:#fde68a">Juegas como invitado: tus cazas no suman puntos de chicha y los premios se reclaman con una cuenta. Si la creas gratis con tu correo, tu duende y tu nivel pasan contigo y desde ahí tus cazas suman.</p><button class="btn" id="chi-cuenta" style="width:100%;margin-bottom:8px">📧 Crear cuenta gratis</button>`;
  h += `<p class="vv-p" style="text-align:center;font-size:20px;color:#fde68a;margin:4px 0">${(ch.p || 0).toLocaleString('es')} puntos de chicha</p><p class="vv-p" style="text-align:center;font-size:12px">Hoy ${ch.hoy || 0}/${CHICHA.porDia} · desde nivel ${CHICHA.nvPuntos}: 1 punto por monstruo, 3 si es de tu nivel, 25 un jefe.</p>` + reclamos3(ch);
  h += fila('nv60', `Nivel ${CHICHA.nv60}: ${CHICHA.litros60} litros`, `Llega a nivel ${CHICHA.nv60} y te llevas ${CHICHA.litros60} litros a tu casa (Nv ${nv}/${CHICHA.nv60}).`, Math.min(100, Math.round(nv / CHICHA.nv60 * 100)), gm.listo, nv < CHICHA.nv60 ? '' : soyInvitado ? 'Falta tu cuenta' : gm.falta ? `Te falta jugar ${gm.falta}` : '');
  for (const meta of CHICHA.niveles) h += fila(meta, `${meta.toLocaleString('es')} puntos: 1 litro`, 'Un litro de chicha morada peruana enviado a tu casa.', Math.min(100, Math.round((ch.p || 0) / meta * 100)), (ch.p || 0) >= meta, (ch.p || 0) < meta ? '' : soyInvitado ? 'Falta tu cuenta' : nv < CHICHA.nvReclamo ? `Desde Nv ${CHICHA.nvReclamo}` : '');
  // Requisitos a la vista (los mismos que revisa el servidor en chicha.js).
  const dj = ch.dj || 0, hj = Math.floor((ch.mj || 0) / 60), h60 = Math.round(CHICHA.min60 / 60), si = b => b ? '✅' : '⬜';
  h += `<p class="vv-p" style="font-size:12px;line-height:1.6;margin:6px 0"><b>Requisitos</b><br>${si(!soyInvitado)} Cuenta real (no invitado)<br>${si(nv >= CHICHA.nvPuntos)} Puntos desde nivel ${CHICHA.nvPuntos}<br>${si(nv >= CHICHA.nvReclamo)} Reclamar desde nivel ${CHICHA.nvReclamo} y 2 días de personaje<br>${si(nv >= CHICHA.nv60 && dj >= CHICHA.dias60 && hj >= h60)} ${CHICHA.litros60} litros: nivel ${CHICHA.nv60} + ${CHICHA.dias60} días jugados (${Math.min(dj, CHICHA.dias60)}/${CHICHA.dias60}) + ${h60} h de juego (${Math.min(hj, h60)}/${h60})<br>📦 Envíos solo en Perú · se coordinan por WhatsApp</p>`;
  h += `<p class="vv-p" style="font-size:11px;color:var(--txt2)">Promoción gratuita: no hay que comprar nada. Hay ${CHICHA.mesMax} litros por puntos al mes. El equipo revisa cada reclamo a mano y coordinas la dirección por WhatsApp con tu código; nunca te pediremos pagos ni contraseñas. ¿Dudas sobre la chicha? WhatsApp <a href="https://wa.me/${CHICHA.whatsapp}" target="_blank" rel="noopener" style="color:inherit;font-weight:700;white-space:nowrap">${CHICHA.whatsappVer}</a>.</p><button class="btn sec" id="chi-leyenda" style="width:100%">📜 La leyenda del Cántaro</button>`;
  $('diario-c').innerHTML = h;
  $('v-diario').querySelector('h2').textContent = '🥤 CHICHA MORADA REAL';
  $('diario-c').querySelectorAll('[data-chi]').forEach(b => b.onclick = () => {
    const meta = b.dataset.chi === 'nv60' ? 'nv60' : +b.dataset.chi;
    if (confirm(`¿Reclamar ${meta === 'nv60' ? `tus ${CHICHA.litros60} litros` : 'tu litro'} de chicha morada? Verás tu código para coordinar el envío por WhatsApp (nunca pagos ni contraseñas).`)) { mandar({ t: 'chicha', meta }); b.disabled = true; }
  });
  $('diario-c').querySelectorAll('[data-wa]').forEach(a => a.onclick = e => { try { if (TG && TG.openLink) { e.preventDefault(); TG.openLink(a.href); } } catch (er) {} });
  $('chi-leyenda').onclick = verLeyenda;
  if ($('chi-cuenta')) $('chi-cuenta').onclick = irACrearCuenta;
  abrir('v-diario');
}
$('chicha3').addEventListener('click', verChicha);
$('b-chicha').addEventListener('click', verChicha);
// ── BARRA DE XP: próximo desbloqueo, ritmo (~min) y XP de descanso ──
// Muestras [t, XP total acumulada] solo en el cliente; al subir de nivel se suma el xpSig del nivel que se deja.
const ritmoXp = { nv: 0, mae: 0, xp: 0, sig: 0, base: 0, desde: 0, m: [] };
let descansoPrev = null;
const VENTANA_XP = 300000;   // 5 min
function muestraXp() {
  const r = ritmoXp, ahora = Date.now(), mae = yo.mae || 0, xp = Number(yo.xp) || 0;
  if (!r.nv || yo.nivel < r.nv || (yo.nivel === r.nv && mae === r.mae && xp < r.xp) || mae < r.mae) { r.base = 0; r.m = []; r.desde = ahora; }
  else if (yo.nivel > r.nv) { r.base += r.sig; for (let l = r.nv + 1; l < yo.nivel; l++) r.base += xpParaSubir(l); }
  else if (mae > r.mae) r.base += r.sig * (mae - r.mae);   // maestria: la barra vuelve a 0 en cada punto
  r.nv = yo.nivel; r.mae = mae; r.xp = xp; r.sig = yo.xpSig || xpParaSubir(yo.nivel);
  const tot = r.base + xp, ult = r.m[r.m.length - 1];
  if (!ult || ult[1] !== tot) r.m.push([ahora, tot]);
  // Se guarda una muestra anterior a la ventana: el total a esa hora es exacto (la XP sube a saltos).
  while (r.m.length > 1 && r.m[1][0] <= ahora - VENTANA_XP) r.m.shift();
}
function minutosXp(falta) {
  const r = ritmoXp, ahora = Date.now();
  if (!r.m.length || falta <= 0) return 0;
  const lapso = Math.min(ahora - r.desde, VENTANA_XP);
  if (lapso < 120000) return 0;   // menos de 2 min de datos: aun no se adivina
  const ini = ahora - lapso;
  let base = r.m[0][1];
  for (const mu of r.m) { if (mu[0] <= ini) base = mu[1]; else break; }
  const porMin = (r.m[r.m.length - 1][1] - base) / (lapso / 60000);
  return porMin > 0 ? Math.max(1, Math.ceil(falta / porMin)) : 0;
}
function textoProximo(t, nv) {
  let s = String(t).split(' · ')[0];
  const m = s.match(/^([^\p{L}\p{N}\s]+)\s+(.*)$/u), ico = m ? m[1] : '';
  s = m ? m[2] : s;
  const zona = s.match(/^nueva zona:\s*(.+)$/i);
  s = zona ? 'Zona ' + zona[1] : s.split(/[:(]/)[0].trim().replace(/^(el|la|los|las)\s+/i, '');
  return (ico ? ico + ' ' : '') + 'Nv ' + nv + ': ' + s.charAt(0).toUpperCase() + s.slice(1);
}
function pintarXpProx() {
  const chip = $('xp-prox'), azul = $('xp-desc');
  if (!chip || !yo) return;
  const sig = yo.xpSig || xpParaSubir(yo.nivel), xp = Number(yo.xp) || 0, desc = Math.max(0, Number(yo.descanso) || 0);
  if (azul) azul.style.transform = `scaleX(${desc > 0 ? clamp((xp + desc) / sig, 0, 1) : 0})`;
  if (descansoPrev !== null && descansoPrev > 0 && desc === 0) aviso('💤 Descanso gastado: se recarga mientras estás desconectado (desde 1 h fuera)');
  descansoPrev = desc;
  // Nv 7-9 con talento ya elegido: la meta es el Nv 10, cuando se activa.
  const tPre = yo.nivel >= TAL_PRE_NIVEL && yo.nivel < TALENTO_NIVEL ? talentoPreElegido(yo) : null;
  const tPreN = tPre ? (TALENTOS.find(t => t.id === tPre) || {}).nombre : '';
  const p = tPreN ? [TALENTO_NIVEL, ''] : PROXIMOS.find(x => x[0] > yo.nivel);
  let txt = '';
  if (p) {
    const n = p[0] - yo.nivel;
    txt = (tPreN ? `Nv ${TALENTO_NIVEL}: activa tu talento ⭐${tPreN}` : textoProximo(p[1], p[0])) + ' · ' + (n === 1 ? 'falta 1 nivel' : 'faltan ' + n + ' niveles');
    let falta = Math.max(0, sig - xp);
    for (let l = yo.nivel + 1; l < p[0]; l++) falta += xpParaSubir(l);
    const mins = minutosXp(falta);
    if (mins > 0 && mins < 6000) txt += ' · ~' + (mins >= 90 ? Math.round(mins / 60) + ' h' : mins + ' min');
  }
  const pt = $('xp-pt'), pd = $('xp-pd');
  if (pt) { pt.textContent = txt; pt.style.display = txt ? '' : 'none'; }
  if (pd) pd.style.display = desc > 0 ? '' : 'none';
  chip.style.display = txt || desc > 0 ? 'block' : 'none';
}
setInterval(() => { try { if (yo) pintarXpProx(); } catch (e) {} }, 20000);
// Contador de oro: si ganas 10 o mas, sube en ~0,5 s con tics que suben de tono y un pulso;
// si baja (compras) o es poco, se pone directo. La primera vez tambien directo.
let oroMostrado = null, oroDestino = null, oroAnim = 0;
let oroCaza3 = 0;   // ultima vez que sono el oro de una caza ('gana'): ese oro se pinta directo, sin tics
function pintarOro(v) {
  const el = $('oro'); if (!el) return;
  const fmt = n => Math.round(n).toLocaleString('es') + ' oro';
  if (oroAnim && v === oroDestino) return;   // ya va subiendo hacia ese valor
  if (oroAnim) { cancelAnimationFrame(oroAnim); oroAnim = 0; }
  const desde = oroMostrado;
  oroDestino = v;
  if (desde == null || v - desde < 10 || document.visibilityState !== 'visible' || (performance.now() - oroCaza3 < 1500 && v - desde < 200)) { oroMostrado = v; el.textContent = fmt(v); return; }
  const dif = v - desde, n = Math.max(3, Math.min(6, 2 + Math.floor(Math.log10(dif)))), t0 = performance.now(), DUR = 500;
  let tic = 0;
  try { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' }); } catch (e) {}
  const paso = ahora => {
    const k = Math.min(1, (ahora - t0) / DUR), e = 1 - Math.pow(1 - k, 3);
    oroMostrado = desde + dif * e; el.textContent = fmt(oroMostrado);
    // como maximo un tic por cuadro (un cuadro lento no los amontona); al terminar suena siempre el tic final
    if (k >= 1) { if (tic < n) { try { SON.tocar('tic_oro', { i: n - 1, fin: 1, vol: 0.8 }); } catch (er) {} tic = n; } }
    else if (tic < n - 1 && k >= (tic + 1) / n - 0.001) { try { SON.tocar('tic_oro', { i: tic, vol: 0.8 }); } catch (er) {} tic++; }
    if (k < 1) oroAnim = requestAnimationFrame(paso);
    else { oroAnim = 0; oroMostrado = v; el.textContent = fmt(v); }
  };
  oroAnim = requestAnimationFrame(paso);
}
function pintarHud() {
  if (!yo) return;
  const cl = CLASES[yo.clase];
  $('m-nombre').textContent = (yo.dios ? 'GM ' : '') + yo.nombre;
  $('m-nivel').textContent = 'Nv ' + yo.nivel + (yo.mae ? ' ★' + yo.mae : '') + (cl && !COMPACTO ? ' · ' + cl.nombre : '');   // en el marco fino del movil la clase dejaba el nombre en 4 letras
  pintarOro(Number(yo.oro || 0));
  $('m-rec').style.display = cl ? '' : 'none';
  if (cl) $('m-rec').firstElementChild.style.background = RECURSOS[cl.recurso].color;
  $('xp').firstElementChild.style.transform = `scaleX(${clamp(yo.xp / (yo.xpSig || xpParaSubir(yo.nivel)), 0, 1)})`;
  try { muestraXp(); pintarXpProx(); } catch (e) {}
  pintarVida(); pintarBarra(); pintarChicha3();
  // Movil por etapas: MONTAR cuando tienes montura y FIJAR desde nivel 3 (menos botones al empezar).
  if (MOVIL) {
    const vMon = yo.montura || (yo.monturas || []).length ? 'visible' : 'hidden', vFij = yo.nivel >= 3 ? 'visible' : 'hidden';
    if ($('t-montar').style.visibility !== vMon) $('t-montar').style.visibility = vMon;
    if ($('t-obj').style.visibility !== vFij) { $('t-obj').style.visibility = vFij; if (vFij === 'visible' && yo.nivel === 3) aviso('🎯 Nuevo botón FIJAR: cambia de objetivo entre los monstruos cercanos.', 'ok'); }
  }
  if (!P.fig || P.skin !== claveYo()) cambiarSkinPropia();
}
function pintarVida() {
  if (!yo) return;
  const hp = $('m-hp'), rc = $('m-rec');
  hp.firstElementChild.style.transform = `scaleX(${clamp(yo.hp / yo.maxHp, 0, 1)})`;
  hp.lastElementChild.textContent = Math.ceil(yo.hp) + ' / ' + yo.maxHp;
  // Vida por debajo del 30 %: el borde rojo late hasta que te cures.
  const hd = $('herida'); if (hd) hd.classList.toggle('bajo', yo.hp > 0 && yo.hp / yo.maxHp < 0.3);
  // Con poca vida y pociones, el boton de la pocion late para que el novato lo vea.
  const bpo = document.querySelector('#barra [data-pw="pocion"]');
  if (bpo) bpo.classList.toggle('urge', yo.hp > 0 && yo.hp / yo.maxHp < 0.35 && ((yo.pw && yo.pw.pocion) || 0) > 0);
  // Peligro: con menos del 35 % de vida la musica se apaga (filtro) y late; solo se avisa si cambia (pasos de 0,1).
  { const vb = yo.maxHp && yo.hp > 0 && yo.hp < yo.maxHp * 0.35, kP = vb ? Math.round(clamp(1 - yo.hp / (0.35 * yo.maxHp), 0, 1) * 10) / 10 : 0; if (kP !== pintarVida.kP) { pintarVida.kP = kP; if (musica.peligro) musica.peligro(kP); } }
  if (yo.recMax) { rc.firstElementChild.style.transform = `scaleX(${clamp((yo.rec || 0) / yo.recMax, 0, 1)})`; const rn = RECURSOS[(CLASES[yo.clase] || {}).recurso]; rc.lastElementChild.textContent = (rn ? rn.nombre + ' ' : '') + Math.round(yo.rec || 0) + ' / ' + yo.recMax; }
}
const cdPoder = {}, cdHab = {};
let gcdHasta = 0, misHabs = [];
let wakeL = null;
function pedirVela(on) { try { if (on && !wakeL && navigator.wakeLock && !document.hidden && Date.now() > (pedirVela.noAntes || 0)) { wakeL = 'pidiendo'; navigator.wakeLock.request('screen').then(l => { if (!autoAtk) { wakeL = null; l.release().catch(() => {}); return; } wakeL = l; l.addEventListener('release', () => { if (wakeL === l) wakeL = null; }); }).catch(() => { wakeL = null; pedirVela.noAntes = Date.now() + 60000; }); } else if (!on && wakeL && wakeL !== 'pidiendo') { wakeL.release().catch(() => {}); wakeL = null; } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden) pedirVela(autoAtk); });
// Ultimo toque o tecla del jugador (sin AUTO desde v344 ya no hay pausa de 15 min que avisar).
let ultimoToqueT = performance.now();
addEventListener('pointerdown', () => { ultimoToqueT = performance.now(); }, true);
addEventListener('keydown', () => { ultimoToqueT = performance.now(); }, true);
// Modo reposo (bucle): arrastrar la camara o la rueda tambien es "estar jugando".
let movInputT = 0;
for (const ev of ['pointermove', 'wheel', 'touchmove']) addEventListener(ev, () => { movInputT = performance.now(); }, { capture: true, passive: true });
// Al volver de otra app (WhatsApp) cuenta como toque: no pausar a los pocos segundos.
document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimoToqueT = performance.now(); });
function pintarBarra() {
  try { marcaJefeIni(); } catch (e) {}   // jefeIni se declara mas abajo: antes de eso no hay jefes que medir
  if (!yo) return;
  const b = $('barra');
  const clave = (yo.clase || '') + ':' + yo.nivel;
  if (b.dataset.hecho !== clave) {
    b.dataset.hecho = clave;
    b.innerHTML = '';
    misHabs = yo.clase ? habsDe(yo.clase).slice(0, 8) : [];
    const atk = document.createElement('button'); atk.className = 'acc'; atk.id = 'acc-atk';
    atk.innerHTML = '<span class="t" data-vt="Digit1">' + esc(rotuloT('Digit1')) + '</span><img src="' + A + 'armas/katana_comun_item.png" alt=""><span class="cd"></span>';
    atk.title = 'Atacar (1 o Z; mantén para seguir pegando)';
    atk.setAttribute('aria-label', atk.title);
    // Pulsar pega al instante; mantener sigue pegando (bucle con atkMantener); soltar/salir/cancelar lo corta.
    atk.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); if (MOVIL) avisoPrimeraVez(atk.title); atkMantener = true; alternarAtaque(); };
    atk.onpointerup = atk.onpointerleave = atk.onpointercancel = () => { atkMantener = false; };
    atk.onclick = e => { if (e.detail === 0) alternarAtaque(); };   // solo teclado (Enter/Espacio sobre el boton)
    b.appendChild(atk);
    let bloqueadas = 0, enArco = 0;
    misHabs.forEach((h, i) => {
      if (yo.nivel < h.nv && ++bloqueadas > 1) return;   // menos ruido: solo la proxima por aprender
      const d = document.createElement('button'); d.className = 'acc' + (yo.nivel < h.nv ? ' bloq' : ''); d.dataset.hab = h.id;
      // Las 3 primeras aprendidas van en arco alrededor de ATACAR (solo movil en horizontal, ver CSS .acc.arco)
      if (yo.nivel >= h.nv && enArco < 3) {
        const [ax, ay] = [[10, -62], [-98, -44], [-46, -106]][enArco++];   // casilla respecto a ATACAR: libres entre ESQUIVAR, SALTO y VOLAR
        d.classList.add('arco');
        d.style.setProperty('--dx', ax + 'px'); d.style.setProperty('--dy', ay + 'px');
      }
      d.innerHTML = `<span class="t" data-vt="Digit${i + 2}">${esc(rotuloT('Digit' + (i + 2)))}</span><img src="${A}items/equipo/${h.icono}.png" alt="">${yo.nivel < h.nv ? '<span class="lv">Nv ' + h.nv + '</span>' : ''}<span class="cd"></span><span class="cs"></span>`;
      d.title = h.nombre + ' (' + (i + 2) + ') — ' + h.desc;
      d.setAttribute('aria-label', d.title);
      // Bloqueada no: usarHab ya avisa del nivel y de lo que hace
      d.onclick = () => { if (MOVIL && yo && yo.nivel >= h.nv) avisoPrimeraVez(d.title); if (habNoLista(h)) rechazo(d); usarHab(h); };
      // Movil: con otro dedo en el joystick o en ATACAR el navegador no genera click; el toque si llega.
      if (MOVIL) d.addEventListener('touchstart', e => { e.preventDefault(); d.onclick(); }, { passive: false });
      b.appendChild(d);
    });
    PODERES.forEach((p, i) => {
      const d = document.createElement('button'); d.className = 'acc'; d.dataset.pw = p.id;
      d.innerHTML = `<span class="t" data-vt="Key${p.tecla}">${esc(rotuloT('Key' + p.tecla))}</span><img src="${A}items/${p.icono}.png" alt=""><span class="n"></span><span class="cd"></span><span class="cs"></span>`;
      d.title = p.nombre + ' (' + p.tecla + ') — ' + p.desc;
      d.setAttribute('aria-label', d.title);
      d.onclick = () => { if (MOVIL) avisoPrimeraVez(d.title); if ((cdPoder[p.id] || 0) > performance.now() || !(yo && yo.pw && yo.pw[p.id] > 0)) rechazo(d); usarPoder(i); };
      if (MOVIL) d.addEventListener('touchstart', e => { e.preventDefault(); d.onclick(); }, { passive: false });
      b.appendChild(d);
    });
    pulsoHabNueva();
  }
  $('acc-atk').classList.toggle('on', autoAtk);
  // En movil la barra no lleva el boton de ataque: ATACAR muestra si el automatico esta puesto.
  if (MOVIL) { const ta = $('t-atk'); if (ta.classList.contains('on') !== autoAtk) { ta.classList.toggle('on', autoAtk); ta.textContent = autoAtk ? 'PARAR' : 'ATACAR'; } }
  b.querySelectorAll('[data-pw]').forEach(d => { d.querySelector('.n').textContent = (yo.pw && yo.pw[d.dataset.pw]) || 0; });
  pedirVela(autoAtk);
}
// Habilidad nueva sin estrenar (marca dq3_habNueva_<id>): su boton late en verde hasta usarla una vez.
function pulsoHabNueva() {
  let id = null; try { id = clavePj() ? localStorage.getItem('dq3_habNueva_' + clavePj()) : null; } catch (e) {}
  if (!id || !yo) return;
  const h = habPorId(id);
  if (!h || yo.nivel < h.nv) return;
  const d = document.querySelector('#barra [data-hab="' + id + '"]');
  if (d) d.classList.add('tuto-pulso');
}
function estrenarHab(h) {
  let id = null; try { id = localStorage.getItem('dq3_habNueva_' + clavePj()); } catch (e) {}
  if (!h || id !== h.id) return;
  try { localStorage.removeItem('dq3_habNueva_' + clavePj()); } catch (e) {}
  const d = document.querySelector('#barra [data-hab="' + h.id + '"]');
  if (d) d.classList.remove('tuto-pulso');
}
// Toque que no sirve (en recarga, sin recurso o bloqueada): el boton tiembla en rojo y vibra.
function rechazo(d) {
  d.classList.remove('no'); void d.offsetWidth; d.classList.add('no'); vib('error');
  clearTimeout(d._noT); d._noT = setTimeout(() => d.classList.remove('no'), 320);   // sin esto el borde rojo se quedaba
}
function habNoLista(h) {
  if (!yo || !h) return false;
  if (yo.nivel < h.nv) return true;
  const ahora = performance.now(), c = cdHab[h.id];
  if (c && c.fin - ahora >= 300) return true;   // con menos de 0,3 s usarHab la deja en cola
  if (h.gcd !== false && gcdHasta - ahora >= 400) return true;   // con menos de 0,4 s usarHab la deja en cola: no es rechazo
  return yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec);
}
// Destello al volver a estar lista (de recarga a 0 y con recurso).
function marcarListo(d, k, ok) {
  const antes = d.dataset.k === '1';
  const ahoraK = k > 0 ? '1' : '0';
  if (d.dataset.k !== ahoraK) d.dataset.k = ahoraK;   // se llama cada cuadro: no tocar el DOM si no cambio
  if (antes && k <= 0 && ok) { d.classList.remove('listo'); void d.offsetWidth; d.classList.add('listo'); if (objetivo || objetivoP) vib('light'); clearTimeout(d._listoT); d._listoT = setTimeout(() => d.classList.remove('listo'), 500); }   // quitarla: si no, pisaba el latido de .urge
}
function pintarCds() {
  const ahora = performance.now();
  $('barra').querySelectorAll('[data-hab]').forEach(d => {
    const h = habPorId(d.dataset.hab), c = cdHab[h.id];
    let k = c && c.fin > ahora ? (c.fin - ahora) / c.ms : 0;
    if (h.gcd !== false && gcdHasta > ahora) k = Math.max(k, (gcdHasta - ahora) / GCD_MS);
    d.querySelector('.cd').style.setProperty('--k', k.toFixed(3));   // recarga radial (conic-gradient en el CSS)
    // Solo recargas propias (no el GCD de 1 s, que saltaria tras cada golpe).
    marcarListo(d, c && c.fin > ahora ? 1 : 0, !d.classList.contains('bloq') && !(yo && yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec)));
    // Segundos que faltan (como en CLASSIC); con menos de 1 s, decimos.
    const fa = c ? c.fin - ahora : 0, cs = d.querySelector('.cs'), s = fa >= 1000 ? String(Math.ceil(fa / 1000)) : fa > 0 ? (fa / 1000).toFixed(1) : '';
    if (cs && cs.textContent !== s) cs.textContent = s;
    const sin = yo && yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec);
    d.style.filter = sin && yo.nivel >= h.nv ? 'grayscale(.8) brightness(.7)' : '';
  });
  $('barra').querySelectorAll('[data-pw]').forEach(d => {
    const p = PODERES.find(x => x.id === d.dataset.pw), fin = cdPoder[p.id] || 0;
    d.querySelector('.cd').style.setProperty('--k', (fin > ahora ? (fin - ahora) / p.cd : 0).toFixed(3));
    marcarListo(d, fin > ahora ? 1 : 0, !!(yo && yo.pw && yo.pw[p.id] > 0));
    const fa = fin - ahora, cs = d.querySelector('.cs'), s = fa >= 1000 ? String(Math.ceil(fa / 1000)) : fa > 0 ? (fa / 1000).toFixed(1) : '';
    if (cs && cs.textContent !== s) cs.textContent = s;
  });
}
let objPintado = '';
// Chip del bestiario bajo la vida del objetivo: cazas de ese tipo, el siguiente
// hito (BESTIARIO_HITOS, que da oro) y una estrella por hito cumplido. Una sola
// linea recortada: en movil el marco tiene ancho fijo y no crece.
const bestRec = new Map();   // ultimos objetivos marcados: id -> tipo
let bestGana = 0, bestMuere = null;
function pintarChipBest(k, def) {
  let c = $('o-best');
  const n = yo && yo.best && def && !def.mundial ? yo.best[k] || 0 : -1;
  if (n < 0) { if (c) c.style.display = 'none'; return; }
  if (!c) {
    c = document.createElement('div'); c.id = 'o-best';
    c.style.cssText = 'font:600 10px var(--sans);color:var(--txt2,#cbd5e1);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.2;';
    $('obj').appendChild(c);
  }
  const hechos = BESTIARIO_HITOS.filter(h => n >= h).length, sig = BESTIARIO_HITOS.find(h => n < h);
  const est = '★'.repeat(hechos) + '☆'.repeat(BESTIARIO_HITOS.length - hechos);
  const txt = '📖 ' + (sig ? n + '/' + sig : n) + ' ' + est;
  if (c.textContent !== txt) c.textContent = txt;
  c.title = sig ? 'Bestiario: caza ' + (sig - n) + ' más de este tipo para ganar oro' : 'Bestiario completo para este monstruo';
  c.style.display = 'block';
}
// El servidor solo manda 'best' en el 'yo' completo: se suma aqui al ver morir
// al objetivo y llegar su 'gana' casi a la vez (el 'yo' siguiente lo corrige).
function sumarBest(k) {
  if (!yo || !yo.best || !k || !MONSTRUOS[k] || MONSTRUOS[k].mundial) return;
  yo.best[k] = (yo.best[k] || 0) + 1; objPintado = '';
}
function bestDeMuerte(id) {
  const k = bestRec.get(id); if (!k) return;
  bestRec.delete(id);
  if (Date.now() - bestGana < 1500) { bestGana = 0; sumarBest(k); } else bestMuere = { k, t: Date.now() };
}
// «¡Casi!»: cuando un logro pendiente pasa del 80 %, un aviso (una vez por logro
// en este navegador, dq3_casi) y como mucho uno cada 2 minutos.
let casiUlt = 0;
// Logros pendientes al 80 % o mas (metas de 5 o mas), en el orden de LOGROS: [{ L, p: [hecho, meta] }].
function logrosCasi() {
  const tienen = (yo && yo.logros) || [], r = [];
  for (const L of LOGROS) {
    if (tienen.includes(L.id)) continue;
    let p = null; try { p = progresoLogro(L.id, { ...yo, amigos: yo.amigosN || 0 }); } catch (e) { p = null; }
    if (!p || !(p[1] >= 5) || p[0] / p[1] < 0.8 || p[0] >= p[1]) continue;   // metas de 1-4 no tienen «casi»
    r.push({ L, p });
  }
  return r;
}
function revisarCasi() {
  if (!yo || !yo.clase || Date.now() - casiUlt < 120000) return;
  // Con una ventana abierta o en el tutorial temprano del movil el aviso (prioridad 3) se perderia: se espera a otra caza.
  try { if (avisoTapado() || (COMPACTO && tuto3.i >= 0 && tuto3.i < 3 && yo.nivel <= 6)) return; } catch (e) {}
  let visto = {}; try { visto = JSON.parse(localStorage.getItem('dq3_casi') || '{}') || {}; } catch (e) { visto = {}; }
  for (const { L, p } of logrosCasi()) {
    if (visto[L.id]) continue;
    visto[L.id] = 1; casiUlt = Date.now();
    try { localStorage.setItem('dq3_casi', JSON.stringify(visto)); } catch (e) {}
    aviso('🎯 ¡Casi! ' + L.titulo + ' ' + p[0].toLocaleString('es') + '/' + p[1].toLocaleString('es') + (L.oro ? ' · +' + L.oro.toLocaleString('es') + ' oro' : ''), 'ok', 3);
    return;
  }
}
function bestDeGana(m) {
  if (!m || !m.xp || m.coop || !Array.isArray(m.drops)) return;
  if (bestMuere && Date.now() - bestMuere.t < 1500) { const k = bestMuere.k; bestMuere = null; sumarBest(k); } else bestGana = Date.now();
}
// Bestiario: la primera vez que marcas cada monstruo, su linea de lore (una vez por
// navegador; en el tutorial temprano del movil espera a otra ocasion).
let bestiaVista = null;
function bestiario3(k, nombre) {
  if (!LORE_MONSTRUOS[k]) return;
  if (!bestiaVista) { bestiaVista = new Set(); try { for (const x of (localStorage.getItem('dq3_bestia') || '').split(',')) if (x) bestiaVista.add(x); } catch (e) {} }
  if (bestiaVista.has(k)) return;
  try { if (COMPACTO && tuto3.i >= 0 && tuto3.i < 3 && yo && yo.nivel <= 6) return; } catch (e) {}
  if (avisoTapado()) return;   // con una ventana abierta iria a la cola y podria vencer: se marca cuando de verdad se ve
  bestiaVista.add(k);
  try { localStorage.setItem('dq3_bestia', [...bestiaVista].join(',')); } catch (e) {}
  aviso('📖 ' + nombre + ': ' + LORE_MONSTRUOS[k], undefined, 3);
}
function pintarObjetivo() {
  const o = mons.get(objetivo);
  const caja = $('obj');
  if (!o) { if (objPintado !== '-') { caja.style.display = 'none'; anillo.visible = false; objPintado = '-'; } return; }
  const clave = o.id + '|' + Math.ceil(o.hp) + '|' + o.mx + '|' + (yo ? yo.nivel : 0) + '|' + (yo && yo.best ? yo.best[o.k] || 0 : -1) + '|' + (yo && yo.bestD && yo.bestD[o.k] ? 1 : 0);
  if (clave !== objPintado) {
    objPintado = clave;
    const def = MONSTRUOS[o.k];
    bestRec.delete(o.id); bestRec.set(o.id, o.k); if (bestRec.size > 4) bestRec.delete(bestRec.keys().next().value);
    pintarChipBest(o.k, def);
    caja.style.display = 'block';
    // Debilidad ya descubierta (bestD): su emoji junto al nombre.
    $('o-nombre').textContent = (o.j ? '★ ' : '') + def.nombre + (def.debil && yo && yo.bestD && yo.bestD[o.k] ? ' ' + (DEBIL_EMO[def.debil] || '') : '');
    $('o-nivel').textContent = marcaNivel(o.nv) + 'Nv ' + o.nv;
    bestiario3(o.k, def.nombre);
    const hp = $('o-hp');
    hp.firstElementChild.style.transform = `scaleX(${clamp(o.hp / o.mx, 0, 1)})`;
    hp.lastElementChild.textContent = Math.ceil(o.hp) + ' / ' + o.mx;
  }
  // Barra de lanzamiento del objetivo (se repinta cada cuadro mientras dura).
  const bc = $('o-cast'), ahC = performance.now();
  if (o.cast && o.cast.fin > ahC) { bc.style.display = 'block'; bc.firstElementChild.style.transform = `scaleX(${clamp((ahC - o.cast.ini) / (o.cast.fin - o.cast.ini), 0, 1)})`; bc.lastElementChild.textContent = '🔮 ' + o.cast.n; }
  else if (bc.style.display !== 'none') bc.style.display = 'none';
  anillo.visible = true;
  anillo.position.set(o.x, alturaEn(o.x, o.z) + 0.08, o.z);
  const s = o.j ? 2 : 1; anillo.scale.set(s, s, s);
}
// En el movil el title no se ve: la primera vez que se toca cada boton de la
// barra se explica con un aviso (una sola vez, sin frenar el golpe).
function avisoPrimeraVez(titulo) {
  let v = {};
  try { v = JSON.parse(localStorage.getItem('dq3_habVistas') || '{}') || {}; } catch (e) {}
  if (v[titulo]) return;
  v[titulo] = 1;
  try { localStorage.setItem('dq3_habVistas', JSON.stringify(v)); } catch (e) {}
  aviso(titulo);
}
const avisos = $('avisos');
// prio: 1 importante (errores, entregas), 2 normal, 3 promo. Con una ventana abierta
// solo salen los de prioridad 1; los demas esperan en cola (30 s como mucho).
// En el movil, durante los 3 primeros pasos del tutorial, solo los de prioridad 1.
// Un mismo texto no se repite antes de 8 s.
const colaAvisos = [], avisoVisto = new Map();
// Antes de entregar la mision 2: como mucho un aviso de prioridad 3 por minuto (no se encola: se pierde).
let avisoBajoT = 0;
function antesMis2() { try { return !!(yo && yo.mis && yo.mis.i < 2); } catch (e) { return false; } }
function aviso(txt, tipo, prio) {
  txt = String(txt); prio = prio || (tipo === 'err' ? 1 : 2);
  const ahora = Date.now();
  if (ahora - (avisoVisto.get(txt) || 0) < 8000) return;
  if (prio > 1) {
    let tutoTemprano = false; try { tutoTemprano = COMPACTO && yo && yo.clase && tuto3.i >= 0 && tuto3.i < TUTO3.length && yo.nivel <= 6; } catch (e) {}
    if (tutoTemprano && prio > 2) return;
    if (prio > 2 && antesMis2()) { if (ahora - avisoBajoT < 60000) return; avisoBajoT = ahora; }
    if (tutoTemprano || avisoTapado()) {
      if (!colaAvisos.some(a => a.txt === txt)) colaAvisos.push({ txt, tipo, prio, vence: ahora + 30000 });
      while (colaAvisos.length > 6) colaAvisos.splice(colaAvisos.reduce((m, a, i, l) => a.prio > l[m].prio ? i : m, 0), 1);
      return;
    }
  }
  pintarAviso(txt, tipo, prio);
}
// Anuncios del servidor a todo el mundo o a toda una zona (eventos3d.js, mundo3d.js, world.js...), no lo que le pasa al jugador.
const AVISO_MUNDO3 = /^(?:🥁|★|💨|💰 El Duende|⚔|🏰|🎖|🌌|🦇|🦎|🗼|⭐|🏆|⚡|👹|🔥 ¡Defensa|⌛)|llega al |ha aparecido en |se marchó del |rechazada\. |ha pescado|ha encontrado un objeto|ha caído\. |ha llegado al piso|Primera victoria del servidor|Empieza la Hora Feliz/;
// Jefe con 10 niveles o mas por encima del jugador, y este lejos: sin texto. Sigue en el mapa y en el HUD, para quien quiera ir.
function jefeLejano3(txt) {
  try {
    const nm = /^¡?(.+?)(?: llega al | ha aparecido en | se marchó del | se enfurece)/.exec(txt);
    const def = nm && Object.values(MONSTRUOS).find(d => d.jefe && d.nombre === nm[1]);
    if (!def || !yo || def.nivel - yo.nivel < 10) return false;
    if (def.mundial) return Math.hypot(P.x - ARENA3D.x, P.z - ARENA3D.z) > ARENA3D.r + 40;
    const zona = MAPAS[zonaEn(P.x, P.z)];
    return !(zona && txt.includes(zona.nombre));
  } catch (e) { return false; }
}
// «Cazaron juntos con X. ¿Hacen grupo?» (social.js cazaJuntos): aviso con boton.
// Espera (hasta ~1 min) si hay una ventana abierta o un jefe cerca; si ya tienes grupo, nada.
function jefeCerca() { try { for (const o of mons.values()) { if (o.muereT || o.st === 3) continue; const dj = MONSTRUOS[o.k]; if ((o.j || (dj && dj.jefe)) && Math.hypot(o.x - P.x, o.z - P.z) < 45) return true; } } catch (e) {} return false; }
function ofertaGrupo(m, n) {
  n = n || 0;
  if (grupo3 || !yo || n > 40) return;
  if (avisoTapado() || jefeCerca() || avisos.children.length >= (COMPACTO ? 2 : 4)) return setTimeout(() => ofertaGrupo(m, n + 1), 1500);
  const d = document.createElement('div'); d.className = 'ok'; d._prio = 1; d._ofDe = m.n;
  d.style.pointerEvents = 'auto';
  d.textContent = m.m + ' ';
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = '👥 Hacer grupo';
  b.style.cssText = 'margin:6px 0 0;display:block;width:100%;min-height:36px;font-size:14px';
  b.onclick = e => { e.stopPropagation(); if (!grupo3) mandar({ t: 'invitar', p: m.ofreceGrupo }); d.remove(); };
  d.appendChild(b);
  avisos.appendChild(d);
  try { sfx('moneda', 0.3); } catch (e) {}
  setTimeout(() => d.remove(), 15000);
}
// «La gente del bosque te cuenta» (misiones secundarias): tarjeta tocable #npc-dice con la historia
// partida en burbujas de 1-2 frases. Si hay una ventana abierta o estas peleando, espera en cola
// (reintenta cada 1,5 s): nunca se descarta y salen en orden. ya: sin esperar (Releer del diario).
const NPC_EMOJI = { 'Abuela Sisa': '👵', 'Tayta Mallku': '👴', 'Chamán Amaru': '🌿', 'Herrera Coya': '⚒️', 'Viajera Illari': '🐪', 'Espía Kantu': '🗡️', 'Guardián Inti': '☀️', 'Minera Ñusta': '⛏️', 'Farera Quilla': '🏮', 'Sabia Mama Ocllo': '🦅', 'Mama Asiri': '🥤', 'Guardia Tito': '🛡', 'Mercader Grumo': '💰', 'Sabio Hechicero': '📖', 'Artesana Lila': '🧵' };
// Retrato pixelado de cada narrador (hoja de HOJAS): la tarjeta lo pinta en vez del emoji.
const NPC_HOJA = { 'Abuela Sisa': 'goblin_peasant', 'Tayta Mallku': 'goblin_peasant', 'Chamán Amaru': 'goblin_mage', 'Sabia Mama Ocllo': 'goblin_mage', 'Herrera Coya': 'goblin_guard', 'Guardián Inti': 'goblin_guard', 'Espía Kantu': 'goblin_assassin', 'Viajera Illari': 'goblin_normal', 'Minera Ñusta': 'goblin_centurion', 'Farera Quilla': 'goblin_samurai', 'Mama Asiri': 'goblin_peasant', 'Guardia Tito': 'goblin_guard', 'Mercader Grumo': 'goblin_peasant', 'Sabio Hechicero': 'hechicero', 'Artesana Lila': 'goblin_mage' };
const colaNpc = []; let npcT = 0;
function npcBurbujas(txt) {
  const out = [];
  for (const f of String(txt || '').trim().replace(/([.!?…])\s+(?=[¡¿«"A-ZÁÉÍÓÚÑ])/g, '$1\n').split('\n').filter(Boolean)) {   // sin lookbehind: iOS < 16.4 no lo entiende
    const u = out[out.length - 1];
    if (u && u.n < 2 && (u.t + ' ' + f).length <= 90) { u.t += ' ' + f; u.n++; } else out.push({ t: f, n: 1 });
  }
  return out.map(b => b.t);
}
function npcOcupado() {
  try {
    if (avisoTapado() || autoAtk || jefeCerca()) return true;
    const t = performance.now();
    return !!(P && (P.muerto || t - (P.heridoT || 0) < 6000 || t - (P.atkT || 0) < 6000)) || !!$('probar-clase');   // sin mirar el objetivo: al morir el monstruo vuelve a 0, y la tarjeta no debe saltar en plena caza
  } catch (e) { return false; }
}
// texto: un texto o una lista (la ultima con sigue: 'frase de suspense' sale en dorado).
function npcDice(quien, texto, emoji, ya, sigue) {
  const b = [].concat(texto).flatMap(npcBurbujas), s = sigue ? npcBurbujas(sigue) : [];
  if (!b.length && !s.length) return;
  const it = { quien: String(quien || ''), emoji: emoji || NPC_EMOJI[quien] || '📖', hoja: NPC_HOJA[quien] || '', b: b.concat(s), nS: b.length, ya: !!ya };
  if (ya) colaNpc.unshift(it); else colaNpc.push(it);
  npcSiguiente();
}
function npcSiguiente() {
  clearTimeout(npcT); npcT = 0;
  const d0 = $('npc-dice');
  if ((d0 && d0.classList.contains('on')) || !colaNpc.length) return;
  if (!colaNpc[0].ya && npcOcupado()) { npcT = setTimeout(npcSiguiente, 1500); return; }
  const it = colaNpc.shift();
  let d = d0;
  if (!d) {
    d = document.createElement('div'); d.id = 'npc-dice'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-live', 'polite');
    d.innerHTML = '<div class="nd-cab"><span class="nd-cara"></span><b class="nd-quien"></b><small class="nd-pag"></small></div><p class="nd-txt"></p><div class="nd-bot"><button type="button" class="btn sec nd-saltar">Saltar</button><button type="button" class="btn nd-seguir">Seguir ▸</button></div>';
    document.body.appendChild(d);
    for (const ev of ['pointerdown', 'touchstart', 'mousedown']) d.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  }
  let i = 0;
  // Texto que se escribe letra a letra (~45/s, pausa tras . , ! ?); de golpe si el jugador lo pidio
  // (dq3_txtvel = 'rapido') o el sistema pide menos movimiento. El dorado de 'sigue' llega al terminar.
  let rapido = false;
  try { rapido = matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('dq3_txtvel') === 'rapido'; } catch (e) {}
  const pararEsc = () => { clearTimeout(d._escT); d._escT = 0; d._escribe = null; };
  const pinta = () => {
    pararEsc();
    const p = d.querySelector('.nd-txt'), txt = it.b[i], dorado = i >= it.nS;
    const acaba = () => { pararEsc(); p.textContent = txt; p.classList.toggle('sigue', dorado); d.setAttribute('aria-busy', 'false'); };
    d.setAttribute('aria-busy', 'true');
    p.classList.remove('sigue');
    if (rapido) acaba();
    else {
      let k = 0; p.textContent = '';
      const paso = () => {
        k++; p.textContent = txt.slice(0, k);
        if (k >= txt.length) return acaba();
        d._escT = setTimeout(paso, 22 + (/[.,!?…]/.test(txt[k - 1]) ? 120 : 0));
      };
      d._escribe = acaba; d._escT = setTimeout(paso, 22);
    }
    d.querySelector('.nd-pag').textContent = it.b.length > 1 ? (i + 1) + '/' + it.b.length : '';
    d.querySelector('.nd-seguir').textContent = i < it.b.length - 1 ? 'Seguir ▸' : 'Cerrar ✓';
    d.querySelector('.nd-saltar').style.display = i < it.b.length - 1 ? '' : 'none';
  };
  const fin = () => { pararEsc(); d.classList.remove('on'); d.onclick = null; setTimeout(npcSiguiente, 400); };
  const cara = d.querySelector('.nd-cara'), nq = NPCS3D.find(x => x.nombre === it.quien);
  cara.textContent = it.emoji;
  if (it.hoja || nq) retratoNpc(it.hoja || nq.hoja).then(u => { if (u && d.querySelector('.nd-quien').textContent === it.quien) cara.innerHTML = `<img src="${u}" alt="" style="width:100%;height:100%;image-rendering:pixelated;border-radius:50%">`; });
  d.querySelector('.nd-quien').textContent = it.quien;
  d.onclick = e => {
    e.stopPropagation();
    // Saltar va primero: corta la maquina de escribir y salta al dorado (si hay) o cierra al primer toque.
    if (e.target.closest('.nd-saltar')) { pararEsc(); if (i < it.nS && it.nS < it.b.length) { i = it.nS; pinta(); return; } return fin(); }
    if (d._escribe) return d._escribe();   // primer toque: completa la frase
    if (i >= it.b.length - 1) return fin();
    i++; pinta(); try { vibSel(); } catch (er) {}
  };
  pinta(); d.classList.add('on');
  try { sfx('moneda', 0.2); } catch (e) {}
}
function avisoTapado() { try { return hayVentana() || (COMPACTO && hayLateral()) || $('v-diario').classList.contains('on') || !!cineEst; } catch (e) { return false; } }
// Movil: como mucho 2 lineas de aviso a la vez; lo largo se parte en trozos de 2 lineas que salen en orden.
function letrasPorLineaAviso() { return Math.max(24, Math.floor(((avisos.clientWidth || 320) - 28) / ((document.body.classList.contains('texto-grande') ? 15 : 14) * 0.54))); }
function lineasAvisoTxt(txt) { return String(txt).length > letrasPorLineaAviso() ? 2 : 1; }
function cabeAviso(txt) { let n = 0; for (const c of avisos.children) n += c._lin || 0; return n + lineasAvisoTxt(txt) <= 2; }   // las ofertas con boton (grupo, LFG) duran hasta 30 s: no cuentan, para no frenar la cola
function trozosAviso(txt) {
  const tope = Math.floor(letrasPorLineaAviso() * 1.8), out = [];
  let r = String(txt).trim();
  while (r.length > tope + 1) {   // +1: un trozo que ya lleva su «…» no se vuelve a partir al salir de la cola
    const c = r.slice(0, tope);
    let k = -1;
    for (let i = c.length - 1; i >= tope * 0.45 && k < 0; i--) if (/[.!?…]/.test(c[i]) && c[i + 1] === ' ') k = i + 1;
    if (k > 0) { out.push(r.slice(0, k).trim()); r = r.slice(k).trim(); continue; }
    const e = c.lastIndexOf(' '), corte = e > tope * 0.45 ? e : tope;
    out.push(r.slice(0, corte).trim() + '…'); r = r.slice(corte).trim();
  }
  if (r) out.push(r);
  return out;
}
// Franja de avisos justo bajo lo que haya arriba en su columna (se mide: el HUD cambia con misiones, grupo o Telegram).
let rectsHud = [];
const HUD_ARRIBA = ['marco', 'grupo3', 'misiones', 'alas', 'obj', 'objp', 'mini', 'botones', 'chicha3', 'cofre-meta', 'tira-diario', 'probar-clase', 'invit3', 'chat'];
function colocarAvisos() {
  if (!COMPACTO) { rectsHud = []; return; }
  try {
    const az = avisos.getBoundingClientRect(), vh = innerHeight, rs = [];
    let y = 0;
    for (const id of HUD_ARRIBA) {
      const el = $(id); if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0) continue;
      if (id === 'chat' && ($('chat-in').style.display !== 'block' || r.bottom + 6 > vh * 0.42)) continue;   // solo el chat abierto para escribir: el que sale solo con un mensaje cede ante los avisos
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
      if (id === 'marco' || id === 'misiones' || id === 'mini' || id === 'botones' || id === 'obj' || id === 'grupo3') rs.push(r);
      if (r.top < vh * 0.4 && r.bottom < vh * 0.6 && (!az.width || (r.left < az.right && r.right > az.left))) y = Math.max(y, r.bottom);
    }
    rectsHud = rs;
    // La tarjeta de «lo siguiente» va justo bajo el HUD (--hud-fin); los avisos, bajo ella si comparten columna.
    const fin = Math.round(y ? y + 6 : 8);
    if (fin !== colocarAvisos.fin) { colocarAvisos.fin = fin; document.documentElement.style.setProperty('--hud-fin', fin + 'px'); }
    const sig = $('ob-sig');
    let rg = null;
    if (sig && !sig.classList.contains('salida')) { const r = sig.getBoundingClientRect(); if (r.left < az.right && r.right > az.left) rg = r; }
    const top = Math.round(rg ? Math.min(rg.bottom + 6, vh * 0.58) : Math.min(y ? y + 6 : 8, vh * 0.42));
    if (top !== colocarAvisos.ult) { colocarAvisos.ult = top; document.documentElement.style.setProperty('--av-top', top + 'px'); }
  } catch (e) {}
}
setInterval(colocarAvisos, 700);
addEventListener('resize', colocarAvisos);
// PC: la caja de misiones empieza justo bajo el minimapa (su alto cambia con el texto) y nunca se sale de la pantalla.
function medirMiniPc() {
  const mi = $('mini'); if (!mi) return;
  const b = mi.getBoundingClientRect().bottom, r = document.documentElement.style;
  r.setProperty('--mini-b', Math.round(b) + 'px');
  r.setProperty('--mis-max', Math.max(140, Math.round(innerHeight - b - 34)) + 'px');
  if ($('marco')) r.setProperty('--marco-b', Math.round($('marco').getBoundingClientRect().bottom) + 'px');
}
medirMiniPc(); addEventListener('resize', medirMiniPc);
try { const ro = new ResizeObserver(medirMiniPc); ro.observe($('mini')); ro.observe($('marco')); } catch (e) {}
// Las etiquetas del mundo no asoman por el HUD del movil.
function lblTapaHud(s) { for (const r of rectsHud) if (s[0] > r.left - 24 && s[0] < r.right + 24 && s[1] > r.top - 2 && s[1] < r.bottom + 16) return true; return false; }
function pintarAviso(txt, tipo, prio, deCola) {
  if (COMPACTO) {
    colocarAvisos();
    const tr = trozosAviso(txt); let cabe = cabeAviso(tr[0]);
    const antes = !deCola && colaAvisos.some(a => a.prio <= prio);
    if (!cabe && !antes) {
      // Lo importante entra al instante en lugar de lo que pese menos.
      for (const c of [...avisos.children]) if (c._lin && (c._prio || 2) > prio) c.remove();
      cabe = cabeAviso(tr[0]);
    }
    if (!cabe || antes) {
      if (/^🎆 \d+…$/.test(txt)) return;   // la cuenta atras no se atrasa
      if (tr.length > 1) avisoVisto.set(txt, Date.now());   // el mismo texto largo otra vez no deja trozos sueltos sin su inicio
      if (!colaAvisos.some(a => a.txt === tr[0])) for (const t of tr) colaAvisos.push({ txt: t, tipo, prio, vence: Date.now() + 45000 });
      while (colaAvisos.length > 8) colaAvisos.splice(colaAvisos.reduce((m, a, i, l) => a.prio > l[m].prio ? i : m, 0), 1);
      return;
    }
    if (tr.length > 1) { avisoVisto.set(txt, Date.now()); for (let i = tr.length - 1; i > 0; i--) colaAvisos.unshift({ txt: tr[i], tipo, prio, vence: Date.now() + 45000 }); txt = tr[0]; }
  }
  const max = COMPACTO ? 2 : 4;
  if (!COMPACTO && avisos.children.length >= max) {
    // Lleno: sale el de menor prioridad (el mas viejo si empatan); si todos pesan mas, este espera.
    let v = null; for (const c of avisos.children) if (!v || (c._prio || 2) > (v._prio || 2)) v = c;
    if (v && (v._prio || 2) >= prio) v.remove();
    else { if (!colaAvisos.some(a => a.txt === txt)) colaAvisos.unshift({ txt, tipo, prio, vence: Date.now() + 30000 }); while (colaAvisos.length > 6) colaAvisos.pop(); return; }
  }
  avisoVisto.set(txt, Date.now());
  if (avisoVisto.size > 60) avisoVisto.delete(avisoVisto.keys().next().value);
  const d = document.createElement('div'); d.textContent = txt; if (tipo) d.className = tipo; d._prio = prio; d._lin = lineasAvisoTxt(txt);
  avisos.appendChild(d);
  if (tipo === 'err' && !/^(¡|📍|🥤|🔮)|Furia x\d/.test(txt)) { const ahN = performance.now(); if (ahN - (pintarAviso.noT || 0) >= 1500) { pintarAviso.noT = ahN; try { SON.tocar('no'); } catch (e) {} vib('error'); } }   // «no se pudo» con sonido propio, tope 1 cada 1,5 s
  setTimeout(() => { d.classList.add('fuera'); setTimeout(() => d.remove(), 190); }, Math.min(12000, Math.max(4500, txt.length * 60)));   // los largos (lore, premios) se leen enteros
}
setInterval(() => {
  if (!colaAvisos.length) return;
  const ahora = Date.now();
  for (let i = colaAvisos.length - 1; i >= 0; i--) if (colaAvisos[i].vence < ahora) colaAvisos.splice(i, 1);
  if (!colaAvisos.length || avisos.children.length >= (COMPACTO ? 2 : 4)) return;
  let tutoTemprano = false; try { tutoTemprano = COMPACTO && yo && yo.clase && tuto3.i >= 0 && tuto3.i < TUTO3.length && yo.nivel <= 6; } catch (e) {}
  // Movil: sale primero lo mas importante y, a igual peso, el mas antiguo (los trozos de un aviso largo van seguidos).
  const iSig = COMPACTO ? colaAvisos.reduce((m, a, i, l) => a.prio < l[m].prio ? i : m, 0) : 0;
  const urge = COMPACTO && colaAvisos[iSig].prio === 1;
  if ((avisoTapado() && !urge) || (tutoTemprano && !urge)) return;
  if (COMPACTO && !cabeAviso(colaAvisos[iSig].txt)) return;
  const a = colaAvisos.splice(iSig, 1)[0]; if (ahora - (avisoVisto.get(a.txt) || 0) < 8000) return; avisoVisto.delete(a.txt); pintarAviso(a.txt, a.tipo, a.prio, true);
}, 900);
// Lo que no debe tapar el tutorial (leyenda, vestuario, promos) espera a la mision 1
// entregada; si no la entrega, sale igual desde Nv 4 o a los 6 min para no quedarse sin ver.
function despuesMision1(fn, n) {
  n = n || 0;
  if (yo && yo.clase && ((yo.mis && yo.mis.i >= 1) || yo.nivel >= 4 || n >= 120)) fn();
  else setTimeout(() => despuesMision1(fn, n + 1), 3000);
}
// ── PESCA ──
let pica = 0, corcho = null;
let picaRecibida = 0;   // cuando llego la pica: el servidor recibe la reaccion real (sin la red) al tirar
function aguaCerca() {
  if (enAbismo(P.x)) return null;   // bajo las islas no hay agua: hay vacio
  for (let r = 2; r <= 6; r += 2) for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
    if (alturaEn(x, z) < MUNDO.agua - 0.6) return { x, z };
  }
  return null;
}
function ponerCorcho() {
  const w = aguaCerca(); if (!w) return;
  quitarCorcho();
  corcho = new THREE.Group();
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe11d48 }));
  corcho.add(a, b); corcho.position.set(w.x, MUNDO.agua + 0.05, w.z); corcho.userData.y0 = MUNDO.agua + 0.05;
  // Amagos: 1-2 temblores cortos (solo visual). Tocar en uno no tira: hablar() solo avisa hasta la pica real.
  const ahA = performance.now(); corcho.userData.am = [ahA + 1200 + Math.random() * 3000];
  if (Math.random() < 0.6) corcho.userData.am.push(ahA + 4500 + Math.random() * 3500);
  escena.add(corcho);
  SON.tocar('splash', { vol: 0.35, fuerza: 0.2 });   // el corcho cae al agua
}
function quitarCorcho() { if (corcho) { escena.remove(corcho); liberar(corcho); corcho = null; } pica = 0; }

// ── GRUPO ──
let invitT = 0, invitTipo = 'grupo', dueloCon = 0;
let enLinea3 = 0, hoy3 = 0;   // conectados ahora y duendes que jugaron hoy (cifras reales del servidor: 'bienvenido'.on y {t:'on'})
let contactos3 = [], quien3 = null, inv3 = null;   // inv3: «Mis invitados» (amigos.js infoAmigos). Ventana 👥: tus amigos y quien esta en linea (null: aun no llego)
const enGrupo = id => !!(grupo3 && grupo3.m.some(x => x.on && x.id === id));
let salirPend = 0;   // "Salir del grupo" pide dos toques: el pulgar que iba al joystick lo pulsaba sin querer
function pintarGrupo() {
  const c = $('grupo3');
  if (!grupo3) { c.style.display = 'none'; c.innerHTML = ''; return; }
  c.style.display = 'block';
  const lider = grupo3.lider, soyLider = !!(yo && lider === yo.pid);
  // Distancia y flecha al compañero (en pasos de 10 m: el marco no se rehace cada paso).
  const aDonde = x => {
    if (!x.on || x.k !== '~3d' || x.muerto) return '';
    const o = x.id && otros.get(x.id), px = o ? o.x : x.p3 && x.p3[0], pz = o ? o.z : x.p3 && x.p3[1];
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return '';
    if (!enCueva(px) !== !enCueva(P.x) || !enAbismo(px) !== !enAbismo(P.x)) return enCueva(px) ? ' · en la cueva' : enAbismo(px) ? ' · en el Abismo' : ' · afuera';
    const dr = Math.hypot(px - P.x, pz - P.z), d = Math.round(dr / 10) * 10;
    return dr < 10 ? ' · aquí' : ` · ${d} m ${flechaDir(px, pz)}`;
  };
  const html = `<div style="font:700 10px var(--sans);color:var(--txt3);margin-bottom:3px">${grupo3.banda ? 'BANDA' : 'GRUPO'}</div>` + grupo3.m.filter(x => x.id !== miId).map(x => {
    const cl = CLASES[x.cl];
    const fuera = !x.on || x.k !== '~3d';
    return `<span class="mi${fuera ? ' lejos' : ''}${x.id === objetivoP ? ' sel' : ''}" data-id="${x.id || 0}"><b style="color:${cl ? cl.color : '#fff'}">${x.uid === lider ? '👑 ' : ''}${esc(x.n)}</b> <small>Nv${x.lv || '?'}${!x.on ? ' · desconectado' : x.k !== '~3d' ? ' · en el 2D' : x.muerto ? ' · ☠' : ''}${aDonde(x)}</small>`
      + (x.on ? `<div class="barra hp"><i style="transform:scaleX(${clamp((x.hp || 0) / (x.mx || 1), 0, 1).toFixed(2)})"></i></div>` : '') + '</span>';
  }).join('') + (soyLider ? `<button class="btn sec" id="g-banda" style="margin-top:4px;width:100%;padding:4px;font-size:10px">${grupo3.banda ? 'Volver a grupo' : '⚔️ Hacer banda (10)'}</button>` : '')
    + (soyLider && grupo3.m.length < (grupo3.banda ? 10 : 5) ? '<button class="btn sec" id="g-link" style="margin-top:4px;width:100%;padding:4px;font-size:10px">📲 Invitar a mi grupo</button>' : '')
    + '<button class="btn sec salir" id="g-salir">' + (Date.now() - salirPend < 4000 ? '¿Seguro? Toca otra vez' : 'Salir del grupo') + '</button>';
  if (c.innerHTML && html === pintarGrupo.ult) return;   // igual que antes: no rehacer (no se pierde el toque en móvil)
  pintarGrupo.ult = html;
  c.innerHTML = html;
  if ($('g-banda')) $('g-banda').onclick = () => { if (grupo3) mandar({ t: 'banda', si: !grupo3.banda }); };
  if ($('g-link')) { $('g-link').onclick = invitarGrupoLink; if (!refAmigo && !pintarGrupo.pidio) { pintarGrupo.pidio = true; mandar({ t: 'amigos' }); } }   // el codigo llega antes del toque
  c.querySelectorAll('.mi').forEach(e => e.onclick = () => { const id = +e.dataset.id; if (id && otros.has(id)) { objetivoP = id; pintarObjetivoP(); pintarGrupo(); } });
  $('g-salir').onclick = () => {
    if (Date.now() - salirPend < 4000) { salirPend = 0; mandar({ t: 'salirGrupo' }); return; }
    salirPend = Date.now(); pintarGrupo(); setTimeout(() => { if (Date.now() - salirPend >= 4000) pintarGrupo(); }, 4100);
  };
}
setInterval(() => { if (grupo3 && !document.hidden) pintarGrupo(); }, 1500);   // distancia al compañero al día (solo rehace si cambió)
function pintarObjetivoP() {
  const o = otros.get(objetivoP);
  const caja = $('objp');
  if (!o || objetivo) { caja.style.display = 'none'; return; }
  caja.style.display = 'block';
  const cl = CLASES[o.cl];
  const ene = enemigoP(o.id);
  $('op-nombre').textContent = (ene ? '⚔ ' : '') + o.n; $('op-nombre').style.color = ene ? '#ff4d4d' : cl ? cl.color : '#fff';
  $('op-nivel').textContent = 'Nv ' + o.lv + (cl ? ' · ' + cl.nombre : '');
  // Su skin, con el atajo a la tienda: es cuando más ganas da tenerla.
  const sk = o.sk && o.sk !== 'comun' && SKINS[o.sk];
  const bs = $('op-skin');
  if (!sk) bs.style.display = 'none';
  else {
    bs.style.display = ''; bs.style.color = '#fff'; bs.style.borderColor = sk.color || '';
    const conOro = typeof sk.precio === 'number', conPaq = !!sk.usd;   // PAQUETES crea 'skin_<id>' para toda skin con usd
    if ((yo && yo.skins || []).includes(o.sk)) { bs.textContent = '✨ ' + sk.nombre + ' · Ya la tienes'; bs.onclick = null; }
    else if (conOro || conPaq) { bs.textContent = '✨ Skin ' + sk.nombre + ' · ¿La quieres?'; const id = o.sk; bs.onclick = () => { sfx('boton', 0.2); if (conOro) V.abrirTienda('skin', id, 'hud'); else V.abrirTienda('premium', 'skin_' + id, 'hud'); }; }
    else { bs.textContent = '✨ Skin ' + sk.nombre; bs.onclick = null; }
  }
  // Su look (skin, alas y mascota, solo lo que no es de serie) y el probador con su skin.
  let lk = $('op-look');
  if (!lk) { lk = document.createElement('div'); lk.id = 'op-look'; lk.style.cssText = 'display:none;margin-top:4px;font-size:12px;line-height:1.35'; bs.insertAdjacentElement('afterend', lk); }
  const al = o.al && o.al !== 'aprendiz' && ALAS[o.al], ma = o.ma && MASCOTAS[o.ma];
  const partes = [];
  if (sk) partes.push(`<span style="color:${sk.color || '#fff'}">✨ ${esc(sk.nombre)}</span>`);
  if (al) partes.push(`<span style="color:${al.color || '#c4b5fd'}">🦋 ${esc(al.nombre)}</span>`);
  if (ma) partes.push(`<span style="color:${ma.color || '#ffd84a'}">🐾 ${esc(ma.nombre)}</span>`);
  const claveLk = partes.join('|') + (sk ? o.sk : '');
  if (!partes.length) { lk.style.display = 'none'; lk.dataset.k = ''; }
  else if (lk.dataset.k !== claveLk) {   // solo se rehace si cambia (si no, el botón se recrearía en cada repintado)
    lk.dataset.k = claveLk; lk.style.display = '';
    lk.innerHTML = `<div style="overflow-wrap:anywhere">${partes.join(' <span style="opacity:.5">·</span> ')}</div>` + (sk ? '<button class="btn sec" data-probar style="width:100%;margin-top:4px;min-height:40px;font-size:12px;padding:8px 10px">👀 Probar su skin</button>' : '');
    const b = lk.querySelector('[data-probar]'), idSk = o.sk;
    if (b) b.onclick = () => { sfx('boton', 0.2); probarSkin(idSk, true); };
  }
  const hp = $('op-hp');
  hp.firstElementChild.style.transform = `scaleX(${clamp(o.hp / o.mx, 0, 1)})`;
  hp.lastElementChild.textContent = Math.ceil(o.hp) + ' / ' + o.mx;
  const otraF = o.fc && yo && yo.faccion && o.fc !== yo.faccion;
  $('op-inv').style.display = enGrupo(o.id) || otraF ? 'none' : '';
  $('op-amigo').style.display = contactos3.some(a => a.on && a.id === o.id) ? 'none' : '';
  const miRango = hermInfo && yo && (hermInfo.m.find(x => x.uid === yo.pid) || {}).r;
  $('op-herm').style.display = hermInfo && miRango && miRango !== 'miembro' && !o.hn && !otraF ? '' : 'none';
  $('op-duelo').style.display = otraF && enAbismo(P.x) ? 'none' : '';
}
$('op-inv').onclick = () => { if (objetivoP) mandar({ t: 'invitar', p: objetivoP }); };
$('op-sus').onclick = () => { const o = otros.get(objetivoP); if (!o) return; const i = $('chat-in'); i.style.display = 'block'; i.value = '/s ' + o.n + ' '; i.focus(); };
const tipoResp = () => invitTipo === 'duelo' ? 'retoResp' : invitTipo === 'herm' ? 'hermResp' : 'grupoResp';
$('invit3-si').onclick = () => { mandar({ t: tipoResp(), si: true }); $('invit3').style.display = 'none'; };
$('invit3-no').onclick = () => { mandar({ t: tipoResp(), si: false }); $('invit3').style.display = 'none'; };
$('op-herm').onclick = () => { if (objetivoP) mandar({ t: 'hermInvitar', p: objetivoP }); };
$('op-duelo').onclick = () => { if (objetivoP) mandar({ t: 'retar', p: objetivoP }); };
$('op-amigo').onclick = () => { if (objetivoP) mandar({ t: 'contactoAdd', p: objetivoP }); };
$('op-ign').onclick = () => { const o = otros.get(objetivoP); if (o) mandar({ t: 'ignorar', n: o.n }); };
$('op-rep').onclick = () => { const o = otros.get(objetivoP); if (!o) return; const i = $('chat-in'); i.style.display = 'block'; i.value = '/reportar ' + o.n + ' '; i.placeholder = 'Escribe el motivo y pulsa Enter'; i.focus(); };
// Chat: /g (o /p) al grupo, /s nombre texto susurra; lo demas, general.
// Nombre al principio de un comando: entre comillas, el mas largo de los jugadores
// conocidos (los de Telegram llevan espacios) o, si no, la primera palabra.
function nombreYResto(t) {
  t = t.trim();
  const q = /^"([^"]+)"\s*(.*)$/.exec(t); if (q) return [q[1], q[2]];
  const lt = t.toLowerCase();
  const nombres = [...otros.values()].map(o => o.n).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of nombres) { const ln = n.toLowerCase(); if (lt === ln || lt.startsWith(ln + ' ')) return [n, t.slice(n.length).trim()]; }
  const i = t.search(/\s/); return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i).trim()];
}
function enviarChat(v) {
  const ig = /^\/ignorar\s+(.+)$/i.exec(v), rp = /^\/reportar\s+(.+)$/i.exec(v);
  if (ig) return mandar({ t: 'ignorar', n: nombreYResto(ig[1])[0] });
  if (rp) { const [n, mot] = nombreYResto(rp[1]); return mandar({ t: 'reportar', n, motivo: mot }); }
  const g = /^\/(g|p|grupo)\s+(.+)/i.exec(v), s = /^\/(s|w)\s+(.+)/i.exec(v), hh = /^\/(h|herm|hermandad)\s+(.+)/i.exec(v);
  if (hh) return mandar({ t: 'chat', m: hh[2], canal: 'hermandad' });
  if (g) return mandar({ t: 'chat', m: g[2], canal: 'grupo' });
  if (s) { const [a, txt] = nombreYResto(s[2]); if (txt) return mandar({ t: 'chat', m: txt, canal: 'susurro', a }); return aviso('Escribe: /s Nombre mensaje', 'err'); }
  mandar({ t: 'chat', m: v, canal: 'general' });
}
function lineaChat(m) {
  const d = document.createElement('div');
  if (m.canal === 'grupo') d.style.color = '#7dd3fc';
  if (m.canal === 'susurro') d.style.color = '#f0abfc';
  if (m.canal === 'hermandad') d.style.color = '#4ade80';
  if (m.sis || !m.n) d.textContent = m.m;
  else { const b = document.createElement('b'); b.textContent = (m.canal === 'grupo' ? '[Grupo] ' : m.canal === 'susurro' ? '[Susurro] ' : m.canal === 'hermandad' ? '[Hermandad] ' : '') + (m.gm === 2 ? '[DUEÑO] ' : m.gm ? '[MOD] ' : '') + m.n + ': '; b.style.color = m.gm ? '#ffd84a' : (CLASES[m.cl] ? CLASES[m.cl].color : '#fff'); d.appendChild(b); d.appendChild(document.createTextNode(m.m)); }
  const log = $('chat-log'); log.appendChild(d);
  while (log.children.length > 8) log.firstChild.remove();
  if (COMPACTO) { const ch = $('chat'); ch.classList.add('vivo'); clearTimeout(ch._vivoT); ch._vivoT = setTimeout(() => ch.classList.remove('vivo'), 6000); }   // en el telefono no se queda fija sobre el mundo (index.html)
}
// ── ARCO «LA RECETA Y LA PUERTA» (datos en lore.js) ──
// Escenas y ganchos con npcDice: esperan en cola hasta que estes fuera de combate y salen una vez
// (recordado en este navegador). Lo que no vea un veterano queda para releer en La Receta del Cantaro.
Object.entries({ 'Mama Asiri': ['🥤', 'goblin_peasant'], 'Guardia Tito': ['🛡', 'goblin_guard'], 'Mercader Grumo': ['💰', 'goblin_peasant'], 'Sabio Hechicero': ['📖', 'hechicero'], 'Artesana Lila': ['🧵', 'goblin_mage'], 'Rey Goblin': ['👑', ''] }).forEach(([q, [em, hj]]) => { if (!NPC_EMOJI[q]) NPC_EMOJI[q] = em; if (hj && !NPC_HOJA[q]) NPC_HOJA[q] = hj; });
const capVistosMem = new Set();
// Clave de lo que este navegador recuerda de tu personaje: estable (yo.ck). yo.pid es el id publico y cambia en cada despliegue.
function clavePj() { return (yo && (yo.ck || yo.pid)) || ''; }
function capClave() { return 'dq3_cap_' + (clavePj() || (yo && yo.nombre) || ''); }
function capVisto(k) {
  if (capVistosMem.has(k)) return true;
  try { return (localStorage.getItem(capClave()) || '').split(',').includes(k); } catch (e) { return false; }
}
function capMarcar(k) {
  capVistosMem.add(k);
  try { const v = localStorage.getItem(capClave()) || ''; if (!v.split(',').includes(k)) localStorage.setItem(capClave(), v ? v + ',' + k : k); } catch (e) {}
}
// ya: para Releer. Sale sin esperar, y la cola al frente se llena al reves para conservar el orden.
function decirPartes(partes, ya) {
  const l = partes || [];
  if (!ya) { for (const p of l) npcDice(p[0], p[1], NPC_EMOJI[p[0]], false, p[2]); return; }
  // Con una tarjeta en pantalla nada sale ya y todo entra al frente: se mete entera al reves. Sin tarjeta, la primera sale al toque.
  const nd = $('npc-dice'), hayTarjeta = !!(nd && nd.classList.contains('on'));
  if (!hayTarjeta && l[0]) npcDice(l[0][0], l[0][1], NPC_EMOJI[l[0][0]], true, l[0][2]);
  for (let i = l.length - 1; i > (hayTarjeta ? -1 : 0); i--) npcDice(l[i][0], l[i][1], NPC_EMOJI[l[i][0]], true, l[i][2]);
}
function escenaCapitulo(c) {
  const ci = c && CAPITULOS_INTRIGA[c.z], k = 'e' + (c && c.n);
  if (!ci || capVisto(k)) return;
  capMarcar(k); decirPartes(ci.escena);
}
// Al entrar nunca salta una tarjeta sin relacion con donde estas: la escena espera a que llegues (el capitulo 1, junto a
// Mama Asiri). Solo si aun no empezaste el capitulo: quien ya va por dentro la vio en otro aparato o es un veterano al que
// le llegaria fuera de orden. A este se le dice una vez donde leer la historia desde el principio.
function historiaEntrada() {
  if (!yo || !yo.mis) return;
  const c = capituloDe(yo.mis.i);
  if (c.n === 1 || yo.mis.i <= c.desde) { escenaNoAntes = Date.now() + 45000; return escenaAlLlegar(c); }
  if (capVisto('e' + c.n) || capVisto('rec')) return;
  capMarcar('rec'); aviso('📖 El pueblo guardaba una historia: léela desde el principio en 🎯 Objetivos → La Receta', 'ok', 1);
}
// La escena del capitulo nuevo espera a que llegues a su zona: si saliera detras del gancho, le pisaria el suspenso
// (tras «Fui yo» de Tito, Asiri diria al toque que no le cree). Si hoy no llegas, sale la proxima vez que entres.
// Quien entra ya en la zona no la recibe pegada al saludo: primero 45 s de juego, sin otra tarjeta ni ventana delante.
let escenaEsperaT = 0, escenaNoAntes = 0;
function escenaAlLlegar(c) {
  clearTimeout(escenaEsperaT);
  if (!yo || !yo.mis || capituloDe(yo.mis.i).n !== c.n || capVisto('e' + c.n) || secundarias['x4:ok']) return;   // con el caso cerrado sonaria fuera de orden: queda para releer
  const na = c.n === 1 && NPCS3D.find(n => n.tipo === 'chichera');
  const nd = $('npc-dice'), libre = Date.now() >= escenaNoAntes && !colaNpc.length && !(nd && nd.classList.contains('on')) && !hayVentana();
  if (libre && (na ? Math.hypot(na.x - P.x, na.z - P.z) < 9 : zonaEn(P.x, P.z) === c.z)) escenaCapitulo(c);
  else escenaEsperaT = setTimeout(() => escenaAlLlegar(c), 4000);
}
function historiaAvance(de, a) {
  setTimeout(() => {
    if (!yo) return;
    let cg = null;
    for (const c of CAPITULOS) if (de < finCapitulo(c) && a >= finCapitulo(c)) cg = c;
    if (cg) {
      const conCarta = !!secundarias['x3:ok'], res = !!secundarias['x4:ok'], k = 'g' + cg.n + (res ? 'r' : conCarta ? 'c' : '');
      if (!capVisto(k)) { capMarcar(k); decirPartes(ganchoCapitulo(cg, conCarta, res)); }
    }
    if (capituloDe(a).n !== capituloDe(de).n) escenaAlLlegar(capituloDe(a));
  }, 3500);
}
function historiaSecFin(q, m) {
  const ing = q.ingr && INGREDIENTES.find(x => x.id === q.ingr);
  if (ing) {
    const n = +m.ingrN || ingredientesDe({ ...secundarias, [q.id + ':ok']: 1 }).length;   // 'sec' llega despues de 'secFin'
    // Al cerrar la tarjeta de la mision y con prioridad: en el tutorial del movil, un aviso normal espera y caduca.
    const avisar = i => { const nd = $('npc-dice'); if (i < 90 && ((nd && nd.classList.contains('on')) || colaNpc.length)) { setTimeout(() => avisar(i + 1), 1000); return; } aviso('🌽 Recetario ' + n + '/' + INGREDIENTES.length + ': ' + ing.nombre, 'ok', 1); };
    setTimeout(() => avisar(0), 1200);
  }
  // Con el Dragon ya vencido, la carta de Sami abre aqui la pregunta de Asiri: no hay otro jefe que la traiga.
  if (q.id === 'x3' && yo && yo.mis && yo.mis.i >= LORE_MISIONES.length && !capVisto('g10c')) { capMarcar('g10c'); setTimeout(() => decirPartes(ganchoCapitulo(CAPITULOS[CAPITULOS.length - 1], true)), 500); }
  if (q.id !== 'x4') return;
  // Un momento despues: asi el final del Caso del Traidor (casoFin) entra antes en la cola.
  setTimeout(() => {
    decirPartes(epilogoDe(ingredientesDe({ ...secundarias, 'x4:ok': 1 }).length, yo ? yo.nivel : 1, CHICHA.nv60));
    if (yo && yo.mis && yo.mis.i >= LORE_MISIONES.length && !capVisto('g10r')) { capMarcar('g10r'); decirPartes(ganchoCapitulo(CAPITULOS[CAPITULOS.length - 1], true, true)); }
  }, 500);
}
// La Receta del Cantaro: pagina dentro de la ventana de La Leyenda (nada nuevo en el HUD).
function verReceta() {
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const mi = yo && yo.mis ? yo.mis.i : 0, cur = capituloDe(mi), fin = mi >= LORE_MISIONES.length, conCarta = !!secundarias['x3:ok'], casoCerrado = !!secundarias['x4:ok'];
  const tengo = ingredientesDe(secundarias), g = OBJ.ganchoVivido(), ci = CAPITULOS_INTRIGA[cur.z] || {};
  const filaIng = x => {
    const ok = tengo.includes(x), q = SECUNDARIAS.find(s => s.id === x.mision), zn = (MAPAS[x.zona] || {}).nombre || x.zona;
    return '<p class="vv-p" style="margin:6px 0;' + (ok ? '' : 'opacity:.65') + '"><b style="color:' + (ok ? '#4ade80' : '#e9d5ff') + '">' + (ok ? '✓' : '·') + ' ' + x.emoji + ' ' + esc(x.nombre) + '</b><br><small>' + (ok ? esc(x.dato) : esc(zn) + (q ? ' · Nv ' + q.nv + ' · ' + esc(q.quien) : '')) + '</small></p>';
  };
  const filaCap = c => {
    const llego = c.n <= cur.n, hecho = mi >= finCapitulo(c);
    const est = hecho ? '✓' : llego ? '▶' : '·', col = hecho ? '#4ade80' : llego ? '#fde68a' : '#cbd5e1';
    return '<p class="vv-p" style="margin:6px 0;' + (llego ? '' : 'opacity:.55') + '"><b style="color:' + col + '">' + est + ' Capítulo ' + c.n + ':</b> ' + esc(c.titulo) + (llego ? ' <button type="button" class="btn sec" data-cap-releer="' + c.n + '" style="padding:6px 10px;font-size:12px;margin-top:4px">▶ Releer</button>' : '') + '</p>';
  };
  $('diario-c').innerHTML = '<button type="button" class="btn sec" id="receta-volver" style="padding:6px 10px;font-size:13px;margin-bottom:8px">◂ La Leyenda</button>'
    + '<p class="vv-p">Las reliquias rearman el Cántaro. Los <b style="color:#c084fc">10 ingredientes</b> devuelven lo que va dentro: desde esa noche, la olla de Mama Asiri está vacía.</p>'
    + '<div style="margin:8px 0;padding:8px;border-radius:8px;border-left:3px solid #fde68a;background:rgba(253,230,138,.08)"><b style="color:#fde68a">' + (fin ? '✓ La cadena de Tito está completa' : '▶ Capítulo ' + cur.n + ': ' + esc(cur.titulo)) + '</b>'
    + (fin ? '' : '<p class="vv-p" style="margin:4px 0 0">🎯 ' + esc(ci.objetivo || '') + '</p>')
    + (g.texto ? '<p class="vv-p" style="margin:6px 0 0;color:#fde68a"><b>🕯 El misterio:</b> <i>' + esc(g.texto) + '</i><br><small style="color:#e9d5ff">' + esc(g.quien) + '</small></p>' : '') + '</div>'
    + '<details open style="margin-top:8px"><summary style="cursor:pointer;color:#c084fc;font-weight:700">🥤 El Recetario de Mama Asiri: ' + tengo.length + '/' + INGREDIENTES.length + '</summary>' + INGREDIENTES.map(filaIng).join('')
    + (tengo.length >= INGREDIENTES.length ? '<p class="vv-p" style="margin:8px 0;padding:8px;border-radius:8px;background:rgba(192,132,252,.14)"><b style="color:#c084fc">🥤 Receta de casa</b><br>' + esc(RECETA_DE_CASA) + '</p>' : '') + '</details>'
    + '<details style="margin-top:8px"><summary style="cursor:pointer;color:#fde68a;font-weight:700">📜 Los capítulos: ' + Math.min(cur.n, CAPITULOS.length) + '/' + CAPITULOS.length + '</summary>' + CAPITULOS.map(filaCap).join('') + (secundarias['x4:ok'] ? '<p class="vv-p" style="margin:6px 0"><b style="color:#4ade80">✓ Después de todo</b> <button type="button" class="btn sec" id="receta-epilogo" style="padding:6px 10px;font-size:12px;margin-top:4px">▶ Releer</button></p>' : '') + '</details>'
    + '<p class="vv-p" style="font-size:12px;margin-top:8px">El Recetario es parte de la historia y no suma litros. Los ' + CHICHA.litros60 + ' litros de chicha se ganan en nivel ' + CHICHA.nv60 + ', con las condiciones que ves en ' + K('la barra morada 🥤', '⋯ → Chicha 🥤') + '.</p>';
  $('v-diario').querySelector('h2').textContent = 'LA RECETA DEL CÁNTARO';
  $('receta-volver').onclick = verLeyenda;
  $('diario-c').querySelectorAll('[data-cap-releer]').forEach(b => { b.onclick = e => {
    e.preventDefault();
    const c = CAPITULOS.find(x => x.n === +b.dataset.capReleer), cci = c && CAPITULOS_INTRIGA[c.z]; if (!cci) return;
    cerrar('v-diario');
    capMarcar('e' + c.n);   // releida a mano: ya no vuelve a salir sola
    if (mi >= finCapitulo(c)) capMarcar('g' + c.n);   // y su gancho ya lo leyo: desde aqui puede salir en el panel
    decirPartes(cci.escena.concat(mi >= finCapitulo(c) ? ganchoCapitulo(c, conCarta, casoCerrado) : []), true);
  }; });
  if ($('receta-epilogo')) $('receta-epilogo').onclick = e => { e.preventDefault(); cerrar('v-diario'); decirPartes(epilogoDe(tengo.length, yo ? yo.nivel : 1, CHICHA.nv60), true); };
  abrir('v-diario');
}
// Tarjeta «CAPÍTULO N» al empezar un capitulo de la cadena de Tito (la misma de tituloZona).
// Con un jefe cerca o en pleno combate se pospone 5 s (hasta ~2 min; luego se omite).
function tarjetaCapitulo(c, intento) {
  clearTimeout(tarjetaCapitulo.t);
  tarjetaCapitulo.t = setTimeout(() => {
    if (!c || !yo) return;
    const t = $('titulo-zona'), n = $('tz-n'), s = $('tz-s'); if (!t || !n || !s) return;
    const ahora = performance.now();
    const ocupado = jefeCerca() || camCombate || autoAtk || (P && (P.muerto || ahora - (P.heridoT || 0) < 5000 || (objetivo && ahora - (P.atkT || 0) < 5000)));
    if (ocupado) { if ((intento || 0) < 24) tarjetaCapitulo(c, (intento || 0) + 1); return; }
    const n0 = n.textContent, s0 = s.textContent;
    n.textContent = 'CAPÍTULO ' + c.n; s.textContent = c.titulo;
    t.style.opacity = 1; document.body.classList.add('tz-on');
    try { if (SFX_K.libro) sfxK('libro', 0.3); else SON.tocar('logro', { vol: 0.6 }); } catch (e) {}
    clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = 0; document.body.classList.remove('tz-on'); setTimeout(() => { if (n.textContent === 'CAPÍTULO ' + c.n) { n.textContent = n0; s.textContent = s0; } }, 900); }, 3200);
  }, intento ? 5000 : 1200);
}
// Lore de la zona: primera frase de la intro, solo si no estas ocupado (reintenta cada 5 s, hasta 6 veces).
function loreZona(id, lz, intento, ms, entera) {
  clearTimeout(loreZona.t);
  loreZona.t = setTimeout(() => {
    if (!yo || !P || zonaActual !== id) return;
    const ahora = performance.now();
    const ocupado = vistaZona || jefeCerca() || camCombate || autoAtk || P.muerto || ahora - (P.heridoT || 0) < 5000 || (objetivo && ahora - (P.atkT || 0) < 5000);
    if (ocupado) { if (intento < 6) loreZona(id, lz, intento + 1, 5000, entera); return; }
    let vistas = ''; try { vistas = sessionStorage.getItem('dq3_lz') || ''; } catch (e) {}
    if (vistas.split(',').includes(id)) return;
    try { sessionStorage.setItem('dq3_lz', vistas + ',' + id); } catch (e) {}
    const fr = String(lz.intro || '').split('. '), f0 = entera ? String(lz.intro || '').trim() : fr[0].trim();   // la 1.a visita de la cuenta la lee entera (avisos como el Muki o el Tunche)
    if (f0) aviso('📜 ' + f0 + (fr.length > 1 && !/[.!?…]$/.test(f0) ? '.' : ''));
  }, ms);
}
// Panoramica al descubrir una zona: la camara se aleja, sube y mira al hito, y vuelve sola.
// Se suma como desfase en el bucle de camara (vistaZonaAplicar); cualquier toque o tecla la corta suave.
let vistaZona = null;
function vistaZonaFin() {
  const v = vistaZona; vistaZona = null;
  if (v) { document.removeEventListener('pointerdown', v.cortar, true); document.removeEventListener('keydown', v.cortar, true); }
}
function vistaZonaIniciar(id, dur) {
  if (vistaZona || !yo || !P || P.muerto || camAntes || prueba || cineEst || hayVentana()) return;
  let peligro = camCombate;
  try { for (const o of mons.values()) if (!o.muereT && o.hp > 0 && (o.st === 1 || o.st === 2) && Math.hypot(o.x - P.x, o.z - P.z) < 14) { peligro = true; break; } } catch (e) {}
  if (peligro) return;
  let dy = 0;
  try { const hi = hitoDe(id, ZONAS3D, alturaEn); if (hi && Math.hypot(hi.x - P.x, hi.z - P.z) > 6) { const obj = Math.atan2(P.x - hi.x, P.z - hi.z); dy = lerpAng(camYaw, obj, 1) - camYaw; } } catch (e) {}
  const v = vistaZona = { t0: performance.now(), dur, dy, dd: Math.min(26, camDist * 2.2) - camDist, dp: Math.max(0, Math.min(1.05, camPitch + 0.3) - camPitch), k: 0, corteT: 0, kCorte: 0 };
  v.cortar = e => { if (e && e.type === 'keydown' && /^(Shift|Control|Alt|Meta|OS|PrintScreen)$/.test(e.key)) return; if (vistaZona === v && !v.corteT) { v.corteT = performance.now(); v.kCorte = v.k; } document.removeEventListener('pointerdown', v.cortar, true); document.removeEventListener('keydown', v.cortar, true); };
  document.addEventListener('pointerdown', v.cortar, true); document.addEventListener('keydown', v.cortar, true);
}
// Suma el desfase de la panoramica a camYaw/camDist/camPitch; el bucle lo resta tras colocar la camara.
function vistaZonaAplicar(ahora) {
  const v = vistaZona; if (!v) return null;
  if (!v.corteT && (P.muerto || camAntes || prueba || cineEst || camCombate || ventanaAb)) v.cortar();
  let k;
  if (v.corteT) { k = v.kCorte * Math.exp(-(ahora - v.corteT) / 150); if (k < 0.01) { vistaZonaFin(); return null; } }
  else { const u = (ahora - v.t0) / v.dur; if (u >= 1) { vistaZonaFin(); return null; } const s = x => x * x * (3 - 2 * x); k = u < 0.35 ? s(u / 0.35) : u < 0.6 ? 1 : 1 - s((u - 0.6) / 0.4); }
  v.k = k;
  const o = { y: v.dy * k, d: v.dd * k, p: v.dp * k };
  camYaw += o.y; camDist += o.d; camPitch += o.p;
  return o;
}
function tituloZona(id) {
  const mp = id === 'eter' ? { nombre: ABISMO.nombre + ' · zona PvP', nv: [ABISMO.nvMin, 60] } : id === 'cueva' ? { nombre: CUEVA.nombre, nv: [cuevaInfo ? cuevaInfo.nv : 5, cuevaInfo ? cuevaInfo.nv : 60] } : MAPAS[id];
  $('tz-n').textContent = mp ? mp.nombre : 'Pueblo Duende';
  $('tz-s').textContent = mp && mp.nv ? 'Nivel ' + mp.nv[0] + '-' + mp.nv[1] : 'Zona segura';
  $('mini-z').textContent = $('tz-n').textContent;
  const t = $('titulo-zona'); t.style.opacity = 1; document.body.classList.add('tz-on');
  clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = 0; document.body.classList.remove('tz-on'); }, 3200);
  // La historia de la zona, una vez por sesion.
  // Primera vez en el Abismo (por cuenta): que quede claro que aqui, y solo aqui, la otra faccion puede atacarte.
  if (id === 'eter' && clavePj()) { let visto = true; try { visto = !!localStorage.getItem('dq3_abismo_' + clavePj()); if (!visto) localStorage.setItem('dq3_abismo_' + clavePj(), '1'); } catch (e) {} if (!visto) setTimeout(() => aviso('⚔ Abismo de Éter: aquí los de la otra facción pueden atacarte. En el pueblo y en el resto del mundo nadie puede dañarte (salvo en un duelo que tú aceptes). La diferencia de nivel se acota a 10 y los novatos no pierden Puntos.', 'err', 1), 1500); }
  const lz = LORE_ZONAS[id];
  // Primera vez en esta zona (por cuenta): remate musical, vibracion y panoramica hacia el hito.
  let primera = false;
  if (lz && yo && id !== 'pueblo' && id !== 'cueva' && id !== 'eter') { const kv = 'dq3_vista_' + id + '_' + clavePj(); try { primera = !localStorage.getItem(kv); if (primera) localStorage.setItem(kv, '1'); } catch (e) { primera = false; } }
  const durVista = (CAL === 'baja' || MENOS_MOV) ? 1500 : 2500;
  if (primera) setTimeout(() => { if (zonaActual !== id) return; try { if (musica.remate) musica.remate('zona'); } catch (e) {} vib('light'); vistaZonaIniciar(id, durVista); }, 400);
  // El lore espera a que acabe la panoramica y a que estes libre (sin jefe, sin pelea, sin golpes recientes).
  if (lz && yo) { let vistas = ''; try { vistas = sessionStorage.getItem('dq3_lz') || ''; } catch (e) {} if (!vistas.split(',').includes(id)) loreZona(id, lz, 0, primera ? 400 + durVista + 500 : 1500, primera || id === 'cueva' || id === 'eter'); }
  // Primera salida del pueblo de un novato: se le enseña a volar (una sola vez).
  try { if (id && id !== 'pueblo' && yo && (yo.nivel || 1) <= 3 && (yo.kills || 0) > 0 && !P.vuela && !localStorage.getItem('dq3_volar_hint')) { localStorage.setItem('dq3_volar_hint', '1'); setTimeout(() => aviso('🦋 ¡Ya saliste del pueblo! Toca ' + K('V', 'VOLAR') + ' y vuela hacia la luz amarilla.', 'ok', 1), 1800); } } catch (e) {}
}

// ── VENTANAS ──
function abrir(id) {
  if (!$(id).classList.contains('on')) { sfxK('libro', 0.12); SON.tocar('clic', { vol: 0.8 }); }
  if (LATERALES.includes(id)) for (const o of LATERALES) if (o !== id && $(o) && $(o).classList.contains('on')) cerrar(o);
  $(id).classList.add('on');
  if (!LATERALES.includes(id)) for (const k in teclas) teclas[k] = false;
  pedirSincroAtras();
}
function cerrar(id) {
  // El editor de apariencia cerrado por otra via (Atras de Telegram, ✕): la camara vuelve y se descarta la prueba.
  if (id === 'v-look' && camAntes) { ({ camYaw, camPitch, camDist } = camAntes); camAntes = null; lookEditor = null; cambiarSkinPropia(); }
  if ($(id).classList.contains('on')) SON.tocar('clic', { vol: 0.7, cerrar: true });
  $(id).classList.remove('on'); if (id === 'v-npc') npcAbierto = '';
  pedirSincroAtras();
}
document.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = () => cerrar(b.closest('.modal').id));
// Tira "¿Probar otra clase?" tras la mision 1: el novato descubre Mago, Sacerdote y Picaro (una sola vez).
function ofrecerClases(n) {
  n = n || 0;
  let vista = false; try { vista = !!localStorage.getItem('dq3_clase_probada'); } catch (e) {}
  if (vista || !yo || !yo.clase || yo.nivel >= 9 || $('probar-clase')) return;
  // Espera a que no haya ventana, lateral, NPC hablando, cola de NPC ni tira del premio diario (hasta ~3 min).
  const ocupado = avisoTapado() || enCombate3() || hayVentana() || hayLateral() || ($('npc-dice') && $('npc-dice').classList.contains('on')) || colaNpc.length || !!document.querySelector('#tira-diario.on') || !!$('tarjeta-bautizo') || !!$('franja-inst') || (Date.now() - ventanaAutoT < 45000);
  if (ocupado) { if (n < 60) setTimeout(() => ofrecerClases(n + 1), 3000); return; }
  ventanaAutoT = Date.now();   // una tarjeta automatica cada vez: las demas esperan su turno
  const marcar = () => { try { localStorage.setItem('dq3_clase_probada', '1'); } catch (e) {} };   // solo cuando de verdad la vio o eligio
  const d = document.createElement('div'); d.id = 'probar-clase';
  d.innerHTML = '<p class="pc-t">¿Probar otra clase? Es gratis hasta Nv 9</p><div class="pc-g"></div><button class="pc-no" type="button">✕ Así estoy bien</button>';
  let vigila = 0;
  const fin = () => { clearInterval(vigila); d.remove(); };
  const g = d.querySelector('.pc-g');
  for (const [id, cl] of Object.entries(CLASES)) {
    const b = document.createElement('button'); b.type = 'button';
    const act = yo.clase === id; if (act) b.className = 'act';
    b.innerHTML = `<span>${EMOJI_CLASE[id] || ''} ${esc(cl.nombre)}${act ? ' ✓' : ''}</span><small>${esc(cl.rol)}</small>`;
    b.onclick = () => {
      try { SON.tocar('clic', { vol: 0.7 }); b.blur(); } catch (e) {}   // sin foco: Espacio/Enter al jugar no cuentan como segundo toque
      if (act) { marcar(); fin(); return; }
      // Doble toque: el primero solo marca (un roce sin querer no cambia la clase).
      if (!b.classList.contains('conf')) {
        g.querySelectorAll('button.conf').forEach(o => { o.classList.remove('conf'); const s = o.querySelector('span'); if (s && o.dataset.txt) s.textContent = o.dataset.txt; });
        const s = b.querySelector('span'); b.dataset.txt = s.textContent;
        b.classList.add('conf'); s.textContent = 'Toca otra vez: ' + cl.nombre;
        return;
      }
      // En combate o caido el servidor rechaza el cambio: la tira sigue y no se marca como vista.
      // El servidor exige 5 s sin golpes ni heridas: se avisa dentro de la tira (un aviso quedaria debajo).
      const pt = d.querySelector('.pc-t'), ahoraC = performance.now();
      if (enCombate3() || (P && (P.muerto || ahoraC - (P.atkT || 0) < 5500 || ahoraC - (P.heridoT || 0) < 5500))) { if (pt) pt.textContent = 'Espera unos segundos sin pelear y toca otra vez'; return; }
      if (d.dataset.pide) return;   // ya hay un cambio en camino
      d.dataset.pide = '1'; hasta = Math.max(hasta, Date.now() + 6000);
      mandar({ t: 'clase', id });
      if (pt) pt.textContent = 'Cambiando a ' + cl.nombre + '…';
      const pedida = id, envioT = Date.now();
      // Revisa cada 300 ms hasta 4 s (en datos moviles la respuesta puede tardar mas de 1,5 s).
      const revisa = () => {
        if (!(yo && yo.clase === pedida) && d.isConnected && Date.now() - envioT < 4000) { setTimeout(revisa, 300); return; }
        delete d.dataset.pide;
        if (yo && yo.clase === pedida) {
          marcar(); fin();
          aviso(`Pruebas ${cl.nombre}. Si no te gusta, vuelve en ${K('📖 (tecla P)', '⋯ → 📖')} → Clase (gratis hasta Nv 9).`, 'ok', 1);
        } else if (d.isConnected) {
          b.classList.remove('conf'); const s = b.querySelector('span'); if (s && b.dataset.txt) s.textContent = b.dataset.txt;
          if (pt) pt.textContent = 'No se pudo: espera unos segundos sin pelear';
          hasta = Math.max(hasta, Date.now() + 15000);
        }
      };
      setTimeout(revisa, 300);
    };
    g.appendChild(b);
  }
  d.querySelector('.pc-no').onclick = () => { try { SON.tocar('clic', { vol: 0.7, cerrar: true }); } catch (e) {} marcar(); fin(); };
  document.body.appendChild(d);
  const desde = Date.now(); let hasta = desde + 20000;
  // Sola a los 20 s (cuenta como vista). Si se abre una ventana, lateral o habla un NPC, no la tapa:
  // con 5 s o mas a la vista cuenta como vista; si no, vuelve a ofrecerse luego.
  vigila = setInterval(() => {
    if (!d.isConnected) { clearInterval(vigila); return; }
    const tapa = hayVentana() || hayLateral() || ($('npc-dice') && $('npc-dice').classList.contains('on'));
    if (Date.now() > hasta) { marcar(); fin(); return; }
    if (tapa) { if (Date.now() - desde >= 5000) { marcar(); fin(); } else { fin(); setTimeout(() => ofrecerClases(n + 1), 3000); } }
  }, 500);
}
function abrirClases() {
  const c = $('clases');
  c.innerHTML = '<p style="grid-column:1/-1;font-size:12px;margin:0;color:var(--txt2)">Toca una clase para elegirla. Hasta Nv 9 puedes cambiarla gratis.</p>';
  for (const [id, cl] of Object.entries(CLASES)) {
    const b = document.createElement('button');
    b.innerHTML = `<span style="color:${cl.color}">${esc(cl.nombre)}</span><small>${esc(cl.rol)}</small>${id === 'guerrero' ? '<small style="color:#4ade80">★ Recomendada para empezar</small>' : ''}<small style="font-weight:400;line-height:1.35">${esc(cl.desc)}</small>`;
    b.onclick = () => mandar({ t: 'clase', id });
    c.appendChild(b);
  }
  abrir('v-clase');
}
let npcAbierto = '', firmaNpcAnt = '';
// Que hace cada NPC del pueblo (etiqueta sobre su cabeza y boton de hablar).
const ROL_NPC = { chichera: '🥤 Chichería', guia: '📜 Misiones', tienda: '🛒 Tienda', ranking: '🏆 Ranking', artesania: '⚒️ Fabricar' };
const firmaNpc = t => JSON.stringify(t.startsWith('vecino_') ? [secundarias, yo.nivel, yo.mat] : t === 'guia' ? [yo.mis, yo.diaria] : t === 'tienda' ? [yo.pw, yo.oro] : t === 'chichera' ? [(yo.vaso || {}).n, (yo.vaso || {}).hoy, yo.oro, yo.recetas] : [yo.mat, yo.pw, yo.recetas]);
// Ventanas abiertas al dia (solo se repintan si cambia lo que muestran).
function refrescarVentanas(lleno) {
  if (lleno) V.actualizar();
  if (npcAbierto && npcAbierto !== 'ranking' && $('v-npc').classList.contains('on')) { const f = firmaNpc(npcAbierto); if (f !== firmaNpcAnt) abrirNpc(npcAbierto); }
}
// ── VECINOS: la Chichera, la Abuela y los narradores de zona (mundo/js/vecinos.js) ──
// Marca sobre la cabeza: ! tiene una historia para ti (se quita al hablarle en persona), ? hay algo listo para cerrar con el.
// Las secundarias se entregan solas (servidor): el ? es para la cadena de Tito y lo que ya se puede fabricar con Lila.
const VEC_TIPO = new Map(VECINOS.map(v => [v.tipo, v]));
const TODOS_NPC = [...NPCS3D, ...VECINOS];
const jefesVencidos = () => { const i = (yo && yo.mis && yo.mis.i) || 0; return i >= MISIONES.length ? CAPITULOS.length : capituloDe(i).n - 1; };
const memNpcC = { clave: '', d: null };
function memNpc() {
  const k = 'dq3_npc_' + ((yo && yo.nombre) || '');
  if (memNpcC.clave !== k) {
    memNpcC.clave = k; memNpcC.d = null;
    try { memNpcC.d = JSON.parse(localStorage.getItem(k)); } catch (e) {}
    if (!memNpcC.d || typeof memNpcC.d !== 'object') memNpcC.d = {};
    if (!memNpcC.d.h) memNpcC.d.h = {};
    if (!memNpcC.d.c) memNpcC.d.c = {};
  }
  return memNpcC.d;
}
function guardaMemNpc() { try { localStorage.setItem(memNpcC.clave, JSON.stringify(memNpcC.d)); } catch (e) {} }
const secActivas = () => yo ? ZONAS_ENC.map(z => secundariaDe(z, secundarias, yo.nivel)).filter(Boolean) : [];
// La confesion de Sisa (x4) no salta en el acantilado: ocurre al hablarle en el pueblo. Hasta entonces, su fila solo manda alla.
const sinConfesar = q => !!q && q.id === 'x4' && !memNpc().h.x4;
const vistaSec = q => sinConfesar(q) ? { pide: 'Busca a la madre de tu cuaderno', quien: 'Alguien en el pueblo', pend: 1 } : q;
function fabricableYa(q) {
  const mat = yo.mat || {}, cabe = r => Object.entries(r.pide).every(([k, n]) => (mat[k] || 0) >= n);
  if (!q.k) return RECETAS.some(cabe);
  const r = RECETAS.find(x => x.id === q.k);
  return !!r && cabe(r);
}
let marcasC = new Map(), marcasT = -1e9;
function marcasNpc() {
  const t = performance.now();
  if (!yo || t - marcasT < 800) return marcasC;
  marcasT = t;
  const m = new Map(), h = memNpc().h;
  for (const q of secActivas()) {
    if (q.tipo === 'fabricar' && fabricableYa(q) && !sinConfesar(q)) m.set('Artesana Lila', '?');
    if (!h[q.id] && !m.has(q.quien)) m.set(q.quien, '!');
  }
  if (misionLista()) m.set('Guardia Tito', '?');
  return (marcasC = m);
}
function marcarHabladas(nombre) {
  const h = memNpc().h; let cambio = false;
  for (const q of secActivas()) if (q.quien === nombre && !h[q.id]) { h[q.id] = 1; cambio = true; }
  if (cambio) { guardaMemNpc(); marcasT = -1e9; }
}
// Una vez por capitulo el PNJ comenta lo ultimo que hiciste; despues, sus frases de siempre.
function comentarioNuevo(id) {
  try {
    const j = jefesVencidos(), e = comentarioNpc(id, j, secundarias), m = memNpc();
    // La frase especial (ya cumpliste su secundaria) sale una vez y no tapa los comentarios de los capitulos siguientes.
    if (e && e.k[0] === 'e' && !m.c[id + e.k]) { m.c[id + e.k] = 1; guardaMemNpc(); return e.t; }
    const c = comentarioNpc(id, j);
    if (!c || m.c[id] === c.k) return '';
    m.c[id] = c.k; guardaMemNpc();
    return c.t;
  } catch (e) { return ''; }
}
function frasesDe(id) {
  // Tras «Fui yo» (jefe 6), Tito ya no se presenta como si nada: quedan sus frases de despues.
  let tito = false; try { tito = id === 'guia' && jefesVencidos() >= 6; } catch (e) {}
  const l = [...(tito ? [] : LORE_NPC[id] || []), ...((VOCES[id] || {}).frases || [])];
  if (id === 'sisa' && decoTp.campo === 'tantas' && LORE_NPC.abuela) l.push(...LORE_NPC.abuela);
  try { for (const c of [comentarioNpc(id, jefesVencidos(), secundarias), comentarioNpc(id, jefesVencidos())]) if (c) l.push(c.t); } catch (e) {}
  return [...new Set(l)];   // sin repetidas: «Cuéntame más» avanza con indexOf y una repetida lo dejaria en bucle
}
// Lo que ese vecino tiene para ti: su historia de turno con el avance, o cuando volvera a tener.
function bloqueSecNpc(nombre) {
  if (!yo) return '';
  const L = SECUNDARIAS.filter(q => q.quien === nombre);
  if (!L.length) return '';
  const activas = secActivas().filter(q => q.quien === nombre), hechas = L.filter(q => secundarias[q.id + ':ok']).length;
  let h = activas.slice(0, 2).map(q => `<div style="background:rgba(240,171,252,.12);border-left:3px solid #f0abfc;border-radius:6px;padding:7px 9px;margin:0 0 8px"><b style="color:#f0abfc">📖 ${esc(q.nombre)}</b><br><span style="color:#f5f3ff">${esc(q.inicio)}</span><br><b style="color:#fde68a">${esc(q.pide)}: ${Math.min(secundarias[q.id] || 0, q.n)}/${q.n}</b> <small style="color:#ddd6fe">· ${esc((MAPAS[q.zona] || {}).nombre || q.zona)}</small></div>`).join('');
  if (!activas.length) {
    const pr = L.find(q => !secundarias[q.id + ':ok']);
    const t = !pr ? 'Ya me ayudaste con todo lo que tenía.' : pr.nv > yo.nivel ? `Tendré algo más para ti en Nv ${pr.nv}.` : pr.minPistas && contarPistas(secundarias) < pr.minPistas ? `Te espero con ${pr.minPistas} pistas (${contarPistas(secundarias)}/${pr.minPistas}).` : `Primero termina lo que te toca en ${(MAPAS[pr.zona] || {}).nombre || pr.zona}. Luego hablamos.`;
    h += `<p style="margin:0 0 6px;color:#ddd6fe;font-size:13px">📖 ${esc(t)}</p>`;
  }
  return h + `<p style="margin:0 0 8px;color:#c4b5fd;font-size:12px">Historias con ${esc(nombre)}: ${hechas}/${L.length}</p>`;
}
function dondeNpc(nombre) {
  const n = TODOS_NPC.find(x => x.nombre === nombre);
  if (!n || !P) return '';
  const d = Math.hypot(n.x - P.x, n.z - P.z);
  return d < 12 ? ' · ¡aquí!' : ` · ${flechaDir(n.x, n.z)} ${Math.round(d)} m`;
}
function abrirVecino(v) {
  const on = $('v-npc').classList.contains('on') && npcAbierto === v.tipo;
  npcAbierto = v.tipo; firmaNpcAnt = firmaNpc(v.tipo);
  $('npc-t').textContent = v.nombre.toUpperCase();
  if (!on || !v.frase) { const F = frasesDe(v.id); v.frase = secActivas().some(q => q.quien === v.nombre && sinConfesar(q)) ? 'Te estaba esperando. Siéntate.' : comentarioNuevo(v.id) || F[Math.floor(Math.random() * F.length)] || ''; }
  const horno = v.id === 'sisa' && decoTp.puesto;
  const cu = $('npc-c');
  cu.innerHTML = `<div style="display:flex;gap:10px;align-items:center;margin:0 0 10px"><span class="npc-ret" style="position:relative;flex:none;width:68px;height:68px;border-radius:50%;background:rgba(168,85,247,.25);border:2px solid #a855f7;display:flex;align-items:center;justify-content:center;font-size:34px">${v.emoji}</span><div style="min-width:0"><small style="color:#fde68a;font-size:12px">${esc(v.rol || '')}</small><p class="npc-dice" style="font-style:italic;color:#f5f3ff;margin:2px 0 0">«${esc(v.frase)}»</p></div></div>`
    + (horno ? '<button type="button" class="btn" id="n-fiesta" style="width:100%;min-height:44px;margin:0 0 10px">🎉 Tienda de la fiesta</button>' : '')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><button type="button" class="btn sec" data-vec="hago" style="min-height:40px;flex:1;margin:0;font-size:13px">¿Qué hago ahora?</button><button type="button" class="btn sec" data-vec="mas" style="min-height:40px;flex:1;margin:0;font-size:13px">Cuéntame más</button></div><p class="npc-resp" style="display:none;margin:0 0 10px;color:#fde68a;font-size:13px"></p>'
    + bloqueSecNpc(v.nombre);
  marcarHabladas(v.nombre);
  cu.querySelector('[data-vec="hago"]').onclick = () => { const r = cu.querySelector('.npc-resp'), q = secActivas().find(x => x.quien === v.nombre); r.textContent = q ? `${q.pide} (${Math.min(secundarias[q.id] || 0, q.n)}/${q.n}) en ${(MAPAS[q.zona] || {}).nombre || q.zona}.` : queHagoAhora(); r.style.display = ''; };
  cu.querySelector('[data-vec="mas"]').onclick = () => { const L = frasesDe(v.id); if (!L.length) return; v.frase = L[(L.indexOf(v.frase) + 1) % L.length]; cu.querySelector('.npc-dice').textContent = '«' + v.frase + '»'; };
  if (horno) $('n-fiesta').onclick = () => { cerrar('v-npc'); try { V.abrirTiendaTemp(); } catch (e) {} };
  retratoNpc(v.hoja).then(u => { const s = npcAbierto === v.tipo && cu.querySelector('.npc-ret'); if (u && s) s.innerHTML = `<img src="${u}" alt="" style="width:100%;height:100%;image-rendering:pixelated;border-radius:50%"><span style="position:absolute;right:-4px;bottom:-4px;font-size:22px;line-height:1">${v.emoji}</span>`; });
  abrir('v-npc');
}
// Los puestos de la plaza y el farol de cada narrador. Todo estatico: se aplana en instancias.
function crearPuestosVecinos() {
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const madera = L(0x8b5a2b), barro = L(0xa0603a), chicha = new THREE.MeshBasicMaterial({ color: 0x7c3aed }), pan = L(0xc98a3c), palo = L(0x3b2a1a), negro = L(0x241a14);
  const gTabla = new THREE.BoxGeometry(1, 1, 1), gOlla = new THREE.SphereGeometry(1, 10, 8), gCil = new THREE.CylinderGeometry(1, 1, 1, 10), gVaso = new THREE.CylinderGeometry(1, 0.72, 1, 8);
  const pieza = (g, ge, ma, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(ge, ma); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  const grupo = new THREE.Group();
  const plantar = (v, ad) => { const a = Math.atan2(-v.x, -v.z), x = v.x + Math.sin(a) * ad, z = v.z + Math.cos(a) * ad, g = new THREE.Group(); g.position.set(x, alturaEn(x, z), z); g.rotation.y = a; grupo.add(g); ponerSolido(x, z, 1.15); return g; };
  // Mesa de la Chichera, delante de su puesto: la olla morada y los vasos servidos.
  { const v = NPCS3D.find(n => n.tipo === 'chichera');
    if (v) {
      const g = plantar(v, 1.7);
      pieza(g, gTabla, madera, 0, 0.42, 0, 2.3, 0.84, 1);
      pieza(g, gOlla, barro, -0.6, 1.14, 0, 0.42, 0.34, 0.42);
      pieza(g, gCil, chicha, -0.6, 1.46, 0, 0.31, 0.03, 0.31);
      for (let i = 0; i < 4; i++) pieza(g, gVaso, chicha, 0.2 + (i % 2) * 0.42, 0.95, i < 2 ? -0.2 : 0.2, 0.09, 0.2, 0.09);
    } }
  // Horno de la Abuela: horno de barro con su boca y mesa con panes.
  { const v = VECINOS.find(n => n.id === 'sisa'), g = plantar(v, 1.6);
    pieza(g, gTabla, madera, 0, 0.42, 0, 2.2, 0.84, 1);
    for (let i = 0; i < 6; i++) pieza(g, gOlla, pan, -0.65 + (i % 3) * 0.65, 0.92, i < 3 ? -0.22 : 0.22, 0.2, 0.09, 0.13);
    pieza(g, gOlla, barro, 1.7, 0.6, -2.5, 1.05, 0.95, 1.05); pieza(g, gOlla, negro, 1.7, 0.55, -1.55, 0.36, 0.42, 0.12);
    const sn = Math.sin(g.rotation.y), cs = Math.cos(g.rotation.y);
    ponerSolido(g.position.x + cs * 1.7 - sn * 2.5, g.position.z - sn * 1.7 - cs * 2.5, 1.05); }
  // Narradores de zona: un farol que se enciende al anochecer, como los de la plaza.
  const gFarol = new THREE.OctahedronGeometry(0.38, 0);
  for (const v of VECINOS) if (v.zona !== 'pueblo') {
    const x = v.x + 1.6, z = v.z + 1.1, y = alturaEn(x, z);
    pieza(grupo, gCil, palo, x, y + 1.6, z, 0.12, 3.2, 0.12);
    const f = new THREE.Mesh(gFarol, farolMat); f.position.set(x, y + 3.35, z); grupo.add(f);
    ponerSolido(x, z, 0.3);
  }
  escena.add(aplanarInstancias(grupo));
  for (const v of VECINOS) ponerSolido(v.x, v.z, 0.55);
}
// Los narradores de zona se crean al acercarte (de uno en uno): no cargan al entrar en el mundo.
function vecinosCerca() {
  for (const n of npcs) if (n.perezoso && !n.fig && !n.cargando && Math.hypot(P.x - n.x, P.z - n.z) < 170) {
    n.cargando = true;
    Promise.resolve(figuraModelo(() => crearNpc(n.hoja, n.look)) || figuraHoja(n.hoja, 62)).then(f => { n.fig = f; }).catch(() => {});
    return;
  }
}
function abrirNpc(tipo) {
  if (VEC_TIPO.has(tipo)) return abrirVecino(VEC_TIPO.get(tipo));
  npcAbierto = tipo;
  firmaNpcAnt = firmaNpc(tipo);
  const n = NPCS3D.find(x => x.tipo === tipo);
  $('npc-t').textContent = n.nombre.toUpperCase();
  const cu = $('npc-c');
  if (tipo === 'guia') {
    const q = MISIONES[yo.mis.i];
    let h = q ? `<p><b style="color:#fff">${esc(q.nombre)}</b>${LORE_MISIONES[yo.mis.i] ? `<br><i style="color:#e9d5ff">${esc(LORE_MISIONES[yo.mis.i])}</i>` : ''}<br>Caza ${q.n} × ${esc(MONSTRUOS[q.tipo].nombre)} (${Math.min(yo.mis.p, q.n)}/${q.n}). Recompensa: ${q.xp} XP y ${q.oro} oro.</p><button class="btn" id="n-mision" ${yo.mis.p >= q.n ? '' : 'disabled'} style="width:100%">Entregar misión</button>` : '<p>Completaste todas las misiones. ¡Eres una leyenda del pueblo!</p>';
    const d = yo.diaria || { p: 0 };
    h += `<p style="margin-top:14px"><b style="color:#fff">${esc(DIARIA.nombre)}</b><br>Caza ${DIARIA.n} monstruos de tu nivel (${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}).</p><button class="btn sec" id="n-diaria" ${d.ok || (d.p || 0) < DIARIA.n ? 'disabled' : ''} style="width:100%">${d.ok ? 'Ya cobrada hoy' : 'Cobrar la caza del día'}</button>`;
    cu.innerHTML = h;
    const b = $('n-mision'); if (b) b.onclick = () => { mandar({ t: 'mision' }); SON.tocar('clic', { vol: 0.6 }); };   /* la moneda suena cuando el servidor confirma (toast ok) */
    $('n-diaria').onclick = () => mandar({ t: 'mision', diaria: true });
  } else if (tipo === 'tienda') {
    cu.innerHTML = '<button class="btn" id="n-tienda" style="width:100%;margin-bottom:8px">Ver toda la tienda: armas, forja, skins, monturas…</button><p style="margin:0 0 6px">Tu oro: <b style="color:var(--oro)">' + (yo.oro || 0).toLocaleString('es', { useGrouping: 'always' }) + '</b></p><p>Consumibles para el camino:</p>' + PODERES.map(p => `<div class="fila"><span><img src="${A}items/${p.icono}.png" style="width:22px;vertical-align:middle;image-rendering:pixelated"> ${esc(p.nombre)} <small style="color:var(--txt3)">(${(yo.pw && yo.pw[p.id]) || 0})</small><br><small style="color:var(--txt3)">${esc(p.desc || '')}</small></span><span style="white-space:nowrap"><b style="color:var(--oro)">${p.precio}</b> <button class="btn" data-c="${p.id}" data-n="1" ${(yo.oro || 0) < p.precio ? 'disabled' : ''}>×1</button> <button class="btn sec" data-c="${p.id}" data-n="5" ${(yo.oro || 0) < p.precio * 5 ? 'disabled' : ''}>×5</button></span></div>`).join('');
    cu.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { mandar({ t: 'comprar', k: 'pw', id: b.dataset.c, n: +b.dataset.n }); SON.tocar('clic', { vol: 0.6 }); });
    $('n-tienda').onclick = () => { cerrar('v-npc'); V.abrirTienda('arma'); };
  } else if (tipo === 'ranking') {
    cu.innerHTML = '<p>Cargando el ranking…</p>';
    mandar({ t: 'ranking' });
  } else if (tipo === 'chichera') {
    const v = yo.vaso || { n: 0, hoy: 0 }, precio = precioVaso(yo.nivel), queda = ((P.au && P.au.vaso) || 0) - performance.now();
    const puedeT = v.n > 0 && queda <= 0, puedeC = v.hoy < VASO.compraDia && v.n < VASO.max && (yo.oro || 0) >= precio;
    const receta = id => { const r = RECETAS.find(x => x.id === id); return r ? `<div class="fila"><span><b>${esc(r.nombre)}</b>${(yo.recetas || {})[r.id] ? ' <small style="color:#4ade80">✓ ya la hiciste</small>' : ''}<br><small style="color:var(--txt3)">${esc(r.desc)}</small><br><small style="color:var(--txt3)">${Object.entries(r.pide).map(([k, n]) => n + ' ' + esc((MATERIALES[k] || { nombre: k }).nombre)).join(' + ')}</small></span></div>` : ''; };
    cu.innerHTML = `<p style="margin:0 0 8px">Un vaso de <b style="color:#e9d5ff">Chicha Morada del Duende</b> da <b>+${Math.round((VASO.xp - 1) * 100)}% de XP de caza</b> y vida poco a poco durante ${Math.round(VASO.ms / 60000)} min. Una sola a la vez: no se suma.</p>`
      + (queda > 0 ? `<p style="margin:0 0 8px;color:#e9d5ff">🥤 Ya tienes una activa: te quedan ${Math.ceil(queda / 60000)} min.</p>` : '')
      + `<button class="btn" id="n-vaso-t" style="width:100%;min-height:44px;margin-bottom:8px"${puedeT ? '' : ' disabled'}>🥤 Tomar un vaso (tienes ${v.n})</button>`
      + `<button class="btn sec" id="n-vaso-c" style="width:100%;min-height:44px"${puedeC ? '' : ' disabled'}>Comprar un vaso · ${precio.toLocaleString('es', { useGrouping: 'always' })} oro</button>`
      + `<p style="margin:6px 0 12px;color:var(--txt3);font-size:12px">Tu oro: ${(yo.oro || 0).toLocaleString('es', { useGrouping: 'always' })} · Hoy compraste ${Math.min(v.hoy, VASO.compraDia)}/${VASO.compraDia}. También te sirvo uno al cumplir mis encargos, y a veces aparecen cazando.</p>`
      + `<p style="margin:0 0 6px"><b>📖 Recetas de la casa</b><br><small style="color:var(--txt3)">Junta esto y llévaselo a la Artesana Lila, ella tiene la olla grande.</small></p>`
      + ['vasoOlla', 'chichaE', 'mazamorra'].map(receta).join('');
    $('n-vaso-t').onclick = () => { mandar({ t: 'vaso', a: 'tomar' }); SON.tocar('clic', { vol: 0.6 }); };
    $('n-vaso-c').onclick = () => { mandar({ t: 'vaso', a: 'comprar' }); SON.tocar('clic', { vol: 0.6 }); };
  } else {
    const mat = yo.mat || {};
    const tengo = Object.entries(MATERIALES).filter(([k]) => mat[k]).map(([k, d]) => `<span style="white-space:nowrap"><img src="${A}items/equipo/${d.icono}.png" style="width:18px;vertical-align:middle;image-rendering:pixelated"> ${mat[k]}</span>`).join(' · ');
    cu.innerHTML = `<p>Recoge hierbas 🌿 y minerales ⛏ por el mundo (${K('tecla E', 'botón RECOGER')} junto a ellos) y yo te los convierto.</p><p style="margin:6px 0"><b>Tus materiales:</b> ${tengo || 'ninguno todavía'}</p>`
      + `<p style="margin:6px 0"><b>📖 Recetario: ${RECETAS.filter(r => (yo.recetas || {})[r.id]).length}/${RECETAS.length}</b></p>`
      + RECETAS.map(r => {
        const ok = Object.entries(r.pide).every(([k, n]) => (mat[k] || 0) >= n);
        // Cada ingrediente como tengo/pide con su icono: verde si alcanza, gris si no.
        const pide = Object.entries(r.pide).map(([k, n]) => { const d = MATERIALES[k] || { nombre: k }, t = mat[k] || 0; return `<span style="white-space:nowrap;color:${t >= n ? '#4ade80' : 'var(--txt3)'}">${Math.min(t, 999)}/${n} ${d.icono ? `<img src="${A}items/equipo/${d.icono}.png" alt="" style="width:16px;vertical-align:middle;image-rendering:pixelated">` : ''} ${esc(d.nombre)}</span>`; }).join(' · ');
        const falta = Object.entries(r.pide).filter(([k, n]) => (mat[k] || 0) < n).map(([k, n]) => `${n - (mat[k] || 0)} ${esc((MATERIALES[k] || { nombre: k }).nombre)}`).join(', ');
        const nueva = r.oculta && !(yo.recetas || {})[r.id];
        // Si una mision secundaria a tu nivel pide esta receta, se ve entera (si no, no sabrias que juntar).
        const pedida = SECUNDARIAS.some(q => q.tipo === 'fabricar' && q.k === r.id && (yo.nivel || 1) >= q.nv && !(secundarias || {})[q.id + ':ok']);
        if (nueva && !ok && !pedida) return `<div class="fila" style="opacity:.75"><span><b>???</b> <small style="color:var(--txt3)">· ${esc(r.pista || 'Receta por descubrir')}</small></span><button class="btn sec" disabled>???</button></div>`;
        return `<div class="fila"${nueva ? ' style="box-shadow:0 0 10px rgba(250,204,21,.55);border-radius:8px;background:rgba(250,204,21,.08)"' : ''}><span><b>${esc(r.nombre)}</b>${nueva ? ' <small style="background:#facc15;color:#1a1a1a;border-radius:6px;padding:0 5px;font-weight:700">¡Nueva!</small>' : ''}<br><small style="color:var(--txt3)">${esc(r.desc)}</small><br><small>${pide}</small>${falta ? `<br><small style="color:var(--txt3);font-size:11px">Falta: ${falta}</small>` : ''}</span><button class="btn${ok ? '' : ' sec'}" data-r="${r.id}" ${ok ? '' : 'disabled'}>Fabricar</button></div>`;
      }).join('');
    cu.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { mandar({ t: 'fabricar', id: b.dataset.r }); SON.tocar('clic', { vol: 0.6 }); });
  }
  cu.insertAdjacentHTML('afterbegin', fraseNpc(n.id)); chipsNpc(cu, n.id);
  // Retrato del PNJ antes del titulo (si la hoja no carga, solo el nombre).
  const caraT = retratoNpcYa.get(n.hoja), ponCara = u => { if (u && npcAbierto === tipo && !$('npc-t').querySelector('img')) $('npc-t').insertAdjacentHTML('afterbegin', `<img src="${u}" alt="" style="width:48px;height:48px;vertical-align:middle;margin-right:8px;image-rendering:pixelated;border-radius:50%;background:rgba(168,85,247,.25)">`); };
  if (caraT) ponCara(caraT); else retratoNpc(n.hoja).then(ponCara);
  abrir('v-npc');
}
// Primer cuadro del sprite del PNJ recortado a la cabeza y el pecho, 64x64 pixelado (cacheado).
const retratoNpcYa = new Map(), retratoNpcP = new Map();
function retratoNpc(hoja) {
  if (retratoNpcP.has(hoja)) return retratoNpcP.get(hoja);
  const hm = HOJAS[hoja];
  const pr = !hm ? Promise.resolve(null) : Promise.resolve(cargarImg(A + 'enemigos/sheets/' + hoja + '.png')).then(im => {
    if (!im || !im.naturalWidth) return null;
    try {
      const sx = hm.mov[1] * hm.fw, sy = hm.mov[0] * hm.fh;
      const t = document.createElement('canvas'); t.width = hm.fw; t.height = hm.fh;
      const tx = t.getContext('2d'); tx.drawImage(im, sx, sy, hm.fw, hm.fh, 0, 0, hm.fw, hm.fh);
      // Caja de los pixeles visibles: el retrato es el cuadrado de arriba (cabeza y pecho).
      const px = tx.getImageData(0, 0, hm.fw, hm.fh).data;
      let x0 = hm.fw, y0 = hm.fh, x1 = -1, y1 = -1;
      for (let y = 0; y < hm.fh; y++) for (let x = 0; x < hm.fw; x++) if (px[(y * hm.fw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      const w = x1 - x0 + 1, h = Math.min(y1 - y0 + 1, Math.ceil(w * 1.1)), lado = Math.max(w, h);
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      const e = 64 / lado;
      x.save(); if (hm.izq) { x.translate(64, 0); x.scale(-1, 1); }
      x.drawImage(t, x0, y0, w, h, (64 - w * e) / 2, (64 - h * e) / 2, w * e, h * e);
      x.restore();
      const u = c.toDataURL(); retratoNpcYa.set(hoja, u); return u;
    } catch (er) { return null; }
  }).catch(() => null);
  retratoNpcP.set(hoja, pr);
  return pr;
}
// Respuestas rápidas debajo de la frase del PNJ (también en el ranking del sabio, que repinta npc-c).
function chipsNpc(cu, id) {
  const fr = cu.querySelector('.npc-dice');
  const h = '<div class="npc-chips" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><button type="button" class="btn sec" data-chip="hago" style="min-height:40px;flex:1;margin:0;font-size:13px">¿Qué hago ahora?</button><button type="button" class="btn sec" data-chip="mas" style="min-height:40px;flex:1;margin:0;font-size:13px">Cuéntame más</button></div><p class="npc-resp" style="display:none;margin:0 0 10px;color:#fde68a;font-size:13px"></p>';
  if (fr) fr.insertAdjacentHTML('afterend', h); else cu.insertAdjacentHTML('afterbegin', h);
  { const n = NPCS3D.find(x => x.id === id); if (n) { cu.querySelector('.npc-resp').insertAdjacentHTML('afterend', bloqueSecNpc(n.nombre)); marcarHabladas(n.nombre); } }
  if (id === 'chichera') { const ch = cu.querySelector('.npc-chips'); if (ch) { ch.insertAdjacentHTML('beforebegin', '<div style="display:flex;gap:8px;margin:0 0 8px"><button type="button" class="btn" data-asiri="receta" style="flex:1;min-height:44px;margin:0;font-size:13px">🌽 Recetario</button><button type="button" class="btn" data-asiri="caso" style="flex:1;min-height:44px;margin:0;font-size:13px">🕵 Cuaderno</button></div>'); cu.querySelector('[data-asiri="receta"]').onclick = () => { cerrar('v-npc'); verReceta(); }; cu.querySelector('[data-asiri="caso"]').onclick = () => { cerrar('v-npc'); verCaso(); }; } }
  cu.querySelector('[data-chip="hago"]').onclick = () => { const r = cu.querySelector('.npc-resp'); r.textContent = queHagoAhora(); r.style.display = ''; };
  cu.querySelector('[data-chip="mas"]').onclick = () => {
    const L = frasesDe(id), p = cu.querySelector('.npc-dice'); if (!L.length || !p) return;
    fraseNpcVista[id] = L[(L.indexOf(fraseNpcVista[id]) + 1) % L.length];
    p.textContent = '«' + fraseNpcVista[id] + '»';
  };
}
// «¿Qué hago ahora?» del PNJ: una linea con la mision o la caza del dia mas cercana (datos de yo).
function queHagoAhora() {
  try {
    const q = MISIONES[yo.mis.i], d = yo.diaria || { p: 0 }, pm = Math.min(yo.mis.p || 0, q ? q.n : 0), pd = Math.min(d.p || 0, DIARIA.n);
    if (q && pm >= q.n) return `¡«${q.nombre}» ya está lista! Entrégala al Guardia Tito y cobra ${q.xp} XP y ${q.oro} oro.`;
    if (!d.ok && pd >= DIARIA.n) return `Ya completaste «${DIARIA.nombre}»: cóbrala con el Guardia Tito.`;
    const faltaM = q ? q.n - pm : Infinity, faltaD = d.ok ? Infinity : DIARIA.n - pd;
    if (faltaM === Infinity && faltaD === Infinity) return 'Hoy ya hiciste todo lo del pueblo. Explora, junta materiales o busca a un jefe con tu grupo.';
    if (faltaM <= faltaD) return `Caza ${faltaM} × ${MONSTRUOS[q.tipo] ? MONSTRUOS[q.tipo].nombre : q.tipo} más para «${q.nombre}» (${pm}/${q.n}).`;
    return `Caza ${faltaD} monstruos de tu nivel más para «${DIARIA.nombre}» (${pd}/${DIARIA.n}).`;
  } catch (e) { return 'Habla con el Guardia Tito: él te da tu próxima misión.'; }
}
// Una frase del PNJ (lore) arriba de su ventana; se mantiene al repintar.
const fraseNpcVista = {};
function fraseNpc(id) {
  const L = LORE_NPC[id]; if (!L) return '';
  if (!fraseNpcVista[id] || !$('v-npc').classList.contains('on')) {
    // Primero una frase segun lo que te pasa; si nada aplica, la de siempre al azar.
    let ctx = null;
    try {
      const C = LORE_NPC_CTX[id] || {}, q = MISIONES[yo.mis.i], h = horaMundo(Date.now());
      if (id === 'guia') ctx = q && (yo.mis.p || 0) >= q.n ? C.lista : (h < 5.5 || h >= 19.5) ? C.noche : null;
      else if (id === 'mercader') ctx = !((yo.pw && yo.pw.pocion) > 0) ? C.sinPociones : null;
      else if (id === 'artesana') ctx = RECETAS.some(r => Object.entries(r.pide).every(([k, n]) => ((yo.mat || {})[k] || 0) >= n)) ? C.conMateriales : null;
    } catch (e) { ctx = null; }
    const hayCtx = ctx && ctx.length, F = hayCtx ? ctx : frasesDe(id);
    fraseNpcVista[id] = (!hayCtx && comentarioNuevo(id)) || F[Math.floor(Math.random() * F.length)];
  }
  return `<p class="npc-dice" style="font-style:italic;color:#e9d5ff;border-left:3px solid #a855f7;padding:2px 0 2px 8px;margin:0 0 10px">«${esc(fraseNpcVista[id])}»</p>`;
}
function pintarRanking(r) {
  $('npc-c').innerHTML = fraseNpc('sabio') + (r || []).slice(0, 15).map((x, i) => `<div class="fila"><span>${i + 1}. ${esc(x.n)}</span><b style="color:${x.yo ? 'var(--ok)' : 'var(--txt)'}">Nv ${x.lv}</b></div>`).join('') || '<p>Aún no hay nadie.</p>';
  chipsNpc($('npc-c'), 'sabio');
}
// Inventario, libro de clase, tienda completa y logros (mundo/js/ventanas.js).
const V = iniciarVentanas({ mandar, yo: () => yo, aviso: (t, k) => aviso(t, k, 1), sfx, abrir, cerrar, telegram: () => !!TG && !forzarInvitado, probarSkin, probarMontura, vibSel });
$('b-inv').onclick = () => V.abrirInventario();
$('b-libro').onclick = () => V.abrirLibro();
$('b-logros').onclick = () => V.abrirLogros();
// Tienda siempre a la vista (v325). Punto rojo mientras no se haya visto la oferta de bienvenida
// (sin ninguna compra) o haya una compra entregada que aun no se vio. Mismas claves que CLASSIC.
function puntoTienda() {
  const ps = (yo && yo.pedidos) || [], ent = ps.filter(x => x.estado === 'entregado').length;
  let vista = false, entVistas = 0;
  try { vista = localStorage.getItem('dq_tienda_vista') === '1'; entVistas = +localStorage.getItem('dq_tienda_ent') || 0; } catch (e) {}
  $('b-premium').classList.toggle('aviso', !!yo && ((!ps.length && !vista) || ent > entVistas));
}
// Punto rojo en 🎒: hay en la bolsa una pieza mejor que la puesta, o la bolsa esta casi llena.
function puntoMochila() {
  const b = $('b-inv'); if (!b || !yo) return;
  const bo = yo.bolsa || [];
  let hay = false;
  try { hay = bo.some(it => V.compararConPuesta(it, yo)); } catch (e) {}
  b.classList.toggle('aviso', hay || bo.length >= 36);
}
// Pack de bienvenida (SOLO 1 VEZ): se ofrece una sola vez, entre CLASSIC y
// ORIGINS (mismas claves), al llegar a Nv 5 o al revivir tras la segunda
// muerte, cuando no hay otra ventana. Solo si el servidor dice que aun puedes.
// En pelea (AUTO, objetivo vivo o un monstruo cerca atacandote) no se abre nada encima.
function enCombate3() {
  if (objetivo && performance.now() - (P.atkT || 0) < 4000) return true;
  if (objetivo && mons.has(objetivo)) { const o = mons.get(objetivo); if (o && o.hp > 0 && !o.muereT) return true; }
  for (const o of mons.values()) if (o.hp > 0 && !o.muereT && o.st === 2 && Math.hypot(o.x - P.x, o.z - P.z) < 12) return true;
  return false;
}
// Una sola cadena de reintentos a la vez (llegan muchos 'yo' por segundo).
let bienvEnCurso = false;
// morir(): pista del jefe dada esta sesion y caida ante un jefe en los 10 primeros min (no cuenta para la oferta).
let pistaJefeDada = false, muerteJefeBienv = false;
function ofrecerBienvenida(antes) {
  if (!antes || !yo || !yo.puedeBienvenida) return;
  let ofrecida = false, muertes = 0, pend = '';
  try { ofrecida = localStorage.getItem('dq_bienv_ofrecida') === '1'; muertes = +localStorage.getItem('dq_bienv_muertes') || 0; pend = localStorage.getItem('dq_bienv_pend') || ''; } catch (e) {}
  if (ofrecida) return;
  const contraJefe = muerteJefeBienv; if (yo.muerto) muerteJefeBienv = false;
  if (yo.muerto && !antes.muerto && !contraJefe) { muertes++; try { localStorage.setItem('dq_bienv_muertes', String(muertes)); } catch (e) {} }
  const cruce = (antes.nivel < 5 && yo.nivel >= 5) || (muertes >= 3 && antes.muerto && !yo.muerto);
  // Si en el cruce siempre hubo pelea o ventana, la oferta queda pendiente y se reintenta luego.
  if (cruce && pend !== '1') { pend = '1'; try { localStorage.setItem('dq_bienv_pend', '1'); } catch (e) {} }
  if (bienvEnCurso) return;
  const dispara = cruce || (pend === '1' && yo.nivel >= 5 && !yo.muerto && !ofrecida);
  // Igual que la tienda: sin cuenta solo veria «Iniciar sesion». Al invitado no se le gasta
  // la oferta: se le avisa una vez y se le ofrece cuando ya tenga cuenta.
  const conCuenta = !!(yo.p2e && yo.p2e.cuenta);
  // Se marca solo cuando de verdad se abre: si 2 min hubo otra ventana o pelea, queda pendiente (dq_bienv_pend).
  // Invitado (inv): la tienda ya le muestra el pack con su precio y el boton de cuenta; se marca
  // solo dq_bienv_inv (nunca dq_bienv_ofrecida) para volver a ofrecerlo cuando tenga cuenta.
  const intentar = (n, inv) => {
    if (!yo || !yo.puedeBienvenida || yo.muerto) { if (yo && yo.muerto && n < 40) setTimeout(() => intentar(n + 1, inv), 3000); else bienvEnCurso = false; return; }
    try { if (localStorage.getItem(inv ? 'dq_bienv_inv' : 'dq_bienv_ofrecida') === '1') { localStorage.removeItem('dq_bienv_pend'); bienvEnCurso = false; return; } } catch (e) {}
    // Tampoco encima de una ventana lateral (NPC, inventario...), del cofre diario ni del buzon/Telegram,
    // ni en plena pelea (con AUTO taparia la pantalla en el celular).
    const ocupado = hayVentana() || document.querySelector('.modal.on, #dq-avtg.on, #dq-regalo.on, #tira-diario.on') || enCombate3()
      || ($('v-diario') && $('v-diario').classList.contains('on')) || (typeof loginPend3 !== 'undefined' && loginPend3)
      || (n < 39 && (hayLateral() || Date.now() - ventanaAutoT < 180000));
    if (ocupado) { if (n < 40) setTimeout(() => intentar(n + 1, inv), 3000); else bienvEnCurso = false; return; }
    bienvEnCurso = false;
    ventanaAutoT = Date.now();
    V.abrirTienda('premium', 'bienvenida', 'bienv');
    try { localStorage.setItem(inv ? 'dq_bienv_inv' : 'dq_bienv_ofrecida', '1'); localStorage.removeItem('dq_bienv_pend'); } catch (e) {}
    if (inv) aviso('🎁 Pack de bienvenida: crea tu cuenta gratis para pedirlo y guardar tu duende.', 'ok');
    else aviso('🎁 Pack de bienvenida: solo para tu primera compra. El Duende te lo entrega a mano.', 'ok');
  };
  if (!conCuenta) {
    if (!dispara) return;
    let ya = '';
    try { ya = localStorage.getItem('dq_bienv_inv') || ''; } catch (e) {}
    if (!ya) { bienvEnCurso = true; setTimeout(() => intentar(0, true), 2500); }
    return;
  }
  let eraInv = false;
  if (yo.nivel >= 5) { try { eraInv = localStorage.getItem('dq_bienv_inv') === '1'; } catch (e) {} }
  if (eraInv) { try { localStorage.removeItem('dq_bienv_inv'); localStorage.setItem('dq_bienv_pend', '1'); } catch (e) {} }
  else if (!dispara) return;
  bienvEnCurso = true;
  setTimeout(() => intentar(0, false), 2500);
}
function abrirTiendaHud(via, foco) {
  if (!yo) return;
  const ent = ((yo.pedidos) || []).filter(x => x.estado === 'entregado').length;
  try { localStorage.setItem('dq_tienda_vista', '1'); localStorage.setItem('dq_tienda_ent', String(ent)); } catch (e) {}
  V.abrirTienda('premium', foco || undefined, via); puntoTienda();
}
$('b-premium').onclick = () => abrirTiendaHud('hud');
// ── EDITOR DE APARIENCIA ──
// Cambia el modelo propio en vivo; la camara se pone de frente.
let camAntes = null;
function pintarLook() {
  const l = lookEditor;
  $('lk-cara').textContent = APARIENCIA.cara[l.cara];
  $('lk-cuerpo').textContent = APARIENCIA.cuerpo[l.cuerpo];
  $('lk-pelo').textContent = APARIENCIA.pelo[l.pelo];
  $('lk-disfraz').textContent = APARIENCIA.disfraz[l.disfraz || 0];
  const r = $('lk-altura'); r.min = APARIENCIA.altura.min; r.max = APARIENCIA.altura.max; r.step = APARIENCIA.altura.paso; r.value = l.altura;
  $('lk-color').innerHTML = APARIENCIA.colorPelo.map((c, i) => `<button style="background:${c}" class="${i === l.colorPelo ? 'on' : ''}" data-i="${i}" aria-label="Color ${i + 1}"></button>`).join('');
  $('lk-color').querySelectorAll('button').forEach(b => b.onclick = () => { lookEditor.colorPelo = +b.dataset.i; pintarLook(); cambiarSkinPropia(); });
}
function abrirLook() {
  if (!yo || hayVentana()) return;
  try { localStorage.setItem('dq3_look_visto', '1'); } catch (e) {}
  lookEditor = { ...LOOK_BASE, ...(yo.look || {}) };
  camAntes = { camYaw, camPitch, camDist };
  camYaw = P.ry; camPitch = 0.12; camDist = 4.6;
  pintarLook();
  abrir('v-look');
}
function cerrarLook(guardar) {
  if (guardar && lookEditor) mandar({ t: 'look', look: limpiarLook(lookEditor) });
  if (guardar && yo) yo.look = limpiarLook(lookEditor);
  lookEditor = null;
  if (camAntes) ({ camYaw, camPitch, camDist } = camAntes);
  camAntes = null;
  cerrar('v-look');
  cambiarSkinPropia();
}
document.querySelectorAll('#v-look .flecha').forEach(b => b.onclick = () => {
  const k = b.dataset.k, n = APARIENCIA[k].length;
  lookEditor[k] = ((lookEditor[k] || 0) + +b.dataset.d + n) % n;
  pintarLook(); cambiarSkinPropia(); sfx('boton', 0.2);
});
$('lk-altura').oninput = e => { lookEditor.altura = +e.target.value; cambiarSkinPropia(); };
$('lk-azar').onclick = () => {
  lookEditor = { ...LOOK_BASE, ...lookEditor, cara: Math.floor(Math.random() * APARIENCIA.cara.length), cuerpo: Math.floor(Math.random() * 3), altura: Math.round((APARIENCIA.altura.min + Math.random() * (APARIENCIA.altura.max - APARIENCIA.altura.min)) * 100) / 100, pelo: Math.floor(Math.random() * APARIENCIA.pelo.length), colorPelo: Math.floor(Math.random() * APARIENCIA.colorPelo.length),
    disfraz: Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * (APARIENCIA.disfraz.length - 1)) };
  pintarLook(); cambiarSkinPropia();
};
$('lk-guardar').onclick = () => { paso('look_guardado'); cerrarLook(true); aviso('Apariencia guardada.', 'ok'); };
$('lk-cancelar').onclick = () => cerrarLook(false);
$('v-look').addEventListener('click', e => { if (e.target.id === 'v-look') cerrarLook(false); });
// ── PROBADOR DE SKINS (pestaña SKINS de la tienda) ──
// Te pones la skin solo en tu pantalla y la cámara da una vuelta a tu duende. Nada va al
// servidor (los demás siguen viendo tu skin real) salvo si pulsas Comprar en la franja.
let prueba = null;
const PRUEBA_GIRO = 6000, PRUEBA_DURA = 10000;
function probarSkin(id, deOtro) {   // deOtro: desde el marco de otro jugador (Cerrar no abre la tienda; sale «Ver en tienda»)
  const sk = SKINS[id];
  if (!yo || !sk || yo.muerto || camAntes) return;
  if (prueba) terminarPrueba(false);
  cerrar('v-tienda');
  skinPrueba = id;
  prueba = { id, otro: !!deOtro, cam: { camYaw, camPitch, camDist }, yaw0: P.ry, t0: performance.now(), html: '', pintT: 0 };
  camYaw = P.ry; camPitch = 0.14; camDist = 4.8;
  cambiarSkinPropia();
  const el = probadorEl();
  const verTienda = deOtro && !(yo.skins || []).includes(id) && ((typeof sk.precio === 'number' && sk.precio > 0) || sk.usd)
    ? `<button class="btn sec" data-pr-tienda data-id="${esc(id)}">🛒 Ver en tienda</button>` : '';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="color:${sk.color || '#fff'};flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👀 ${esc(sk.nombre)}</b><span id="probador3-t" style="font-size:12px;opacity:.7"></span>${verTienda}<button class="btn sec" data-pr-cerrar>Cerrar</button></div>`
    + `<div id="probador3-c" class="vv-acc" style="flex-direction:row;flex-wrap:wrap;justify-content:flex-end;align-items:center;width:100%;margin-top:8px"></div>`
    + '<div style="font-size:11px;opacity:.65;margin-top:6px">Solo tú la ves mientras la pruebas.</div>';
  el.style.display = 'block';
  pintarPrueba();
}
// Franja inferior del probador (la comparten skins y monturas; se crea una sola vez).
function probadorEl() {
  let el = $('probador3');
  if (!el) {
    el = document.createElement('div'); el.id = 'probador3';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px) + var(--tg-bot,0px));z-index:9;width:min(520px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;border-radius:14px;background:rgba(14,9,30,.93);border:1px solid #a855f7;color:#f3eaff;font:600 14px system-ui,sans-serif;pointer-events:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,.55)';
    document.body.appendChild(el);
    V.delegarCompra(el);   /* Comprar / Stars / Yape / Equipar: los mismos botones y mensajes que la tarjeta */
    el.addEventListener('click', e => {
      if (e.target.closest('[data-pr-cerrar]')) { sfx('boton', 0.2); terminarPrueba(!(prueba && prueba.otro)); return; }
      const vt = e.target.closest('[data-pr-tienda]');
      if (vt) { const s = vt.dataset.id, k = SKINS[s]; sfx('boton', 0.2); terminarPrueba(false); if (!k) return; if (typeof k.precio === 'number' && k.precio > 0) V.abrirTienda('skin', s, 'hud'); else V.abrirTienda('premium', 'skin_' + s, 'hud'); }
    });
  }
  return el;
}
// ── PROBADOR DE MONTURAS (pestaña MONTURAS de la tienda) ──
// Tu duende sale montado y galopando en el sitio solo en tu pantalla, con la misma vuelta de
// cámara que las skins. No se manda nada al servidor ni cambia tu montura real.
/* Pelea de verdad: golpeaste hace < 4 s o un monstruo te persigue a < 12 m (un objetivo marcado lejos no cuenta). */
function peleaMontura() {
  if (objetivo && performance.now() - (P.atkT || 0) < 4000) return true;
  for (const o of mons.values()) if (o.hp > 0 && !o.muereT && o.st === 2 && Math.hypot(o.x - P.x, o.z - P.z) < 12) return true;
  return false;
}
function probarMontura(id) {
  const mo = MONTURAS[id];
  if (!yo || !mo || yo.muerto || camAntes) return;
  if (P.vuela || P.planea) return aviso('Aterriza para probar la montura.', 'err');
  if (peleaMontura()) return aviso('Sal del combate para probar la montura.', 'err');
  if (prueba) terminarPrueba(false);
  cerrar('v-tienda');
  monturaPrueba = id;
  prueba = { id, montura: true, otro: false, cam: { camYaw, camPitch, camDist }, yaw0: P.ry, t0: performance.now(), html: '', pintT: 0 };
  camYaw = P.ry; camPitch = 0.14; camDist = 5.6;
  if (P.fig && P.fig.tipo === 'modelo') P.fig.montar(id);
  const el = probadorEl();
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👀 ${esc(mo.nombre)}</b><span style="font-size:12px;color:#86efac">+${Math.round((mo.vel - 1) * 100)}% vel.</span><span id="probador3-t" style="font-size:12px;opacity:.7"></span><button class="btn sec" data-pr-cerrar>Cerrar</button></div>`
    + '<div style="font-size:11px;opacity:.65;margin-top:6px">Solo tú la ves mientras la pruebas.</div>';
  el.style.display = 'block';
  pintarPrueba();
}
// Cuenta atrás y precio/botones (se repintan solo si cambian: al comprarla sale «Equipar»).
function pintarPrueba() {
  if (!prueba) return;
  const c = $('probador3-c'), tt = $('probador3-t'), h = prueba.montura ? prueba.html : V.compraSkin(prueba.id);
  if (c && h !== prueba.html) { prueba.html = h; c.innerHTML = h; }
  if (tt) tt.textContent = Math.max(0, Math.ceil((PRUEBA_DURA - (performance.now() - prueba.t0)) / 1000)) + ' s';
}
// Cada cuadro: vuelta completa de la cámara en 6 s (suave) y luego de frente hasta los 10 s.
function girarPrueba() {
  if (!prueba) return;
  const e = performance.now() - prueba.t0;
  if (e >= PRUEBA_DURA || !yo || yo.muerto) { terminarPrueba(!prueba.otro); return; }
  if (prueba.montura && (P.vuela || P.planea || peleaMontura())) { terminarPrueba(false); return; }   /* despegar o entrar en combate corta la prueba de montura */
  const k = Math.min(1, e / PRUEBA_GIRO);
  camYaw = prueba.yaw0 + Math.PI * (1 - Math.cos(Math.PI * k)); camPitch = 0.14; camDist = prueba.montura ? 5.6 : 4.8;
  if (e - prueba.pintT > 250) { prueba.pintT = e; pintarPrueba(); }
}
function terminarPrueba(reabrir) {
  if (!prueba) return;
  const p = prueba; prueba = null; skinPrueba = null; monturaPrueba = null;
  ({ camYaw, camPitch, camDist } = p.cam);
  const el = $('probador3'); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  if (p.montura) { if (P.fig && P.fig.tipo === 'modelo') P.fig.montar(P.vuela ? '' : (yo && yo.montado) || ''); }
  else cambiarSkinPropia();
  // De vuelta a la tienda en la misma skin o montura (no encima de un pago u otra ventana que se abrió).
  if (reabrir && yo && !hayVentana() && !$('v-tienda').classList.contains('on')) V.abrirTienda(p.montura ? 'montura' : 'skin', p.id);
}
/* Esc cierra la prueba y vuelve a la tienda; se corta aquí para que el Esc general no cierre la tienda recién reabierta */
addEventListener('keydown', e => { if (prueba && e.key === 'Escape' && !chatAbierto()) { e.stopImmediatePropagation(); terminarPrueba(!prueba.otro); } });
$('b-look').onclick = () => { if (prueba) terminarPrueba(false); abrirLook(); };
$('b-mapa').onclick = () => abrirMapa();
$('mini').onclick = () => abrirMapa();   // en el movil el 🗺 va dentro de ⋯: el minimapa tambien lo abre
function pintarSon() { $('b-son').textContent = sonido ? '🔊' : '🔇'; }
$('b-son').onclick = () => { sonido = !sonido; try { localStorage.setItem('dq_mmo_sonido', sonido ? '1' : '0'); } catch (e) {} musica.activo(sonido); if (!sonido) { tema.pause(); temaOn = false; } pintarSon(); };
pintarSon(); if (!sonido) musica.activo(false);
try {
  const bss = $('b-sin-son');
  if (bss) {
    const pintarBss = () => { bss.textContent = sonido ? '🔇 Jugar sin sonido' : '🔊 Activar sonido'; };
    pintarBss();
    bss.addEventListener('pointerdown', e => e.stopPropagation(), true);
    bss.onclick = e => { e.stopPropagation(); $('b-son').onclick(); pintarBss(); try { bss.blur(); } catch (e3) {} if (sonido) { try { musica.arrancar(); } catch (e2) {} } };
  }
} catch (e) {}
if (TG && TGV('8.0')) try {
  TG.onEvent('deactivated', () => { fuera3 = true; musica.activo(false); tema.pause(); temaOn = false; if (actx) actx.suspend().catch(() => {}); tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; atkMantener = false; });
  TG.onEvent('activated', () => { fuera3 = false; if (sonido && !temaOn) musica.activo(true); if (actx) actx.resume().catch(() => {}); });
} catch (e) {}
$('b-herm').onclick = () => { if ($('v-herm').classList.contains('on')) return cerrar('v-herm'); abrir('v-herm'); mandar({ t: 'herm' }); pintarHerm(); };
$('b-rank').onclick = () => { if ($('v-rank').classList.contains('on')) return cerrar('v-rank'); abrir('v-rank'); mandar({ t: 'ranking' }); pintarRankPanel(); };
$('b-pase').onclick = () => { if ($('v-pase').classList.contains('on')) cerrar('v-pase'); else { abrir('v-pase'); pintarPase(); } };
$('b-compartir').onclick = () => { presumirTxt = ''; presumirTipo = ''; compartirYa(); };
$('presumir3').onclick = () => { $('presumir3').style.display = 'none'; compartirYa(true); };
// Sin { once }: si el sistema dejo la musica suspendida al volver (iPhone),
// cualquier toque la retoma; con el contexto ya creado solo mira su estado.
// Toque suave al pulsar botones de la interfaz (v321).
addEventListener('pointerdown', e => { if (sonido && e.target.closest && e.target.closest('.bt,.vv-tab,.cerrar,.vv-btn')) musica.tic(e.target.closest('#b-mas')); });
for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, e => { if (e && e.target && e.target.closest && e.target.closest('#b-sin-son')) return; if (sonido) { musica.arrancar(); if (actx && actx.state !== 'running') actx.resume().catch(() => {}); } });   // efectos tambien (iPhone)
// Fuera de la app (otra pestaña, pantalla apagada, Telegram sin 'deactivated')
// la musica y los golpes seguian sonando de fondo.
document.addEventListener('visibilitychange', () => {
  // Al salir (Telegram, otra app) se sueltan joystick y botones: si no, volvia con SUBIR o el joystick pegados.
  if (document.hidden) { musica.activo(false); tema.pause(); temaOn = false; if (actx) actx.suspend().catch(() => {}); tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; for (const k in teclas) teclas[k] = false; atkMantener = false; }
  else { fuera3 = false; if (sonido) { if (!temaOn) musica.activo(true); if (actx) actx.resume().catch(() => {}); } }
});
// «Antes de irte, manda a tu mascota»: una vez por partida, si puede y no tiene expedicion.
// PC: el raton sale por arriba (va a cerrar la pestaña). Movil: al volver tras salir un rato.
let avisoExpT = 0, avisoExpVisto = false;
const sinExped = () => !avisoExpVisto && yo && yo.clase && yo.nivel >= EXPEDICION.nv && !yo.exped;
const AVISO_EXP = '🧭 Antes de irte, manda a tu mascota de expedición: vuelve con oro y materiales aunque no juegues. Toca 🧭 en tus misiones.';
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (sinExped()) avisoExpT = Date.now(); }
  else if (avisoExpT && Date.now() - avisoExpT > 20000 && sinExped()) { avisoExpVisto = true; avisoExpT = 0; setTimeout(() => aviso(AVISO_EXP, 'ok'), 2500); }
});
document.addEventListener('mouseout', e => { if (!e.relatedTarget && e.clientY <= 0 && sinExped() && !hayVentana()) { avisoExpVisto = true; aviso(AVISO_EXP, 'ok'); } });
$('b-ayuda').onclick = () => { const ac = $('ay-cuenta'); if (ac) ac.style.display = soyInvitado ? '' : 'none'; abrir('v-ayuda'); };
$('sel-calidad').value = CAL;
$('sel-calidad').onchange = e => { try { localStorage.setItem('dq3_calidad', e.target.value); } catch (er) {} location.reload(); };
if ($('sel-brillo')) { $('sel-brillo').value = BRILLO; $('sel-brillo').onchange = e => { BRILLO = e.target.value === 'claro' ? 'claro' : 'normal'; try { localStorage.setItem('dq3_brillo', BRILLO); } catch (er) {} ambiente(zonaActual || zonaEn(P.x, P.z)); }; }
$('b-amigos').onclick = () => { if ($('v-amigos').classList.contains('on')) return cerrar('v-amigos'); abrir('v-amigos'); mandar({ t: 'contactos' }); mandar({ t: 'quien' }); mandar({ t: 'amigos' }); $('amigos-c')._h = ''; pintarAmigos3(); };
$('b-chat').onclick = () => { const i = $('chat-in'); i.style.display = 'block'; i.focus(); };
// 😀 Gestos y frases rapidas: hablar sin teclado (movil). Frases fijas: al grupo si
// tienes, si no al general, por el mismo enviarChat. Se cierra al elegir.
const FRASES3 = ['¡Ayuda aquí!', 'Vamos al jefe', 'Gracias, causa', 'Espérame', 'Necesito curación', '¡Bien jugado!'];
(() => {
  const fila = $('gestos3'), bt = $('b-gestos');
  if (!fila || !bt) return;
  fila.innerHTML = '<div class="g3-e">' + Object.entries(GESTOS).map(([id, g]) => `<button type="button" data-g="${id}" title="${g.txt}" aria-label="${g.txt}">${g.e}</button>`).join('') + '<button type="button" data-m="1" title="Marcar: tu objetivo, un recurso cercano o adelante" aria-label="Marcar lugar para tu grupo y los cercanos">📍</button><button type="button" data-foto="1" title="Foto bailando para compartir" aria-label="Foto de tu duende bailando para compartir">📸</button><button type="button" data-cine="1" title="Modo cine: sin botones, para grabar tu pantalla" aria-label="Modo cine para grabar">🎬</button></div>'
    + '<div class="g3-f">' + FRASES3.map((f, i) => `<button type="button" data-f="${i}">${f}</button>`).join('') + '</div>';
  const cerrarG = () => { fila.classList.remove('on'); };
  // Debajo del boton y nunca hasta la barra de habilidades/joystick (si no cabe, desliza).
  const colocar = () => {
    const ra = bt.getBoundingClientRect(), r = ra.width ? ra : $('b-mas').getBoundingClientRect();   // en tactil el boton vive dentro de ⋯, que ya se cerro
    const w = Math.min(330, innerWidth - 16), top = Math.max(8, r.bottom + 6);
    fila.style.width = w + 'px';
    fila.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
    fila.style.top = top + 'px';
    fila.style.maxHeight = Math.max(110, innerHeight - top - 90) + 'px';
  };
  bt.onclick = () => {
    if (fila.classList.toggle('on')) { requestAnimationFrame(colocar); SON.tocar('clic', { vol: 0.7 }); }
  };
  addEventListener('resize', () => { if (fila.classList.contains('on')) colocar(); });
  fila.onclick = e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.g) mandar({ t: 'gesto', id: b.dataset.g });
    else if (b.dataset.m) marcar3();
    else if (b.dataset.foto) fotoBaile();
    else if (b.dataset.cine) modoCine();
    else if (b.dataset.f) { const f = FRASES3[b.dataset.f | 0]; if (f) enviarChat((grupo3 && grupo3.m && grupo3.m.length > 1 ? '/g ' : '') + f); }
    cerrarG();
  };
  document.addEventListener('pointerdown', e => { if (fila.classList.contains('on') && !fila.contains(e.target) && !bt.contains(e.target)) cerrarG(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarG(); });
})();
// El menu ⋯ abierto se cierra al tocar fuera de el (tapa parte del mundo).
document.addEventListener('pointerdown', e => { const m = $('botones'); if (m.classList.contains('abierto') && !m.contains(e.target)) m.classList.remove('abierto'); }, true);
$('b-reconectar').onclick = () => location.reload();   // error() lo cambia segun el caso

// ── MAPA (minimapa y mapa del mundo, pintados una vez) ──
let mapaBase = null;
// three guarda los colores en lineal; el lienzo los quiere en sRGB (sin esto el mapa salia oscuro).
const GAMA_MAPA = THREE.ColorManagement && THREE.ColorManagement.enabled ? 1 / 2.2 : 1;
// Destino 📍 personal del mapa (solo en este navegador). Se ve en el minimapa con flecha y metros.
let destino3 = null;
try { const d = JSON.parse(localStorage.getItem('dq_destino3') || 'null'); if (d && Number.isFinite(d.x) && Number.isFinite(d.z)) destino3 = { x: d.x, z: d.z }; } catch (e) {}
function pintarMapaBase() {
  const N = 220, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), col = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const wx = (i / N - 0.5) * LADO, wz = (j / N - 0.5) * LADO, h = alturaEn(wx, wz);
    if (h < MUNDO.agua) col.set('#2f74b5'); else colorSuelo(wx, wz, h, col);
    const k = (j * N + i) * 4;
    img.data[k] = Math.pow(col.r, GAMA_MAPA) * 255; img.data[k + 1] = Math.pow(col.g, GAMA_MAPA) * 255; img.data[k + 2] = Math.pow(col.b, GAMA_MAPA) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  mapaBase = c;
}
function aMapa(wx, wz, N) { return [(wx / LADO + 0.5) * N, (wz / LADO + 0.5) * N]; }
let ryMini = 0;
// Si un punto del minimapa queda fuera del cuadro, lo recorta al borde en su
// misma direccion (asi se ve hacia donde esta la mision o el compañero).
function alBordeMini(px, pz, S, m = 8) {
  if (COMPACTO) {   // en el celular el minimapa es redondo: se recorta al circulo, no al cuadro
    const dx = px - S / 2, dz = pz - S / 2, d = Math.hypot(dx, dz), R = S / 2 - m;
    return d <= R ? [px, pz] : [S / 2 + dx / d * R, S / 2 + dz / d * R];
  }
  if (px >= m - 2 && pz >= m - 2 && px <= S - m + 2 && pz <= S - m + 2) return [px, pz];
  const a = Math.atan2(pz - S / 2, px - S / 2);
  return [S / 2 + Math.cos(a) * (S / 2 - m), S / 2 + Math.sin(a) * (S / 2 - m)];
}
let miniUltT = 0;
function pintarMini() {
  actualizarMarcas3();
  if (!mapaBase) return;
  // Celular: 5 repintados por segundo como mucho, y ninguno si el HUD esta oculto.
  const ahoraMini = performance.now();
  if (COMPACTO && (ahoraMini - miniUltT < 195 || document.body.classList.contains('cine'))) return;
  miniUltT = ahoraMini;
  const cv = $('mini-c'), x = cv.getContext('2d'), S = 150, vista = COMPACTO ? 200 : 240;
  // Lienzo nitido en pantallas densas; se sigue dibujando en unidades de 150.
  const escMini = COMPACTO ? Math.min(2, Math.max(1, Math.ceil((window.devicePixelRatio || 1) * 0.67))) : 1;
  if (cv.width !== S * escMini) cv.width = cv.height = S * escMini;
  x.setTransform(escMini, 0, 0, escMini, 0, 0);
  const N = mapaBase.width, [mx, mz] = aMapa(P.x, P.z, N), lado = vista / LADO * N;
  x.clearRect(0, 0, S, S);
  const k = S / vista;
  // Celular: el mapa gira con la camara, asi "arriba" en el minimapa es "adelante" en la pantalla.
  const yawM = COMPACTO ? camYaw : 0, cM = Math.cos(yawM), sM = Math.sin(yawM);
  const aPx = (wx, wz) => { const dx = (wx - P.x) * k, dz = (wz - P.z) * k; return [dx * cM - dz * sM + S / 2, dx * sM + dz * cM + S / 2]; };
  if (enAbismo(P.x)) {
    x.fillStyle = '#1a1240'; x.fillRect(0, 0, S, S);
    for (const is of ABISMO.islas) { const [ix, iz] = aPx(ABISMO_X0 + is.x, is.z); x.fillStyle = is.base === 'luz' ? '#c9b46a' : is.base === 'sombra' ? '#6b2f7e' : is.nucleo ? '#8a7fb0' : '#5b4bb0'; x.beginPath(); x.arc(ix, iz, is.r * k, 0, 7); x.fill(); }
  } else if (enCueva(P.x)) {
    x.fillStyle = '#0b0814'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#4a3f5c';
    x.save(); x.translate(S / 2, S / 2); x.rotate(yawM);
    for (const [a, b, c, d] of CUEVA.salas) x.fillRect((CUEVA_X0 + a - P.x) * k * 2.2, (b - P.z) * k * 2.2, (c - a) * k * 2.2, (d - b) * k * 2.2);
    x.restore();
  } else {
    if (COMPACTO) { x.fillStyle = '#16251c'; x.fillRect(0, 0, S, S); }
    x.save(); x.translate(S / 2, S / 2); x.rotate(yawM);
    x.drawImage(mapaBase, mx - lado / 2, mz - lado / 2, lado, lado, -S / 2, -S / 2, S, S);
    x.restore();
  }
  const esMovil = COMPACTO;
  // Norte en el borde para no perderse al girar y poder comparar con el mapa grande.
  if (esMovil && !enCueva(P.x)) {
    const nx = S / 2 + sM * (S / 2 - 11), nz = S / 2 - cM * (S / 2 - 11);
    x.font = 'bold 15px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText('N', nx, nz); x.fillStyle = '#fecaca'; x.fillText('N', nx, nz);
  }
  const punto = (wx, wz, color, r) => { const [px, pz] = aPx(wx, wz); if (px < 0 || pz < 0 || px > S || pz > S) return; if (esMovil && r < 3) r *= 1.25; x.fillStyle = color; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill(); if (esMovil) { x.strokeStyle = 'rgba(0,0,0,.65)'; x.lineWidth = 1; x.stroke(); } };
  // Eventos grandes: nunca desaparecen; si estan lejos se pegan al borde, laten y muestran la distancia.
  const borde = (wx, wz, color, r) => {
    if (esMovil) r *= 1.7;   // en movil el canvas se ve a ~0,66x: punto y texto mas grandes
    const [px0, pz0] = aPx(wx, wz), [bx, bz] = alBordeMini(px0, pz0, S, esMovil ? 13 : 8), alBorde = bx !== px0 || bz !== pz0;
    x.fillStyle = color; x.strokeStyle = '#fff'; x.lineWidth = esMovil ? 2.5 : 1.5;
    x.beginPath(); x.arc(bx, bz, r * (1 + 0.25 * Math.sin(Date.now() / 200)), 0, 7); x.fill(); x.stroke();
    if (alBorde) {
      const t = Math.round(Math.hypot(wx - P.x, wz - P.z)) + 'm', d0 = Math.hypot(bx - S / 2, bz - S / 2) || 1;
      // En el celular la distancia va hacia el centro del circulo: en las esquinas se recortaria.
      const ty = esMovil ? bz + (S / 2 - bz) / d0 * (r + 12) : bz < 16 ? bz + r + 9 : bz - r - 7;
      x.font = esMovil ? 'bold 16px system-ui' : 'bold 9px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const mt = esMovil ? 25 : 16, tx = esMovil ? bx + (S / 2 - bx) / d0 * (r + 18) : Math.max(mt, Math.min(S - mt, bx));
      x.strokeStyle = '#000'; x.lineWidth = esMovil ? 3.5 : 2.5; x.strokeText(t, tx, ty); x.fillStyle = '#fff'; x.fillText(t, tx, ty);
    }
  };
  const mundoPrincipal = !enCueva(P.x) && !enAbismo(P.x);
  if (asedio && asedio.activo && asedio.puerta && enAbismo(P.x)) punto(PUERTA_NUCLEO.x, PUERTA_NUCLEO.z, '#ff3b3b', 4.5);
  if (metaEnc) punto(metaEnc.x, metaEnc.z, esMovil ? '#fef08a' : '#7dd3fc', 3.5);   // celular: el celeste queda solo para el grupo
  if (enAbismo(P.x) && yo && yo.faccion) for (const q of MAQUINAS) if (q.f === yo.faccion) punto(q.x, q.z, '#fbbf24', 2);
  for (const o of mons.values()) if (!o.muereT) punto(o.x, o.z, o.j ? '#ffd84a' : '#ff4455', o.j ? 3.5 : 2);
  for (const o of otros.values()) punto(o.x, o.z, enGrupo(o.id) ? '#7dd3fc' : '#4ade80', enGrupo(o.id) ? (esMovil ? 5 : 3.5) : 2.5);
  // Compañeros de grupo fuera de vista: el servidor manda p3 [x, z]; si quedan
  // lejos se pegan al borde del minimapa para saber hacia donde ir.
  if (grupo3 && grupo3.m) for (const g of grupo3.m) if (g.on && Array.isArray(g.p3) && g.id !== miId && !otros.has(g.id) && !enCueva(g.p3[0]) === !enCueva(P.x) && !enAbismo(g.p3[0]) === !enAbismo(P.x)) {
    const [g0x, g0z] = aPx(g.p3[0], g.p3[1]), [gx, gz] = alBordeMini(g0x, g0z, S, esMovil ? 10 : 8);
    x.fillStyle = '#7dd3fc'; x.strokeStyle = '#fff'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(gx, gz, esMovil ? 5 : 3.5, 0, 7); x.fill(); x.stroke();
  }
  { const ah = Date.now(); for (const c of COFRES3) if (c.listoEn <= ah && Math.abs(c.x - P.x) < 130 && Math.abs(c.z - P.z) < 130) punto(c.x, c.z, c.tipo === 'legendario' ? '#ffd84a' : c.tipo === 'epico' ? '#c084fc' : '#d6a35c', c.tipo === 'legendario' ? 3.2 : 2.4); }
  for (const o of mons.values()) if (o.ra && !o.muereT) punto(o.x, o.z, o.ti || '#ffd84a', 4);
  { const ah = performance.now(); for (const n of NODOS) if (Math.abs(n.x - P.x) < 130 && Math.abs(n.z - P.z) < 130 && !(nodoListo.get(n.i) > ah)) punto(n.x, n.z, n.tipo === 'hierba' ? '#c084fc' : '#fbbf24', 1.6); }
  // NPC: cuadrado gris claro (no se confunde con el grupo) y debajo del '!' de mision.
  { x.fillStyle = '#e5e7eb'; x.strokeStyle = '#000'; x.lineWidth = 1; const rn = esMovil ? 3.6 : 2; for (const n of NPCS3D) { const [px, pz] = aPx(n.x, n.z); if (px >= 0 && pz >= 0 && px <= S && pz <= S) { x.fillRect(px - rn, pz - rn, rn * 2, rn * 2); if (esMovil) x.strokeRect(px - rn, pz - rn, rn * 2, rn * 2); } } }
  // Vecinos: mismo cuadrado; con algo para ti, signo dorado. El mas cercano fuera de vista se pega al borde.
  if (!enCueva(P.x) && !enAbismo(P.x)) {
    const mk = marcasNpc(), rn = esMovil ? 3.6 : 2, signo = (px, pz, k, tam) => { x.font = `900 ${tam}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.strokeStyle = '#000'; x.lineWidth = 3.5; x.strokeText(k, px, pz); x.fillStyle = '#ffd84a'; x.fillText(k, px, pz); };
    let lejos = null, dL = Infinity;
    x.fillStyle = '#e5e7eb'; x.strokeStyle = '#000'; x.lineWidth = 1;
    for (const n of VECINOS) { const [px, pz] = aPx(n.x, n.z); if (px >= 0 && pz >= 0 && px <= S && pz <= S) { x.fillRect(px - rn, pz - rn, rn * 2, rn * 2); if (esMovil) x.strokeRect(px - rn, pz - rn, rn * 2, rn * 2); } }
    for (const n of TODOS_NPC) {
      const k = mk.get(n.nombre); if (!k) continue;
      const [px, pz] = aPx(n.x, n.z);
      if (px >= 0 && pz >= 0 && px <= S && pz <= S) signo(px, pz - (esMovil ? 7 : 5), k, esMovil ? 19 : 14);
      else { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < dL) { dL = d; lejos = [px, pz, k]; } }
    }
    if (lejos && dL < 320) { const [bx, bz] = alBordeMini(lejos[0], lejos[1], S, esMovil ? 11 : 7); signo(bx, bz, lejos[2], esMovil ? 16 : 12); }
  }
  // Portal (celular): aro violeta con centro claro; en el Abismo, el de tu faccion para volver.
  if (esMovil) {
    const pb = enAbismo(P.x) ? (yo && yo.faccion ? portalBase(yo.faccion) : null) : mundoPrincipal ? portal : null;
    if (pb) { const [px, pz] = aPx(pb.x, pb.z); if (px >= 0 && pz >= 0 && px <= S && pz <= S) { x.fillStyle = '#f5f3ff'; x.strokeStyle = '#a855f7'; x.lineWidth = 3; x.beginPath(); x.arc(px, pz, 5, 0, 7); x.fill(); x.stroke(); } }
  }
  if (mundoPrincipal && invasion3 && ZONAS3D[invasion3.zona]) borde(ZONAS3D[invasion3.zona].x, ZONAS3D[invasion3.zona].z, '#ff5a1f', 5);
  else if (mundoPrincipal && invPre3 && ZONAS3D[invPre3.zona]) borde(ZONAS3D[invPre3.zona].x, ZONAS3D[invPre3.zona].z, '#ff9a3c', 4);
  if (mundoPrincipal && mundial3 && mundial3.vivo) borde(ARENA3D.x, ARENA3D.z, '#ff6b3d', 5);
  if (metaMision) {
    const [m0x, m0z] = aPx(metaMision.x, metaMision.z), [px, pz] = alBordeMini(m0x, m0z, S, esMovil ? 13 : 8);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (esMovil) {   // celular: disco grande con el signo dentro, se ve de un vistazo incluso pegado al borde
      x.fillStyle = metaMision.guia ? '#4ade80' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 2.5;
      x.beginPath(); x.arc(px, pz, 11, 0, 7); x.fill(); x.stroke();
      x.font = 'bold 17px system-ui'; x.fillStyle = '#000'; x.fillText(metaMision.guia ? '?' : '!', px, pz + 1);
    } else {
      x.fillStyle = metaMision.guia ? '#4ade80' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 2;
      x.font = 'bold 14px system-ui';
      x.strokeText(metaMision.guia ? '?' : '!', px, pz); x.fillText(metaMision.guia ? '?' : '!', px, pz);
    }
  }
  // Marcas 📍 vivas: punto que parpadea (encendido/apagado cada 250 ms).
  if (marcas3.length && ((Date.now() / 250) | 0) % 2 === 0) for (const a of marcas3) { const [a0x, a0z] = aPx(a.x, a.z), [mx2, mz2] = alBordeMini(a0x, a0z, S); x.fillStyle = MARCA_CSS[a.k]; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.arc(mx2, mz2, esMovil ? 6 : 4.5, 0, 7); x.fill(); x.stroke(); }
  // Destino 📍 del mapa grande: dentro del cuadro, el 📍; fuera, una flecha en el borde. Siempre con los metros.
  if (destino3 && mundoPrincipal && yo) {
    const dm = Math.hypot(destino3.x - P.x, destino3.z - P.z);
    if (dm < 10) { ponerDestino(null); aviso('📍 ¡Llegaste a tu destino!', 'ok'); }
    else {
      const [px0, pz0] = aPx(destino3.x, destino3.z), mg = esMovil ? 17 : 10, [bx, bz] = alBordeMini(px0, pz0, S, mg), aD = Math.atan2(pz0 - S / 2, px0 - S / 2), lejos = bx !== px0 || bz !== pz0;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (lejos) {
        const t = esMovil ? 15 : 9;
        x.save(); x.translate(bx, bz); x.rotate(aD + Math.PI / 2); x.fillStyle = '#ff2d55'; x.strokeStyle = '#fff'; x.lineWidth = esMovil ? 3 : 1.5;
        x.beginPath(); x.moveTo(0, -t); x.lineTo(t * 0.8, t * 0.7); x.lineTo(-t * 0.8, t * 0.7); x.closePath(); x.stroke(); x.fill(); x.restore();
      } else { x.font = (esMovil ? 34 : 20) + 'px system-ui'; x.fillStyle = '#ff2d55'; x.fillText('📍', bx, bz - (esMovil ? 14 : 8)); }
      const txt = Math.round(dm) + 'm', fT = esMovil ? 16 : 11, mt = esMovil ? 30 : 18;
      // En el celular la distancia va junto a la marca, sin llegar a la flecha del jugador (centro).
      const tx = lejos ? (esMovil ? bx : bx - Math.cos(aD) * 20) : bx, tz = lejos ? (esMovil ? bz + (bz < S / 2 ? 24 : -24) : bz - Math.sin(aD) * 16) : bz + (esMovil ? 14 : 9);
      x.font = 'bold ' + fT + 'px system-ui'; x.strokeStyle = '#000'; x.lineWidth = esMovil ? 4 : 2.5;
      const txC = clamp(tx, mt, S - mt), tzC = clamp(tz, fT, S - fT);
      x.strokeText(txt, txC, tzC); x.fillStyle = '#fff'; x.fillText(txt, txC, tzC);
    }
  }
  // Cono de vision de la camara (mira hacia -sin/-cos de camYaw); en el celular apunta siempre arriba.
  x.save(); x.translate(S / 2, S / 2); x.rotate(yawM - camYaw);
  x.fillStyle = esMovil ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.13)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, esMovil ? 58 : 46, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill(); x.restore();
  // Flecha propia: hacia donde mira el duende (P.ry = atan2(dx, dz); en el
  // mapa x es x y z va hacia abajo, asi que la rotacion es PI - ry).
  ryMini = lerpAng(ryMini, P.ry, esMovil ? 0.8 : 0.5);
  x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI - ryMini + yawM); if (esMovil) x.scale(1.5, 1.5);
  x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(0, -8); x.lineTo(5.5, 6); x.lineTo(0, 3); x.lineTo(-5.5, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
}
// ── NIEBLA DEL MAPA: celdas de 22x22 que se descubren al caminar (solo cliente, en localStorage) ──
const NIEBLA_N = 22, niebla = new Uint8Array(NIEBLA_N * NIEBLA_N);
let nieblaCambio = false, nieblaGuardadaT = 0;
try { const s = localStorage.getItem('dq_niebla') || ''; if (s.length === niebla.length && /^[01]+$/.test(s)) for (let i = 0; i < s.length; i++) niebla[i] = s.charCodeAt(i) === 49 ? 1 : 0; } catch (e) {}
function celdaNiebla(wx, wz) {
  const [cx, cz] = aMapa(wx, wz, NIEBLA_N);
  return [Math.max(0, Math.min(NIEBLA_N - 1, Math.floor(cx))), Math.max(0, Math.min(NIEBLA_N - 1, Math.floor(cz)))];
}
function marcarCeldasNiebla(cx, cz, r) {
  for (let j = cz - r; j <= cz + r; j++) for (let i = cx - r; i <= cx + r; i++) {
    if (i < 0 || j < 0 || i >= NIEBLA_N || j >= NIEBLA_N) continue;
    const k = j * NIEBLA_N + i; if (!niebla[k]) { niebla[k] = 1; nieblaCambio = true; }
  }
}
function guardarNiebla(forzar) {
  if (!nieblaCambio || (!forzar && Date.now() - nieblaGuardadaT < 10000)) return;
  nieblaGuardadaT = Date.now(); nieblaCambio = false;
  try { localStorage.setItem('dq_niebla', Array.from(niebla).join('')); } catch (e) {}
}
function marcarNiebla(wx, wz) { const [cx, cz] = celdaNiebla(wx, wz); marcarCeldasNiebla(cx, cz, 1); guardarNiebla(false); }
// Mirador revelado: su hito y 3 celdas a la redonda quedan vistos.
function revelarNieblaZona(zk) {
  try { const hi = hitoDe(zk, ZONAS3D, alturaEn) || ZONAS3D[zk]; if (!hi) return; const [cx, cz] = celdaNiebla(hi.x, hi.z); marcarCeldasNiebla(cx, cz, 3); guardarNiebla(true); } catch (e) {}
}
// El pueblo inicial cuenta siempre como visto (no asusta al novato).
{ const [cx, cz] = celdaNiebla(0, 0); marcarCeldasNiebla(cx, cz, 2); }
setInterval(() => { try { if (yo && !enCueva(P.x) && !enAbismo(P.x)) marcarNiebla(P.x, P.z); } catch (e) {} }, 1000);
addEventListener('pagehide', () => guardarNiebla(true));
function pintarNiebla(x, S) {
  // Lienzo de (N+2)x(N+2): el marco repite la celda de la orilla para que el desenfoque no aclare los bordes.
  const T = NIEBLA_N + 2, c = document.createElement('canvas'); c.width = c.height = T;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(20,16,40,.82)';
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const ci = Math.max(0, Math.min(NIEBLA_N - 1, i - 1)), cj = Math.max(0, Math.min(NIEBLA_N - 1, j - 1));
    if (!niebla[cj * NIEBLA_N + ci]) g.fillRect(i, j, 1, 1);
  }
  x.save(); x.imageSmoothingEnabled = true;
  if ('filter' in x) x.filter = 'blur(6px)';
  const m = S / NIEBLA_N; x.drawImage(c, 0, 0, T, T, -m, -m, S + 2 * m, S + 2 * m);
  x.restore();
}
// ── MAPA DEL MUNDO: lienzo a pantalla completa en el movil, con zoom (pellizco, rueda, + y -),
// arrastre, centrar en mi y destino 📍 personal. Mantiene la niebla y los datos de exploracion.
const MAPA_TINTE = Object.fromEntries(Object.entries({
  pueblo: '#86df6e', noche: '#4f7fc9', amanecer: '#ec8f63', selva: '#3fc65c', tormenta: '#8f8bc0', desierto: '#f3d789',
  castillo: '#aeaa9c', cumbres: '#e3e7f5', cavernas: '#45aeb0', abismo: '#86dccb', acantilados: '#bd8fe6',
}).map(([k, h]) => [k, [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16))]));
const MAPA_ESC_MAX = 3;   // pixeles por metro con el zoom al maximo
const MV = { esc: 0, cx: 0, cz: 0, w: 0, h: 0, ptrs: new Map(), toque: null, raf: 0, tic: 0, zonas: [], miradores: [], hitos: [], pc: 0, niebla: null };
let mapaHD = null, mapaHDEn = false;
// Version nitida del terreno: color de la zona, relieve sombreado y limites de zona. Se pinta
// a trozos la primera vez que se abre (mientras tanto se usa la base del minimapa).
function pintarMapaHD() {
  if (mapaHD || mapaHDEn) return;
  mapaHDEn = true;
  const N = 440, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data, col = new THREE.Color(), g = GAMA_MAPA;
  let hA = new Float32Array(N), hN = new Float32Array(N), zA = new Array(N), zN = new Array(N), j = 0;
  const trozo = () => {
    const t0 = performance.now();
    while (j < N && performance.now() - t0 < 8) {
      const wz = ((j + 0.5) / N - 0.5) * LADO;
      for (let i = 0; i < N; i++) {
        const wx = ((i + 0.5) / N - 0.5) * LADO, h = alturaEn(wx, wz), zid = zonaEn(wx, wz), k = (j * N + i) * 4;
        hN[i] = h; zN[i] = zid;
        let r, v, b;
        if (h < MUNDO.agua) { const t = clamp((MUNDO.agua - h) / 9, 0, 1); r = 96 - 56 * t; v = 190 - 70 * t; b = 240 - 40 * t; }
        else {
          colorSuelo(wx, wz, h, col);
          const ti = MAPA_TINTE[zid] || MAPA_TINTE.castillo, s = clamp(1 + (h - (i && j ? hA[i - 1] : h)) * 0.1, 0.74, 1.22);
          r = (Math.pow(clamp(col.r, 0, 1), g) * 140 + ti[0] * 0.45) * s;
          v = (Math.pow(clamp(col.g, 0, 1), g) * 140 + ti[1] * 0.45) * s;
          b = (Math.pow(clamp(col.b, 0, 1), g) * 140 + ti[2] * 0.45) * s;
          if ((i && zN[i - 1] !== zid) || (j && zA[i] !== zid)) { r = r * 0.45 + 140; v = v * 0.45 + 140; b = b * 0.45 + 140; }
        }
        d[k] = r; d[k + 1] = v; d[k + 2] = b; d[k + 3] = 255;
      }
      [hA, hN] = [hN, hA]; [zA, zN] = [zN, zA];
      j++;
    }
    if (j < N) { setTimeout(trozo, 0); return; }
    x.putImageData(img, 0, 0);
    mapaHD = c;
    mapaPedir();
  };
  trozo();
}
const mapaEscMin = () => Math.min(MV.w, MV.h) / LADO;   // el mundo entero cabe en la pantalla
function mapaLimitar() {
  MV.esc = clamp(MV.esc, mapaEscMin(), Math.max(mapaEscMin(), MAPA_ESC_MAX));
  // Acercado se puede pasar 84 px del borde (para que nada quede bajo los botones); de lejos, el mundo queda centrado.
  const m = 84 / MV.esc * clamp(MV.esc / mapaEscMin() - 1, 0, 1), mx = Math.max(0, LADO / 2 + m - MV.w / 2 / MV.esc), mz = Math.max(0, LADO / 2 + m - MV.h / 2 / MV.esc);
  MV.cx = clamp(MV.cx, -mx, mx); MV.cz = clamp(MV.cz, -mz, mz);
}
function mapaPedir() { if (!MV.raf) MV.raf = requestAnimationFrame(() => { MV.raf = 0; mapaDibujar(); }); }
function mapaZoom(px, py, f) {
  // El punto bajo el dedo (o el cursor) se queda quieto mientras cambia la escala.
  const wx = (px - MV.w / 2) / MV.esc + MV.cx, wz = (py - MV.h / 2) / MV.esc + MV.cz;
  MV.esc = clamp(MV.esc * f, mapaEscMin(), Math.max(mapaEscMin(), MAPA_ESC_MAX));
  MV.cx = wx - (px - MV.w / 2) / MV.esc; MV.cz = wz - (py - MV.h / 2) / MV.esc;
  mapaLimitar(); mapaPedir();
}
function mapaEnMundo() { return !enCueva(P.x) && !enAbismo(P.x); }
function mapaCentrar() {
  if (mapaEnMundo()) { MV.cx = P.x; MV.cz = P.z; } else { MV.cx = 0; MV.cz = 0; }
  mapaLimitar(); mapaPedir();
}
function ponerDestino(wx, wz) {
  destino3 = wx == null ? null : { x: Math.round(wx), z: Math.round(wz) };
  try { if (destino3) localStorage.setItem('dq_destino3', JSON.stringify(destino3)); else localStorage.removeItem('dq_destino3'); } catch (e) {}
  mapaChip(); mapaPedir();
}
function mapaChip() {
  const t = $('mapa-dest-t'), q = $('mapa-dest-q');
  if (!t) return;
  const txt = !destino3 ? (mapaEnMundo() ? 'Toca el mapa para poner un destino 📍' : 'Tu posición no sale aquí: estás fuera del mundo abierto.')
    : mapaEnMundo() ? `📍 Destino a ${Math.round(Math.hypot(destino3.x - P.x, destino3.z - P.z))} m` : '📍 Destino guardado';
  if (t.textContent !== txt) t.textContent = txt;
  q.style.display = destino3 ? '' : 'none';
}
function mapaTocar(px, py) {
  const ley = $('mapa-ley');
  if (ley.open) { ley.open = false; return; }   // el primer toque fuera solo pliega la leyenda
  const wx = (px - MV.w / 2) / MV.esc + MV.cx, wz = (py - MV.h / 2) / MV.esc + MV.cz;
  if (destino3 && Math.hypot((destino3.x - MV.cx) * MV.esc + MV.w / 2 - px, (destino3.z - MV.cz) * MV.esc + MV.h / 2 - 14 - py) < 34) { ponerDestino(null); return; }
  if (Math.abs(wx) > LADO / 2 || Math.abs(wz) > LADO / 2) return;
  if (mapaEnMundo() && Math.hypot(wx - P.x, wz - P.z) < 12) { aviso('📍 Ya estás en ese punto.', 'ok', 1); return; }
  ponerDestino(wx, wz);
  SON.tocar('clic', { vol: 0.6 });
}
function mapaDibujar() {
  const cv = $('mapa-c');
  if (!$('v-mapa').classList.contains('on')) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  MV.w = w; MV.h = h; mapaLimitar();
  const x = cv.getContext('2d'), e = MV.esc, sx = wx => (wx - MV.cx) * e + w / 2, sz = wz => (wz - MV.cz) * e + h / 2;
  const fuera = (px, py, m) => px < -m || py < -m || px > w + m || py > h + m;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.imageSmoothingEnabled = true;
  x.fillStyle = '#0d1730'; x.fillRect(0, 0, w, h);
  const ox = sx(-LADO / 2), oz = sz(-LADO / 2), T = LADO * e;
  x.drawImage(mapaHD || mapaBase, ox, oz, T, T);
  if (MV.niebla) { x.globalAlpha = 0.72; x.drawImage(MV.niebla, ox, oz, T, T); x.globalAlpha = 1; }   // se intuye el color de la zona bajo la niebla
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; x.strokeRect(ox, oz, T, T);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  const rI = clamp(8 + e * 2.5, 10, 15);   // radio de los iconos: crece un poco con el zoom
  // Icono: disco oscuro con borde de color y su emoji o letra dentro.
  const pin = (px, py, ico, borde, r = rI, col = '#fff') => {
    if (fuera(px, py, r + 2)) return;
    x.fillStyle = 'rgba(12,10,26,.9)'; x.strokeStyle = borde; x.lineWidth = 2;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke();
    x.font = `700 ${Math.round(r * 1.25)}px system-ui`; x.fillStyle = col; x.fillText(ico, px, py + 1);
  };
  const texto = (t, px, py, col, f = '700 12px system-ui') => { x.font = f; x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineWidth = 3; x.strokeText(t, px, py); x.fillStyle = col; x.fillText(t, px, py); };
  // Placa legible (fondo oscuro) con varias lineas: [texto, color, fuente].
  // De lejos, placas mas pequeñas y sin la exploracion: asi las 11 caben sin pisarse.
  const chico = e < 0.42, AL = chico ? 14 : 16, F1 = chico ? '700 12px system-ui' : '700 13px system-ui', F2 = chico ? '600 11px system-ui' : '600 12px system-ui';
  const placas = [], placa = (lineas, px, py) => {
    let an = 0;
    for (const [t, , f] of lineas) { x.font = f; an = Math.max(an, x.measureText(t).width); }
    const aw = an + 12, ah = lineas.length * AL + 4;
    if (fuera(px, py, Math.max(aw, ah))) return;
    const bx = clamp(px - aw / 2, 2, Math.max(2, w - aw - 2));
    let by = py;
    // Si pisa otra placa ya dibujada, baja lo justo para que ambas se lean.
    for (let n = 0; n < 2; n++) { const o = placas.find(r => bx < r[0] + r[2] && bx + aw > r[0] && by < r[1] + r[3] && by + ah > r[1]); if (!o) break; by = o[1] + o[3] + 2; }
    placas.push([bx, by, aw, ah]);
    x.fillStyle = 'rgba(10,8,24,.74)'; x.beginPath(); x.moveTo(bx + 5, by); x.arcTo(bx + aw, by, bx + aw, by + ah, 5); x.arcTo(bx + aw, by + ah, bx, by + ah, 5); x.arcTo(bx, by + ah, bx, by, 5); x.arcTo(bx, by, bx + aw, by, 5); x.closePath(); x.fill();
    lineas.forEach(([t, c, f], i) => { x.font = f; x.fillStyle = c; x.fillText(t, bx + aw / 2, by + 2 + AL * (i + 0.5)); });
  };
  const ah = Date.now();
  // Cofres (solo en zonas con el mirador descubierto), como cofrecitos de color.
  if (MV.miradores.length) for (const cf of COFRES3) if (MV.miradores.includes(cf.zona)) {
    const cx = sx(cf.x), cz = sz(cf.z); if (fuera(cx, cz, 10)) continue;
    const a = cf.tipo === 'legendario' ? 7 : 6;
    x.fillStyle = cf.listoEn > ah ? '#6b7280' : cf.tipo === 'legendario' ? '#ffd84a' : cf.tipo === 'epico' ? '#c084fc' : '#d6a35c';
    x.strokeStyle = '#000'; x.lineWidth = 1.5; x.fillRect(cx - a, cz - a * 0.75, a * 2, a * 1.5); x.strokeRect(cx - a, cz - a * 0.75, a * 2, a * 1.5);
    x.beginPath(); x.moveTo(cx - a, cz - 0.5); x.lineTo(cx + a, cz - 0.5); x.stroke();
  }
  // Jefes: calavera; con zoom, su nivel debajo.
  for (const cp of campamentos(MAPAS, MONSTRUOS)) if (cp.jefe) {
    const px = sx(cp.x), pz = sz(cp.z); pin(px, pz, '💀', '#ff6b6b');
    const mo = MONSTRUOS[cp.k];
    if (e >= 0.9 && mo && mo.nivel && !fuera(px, pz, 30)) texto('Nv ' + mo.nivel, px, pz + rI + 8, '#fecaca');
  }
  for (const hi of MV.hitos) pin(sx(hi.x), sz(hi.z), '🔭', '#fde047');
  // Arena del jefe mundial.
  { const ax = sx(ARENA3D.x), az = sz(ARENA3D.z), viva = mundial3 && mundial3.vivo; pin(ax, az, '⚔️', viva ? '#ff6b3d' : '#c4a484'); if (!fuera(ax, az, 80)) texto(ARENA3D.nombre, ax, az - rI - 8, viva ? '#ff9a7a' : '#f1e3d3'); }
  // Pueblo y portal: de lejos el portal se separa del pueblo lo justo para que se distingan.
  { const ux = sx(0), uz = sz(0);
    if (portal) { const dd = Math.hypot(portal.x, portal.z) * e, k = dd < 28 ? 28 / dd : 1; pin(ux + (portal.x * e) * k, uz + (portal.z * e) * k, '🌀', '#c084fc'); }
    if (e >= 2) { x.fillStyle = '#e5e7eb'; for (const n of NPCS3D) { const nx = sx(n.x), nz = sz(n.z); if (fuera(nx, nz, 60)) continue; x.fillRect(nx - 3, nz - 3, 6, 6); texto(n.nombre, nx, nz - 11, '#e5e7eb'); } }
    pin(ux, uz, '🏘️', '#86efac', rI + 2);
    placa([['Pueblo Duende', '#fff', F1], ['Zona segura', '#86efac', F2]], ux, uz + rI + 5); }
  // Nombre de cada zona, nivel recomendado y exploracion.
  for (const z of MV.zonas) {
    const l = [[z.nombre, '#fff', F1], ['Nv ' + z.nv[0] + '-' + z.nv[1] + (z.total && !chico ? ` · 🧭 ${z.hechos}/${z.total}` : ''), z.total && z.hechos >= z.total ? '#86efac' : '#ffd84a', F2]];
    if (z.total && !z.mira && e >= 0.7) l.push(['🔭 encuentra su hito', '#93c5fd', F2]);
    placa(l, sx(z.x), sz(z.z) - 18);
  }
  // Grupo.
  if (grupo3 && grupo3.m) for (const g of grupo3.m) {
    if (!g.on || g.id === miId) continue;
    const o = otros.get(g.id), wx = o ? o.x : Array.isArray(g.p3) ? g.p3[0] : null, wz = o ? o.z : Array.isArray(g.p3) ? g.p3[1] : null;
    if (wx == null || enAbismo(wx) || enCueva(wx)) continue;
    const gx = sx(wx), gz = sz(wz); if (fuera(gx, gz, 60)) continue;
    x.fillStyle = '#7dd3fc'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(gx, gz, 7, 0, 7); x.fill(); x.stroke();
    const nom = String(g.n || '').slice(0, 16); if (nom) texto(nom, gx, gz - 14, '#7dd3fc');
  }
  // Encima de las placas de zona: si no, el narrador junto al hito queda tapado.
  {
    const ux = sx(0), uz = sz(0);
    // Vecinos: los de zona siempre con su sitio; lo que tienen para ti en dorado. De lejos, los de la plaza van en un signo junto al pueblo.
    const mk = marcasNpc(), oro = '#ffd84a'; let sP = '';
    for (const n of TODOS_NPC) {
      const k = mk.get(n.nombre), enPueblo = zonaEn(n.x, n.z) === 'pueblo';
      if (enPueblo && e < 2) { if (k && sP !== '?') sP = k; continue; }
      const nx = sx(n.x), nz = sz(n.z);
      if (fuera(nx, nz, 60)) continue;
      if (k) { pin(nx, nz, k, oro, Math.max(11, rI * 0.85), oro); if (e >= 0.8) texto(n.nombre, nx, nz - Math.max(11, rI * 0.85) - 8, '#fde68a'); }
      else if (enPueblo) { if (VEC_TIPO.has(n.tipo)) { x.fillStyle = '#e5e7eb'; x.fillRect(nx - 3, nz - 3, 6, 6); texto(n.nombre, nx, nz - 11, '#e5e7eb'); } }
      else if (e >= 0.9) { x.fillStyle = '#e5e7eb'; x.fillRect(nx - 3, nz - 3, 6, 6); if (e >= 1.4) texto(n.nombre, nx, nz - 11, '#e5e7eb'); }
    }
    if (sP) pin(ux + rI * 1.5, uz - rI * 1.2, sP, oro, Math.max(10, rI * 0.75), oro);
  }
  // Mision o guia.
  if (metaMision) pin(sx(metaMision.x), sz(metaMision.z), metaMision.guia ? '?' : '!', metaMision.guia ? '#4ade80' : '#ffd84a', rI + 2, metaMision.guia ? '#4ade80' : '#ffd84a');
  const enM = mapaEnMundo(), yx = sx(P.x), yz = sz(P.z);
  // Destino personal: linea punteada desde ti y su 📍 con la punta justo en el punto tocado.
  if (destino3) {
    const dx = sx(destino3.x), dz = sz(destino3.z);
    if (enM) { x.save(); x.strokeStyle = '#ff5c7a'; x.lineWidth = 2.5; x.setLineDash([7, 7]); x.beginPath(); x.moveTo(yx, yz); x.lineTo(dx, dz); x.stroke(); x.restore(); }
    x.font = '30px system-ui'; x.fillStyle = '#ff2d55'; x.fillText('📍', dx, dz - 14);
  }
  // Tu flecha: hacia donde mira el duende (misma cuenta que el minimapa).
  if (enM) {
    x.fillStyle = 'rgba(74,222,128,.28)'; x.beginPath(); x.arc(yx, yz, 20, 0, 7); x.fill();
    x.save(); x.translate(yx, yz); x.rotate(Math.PI - P.ry);
    x.fillStyle = '#4ade80'; x.strokeStyle = '#fff'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(0, -13); x.lineTo(9, 10); x.lineTo(0, 5); x.lineTo(-9, 10); x.closePath(); x.stroke(); x.fill(); x.restore();
  }
  mapaChip();
}
function abrirMapa() {
  if (!mapaBase) return;
  // Antes de la niebla: miradores ya revelados y donde estas parado cuentan como vistos.
  for (const zid of ZONAS_ENC) { let vm = false; try { vm = localStorage.getItem('dq_mirador_' + zid) === '1'; } catch (e) {} if (vm || (encargos || {})[zid + ':hito'] === true) revelarNieblaZona(zid); }
  try { if (mapaEnMundo()) marcarNiebla(P.x, P.z); } catch (e) {}
  if (!MV.niebla) { MV.niebla = document.createElement('canvas'); MV.niebla.width = MV.niebla.height = 440; }
  { const n = MV.niebla.getContext('2d'); n.clearRect(0, 0, 440, 440); pintarNiebla(n, 440); }
  // Exploracion: encargos hechos por zona y, con el mirador (hito) descubierto, sus cofres y su hito.
  const encH = encargos || {};
  let expHechos = 0;
  MV.zonas = []; MV.miradores = []; MV.hitos = [];
  for (const [id, c] of Object.entries(ZONAS3D)) {
    const mp = MAPAS[id]; if (!mp) continue;
    const enc = ZONAS_ENC.includes(id) ? encargosDe(id, MAPAS, MONSTRUOS) : [];
    let mira = false;
    if (enc.length) { try { mira = localStorage.getItem('dq_mirador_' + id) === '1'; } catch (e) {} mira = mira || encH[id + ':hito'] === true; }
    const hechos = enc.filter(q => encH[q.id] === true).length; expHechos += hechos;
    MV.zonas.push({ x: c.x, z: c.z, nombre: mp.nombre, nv: mp.nv, total: enc.length, hechos, mira });
    if (mira) { MV.miradores.push(id); const hi = hitoDe(id, ZONAS3D, alturaEn); if (hi) MV.hitos.push(hi); }
  }
  { const tot = ZONAS_ENC.length * 5, vistas = niebla.reduce((a, b) => a + b, 0); MV.pc = Math.round((expHechos / tot * 100 + vistas / niebla.length * 100) / 2);
    const pc = $('mapa-pc'); pc.textContent = `Explorado: ${MV.pc} %`; pc.style.color = MV.pc >= 100 ? '#4ade80' : '#ffd84a'; }
  abrir('v-mapa');
  const cv = $('mapa-c');
  MV.w = cv.clientWidth; MV.h = cv.clientHeight;
  // Al abrir: el alto completo del mundo en pantalla (o mas cerca si ya lo acercaste) y centrado en ti.
  if (!MV.esc) MV.esc = Math.max(MV.w, MV.h) / LADO;
  $('mapa-ley').open = false;
  MV.ptrs.clear(); MV.toque = null;   // un dedo que quedo apoyado al cerrar no debe contar como pellizco
  mapaCentrar();
  pintarMapaHD();
  clearInterval(MV.tic);
  MV.tic = setInterval(() => { if ($('v-mapa').classList.contains('on')) mapaPedir(); else clearInterval(MV.tic); }, 500);
}
{ // Gestos del mapa grande: un dedo o raton arrastra, dos dedos o la rueda hacen zoom; un toque sin mover pone el destino.
  const cv = $('mapa-c');
  const pos = ev => { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  cv.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    const p = pos(ev);
    MV.ptrs.set(ev.pointerId, p);
    MV.toque = MV.ptrs.size === 1 ? { x: p.x, y: p.y, t: performance.now(), mov: false } : null;
  });
  cv.addEventListener('pointermove', ev => {
    const ant = MV.ptrs.get(ev.pointerId);
    if (!ant) return;
    const p = pos(ev);
    if (MV.ptrs.size >= 2) {
      const otro = [...MV.ptrs.entries()].find(([id]) => id !== ev.pointerId)[1];
      const dAnt = Math.hypot(ant.x - otro.x, ant.y - otro.y) || 1, dNue = Math.hypot(p.x - otro.x, p.y - otro.y) || 1;
      MV.cx -= (p.x - ant.x) / 2 / MV.esc; MV.cz -= (p.y - ant.y) / 2 / MV.esc;
      mapaZoom((p.x + otro.x) / 2, (p.y + otro.y) / 2, dNue / dAnt);
    } else {
      if (MV.toque && !MV.toque.mov && Math.hypot(p.x - MV.toque.x, p.y - MV.toque.y) > 8) MV.toque.mov = true;
      if (!MV.toque || MV.toque.mov) { MV.cx -= (p.x - ant.x) / MV.esc; MV.cz -= (p.y - ant.y) / MV.esc; mapaLimitar(); mapaPedir(); }
    }
    MV.ptrs.set(ev.pointerId, p);
  });
  const fin = ev => {
    if (!MV.ptrs.delete(ev.pointerId)) return;
    const q = MV.toque; MV.toque = null;
    if (ev.type === 'pointerup' && q && !q.mov && !MV.ptrs.size && performance.now() - q.t < 700) mapaTocar(q.x, q.y);
  };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('lostpointercapture', ev => { MV.ptrs.delete(ev.pointerId); });
  cv.addEventListener('wheel', ev => { ev.preventDefault(); const p = pos(ev); mapaZoom(p.x, p.y, Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 40 : 1) * 0.0015)); }, { passive: false });
  cv.addEventListener('contextmenu', ev => ev.preventDefault());
  $('mapa-mas').onclick = () => mapaZoom(MV.w / 2, MV.h / 2, 1.5);
  $('mapa-menos').onclick = () => mapaZoom(MV.w / 2, MV.h / 2, 1 / 1.5);
  $('mapa-yo').onclick = () => mapaCentrar();
  $('mapa-dest-q').onclick = () => ponerDestino(null);
  addEventListener('resize', () => { if ($('v-mapa').classList.contains('on')) mapaPedir(); });
}

// ── ENTRADA ──
function chatAbierto() { return document.activeElement === $('chat-in'); }
// Ventanas laterales (como WoW): no tapan el centro y se puede seguir
// caminando con ellas abiertas. Las demas (mapa, muerte, inicio...) si bloquean.
const LATERALES = ['v-npc', 'v-ayuda', 'v-inv', 'v-libro', 'v-tienda', 'v-logros', 'v-pase', 'v-diario', 'v-herm', 'v-rank', 'v-amigos', 'v-obj'];
addEventListener('keydown', e => {
  const t = e.target;
  if (!t || !t.closest || !t.closest('.modal') || t.matches('input,textarea')) return;
  if (t.matches('select')) { if (e.key !== 'Escape') e.preventDefault(); t.blur(); }
  else if (t.matches('button,a') && e.code !== 'Tab' && e.code !== 'Enter') t.blur();
}, true);
// ── INVITADO: que no pierda su duende ──
// Una vez por sesion: el duende del invitado vive en este navegador; se puede
// guardar con una cuenta (en CLASSIC) o con el codigo de rescate.
// ── VERSION NUEVA: Telegram deja la pagina abierta horas; si el servidor ya va
// por una version mayor (llega en 'bienvenido') se recarga en el pueblo, fuera de combate.
const MI_VER = +(/[?&]v=(\d+)/.exec(import.meta.url) || [0, 0])[1];
// Los errores de JavaScript de los jugadores llegan al servidor (antes nadie se enteraba de un fallo en un movil).
let errEnv = 0;
// Antes de entrar (sin socket) se encolan en __errQ (index.html) y se mandan en 'bienvenido'.
const avisarError = (msg, f, l) => { if (!yo || !ws || ws.readyState !== 1) { const q = window.__errQ; if (q && q.length < 10) q.push({ m: String(msg || ''), f: String(f || ''), l: l | 0 }); return; } if (++errEnv > 5) return; try { mandar({ t: 'errc', m: String(msg || '').slice(0, 200), f: String(f || '').split('/').pop().slice(0, 80), l: l | 0, v: MI_VER, tg: TG ? 1 : 0 }); } catch (e) {} };
addEventListener('error', e => avisarError(e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => avisarError('promesa: ' + ((e.reason && (e.reason.message || e.reason)) || ''), '', 0));
window.__errPropio = true;   // desde aqui los errores los recoge este modulo (index.html deja de encolarlos)
function vaciarErrores() { const q = window.__errQ; if (!q) return; while (q.length) { const e = q.shift(); avisarError(e.m, e.f, e.l); } }
// Ya no se descarga la pagina cada 2 min (51 KB por jugador): al publicar, el servidor
// se reinicia, el socket reconecta solo y 'bienvenido' trae su VERSION (data.js).
let verNueva = 0, verNuevaT = 0;
function revisarVersion(vServ) {
  if (!(vServ > VERSION) || verNueva) return;
  // Si la recarga anterior no trajo la version nueva (cache del WebView), no se recarga en bucle.
  let ya = 0; try { ya = +sessionStorage.getItem('dq_recargaVer') || 0; } catch (e) {}
  if (Date.now() - ya < 10 * 60000) return;
  verNueva = vServ; verNuevaT = Date.now();
  aviso('✨ Hay una versión nueva del juego: se actualiza al volver al pueblo.', 'ok');
}
setInterval(() => {
  // Solo en el pueblo (o tras 15 min esperando), fuera de combate, sin pago abierto,
  // sin un panel abierto (tienda, NPC, leyenda…) y sin estar escribiendo en el chat.
  if (!verNueva || document.hidden || P.muerto || autoAtk || lanzando || P.vuela) return;
  if (zonaEn(P.x, P.z) !== 'pueblo' && Date.now() - verNuevaT < 15 * 60000) return;
  if (Date.now() - (window.dqPagoT || 0) < 10 * 60000 || document.querySelector('.modal.on') || chatAbierto() || ($('chat-in').value || '').trim() || performance.now() - (P.heridoT || 0) < 8000) return;
  try { sessionStorage.setItem('dq_recargaVer', String(Date.now())); sessionStorage.setItem('dq_recargaNov', '1'); } catch (e) {}
  location.reload();
}, 5000);
// ── LA LEYENDA DEL CANTARO (lore): una vez al entrar y desde la ayuda ──
function verLeyenda() {
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;   // el cierre automatico del premio diario no cierra la leyenda
  $('diario-c').innerHTML = `<img src="${imgLore()}" alt="Chicha morada junto al mar" style="display:block;width:100%;max-height:170px;object-fit:${modoAnuncio() ? 'contain' : 'cover'};border-radius:10px;margin-bottom:8px">
    <p class="vv-p"><img src="/assets/lore/maiz-morado.png" alt="" style="float:left;width:34px;margin:0 6px 0 0">Hace siglos, los duendes guardaban el <b style="color:#c084fc">Maíz Morado Sagrado</b>. Con él preparaban la <b style="color:#c084fc">chicha morada</b>, la bebida que les daba su fuerza y su magia.</p>
    <p class="vv-p">El <b>Rey Goblin</b> robó el <b style="color:#ffd84a">Cántaro Eterno</b> y lo rompió en pedazos. Sin chicha, la noche cubrió el bosque, los goblins invadieron las colinas y el Éter del cielo se partió en islas flotantes: el <b>Abismo</b>.</p>
    <p class="vv-p"><img src="${modoAnuncio() ? '/assets/skins/skin_bruja.png' : '/assets/lore/duende-chicha.webp'}" alt="" style="float:right;height:96px;margin:0 0 4px 6px">Tú eres un duende joven. <b>Recupera las zonas</b> (misiones y encargos 🧭), <b>vence a sus jefes</b>, abre los cofres y junta <b>puntos de chicha</b> cazando. En el Abismo, la Luz y la Sombra luchan por el <b>Núcleo</b>, donde late el último pedazo del Cántaro.</p>
    <p class="vv-p" style="color:#fde68a;font-weight:700">🥤 Y es de verdad: quien llegue a nivel ${CHICHA.nv60} en este mundo, con ${CHICHA.dias60} días y ${Math.round(CHICHA.min60 / 60)} h jugadas, se lleva ${CHICHA.litros60} litros de chicha morada a su casa. Además, con ${CHICHA.niveles[0].toLocaleString('es')} puntos de chicha cazando (desde nivel ${CHICHA.nvPuntos}), otro litro: mira ${K('la barra morada 🥤', '⋯ → Chicha 🥤')}. Todo va con una cuenta gratis: como invitado las cazas no suman puntos · envíos solo en Perú.</p>
<button type="button" class="btn" id="b-receta" style="width:100%;margin-top:8px">🥤 La Receta del Cántaro: ${ingredientesDe(secundarias).length}/${INGREDIENTES.length}</button>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#fde68a;font-weight:700">📜 Los capítulos de la historia: ${yo && yo.mis ? Math.min(capituloDe(yo.mis.i).n, CAPITULOS.length) : 1}/${CAPITULOS.length}</summary><p class="vv-p" style="font-size:12px;margin:6px 0">La cadena de misiones del Guardia Tito, contada por capítulos.</p>${CAPITULOS.map(c => { const mi = yo && yo.mis ? yo.mis.i : 0, cur = capituloDe(mi).n, sig = CAPITULOS.find(x => x.n === c.n + 1), fin = mi >= LORE_MISIONES.length; const est = fin || c.n < cur ? 'ok' : c.n === cur ? 'ya' : 'no'; return `<p class="vv-p" style="margin:4px 0;${est === 'no' ? 'opacity:.55' : ''}"><b style="color:${est === 'ok' ? '#4ade80' : est === 'ya' ? '#fde68a' : '#cbd5e1'}">${est === 'ok' ? '✓' : est === 'ya' ? '▶' : '·'} Capítulo ${c.n}:</b> ${esc(c.titulo)} <small>(misiones ${c.desde + 1}-${sig ? sig.desde : LORE_MISIONES.length})</small></p>`; }).join('')}</details>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#c084fc;font-weight:700">🏺 Las reliquias del Cántaro: ${Object.keys(LORE_ZONAS).filter(z => encargos[z + ':jefe'] === true).length}/10 recuperadas</summary><p class="vv-p" style="font-size:12px;margin:6px 0">Cada reliquia (un pedazo, su semilla, su barro o un secreto) se recupera venciendo al jefe de su zona en los encargos 🧭. Con las 10, el último pedazo espera en el Núcleo del Abismo: el nivel ${CHICHA.nv60}.</p>${Object.entries(LORE_ZONAS).map(([id, z]) => { const ok = encargos[id + ':jefe'] === true; return `<p class="vv-p" style="margin:6px 0;${ok ? '' : 'opacity:.6'}"><b style="color:${ok ? '#4ade80' : '#fde68a'}">${ok ? '✓' : '·'} ${esc((MAPAS[id] || {}).nombre || id)}:</b> ${ok ? esc(z.pedazo) + ` <button type="button" class="btn sec" data-releer-z="${esc(id)}" style="padding:4px 10px;font-size:12px;margin-top:4px">▶ Releer</button>` : 'reliquia perdida… vence al jefe de la zona.'}</p>`; }).join('')}</details>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#f0abfc;font-weight:700">📖 Historias de la gente del bosque: ${SECUNDARIAS.filter(q => secundarias[q.id + ':ok']).length}/${SECUNDARIAS.length}</summary><p class="vv-p" style="font-size:12px;margin:6px 0">Misiones secundarias: salen solas en el panel al llegar a cada zona (con su nivel) y avanzan con lo que haces.</p>${htmlHistorias()}</details>`;
  $('v-diario').querySelector('h2').textContent = 'LA LEYENDA DEL CÁNTARO';
  $('b-receta').onclick = verReceta;
  { const d1 = $('diario-c').querySelector('details'); if (d1) { d1.insertAdjacentHTML('beforebegin', '<button type="button" class="btn sec" id="b-caso" style="width:100%;min-height:40px;margin-top:8px">🕵 El Caso del Traidor: ' + caso.p.length + '/' + PISTAS.length + (caso.res ? ' ✓' : '') + '</button>'); $('b-caso').onclick = e => { e.preventDefault(); verCaso(); }; } }
  $('diario-c').querySelectorAll('[data-releer-z]').forEach(b => { b.onclick = e => { e.preventDefault(); const id = b.dataset.releerZ, z = LORE_ZONAS[id]; if (!z) return; cerrar('v-diario'); npcDice('Guardia Tito', [z.intro, LORE_HITOS[id], z.pedazo].filter(Boolean), '🛡', true); }; });
  $('diario-c').querySelectorAll('[data-releer]').forEach(b => { b.onclick = e => { e.preventDefault(); const q = SECUNDARIAS.find(x => x.id === b.dataset.releer); if (!q) return; cerrar('v-diario'); npcDice(q.quien, [q.inicio, q.fin], q.emoji, true, q.sigue); }; });
  abrir('v-diario');
}
// El Caso del Traidor: se pinta en la misma ventana que la Leyenda, con su boton de volver.
function verCaso() {
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  $('diario-c').innerHTML = htmlCaso(caso, { sec: secundarias, nivel: yo && yo.nivel, esc, zonaNombre: z => (MAPAS[z] || {}).nombre || z });
  $('v-diario').querySelector('h2').textContent = 'EL CASO DEL TRAIDOR';
  $('diario-c').querySelectorAll('[data-caso-s]').forEach(b => { b.onclick = e => { e.preventDefault(); sfx('boton', 0.3); mandar({ t: 'casoSospecha', id: b.dataset.casoS }); }; });
  const bv = $('diario-c').querySelector('[data-caso-volver]');
  if (bv) bv.onclick = e => { e.preventDefault(); verLeyenda(); };
  abrir('v-diario');
}
// Historias del diario, plegadas por zona (ya son 50): lo hecho se relee, se ve la de turno y lo que falta no se destapa.
function htmlHistorias() {
  const nv = (yo && yo.nivel) || 1, aqui = P ? zonaEn(P.x, P.z) : '';
  const zonas = ZONAS_ENC.filter(z => SECUNDARIAS.some(q => q.zona === z));
  const abierta = zonas.includes(aqui) ? aqui : zonas.find(z => secundariaDe(z, secundarias, nv));
  return zonas.map(z => {
    const L = SECUNDARIAS.filter(q => q.zona === z), hechas = L.filter(q => secundarias[q.id + ':ok']).length;
    const turno = secundariaDe(z, secundarias, nv), pend = L.filter(q => !secundarias[q.id + ':ok']);
    let filas = L.filter(q => secundarias[q.id + ':ok']).map(q => `<p class="vv-p" style="margin:6px 0"><b style="color:#4ade80">✓ ${esc(q.nombre)}</b> <small>(Nv ${q.nv})</small><br>${esc(q.fin)} <button type="button" class="btn sec" data-releer="${esc(q.id)}" style="padding:8px 12px;font-size:12px;margin-top:4px">▶ Releer</button></p>`).join('');
    if (turno) { const vt = vistaSec(turno); filas += `<p class="vv-p" style="margin:6px 0"><b style="color:#f0abfc">▶ ${esc(turno.nombre)}</b> <small>(Nv ${turno.nv})</small><br>${esc(vt.pide)}${vt.pend ? '' : `: ${Math.min(secundarias[turno.id] || 0, turno.n)}/${turno.n}`} · ${esc(vt.quien)} te espera.</p>`; }
    else if (pend.length) filas += `<p class="vv-p" style="margin:6px 0;opacity:.7"><small>${pend[0].nv > nv ? `${esc(pend[0].quien)} tendrá algo que contarte en Nv ${pend[0].nv}.` : `${esc(pend[0].quien)} te espera con ${pend[0].minPistas} pistas (${contarPistas(secundarias)}/${pend[0].minPistas}).`}</small></p>`;
    const resto = pend.length - 1;
    if (resto > 0) filas += `<p class="vv-p" style="margin:6px 0;opacity:.6"><small>· ${resto === 1 ? 'Una historia más' : resto + ' historias más'} por descubrir.</small></p>`;
    return `<details${z === abierta ? ' open' : ''} style="margin:6px 0"><summary style="cursor:pointer;font-weight:700;color:${hechas === L.length ? '#4ade80' : '#e9d5ff'}">${hechas === L.length ? '✓ ' : ''}${esc((MAPAS[z] || {}).nombre || z)}: ${hechas}/${L.length}</summary>${filas}</details>`;
  }).join('');
}
$('b-leyenda').onclick = () => { cerrar('v-ayuda'); verLeyenda(); };
// ── COMUNIDAD OFICIAL (mismas URLs que functions/api/telegram-bot.js) ──
// Lista blanca fija. Solo se abre el enlace si el jugador toca: el juego no envía nada por Telegram.
const COMUNIDAD = { canal: 'https://t.me/elduende420peru', grupo: 'https://t.me/duendesolana420' };
function abrirComunidad(k) {
  const url = COMUNIDAD[k === 'grupo' ? 'grupo' : 'canal'];
  try { const tw = window.Telegram && window.Telegram.WebApp; if (tw && tw.initData && typeof tw.openTelegramLink === 'function') { tw.openTelegramLink(url); return; } } catch (e) {}
  try { window.open(url, '_blank', 'noopener'); } catch (e) {}
}
{ const ft = $('fila-token'); let enTg = false; try { enTg = !!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData); } catch (e) {} if (ft && !modoAnuncio() && !enTg) ft.style.display = ''; }
{ const bc = $('com-canal'), bg = $('com-grupo'); if (bc) bc.onclick = () => abrirComunidad('canal'); if (bg) bg.onclick = () => abrirComunidad('grupo'); if (modoAnuncio()) { const f = bc && (bc.closest('.fila') || bc.parentElement); if (f) f.style.display = 'none'; } }
/* 🔔 Avisos por Telegram a pedido (web y navegador de FB/IG): el servidor contesta con pedido=true; solo se avisa si el jugador pulsa INICIAR en el bot */
try {
  const ba = $('b-avtg'), fa = $('fila-avtg');
  if (TG && fa) fa.style.display = 'none';
  if (ba) ba.onclick = () => { mandar({ t: 'avisoTgCod' }); ba.textContent = 'Preparando el enlace…'; clearTimeout(ba._t); ba._t = setTimeout(() => { try { ba.textContent = 'Avísame'; if (!document.querySelector('#dq-avtg.on') && !hayVentana() && !enCombate3()) aviso('No se pudo preparar el enlace ahora. Inténtalo en un momento.', 'err', 1); } catch (e) {} }, 8000); };
} catch (e) {}
// Aviso único (Nv 5): tira pequeña arriba con «Unirme» / «Ahora no». Si hay una ventana abierta, espera un poco.
// Modo anuncio: nunca. Navegador de Facebook/Instagram/TikTok: tampoco (sin marcarlo visto, por si luego entra por Telegram).
function avisoComunidad(n) {
  if (modoAnuncio()) return;
  const enTg = !!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData);
  if (!enTg && /FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|BytedanceWebview/i.test(navigator.userAgent || '')) return;
  let ya = false; try { ya = !!localStorage.getItem('dq3_comunidad'); } catch (e) { ya = true; }
  if (ya || $('tira-comunidad')) return;
  let tapado = false; try { tapado = hayVentana() || avisoTapado(); } catch (e) {}
  if (tapado) { if ((n || 0) < 20) setTimeout(() => avisoComunidad((n || 0) + 1), 6000); return; }
  try { localStorage.setItem('dq3_comunidad', '1'); } catch (e) {}
  const t = document.createElement('div'); t.id = 'tira-comunidad'; t.setAttribute('role', 'dialog');
  t.style.cssText = 'position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top) + var(--tg-top,0px));transform:translateX(-50%);z-index:8;display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:8px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:8px 12px;border-radius:14px;border:1px solid rgba(34,211,238,.55);background:rgba(20,14,34,.92);box-shadow:0 6px 20px rgba(0,0,0,.45);color:#fff;font:600 12px/1.3 var(--sans);pointer-events:auto;';
  t.innerHTML = '<span>📢 Únete al canal oficial para enterarte de eventos</span><button type="button" class="btn" data-com="si" style="padding:6px 12px;font-size:12px;min-height:34px">Unirme</button><button type="button" class="btn sec" data-com="no" style="padding:6px 12px;font-size:12px;min-height:34px">Ahora no</button>';
  const quitar = () => { clearTimeout(t._t); t.remove(); };
  t.onclick = ev => { ev.stopPropagation(); const b = ev.target && ev.target.closest && ev.target.closest('[data-com]'); if (!b) return; if (b.dataset.com === 'si') abrirComunidad('canal'); quitar(); };
  t.addEventListener('pointerdown', ev => ev.stopPropagation());
  t.addEventListener('touchstart', ev => ev.stopPropagation(), { passive: true });
  document.body.appendChild(t);
  t._t = setTimeout(quitar, 25000);
}
// ── LLEVAR MI DUENDE (functions/mmo/vincular.js) ──
// Invitado: pide un codigo de 6 letras (10 min) y lo escribe en Telegram o en su
// cuenta de correo (en cualquier navegador). Cuenta: escribe el codigo y vuelve a
// entrar con hola.vcod; el servidor hereda al invitado (sin tocar el token secreto).
function vcodPend() { try { const c = sessionStorage.getItem('dq_vcod') || ''; return /^[A-Z0-9]{6}$/.test(c) ? c : undefined; } catch (e) { return undefined; } }
function abrirLlevar() {
  cerrar('v-ayuda');
  if (!yo) return;
  $('v-diario').querySelector('h2').textContent = 'LLEVAR MI DUENDE';
  if (soyInvitado) {
    $('diario-c').innerHTML = '<p class="vv-p">Pide un código y escríbelo en Duende Quest dentro de <b>Telegram</b> o en tu <b>cuenta de correo</b> (en cualquier navegador o celular): ❓ Ayuda → «📲 Llevar mi duende» (en CLASSIC: 👤 → «Vincular»). Tu duende pasa entero a esa cuenta.</p><p class="vv-p" id="llevar-cod" style="text-align:center;font:700 28px monospace;letter-spacing:5px;color:#ffd84a;margin:8px 0">…</p><p class="vv-p" style="font-size:12px;color:var(--txt3)">La cuenta debe ser nueva o casi (hasta Nv 5, sin compras). Usa el código antes de 10 minutos y no se lo pases a nadie.</p>';
    mandar({ t: 'vincCodigo' });
  } else {
    $('diario-c').innerHTML = '<p class="vv-p">¿Jugaste como invitado en otro navegador o celular? Allí toca ❓ Ayuda → «📲 Llevar mi duende» (en CLASSIC: 👤 → «Pasar mi duende») y escribe aquí el código de 6 letras y números.</p><div style="display:flex;gap:6px"><input id="llevar-in" maxlength="8" autocomplete="off" placeholder="Código" style="flex:1;min-width:0;text-transform:uppercase;font:700 18px monospace;letter-spacing:3px;padding:10px;border-radius:10px;border:1px solid var(--borde);background:rgba(0,0,0,.35);color:var(--txt)"><button class="btn" id="llevar-ok">Traer</button></div><p class="vv-p" style="font-size:12px;color:var(--txt3);margin-top:8px">Solo en una cuenta nueva o casi (hasta Nv 5, sin compras): su duende actual se archiva y juegas con el que traes.</p>';
    const inp = $('llevar-in');
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('llevar-ok').click(); });
    $('llevar-ok').onclick = () => { const cod = inp.value.trim(); if (cod) mandar({ t: 'vincUsar', cod }); };
  }
  abrir('v-diario');
}
function pintarLlevar(m) {
  const p = $('llevar-cod');
  if (p) p.textContent = m.cod;
  else aviso('📲 Tu código para llevar tu duende: ' + m.cod + ' (10 min)', 'ok', 1);
}
{
  const b = document.createElement('button');
  b.className = 'btn sec'; b.style.width = '100%'; b.textContent = '📲 Llevar mi duende (Telegram u otro celular)';
  b.onclick = abrirLlevar;
  const pb = document.createElement('p'); pb.style.marginTop = '10px'; pb.appendChild(b);
  $('b-leyenda').parentNode.after(pb);
  // Invitado: crear cuenta gratis desde Ajustes (no solo en el aviso diario).
  const bc = document.createElement('button');
  bc.id = 'ay-cuenta'; bc.className = 'btn sec'; bc.style.cssText = 'width:100%;margin-bottom:8px'; bc.textContent = '📧 Crear cuenta gratis (guarda tu duende)';
  bc.style.display = soyInvitado ? '' : 'none';
  bc.onclick = () => { cerrar('v-ayuda'); irACrearCuenta(); };
  pb.insertBefore(bc, b);
  // Invitado 'DuendeNNNN': ponerle nombre a su duende (gratis, una vez). Campo en la misma ventana (prompt() falla en algunos WebView).
  const caja = document.createElement('div');
  caja.id = 'ay-nombre'; caja.style.cssText = 'display:none;margin-bottom:8px';
  const bn = document.createElement('button');
  bn.className = 'btn sec'; bn.style.width = '100%'; bn.textContent = '✏️ Ponle nombre a tu duende (gratis, 1 vez)';
  const fila = document.createElement('div'); fila.style.cssText = 'display:none;gap:6px;margin-top:6px';
  const inN = document.createElement('input');
  inN.type = 'text'; inN.maxLength = 16; inN.placeholder = 'Nombre de tu duende (3-16 letras)'; inN.autocomplete = 'off';
  inN.style.cssText = 'flex:1;min-width:0;padding:10px;border-radius:8px;border:1px solid #556;background:#111;color:#fff;font-size:16px';
  const bok = document.createElement('button'); bok.className = 'btn'; bok.textContent = 'Listo';
  fila.append(inN, bok); caja.append(bn, fila);
  pb.insertBefore(caja, b);
  bn.onclick = () => { fila.style.display = 'flex'; setTimeout(() => { try { inN.focus(); } catch (e) {} }, 50); };
  const enviarNombre = () => {
    const n = inN.value.replace(/\s+/g, ' ').trim().slice(0, 16);
    if (n.length < 3 || !/^[A-Za-z0-9À-ÖØ-öø-ÿ _]+$/.test(n)) { aviso('Usa de 3 a 16 letras o números (sin símbolos).', 'err'); return; }
    if (/^duende/i.test(n)) { aviso('Elige un nombre que no empiece por «Duende».', 'err'); return; }
    mandar({ t: 'miNombre', n });
    try { localStorage.setItem('dq_mmo_nombre', n); } catch (e) {}
    fila.style.display = 'none'; inN.value = '';
    cerrar('v-ayuda');   // el aviso del servidor («¡Listo!» o «no está disponible») se ve al momento
  };
  bok.onclick = enviarNombre;
  inN.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') enviarNombre(); });
  inN.addEventListener('keyup', e => e.stopPropagation());
  $('b-ayuda').addEventListener('click', () => { caja.style.display = yo && /^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '') ? '' : 'none'; fila.style.display = 'none'; });
}
// Bautizo: tras la mision 1, el invitado 'DuendeNNNN' elige nombre con un toque (chips sugeridos o el suyo).
// Una vez por equipo (dq_bautizo_visto). Espera a que no haya ventana ni pelea (cada 5 s, unos 3 min).
// Si el servidor rechaza el nombre (ocupado o no permitido), la tarjeta sigue abierta con otros chips.
function tarjetaBautizo(n) {
  n = n || 0;
  if (!yo || !/^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '') || $('tarjeta-bautizo')) return;
  try { if (localStorage.getItem('dq_bautizo_visto') === '1') return; } catch (e) {}
  // «Luego» la aplaza hasta otro dia (20 h); la segunda vez si queda descartada.
  let L = {}; try { L = JSON.parse(localStorage.getItem('dq_bautizo_luego') || '{}') || {}; } catch (e) {}
  if (L.t && Date.now() - L.t < 20 * 3600000) return;
  const ocupado = hayVentana() || enCombate3() || yo.muerto || $('probar-clase') || $('v-diario').classList.contains('on') || !!document.querySelector('#tira-diario.on') || ($('npc-dice') && $('npc-dice').classList.contains('on')) || (Date.now() - ventanaAutoT < 45000) || !!$('dq-noche') || !!document.querySelector('#dq-avtg.on,#dq-regalo.on');
  if (ocupado) { if (n < 40) setTimeout(() => tarjetaBautizo(n + 1), 5000); return; }
  const marcar = () => { try { localStorage.setItem('dq_bautizo_visto', '1'); } catch (e) {} };
  const PRE = ['Pacha', 'Inti', 'Wayra', 'Kusi', 'Killa', 'Sumaq', 'Tika', 'Yaku', 'Rumi', 'Illa'];
  const SUF = ['ruk', 'wa', 'cha', 'to', 'mayo', 'sito', 'ri', 'lla'];
  const azar = a => a[Math.floor(Math.random() * a.length)];
  const sugerir = () => {
    const s = new Set();
    for (let i = 0; s.size < 4 && i < 60; i++) {
      let x = azar(PRE) + azar(SUF);
      if (Math.random() < 0.4 && x.length <= 10) x += 10 + Math.floor(Math.random() * 90);   // menos choques con nombres ya tomados
      if (x.length >= 4 && x.length <= 12 && !/^duende/i.test(x)) s.add(x);
    }
    return [...s];
  };
  const d = document.createElement('div');
  d.id = 'tarjeta-bautizo'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Ponle nombre a tu duende');
  d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px) + var(--tg-top,0px));z-index:9;width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;border-radius:14px;background:rgba(14,9,30,.95);border:1px solid rgba(255,216,74,.6);color:#f3eaff;font:600 14px/1.35 system-ui,sans-serif;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,.55)';
  d.innerHTML = '<div style="font-size:16px;margin-bottom:4px">🎉 ¡Tu duende merece un nombre!</div>'
    + '<div class="tb-txt" style="font-weight:400;font-size:12px;color:#c9bfe8;margin-bottom:8px">Toca uno o escribe el tuyo. Es gratis y solo se elige una vez.</div>'
    + '<div class="tb-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>'
    + '<div style="display:flex;gap:6px;margin-bottom:8px"><input class="tb-in" type="text" maxlength="16" autocomplete="off" placeholder="Otro nombre (3-16)" style="flex:1;min-width:0;padding:9px;border-radius:8px;border:1px solid #556;background:#111;color:#fff;font-size:16px"><button type="button" class="btn tb-usar" style="min-height:40px;padding:7px 12px">Usar</button></div>'
    + '<div style="display:flex;gap:6px"><button type="button" class="btn sec tb-dado" style="flex:1;min-height:40px" aria-label="Otros nombres">🎲 Otros</button><button type="button" class="btn sec tb-luego" style="flex:1;min-height:40px">Luego</button></div>';
  const chips = d.querySelector('.tb-chips'), inN = d.querySelector('.tb-in'), txt = d.querySelector('.tb-txt');
  let esperando = false;
  const pintar = () => {
    chips.innerHTML = '';
    for (const nom of sugerir()) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec';
      b.style.cssText = 'flex:1 1 calc(50% - 6px);min-height:40px;padding:7px 8px;font-size:14px';
      b.textContent = nom; b.onclick = () => enviar(nom);
      chips.appendChild(b);
    }
  };
  let vig = 0;
  const cerrarT = () => { clearInterval(vig); clearTimeout(d._t); d.remove(); };
  const enviar = crudo => {
    if (esperando) return;
    const nom = String(crudo || '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (nom.length < 3 || !/^[A-Za-z0-9À-ÖØ-öø-ÿ _]+$/.test(nom)) { aviso('Usa de 3 a 16 letras o números (sin símbolos).', 'err'); return; }
    if (/^duende/i.test(nom)) { aviso('Elige un nombre que no empiece por «Duende».', 'err'); return; }
    try { sfx('boton', 0.3); } catch (e) {}
    mandar({ t: 'miNombre', n: nom });
    try { localStorage.setItem('dq_mmo_nombre', nom); } catch (e) {}
    esperando = true; d.style.opacity = '.7'; txt.textContent = 'Bautizando a «' + nom + '»…';
    // El servidor responde con un aviso; si el nombre cambio, listo. Si no, se ofrecen otros.
    setTimeout(() => {
      esperando = false; d.style.opacity = '';
      if (!d.isConnected) return;
      if (!yo || !/^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '')) { marcar(); cerrarT(); return; }
      txt.textContent = 'Ese no se pudo. Prueba con otro:'; inN.value = ''; pintar();
    }, 4000);   // red movil lenta: el aviso 'toast' con miNombre la cierra antes si se acepto
  };
  d.querySelector('.tb-usar').onclick = () => enviar(inN.value);
  d.querySelector('.tb-dado').onclick = () => { if (!esperando) { pintar(); try { sfx('boton', 0.2); } catch (e) {} } };
  d.querySelector('.tb-luego').onclick = () => {
    const n2 = (L.n || 0) + 1;
    if (n2 >= 2) marcar(); else { try { localStorage.setItem('dq_bautizo_luego', JSON.stringify({ n: n2, t: Date.now() })); } catch (e) {} }
    cerrarT();
  };
  inN.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') enviar(inN.value); });
  inN.addEventListener('keyup', e => e.stopPropagation());
  pintar();
  document.body.appendChild(d);
  ventanaAutoT = Date.now(); autoN++;   // las demas ventanas automaticas esperan su turno
  // En pelea (o recien golpeado) se esconde para no estorbar; vuelve sola al calmarse.
  vig = setInterval(() => {
    if (!d.isConnected) return clearInterval(vig);
    let pel = false;
    try { pel = enCombate3() || (P && performance.now() - (P.heridoT || 0) < 4000); } catch (e) {}
    if (pel && d.contains(document.activeElement)) pel = false;   // no esconderla mientras escribe
    d.style.display = pel ? 'none' : '';
  }, 1000);
  // Si no la toca en 45 s se cierra sin marcar: se vuelve a ofrecer en la siguiente sesion.
  const caduca = () => { if (!d.isConnected) return; if (esperando || d.contains(document.activeElement)) { d._t = setTimeout(caduca, 10000); return; } cerrarT(); };   // escribiendo o esperando al servidor: lo intenta de nuevo en 10 s
  d._t = setTimeout(caduca, 45000);
}
// Invitado → /mmo/ a crear cuenta con correo; al terminar vuelve a /mundo/ con su duende.
function irACrearCuenta() {
  aviso('Crea tu cuenta gratis con tu correo: al terminar vuelves aquí con tu duende.', 'ok');
  try { sessionStorage.setItem('dq_volver', '/mundo/'); localStorage.setItem('dq_volver', '/mundo/'); } catch (e) {}
  setTimeout(() => { location.href = '/mmo/' + (hashTg && hashTg.length > 1 ? hashTg + '&cuenta&volver=mundo' : '#cuenta&volver=mundo'); }, 700);
}
// Cupo global de ventanas que se abren solas (leyenda, aviso de invitado): no se apilan.
let ventanaAutoT = 0;
// Tope de tarjetas automaticas: tras 3, las de menos prioridad esperan a Nv 6 y a 15 min de juego (quedan para otra sesion).
let autoN = 0; const t0Auto = Date.now(); function cupoAuto() { return !(autoN >= 3 && ((yo && (yo.nivel || 1) < 6) || Date.now() - t0Auto < 15 * 60000)); }
// Cargas del juego en este equipo (la primera sesion no ofrece instalar).
let sesionesDQ = 0;
try { sesionesDQ = (+localStorage.getItem('dq_sesiones') || 0) + 1; localStorage.setItem('dq_sesiones', String(sesionesDQ)); } catch (e) {}
// En cada sesion (no cada reconexion): la historia es lo primero que se ve.
function leyendaPrimeraVez() {
  if (!cupoAuto()) return;
  try { if (sessionStorage.getItem('dq_leyenda')) return; } catch (e) { return; }
  // Movil: la ventana de la leyenda sale solo la primera vez (la barra morada de la chicha queda siempre a la vista).
  try { if (COMPACTO && localStorage.getItem('dq_leyenda_vista')) return; } catch (e) {}
  // Espera a que elija clase y a que vea (y cierre) el premio diario: comparten ventana.
  if (hayVentana() || hayLateral() || $('v-diario').classList.contains('on') || loginPend3 || !yo || !yo.clase || !!document.querySelector('#dq-avtg.on') || !!document.querySelector('#tira-diario.on') || !!$('probar-clase') || Date.now() - ventanaAutoT < 60000) { setTimeout(leyendaPrimeraVez, 3000); return; }
  try { sessionStorage.setItem('dq_leyenda', '1'); localStorage.setItem('dq_leyenda_vista', '1'); } catch (e) {}
  ventanaAutoT = Date.now(); autoN++;
  // Celular: la historia en una burbuja de Tito (sin ventana que tape la pantalla).
  if (COMPACTO) npcDice('Guardia Tito', ['El Rey Goblin rompió el Cántaro Eterno de la chicha. Recupera sus pedazos… y a Nv ' + CHICHA.nv60 + ' te llevas ' + CHICHA.litros60 + ' L de chicha morada de verdad (envíos solo en Perú).'], '🛡');
  else verLeyenda();
}
let avisoInvT = 0;
function avisoInvitado() {
  // Tras entregar la mision 1 (o desde Nv 3) y como mucho una vez al dia.
  if (!soyInvitado || !yo || (yo.nivel < 3 && !(yo.mis && yo.mis.i >= 1)) || hayVentana() || hayLateral() || $('v-diario').classList.contains('on')) return;
  // Nunca en combate ni en mal momento (el setInterval lo vuelve a intentar), ni encima del buzon/Telegram.
  // (objetivo solo cuenta si pego hace poco: un monstruo marcado y abandonado no lo bloquea para siempre)
  if (autoAtk || (P && (P.muerto || P.vuela)) || performance.now() - ((P && P.heridoT) || 0) < 8000 || (objetivo && performance.now() - ((P && P.atkT) || 0) < 8000)) return;
  if (document.querySelector('#dq-avtg.on') || Date.now() - ventanaAutoT < 180000 || !!$('tarjeta-bautizo') || !!$('probar-clase') || !!$('franja-inst')) return;
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);   // dia de Lima (UTC-5)
  try { if (localStorage.getItem('dq_aviso_inv') === hoy) return; localStorage.setItem('dq_aviso_inv', hoy); } catch (e) {}
  ventanaAutoT = Date.now(); autoN++;
  $('diario-c').innerHTML = `<button class="btn" id="inv-cuenta" style="width:100%;margin:6px 0 10px">📧 Crear cuenta gratis (guarda tu duende)</button>
    <p class="vv-p">🥤 Con cuenta, desde nivel ${CHICHA.nvPuntos} tus cazas suman puntos de chicha morada real. Como invitado no suman, y lo cazado antes no se recupera. Tu duende y tu nivel sí pasan a la cuenta.</p>
    <p class="vv-p">Juegas como <b>invitado</b>: tu duende vive solo en este navegador. Para no perderlo:</p>
    <p class="vv-p">Guarda tu <b>código de rescate</b>: con él recuperas tu duende en otro navegador o celular (${K('⌂ Inicio', '⋯ → ? → Inicio')} → código de rescate).</p>
    <div style="display:flex;gap:6px;align-items:center"><code style="flex:1;min-width:0;overflow-wrap:anywhere;background:rgba(0,0,0,.4);padding:8px;border-radius:8px;font-size:12px;color:#ffd84a">${codigoRescate()}</code><button class="btn" id="copiar-rescate" style="padding:8px 10px;font-size:12px">Copiar</button></div>`;
  $('v-diario').querySelector('h2').textContent = 'GUARDA TU DUENDE';
  abrir('v-diario');
  $('copiar-rescate').onclick = () => { const fallo = () => aviso('Tu código: ' + codigoRescate() + '. Anótalo o hazle captura.', 'ok', 1); try { navigator.clipboard.writeText(codigoRescate()).then(() => aviso('Código copiado. Guárdalo en un lugar seguro.', 'ok', 1), fallo); } catch (e) { fallo(); } };
  $('inv-cuenta').onclick = irACrearCuenta;
  { const b = document.createElement('button'); b.className = 'btn sec'; b.style.cssText = 'width:100%;margin-top:10px'; b.textContent = '📲 Pasar mi duende a Telegram u otro celular'; b.onclick = abrirLlevar; $('diario-c').appendChild(b); }
  // En el navegador de Facebook/Instagram, ademas, el boton para llevarlo a Chrome/Safari.
  if (esIAB) { const b = document.createElement('button'); b.className = 'btn'; b.style.cssText = 'width:100%;margin-top:10px'; b.textContent = ANDROID_IAB ? 'Abrir en Chrome con mi duende' : 'Pasar a Safari con mi duende'; b.onclick = () => irANavegador(); $('diario-c').appendChild(b); }
}
// ── AÑADIR A PANTALLA DE INICIO (web, no Telegram) ──
// Franja con boton tras la mision 1 / el premio diario, como mucho una vez al dia.
// Espera (hasta ~3 min) a que no haya ventana abierta; js/pwa.js decide si se puede instalar.
function ofrecerInstalar(n) {
  n = n || 0;
  if (!cupoAuto() || sesionesDQ < 2) return;   // ni con el cupo lleno ni en la primera sesion
  if (soyInvitado && /iphone|ipad|ipod/i.test(navigator.userAgent)) return;   // iOS: el icono guarda aparte y el invitado perderia su duende
  if (TG || !window.dqPuedeInstalar || !window.dqPuedeInstalar() || ofrecerInstalar.ya || $('franja-inst')) return;
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);   // dia de Lima (UTC-5)
  try { if (localStorage.getItem('dq_inst_ofrecido') === hoy) return; } catch (e) {}
  // Una tarjeta automatica cada vez: espera a "probar clase", al bautizo y a que pasen ~45 s de la anterior (hasta ~3 min).
  if (hayVentana() || $('v-diario').classList.contains('on') || $('franja-iab') || !!$('probar-clase') || !!$('tarjeta-bautizo') || (Date.now() - ventanaAutoT < 45000)) { if (n < 40) setTimeout(() => ofrecerInstalar(n + 1), 5000); return; }
  ofrecerInstalar.ya = true;
  ventanaAutoT = Date.now(); autoN++;
  try { localStorage.setItem('dq_inst_ofrecido', hoy); } catch (e) {}
  const f = document.createElement('div');
  f.id = 'franja-inst';
  f.setAttribute('role', 'status');
  f.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));z-index:8;width:min(94vw,440px);display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(20,12,44,.94);border:1px solid rgba(255,216,74,.5);color:#f2efff;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)';
  f.innerHTML = '<span style="flex:1;min-width:0">📲 Ten Duende Quest en tu pantalla de inicio: vuelve en un toque y no pierdas tu racha</span><button type="button" class="btn" style="min-height:40px;padding:7px 12px;font-size:12px;white-space:nowrap">Añadir</button><button type="button" aria-label="Cerrar" style="flex:none;min-width:40px;min-height:40px;margin:-6px -6px -6px 0;background:none;border:0;color:#b8b0d8;font-size:20px;padding:0;cursor:pointer">×</button>';
  const [si, x] = f.querySelectorAll('button');
  si.onclick = () => { f.remove(); if (window.dqInstalar) window.dqInstalar(); };
  x.onclick = () => f.remove();
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 25000);
}
// ── NAVEGADOR INTERNO (Facebook/Instagram) → Chrome/Safari ──
// Franja que no bloquea, tras la primera victoria (una vez por sesion; si la cierra, no vuelve en 3 dias).
// Android: intent:// abre Chrome con el codigo en el hash (#r=); /mundo/ lo adopta y lo borra de la URL.
// iOS no deja abrir Safari desde aqui: se copia el codigo y se explica el menu ··· → Abrir en el navegador.
const ANDROID_IAB = /Android/i.test(navigator.userAgent);
function irANavegador() {
  if (!soyInvitado) return;
  const cod = tokInvitado();
  if (ANDROID_IAB) {
    // Conserva ?fbclid/utm_* (medicion de Meta) y el modo anuncio (ad=1, lo lee js/origen.js) al pasar a Chrome.
    let q = location.search || '';
    try { if (!q && modoAnuncio()) q = '?ad=1'; else if (q && modoAnuncio() && !/[?&]ad=/.test(q)) q += '&ad=1'; } catch (e) {}
    const fb = encodeURIComponent(location.origin + '/mundo/' + q);
    location.href = 'intent://' + location.host + '/mundo/' + q + '#r=' + cod + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + fb + ';end';
    return;
  }
  // iOS: el codigo va en el hash; «Abrir en el navegador» de Facebook abre Safari con #r= y /mundo/ lo adopta.
  try { history.replaceState(null, '', location.pathname + location.search + '#r=' + cod); } catch (e) {}
  const txt = codigoRescate();
  const listo = () => aviso('Listo: toca ··· (arriba a la derecha) → «Abrir en el navegador» y tu duende viaja contigo. (Tu código también quedó copiado por si acaso.)', 'ok', 1);
  try { navigator.clipboard.writeText(txt).then(listo, () => aviso('Tu código de rescate: ' + txt + '. Guárdalo y toca ··· → «Abrir en el navegador».', 'ok', 1)); } catch (e) { aviso('Tu código de rescate: ' + txt + '. Guárdalo y toca ··· → «Abrir en el navegador».', 'ok', 1); }
}
let franjaIABvista = false;
function franjaIAB() {
  if (franjaIABvista || !esIAB || !soyInvitado || !yo || !(yo.mis && yo.mis.i >= 1)) return;
  if (!cupoAuto()) return;
  // Una tarjeta automatica cada vez: se reintenta en el siguiente 'yo'.
  if (Date.now() - ventanaAutoT < 45000 || $('probar-clase') || $('tarjeta-bautizo')) return;
  franjaIABvista = true;
  try { if (Date.now() - (+localStorage.getItem('dq_iab_no') || 0) < 3 * 86400000) return; } catch (e) {}
  const f = document.createElement('div');
  f.id = 'franja-iab';
  f.setAttribute('role', 'status');
  f.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));z-index:8;width:min(94vw,440px);display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(20,12,44,.94);border:1px solid rgba(125,211,252,.5);color:#f2efff;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)';
  f.innerHTML = '<span style="flex:1;min-width:0">¡Primera misión! Para no perder tu duende, juega en ' + (ANDROID_IAB ? 'Chrome' : 'Safari') + ': es más fluido.</span><button type="button" class="btn" style="min-height:40px;padding:7px 10px;font-size:12px;white-space:nowrap">' + (ANDROID_IAB ? 'Abrir en Chrome' : 'Cómo pasarlo') + '</button><button type="button" aria-label="Cerrar" style="flex:none;min-width:40px;min-height:40px;margin:-6px -6px -6px 0;background:none;border:0;color:#b8b0d8;font-size:20px;padding:0;cursor:pointer">×</button>';
  const [ir, x] = f.querySelectorAll('button');
  ir.onclick = () => irANavegador();
  x.onclick = () => { f.remove(); try { localStorage.setItem('dq_iab_no', String(Date.now())); } catch (e) {} };
  document.body.appendChild(f);
  ventanaAutoT = Date.now(); autoN++;
  setTimeout(() => f.remove(), 25000);
}
// ── COFRES DEL TESORO (3 por zona; el legendario, en lo alto) ──
const COFRES3 = cofres3d(MAPAS, MONSTRUOS).map(c => ({ ...c, listoEn: 0, g: null, tapa: null, gema: null }));
const COLOR_COFRE = { comun: '#8b5a2b', epico: '#6b21a8', legendario: '#b45309' };
const NOMBRE_COFRE = { comun: 'cofre', epico: 'cofre épico', legendario: 'cofre legendario' };
function crearCofres3() {
  const oro = new THREE.MeshLambertMaterial({ color: '#facc15', flatShading: true });
  for (const c of COFRES3) {
    const g = new THREE.Group(), madera = new THREE.MeshLambertMaterial({ color: COLOR_COFRE[c.tipo], flatShading: true });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), madera); caja.position.y = 0.3;
    for (const x of [-0.4, 0.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.78), oro); b.position.set(x, 0.31, 0); g.add(b); }
    const tapa = new THREE.Group(); tapa.position.set(0, 0.6, -0.375);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 1.1, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), madera); t.position.set(0, 0, 0.375); tapa.add(t);
    const cierre = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), oro); cierre.position.set(0, -0.02, 0.76); tapa.add(cierre);
    const gema = new THREE.Mesh(new THREE.OctahedronGeometry(c.tipo === 'legendario' ? 0.28 : 0.2, 0), new THREE.MeshBasicMaterial({ color: c.tipo === 'legendario' ? '#ffd84a' : c.tipo === 'epico' ? '#c084fc' : '#fde68a' }));
    gema.position.y = 1.5;
    g.add(caja, tapa, gema);
    g.position.set(c.x, alturaEn(c.x, c.z) - 0.05, c.z); g.rotation.y = Math.atan2(-c.x, -c.z);
    if (c.tipo === 'legendario') g.scale.setScalar(1.25);
    escena.add(g);
    c.g = g; c.tapa = tapa; c.gema = gema;
    ponerSolido(c.x, c.z, 0.55);
    // Haz dorado del legendario: se ve de lejos para guiar la subida; se apaga mientras recarga.
    if (c.tipo === 'legendario') {
      if (!crearCofres3.matHaz) crearCofres3.matHaz = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
      const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 30, 10, 1, true), crearCofres3.matHaz);
      haz.position.set(c.x, alturaEn(c.x, c.z) + 15, c.z); escena.add(haz); c.haz = haz;
    }
  }
}
function cofreCercano() {
  const ahora = Date.now();
  let mejor = null, md = COFRE3D_DIST;
  for (const c of COFRES3) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < md && c.listoEn <= ahora) { md = d; mejor = c; } }
  return mejor;
}
function animarCofres(t) {
  const ahora = Date.now();
  for (const c of COFRES3) {
    if (c.haz) c.haz.visible = c.listoEn <= ahora;
    if (c.g) {
      const dxC = c.x - P.x, dzC = c.z - P.z, vivo = Math.abs(dxC) <= 90 && Math.abs(dzC) <= 90, limC = escena.fog.far + 8;
      c.g.visible = vivo || dxC * dxC + dzC * dzC < limC * limC;
      if (vivo !== c.vivo) { c.vivo = vivo; if (!vivo) c.g.updateMatrixWorld(true); c.g.matrixWorldAutoUpdate = vivo; }
    }
    if (!c.g || Math.abs(c.x - P.x) > 90 || Math.abs(c.z - P.z) > 90) continue;
    const listo = c.listoEn <= ahora;
    c.tapa.rotation.x += ((listo ? 0 : -1.15) - c.tapa.rotation.x) * 0.12;
    c.gema.visible = listo;
    if (listo) { c.gema.position.y = 1.45 + Math.sin(t / 400 + c.i) * 0.12; c.gema.rotation.y = t / 600; }
    if (listo && Math.floor(t / 250) % 3 === c.i % 3) {
      FX.emitir(c.x, alturaEn(c.x, c.z) + 0.9, c.z, { n: c.tipo === 'legendario' ? 8 : 4, color: c.tipo === 'epico' ? '#c084fc' : '#ffd84a', vel: 1, vida: 1.2, grav: -1.5, tam: 1.4, forma: 'estrella' });
      if (c.tipo === 'epico' || c.tipo === 'legendario') FX.brillo(c.x, alturaEn(c.x, c.z) + 1.5, c.z, c.tipo === 'epico' ? '#c084fc' : '#ffd84a', c.tipo === 'legendario');   // latido de luz del cofre fuerte
    }
  }
}
// ── TEMPORADA DEL ABISMO Y EQUILIBRIO DE FACCIONES ──
let temp3 = null;
const ICO_F = { luz: '☀', sombra: '🌑' };
const fmtN = n => (n || 0).toLocaleString('es');
// Marcador de la temporada (pestaña «Abismo» del ranking).
function htmlTemp(T) {
  if (!T) return '<p class="vv-p">Cargando…</p>';
  const fin = Math.max(0, T.fin - Date.now()), dd = Math.floor(fin / 86400000), hh = Math.floor(fin % 86400000 / 3600000);
  const sl = T.sc.luz || 0, ss = T.sc.sombra || 0, tot = Math.max(1, sl + ss), pl = Math.round(sl / tot * 100);
  let h = `<p class="vv-p">🏆 <b>Temporada del Abismo</b> · cierra en <b style="color:#f87171">${dd} d ${hh} h</b>. La facción con más puntos gana un 50 % más de premio (los puntos se dividen por la raíz de sus participantes: no gana solo la más numerosa).</p>`;
  h += `<div style="display:flex;justify-content:space-between;font-size:12px;margin:6px 0 3px"><b style="color:${FACCIONES.luz.color}">☀ Luz ${fmtN(sl)}</b><b style="color:${FACCIONES.sombra.color}">${fmtN(ss)} Sombra 🌑</b></div>`;
  h += `<div style="height:10px;border-radius:6px;overflow:hidden;display:flex;background:#222"><i style="width:${sl + ss ? pl : 50}%;background:linear-gradient(90deg,#fde68a,#60a5fa)"></i><i style="flex:1;background:linear-gradient(90deg,#c084fc,#ef4444)"></i></div>`;
  h += `<p class="vv-p" style="font-size:11px;margin-top:4px">Miembros: ☀ ${T.n.luz || 0} · 🌑 ${T.n.sombra || 0} · Asedios ganados: ☀ ${T.as.luz || 0} · 🌑 ${T.as.sombra || 0}${T.debil ? `<br>✨ <b style="color:${FACCIONES[T.debil].color}">Bendición del Éter</b>: los ${esc(FACCIONES[T.debil].titulo)} son menos y ganan PA ×${String(FACC_BONO).replace('.', ',')}.` : ''}</p>`;
  const sig = TEMP_ABISMO[T.tier + 1], act = TEMP_ABISMO[T.tier];
  if (yo && yo.faccion) h += `<p class="vv-p">Tus PA de la temporada: <b style="color:#ffd84a">${fmtN(T.p)}</b> · liga <b>${act ? act.n : 'sin liga'}</b>${sig ? ` · te faltan <b>${fmtN(sig.pa - T.p)}</b> para ${sig.n}` : ' · ¡la más alta!'}</p>`;
  else h += '<p class="vv-p">Elige tu facción en el portal del pueblo (nivel 20) para competir.</p>';
  h += '<div class="dias7">' + TEMP_ABISMO.map((x, i) => `<div class="d7 ${i <= T.tier ? 'ya' : i === T.tier + 1 ? 'hoy' : ''}"><small>${x.n}</small><span>${['🥉', '🥈', '🥇', '💎'][i]}</span><em>${fmtN(x.pa)} PA</em></div>`).join('') + '</div>';
  h += '<div class="rank-lista" style="margin-top:8px">' + (T.top.length ? T.top.map((x, i) => `<div class="rk ${x.yo ? 'yo' : ''}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${ICO_F[x.f] || ''} ${esc(x.n)}</b><span>${fmtN(x.p)} PA</span></div>`).join('') : '<p class="vv-p">Nadie ha ganado PA este mes: ¡estrena el podio!</p>') + '</div>';
  h += '<p class="vv-p" style="font-size:11px">Podio: 1.º un objeto legendario y el título «Campeón del Éter»; 2.º y 3.º, un épico y oro extra.</p>';
  if (T.ult) h += `<p class="vv-p" style="font-size:11px;color:var(--txt3)">Temporada ${esc(T.ult.mes)}: ${T.ult.ganador ? `ganaron los <b style="color:${FACCIONES[T.ult.ganador].color}">${esc(FACCIONES[T.ult.ganador].titulo)}</b>` : 'empate'}${T.ult.tops && T.ult.tops[0] ? ` · campeón: ${esc(T.ult.tops[0].n)}` : ''}.</p>`;
  return h;
}
function mostrarTempFin(m) {
  let h = `<p class="vv-p">Terminó la <b>Temporada del Abismo ${esc(m.mes)}</b>. Ganaste <b style="color:#ffd84a">${fmtN(m.p)} PA</b>${m.liga ? ` y llegaste a la liga <b>${esc(m.liga)}</b>` : ''}.</p>`;
  h += `<p class="vv-p">${m.ganador ? (m.gana ? `🏆 ¡Tu facción ganó la temporada! Premio +50 %.` : `Ganaron los ${esc(FACCIONES[m.ganador].titulo)}. ¡Este mes os toca a vosotros!`) : 'La temporada terminó en empate.'}${m.puesto >= 0 ? ` Quedaste <b>${['1.º 🥇', '2.º 🥈', '3.º 🥉'][m.puesto]}</b> del podio.` : ''}</p>`;
  h += `<p class="vv-p">Recibes: <b>+${fmtN(m.oro)} oro</b>${m.pociones ? `, ${m.pociones} pociones` : ''}${m.items && m.items.length ? ', ' + m.items.map(esc).join(', ') : ''}.</p><p class="vv-p" style="font-size:12px">La nueva temporada ya empezó: los PA vuelven a contar desde cero.</p>`;
  $('diario-c').innerHTML = h;
  $('v-diario').querySelector('h2').textContent = 'FIN DE TEMPORADA';
  abrir('v-diario'); vib('success'); sfxK('monedas', 0.5);
}
// ── BOTIN FUERTE ──
// Epico o legendario: haz de luz del color de la rareza sobre el jugador, presumir
// y, si mejora lo que lleva puesto, una tarjeta «▲ Mejor · Equipar» de un toque.
function hazBotin(color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 26, 14, 1, true), mat);
  haz.position.set(P.x, P.y + 13, P.z); escena.add(haz);
  FX.emitir(P.x, P.y + 1.2, P.z, { n: MOVIL ? 30 : 60, color, vel: 3, vida: 1.4, grav: -2.5, radio: 0.6, tam: 1.1 });
  const t0 = performance.now();
  let pulso = 0;
  const paso = () => {
    const ahora = performance.now(), k = (ahora - t0) / 2600;
    if (k >= 1) { escena.remove(haz); liberar(haz); return; }
    haz.position.set(P.x, P.y + 13, P.z); haz.rotation.y += 0.04;
    mat.opacity = 0.55 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * (0.8 + 0.2 * Math.sin(ahora / 90));   // late
    if (ahora - pulso > 420 && k < 0.85) { pulso = ahora; FX.brillo(P.x, P.y + 1.1, P.z, color, true); }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
// 📦 Cofre del dia / semanal (bonoTareas y puntoSemana del servidor): tarjeta que se abre con un toque o sola a los 4 s.
const SEMANA_COFRES3 = [4, 8, 12];   // mismos umbrales que functions/mmo/tareas.js
const colaCofreSem = [];
let cofreSemTxt = '', cofreSemTxtT = 0;   // texto del bono (toast del servidor) que se revela al abrir el cofre
function cofreSem(m) {
  if (!m) return;
  if (cofreSemTxt && m.txt === undefined) { m.txt = cofreSemTxt; cofreSemTxt = ''; clearTimeout(cofreSemTxtT); }   // el texto viaja con su cofre (aunque haga cola)
  if (avisoTapado() || $('cofre-sem') || !m.item) { if ($('cofre-sem') && m.item) colaCofreSem.push(m); else { if (m.item && !m.item.vendido) botinFuerte(m.item); if (m.txt) aviso(m.txt, 'ok'); } return; }
  const t = document.createElement('button'); t.id = 'cofre-sem'; t.type = 'button';
  const ico = document.createElement('span'); ico.className = 'cs-ico'; ico.textContent = '📦';
  const tit = document.createElement('span'); tit.textContent = m.tipo === 'dia' ? 'Cofre del día' : (m.n ? 'Cofre semanal ' + m.n + '/3' : 'Cofre de la semana');
  const sub = document.createElement('span'); sub.className = 'cs-sub'; sub.textContent = 'Toca para abrir';
  t.append(ico, tit, sub); document.body.appendChild(t);
  let abierto = false, tm = 0;
  const abrir = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (abierto) return; abierto = true; clearTimeout(tm);
    vib('light'); SON.tocar('cofre');
    sub.textContent = '¡Abriendo!';
    if (!MENOS_MOV) t.classList.add('tiembla');
    setTimeout(() => {
      // Revela qué salió (~1,2 s) antes de cerrar la tarjeta.
      const it = m.item, rz = RAREZAS[it.r] || {};
      const ex = /(\d+) escudos? y (\d+) pociones?/.exec(m.txt || '');
      const esc2 = ex ? +ex[1] : (m.tipo === 'semana' && !m.n ? 5 : 2), poc = ex ? +ex[2] : (m.tipo === 'semana' && !m.n ? 10 : 5);
      t.classList.remove('tiembla');
      ico.textContent = '🎁';
      tit.innerHTML = '<b style="color:' + esc(rz.color || '#ffd84a') + '">' + esc((rz.nombre ? rz.nombre + ': ' : '') + (it.nombre || nombreItem(it))) + '</b>';
      sub.textContent = it.vendido ? '(bolsa llena: vendido) · +' + esc2 + ' 🛡️ · +' + poc + ' 🧪' : '+' + esc2 + ' escudos · +' + poc + ' pociones';
      setTimeout(() => {
        t.remove();
        if (!it.vendido) botinFuerte(it);   // vendido: bolsa llena, la tarjeta ya lo dijo
        if (m.txt) { aviso(m.txt, 'ok'); m.txt = ''; }
        const sig = colaCofreSem.shift(); if (sig) setTimeout(() => cofreSem(sig), 600);
      }, MENOS_MOV ? 600 : 1200);
    }, MENOS_MOV ? 120 : 400);
  };
  t.addEventListener('pointerdown', abrir);
  t.addEventListener('click', abrir);
  tm = setTimeout(abrir, 4000);
}
function metaCofreSem(pts, cof) {
  if (cof >= 3 || avisoTapado() || $('dq-noche')) return;
  const meta = SEMANA_COFRES3[cof], base = cof ? SEMANA_COFRES3[cof - 1] : 0, falta = meta - pts;
  if (falta <= 0) return;
  let b = $('cofre-meta');
  if (!b) { b = document.createElement('div'); b.id = 'cofre-meta'; document.body.appendChild(b); }
  b.textContent = '📦 ' + pts + '/' + meta + ' · ' + (falta === 1 ? '¡1 misión diaria más y se abre!' : '¡' + falta + ' puntos más y se abre!');   // puntos, no misiones: el bono del dia suma +1 extra (tareas.js puntoSemana)
  const barra = document.createElement('span'); barra.className = 'cm-b';
  const relleno = document.createElement('i'); relleno.style.width = Math.max(0, Math.min(100, (pts - base) / (meta - base) * 100)) + '%';
  barra.appendChild(relleno); b.appendChild(barra);
  clearTimeout(b._tm);
  requestAnimationFrame(() => b.classList.add('on'));
  b._tm = setTimeout(() => b.classList.remove('on'), 2500);
}
function botinFuerte(it) {
  if (!it) return;
  const fuerte = it.r >= 2;   // haz, vibracion y presumir solo epico o mas; la tarjeta de mejora para todos
  const rz = RAREZAS[it.r] || {};
  const pobreB = MOVIL || CAL === 'baja';
  if (it.r === 1) {   // Raro (~1 de cada 4 drops): latido azul corto y campanita suave, sin haz ni presumir
    FX.brillo(P.x, P.y + 1.1, P.z, '#33aaff', false);
    if (!pobreB) setTimeout(() => FX.brillo(P.x, P.y + 1.1, P.z, '#33aaff', false), 380);
    SON.tocar('botin', { r: 1, vol: 0.5 });
  }
  if (fuerte) {
    // Anticipacion: destello blanco neutro y, medio segundo despues, el haz del color de la rareza.
    FX.brillo(P.x, P.y + 1.1, P.z, '#ffffff', !pobreB);
    const colB = rz.color || '#c084fc'; setTimeout(() => hazBotin(colB), 500);
    SON.tocar('botin', { r: it.r, vol: it.r >= 3 ? 1 : 0.85 });   // mas brillante cuanto mas raro
    if (musica.agachar) musica.agachar(1.5);
    if (it.r >= 3) vib('heavy');
    setTimeout(() => ofrecerPresumir('¡Me salió un objeto ' + (rz.nombre || '').toLowerCase() + ': ' + (it.nombre || nombreItem(it)) + ' en Duende Quest 3D!', 'botin'), 1500);
  }
  if (!yo || !it.id || !V.compararConPuesta(it, yo)) return;
  let t = $('mejor3');
  if (!t) {
    t = document.createElement('button'); t.id = 'mejor3';
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:6;pointer-events:auto;cursor:pointer;padding:9px 16px;border-radius:10px;background:rgba(14,9,30,.92);color:#fff;font:700 13px var(--sans);box-shadow:0 6px 20px rgba(0,0,0,.45);max-width:88vw;white-space:normal;';
    t.style.top = COMPACTO ? 'calc(22% + var(--tg-top,0px))' : 'auto'; if (!COMPACTO) t.style.bottom = '250px';
    document.body.appendChild(t);
  }
  t.style.border = '2px solid ' + (rz.color || '#c084fc');
  t.innerHTML = '';
  const n = document.createElement('span'); n.style.color = rz.color || '#fff'; n.textContent = (it.nombre || nombreItem(it));
  const b = document.createElement('b'); b.style.color = '#4ade80'; b.textContent = ' ▲ Mejor · Equipar';
  t.append(n, b);
  // Diferencias contra la pieza puesta en esa ranura (+12 ATQ en verde, -3 DEF en rojo; maximo 3).
  const dl = V.deltasBonos ? V.deltasBonos(it.b, ((yo.eq || {})[it.s] || {}).b).slice(0, 3) : [];
  if (dl.length) {
    const sm = document.createElement('small'); sm.style.cssText = 'display:block;margin-top:3px;font:700 12px var(--sans);';
    dl.forEach((x, i) => { const s = document.createElement('span'); s.style.color = x.d > 0 ? '#6f6' : '#f66'; s.textContent = (i ? ' · ' : '') + x.v + ' ' + x.k; sm.appendChild(s); });
    t.appendChild(sm);
  }
  t.onclick = () => {
    t.style.display = 'none'; mandar({ t: 'item', a: 'equipar', id: it.id }); aviso('Equipado: ' + (it.nombre || nombreItem(it)), 'ok', 1);
    // Destello del color de la rareza y el poder ganado flotando (hasta 2 mejoras, 250 ms entre cada una).
    try { FX.brillo(P.x, P.y + 1.1, P.z, rz.color || '#c084fc', false); SON.tocar('botin', { r: it.r || 0, vol: 0.5 }); } catch (e) { sfx('boton', 0.4); }
    vib('light');
    dl.filter(x => x.d > 0).slice(0, 2).forEach((x, i) => setTimeout(() => numero(P.x, P.y + 3 + i * 0.6, P.z, x.v + ' ' + x.k, '#4ade80'), i * 250));
  };
  t.style.display = 'block'; clearTimeout(botinFuerte.t);
  botinFuerte.t = setTimeout(() => { t.style.display = 'none'; }, fuerte ? 10000 : 6000);
}
// ── INVASION DEL 3D ──
let invasion3 = null;
let invYo3 = 0, invYo3Id = 0;   // tus aportes en la invasion actual (inv3yo de eventos3d.js): medalla en vivo en el HUD
let invPre3 = null, benditas3 = {};   // invPre3: tambores (invasion en 1:30, eventos3d.js avisarInvasion3d). benditas3: zona -> hasta (+10 % XP tras ganar una invasion)
// ── SUBIR DE NIVEL, PRESUMIR Y TELEGRAM ──
// Lo proximo que se abre (todo con las constantes del juego, sin niveles inventados).
const NV_CLASE_GRATIS = (() => { let n = 1; while (n < 60 && costoCambioClase(n + 1) === 0) n++; return n; })();   // 9: ultimo nivel con cambio de clase gratis
// Tambien la Cueva de los Goblins (Nv 5) y cada zona nueva (desde MAPAS); si dos caen en el mismo nivel, se unen con « · ».
const PROXIMOS = Object.values([[EXPEDICION.nv, '🧭 expediciones de tu mascota'], [NV_CLASE_GRATIS, '⚔ último nivel para cambiar de clase gratis'], [ESPEC_NIVEL, '🌟 especialización y talentos'], [TAL_PRE_NIVEL, '🌟 elige tu primer talento (lo activas a Nv 10)'], [ABISMO.nvMin, '🌌 el Abismo de Éter'], [5, '⛏ la Cueva de los Goblins (portal del pueblo): épico + XP, 3 al día'],
  ...Object.values(MAPAS).filter(m => m && m.zona && !m.instancia && !m.coliseo && !m.torre && Array.isArray(m.nv) && m.nv[0] > 1).map(m => [m.nv[0], '🗺 nueva zona: ' + m.nombre])]
  .reduce((acc, p) => { if (acc[p[0]]) acc[p[0]][1] += ' · ' + p[1]; else acc[p[0]] = [p[0], p[1]]; return acc; }, {})).sort((a, b) => a[0] - b[0]);
// Fuegos artificiales de Año Nuevo (world.js revisarAnoNuevo): 5-8 rafagas de colores en el cielo
// sobre el jugador durante ~6 s; en calidad baja o equipo pobre, menos rafagas y menos chispas.
const COL_FUEGOS = ['#ff4d6d', '#ffd84a', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#fb923c', '#e0f2fe'];
function fuegosArtificiales(grande) {
  const baja = POBRE || CAL === 'baja';
  const nR = baja ? (grande ? 4 : 3) : (grande ? 8 : 5) + (MOVIL ? -1 : 0);
  const nC = baja ? 18 : MOVIL ? 30 : 48;
  for (let i = 0; i < nR; i++) {
    setTimeout(() => {
      try {
        if (!P) return;
        const ang = Math.random() * Math.PI * 2, r = 6 + Math.random() * 12;
        const x = P.x + Math.cos(ang) * r, z = P.z + Math.sin(ang) * r, y = (P.y || 0) + 16 + Math.random() * 8;
        const c1 = COL_FUEGOS[(Math.random() * COL_FUEGOS.length) | 0], c2 = COL_FUEGOS[(Math.random() * COL_FUEGOS.length) | 0];
        FX.emitir(x, y, z, { n: nC, color: c1, vel: 7, vida: 1.4, grav: 2.5, forma: 'chispa' });
        if (!baja) FX.emitir(x, y, z, { n: (nC / 2) | 0, color: c2, vel: 4, vida: 1.1, grav: 1.5, tam: 1.3, forma: 'estrella' });
        FX.emitir(x, y, z, { n: 2, color: '#ffffff', vel: 0.5, vida: 0.3, tam: 2.2, forma: 'destello' });
        if (i % 2 === 0) sfx('explosion', 0.12);
      } catch (e) {}
    }, i * (5600 / nR) + Math.random() * 300);
  }
  try { SON.tocar('logro', { vol: 0.7 }); } catch (e) {}
}
function subiNivel(lv) {
  // Habilidad recien aprendida: se presenta y su boton late hasta que la uses (la marca sobrevive a recargar).
  const hn = lv > 0 && yo && yo.clase ? habsDe(yo.clase).find(x => x.nv === lv) : null;
  if (hn) {
    setTimeout(() => aviso('✨ Nueva habilidad: ' + hn.nombre + ' — ' + hn.desc, 'ok', 1), 3000);
    try { localStorage.setItem('dq3_habNueva_' + clavePj(), hn.id); } catch (e) {}
    setTimeout(pulsoHabNueva, 50);   // la barra se rehace al cambiar de nivel: se marca despues
  }
  // «Próximo: Nv N → ...» (no en los niveles que ya traen su propio aviso a esa hora).
  const prox = lv < 20 && PROXIMOS.find(p => p[0] > lv);
  if (prox && ![3, 5, TAL_PRE_NIVEL, NV_CLASE_GRATIS, ESPEC_NIVEL, ABISMO.nvMin].includes(lv)) setTimeout(() => aviso('Próximo: Nv ' + prox[0] + ' → ' + prox[1], undefined, 3), 2500);
  vib('success'); fanfarria();
  // Que se sienta: la camara se abre un poco, tiembla suave y un destello dorado cubre la pantalla.
  fovGolpe = 7; sacudir = Math.max(sacudir, 0.12);
  const fl = $('flash-nv');
  if (fl) { fl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on'))); }
  FX.subirNivel(P.x, P.y, P.z); hazBotin('#ffe066');   // espiral dorada, anillo y columna de luz
  FX.emitir(P.x, P.y + 0.2, P.z, { n: 30, color: '#ffe066', vel: 2.4, vida: 1.6, grav: -3.5, radio: 0.7, tam: 1.3 });
  // Nv 20: se abre el Abismo de Eter; se pide la temporada (gente por faccion y premio al reclutar).
  if (lv >= ABISMO.nvMin && !temp3) mandar({ t: 'temp3' });
  // Nv 5: se abre la Cueva de los Goblins (cofre epico + 30 % de XP, 3 al dia).
  if (lv === 5) setTimeout(() => { if (!enCueva(P.x) && !enAbismo(P.x)) aviso('⛏ ¡Nivel 5! Entra a la Cueva de los Goblins por el portal del pueblo: solo o en grupo, el Rey Goblin suelta un objeto ÉPICO (3 al día).', 'ok'); }, 6000);
  if (lv === 5) setTimeout(avisoComunidad, 15000);
  if (lv === ABISMO.nvMin && !(yo && yo.faccion)) setTimeout(() => aviso('🌌 ¡Nivel ' + lv + '! Se abrió el Abismo de Éter: ve al portal del pueblo y elige Luz o Sombra. Si una facción tiene menos gente, unirte a ella da premio.', 'ok'), 4000);
  if (lv >= 60) ofrecerPresumir('¡Llegué al nivel 60, el máximo, en Duende Quest 3D! 🏆', 'nv60');
  else if (lv >= 5 && lv % 5 === 0) ofrecerPresumir(`¡Llegué al nivel ${lv} en Duende Quest 3D!`, 'nivel');
  // Talentos y especializacion: se dice al desbloquearlos y en cada nivel con puntos (el libro va dentro de ⋯ en movil).
  const dondeLibro = MOVIL ? '⋯ → 📖' : '📖 (tecla P)';
  // Nv 3 con 'DuendeNNNN': una vez, se le dice que puede ponerle su nombre (gratis) para que sus amigos lo reconozcan.
  if (lv === 3 && yo && /^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '')) setTimeout(() => { let visto = false; try { visto = !!localStorage.getItem('dq_aviso_nombre'); localStorage.setItem('dq_aviso_nombre', '1'); } catch (e) {} if (!visto && yo && /^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '')) aviso(`✏️ Tus amigos te ven como ${yo.nombre}: ponle tu nombre en ${K('? → Ajustes', 'Más (⋯) → ?')}.`, 'ok'); }, 6000);
  if (lv === TAL_PRE_NIVEL) setTimeout(() => aviso(`🌟 Nv ${lv}: elige tu primer talento en ${dondeLibro} → Talentos. A Nv 10 lo activas con un toque (elegirlo no gasta nada).`, 'ok'), 2500);
  if (lv === 9) setTimeout(() => aviso('⚔ Último nivel para cambiar de clase gratis: desde Nv 10 cuesta oro. Pruébalas en ' + dondeLibro + '.', 'ok'), 2500);
  // El aviso de la XP al morir desde Nv 10 se da en la pantalla de muerte (la primera vez), no aqui entre otros 3.
  if (lv === 10 && soyInvitado) setTimeout(() => aviso('🥤 Desde nivel 10 las cazas suman puntos de chicha real, pero como invitado no suman. Si quieres que cuenten, crea tu cuenta gratis (tu duende pasa contigo) en ' + K('Ajustes (?)', 'Más (⋯) → ?') + '.', 'ok'), 6000);
  if (lv === 10) setTimeout(() => aviso(`🌟 ¡Nivel 10! Ya puedes elegir tu especialización y repartir puntos de talento en ${dondeLibro}.`, 'ok'), 1500);
  else if (lv > 10) setTimeout(() => aviso(`🌟 +1 punto de talento: úsalo en ${dondeLibro} → Talentos.`, 'ok'), 1500);
  // Nv 3+, una vez por dispositivo: permiso para que el bot te escriba (Bot API 6.9).
  // Si toca, en este nivel no se ofrece la pantalla de inicio (nunca dos ventanas juntas).
  if (pedirEscribirTg(lv)) return;
  // A partir del nivel 6 (el 5 ya trae cueva y pack de bienvenida), una vez: acceso directo en la pantalla
  // de inicio (Bot API 8.0). Con tienda/mochila u otra ventana abierta se deja para el siguiente nivel.
  if (lv >= 6 && TGV('8.0') && TG.addToHomeScreen && !hayLateral() && !hayVentana()) {
    let visto = true; try { visto = !!localStorage.getItem('dq_tg_inicio'); } catch (e) {}
    if (!visto) try {
      const marcar = () => { try { localStorage.setItem('dq_tg_inicio', '1'); } catch (e) {} };
      if (TG.checkHomeScreenStatus) TG.checkHomeScreenStatus(st => { if (st === 'unknown') return; marcar(); if (st === 'missed') TG.addToHomeScreen(); });
      else { marcar(); TG.addToHomeScreen(); }
    } catch (e) {}
  }
}
// Telegram: el bot solo puede avisarte si aceptas que te escriba (sobre todo si
// entraste por un enlace). Se pide 20 s despues de subir de nivel y nunca en pelea
// (se reintenta cada 15 s, hasta 2 min; si no, en el siguiente nivel). Si aceptas,
// el servidor quita un bloqueo viejo de avisos (retencion.js); no manda nada en ese momento.
let escribirTgT = 0;
function pedirEscribirTg(lv) {
  if (lv < 3 || !TGV('6.9') || !TG.requestWriteAccess) return false;
  // Ya acepto, o dijo «Ahora no» hace menos de 7 dias (avisotg.js).
  if (!escribirTgPendiente()) return false;
  if (escribirTgT) return true;
  let intentos = 0;
  const intentar = () => {
    escribirTgT = 0;
    if (!escribirTgPendiente()) return;
    // Nunca en pelea ni con otra ventana abierta: se espera.
    let ocu = true; try { ocu = !pausaTg3() || enCombate3() || !!(yo && yo.muerto) || document.hidden || hayVentana() || hayLateral(); } catch (e) {}
    if (ocu || !avisoTg3.pedirPermiso()) {
      if (++intentos < 8) escribirTgT = setTimeout(intentar, 15000);
    }
  };
  escribirTgT = setTimeout(intentar, 20000);
  return true;
}
// Presumir: historia de Telegram (Bot API 7.8) con una imagen del juego; si
// no se puede, el compartir de Telegram o el del sistema.
let presumirTxt = '', refAmigo = '', compartirPend = false, nivelAmigo = 10;
// Sin el codigo aun, se pide y se comparte al llegar (antes salia el enlace sin ref y no contaba).
// historia=true solo desde «Presúmelo» (#presumir3): abre el editor de historias; si no, el selector de chats.
function compartirYa(historia) {
  if (refAmigo) return compartir(historia);
  compartirPend = historia ? 'h' : true; mandar({ t: 'amigos' }); aviso('Preparando tu enlace de invitación...', 'ok');
}
// 📲 Invitar a mi grupo: enlace con tu codigo (refAmigo) que, al tocarlo, le manda a tu amigo tu
// invitacion de grupo (servidor unirmeRef). En Telegram va por el bot (start=m3d_) hasta que se active startapp.
// Solo lo dispara el jugador con el boton; no se envia nada por Telegram por su cuenta.
const TXT_GRUPO = '¡Únete a mi grupo en Duende Quest 3D! 🧌';
function invitarGrupoLink() {
  if (!/^[a-z0-9]{6}$/.test(refAmigo || '')) { mandar({ t: 'amigos' }); return aviso('Preparando tu enlace… toca otra vez en un segundo.', 'ok'); }
  mandar({ t: 'grupoLink' });   // el servidor solo acepta el enlace 2 h y 6 usos desde aqui (anti-intrusos)
  if (TG && TG.openTelegramLink) {
    const enl = 'https://t.me/duendequest_bot?' + (TG_STARTAPP_OK ? 'startapp=g_' : 'start=m3d_') + refAmigo;
    try { return TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(enl) + '&text=' + encodeURIComponent(TXT_GRUPO)); } catch (e) {}
  }
  const url = 'https://' + location.host + '/mundo/?ref=' + refAmigo + '&utm_source=whatsapp#g=' + refAmigo;
  try { if (navigator.clipboard) navigator.clipboard.writeText(TXT_GRUPO + ' ' + url).then(() => aviso('🔗 Enlace copiado: tu amigo lo toca y le llega tu invitación.', 'ok'), () => {}); } catch (e) {}
  if (navigator.share && !esIAB) { try { navigator.share({ text: TXT_GRUPO, url }).catch(() => {}); return; } catch (e) {} }
  try { window.open(waLink(TXT_GRUPO, url), '_blank'); } catch (e) {}
}
// Buzon "Mientras no estabas" y la compra entregada (/mmo/js/regalo.js), despues del cofre diario.
const regalo3 = iniciarRegalo({
  mandar,
  ocupado: () => hayVentana() || $('v-diario').classList.contains('on') || !!loginPend3 || !!document.querySelector('#dq-avtg.on') || !!document.querySelector('#tira-diario.on') || !yo || !yo.clase || !!cineEst,
  presumir: txt => { presumirTxt = txt; presumirTipo = ''; compartirYa(); },
  fanfarria, vibrar: vib,
  filtro: t => modoAnuncio() && /mTON|\bSOL\b|\$DUENDE|[Ww]allet/.test(t || ''),
});
// «Avísame por Telegram» para jugadores web e invitados (/mmo/js/avisotg.js): despues del cofre y del buzon.
// Nunca en plena pelea, muerto, sin clase, en el primer minuto, antes de 3 cazas, con invasion en marcha ni sobre otra tarjeta (salvo si el jugador la pidio).
// Ofrecida sola, ademas, solo en una pausa real: en el pueblo o tras 30 s sin combate (un respiro de 4 s en plena caza no basta).
let t0Ses = performance.now(), ganaSes = 0, avisoTgPed3 = false, avisoTgT3 = 0, peleaT3 = 0;
function pausaTg3() { const n = performance.now(); if (enCombate3()) peleaT3 = n; return zonaEn(P.x, P.z) === 'pueblo' || n - Math.max(peleaT3, P.atkT || 0, P.heridoT || 0) >= 30000; }
const avisoTg3 = iniciarAvisoTg({ mandar, ocupado: () => (!avisoTgPed3 && !pausaTg3()) || hayVentana() || $('v-diario').classList.contains('on') || !!loginPend3 || !!document.querySelector('#dq-regalo.on') || !!document.querySelector('#tira-diario.on') || !yo || enCombate3() || !!(yo && yo.muerto) || !yo.clase || (P && (P.muerto || performance.now() - (P.heridoT || 0) < 6000)) || (!avisoTgPed3 && (performance.now() - t0Ses < 60000 || ganaSes < 3 || invasion3 || invPre3 || !!document.querySelector('#tarjeta-bautizo,#probar-clase,#dq-noche'))) || (ventanaAutoT !== avisoTgT3 && Date.now() - ventanaAutoT < 30000) || !!cineEst, aviso: (t, k) => aviso(t, k, 1), tg: TG, alAbrir: () => { for (const k in teclas) teclas[k] = false; atkMantener = false; } });
const oroAmigo =() => premioAmigo(nivelAmigo).oro.toLocaleString('es', { useGrouping: 'always' });
// WhatsApp primero fuera de Telegram (es lo que mas se usa en Peru). El jugador decide
// enviar: solo se abre WhatsApp con el texto listo. El enlace va a /jugar/ (elige 2D o 3D).
const TXT_WA = 'Oe, juega conmigo Duende Quest, gratis en el celular. Entra con mi link y cuando llegues a nivel 10 los dos ganamos oro 👇';
const waLink = (txt, url) => 'https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url);
// Momento -> imagen de la historia (assets/promo/historia_N.jpg): 1 el duende, 2 la fortaleza, 3 el combate.
const IMG_PRESUMIR = { nivel: 1, look: 1, nv60: 2, cofre: 2, invasion: 2, botin: 3, logro: 3, duelo: 3, jefe: 3 };
let presumirTipo = '', presumirUlt = 0, presumirFile = null;
// Web: la imagen del momento se precarga como archivo para la hoja de compartir del sistema
// (Estados de WhatsApp, historias de Instagram/Facebook). Se baja al ofrecer, no al tocar.
const esPremiumTG = () => !!(TG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.is_premium);
function precargarPresumir() {
  presumirFile = null;
  if (TG || !navigator.canShare) return;
  // Equipo modesto o navegador de Facebook/Instagram: no se bajan 110-137 KB; va por wa.me con el enlace.
  if (POBRE || esIAB) return;
  // Look, logro o nivel: foto real de TU duende (9:16 para Estados). Si falla, el JPEG de siempre.
  const turno = ++precargarPresumir.n;
  const ponerFile = bl => {
    if (turno !== precargarPresumir.n || !bl) return false;
    const f = new File([bl], 'duende-quest.jpg', { type: 'image/jpeg' });
    try { presumirFile = navigator.canShare({ files: [f] }) ? f : null; } catch (e) { presumirFile = null; }
    return !!presumirFile;
  };
  const jpgFijo = () => {
    const url = '/assets/promo/historia_' + (IMG_PRESUMIR[presumirTipo] || 1) + '.jpg';
    fetch(url).then(r => r.ok ? r.blob() : null).then(ponerFile).catch(() => {});
  };
  precargarPresumir.tipo = presumirTipo; precargarPresumir.ts = Date.now();
  if (['look', 'logro', 'nivel', 'jefe', 'duelo', 'cofre', 'botin', 'nv60', 'fail'].includes(presumirTipo)) {
    try { if (fotoPresumir(bl => { if (!ponerFile(bl) && turno === precargarPresumir.n) jpgFijo(); })) return; } catch (e) {}
  }
  jpgFijo();
}
precargarPresumir.n = 0;
// La foto de ese momento ya esta (o se esta armando hace < 4 s): no se pisa con un cuadro posterior.
// Lista solo 90 s: otro jefe o nivel minutos despues lleva foto nueva, no la vieja.
const presumirListo = tipo => !!tipo && tipo === precargarPresumir.tipo && tipo === presumirTipo && Date.now() - (precargarPresumir.ts || 0) < (presumirFile ? 90000 : 4000);
// Foto de TU duende: se dibuja el cuadro y se copia en el MISMO tick (sin preserveDrawingBuffer, que cuesta
// rendimiento), recortada a 9:16 centrada en el duende, con franja y texto abajo. Solo se arma: compartir
// sigue siendo cuando el jugador toca el boton. Devuelve false si no se pudo (va el JPEG de siempre).
function fotoPresumir(cb, lineaFija) {
  const gl = render.getContext && render.getContext();
  if (!gl || (gl.isContextLost && gl.isContextLost())) return false;
  const W = lienzo.width, H = lienzo.height;
  if (!(W > 16 && H > 16)) return false;
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const x = c.getContext('2d'); if (!x) return false;
  // Recorte 9:16 del cuadro (horizontal en PC, casi justo en celular vertical).
  let sw = W, sh = H;
  if (W / H > 9 / 16) sw = Math.round(H * 9 / 16); else sh = Math.round(W * 16 / 9);
  // Retrato de frente (como el probador de skins: camYaw = P.ry): camara a 4,8-9 m delante del duende, solo para
  // este cuadro; se restaura justo despues. En la cueva o si quedaria bajo el suelo/agua, va la camara normal.
  const camPos0 = camara.position.clone(), camQ0 = camara.quaternion.clone();
  let retrato = false;
  try {
    // Distancia segun el recorte (~7 m de alto visibles) y mira 0,45 m bajo los pies: el duende queda en la mitad
    // de arriba (y~150-420 de 960) y la franja de texto (426-620) tapa el suelo, no su cuerpo.
    const kv = (sh / H) * Math.tan((camara.fov || 60) * Math.PI / 360), dR = Math.max(4.8, Math.min(9, 3.55 / Math.max(0.2, kv)));
    const ry = P.ry || 0, rx = P.x + Math.sin(ry) * dR, rz = P.z + Math.cos(ry) * dR, py = P.y || 0, rY = py + 1.3;
    if (!enCueva(P.x) && rY > alturaEn(rx, rz) + 0.5 && rY > aguaEn(rx) + 0.3 && choqueTerreno(P.x, py + 1, P.z, rx, rY, rz) === 1) {
      camara.position.set(rx, rY, rz); camara.lookAt(P.x, py - 0.45, P.z); camara.updateMatrixWorld(true); retrato = true;
    }
  } catch (e) { camara.position.copy(camPos0); camara.quaternion.copy(camQ0); retrato = false; }
  let cx = W / 2;
  try { const v = new THREE.Vector3(P.x, (P.y || 0) + 1, P.z).project(camara); if (v.z < 1 && Math.abs(v.x) <= 1.2) cx = (v.x + 1) / 2 * W; } catch (e) {}
  const sx = Math.max(0, Math.min(W - sw, Math.round(cx - sw / 2))), sy = Math.max(0, Math.round((H - sh) / 2));
  // Con post-proceso (alta) la foto sale igual que la pantalla (resplandor y color); si falla, cuadro directo.
  let hecho = false;
  try {
    if (composer) { try { composer.render(0); hecho = true; } catch (e) {} }
    if (!hecho) { render.setRenderTarget(null); render.render(escena, camara); }
    x.drawImage(lienzo, sx, sy, sw, sh, 0, 0, 540, 960);
  } finally {
    if (retrato) { camara.position.copy(camPos0); camara.quaternion.copy(camQ0); camara.updateMatrixWorld(true); }
  }
  // Franja oscura con la linea de presumir y la firma.
  const linea = lineaFija || lineaPresumir() || '🧝 Duende Quest · ¿Me ganas?';
  x.font = 'bold 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const lineas = []; let act = '';
  for (const tr of linea.split(' · ')) {
    const prueba = act ? act + ' · ' + tr : tr;
    if (act && x.measureText(prueba).width > 500) { lineas.push(act); act = tr; } else act = prueba;
  }
  if (act) lineas.push(act);
  lineas.splice(3);
  const alto = 40 + lineas.length * 40 + 34;
  // Zona segura de Reels/Estados: la franja termina en y=620 (abajo la tapan los botones y la descripcion de la app).
  const FONDO = retrato ? 620 : 960;   // con la camara normal el duende queda al centro: la franja va abajo como antes
  x.fillStyle = 'rgba(8,10,20,0.62)'; x.fillRect(0, FONDO - alto, 540, alto);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  lineas.forEach((l, i) => x.fillText(l, 270, FONDO - alto + 50 + i * 40, 510));
  x.font = '22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.fillText(/^[a-z0-9]{6}$/.test(refAmigo || '') ? location.host + '/jugar/?ref=' + refAmigo : 'duendequest · gratis en el celular', 270, FONDO - 22, 510);   // enlace que se puede escribir (no hay casilla de codigo de amigo; la de 6 letras es Llevar mi duende)
  if (!c.toBlob) return false;
  c.toBlob(bl => { try { cb(bl); } catch (e) {} }, 'image/jpeg', 0.82);
  return true;
}
// 📸 de la fila de gestos: tu duende baila y a los ~600 ms se saca la foto y se comparte
// por el flujo de siempre (hoja del sistema, WhatsApp o copiar; en Telegram, el selector de chats).
// Solo lo dispara el jugador con el boton (dentro de la activacion del toque).
const LINEA_BAILE = '💃 ¡Mi duende baila en Duende Quest! ¿Me ganas?';
let fotoBaileT = 0;
function fotoBaile() {
  if (Date.now() - fotoBaileT < 3000) return;
  fotoBaileT = Date.now();
  mandar({ t: 'gesto', id: 'bailar' });
  try { mostrarGesto(miId, 'bailar'); } catch (e) {}   // la pose sale en la foto aunque el eco tarde o el servidor lo frene (1,5 s)
  setTimeout(() => {
    presumirTxt = LINEA_BAILE; presumirTipo = 'look';
    const turno = ++precargarPresumir.n;   // una precarga vieja no pisa esta foto
    let listo = false;
    const fin = bl => {
      if (listo || turno !== precargarPresumir.n) return; listo = true;
      presumirFile = null;
      if (bl && !TG && navigator.canShare) { try { const f = new File([bl], 'duende-quest.jpg', { type: 'image/jpeg' }); if (navigator.canShare({ files: [f] })) presumirFile = f; } catch (e) { presumirFile = null; } }
      precargarPresumir.tipo = 'look'; precargarPresumir.ts = Date.now();
      compartirYa(false);
    };
    let ok = false;
    try { ok = !TG && !POBRE && fotoPresumir(fin, LINEA_BAILE); } catch (e) { ok = false; }
    if (!ok) fin(null);
  }, 600);
}
// 🎬 Modo cine: oculta el HUD 15 s, el duende baila y la camara orbita lento para grabar
// con la grabacion de pantalla del celular. Sale con cualquier toque/tecla. Solo cliente.
let cineEst = null;
function salirCine() {
  if (!cineEst) return;
  const c = cineEst; cineEst = null; salirCine.t = Date.now();
  clearTimeout(c.tOcultar); clearTimeout(c.tFin); clearTimeout(c.tEsc); clearInterval(c.tBaile);
  document.removeEventListener('pointerdown', c.fuera, true); document.removeEventListener('keydown', c.fuera, true);
  document.body.classList.remove('cine');
  try { const mk = document.getElementById('cine-marca'); if (mk) mk.remove(); } catch (e) {}
  camYaw = c.yaw; camDist = c.dist; camPitch = c.pitch;
}
function modoCine() {
  if (cineEst) return salirCine();
  if (Date.now() - (salirCine.t || 0) < 600) return;   // el toque en 🎬 ya cerro el modo por la escucha de captura: no reabrir
  if (!yo || P.muerto) return;
  let peligro = camCombate;
  try { for (const o of mons.values()) if (!o.muereT && o.hp > 0 && (o.st === 1 || o.st === 2) && Math.hypot(o.x - P.x, o.z - P.z) < 14) { peligro = true; break; } } catch (e) {}
  if (peligro) return aviso('Aléjate de los monstruos para grabar', 'err', 1);
  const c = cineEst = { on: false, yaw: camYaw, dist: camDist, pitch: camPitch, t0: performance.now() };
  camDist = 5.5; camPitch = 0.18;   // camara cercana y baja: el duende llena el video (salirCine la devuelve)
  aviso('Activa la grabación 🎥 · en 2 s se ocultan los botones · toca la pantalla para volver', 'ok', 1);
  if (!refAmigo) mandar({ t: 'amigos' });   // el enlace de la marca llega antes de ocultar el HUD
  // Sin once: una tecla de captura (Shift, Ctrl, Impr Pant...) no corta la grabacion; salirCine quita las escuchas.
  c.fuera = e => { if (e && e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey || /^(Shift|Control|Alt|Meta|OS|PrintScreen)$/.test(e.key))) return; try { e.stopPropagation(); e.preventDefault(); } catch (er) {} salirCine();
    // El toque que cierra no debe pulsar el boton que reaparece debajo (ataque, menu...).
    if (e && e.type === 'pointerdown') { const tragar = ev => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', tragar, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', tragar, true), 500); } };
  c.tOcultar = setTimeout(() => {
    if (cineEst !== c) return;
    c.on = true;
    document.body.classList.add('cine');
    { const dn = $('dq-noche'); if (dn) dn.remove(); }   // la tarjeta «Listo por hoy» no sale en el video
    mandar({ t: 'gesto', id: 'bailar' });
    try { mostrarGesto(miId, 'bailar'); } catch (e) {}
    // Baile continuo solo en pantalla (no se manda 'gesto' al servidor cada vez). Solo renueva la pose:
    // mostrarGesto sonaria 'clic' cada 2,4 s en el video y podria disparar otra fiesta con los cercanos.
    c.tBaile = setInterval(() => { if (cineEst !== c) return; try { const mo = P.fig && P.fig.modelo; if (mo) { mo.gesto = 'bailar'; mo.gestoT = performance.now(); } } catch (e) {} }, 2400);
    // Marca con el enlace del jugador: queda en el video que comparte.
    try {
      const vieja = document.getElementById('cine-marca'); if (vieja) vieja.remove();
      const mk = document.createElement('div'); mk.id = 'cine-marca';
      mk.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(16% + env(safe-area-inset-top));z-index:99;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;padding:6px 12px;border-radius:12px;font:700 14px var(--sans);white-space:nowrap;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis';
      mk.textContent = 'Duende Quest · ' + (/^[a-z0-9]{6}$/.test(refAmigo || '') ? location.host + '/jugar/?ref=' + refAmigo : 'gratis en el celular');
      document.body.appendChild(mk);
    } catch (e) {}
    c.tFin = setTimeout(() => {
      if (cineEst !== c) return;
      salirCine();
      if (/^[a-z0-9]{6}$/.test(refAmigo || '')) aviso('🎬 ¡Listo! Sube tu video con tu enlace ' + location.host + '/jugar/?ref=' + refAmigo, 'ok', 1);
    }, 15000);
  }, 2000);
  // Escucha la salida un poco despues, para no salir con el mismo toque del boton.
  c.tEsc = setTimeout(() => {
    if (cineEst !== c) return;
    document.addEventListener('pointerdown', c.fuera, true);
    document.addEventListener('keydown', c.fuera, true);
  }, 300);
}
// Tope: una oferta cada 3 min (si no, cansa). forzar: la pidio el jugador.
function ofrecerPresumir(txt, tipo, forzar) {
  // Prioridad: una hazana mayor reemplaza a una menor aunque no hayan pasado 3 min (el jefe tapa al nivel
  // que subiste al matarlo; un fallo gracioso nunca tapa un logro de verdad).
  const PRIO = { fail: 0, logro: 1, nivel: 1, look: 1, duelo: 2, botin: 2, cofre: 2, jefe: 3, invasion: 3, nv60: 3 };
  const pNuevo = PRIO[tipo] ?? 1, pAnt = PRIO[ofrecerPresumir.tipo || ''] ?? 1;
  const gana = !!tipo && pNuevo > pAnt;
  if (!forzar && !gana && Date.now() - presumirUlt < 180000) return;
  if (!forzar && yo && yo.nivel < 4 && !(yo.mis && yo.mis.i >= 1)) return;   // no tapa el tutorial
  presumirUlt = Date.now(); ofrecerPresumir.tipo = tipo || '';
  presumirTxt = txt || ''; if (tipo !== undefined) presumirTipo = tipo || '';
  if (!refAmigo) mandar({ t: 'amigos' });
  const b = $('presumir3'); if (!b) return;
  if (!presumirListo(presumirTipo)) precargarPresumir();
  if (!TG) b.textContent = (navigator.canShare ? '📲 Presúmelo (WhatsApp, Instagram…)' : '📲 Presúmelo por WhatsApp') + ' · ganan los dos +' + oroAmigo() + ' oro';
  else b.textContent = esPremiumTG() && (TG.platform === 'android' || TG.platform === 'ios') ? '📸 Presúmelo en tu historia · +' + oroAmigo() + ' oro' : '📨 Presúmelo a un amigo · ganan los dos +' + oroAmigo() + ' oro';
  const rj = $('res-jefe');
  if (rj && rj.style.display !== 'none' && rj.style.opacity !== '0') { b.style.display = 'none'; return; }   // la tarjeta del jefe ya trae su boton Presumir
  b.style.display = 'block'; clearTimeout(ofrecerPresumir.t);
  ofrecerPresumir.t = setTimeout(() => { b.style.display = 'none'; }, 12000);
}
// Enlace de Mini App directo (startapp=r_codigo, lo lee ref3). Apagado hasta que el dueño active la
// Main Mini App del bot en BotFather; mientras, va el start=m3d_ de siempre.
const TG_STARTAPP_OK = false;
window.TG_STARTAPP_OK = TG_STARTAPP_OK;   // el bestiario (ventanas.js) arma el enlace igual que compartir()
// Pelea con jefe: inicio al fijarlo como objetivo (pintarBarra) y fin al morir (md3). Solo para presumir el tiempo.
const jefeIni = new Map();
let jefeUlt = null;
function marcaJefeIni() {
  if (!objetivo || jefeIni.has(objetivo)) return;
  const o = mons.get(objetivo), dj = o && MONSTRUOS[o.k];
  if (!o || !(o.j || (dj && dj.jefe))) return;
  if (jefeIni.size > 20) jefeIni.clear();
  jefeIni.set(objetivo, performance.now());
  if (o.k === 'jefe_sabueso') paso('jefe1_ver');
  if (o.k === 'jefe_rey' && !cuevaSes.rey) { cuevaSes.rey = 1; paso('cueva_rey_ve'); }
  try { presentarJefe(o.k); } catch (e) {}
}
// La primera vez que fijas a cada jefe (por personaje): cartel no modal 2,5 s con su nombre,
// su linea de lore y la clave para no morir. No tapa toques (pointer-events:none).
// Cueva de los Goblins: avisos que ensenan (una vez por sesion cada sala) y embudo.
const cuevaSes = { rey: 0, magos: 0, trono: 0 };
function avisosSalaCueva(lx, z) {
  if (!cuevaSes.magos && lx >= -15 && lx <= 15 && z >= 91 && z <= 118) { cuevaSes.magos = 1; aviso('🔮 Los magos disparan de lejos: acércate y acaba con ellos primero (un silencio les corta la magia)', undefined, 2); }
  if (!cuevaSes.trono && lx >= 35 && z > 84) { cuevaSes.trono = 1; aviso('👑 El Rey: sal del círculo rojo de sus pisotones. Al 50 % llama a 2 guardias y al 25 % se enfurece', undefined, 2); }
}
// Primera conquista de la Cueva: cartel dorado no modal, botin epico y presumir.
function primeraCueva(m) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:50%;top:calc(var(--tg-top,0px) + 70px);transform:translateX(-50%);z-index:7;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 16px;border-radius:14px;border:1px solid rgba(255,216,74,.8);background:rgba(12,14,28,.9);color:#fff;font:600 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:none;transition:opacity .4s';
  const l1 = document.createElement('div'); l1.style.cssText = 'color:#ffd84a;font-weight:900;font-size:22px;letter-spacing:.5px;line-height:1.15'; l1.textContent = '👑 ¡Primera conquista de la Cueva!'; d.append(l1);
  const l2 = document.createElement('div'); l2.style.cssText = 'margin-top:4px;color:#e9d5ff'; l2.textContent = 'Premio extra: una pieza Épica (no gasta tus 3 cofres del día)'; d.append(l2);
  document.body.appendChild(d);
  try { vib('heavy'); } catch (e) {}
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }, 3500);
  setTimeout(() => {
    try { if (m.item && !m.item.vendido) botinFuerte(m.item); } catch (e) {}
    setTimeout(() => { try { ofrecerPresumir('¡Conquisté la Cueva de los Goblins en Duende Quest 3D!', 'jefe'); } catch (e) {} }, 2500);
  }, 1500);
}
function presentarJefe(k) {
  const dj = MONSTRUOS[k]; if (!dj || !dj.jefe || !yo) return;
  const clave = 'dq3_jefevisto_' + clavePj() + '_' + k;
  try { if (localStorage.getItem(clave)) return; localStorage.setItem(clave, '1'); } catch (e) { return; }
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:50%;top:calc(var(--tg-top,0px) + 70px);transform:translateX(-50%);z-index:7;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 16px;border-radius:14px;border:1px solid rgba(255,90,90,.7);background:rgba(12,14,28,.88);color:#fff;font:600 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:none;transition:opacity .4s';
  const l1 = document.createElement('div'); l1.style.cssText = 'color:#ff6b6b;font-weight:900;font-size:22px;letter-spacing:.5px;line-height:1.15'; l1.textContent = '☠ ' + (dj.nombre || k) + (dj.nivel ? ' · Nv ' + dj.nivel : '');
  d.append(l1);
  if (LORE_MONSTRUOS[k]) { const l2 = document.createElement('div'); l2.style.cssText = 'font-style:italic;opacity:.9;margin-top:3px;color:#e9d5ff'; l2.textContent = LORE_MONSTRUOS[k]; d.append(l2); }
  const l3 = document.createElement('div'); l3.style.cssText = 'color:#ffd84a;font-weight:800;margin-top:4px'; l3.textContent = '⭕ Esquiva el círculo rojo'; d.append(l3);
  document.body.appendChild(d);
  vib('heavy'); sfxK(k === 'jefe_sabueso' ? 'c_aullido' : 'c_roar', 0.6);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }, 2500);
}
function finJefe(id) {
  const t0 = jefeIni.get(id); jefeIni.delete(id);
  if (t0) jefeUlt = { dur: performance.now() - t0, t: Date.now() };
}
// Resumen personal al vencer un jefe (servidor: 'resJefe'): tarjeta no modal 8 s con tu aporte,
// puesto, tiempo, pisotones esquivados y medalla. «Presumir» solo comparte si el jugador lo toca.
function resumenJefe(m) {
  if (m.k === 'jefe_sabueso') paso('jefe1_ok');
  const nom = String(m.n || (MONSTRUOS[m.k] || {}).nombre || 'el jefe').replace(/[<>]/g, '').slice(0, 40);
  const puesto = m.puesto | 0, de = Math.max(puesto, m.de | 0);
  const seg = Math.round((+m.ms || 0) / 1000);
  const t = seg > 0 && seg < 3600 ? Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0') : '';
  const je = window.dqJefeEsq, a = je ? je.ok | 0 : 0, b = je ? je.tot | 0 : 0;
  if (je) { je.ok = 0; je.tot = 0; }
  const medalla = puesto === 1 ? 'Martillo 🔨' : b > 0 && a === b ? 'Muro 🛡' : 'Equipo 🤝';
  const partes = [nom + ' vencido', 'Tu aporte ' + Math.max(0, Math.min(100, m.parte | 0)) + ' %'];
  if (puesto) partes.push('puesto ' + puesto + ' de ' + de);
  if (t) partes.push(t);
  let d = $('res-jefe');
  if (!d) {
    d = document.createElement('div'); d.id = 'res-jefe';
    d.style.cssText = 'position:fixed;left:50%;top:calc(64px + var(--tg-top,0px));transform:translateX(-50%);z-index:7;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 14px;border-radius:14px;border:1px solid rgba(255,216,74,.6);background:rgba(12,14,28,.88);color:#fff;font:600 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:auto;transition:opacity .4s';
    document.body.appendChild(d);
  }
  d.textContent = '';
  const l1 = document.createElement('div'); l1.style.cssText = 'color:#ffe600;font-weight:800;font-size:14px;margin-bottom:3px'; l1.textContent = '🏆 ' + medalla;
  const l2 = document.createElement('div'); l2.textContent = partes.join(' · ');
  d.append(l1, l2);
  if (b > 0) { const l3 = document.createElement('div'); l3.style.cssText = 'opacity:.85;font-size:12px;margin-top:2px'; l3.textContent = 'Esquivaste ' + a + '/' + b; d.append(l3); }
  const bt = document.createElement('button');
  bt.style.cssText = 'margin-top:8px;padding:7px 16px;min-height:34px;border-radius:999px;border:0;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;font:700 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer';
  bt.textContent = 'Presumir 📣';
  bt.onclick = ev => {
    ev.stopPropagation();
    d.style.display = 'none'; const p3 = $('presumir3'); if (p3) p3.style.display = 'none';
    presumirTxt = bt.dataset.txt || '¡Vencí a ' + nom + ' en Duende Quest' + (puesto ? ': puesto ' + puesto + ' de ' + de : '') + '!';
    // La foto del jefe ya se armo al caer (md3) o al salir la tarjeta: no se borra justo antes de compartir.
    if (!presumirListo('jefe')) { presumirTipo = 'jefe'; try { precargarPresumir(); } catch (e) {} }
    compartirYa(true);
  };
  d.append(bt);
  if (!presumirListo('jefe')) { presumirTipo = 'jefe'; try { precargarPresumir(); } catch (e) {} }
  d.onclick = () => { d.style.display = 'none'; };
  d.style.opacity = '1'; d.style.display = 'block';
  { const p3 = $('presumir3'); if (p3) p3.style.display = 'none'; }   // la tarjeta ya trae su boton Presumir
  clearTimeout(resumenJefe.t); clearTimeout(resumenJefe.t2);
  resumenJefe.t = setTimeout(() => { d.style.opacity = '0'; resumenJefe.t2 = setTimeout(() => { d.style.display = 'none'; }, 450); }, 8000);
  // Reto de jefe: tu tiempo (del servidor) va en el enlace que compartes; si traias un reto y lo superaste,
  // se destaca y se ofrece devolverlo. Solo se comparte si el jugador toca el boton.
  if (seg > 0 && seg < 3600) { resumenJefe.seg = seg; resumenJefe.ts = Date.now(); }
  const reto = retoJefeVigente();
  if (reto && seg >= 1 && seg < reto) {
    const lr = document.createElement('div'); lr.style.cssText = 'color:#4ade80;font-weight:800;font-size:15px;margin-bottom:4px';
    lr.textContent = '¡Superaste a tu pana! (' + fmtRetoJefe(seg) + ' vs ' + fmtRetoJefe(reto) + ')';
    d.prepend(lr);
    try { localStorage.removeItem('dq_reto_jefe'); } catch (e) {}
    clearTimeout(resumenJefe.t); clearTimeout(resumenJefe.t2);
    resumenJefe.t = setTimeout(() => { d.style.opacity = '0'; resumenJefe.t2 = setTimeout(() => { d.style.display = 'none'; }, 450); }, 12000);
    bt.dataset.txt = '¡Le gané el reto a mi pana: vencí a ' + nom + ' en ' + fmtRetoJefe(seg) + '! ¿Lo haces más rápido?';
    try { ofrecerPresumir(bt.dataset.txt, 'jefe', true); } catch (e) {}
  }
}
const EMOJI_CLASE = { guerrero: '🛡️', mago: '🔮', sacerdote: '✨', picaro: '🗡️' };
// Linea corta para presumir con lo que ya sabe el cliente (texto plano, nombre saneado).
function lineaPresumir() {
  if (!yo) return '';
  const p = [];
  const nom = String(yo.nombre || '').replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ _.-]/g, '').trim().slice(0, 16);
  if (nom) p.push('🧝 ' + nom);
  if (yo.nivel) p.push('Nv ' + yo.nivel + (EMOJI_CLASE[yo.clase] ? ' ' + EMOJI_CLASE[yo.clase] : ''));
  const racha = yo.login && yo.login.racha | 0;
  if (racha > 0) p.push('🔥 racha ' + racha + (racha === 1 ? ' día' : ' días'));
  const nl = Array.isArray(yo.logros) ? yo.logros.length : 0;
  if (nl > 0) p.push('🏆 ' + nl + (nl === 1 ? ' logro' : ' logros'));
  if (jefeUlt && Date.now() - jefeUlt.t < 60000) { const s = Math.round(jefeUlt.dur / 1000); p.push('⚔️ jefe en ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); }
  return p.length ? p.join(' · ') + ' · ¿Me ganas?' : '';
}
// Reto de jefe (?rj=SEGUNDOS desde /jugar/): se guarda 7 dias; solo un numero, nada mas de la URL.
const fmtRetoJefe = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function retoJefeVigente() {
  try {
    const r = JSON.parse(localStorage.getItem('dq_reto_jefe') || 'null');
    if (r && (r.s | 0) >= 1 && (r.s | 0) <= 3599 && Date.now() - (+r.f || 0) < 7 * 864e5) return r.s | 0;
    if (r) localStorage.removeItem('dq_reto_jefe');
  } catch (e) {}
  return 0;
}
try {
  const rjm = location.search.match(/[?&]rj=(\d{1,4})(&|$)/), rjs = rjm ? parseInt(rjm[1], 10) : 0;
  if (rjs >= 1 && rjs <= 3599) localStorage.setItem('dq_reto_jefe', JSON.stringify({ s: rjs, f: Date.now() }));
} catch (e) {}
// Segundos del ultimo jefe para el enlace (?rj=): el del servidor (resumenJefe) o el medido aqui.
function segRetoJefe() {
  let s = resumenJefe.seg && Date.now() - (resumenJefe.ts || 0) < 600000 ? resumenJefe.seg : 0;
  if (!s && jefeUlt && Date.now() - jefeUlt.t < 600000) s = Math.round(jefeUlt.dur / 1000);
  return s >= 1 && s <= 3599 ? s | 0 : 0;
}
function compartir(historia) {
  const enl ='https://t.me/duendequest_bot' + (refAmigo ? (TG_STARTAPP_OK ? '?startapp=r_' : '?start=m3d_') + refAmigo : '');
  // Si la hazana ya reta (termina en ? o !), la linea no repite «¿Me ganas?». Con hazana, cola corta.
  const yaReta = /[?!][\s️\p{Extended_Pictographic}]*$/u.test(presumirTxt || '');
  const linea0 = lineaPresumir(), linea = yaReta ? linea0.replace(/ · ¿Me ganas\?$/, '') : linea0, pre = linea ? linea + '\n' : '';
  const COLA_CORTA = 'Entra gratis con mi link: a nivel 10 los dos ganamos oro 👇';
  const txt = pre + (presumirTxt ? presumirTxt + ' ' : '') + (presumirTxt && refAmigo ? COLA_CORTA : refAmigo ? 'Oe, entra con mi link a Duende Quest (gratis en Telegram): recibes oro y pociones de bienvenida, y a nivel 10 ganamos +' + oroAmigo() + ' de oro los dos 👇' : '¡Juega gratis conmigo a Duende Quest 3D en Telegram! 🧝');
  const img = location.origin + '/assets/promo/historia_' + (IMG_PRESUMIR[presumirTipo] || 1 + Math.floor(Math.random() * 3)) + '.jpg';
  const premium = esPremiumTG();
  try {
    // Sin Premium el enlace de la historia queda como texto que no se toca (y se pierde el ref):
    // entonces va al selector de chats, que si lleva el enlace bueno.
    if (historia && TG && TGV('7.8') && TG.shareToStory && premium && (TG.platform === 'android' || TG.platform === 'ios')) {
      TG.shareToStory(img, { text: txt, widget_link: { url: enl, name: 'Jugar gratis' } });
      return;
    }
    if (TG && TG.openTelegramLink) return TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(enl) + '&text=' + encodeURIComponent(txt));
  } catch (e) {}
  const web = location.origin + '/jugar/?' + (refAmigo ? 'ref=' + refAmigo + '&' : '') + 'utm_source=whatsapp&s=wa&de=3d' + (presumirTipo === 'jefe' && segRetoJefe() ? '&rj=' + segRetoJefe() : '');
  const txtWa =pre + (presumirTxt ? presumirTxt + ' ' : '') + (presumirTxt && refAmigo ? COLA_CORTA : TXT_WA).replace('ganamos oro', 'ganamos +' + oroAmigo() + ' de oro');
  // Hoja de compartir del sistema con la imagen (Estados, historias). Si falla (no si cancela), WhatsApp.
  try {
    if (presumirFile && navigator.canShare && navigator.canShare({ files: [presumirFile] })) {
      // Instagram, Facebook y WhatsApp en iPhone descartan el texto junto a la imagen:
      // el enlace se copia antes (dentro del gesto) y en iOS se comparte sin archivo.
      try { if (navigator.clipboard) navigator.clipboard.writeText(txtWa + ' ' + web).then(() => aviso('🔗 Enlace copiado: pégalo en tu historia o mensaje para que tu amigo entre contigo.', 'ok'), () => {}); } catch (e) {}
      const esIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const datos = esIos ? { text: txtWa, url: web } : { files: [presumirFile], text: txtWa + ' ' + web };
      navigator.share(datos).catch(e => { if (e && e.name !== 'AbortError' && !window.open(waLink(txtWa, web), '_blank')) try { navigator.clipboard.writeText(txtWa + ' ' + web).then(() => aviso('Texto y enlace copiados: pégalos en WhatsApp.', 'ok'), () => {}); } catch (e2) {} });
      return;
    }
  } catch (e) {}
  // Si el navegador bloquea la ventana (el enlace llego tarde del servidor), se copia el texto.
  if (!window.open(waLink(txtWa, web), '_blank')) try { navigator.clipboard.writeText(txtWa + ' ' + web).then(() => aviso('Texto y enlace copiados: pégalos en WhatsApp.', 'ok'), () => {}); } catch (e) {}
}
// Boton Atras coherente (v327): cierra la ventana de ARRIBA, no todas, y nunca saca del juego por sorpresa.
// En la web (Chrome Android, navegador de Facebook...) cada ventana abierta deja una entrada en el historial;
// en Telegram el Atras se ve siempre y, sin ventanas, vuelve al menu de la Mini App en vez de cerrarla.
const NO_ATRAS = ['v-muerte', 'v-clase', 'v-error', 'v-inicio'];   // la de error no: dejaba el mundo congelado
let pilaV = [], histV = false, ignorarPop = 0, tgAtras = false;
function actualizarPila() {
  const abiertas = [...document.querySelectorAll('.modal.on, #dq-regalo.on, #dq-avtg.on')].map(m => m.id).filter(id => id && !NO_ATRAS.includes(id));
  pilaV = pilaV.filter(id => abiertas.includes(id));
  for (const id of abiertas) if (!pilaV.includes(id)) pilaV.push(id);   // la ultima abierta queda arriba
}
function sincroAtras() {
  actualizarPila();
  if (TG) return;
  if (pilaV.length && !histV && !ignorarPop) { try { history.pushState({ dqv: 1 }, ''); histV = true; } catch (e) {} }
  else if (!pilaV.length && histV) {
    // Cerrada con su ✕: se retira la entrada para que el Atras no "gaste" un toque en vacio.
    histV = false;
    if (history.state && history.state.dqv) { ignorarPop++; setTimeout(() => { ignorarPop = 0; }, 800); try { history.back(); } catch (e) { ignorarPop = 0; } }
  }
}
function pedirSincroAtras() { clearTimeout(pedirSincroAtras.t); pedirSincroAtras.t = setTimeout(sincroAtras, 60); }   // con retraso: cerrar una y abrir otra no toca el historial
// tarjetas de regalo y aviso de Telegram no pasan por abrir(): vigilar su clase para dejar/quitar la entrada del historial
try { const vigiladas = new WeakSet(); const vigilar = () => { for (const id of ['dq-regalo', 'dq-avtg']) { const el = document.getElementById(id); if (el && !vigiladas.has(el)) { vigiladas.add(el); new MutationObserver(pedirSincroAtras).observe(el, { attributes: true, attributeFilter: ['class'] }); if (el.classList.contains('on')) pedirSincroAtras(); } } }; new MutationObserver(vigilar).observe(document.body, { childList: true }); vigilar(); } catch (e) {}
function atrasVentana() {
  const id = pilaV[pilaV.length - 1];
  if (!id || !$(id) || !$(id).classList.contains('on')) return false;
  if (id === 'v-pago') { aviso('Cierra el pago con su ✕ (así no se pierden tus datos).', 'err', 1); return true; }
  if (id === 'dq-regalo') { try { regalo3.cerrar(); } catch (e) {} return true; }   // tarjeta de compra: Atras la cierra (marca vista)
  if (id === 'dq-avtg') { try { avisoTg3.cerrarAtras(); } catch (e) {} return true; }
  if (id === 'v-look' && typeof cerrarLook === 'function') cerrarLook(false); else cerrar(id);
  return true;
}
if (!TG) addEventListener('popstate', () => {
  if (ignorarPop > 0) { ignorarPop--; return; }   // el retroceso lo pidio sincroAtras: no es del jugador
  if (!histV) return;
  histV = false;   // antes de cerrar: si no, cerrar() pediria otro history.back (doble retroceso)
  actualizarPila(); atrasVentana(); pedirSincroAtras();   // si quedan ventanas, vuelve a dejar su entrada
});
function revisarAtrasTg() {
  sincroAtras();
  if (!TG || !TG.BackButton || !TGV('6.1') || tgAtras) return;
  tgAtras = true;
  try { TG.BackButton.show(); } catch (e) {}
}
let atrasTgT = 0;   // Atrás de Telegram sin ventanas: el primer toque solo avisa, el segundo sale al menú
if (TG && TG.BackButton) try {
  /* Sin alerta de cierre: el progreso va al servidor y el doble toque de Atrás ya evita salidas por error */
  try { if (TGV('6.2') && TG.disableClosingConfirmation) TG.disableClosingConfirmation(); } catch (e) {}
  TG.BackButton.onClick(() => {
    if (document.querySelector('#dq-regalo.on')) { try { regalo3.cerrar(); } catch (e) {} return; }
    if (document.querySelector('#dq-avtg.on')) { try { avisoTg3.cerrarAtras(); } catch (e) {} return; }
    if (cineEst) { salirCine(); return; }
    actualizarPila();
    if (atrasVentana()) return revisarAtrasTg();
    if ([...document.querySelectorAll('.modal.on')].some(m => NO_ATRAS.includes(m.id) && m.id !== 'v-inicio')) return;   // muerte, clase o error: se resuelven en su ventana
    const ah = Date.now();
    if (ah - atrasTgT > 2500) { atrasTgT = ah; const tx = 'Toca Atrás otra vez para salir al menú'; avisoVisto.delete(tx); aviso(tx, 'ok', 1); return; }   // sin el filtro de 8 s: cada primer toque se ve
    if (OBJ.despedida(() => { location.href = '/telegram/index.html' + hashTg; })) return;
    location.href = '/telegram/index.html' + hashTg;
  });
} catch (e) {}
// ── HERMANDADES (las "guilds") ──
let hermInfo = null, hermSalirT = 0, hermAb = null, hermAbPedT = 0;
const RANGO_H = { lider: '👑 Líder', oficial: '⭐ Oficial', miembro: 'Miembro' };
function pintarHerm() {
  if (!$('v-herm').classList.contains('on') || !yo) return;
  const c = $('herm-c'), h = hermInfo;
  if (!h) {
    const puede = yo.nivel >= HERM_NIVEL, nomPrev = $('herm-nombre') ? $('herm-nombre').value : '';
    c.innerHTML = `<p class="vv-p">Una hermandad es tu clan: chat propio (<b>/h</b> mensaje), su nombre bajo el tuyo, la <b>gesta semanal</b> con premios para todos y su puesto en el ranking de hermandades.</p>
      <p class="vv-p">Fundar una cuesta <b style="color:#ffd84a">${HERM_COSTO.toLocaleString('es')} oro</b> y pide nivel ${HERM_NIVEL}. También puedes esperar a que un líder u oficial te invite (desde tu marco).</p>
      ${puede ? `<input id="herm-nombre" maxlength="20" placeholder="Nombre de la hermandad" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--borde);background:rgba(0,0,0,.4);color:#fff;margin:6px 0">
      <button class="btn" id="herm-crear" style="width:100%">Fundar hermandad</button>` : `<p class="vv-p" style="color:#f87171">Llega al nivel ${HERM_NIVEL} para fundar una.</p>`}`;
    // Al repintar (llega la lista de abiertas) no se borra el nombre a medio escribir.
    if (nomPrev && $('herm-nombre')) $('herm-nombre').value = nomPrev;
    // Hermandades abiertas: entrar con un toque, sin conocer a nadie.
    if (Date.now() - hermAbPedT > 8000) { hermAbPedT = Date.now(); mandar({ t: 'hermAbiertas' }); }
    const ab = `<p class="vv-p" style="margin-top:4px"><b>🔓 Hermandades que buscan gente</b></p>` + (!hermAb ? '<p class="vv-p" style="font-size:12px">Cargando…</p>'
      : hermAb.length ? '<div class="herm-lista">' + hermAb.map(x => `<div class="hm ${x.on ? 'on' : ''}"><span class="pt"></span><b style="color:${HERM_COLORES[x.c] || '#4ade80'}">${esc(x.n)}</b><small>${x.m}/${HERM_MAX} · ${(x.p || 0).toLocaleString('es')} pts${x.on ? ' · hay gente conectada' : ''}</small><span class="acc"><button data-hu="${esc(x.id)}" style="font-size:13px;padding:4px 10px">Unirme</button></span></div>`).join('') + '</div>'
      : '<p class="vv-p" style="font-size:12px">Ahora ninguna está abierta. Vuelve más tarde o funda la tuya.</p>');
    c.insertAdjacentHTML('beforeend', ab);
    c.querySelectorAll('[data-hu]').forEach(b => b.onclick = () => { mandar({ t: 'hermUnirse', id: b.dataset.hu }); b.disabled = true; b.textContent = '…'; setTimeout(() => { b.disabled = false; b.textContent = 'Unirme'; }, 3000); });
    return;
  }
  const yoM = h.m.find(x => x.uid === yo.pid) || {}, r = yoM.r, mando = r === 'lider' || r === 'oficial', col = HERM_COLORES[h.color] || '#4ade80';
  const g = h.gesta || { p: 0 }, sig = GESTA_UMBRALES.findIndex(u => g.p < u), tope = GESTA_UMBRALES[GESTA_UMBRALES.length - 1], mio = (g.c && g.c[yo.pid]) || 0;
  const on = h.m.filter(x => x.on).length;
  let s = `<p class="vv-p" style="font-size:15px"><b style="color:${col}">&lt;${esc(h.nombre)}&gt;</b> · ${h.m.length}/${HERM_MAX} miembros · <span style="color:var(--ok)">${on} conectados</span></p>`;
  s += `<p class="vv-p" style="font-style:italic">📜 ${h.motd ? esc(h.motd) : 'Sin mensaje del día.'}</p>`;
  if (mando) s += `<div style="display:flex;gap:4px;margin:4px 0 8px"><input id="herm-motd" maxlength="140" placeholder="Mensaje del día" value="${esc(h.motd || '')}" style="flex:1;min-width:0;padding:6px;border-radius:8px;border:1px solid var(--borde);background:rgba(0,0,0,.4);color:#fff"><button class="btn" id="herm-motd-b" style="padding:6px 10px;font-size:12px">Guardar</button></div>`;
  s += `<p class="vv-p">🏆 <b>Gesta semanal</b>: ${g.p.toLocaleString('es')} puntos${sig >= 0 ? ` · siguiente premio <b style="color:#ffd84a">${GESTA_NOMBRES[sig]}</b> a ${GESTA_UMBRALES[sig].toLocaleString('es')}` : ' · ¡<b style="color:#ffd84a">Oro</b> conseguido!'}</p>
    <p class="vv-p" style="font-size:12px">Tu aporte: <b style="color:${mio >= GESTA_MIN ? 'var(--ok)' : 'var(--warn)'}">${mio}</b>${mio < GESTA_MIN ? ` · cobras el oro desde ${GESTA_MIN} puntos` : ' · ya cobras el oro de cada premio'} (con un día en la hermandad). Suman monstruos de tu nivel, jefes, mazmorras y peces.</p>
    <div class="barra" style="height:10px;margin:2px 0 8px"><i style="transform:scaleX(${Math.min(1, g.p / tope).toFixed(3)})"></i></div>`;
  // Aporte de cada miembro a la gesta (mismo id publico que g.c[yo.pid]).
  const ptsH = x => (g.c && g.c[x.uid]) || 0;
  const top3 = h.m.filter(x => ptsH(x) > 0).sort((a, b) => ptsH(b) - ptsH(a)).slice(0, 3);
  if (top3.length) s += `<p class="vv-p" style="font-size:12px">⭐ Más aportes esta semana: ${top3.map(x => esc(x.n)).join(', ')}</p>`;
  if (mando) s += `<label class="vv-p" style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin:4px 0 8px"><input type="checkbox" id="herm-abierta" ${h.abierta ? 'checked' : ''} style="width:20px;height:20px">🔓 Abierta a todos <small style="color:var(--txt3)">(cualquiera entra con un toque)</small></label>`;
  if (r === 'lider') s += `<div class="herm-cols">${HERM_COLORES.map((cc, i) => `<button data-hc="${i}" style="background:${cc}" class="${i === (h.color | 0) ? 'on' : ''}" aria-label="Color ${i + 1}"></button>`).join('')}</div>`;
  s += '<div class="herm-lista">' + h.m.slice().sort((a, b) => ptsH(b) - ptsH(a)).map(x => {
    const cl = CLASES[x.cl], soy = x.uid === yo.pid;
    let acc = '';
    if (!soy && r === 'lider') acc += x.r === 'miembro' ? `<button data-hr="oficial" data-u="${x.uid}" title="Ascender a oficial">⬆</button>` : x.r === 'oficial' ? `<button data-hr="miembro" data-u="${x.uid}" title="Bajar a miembro">⬇</button><button data-hr="lider" data-u="${x.uid}" title="Darle el liderazgo">👑</button>` : '';
    if (!soy && mando && x.r !== 'lider' && !(r === 'oficial' && x.r === 'oficial')) acc += `<button data-hx="${x.uid}" title="Expulsar">✕</button>`;
    return `<div class="hm ${x.on ? 'on' : ''}"><span class="pt"></span><b style="color:${cl ? cl.color : '#fff'}">${esc(x.n)}</b><small>Nv ${x.lv} · ${RANGO_H[x.r] || x.r} · <b style="color:${ptsH(x) >= GESTA_MIN ? 'var(--ok)' : '#9ca3af'}">${ptsH(x)} pts</b></small><span class="acc">${acc}</span></div>`;
  }).join('') + '</div>';
  s += `<p class="vv-p" style="font-size:11px">Escribe en el chat <b>/h mensaje</b> para hablar con tu hermandad.</p><button class="btn sec" id="herm-salir" style="width:100%;margin-top:6px">${hermSalirT > Date.now() ? '¿Seguro? Pulsa otra vez para salir' : 'Salir de la hermandad'}</button>`;
  c.innerHTML = s;
  if ($('herm-motd-b')) $('herm-motd-b').onclick = () => mandar({ t: 'hermMotd', m: $('herm-motd').value });
  if ($('herm-abierta')) $('herm-abierta').onchange = e => { mandar({ t: 'hermAbierta', v: e.target.checked ? 1 : 0 }); setTimeout(() => { const k = $('herm-abierta'); if (k && hermInfo) k.checked = !!hermInfo.abierta; }, 2000); };
  c.querySelectorAll('[data-hc]').forEach(b => b.onclick = () => mandar({ t: 'hermColor', i: +b.dataset.hc }));
  c.querySelectorAll('[data-hr]').forEach(b => b.onclick = () => mandar({ t: 'hermRango', uid: b.dataset.u, r: b.dataset.hr }));
  c.querySelectorAll('[data-hx]').forEach(b => b.onclick = () => { if (b.dataset.ok) mandar({ t: 'hermExpulsar', uid: b.dataset.hx }); else { b.dataset.ok = 1; b.textContent = '¿?'; } });
  $('herm-salir').onclick = () => { if (hermSalirT > Date.now()) { hermSalirT = 0; mandar({ t: 'hermSalir' }); } else { hermSalirT = Date.now() + 4000; pintarHerm(); } };
}
// ── AMIGOS Y EN LINEA (como la ventana social del 2D) ──
// Arriba tus amigos (en gris si no estan) y debajo quien esta conectado en
// los dos juegos: invitar al grupo o susurrar sin tenerlo delante.
function pintarAmigos3() {
  if (!$('v-amigos').classList.contains('on')) return;
  const c = $('amigos-c'), lider = !grupo3 || !!(yo && grupo3.lider === yo.pid);
  // Lider u oficial de una hermandad: puede invitar a ella desde aqui (sin tenerlo delante).
  const miRango = hermInfo && yo && ((hermInfo.m || []).find(z => z.uid === yo.pid) || {}).r;
  const invHerm = miRango === 'lider' || miRango === 'oficial';
  const fila = (x, amigo) => {
    const cl = CLASES[x.cl];
    let acc = '';
    if (x.on && x.id && !x.g && lider) acc += `<button data-ai="${x.id}">Invitar</button>`;
    if (x.on && x.id && !x.h && invHerm) acc += `<button data-ah="${x.id}" title="Invitar a tu hermandad">🛡 Hermandad</button>`;
    if (x.on) acc += `<button data-as="${esc(x.n)}">Susurrar</button>`;
    if (amigo) acc += `<button data-aq="${esc(x.uid)}" title="Quitar de amigos">✕</button>`;
    const donde = !x.on ? 'desconectado' : x.m3 ? 'ORIGINS' : 'CLASSIC' + (x.mapa ? ' · ' + x.mapa : '');
    return `<div class="hm ${x.on ? 'on' : ''}"><span class="pt"></span><b style="color:${cl ? cl.color : '#fff'}">${esc(x.n)}</b><small>${x.on ? 'Nv ' + (x.lv | 0) + ' · ' : ''}${esc(donde)}</small><span class="acc">${acc}</span></div>`;
  };
  const tit = t => `<div style="font:700 10px var(--sans);color:var(--txt3);margin:8px 0 3px">${t}</div>`;
  // Los amigos conectados ya salen arriba: no se repiten en la lista de abajo.
  const ids = new Set(contactos3.filter(a => a.on).map(a => a.id));
  const resto = (quien3 || []).filter(x => !ids.has(x.id));
  // Invitar va ARRIBA (en el movil, al fondo no se veia): tarjeta TE INVITO, boton #am-inv y «Mis invitados»; luego AMIGOS y EN LINEA.
  let s = '';
  // «Mis invitados»: quien te invito y los que llegaron con tu enlace, con barra hasta Nv 10.
  const meta = (inv3 && inv3.nivel) || 10, barra = lv => `<div style="height:4px;background:rgba(255,255,255,.12);border-radius:2px;margin:2px 0 4px;overflow:hidden"><div style="height:100%;width:${Math.min(100, Math.round((lv || 0) / meta * 100))}%;background:#4ade80"></div></div>`;
  if (inv3 && inv3.por) s += tit('TE INVITÓ') + `<p class="vv-p" style="font-size:12px">🤝 <b>${esc(inv3.por.n)}</b>: a Nv ${meta} ganan oro los dos. En grupo con tu amigo, +${inv3.bono || 25}% de XP${inv3.por.bono ? ' (activo)' : ''}. Tú: Nv ${inv3.lvYo || 1}/${meta}.</p>` + barra(inv3.lvYo);
  s += `<button class="btn" id="am-inv" style="width:100%;margin-top:8px;background:#25d366;border-color:#25d366;color:#fff">${TG ? '📨 Invitar por Telegram' : '📲 Invitar por WhatsApp'} · ganan los dos +${oroAmigo()} oro</button>`;
  // Escalera de referidos (amigos.js revisarAmigo): al 5.º amigo en Nv 10, la montura; oro por cada uno hasta inv3.max. Solo premios que ya existen.
  if (inv3) {
    const na = inv3.amigos | 0, mx = inv3.max || 20, mont = (MONTURAS.conejo || {}).nombre || 'Conejo Saltarín', meta5 = Math.min(5, mx);
    const pc = na >= meta5 ? Math.min(100, Math.round(na / mx * 100)) : Math.round(na / meta5 * 100);
    s += `<div style="margin-top:8px;padding:8px 10px;border:1px solid rgba(250,204,21,.35);border-radius:8px;background:rgba(250,204,21,.07)">`
      + `<div style="font:700 12px var(--sans)">🏅 Amigos que llegaron a Nv ${meta}: ${na >= meta5 ? Math.min(na, mx) + '/' + mx : na + '/' + meta5}</div>`
      + `<div style="height:6px;background:rgba(255,255,255,.12);border-radius:3px;margin:5px 0;overflow:hidden"><div style="height:100%;width:${pc}%;background:#facc15"></div></div>`
      + `<small style="display:block;color:var(--txt2)">${na >= meta5 ? `✅ ${esc(mont)} ganado.` : `🐇 Al ${meta5}.º amigo: montura ${esc(mont)}.`} 💰 +oro por cada amigo que llegue a Nv ${meta} (${na >= mx ? 'tope alcanzado' : `hasta ${mx}`}).</small></div>`;
  }
  if (inv3) {
    const L = inv3.invitados || [];
    s += tit(`MIS INVITADOS (${L.length})`);
    s += L.length ? '<div class="herm-lista">' + L.map(x => fila({ ...x, lv: x.lv, on: x.on }, false).replace('</small>', `${x.on ? '' : ' · Nv ' + (x.lv || '?')}${x.ok ? ' · ✅ premio' : ''}</small>`) + (x.ok ? '' : barra(x.lv))).join('') + '</div>'
      : '<p class="vv-p" style="font-size:12px">Aún nadie entró con tu enlace. Invita con el botón de arriba: quien llegue recibe un kit de bienvenida y a Nv 10 ganan los dos.</p>';
  }
  // «Jugaste con» (social.js cazaJuntos): con quien cazaste hace poco. ⭐ lo añade a amigos.
  if (inv3 && inv3.recientes && inv3.recientes.length) {
    const misU = new Set(contactos3.map(a => a.uid));
    s += tit(`JUGASTE CON (${inv3.recientes.length})`) + '<div class="herm-lista">' + inv3.recientes.map(x => fila(x, false).replace('<span class="acc">', `<span class="acc">${x.on && x.id && !misU.has(x.uid) ? `<button data-aa="${x.id}" title="Añadir a amigos">⭐</button>` : ''}`)).join('') + '</div>';
  }
  // Amigos que llegaron por el mismo anuncio (sin enlace): se invitan escribiendo el nombre.
  s += tit('INVITAR POR NOMBRE') + `<div style="display:flex;gap:6px"><input id="am-nom" maxlength="24" placeholder="Nombre de tu amigo" autocomplete="off" style="flex:1;min-width:0;font-size:16px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff"><button class="btn" id="am-nom-b" style="white-space:nowrap"${lider ? '' : ' disabled title="Solo el líder del grupo puede invitar"'}>Invitar al grupo</button></div>`
    + `<p class="vv-p" style="font-size:12px;margin-top:4px">Tu nombre es <b>${esc((yo && yo.nombre) || '')}</b>: díselo a tus amigos. Si aceptan tu invitación al grupo, quedan como amigos.</p>`;
  if (lider && (!grupo3 || grupo3.m.length < (grupo3.banda ? 10 : 5))) s += '<button class="btn sec" id="am-glink" style="width:100%;margin-top:6px">📲 Invitar a mi grupo (enlace)</button>';
  s += tit(`AMIGOS (${ids.size}/${contactos3.length})`);
  s += contactos3.length ? '<div class="herm-lista">' + contactos3.map(x => fila(x, true)).join('') + '</div>' : '<p class="vv-p" style="font-size:12px">Aún no tienes amigos: elige a un jugador y pulsa «⭐ Amigo» en su marco. Verás cuándo se conecta.</p>';
  s += tit(`EN LÍNEA${quien3 ? ` (${resto.length})` : ''}`);
  s += !quien3 ? '<p class="vv-p">Cargando…</p>' : resto.length ? '<div class="herm-lista">' + resto.map(x => fila({ ...x, on: 1 }, false)).join('') + '</div>' : `<p class="vv-p" style="font-size:12px">Ahora no hay nadie más conectado${hoy3 > 1 ? `, pero hoy ya jugaron ${hoy3} duendes` : ''}. Invita a un amigo y jueguen juntos.</p>`;
  s += '<button class="btn sec" id="am-act" style="width:100%;margin-top:8px">↻ Actualizar</button>';
  if (c._h === s) return;   // 'grupo' llega cada 500 ms: sin cambios no se rehace (se perdian clics)
  c._h = s;
  const nomA = $('am-nom'), nomV = nomA ? nomA.value : '', nomF = nomA && document.activeElement === nomA;   // el repintado no borra lo que se escribe
  c.innerHTML = s;
  const nomI = $('am-nom'), nomB = $('am-nom-b');
  if (nomI) {
    nomI.value = nomV; if (nomF) nomI.focus();
    const invNom = () => { const v = nomI.value.trim(); if (!v) return aviso('Escribe el nombre de tu amigo.'); mandar({ t: 'invitar', n: v.slice(0, 24) }); nomI.value = ''; nomI.blur(); };
    nomB.onclick = invNom;
    nomI.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') invNom(); };
  }
  c.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => { mandar({ t: 'invitar', p: +b.dataset.ai }); b.disabled = true; });
  c.querySelectorAll('[data-aa]').forEach(b => b.onclick = () => { mandar({ t: 'contactoAdd', p: +b.dataset.aa }); b.disabled = true; });
  c.querySelectorAll('[data-ah]').forEach(b => b.onclick = () => { mandar({ t: 'hermInvitar', p: +b.dataset.ah }); b.disabled = true; });
  c.querySelectorAll('[data-as]').forEach(b => b.onclick = () => { cerrar('v-amigos'); const i = $('chat-in'); i.style.display = 'block'; i.value = '/s ' + b.dataset.as + ' '; i.focus(); });
  c.querySelectorAll('[data-aq]').forEach(b => b.onclick = () => mandar({ t: 'contactoQuitar', uid: b.dataset.aq }));
  $('am-act').onclick = () => { mandar({ t: 'contactos' }); mandar({ t: 'quien' }); mandar({ t: 'amigos' }); };
  const ai = $('am-inv'); if (ai) ai.onclick = () => { presumirTxt = ''; presumirTipo = ''; compartirYa(); };
  const ag = $('am-glink'); if (ag) ag.onclick = invitarGrupoLink;
}
// ── RANKING (general, semana, duelos, hermandades, torre) ──
let rankDatos = null, rankTab = 'sem';
// Tu fila fija del ranking semanal: puesto, a quien pasas y tu liga (premio por tramos).
function textoMioSem(m) {
  const f = n => (n || 0).toLocaleString('es', { useGrouping: 'always' });
  if (!m.pos) return `Tú: aún sin XP esta semana · caza y entra al ranking (con ${f(m.min)} XP ya tienes premio de liga)`;
  let t = `Tú: #${f(m.pos)} de ${f(m.total)}` + (m.arriba ? ` · te faltan ${f(m.arriba.xp - m.xp + 1)} XP para pasar a ${m.arriba.n}` : ' · ¡Vas primero!');
  if (m.liga >= 0) t += ` · Liga ${['Oro', 'Plata', 'Bronce'][m.liga]}${m.tramoTxt ? ' · ' + m.tramoTxt : ''} 🏅`;
  else if (m.pos > 3 && m.xp < m.min) t += ` · ${f(m.min - m.xp)} XP más para entrar a una liga con premio`;
  return t;
}
// Ranking semanal de la Cueva (por clase y tramo de nivel, desde Nv 30).
const mmss = v => Math.floor((v || 0) / 60) + ':' + String((v || 0) % 60).padStart(2, '0');
const pluralClase = k => { const n = (CLASES[k] && CLASES[k].nombre) || 'jugadores'; return /[aeiouáéíóú]$/i.test(n) ? n + 's' : n + 'es'; };
function textoMioCueva(cv) {
  if (!cv) return 'Cargando el ranking de la Cueva…';
  if (cv.bloq) return 'Desde Nv 30 entras al ranking semanal de la Cueva.';
  const grupo = `${pluralClase(cv.k)} ${cv.tramo || ''}`.trim();
  if (!cv.pos) return `Aún sin tiempo esta semana: vence al Rey Goblin en una Cueva de tu tramo y ${cv.tot ? `entra a competir con ${cv.tot} ${grupo}` : `sé el primero entre los ${grupo}`}.`;
  let t = `Eres #${cv.pos} de ${cv.tot} ${grupo} · ${mmss(cv.seg)}`;
  t += cv.arriba ? ` · Te faltan ${mmss(cv.seg - cv.arriba.seg + 1)} para pasar a ${cv.arriba.n}` : ' · ¡Vas primero!';
  return t;
}
function pintarRankPanel() {
  if (!$('v-rank').classList.contains('on')) return;
  const d = rankDatos, c = $('rank-c');
  const tabs = [['sem', 'Semana'], ['abismo', 'Abismo'], ['r', 'Nivel'], ['duel', 'Duelos'], ['herm', 'Hermandades'], ['cueva', 'Cueva']];   // la Torre es de CLASSIC (2D): aqui no se puede subir
  if (rankTab === 'torre') rankTab = 'cueva';
  let s = '<div class="rank-tabs">' + tabs.map(([k, n]) => `<button data-rt="${k}" class="${k === rankTab ? 'on' : ''}">${n}</button>`).join('') + '</div>';
  if (rankTab === 'abismo') s += htmlTemp(temp3 || (d && d.temp));
  else if (!d) { c.innerHTML = s + '<p class="vv-p">Cargando…</p>'; }
  else {
    const fin = d.finSem ? Math.max(0, d.finSem - Date.now()) : 0, dd = Math.floor(fin / 86400000), hh = Math.floor(fin % 86400000 / 3600000);
    if (rankTab === 'sem' && fin) s += `<p class="vv-p">⏳ La semana cierra en <b style="color:#f87171">${dd} d ${hh} h</b>: el top 3 se lleva el gran premio y, desde ${((d.mio && d.mio.min) || 2000).toLocaleString('es', { useGrouping: 'always' })} XP, todos cobran su liga contra los de su nivel${d.mio && d.mio.tramoTxt ? ` (tú: ${d.mio.tramoTxt})` : ''} (Oro top 10 %, Plata 30 %, Bronce el resto).</p>`;
    const cv = rankTab === 'cueva' ? d.cueva : null;
    if (cv && !cv.bloq) s += `<p class="vv-p" style="font-size:12px">⏱ Mejor tiempo de la semana contra el Rey Goblin, solo entre ${esc(pluralClase(cv.k))} ${esc(cv.tramo || '')}. Solo cuentan las partidas en solitario y en una Cueva de tu tramo (en grupo o si te carga alguien, no entra); se reinicia el lunes a medianoche (hora de Lima).</p>`;
    const L = rankTab === 'cueva' ? (cv && cv.top) || [] : d[rankTab] || [];
    const val = x => rankTab === 'cueva' ? `${mmss(x.seg)} · Nv ${x.lv}` : rankTab === 'sem' ? `${(x.xp || 0).toLocaleString('es')} XP` : rankTab === 'r' ? `Nv ${x.lv}` : rankTab === 'duel' ? `Elo ${x.e}` : rankTab === 'herm' ? `${(x.p || 0).toLocaleString('es')} pts · ${x.m} miembros` : `piso ${x.p}`;
    if (!(cv && cv.bloq)) s += '<div class="rank-lista">' + (L.length ? L.map((x, i) => `<div class="rk ${x.yo ? 'yo' : ''}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(x.n)}</b><span>${val(x)}</span></div>`).join('') : '<p class="vv-p">Aún no hay nadie: ¡sé el primero!</p>') + '</div>';
    if (rankTab === 'sem' && d.mio) s += `<div class="rk yo" style="position:sticky;bottom:0;margin-top:6px;display:block;line-height:1.35;background:rgba(30,24,8,.95);border:1px solid rgba(250,204,21,.55);border-radius:8px;padding:8px 10px">${esc(textoMioSem(d.mio))}</div>`;
    if (rankTab === 'cueva') s += `<div class="rk yo" style="position:sticky;bottom:0;margin-top:6px;display:block;line-height:1.35;background:rgba(30,24,8,.95);border:1px solid rgba(250,204,21,.55);border-radius:8px;padding:8px 10px">${esc(textoMioCueva(cv))}</div>`;
    if (rankTab === 'duel') s += `<p class="vv-p" style="font-size:11px">Tu Elo: <b>${d.elo || 1000}</b>. Reta a alguien desde su marco.</p>`;
  }
  c.innerHTML = s;
  c.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { rankTab = b.dataset.rt; if (rankTab === 'abismo') mandar({ t: 'temp3' }); pintarRankPanel(); });
}
// ── RECOMPENSA DIARIA (racha por semanas de 7 dias, sin tope) ──
// "Mañana: <premio>" segun lo ultimo cobrado (yo.login), con el oro de la semana.
function textoManana3() {
  const L = yo && yo.login;
  if (!L || !L.racha) return '';
  const sig = L.racha + 1, pr = premioRacha(sig), d = diaRacha(sig);
  const oro = pr.oro ? Math.round(pr.oro * multLogin(yo.nivel) * multSemanaRacha(sig)) : 0;
  const premio = oro ? oro.toLocaleString('es') + ' oro' + (pr.item !== undefined ? ' + objeto ÉPICO' : '') : pr.txt;
  return d === 7 ? '¡Mañana el cofre ÉPICO! ' + premio : 'Mañana: ' + premio;
}
// «Listo por hoy» (dq3_noche): al cobrar la caza del dia o el 3.er cofre completo de la Cueva, una tarjeta
// pequeña (sin fondo, no bloquea) con 3 motivos para volver mañana. Una vez al dia de Lima; nunca en
// pelea, con ventanas, en modo anuncio ni en modo cine (reintenta cada 5 s, hasta 36 veces = 3 min). Sin red.
// Tambien al completar la 3.a mision (principiante). Si vuelve a pelear, se cierra sola.
function tarjetaNoche3(intento) {
  intento = intento || 0;
  let hoy = ''; try { hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()); } catch (e) { hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); }
  let ya = ''; try { ya = localStorage.getItem('dq3_noche') || ''; } catch (e) {}
  if (ya === hoy || !yo || !yo.clase || modoAnuncio() || $('dq-noche') || (yo.mis && (yo.mis.i || 0) < 4)) return;   // nunca antes de vencer al primer jefe (MISIONES[3]), venga de la caza del dia o de la cueva
  const ahora = performance.now();
  let ocupado = true;
  try {
    ocupado = jefeCerca() || camCombate || autoAtk || !!cineEst || !!loginPend3 || hayVentana() || hayLateral() || $('v-diario').classList.contains('on') || !!$('probar-clase')
      || !!document.querySelector('#tira-diario.on,#dq-regalo.on,#dq-avtg.on') || !!document.querySelector('#ob-sig,#tarjeta-bautizo,#franja-inst,#franja-iab,#tira-comunidad,#cofre-sem,#cofre-meta.on,#probar-clase') || (Date.now() - ventanaAutoT < 45000) || (P && (P.muerto || ahora - (P.heridoT || 0) < 5000 || (objetivo && ahora - (P.atkT || 0) < 5000)));
  } catch (e) { ocupado = true; }
  if (ocupado) { if (intento < 36) { clearTimeout(tarjetaNoche3.t); tarjetaNoche3.t = setTimeout(() => tarjetaNoche3(intento + 1), 5000); } return; }
  try { localStorage.setItem('dq3_noche', hoy); } catch (e) {}
  const fila = (ico, html) => `<div style="display:flex;gap:8px;align-items:flex-start;text-align:left;margin:6px 0;font-size:13px;line-height:1.35"><span style="flex:none">${ico}</span><div style="min-width:0">${html}</div></div>`;
  // 1) el cofre de mañana (+ oferta honesta de recordatorio por Telegram: como mucho uno al dia, solo si no entraste)
  const tgOk = !TG && !tarjetaNoche3.tgYa && !!$('b-avtg');
  const f1 = fila('🎁', esc(textoManana3() || 'Mañana te espera otro cofre diario y una nueva caza del día.')
    + (tgOk ? '<br><a href="#" data-noche="tg" style="color:#7dd3fc;font-size:12px">🔔 ¿Quieres un recordatorio por Telegram? (como máximo uno al día, solo si no entraste)</a>' : ''));
  // 2) la expedicion (misma accion que la fila 🧭 de las misiones)
  let f2 = '';
  if (yo.nivel >= EXPEDICION.nv) {
    const ex = yo.exped, quien = ex && !ex.m ? 'Tu explorador' : 'Tu mascota';
    if (!ex) f2 = fila('🧭', `Manda ${yo.mascota ? 'a tu mascota' : 'un explorador'} de expedición: vuelve con oro y materiales aunque no juegues.<br><button type="button" class="btn sec" data-noche="exp" style="margin-top:4px;padding:5px 10px;font-size:12px">Mandar ahora</button>`);
    else if (ex.fin > Date.now()) {
      let hr = ''; try { hr = new Date(ex.fin).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      const otroDia = (() => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(ex.fin)) !== hoy; } catch (e) { return false; } })();
      f2 = fila('🧭', `${quien} vuelve ${otroDia ? 'mañana ' : 'hoy '}a las <b>${esc(hr)}</b> (hora de Perú) con su botín.`);
    } else f2 = fila('🧭', `${quien} ya volvió con oro y materiales.<br><button type="button" class="btn sec" data-noche="exp" style="margin-top:4px;padding:5px 10px;font-size:12px">Recoger</button>`);
  }
  // 3) la meta mas cercana (logro al 80 % o mas) o lo que falta para el siguiente nivel
  let f3 = '';
  try {
    const c = logrosCasi().sort((a, b) => b.p[0] / b.p[1] - a.p[0] / a.p[1])[0];
    if (c) f3 = fila('🎯', `Casi: <b>${esc(c.L.titulo)}</b> ${c.p[0].toLocaleString('es')}/${c.p[1].toLocaleString('es')}${c.L.oro ? ' · +' + c.L.oro.toLocaleString('es') + ' oro' : ''}`);
  } catch (e) {}
  if (!f3) { const falta = Math.max(1, Math.round((yo.xpSig || xpParaSubir(yo.nivel)) - (Number(yo.xp) || 0))); f3 = fila('⭐', `Te faltan <b>${falta.toLocaleString('es')} XP</b> para Nv ${yo.nivel + 1}`); }
  // 4) invitado: su duende vive solo en este navegador -> guardarlo gratis (y salir del navegador de la app)
  const f4 = soyInvitado ? fila('💾', 'Tu duende vive solo en este navegador.<br><button type="button" class="btn sec" data-noche="cuenta" style="margin-top:4px;padding:5px 10px;font-size:12px">Guardarlo gratis</button>'
    + (esIAB ? ' <button type="button" class="btn sec" data-noche="nav" style="margin-top:4px;padding:5px 10px;font-size:12px">' + (ANDROID_IAB ? 'Abrir en Chrome con mi duende' : 'Pasar a Safari con mi duende') + '</button>' : '')) : '';
  const t = document.createElement('div');
  t.id = 'dq-noche'; ventanaAutoT = Date.now(); t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', 'Listo por hoy');
  t.style.cssText = 'position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top) + var(--tg-top,0px));transform:translateX(-50%);z-index:8;width:min(340px,calc(100vw - 32px));box-sizing:border-box;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,216,74,.55);background:rgba(20,14,34,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.45);color:#fff;text-align:center;font-family:var(--sans);transition:opacity .3s ease;opacity:0';
  t.innerHTML = `<b style="display:block;font-size:15px;color:#ffd84a;margin-bottom:2px">🌙 ¡Buen trabajo hoy!</b>${OBJ.ganchoHtml()}${f1}${f2}${f3}${f4}<button type="button" class="btn" data-noche="ok" style="width:100%;margin-top:6px">Seguir jugando</button>`;
  const cerrarN = () => { clearTimeout(t._t); clearInterval(t._i); t.style.opacity = 0; setTimeout(() => t.remove(), 320); };
  t.onclick = e => {
    const b = e.target.closest && e.target.closest('[data-noche]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.noche;
    if (a === 'cuenta') { cerrarN(); irACrearCuenta(); return; }
    if (a === 'nav') { cerrarN(); irANavegador(); return; }
    cerrarN();
    if (a === 'exp') { try { V.abrirExpedicion(); } catch (er) {} }
    else if (a === 'tg') { try { $('b-avtg').click(); } catch (er) {} }   // la misma oferta del boton «Avísame» (no avisa nada sin aceptar en el bot)
  };
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = 1; });
  t._t = setTimeout(cerrarN, 20000);   // si no la toca, se va sola
  // si vuelve a pelear (le pegan o ataca), se quita sola para no estorbar
  t._i = setInterval(() => {
    if (!t.isConnected) { clearInterval(t._i); return; }
    const n = performance.now();
    if (P && (n - (P.heridoT || 0) < 1500 || n - (P.atkT || 0) < 1500)) { clearInterval(t._i); cerrarN(); }
  }, 1000);
  try { sfxK('libro', 0.2); } catch (e) {}
}
// Movil: en vez de la ventana, una tira arriba (~56 px) con las 7 bolitas de la
// semana y lo de mañana; dura 5 s (8 s los dias 6 y 7) y al tocarla abre el panel.
// Espera a que no haya ventanas abiertas (bienvenida, tutorial, clase...).
// «Esta noche» (antes de las 19:00 de Lima): solo texto, avisa de la Hora Feliz y la Gran Invasion.
function estaNoche3(p) {
  const hL = new Date(Date.now() - 5 * 3600e3).getUTCHours();
  if (hL < 6 || hL >= 19) return '';
  const tx = '🌙 Esta noche: ⚡ Hora Feliz 20:00 · 🥁 Gran Invasión 21:00' + (p ? ' (hora de Perú)' : '');
  return p ? `<p class="vv-p" style="margin-top:6px;font-size:12px;opacity:.75">${tx}</p>` : `<small style="opacity:.75">${tx}</small>`;
}
// Novedades (data.js NOVEDADES): el parche nuevo que este jugador aun no vio. Al novato (< Nv 3) no se le
// muestra: se marca como visto para que no le salga despues algo viejo.
function novPendiente() { try { const vis = +localStorage.getItem('dq_3d_nov') || 0; const nv = NOVEDADES[0]; if (!nv || nv.n <= vis || !yo) return null; if ((yo.nivel || 1) < 3) { localStorage.setItem('dq_3d_nov', String(nv.n)); return null; } return nv; } catch (e) { return null; } }
function textoNov(nv, max) { const s = String((nv && (nv.gancho || (nv.items || [])[0])) || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s; }
function verNovedades() {
  let vis = 0; try { vis = +localStorage.getItem('dq_3d_nov') || 0; localStorage.setItem('dq_3d_nov', String(NOVEDADES[0].n)); } catch (e) {}
  const ps = NOVEDADES.filter(p => p.n > vis).slice(0, 2);
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;   // el cierre automatico del premio diario no cierra las novedades
  $('diario-c').innerHTML = (ps.length ? ps : NOVEDADES.slice(0, 1)).map(p => `<h3 style="margin:6px 0 4px;color:#c084fc">✨ Novedades · ${esc(p.fecha || '')}</h3><ul style="margin:0 0 8px;padding-left:18px">${p.items.slice(0, 3).map(x => `<li class="vv-p" style="margin:4px 0">${esc(x)}</li>`).join('')}</ul>`).join('');
  $('v-diario').querySelector('h2').textContent = 'NOVEDADES';
  abrir('v-diario');
}
function tiraDiario(m, n) {
  if ((hayVentana() || hayLateral() || !!$('probar-clase')) && (n || 0) < 40) { setTimeout(() => tiraDiario(m, (n || 0) + 1), 1500); return; }
  let t = $('tira-diario');
  if (!t) {
    t = document.createElement('div'); t.id = 'tira-diario'; t.setAttribute('role', 'button');
    document.body.appendChild(t);
    t.onclick = ev => { const mm = tiraDiario.m; t.classList.remove('on'); clearTimeout(tiraDiario.t); if (ev && ev.target && ev.target.closest && ev.target.closest('[data-tnov]')) { try { verNovedades(); } catch (e) {} return; } if (ev && ev.target && ev.target.closest && ev.target.closest('[data-ttemp]')) { try { V.abrirTiendaTemp(); } catch (e) {} return; } if (mm) mostrarDiario(mm, true); };
  }
  tiraDiario.m = m;
  const dHoy = diaRacha(m.racha), sem = semanaRacha(m.racha);
  let b = '';
  for (let i = 1; i <= 7; i++) b += `<i class="${i < dHoy ? 'ya' : i === dHoy ? 'hoy' : ''}${i === 7 ? ' cofre' : ''}"></i>`;
  const hoyTxt = m.oro ? '+' + m.oro.toLocaleString('es') + ' oro' : m.txt || 'premio';
  let tpTxt = ''; try { const tp = yo ? fiestaYo() : null; if (tp) tpTxt = `<small data-ttemp="1" style="color:${tp.color};font-weight:700;padding:4px 0">${tp.emoji} ${esc(tp.nombre)} · toca aquí para ver el calendario</small>`; } catch (e) {}
  let novTxt = ''; try { const nv = novPendiente(); if (nv) novTxt = `<small data-tnov="1" style="color:#c084fc;font-weight:700;padding:4px 0">✨ Nuevo: ${esc(textoNov(nv, 70))} · toca para ver más</small>`; } catch (e) {}
  t.innerHTML =`<div class="dias7 mini">${b}</div><div class="tx"><b>☀ Día ${dHoy}${sem > 1 ? ' · Semana ' + sem : ''}: ${esc(hoyTxt)}${m.itemNom ? ' · ' + esc(m.itemNom) : ''}</b><small>${m.amuUsado ? '🧿 Tu protector salvó tu racha · ' : ''}${m.amuRegalo ? '🧿 Protector de regalo · ' : ''}${m.pase ? '+' + m.pase + ' al pase del mes · ' : ''}🧿 Protectores: ${m.amu || 0} · ${esc(textoManana3() || '')}${(m.hitos || []).length ? ' · 🏅 ' + esc(m.hitos.join(', ')) : ''}</small>${expVolvio() ? '<small style="color:#4ade80;font-weight:700">🧭 ' + (yo.exped.m ? 'Tu mascota' : 'Tu explorador') + ' volvió de la expedición · toca para recoger</small>' : ''}${tpTxt}${estaNoche3()}${novTxt}</div>`;
  t.classList.add('on');
  vib('success'); sfxK('monedas', 0.4);
  clearTimeout(tiraDiario.t);
  tiraDiario.t = setTimeout(() => t.classList.remove('on'), dHoy >= 6 || expVolvio() ? 8000 : 5000);
}
// Expedicion en la bienvenida (expediciones.js): si ya volvio, Recoger (y repetir) aqui mismo;
// si va en camino, cuanto falta; si no hay y ya tiene nivel, un boton para mandarla.
const expVolvio = () => !!(yo && yo.exped && yo.exped.fin <= Date.now());
function bloqueExpedDiario() {
  if (!yo || !yo.clase || yo.nivel < EXPEDICION.nv) return '';
  const ex = yo.exped;
  if (!ex) return '<p class="vv-p" style="margin-bottom:8px"><button class="btn sec" data-dexp="abrir" style="width:100%">Manda a tu mascota 🧭</button></p>';
  const ms = ex.fin - Date.now();
  if (ms > 0) return `<p class="vv-p" style="margin-bottom:8px;font-size:12px">🧭 Tu expedición vuelve en <b>${ms >= 3600000 ? Math.ceil(ms / 3600000) + ' h' : Math.max(1, Math.ceil(ms / 60000)) + ' min'}</b>.</p>`;
  const rep = EXPEDICION.horas.includes(ex.h) ? `<button class="btn sec" data-dexp="rep" style="flex:1;min-width:130px">🔁 Recoger y repetir (${ex.h} h)</button>` : '';
  return `<div data-dexpcaja="1" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.45)"><p class="vv-p" style="margin-bottom:6px">🧭 <b>${ex.m ? 'Tu mascota' : 'Tu duendecillo explorador'} volvió de la expedición</b> con oro y materiales.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-dexp="rec" style="flex:1;min-width:100px">Recoger</button>${rep}</div></div>`;
}
function clicExpedDiario(e) {
  const b = e.target.closest('[data-dexp]'); if (!b) return;
  e.stopPropagation();
  const a = b.dataset.dexp;
  if (a === 'abrir') { clearTimeout(mostrarDiario.t); mostrarDiario.t = 0; cerrar('v-diario'); V.abrirExpedicion(); return; }
  mandar(a === 'rep' ? { t: 'exped', recoger: 1, repetir: 1 } : { t: 'exped', recoger: 1 });
  vib('success'); sfxK('monedas', 0.4);
  const caja = b.closest('[data-dexpcaja]'); if (caja) caja.innerHTML = `<p class="vv-p">🧭 ¡Recogida!${a === 'rep' ? ' Ya salió otra vez.' : ''}</p>`;
}
// Panel lateral que se cierra solo: lo de hoy, la racha y lo que espera mañana.
function mostrarDiario(m, forzar) {
  if (yo && m.racha) yo.login = { ...(yo.login || {}), racha: m.racha, amu: m.amu || 0 };   // para "Mañana" antes de que llegue el yo nuevo
  if (COMPACTO && !m.vuelta && !forzar) { tiraDiario(m); return; }
  if ($('v-diario').classList.contains('on') && !mostrarDiario.t) { setTimeout(() => mostrarDiario(m, forzar), 2000); return; }   // no pisa la leyenda
  const n = LOGIN_PREMIOS.length, hoy = diaRacha(m.racha), sem = semanaRacha(m.racha);
  let h = bloqueExpedDiario();
  try { const tp = yo ? temporadaDe() : null; if (tp) h += `<p class="vv-p" id="vv-temp" style="margin-bottom:8px;padding:8px;border-radius:10px;cursor:pointer;color:${tp.color};background:rgba(255,255,255,.06);border:1px solid ${tp.color}">${tp.emoji} <b>${esc(tp.nombre)}</b> hasta el ${esc(tp.hasta)} · ${esc(textoTemp3(tp).txt)}${(() => { const px = proxTemp3(); return px && tp.fin - Date.now() < 3 * 86400000 ? `<br><small style="color:${px.color}">Luego: ${px.emoji} ${esc(px.nombre)} desde el ${esc(fechaTemp3(px.ini))}</small>` : ''; })()}<br><small style="color:#e8e8f0">Toca aquí para ver el puesto de la Abuela ›</small></p>`; } catch (e) {}
  h += m.amuUsado ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(125,211,252,.12);border:1px solid rgba(125,211,252,.45)">🧿 <b>Tu protector salvó tu racha</b>: faltaste un día y no la perdiste.</p>` : '';
  h += m.amuRegalo ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(125,211,252,.12);border:1px solid rgba(125,211,252,.45)">🧿 <b>Protector de regalo</b>: si un día no puedes entrar, salva tu racha.</p>` : '';
  h += m.vuelta ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(255,216,74,.12);border:1px solid rgba(255,216,74,.4)">🎉 <b>¡Te echábamos de menos!</b> ${m.vuelta.dias} días fuera. Regalo de bienvenida: <b>+${m.vuelta.oro.toLocaleString('es')} oro</b>, ${m.vuelta.pociones} pociones y <b>${esc(m.vuelta.item)}</b>.</p>` : '';
  h += `<p class="vv-p" style="margin-bottom:8px">¡Día <b style="color:#ffd84a">${m.racha}</b> de tu racha${sem > 1 ? ` (semana ${sem}, oro x${String(multSemanaRacha(m.racha)).replace('.', ',')})` : ''}! Recibes <b>${m.oro && /oro/.test(m.txt || '') ? m.oro.toLocaleString('es') + ' oro' : esc(m.txt || '')}</b>${m.oro && !/oro/.test(m.txt || '') ? ` (+${m.oro.toLocaleString('es')} oro)` : ''}${m.itemNom ? `: <b>${esc(m.itemNom)}</b>` : ''}.</p><div class="dias7">`;
  for (let i = 1; i <= n; i++) {
    const pr = LOGIN_PREMIOS[i - 1];
    h += `<div class="d7 ${i < hoy ? 'ya' : i === hoy ? 'hoy' : ''}"><small>Día ${i}</small><span>${i === n ? '🎁' : pr.item !== undefined ? '⚔️' : pr.oro ? '🪙' : '🧪'}</span><em>${esc(pr.txt)}</em></div>`;
  }
  h += '</div>' + (m.hitos || []).map(x => `<p class="vv-p" style="margin-top:8px;color:#ffd84a">🏅 <b>¡Hito de racha!</b> Ganaste ${esc(x)}.</p>`).join('');
  h += `<p class="vv-p" style="margin-top:10px;font-size:12px"><b style="color:#7dd3fc">${esc(textoManana3() || 'Mañana: ' + premioRacha(m.racha + 1).txt)}</b>. Si faltas un día, un protector 🧿 la salva; sin protector, o si faltas más, retrocedes (como mucho al inicio de tu semana): las semanas cumplidas no se pierden.${m.pase ? ` Entrar sumó <b>+${m.pase}</b> al pase del mes.` : ''}</p><p class="vv-p" style="margin-top:6px;font-size:12px">🧿 Protectores: <b>${m.amu || 0}</b> (te regalamos uno al empezar cada semana de racha, entrando seguido, si no te queda ninguno, y otro con el bono semanal; máximo 2)</p>` + estaNoche3(1);
  $('diario-c').innerHTML = h;
  $('diario-c').onclick = clicExpedDiario;
  const vt = $('vv-temp');
  if (vt) vt.onclick = e => { e.stopPropagation(); clearTimeout(mostrarDiario.t); mostrarDiario.t = 0; cerrar('v-diario'); try { V.abrirTiendaTemp(); } catch (er) {} };
  $('v-diario').querySelector('h2').textContent = m.vuelta ? '¡BIENVENIDO DE VUELTA!' : 'RECOMPENSA DIARIA';
  abrir('v-diario'); vib('success'); sfxK('monedas', 0.4);
  clearTimeout(mostrarDiario.t);
  mostrarDiario.t = setTimeout(() => { mostrarDiario.t = 0; cerrar('v-diario'); }, 12000);
}
// ── PASE DE TEMPORADA (gratis, se reinicia cada mes) ──
function nivelesPaseListos() {
  const pa = yo && yo.pase;
  if (!pa || pa.mes !== paseMes()) return 0;
  const nv = Math.floor(pa.p / PASE.porNivel);
  let k = 0;
  for (let i = 1; i <= nv; i++) if (!pa.cob.includes(i)) k++;
  return k;
}
function marcaPase() {
  const b = $('b-pase'); if (!b) return;
  const k = nivelesPaseListos();
  b.dataset.n = k ? String(k) : '';
  const mas = $('b-mas'); if (mas) mas.dataset.n = k ? String(k) : '';
}
function pintarPase() {
  marcaPase();
  if (!$('v-pase').classList.contains('on') || !yo) return;
  const pa = yo.pase && yo.pase.mes === paseMes() ? yo.pase : { p: 0, cob: [] };
  const nv = Math.min(PASE.niveles, Math.floor(pa.p / PASE.porNivel)), resto = pa.p % PASE.porNivel;
  const pm = paseMes(), fin = Date.UTC(+pm.slice(0, 4), +pm.slice(5, 7), 1, 5);   // 1 del mes siguiente, 00:00 de Lima
  const dias = Math.max(0, Math.ceil((fin - Date.now()) / 86400000));
  let h = `<p class="vv-p">Nivel <b style="color:#ffd84a">${nv}</b> de ${PASE.niveles} · quedan <b style="color:#f87171">${dias} días</b> de temporada.</p>
    <div class="barra" style="height:12px;margin:6px 0 4px"><i style="transform:scaleX(${nv >= PASE.niveles ? 1 : (resto / PASE.porNivel).toFixed(3)})"></i></div>
    <p class="vv-p" style="font-size:11px;color:var(--txt3)">${nv >= PASE.niveles ? '¡Pase completo!' : `${resto} / ${PASE.porNivel} puntos para el nivel ${nv + 1}`} · Puntos: misión diaria +${PASE.puntos.diaria}, semanal +${PASE.puntos.semanal}, jefe mundial +${PASE.puntos.mundial}, mazmorra +${PASE.puntos.mazmorra}${PASE.puntos.exped ? ', expedición +' + PASE.puntos.exped : ''}.</p><div class="pase-lista">`;
  for (let i = 1; i <= PASE.niveles; i++) {
    const pr = premioPase(i, yo.nivel), cob = pa.cob.includes(i), listo = i <= nv && !cob;
    h += `<div class="pase-n ${cob ? 'ya' : listo ? 'listo' : ''} ${i % 5 === 0 ? 'gordo' : ''}"><b>${i}</b><span>${esc(pr.txt)}</span>${listo ? `<button class="btn" data-pase="${i}">Cobrar</button>` : cob ? '<i>✔</i>' : '<i>🔒</i>'}</div>`;
  }
  $('pase-c').innerHTML = h + '</div>';
  $('pase-c').querySelectorAll('[data-pase]').forEach(b => b.onclick = () => { mandar({ t: 'pase', n: +b.dataset.pase }); vib('success'); sfxK('monedas', 0.35); b.disabled = true; });
}
function hayVentana() { return [...document.querySelectorAll('.modal.on')].some(m => !LATERALES.includes(m.id)); }
function hayLateral() { return LATERALES.some(id => $(id) && $(id).classList.contains('on')); }
// ── TECLAS REASIGNABLES (PC; Ajustes → Teclas; 'dq3_teclas', por dispositivo) ──
// MAPA_T traduce tecla fisica -> tecla de fabrica. Siempre es una permutacion: al coger una tecla ocupada,
// la otra accion se queda con la que quedo libre, asi ninguna accion se pierde.
const ACC_T = [['KeyW', 'Adelante'], ['KeyS', 'Atrás'], ['KeyA', 'Izquierda'], ['KeyD', 'Derecha'], ['Space', 'Saltar'], ['KeyX', 'Esquivar'], ['Tab', 'Cambiar objetivo (con Mayús, al revés)'], ['Digit1', 'Atacar'],
  ...[2, 3, 4, 5, 6, 7, 8, 9].map(n => ['Digit' + n, 'Habilidad ' + (n - 1)]), ['KeyQ', 'Consumible 1'], ['KeyF', 'Consumible 2'], ['KeyG', 'Consumible 3'], ['KeyT', 'Consumible 4'],
  ['KeyE', 'Hablar'], ['KeyV', 'Volar'], ['KeyC', 'Bajar volando'], ['KeyY', 'Montura'], ['KeyM', 'Mapa'], ['KeyO', 'Metas'], ['KeyI', 'Inventario'], ['KeyP', 'Libro'], ['KeyL', 'Logros']];
const MAPA_T = (() => { try { const m = JSON.parse(localStorage.getItem('dq3_teclas') || '{}'), k = Object.keys(m), v = Object.values(m); if (m && typeof m === 'object' && !Array.isArray(m) && v.every(x => typeof x === 'string') && new Set(v).size === k.length && v.every(x => k.includes(x))) return m; } catch (e) {} return {}; })();
let capturaT = null, tMayus = 0;
function mayusEsquiva() { if (tMayus) { clearTimeout(tMayus); tMayus = 0; esquivar(); } }
function fisicaDe(v) { for (const f in MAPA_T) if (MAPA_T[f] === v) return f; return v; }
function nomTecla(c) { return c === 'Space' ? 'Espacio' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? 'Num ' + c.slice(6) : ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Semicolon: 'Ñ', Comma: ',', Period: '.', Minus: '-' })[c] || c; }
function rotuloT(v) { return nomTecla(fisicaDe(v)); }
function pintarRotulosT() { document.querySelectorAll('[data-vt]').forEach(el => { el.textContent = el.dataset.vt.split(',').map(rotuloT).join(''); }); }
function pintarTeclas() {
  const c = $('lista-teclas'); if (!c) return;
  c.innerHTML = ACC_T.map(([v, n]) => `<div class="fila"><span>${n}</span><b><button type="button" class="btn sec" data-cambia="${v}" style="padding:4px 10px;font-size:12px;min-width:64px">${capturaT === v ? 'Pulsa una tecla…' : esc(rotuloT(v))}</button></b></div>`).join('')
    + '<p style="margin:8px 0 0"><button type="button" class="btn sec" id="b-teclas-reset" style="width:100%">Volver a las teclas de fábrica</button></p>';
  c.querySelectorAll('[data-cambia]').forEach(b => b.onclick = () => { capturaT = b.dataset.cambia; pintarTeclas(); });
  $('b-teclas-reset').onclick = () => { for (const f in MAPA_T) delete MAPA_T[f]; capturaT = null; guardarTeclas(); };
}
function guardarTeclas() { try { if (Object.keys(MAPA_T).length) localStorage.setItem('dq3_teclas', JSON.stringify(MAPA_T)); else localStorage.removeItem('dq3_teclas'); } catch (e) {} for (const k in teclas) teclas[k] = false; pintarTeclas(); pintarRotulosT(); }
// Escape cancela. No se pueden usar las que ya tienen otro papel fijo (Esc, Enter del chat, Mayus de volar) ni las del navegador.
addEventListener('keydown', e => {
  if (!capturaT) return;
  if (!$('v-ayuda').classList.contains('on')) { capturaT = null; return; }
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  if (e.code === 'Escape') { capturaT = null; pintarTeclas(); return; }
  if (/^(Enter|NumpadEnter|Shift\w+|Control\w+|Alt\w+|Meta\w+|OS\w+|CapsLock|ContextMenu|F\d+|)$/.test(e.code)) { aviso('Esa tecla no se puede usar: elige otra.', 'err'); return; }
  const v = capturaT, antes = fisicaDe(v), otra = MAPA_T[e.code] || e.code;
  capturaT = null;
  if (antes !== e.code) {
    MAPA_T[e.code] = v; MAPA_T[antes] = otra;
    for (const f of [e.code, antes]) if (MAPA_T[f] === f) delete MAPA_T[f];
    const pisada = ACC_T.find(a => a[0] === otra);
    if (pisada) aviso(`⌨️ ${pisada[1]} pasa a la tecla ${nomTecla(antes)}.`, 'ok');
  }
  guardarTeclas();
}, true);
if ($('b-teclas')) {
  if (MOVIL) $('fila-teclas').style.display = 'none';
  $('b-teclas').onclick = () => { const c = $('lista-teclas'), ver = c.style.display === 'none'; c.style.display = ver ? '' : 'none'; capturaT = null; if (ver) pintarTeclas(); };
}
pintarRotulosT();
addEventListener('keydown', e => {
  const cod = MAPA_T[e.code] || e.code;   // tecla reasignada -> la de fabrica
  if (chatAbierto()) {
    if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) enviarChat(v); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    return;
  }
  // Tarjeta de un PNJ abierta: Espacio/Enter/E siguen, Escape salta (o cierra en la ultima burbuja).
  const nd = $('npc-dice');
  const escribiendo = e.target && e.target.matches && (e.target.matches('input,textarea,select') || e.target.isContentEditable);
  if (nd && nd.classList.contains('on') && !escribiendo && ['Space', 'Enter', 'NumpadEnter', 'KeyE', 'Escape'].includes(cod)) {
    e.preventDefault();
    if (nd.contains(document.activeElement)) document.activeElement.blur();   // sin doble clic nativo del boton enfocado
    if (e.repeat) return;
    const sa = nd.querySelector('.nd-saltar');
    if (e.code === 'Escape' && sa && sa.style.display !== 'none') sa.click();
    else { const sg = nd.querySelector('.nd-seguir'); if (sg) sg.click(); }
    return;
  }
  if (hayVentana()) {
    if (e.key === 'Escape' && $('v-look').classList.contains('on')) return cerrarLook(false);
    if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(m => { if (!['v-clase', 'v-muerte', 'v-inicio', 'v-error', 'v-pago'].includes(m.id)) cerrar(m.id); });   // la de pago solo con su ✕ (no se pierden los datos)
    if (cod === 'KeyM' && $('v-mapa').classList.contains('on')) cerrar('v-mapa');
    for (const [k, id] of [['KeyI', 'v-inv'], ['KeyP', 'v-libro'], ['KeyL', 'v-logros'], ['KeyO', 'v-obj']]) if (cod === k && $(id) && $(id).classList.contains('on')) cerrar(id);
    return;
  }
  if (hayLateral()) {
    // Con un panel lateral abierto se sigue jugando; Escape o su tecla lo cierran.
    if (e.key === 'Escape') { LATERALES.forEach(id => { if ($(id) && $(id).classList.contains('on')) cerrar(id); }); return; }
    let cerro = false;
    for (const [k, id] of [['KeyI', 'v-inv'], ['KeyP', 'v-libro'], ['KeyL', 'v-logros'], ['KeyO', 'v-obj']]) if (cod === k && $(id) && $(id).classList.contains('on')) { cerrar(id); cerro = true; }
    if (cerro) return;
  }
  teclas[cod] = true;
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();   // aunque esten reasignadas: el navegador no mueve el foco ni desplaza
  if (cod === 'Space') { e.preventDefault(); if (!e.repeat) saltar(); }
  if (cod === 'Tab') { e.preventDefault(); clearTimeout(tMayus); tMayus = 0; if (!e.repeat) fijarCiclo(e.shiftKey); }
  if ((cod === 'Digit1' || cod === 'KeyZ') && !e.repeat) { atkMantener = true; golpeManual(); }
  const nh = /^Digit([2-9])$/.exec(cod);
  if (nh && !e.repeat) usarHab(misHabs[+nh[1] - 2]);
  if (cod === 'KeyX' && !e.repeat && !P.vuela && !P.planea) esquivar();
  // Mayus espera un instante (o a soltarla): si llega Tab es Mayus+Tab y no esquiva.
  if ((cod === 'ShiftLeft' || cod === 'ShiftRight') && !e.repeat && !P.vuela && !P.planea) { clearTimeout(tMayus); tMayus = setTimeout(mayusEsquiva, 130); }   // Q ya es habilidad; Mayus solo baja volando/planeando
  if (cod === 'KeyY' && !e.repeat) montar();
  if (cod === 'KeyV' && !e.repeat) volar();
  const i = { KeyQ: 0, KeyF: 1, KeyG: 2, KeyT: 3 }[cod];
  if (i !== undefined && !e.repeat) usarPoder(i);
  if (cod === 'KeyE' && !e.repeat) hablar();
  if (cod === 'KeyM' && !e.repeat) abrirMapa();
  if (cod === 'KeyO' && !e.repeat) OBJ.alternar();
  if (cod === 'KeyI' && !e.repeat) V.abrirInventario();
  if (cod === 'KeyP' && !e.repeat) V.abrirLibro();
  if (cod === 'KeyL' && !e.repeat) V.abrirLogros();
  if (cod === 'Enter') { e.preventDefault(); $('chat-in').style.display = 'block'; $('chat-in').focus(); }
  if (e.code === 'Escape') { objetivo = 0; objetivoP = 0; autoAtk = false; pintarBarra(); pintarGrupo(); }
});
addEventListener('blur', () => { atkMantener = false; clearTimeout(tMayus); tMayus = 0; });
addEventListener('keyup', e => { const cod = MAPA_T[e.code] || e.code; teclas[cod] = false; if (cod === 'Digit1' || cod === 'KeyZ') atkMantener = false; if (cod === 'ShiftLeft' || cod === 'ShiftRight') mayusEsquiva(); if (cod === 'Space' && !P.vuela && P.vy > 0) P.vy *= 0.55; });   // salto corto si sueltas pronto
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; arrastre = null; tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; });
$('chat-in').addEventListener('keydown', e => e.stopPropagation(), true);
// Enviar: Enter, el boton ➤ o el "Enviar" del teclado del movil (en Android
// la tecla llega como keyCode 229 y no como Enter: el submit del form si llega).
function enviarInputChat() { const i = $('chat-in'), v = i.value.trim(); if (v) enviarChat(v); i.value = ''; i.blur(); i.style.display = 'none'; }
$('chat-f').addEventListener('submit', e => { e.preventDefault(); enviarInputChat(); });
$('chat-in').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); enviarInputChat(); return; }
  if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
});

// Raton: arrastrar gira la camara; un clic (sin arrastre) elige objetivo.
let arrastre = null;
lienzo.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  soltarAtkRaton();   // un arrastre anterior sin pointerup no deja atkMantener pegado
  arrastre = { x: e.clientX, y: e.clientY, mov: 0 };
  lienzo.setPointerCapture(e.pointerId);
  // Mantener el clic izquierdo quieto con un monstruo (o rival de duelo/Abismo) al alcance sigue pegando, como mantener 1/Z.
  if (e.button === 0) { const a = arrastre; a.tAtk = setTimeout(() => { if (arrastre === a && a.mov < 6 && (blancoCercano() || rivalP())) { a.atk = true; atkMantener = true; golpeManual(); } }, 220); }
});
lienzo.addEventListener('pointermove', e => {
  if (!arrastre || e.pointerType === 'touch') return;
  if (!(e.buttons & 3)) { soltarAtkRaton(); arrastre = null; return; }   // el boton ya se solto (alt-tab, dialogo...)
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.mov += Math.abs(dx) + Math.abs(dy);
  if (arrastre.mov >= 6) soltarAtkRaton();   // ya es arrastre de camara: deja de pegar
  camYaw -= dx * 0.006; camPitch = clamp(camPitch + dy * 0.004, 0.08, 1.25);
  if (dx || dy) camArrastreT = performance.now();
});
lienzo.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  const mantuvo = !!(arrastre && arrastre.atk);
  soltarAtkRaton();
  if (arrastre && arrastre.mov < 6) {
    const om = elegirEn(e.clientX, e.clientY, e.detail >= 2);
    // Clic izquierdo sobre un monstruo al alcance: lo marca y le pega ya (golpeManual respeta la cadencia).
    if (!mantuvo && om && e.button === 0 && !om.muereT && Math.hypot(om.x - P.x, om.z - P.z) <= rangoAtaque(om)) golpeManual();
  }
  arrastre = null;
});
lienzo.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') return; soltarAtkRaton(); arrastre = null; });
// Corta el "mantener clic para pegar" del raton (y su temporizador) sin tocar el de ATACAR/1/Z.
function soltarAtkRaton() {
  if (!arrastre) return;
  clearTimeout(arrastre.tAtk);
  if (arrastre.atk) { arrastre.atk = false; atkMantener = false; }
}
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('wheel', e => { camDist = clamp(camDist + Math.sign(e.deltaY) * 1.2, 4, 26); e.preventDefault(); }, { passive: false });
const ray = new THREE.Raycaster(), vec2 = new THREE.Vector2();
function elegirEn(cx, cy, doble) {
  vec2.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(vec2, camara);
  // Sin los ocultos: el rayo no mira la visibilidad y su cilindro sigue en la escena.
  const lista = [...mons.values()].filter(o => o.fig && !o.muereT && (!o.fig.raiz || o.fig.raiz.visible));
  const elegirMon = o => {
    if (MOVIL) { try { if (!localStorage.getItem('dq3_tip2m')) { localStorage.setItem('dq3_tip2m', '1'); aviso('👆 Monstruo marcado: acércate y tócalo o toca ' + K('1', 'ATACAR') + ' para golpearlo (mantén ATACAR para seguir pegando).', 'ok', 1); } } catch (e) {} }
    if (objetivo !== o.id) vibSel();
    objetivo = o.id; objFijo = o.id; pintarBarra(); sfx('boton', 0.2);
  };
  const hits = ray.intersectObjects(lista.map(o => o.fig.m), false);
  if (hits.length) {
    const o = lista.find(x => x.fig.m === hits[0].object);
    if (o) { elegirMon(o); return o; }
  }
  // Clic en otro jugador: queda elegido (curas, invitar al grupo).
  const ls = [...otros.values()].filter(o => o.fig);
  const hp2 = ray.intersectObjects(ls.filter(o => !o.fig.raiz || o.fig.raiz.visible).map(o => o.fig.m), false);   // oculto (lejos o fuera del tope de figuras): su malla quedo donde estaba
  if (hp2.length) { const o = ls.find(x => x.fig.m === hp2[0].object); if (o) { objetivoP = o.id; objetivo = 0; autoAtk = false; pintarBarra(); pintarObjetivoP(); pintarGrupo(); sfx('boton', 0.2); return; } }
  // Tolerancia (sobre todo con el dedo): el monstruo cercano cuyo centro en pantalla quede mas cerca del toque.
  let mejor = MOVIL ? 48 : 24, cerca = null;
  for (const m of lista) {
    if (Math.hypot(m.x - P.x, m.z - P.z) > 60) continue;
    const s = aPantalla(m.x, alturaEn(m.x, m.z) + altoFig(m.fig) * 0.5, m.z);
    if (!s) continue;
    const d = Math.hypot(s[0] - cx, s[1] - cy);
    if (d < mejor) { mejor = d; cerca = m; }
  }
  if (cerca) { elegirMon(cerca); return cerca; }
  // Lo mismo con otros jugadores: con el dedo no hace falta darle justo en la malla.
  let mejorP = MOVIL ? 44 : 22, cercaP = null;
  for (const o of ls) {
    if (Math.hypot(o.x - P.x, o.z - P.z) >= 40) continue;
    const s = aPantalla(o.x, alturaEn(o.x, o.z) + 1, o.z);
    if (!s) continue;
    const d = Math.hypot(s[0] - cx, s[1] - cy);
    if (d < mejorP) { mejorP = d; cercaP = o; }
  }
  if (cercaP) { objetivoP = cercaP.id; objetivo = 0; autoAtk = false; pintarBarra(); pintarObjetivoP(); pintarGrupo(); sfx('boton', 0.2); return; }
  // Clic cerca de un PNJ: hablar.
  for (const n of npcs) { const s = aPantalla(n.x, n.y + 1.2, n.z), dN = Math.hypot(P.x - n.x, P.z - n.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < (COMPACTO ? 56 : 40)) { if (dN < NPC_DIST + 2) { abrirNpc(n.tipo); return; } if (dN < 45) { aviso('🚶 Acércate a ' + n.nombre + ' para hablar'); return; } } }
  // Tocar el puesto de la Abuela (fiestas): su tienda.
  const pu = decoTp.puesto; if (pu) { const s = aPantalla(pu.x, pu.y + 0.8, pu.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < 50 && Math.hypot(P.x - pu.x, P.z - pu.z) < 8) { abrirAbuela(); return; } }
}
function cicloObjetivo(atras) {
  const l = [...mons.values()].filter(o => !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 45).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (!l.length) { objetivo = 0; if (performance.now() - (cicloObjetivo.av || 0) > 3000) { cicloObjetivo.av = performance.now(); aviso('No hay monstruos cerca: sigue la luz amarilla o mira el mapa ' + K('🗺 (M)', '⋯ → 🗺'), 'err'); } return; }
  const i = l.findIndex(o => o.id === objetivo);
  objetivo = l[atras ? (i < 0 ? l.length - 1 : (i - 1 + l.length) % l.length) : (i + 1) % l.length].id;
  try { marcaJefeIni(); } catch (e) {}
  sfx('boton', 0.2); vibSel();
}
// Objetivo elegido a proposito (Tab, Mayus+Tab, FIJAR o clic): golpeManual no lo cambia solo. El que se pone solo (por pegar o por lanzar) si cambia.
let objFijo = 0;
function fijarCiclo(atras) { cicloObjetivo(atras); objFijo = objetivo; }
// El elegido, si sigue vivo y a tiro de Tab (< 45 m) pero el golpe no le llega. Mas lejos se suelta para no bloquear el ataque.
function fijoFueraDeAlcance() {
  const ob = objFijo && objFijo === objetivo ? mons.get(objFijo) : null;
  if (!ob || ob.muereT) return null;
  const d = Math.hypot(ob.x - P.x, ob.z - P.z);
  return d > rangoAtaque(ob) && d < 45 ? ob : null;
}
// Jugador al que se puede pegar: el rival del duelo o, en el Abismo, uno de
// la otra faccion (fuera de los bastiones).
function enemigoP(id) {
  const o = otros.get(id);
  return !!(o && yo && yo.faccion && o.fc && o.fc !== yo.faccion && enAbismo(P.x) && enAbismo(o.x) && !santuario(P.x, P.z) && !santuario(o.x, o.z));
}
function rangoHtml() {
  const r = rangoDe(yo.pa || 0);
  return `<br>🎖 <span style="color:#fde68a;font-weight:700">${r.n}</span> · ${yo.pa || 0} PA${r.sig ? ` <small style="color:var(--txt3)">(siguiente: ${r.sig})</small>` : ''}`;
}
function rivalP() { return objetivoP && ((dueloCon && objetivoP === dueloCon) || enemigoP(objetivoP)) ? objetivoP : 0; }
// Blanco del ataque: el monstruo elegido o el jugador rival.
function blancoAtk() {
  if (objetivo) return mons.get(objetivo) || null;
  const r = rivalP();
  return r ? otros.get(r) || null : null;
}
// Ataque MANUAL (v344): cada toque de ATACAR (o 1/Z, o mantenerlo pulsado) es un golpe que se ve.
// Sin AUTO: el duende no persigue, no cambia solo de blanco ni toma pociones por su cuenta.
function alternarAtaque() { golpeManual(); }
let atkReintento = 0, atkRepite = false, atkRepN = 0;   // reenvio silencioso (maximo 2 seguidos) de un golpe que el servidor descarto por recarga (atkNo con ms)
let atkMantener = false, atkCdIni = 0, atkCdFin = 0, avisoTiroT = 0, avisoTiroN = 0, tiroO = null, btnAtkEl = null, recargaQ = -1;
// Direccion (x, z) del mundo hacia donde se empuja el joystick, o null si no se esta moviendo.
function dirJoy() {
  if (joy.id === null || Math.hypot(joy.dx, joy.dy) < 0.25) return null;
  const f = -joy.dy, s = joy.dx;
  const x = fwd.x * f + der.x * s, z = fwd.z * f + der.z * s, m = Math.hypot(x, z);
  return m > 0.01 ? [x / m, z / m] : null;
}
// Monstruo vivo mas cercano a menos de 'lim' metros (el elegido manda si esta dentro).
function monCerca(lim) {
  const ob = objetivo && mons.get(objetivo);
  if (ob && !ob.muereT && ob.fig && Math.hypot(ob.x - P.x, ob.z - P.z) <= lim) return ob;
  let mejor = null, md = lim;
  for (const o of mons.values()) {
    if (o.muereT || !o.fig || (o.fig.raiz && !o.fig.raiz.visible)) continue;
    const d = Math.hypot(o.x - P.x, o.z - P.z);
    if (d <= md) { md = d; mejor = o; }
  }
  return mejor;
}
// Monstruo "a tiro": el mas cercano a menos de su alcance + 2 m (el elegido manda si esta dentro).
function monATiro() {
  const ob = objetivo && mons.get(objetivo);
  if (ob && !ob.muereT && ob.fig && Math.hypot(ob.x - P.x, ob.z - P.z) <= rangoAtaque(ob) + 2) return ob;
  let mejor = null, md = Infinity;
  for (const o of mons.values()) {
    if (o.muereT || !o.fig || (o.fig.raiz && !o.fig.raiz.visible)) continue;
    const d = Math.hypot(o.x - P.x, o.z - P.z);
    if (d <= rangoAtaque(o) + 2 && d < md) { md = d; mejor = o; }
  }
  return mejor;
}
// Cada cuadro: anillo "a tiro" en el suelo y anillo de recarga del boton ATACAR (cadencia del arma).
function pintarAyudaAtk(t) {
  if (cuadro % 4 === 0) tiroO = yo && !P.muerto ? monATiro() : null;
  const o = tiroO;
  if (!o || o.muereT || mons.get(o.id) !== o || P.muerto) { if (anilloTiro.visible) anilloTiro.visible = false; }
  else {
    const llega = Math.hypot(o.x - P.x, o.z - P.z) <= rangoAtaque(o);
    anilloTiroMat.color.setHex(llega ? 0x4ade80 : 0xfacc15);
    anilloTiro.visible = true;
    anilloTiro.position.set(o.x, alturaEn(o.x, o.z) + 0.1, o.z);
    const s = (o.j ? 1.8 : 1) * (llega ? 1 + 0.1 * Math.sin(t / 110) : 1); anilloTiro.scale.set(s, 1, s);
  }
  if (!MOVIL) return;
  if (!btnAtkEl) btnAtkEl = $('t-atk');
  if (!btnAtkEl) return;
  const c3 = combo3T > performance.now();   // brillo dorado: el proximo golpe es el 3.o (el fuerte)
  if (btnAtkEl.classList.contains('combo3') !== c3) btnAtkEl.classList.toggle('combo3', c3);
  const k = atkCdFin > t ? clamp((t - atkCdIni) / Math.max(1, atkCdFin - atkCdIni), 0, 1) : 1;
  const q = Math.round(k * 40) / 40;
  if (q === recargaQ) return;
  recargaQ = q;
  btnAtkEl.style.setProperty('--rc', q); btnAtkEl.style.setProperty('--rco', q < 1 ? '1' : '0.3');
}
// Monstruo al alcance para el golpe: el elegido si llega; si no, el mas cercano al alcance (mejor si esta delante).
function blancoCercano() {
  const ob = objetivo && mons.get(objetivo);
  if (ob && !ob.muereT && Math.hypot(ob.x - P.x, ob.z - P.z) <= rangoAtaque(ob)) return ob;
  let mejor = null, mp = Infinity;
  const jd = dirJoy();   // con el joystick empujado, "delante" es hacia donde lo empuja
  const fx = jd ? jd[0] : Math.sin(P.ry), fz = jd ? jd[1] : Math.cos(P.ry);
  for (const o of mons.values()) {
    if (o.muereT || !o.fig) continue;
    const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz);
    if (d > rangoAtaque(o)) continue;
    const delante = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    const pts = d - delante * 1.5;
    if (pts < mp) { mp = pts; mejor = o; }
  }
  return mejor;
}
// ESQUIVAR (boton 💨, X o Mayus en el suelo): impulso de 3 m en 180 ms hacia el joystick (o hacia atras),
// recarga 1,2 s. Avisa al servidor ('esq3'): 180 ms sin golpes de monstruo y, en los ultimos 200 ms del aviso rojo, esquiva perfecta ('esqp').
const ESQ_MS = 180, ESQ_M = 3, ESQ_CD = 1200;
let esqT0 = 0, esqDx = 0, esqDz = 0, esqHasta = 0, esqBtn = null, esqQ = -1, esqTuto = false;
let esqEnv = false;   // ya se mando la posicion temprana de esta esquiva (a los 45 ms)
try { esqTuto = localStorage.getItem('dq3_esqTuto') === '1'; } catch (e) {}
// Pista de esquiva: ver el texto no es aprenderlo. Se marca aprendida al esquivar de verdad un golpe rojo
// ('mesq' con la esquiva reciente) o tras usar 💨 3 veces; hasta entonces el boton late en cada aviso rojo cercano.
let esqUsos = 0, esqTxtN = 0, esqTxtT = -1e9;
function esqAprendida(logro) {
  if (esqTuto) return;
  esqTuto = true; try { localStorage.setItem('dq3_esqTuto', '1'); } catch (e) {}
  if (logro) { aviso('💨 ¡Bien esquivado!', 'ok', 1); paso('esq1'); }
}
function esqPista(ms) {
  const ah = performance.now();
  if (MOVIL) { if (!esqBtn) esqBtn = $('t-esq');
    if (esqBtn) { const b = esqBtn; b.classList.add('tuto-pulso'); clearTimeout(esqPista.t); esqPista.t = setTimeout(() => { b.classList.remove('tuto-pulso'); }, ms + 400); } }
  if (esqTxtN < 3 && ah - esqTxtT >= 60000) { esqTxtN++; esqTxtT = ah; aviso(K('💨 ¡Pulsa X o Mayús para ESQUIVAR el golpe rojo!', '💨 ¡Toca el botón 💨 para ESQUIVAR el golpe rojo!'), 'ok', 1); }
}
function esquivar() {
  const ahora = performance.now();
  if (!yo || P.muerto || lanzando || P.vuela || P.planea || ahora < esqHasta || hayVentana() || chatAbierto()) return;
  if (P.au && ((P.au.aturdido || 0) > ahora || (P.au.bloque || 0) > ahora)) return;
  const jd = dirJoy();
  let dx = 0, dz = 0;
  if (jd) { dx = jd[0]; dz = jd[1]; }
  else if (teclas.KeyW || teclas.KeyS || teclas.KeyA || teclas.KeyD || teclas.ArrowUp || teclas.ArrowDown || teclas.ArrowLeft || teclas.ArrowRight) {
    const f = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0), s = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0);
    dx = fwd.x * f + der.x * s; dz = fwd.z * f + der.z * s;
  }
  let m = Math.hypot(dx, dz);
  if (m < 0.01) { dx = -Math.sin(P.ry); dz = -Math.cos(P.ry); m = 1; }
  esqDx = dx / m; esqDz = dz / m; esqT0 = ahora; esqEnv = false; esqHasta = ahora + ESQ_CD;
  mandar({ t: 'esq3' });
  if (!esqTuto && ++esqUsos >= 3) esqAprendida(false);
  SON.tocar('esquiva'); vib('light');
  if (!POBRE && CAL !== 'baja' && !enCueva(P.x)) FX.emitir(P.x, P.y + 0.1, P.z, { n: MOVIL ? 4 : 7, color: '#bfae8e', vel: 1.4, vida: 0.4, grav: -0.6, plano: true, radio: 0.35, tam: 1.2 });
}
// Cada cuadro (desde fisica): impulso en curso y anillo de recarga del boton 💨.
function pasoEsquiva(ahora) {
  if (esqT0) {
    if (ahora - esqT0 < ESQ_MS && !P.muerto) { const v = ESQ_M / (ESQ_MS / 1000); P.vx = esqDx * v; P.vz = esqDz * v;
      if (!esqEnv && ahora - esqT0 >= 45) { esqEnv = true; mandarPos(true); }   // el servidor ve la esquiva antes de decidir el golpe
    }
    else { esqT0 = 0; P.vx *= 0.25; P.vz *= 0.25; if (!P.muerto) mandarPos(true); }
  }
  if (!MOVIL) return;
  if (!esqBtn) esqBtn = $('t-esq');
  if (!esqBtn) return;
  const q = esqHasta > ahora ? Math.round(clamp(1 - (esqHasta - ahora) / ESQ_CD, 0, 1) * 40) / 40 : 1;
  if (q === esqQ) return;
  esqQ = q;
  esqBtn.style.setProperty('--rc', q); esqBtn.style.setProperty('--rco', q < 1 ? '1' : '0');
}
function golpeManual(bucle) {   // bucle: llamada del bucle (mantener o reintento), no un toque
  if (!yo || P.muerto || lanzando) return;
  const ahora = performance.now();
  if (ahora < sigAtk) { if (!bucle && sigAtk - ahora <= 220) atkBuf = ahora; return; }   // toque un pelin antes de tiempo: sale al acabar la recarga
  atkBuf = 0;
  // PC: con un objetivo elegido fuera de alcance se avisa y no se pega a otro (Tab o Esc para cambiar). En movil pega al cercano sin cambiar el elegido: rodeado, no se queda sin golpear.
  const fj = MOVIL ? null : fijoFueraDeAlcance();
  if (fj) {
    atkRepite = false; atkReintento = 0;
    if (ahora - (golpeManual.avF || 0) > 2500) { golpeManual.avF = ahora; aviso('🎯 ' + ((MONSTRUOS[fj.k] && MONSTRUOS[fj.k].nombre) || 'Tu objetivo') + ' está fuera de alcance: acércate, cambia con Tab o suéltalo con Esc.', 'err'); }
    return;
  }
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  // Jugador rival (duelo o Abismo de la otra faccion): solo ahi se pega a jugadores; el servidor lo vuelve a comprobar.
  const rv = !objetivo && rivalP() ? otros.get(rivalP()) : null;
  const o = rv && Math.hypot(rv.x - P.x, rv.z - P.z) <= rangoAtaque(rv) ? rv : blancoCercano();
  const cdMs = vara ? VARA.cdMs * arma.cd : 1000 * arma.cd;
  if (atkRepite) {
    // Reintento tras atkNo: el tajo ya se vio; solo se reenvia el golpe (sin combo, sonido ni impacto nuevo).
    atkRepite = false; atkReintento = 0;
    if (o) { mandarPos(true); mandar(o === rv ? { t: 'atk3', tp: o.id } : { t: 'atk3', tg: o.id }); sigAtk = ahora + cdMs; return; }
    if (!atkMantener) return;
  }
  sigAtk = ahora + cdMs;
  atkCdIni = ahora; atkCdFin = sigAtk;   // anillo de recarga del boton ATACAR (movil)
  // Combo de 3 golpes igual que el servidor: seguido (cdMs + 450) y al mismo blanco; al aire lo reinicia.
  const mismo = o && o.id === P.comboTg;
  P.combo = mismo && ahora - (P.atkT || 0) < cdMs + 450 ? ((P.combo || 0) + 1) % 3 : 0;
  P.comboTg = o ? o.id : null;
  if (P.combo === 1 && o) combo3T = ahora + cdMs + 450; else combo3T = 0;   // el siguiente golpe es el fuerte
  P.atkT = ahora;   // el golpe se ve siempre, aunque sea al aire
  ultimoToqueT = ahora;
  if (!o) {
    // Ayuda de apuntado: sin blanco al alcance, el golpe sale hacia el joystick (movil)
    // o el duende gira hacia el monstruo cercano (< 7 m) y el anillo del suelo dice cuando llega.
    const jd = dirJoy(), c = jd ? null : monCerca(7);
    if (jd) P.ry = Math.atan2(jd[0], jd[1]);
    else if (c) {
      P.ry = Math.atan2(c.x - P.x, c.z - P.z); P.f = (c.x - P.x) * der.x + (c.z - P.z) * der.z >= 0 ? 1 : -1;
      if (avisoTiroN < 3 && ahora - avisoTiroT > 6000) { avisoTiroN++; avisoTiroT = ahora; aviso('🎯 Acércate un poco más: cuando el anillo bajo el monstruo se pone verde, tu golpe le llega.', 'ok', 1); }
    }
    // Sin monstruos a la vista (tambien con joystick): decirle adonde ir, como mucho cada 8 s
    if (!c && !enCueva(P.x) && !enAbismo(P.x) && !monCerca(25) && ahora - (golpeManual.avL || 0) > 8000) {
      golpeManual.avL = ahora;
      aviso(zonaEn(P.x, P.z) === 'pueblo' ? '🏘 En el pueblo no hay monstruos: sal y sigue la luz amarilla.' : 'No hay monstruos cerca: sigue la luz amarilla o mira el mapa ' + K('🗺 (M)', '⋯ → 🗺') + '.', 'ok', 1);
    }
    sfxK('desenv', 0.22); efectoGolpe(vara, true); return;
  }
  if (o !== rv && objetivo !== o.id && !fijoFueraDeAlcance()) { objetivo = o.id; pintarBarra(); }
  mandarPos(true);
  mandar(o === rv ? { t: 'atk3', tp: o.id } : { t: 'atk3', tg: o.id });
  if (!golpe1Ok) { golpe1Ok = true; paso('golpe1'); paso('t_atk'); }
  atkReintento = 0; atkRepN = 0;
  if (o !== rv) impactos.push({ o, t: ahora + (vara ? 280 : 150) });
  const dx = o.x - P.x, dz = o.z - P.z; P.ry = Math.atan2(dx, dz);
  P.f = dx * der.x + dz * der.z >= 0 ? 1 : -1;
  // Vara (Mago, Sacerdote): la bola sale ya desde el cliente; la del servidor para uno mismo se omite (proyLocalT).
  if (vara) { proyectil(P, o, (CLASES[yo.clase] && CLASES[yo.clase].color) || '#fff'); P.proyLocalT = ahora; sfxK('desenv', 0.2); }
  else { sfx('corte', 0.3, null, null, pesoArma().tono); if (o !== rv) P.corteLocal = { tg: o.id, t: ahora }; }   // la confirmacion (at3) de este toque no repite el corte
  tuto3.atk = true;
  efectoGolpe(vara, false);
}
// Arco del tajo (v344, solo visual): media luna translucida delante del duende con el color de la clase,
// que barre y se desvanece en ~200 ms. Las varas al aire sueltan ademas un destello que vuela adelante.
const GEO_TAJO = new THREE.RingGeometry(0.7, 1.2, CAL === 'baja' ? 10 : 22, 1, -Math.PI / 2 - 1.2, 2.4);
const tajos = [];
function efectoGolpe(vara, alAire) {
  if (!P || !yo) return;
  // Arco por arma (no vara): alcance -> tamano (Odachi x1.22, Dagas x0.9) y color del arma salvo la Katana.
  const cl = CLASES[yo.clase], aw = !vara ? ARMAS[yo.arma] : null, baja = POBRE || CAL === 'baja';
  const color = (aw && yo.arma !== 'katana' && aw.color) || (cl && cl.color) || '#fff1c1';
  const cmb = P.combo || 0, fuerte = cmb === 2, alto = P.fig && P.fig.alto ? P.fig.alto : 1.6;
  while (tajos.length >= (baja ? 2 : 5)) { const v = tajos.shift(); escena.remove(v.g); if (v.mat) v.mat.dispose(); }
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const g = new THREE.Group(), inc = new THREE.Group(), me = new THREE.Mesh(GEO_TAJO, mat);
  me.rotation.x = -Math.PI / 2; inc.add(me); g.add(inc);
  // 0: tajo en diagonal, 1: tajo de vuelta casi plano (barre al reves), 2: golpe fuerte vertical y mas grande.
  inc.rotation.z = cmb === 0 ? 0.55 : cmb === 1 ? -0.15 : Math.PI / 2;
  // Dagas: cada golpe tuerce el arco al otro lado (+0.4 / -0.4 rad) para que se lea a dos manos.
  if (aw && yo.arma === 'dagas') { efectoGolpe.lado = -(efectoGolpe.lado || -1); inc.rotation.z += 0.4 * efectoGolpe.lado; }
  const esc = (fuerte ? 1.3 : 1) * (vara ? 0.85 : 1) * clamp(alto / 1.6, 0.8, 1.5) * (aw ? Math.sqrt(aw.alcance || 1) : 1);
  g.position.set(P.x, P.y + alto * (fuerte ? 0.6 : 0.5), P.z); g.scale.setScalar(esc);
  escena.add(g);
  tajos.push({ g, mat, t0: performance.now(), dur: fuerte ? 260 : 200, ry: P.ry, giro: cmb === 1 ? -1 : 1, fuerte });
  const fx = Math.sin(P.ry), fz = Math.cos(P.ry);
  if (fuerte && !baja) FX.emitir(P.x + fx * 1.1, P.y + alto * 0.55, P.z + fz * 1.1, { n: MOVIL ? 6 : 10, color, vel: 3, vida: 0.3 });
  if (aw && yo.arma === 'chispa' && !POBRE && CAL === 'alta') FX.emitir(P.x + fx * 1.1, P.y + alto * 0.55, P.z + fz * 1.1, { n: 4, color: '#00eeff', vel: 2.6, vida: 0.25 });   // Chispa: chispazos cian
  // Vara al aire: una bolita de luz que sale hacia delante y se deshace en chispas.
  if (vara && alAire) {
    const b = new THREE.Mesh(GEO_BALA, matBala(color));
    b.scale.setScalar(fuerte ? 0.9 : 0.6);
    escena.add(b);
    tajos.push({ g: b, mat: null, t0: performance.now(), dur: 340, bola: true, x: P.x + fx * 0.6, y: P.y + alto * 0.6, z: P.z + fz * 0.6, fx, fz, color, baja });
  }
}
function moverTajos(t) {
  for (let i = tajos.length - 1; i >= 0; i--) {
    const v = tajos[i], k = Math.max(0, (t - v.t0) / v.dur);   // el reloj del cuadro puede ir unos ms detras de performance.now()
    if (k >= 1) {
      escena.remove(v.g); if (v.mat) v.mat.dispose();
      if (v.bola && !v.baja && k >= 1) FX.emitir(v.x + v.fx * 5, v.y, v.z + v.fz * 5, { n: MOVIL ? 6 : 10, color: v.color, vel: 2.5, vida: 0.35 });
      tajos.splice(i, 1); continue;
    }
    if (v.bola) { const d = 0.6 + 4.4 * k; v.g.position.set(v.x + v.fx * d, v.y + Math.sin(k * Math.PI) * 0.15, v.z + v.fz * d); continue; }
    // Sigue al duende, barre unos grados y se agranda mientras se apaga.
    v.g.position.x = P.x; v.g.position.z = P.z;
    v.g.rotation.y = v.ry + v.giro * (k - 0.5) * (v.fuerte ? 0.3 : 0.9);
    v.g.children[0].scale.setScalar(0.85 + 0.35 * k);
    v.mat.opacity = 0.8 * (1 - k) * (1 - k * 0.3);
  }
}
function usarPoder(i) { if (!yo || P.muerto) return; mandar({ t: 'pw', i }); }
function usarHab(h) {
  if (!yo || P.muerto || !h) return;
  if (yo.nivel < h.nv) return aviso(`Aprendes ${h.nombre} a nivel ${h.nv}: ${h.desc}`, 'err');
  const ahora = performance.now();
  if (h.gcd !== false && ahora < gcdHasta) { if (gcdHasta - ahora < 400) { colaHab = h; colaHasta = gcdHasta + 300; } return; }
  if (cdHab[h.id] && cdHab[h.id].fin > ahora) {
    // Bufer: si le faltan menos de 0,3 s se lanza sola al quedar lista (el servidor sigue validando).
    if (cdHab[h.id].fin - ahora < 300) { colaHab = h; colaHasta = cdHab[h.id].fin + 300; return; }
    return aviso(h.nombre + ' todavía no está lista.', 'err');
  }
  // Enemigo: el objetivo elegido (o el servidor busca el mas cercano).
  // Aliado: el jugador elegido o uno mismo.
  const contraRival = h.obj === 'enemigo' && !objetivo && rivalP() ? rivalP() : 0;
  if (h.obj === 'enemigo' && !objetivo && !contraRival) cicloObjetivo();
  // Sin recurso: se explica aqui (antes el tutorial lo daba por hecho y llegaba un "no" del servidor).
  if (yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec)) { const cl = CLASES[yo.clase], rc = cl && RECURSOS[cl.recurso]; return aviso(`${h.nombre} necesita más ${rc ? rc.nombre.toLowerCase() : 'recurso'}${cl && cl.recurso === 'ira' ? ': la Ira sube al pegar y al recibir golpes' : ''}.`, 'err'); }
  mandarPos(true);
  // Aliado elegido solo si sigue cerca (en movil no habia forma de soltarlo y la cura iba a un "fantasma").
  const qa = objetivoP && otros.get(objetivoP), dqa = qa ? Math.hypot(qa.x - P.x, qa.z - P.z) : 0, aliadoOk = qa && dqa <= (h.rango || 400) / 17 + 2;
  // Aliado elegido pero lejos: avisa en vez de gastar la cura en uno mismo. Repetir en 4 s suelta al aliado y te cura a ti (en movil no hay otra forma de soltarlo).
  if ((h.obj === 'aliado' || h.obj === 'muerto') && qa && !aliadoOk && !enemigoP(qa.id) && !!qa.muerto === (h.obj === 'muerto')) {
    if (h.obj === 'aliado' && usarHab.lejos === qa.id && ahora - usarHab.lejosT < 4000) { usarHab.lejos = 0; objetivoP = 0; pintarObjetivoP(); pintarGrupo(); }
    else { usarHab.lejos = qa.id; usarHab.lejosT = ahora; return aviso((qa.n || 'Tu aliado') + ' está lejos (' + Math.round(dqa) + ' m): acércate' + (h.obj === 'muerto' ? ' para resucitarle.' : ' para curarle, o vuelve a tocar para curarte tú.'), 'err'); }
  }
  mandar({ t: 'hab3', id: h.id, tg: h.obj === 'enemigo' ? objetivo : 0, tp: contraRival ? contraRival : (h.obj === 'aliado' || h.obj === 'muerto') && aliadoOk ? objetivoP : 0 });
  // Con lanzamiento: quieto desde el toque (el acercamiento automatico lo movia antes de
  // que llegara el 'cast' y el servidor lo cancelaba con "Te moviste").
  if (h.cast) { lanzando = { id: h.id, ini: ahora, fin: ahora + h.cast, pre: true }; P.vx = 0; P.vz = 0; }
  tuto3.hab = true;
  estrenarHab(h);
  if (h.gcd !== false) gcdHasta = ahora + GCD_MS;
  if (h.id === 'polimorfia') { autoAtk = false; colaHab = null; pintarBarra(); }   // pegarle a la oveja la despierta
  // (sin AUTO desde v344: la habilidad no enciende el ataque automatico)
}
function montar() { if (!yo || P.muerto) return; if (P.vuela) return aviso('Aterriza antes de montar.', 'err'); mandar({ t: 'montar' }); }
// ── VUELO (como las alas de AION) ──
// Fuera del pueblo, V (o doble salto en el aire) despliega las alas: Espacio
// sube, C baja. Las alas tienen 60 s de energia que se recarga en el suelo.
let ALAS_MAX = 60;
P.alas = ALAS_MAX; P.vuela = false; P.planea = false;
let estelaN = 0, caEstela = '#c4b5fd';   // estela de vuelo: contador de cuadros y color de las alas puestas
function volar(on) {
  if (on === undefined) on = !P.vuela;
  if (on) {
    if (P.muerto || !yo) return;
    if (yo.montado) return aviso('Bájate de la montura para volar.', 'err');
    if (zonaEn(P.x, P.z) === 'pueblo') return aviso(!(yo && yo.kills > 0) ? '⚔️ Primero caza: sal por el camino hacia la luz amarilla y pega con ' + K('1', 'ATACAR') + '.' : '🦋 En el pueblo no se vuela: sal por el camino hacia la luz amarilla y toca ' + K('V', 'VOLAR') + '.', 'ok', 1);
    if (enCueva(P.x)) return aviso('En la cueva no hay sitio para volar.', 'err');
    if (P.alas < 3) return aviso('Tus alas necesitan descansar.', 'err');
    P.vuela = true; P.vy = 0; P.planea = false; P.planeoAuto = false; if (P.suelo) P.y += 1.5; P.suelo = false;
    sfx('salto', 0.2); sfxK('tela', 0.3); SON.tocar('alas', { vol: 0.8 });
    try { caEstela = (ALAS[(yo && yo.ala) || 'aprendiz'] || ALAS.aprendiz).color || '#c4b5fd'; FX.emitir(P.x, P.y + 1.2, P.z, { n: MOVIL ? 14 : 24, color: caEstela, vel: 3, vida: 0.8, grav: -1.5, radio: 0.5, tam: 1.2 }); } catch (e) {}
    vib('light');
  } else P.vuela = false;
  if (MOVIL) { $('t-bajar').style.visibility = P.vuela ? 'visible' : 'hidden'; $('t-volar').textContent = P.vuela ? 'PLANEAR' : 'VOLAR'; }
}
function saltar() {
  if (P.muerto) return;
  if (P.suelo || P.coyote > 0) { P.vy = FIS.salto; P.suelo = false; P.coyote = 0; P.buffer = 0; sfx('salto', 0.25); return; }
  // Segundo salto en lo alto del salto: se despliegan las alas para volar;
  // si ya caes, Espacio mantenido es planear (fisica).
  if (!P.vuela && P.vy > -2.5) { volar(true); return; }
  P.buffer = FIS.buffer;   // pulsado justo antes de tocar el suelo: salta al aterrizar
}
function npcCercano() {
  if (enAbismo(P.x)) {
    const pb = yo && yo.faccion && portalBase(yo.faccion);
    if (pb && Math.hypot(P.x - pb.x, P.z - pb.z) < 5) return { tipo: 'salidaAbismo', nombre: 'Volver al pueblo' };
    const q = yo && yo.faccion && MAQUINAS.find(m => m.f === yo.faccion && Math.hypot(P.x - m.x, P.z - m.z) < MAQUINA_DIST);
    return q ? { tipo: 'maquina', nombre: MAQUINA[q.k].nombre, i: q.i } : null;
  }
  if (enCueva(P.x)) return Math.hypot(P.x - CUEVA_X0 - CUEVA.salida.x, P.z - CUEVA.salida.z) < 4 ? { tipo: 'salida', nombre: 'Salir de la cueva' } : null;
  // Sacerdote junto a un aliado caido: el boton ofrece Resucitarle (la habilidad no va en la barra).
  const hRes = yo && yo.clase === 'sacerdote' && !P.muerto ? habPorId('resurreccion') : null;
  if (hRes && (yo.nivel || 1) >= hRes.nv) for (const q of otros.values()) if (q.muerto && Math.hypot(q.x - P.x, q.z - P.z) <= (hRes.rango / 17 || 6) && !enemigoP(q.id) && q.id !== dueloCon) return { tipo: 'res', nombre: 'Resucitar a ' + (q.n || 'tu aliado'), q, h: hRes };
  // El mas cercano: Asiri y Grumo estan a menos de 12 m y sus radios se pisan.
  let nCerca = null, dCerca = Infinity;
  for (const n of npcs) { const dN = Math.hypot(P.x - n.x, P.z - n.z); if (dN < (n.dist || NPC_DIST) && dN < dCerca) { dCerca = dN; nCerca = n; } }
  return nCerca || (portal && Math.hypot(P.x - portal.x, P.z - portal.z) < 5 ? { tipo: 'portal', nombre: 'Mazmorras' } : null)
    || (decoTp.puesto && Math.hypot(P.x - decoTp.puesto.x, P.z - decoTp.puesto.z) < 3.5 ? { tipo: 'tiendaTemp', nombre: 'la Abuela' } : null);
}
function hablar() {
  if (pica > performance.now()) { mandar({ t: 'tirar', r: Math.round(performance.now() - picaRecibida) }); return; }
  // Esperando la picada, tocar el boton cortaba el sedal: ahora solo avisa.
  if (lanzando && lanzando.id === 'pescar') { if (performance.now() - (hablar.esperaT || 0) > 2000) { hablar.esperaT = performance.now(); aviso('🎣 Espera a que pique: el botón se pondrá ¡TIRAR!'); } return; }
  // Recoger o pescar: quieto y sin ataque automatico (antes se cancelaba solo con "Te moviste").
  const quieto = id => { autoAtk = false; pintarBarra(); const t = performance.now(); lanzando = { id, ini: t, fin: t + 2500, pre: true }; P.vx = P.vz = 0; };
  if (!npcCercano()) { const cf = cofreCercano(); if (cf) { mandar({ t: 'cofre3', id: cf.i }); return; } const nd = nodoCercano(); if (nd) { quieto('recolectar'); mandar({ t: 'recolectar', i: nd.i }); return; } if (aguaCerca()) { quieto('pescar'); mandar({ t: 'pescar' }); return; } }
  const n = npcCercano();
  if (!n) return;
  if (n.tipo === 'salida') { mandar({ t: 'salirCueva' }); return; }
  if (n.tipo === 'salidaAbismo') { mandar({ t: 'salirAbismo' }); return; }
  if (n.tipo === 'maquina') { mandar({ t: 'maquina', i: n.i }); return; }
  if (n.tipo === 'tiendaTemp') { abrirAbuela(); return; }
  if (n.tipo === 'res') { if (lanzando && lanzando.id === 'resurreccion') return; objetivoP = n.q.id; pintarObjetivoP(); usarHab(n.h); return; }
  if (n.tipo === 'portal') {
    npcAbierto = '';
    $('npc-t').textContent = 'PORTAL DE LAS MAZMORRAS';
    $('npc-c').innerHTML = `<p><b style="color:#ffd84a">${CUEVA.nombre}</b> · mazmorra 3D para tu grupo (o solo). Salas con goblins, el Rey Goblin en su trono y un cofre para cada uno al final. Se adapta al nivel del más alto del grupo.</p>`
      + `<p style="font-size:12px;color:var(--txt2)">${(yo.cuevaHoy || 0) >= 3 ? 'Hoy ya abriste 3 cofres completos: el pequeño sigue valiendo para logros.' : `Cofres completos hoy: ${yo.cuevaHoy || 0}/3`}${yo.cuevaRec ? ` · Tu récord: ${fmtT(yo.cuevaRec * 1000)}` : ''}</p>`
      + '<button class="btn" id="p-cueva" style="width:100%;margin:8px 0">Entrar a la cueva</button>'
      + (yo.nivel >= 5 && (!grupo3 || (grupo3.lider === yo.pid && (grupo3.m || []).length < 5)) ? '<button class="btn sec" id="p-cueva-lfg" style="width:100%;margin:0 0 8px;min-height:40px">👥 Buscar grupo (2-5)</button>' : '')
      + `<hr style="border-color:var(--borde);margin:10px 0"><p><b style="color:#c4b5fd">🌌 ${ABISMO.nombre}</b> · islas flotantes donde la Luz y la Sombra se disputan el Núcleo (desde nivel ${ABISMO.nvMin}).</p>`
      + (yo.faccion ? `<p style="font-size:12px">Tu facción: <b style="color:${FACCIONES[yo.faccion].color}">${FACCIONES[yo.faccion].titulo}</b>${temp3 && temp3.debil === yo.faccion ? ' · ✨ Bendición del Éter (PA ×' + String(FACC_BONO).replace('.', ',') + ')' : ''}</p>${temp3 ? `<p style="font-size:11px;color:var(--txt2)">🏆 Temporada: tus PA ${fmtN(temp3.p)} · liga ${TEMP_ABISMO[temp3.tier] ? TEMP_ABISMO[temp3.tier].n : 'sin liga'} (ver en 🏆 Ranking → Abismo)</p>` : ''}<button class="btn" id="p-abismo" style="width:100%;margin:6px 0;background:linear-gradient(90deg,#7c3aed,#2563eb)">Ir al Abismo</button>`
        : yo.nivel >= ABISMO.nvMin ? `<p style="font-size:12px">Elige tu facción (para siempre):</p><div style="display:flex;gap:6px;margin:6px 0"><button class="btn" id="p-luz" style="flex:1;background:#b8860b">☀ Luz${temp3 ? ` (${temp3.n.luz || 0})` : ''}${temp3 && temp3.debil === 'luz' ? ' ★' : ''}</button><button class="btn" id="p-sombra" style="flex:1;background:#6b21a8">🌑 Sombra${temp3 ? ` (${temp3.n.sombra || 0})` : ''}${temp3 && temp3.debil === 'sombra' ? ' ★' : ''}</button></div>${temp3 && temp3.debil ? `<p style="font-size:12px;color:#ffd84a">★ Los ${esc(FACCIONES[temp3.debil].titulo)} son menos: si te unes cobras <b>${fmtN(RECLUTA.oro * Math.max(1, Math.floor(yo.nivel / 10)))} oro, un objeto épico y ${RECLUTA.pa} PA</b>, y ganáis PA ×${String(FACC_BONO).replace('.', ',')} mientras lo seáis.</p>` : ''}`
        : `<p style="font-size:12px;color:var(--txt3)">Se abre a nivel ${ABISMO.nvMin}.</p>`)
      + '<p style="font-size:12px;color:var(--txt2)">Las demás mazmorras, la Torre y la banda siguen en CLASSIC (2D) con tu mismo personaje.</p><a class="btn sec" href="/mmo/" style="display:block;text-align:center;text-decoration:none">Ir a CLASSIC (2D)</a>';
    $('p-cueva').onclick = () => { mandar({ t: 'cueva' }); cerrar('v-npc'); };
    if ($('p-cueva-lfg')) $('p-cueva-lfg').onclick = () => { mandar({ t: 'buscarGrupo', id: 'cueva' }); $('p-cueva-lfg').disabled = true; };   // el servidor responde con el aviso real (a cuantos llego o por que no)
    if ($('p-abismo')) $('p-abismo').onclick = () => { mandar({ t: 'abismo' }); cerrar('v-npc'); };
    for (const f of ['luz', 'sombra']) if ($('p-' + f)) $('p-' + f).onclick = () => { if (!confirm(`¿Unirte a los ${FACCIONES[f].titulo}? Es para siempre: no se puede cambiar.`)) return; mandar({ t: 'faccion', f }); cerrar('v-npc'); };
    abrir('v-npc');
    return;
  }
  abrirNpc(n.tipo);
}
$('hablar').onclick = hablar;

// Tactil: joystick a la izquierda, arrastrar a la derecha gira la camara.
// Ajustes -> Vibracion (movil y PC; por dispositivo).
if ($('sel-vib')) {
  let vb0 = 'normal'; try { vb0 = localStorage.getItem('dq3_vib') || 'normal'; } catch (e) {}
  $('sel-vib').value = ['normal', 'suave', 'off'].includes(vb0) ? vb0 : 'normal';
  $('sel-vib').onchange = () => { const v = $('sel-vib').value; try { localStorage.setItem('dq3_vib', v); } catch (e) {} if (v !== 'off') vib('success'); };
}
const joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
const camTouch = { id: null, x: 0, y: 0, mov: 0 };
if (MOVIL) {
  const base = $('joy').querySelector('.base'), pomo = base.firstElementChild;
  // Pista hasta el primer uso: la base del joystick no se ve hasta tocar.
  let pistaJoy = null;
  try { if (!localStorage.getItem('dq_joy_ok')) { pistaJoy = document.createElement('div'); pistaJoy.className = 'pista-joy'; pistaJoy.innerHTML = '<i></i><span>Desliza aquí<br>para moverte</span>'; $('joy').appendChild(pistaJoy); } } catch (e) {}
  // La pista solo se va de verdad tras arrastrar > 30 px durante 400 ms (un toque suelto no basta).
  let joyTocado = false;
  const joyPistaOk = () => { if (pistaJoy && joy.lejos > 30 && joy.t30 && performance.now() - joy.t30 >= 400) { pistaJoy.remove(); pistaJoy = null; try { localStorage.setItem('dq_joy_ok', '1'); } catch (er) {} } };
  $('joy').addEventListener('touchstart', e => {
    if (!joyTocado) { joyTocado = true; paso('joy_toque'); }
    if (pistaJoy) { pistaJoy.style.display = 'none'; vib('light'); }
    joy.t30 = 0;
    const t = e.changedTouches[0]; joy.id = t.identifier; joy.x = t.clientX; joy.y = t.clientY; joy.dx = joy.dy = 0;
    joy.x0 = t.clientX; joy.y0 = t.clientY; joy.t0 = performance.now(); joy.lejos = 0;   // para distinguir un toque corto (elegir) de mover
    const r = $('joy').getBoundingClientRect();   // la base se dibuja bajo el dedo aunque #joy no empiece en (0,0)
    base.style.display = 'block'; base.style.left = (t.clientX - r.left - 48) + 'px'; base.style.top = (t.clientY - r.top - 48) + 'px';
    e.preventDefault();
  }, { passive: false });
  $('joy').addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      let dx = t.clientX - joy.x, dy = t.clientY - joy.y; const d = Math.hypot(dx, dy);
      joy.lejos = Math.max(joy.lejos || 0, Math.hypot(t.clientX - joy.x0, t.clientY - joy.y0));
      if (joy.lejos > 30 && !joy.t30) joy.t30 = performance.now();
      joyPistaOk();
      if (d > 38) {   // joystick flotante: la base sigue al dedo (girar en redondo sin quedarse atascado al borde)
        const k = (d - 38) / d; joy.x += dx * k; joy.y += dy * k; dx -= dx * k; dy -= dy * k;
        const r = $('joy').getBoundingClientRect();
        base.style.left = (joy.x - r.left - 48) + 'px'; base.style.top = (joy.y - r.top - 48) + 'px';
      }
      joy.dx = dx / 38; joy.dy = dy / 38;
      pomo.style.left = (26 + dx) + 'px'; pomo.style.top = (26 + dy) + 'px';
    }
    e.preventDefault();
  }, { passive: false });
  const finJoy = e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      joyPistaOk(); if (pistaJoy) pistaJoy.style.display = '';   // no llego a arrastrar: la pista vuelve
      joy.id = null; joy.dx = joy.dy = 0; base.style.display = 'none'; pomo.style.left = pomo.style.top = '26px';
      // Toque corto sin arrastrar: elige lo que haya debajo (monstruo, jugador, PNJ) como en el resto de la pantalla.
      const quieto = Math.max(joy.lejos || 0, Math.hypot(t.clientX - joy.x0, t.clientY - joy.y0)) < 12;
      if (e.type === 'touchend' && quieto && performance.now() - (joy.t0 || 0) < 300) { const om = elegirEn(t.clientX, t.clientY, false); if (om && !om.muereT && mons.has(om.id) && Math.hypot(om.x - P.x, om.z - P.z) <= rangoAtaque(om)) { vib('light'); golpeManual(); } }
    }
  };
  $('joy').addEventListener('touchend', finJoy); $('joy').addEventListener('touchcancel', finJoy);
  // Mando para diestros: joystick a la derecha (Ajustes → Mando). Por dispositivo.
  const ponerMano = v => { document.body.classList.toggle('mano-der', v === 'der'); if ($('sel-mano')) $('sel-mano').value = v === 'der' ? 'der' : 'izq'; };
  let mano0 = 'izq'; try { mano0 = localStorage.getItem('dq3_mano') || 'izq'; } catch (e) {}
  ponerMano(mano0);
  if ($('sel-mano')) {
    if ($('fila-mano')) $('fila-mano').style.display = '';
    $('sel-mano').onchange = () => { const v = $('sel-mano').value; try { localStorage.setItem('dq3_mano', v); } catch (e) {} ponerMano(v); };
  }
  // Dedos sobre el lienzo: con uno se gira la camara, con dos se pellizca para el zoom.
  const toques = new Map(); let pinch = null;
  const sepToques = () => { const [a, b] = [...toques.values()]; return Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)); };
  lienzo.addEventListener('touchstart', e => {
    toques.clear(); for (const t of e.targetTouches) toques.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (toques.size >= 2) { pinch = { d: sepToques(), cam: camDist }; camTouch.id = null; return; }   // el dedo que quede no gira hasta levantarlo
    const t = e.changedTouches[0]; camTouch.id = t.identifier; camTouch.x = t.clientX; camTouch.y = t.clientY; camTouch.mov = 0;
  }, { passive: true });
  lienzo.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (toques.has(t.identifier)) toques.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (pinch && toques.size >= 2) { camDist = clamp(pinch.cam * pinch.d / sepToques(), 4, 26); return; }
    for (const t of e.changedTouches) if (t.identifier === camTouch.id) {
      const dx = t.clientX - camTouch.x, dy = t.clientY - camTouch.y; camTouch.x = t.clientX; camTouch.y = t.clientY; camTouch.mov += Math.abs(dx) + Math.abs(dy);
      camYaw -= dx * 0.008; camPitch = clamp(camPitch + dy * 0.005, 0.08, 1.25); camArrastreT = performance.now();
    }
  }, { passive: true });
  const finToque = e => {
    for (const t of e.changedTouches) { toques.delete(t.identifier); if (t.identifier === camTouch.id) { if (camTouch.mov < 10 && e.type === 'touchend') { const om = elegirEn(t.clientX, t.clientY, false); if (om && !om.muereT && mons.has(om.id) && Math.hypot(om.x - P.x, om.z - P.z) <= rangoAtaque(om)) { vib('light'); golpeManual(); } } camTouch.id = null; } }
    if (toques.size < 2) pinch = null;
  };
  lienzo.addEventListener('touchend', finToque, { passive: true }); lienzo.addEventListener('touchcancel', finToque, { passive: true });
  // Dos toques seguidos (como en otros juegos de movil) no apagan el ataque que el primero encendio.
  let atkTapT = 0;
  $('t-atk').addEventListener('touchstart', e => { e.preventDefault(); atkTapT = performance.now(); atkMantener = true; golpeManual(); }, { passive: false });
  for (const ev of ['touchend', 'touchcancel']) $('t-atk').addEventListener(ev, () => { atkMantener = false; }, { passive: true });
  if ($('t-esq')) $('t-esq').addEventListener('touchstart', e => { e.preventDefault(); esquivar(); }, { passive: false });
  // Con el teclado cerrado (Atras de Android) el chat seguia con el foco y congelaba el joystick y los botones.
  const soltarChat = () => { const i = $('chat-in'); if (document.activeElement === i) { i.blur(); if (!i.value.trim()) i.style.display = 'none'; } };
  $('tactil').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
  $('joy').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
  // Los botones hacen preventDefault y así el celular no activa :active: esta clase da el brillo y la opacidad al pulsar.
  $('tactil').addEventListener('touchstart', e => { const b = e.target.closest('button'); if (b) b.classList.add('pulsado'); }, { capture: true, passive: true });
  const soltarBoton = e => { const b = e.target.closest('button'); if (b && !e.targetTouches.length) b.classList.remove('pulsado'); };
  $('tactil').addEventListener('touchend', soltarBoton, { capture: true, passive: true });
  $('tactil').addEventListener('touchcancel', soltarBoton, { capture: true, passive: true });
  // Mantener SALTO: sube volando y planea al caer (como Espacio).
  $('t-salto').addEventListener('touchstart', e => { e.preventDefault(); tocandoSubir = true; if (!P.vuela) saltar(); }, { passive: false });
  $('t-salto').addEventListener('touchend', () => { tocandoSubir = false; });
  $('t-salto').addEventListener('touchcancel', () => { tocandoSubir = false; });
  $('t-bajar').addEventListener('touchcancel', () => { tocandoBajar = false; });
  $('t-bajar').addEventListener('touchstart', e => { e.preventDefault(); tocandoBajar = true; }, { passive: false });
  $('t-bajar').addEventListener('touchend', () => { tocandoBajar = false; });
  // En el aire, VOLAR (que pasa a decir PLANEAR) pliega las alas y planea: antes caia en picado.
  $('t-volar').addEventListener('touchstart', e => { e.preventDefault(); if (P.vuela) { volar(false); P.planeoAuto = true; } else volar(); }, { passive: false });
  $('t-usar').addEventListener('touchstart', e => { e.preventDefault(); hablar(); }, { passive: false });
  $('t-montar').addEventListener('touchstart', e => { e.preventDefault(); montar(); }, { passive: false });
  $('t-obj').addEventListener('touchstart', e => { e.preventDefault(); fijarCiclo(); }, { passive: false });
}

// ── BUCLE ──
let ultimoT = performance.now(), enviadoT = 0, ultimoEnv = '', modoEnv = 0, cuadro = 0;
const fwd = new THREE.Vector3(), der = new THREE.Vector3();
// Fisica del duende. Corre siempre (con una ventana abierta o muerto solo se
// pierden los controles: se sigue cayendo y frenando). Salto con "coyote time"
// (aun se puede saltar un instante despues de salir de un borde) y con memoria
// (pulsado justo antes de tocar suelo, salta al aterrizar).
const FIS = { gSube: 22, gCae: 30, vMaxCaida: 32, salto: 8.4, coyote: 0.12, buffer: 0.14, escalon: 0.45 };
P.coyote = 0; P.buffer = 0;
function fisica(dt) {
  if (P.corrX || P.corrZ) { const k = 1 - Math.exp(-dt * 12), cx = P.corrX * k, cz = P.corrZ * k; P.x += cx; P.z += cz; P.corrX -= cx; P.corrZ -= cz; if (Math.abs(P.corrX) + Math.abs(P.corrZ) < 0.01) P.corrX = P.corrZ = 0; }
  if (!yo) { P.anda = false; return; }
  const ahoraP = performance.now();
  const aturdido = (P.au && ((P.au.aturdido || 0) > ahoraP || (P.au.bloque || 0) > ahoraP));
  const sinControl = P.muerto || hayVentana() || chatAbierto() || aturdido || !!cineEst;
  if (P.muerto && P.vuela) volar(false);
  let f = 0, s = 0;
  if (!sinControl) {
    if (teclas.KeyW || teclas.ArrowUp) f += 1;
    if (teclas.KeyS || teclas.ArrowDown) f -= 1;
    if (teclas.KeyD || teclas.ArrowRight) s += 1;
    if (teclas.KeyA || teclas.ArrowLeft) s -= 1;
    if (joy.id !== null) { f = -joy.dy; s = joy.dx; }
  }
  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); der.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let mx = fwd.x * f + der.x * s, mz = fwd.z * f + der.z * s;
  // Sin AUTO (v344): el duende solo se mueve con el joystick o el teclado, nunca persigue solo.
  const mag = Math.hypot(mx, mz);
  const quiere = mag > 0.15;
  if (quiere) { mx /= Math.max(1, mag); mz /= Math.max(1, mag); }
  const nadando = !P.vuela && !enAbismo(P.x) && alturaEn(P.x, P.z) < -0.7;
  // Con el talento Agilidad, como en el servidor (antes el cliente lo ignoraba).
  const vel = MUNDO.velocidad * (nadando ? 0.55 : 1) * (P.vuela ? alaDe(yo, enAbismo(P.x)).vel : P.planea && P.planeoRapido ? 1.35 : velMontura(yo.montado)) * (1 + talento(yo, 'agilidad')) * (yo.dios && yo.diosModo && yo.diosModo.vel ? 3 : 1);
  // Inercia ligera (rapida en el suelo, mas suelta en el aire y el agua). Al
  // lanzar un hechizo sin tocar las teclas, se frena en seco (no se corta).
  const agarre = P.vuela || P.planea ? 4 : nadando ? 5 : !P.suelo ? 3 : 16;
  const kv = 1 - Math.exp(-agarre * dt);
  if (lanzando && !quiere) { P.vx = 0; P.vz = 0; }
  // Cuesta arriba se va algo mas lento y cuesta abajo algo mas rapido (v321).
  let cuesta = 1;
  if (quiere && P.suelo && !P.vuela && !nadando) cuesta = clamp(1 - (alturaEn(P.x + mx * 0.6, P.z + mz * 0.6) - alturaEn(P.x, P.z)) * 0.45, 0.82, 1.12);
  P.vx = lerp(P.vx || 0, quiere ? mx * vel * cuesta : 0, kv); P.vz = lerp(P.vz || 0, quiere ? mz * vel * cuesta : 0, kv);
  pasoEsquiva(ahoraP);   // impulso de ESQUIVAR (pasa por los mismos choques y limites de abajo)
  const rapidez = Math.hypot(P.vx, P.vz);
  P.anda = rapidez > 0.6;
  if (rapidez > 0.05) {
    const enC = enCueva(P.x);
    // Sub-pasos de 0,35 m: a velocidad de vuelo no se atraviesan troncos finos.
    const pasos = Math.max(1, Math.ceil(rapidez * dt / 0.35));
    for (let i = 0; i < pasos; i++) {
      let nx = P.x + P.vx * dt / pasos, nz = P.z + P.vz * dt / pasos;
      if (!enC) { nx = clamp(nx, -MUNDO.limite, MUNDO.limite); nz = clamp(nz, -MUNDO.limite, MUNDO.limite); }
      // Choques con casas, troncos, rocas y PNJ (no al volar alto).
      if (!enC && !(P.vuela && P.y - alturaEn(nx, nz) > 3)) [nx, nz] = empujarFuera(nx, nz);
      // En la cueva se resbala por las paredes (y si ya estas en roca, te deja salir).
      if (enC && caminable(P.x, P.z) && !caminable(nx, nz)) { if (caminable(nx, P.z)) nz = P.z; else if (caminable(P.x, nz)) nx = P.x; else { nx = P.x; nz = P.z; } }
      // Volando, el borde del pueblo es una pared blanda (se aterriza fuera).
      if (P.vuela && zonaEn(nx, nz) === 'pueblo' && zonaEn(P.x, P.z) !== 'pueblo') {
        nx = P.x; nz = P.z; P.vx *= -0.3; P.vz *= -0.3;
        if (ahoraP - (P.avisoPuebloT || 0) > 3000) { P.avisoPuebloT = ahoraP; aviso('En el pueblo no se vuela: aterriza fuera (C para bajar).'); }
      }
      // Las laderas muy empinadas (la cordillera del borde) no se suben.
      const sube = alturaEn(nx, nz) - alturaEn(P.x, P.z);
      if (P.vuela || sube / (vel * dt / pasos + 1e-3) < 1.4) { P.x = nx; P.z = nz; } else { P.vx *= 0.3; P.vz *= 0.3; break; }
    }
    // Gira suave hacia donde va (no de golpe).
    if (quiere) P.ry = lerpAng(P.ry, Math.atan2(mx, mz), 1 - Math.exp(-14 * dt));
    // Movil: con los dos pulgares ocupados la camara se va poniendo sola detras del duende
    // (suave, y no si camina hacia la camara: ahi se quiere ver de frente).
    // Solo cuenta el empuje "hacia adelante" del joystick: de lado no gira (si no, el duende camina en circulos).
    if (MOVIL && quiere && camTouch.id === null && !lanzando && !camAntes) {
      const det = P.ry + Math.PI, dif = Math.abs(Math.atan2(Math.sin(det - camYaw), Math.cos(det - camYaw)));
      const adel = joy.id !== null ? Math.max(0, Math.min(1, -joy.dy)) : 1;
      if (dif < 0.9 && adel > 0.3 && !camCombate) camYaw = lerpAng(camYaw, det, 1 - Math.exp(-0.8 * adel * dt));
    }
    if (mx * der.x + mz * der.z > 0.05) P.f = 1; else if (mx * der.x + mz * der.z < -0.05) P.f = -1;
  }
  // Pasos: uno cada ~1,7 m andando por el suelo, con el sonido de la zona.
  if (P.suelo && !P.vuela && !nadando && !P.muerto && !(yo && yo.montado)) {
    P.pasoD = (P.pasoD || 0) + Math.hypot(P.vx, P.vz) * dt;
    if (P.pasoD > 1.7) {
      P.pasoD = 0;
      const z = zonaEn(P.x, P.z);
      // Polvo bajo los pies al correr (v322): arena en el desierto, nieve en las cumbres.
      if (rapidez > MUNDO.velocidad * 0.8 && !enCueva(P.x)) FX.emitir(P.x - P.vx * 0.04, P.y + 0.08, P.z - P.vz * 0.04, { n: MOVIL ? 3 : 5, color: z === 'desierto' ? '#e8c27a' : z === 'cumbres' ? '#f1f5f9' : '#bfae8e', vel: 0.9, vida: 0.45, grav: -0.6, plano: true, radio: 0.25, tam: 1.1 });
      if (voces < 5)   // los pasos nunca quitan voces al combate
        sfxK(z === 'cumbres' || z === 'desierto' ? 'paso_n' : z === 'cueva' || z === 'eter' || z === 'castillo' || z === 'cavernas' ? 'paso_p' : z === 'pueblo' && Math.hypot(P.x, P.z) < 16 ? 'paso_p' : 'paso_h', 0.09);
    }
  } else if (P.suelo && !P.vuela && !nadando && !P.muerto && yo && yo.montado) {
    // Montado: cascos dobles cada ~2,4 m y una nube de polvo mas grande.
    P.pasoD = (P.pasoD || 0) + Math.hypot(P.vx, P.vz) * dt;
    if (P.pasoD > 2.4) {
      P.pasoD = 0;
      const z = zonaEn(P.x, P.z);
      const pz = z === 'cumbres' || z === 'desierto' ? 'paso_n' : z === 'cueva' || z === 'eter' || z === 'castillo' || z === 'cavernas' ? 'paso_p' : z === 'pueblo' && Math.hypot(P.x, P.z) < 16 ? 'paso_p' : 'paso_h';
      if (!enCueva(P.x)) FX.emitir(P.x - P.vx * 0.06, P.y + 0.1, P.z - P.vz * 0.06, { n: MOVIL ? 4 : 7, color: z === 'desierto' ? '#e8c27a' : z === 'cumbres' ? '#f1f5f9' : '#bfae8e', vel: 1.1, vida: 0.6, grav: -0.6, plano: true, radio: 0.5, tam: 1.3 });
      if (voces < 5) { sfxK(pz, 0.12); setTimeout(() => { if (voces < 5) sfxK(pz, 0.08); }, 70); }
    }
  }
  // Gravedad y suelo (en el agua se nada en la superficie).
  const suelo = Math.max(alturaEn(P.x, P.z), aguaEn(P.x) - 0.9);
  const espacio = !sinControl && (teclas.Space || tocandoSubir);
  // Sobre el vacio del Abismo la altura se mide desde sueloRef (las islas cercanas).
  const sobreVacio = suelo <= VACIO + 1 && enAbismo(P.x), base = baseAltura(P.x, P.z, suelo);
  const abajo = !sinControl && (teclas.KeyC || teclas.ShiftLeft || tocandoBajar);
  if (P.vuela) {
    // Volando: Espacio sube, C (o Mayus) baja; las alas se cansan.
    P.volabaT = ahoraP;
    // Sube y baja con inercia (antes la velocidad saltaba de golpe).
    P.vy = lerp(P.vy || 0, espacio ? 6 : abajo ? -7 : Math.sin(ahoraP / 500) * 0.3, 1 - Math.exp(-dt * 7));
    P.y += P.vy * dt;
    // Techo de vuelo: por encima no se sube y se baja con suavidad (sin tiron al cambiar de suelo).
    if (P.y > base + 45) { if (P.vy > 0) P.vy = 0; P.y = lerp(P.y, base + 45, 1 - Math.exp(-dt * 1.5)); }
    P.alas = Math.max(0, P.alas - dt);
    if (P.alas <= 0) { volar(false); P.planeoAuto = true; aviso('Tus alas se cansaron: planeas hacia el suelo.'); }
    if (P.y <= suelo + 0.05) {
      // Aterrizaje desde el vuelo: polvo, aplastado y aleteo suave si bajaba rapido.
      if (P.vy < -3) { try { FX.emitir(P.x, suelo + 0.1, P.z, { n: MOVIL ? 8 : 14, color: '#bfae8e', vel: 2 + (-P.vy) * 0.15, vida: 0.5, grav: 2, plano: true, radio: 0.4, tam: 1.5 }); } catch (e) {} P.aterrizaT = ahoraP; P.aterrizaK = clamp(-P.vy * 0.011, 0.05, 0.2); SON.tocar('alas', { vol: 0.35 }); }
      P.y = suelo; P.vy = 0; volar(false); P.suelo = true;
    }
  } else {
    // Planeo (AION): Espacio mantenido al caer (o solo, al cansarse las alas).
    // En movil, al caer sobre el vacio se abren las alas solas (no hace falta mantener nada).
    if (MOVIL && sobreVacio && !P.suelo && P.vy < 0 && !P.muerto) P.planeoAuto = true;
    const planeaba = P.planea;
    P.planea = !P.suelo && P.vy < 0 && (espacio || P.planeoAuto) && !P.muerto && !enCueva(P.x) && P.y - suelo > 1.2;
    // Como el servidor: el planeo solo acelera si empieza al dejar de volar (si no, snap3).
    if (P.planea && !planeaba) { P.planeoRapido = ahoraP - (P.volabaT || 0) < 1500; SON.tocar('alas', { vol: 0.5 }); }
    if (P.planea) P.vy += ((abajo ? -6 : -2.2) - P.vy) * Math.min(1, dt * 5);   // abre las alas sin tiron; C/bajar desciende mas rapido
    else { const g = P.vy > 0 ? FIS.gSube : (P.alas > 0 && P.vy < -6 ? 6 : FIS.gCae); P.vy = Math.max(P.vy - g * dt, -FIS.vMaxCaida); }
    P.y += P.vy * dt;
    // Pegado al suelo al bajar cuestas (sin saltitos) y caida al salir de un borde.
    const pegar = P.suelo && P.vy <= 0 && P.y - suelo < FIS.escalon * 0.5 + rapidez * dt * 1.5;
    if (P.y <= suelo || pegar) {
      const aterriza = !P.suelo, vAnt = P.vy;
      if (aterriza && vAnt < -7) FX.emitir(P.x, suelo + 0.1, P.z, { n: 16, color: '#bfae8e', vel: 2.5 - vAnt * 0.15, vida: 0.5, grav: 2, plano: true, radio: 0.4, tam: 1.6 });
      if (aterriza && vAnt < -3) { P.aterrizaT = ahoraP; P.aterrizaK = clamp(-vAnt * 0.011, 0.05, 0.2); }
      // Caida fuerte en tierra: golpe sordo (en el agua suena el chapuzon, abajo).
      if (aterriza) { P.caidaT = ahoraP; P.caidaV = vAnt; if (vAnt < -12 && !(aguaEn(P.x) - 0.9 > alturaEn(P.x, P.z))) SON.tocar('aterriza', { fuerza: clamp((-vAnt - 10) / 18, 0.3, 1) }); }
      P.y = suelo; P.vy = 0; P.suelo = true; P.planea = false; P.planeoAuto = false; P.coyote = FIS.coyote;
      if (aterriza && P.buffer > 0 && !sinControl) { P.buffer = 0; saltar(); }
    } else { P.suelo = false; P.coyote = Math.max(0, P.coyote - dt); }
    P.buffer = Math.max(0, P.buffer - dt);
    if (P.suelo) P.alas = Math.min(ALAS_MAX, P.alas + dt * 3);
    if (yo) { const am = alaDe(yo, enAbismo(P.x)).vuelo; if (am !== ALAS_MAX) { ALAS_MAX = am; P.alas = Math.min(P.alas, am); } }
  }
  // Entrar al agua (caer, bajar volando o meterse andando): chapuzon segun la velocidad de caida.
  const mojado = P.suelo && !P.muerto && aguaEn(P.x) - 0.9 > alturaEn(P.x, P.z);
  if (mojado && !P.mojado) SON.tocar('splash', { vol: 0.9, fuerza: ahoraP - (P.caidaT || 0) < 100 ? clamp(-(P.caidaV || 0) / 20, 0.3, 1) : 0.3 });
  P.mojado = mojado;
  if (P.vuela && zonaEn(P.x, P.z) === 'pueblo') { volar(false); P.planeoAuto = true; }
  if (enAbismo(P.x) && !P.vuela && !P.muerto && P.y < -60 && !caidaEnviada) { caidaEnviada = true; mandar({ t: 'caida' }); }
  else if (caidaEnviada && P.y > -40) caidaEnviada = false;   // el servidor la perdono (planeaba alto): se puede volver a avisar
  // En movil el boton de bajar tambien sirve planeando (desciende mas rapido).
  if (MOVIL) { const vb = P.vuela || P.planea ? 'visible' : 'hidden', el = $('t-bajar'); if (el && el.style.visibility !== vb) el.style.visibility = vb; }
  // Enviar la posicion (por cambios, ~5 por segundo corriendo).
  if (!P.muerto) mandarPos(false);
}
// Base desde la que se mide la altura: el suelo, o sueloRef sobre el vacio del Abismo
// (techo de vuelo, h que se manda al servidor y altura de los demas jugadores).
function baseAltura(x, z, suelo) { return suelo <= VACIO + 1 && enAbismo(x) ? sueloRef(x, z) : suelo; }
// Posicion al servidor: por cambios (abajo), o ya (forzar) antes de un golpe o una
// habilidad para que mida el alcance con la posicion de verdad.
function mandarPos(forzar) {
  // Contrapresion: con el socket atascado no se apilan posiciones viejas; ultimoEnv
  // no cambia, asi la ultima sale en cuanto se vacie (golpes y habilidades no se filtran).
  if (ws && ws.bufferedAmount > 2048 && !forzar) return;
  const ahora = performance.now(), suelo = Math.max(alturaEn(P.x, P.z), aguaEn(P.x) - 0.9), alt = Math.max(0, P.y - baseAltura(P.x, P.z, suelo));
  const modo = P.vuela ? 3 : P.planea ? 4 : P.anda ? 1 : 0;
  const clave = P.x.toFixed(1) + ',' + P.z.toFixed(1) + ',' + modo + ',' + alt.toFixed(0);
  // Por cambios: arrancar, parar, volar o planear se manda ya (50 ms de respiro);
  // si solo avanza, cada 190 ms (justo por debajo de las fotos de 200 ms, para
  // que cada foto traiga posicion nueva); quieto, nada.
  if (clave === ultimoEnv) return;
  if (!forzar && ahora - enviadoT < (modo !== modoEnv ? 50 : 190)) return;
  {
    mandar({ t: 'mv3', x: +P.x.toFixed(2), z: +P.z.toFixed(2), r: +P.ry.toFixed(2), a: modo, h: +alt.toFixed(1) });
    enviadoT = ahora; ultimoEnv = clave; modoEnv = modo;
    if (P.anda && yo) paso('mover');   // primera vez que camina (embudo)
  }
}
function rangoAtaque(o) {
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  return vara ? 23 : 3.0 * (arma.alcance || 1) + (o.j ? 1.2 : 0.3);
}
// ── MASCOTA 3D: la de la tienda te sigue (sprite de su hoja 2D, con su tinte) y la ven los demas ──
// Va en la escena (no como hija de la figura) y se guarda en el jugador (q.masc) para que sobreviva a rehacer la figura.
const MAX_MASC_AJENAS = CAL === 'baja' ? 0 : MOVIL && CAL === 'media' ? 3 : 6;
const tinteMasc = new Map();
function tenirMasc(im, hex) {
  const k = im.src + hex;
  if (tinteMasc.has(k)) return tinteMasc.get(k);
  const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.45; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(im, 0, 0);
  tinteMasc.set(k, c);
  return c;
}
function ponMascota(q, id) {
  const ma = id && MASCOTAS[id], hj = ma && HOJAS[ma.hoja];
  if (!hj) id = '';
  if ((q.mascId || '') === id) return;
  q.mascId = id;
  if (q.masc) { escena.remove(q.masc.s); q.masc.tx.dispose(); q.masc.s.material.dispose(); q.masc = null; }
  if (!id) return;
  Promise.resolve(cargarImg(A + 'enemigos/sheets/' + ma.hoja + '.png')).then(im => {
    if (!im || q.mascId !== id || q.masc || q.mascFuera) return;
    const img = ma.tinte ? tenirMasc(im, ma.tinte) : im;
    const tx = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
    tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false;
    tx.colorSpace = THREE.SRGBColorSpace; tx.needsUpdate = true;
    const cols = Math.max(1, Math.round(img.width / hj.fw)), filas = Math.max(1, Math.round(img.height / hj.fh));
    tx.repeat.set(1 / cols, 1 / filas);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, alphaTest: 0.35 }));
    const e = (ma.alto || 24) * 1.3 / hj.ideal;
    s.scale.set(hj.fw * e / PX_M, hj.fh * e / PX_M, 1); s.center.set(0.5, 0); s.visible = false;
    escena.add(s);
    q.masc = { s, tx, hj, cols, filas, vuela: !!ma.vuela, x: q.x, z: q.z, y: q.y || P.y || 0, mir: true, nuevo: true };
  });
}
function quitarMascota(q) { q.mascFuera = true; ponMascota(q, ''); }
let mascTopeT = 0;
function moverMascota(q, esYo, t, dt) {
  const m = q.masc;
  if (!m) return;
  const f = q.fig;
  const figVis = f && (f.tipo === 'modelo' ? f.raiz.visible : f.m.visible);
  const fuera = esYo ? !!(yo && yo.exped) || P.muerto : q.muerto || !q.mascVer;
  m.s.visible = !!figVis && !fuera;
  if (!m.s.visible) { m.nuevo = true; return; }
  const ry = esYo ? P.ry || 0 : q.ry || 0, sn = Math.sin(ry), cs = Math.cos(ry);
  const tx = q.x - sn * 1.2 + cs * 0.6, tz = q.z - cs * 1.2 - sn * 0.6;
  const yb = esYo ? P.y : q.y;
  if (m.nuevo || Math.hypot(tx - m.x, tz - m.z) > 20) { m.x = tx; m.z = tz; m.y = yb; m.nuevo = false; }
  const k = 1 - Math.exp(-6 * dt), ox = m.x, oz = m.z;
  m.x += (tx - m.x) * k; m.z += (tz - m.z) * k;
  const suelo = alturaEn(m.x, m.z), base = Math.abs(suelo - yb) < 3 ? suelo : yb;
  m.y += (base - m.y) * Math.min(1, k * 1.5);
  const ts = t / 1000, anda = Math.abs(tx - m.x) + Math.abs(tz - m.z) > 0.15;
  // Las voladoras flotan a 0,5 m; las de suelo van dando saltitos.
  const alto = m.vuela ? 0.5 + Math.sin(ts * 6) * 0.08 : 0.05 + (anda ? Math.abs(Math.sin(ts * 9)) * 0.12 : Math.abs(Math.sin(ts * 3)) * 0.04);
  m.s.position.set(m.x, m.y + alto, m.z);
  // Cuadro de caminar de la hoja y hacia donde mira (en pantalla).
  const dd = (m.x - ox) * der.x + (m.z - oz) * der.z;
  if (Math.abs(dd) > 0.002) m.mir = dd > 0;   // quieta: conserva el lado
  const h = m.hj, mov = h.mov || [0, 0, 1];
  const col = mov[1] + (anda || m.vuela ? Math.floor(ts * 8) % Math.max(1, mov[2]) : 0), fila = mov[0];
  const voltea = m.mir === !!h.izq;
  m.tx.repeat.x = (voltea ? -1 : 1) / m.cols;
  m.tx.offset.set((voltea ? col + 1 : col) / m.cols, 1 - (fila + 1) / m.filas);
}
function moverMascotas(t, dt) {
  if (yo) ponMascota(P, yo.mascota || '');
  // Ajenas: como mucho las MAX_MASC_AJENAS mas cercanas (en calidad baja, ninguna).
  if (t - mascTopeT > 500) {
    mascTopeT = t;
    const ls = [];
    // Con histeresis: las que ya se ven llevan 20 m de ventaja (sin parpadeo en el borde del tope).
    for (const o of otros.values()) { const ya = o.mascVer; o.mascVer = false; if (o.ma && !o.muerto) { o._dm = Math.hypot(o.x - P.x, o.z - P.z) - (ya ? 20 : 0); ls.push(o); } }
    ls.sort((a, b) => a._dm - b._dm);
    for (let i = 0; i < ls.length && i < MAX_MASC_AJENAS; i++) ls[i].mascVer = true;
  }
  // Fuera del tope solo se esconde (moverMascota pone visible = false); se libera la textura tras 30 s fuera.
  for (const o of otros.values()) {
    if (o.mascVer || !o.ma) { ponMascota(o, o.mascVer ? o.ma : ''); o.mascFueraT = 0; }
    else if (o.mascId) { if (!o.mascFueraT) o.mascFueraT = t; else if (t - o.mascFueraT > 30000) { ponMascota(o, ''); o.mascFueraT = 0; } }
    moverMascota(o, false, t, dt);
  }
  moverMascota(P, true, t, dt);
}
function animarJugador(q, esYo, t) {
  const f = q.fig;
  if (!f) return;
  if (!esYo) { const sq = Math.max(alturaEn(q.x, q.z), aguaEn(q.x) - 0.9); q.y = baseAltura(q.x, q.z, sq) + (q.vh = lerp(q.vh || 0, q.h || 0, 0.15)); }
  const y = esYo ? P.y : q.y;
  const anda = esYo ? P.anda : q.a === 1;
  if (!esYo) { const dx = q.tx - q.x, dz = q.tz - q.z; if (Math.abs(dx * der.x + dz * der.z) > 0.02) q.f = (dx * der.x + dz * der.z) > 0 ? 1 : -1; }
  const mira = (esYo ? P.f : q.f) !== -1;
  if (f.tipo === 'modelo') {
    const mo = esYo ? monturaPrueba || (yo && yo.montado) || '' : q.mo || '';
    f.montar(P.vuela && esYo ? '' : mo);
    f.andaMontura = anda || (esYo && !!monturaPrueba);   /* en el probador galopa en el sitio */
    const e = estadoJugador(q, esYo, t, anda);
    const golpeNuevo = e === 'ataca' && (q.atkT || 0) !== f.atkVisto;
    if (golpeNuevo) f.atkVisto = q.atkT;
    f.estado(f.montura && e !== 'ataca' && e !== 'lanza' && e !== 'muere' ? 'monta' : e, t, golpeNuevo);
    if ((q.heridoT || 0) !== f.heridoVisto) { f.heridoVisto = q.heridoT || 0; if (t - f.heridoVisto < 300) f.modelo.golpe(); }
    if (esYo) {
      // Se aplasta un poco al aterrizar y se estira al saltar (v321).
      if (P.aterrizaT && P.aterrizaT !== f.aplastaVisto) { f.aplastaVisto = f.aplastaT = P.aterrizaT; f.aplastaK = P.aterrizaK; }
      f.estira = !P.suelo && !P.vuela && !P.planea ? clamp(P.vy * 0.008, -0.03, 0.07) : 0;
    }
    f.pausa = esYo && t < pausaAnim;
    if (f.modelo) f.modelo.combo = esYo ? P.combo || 0 : 0;   // pose del combo (solo el propio duende; los demas, el tajo de siempre)
    if (esYo) {
      // Tu duende gira la cabeza hacia el monstruo marcado o el mas cercano (< 10 m).
      let mir = null;
      const ob = objetivo && mons.get(objetivo);
      if (ob && !ob.muereT && Math.hypot(ob.x - P.x, ob.z - P.z) < 10) mir = ob;
      else if (!P.muerto) { let dm = 10; for (const o of mons.values()) if (!o.muereT) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < dm) { dm = d; mir = o; } } }
      mirarSuave(f, P, t, P.ry, P.muerto ? null : mir);
    }
    f.poner(q.x, y, q.z, esYo ? P.ry : q.ry, t);
    if (!esYo) {
      const vuela = q.a === 3 || q.a === 4;
      const tipoAla = q.al || 'aprendiz';
      if (q.alas && q.alas.userData.id !== tipoAla) { quitarAlas(q.alas); q.alas = null; }
      if (vuela && !q.alas) q.alas = nuevasAlas(tipoAla);
      if (q.alas) { q.alas.visible = vuela && f.raiz.visible; if (q.alas.visible) ponerAlas(q.alas, q.x, y, q.z, q.ry, t, q.a === 4 ? 'planea' : ''); }
    }
    return;
  }
  if (f.tipo === 'anim') {
    let lista = ANIM_IDX.reposo, vel = 0.23;
    const atk = t - (q.atkT || 0) < 350, herido = t - (q.heridoT || 0) < 250;
    if (atk) lista = ANIM_IDX.ataca; else if (herido) lista = ANIM_IDX.herido; else if (anda || (esYo && !P.suelo)) { lista = ANIM_IDX.camina; vel = 0.09; }
    const idx = atk ? lista[Math.min(lista.length - 1, Math.floor((t - q.atkT) / 350 * lista.length))] : lista[Math.floor(t / 1000 / vel) % lista.length];
    f.cuadro(idx, 0, mira);
    f.poner(q.x, y, q.z, camYaw);
  } else {
    f.cuadro(0, 0, mira);
    const rebote = anda ? Math.abs(Math.sin(t / 90)) * 0.12 : Math.sin(t / 400) * 0.03;
    f.poner(q.x, y + rebote, q.z, camYaw, [1, 1 + (t - (q.atkT || 0) < 200 ? -0.08 : 0)]);
  }
  f.m.material.opacity = (esYo ? P.muerto : q.muerto) ? 0.35 : 1;
}
function animarMon(o, t) {
  const f = o.fig;
  if (!f) return;
  // Alerta (v351): al pasar a perseguirte (st 1) da un respingo corto y te clava la mirada.
  // st 1 tambien es pasear o volver a casa: solo cuenta si corre (>2,2 m/s) hacia ti y de cerca.
  const dP = Math.hypot(P.x - o.x, P.z - o.z), vM = Math.hypot(o.vx || 0, o.vz || 0);
  const haciaMi = o.st === 1 && !o.muereT && !P.muerto && dP < 20 && vM > 2.2 && (o.vx || 0) * (P.x - o.x) + (o.vz || 0) * (P.z - o.z) > 0.5 * vM * dP;
  if (haciaMi && o._hmAnt === false && o._stAnt !== 2 && !(o.alertaT && t - o.alertaT < 4000)) {
    o.alertaT = t;
    // Te ve y grita su voz (v357): 1 cada 4 s por monstruo, solo de cerca.
    if (t - (o.vozAlT || 0) > 4000) { o.vozAlT = t; try { sfxK(vozDe(o.k), 0.25, o.x, o.z); } catch (e) {} }
  }
  o._hmAnt = haciaMi; o._stAnt = o.st;
  if (f.tipo === 'modelo') {
    const mueve = o.st === 1 || Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05;
    let e = o.muereT ? 'muere' : o.st === 2 ? 'ataca' : t - o.golpeT < 220 ? 'herido' : mueve ? (o.st === 1 ? 'corre' : 'anda') : 'quieto';
    if (MONSTRUOS[o.k].vuela && !o.muereT && e !== 'ataca') e = 'vuela';
    f.estado(e, t);
    if (o.golpeT !== f.golpeVisto) { f.golpeVisto = o.golpeT; if (t - o.golpeT < 300) f.modelo.golpe(); }
    const def = MONSTRUOS[o.k];
    const y = Math.max(alturaEn(o.x, o.z), def.vuela ? alturaEn(o.x, o.z) + 1.2 : aguaEn(o.x) - 0.9);
    const dtR = Math.min(0.1, Math.max(0, (t - (o._tRy || t)) / 1000)); o._tRy = t;   // giro igual a 30 o 60 fps
    o.ryV = lerpAng(o.ryV === undefined ? o.ry : o.ryV, o.ry, 1 - Math.exp(-12 * dtR));
    // Fuera del tope de figuras (topeMons): poner() deja solo la sombra-disco; sin mirada, cojera ni retroceso.
    if (f._cerca === false) { f.poner(o.x, y, o.z, o.ryV, t, 1); return; }
    // Mira al jugador mientras te persigue (o en el respingo de alerta), solo de cerca.
    const kAl = o.alertaT ? (t - o.alertaT) / 180 : 1;
    mirarSuave(f, o, t, o.ryV, !o.muereT && !P.muerto && dP < 20 && (haciaMi || (o.st === 2 && dP < 5) || kAl < 1) ? P : null);
    if (kAl >= 0 && kAl < 1 && !o.muereT && dP < 20 && f.modelo) f.modelo.mirarK = 1;
    f.pausa = pausaMon === o.id && t < pausaAnim;
    f.poner(o.x, y, o.z, o.ryV, t, Math.min(1, (t - o.nace) / 400));
    if (kAl >= 0 && kAl < 1 && !o.muereT && !MENOS_MOV) {
      f.raiz.position.y += 0.15 * Math.sin(Math.PI * kAl);
      f.raiz.scale.y *= kAl < 0.35 ? lerp(1, 0.88, kAl / 0.35) : kAl < 0.75 ? lerp(0.88, 1.06, (kAl - 0.35) / 0.4) : lerp(1.06, 1, (kAl - 0.75) / 0.25);
    }
    // Cojera (v357): con menos del 25 % de vida se tambalea, va encorvado y suda gotas celestes.
    // poner() reasigna rotation/position cada cuadro, asi que sumar aqui no se acumula.
    if (!o.muereT && o.mx > 0 && o.hp > 0 && o.hp / o.mx < 0.25 && f.raiz.visible && dP < 40) {
      f.raiz.rotation.z += Math.sin(t / 140 + o.id) * (MENOS_MOV ? 0.05 : 0.12);
      if (mueve) f.raiz.position.y -= 0.15 * 0.12 * Math.abs(Math.sin(t / 90));
      if (!MENOS_MOV && CAL !== 'baja' && t - (o.sudorT || 0) > 2500) { o.sudorT = t; try { FX.emitir(o.x, y + 1.3, o.z, { n: 2, color: '#7dd3fc', vel: 0.8, vida: 0.6, grav: 3, tam: 0.8 }); } catch (e) {} }
    }
    retroceso(o, t, f.raiz); preparaGolpe(o, t, f.raiz);
    return;
  }
  const h = f.hoja;
  const dx = o.tx - o.x, dz = o.tz - o.z;
  const sx = Math.sin(o.ry), sz = Math.cos(o.ry);
  const lado = sx * der.x + sz * der.z;
  if (Math.abs(lado) > 0.05) o.f = lado > 0 ? 1 : -1;
  let fila = h.mov[0], col = h.mov[1];
  if (o.muereT) {
    const k = Math.min(1, (t - o.muereT) / 1400);
    fila = h.golpe[0]; col = h.muerte[0] + Math.min(h.muerte[1] - 1, Math.floor(k * h.muerte[1]));
  } else if (t - o.golpeT < 260 || o.st === 2) {
    fila = h.golpe[0]; col = h.golpe[1] + Math.floor(t / 160) % h.golpe[2];
  } else if (o.st === 1 || Math.hypot(dx, dz) > 0.05) {
    col = h.mov[1] + Math.floor(t / 110) % h.mov[2];
  } else col = h.mov[1] + Math.floor(t / 420) % Math.min(2, h.mov[2]);
  f.cuadro(col, fila, o.f !== -1);
  const def = MONSTRUOS[o.k];
  const y = Math.max(alturaEn(o.x, o.z), def.vuela ? alturaEn(o.x, o.z) + 1.2 + Math.sin(t / 300 + o.id) * 0.3 : aguaEn(o.x) - 0.9);
  const nace = Math.min(1, (t - o.nace) / 400);
  f.poner(o.x, y, o.z, camYaw, [nace, nace]);
  retroceso(o, t, f.m); preparaGolpe(o, t, f.m);
}
// Preparacion del golpe ('mpre'): se agacha y se echa atras (solo la figura) hasta que pega.
const PRE_MON_MS = 360;
let mesqT = 0;   // ultimo '¡Esquivado!' por aviso rojo
let mpreSonT = 0;   // ultimo sonido de amenaza del aviso rojo (tope 1 cada 500 ms)
function preparaGolpe(o, t, obj) {
  const dp = t - (o.preT || 0), pm = o.preMs || PRE_MON_MS;
  if (!obj || dp < 0 || dp >= pm || o.muereT) return;
  const k = Math.sin(Math.min(1, dp / (pm * 0.6)) * Math.PI / 2);   // baja rapido y aguanta
  const dx = o.x - P.x, dz = o.z - P.z, l = Math.hypot(dx, dz) || 1;
  obj.position.x += dx / l * 0.18 * k; obj.position.z += dz / l * 0.18 * k;
  obj.scale.x *= 1 + 0.1 * k; obj.scale.y *= 1 - 0.16 * k; obj.scale.z *= 1 + 0.1 * k;
}
// Retroceso cosmetico del monstruo golpeado: se empuja lejos de ti y se aplasta 150 ms (solo la figura; o.x/o.z no cambian).
function retroceso(o, t, obj) {
  const dg = t - (o.golpeT || 0);
  if (!obj || dg < 0 || dg >= 150) return;
  const k = 1 - dg / 150;
  const de = o.golpeDe || P, dx = o.x - de.x, dz = o.z - de.z, l = Math.hypot(dx, dz) || 1;
  const em = 0.25 * k * (o.golpeC ? 1.6 : 1);
  obj.position.x += dx / l * em; obj.position.z += dz / l * em;
  obj.scale.x *= 1 + 0.12 * k; obj.scale.y *= 1 - 0.1 * k; obj.scale.z *= 1 + 0.12 * k;
}
// Color de nombre comprado («Color de tu nombre»): igual que colorTinte de CLASSIC; el arcoíris rota solo.
function colorTinte3(id) { const tn = TINTES[id]; if (!tn) return ''; return tn.color === 'arcoiris' ? 'hsl(' + (Math.floor(performance.now() / 130) % 12) * 30 + ',90%,68%)' : tn.color; }
// Etiquetas en dos pasos para no gastar en las que no se ven: lblVe() decide si la etiqueta cae en
// rango, delante de la camara y fuera del HUD (deja su sitio en lblSx/lblSy; si no, la oculta), y solo
// entonces se arma su HTML y lblPon() lo escribe. El transform se escribe solo si se movio 0,1 px.
let lblSx = 0, lblSy = 0, lblW = 0, lblH = 0, lblUsN = 0;
const lblUsX = new Float32Array(160), lblUsY = new Float32Array(160), lblMons = [];
function lblVe(lbl, x, y, z, maxD) {
  const dx = x - P.x, dz = z - P.z;
  let ve = dx * dx + dz * dz < maxD * maxD;
  if (ve) { vtmp.set(x, y, z).project(camara); ve = !(vtmp.z > 1 || vtmp.z < -1); }
  if (ve) {
    lblSx = (vtmp.x + 1) / 2 * lblW; lblSy = (1 - vtmp.y) / 2 * lblH;
    for (let i = 0; i < rectsHud.length; i++) { const r = rectsHud[i]; if (lblSx > r.left - 24 && lblSx < r.right + 24 && lblSy > r.top - 2 && lblSy < r.bottom + 16) { ve = false; break; } }
  }
  if (!ve && lbl.style.display !== 'none') lbl.style.display = 'none';
  return ve;
}
function lblPon(lbl, html) {
  if (lbl.style.display === 'none') lbl.style.display = '';
  if (lbl._h !== html) { lbl.innerHTML = html; lbl._h = html; }
  const rx = Math.round(lblSx * 10), ry = Math.round(lblSy * 10);
  if (rx !== lbl._rx || ry !== lbl._ry) { lbl._rx = rx; lbl._ry = ry; lbl.style.transform = `translate(${rx / 10}px,${ry / 10}px) translate(-50%,-100%)`; }
}
// Etiquetas de monstruo: la que caeria encima de otra ya puesta se oculta.
function lblPisa(lbl) {
  for (let i = 0; i < lblUsN; i++) if (Math.abs(lblUsX[i] - lblSx) < 70 && Math.abs(lblUsY[i] - lblSy) < 18) { if (lbl.style.display !== 'none') lbl.style.display = 'none'; return true; }
  return false;
}
function lblUsa() { if (lblUsN < 160) { lblUsX[lblUsN] = lblSx; lblUsY[lblUsN++] = lblSy; } }
const lblOrden = (a, b) => a._dl - b._dl;
function etiquetas(t) {
  lblW = innerWidth; lblH = innerHeight;
  if (yo && P.lbl && lblVe(P.lbl, P.x, P.y + 2.15 + (P.fig && P.fig.montura ? 1.2 : 0), P.z, 999)) lblPon(P.lbl, `<span style="color:${yo.dios ? '#ffd84a' : (yo.tinte && colorTinte3(yo.tinte)) || '#ffe600'}">${yo.dios ? 'GM ' : ''}${esc(yo.nombre)}</span>${yo.titulo && LOGROS.find(l => l.id === yo.titulo) ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(LOGROS.find(l => l.id === yo.titulo).titulo)}»</small>` : ''}${hermInfo ? `<small style="display:block;color:${HERM_COLORES[hermInfo.color] || '#4ade80'};font-size:10px">&lt;${esc(hermInfo.nombre)}&gt;</small>` : ''}`);
  for (const o of otros.values()) {
    const cl = CLASES[o.cl];
    if (lblVe(o.lbl, o.x, (o.y || alturaEn(o.x, o.z)) + 2.15 + (o.fig && o.fig.montura ? 1.2 : 0), o.z, 70)) lblPon(o.lbl, `<span style="color:${o.gm ? '#ffd84a' : o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? '#ff4d4d' : (o.tn && colorTinte3(o.tn)) || (cl ? cl.color : '#fff')}">${o.gm === 2 ? 'DUEÑO ' : o.gm ? 'MOD ' : ''}${o.fc && enAbismo(o.x) ? (o.fc === 'luz' ? '☀ ' : '🌑 ') : ''}${o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? '⚔ ' : ''}${esc(o.n)} · Nv${o.lv}</span>${o.ti ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(o.ti)}»</small>` : ''}${o.hn ? `<small style="display:block;color:${HERM_COLORES[o.hc] || '#4ade80'};font-size:10px">&lt;${esc(o.hn)}&gt;</small>` : ''}${o.ra && enAbismo(o.x) ? `<small style="display:block;color:#c4b5fd;font-size:10px">${RANGOS[o.ra].n}</small>` : ''}<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})${o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? ";background:#ff3344" : ""}"></i></span>`);
  }
  const kMis = tipoMision();
  // '❗' solo en el monstruo de mision vivo mas cercano; etiquetas de cerca a lejos (el objetivo primero) y sin encimarse.
  let misId = null, misD = 1e9;
  for (const o of mons.values()) if (o.k === kMis && !o.muereT) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < misD) { misD = d; misId = o.id; } }
  lblMons.length = 0; lblUsN = 0;
  for (const o of mons.values()) { o._dl = o.id === objetivo ? -2 : o.id === misId ? -1 : Math.hypot(o.x - P.x, o.z - P.z); lblMons.push(o); }
  lblMons.sort(lblOrden);
  for (const o of lblMons) {
    if (o.muereT) { if (o.lbl && o.lbl.style.display !== 'none') o.lbl.style.display = 'none'; continue; }
    if (o.fig && o.fig._cerca === false && o.id !== objetivo) { if (o.lbl && o.lbl.style.display !== 'none') o.lbl.style.display = 'none'; continue; }
    const def = MONSTRUOS[o.k], el = o.id === objetivo, mis = o.id === misId;
    const alto = o.fig ? altoFig(o.fig) : 2;
    const herido = o.hp < o.mx || el;
    if (lblVe(o.lbl, o.x, alturaEn(o.x, o.z) + alto + 0.2, o.z, el ? 90 : (o.j || mis ? 70 : o.noct ? 55 : 38)) && (el || mis || !lblPisa(o.lbl))) { lblUsa(); lblPon(o.lbl, `${o.cast && o.cast.fin > t ? `<b style="display:block;color:#fb923c;font-size:12px">🔮 ${esc(o.cast.n)}…</b>` : ''}<span style="color:${o.ra ? o.ti || '#ffd84a' : o.iv ? '#ff5a1f' : o.j ? '#ff6bf0' : colorNivel(o.nv)}">${o.alertaT && t - o.alertaT < 600 && t >= o.alertaT ? '<b style="color:#ff4d4d;font-size:15px">! </b>' : ''}${mis ? '<b style="color:#ffd84a;font-size:15px">❗</b>' : ''}${o.ra ? (o.la ? '💰 ' : '★ ') + esc(o.ra) + (o.af ? ' · ' + ({ furioso: '😡', sanguinario: '🩸' }[o.af] || '') : '') + ' · ' :o.iv ? '⚔ ' : o.j ? '★ ' : ''}${asedio && asedio.dormido && o.id === asedio.guardian ? '💤 ' : ''}${def && def.dispara ? '🏹 ' : ''}${def && def.vel >= 1.25 ? '⚡ ' : ''}${o.noct ? '<b style="color:#c4a8ff">🌙 ' + esc(def.nombre) + ' nocturno</b> ' : herido || o.j || mis ? esc(def.nombre) + ' ' : ''}${o.ra ? `<span style="color:${colorNivel(o.nv)}">${marcaNivel(o.nv)}Nv${o.nv}</span>` : marcaNivel(o.nv) + 'Nv' + o.nv}</span>${herido ? `<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>` : ''}`); }
  }
  for (const av of aventureros) if (lblVe(av.lbl, av.x, alturaEn(av.x, av.z) + 2.15, av.z, 24)) lblPon(av.lbl, `${av.diceT > t ? `<span style="display:block;background:rgba(255,255,255,.92);color:#222;border-radius:8px;padding:2px 7px;margin:0 auto 2px;font-weight:600;white-space:normal;width:max-content;max-width:170px">${esc(av.dice)}</span>` : ''}<span style="color:#93c5fd">${esc(Math.hypot(av.x - P.x, av.z - P.z) < 10 ? av.n : av.n.split(' ')[0])}</span> <small style="color:#bbb;font-size:9px">PNJ</small>`);
  if (decoTp.lbl) { if (decoTp.puesto) { if (lblVe(decoTp.lbl, decoTp.puesto.x, decoTp.puesto.y + 1.6, decoTp.puesto.z, 40)) lblPon(decoTp.lbl, '<span style="color:#4ade80">Abuela · Tienda de la fiesta</span>'); } else decoTp.lbl.style.display = 'none'; }
  { const mk = marcasNpc();
    for (const n of npcs) {
      const m = mk.get(n.nombre), rol = n.rol || ROL_NPC[n.tipo], cerca = Math.hypot(n.x - P.x, n.z - P.z) < 60;
      if (lblVe(n.lbl, n.x, n.y + 2.4, n.z, m ? 140 : 60)) lblPon(n.lbl, `${m ? `<b class="npc-marca">${m}</b>${cerca ? '<br>' : ''}` : ''}${cerca ? `<span style="color:#4ade80">${esc(n.nombre)}</span>${rol ? `<br><small style="color:#fde68a;font-size:11px">${rol}</small>` : ''}` : ''}`);
    } }
}
// ── TEMA DEL PUEBLO ──
// En el Pueblo Duende suena el tema del juego (audio/tema_duende.mp3, la musica
// del dueño); fuera, la musica generada de cada zona (musica.js). Se pide la
// primera vez que hace falta (1 MB) y reintenta tras el primer toque si el
// navegador bloquea el audio.
const tema = new Audio(); tema.loop = true; tema.volume = 0.3; tema.preload = 'none';
let temaOn = false;
let temaMal = false;   // el MP3 fallo (red, formato): no se reintenta, suena la generada
let temaBloq = false;   // el navegador rechazo play() (autoplay): suena la generada hasta el siguiente toque
// El MP3 (1 MB) solo con red 4G y sin ahorro de datos; si no, suena la musica generada (gratis).
// Sin navigator.connection (iPhone, Firefox) se baja como siempre.
function redTema() { try { const c = navigator.connection; return !c || (!c.saveData && (!c.effectiveType || c.effectiveType === '4g')); } catch (e) { return true; } }
function temaPueblo(z) {
  // En las fiestas (T'anta Wawa, Cosecha) el pueblo suena con la fiesta andina generada (musica.evento), no con el MP3.
  let fiesta = false; try { fiesta = /^(tanta|cosecha)/.test((temporadaDe() || {}).id || ''); } catch (e) {}
  const quiere = sonido && !fiesta && !document.hidden && !fuera3 && z === 'pueblo' && !enCueva(P.x) && !enAbismo(P.x) && (temaOn || !!tema.src || redTema()) && !temaBloq && !temaMal;
  if (quiere === temaOn) return;
  temaOn = quiere;
  if (quiere) {
    if (!tema.src) tema.src = '/audio/tema_duende.mp3';
    const p = tema.play(); if (p && p.then) p.then(() => { if (temaOn) musica.activo(false); }, er => { if (er && er.name === 'AbortError') return; temaOn = false; if (er && er.name === 'NotAllowedError') temaBloq = true; else { temaMal = true; try { tema.removeAttribute('src'); } catch (e2) {} } if (sonido && !document.hidden && !fuera3) musica.activo(true); }); else musica.activo(false);
  } else {
    tema.pause();
    if (sonido && !document.hidden && !fuera3) musica.activo(true);
  }
}
// Reintento dentro de un gesto del jugador (iPhone / WebView de Telegram solo dejan sonar ahi).
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => { if (!temaBloq) return; temaBloq = false; try { temaPueblo(zonaActual || zonaEn(P.x, P.z)); } catch (e) {} }, true);
// ── CORRIENTES DE VIENTO DEL ABISMO ──
// Columnas de aire celeste entre islas (mmo/js/abismo3d.js CORRIENTES): el servidor
// recarga las alas al cruzarlas volando o planeando y avisa con 'corriente'.
const corrientes3 = [];
function crearCorrientes() {
  const geoC = new THREE.CylinderGeometry(7, 7, 70, 20, 1, true), geoA = new THREE.TorusGeometry(7.5, 0.35, 6, 32);
  for (const c of CORRIENTES) {
    const col = new THREE.Mesh(geoC, new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending }));
    col.position.set(c.x, 30, c.z);
    const aros = [0, 1, 2].map(i => { const a = new THREE.Mesh(geoA, new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); a.rotation.x = Math.PI / 2; a.position.set(c.x, 10 + i * 22, c.z); escena.add(a); return a; });
    escena.add(col);
    corrientes3.push({ col, aros });
  }
}
function animarCorrientes(t) {
  for (const c of corrientes3) {
    c.col.material.opacity = 0.09 + 0.05 * Math.sin(t / 600 + c.col.position.x);
    c.aros.forEach((a, i) => { a.position.y = 5 + ((t / 70 + i * 22) % 66); a.rotation.z = t / 900; });   // los aros suben: el viento empuja hacia arriba
  }
}
// ── CORRIENTES DE VIENTO DEL MUNDO ABIERTO ──
// Una por zona junto al cofre legendario (mmo/js/mundo3d.js corrientesMundo):
// misma recarga de alas y mismo aviso 'corriente' del servidor. Geometria y
// materiales compartidos por todas; en movil o calidad baja, un solo aro.
const corrM3 = [];
let matCorrM = null;
function crearCorrientesMundo() {
  const geoC = new THREE.CylinderGeometry(7, 7, 60, MOVIL || CAL === 'baja' ? 12 : 20, 1, true), geoA = new THREE.TorusGeometry(7.5, 0.35, 6, MOVIL || CAL === 'baja' ? 16 : 32);
  matCorrM = { col: new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending }), aro: new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }) };
  const nAros = MOVIL || CAL === 'baja' ? 1 : 3;
  for (const c of corrientesMundo(MAPAS, MONSTRUOS)) {
    const col = new THREE.Mesh(geoC, matCorrM.col);
    col.position.set(c.x, c.y + 28, c.z);
    const aros = [];
    for (let i = 0; i < nAros; i++) { const a = new THREE.Mesh(geoA, matCorrM.aro); a.rotation.x = Math.PI / 2; a.position.set(c.x, c.y + 2 + i * 20, c.z); escena.add(a); aros.push(a); }
    escena.add(col);
    corrM3.push({ col, aros, y: c.y });
  }
}
function animarCorrientesMundo(t) {
  if (!matCorrM) return;
  matCorrM.col.opacity = 0.09 + 0.05 * Math.sin(t / 600);
  for (const c of corrM3) {
    const lejosC = Math.abs(c.col.position.x - P.x) > 220 || Math.abs(c.col.position.z - P.z) > 220;
    if (lejosC !== c.fija) { c.fija = lejosC; c.col.updateMatrixWorld(true); c.col.matrixAutoUpdate = false; c.col.matrixWorldAutoUpdate = false; for (const a of c.aros) { if (lejosC) a.updateMatrixWorld(true); a.matrixAutoUpdate = a.matrixWorldAutoUpdate = !lejosC; } }
    if (lejosC) continue;   // lejos no se anima (ni se ve con la niebla)
    c.aros.forEach((a, i) => { a.position.y = c.y + 1 + ((t / 70 + i * 20) % 56); a.rotation.z = t / 900; });
  }
}
// ── EVENTO DE TEMPORADA (data TEMPORADAS) ──
// Pildora bajo el marco: «🍞 34/50 · 3 d» (lo juntado, la meta del siguiente
// titulo y lo que queda). Va tambien en movil; al tocarla explica el evento.
function textoTemp3(tp) {
  const n = (yo && yo[tp.campo]) || 0, meta = n < 50 ? 50 : n < 200 ? 200 : 0;
  const ms = tp.fin - Date.now(), queda = ms >= 86400000 ? Math.floor(ms / 86400000) + ' d' : Math.max(1, Math.ceil(ms / 3600000)) + ' h';
  return { n, meta, txt: tp.emoji + ' ' + n.toLocaleString('es') + (meta ? '/' + meta : ' ✓') + ' · ' + queda };
}
// La Abuela del puesto de t'anta wawas dice una frase (sin repetir la anterior) y abre la tienda del evento.
function abrirAbuela() {
  // Sus frases son de Todos los Santos (t'anta wawas): en otras fiestas el puesto sigue, pero calla.
  const L = (decoTp.campo === 'tantas' && LORE_NPC && LORE_NPC.abuela) || [];
  if (L.length) {
    let i = Math.floor(Math.random() * L.length);
    if (L.length > 1 && i === abrirAbuela.ult) i = (i + 1) % L.length;
    abrirAbuela.ult = i;
    if (L[i]) aviso('👵 Abuela: «' + L[i] + '»', 'ok');
  }
  try { V.abrirTiendaTemp(); } catch (e) {}
}
function pintarTemp3() {
  const el = $('temp3');
  if (!el) return;
  const tp = yo ? temporadaDe() : null;
  let txt = tp ? textoTemp3(tp).txt : '', prox = null;
  // Sin evento: la cuenta atras del siguiente (si falta un mes o menos), en tenue.
  if (yo && !tp) {
    prox = proxTemp3();
    if (prox) { const ms = prox.ini - Date.now(); txt = ms > 30 * 86400000 ? '' : prox.emoji + ' en ' + (ms >= 86400000 ? Math.floor(ms / 86400000) + ' d' : Math.max(1, Math.ceil(ms / 3600000)) + ' h'); if (!txt) prox = null; }
  }
  if (el._h !== txt) { el.textContent = txt; el._h = txt; el.style.color = tp ? tp.color : prox ? prox.color : ''; el.style.opacity = prox ? '.7' : ''; }
  // La historia del evento, una vez por evento y personaje del navegador.
  if (tp && LORE_TEMPORADA[tp.campo] && pintarTemp3.visto !== tp.id) {
    pintarTemp3.visto = tp.id;   // por id: con la pestaña abierta al pasar de un evento al otro tambien sale la del nuevo
    let ya = false; try { ya = localStorage.getItem('dq3_lore_tp') === tp.id; } catch (e) {}
    // Se marca vista cuando de verdad sale (tras la mision 1): en movil el tutorial ya no se la come.
    if (!ya) setTimeout(() => despuesMision1(() => { aviso(tp.emoji + ' ' + tp.nombre + ': ' + LORE_TEMPORADA[tp.campo], 'ok', 1); try { localStorage.setItem('dq3_lore_tp', tp.id); } catch (e) {} }), 12000);
  }
}
$('temp3') && $('temp3').addEventListener('click', ev => {
  ev.stopPropagation();
  const tp = temporadaDe(), prox = proxTemp3();
  if (!tp) {
    if (prox) aviso(`${prox.emoji} Próximo evento: ${prox.nombre}, desde el ${fechaTemp3(prox.ini)}. Los monstruos soltarán ${prox.cosas || 'objetos'} y habrá dos títulos.`, 'ok');
    return;
  }
  const { n, meta } = textoTemp3(tp);
  // Con la tienda abierta (calendario y saldo) la leyenda no va pegada a este aviso: sale aparte al cerrarla.
  const despues = prox && tp.fin - Date.now() < 3 * 86400000 ? ' Luego: ' + prox.emoji + ' ' + prox.nombre + ' desde el ' + fechaTemp3(prox.ini) + '.' : '';
  const ley = LORE_TEMPORADA_LEYENDA && LORE_TEMPORADA_LEYENDA[tp.campo];
  const leyTxt = ley && ley.length ? ' 📜 ' + ley[(pintarTemp3.ley = ((pintarTemp3.ley || 0) + 1)) % ley.length] : '';
  aviso(tp.emoji + ' ' + tp.nombre + ' (hasta el ' + tp.hasta + '): los monstruos sueltan ' + tp.cosas + ' y los jefes, varias. Llevas ' + n.toLocaleString('es') + (meta ? '; con ' + meta + ' ganas ' + (meta === 50 ? '3.000' : '12.000') + ' de oro y el título «' + tp.titulos[meta === 50 ? 0 : 1] + '».' : ': ya tienes los dos títulos.') + despues, 'ok');
  try { V.abrirTiendaTemp(); } catch (e) {}   // calendario de la fiesta y saldo, a un toque
  // Tras abrir la tienda: con prio 3 la leyenda espera en cola (30 s) y sale al cerrarla, sin tapar el modal.
  if (leyTxt) aviso(leyTxt.trim(), 'ok', 3);
});
function proxTemp3() { return TEMPORADAS.filter(x => x.ini > Date.now()).sort((a, b) => a.ini - b.ini)[0] || null; }
// En UTC, como los «hasta» de TEMPORADAS (ini = Date.UTC del dia): en hora de Lima saldria el dia anterior.
function fechaTemp3(t) { try { return new Date(t).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' }); } catch (e) { return new Date(t).toLocaleDateString(); } }
setInterval(pintarTemp3, 60000);   // los dias que quedan y el cambio de un evento al siguiente
// ── NOCHE DE DUENDES (Halloween, 24-oct a 2-nov) ──
// Calabazas con la cara encendida en las puertas del pueblo y en la plaza, y
// murcielagos que dan vueltas de noche. Solo decorado: no cambia el juego.
const noche3 = { calabazas: [], murcis: [], activo: false };
function crearNocheDuendes() {
  if (!esNocheDuendes()) return;
  noche3.activo = true;
  setTimeout(() => despuesMision1(() => aviso('🎃 Noche de Duendes: el pueblo se llenó de calabazas y de noche salen los murciélagos. Hasta el 2 de noviembre, los 7 disfraces de la mascota cuestan 25% menos de oro en la tienda.', 'ok', 3)), 9000);
  const geoC = new THREE.SphereGeometry(0.42, 10, 8), geoT = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 5), geoO = new THREE.ConeGeometry(0.09, 0.14, 3), geoB = new THREE.BoxGeometry(0.34, 0.07, 0.02);
  const matC = new THREE.MeshLambertMaterial({ color: 0xf07a1a }), matT = new THREE.MeshLambertMaterial({ color: 0x3f6b1f });
  const matCara = new THREE.MeshBasicMaterial({ color: 0xffd84a });
  const poner = (x, z, ry) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(geoC, matC); c.scale.y = 0.78; c.position.y = 0.32;
    const t = new THREE.Mesh(geoT, matT); t.position.y = 0.72;
    const o1 = new THREE.Mesh(geoO, matCara), o2 = o1.clone(), b = new THREE.Mesh(geoB, matCara);
    o1.position.set(-0.13, 0.42, 0.38); o2.position.set(0.13, 0.42, 0.38); o1.rotation.x = o2.rotation.x = Math.PI / 2; b.position.set(0, 0.24, 0.39);
    g.add(c, t, o1, o2, b);
    g.position.set(x, alturaEn(x, z), z); g.rotation.y = ry;
    escena.add(g); noche3.calabazas.push(g);
  };
  // Dos en cada puerta (mirando hacia fuera) y un corro en la plaza.
  for (const c of CASAS) {
    const fx = Math.sin(c.r), fz = Math.cos(c.r), lx = Math.cos(c.r), lz = -Math.sin(c.r), dd = c.d / 2 + 1.1;
    for (const k of [-1.3, 1.3]) poner(c.x + fx * dd + lx * k, c.z + fz * dd + lz * k, c.r);
  }
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, r = 7.5; poner(Math.cos(a) * r, Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI); }
  const geoA = new THREE.BufferGeometry();
  geoA.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.55, 0.05, -0.15, 0.2, 0, 0.22], 3));
  const matM = new THREE.MeshBasicMaterial({ color: 0x120a18, side: THREE.DoubleSide });
  for (let i = 0; i < (MOVIL ? 8 : 14); i++) {
    const g = new THREE.Group(), cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), matM);
    const ai = new THREE.Mesh(geoA, matM), ad = new THREE.Mesh(geoA, matM); ad.scale.x = -1;
    g.add(cuerpo, ai, ad); g.visible = false; escena.add(g);
    noche3.murcis.push({ g, ai, ad, r: 10 + Math.random() * 22, h: 7 + Math.random() * 9, v: (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), f: Math.random() * 6.3 });
  }
}
function animarNocheDuendes(t) {
  if (!noche3.activo || Math.hypot(P.x, P.z) > 140) { for (const m of noche3.murcis) m.g.visible = false; return; }
  const ver = nocheK > 0.3;
  for (const m of noche3.murcis) {
    m.g.visible = ver; if (!ver) continue;
    const a = m.f + t / 1000 * m.v;
    m.g.position.set(Math.cos(a) * m.r, alturaEn(0, 0) + m.h + Math.sin(t / 400 + m.f) * 0.8, Math.sin(a) * m.r);
    m.g.rotation.y = -a + (m.v > 0 ? 0 : Math.PI);
    const bate = Math.sin(t / 55 + m.f) * 0.9; m.ai.rotation.z = bate; m.ad.rotation.z = -bate;
  }
}
// ── DECORADO DE T'ANTA WAWA Y COSECHA ──
// Panes con carita o mazorcas moradas en las puertas y en corro en la plaza; en
// cualquier fiesta, ademas, el puesto de la Abuela: su tienda de la fiesta
// (ventanas.js abrirTiendaTemp), que se paga con el objeto del evento.
const decoTp = { grupo: null, campo: '', puesto: null, lbl: null };
// Junta las mallas iguales (misma geometria y material) en un InstancedMesh: ~30 piezas
// de 3 mallas pasan de ~90 dibujos a 2 o 3. Las de menos de 3 copias o transparentes quedan sueltas.
function aplanarInstancias(grupo) {
  grupo.updateMatrixWorld(true);
  const por = new Map(), sueltos = [];
  grupo.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh) return;
    if (m.material && (m.material.transparent || Array.isArray(m.material))) { sueltos.push(m); return; }
    const k = m.geometry.uuid + '|' + m.material.uuid;
    (por.get(k) || por.set(k, []).get(k)).push(m);
  });
  const g = new THREE.Group();
  for (const l of por.values()) {
    if (l.length < 3) { for (const m of l) sueltos.push(m); continue; }
    const im = new THREE.InstancedMesh(l[0].geometry, l[0].material, l.length);
    l.forEach((m, i) => im.setMatrixAt(i, m.matrixWorld));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    g.add(im);
  }
  for (const m of sueltos) { const c = m.clone(false); m.matrixWorld.decompose(c.position, c.quaternion, c.scale); g.add(c); }
  return g;
}
function crearDecoTemporada() {
  const tp = temporadaDe();
  if (!tp || decoTp.campo === tp.campo) return;
  const deco = tp.campo === 'tantas' || tp.campo === 'mazorcas';
  const grupo = new THREE.Group();
  let pieza;
  if (tp.campo === 'tantas') {
    const geoP = new THREE.SphereGeometry(0.5, 10, 8), geoO = new THREE.SphereGeometry(0.05, 5, 4);
    const matP = new THREE.MeshLambertMaterial({ color: 0xe0a96d }), matO = new THREE.MeshBasicMaterial({ color: 0x111111 });
    pieza = () => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(geoP, matP); p.scale.set(0.6, 0.35, 1); p.position.y = 0.18;
      g.add(p);
      if (CAL === 'baja') return g;   // en calidad baja, sin ojitos (2 mallas menos por pan)
      const o1 = new THREE.Mesh(geoO, matO), o2 = new THREE.Mesh(geoO, matO);
      o1.position.set(-0.1, 0.33, 0.3); o2.position.set(0.1, 0.33, 0.3);
      g.add(o1, o2); return g;
    };
    // Todos los Santos es fiesta de velas: velitas encendidas en el corro y en la mesa de la Abuela.
    // Geometrias y materiales propios (liberar() los desecha al cambiar de evento).
    const gCera = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6), mCera = new THREE.MeshLambertMaterial({ color: 0xf5efe0 });
    const gLlama = new THREE.ConeGeometry(0.06, 0.14, 5), mLlama = new THREE.MeshBasicMaterial({ color: 0xffc24a });
    const vela = (x, y, z) => {
      const c = new THREE.Mesh(gCera, mCera); c.position.set(x, y + 0.175, z); grupo.add(c);
      const f = new THREE.Mesh(gLlama, mLlama); f.position.set(x, y + 0.42, z); grupo.add(f);
    };
    // Una vela entre cada par de panes del corro (mismo radio y angulo medio).
    for (let i = 0; i < 10; i++) {
      const a = (i + 0.5) / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * 7.5, z = Math.sin(a) * 7.5;
      vela(x, alturaEn(x, z), z);
    }
    // Dos velas a los lados del tablero de la mesa (misma posicion y giro que el puesto de abajo).
    {
      const a = 0.3 + Math.PI / 10, r = 9.5, x = Math.cos(a) * r, z = Math.sin(a) * r, y = alturaEn(x, z);
      const ry = Math.atan2(-x, -z) + Math.PI, co = Math.cos(ry), si = Math.sin(ry);
      for (const lx of [-0.88, 0.88]) vela(x + lx * co, y + 0.8, z - lx * si);
    }
  } else if (tp.campo !== 'mazorcas') {
    // Otras fiestas: bolitas del color del evento sobre la mesa.
    const geoB = new THREE.SphereGeometry(0.3, 8, 6), matB = new THREE.MeshLambertMaterial({ color: new THREE.Color(tp.color) });
    pieza = () => { const g = new THREE.Group(), b = new THREE.Mesh(geoB, matB); b.position.y = 0.3; g.add(b); return g; };
  } else {
    const geoM = new THREE.CylinderGeometry(1, 1, 1, 8), geoH = new THREE.ConeGeometry(0.12, 0.6, 4);
    const matM = new THREE.MeshLambertMaterial({ color: 0x6b21a8 }), matH = new THREE.MeshLambertMaterial({ color: 0x3f6b1f });
    pieza = () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geoM, matM); m.scale.set(0.25, 0.6, 0.25); m.position.y = 0.32;
      const h1 = new THREE.Mesh(geoH, matH), h2 = new THREE.Mesh(geoH, matH);
      h1.position.set(-0.3, 0.26, 0); h1.rotation.z = 0.35; h2.position.set(0.3, 0.26, 0); h2.rotation.z = -0.35;
      g.add(m, h1, h2); return g;
    };
  }
  const poner = (x, z, ry) => { const g = pieza(); g.position.set(x, alturaEn(x, z), z); g.rotation.y = ry; grupo.add(g); };
  // Dos en cada puerta y un corro en la plaza (como las calabazas de la Noche de Duendes).
  if (deco) for (const c of CASAS) {
    const fx = Math.sin(c.r), fz = Math.cos(c.r), lx = Math.cos(c.r), lz = -Math.sin(c.r), dd = c.d / 2 + 1.1;
    for (const k of [-1.3, 1.3]) poner(c.x + fx * dd + lx * k, c.z + fz * dd + lz * k, c.r);
  }
  if (deco) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, r = 7.5; poner(Math.cos(a) * r, Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI); }
  {
    // Puesto de la Abuela: mesa de madera con seis piezas de la fiesta encima, por fuera del corro (dentro esta la fuente).
    const a = 0.3 + Math.PI / 10, r = 9.5, x = Math.cos(a) * r, z = Math.sin(a) * r, y = alturaEn(x, z);
    const mesa = new THREE.Group();
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
    tabla.position.y = 0.4; mesa.add(tabla);
    for (let i = 0; i < 6; i++) { const p = pieza(); p.scale.setScalar(0.6); p.position.set(-0.6 + (i % 3) * 0.6, 0.8, i < 3 ? -0.24 : 0.24); mesa.add(p); }
    mesa.position.set(x, y, z); mesa.rotation.y = Math.atan2(-x, -z) + Math.PI;
    grupo.add(mesa);
    decoTp.puesto = { x, y, z };
    if (!decoTp.lbl) decoTp.lbl = etiqueta('');
  }
  // Todo es estatico (nada se mueve por frame): se aplana en instancias para la GPU del movil.
  const plano = aplanarInstancias(grupo);
  escena.add(plano);
  decoTp.grupo = plano; decoTp.campo = tp.campo;
}
// Con la pestaña abierta al cambiar de evento: se va lo del anterior y entra lo del nuevo.
setInterval(() => {
  try {
    if (noche3.activo && !esNocheDuendes()) {
      for (const g of noche3.calabazas) { escena.remove(g); liberar(g); }
      for (const m of noche3.murcis) { escena.remove(m.g); liberar(m.g); }
      noche3.calabazas.length = 0; noche3.murcis.length = 0; noche3.activo = false;
    }
    if (decoTp.campo !== ((temporadaDe() || {}).campo || '')) {
      if (decoTp.grupo) { escena.remove(decoTp.grupo); liberar(decoTp.grupo); }   // libera geometrias y materiales en la GPU
      decoTp.grupo = null; decoTp.campo = ''; decoTp.puesto = null;
      if (decoTp.lbl) decoTp.lbl.style.display = 'none';
      crearDecoTemporada();
    }
  } catch (e) { console.warn(e); }
}, 60000);
// Vigia de fugas: si las geometrias o texturas en la GPU crecen sin parar, avisa una vez (embudo /mmo/ev).
const vigiaGpu = { g0: -1, t0: 0, avisado: false };
setInterval(() => {
  try {
    if (document.hidden || vigiaGpu.avisado || !render || !render.info) return;
    const mem = render.info.memory;
    if (vigiaGpu.g0 < 0) { vigiaGpu.g0 = mem.geometries; vigiaGpu.t0 = mem.textures; return; }
    if (mem.geometries > vigiaGpu.g0 + 400 || mem.textures > vigiaGpu.t0 + 60) {
      vigiaGpu.avisado = true;
      console.warn('fuga_gpu', mem.geometries, mem.textures, vigiaGpu.g0, vigiaGpu.t0);
      paso('fuga_gpu');
    }
  } catch (e) {}
}, 60000);
// ── AVENTUREROS DEL PUEBLO (PNJ) ──
// Cinco aventureros PNJ pasean por la plaza y comentan cosas. Llevan «PNJ»
// en el nombre: no son jugadores ni cuentan como conectados.
const aventureros = [];
function crearAventureros() {
  if (!USAR_MODELOS) return;
  const dia = Math.floor(Date.now() / 864e5);
  for (let i = 0; i < 5; i++) {
    const a = AVENTUREROS[(dia + i * 2) % AVENTUREROS.length];
    const look = { cara: (i * 2 + dia) % 6, cuerpo: i % 3, altura: 0.95 + (i % 4) * 0.04, pelo: (i * 3 + dia) % 8, colorPelo: (i * 5 + dia) % 8 };
    // Atuendos como los duendes de las imagenes del dueño (pirata, militar, vampiro, momia, campesino).
    const atuendo = { Tupa: 'pirata', Ccori: 'pirata', Rumi: 'militar', Inti: 'militar', Pacha: 'campesino', Sumaq: 'vampiro', Kusi: 'momia' }[a.n.split(' ')[0]] || '';
    const fig = figuraModelo(() => crearDuende({ skin: 'comun', clase: a.cl, arma: 'katana', look, atuendo }));
    if (!fig) continue;
    const ang = i / 5 * Math.PI * 2;
    const av = { ...a, x: Math.cos(ang) * 9, z: Math.sin(ang) * 9, ry: 0, espera: 800 + i * 900, fig, lbl: etiqueta('pj'), dice: '', diceT: 0 };
    av.tx = av.x; av.tz = av.z;
    aventureros.push(av);
  }
}
let charlaT = 0;
function moverAventureros(t, dt) {
  if (!aventureros.length) return;
  if (t > charlaT) {
    charlaT = t + 9000 + Math.random() * 9000;
    const av = aventureros[Math.floor(Math.random() * aventureros.length)];
    if (Math.hypot(av.x - P.x, av.z - P.z) < 35) { av.dice = FRASES_AVENTUREROS[Math.floor(Math.random() * FRASES_AVENTUREROS.length)]; av.diceT = t + 5000; }
  }
  for (const av of aventureros) {
    const dx = av.tx - av.x, dz = av.tz - av.z, d = Math.hypot(dx, dz);
    let anda = false;
    if (d < 0.3) {
      av.espera -= dt * 1000;
      if (av.espera <= 0) { const r = 4 + Math.random() * 12, a = Math.random() * Math.PI * 2; av.tx = Math.cos(a) * r; av.tz = Math.sin(a) * r; av.espera = 2500 + Math.random() * 5000; }
    } else {
      const v = Math.min(d, 2.4 * dt), nx = av.x + dx / d * v, nz = av.z + dz / d * v;
      const [ex, ez] = empujarFuera(nx, nz);
      if (Math.hypot(ex - nx, ez - nz) > 0.01) { av.tx = ex; av.tz = ez; }   // choca: se para ahi y elige otro rumbo
      av.x = ex; av.z = ez; av.ry = lerpAng(av.ry, Math.atan2(dx, dz), 0.15); anda = true;
    }
    av.fig.estado(anda ? 'corre' : 'quieto', t);
    av.fig.poner(av.x, alturaEn(av.x, av.z), av.z, av.ry, t);
  }
}
// ── RASTREADOR DE MISIONES ──
// La mision de la cadena y la caza del dia, con flecha y distancia al
// campamento mas cercano del monstruo pedido (o al Guardia si ya esta lista).
const CAMPOS3D = campamentos(MAPAS, MONSTRUOS);
const guiaNpc = NPCS3D.find(n => n.tipo === 'guia');
let metaMision = null;
// Tutorial de los primeros minutos (como el de CLASSIC): el paso actual va como
// primera fila del rastreador y se cumple solo al hacerlo. Por personaje y dispositivo.
const TUTO3 = [
  { txt: () => MOVIL ? 'Mueve el joystick para andar' : 'Muévete con W A S D y arrastra con el ratón para girar la cámara', hecho: t => { const d = Math.hypot(P.x - t.x0, P.z - t.z0); if (d > 60) { t.x0 = P.x; t.z0 = P.z; } return d > 8 && d <= 60; } },   // un salto grande es un teletransporte: no cuenta
  { txt: () => (metaMision && metaMision.mon ? 'Sigue la luz amarilla: ahí te espera un goblin' : 'Ve a la luz amarilla') + (metaMision ? ` ${flechaDir(metaMision.x, metaMision.z)} ${Math.round(Math.hypot(metaMision.x - P.x, metaMision.z - P.z))} m` : ''), hecho: t => (yo.kills || 0) > t.k0 || (metaMision && Math.hypot(metaMision.x - P.x, metaMision.z - P.z) < 30) },
  { txt: () => MOVIL ? 'Acércate y toca ATACAR: cada toque es un golpe. Mantén pulsado para seguir pegando' : 'Acércate y pulsa 1 o Z: cada pulsación es un golpe. Mantén para seguir pegando', hecho: t => (yo.kills || 0) > t.k0 },
  // En movil el boton de ataque no esta en la barra: el primero ya es la habilidad de nivel 1.
  // Guerrero: la Ira empieza en 0; se explica como llenarla (antes el paso se trababa sin Ira).
  // En horizontal la primera habilidad va en el arco junto a ATACAR, no en la barra.
  { txt: () => { const dondeHab = !MOVIL ? 'tecla 2' : matchMedia('(orientation:landscape) and (max-height:500px)').matches ?'el botón que late en verde junto a ATACAR' : 'el primer botón de la barra (late en verde)'; const nom = (habsDe(yo.clase)[0] || {}).nombre;
      if ((CLASES[yo.clase] || {}).recurso === 'ira') return MOVIL ? 'Pega 2 veces para llenar tu Ira y toca ' + dondeHab : 'Pega 2 golpes con 1 para llenar tu Ira (barra roja) y luego usa ' + (nom || 'Golpe del Puma') + ' (' + dondeHab + ').';
      return MOVIL ? 'Toca ' + dondeHab + ': es tu habilidad' : 'Usa tu habilidad ' + (nom || 'de clase') + ': ' + dondeHab; }, hecho: t => t.hab },
  { txt: () => 'Fuera del pueblo, despliega las alas: ' + (MOVIL ? 'botón VOLAR' : 'V o doble salto'), hecho: () => P.vuela },
  { txt: () => MISIONES[yo.mis.i] && yo.mis.p >= MISIONES[yo.mis.i].n ? '¡Misión lista! Toca AQUÍ para entregarla' : 'Completa tu misión 📜: el premio se cobra solo al terminarla', hecho: () => yo.mis.i >= 1 },
];
const tuto3 = { i: -1, x0: 0, z0: 0, k0: 0, hab: false, clave: '', pul: -1 };
// Mostrar, no contar: el boton del paso actual late en verde (.tuto-pulso).
// Paso 3 ATACAR (movil: boton grande; PC: casilla 1), paso 4 la primera
// habilidad de la barra, paso 5 VOLAR. Se reaplica cada vez: la barra se rehace al subir de nivel.
function pulsoTuto3(i) {
  if (i < 2 || i > 4) i = -1;
  if (i === -1 && tuto3.pul === -1) return;
  try {
    const obj = i === 2 ? $(MOVIL ? 't-atk' : 'acc-atk') : i === 3 ? document.querySelector('#barra [data-hab]:not(.bloq)') : i === 4 ? $('t-volar') : null;
    if (tuto3.pul !== i) { document.querySelectorAll('.tuto-pulso').forEach(b => { if (b !== obj) b.classList.remove('tuto-pulso'); }); pulsoHabNueva(); }   // la habilidad nueva sin estrenar sigue latiendo
    if (obj && !obj.classList.contains('tuto-pulso')) obj.classList.add('tuto-pulso');
  } catch (e) {}
  tuto3.pul = i;
}
function htmlTuto3() {
  if (!yo.clase || yo.nivel > 6) { pulsoTuto3(-1); return ''; }
  const clave = 'dq3_tuto_' + clavePj();
  if (tuto3.clave !== clave) {
    let i = 0; try { i = +(localStorage.getItem(clave) || 0); } catch (e) {}
    // Otro navegador (p. ej. de Telegram a Chrome) no tiene el paso guardado: se deduce del progreso real.
    if (yo.mis && yo.mis.i >= 1) i = TUTO3.length; else if ((yo.kills || 0) > 0) i = Math.max(i, 3);
    try { localStorage.setItem(clave, String(i)); } catch (e) {}
    Object.assign(tuto3, { clave, i, x0: P.x, z0: P.z, k0: yo.kills || 0, hab: false, t0: 0, ay6: false, ay15: false }); }
  // k0 no se reinicia al avanzar: la primera caza cumple a la vez "sigue la luz" y "ataca".
  if (TUTO3[tuto3.i] && TUTO3[tuto3.i].hecho(tuto3)) { tuto3.i++; tuto3.x0 = P.x; tuto3.z0 = P.z; try { localStorage.setItem(clave, String(tuto3.i)); } catch (e) {} sfx('moneda', 0.3);
    // Embudo (una vez por sesion, beacon /mmo/ev): cumplio la habilidad, las alas o todo el tutorial.
    const pe = tuto3.i === 4 ? 't_hab' : tuto3.i === 5 ? 't_volar' : tuto3.i === TUTO3.length ? 't_fin' : ''; if (pe) paso(pe);
    // Primera caza: se felicita y se enseña lo que falta del combate (habilidad y alejarse del rojo).
    if (tuto3.i === 3) aviso('¡Bien hecho! Ahora usa tu habilidad. Si un monstruo brilla en rojo, aléjate.', 'ok', 1);
    if (tuto3.i === 1) { vib('success'); aviso('¡Así se camina! Ahora sigue la luz amarilla', 'ok', 1); } }
  // Paso 1 en movil sin moverse (cada ~333 ms con pintarMisiones): a los 6 s la pista crece; a los 15 s, aviso. Con una ventana abierta no cuenta.
  if (tuto3.i === 0 && MOVIL) {
    const ahoraT = Date.now();
    if (!tuto3.t0 || hayVentana()) tuto3.t0 = ahoraT;
    const quietoT = ahoraT - tuto3.t0, pj = document.querySelector('#joy .pista-joy');
    if (quietoT > 6000 && !tuto3.ay6) { tuto3.ay6 = true; if (pj) { pj.classList.add('grande'); const sp = pj.querySelector('span'); if (sp) sp.textContent = 'Pon tu dedo aquí y arrastra'; vib('medium'); } }
    if (quietoT > 15000 && !tuto3.ay15) { tuto3.ay15 = true; aviso('👇 Pon tu dedo abajo a la ' + (document.body.classList.contains('mano-der') ? 'derecha' : 'izquierda') + ' y arrástralo para caminar', 'ok', 1); }
  }
  pulsoTuto3(tuto3.i);
  const p = TUTO3[tuto3.i]; if (!p) return '';
  // Paso 6 con la mision lista: la propia fila del tutorial la entrega (en movil la fila 📜 queda debajo).
  const lista = tuto3.i === 5 && MISIONES[yo.mis.i] && yo.mis.p >= MISIONES[yo.mis.i].n;
  return `<div class="q"${lista ? ' data-entregar="1"' : ''} style="border-left:3px solid #4ade80;padding-left:6px${lista ? ';cursor:pointer' : ''}"><b style="color:#4ade80">💡 ${COMPACTO ? '' : 'Paso '}${tuto3.i + 1}/${TUTO3.length}</b>${esc(p.txt())}</div>`;
}
const flechaDir = (x, z) => { let a = camYaw - Math.PI - Math.atan2(x - P.x, z - P.z); a = Math.atan2(Math.sin(a), Math.cos(a)); return ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'][(Math.round(a / (Math.PI / 4)) + 8) % 8]; };
// Fiesta que vale para el servidor (yo.temp) o, si no lo dice, la del reloj.
function fiestaYo() { return yo && typeof yo.temp === 'string' ? TEMPORADAS.find(x => x.id === yo.temp) || null : temporadaDe(); }
// Fila de la tarea del dia de la fiesta (data TEMP_DIAS; progreso en yo.fiestaDias, p = {dia: n}).
// Estado del dia de la fiesta: { tp, d, def, p (hecho hoy), n, ok (hoy cumplido), okL, pL } o null.
function estadoFiestaDia() {
  const tp = yo ? fiestaYo() : null; if (!tp) return null;
  const d = Math.max(0, Math.min(diaFiesta(tp), diasFiesta(tp) - 1)), def = TEMP_DIAS[d % TEMP_DIAS.length];
  const fd = yo.fiestaDias && yo.fiestaDias.id === tp.id ? yo.fiestaDias : { p: {}, ok: [] };
  const okL = fd.ok || [], pL = fd.p || {};
  return { tp, d, def, p: Math.min(pL[d] || 0, def.n), n: def.n, ok: okL.includes(d), okL, pL };
}
function filaFiestaDia() {
  const ef = estadoFiestaDia(); if (!ef) return '';
  const { tp, d, def } = ef, ok = ef.okL, p = ef.pL;
  const atras = ok.length < d + 1 ? Array.from({ length: d }, (_, i) => i).filter(i => !ok.includes(i)).length : 0;
  const extra = atras ? ` · ${atras} día${atras > 1 ? 's' : ''} atrasado${atras > 1 ? 's' : ''}` : '';
  if (ok.includes(d)) return `<div class="q" data-ttemp="1" style="cursor:pointer"><span class="ok">✓ Día ${d + 1} de la fiesta hecho${d + 1 < diasFiesta(tp) ? ' · vuelve mañana' : ' · era el último día'}</span><small>${tp.emoji} toca para ver el calendario${extra}</small></div>`;
  return `<div class="q" data-ttemp="1" style="cursor:pointer"><b style="color:${tp.color}">${tp.emoji} Fiesta · Día ${d + 1}: ${esc(def.txt)}${p[d] ? ' (vas ' + Math.min(p[d], def.n) + '/' + def.n + ')' : ''}</b><small>${esNochebuena(tp, d) ? '⭐ Nochebuena · ' : ''}+${premioDiaFiesta(tp, d)} ${esc(tp.cosas)} · toca para ver el calendario${extra}</small></div>`;
}
function pintarMisiones() {
  const c = $('misiones');
  if (!yo || !yo.mis) { c.style.display = 'none'; return; }
  const q = MISIONES[yo.mis.i], d = yo.diaria || {};
  let h = '';
  metaMision = null;
  if (enAbismo(P.x)) {
    const is = islaEn(P.x, P.z), fc = yo.faccion && FACCIONES[yo.faccion];
    h = OBJ.boton + `<div class="q"><b>🌌 ${ABISMO.nombre}</b>${is && is.nombre ? is.nombre + ' · ' : ''}${fc ? `<span style="color:${fc.color}">${fc.titulo}</span>` : ''}${temp3 && fc && temp3.debil === yo.faccion ? ' <span style="color:#ffd84a">✨ PA ×' + String(FACC_BONO).replace('.', ',') + '</span>' : ''}${rangoHtml()}${asedioHtml()}<br><span style="font-size:11px">${santuario(P.x, P.z) ? '🛡 Santuario: aquí nadie pelea contra jugadores.' : 'Abate a la otra facción y a los élites para ganar Puntos del Abismo. Vuelve por el portal de tu bastión.'}</span></div>`;
    c.style.display = 'block'; if (c._h !== h && !misPulsada(c)) { c.innerHTML = h; c._h = h; } faro.visible = false; return;
  }
  if (asedio && asedio.activo && yo.nivel >= ABISMO.nvMin && !enCueva(P.x)) h += `<div class="q"><b style="color:#fca5a5">⚔ Asedio del Núcleo</b> ${fmtT(asedio.fin - Date.now())} · entra al Abismo por el portal del pueblo</div>`;
  if (enCueva(P.x)) {
    // Sala actual (los pasillos cuentan como la sala a la que llevan) y cronometro desde que entraste.
    const lxC = P.x - CUEVA_X0, iS = CUEVA.salas.findIndex(([a, b, c2, d]) => lxC >= a && lxC <= c2 && P.z >= b && P.z <= d);
    const nS = iS < 0 ? 1 : [1, 2, 2, 3, 3, 4, 4][iS] || 1, nomS = ['Entrada', 'Guardia', 'Magos', 'Trono'][nS - 1];
    const hechaC = cuevaInfo && cuevaInfo.hecha;
    const relojC = cuevaT0 && !hechaC ? ` · ⏱ ${fmtT(Date.now() - cuevaT0)}` : '';
    const recC = yo.cuevaRec ? ` · récord ${fmtT(yo.cuevaRec * 1000)}` : '';
    h = OBJ.boton + `<div class="q"><b>⛏ ${CUEVA.nombre}</b>${hechaC ? `<span class="ok">¡Completada${cuevaFinM ? ' en ' + fmtT(cuevaFinM.seg * 1000) + (cuevaFinM.nuevo ? ' (¡nuevo récord!)' : '') : ''}! Sal por el portal de la entrada.</span>`
      : `Sala ${nS}/4 · ${nomS} <span style="color:#ffd84a">${'●'.repeat(nS)}${'○'.repeat(4 - nS)}</span>${relojC}<br><span style="font-size:11px">${nS === 4 ? '👑 Trono: esquiva el pisotón rojo' : 'Derrota al Rey Goblin en su trono.'}${recC}</span>`}</div>`;
    c.style.display = 'block'; if (c._h !== h && !misPulsada(c)) { c.innerHTML = h; c._h = h; } faro.visible = false; return;
  }
  if (q) {
    const lista = yo.mis.p >= q.n;
    // Nivel del monstruo pedido y, si es muy fuerte (jefes 3+, el resto 4+),
    // la luz guia a un campamento entrenable: sin esto el novato se pegaba a un jefe que lo tumbaba.
    const mq = MONSTRUOS[q.tipo] || {}, alta = !lista && mq.nivel - yo.nivel >= (mq.jefe ? 3 : 4);
    let campo = null;
    if (alta) {
      let cd = Infinity;
      for (const cp of CAMPOS3D) {
        const mc = MONSTRUOS[cp.k];
        if (cp.jefe || !mc || mc.jefe || !(mc.nivel <= yo.nivel + 1)) continue;
        const dd = Math.hypot(cp.x - P.x, cp.z - P.z);
        if (!campo || mc.nivel > MONSTRUOS[campo.k].nivel || (mc.nivel === MONSTRUOS[campo.k].nivel && dd < cd)) { campo = cp; cd = dd; }
      }
    }
    if (lista) metaMision = null;   // en ORIGINS se entrega desde cualquier sitio
    else if (campo) metaMision = { x: campo.x, z: campo.z, jefe: false, entreno: true, k: campo.k };
    else {
      let mejor = null, md = Infinity;
      for (const cp of CAMPOS3D) if (cp.k === q.tipo) { const dd = Math.hypot(cp.x - P.x, cp.z - P.z); if (dd < md) { md = dd; mejor = cp; } }
      if (mejor) metaMision = { x: mejor.x, z: mejor.z, jefe: mejor.jefe };
    }
    // Primer combate guiado: en los pasos "luz" y "ataca" la luz señala al monstruo vivo mas cercano
    // de la mision (el servidor le pone uno al novato junto al pueblo), no al centro del campamento.
    if (!lista && !campo && tuto3.i >= 1 && tuto3.i <= 2 && !mq.jefe) {
      let mm = null, mdd = 90;
      for (const o of mons.values()) if (o.k === q.tipo && o.hp > 0 && !o.muereT) { const dd = Math.hypot(o.x - P.x, o.z - P.z); if (dd < mdd) { mdd = dd; mm = o; } }
      if (mm) metaMision = { x: mm.x, z: mm.z, jefe: false, mon: true };
    }
    const dist = metaMision ? Math.hypot(metaMision.x - P.x, metaMision.z - P.z) : 0;
    const donde = metaMision ? (dist < 25 ? ' · aquí' : ` · ${flechaDir(metaMision.x, metaMision.z)} ${Math.round(dist)} m`) : '';
    const zt = alta && !campo ? Object.values(MAPAS).filter(m => m.zona && !m.instancia && !m.coliseo && m.nv && m.nv[0] <= yo.nivel).sort((a, b) => b.nv[0] - a.nv[0])[0] : null;
    const nvq = mq.nivel ? ` <span style="color:${colorNivel(mq.nivel)}">${marcaNivel(mq.nivel)}Nv ${mq.nivel}</span>` : '';
    // En su guarida y sin el jefe a la vista (el cliente ve todo lo cercano): ya cayo y reaparece en 1-1,5 min.
    let sinJefe = !lista && !campo && metaMision && metaMision.jefe && dist < 25;
    if (sinJefe) for (const o of mons.values()) if (o.k === q.tipo && o.hp > 0 && !o.muereT) { sinJefe = false; break; }
    h += `<div class="q"><b>📜 ${esc(q.nombre)}</b>${lista ? `<span class="ok" data-entregar="1" style="cursor:pointer;text-decoration:underline">¡Lista! Toca aquí para entregarla</span>` : `${mq.nombre || q.tipo}${nvq}: ${Math.min(yo.mis.p, q.n)}/${q.n}<small>${campo ? '' : donde}</small>${sinJefe ? '<small style="display:block;color:#ffd84a">Reaparece pronto: caza cerca mientras tanto</small>' : ''}${alta ? `<small style="display:block;color:#ff9900">${campo ? `Muy fuerte para ti: sube a Nv ${Math.max(yo.nivel + 1, mq.nivel - (mq.jefe ? 2 : 3))} cazando ${esc(MONSTRUOS[campo.k].nombre || campo.k)} en la luz amarilla${donde || ' →'} o invita a un amigo 🤝` : `Muy fuerte para ti: sube antes${zt ? ' en ' + esc(zt.nombre) : ''} o ve en grupo`}</small>` : ''}`}</div>`;
  }
  // Encargos de la zona (no son "mata N"): el siguiente sin hacer.
  metaEnc = null;
  const zE = zonaEn(P.x, P.z);
  // Encargos y la secundaria (Abuela Sisa) no interrumpen el tutorial: salen al terminarlo o tras la mision 1.
  if (tuto3.i >= TUTO3.length || (yo.mis && yo.mis.i >= 1) || yo.nivel > 6) {
  if (ZONAS_ENC.includes(zE) && MAPAS[zE]) {
    const L = encargosDe(zE, MAPAS, MONSTRUOS), hechos = L.filter(e => encargos[e.id] === true).length, sig = L.find(e => encargos[e.id] !== true);
    if (sig) {
      let donde = '';
      if (sig.tipo === 'explorar') { const hi = hitoDe(zE, ZONAS3D, alturaEn), dd = Math.hypot(hi.x - P.x, hi.z - P.z); metaEnc = hi; donde = dd < 12 ? ' · ¡aquí!' : ` · ${flechaDir(hi.x, hi.z)} ${Math.round(dd)} m`; }
      const pr = sig.n > 1 ? ` ${encargos[sig.id] || 0}/${sig.n}` : '';
      if (sig.tipo === 'volar') donde = P.vuela ? ` · vas a ${Math.round(Math.max(0, P.y - alturaEn(P.x, P.z)))} m` : '';
      const txtE = MOVIL ? sig.txt.replace(' (V)', ' (botón VOLAR)') : sig.txt;
      h += `<div class="q"><b style="color:#7dd3fc">🧭 Encargos de ${esc(MAPAS[zE].nombre)} ${hechos}/${L.length}</b>${esc(txtE)}${pr}<small>${donde}</small></div>`;
    } else h += `<div class="q"><b style="color:#4ade80">🧭 ${esc(MAPAS[zE].nombre)}: encargos completados ✓</b></div>`;
  }
  // Mision secundaria de la zona: la de turno, con quien la pide; al aparecer, su historia.
  if (ZONAS_ENC.includes(zE)) {
    const qs = secundariaDe(zE, secundarias, yo.nivel);
    if (qs) {
      const vs = vistaSec(qs);
      h += `<div class="q"><b style="color:#f0abfc">${qs.ingr ? '🌽' : '📖'} ${esc(qs.nombre)}</b>${esc(vs.pide)}${vs.pend ? '' : ` ${Math.min(secundarias[qs.id] || 0, qs.n)}/${qs.n}`}<small> · ${esc(vs.pend ? vs.quien : qs.tipo === 'fabricar' ? 'Artesana Lila' : qs.quien)}${dondeNpc(qs.tipo === 'fabricar' && !vs.pend ? 'Artesana Lila' : qs.quien)}</small></div>`;
      if (qs.id !== 'x4' && !secVistas.has(qs.id)) { secVistas.add(qs.id); setTimeout(() => npcDice(qs.quien, qs.inicio, qs.emoji), 2500); }
    } else {   // la siguiente aun pide mas nivel: una pista tenue
      const pr = SECUNDARIAS.find(x => x.zona === zE && !secundarias[x.id + ':ok']);
      if (pr && pr.nv > yo.nivel) h += `<div class="q" style="opacity:.55"><small>📖 ${esc(pr.quien)} tendrá algo más que contarte en Nv ${pr.nv}</small></div>`;
      else if (pr && pr.minPistas) h += `<div class="q" style="opacity:.55"><small>📖 ${esc(pr.quien)} te espera con ${pr.minPistas} pistas (${contarPistas(secundarias)}/${pr.minPistas})</small></div>`;
    }
  } else if (zE === 'pueblo') {
    // En el pueblo no hay secundarias propias, pero lo que se prepara con la Artesana se hace aqui: que no se olvide.
    const qf = ZONAS_ENC.map(z => secundariaDe(z, secundarias, yo.nivel)).find(q => q && q.tipo === 'fabricar');
    if (qf) { const vf = vistaSec(qf); h += `<div class="q"><b style="color:#f0abfc">📖 ${esc(qf.nombre)}</b>${esc(vf.pide)}${vf.pend ? '' : ` ${Math.min(secundarias[qf.id] || 0, qf.n)}/${qf.n}`}<small> · ${esc(vf.quien)}${vf.pend ? dondeNpc(qf.quien) : ''}</small></div>`; }
  }
  }
  if (caso.p.length) h += `<div class="q" data-caso-abrir="1" style="cursor:pointer"><small style="color:#fde68a">🕵 El Caso del Traidor ${caso.p.length}/${PISTAS.length} · toca para abrir</small></div>`;
  // Fila que lleva a La Receta del Cantaro: solo con la caja desplegada (no agranda el HUD del movil).
  if (yo.mis && yo.mis.i >= 1 && !(COMPACTO && !c.classList.contains('abierto'))) h += '<div class="q" data-receta style="cursor:pointer"><b style="color:#d8b4fe">🥤 La Receta ' + ingredientesDe(secundarias).length + '/' + INGREDIENTES.length + '</b><small>Cap. ' + capituloDe(yo.mis.i).n + ': ' + esc(capituloDe(yo.mis.i).titulo) + '</small></div>';
  const tt = htmlTuto3();   // despues de calcular metaMision: el paso 2 la mira (va primera, tambien con invasion)
  // Movil con la caja plegada (solo se ve la primera fila): la Caza del dia lista para cobrar va arriba,
  // (el servidor ya la cobra sola al cumplirla; la fila queda por si un cliente viejo no la cobro).
  const plegada = COMPACTO && !c.classList.contains('abierto'), diariaLista = !d.ok && (d.p || 0) >= DIARIA.n;
  const plegadaPC = !COMPACTO && !c.classList.contains('pc-abierto');   // PC: solo se ven las 2 primeras filas (index.html), lo urgente va arriba
  if (!d.ok) {
    const filaDiaria = `<div class="q"><b>☀ ${DIARIA.nombre}</b>${(d.p || 0) >= DIARIA.n ? '<span class="ok" data-entregar="diaria" style="cursor:pointer;text-decoration:underline">¡Lista! Toca aquí para cobrarla</span>' : `Monstruos de tu nivel: ${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}<small style="display:block">Premio: +${premioDiaria(yo.nivel).oro} oro · ${premioDiaria(yo.nivel).pocion} pociones</small>`}</div>`;
    if ((plegada || plegadaPC) && diariaLista) h = filaDiaria + h; else h += filaDiaria;
  } else if (!plegada) {   // ya cobrada: cuando vuelve (medianoche de Peru)
    const msD = 86400000 - ((Date.now() - 5 * 3600000) % 86400000);
    h += '<div class="q"><b>☀ ' + DIARIA.nombre + ' ✓</b><small>Nueva en ' + Math.ceil(msD / 3600000) + ' h (00:00 hora de Perú)</small></div>';
  }
  // Novato en movil con la caja plegada (tutorial o primera mision): la invasion no le quita la fila de su mision. Ya la anuncia el aviso del servidor y sigue arriba al desplegar.
  const misionAntes = (plegada || plegadaPC) && (tt || (q && yo.mis.i < 1));
  if (invasion3) {
    const ms = Math.max(0, invasion3.ms - (Date.now() - invasion3.recibido)), mm = Math.floor(ms / 60000), ss = Math.floor(ms % 60000 / 1000);
    const zc = ZONAS3D[invasion3.zona], dz = zc ? Math.hypot(zc.x - P.x, zc.z - P.z) : 0;
    const filaInv = `<div class="q" style="border-left:3px solid #ff5a1f;padding-left:6px"><b style="color:#ff8a5c">⚔️ ${esc(invasion3.nombre)}</b>${invasion3.fase === 'capitan' ? '¡Derrota al Capitán!' : `Invasores: ${invasion3.hechos}/${invasion3.meta}`}${invYo3 > 0 ? (invYo3 >= 6 ? ` · Tú: 🥇 ${invYo3}` : invYo3 >= 3 ? ` · Tú: 🥈 ${invYo3} · oro a 6` : ` · Tú: 🥉 ${invYo3} · plata a 3`) : ''} · ${mm}:${String(ss).padStart(2, '0')}<small>${(MAPAS[invasion3.zona] || {}).nombre || ''}${dz > 60 && zc ? ` · ${flechaDir(zc.x, zc.z)} ${Math.round(dz)} m` : ' · ¡aquí!'}</small></div>`;
    h = misionAntes ? h + filaInv : filaInv + h;
  } else if (invPre3) {   // tambores: la invasion llega en 1:30 a esa zona
    const ms = Math.max(0, invPre3.hasta - Date.now()), mm = Math.floor(ms / 60000), ss = Math.floor(ms % 60000 / 1000);
    const zc = ZONAS3D[invPre3.zona], dz = zc ? Math.hypot(zc.x - P.x, zc.z - P.z) : 0;
    const filaPre = `<div class="q" style="border-left:3px solid #ff9a3c;padding-left:6px"><b style="color:#ffb072">🥁 ${invPre3.gran ? 'GRAN Invasión' : 'Invasión'} en ${mm}:${String(ss).padStart(2, '0')}</b><small>${esc((MAPAS[invPre3.zona] || {}).nombre || '')}${dz > 60 && zc ? ` · ${flechaDir(zc.x, zc.z)} ${Math.round(dz)} m` : ' · ¡aquí!'}</small></div>`;
    h = misionAntes ? h + filaPre : filaPre + h;
  } else {   // Gran Invasion diaria (eventos3d.js tickEventos3d): de 19:00 a 21:00 de Lima, cuenta atras en el HUD (solo en el juego)
    const lima = new Date(Date.now() - 5 * 3600e3), lh = lima.getUTCHours();
    const falta = Math.max(1, Math.ceil((21 * 60 - lh * 60 - lima.getUTCMinutes() - lima.getUTCSeconds() / 60)));
    // En celular con la caja plegada no tapa la mision principal hasta los ultimos 30 min.
    // Al novato (Nv < 3 o en el tutorial) no le tapa su primera mision.
    const novato3 = !yo || (yo.nivel || 1) < 3 || (tuto3 && tuto3.i >= 0 && tuto3.i < TUTO3.length);
    if (!novato3 && (lh === 19 || lh === 20) && (c.classList.contains('abierto') || c.classList.contains('pc-abierto') || falta <= 30)) {
      h =`<div class="q" style="border-left:3px solid #ff9a3c;padding-left:6px"><b style="color:#ffb072;font-size:12px">🥁 Gran Invasión hoy 21:00 · faltan ${falta >= 60 ? Math.floor(falta / 60) + ' h ' : ''}${falta % 60 ? falta % 60 + ' min' : ''} · sal a una zona de caza</b></div>` + h;
    }
  }
  if (!COMPACTO || c.classList.contains('abierto')) { // Tesoro cercano: el cofre disponible mas proximo (en movil, con la caja abierta)
    let mc = null, md = 400; const ah = Date.now();
    for (const c of COFRES3) if (c.listoEn <= ah) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < md && d > 6) { md = d; mc = c; } }
    if (mc) h += `<div class="q"><b>🧰 ${NOMBRE_COFRE[mc.tipo].replace(/^./, x => x.toUpperCase())}</b><small>${flechaDir(mc.x, mc.z)} ${Math.round(md)} m${mc.tipo === 'legendario' ? ' · en lo alto: ¡vuela!' : ''}</small></div>`;
  }
  // Suerte del duende: cuanto falta para el Epico asegurado (servidor: c.secaEp).
  // (Movil plegado: no se pinta, para no tapar la mision; la barra se llena justo en 25.)
  if (!(COMPACTO && !c.classList.contains('abierto'))) { if (yo && (yo.secaEp || 0) > 10) { const sl = Math.min(5, Math.floor(yo.secaEp / 5)), fz = Math.max(1, 26 - yo.secaEp); h += `<div class="q"><small>🍀 Suerte del duende: ${'▮'.repeat(sl)}${'▯'.repeat(5 - sl)} · ${fz === 1 ? '¡el próximo objeto que te suelte un monstruo será Épico o mejor!' : `Épico asegurado en ${fz} objetos de monstruos`}</small></div>`; } }
  // Misiones del dia y de la semana (se cobran solas); 🔄 cambia una gratis al dia.
  const T = yo.tareas;
  if (T && T.dia) {
    const hd = T.dia.l.filter(t => t.ok).length, hs = T.sem.l.filter(t => t.ok).length;
    const ptsS = T.sem.pts || 0, cofS = T.sem.cof || 0, sigS = [4, 8, 12][cofS] || 12;   // cofres semanales (se abren solos al llegar al umbral)
    // Movil con la caja recortada: una fila pegada abajo (siempre visible) con dia, cofres y la ruta de la mision tocada. (Con tutorial no se pega: taparia el paso.)
    if (COMPACTO && !c.classList.contains('abierto')) { const rt = metaTarea ? caminoTarea(metaTarea) : ''; h += `<div class="q"${tt ? '' : ' style="position:sticky;bottom:0;background:rgba(22,14,44,.95)"'}><b>▾ Día ${hd}/${T.dia.l.length} · 📦 ${cofS >= 3 ? '✓' : `${ptsS}/${sigS}`}${rt ? ` · ➜${rt.replace(/^ · /, ' ')}` : ''}${(() => { try { const ef = estadoFiestaDia(); return ef ? `<span data-ttemp="1" style="cursor:pointer;color:${ef.tp.color}"> · ${ef.tp.emoji} ${ef.ok ? '✓' : `D${ef.d + 1} ${ef.p}/${ef.n}`}</span>` : ''; } catch (e) { return ''; } })()}</b></div>`; }
    else h += `<div class="q"><b>🗓 Misiones del día ${hd}/${T.dia.l.length}</b>` + T.dia.l.map((t, i) => t.ok ? `<span class="ok">✓ ${esc(t.txt)}</span>` : `<span class="tarea" data-ir="${i}" style="cursor:pointer">• ${esc(t.txt)} ${t.p}/${t.n}${caminoTarea(t)}${T.dia.cambio ? '' : ` <button class="cambiar" data-cambiar="${i}" title="Cambiar esta misión (1 gratis al día)">🔄</button>`}</span>`).join('') +
      `<small>${T.dia.bono ? '✓ bono del día' : 'Bono al completar 2 de 3'} · se renuevan a la medianoche (hora de Perú)</small></div>` +
      // Las semanales tambien (antes solo se veia "Semana 0/2").
      `<div class="q"><b>📅 Misiones de la semana ${hs}/${T.sem.l.length}</b>` + T.sem.l.map(t => t.ok ? `<span class="ok">✓ ${esc(t.txt)}</span>` : `<span class="tarea">• ${esc(t.txt)} ${t.p}/${t.n}</span>`).join('') + '</div>';
    // Tarea del dia de la fiesta (calendario de ventanas.js): toca y abre la tienda con el calendario.
    if (!(COMPACTO && !c.classList.contains('abierto'))) { try { h += filaFiestaDia(); } catch (e) {} }
    // Medidor semanal: +1 por diaria y +1 por bono del día; cofres a 4, 8 y 12 (tareas.js puntoSemana).
    if (!(COMPACTO && !c.classList.contains('abierto'))) { const pts = ptsS, cof = cofS, sig = sigS; h += `<div class="q"><b>📦 Cofres de la semana ${Math.min(cof, 3)}/3</b><small>${[4, 8, 12].map((u, i) => (cof > i ? '✅' : pts >= u ? '🎁' : '🔒') + ' ' + u).join(' · ')} · ${cof >= 3 ? '¡3 cofres abiertos! Vuelve el lunes' : `Próximo cofre en ${Math.max(1, sig - pts)} punto${sig - pts === 1 ? '' : 's'} · +1 por cada misión del día y +1 por su bono (hasta 4 al día)`}</small></div>`; }
  }
  // Fila fija de la expedicion (algo en marcha mientras no juega): toca y abre su ventana (ventanas.js).
  if (yo.nivel >= EXPEDICION.nv) {
    const ex = yo.exped, ms = ex ? ex.fin - Date.now() : 0;
    const tx = !ex ? 'Manda a tu mascota de expedición' : ms <= 0 ? '¡Volvió! Toca para recoger' : `Vuelve en ${ms >= 3600000 ? Math.ceil(ms / 3600000) + ' h' : Math.max(1, Math.ceil(ms / 60000)) + ' min'}`;
    const fx = `<div class="q" data-expabrir="1" style="cursor:pointer"><b style="color:${ex && ms <= 0 ? '#4ade80' : '#7dd3fc'}">🧭 ${tx}</b></div>`;
    // Movil con la caja plegada (recorta lo de abajo): si ya volvio, va arriba para que se vea.
    if (ex && ms <= 0 && (plegadaPC || (COMPACTO && !c.classList.contains('abierto')))) h = fx + h; else h += fx;
  }
  // Fila fija con el premio de mañana de la racha (motivo para volver).
  // Movil plegado: si no hay nada urgente que tocar (diaria o mision lista, invasion, expedicion de vuelta),
  // el premio de mañana va arriba en corto para que se vea; si lo hay, queda abajo como siempre.
  {
    const mn = textoManana3();
    const urgente = diariaLista || (q && yo.mis.p >= q.n) || invasion3 || invPre3 || (yo.exped && yo.exped.fin - Date.now() <= 0);
    if (mn && plegada && !urgente && !tt) h =`<div class="q"><b style="color:#ffd84a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🎁 ${esc(mn)}</b></div>` + h;   // una sola linea: con 150px y "¡Mañana el cofre ÉPICO!..." ocupaba 2-3 y tapaba la mision
    else if (mn) h += `<div class="q"><b style="color:#ffd84a">🎁 ${esc(mn)}</b></div>`;
  }
  h = tt + (tt || !h ? '' : OBJ.boton) + h;
  if (!COMPACTO) {   // PC: mision, siguiente paso y esta fila; lo demas, al desplegar (se recuerda en este navegador)
    const ocultas = (h.match(/<div class="q"/g) || []).length - 2;
    if (ocultas > 0) h += plegadaPC ? `<button type="button" class="mis-ver" data-mis-ver aria-expanded="false">▾ Ver ${ocultas} más${tt ? '' : ' · O: objetivos'}</button>` : '<button type="button" class="mis-ver" data-mis-ver aria-expanded="true">▴ Ver menos</button>';
  }
  c.classList.toggle('con-tuto', !!tt);
  c.style.display = h ? 'block' : 'none';
  if (c._h !== h && !misPulsada(c)) { c.innerHTML = h; c._h = h; }
  // Columna de luz sobre la meta (como las zonas de mision de WoW).
  const dMeta = metaMision ? Math.hypot(metaMision.x - P.x, metaMision.z - P.z) : Infinity;
  if (metaTarea && !(T && T.dia && T.dia.l.some(t => t.id === metaTarea.id && !t.ok))) metaTarea = null;   // ya cumplida: se apaga su luz
  const fm = metaMision || metaTarea, dFaro = fm ? Math.hypot(fm.x - P.x, fm.z - P.z) : Infinity;   // sin mision principal, la luz marca la mision del dia tocada
  faro.visible = !!fm && dFaro > 12;
  if (fm) { faro.position.set(fm.x, alturaEn(fm.x, fm.z), fm.z); faro.material.color.set(fm.guia ? '#4ade80' : '#ffd84a'); }
  // Al llegar, la columna se apaga: queda un aro en el suelo y se explica que hacer
  // (antes desaparecia sin mas y parecia que no pasaba nada).
  faroAro.visible = !!metaMision && dMeta < 40;
  // Columna celeste sobre el hito del encargo de explorar.
  faroEnc.visible = !!metaEnc && Math.hypot(metaEnc.x - P.x, metaEnc.z - P.z) > 12;
  if (metaEnc) faroEnc.position.set(metaEnc.x, alturaEn(metaEnc.x, metaEnc.z), metaEnc.z);
  if (faroAro.visible) faroAro.position.set(metaMision.x, alturaEn(metaMision.x, metaMision.z) + 0.15, metaMision.z);
  if (q && metaMision && !metaMision.entreno && dMeta < 25 && avisoCampo !== yo.mis.i + ':' + q.tipo) {
    avisoCampo = yo.mis.i + ':' + q.tipo;
    const nom = (MONSTRUOS[q.tipo] || {}).nombre || q.tipo, falta = Math.max(0, q.n - yo.mis.p);
    const hay = [...mons.values()].some(o => o.k === q.tipo && !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 40);
    aviso(hay ? `📜 Aquí está tu misión: derrota ${falta} ${nom} (los marcados con ❗). Acércate y ${MOVIL ? 'toca ATACAR' : 'pulsa 1 o Z'} por cada golpe.` : `📜 Zona de ${nom}: aparecen en unos segundos aquí mismo. Te faltan ${falta}.`, 'ok', 1);
  }
}
const cristalesHito = [];
let caso = { p: [], s: '', sN: 0, res: 0 };
let avisoCampo = '', metaEnc = null, encargos = {}, encZonas = 0, encRecibido = false, secundarias = {};
const secVistas = new Set();
const faroEnc = (() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 70, 12, 1, true).translate(0, 35, 0), new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
  m.visible = false; escena.add(m); return m;
})();
const faroAro = (() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(10, 11, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
  m.visible = false; escena.add(m); return m;
})();
// El monstruo que pide la mision activa (null si ya esta lista).
function tipoMision() { const q = yo && yo.mis && MISIONES[yo.mis.i]; return q && yo.mis.p < q.n ? q.tipo : null; }
const faro = (() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 90, 12, 1, true).translate(0, 45, 0), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
  m.visible = false; escena.add(m); return m;
})();
// Tocar una mision del dia marca su camino (flecha y metros en la fila); se camina a mano, no hay piloto automatico.
let metaTarea = null;
function puntoTarea(t) {
  if (enCueva(P.x) || enAbismo(P.x)) return null;   // otras coordenadas: primero sal
  const def = TAREAS_DIA.find(x => x.id === t.id) || {}, tipo = def.tipo, cerca = (l, ok) => { let m = null, md = Infinity; for (const o of l) { if (ok && !ok(o)) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < md) { md = d; m = o; } } return m; };
  const zonaNv = () => { const z = zonaDeNivel(yo.nivel || 1); return ZONAS3D[z] || ZONAS3D[zonaEn(P.x, P.z)] || null; };
  if (tipo === 'pescar') {   // el agua mas cercana (aguaCerca pesca a 6 m de la orilla)
    for (let r = 8; r <= 420; r += 8) { let m = null; for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (!enCueva(x) && !enAbismo(x) && alturaEn(x, z) < MUNDO.agua - 0.6) { m = { x, z }; break; } } if (m) return m; }
    return null;
  }
  if (tipo === 'mazmorra') return portal ? { x: portal.x, z: portal.z } : null;
  if (tipo === 'mundial') return { x: ARENA3D.x, z: ARENA3D.z };
  if (tipo === 'jefe') { const j = cerca(CAMPOS3D, cp => cp.jefe && (MONSTRUOS[cp.k] || {}).nivel <= (yo.nivel || 1) + 2) || cerca(CAMPOS3D, cp => cp.jefe); return j && { x: j.x, z: j.z }; }
  if (tipo === 'recoger') { const ah = performance.now(), n = cerca(NODOS, o => !(nodoListo.get(o.i) > ah) && Math.hypot(o.x - P.x, o.z - P.z) > 3); if (n) return { x: n.x, z: n.z }; const hz = hitoDe(zonaEn(P.x, P.z), ZONAS3D, alturaEn); return hz && { x: hz.x, z: hz.z }; }
  if (tipo === 'cofre') { const ah = Date.now(), cf = cerca(COFRES3, o => o.listoEn <= ah && Math.hypot(o.x - P.x, o.z - P.z) > 6); return cf && { x: cf.x, z: cf.z }; }
  if (tipo === 'invasion') { const iz = (invasion3 && invasion3.zona) || (invPre3 && invPre3.zona); return iz && ZONAS3D[iz] ? { x: ZONAS3D[iz].x, z: ZONAS3D[iz].z } : null; }
  if (tipo === 'zona') { const id = Object.keys(ZONAS3D).find(z => MAPAS[z] && MAPAS[z].nombre && t.txt === (def.txt || '') + MAPAS[z].nombre); if (id) return { x: ZONAS3D[id].x, z: ZONAS3D[id].z }; }
  if (tipo === 'zona' || tipo === 'caza' || tipo === 'raro' || tipo === 'grupo' || tipo === 'hab') { const zc = zonaNv(); return zc && { x: zc.x, z: zc.z }; }
  return null;
}
function caminoTarea(t) {
  if (!metaTarea || metaTarea.id !== t.id) return '';
  if (Date.now() - metaTarea.t > 30 * 60000) { metaTarea = null; return ''; }
  const d = Math.hypot(metaTarea.x - P.x, metaTarea.z - P.z);
  if (d < 15) { metaTarea.llego = metaTarea.llego || Date.now(); if (Date.now() - metaTarea.llego > 5000) metaTarea = null; return ' · ¡aquí!'; }   // se ve 5 s (el panel se repinta cada 333 ms)
  metaTarea.llego = 0;
  return ` · ${flechaDir(metaTarea.x, metaTarea.z)} ${Math.round(d)} m`;
}
function irTarea(i) {
  const t = yo && yo.tareas && yo.tareas.dia && yo.tareas.dia.l[i];
  if (!t || t.ok) return;
  if (t.id === 'exped') { V.abrirExpedicion(); return; }
  const p = puntoTarea(t);
  if (!p) { aviso(enCueva(P.x) || enAbismo(P.x) ? 'Sal al mundo para ver el camino de esta misión' : '➜ ' + t.txt); return; }
  metaTarea = { id: t.id, x: p.x, z: p.z, txt: t.txt, t: Date.now() };
  aviso('➜ ' + t.txt + ' · sigue la flecha', 'ok');
  if (COMPACTO) { $('misiones').classList.remove('abierto'); $('misiones').scrollTop = 0; }   // se pliega: abajo queda la fila con la ruta
  pintarMisiones();
}
// Cambiar mision pide dos toques (solo hay 1 cambio gratis al dia; sin confirm(): en Telegram queda feo)
let cambioPend = null;
try { if (localStorage.getItem('dq3_mis_pc') === '1') $('misiones').classList.add('pc-abierto'); } catch (e) {}
$('misiones').onclick = e => { if (e.target.closest('[data-mis-ver]')) { e.stopPropagation(); const ab = $('misiones').classList.toggle('pc-abierto'); try { localStorage.setItem('dq3_mis_pc', ab ? '1' : '0'); } catch (er) {} $('misiones').scrollTop = 0; pintarMisiones(); return; } if (e.target.closest('[data-objetivos]')) { e.stopPropagation(); OBJ.abrir(); return; } if (e.target.closest('[data-receta]')) { e.stopPropagation(); verReceta(); return; } if (e.target.closest('[data-caso-abrir]') && !(COMPACTO && !$('misiones').classList.contains('abierto'))) { e.stopPropagation(); verCaso(); return; } if (e.target.closest('[data-expabrir]')) { e.stopPropagation(); V.abrirExpedicion(); return; } if (e.target.closest('[data-ttemp]')) { e.stopPropagation(); V.abrirTiendaTemp(); return; } const en = e.target.closest('[data-entregar]'); if (en) { e.stopPropagation(); mandar(en.dataset.entregar === 'diaria' ? { t: 'mision', diaria: true } : { t: 'mision' }); return; } const b = e.target.closest('[data-cambiar]'); if (b) { e.stopPropagation(); const i = +b.dataset.cambiar; if (cambioPend && cambioPend.i === i && Date.now() - cambioPend.t < 4000) { cambioPend = null; mandar({ t: 'cambiarTarea', i }); } else { cambioPend = { i, t: Date.now() }; b.textContent = '¿Seguro?'; } return; } const ir = e.target.closest('[data-ir]'); if (ir) { e.stopPropagation(); irTarea(+ir.dataset.ir); return; } if (COMPACTO) { $('misiones').classList.toggle('abierto'); pintarMisiones(); return; } abrirMapa(); };
// Los metros cambian la caja cada 333 ms: repintarla bajo el dedo perdia el toque (🎯, Entregar, ▾). Mientras se pulsa, no se rehace.
function misPulsada(c) { return !!c._p && Date.now() - c._p < 1500; }
$('misiones').addEventListener('pointerdown', e => { e.currentTarget._p = Date.now(); }, { capture: true, passive: true });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { $('misiones')._p = 0; }, { capture: true, passive: true });
// ── MIS OBJETIVOS (objetivos.js): un toque desde la caja de misiones; tarjeta de lo siguiente tras completar algo ──
function puntoSec3(q) {
  if (!q || enCueva(P.x) || enAbismo(P.x)) return null;
  if (sinConfesar(q)) { const n = TODOS_NPC.find(x => x.nombre === q.quien); return n ? { x: n.x, z: n.z } : null; }
  if (q.tipo !== 'fabricar' && q.tipo !== 'pescar' && zonaEn(P.x, P.z) !== q.zona) { const zc = ZONAS3D[q.zona]; return zc ? { x: zc.x, z: zc.z } : null; }   // pescar y fabricar cuentan en cualquier zona
  const cerca = (l, ok) => { let m = null, md = Infinity; for (const o of l) { if (!ok(o)) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < md) { md = d; m = o; } } return m; };
  let r = null;
  if (q.tipo === 'caza') r = cerca(CAMPOS3D, o => o.k === q.k && zonaEn(o.x, o.z) === q.zona);
  else if (q.tipo === 'recoger') { const ah = performance.now(); r = cerca(NODOS, o => !(nodoListo.get(o.i) > ah) && Math.hypot(o.x - P.x, o.z - P.z) > 3 && zonaEn(o.x, o.z) === q.zona); }
  else if (q.tipo === 'cofre') { const ah = Date.now(); r = cerca(COFRES3, o => o.listoEn <= ah && o.zona === q.zona && Math.hypot(o.x - P.x, o.z - P.z) > 6); }
  else if (q.tipo === 'fabricar') r = NPCS3D.find(n => n.tipo === 'artesania');
  else if (q.tipo === 'pescar') { const id = (TAREAS_DIA.find(x => x.tipo === 'pescar') || {}).id; r = id ? puntoTarea({ id, txt: '' }) : null; }
  return r ? { x: r.x, z: r.z } : null;
}
function cofreCerca3() {
  let mc = null, md = 400; const ah = Date.now();
  for (const o of COFRES3) if (o.listoEn <= ah) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < md && d > 6) { md = d; mc = o; } }
  return mc && { x: mc.x, z: mc.z, tipo: mc.tipo, nombre: NOMBRE_COFRE[mc.tipo].replace(/^./, x => x.toUpperCase()) };
}
function peleando3() { try { const n = performance.now(); return !!(P && (n - (P.heridoT || 0) < 1500 || n - (P.atkT || 0) < 1500)); } catch (e) { return false; } }
function ocupadoObj3() {
  try {
    const n = performance.now();
    if (COMPACTO && innerHeight <= 500 && $('misiones').classList.contains('abierto')) return true;   // en horizontal la lista abierta ocupa el sitio de la tarjeta
    return jefeCerca() || camCombate || autoAtk || !!cineEst || !!loginPend3 || hayVentana() || hayLateral() ||$('v-diario').classList.contains('on') || document.body.classList.contains('tz-on') || colaNpc.length > 0 || !!document.querySelector('#npc-dice.on,#dq-noche,#probar-clase,#tira-diario.on,#dq-regalo.on,#dq-avtg.on,#tarjeta-bautizo,#cofre-sem,#cofre-meta.on') || !!(P && (P.muerto || n - (P.heridoT || 0) < 5000 || n - (P.atkT || 0) < 5000));
  } catch (e) { return true; }
}
const OBJ = crearObjetivos({
  yo: () => yo, P: () => P, MOVIL, mandar, aviso: (t, k) => aviso(t, k, 1), abrir, cerrar, V, sfx: () => sfxK('libro', 0.2),
  enCueva, enAbismo, zonaEn: () => zonaEn(P.x, P.z), metaMision: () => metaMision, metaEnc: () => metaEnc, pintarMisiones,
  camino: (x, z) => { const d = Math.hypot(x - P.x, z - P.z); return d < 25 ? ' · aquí' : ` · ${flechaDir(x, z)} ${Math.round(d)} m`; },
  zonaPunto: z => { const zc = ZONAS3D[z]; return zc ? { x: zc.x, z: zc.z } : null; }, puntoSec: puntoSec3, vistaSec, cofreCerca: cofreCerca3,
  secundarias: () => secundarias, encargos: () => encargos, invasion3: () => invasion3, invPre3: () => invPre3, asedio: () => asedio, asedioAbierto: () => !!yo && yo.nivel >= ABISMO.nvMin,
  cuevaHecha: () => !!(cuevaInfo && cuevaInfo.hecha), estadoFiesta: estadoFiestaDia, textoManana: textoManana3, soyInvitado: () => soyInvitado, modoAnuncio,
  irTarea, ponerDestino, verChicha, crearCuenta: irACrearCuenta, verLeyenda, verReceta, verCaso, ocupado: ocupadoObj3, peleando: peleando3,
  tutoActivo: () => !yo || !yo.mis || (yo.mis.i < 1 && (yo.nivel || 1) <= 6), capVisto,
});
function misionLista() { if (!yo) return false; const q = MISIONES[yo.mis.i]; const d = yo.diaria || {}; return (q && yo.mis.p >= q.n) || (!d.ok && (d.p || 0) >= DIARIA.n); }
function colorNivel(nv) { const d = nv - (yo ? yo.nivel : 1); return d >= 5 ? '#ff3344' : d >= 2 ? '#ff9900' : d <= -8 ? '#9a9a9a' : d <= -3 ? '#4ade80' : '#ffe600'; }
// Marca de peligro que no depende del color (daltonicos): ASCII porque la fuente pixel no tiene calavera.
function marcaNivel(nv) { const d = nv - (yo ? yo.nivel : 1); return d >= 5 ? '!! ' : d >= 2 ? '! ' : ''; }
const cieloAct = C(CIELO.pueblo), cieloObj = C(CIELO.pueblo);
// Un fallo en un cuadro no congela el juego: se avisa (como mucho cada 10 s) y se dibuja igual.
let bucleErrT = 0;
// Ritmo: tope de CUADRO_MS (60 fps; 30 en baja), nada si Telegram esta en
// segundo plano o la pestaña oculta, y 10 fps con una ventana encima del 3D
// (mapa, ajustes…; el editor de apariencia no, que muestra al duende).
let proxCuadro = 0, ventanaAb = false, ventanaAntes = false;
// Tope de cuadros en ms entre cuadros (0 = sin tope). Se lee en cada cuadro: el menu de ajustes lo cambia
// en vivo con window.dqTopeFps(30 | 45 | 60 | 0).
let topeCuadroMs = CUADRO_MS;
window.dqTopeFps = fps => { topeCuadroMs = fps > 0 ? Math.max(4, 1000 / fps - 0.3) : 0; proxCuadro = 0; return topeCuadroMs; };
// Ritmo regular: el tope se redondea a un numero entero de refrescos de la pantalla (medidos con los
// propios avisos de requestAnimationFrame). Antes, en 90/120/144 Hz un tope de 16,4 ms alternaba
// cuadros de 2 y 3 refrescos (tirones aunque la media fuera 60); ahora todos duran lo mismo:
// 144 Hz -> 72, 120 -> 60, 90 -> 90, 75 -> 75, 60 -> 60; y con tope de 30: 60 -> 30, 90 -> 30, 120 -> 30, 144 -> 28,8.
let vsMs = 16.67, vsMin = 99, vsN = 0, rafAntes = 0;
// Modo reposo: quieto, sin pelea ni habilidad y sin tocar nada en 4 s, se dibuja a 30 fps (20 en baja): menos bateria y calor.
let reposo = false, reposoAntes = false, reposoT = 0, topeFigT = 0;
const MAX_FIG = { baja: 8, media: 16, alta: 30 }[CAL] || 16;
const MAX_MON = { baja: 10, media: 18, alta: 40 }[CAL] || 18;
function calcReposo(t) {
  if (!yo || P.anda || autoAtk || lanzando || colaHab || t < gcdHasta || !P.suelo || P.vuela || P.planea) return false;
  if (t - Math.max(ultimoToqueT, movInputT) < 4000 || t - (P.heridoT || 0) < 5000 || t - (P.atkT || 0) < 4000) return false;
  return !enCombate3();
}
// Solo se dibujan los MAX_FIG jugadores mas cercanos (grupo, objetivo y duelo siempre); el resto deja sombra y nombre.
function topeFiguras() {
  const ls = [];
  for (const o of otros.values()) if (o.fig) {
    if (o.id === objetivoP || o.id === dueloCon || enGrupo(o.id)) o.fig._cerca = true;
    else ls.push(o);
  }
  if (ls.length <= MAX_FIG) { for (const o of ls) o.fig._cerca = true; return; }
  for (const o of ls) o._d2 = (o.x - P.x) * (o.x - P.x) + (o.z - P.z) * (o.z - P.z);
  ls.sort((a, b) => a._d2 - b._d2);
  for (let i = 0; i < ls.length; i++) ls[i].fig._cerca = i < MAX_FIG;
}
// Igual con los monstruos: solo se dibujan y animan los MAX_MON mas cercanos (objetivo, mision, jefes y elites siempre).
function topeMons() {
  // Monstruo de mision: solo el vivo mas cercano (el del '❗'); los demas del mismo tipo entran por distancia.
  let kMis = null; try { kMis = tipoMision(); } catch (e) {}
  let misId = null, misD = 1e18;
  if (kMis) for (const o of mons.values()) if (o.k === kMis && !o.muereT) { const d = (o.x - P.x) * (o.x - P.x) + (o.z - P.z) * (o.z - P.z); if (d < misD) { misD = d; misId = o.id; } }
  const ls = [];
  for (const o of mons.values()) if (o.fig && o.fig.tipo === 'modelo') {   // los sprites 2D no usan _cerca: no gastan cupo
    const dj = MONSTRUOS[o.k];
    if (o.id === objetivo || o.id === misId || o.j || o.mu || o.ra || o.iv || (dj && (dj.jefe || dj.mundial || (dj.dispara && o.st === 2)))) o.fig._cerca = true;
    else ls.push(o);
  }
  if (ls.length <= MAX_MON) { for (const o of ls) o.fig._cerca = true; return; }
  for (const o of ls) o._d2 = (o.x - P.x) * (o.x - P.x) + (o.z - P.z) * (o.z - P.z);
  ls.sort((a, b) => a._d2 - b._d2);
  for (let i = 0; i < ls.length; i++) ls[i].fig._cerca = i < MAX_MON;
}
// Guarda de NaN: si la posicion o la camara se rompen, vuelven a la ultima buena (un aviso por sesion).
const posOk = { x: 0, y: 0, z: 0, ok: false, cx: 0, cy: 0, cz: 0, cok: false, aviso: false };
function guardaNaN() {
  if (!Number.isFinite(P.x + P.y + P.z)) {
    if (posOk.ok) { P.x = posOk.x; P.y = posOk.y; P.z = posOk.z; } else { P.x = SPAWN3D.x; P.z = SPAWN3D.z; P.y = alturaEn(P.x, P.z) + 1.5; }
    if (!Number.isFinite(P.vy)) P.vy = 0;   // si la velocidad es la rota, volveria a romperse en el cuadro siguiente
    if (!posOk.aviso) { posOk.aviso = true; paso('nan_pos'); }
  } else { posOk.x = P.x; posOk.y = P.y; posOk.z = P.z; posOk.ok = true; }
  const c = camara.position;
  if (!Number.isFinite(c.x + c.y + c.z)) {
    if (posOk.cok) c.set(posOk.cx, posOk.cy, posOk.cz);
    if (!posOk.aviso) { posOk.aviso = true; paso('nan_pos'); }
  } else { posOk.cx = c.x; posOk.cy = c.y; posOk.cz = c.z; posOk.cok = true; }
}
function bucle(t, forzar) {
  if (forzar !== true) {
    requestAnimationFrame(bucle);   /* un cuadro forzado (pruebas) no abre otra cadena de avisos */
    // Refresco real de la pantalla: el menor intervalo entre avisos de los ultimos 40 (los cuadros lentos dan multiplos).
    const dRaf = t - rafAntes; rafAntes = t;
    if (dRaf > 2 && dRaf < vsMin) vsMin = dRaf;
    if (++vsN >= 40) { if (vsMin < 60) vsMs = vsMin; vsMin = 99; vsN = 0; }
    if (fuera3 || document.hidden) return;
    if (reposo && t - Math.max(ultimoToqueT, movInputT) < 4000) { reposo = false; proxCuadro = 0; }
    /* tope de FPS: lo fija el menú */
    const tope = topeCuadroMs;
    const paso = ventanaAb ? 100 : reposo ? Math.max(tope, CAL === 'baja' ? 50 : 33) : tope;
    // Cada cuantos refrescos toca dibujar (entero): asi todos los cuadros duran lo mismo.
    const cada = Math.max(1, Math.round(paso / vsMs - 0.15)) * vsMs;
    if (t - proxCuadro < cada - vsMs * 0.3) return;
    proxCuadro = t;
  }
  try { PERF.a(); armarColaFig(); cuadroBucle(t); }
  catch (e) {
    if (t - bucleErrT > 10000) { bucleErrT = t; console.error(e); avisarError('bucle: ' + ((e && e.message) || e), String(e && e.stack || '').split('\n')[1] || '', 0); }
    try { if (composer) composer.render(0.016); else render.render(escena, camara); } catch (e2) {}
  }
}
// Cadencias por tiempo (no por cuadros: con el tope o a 10 fps seguirian otro ritmo).
const cadT = [0, 0, 0, 0, 0];
function toca(i, ms, t) { if (t - cadT[i] < ms - 4) return false; cadT[i] = t; return true; }
function cuadroBucle(t) {
  // A 10 fps (o al salir de ahi) el tiempo de cuadro no dice nada del rendimiento.
  // En reposo (o al salir de el) tampoco: el tope lo pone el juego, no el movil.
  if (!ventanaAb && !ventanaAntes && !reposo && !reposoAntes) resolucionDinamica(t - ultimoT);
  ventanaAntes = ventanaAb; reposoAntes = reposo;
  if (t - reposoT > 250) { reposoT = t; reposo = calcReposo(t); }
  if (t - topeFigT > 500) { topeFigT = t; topeFiguras(); topeMons(); }
  const dt = Math.min(0.05, (t - ultimoT) / 1000); ultimoT = t;
  cuadro++;
  fisica(dt);
  if (prueba) girarPrueba();
  if (atkMantener || (atkReintento && atkReintento > t)) golpeManual(true);   // mantener ATACAR (o 1/Z) sigue pegando al ritmo del arma
  pintarAyudaAtk(t);   // anillo "a tiro" bajo el monstruo y recarga del boton ATACAR
  if (atkBuf && performance.now() >= sigAtk) { const v = performance.now() - atkBuf < 260; atkBuf = 0; if (v) golpeManual(); }
  if (colaHab && t >= gcdHasta) { const h = colaHab; colaHab = null; if (t < colaHasta) usarHab(h); }
  if (impactos.length) impactos = impactos.filter(i => { if (t < i.t) return true; if (!i.o.muereT) { i.o.golpeT = t; i.o.predT = t; i.o.golpeC = false; i.o.golpeDe = P; pausaGolpe(i.o, pesoArma().p); } return false; });
  // Interpolacion de los demas.
  for (const o of otros.values()) { avanzarHacia(o, t); animarJugador(o, false, t); }
  for (const o of mons.values()) {   /* borrar del Map mientras se recorre es seguro */
    if (!o.muereT) avanzarHacia(o, t);
    if (o.muereT && t - o.muereT > 1600) { quitarMon(o.id); continue; }
    animarMon(o, t);
  }
  if (P.fig) animarJugador(P, true, t);
  moverMascotas(t, dt);
  if (cuadro % 30 === 0) vecinosCerca();
  for (const n of npcs) if (n.fig && n.fig.tipo === 'modelo') {
    const dN = Math.hypot(P.x - n.x, P.z - n.z), cerca = dN < 12;
    n.ry = lerpAng(n.ry || 0, cerca ? Math.atan2(P.x - n.x, P.z - n.z) : 0, 1 - Math.exp(-5 * dt));
    mirarSuave(n.fig, n, t, n.ry, dN < 6 ? P : null);   // de cerca, la cabeza se adelanta al cuerpo
    n.fig.poner(n.x, n.y, n.z, n.ry, t);
  } else if (n.fig) { const h = n.fig.hoja; n.fig.cuadro(h.mov[1] + Math.floor(t / 600 + n.x) % 2, h.mov[0], P.x > n.x); n.fig.poner(n.x, n.y, n.z, camYaw); }
  moverAventureros(t, dt);
  // Proyectiles.
  if (proyectiles.length) proyectiles = proyectiles.filter(p => {
    p.t += dt / 0.28;
    const a = p.a, ay = (a.y || alturaEn(a.x, a.z)) + 1.2;
    p.mesh.position.set(lerp(p.de.x, a.x, p.t), lerp(p.de.y, ay, p.t) + Math.sin(p.t * Math.PI) * 0.8, lerp(p.de.z, a.z, p.t));
    const bajaP = POBRE || CAL === 'baja', cercaP = Math.hypot(a.x - P.x, a.z - P.z) < 45;
    // Estela: una particula cada 2 cuadros (en calidad baja no hay estela; lejos del duende tampoco).
    if (p.t < 1 && !bajaP && cercaP && (p.n++ % 2) === 0) { const q = p.mesh.position; FX.emitir(q.x, q.y, q.z, { n: 1, color: p.color, forma: p.forma, vida: 0.25, vel: 0.3, grav: 0, radio: 0.05 }); }
    if (p.t >= 1) {
      // Impacto con la forma del elemento (tambien en calidad baja, con menos particulas). Sin FX.golpe: el dano ya lo pinta
      // al llegar el aviso del servidor y las curas no deben parecer un golpe.
      if (cercaP) FX.emitir(a.x, ay, a.z, { n: bajaP ? 3 : MOVIL ? 4 : 7, color: p.color, forma: p.forma, vel: 2.2, vida: 0.4, grav: p.forma === 'humo' ? -1 : 3 });
      escena.remove(p.mesh); return false;
    }
    return true;
  });
  if (tajos.length) moverTajos(t);
  // Camara: detras del duende, sin meterse en el suelo.
  const tx = P.x, ty = P.y + 1.4, tz = P.z;
  // Solo el terreno (colinas entre el duende y la camara) y las paredes de la
  // cueva la acercan; arboles y casas no (lo que tapa se ve a traves). Acercar
  // es rapido pero suave, alejar es lento y espera un poco (sin "bombeo").
  const enCv = enCueva(P.x);
  // Camara de combate: con un objetivo vivo cerca (y sin que el jugador la haya movido
  // hace poco) gira sola para quedar detras del duende mirando al enemigo.
  const camLibre = !camAntes && !prueba && !lanzando && !P.muerto;
  const ahoraCam = performance.now();
  // Solo quieto (sin joystick ni teclas): al huir o caminar, girar la camara cambiaria hacia donde va el duende.
  const oCam = objetivo ? mons.get(objetivo) : null;
  const dObj = oCam ? Math.hypot(oCam.x - P.x, oCam.z - P.z) : 99;
  camCombate = !!(oCam && !oCam.muereT && oCam.hp > 0 && dObj < 14);
  if (!camCombate) camCombGira = false;
  // Histeresis: empieza a girar con mas de 0,6 rad de diferencia y sigue hasta quedar a 0,1 (sin temblar en el borde).
  // En PC espera mas (el raton manda) y nunca con una ventana abierta.
  if (camLibre && camCombate && camTouch.id === null && joy.id === null && !P.anda && !arrastre && !ventanaAb && ahoraCam - camArrastreT > (MOVIL ? 1500 : 4000)) {
    const o = oCam;
    if (dObj >= 1.5) {   // encima del duende atan2 es inestable: no girar
      const ideal = Math.atan2(P.x - o.x, P.z - o.z);   // camYaw apunta del duende a la camara
      const difC = Math.abs(Math.atan2(Math.sin(ideal - camYaw), Math.cos(ideal - camYaw)));
      if (difC > 0.6) camCombGira = true; else if (difC < 0.1) camCombGira = false;
      if (camCombGira) camYaw = lerpAng(camYaw, ideal, 1 - Math.exp(-(MENOS_MOV ? 1.1 : 2.2) * dt));
    } else camCombGira = false;
  } else camCombGira = false;
  // 🎬 Modo cine: orbita lenta alrededor del duende (sin orbita si el jugador pidio menos movimiento).
  if (cineEst && (P.muerto || camCombate || (P.heridoT || 0) > cineEst.t0)) salirCine();   // si te atacan o mueres, vuelve el HUD
  if (cineEst && cineEst.on && !MENOS_MOV) camYaw += 0.15 * dt;
  // Zoom de contexto: se abre con jefes o peleas de 3+, se acerca un poco en el pueblo.
  if (ahoraCam - camExtraT > 250) {
    camExtraT = ahoraCam; camExtraMeta = 0;
    if (camLibre && !cineEst) {   // en modo cine sin zoom de contexto: la camara cercana manda
      let n = 0;
      for (const o of mons.values()) if (!o.muereT && (o.st === 1 || o.st === 2) && Math.hypot(o.x - P.x, o.z - P.z) < 12) n++;
      if (n >= 3 || jefeCerca()) camExtraMeta = 3; else if (P.vuela || P.planea) camExtraMeta = 2.5; else if (zonaActual === 'pueblo') camExtraMeta = -1.5;
    }
  }
  camExtra += (camExtraMeta - camExtra) * (1 - Math.exp(-dt * 1.5));
  const vzO = vistaZona ? vistaZonaAplicar(ahoraCam) : null;   // panoramica de zona nueva (se resta abajo)
  const dCam = Math.max(3, camDist + camExtra);
  const camX = tx + Math.sin(camYaw) * Math.cos(camPitch) * dCam, camZ = tz + Math.cos(camYaw) * Math.cos(camPitch) * dCam;
  const kChoque = enCv ? choqueCueva(tx, tz, camX, camZ) : choqueTerreno(tx, ty, tz, camX, ty + Math.sin(camPitch) * dCam, camZ);
  const camMin = enCv ? 3.2 : 2.6;
  const meta = Math.max(Math.min(camMin, dCam), kChoque * dCam);
  if (meta < camReal - 0.01) { camReal += (meta - camReal) * (1 - Math.exp(-dt * 10)); camHold = 0.35; }
  else if (camHold > 0) camHold -= dt;
  else camReal += (meta - camReal) * (1 - Math.exp(-dt * 3));
  // Si la pared o una loma obliga a acercar, la camara sube; en peleas grandes se ve desde mas arriba.
  camSube += ((1 - kChoque) * (enCv ? 0.45 : 0.25) - camSube) * (1 - Math.exp(-dt * 6));   // suave: sin saltos al asomar una loma
  const pitch = camPitch + camSube + Math.max(0, camExtra) * 0.02;
  let cx = tx + Math.sin(camYaw) * Math.cos(pitch) * camReal, cz = tz + Math.cos(camYaw) * Math.cos(pitch) * camReal;
  let cy = ty + Math.sin(pitch) * camReal;
  cy = Math.max(cy, alturaEn(cx, cz) + 0.8, aguaEn(cx) + 0.5);
  if (enCv) cy = Math.min(cy, 7.2);   // bajo el techo de la cueva
  camara.position.set(cx, cy, cz); camara.lookAt(tx, ty, tz);
  if (vzO) { camYaw -= vzO.y; camDist -= vzO.d; camPitch -= vzO.p; }
  // Sensacion de velocidad: el campo de vision se abre un poco al galopar o volar rapido.
  // Golpe critico: la camara se acerca un instante y vuelve (v322).
  fovGolpe *= Math.exp(-dt * 9); if (Math.abs(fovGolpe) < 0.05) fovGolpe = 0;
  const fovObj = fovBase + fovGolpe + clamp((Math.hypot(P.vx, P.vz) / MUNDO.velocidad - 1.1) * 8, 0, 10) + ((P.vuela || P.planea) && !MENOS_MOV ? 5 : 0);
  if (Math.abs(camara.fov - fovObj) > 0.05) { camara.fov += (fovObj - camara.fov) * Math.min(1, dt * (fovGolpe ? 14 : 3)); camara.updateProjectionMatrix(); }
  TAPA.uCam.value.set(cx, cy, cz); TAPA.uTgt.value.set(tx, ty, tz);
  // Zona actual: titulo, cielo y niebla de su color.
  if (toca(0, 250, t)) {
    ventanaAb = hayVentana() && !$('v-look').classList.contains('on');
    try { musica.vuelo(P.vuela ? 1 : P.planea ? 0.6 : 0); } catch (e) {}   // viento mas fuerte en el aire
    const z = zonaEn(P.x, P.z);
    if (z !== zonaActual) { zonaActual = z; tituloZona(z); if (benditas3[z] > Date.now() && MAPAS[z]) aviso(`✨ ${MAPAS[z].nombre} está Bendecida: +10% XP al cazar (${Math.ceil((benditas3[z] - Date.now()) / 60000)} min)`, 'ok'); }
    if (cuevaInfo && !cuevaInfo.hecha && enCueva(P.x)) avisosSalaCueva(P.x - CUEVA_X0, P.z);
    ambiente(z);
    cullFlora();
    if (yo) {
      const n = npcCercano(), cf = n ? null : cofreCercano(), nd = n || cf ? null : nodoCercano(); const b = $('hablar');
      b.style.display = n || cf || nd ? 'block' : 'none';
      if (n) b.textContent = (MOVIL ? '' : 'E · ') + (n.tipo === 'portal' ? 'Mazmorras' : n.tipo === 'salida' ? 'Salir de la cueva' : n.tipo === 'salidaAbismo' ? 'Volver al pueblo' : n.tipo === 'maquina' ? 'Disparar ' + n.nombre.toLowerCase() : n.tipo === 'tiendaTemp' ? 'Tienda de la fiesta' : n.tipo === 'res' ? '✨ ' + n.nombre : (ROL_NPC[n.tipo] ? ROL_NPC[n.tipo] + ' · ' : 'Hablar con ') + n.nombre);
      else if (cf) b.textContent = (MOVIL ? '' : 'E · ') + 'Abrir ' + NOMBRE_COFRE[cf.tipo];
      else if (nd) b.textContent = (MOVIL ? '' : 'E · ') + 'Recoger ' + MATERIALES[nd.tipo].nombre;
      else if (!enCueva(P.x) && aguaCerca()) { b.style.display = 'block'; b.textContent = (MOVIL ? '' : 'E · ') + (pica > performance.now() ? '¡TIRAR!' : lanzando && lanzando.id === 'pescar' ? 'Esperando que pique…' : 'Pescar'); }
    }
    if (toca(1, 1000, t)) revisarNodos();
    animarCofres(t);
    for (const o of mons.values()) if (o.ra && !o.muereT && Math.abs(o.x - P.x) < 60 && Math.abs(o.z - P.z) < 60) FX.emitir(o.x, alturaEn(o.x, o.z) + 0.3, o.z, { n: 5, color: o.ti || '#ffd84a', vel: 1.2, vida: 1, grav: -2.5, radio: 0.8, tam: 0.8 });
    if (MOVIL) { const u = $('t-usar'), b = $('hablar'), ver = b.style.display === 'block' && !P.vuela && !P.planea; u.style.visibility = ver ? 'visible' : 'hidden'; if (ver) u.textContent = /Abrir/.test(b.textContent) ? 'ABRIR' : /Recoger/.test(b.textContent) ? 'RECOGER' : /Pescar|TIRAR|pique/.test(b.textContent) ? (/TIRAR/.test(b.textContent) ? '¡TIRAR!' : /pique/.test(b.textContent) ? 'ESPERA…' : 'PESCAR') : /Salir/.test(b.textContent) ? 'SALIR' : /Disparar/.test(b.textContent) ? 'FUEGO' : /Resucitar/.test(b.textContent) ? 'REVIVIR' : /🛒 Tienda/.test(b.textContent) ? 'TIENDA' : /📜 Misiones/.test(b.textContent) ? 'MISIONES' : /⚒️ Fabricar/.test(b.textContent) ? 'FABRICAR' : /🏆 Ranking/.test(b.textContent) ? 'RANKING' : 'HABLAR';
      const tira = ver && typeof pica === 'number' && pica > performance.now();   // la pica: boton rojo y grande, imposible de no ver
      if (tira) { u.textContent = '¡TIRAR!'; u.classList.add('grande', 'on'); } else if (u.classList.contains('on')) u.classList.remove('grande', 'on');
      if (ver) u.style.fontSize = u.textContent.length > 7 ? '10px' : ''; }
    if (npcAbierto && $('v-npc').classList.contains('on')) { const n = NPCS3D.find(x => x.tipo === npcAbierto) || VEC_TIPO.get(npcAbierto); if (n && Math.hypot(P.x - n.x, P.z - n.z) > NPC_DIST + 6) cerrar('v-npc'); }
    flechasAmenaza();
  }
  cieloAct.lerp(cieloObj, Math.min(1, dt * 1.5));
  nieblaAct.lerp(nieblaTinteObj, Math.min(1, dt * 1.5));
  escena.background.copy(nieblaAct); escena.fog.color.copy(nieblaAct);
  // Cupula: horizonte = niebla (con el tinte de la zona); cenit mas profundo
  // (de dia azul intenso, de noche casi negro); banda calida al amanecer y ocaso.
  cielo.m.position.copy(camara.position);
  cielo.u.uHor.value.copy(nieblaAct);
  cielo.u.uTop.value.copy(cieloAct).lerp(CENIT_DIA, 0.5 * (1 - nocheK)).lerp(CENIT_NOCHE, 0.45 * nocheK).multiplyScalar(0.6 + 0.22 * (1 - nocheK));
  cielo.u.uSol.value.copy(solDir); cielo.u.uNoche.value = nocheK;
  ocasoAct = lerp(ocasoAct, ocasoK, Math.min(1, dt * 1.5)); cielo.u.uOcaK.value = ocasoAct;
  cielo.u.uBruma.value = lerp(cielo.u.uBruma.value, brumaObj, Math.min(1, dt));
  if (estrellas.material.opacity > 0.01) estrellasT.value = t / 1000;
  const zC = zonaEn(P.x, P.z);
  nubes3.im.visible = zC !== 'cueva';
  if (nubes3.im.visible) { nubes3.mover(dt, P.x, P.z); nubes3.mat.color.setRGB(1 - nocheK * 0.72, 1 - nocheK * 0.7, 1 - nocheK * 0.6); }
  escena.fog.near = lerp(escena.fog.near, nieblaObj[0], Math.min(1, dt)); escena.fog.far = lerp(escena.fog.far, nieblaObj[1], Math.min(1, dt));
  const flash = t - relampagoT < 120 || (t - relampagoT > 220 && t - relampagoT < 300);
  hemi.intensity = 1.5 * hemiBase + (flash ? 2.4 : 0);
  if (flash) escena.background.lerp(C('#e8ecff'), 0.5);
  estrellas.position.copy(camara.position);
  // El sol (y su sombra) siguen al duende.
  sol.target.position.set(P.x, P.y, P.z);
  sol.position.set(P.x + solDir.x * 0.5, P.y + solDir.y * 0.5, P.z + solDir.z * 0.5);
  moverLluvia(dt, t);
  // Linterna del duende: un charco de luz calida bajo sus pies de noche (fuera de cueva y Abismo).
  luzDuende.visible = nocheK > 0.5 && !enCueva(P.x) && !enAbismo(P.x);
  if (luzDuende.visible) luzDuende.position.set(P.x, alturaEn(P.x, P.z) + 0.06, P.z);
  // Cueva y Abismo solo existen para el render dentro de su zona (estan lejos y no se ven desde fuera).
  if (cueva) cueva.grupo.visible = cueva.grupo.matrixWorldAutoUpdate = enCueva(P.x);
  if (abismo) abismo.grupo.visible = abismo.grupo.matrixWorldAutoUpdate = enAbismo(P.x);
  if (cueva && enCueva(P.x)) cueva.animar(t);
  if (abismo && enAbismo(P.x)) { abismo.animar(t); animarCorrientes(t); }
  else if (!enCueva(P.x)) animarCorrientesMundo(t);
  animarNocheDuendes(t);
  if (tirosAsedio.length) moverTirosAsedio(t);
  for (const cr of cristalesHito) { cr.rotation.y = t / 900; cr.position.y += Math.sin(t / 500) * 0.004; }
  if (molinoAspas && Math.hypot(P.x, P.z) < 160) molinoAspas.rotation.x = t / 1400;
  if (corcho) { const ahC = performance.now(), amC = (corcho.userData.am || []).some(a => ahC >= a && ahC < a + 120);
    corcho.position.y = corcho.userData.y0 + (pica > ahC ? -0.18 + Math.sin(t / 60) * 0.08 : amC ? -0.07 + Math.sin(ahC / 25) * 0.03 : Math.sin(t / 500) * 0.04); }
  if (agua && agua.material.uniforms) {
    // Agua viva: refleja el horizonte, brilla con el sol (o la luna) y se oscurece de noche.
    AGUA_U.uT.value = t / 1000; AGUA_U.uCielo.value.copy(nieblaAct); AGUA_U.uSol.value.copy(solDir);
    AGUA_U.uSolC.value.copy(sol.color).multiplyScalar(clamp(sol.intensity / 2, 0.15, 1));
    AGUA_U.uLuz.value = clamp(0.25 + hemi.intensity * 0.55, 0.25, 1.5);
  } else if (agua) agua.material.opacity = 0.7 + Math.sin(t / 900) * 0.04;
  if (bruma) {
    // Bruma de Cumbres: solo se ve desde encima del manto (no se camina dentro de ella).
    const obj = zC === 'cumbres' ? clamp((cy - BRUMA_Y - 1) / 6, 0, 1) * 0.85 : 0;
    bruma.k = lerp(bruma.k, obj, Math.min(1, dt * 0.8));
    bruma.m.visible = bruma.k > 0.02;
    if (bruma.m.visible) {
      bruma.m.material.opacity = bruma.k; bruma.m.position.set(cx, BRUMA_Y, cz);
      bruma.tex.offset.set(cx / 80 + t / 90000, -cz / 80);
      bruma.m.material.color.setRGB(0.93 - nocheK * 0.6, 0.95 - nocheK * 0.58, 0.98 - nocheK * 0.5);
    }
  }
  if (portal) portal.velo.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
  pintarObjetivo();
  if (toca(2, 100, t)) { pintarMini(); pintarCds(); pintarAuras(); pintarObjetivoP(); }
  if (toca(3, 333, t)) { pintarMisiones(); revisarAtrasTg(); }
  if (efectos.length) efectos = efectos.filter(e => {
    e.t += dt / e.dura;
    const r = 0.5 + e.radio * Math.min(1, e.t);
    e.m.scale.set(r, r, r); e.m.material.opacity = (e.op ?? 0.8) * (1 - e.t);
    if (e.t >= 1) { escena.remove(e.m); e.m.material.dispose(); return false; }
    return true;
  });
  for (const [id, z] of zonas3) { const k = clamp((performance.now() - z.ini) / z.ms, 0, 1); if (performance.now() - z.ini > z.ms + 1500) { quitarZona3(id); continue; } const kk = Number.isFinite(k) ? k : 0; z.disco.material.opacity = 0.12 + 0.4 * kk; const sd = Math.max(0.05, kk) * z.r; const sdOk = Number.isFinite(sd) ? sd : 0.01; z.disco.scale.set(sdOk, 1, sdOk); if (z.anillo) { const sa = Math.max(0.01, kk * z.r); z.anillo.scale.setScalar(Number.isFinite(sa) ? sa : 0.01); z.anillo.material.opacity = 0.5 + 0.45 * kk; } }
  // Sacudida suave (seno con fase, sin ruido): crece algo mas que lineal y con tope, asi los golpes chicos no marean.
  if (sacudir > 0) { sacudir = Math.max(0, Math.min(0.6, sacudir) - dt); const am = sacudir * (0.3 + sacudir * 0.4) * (MENOS_MOV ? 0.15 : 1); camara.position.x += Math.sin(t * 0.09) * am; camara.position.y += Math.cos(t * 0.11) * am; }
  alasMesh.visible = (P.vuela || P.planea) && !!yo;
  if (alasMesh.visible) ponerAlas(alasMesh, P.x, P.y, P.z, P.fig && P.fig.tipo === 'modelo' ? P.ry : camYaw, t, P.planea ? 'planea' : ((P.vy || 0) > 1 ? 'sube' : ''));
  if (P.vuela && !POBRE && CAL !== 'baja' && (++estelaN % 3) === 0) FX.emitir(P.x - (P.vx || 0) * 0.05, P.y + 1.2, P.z - (P.vz || 0) * 0.05, { n: 1, color: caEstela, vida: 0.5, vel: 0.3, grav: -0.5, radio: 0.6, tam: 1 });
  etiquetas(t);
  if (numeros.length) numeros = numeros.filter(n => {
    n.t += dt;
    const s = aPantalla(n.x + n.dx * n.t, n.y + n.t * 1.2 - n.t * n.t * 0.35, n.z);
    if (!s || n.t > 1.1) { n.d.style.display = 'none'; poolNum.push(n.d); return false; }
    let k = n.t < 0.12 ? 1 + (n.g ? 0.8 : 0.4) * (1 - n.t / 0.12) : 1;
    if (n.pop > 0) { k *= 1 + 0.25 * n.pop; n.pop = Math.max(0, n.pop - dt * 6); }
    n.d.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(2)})`;
    n.d.style.opacity = 1 - Math.max(0, n.t - 0.7) / 0.4;
    return true;
  });
  if (gestosVivos.size) moverGestos(dt);
  if (toca(4, 500, t)) {   // ambiente de motas por zona (particulas.js)
    const z = zonaEn(P.x, P.z), nch = nocheK > 0.5;
    FX.ambiente(z === 'eter' || z === 'abismo' ? 'eter' : z === 'cueva' || z === 'cavernas' ? 'polvo' : z === 'cumbres' ? 'nieve' : z === 'tormenta' || z === 'castillo' ? 'ceniza' : z === 'desierto' ? 'arena' : z === 'selva' || z === 'pueblo' ? (nch ? 'luciernagas' : 'hojas') : nch ? 'luciernagas' : '');
  }
  guardaNaN();
  vFX.set(P.x, P.y, P.z); FX.actualizar(dt, vFX, lienzo.height);
  PERF.b();
  if (composer) composer.render(dt); else render.render(escena, camara);
  PERF.c();
}
const vFX = new THREE.Vector3();

// Estado visible en la consola para depurar (solo lectura).
window.__dq3 = { P, mons, otros, get objetivo() { return objetivo; }, get autoAtk() { return autoAtk; }, get yo() { return yo; }, cuadro: () => bucle(performance.now(), true), recibir,
  camara: (yaw, pitch) => { camYaw = yaw; if (pitch !== undefined) camPitch = pitch; } };

// ── INICIO ──
async function inicio() {
  progreso(0.1, 'Cargando el arte del juego…');
  // El kit de Kenney se baja mientras se construye el terreno (antes, despues).
  const kitP = PRUEBA.has('sinKenney') ? null : cargarKenney('/assets/3d/');
  if (kitP) kitP.catch(() => {});   // el fallo se trata abajo
  // La sesion web (puede refrescar el token por red) se pide ya, en paralelo con el terreno; tokenWeb nunca falla.
  const tokP = TG ? null : tokenWeb();
  if (!USAR_MODELOS) await Promise.all([cargarAnim(), cargarImg(A + 'skins/duende_anim.png')]);
  progreso(0.3, 'Levantando montañas…');
  await new Promise(r => setTimeout(r, 20));
  agua = crearTerreno();
  progreso(0.45, 'Trayendo árboles y casas…');
  if (kitP) {
    try { KIT = await Promise.race([kitP, new Promise((_, no) => setTimeout(() => no(new Error('tiempo de espera')), 15000))]); }
    catch (e) { console.warn('[3D] sin modelos del kit, figuras de siempre:', e); KIT = null; }
  }
  progreso(0.55, 'Plantando bosques…');
  await new Promise(r => setTimeout(r, 20));
  crearFlora();
  // Hitos de los encargos: un obelisco con un cristal que brilla en cada zona.
  for (const zE of ZONAS_ENC) {
    const hi = hitoDe(zE, ZONAS3D, alturaEn), y = alturaEn(hi.x, hi.z);
    const ob = KIT ? new THREE.Mesh(KIT.geo('n_statue_obelisk'), KIT.material) : new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 5, 6).translate(0, 2.5, 0), new THREE.MeshLambertMaterial({ color: 0x8b8578, flatShading: true }));
    if (KIT) { const cj = KIT.caja('n_statue_obelisk'); ob.scale.setScalar(5.5 / (cj.max[1] - cj.min[1])); }
    ob.position.set(hi.x, y - 0.1, hi.z);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
    cr.position.set(hi.x, y + 6.4, hi.z); cristalesHito.push(cr);
    escena.add(ob, cr); ponerSolido(hi.x, hi.z, 0.9);
  }
  portal = crearPueblo();
  for (const n of NPCS3D) ponerSolido(n.x, n.z, 0.55);
  try { crearPuestosVecinos(); } catch (e) { console.warn(e); }
  ponerSolido(portal.x - 2.2, portal.z, 0.7); ponerSolido(portal.x + 2.2, portal.z, 0.7);
  cueva = construirCueva(escena);
  abismo = construirAbismo(escena, KIT);
  crearCofres3();
  for (const c of abismo.solidos || []) ponerSolido(c.x, c.z, c.r);
  abismo.dueno(asedio && asedio.dueno);
  crearCorrientes();
  crearCorrientesMundo();
  progreso(0.7, 'Preparando los gráficos…');
  // El socket y el 'hola' salen ya, en paralelo con shaders, mapa y NPC (antes, al final).
  // El rescate (#r=) pregunta antes de entrar: ese caso conecta abajo, como siempre.
  if (ENTRADA_DIRECTA && (TG || !rescateHash)) { entradaPedida = true; conectar(); }
  try { if (render.compileAsync) await Promise.race([render.compileAsync(escena, camara), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
  progreso(0.75, 'Dibujando el mapa…');
  await new Promise(r => setTimeout(r, 20));
  pintarMapaBase();
  if (USAR_MODELOS) try { precalentar(); } catch (e) { console.warn(e); }
  try {
    const cal = [new THREE.Mesh(GEO_BALA, matBala('#ffffff')), new THREE.Mesh(GEO_ONDA, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }))];
    if (USAR_MODELOS) { cal.push(crearMonstruo('goblin_normal').obj); cal.push(crearDuende({}).obj); cal.push(crearDuende({ skin: 'legendaria', arma: 'chispa' }).obj); }
    cal.forEach(m => { m.position.set(P.x, -50, P.z); escena.add(m); });
    render.compile(escena, camara);
    cal.forEach(m => escena.remove(m));
  } catch (e) { console.warn(e); }
  // Los NPC en paralelo (sin modelos 3D, sus hojas se bajaban una tras otra).
  const figsNpc = await Promise.all(NPCS3D.map(n => figuraModelo(() => crearNpc(n.hoja, n.tipo === 'chichera' ? { color: '#7c3aed', acc: 'paja', accC: '#d9b35c' } : undefined)) || figuraHoja(n.hoja, 62)));
  NPCS3D.forEach((n, i) => npcs.push({ ...n, y: alturaEn(n.x, n.z), fig: figsNpc[i], lbl: etiqueta('') }));
  // La plaza entra ya; los narradores de zona, al acercarte (vecinosCerca).
  const figsVec = await Promise.all(VECINOS.map(n => n.zona === 'pueblo' ? (figuraModelo(() => crearNpc(n.hoja, n.look)) || figuraHoja(n.hoja, 62)) : null));
  VECINOS.forEach((n, i) => npcs.push({ ...n, y: alturaEn(n.x, n.z), fig: figsVec[i], perezoso: n.zona !== 'pueblo', lbl: etiqueta('') }));
  try { crearAventureros(); } catch (e) { console.warn(e); }
  try { crearNocheDuendes(); } catch (e) { console.warn(e); }
  try { crearDecoTemporada(); } catch (e) { console.warn(e); }
  P.lbl = etiqueta('yo');
  progreso(0.9, 'Conectando con el mundo…');
  paso('arte_ok');
  // Telemetria de rendimiento (una vez por sesion, ya pasado el tiron de entrar): calidad + fluidez y familia de GPU.
  // Los umbrales escalan con el tope (en baja, 30 fps es lo normal).
  setTimeout(() => {
    try {
      const k = CUADRO_MS / 16.4;
      paso('fps_' + CAL + '_' + (dtProm < 20 * k ? 'ok' : dtProm < 36 * k ? 'justo' : 'lento'));
      const fam = (/SwiftShader|llvmpipe|softpipe/i.exec(GPU) ? 'swiftshader' : (/Mali|Adreno|PowerVR|Apple|Intel/i.exec(GPU) || ['otra'])[0]).toLowerCase();
      paso('gpu_' + fam);
    } catch (e) {}
  }, 90000);
  PERF.ini(render, escena);
  requestAnimationFrame(bucle);
  // Lo que llego del servidor durante la carga, en orden (un mensaje roto no corta los demas).
  arteListo = true;
  for (const m of colaArte.splice(0)) { try { recibir(m); } catch (e) { console.error(e); } }
  // Todos entran directo: Telegram, cuenta web, invitado que vuelve y tambien el
  // invitado nuevo (el servidor le pone 'DuendeNNNN'; el nombre se cambia luego).
  // Antes el nuevo veia una pantalla de nombre con un texto de CLASSIC: un toque
  // mas y gente del anuncio que se iba. La pantalla v-inicio de abajo queda solo
  // como reserva (ENTRADA_DIRECTA = false la recupera).
  const tok = await tokP;
  // Duende que llega desde el navegador de Facebook/Instagram (#r=, ya borrado de la URL).
  if (rescateHash && !TG && !tok) await adoptarRescate(rescateHash);
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  let inv = null; try { inv = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (TG || tok || (inv && nombre)) { entradaPedida = true; conectar(); return; }
  // El nuevo que antes veia el formulario: se marcan sus dos pasos (el embudo de /mmostats sigue cuadrando).
  if (ENTRADA_DIRECTA) { paso('form_visto'); paso('clic_entrar'); entradaPedida = true; conectar(); return; }
  $('carga').style.display = 'none';
  abrir('v-inicio');
  paso('form_visto');
  const entrar = () => {
    const n = $('in-nombre').value.trim();
    // Vacio vale: el servidor le pone 'DuendeNNNN'. Corto no: se dice por que.
    if (n && n.length < 3) { $('in-nombre').focus(); $('in-nota').style.display = 'block'; return; }
    try { if (n) localStorage.setItem('dq_mmo_nombre', n); } catch (e) {}
    paso('clic_entrar');
    $('carga').style.display = 'flex'; progreso(1, 'Entrando al mundo…');
    entradaPedida = true;
    conectar();
  };
  $('b-entrar').onclick = entrar;
  $('in-nombre').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') entrar(); });
}
// Entrada en un toque para el invitado nuevo (sin pantalla de nombre).
const ENTRADA_DIRECTA = true;
// Adopta el duende del codigo de rescate. Si en este navegador ya hay otro duende
// distinto, se pregunta con un boton (el anterior queda en dq_mmo_tok_previo, como en /inicio/).
function adoptarRescate(c) {
  let antes = ''; try { antes = localStorage.getItem('dq_mmo_tok') || ''; } catch (e) {}
  const viajo = () => { const avisar = () => (yo ? aviso('🧳 Tu duende viajó contigo. ¡Sigue la aventura!', 'ok') : setTimeout(avisar, 1000)); setTimeout(avisar, 1500); };
  const usar = () => { try { if (antes && antes !== c) localStorage.setItem('dq_mmo_tok_previo', antes); localStorage.setItem('dq_mmo_tok', c); localStorage.removeItem('dq_mmo_nombre'); } catch (e) {} viajo(); };
  if (!/^[a-f0-9]{32}$/.test(antes) || antes === c) { if (antes !== c) usar(); else viajo(); return Promise.resolve(); }
  return new Promise(listo => {
    $('carga').style.display = 'none';
    const fondo = document.createElement('div');
    fondo.className = 'heredar-fondo';
    fondo.innerHTML = '<div class="heredar-caja" role="dialog" aria-modal="true"><h3>¿Seguir con el duende que traes?</h3><p class="heredar-txt">En este navegador ya hay otro duende de invitado. Si eliges el que traes, el otro no se pierde: su código queda guardado aquí.</p><button class="heredar-si">Jugar con el duende que traigo</button><button class="heredar-no">Quedarme con el de este navegador</button></div>';
    const fin = si => { if (si) usar(); fondo.remove(); $('carga').style.display = 'flex'; listo(); };
    fondo.querySelector('.heredar-si').onclick = () => fin(true);
    fondo.querySelector('.heredar-no').onclick = () => fin(false);
    document.body.appendChild(fondo);
  });
}
inicio().catch(e => { console.error(e); avisarError('inicio: ' + ((e && e.message) || e), '', 0); if (window.__dqFallo && $('carga').style.display !== 'none') window.__dqFallo('El mundo 3D no terminó de cargar. Reintenta o juega con el mismo duende en CLASSIC (2D).'); });
