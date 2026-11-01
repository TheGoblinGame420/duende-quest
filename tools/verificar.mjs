// ═══════════════════════════════════════════════════════
// Verificacion antes de publicar (la corre el hook pre-push y tools/deploy.mjs):
//  1. Sintaxis: node --check de cada JS (los de mmo/js, mundo/js, functions,
//     worker.js y tools como MODULOS: `node --check archivo.js` a secas no los
//     analiza como modulos y deja pasar errores).
//  2. Version: el mismo N en todos los ?v=, en 'dq-vN' de sw.js y en VERSION de
//     data.js; ningun <script src> local ni import del cliente sin ?v= (salvo los
//     que cubre el importmap de mundo/index.html).
//  3. Ningun metodo repetido entre los Object.assign(MmoWorld.prototype, ...) de
//     world.js (el ultimo pisa al otro sin avisar), ni uno que pise a la clase.
//  4. Cada mandar({ t: 'x' }) de los clientes tiene su case 'x' en el servidor.
//  5. El arnes del servidor (tools/arnes_mmo.mjs) en verde (--sin-arnes lo salta).
//
//   node tools/verificar.mjs [--sin-arnes]
//
// Para que corra solo antes de cada push (una vez, lo decide el dueño):
//   git config core.hooksPath tools/hooks
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { RAIZ, archivosVersionados, leer, versionDeData, DATA, SW } from './version.mjs';

const args = new Set(process.argv.slice(2));
const fallos = [];
const mal = (grupo, txt) => fallos.push(`[${grupo}] ${txt}`);
// Wallet y donaciones de la portada: no se tocan (regla del dueño), ni siquiera su <script>.
const SIN_V = new Set(['js/wallet-manager.js', 'js/donation-manager.js']);
const listar = (dir, re) => fs.existsSync(path.join(RAIZ, dir)) ? fs.readdirSync(path.join(RAIZ, dir)).filter(f => re.test(f)).map(f => dir + '/' + f) : [];

// ── 1. Sintaxis ──
function sintaxis() {
  const modulos = [...listar('mmo/js', /\.js$/), ...listar('mundo/js', /\.js$/), ...listar('functions/mmo', /\.js$/), ...listar('functions/api', /\.js$/), 'worker.js', ...listar('tools', /\.mjs$/), ...listar('js', /\.js$/).filter(f => /^\s*(import|export)\s/m.test(leer(f)))];
  const scripts = [...listar('js', /\.js$/).filter(f => !modulos.includes(f)), SW];
  for (const f of modulos) {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: leer(f), encoding: 'utf8' });
    if (r.status !== 0) mal('sintaxis', `${f}: ${(r.stderr || '').split('\n').filter(l => /Error/.test(l))[0] || 'no compila'}`);
  }
  for (const f of scripts) {
    const r = spawnSync(process.execPath, ['--check', path.join(RAIZ, f)], { encoding: 'utf8' });
    if (r.status !== 0) mal('sintaxis', `${f}: ${(r.stderr || '').split('\n').filter(l => /Error/.test(l))[0] || 'no compila'}`);
  }
  return modulos.length + scripts.length;
}

