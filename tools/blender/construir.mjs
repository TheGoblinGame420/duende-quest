// ═══════════════════════════════════════════════════════
// DUENDE QUEST — cadena Blender → juego
//
//   node tools/blender/construir.mjs                 construye TODAS las familias de tools/blender/modelos/*.py
//   node tools/blender/construir.mjs rocas ruinas    solo esas familias
//   node tools/blender/construir.mjs --indice        solo rehace assets/3d/dq_indice.json (tras fusionar ramas)
//   node tools/blender/construir.mjs --foto <familia> <modelo|todos> <salida.png> [--giro=40 --rapido --tinte=#2f6e4a --noche --lod=0]
//
// Cada familia sale en su propio paquete: assets/3d/dq_<familia>.json (indice) + dq_<familia>.bin (+ .bin.gz).
// assets/3d/dq_indice.json lista los paquetes que hay (con su huella): el juego (mundo/js/modelado.js) lee ese
// indice y baja solo lo que lista. Por eso añadir una familia no toca archivos de otra.
// Blender: variable de entorno BLENDER o la ruta por defecto de Windows. tools/ no se publica.
// ═══════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const SALIDA = path.join(RAIZ, 'assets', '3d');
const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe';
const args = process.argv.slice(2);

function blender(guion, extra) {
  const r = spawnSync(BLENDER, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(AQUI, guion), '--', ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const lineas = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/);
  for (const l of lineas) if (/^\[dq\]|Error|error:|Traceback|^\s+File "|SystemExit/.test(l)) console.log(l);
  if (r.status !== 0) { console.error('✗ ' + guion + ' terminó con error (código ' + r.status + '): mira la traza de arriba'); process.exit(1); }
}

function indice() {
  const paquetes = {};
  for (const f of fs.readdirSync(SALIDA).sort()) {
    const m = /^dq_(.+)\.json$/.exec(f);
    if (!m || m[1] === 'indice') continue;
    const bin = path.join(SALIDA, 'dq_' + m[1] + '.bin');
    if (!fs.existsSync(bin)) continue;
    const b = fs.readFileSync(bin), j = fs.readFileSync(path.join(SALIDA, f));
    paquetes[m[1]] = { h: crypto.createHash('sha1').update(b).update(j).digest('hex').slice(0, 10), bytes: b.length };
  }
  fs.writeFileSync(path.join(SALIDA, 'dq_indice.json'), JSON.stringify({ v: 1, paquetes }));
  return paquetes;
}

if (args[0] === '--foto') {
  blender('foto.py', args.slice(1));
} else if (args[0] === '--indice') {
  console.log('dq_indice.json:', Object.keys(indice()).join(', '));
} else {
  const todas = fs.readdirSync(path.join(AQUI, 'modelos')).filter(f => f.endsWith('.py') && !f.startsWith('_')).map(f => f.slice(0, -3));
  const familias = args.filter(a => !a.startsWith('--'));
  for (const f of familias) if (!todas.includes(f)) { console.error('No existe tools/blender/modelos/' + f + '.py'); process.exit(1); }
  for (const fam of familias.length ? familias : todas) {
    const t0 = Date.now();
    console.log('── ' + fam + ' ──');
    blender('_correr.py', [fam, SALIDA]);
    const bin = fs.readFileSync(path.join(SALIDA, 'dq_' + fam + '.bin'));
    const gz = zlib.gzipSync(bin, { level: 9 });
    fs.writeFileSync(path.join(SALIDA, 'dq_' + fam + '.bin.gz'), gz);
    const j = JSON.parse(fs.readFileSync(path.join(SALIDA, 'dq_' + fam + '.json'), 'utf8'));
    let t = [0, 0, 0];
    for (const n in j.modelos) j.modelos[n].lods.forEach((l, k) => { t[k] += l.i / 3; });
    console.log(`${fam}: ${Object.keys(j.modelos).length} modelos · triangulos por nivel ${t.join(' / ')} · ${(bin.length / 1024).toFixed(0)} KB, ${(gz.length / 1024).toFixed(0)} KB comprimido · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const p = indice();
  console.log('dq_indice.json: ' + Object.keys(p).join(', '));
}
