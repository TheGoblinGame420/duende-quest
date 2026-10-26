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
import { MAPAS, MONSTRUOS, HOJAS, SKINS, CLASES, PODERES, ARMAS, VARA, MISIONES, DIARIA, statsMonstruo, xpParaSubir,
  habsDe, habPorId, costoHab, RECURSOS, GCD_MS, MONTURAS, velMontura, MATERIALES, RECETAS, APARIENCIA, LOOK_BASE, limpiarLook, ALAS, alaDe,
  LOGIN_PREMIOS, PASE, premioPase, paseMes, HERM_COSTO, HERM_NIVEL, HERM_MAX, HERM_COLORES, GESTA_UMBRALES, GESTA_NOMBRES, GESTA_MIN, CHICHA, RAREZAS, nombreItem, talento, LOGROS } from '/mmo/js/data.js?v=312';
import { iniciarVentanas } from './ventanas.js?v=312';
import { crearDuende, crearMonstruo, crearNpc, crearMontura, precalentar } from './modelos.js?v=312';
import { crearMusica } from './musica.js?v=312';
import { construirCueva } from './cueva.js?v=312';
import { TAPA, transparentar } from './tapa.js?v=312';
import { construirAbismo } from './abismo.js?v=312';
import { crearParticulas } from './particulas.js?v=312';
import { cargarKenney, piezasCasa } from './kenney.js?v=312';
import { CORRIENTES } from '/mmo/js/abismo3d.js?v=312';
import { ABISMO, ABISMO_X0, FACCIONES, enAbismo, islaEn, portalBase, VACIO, RANGOS, rangoDe, santuario, PUERTA_NUCLEO, MAQUINA, MAQUINA_DIST, maquinasAbismo, TEMP_ABISMO, FACC_BONO, RECLUTA } from '/mmo/js/abismo3d.js';
const MAQUINAS = maquinasAbismo();
import { CUEVA, CUEVA_X0, caminable, enCueva } from '/mmo/js/cueva3d.js?v=312';
import { MUNDO, ZONAS3D, NPCS3D, NPC_DIST, CASAS, SPAWN3D, ARENA3D, horaMundo, climaEn, nodos3d, RECOGER_DIST, alturaEn, zonaEn, mezclaEn, pendienteEn, campamentos, cofres3d, COFRE3D_DIST } from '/mmo/js/mundo3d.js?v=312';
import { encargosDe, hitoDe, ZONAS_ENC } from '/mmo/js/encargos3d.js?v=312';
import { LORE_ZONAS, LORE_NPC, LORE_HITOS, LORE_NIVEL60, AVENTUREROS, FRASES_AVENTUREROS, LORE_MISIONES } from './lore.js?v=312';

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
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
// En Telegram los enlaces a CLASSIC llevan la sesion (el #tgWebAppData): sin ella entraba como invitado.
// Invitacion compartida desde ORIGINS (/mundo/?ref=): se manda en el hola como en CLASSIC (antes no contaba).
const ref3 = (/[?&]ref=([a-z0-9]{6})/.exec(location.search) || [])[1];
// El ⌂ (inicio web) va al menu de la Mini App, como en CLASSIC.
if (TG && location.hash) document.querySelectorAll('a[href="/mmo/"],a[href="/inicio/"]').forEach(a => { a.href = (a.getAttribute('href') === '/inicio/' ? '/telegram/index.html' : '/mmo/') + location.hash; });
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
      for (const ev of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged']) TG.onEvent(ev, zonas);
      TG.requestFullscreen();
    }
  } catch (e) {}
}
// Vibracion de Telegram: golpes (suaves), criticos, heridas, nivel, muerte.
let vibT = 0;
function vib(t) {
  const ahora = performance.now();
  // Fuera de Telegram (Android en el navegador) con la vibracion del sistema; iPhone no la tiene.
  if (!TG || !TG.HapticFeedback || !TGV('6.1')) { if (MOVIL && navigator.vibrate && ahora - vibT >= 70) { vibT = ahora; try { navigator.vibrate(t === 'light' ? 8 : t === 'medium' ? 18 : t === 'heavy' ? 30 : t === 'error' ? [20, 40, 20] : 15); } catch (e) {} } return; }
  if (ahora - vibT < 70) return;
  vibT = ahora;
  try { if (t === 'success' || t === 'error' || t === 'warning') TG.HapticFeedback.notificationOccurred(t); else TG.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {}
}
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
const POBRE = /Android/i.test(navigator.userAgent) && ((navigator.deviceMemory || 4) <= 3 || (navigator.hardwareConcurrency || 8) <= 4);
let CAL = POBRE ? 'baja' : MOVIL ? 'media' : 'alta';
try { const g = localStorage.getItem('dq3_calidad'); if (CALIDADES[g]) CAL = g; } catch (e) {}
const Q = CALIDADES[CAL];
const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: Q.aa, powerPreference: 'high-performance' });
render.setPixelRatio(Math.min(devicePixelRatio || 1, Q.px));
if (Q.sombras) { render.shadowMap.enabled = true; render.shadowMap.type = THREE.PCFSoftShadowMap; }
render.outputColorSpace = THREE.SRGBColorSpace;
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
    composer = c;
  }).catch(e => console.warn('[3D] sin post-proceso', e));
}
function PRUEBA_SIN_POST() { return /[?&]sinPost=1/.test(location.search); }
// Resolucion dinamica: si el movil no llega a ~40 fps baja la resolucion
// (hasta un 60%) y la sube cuando sobra.
let pxAct = Math.min(devicePixelRatio || 1, Q.px), dtProm = 16, resT = 0;
// Distancia de vision dinamica: con la resolucion ya al minimo y aun lento,
// se acorta la niebla (cullFlora y las figuras usan fog.far) y se recupera sola.
let lejosDin = Q.lejos, avisoCal = false;
function resolucionDinamica(ms) {
  if (document.hidden || ms > 200) return;
  dtProm += (ms - dtProm) * 0.05; resT += ms;
  if (resT < 2000) return;
  resT = 0;
  const max = Math.min(devicePixelRatio || 1, Q.px), min = max * 0.6;
  // Ya en el minimo y aun lento: fuera el post-proceso (es lo mas caro).
  if (composer && dtProm > 28 && pxAct <= min + 0.01) { composer = null; console.info('[3D] post-proceso desactivado por rendimiento'); return; }
  // > 38 ms (< 26 fps): un movil topado a 30 Hz (ahorro de bateria) da ~33 ms aunque vaya sobrado; a ese no se le acorta la vista.
  if (dtProm > 38 && pxAct <= min + 0.01 && lejosDin > 95) {
    lejosDin -= 20;
    if (!avisoCal && CAL !== 'baja') { avisoCal = true; aviso('El juego va justo: acortamos la vista. En ' + K('Ajustes (?)', 'Más (⋯) → ?') + ' puedes poner la calidad Baja.'); }
    return;
  }
  if (dtProm < 18 && lejosDin < Q.lejos) lejosDin = Math.min(Q.lejos, lejosDin + 10);
  const n = dtProm > 25 ? Math.max(min, pxAct - 0.1) : dtProm < 15 ? Math.min(max, pxAct + 0.05) : pxAct;
  if (Math.abs(n - pxAct) < 0.01) return;
  pxAct = n; render.setPixelRatio(n); if (composer) composer.setPixelRatio(n); ajustar();
}
// ── DIA, NOCHE Y CLIMA ──
const BLANCO_H = C('#ffffff'), NOCHE_CIELO = C('#0b1030'), OCASO = C('#ff8a5c'), GRIS = C('#6c7380'), ARENA = C('#c9a46a');
const estrellas = (() => {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random() * 0.95 + 0.05);
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 420; pos[i * 3 + 1] = Math.sin(e) * 420; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 420;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  escena.add(p);
  return p;
})();
// ── CIELO: cupula con degradado (horizonte → cenit), halo y disco del sol, y
// nubes low-poly que derivan alto. La niebla usa el color del horizonte, asi
// el mundo se funde con el cielo.
const cielo = (() => {
  const u = { uHor: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uSol: { value: new THREE.Vector3(0, 1, 0) }, uSolC: { value: new THREE.Color('#fff1c9') }, uNoche: { value: 0 } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uHor; uniform vec3 uTop; uniform vec3 uSol; uniform vec3 uSolC; uniform float uNoche; varying vec3 vD;
      void main() {
        float h = vD.y;
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.6, h));
        c = mix(c, uHor * 0.8, smoothstep(0.0, -0.25, h));
        float s = max(dot(normalize(vD), normalize(uSol)), 0.0);
        c += uSolC * (pow(s, 10.0) * 0.28 + pow(s, 900.0) * 1.6) * (1.0 - uNoche);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.renderOrder = -10; m.frustumCulled = false; escena.add(m);
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
const FX = crearParticulas(escena, MOVIL ? 900 : 1800, MOVIL);
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
let climaAct = 'despejado', nocheK = 0, relampagoT = -1e9, sigRelampago = 0, hemiBase = 1, nieblaObj = [40, Q.lejos];
const musica = crearMusica();
const NOMBRE_CLIMA = { despejado: '', lluvia: '🌧 Lluvia', tormenta: '⛈ Tormenta', nieve: '❄ Nieve', niebla: '🌫 Niebla', arena: '🌪 Tormenta de arena' };
// Para probar: ?clima=lluvia|tormenta|nieve|niebla|arena y ?hora=0..24
const PRUEBA = new URLSearchParams(location.search);
function ambiente(z) {
  const ahora = Date.now(), h = PRUEBA.has('hora') ? +PRUEBA.get('hora') : horaMundo(ahora);
  const dia = clamp(Math.sin((h - 5) / 14.5 * Math.PI) * 1.5, 0, 1);   // amanece a las 5, anochece a las 19:30
  nocheK = 1 - dia;
  const ocaso = Math.min(1, Math.max(0, 1 - Math.abs(h - 18.8) / 1.3) + Math.max(0, 1 - Math.abs(h - 5.8) / 1.1));
  const luz = LUZ[z] || 1;
  const cl = z === 'cueva' || z === 'eter' ? 'despejado' : PRUEBA.get('clima') || climaEn(z, ahora);
  const nub = cl === 'tormenta' ? 0.55 : cl === 'lluvia' || cl === 'nieve' ? 0.75 : cl === 'niebla' || cl === 'arena' ? 0.85 : 1;
  hemiBase = 0.9 * luz * (0.32 + 0.68 * dia) * (0.6 + 0.4 * nub);
  sol.intensity = 2.0 * luz * (0.12 + 0.88 * dia) * nub;
  sol.color.set(dia < 0.25 ? 0x9fb4ff : 0xfff2dd).lerp(OCASO, ocaso * 0.6);
  const a = (h - 6) / 24 * Math.PI * 2;
  solDir.set(Math.cos(a) * 200, Math.max(60, Math.abs(Math.sin(a)) * 220), 80);
  const fijo = z === 'cueva' || z === 'eter';   // ni dia ni noche: siempre su cielo
  cieloObj.set(CIELO[z] || CIELO.pueblo).lerp(OCASO, fijo ? 0 : ocaso * 0.35).lerp(NOCHE_CIELO, fijo ? 0 : nocheK * 0.85);
  if (nub < 1) cieloObj.lerp(cl === 'arena' ? ARENA : GRIS, (1 - nub) * 1.2);
  estrellas.material.opacity = z === 'eter' ? 0.7 : z === 'cueva' ? 0 : nocheK * (cl === 'despejado' ? 0.9 : 0.2);
  if (z === 'cueva') { hemiBase = 0.55; sol.intensity = 0.3; }
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
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const txt = (nocheK > 0.5 ? '🌙 ' : '☀ ') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (NOMBRE_CLIMA[cl] ? ' · ' + NOMBRE_CLIMA[cl] : '');
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

const progreso = (k, txt) => { $('carga-i').style.transform = `scaleX(${k})`; if (txt) $('carga-s').textContent = txt; };

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
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(LADO * 1.4, LADO * 1.4).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a8fd0, transparent: true, opacity: 0.72 }));
  agua.position.y = MUNDO.agua;
  escena.add(agua);
  return agua;
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
const TECHOS = ['#c2453a', '#3aa58a', '#c2453a', '#4a78c2', '#3aa58a', '#c2453a', '#b8643a'];
let molinoAspas = null;
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
  return { x: px, z: pz, velo };
}

// El pueblo con el kit de Kenney: casas de piedra y entramado de madera con
// tejado a dos aguas, una fuente en la plaza, puestos de mercado, carros y un
// molino de viento.
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
  // Molino: torre de tres plantas con aspas que giran.
  const mx = -17, mz = 31, my = alturaEn(mx, mz) - 0.25;
  const g = new THREE.Group(); g.position.set(mx, my, mz); g.rotation.y = 0.6;
  const torre = new THREE.Mesh(KIT.fundir(piezasCasa(2, 2, 9, '#c2453a', 3)), KIT.material);
  torre.scale.set(2.4, 2.3, 2.4); if (Q.sombras) torre.castShadow = true;
  molinoAspas = new THREE.Mesh(KIT.geo('p_windmill'), KIT.material);
  molinoAspas.position.set(2.4 * 1.32, 2.3 * 3.7, 0); molinoAspas.scale.setScalar(3.2);
  g.add(torre, molinoAspas); escena.add(g);
  ponerSolido(mx, mz, 3);
  // Portal de mazmorras.
  const px = 22, pz = -18, py = alturaEn(px, pz);
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), piedra); p1.position.set(px - 2.2, py + 3, pz);
  const p2 = p1.clone(); p2.position.x = px + 2.2;
  const arco = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1, 1.2), piedra); arco.position.set(px, py + 6.3, pz);
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  velo.position.set(px, py + 2.9, pz);
  escena.add(p1, p2, arco, velo);
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
    const ts = t / 1000;
    const d = Math.hypot(x - P.x, z - P.z);
    const ver = d < escena.fog.far + 15;
    this.raiz.visible = ver; this.sombra.visible = ver && (!Q.sombras || d > 24);
    if (this.montura) this.montura.obj.visible = ver;
    if (!ver) return;
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
function sfx(n, vol) {
  if (!sonido) return;
  const c = ctxAudio();
  if (!c || fuera3 || document.hidden) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const buf = SFX[n];
  if (!buf) { cargarSfx(n); return; }
  if (voces >= 8) return;
  try {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; src.playbackRate.value = 0.94 + Math.random() * 0.12;
    g.gain.value = vol || 0.4;
    src.connect(g); g.connect(c.destination);
    voces++; src.onended = () => { voces--; };
    src.start();
  } catch (e) {}
}
// Variantes de los paquetes CC0 (Kenney y OpenGameArt): una al azar.
const SFX_K = { paso_h: 5, paso_p: 5, paso_m: 5, paso_n: 5, g_carne: 5, g_metal: 5, g_critico: 3, desenv: 3, monedas: 2, libro: 3, tela: 4, puerta: 1,
  c_grunt: 5, c_hurt: 5, c_fant: 5, c_troll: 3, c_roar: 3, c_bug: 4, c_monster: 4, c_baba: 3, c_aullido: 2, c_grito: 2 };
function sfxK(base, vol) { const n = SFX_K[base]; if (n) sfx('k/' + base + Math.floor(Math.random() * n), vol); }
// Fanfarria de subir de nivel o de maestria (las cuatro notas del tono
// 'nivel' de CLASSIC): antes sonaba igual que recoger oro.
let fanfarriaT = 0;
function fanfarria() {
  if (!sonido) return;
  const c = ctxAudio();
  if (!c || c.state === 'closed' || fuera3 || document.hidden) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const ahora = performance.now();
  if (ahora - fanfarriaT < 400) return;
  fanfarriaT = ahora;
  try {
    const t0 = c.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + i * 0.11, d = i === 3 ? 0.3 : 0.12;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    });
  } catch (e) {}
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
let objetivo = 0, autoAtk = false, sigAtk = 0, avisoLejosT = 0, avisoAlcT = 0, colaHab = null, colaHasta = 0;
let camYaw = Math.PI, camPitch = 0.42, camDist = COMPACTO ? 8.5 : 11, camReal = camDist, camHold = 0;
let zonaActual = '';
let portal = null, agua = null, cueva = null, cuevaInfo = null, abismo = null, caidaEnviada = false;
const teclas = {};

