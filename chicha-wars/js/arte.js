// ═══════════════════════════════════════════════════════
// CHICHA WARS — arte vectorial provisional (canvas 2D)
// Cada figura se dibuja con trazos, degradados y contorno de dibujo animado.
// Cuando lleguen las imagenes del dueño (assets/chicha-wars/sprites.json),
// spr() las usa en lugar de estos dibujos sin cambiar el juego.
// Origen de cada figura: los pies (x, y). s = escala.
// ═══════════════════════════════════════════════════════
import * as R from './rig.js?v=389';
const TINTA = '#2a1712';
const PI = Math.PI;

// ── Sprites del dueño (si existen) ──
const SPR = new Map();
export async function cargarSprites(base) {
  try {
    const r = await fetch(base + 'sprites.json', { cache: 'no-cache' });
    if (!r.ok) return 0;
    const l = await r.json();
    await Promise.all(Object.entries(l).map(([k, v]) => new Promise(ok => { const im = new Image(); im.onload = () => { SPR.set(k, { im, ...v }); ok(); }; im.onerror = ok; im.src = base + v.src; })));
  } catch (e) {}
  return SPR.size;
}
// Dibuja el sprite k con los pies en (x, y) y alto h; false si no existe.
export const tieneSpr = k => SPR.has(k);
export const img = k => { const s = SPR.get(k); return s ? s.im : null; };
export function spr(x, k, px, py, h, voltear) {
  const s = SPR.get(k); if (!s) return false;
  const w = h * s.im.width / s.im.height;
  x.save(); x.translate(px, py); if (voltear) x.scale(-1, 1);
  x.drawImage(s.im, -w * (s.ox ?? 0.5), -h * (s.oy ?? 1), w, h); x.restore();
  return true;
}

function trazo(x, fill, lw = 3) {
  if (fill) { x.fillStyle = fill; x.fill(); }
  x.lineWidth = lw; x.strokeStyle = TINTA; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke();
}
function elipse(x, cx, cy, rx, ry, fill, lw) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, PI * 2); trazo(x, fill, lw); }
function rr(x, a, b, w, h, r) { x.beginPath(); x.roundRect(a, b, w, h, r); }
function sombra(x, cx, cy, rx) { x.save(); x.globalAlpha = 0.22; x.fillStyle = '#000'; x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.28, 0, 0, PI * 2); x.fill(); x.restore(); }
function aclarar(hex, k) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
function grad(x, y0, y1, c) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, aclarar(c, 0.18)); g.addColorStop(1, aclarar(c, -0.22)); return g; }

// Cara de persona: ojos grandes con brillo, cejas, mejillas y boca segun el gesto.
function cara(x, cx, cy, r, gesto, t) {
  const parpadeo = (t % 4.2) < 0.12;
  for (const lado of [-1, 1]) {
    const ex = cx + lado * r * 0.36, ey = cy - r * 0.02;
    if (parpadeo || gesto === 'feliz') { x.beginPath(); x.arc(ex, ey + 2, r * 0.13, PI * 1.1, PI * 1.9); x.lineWidth = 3; x.strokeStyle = TINTA; x.stroke(); }
    else {
      elipse(x, ex, ey, r * 0.16, r * 0.2, '#fff', 2);
      x.beginPath(); x.arc(ex + r * 0.04, ey + r * 0.03, r * 0.11, 0, PI * 2); x.fillStyle = '#3b2314'; x.fill();
      x.beginPath(); x.arc(ex + r * 0.08, ey - r * 0.03, r * 0.04, 0, PI * 2); x.fillStyle = '#fff'; x.fill();
    }
    // ceja
    x.beginPath(); const ang = gesto === 'enojo' ? lado * 0.35 : gesto === 'susto' ? -lado * 0.3 : 0;
    x.moveTo(ex - r * 0.17, ey - r * 0.3 + Math.sin(ang) * r * 0.12 * lado); x.lineTo(ex + r * 0.17, ey - r * 0.3 - Math.sin(ang) * r * 0.12 * lado);
    x.lineWidth = 3.5; x.strokeStyle = '#2b1a10'; x.stroke();
    // mejilla
    x.save(); x.globalAlpha = 0.45; x.fillStyle = '#ff6f7d'; x.beginPath(); x.ellipse(cx + lado * r * 0.55, cy + r * 0.3, r * 0.16, r * 0.1, 0, 0, PI * 2); x.fill(); x.restore();
  }
  x.beginPath();
  if (gesto === 'susto') { x.ellipse(cx, cy + r * 0.45, r * 0.13, r * 0.17, 0, 0, PI * 2); x.fillStyle = '#5a1620'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = TINTA; x.stroke(); }
  else if (gesto === 'enojo') { x.moveTo(cx - r * 0.25, cy + r * 0.48); x.quadraticCurveTo(cx, cy + r * 0.36, cx + r * 0.25, cy + r * 0.48); x.lineWidth = 3; x.strokeStyle = TINTA; x.stroke(); }
  else { x.moveTo(cx - r * 0.3, cy + r * 0.36); x.quadraticCurveTo(cx, cy + r * 0.72, cx + r * 0.3, cy + r * 0.36); x.closePath(); x.fillStyle = '#7a1f2b'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = TINTA; x.stroke();
    x.beginPath(); x.moveTo(cx - r * 0.22, cy + r * 0.4); x.lineTo(cx + r * 0.22, cy + r * 0.4); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); }
}

