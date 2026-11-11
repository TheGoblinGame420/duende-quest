// ═══════════════════════════════════════════════════════
// Foto del TALLER DE SKINS (mundo/taller.html): la imagen 2D de la skin y el
// duende 3D de frente, tres cuartos, perfil, espalda, busto y en accion.
//
//   node tools/foto_taller.mjs <skin> <salida.png> [--clase guerrero|mago|sacerdote|picaro]
//        [--arma katana|dagas|odachi|chispa] [--estado quieto|anda|corre|ataca|lanza|herido]
//        [--accion ataca|corre|lanza] [--cara N] [--pelo N] [--cuerpo N] [--grado N]
//        [--ligero] [--paquete] [--ref imagen_grande.png] [--archivo variante.js]
//   node tools/foto_taller.mjs --todas <carpeta> [las mismas opciones]
//
// --ref: imagen de referencia a la izquierda en vez de assets/skins/<img>.png (puede estar fuera del repo).
// --archivo: carga ese archivo de traje en vez de mundo/js/skins/<skin>.js (para probar variantes).
// --paquete: usa el traje de mundo/js/skins3d.js (lo que carga el juego), no el archivo suelto.
// Sirve la carpeta del repo en un puerto libre, espera window.listo, guarda la
// captura (1600x900), imprime los datos del modelo y los errores de consola y cierra todo.
// Sale con codigo 1 si el traje dio algun error. tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirNavegador } from './cdp.mjs';

process.removeAllListeners('warning');   // sin el aviso de Node por importar .js sin package.json
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const args = process.argv.slice(2);
const op = {}, libres = [];
const SUELTAS = new Set(['ligero', 'paquete']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) { const k = a.slice(2); op[k] = SUELTAS.has(k) ? '1' : args[++i]; }
  else libres.push(a);
}
if (!(op.todas || libres.length >= 2)) {
  console.error('Uso: node tools/foto_taller.mjs <skin> <salida.png> [--clase X] [--arma Y] [--estado Z] [--ref img.png]\n     node tools/foto_taller.mjs --todas <carpeta>');
  process.exit(2);
}
const REF = op.ref ? path.resolve(op.ref) : null;
const TRAJE = op.archivo ? path.resolve(op.archivo) : null;

// Servidor estatico minimo (solo lectura, solo dentro del repo; /__ref = la imagen de --ref, /__traje.js = el de --archivo).
function servir() {
  const srv = http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    let f = path.resolve(RAIZ, '.' + ruta);
    if (REF && ruta.startsWith('/__ref')) f = REF;
    else if (TRAJE && ruta === '/__traje.js') f = TRAJE;
    else if (!f.startsWith(RAIZ)) f = '';
    if (!f || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

const { SKINS } = await import(pathToFileURL(path.join(RAIZ, 'mmo/js/data.js')).href);
const lista = op.todas ? Object.keys(SKINS).map(s => [s, path.join(op.todas, s + '.png')]) : [[libres[0], libres[1]]];
if (op.todas) fs.mkdirSync(op.todas, { recursive: true });
for (const [s] of lista) if (!SKINS[s]) { console.error(`No existe la skin «${s}». Las hay: ${Object.keys(SKINS).join(', ')}`); process.exit(2); }

const srv = await servir();
const BASE = `http://127.0.0.1:${srv.address().port}`;
let nav = null, mal = 0;
try {
  nav = await abrirNavegador({ ancho: 1600, alto: 900, args: ['--hide-scrollbars'] });
  for (const [s, salida] of lista) {
    const q = new URLSearchParams({ skin: s });
    for (const k of ['clase', 'arma', 'estado', 'accion', 'cara', 'pelo', 'cuerpo', 'colorPelo', 'altura', 'disfraz', 'atuendo', 'grado', 'ligero', 'paquete', 'sinFusion']) if (op[k] != null) q.set(k, op[k]);
    if (REF) q.set('ref', '/__ref' + path.extname(REF));
    if (TRAJE) q.set('archivo', '/__traje.js');
    nav.consola.length = 0;
    await nav.ir(`${BASE}/mundo/taller.html?${q}`);
    let listo = true;
    try { await nav.esperarA('window.listo === true', 45000); } catch (e) { listo = false; }
    await nav.esperar(150);
    fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
    await nav.foto(salida);
    const d = await nav.js('JSON.stringify(window.datosTaller || null)').then(JSON.parse).catch(() => null);
    const ruido = l => /favicon/.test(l);
    const cons = nav.consola.filter(l => (l.startsWith('error') || l.startsWith('EXCEPCION') || l.startsWith('warning')) && !ruido(l));
    const tj = d && d.traje;
    console.log(`${s}: ${salida}` + (d ? ` · ${d.origen} · ${d.mallas} mallas · ${d.triangulos} triángulos · ${d.pivotes} pivotes` + (tj ? ` · traje: ${tj.piezas} piezas, ${tj.pivotes} pivotes, ${tj.sueltas} mallas sueltas` : '') : ' · SIN DATOS'));
    if (!listo) { console.log('  ✖ la página no llegó a window.listo (45 s)'); mal++; }
    if (d && d.errores && d.errores.length) mal++;
    else if (cons.some(l => !l.startsWith('warning'))) mal++;
    for (const l of cons) console.log('  consola → ' + l.split('\n').slice(0, 6).join('\n    '));
    if (!cons.length && listo) console.log('  sin errores de consola');
  }
} finally {
  if (nav) await nav.cerrar();
  srv.close();
}
process.exit(mal ? 1 : 0);
