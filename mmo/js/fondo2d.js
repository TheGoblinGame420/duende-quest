// ═══════════════════════════════════════════════════════
// Fondo del mundo 2D (CLASSIC): ambientación «medieval místico realista».
// Todo es PROCEDURAL (sin imágenes): cielo, cordillera y bosque en capas con
// bruma, suelo con textura (tierra, empedrado, losas, arena, nieve), árboles,
// rocas, menhires con runas, ruinas, casas de piedra y madera, antorchas con
// halo, niebla baja, viñeta y ciclo de día y noche con la hora del teléfono.
//
// Rendimiento: lo estático se hornea UNA vez en lienzos (cielo, 2 capas de
// 1024 px en mosaico, y el mundo por trozos de 512 px con suelo + decorado +
// plataformas). Por cuadro solo se copian lienzos (unas 8-12 copias) y se
// dibujan las llamas. Nada de degradados ni trazados por cuadro.
//
// No toca personajes, skins, colisiones ni nada que valide el servidor.
// ═══════════════════════════════════════════════════════
const TROZO = 512, CAPA_W = 1024, MAX_TROZOS = 5;
const TAU = Math.PI * 2;

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
function rng(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function semilla(txt) { let h = 2166136261; for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619); return h >>> 0; }
// Azar fijo por coordenada del mundo (para que los trozos casen sin costura).
function hz(a, b) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mez = (a, b, k) => { const A = typeof a === 'string' ? rgb(a) : a, B = typeof b === 'string' ? rgb(b) : b; return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; };
const css = (c, a) => { const C = typeof c === 'string' ? rgb(c) : c; return a === undefined ? `rgb(${C[0] | 0},${C[1] | 0},${C[2] | 0})` : `rgba(${C[0] | 0},${C[1] | 0},${C[2] | 0},${a})`; };
const hex = c => '#' + c.map(n => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0')).join('');
const luzc = (c, k) => k >= 0 ? mez(c, '#ffffff', k) : mez(c, '#000000', -k);

// ── Estilos por fondo ──
// c: cielo (arriba, medio, horizonte) · br: bruma · lj/cr: capas lejana y cercana
// t: tierra · mu: musgo o borde · ho: follaje (oscuro, claro) · arc: acento arcano
// g: decorado grande · p: decorado pequeño · hueco: separación media del grande
const ESTILOS = {
  amanecer2: { c: ['#1b1a2b', '#4a3b4a', '#a9765c'], br: '#c2a08c', lj: '#3a3348', cr: '#262231', lejos: 'montes', hito: 'castillo', cerca: 'aldea', su: 'adoquin', t: '#4a443e', mu: '#6c6a47', ho: ['#27331f', '#4a5a30'], arc: '#b48cff', g: ['casa', 'roble', 'casa', 'valla', 'casa', 'barril', 'roble'], p: ['mata', 'flor', 'piedra', 'mata'], hueco: 120, ant: 330 },
  noche: { c: ['#05060f', '#0d1424', '#1e2e36'], br: '#5d7f86', lj: '#101c28', cr: '#0a1218', lejos: 'montes', hito: 'menhires', cerca: 'bosque', su: 'tierra', t: '#2b2a22', mu: '#42603a', ho: ['#0f2018', '#27472c'], arc: '#9d7bff', g: ['roble', 'roble', 'menhir', 'roble', 'ruina', 'roca', 'roble'], p: ['mata', 'seta', 'helecho', 'piedra', 'mata'], hueco: 95, ant: 620, estrellas: .7 },
  amanecer: { c: ['#2a1c26', '#6a3d3a', '#c48a5c'], br: '#d0a07e', lj: '#4a2e33', cr: '#2e1d22', lejos: 'montes', hito: 'torres', cerca: 'riscos', su: 'tierra', t: '#4f372d', mu: '#7c6c3e', ho: ['#3a2f1c', '#6a5a2c'], arc: '#ff9d5a', g: ['seco', 'roca', 'ruina', 'roble', 'roca', 'columna'], p: ['mata', 'piedra', 'flor', 'piedra'], hueco: 130, ant: 620 },
  selva: { c: ['#0c1a16', '#1f3a2c', '#5e7a4e'], br: '#8fae84', lj: '#17302a', cr: '#0e1f19', lejos: 'montes', hito: 'menhires', cerca: 'bosque', su: 'tierra', t: '#2f3022', mu: '#52803c', ho: ['#12301c', '#2f6a34'], arc: '#7dffb0', g: ['selva', 'selva', 'ruina', 'selva', 'roca', 'menhir'], p: ['helecho', 'mata', 'seta', 'flor', 'helecho'], hueco: 90, ant: 640 },
  tormenta: { c: ['#11141f', '#2a3242', '#5a6470'], br: '#8b96a3', lj: '#262d3b', cr: '#161a24', lejos: 'montes', hito: 'torres', cerca: 'riscos', su: 'roca', t: '#3b3c41', mu: '#5c6552', ho: ['#18241f', '#34493a'], arc: '#8fd8ff', g: ['roca', 'pino', 'roca', 'ruina', 'menhir', 'seco'], p: ['piedra', 'mata', 'piedra'], hueco: 125, ant: 600 },
  desierto: { c: ['#2b2233', '#7a5a4a', '#d4ae78'], br: '#dcc092', lj: '#6a5040', cr: '#4a3828', lejos: 'dunas', hito: 'torres', cerca: 'ruinas', su: 'arena', t: '#876c48', mu: '#b0965c', ho: ['#4a4426', '#7a7038'], arc: '#ffd27a', g: ['columna', 'roca', 'seco', 'ruina', 'columna', 'roca'], p: ['piedra', 'mata', 'piedra'], hueco: 150, ant: 640 },
  tormenta2: { c: ['#0e0c16', '#2a2030', '#5a3a3a'], br: '#8a6a6a', lj: '#1f1a26', cr: '#15121a', lejos: 'montes', hito: 'castillo', cerca: 'muralla', su: 'losa', t: '#3b3739', mu: '#5c5c4a', ho: ['#1c2218', '#3a4428'], arc: '#ff7a5a', g: ['muro', 'estandarte', 'pilar', 'muro', 'columna', 'roca'], p: ['piedra', 'mata', 'piedra'], hueco: 130, ant: 300 },
  cumbres: { c: ['#1a1c2e', '#4a4a66', '#c09a8c'], br: '#cfd3e0', lj: '#3d4058', cr: '#262a3c', lejos: 'montes', hito: 'torres', cerca: 'pinos', su: 'nieve', t: '#8d95a6', mu: '#e3e8f0', ho: ['#16261f', '#2f4a3c'], arc: '#9fd8ff', g: ['pino', 'roca', 'pino', 'menhir', 'ruina', 'pino'], p: ['piedra', 'mata', 'piedra'], hueco: 115, ant: 620, nevado: 1 },
  cavernas: { c: ['#07080f', '#10131f', '#1c2233'], br: '#4d6a8a', lj: '#141a2a', cr: '#0c101a', lejos: 'cueva', cerca: 'cueva', su: 'roca', t: '#2b2d37', mu: '#3f5268', ho: ['#14202a', '#2a4050'], arc: '#7dd3fc', g: ['estalagmita', 'cristal', 'roca', 'estalagmita', 'columna', 'menhir'], p: ['seta', 'piedra', 'seta', 'piedra'], hueco: 110, ant: 520, techo: 1 },
  abismo: { c: ['#04121c', '#0b2a3a', '#1d4f5e'], br: '#5fa3a8', lj: '#0c2a36', cr: '#081c26', lejos: 'montes', hito: 'torres', cerca: 'algas', su: 'arena', t: '#2f4a4a', mu: '#4f8a7a', ho: ['#0c3030', '#1f6a5a'], arc: '#7dfff0', g: ['columna', 'alga', 'roca', 'alga', 'ruina', 'cristal'], p: ['piedra', 'helecho', 'seta', 'piedra'], hueco: 115, ant: 0, techo: 1 },
  acantilados: { c: ['#141026', '#3a2a55', '#8a6a9a'], br: '#b79ad0', lj: '#2e2445', cr: '#1c162c', lejos: 'montes', hito: 'menhires', cerca: 'riscos', su: 'tierra', t: '#363145', mu: '#7c5ca2', ho: ['#231c3a', '#4a3a70'], arc: '#e8a0ff', g: ['menhir', 'cristal', 'roca', 'roble', 'ruina', 'menhir'], p: ['mata', 'flor', 'seta', 'piedra'], hueco: 120, ant: 640, estrellas: .5 },
};
ESTILOS.selva2 = ESTILOS.selva;
const _estilos = new Map();
function estiloDe(mp) {
  const k = mp.fondo + (mp.instancia ? '|m' : '');
  let e = _estilos.get(k);
  if (e) return e;
  e = ESTILOS[mp.fondo] || ESTILOS.noche;
  if (mp.instancia) {
    // Mazmorras: interior de piedra, sin bosque ni cielo abierto.
    const cueva = e.cerca === 'cueva' || e.cerca === 'algas';
    e = { ...e, c: e.c.map(x => hex(mez(x, '#04040a', .45))), su: 'losa', cerca: cueva ? 'cueva' : 'muralla', lejos: 'cueva', hito: null, techo: 1, g: cueva ? ['pilar', 'estalagmita', 'columna', 'cristal', 'pilar', 'roca'] : ['pilar', 'muro', 'columna', 'estandarte', 'pilar', 'muro'], p: ['piedra', 'piedra', 'seta'], hueco: 140, ant: 280, t: hex(mez(e.t, '#3a3a40', .5)) };
  }
  _estilos.set(k, e);
  return e;
}

// ── Hora: 0 de día, 1 de noche (con amanecer y atardecer suaves) ──
let _noche = 0, _nocheT = -1e9;
function nocheAhora() {
  const t = Date.now();
  if (t - _nocheT < 2000) return _noche;
  _nocheT = t;
  let h;
  if (typeof window.dqHora2d === 'number') h = window.dqHora2d;
  else { const d = new Date(); h = d.getHours() + d.getMinutes() / 60; }
  const s = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const n = h < 12 ? 1 - s(5, 7.5, h) : s(17, 19.5, h);
  _noche = Math.round(n * 5) / 5;
  return _noche;
}

// ── Texturas compartidas ──
let _grano = null;
function grano() {
  if (_grano) return _grano;
  const c = lienzo(128, 128), x = c.getContext('2d'), d = x.createImageData(128, 128), r = rng(77);
  for (let i = 0; i < d.data.length; i += 4) { const v = r(); const osc = v < .5; d.data[i] = d.data[i + 1] = d.data[i + 2] = osc ? 0 : 255; d.data[i + 3] = Math.abs(v - .5) * (osc ? 90 : 46); }
  x.putImageData(d, 0, 0);
  return _grano = c;
}
const _tierras = new Map();
// Loseta de 128 px que casa por los cuatro lados: color base + manchas + grano.
function tierra(hex) {
  let c = _tierras.get(hex);
  if (c) return c;
  c = lienzo(128, 128);
  const x = c.getContext('2d'), d = x.createImageData(128, 128), b = rgb(hex), r = rng(semilla(hex));
  const N = 8, red = []; for (let i = 0; i < N * N; i++) red.push(r());
  for (let py = 0; py < 128; py++) for (let px = 0; px < 128; px++) {
    const fx = px / 16, fy = py / 16, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = red[iy * N + ix], b2 = red[iy * N + (ix + 1) % N], c2 = red[((iy + 1) % N) * N + ix], d2 = red[((iy + 1) % N) * N + (ix + 1) % N];
    const m = (a + (b2 - a) * sx) * (1 - sy) + (c2 + (d2 - c2) * sx) * sy;
    const k = .78 + m * .34 + (r() - .5) * .16, i = (py * 128 + px) * 4;
    d.data[i] = b[0] * k; d.data[i + 1] = b[1] * k; d.data[i + 2] = b[2] * k; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  _tierras.set(hex, c);
  return c;
}
const _halos = new Map();
function halo(hex, tam) {
  const k = hex + tam;
  let c = _halos.get(k);
  if (c) return c;
  c = lienzo(tam, tam);
  const x = c.getContext('2d'), gr = x.createRadialGradient(tam / 2, tam / 2, 1, tam / 2, tam / 2, tam / 2);
  gr.addColorStop(0, css(hex, .55)); gr.addColorStop(.35, css(hex, .2)); gr.addColorStop(1, css(hex, 0));
  x.fillStyle = gr; x.fillRect(0, 0, tam, tam);
  _halos.set(k, c);
  return c;
}
let _llamas = null;
function llamas() {
  if (_llamas) return _llamas;
  _llamas = [0, 1, 2].map(i => {
    const c = lienzo(12, 18), x = c.getContext('2d'), inc = (i - 1) * 1.5;
    x.fillStyle = '#ff7a1a'; x.beginPath(); x.moveTo(6 + inc, 0); x.quadraticCurveTo(12, 9, 9, 15); x.quadraticCurveTo(6, 18, 3, 15); x.quadraticCurveTo(0, 9, 6 + inc, 0); x.fill();
    x.fillStyle = '#ffd36a'; x.beginPath(); x.moveTo(6 + inc * .5, 6); x.quadraticCurveTo(9.5, 12, 7.5, 15.5); x.quadraticCurveTo(6, 17, 4.5, 15.5); x.quadraticCurveTo(2.5, 12, 6 + inc * .5, 6); x.fill();
    x.fillStyle = '#fff6d0'; x.fillRect(5, 12, 2, 3);
    return c;
  });
  return _llamas;
}

// ── Piezas del decorado (se dibujan una vez, al hornear) ──
function sombraBase(g, x, y, a) { g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(x, y, a, Math.max(2, a * .16), 0, 0, TAU); g.fill(); }
function volumen(g, x0, x1, c, k) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, css(luzc(c, k))); gr.addColorStop(.55, css(c)); gr.addColorStop(1, css(luzc(c, -k * 1.6))); return gr; }
function copa(g, x, y, R, r, ho, n) {
  const P = []; for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * .75; P.push([x + Math.cos(a) * d * 1.15, y + Math.sin(a) * d * .7, R * (.34 + r() * .26)]); }
  g.fillStyle = css(luzc(ho[0], -.25)); for (const [px, py, pr] of P) { g.beginPath(); g.arc(px + 2, py + 3, pr, 0, TAU); g.fill(); }
  g.fillStyle = css(ho[0]); for (const [px, py, pr] of P) { g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); }
  g.fillStyle = css(mez(ho[0], ho[1], .6)); for (const [px, py, pr] of P) { g.beginPath(); g.arc(px - pr * .22, py - pr * .25, pr * .68, 0, TAU); g.fill(); }
  g.fillStyle = css(ho[1]); for (const [px, py, pr] of P) { g.beginPath(); g.arc(px - pr * .38, py - pr * .42, pr * .34, 0, TAU); g.fill(); }
}
function tronco(g, x, y, h, a, r, c) {
  g.fillStyle = volumen(g, x - a, x + a, c, .22);
  g.beginPath(); g.moveTo(x - a * 1.7, y); g.quadraticCurveTo(x - a * .9, y - h * .12, x - a * .7, y - h); g.lineTo(x + a * .7, y - h); g.quadraticCurveTo(x + a * .9, y - h * .12, x + a * 1.8, y); g.closePath(); g.fill();
  g.strokeStyle = css(luzc(c, -.45), .6); g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 4; i++) { const bx = x - a * .5 + r() * a, by = y - r() * h * .8; g.moveTo(bx, by); g.lineTo(bx + (r() - .5) * 2, by - 6 - r() * 12); }
  g.stroke();
}
const PIEZAS = {
  roble(g, x, y, s, r, e) {
    const h = (110 + r() * 60) * s, c = '#2c221c';
    sombraBase(g, x, y, 26 * s);
    tronco(g, x, y, h * .62, 7 * s, r, c);
    g.strokeStyle = css(luzc(c, -.1)); g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x, y - h * .5); g.lineTo(x - 22 * s, y - h * .78); g.moveTo(x, y - h * .55); g.lineTo(x + 24 * s, y - h * .8); g.stroke();
    copa(g, x, y - h * .82, 44 * s, r, e.ho, 11);
  },
  selva(g, x, y, s, r, e) {
    const h = (140 + r() * 50) * s, c = '#2a2a1e';
    sombraBase(g, x, y, 30 * s);
    tronco(g, x, y, h * .7, 9 * s, r, c);
    copa(g, x, y - h * .84, 52 * s, r, e.ho, 13);
    // Lianas
    g.strokeStyle = css(e.ho[0], .9); g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const lx = x - 34 * s + r() * 68 * s, l = 28 + r() * 44; g.beginPath(); g.moveTo(lx, y - h * .7); g.quadraticCurveTo(lx + (r() - .5) * 10, y - h * .7 + l * .6, lx + (r() - .5) * 6, y - h * .7 + l); g.stroke(); }
    g.fillStyle = css(e.mu, .7); g.fillRect(x - 6 * s, y - h * .3, 5 * s, 10); g.fillRect(x + 1, y - h * .16, 4 * s, 7);
  },
  pino(g, x, y, s, r, e) {
    const h = (120 + r() * 60) * s;
    sombraBase(g, x, y, 20 * s);
    g.fillStyle = volumen(g, x - 4, x + 4, '#2a211c', .2); g.fillRect(x - 3 * s, y - h * .3, 6 * s, h * .3);
    for (let i = 0; i < 5; i++) {
      const yy = y - h * (.18 + i * .16), w = (34 - i * 5.2) * s, al = h * .28;
      g.fillStyle = css(luzc(e.ho[0], -.1)); g.beginPath(); g.moveTo(x, yy - al); g.lineTo(x + w, yy); g.lineTo(x + w * .45, yy - 3); g.lineTo(x, yy + 2); g.lineTo(x - w * .5, yy - 3); g.lineTo(x - w, yy); g.closePath(); g.fill();
      g.fillStyle = css(mez(e.ho[0], e.ho[1], .7)); g.beginPath(); g.moveTo(x, yy - al); g.lineTo(x - w, yy); g.lineTo(x - w * .5, yy - 3); g.lineTo(x - 2, yy - al * .35); g.closePath(); g.fill();
      if (e.nevado) { g.fillStyle = 'rgba(232,238,246,.85)'; g.beginPath(); g.moveTo(x, yy - al); g.lineTo(x - w * .55, yy - al * .35); g.lineTo(x - w * .2, yy - al * .42); g.lineTo(x + w * .1, yy - al * .3); g.lineTo(x + w * .4, yy - al * .45); g.closePath(); g.fill(); }
    }
  },
  seco(g, x, y, s, r) {
    const h = (80 + r() * 50) * s, c = '#3a2e28';
    sombraBase(g, x, y, 14 * s);
    tronco(g, x, y, h * .7, 5 * s, r, c);
    g.strokeStyle = css(luzc(c, -.1)); g.lineCap = 'round';
    const rama = (bx, by, a, l, w) => { if (l < 6) return; const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke(); rama(ex, ey, a - .45 - r() * .3, l * .66, w * .7); rama(ex, ey, a + .4 + r() * .3, l * .6, w * .7); };
    rama(x, y - h * .66, -Math.PI / 2 - .5, h * .3, 3 * s); rama(x, y - h * .6, -Math.PI / 2 + .55, h * .28, 3 * s);
    g.lineCap = 'butt';
  },
  roca(g, x, y, s, r, e) {
    const w = (26 + r() * 30) * s, h = (16 + r() * 26) * s, c = mez(e.t, '#77787c', .55);
    sombraBase(g, x, y, w * .9);
    const P = [[-w, 0], [-w * .8, -h * .55], [-w * .3 + r() * 6, -h], [w * .35, -h * (.8 + r() * .2)], [w * .85, -h * .45], [w, 0]];
    const gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, css(luzc(c, .18))); gr.addColorStop(1, css(luzc(c, -.5)));
    g.fillStyle = gr; g.beginPath(); P.forEach(([a, b], i) => i ? g.lineTo(x + a, y + b) : g.moveTo(x + a, y + b)); g.closePath(); g.fill();
    g.fillStyle = css(luzc(c, -.35), .7); g.beginPath(); g.moveTo(x + P[3][0], y + P[3][1]); g.lineTo(x + P[4][0], y + P[4][1]); g.lineTo(x + w, y); g.lineTo(x + w * .2, y); g.closePath(); g.fill();
    g.fillStyle = css(luzc(c, .3), .55); g.beginPath(); g.moveTo(x + P[1][0], y + P[1][1]); g.lineTo(x + P[2][0], y + P[2][1]); g.lineTo(x - w * .1, y - h * .55); g.closePath(); g.fill();
    g.fillStyle = css(e.nevado ? '#e6ebf2' : e.mu, .85); g.beginPath(); g.moveTo(x + P[1][0], y + P[1][1]); g.lineTo(x + P[2][0], y + P[2][1]); g.lineTo(x + P[3][0], y + P[3][1]); g.lineTo(x + P[3][0] - 4, y + P[3][1] + 4); g.lineTo(x + P[2][0], y + P[2][1] + 5); g.lineTo(x + P[1][0] + 3, y + P[1][1] + 4); g.closePath(); g.fill();
  },
  menhir(g, x, y, s, r, e) {
    const h = (62 + r() * 48) * s, w = (11 + r() * 6) * s, inc = (r() - .5) * 10, c = mez(e.t, '#6c6e76', .6);
    sombraBase(g, x, y, w * 1.6);
    g.fillStyle = volumen(g, x - w, x + w, c, .2);
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * .8 + inc * .5, y - h * .7); g.lineTo(x - w * .3 + inc, y - h); g.lineTo(x + w * .5 + inc, y - h * .94); g.lineTo(x + w * .9 + inc * .5, y - h * .6); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.strokeStyle = css(luzc(c, -.5), .7); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w * .2 + inc * .6, y - h * .8); g.lineTo(x + inc * .3, y - h * .55); g.lineTo(x - w * .4, y - h * .3); g.stroke();
    // Runas con resplandor
    g.save(); g.shadowColor = e.arc; g.shadowBlur = 6; g.strokeStyle = e.arc; g.lineWidth = 1.5; g.globalAlpha = .9;
    for (let i = 0; i < 3; i++) {
      const ry = y - h * (.72 - i * .2), rx = x + inc * (.6 - i * .2), t = (r() * 4) | 0;
      g.beginPath();
      if (t === 0) { g.moveTo(rx - 3, ry + 4); g.lineTo(rx, ry - 4); g.lineTo(rx + 3, ry + 4); }
      else if (t === 1) { g.moveTo(rx, ry - 5); g.lineTo(rx, ry + 5); g.moveTo(rx, ry - 2); g.lineTo(rx + 3, ry - 5); g.moveTo(rx, ry + 1); g.lineTo(rx + 3, ry - 2); }
      else if (t === 2) { g.moveTo(rx - 3, ry); g.lineTo(rx, ry - 4); g.lineTo(rx + 3, ry); g.lineTo(rx, ry + 4); g.closePath(); }
      else { g.moveTo(rx - 3, ry - 4); g.lineTo(rx + 3, ry + 4); g.moveTo(rx + 3, ry - 4); g.lineTo(rx - 3, ry + 4); }
      g.stroke();
    }
    g.restore();
    g.fillStyle = css(e.mu, .8); g.beginPath(); g.ellipse(x, y - 1, w * 1.2, 4, 0, Math.PI, TAU); g.fill();
  },
  // Muro en ruinas: sillares con juntas y perfil roto.
  ruina(g, x, y, s, r, e) { sillares(g, x, y, (70 + r() * 50) * s, (46 + r() * 34) * s, r, e, true); },
  muro(g, x, y, s, r, e) {
    const w = (110 + r() * 50) * s, h = (96 + r() * 30) * s;
    sillares(g, x, y, w, h, r, e, false);
    // Almenas y tronera con luz
    const c = mez(e.t, '#6a6a70', .5);
    for (let ax = x - w / 2; ax < x + w / 2 - 6; ax += 18) { g.fillStyle = css(luzc(c, hz(ax | 0, 3) * .2 - .15)); g.fillRect(ax, y - h - 9, 11, 10); }
    g.fillStyle = '#0a0a10'; g.fillRect(x - 2, y - h * .62, 4, 16);
  },
  columna(g, x, y, s, r, e) {
    const h = (56 + r() * 60) * s, w = 9 * s, c = mez(e.t, '#8a8880', .6);
    sombraBase(g, x, y, w * 2);
    g.fillStyle = css(luzc(c, -.2)); g.fillRect(x - w * 1.5, y - 6, w * 3, 6);
    g.fillStyle = volumen(g, x - w, x + w, c, .25); g.fillRect(x - w, y - h, w * 2, h - 5);
    g.strokeStyle = css(luzc(c, -.45), .55); g.lineWidth = 1; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(x + i * w * .5, y - h + 2); g.lineTo(x + i * w * .5, y - 7); } g.stroke();
    // Remate roto
    g.fillStyle = css(luzc(c, .1)); g.beginPath(); g.moveTo(x - w * 1.3, y - h); g.lineTo(x - w * 1.3, y - h - 5); g.lineTo(x - w * .2, y - h - 5 - r() * 6); g.lineTo(x + w * .5, y - h - 2); g.lineTo(x + w * 1.3, y - h - 5); g.lineTo(x + w * 1.3, y - h); g.closePath(); g.fill();
    g.fillStyle = css(e.mu, .7); g.fillRect(x - w, y - h * .45, w * .9, 5); g.fillRect(x - w * 1.5, y - 8, w * 1.6, 3);
  },
  pilar(g, x, y, s, r, e) {
    // Pilar de mazmorra con basa, capitel y una cadena colgando.
    const w = 13 * s, c = mez(e.t, '#5c5c66', .5), h = 178;
    sombraBase(g, x, y, w * 2);
    g.fillStyle = volumen(g, x - w, x + w, c, .2); g.fillRect(x - w, y - h, w * 2, h);
    g.strokeStyle = css(luzc(c, -.5), .6); g.lineWidth = 1; g.beginPath(); for (let yy = y - 14; yy > y - h; yy -= 22) { g.moveTo(x - w, yy); g.lineTo(x + w, yy); } g.stroke();
    g.fillStyle = css(luzc(c, -.15)); g.fillRect(x - w * 1.4, y - 9, w * 2.8, 9); g.fillRect(x - w * 1.5, y - h - 8, w * 3, 9);
    g.fillStyle = css(luzc(c, .12)); g.fillRect(x - w * 1.4, y - 11, w * 2.8, 2); g.fillRect(x - w * 1.5, y - h - 10, w * 3, 2);
    g.strokeStyle = 'rgba(20,20,26,.9)'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x + w + 5, y - h); g.lineTo(x + w + 5, y - h + 40 + r() * 50); g.stroke(); g.setLineDash([]);
  },
  estandarte(g, x, y, s, r, e) {
    const h = 96 * s;
    g.fillStyle = '#231c18'; g.fillRect(x - 1.5, y - h, 3, h);
    g.fillStyle = css(mez(e.arc, '#2a1420', .7)); g.beginPath(); g.moveTo(x + 2, y - h + 4); g.lineTo(x + 24, y - h + 4); g.lineTo(x + 24, y - h + 46); g.lineTo(x + 13, y - h + 38); g.lineTo(x + 2, y - h + 46); g.closePath(); g.fill();
    g.fillStyle = css(mez(e.arc, '#e3b25b', .5), .85); g.beginPath(); g.moveTo(x + 13, y - h + 12); g.lineTo(x + 18, y - h + 20); g.lineTo(x + 13, y - h + 28); g.lineTo(x + 8, y - h + 20); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 14, y - h + 4, 10, 40);
  },
  estalagmita(g, x, y, s, r, e) {
    const c = mez(e.t, '#5a6070', .5);
    sombraBase(g, x, y, 16 * s);
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * 12 * s, h = (30 + r() * 46) * s * (i === 1 ? 1.3 : .8), w = (7 + r() * 5) * s;
      g.fillStyle = volumen(g, bx - w, bx + w, c, .25); g.beginPath(); g.moveTo(bx - w, y); g.quadraticCurveTo(bx - w * .3, y - h * .5, bx, y - h); g.quadraticCurveTo(bx + w * .4, y - h * .5, bx + w, y); g.closePath(); g.fill();
    }
  },
  cristal(g, x, y, s, r, e) {
    g.save(); g.shadowColor = e.arc; g.shadowBlur = 10;
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * 9 * s, h = (22 + r() * 30) * s, w = (4 + r() * 3) * s, inc = (i - 1) * 6;
      g.fillStyle = css(mez(e.arc, '#1a1430', .45), .92); g.beginPath(); g.moveTo(bx - w, y); g.lineTo(bx - w + inc, y - h * .8); g.lineTo(bx + inc, y - h); g.lineTo(bx + w + inc, y - h * .8); g.lineTo(bx + w, y); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = css(luzc(e.arc, .5), .7); g.beginPath(); g.moveTo(bx - w, y); g.lineTo(bx - w + inc, y - h * .8); g.lineTo(bx + inc, y - h); g.lineTo(bx - w * .2 + inc * .5, y - h * .4); g.closePath(); g.fill();
    }
    g.restore();
  },
  alga(g, x, y, s, r, e) {
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bx = x + (i - 1.5) * 7, h = (50 + r() * 60) * s, o = (r() - .5) * 16;
      g.strokeStyle = css(i % 2 ? e.ho[1] : e.ho[0]); g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx, y); g.bezierCurveTo(bx + o, y - h * .35, bx - o, y - h * .7, bx + o * .6, y - h); g.stroke();
    }
    g.lineCap = 'butt';
  },
  casa(g, x, y, s, r, e, noche) {
    const w = (86 + r() * 34) * s, h1 = 40 * s, h2 = (34 + r() * 10) * s, ht = (38 + r() * 14) * s;
    const piedra = mez(e.t, '#7a766e', .6), yeso = mez('#8a7c66', e.c[1], .35), viga = '#2a1e16', teja = mez('#4a2e26', e.c[0], .35);
    sombraBase(g, x, y, w * .6);
    // Planta de piedra
    g.fillStyle = css(piedra); g.fillRect(x - w / 2, y - h1, w, h1);
    for (let by = 0; by < h1; by += 8) for (let bx = (by / 8 & 1) * 7 - 7; bx < w; bx += 14) { g.fillStyle = css(luzc(piedra, hz((x + bx) | 0, by) * .3 - .2)); g.fillRect(x - w / 2 + Math.max(0, bx) + 1, y - h1 + by + 1, Math.min(13, w - bx - 1) - (bx < 0 ? -bx : 0), 7); }
    // Planta de entramado (yeso y vigas), con un pequeño vuelo
    const w2 = w + 8;
    g.fillStyle = css(yeso); g.fillRect(x - w2 / 2, y - h1 - h2, w2, h2);
    g.fillStyle = viga; g.fillRect(x - w2 / 2, y - h1 - 3, w2, 4); g.fillRect(x - w2 / 2, y - h1 - h2, w2, 3);
    for (let i = 0; i <= 4; i++) g.fillRect(x - w2 / 2 + i * (w2 - 3) / 4, y - h1 - h2, 3, h2);
    g.strokeStyle = viga; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - w2 / 2 + 2, y - h1 - 2); g.lineTo(x - w2 / 4, y - h1 - h2 + 2); g.moveTo(x + w2 / 2 - 2, y - h1 - 2); g.lineTo(x + w2 / 4, y - h1 - h2 + 2); g.stroke();
    // Sombra del alero y lado en sombra
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - w2 / 2, y - h1 - h2, w2, 6); g.fillRect(x + w2 * .22, y - h1 - h2, w2 * .28, h2); g.fillRect(x + w * .22, y - h1, w * .28, h1);
    // Tejado a dos aguas con hileras de teja
    const tx0 = x - w2 / 2 - 8, tx1 = x + w2 / 2 + 8, ty = y - h1 - h2;
    g.fillStyle = css(teja); g.beginPath(); g.moveTo(tx0, ty + 2); g.lineTo(x - w * .12, ty - ht); g.lineTo(x + w * .12, ty - ht); g.lineTo(tx1, ty + 2); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = css(luzc(teja, -.4), .8); g.lineWidth = 1; g.beginPath(); for (let yy = ty - ht + 5; yy < ty + 2; yy += 5) { g.moveTo(tx0, yy); g.lineTo(tx1, yy); } g.stroke();
    g.fillStyle = css(luzc(teja, .22), .5); g.beginPath(); g.moveTo(tx0, ty + 2); g.lineTo(x - w * .12, ty - ht); g.lineTo(x, ty - ht); g.lineTo(x - w * .3, ty + 2); g.closePath(); g.fill();
    if (e.nevado) { g.fillStyle = 'rgba(232,238,246,.8)'; g.fillRect(tx0, ty - ht, tx1 - tx0, 9); }
    g.restore();
    // Chimenea
    g.fillStyle = css(luzc(piedra, -.2)); g.fillRect(x + w * .2, ty - ht - 8, 10, 22); g.fillStyle = css(luzc(piedra, .1)); g.fillRect(x + w * .2 - 1, ty - ht - 10, 12, 3);
    // Puerta de madera con arco
    g.fillStyle = '#1e1510'; g.beginPath(); g.moveTo(x - w * .3 - 8, y); g.lineTo(x - w * .3 - 8, y - 22); g.quadraticCurveTo(x - w * .3, y - 32, x - w * .3 + 8, y - 22); g.lineTo(x - w * .3 + 8, y); g.closePath(); g.fill();
    g.fillStyle = '#3a2a1c'; g.fillRect(x - w * .3 - 6, y - 21, 12, 21); g.fillStyle = '#1e1510'; g.fillRect(x - w * .3 - .5, y - 21, 1, 21); g.fillStyle = '#8a7a50'; g.fillRect(x - w * .3 + 3, y - 11, 2, 2);
    // Ventanas: encendidas de noche
    const vent = (vx, vy, vw, vh) => {
      const enc = noche && hz(vx | 0, vy | 0) > .25;
      g.fillStyle = viga; g.fillRect(vx - vw / 2 - 2, vy - 2, vw + 4, vh + 4);
      if (enc) { const gr = g.createLinearGradient(0, vy, 0, vy + vh); gr.addColorStop(0, '#ffd98a'); gr.addColorStop(1, '#e8862e'); g.fillStyle = gr; } else g.fillStyle = '#1a2230';
      g.fillRect(vx - vw / 2, vy, vw, vh);
      if (!enc) { g.fillStyle = 'rgba(160,190,220,.22)'; g.fillRect(vx - vw / 2, vy, vw / 2, vh / 2); }
      g.fillStyle = viga; g.fillRect(vx - .5, vy, 1, vh); g.fillRect(vx - vw / 2, vy + vh / 2 - .5, vw, 1);
      if (enc) { g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(halo('#ffb45a', 64), vx - 26, vy + vh / 2 - 26, 52, 52); g.restore(); }
    };
    vent(x + w * .12, y - 27, 12, 12); vent(x - w * .22, y - h1 - h2 + 11, 11, 13); vent(x + w * .2, y - h1 - h2 + 11, 11, 13);
  },
  valla(g, x, y, s, r) {
    const c = '#3a2c20';
    for (let i = -2; i <= 2; i++) { g.fillStyle = css(luzc(c, hz(x | 0, i) * .2 - .1)); g.fillRect(x + i * 14 - 2, y - 20 - hz(i, x | 0) * 4, 4, 22); }
    g.fillStyle = css(luzc(c, .08)); g.fillRect(x - 32, y - 16, 64, 3); g.fillRect(x - 32, y - 8, 64, 3);
  },
  barril(g, x, y, s, r) {
    const c = '#4a3626';
    sombraBase(g, x, y, 14);
    for (let i = 0; i < 2; i++) { const bx = x + i * 19 - 8, h = 22 - i * 4; g.fillStyle = volumen(g, bx - 8, bx + 8, c, .25); g.beginPath(); g.moveTo(bx - 7, y); g.quadraticCurveTo(bx - 10, y - h / 2, bx - 7, y - h); g.lineTo(bx + 7, y - h); g.quadraticCurveTo(bx + 10, y - h / 2, bx + 7, y); g.closePath(); g.fill(); g.fillStyle = '#1c1a1c'; g.fillRect(bx - 8, y - h * .78, 16, 2); g.fillRect(bx - 8, y - h * .28, 16, 2); }
  },
  antorcha(g, x, y) {
    g.fillStyle = volumen(g, x - 2, x + 2, '#3a2a1e', .25); g.fillRect(x - 2, y - 36, 4, 36);
    g.fillStyle = '#18161a'; g.beginPath(); g.moveTo(x - 6, y - 43); g.lineTo(x + 6, y - 43); g.lineTo(x + 3, y - 35); g.lineTo(x - 3, y - 35); g.closePath(); g.fill();
    g.fillRect(x - 5, y - 2, 10, 2);
  },
  // Pequeños (delante de la bruma del decorado, sobre el borde del suelo)
  mata(g, x, y, s, r, e) { g.strokeStyle = css(mez(e.mu, e.ho[1], .4)); g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 2.2; g.moveTo(x + a * .5, y); g.quadraticCurveTo(x + a, y - 5, x + a * 1.8, y - 6 - r() * 6); } g.stroke(); },
  helecho(g, x, y, s, r, e) { g.strokeStyle = css(e.ho[1]); g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = (i - 2) * 6, h = 10 + r() * 8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + a * .5, y - h, x + a * 1.4, y - h * .6); g.stroke(); } },
  flor(g, x, y, s, r, e) { const cs = ['#d8c8a0', e.arc, '#c98a8a']; for (let i = 0; i < 3; i++) { const fx = x + (i - 1) * 5 + r() * 2, h = 5 + r() * 5; g.fillStyle = css(e.mu); g.fillRect(fx, y - h, 1, h); g.fillStyle = css(mez(cs[(r() * 3) | 0], '#808080', .25)); g.fillRect(fx - 1, y - h - 2, 3, 2); } },
  seta(g, x, y, s, r, e) {
    const brillo = e.techo || e.arc === '#9d7bff' || e.arc === '#e8a0ff';
    for (let i = 0; i < 2; i++) { const sx = x + i * 7 - 3, h = 4 + r() * 5, w = 3 + r() * 2.5; g.fillStyle = '#c9c0a8'; g.fillRect(sx - 1, y - h, 2, h); if (brillo) { g.save(); g.shadowColor = e.arc; g.shadowBlur = 6; } g.fillStyle = css(brillo ? mez(e.arc, '#404060', .3) : '#8a4a3a'); g.beginPath(); g.ellipse(sx, y - h, w, w * .7, 0, Math.PI, TAU); g.fill(); if (brillo) g.restore(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(sx - 1, y - h - 2, 1, 1); }
  },
  piedra(g, x, y, s, r, e) { const c = mez(e.t, '#808088', .5), w = 3 + r() * 5; g.fillStyle = css(luzc(c, -.3)); g.beginPath(); g.ellipse(x, y, w, w * .55, 0, Math.PI, TAU); g.fill(); g.fillStyle = css(luzc(c, .15)); g.beginPath(); g.ellipse(x - 1, y - 1, w * .6, w * .32, 0, Math.PI, TAU); g.fill(); },
};
function sillares(g, x, y, w, h, r, e, rota) {
  const c = mez(e.t, '#74727a', .55), bw = 16, bh = 9, x0 = x - w / 2;
  sombraBase(g, x, y, w * .55);
  const cols = Math.ceil(w / bw), perfil = [];
  let ph = h * (.6 + r() * .4);
  for (let i = 0; i <= cols; i++) { if (rota) { ph += (r() - .45) * 22; ph = Math.max(h * .2, Math.min(h, ph)); } else ph = h; perfil.push(Math.round(ph / bh) * bh); }
  for (let fy = 0; fy * bh < h; fy++) for (let i = -1; i < cols; i++) {
    const bx = x0 + i * bw + (fy & 1) * bw / 2, by = y - (fy + 1) * bh;
    if (fy * bh >= perfil[Math.max(0, Math.min(cols, i + (fy & 1)))]) continue;
    const x1 = Math.max(x0, bx), x2 = Math.min(x0 + w, bx + bw);
    if (x2 - x1 < 2) continue;
    const k = hz(bx | 0, by | 0);
    g.fillStyle = css(luzc(c, k * .34 - .22)); g.fillRect(x1, by, x2 - x1, bh);
    g.fillStyle = css(luzc(c, -.55), .8); g.fillRect(x1, by + bh - 1, x2 - x1, 1); g.fillRect(x2 - 1, by, 1, bh);
    g.fillStyle = css(luzc(c, .3), .35); g.fillRect(x1, by, x2 - x1 - 1, 1);
    if (k > .86) { g.fillStyle = css(e.nevado ? '#e6ebf2' : e.mu, .8); g.fillRect(x1, by, x2 - x1, 3); }
  }
  // Lado en sombra
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + w * .2, y - h, w * .3, h);
  if (rota && r() > .4) { g.fillStyle = '#07070c'; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 9, y - 18); g.quadraticCurveTo(x, y - 30, x + 9, y - 18); g.lineTo(x + 9, y); g.closePath(); g.fill(); }
}
const ANCHO_PIEZA = { casa: 90, muro: 100, ruina: 80, roble: 70, selva: 80, pino: 50, seco: 60, roca: 70, menhir: 40, columna: 30, pilar: 40, estandarte: 40, estalagmita: 40, cristal: 40, alga: 40, valla: 40, barril: 30, antorcha: 12 };

