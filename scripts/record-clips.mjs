// ═══════════════════════════════════════════════════════
// Paso 2 del trailer: graba 4 clips REALES del juego en _promo_kit/raw/.
//
//   node scripts/record-clips.mjs                       (vertical 1080x1920)
//   node scripts/record-clips.mjs --format=horizontal   (1920x1080)
//   node scripts/record-clips.mjs --solo=clip2,clip4    (solo esos clips)
//   node scripts/record-clips.mjs --dur=7000 --audio    (7 s y con el sonido real del juego)
//
// - Levanta su PROPIO servidor local (tools/mmo_local.mjs en el puerto 8820,
//   con un mundo nuevo en un archivo temporal): no toca el juego publicado
//   ni el servidor :8787.
// - Chrome sin ventana con GPU (ANGLE/D3D11) y el modo ?trailer=1 del juego
//   (mmo/js/trailer.js y mundo/js/trailer.js), que limpia la pantalla y juega
//   con las teclas de un jugador. Espera a window.__TRAILER_READY__.
// - Prepara cada escena con /__dev (solo existe en mmo_local): nivel, jefe o
//   monstruos cerca, permiso de alas. Solo en ESTE servidor, el daño que
//   recibe el jugador baja al 20 % para que nadie muera a mitad de toma.
// - Graba con el screencast de Chrome (cada cuadro con su hora real) y
//   ffmpeg lo pasa a 60 fps constantes en .webm (VP9). Al final dice los fps
//   REALES que dio el navegador: si son menos de 60, ffmpeg repite cuadros.
//
// No usa Playwright a propósito: su grabación de video va a ~25 fps y baja
// calidad. tools/cdp.mjs habla con Chrome directamente y no instala nada.
// ═══════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../tools/cdp.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(REPO, '_promo_kit', 'raw');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const FORMATO = arg('format', 'vertical');
const SOLO = arg('solo', '').split(',').filter(Boolean);
const DURA = +arg('dur', 4000);   // ms por clip
const AUDIO = process.argv.includes('--audio');   // graba también los efectos de sonido reales del juego
const V = FORMATO !== 'horizontal';
const VISTA = V ? { w: 405, h: 720, dpr: 1080 / 405, W: 1080, H: 1920 } : { w: 960, h: 540, dpr: 2, W: 1920, H: 1080 };
const PUERTO = 8820, BASE = 'http://localhost:' + PUERTO;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('·', ...a);
fs.mkdirSync(RAW, { recursive: true });

if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('Falta ffmpeg en el PATH.'); process.exit(1); }

// ── Servidor local propio ──
const datos = path.join(os.tmpdir(), 'dq_trailer_' + PUERTO + '.json');
fs.rmSync(datos, { force: true });
const srv = spawn(process.execPath, ['--no-warnings', path.join(REPO, 'tools', 'mmo_local.mjs')], { env: { ...process.env, PUERTO: String(PUERTO), DATOS: datos }, stdio: 'ignore' });
let arriba = false;
for (let i = 0; i < 120 && !arriba; i++) { await esperar(150); try { arriba = (await fetch(BASE + '/mmo/ws')).ok; } catch (e) {} }
if (!arriba) { console.error('El servidor local no arrancó'); srv.kill(); process.exit(1); }
const dev = async js => { const r = await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json(); if (!r.ok) throw new Error('__dev: ' + r.e); return r.v; };
// Nadie muere a mitad de toma (solo en este servidor de grabación).
await dev(`(()=>{if(mundo.__trailer)return 1;mundo.__trailer=1;const h=mundo.herir;mundo.herir=function(s,d,f){return h.call(this,s,Math.max(1,Math.round(d*0.2)),f)};setInterval(()=>{for(const s of mundo.sesiones.values())s.actT=Date.now()},5000);return 1})()`);

