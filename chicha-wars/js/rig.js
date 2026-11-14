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

// ── HOJA DE SPRITES ──
// De un dibujo quieto se hornean 12 cuadros de caminata en un lienzo aparte: el cuerpo sube y baja, la cabeza
// se mece y cada pierna (mitad izquierda y derecha de los pies) avanza y se levanta en contrafase.
// Dibujar un cuadro ya hecho cuesta una sola llamada: hace posibles las hordas de 40 duendes en un celular.
const HOJAS = new Map(), FR = 12;
export function hoja(img, hpx = 240) {
  let hj = HOJAS.get(img); if (hj) return hj;
  const s = hpx / img.height, w = Math.ceil(img.width * s), fw = w + Math.ceil(hpx * 0.26), fh = Math.ceil(hpx * 1.1);
  const c = document.createElement('canvas'); c.width = fw * FR; c.height = fh;
  const g = c.getContext('2d'), NS = 40, sh = img.height / NS, dh = hpx / NS;
  for (let f = 0; f < FR; f++) {
    const ph = f / FR * Math.PI * 2, ox = f * fw + fw / 2, bob = -Math.abs(Math.sin(ph)) * hpx * 0.03;
    for (let i = 0; i < NS; i++) {
      const t = 1 - (i + 0.5) / NS, y = fh - hpx + i * dh;
      let dx = -0.07 * t * t * hpx + Math.sin(ph) * 0.012 * hpx * t;
      if (t > 0.72) dx += Math.sin(ph + 0.9) * 0.016 * hpx * ((t - 0.72) / 0.28);
      if (t < 0.34) {
        const q = 1 - t / 0.34;
        for (const [lado, sg] of [[0, 1], [1, -1]]) {
          const ldx = Math.cos(ph) * sg * 0.05 * hpx * q, ldy = -Math.max(0, Math.sin(ph) * sg) * 0.06 * hpx * q + bob * (1 - q);
          g.drawImage(img, lado * img.width / 2, i * sh, img.width / 2, sh + 0.5, ox - w / 2 + lado * w / 2 + dx + ldx, y + ldy, w / 2 + 0.7, dh + 0.9);
        }
      } else g.drawImage(img, 0, i * sh, img.width, sh + 0.5, ox - w / 2 + dx, y + bob, w, dh + 0.9);
    }
  }
  hj = { c, fw, fh, hpx }; HOJAS.set(img, hj); return hj;
}
export function dibujarHoja(x, img, px, py, h, r, flip, filtro, fase) {
  const hj = hoja(img), f = ((Math.floor(fase / (Math.PI * 2) * FR) % FR) + FR) % FR, k = h / hj.hpx;
  const sy = Math.max(0.6, Math.min(1.45, r.sy.v)), sx = 1 / Math.sqrt(sy);
  x.save(); x.globalAlpha = 0.24 * r.alpha; x.fillStyle = '#000'; x.beginPath(); x.ellipse(px, py, hj.fw * k * 0.3, hj.fw * k * 0.075, 0, 0, Math.PI * 2); x.fill(); x.restore();
  x.save(); x.translate(px + r.bend.v * h * 0.4, py); if (flip) x.scale(-1, 1); x.scale(sx, sy);
  if (r.alpha < 1) x.globalAlpha = r.alpha;
  if (filtro || r.flash > 0.05) x.filter = (filtro || '') + (r.flash > 0.05 ? ` brightness(${1 + r.flash * 1.6}) saturate(${1 - r.flash * 0.5})` : '');
  x.drawImage(hj.c, f * hj.fw, 0, hj.fw, hj.fh, -hj.fw * k / 2, -hj.fh * k, hj.fw * k, hj.fh * k);
  x.restore();
}