// Cucharon de palo en la mano (angulo a).
function cucharon(x, hx, hy, a, s) {
  x.save(); x.translate(hx, hy); x.rotate(a);
  rr(x, -3 * s, -4 * s, 6 * s, 62 * s, 3 * s); trazo(x, '#a8743f', 2.5);
  elipse(x, 0, 60 * s, 9 * s, 6 * s, '#8b5a2b', 2.5);
  x.restore();
}
function vaso(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx - 9 * s, cy - 22 * s); x.lineTo(cx + 9 * s, cy - 22 * s); x.lineTo(cx + 7 * s, cy); x.lineTo(cx - 7 * s, cy); x.closePath(); trazo(x, 'rgba(255,255,255,.55)', 2.5);
  x.beginPath(); x.moveTo(cx - 8 * s, cy - 15 * s); x.lineTo(cx + 8 * s, cy - 15 * s); x.lineTo(cx + 7 * s, cy - 1 * s); x.lineTo(cx - 7 * s, cy - 1 * s); x.closePath(); x.fillStyle = '#6d1b4d'; x.fill();
  x.save(); x.globalAlpha = 0.5; x.fillStyle = '#c04a8f'; x.fillRect(cx - 6 * s, cy - 14 * s, 3 * s, 11 * s); x.restore();
}
export { vaso as dibujarVaso };

// Brazo: del hombro (sx, sy) con angulo a y largo l; devuelve la mano.
function brazo(x, sx, sy, a, l, manga, piel, s) {
  const hx = sx + Math.sin(a) * l, hy = sy + Math.cos(a) * l;
  x.beginPath(); x.moveTo(sx, sy); x.lineTo(hx, hy); x.lineWidth = 15 * s; x.strokeStyle = TINTA; x.lineCap = 'round'; x.stroke();
  x.lineWidth = 11 * s; x.strokeStyle = manga; x.stroke();
  elipse(x, hx, hy, 7.5 * s, 7.5 * s, piel, 2.5);
  return [hx, hy];
}

// ── CHICHERA ──
// pose: quieta | remueve | espanta | celebra | susto
export function chichera(x, px, py, s, pose, t, P) {
  if (SPR.has('chichera_maestra')) { personaAnimada(x, 'chichera_maestra', px, py, 250 * s, pose, t, P && P.filtro); return; }
  if (spr(x, 'chichera_' + pose, px, py, 230 * s) || spr(x, 'chichera_quieta', px, py, 230 * s)) return;
  const piel = '#c98b5e', resp = Math.sin(t * 2.2) * 1.6 * s, rebote = pose === 'celebra' ? -Math.abs(Math.sin(t * 9)) * 8 * s : 0;
  sombra(x, px, py, 58 * s);
  x.save(); x.translate(px, py + rebote);
  // piernas y ojotas
  for (const lx of [-14, 10]) { rr(x, lx * s, -26 * s, 9 * s, 24 * s, 3 * s); trazo(x, piel, 2.5); elipse(x, (lx + 4) * s, -2 * s, 10 * s, 4 * s, '#5a3a22', 2); }
  // pollera con franjas
  x.beginPath(); x.moveTo(-30 * s, -112 * s + resp); x.bezierCurveTo(-52 * s, -80 * s, -70 * s, -40 * s, -70 * s, -24 * s); x.quadraticCurveTo(0, -12 * s, 70 * s, -24 * s); x.bezierCurveTo(70 * s, -40 * s, 52 * s, -80 * s, 30 * s, -112 * s + resp); x.closePath();
  trazo(x, grad(x, -112 * s, -20 * s, P.pollera), 3);
  x.save(); x.clip();
  for (const [yy, c] of [[-38, P.franja], [-50, '#ffffff'], [-58, P.franja]]) { x.fillStyle = c; x.fillRect(-80 * s, yy * s, 160 * s, (c === '#ffffff' ? 3 : 6) * s); }
  x.restore();
  // mandil
  x.beginPath(); x.moveTo(-22 * s, -108 * s + resp); x.lineTo(22 * s, -108 * s + resp); x.lineTo(26 * s, -46 * s); x.quadraticCurveTo(0, -38 * s, -26 * s, -46 * s); x.closePath(); trazo(x, P.mandil, 2.5);
  // brazo de atras
  const hombroY = -158 * s + resp;
  let aB = 0.35, aF = -0.25;
  if (pose === 'remueve') { aF = -0.9 + Math.sin(t * 5) * 0.35; }
  if (pose === 'espanta') { aF = -2.0; aB = 0.7; }
  if (pose === 'celebra') { aF = -2.9 + Math.sin(t * 9) * 0.15; aB = 2.6; }
  if (pose === 'susto') { aF = -2.6; aB = 2.6; }
  brazo(x, -24 * s, hombroY + 4 * s, aB, 46 * s, P.blusa, piel, s);
  // torso: blusa y lliclla (manta) en los hombros
  rr(x, -27 * s, -168 * s + resp, 54 * s, 64 * s, 16 * s); trazo(x, grad(x, -168 * s, -104 * s, P.blusa), 3);
  x.beginPath(); x.moveTo(-30 * s, -160 * s + resp); x.quadraticCurveTo(0, -120 * s + resp, 30 * s, -160 * s + resp); x.lineTo(24 * s, -168 * s + resp); x.quadraticCurveTo(0, -150 * s + resp, -24 * s, -168 * s + resp); x.closePath(); trazo(x, P.manta, 2.5);
  for (let i = -2; i <= 2; i++) { x.fillStyle = P.franja; x.beginPath(); x.arc(i * 9 * s, -146 * s + resp + Math.abs(i) * -3 * s, 2.2 * s, 0, PI * 2); x.fill(); }
  // cabeza
  const cy = -198 * s + resp;
  // trenzas
  for (const lado of [-1, 1]) {
    x.beginPath(); x.moveTo(lado * 20 * s, cy + 6 * s); x.quadraticCurveTo(lado * 34 * s, cy + 50 * s, lado * 22 * s, cy + 86 * s); x.lineWidth = 11 * s; x.strokeStyle = TINTA; x.stroke(); x.lineWidth = 7 * s; x.strokeStyle = '#1e1410'; x.stroke();
    elipse(x, lado * 22 * s, cy + 88 * s, 5 * s, 4 * s, P.cinta, 2);
  }
  elipse(x, 0, cy, 30 * s, 31 * s, piel, 3);
  x.beginPath(); x.ellipse(0, cy - 10 * s, 30 * s, 22 * s, 0, PI, PI * 2); x.fillStyle = '#1e1410'; x.fill();
  cara(x, 0, cy + 4 * s, 27 * s, pose === 'espanta' ? 'enojo' : pose === 'susto' ? 'susto' : pose === 'celebra' ? 'feliz' : 'normal', t);
  // sombrero (montera)
  elipse(x, 0, cy - 24 * s, 44 * s, 9 * s, P.sombrero, 3);
  rr(x, -24 * s, cy - 56 * s, 48 * s, 32 * s, 12 * s); trazo(x, grad(x, cy - 56 * s, cy - 24 * s, P.sombrero), 3);
  rr(x, -24 * s, cy - 34 * s, 48 * s, 7 * s, 2 * s); trazo(x, P.cinta, 2);
  // brazo de delante con el cucharon o el vaso
  const [hx, hy] = brazo(x, 24 * s, hombroY + 4 * s, aF, 46 * s, P.blusa, piel, s);
  if (pose === 'celebra') vaso(x, hx, hy - 4 * s, s * 1.1);
  else cucharon(x, hx, hy, pose === 'espanta' ? -2.3 : pose === 'remueve' ? -0.4 + Math.sin(t * 5) * 0.3 : -0.2, s);
  x.restore();
}