// ── Decorado de un mapa: lista fija (misma en todos los clientes) ──
function decorDe(mp, id, e) {
  const r = rng(semilla('deco' + id)), L = [], ant = [];
  for (let x = -260 + r() * 60; x < mp.ancho + 260; x += e.hueco * (.55 + r() * .9)) {
    const t = e.g[(r() * e.g.length) | 0];
    L.push({ t, x: Math.round(x), s: .8 + r() * .45, sem: (r() * 1e9) | 0, a: ANCHO_PIEZA[t] || 60 });
  }
  if (e.ant) for (let x = 140 + r() * 80; x < mp.ancho - 60; x += e.ant * (.8 + r() * .4)) {
    const ax = Math.round(x);
    if (mp.portales && mp.portales.some(p => Math.abs(p.x - ax) < 46)) continue;
    L.push({ t: 'antorcha', x: ax, s: 1, sem: 1, a: 12 }); ant.push(ax);
  }
  const P = [];
  for (let x = -260; x < mp.ancho + 260; x += 12 + r() * 30) P.push({ t: e.p[(r() * e.p.length) | 0], x: Math.round(x), s: 1, sem: (r() * 1e9) | 0, a: 16 });
  return { g: L, p: P, ant };
}

// ── Suelo de un trozo (coordenadas del mundo para que case con el vecino) ──
function pintarSuelo(g, e, x0, y0, H) {
  const h = H - y0;
  const pat = g.createPattern(tierra(e.t), 'repeat');
  g.save(); g.translate(-(((x0 % 128) + 128) % 128), y0); g.fillStyle = pat; g.fillRect(0, 0, TROZO + 128, h); g.restore();
  const c = rgb(e.t);
  if (e.su === 'adoquin' || e.su === 'losa') {
    const bw = e.su === 'losa' ? 40 : 16, bh = e.su === 'losa' ? 16 : 9;
    for (let fy = 0; fy * bh < h; fy++) {
      const off = (fy & 1) * bw / 2, i0 = Math.floor((x0 - off) / bw);
      for (let i = i0; i * bw + off < x0 + TROZO; i++) {
        const bx = i * bw + off - x0, by = y0 + 3 + fy * bh, k = hz(i, fy + 31);
        g.fillStyle = css(luzc(c, k * .36 - .1), .92);
        if (e.su === 'losa') g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        else { g.beginPath(); g.ellipse(bx + bw / 2, by + bh / 2, bw / 2 - 1, bh / 2 - 1, 0, 0, TAU); g.fill(); }
        g.fillStyle = css(luzc(c, .4), .28); g.fillRect(bx + 3, by + 1, bw - 7, 1);
        if (e.su === 'losa' && k > .8) { g.strokeStyle = css(luzc(c, -.6), .7); g.lineWidth = 1; g.beginPath(); g.moveTo(bx + 6, by + 2); g.lineTo(bx + 14, by + 8); g.lineTo(bx + 12, by + 13); g.stroke(); }
        if (k < .1) { g.fillStyle = css(e.mu, .6); g.fillRect(bx + 1, by + bh - 3, bw - 2, 2); }
      }
    }
  } else {
    // Camino de tierra apisonada arriba, guijarros y surcos.
    g.fillStyle = css(luzc(c, e.su === 'nieve' ? .35 : .22), e.su === 'nieve' ? .7 : .3); g.fillRect(0, y0 + 2, TROZO, e.su === 'nieve' ? 9 : 11);
    const i0 = Math.floor(x0 / 9);
    for (let i = i0; i * 9 < x0 + TROZO + 9; i++) for (let f = 0; f < 5; f++) {
      const k = hz(i, f + 7), bx = i * 9 - x0 + hz(i, f) * 7, by = y0 + 6 + f * 9 + hz(f, i) * 5;
      if (k < .13) { const w = 2 + k * 30; g.fillStyle = css(luzc(c, -.35), .8); g.beginPath(); g.ellipse(bx, by + 1, w, w * .5, 0, 0, TAU); g.fill(); g.fillStyle = css(mez(luzc(c, .3), '#8a8a8a', .4), .9); g.beginPath(); g.ellipse(bx - .5, by, w * .8, w * .4, 0, 0, TAU); g.fill(); }
      else if (k > .9) { g.fillStyle = css(luzc(c, e.su === 'arena' || e.su === 'nieve' ? .3 : -.4), .5); g.fillRect(bx, by, 6 + k * 8, 1); }
    }
  }
  // Oscurece hacia abajo (profundidad) y borde superior irregular.
  const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = gr; g.fillRect(0, y0, TROZO, h);
  const piedra = e.su === 'adoquin' || e.su === 'losa';
  const borde = piedra ? luzc(c, .32) : rgb(e.mu), osc = css(luzc(borde, -.45)), cla = css(luzc(borde, .22));
  for (let px = 0; px < TROZO; px += 2) {
    const wx = (x0 + px) >> 1, k = hz(wx, 99), alto = piedra ? 2 : 2 + ((k * 3.2) | 0);
    g.fillStyle = osc; g.fillRect(px, y0, 2, alto + 1);
    g.fillStyle = css(borde); g.fillRect(px, y0 - (piedra ? 0 : (k > .7 ? 1 : 0)), 2, alto);
    if (k > .45) { g.fillStyle = cla; g.fillRect(px, y0 - (piedra ? 0 : (k > .7 ? 1 : 0)), 2, 1); }
    if (piedra && hz(wx >> 3, 5) > .72) { g.fillStyle = css(e.mu, .85); g.fillRect(px, y0, 2, 2 + ((k * 2) | 0)); }
  }
}
function pintarPlataforma(g, e, x, y, w) {
  const c = mez(e.t, '#77757c', .55), bw = 20;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 3, y + 4, w, 14);
  for (let bx = 0; bx < w; bx += bw) {
    const an = Math.min(bw, w - bx), k = hz((x + bx) | 0, y | 0);
    g.fillStyle = css(luzc(c, k * .3 - .25)); g.fillRect(x + bx, y, an, 14);
    g.fillStyle = css(luzc(c, -.6), .85); g.fillRect(x + bx + an - 1, y + 3, 1, 11);
  }
  g.fillStyle = css(luzc(c, -.6), .8); g.fillRect(x, y + 12, w, 2);
  // Canto superior claro: es por donde se lee la plataforma en el combate.
  const canto = e.nevado ? rgb('#e6ebf2') : mez(e.mu, '#d8d2b8', .45);
  g.fillStyle = css(canto); g.fillRect(x, y, w, 3);
  g.fillStyle = css(luzc(canto, .35)); g.fillRect(x, y, w, 1);
  for (let bx = 2; bx < w - 2; bx += 5) { const k = hz((x + bx) | 0, 13); if (k > .55) { g.fillStyle = css(luzc(e.mu, -.2), .9); g.fillRect(x + bx, y + 14, 1, 2 + ((k * 9) | 0)); } }
}

