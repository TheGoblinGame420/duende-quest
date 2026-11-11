// ═══════════════════════════════════════════════════════
// DUENDE QUEST CLASSIC — skins articuladas (marionetas)
//
// Las skins de una sola imagen (assets/skins/skin_*.png) se recortan en
// piezas (cabeza, brazos, piernas, capa) con el mapa de abajo y se mueven
// como una marioneta con pivotes: respira, camina con piernas y brazos
// alternos, golpea con el brazo del arma, se encoge al recibir un golpe y
// cae al morir. No se baja nada nuevo: las piezas se recortan UNA vez del
// mismo PNG (lienzos en caché) y cada cuadro son unos pocos drawImage, sin
// crear objetos. Si la skin no tiene mapa, o su imagen cambió de tamaño, o
// el recorte falla, marioneta() devuelve null y el cliente dibuja la imagen
// de siempre.
//
// Coordenadas del mapa: píxeles de la imagen original. La figura mira a la
// derecha (el cliente la voltea). Por pieza:
//   rol   'piernaA' | 'piernaB' | 'brazoA' | 'brazoB' | 'cabeza' | 'capa' | 'cuerpo'
//         ('cuerpo' no lleva polígono: marca en qué capa va lo que queda)
//   poly  polígono plano [x0,y0, x1,y1, ...]; puede sobrar por fuera de la figura
//   piv   pivote [x, y] (la articulación)
//   r     radio de la junta redonda que la pieza lleva en el pivote (tapa el hueco al girar; 8 si falta)
//   relleno  color con que se tapa el hueco cuando la pieza va por delante del cuerpo
//   zona     polígono que limita ese relleno (solo donde de verdad hay cuerpo detrás)
//   osc   giro al caminar (rad) · golpe: giro al atacar (rad) · empuje: avance al atacar (px)
// ═══════════════════════════════════════════════════════

const ALTO_HORNO = 132;   // alto en px de la figura recortada (el doble del tamaño de juego: nítida y barata)

