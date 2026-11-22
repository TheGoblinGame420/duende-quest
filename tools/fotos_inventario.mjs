// Fotos y comprobaciones del inventario «vivo» (js/vivo.js) en CLASSIC 2D y ORIGINS 3D.
// Arranca su propio servidor local (puerto 8803 por defecto, datos en un archivo temporal),
// crea un invitado de prueba, le llena la bolsa con piezas de todas las rarezas y saca,
// en 375x812, 812x375 y 1280x800, una foto «antes» (vivo apagado) y otra «despues».
// Luego prueba de verdad: Equipar (la pieza vuela a su ranura) y Vender (+oro).
//
//   node tools/fotos_inventario.mjs <carpeta de salida> [puerto]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirNavegador } from './cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.resolve(process.argv[2] || 'fotos-inventario');
const PUERTO = +(process.argv[3] || 8803);
const BASE = 'http://localhost:' + PUERTO;
const DATOS = path.join(os.tmpdir(), 'dq_fotos_inv_' + PUERTO + '.json');
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const esperar = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(SALIDA, { recursive: true });
try { fs.rmSync(DATOS, { force: true }); } catch (e) {}

const { RANURAS, RAREZAS, baseItem } = await import(pathToFileURL(path.join(RAIZ, 'mmo/js/data.js')).href);
let fallos = 0;
const ok = (c, txt) => { console.log((c ? '  ✓ ' : '  ✗ ') + txt); if (!c) fallos++; };

let servidor = null;
process.on('exit', () => { try { if (servidor) servidor.kill(); } catch (e) {} });
async function arrancar() {
  servidor = spawn(process.execPath, ['tools/mmo_local.mjs'], { cwd: RAIZ, env: { ...process.env, PUERTO: String(PUERTO), DATOS }, stdio: 'ignore' });
  let muerto = false; servidor.on('exit', () => { muerto = true; });
  for (let i = 0; i < 120 && !muerto; i++) {
    await esperar(250);
    try { const r = await fetch(BASE + '/mmo/ws'); if (r.ok && (await r.json()).ok) return; } catch (e) {}
  }
  throw new Error('el servidor local no arrancó en ' + PUERTO + (muerto ? ' (puerto ocupado: pasa otro como segundo argumento)' : ''));
}
async function parar() { if (servidor) { servidor.kill(); servidor = null; await esperar(900); } }

