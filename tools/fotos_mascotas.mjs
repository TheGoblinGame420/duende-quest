// Fotos del Huevo Místico y de las mascotas místicas en CLASSIC (2D) y ORIGINS (3D).
// Necesita el servidor local:  node tools/mmo_local.mjs   (usa su /__dev para dar el huevo y las mascotas)
// Uso: node tools/fotos_mascotas.mjs <carpeta de salida> [base=http://localhost:8787] [solo=2d,3d,movil]
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from './cdp.mjs';

const SALIDA = path.resolve(process.argv[2] || 'fotos-mascotas');
const BASE = (process.argv[3] || 'http://localhost:8787').replace(/\/$/, '');
const SOLO = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
fs.mkdirSync(SALIDA, { recursive: true });
const SILENCIO = `try { localStorage.setItem('dq_mmo_sonido', '0'); localStorage.setItem('dq_mudo', '1'); localStorage.setItem('dq3_mudo', '1'); } catch (e) {}`;
const dev = async js => { const r = await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json(); if (!r.ok) throw new Error('__dev: ' + r.e); return r.v; };
// Deja al jugador listo (clase, nivel) y con lo que se le pida: huevo con p puntos, o una mística equipada.
const preparar = (nombre, extra) => dev(`(() => { const s = jug(${JSON.stringify(nombre)}); if (!s) return 'sin sesion'; const c = s.c;
  if (!c.clase) { c.clase = 'mago'; c.nivel = 12; s.st = mundo.stats(c); s.hp = s.st.maxHp; mundo.recursoInicial(s); }
  ${extra}
  mundo.actualizarYo(s); mundo.aClave(s.k, { t: 'pa', ...mundo.infoApariencia(s) }); return c.mascota; })()`);
const TODAS = ['sapo_rey', 'zorro_mistico', 'buho_runas', 'escarabajo_aureo', 'dragon_jade', 'gato_duende', 'hongo_brillante', 'lobo_sombrio', 'fenix_esmeralda', 'golem_cristal'];
const conHuevo = p => `c.huevo = { p: ${p} }; c.eclos = 0; c.huevoDado = 1; c.mascota = 'huevo';`;
const conMascota = (id, lista) => `c.mascotas = ${JSON.stringify(lista || [id])}; c.mascota = ${JSON.stringify(id)};`;

