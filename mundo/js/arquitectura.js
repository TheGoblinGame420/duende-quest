// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — arquitectura «medieval místico realista»
//
// 1) vestirKit(): al material de las piezas construidas del kit (casas, puestos,
//    fuente, torres) le pone UNA textura procedural compartida (R sillares con
//    juntas, G tablas con veta, B tejas, A manchas) proyectada por la cara, sin
//    UV. La marca `tinte` de cada pieza dice que es: 2 tejado, 3 piedra,
//    4 entramado con yeso, 5 vidriera (luz calida de noche), 6 puerta, 7 brasa,
//    8 monolito (piedra de una pieza, sin juntas).
// 2) crearObra(): lo construido nuevo, fundido en UNA malla con ese material:
//    portal de mazmorras con arco de dovelas, menhires, murete en ruinas, arcos
//    de entrada con estandartes, antorchas y basas de los hitos. Aparte, runas
//    (1 dibujo), llamas y halos (1), humo de chimeneas (1) y la plaza (1).
// Nada de luces dinamicas: emisivo y puntos aditivos. animarObra() cada cuadro.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

export const OBRA_FX = { uObraTex: { value: null }, uObraNoche: { value: 0 }, uObraT: { value: 0 }, uObraPx: { value: 720 } };

const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
// Ruido de valor que cierra en el borde (periodo p).
function ruido(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (i, j) => rnd(((i % p) + p) % p, ((j % p) + p) % p + 17.3);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Textura de obra: 0,625 = neutro (el shader multiplica por 1,6).
function texturaObra(N) {
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, o = (y * N + x) * 4;
    const man = ruido(u * 4, v * 4, 4) * 0.55 + ruido(u * 8, v * 8, 8) * 0.3 + ruido(u * 16, v * 16, 16) * 0.15;
    const grano = ruido(u * 64, v * 64, 64);
    // Sillares: 8 hiladas, 4 piedras por hilada con el corte corrido y anchos desiguales.
    let fila = Math.floor(v * 8), fy = v * 8 - fila, bx = u * 4 + rnd(fila, 3) * 4, bi = Math.floor(bx), fxb = bx - bi;
    const corte = 0.5 + (rnd(fila, bi % 4 + 9) - 0.5) * 0.5;
    const dj = Math.min(fxb < corte ? Math.min(fxb, corte - fxb) : Math.min(fxb - corte, 1 - fxb), Math.min(fy, 1 - fy) * 0.5) * (N / 4);
    const pid = rnd(fila * 7 + (fxb < corte ? 1 : 2), bi % 4);
    const pied = (0.38 + (0.44 + pid * 0.42 + (grano - 0.5) * 0.14 + (man - 0.5) * 0.2 - 0.38) * suave(0.4, N / 90, dj)) / 1.6;
    // Tablas verticales: 4 por baldosa, veta larga y rendija oscura.
    const tx = u * 4, ti = Math.floor(tx), ftx = tx - ti;
    const veta = ruido(u * 48 + ti * 5, v * 3, 3) * 0.6 + ruido(u * 96, v * 6, 6) * 0.4;
    const tabl = (0.42 + (0.5 + rnd(ti, 5) * 0.22 + (veta - 0.5) * 0.42 - 0.42) * suave(0, 0.05, Math.min(ftx, 1 - ftx))) / 1.6;
    // Tejas: 8 hiladas a tresbolillo, cada una mas clara abajo y con sombra bajo la de arriba.
    const tf = Math.floor(v * 8), tfy = v * 8 - tf, tjx = u * 8 + (tf % 2) * 0.5, tj = Math.floor(tjx), ftj = tjx - tj;
    const curva = 1 - Math.pow(Math.abs(ftj - 0.5) * 2, 2.2);
    const teja = (0.36 + (0.42 + (1 - tfy) * 0.28 + rnd(tf, tj % 8 + 2) * 0.24 + curva * 0.12 - 0.36) * suave(0, 0.07, Math.min(ftj, 1 - ftj)) * suave(0, 0.12, 1 - tfy)) / 1.6;
    d[o] = pied * 255; d[o + 1] = tabl * 255; d[o + 2] = teja * 255; d[o + 3] = man * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// Encadena el shader de obra al material del kit. Llamar ANTES del primer dibujo.
export function vestirKit(material, tam) {
  OBRA_FX.uObraTex.value = texturaObra(tam || 256);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    for (const k in OBRA_FX) sh.uniforms[k] = OBRA_FX[k];
    sh.vertexShader = 'varying vec3 vObraW;\nvarying float vObraT;\nvarying float vObraY;\n' + sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
      vec4 obW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        obW = instanceMatrix * obW;
      #endif
      vObraW = (modelMatrix * obW).xyz; vObraT = tinte; vObraY = position.y * length(modelMatrix[1].xyz);`);
    sh.fragmentShader = 'uniform sampler2D uObraTex;\nuniform float uObraNoche;\nuniform float uObraT;\nvarying vec3 vObraW;\nvarying float vObraT;\nvarying float vObraY;\nvec3 obraLuz = vec3(0.0);\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 oN = normalize(cross(dFdx(vObraW), dFdy(vObraW)));
        float oAy = abs(oN.y);
        vec2 oUV = vObraW.xz;
        if (oAy < 0.9) oUV = vec2(dot(vObraW.xz, normalize(vec2(-oN.z, oN.x) + 1e-5)), vObraW.y);
        vec4 oD = texture2D(uObraTex, oUV * 0.42);
        float oP = oD.r * 1.6, oM = oD.g * 1.6, oJ = oD.b * 1.6, oA = oD.a;
        vec3 c = diffuseColor.rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float calido = step(c.b * 1.35, c.r) * step(c.b, c.g * 1.02);
        float t = vObraT;
        vec3 piedra = vec3(0.36, 0.345, 0.315) * oP * (0.78 + 0.6 * lum);
        vec3 lena = vec3(0.15, 0.092, 0.058) * oM * (0.55 + 1.7 * lum);
        float musgo = smoothstep(0.5, 0.72, oA) * (1.0 - smoothstep(0.15, 1.7, vObraY)) * 0.65;
        if (t > 7.5) c = mix(vec3(0.36, 0.345, 0.315) * (0.6 + 0.75 * oA) * mix(1.0, oP, 0.22) * (0.78 + 0.6 * lum), vec3(0.05, 0.09, 0.03), musgo);
        else if (t > 6.5) { obraLuz = c * 2.2; c *= 0.3; }
        else if (t > 5.5) c = calido > 0.5 ? lena : piedra;
        else if (t > 4.5) {
          vec2 g = fract(oUV * vec2(6.5, 5.0));
          float plomo = step(0.14, g.x) * step(0.14, g.y);
          float luz = uObraNoche * plomo * (0.86 + 0.14 * sin(uObraT * 2.3 + vObraW.x * 3.1 + vObraW.z * 1.7));
          obraLuz = c * luz * 1.15;
          c = mix(vec3(0.035, 0.045, 0.06) * (0.6 + 0.8 * oA), c * 0.25, uObraNoche) * plomo;
        }
        else if (t > 1.5 && t < 2.5 && oAy > 0.15) {
          float paja = step(0.4, c.g / max(c.r, 1e-4));
          c = mix(vec3(lum), c, 0.72) * mix(0.8 * oJ, 0.62 * (0.55 + 0.45 * oM) * (0.8 + 0.4 * oA), paja);
          c = mix(c, vec3(0.05, 0.085, 0.03), smoothstep(0.6, 0.8, oA) * 0.6);
        }
        else if (t > 2.5 && t < 3.5) {
          c = (calido > 0.5 && lum < 0.2) ? lena : piedra;
          c = mix(c, vec3(0.05, 0.09, 0.03) * (0.7 + 0.6 * oP), musgo);
        }
        else if (t > 1.5) {
          if (calido > 0.5 && lum < 0.22) c = vec3(0.115, 0.072, 0.046) * oM;
          else if (calido > 0.5 || lum > 0.5) c = vec3(0.56, 0.5, 0.39) * (0.74 + 0.42 * oA) * (0.92 + 0.08 * oP);
          else c = piedra;
        }
        else {
          float mx = max(c.r, max(c.g, c.b)), sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 1e-4);
          if (calido > 0.5 && sat > 0.3) c = mix(vec3(lum), c, 0.7) * 0.5 * oM;
          else if (sat < 0.34) c = mix(vec3(lum) * vec3(0.6, 0.585, 0.55) * mix(1.0, oP, 0.7), vec3(0.05, 0.09, 0.03), musgo * 0.6);
          else if (c.b < c.g * 1.1 || c.r > c.b) c = mix(vec3(lum), c, 0.62) * 0.62 * (0.8 + 0.3 * oA);
        }
        if (t > 1.5 && t < 4.5 || t > 5.5 && t < 6.5 || t > 7.5) obraLuz += c * 0.07 * uObraNoche;   // de noche la piedra no se queda en negro
        diffuseColor.rgb = c;
      }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += obraLuz;');
  };
  material.customProgramCacheKey = () => 'tapa-kenney-obra';
}

// Geometria de three con color y marca, lista para KIT.fundir().
const tc = new THREE.Color();
function prim(geo, color, t) {
  const n = geo.attributes.position.count, c = new Float32Array(n * 3), ti = new Float32Array(n).fill(t == null ? 3 : t);
  tc.set(color); for (let i = 0; i < n; i++) { c[i * 3] = tc.r; c[i * 3 + 1] = tc.g; c[i * 3 + 2] = tc.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('tinte', new THREE.BufferAttribute(ti, 1));
  if (!geo.index) geo.setIndex([...Array(n).keys()]);
  return geo;
}
const GRIS = ['#8f8a80', '#7d786f', '#9a958a', '#84807a'];

// Atlas de 8 runas propias (trazos al azar sobre una rejilla), blanco sobre negro.
function atlasRunas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 32);
  x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.lineCap = 'round'; x.shadowColor = '#fff'; x.shadowBlur = 3;
  for (let g = 0; g < 8; g++) {
    const p = (i, j) => [g * 32 + 9 + i * 7, 5 + j * 7.3];
    x.beginPath(); x.moveTo(...p(1, 0)); x.lineTo(...p(1, 3));
    for (let k = 0; k < 3; k++) { const a = p(Math.floor(rnd(g, k) * 3), Math.floor(rnd(g, k + 5) * 4)), b = p(Math.floor(rnd(g, k + 11) * 3), Math.floor(rnd(g, k + 17) * 4)); x.moveTo(...a); x.lineTo(...b); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Empedrado de la plaza (color): adoquines desiguales con junta oscura y algo de musgo.
function texturaPlaza(N) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data, G = 8;
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const u = px / N * G, v = py / N * G, ci = Math.floor(u), cj = Math.floor(v);
    let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = ((ci + i) % G + G) % G, b = ((cj + j) % G + G) % G, qx = ci + i + 0.2 + rnd(a, b) * 0.6, qy = cj + j + 0.2 + rnd(a + 31, b) * 0.6, dd = Math.hypot(u - qx, v - qy);
      if (dd < d1) { d2 = d1; d1 = dd; id = rnd(a + 7, b + 3); } else if (dd < d2) d2 = dd;
    }
    const junta = suave(0.03, 0.16, d2 - d1), man = ruido(px / N * 4, py / N * 4, 4), k = (0.2 + (0.2 + id * 0.24 + man * 0.16) * junta), mus = (1 - junta) * suave(0.45, 0.7, man), o = (py * N + px) * 4;
    d[o] = 255 * (k * 0.98 * (1 - mus) + 0.2 * mus); d[o + 1] = 255 * (k * 0.95 * (1 - mus) + 0.27 * mus); d[o + 2] = 255 * (k * 0.88 * (1 - mus) + 0.13 * mus); d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

let runasMat = null, llamas = null, humo = null;

// ctx: { escena, KIT, alturaEn, enCamino, ponerSolido, CASAS, CAMINOS, evitar:[{x,z,r}], portal:{x,z}, arena:{x,z,r}, hitos:[{x,z}], nivel, sombras }
export function crearObra(ctx) {
  const { escena, KIT, alturaEn, ponerSolido, CASAS } = ctx, baja = ctx.nivel === 'minima' || ctx.nivel === 'baja';
  const P = [];                                   // piezas para fundir
  const R = { p: [], c: [], uv: [], i: [] };      // runas
  const L = { p: [], a: [] };                     // llamas y halos: aDat = (tam, fase, tipo)
  const H = { p: [], a: [] };                     // humo
  const caja = (x, y, z, sx, sy, sz, color, o) => P.push({ geo: prim(new THREE.BoxGeometry(sx, sy, sz), color, o && o.t), x, y, z, ry: o && o.ry, rx: o && o.rx, rz: o && o.rz });
  // Runa: cuadro vertical mirando a (nx, nz).
  const runa = (x, y, z, nx, nz, w, h, color, k) => {
    const n = R.p.length / 3, tx = -nz * w / 2, tz = nx * w / 2; tc.set(color);
    x += nx * 0.04; z += nz * 0.04;
    R.p.push(x - tx, y - h / 2, z - tz, x + tx, y - h / 2, z + tz, x + tx, y + h / 2, z + tz, x - tx, y + h / 2, z - tz);
    for (let j = 0; j < 4; j++) R.c.push(tc.r, tc.g, tc.b);
    const u0 = (k % 8) / 8; R.uv.push(u0, 0, u0 + 0.125, 0, u0 + 0.125, 1, u0, 1);
    R.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const llama = (x, y, z, tam) => { const f = rnd(x, z) * 6.28; L.p.push(x, y, z, x, y + 0.05, z); L.a.push(tam, f, 0, tam * 6, f, 1); };
  // Antorcha de pie o de pared: palo, copa de hierro y brasa (la brasa lleva marca 7: brilla sola).
  const antorcha = (x, y, z, alto) => {
    caja(x, y + alto / 2, z, 0.09, alto, 0.09, '#5a3a22', { t: 6 });
    P.push({ geo: prim(new THREE.CylinderGeometry(0.17, 0.09, 0.24, 6), '#3d3d44', 0), x, y: y + alto + 0.1, z });
    P.push({ geo: prim(new THREE.ConeGeometry(0.13, 0.3, 5), '#ff9a3c', 7), x, y: y + alto + 0.34, z });
    llama(x, y + alto + 0.42, z, 0.55);
  };

  // ── Portal de las mazmorras: pilares con basa y capitel, arco de dovelas, timpano, contrafuertes y braseros ──
  {
    const { x: px, z: pz } = ctx.portal, py = alturaEn(px, pz), VIO = '#b06cff';
    for (const s of [-1, 1]) {
      const x = px + s * 2.2;
      caja(x, py + 0.35, pz, 1.7, 0.9, 1.7, GRIS[1]); caja(x, py + 3.1, pz, 1.1, 5.4, 1.15, GRIS[0]); caja(x, py + 5.85, pz, 1.5, 0.5, 1.5, GRIS[2]);
      caja(x + s * 1.25, py + 2.2, pz, 1.3, 4.6, 1.5, GRIS[3]); caja(x + s * 1.25, py + 4.75, pz, 1.3, 0.9, 1.5, GRIS[1], { rz: s * 0.5 });
      caja(x + s * 2.35, py + 1.1, pz, 1.1, 2.4, 1.3, GRIS[0]); caja(x + s * 2.35, py + 2.42, pz, 1.35, 0.26, 1.5, GRIS[2]);
      P.push({ geo: prim(new THREE.CylinderGeometry(0.5, 0.28, 0.36, 7), '#3d3d44', 0), x: x + s * 2.35, y: py + 2.72, z: pz });
      P.push({ geo: prim(new THREE.ConeGeometry(0.34, 0.5, 6), '#ff9a3c', 7), x: x + s * 2.35, y: py + 3.1, z: pz });
      llama(x + s * 2.35, py + 3.25, pz, 0.95);
      for (const f of [-1, 1]) for (let k = 0; k < 3; k++) runa(x, py + 1.7 + k * 1.3, pz + f * 0.58, 0, f, 0.5, 0.8, VIO, k + (s > 0 ? 3 : 0) + (f > 0 ? 1 : 0));
    }
    // Dovelas: 9 piedras en medio punto; la clave, mas grande.
    for (let k = 0; k < 9; k++) {
      const a = (k + 0.5) / 9 * Math.PI, clave = k === 4, r = 2.55 + (clave ? 0.12 : 0);
      caja(px + Math.cos(a) * r, py + 6.0 + Math.sin(a) * r, pz, clave ? 1.25 : 1.0, clave ? 1.15 : 0.95, clave ? 1.5 : 1.3, GRIS[k % 4], { rz: a - Math.PI / 2 });
    }
    P.push({ geo: prim(new THREE.CylinderGeometry(2.1, 2.1, 0.5, 14, 1, false, 0, Math.PI), GRIS[1]), x: px, y: py + 6.0, z: pz, rx: Math.PI / 2, ry: Math.PI / 2 });
    for (const f of [-1, 1]) { runa(px, py + 6.95, pz + f * 0.26, 0, f, 1.1, 1.5, VIO, 7); runa(px - 1.05, py + 6.55, pz + f * 0.26, 0, f, 0.5, 0.75, VIO, 2); runa(px + 1.05, py + 6.55, pz + f * 0.26, 0, f, 0.5, 0.75, VIO, 5); }
  }

  // ── Menhires del Claro del Titan: piedras talladas a golpes, con runa por dentro y por fuera ──
  if (ctx.arena) {
    const A = ctx.arena;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, x = A.x + Math.cos(a) * A.r, z = A.z + Math.sin(a) * A.r, alto = 4 + (i % 3) * 1.2, y = alturaEn(x, z);
      const g = new THREE.CylinderGeometry(0.42, 0.8, alto, 6, 3), q = g.attributes.position;
      for (let v = 0; v < q.count; v++) { const k = 1 + (rnd(Math.round(q.getX(v) * 9) + i, Math.round(q.getY(v) * 7 + q.getZ(v) * 5)) - 0.5) * 0.3; q.setX(v, q.getX(v) * k); q.setZ(v, q.getZ(v) * k); }
      P.push({ geo: prim(g, GRIS[i % 4], 8), x, y: y + alto / 2 - 0.3, z, ry: -a + Math.PI / 2, sx: 1.25, sz: 0.8, rz: i % 2 ? 0.06 : -0.05 });
      runa(x - Math.cos(a) * 0.52, y + alto * 0.5, z - Math.sin(a) * 0.52, -Math.cos(a), -Math.sin(a), 0.62, 1.0, '#ff7a3d', i);
      runa(x + Math.cos(a) * 0.52, y + alto * 0.5, z + Math.sin(a) * 0.52, Math.cos(a), Math.sin(a), 0.62, 1.0, '#ff7a3d', i + 3);
      if (i % 4 === 1) caja(x + Math.cos(a) * 2.2, y + 0.25, z + Math.sin(a) * 2.2, 2.6, 0.7, 0.9, GRIS[(i + 1) % 4], { ry: a * 3, rz: 0.08 });
    }
  }

  // ── Hitos de zona: basa escalonada y runas en el obelisco ──
  for (const h of ctx.hitos || []) {
    const y = alturaEn(h.x, h.z);
    P.push({ geo: prim(new THREE.CylinderGeometry(1.5, 1.7, 0.4, 6), GRIS[1]), x: h.x, y: y + 0.1, z: h.z });
    P.push({ geo: prim(new THREE.CylinderGeometry(1.15, 1.25, 0.35, 6), GRIS[2]), x: h.x, y: y + 0.45, z: h.z, ry: 0.5 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; runa(h.x + Math.cos(a) * 0.74, y + 1.9, h.z + Math.sin(a) * 0.74, Math.cos(a), Math.sin(a), 0.5, 0.8, '#7dd3fc', k + 2); }
  }

  // ── Pueblo ──
  const evitar = ctx.evitar || [];
  const libre = (x, z, m) => !evitar.some(e => Math.hypot(e.x - x, e.z - z) < e.r + (m || 0)) && !CASAS.some(c => Math.hypot(c.x - x, c.z - z) < Math.max(c.w, c.d) * 0.72 + 1.5 + (m || 0));
  const RM = 32.5;
  // Arcos de entrada donde los caminos salen del pueblo: dos pilares, viga, tejadillo, estandarte y antorchas.
  const arcos = [];
  for (const [, , cx, cz] of ctx.CAMINOS || []) {
    const a = Math.atan2(cz, cx), x = Math.cos(a) * RM, z = Math.sin(a) * RM;
    const tx0 = -Math.sin(a) * 3.5, tz0 = Math.cos(a) * 3.5;
    if (arcos.some(o => Math.hypot(o.x - x, o.z - z) < 14) || !libre(x, z, 0) || !libre(x + tx0, z + tz0, -1) || !libre(x - tx0, z - tz0, -1)) continue;
    arcos.push({ x, z, a });
    const y = alturaEn(x, z), tx = -Math.sin(a), tz = Math.cos(a), ry = -a, n = arcos.length;
    for (const s of [-1, 1]) {
      const qx = x + tx * s * 3.5, qz = z + tz * s * 3.5;
      caja(qx, y + 0.3, qz, 1.6, 0.8, 1.6, GRIS[1], { ry }); caja(qx, y + 2.6, qz, 1.1, 4.4, 1.1, GRIS[(n + s + 4) % 4], { ry }); caja(qx, y + 4.95, qz, 1.4, 0.4, 1.4, GRIS[2], { ry });
      ponerSolido(qx, qz, 0.75);
      antorcha(qx - Math.cos(a) * 0.72, y + 1.5, qz - Math.sin(a) * 0.72, 1.3);
      runa(qx + Math.cos(a) * 0.56, y + 2.4, qz + Math.sin(a) * 0.56, Math.cos(a), Math.sin(a), 0.45, 0.72, '#b06cff', n + (s > 0 ? 4 : 0));
    }
    caja(x, y + 5.4, z, 0.55, 0.5, 8.6, '#5a3a22', { ry, t: 6 }); caja(x, y + 5.95, z, 0.4, 0.6, 0.4, '#5a3a22', { ry, t: 6 });
    for (const s of [-1, 1]) P.push({ geo: prim(new THREE.BoxGeometry(1.3, 0.12, 9.2), '#8a3b24', 2), x: x + Math.cos(a) * s * 0.5, y: y + 6.05, z: z + Math.sin(a) * s * 0.5, ry, rz: -s * 0.62 });
    // Estandarte colgado de la viga, con la punta en pico.
    const tela = new THREE.BufferGeometry().setFromPoints([[-0.55, 0], [0.55, 0], [0.55, -1.7], [0, -2.25], [-0.55, -1.7]].map(([u, v]) => new THREE.Vector3(0, v, u)));
    tela.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3, 2, 1, 0, 4, 2, 0, 3, 2, 4]);
    for (const s of [-1, 1]) P.push({ geo: prim(tela.clone(), n % 2 ? '#5b2a86' : '#8a2338', 1), x: x + tx * s * 1.7, y: y + 5.15, z: z + tz * s * 1.7, ry });
  }
  // Murete bajo en ruinas en el borde del pueblo: tramos sueltos, nunca sobre un camino ni pegado a nadie.
  const paso = 2.9 / RM;
  for (let k = 0, a = 0.05; a < Math.PI * 2; a += paso, k++) {
    if (Math.sin(a * 5 + 1) + Math.sin(a * 11) < -0.35) continue;
    const x = Math.cos(a) * RM, z = Math.sin(a) * RM;
    if (ctx.enCamino(x, z) < 6.5 || !libre(x, z, 1.5) || arcos.some(o => Math.hypot(o.x - x, o.z - z) < 6.5)) continue;
    const y = alturaEn(x, z), alto = 0.85 + rnd(k, 1) * 0.6, ry = -a, tx = -Math.sin(a), tz = Math.cos(a);
    caja(x, y + alto / 2 - 0.1, z, 0.75, alto + 0.2, 2.95, GRIS[k % 4], { ry });
    for (const s of [-1, 0, 1]) {
      if (rnd(k, s + 5) > 0.3) caja(x + tx * s * 0.95, y + alto + 0.08, z + tz * s * 0.95, 0.9, 0.2 + rnd(k, s) * 0.14, 0.9, GRIS[(k + s + 5) % 4], { ry: ry + (rnd(k, s + 9) - 0.5) * 0.3 });
      ponerSolido(x + tx * s * 0.95, z + tz * s * 0.95, 0.6);
    }
  }
  // Antorcha junto a cada puerta y humo en cada chimenea (misma cuenta que piezasCasa de kenney.js).
  CASAS.forEach((c, i) => {
    const nx = Math.max(2, Math.round(c.w / 2.6)), nz = Math.max(2, Math.round(c.d / 2.6)), ex = c.w / nx, ez = c.d / nz;
    const ry = c.r + (Math.sin(c.r) * c.x + Math.cos(c.r) * c.z > 0 ? Math.PI : 0), cs = Math.cos(ry), sn = Math.sin(ry), y = alturaEn(c.x, c.z);
    const m = (lx, lz) => [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs];
    const [ax, az] = m((Math.floor(nx / 2) - (nx - 1) / 2 + 0.62) * ex, c.d / 2 + 0.3);
    antorcha(ax, y + 1.25, az, 1.1);
    const largoX = nx >= nz, Lr = (largoX ? nx : nz) / 2, S = (largoX ? nz : nx) / 2, alto = S * 0.95 + 0.15, ch = Lr - 0.8, q = -S * 0.45;
    const [hx, hz] = m((largoX ? ch : q) * ex, (largoX ? q : ch) * ez), hy = y - 0.25 + (2 + alto - S * 0.45 * (alto / S) - 0.35 + 1.1) * 2.3;
    if (!baja) for (let k = 0; k < 5; k++) { H.p.push(hx, hy, hz); H.a.push(1.6, k / 5 + rnd(i, k) * 0.1, i); }
  });

  // ── Mallas ──
  const obra = new THREE.Mesh(KIT.fundir(P), KIT.material);
  if (ctx.sombras) { obra.castShadow = true; obra.receiveShadow = true; }
  obra.frustumCulled = false; fijar(obra); escena.add(obra);

  const gr = new THREE.BufferGeometry();
  gr.setAttribute('position', new THREE.Float32BufferAttribute(R.p, 3)); gr.setAttribute('color', new THREE.Float32BufferAttribute(R.c, 3)); gr.setAttribute('uv', new THREE.Float32BufferAttribute(R.uv, 2)); gr.setIndex(R.i);
  runasMat = new THREE.MeshBasicMaterial({ map: atlasRunas(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.4 });
  const runas = new THREE.Mesh(gr, runasMat); runas.frustumCulled = false; runas.renderOrder = 1; fijar(runas); escena.add(runas);

  const puntos = (D, frag, aditivo) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(D.p, 3)); g.setAttribute('aDat', new THREE.Float32BufferAttribute(D.a, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: OBRA_FX, transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec3 aDat; uniform float uObraT; uniform float uObraPx; uniform float uObraNoche; varying vec3 vDat; varying float vK;
        void main() {
          vec3 p = position; float tam = aDat.x; vK = 0.0;
          ${aditivo ? `float f = 0.82 + 0.12 * sin(uObraT * 11.0 + aDat.y) + 0.06 * sin(uObraT * 23.0 + aDat.y * 3.0);
          tam *= aDat.z < 0.5 ? f : 0.9 + 0.1 * f; vK = f; p.x += aDat.z < 0.5 ? 0.02 * sin(uObraT * 7.0 + aDat.y) : 0.0;`
          : `float k = fract(uObraT * 0.085 + aDat.y); vK = k; p.y += k * 5.5; p.x += k * k * 1.6 + sin(uObraT * 0.6 + aDat.z + k * 5.0) * 0.25 * k; p.z += k * k * 0.7; tam *= 0.5 + k * 1.3;`}
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vDat = vec3(aDat.z, -mv.z, tam);
          gl_PointSize = min(tam * uObraPx * 0.5 * projectionMatrix[1][1] / max(0.1, -mv.z), 220.0);
        }`,
      fragmentShader: 'uniform float uObraNoche; varying vec3 vDat; varying float vK;\nvoid main() {\n  vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;\n' + frag + '\n}',
    });
    const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 3; fijar(o); escena.add(o); return o;
  };
  if (ctx.nivel !== 'minima' && L.p.length) llamas = puntos(L, `
    float lejos = 1.0 - smoothstep(110.0, 170.0, vDat.y);
    if (vDat.x < 0.5) { float g = 1.0 - smoothstep(0.0, 1.0, length(vec2(q.x * 2.9, (q.y + 0.08) * 1.9))); gl_FragColor = vec4(mix(vec3(1.0, 0.36, 0.06), vec3(1.0, 0.86, 0.5), g * g) * g * 1.5 * lejos, 1.0); }
    else { float g = 1.0 - smoothstep(0.0, 1.0, d); gl_FragColor = vec4(vec3(1.0, 0.6, 0.24) * g * g * (0.07 + 0.4 * uObraNoche) * vK * lejos, 1.0); }`, true);
  if (H.p.length) humo = puntos(H, `
    float a = (1.0 - smoothstep(0.2, 1.0, d)) * vK * (1.0 - vK) * 4.0 * 0.3 * (1.0 - smoothstep(70.0, 130.0, vDat.y));
    gl_FragColor = vec4(mix(vec3(0.66, 0.66, 0.68), vec3(0.16, 0.16, 0.2), uObraNoche), a);`, false);

  // Plaza empedrada: un disco a ras de suelo con el borde mordido (el pueblo es llano).
  {
    const g = new THREE.CircleGeometry(15.5, 40), q = g.attributes.position, uv = g.attributes.uv;
    for (let v = 1; v < q.count; v++) { const k = 0.9 + rnd(v, 4) * 0.14; q.setX(v, q.getX(v) * k); q.setY(v, q.getY(v) * k); }
    for (let v = 0; v < q.count; v++) uv.setXY(v, q.getX(v) / 4.6, q.getY(v) / 4.6);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: texturaPlaza(baja ? 128 : 256), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    m.position.set(0, alturaEn(0, 0) + 0.012, 0); if (ctx.sombras) m.receiveShadow = true; fijar(m); escena.add(m);
  }
  try { window.__dqObra = { arcos: arcos.map(o => [Math.round(o.x), Math.round(o.z)]), piezas: P.length, runas: R.i.length / 6, llamas: L.p.length / 6 }; } catch (e) {}
  return { obra, runas, arcos };
}
function fijar(o) { o.matrixAutoUpdate = false; o.updateMatrix(); o.updateMatrixWorld(true); }

// Cada cuadro: reloj de llamas y humo, noche (0..1) para vidrieras, halos y runas, y alto del lienzo en px.
export function animarObra(t, noche, altoPx) {
  OBRA_FX.uObraT.value = (t / 1000) % 3600; OBRA_FX.uObraNoche.value = noche; if (altoPx) OBRA_FX.uObraPx.value = altoPx;
  if (runasMat) runasMat.opacity = 0.3 + noche * (0.5 + 0.12 * Math.sin(t / 900));
}
