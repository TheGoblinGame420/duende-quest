// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — acabado del suelo y detalle del sotobosque
//
// Todo es procedural (sin imagenes): una sola textura de ruido que se repite
// sin costura (R = grano de hierba y tierra, G = vetas y grietas de roca,
// B = empedrado) y que el terreno mezcla segun pendiente, orilla y cercania
// al camino; y el detalle pequeño junto a caminos y campamentos (troncos
// caidos, tocones con raices, helechos, matas de hierba, piedras con musgo y
// setas que brillan), fundido en una malla por celda (una llamada de dibujo).
// Nada de aqui cambia alturas ni colisiones: es solo dibujo.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

// ── Textura del suelo (se genera una vez; tam = 256, o 128 en movil) ──
function hash2(x, y, s) { let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2654435761; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// Ruido de valores que se repite cada `per` celdas (por eso la textura no tiene costura).
function ruidoP(x, y, per, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const m = v => ((v % per) + per) % per;
  const a = hash2(m(x0), m(y0), s), b = hash2(m(x0 + 1), m(y0), s), c = hash2(m(x0), m(y0 + 1), s), d = hash2(m(x0 + 1), m(y0 + 1), s);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function texturaSuelo(tam) {
  const d = new Uint8Array(tam * tam * 4), K = 12;   // K x K adoquines por baldosa
  const pts = [];
  for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) pts.push([i + 0.18 + hash2(i, j, 31) * 0.64, j + 0.18 + hash2(i, j, 32) * 0.64, 0.62 + hash2(i, j, 33) * 0.38]);
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const u = x / tam, v = y / tam, o = (y * tam + x) * 4;
    // R: grano de hierba y tierra (manchas medias + grano fino + hebras).
    const gr = ruidoP(u * 8, v * 8, 8, 1) * 0.38 + ruidoP(u * 24, v * 24, 24, 2) * 0.3 + ruidoP(u * 64, v * 64, 64, 3) * 0.2 + ruidoP(u * 128, v * 40, 128, 4) * 0.12;
    // G: roca: vetas onduladas y grietas finas y oscuras.
    const onda = ruidoP(u * 6, v * 6, 6, 5);
    const veta = 0.5 + 0.5 * Math.sin((v * 9 + onda * 1.4) * Math.PI * 2);
    const gri = Math.abs(ruidoP(u * 10, v * 10, 10, 6) - 0.5) * 2, gri2 = Math.abs(ruidoP(u * 22, v * 22, 22, 7) - 0.5) * 2;
    const ro = (0.42 + veta * 0.22 + ruidoP(u * 48, v * 48, 48, 8) * 0.3) * Math.min(1, 0.35 + gri * 5) * Math.min(1, 0.6 + gri2 * 4);
    // B: empedrado: celdas irregulares con junta hundida; cada piedra con su tono y los cantos gastados.
    const px = u * K, py = v * K, cx = Math.floor(px), cy = Math.floor(py);
    let f1 = 9, f2 = 9, tono = 1;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const p = pts[(((cy + j) % K + K) % K) * K + ((cx + i) % K + K) % K];
      const dx = px - (p[0] + Math.floor((cx + i) / K) * K), dy = py - (p[1] + Math.floor((cy + j) / K) * K), dd = Math.hypot(dx, dy);
      if (dd < f1) { f2 = f1; f1 = dd; tono = p[2]; } else if (dd < f2) f2 = dd;
    }
    const junta = Math.min(1, Math.max(0, (f2 - f1 - 0.05) / 0.16));
    const em = junta * tono * (0.82 + ruidoP(u * 64, v * 64, 64, 9) * 0.18);
    d[o] = Math.round(Math.min(1, Math.max(0, gr)) * 255); d[o + 1] = Math.round(Math.min(1, Math.max(0, ro)) * 255); d[o + 2] = Math.round(Math.min(1, Math.max(0, em)) * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, tam, tam);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ── Material del terreno: el Lambert de siempre (color por vertice) con el detalle encima ──
// La geometria trae el atributo dqM = (roca 0..1, distancia al camino en metros con tope 12, orilla mojada 0..1).
// caminos: [[ax, az, bx, bz]] que salen todos del origen (asi el shader solo guarda direccion y largo).
export function vestirSuelo(mat, tex, caminos, anis) {
  if (anis) tex.anisotropy = anis;
  const cam = caminos.map(([ax, az, bx, bz]) => { const l = Math.hypot(bx - ax, bz - az) || 1; return new THREE.Vector3((bx - ax) / l, (bz - az) / l, l); });
  mat.onBeforeCompile = sh => {
    sh.uniforms.dqSuelo = { value: tex }; sh.uniforms.dqCam = { value: cam };
    sh.vertexShader = '// dq:suelo\nattribute vec3 dqM;\nvarying vec3 vDqM;\nvarying vec2 vDqW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDqM = dqM; vDqW = position.xz;');
    sh.fragmentShader = `// dq:suelo
      uniform sampler2D dqSuelo; uniform vec3 dqCam[${cam.length}]; varying vec3 vDqM; varying vec2 vDqW;
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 fa = texture2D(dqSuelo, vDqW * 0.2).rgb;                 /* de cerca: 5 m por baldosa */
        vec3 fb = texture2D(dqSuelo, vDqW.yx * 0.037 + 0.31).rgb;     /* de lejos: rompe la repeticion */
        float det = mix(fa.r * 0.6 + fb.r * 0.4, fa.g * 0.62 + fb.g * 0.38, vDqM.x);
        diffuseColor.rgb *= (0.42 + 1.16 * det) * mix(1.0, 0.7, vDqM.z);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.9, 0.72), smoothstep(0.5, 0.68, fb.r) * (1.0 - vDqM.x));   /* manchas de musgo y hierba vieja */
        if (vDqM.y < 9.0) {
          float dc = 1000.0;
          for (int i = 0; i < ${cam.length}; i++) { vec3 c = dqCam[i]; dc = min(dc, length(vDqW - c.xy * clamp(dot(vDqW, c.xy), 0.0, c.z))); }
          float borde = dc + (fb.r - 0.5) * 2.4 + (fa.r - 0.5) * 0.9;
          float k = (1.0 - smoothstep(2.0, 2.7, borde)) * smoothstep(22.0, 27.0, length(vDqW));
          float ad = texture2D(dqSuelo, vDqW * 0.34).b;   /* adoquines de un palmo y medio */
          vec3 piedra = mix(vec3(0.022, 0.03, 0.016), vec3(0.2, 0.19, 0.17) * (0.72 + 0.56 * fb.g), smoothstep(0.06, 0.34, ad)) * (0.55 + 0.6 * ad);
          diffuseColor.rgb = mix(diffuseColor.rgb, piedra, k * 0.94);
        }
      }`);
  };
  mat.customProgramCacheKey = () => 'dq-suelo' + cam.length;
  return mat;
}

