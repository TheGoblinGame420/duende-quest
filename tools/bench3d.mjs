// ═══════════════════════════════════════════════════════
// Banco de pruebas de rendimiento de ORIGINS (/mundo/): entra como invitado en
// un servidor local y recorre escenas fijas y repetibles; de cada una imprime
// lo que mide window.dqPerf (mundo/js/perf.js).
//
//   node tools/bench3d.mjs                         (levanta su propio servidor local)
//   node tools/bench3d.mjs --base=http://localhost:8804   (contra uno ya abierto de tools/mmo_local.mjs)
//   opciones: --cal=baja|media|alta (media)  --seg=8  --movil  --gpu  --escenas=pueblo,giro,jugadores,carrera,combate,noche
//             --fotos=<carpeta>  --json=<archivo>  --puerto=8899
//
// El Chrome sin ventana dibuja por software (SwiftShader): los ms de render NO
// son FPS reales. Si valen: ms de logica JS, llamadas de dibujo, triangulos,
// tareas largas y heap. Con --gpu se intenta la GPU real (ANGLE d3d11) y se
// imprime el renderer que salio.
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './cdp.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, def) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : process.argv.includes('--' + n) ? true : def; };
const CAL = arg('cal', 'media'), SEG = +arg('seg', 8), MOVIL = !!arg('movil', false), GPU = !!arg('gpu', false);
const ESCENAS = String(arg('escenas', 'pueblo,giro,jugadores,carrera,combate,noche')).split(',');
const FOTOS = arg('fotos', ''), JSON_OUT = arg('json', ''), PERFIL = +arg('perfil', 0) || (arg('perfil', false) ? 22 : 0);
const PUERTO = +arg('puerto', 8899);
let BASE = arg('base', '');
const esperar = ms => new Promise(r => setTimeout(r, ms));

// ── Servidor local propio (si no se dio --base) ──
let srv = null;
if (!BASE) {
  BASE = 'http://localhost:' + PUERTO;
  const datos = path.join(os.tmpdir(), 'dq_bench3d_' + PUERTO + '.json');
  try { fs.rmSync(datos, { force: true }); } catch (e) {}
  // Hasta 3 intentos: si el puerto aun no se libero de una pasada anterior, el servidor muere al arrancar.
  let arriba = false;
  for (let intento = 0; intento < 3 && !arriba; intento++) {
    srv = spawn(process.execPath, ['--no-warnings', path.join(AQUI, 'mmo_local.mjs')], { env: { ...process.env, PUERTO: String(PUERTO), DATOS: datos }, stdio: 'ignore' });
    let muerto = false; srv.on('exit', () => { muerto = true; });
    for (let i = 0; i < 80 && !arriba && !muerto; i++) { await esperar(150); try { arriba = (await fetch(BASE + '/mmo/ws')).ok; } catch (e) {} }
    if (!arriba) { try { srv.kill(); } catch (e) {} await esperar(1500); }
  }
  if (!arriba) { console.error('El servidor local no arranco en el puerto ' + PUERTO); process.exit(1); }
}
const dev = async js => { const r = await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json(); if (!r.ok) throw new Error('__dev: ' + r.e); return r.v; };

