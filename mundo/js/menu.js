// ═══════════════════════════════════════════════════════
// MENU DEL JUEGO (ORIGINS) Y AJUSTES GRAFICOS
//
// Dos partes:
//  1) Calidad grafica (sin DOM, se puede probar en node): niveles, preajustes,
//     deteccion de gama y el objeto de ajustes vivo (GFX) que lee mundo.js.
//  2) iniciarMenu(api): el menu de sistema (Continuar, Graficos, Sonido,
//     Controles, Interfaz, Ayuda y soporte, Salir). Crea su DOM y su <style>,
//     y se lleva a sus paneles lo que vivia en la ventana #v-ayuda (mismos ids).
//
// Claves de localStorage:
//   dq3_calidad  auto|minima|baja|media|alta|ultra (sin clave = auto; baja|media|alta son las de antes)
//   dq3_gfx      JSON con las opciones avanzadas que el jugador cambio a mano
//   dq3_fps      '1' = contador de FPS a la vista
// ═══════════════════════════════════════════════════════

export const NIVELES = ['minima', 'baja', 'media', 'alta', 'ultra'];
export const NOMBRE_NIVEL = { auto: 'Automático', minima: 'Mínima', baja: 'Baja', media: 'Media', alta: 'Alta', ultra: 'Ultra' };
// px: tope de resolucion (puntos por pixel CSS; nunca pasa de la pantalla). lejos: distancia de vision.
// sombras: 0 no, 1 normales (1024), 2 detalladas (2048 y mas alcance). det: vegetacion y detalle (0-2, al arrancar).
// fx: particulas y efectos (0-2). post: resplandor y color. aa: antialias (al arrancar). fps: tope (0 = el de la pantalla).
// din: resolucion dinamica (la red de seguridad que baja sola si el equipo no llega).
export const PRESETS = {
  minima: { px: 0.6,  lejos: 105, sombras: 0, det: 0, fx: 0, post: false, aa: false, fps: 30, din: true },
  baja:   { px: 0.75, lejos: 130, sombras: 0, det: 0, fx: 0, post: false, aa: false, fps: 30, din: true },
  media:  { px: 1,    lejos: 170, sombras: 0, det: 1, fx: 1, post: false, aa: false, fps: 60, din: true },
  alta:   { px: 1.5,  lejos: 230, sombras: 1, det: 2, fx: 2, post: true,  aa: true,  fps: 60, din: true },
  ultra:  { px: 2,    lejos: 290, sombras: 2, det: 2, fx: 2, post: true,  aa: true,  fps: 60, din: true },
};
// «Alta» en el celular: sombras y detalle, pero sin el post-proceso ni el antialias de PC (calientan y gastan bateria).
const ALTA_MOVIL = { px: 1.5, lejos: 200, sombras: 1, det: 2, fx: 2, post: false, aa: false, fps: 60, din: true };
export function presetDe(nivel, movil) { return movil && nivel === 'alta' ? ALTA_MOVIL : PRESETS[nivel] || PRESETS.media; }

const OPC = {
  px: [0.5, 0.6, 0.75, 1, 1.25, 1.5, 2],
  lejos: [105, 130, 170, 230, 290],
  sombras: [0, 1, 2], det: [0, 1, 2], fx: [0, 1, 2],
  post: [false, true], aa: [false, true], din: [false, true],
  fps: [30, 45, 60, 0],
};
export const CLAVES_GFX = Object.keys(OPC);

// Nombre corto de la grafica para mostrar: «ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 ...)» -> «GeForce RTX 3060».
export function gpuCorta(gpu) {
  let s = String(gpu || '').trim();
  if (!s) return '';
  if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(s)) return 'dibujo por software';
  const m = /^ANGLE \((.*)\)$/.exec(s);
  if (m) { const p = m[1].split(','); s = (p.length > 1 ? p[1] : p[0]).trim(); }
  s = s.replace(/ANGLE Metal Renderer: /i, '').replace(/\((R|TM)\)/gi, '').replace(/\s+(Direct3D|OpenGL|Vulkan)\S*.*$/i, '')
    .replace(/^(NVIDIA|AMD|ATI|Intel|Qualcomm|ARM|Google|Apple) (?=\S)/i, (t, a) => (/^(Intel|Apple)$/i.test(a) ? t : ''))
    .replace(/\(0x[0-9a-f]+\)/gi, '').replace(/\s+/g, ' ').replace(/[ ,/]+$/, '').trim();
  return s.length > 34 ? s.slice(0, 33).trim() + '…' : s;
}

// Punto de partida segun el equipo. Solo decide «Automático»: lo que el jugador elija a mano manda siempre.
// ent: { gpu, ua, mem (deviceMemory), nucleos (hardwareConcurrency), movil, iab (navegador de Facebook/Instagram...), dpr }
export function detectarGama(ent) {
  const e = ent || {}, g = String(e.gpu || ''), ua = String(e.ua || '');
  const mem = +e.mem || 0, nuc = +e.nucleos || 0, android = /Android/i.test(ua);
  // Dibujo por software o 2 GB o menos: lo minimo jugable.
  if (/SwiftShader|llvmpipe|softpipe|Microsoft Basic Render/i.test(g)) return 'minima';
  if (mem && mem <= 2) return 'minima';
  const pobre = !!e.iab || (android && ((mem && mem <= 3) || (nuc && nuc <= 4)));
  // Graficas baratas o antiguas (movil y PC).
  const barata = /Mali-(4\d\d|T\d+|G(31|51|52|57|71|72))\b|Adreno \(TM\) ([1-5]\d\d|60\d|61[0-3])\b|Adreno ([1-5]\d\d|60\d|61[0-3])\b|PowerVR (Rogue )?(GE8|G6|SGX)|Intel\(R\) HD Graphics|Intel HD Graphics|GeForce (GT |[1-9]\d{2}M?\b)|Radeon (HD|R[2-7]) /i.test(g);
  if (e.movil) {
    if (barata || pobre) return 'baja';
    // Tope de gama: Adreno 730 en adelante, Immortalis, Mali-G77/G78/G710 en adelante, iPhone de pantalla densa.
    if (/Adreno (\(TM\) )?(7[3-9]\d|8\d\d)\b|Immortalis|Mali-G(77|78|71[05]|72[05]|9\d\d)\b/i.test(g)) return 'alta';
    if (/Apple/i.test(g) && (+e.dpr || 1) >= 3) return 'alta';
    return 'media';
  }
  if (barata) return 'baja';
  if (pobre) return 'baja';
  // PC con grafica dedicada o Apple Silicon.
  if (/RTX|Radeon RX ?(5[5-9]|6|7|9)\d{2,3}|Arc(\(TM\))? (A7|B5|B7)\d\d|Apple M\d+ (Pro|Max|Ultra)/i.test(g)) return 'ultra';
  if (/GTX|GeForce|Quadro|Radeon (RX|Pro)|Arc(\(TM\))? |Apple M\d/i.test(g)) return 'alta';
  // Integradas: Intel UHD / Iris y las Radeon de portatil.
  if (/Intel\(R\) (UHD|Iris)|Intel (UHD|Iris)|Iris\(R\)|Radeon(\(TM\))? (Graphics|Vega)|Vega \d/i.test(g)) return 'media';
  if ((mem && mem <= 4) || (nuc && nuc <= 4)) return 'media';
  return 'alta';
}