// ── HOJAS CON MALLA (titere) ──
// Deforma el dibujo con una rejilla de triangulos y hornea F cuadros. campo(X, Y, ph) devuelve [dx, dy] en
// fracciones del alto (X = u·ancho/alto, Y: 0 coronilla → 1 pies). Como el campo es continuo, el dibujo no se
// rompe: respira, inclina la cabeza, mueve un brazo o la falda, igual que un titere de malla.
const MALLAS = new Map(), GX = 10, GY = 16;
function tri(g, img, s, d) {
  const cx = (d[0] + d[2] + d[4]) / 3, cy = (d[1] + d[3] + d[5]) / 3, e = 1.06;   // un poco mas grande: tapa las costuras
  g.save(); g.beginPath(); g.moveTo(cx + (d[0] - cx) * e, cy + (d[1] - cy) * e); g.lineTo(cx + (d[2] - cx) * e, cy + (d[3] - cy) * e); g.lineTo(cx + (d[4] - cx) * e, cy + (d[5] - cy) * e); g.closePath(); g.clip();
  const den = s[0] * (s[3] - s[5]) + s[2] * (s[5] - s[1]) + s[4] * (s[1] - s[3]);
  const a = (d[0] * (s[3] - s[5]) + d[2] * (s[5] - s[1]) + d[4] * (s[1] - s[3])) / den, b = (d[1] * (s[3] - s[5]) + d[3] * (s[5] - s[1]) + d[5] * (s[1] - s[3])) / den;
  const c = (d[0] * (s[4] - s[2]) + d[2] * (s[0] - s[4]) + d[4] * (s[2] - s[0])) / den, dd = (d[1] * (s[4] - s[2]) + d[3] * (s[0] - s[4]) + d[5] * (s[2] - s[0])) / den;
  const ex = (d[0] * (s[2] * s[5] - s[4] * s[3]) + d[2] * (s[4] * s[1] - s[0] * s[5]) + d[4] * (s[0] * s[3] - s[2] * s[1])) / den, fy = (d[1] * (s[2] * s[5] - s[4] * s[3]) + d[3] * (s[4] * s[1] - s[0] * s[5]) + d[5] * (s[0] * s[3] - s[2] * s[1])) / den;
  g.setTransform(a, b, c, dd, ex, fy); g.drawImage(img, 0, 0); g.restore();
}
export function hojaMalla(img, clave, F, campo, hpx = 280) {
  let m = MALLAS.get(img); if (!m) MALLAS.set(img, m = {}); if (m[clave]) return m[clave];
  const asp = img.width / img.height, w = hpx * asp, mg = hpx * 0.15, fw = Math.ceil(w + mg * 2), fh = Math.ceil(hpx + mg);
  const cols = Math.min(F, 6), c = document.createElement('canvas'); c.width = fw * cols; c.height = fh * Math.ceil(F / cols); const g = c.getContext('2d');
  for (let f = 0; f < F; f++) {
    const ph = f / F * Math.PI * 2, P = [], ox = (f % cols) * fw, oy = Math.floor(f / cols) * fh;
    for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) { const u = i / GX, v = j / GY, [dx, dy] = campo(u * asp, v, ph, asp); P.push(ox + mg + u * w + dx * hpx, oy + fh - hpx + v * hpx + dy * hpx); }
    g.save(); g.beginPath(); g.rect(ox, oy, fw, fh); g.clip();
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const k0 = (j * (GX + 1) + i) * 2, k1 = k0 + 2, k2 = k0 + (GX + 1) * 2, k3 = k2 + 2;
      const x0 = i / GX * img.width, x1 = (i + 1) / GX * img.width, y0 = j / GY * img.height, y1 = (j + 1) / GY * img.height;
      tri(g, img, [x0, y0, x1, y0, x0, y1], [P[k0], P[k0 + 1], P[k1], P[k1 + 1], P[k2], P[k2 + 1]]);
      tri(g, img, [x1, y0, x1, y1, x0, y1], [P[k1], P[k1 + 1], P[k3], P[k3 + 1], P[k2], P[k2 + 1]]);
    }
    g.restore();
  }
  return (m[clave] = { c, fw, fh, hpx, F, cols });
}
const sua = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// Campos de movimiento. cfg: { cuello, falda, brazos: [{ pu, pv, cu, cv, r, amp, fase }] } (u, v en fracciones del dibujo).
export function campo(cfg, modo) {
  return (X, Y, ph, asp) => {
    const pies = sua((1 - Y) / 0.12); let dx = 0, dy = 0;
    const giro = (px, py, ang, peso) => { const co = Math.cos(ang) - 1, si = Math.sin(ang); dx += ((X - px) * co - (Y - py) * si) * peso; dy += ((X - px) * si + (Y - py) * co) * peso; };
    if (modo === 'camina') {
      dy -= Math.abs(Math.sin(ph)) * 0.022 * sua((0.86 - Y) / 0.3); dx += Math.sin(ph) * 0.012 * (1 - Y);
      giro(asp / 2, cfg.cuello, Math.sin(ph + 0.8) * 0.04, sua((cfg.cuello + 0.04 - Y) / 0.08));
    } else {
      const k = modo === 'accion' ? 2 : 1;                       // la accion da dos vueltas por ciclo
      dy -= Math.sin(ph) * 0.009 * sua((0.78 - Y) / 0.4);         // respira: el torso sube y baja
      dx += Math.sin(ph + 1) * (modo === 'accion' ? 0.016 : 0.008) * Math.pow(1 - Y, 1.4);
      giro(asp / 2, cfg.cuello, Math.sin(ph * k - 0.6) * (modo === 'accion' ? 0.06 : 0.035), sua((cfg.cuello + 0.04 - Y) / 0.08));
      if (cfg.falda) dx += Math.sin(ph * k - Y * 7) * 0.011 * sua((Y - 0.58) / 0.2);
      for (const [n, b] of (cfg.brazos || []).entries()) {
        const amp = b.amp * (modo === 'accion' && n === 0 ? 3.2 : 1);
        giro(b.pu * asp, b.pv, Math.sin(ph * k + (b.fase || 0)) * amp, Math.exp(-(((X - b.cu * asp) ** 2 + (Y - b.cv) ** 2) / (b.r * b.r))));
      }
    }
    return [dx * pies, dy * pies];
  };
}
// Dibuja el cuadro f (puede ser decimal) de una hoja, con los muelles del rig encima (aplastar, inclinarse, salto, destello).
export function dibujarCuadro(x, hj, f, px, py, h, r, flip, filtro) {
  const F = hj.F || FR, cols = hj.cols || F, fi = ((Math.floor(f) % F) + F) % F, fj = (fi + 1) % F, mez = hj.cols ? f - Math.floor(f) : 0, k = h / hj.hpx;
  const sy = Math.max(0.6, Math.min(1.45, r.sy.v)), sx = 1 / Math.sqrt(sy), alto = Math.max(0, -r.dy);
  x.save(); x.globalAlpha = 0.24 * r.alpha * Math.max(0.3, 1 - alto / 120); x.fillStyle = '#000'; x.beginPath(); x.ellipse(px + r.dx, py, hj.fw * k * 0.3 * Math.max(0.5, 1 - alto / 200), hj.fw * k * 0.075, 0, 0, Math.PI * 2); x.fill(); x.restore();
  x.save(); x.translate(px + r.dx, py + r.dy); if (r.rot) x.rotate(r.rot); if (flip) x.scale(-1, 1);
  x.transform(1, 0, -(r.bend.v + r.lean.v) * 0.9, 1, 0, 0); x.scale(sx, sy);
  if (r.alpha < 1) x.globalAlpha = r.alpha;
  if (filtro || r.flash > 0.05) x.filter = (filtro || '') + (r.flash > 0.05 ? ` brightness(${1 + r.flash * 1.6}) saturate(${1 - r.flash * 0.5})` : '');
  x.drawImage(hj.c, (fi % cols) * hj.fw, Math.floor(fi / cols) * hj.fh, hj.fw, hj.fh, -hj.fw * k / 2, -hj.fh * k, hj.fw * k, hj.fh * k);
  if (mez > 0.02) { x.globalAlpha *= mez; x.drawImage(hj.c, (fj % cols) * hj.fw, Math.floor(fj / cols) * hj.fh, hj.fw, hj.fh, -hj.fw * k / 2, -hj.fh * k, hj.fw * k, hj.fh * k); }   // fundido al cuadro siguiente: se ve fluido
  x.restore();
}