// ── Capas lejanas (mosaico de 1024 px que casa consigo mismo) ──
function cresta(g, W, H, yb, amp, r, col, bruma, dentado) {
  const k1 = 1 + ((r() * 2) | 0), k2 = 3 + ((r() * 3) | 0), k3 = 7 + ((r() * 5) | 0), k4 = 17 + ((r() * 9) | 0), p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU, p4 = r() * TAU;
  const f = x => { const a = x / W * TAU; let v = .5 * Math.sin(a * k1 + p1) + .3 * Math.sin(a * k2 + p2) + .2 * Math.abs(Math.sin(a * k3 + p3)) * 2 - .2; if (dentado) v += dentado * Math.abs(Math.sin(a * k4 + p4)); return yb - amp * (v + .6); };
  const gr = g.createLinearGradient(0, yb - amp * 1.6, 0, H); gr.addColorStop(0, css(col)); gr.addColorStop(.75, css(mez(col, bruma, .5))); gr.addColorStop(1, css(mez(col, bruma, .75)));
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, f(x));
  g.lineTo(W, H); g.closePath(); g.fill();
  return f;
}
function capaLejos(e, id) {
  const W = CAPA_W, H = 320, c = lienzo(W, H), g = c.getContext('2d'), r = rng(semilla('lejos' + id));
  if (e.lejos === 'cueva') {
    // Pared de roca con columnas naturales y vetas.
    for (let i = 0; i < 9; i++) { const x = r() * W, w = 40 + r() * 80, col = mez(e.lj, e.br, .08 + r() * .12); for (const dx of [0, -W]) { const gr = g.createLinearGradient(x + dx, 0, x + dx + w, 0); gr.addColorStop(0, css(col, 0)); gr.addColorStop(.4, css(col, .9)); gr.addColorStop(1, css(luzc(col, -.4), 0)); g.fillStyle = gr; g.fillRect(x + dx, 0, w, H); } }
    for (let i = 0; i < 16; i++) { const x = r() * W, h = 40 + r() * 120, w = 12 + r() * 22; g.fillStyle = css(mez(e.lj, e.br, .1)); for (const dx of [0, -W]) { g.beginPath(); g.moveTo(x + dx - w, H); g.quadraticCurveTo(x + dx, H - h * .5, x + dx, H - h); g.quadraticCurveTo(x + dx + w * .3, H - h * .5, x + dx + w, H); g.fill(); } }
  } else {
    const dent = e.lejos === 'dunas' ? 0 : .28;
    cresta(g, W, H, 190, e.lejos === 'dunas' ? 34 : 86, r, mez(e.lj, e.br, .42), e.br, dent);
    const f = cresta(g, W, H, 250, e.lejos === 'dunas' ? 30 : 62, r, mez(e.lj, e.br, .16), e.br, dent * .7);
    const col = css(luzc(e.lj, -.15));
    if (e.hito === 'castillo') {
      const x = 560, y = f(x + 40) + 6; g.fillStyle = col;
      const torre = (tx, w, h, cono) => { g.fillRect(tx, y - h, w, h + 30); for (let a = 0; a < w; a += 5) g.fillRect(tx + a, y - h - 3, 3, 3); if (cono) { g.beginPath(); g.moveTo(tx - 2, y - h - 2); g.lineTo(tx + w / 2, y - h - 2 - w * 1.4); g.lineTo(tx + w + 2, y - h - 2); g.fill(); } };
      torre(x, 16, 64, 1); torre(x + 16, 46, 34, 0); torre(x + 30, 20, 84, 1); torre(x + 62, 14, 54, 1); torre(x + 76, 30, 26, 0); torre(x - 26, 26, 22, 0);
      g.fillStyle = '#ffb45a'; for (const [vx, vy] of [[6, 44], [38, 66], [40, 50], [67, 38], [24, 20], [84, 14]]) { g.globalAlpha = .55 + r() * .4; g.fillRect(x + vx, y - vy, 2, 3); } g.globalAlpha = 1;
    } else if (e.hito === 'torres') {
      for (const x of [230, 700]) { const y = f(x) + 4, h = 46 + r() * 30; g.fillStyle = col; g.fillRect(x, y - h, 14, h + 20); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 3, y - h - 8); g.lineTo(x + 8, y - h - 2); g.lineTo(x + 14, y - h - 6); g.lineTo(x + 14, y - h); g.fill(); g.fillStyle = css(e.arc, .7); g.fillRect(x + 6, y - h + 12, 2, 3); }
    } else if (e.hito === 'menhires') {
      for (let i = 0; i < 7; i++) { const x = 380 + i * 22 + r() * 8, y = f(x) + 4, h = 20 + r() * 26; g.fillStyle = col; g.beginPath(); g.moveTo(x - 5, y + 8); g.lineTo(x - 4, y - h); g.lineTo(x + 3, y - h - 3); g.lineTo(x + 6, y + 8); g.fill(); if (i % 2 === 0) { g.fillStyle = css(e.arc, .75); g.fillRect(x, y - h * .6, 1, 4); } }
    }
  }
  return c;
}
function capaCerca(e, id) {
  const W = CAPA_W, H = 250, c = lienzo(W, H), g = c.getContext('2d'), r = rng(semilla('cerca' + id));
  const doble = fn => { for (const dx of [0, -W, W]) { g.save(); g.translate(dx, 0); fn(); g.restore(); } };
  for (let fila = 0; fila < 2; fila++) {
    const col = mez(e.cr, e.br, fila ? .06 : .26), n = e.cerca === 'aldea' ? 9 : e.cerca === 'muralla' ? 6 : 26, base = H + 4;
    const items = []; for (let i = 0; i < n; i++) items.push([(i + r()) * W / n, r(), r(), r()]);
    g.fillStyle = css(col);
    for (const [x, a, b, d] of items) doble(() => {
      if (e.cerca === 'bosque' || (e.cerca === 'aldea' && a > .6) || (e.cerca === 'ruinas' && a > .8)) {
        const h = 110 + a * 90 - fila * 20, w = 5 + b * 4; g.fillRect(x - w / 2, base - h * .7, w, h * .7);
        for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.9 + d * 6) * 22, base - h * .78 + Math.sin(k * 2.3 + d * 4) * 16, 18 + ((k * 7 + d * 9) % 12), 0, TAU); g.fill(); }
      } else if (e.cerca === 'pinos') {
        const h = 110 + a * 100 - fila * 20, w = 20 + b * 12; for (let k = 0; k < 5; k++) { const yy = base - h * (.1 + k * .18); g.beginPath(); g.moveTo(x, yy - h * .3); g.lineTo(x + w * (1 - k * .16), yy); g.lineTo(x - w * (1 - k * .16), yy); g.fill(); }
      } else if (e.cerca === 'riscos') {
        const h = 50 + a * 110, w = 26 + b * 40; g.beginPath(); g.moveTo(x - w, base); g.lineTo(x - w * .7, base - h * .6); g.lineTo(x - w * .2, base - h); g.lineTo(x + w * .2, base - h * .85); g.lineTo(x + w * .5, base - h * .4); g.lineTo(x + w, base); g.fill();
        if (d > .7) { g.fillRect(x - 1.5, base - h - 34, 3, 40); g.fillRect(x - 12, base - h - 22, 12, 2); g.fillRect(x, base - h - 28, 12, 2); }
      } else if (e.cerca === 'ruinas') {
        const h = 50 + a * 80; g.fillRect(x - 6, base - h, 12, h); g.fillRect(x - 9, base - h - 4, 18, 5); if (b > .5) { g.fillRect(x + 40, base - h * .8, 12, h); g.fillRect(x - 6, base - h - 9, 60, 7); }
      } else if (e.cerca === 'cueva') {
        const h = 40 + a * 130, w = 14 + b * 26; g.beginPath(); g.moveTo(x - w, base); g.quadraticCurveTo(x - w * .2, base - h * .5, x, base - h); g.quadraticCurveTo(x + w * .3, base - h * .5, x + w, base); g.fill();
        if (d > .75) { g.fillStyle = css(e.arc, .5); g.fillRect(x - 1, base - h * .5, 2, 5); g.fillStyle = css(col); }
      } else if (e.cerca === 'algas') {
        if (a > .7) { const h = 60 + b * 90; g.fillRect(x - 7, base - h, 14, h); g.fillRect(x - 10, base - h - 4, 20, 5); }
        else { g.strokeStyle = css(col); g.lineWidth = 4; g.beginPath(); const h = 70 + b * 110; g.moveTo(x, base); g.bezierCurveTo(x + 14, base - h * .3, x - 14, base - h * .7, x + 8, base - h); g.stroke(); }
      } else if (e.cerca === 'muralla') {
        const h = 90 + a * 70 - fila * 10, w = W / n + 4; g.fillRect(x, base - h, w, h); for (let k = 0; k < w; k += 16) g.fillRect(x + k, base - h - 9, 10, 9);
        if (b > .45) { const tw = 34; g.fillRect(x + 20, base - h - 50, tw, 60); for (let k = 0; k < tw; k += 10) g.fillRect(x + 20 + k, base - h - 58, 6, 8); g.fillStyle = css('#ffb45a', .75); g.fillRect(x + 35, base - h - 30, 3, 8); g.fillStyle = css(col); }
        g.fillStyle = css(luzc(col, -.4)); g.fillRect(x + w * .6, base - h * .6, 3, 12); g.fillStyle = css(col);
      } else if (e.cerca === 'aldea') {
        const w = 60 + a * 40, h = 50 + b * 30; g.fillRect(x - w / 2, base - h, w, h); g.beginPath(); g.moveTo(x - w / 2 - 6, base - h); g.lineTo(x, base - h - 36 - d * 14); g.lineTo(x + w / 2 + 6, base - h); g.fill(); g.fillRect(x + w * .2, base - h - 34, 7, 20);
        g.fillStyle = css('#ffb45a', .6); g.fillRect(x - w * .2, base - h + 14, 4, 5); if (d > .5) g.fillRect(x + w * .15, base - h + 30, 4, 5); g.fillStyle = css(col);
      }
    });
    // Bruma entre las dos filas y en la base
    const gr = g.createLinearGradient(0, H - 150, 0, H); gr.addColorStop(0, css(e.br, 0)); gr.addColorStop(1, css(e.br, fila ? .34 : .3));
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, H - 150, W, 150); g.globalCompositeOperation = 'source-over';
  }
  return c;
}
function capaNiebla(e) {
  const W = CAPA_W, H = 72, c = lienzo(W, H), g = c.getContext('2d'), r = rng(semilla('niebla' + e.br));
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = 30 + r() * 34, rx = 70 + r() * 120, ry = 10 + r() * 16, a = .05 + r() * .09;
    for (const dx of [0, -W, W]) { g.save(); g.translate(x + dx, y); g.scale(rx / 32, ry / 32); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32); gr.addColorStop(0, css(e.br, a)); gr.addColorStop(1, css(e.br, 0)); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); g.restore(); }
  }
  return c;
}

