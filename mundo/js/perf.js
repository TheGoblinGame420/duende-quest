// ═══════════════════════════════════════════════════════
// Medidor de rendimiento de ORIGINS (window.dqPerf). Sin dependencias y sin
// asignar memoria por cuadro: anillos de numeros de tamaño fijo.
//
//   PERF.ini(render)      una vez, con el WebGLRenderer
//   PERF.a()              al empezar el trabajo de un cuadro
//   PERF.b()              justo antes de dibujar (fin de la logica JS)
//   PERF.c()              justo despues de dibujar
//
//   dqPerf.muestra()      resumen desde el ultimo reiniciar(): media, p95, p99 y
//                         peor cuadro (total, logica JS, render e intervalo entre
//                         cuadros), llamadas de dibujo, triangulos, geometrias,
//                         texturas, tareas largas y MB de heap si el navegador lo da
//   dqPerf.reiniciar()    empieza una medicion nueva
//   dqPerf.panel(bool)    panel discreto de FPS (lo enciende el menu de ajustes)
// ═══════════════════════════════════════════════════════
const N = 3600;   // cuadros que caben (1 min a 60 fps); despues pisa los mas viejos
const total = new Float32Array(N), logica = new Float32Array(N), dibujo = new Float32Array(N), entre = new Float32Array(N);
const llamadas = new Uint16Array(N), tris = new Uint32Array(N);
const orden = new Float32Array(N);   // copia para ordenar en muestra() (no por cuadro)
let n = 0, i = 0, tA = 0, tB = 0, tAntes = 0, desde = 0, info = null, escena = null;
let largas = 0, largasMs = 0, largaPeor = 0;
let caja = null, panelT = 0, panelN = 0, panelMs = 0, panelPeor = 0;
const ahora = () => performance.now();

try {
  new PerformanceObserver(l => { for (const e of l.getEntries()) { largas++; largasMs += e.duration; if (e.duration > largaPeor) largaPeor = e.duration; } }).observe({ entryTypes: ['longtask'] });
} catch (e) {}

function ini(render, raiz) {
  escena = raiz || null;
  // Con post-proceso cada pasada pondria el contador a cero: se reinicia a mano una vez por cuadro.
  try { info = render.info; info.autoReset = false; } catch (e) { info = null; }
  desde = ahora();
}
function a() {
  tA = ahora();
  if (info) info.reset();
}
function b() { tB = ahora(); }
function c() {
  const tC = ahora();
  total[i] = tC - tA; logica[i] = tB - tA; dibujo[i] = tC - tB;
  entre[i] = tAntes ? tA - tAntes : 0; tAntes = tA;
  if (info) { llamadas[i] = info.render.calls; tris[i] = info.render.triangles; }
  i = (i + 1) % N; if (n < N) n++;
  if (caja) {
    panelN++; panelMs += tC - tA; if (tC - tA > panelPeor) panelPeor = tC - tA;
    if (tC - panelT >= 500) {
      const fps = panelN * 1000 / (tC - panelT);
      caja.textContent = fps.toFixed(0) + ' FPS · ' + (panelMs / panelN).toFixed(1) + ' ms' + (panelPeor > 34 ? ' · pico ' + panelPeor.toFixed(0) : '') + (info ? ' · ' + info.render.calls + ' dib' : '');
      panelT = tC; panelN = 0; panelMs = 0; panelPeor = 0;
    }
  }
}
function reiniciar() { n = 0; i = 0; tAntes = 0; largas = 0; largasMs = 0; largaPeor = 0; desde = ahora(); }

function resumen(v) {
  if (!n) return { media: 0, p50: 0, p95: 0, p99: 0, peor: 0 };
  let s = 0;
  for (let k = 0; k < n; k++) { s += v[k]; orden[k] = v[k]; }
  const o = orden.subarray(0, n); o.sort();
  const q = p => +o[Math.min(n - 1, Math.floor(n * p))].toFixed(2);
  return { media: +(s / n).toFixed(2), p50: q(0.5), p95: q(0.95), p99: q(0.99), peor: +o[n - 1].toFixed(2) };
}
function media(v) { let s = 0; for (let k = 0; k < n; k++) s += v[k]; return n ? Math.round(s / n) : 0; }
function maximo(v) { let m = 0; for (let k = 0; k < n; k++) if (v[k] > m) m = v[k]; return m; }

function muestra() {
  const seg = (ahora() - desde) / 1000;
  const r = {
    cuadros: n, segundos: +seg.toFixed(1), fps: seg > 0 ? +(n / seg).toFixed(1) : 0,
    total: resumen(total), logica: resumen(logica), render: resumen(dibujo), entre: resumen(entre),
    llamadas: media(llamadas), llamadasMax: maximo(llamadas), triangulos: media(tris), triangulosMax: maximo(tris),
    geometrias: info ? info.memory.geometries : 0, texturas: info ? info.memory.textures : 0, programas: info && info.programs ? info.programs.length : 0,
    tareasLargas: largas, tareasLargasMs: Math.round(largasMs), tareaLargaPeor: Math.round(largaPeor),
  };
  // Cuadros que llegaron tarde: mas de 1,5 veces el intervalo habitual (la mediana).
  let tarde = 0; const lim = r.entre.p50 * 1.5;
  for (let k = 0; k < n; k++) if (entre[k] > lim) tarde++;
  r.tarde = tarde;
  try { if (performance.memory) r.heapMB = +(performance.memory.usedJSHeapSize / 1048576).toFixed(1); } catch (e) {}
  return r;
}

function panel(si) {
  if (!si) { if (caja) { caja.remove(); caja = null; } return; }
  if (caja) return;
  caja = document.createElement('div');
  caja.id = 'dq-fps';
  caja.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 2px);transform:translateX(-50%);z-index:60;pointer-events:none;padding:2px 8px;border-radius:8px;background:rgba(8,10,22,.6);color:#e9dcb4;font:11px/1.4 ui-monospace,Menlo,Consolas,monospace;white-space:nowrap';
  document.body.appendChild(caja);
  panelT = ahora(); panelN = 0; panelMs = 0; panelPeor = 0;
}

// Censo de la escena (para depurar, no por cuadro): cuantos objetos recorre three en cada cuadro
// y cuantos recalculan su matriz. Con `detalle`, el tamaño de cada rama de primer nivel.
function censo(detalle) {
  if (!escena) return null;
  const r = { objetos: 0, visibles: 0, mallas: 0, mallasVisibles: 0, recalculan: 0, recorridos: 0 };
  const contar = (o, vis, rec) => {
    r.objetos++; if (vis) r.visibles++;
    if (rec) { r.recorridos++; if (o.matrixAutoUpdate) r.recalculan++; }
    if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { r.mallas++; if (vis) r.mallasVisibles++; }
    for (const h of o.children) contar(h, vis && h.visible, rec && h.matrixWorldAutoUpdate);
  };
  contar(escena, true, true);
  if (detalle) {
    r.ramas = escena.children.map(h => { let k = 0, m = 0; h.traverse(x => { k++; if (x.matrixAutoUpdate) m++; }); return [k, m, h.visible ? 1 : 0, h.type + (h.name ? ':' + h.name : '')]; }).filter(x => x[0] >= detalle).sort((x, y) => y[0] - x[0]);
  }
  return r;
}

export const PERF = { ini, a, b, c, muestra, reiniciar, panel, censo };
try { window.dqPerf = { muestra, reiniciar, panel, censo, escena: () => escena }; } catch (e) {}
