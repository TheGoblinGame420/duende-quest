// ═══════════════════════════════════════════════════════
// Prueba del MENU DEL JUEGO de ORIGINS (mundo/js/menu.js) y de los ajustes graficos.
//
//   node tools/qa_menu.mjs                        (levanta tools/mmo_local.mjs en un puerto propio)
//   node tools/qa_menu.mjs http://localhost:8801  (usa un servidor local que ya esta corriendo)
//   QA_FOTOS=<carpeta> node tools/qa_menu.mjs     (donde guardar las capturas; por defecto, la carpeta temporal del sistema)
//
// Entra como invitado a /mundo/ en PC (1280x720), celular vertical (360x740) y acostado (740x360):
// abre el menu (Esc y boton ⚙), recorre las secciones, cambia cada preajuste grafico y varias
// opciones avanzadas (comprobando que se aplican en vivo), revisa que el teclado no mueve al duende
// con el menu abierto, que los ajustes persisten al recargar, que el menu no se sale de la pantalla
// y que no hay excepciones en la consola. Deja capturas para mirarlas.
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOTOS = process.env.QA_FOTOS || path.join(os.tmpdir(), 'dq-qa-menu');
fs.mkdirSync(FOTOS, { recursive: true });
const UA_MOVIL = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const esperar = ms => new Promise(r => setTimeout(r, ms));

let BASE = process.argv[2] ? process.argv[2].replace(/\/$/, '') : null, srv = null;
if (!BASE) {
  const puerto = 8900 + Math.floor(Math.random() * 80);
  srv = spawn(process.execPath, [path.join(RAIZ, 'tools', 'mmo_local.mjs')], { env: { ...process.env, PUERTO: String(puerto), DATOS: path.join(FOTOS, 'datos-qa.json') }, stdio: 'ignore' });
  BASE = 'http://127.0.0.1:' + puerto;
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/mundo/'); break; } catch (e) { await esperar(250); } }
}

const fallos = [];
const ok = (cond, txt) => { if (!cond) { fallos.push(txt); console.log('  ✗ ' + txt); } return cond; };
const G = 'window.dqGfx.ajustes';

async function entrar(nav) {
  await nav.ir(BASE + '/mundo/');
  // Invitado: entra solo o con el boton «Entrar al mundo».
  for (let i = 0; i < 300; i++) {
    if (await nav.js('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)').catch(() => false)) break;
    await nav.js(`(() => { const m = document.getElementById('v-inicio'), b = document.getElementById('b-entrar'); if (m && m.classList.contains('on') && b && typeof b.onclick === 'function' && !window.__qaEntro) { window.__qaEntro = 1; b.click(); } return 1; })()`).catch(() => {});
    await esperar(300);
  }
  await nav.esperarA('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)', 5000);
  await esperar(1500);
  await despejar(nav);
}
// Cierra lo que tape (eleccion de clase, tarjetas de bienvenida...) para probar el menu sobre el HUD.
const despejar = nav => nav.js(`(() => { document.querySelectorAll('.modal.on').forEach(m => { if (m.id !== 'v-menu') m.classList.remove('on'); }); const n = document.getElementById('npc-dice'); if (n) n.classList.remove('on'); return 1; })()`);
const abierto = nav => nav.js('window.dqMenu.abierto()');
// Lo que se ve del menu: ¿cabe en la pantalla?, ¿hay scroll horizontal?, ¿objetivos tactiles de 44 px?
const MEDIR = `(() => {
  const c = document.querySelector('#v-menu .mn-caja').getBoundingClientRect();
  const vis = e => e.offsetParent !== null;
  const chicos = [...document.querySelectorAll('#v-menu button, #v-menu select, #v-menu a.btn, #v-menu input')].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { t: (e.id || e.textContent || e.className).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(o => o.h < 43.5 && o.w > 0);
  const cont = document.querySelector('#v-menu .mn-cont');
  return { x: c.left, y: c.top, d: c.right, b: c.bottom, w: innerWidth, h: innerHeight, scrollX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, desbordeCont: cont.scrollWidth - cont.clientWidth, chicos };
})()`;