// ── Estado en caché del mapa actual ──
let M = null;   // { id, e, deco, T, trozos: Map, lejos, cerca, niebla, cielo, cieloK, velo, veloK }
function mapa(v) {
  if (M && M.id === v.id) return M;
  const e = estiloDe(v.mp);
  let T = v.SUELO - 215;
  for (const p of v.mp.plataformas || []) T = Math.min(T, p[1] - 12);
  T = Math.max(0, Math.floor(T));
  M = { id: v.id, e, deco: decorDe(v.mp, v.id, e), T, trozos: new Map(), lejos: capaLejos(e, v.id), cerca: capaCerca(e, v.id), niebla: capaNiebla(e), cielo: null, cieloK: '', velo: null, veloK: '', uso: 0 };
  return M;
}
function cielo(m, v, n) {
  const k = v.VW + '|' + v.OY + '|' + n;
  if (m.cieloK === k) return m.cielo;
  const e = m.e, W = v.VW, H = v.VH + v.OY, c = m.cielo && m.cielo.width === W && m.cielo.height === H ? m.cielo : lienzo(W, H), g = c.getContext('2d'), r = rng(semilla('cielo' + m.id));
  const osc = x => css(mez(x, '#04050c', .55 * n));
  const hor = v.SUELO + v.OY;
  const gr = g.createLinearGradient(0, 0, 0, hor); gr.addColorStop(0, osc(e.c[0])); gr.addColorStop(.55, osc(e.c[1])); gr.addColorStop(1, osc(e.c[2]));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (!e.techo) {
    const est = Math.min(1, n * .9 + (e.estrellas || 0));
    if (est > .05) for (let i = 0; i < 110; i++) { const x = r() * W, y = r() * hor * .75, t = r(); g.fillStyle = `rgba(${220 + t * 35 | 0},${225 + t * 20 | 0},255,${(.25 + t * .6) * est * (1 - y / hor)})`; g.fillRect(x | 0, y | 0, t > .9 ? 2 : 1, t > .9 ? 2 : 1); }
    // Luna de noche; de día, resplandor bajo del sol tras la cordillera.
    const lx = W * .74, ly = Math.max(46, hor * .2);
    if (n > .35) {
      const h = g.createRadialGradient(lx, ly, 4, lx, ly, 90); h.addColorStop(0, `rgba(200,215,255,${.35 * n})`); h.addColorStop(1, 'rgba(200,215,255,0)'); g.fillStyle = h; g.fillRect(lx - 90, ly - 90, 180, 180);
      g.fillStyle = `rgba(232,236,250,${.5 + .5 * n})`; g.beginPath(); g.arc(lx, ly, 15, 0, TAU); g.fill();
      g.fillStyle = 'rgba(150,160,190,.5)'; g.beginPath(); g.arc(lx - 4, ly - 3, 3.5, 0, TAU); g.arc(lx + 5, ly + 4, 2.5, 0, TAU); g.arc(lx + 3, ly - 6, 1.5, 0, TAU); g.fill();
    } else {
      const sx = W * .3, sy = hor - 110, h = g.createRadialGradient(sx, sy, 6, sx, sy, 230); h.addColorStop(0, css(mez(e.c[2], '#ffe2b0', .6), .5 * (1 - n))); h.addColorStop(1, css(e.c[2], 0)); g.fillStyle = h; g.fillRect(sx - 230, sy - 230, 460, 460);
    }
    // Nubes deshilachadas
    for (let i = 0; i < 9; i++) { const x = r() * W, y = hor * (.12 + r() * .5), rx = 60 + r() * 130, ry = 7 + r() * 13, a = (.07 + r() * .1) * (1 - n * .4); g.save(); g.translate(x, y); g.scale(rx / 32, ry / 32); const h = g.createRadialGradient(0, 0, 0, 0, 0, 32); h.addColorStop(0, css(mez(e.br, e.c[2], .3), a)); h.addColorStop(1, css(e.br, 0)); g.fillStyle = h; g.fillRect(-32, -32, 64, 64); g.restore(); }
  } else {
    // Bajo techo: vetas de roca y penumbra arriba.
    for (let i = 0; i < 14; i++) { g.fillStyle = css(luzc(e.c[1], r() * .2 - .1), .5); g.fillRect(0, r() * hor, W, 2 + r() * 10); }
    const h = g.createLinearGradient(0, 0, 0, 120); h.addColorStop(0, 'rgba(0,0,0,.6)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, W, 120);
  }
  m.cielo = c; m.cieloK = k;
  return c;
}
function velo(m, v, n) {
  const k = v.VW + '|' + v.OY + '|' + n;
  if (m.veloK === k) return m.velo;
  const W = v.VW, H = v.VH + v.OY, c = m.velo && m.velo.width === W && m.velo.height === H ? m.velo : lienzo(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  if (n > 0) { g.fillStyle = `rgba(7,10,30,${.4 * n})`; g.fillRect(0, 0, W, H); }
  const R = Math.hypot(W, H) / 2, gr = g.createRadialGradient(W / 2, H * .56, R * .45, W / 2, H * .56, R * 1.02);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,6,.5)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  m.velo = c; m.veloK = k;
  return c;
}
function trozo(m, v, i, esNoche) {
  const k = i * 2 + (esNoche ? 1 : 0);
  let t = m.trozos.get(k);
  if (t) { t.uso = ++m.uso; return t.c; }
  // Recicla el lienzo menos usado en vez de crear otro.
  let c = null;
  if (m.trozos.size >= MAX_TROZOS) { let vk = null, vu = Infinity; for (const [kk, tt] of m.trozos) if (tt.uso < vu) { vu = tt.uso; vk = kk; } c = m.trozos.get(vk).c; m.trozos.delete(vk); }
  const e = m.e, H = v.VH - m.T, x0 = i * TROZO, y0 = v.SUELO - m.T;
  if (!c) c = lienzo(TROZO, H);
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TROZO, H);
  const pinta = o => { if (o.x + o.a < x0 - 30 || o.x - o.a > x0 + TROZO + 30) return; const f = PIEZAS[o.t]; if (f) { g.save(); f(g, o.x - x0, y0 + 1, o.s, rng(o.sem), e, esNoche); g.restore(); } };
  for (const o of m.deco.g) pinta(o);
  // Grano y bruma sobre el decorado: queda detrás, y los personajes resaltan.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = g.createPattern(grano(), 'repeat'); g.fillRect(0, 0, TROZO, y0 + 2);
  const br = g.createLinearGradient(0, y0 - 150, 0, y0); br.addColorStop(0, css(e.br, .1)); br.addColorStop(1, css(e.br, .3));
  g.fillStyle = br; g.fillRect(0, 0, TROZO, y0 + 2);
  g.globalCompositeOperation = 'source-over';
  pintarSuelo(g, e, x0, y0, H);
  for (const o of m.deco.p) pinta(o);
  for (const p of v.mp.plataformas || []) { if (p[0] + p[2] + 6 < x0 || p[0] > x0 + TROZO) continue; pintarPlataforma(g, e, p[0] - x0, p[1] - m.T, p[2]); }
  m.trozos.set(k, { c, uso: ++m.uso });
  return c;
}

