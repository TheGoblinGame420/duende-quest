// ═══════════════════════════════════════════════════════
// Medicion de la fluidez de ORIGINS (/mundo/): como se mueve el duende, como
// lo sigue la camara y como se ven los demas (otro jugador y los monstruos).
//
//   PUERTO=8802 DATOS=/tmp/x.json node tools/mmo_local.mjs     (en otra terminal)
//   node tools/qa_movimiento.mjs [http://localhost:8802] [salida.json] [carpeta de capturas]
//
// Abre dos clientes invitados sin ventana: A observa y luego camina; B camina
// en circulo cerca de A. Cada cuadro de A se apunta la posicion dibujada del
// duende, de la camara, de B y de los monstruos que se mueven, y de ahi salen:
//   - irregularidad: desviacion de la velocidad entre cuadros (m/s), y en % de la media;
//   - tirones: cuadros en que la velocidad se aparta mas de un 50 % de su media movil;
//   - paradas: cuadros casi quietos en mitad de un tramo en marcha;
//   - giro maximo por cuadro (grados) del cuerpo dibujado;
//   - camara: salto maximo por cuadro respecto al duende y vibracion de la distancia.
// Se mide dos veces: con la red limpia y con retardos al azar de 0-150 ms en
// los mensajes que llegan (como una red movil).
// El Chrome sin ventana dibuja por software: sirve para comparar antes/despues,
// no para medir FPS reales. tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import { abrirNavegador } from './cdp.mjs';

const BASE = (process.argv[2] || 'http://localhost:8802').replace(/\/$/, '');
const SALIDA = process.argv[3] || '';
const FOTOS = process.argv[4] || '';

// Antes de cargar el juego: los mensajes del socket pueden llegar con un retardo al azar (en orden).
const RED = `(() => {
  const J = window.__qaRed = { ms: 0, ult: 0, sinFotos: false };
  const env = h => typeof h !== 'function' ? h : function (ev) {
    // En la prueba de laboratorio las fotos las pone el guion (las del servidor se descartan).
    if (J.sinFotos && typeof ev.data === 'string' && ev.data.startsWith('{"t":"s3"')) return;
    if (!J.ms) return h.call(this, ev);
    const t = Math.max(J.ult, performance.now() + Math.random() * J.ms); J.ult = t;
    setTimeout(() => h.call(this, ev), Math.max(0, t - performance.now()));
  };
  const d = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  Object.defineProperty(WebSocket.prototype, 'onmessage', { configurable: true, get() { return d.get.call(this); }, set(h) { d.set.call(this, env(h)); } });
  const ael = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function (tipo, h, o) { return ael.call(this, tipo, tipo === 'message' ? env(h) : h, o); };
})()`;

// Grabadora por cuadro (dentro de la pagina de A). Sin asignar por cuadro mas que los numeros de la fila.
const GRABAR = `(() => {
  const Q = window.__qa = { on: false, f: [], ids: null };
  const paso = t => {
    requestAnimationFrame(paso);
    if (!Q.on) return;
    const d = window.__dq3, P = d.P, c = d.cam.position;
    // Solo los cuadros que el juego dibujo de verdad (en reposo va a 30 fps y el navegador a 60).
    if (d.nCuadro === Q.n) return; Q.n = d.nCuadro;
    const fila = [t, P.x, P.y, P.z, P.ry, c.x, c.y, c.z];
    if (!Q.ids) {
      // B (el otro jugador) y los monstruos a menos de 60 m (los quietos se descartan al calcular).
      const ms = [...d.mons.values()].filter(o => !o.muereT).map(o => [o.id, Math.hypot(o.x - P.x, o.z - P.z)]).filter(a => a[1] < 60).sort((a, b) => a[1] - b[1]).slice(0, 14).map(a => a[0]);
      Q.ids = { o: [...d.otros.keys()].slice(0, 1), m: ms };
    }
    for (const id of Q.ids.o) { const o = d.otros.get(id); if (o) fila.push(o.x, o.y || 0, o.z, o.ryV !== undefined ? o.ryV : o.ry); else fila.push(NaN, NaN, NaN, NaN); }
    for (const id of Q.ids.m) { const o = d.mons.get(id); if (o && !o.muereT) fila.push(o.x, 0, o.z, o.ryV !== undefined ? o.ryV : o.ry); else fila.push(NaN, NaN, NaN, NaN); }
    Q.f.push(fila);
  };
  requestAnimationFrame(paso);
})()`;

