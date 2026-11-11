// ═══════════════════════════════════════════════════════
// DQ Iconos · hoja de prueba para dibujantes.
//
//   node tools/iconos/hoja.mjs <salida.png> <nombre | lote-NN> ...
//   node tools/iconos/hoja.mjs C:/tmp/hoja.png escudo moneda lote-03
//
// Lee los SVG de src/ directamente (no reconstruye la fuente). Por cada icono:
//   · 128 px sobre fondo claro (para ver la forma),
//   · el de 16 px ampliado ×5 sin suavizar (lo que de verdad llega a la pantalla),
//   · sobre el fondo del juego (#0e091e) a 14, 16, 20, 24 y 32 px en blanco (#f2efff) y en oro (#ffd84a),
//   · nombre, % de tinta y márgenes (en rojo si se sale de la guía).
// Mira el PNG con atención antes de dar un icono por bueno.
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../cdp.mjs';
import { AQUI, SRC, revisarSvg } from './rasterizar.mjs';

const TAMS = [14, 16, 20, 24, 32];
const args = process.argv.slice(2);
if (args.length < 2) { console.log('Uso: node tools/iconos/hoja.mjs <salida.png> <nombre|lote-NN>...'); process.exit(1); }
const salida = path.resolve(args[0]);

// Nombres pedidos (un lote se abre en sus glifos) y datos del mapa (ancho de los símbolos de texto).
const mapa = JSON.parse(fs.readFileSync(path.join(AQUI, 'mapa.json'), 'utf8'));
const delMapa = Object.fromEntries(mapa.map(g => [g.nombre, g]));
let nombres = [];
const sinDibujo = [];
for (const a of args.slice(1)) {
  if (/^lote-\d+$/.test(a)) {
    const lote = JSON.parse(fs.readFileSync(path.join(AQUI, 'lotes', a + '.json'), 'utf8'));
    for (const g of lote.glifos) nombres.push(g.nombre);
  } else nombres.push(a.replace(/\.svg$/, ''));
}
nombres = [...new Set(nombres)].filter(n => { if (fs.existsSync(path.join(SRC, n + '.svg'))) return true; sinDibujo.push(n); return false; });
if (!nombres.length) { console.log('Ninguno de esos iconos tiene SVG en src/ todavía: ' + sinDibujo.join(', ')); process.exit(1); }