export const MARIONETAS = {
  skin_bruja: {
    w: 175, h: 210, tronco: [100, 160],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [74, 160], r: 9, poly: [56, 158, 93, 161, 97, 174, 92, 210, 28, 210, 28, 172] },
      { rol: 'piernaB', piv: [126, 166], r: 9, poly: [109, 165, 143, 167, 162, 186, 170, 210, 106, 210, 107, 182] },
      { rol: 'brazoB', piv: [144, 126], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [147, 113, 151, 91, 175, 87, 175, 143, 152, 143, 143, 134] },
      { rol: 'cabeza', piv: [105, 96], r: 15, poly: [50, 0, 175, 0, 175, 82, 150, 89, 134, 92, 125, 99, 104, 101, 86, 97, 74, 88, 70, 44, 66, 40, 52, 28] },
      { rol: 'brazoA', piv: [72, 98], r: 9, osc: .1, poly: [2, 8, 50, 8, 52, 28, 66, 40, 70, 44, 74, 88, 76, 100, 56, 106, 36, 100, 2, 84] },
    ],
  },
  skin_king: {
    w: 193, h: 210, tronco: [100, 168],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [74, 168], r: 10, poly: [52, 163, 98, 168, 100, 170, 97, 184, 90, 196, 88, 210, 22, 210, 22, 192, 40, 188, 48, 172] },
      { rol: 'piernaB', piv: [126, 168], r: 10, poly: [100, 168, 146, 156, 158, 180, 160, 210, 88, 210, 90, 196, 97, 184] },
      { rol: 'brazoA', piv: [36, 112], r: 10, osc: .2, poly: [18, 101, 47, 104, 52, 130, 48, 172, 40, 188, 22, 192, 22, 198, 0, 198, 0, 150, 10, 120] },
      { rol: 'cabeza', piv: [100, 118], r: 16, poly: [0, 0, 193, 0, 193, 56, 141, 58, 140, 105, 128, 120, 118, 128, 92, 128, 76, 118, 60, 104, 46, 98, 0, 96] },
      { rol: 'brazoB', piv: [136, 124], r: 10, osc: .1, golpe: -.45, empuje: 7, poly: [141, 58, 193, 58, 193, 150, 160, 158, 138, 150, 131, 128, 140, 112] },
    ],
  },
  skin_momia: {
    w: 175, h: 210, tronco: [100, 150],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [74, 148], r: 10, poly: [44, 136, 70, 140, 98, 152, 96, 170, 88, 184, 86, 210, 14, 210, 14, 170] },
      { rol: 'piernaB', piv: [118, 152], r: 10, poly: [100, 152, 132, 146, 150, 160, 165, 185, 165, 210, 86, 210, 88, 184, 96, 170] },
      { rol: 'brazoB', piv: [136, 112], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [140, 84, 175, 84, 175, 122, 150, 130, 136, 124, 130, 108] },
      { rol: 'cabeza', piv: [104, 90], r: 14, poly: [45, 0, 175, 0, 175, 82, 140, 83, 128, 91, 112, 96, 92, 92, 76, 84, 70, 70, 68, 34, 45, 31] },
      { rol: 'brazoA', piv: [70, 100], r: 9, osc: .1, poly: [2, 6, 44, 6, 45, 31, 68, 34, 70, 70, 68, 92, 74, 100, 66, 108, 46, 112, 42, 128, 22, 128, 2, 100] },
    ],
  },
  skin_frankenstein: {
    w: 175, h: 210, tronco: [95, 155],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [64, 156], r: 9, poly: [44, 152, 82, 158, 86, 172, 76, 184, 76, 210, 12, 210, 12, 172] },
      { rol: 'piernaB', piv: [120, 162], r: 9, poly: [100, 162, 138, 158, 156, 176, 165, 210, 96, 210, 96, 180] },
      { rol: 'brazoB', piv: [134, 116], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [146, 88, 160, 77, 175, 70, 175, 140, 140, 140, 130, 128, 132, 104] },
      { rol: 'cabeza', piv: [106, 96], r: 14, poly: [38, 0, 175, 0, 175, 66, 160, 77, 146, 88, 138, 90, 124, 100, 100, 102, 88, 96, 74, 84, 70, 70, 60, 62, 58, 32, 38, 29] },
      { rol: 'brazoA', piv: [58, 96], r: 9, osc: .1, poly: [2, 4, 38, 4, 38, 29, 58, 32, 60, 66, 58, 86, 62, 98, 50, 106, 30, 102, 2, 90] },
    ],
  },
  skin_vampiro: {
    w: 175, h: 210, tronco: [100, 150],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [76, 150], r: 9, poly: [50, 150, 96, 146, 100, 160, 100, 180, 88, 190, 80, 210, 28, 210, 30, 172] },
      { rol: 'piernaB', piv: [118, 154], r: 9, poly: [100, 160, 134, 146, 152, 160, 166, 186, 166, 210, 100, 210, 100, 180] },
      { rol: 'brazoB', piv: [136, 112], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [136, 90, 150, 82, 175, 78, 175, 132, 150, 134, 134, 122, 130, 104] },
      { rol: 'cabeza', piv: [106, 86], r: 13, poly: [48, 0, 175, 0, 175, 70, 150, 74, 136, 78, 128, 86, 112, 92, 96, 88, 84, 76, 80, 62, 72, 60, 69, 35, 48, 32] },
      { rol: 'brazoA', piv: [74, 92], r: 9, osc: .1, poly: [10, 4, 48, 4, 48, 32, 69, 35, 72, 60, 70, 72, 80, 86, 74, 98, 58, 104, 30, 100, 18, 84] },
    ],
  },
  skin_esqueleto: {
    w: 175, h: 210, tronco: [95, 152],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [70, 154], r: 9, poly: [50, 150, 90, 152, 92, 166, 76, 180, 76, 210, 14, 210, 16, 172, 40, 160] },
      { rol: 'piernaB', piv: [118, 158], r: 9, poly: [100, 160, 136, 152, 150, 166, 164, 186, 164, 210, 94, 210, 94, 178] },
      { rol: 'brazoB', piv: [134, 114], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [136, 90, 148, 83, 175, 68, 175, 134, 146, 134, 132, 122, 130, 106] },
      { rol: 'cabeza', piv: [104, 94], r: 14, poly: [37, 0, 175, 0, 175, 66, 148, 82, 136, 88, 124, 98, 100, 100, 84, 92, 70, 80, 62, 62, 60, 34, 37, 31] },
      { rol: 'brazoA', piv: [62, 92], r: 9, osc: .1, poly: [2, 4, 37, 4, 37, 31, 60, 34, 62, 62, 60, 76, 66, 92, 54, 102, 34, 98, 2, 92] },
    ],
  },
  skin_lobo: {
    w: 175, h: 210, tronco: [98, 150],
    piezas: [
      { rol: 'capa', piv: [60, 136], r: 7, osc: .16, poly: [16, 106, 46, 112, 60, 126, 62, 146, 32, 152, 16, 142] },
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [68, 154], r: 9, poly: [50, 150, 86, 152, 90, 166, 92, 184, 92, 210, 20, 210, 20, 176, 44, 160] },
      { rol: 'piernaB', piv: [124, 164], r: 9, poly: [102, 166, 142, 156, 152, 170, 164, 190, 164, 210, 92, 210, 92, 184] },
      { rol: 'brazoB', piv: [138, 122], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [136, 112, 148, 86, 175, 70, 175, 138, 146, 140, 132, 130] },
      { rol: 'cabeza', piv: [106, 96], r: 14, poly: [44, 0, 175, 0, 175, 68, 148, 84, 134, 92, 124, 100, 100, 102, 84, 92, 74, 80, 70, 62, 68, 35, 44, 32] },
      { rol: 'brazoA', piv: [70, 94], r: 9, osc: .1, poly: [2, 4, 44, 4, 44, 32, 68, 35, 70, 62, 68, 80, 76, 94, 66, 106, 40, 106, 10, 96, 2, 80] },
    ],
  },
  skin_pirata: {
    w: 175, h: 210, tronco: [95, 152],
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'piernaA', piv: [66, 160], r: 9, poly: [46, 160, 82, 156, 88, 166, 88, 184, 86, 210, 14, 210, 14, 178, 40, 170] },
      { rol: 'piernaB', piv: [120, 158], r: 9, poly: [92, 160, 138, 150, 152, 164, 164, 186, 164, 210, 90, 210, 90, 170] },
      { rol: 'brazoB', piv: [136, 116], r: 8, osc: .16, golpe: -.5, empuje: 7, poly: [134, 104, 148, 100, 160, 95, 175, 94, 175, 134, 148, 138, 132, 128] },
      { rol: 'cabeza', piv: [104, 94], r: 14, poly: [37, 0, 175, 0, 175, 93, 160, 95, 148, 100, 138, 90, 124, 98, 100, 100, 84, 92, 68, 80, 60, 62, 58, 33, 37, 30] },
      { rol: 'brazoA', piv: [64, 94], r: 9, osc: .1, poly: [2, 4, 37, 4, 37, 30, 58, 33, 60, 62, 68, 80, 70, 92, 62, 104, 40, 108, 18, 104, 2, 92] },
    ],
  },
  // El Táctico teclea: el teclado y las manos son una sola pieza; las piernas, cortas, van por detrás.
  skin_tactico: {
    w: 215, h: 210, tronco: [90, 180],
    piezas: [
      { rol: 'piernaA', piv: [62, 180], r: 7, osc: .5, poly: [44, 176, 78, 178, 84, 188, 86, 210, 40, 210] },
      { rol: 'piernaB', piv: [120, 192], r: 6, osc: .5, poly: [102, 192, 140, 190, 146, 210, 100, 210] },
      { rol: 'cuerpo' },
      { rol: 'cabeza', piv: [100, 100], r: 12, poly: [26, 8, 205, 8, 205, 76, 152, 82, 150, 96, 136, 106, 112, 112, 88, 106, 72, 96, 62, 84, 50, 74, 26, 60] },
      { rol: 'brazoB', piv: [90, 160], r: 0, relleno: '#0e2014', zona: [74, 124, 138, 124, 138, 188, 74, 188], osc: .05, golpe: -.22, empuje: 6, poly: [86, 150, 100, 140, 140, 124, 180, 126, 215, 138, 215, 166, 150, 200, 108, 200, 74, 178, 74, 166] },
    ],
  },
  // Espectros: no tienen piernas, flotan; se mueven sus zarcillos, el orbe y la espada.
  skin_necromancer: {
    w: 221, h: 210, tronco: [110, 150], flota: true,
    piezas: [
      { rol: 'capa', piv: [70, 160], r: 0, osc: .05, poly: [0, 70, 60, 70, 86, 130, 92, 180, 70, 210, 0, 210] },
      { rol: 'capa', piv: [160, 205], r: 0, osc: .05, poly: [136, 118, 221, 118, 221, 210, 120, 210, 126, 160] },
      { rol: 'cuerpo' },
      { rol: 'capa', piv: [150, 62], r: 0, osc: .06, golpe: .3, poly: [110, 0, 221, 0, 221, 62, 150, 62, 120, 30] },
    ],
  },
  skin_legendariafull: {
    w: 316, h: 210, tronco: [200, 200], flota: true,
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'brazoB', piv: [250, 140], r: 0, osc: .1, poly: [240, 70, 316, 70, 316, 180, 240, 180] },
      { rol: 'brazoA', piv: [150, 165], r: 0, osc: .05, golpe: 1.5, poly: [0, 0, 90, 0, 118, 100, 130, 128, 150, 160, 160, 176, 140, 180, 100, 130, 30, 110, 0, 60] },
    ],
  },
  // El Berserker va de toga: no se le ven las piernas; avanza a saltitos, mazo en alto.
  skin_berserker: {
    w: 317, h: 210, tronco: [160, 190], paso: 1.3,
    piezas: [
      { rol: 'cuerpo' },
      { rol: 'brazoB', piv: [240, 150], r: 8, relleno: '#1a0626', osc: .12, poly: [234, 128, 272, 128, 272, 168, 240, 170, 232, 150] },
      { rol: 'cabeza', piv: [160, 104], r: 12, poly: [120, 0, 208, 0, 208, 40, 220, 40, 220, 58, 200, 62, 202, 96, 190, 106, 178, 104, 166, 112, 150, 112, 140, 104, 128, 106, 118, 96, 120, 62, 100, 58, 100, 40, 120, 40] },
      { rol: 'brazoA', piv: [96, 134], r: 8, relleno: '#1a0626', zona: [62, 106, 100, 106, 100, 158, 70, 152], osc: .1, golpe: 1.2, poly: [34, 62, 84, 50, 99, 78, 98, 112, 100, 140, 96, 156, 72, 150, 64, 122, 70, 106, 44, 102] },
    ],
  },
};