// Laboratorio: figuras con trayectoria conocida, servidas como lo haria el servidor (foto cada 200 ms,
// posiciones redondeadas a 0,1 m). El jugador-fantasma camina en circulo a 7 m/s y "envia" su posicion
// cada 203 ms (sin compas con las fotos, como un cliente real); un monstruo corre en circulo a 4 m/s y
// otro pasea en linea a 1,2 m/s. Con G.J > 0 las fotos llegan con un retardo al azar (en orden).
const FANTASMAS = `(() => {
  const d = __dq3, P = d.P, t0 = performance.now();
  const G = window.__qaG = { on: true, J: 0, ult: 0, t0, cx: P.x, cz: P.z - 16, R: 10, W: 0.7, R1: 8, W1: 0.5, idP: 990001, idM1: 990002, idM2: 990003 };
  const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
  G.pj = t => { const a = G.W * (t - t0) / 1000; return [G.cx + G.R * Math.sin(a), G.cz + G.R * Math.cos(a), Math.atan2(Math.cos(a), -Math.sin(a))]; };
  G.m1 = t => { const a = -G.W1 * (t - t0) / 1000; return [G.cx + G.R1 * Math.sin(a), G.cz + G.R1 * Math.cos(a), Math.atan2(-Math.cos(a), Math.sin(a))]; };
  G.m2 = t => { const s = ((t - t0) / 1000 * 1.2) % 24, u = s < 12 ? s : 24 - s; return [G.cx - 6 + u, G.cz + 13, s < 12 ? Math.PI / 2 : -Math.PI / 2]; };
  const k = ([...d.mons.values()][0] || { k: 'goblin_normal' }).k;
  __qaRed.sinFotos = true;
  { const p = G.pj(t0); d.recibir({ t: 'pj3', p: { id: G.idP, x: r1(p[0]), z: r1(p[1]), r: 0, hp: 100, mx: 100, n: 'Sombra', lv: 1 } }); }
  let n = 0, nuevos = true;
  const entregar = m => { try { m.hp = d.yo.hp; m.rec = d.yo.rec; d.recibir(m); } catch (e) { console.error('fantasmas: ' + e.message); } };
  G.iv = setInterval(() => {
    const ahora = performance.now();
    while (G.on && ahora >= t0 + n * 200) {
      const T = t0 + n * 200; n++;
      const p = G.pj(t0 + Math.floor((T - t0) / 203) * 203), a = G.m1(T), b = G.m2(T);
      const m = { t: 's3', ts: Math.round(performance.timeOrigin + T), p: [[G.idP, r1(p[0]), r1(p[1]), r2(p[2]), 1, 100, 100, 0, 0]], m: nuevos ? [] : [[G.idM1, r1(a[0]), r1(a[1]), r2(a[2]), 50, 1], [G.idM2, r1(b[0]), r1(b[1]), r2(b[2]), 50, 0]], cb: 0 };
      if (nuevos) { m.n = [{ id: G.idM1, k, nv: 1, x: r1(a[0]), z: r1(a[1]), hp: 50, mx: 50, j: 0 }, { id: G.idM2, k, nv: 1, x: r1(b[0]), z: r1(b[1]), hp: 50, mx: 50, j: 0 }]; nuevos = false; }
      if (!G.J) entregar(m);
      else { const te = Math.max(G.ult, T + Math.random() * G.J); G.ult = te; setTimeout(() => entregar(m), Math.max(0, te - performance.now())); }
    }
  }, 5);
  return JSON.stringify(G);
})()`;
// Fantasmas contra su trayectoria real: ademas de la irregularidad, el retraso medio (ms) y cuanto baila (ms).
function medirFantasmas(F, G) {
  const ent = k => F.map(a => [a[0], a[8 + k * 4], a[8 + k * 4 + 2], a[8 + k * 4 + 3]]);
  const circulo = (fs_, cx, cz, R, W) => {
    const lag = [], rad = [];
    for (const a of fs_) { if (!Number.isFinite(a[1])) continue; const th = Math.atan2(a[1] - cx, a[2] - cz), real = W * (a[0] - G.t0) / 1000; lag.push(Math.atan2(Math.sin(real - th), Math.cos(real - th)) / W * 1000); rad.push(Math.hypot(a[1] - cx, a[2] - cz) - R); }
    return { retrasoMs: Math.round(media(lag)), baileMs: Math.round(desv(lag)), errRadio: r2(Math.sqrt(media(rad.map(x => x * x)))) };
  };
  return {
    jugador: { ...medirEntidad(ent(0)), ...circulo(ent(0), G.cx, G.cz, G.R, G.W) },
    monCorre: { ...medirEntidad(ent(1)), ...circulo(ent(1), G.cx, G.cz, G.R1, -G.W1) },
    monPasea: medirEntidad(ent(2)),
  };
}