// ── RED ──
function urlWs() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mmo/ws'; }
function mandar(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
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
  if (TG && !forzarInvitado) return { auth: { k: 'tg', d: TG.initData }, inv: inv0 };
  const tok = forzarInvitado ? null : await tokenWeb();
  if (tok) return { auth: { k: 'web', tok }, inv: inv0 };
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  soyInvitado = true;
  return { auth: { k: 'inv', tok: tokInvitado() }, nombre };
}
let ultimoMsgT = performance.now(), conectando = false;
async function conectar() {
  // Un solo intento a la vez (volver a la app, 'online' y el temporizador podian
  // coincidir durante el await y abrir dos sockets: el servidor echaba a uno).
  if (conectando || (ws && ws.readyState <= 1)) return;
  conectando = true;
  let hola;
  try { hola = await autenticacion(); } finally { conectando = false; }
  if (ws && ws.readyState <= 1) return;
  const este = ws = new WebSocket(urlWs());
  este.onopen = () => { if (ws !== este) return; conectado = true; ultimoMsgT = performance.now(); mandar({ t: 'hola', ...hola, modo: '3d', ref: ref3 }); };
  este.onmessage = ev => { if (ws !== este) return; ultimoMsgT = performance.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } recibir(m); };
  este.onclose = () => {
    if (ws !== este) return;   // un socket viejo que el vigilante ya cambio por otro: no toca nada
    conectado = false;
    if (fatal) return;
    // En segundo plano (Telegram minimizado, pantalla bloqueada) no se cuentan
    // intentos: se reconecta al volver.
    if (document.hidden) return;
    reintentos++;
    if (reintentos > 12) return error('No se pudo conectar con el mundo. Revisa tu conexión.', true);
    setTimeout(conectar, Math.min(8000, 600 * reintentos));
  };
}
// Al volver a la app (o recuperar la red), reconectar enseguida.
function volverAConectar() {
  if (document.hidden || (ws && ws.readyState <= 1)) return;
  if (fatal && !errorRed) return;
  if (fatal) { fatal = false; errorRed = false; cerrar('v-error'); }
  reintentos = 0; conectar();
}
let errorRed = false;
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
  if (document.hidden || fatal || !yo || !ws || ws.readyState !== 1) return;
  if (ahora - ultimoMsgT > 8000) {
    const viejo = ws; ws = null; conectado = false;
    try { viejo.close(); } catch (e) {}
    reintentos = 0; conectar();
  }
}, 2000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimoMsgT = performance.now(); });
addEventListener('focus', volverAConectar);
function error(txt, red) { fatal = true; errorRed = !!red; $('error-txt').textContent = txt; abrir('v-error'); }
setInterval(() => mandar({ t: 'ping', ts: Date.now() }), 20000);

