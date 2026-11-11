// ═══════════════════════════════════════════════════════
// Empaqueta los trajes 3D de las skins: mundo/js/skins/<id>.js  →  mundo/js/skins3d.js
//
//   node tools/unir_skins.mjs            (genera mundo/js/skins3d.js)
//   node tools/unir_skins.mjs --revisar        (solo valida; no escribe; sale con 1 si alguno falla)
//   node tools/unir_skins.mjs --revisar <id>   (valida solo mundo/js/skins/<id>.js)
//
// El juego NUNCA carga los archivos sueltos (mundo/js/skins no se publica): modelos.js
// importa skins3d.js, un solo modulo con todos los trajes y `export const SKINS3D`.
// Cada archivo se valida importandolo en Node (no tienen imports). Si uno esta roto se
// deja fuera con un aviso y se sigue: esa skin se ve con su aspecto de reserva de modelos.js.
// Hay que volver a ejecutarlo cada vez que cambie un archivo de mundo/js/skins.
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.removeAllListeners('warning');   // sin el aviso de Node por importar .js sin package.json
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'mundo/js/skins');
const SALIDA = path.join(RAIZ, 'mundo/js/skins3d.js');
const REVISAR = process.argv.includes('--revisar');
const SOLO = REVISAR ? process.argv[process.argv.indexOf('--revisar') + 1] || '' : '';
const RE_DEF = /^export\s+default\s+/m;

// Devuelve el texto de un fallo o '' si el archivo vale.
async function revisar(id, archivo, src) {
  if (!/^[a-z][a-z0-9_]*$/.test(id)) return 'el nombre del archivo debe ser <id>.js en minúsculas, sin espacios';
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/^\s*import\s/m.test(sinComentarios) || /\bimport\s*\(/.test(sinComentarios)) return 'no puede tener imports (todo llega por K y ctx)';
  if ((sinComentarios.match(/^export\s+default\s+/gm) || []).length !== 1) return 'debe tener exactamente un «export default { ... }» al principio de una línea';
  if (/^export\s+(?!default\s)/m.test(sinComentarios)) return 'solo se admite «export default»';
  if (/\b(document|window|fetch|localStorage|eval)\b/.test(sinComentarios)) return 'no puede usar document, window, fetch, localStorage ni eval';
  let def;
  try { def = (await import(pathToFileURL(archivo).href + '?t=' + Date.now())).default; }
  catch (e) { return 'no se puede importar: ' + (e && e.message || e).toString().split('\n')[0]; }
  if (!def || typeof def !== 'object') return 'el export default no es un objeto';
  if (def.id !== id) return `id «${def.id}» distinto del nombre del archivo`;
  if (def.base != null && typeof def.base !== 'object') return 'base debe ser un objeto de colores';
  for (const k of ['ropa', 'pantalon', 'botas', 'acento', 'cinto', 'mangas', 'manos', 'hojaNeon']) {
    const v = def.base && def.base[k];
    if (v != null && !/^#[0-9a-fA-F]{6}$/.test(v)) return `base.${k} debe ser un color '#rrggbb' (es ${JSON.stringify(v)})`;
  }
  if (def.cuerpo != null && typeof def.cuerpo !== 'object') return 'cuerpo debe ser un objeto';
  for (const k of ['cabeza', 'vestir']) if (def[k] != null && typeof def[k] !== 'function') return k + ' debe ser una función';
  if (!def.base && !def.cabeza && !def.vestir) return 'no define nada (ni base, ni cabeza, ni vestir)';
  return '';
}

const archivos = (fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort() : []).filter(f => !SOLO || f === SOLO + '.js');
if (SOLO && !archivos.length) { console.error(`No existe mundo/js/skins/${SOLO}.js`); process.exit(1); }
const buenos = [], malos = [];
for (const f of archivos) {
  const id = f.slice(0, -3), archivo = path.join(DIR, f);
  const src = fs.readFileSync(archivo, 'utf8').replace(/^﻿/, '');
  const mal = await revisar(id, archivo, src);
  if (mal) { malos.push([id, mal]); console.warn(`AVISO: ${f} queda FUERA del paquete: ${mal}`); }
  else buenos.push([id, src]);
}

// Cada archivo va dentro de su propia funcion (sus constantes no chocan con las de
// otro) y «export default» pasa a ser el return. _t: si aun asi falla al cargar, null.
// Las lineas que son solo un comentario // se quitan (pesa menos en el celular).
let out = '// GENERADO por tools/unir_skins.mjs a partir de mundo/js/skins/*.js. NO EDITAR A MANO:\n' +
  '// edita mundo/js/skins/<id>.js y vuelve a ejecutar «node tools/unir_skins.mjs».\n' +
  '// Trajes 3D de las skins del duende (los registra mundo/js/modelos.js). Guia: mundo/js/skins/LEEME.md\n' +
  'const _t = f => { try { return f(); } catch (e) { return null; } };\n';
for (const [id, src] of buenos) {
  out += `\n// ── ${id} ──\nconst S_${id} = _t(() => {\n` + src.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*\n/gm, '').trim().replace(RE_DEF, 'return ') + '\n});\n';
}
out += '\nexport const SKINS3D = {' + buenos.map(([id]) => `\n  ${id}: S_${id},`).join('') + '\n};\n';

// El paquete entero tambien se prueba importandolo (desde una copia temporal).
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dq-skins-')), 'skins3d.mjs');
fs.writeFileSync(tmp, out);
let okPaquete = true;
try {
  const m = await import(pathToFileURL(tmp).href);
  for (const [id] of buenos) if (!m.SKINS3D[id] || m.SKINS3D[id].id !== id) { okPaquete = false; console.error(`ERROR: el traje «${id}» no sale bien del paquete`); }
} catch (e) { okPaquete = false; console.error('ERROR: el paquete generado no se puede importar: ' + (e && e.message || e)); }
try { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); } catch (e) {}

if (!okPaquete) { console.error('No se escribe mundo/js/skins3d.js (se queda el anterior).'); process.exit(1); }
if (!REVISAR) {
  const final = out.replace(/\n/g, '\r\n');
  const antes = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : null;
  if (antes !== final) fs.writeFileSync(SALIDA, final);
  console.log(`mundo/js/skins3d.js: ${buenos.length} trajes (${buenos.map(b => b[0]).join(', ')}) · ${(final.length / 1024).toFixed(1)} KB${antes === final ? ' · sin cambios' : ''}`);
} else console.log(`Revisados ${archivos.length} trajes: ${buenos.length} bien, ${malos.length} mal.`);
if (malos.length) { console.warn(`${malos.length} traje(s) fuera: ${malos.map(m => m[0]).join(', ')}`); process.exit(REVISAR ? 1 : 0); }
