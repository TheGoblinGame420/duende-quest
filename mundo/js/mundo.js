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
  habsDe, habPorId, costoHab, RECURSOS, GCD_MS, MONTURAS, velMontura, MATERIALES, RECETAS, APARIENCIA, LOOK_BASE, limpiarLook, ALAS, alaDe,
  LOGIN_PREMIOS, multLogin, diaRacha, semanaRacha, multSemanaRacha, premioRacha, PASE, premioPase, paseMes, HERM_COSTO, HERM_NIVEL, HERM_MAX, HERM_COLORES, GESTA_UMBRALES, GESTA_NOMBRES, GESTA_MIN, CHICHA, RAREZAS, nombreItem, talento, LOGROS, premioAmigo, TINTES, GESTOS, MASCOTAS } from '/mmo/js/data.js?v=349';
import { iniciarVentanas } from './ventanas.js?v=349';
import { EXPEDICION, VERSION, horaFelizTiempos, premioDiaria, BESTIARIO_HITOS, progresoLogro, ESPEC_NIVEL, costoCambioClase } from '/mmo/js/data.js?v=349';   // fila 🧭 de las misiones; VERSION: la del cliente frente a la del servidor
import { iniciarRegalo } from '/mmo/js/regalo.js?v=349';
import { iniciarAvisoTg } from '/mmo/js/avisotg.js?v=349';
import { crearDuende, crearMonstruo, crearNpc, crearMontura, precalentar } from './modelos.js?v=349';
import { crearMusica } from './musica.js?v=349';
import { crearSonidos } from './sonidos.js?v=349';
import { construirCueva } from './cueva.js?v=349';
import { TAPA, transparentar } from './tapa.js?v=349';
import { construirAbismo } from './abismo.js?v=349';
import { crearParticulas } from './particulas.js?v=349';
import { cargarKenney, piezasCasa } from './kenney.js?v=349';
import { CORRIENTES, sueloRef, ABISMO, ABISMO_X0, FACCIONES, enAbismo, islaEn, portalBase, VACIO, RANGOS, rangoDe, santuario, PUERTA_NUCLEO, MAQUINA, MAQUINA_DIST, maquinasAbismo, TEMP_ABISMO, FACC_BONO, RECLUTA } from '/mmo/js/abismo3d.js?v=349';
const MAQUINAS = maquinasAbismo();
import { CUEVA, CUEVA_X0, caminable, enCueva } from '/mmo/js/cueva3d.js?v=349';
import { MUNDO, ZONAS3D, NPCS3D, NPC_DIST, CASAS, SPAWN3D, ARENA3D, horaMundo, climaEn, nodos3d, RECOGER_DIST, alturaEn, zonaEn, mezclaEn, pendienteEn, campamentos, cofres3d, COFRE3D_DIST, revivirEn3d } from '/mmo/js/mundo3d.js?v=349';
import { encargosDe, hitoDe, ZONAS_ENC } from '/mmo/js/encargos3d.js?v=349';
import { SECUNDARIAS, secundariaDe } from '/mmo/js/secundarias.js?v=349';
import { LORE_ZONAS, LORE_NPC, LORE_HITOS, LORE_NIVEL60, LORE_TEMPORADA, AVENTUREROS, FRASES_AVENTUREROS, LORE_MISIONES, LORE_MONSTRUOS, LORE_TEMPORADA_LEYENDA } from './lore.js?v=349';

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
ajustarCompacto(); addEventListener('resize', ajustarCompacto);
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
  try {
    if (r) localStorage.setItem('dq_ref', JSON.stringify({ r, t: Date.now() }));
    else { const x = JSON.parse(localStorage.getItem('dq_ref') || 'null'); if (x && /^[a-z0-9]{6}$/.test(x.r) && Date.now() - x.t < 14 * 86400000) r = x.r; }
  } catch (e) {}
  // Si no, la invitacion del primer toque (origen.js, 30 dias).
  return r || (window.dqOrigen && window.dqOrigen().ref) || undefined;
})();
// Navegador interno de Facebook/Instagram/Messenger (los anuncios abren ahi): el
// duende de invitado vive en su almacenamiento, que se borra a menudo. Se ofrece
// pasarlo a Chrome/Safari con el codigo de rescate en el hash (#r=), nunca en la query.
const esIAB = !TG && /FBAN|FBAV|FB_IAB|Instagram|Messenger|musical_ly|BytedanceWebview|TikTok|trill|WhatsApp/i.test(navigator.userAgent);
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
function vibSel() { try { if (TG && TG.HapticFeedback && TG.HapticFeedback.selectionChanged && TGV('6.1')) TG.HapticFeedback.selectionChanged(); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

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
  hemiBase = 0.9 * luz * (0.32 + 0.68 * dia) * (0.6 + 0.4 * nub);
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
  if (cl !== climaAct) {
    climaAct = cl;
    lluvia.m.visible = cl === 'lluvia' || cl === 'tormenta' || cl === 'nieve';
    lluvia.m.material.color.set(cl === 'nieve' ? 0xffffff : 0xaabbdd);
    lluvia.m.material.opacity = cl === 'nieve' ? 0.9 : 0.5;
    if (NOMBRE_CLIMA[cl]) aviso(NOMBRE_CLIMA[cl] + ' en ' + (MAPAS[z] ? MAPAS[z].nombre : 'la zona'));
  }
  // La cueva y el Eter con su propia musica (antes sonaba la alegre del pueblo).
  musica.zona(enCueva(P.x) ? 'cavernas' : enAbismo(P.x) ? 'cumbres' : z); musica.noche(nocheK > 0.5); musica.clima(cl);
  musica.evento((temporadaDe() || {}).id || '');   // T'anta Wawa / Cosecha: fiesta andina en el pueblo
  temaPueblo(z);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const txt = (nocheK > 0.5 ? '🌙 ' : '☀ ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (NOMBRE_CLIMA[cl] ? ' · ' + NOMBRE_CLIMA[cl] : '')
    + (document.body.classList.contains('movil') || document.body.classList.contains('compacto')   // minimapa de 72-110 px: solo la cifra
      ? (enLinea3 > 1 ? ' · 👥 ' + enLinea3 : '')
      : (enLinea3 > 1 ? ' · 👥 ' + enLinea3 + ' en línea' : '') + (hoy3 > enLinea3 ? ' · ' + hoy3 + ' hoy' : ''));
  if ($('mini-r')._h !== txt) { $('mini-r').textContent = txt; $('mini-r')._h = txt; }
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
ajustar();

const progreso = (k, txt) => { window.__dqProg = k + (txt || ''); $('carga-i').style.transition = ''; $('carga-i').style.transform = `scaleX(${k})`; if (txt) $('carga-s').textContent = txt; };

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
// Distancia (0..1 del segmento) a la que la camara choca con un arbol, o 1.
function choqueCamara(tx, tz, cx, cz) {
  let k = 1;
  const dx = cx - tx, dz = cz - tz, l2 = dx * dx + dz * dz || 1;
  const x0 = Math.floor(Math.min(tx, cx) / REJ), x1 = Math.floor(Math.max(tx, cx) / REJ);
  const z0 = Math.floor(Math.min(tz, cz) / REJ), z1 = Math.floor(Math.max(tz, cz) / REJ);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const l = rejilla.get(gx + ',' + gz);
    if (!l) continue;
    for (const a of l) {
      const u = clamp(((a.x - tx) * dx + (a.z - tz) * dz) / l2, 0, 1);
      if (u < 0.08) continue;   // pegado al duende: no acercar de golpe
      const d = Math.hypot(tx + dx * u - a.x, tz + dz * u - a.z);
      if (d < a.r) k = Math.min(k, u - a.r / Math.sqrt(l2));
    }
  }
  return clamp(k, 0.15, 1);
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
        if (campos.some(c => Math.hypot(c.x - jx, c.z - jz) < 7)) break;
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
          const im = new THREE.InstancedMesh(KIT.geo(n), KIT.material, g.length);
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
    fa.f.position.y = fa.y + 2.95; fa.f.scale.setScalar(0.55);
  }
  // Fuente de la plaza (donde estaba el pozo).
  pon([{ n: 'p_fountain-round-detail' }], 0, 0, 0, 2.4, 2.5);
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
const faroles = [];
(() => {
  const palo = transparentar(new THREE.MeshLambertMaterial({ color: 0x3b2a1a }));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * 27, z = Math.sin(a) * 27, y = alturaEn(x, z);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 6), palo); p.position.set(x, y + 1.6, z);
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), farolMat); f.position.set(x, y + 3.35, z);
    escena.add(p, f); faroles.push({ p, f, x, y, z });
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
const anilloMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), anilloMat);
anillo.visible = false;
escena.add(anillo);
// Anillo pequeño "a tiro" (v344): bajo el monstruo mas cercano a menos de alcance+2 m.
// Amarillo = casi; verde (y late) = el golpe ya le llega.
const anilloTiroMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
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
// Alas en la espalda (ry = hacia donde mira; con sprites, hacia la camara).
function ponerAlas(g, x, y, z, ry, t) {
  const bat = Math.sin(t / 120) * 0.5;
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
    this.sombra.position.set(x, alturaEn(x, z) + 0.05, z);
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
    this.sombra = new THREE.Mesh(sombraGeo, sombraTex); this.sombra.scale.setScalar(Math.max(1.2, this.alto * 0.8));
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
    if (id) { try { this.montura = crearMontura(id); if (Q.sombras) this.montura.obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); escena.add(this.montura.obj); } catch (e) { console.warn(e); this.mId = ''; } }
  }
  poner(x, y, z, ry, t, escala) {
    // Pausa de golpe (hitstop): mientras this.pausa, el reloj de la animacion no avanza.
    if (this.pausa && this.tUlt) { const dp = Math.min(100, Math.max(0, t - this.tUlt)); this.tE += dp; this.tOff = (this.tOff || 0) + dp; }
    this.tUlt = t;
    const ts = (t - (this.tOff || 0)) / 1000;
    const d = Math.hypot(x - P.x, z - P.z);
    // Tope de figuras (gama baja): fuera de los MAX_FIG mas cercanos solo queda la sombra-disco (el nombre va aparte, en etiquetas()).
    const enRango = d < escena.fog.far + 15, ver = enRango && this._cerca !== false;
    this.raiz.visible = ver; this.sombra.visible = enRango && (!Q.sombras || d > 24 || !ver);
    if (this.montura) this.montura.obj.visible = ver;
    if (!ver) { if (enRango) this.sombra.position.set(x, alturaEn(x, z) + 0.05, z); return; }
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
    const k = escala === undefined ? 1 : escala;
    this.raiz.scale.setScalar(this.escala * k);
    if (this.aplastaT) {
      const a = (t - this.aplastaT) / 280;
      if (a >= 1 || a < 0) this.aplastaT = 0;
      else { const q = this.aplastaK * Math.sin(a * Math.PI) * (1 - a * 0.5); this.raiz.scale.y *= 1 - q; this.raiz.scale.x *= 1 + q * 0.5; this.raiz.scale.z *= 1 + q * 0.5; }
    }
    if (this.estira) { this.raiz.scale.y *= 1 + this.estira; this.raiz.scale.x *= 1 - this.estira * 0.4; this.raiz.scale.z *= 1 - this.estira * 0.4; }
    if (animar) this.modelo.animar(this.est, (t - this.tE) / 1000, ts);
    this.sombra.position.set(x, alturaEn(x, z) + 0.05, z);
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
function numero(x, y, z, txt, color, grande) {
  if (numeros.length >= 24) { const v = numeros.shift(); v.d.style.display = 'none'; poolNum.push(v.d); }
  let d = poolNum.pop();
  if (!d) { d = document.createElement('div'); d.className = 'num'; capa.appendChild(d); }
  d.textContent = txt; d.style.color = color || '#fff'; d.style.fontSize = grande ? '22px' : ''; d.style.display = ''; d.style.opacity = 1;
  numeros.push({ d, x, y, z, t: 0, dx: (Math.random() - 0.5) * 0.8, g: !!grande });
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
function sfx(n, vol, x, z) {
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
    src.buffer = buf; src.playbackRate.value = SON.variar(0.06);
    g.gain.value = v;
    src.connect(g);
    if (pan && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = pan; g.connect(pn); pn.connect(SON.salida()); }
    else g.connect(SON.salida());
    voces++; src.onended = () => { voces--; };
    src.start();
  } catch (e) {}
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
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { for (const n of ['corte', 'corte2', 'golpe', 'muerte', 'moneda', 'boton', 'salto', 'explosion', 'caida']) cargarSfx(n); for (const b of ['paso_h', 'paso_p', 'g_carne', 'g_critico', 'desenv']) for (let i = 0; i < SFX_K[b]; i++) cargarSfx('k/' + b + i); }, { once: true });

// ── ESTADO ──
let ws = null, miId = 0, yo = null, conectado = false, reintentos = 0, fatal = false, forzarInvitado = false;
const P = { x: SPAWN3D.x, z: SPAWN3D.z, y: 1.5, vy: 0, suelo: true, ry: 0, anda: false, atkT: 0, heridoT: 0, fig: null, skin: '', lbl: null, muerto: false };
const otros = new Map();     // id -> { x, z, ry, a, hp, mx, n, lv, cl, sk, fig, lbl, tx, tz }
const mons = new Map();      // id -> { k, nv, x, z, ry, hp, mx, st, fig, lbl, tx, tz, muereT }
const npcs = [];
let atkBuf = 0, combo3T = 0;   // toque de ATACAR guardado justo antes de acabar la recarga; brillo del 3.er golpe
let objetivo = 0, autoAtk = false, sigAtk = 0, avisoLejosT = 0, avisoAlcT = 0, colaHab = null, colaHasta = 0;
let camYaw = Math.PI, camPitch = 0.42, camDist = COMPACTO ? 8.5 : 11, camReal = camDist, camHold = 0;
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
  este.onopen = () => { if (ws !== este) return; conectado = true; ultimoMsgT = performance.now(); mandar({ t: 'hola', ...hola, modo: '3d', ref: ref3, iab: esIAB ? 1 : undefined, src: window.dqOrigen ? window.dqOrigen().src : 'org', camp: window.dqOrigen ? window.dqOrigen().camp || undefined : undefined, ad: window.dqOrigen ? window.dqOrigen().ad || undefined : undefined, med: window.dqOrigen ? window.dqOrigen().med : undefined, fbc: window.dqOrigen ? window.dqOrigen().fbc : undefined, dev: huellaDev() }); };
  este.onmessage = ev => { if (ws !== este) return; ultimoMsgT = performance.now(); rxN++; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (!arteListo && m.t !== 'err' && m.t !== 'heredar') { colaArte.push(m); return; } recibir(m); };
  este.onclose = ev => {
    if (ws !== este) return;   // un socket viejo que el vigilante ya cambio por otro: no toca nada
    conectado = false;
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
  mandar({ t: 'ping', ts: Date.now() });
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
  bc.textContent = op && op.lleno ? 'Jugar el arcade mientras' : 'Cerrar';
  bc.onclick = op && op.lleno ? () => { location.href = '/game.html'; } : cerrarJuego;
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
setInterval(() => mandar({ t: 'ping', ts: Date.now() }), 20000);

// ── MENSAJES DEL SERVIDOR ──
let loginPend3 = null;   // premio diario guardado hasta que el jugador nuevo elija clase
function recibir(m) {
  switch (m.t) {
    case 'bienvenido':
      paso('bienvenido');
      try { sessionStorage.removeItem('dq_vcod'); } catch (e) {}   // llevar mi duende: el codigo ya se uso (o no valia)
      miId = m.id; yo = m.yo; reintentos = 0; if (ws) ws._listo = true;
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
      setTimeout(() => despuesMision1(ofrecerInstalar), 4000);   // tras la mision 1 y el premio diario, una vez al dia
      if (soyInvitado) { setTimeout(avisoInvitado, 20000); if (!avisoInvT) avisoInvT = setInterval(avisoInvitado, 60000); try { localStorage.setItem('dq_mmo_nombre', yo.nombre); } catch (e) {} }
      $('carga').style.display = 'none';
      cerrar('v-inicio');
      pintarHud(); pintarTemp3();
      // El nuevo entra ya como Guerrero (la recomendada): un paso menos antes de jugar. El que
      // vuelve sin clase (personaje antiguo) la elige como siempre.
      if (!yo.clase) { if (m.nuevo) { mandar({ t: 'clase', id: 'guerrero' }); setTimeout(() => aviso('⚔ Empiezas como Guerrero, la clase recomendada. Puedes cambiarla gratis hasta Nv 10 en ' + K('📖 (tecla P)', '⋯ → 📖') + ' → Especialización.', 'ok', 1), 6000); } else abrirClases(); }
      // Si el servidor no la pone (algo raro), a los 4 s se abre la ventana de siempre.
      if (!yo.clase && m.nuevo) setTimeout(() => { if (yo && !yo.clase && !$('v-clase').classList.contains('on')) abrirClases(); }, 4000);
      // Al nuevo se le da la bienvenida cuando ya eligio clase (antes quedaba detras de esa ventana).
      if (m.nuevo) { const bienv = () => { if (!yo || !yo.clase || avisoTapado()) return setTimeout(bienv, 1500); aviso('¡Bienvenido, ' + yo.nombre + '! Caza 5 goblins: sigue la luz amarilla ⬆', 'ok', 1); }; bienv(); }
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
      const antes = yo; yo = m.yo; pintarTemp3(); puntoTienda(); puntoMochila();
      if (esIAB) franjaIAB();   // tras la primera victoria: pasar el duende a Chrome/Safari
      // Enlace con #premium (o start_param=premium de Telegram): la tienda se abre al entrar.
      if (tiendaAlEntrar && yo.clase) setTimeout(() => { if (tiendaAlEntrar && !hayVentana()) { tiendaAlEntrar = false; abrirTiendaHud('bot', focoAlEntrar); focoAlEntrar = ''; } }, 1200);   // con otra ventana abierta, se reintenta con el siguiente 'yo'
      // Nueva mision de la cadena: el Guardia Tito cuenta por que importa.
      if (antes && antes.mis && yo.mis && yo.mis.i !== antes.mis.i && LORE_MISIONES[yo.mis.i]) setTimeout(() => aviso('🛡 Tito: «' + LORE_MISIONES[yo.mis.i] + '»'), 2500);
      // Embudo de las primeras misiones (una vez por sesion): mis_0 al entrar de novato, el resto al llegar a cada una.
      if (yo.mis && yo.mis.i <= 5 && (antes ? antes.mis && yo.mis.i !== antes.mis.i : yo.mis.i === 0)) paso('mis_' + yo.mis.i);
      if (antes && antes.nivel < 60 && yo.nivel >= 60) { aviso('🏆 ' + LORE_NIVEL60, 'ok'); setTimeout(() => aviso('🥤 Toca la barra morada de la chicha para reclamar tus 2 litros.', 'ok'), 5000); }
      ALAS_MAX = (ALAS[yo.ala] || ALAS.aprendiz).vuelo; if (!antes) P.alas = ALAS_MAX; alasPropias();
      ALAS_MAX && (P.alas = Math.min(P.alas, ALAS_MAX));
      if (antes && antes.skins && yo.skins && yo.skins.length > antes.skins.length) { const nueva = yo.skins.find(k => !antes.skins.includes(k)); const sk = nueva && SKINS[nueva]; if (sk) setTimeout(() => ofrecerPresumir('¡Estrené la skin ' + (sk.nombre || nueva) + ' en Duende Quest 3D!', 'look'), 1500); }
      if (antes && (yo.skin !== antes.skin || yo.clase !== antes.clase || yo.arma !== antes.arma || JSON.stringify(yo.look) !== JSON.stringify(antes.look))) cambiarSkinPropia();
      // Al elegir clase (antes '!antes' nunca se cumplia: 'bienvenido' ya trae yo).
      // En movil no se abre solo: esta en ⋯ → 🪞.
      if (antes && !antes.clase && yo.clase && !yo.look && !COMPACTO) { let visto = false; try { visto = localStorage.getItem('dq3_look_visto') === '1'; } catch (e) {} if (!visto) { const intentar = n => { if (!hayVentana() && !$('v-diario').classList.contains('on')) abrirLook(); else if (n < 20) setTimeout(() => intentar(n + 1), 1500); }; setTimeout(() => despuesMision1(() => intentar(0)), 1500); } }
      if (yo.muerto && !(antes && antes.muerto) && !P.muerto) morir();   // tras 'muerte' no borra su texto
      if (!yo.muerto) { if (P.muerto && pocionesTrasRevivir) { pocionesTrasRevivir = false; setTimeout(() => V.abrirTienda('pw'), 400); } if (P.muerto && bienvTrasRevivir) { bienvTrasRevivir = false; setTimeout(() => { if (yo && yo.puedeBienvenida && !yo.muerto && !enCombate3()) V.abrirTienda('premium', 'bienvenida', 'revivir'); }, 400); } chipBienvVisto = false; cerrar('v-muerte'); P.muerto = false; }
      ofrecerBienvenida(antes);
      if (yo.clase) cerrar('v-clase');
      if (yo.clase && loginPend3) { const lp = loginPend3; loginPend3 = null; setTimeout(() => mostrarDiario(lp), 900); if (lp.item && !lp.item.vendido) setTimeout(() => botinFuerte(lp.item), 3400); }
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
        if (tipo === 'hito') {
          try { localStorage.setItem('dq_mirador_' + zk, '1'); } catch (e) {}
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
    case 'zona3f': quitarZona3(m.id, true); break;
    // Tras el pisoton el jefe queda expuesto (+25 % de daño): etiqueta sobre él para contraatacar.
    case 'expuesto': {
      const o = mons.get(m.id); if (!o || o.muereT) break;
      const y = (o.y || alturaEn(o.x, o.z)) + 4;
      numero(o.x, y, o.z, '¡AHORA!', '#ffe600', true);
      setTimeout(() => { const q = mons.get(m.id); if (q && !q.muereT) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 4, q.z, '¡Expuesto!', '#facc15'); }, 900);
      if (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 25) vib('light');
      break;
    }
    case 'md3': { bestDeMuerte(m.id); const o = mons.get(m.id); if (o) { if (m.id === objetivo || performance.now() - (o.predT || 0) < 600) { vib('heavy'); sacudir = Math.max(sacudir, 0.12); pausaGolpe(o, 90); } o.muereT = performance.now(); o.st = 3; sfx('muerte', 0.36, o.x, o.z); if (Math.hypot(o.x - P.x, o.z - P.z) < 30) sfxK(Math.random() < 0.7 ? 'c_hurt' : 'c_grito', 0.32, o.x, o.z); const y = (o.y || alturaEn(o.x, o.z)) + 1; FX.emitir(o.x, y, o.z, { n: 30, color: '#c084fc', vel: 5, vida: 0.9, grav: 3, sube: 1.5 }); FX.emitir(o.x, y, o.z, { n: 14, color: '#fde68a', vel: 1.6, vida: 1.4, grav: -2, tam: 1.6, forma: 'estrella' }); FX.emitir(o.x, y - 0.5, o.z, { n: 7, color: '#5b5266', vel: 1.1, vida: 1.1, grav: -1, tam: 3, radio: 0.4, forma: 'humo' });
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
    case 'at3': ataqueVisto(m); break;
    case 'ph': golpeJugador(m); break;
    case 'b3': { const o = mons.get(m.de), q = m.a === miId ? P : otros.get(m.a); if (o && q) proyectil(o, q, '#c084fc'); break; }
    case 'muerte': morir(m); break;
    case 'tp3': case 'snap3':
      if (m.t === 'snap3' && Math.hypot(m.x - P.x, m.z - P.z) < 4) { P.corrX = m.x - P.x; P.corrZ = m.z - P.z; P.vx *= 0.5; P.vz *= 0.5; break; }
      P.x = m.x; P.z = m.z; P.y = (m.t === 'snap3' && P.vuela) ? Math.max(P.y, alturaEn(m.x, m.z) + 0.5) : alturaEn(P.x, P.z); P.corrX = P.corrZ = 0; P.vx = P.vz = 0;
      if (m.t === 'tp3' && !m.carga) { atkBuf = 0; if (P.vuela) volar(false); P.vy = 0; P.planea = false; camReal = camDist; caidaEnviada = false; }
      if (m.t === 'tp3' && m.abismo !== undefined) { zonaActual = ''; objetivo = 0; autoAtk = false; pintarBarra(); if (m.abismo) aviso('🌌 Entre las islas solo se pasa volando (' + K('V', 'VOLAR') + ') o planeando (' + K('mantén Espacio', 'mantén SALTO') + '). Las columnas de viento celestes recargan tus alas. ¡No caigas al vacío!', 'ok'); }
      if (m.t === 'tp3' && m.cueva !== undefined) {
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
    case 'inv3': invasion3 = m.on ? { ...m, recibido: Date.now() } : null; invPre3 = !m.on && m.pre && m.zona ? { zona: m.zona, hasta: Date.now() + (m.ms || 0), gran: m.gran } : null; if (m.bend) { benditas3 = {}; for (const z in m.bend) benditas3[z] = Date.now() + m.bend[z]; } pintarMisiones(); break;
    case 'cofre3': if (cueva) { cueva.cofre.visible = true; cueva.tapa.rotation.x = 0; } if (cuevaInfo) cuevaInfo.hecha = 1; SON.tocar('cofre', { vol: 0.9 }); pintarMisiones(); break;
    case 'cuevaFin': cuevaFinM = m; if (cuevaInfo) cuevaInfo.hecha = 1; if (yo) { yo.cuevaRec = m.rec || yo.cuevaRec || 0; yo.cuevaHoy = m.hoy; } pintarMisiones(); break;
    case 'logro': aviso('🏅 Logro: ' + m.titulo + (m.oro ? ' · +' + m.oro.toLocaleString('es') + ' oro' : '') + ' (llévalo como título desde ' + (MOVIL ? '⋯ → 🏆' : '🏆 Logros') + ')', 'ok'); SON.tocar('logro'); setTimeout(() => ofrecerPresumir('¡Conseguí el logro «' + m.titulo + '» en Duende Quest 3D!', 'logro'), 1500); FX.emitir(P.x, P.y + 1.5, P.z, { n: 30, color: '#ffd84a', vel: 4, vida: 1, grav: -1 }); break;
    case 'resJefe': try { resumenJefe(m); } catch (e) {} break;
    case 'gana':
      ganaSes++; bestDeGana(m); clearTimeout(revisarCasi.t); revisarCasi.t = setTimeout(revisarCasi, 1600);   // tras el 'yoC' con las cazas al dia
      { const ahR = performance.now(); rachaBajas.n = ahR - rachaBajas.t < 2500 ? Math.min(8, rachaBajas.n + 1) : 0; rachaBajas.t = ahR; SON.tocar('racha', { n: rachaBajas.n, vol: 0.8 }); }   // bajas seguidas: cada una un tono mas alto
      if (m.xp) numero(P.x, P.y + 2.6, P.z, '+' + m.xp + ' XP', '#c084fc');
      if (m.oro) { numero(P.x + 0.6, P.y + 2.2, P.z, '+' + m.oro + ' oro', '#ffd84a'); sfxK('monedas', 0.3); }
      if (m.chi) numero(P.x - 0.6, P.y + 2.4, P.z, '+' + m.chi + ' 🥤', '#e9b8ff');   // puntos de chicha (en 3D no se veian)
      else if (m.chl) numero(P.x - 0.6, P.y + 2.4, P.z, '🔒 🥤 desde Nv ' + CHICHA.nvPuntos, '#b8b0c8');   // candado: primeras cazas con Nv < 10
      // Objeto del evento de temporada (calabazas, t'anta wawas...): como en CLASSIC (client.js).
      if (m.cal) { const tp = TEMPORADAS.find(x => x.id === m.tp) || temporadaDe(); if (tp) { numero(P.x, P.y + 2, P.z, '+' + m.cal + ' ' + tp.emoji, tp.color); if (yo) yo[tp.campo] = (yo[tp.campo] || 0) + m.cal; if (window.dqTempG) window.dqTempG.n += m.cal; pintarTemp3(); } }
      if (m.item) vib('success');
      // Botin con su nombre y rareza (antes siempre decia "equipo nuevo", tambien si se vendio por bolsa llena).
      if (m.item) aviso('Botín: ' + (m.item.r !== undefined && RAREZAS[m.item.r] ? RAREZAS[m.item.r].nombre + ' · ' : '') + (m.item.nombre || nombreItem(m.item)) + (m.item.vendido ? ' (bolsa llena: vendido)' : ' (' + K('pulsa I', 'toca 🎒') + ' para verlo)'), 'ok');
      if (m.item && !m.item.vendido && m.primero !== 2) botinFuerte(m.item);   // primero===2: ya va equipado (no ofrecer «Equipar»)
      // Primera caza del personaje: botin garantizado (y nivel 2), con fiesta.
      if (m.primero) {
        paso('caza1');   // embudo: primera caza (ms desde el clic en entrar)
        aviso('🎉 ¡Primer botín!' + (m.item ? ' ' + (m.item.nombre || nombreItem(m.item)) + (m.primero === 2 ? ' ya va equipado.' : m.item.vendido ? ' (bolsa llena: vendido).' : ' está en tu bolsa.') : ''), 'ok');
        numero(P.x, P.y + 3.4, P.z, '¡PRIMER BOTÍN!', '#ffe600', true);
        FX.emitir(P.x, P.y + 1.5, P.z, { n: 50, color: '#ffe600', vel: 5, vida: 1.2, grav: -1 });
        FX.emitir(P.x, P.y + 1.5, P.z, { n: 30, color: '#c084fc', vel: 4, vida: 1, grav: -1 });
        setTimeout(() => vib('heavy'), 150); sfx('moneda', 0.6);   // tras el vib del botin (vib() descarta los de <70 ms)
      }
      break;
    case 'lv': if (m.p === miId) {
      if (!MOVIL) aviso('¡Subiste al nivel ' + m.lv + '!', 'ok');
      const cn = $('cartel-nv');
      if (cn) {
        cn.innerHTML = '¡NIVEL ' + m.lv + '!<small>' + (m.mx ? '❤ Vida máx ' + m.mx + ' · ' : '') + 'vida llena' + (m.lv >= 10 ? ' · 🌟 +1 talento' : '') + '</small>';
        cn.classList.remove('on'); void cn.offsetWidth; cn.classList.add('on');
      }
      numero(P.x, P.y + 3, P.z, 'NIVEL ' + m.lv, '#ffe600', true); subiNivel(m.lv); } else { const o = otros.get(m.p); if (o) o.lv = m.lv; } break;
    case 'toast': if (m.ofreceGrupo) { ofertaGrupo(m); break; } if (/Kit Compañero|te invitó/.test(m.m || '')) { const tx = m.m; let n = 0; const esperaKit = () => { if (++n <= 40 && (!yo || !yo.clase || avisoTapado())) return setTimeout(esperaKit, 1500); aviso(tx, 'ok', n > 40 ? 2 : 1); try { sfx('moneda', 0.5); } catch (e) {} }; setTimeout(esperaKit, 7000); break; } if (!(modoAnuncio() && /mTON|\bSOL\b|\$DUENDE|[Ww]allet/.test(m.m || ''))) aviso(m.m, m.ok ? 'ok' : '', avisoTapado() ? 1 : 0); if (m.yapeOk) V.alPedido({ t: 'yapeOk', codigo: m.yapeOk }); if (m.ok && (m.inv || /^⚔️ Invasión rechazada/.test(m.m || ''))) { const iv = m.inv || {}, md = { b: '🥉', p: '🥈', o: '🥇' }[iv.med]; setTimeout(() => ofrecerPresumir('¡Defendimos el pueblo de una invasión en Duende Quest 3D!' + (iv.n > 1 ? ' Éramos ' + iv.n : '') + (md ? ' · Mi medalla ' + md : '') + (iv.prox > 0 ? ' · Próxima en ' + iv.prox + ' min' : ''), 'invasion'), 2000); } break;   // modo anuncio: sin avisos cripto
    // mTON ganados aqui (jefes, jefe mundial, caza del dia): antes no se avisaba nada en ORIGINS
    case 'mton': { if (yo) yo.mton = m.total; if (modoAnuncio()) break; const por = { jefe: 'por el jefe', mundial: 'por el jefe mundial', diaria: 'por la caza del día' }[m.motivo]; aviso('💎 +' + m.n + ' mTON (tienes ' + ((m.total || 0) / 1000).toLocaleString('es', { maximumFractionDigits: 3 }) + ' TON)' + (por ? ' — ' + por : ''), 'ok'); numero(P.x, P.y + 3, P.z, '+' + m.n + ' mTON', '#00eeff'); sfx('moneda', 0.5); break; }
    case 'aviso': aviso(m.m); break;
    case 'no':
      if (lanzando && lanzando.pre) lanzando = null;   // el lanzamiento previsto no empezo
      // "Fuera de alcance" se avisa como mucho una vez cada 3 s (mantener pulsado ATACAR reintenta cada golpe).
      if (m.m === 'Fuera de alcance.') { if (performance.now() - avisoAlcT < 3000) break; avisoAlcT = performance.now(); }
      aviso(m.m, 'err'); break;
    case 'amigos': if (m.invitados) { inv3 = m; pintarAmigos3(); } if (m.ref) { refAmigo = m.ref; nivelAmigo = m.nivel || nivelAmigo; if (compartirPend) { const hist = compartirPend === 'h'; compartirPend = false; if (TG) compartir(hist); else { ofrecerPresumir(presumirTxt, undefined, true); aviso('Tu enlace está listo: toca el botón para enviarlo por WhatsApp.', 'ok'); } } } break;   // fuera de Telegram el navegador bloquea abrir WhatsApp sin un toque
    // Meta comunitaria «Entre todos» de la temporada (world.js tgInfo): la barra va en Logros.
    case 'tempG': if (m.tg && typeof m.tg.n === 'number') window.dqTempG = m.tg; break;
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
      avisoTgPed3 = !!(m && m.pedido); avisoTg3.alOferta(m); break;
    }
    case 'avisoTgOk': avisoTg3.alOk(m); break;
    case 'tareas': if (yo) { yo.tareas = m; pintarMisiones(); } break;
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
        if (dMp < 12 && !P.muerto && ahMp - mpreSonT >= 500) { mpreSonT = ahMp; SON.tocar('amenaza', { x: o.x, z: o.z }); vib('light'); }
        if (!esqTuto && dMp < 9) { esqTuto = true; try { localStorage.setItem('dq3_esqTuto', '1'); } catch (e) {} aviso(K('💨 ¡Pulsa X o Mayús para ESQUIVAR el golpe rojo!', '💨 ¡Toca el botón 💨 para ESQUIVAR el golpe rojo!'), 'ok', 1); } }
      break; }
    // Saliste de su alcance tras el aviso rojo (tope: 1 cada 1,5 s).
    case 'mesq': { const ah = performance.now(); if (P.muerto || ah - mesqT < 1500) break; mesqT = ah; numero(P.x, P.y + 2, P.z, '¡Esquivado!', '#4ade80', true); SON.tocar('esquivado'); vib('light'); break; }
    case 'habNo': gcdHasta = 0; break;
    case 'chat': lineaChat(m); break;
    case 'gesto': if (GESTOS[m.id]) mostrarGesto(m.p, m.id); break;
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
      if (m.ms > 0) { o.cast = { ini: performance.now(), fin: performance.now() + m.ms, n: m.n || 'Hechizo' }; if (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 25) aviso(`🥤 ${nom} lanza ${o.cast.n}: ${corte()}`, 'err'); }
      else {
        o.cast = null;
        if (m.cortado && Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`✋ ¡${nom} no pudo beber: lanzamiento interrumpido!`, 'ok');
        if (m.cura) { if (m.hp) o.hp = m.hp; if (Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`🥤 ${nom} bebió chicha robada y se curó. La próxima vez: ${corte()}`, 'err'); }
      }
      break;
    }
    // Misiones secundarias (mmo/js/secundarias.js): progreso y final con su historia.
    case 'sec': secundarias = m.l || {}; $('misiones')._h = ''; break;
    case 'secFin': { const q = SECUNDARIAS.find(x => x.id === m.id); if (q) { npcDice(q.quien, q.fin, q.emoji, false, q.sigue); sfxK('monedas', 0.4); vib('success'); } break; }
    case 'corriente': P.alas = ALAS_MAX; aviso('🌬 Corriente de viento: ¡alas recargadas!', 'ok'); sfxK('tela', 0.4); vib('light'); break;
    case 'alasAgotadas': if (P.vuela) { volar(false); P.planeoAuto = true; aviso('Tus alas se cansaron: planeas hacia el suelo.'); } P.alas = 0; break;
    case 'pica': pica = performance.now() + m.ms; aviso('🎣 ¡Pica! ' + K('Pulsa E', 'Toca ¡TIRAR!') + ' para tirar', 'ok'); sfx('boton', 0.7); vib('heavy'); break;
    case 'pescado': quitarCorcho(); sfx('moneda', 0.5); break;
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
    case 'atp3': { const de = m.p === miId ? P : otros.get(m.p), a = m.tg === miId ? P : otros.get(m.tg); if (de && !(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (de && a && m.v) proyectil(de, a, '#f0abfc'); break; }
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
    case 'cu': { const q = m.p === miId ? P : otros.get(m.p); if (q) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.4, q.z, '+' + m.n, '#4ade80', m.c); break; }
    case 'au': {
      const fin = m.ms < 0 ? Infinity : m.ms === 0 ? 0 : performance.now() + m.ms;
      const u = m.k === 'm' ? mons.get(m.id) : m.id === miId ? P : otros.get(m.id);
      if (u) { u.au = u.au || {}; if (fin) u.au[m.a] = fin; else delete u.au[m.a]; }
      break;
    }
    case 'res': if (m.p === miId) { aviso((m.de || 'Alguien') + ' te resucitó.', 'ok'); cerrar('v-muerte'); } break;
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
const skinYo = () => (skinPrueba && SKINS[skinPrueba] ? skinPrueba : yo.skin);
const claveYo = () => skinYo() + '|' + (yo.clase || '') + '|' + (yo.arma || '') + '|' + JSON.stringify(lookYo());
async function cambiarSkinPropia() {
  if (!yo) return;
  const clave = claveYo(), sk = skinYo();
  if (P.cargando === clave || (P.fig && P.skin === clave)) return;
  P.cargando = clave;
  const f = figuraModelo(() => crearDuende({ skin: sk, clase: yo.clase || null, arma: yo.arma || 'katana', look: lookYo() })) || await figuraJugador(sk);
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
  o.mu = !!d.mu; o.ra = d.ra || ''; o.ti = d.ti || ''; o.iv = !!d.iv;
  if (d.k === 'puerta_nucleo') {
    o.fig = new Figura3D(modeloPuerta(), 1);
    solidosExtra = solidosExtra.filter(x => x.id !== d.id).concat([-2.2, 0, 2.2].map(dz => ({ x: d.x, z: d.z + dz, r: 1.5, id: d.id })));
    return;
  }
  const esc3 = d.mu ? 2.4 : d.ra ? 1.35 : d.j ? 1.15 : 1;
  o.fig = figuraModelo(() => crearMonstruo(d.k), esc3) || await figuraHoja(def.hoja, st.alto * esc3);
  if (!mons.has(d.id) && o.fig) { o.fig.quitar(); o.fig = null; }
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
function quitarMon(id) { solidosExtra = solidosExtra.filter(x => x.id !== id); const o = mons.get(id); if (!o) return; if (o.fig) o.fig.quitar(); o.lbl.remove(); mons.delete(id); if (objetivo === id) { objetivo = 0; autoAtk = false; pintarBarra(); } }
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
  if (de) { if (!(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (m.v) proyectil(de, o, CLASES[(m.p === miId ? yo.clase : de.cl)] ? CLASES[(m.p === miId ? yo.clase : de.cl)].color : '#fff'); }
  if (m.d > 0) o.hp = Math.max(0, o.hp - m.d);
  if (m.d > 0 && Math.hypot(o.x - P.x, o.z - P.z) < 45) FX.golpe(o.x, (o.y || alturaEn(o.x, o.z)) + 1.1, o.z, { critico: m.c, color: m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff1c1' });
  // 3.er golpe del combo (el servidor lo marca con f): numero grande naranja con '!'.
  const fuerte = !!(m.f && m.p === miId && m.d > 0 && !m.c);
  if (m.p === miId || o.id === objetivo) {
    if (fuerte) numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, m.d + '!', '#ffb347', true);
    else numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, (m.c ? '¡' : '') + m.d + (m.c ? '!' : ''), m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff', m.c);
    if (fuerte) { sfxK('g_critico', 0.3); pausaGolpe(o, 60); }
    if (m.p === miId) { musica.combate(true); if (m.c) vib(TG && TG.HapticFeedback ? 'rigid' : 'medium'); else if (!autoAtk) vib('light'); sfx(m.c ? 'corte2' : 'corte', 0.28); sfxK(m.c ? 'g_critico' : 'g_carne', m.c ? 0.4 : 0.3); if (m.c) { sacudir = Math.max(sacudir, 0.15); fovGolpe = -3.5; } }
  }
  // Golpes de otros jugadores: suenan donde pasan (mas bajo y por su lado), como mucho ~8 por segundo.
  if (m.p !== miId && m.d > 0 && performance.now() - (ataqueVisto.sT || 0) > 120) { ataqueVisto.sT = performance.now(); sfxK(m.c ? 'g_critico' : 'g_carne', m.c ? 0.3 : 0.22, o.x, o.z); }
  // Tu golpe pesa: pausa corta (mas larga si es critico); si la prediccion ya pauso, solo el critico vuelve a pausar.
  if (m.p === miId && m.d > 0) { if (m.c || performance.now() - (o.predT || 0) >= 350) pausaGolpe(o, m.c ? 70 : 40); }
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
  if (m.d > 0) { numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.3, q.z, '-' + m.d, '#ff5a6a'); FX.emitir(q.x, (q.y || alturaEn(q.x, q.z)) + 1.1, q.z, { n: 8, color: '#ff4d5e', vel: 3.5, vida: 0.4 }); }
  if (m.esq && m.p === miId) numero(P.x, P.y + 2.3, P.z, 'Esquiva', '#7dd3fc');
  // Sin objetivo, quien te pega pasa a serlo: su marco dice quien es y el
  // ataque (1 o Z) y las habilidades van contra el.
  if (mo && m.p === miId && !mo.muereT && !objetivo && !objetivoP && !P.muerto) { objetivo = mo.id; pintarBarra(); }
  if (mo && m.p === miId && performance.now() - (mo.vozT || 0) > 5000 && Math.random() < 0.6) { mo.vozT = performance.now(); sfxK(vozDe(mo.k), 0.3); }
  // El que pelea con otro tambien grita de vez en cuando, desde donde esta.
  else if (mo && m.p !== miId && performance.now() - (mo.vozT || 0) > 8000 && Math.random() < 0.35) { mo.vozT = performance.now(); sfxK(vozDe(mo.k), 0.3, mo.x, mo.z); }
  if (m.p === miId) { P.heridoT = performance.now(); if (m.d > 0) vib('rigid'); sfxK('g_carne', 0.22); if (yo && m.d > 0) { herida(m.d, mo); yo.hp = Math.max(0, yo.hp - m.d); pintarVida(); } }
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
function onda(x, z, radio, color) {
  const m = new THREE.Mesh(GEO_ONDA, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, alturaEn(x, z) + 0.15, z);
  escena.add(m);
  efectos.push({ m, t: 0, dura: 0.5, radio });
}
const AREA = { torbellino: '#ff6633', abanico: '#cbd5e1', nova: '#9be7ff', meteoros: '#ff7a1a', rezo: '#4ade80', grito: '#ff3344' };
const A_DISTANCIA = { bola_fuego: '#ff7a1a', castigo: '#ffe9a8', misiles: '#c084fc', dolor: '#7c3aed', contrahechizo: '#7dd3fc', silencio: '#a78bfa', polimorfia: '#f9a8d4' };
function efectoHab(m) {
  const de = m.p === miId ? P : otros.get(m.p);
  const h = habPorId(m.id);
  if (de && !(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now();
  if (de && AREA[m.id]) onda(de.x, de.z, (h && h.radio ? h.radio / 17 : 6), AREA[m.id]);
  for (const [id, d, tipo] of m.h || []) {
    const o = mons.get(id);
    if (!o) continue;
    if (d > 0) o.hp = Math.max(0, o.hp - d);
    if (de && A_DISTANCIA[m.id]) proyectil(de, o, A_DISTANCIA[m.id]);
    if (m.p === miId || id === objetivo) numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.3, o.z, (tipo === 1 ? '¡' : '') + d + (tipo === 1 ? '!' : ''), tipo === 1 ? '#ffd34d' : '#ffe600', tipo === 1);
    o.golpeT = performance.now();
  }
  // Lanzar: whoosh (o campanitas si cura); las de otros suenan desde ellos y mas bajo.
  if (h && h.cura) SON.tocar('cura', m.p === miId || !de ? { vol: 0.9 } : { vol: 0.5, x: de.x, z: de.z });
  else SON.tocar('hab', m.p === miId || !de ? { vol: 0.7 } : { vol: 0.4, x: de.x, z: de.z });
  if (m.p === miId) { sfx(AREA[m.id] ? 'explosion' : 'corte2', 0.35); if (m.cp) aviso('Tajo del Otorongo con ' + m.cp + ' puntos de combo', 'ok'); }
}
const NOMBRE_AURA = { grito: 'Grito', muro: 'Muralla', bloque: 'Ataúd', escudoPoder: 'Escudo', renovar: 'Renovar', supresion: 'Calma', evasion: 'Evasión', sigilo: 'Sigilo', aturdido: 'Aturdido', almaDebil: 'Alma débil', bendicion: 'Bendición' };
function pintarAuras() {
  const ahora = performance.now();
  const l = Object.entries(P.au || {}).filter(([a, fin]) => fin > ahora && NOMBRE_AURA[a]);
  const html = l.map(([a, fin]) => `<span>${NOMBRE_AURA[a]}${fin !== Infinity ? ' ' + Math.ceil((fin - ahora) / 1000) + 's' : ''}</span>`).join('');
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
        const mh = !abierta && sitio < (document.body.classList.contains('texto-grande') ? (e.classList.contains('con-tuto') ? 104 : 62) : (e.classList.contains('con-tuto') ? 76 : 50)) ? Math.max(28, sitio) + 'px' : '';   // su alto cerrado en movil (index.html)
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
function proyectil(de, a, color) {
  const mesh = new THREE.Mesh(GEO_BALA, matBala(color));
  escena.add(mesh);
  proyectiles.push({ mesh, de: { x: de.x, z: de.z, y: (de.y || alturaEn(de.x, de.z)) + 1.2 }, a, t: 0 });
}
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
  const vida = m && m.vi && m.vn ? `${esc(m.vn)} aún tenía un ${m.vi}% de vida.` : '';
  const xp = !m ? '' : m.pvp ? 'Ante la otra facción no pierdes experiencia.' : m.espiral ? '✨ Tres caídas seguidas: esta vez no pierdes XP y revives con la Bendición del Duende (−25% de daño, 3 min).'
    : m.novato ? 'Hasta Nv 10 no pierdes XP.' : m.xp > 0 ? `Revivir cuesta −${fmtN(m.xp)} XP.` : '';
  // Consejo util: enemigo muy alto -> sube antes; con pociones sin usar -> usalas (tecla Q); sin pociones -> Mercader.
  const nvYo = (yo && yo.nivel) || 1, nvMax = Math.max(0, ...((m && m.golpes) || []).map(g => g.nv || 0));
  const zt = m && !m.pvp && nvMax >= nvYo + 3 ? Object.values(MAPAS).filter(z => z.zona && !z.instancia && !z.coliseo && z.nv && z.nv[0] <= nvYo).sort((a, b) => b.nv[0] - a.nv[0])[0] : null;
  const consejo = !m || m.pvp ? '' : nvMax >= nvYo + 3 ? `Ese enemigo es Nv ${nvMax} y tú Nv ${nvYo}: ${zt ? `sube antes en <b>${esc(zt.nombre)}</b> (Nv ${zt.nv[0]}-${zt.nv[1]})` : 'sube antes en una zona de tu nivel'} o ve en grupo.`
    : (m.pw || 0) > 0 ? `Tenías ${m.pw} ${m.pw === 1 ? 'poción' : 'pociones'} sin usar: ${K('pulsa Q', 'toca el botón de la poción en la barra')} cuando tu vida baje de la mitad.` : 'Sin pociones: cómpralas en el Mercader del pueblo.';
  $('muerte-txt').innerHTML = [quien, vida, `<b>${dondeRev}</b>`, xp, m && m.rep > 0 ? 'Reparar tu equipo cuesta ' + m.rep + ' oro.' : '', consejo].filter(Boolean).map(t => `<span style="display:block;margin:3px 0">${t}</span>`).join('');
  $('b-revivir').textContent = ab ? 'Revivir en el bastión' : cerca ? ((yo.nivel || 1) < 10 ? 'Revivir en la entrada' : 'Revivir aquí cerca') : 'Revivir en el pueblo';
  // Comprar pociones: revive en el pueblo (solo alli se compra) y abre la tienda de consumibles.
  const bp = $('b-revivir-pociones');
  if (bp) bp.style.display = ab || enCueva(P.x) || (m && m.inst) ? 'none' : '';
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
    ch.onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); ch.style.display = 'none'; pocionesTrasRevivir = false; bienvTrasRevivir = true; mandar({ t: 'revivir' }); };
    ref.insertAdjacentElement('afterend', ch);
  }
  ch.style.display = 'block'; chipBienvVisto = true;
}
// La ventana se cierra cuando el servidor confirma (llega 'yo' vivo): sin conexion no te quedas muerto y sin boton.
let pocionesTrasRevivir = false;
$('b-revivir').onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); pocionesTrasRevivir = false; mandar({ t: 'revivir' }); };
if ($('b-revivir-pociones')) $('b-revivir-pociones').onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); pocionesTrasRevivir = true; mandar({ t: 'revivir', pueblo: 1 }); };

// ── HUD ──
// Premio real siempre a la vista: al llegar a nivel 60, 2 litros de chicha
// morada (functions/mmo/chicha.js, meta 'nv60'). Tocarlo cuenta la leyenda o reclama.
let chicha3Txt = '';
function pintarChicha3() {
  const b = $('chicha3'), nv = yo.nivel || 1, rec = ((yo.chicha || {}).rec || []).includes('nv60');
  const t = rec ? `🥤 ${CHICHA.litros60} L de chicha reclamados ✓` : nv >= CHICHA.nv60 ? `🥤 ¡Reclama tus ${CHICHA.litros60} L de chicha morada!` : `🥤 Nv ${CHICHA.nv60} = ${CHICHA.litros60} L de chicha morada real · Nv ${nv}/${CHICHA.nv60}`;
  if (t === chicha3Txt) return;
  chicha3Txt = t; b.textContent = t; b.classList.toggle('listo', !rec && nv >= CHICHA.nv60);
}
// Ventana de la chicha en ORIGINS: puntos, los tres premios y como se reclaman.
function verChicha() {
  if (!yo) return;
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const ch = yo.chicha || { p: 0, hoy: 0, rec: [] }, rec = ch.rec || [], nv = yo.nivel || 1;
  const fila = (meta, tit, txt, pct, listo) => {
    const hecho = rec.includes(meta);
    const acc = hecho ? '<b style="color:#4ade80">✓ Reclamado</b>' : listo ? `<button class="btn" data-chi="${meta}" style="padding:6px 10px">Reclamar</button>` : `<b style="color:#fde68a">${pct}%</b>`;
    return `<div style="display:flex;gap:8px;align-items:center;margin:8px 0;padding:8px;border-radius:10px;background:rgba(124,58,237,.15);border:1px solid rgba(192,132,252,.35)"><div style="flex:1;min-width:0"><b style="color:#e9d5ff">${tit}</b><br><small>${txt}</small><div style="height:5px;background:rgba(0,0,0,.4);border-radius:3px;margin-top:4px"><i style="display:block;height:100%;width:${pct}%;background:#a855f7;border-radius:3px"></i></div></div>${acc}</div>`;
  };
  let h = `<img src="${imgLore()}" alt="" style="display:block;width:100%;max-height:120px;object-fit:${modoAnuncio() ? 'contain' : 'cover'};border-radius:10px;margin-bottom:8px">`;
  if (soyInvitado) h += `<p class="vv-p" style="color:#fca5a5">Juegas como invitado: los premios de chicha se reclaman entrando con Telegram (@duendequest_bot), con tu mismo duende.</p>`;
  h += `<p class="vv-p" style="text-align:center;font-size:20px;color:#fde68a;margin:4px 0">${(ch.p || 0).toLocaleString('es')} puntos de chicha</p><p class="vv-p" style="text-align:center;font-size:12px">Hoy ${ch.hoy || 0}/${CHICHA.porDia} · desde nivel ${CHICHA.nvPuntos}: 1 punto por monstruo, 3 si es de tu nivel, 25 un jefe.</p>`;
  h += fila('nv60', `Nivel ${CHICHA.nv60}: ${CHICHA.litros60} litros`, `Llega a nivel ${CHICHA.nv60} y te llevas ${CHICHA.litros60} litros a tu casa (Nv ${nv}/${CHICHA.nv60}).`, Math.min(100, Math.round(nv / CHICHA.nv60 * 100)), nv >= CHICHA.nv60);
  for (const meta of CHICHA.niveles) h += fila(meta, `${meta.toLocaleString('es')} puntos: 1 litro`, 'Un litro de chicha morada peruana enviado a tu casa.', Math.min(100, Math.round((ch.p || 0) / meta * 100)), (ch.p || 0) >= meta);
  // Requisitos a la vista (los mismos que revisa el servidor en chicha.js).
  const dj = ch.dj || 0, hj = Math.floor((ch.mj || 0) / 60), h60 = Math.round(CHICHA.min60 / 60), si = b => b ? '✅' : '⬜';
  h += `<p class="vv-p" style="font-size:12px;line-height:1.6;margin:6px 0"><b>Requisitos</b><br>${si(!soyInvitado)} Cuenta de Telegram<br>${si(nv >= CHICHA.nvPuntos)} Puntos desde nivel ${CHICHA.nvPuntos}<br>${si(nv >= CHICHA.nvReclamo)} Reclamar desde nivel ${CHICHA.nvReclamo} y 2 días de personaje<br>${si(nv >= CHICHA.nv60 && dj >= CHICHA.dias60 && hj >= h60)} ${CHICHA.litros60} litros: nivel ${CHICHA.nv60} + ${CHICHA.dias60} días jugados (${Math.min(dj, CHICHA.dias60)}/${CHICHA.dias60}) + ${h60} h de juego (${Math.min(hj, h60)}/${h60})<br>📦 Envíos solo en Perú</p>`;
  h += `<p class="vv-p" style="font-size:11px;color:var(--txt2)">Promoción gratuita: no hay que comprar nada. El equipo revisa cada reclamo y te escribe por Telegram para la dirección; nunca te pediremos pagos ni contraseñas.</p><button class="btn sec" id="chi-leyenda" style="width:100%">📜 La leyenda del Cántaro</button>`;
  $('diario-c').innerHTML = h;
  $('v-diario').querySelector('h2').textContent = '🥤 CHICHA MORADA REAL';
  $('diario-c').querySelectorAll('[data-chi]').forEach(b => b.onclick = () => {
    const meta = b.dataset.chi === 'nv60' ? 'nv60' : +b.dataset.chi;
    if (confirm(meta === 'nv60' ? `¿Reclamar tus ${CHICHA.litros60} litros de chicha morada? El equipo te escribirá por Telegram (nunca pagos ni contraseñas).` : '¿Reclamar tu litro de chicha morada? El equipo te escribirá por Telegram.')) { mandar({ t: 'chicha', meta }); b.disabled = true; }
  });
  $('chi-leyenda').onclick = verLeyenda;
  abrir('v-diario');
}
$('chicha3').addEventListener('click', verChicha);
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
  const p = PROXIMOS.find(x => x[0] > yo.nivel);
  let txt = '';
  if (p) {
    const n = p[0] - yo.nivel;
    txt = textoProximo(p[1], p[0]) + ' · ' + (n === 1 ? 'falta 1 nivel' : 'faltan ' + n + ' niveles');
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
function pintarHud() {
  if (!yo) return;
  const cl = CLASES[yo.clase];
  $('m-nombre').textContent = (yo.dios ? 'GM ' : '') + yo.nombre;
  $('m-nivel').textContent = 'Nv ' + yo.nivel + (yo.mae ? ' ★' + yo.mae : '') + (cl ? ' · ' + cl.nombre : '');
  $('oro').textContent = Number(yo.oro || 0).toLocaleString('es') + ' oro';
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
    atk.innerHTML = '<span class="t">1</span><img src="' + A + 'armas/katana_comun_item.png" alt=""><span class="cd"></span>';
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
        const ang = [-100, -135, -170][enArco++], r = ang * Math.PI / 180;
        d.classList.add('arco'); d.style.setProperty('--ang', ang + 'deg');
        d.style.setProperty('--dx', (95 * Math.cos(r)).toFixed(1) + 'px'); d.style.setProperty('--dy', (95 * Math.sin(r)).toFixed(1) + 'px');
      }
      d.innerHTML = `<span class="t">${i + 2}</span><img src="${A}items/equipo/${h.icono}.png" alt="">${yo.nivel < h.nv ? '<span class="lv">Nv ' + h.nv + '</span>' : ''}<span class="cd"></span><span class="cs"></span>`;
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
      d.innerHTML = `<span class="t">${p.tecla}</span><img src="${A}items/${p.icono}.png" alt=""><span class="n"></span><span class="cd"></span><span class="cs"></span>`;
      d.title = p.nombre + ' (' + p.tecla + ') — ' + p.desc;
      d.setAttribute('aria-label', d.title);
      d.onclick = () => { if (MOVIL) avisoPrimeraVez(d.title); if ((cdPoder[p.id] || 0) > performance.now() || !(yo && yo.pw && yo.pw[p.id] > 0)) rechazo(d); usarPoder(i); };
      if (MOVIL) d.addEventListener('touchstart', e => { e.preventDefault(); d.onclick(); }, { passive: false });
      b.appendChild(d);
    });
  }
  $('acc-atk').classList.toggle('on', autoAtk);
  // En movil la barra no lleva el boton de ataque: ATACAR muestra si el automatico esta puesto.
  if (MOVIL) { const ta = $('t-atk'); if (ta.classList.contains('on') !== autoAtk) { ta.classList.toggle('on', autoAtk); ta.textContent = autoAtk ? 'PARAR' : 'ATACAR'; } }
  b.querySelectorAll('[data-pw]').forEach(d => { d.querySelector('.n').textContent = (yo.pw && yo.pw[d.dataset.pw]) || 0; });
  pedirVela(autoAtk);
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
function revisarCasi() {
  if (!yo || !yo.clase || Date.now() - casiUlt < 120000) return;
  // Con una ventana abierta o en el tutorial temprano del movil el aviso (prioridad 3) se perderia: se espera a otra caza.
  try { if (avisoTapado() || (COMPACTO && tuto3.i >= 0 && tuto3.i < 3 && yo.nivel <= 6)) return; } catch (e) {}
  let visto = {}; try { visto = JSON.parse(localStorage.getItem('dq3_casi') || '{}') || {}; } catch (e) { visto = {}; }
  const tienen = yo.logros || [];
  for (const L of LOGROS) {
    if (tienen.includes(L.id) || visto[L.id]) continue;
    let p = null; try { p = progresoLogro(L.id, { ...yo, amigos: yo.amigosN || 0 }); } catch (e) { p = null; }
    if (!p || !(p[1] >= 5) || p[0] / p[1] < 0.8 || p[0] >= p[1]) continue;   // metas de 1-4 no tienen «casi»
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
  const clave = o.id + '|' + Math.ceil(o.hp) + '|' + o.mx + '|' + (yo ? yo.nivel : 0) + '|' + (yo && yo.best ? yo.best[o.k] || 0 : -1);
  if (clave !== objPintado) {
    objPintado = clave;
    const def = MONSTRUOS[o.k];
    bestRec.delete(o.id); bestRec.set(o.id, o.k); if (bestRec.size > 4) bestRec.delete(bestRec.keys().next().value);
    pintarChipBest(o.k, def);
    caja.style.display = 'block';
    $('o-nombre').textContent = (o.j ? '★ ' : '') + def.nombre;
    $('o-nivel').textContent = marcaNivel(o.nv) + 'Nv ' + o.nv;
    bestiario3(o.k, def.nombre);
    const hp = $('o-hp');
    hp.firstElementChild.style.transform = `scaleX(${clamp(o.hp / o.mx, 0, 1)})`;
    hp.lastElementChild.textContent = Math.ceil(o.hp) + ' / ' + o.mx;
  }
  // Barra de lanzamiento del objetivo (se repinta cada cuadro mientras dura).
  const bc = $('o-cast'), ahC = performance.now();
  if (o.cast && o.cast.fin > ahC) { bc.style.display = 'block'; bc.firstElementChild.style.transform = `scaleX(${clamp((ahC - o.cast.ini) / (o.cast.fin - o.cast.ini), 0, 1)})`; bc.lastElementChild.textContent = '🥤 ' + o.cast.n; }
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
function aviso(txt, tipo, prio) {
  txt = String(txt); prio = prio || (tipo === 'err' ? 1 : 2);
  const ahora = Date.now();
  if (ahora - (avisoVisto.get(txt) || 0) < 8000) return;
  if (prio > 1) {
    let tutoTemprano = false; try { tutoTemprano = COMPACTO && yo && yo.clase && tuto3.i >= 0 && tuto3.i < 3 && yo.nivel <= 6; } catch (e) {}
    if (tutoTemprano && prio > 2) return;
    if (tutoTemprano || avisoTapado()) {
      if (!colaAvisos.some(a => a.txt === txt)) colaAvisos.push({ txt, tipo, prio, vence: ahora + 30000 });
      while (colaAvisos.length > 6) colaAvisos.splice(colaAvisos.reduce((m, a, i, l) => a.prio > l[m].prio ? i : m, 0), 1);
      return;
    }
  }
  pintarAviso(txt, tipo, prio);
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
const NPC_EMOJI = { 'Abuela Sisa': '👵', 'Tayta Mallku': '👴', 'Chamán Amaru': '🌿', 'Herrera Coya': '⚒️', 'Viajera Illari': '🐪', 'Espía Kantu': '🗡️', 'Guardián Inti': '☀️', 'Minera Ñusta': '⛏️', 'Farera Quilla': '🏮', 'Sabia Mama Ocllo': '🦅' };
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
    return !!(P && (P.muerto || t - (P.heridoT || 0) < 6000 || (objetivo && t - (P.atkT || 0) < 6000)));
  } catch (e) { return false; }
}
// texto: un texto o una lista (la ultima con sigue: 'frase de suspense' sale en dorado).
function npcDice(quien, texto, emoji, ya, sigue) {
  const b = [].concat(texto).flatMap(npcBurbujas), s = sigue ? npcBurbujas(sigue) : [];
  if (!b.length && !s.length) return;
  const it = { quien: String(quien || ''), emoji: emoji || NPC_EMOJI[quien] || '📖', b: b.concat(s), nS: b.length, ya: !!ya };
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
  const pinta = () => {
    const p = d.querySelector('.nd-txt');
    p.textContent = it.b[i]; p.classList.toggle('sigue', i >= it.nS);
    d.querySelector('.nd-pag').textContent = it.b.length > 1 ? (i + 1) + '/' + it.b.length : '';
    d.querySelector('.nd-seguir').textContent = i < it.b.length - 1 ? 'Seguir ▸' : 'Cerrar ✓';
    d.querySelector('.nd-saltar').style.display = i < it.b.length - 1 ? '' : 'none';
  };
  const fin = () => { d.classList.remove('on'); d.onclick = null; setTimeout(npcSiguiente, 400); };
  d.querySelector('.nd-cara').textContent = it.emoji;
  d.querySelector('.nd-quien').textContent = it.quien;
  d.onclick = e => { e.stopPropagation(); if (e.target.closest('.nd-saltar') || i >= it.b.length - 1) return fin(); i++; pinta(); try { vibSel(); } catch (er) {} };
  pinta(); d.classList.add('on');
  try { sfx('moneda', 0.2); } catch (e) {}
}
function avisoTapado() { try { return hayVentana() || (COMPACTO && hayLateral()) || $('v-diario').classList.contains('on'); } catch (e) { return false; } }
function pintarAviso(txt, tipo, prio) {
  const max = COMPACTO ? 2 : 4;
  if (avisos.children.length >= max) {
    // Lleno: sale el de menor prioridad (el mas viejo si empatan); si todos pesan mas, este espera.
    let v = null; for (const c of avisos.children) if (!v || (c._prio || 2) > (v._prio || 2)) v = c;
    if (v && (v._prio || 2) >= prio) v.remove();
    else { colaAvisos.unshift({ txt, tipo, prio, vence: Date.now() + 30000 }); return; }
  }
  avisoVisto.set(txt, Date.now());
  if (avisoVisto.size > 60) avisoVisto.delete(avisoVisto.keys().next().value);
  const d = document.createElement('div'); d.textContent = txt; if (tipo) d.className = tipo; d._prio = prio;
  avisos.appendChild(d);
  setTimeout(() => d.remove(), Math.min(12000, Math.max(4500, txt.length * 60)));   // los largos (lore, premios) se leen enteros
}
setInterval(() => {
  if (!colaAvisos.length) return;
  const ahora = Date.now();
  for (let i = colaAvisos.length - 1; i >= 0; i--) if (colaAvisos[i].vence < ahora) colaAvisos.splice(i, 1);
  if (!colaAvisos.length || avisoTapado() || avisos.children.length >= (COMPACTO ? 2 : 4)) return;
  let tutoTemprano = false; try { tutoTemprano = COMPACTO && yo && yo.clase && tuto3.i >= 0 && tuto3.i < 3 && yo.nivel <= 6; } catch (e) {}
  if (tutoTemprano) return;
  const a = colaAvisos.shift(); avisoVisto.delete(a.txt); pintarAviso(a.txt, a.tipo, a.prio);
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
  escena.add(corcho);
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
    + '<button class="btn sec salir" id="g-salir">' + (Date.now() - salirPend < 4000 ? '¿Seguro? Toca otra vez' : 'Salir del grupo') + '</button>';
  if (c.innerHTML && html === pintarGrupo.ult) return;   // igual que antes: no rehacer (no se pierde el toque en móvil)
  pintarGrupo.ult = html;
  c.innerHTML = html;
  if ($('g-banda')) $('g-banda').onclick = () => { if (grupo3) mandar({ t: 'banda', si: !grupo3.banda }); };
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
}
function tituloZona(id) {
  const mp = id === 'eter' ? { nombre: ABISMO.nombre + ' · zona PvP', nv: [ABISMO.nvMin, 60] } : id === 'cueva' ? { nombre: CUEVA.nombre, nv: [cuevaInfo ? cuevaInfo.nv : 5, cuevaInfo ? cuevaInfo.nv : 60] } : MAPAS[id];
  $('tz-n').textContent = mp ? mp.nombre : 'Pueblo Duende';
  $('tz-s').textContent = mp && mp.nv ? 'Nivel ' + mp.nv[0] + '-' + mp.nv[1] : 'Zona segura';
  $('mini-z').textContent = $('tz-n').textContent;
  const t = $('titulo-zona'); t.style.opacity = 1;
  clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = 0; }, 3200);
  // La historia de la zona, una vez por sesion.
  const lz = LORE_ZONAS[id];
  if (lz && yo) { let vistas = ''; try { vistas = sessionStorage.getItem('dq3_lz') || ''; } catch (e) {} if (!vistas.split(',').includes(id)) { try { sessionStorage.setItem('dq3_lz', vistas + ',' + id); } catch (e) {} setTimeout(() => aviso('📜 ' + lz.intro), 1500); } }
  // Primera salida del pueblo de un novato: se le enseña a volar (una sola vez).
  try { if (id && id !== 'pueblo' && yo && (yo.nivel || 1) <= 3 && (yo.kills || 0) > 0 && !P.vuela && !localStorage.getItem('dq3_volar_hint')) { localStorage.setItem('dq3_volar_hint', '1'); setTimeout(() => aviso('🪽 ¡Ya saliste del pueblo! Toca ' + K('V', 'VOLAR') + ' y vuela hacia la luz amarilla.', 'ok', 1), 1800); } } catch (e) {}
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
function abrirClases() {
  const c = $('clases');
  c.innerHTML = '<p style="grid-column:1/-1;font-size:12px;margin:0;color:var(--txt2)">Toca una clase para elegirla. Hasta nivel 10 puedes cambiarla gratis.</p>';
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
const ROL_NPC = { guia: '📜 Misiones', tienda: '🛒 Tienda', ranking: '🏆 Ranking', artesania: '⚒️ Fabricar' };
const firmaNpc = t => JSON.stringify(t === 'guia' ? [yo.mis, yo.diaria] : t === 'tienda' ? [yo.pw, yo.oro] : [yo.mat, yo.pw]);
// Ventanas abiertas al dia (solo se repintan si cambia lo que muestran).
function refrescarVentanas(lleno) {
  if (lleno) V.actualizar();
  if (npcAbierto && npcAbierto !== 'ranking' && $('v-npc').classList.contains('on')) { const f = firmaNpc(npcAbierto); if (f !== firmaNpcAnt) abrirNpc(npcAbierto); }
}
function abrirNpc(tipo) {
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
    const b = $('n-mision'); if (b) b.onclick = () => { mandar({ t: 'mision' }); sfx('moneda', 0.4); };
    $('n-diaria').onclick = () => mandar({ t: 'mision', diaria: true });
  } else if (tipo === 'tienda') {
    cu.innerHTML = '<button class="btn" id="n-tienda" style="width:100%;margin-bottom:8px">Ver toda la tienda: armas, forja, skins, monturas…</button><p style="margin:0 0 6px">Tu oro: <b style="color:var(--oro)">' + (yo.oro || 0).toLocaleString('es', { useGrouping: 'always' }) + '</b></p><p>Consumibles para el camino:</p>' + PODERES.map(p => `<div class="fila"><span><img src="${A}items/${p.icono}.png" style="width:22px;vertical-align:middle;image-rendering:pixelated"> ${esc(p.nombre)} <small style="color:var(--txt3)">(${(yo.pw && yo.pw[p.id]) || 0})</small><br><small style="color:var(--txt3)">${esc(p.desc || '')}</small></span><span style="white-space:nowrap"><b style="color:var(--oro)">${p.precio}</b> <button class="btn" data-c="${p.id}" data-n="1" ${(yo.oro || 0) < p.precio ? 'disabled' : ''}>×1</button> <button class="btn sec" data-c="${p.id}" data-n="5" ${(yo.oro || 0) < p.precio * 5 ? 'disabled' : ''}>×5</button></span></div>`).join('');
    cu.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { mandar({ t: 'comprar', k: 'pw', id: b.dataset.c, n: +b.dataset.n }); sfx('moneda', 0.3); });
    $('n-tienda').onclick = () => { cerrar('v-npc'); V.abrirTienda('arma'); };
  } else if (tipo === 'ranking') {
    cu.innerHTML = '<p>Cargando el ranking…</p>';
    mandar({ t: 'ranking' });
  } else {
    const mat = yo.mat || {};
    const tengo = Object.entries(MATERIALES).filter(([k]) => mat[k]).map(([k, d]) => `<span style="white-space:nowrap"><img src="${A}items/equipo/${d.icono}.png" style="width:18px;vertical-align:middle;image-rendering:pixelated"> ${mat[k]}</span>`).join(' · ');
    cu.innerHTML = `<p>Recoge hierbas 🌿 y minerales ⛏ por el mundo (${K('tecla E', 'botón RECOGER')} junto a ellos) y yo te los convierto.</p><p style="margin:6px 0"><b>Tus materiales:</b> ${tengo || 'ninguno todavía'}</p>`
      + RECETAS.map(r => {
        const ok = Object.entries(r.pide).every(([k, n]) => (mat[k] || 0) >= n);
        const pide = Object.entries(r.pide).map(([k, n]) => `${n} ${MATERIALES[k].nombre}`).join(', ');
        return `<div class="fila"><span><b>${esc(r.nombre)}</b><br><small style="color:var(--txt3)">${esc(r.desc)} · ${pide}</small></span><button class="btn${ok ? '' : ' sec'}" data-r="${r.id}" ${ok ? '' : 'disabled'}>Fabricar</button></div>`;
      }).join('');
    cu.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { mandar({ t: 'fabricar', id: b.dataset.r }); sfx('moneda', 0.3); });
  }
  cu.insertAdjacentHTML('afterbegin', fraseNpc(n.id));
  abrir('v-npc');
}
// Una frase del PNJ (lore) arriba de su ventana; se mantiene al repintar.
const fraseNpcVista = {};
function fraseNpc(id) {
  const L = LORE_NPC[id]; if (!L) return '';
  if (!fraseNpcVista[id] || !$('v-npc').classList.contains('on')) fraseNpcVista[id] = L[Math.floor(Math.random() * L.length)];
  return `<p class="npc-dice" style="font-style:italic;color:#e9d5ff;border-left:3px solid #a855f7;padding:2px 0 2px 8px;margin:0 0 10px">«${esc(fraseNpcVista[id])}»</p>`;
}
function pintarRanking(r) {
  $('npc-c').innerHTML = fraseNpc('sabio') + (r || []).slice(0, 15).map((x, i) => `<div class="fila"><span>${i + 1}. ${esc(x.n)}</span><b style="color:${x.yo ? 'var(--ok)' : 'var(--txt)'}">Nv ${x.lv}</b></div>`).join('') || '<p>Aún no hay nadie.</p>';
}
// Inventario, libro de clase, tienda completa y logros (mundo/js/ventanas.js).
const V = iniciarVentanas({ mandar, yo: () => yo, aviso: (t, k) => aviso(t, k, 1), sfx, abrir, cerrar, telegram: () => !!TG && !forzarInvitado, probarSkin });
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
  const cruce = (antes.nivel < 5 && yo.nivel >= 5) || (muertes >= 2 && antes.muerto && !yo.muerto);
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
      || ($('v-diario') && $('v-diario').classList.contains('on')) || (typeof loginPend3 !== 'undefined' && loginPend3);
    if (ocupado) { if (n < 40) setTimeout(() => intentar(n + 1, inv), 3000); else bienvEnCurso = false; return; }
    bienvEnCurso = false;
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
  lookEditor = { cara: Math.floor(Math.random() * APARIENCIA.cara.length), cuerpo: Math.floor(Math.random() * 3), altura: Math.round((APARIENCIA.altura.min + Math.random() * (APARIENCIA.altura.max - APARIENCIA.altura.min)) * 100) / 100, pelo: Math.floor(Math.random() * APARIENCIA.pelo.length), colorPelo: Math.floor(Math.random() * APARIENCIA.colorPelo.length) };
  pintarLook(); cambiarSkinPropia();
};
$('lk-guardar').onclick = () => { cerrarLook(true); aviso('Apariencia guardada.', 'ok'); };
$('lk-cancelar').onclick = () => cerrarLook(false);
$('v-look').addEventListener('click', e => { if (e.target.id === 'v-look') cerrarLook(false); });
// ── PROBADOR DE SKINS (pestaña SKINS de la tienda) ──
// Te pones la skin solo en tu pantalla y la cámara da una vuelta a tu duende. Nada va al
// servidor (los demás siguen viendo tu skin real) salvo si pulsas Comprar en la franja.
let prueba = null;
const PRUEBA_GIRO = 6000, PRUEBA_DURA = 10000;
function probarSkin(id) {
  const sk = SKINS[id];
  if (!yo || !sk || yo.muerto || camAntes) return;
  if (prueba) terminarPrueba(false);
  cerrar('v-tienda');
  skinPrueba = id;
  prueba = { id, cam: { camYaw, camPitch, camDist }, yaw0: P.ry, t0: performance.now(), html: '', pintT: 0 };
  camYaw = P.ry; camPitch = 0.14; camDist = 4.8;
  cambiarSkinPropia();
  let el = $('probador3');
  if (!el) {
    el = document.createElement('div'); el.id = 'probador3';
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px) + var(--tg-bot,0px));z-index:9;width:min(520px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;border-radius:14px;background:rgba(14,9,30,.93);border:1px solid #a855f7;color:#f3eaff;font:600 14px system-ui,sans-serif;pointer-events:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,.55)';
    document.body.appendChild(el);
    V.delegarCompra(el);   /* Comprar / Stars / Yape / Equipar: los mismos botones y mensajes que la tarjeta */
    el.addEventListener('click', e => { if (e.target.closest('[data-pr-cerrar]')) { sfx('boton', 0.2); terminarPrueba(true); } });
  }
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><b style="color:${sk.color || '#fff'};flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👀 ${esc(sk.nombre)}</b><span id="probador3-t" style="font-size:12px;opacity:.7"></span><button class="btn sec" data-pr-cerrar>Cerrar</button></div>`
    + `<div id="probador3-c" class="vv-acc" style="flex-direction:row;flex-wrap:wrap;justify-content:flex-end;align-items:center;width:100%;margin-top:8px"></div>`
    + '<div style="font-size:11px;opacity:.65;margin-top:6px">Solo tú la ves mientras la pruebas.</div>';
  el.style.display = 'block';
  pintarPrueba();
}
// Cuenta atrás y precio/botones (se repintan solo si cambian: al comprarla sale «Equipar»).
function pintarPrueba() {
  if (!prueba) return;
  const c = $('probador3-c'), tt = $('probador3-t'), h = V.compraSkin(prueba.id);
  if (c && h !== prueba.html) { prueba.html = h; c.innerHTML = h; }
  if (tt) tt.textContent = Math.max(0, Math.ceil((PRUEBA_DURA - (performance.now() - prueba.t0)) / 1000)) + ' s';
}
// Cada cuadro: vuelta completa de la cámara en 6 s (suave) y luego de frente hasta los 10 s.
function girarPrueba() {
  if (!prueba) return;
  const e = performance.now() - prueba.t0;
  if (e >= PRUEBA_DURA || !yo || yo.muerto) { terminarPrueba(true); return; }
  const k = Math.min(1, e / PRUEBA_GIRO);
  camYaw = prueba.yaw0 + Math.PI * (1 - Math.cos(Math.PI * k)); camPitch = 0.14; camDist = 4.8;
  if (e - prueba.pintT > 250) { prueba.pintT = e; pintarPrueba(); }
}
function terminarPrueba(reabrir) {
  if (!prueba) return;
  const p = prueba; prueba = null; skinPrueba = null;
  ({ camYaw, camPitch, camDist } = p.cam);
  const el = $('probador3'); if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  cambiarSkinPropia();
  // De vuelta a la tienda en la misma skin (no encima de un pago u otra ventana que se abrió).
  if (reabrir && yo && !hayVentana() && !$('v-tienda').classList.contains('on')) V.abrirTienda('skin', p.id);
}
/* Esc cierra la prueba y vuelve a la tienda; se corta aquí para que el Esc general no cierre la tienda recién reabierta */
addEventListener('keydown', e => { if (prueba && e.key === 'Escape' && !chatAbierto()) { e.stopImmediatePropagation(); terminarPrueba(true); } });
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
  TG.onEvent('activated', () => { fuera3 = false; if (sonido) musica.activo(true); if (actx) actx.resume().catch(() => {}); });
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
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, e => { if (e && e.target && e.target.closest && e.target.closest('#b-sin-son')) return; if (sonido) { musica.arrancar(); if (actx && actx.state !== 'running') actx.resume().catch(() => {}); } });   // efectos tambien (iPhone)
// Fuera de la app (otra pestaña, pantalla apagada, Telegram sin 'deactivated')
// la musica y los golpes seguian sonando de fondo.
document.addEventListener('visibilitychange', () => {
  // Al salir (Telegram, otra app) se sueltan joystick y botones: si no, volvia con SUBIR o el joystick pegados.
  if (document.hidden) { musica.activo(false); tema.pause(); temaOn = false; if (actx) actx.suspend().catch(() => {}); tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; for (const k in teclas) teclas[k] = false; atkMantener = false; }
  else { fuera3 = false; if (sonido) { musica.activo(true); if (actx) actx.resume().catch(() => {}); } }
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
$('b-amigos').onclick = () => { if ($('v-amigos').classList.contains('on')) return cerrar('v-amigos'); abrir('v-amigos'); mandar({ t: 'contactos' }); mandar({ t: 'quien' }); mandar({ t: 'amigos' }); $('amigos-c')._h = ''; pintarAmigos3(); };
$('b-chat').onclick = () => { const i = $('chat-in'); i.style.display = 'block'; i.focus(); };
// 😀 Gestos y frases rapidas: hablar sin teclado (movil). Frases fijas: al grupo si
// tienes, si no al general, por el mismo enviarChat. Se cierra al elegir.
const FRASES3 = ['¡Ayuda aquí!', 'Vamos al jefe', 'Gracias, causa', 'Espérame', 'Necesito curación', '¡Bien jugado!'];
(() => {
  const fila = $('gestos3'), bt = $('b-gestos');
  if (!fila || !bt) return;
  fila.innerHTML = '<div class="g3-e">' + Object.entries(GESTOS).map(([id, g]) => `<button type="button" data-g="${id}" title="${g.txt}" aria-label="${g.txt}">${g.e}</button>`).join('') + '<button type="button" data-foto="1" title="Foto bailando para compartir" aria-label="Foto de tu duende bailando para compartir">📸</button></div>'
    + '<div class="g3-f">' + FRASES3.map((f, i) => `<button type="button" data-f="${i}">${f}</button>`).join('') + '</div>';
  const cerrarG = () => { fila.classList.remove('on'); };
  // Debajo del boton y nunca hasta la barra de habilidades/joystick (si no cabe, desliza).
  const colocar = () => {
    const r = bt.getBoundingClientRect(), w = Math.min(330, innerWidth - 16), top = Math.max(8, r.bottom + 6);
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
    else if (b.dataset.foto) fotoBaile();
    else if (b.dataset.f) { const f = FRASES3[b.dataset.f | 0]; if (f) enviarChat((grupo3 && grupo3.m && grupo3.m.length > 1 ? '/g ' : '') + f); }
    cerrarG();
  };
  document.addEventListener('pointerdown', e => { if (fila.classList.contains('on') && !fila.contains(e.target) && !bt.contains(e.target)) cerrarG(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarG(); });
})();
$('b-reconectar').onclick = () => location.reload();   // error() lo cambia segun el caso

// ── MAPA (minimapa y mapa del mundo, pintados una vez) ──
let mapaBase = null;
function pintarMapaBase() {
  const N = 220, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), col = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const wx = (i / N - 0.5) * LADO, wz = (j / N - 0.5) * LADO, h = alturaEn(wx, wz);
    if (h < MUNDO.agua) col.set('#2f74b5'); else colorSuelo(wx, wz, h, col);
    const k = (j * N + i) * 4;
    img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  mapaBase = c;
}
function aMapa(wx, wz, N) { return [(wx / LADO + 0.5) * N, (wz / LADO + 0.5) * N]; }
let ryMini = 0;
// Si un punto del minimapa queda fuera del cuadro, lo recorta al borde en su
// misma direccion (asi se ve hacia donde esta la mision o el compañero).
function alBordeMini(px, pz, S) {
  if (px >= 6 && pz >= 6 && px <= S - 6 && pz <= S - 6) return [px, pz];
  const a = Math.atan2(pz - S / 2, px - S / 2);
  return [S / 2 + Math.cos(a) * (S / 2 - 8), S / 2 + Math.sin(a) * (S / 2 - 8)];
}
function pintarMini() {
  if (!mapaBase) return;
  const cv = $('mini-c'), x = cv.getContext('2d'), S = 150, vista = 240;
  const N = mapaBase.width, [mx, mz] = aMapa(P.x, P.z, N), lado = vista / LADO * N;
  x.clearRect(0, 0, S, S);
  const k = S / vista;
  if (enAbismo(P.x)) {
    x.fillStyle = '#1a1240'; x.fillRect(0, 0, S, S);
    for (const is of ABISMO.islas) { x.fillStyle = is.base === 'luz' ? '#c9b46a' : is.base === 'sombra' ? '#6b2f7e' : is.nucleo ? '#8a7fb0' : '#5b4bb0'; x.beginPath(); x.arc((ABISMO_X0 + is.x - P.x) * k + S / 2, (is.z - P.z) * k + S / 2, is.r * k, 0, 7); x.fill(); }
  } else if (enCueva(P.x)) {
    x.fillStyle = '#0b0814'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#4a3f5c';
    for (const [a, b, c, d] of CUEVA.salas) x.fillRect((CUEVA_X0 + a - P.x) * k * 2.2 + S / 2, (b - P.z) * k * 2.2 + S / 2, (c - a) * k * 2.2, (d - b) * k * 2.2);
  } else x.drawImage(mapaBase, mx - lado / 2, mz - lado / 2, lado, lado, 0, 0, S, S);
  const punto = (wx, wz, color, r) => { const px = (wx - P.x) * k + S / 2, pz = (wz - P.z) * k + S / 2; if (px < 0 || pz < 0 || px > S || pz > S) return; x.fillStyle = color; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill(); };
  if (asedio && asedio.activo && asedio.puerta && enAbismo(P.x)) punto(PUERTA_NUCLEO.x, PUERTA_NUCLEO.z, '#ff3b3b', 4.5);
  if (metaEnc) punto(metaEnc.x, metaEnc.z, '#7dd3fc', 3.5);
  if (enAbismo(P.x) && yo && yo.faccion) for (const q of MAQUINAS) if (q.f === yo.faccion) punto(q.x, q.z, '#fbbf24', 2);
  for (const o of mons.values()) if (!o.muereT) punto(o.x, o.z, o.j ? '#ffd84a' : '#ff4455', o.j ? 3.5 : 2);
  for (const o of otros.values()) punto(o.x, o.z, enGrupo(o.id) ? '#7dd3fc' : '#4ade80', enGrupo(o.id) ? 3.5 : 2.5);
  // Compañeros de grupo fuera de vista: el servidor manda p3 [x, z]; si quedan
  // lejos se pegan al borde del minimapa para saber hacia donde ir.
  if (grupo3 && grupo3.m) for (const g of grupo3.m) if (g.on && Array.isArray(g.p3) && g.id !== miId && !otros.has(g.id) && !enCueva(g.p3[0]) === !enCueva(P.x) && !enAbismo(g.p3[0]) === !enAbismo(P.x)) {
    const [gx, gz] = alBordeMini((g.p3[0] - P.x) * k + S / 2, (g.p3[1] - P.z) * k + S / 2, S);
    x.fillStyle = '#7dd3fc'; x.strokeStyle = '#fff'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(gx, gz, 3.5, 0, 7); x.fill(); x.stroke();
  }
  { const ah = Date.now(); for (const c of COFRES3) if (c.listoEn <= ah && Math.abs(c.x - P.x) < 130 && Math.abs(c.z - P.z) < 130) punto(c.x, c.z, c.tipo === 'legendario' ? '#ffd84a' : c.tipo === 'epico' ? '#c084fc' : '#d6a35c', c.tipo === 'legendario' ? 3.2 : 2.4); }
  if (invasion3 && ZONAS3D[invasion3.zona]) punto(ZONAS3D[invasion3.zona].x, ZONAS3D[invasion3.zona].z, '#ff5a1f', 5);
  else if (invPre3 && ZONAS3D[invPre3.zona]) punto(ZONAS3D[invPre3.zona].x, ZONAS3D[invPre3.zona].z, '#ff9a3c', 4);
  for (const o of mons.values()) if (o.ra && !o.muereT) punto(o.x, o.z, o.ti || '#ffd84a', 4);
  { const ah = performance.now(); for (const n of NODOS) if (Math.abs(n.x - P.x) < 130 && Math.abs(n.z - P.z) < 130 && !(nodoListo.get(n.i) > ah)) punto(n.x, n.z, n.tipo === 'hierba' ? '#c084fc' : '#fbbf24', 1.6); }
  if (metaMision) {
    const [px, pz] = alBordeMini((metaMision.x - P.x) * k + S / 2, (metaMision.z - P.z) * k + S / 2, S);
    x.fillStyle = metaMision.guia ? '#4ade80' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.font = 'bold 14px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.strokeText(metaMision.guia ? '?' : '!', px, pz); x.fillText(metaMision.guia ? '?' : '!', px, pz);
  }
  for (const n of NPCS3D) punto(n.x, n.z, '#7dd3fc', 2);
  if (mundial3 && mundial3.vivo) punto(ARENA3D.x, ARENA3D.z, '#ff6b3d', 5);
  // Cono de vision de la camara (mira hacia -sin/-cos de camYaw).
  x.save(); x.translate(S / 2, S / 2); x.rotate(-camYaw);
  x.fillStyle = 'rgba(255,255,255,.13)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 46, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill(); x.restore();
  // Flecha propia: hacia donde mira el duende (P.ry = atan2(dx, dz); en el
  // mapa x es x y z va hacia abajo, asi que la rotacion es PI - ry).
  ryMini = lerpAng(ryMini, P.ry, 0.5);
  x.save(); x.translate(S / 2, S / 2); x.rotate(Math.PI - ryMini);
  x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(0, -8); x.lineTo(5.5, 6); x.lineTo(0, 3); x.lineTo(-5.5, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function abrirMapa() {
  const cv = $('mapa-c'), x = cv.getContext('2d'), S = cv.width;
  x.imageSmoothingEnabled = true;
  x.drawImage(mapaBase, 0, 0, S, S);
  x.font = '600 12px system-ui'; x.textAlign = 'center';
  // Exploracion: encargos hechos por zona y, con el mirador (hito) descubierto, sus cofres y su hito.
  const encH = encargos || {}, miradores = [];
  let expHechos = 0;
  for (const [id, c] of Object.entries(ZONAS3D)) {
    const [px, pz] = aMapa(c.x, c.z, S), mp = MAPAS[id];
    const enc = ZONAS_ENC.includes(id) ? encargosDe(id, MAPAS, MONSTRUOS) : [];
    let mira = false;
    if (enc.length) { try { mira = localStorage.getItem('dq_mirador_' + id) === '1'; } catch (e) {} mira = mira || encH[id + ':hito'] === true; }
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px - 62, pz - 14, 124, enc.length ? (mira ? 43 : 56) : 30);
    x.fillStyle = '#fff'; x.fillText(mp.nombre, px, pz);
    x.fillStyle = '#ffd84a'; x.fillText('Nv ' + mp.nv[0] + '-' + mp.nv[1], px, pz + 13);
    if (enc.length) {
      const n = enc.filter(e => encH[e.id] === true).length; expHechos += n;
      x.fillStyle = n >= enc.length ? '#4ade80' : '#cbd5e1'; x.fillText(`🧭 ${n}/${enc.length}`, px, pz + 26);
      if (mira) miradores.push(id); else { x.fillStyle = '#93c5fd'; x.fillText('🔭 encuentra su hito', px, pz + 39); }
    }
  }
  if (miradores.length) {
    const ah = Date.now();
    for (const cf of COFRES3) if (miradores.includes(cf.zona)) {
      const [cx, cz] = aMapa(cf.x, cf.z, S), listo = cf.listoEn <= ah;
      x.fillStyle = !listo ? '#6b7280' : cf.tipo === 'legendario' ? '#ffd84a' : cf.tipo === 'epico' ? '#c084fc' : '#d6a35c';
      x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cz, cf.tipo === 'legendario' ? 5 : 4, 0, 7); x.fill(); x.stroke();
    }
    x.font = 'bold 18px system-ui'; x.lineWidth = 3; x.strokeStyle = '#000'; x.fillStyle = '#fde047';
    for (const id of miradores) { const hi = hitoDe(id, ZONAS3D, alturaEn); if (!hi) continue; const [hx, hz] = aMapa(hi.x, hi.z, S); x.strokeText('★', hx, hz + 6); x.fillText('★', hx, hz + 6); }
    x.font = '600 12px system-ui'; x.lineWidth = 1;
  }
  { const tot = ZONAS_ENC.length * 5, pc = Math.round(expHechos / tot * 100), txt = `Mundo explorado: ${pc} %`;
    x.font = 'bold 15px system-ui'; x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(S / 2 - 95, 6, 190, 24);
    x.fillStyle = pc >= 100 ? '#4ade80' : '#ffd84a'; x.fillText(txt, S / 2, 24); x.font = '600 12px system-ui'; }
  for (const cp of campamentos(MAPAS, MONSTRUOS)) if (cp.jefe) { const [px, pz] = aMapa(cp.x, cp.z, S); x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(px, pz, 5, 0, 7); x.fill(); }
  const [ux, uz] = aMapa(0, 0, S); x.fillStyle = '#fff'; x.fillText('Pueblo Duende', ux, uz - 8);
  { const [ax, az] = aMapa(ARENA3D.x, ARENA3D.z, S); x.fillStyle = mundial3 && mundial3.vivo ? '#ff6b3d' : '#c4a484'; x.beginPath(); x.arc(ax, az, 7, 0, 7); x.fill(); x.fillText(ARENA3D.nombre, ax, az - 11); }
  if (metaMision) { const [mx2, mz2] = aMapa(metaMision.x, metaMision.z, S); x.font = 'bold 22px system-ui'; x.fillStyle = metaMision.guia ? '#4ade80' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(metaMision.guia ? '?' : '!', mx2, mz2 + 7); x.fillText(metaMision.guia ? '?' : '!', mx2, mz2 + 7); x.font = '600 12px system-ui'; }
  if (grupo3 && grupo3.m) {
    x.font = '700 12px system-ui'; x.textAlign = 'center'; x.lineJoin = 'round';
    for (const g of grupo3.m) {
      if (!g.on || g.id === miId) continue;
      const o = otros.get(g.id), wx = o ? o.x : Array.isArray(g.p3) ? g.p3[0] : null, wz = o ? o.z : Array.isArray(g.p3) ? g.p3[1] : null;
      if (wx == null || enAbismo(wx) || enCueva(wx)) continue;
      const [gx, gz] = aMapa(wx, wz, S);
      x.fillStyle = '#7dd3fc'; x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.arc(gx, gz, 5, 0, 7); x.fill(); x.stroke();
      const nom = String(g.n || '').slice(0, 16);
      if (nom) { x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(nom, gx, gz - 9); x.fillStyle = '#7dd3fc'; x.fillText(nom, gx, gz - 9); }
    }
    x.font = '600 12px system-ui'; x.lineWidth = 1;
  }
  const [yx, yz] = aMapa(P.x, P.z, S); x.fillStyle = '#4ade80'; x.beginPath(); x.arc(yx, yz, 6, 0, 7); x.fill(); x.strokeStyle = '#000'; x.stroke();
  abrir('v-mapa');
}

// ── ENTRADA ──
function chatAbierto() { return document.activeElement === $('chat-in'); }
// Ventanas laterales (como WoW): no tapan el centro y se puede seguir
// caminando con ellas abiertas. Las demas (mapa, muerte, inicio...) si bloquean.
const LATERALES = ['v-npc', 'v-ayuda', 'v-inv', 'v-libro', 'v-tienda', 'v-logros', 'v-pase', 'v-diario', 'v-herm', 'v-rank', 'v-amigos'];
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
  try { sessionStorage.setItem('dq_recargaVer', String(Date.now())); } catch (e) {}
  location.reload();
}, 5000);
// ── LA LEYENDA DEL CANTARO (lore): una vez al entrar y desde la ayuda ──
function verLeyenda() {
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;   // el cierre automatico del premio diario no cierra la leyenda
  $('diario-c').innerHTML = `<img src="${imgLore()}" alt="Chicha morada junto al mar" style="display:block;width:100%;max-height:170px;object-fit:${modoAnuncio() ? 'contain' : 'cover'};border-radius:10px;margin-bottom:8px">
    <p class="vv-p"><img src="/assets/lore/maiz-morado.png" alt="" style="float:left;width:34px;margin:0 6px 0 0">Hace siglos, los duendes guardaban el <b style="color:#c084fc">Maíz Morado Sagrado</b>. Con él preparaban la <b style="color:#c084fc">chicha morada</b>, la bebida que les daba su fuerza y su magia.</p>
    <p class="vv-p">El <b>Rey Goblin</b> robó el <b style="color:#ffd84a">Cántaro Eterno</b> y lo rompió en pedazos. Sin chicha, la noche cubrió el bosque, los goblins invadieron las colinas y el Éter del cielo se partió en islas flotantes: el <b>Abismo</b>.</p>
    <p class="vv-p"><img src="${modoAnuncio() ? '/assets/skins/skin_bruja.png' : '/assets/lore/duende-chicha.webp'}" alt="" style="float:right;height:96px;margin:0 0 4px 6px">Tú eres un duende joven. <b>Recupera las zonas</b> (misiones y encargos 🧭), <b>vence a sus jefes</b>, abre los cofres y junta <b>puntos de chicha</b> cazando. En el Abismo, la Luz y la Sombra luchan por el <b>Núcleo</b>, donde late el último pedazo del Cántaro.</p>
    <p class="vv-p" style="color:#fde68a;font-weight:700">🥤 Y es de verdad: quien llegue a nivel ${CHICHA.nv60} en este mundo se lleva ${CHICHA.litros60} litros de chicha morada a su casa. Además, con ${(10000).toLocaleString('es')} puntos de chicha cazando (desde nivel ${CHICHA.nvPuntos}), otro litro: toca la barra morada 🥤. Se reclama entrando con Telegram · envíos solo en Perú.</p>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#c084fc;font-weight:700">🏺 Las reliquias del Cántaro: ${Object.keys(LORE_ZONAS).filter(z => encargos[z + ':jefe'] === true).length}/10 recuperadas</summary><p class="vv-p" style="font-size:12px;margin:6px 0">Cada reliquia (un pedazo, su semilla, su barro o un secreto) se recupera venciendo al jefe de su zona en los encargos 🧭. Con las 10, el último pedazo espera en el Núcleo del Abismo: el nivel ${CHICHA.nv60}.</p>${Object.entries(LORE_ZONAS).map(([id, z]) => { const ok = encargos[id + ':jefe'] === true; return `<p class="vv-p" style="margin:6px 0;${ok ? '' : 'opacity:.6'}"><b style="color:${ok ? '#4ade80' : '#fde68a'}">${ok ? '✓' : '·'} ${esc((MAPAS[id] || {}).nombre || id)}:</b> ${ok ? esc(z.pedazo) : 'reliquia perdida… vence al jefe de la zona.'}</p>`; }).join('')}</details>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#f0abfc;font-weight:700">📖 Historias de la gente del bosque: ${SECUNDARIAS.filter(q => secundarias[q.id + ':ok']).length}/${SECUNDARIAS.length}</summary><p class="vv-p" style="font-size:12px;margin:6px 0">Misiones secundarias: salen solas en el panel al llegar a cada zona (con su nivel) y avanzan con lo que haces.</p>${SECUNDARIAS.map(q => { const ok = !!secundarias[q.id + ':ok']; return `<p class="vv-p" style="margin:6px 0;${ok ? '' : 'opacity:.6'}"><b style="color:${ok ? '#4ade80' : '#f0abfc'}">${ok ? '✓' : '·'} ${esc(q.nombre)}</b> <small>(${esc((MAPAS[q.zona] || {}).nombre || q.zona)} · Nv ${q.nv})</small><br>${ok ? esc(q.fin) + ` <button type="button" class="btn sec" data-releer="${esc(q.id)}" style="padding:4px 10px;font-size:12px;margin-top:4px">▶ Releer</button>` : esc(q.quien) + ' te espera.'}</p>`; }).join('')}</details>`;
  $('v-diario').querySelector('h2').textContent = 'LA LEYENDA DEL CÁNTARO';
  $('diario-c').querySelectorAll('[data-releer]').forEach(b => { b.onclick = e => { e.preventDefault(); const q = SECUNDARIAS.find(x => x.id === b.dataset.releer); if (!q) return; cerrar('v-diario'); npcDice(q.quien, [q.inicio, q.fin], q.emoji, true, q.sigue); }; });
  abrir('v-diario');
}
$('b-leyenda').onclick = () => { cerrar('v-ayuda'); verLeyenda(); };
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
// Invitado → /mmo/ a crear cuenta con correo; al terminar vuelve a /mundo/ con su duende.
function irACrearCuenta() {
  aviso('Crea tu cuenta gratis con tu correo: al terminar vuelves aquí con tu duende.', 'ok');
  try { sessionStorage.setItem('dq_volver', '/mundo/'); localStorage.setItem('dq_volver', '/mundo/'); } catch (e) {}
  setTimeout(() => { location.href = '/mmo/' + (hashTg && hashTg.length > 1 ? hashTg + '&cuenta&volver=mundo' : '#cuenta&volver=mundo'); }, 700);
}
// Cupo global de ventanas que se abren solas (leyenda, aviso de invitado): no se apilan.
let ventanaAutoT = 0;
// En cada sesion (no cada reconexion): la historia es lo primero que se ve.
function leyendaPrimeraVez() {
  try { if (sessionStorage.getItem('dq_leyenda')) return; } catch (e) { return; }
  // Movil: la ventana de la leyenda sale solo la primera vez (la barra morada de la chicha queda siempre a la vista).
  try { if (COMPACTO && localStorage.getItem('dq_leyenda_vista')) return; } catch (e) {}
  // Espera a que elija clase y a que vea (y cierre) el premio diario: comparten ventana.
  if (hayVentana() || $('v-diario').classList.contains('on') || loginPend3 || !yo || !yo.clase || !!document.querySelector('#dq-avtg.on') || Date.now() - ventanaAutoT < 60000) { setTimeout(leyendaPrimeraVez, 3000); return; }
  try { sessionStorage.setItem('dq_leyenda', '1'); localStorage.setItem('dq_leyenda_vista', '1'); } catch (e) {}
  ventanaAutoT = Date.now();
  verLeyenda();
}
let avisoInvT = 0;
function avisoInvitado() {
  // Tras entregar la mision 1 (o desde Nv 3) y como mucho una vez al dia.
  if (!soyInvitado || !yo || (yo.nivel < 3 && !(yo.mis && yo.mis.i >= 1)) || hayVentana() || $('v-diario').classList.contains('on')) return;
  // Nunca en combate ni en mal momento (el setInterval lo vuelve a intentar), ni encima del buzon/Telegram.
  // (objetivo solo cuenta si pego hace poco: un monstruo marcado y abandonado no lo bloquea para siempre)
  if (autoAtk || (P && (P.muerto || P.vuela)) || performance.now() - ((P && P.heridoT) || 0) < 8000 || (objetivo && performance.now() - ((P && P.atkT) || 0) < 8000)) return;
  if (document.querySelector('#dq-avtg.on') || Date.now() - ventanaAutoT < 180000) return;
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);   // dia de Lima (UTC-5)
  try { if (localStorage.getItem('dq_aviso_inv') === hoy) return; localStorage.setItem('dq_aviso_inv', hoy); } catch (e) {}
  ventanaAutoT = Date.now();
  $('diario-c').innerHTML = `<button class="btn" id="inv-cuenta" style="width:100%;margin:6px 0 10px">📧 Crear cuenta gratis (guarda tu duende)</button>
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
// Espera (hasta ~1 min) a que no haya ventana abierta; js/pwa.js decide si se puede instalar.
function ofrecerInstalar(n) {
  n = n || 0;
  if (soyInvitado && /iphone|ipad|ipod/i.test(navigator.userAgent)) return;   // iOS: el icono guarda aparte y el invitado perderia su duende
  if (TG || !window.dqPuedeInstalar || !window.dqPuedeInstalar() || ofrecerInstalar.ya || $('franja-inst')) return;
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);   // dia de Lima (UTC-5)
  try { if (localStorage.getItem('dq_inst_ofrecido') === hoy) return; } catch (e) {}
  if (hayVentana() || $('v-diario').classList.contains('on') || $('franja-iab')) { if (n < 12) setTimeout(() => ofrecerInstalar(n + 1), 5000); return; }
  ofrecerInstalar.ya = true;
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
    const fb = encodeURIComponent(location.origin + '/mundo/');
    location.href = 'intent://' + location.host + '/mundo/#r=' + cod + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + fb + ';end';
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
  if (franjaIABvista || !esIAB || !soyInvitado || !yo || !(yo.kills >= 1)) return;
  franjaIABvista = true;
  try { if (Date.now() - (+localStorage.getItem('dq_iab_no') || 0) < 3 * 86400000) return; } catch (e) {}
  const f = document.createElement('div');
  f.id = 'franja-iab';
  f.setAttribute('role', 'status');
  f.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));z-index:8;width:min(94vw,440px);display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(20,12,44,.94);border:1px solid rgba(125,211,252,.5);color:#f2efff;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)';
  f.innerHTML = '<span style="flex:1;min-width:0">¡Primera victoria! Aquí dentro de ' + (appIAB === 'Facebook' ? 'Facebook/Instagram' : appIAB) + ' tu duende se puede borrar. Llévalo a ' + (ANDROID_IAB ? 'Chrome' : 'Safari') + ' y juega más fluido.</span><button type="button" class="btn" style="min-height:40px;padding:7px 10px;font-size:12px;white-space:nowrap">' + (ANDROID_IAB ? 'Abrir en Chrome' : 'Cómo pasarlo') + '</button><button type="button" aria-label="Cerrar" style="flex:none;min-width:40px;min-height:40px;margin:-6px -6px -6px 0;background:none;border:0;color:#b8b0d8;font-size:20px;padding:0;cursor:pointer">×</button>';
  const [ir, x] = f.querySelectorAll('button');
  ir.onclick = () => irANavegador();
  x.onclick = () => { f.remove(); try { localStorage.setItem('dq_iab_no', String(Date.now())); } catch (e) {} };
  document.body.appendChild(f);
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
      if (!crearCofres3.matHaz) crearCofres3.matHaz = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
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
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
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
function botinFuerte(it) {
  if (!it) return;
  const fuerte = it.r >= 2;   // haz, vibracion y presumir solo epico o mas; la tarjeta de mejora para todos
  const rz = RAREZAS[it.r] || {};
  if (fuerte) {
    hazBotin(rz.color || '#c084fc'); SON.tocar('botin', { r: it.r, vol: it.r >= 3 ? 1 : 0.85 });   // mas brillante cuanto mas raro
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
  t.onclick = () => { t.style.display = 'none'; sfx('boton', 0.4); mandar({ t: 'item', a: 'equipar', id: it.id }); aviso('Equipado: ' + (it.nombre || nombreItem(it)), 'ok', 1); };
  t.style.display = 'block'; clearTimeout(botinFuerte.t);
  botinFuerte.t = setTimeout(() => { t.style.display = 'none'; }, fuerte ? 10000 : 6000);
}
// ── INVASION DEL 3D ──
let invasion3 = null;
let invPre3 = null, benditas3 = {};   // invPre3: tambores (invasion en 1:30, eventos3d.js avisarInvasion3d). benditas3: zona -> hasta (+10 % XP tras ganar una invasion)
// ── SUBIR DE NIVEL, PRESUMIR Y TELEGRAM ──
// Lo proximo que se abre (todo con las constantes del juego, sin niveles inventados).
const NV_CLASE_GRATIS = (() => { let n = 1; while (n < 60 && costoCambioClase(n + 1) === 0) n++; return n; })();   // 9: ultimo nivel con cambio de clase gratis
// Tambien la Cueva de los Goblins (Nv 5) y cada zona nueva (desde MAPAS); si dos caen en el mismo nivel, se unen con « · ».
const PROXIMOS = Object.values([[EXPEDICION.nv, '🧭 expediciones de tu mascota'], [NV_CLASE_GRATIS, '⚔ último nivel para cambiar de clase gratis'], [ESPEC_NIVEL, '🌟 especialización y talentos'], [ABISMO.nvMin, '🌌 el Abismo de Éter'], [5, '⛏ la Cueva de los Goblins (portal del pueblo): épico + XP, 3 al día'],
  ...Object.values(MAPAS).filter(m => m && m.zona && !m.instancia && !m.coliseo && !m.torre && Array.isArray(m.nv) && m.nv[0] > 1).map(m => [m.nv[0], '🗺 nueva zona: ' + m.nombre])]
  .reduce((acc, p) => { if (acc[p[0]]) acc[p[0]][1] += ' · ' + p[1]; else acc[p[0]] = [p[0], p[1]]; return acc; }, {})).sort((a, b) => a[0] - b[0]);
function subiNivel(lv) {
  // «Próximo: Nv N → ...» (no en los niveles que ya traen su propio aviso a esa hora).
  const prox = lv < 20 && PROXIMOS.find(p => p[0] > lv);
  if (prox && ![3, NV_CLASE_GRATIS, ESPEC_NIVEL, ABISMO.nvMin].includes(lv)) setTimeout(() => aviso('Próximo: Nv ' + prox[0] + ' → ' + prox[1], undefined, 3), 2500);
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
  if (lv === ABISMO.nvMin && !(yo && yo.faccion)) setTimeout(() => aviso('🌌 ¡Nivel ' + lv + '! Se abrió el Abismo de Éter: ve al portal del pueblo y elige Luz o Sombra. Si una facción tiene menos gente, unirte a ella da premio.', 'ok'), 4000);
  if (lv >= 60) ofrecerPresumir('¡Llegué al nivel 60, el máximo, en Duende Quest 3D! 🏆', 'nv60');
  else if (lv >= 5 && lv % 5 === 0) ofrecerPresumir(`¡Llegué al nivel ${lv} en Duende Quest 3D!`, 'nivel');
  // Talentos y especializacion: se dice al desbloquearlos y en cada nivel con puntos (el libro va dentro de ⋯ en movil).
  const dondeLibro = MOVIL ? '⋯ → 📖' : '📖 (tecla P)';
  // Nv 3 con 'DuendeNNNN': una vez, se le dice que puede ponerle su nombre (gratis) para que sus amigos lo reconozcan.
  if (lv === 3 && yo && /^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '')) setTimeout(() => { let visto = false; try { visto = !!localStorage.getItem('dq_aviso_nombre'); localStorage.setItem('dq_aviso_nombre', '1'); } catch (e) {} if (!visto && yo && /^Duende[0-9a-z]{3,6}$/i.test(yo.nombre || '')) aviso(`✏️ Tus amigos te ven como ${yo.nombre}: ponle tu nombre en ${K('? → Ajustes', 'Más (⋯) → ?')}.`, 'ok'); }, 6000);
  if (lv === 9) setTimeout(() => aviso('⚔ Último nivel para cambiar de clase gratis: desde Nv 10 cuesta oro. Pruébalas en ' + dondeLibro + '.', 'ok'), 2500);
  if (lv === 10) setTimeout(() => aviso('⚠ Desde nivel 10, morir te quita un poco de XP (5 % del nivel). Toma pociones bajo la mitad de vida y no pelees con enemigos 3+ niveles más altos.', 'ok'), 7000);
  if (lv === 10 && soyInvitado) setTimeout(() => aviso('🥤 Desde nivel 10 cada caza suma puntos de chicha morada de verdad, pero solo con cuenta. Crea tu cuenta gratis (tu duende pasa contigo) en ' + K('Ajustes (?)', 'Más (⋯) → ?') + '.', 'ok'), 12000);
  if (lv === 10) setTimeout(() => aviso(`🌟 ¡Nivel 10! Ya puedes elegir tu especialización y repartir puntos de talento en ${dondeLibro}.`, 'ok'), 1500);
  else if (lv > 10) setTimeout(() => aviso(`🌟 +1 punto de talento: úsalo en ${dondeLibro} → Talentos.`, 'ok'), 1500);
  // Nv 3+, una vez por dispositivo: permiso para que el bot te escriba (Bot API 6.9).
  // Si toca, en este nivel no se ofrece la pantalla de inicio (nunca dos ventanas juntas).
  if (pedirEscribirTg(lv)) return;
  // A partir del nivel 5, una vez: acceso directo en la pantalla de inicio (Bot API 8.0).
  if (lv >= 5 && TGV('8.0') && TG.addToHomeScreen) {
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
  let visto = true; try { visto = !!localStorage.getItem('dq_tg_escribir'); } catch (e) {}
  if (visto) return false;
  if (escribirTgT) return true;
  let intentos = 0;
  const intentar = () => {
    escribirTgT = 0;
    let ya = true; try { ya = !!localStorage.getItem('dq_tg_escribir'); } catch (e) {}
    if (ya) return;
    if (enCombate3() || (yo && yo.muerto) || document.hidden) {
      if (++intentos < 8) escribirTgT = setTimeout(intentar, 15000);
      return;
    }
    try {
      localStorage.setItem('dq_tg_escribir', '1');
      TG.requestWriteAccess(ok => { if (ok) mandar({ t: 'tgEscribir' }); });
    } catch (e) {}
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
// Buzon "Mientras no estabas" y la compra entregada (/mmo/js/regalo.js), despues del cofre diario.
const regalo3 = iniciarRegalo({
  mandar,
  ocupado: () => hayVentana() || $('v-diario').classList.contains('on') || !!loginPend3 || !!document.querySelector('#dq-avtg.on') || !!document.querySelector('#tira-diario.on') || !yo || !yo.clase,
  presumir: txt => { presumirTxt = txt; presumirTipo = ''; compartirYa(); },
  fanfarria, vibrar: vib,
  filtro: t => modoAnuncio() && /mTON|\bSOL\b|\$DUENDE|[Ww]allet/.test(t || ''),
});
// «Avísame por Telegram» para jugadores web e invitados (/mmo/js/avisotg.js): despues del cofre y del buzon.
// Nunca en plena pelea, muerto, sin clase, en el primer minuto ni antes de 3 cazas (salvo si el jugador la pidio).
let t0Ses = performance.now(), ganaSes = 0, avisoTgPed3 = false, avisoTgT3 = 0;
const avisoTg3 = iniciarAvisoTg({ mandar, ocupado: () => hayVentana() || $('v-diario').classList.contains('on') || !!loginPend3 || !!document.querySelector('#dq-regalo.on') || !!document.querySelector('#tira-diario.on') || !yo || enCombate3() || !!(yo && yo.muerto) || !yo.clase || (P && (P.muerto || performance.now() - (P.heridoT || 0) < 6000)) || (!avisoTgPed3 && (performance.now() - t0Ses < 60000 || ganaSes < 3)) || (ventanaAutoT !== avisoTgT3 && Date.now() - ventanaAutoT < 30000), aviso: (t, k) => aviso(t, k, 1), tg: TG });
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
  if (['look', 'logro', 'nivel', 'jefe', 'duelo'].includes(presumirTipo)) {
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
  let cx = W / 2;
  try { const v = new THREE.Vector3(P.x, (P.y || 0) + 1, P.z).project(camara); if (v.z < 1 && Math.abs(v.x) <= 1.2) cx = (v.x + 1) / 2 * W; } catch (e) {}
  const sx = Math.max(0, Math.min(W - sw, Math.round(cx - sw / 2))), sy = Math.max(0, Math.round((H - sh) / 2));
  // Con post-proceso (alta) la foto sale igual que la pantalla (resplandor y color); si falla, cuadro directo.
  let hecho = false;
  if (composer) { try { composer.render(0); hecho = true; } catch (e) {} }
  if (!hecho) { render.setRenderTarget(null); render.render(escena, camara); }
  x.drawImage(lienzo, sx, sy, sw, sh, 0, 0, 540, 960);
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
  x.fillStyle = 'rgba(8,10,20,0.62)'; x.fillRect(0, 960 - alto, 540, alto);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  lineas.forEach((l, i) => x.fillText(l, 270, 960 - alto + 50 + i * 40, 510));
  x.font = '22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.fillText('duendequest · gratis en el celular', 270, 960 - 22, 510);
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
// Tope: una oferta cada 3 min (si no, cansa). forzar: la pidio el jugador.
function ofrecerPresumir(txt, tipo, forzar) {
  // El jefe pesa mas que nivel/logro: si esa oferta fue hace < 5 s (subiste al matarlo), el jefe la reemplaza.
  const jefeGana = tipo === 'jefe' && Date.now() - presumirUlt < 5000 && /^(nivel|logro)$/.test(ofrecerPresumir.tipo || '');
  if (!forzar && !jefeGana && Date.now() - presumirUlt < 180000) return;
  if (!forzar && yo && yo.nivel < 4 && !(yo.mis && yo.mis.i >= 1)) return;   // no tapa el tutorial
  presumirUlt = Date.now(); ofrecerPresumir.tipo = tipo || '';
  presumirTxt = txt || ''; if (tipo !== undefined) presumirTipo = tipo || '';
  if (!refAmigo) mandar({ t: 'amigos' });
  const b = $('presumir3'); if (!b) return;
  if (!presumirListo(presumirTipo)) precargarPresumir();
  if (!TG) b.textContent = (navigator.canShare ? '📲 Presúmelo (WhatsApp, Instagram…)' : '📲 Presúmelo por WhatsApp') + ' · ganan los dos +' + oroAmigo() + ' oro';
  else b.textContent = esPremiumTG() && (TG.platform === 'android' || TG.platform === 'ios') ? '📸 Presúmelo en tu historia · +' + oroAmigo() + ' oro' : '📨 Presúmelo a un amigo · ganan los dos +' + oroAmigo() + ' oro';
  b.style.display = 'block'; clearTimeout(ofrecerPresumir.t);
  ofrecerPresumir.t = setTimeout(() => { b.style.display = 'none'; }, 12000);
}
// Enlace de Mini App directo (startapp=r_codigo, lo lee ref3). Apagado hasta que el dueño active la
// Main Mini App del bot en BotFather; mientras, va el start=m3d_ de siempre.
const TG_STARTAPP_OK = false;
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
  try { presentarJefe(o.k); } catch (e) {}
}
// La primera vez que fijas a cada jefe (por personaje): cartel no modal 2,5 s con su nombre,
// su linea de lore y la clave para no morir. No tapa toques (pointer-events:none).
function presentarJefe(k) {
  const dj = MONSTRUOS[k]; if (!dj || !dj.jefe || !yo) return;
  const clave = 'dq3_jefevisto_' + (yo.pid || '') + '_' + k;
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
    d.style.cssText = 'position:fixed;left:50%;top:calc(64px + var(--tg-top,0px));transform:translateX(-50%);z-index:7;max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 14px;border-radius:14px;border:1px solid rgba(255,216,74,.6);background:rgba(12,14,28,.88);color:#fff;font:600 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:auto;transition:opacity .4s';
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
  const linea = lineaPresumir(), pre = linea ? linea + '\n' : '';
  const txt = pre + (presumirTxt ? presumirTxt + ' ' : '') + (refAmigo ? 'Oe, entra con mi link a Duende Quest (gratis en Telegram): recibes oro y pociones de bienvenida, y a nivel 10 ganamos +' + oroAmigo() + ' de oro los dos 👇' : '¡Juega gratis conmigo a Duende Quest 3D en Telegram! 🧝');
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
  const txtWa =pre + (presumirTxt ? presumirTxt + ' ' : '') + TXT_WA.replace('ganamos oro', 'ganamos +' + oroAmigo() + ' de oro');
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
  const abiertas = [...document.querySelectorAll('.modal.on')].map(m => m.id).filter(id => id && !NO_ATRAS.includes(id));
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
function atrasVentana() {
  const id = pilaV[pilaV.length - 1];
  if (!id || !$(id) || !$(id).classList.contains('on')) return false;
  if (id === 'v-pago') { aviso('Cierra el pago con su ✕ (así no se pierden tus datos).', 'err', 1); return true; }
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
  if (TGV('6.2') && TG.enableClosingConfirmation) TG.enableClosingConfirmation();
  TG.BackButton.onClick(() => {
    actualizarPila();
    if (atrasVentana()) return revisarAtrasTg();
    if ([...document.querySelectorAll('.modal.on')].some(m => NO_ATRAS.includes(m.id) && m.id !== 'v-inicio')) return;   // muerte, clase o error: se resuelven en su ventana
    const ah = Date.now();
    if (ah - atrasTgT > 2500) { atrasTgT = ah; const tx = 'Toca Atrás otra vez para salir al menú'; avisoVisto.delete(tx); aviso(tx, 'ok', 1); return; }   // sin el filtro de 8 s: cada primer toque se ve
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
function pintarRankPanel() {
  if (!$('v-rank').classList.contains('on')) return;
  const d = rankDatos, c = $('rank-c');
  const tabs = [['sem', 'Semana'], ['abismo', 'Abismo'], ['r', 'Nivel'], ['duel', 'Duelos'], ['herm', 'Hermandades'], ['torre', 'Torre']];
  let s = '<div class="rank-tabs">' + tabs.map(([k, n]) => `<button data-rt="${k}" class="${k === rankTab ? 'on' : ''}">${n}</button>`).join('') + '</div>';
  if (rankTab === 'abismo') s += htmlTemp(temp3 || (d && d.temp));
  else if (!d) { c.innerHTML = s + '<p class="vv-p">Cargando…</p>'; }
  else {
    const fin = d.finSem ? Math.max(0, d.finSem - Date.now()) : 0, dd = Math.floor(fin / 86400000), hh = Math.floor(fin % 86400000 / 3600000);
    if (rankTab === 'sem' && fin) s += `<p class="vv-p">⏳ La semana cierra en <b style="color:#f87171">${dd} d ${hh} h</b>: el top 3 se lleva el gran premio y, desde ${((d.mio && d.mio.min) || 2000).toLocaleString('es', { useGrouping: 'always' })} XP, todos cobran su liga contra los de su nivel${d.mio && d.mio.tramoTxt ? ` (tú: ${d.mio.tramoTxt})` : ''} (Oro top 10 %, Plata 30 %, Bronce el resto).</p>`;
    const L = d[rankTab] || [];
    const val = x => rankTab === 'sem' ? `${(x.xp || 0).toLocaleString('es')} XP` : rankTab === 'r' ? `Nv ${x.lv}` : rankTab === 'duel' ? `Elo ${x.e}` : rankTab === 'herm' ? `${(x.p || 0).toLocaleString('es')} pts · ${x.m} miembros` : `piso ${x.p}`;
    s += '<div class="rank-lista">' + (L.length ? L.map((x, i) => `<div class="rk ${x.yo ? 'yo' : ''}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(x.n)}</b><span>${val(x)}</span></div>`).join('') : '<p class="vv-p">Aún no hay nadie: ¡sé el primero!</p>') + '</div>';
    if (rankTab === 'sem' && d.mio) s += `<div class="rk yo" style="position:sticky;bottom:0;margin-top:6px;display:block;line-height:1.35;background:rgba(30,24,8,.95);border:1px solid rgba(250,204,21,.55);border-radius:8px;padding:8px 10px">${esc(textoMioSem(d.mio))}</div>`;
    if (rankTab === 'torre' && d.tpos) s += `<p class="vv-p" style="font-size:12px">Tú: <b>#${d.tpos}</b> de ${d.ttot} · piso ${d.tmax || 0}</p>`;
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
// Movil: en vez de la ventana, una tira arriba (~56 px) con las 7 bolitas de la
// semana y lo de mañana; dura 5 s (8 s los dias 6 y 7) y al tocarla abre el panel.
// Espera a que no haya ventanas abiertas (bienvenida, tutorial, clase...).
function tiraDiario(m, n) {
  if (hayVentana() && (n || 0) < 12) { setTimeout(() => tiraDiario(m, (n || 0) + 1), 1500); return; }
  let t = $('tira-diario');
  if (!t) {
    t = document.createElement('div'); t.id = 'tira-diario'; t.setAttribute('role', 'button');
    document.body.appendChild(t);
    t.onclick = () => { const mm = tiraDiario.m; t.classList.remove('on'); clearTimeout(tiraDiario.t); if (mm) mostrarDiario(mm, true); };
  }
  tiraDiario.m = m;
  const dHoy = diaRacha(m.racha), sem = semanaRacha(m.racha);
  let b = '';
  for (let i = 1; i <= 7; i++) b += `<i class="${i < dHoy ? 'ya' : i === dHoy ? 'hoy' : ''}${i === 7 ? ' cofre' : ''}"></i>`;
  const hoyTxt = m.oro ? '+' + m.oro.toLocaleString('es') + ' oro' : m.txt || 'premio';
  t.innerHTML = `<div class="dias7 mini">${b}</div><div class="tx"><b>☀ Día ${dHoy}${sem > 1 ? ' · Semana ' + sem : ''}: ${esc(hoyTxt)}${m.itemNom ? ' · ' + esc(m.itemNom) : ''}</b><small>${m.amuUsado ? '🧿 Tu protector salvó tu racha · ' : ''}${m.pase ? '+' + m.pase + ' al pase del mes · ' : ''}🧿 Protectores: ${m.amu || 0} · ${esc(textoManana3() || '')}${(m.hitos || []).length ? ' · 🏅 ' + esc(m.hitos.join(', ')) : ''}</small>${expVolvio() ? '<small style="color:#4ade80;font-weight:700">🧭 ' + (yo.exped.m ? 'Tu mascota' : 'Tu explorador') + ' volvió de la expedición · toca para recoger</small>' : ''}</div>`;
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
  try { const tp = yo ? temporadaDe() : null; if (tp) h += `<p class="vv-p" id="vv-temp" style="margin-bottom:8px;padding:8px;border-radius:10px;cursor:pointer;color:${tp.color};background:rgba(255,255,255,.06);border:1px solid ${tp.color}">${tp.emoji} <b>${esc(tp.nombre)}</b> hasta el ${esc(tp.hasta)} · ${esc(textoTemp3(tp).txt)}<br><small style="color:#e8e8f0">Toca aquí para ver el puesto de la Abuela ›</small></p>`; } catch (e) {}
  h += m.amuUsado ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(125,211,252,.12);border:1px solid rgba(125,211,252,.45)">🧿 <b>Tu protector salvó tu racha</b>: faltaste un día y no la perdiste.</p>` : '';
  h += m.vuelta ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(255,216,74,.12);border:1px solid rgba(255,216,74,.4)">🎉 <b>¡Te echábamos de menos!</b> ${m.vuelta.dias} días fuera. Regalo de bienvenida: <b>+${m.vuelta.oro.toLocaleString('es')} oro</b>, ${m.vuelta.pociones} pociones y <b>${esc(m.vuelta.item)}</b>.</p>` : '';
  h += `<p class="vv-p" style="margin-bottom:8px">¡Día <b style="color:#ffd84a">${m.racha}</b> de tu racha${sem > 1 ? ` (semana ${sem}, oro x${String(multSemanaRacha(m.racha)).replace('.', ',')})` : ''}! Recibes <b>${m.oro && /oro/.test(m.txt || '') ? m.oro.toLocaleString('es') + ' oro' : esc(m.txt || '')}</b>${m.oro && !/oro/.test(m.txt || '') ? ` (+${m.oro.toLocaleString('es')} oro)` : ''}${m.itemNom ? `: <b>${esc(m.itemNom)}</b>` : ''}.</p><div class="dias7">`;
  for (let i = 1; i <= n; i++) {
    const pr = LOGIN_PREMIOS[i - 1];
    h += `<div class="d7 ${i < hoy ? 'ya' : i === hoy ? 'hoy' : ''}"><small>Día ${i}</small><span>${i === n ? '🎁' : pr.item !== undefined ? '⚔️' : pr.oro ? '🪙' : '🧪'}</span><em>${esc(pr.txt)}</em></div>`;
  }
  h += '</div>' + (m.hitos || []).map(x => `<p class="vv-p" style="margin-top:8px;color:#ffd84a">🏅 <b>¡Hito de racha!</b> Ganaste ${esc(x)}.</p>`).join('');
  h += `<p class="vv-p" style="margin-top:10px;font-size:12px"><b style="color:#7dd3fc">${esc(textoManana3() || 'Mañana: ' + premioRacha(m.racha + 1).txt)}</b>. Si faltas un día, un protector 🧿 la salva; sin protector retrocede (desde el día 7 no pierdes las semanas cumplidas).${m.pase ? ` Entrar sumó <b>+${m.pase}</b> al pase del mes.` : ''}</p><p class="vv-p" style="margin-top:6px;font-size:12px">🧿 Protectores: <b>${m.amu || 0}</b> (se ganan con el bono semanal, máximo 2)</p>`;
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
addEventListener('keydown', e => {
  if (chatAbierto()) {
    if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) enviarChat(v); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    return;
  }
  if (hayVentana()) {
    if (e.key === 'Escape' && $('v-look').classList.contains('on')) return cerrarLook(false);
    if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(m => { if (!['v-clase', 'v-muerte', 'v-inicio', 'v-error', 'v-pago'].includes(m.id)) cerrar(m.id); });   // la de pago solo con su ✕ (no se pierden los datos)
    if (e.code === 'KeyM' && $('v-mapa').classList.contains('on')) cerrar('v-mapa');
    for (const [k, id] of [['KeyI', 'v-inv'], ['KeyP', 'v-libro'], ['KeyL', 'v-logros']]) if (e.code === k && $(id) && $(id).classList.contains('on')) cerrar(id);
    return;
  }
  if (hayLateral()) {
    // Con un panel lateral abierto se sigue jugando; Escape o su tecla lo cierran.
    if (e.key === 'Escape') { LATERALES.forEach(id => { if ($(id) && $(id).classList.contains('on')) cerrar(id); }); return; }
    let cerro = false;
    for (const [k, id] of [['KeyI', 'v-inv'], ['KeyP', 'v-libro'], ['KeyL', 'v-logros']]) if (e.code === k && $(id) && $(id).classList.contains('on')) { cerrar(id); cerro = true; }
    if (cerro) return;
  }
  teclas[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) saltar(); }
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) cicloObjetivo(); }
  if ((e.code === 'Digit1' || e.code === 'KeyZ') && !e.repeat) { atkMantener = true; golpeManual(); }
  const nh = /^Digit([2-9])$/.exec(e.code);
  if (nh && !e.repeat) usarHab(misHabs[+nh[1] - 2]);
  if ((e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && !P.vuela && !P.planea) esquivar();   // Q ya es habilidad; Mayus solo baja volando/planeando
  if (e.code === 'KeyY' && !e.repeat) montar();
  if (e.code === 'KeyV' && !e.repeat) volar();
  const i = { KeyQ: 0, KeyF: 1, KeyG: 2, KeyT: 3 }[e.code];
  if (i !== undefined && !e.repeat) usarPoder(i);
  if (e.code === 'KeyE' && !e.repeat) hablar();
  if (e.code === 'KeyM' && !e.repeat) abrirMapa();
  if (e.code === 'KeyI' && !e.repeat) V.abrirInventario();
  if (e.code === 'KeyP' && !e.repeat) V.abrirLibro();
  if (e.code === 'KeyL' && !e.repeat) V.abrirLogros();
  if (e.code === 'Enter') { e.preventDefault(); $('chat-in').style.display = 'block'; $('chat-in').focus(); }
  if (e.code === 'Escape') { objetivo = 0; objetivoP = 0; autoAtk = false; pintarBarra(); pintarGrupo(); }
});
addEventListener('blur', () => { atkMantener = false; });
addEventListener('keyup', e => { teclas[e.code] = false; if (e.code === 'Digit1' || e.code === 'KeyZ') atkMantener = false; if (e.code === 'Space' && !P.vuela && P.vy > 0) P.vy *= 0.55; });   // salto corto si sueltas pronto
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
    objetivo = o.id; pintarBarra(); sfx('boton', 0.2);
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
  for (const n of npcs) { const s = aPantalla(n.x, n.y + 1.2, n.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < 40 && Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST + 2) { abrirNpc(n.tipo); return; } }
  // Tocar el puesto de la Abuela (fiestas): su tienda.
  const pu = decoTp.puesto; if (pu) { const s = aPantalla(pu.x, pu.y + 0.8, pu.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < 50 && Math.hypot(P.x - pu.x, P.z - pu.z) < 8) { V.abrirTiendaTemp(); return; } }
}
function cicloObjetivo() {
  const l = [...mons.values()].filter(o => !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 45).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (!l.length) { objetivo = 0; if (performance.now() - (cicloObjetivo.av || 0) > 3000) { cicloObjetivo.av = performance.now(); aviso('No hay monstruos cerca: sigue la luz amarilla o mira el mapa ' + K('🗺 (M)', '⋯ → 🗺'), 'err'); } return; }
  const i = l.findIndex(o => o.id === objetivo);
  objetivo = l[(i + 1) % l.length].id;
  try { marcaJefeIni(); } catch (e) {}
  sfx('boton', 0.2); vibSel();
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
// recarga 1,2 s. Solo mueve: el servidor decide la esquiva del golpe rojo ('mpre') por distancia.
const ESQ_MS = 180, ESQ_M = 3, ESQ_CD = 1200;
let esqT0 = 0, esqDx = 0, esqDz = 0, esqHasta = 0, esqBtn = null, esqQ = -1, esqTuto = false;
let esqEnv = false;   // ya se mando la posicion temprana de esta esquiva (a los 45 ms)
try { esqTuto = localStorage.getItem('dq3_esqTuto') === '1'; } catch (e) {}
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
      if (avisoTiroN < 3 && ahora - avisoTiroT > 6000) { avisoTiroN++; avisoTiroT = ahora; aviso('🎯 Acércate un poco más: cuando el anillo bajo el monstruo se pone verde, tu golpe le llega.', 'ok'); }
    }
    // Sin monstruos a la vista (tambien con joystick): decirle adonde ir, como mucho cada 8 s
    if (!c && !enCueva(P.x) && !enAbismo(P.x) && !monCerca(25) && ahora - (golpeManual.avL || 0) > 8000) {
      golpeManual.avL = ahora;
      aviso(zonaEn(P.x, P.z) === 'pueblo' ? '🏘 En el pueblo no hay monstruos: sal y sigue la luz amarilla.' : 'No hay monstruos cerca: sigue la luz amarilla o mira el mapa ' + K('🗺 (M)', '⋯ → 🗺') + '.', 'ok');
    }
    sfxK('desenv', 0.22); efectoGolpe(vara, true); return;
  }
  if (o !== rv && objetivo !== o.id) { objetivo = o.id; pintarBarra(); }
  mandarPos(true);
  mandar(o === rv ? { t: 'atk3', tp: o.id } : { t: 'atk3', tg: o.id });
  if (!golpe1Ok) { golpe1Ok = true; paso('golpe1'); }
  atkReintento = 0; atkRepN = 0;
  if (o !== rv) impactos.push({ o, t: ahora + (vara ? 280 : 150) });
  const dx = o.x - P.x, dz = o.z - P.z; P.ry = Math.atan2(dx, dz);
  P.f = dx * der.x + dz * der.z >= 0 ? 1 : -1;
  sfx(vara ? 'boton' : 'corte', 0.3);
  tuto3.atk = true;
  efectoGolpe(vara, false);
}
// Arco del tajo (v344, solo visual): media luna translucida delante del duende con el color de la clase,
// que barre y se desvanece en ~200 ms. Las varas al aire sueltan ademas un destello que vuela adelante.
const GEO_TAJO = new THREE.RingGeometry(0.7, 1.2, CAL === 'baja' ? 10 : 22, 1, -Math.PI / 2 - 1.2, 2.4);
const tajos = [];
function efectoGolpe(vara, alAire) {
  if (!P || !yo) return;
  const cl = CLASES[yo.clase], color = (cl && cl.color) || '#fff1c1', baja = POBRE || CAL === 'baja';
  const cmb = P.combo || 0, fuerte = cmb === 2, alto = P.fig && P.fig.alto ? P.fig.alto : 1.6;
  while (tajos.length >= (baja ? 2 : 5)) { const v = tajos.shift(); escena.remove(v.g); if (v.mat) v.mat.dispose(); }
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const g = new THREE.Group(), inc = new THREE.Group(), me = new THREE.Mesh(GEO_TAJO, mat);
  me.rotation.x = -Math.PI / 2; inc.add(me); g.add(inc);
  // 0: tajo en diagonal, 1: tajo de vuelta casi plano (barre al reves), 2: golpe fuerte vertical y mas grande.
  inc.rotation.z = cmb === 0 ? 0.55 : cmb === 1 ? -0.15 : Math.PI / 2;
  const esc = (fuerte ? 1.3 : 1) * (vara ? 0.85 : 1) * clamp(alto / 1.6, 0.8, 1.5);
  g.position.set(P.x, P.y + alto * (fuerte ? 0.6 : 0.5), P.z); g.scale.setScalar(esc);
  escena.add(g);
  tajos.push({ g, mat, t0: performance.now(), dur: fuerte ? 260 : 200, ry: P.ry, giro: cmb === 1 ? -1 : 1, fuerte });
  const fx = Math.sin(P.ry), fz = Math.cos(P.ry);
  if (fuerte && !baja) FX.emitir(P.x + fx * 1.1, P.y + alto * 0.55, P.z + fz * 1.1, { n: MOVIL ? 6 : 10, color, vel: 3, vida: 0.3 });
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
function volar(on) {
  if (on === undefined) on = !P.vuela;
  if (on) {
    if (P.muerto || !yo) return;
    if (yo.montado) return aviso('Bájate de la montura para volar.', 'err');
    if (zonaEn(P.x, P.z) === 'pueblo') return aviso(!(yo && yo.kills > 0) ? '⚔️ Primero caza: sal por el camino hacia la luz amarilla y pega con ' + K('1', 'ATACAR') + '.' : '🪽 En el pueblo no se vuela: sal por el camino hacia la luz amarilla y toca ' + K('V', 'VOLAR') + '.', 'ok', 1);
    if (enCueva(P.x)) return aviso('En la cueva no hay sitio para volar.', 'err');
    if (P.alas < 3) return aviso('Tus alas necesitan descansar.', 'err');
    P.vuela = true; P.vy = 0; if (P.suelo) P.y += 1.5; P.suelo = false;
    sfx('salto', 0.2); sfxK('tela', 0.3); SON.tocar('alas', { vol: 0.8 });
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
  return npcs.find(n => Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST) || (portal && Math.hypot(P.x - portal.x, P.z - portal.z) < 5 ? { tipo: 'portal', nombre: 'Mazmorras' } : null)
    || (decoTp.puesto && Math.hypot(P.x - decoTp.puesto.x, P.z - decoTp.puesto.z) < 3.5 ? { tipo: 'tiendaTemp', nombre: 'la Abuela' } : null);
}
function hablar() {
  if (pica > performance.now()) { mandar({ t: 'tirar' }); return; }
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
  if (n.tipo === 'tiendaTemp') { V.abrirTiendaTemp(); return; }
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
const joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
const camTouch = { id: null, x: 0, y: 0, mov: 0 };
if (MOVIL) {
  const base = $('joy').querySelector('.base'), pomo = base.firstElementChild;
  // Pista hasta el primer uso: la base del joystick no se ve hasta tocar.
  let pistaJoy = null;
  try { if (!localStorage.getItem('dq_joy_ok')) { pistaJoy = document.createElement('div'); pistaJoy.className = 'pista-joy'; pistaJoy.innerHTML = '<i></i><span>Desliza aquí<br>para moverte</span>'; $('joy').appendChild(pistaJoy); } } catch (e) {}
  $('joy').addEventListener('touchstart', e => {
    if (pistaJoy) { pistaJoy.remove(); pistaJoy = null; try { localStorage.setItem('dq_joy_ok', '1'); } catch (er) {} }
    const t = e.changedTouches[0]; joy.id = t.identifier; joy.x = t.clientX; joy.y = t.clientY; joy.dx = joy.dy = 0;
    joy.x0 = t.clientX; joy.y0 = t.clientY; joy.t0 = performance.now(); joy.lejos = 0;   // para distinguir un toque corto (elegir) de mover
    const r = $('joy').getBoundingClientRect();   // la base se dibuja bajo el dedo aunque #joy no empiece en (0,0)
    base.style.display = 'block'; base.style.left = (t.clientX - r.left - 60) + 'px'; base.style.top = (t.clientY - r.top - 60) + 'px';
    e.preventDefault();
  }, { passive: false });
  $('joy').addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      let dx = t.clientX - joy.x, dy = t.clientY - joy.y; const d = Math.hypot(dx, dy);
      joy.lejos = Math.max(joy.lejos || 0, Math.hypot(t.clientX - joy.x0, t.clientY - joy.y0));
      if (d > 50) {   // joystick flotante: la base sigue al dedo (girar en redondo sin quedarse atascado al borde)
        const k = (d - 50) / d; joy.x += dx * k; joy.y += dy * k; dx -= dx * k; dy -= dy * k;
        const r = $('joy').getBoundingClientRect();
        base.style.left = (joy.x - r.left - 60) + 'px'; base.style.top = (joy.y - r.top - 60) + 'px';
      }
      joy.dx = dx / 50; joy.dy = dy / 50;
      pomo.style.left = (33 + dx) + 'px'; pomo.style.top = (33 + dy) + 'px';
    }
    e.preventDefault();
  }, { passive: false });
  const finJoy = e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      joy.id = null; joy.dx = joy.dy = 0; base.style.display = 'none'; pomo.style.left = pomo.style.top = '33px';
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
      camYaw -= dx * 0.008; camPitch = clamp(camPitch + dy * 0.005, 0.08, 1.25);
    }
  }, { passive: true });
  const finToque = e => {
    for (const t of e.changedTouches) { toques.delete(t.identifier); if (t.identifier === camTouch.id) { if (camTouch.mov < 10 && e.type === 'touchend') { const om = elegirEn(t.clientX, t.clientY, false); if (om && !om.muereT && mons.has(om.id) && Math.hypot(om.x - P.x, om.z - P.z) <= rangoAtaque(om)) { vib('light'); golpeManual(); } } camTouch.id = null; } }
    if (toques.size < 2) pinch = null;
  };
  lienzo.addEventListener('touchend', finToque, { passive: true }); lienzo.addEventListener('touchcancel', finToque, { passive: true });
  // Dos toques seguidos (como en otros juegos de movil) no apagan el ataque que el primero encendio.
  let atkTapT = 0;
  $('t-atk').addEventListener('touchstart', e => { e.preventDefault(); vib('light'); atkTapT = performance.now(); atkMantener = true; golpeManual(); }, { passive: false });
  for (const ev of ['touchend', 'touchcancel']) $('t-atk').addEventListener(ev, () => { atkMantener = false; }, { passive: true });
  if ($('t-esq')) $('t-esq').addEventListener('touchstart', e => { e.preventDefault(); esquivar(); }, { passive: false });
  // Con el teclado cerrado (Atras de Android) el chat seguia con el foco y congelaba el joystick y los botones.
  const soltarChat = () => { const i = $('chat-in'); if (document.activeElement === i) { i.blur(); if (!i.value.trim()) i.style.display = 'none'; } };
  $('tactil').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
  $('joy').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
  // Mantener SALTO: sube volando y planea al caer (como Espacio).
  $('t-salto').addEventListener('touchstart', e => { e.preventDefault(); vib('light'); tocandoSubir = true; if (!P.vuela) saltar(); }, { passive: false });
  $('t-salto').addEventListener('touchend', () => { tocandoSubir = false; });
  $('t-salto').addEventListener('touchcancel', () => { tocandoSubir = false; });
  $('t-bajar').addEventListener('touchcancel', () => { tocandoBajar = false; });
  $('t-bajar').addEventListener('touchstart', e => { e.preventDefault(); tocandoBajar = true; }, { passive: false });
  $('t-bajar').addEventListener('touchend', () => { tocandoBajar = false; });
  // En el aire, VOLAR (que pasa a decir PLANEAR) pliega las alas y planea: antes caia en picado.
  $('t-volar').addEventListener('touchstart', e => { e.preventDefault(); vib('light'); if (P.vuela) { volar(false); P.planeoAuto = true; } else volar(); }, { passive: false });
  $('t-usar').addEventListener('touchstart', e => { e.preventDefault(); hablar(); }, { passive: false });
  $('t-montar').addEventListener('touchstart', e => { e.preventDefault(); montar(); }, { passive: false });
  $('t-obj').addEventListener('touchstart', e => { e.preventDefault(); vib('light'); cicloObjetivo(); }, { passive: false });
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
  const sinControl = P.muerto || hayVentana() || chatAbierto() || aturdido;
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
    if (MOVIL && quiere && camTouch.id === null && !lanzando && !camAntes) {
      const det = P.ry + Math.PI, dif = Math.abs(Math.atan2(Math.sin(det - camYaw), Math.cos(det - camYaw)));
      if (dif < 2) camYaw = lerpAng(camYaw, det, 1 - Math.exp(-1.1 * dt));
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
    if (P.y <= suelo + 0.05) { P.y = suelo; volar(false); P.suelo = true; }
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
    const mo = esYo ? (yo && yo.montado) || '' : q.mo || '';
    f.montar(P.vuela && esYo ? '' : mo);
    f.andaMontura = anda;
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
    f.poner(q.x, y, q.z, esYo ? P.ry : q.ry, t);
    if (!esYo) {
      const vuela = q.a === 3 || q.a === 4;
      const tipoAla = q.al || 'aprendiz';
      if (q.alas && q.alas.userData.id !== tipoAla) { quitarAlas(q.alas); q.alas = null; }
      if (vuela && !q.alas) q.alas = nuevasAlas(tipoAla);
      if (q.alas) { q.alas.visible = vuela && f.raiz.visible; if (q.alas.visible) ponerAlas(q.alas, q.x, y, q.z, q.ry, t); }
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
  if (f.tipo === 'modelo') {
    const mueve = o.st === 1 || Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05;
    let e = o.muereT ? 'muere' : o.st === 2 ? 'ataca' : t - o.golpeT < 220 ? 'herido' : mueve ? (o.st === 1 ? 'corre' : 'anda') : 'quieto';
    if (MONSTRUOS[o.k].vuela && !o.muereT && e !== 'ataca') e = 'vuela';
    f.estado(e, t);
    if (o.golpeT !== f.golpeVisto) { f.golpeVisto = o.golpeT; if (t - o.golpeT < 300) f.modelo.golpe(); }
    const def = MONSTRUOS[o.k];
    const y = Math.max(alturaEn(o.x, o.z), def.vuela ? alturaEn(o.x, o.z) + 1.2 : aguaEn(o.x) - 0.9);
    o.ryV = lerpAng(o.ryV === undefined ? o.ry : o.ryV, o.ry, 0.2);
    f.pausa = pausaMon === o.id && t < pausaAnim;
    f.poner(o.x, y, o.z, o.ryV, t, Math.min(1, (t - o.nace) / 400));
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
function etiquetas(t) {
  const ponLbl = (lbl, x, y, z, html, maxD, extra) => {
    const d = Math.hypot(x - P.x, z - P.z);
    const s = d < maxD ? aPantalla(x, y, z) : null;
    if (!s) { if (lbl.style.display !== 'none') lbl.style.display = 'none'; return; }
    if (lbl.style.display === 'none') lbl.style.display = '';
    if (lbl._h !== html) { lbl.innerHTML = html; lbl._h = html; }
    lbl.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-100%)`;
    if (extra) extra(lbl);
  };
  if (yo && P.lbl) ponLbl(P.lbl, P.x, P.y + 2.15 + (P.fig && P.fig.montura ? 1.2 : 0), P.z, `<span style="color:${yo.dios ? '#ffd84a' : (yo.tinte && colorTinte3(yo.tinte)) || '#ffe600'}">${yo.dios ? 'GM ' : ''}${esc(yo.nombre)}</span>${yo.titulo && LOGROS.find(l => l.id === yo.titulo) ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(LOGROS.find(l => l.id === yo.titulo).titulo)}»</small>` : ''}${hermInfo ? `<small style="display:block;color:${HERM_COLORES[hermInfo.color] || '#4ade80'};font-size:10px">&lt;${esc(hermInfo.nombre)}&gt;</small>` : ''}`, 999);
  for (const o of otros.values()) {
    const cl = CLASES[o.cl];
    ponLbl(o.lbl, o.x, (o.y || alturaEn(o.x, o.z)) + 2.15 + (o.fig && o.fig.montura ? 1.2 : 0), o.z, `<span style="color:${o.gm ? '#ffd84a' : o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? '#ff4d4d' : (o.tn && colorTinte3(o.tn)) || (cl ? cl.color : '#fff')}">${o.gm === 2 ? 'DUEÑO ' : o.gm ? 'MOD ' : ''}${o.fc && enAbismo(o.x) ? (o.fc === 'luz' ? '☀ ' : '🌑 ') : ''}${o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? '⚔ ' : ''}${esc(o.n)} · Nv${o.lv}</span>${o.ti ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(o.ti)}»</small>` : ''}${o.hn ? `<small style="display:block;color:${HERM_COLORES[o.hc] || '#4ade80'};font-size:10px">&lt;${esc(o.hn)}&gt;</small>` : ''}${o.ra && enAbismo(o.x) ? `<small style="display:block;color:#c4b5fd;font-size:10px">${RANGOS[o.ra].n}</small>` : ''}<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})${o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? ";background:#ff3344" : ""}"></i></span>`, 70);
  }
  const kMis = tipoMision();
  // '❗' solo en el monstruo de mision vivo mas cercano; etiquetas de cerca a lejos (el objetivo primero) y sin encimarse.
  let misId = null, misD = 1e9;
  for (const o of mons.values()) if (o.k === kMis && !o.muereT) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < misD) { misD = d; misId = o.id; } }
  const dMon = o => (o.id === objetivo ? -2 : o.id === misId ? -1 : Math.hypot(o.x - P.x, o.z - P.z));
  const lista = [...mons.values()].sort((a, b) => dMon(a) - dMon(b));
  const usados = [];
  for (const o of lista) {
    if (o.muereT) { if (o.lbl && o.lbl.style.display !== 'none') o.lbl.style.display = 'none'; continue; }
    const def = MONSTRUOS[o.k], el = o.id === objetivo, mis = o.id === misId;
    const alto = o.fig ? altoFig(o.fig) : 2;
    const herido = o.hp < o.mx || el;
    ponLbl(o.lbl, o.x, alturaEn(o.x, o.z) + alto + 0.2, o.z, `${o.cast && o.cast.fin > t ? `<b style="display:block;color:#fb923c;font-size:12px">🥤 ${esc(o.cast.n)}…</b>` : ''}<span style="color:${o.ra ? o.ti || '#ffd84a' : o.iv ? '#ff5a1f' : o.j ? '#ff6bf0' : colorNivel(o.nv)}">${mis ? '<b style="color:#ffd84a;font-size:15px">❗</b>' : ''}${o.ra ? '★ ' + esc(o.ra) + ' · ' : o.iv ? '⚔ ' : o.j ? '★ ' : ''}${asedio && asedio.dormido && o.id === asedio.guardian ? '💤 ' : ''}${herido || o.j || mis ? esc(def.nombre) + ' ' : ''}${marcaNivel(o.nv)}Nv${o.nv}</span>${herido ? `<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>` : ''}`, el ? 90 : (o.j || mis ? 70 : 38));
    if (o.lbl.style.display !== 'none') {
      const s = aPantalla(o.x, alturaEn(o.x, o.z) + alto + 0.2, o.z);
      if (s) {
        if (!el && !mis && usados.some(u => Math.abs(u[0] - s[0]) < 70 && Math.abs(u[1] - s[1]) < 18)) o.lbl.style.display = 'none';
        else usados.push(s);
      }
    }
  }
  for (const av of aventureros) ponLbl(av.lbl, av.x, alturaEn(av.x, av.z) + 2.15, av.z, `${av.diceT > t ? `<span style="display:block;background:rgba(255,255,255,.92);color:#222;border-radius:8px;padding:2px 7px;margin:0 auto 2px;font-weight:600;white-space:normal;width:max-content;max-width:170px">${esc(av.dice)}</span>` : ''}<span style="color:#93c5fd">${esc(Math.hypot(av.x - P.x, av.z - P.z) < 10 ? av.n : av.n.split(' ')[0])}</span> <small style="color:#bbb;font-size:9px">PNJ</small>`, 24);
  if (decoTp.lbl) { if (decoTp.puesto) ponLbl(decoTp.lbl, decoTp.puesto.x, decoTp.puesto.y + 1.6, decoTp.puesto.z, '<span style="color:#4ade80">Abuela · Tienda de la fiesta</span>', 40); else decoTp.lbl.style.display = 'none'; }
  for (const n of npcs) ponLbl(n.lbl, n.x, n.y + 2.4, n.z, `${n.tipo === 'guia' && misionLista() ? '<b style="color:#ffd84a;font-size:22px;text-shadow:0 0 6px #000">?</b><br>' : ''}<span style="color:#4ade80">${esc(n.nombre)}</span>${ROL_NPC[n.tipo] ? `<br><small style="color:#fde68a;font-size:11px">${ROL_NPC[n.tipo]}</small>` : ''}`, 60);
}
// ── TEMA DEL PUEBLO ──
// En el Pueblo Duende suena el tema del juego (audio/tema_duende.mp3, la musica
// del dueño); fuera, la musica generada de cada zona (musica.js). Se pide la
// primera vez que hace falta (1 MB) y reintenta tras el primer toque si el
// navegador bloquea el audio.
const tema = new Audio(); tema.loop = true; tema.volume = 0.3; tema.preload = 'none';
let temaOn = false;
// El MP3 (1 MB) solo con red 4G y sin ahorro de datos; si no, suena la musica generada (gratis).
// Sin navigator.connection (iPhone, Firefox) se baja como siempre.
function redTema() { try { const c = navigator.connection; return !c || (!c.saveData && (!c.effectiveType || c.effectiveType === '4g')); } catch (e) { return true; } }
function temaPueblo(z) {
  // En las fiestas (T'anta Wawa, Cosecha) el pueblo suena con la fiesta andina generada (musica.evento), no con el MP3.
  let fiesta = false; try { fiesta = /^(tanta|cosecha)/.test((temporadaDe() || {}).id || ''); } catch (e) {}
  const quiere = sonido && !fiesta && !document.hidden && !fuera3 && z === 'pueblo' && !enCueva(P.x) && !enAbismo(P.x) && (temaOn || !!tema.src || redTema());
  if (quiere === temaOn) return;
  temaOn = quiere;
  if (quiere) {
    if (!tema.src) tema.src = '/audio/tema_duende.mp3';
    const p = tema.play(); if (p && p.catch) p.catch(() => { temaOn = false; });
    musica.activo(false);
  } else {
    tema.pause();
    if (sonido && !document.hidden && !fuera3) musica.activo(true);
  }
}
// ── CORRIENTES DE VIENTO DEL ABISMO ──
// Columnas de aire celeste entre islas (mmo/js/abismo3d.js CORRIENTES): el servidor
// recarga las alas al cruzarlas volando o planeando y avisa con 'corriente'.
const corrientes3 = [];
function crearCorrientes() {
  const geoC = new THREE.CylinderGeometry(7, 7, 70, 20, 1, true), geoA = new THREE.TorusGeometry(7.5, 0.35, 6, 32);
  for (const c of CORRIENTES) {
    const col = new THREE.Mesh(geoC, new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
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
// ── EVENTO DE TEMPORADA (data TEMPORADAS) ──
// Pildora bajo el marco: «🍞 34/50 · 3 d» (lo juntado, la meta del siguiente
// titulo y lo que queda). Va tambien en movil; al tocarla explica el evento.
function textoTemp3(tp) {
  const n = (yo && yo[tp.campo]) || 0, meta = n < 50 ? 50 : n < 200 ? 200 : 0;
  const ms = tp.fin - Date.now(), queda = ms >= 86400000 ? Math.floor(ms / 86400000) + ' d' : Math.max(1, Math.ceil(ms / 3600000)) + ' h';
  return { n, meta, txt: tp.emoji + ' ' + n.toLocaleString('es') + (meta ? '/' + meta : ' ✓') + ' · ' + queda };
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
  const ley = LORE_TEMPORADA_LEYENDA[tp.campo];   // y una frase de su leyenda, al azar
  if (ley && ley.length) setTimeout(() => aviso('📜 ' + ley[Math.floor(Math.random() * ley.length)], 'ok', 3), 4000);
  const tgG = window.dqTempG && window.dqTempG.fin === tp.fin ? window.dqTempG : null;
  if (tgG) setTimeout(() => aviso('🤝 Entre todos: ' + tgG.n.toLocaleString('es-PE') + ' / ' + tgG.meta.toLocaleString('es-PE') + ' ' + tp.cosas + (tgG.n >= tgG.meta ? '. ¡Cumplimos todas las metas! Cada una dio 1 h de Hora Feliz para todos' : '. Cada meta da 1 h de Hora Feliz para todos') + (tgG.feliz > Date.now() ? ' (¡ahora mismo hay una!)' : '') + '.', 'ok', 2), 2500);
  const despues =prox && tp.fin - Date.now() < 2 * 86400000 ? ' Después: ' + prox.emoji + ' ' + prox.nombre + ' desde el ' + fechaTemp3(prox.ini) + '.' : '';
  aviso(tp.emoji + ' ' + tp.nombre + ' (hasta el ' + tp.hasta + '): los monstruos sueltan ' + tp.cosas + ' y los jefes, varias. Llevas ' + n.toLocaleString('es') + (meta ? '; con ' + meta + ' ganas ' + (meta === 50 ? '3.000' : '12.000') + ' de oro y el título «' + tp.titulos[meta === 50 ? 0 : 1] + '».' : ': ya tienes los dos títulos.') + despues, 'ok');
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
    if (tuto3.pul !== i) document.querySelectorAll('.tuto-pulso').forEach(b => { if (b !== obj) b.classList.remove('tuto-pulso'); });
    if (obj && !obj.classList.contains('tuto-pulso')) obj.classList.add('tuto-pulso');
  } catch (e) {}
  tuto3.pul = i;
}
function htmlTuto3() {
  if (!yo.clase || yo.nivel > 6) { pulsoTuto3(-1); return ''; }
  const clave = 'dq3_tuto_' + (yo.pid || '');
  if (tuto3.clave !== clave) {
    let i = 0; try { i = +(localStorage.getItem(clave) || 0); } catch (e) {}
    // Otro navegador (p. ej. de Telegram a Chrome) no tiene el paso guardado: se deduce del progreso real.
    if (yo.mis && yo.mis.i >= 1) i = TUTO3.length; else if ((yo.kills || 0) > 0) i = Math.max(i, 3);
    try { localStorage.setItem(clave, String(i)); } catch (e) {}
    Object.assign(tuto3, { clave, i, x0: P.x, z0: P.z, k0: yo.kills || 0, hab: false }); }
  // k0 no se reinicia al avanzar: la primera caza cumple a la vez "sigue la luz" y "ataca".
  if (TUTO3[tuto3.i] && TUTO3[tuto3.i].hecho(tuto3)) { tuto3.i++; tuto3.x0 = P.x; tuto3.z0 = P.z; try { localStorage.setItem(clave, String(tuto3.i)); } catch (e) {} sfx('moneda', 0.3);
    // Embudo (una vez por sesion, beacon /mmo/ev): cumplio la habilidad, las alas o todo el tutorial.
    const pe = tuto3.i === 4 ? 't_hab' : tuto3.i === 5 ? 't_volar' : tuto3.i === TUTO3.length ? 't_fin' : ''; if (pe) paso(pe);
    // Primera caza: se felicita y se enseña lo que falta del combate (habilidad y alejarse del rojo).
    if (tuto3.i === 3) aviso('¡Bien hecho! Ahora usa tu habilidad. Si un monstruo se agacha y brilla en rojo, aléjate un paso: va a darte un golpe cuerpo a cuerpo.', 'ok', 1); }
  pulsoTuto3(tuto3.i);
  const p = TUTO3[tuto3.i]; if (!p) return '';
  // Paso 6 con la mision lista: la propia fila del tutorial la entrega (en movil la fila 📜 queda debajo).
  const lista = tuto3.i === 5 && MISIONES[yo.mis.i] && yo.mis.p >= MISIONES[yo.mis.i].n;
  return `<div class="q"${lista ? ' data-entregar="1"' : ''} style="border-left:3px solid #4ade80;padding-left:6px${lista ? ';cursor:pointer' : ''}"><b style="color:#4ade80">💡 ${COMPACTO ? '' : 'Paso '}${tuto3.i + 1}/${TUTO3.length}</b>${esc(p.txt())}</div>`;
}
const flechaDir = (x, z) => { let a = camYaw - Math.PI - Math.atan2(x - P.x, z - P.z); a = Math.atan2(Math.sin(a), Math.cos(a)); return ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'][(Math.round(a / (Math.PI / 4)) + 8) % 8]; };
function pintarMisiones() {
  const c = $('misiones');
  if (!yo || !yo.mis) { c.style.display = 'none'; return; }
  const q = MISIONES[yo.mis.i], d = yo.diaria || {};
  let h = '';
  metaMision = null;
  if (enAbismo(P.x)) {
    const is = islaEn(P.x, P.z), fc = yo.faccion && FACCIONES[yo.faccion];
    h = `<div class="q"><b>🌌 ${ABISMO.nombre}</b>${is && is.nombre ? is.nombre + ' · ' : ''}${fc ? `<span style="color:${fc.color}">${fc.titulo}</span>` : ''}${temp3 && fc && temp3.debil === yo.faccion ? ' <span style="color:#ffd84a">✨ PA ×' + String(FACC_BONO).replace('.', ',') + '</span>' : ''}${rangoHtml()}${asedioHtml()}<br><span style="font-size:11px">${santuario(P.x, P.z) ? '🛡 Santuario: aquí nadie pelea contra jugadores.' : 'Abate a la otra facción y a los élites para ganar Puntos del Abismo. Vuelve por el portal de tu bastión.'}</span></div>`;
    c.style.display = 'block'; if (c._h !== h) { c.innerHTML = h; c._h = h; } faro.visible = false; return;
  }
  if (asedio && asedio.activo && yo.nivel >= ABISMO.nvMin && !enCueva(P.x)) h += `<div class="q"><b style="color:#fca5a5">⚔ Asedio del Núcleo</b> ${fmtT(asedio.fin - Date.now())} · entra al Abismo por el portal del pueblo</div>`;
  if (enCueva(P.x)) {
    // Sala actual (los pasillos cuentan como la sala a la que llevan) y cronometro desde que entraste.
    const lxC = P.x - CUEVA_X0, iS = CUEVA.salas.findIndex(([a, b, c2, d]) => lxC >= a && lxC <= c2 && P.z >= b && P.z <= d);
    const nS = iS < 0 ? 1 : [1, 2, 2, 3, 3, 4, 4][iS] || 1, nomS = ['Entrada', 'Guardia', 'Magos', 'Trono'][nS - 1];
    const hechaC = cuevaInfo && cuevaInfo.hecha;
    const relojC = cuevaT0 && !hechaC ? ` · ⏱ ${fmtT(Date.now() - cuevaT0)}` : '';
    const recC = yo.cuevaRec ? ` · récord ${fmtT(yo.cuevaRec * 1000)}` : '';
    h = `<div class="q"><b>⛏ ${CUEVA.nombre}</b>${hechaC ? `<span class="ok">¡Completada${cuevaFinM ? ' en ' + fmtT(cuevaFinM.seg * 1000) + (cuevaFinM.nuevo ? ' (¡nuevo récord!)' : '') : ''}! Sal por el portal de la entrada.</span>`
      : `Sala ${nS}/4 · ${nomS} <span style="color:#ffd84a">${'●'.repeat(nS)}${'○'.repeat(4 - nS)}</span>${relojC}<br><span style="font-size:11px">${nS === 4 ? '👑 Trono: esquiva el pisotón rojo' : 'Derrota al Rey Goblin en su trono.'}${recC}</span>`}</div>`;
    c.style.display = 'block'; if (c._h !== h) { c.innerHTML = h; c._h = h; } faro.visible = false; return;
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
    else if (campo) metaMision = { x: campo.x, z: campo.z, jefe: false, entreno: true };
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
      h += `<div class="q"><b style="color:#f0abfc">📖 ${esc(qs.nombre)}</b>${esc(qs.pide)} ${Math.min(secundarias[qs.id] || 0, qs.n)}/${qs.n}<small> · ${esc(qs.quien)}</small></div>`;
      if (!secVistas.has(qs.id)) { secVistas.add(qs.id); setTimeout(() => npcDice(qs.quien, qs.inicio, qs.emoji), 2500); }
    } else {   // la siguiente aun pide mas nivel: una pista tenue
      const pr = SECUNDARIAS.find(x => x.zona === zE && !secundarias[x.id + ':ok']);
      if (pr && pr.nv > yo.nivel) h += `<div class="q" style="opacity:.55"><small>📖 ${esc(pr.quien)} tendrá algo más que contarte en Nv ${pr.nv}</small></div>`;
    }
  }
  const tt = htmlTuto3();   // despues de calcular metaMision: el paso 2 la mira (va primera, tambien con invasion)
  // Movil con la caja plegada (solo se ve la primera fila): la Caza del dia lista para cobrar va arriba,
  // (el servidor ya la cobra sola al cumplirla; la fila queda por si un cliente viejo no la cobro).
  const plegada = COMPACTO && !c.classList.contains('abierto'), diariaLista = !d.ok && (d.p || 0) >= DIARIA.n;
  if (!d.ok) {
    const filaDiaria = `<div class="q"><b>☀ ${DIARIA.nombre}</b>${(d.p || 0) >= DIARIA.n ? '<span class="ok" data-entregar="diaria" style="cursor:pointer;text-decoration:underline">¡Lista! Toca aquí para cobrarla</span>' : `Monstruos de tu nivel: ${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}<small style="display:block">Premio: +${premioDiaria(yo.nivel).oro} oro · ${premioDiaria(yo.nivel).pocion} pociones</small>`}</div>`;
    if (plegada && diariaLista) h = filaDiaria + h; else h += filaDiaria;
  } else if (!plegada) {   // ya cobrada: cuando vuelve (medianoche de Peru)
    const msD = 86400000 - ((Date.now() - 5 * 3600000) % 86400000);
    h += '<div class="q"><b>☀ ' + DIARIA.nombre + ' ✓</b><small>Nueva en ' + Math.ceil(msD / 3600000) + ' h (00:00 hora de Perú)</small></div>';
  }
  if (invasion3) {
    const ms = Math.max(0, invasion3.ms - (Date.now() - invasion3.recibido)), mm = Math.floor(ms / 60000), ss = Math.floor(ms % 60000 / 1000);
    const zc = ZONAS3D[invasion3.zona], dz = zc ? Math.hypot(zc.x - P.x, zc.z - P.z) : 0;
    h = `<div class="q" style="border-left:3px solid #ff5a1f;padding-left:6px"><b style="color:#ff8a5c">⚔️ ${esc(invasion3.nombre)}</b>${invasion3.fase === 'capitan' ? '¡Derrota al Capitán!' : `Invasores: ${invasion3.hechos}/${invasion3.meta}`} · ${mm}:${String(ss).padStart(2, '0')}<small>${(MAPAS[invasion3.zona] || {}).nombre || ''}${dz > 60 && zc ? ` · ${flechaDir(zc.x, zc.z)} ${Math.round(dz)} m` : ' · ¡aquí!'}</small></div>` + h;
  } else if (invPre3) {   // tambores: la invasion llega en 1:30 a esa zona
    const ms = Math.max(0, invPre3.hasta - Date.now()), mm = Math.floor(ms / 60000), ss = Math.floor(ms % 60000 / 1000);
    const zc = ZONAS3D[invPre3.zona], dz = zc ? Math.hypot(zc.x - P.x, zc.z - P.z) : 0;
    h = `<div class="q" style="border-left:3px solid #ff9a3c;padding-left:6px"><b style="color:#ffb072">🥁 ${invPre3.gran ? 'GRAN Invasión' : 'Invasión'} en ${mm}:${String(ss).padStart(2, '0')}</b><small>${esc((MAPAS[invPre3.zona] || {}).nombre || '')}${dz > 60 && zc ? ` · ${flechaDir(zc.x, zc.z)} ${Math.round(dz)} m` : ' · ¡aquí!'}</small></div>` + h;
  } else {   // Gran Invasion diaria (eventos3d.js tickEventos3d): de 19:00 a 21:00 de Lima, cuenta atras en el HUD (solo en el juego)
    const lima = new Date(Date.now() - 5 * 3600e3), lh = lima.getUTCHours();
    const falta = Math.max(1, Math.ceil((21 * 60 - lh * 60 - lima.getUTCMinutes() - lima.getUTCSeconds() / 60)));
    // En celular con la caja plegada no tapa la mision principal hasta los ultimos 30 min.
    // Al novato (Nv < 3 o en el tutorial) no le tapa su primera mision.
    const novato3 = !yo || (yo.nivel || 1) < 3 || (tuto3 && tuto3.i >= 0 && tuto3.i < TUTO3.length);
    if (!novato3 && (lh === 19 || lh === 20) && (!COMPACTO || c.classList.contains('abierto') || falta <= 30)) {
      h =`<div class="q" style="border-left:3px solid #ff9a3c;padding-left:6px"><b style="color:#ffb072;font-size:12px">🥁 Gran Invasión hoy 21:00 · faltan ${falta >= 60 ? Math.floor(falta / 60) + ' h ' : ''}${falta % 60 ? falta % 60 + ' min' : ''} · sal a una zona de caza</b></div>` + h;
    }
  }
  if (!COMPACTO || c.classList.contains('abierto')) { // Tesoro cercano: el cofre disponible mas proximo (en movil, con la caja abierta)
    let mc = null, md = 400; const ah = Date.now();
    for (const c of COFRES3) if (c.listoEn <= ah) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < md && d > 6) { md = d; mc = c; } }
    if (mc) h += `<div class="q"><b>🧰 ${NOMBRE_COFRE[mc.tipo].replace(/^./, x => x.toUpperCase())}</b><small>${flechaDir(mc.x, mc.z)} ${Math.round(md)} m${mc.tipo === 'legendario' ? ' · en lo alto: ¡vuela!' : ''}</small></div>`;
  }
  // Misiones del dia y de la semana (se cobran solas); 🔄 cambia una gratis al dia.
  const T = yo.tareas;
  if (T && T.dia) {
    const hd = T.dia.l.filter(t => t.ok).length, hs = T.sem.l.filter(t => t.ok).length;
    // Movil con la caja recortada: una sola linea; al tocarla se despliega la lista completa.
    if (COMPACTO && !c.classList.contains('abierto')) h += `<div class="q"><b>🗓 Día ${hd}/${T.dia.l.length} · Semana ${hs}/${T.sem.l.length}</b><small>Toca para ver</small></div>`;
    else h += `<div class="q"><b>🗓 Misiones del día ${hd}/${T.dia.l.length}</b>` + T.dia.l.map((t, i) => t.ok ? `<span class="ok">✓ ${esc(t.txt)}</span>` : `<span class="tarea">• ${esc(t.txt)} ${t.p}/${t.n}${T.dia.cambio ? '' : ` <button class="cambiar" data-cambiar="${i}" title="Cambiar esta misión (1 gratis al día)">🔄</button>`}</span>`).join('') +
      `<small>${T.dia.bono ? '✓ bono del día' : 'Bono al completar 2 de 3'} · se renuevan a la medianoche (hora de Perú)</small></div>` +
      // Las semanales tambien (antes solo se veia "Semana 0/2").
      `<div class="q"><b>📅 Misiones de la semana ${hs}/${T.sem.l.length}</b>` + T.sem.l.map(t => t.ok ? `<span class="ok">✓ ${esc(t.txt)}</span>` : `<span class="tarea">• ${esc(t.txt)} ${t.p}/${t.n}</span>`).join('') + '</div>';
  }
  // Fila fija de la expedicion (algo en marcha mientras no juega): toca y abre su ventana (ventanas.js).
  if (yo.nivel >= EXPEDICION.nv) {
    const ex = yo.exped, ms = ex ? ex.fin - Date.now() : 0;
    const tx = !ex ? 'Manda a tu mascota de expedición' : ms <= 0 ? '¡Volvió! Toca para recoger' : `Vuelve en ${ms >= 3600000 ? Math.ceil(ms / 3600000) + ' h' : Math.max(1, Math.ceil(ms / 60000)) + ' min'}`;
    const fx = `<div class="q" data-expabrir="1" style="cursor:pointer"><b style="color:${ex && ms <= 0 ? '#4ade80' : '#7dd3fc'}">🧭 ${tx}</b></div>`;
    // Movil con la caja plegada (recorta lo de abajo): si ya volvio, va arriba para que se vea.
    if (ex && ms <= 0 && COMPACTO && !c.classList.contains('abierto')) h = fx + h; else h += fx;
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
  h = tt + h;
  c.classList.toggle('con-tuto', !!tt);
  c.style.display = h ? 'block' : 'none';
  if (c._h !== h) { c.innerHTML = h; c._h = h; }
  // Columna de luz sobre la meta (como las zonas de mision de WoW).
  const dMeta = metaMision ? Math.hypot(metaMision.x - P.x, metaMision.z - P.z) : Infinity;
  faro.visible = !!metaMision && dMeta > 12;
  if (metaMision) { faro.position.set(metaMision.x, alturaEn(metaMision.x, metaMision.z), metaMision.z); faro.material.color.set(metaMision.guia ? '#4ade80' : '#ffd84a'); }
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
let avisoCampo = '', metaEnc = null, encargos = {}, encZonas = 0, encRecibido = false, secundarias = {};
const secVistas = new Set();
const faroEnc = (() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 70, 12, 1, true).translate(0, 35, 0), new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.visible = false; escena.add(m); return m;
})();
const faroAro = (() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(10, 11, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  m.visible = false; escena.add(m); return m;
})();
// El monstruo que pide la mision activa (null si ya esta lista).
function tipoMision() { const q = yo && yo.mis && MISIONES[yo.mis.i]; return q && yo.mis.p < q.n ? q.tipo : null; }
const faro = (() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 90, 12, 1, true).translate(0, 45, 0), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.visible = false; escena.add(m); return m;
})();
// Cambiar mision pide dos toques (solo hay 1 cambio gratis al dia; sin confirm(): en Telegram queda feo)
let cambioPend = null;
$('misiones').onclick = e => { if (e.target.closest('[data-expabrir]')) { e.stopPropagation(); V.abrirExpedicion(); return; } const en = e.target.closest('[data-entregar]'); if (en) { e.stopPropagation(); mandar(en.dataset.entregar === 'diaria' ? { t: 'mision', diaria: true } : { t: 'mision' }); return; } const b = e.target.closest('[data-cambiar]'); if (b) { e.stopPropagation(); const i = +b.dataset.cambiar; if (cambioPend && cambioPend.i === i && Date.now() - cambioPend.t < 4000) { cambioPend = null; mandar({ t: 'cambiarTarea', i }); } else { cambioPend = { i, t: Date.now() }; b.textContent = '¿Seguro?'; } return; } if (COMPACTO) { $('misiones').classList.toggle('abierto'); pintarMisiones(); return; } abrirMapa(); };
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
// Modo reposo: quieto, sin pelea ni habilidad y sin tocar nada en 4 s, se dibuja a 30 fps (20 en baja): menos bateria y calor.
let reposo = false, reposoAntes = false, reposoT = 0, topeFigT = 0;
const MAX_FIG = { baja: 8, media: 16, alta: 30 }[CAL] || 16;
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
  requestAnimationFrame(bucle);
  if (forzar !== true) {
    if (fuera3 || document.hidden) return;
    if (reposo && t - Math.max(ultimoToqueT, movInputT) < 4000) { reposo = false; proxCuadro = 0; }
    const paso = ventanaAb ? 100 : reposo ? (CAL === 'baja' ? 50 : 33) : CUADRO_MS;
    if (t < proxCuadro - 1.5) return;
    proxCuadro = Math.max(proxCuadro + paso, t + paso * 0.5);
  }
  try { armarColaFig(); cuadroBucle(t); }
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
  if (t - topeFigT > 500) { topeFigT = t; topeFiguras(); }
  const dt = Math.min(0.05, (t - ultimoT) / 1000); ultimoT = t;
  cuadro++;
  fisica(dt);
  if (prueba) girarPrueba();
  if (atkMantener || (atkReintento && atkReintento > t)) golpeManual(true);   // mantener ATACAR (o 1/Z) sigue pegando al ritmo del arma
  pintarAyudaAtk(t);   // anillo "a tiro" bajo el monstruo y recarga del boton ATACAR
  if (atkBuf && performance.now() >= sigAtk) { const v = performance.now() - atkBuf < 260; atkBuf = 0; if (v) golpeManual(); }
  if (colaHab && t >= gcdHasta) { const h = colaHab; colaHab = null; if (t < colaHasta) usarHab(h); }
  if (impactos.length) impactos = impactos.filter(i => { if (t < i.t) return true; if (!i.o.muereT) { i.o.golpeT = t; i.o.predT = t; i.o.golpeC = false; i.o.golpeDe = P; pausaGolpe(i.o, 40); } return false; });
  // Interpolacion de los demas.
  for (const o of otros.values()) { avanzarHacia(o, t); animarJugador(o, false, t); }
  for (const o of [...mons.values()]) {
    if (!o.muereT) avanzarHacia(o, t);
    if (o.muereT && t - o.muereT > 1600) { quitarMon(o.id); continue; }
    animarMon(o, t);
  }
  if (P.fig) animarJugador(P, true, t);
  moverMascotas(t, dt);
  for (const n of npcs) if (n.fig && n.fig.tipo === 'modelo') {
    const cerca = Math.hypot(P.x - n.x, P.z - n.z) < 12;
    n.ry = lerpAng(n.ry || 0, cerca ? Math.atan2(P.x - n.x, P.z - n.z) : 0, 0.08);
    n.fig.poner(n.x, n.y, n.z, n.ry, t);
  } else if (n.fig) { const h = n.fig.hoja; n.fig.cuadro(h.mov[1] + Math.floor(t / 600 + n.x) % 2, h.mov[0], P.x > n.x); n.fig.poner(n.x, n.y, n.z, camYaw); }
  moverAventureros(t, dt);
  // Proyectiles.
  proyectiles = proyectiles.filter(p => {
    p.t += dt / 0.28;
    const a = p.a, ay = (a.y || alturaEn(a.x, a.z)) + 1.2;
    p.mesh.position.set(lerp(p.de.x, a.x, p.t), lerp(p.de.y, ay, p.t) + Math.sin(p.t * Math.PI) * 0.8, lerp(p.de.z, a.z, p.t));
    if (p.t >= 1) { escena.remove(p.mesh); return false; }
    return true;
  });
  if (tajos.length) moverTajos(t);
  // Camara: detras del duende, sin meterse en el suelo.
  const tx = P.x, ty = P.y + 1.4, tz = P.z;
  // Solo el terreno (colinas entre el duende y la camara) y las paredes de la
  // cueva la acercan; arboles y casas no (lo que tapa se ve a traves). Acercar
  // es rapido pero suave, alejar es lento y espera un poco (sin "bombeo").
  const enCv = enCueva(P.x);
  const camX = tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, camZ = tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  const kChoque = enCv ? choqueCueva(tx, tz, camX, camZ) : choqueTerreno(tx, ty, tz, camX, ty + Math.sin(camPitch) * camDist, camZ);
  const camMin = enCv ? 3.2 : 2.6;
  const meta = Math.max(Math.min(camMin, camDist), kChoque * camDist);
  if (meta < camReal - 0.01) { camReal += (meta - camReal) * (1 - Math.exp(-dt * 10)); camHold = 0.35; }
  else if (camHold > 0) camHold -= dt;
  else camReal += (meta - camReal) * (1 - Math.exp(-dt * 3));
  // En la cueva, si la pared obliga a acercar, la camara sube (vista por encima del hombro).
  const pitch = camPitch + (enCv ? (1 - kChoque) * 0.45 : 0);
  let cx = tx + Math.sin(camYaw) * Math.cos(pitch) * camReal, cz = tz + Math.cos(camYaw) * Math.cos(pitch) * camReal;
  let cy = ty + Math.sin(pitch) * camReal;
  cy = Math.max(cy, alturaEn(cx, cz) + 0.8, aguaEn(cx) + 0.5);
  if (enCv) cy = Math.min(cy, 7.2);   // bajo el techo de la cueva
  camara.position.set(cx, cy, cz); camara.lookAt(tx, ty, tz);
  // Sensacion de velocidad: el campo de vision se abre un poco al galopar o volar rapido.
  // Golpe critico: la camara se acerca un instante y vuelve (v322).
  fovGolpe *= Math.exp(-dt * 9); if (Math.abs(fovGolpe) < 0.05) fovGolpe = 0;
  const fovObj = fovBase + fovGolpe + clamp((Math.hypot(P.vx, P.vz) / MUNDO.velocidad - 1.1) * 8, 0, 10);
  if (Math.abs(camara.fov - fovObj) > 0.05) { camara.fov += (fovObj - camara.fov) * Math.min(1, dt * (fovGolpe ? 14 : 3)); camara.updateProjectionMatrix(); }
  TAPA.uCam.value.set(cx, cy, cz); TAPA.uTgt.value.set(tx, ty, tz);
  // Zona actual: titulo, cielo y niebla de su color.
  if (toca(0, 250, t)) {
    ventanaAb = hayVentana() && !$('v-look').classList.contains('on');
    const z = zonaEn(P.x, P.z);
    if (z !== zonaActual) { zonaActual = z; tituloZona(z); if (benditas3[z] > Date.now() && MAPAS[z]) aviso(`✨ ${MAPAS[z].nombre} está Bendecida: +10% XP al cazar (${Math.ceil((benditas3[z] - Date.now()) / 60000)} min)`, 'ok'); }
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
    if (MOVIL) { const u = $('t-usar'), b = $('hablar'), ver = b.style.display === 'block' && !P.vuela; u.style.visibility = ver ? 'visible' : 'hidden'; if (ver) u.textContent = /Abrir/.test(b.textContent) ? 'ABRIR' : /Recoger/.test(b.textContent) ? 'RECOGER' : /Pescar|TIRAR|pique/.test(b.textContent) ? (/TIRAR/.test(b.textContent) ? '¡TIRAR!' : 'PESCAR') : /Salir/.test(b.textContent) ? 'SALIR' : /Disparar/.test(b.textContent) ? 'FUEGO' : /Resucitar/.test(b.textContent) ? 'REVIVIR' : /🛒 Tienda/.test(b.textContent) ? 'TIENDA' : /📜 Misiones/.test(b.textContent) ? 'MISIONES' : /⚒️ Fabricar/.test(b.textContent) ? 'FABRICAR' : /🏆 Ranking/.test(b.textContent) ? 'RANKING' : 'HABLAR'; if (ver) u.style.fontSize = u.textContent.length > 7 ? '10px' : ''; }
    if (npcAbierto && $('v-npc').classList.contains('on')) { const n = NPCS3D.find(x => x.tipo === npcAbierto); if (n && Math.hypot(P.x - n.x, P.z - n.z) > NPC_DIST + 6) cerrar('v-npc'); }
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
  // Cueva y Abismo solo existen para el render dentro de su zona (estan lejos y no se ven desde fuera).
  if (cueva) cueva.grupo.visible = enCueva(P.x);
  if (abismo) abismo.grupo.visible = enAbismo(P.x);
  if (cueva && enCueva(P.x)) cueva.animar(t);
  if (abismo && enAbismo(P.x)) { abismo.animar(t); animarCorrientes(t); }
  animarNocheDuendes(t);
  if (tirosAsedio.length) moverTirosAsedio(t);
  for (const cr of cristalesHito) { cr.rotation.y = t / 900; cr.position.y += Math.sin(t / 500) * 0.004; }
  if (molinoAspas && Math.hypot(P.x, P.z) < 160) molinoAspas.rotation.x = t / 1400;
  if (corcho) corcho.position.y = corcho.userData.y0 + (pica > performance.now() ? -0.18 + Math.sin(t / 60) * 0.08 : Math.sin(t / 500) * 0.04);
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
  efectos = efectos.filter(e => {
    e.t += dt / e.dura;
    const r = 0.5 + e.radio * Math.min(1, e.t);
    e.m.scale.set(r, r, r); e.m.material.opacity = 0.8 * (1 - e.t);
    if (e.t >= 1) { escena.remove(e.m); e.m.material.dispose(); return false; }
    return true;
  });
  for (const [id, z] of zonas3) { const k = clamp((performance.now() - z.ini) / z.ms, 0, 1); if (performance.now() - z.ini > z.ms + 1500) { quitarZona3(id); continue; } const kk = Number.isFinite(k) ? k : 0; z.disco.material.opacity = 0.12 + 0.4 * kk; const sd = Math.max(0.05, kk) * z.r; const sdOk = Number.isFinite(sd) ? sd : 0.01; z.disco.scale.set(sdOk, 1, sdOk); if (z.anillo) { const sa = Math.max(0.01, kk * z.r); z.anillo.scale.setScalar(Number.isFinite(sa) ? sa : 0.01); z.anillo.material.opacity = 0.5 + 0.45 * kk; } }
  // Sacudida suave (seno con fase, sin ruido): crece algo mas que lineal y con tope, asi los golpes chicos no marean.
  if (sacudir > 0) { sacudir = Math.max(0, Math.min(0.6, sacudir) - dt); const am = sacudir * (0.3 + sacudir * 0.4) * (MENOS_MOV ? 0.15 : 1); camara.position.x += Math.sin(t * 0.09) * am; camara.position.y += Math.cos(t * 0.11) * am; }
  alasMesh.visible = (P.vuela || P.planea) && !!yo;
  if (alasMesh.visible) ponerAlas(alasMesh, P.x, P.y, P.z, P.fig && P.fig.tipo === 'modelo' ? P.ry : camYaw, t);
  etiquetas(t);
  numeros = numeros.filter(n => {
    n.t += dt;
    const s = aPantalla(n.x + n.dx * n.t, n.y + n.t * 1.2 - n.t * n.t * 0.35, n.z);
    if (!s || n.t > 1.1) { n.d.style.display = 'none'; poolNum.push(n.d); return false; }
    const k = n.t < 0.12 ? 1 + (n.g ? 0.8 : 0.4) * (1 - n.t / 0.12) : 1;
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
  if (composer) composer.render(dt); else render.render(escena, camara);
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
  ponerSolido(portal.x - 2.2, portal.z, 0.7); ponerSolido(portal.x + 2.2, portal.z, 0.7);
  cueva = construirCueva(escena);
  abismo = construirAbismo(escena, KIT);
  crearCofres3();
  for (const c of abismo.solidos || []) ponerSolido(c.x, c.z, c.r);
  abismo.dueno(asedio && asedio.dueno);
  crearCorrientes();
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
    const cal = [new THREE.Mesh(GEO_BALA, matBala('#ffffff')), new THREE.Mesh(GEO_ONDA, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }))];
    if (USAR_MODELOS) { cal.push(crearMonstruo('goblin_normal').obj); cal.push(crearDuende({}).obj); cal.push(crearDuende({ skin: 'legendaria', arma: 'chispa' }).obj); }
    cal.forEach(m => { m.position.set(P.x, -50, P.z); escena.add(m); });
    render.compile(escena, camara);
    cal.forEach(m => escena.remove(m));
  } catch (e) { console.warn(e); }
  // Los NPC en paralelo (sin modelos 3D, sus hojas se bajaban una tras otra).
  const figsNpc = await Promise.all(NPCS3D.map(n => figuraModelo(() => crearNpc(n.hoja)) || figuraHoja(n.hoja, 62)));
  NPCS3D.forEach((n, i) => npcs.push({ ...n, y: alturaEn(n.x, n.z), fig: figsNpc[i], lbl: etiqueta('') }));
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