const tecla = (nav, code, abajo) => nav.js(`dispatchEvent(new KeyboardEvent('${abajo ? 'keydown' : 'keyup'}', { code: '${code}', key: '${code === 'Space' ? ' ' : code.slice(3).toLowerCase()}', bubbles: true })); 1`);
const r2 = x => Math.round(x * 100) / 100;
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const desv = a => { const m = media(a); return Math.sqrt(media(a.map(x => (x - m) ** 2))); };
const dAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// Metricas de una entidad: filas [t, x, z, ry]. Solo cuentan los tramos en marcha (media movil > 0,8 m/s).
function medirEntidad(fs_) {
  const f = fs_.filter(a => Number.isFinite(a[1]));
  if (f.length < 30) return null;
  const v = [], g = [], ts = [];
  for (let i = 1; i < f.length; i++) {
    const dt = (f[i][0] - f[i - 1][0]) / 1000;
    if (dt <= 0 || dt > 0.25) { v.push(NaN); g.push(0); ts.push(f[i][0]); continue; }
    v.push(Math.hypot(f[i][1] - f[i - 1][1], f[i][2] - f[i - 1][2]) / dt); g.push(dAng(f[i][3], f[i - 1][3]) * 180 / Math.PI); ts.push(f[i][0]);
  }
  // Media movil de 500 ms centrada.
  const mm = v.map((_, i) => { const a = []; for (let j = i; j >= 0 && ts[i] - ts[j] < 250; j--) if (Number.isFinite(v[j])) a.push(v[j]); for (let j = i + 1; j < v.length && ts[j] - ts[i] < 250; j++) if (Number.isFinite(v[j])) a.push(v[j]); return media(a); });
  const idx = v.map((x, i) => i).filter(i => Number.isFinite(v[i]) && mm[i] > 0.8);
  if (idx.length < 20) return null;
  const rel = idx.map(i => (v[i] - mm[i]) / mm[i]);
  const dv = []; for (let k = 1; k < idx.length; k++) if (idx[k] === idx[k - 1] + 1) dv.push(v[idx[k]] - v[idx[k - 1]]);
  return {
    cuadros: idx.length, vMedia: r2(media(idx.map(i => v[i]))),
    irregPct: r2(100 * Math.sqrt(media(rel.map(x => x * x)))),
    jerk: r2(Math.sqrt(media(dv.map(x => x * x)))),
    tirones: rel.filter(x => Math.abs(x) > 0.5).length,
    paradas: idx.filter(i => v[i] < 0.15 * mm[i]).length,
    giroMax: r2(Math.max(...idx.map(i => g[i]))),
    pasoMax: r2(Math.max(...idx.map(i => v[i] * (ts[i] - (ts[i - 1] ?? ts[i])) / 1000))),
  };
}
function medirTramo(F, ids) {
  const out = { cuadros: F.length, fps: r2(1000 * (F.length - 1) / (F[F.length - 1][0] - F[0][0])) };
  const ent = k => F.map(a => [a[0], a[8 + k * 4], a[8 + k * 4 + 2], a[8 + k * 4 + 3]]);
  out.jugadorB = ids.o.length ? medirEntidad(ent(0)) : null;
  const ms = [];
  for (let k = 0; k < ids.m.length; k++) { const r = medirEntidad(ent(ids.o.length + k)); if (r) ms.push(r); }
  ms.sort((a, b) => b.cuadros - a.cuadros);
  const top = ms.slice(0, 3);
  out.monstruos = top.length ? { n: top.length, vMedia: r2(media(top.map(m => m.vMedia))), irregPct: r2(media(top.map(m => m.irregPct))), jerk: r2(media(top.map(m => m.jerk))), tirones: top.reduce((s, m) => s + m.tirones, 0), paradas: top.reduce((s, m) => s + m.paradas, 0), giroMax: r2(Math.max(...top.map(m => m.giroMax))) } : null;
  return out;
}
// El propio duende y su camara: filas completas.
function medirPropio(F) {
  const yo = medirEntidad(F.map(a => [a[0], a[1], a[3], a[4]]));
  // Camara respecto al duende: la distancia no deberia vibrar y el desplazamiento relativo por cuadro deberia ser pequeño.
  const rel = F.map(a => [a[5] - a[1], a[6] - a[2], a[7] - a[3]]);
  const dist = rel.map(r => Math.hypot(r[0], r[1], r[2]));
  const salto = [], dd = [];
  for (let i = 1; i < F.length; i++) { salto.push(Math.hypot(rel[i][0] - rel[i - 1][0], rel[i][1] - rel[i - 1][1], rel[i][2] - rel[i - 1][2])); dd.push(dist[i] - dist[i - 1]); }
  const d2 = []; for (let i = 1; i < dd.length; i++) d2.push(dd[i] - dd[i - 1]);
  return { yo, cam: { saltoMax: r2(Math.max(...salto)), saltoMedio: r2(media(salto) * 100) / 100, vibracion: Math.round(desv(d2) * 10000) / 10000 } };
}
// Arranque y frenado: ms hasta el 90 % de la velocidad y hasta parar (< 0,3 m/s).
function medirRespuesta(F, tPulsa, tSuelta) {
  const v = []; for (let i = 1; i < F.length; i++) { const dt = (F[i][0] - F[i - 1][0]) / 1000; v.push([F[i][0], dt > 0 ? Math.hypot(F[i][1] - F[i - 1][1], F[i][3] - F[i - 1][3]) / dt : 0]); }
  const cru = v.filter(a => a[0] > tPulsa + 600 && a[0] < tSuelta - 100).map(a => a[1]); const vc = media(cru);
  const a90 = v.find(a => a[0] >= tPulsa && a[1] >= 0.9 * vc), par = v.find(a => a[0] >= tSuelta && a[1] < 0.3);
  let desl = 0; for (let i = 1; i < F.length; i++) if (F[i][0] > tSuelta) desl += Math.hypot(F[i][1] - F[i - 1][1], F[i][3] - F[i - 1][3]);
  return { vCrucero: r2(vc), msAl90: a90 ? Math.round(a90[0] - tPulsa) : null, msParar: par ? Math.round(par[0] - tSuelta) : null, mDesliza: r2(desl) };
}