// ── Jugadores falsos: invitados por WebSocket que el servidor pasea en circulo por la plaza ──
const bots = [];
async function meterBots(n, cx, cz) {
  const marca = Date.now().toString(16);
  for (let i = 0; i < n; i++) {
    const ws = new WebSocket(BASE.replace('http', 'ws') + '/mmo/ws');
    await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
    ws.onmessage = () => {};
    ws.send(JSON.stringify({ t: 'hola', modo: '3d', nombre: 'Banco' + i, auth: { k: 'inv', tok: (marca + 'b' + i).padStart(32, 'e').slice(-32) } }));
    bots.push(ws);
    await esperar(60);
  }
  await esperar(800);
  // Los mueve el propio servidor (como tools/carga_mmo.mjs): caminan en corro, cada uno con su radio y su fase.
  return dev(`(()=>{ clearInterval(globalThis.__bancoT); const ls=[...mundo.sesiones.values()].filter(s=>s.c&&s.m3&&/^Banco\\d/.test(s.c.nombre)); let k=0;
    globalThis.__bancoT=setInterval(()=>{ k+=0.1; ls.forEach((s,i)=>{ if(s.cerrado||!s.p) return; const r=5+(i%5)*2.5, a=k*0.45*(i%2?1:-1)+i*0.7; const x=${cx}+Math.cos(a)*r, z=${cz}+Math.sin(a)*r; s.ry=Math.atan2(x-s.p.x,z-s.p.z); s.p.x=x; s.p.z=z; s.a=1; s.movT=Date.now(); }); },100); return ls.length })()`);
}
async function sacarBots() {
  try { await dev('(clearInterval(globalThis.__bancoT), 1)'); } catch (e) {}
  for (const ws of bots.splice(0)) try { ws.close(); } catch (e) {}
  await esperar(500);
}

const resultados = [];
function fila(nombre, m) {
  resultados.push({ escena: nombre, ...m });
  const f = (o, k = 'media') => String(o[k].toFixed(1)).padStart(6);
  const n = (v, w) => String(v).padStart(w);
  console.log(nombre.padEnd(11) + '│' + n(m.cuadros, 5) + ' │' + f(m.logica, 'p50') + f(m.logica) + f(m.logica, 'p95') + f(m.logica, 'p99') + f(m.logica, 'peor') + ' │' + f(m.render, 'p50') + f(m.render) + f(m.render, 'p95') + ' │' + f(m.total, 'p50') + f(m.total, 'peor') + ' │' +
    n(m.llamadas, 5) + n(m.llamadasMax, 6) + ' │' + n(Math.round(m.triangulos / 1000), 5) + 'k │' + n(m.geometrias, 5) + n(m.texturas, 4) + n(m.programas, 4) + ' │' +
    n(m.tareasLargas, 3) + n(m.tareaLargaPeor, 5) + ' │' + n(m.heapMB ?? '-', 6) + ' │' + (m.censo ? n(m.censo.recorridos, 6) + n(m.censo.recalculan, 6) : '') + ' │' + (m.sint ? n(m.sint.logMin.toFixed(2), 6) + n(m.sint.logP50.toFixed(2), 6) + n(m.sint.renMin.toFixed(2), 7) + n(m.sint.renP50.toFixed(2), 6) : ''));
}
function cabecera() {
  console.log('escena     │ cuad │ logica JS ms: p50 media p95 p99 peor │ render: p50 media p95 │ total p50 peor │ dibujos med max │ tris │ geo tex prog │ largas peor │ heap MB │ objetos recorridos / con matriz recalculada │ sintetico: logica min p50, render min p50');
}