// ── 2. Version unica ──
function versiones() {
  const N = versionDeData();
  if (!N) { mal('version', `no hay «export const VERSION = N;» en ${DATA}`); return 0; }
  const otras = new Map();
  const anotar = (v, donde) => { if (v !== N) otras.set(donde, v); };
  const sw = /['"]dq-v(\d+)['"]/.exec(leer(SW));
  if (!sw) mal('version', 'sw.js no tiene la cache dq-vN'); else anotar(+sw[1], 'sw.js (dq-v)');
  // importmap de ORIGINS: lo que cubre se puede importar sin ?v=
  const mapa = new Set();
  const im = /<script type="importmap">([\s\S]*?)<\/script>/.exec(leer('mundo/index.html'));
  if (im) { try { for (const [k, v] of Object.entries(JSON.parse(im[1]).imports || {})) if (/\?v=\d+$/.test(v)) mapa.add(k); } catch (e) { mal('version', 'el importmap de mundo/index.html no es JSON válido'); } }
  for (const f of archivosVersionados()) {
    const s = leer(f);
    for (const m of s.matchAll(/\?v=(\d+)/g)) anotar(+m[1], f);
    if (f.endsWith('.html')) {
      for (const m of s.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"/g)) if (!/^(https?:)?\/\//.test(m[1]) && !SIN_V.has(m[1])) mal('version', `${f}: <script src="${m[1]}"> sin ?v=`);
    } else if (/^(mmo|mundo)\/js\//.test(f)) {
      for (const m of s.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?from\s*'([^']+)'|import\(\s*'([^']+)'\s*\)/g)) {
        const ruta = m[1] || m[2];
        if (!/^\.{0,2}\//.test(ruta) || /\?v=\d+/.test(ruta)) continue;
        const abs = ruta.startsWith('/') ? ruta : path.posix.normalize('/' + path.posix.dirname(f) + '/' + ruta);
        if (!mapa.has(abs)) mal('version', `${f}: import de '${ruta}' sin ?v= (y sin entrada en el importmap)`);
      }
    }
  }
  for (const [donde, v] of otras) mal('version', `${donde} dice ${v} y VERSION es ${N} (arreglar con: node tools/version.mjs ${N})`);
  return N;
}

// ── 3. Metodos repetidos en los Object.assign de MmoWorld ──
async function repetidos() {
  const w = leer('functions/mmo/world.js');
  const imps = {};
  for (const m of w.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.\/[\w]+\.js)'/g)) for (const n of m[1].split(',')) { const x = n.trim().split(/\s+as\s+/).pop(); if (x) imps[x] = m[2]; }
  const mezclas = [...w.matchAll(/Object\.assign\(MmoWorld\.prototype,\s*(\w+)\)/g)].map(m => m[1]);
  const i0 = w.indexOf('export class MmoWorld'), i1 = w.indexOf('\nObject.assign(MmoWorld.prototype');
  const cuerpo = i0 >= 0 ? w.slice(i0, i1 > i0 ? i1 : undefined) : '';
  const clase = new Set([...cuerpo.matchAll(/^ {2}(?:static )?(?:async )?\*?(\w+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]).filter(x => !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(x)));
  const visto = new Map();
  for (const n of mezclas) {
    if (!imps[n]) { mal('metodos', `world.js mezcla ${n} pero no encuentro su import`); continue; }
    let mod;
    try { mod = await import(pathToFileURL(path.join(RAIZ, 'functions/mmo', imps[n].slice(2))).href); }
    catch (e) { mal('metodos', `no se pudo importar ${imps[n]}: ${e.message}`); continue; }
    for (const k of Object.keys(mod[n] || {})) {
      if (visto.has(k)) mal('metodos', `${k} está en ${visto.get(k)} y en ${n} (el último pisa al primero)`);
      else visto.set(k, n);
      if (clase.has(k)) mal('metodos', `${n}.${k} pisa al método ${k} de la clase MmoWorld`);
    }
  }
  return visto.size + clase.size;
}

// ── 4. Cada mandar del cliente con su case en el servidor ──
function mensajes() {
  const cli = [...listar('mmo/js', /\.js$/), ...listar('mundo/js', /\.js$/)];
  const tipos = new Map();
  for (const f of cli) for (const m of leer(f).matchAll(/mandar\(\s*\{\s*t:\s*'(\w+)'/g)) if (!tipos.has(m[1])) tipos.set(m[1], f);
  const srv = [...listar('functions/mmo', /\.js$/)].map(leer).join('\n');
  for (const [t, f] of tipos) if (!srv.includes(`case '${t}'`) && !srv.includes(`=== '${t}'`)) mal('mensajes', `${f} manda '${t}' y el servidor no tiene su case`);
  return tipos.size;
}

// ── 5. Arnes ──
function arnes() {
  const correr = () => spawnSync(process.execPath, ['tools/arnes_mmo.mjs'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let r = correr();
  // Hay una prueba aleatoria conocida («ningún tipo acapara la zona»): un segundo intento.
  if (r.status !== 0) { console.log('  el arnés falló; segundo intento…'); r = correr(); }
  const fin = ((r.stdout || '').match(/\d+ bien, \d+ mal/g) || []).pop() || '';
  if (r.status !== 0) mal('arnes', `${fin || 'no terminó'}\n${(r.stdout || '').split('\n').filter(l => l.includes('✗')).slice(0, 15).join('\n')}${r.stderr ? '\n' + r.stderr.split('\n').slice(-6).join('\n') : ''}`);
  return fin;
}

const t0 = Date.now();
console.log(`Sintaxis: ${sintaxis()} archivos`);
console.log(`Versión: ${versiones()}`);
console.log(`Métodos de MmoWorld: ${await repetidos()}`);
console.log(`Mensajes del cliente: ${mensajes()} tipos`);
if (!args.has('--sin-arnes')) console.log(`Arnés: ${arnes() || '?'}`);
if (fallos.length) {
  console.error(`\n✗ ${fallos.length} problema(s):\n` + fallos.map(x => '  ' + x).join('\n'));
  process.exit(1);
}
console.log(`\n✓ Todo bien (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(0);