const AL_CARGAR = `try { localStorage.setItem('dq_mmo_sonido', '0'); localStorage.setItem('dq_mudo', '1'); localStorage.setItem('dq_mmo_tok', '${TOKEN}'); } catch (e) {}
// El Chrome sin ventana va lento y los juegos entran en su modo ligero (sin animaciones): aqui se fuerzan.
window.__dqVivo = 'vivo';`;
async function abrir(t) {
  const nav = await abrirNavegador(t);
  await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: AL_CARGAR });
  return nav;
}
const clic = (nav, sel) => nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.click(); return 1; } return 0; })()`);
async function entrar2d(nav) {
  await nav.ir(BASE + '/mmo/');
  await nav.esperar(3000);
  await clic(nav, '#b-jugar');
  await nav.esperarA('!!(window.__dq && window.__dq.yo)', 20000);
  await nav.esperar(1500);
}
async function entrar3d(nav) {
  await nav.ir(BASE + '/mundo/');
  await nav.esperar(3500);
  for (let i = 0; i < 200; i++) {
    if (await nav.js('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)').catch(() => false)) break;
    await nav.js(`(() => { const m = document.getElementById('v-inicio'), b = document.getElementById('b-entrar'); if (m && m.classList.contains('on') && b && typeof b.onclick === 'function' && !window.__qaEntro) { window.__qaEntro = 1; b.click(); } return 1; })()`).catch(() => {});
    await nav.esperar(300);
  }
  await nav.esperarA('!!(window.__dq3 && window.__dq3.yo)', 5000);
  await nav.esperar(3000);
}
const cerrarVentanas = nav => nav.js(`(() => { document.querySelectorAll('.modal.on .cerrar, .modal.on [data-cerrar]').forEach(e => e.click()); return 1; })()`);
const vivoOff = nav => nav.js(`(() => { const s = document.getElementById('dq-vivo'); if (s) s.disabled = true; document.documentElement.classList.remove('vivo', 'vivo2d', 'vivo3d'); return 1; })()`);
const vivoOn = (nav, j) => nav.js(`(() => { const s = document.getElementById('dq-vivo'); if (s) s.disabled = false; document.documentElement.classList.add('vivo', 'vivo${j}'); return 1; })()`);
const abrirInv2d = async nav => { await clic(nav, '#b-inv'); await nav.esperar(250); await clic(nav, '[data-itab="equipo"]'); };
const abrirInv3d = async nav => { await clic(nav, '#b-inv'); };

// ── 1. Crear el invitado ──
await arrancar();
{
  const nav = await abrir({ ancho: 1280, alto: 800 });
  try {
    await entrar2d(nav);
    if (!(await nav.js('!!window.__dq.yo.clase'))) { await nav.js(`window.__dq.mandar({ t: 'clase', id: 'mago' }), 1`); await nav.esperar(1500); }
    console.log('Invitado creado: ' + (await nav.js('window.__dq.yo.nombre')));
  } finally { await nav.cerrar(); }
}
await esperar(1500);
await parar();

// ── 2. Bolsa de prueba: todas las rarezas ──
{
  const d = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
  const k = Object.keys(d).find(x => x.startsWith('c:inv:'));
  if (!k) throw new Error('no encuentro al invitado en ' + DATOS);
  const c = d[k];
  let n = 0;
  const pieza = (s, nv, r, extra) => {
    const base = baseItem(s, nv), b = {};
    for (const x in base) b[x] = x === 'crit' ? Math.round(base[x] * RAREZAS[r].mult * 100) / 100 : Math.max(1, Math.round(base[x] * RAREZAS[r].mult));
    if (extra) b[extra] = (b[extra] || 0) + (extra === 'crit' ? 0.02 : 4);
    return { id: 'qa' + (++n), s, nv, r, b };
  };
  c.nivel = 12; c.oro = 10781; c.clase = c.clase || 'mago';
  c.eq = { casco: pieza('casco', 10, 1, 'hp'), armadura: pieza('armadura', 11, 2, 'def') };
  const ran = Object.keys(RANURAS);
  c.bolsa = [
    pieza('anillo', 12, 3, 'atk'), pieza('anillo', 11, 1, 'def'), pieza('armadura', 12, 1, 'hp'), pieza('botas', 10, 2, 'crit'),
    pieza('casco', 12, 3, 'hp'), pieza('amuleto', 9, 0), pieza('botas', 8, 0), pieza('armadura', 30, 2, 'atk'),
    pieza(ran[0], 6, 0), pieza(ran[ran.length - 1], 12, 1, 'atk'),
  ];
  fs.writeFileSync(DATOS, JSON.stringify(d));
  console.log('Bolsa de prueba: ' + c.bolsa.length + ' piezas (' + RAREZAS.map((r, i) => c.bolsa.filter(x => x.r === i).length + ' ' + r.nombre).join(', ') + ')');
}
await arrancar();

// ── 3. Fotos antes / despues y medidas ──
const TAM = [['vertical', { ancho: 375, alto: 812, movil: true }], ['horizontal', { ancho: 812, alto: 375, movil: true }], ['pc', { ancho: 1280, alto: 800 }]];
const MEDIR = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
  const tarj = [...document.querySelectorAll('.modal.on .item[data-rz], .modal.on .vv-item[data-rz]')];
  const bot = tarj.flatMap(t => [...t.querySelectorAll('.btn')].map(b => ({ b, t })));
  const fuera = bot.filter(({ b, t }) => { const rb = b.getBoundingClientRect(), rt = t.getBoundingClientRect(); return rb.right > rt.right + 1 || rb.left < rt.left - 1; }).length;
  const v = document.querySelector('.modal.on > .ventana'), rv = v ? v.getBoundingClientRect() : null;
  const cuerpo = document.querySelector('.modal.on [data-cuerpo]') || v;
  return {
    tarjetas: tarj.length, rarezas: [...new Set(tarj.map(t => t.dataset.rz))].sort().join(''),
    botones: bot.length, altoMin: bot.length ? Math.round(Math.min(...bot.map(x => x.b.getBoundingClientRect().height))) : 0, fuera,
    scrollX: document.documentElement.scrollWidth > innerWidth + 1, scrollXCuerpo: cuerpo ? cuerpo.scrollWidth > cuerpo.clientWidth + 1 : false,
    ventanaCabe: rv ? rv.left >= -1 && rv.right <= innerWidth + 1 && rv.top >= -1 && rv.bottom <= innerHeight + 1 : false,
    ranuras: document.querySelectorAll('.modal.on [data-ran]').length,
  };
})()`;
const consolas = [];
for (const [juego, entrar, abrirInv, j] of [['2d', entrar2d, abrirInv2d, '2d'], ['3d', entrar3d, abrirInv3d, '3d']]) {
  for (const [nom, t] of TAM) {
    const nav = await abrir(t);
    const foto = et => nav.foto(path.join(SALIDA, `${juego}-${nom}-${et}.png`));
    console.log(`\n${juego.toUpperCase()} ${nom} (${t.ancho}x${t.alto})`);
    try {
      await entrar(nav);
      await vivoOff(nav);
      await abrirInv(nav);
      await nav.esperar(1200);
      await foto('1-antes');
      await cerrarVentanas(nav);
      await nav.esperar(400);
      await vivoOn(nav, j);
      await abrirInv(nav);
      await nav.esperar(140);
      await foto('2-entrando');
      await nav.esperar(1400);
      await foto('3-despues');
      const m = await nav.js(MEDIR);
      console.log('  ' + JSON.stringify(m));
      ok(m.tarjetas >= 5 && m.rarezas.length >= 3, 'tarjetas con rareza a la vista (' + m.tarjetas + ', rarezas ' + m.rarezas + ')');
      ok(m.ranuras >= 5, 'las ranuras llevan data-ran (' + m.ranuras + ')');
      ok(!m.scrollX && !m.scrollXCuerpo, 'sin scroll horizontal');
      ok(m.fuera === 0, 'los botones caben dentro de su tarjeta');
      ok(m.ventanaCabe, 'la ventana cabe en la pantalla');
      if (t.movil) ok(m.altoMin >= 44, 'botones de tarjeta de 44 px o más (mínimo ' + m.altoMin + ')');
      // Luz que sigue al puntero (solo con ratón) y bajada en la lista para ver épicos y legendarios.
      if (!t.movil) {
        const p = await nav.js(`(() => { const e = document.querySelector('.modal.on [data-rz="3"]'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width * .3, y: r.top + r.height / 2 }; })()`);
        if (p) {
          await nav.esperar(200);
          await nav.cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
          await nav.esperar(500);
          ok(await nav.js(`!!document.querySelector('.vivo-sobre[data-rz="3"]') && !!document.querySelector('.vivo-sobre').style.getPropertyValue('--mx')`), 'la luz sigue al puntero (--mx/--my en la tarjeta)');
          await foto('4-puntero');
        }
      }
      const exc = nav.consola.filter(l => l.startsWith('EXCEPCION'));
      ok(!exc.length, 'sin excepciones en la consola' + (exc.length ? ': ' + exc.slice(0, 2).join(' | ').slice(0, 300) : ''));
      consolas.push(...exc);
    } catch (e) { console.log('  ERROR: ' + e.message); fallos++; try { await foto('error'); } catch (e2) {} }
    finally { await nav.cerrar(); }
  }
}