// ── Lo que llama el cliente, en este orden, antes de dibujar a nadie ──
// v = { g, mp, id, camX, VW, VH, OY, SUELO, frame, ligero }
export function fondoCielo(v) {
  const m = mapa(v), g = v.g, n = nocheAhora();
  g.drawImage(cielo(m, v, n), 0, -v.OY);
  let x = -Math.floor((((v.camX * .22) % CAPA_W) + CAPA_W) % CAPA_W);
  const yl = v.SUELO + 6 - m.lejos.height;
  g.drawImage(m.lejos, x, yl); if (x + CAPA_W < v.VW) g.drawImage(m.lejos, x + CAPA_W, yl);
  x = -Math.floor((((v.camX * .5) % CAPA_W) + CAPA_W) % CAPA_W);
  const yc = v.SUELO + 4 - m.cerca.height;
  g.drawImage(m.cerca, x, yc); if (x + CAPA_W < v.VW) g.drawImage(m.cerca, x + CAPA_W, yc);
}
export function fondoMundo(v) {
  const m = mapa(v), g = v.g, n = nocheAhora(), esNoche = n >= .6;
  const cx = Math.floor(v.camX), i0 = Math.floor(cx / TROZO), i1 = Math.floor((cx + v.VW - 1) / TROZO);
  for (let i = i0; i <= i1; i++) g.drawImage(trozo(m, v, i, esNoche), i * TROZO - cx, m.T);
  // Niebla baja que deriva despacio (detrás de los personajes).
  if (!v.ligero) {
    let x = -Math.floor((((v.camX + v.frame * .22) % CAPA_W) + CAPA_W) % CAPA_W);
    const y = v.SUELO - 50;
    g.drawImage(m.niebla, x, y); if (x + CAPA_W < v.VW) g.drawImage(m.niebla, x + CAPA_W, y);
  }
  // Velo de noche y viñeta, en una sola copia.
  g.drawImage(velo(m, v, n), 0, -v.OY);
  // Antorchas: llama y halo cálido (más fuerte de noche).
  const A = m.deco.ant;
  if (A.length) {
    const L = llamas(), h = halo('#ffb45a', 128), fuerza = .38 + .5 * n;
    for (let i = 0; i < A.length; i++) {
      const sx = A[i] - cx;
      if (sx < -70 || sx > v.VW + 70) continue;
      const f = v.frame + i * 13, par = .82 + .18 * Math.sin(f * .31) * Math.sin(f * .17 + i);
      if (!v.ligero) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = fuerza * par; g.drawImage(h, sx - 64, v.SUELO - 110); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      g.drawImage(L[(f >> 2) % 3], sx - 6, v.SUELO - 59);
    }
  }
}
// Color de la hierba viva (la que se aparta al pasar) acorde al bioma.
export function fondoTono(mp) { const e = estiloDe(mp); return e._tono || (e._tono = css(mez(e.mu, e.ho[1], .5))); }
// Estanque de pesca: orilla de piedras, agua oscura y brillo que se mueve.
let _estanque = null;
export function fondoEstanque(g, x, y, frame) {
  if (!_estanque) {
    const c = _estanque = lienzo(112, 26), q = c.getContext('2d');
    q.fillStyle = 'rgba(0,0,0,.35)'; q.beginPath(); q.ellipse(56, 14, 55, 11, 0, 0, TAU); q.fill();
    q.fillStyle = '#4a4640'; q.beginPath(); q.ellipse(56, 13, 53, 10, 0, 0, TAU); q.fill();
    const gr = q.createLinearGradient(0, 4, 0, 22); gr.addColorStop(0, '#16303a'); gr.addColorStop(.5, '#1f4a58'); gr.addColorStop(1, '#0c1c26');
    q.fillStyle = gr; q.beginPath(); q.ellipse(56, 13, 47, 7.5, 0, 0, TAU); q.fill();
    q.fillStyle = 'rgba(190,220,235,.28)'; q.beginPath(); q.ellipse(44, 10.5, 26, 2, 0, 0, TAU); q.fill();
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU, k = hz(i, 5), px = 56 + Math.cos(a) * 50, py = 13 + Math.sin(a) * 9; q.fillStyle = css(luzc('#6a665e', k * .4 - .25)); q.beginPath(); q.ellipse(px, py, 3 + k * 3, 2 + k * 1.5, 0, 0, TAU); q.fill(); q.fillStyle = 'rgba(255,255,255,.16)'; q.fillRect(px - 2, py - 2, 3, 1); }
    q.fillStyle = '#42603a'; for (let i = 0; i < 6; i++) q.fillRect(8 + i * 19, 4 + hz(i, 9) * 3, 2, 3);
  }
  g.drawImage(_estanque, Math.round(x - 56), y - 15);
  g.fillStyle = 'rgba(210,235,245,.5)';
  const d = (frame * .25) % 30;
  g.fillRect(Math.round(x - 30 + d), y - 3, 9, 1); g.fillRect(Math.round(x + 16 - d * .6), y - 1, 6, 1);
}