const A = await abrirNavegador({ ancho: 640, alto: 400 });
const B = await abrirNavegador({ ancho: 320, alto: 200 });
const res = {};
try {
  for (const n of [A, B]) { await n.cmd('Page.addScriptToEvaluateOnNewDocument', { source: RED }); await n.ir(BASE + '/mundo/'); }
  for (const n of [A, B]) {
    try { await n.esperarA('!!(window.__dq3 && __dq3.yo && __dq3.P.fig)', 90000); }
    catch (e) { console.error(n === A ? 'A' : 'B', 'no entró:', await n.js('String(window.__dqProg) + " | " + document.body.innerText.replace(/\\s+/g, " ").slice(0, 300)').catch(x => String(x)), n.consola.slice(-6).join(' // ')); throw e; }
  }
  await A.esperar(2500);
  for (const n of [A, B]) await n.js(`document.querySelectorAll('.ventana.on, .modal.on').forEach(m => m.classList.remove('on')); 1`);
  await A.esperarA('__dq3.otros.size > 0', 20000);
  await A.js(GRABAR);
  // B camina en circulo (W + la camara girando: 0,7 rad/s a 7 m/s = 10 m de radio) junto a A.
  await B.js(`window.__qaGiro = setInterval(() => { const d = __dq3; d.camara(d.camYaw + 0.7 * 0.05); }, 50); 1`);
  await tecla(B, 'KeyW', true);
  await A.esperar(1500);

  for (const [nombre, ms] of [['redLimpia', 0], ['redMovil', 150]]) {
    await A.js(`__qaRed.ms = ${ms}; __qa.f = []; __qa.ids = null; __qa.on = true; 1`);
    await A.esperar(8000);
    const d = JSON.parse(await A.js(`__qa.on = false; JSON.stringify({ f: __qa.f, ids: __qa.ids })`));
    res[nombre] = medirTramo(d.f, d.ids);
    if (FOTOS) await A.foto(`${FOTOS}/mov-${nombre}.png`);
  }
  await A.js(`__qaRed.ms = 0; 1`);
  await tecla(B, 'KeyW', false);

  // Laboratorio (no depende de la carga de la maquina ni del segundo cliente).
  const G = JSON.parse(await A.js(FANTASMAS));
  await A.esperar(2500);
  for (const [nombre, ms] of [['labLimpia', 0], ['labMovil', 150]]) {
    await A.js(`__qaG.J = ${ms}; 1`);
    await A.esperar(2500);
    await A.js(`__qa.f = []; __qa.ids = { o: [${G.idP}], m: [${G.idM1}, ${G.idM2}] }; __qa.on = true; 1`);
    await A.esperar(12000);
    const d = JSON.parse(await A.js(`__qa.on = false; JSON.stringify(__qa.f)`));
    res[nombre] = { cuadros: d.length, fps: r2(1000 * (d.length - 1) / (d[d.length - 1][0] - d[0][0])), ...medirFantasmas(d, G) };
    if (FOTOS) await A.foto(`${FOTOS}/mov-${nombre}.png`);
  }
  await A.js(`__qaG.on = false; clearInterval(__qaG.iv); __qaRed.sinFotos = false; 1`);
  await A.esperar(1500);

  // El propio duende: adelante 3 s, soltar; luego en diagonal girando la camara (curva) 4 s.
  await A.js(`__qa.f = []; __qa.on = true; 1`);
  await A.esperar(300);
  const t1 = await A.js(`performance.now()`); await tecla(A, 'KeyW', true);
  await A.esperar(3000);
  const t2 = await A.js(`performance.now()`); await tecla(A, 'KeyW', false);
  await A.esperar(1200);
  let d = JSON.parse(await A.js(`__qa.on = false; JSON.stringify(__qa.f)`));
  res.respuesta = medirRespuesta(d, t1, t2);
  res.recta = medirPropio(d.filter(a => a[0] > t1 + 500 && a[0] < t2));
  await A.js(`__qa.f = []; __qa.on = true; window.__qaGiro = setInterval(() => { const d = __dq3; d.camara(d.camYaw + 0.9 * 0.05); }, 50); 1`);
  await tecla(A, 'KeyW', true);
  await A.esperar(4500);
  await tecla(A, 'KeyW', false);
  d = JSON.parse(await A.js(`clearInterval(__qaGiro); __qa.on = false; JSON.stringify(__qa.f)`));
  res.curva = medirPropio(d.slice(20));
  // Salto en el sitio: altura, duracion y rebotes al caer (cambios de signo de vy tras tocar suelo).
  await A.esperar(800);
  await A.js(`__qa.f = []; __qa.on = true; 1`);
  await tecla(A, 'Space', true); await A.esperar(900); await tecla(A, 'Space', false);
  await A.esperar(900);
  d = JSON.parse(await A.js(`__qa.on = false; JSON.stringify(__qa.f)`));
  { const y0 = d[0][2], ys = d.map(a => a[2] - y0), iMax = ys.indexOf(Math.max(...ys)); const iSuelo = ys.findIndex((y, i) => i > iMax && y <= 0.001);
    let reb = 0; if (iSuelo > 0) for (let i = iSuelo + 1; i < ys.length; i++) if (ys[i] > 0.02 && ys[i - 1] <= 0.02) reb++;
    res.salto = { alto: r2(Math.max(...ys)), msAire: iSuelo > 0 ? Math.round(d[iSuelo][0] - d[ys.findIndex(y => y > 0.01)][0]) : null, rebotes: reb }; }
  if (FOTOS) await A.foto(`${FOTOS}/mov-final.png`);
  const exc = [...A.consola, ...B.consola].filter(l => l.startsWith('EXCEPCION') || l.startsWith('error:'));
  res.errores = exc.slice(0, 5);
} finally { await A.cerrar(); await B.cerrar(); }

console.log(JSON.stringify(res, null, 1));
if (SALIDA) fs.writeFileSync(SALIDA, JSON.stringify(res, null, 1));