async function probar(nombre, { ancho, alto, movil }) {
  console.log(`\n── ${nombre} (${ancho}x${alto}) ──`);
  const nav = await abrirNavegador({ ancho, alto, movil });
  const foto = n => nav.foto(path.join(FOTOS, `${nombre}-${n}.png`));
  const sec = async id => { await nav.js(`document.getElementById('mn-t-${id}').click()`); await esperar(250); };
  try {
    if (movil) await nav.cmd('Emulation.setUserAgentOverride', { userAgent: UA_MOVIL, platform: 'Android' });
    await entrar(nav);
    const estrecho = await nav.js(`matchMedia('(max-width:640px) and (min-height:501px)').matches`);
    await foto('00-hud');
    ok(await nav.js(`(() => { const b = document.getElementById('b-menu'); if (!b) return false; const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return cs.display !== 'none' && r.width >= 34 && r.height >= 34 && r.left >= 0 && r.right <= innerWidth && r.top >= 0; })()`), 'el botón ⚙ del HUD está a la vista');
    ok(await nav.js(`getComputedStyle(document.getElementById('b-ayuda')).display === 'none'`), 'el «?» antiguo ya no está en el HUD');

    // Abrir y cerrar: boton y Esc.
    await nav.js(`document.getElementById('b-menu').click()`); await esperar(400);
    ok(await abierto(nav), 'el botón ⚙ abre el menú');
    await foto('01-menu');
    const m0 = await nav.js(MEDIR);
    ok(m0.x >= -0.5 && m0.y >= -0.5 && m0.d <= m0.w + 0.5 && m0.b <= m0.h + 0.5, 'el menú cabe en la pantalla ' + JSON.stringify(m0));
    ok(m0.scrollX <= 0, 'sin scroll horizontal con el menú abierto');
    await nav.tecla('Escape'); await esperar(300);
    ok(!(await abierto(nav)), 'Esc cierra el menú');
    if (!movil) {
      await nav.js(`document.activeElement && document.activeElement.blur(); 1`);
      await nav.tecla('Escape'); await esperar(400);
      ok(await abierto(nav), 'Esc abre el menú cuando no hay nada abierto');
      ok(await nav.js(`document.activeElement && document.activeElement.id === 'mn-continuar'`), 'el foco entra en «Continuar»');
      // Con el menu abierto, el teclado no mueve al duende.
      const p0 = await nav.js('({ x: __dq3.P.x, z: __dq3.P.z })');
      await nav.tecla('KeyW', 700); await nav.tecla('Digit1', 80); await esperar(300);
      const p1 = await nav.js('({ x: __dq3.P.x, z: __dq3.P.z })');
      ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.05, 'con el menú abierto, W no mueve al duende');
      ok(await abierto(nav), 'el menú sigue abierto tras pulsar teclas de juego');
      // Flechas en la lista de secciones y foco atrapado con Tab.
      await nav.tecla('ArrowDown'); await esperar(150);
      ok(await nav.js(`document.activeElement.id === 'mn-t-graficos'`), 'flecha abajo pasa a «Gráficos»');
      await nav.tecla('ArrowDown'); await esperar(150);
      ok(await nav.js(`document.activeElement.id === 'mn-t-sonido' && document.getElementById('mn-s-sonido').classList.contains('on')`), 'flecha abajo muestra «Sonido»');
      for (let i = 0; i < 40; i++) await nav.tecla('Tab', 10);
      ok(await nav.js(`document.getElementById('v-menu').contains(document.activeElement)`), 'Tab no saca el foco del menú');
      await nav.js(`document.getElementById('mn-continuar').click()`); await esperar(300);
      ok(!(await abierto(nav)), '«Continuar» cierra el menú');
      await nav.tecla('KeyW', 500); await esperar(200);
      const p2 = await nav.js('({ x: __dq3.P.x, z: __dq3.P.z })');
      ok(Math.hypot(p2.x - p1.x, p2.z - p1.z) > 0.2, 'al cerrar el menú, W vuelve a mover al duende');
    }

    // Secciones.
    await nav.js(`window.dqMenu.abrir()`); await esperar(400);
    for (const id of ['graficos', 'sonido', 'controles', 'interfaz', 'ayuda', 'salir']) {
      if (estrecho && await nav.js(`document.querySelector('#v-menu .mn-caja').classList.contains('mn-det-on')`)) { await nav.js(`document.querySelector('#v-menu .mn-volver').click()`); await esperar(200); }
      await sec(id);
      ok(await nav.js(`document.getElementById('mn-s-${id}').classList.contains('on') && document.getElementById('mn-s-${id}').offsetParent !== null`), `se ve la sección «${id}»`);
      const m = await nav.js(MEDIR);
      ok(m.scrollX <= 0 && m.desbordeCont <= 1, `«${id}» sin desborde horizontal ` + JSON.stringify({ scrollX: m.scrollX, cont: m.desbordeCont }));
      if (movil) ok(m.chicos.length === 0, `«${id}»: objetivos táctiles de 44 px o más ` + JSON.stringify(m.chicos.slice(0, 6)));
      await foto('02-' + id);
      if (id === 'graficos') { await nav.js(`document.querySelector('#v-menu .mn-cont').scrollTop = 99999`); await esperar(150); await foto('02-graficos-b'); await nav.js(`document.querySelector('#v-menu .mn-cont').scrollTop = 0`); }
    }
    // Nada de lo que vivia en la ventana de ajustes se perdio.
    const faltan = await nav.js(`['sel-brillo','sel-mano','sel-vib','sel-texto','b-teclas','lista-teclas','b-leyenda','fila-token','com-canal','com-grupo','b-avtg','fila-avtg'].filter(id => { const e = document.getElementById(id); return !e || !e.closest('#v-menu'); }).concat(document.querySelector('#v-menu [data-instalar]') ? [] : ['[data-instalar]']).concat(document.querySelectorAll('#v-menu a[href^="https://wa.me/"]').length === 2 ? [] : ['whatsapp'])`);
    ok(faltan.length === 0, 'todo lo de «Ajustes y controles» está dentro del menú ' + JSON.stringify(faltan));

    // Salir: pide confirmacion y se puede cancelar (no se sale de verdad).
    await nav.js(`document.getElementById('mn-salir-inicio').click()`); await esperar(250);
    ok(await nav.js(`document.querySelector('#v-menu .mn-conf').classList.contains('on') && /guarda/.test(document.querySelector('#v-menu .mn-conf').textContent)`), '«Volver al inicio» pide confirmación y habla del guardado');
    await foto('03-salir-confirmar');
    await nav.tecla('Escape'); await esperar(250);
    ok(await abierto(nav) && await nav.js(`!document.querySelector('#v-menu .mn-conf').classList.contains('on')`), 'Esc cancela la confirmación sin cerrar el menú');
    ok(/\/mundo\//.test(await nav.js('location.pathname')), 'seguimos en el juego');

    // Preajustes graficos: cada uno se aplica en vivo.
    if (estrecho) { await nav.js(`document.querySelector('#v-menu .mn-volver').click()`); await esperar(200); }
    await sec('graficos');
    const dpr = await nav.js('devicePixelRatio || 1');
    for (const nivel of ['minima', 'baja', 'media', 'alta', 'ultra', 'auto']) {
      await nav.js(`[...document.querySelectorAll('#v-menu .mn-niveles [role=radio]')].find(b => b._v === '${nivel}').click()`);
      await esperar(nivel === 'alta' || nivel === 'ultra' ? 2500 : 700);
      const e = await nav.js(`(() => { const g = ${G}, d = window.__qaGfx ? window.__qaGfx() : null; return { nivel: g.nivel, ef: g.efectivo, px: g.px, pxReal: g.pxReal, lejos: g.lejos, sombras: g.sombras, post: g.post, fps: g.fps, ms: g.cuadroMs, guardado: localStorage.getItem('dq3_calidad'), marcado: (document.querySelector('#v-menu .mn-niveles [aria-checked=true]') || {})._v, ancho: document.getElementById('lienzo').width, sinPost: document.body.classList.contains('sin-post') }; })()`);
      const esperado = await nav.js(`(() => { const g = ${G}, n = '${nivel}' === 'auto' ? g.detectado : '${nivel}'; const p = window.dqGfx.presets[n]; return { n, px: p.px, lejos: p.lejos, fps: p.fps }; })()`);
      ok(e.nivel === nivel && e.ef === esperado.n && e.marcado === nivel, `preajuste ${nivel}: queda elegido ` + JSON.stringify(e));
      ok(e.guardado === (nivel === 'auto' ? null : nivel), `preajuste ${nivel}: se guarda en dq3_calidad`);
      ok(Math.abs(e.pxReal - Math.min(dpr, e.px)) < 0.011 && Math.abs(e.ancho - Math.round(ancho * e.pxReal)) <= 2, `preajuste ${nivel}: la resolución cambia en vivo (lienzo ${e.ancho} px)`);
      ok(e.ms === (e.fps === 60 ? 16.4 : e.fps ? 1000 / e.fps - 0.4 : 0), `preajuste ${nivel}: tope de FPS en vivo`);
      if (nivel === 'minima' || nivel === 'ultra') { await foto('04-preajuste-' + nivel); await nav.js(`document.getElementById('v-menu').style.visibility = 'hidden'`); await esperar(1200); await foto('04-mundo-' + nivel); await nav.js(`document.getElementById('v-menu').style.visibility = ''`); }
    }
    // Opciones avanzadas en vivo.
    const opc = async (k, v) => { await nav.js(`window.dqGfx.aplicar({ ${k}: ${JSON.stringify(v)} })`); await esperar(500); };
    const clicOpc = async (titulo, v) => { await nav.js(`(() => { const f = [...document.querySelectorAll('#v-menu .mn-op')].find(o => o.querySelector('b').textContent === ${JSON.stringify(titulo)}); const b = [...f.querySelectorAll('[role=radio]')].find(x => x._v === ${JSON.stringify(v)}) || f.querySelector('[role=switch]'); b.click(); })()`); await esperar(600); };
    await clicOpc('Sombras', 2);
    ok(await nav.js(`${G}.sombras === 2 && ${G}.propio.sombras === 2 && ${G}.personalizado === true`), 'sombras detalladas: opción personalizada');
    await clicOpc('Distancia de visión', 105);
    ok(await nav.js(`${G}.lejos === 105`), 'distancia de visión mínima');
    await clicOpc('Límite de FPS', 45);
    ok(await nav.js(`${G}.fps === 45 && Math.abs(${G}.cuadroMs - (1000 / 45 - 0.4)) < 0.001`), 'límite de 45 FPS en vivo');
    await clicOpc('Partículas y efectos', 0);
    ok(await nav.js(`${G}.fx === 0`), 'partículas al mínimo');
    await clicOpc('Resolución dinámica', null);
    ok(await nav.js(`${G}.din === false`), 'resolución dinámica: no');
    await clicOpc('Escala de resolución', 0.5);
    const e2 = await nav.js(`({ px: ${G}.pxReal, ancho: document.getElementById('lienzo').width })`);
    ok(Math.abs(e2.px - 0.5) < 0.011 && Math.abs(e2.ancho - Math.round(ancho * 0.5)) <= 2, 'escala 50 %: el lienzo se achica en vivo ' + JSON.stringify(e2));
    await clicOpc('Contador de FPS', null); await esperar(1300);
    ok(await nav.js(`${G}.verFps === true && localStorage.getItem('dq3_fps') === '1' && /^\\d+ FPS$/.test(document.getElementById('dq-fps').textContent) && getComputedStyle(document.getElementById('dq-fps')).display !== 'none'`), 'contador de FPS a la vista: ' + await nav.js(`document.getElementById('dq-fps').textContent`));
    ok(await nav.js(`!document.querySelector('#v-menu .mn-aviso').classList.contains('on')`), 'sin cambios que pidan reiniciar, no se ofrece reiniciar');
    await clicOpc('Vegetación y detalle', await nav.js(`${G}.det === 0 ? 1 : 0`));
    ok(await nav.js(`document.querySelector('#v-menu .mn-aviso').classList.contains('on') && !!document.getElementById('mn-reiniciar').offsetParent`), 'cambiar la vegetación ofrece «Reiniciar gráficos»');
    await foto('05-avanzadas'); await nav.js(`document.querySelector('#v-menu .mn-cont').scrollTop = 99999`); await esperar(150); await foto('05-avanzadas-b');
    // Sonido.
    if (estrecho) { await nav.js(`document.querySelector('#v-menu .mn-volver').click()`); await esperar(200); }
    await sec('sonido');
    await nav.js(`(() => { const i = document.getElementById('mn-vol-mus'); i.value = '35'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const son0 = await nav.js(`localStorage.getItem('dq_mmo_sonido')`);
    await nav.js(`document.querySelector('#mn-s-sonido [role=switch]').click()`); await esperar(200);
    ok(await nav.js(`localStorage.getItem('dq3_vol_mus') === '35' && localStorage.getItem('dq_mmo_sonido') === '${son0 === '0' ? '1' : '0'}'`), 'sonido: el volumen y el interruptor se guardan');
    await nav.js(`document.querySelector('#mn-s-sonido [role=switch]').click()`);

    // Persistencia al recargar («Reiniciar gráficos»).
    const antes = await nav.js(`JSON.stringify([${G}.nivel, Object.entries(${G}.propio).sort(), ${G}.verFps])`);
    if (estrecho) { await nav.js(`document.querySelector('#v-menu .mn-volver').click()`); await esperar(200); }
    await sec('graficos');
    await nav.js(`document.getElementById('mn-reiniciar').click()`);
    await esperar(1500);
    for (let i = 0; i < 200; i++) { if (await nav.js('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)').catch(() => false)) break; await esperar(300); }
    await esperar(1200); await despejar(nav);
    const despues = await nav.js(`JSON.stringify([${G}.nivel, Object.entries(${G}.propio).sort(), ${G}.verFps])`);
    ok(antes === despues, `los ajustes persisten al recargar (${antes} → ${despues})`);
    ok(await nav.js(`Math.abs(${G}.pxReal - 0.5) < 0.011 && ${G}.arranque.det === ${G}.det && document.getElementById('dq-fps').classList.contains('on')`), 'tras recargar se aplican la escala, la vegetación y el contador');
    await foto('06-tras-recargar');
    // Volver a dejarlo en automatico (no ensuciar otras pruebas con el mismo perfil).
    await nav.js(`window.dqGfx.aplicar({ nivel: 'auto', verFps: false })`); await esperar(400);
    ok(await nav.js(`localStorage.getItem('dq3_calidad') === null && localStorage.getItem('dq3_gfx') === null && localStorage.getItem('dq3_fps') === null`), '«Automático» limpia lo guardado');

    // Atras del navegador (Android): cierra el menu sin salir del juego.
    await nav.js(`window.dqMenu.abrir('graficos')`); await esperar(500);
    await nav.js(`history.back()`); await esperar(700);
    ok(/\/mundo\//.test(await nav.js('location.pathname')), 'Atrás no saca del juego');
    ok(estrecho ? await abierto(nav) && await nav.js(`!document.querySelector('#v-menu .mn-caja').classList.contains('mn-det-on')`) : !(await abierto(nav)), estrecho ? 'Atrás vuelve de la sección a la lista' : 'Atrás cierra el menú');
    if (estrecho) { await esperar(300); await nav.js(`history.back()`); await esperar(700); ok(!(await abierto(nav)), 'un segundo Atrás cierra el menú'); ok(/\/mundo\//.test(await nav.js('location.pathname')), 'y seguimos en el juego'); }

    const exc = nav.consola.filter(l => l.startsWith('EXCEPCION') || /^error: .*(menu|TypeError|ReferenceError)/i.test(l));
    ok(exc.length === 0, 'sin excepciones en la consola ' + JSON.stringify(exc.slice(0, 5)));
  } catch (e) {
    fallos.push(`${nombre}: ${e.message}`); console.log('  ✗ ' + e.message);
    try { await foto('99-error'); } catch (e2) {}
    console.log(nav.consola.filter(l => /EXCEPCION|^error/.test(l)).slice(0, 8).join('\n'));
  } finally { await nav.cerrar(); }
}

try {
  await probar('pc', { ancho: 1280, alto: 720, movil: false });
  await probar('movil', { ancho: 360, alto: 740, movil: true });
  await probar('acostado', { ancho: 740, alto: 360, movil: true });
} finally { if (srv) srv.kill(); }
console.log('\nCapturas en: ' + FOTOS);
if (fallos.length) { console.error('\nFALLOS DEL MENU:\n - ' + fallos.join('\n - ')); process.exit(1); }
console.log('Menú del juego OK.');