// Persona del dueño animada: respira, remueve, se lanza a espantar, salta al celebrar y tiembla del susto.
export function personaAnimada(x, k, px, py, h, pose, t, filtro) {
  sombra(x, px, py, h * 0.24);
  x.save(); x.translate(px, py);
  if (filtro) x.filter = filtro;
  if (pose === 'remueve') x.rotate(Math.sin(t * 5) * 0.035);
  else if (pose === 'espanta') { x.translate(16, -4); x.rotate(0.13); }
  else if (pose === 'celebra') x.translate(0, -Math.abs(Math.sin(t * 9)) * 16);
  else if (pose === 'susto') x.translate(Math.sin(t * 45) * 3.5, 0);
  x.scale(1, 1 + Math.sin(t * 2.2) * 0.012);
  spr(x, k, 0, 0, h);
  x.restore();
}

// ── CHICHERO ──
export function chichero(x, px, py, s, pose, t, P) {
  if (spr(x, 'chichero_' + pose, px, py, 230 * s) || spr(x, 'chichero_quieto', px, py, 230 * s)) return;
  const piel = '#b97c50', resp = Math.sin(t * 2.2) * 1.6 * s, rebote = pose === 'celebra' ? -Math.abs(Math.sin(t * 9)) * 8 * s : 0;
  sombra(x, px, py, 50 * s);
  x.save(); x.translate(px, py + rebote);
  for (const lx of [-17, 4]) { rr(x, lx * s, -72 * s, 14 * s, 66 * s, 5 * s); trazo(x, grad(x, -72 * s, 0, P.pantalon), 2.5); elipse(x, (lx + 7) * s, -3 * s, 12 * s, 5 * s, '#4a2f1c', 2); }
  const hombroY = -150 * s + resp;
  let aB = 0.3, aF = -0.25;
  if (pose === 'remueve') aF = -0.9 + Math.sin(t * 5) * 0.35;
  if (pose === 'espanta') { aF = -2.0; aB = 0.7; }
  if (pose === 'celebra') { aF = -2.9 + Math.sin(t * 9) * 0.15; aB = 2.6; }
  if (pose === 'susto') { aF = -2.6; aB = 2.6; }
  brazo(x, -24 * s, hombroY + 6 * s, aB, 48 * s, P.camisa, piel, s);
  rr(x, -26 * s, -160 * s + resp, 52 * s, 96 * s, 14 * s); trazo(x, grad(x, -160 * s, -64 * s, P.camisa), 3);
  // poncho
  x.beginPath(); x.moveTo(-14 * s, -162 * s + resp); x.lineTo(14 * s, -162 * s + resp); x.lineTo(50 * s, -98 * s + resp); x.lineTo(-50 * s, -98 * s + resp); x.closePath(); trazo(x, grad(x, -162 * s, -98 * s, P.poncho), 3);
  x.save(); x.clip(); for (const yy of [-108, -118]) { x.fillStyle = P.franja; x.fillRect(-60 * s, (yy + resp / s) * s, 120 * s, 4 * s); } x.restore();
  for (let i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(i * 11 * s, -98 * s + resp); x.lineTo(i * 11 * s, -90 * s + resp); x.lineWidth = 2.5 * s; x.strokeStyle = P.franja; x.stroke(); }
  // mandil
  rr(x, -18 * s, -96 * s + resp, 36 * s, 40 * s, 6 * s); trazo(x, P.mandil, 2.5);
  const cy = -190 * s + resp;
  elipse(x, 0, cy, 29 * s, 30 * s, piel, 3);
  cara(x, 0, cy + 4 * s, 26 * s, pose === 'espanta' ? 'enojo' : pose === 'susto' ? 'susto' : pose === 'celebra' ? 'feliz' : 'normal', t);
  // chullo con orejeras y pompon
  x.beginPath(); x.moveTo(-31 * s, cy - 2 * s); x.quadraticCurveTo(-30 * s, cy - 46 * s, 0, cy - 50 * s); x.quadraticCurveTo(30 * s, cy - 46 * s, 31 * s, cy - 2 * s); x.closePath(); trazo(x, grad(x, cy - 50 * s, cy, P.chullo), 3);
  for (const lado of [-1, 1]) { x.beginPath(); x.moveTo(lado * 30 * s, cy - 6 * s); x.lineTo(lado * 30 * s, cy + 22 * s); x.lineTo(lado * 20 * s, cy + 4 * s); x.closePath(); trazo(x, P.chullo, 2.5); x.beginPath(); x.moveTo(lado * 28 * s, cy + 22 * s); x.lineTo(lado * 30 * s, cy + 40 * s); x.lineWidth = 3 * s; x.strokeStyle = P.pompon; x.stroke(); }
  for (let i = -3; i <= 3; i++) { x.fillStyle = P.pompon; x.fillRect(i * 8 * s - 2 * s, cy - 28 * s, 4 * s, 4 * s); }
  elipse(x, 0, cy - 52 * s, 9 * s, 9 * s, P.pompon, 2.5);
  const [hx, hy] = brazo(x, 24 * s, hombroY + 6 * s, aF, 48 * s, P.camisa, piel, s);
  if (pose === 'celebra') vaso(x, hx, hy - 4 * s, s * 1.1);
  else cucharon(x, hx, hy, pose === 'espanta' ? -2.3 : pose === 'remueve' ? -0.4 + Math.sin(t * 5) * 0.3 : -0.2, s);
  x.restore();
}