function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ponerLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function recalcular(G) {
  G.efectivo = G.nivel === 'auto' ? G.detectado : G.nivel;
  const p = presetDe(G.efectivo, G.movil);
  for (const k of CLAVES_GFX) G[k] = k in G.propio ? G.propio[k] : p[k];
  G.personalizado = Object.keys(G.propio).length > 0;
}
// Objeto de ajustes vivo. mundo.js lo lee (y le apunta lo medido: pxReal, cuadroMs, cuadros).
export function crearGfx(ent) {
  const e = ent || {};
  const G = {
    nivel: 'auto', efectivo: 'media', detectado: detectarGama(e), gpu: String(e.gpu || ''), gpuCorta: gpuCorta(e.gpu),
    movil: !!e.movil, dpr: +e.dpr || 1, propio: {}, personalizado: false, verFps: leerLS('dq3_fps') === '1',
    px: 1, lejos: 170, sombras: 0, det: 1, fx: 1, post: false, aa: false, fps: 60, din: true,
    pxReal: 1, cuadroMs: 16.4, cuadros: 0, arranque: null,
  };
  const g = leerLS('dq3_calidad'); if (NIVELES.includes(g)) G.nivel = g;
  try { const o = JSON.parse(leerLS('dq3_gfx') || '{}'); if (o && typeof o === 'object') for (const k of CLAVES_GFX) if (OPC[k].includes(o[k])) G.propio[k] = o[k]; } catch (er) {}
  recalcular(G);
  G.arranque = { aa: G.aa, det: G.det };
  return G;
}
// Aplica un cambio parcial al objeto y lo guarda. { nivel } cambia el preajuste (y descarta lo personalizado);
// una opcion con null vuelve a lo del preajuste. Devuelve true si algo cambio.
export function fusionarGfx(G, parcial) {
  const p = parcial || {}, antes = JSON.stringify([G.nivel, G.propio, G.verFps]);
  if (p.nivel === 'auto' || NIVELES.includes(p.nivel)) { G.nivel = p.nivel; G.propio = {}; }
  for (const k of CLAVES_GFX) if (k in p) {
    if (p[k] == null) delete G.propio[k];
    else if (OPC[k].includes(p[k])) G.propio[k] = p[k];
  }
  // Lo que coincide con el preajuste no es «personalizado».
  const base = presetDe(G.nivel === 'auto' ? G.detectado : G.nivel, G.movil);
  for (const k of Object.keys(G.propio)) if (G.propio[k] === base[k]) delete G.propio[k];
  if ('verFps' in p) G.verFps = !!p.verFps;
  recalcular(G);
  if (JSON.stringify([G.nivel, G.propio, G.verFps]) === antes) return false;
  ponerLS('dq3_calidad', G.nivel === 'auto' ? null : G.nivel);
  ponerLS('dq3_gfx', G.personalizado ? JSON.stringify(G.propio) : null);
  ponerLS('dq3_fps', G.verFps ? '1' : null);
  return true;
}
export function faltaReiniciar(G) { return !!G.arranque && (G.aa !== G.arranque.aa || G.det !== G.arranque.det); }

