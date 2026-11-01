// ═══════════════════════════════════════════════════════
// Prueba del HUD en el movil (v325): abre ORIGINS (/mundo/) y CLASSIC (/mmo/)
// a 360x740, 375x812 y 740x360 como un telefono Android y falla si hay
// scroll horizontal o si se pisan los controles del HUD.
//
//   node tools/qa_movil.mjs                      (sirve la carpeta del repo en un puerto local)
//   node tools/qa_movil.mjs http://localhost:8787 (contra wrangler dev u otro servidor)
//
// ORIGINS: #botones, #tactil, #mini, #joy y #avisos no se pueden solapar
// (con el menu ⋯ cerrado y abierto). CLASSIC: #botones contra #uf-yo y #minimapa.
// Sin servidor del juego la pagina no entra, pero el HUD ya esta en el DOM y se mide igual.
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './cdp.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAMANOS = [[360, 740], [375, 812], [740, 360]];
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };

// Servidor estatico minimo (solo lectura, solo dentro del repo).
function servir() {
  const srv = http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const f = path.resolve(RAIZ, '.' + ruta);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// Corre en la pagina: rectangulos visibles de los ids y scroll horizontal.
const MEDIR = ids => `(() => {
  const vis = e => { if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null;
    for (let p = e.parentElement; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') return null;
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, d: r.right, b: r.bottom } : null; };
  const out = {}; for (const id of ${JSON.stringify(ids)}) out[id] = vis(document.getElementById(id));
  out._scroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth;
  return out;
})()`;
const pisa = (a, b) => a && b && a.x < b.d - 1 && b.x < a.d - 1 && a.y < b.b - 1 && b.y < a.b - 1;

function revisar(m, pares, etiqueta, fallos) {
  if (m._scroll > 0) fallos.push(`${etiqueta}: scroll horizontal de ${m._scroll}px`);
  for (const [a, b] of pares) if (pisa(m[a], m[b])) fallos.push(`${etiqueta}: #${a} pisa a #${b} ${JSON.stringify(m[a])} ${JSON.stringify(m[b])}`);
}

const PAGINAS = [
  {
    url: '/mundo/', ids: ['botones', 'tactil', 'mini', 'joy', 'avisos'],
    // Avisos sobre el joystick si: no reciben toques (pointer-events:none).
    pares: [['botones', 'tactil'], ['botones', 'mini'], ['botones', 'joy'], ['botones', 'avisos'], ['tactil', 'mini'], ['tactil', 'joy'], ['tactil', 'avisos'], ['mini', 'joy'], ['mini', 'avisos']],
    abiertos: [['botones', 'tactil'], ['botones', 'mini']],
    preparar: `document.body.classList.add('movil'); { const d = document.createElement('div'); d.textContent = 'Aviso de prueba del HUD'; document.getElementById('avisos').appendChild(d); }`,
  },
  {
    url: '/mmo/', ids: ['botones', 'uf-yo', 'minimapa'],
    pares: [['botones', 'uf-yo'], ['botones', 'minimapa']],
    abiertos: [],
    preparar: `document.getElementById('hud') && (document.getElementById('hud').style.display = 'block')`,
  },
];

const base = process.argv[2] ? process.argv[2].replace(/\/$/, '') : null;
const srv = base ? null : await servir();
const BASE = base || `http://127.0.0.1:${srv.address().port}`;
const fallos = [];
for (const pg of PAGINAS) {
  for (const [ancho, alto] of TAMANOS) {
    const nav = await abrirNavegador({ ancho, alto, movil: true });
    try {
      await nav.cmd('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'Android' });
      await nav.ir(BASE + pg.url);
      await nav.esperar(2500);
      await nav.js(pg.preparar).catch(() => {});
      await nav.esperar(300);
      const et = `${pg.url} ${ancho}x${alto}`;
      revisar(await nav.js(MEDIR(pg.ids)), pg.pares, et, fallos);
      if (pg.abiertos.length) {
        await nav.js(`document.getElementById('botones').classList.add('abierto')`);
        await nav.esperar(500);
        revisar(await nav.js(MEDIR(pg.ids)), pg.abiertos, et + ' (menu ⋯ abierto)', fallos);
      }
      const exc = nav.consola.filter(l => l.startsWith('EXCEPCION'));
      console.log(`${et}: medido${exc.length ? ` (${exc.length} excepciones en consola, normal sin servidor del juego)` : ''}`);
    } finally { await nav.cerrar(); }
  }
}
if (srv) srv.close();
if (fallos.length) { console.error('\nFALLOS DEL HUD MOVIL:\n - ' + fallos.join('\n - ')); process.exit(1); }
console.log('\nHUD movil OK: sin scroll horizontal ni controles pisados.');