const _hechas = new Map();
const _estado = new WeakMap();

// Devuelve la marioneta lista de una skin (o null: dibuja la imagen fija).
export function marioneta(k, img) {
  let m = _hechas.get(k);
  if (m !== undefined) return m;
  const def = MARIONETAS[k];
  if (!def) { _hechas.set(k, null); return null; }
  if (!img || !img.naturalWidth) return null;   // aún bajando: se reintenta
  m = null;
  try { if (img.naturalWidth === def.w && img.naturalHeight === def.h) m = hornear(def, img); } catch (e) { m = null; }
  _hechas.set(k, m);
  return m;
}

function trazar(x, poly) {
  x.beginPath();
  x.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) x.lineTo(poly[i], poly[i + 1]);
  x.closePath();
}
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function hornear(def, img) {
  const s = ALTO_HORNO / def.h;
  const W = Math.ceil(def.w * s), H = Math.ceil(def.h * s);
  const cuerpo = lienzo(W, H), cx = cuerpo.getContext('2d');
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.setTransform(s, 0, 0, s, 0, 0);
  cx.drawImage(img, 0, 0);
  const tmp = lienzo(W, H), tx = tmp.getContext('2d');
  tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
  const piezas = [];
  for (const d of def.piezas) {
    if (d.rol === 'cuerpo') { piezas.push({ rol: 'cuerpo', c: cuerpo, x0: 0, y0: 0, w: def.w, h: def.h, px: 0, py: 0, osc: 0, golpe: 0, empuje: 0, fase: 0, tronco: true }); continue; }
    const p = d.poly;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    const r = d.r != null ? d.r : 8;
    x0 = Math.min(x0, d.piv[0] - r); x1 = Math.max(x1, d.piv[0] + r); y0 = Math.min(y0, d.piv[1] - r); y1 = Math.max(y1, d.piv[1] + r);
    x0 = Math.max(0, Math.floor(x0) - 2); y0 = Math.max(0, Math.floor(y0) - 2); x1 = Math.min(def.w, Math.ceil(x1) + 2); y1 = Math.min(def.h, Math.ceil(y1) + 2);
    // La pieza: el polígono un pelo más gordo que su hueco (en reposo no se ve la costura) más un
    // disco en el pivote: la junta redonda gira sobre sí misma y nunca deja hueco.
    const c = lienzo(Math.max(1, Math.ceil((x1 - x0) * s)), Math.max(1, Math.ceil((y1 - y0) * s))), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    trazar(x, p); x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineWidth = 3; x.lineJoin = 'round'; x.fill(); x.stroke();
    if (r > 0) { x.beginPath(); x.arc(d.piv[0], d.piv[1], r, 0, Math.PI * 2); x.fill(); }
    x.globalCompositeOperation = 'source-in';
    x.drawImage(img, 0, 0);
    // El hueco en el cuerpo.
    cx.globalCompositeOperation = 'destination-out';
    trazar(cx, p); cx.lineWidth = 1.6; cx.lineJoin = 'round'; cx.fill(); cx.stroke();   /* con borde: no queda hilo entre dos piezas vecinas */
    cx.globalCompositeOperation = 'source-over';
    if (d.relleno) {
      // Pieza por delante del cuerpo: debajo queda su silueta en el color de la ropa.
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H);
      tx.setTransform(s, 0, 0, s, 0, 0);
      tx.save(); trazar(tx, p); tx.clip(); if (d.zona) { trazar(tx, d.zona); tx.clip(); } tx.drawImage(img, 0, 0); tx.restore();
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = d.relleno; tx.fillRect(0, 0, def.w, def.h);
      cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'destination-over'; cx.drawImage(tmp, 0, 0); cx.restore();
    }
    const pierna = d.rol === 'piernaA' || d.rol === 'piernaB', brazo = d.rol === 'brazoA' || d.rol === 'brazoB';
    piezas.push({
      rol: d.rol, c, x0, y0, w: x1 - x0, h: y1 - y0, px: d.piv[0], py: d.piv[1],
      osc: d.osc != null ? d.osc : pierna ? .4 : brazo ? .2 : d.rol === 'capa' ? .07 : 0,
      golpe: d.golpe || 0, empuje: d.empuje || 0,
      fase: d.fase != null ? d.fase : d.rol === 'piernaA' || d.rol === 'brazoB' ? 1 : -1,
      tronco: !pierna,
    });
  }
  // Bajo la junta de las piezas que van por delante, el cuerpo conserva lo suyo (un disco algo
  // menor que el de la pieza): si el tronco se inclina un pelo, no se transparenta.
  let delante = false;
  for (const d of def.piezas) {
    if (d.rol === 'cuerpo') { delante = true; continue; }
    const r = (d.r != null ? d.r : 8) - 2;
    if (!delante || r <= 0) continue;
    cx.save();
    cx.beginPath(); cx.arc(d.piv[0], d.piv[1], r, 0, Math.PI * 2); cx.clip();
    trazar(cx, d.poly); cx.clip();
    cx.drawImage(img, 0, 0);
    cx.restore();
  }
  return { piezas, w: def.w, h: def.h, cx: def.cx != null ? def.cx : def.w / 2, tx: def.tronco[0], ty: def.tronco[1], flota: !!def.flota, lomo: def.lomo != null ? def.lomo : .44, paso: def.paso != null ? def.paso : 1 };
}