// ── Detalle del sotobosque ──
// Plantillas: { P: posiciones, C: colores (lineales), V: [viento, brillo] por vertice, I: indices }.
const _c = new THREE.Color();
function plantilla(geo, pintar) {
  const g = geo.index ? geo : geo.toNonIndexed(), p = g.attributes.position, n = g.attributes.normal;
  const P = [], Cc = [], V = [];
  for (let i = 0; i < p.count; i++) {
    const r = pintar(p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
    _c.set(r[0]); if (r[3]) _c.multiplyScalar(r[3]);
    P.push(p.getX(i), p.getY(i), p.getZ(i)); Cc.push(_c.r, _c.g, _c.b); V.push(r[1] || 0, r[2] || 0);
  }
  const I = g.index ? Array.from(g.index.array) : P.map((_, i) => i).slice(0, p.count);
  geo.dispose();
  return { P, C: Cc, V, I };
}
function unir(...ps) {
  const o = { P: [], C: [], V: [], I: [] };
  for (const p of ps) { const b = o.P.length / 3; o.P.push(...p.P); o.C.push(...p.C); o.V.push(...p.V); for (const i of p.I) o.I.push(i + b); }
  return o;
}
function mover(p, m) {
  const v = new THREE.Vector3(), o = { P: [], C: p.C, V: p.V, I: p.I };
  for (let i = 0; i < p.P.length; i += 3) { v.set(p.P[i], p.P[i + 1], p.P[i + 2]).applyMatrix4(m); o.P.push(v.x, v.y, v.z); }
  return o;
}
const M = (x, y, z, rx, ry, rz, s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
// Hoja o fronda: una tira que sale del centro, se arquea y acaba en punta. hojas = [[angulo, largo, alto, ancho]].
function frondas(hojas, oscuro, claro, cortes) {
  const o = { P: [], C: [], V: [], I: [] }, a = new THREE.Color(oscuro), b = new THREE.Color(claro);
  for (const [ang, L, H, W] of hojas) {
    const cx = Math.cos(ang), sz = Math.sin(ang), base = o.P.length / 3;
    for (let k = 0; k <= cortes; k++) {
      const t = k / cortes, r = t * L, y = Math.sin(t * 2.3) * H + 0.03, w = k === cortes ? 0 : W * (0.35 + 0.65 * Math.sin(Math.PI * (0.1 + 0.8 * t)));
      _c.copy(a).lerp(b, t * 0.85);
      o.P.push(cx * r - sz * w, y, sz * r + cx * w, cx * r + sz * w, y, sz * r - cx * w);
      o.C.push(_c.r, _c.g, _c.b, _c.r, _c.g, _c.b); o.V.push(t * t, 0, t * t, 0);
      if (k) { const i = base + k * 2; o.I.push(i - 2, i - 1, i, i - 1, i + 1, i); }
    }
  }
  return o;
}
function plantillas() {
  const corteza = '#33251b', musgo = '#3d5527', madera = '#6f5a43';
  const tronco = plantilla(new THREE.CylinderGeometry(0.3, 0.36, 3.4, 7).rotateZ(Math.PI / 2).translate(0, 0.24, 0), (x, y, z, nx, ny) => [Math.abs(nx) > 0.9 ? madera : ny > 0.35 ? musgo : corteza, 0, 0, 0.85 + 0.3 * Math.abs(Math.sin(x * 7))]);
  const rama = plantilla(new THREE.CylinderGeometry(0.05, 0.1, 1.1, 5).translate(0, 0.55, 0), () => [corteza]);
  const raiz = plantilla(new THREE.CylinderGeometry(0.05, 0.15, 1.5, 5).translate(0, 0.75, 0), (x, y) => [y < 0.5 ? corteza : '#2a2018']);
  const cepa = plantilla(new THREE.CylinderGeometry(0.4, 0.52, 0.6, 8).translate(0, 0.3, 0), (x, y, z, nx, ny) => [ny > 0.9 ? madera : y > 0.35 && nx > -0.2 ? musgo : corteza, 0, 0, ny > 0.9 ? 0.75 + 0.5 * Math.abs(Math.sin(Math.hypot(x, z) * 22)) : 1]);
  const raices = [0.3, 1.5, 2.9, 4.1, 5.2].map((a, i) => mover(raiz, M(Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3, 0, -a, -(1.68 + (i % 2) * 0.12),0.85 + (i % 3) * 0.2)));
  const piedra = (r, sy, gris) => plantilla(new THREE.DodecahedronGeometry(r, 0).scale(1, sy, 0.8).translate(0, r * sy * 0.55, 0), (x, y, z, nx, ny) => [y > r * sy * 0.75 ? musgo : gris, 0, 0, 0.8 + 0.4 * hash2(x * 50, z * 50, 7)]);
  const seta = (col, h, r) => unir(
    plantilla(new THREE.CylinderGeometry(0.035, 0.05, h, 5).translate(0, h / 2, 0), () => ['#cfc8b4', 0, 0.25]),
    plantilla(new THREE.SphereGeometry(r, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, h - 0.02, 0), (x, y) => [col, 0, 1, y > h + r * 0.4 ? 1.25 : 0.8]));
  const corro = col => unir(seta(col, 0.34, 0.17), mover(seta(col, 0.22, 0.11), M(0.26, 0, 0.1, 0.1, 1, 0.12, 1)), mover(seta(col, 0.16, 0.09), M(-0.18, 0, 0.2, -0.1, 2, -0.14, 1)), mover(seta(col, 0.26, 0.13), M(-0.08, 0, -0.27, 0.12, 4, 0.05, 1)));
  const hojasH = n => Array.from({ length: n }, (_, i) => [i / n * 6.283 + hash2(i, n, 3) * 0.5, 0.75 + hash2(i, n, 4) * 0.5, 0.42 + hash2(i, n, 5) * 0.25, 0.13]);
  const briznas = n => Array.from({ length: n }, (_, i) => [i / n * 6.283 + hash2(i, n, 6), 0.22 + hash2(i, n, 7) * 0.2, 0.5 + hash2(i, n, 8) * 0.45, 0.035]);
  return {
    tronco: unir(tronco, mover(rama, M(0.7, 0.3, 0, 0.5, 0, 0.3, 1)), mover(rama, M(-0.9, 0.3, 0, -0.7, 0, -0.2, 0.8))),
    tocon: unir(cepa, ...raices),
    piedra: unir(piedra(0.42, 0.62, '#6a6660'), mover(piedra(0.24, 0.7, '#5a5752'), M(0.5, 0, 0.22, 0, 1, 0, 1))),
    piedraSeca: plantilla(new THREE.DodecahedronGeometry(0.4, 0).scale(1, 0.6, 0.8).translate(0, 0.13, 0), (x, y, z) => ['#8a7a5c', 0, 0, 0.8 + 0.4 * hash2(x * 50, z * 50, 7)]),
    piedraNieve: plantilla(new THREE.DodecahedronGeometry(0.42, 0).scale(1, 0.62, 0.8).translate(0, 0.14, 0), (x, y) => [y > 0.22 ? '#e6ecf2' : '#6a6870']),
    helecho: frondas(hojasH(7), '#1f3d26', '#4a7a3c', 4),
    helechoSeco: frondas(hojasH(6), '#4a4526', '#8a7a44', 4),
    hierba: frondas(briznas(7), '#2c4a2a', '#6f8f4a', 2),
    hierbaSeca: frondas(briznas(6), '#6a5a32', '#b09a5c', 2),
    setaV: corro('#8a5cf0'), setaT: corro('#3fd6b4'), setaA: corro('#e8a23c'),
  };
}
// Que crece en cada zona: [plantilla, peso, escala].
const SOTO = {
  noche: [['helecho', 4], ['tronco', 2], ['tocon', 2], ['setaT', 2], ['setaV', 1], ['piedra', 2], ['hierba', 2]],
  castillo: [['helecho', 2], ['tronco', 2], ['tocon', 2], ['setaV', 1], ['piedra', 4], ['hierba', 2]],
  tormenta: [['tronco', 2], ['tocon', 2], ['piedra', 4], ['helechoSeco', 2], ['setaV', 1]],
  selva: [['helecho', 5], ['hierba', 3], ['tronco', 2], ['tocon', 1], ['setaA', 1], ['setaT', 1], ['piedra', 1]],
  amanecer: [['hierbaSeca', 4], ['helechoSeco', 2], ['tronco', 1], ['piedra', 2], ['setaA', 1]],
  pueblo: [['hierba', 4], ['helecho', 2], ['piedra', 2], ['tocon', 1], ['setaA', 1]],
  abismo: [['hierba', 3], ['helecho', 3], ['piedra', 2]],
  desierto: [['piedraSeca', 4], ['hierbaSeca', 3]],
  cumbres: [['piedraNieve', 4], ['hierbaSeca', 1]],
  cavernas: [['setaT', 4], ['piedra', 3], ['helecho', 1]],
  acantilados: [['setaV', 4], ['piedra', 2], ['hierba', 2]],
};
const MATORRAL = { noche: 0.07, selva: 0.07, castillo: 0.03, cavernas: 0.03, acantilados: 0.03 };   // fuera de caminos y campamentos

// d: { alturaEn, pendienteEn, enCamino, zonaEn, campos, casas, vecinos, trozo, fx: { uT, uViento, uBrillo } }.
// Devuelve celdas { x, z, mallas, cerca, lejos } con la forma de las de la flora (el mismo recorte por distancia).
export function crearSotobosque(d) {
  const T = plantillas(), celdas = new Map(), PASO = 3.5;
  const LIM = d.lim || 600, LUGS = d.lugares || [];   /* v376: el mundo crecio (d.lim = MUNDO.borde) y los lugares del borde quedan despejados */
  for (let x = -LIM; x <= LIM; x += PASO) for (let z = -LIM; z <= LIM; z += PASO) {
    const ix = Math.round(x * 2), iz = Math.round(z * 2);
    if (hash2(ix, iz, 43) >= 0.3) continue;   /* el 70 % se descarta antes de mirar nada */
    const jx = x + (hash2(ix, iz, 41) - 0.5) * PASO, jz = z + (hash2(ix, iz, 42) - 0.5) * PASO;
    if (Math.hypot(jx, jz) < 34 || LUGS.some(l => Math.abs(l.x - jx) < 24 && Math.abs(l.z - jz) < 24)) continue;
    const cam = d.enCamino(jx, jz);
    if (cam < 3.6) continue;
    const zona = d.zonaEn(jx, jz), lista = SOTO[zona];
    if (!lista) continue;
    let prob = cam < 10 ? 0.3 : (MATORRAL[zona] || 0);
    if (prob < 0.2 && d.campos.some(c => { const r = Math.hypot(c.x - jx, c.z - jz); return r > 6 && r < 15; })) prob = 0.22;
    if (hash2(ix, iz, 43) >= prob) continue;
    const h = d.alturaEn(jx, jz);
    if (h < 0.6 || d.pendienteEn(jx, jz) > 0.7) continue;
    if (d.casas.some(c => Math.hypot(c.x - jx, c.z - jz) < 9) || d.vecinos.some(v => Math.hypot(v.x - jx, v.z - jz) < 5)) continue;
    let total = 0; for (const l of lista) total += l[1];
    let r = hash2(ix, iz, 44) * total, tipo = lista[0][0];
    for (const l of lista) { if (r < l[1]) { tipo = l[0]; break; } r -= l[1]; }
    const ck = Math.floor(jx / d.trozo) + '|' + Math.floor(jz / d.trozo);
    let c = celdas.get(ck);
    if (!c) celdas.set(ck, c = { P: [], C: [], V: [], I: [] });
    const p = T[tipo], s = 0.8 + hash2(ix, iz, 45) * 0.55, rot = hash2(ix, iz, 46) * 6.283, co = Math.cos(rot) * s, si = Math.sin(rot) * s, tono = 0.82 + hash2(ix, iz, 47) * 0.36, b = c.P.length / 3;
    for (let i = 0; i < p.P.length; i += 3) c.P.push(jx + p.P[i] * co + p.P[i + 2] * si, h - 0.05 + p.P[i + 1] * s, jz - p.P[i] * si + p.P[i + 2] * co);
    for (let i = 0; i < p.C.length; i++) c.C.push(p.C[i] * tono);
    c.V.push(...p.V);
    for (const i of p.I) c.I.push(i + b);
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = d.fx.uT; sh.uniforms.uViento = d.fx.uViento; sh.uniforms.uBrillo = d.fx.uBrillo;
    sh.vertexShader = '// dq:soto\nattribute vec2 dqV;\nuniform float uT;\nuniform float uViento;\nvarying float vDqB;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vDqB = dqV.y;
      float dqF = uT * 1.7 + position.x * 0.35 + position.z * 0.27;
      transformed.xz += dqV.x * uViento * 0.09 * vec2(sin(dqF) + 0.4 * sin(dqF * 2.3), cos(dqF * 0.8));`);
    sh.fragmentShader = '// dq:soto\nuniform float uBrillo;\nvarying float vDqB;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vDqB * uBrillo;');
  };
  mat.customProgramCacheKey = () => 'dq-soto';
  const salida = [], mallas = [];
  for (const [ck, c] of celdas) {
    const g = new THREE.BufferGeometry(), nv = c.P.length / 3;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(c.P), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c.C), 3));
    g.setAttribute('dqV', new THREE.BufferAttribute(new Float32Array(c.V), 2));
    g.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(c.I) : new Uint16Array(c.I), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false; m.visible = false;
    const [kx, kz] = ck.split('|').map(Number);
    salida.push({ x: (kx + 0.5) * d.trozo, z: (kz + 0.5) * d.trozo, mallas: [], cerca: [m], lejos: [] });
    mallas.push(m);
  }
  return { celdas: salida, mallas, material: mat };
}
