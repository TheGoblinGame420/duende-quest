// ═══════════════════════════════════════════════════════
// Prueba en el navegador de los rituales del día de ORIGINS (mundo/js/rituales.js):
// tarjeta «Buenos días», filas de HOY en Mis objetivos, ritual de la noche, tarjeta
// de cierre y elección de recordatorio. Mueve el reloj del servidor local y el de la
// página (mañana → noche → mañana siguiente) y saca capturas.
//
//   PUERTO=8831 DATOS=/tmp/x.json node tools/mmo_local.mjs     (en otra terminal)
//   node tools/qa_rituales.mjs http://localhost:8831 <carpeta de capturas> [movil|pc]
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import { abrirNavegador } from './cdp.mjs';

const BASE = (process.argv[2] || 'http://localhost:8831').replace(/\/$/, '');
const FOTOS = process.argv[3] || '.';
const MOVIL = (process.argv[4] || 'movil') !== 'pc';
const [ANCHO, ALTO] = MOVIL ? [360, 740] : [1280, 720];
fs.mkdirSync(FOTOS, { recursive: true });
const esperar = ms => new Promise(r => setTimeout(r, ms));
const dev = async js => (await (await fetch(BASE + '/__dev?js=' + encodeURIComponent(js))).json());
const fallos = [];
const ok = (cond, txt) => { console.log((cond ? '  ✓ ' : '  ✗ ') + txt); if (!cond) fallos.push(txt); return cond; };
const H = 3600000, DIA = 86400000;

const nav = await abrirNavegador({ ancho: ANCHO, alto: ALTO, movil: MOVIL });
let desfase = 0;
// Reloj: la misma hora falsa en el servidor y en la página. Solo hacia adelante.
async function irLima(dias, hora, min = 5) {
  const real = Date.now(), lima = real + desfase - 5 * H;
  const destino = (Math.floor(lima / DIA) + dias) * DIA + hora * H + min * 60000;
  desfase += destino - lima;
  if (destino < lima) throw new Error('el reloj no vuelve atrás');
  await dev(`(globalThis.__qaO || (globalThis.__qaO = Date.now, Date.now = () => globalThis.__qaO() + (globalThis.__qaD || 0)), globalThis.__qaD = ${desfase}, [...mundo.sesiones.values()].forEach(s => { s.actT = Date.now(); s.movT = Date.now(); }), 1)`);
  await nav.js(`(window.__qaO || (window.__qaO = Date.now.bind(Date), Date.now = () => window.__qaO() + (window.__qaD || 0)), window.__qaD = ${desfase}, 1)`);
}
const foto = n => nav.foto(`${FOTOS}/${MOVIL ? 'm' : 'pc'}-${n}.png`);
const despejar = () => nav.js(`(() => { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'v-rit' && m.id !== 'v-obj') m.classList.remove('on'); }); for (const id of ['ob-sig', 'dq-noche', 'tarjeta-bautizo', 'franja-inst', 'probar-clase', 'tira-comunidad']) { const e = document.getElementById(id); if (e) e.remove(); } for (const id of ['v-diario', 'tira-diario', 'dq-regalo', 'dq-avtg', 'npc-dice', 'cofre-meta']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } return 1; })()`);
// La tarjeta no debe pisar los controles del HUD ni salirse de la pantalla.
const MEDIR = `(() => { const r = id => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const b = e.getBoundingClientRect(); return b.width && b.height ? { x: b.left, y: b.top, d: b.right, b: b.bottom } : null; };
  const t = r('dq-rit'), out = { t, pisa: [], scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, w: innerWidth, h: innerHeight };
  if (t) for (const id of ['botones', 'tactil', 'joy', 'mini']) { const o = r(id); if (o && t.x < o.d - 1 && o.x < t.d - 1 && t.y < o.b - 1 && o.y < t.b - 1) out.pisa.push(id); }
  return out; })()`;