// ═══════════════════════ MENU ═══════════════════════
const CSS = `
#dq-fps{position:fixed;left:calc(6px + env(safe-area-inset-left));top:38%;z-index:4;pointer-events:none;font:600 11px/1 ui-monospace,Menlo,Consolas,monospace;color:rgba(255,255,255,.82);text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.02em;display:none}
#dq-fps.on{display:block}
body.cine #dq-fps{display:none}
#v-menu.modal{z-index:12;background:rgba(4,3,12,.6);padding:0}
#v-menu .mn-caja{--mn-oro:var(--oro,#ffd84a);--mn-marco:var(--marco,#8a7440);--mn-linea:rgba(255,255,255,.08);position:relative;display:grid;grid-template-columns:216px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);width:min(760px,94vw);height:min(580px,90vh);height:min(580px,90dvh);background:linear-gradient(180deg,#15112f 0%,#0d0a20 100%);border:1px solid var(--mn-marco);border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.62),inset 0 0 0 1px rgba(255,216,74,.06);color:var(--txt,#f2efff);font:500 14px/1.45 var(--sans,system-ui,sans-serif);overflow:hidden;animation:mnEntra .22s ease both}
@keyframes mnEntra{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#v-menu .mn-caja{animation:none}}
#v-menu .mn-cab{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:12px 14px 11px 18px;border-bottom:1px solid var(--mn-marco);background:linear-gradient(180deg,rgba(255,216,74,.07),rgba(255,216,74,0))}
#v-menu .mn-tit{flex:1;min-width:0;margin:0;font:700 17px/1.2 var(--titulo,"Cinzel",Georgia,"Times New Roman",serif);letter-spacing:.06em;font-variant:small-caps;color:var(--mn-oro);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#v-menu .mn-vivo{font:500 11.5px/1.2 var(--sans,system-ui,sans-serif);color:var(--txt2,#b8b0d8);white-space:nowrap}
#v-menu .mn-vivo::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok,#4ade80);margin-right:6px;vertical-align:1px}
#v-menu .mn-ic{flex:none;width:36px;height:36px;border-radius:8px;border:1px solid var(--mn-linea);background:rgba(255,255,255,.05);color:var(--txt,#fff);font:600 15px var(--sans,system-ui,sans-serif);cursor:pointer;display:flex;align-items:center;justify-content:center}
#v-menu .mn-volver{display:none}
#v-menu .mn-nav{display:flex;flex-direction:column;gap:2px;padding:10px 8px;border-right:1px solid var(--mn-linea);background:rgba(0,0,0,.2);overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}
#v-menu .mn-it{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:8px 12px;border:1px solid transparent;border-radius:8px;background:none;color:var(--txt2,#b8b0d8);font:600 14px/1.2 var(--sans,system-ui,sans-serif);text-align:left;cursor:pointer}
#v-menu .mn-it i{flex:none;width:20px;text-align:center;font-style:normal;font-size:15px;opacity:.9}
#v-menu .mn-it span{flex:1}
#v-menu .mn-it::after{content:'';display:none}
@media (hover:hover){#v-menu .mn-it:hover{background:rgba(255,255,255,.06);color:var(--txt,#fff)}#v-menu .mn-ic:hover{background:rgba(255,255,255,.12)}}
#v-menu .mn-it[aria-selected="true"]{background:rgba(255,216,74,.1);border-color:rgba(255,216,74,.32);color:var(--mn-oro)}
#v-menu .mn-it.mn-pri{background:linear-gradient(180deg,#e9c25a,#c79a35);color:#1b1206;border-color:#f3d77c;margin-bottom:8px;font-weight:800}
#v-menu .mn-it.mn-pri i{opacity:1}
#v-menu .mn-it.mn-fin{margin-top:auto}
#v-menu .mn-sep{height:1px;background:var(--mn-linea);margin:6px 4px}
#v-menu .mn-cont{min-width:0;overflow:auto;padding:16px 20px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent;overscroll-behavior:contain}
#v-menu .mn-sec{display:none}
#v-menu .mn-sec.on{display:block}
#v-menu .mn-h{margin:0 0 4px;font:700 15px/1.25 var(--titulo,"Cinzel",Georgia,serif);letter-spacing:.06em;font-variant:small-caps;color:var(--mn-oro)}
#v-menu .mn-h2{margin:18px 0 2px;padding-top:12px;border-top:1px solid var(--mn-linea);font:700 12px/1.3 var(--sans,system-ui,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--txt2,#b8b0d8)}
#v-menu .mn-sub{margin:0 0 12px;font-size:12.5px;color:var(--txt2,#b8b0d8)}
#v-menu p{font:500 13.5px/1.5 var(--sans,system-ui,sans-serif);color:var(--txt2,#b8b0d8);margin:0 0 8px}
#v-menu .mn-nota{font-size:12px;color:var(--txt3,#8f88ad);margin:6px 0 0}
#v-menu .mn-niveles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:10px 0 8px}
#v-menu .mn-seg{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}
#v-menu .mn-b{min-height:34px;padding:6px 11px;border-radius:7px;border:1px solid var(--mn-linea);background:rgba(255,255,255,.045);color:var(--txt,#f2efff);font:600 13px/1.15 var(--sans,system-ui,sans-serif);cursor:pointer;white-space:nowrap}
@media (hover:hover){#v-menu .mn-b:hover{background:rgba(255,255,255,.1)}}
#v-menu .mn-b[aria-checked="true"]{background:rgba(255,216,74,.14);border-color:var(--mn-oro);color:var(--mn-oro)}
#v-menu .mn-niveles .mn-b{min-height:44px;padding:6px 2px;white-space:normal;text-align:center}
#v-menu .mn-niveles .mn-b small{display:block;font:500 10.5px/1.2 var(--sans,system-ui,sans-serif);color:var(--txt2,#b8b0d8);margin-top:2px}
#v-menu .mn-niveles .mn-b[aria-checked="true"] small{color:inherit;opacity:.85}
#v-menu .mn-op{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--mn-linea);min-height:48px}
#v-menu .mn-op-t{min-width:0;flex:1}
#v-menu .mn-op-t b{display:block;font:600 14px/1.25 var(--sans,system-ui,sans-serif);color:var(--txt,#f2efff)}
#v-menu .mn-op-t small{display:block;font:500 11.5px/1.3 var(--sans,system-ui,sans-serif);color:var(--txt3,#8f88ad);margin-top:2px}
#v-menu .mn-op.mn-propia .mn-op-t b::after{content:' •';color:var(--mn-oro)}
#v-menu .mn-rei{font-style:normal;font-weight:600;color:var(--warn,#ffb020)}
#v-menu .mn-sw{position:relative;flex:none;width:52px;height:34px;border:0;border-radius:17px;background:none;cursor:pointer;padding:0}
#v-menu .mn-sw::before{content:'';position:absolute;left:0;right:0;top:50%;height:28px;margin-top:-14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);box-sizing:border-box;transition:background .15s,border-color .15s}
#v-menu .mn-sw::after{content:'';position:absolute;top:50%;left:4px;width:20px;height:20px;margin-top:-10px;border-radius:50%;background:#c9c3e6;transition:transform .15s,background .15s}
#v-menu .mn-sw[aria-checked="true"]::before{background:rgba(255,216,74,.26);border-color:var(--mn-oro)}
#v-menu .mn-sw[aria-checked="true"]::after{transform:translateX(24px);background:var(--mn-oro)}
#v-menu .mn-aviso{display:none;align-items:center;gap:10px;margin:12px 0 0;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,176,32,.45);background:rgba(255,176,32,.09);color:var(--txt,#f2efff);font-size:13px}
#v-menu .mn-aviso.on{display:flex}
#v-menu .mn-aviso span{flex:1;min-width:0}
#v-menu .mn-btn{min-height:40px;padding:9px 16px;border-radius:8px;border:1px solid #f3d77c;background:linear-gradient(180deg,#e9c25a,#c79a35);color:#1b1206;font:800 13.5px/1.15 var(--sans,system-ui,sans-serif);cursor:pointer;white-space:nowrap}
#v-menu .mn-btn.sec{background:rgba(255,255,255,.06);border-color:var(--mn-linea);color:var(--txt,#f2efff);font-weight:600}
#v-menu .mn-btn.rojo{background:rgba(255,90,106,.14);border-color:rgba(255,90,106,.55);color:#ffc2c8}
#v-menu .mn-pie{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
#v-menu .mn-rango{display:flex;align-items:center;gap:10px;flex:none;width:min(240px,52%)}
#v-menu .mn-rango input{flex:1;min-width:0;height:30px;accent-color:#e3b94f;cursor:pointer;margin:0}
#v-menu .mn-rango output{flex:none;width:42px;text-align:right;font:600 13px var(--sans,system-ui,sans-serif);color:var(--txt2,#b8b0d8)}
#v-menu .mn-sal{display:flex;flex-direction:column;gap:8px;margin-top:12px}
#v-menu .mn-sal-b{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:10px 14px;border-radius:10px;border:1px solid var(--mn-linea);background:rgba(255,255,255,.045);color:var(--txt,#f2efff);text-align:left;cursor:pointer;font:600 14.5px/1.25 var(--sans,system-ui,sans-serif)}
#v-menu .mn-sal-b i{flex:none;width:22px;text-align:center;font-style:normal;font-size:17px;color:var(--mn-oro)}
#v-menu .mn-sal-b small{display:block;font:500 12px/1.3 var(--sans,system-ui,sans-serif);color:var(--txt2,#b8b0d8);margin-top:2px}
@media (hover:hover){#v-menu .mn-sal-b:hover{background:rgba(255,255,255,.09);border-color:rgba(255,216,74,.3)}}
#v-menu .mn-conf{display:none;margin-top:12px;padding:12px 14px;border-radius:10px;border:1px solid var(--mn-marco);background:rgba(255,216,74,.06)}
#v-menu .mn-conf.on{display:block}
#v-menu .mn-conf p{color:var(--txt,#f2efff);margin:0}
#v-menu .mn-conf .mn-ojo{color:var(--warn,#ffb020);margin-top:6px}
#v-menu .mn-conf .mn-pie{margin-top:10px}
#v-menu .mn-det{margin:10px 0 0;border-top:1px solid var(--mn-linea)}
#v-menu .mn-det>summary{cursor:pointer;padding:12px 0;font:700 12px/1.3 var(--sans,system-ui,sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--txt2,#b8b0d8);list-style-position:inside}
#v-menu .fila{padding:9px 0;min-height:48px;border-bottom:1px solid var(--mn-linea);font:500 14px/1.3 var(--sans,system-ui,sans-serif);gap:12px}
#v-menu .fila>span{color:var(--txt,#f2efff)}
#v-menu .fila>b{font-weight:600;color:var(--txt2,#b8b0d8);text-align:right;margin-left:auto}
#v-menu select{min-height:36px;padding:6px 10px!important;border-radius:7px!important;border:1px solid var(--mn-linea)!important;background:#1c1638!important;color:var(--txt,#f2efff)!important;font:600 13px var(--sans,system-ui,sans-serif);max-width:100%}
#v-menu .btn.sec{background:rgba(255,255,255,.06);border:1px solid var(--mn-linea);min-height:36px}
#v-menu a{color:var(--cian,#7dd3fc)}
#v-menu a.btn{color:#fff}
#v-menu :is(button,a,select,input,summary):focus-visible{outline:2px solid var(--mn-oro);outline-offset:2px}
body.texto-grande #v-menu .mn-caja{font-size:15.5px}
body.texto-grande #v-menu .mn-op-t b,body.texto-grande #v-menu .fila,body.texto-grande #v-menu .mn-it{font-size:15.5px}
body.texto-grande #v-menu p,body.texto-grande #v-menu .mn-b{font-size:14.5px}
body.texto-grande #v-menu .mn-op-t small,body.texto-grande #v-menu .mn-sub{font-size:13px}
/* Dedo: todo lo que se toca mide 44 px o mas. */
body.movil #v-menu .mn-ic{width:44px;height:44px}
body.movil #v-menu .mn-it{min-height:44px}
body.movil #v-menu :is(.mn-b,.mn-btn,select,.btn){min-height:44px}
body.movil #v-menu .btn{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}
body.movil #v-menu .mn-sw{height:44px;width:56px}
body.movil #v-menu .mn-sw[aria-checked="true"]::after{transform:translateX(28px)}
body.movil #v-menu .mn-rango input{height:44px}
/* Apaisado bajo (celular acostado): a pantalla completa, dos columnas compactas. */
@media (max-height:500px){
 #v-menu .mn-caja{width:100vw;height:100vh;height:100dvh;border-radius:0;border-width:0;grid-template-columns:204px minmax(0,1fr);padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)}
 #v-menu .mn-cab{padding:6px 10px 6px 14px}
 #v-menu .mn-nav{padding:6px;gap:1px}
 #v-menu .mn-it{padding:6px 10px;font-size:13.5px}
 #v-menu .mn-it.mn-pri{display:none}
 #v-menu .mn-it span{white-space:nowrap}
 #v-menu .mn-sep{margin:3px 4px}
 #v-menu .mn-cont{padding:10px 14px 16px}
}
/* Celular en vertical: hoja a pantalla completa; primero la lista y cada seccion con su «volver». */
@media (max-width:640px) and (min-height:501px){
 #v-menu .mn-caja{width:100vw;height:100vh;height:100dvh;border-radius:0;border-width:0;display:flex;flex-direction:column;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
 #v-menu .mn-cab{padding:10px 12px 10px 16px;min-height:60px}
 #v-menu .mn-ic{width:44px;height:44px}
 #v-menu .mn-nav{flex:1;border-right:0;padding:14px 14px 20px;gap:8px;background:none}
 #v-menu .mn-it{min-height:54px;padding:10px 16px;font-size:16px;border-color:var(--mn-linea);background:rgba(255,255,255,.045);border-radius:10px;color:var(--txt,#f2efff)}
 #v-menu .mn-it i{font-size:18px;width:24px;color:var(--mn-oro)}
 #v-menu .mn-it.mn-pri i{color:inherit}
 #v-menu .mn-it:not(.mn-pri)::after{content:'›';display:block;font-size:20px;color:var(--txt3,#8f88ad)}
 #v-menu .mn-it[aria-selected="true"]{background:rgba(255,255,255,.045);border-color:var(--mn-linea);color:var(--txt,#f2efff)}
 #v-menu .mn-it.mn-pri{min-height:56px;margin-bottom:6px}
 #v-menu .mn-it.mn-fin{margin-top:0}
 #v-menu .mn-sep{display:none}
 #v-menu .mn-cont{display:none;flex:1;padding:14px 16px 28px}
 #v-menu .mn-caja.mn-det-on .mn-nav{display:none}
 #v-menu .mn-caja.mn-det-on .mn-cont{display:block}
 #v-menu .mn-caja.mn-det-on .mn-volver{display:flex}
 #v-menu .mn-caja.mn-det-on .mn-vivo{display:none}
 #v-menu .mn-h{display:none}
 #v-menu .mn-niveles{grid-template-columns:repeat(3,minmax(0,1fr))}
 #v-menu .mn-niveles .mn-b{min-height:52px}
 #v-menu .mn-b{min-height:44px;padding:8px 12px}
 #v-menu .mn-op{flex-wrap:wrap;gap:8px}
 #v-menu .mn-op-t{flex:1 1 150px}
 #v-menu .mn-op .mn-seg{flex:1 1 100%;justify-content:flex-start}
 #v-menu .mn-op .mn-seg{flex-wrap:nowrap}
 #v-menu .mn-op .mn-seg .mn-b{flex:1 1 0;min-width:0;padding:8px 2px}
 #v-menu .mn-rango{width:100%}
 #v-menu .mn-rango input{height:44px}
 #v-menu .mn-btn{min-height:46px}
 #v-menu .mn-pie .mn-btn{flex:1}
 #v-menu .mn-aviso{flex-wrap:wrap}
 #v-menu .mn-aviso .mn-btn{flex:1 1 100%}
 #v-menu .fila{flex-wrap:wrap}
}
`;