// Perfil de CPU de la escena (--perfil[=N]): las N funciones con mas tiempo propio, en ms por cuadro.
function perfil(p, cuadros) {
  const dt = (p.endTime - p.startTime) / 1000 / Math.max(1, p.samples.length);   // ms por muestra
  const propio = new Map();
  let totalJs = 0;
  for (const n of p.nodes) {
    const f = n.callFrame, nom = f.functionName || '(anonima)';
    if (nom === '(idle)' || nom === '(program)') continue;
    const k = nom + ' ' + (f.url ? f.url.replace(/^.*\//, '').replace(/\?.*$/, '') + ':' + (f.lineNumber + 1) : '');
    const ms = (n.hitCount || 0) * dt; totalJs += ms;
    propio.set(k, (propio.get(k) || 0) + ms);
  }
  const ls = [...propio].sort((a, b) => b[1] - a[1]).slice(0, PERFIL);
  console.log(`   perfil: ${(totalJs / cuadros).toFixed(2)} ms de JS por cuadro; tiempo propio (ms/cuadro):`);
  for (const [k, ms] of ls) console.log('     ' + (ms / cuadros).toFixed(3).padStart(7) + '  ' + k);
}

async function sesion(url, escenas) {
  const nav = await abrirNavegador({ ancho: MOVIL ? 360 : 1280, alto: MOVIL ? 740 : 720, movil: MOVIL, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
  try {
    await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('dq3_calidad','${CAL}');localStorage.setItem('dq3_look_visto','1');localStorage.setItem('dq_bautizo_visto','1')}catch(e){}` });
    const t0 = Date.now();
    await nav.ir(BASE + url);
    await nav.esperarA('window.__dq3 && __dq3.yo && window.dqPerf && dqPerf.muestra().cuadros > 3', 180000);
    const carga = Date.now() - t0;
    const gpu = await nav.js("(()=>{try{const c=document.createElement('canvas').getContext('webgl');const e=c.getExtension('WEBGL_debug_renderer_info');return String(c.getParameter(e.UNMASKED_RENDERER_WEBGL))}catch(e){return '?'}})()");
    await nav.esperar(2500);
    const arr = await nav.js('dqPerf.muestra()');
    console.log(`\n${url} · calidad ${CAL} · ${MOVIL ? 'movil 360x740' : 'PC 1280x720'} · ${gpu}`);
    console.log(`carga hasta entrar: ${carga} ms · tareas largas del arranque: ${arr.tareasLargas} (${arr.tareasLargasMs} ms en total, la peor ${arr.tareaLargaPeor} ms) · peor cuadro ${arr.total.peor} ms`);
    resultados.push({ escena: 'arranque' + (url.includes('hora=23') ? '-noche' : ''), carga, gpu, ...arr });
    const nombre = await nav.js('__dq3.yo.nombre');
    // Nivel 60 con mucha vida: las escenas no dependen de que el duende aguante.
    await dev(`(()=>{const s=jug('${nombre}'); s.c.nivel=60; s.st=mundo.stats(s.c); s.hp=s.st.maxHp; mundo.actualizarYo(s); return 1})()`);
    // Ventanas que saltan solas (premio diario, leyenda, nombre...): con una abierta el juego baja a 10 fps y tapa la captura.
    const cerrarVentanas = () => nav.js(`(()=>{ document.querySelectorAll('.modal.on [data-cerrar]').forEach(b=>b.click()); document.querySelectorAll('.modal.on').forEach(v=>v.classList.remove('on')); const t=document.getElementById('tarjeta-bautizo'); if(t) t.remove(); return 1 })()`);
    await nav.esperar(2500); await cerrarVentanas();
    const tp = async (x, z, yaw, pitch = 0.42) => {
      await dev(`(()=>{const s=jug('${nombre}'); s.p.x=${x}; s.p.z=${z}; s.movT=Date.now(); s.hp=s.st.maxHp; return 1})()`);
      await nav.js(`__dq3.recibir({t:'snap3',x:${x},z:${z}}); __dq3.camara(${yaw},${pitch}); 1`);
    };
    const medir = async (nombreE, ms, accion) => {
      await cerrarVentanas();
      if (PERFIL) { await nav.cmd('Profiler.enable'); await nav.cmd('Profiler.setSamplingInterval', { interval: 250 }); await nav.cmd('Profiler.start'); }
      await nav.js('dqPerf.reiniciar()');
      const fin = Date.now() + ms;
      if (accion) await accion(fin);
      while (Date.now() < fin) await nav.esperar(50);
      const m = await nav.js('(()=>{const m=dqPerf.muestra(); try{m.censo=dqPerf.censo()}catch(e){} return m})()');
      // Pasada sintetica: 150 cuadros forzados seguidos. El minimo y la mediana de esos cuadros casi no dependen
      // de lo ocupada que este la maquina (los ms de arriba si): es lo que se compara entre versiones.
      m.sint = await nav.js('(()=>{dqPerf.reiniciar(); for(let i=0;i<150;i++) __dq3.cuadro(); const s=dqPerf.muestra(); return {logMin:s.logica.min,logP50:s.logica.p50,renMin:s.render.min,renP50:s.render.p50}})()');
      fila(nombreE, m);
      if (PERFIL) perfil((await nav.cmd('Profiler.stop')).profile, m.cuadros + 150);
      if (FOTOS) { fs.mkdirSync(FOTOS, { recursive: true }); await nav.foto(path.join(FOTOS, nombreE + '-' + CAL + (MOVIL ? '-movil' : '') + '.png')); }
    };
    // Giro de camara dentro de la pagina (por tiempo, no por cuadros): una vuelta en `ms`.
    const girar = ms => nav.js(`(()=>{const t0=performance.now(); const f=()=>{const k=(performance.now()-t0)/${ms}; if(k>=1) return; __dq3.camara(k*Math.PI*2, 0.42); requestAnimationFrame(f)}; f(); return 1})()`);
    cabecera();
    for (const e of escenas) {
      if (e === 'pueblo') {   // (a) quieto, mirando a la plaza
        await tp(0, 22, 0); await nav.esperar(2500);
        await medir('pueblo', SEG * 1000);
      } else if (e === 'giro') {   // (b) una vuelta de camara en la plaza
        await tp(0, 22, 0); await nav.esperar(1500);
        await medir('giro', SEG * 1000, () => girar(SEG * 1000));
      } else if (e === 'jugadores') {   // (f) 18 jugadores falsos caminando alrededor
        await tp(0, 22, 0);
        const n = await meterBots(18, 0, 12);
        await nav.esperar(3000);
        await medir('jugadores' + n, SEG * 1000, () => girar(SEG * 1000));
        await sacarBots();
      } else if (e === 'carrera') {   // (c) carrera por la selva (hongos, ranas y flora densa)
        await tp(40, 95, Math.atan2(40 - 124, 95 - 196)); await nav.esperar(2500);
        await medir('carrera', SEG * 1000, async fin => { while (Date.now() < fin) await nav.tecla('KeyW', 900); });
      } else if (e === 'combate') {   // (d) 8 monstruos encima, golpes y habilidades
        await tp(75, 108, 0.6); await nav.esperar(2500);
        const n = await dev(`(()=>{const s=jug('${nombre}'); const W=mundo.iniciar3d(); const ls=[...W.mons.values()].filter(o=>!o.jefe&&!o.i3&&o.hp>0).sort((a,b)=>Math.hypot(a.x-s.p.x,a.z-s.p.z)-Math.hypot(b.x-s.p.x,b.z-s.p.z)).slice(0,8);
          ls.forEach((o,i)=>{const a=i/ls.length*6.283; o.x=s.p.x+Math.cos(a)*2.6; o.z=s.p.z+Math.sin(a)*2.6; o.hx=o.x; o.hz=o.z; o.hp=o.max=5e6; o.amen.set(s.id,1e6); o.obj=s.id;}); s.st.maxHp=5e6; s.hp=5e6; return ls.length})()`);
        await nav.esperar(2000);
        await medir('combate' + n, SEG * 1000, async fin => {
          let i = 0;
          while (Date.now() < fin) { await nav.tecla('Digit1', 350); await nav.tecla('Digit' + (2 + i++ % 4), 60); await nav.tecla('Key' + 'QFGT'[i % 4], 60); }
        });
      } else if (e === 'noche') {   // (e) el pueblo de noche, con faroles (la pagina se abrio con ?hora=23)
        await tp(0, 22, 0); await nav.esperar(3000);
        await medir('noche', SEG * 1000, () => girar(SEG * 1000));
      }
    }
    const exc = nav.consola.filter(l => /^EXCEPCION|^error/.test(l));
    if (exc.length) console.log('consola (' + exc.length + '): ' + exc.slice(0, 5).join(' | ').slice(0, 600));
  } finally { await nav.cerrar(); }
}

try {
  const dia = ESCENAS.filter(e => e !== 'noche');
  if (dia.length) await sesion('/mundo/?hora=13&clima=despejado', dia);
  if (ESCENAS.includes('noche')) await sesion('/mundo/?hora=23&clima=despejado', ['noche']);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ cal: CAL, movil: MOVIL, seg: SEG, resultados }, null, 1));
} finally {
  await sacarBots();
  if (srv) srv.kill();
}
process.exit(0);