try {
  await nav.ir(BASE + '/mundo/');
  for (let i = 0; i < 300; i++) {
    if (await nav.js('!!(window.__dq3 && window.__dq3.yo)').catch(() => false)) break;
    await nav.js(`(() => { const m = document.getElementById('v-inicio'), b = document.getElementById('b-entrar'); if (m && m.classList.contains('on') && b && typeof b.onclick === 'function' && !window.__qaEntro) { window.__qaEntro = 1; b.click(); } return 1; })()`).catch(() => {});
    await esperar(300);
  }
  await nav.esperarA('!!(window.__dq3 && window.__dq3.yo && __dq3.P.fig)', 90000);
  const nombre = await nav.js('__dq3.yo.nombre');
  const J = `jug(${JSON.stringify(nombre)})`;
  console.log('Jugador:', nombre, MOVIL ? '(móvil 360x740)' : '(PC 1280x720)');
  // Un personaje ya encaminado: Nv 20, guerrero, primer jefe vencido.
  await dev(`(() => { const s = ${J}; s.c.nivel = 20; s.c.clase = 'guerrero'; s.c.mis = { i: 5, p: 0 }; s.st = mundo.stats(s.c); s.hp = s.st.maxHp; s.c.kills = 40; mundo.actualizarYo(s); return 1; })()`);
  await esperar(1500);
  // Se recarga: asi entra como cualquier jugador que vuelve (sin el premio diario a medio mostrar).
  await dev(`(mundo.guardar(${J}), 1)`); await esperar(500);
  await nav.ir(BASE + '/mundo/');
  await nav.esperarA('!!(window.__dq3 && window.__dq3.yo && __dq3.P.fig && window.dqRit)', 90000);
  await esperar(2500); await despejar();

  console.log('Mañana (08:05, hora de Perú)');
  await irLima(1, 8);
  await dev(`(mundo.ritual(${J}, { a: 'info' }), 1)`);
  let sale = false;
  for (let i = 0; i < 40 && !sale; i++) { await esperar(1000); await despejar(); sale = await nav.js(`!!document.getElementById('dq-rit')`); }
  if (!sale) console.log('    estado:', JSON.stringify(await nav.js(`({ e: window.dqRit && dqRit.estado(), inf: window.dqRit && dqRit.info(), mod: [...document.querySelectorAll('.modal.on')].map(x => x.id), yo: { c: __dq3.yo.clase, mi: __dq3.yo.mis, nv: __dq3.yo.nivel }, cons: 1 })`)), nav.consola.slice(-5));
  ok(sale, 'sale la tarjeta «Buenos días»');
  await esperar(600);
  let txt = await nav.js(`(document.getElementById('dq-rit') || {}).innerText || ''`);
  ok(/Buenos días/i.test(txt) && /Amanecer: \+240 de oro/.test(txt), 'con el regalo del amanecer (' + txt.replace(/\s+/g, ' ').slice(0, 90) + '…)');
  let m = await nav.js(MEDIR);
  ok(m.t && m.pisa.length === 0 && m.scroll <= 0 && m.t.x >= 0 && m.t.d <= m.w, 'la tarjeta no pisa los controles ni se sale (' + JSON.stringify(m.pisa) + ', scroll ' + m.scroll + ')');
  await foto('1-buenos-dias');
  const oro0 = (await dev(`${J}.c.oro`)).v;
  await nav.js(`document.querySelector('#dq-rit [data-rt="am"]').click(); 1`);
  await esperar(1200);
  const oro1 = (await dev(`${J}.c.oro`)).v;
  ok(oro1 - oro0 === 240 && (await dev(`${J}.c.rit.am > 0`)).v === true, 'al tocar «Recibir» el servidor da el regalo (+' + (oro1 - oro0) + ' de oro)');
  await esperar(800); await despejar();
  await nav.js(`document.querySelector('[data-objetivos]').click(); 1`);
  await esperar(900);
  txt = await nav.js(`(document.getElementById('ob-c') || {}).innerText || ''`);
  ok(/Amanecer recibido/.test(txt) && /Ritual de la noche/.test(txt) && /Abre a las 18:00/.test(txt), 'Mis objetivos → HOY muestra el amanecer y el ritual de la noche');
  await foto('2-objetivos-hoy-dia');
  await nav.js(`document.querySelector('#ob-c [data-a="rit"][data-r="ver"]').click(); 1`);
  await esperar(900);
  ok(await nav.js(`document.getElementById('v-rit').classList.contains('on') && /Recordatorio por Telegram/.test(document.getElementById('rt-c').innerText)`), 'la fila abre la ventana con la elección de recordatorio');
  await nav.js(`(() => { const s = document.querySelector('#rt-c select[data-av="m"]'); s.value = '7'; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  await esperar(1200);
  const fr = (await dev(`mundo.retIdx().then(i => i[${J}.c.uid] && i[${J}.c.uid].fr)`)).v;
  txt = await nav.js(`document.getElementById('rt-c').innerText`);
  ok(/falta tu permiso/i.test(txt), 'sin permiso de avisos lo dice claro (no se le escribirá)');
  console.log('    elección guardada en el servidor:', JSON.stringify(fr));
  await foto('3-ventana-dia-recordatorio');
  m = await nav.js(`(() => { const v = document.querySelector('#v-rit .ventana').getBoundingClientRect(); const chicos = [...document.querySelectorAll('#v-rit .btn, #v-rit select, #v-rit .rt-op')].filter(e => e.getBoundingClientRect().height < 38).length; return { fuera: v.left < 0 || v.right > innerWidth || v.bottom > innerHeight + 1, chicos, scroll: document.documentElement.scrollWidth - innerWidth }; })()`);
  ok(!m.fuera && m.chicos === 0 && m.scroll <= 0, 'la ventana cabe en pantalla y sus controles miden 38 px o más (' + JSON.stringify(m) + ')');
  await nav.js(`document.querySelector('#v-rit [data-rt-cerrar]').click(); 1`);

  console.log('Noche (19:35)');
  await irLima(0, 19, 35);
  await dev(`(mundo.ritual(${J}, { a: 'info' }), 1)`);
  sale = false;
  for (let i = 0; i < 40 && !sale; i++) { await esperar(1000); await despejar(); sale = await nav.js(`!!document.getElementById('dq-rit') && /Ritual de la noche/i.test(document.getElementById('dq-rit').innerText)`); }
  ok(sale, 'de noche sale la tarjeta del ritual');
  await esperar(600); await foto('4-tarjeta-noche');
  await nav.js(`document.querySelector('#dq-rit [data-rt="ver"]').click(); 1`);
  await esperar(900);
  txt = await nav.js(`document.getElementById('rt-c').innerText`);
  ok(/Expedición nocturna/.test(txt) && /olla de Mama Asiri/i.test(txt) && /intención para mañana/i.test(txt), 'la ventana trae los tres pasos');
  ok(await nav.js(`document.querySelector('#rt-c [data-rt="noche"]').disabled === true`), 'no se puede cerrar el día sin elegir intención');
  await foto('5-ritual-noche');
  const t0 = Date.now();
  await nav.js(`document.querySelector('#rt-c [data-rt="exm"]').click(); 1`);
  await esperar(700);
  await nav.js(`document.querySelector('#rt-c [data-rt="int"][data-k="xp"]').click(); 1`);
  await esperar(300);
  await nav.js(`document.querySelector('#rt-c [data-rt="noche"]').click(); 1`);
  await esperar(1500);
  const est = (await dev(`(() => { const c = ${J}.c; return { no: c.rit.no, sig: c.rit.sig && c.rit.sig.k, olla: !!c.rit.olla, n: c.rit.n, ex: c.exped && c.exped.h }; })()`)).v;
  ok(est && est.sig === 'xp' && est.olla && est.n === 1 && est.ex === 12, 'tres toques: expedición de 12 h, olla al fuego e intención guardadas (' + JSON.stringify(est) + ', ' + (Date.now() - t0) + ' ms de guion)');
  txt = await nav.js(`document.getElementById('rt-t').innerText + ' ' + document.getElementById('rt-c').innerText`);
  ok(/Buenas noches/i.test(txt) && /Lo de hoy/.test(txt) && /Mañana te espera/.test(txt) && /no pasa nada/.test(txt), 'tarjeta de cierre: lo de hoy, lo de mañana y sin culpa');
  await foto('6-cierre-del-dia');
  await nav.js(`document.getElementById('rt-c').scrollTop = 9999; 1`); await esperar(300); await foto('6b-cierre-abajo');
  await nav.js(`document.querySelector('#v-rit [data-rt-cerrar]').click(); 1`);
  await nav.js(`document.querySelector('[data-objetivos]').click(); 1`);
  await esperar(900);
  ok(/Ritual de la noche hecho/.test(await nav.js(`document.getElementById('ob-c').innerText`)), 'HOY lo marca como hecho');
  await foto('7-objetivos-hoy-noche');
  await nav.js(`document.querySelector('#v-obj [data-ob-cerrar]').click(); 1`);

  console.log('Mañana siguiente (07:10)');
  await irLima(1, 7, 10);
  await dev(`(mundo.ritual(${J}, { a: 'info' }), 1)`);
  sale = false;
  for (let i = 0; i < 40 && !sale; i++) { await esperar(1000); await despejar(); sale = await nav.js(`!!document.getElementById('dq-rit') && /olla/i.test(document.getElementById('dq-rit').innerText)`); }
  txt = await nav.js(`(document.getElementById('dq-rit') || {}).innerText || ''`);
  ok(sale && /Olla: \+2 pociones y \+200 de oro/.test(txt) && /Intención de hoy: \+3 % de XP de caza/.test(txt) && /Amanecer: \+240/.test(txt), 'la mañana siguiente: olla reposada, intención y regalo (' + txt.replace(/\s+/g, ' ').slice(0, 140) + '…)');
  m = await nav.js(MEDIR);
  ok(m.t && m.pisa.length === 0 && m.t.b <= m.h, 'la tarjeta larga tampoco pisa controles (' + JSON.stringify(m.pisa) + ')');
  await esperar(600); await foto('8-buenos-dias-con-olla');
  const errores = nav.consola.filter(x => /EXCEPCION|rituales\.js/.test(x));
  ok(errores.length === 0, 'sin excepciones en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
} catch (e) { console.error(e); fallos.push('guion: ' + e.message); try { await foto('error'); } catch (er) {} }
await nav.cerrar();
console.log(fallos.length ? `\n${fallos.length} fallos` : '\nTodo bien');
process.exit(fallos.length ? 1 : 0);