async function sesion(nombre, { ancho = 1100, alto = 700, movil = false } = {}, f) {
  if (SOLO && !SOLO.has(nombre)) return;
  const nav = await abrirNavegador({ ancho, alto, movil });
  const foto = async et => { const a = path.join(SALIDA, `${nombre}-${et}.png`); await nav.foto(a); console.log('  ' + path.basename(a)); };


  try {
    await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: SILENCIO });
    await f(nav, foto);
  } catch (e) { console.log(`  ${nombre}: ${e.message}`); try { await foto('error'); } catch (e2) {} }
  finally { const errores = (nav.consola || []).filter(l => l.startsWith('EXCEPCION')); console.log(`  ${nombre}: ${errores.length ? errores.length + ' excepciones → ' + errores.slice(0, 3).join(' | ').slice(0, 500) : 'sin excepciones'}`); await nav.cerrar(); }
}
const clic = (nav, sel) => nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.click(); return 1; } return 0; })()`);
const cerrarTodo = nav => nav.js(`document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); 1`);

// ── CLASSIC (2D) ──
async function clasico(nav, foto, movil) {
  await nav.ir(BASE + '/mmo/');
  await nav.esperar(3500);
  await clic(nav, '#b-jugar');
  await nav.esperarA('!!(window.__dq && window.__dq.yo)', 20000);
  const nombre = await nav.js('window.__dq.yo.nombre');
  await preparar(nombre, '');
  await nav.esperar(600); await cerrarTodo(nav);
  // Invitado: la ventana le ofrece crear la cuenta.
  await clic(nav, '#b-mm'); await nav.esperar(900); await foto('1-ventana-invitado'); await cerrarTodo(nav);
  // Con huevo a medio incubar.
  await preparar(nombre, conHuevo(84));
  await nav.esperar(1500); await foto('2-huevo');
  if (!movil) { await nav.tecla('ArrowRight', 900); await nav.esperar(120); await foto('3-huevo-andando'); }
  await clic(nav, '#b-mm'); await nav.esperar(900);
  // La sesión de prueba es de invitado: la vista de una cuenta (barra de incubación) se pinta aparte con el mismo módulo.
  await nav.js(`Promise.all([import('/js/mascotas-ui.js?v=' + (document.querySelector('script[src*="?v="]').src.match(/v=(\\d+)/) || [0, 0])[1]), import('/mmo/js/data.js?v=' + (document.querySelector('script[src*="?v="]').src.match(/v=(\\d+)/) || [0, 0])[1])]).then(([u, d]) => { document.getElementById('mm-cuerpo').innerHTML = u.htmlMisticas({ yo: window.__dq.yo, invitado: false, MASCOTAS: d.MASCOTAS, MISTICAS: d.MISTICAS, RAREZAS: d.RAREZAS_MASCOTA }); return 1; })`);
  await nav.esperar(700); await foto('4-ventana-huevo'); await cerrarTodo(nav);
  // Eclosión (la que toque) y luego tres místicas elegidas.
  await dev(`(() => { const s = jug(${JSON.stringify(nombre)}); s.c.huevo.p = 120; return mundo.huevoEclosionar(s); })()`);
  await nav.esperar(260); await foto('5-eclosion');
  for (const id of movil ? ['dragon_jade'] : ['sapo_rey', 'buho_runas', 'fenix_esmeralda', 'lobo_sombrio', 'golem_cristal']) {
    await preparar(nombre, conMascota(id, TODAS.slice(0, 6).concat(id)));
    await nav.esperar(1300);
    if (!movil) { await nav.tecla('ArrowRight', 700); await nav.esperar(150); }
    await foto('6-' + id);
  }
  await clic(nav, '#b-mm'); await nav.esperar(1200); await foto('7-ventana-coleccion');
}
await sesion('2d', { ancho: 1100, alto: 700 }, (nav, foto) => clasico(nav, foto, false));
await sesion('movil', { ancho: 390, alto: 780, movil: true }, (nav, foto) => clasico(nav, foto, true));

// ── ORIGINS (3D) ──
await sesion('3d', { ancho: 1100, alto: 700 }, async (nav, foto) => {
  await nav.ir(BASE + '/mundo/');
  for (let i = 0; i < 150; i++) {
    if (await nav.js('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)').catch(() => false)) break;
    await nav.js(`(() => { const m = document.getElementById('v-inicio'), b = document.getElementById('b-entrar'); if (m && m.classList.contains('on') && b && typeof b.onclick === 'function' && !window.__qaEntro) { window.__qaEntro = 1; b.click(); } return 1; })()`).catch(() => {});
    await nav.esperar(300);
  }
  const nombre = await nav.js('window.__dq3.yo.nombre');
  await preparar(nombre, conHuevo(84));
  await nav.esperar(3500); await cerrarTodo(nav); await nav.esperar(600);
  await foto('1-huevo');
  for (const id of ['sapo_rey', 'dragon_jade', 'fenix_esmeralda', 'gato_duende']) {
    await preparar(nombre, conMascota(id, TODAS.slice(0, 6).concat(id)));
    await nav.esperar(2200);
    await foto('2-' + id);
  }
  await preparar(nombre, conHuevo(119));
  await nav.esperar(1500);
  await dev(`(() => { const s = jug(${JSON.stringify(nombre)}); s.c.mascotas = []; s.c.huevo.p = 120; return mundo.huevoEclosionar(s); })()`);
  await nav.esperar(350); await foto('3-eclosion');
  await clic(nav, '#b-mm'); await nav.esperar(1200); await foto('4-ventana');
});
console.log('Fotos en ' + SALIDA);
