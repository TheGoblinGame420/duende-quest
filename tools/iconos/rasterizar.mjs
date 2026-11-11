// ═══════════════════════════════════════════════════════
// DQ Iconos · rasterizado.
// Dibuja cada tools/iconos/src/<nombre>.svg con Chrome (tools/cdp.mjs) a
// TAM×TAM sobre blanco y guarda el PNG en una carpeta temporal del sistema.
// "Píxel oscuro = tinta": fuente.py convierte luego esos PNG en contornos.
//
//   node tools/iconos/rasterizar.mjs            (todos los SVG de src/)
//   node tools/iconos/rasterizar.mjs escudo ... (solo esos)
//
// Tiene caché: un SVG que no cambió no se vuelve a dibujar.
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../cdp.mjs';

export const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.join(AQUI, 'src');
export const RAIZ = path.resolve(AQUI, '..', '..');
export const TAM = 1024;
export const DIR_PNG = path.join(os.tmpdir(), 'dq-iconos-raster');

// Lo que la guía prohíbe dentro de un SVG (ver GUIA.md). Devuelve avisos.
export function revisarSvg(nombre, svg) {
  const av = [];
  const sin = svg.replace(/<!--[\s\S]*?-->/g, '');
  if (!/viewBox\s*=\s*["']0 0 64 64["']/.test(sin)) av.push('el viewBox debe ser "0 0 64 64"');
  for (const [re, que] of [
    [/<image\b/i, '<image> incrustada'], [/<text\b/i, '<text> (fuentes del sistema)'], [/<filter\b|filter\s*=/i, 'filtros'],
    [/Gradient\b/i, 'degradados'], [/opacity\s*[=:]/i, 'opacidades'], [/<style\b/i, '<style> (usa atributos)'], [/<mask\b/i, '<mask> (pinta blanco encima)'],
  ]) if (re.test(sin)) av.push('prohibido: ' + que);
  const colores = new Set();
  for (const m of sin.matchAll(/(?:fill|stroke)\s*[=:]\s*["']?\s*([^"';\s>]+)/gi)) colores.add(m[1].toLowerCase());
  for (const c of colores) if (!['#000', '#000000', 'black', '#fff', '#ffffff', 'white', 'none'].includes(c)) av.push('color no permitido: ' + c + ' (solo #000, #fff o none)');
  return av.map(a => nombre + ': ' + a);
}

// El SVG suelto, con ancho y alto fijos, como data: URL (así Chrome lo dibuja como vector al tamaño pedido).
export function svgComoUrl(svg, tam) {
  let s = svg.replace(/^﻿/, '').replace(/<\?xml[\s\S]*?\?>/, '').trim();
  s = s.replace(/<svg\b([^>]*)>/i, (_, a) => {
    a = a.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '');
    if (!/xmlns\s*=/.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"';
    return `<svg${a} width="${tam}" height="${tam}">`;
  });
  return 'data:image/svg+xml;base64,' + Buffer.from(s, 'utf8').toString('base64');
}

export function listarSvg(filtro) {
  const todos = fs.readdirSync(SRC).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)).sort();
  if (!filtro || !filtro.length) return todos;
  const faltan = filtro.filter(n => !todos.includes(n));
  if (faltan.length) throw new Error('No existe src/' + faltan.join('.svg, src/') + '.svg');
  return filtro;
}

// Rasteriza la lista de nombres. Devuelve { dir, hechos, deCache, avisos }.
export async function rasterizar(nombres, { tam = TAM, dir = DIR_PNG, nav = null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const avisos = [];
  const pend = [];
  for (const n of nombres) {
    const svg = fs.readFileSync(path.join(SRC, n + '.svg'), 'utf8');
    avisos.push(...revisarSvg(n, svg));
    const huella = crypto.createHash('sha1').update(tam + '\n' + svg).digest('hex');
    const png = path.join(dir, n + '.png'), sello = path.join(dir, n + '.sha1');
    if (fs.existsSync(png) && fs.existsSync(sello) && fs.readFileSync(sello, 'utf8') === huella) continue;
    pend.push({ n, svg, png, sello, huella });
  }
  if (pend.length) {
    const propio = !nav;
    if (propio) nav = await abrirNavegador({ ancho: 400, alto: 300 });
    try {
      await nav.ir('data:text/html,<html><body></body></html>');
      await nav.js(`window.__dib = async (url, tam) => {
        const img = new Image(); img.src = url; await img.decode();
        const c = document.createElement('canvas'); c.width = c.height = tam;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, tam, tam); g.drawImage(img, 0, 0, tam, tam);
        return c.toDataURL('image/png').split(',')[1];
      }; 1`);
      for (const p of pend) {
        let b64;
        try { b64 = await nav.js(`__dib(${JSON.stringify(svgComoUrl(p.svg, tam))}, ${tam})`); }
        catch (e) { throw new Error('Chrome no pudo dibujar src/' + p.n + '.svg (¿SVG mal formado?): ' + e.message); }
        fs.writeFileSync(p.png, Buffer.from(b64, 'base64'));
        fs.writeFileSync(p.sello, p.huella);
      }
    } finally { if (propio) await nav.cerrar(); }
  }
  return { dir, hechos: pend.length, deCache: nombres.length - pend.length, avisos };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const nombres = listarSvg(process.argv.slice(2));
  const r = await rasterizar(nombres);
  for (const a of r.avisos) console.log('AVISO ' + a);
  console.log(`Rasterizados ${r.hechos} (de caché: ${r.deCache}) en ${r.dir}`);
  process.exit(0);   // el WebSocket de Chrome tarda en soltar el proceso
}