// ── 4. Equipar y vender de verdad ──
for (const [juego, entrar, abrirInv, t] of [['2d', entrar2d, abrirInv2d, { ancho: 1280, alto: 800 }], ['3d', entrar3d, abrirInv3d, { ancho: 375, alto: 812, movil: true }]]) {
  const nav = await abrir(t);
  const foto = et => nav.foto(path.join(SALIDA, `${juego}-accion-${et}.png`));
  const yo = juego === '2d' ? 'window.__dq.yo' : 'window.__dq3.yo';
  console.log(`\n${juego.toUpperCase()} acciones (${t.ancho}x${t.alto})`);
  try {
    await entrar(nav);
    await abrirInv(nav);
    await nav.esperar(1500);
    const pulsar = async sel => {
      const p = await nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!p) return false;
      await nav.esperar(250);
      const q = await nav.js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (t.movil) await nav.toque(q.x, q.y); else await nav.clic(q.x, q.y);
      return true;
    };
    // 2D: el anillo legendario a su ranura vacía. 3D (después): el casco legendario sobre el casco raro puesto.
    const RAN = juego === '2d' ? 'anillo' : 'casco';
    const selEq = juego === '2d' ? `.item[data-s="${RAN}"][data-rz="3"] [data-eq]` : `.vv-item[data-s="${RAN}"][data-rz="3"] [data-act="equipar-item"]`;
    const antes = await nav.js(`!!(${yo}.eq && ${yo}.eq.${RAN} && ${yo}.eq.${RAN}.r === 3)`);
    ok(await pulsar(selEq), 'hay botón Equipar de la pieza legendaria (' + RAN + ')');
    await nav.esperar(150);
    ok(await nav.js(`document.querySelectorAll('.vivo-vuelo').length > 0`), 'la pieza sale volando hacia su ranura');
    await foto('1-vuelo');
    await nav.esperar(450);
    await foto('2-destello');
    await nav.esperar(1500);
    ok(!antes && await nav.js(`!!(${yo}.eq && ${yo}.eq.${RAN} && ${yo}.eq.${RAN}.r === 3)`), 'el servidor equipó la pieza');
    ok(await nav.js(`document.querySelectorAll('.vivo-vuelo').length === 0`), 'no quedan piezas sueltas en pantalla');
    ok(await nav.js(`(() => { const e = document.querySelector('.modal.on [data-ran="${RAN}"]'); return !!e && !e.classList.contains('vacia'); })()`), 'la ranura quedó llena tras repintar');
    await foto('3-equipado');
    // Vender una pieza común: +oro.
    const oro0 = await nav.js(`${yo}.oro`);
    const selV = juego === '2d' ? '.item[data-rz="0"] [data-vender]' : '.vv-item[data-rz="0"] [data-act="vender"]';
    ok(await pulsar(selV), 'hay botón Vender de una pieza común');
    await nav.esperar(200);
    ok(await nav.js(`!!document.querySelector('.vivo-mas')`), 'sale el «+oro» del botón');
    await foto('4-vender');
    await nav.esperar(1600);
    ok((await nav.js(`${yo}.oro`)) > oro0, 'el servidor sumó el oro de la venta');
    ok(await nav.js(`document.querySelectorAll('.vivo-vuelo').length === 0`), 'no quedan piezas sueltas tras vender');
    // Pieza de nivel 30 a un personaje de nivel 12: no hay botón Equipar (el servidor tampoco lo aceptaría).
    // Modo quieto: sin animaciones, la ventana sigue funcionando.
    await nav.js(`window.__dqVivo = 'quieto', 1`);
    await cerrarVentanas(nav); await nav.esperar(300); await abrirInv(nav); await nav.esperar(700);
    ok(await nav.js(`(() => { const e = document.querySelector('.modal.on [data-rz]'); return !!e && getComputedStyle(e, '::after').display === 'none'; })()`), 'modo quieto: sin barrido de brillo');
    await foto('5-quieto');
    const exc = nav.consola.filter(l => l.startsWith('EXCEPCION'));
    ok(!exc.length, 'sin excepciones en la consola' + (exc.length ? ': ' + exc.slice(0, 2).join(' | ').slice(0, 300) : ''));
  } catch (e) { console.log('  ERROR: ' + e.message); fallos++; try { await foto('error'); } catch (e2) {} }
  finally { await nav.cerrar(); }
}

await parar();
console.log(`\nFotos en ${SALIDA} · ${fallos ? fallos + ' comprobación(es) mal' : 'todo bien'}`);
process.exit(fallos ? 1 : 0);