// ── MENSAJES DEL SERVIDOR ──
let loginPend3 = null;   // premio diario guardado hasta que el jugador nuevo elija clase
function recibir(m) {
  switch (m.t) {
    case 'bienvenido':
      miId = m.id; yo = m.yo; reintentos = 0;
      // Se guarda el nombre final (el elegido o el que puso el servidor): la proxima vez entra directo.
      setTimeout(leyendaPrimeraVez, 2500);
      if (soyInvitado) { setTimeout(avisoInvitado, 20000); if (!avisoInvT) avisoInvT = setInterval(avisoInvitado, 60000); try { localStorage.setItem('dq_mmo_nombre', yo.nombre); } catch (e) {} }
      $('carga').style.display = 'none';
      cerrar('v-inicio');
      pintarHud();
      if (!yo.clase) abrirClases();
      // Al nuevo se le da la bienvenida cuando ya eligio clase (antes quedaba detras de esa ventana).
      if (m.nuevo) { const bienv = () => { if (!yo.clase || hayVentana()) return setTimeout(bienv, 1500); aviso('Bienvenido al mundo abierto, ' + yo.nombre + '. Tu primera misión ya está en marcha: sigue la luz amarilla.', 'ok'); }; bienv(); }
      break;
    case 'm3':
      P.x = m.x; P.z = m.z; P.y = alturaEn(P.x, P.z); P.vx = P.vz = P.vy = 0; P.corrX = P.corrZ = 0;
      for (const o of [...otros.keys()]) quitarOtro(o);
      for (const id of [...mons.keys()]) quitarMon(id);
      for (const id of [...zonas3.keys()]) quitarZona3(id);
      for (const p of proyectiles) escena.remove(p.mesh); proyectiles = []; impactos = [];
      objetivo = 0; objetivoP = 0; autoAtk = false; dueloCon = 0; colaHab = null; gcdHasta = 0;
      lanzando = null; $('lanzar').style.display = 'none'; quitarCorcho();
      if (P.vuela) volar(false); P.planea = false; cuevaInfo = null; zonaActual = '';
      camReal = camDist;
      pintarBarra(); pintarObjetivoP();
      for (const p of m.jugadores) agregarOtro(p);
      break;
    case 'yo': {
      const antes = yo; yo = m.yo;
      // Nueva mision de la cadena: el Guardia Tito cuenta por que importa.
      if (antes && antes.mis && yo.mis && yo.mis.i !== antes.mis.i && LORE_MISIONES[yo.mis.i]) setTimeout(() => aviso('🛡 Tito: «' + LORE_MISIONES[yo.mis.i] + '»'), 2500);
      if (antes && antes.nivel < 60 && yo.nivel >= 60) { aviso('🏆 ' + LORE_NIVEL60, 'ok'); setTimeout(() => aviso('🥤 Toca la barra morada de la chicha para reclamar tus 2 litros.', 'ok'), 5000); }
      ALAS_MAX = (ALAS[yo.ala] || ALAS.aprendiz).vuelo; if (!antes) P.alas = ALAS_MAX; alasPropias();
      ALAS_MAX && (P.alas = Math.min(P.alas, ALAS_MAX));
      if (antes && (yo.skin !== antes.skin || yo.clase !== antes.clase || yo.arma !== antes.arma || JSON.stringify(yo.look) !== JSON.stringify(antes.look))) cambiarSkinPropia();
      // Al elegir clase (antes '!antes' nunca se cumplia: 'bienvenido' ya trae yo).
      if (antes && !antes.clase && yo.clase && !yo.look) { let visto = false; try { visto = localStorage.getItem('dq3_look_visto') === '1'; } catch (e) {} if (!visto) { const intentar = n => { if (!hayVentana() && !$('v-diario').classList.contains('on')) abrirLook(); else if (n < 20) setTimeout(() => intentar(n + 1), 1500); }; setTimeout(() => intentar(0), 1500); } }
      if (yo.muerto && !(antes && antes.muerto) && !P.muerto) morir();   // tras 'muerte' no borra su texto
      if (!yo.muerto) { cerrar('v-muerte'); P.muerto = false; }
      if (yo.clase) cerrar('v-clase');
      if (yo.clase && loginPend3) { const lp = loginPend3; loginPend3 = null; setTimeout(() => mostrarDiario(lp), 900); }
      pintarHud(); marcaPase();
      refrescarVentanas(true);
      break;
    }
    case 's3': foto(m); break;
    case 'pj3': agregarOtro(m.p); break;
    case 'pl': quitarOtro(m.id); break;
    case 'pa': { const o = otros.get(m.p); if (o) { const cambia = o.sk !== m.sk || o.cl !== (m.cl || '') || o.ar !== (m.ar || 'katana') || JSON.stringify(o.lk) !== JSON.stringify(m.lk || null); Object.assign(o, { sk: m.sk, cl: m.cl || '', ar: m.ar || 'katana', mo: m.mo || '', lk: m.lk || null, al: m.al || '', fc: m.fc || '', ra: m.ra || 0, hn: m.hn || '', hc: m.hc || 0, gm: m.gm || 0, ti: m.ti || '' }); if (cambia) rehacerFiguraOtro(o); } break; }
    case 'mundial3': mundial3 = { ...m, recibido: Date.now() }; break;
    case 'mmx3': { const o = mons.get(m.id); if (o) { o.mx = m.mx; o.hp = m.hp; } break; }   // el jefe mundial crece si llegan mas a pelear
    case 'asedio': asedio = m; if (m.activo) asedioHp = asedioHp || { p: 100, g: 100 }; else asedioHp = null; if (abismo) abismo.dueno(m.dueno); break;
    case 'enc': {
      const antes = encargos, nuevos = m.l || {};
      // Desde el segundo 'enc' (el primero es el estado al entrar): con {} vacio tambien, para el primer hito del novato.
      if (encRecibido) for (const k in nuevos) if (nuevos[k] === true && antes[k] !== true) {
        const [zk, tipo] = k.split(':');
        if (tipo === 'hito' && LORE_HITOS[zk]) aviso('✨ ' + LORE_HITOS[zk], 'ok');
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
      const y = alturaEn(m.x, m.z) + 0.18;
      const disco = new THREE.Mesh(new THREE.CircleGeometry(m.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.12, depthWrite: false }));
      const borde = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.35, m.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.9, depthWrite: false }));
      disco.position.set(m.x, y, m.z); borde.position.set(m.x, y + 0.01, m.z);
      escena.add(disco, borde);
      zonas3.set(m.id, { disco, borde, x: m.x, z: m.z, r: m.r, ini: performance.now(), ms: m.ms });
      if (Math.hypot(P.x - m.x, P.z - m.z) < m.r + 3) aviso('¡Pisotón! Sal del círculo rojo.', 'err');
      break;
    }
    case 'zona3f': quitarZona3(m.id, true); break;
    case 'md3': { const o = mons.get(m.id); if (o) { o.muereT = performance.now(); o.st = 3; sfx('muerte', 0.3); if (Math.hypot(o.x - P.x, o.z - P.z) < 30) sfxK(Math.random() < 0.7 ? 'c_hurt' : 'c_grito', 0.28); const y = (o.y || alturaEn(o.x, o.z)) + 1; FX.emitir(o.x, y, o.z, { n: 30, color: '#c084fc', vel: 5, vida: 0.9, grav: 3, sube: 1.5 }); FX.emitir(o.x, y, o.z, { n: 14, color: '#fde68a', vel: 1.6, vida: 1.4, grav: -2, tam: 0.8 }); } if (objetivo === m.id) { objetivo = 0; autoAtk = false; pintarBarra(); } break; }
    case 'at3': ataqueVisto(m); break;
    case 'ph': golpeJugador(m); break;
    case 'b3': { const o = mons.get(m.de), q = m.a === miId ? P : otros.get(m.a); if (o && q) proyectil(o, q, '#c084fc'); break; }
    case 'muerte': morir(m); break;
    case 'tp3': case 'snap3':
      if (m.t === 'snap3' && Math.hypot(m.x - P.x, m.z - P.z) < 4) { P.corrX = m.x - P.x; P.corrZ = m.z - P.z; P.vx *= 0.5; P.vz *= 0.5; break; }
      P.x = m.x; P.z = m.z; P.y = (m.t === 'snap3' && P.vuela) ? Math.max(P.y, alturaEn(m.x, m.z) + 0.5) : alturaEn(P.x, P.z); P.corrX = P.corrZ = 0; P.vx = P.vz = 0;
      if (m.t === 'tp3' && !m.carga) { if (P.vuela) volar(false); P.vy = 0; P.planea = false; camReal = camDist; caidaEnviada = false; }
      if (m.t === 'tp3' && m.abismo !== undefined) { zonaActual = ''; objetivo = 0; autoAtk = false; pintarBarra(); if (m.abismo) aviso('🌌 Entre las islas solo se pasa volando (' + K('V', 'VOLAR') + ') o planeando (' + K('mantén Espacio', 'mantén SALTO') + '). Las columnas de viento celestes recargan tus alas. ¡No caigas al vacío!', 'ok'); }
      if (m.t === 'tp3' && m.cueva !== undefined) {
        cuevaInfo = m.cueva;
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
      vib('success'); sfxK('monedas', 0.45);
      aviso(`🧰 ¡${(NOMBRE_COFRE[m.tipo] || 'cofre').replace(/^./, x => x.toUpperCase())} abierto! +${m.oro} oro${m.pociones ? ` · +${m.pociones} pociones` : ''}${m.item ? ' · ' + m.item : ''}`, 'ok');
      break;
    }
    case 'temp3': temp3 = m; pintarRankPanel(); break;
    case 'tempFin': mostrarTempFin(m); break;
    case 'inv3': invasion3 = m.on ? { ...m, recibido: Date.now() } : null; pintarMisiones(); break;
    case 'cofre3': if (cueva) { cueva.cofre.visible = true; cueva.tapa.rotation.x = 0; } sfx('moneda', 0.6); break;
    case 'logro': aviso('🏅 Logro: ' + m.titulo + ' · +' + (m.oro || 0).toLocaleString('es') + ' oro (llévalo como título desde ' + (MOVIL ? '⋯ → 🏆' : '🏆 Logros') + ')', 'ok'); sfx('moneda', 0.4); FX.emitir(P.x, P.y + 1.5, P.z, { n: 30, color: '#ffd84a', vel: 4, vida: 1, grav: -1 }); break;
    case 'gana':
      if (m.xp) numero(P.x, P.y + 2.6, P.z, '+' + m.xp + ' XP', '#c084fc');
      if (m.oro) { numero(P.x + 0.6, P.y + 2.2, P.z, '+' + m.oro + ' oro', '#ffd84a'); sfxK('monedas', 0.3); }
      if (m.chi) numero(P.x - 0.6, P.y + 2.4, P.z, '+' + m.chi + ' 🥤', '#e9b8ff');   // puntos de chicha (en 3D no se veian)
      if (m.item) vib('success');
      // Botin con su nombre y rareza (antes siempre decia "equipo nuevo", tambien si se vendio por bolsa llena).
      if (m.item) aviso('Botín: ' + (m.item.r !== undefined && RAREZAS[m.item.r] ? RAREZAS[m.item.r].nombre + ' · ' : '') + (m.item.nombre || nombreItem(m.item)) + (m.item.vendido ? ' (bolsa llena: vendido)' : ' (' + K('pulsa I', 'toca 🎒') + ' para verlo)'), 'ok');
      break;
    case 'lv': if (m.p === miId) { aviso('¡Subiste al nivel ' + m.lv + '!', 'ok'); numero(P.x, P.y + 3, P.z, 'NIVEL ' + m.lv, '#ffe600', true); subiNivel(m.lv); } else { const o = otros.get(m.p); if (o) o.lv = m.lv; } break;
    case 'toast': aviso(m.m, m.ok ? 'ok' : ''); break;
    // mTON ganados aqui (jefes, jefe mundial, caza del dia): antes no se avisaba nada en ORIGINS
    case 'mton': { if (yo) yo.mton = m.total; const por = { jefe: 'por el jefe', mundial: 'por el jefe mundial', diaria: 'por la caza del día' }[m.motivo]; aviso('💎 +' + m.n + ' mTON (tienes ' + ((m.total || 0) / 1000).toLocaleString('es', { maximumFractionDigits: 3 }) + ' TON)' + (por ? ' — ' + por : ''), 'ok'); numero(P.x, P.y + 3, P.z, '+' + m.n + ' mTON', '#00eeff'); sfx('moneda', 0.5); break; }
    case 'aviso': aviso(m.m); break;
    case 'no':
      if (lanzando && lanzando.pre) lanzando = null;   // el lanzamiento previsto no empezo
      // "Fuera de alcance" se avisa como mucho una vez cada 3 s (el auto-ataque reintenta solo).
      if (m.m === 'Fuera de alcance.') { if (performance.now() - avisoAlcT < 3000) break; avisoAlcT = performance.now(); }
      aviso(m.m, 'err'); break;
    case 'amigos': if (m.ref) refAmigo = m.ref; break;
    case 'login': if (yo && yo.clase) mostrarDiario(m); else loginPend3 = m; break;
    case 'tareas': if (yo) { yo.tareas = m; pintarMisiones(); } break;
    case 'mae': if (yo) { yo.mae = m.n; aviso(`⭐ ¡Maestría ${m.n}!`, 'ok'); numero(P.x, P.y + 3, P.z, 'MAESTRÍA ' + m.n, '#ffd84a', true); subiNivel(0); pintarHud(); } break;
    case 'herm': hermInfo = m.h; if (yo) yo.herm = m.h ? m.h.id : null; pintarHerm(); break;
    case 'hermInv':
      invitTipo = 'herm';
      $('invit3-t').textContent = `🛡️ ${m.de} te invita a la hermandad <${m.nombre}>.`;
      $('invit3').style.display = 'block'; vib('medium');
      clearTimeout(invitT); invitT = setTimeout(() => { $('invit3').style.display = 'none'; }, m.ms || 60000);
      break;
    case 'pase': if (yo) { yo.pase = m.pase; pintarPase(); } break;
    case 'yoC': if (yo) { Object.assign(yo, m.yo); pintarHud(); refrescarVentanas(); } break;
    case 'atkNo': sigAtk = performance.now() + 150; break;
    case 'habNo': gcdHasta = 0; break;
    case 'chat': lineaChat(m); break;
    case 'grupo': grupo3 = m.g; pintarGrupo(); pintarAmigos3(); break;
    case 'contactos': contactos3 = m.l || []; pintarAmigos3(); pintarObjetivoP(); break;
    case 'quien': quien3 = m.r || []; pintarAmigos3(); break;
    // Alas agotadas segun el servidor: a planear (antes caia en picado, mortal sobre el vacio).
    // Lanzamiento de un jefe (Sorbo del Cantaro): barra en su marco y aviso sobre su cabeza.
    case 'mcast': {
      const o = mons.get(m.id); if (!o) break;
      const nom = (MONSTRUOS[o.k] || {}).nombre || 'El jefe';
      if (m.ms > 0) { o.cast = { ini: performance.now(), fin: performance.now() + m.ms, n: m.n || 'Hechizo' }; if (objetivo === m.id || Math.hypot(o.x - P.x, o.z - P.z) < 25) aviso(`🥤 ${nom} lanza ${o.cast.n}: ¡interrúmpelo!`, 'err'); }
      else {
        o.cast = null;
        if (m.cortado && Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`✋ ¡${nom} no pudo beber: lanzamiento interrumpido!`, 'ok');
        if (m.cura) { if (m.hp) o.hp = m.hp; if (Math.hypot(o.x - P.x, o.z - P.z) < 30) aviso(`🥤 ${nom} bebió chicha robada y se curó. Córtalo con Patada, Zurrar, Contrahechizo, Silencio o un aturdimiento.`); }
      }
      break;
    }
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
      break;
    case 'atp3': { const de = m.p === miId ? P : otros.get(m.p), a = m.tg === miId ? P : otros.get(m.tg); if (de && !(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (de && a && m.v) proyectil(de, a, '#f0abfc'); break; }
    case 'nodos3': for (const [i, ms] of m.l) { if (!NODOS[i]) continue; nodoListo.set(i, performance.now() + ms); mostrarNodo(NODOS[i], false); } break;
    case 'recogido3': if (NODOS[m.i]) { nodoListo.set(m.i, performance.now() + m.en); mostrarNodo(NODOS[m.i], false); sfx('moneda', 0.3); } break;
    case 'reto': case 'invitacion': {
      invitTipo = m.t === 'reto' ? 'duelo' : 'grupo';
      $('invit3-t').textContent = m.t === 'reto' ? `⚔️ ${m.de} (Nv ${m.nv}) te reta a un duelo.` : `${m.de} (Nv ${m.nv}) te invita a su grupo.`;
      $('invit3').style.display = 'block';
      clearTimeout(invitT); invitT = setTimeout(() => { $('invit3').style.display = 'none'; }, m.ms || 30000);
      sfx('boton', 0.4);
      break;
    }
    case 'cd':
      if (String(m.id).startsWith('h_')) cdHab[m.id.slice(2)] = { fin: performance.now() + m.hasta, ms: m.hasta };
      else cdPoder[m.id] = performance.now() + m.hasta;
      break;
    case 'pedidoSol': case 'factura': V.alPedido(m); break;
    case 'pw': if (m.p === miId) sfx(m.i === 2 ? 'explosion' : 'boton', 0.4); break;
    case 'cast':
      if (m.p === miId) { lanzando = { id: m.id, ini: performance.now(), fin: performance.now() + m.ms }; $('lanzar').style.display = 'block'; $('lanzar-t').textContent = m.id === 'montar' ? 'Invocar montura' : m.id === 'recolectar' ? 'Recolectando…' : m.id === 'pescar' ? 'Pescando… (' + K('E', '¡TIRAR!') + ' para tirar cuando pique)' : (habPorId(m.id) || {}).nombre || '';
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
    case 'ranking': rankDatos = m; if (npcAbierto === 'ranking') pintarRanking(m.r); pintarRankPanel(); break;
    case 'err':
      // En Telegram no se cae en silencio a un invitado nuevo de nivel 1 (la sesion de mas de 24 h caduca): se pide reabrir.
      if (m.auth && m.auth !== 'inv' && TG) { error('Tu sesión de Telegram caducó. Cierra el juego y vuelve a abrirlo desde el bot: entrarás con tu duende.'); return; }
      if (m.auth && m.auth !== 'inv' && !forzarInvitado) { forzarInvitado = true; aviso('No pudimos verificar tu cuenta: entras como invitado.', 'err'); return; }
      if (m.fatal) {
        error(m.m || 'Desconectado.');
        // Inactividad: tocar o pulsar una tecla vuelve a entrar (lo promete el aviso; antes no hacia nada).
        if (m.inactivo) { const volver = () => { removeEventListener('pointerdown', volver, true); removeEventListener('keydown', volver, true); location.reload(); }; setTimeout(() => { addEventListener('pointerdown', volver, true); addEventListener('keydown', volver, true); }, 500); }
      }
      break;
  }
}

// ── JUGADORES Y MONSTRUOS ──
let lookEditor = null;
const lookYo = () => lookEditor || (yo && yo.look) || LOOK_BASE;
const claveYo = () => yo.skin + '|' + (yo.clase || '') + '|' + (yo.arma || '') + '|' + JSON.stringify(lookYo());
async function cambiarSkinPropia() {
  if (!yo) return;
  const clave = claveYo();
  if (P.cargando === clave || (P.fig && P.skin === clave)) return;
  P.cargando = clave;
  const f = figuraModelo(() => crearDuende({ skin: yo.skin, clase: yo.clase || null, arma: yo.arma || 'katana', look: lookYo() })) || await figuraJugador(yo.skin);
  P.cargando = '';
  if (!f) return;
  if (P.fig) P.fig.quitar();
  P.fig = f; P.skin = clave;
}
async function agregarOtro(p) {
  if (!p || p.id === miId || p.p === miId) return;
  const id = p.id || p.p;
  quitarOtro(id);
  const o = { id, x: p.x, z: p.z, tx: p.x, tz: p.z, ry: p.r || 0, a: 0, hp: p.hp, mx: p.mx, n: p.n, lv: p.lv, cl: p.cl || '', sk: p.sk || 'comun', ar: p.ar || 'katana', mo: p.mo || '', lk: p.lk || null, al: p.al || '', fc: p.fc || '', ra: p.ra || 0, hn: p.hn || '', hc: p.hc || 0, gm: p.gm || 0, ti: p.ti || '', muerto: !!p.muerto, fig: null, lbl: etiqueta('pj'), f: 1 };
  otros.set(id, o);
  rehacerFiguraOtro(o);
}
async function rehacerFiguraOtro(o) {
  const f = figuraModelo(() => crearDuende({ skin: o.sk, clase: o.cl || null, arma: o.ar || 'katana', look: o.lk || LOOK_BASE })) || await figuraJugador(o.sk);
  if (!otros.has(o.id)) { if (f) f.quitar(); return; }
  if (o.fig) o.fig.quitar();
  o.fig = f;
}
function quitarOtro(id) { const o = otros.get(id); if (!o) return; if (objetivoP === id) objetivoP = 0; if (o.fig) o.fig.quitar(); if (o.alas) quitarAlas(o.alas); o.lbl.remove(); otros.delete(id); }
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
    if (st === 3 && !o.muereT) { o.muereT = performance.now(); if (objetivo === id) { objetivo = 0; autoAtk = false; pintarBarra(); } }
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
  const k = Math.min(1.2, (t - o.t0) / o.dur);
  o.x = o.px + (o.tx - o.px) * k; o.z = o.pz + (o.tz - o.pz) * k;
  if (k >= 1.2) { o.vx = o.vz = 0; }
}
function ataqueVisto(m) {
  const o = mons.get(m.tg);
  if (!o) return;
  const de = m.p === miId ? P : otros.get(m.p);
  if (de) { if (!(de === P && performance.now() - P.atkT < 350)) de.atkT = performance.now(); if (m.v) proyectil(de, o, CLASES[(m.p === miId ? yo.clase : de.cl)] ? CLASES[(m.p === miId ? yo.clase : de.cl)].color : '#fff'); }
  if (m.d > 0) o.hp = Math.max(0, o.hp - m.d);
  if (m.d > 0 && Math.hypot(o.x - P.x, o.z - P.z) < 45) FX.emitir(o.x, (o.y || alturaEn(o.x, o.z)) + 1.1, o.z, { n: m.c ? 24 : 10, color: m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff1c1', vel: m.c ? 6.5 : 4, vida: 0.45 });
  if (m.p === miId || o.id === objetivo) {
    numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, (m.c ? '¡' : '') + m.d + (m.c ? '!' : ''), m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff', m.c);
    if (m.p === miId) { vib(m.c ? 'medium' : 'light'); sfx(m.c ? 'corte2' : 'corte', 0.28); sfxK(m.c ? 'g_critico' : 'g_carne', m.c ? 0.4 : 0.3); if (m.c) sacudir = Math.max(sacudir, 0.15); }
  }
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
  if (m.d > 0) { numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.3, q.z, '-' + m.d, '#ff5a6a'); FX.emitir(q.x, (q.y || alturaEn(q.x, q.z)) + 1.1, q.z, { n: 8, color: '#ff4d5e', vel: 3.5, vida: 0.4 }); }
  if (m.esq && m.p === miId) numero(P.x, P.y + 2.3, P.z, 'Esquiva', '#7dd3fc');
  // Sin objetivo, quien te pega pasa a serlo: su marco dice quien es y el
  // ataque (1 o Z) y las habilidades van contra el.
  if (mo && m.p === miId && !mo.muereT && !objetivo && !objetivoP && !P.muerto) { objetivo = mo.id; pintarBarra(); }
  if (mo && m.p === miId && performance.now() - (mo.vozT || 0) > 5000 && Math.random() < 0.6) { mo.vozT = performance.now(); sfxK(vozDe(mo.k), 0.3); }
  if (m.p === miId) { P.heridoT = performance.now(); if (m.d > 0) vib('rigid'); sfxK('g_carne', 0.22); if (yo && m.d > 0) { herida(m.d, mo); yo.hp = Math.max(0, yo.hp - m.d); pintarVida(); } }
}
let impactos = [];
let asedio = null, asedioHp = null, tirosAsedio = [];
let proyectiles = [], efectos = [], lanzando = null, objetivoP = 0, mundial3 = null, sacudir = 0, grupo3 = null;
const zonas3 = new Map();
function quitarZona3(id, explota) {
  const z = zonas3.get(id); if (!z) return;
  escena.remove(z.disco, z.borde);
  for (const o of [z.disco, z.borde]) { o.geometry.dispose(); o.material.dispose(); }
  zonas3.delete(id);
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
  if (m.p === miId) { sfx(AREA[m.id] ? 'explosion' : 'corte2', 0.35); if (m.cp) aviso('Eviscerar con ' + m.cp + ' puntos de combo', 'ok'); }
}
const NOMBRE_AURA = { grito: 'Grito', muro: 'Muro', bloque: 'Hielo', escudoPoder: 'Escudo', renovar: 'Renovar', supresion: 'Supresión', evasion: 'Evasión', sigilo: 'Sigilo', aturdido: 'Aturdido', almaDebil: 'Alma débil' };
function pintarAuras() {
  const ahora = performance.now();
  const l = Object.entries(P.au || {}).filter(([a, fin]) => fin > ahora && NOMBRE_AURA[a]);
  const html = l.map(([a, fin]) => `<span>${NOMBRE_AURA[a]}${fin !== Infinity ? ' ' + Math.ceil((fin - ahora) / 1000) + 's' : ''}</span>`).join('');
  if ($('auras')._h !== html) { $('auras').innerHTML = html; $('auras')._h = html; }
  if (mundial3) {
    const def = MONSTRUOS[mundial3.k] || {};
    const desfase = Date.now() - mundial3.recibido;
    const ms = mundial3.vivo ? mundial3.hasta - Date.now() : mundial3.en - Date.now();
    const mmss = ms > 0 ? Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') : '';
    const txt = mundial3.vivo ? `👹 ¡${def.nombre} en el ${ARENA3D.nombre}! ${mmss}` : ms > 0 && ms < 30 * 60000 ? `👹 ${def.nombre}: ${mmss}` : '';
    if ($('mundial')._h !== txt) { $('mundial').textContent = txt; $('mundial')._h = txt; }
    void desfase;
  }
  // El marco del grupo va justo debajo del propio (que crece con auras y avisos).
  if (grupo3 && !COMPACTO) { const mc = $('marco'); $('grupo3').style.top = (mc.offsetTop + mc.offsetHeight + 8) + 'px'; }
  // Movil: misiones y chat apilados bajo el marco (que crece con auras y avisos).
  if (COMPACTO) {
    const mc = $('marco'); let y = mc.offsetTop + mc.offsetHeight + 6;
    // Hasta donde empieza el joystick (movil) o la barra de acciones (compacto con raton).
    const tope = MOVIL ? $('joy').getBoundingClientRect().top : $('barra').getBoundingClientRect().top - 8;
    for (const id of ['alas', 'objp', 'grupo3', 'misiones', 'chat']) {   // (el objetivo va arriba al centro)
      const e = $(id); let h = e.offsetHeight; if (!h) continue;
      e.style.top = y + 'px'; e.style.bottom = 'auto';
      if (id === 'misiones') {   // cerrada se recorta antes del joystick: con grupo y objetivo el pulgar que iba a caminar la abria
        const abierta = e.classList.contains('abierto'), sitio = Math.floor(tope - e.offsetTop - 4);
        const mh = !abierta && sitio < (e.classList.contains('con-tuto') ? 76 : 50) ? Math.max(28, sitio) + 'px' : '';   // su alto cerrado en movil (index.html)
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
      FX.emitir(s.b.x, s.b.y, s.b.z, { n: 20, color: '#8a8094', vel: 4, vida: 1.2, grav: 3, tam: 2 });
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
  // Golpe sordo al caer (una sola vez aunque lleguen 'muerte' y 'yo' seguidos).
  if (!P.muerto) sfx('caida', 0.55);
  vib('error');
  if (P.vuela) volar(false);
  P.planea = false; P.planeoAuto = false; P.vx = P.vz = 0; colaHab = null;
  P.muerto = true; autoAtk = false;
  // En el Abismo se revive en el bastion de tu faccion (como revivir3d).
  const dondeRev = enAbismo(P.x) && yo && yo.faccion ? 'Revives en tu bastión.' : 'Revives en el pueblo.';
  $('muerte-txt').textContent = (m && m.golpes && m.golpes.length ? 'Te derribó: ' + m.golpes.map(g => g.n).filter((v, i, l) => l.indexOf(v) === i).slice(0, 2).join(', ') + '. ' + dondeRev : dondeRev) + (m && m.pvp ? ' Ante la otra facción no pierdes experiencia.' : '') + (m && m.rep > 0 ? ' Reparar tu equipo cuesta ' + m.rep + ' oro.' : '');
  abrir('v-muerte');
}
// La ventana se cierra cuando el servidor confirma (llega 'yo' vivo): sin conexion no te quedas muerto y sin boton.
$('b-revivir').onclick = () => { if (!ws || ws.readyState !== 1) return aviso('Sin conexión: reconectando… vuelve a intentarlo en un momento.', 'err'); mandar({ t: 'revivir' }); };

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
  let h = `<img src="/assets/lore/chicha-duende-playa.jpg" alt="" style="display:block;width:100%;max-height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px">`;
  if (soyInvitado) h += `<p class="vv-p" style="color:#fca5a5">Juegas como invitado: los premios de chicha se reclaman entrando con Telegram (@duendequest_bot), con tu mismo duende.</p>`;
  h += `<p class="vv-p" style="text-align:center;font-size:20px;color:#fde68a;margin:4px 0">${(ch.p || 0).toLocaleString('es')} puntos de chicha</p><p class="vv-p" style="text-align:center;font-size:12px">Hoy ${ch.hoy || 0}/${CHICHA.porDia} · desde nivel ${CHICHA.nvPuntos}: 1 punto por monstruo, 3 si es de tu nivel, 25 un jefe.</p>`;
  h += fila('nv60', `Nivel ${CHICHA.nv60}: ${CHICHA.litros60} litros`, `Llega a nivel ${CHICHA.nv60} y te llevas ${CHICHA.litros60} litros a tu casa (Nv ${nv}/${CHICHA.nv60}).`, Math.min(100, Math.round(nv / CHICHA.nv60 * 100)), nv >= CHICHA.nv60);
  for (const meta of CHICHA.niveles) h += fila(meta, `${meta.toLocaleString('es')} puntos: 1 litro`, 'Un litro de chicha morada peruana enviado a tu casa.', Math.min(100, Math.round((ch.p || 0) / meta * 100)), (ch.p || 0) >= meta);
  h += `<p class="vv-p" style="font-size:11px;color:var(--txt2)">Promoción gratuita: no hay que comprar nada. Para reclamar: nivel ${CHICHA.nvReclamo}, personaje de 2 días y Telegram. El equipo te escribe por Telegram para la dirección; nunca te pediremos pagos ni contraseñas.</p><button class="btn sec" id="chi-leyenda" style="width:100%">📜 La leyenda del Cántaro</button>`;
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
function pintarHud() {
  if (!yo) return;
  const cl = CLASES[yo.clase];
  $('m-nombre').textContent = (yo.dios ? 'GM ' : '') + yo.nombre;
  $('m-nivel').textContent = 'Nv ' + yo.nivel + (yo.mae ? ' ★' + yo.mae : '') + (cl ? ' · ' + cl.nombre : '');
  $('oro').textContent = Number(yo.oro || 0).toLocaleString('es') + ' oro';
  $('m-rec').style.display = cl ? '' : 'none';
  if (cl) $('m-rec').firstElementChild.style.background = RECURSOS[cl.recurso].color;
  $('xp').firstElementChild.style.transform = `scaleX(${clamp(yo.xp / (yo.xpSig || xpParaSubir(yo.nivel)), 0, 1)})`;
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
  if (yo.recMax) { rc.firstElementChild.style.transform = `scaleX(${clamp((yo.rec || 0) / yo.recMax, 0, 1)})`; rc.lastElementChild.textContent = Math.round(yo.rec || 0) + ' / ' + yo.recMax; }
}
const cdPoder = {}, cdHab = {};
let gcdHasta = 0, misHabs = [];
function pintarBarra() {
  if (!yo) return;
  const b = $('barra');
  const clave = (yo.clase || '') + ':' + yo.nivel;
  if (b.dataset.hecho !== clave) {
    b.dataset.hecho = clave;
    b.innerHTML = '';
    misHabs = yo.clase ? habsDe(yo.clase).slice(0, 8) : [];
    const atk = document.createElement('button'); atk.className = 'acc'; atk.id = 'acc-atk';
    atk.innerHTML = '<span class="t">1</span><img src="' + A + 'armas/katana_comun_item.png" alt=""><span class="cd"></span>';
    atk.title = 'Ataque automático (1 o Z)';
    atk.setAttribute('aria-label', atk.title);
    atk.onclick = () => { if (MOVIL) avisoPrimeraVez(atk.title); alternarAtaque(); };
    b.appendChild(atk);
    let bloqueadas = 0;
    misHabs.forEach((h, i) => {
      if (yo.nivel < h.nv && ++bloqueadas > 1) return;   // menos ruido: solo la proxima por aprender
      const d = document.createElement('button'); d.className = 'acc' + (yo.nivel < h.nv ? ' bloq' : ''); d.dataset.hab = h.id;
      d.innerHTML = `<span class="t">${i + 2}</span><img src="${A}items/equipo/${h.icono}.png" alt="">${yo.nivel < h.nv ? '<span class="lv">Nv ' + h.nv + '</span>' : ''}<span class="cd"></span><span class="cs"></span>`;
      d.title = h.nombre + ' (' + (i + 2) + ') — ' + h.desc;
      d.setAttribute('aria-label', d.title);
      // Bloqueada no: usarHab ya avisa del nivel y de lo que hace
      d.onclick = () => { if (MOVIL && yo && yo.nivel >= h.nv) avisoPrimeraVez(d.title); usarHab(h); };
      b.appendChild(d);
    });
    PODERES.forEach((p, i) => {
      const d = document.createElement('button'); d.className = 'acc'; d.dataset.pw = p.id;
      d.innerHTML = `<span class="t">${p.tecla}</span><img src="${A}items/${p.icono}.png" alt=""><span class="n"></span><span class="cd"></span><span class="cs"></span>`;
      d.title = p.nombre + ' (' + p.tecla + ') — ' + p.desc;
      d.setAttribute('aria-label', d.title);
      d.onclick = () => { if (MOVIL) avisoPrimeraVez(d.title); usarPoder(i); };
      b.appendChild(d);
    });
  }
  $('acc-atk').classList.toggle('on', autoAtk);
  // En movil la barra no lleva el boton de ataque: ATACAR muestra si el automatico esta puesto.
  if (MOVIL) { const ta = $('t-atk'); if (ta.classList.contains('on') !== autoAtk) { ta.classList.toggle('on', autoAtk); ta.textContent = autoAtk ? 'PARAR' : 'ATACAR'; } }
  b.querySelectorAll('[data-pw]').forEach(d => { d.querySelector('.n').textContent = (yo.pw && yo.pw[d.dataset.pw]) || 0; });
}
function pintarCds() {
  const ahora = performance.now();
  $('barra').querySelectorAll('[data-hab]').forEach(d => {
    const h = habPorId(d.dataset.hab), c = cdHab[h.id];
    let k = c && c.fin > ahora ? (c.fin - ahora) / c.ms : 0;
    if (h.gcd !== false && gcdHasta > ahora) k = Math.max(k, (gcdHasta - ahora) / GCD_MS);
    d.querySelector('.cd').style.transform = `scaleY(${k})`;
    // Segundos que faltan (como en CLASSIC), solo si queda mas de 1,5 s.
    const cs = d.querySelector('.cs'), s = c && c.fin - ahora > 1500 ? String(Math.ceil((c.fin - ahora) / 1000)) : '';
    if (cs && cs.textContent !== s) cs.textContent = s;
    const sin = yo && yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec);
    d.style.filter = sin && yo.nivel >= h.nv ? 'grayscale(.8) brightness(.7)' : '';
  });
  $('barra').querySelectorAll('[data-pw]').forEach(d => {
    const p = PODERES.find(x => x.id === d.dataset.pw), fin = cdPoder[p.id] || 0;
    d.querySelector('.cd').style.transform = `scaleY(${fin > ahora ? (fin - ahora) / p.cd : 0})`;
    const cs = d.querySelector('.cs'), s = fin - ahora > 1500 ? String(Math.ceil((fin - ahora) / 1000)) : '';
    if (cs && cs.textContent !== s) cs.textContent = s;
  });
}
let objPintado = '';
function pintarObjetivo() {
  const o = mons.get(objetivo);
  const caja = $('obj');
  if (!o) { if (objPintado !== '-') { caja.style.display = 'none'; anillo.visible = false; objPintado = '-'; } return; }
  const clave = o.id + '|' + Math.ceil(o.hp) + '|' + o.mx + '|' + (yo ? yo.nivel : 0);
  if (clave !== objPintado) {
    objPintado = clave;
    const def = MONSTRUOS[o.k];
    caja.style.display = 'block';
    $('o-nombre').textContent = (o.j ? '★ ' : '') + def.nombre;
    $('o-nivel').textContent = marcaNivel(o.nv) + 'Nv ' + o.nv;
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
function aviso(txt, tipo) {
  const d = document.createElement('div'); d.textContent = txt; if (tipo) d.className = tipo;
  avisos.appendChild(d);
  while (avisos.children.length > 4) avisos.firstChild.remove();
  setTimeout(() => d.remove(), Math.min(12000, Math.max(4500, String(txt).length * 60)));   // los largos (lore, premios) se leen enteros
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
let contactos3 = [], quien3 = null;   // ventana 👥: tus amigos y quien esta en linea (null: aun no llego)
const enGrupo = id => !!(grupo3 && grupo3.m.some(x => x.on && x.id === id));
let salirPend = 0;   // "Salir del grupo" pide dos toques: el pulgar que iba al joystick lo pulsaba sin querer
function pintarGrupo() {
  const c = $('grupo3');
  if (!grupo3) { c.style.display = 'none'; c.innerHTML = ''; return; }
  c.style.display = 'block';
  const lider = grupo3.lider;
  c.innerHTML = `<div style="font:700 10px var(--sans);color:var(--txt3);margin-bottom:3px">${grupo3.banda ? 'BANDA' : 'GRUPO'}</div>` + grupo3.m.filter(x => x.id !== miId).map(x => {
    const cl = CLASES[x.cl];
    const fuera = !x.on || x.k !== '~3d';
    return `<span class="mi${fuera ? ' lejos' : ''}${x.id === objetivoP ? ' sel' : ''}" data-id="${x.id || 0}"><b style="color:${cl ? cl.color : '#fff'}">${x.uid === lider ? '👑 ' : ''}${esc(x.n)}</b> <small>Nv${x.lv || '?'}${!x.on ? ' · desconectado' : x.k !== '~3d' ? ' · en el 2D' : x.muerto ? ' · ☠' : ''}</small>`
      + (x.on ? `<div class="barra hp"><i style="transform:scaleX(${clamp((x.hp || 0) / (x.mx || 1), 0, 1).toFixed(2)})"></i></div>` : '') + '</span>';
  }).join('') + '<button class="btn sec salir" id="g-salir">' + (Date.now() - salirPend < 4000 ? '¿Seguro? Toca otra vez' : 'Salir del grupo') + '</button>';
  c.querySelectorAll('.mi').forEach(e => e.onclick = () => { const id = +e.dataset.id; if (id && otros.has(id)) { objetivoP = id; pintarObjetivoP(); pintarGrupo(); } });
  $('g-salir').onclick = () => {
    if (Date.now() - salirPend < 4000) { salirPend = 0; mandar({ t: 'salirGrupo' }); return; }
    salirPend = Date.now(); pintarGrupo(); setTimeout(() => { if (Date.now() - salirPend >= 4000) pintarGrupo(); }, 4100);
  };
}
function pintarObjetivoP() {
  const o = otros.get(objetivoP);
  const caja = $('objp');
  if (!o || objetivo) { caja.style.display = 'none'; return; }
  caja.style.display = 'block';
  const cl = CLASES[o.cl];
  const ene = enemigoP(o.id);
  $('op-nombre').textContent = (ene ? '⚔ ' : '') + o.n; $('op-nombre').style.color = ene ? '#ff4d4d' : cl ? cl.color : '#fff';
  $('op-nivel').textContent = 'Nv ' + o.lv + (cl ? ' · ' + cl.nombre : '');
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
  else { const b = document.createElement('b'); b.textContent = (m.canal === 'grupo' ? '[Grupo] ' : m.canal === 'susurro' ? '[Susurro] ' : m.canal === 'hermandad' ? '[Hermandad] ' : '') + (m.gm ? '[GM] ' : '') + m.n + ': '; b.style.color = m.gm ? '#ffd84a' : (CLASES[m.cl] ? CLASES[m.cl].color : '#fff'); d.appendChild(b); d.appendChild(document.createTextNode(m.m)); }
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
}

// ── VENTANAS ──
function abrir(id) {
  if (!$(id).classList.contains('on')) sfxK('libro', 0.14);
  if (LATERALES.includes(id)) for (const o of LATERALES) if (o !== id && $(o) && $(o).classList.contains('on')) cerrar(o);
  $(id).classList.add('on');
  if (!LATERALES.includes(id)) for (const k in teclas) teclas[k] = false;
}
function cerrar(id) {
  // El editor de apariencia cerrado por otra via (Atras de Telegram, ✕): la camara vuelve y se descarta la prueba.
  if (id === 'v-look' && camAntes) { ({ camYaw, camPitch, camDist } = camAntes); camAntes = null; lookEditor = null; cambiarSkinPropia(); }
  $(id).classList.remove('on'); if (id === 'v-npc') npcAbierto = '';
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
    cu.innerHTML = '<button class="btn" id="n-tienda" style="width:100%;margin-bottom:8px">Ver toda la tienda: armas, forja, skins, monturas…</button><p>Consumibles para el camino:</p>' + PODERES.map(p => `<div class="fila"><span><img src="${A}items/${p.icono}.png" style="width:22px;vertical-align:middle;image-rendering:pixelated"> ${esc(p.nombre)} <small style="color:var(--txt3)">(${(yo.pw && yo.pw[p.id]) || 0})</small></span><span><b style="color:var(--oro)">${p.precio}</b> <button class="btn" data-c="${p.id}" data-n="1">×1</button> <button class="btn sec" data-c="${p.id}" data-n="5">×5</button></span></div>`).join('');
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
const V = iniciarVentanas({ mandar, yo: () => yo, aviso, sfx, abrir, cerrar, telegram: () => !!TG && !forzarInvitado });
$('b-inv').onclick = () => V.abrirInventario();
$('b-libro').onclick = () => V.abrirLibro();
$('b-logros').onclick = () => V.abrirLogros();
$('b-premium').onclick = () => V.abrirTienda('premium');
// ── EDITOR DE APARIENCIA ──
// Cambia el modelo propio en vivo; la camara se pone de frente.
let camAntes = null;
function pintarLook() {
  const l = lookEditor;
  $('lk-cara').textContent = APARIENCIA.cara[l.cara];
  $('lk-cuerpo').textContent = APARIENCIA.cuerpo[l.cuerpo];
  $('lk-pelo').textContent = APARIENCIA.pelo[l.pelo];
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
  lookEditor[k] = (lookEditor[k] + +b.dataset.d + n) % n;
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
$('b-look').onclick = () => abrirLook();
$('b-mapa').onclick = () => abrirMapa();
function pintarSon() { $('b-son').textContent = sonido ? '🔊' : '🔇'; }
$('b-son').onclick = () => { sonido = !sonido; try { localStorage.setItem('dq_mmo_sonido', sonido ? '1' : '0'); } catch (e) {} musica.activo(sonido); pintarSon(); };
pintarSon(); if (!sonido) musica.activo(false);
if (TG && TGV('8.0')) try {
  TG.onEvent('deactivated', () => { fuera3 = true; musica.activo(false); if (actx) actx.suspend().catch(() => {}); tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; });
  TG.onEvent('activated', () => { fuera3 = false; if (sonido) musica.activo(true); if (actx) actx.resume().catch(() => {}); });
} catch (e) {}
$('b-herm').onclick = () => { if ($('v-herm').classList.contains('on')) return cerrar('v-herm'); abrir('v-herm'); mandar({ t: 'herm' }); pintarHerm(); };
$('b-rank').onclick = () => { if ($('v-rank').classList.contains('on')) return cerrar('v-rank'); abrir('v-rank'); mandar({ t: 'ranking' }); pintarRankPanel(); };
$('b-pase').onclick = () => { if ($('v-pase').classList.contains('on')) cerrar('v-pase'); else { abrir('v-pase'); pintarPase(); } };
$('b-compartir').onclick = () => { presumirTxt = ''; if (!refAmigo) mandar({ t: 'amigos' }); compartir(); };
$('presumir3').onclick = () => { $('presumir3').style.display = 'none'; compartir(); };
// Sin { once }: si el sistema dejo la musica suspendida al volver (iPhone),
// cualquier toque la retoma; con el contexto ya creado solo mira su estado.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { if (sonido) { musica.arrancar(); if (actx && actx.state !== 'running') actx.resume().catch(() => {}); } });   // efectos tambien (iPhone)
// Fuera de la app (otra pestaña, pantalla apagada, Telegram sin 'deactivated')
// la musica y los golpes seguian sonando de fondo.
document.addEventListener('visibilitychange', () => {
  // Al salir (Telegram, otra app) se sueltan joystick y botones: si no, volvia con SUBIR o el joystick pegados.
  if (document.hidden) { musica.activo(false); if (actx) actx.suspend().catch(() => {}); tocandoSubir = tocandoBajar = false; joy.id = null; joy.dx = joy.dy = 0; for (const k in teclas) teclas[k] = false; }
  else { fuera3 = false; if (sonido) { musica.activo(true); if (actx) actx.resume().catch(() => {}); } }
});
$('b-ayuda').onclick = () => abrir('v-ayuda');
$('sel-calidad').value = CAL;
$('sel-calidad').onchange = e => { try { localStorage.setItem('dq3_calidad', e.target.value); } catch (er) {} location.reload(); };
$('b-amigos').onclick = () => { if ($('v-amigos').classList.contains('on')) return cerrar('v-amigos'); abrir('v-amigos'); mandar({ t: 'contactos' }); mandar({ t: 'quien' }); $('amigos-c')._h = ''; pintarAmigos3(); };
$('b-chat').onclick = () => { const i = $('chat-in'); i.style.display = 'block'; i.focus(); };
$('b-reconectar').onclick = () => location.reload();

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
  { const ah = Date.now(); for (const c of COFRES3) if (c.listoEn <= ah && Math.abs(c.x - P.x) < 130 && Math.abs(c.z - P.z) < 130) punto(c.x, c.z, c.tipo === 'legendario' ? '#ffd84a' : c.tipo === 'epico' ? '#c084fc' : '#d6a35c', c.tipo === 'legendario' ? 3.2 : 2.4); }
  if (invasion3 && ZONAS3D[invasion3.zona]) punto(ZONAS3D[invasion3.zona].x, ZONAS3D[invasion3.zona].z, '#ff5a1f', 5);
  for (const o of mons.values()) if (o.ra && !o.muereT) punto(o.x, o.z, o.ti || '#ffd84a', 4);
  { const ah = performance.now(); for (const n of NODOS) if (Math.abs(n.x - P.x) < 130 && Math.abs(n.z - P.z) < 130 && !(nodoListo.get(n.i) > ah)) punto(n.x, n.z, n.tipo === 'hierba' ? '#c084fc' : '#fbbf24', 1.6); }
  if (metaMision) {
    let px = (metaMision.x - P.x) * k + S / 2, pz = (metaMision.z - P.z) * k + S / 2;
    const fuera = px < 6 || pz < 6 || px > S - 6 || pz > S - 6;
    if (fuera) { const a = Math.atan2(pz - S / 2, px - S / 2); px = S / 2 + Math.cos(a) * (S / 2 - 8); pz = S / 2 + Math.sin(a) * (S / 2 - 8); }
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
  for (const [id, c] of Object.entries(ZONAS3D)) {
    const [px, pz] = aMapa(c.x, c.z, S), mp = MAPAS[id];
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px - 62, pz - 14, 124, 30);
    x.fillStyle = '#fff'; x.fillText(mp.nombre, px, pz);
    x.fillStyle = '#ffd84a'; x.fillText('Nv ' + mp.nv[0] + '-' + mp.nv[1], px, pz + 13);
  }
  for (const cp of campamentos(MAPAS, MONSTRUOS)) if (cp.jefe) { const [px, pz] = aMapa(cp.x, cp.z, S); x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(px, pz, 5, 0, 7); x.fill(); }
  const [ux, uz] = aMapa(0, 0, S); x.fillStyle = '#fff'; x.fillText('Pueblo Duende', ux, uz - 8);
  { const [ax, az] = aMapa(ARENA3D.x, ARENA3D.z, S); x.fillStyle = mundial3 && mundial3.vivo ? '#ff6b3d' : '#c4a484'; x.beginPath(); x.arc(ax, az, 7, 0, 7); x.fill(); x.fillText(ARENA3D.nombre, ax, az - 11); }
  if (metaMision) { const [mx2, mz2] = aMapa(metaMision.x, metaMision.z, S); x.font = 'bold 22px system-ui'; x.fillStyle = metaMision.guia ? '#4ade80' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(metaMision.guia ? '?' : '!', mx2, mz2 + 7); x.fillText(metaMision.guia ? '?' : '!', mx2, mz2 + 7); x.font = '600 12px system-ui'; }
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
// ── VERSION NUEVA: Telegram deja la pagina abierta horas; cada 2 min (y al
// volver a la app) se mira si hay version nueva y se recarga fuera de combate.
const MI_VER = +(/[?&]v=(\d+)/.exec(import.meta.url) || [0, 0])[1];
// Los errores de JavaScript de los jugadores llegan al servidor (antes nadie se enteraba de un fallo en un movil).
let errEnv = 0;
const avisarError = (msg, f, l) => { if (++errEnv > 5) return; try { mandar({ t: 'errc', m: String(msg || '').slice(0, 200), f: String(f || '').split('/').pop().slice(0, 80), l: l | 0, v: MI_VER, tg: TG ? 1 : 0 }); } catch (e) {} };
addEventListener('error', e => avisarError(e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => avisarError('promesa: ' + ((e.reason && (e.reason.message || e.reason)) || ''), '', 0));
let verNueva = 0, verT = 0;
async function revisarVersion() {
  if (!MI_VER || Date.now() - verT < 110000) return;
  verT = Date.now();
  try {
    const h = await (await fetch('/mundo/?vc=' + Date.now(), { cache: 'no-store' })).text();
    const v = +((/mundo\.js\?v=(\d+)/.exec(h) || [0, 0])[1]);
    if (v > MI_VER && !verNueva) { verNueva = v; aviso('✨ Hay una versión nueva del juego: se actualiza en unos segundos.', 'ok'); }
  } catch (e) {}
}
setInterval(() => {
  revisarVersion();
  // Ni con un panel abierto (tienda, NPC, leyenda…) ni escribiendo en el chat.
  if (verNueva && !P.muerto && !autoAtk && !lanzando && !P.vuela && !document.querySelector('.modal.on') && !chatAbierto() && !($('chat-in').value || '').trim() && performance.now() - (P.heridoT || 0) > 8000) location.reload();
}, 5000);
addEventListener('visibilitychange', () => { if (!document.hidden) { verT = 0; revisarVersion(); } });
// ── LA LEYENDA DEL CANTARO (lore): una vez al entrar y desde la ayuda ──
function verLeyenda() {
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;   // el cierre automatico del premio diario no cierra la leyenda
  $('diario-c').innerHTML = `<img src="/assets/lore/chicha-duende-playa.jpg" alt="Chicha morada $DUENDE junto al mar" style="display:block;width:100%;max-height:170px;object-fit:cover;border-radius:10px;margin-bottom:8px">
    <p class="vv-p"><img src="/assets/lore/maiz-morado.png" alt="" style="float:left;width:34px;margin:0 6px 0 0">Hace siglos, los duendes guardaban el <b style="color:#c084fc">Maíz Morado Sagrado</b>. Con él preparaban la <b style="color:#c084fc">chicha morada</b>, la bebida que les daba su fuerza y su magia.</p>
    <p class="vv-p">El <b>Rey Goblin</b> robó el <b style="color:#ffd84a">Cántaro Eterno</b> y lo rompió en pedazos. Sin chicha, la noche cubrió el bosque, los goblins invadieron las colinas y el Éter del cielo se partió en islas flotantes: el <b>Abismo</b>.</p>
    <p class="vv-p"><img src="/assets/lore/duende-chicha.webp" alt="" style="float:right;height:96px;margin:0 0 4px 6px">Tú eres un duende joven. <b>Recupera las zonas</b> (misiones y encargos 🧭), <b>vence a sus jefes</b>, abre los cofres y junta <b>puntos de chicha</b> cazando. En el Abismo, la Luz y la Sombra luchan por el <b>Núcleo</b>, donde late el último pedazo del Cántaro.</p>
    <p class="vv-p" style="color:#fde68a;font-weight:700">🥤 Y es de verdad: quien llegue a nivel ${CHICHA.nv60} en este mundo se lleva ${CHICHA.litros60} litros de chicha morada a su casa. Además, con ${(10000).toLocaleString('es')} puntos de chicha cazando, otro litro (en $DUENDE CLASSIC → Mochila → Chicha). Se reclama entrando con Telegram.</p>
<details style="margin-top:8px"><summary style="cursor:pointer;color:#c084fc;font-weight:700">🏺 Las reliquias del Cántaro: ${Object.keys(LORE_ZONAS).filter(z => encargos[z + ':jefe'] === true).length}/10 recuperadas</summary><p class="vv-p" style="font-size:12px;margin:6px 0">Cada reliquia (un pedazo, su semilla, su barro o un secreto) se recupera venciendo al jefe de su zona en los encargos 🧭. Con las 10, el último pedazo espera en el Núcleo del Abismo: el nivel ${CHICHA.nv60}.</p>${Object.entries(LORE_ZONAS).map(([id, z]) => { const ok = encargos[id + ':jefe'] === true; return `<p class="vv-p" style="margin:6px 0;${ok ? '' : 'opacity:.6'}"><b style="color:${ok ? '#4ade80' : '#fde68a'}">${ok ? '✓' : '·'} ${esc((MAPAS[id] || {}).nombre || id)}:</b> ${ok ? esc(z.pedazo) : 'reliquia perdida… vence al jefe de la zona.'}</p>`; }).join('')}</details>`;
  $('v-diario').querySelector('h2').textContent = 'LA LEYENDA DEL CÁNTARO';
  abrir('v-diario');
}
$('b-leyenda').onclick = () => { cerrar('v-ayuda'); verLeyenda(); };
// En cada sesion (no cada reconexion): la historia es lo primero que se ve.
function leyendaPrimeraVez() {
  try { if (sessionStorage.getItem('dq_leyenda')) return; } catch (e) { return; }
  // Espera a que elija clase y a que vea (y cierre) el premio diario: comparten ventana.
  if (hayVentana() || $('v-diario').classList.contains('on') || loginPend3 || !yo || !yo.clase) { setTimeout(leyendaPrimeraVez, 3000); return; }
  try { sessionStorage.setItem('dq_leyenda', '1'); } catch (e) {}
  verLeyenda();
}
let avisoInvT = 0;
function avisoInvitado() {
  // Desde Nv 3 (no encima del tutorial) y como mucho una vez al dia.
  if (!soyInvitado || !yo || yo.nivel < 3 || hayVentana() || $('v-diario').classList.contains('on')) return;
  clearTimeout(mostrarDiario.t); mostrarDiario.t = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem('dq_aviso_inv') === hoy) return; localStorage.setItem('dq_aviso_inv', hoy); } catch (e) {}
  $('diario-c').innerHTML = `<p class="vv-p">Juegas como <b>invitado</b>: tu duende vive solo en este navegador. Para no perderlo:</p>
    <p class="vv-p">1) Crea una cuenta gratis en <a href="/mmo/" style="color:#7dd3fc">$DUENDE CLASSIC</a> (botón 👤): tu duende pasa a la nube y sirve en los dos juegos.</p>
    <p class="vv-p">2) O guarda tu <b>código de rescate</b> y úsalo en otro navegador desde la pantalla de inicio:</p>
    <div style="display:flex;gap:6px;align-items:center"><code style="flex:1;min-width:0;overflow-wrap:anywhere;background:rgba(0,0,0,.4);padding:8px;border-radius:8px;font-size:12px;color:#ffd84a">${codigoRescate()}</code><button class="btn" id="copiar-rescate" style="padding:8px 10px;font-size:12px">Copiar</button></div>`;
  $('v-diario').querySelector('h2').textContent = 'GUARDA TU DUENDE';
  abrir('v-diario');
  $('copiar-rescate').onclick = () => { try { navigator.clipboard.writeText(codigoRescate()).then(() => aviso('Código copiado. Guárdalo en un lugar seguro.', 'ok')); } catch (e) {} };
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
    if (!c.g || Math.abs(c.x - P.x) > 90 || Math.abs(c.z - P.z) > 90) continue;
    const listo = c.listoEn <= ahora;
    c.tapa.rotation.x += ((listo ? 0 : -1.15) - c.tapa.rotation.x) * 0.12;
    c.gema.visible = listo;
    if (listo) { c.gema.position.y = 1.45 + Math.sin(t / 400 + c.i) * 0.12; c.gema.rotation.y = t / 600; }
    if (listo && cuadro % 45 === c.i % 45) FX.emitir(c.x, alturaEn(c.x, c.z) + 0.9, c.z, { n: c.tipo === 'legendario' ? 8 : 4, color: c.tipo === 'epico' ? '#c084fc' : '#ffd84a', vel: 1, vida: 1.2, grav: -1.5, tam: 0.7 });
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
// ── INVASION DEL 3D ──
let invasion3 = null;
// ── SUBIR DE NIVEL, PRESUMIR Y TELEGRAM ──
function subiNivel(lv) {
  vib('success'); fanfarria();
  FX.emitir(P.x, P.y + 0.2, P.z, { n: 46, color: '#ffe066', vel: 2.4, vida: 1.6, grav: -3.5, radio: 0.7, tam: 1.3 });
  FX.emitir(P.x, P.y + 1, P.z, { n: 30, color: '#ffffff', vel: 6, vida: 0.6, grav: 2 });
  if (lv >= 5 && lv % 5 === 0) ofrecerPresumir(`¡Llegué al nivel ${lv} en Duende Quest 3D!`);
  // Talentos y especializacion: se dice al desbloquearlos y en cada nivel con puntos (el libro va dentro de ⋯ en movil).
  const dondeLibro = MOVIL ? '⋯ → 📖' : '📖 (tecla P)';
  if (lv === 10) setTimeout(() => aviso(`🌟 ¡Nivel 10! Ya puedes elegir tu especialización y repartir puntos de talento en ${dondeLibro}.`, 'ok'), 1500);
  else if (lv > 10) setTimeout(() => aviso(`🌟 +1 punto de talento: úsalo en ${dondeLibro} → Talentos.`, 'ok'), 1500);
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
// Presumir: historia de Telegram (Bot API 7.8) con una imagen del juego; si
// no se puede, el compartir de Telegram o el del sistema.
let presumirTxt = '', refAmigo = '';
function ofrecerPresumir(txt) {
  presumirTxt = txt || '';
  if (!refAmigo) mandar({ t: 'amigos' });
  const b = $('presumir3'); if (!b) return;
  b.style.display = 'block'; clearTimeout(ofrecerPresumir.t);
  ofrecerPresumir.t = setTimeout(() => { b.style.display = 'none'; }, 12000);
}
function compartir() {
  const enl = 'https://t.me/duendequest_bot' + (refAmigo ? '?start=mmo_' + refAmigo : '');
  const txt = (presumirTxt ? presumirTxt + ' ' : '') + '¡Juega gratis conmigo a Duende Quest 3D en Telegram! 🧝';
  const img = location.origin + '/assets/promo/historia_' + (1 + Math.floor(Math.random() * 3)) + '.jpg';
  try {
    if (TG && TGV('7.8') && TG.shareToStory) {
      const premium = !!(TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.is_premium);
      TG.shareToStory(img, premium ? { text: txt, widget_link: { url: enl, name: 'Jugar gratis' } } : { text: (txt + ' ' + enl).slice(0, 200) });
      return;
    }
    if (TG && TG.openTelegramLink) return TG.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(enl) + '&text=' + encodeURIComponent(txt));
  } catch (e) {}
  const web = location.origin + '/mundo/' + (refAmigo ? '?ref=' + refAmigo : '');
  if (navigator.share) navigator.share({ title: 'Duende Quest 3D', text: txt, url: web }).catch(() => {});
  else try { navigator.clipboard.writeText(txt + ' ' + web).then(() => aviso('Texto y enlace copiados.', 'ok')); } catch (e) {}
}
// Boton Atras de Telegram: cierra la ventana abierta.
let tgAtras = false;
function revisarAtrasTg() {
  if (!TG || !TG.BackButton || !TGV('6.1')) return;
  const abierta = hayVentana() || hayLateral();
  if (abierta === tgAtras) return;
  tgAtras = abierta;
  try { abierta ? TG.BackButton.show() : TG.BackButton.hide(); } catch (e) {}
}
if (TG && TG.BackButton) try {
  TG.BackButton.onClick(() => { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'v-muerte' && m.id !== 'v-clase' && m.id !== 'v-error') cerrar(m.id); }); revisarAtrasTg(); });   // la de error no: dejaba el mundo congelado
} catch (e) {}
// ── HERMANDADES (las "guilds") ──
let hermInfo = null, hermSalirT = 0;
const RANGO_H = { lider: '👑 Líder', oficial: '⭐ Oficial', miembro: 'Miembro' };
function pintarHerm() {
  if (!$('v-herm').classList.contains('on') || !yo) return;
  const c = $('herm-c'), h = hermInfo;
  if (!h) {
    const puede = yo.nivel >= HERM_NIVEL;
    c.innerHTML = `<p class="vv-p">Una hermandad es tu clan: chat propio (<b>/h</b> mensaje), su nombre bajo el tuyo, la <b>gesta semanal</b> con premios para todos y su puesto en el ranking de hermandades.</p>
      <p class="vv-p">Fundar una cuesta <b style="color:#ffd84a">${HERM_COSTO.toLocaleString('es')} oro</b> y pide nivel ${HERM_NIVEL}. También puedes esperar a que un líder u oficial te invite (desde tu marco).</p>
      ${puede ? `<input id="herm-nombre" maxlength="20" placeholder="Nombre de la hermandad" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--borde);background:rgba(0,0,0,.4);color:#fff;margin:6px 0">
      <button class="btn" id="herm-crear" style="width:100%">Fundar hermandad</button>` : `<p class="vv-p" style="color:#f87171">Llega al nivel ${HERM_NIVEL} para fundar una.</p>`}`;
    if ($('herm-crear')) $('herm-crear').onclick = () => { const n = $('herm-nombre').value.trim(); if (n) mandar({ t: 'hermCrear', nombre: n }); };
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
  if (r === 'lider') s += `<div class="herm-cols">${HERM_COLORES.map((cc, i) => `<button data-hc="${i}" style="background:${cc}" class="${i === (h.color | 0) ? 'on' : ''}" aria-label="Color ${i + 1}"></button>`).join('')}</div>`;
  s += '<div class="herm-lista">' + h.m.map(x => {
    const cl = CLASES[x.cl], soy = x.uid === yo.pid;
    let acc = '';
    if (!soy && r === 'lider') acc += x.r === 'miembro' ? `<button data-hr="oficial" data-u="${x.uid}" title="Ascender a oficial">⬆</button>` : x.r === 'oficial' ? `<button data-hr="miembro" data-u="${x.uid}" title="Bajar a miembro">⬇</button><button data-hr="lider" data-u="${x.uid}" title="Darle el liderazgo">👑</button>` : '';
    if (!soy && mando && x.r !== 'lider' && !(r === 'oficial' && x.r === 'oficial')) acc += `<button data-hx="${x.uid}" title="Expulsar">✕</button>`;
    return `<div class="hm ${x.on ? 'on' : ''}"><span class="pt"></span><b style="color:${cl ? cl.color : '#fff'}">${esc(x.n)}</b><small>Nv ${x.lv} · ${RANGO_H[x.r] || x.r}</small><span class="acc">${acc}</span></div>`;
  }).join('') + '</div>';
  s += `<p class="vv-p" style="font-size:11px">Escribe en el chat <b>/h mensaje</b> para hablar con tu hermandad.</p><button class="btn sec" id="herm-salir" style="width:100%;margin-top:6px">${hermSalirT > Date.now() ? '¿Seguro? Pulsa otra vez para salir' : 'Salir de la hermandad'}</button>`;
  c.innerHTML = s;
  if ($('herm-motd-b')) $('herm-motd-b').onclick = () => mandar({ t: 'hermMotd', m: $('herm-motd').value });
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
  const fila = (x, amigo) => {
    const cl = CLASES[x.cl];
    let acc = '';
    if (x.on && x.id && !x.g && lider) acc += `<button data-ai="${x.id}">Invitar</button>`;
    if (x.on) acc += `<button data-as="${esc(x.n)}">Susurrar</button>`;
    if (amigo) acc += `<button data-aq="${esc(x.uid)}" title="Quitar de amigos">✕</button>`;
    const donde = !x.on ? 'desconectado' : x.m3 ? 'ORIGINS' : 'CLASSIC' + (x.mapa ? ' · ' + x.mapa : '');
    return `<div class="hm ${x.on ? 'on' : ''}"><span class="pt"></span><b style="color:${cl ? cl.color : '#fff'}">${esc(x.n)}</b><small>${x.on ? 'Nv ' + (x.lv | 0) + ' · ' : ''}${esc(donde)}</small><span class="acc">${acc}</span></div>`;
  };
  const tit = t => `<div style="font:700 10px var(--sans);color:var(--txt3);margin:8px 0 3px">${t}</div>`;
  // Los amigos conectados ya salen arriba: no se repiten en la lista de abajo.
  const ids = new Set(contactos3.filter(a => a.on).map(a => a.id));
  const resto = (quien3 || []).filter(x => !ids.has(x.id));
  let s = tit(`AMIGOS (${ids.size}/${contactos3.length})`);
  s += contactos3.length ? '<div class="herm-lista">' + contactos3.map(x => fila(x, true)).join('') + '</div>' : '<p class="vv-p" style="font-size:12px">Aún no tienes amigos: elige a un jugador y pulsa «⭐ Amigo» en su marco. Verás cuándo se conecta.</p>';
  s += tit(`EN LÍNEA${quien3 ? ` (${resto.length})` : ''}`);
  s += !quien3 ? '<p class="vv-p">Cargando…</p>' : resto.length ? '<div class="herm-lista">' + resto.map(x => fila({ ...x, on: 1 }, false)).join('') + '</div>' : '<p class="vv-p" style="font-size:12px">No hay nadie más conectado ahora mismo.</p>';
  s += '<button class="btn sec" id="am-act" style="width:100%;margin-top:8px">↻ Actualizar</button>';
  if (c._h === s) return;   // 'grupo' llega cada 500 ms: sin cambios no se rehace (se perdian clics)
  c._h = s;
  c.innerHTML = s;
  c.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => { mandar({ t: 'invitar', p: +b.dataset.ai }); b.disabled = true; });
  c.querySelectorAll('[data-as]').forEach(b => b.onclick = () => { cerrar('v-amigos'); const i = $('chat-in'); i.style.display = 'block'; i.value = '/s ' + b.dataset.as + ' '; i.focus(); });
  c.querySelectorAll('[data-aq]').forEach(b => b.onclick = () => mandar({ t: 'contactoQuitar', uid: b.dataset.aq }));
  $('am-act').onclick = () => { mandar({ t: 'contactos' }); mandar({ t: 'quien' }); };
}
// ── RANKING (general, semana, duelos, hermandades, torre) ──
let rankDatos = null, rankTab = 'sem';
function pintarRankPanel() {
  if (!$('v-rank').classList.contains('on')) return;
  const d = rankDatos, c = $('rank-c');
  const tabs = [['sem', 'Semana'], ['abismo', 'Abismo'], ['r', 'Nivel'], ['duel', 'Duelos'], ['herm', 'Hermandades'], ['torre', 'Torre']];
  let s = '<div class="rank-tabs">' + tabs.map(([k, n]) => `<button data-rt="${k}" class="${k === rankTab ? 'on' : ''}">${n}</button>`).join('') + '</div>';
  if (rankTab === 'abismo') s += htmlTemp(temp3 || (d && d.temp));
  else if (!d) { c.innerHTML = s + '<p class="vv-p">Cargando…</p>'; }
  else {
    const fin = d.finSem ? Math.max(0, d.finSem - Date.now()) : 0, dd = Math.floor(fin / 86400000), hh = Math.floor(fin % 86400000 / 3600000);
    if (rankTab === 'sem' && fin) s += `<p class="vv-p">⏳ La semana cierra en <b style="color:#f87171">${dd} d ${hh} h</b>: los mejores se llevan premio.</p>`;
    const L = d[rankTab] || [];
    const val = x => rankTab === 'sem' ? `${(x.xp || 0).toLocaleString('es')} XP` : rankTab === 'r' ? `Nv ${x.lv}` : rankTab === 'duel' ? `Elo ${x.e}` : rankTab === 'herm' ? `${(x.p || 0).toLocaleString('es')} pts · ${x.m} miembros` : `piso ${x.p}`;
    s += '<div class="rank-lista">' + (L.length ? L.map((x, i) => `<div class="rk ${x.yo ? 'yo' : ''}"><span class="pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(x.n)}</b><span>${val(x)}</span></div>`).join('') : '<p class="vv-p">Aún no hay nadie: ¡sé el primero!</p>') + '</div>';
    if (rankTab === 'duel') s += `<p class="vv-p" style="font-size:11px">Tu Elo: <b>${d.elo || 1000}</b>. Reta a alguien desde su marco.</p>`;
  }
  c.innerHTML = s;
  c.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { rankTab = b.dataset.rt; if (rankTab === 'abismo') mandar({ t: 'temp3' }); pintarRankPanel(); });
}
// ── RECOMPENSA DIARIA (racha de 7 dias) ──
// Panel lateral que se cierra solo: lo de hoy, la racha y lo que espera mañana.
function mostrarDiario(m) {
  if ($('v-diario').classList.contains('on') && !mostrarDiario.t) { setTimeout(() => mostrarDiario(m), 2000); return; }   // no pisa la leyenda
  const n = LOGIN_PREMIOS.length, hoy = m.racha;
  let h = m.vuelta ? `<p class="vv-p" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(255,216,74,.12);border:1px solid rgba(255,216,74,.4)">🎉 <b>¡Te echábamos de menos!</b> ${m.vuelta.dias} días fuera. Regalo de bienvenida: <b>+${m.vuelta.oro.toLocaleString('es')} oro</b>, ${m.vuelta.pociones} pociones y <b>${esc(m.vuelta.item)}</b>.</p>` : '';
  h += `<p class="vv-p" style="margin-bottom:8px">¡Día <b style="color:#ffd84a">${hoy}</b> de tu racha! Recibes <b>${m.oro && /oro/.test(m.txt || '') ? m.oro.toLocaleString('es') + ' oro' : esc(m.txt || '')}</b>${m.oro && !/oro/.test(m.txt || '') ? ` (+${m.oro.toLocaleString('es')} oro)` : ''}${m.itemNom ? `: <b>${esc(m.itemNom)}</b>` : ''}.</p><div class="dias7">`;
  for (let i = 1; i <= n; i++) {
    const pr = LOGIN_PREMIOS[i - 1];
    h += `<div class="d7 ${i < hoy ? 'ya' : i === hoy ? 'hoy' : ''}"><small>Día ${i}</small><span>${i === n ? '🎁' : pr.item !== undefined ? '⚔️' : pr.oro ? '🪙' : '🧪'}</span><em>${esc(pr.txt)}</em></div>`;
  }
  const sig = LOGIN_PREMIOS[hoy % n];
  h += `</div><p class="vv-p" style="margin-top:10px;font-size:12px">Mañana: <b style="color:#7dd3fc">${esc(sig.txt)}</b>. Si faltas un día la racha retrocede: ¡no la pierdas!</p>`;
  $('diario-c').innerHTML = h;
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
  const fin = new Date(); fin.setUTCMonth(fin.getUTCMonth() + 1, 1); fin.setUTCHours(0, 0, 0, 0);
  const dias = Math.max(0, Math.ceil((fin - Date.now()) / 86400000));
  let h = `<p class="vv-p">Nivel <b style="color:#ffd84a">${nv}</b> de ${PASE.niveles} · quedan <b style="color:#f87171">${dias} días</b> de temporada.</p>
    <div class="barra" style="height:12px;margin:6px 0 4px"><i style="transform:scaleX(${nv >= PASE.niveles ? 1 : (resto / PASE.porNivel).toFixed(3)})"></i></div>
    <p class="vv-p" style="font-size:11px;color:var(--txt3)">${nv >= PASE.niveles ? '¡Pase completo!' : `${resto} / ${PASE.porNivel} puntos para el nivel ${nv + 1}`} · Puntos: misión diaria +${PASE.puntos.diaria}, semanal +${PASE.puntos.semanal}, jefe mundial +${PASE.puntos.mundial}, mazmorra +${PASE.puntos.mazmorra}.</p><div class="pase-lista">`;
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
    if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(m => { if (!['v-clase', 'v-muerte', 'v-inicio', 'v-error'].includes(m.id)) cerrar(m.id); });
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
  if ((e.code === 'Digit1' || e.code === 'KeyZ') && !e.repeat) alternarAtaque();
  const nh = /^Digit([2-9])$/.exec(e.code);
  if (nh && !e.repeat) usarHab(misHabs[+nh[1] - 2]);
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
addEventListener('keyup', e => { teclas[e.code] = false; if (e.code === 'Space' && !P.vuela && P.vy > 0) P.vy *= 0.55; });   // salto corto si sueltas pronto
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
  arrastre = { x: e.clientX, y: e.clientY, mov: 0 };
  lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener('pointermove', e => {
  if (!arrastre || e.pointerType === 'touch') return;
  if (!(e.buttons & 3)) { arrastre = null; return; }   // el boton ya se solto (alt-tab, dialogo...)
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.mov += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * 0.006; camPitch = clamp(camPitch + dy * 0.004, 0.08, 1.25);
});
lienzo.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  if (arrastre && arrastre.mov < 6) elegirEn(e.clientX, e.clientY, e.detail >= 2);
  arrastre = null;
});
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('wheel', e => { camDist = clamp(camDist + Math.sign(e.deltaY) * 1.2, 4, 26); e.preventDefault(); }, { passive: false });
const ray = new THREE.Raycaster(), vec2 = new THREE.Vector2();
function elegirEn(cx, cy, doble) {
  vec2.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(vec2, camara);
  // Sin los ocultos: el rayo no mira la visibilidad y su cilindro sigue en la escena.
  const lista = [...mons.values()].filter(o => o.fig && !o.muereT && (!o.fig.raiz || o.fig.raiz.visible));
  const elegirMon = o => { if (objetivo === o.id || doble) { autoAtk = true; } objetivo = o.id; pintarBarra(); sfx('boton', 0.2); };
  const hits = ray.intersectObjects(lista.map(o => o.fig.m), false);
  if (hits.length) {
    const o = lista.find(x => x.fig.m === hits[0].object);
    if (o) { elegirMon(o); return; }
  }
  // Clic en otro jugador: queda elegido (curas, invitar al grupo).
  const ls = [...otros.values()].filter(o => o.fig);
  const hp2 = ray.intersectObjects(ls.map(o => o.fig.m), false);
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
  if (cerca) { elegirMon(cerca); return; }
  // Clic cerca de un PNJ: hablar.
  for (const n of npcs) { const s = aPantalla(n.x, n.y + 1.2, n.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < 40 && Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST + 2) { abrirNpc(n.tipo); return; } }
}
function cicloObjetivo() {
  const l = [...mons.values()].filter(o => !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 45).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (!l.length) { objetivo = 0; if (performance.now() - (cicloObjetivo.av || 0) > 3000) { cicloObjetivo.av = performance.now(); aviso('No hay monstruos cerca: sigue la luz amarilla o mira el mapa 🗺', 'err'); } return; }
  const i = l.findIndex(o => o.id === objetivo);
  objetivo = l[(i + 1) % l.length].id;
  sfx('boton', 0.2);
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
function alternarAtaque() {
  if (rivalP() && !objetivo) { autoAtk = !autoAtk; pintarBarra(); return; }
  if (!objetivo) cicloObjetivo();
  autoAtk = !!objetivo && !autoAtk;
  if (autoAtk) sfxK('desenv', 0.25);
  pintarBarra();
}
function usarPoder(i) { if (!yo || P.muerto) return; mandar({ t: 'pw', i }); }
function usarHab(h) {
  if (!yo || P.muerto || !h) return;
  if (yo.nivel < h.nv) return aviso(`Aprendes ${h.nombre} a nivel ${h.nv}: ${h.desc}`, 'err');
  const ahora = performance.now();
  if (h.gcd !== false && ahora < gcdHasta) { if (gcdHasta - ahora < 400) { colaHab = h; colaHasta = gcdHasta + 300; } return; }
  if (cdHab[h.id] && cdHab[h.id].fin > ahora) return aviso(h.nombre + ' todavía no está lista.', 'err');
  // Enemigo: el objetivo elegido (o el servidor busca el mas cercano).
  // Aliado: el jugador elegido o uno mismo.
  const contraRival = h.obj === 'enemigo' && !objetivo && rivalP() ? rivalP() : 0;
  if (h.obj === 'enemigo' && !objetivo && !contraRival) cicloObjetivo();
  // Sin recurso: se explica aqui (antes el tutorial lo daba por hecho y llegaba un "no" del servidor).
  if (yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec)) { const cl = CLASES[yo.clase], rc = cl && RECURSOS[cl.recurso]; return aviso(`${h.nombre} necesita más ${rc ? rc.nombre.toLowerCase() : 'recurso'}${cl && cl.recurso === 'ira' ? ': la Ira sube al pegar y al recibir golpes' : ''}.`, 'err'); }
  mandarPos(true);
  // Aliado elegido solo si sigue cerca (en movil no habia forma de soltarlo y la cura iba a un "fantasma").
  const qa = objetivoP && otros.get(objetivoP), aliadoOk = qa && Math.hypot(qa.x - P.x, qa.z - P.z) <= (h.rango || 400) / 17 + 2;
  mandar({ t: 'hab3', id: h.id, tg: h.obj === 'enemigo' ? objetivo : 0, tp: contraRival ? contraRival : (h.obj === 'aliado' || h.obj === 'muerto') && aliadoOk ? objetivoP : 0 });
  // Con lanzamiento: quieto desde el toque (el acercamiento automatico lo movia antes de
  // que llegara el 'cast' y el servidor lo cancelaba con "Te moviste").
  if (h.cast) { lanzando = { id: h.id, ini: ahora, fin: ahora + h.cast, pre: true }; P.vx = 0; P.vz = 0; }
  tuto3.hab = true;
  if (h.gcd !== false) gcdHasta = ahora + GCD_MS;
  if (h.id === 'polimorfia') { autoAtk = false; colaHab = null; pintarBarra(); }   // pegarle a la oveja la despierta
  else if (h.obj === 'enemigo' && objetivo && !autoAtk) { autoAtk = true; pintarBarra(); }
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
    if (zonaEn(P.x, P.z) === 'pueblo') return aviso('En el pueblo no se puede volar.', 'err');
    if (enCueva(P.x)) return aviso('En la cueva no hay sitio para volar.', 'err');
    if (P.alas < 3) return aviso('Tus alas necesitan descansar.', 'err');
    P.vuela = true; P.vy = 0; if (P.suelo) P.y += 1.5; P.suelo = false;
    sfx('salto', 0.2); sfxK('tela', 0.35);
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
  return npcs.find(n => Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST) || (portal && Math.hypot(P.x - portal.x, P.z - portal.z) < 5 ? { tipo: 'portal', nombre: 'Mazmorras' } : null);
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
  if (n.tipo === 'portal') {
    npcAbierto = '';
    $('npc-t').textContent = 'PORTAL DE LAS MAZMORRAS';
    $('npc-c').innerHTML = `<p><b style="color:#ffd84a">${CUEVA.nombre}</b> · mazmorra 3D para tu grupo (o solo). Salas con goblins, el Rey Goblin en su trono y un cofre para cada uno al final. Se adapta al nivel del más alto del grupo.</p>`
      + '<button class="btn" id="p-cueva" style="width:100%;margin:8px 0">Entrar a la cueva</button>'
      + `<hr style="border-color:var(--borde);margin:10px 0"><p><b style="color:#c4b5fd">🌌 ${ABISMO.nombre}</b> · islas flotantes donde la Luz y la Sombra se disputan el Núcleo (desde nivel ${ABISMO.nvMin}).</p>`
      + (yo.faccion ? `<p style="font-size:12px">Tu facción: <b style="color:${FACCIONES[yo.faccion].color}">${FACCIONES[yo.faccion].titulo}</b>${temp3 && temp3.debil === yo.faccion ? ' · ✨ Bendición del Éter (PA ×' + String(FACC_BONO).replace('.', ',') + ')' : ''}</p>${temp3 ? `<p style="font-size:11px;color:var(--txt2)">🏆 Temporada: tus PA ${fmtN(temp3.p)} · liga ${TEMP_ABISMO[temp3.tier] ? TEMP_ABISMO[temp3.tier].n : 'sin liga'} (ver en 🏆 Ranking → Abismo)</p>` : ''}<button class="btn" id="p-abismo" style="width:100%;margin:6px 0;background:linear-gradient(90deg,#7c3aed,#2563eb)">Ir al Abismo</button>`
        : yo.nivel >= ABISMO.nvMin ? `<p style="font-size:12px">Elige tu facción (para siempre):</p><div style="display:flex;gap:6px;margin:6px 0"><button class="btn" id="p-luz" style="flex:1;background:#b8860b">☀ Luz${temp3 ? ` (${temp3.n.luz || 0})` : ''}${temp3 && temp3.debil === 'luz' ? ' ★' : ''}</button><button class="btn" id="p-sombra" style="flex:1;background:#6b21a8">🌑 Sombra${temp3 ? ` (${temp3.n.sombra || 0})` : ''}${temp3 && temp3.debil === 'sombra' ? ' ★' : ''}</button></div>${temp3 && temp3.debil ? `<p style="font-size:12px;color:#ffd84a">★ Los ${esc(FACCIONES[temp3.debil].titulo)} son menos: si te unes cobras <b>${fmtN(RECLUTA.oro * Math.max(1, Math.floor(yo.nivel / 10)))} oro, un objeto épico y ${RECLUTA.pa} PA</b>, y ganáis PA ×${String(FACC_BONO).replace('.', ',')} mientras lo seáis.</p>` : ''}`
        : `<p style="font-size:12px;color:var(--txt3)">Se abre a nivel ${ABISMO.nvMin}.</p>`)
      + '<p style="font-size:12px;color:var(--txt2)">Las demás mazmorras, la Torre y la banda siguen en $DUENDE CLASSIC (2D) con tu mismo personaje.</p><a class="btn sec" href="/mmo/" style="display:block;text-align:center;text-decoration:none">Ir a CLASSIC (2D)</a>';
    $('p-cueva').onclick = () => { mandar({ t: 'cueva' }); cerrar('v-npc'); };
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
    const r = $('joy').getBoundingClientRect();   // la base se dibuja bajo el dedo aunque #joy no empiece en (0,0)
    base.style.display = 'block'; base.style.left = (t.clientX - r.left - 60) + 'px'; base.style.top = (t.clientY - r.top - 60) + 'px';
    e.preventDefault();
  }, { passive: false });
  $('joy').addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      let dx = t.clientX - joy.x, dy = t.clientY - joy.y; const d = Math.hypot(dx, dy);
      if (d > 50) { dx = dx / d * 50; dy = dy / d * 50; }
      joy.dx = dx / 50; joy.dy = dy / 50;
      pomo.style.left = (33 + dx) + 'px'; pomo.style.top = (33 + dy) + 'px';
    }
    e.preventDefault();
  }, { passive: false });
  const finJoy = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.dx = joy.dy = 0; base.style.display = 'none'; pomo.style.left = pomo.style.top = '33px'; } };
  $('joy').addEventListener('touchend', finJoy); $('joy').addEventListener('touchcancel', finJoy);
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
    for (const t of e.changedTouches) { toques.delete(t.identifier); if (t.identifier === camTouch.id) { if (camTouch.mov < 10 && e.type === 'touchend') elegirEn(t.clientX, t.clientY, false); camTouch.id = null; } }
    if (toques.size < 2) pinch = null;
  };
  lienzo.addEventListener('touchend', finToque, { passive: true }); lienzo.addEventListener('touchcancel', finToque, { passive: true });
  // Dos toques seguidos (como en otros juegos de movil) no apagan el ataque que el primero encendio.
  let atkTapT = 0;
  $('t-atk').addEventListener('touchstart', e => { e.preventDefault(); const t = performance.now(); if (autoAtk && t - atkTapT < 700) { atkTapT = t; return; } atkTapT = t; alternarAtaque(); }, { passive: false });
  // Con el teclado cerrado (Atras de Android) el chat seguia con el foco y congelaba el joystick y los botones.
  const soltarChat = () => { const i = $('chat-in'); if (document.activeElement === i) { i.blur(); if (!i.value.trim()) i.style.display = 'none'; } };
  $('tactil').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
  $('joy').addEventListener('touchstart', soltarChat, { capture: true, passive: true });
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
  $('t-obj').addEventListener('touchstart', e => { e.preventDefault(); cicloObjetivo(); }, { passive: false });
}

