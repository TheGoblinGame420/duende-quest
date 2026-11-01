// ═══════════════════════════════════════════════════════
// Sube la version del juego en TODOS los sitios a la vez:
//  - los ?v=N de los HTML, JS y CSS que se publican (imports, <script>, importmap),
//  - la cache 'dq-vN' de sw.js,
//  - export const VERSION = N en mmo/js/data.js (el servidor la manda en
//    'bienvenido' y el cliente viejo se recarga solo cuando es seguro).
//
//   node tools/version.mjs        → la actual + 1
//   node tools/version.mjs 330    → esa
//
// Despues: node tools/verificar.mjs (comprueba que quedo el mismo N en todo).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Lo que no se publica o no es del juego (y worker.js, que solo nombra ?v= en un comentario).
const FUERA = new Set(['.git', '.claude', '.wrangler', 'node_modules', 'tools', 'functions', 'dist-test', 'recursos', 'promo', 'sql', 'assets', 'audio']);
const FUERA_ARCH = new Set(['worker.js']);

// Archivos publicados que pueden llevar ?v=N.
export function archivosVersionados() {
  const l = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), rel = path.relative(RAIZ, p).replace(/\\/g, '/');
      if (e.isDirectory()) { if (!FUERA.has(e.name)) andar(p); continue; }
      if (/\.(html|js|mjs|css)$/.test(e.name) && !FUERA_ARCH.has(rel)) l.push(rel);
    }
  })(RAIZ);
  return l.sort();
}
export const DATA = 'mmo/js/data.js', SW = 'sw.js';
export const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
export const versionDeData = () => +((/export const VERSION = (\d+);/.exec(leer(DATA)) || [])[1] || 0);

function main() {
  const actual = versionDeData();
  if (!actual) { console.error('No encuentro «export const VERSION = N;» en ' + DATA); process.exit(1); }
  const arg = process.argv[2];
  const n = arg === undefined ? actual + 1 : Number(arg);
  if (!Number.isInteger(n) || n < 1) { console.error('Uso: node tools/version.mjs [N]'); process.exit(1); }
  let tocados = 0, cambios = 0;
  const escribir = (rel, f) => {
    const antes = leer(rel), despues = f(antes);
    if (despues !== antes) { fs.writeFileSync(path.join(RAIZ, rel), despues); tocados++; }
  };
  for (const rel of archivosVersionados()) escribir(rel, s => s.replace(/\?v=\d+/g, () => { cambios++; return '?v=' + n; }));
  escribir(SW, s => s.replace(/(['"])dq-v\d+\1/, `$1dq-v${n}$1`));
  escribir(DATA, s => s.replace(/export const VERSION = \d+;/, `export const VERSION = ${n};`));
  console.log(`Version ${actual} → ${n}: ${cambios} ?v= en ${tocados} archivos (con sw.js y data.js).`);
  console.log('Falta: NOVEDADES en mmo/js/data.js, notas en SIGUIENTE.md y node tools/verificar.mjs');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
