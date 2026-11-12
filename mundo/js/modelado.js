// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — modelos propios hechos en Blender (tools/blender/)
//
// Cada familia (arboles, rocas, ...) es un paquete assets/3d/dq_<familia>.json +
// .bin(.gz) que genera `node tools/blender/construir.mjs`; assets/3d/dq_indice.json
// dice cuales hay. Por modelo: 3 niveles de detalle con posiciones (16 bits),
// normales suaves, color por vertice (con la oclusion ya horneada), la marca de
// material `tinte` (las mismas del kit: 1 hoja, 3 piedra, 7 emisivo...) y cuanto
// lo mece el viento. Se dibujan con UN material (Lambert de sombreado suave con
// el agujero de tapa.js), instanciados como la flora del kit.
// Si el indice o un paquete no llegan, el mundo se ve con el kit de siempre.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { transparentar } from './tapa.js?v=374';

const V = new URL(import.meta.url).search;   // el mismo ?v= del modulo
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }

async function leerBin(url) {
  if (typeof DecompressionStream === 'function') {
    try {
      const r = await fetch(url.replace('.bin', '.bin.gz'));
      if (r.ok) return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch (e) { /* sin gzip: el normal */ }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.arrayBuffer();
}

let promesa = null;
// fx: { uT, uViento, uMusgo, uBrillo } (uniformes vivos que ya mueve mundo.js). Devuelve null si no hay paquetes.
export function cargarModelado(base, fx) {
  if (!promesa) promesa = (async () => {
    const r = await fetch(base + 'dq_indice.json' + V);
    if (!r.ok) throw new Error('dq_indice.json ' + r.status);
    const ind = await r.json(), fams = Object.keys(ind.paquetes || {});
    // Un paquete que falla no tumba a los demas: esa familia se queda con lo de antes.
    const paqs = (await Promise.all(fams.map(async f => {
      try {
        const h = '?h=' + ind.paquetes[f].h;
        const [j, buf] = await Promise.all([fetch(base + 'dq_' + f + '.json' + h).then(x => { if (!x.ok) throw new Error(f + '.json ' + x.status); return x.json(); }), leerBin(base + 'dq_' + f + '.bin' + h)]);
        if (buf.byteLength !== j.bytes || j.v !== 2) throw new Error('paquete de otra version');
        return { j, buf };
      } catch (e) { console.warn('[3D] sin el paquete de modelos «' + f + '»:', e); return null; }
    }))).filter(Boolean);
    return paqs.length ? crear(paqs, fx || {}) : null;
  })();
  return promesa;
}

function crear(paqs, fx) {
  const modelos = {}, cache = new Map(), floraDe = {}, kit = {};
  for (const { j, buf } of paqs) for (const n in j.modelos) {
    const m = modelos[n] = { ...j.modelos[n], buf, familia: j.familia }, s = m.sus || {};
    if (s.flora) (floraDe[s.flora] = floraDe[s.flora] || []).push({ n, alto: s.alto || 0, modo: s.modo || '', zonas: s.zonas || null, orilla: !!s.orilla, peso: s.peso || 1 });
    if (s.kit) kit[s.kit] = n;
  }
  // Geometria de un modelo en un nivel (0 alto, 1 medio, 2 bajo). Se crea una vez.
  function geo(n, lod = 0) {
    const k = n + '|' + lod;
    if (cache.has(k)) return cache.get(k);
    const m = modelos[n];
    if (!m) throw new Error('modelo ' + n + ' no esta en los paquetes');
    const L = m.lods[Math.min(lod, m.lods.length - 1)], v = L.v, buf = m.buf;
    // Formato v2 (tools/blender/dq_lib.py, _bloque): planos de bytes; posiciones a 12 bits en diferencias, indices relativos.
    const B = new Uint8Array(buf, L.o), ni = L.i;
    const zz = (o, k) => { const u = B[o + k] | (B[o + k + (o < 6 * v ? v : ni)] << 8); return (u >>> 1) ^ -(u & 1); };
    const pos = new Float32Array(v * 3), nor = new Int8Array(v * 3), col = new Float32Array(v * 3), tin = new Float32Array(v), w8 = new Uint8Array(v), idx = new Uint16Array(ni);
    for (let e = 0; e < 3; e++) {
      const k = (m.max[e] - m.min[e]) / 4095;
      for (let i = 0, a = 0; i < v; i++) { a += zz(e * 2 * v, i); pos[i * 3 + e] = m.min[e] + a * k; nor[i * 3 + e] = B[6 * v + e * v + i] << 24 >> 24; col[i * 3 + e] = LIN[B[9 * v + e * v + i]]; }
    }
    for (let i = 0; i < v; i++) { tin[i] = B[12 * v + i]; w8[i] = B[13 * v + i]; }
    for (let i = 0, tope = -1; i < ni; i++) { const x = tope + 1 - zz(14 * v, i); idx[i] = x; if (x > tope) tope = x; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
    g.setAttribute('dqW', new THREE.BufferAttribute(w8, 1, true));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    cache.set(k, g);
    return g;
  }
  // Variantes que un guion declaro para un tipo de flora en una zona ({'flora': tipo, 'zonas': [...], 'orilla': true}).
  // Las de orilla solo salen junto al agua (y alli mandan). null = ese tipo sigue con el kit.
  const memo = new Map();
  function flora(tipo, zona, orilla) {
    const k = tipo + '|' + zona + (orilla ? '|o' : '');
    if (memo.has(k)) return memo.get(k);
    let l = (floraDe[tipo] || []).filter(x => !x.zonas || x.zonas.includes(zona));
    const or = l.filter(x => x.orilla);
    l = orilla && or.length ? or : l.filter(x => !x.orilla);
    const r = l.length ? l : null;
    memo.set(k, r);
    return r;
  }
  return { modelos, geo, flora, kit, material: materialOrganico(fx), caja: n => modelos[n] && { min: modelos[n].min, max: modelos[n].max }, tris: (n, lod) => modelos[n].lods[lod].i / 3 };
}

// Material de los modelos propios: color por vertice con sombreado suave. Marcas (`tinte`):
//   1 hoja    → toma el color de la instancia (el verde de la zona) y se mece con el viento (dqW);
//   3 piedra y 8 monolito → el musgo de la zona cubre lo que mira arriba;
//   7 emisivo → brilla (mas de noche);  el resto → su color tal cual.
function materialOrganico(fx) {
  const mat = transparentar(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const prev = mat.onBeforeCompile, cero = { value: 0 };
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.uT = fx.uT || cero; sh.uniforms.uViento = fx.uViento || cero; sh.uniforms.uMusgo = fx.uMusgo || cero; sh.uniforms.uBrillo = fx.uBrillo || { value: 1 };
    sh.vertexShader = '// dq:modelado\nattribute float tinte;\nattribute float dqW;\nuniform float uT;\nuniform float uViento;\nuniform float uMusgo;\nvarying vec4 vDqMus;\nvarying float vDqEmi;\n' + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      float dqHoja = step(0.5, tinte) * step(tinte, 1.5);
      vDqEmi = step(6.5, tinte) * step(tinte, 7.5);
      vDqMus = vec4(0.0);
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(color, instanceColor.xyz * color / vec3(0.12, 0.36, 0.08), dqHoja);
        vDqMus = vec4(instanceColor.xyz * 0.62, uMusgo * (step(2.5, tinte) * step(tinte, 3.5) + step(7.5, tinte)));
      #endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float dqEsc = length(instanceMatrix[1].xyz);
        float dqFase = uT * 1.6 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
        float dqK = uViento * dqW / dqEsc;
        transformed.xz += dqK * clamp(position.y * dqEsc * 0.14, 0.0, 1.0) * 0.17 * vec2(sin(dqFase) + 0.4 * sin(dqFase * 2.3 + position.y), cos(dqFase * 0.8) * 0.6);
        transformed.y += dqK * dqHoja * 0.04 * sin(uT * 2.9 + dqFase + position.x * 1.7 + position.z * 2.3);
      #endif`);
    sh.fragmentShader = '// dq:modelado\nuniform float uBrillo;\nvarying vec4 vDqMus;\nvarying float vDqEmi;\n' + sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      diffuseColor.rgb = mix(diffuseColor.rgb, vDqMus.rgb, vDqMus.a * smoothstep(0.45, 0.85, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += diffuseColor.rgb * vDqEmi * uBrillo;');
  };
  mat.customProgramCacheKey = () => 'tapa-dqm';
  return mat;
}