// Estado por duende (mezcla reposo/caminar y momento de la caída). Un objeto
// por jugador, creado una sola vez; se suelta solo cuando el jugador se va.
function estadoDe(q, muerto, t) {
  let e = _estado.get(q);
  if (!e) { e = { anda: 0, tm: muerto ? t - 999 : -1 };   /* si ya estaba muerto al verlo, aparece tendido */ _estado.set(q, e); }
  if (muerto) { if (e.tm < 0) e.tm = t; }
  else e.tm = -1;
  return e;
}

// Cuadros que lleva muerto un duende (−1 si está vivo). Lo usa también el cliente
// para la caída de las skins de hoja animada. Hay que llamarlo cada cuadro.
export function tiempoMuerto(q, muerto, t) {
  const e = estadoDe(q, muerto, t);
  return muerto ? t - e.tm : -1;
}

// Curva del golpe: k de 0 a 1 → toma impulso (−1), descarga (+1) y vuelve a 0.
function curvaGolpe(k) {
  if (k < .22) return -(k / .22);
  if (k < .45) return -1 + 2 * (k - .22) / .23;
  return 1 - (k - .45) / .55;
}

// Dibuja la marioneta con los pies en el origen del lienzo (el cliente ya
// hizo translate a los pies y el volteo). alto: alto en pantalla de la figura
// entera. t: contador de cuadros del juego. anda/aire/herido/muerto: estado.
// atk: 0 si no ataca; si ataca, de 1 (empieza) hacia 0 (termina).
// Devuelve cuánto ha caído (0 vivo … 1 tumbado) para que el cliente lo atenúe.
export function dibujarMarioneta(g, m, q, alto, t, anda, aire, atk, herido, muerto) {
  const e = estadoDe(q, muerto, t);
  e.anda += ((anda && !muerto ? 1 : 0) - e.anda) * .22;
  const A = e.anda < .01 ? 0 : e.anda;
  const E = alto / m.h;
  const ph = t * .26, sn = Math.sin(ph), cs = Math.cos(ph);
  const resp = Math.sin(t * .06);
  const gk = atk > 0 ? curvaGolpe(1 - atk) : 0;
  let cae = 0;
  if (muerto) { cae = Math.min(1, (t - e.tm) / 26); cae = cae * cae * (3 - 2 * cae); }
  const duele = herido && !muerto ? 1 : 0;
  // Figura entera: sube y baja al andar, flota si no tiene piernas, se tumba al morir.
  let dy = -Math.abs(sn) * 5 * A * m.paso;
  if (m.flota) dy = -6 + Math.sin(t * .05) * 4;
  if (aire) dy = 0;
  g.save();
  g.imageSmoothingEnabled = true;
  if (muerto) g.globalAlpha = 1 - cae * .55;   /* cae a la vista y luego se apaga */
  if (cae) { g.translate(-cae * alto * .15, -cae * m.w * E * m.lomo); g.rotate(-cae * 1.5); }
  else if (gk) g.translate(gk * 4 * E, 0);
  g.translate(-m.cx * E, -m.h * E + dy * E);
  g.scale(E, E);
  // Tronco (cuerpo, cabeza, brazos, capa): se inclina y respira sobre la cadera.
  const incl = A * (m.flota ? .1 : .05) + gk * (gk > 0 ? .13 : .07) - duele * .16 + (aire ? .05 : 0);
  const sy = 1 + resp * .012 * (1 - A), sx = 1 - resp * .006 * (1 - A);
  const ps = m.piezas;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    let rot = 0, mx = 0, my = 0;
    switch (p.rol) {
      case 'piernaA': case 'piernaB': {
        const s1 = sn * p.fase;
        rot = -s1 * p.osc * A;
        my = -Math.max(0, cs * p.fase) * 7 * A;   // el pie que avanza se levanta
        if (aire) rot = p.fase * .32;
        if (cae) rot = p.fase * .2 * cae;
        break;
      }
      case 'brazoA': case 'brazoB':
        rot = -sn * p.fase * p.osc * A + resp * .035 * p.fase * (1 - A);
        if (p.golpe) { rot += (gk < 0 ? gk * .35 : gk) * p.golpe; mx = Math.max(0, gk) * p.empuje; }   /* toma poco impulso y descarga entero */
        else if (gk) rot += gk * .12 * p.fase;
        if (aire) rot -= p.fase * .18;
        if (duele) rot += p.fase * .3;
        if (cae) rot += p.fase * .35 * cae;
        break;
      case 'cabeza':
        rot = Math.sin(t * .045) * .03 * (1 - A) + Math.sin(ph * 2) * .025 * A - duele * .14 + gk * .05 + cae * .2;
        my = Math.abs(cs) * 1.5 * A;
        break;
      case 'capa':
        rot = Math.sin(t * .05 + i * 1.7) * .035 + (sn * p.osc + .08) * A * (i & 1 ? -1 : 1) + gk * (p.golpe || -.1) + duele * .12;
        break;
    }
    g.save();
    if (p.tronco) { g.translate(m.tx, m.ty); g.rotate(incl); g.scale(sx, sy); g.translate(-m.tx, -m.ty); }
    if (p.rol === 'cuerpo') g.drawImage(p.c, 0, 0, p.w, p.h);
    else {
      g.translate(p.px + mx, p.py + my);
      g.rotate(rot);
      g.drawImage(p.c, p.x0 - p.px, p.y0 - p.py, p.w, p.h);
    }
    g.restore();
  }
  g.restore();
  return cae;
}