// ── DUENDE LADRON (como la mascota: cabeza cuadrada verde, orejas largas y ojos azules) ──
const ROPA_D = { ladron: '#6b4423', rapido: '#2e7d32', gordo: '#5d4037', gancho: '#455a64', jefe: '#6a1b9a' };
export const altoDuende = (k, s) => (SPR.size ? (k === 'jefe' ? 200 : k === 'gordo' ? 140 : 125) : (k === 'jefe' ? 170 : 110)) * s;
export function duende(x, px, py, s, k, t, estado) {
  // estado: { corre, lleva, golpe (0..1), huye }
  if (estado.var && SPR.has('duende_' + estado.var)) {
    const h = (k === 'jefe' ? 200 : k === 'gordo' ? 140 : k === 'rapido' ? 118 : 125) * s, paso = estado.corre ? t * (k === 'rapido' ? 16 : 11) : 0;
    sombra(x, px, py, h * 0.22);
    x.save(); x.translate(px, py - (estado.corre ? Math.abs(Math.sin(paso)) * 7 * s : 0));
    x.rotate(estado.corre ? Math.sin(paso) * 0.06 : 0);
    if (estado.golpe > 0) { x.translate(Math.sin(estado.golpe * 60) * 4, 0); x.scale(1.06, 0.94); if (estado.golpe > 0.18) x.filter = 'brightness(1.9) saturate(.6)'; }
    spr(x, 'duende_' + estado.var, 0, 0, h, !!estado.huye);
    x.restore();
    if (estado.lleva && estado.huye) vaso(x, px + 20 * s, py - h * 0.62, 0.9 * s);
    return;
  }
  const nombreSpr = 'duende_' + k + (estado.golpe > 0 ? '_golpeado' : estado.lleva ? '_roba' : '_corre');
  if (spr(x, nombreSpr, px, py, (k === 'jefe' ? 190 : k === 'gordo' ? 130 : 110) * s, !estado.huye)) return;
  const esc = s * (k === 'jefe' ? 1.6 : k === 'gordo' ? 1.15 : 1);
  const paso = estado.corre ? t * (k === 'rapido' ? 18 : 11) : 0, ancho = k === 'gordo' || k === 'jefe' ? 1.35 : k === 'rapido' ? 0.85 : 1;
  sombra(x, px, py, 30 * esc);
  x.save(); x.translate(px, py); if (estado.huye) x.scale(-1, 1);   // por defecto mira a la izquierda (al puesto)
  if (estado.golpe > 0) { x.rotate(Math.sin(estado.golpe * 30) * 0.2); }
  x.scale(esc, esc);
  const bote = estado.corre ? -Math.abs(Math.sin(paso)) * 5 : 0;
  // piernas
  for (const [lx, f] of [[-8, 0], [8, PI]]) { const a = Math.sin(paso + f) * 0.7; x.save(); x.translate(lx, -26); x.rotate(a); rr(x, -5, 0, 10, 24, 4); trazo(x, '#5b8f22', 2.5); elipse(x, -3, 24, 8, 4.5, '#3e2716', 2); x.restore(); }
  x.translate(0, bote);
  // cuerpo
  rr(x, -22 * ancho, -66, 44 * ancho, 44, 14); trazo(x, grad(x, -66, -22, ROPA_D[k]), 3);
  if (k === 'gordo') { elipse(x, 0, -40, 20, 16, '#7cba35', 2.5); }
  if (k === 'rapido') { x.beginPath(); x.moveTo(-14, -64); x.quadraticCurveTo(10, -58, 30, -70 + Math.sin(paso) * 6); x.lineWidth = 6; x.strokeStyle = '#d32f2f'; x.stroke(); }
  if (k === 'jefe') { rr(x, 18, -70, 30, 34, 10); trazo(x, '#b08d57', 2.5); vaso(x, 33, -62, 0.6); }
  // brazos
  x.beginPath(); x.moveTo(-20 * ancho, -56); x.lineTo(-34 * ancho, -40 + Math.sin(paso) * 6); x.lineWidth = 9; x.strokeStyle = TINTA; x.stroke(); x.lineWidth = 6; x.strokeStyle = '#7cba35'; x.stroke();
  if (estado.lleva) vaso(x, -36 * ancho, -32, 0.85);
  if (k === 'gordo') { elipse(x, -30, -42, 15, 18, '#8d8d8d', 3); elipse(x, -30, -42, 9, 11, '#a6a6a6', 2); }
  if (k === 'gancho') { x.beginPath(); x.moveTo(-30, -44); x.lineTo(-62, -94); x.lineWidth = 3; x.strokeStyle = '#6d4c41'; x.stroke(); x.beginPath(); x.moveTo(-62, -94); x.lineTo(-72, -60); x.lineWidth = 1.5; x.strokeStyle = '#ddd'; x.stroke(); x.beginPath(); x.arc(-70, -58, 4, 0, PI); x.lineWidth = 2.5; x.strokeStyle = '#9e9e9e'; x.stroke(); }
  // cabeza cuadrada con orejas
  const hy = -98;
  for (const lado of [-1, 1]) {
    x.beginPath(); x.moveTo(lado * 20, hy - 4); x.lineTo(lado * 52, hy - 22 + Math.sin(t * 6 + lado) * 2); x.lineTo(lado * 22, hy + 14); x.closePath(); trazo(x, '#7cba35', 3);
    x.beginPath(); x.moveTo(lado * 24, hy); x.lineTo(lado * 44, hy - 16); x.lineTo(lado * 25, hy + 8); x.closePath(); x.fillStyle = '#f07a3a'; x.fill();
  }
  rr(x, -26, hy - 30, 52, 50, 12); trazo(x, grad(x, hy - 30, hy + 20, '#86c63c'), 3);
  // ojos y cejas picaras
  for (const lado of [-1, 1]) {
    elipse(x, lado * 11 - 3, hy - 8, 8, 9, '#fff', 2);
    x.beginPath(); x.arc(lado * 11 - 5, hy - 7, 5, 0, PI * 2); x.fillStyle = estado.golpe > 0 ? '#555' : '#1f5fd1'; x.fill();
    x.beginPath(); x.arc(lado * 11 - 6, hy - 9, 1.8, 0, PI * 2); x.fillStyle = '#fff'; x.fill();
    x.save(); x.translate(lado * 11 - 3, hy - 20); x.rotate(lado * -0.4); rr(x, -9, -3, 18, 6, 2); x.fillStyle = '#3f7d12'; x.fill(); x.restore();
  }
  if (estado.golpe > 0) { for (const lado of [-1, 1]) { x.beginPath(); x.moveTo(lado * 11 - 8, hy - 13); x.lineTo(lado * 11 + 2, hy - 3); x.moveTo(lado * 11 + 2, hy - 13); x.lineTo(lado * 11 - 8, hy - 3); x.lineWidth = 2.5; x.strokeStyle = TINTA; x.stroke(); } }
  // sonrisa con dientes
  x.beginPath(); x.moveTo(-14, hy + 6); x.quadraticCurveTo(-3, hy + 16, 10, hy + 5); x.closePath(); x.fillStyle = '#4a0f1c'; x.fill(); x.lineWidth = 2; x.strokeStyle = TINTA; x.stroke();
  x.fillStyle = '#fff'; x.fillRect(-11, hy + 6, 18, 3);
  if (k === 'ladron') { rr(x, -27, hy - 14, 54, 10, 3); x.fillStyle = 'rgba(30,20,20,.75)'; x.fill(); for (const lado of [-1, 1]) { x.beginPath(); x.arc(lado * 11 - 4, hy - 8, 4, 0, PI * 2); x.fillStyle = '#1f5fd1'; x.fill(); } }
  if (k === 'jefe') { x.beginPath(); x.moveTo(-22, hy - 28); x.lineTo(-22, hy - 48); x.lineTo(-11, hy - 36); x.lineTo(0, hy - 52); x.lineTo(11, hy - 36); x.lineTo(22, hy - 48); x.lineTo(22, hy - 28); x.closePath(); trazo(x, '#ffd54a', 2.5); }
  x.restore();
}

