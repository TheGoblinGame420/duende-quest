// ═══════════════════════════════════════════════════════
// CHICHA WARS — animacion 2D articulada sobre las ilustraciones del dueño
//
// Cada personaje (una sola imagen) se dibuja en franjas horizontales finas y
// cada franja se desplaza y escala por su cuenta segun su altura en el cuerpo:
// asi la columna se curva (bend), la cabeza se inclina con retraso (head),
// las piernas / la falda dan el paso (legPh, legAmp), el pecho respira
// (breathe) y todo el cuerpo se aplasta o estira (sx, sy). Los valores los
// mueven muelles (Muelle): anticipacion, golpe y rebote con inercia, sin
// cambios bruscos. Coste: ~28 drawImage por personaje.
// ═══════════════════════════════════════════════════════

// Muelle amortiguado: valor que persigue un objetivo con inercia (k = rigidez, c = amortiguacion).
export class Muelle {
  constructor(v = 0, k = 140, c = 14) { this.v = v; this.vel = 0; this.obj = v; this.k = k; this.c = c; }
  paso(dt) { const a = (this.obj - this.v) * this.k - this.vel * this.c; this.vel += a * dt; this.v += this.vel * dt; return this.v; }
  golpe(imp) { this.vel += imp; }
}

// Estado de rig por defecto.
export function rigNuevo() {
  return { bend: new Muelle(0, 120, 12), head: new Muelle(0, 90, 9), sy: new Muelle(1, 260, 16), lean: new Muelle(0, 150, 16),
    legPh: 0, legAmp: 0, breathe: 0, dx: 0, dy: 0, rot: 0, flash: 0, alpha: 1 };
}
export function rigPaso(r, dt) { r.bend.paso(dt); r.head.paso(dt); r.sy.paso(dt); r.lean.paso(dt); r.flash = Math.max(0, r.flash - dt * 4); }

const N = 28;
// img: HTMLImageElement; (px, py) pies; h alto en px; r: rig; flip: mirar a la izquierda.
export function dibujarRig(x, img, px, py, h, r, flip, filtro) {
  const iw = img.width, ih = img.height, w = h * iw / ih;
  const sy = Math.max(0.6, Math.min(1.45, r.sy.v)), sx = 1 / Math.sqrt(sy);   // aplastar conserva el volumen
  const bend = r.bend.v + r.lean.v, head = r.head.v;
  // Sombra que se encoge cuando el personaje esta en el aire.
  const alto = Math.max(0, -r.dy);
  x.save(); x.globalAlpha = 0.24 * r.alpha * Math.max(0.3, 1 - alto / 120); x.fillStyle = '#000';
  x.beginPath(); x.ellipse(px + r.dx, py, w * 0.36 * sx * Math.max(0.5, 1 - alto / 200), w * 0.09, 0, 0, Math.PI * 2); x.fill(); x.restore();
  x.save();
  x.translate(px + r.dx, py + r.dy);
  if (r.rot) x.rotate(r.rot);
  if (flip) x.scale(-1, 1);
  if (r.alpha < 1) x.globalAlpha = r.alpha;
  if (filtro || r.flash > 0.05) x.filter = (filtro || '') + (r.flash > 0.05 ? ` brightness(${1 + r.flash * 1.6}) saturate(${1 - r.flash * 0.5})` : '');
  const sh = ih / N, dh = h * sy / N;
  for (let i = 0; i < N; i++) {
    const t = 1 - (i + 0.5) / N;                     // 0 = pies, 1 = coronilla
    let dx = bend * t * t * h;                       // columna curvada (mas arriba, mas se mueve)
    if (t > 0.7) dx += head * ((t - 0.7) / 0.3) * h * 0.55;   // cabeza que se inclina
    if (t < 0.42 && r.legAmp) dx += Math.sin(r.legPh) * r.legAmp * h * ((0.42 - t) / 0.42);   // zancada
    const resp = 1 + r.breathe * Math.exp(-((t - 0.58) ** 2) / 0.02);   // pecho que respira
    const ww = w * sx * resp;
    x.drawImage(img, 0, i * sh, iw, sh + 0.5, dx - ww / 2, -h * sy + i * dh, ww, dh + 0.8);
  }
  x.restore();
}

// ── EFECTOS DE AMBIENTE ──
// Vapor: bocanada suave pre-dibujada (degradado radial), barata de pintar muchas veces.
let _vapor = null;
export function bocanada() {
  if (_vapor) return _vapor;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_vapor = c);
}
// Nubes de algodon que pasan despacio.
export function nubes(x, W, piso, t, noche) {
  x.save(); x.globalAlpha = noche ? 0.25 : 0.85;
  for (let i = 0; i < 4; i++) {
    const vel = 6 + i * 3, cx = ((t * vel + i * 190) % (W + 260)) - 130, cy = 40 + i * 26 + Math.sin(i * 2) * 8, s = 0.7 + (i % 2) * 0.35;
    x.fillStyle = noche ? '#8c87b8' : '#ffffff';
    for (const [ox, oy, rr] of [[0, 0, 22], [22, -8, 26], [46, 0, 20], [24, 8, 22], [-18, 6, 16]]) { x.beginPath(); x.arc(cx + ox * s, cy + oy * s, rr * s, 0, Math.PI * 2); x.fill(); }
  }
  x.restore();
}
// Resplandor del sol con rayos que giran lento.
export function sol(x, cx, cy, t, noche) {
  x.save();
  const g = x.createRadialGradient(cx, cy, 4, cx, cy, 120);
  g.addColorStop(0, noche ? 'rgba(245,241,214,.45)' : 'rgba(255,246,190,.8)'); g.addColorStop(1, 'rgba(255,240,180,0)');
  x.fillStyle = g; x.fillRect(cx - 120, cy - 120, 240, 240);
  if (!noche) {
    x.translate(cx, cy); x.rotate(t * 0.05); x.globalAlpha = 0.16; x.fillStyle = '#fff6c0';
    for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(-10, 170); x.lineTo(10, 170); x.closePath(); x.fill(); }
  }
  x.restore();
}
// Luz calida del fuego sobre el suelo (aditiva, parpadea).
export function luzFuego(x, cx, cy, t, i, color = '255,150,60') {
  const k = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i);
  x.save(); x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(cx, cy, 4, cx, cy, 90 * k);
  g.addColorStop(0, `rgba(${color},${0.35 * k})`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(cx - 100, cy - 100, 200, 200); x.restore();
}
// Motas de polvo en la luz.
export function motas(x, W, H, t) {
  x.save(); x.fillStyle = 'rgba(255,240,200,.55)';
  for (let i = 0; i < 22; i++) {
    const px = (i * 97 + t * (6 + i % 5)) % W, py = (i * 53 + Math.sin(t * 0.7 + i) * 18 + 140) % (H - 160) + 80;
    x.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + i * 2.1);
    x.beginPath(); x.arc(px, py, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}
// Vineta suave de juego (centra la mirada).
let _vin = null;
export function vineta(x, W, H) {
  if (!_vin) {
    _vin = document.createElement('canvas'); _vin.width = W; _vin.height = H;
    const g = _vin.getContext('2d'), gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.85);
    gr.addColorStop(0, 'rgba(20,6,26,0)'); gr.addColorStop(1, 'rgba(20,6,26,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  x.drawImage(_vin, 0, 0);
}
