// ═══════════════════════════════════════════════════════
// DQ Iconos · un solo comando lo reconstruye todo:
//
//   node tools/iconos/construir.mjs
//
// 1) rasteriza los SVG de tools/iconos/src/ (Chrome, 1024 px, con caché),
// 2) llama a fuente.py (contornos + fontTools) y escribe assets/ui/dq-iconos.woff2,
// 3) deja tools/iconos/resumen.json (lo lee muestra.html) e imprime el resumen:
//    glifos, tamaño y puntos de código que todavía no tienen icono.
//
// Página de muestra: sirve la raíz del repo y abre /tools/iconos/muestra.html
// (o `node tools/iconos/probar.mjs <captura.png>` para verla sin ventana).
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AQUI, RAIZ, listarSvg, rasterizar } from './rasterizar.mjs';

const mapa = JSON.parse(fs.readFileSync(path.join(AQUI, 'mapa.json'), 'utf8'));
const enMapa = new Set(mapa.map(g => g.nombre));
const svgs = listarSvg();
const huerfanos = svgs.filter(n => !enMapa.has(n));
const nombres = svgs.filter(n => enMapa.has(n));

const t0 = Date.now();
const r = await rasterizar(nombres);
const salida = path.join(RAIZ, 'assets', 'ui', 'dq-iconos.woff2');
const resumenRuta = path.join(AQUI, 'resumen.json');
// Solo se pasan a Python los PNG de los SVG que existen hoy (la carpeta temporal puede guardar restos viejos).
const dirLimpio = path.join(r.dir, '_actual');
fs.rmSync(dirLimpio, { recursive: true, force: true });
fs.mkdirSync(dirLimpio, { recursive: true });
for (const n of nombres) fs.copyFileSync(path.join(r.dir, n + '.png'), path.join(dirLimpio, n + '.png'));
const py = spawnSync('python', ['-X', 'utf8', path.join(AQUI, 'fuente.py'), dirLimpio, path.join(AQUI, 'mapa.json'), salida, resumenRuta], { encoding: 'utf8' });
if (py.status !== 0) { console.error(py.stdout + '\n' + py.stderr); console.error('fuente.py falló'); process.exit(1); }

const res = JSON.parse(fs.readFileSync(resumenRuta, 'utf8'));
const cpsFaltan = res.faltan.reduce((s, f) => s + f.cps.length, 0);
console.log('── DQ Iconos ──────────────────────────────');
console.log(`Fuente:   assets/ui/${res.fuente}  ${res.bytes} bytes (${(res.bytes / 1024).toFixed(1)} KB), ~${res.bytesPorGlifo} bytes por glifo`);
console.log(`Glifos:   ${res.glifos} dibujados de ${mapa.length} (${res.puntosDeCodigo} puntos de código cubiertos)`);
console.log(`Faltan:   ${res.faltan.length} glifos (${cpsFaltan} puntos de código caen todavía al emoji de siempre)`);
const porLote = {};
for (const g of mapa) { const l = porLote[g.lote] || (porLote[g.lote] = [0, 0]); l[1]++; }
for (const h of res.hechos) if (porLote[h.lote]) porLote[h.lote][0]++;
console.log('Lotes:    ' + Object.keys(porLote).sort().map(l => `${l} ${porLote[l][0]}/${porLote[l][1]}`).join(' · '));
if (res.faltan.length && process.argv.includes('--faltan')) for (const f of res.faltan) console.log(`  falta ${f.lote} ${f.nombre}: ${f.cps.map(c => 'U+' + c).join(' ')}`);
for (const a of r.avisos) console.log('AVISO ' + a);
for (const e of res.errores) console.log('ERROR ' + e);
if (huerfanos.length) console.log('AVISO SVG sin entrada en mapa.json (no entran en la fuente): ' + huerfanos.join(', '));
console.log(`Hecho en ${((Date.now() - t0) / 1000).toFixed(1)} s (rasterizados ${r.hechos}, de caché ${r.deCache}). Usa --faltan para listar lo pendiente.`);
process.exit(res.errores.length || r.avisos.length ? 2 : 0);   // salida explícita: el WebSocket de Chrome tarda en soltar el proceso