// ── OLLA y FUEGO ──
const OLLA_COL = [['#b8613a', '#8d4426'], ['#a85633', '#7a3a1f'], ['#c87533', '#8a4a1a'], ['#f2c33a', '#b8860b'], ['#7b3fbf', '#4a148c']];
export function olla(x, cx, py, s, nivel, llenado, lista, t) {
  if (SPR.has('olla_' + (nivel + 1))) {
    const h = 128 * s, pulso = llenado ? 1 + Math.sin(t * 7) * 0.018 : 1;
    x.save(); x.translate(cx, py); x.scale(2 - pulso, pulso); spr(x, 'olla_' + (nivel + 1), 0, 0, h); x.restore();
    if (lista) brilloLista(x, cx, py - h - 6 * s, s, t);
    return;
  }
  if (spr(x, 'olla_' + (nivel + 1), cx, py, 120 * s)) { if (lista) brilloLista(x, cx, py - 120 * s, s, t); return; }
  const [c1, c2] = OLLA_COL[nivel] || OLLA_COL[0];
  const w = 54 * s, h = 62 * s, top = py - h;
  // asas
  for (const lado of [-1, 1]) { x.beginPath(); x.ellipse(cx + lado * (w + 4 * s), top + 20 * s, 9 * s, 12 * s, 0, 0, PI * 2); x.lineWidth = 6 * s; x.strokeStyle = TINTA; x.stroke(); x.lineWidth = 3.5 * s; x.strokeStyle = c2; x.stroke(); }
  // cuerpo
  x.beginPath(); x.moveTo(cx - w, top + 8 * s); x.bezierCurveTo(cx - w * 1.18, top + h * 0.75, cx - w * 0.7, py, cx, py); x.bezierCurveTo(cx + w * 0.7, py, cx + w * 1.18, top + h * 0.75, cx + w, top + 8 * s); x.closePath();
  const g = x.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, c2); g.addColorStop(0.35, aclarar(c1, 0.25)); g.addColorStop(1, c2);
  trazo(x, g, 3);
  if (nivel === 4) { x.save(); x.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3); x.strokeStyle = '#e1b3ff'; x.lineWidth = 6 * s; x.stroke(); x.restore(); }
  // franja decorativa
  x.beginPath(); x.moveTo(cx - w * 1.02, top + 26 * s); x.quadraticCurveTo(cx, top + 34 * s, cx + w * 1.02, top + 26 * s); x.lineWidth = 3 * s; x.strokeStyle = nivel === 3 ? '#fff3c4' : '#f6e7c1'; x.stroke();
  // boca y chicha
  elipse(x, cx, top + 8 * s, w, 12 * s, c2, 3);
  if (llenado > 0) {
    x.save(); x.beginPath(); x.ellipse(cx, top + 9 * s, w - 6 * s, 9 * s, 0, 0, PI * 2); x.clip();
    x.fillStyle = '#5c1340'; x.fillRect(cx - w, top - 4 * s, w * 2, 30 * s);
    x.fillStyle = 'rgba(214,92,170,.45)'; x.beginPath(); x.ellipse(cx - 12 * s, top + 7 * s, 18 * s, 4 * s, 0, 0, PI * 2); x.fill();
    for (let i = 0; i < 4; i++) { const b = (t * 0.9 + i * 0.27) % 1; x.beginPath(); x.arc(cx + Math.sin(i * 2.4) * w * 0.55, top + 9 * s - b * 4 * s, (2 + b * 3) * s * llenado, 0, PI * 2); x.fillStyle = 'rgba(240,170,220,' + (0.7 - b * 0.6) + ')'; x.fill(); }
    x.restore();
  }
  if (lista) brilloLista(x, cx, top - 20 * s, s, t);
}
function brilloLista(x, cx, cy, s, t) {
  const b = Math.sin(t * 6) * 4 * s;
  x.save(); x.globalAlpha = 0.85; const g = x.createRadialGradient(cx, cy + b, 2, cx, cy + b, 34 * s); g.addColorStop(0, 'rgba(255,230,120,.95)'); g.addColorStop(1, 'rgba(255,230,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy + b, 34 * s, 0, PI * 2); x.fill(); x.restore();
  if (!spr(x, VASO_SPR.k, cx, cy + 22 * s + b, 46 * s)) vaso(x, cx, cy + 12 * s + b, s * 1.25);
}
export const VASO_SPR = { k: 'vaso_1' };   // el juego pone el vaso de la rareza actual
export function fuego(x, cx, py, s, nivel, t, encendido) {
  if (spr(x, 'fuego_' + (nivel + 1), cx, py, 70 * s)) return;
  if (nivel <= 0) {   // fogon de piedra con leña
    for (let i = -2; i <= 2; i++) elipse(x, cx + i * 20 * s, py - 6 * s, 12 * s, 9 * s, i % 2 ? '#8d8d8d' : '#a1a1a1', 2.5);
    for (const a of [-0.35, 0.35]) { x.save(); x.translate(cx, py - 10 * s); x.rotate(a); rr(x, -34 * s, -5 * s, 68 * s, 10 * s, 4 * s); trazo(x, '#6d4426', 2.5); x.restore(); }
  } else {
    const col = ['', '#546e7a', '#37474f', '#4a148c'][nivel];
    rr(x, cx - 46 * s, py - 22 * s, 92 * s, 22 * s, 6 * s); trazo(x, grad(x, py - 22 * s, py, col), 3);
    for (const lado of [-1, 1]) { rr(x, cx + lado * 40 * s - 3 * s, py - 30 * s, 6 * s, 10 * s, 2 * s); trazo(x, '#263238', 2); }
  }
  if (!encendido) return;
  const colores = nivel === 3 ? ['#7c3aed', '#c084fc', '#f5d0fe'] : nivel === 2 ? ['#1e88e5', '#64b5f6', '#e3f2fd'] : ['#e65100', '#ffb300', '#fff59d'];
  for (let c = 0; c < 3; c++) for (let i = -2; i <= 2; i++) {
    const fl = Math.sin(t * 13 + i * 1.7 + c) * 0.25 + 1, hh = (26 - c * 7) * s * fl * (1 - Math.abs(i) * 0.15), ww = (9 - c * 2) * s;
    const fx = cx + i * 14 * s, fy = py - (nivel ? 20 : 10) * s;
    x.beginPath(); x.moveTo(fx - ww, fy); x.quadraticCurveTo(fx - ww, fy - hh * 0.6, fx, fy - hh); x.quadraticCurveTo(fx + ww, fy - hh * 0.6, fx + ww, fy); x.closePath(); x.fillStyle = colores[c]; x.fill();
  }
}

// ── CLIENTES ──
const CLI = [
  { piel: '#d9a074', ropa: '#1565c0', pelo: '#2b1b10', sombrero: '#f5f5f5', alto: 0.9 },
  { piel: '#a86b45', ropa: '#2e7d32', pelo: '#111', sombrero: '#795548', alto: 1 },
  { piel: '#e0b089', ropa: '#ef6c00', pelo: '#5d4037', sombrero: null, alto: 0.75 },
  { piel: '#8d5a3b', ropa: '#6a1b9a', pelo: '#cfcfcf', sombrero: '#3e2723', alto: 0.95 },
  { piel: '#c68a5e', ropa: '#00838f', pelo: '#1b1b1b', sombrero: '#fbc02d', alto: 1.02 },
];
export const N_CLIENTES = CLI.length;
const CLI_SPR = ['casera', 'aventurero', 'alquimista', 'agricultor'];
export const clienteSpr = i => { const k = CLI_SPR[i % CLI_SPR.length]; return SPR.has(k) ? k : null; };
export function cliente(x, px, py, s, i, t, camina, feliz) {
  const ks = CLI_SPR[i % CLI_SPR.length];
  if (SPR.has(ks)) {
    const h = 175 * s, b = camina ? Math.abs(Math.sin(t * 9)) * 4 : 0;
    sombra(x, px, py, h * 0.2);
    x.save(); x.translate(px, py - b); if (camina) x.rotate(Math.sin(t * 9) * 0.03); spr(x, ks, 0, 0, h); x.restore();
    if (feliz) { x.save(); x.font = '22px "DQ Iconos", system-ui'; x.textAlign = 'center'; x.fillText('♥', px + 26, py - h - 6 + Math.sin(t * 6) * 3); x.restore(); }
    return;
  }
  if (spr(x, 'cliente_' + (i + 1), px, py, 170 * s * CLI[i].alto, true)) return;
  const c = CLI[i], k = s * c.alto, paso = camina ? Math.sin(t * 10) : 0;
  sombra(x, px, py, 30 * k);
  x.save(); x.translate(px, py - (camina ? Math.abs(paso) * 3 : 0));
  for (const [lx, f] of [[-9, 1], [3, -1]]) { x.save(); x.translate(lx * k, -46 * k); x.rotate(paso * 0.4 * f); rr(x, 0, 0, 10 * k, 46 * k, 4 * k); trazo(x, '#37474f', 2.5); x.restore(); }
  rr(x, -22 * k, -118 * k, 44 * k, 76 * k, 14 * k); trazo(x, grad(x, -118 * k, -42 * k, c.ropa), 3);
  x.beginPath(); x.moveTo(18 * k, -104 * k); x.lineTo(30 * k, -70 * k + paso * 4); x.lineWidth = 12 * k; x.strokeStyle = TINTA; x.stroke(); x.lineWidth = 8 * k; x.strokeStyle = c.ropa; x.stroke();
  const cy = -140 * k;
  elipse(x, 0, cy, 24 * k, 25 * k, c.piel, 3);
  x.beginPath(); x.ellipse(0, cy - 8 * k, 24 * k, 18 * k, 0, PI, PI * 2); x.fillStyle = c.pelo; x.fill();
  cara(x, 2 * k, cy + 4 * k, 21 * k, feliz ? 'feliz' : 'normal', t + i);
  if (c.sombrero) { elipse(x, 0, cy - 20 * k, 34 * k, 7 * k, c.sombrero, 2.5); rr(x, -17 * k, cy - 42 * k, 34 * k, 23 * k, 8 * k); trazo(x, c.sombrero, 2.5); }
  x.restore();
}

// ── FONDO: puesto de mercado andino ──
export function fondo(x, W, H, piso, t, noche, toldo) {
  const im3d = img(noche ? 'fondo_mercado_noche' : 'fondo_mercado_dia');
  if (im3d) {   // plaza modelada en Blender (tools/cw_fondo_blender.py); las nubes pasan por delante del cielo
    x.drawImage(im3d, 0, 0, W, H);
    x.save(); x.beginPath(); x.rect(0, 0, W, piso * 0.42); x.clip(); R.nubes(x, W, piso, t, noche); x.restore();
  } else {
  const cielo = x.createLinearGradient(0, 0, 0, piso);
  if (noche) { cielo.addColorStop(0, '#0e1236'); cielo.addColorStop(1, '#3b2a6b'); } else { cielo.addColorStop(0, '#7ec8f2'); cielo.addColorStop(1, '#ffe1b0'); }
  x.fillStyle = cielo; x.fillRect(0, 0, W, piso);
  // sol o luna, con resplandor y rayos (rig.js), y nubes que pasan
  R.sol(x, W * 0.8, piso * 0.22, t, noche);
  x.beginPath(); x.arc(W * 0.8, piso * 0.22, 26, 0, PI * 2); x.fillStyle = noche ? '#f5f1d6' : '#fff1a8'; x.fill();
  R.nubes(x, W, piso, t, noche);
  // cordillera en capas
  const capas = noche ? ['#2b2d5c', '#3a3570', '#4b3f7a'] : ['#9bb7d4', '#7f9fbf', '#6b8f6a'];
  capas.forEach((c, i) => {
    x.beginPath(); x.moveTo(0, piso);
    for (let k = 0; k <= 12; k++) { const px = k / 12 * W, py = piso * (0.42 + i * 0.12) - Math.abs(Math.sin(k * 1.3 + i * 2.1)) * piso * (0.18 - i * 0.04); x.lineTo(px, py); }
    x.lineTo(W, piso); x.closePath(); x.fillStyle = c; x.fill();
    if (i === 0 && !noche) { x.save(); x.clip(); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(0, 0, W, piso * 0.36); x.restore(); }
  });
  // suelo empedrado
  const sg = x.createLinearGradient(0, piso, 0, H); sg.addColorStop(0, noche ? '#4e3b33' : '#c9a27a'); sg.addColorStop(1, noche ? '#2e211c' : '#a07650');
  x.fillStyle = sg; x.fillRect(0, piso, W, H - piso);
  x.save(); x.globalAlpha = 0.18; x.strokeStyle = '#3e2716';
  for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse((i + (j % 2) * 0.5) * W / 8, piso + 14 + j * 26, 22, 9, 0, 0, PI * 2); x.stroke(); }
  x.restore();
  }
  // puesto modelado en Blender (tools/cw_puesto_blender.py): postes y toldo detras de los clientes
  _noche = noche;
  const ip = img('puesto_toldo_' + Math.min(2, toldo));
  if (ip) {
    x.save(); if (noche) x.filter = 'brightness(.6) saturate(.9)'; x.drawImage(ip, 0, piso - 290, W, 315); x.restore();
    if (noche) for (const px of [60, W - 60]) { const g = x.createRadialGradient(px, piso - 175, 2, px, piso - 175, 90); g.addColorStop(0, 'rgba(255,200,90,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); x.fillStyle = g; x.fillRect(px - 90, piso - 265, 180, 180); }
    return;
  }
  // puesto: postes y toldo de rayas
  const tTop = piso - 250, tBot = piso - 205;
  for (const px of [36, W - 36]) { rr(x, px - 7, tTop + 10, 14, piso - tTop - 10, 4); trazo(x, '#7a4e2b', 3); }
  if (toldo > 0) {
    const fr = toldo >= 2 ? ['#7b1fa2', '#fdd835'] : ['#c62828', '#fafafa'];
    for (let i = 0; i < 12; i++) { x.beginPath(); const a = i / 12 * (W - 40) + 20, b = a + (W - 40) / 12; x.moveTo(a, tTop); x.lineTo(b, tTop); x.lineTo(b, tBot); x.quadraticCurveTo((a + b) / 2, tBot + 14, a, tBot); x.closePath(); x.fillStyle = fr[i % 2]; x.fill(); x.lineWidth = 2; x.strokeStyle = TINTA; x.stroke(); }
  }
  if (toldo >= 2) {   // banderines
    x.beginPath(); x.moveTo(20, tBot + 22); x.quadraticCurveTo(W / 2, tBot + 52, W - 20, tBot + 22); x.lineWidth = 1.5; x.strokeStyle = '#3e2716'; x.stroke();
    const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
    for (let i = 0; i < 14; i++) { const u = (i + 0.5) / 14, px = 20 + u * (W - 40), py = tBot + 22 + Math.sin(u * PI) * 30 + Math.sin(t * 3 + i) * 1.5; x.beginPath(); x.moveTo(px - 9, py); x.lineTo(px + 9, py); x.lineTo(px, py + 18); x.closePath(); x.fillStyle = cols[i % 5]; x.fill(); }
  }
  // mazorcas de maiz morado colgadas
  for (const px of [70, W - 70]) for (let i = 0; i < 3; i++) { elipse(x, px + (i - 1) * 12, tBot + 34 + i % 2 * 6, 6, 16, '#4a1452', 2); }
  if (noche) for (const px of [60, W - 60]) { const g = x.createRadialGradient(px, tBot + 30, 2, px, tBot + 30, 90); g.addColorStop(0, 'rgba(255,200,90,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); x.fillStyle = g; x.fillRect(px - 90, tBot - 60, 180, 180); }
}

// Mostrador del puesto (se dibuja despues de los clientes: les tapa las piernas).
let _noche = false;
export function mostrador(x, W, piso) {
  const im3 = img('puesto_mostrador');
  if (im3) { x.save(); if (_noche) x.filter = 'brightness(.66) saturate(.9)'; x.drawImage(im3, 0, piso - 290, W, 315); x.restore(); return; }
  rr(x, 14, piso - 62, W - 28, 30, 6); trazo(x, grad(x, piso - 62, piso - 32, '#8d5a34'), 3);
  rr(x, 24, piso - 34, W - 48, 34, 4); trazo(x, grad(x, piso - 34, piso, '#6d4426'), 3);
  x.save(); x.globalAlpha = 0.25; x.strokeStyle = '#3e2716'; x.lineWidth = 2;
  for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(24 + i * (W - 48) / 8, piso - 32); x.lineTo(24 + i * (W - 48) / 8, piso); x.stroke(); }
  x.restore();
}
// Estante de jarras: las jarras se llenan segun los vasos guardados.
export function estante(x, cx, py, vasos, cap, jarraR) {
  const kj = 'jarra_' + (Math.min(5, jarraR || 0) + 1);
  if (SPR.has(kj)) {
    const llenas = Math.min(3, Math.ceil(vasos / Math.max(1, cap) * 3));
    for (let i = 0; i < 3; i++) { x.save(); x.globalAlpha = i < llenas ? 1 : 0.35; spr(x, kj, cx - 46 + i * 46, py, 52); x.restore(); }
    x.save(); x.font = '15px "DQ Iconos","Lilita One", system-ui'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#2a1712'; x.fillStyle = vasos >= cap ? '#ff8a80' : '#fff3c4';
    const tx = vasos + ' / ' + cap; x.strokeText(tx, cx, py + 16); x.fillText(tx, cx, py + 16); x.restore();
    return;
  }
  rr(x, cx - 60, py - 8, 120, 8, 3); trazo(x, '#6d4426', 2.5);
  const llenas = Math.min(5, Math.ceil(vasos / Math.max(1, cap) * 5));
  for (let i = 0; i < 5; i++) {
    const jx = cx - 48 + i * 24;
    x.beginPath(); x.moveTo(jx - 8, py - 8); x.lineTo(jx - 10, py - 34); x.lineTo(jx + 10, py - 34); x.lineTo(jx + 8, py - 8); x.closePath(); trazo(x, 'rgba(255,255,255,.5)', 2);
    if (i < llenas) { x.beginPath(); x.moveTo(jx - 7.5, py - 10); x.lineTo(jx - 9, py - 28); x.lineTo(jx + 9, py - 28); x.lineTo(jx + 7.5, py - 10); x.closePath(); x.fillStyle = '#6d1b4d'; x.fill(); }
  }
}
