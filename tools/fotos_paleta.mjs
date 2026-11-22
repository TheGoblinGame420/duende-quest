// Fotos de todas las pantallas para comparar un cambio de colores (antes / despues).
// Necesita el servidor local: node tools/mmo_local.mjs
// Uso: node tools/fotos_paleta.mjs <carpeta de salida> [base=http://localhost:8787] [solo=portada,mmo,...]
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from './cdp.mjs';

const SALIDA = path.resolve(process.argv[2] || 'fotos-paleta');
const BASE = (process.argv[3] || 'http://localhost:8787').replace(/\/$/, '');
const SOLO = process.argv[4] ? new Set(process.argv[4].split(',')) : null;
fs.mkdirSync(SALIDA, { recursive: true });
const SILENCIO = `try { localStorage.setItem('dq_mmo_sonido', '0'); localStorage.setItem('dq_mudo', '1'); } catch (e) {}`;
const hechas = [];

async function sesion(nombre, { ancho = 1280, alto = 800, movil = false } = {}, f) {
  if (SOLO && !SOLO.has(nombre.split('-')[0])) return;
  const nav = await abrirNavegador({ ancho, alto, movil });
  const foto = async etiqueta => { const a = path.join(SALIDA, `${nombre}-${etiqueta}.png`); await nav.foto(a); hechas.push(path.basename(a)); };
  try {
    await nav.cmd('Page.addScriptToEvaluateOnNewDocument', { source: SILENCIO });
    await f(nav, foto);
  } catch (e) { console.log(`  ${nombre}: ${e.message}`); try { await foto('error'); } catch (e2) {} }
  finally { await nav.cerrar(); }
}
const clic = (nav, sel) => nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.click(); return 1; } return 0; })()`);

// ── Portada ──
for (const [n, t] of [['portada-pc', { ancho: 1280, alto: 800 }], ['portada-movil', { ancho: 390, alto: 780, movil: true }]]) {
  await sesion(n, t, async (nav, foto) => {
    await nav.ir(BASE + '/');
    await nav.esperar(2500);
    await foto('1-heroe');
    for (const [et, sel] of [['2-juegos', '#juegos'], ['3-tienda', '#nft-store'], ['4-comprar', '#como-comprar'], ['5-pie', 'footer']]) {
      await nav.js(`(() => { document.documentElement.classList.add('cv-todo'); document.documentElement.style.scrollBehavior = 'auto'; const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 0; for (let p = e; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); return 1; })()`);
      await nav.esperar(1800);
      await foto(et);
    }
    await nav.js(`window.scrollTo(0, 0)`);
    if (await clic(nav, '#nav-cuenta')) { await nav.esperar(900); await foto('6-cuenta'); }
  });
}

// ── CLASSIC (2D) ──
for (const [n, t] of [['mmo-pc', { ancho: 1280, alto: 800 }], ['mmo-movil', { ancho: 390, alto: 780, movil: true }]]) {
  await sesion(n, t, async (nav, foto) => {
    await nav.ir(BASE + '/mmo/');
    await nav.esperar(3500);
    await foto('1-inicio');
    await clic(nav, '#b-jugar');
    await nav.esperar(5000);
    await foto('2-juego');
    for (const [et, b] of [['3-tienda', '#b-tienda'], ['4-mochila', '#b-inv'], ['5-wallet', '#b-wallet'], ['6-ranking', '#b-rank']]) {
      await clic(nav, b);
      await nav.esperar(1200);
      await foto(et);
      await nav.js(`document.querySelectorAll('.modal.on .cerrar, .modal.on [data-cerrar], .modal.on .x').forEach(e => e.click()); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); 1`);
      await nav.esperar(400);
    }
  });
}

// ── ORIGINS (3D) ──
for (const [n, t] of [['mundo-pc', { ancho: 1280, alto: 800 }], ['mundo-movil', { ancho: 390, alto: 780, movil: true }]]) {
  await sesion(n, t, async (nav, foto) => {
    await nav.ir(BASE + '/mundo/');
    await nav.esperar(4000);
    await foto('1-inicio');
    for (let i = 0; i < 120; i++) {
      if (await nav.js('!!(window.dqMenu && window.__dq3 && window.__dq3.yo)').catch(() => false)) break;
      await nav.js(`(() => { const m = document.getElementById('v-inicio'), b = document.getElementById('b-entrar'); if (m && m.classList.contains('on') && b && typeof b.onclick === 'function' && !window.__qaEntro) { window.__qaEntro = 1; b.click(); } return 1; })()`).catch(() => {});
      await nav.esperar(300);
    }
    await nav.esperar(3500);
    await foto('2-juego');
    if (await clic(nav, '#b-menu')) { await nav.esperar(1200); await foto('3-menu'); await clic(nav, '#mn-t-tienda'); await nav.esperar(900); await foto('4-menu-tienda'); }
  });
}

// ── Mini App, arcade y paginas sueltas ──
for (const [n, url, t] of [
  ['telegram-movil', '/telegram/', { ancho: 390, alto: 780, movil: true }],
  ['arcade-pc', '/game.html', { ancho: 1280, alto: 800 }],
  ['arcade-movil', '/game.html', { ancho: 390, alto: 780, movil: true }],
  ['jugar-movil', '/jugar/', { ancho: 390, alto: 780, movil: true }],
  ['inicio-movil', '/inicio/', { ancho: 390, alto: 780, movil: true }],
  ['token-movil', '/token/', { ancho: 390, alto: 780, movil: true }],
  ['guia-pc', '/guia.html', { ancho: 1280, alto: 800 }],
  ['novedades-movil', '/novedades.html', { ancho: 390, alto: 780, movil: true }],
  ['terminos-pc', '/terminos.html', { ancho: 1280, alto: 800 }],
  ['noexiste-movil', '/no-existe-esta-pagina', { ancho: 390, alto: 780, movil: true }],
]) {
  await sesion(n, t, async (nav, foto) => {
    await nav.ir(BASE + url);
    await nav.esperar(3000);
    await foto('1');
  });
}
console.log(`${hechas.length} fotos en ${SALIDA}`);