// ── BUCLE ──
let ultimoT = performance.now(), enviadoT = 0, ultimoEnv = '', cuadro = 0;
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
  // Con el ataque automatico puesto y sin mover el duende, va solo hasta su
  // objetivo (como hacer clic para atacar en WoW). No mientras lanzas un hechizo.
  if (!sinControl && !f && !s && autoAtk && !lanzando) {
    const o = blancoAtk();
    if (o && !o.muereT) {
      const ox = o.tx ?? o.x, oz = o.tz ?? o.z;
      const dx = ox - P.x, dz = oz - P.z, d = Math.hypot(dx, dz);
      // En el Abismo no persigue al objetivo fuera de la isla (antes te tiraba al vacio).
      if (d > rangoAtaque(o) * 0.75 && d < 45 && !(enAbismo(P.x) && !P.vuela && !islaEn(P.x + dx / d * 1.5, P.z + dz / d * 1.5))) { mx = dx / d; mz = dz / d; }
    }
  }
  const mag = Math.hypot(mx, mz);
  const quiere = mag > 0.15;
  if (quiere) { mx /= Math.max(1, mag); mz /= Math.max(1, mag); }
  const nadando = !P.vuela && !enAbismo(P.x) && alturaEn(P.x, P.z) < -0.7;
  // Con el talento Agilidad, como en el servidor (antes el cliente lo ignoraba).
  const vel = MUNDO.velocidad * (nadando ? 0.55 : 1) * (P.vuela ? alaDe(yo, enAbismo(P.x)).vel : P.planea ? 1.35 : velMontura(yo.montado)) * (1 + talento(yo, 'agilidad')) * (yo.dios && yo.diosModo && yo.diosModo.vel ? 3 : 1);
  // Inercia ligera (rapida en el suelo, mas suelta en el aire y el agua). Al
  // lanzar un hechizo sin tocar las teclas, se frena en seco (no se corta).
  const agarre = P.vuela || P.planea ? 4 : nadando ? 5 : !P.suelo ? 3 : 16;
  const kv = 1 - Math.exp(-agarre * dt);
  if (lanzando && !quiere) { P.vx = 0; P.vz = 0; }
  P.vx = lerp(P.vx || 0, quiere ? mx * vel : 0, kv); P.vz = lerp(P.vz || 0, quiere ? mz * vel : 0, kv);
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
      if (voces < 5)   // los pasos nunca quitan voces al combate
        sfxK(z === 'cumbres' || z === 'desierto' ? 'paso_n' : z === 'cueva' || z === 'eter' || z === 'castillo' || z === 'cavernas' ? 'paso_p' : z === 'pueblo' && Math.hypot(P.x, P.z) < 16 ? 'paso_p' : 'paso_h', 0.09);
    }
  }
  // Gravedad y suelo (en el agua se nada en la superficie).
  const suelo = Math.max(alturaEn(P.x, P.z), aguaEn(P.x) - 0.9);
  const espacio = !sinControl && (teclas.Space || tocandoSubir);
  if (P.vuela) {
    // Volando: Espacio sube, C (o Mayus) baja; las alas se cansan.
    const abajo = !sinControl && (teclas.KeyC || teclas.ShiftLeft || tocandoBajar);
    P.vy = espacio ? 6 : abajo ? -7 : Math.sin(ahoraP / 500) * 0.3;
    P.y = Math.min(P.y + P.vy * dt, suelo + 45);
    P.alas = Math.max(0, P.alas - dt);
    if (P.alas <= 0) { volar(false); P.planeoAuto = true; aviso('Tus alas se cansaron: planeas hacia el suelo.'); }
    if (P.y <= suelo + 0.05) { P.y = suelo; volar(false); P.suelo = true; }
  } else {
    // Planeo (AION): Espacio mantenido al caer (o solo, al cansarse las alas).
    P.planea = !P.suelo && P.vy < 0 && (espacio || P.planeoAuto) && !P.muerto && !enCueva(P.x) && P.y - suelo > 1.2;
    if (P.planea) P.vy += (-2.2 - P.vy) * Math.min(1, dt * 5);   // abre las alas sin tiron
    else { const g = P.vy > 0 ? FIS.gSube : (P.alas > 0 && P.vy < -6 ? 6 : FIS.gCae); P.vy = Math.max(P.vy - g * dt, -FIS.vMaxCaida); }
    P.y += P.vy * dt;
    // Pegado al suelo al bajar cuestas (sin saltitos) y caida al salir de un borde.
    const pegar = P.suelo && P.vy <= 0 && P.y - suelo < FIS.escalon * 0.5 + rapidez * dt * 1.5;
    if (P.y <= suelo || pegar) {
      const aterriza = !P.suelo, vAnt = P.vy;
      if (aterriza && vAnt < -7) FX.emitir(P.x, suelo + 0.1, P.z, { n: 16, color: '#bfae8e', vel: 2.5 - vAnt * 0.15, vida: 0.5, grav: 2, plano: true, radio: 0.4, tam: 1.6 });
      P.y = suelo; P.vy = 0; P.suelo = true; P.planea = false; P.planeoAuto = false; P.coyote = FIS.coyote;
      if (aterriza && P.buffer > 0 && !sinControl) { P.buffer = 0; saltar(); }
    } else { P.suelo = false; P.coyote = Math.max(0, P.coyote - dt); }
    P.buffer = Math.max(0, P.buffer - dt);
    if (P.suelo) P.alas = Math.min(ALAS_MAX, P.alas + dt * 3);
    if (yo) { const am = alaDe(yo, enAbismo(P.x)).vuelo; if (am !== ALAS_MAX) { ALAS_MAX = am; P.alas = Math.min(P.alas, am); } }
  }
  if (P.vuela && zonaEn(P.x, P.z) === 'pueblo') { volar(false); P.planeoAuto = true; }
  if (enAbismo(P.x) && !P.vuela && !P.muerto && P.y < -60 && !caidaEnviada) { caidaEnviada = true; mandar({ t: 'caida' }); }
  // Enviar la posicion (hasta ~10 por segundo).
  if (!P.muerto) mandarPos(false);
}
// Posicion al servidor: cada 100 ms, o ya (forzar) antes de un golpe o una
// habilidad para que mida el alcance con la posicion de verdad.
function mandarPos(forzar) {
  const ahora = performance.now(), suelo = Math.max(alturaEn(P.x, P.z), aguaEn(P.x) - 0.9), alt = Math.max(0, P.y - suelo);
  const clave = P.x.toFixed(1) + ',' + P.z.toFixed(1) + ',' + (P.anda ? 1 : 0) + ',' + alt.toFixed(0) + (P.planea ? 'p' : '');
  if ((forzar || ahora - enviadoT > 100) && clave !== ultimoEnv) {
    mandar({ t: 'mv3', x: +P.x.toFixed(2), z: +P.z.toFixed(2), r: +P.ry.toFixed(2), a: P.vuela ? 3 : P.planea ? 4 : P.anda ? 1 : 0, h: +alt.toFixed(1) });
    enviadoT = ahora; ultimoEnv = clave;
  }
}
function rangoAtaque(o) {
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  return vara ? 23 : 3.0 * (arma.alcance || 1) + (o.j ? 1.2 : 0.3);
}
function ataqueAuto() {
  if (!autoAtk || !yo || P.muerto) return;
  const o = blancoAtk();
  if (!o || o.muereT) { autoAtk = false; pintarBarra(); return; }
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  const rango = rangoAtaque(o);
  const d = Math.hypot(o.x - P.x, o.z - P.z);
  const ahora = performance.now();
  if (d > rango) { if (d > 45 && ahora - avisoLejosT > 2500) { avisoLejosT = ahora; aviso('Tu objetivo está demasiado lejos.'); } return; }
  if (ahora < sigAtk) return;
  // En Sigilo el primer golpe vale x2 y da combos: se espera 2,5 s a que lo abra una habilidad
  // (antes el ataque automatico lo gastaba en un golpe basico).
  if (P.au && P.au.sigilo) {
    if (!P.sigiloT) { P.sigiloT = ahora; aviso('🗡 En Sigilo: abre con Golpe Siniestro para pegar el doble.', 'ok'); }
    if (ahora - P.sigiloT < 2500) return;
  } else P.sigiloT = 0;
  sigAtk = ahora + (vara ? VARA.cdMs * arma.cd : 1000 * arma.cd);
  mandarPos(true);
  mandar(objetivo ? { t: 'atk3', tg: o.id } : { t: 'atk3', tp: o.id });
  P.atkT = ahora;
  // Respuesta inmediata: destello y golpe en el momento del tajo (o al llegar la bola).
  if (objetivo) impactos.push({ o, t: ahora + (vara ? 280 : 150) });
  // Mirar al objetivo.
  const dx = o.x - P.x, dz = o.z - P.z; P.ry = Math.atan2(dx, dz);
  P.f = dx * der.x + dz * der.z >= 0 ? 1 : -1;
  sfx(vara ? 'boton' : 'corte', 0.3);
}
function animarJugador(q, esYo, t) {
  const f = q.fig;
  if (!f) return;
  if (!esYo) q.y = Math.max(alturaEn(q.x, q.z), aguaEn(q.x) - 0.9) + (q.vh = lerp(q.vh || 0, q.h || 0, 0.15));
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
    f.poner(q.x, y, q.z, esYo ? P.ry : q.ry, t);
    if (!esYo) {
      const vuela = q.a === 3 || q.a === 4;
      const tipoAla = q.al || 'aprendiz';
      if (q.alas && q.alas.userData.id !== tipoAla) { quitarAlas(q.alas); q.alas = null; }
      if (vuela && !q.alas) q.alas = nuevasAlas(tipoAla);
      if (q.alas) { q.alas.visible = vuela; if (vuela) ponerAlas(q.alas, q.x, y, q.z, q.ry, t); }
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
    f.poner(o.x, y, o.z, o.ryV, t, Math.min(1, (t - o.nace) / 400));
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
}
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
  if (yo && P.lbl) ponLbl(P.lbl, P.x, P.y + 2.15 + (P.fig && P.fig.montura ? 1.2 : 0), P.z, `<span style="color:${yo.dios ? '#ffd84a' : '#ffe600'}">${yo.dios ? 'GM ' : ''}${esc(yo.nombre)}</span>${yo.titulo && LOGROS.find(l => l.id === yo.titulo) ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(LOGROS.find(l => l.id === yo.titulo).titulo)}»</small>` : ''}${hermInfo ? `<small style="display:block;color:${HERM_COLORES[hermInfo.color] || '#4ade80'};font-size:10px">&lt;${esc(hermInfo.nombre)}&gt;</small>` : ''}`, 999);
  for (const o of otros.values()) {
    const cl = CLASES[o.cl];
    ponLbl(o.lbl, o.x, (o.y || alturaEn(o.x, o.z)) + 2.15 + (o.fig && o.fig.montura ? 1.2 : 0), o.z, `<span style="color:${o.gm ? '#ffd84a' : o.fc && yo && yo.faccion && o.fc !== yo.faccion && enAbismo(o.x) ? '#ff4d4d' : cl ? cl.color : '#fff'}">${o.gm ? 'GM ' : ''}${o.fc && enAbismo(o.x) ? (o.fc === 'luz' ? '☀ ' : '🌑 ') : ''}${esc(o.n)} · Nv${o.lv}</span>${o.ti ? `<small style="display:block;color:#fde68a;font-size:10px">«${esc(o.ti)}»</small>` : ''}${o.hn ? `<small style="display:block;color:${HERM_COLORES[o.hc] || '#4ade80'};font-size:10px">&lt;${esc(o.hn)}&gt;</small>` : ''}${o.ra && enAbismo(o.x) ? `<small style="display:block;color:#c4b5fd;font-size:10px">${RANGOS[o.ra].n}</small>` : ''}<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>`, 70);
  }
  const kMis = tipoMision();
  for (const o of mons.values()) {
    const def = MONSTRUOS[o.k], el = o.id === objetivo, mis = o.k === kMis;
    const alto = o.fig ? altoFig(o.fig) : 2;
    const herido = o.hp < o.mx || el;
    ponLbl(o.lbl, o.x, alturaEn(o.x, o.z) + alto + 0.2, o.z, `${o.cast && o.cast.fin > t ? `<b style="display:block;color:#fb923c;font-size:12px">🥤 ${esc(o.cast.n)}…</b>` : ''}<span style="color:${o.ra ? o.ti || '#ffd84a' : o.iv ? '#ff5a1f' : o.j ? '#ff6bf0' : colorNivel(o.nv)}">${mis ? '<b style="color:#ffd84a;font-size:15px">❗</b>' : ''}${o.ra ? '★ ' + esc(o.ra) + ' · ' : o.iv ? '⚔ ' : o.j ? '★ ' : ''}${asedio && asedio.dormido && o.id === asedio.guardian ? '💤 ' : ''}${herido || o.j || mis ? esc(def.nombre) + ' ' : ''}${marcaNivel(o.nv)}Nv${o.nv}</span>${herido ? `<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>` : ''}`, el ? 90 : (o.j || mis ? 70 : 38));
  }
  for (const av of aventureros) ponLbl(av.lbl, av.x, alturaEn(av.x, av.z) + 2.15, av.z, `${av.diceT > t ? `<span style="display:block;background:rgba(255,255,255,.92);color:#222;border-radius:8px;padding:2px 7px;margin:0 auto 2px;font-weight:600;white-space:normal;width:max-content;max-width:170px">${esc(av.dice)}</span>` : ''}<span style="color:#93c5fd">${esc(Math.hypot(av.x - P.x, av.z - P.z) < 10 ? av.n : av.n.split(' ')[0])}</span> <small style="color:#bbb;font-size:9px">PNJ</small>`, 24);
  for (const n of npcs) ponLbl(n.lbl, n.x, n.y + 2.4, n.z, `${n.tipo === 'guia' && misionLista() ? '<b style="color:#ffd84a;font-size:22px;text-shadow:0 0 6px #000">?</b><br>' : ''}<span style="color:#4ade80">${esc(n.nombre)}</span>`, 60);
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
    const fig = figuraModelo(() => crearDuende({ skin: 'comun', clase: a.cl, arma: 'katana', look }));
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
  { txt: () => MOVIL ? 'Anda con el joystick y desliza el dedo por la pantalla para mirar' : 'Muévete con W A S D y arrastra con el ratón para girar la cámara', hecho: t => { const d = Math.hypot(P.x - t.x0, P.z - t.z0); if (d > 60) { t.x0 = P.x; t.z0 = P.z; } return d > 8 && d <= 60; } },   // un salto grande es un teletransporte: no cuenta
  { txt: () => 'Ve a la luz amarilla' + (metaMision ? ` ${flechaDir(metaMision.x, metaMision.z)} ${Math.round(Math.hypot(metaMision.x - P.x, metaMision.z - P.z))} m` : ''), hecho: t => (yo.kills || 0) > t.k0 || (metaMision && Math.hypot(metaMision.x - P.x, metaMision.z - P.z) < 30) },
  { txt: () => MOVIL ? 'Toca un monstruo y pulsa ATACAR' : 'Clic en un monstruo (o Tab) y pulsa 1 o Z para atacar', hecho: t => (yo.kills || 0) > t.k0 },
  // En movil el boton de ataque no esta en la barra: el primero ya es la habilidad de nivel 1.
  { txt: () => 'Usa tu habilidad ' + ((habsDe(yo.clase)[0] || {}).nombre || 'de clase') + ': ' + (MOVIL ? 'primer botón de la barra' : 'tecla 2'), hecho: t => t.hab },
  { txt: () => 'Fuera del pueblo, despliega las alas: ' + (MOVIL ? 'botón VOLAR' : 'V o doble salto'), hecho: () => P.vuela },
  { txt: () => MISIONES[yo.mis.i] && yo.mis.p >= MISIONES[yo.mis.i].n ? '¡Misión lista! Toca AQUÍ para entregarla' : 'Completa tu misión 📜 y luego entrégala aquí', hecho: () => yo.mis.i >= 1 },
];
const tuto3 = { i: -1, x0: 0, z0: 0, k0: 0, hab: false, clave: '' };
function htmlTuto3() {
  if (!yo.clase || yo.nivel > 6) return '';
  const clave = 'dq3_tuto_' + (yo.pid || '');
  if (tuto3.clave !== clave) { let i = 0; try { i = +(localStorage.getItem(clave) || 0); } catch (e) {} Object.assign(tuto3, { clave, i, x0: P.x, z0: P.z, k0: yo.kills || 0, hab: false }); }
  // k0 no se reinicia al avanzar: la primera caza cumple a la vez "sigue la luz" y "ataca".
  if (TUTO3[tuto3.i] && TUTO3[tuto3.i].hecho(tuto3)) { tuto3.i++; tuto3.x0 = P.x; tuto3.z0 = P.z; try { localStorage.setItem(clave, String(tuto3.i)); } catch (e) {} sfx('moneda', 0.3); }
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
    h = `<div class="q"><b>⛏ ${CUEVA.nombre}</b>${cuevaInfo && cuevaInfo.hecha ? '<span class="ok">¡Completada! Sal por el portal de la entrada.</span>' : 'Derrota al Rey Goblin en su trono.'}</div>`;
    c.style.display = 'block'; if (c._h !== h) { c.innerHTML = h; c._h = h; } faro.visible = false; return;
  }
  if (q) {
    const lista = yo.mis.p >= q.n;
    if (lista) metaMision = null;   // en ORIGINS se entrega desde cualquier sitio
    else {
      let mejor = null, md = Infinity;
      for (const cp of CAMPOS3D) if (cp.k === q.tipo) { const dd = Math.hypot(cp.x - P.x, cp.z - P.z); if (dd < md) { md = dd; mejor = cp; } }
      if (mejor) metaMision = { x: mejor.x, z: mejor.z, jefe: mejor.jefe };
    }
    const dist = metaMision ? Math.hypot(metaMision.x - P.x, metaMision.z - P.z) : 0;
    const donde = metaMision ? (dist < 25 ? ' · aquí' : ` · ${flechaDir(metaMision.x, metaMision.z)} ${Math.round(dist)} m`) : '';
    // Nivel del monstruo pedido y, si es muy fuerte (jefes 5+, el resto 4+),
    // donde subir antes: sin esto el novato se pegaba a un jefe que lo tumbaba.
    const mq = MONSTRUOS[q.tipo] || {}, alta = !lista && mq.nivel - yo.nivel >= (mq.jefe ? 5 : 4);
    const zt = alta ? Object.values(MAPAS).filter(m => m.zona && !m.instancia && !m.coliseo && m.nv && m.nv[0] <= yo.nivel).sort((a, b) => b.nv[0] - a.nv[0])[0] : null;
    const nvq = mq.nivel ? ` <span style="color:${colorNivel(mq.nivel)}">${marcaNivel(mq.nivel)}Nv ${mq.nivel}</span>` : '';
    h += `<div class="q"><b>📜 ${esc(q.nombre)}</b>${lista ? `<span class="ok" data-entregar="1" style="cursor:pointer;text-decoration:underline">¡Lista! Toca aquí para entregarla</span>` : `${mq.nombre || q.tipo}${nvq}: ${Math.min(yo.mis.p, q.n)}/${q.n}<small>${donde}</small>${alta ? `<small style="display:block;color:#ff9900">Muy fuerte para ti: sube antes${zt ? ' en ' + esc(zt.nombre) : ''} o ve en grupo</small>` : ''}`}</div>`;
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
  const tt = htmlTuto3();   // despues de calcular metaMision: el paso 2 la mira (va primera, tambien con invasion)
  if (!d.ok) h += `<div class="q"><b>☀ ${DIARIA.nombre}</b>${(d.p || 0) >= DIARIA.n ? '<span class="ok" data-entregar="diaria" style="cursor:pointer;text-decoration:underline">¡Lista! Toca aquí para cobrarla</span>' : `Monstruos de tu nivel: ${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}`}</div>`;
  if (invasion3) {
    const ms = Math.max(0, invasion3.ms - (Date.now() - invasion3.recibido)), mm = Math.floor(ms / 60000), ss = Math.floor(ms % 60000 / 1000);
    const zc = ZONAS3D[invasion3.zona], dz = zc ? Math.hypot(zc.x - P.x, zc.z - P.z) : 0;
    h = `<div class="q" style="border-left:3px solid #ff5a1f;padding-left:6px"><b style="color:#ff8a5c">⚔️ ${esc(invasion3.nombre)}</b>${invasion3.fase === 'capitan' ? '¡Derrota al Capitán!' : `Invasores: ${invasion3.hechos}/${invasion3.meta}`} · ${mm}:${String(ss).padStart(2, '0')}<small>${(MAPAS[invasion3.zona] || {}).nombre || ''}${dz > 60 && zc ? ` · ${flechaDir(zc.x, zc.z)} ${Math.round(dz)} m` : ' · ¡aquí!'}</small></div>` + h;
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
      `<small>${T.dia.bono ? '✓ bono del día' : 'Todas: bono del día'} · se renuevan a las 19:00 (Perú)</small></div>` +
      // Las semanales tambien (antes solo se veia "Semana 0/2").
      `<div class="q"><b>📅 Misiones de la semana ${hs}/${T.sem.l.length}</b>` + T.sem.l.map(t => t.ok ? `<span class="ok">✓ ${esc(t.txt)}</span>` : `<span class="tarea">• ${esc(t.txt)} ${t.p}/${t.n}</span>`).join('') + '</div>';
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
  if (q && metaMision && dMeta < 25 && avisoCampo !== yo.mis.i + ':' + q.tipo) {
    avisoCampo = yo.mis.i + ':' + q.tipo;
    const nom = (MONSTRUOS[q.tipo] || {}).nombre || q.tipo, falta = Math.max(0, q.n - yo.mis.p);
    const hay = [...mons.values()].some(o => o.k === q.tipo && !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 40);
    aviso(hay ? `📜 Aquí está tu misión: derrota ${falta} ${nom} (los marcados con ❗). ${MOVIL ? 'Tócalos' : 'Haz clic en ellos'} y ataca.` : `📜 Zona de ${nom}: aparecen en unos segundos aquí mismo. Te faltan ${falta}.`, 'ok');
  }
}
const cristalesHito = [];
let avisoCampo = '', metaEnc = null, encargos = {}, encZonas = 0, encRecibido = false;
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
$('misiones').onclick = e => { const en = e.target.closest('[data-entregar]'); if (en) { e.stopPropagation(); mandar(en.dataset.entregar === 'diaria' ? { t: 'mision', diaria: true } : { t: 'mision' }); return; } const b = e.target.closest('[data-cambiar]'); if (b) { e.stopPropagation(); const i = +b.dataset.cambiar; if (cambioPend && cambioPend.i === i && Date.now() - cambioPend.t < 4000) { cambioPend = null; mandar({ t: 'cambiarTarea', i }); } else { cambioPend = { i, t: Date.now() }; b.textContent = '¿Seguro?'; } return; } if (COMPACTO) { $('misiones').classList.toggle('abierto'); pintarMisiones(); return; } abrirMapa(); };
function misionLista() { if (!yo) return false; const q = MISIONES[yo.mis.i]; const d = yo.diaria || {}; return (q && yo.mis.p >= q.n) || (!d.ok && (d.p || 0) >= DIARIA.n); }
function colorNivel(nv) { const d = nv - (yo ? yo.nivel : 1); return d >= 5 ? '#ff3344' : d >= 2 ? '#ff9900' : d <= -8 ? '#9a9a9a' : d <= -3 ? '#4ade80' : '#ffe600'; }
// Marca de peligro que no depende del color (daltonicos): ASCII porque la fuente pixel no tiene calavera.
function marcaNivel(nv) { const d = nv - (yo ? yo.nivel : 1); return d >= 5 ? '!! ' : d >= 2 ? '! ' : ''; }
const cieloAct = C(CIELO.pueblo), cieloObj = C(CIELO.pueblo);
function bucle(t) {
  requestAnimationFrame(bucle);
  resolucionDinamica(t - ultimoT);
  const dt = Math.min(0.05, (t - ultimoT) / 1000); ultimoT = t;
  cuadro++;
  fisica(dt);
  ataqueAuto();
  if (colaHab && t >= gcdHasta) { const h = colaHab; colaHab = null; if (t < colaHasta) usarHab(h); }
  if (impactos.length) impactos = impactos.filter(i => { if (t < i.t) return true; if (!i.o.muereT) { i.o.golpeT = t; i.o.predT = t; } return false; });
  // Interpolacion de los demas.
  for (const o of otros.values()) { avanzarHacia(o, t); animarJugador(o, false, t); }
  for (const o of [...mons.values()]) {
    if (!o.muereT) avanzarHacia(o, t);
    if (o.muereT && t - o.muereT > 1600) { quitarMon(o.id); continue; }
    animarMon(o, t);
  }
  if (P.fig) animarJugador(P, true, t);
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
  const fovObj = fovBase + clamp((Math.hypot(P.vx, P.vz) / MUNDO.velocidad - 1.1) * 8, 0, 10);
  if (Math.abs(camara.fov - fovObj) > 0.05) { camara.fov += (fovObj - camara.fov) * Math.min(1, dt * 3); camara.updateProjectionMatrix(); }
  TAPA.uCam.value.set(cx, cy, cz); TAPA.uTgt.value.set(tx, ty, tz);
  // Zona actual: titulo, cielo y niebla de su color.
  if (cuadro % 15 === 0) {
    const z = zonaEn(P.x, P.z);
    if (z !== zonaActual) { zonaActual = z; tituloZona(z); }
    ambiente(z);
    cullFlora();
    if (yo) {
      const n = npcCercano(), cf = n ? null : cofreCercano(), nd = n || cf ? null : nodoCercano(); const b = $('hablar');
      b.style.display = n || cf || nd ? 'block' : 'none';
      if (n) b.textContent = (MOVIL ? '' : 'E · ') + (n.tipo === 'portal' ? 'Mazmorras' : n.tipo === 'salida' ? 'Salir de la cueva' : n.tipo === 'salidaAbismo' ? 'Volver al pueblo' : n.tipo === 'maquina' ? 'Disparar ' + n.nombre.toLowerCase() : 'Hablar con ' + n.nombre);
      else if (cf) b.textContent = (MOVIL ? '' : 'E · ') + 'Abrir ' + NOMBRE_COFRE[cf.tipo];
      else if (nd) b.textContent = (MOVIL ? '' : 'E · ') + 'Recoger ' + MATERIALES[nd.tipo].nombre;
      else if (!enCueva(P.x) && aguaCerca()) { b.style.display = 'block'; b.textContent = (MOVIL ? '' : 'E · ') + (pica > performance.now() ? '¡TIRAR!' : lanzando && lanzando.id === 'pescar' ? 'Esperando que pique…' : 'Pescar'); }
    }
    if (cuadro % 60 === 0) revisarNodos();
    animarCofres(t);
    for (const o of mons.values()) if (o.ra && !o.muereT && Math.abs(o.x - P.x) < 60 && Math.abs(o.z - P.z) < 60) FX.emitir(o.x, alturaEn(o.x, o.z) + 0.3, o.z, { n: 5, color: o.ti || '#ffd84a', vel: 1.2, vida: 1, grav: -2.5, radio: 0.8, tam: 0.8 });
    if (MOVIL) { const u = $('t-usar'), b = $('hablar'), ver = b.style.display === 'block' && !P.vuela; u.style.visibility = ver ? 'visible' : 'hidden'; if (ver) u.textContent = /Abrir/.test(b.textContent) ? 'ABRIR' : /Recoger/.test(b.textContent) ? 'RECOGER' : /Pescar|TIRAR|pique/.test(b.textContent) ? (/TIRAR/.test(b.textContent) ? '¡TIRAR!' : 'PESCAR') : /Salir/.test(b.textContent) ? 'SALIR' : /Disparar/.test(b.textContent) ? 'FUEGO' : 'HABLAR'; }
    if (npcAbierto && $('v-npc').classList.contains('on')) { const n = NPCS3D.find(x => x.tipo === npcAbierto); if (n && Math.hypot(P.x - n.x, P.z - n.z) > NPC_DIST + 6) cerrar('v-npc'); }
  }
  cieloAct.lerp(cieloObj, Math.min(1, dt * 1.5));
  escena.background.copy(cieloAct); escena.fog.color.copy(cieloAct);
  // Cupula: horizonte = niebla; cenit mas profundo (de dia azul intenso, de noche casi negro).
  cielo.m.position.copy(camara.position);
  cielo.u.uHor.value.copy(cieloAct);
  cielo.u.uTop.value.copy(cieloAct).lerp(C('#2a4fb8'), 0.45 * (1 - nocheK)).multiplyScalar(0.62 + 0.2 * (1 - nocheK));
  cielo.u.uSol.value.copy(solDir); cielo.u.uNoche.value = nocheK;
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
  if (cueva && enCueva(P.x)) cueva.animar(t);
  if (abismo && enAbismo(P.x)) { abismo.animar(t); animarCorrientes(t); }
  if (tirosAsedio.length) moverTirosAsedio(t);
  for (const cr of cristalesHito) { cr.rotation.y = t / 900; cr.position.y += Math.sin(t / 500) * 0.004; }
  if (molinoAspas && Math.hypot(P.x, P.z) < 160) molinoAspas.rotation.x = t / 1400;
  if (corcho) corcho.position.y = corcho.userData.y0 + (pica > performance.now() ? -0.18 + Math.sin(t / 60) * 0.08 : Math.sin(t / 500) * 0.04);
  if (agua) agua.material.opacity = 0.7 + Math.sin(t / 900) * 0.04;
  if (portal) portal.velo.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
  pintarObjetivo();
  if (cuadro % 6 === 0) { pintarMini(); pintarCds(); pintarAuras(); pintarObjetivoP(); }
  if (cuadro % 20 === 0) { pintarMisiones(); revisarAtrasTg(); }
  efectos = efectos.filter(e => {
    e.t += dt / e.dura;
    const r = 0.5 + e.radio * Math.min(1, e.t);
    e.m.scale.set(r, r, r); e.m.material.opacity = 0.8 * (1 - e.t);
    if (e.t >= 1) { escena.remove(e.m); e.m.material.dispose(); return false; }
    return true;
  });
  for (const [id, z] of zonas3) { const k = clamp((performance.now() - z.ini) / z.ms, 0, 1); if (performance.now() - z.ini > z.ms + 1500) { quitarZona3(id); continue; } z.disco.material.opacity = 0.12 + 0.4 * k; z.disco.scale.setScalar(Math.max(0.05, k)); }
  if (sacudir > 0) { sacudir = Math.max(0, sacudir - dt); camara.position.x += (Math.random() - 0.5) * sacudir; camara.position.y += (Math.random() - 0.5) * sacudir; }
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
  if (cuadro % 30 === 0) { const z = zonaEn(P.x, P.z); FX.ambiente(z === 'eter' ? 'eter' : z === 'cueva' ? 'polvo' : nocheK > 0.5 && z !== 'pueblo' ? 'luciernagas' : ''); }
  vFX.set(P.x, P.y, P.z); FX.actualizar(dt, vFX, lienzo.height);
  if (composer) composer.render(dt); else render.render(escena, camara);
}
const vFX = new THREE.Vector3();

// Estado visible en la consola para depurar (solo lectura).
window.__dq3 = { P, mons, otros, get objetivo() { return objetivo; }, get autoAtk() { return autoAtk; }, get yo() { return yo; }, cuadro: () => bucle(performance.now()), recibir,
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
  try { if (render.compileAsync) await Promise.race([render.compileAsync(escena, camara), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
  progreso(0.75, 'Dibujando el mapa…');
  await new Promise(r => setTimeout(r, 20));
  pintarMapaBase();
  if (USAR_MODELOS) try { precalentar(); } catch (e) { console.warn(e); }
  try {
    const cal = [new THREE.Mesh(GEO_BALA, matBala('#ffffff')), new THREE.Mesh(GEO_ONDA, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }))];
    if (USAR_MODELOS) { cal.push(crearMonstruo('goblin_normal').obj); cal.push(crearDuende({}).obj); }
    cal.forEach(m => { m.position.set(P.x, -50, P.z); escena.add(m); });
    render.compile(escena, camara);
    cal.forEach(m => escena.remove(m));
  } catch (e) { console.warn(e); }
  for (const n of NPCS3D) {
    const fig = figuraModelo(() => crearNpc(n.hoja)) || await figuraHoja(n.hoja, 62);
    npcs.push({ ...n, y: alturaEn(n.x, n.z), fig, lbl: etiqueta('') });
  }
  try { crearAventureros(); } catch (e) { console.warn(e); }
  P.lbl = etiqueta('yo');
  progreso(1, 'Conectando…');
  requestAnimationFrame(bucle);
  // Quien ya tiene sesion (Telegram, cuenta web o invitado con nombre) entra directo.
  const tok = await tokP;
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  let inv = null; try { inv = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (TG || tok || (inv && nombre)) { conectar(); return; }
  $('carga').style.display = 'none';
  abrir('v-inicio');
  const entrar = () => {
    const n = $('in-nombre').value.trim();
    // Vacio vale: el servidor le pone 'DuendeNNNN'. Corto no: se dice por que.
    if (n && n.length < 3) { $('in-nombre').focus(); $('in-nota').style.display = 'block'; return; }
    try { if (n) localStorage.setItem('dq_mmo_nombre', n); } catch (e) {}
    $('carga').style.display = 'flex'; progreso(1, 'Entrando al mundo…');
    conectar();
  };
  $('b-entrar').onclick = entrar;
  $('in-nombre').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') entrar(); });
}
inicio();