// ── Navegador con GPU ──
const nav = await abrirNavegador({ ancho: VISTA.w, alto: VISTA.h, movil: V, args: ['--use-angle=d3d11', '--use-gl=angle', '--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
await nav.cmd('Emulation.setDeviceMetricsOverride', { width: VISTA.w, height: VISTA.h, deviceScaleFactor: VISTA.dpr, mobile: V });
// Con --audio: sonido encendido (sin música del juego: la pone el montaje) y cada
// AudioContext copia lo que manda a los altavoces a un MediaStreamDestination,
// que se graba con MediaRecorder mientras dura la toma. Chrome sigue en --mute-audio.
const GRAB = `(()=>{const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctxs=[];
  const con=AudioNode.prototype.connect; AudioNode.prototype.connect=function(d,...r){ const c=this.context;
    if(d instanceof AudioDestinationNode && c && c.createMediaStreamDestination){ if(!c.__g){ c.__g=c.createMediaStreamDestination(); ctxs.push(c); } con.call(this,c.__g,...r); }
    return con.call(this,d,...r); };
  let recs=[]; window.__grab={ start(){ recs=ctxs.map(c=>{ try{c.resume()}catch(e){} const m=new MediaRecorder(c.__g.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:192000}); const p=[]; m.ondataavailable=e=>p.push(e.data); m.start(); return {m,p}; }); return recs.length; },
    async stop(){ const out=[]; for(const r of recs){ await new Promise(ok=>{ r.m.onstop=ok; r.m.stop(); }); const b=new Blob(r.p); const u=new Uint8Array(await b.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=32768) s+=String.fromCharCode.apply(null,u.subarray(i,i+32768)); out.push(btoa(s)); } recs=[]; return out; } };
})();`;
await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: (AUDIO ? GRAB + `try{localStorage.setItem('dq_mmo_sonido','1');localStorage.setItem('dq3_vol_mus','0');localStorage.setItem('dq_mmo_vol_mus','0')}catch(e){}` : `try{localStorage.setItem('dq_mmo_sonido','0')}catch(e){}`) + `try{localStorage.setItem('dq3_calidad','alta');localStorage.setItem('dq3_look_visto','1');localStorage.setItem('dq_bautizo_visto','1')}catch(e){}` });

async function abrir(ruta) {
  await nav.ir(BASE + ruta);
  await nav.esperarA('window.__TRAILER_READY__ === true', 180000);
  return nav.js(ruta.startsWith('/mundo') ? '__dq3.yo.nombre' : '__dq.yo.nombre');
}

// ── Grabar: screencast → cuadros con hora → ffmpeg a 60 fps constantes ──
async function grabar(nombre, accion) {
  const dir = path.join(RAW, '_f_' + nombre);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cuadros = [];
  let desde = Infinity;
  const baja = nav.escuchar(m => {
    if (m.method !== 'Page.screencastFrame') return;
    nav.cmd('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    const t = m.params.metadata.timestamp;
    if (t < desde) return;   // calentamiento: el primer medio segundo no entra
    const f = path.join(dir, String(cuadros.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(f, Buffer.from(m.params.data, 'base64'));
    cuadros.push({ f, t });
  });
  await nav.cmd('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: VISTA.W, maxHeight: VISTA.H, everyNthFrame: 1 });
  await esperar(500);
  const nAudio = AUDIO ? await nav.js('window.__grab ? __grab.start() : 0') : 0;
  desde = Date.now() / 1000;
  const acc = accion ? accion() : null;
  await esperar(DURA + 150);
  await nav.cmd('Page.stopScreencast'); baja();
  // Sonido de la toma: una pista por AudioContext, mezcladas en un wav.
  let wav = null;
  if (nAudio) {
    const pistas = (await nav.js('__grab.stop()')).filter(b => b && b.length > 200);
    const fs_ = pistas.map((b, i) => { const f = path.join(dir, 'a' + i + '.webm'); fs.writeFileSync(f, Buffer.from(b, 'base64')); return f; });
    if (fs_.length) {
      wav = path.join(dir, 'audio.wav');
      spawnSync('ffmpeg', ['-v', 'error', '-y', ...fs_.flatMap(f => ['-i', f]), '-filter_complex', fs_.length > 1 ? `amix=inputs=${fs_.length}:normalize=0` : 'anull', '-ar', '48000', '-ac', '2', wav]);
      if (!fs.existsSync(wav)) wav = null;
    }
  }
  if (acc) await Promise.race([acc, esperar(1500)]).catch(() => {});
  if (cuadros.length < 10) throw new Error(nombre + ': solo ' + cuadros.length + ' cuadros');
  const t0 = cuadros[0].t;
  const lst = cuadros.map((c, i) => `file '${c.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, (cuadros[i + 1] ? cuadros[i + 1].t : c.t + 1 / 60) - c.t).toFixed(4)}`).join('\n') + `\nfile '${cuadros.at(-1).f.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(dir, 'lista.txt'), lst);
  const sal = path.join(RAW, nombre + '.webm');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'lista.txt'), ...(wav ? ['-i', wav] : []),
    '-vf', `scale=${VISTA.W}:${VISTA.H}:flags=lanczos,fps=60,format=yuv420p`, '-t', (DURA / 1000).toFixed(2),
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '18', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', ...(wav ? ['-map', '0:v', '-map', '1:a', '-c:a', 'libopus', '-b:a', '160k', '-af', 'apad'] : []), sal], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg falló en ' + nombre);
  fs.rmSync(dir, { recursive: true, force: true });
  const fps = (cuadros.length - 1) / Math.max(0.1, cuadros.at(-1).t - t0);
  log(nombre + '.webm', '·', cuadros.length, 'cuadros ·', fps.toFixed(1), 'fps reales del navegador' + (AUDIO ? (wav ? ' · con sonido' : ' · SIN sonido') : ''));
  return fps;
}

const quiere = id => !SOLO.length || SOLO.some(s => id.startsWith(s));
const S = n => `jug(${JSON.stringify(n)})`;
const informe = {};

try {
  // ═══ 3D ═══
  if (quiere('clip1') || quiere('clip3')) {
    const n = await abrir('/mundo/?trailer=1&quieto=1&hora=17&clima=despejado');
    log('3D listo:', n, '· GPU:', await nav.js("(()=>{try{const c=document.createElement('canvas').getContext('webgl');const e=c.getExtension('WEBGL_debug_renderer_info');return String(c.getParameter(e.UNMASKED_RENDERER_WEBGL))}catch(e){return '?'}})()"));
    await dev(`(()=>{const s=${S(n)}; s.c.nivel=45; s.c.skin='legendaria'; s.c.kills=(s.c.kills||0)+5; s.kills=5; s.st=mundo.stats(s.c); s.st.maxHp=5e6; s.hp=5e6; mundo.actualizarYo(s); return 1})()`);
    await esperar(1500);
    const tp = async (x, z, yaw, pitch) => {
      await dev(`(()=>{const s=${S(n)}; s.p.x=${x}; s.p.z=${z}; s.movT=Date.now(); s.hp=s.st.maxHp; return 1})()`);
      await nav.js(`__dq3.recibir({t:'snap3',x:${x},z:${z}}); __dq3.camara(${yaw},${pitch}); 1`);
    };
    if (quiere('clip1')) {   // vuelo sobre el bosque
      await tp(40, 95, Math.atan2(40 - 124, 95 - 196), 0.3); await esperar(2500);
      nav.js(`__TRAILER__.escena('fly', ${DURA + 3000}); 1`);
      await esperar(2600);   // que ya esté en el aire
      informe.clip1_3d_fly = await grabar('clip1_3d_fly');
      await nav.js('__TRAILER__.parar(); 1');
    }
    if (quiere('clip3')) {   // combate: monstruos alrededor, golpes y habilidades
      await tp(75, 108, 0.6, 0.42); await esperar(2500);
      await dev(`(()=>{const s=${S(n)}; const W=mundo.iniciar3d(); const ls=[...W.mons.values()].filter(o=>!o.jefe&&!o.i3&&o.hp>0).sort((a,b)=>Math.hypot(a.x-s.p.x,a.z-s.p.z)-Math.hypot(b.x-s.p.x,b.z-s.p.z)).slice(0,6);
        ls.forEach((o,i)=>{const a=i/ls.length*6.283; o.x=s.p.x+Math.cos(a)*2.8; o.z=s.p.z+Math.sin(a)*2.8; o.hx=o.x; o.hz=o.z; o.hp=o.max=Math.max(o.max||1,1)*7; o.amen.set(s.id,1e6); o.obj=s.id;}); s.hp=5e6; return ls.length})()`);
      await esperar(1500);
      nav.js(`__TRAILER__.escena('pvp', ${DURA + 2500}); 1`);
      await esperar(900);
      informe.clip3_3d_pvp = await grabar('clip3_3d_pvp');
      await nav.js('__TRAILER__.parar(); 1');
    }
  }

  // ═══ 2D ═══
  if (quiere('clip2') || quiere('clip4')) {
    const n = await abrir('/mmo/?trailer=1&quieto=1');
    log('2D listo:', n);
    const prep = async (nivel, mapa, x) => {
      await dev(`(()=>{const s=${S(n)}; s.c.nivel=${nivel}; s.c.xp=0; mundo.recalcular(s); s.hp=s.st.maxHp; s.rec=s.st.recMax; mundo.actualizarYo(s); mundo.entrarMapa(s,'${mapa}',${x}); return 1})()`);
      await esperar(2000);
      // Mapa vacío salvo lo que pongamos (los jefes de zona se quedan fuera también).
      await dev(`(()=>{const s=${S(n)}; const w=mundo.mundoK(s.k); for(const o of [...w.mons.values()]){w.mons.delete(o.id); mundo.aClave(s.k,{t:'md',id:o.id,pr:[]});} return 1})()`);
    };
    if (quiere('clip2')) {   // jefe enorme: números de daño, críticos, habilidades
      await prep(45, 'desierto', 1300);
      await dev(`(()=>{const s=${S(n)}; mundo.crearMonstruo(s.k,'jefe_rey',Math.round(s.x+170),{nv:44,hpX:80,agresivo:true,radioAgro:500}); mundo.crearMonstruo(s.k,'goblin_centurion',Math.round(s.x-150),{nv:40,agresivo:true,radioAgro:400}); return 1})()`);
      await esperar(800);
      await nav.js(`__TRAILER__.escena('boss'); 1`);
      await esperar(1200);
      informe.clip2_2d_boss = await grabar('clip2_2d_boss');
      await nav.js('__TRAILER__.parar(); 1');
    }
    if (quiere('clip4')) {   // captura: debilitar y lanzar la red
      await prep(16, 'selva', 1300);
      await dev(`(()=>{const s=${S(n)}; const t=['hongo','rana','hongo']; for(let i=0;i<3;i++) mundo.crearMonstruo(s.k,t[i],Math.round(s.x+140+i*90),{nv:15,hpX:2.5,agresivo:true,radioAgro:400}); s.capturaT=0; return 1})()`);
      await esperar(800);
      await nav.js(`__TRAILER__.escena('captura'); 1`);
      await esperar(600);
      informe.clip4_2d_capture = await grabar('clip4_2d_capture');
      await nav.js('__TRAILER__.parar(); 1');
    }
  }
} catch (e) { console.error('ERROR', e.message, nav.consola.filter(l => /error|EXCEP/i.test(l)).slice(-5)); process.exitCode = 1; }
finally { await nav.cerrar(); srv.kill(); fs.rmSync(datos, { force: true }); }
console.log('\nClips en _promo_kit/raw/ (' + FORMATO + '):', informe);
process.exit();