function interior(svg) {
  return svg.replace(/^\uFEFF/, '').replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[\s\S]*?>/i, '').trim()
    .replace(/<svg\b([^>]*)>/i, (_, a) => `<svg${a.replace(/\s(?:width|height|x|y)\s*=\s*["'][^"']*["']/gi, '')} x="0" y="0" width="64" height="64">`);
}
// El icono teñido: la tinta (oscuro) pasa a ser el color pedido y lo blanco, transparente. Igual que hará la fuente.
function tenido(svg, rgb) {
  const [r, g, b] = rgb.map(v => (v / 255).toFixed(4));
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><filter id="dqf" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  -0.3334 -0.3333 -0.3333 0 1"/></filter><g filter="url(#dqf)"><rect width="64" height="64" fill="#fff"/>${interior(svg)}</g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64');
}

const avisos = [];
const datos = nombres.map(n => {
  const svg = fs.readFileSync(path.join(SRC, n + '.svg'), 'utf8');
  avisos.push(...revisarSvg(n, svg));
  const g = delMapa[n] || {};
  return { n, ancho: g.ancho || 64, texto: !!g.texto, negro: tenido(svg, [26, 20, 40]), blanco: tenido(svg, [242, 239, 255]), oro: tenido(svg, [255, 216, 74]) };
});

const COLS = datos.length >= 9 ? 3 : datos.length >= 2 ? 2 : 1;
const html = `<style>
*{box-sizing:border-box;margin:0}
body{background:#2a2540;font:12px/1.2 "Segoe UI",system-ui,sans-serif;color:#f2efff;padding:10px;width:${COLS * 440 + 20}px}
#g{display:grid;grid-template-columns:repeat(${COLS},430px);gap:8px 10px}
.c{background:#0e091e;border:1px solid rgba(201,162,39,.42);border-radius:8px;padding:6px;display:grid;grid-template-columns:128px 80px 1fr;gap:6px;align-items:start}
.g{width:128px;height:128px;background:#f4efe6;border-radius:6px;position:relative;overflow:hidden}
.g img{width:128px;height:128px;display:block}
.g i{position:absolute;inset:8px;border:1px dashed rgba(180,60,60,.45)}
canvas{width:80px;height:80px;image-rendering:pixelated;border:1px solid #3a3358;display:block}
.z small{display:block;color:#7d7699;font-size:10px;margin-top:2px}
.f{display:flex;align-items:center;gap:7px;height:36px}
.f img{display:block}
.n{grid-column:1/-1;display:flex;justify-content:space-between;font-size:12px}
.n b{color:#ffd84a;font-weight:600}.n span{color:#b8b0d8}.n .mal{color:#ff5a6a;font-weight:700}
.t{font-size:15px;color:#f2efff;height:22px;display:flex;align-items:center;gap:2px;white-space:nowrap}
.t img{display:inline-block;vertical-align:-0.15em}
</style><div id="g">${datos.map((d, i) => `<div class="c" data-i="${i}">
<div class="g"><img src="${d.negro}"><i></i></div>
<div class="z"><canvas width="16" height="16"></canvas><small>16 px ×5</small></div>
<div><div class="f">${TAMS.map(t => `<img src="${d.blanco}" width="${t}" height="${t}">`).join('')}</div>
<div class="f">${TAMS.map(t => `<img src="${d.oro}" width="${t}" height="${t}">`).join('')}</div>
<div class="t">Nv 12 <img src="${d.blanco}" width="15" height="15"> Texto <img src="${d.oro}" width="15" height="15"> 3/5</div></div>
<div class="n"><b>${d.n}</b><span class="m"></span></div></div>`).join('')}</div>`;

const nav = await abrirNavegador({ ancho: COLS * 440 + 20, alto: 800 });
try {
  await nav.ir('data:text/html,<html><body></body></html>');
  await nav.js(`document.open(); document.write(${JSON.stringify(html)}); document.close(); 1`);
  await nav.js(`Promise.all([...document.images].map(i => i.decode().catch(() => 0))).then(() => 1)`);
  // Medidas: % de tinta y márgenes (en unidades de la rejilla de 64), más el 16 px ampliado.
  const med = await nav.js(`(() => { const out = []; for (const c of document.querySelectorAll('.c')) {
    const img = c.querySelector('.g img'); const k = document.createElement('canvas'); k.width = k.height = 256; const g = k.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.drawImage(img, 0, 0, 256, 256); const d = g.getImageData(0, 0, 256, 256).data;
    let n = 0, x0 = 256, y0 = 256, x1 = -1, y1 = -1;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const p = (y * 256 + x) * 4; if (d[p] + d[p + 1] + d[p + 2] < 500) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const cv = c.querySelector('canvas'), g2 = cv.getContext('2d'); g2.fillStyle = '#0e091e'; g2.fillRect(0, 0, 16, 16); g2.drawImage(c.querySelector('.f img:nth-child(2)'), 0, 0, 16, 16);
    out.push({ tinta: n / 655.36, izq: x0 / 4, arr: y0 / 4, der: (255 - x1) / 4, aba: (255 - y1) / 4 }); } return out; })()`);
  const filas = [];
  await nav.js(`(() => { const med = ${JSON.stringify(med)}, dat = ${JSON.stringify(datos.map(d => ({ ancho: d.ancho, texto: d.texto })))};
    document.querySelectorAll('.c').forEach((c, i) => { const m = med[i], d = dat[i]; const lado = (64 - d.ancho) / 2;
      const mg = Math.min(m.izq - lado, m.der - lado, m.arr, m.aba); const malM = mg < (d.texto ? 1.7 : 3.7), malT = !d.texto && (m.tinta < 24 || m.tinta > 50);
      c.querySelector('.m').innerHTML = '<span class="' + (malT ? 'mal' : '') + '">tinta ' + m.tinta.toFixed(0) + '%</span> · <span class="' + (malM ? 'mal' : '') + '">margen ' + mg.toFixed(1) + '</span>' + (d.texto ? ' · texto' : '') + (d.ancho !== 64 ? ' · ancho ' + d.ancho : ''); }); })()`);
  datos.forEach((d, i) => { const m = med[i]; const lado = (64 - d.ancho) / 2; filas.push(`${d.n.padEnd(22)} tinta ${m.tinta.toFixed(1).padStart(5)}%  margen mín ${Math.min(m.izq - lado, m.der - lado, m.arr, m.aba).toFixed(1)}`); });
  const alto = await nav.js('Math.ceil(document.getElementById("g").getBoundingClientRect().bottom + 10)');
  const r = await nav.cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: COLS * 440 + 20, height: alto, scale: 1 } });
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, Buffer.from(r.data, 'base64'));
  console.log(filas.join('\n'));
  for (const a of avisos) console.log('AVISO ' + a);
  if (sinDibujo.length) console.log('Sin SVG todavía: ' + sinDibujo.join(', '));
  console.log('Hoja: ' + salida + ' (' + datos.length + ' iconos)');
} finally { await nav.cerrar(); }
process.exit(0);   // salida explícita: el WebSocket de Chrome tarda en soltar el proceso
