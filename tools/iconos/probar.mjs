// ═══════════════════════════════════════════════════════
// DQ Iconos · prueba real de la fuente en Chrome (sin ventana).
//
//   node tools/iconos/probar.mjs <captura.png> [--movil]
//
// Levanta un servidor estático propio en la raíz del repo, abre
// tools/iconos/muestra.html, saca una captura y pregunta a Chrome (protocolo
// DevTools, CSS.getPlatformFontsForNode) QUÉ FUENTE usó de verdad para cada
// icono, con y sin el selector U+FE0F. Imprime una tabla y un veredicto.
// Cierra el navegador y el servidor al terminar.
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { abrirNavegador } from '../cdp.mjs';
import { RAIZ } from './rasterizar.mjs';

const salida = path.resolve(process.argv[2] || 'muestra.png');
const movil = process.argv.includes('--movil');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(ruta).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const puerto = srv.address().port;
const nav = await abrirNavegador(movil ? { ancho: 360, alto: 740, movil: true } : { ancho: 1180, alto: 900 });
let codigo = 0;
try {
  await nav.ir(`http://127.0.0.1:${puerto}/tools/iconos/muestra.html`);
  await nav.esperarA('document.body.dataset.lista === "1"', 15000);
  await nav.esperar(300);
  const cargada = await nav.js('document.fonts.check(\'16px "DQ Iconos"\', "\\u2694")');
  // Fuente real por celda de la tabla de prueba.
  await nav.cmd('DOM.enable'); await nav.cmd('CSS.enable');
  const { root } = await nav.cmd('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await nav.cmd('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#prueba tbody td[data-k]' });
  const meta = await nav.js(`[...document.querySelectorAll('#prueba tbody td[data-k]')].map(td => ({ n: td.parentNode.dataset.n, cp: td.parentNode.dataset.cp, k: td.dataset.k, w: (() => { const r = document.createRange(); r.selectNodeContents(td); return Math.round(r.getBoundingClientRect().width * 10) / 10; })() }))`);
  const filas = {};
  for (let i = 0; i < nodeIds.length; i++) {
    const { fonts } = await nav.cmd('CSS.getPlatformFontsForNode', { nodeId: nodeIds[i] });
    const m = meta[i];
    (filas[m.n] || (filas[m.n] = { cp: m.cp }))[m.k] = { f: fonts.map(f => f.familyName + (f.isCustomFont ? '*' : '') + '×' + f.glyphCount).join('+') || '(nada)', w: m.w };
  }
  const col = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log('Fuente que eligió Chrome (* = fuente web; ×N = glifos dibujados; ancho en px a 20 px):');
  console.log(col('glifo', 18) + col('U+', 7) + ['juego', 'juego+FE0F', 'libre', 'libre+FE0F', 'sistema'].map(c => col(c, 26)).join(''));
  let ok = 0, okFE = 0, okLibreFE = 0, total = 0, anchoIgual = 0;
  const nuestra = x => x && /^DQ Iconos/.test(x.f) && !x.f.includes('+');
  for (const [n, f] of Object.entries(filas)) {
    total++; if (nuestra(f.juego)) ok++; if (nuestra(f.juegoFE0F)) okFE++; if (nuestra(f.libreFE0F)) okLibreFE++; if (f.juego.w === f.juegoFE0F.w) anchoIgual++;
    console.log(col(n, 18) + col(f.cp, 7) + ['juego', 'juegoFE0F', 'libre', 'libreFE0F', 'sistema'].map(k => col(f[k].f + ' ' + f[k].w, 26)).join(''));
  }
  const version = (await nav.cmd('Browser.getVersion')).product;
  console.log(`\n${version} · fuente cargada: ${cargada}`);
  console.log(`Sin U+FE0F:                 ${ok}/${total} usan DQ Iconos`);
  console.log(`Con U+FE0F (CSS del juego): ${okFE}/${total} usan solo DQ Iconos · mismo ancho que sin selector: ${anchoIgual}/${total}`);
  console.log(`Con U+FE0F (sin unicode-range): ${okLibreFE}/${total} usan solo DQ Iconos`);
  const alto = await nav.js('Math.ceil(document.documentElement.scrollHeight)');
  const ancho = movil ? 360 : 1180;
  const r = await nav.cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: ancho, height: Math.min(alto, 6000), scale: 1 } });
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, Buffer.from(r.data, 'base64'));
  console.log('Captura: ' + salida);
  const errores = nav.consola.filter(l => /^(error|EXCEPCION)/.test(l));
  if (errores.length) { console.log('Consola:\n' + errores.join('\n')); codigo = 1; }
  if (ok < total) codigo = 1;
} catch (e) { console.error(e); codigo = 1; }
finally { await nav.cerrar(); srv.close(); }
process.exit(codigo);