const SECCIONES = [
  ['graficos', '🖥', 'Gráficos'],
  ['sonido', '🔊', 'Sonido'],
  ['controles', '🎮', 'Controles'],
  ['interfaz', '👁', 'Interfaz'],
  ['ayuda', '❓', 'Ayuda y soporte'],
  ['salir', '🚪', 'Salir'],
];
const DESC_NIVEL = {
  minima: 'Para celulares con poca memoria: resolución reducida, vista corta y 30 FPS.',
  baja: 'Para equipos modestos: menos resolución, vista más corta y sin extras.',
  media: 'Equilibrio entre fluidez y detalle.',
  alta: 'Sombras, más detalle y más distancia de visión.',
  ultra: 'Para PC con buena tarjeta gráfica: sombras detalladas, resplandor y la vista más larga.',
};
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export function iniciarMenu(api) {
  if (document.getElementById('v-menu')) return window.dqMenu;
  const G = api.gfx, $ = id => document.getElementById(id);
  const st = h('style'); st.id = 'mn-css'; st.textContent = CSS; document.head.appendChild(st);

  // ── Esqueleto ──
  const raiz = h('div', 'modal'); raiz.id = 'v-menu';
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-labelledby', 'mn-tit');
  const caja = h('div', 'mn-caja');
  const cab = h('div', 'mn-cab');
  const bVolver = h('button', 'mn-ic mn-volver', '←'); bVolver.type = 'button'; bVolver.setAttribute('aria-label', 'Volver al menú');
  const tit = h('h2', 'mn-tit', 'Menú'); tit.id = 'mn-tit';
  const vivo = h('span', 'mn-vivo', 'El mundo sigue en marcha');
  const bX = h('button', 'mn-ic mn-x', '✕'); bX.type = 'button'; bX.setAttribute('aria-label', 'Cerrar el menú y seguir jugando');
  cab.append(bVolver, tit, vivo, bX);
  const nav = h('div', 'mn-nav'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-orientation', 'vertical'); nav.setAttribute('aria-label', 'Secciones del menú');
  const cont = h('div', 'mn-cont');
  caja.append(cab, nav, cont); raiz.appendChild(caja); document.body.appendChild(raiz);

  const item = (ic, txt, cls) => { const b = h('button', 'mn-it' + (cls ? ' ' + cls : '')); b.type = 'button'; const i = h('i', '', ic); i.setAttribute('aria-hidden', 'true'); b.append(i, h('span', '', txt)); return b; };
  const bSeguir = item('▶', 'Continuar', 'mn-pri'); bSeguir.id = 'mn-continuar';
  nav.appendChild(bSeguir);
  const secs = {}, tabs = {};
  for (const [id, ic, nombre] of SECCIONES) {
    if (id === 'salir') nav.appendChild(h('div', 'mn-sep'));
    const b = item(ic, nombre, id === 'salir' ? 'mn-fin' : ''); b.id = 'mn-t-' + id; b.dataset.sec = id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-controls', 'mn-s-' + id);
    nav.appendChild(b); tabs[id] = b;
    const s = h('div', 'mn-sec'); s.id = 'mn-s-' + id; s.setAttribute('role', 'tabpanel'); s.setAttribute('aria-labelledby', b.id);
    s.appendChild(h('h3', 'mn-h', nombre));
    cont.appendChild(s); secs[id] = s;
  }

  // ── Piezas ──
  const radios = [];   // grupos de botones tipo radio: { k, el, poner(v) }
  function grupo(clase, etiqueta, ops, alElegir) {
    const g = h('div', clase); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', etiqueta);
    const bs = ops.map(([v, t, sub]) => {
      const b = h('button', 'mn-b'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1;
      b.appendChild(document.createTextNode(t)); if (sub != null) b.appendChild(h('small', '', sub));
      b._v = v; b.onclick = () => alElegir(v); g.appendChild(b); return b;
    });
    const o = { el: g, bs, poner(v) { let alguno = false; for (const b of bs) { const si = b._v === v; b.setAttribute('aria-checked', si ? 'true' : 'false'); b.tabIndex = si ? 0 : -1; if (si) alguno = true; } if (!alguno && bs[0]) bs[0].tabIndex = 0; } };
    radios.push(o); return o;
  }
  function interruptor(etiqueta, alCambiar) {
    const b = h('button', 'mn-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', 'false'); b.setAttribute('aria-label', etiqueta);
    b.onclick = () => alCambiar(b.getAttribute('aria-checked') !== 'true');
    return { el: b, poner(v) { b.setAttribute('aria-checked', v ? 'true' : 'false'); } };
  }
  function opcion(titulo, ayuda, control) {
    const f = h('div', 'mn-op'), t = h('div', 'mn-op-t');
    t.appendChild(h('b', '', titulo)); const sm = h('small', '', ayuda || ''); t.appendChild(sm);
    f.append(t, control); f._ayuda = sm; return f;
  }

  // ── GRAFICOS ──
  const sg = secs.graficos;
  const detec = h('p', 'mn-sub'); sg.appendChild(detec);
  const gNivel = grupo('mn-niveles', 'Calidad gráfica', [['auto', 'Automático', ''], ...NIVELES.map(n => [n, NOMBRE_NIVEL[n], null])], v => api.aplicarGfx({ nivel: v }));
  sg.appendChild(gNivel.el);
  const descNivel = h('p', 'mn-nota'); sg.appendChild(descNivel);
  const avisoRei = h('div', 'mn-aviso'); avisoRei.setAttribute('role', 'status');
  const bRei = h('button', 'mn-btn', 'Reiniciar gráficos'); bRei.type = 'button'; bRei.id = 'mn-reiniciar';
  bRei.onclick = () => { bRei.disabled = true; bRei.textContent = 'Reiniciando…'; setTimeout(() => location.reload(), 60); };
  avisoRei.append(h('span', '', 'El antialias y la vegetación cambian al reiniciar los gráficos. El juego vuelve a entrar solo.'), bRei);
  sg.appendChild(avisoRei);
  sg.appendChild(h('h4', 'mn-h2', 'Opciones avanzadas'));
  const dpr = Math.max(1, Math.round((window.devicePixelRatio || 1) * 100) / 100);
  const opsPx = [0.5, 0.6, 0.75, 1, 1.25, 1.5, 2].filter(v => v < Math.min(dpr, 2) - 0.01).map(v => [v, Math.round(v * 100) + ' %']);
  const pxTope = [0.5, 0.6, 0.75, 1, 1.25, 1.5, 2].find(v => v >= Math.min(dpr, 2) - 0.01) || 2;
  opsPx.push([pxTope, dpr > 1.01 ? 'Nativa' : '100 %']);
  const AV = [
    ['px', 'Escala de resolución', 'Menos resolución = más fluidez. Nunca supera la de tu pantalla.', opsPx],
    ['sombras', 'Sombras', 'Sombras del sol sobre el terreno y los personajes.', [[0, 'No'], [1, 'Normales'], [2, 'Detalladas']]],
    ['lejos', 'Distancia de visión', 'Hasta dónde se dibuja el mundo antes de la niebla.', [[105, 'Mínima'], [130, 'Corta'], [170, 'Media'], [230, 'Larga'], [290, 'Máxima']]],
    ['det', 'Vegetación y detalle', 'Cantidad de árboles, rocas y personajes a la vista.', [[0, 'Bajo'], [1, 'Medio'], [2, 'Alto']], true],
    ['fx', 'Partículas y efectos', 'Chispas, polvo y estelas de las habilidades.', [[0, 'Pocas'], [1, 'Normales'], [2, 'Todas']]],
    ['post', 'Resplandor y post-proceso', 'Brillo de la magia y color más vivo.', null],
    ['aa', 'Antialias', 'Bordes suaves.', null, true],
    ['fps', 'Límite de FPS', 'Menos FPS = menos batería y calor.', [[30, '30'], [45, '45'], [60, '60'], [0, 'Pantalla']]],
    ['din', 'Resolución dinámica', 'Si el juego va lento, baja sola la resolución y la recupera después.', null],
  ];
  const filasAv = {};
  for (const [k, titulo, ayuda, ops, rei] of AV) {
    const c = ops ? grupo('mn-seg', titulo, ops, v => api.aplicarGfx({ [k]: v })) : interruptor(titulo, v => api.aplicarGfx({ [k]: v }));
    const f = opcion(titulo, ayuda, c.el);
    if (rei) { const r = h('i', 'mn-rei', ' Pide reiniciar los gráficos.'); f._ayuda.appendChild(r); }
    f._c = c; filasAv[k] = f; sg.appendChild(f);
  }
  const swFps = interruptor('Contador de FPS', v => api.aplicarGfx({ verFps: v }));
  sg.appendChild(opcion('Contador de FPS', 'Cuadros por segundo, a un lado de la pantalla.', swFps.el));
  const hueco = { graficos: h('div'), controles: h('div'), interfaz: h('div'), ayuda: h('div') };
  sg.appendChild(hueco.graficos);
  const pieG = h('div', 'mn-pie'); const bAuto = h('button', 'mn-btn sec', 'Restablecer (Automático)'); bAuto.type = 'button'; bAuto.id = 'mn-restablecer';
  bAuto.onclick = () => api.aplicarGfx({ nivel: 'auto' }); pieG.appendChild(bAuto); sg.appendChild(pieG);

  function pintarGraficos() {
    detec.textContent = 'Detectado: gama ' + NOMBRE_NIVEL[G.detectado].toLowerCase() + (G.gpuCorta ? ' · ' + G.gpuCorta : '');
    gNivel.poner(G.nivel);
    gNivel.bs[0].lastChild.textContent = NOMBRE_NIVEL[G.detectado];
    descNivel.textContent = (G.nivel === 'auto' ? 'Elegimos por ti según tu equipo. ' : '') + DESC_NIVEL[G.efectivo] + (G.personalizado ? ' Las opciones con • las cambiaste tú.' : '');
    for (const k in filasAv) {
      const f = filasAv[k]; let v = G[k];
      if (k === 'px') v = v >= pxTope ? pxTope : opsPx.some(o => o[0] === v) ? v : pxTope;
      f._c.poner(v); f.classList.toggle('mn-propia', k in G.propio);
    }
    swFps.poner(G.verFps);
    avisoRei.classList.toggle('on', faltaReiniciar(G));
    bAuto.style.display = G.nivel === 'auto' && !G.personalizado ? 'none' : '';
  }

  // ── SONIDO ──
  const ss = secs.sonido;
  ss.appendChild(h('p', 'mn-sub', 'Música andina, ambiente y efectos del combate.'));
  const swSon = interruptor('Sonido del juego', () => { api.sonido.alternar(); pintarSonido(); });
  ss.appendChild(opcion('Sonido del juego', 'Apaga o enciende todo el audio.', swSon.el));
  function rango(k, etiqueta) {
    const c = h('div', 'mn-rango'), i = h('input'), o = h('output');
    i.type = 'range'; i.min = '0'; i.max = '100'; i.step = '5'; i.id = 'mn-vol-' + k; i.setAttribute('aria-label', etiqueta);
    i.oninput = () => { o.textContent = i.value + ' %'; api.sonido.volumen(k, i.value / 100); };
    i.addEventListener('keydown', e => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); });
    c.append(i, o);
    return { el: c, poner(v, activo) { i.value = String(Math.round(v * 100)); o.textContent = i.value + ' %'; i.disabled = !activo; c.style.opacity = activo ? '' : '.45'; } };
  }
  const rMus = rango('mus', 'Volumen de la música'), rFx = rango('fx', 'Volumen de los efectos');
  ss.appendChild(opcion('Música y ambiente', 'Charango, quena, viento y lluvia.', rMus.el));
  ss.appendChild(opcion('Efectos', 'Golpes, habilidades, botín y avisos.', rFx.el));
  function pintarSonido() {
    const on = api.sonido.activo();
    swSon.poner(on); rMus.poner(api.sonido.volumen('mus'), on); rFx.poner(api.sonido.volumen('fx'), on);
    tabs.sonido.firstChild.textContent = on ? '🔊' : '🔇';
  }

  // ── Lo que vivia en #v-ayuda: se muda con sus mismos ids ──
  secs.controles.appendChild(hueco.controles);
  secs.interfaz.appendChild(h('p', 'mn-sub', 'Tamaño del texto y respuesta del dispositivo.'));
  secs.interfaz.appendChild(hueco.interfaz);
  secs.ayuda.appendChild(hueco.ayuda);
  const teclado = h('details', 'mn-det'); teclado.appendChild(h('summary', '', 'Controles con teclado y ratón')); teclado.open = !api.movil;
  let aInicio = null, aClassic = null;
  try {
    const vieja = document.querySelector('#v-ayuda .ventana');
    let dest = 'graficos';
    for (const n of vieja ? [...vieja.children] : []) {
      const tiene = id => n.id === id || !!n.querySelector('#' + id);
      if (n.tagName === 'SCRIPT') continue;
      if (n.matches('.cerrar,h2')) { n.remove(); continue; }
      if (tiene('sel-calidad')) { n.remove(); continue; }
      if (tiene('sel-brillo')) { hueco.graficos.appendChild(n); continue; }
      if (tiene('sel-vib') || tiene('sel-texto')) { hueco.interfaz.appendChild(n); continue; }
      if (tiene('sel-mano')) { hueco.controles.appendChild(n); continue; }
      if (tiene('b-teclas')) { dest = 'teclado'; hueco.controles.appendChild(teclado); }
      else if (tiene('b-leyenda')) dest = 'ayuda';
      const enlaces = n.querySelector && n.querySelector('[data-instalar]') ? [...n.querySelectorAll('a')] : null;
      if (enlaces) {
        // Fila de enlaces del final: CLASSIC e Inicio pasan a «Salir» (con confirmacion); Instalar se queda en Ayuda.
        aClassic = enlaces.find(a => /\/mmo\//.test(a.getAttribute('href') || '')) || null;
        aInicio = enlaces.find(a => a !== aClassic && !a.hasAttribute('data-instalar')) || null;
        for (const a of [aClassic, aInicio]) if (a) { a.style.display = 'none'; a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); }
        hueco.ayuda.appendChild(n); continue;
      }
      if (dest === 'teclado') {
        // El parrafo «En el móvil…» va fuera del plegable (arriba en el celular).
        if (n.tagName === 'P') { if (api.movil) hueco.controles.insertBefore(n, hueco.controles.firstChild); else hueco.controles.appendChild(n); }
        else teclado.appendChild(n);
      } else (hueco[dest] || hueco.ayuda).appendChild(n);
    }
  } catch (e) { console.warn('[menu] no se pudo mudar la ventana de ajustes', e); }

  // ── SALIR ──
  const sl = secs.salir;
  const tg = api.tg || null;
  sl.appendChild(h('p', 'mn-sub', 'Tu duende se guarda solo en el servidor: al salir no pierdes nada.'));
  const salidas = h('div', 'mn-sal'); sl.appendChild(salidas);
  const conf = h('div', 'mn-conf'); conf.setAttribute('role', 'alertdialog'); conf.setAttribute('aria-label', 'Confirmar salida');
  const confP = h('p'), confOjo = h('p', 'mn-ojo'), confPie = h('div', 'mn-pie');
  const bNo = h('button', 'mn-btn sec', 'Seguir jugando'); bNo.type = 'button';
  const bSi = h('button', 'mn-btn', 'Salir'); bSi.type = 'button'; bSi.id = 'mn-salir-si';
  confPie.append(bNo, bSi); conf.append(confP, confOjo, confPie); sl.appendChild(conf);
  let salidaPend = null;
  function pedirSalida(pregunta, etiqueta, hacer) {
    salidaPend = hacer;
    confP.textContent = pregunta + ' Tu duende se guarda solo.';
    const ojos = [];
    try { if (api.enCombate && api.enCombate()) ojos.push(api.enAbismo && api.enAbismo() ? '⚠ Estás en combate: en el Abismo, salir en plena pelea cuenta como caer.' : '⚠ Estás en combate: mejor termina la pelea antes de salir.'); } catch (e) {}
    try { const y = api.yo && api.yo(); if (api.invitado && api.invitado() && y && (y.nivel || 1) < 2) ojos.push('Acabas de entrar como invitado: juega al menos un minuto para que tu duende quede guardado.'); } catch (e) {}
    confOjo.textContent = ojos.join(' '); confOjo.style.display = ojos.length ? '' : 'none';
    bSi.textContent = etiqueta; conf.classList.add('on'); salidas.style.display = 'none';
    try { bNo.focus(); } catch (e) {}
  }
  function cancelarSalida() { if (!conf.classList.contains('on')) return false; conf.classList.remove('on'); salidas.style.display = ''; salidaPend = null; return true; }
  bNo.onclick = () => { cancelarSalida(); try { salidas.querySelector('button').focus(); } catch (e) {} };
  bSi.onclick = () => { const f = salidaPend; salidaPend = null; if (f) { bSi.disabled = true; try { f(); } catch (e) { bSi.disabled = false; } } };
  const salida = (ic, txt, sub, alTocar) => { const b = h('button', 'mn-sal-b'); b.type = 'button'; const i = h('i', '', ic); i.setAttribute('aria-hidden', 'true'); const d = h('div'); d.append(document.createTextNode(txt), h('small', '', sub)); b.append(i, d); b.onclick = alTocar; salidas.appendChild(b); return b; };
  const href = (a, porDefecto) => (a && a.getAttribute('href')) || porDefecto;
  salida('⌂', 'Volver al inicio', tg ? 'Al menú de Duende Quest en Telegram.' : 'A la portada de Duende Quest.', () => pedirSalida('¿Volver al inicio?', 'Volver al inicio', () => api.irA(href(aInicio, '/inicio/')))).id = 'mn-salir-inicio';
  salida('🎮', 'Ir a CLASSIC (2D)', 'El mismo duende, en el mundo 2D (mazmorras, Torre y banda).', () => pedirSalida('¿Pasar a CLASSIC (2D)?', 'Ir a CLASSIC', () => api.irA(href(aClassic, '/mmo/')))).id = 'mn-salir-classic';
  if (tg && typeof tg.close === 'function') salida('🚪', 'Cerrar el juego', 'Cierra Duende Quest y vuelve al chat de Telegram.', () => pedirSalida('¿Cerrar el juego?', 'Cerrar el juego', () => tg.close())).id = 'mn-salir-cerrar';

  // ── Contador de FPS (un texto cada medio segundo; nada por cuadro) ──
  const fpsEl = h('div'); fpsEl.id = 'dq-fps'; fpsEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(fpsEl);
  let fpsT = 0, fpsN = 0, fpsMs = 0, fpsAntes = -1;
  function tictacFps() {
    const ah = performance.now(), n = G.cuadros;
    if (fpsMs) { const v = Math.round((n - fpsN) * 1000 / Math.max(1, ah - fpsMs)); if (v !== fpsAntes) { fpsAntes = v; fpsEl.textContent = v + ' FPS'; } }
    fpsN = n; fpsMs = ah;
  }
  function pintarFps() {
    fpsEl.classList.toggle('on', !!G.verFps);
    if (G.verFps && !fpsT) { fpsMs = 0; fpsAntes = -1; fpsEl.textContent = ''; fpsT = setInterval(tictacFps, 500); }
    else if (!G.verFps && fpsT) { clearInterval(fpsT); fpsT = 0; }
  }

  // ── Navegacion ──
  let actual = 'graficos', abriendo = false;
  const estrecho = () => { try { return matchMedia('(max-width:640px) and (min-height:501px)').matches; } catch (e) { return false; } };
  const nombreSec = id => (SECCIONES.find(s => s[0] === id) || [])[2] || 'Menú';
  function mostrar(id, detalle) {
    if (!secs[id]) id = 'graficos';
    actual = id; cancelarSalida();
    for (const k in secs) { secs[k].classList.toggle('on', k === id); tabs[k].setAttribute('aria-selected', k === id ? 'true' : 'false'); }
    caja.classList.toggle('mn-det-on', !!detalle);
    tit.textContent = detalle && estrecho() ? nombreSec(id) : 'Menú';
    cont.scrollTop = 0;
    if (id === 'graficos') pintarGraficos(); else if (id === 'sonido') pintarSonido();
  }
  function alRaiz() { caja.classList.remove('mn-det-on'); tit.textContent = 'Menú'; cancelarSalida(); try { tabs[actual].focus(); } catch (e) {} }
  nav.addEventListener('click', e => { const b = e.target.closest('.mn-it'); if (!b) return; if (b === bSeguir) return cerrar(); mostrar(b.dataset.sec, true); if (estrecho()) { try { bVolver.focus(); } catch (er) {} } });
  bVolver.onclick = alRaiz;
  bX.onclick = () => cerrar();
  raiz.addEventListener('pointerdown', e => { if (e.target === raiz) cerrar(); });

  const abierto = () => raiz.classList.contains('on');
  const BLOQUEAN = ['v-inicio', 'v-clase', 'v-muerte', 'v-error', 'v-pago'];
  function abrir(seccion) {
    if (abriendo) return;
    if (abierto()) { if (seccion) mostrar(seccion, true); return; }
    if (BLOQUEAN.some(id => { const m = $(id); return m && m.classList.contains('on'); })) return;
    abriendo = true;
    try { if (api.alAbrir) api.alAbrir(); } catch (e) {}
    abriendo = false;
    mostrar(seccion || actual, !!seccion);
    api.abrirModal('v-menu');
    setTimeout(() => { try { (seccion && estrecho() ? bVolver : seccion ? tabs[actual] : bSeguir).focus({ preventScroll: true }); } catch (e) {} }, 30);
  }
  function cerrar() { if (!abierto()) return; cancelarSalida(); api.cerrarModal('v-menu'); try { if (raiz.contains(document.activeElement)) document.activeElement.blur(); } catch (e) {} }
  // Atras (Android / Telegram): confirmacion -> lista de secciones -> cerrar. Devuelve true si ya lo atendio.
  function atras() { if (!abierto()) return false; if (cancelarSalida()) return true; if (estrecho() && caja.classList.contains('mn-det-on')) { alRaiz(); return true; } return false; }

  // Teclado: Esc, foco atrapado, flechas en la lista de secciones y en los grupos de opciones.
  const visibles = () => [...caja.querySelectorAll('button,a[href],select,input,summary,[tabindex]')].filter(e => !e.disabled && e.tabIndex >= 0 && e.offsetParent !== null);
  raiz.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Escape') {
      if (t && t.matches && t.matches('#lista-teclas *')) return;   // captura de teclas: la cancela mundo.js
      e.preventDefault(); e.stopPropagation();
      if (!cancelarSalida()) cerrar();
      return;
    }
    if (e.key === 'Tab') {
      const fs = visibles(); if (!fs.length) return;
      const i = fs.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); fs[fs.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
      return;
    }
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (!dir || !t || !t.closest) return;
    if (t.closest('.mn-nav')) {
      if (e.key === 'ArrowRight' && !estrecho()) { e.preventDefault(); const f = visibles().find(x => cont.contains(x)); if (f) f.focus(); return; }
      if (e.key === 'ArrowLeft') return;
      const its = [...nav.querySelectorAll('.mn-it')], i = its.indexOf(t.closest('.mn-it'));
      const s = its[(i + dir + its.length) % its.length];
      e.preventDefault(); s.focus(); if (!estrecho() && s.dataset.sec) mostrar(s.dataset.sec, false);
      return;
    }
    const g = t.closest('[role="radiogroup"]');
    if (g && t.getAttribute('role') === 'radio') {
      const bs = [...g.querySelectorAll('[role="radio"]')], s = bs[(bs.indexOf(t) + dir + bs.length) % bs.length];
      e.preventDefault(); s.focus(); s.click();
    }
  });

  // ── Boton del HUD ──
  // El ⚙ ya viene en index.html (#b-menu, con su hueco en el HUD del celular); si faltara, se crea.
  let bMenu = $('b-menu');
  const bMenuNuevo = !bMenu;
  if (!bMenu) { bMenu = h('button', 'bt', '⚙'); bMenu.id = 'b-menu'; bMenu.type = 'button'; bMenu.title = 'Menú: gráficos, sonido y salir (Esc)'; bMenu.setAttribute('aria-label', 'Menú del juego'); bMenu.dataset.l = 'Menú'; }
  bMenu.onclick = () => { if (abierto()) cerrar(); else abrir(); };
  const botones = $('botones'), bMas = $('b-mas');
  if (botones && bMenuNuevo) { if (bMas && bMas.parentNode === botones) botones.insertBefore(bMenu, bMas); else botones.appendChild(bMenu); }

  function refrescar() { pintarFps(); if (abierto()) { if (actual === 'graficos') pintarGraficos(); else if (actual === 'sonido') pintarSonido(); } }
  pintarFps(); mostrar('graficos', false);
  const M = { abrir, cerrar, abierto, atras, refrescar, alternar: () => (abierto() ? cerrar() : abrir()) };
  window.dqMenu = M;
  return M;
}
