// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — modelos de los kits CC0 de Kenney (kenney.nl)
//
// assets/3d/kenney.bin + kenney.json los genera tools/kenney_build.mjs:
// posiciones, color por vertice (ya con la paleta del kit) y la marca
// "tinte" de hojas y hierba. Todo se dibuja con un solo material Lambert de
// sombreado plano (como el resto del mundo) con el agujero de tapa.js; en las
// mallas instanciadas el color de cada instancia tiñe SOLO hojas y hierba
// (los troncos y piedras quedan como estan).
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { transparentar } from './tapa.js?v=379';

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }

let promesa = null;
export function cargarKenney(base) {
  if (!promesa) promesa = Promise.all([fetch(base + 'kenney.json').then(r => { if (!r.ok) throw new Error('kenney.json ' + r.status); return r.json(); }), leerBin(base)]).then(([ind, buf]) => crearKit(ind, buf));
  return promesa;
}
// Otro paquete con el mismo formato (v376: 'lugares', kits de supervivencia, cementerio y piratas).
const paquetes = new Map();
export function cargarPaquete(base, nombre) {
  if (!paquetes.has(nombre)) paquetes.set(nombre, Promise.all([fetch(base + nombre + '.json').then(r => { if (!r.ok) throw new Error(nombre + '.json ' + r.status); return r.json(); }), leerBin(base, nombre)]).then(([ind, buf]) => crearKit(ind, buf)));
  return paquetes.get(nombre);
}
async function leerBin(base, nombre = 'kenney') {
  // El binario va tambien comprimido (230 KB en vez de 1,1 MB).
  if (typeof DecompressionStream === 'function') {
    try {
      const r = await fetch(base + nombre + '.bin.gz');
      if (r.ok) return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch (e) { /* sin gzip: el normal */ }
  }
  const r = await fetch(base + nombre + '.bin');
  if (!r.ok) throw new Error(nombre + '.bin ' + r.status);
  return r.arrayBuffer();
}

// Oclusion falsa en la base (mundo.js pone uAO segun la calidad; 0 = apagada): la parte baja de casas,
// troncos y matas se oscurece hacia el suelo (los primeros ~1,3 m) y la pieza queda asentada en el terreno.
// Naturaleza viva (solo mallas instanciadas = flora; 0 = apagado): uViento mece hojas y hierba (uT = segundos),
// uMusgo da tono desigual a las copas y cubre de musgo (el color de la instancia) las caras de piedra que miran arriba.
export const KIT_FX = { uAO: { value: 0 }, uT: { value: 0 }, uViento: { value: 0 }, uMusgo: { value: 0 } };

function crearKit(ind, buf) {
  const cache = new Map();
  // Dos materiales iguales: uno para las mallas sueltas (casas fundidas) y otro para las instanciadas
  // (flora). Con uno solo, three cambiaba de programa (y rehacia su clave) cada vez que alternaban
  // en la lista de dibujo: decenas de veces por cuadro.
  const material = hacerMaterial(), materialInst = hacerMaterial();
  function hacerMaterial() {
  const material = transparentar(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    // Hojas y hierba toman el color de la instancia (con el brillo de su
    // pieza); lo demas conserva su color.
    sh.uniforms.uAO = KIT_FX.uAO;
    sh.uniforms.uT = KIT_FX.uT; sh.uniforms.uViento = KIT_FX.uViento; sh.uniforms.uMusgo = KIT_FX.uMusgo;
    sh.fragmentShader = 'varying vec4 vDqMus;\n' + sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      diffuseColor.rgb = mix(diffuseColor.rgb, vDqMus.rgb, vDqMus.a * smoothstep(0.35, 0.8, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));`);
    sh.vertexShader = 'uniform float uT;\nuniform float uViento;\nuniform float uMusgo;\nvarying vec4 vDqMus;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vDqMus = vec4(0.0);
      #ifdef USE_INSTANCING_COLOR
        vDqMus = vec4(instanceColor.xyz * 0.62, (1.0 - tinte) * uMusgo * step(max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b)), 0.07));
        vColor.xyz *= 1.0 + uMusgo * (fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5) * mix(0.14, 0.36, tinte);
        float dqAlt = position.y * aoEsc;
        float dqFase = uT * 1.6 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
        transformed.xz += uViento * tinte * smoothstep(0.0, 0.5, dqAlt) * clamp(0.12 + dqAlt * 0.15, 0.0, 1.0) * vec2(sin(dqFase) + 0.4 * sin(dqFase * 2.3 + position.y), cos(dqFase * 0.8) * 0.6) * 0.16 / aoEsc;
      #endif`);
    sh.vertexShader = 'attribute float tinte;\nuniform float uAO;\n' + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(color, instanceColor.xyz * clamp(dot(color, vec3(0.2126, 0.7152, 0.0722)) / 0.28, 0.55, 1.5), tinte);
      #endif
      #ifdef USE_INSTANCING
        float aoEsc = length(instanceMatrix[1].xyz) * length(modelMatrix[1].xyz);
      #else
        float aoEsc = length(modelMatrix[1].xyz);
      #endif
      vColor.xyz *= 1.0 - uAO * (1.0 - smoothstep(0.0, 1.3, position.y * aoEsc));`);
  };
  material.customProgramCacheKey = () => 'tapa-kenney';
  return material;
  }
  function geo(n) {
    if (cache.has(n)) return cache.get(n);
    const d = ind[n];
    if (!d) throw new Error('modelo ' + n + ' no esta en kenney.json');
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, d.p, d.v * 3), 3));
    const c8 = new Uint8Array(buf, d.c, d.v * 3), c = new Float32Array(d.v * 3);
    for (let i = 0; i < c.length; i++) c[i] = LIN[c8[i]];
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const t = new Float32Array(d.v);
    if (d.t >= 0) { const t8 = new Uint8Array(buf, d.t, d.v); for (let i = 0; i < d.v; i++) t[i] = t8[i]; }
    g.setAttribute('tinte', new THREE.BufferAttribute(t, 1));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, d.x, d.i), 1));
    g.computeBoundingSphere();
    cache.set(n, g);
    return g;
  }
  // Junta piezas colocadas ({n, x, y, z, ry, s|sx,sy,sz, color}) en una
  // geometria (una sola llamada de dibujo). color: multiplica el de la pieza.
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), tc = new THREE.Color();
  function fundir(piezas) {
    let nv = 0, ni = 0;
    for (const p of piezas) { const g = p.geo || geo(p.n); nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), tin = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const p of piezas) {
      const g = p.geo || geo(p.n), P = g.attributes.position.array, C = g.attributes.color.array, T = g.attributes.tinte.array, I = g.index.array;
      e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e);
      sc.set(p.sx || p.s || 1, p.sy || p.s || 1, p.sz || p.s || 1); v.set(p.x || 0, p.y || 0, p.z || 0);
      m4.compose(v, q, sc);
      const k = p.color ? tc.set(p.color) : null;
      for (let i = 0; i < P.length / 3; i++) {
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m4);
        pos[(ov + i) * 3] = v.x; pos[(ov + i) * 3 + 1] = v.y; pos[(ov + i) * 3 + 2] = v.z;
        col[(ov + i) * 3] = C[i * 3] * (k ? k.r : 1); col[(ov + i) * 3 + 1] = C[i * 3 + 1] * (k ? k.g : 1); col[(ov + i) * 3 + 2] = C[i * 3 + 2] * (k ? k.b : 1);
        tin[ov + i] = p.t != null ? p.t : T[i];   // t: marca de obra (arquitectura.js)
      }
      const inv = sc.x * sc.y * sc.z < 0;
      for (let i = 0; i < I.length; i += 3) { idx[oi + i] = I[i] + ov; idx[oi + i + 1] = I[inv ? i + 2 : i + 1] + ov; idx[oi + i + 2] = I[inv ? i + 1 : i + 2] + ov; }
      ov += P.length / 3; oi += I.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  /* Una pieza del kit pasa a ser un modelo propio (mundo/js/modelado.js): misma caja de referencia, otra malla. */
  const sustituir = (n, g, cj) => { cache.set(n, g); ind[n] = { ...ind[n], min: cj.min, max: cj.max }; };
  return { ind, geo, fundir, sustituir, material, materialInst, caja: n => ind[n] && { min: ind[n].min, max: ind[n].max } };
}

// Geometria a partir de triangulos sueltos [[x,y,z]×3, color] (con indice,
// color por vertice y sin tinte), para juntarla con fundir().
const tcol = new THREE.Color();
export function triangulos(lista, tinte) {
  const pos = new Float32Array(lista.length * 9), col = new Float32Array(lista.length * 9);
  lista.forEach(([a, b, c, color], i) => {
    tcol.set(color);
    [a, b, c].forEach((p, k) => { pos.set(p, i * 9 + k * 3); col.set([tcol.r, tcol.g, tcol.b], i * 9 + k * 3); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tinte', new THREE.BufferAttribute(new Float32Array(lista.length * 3).fill(tinte || 0), 1));
  g.setIndex(new THREE.BufferAttribute(Uint16Array.from({ length: lista.length * 3 }, (_, i) => i), 1));
  return g;
}

// Una casa del kit del pueblo: nx × nz celdas de 1 (frente hacia +z), dos
// plantas (piedra abajo, entramado de madera arriba), puerta en el centro del
// frente, ventanas alternas, tejado a dos aguas con alero y chimenea.
// pisos: plantas (la de abajo de piedra; las demas de madera).
// Devuelve las piezas para fundir() en unidades del kit (1 planta = 1).
export function piezasCasa(nx, nz, sem, techo, pisos = 2) {
  const r = k => { const s = Math.sin(sem * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  const piezas = [];
  const borde = (i, j, lado) => {   // lado: 0 +x, 1 -x, 2 +z, 3 -z
    const cx = i - (nx - 1) / 2, cz = j - (nz - 1) / 2, ry = [0, Math.PI, -Math.PI / 2, Math.PI / 2][lado];
    for (let piso = 0; piso < pisos; piso++) {
      const frente = lado === 2, puerta = piso === 0 && frente && i === Math.floor(nx / 2);
      const ventana = !puerta && r(i * 7 + j * 13 + lado * 3 + piso * 31) < (piso ? 0.6 : 0.45);
      const n = piso === 0 ? (puerta ? 'p_wall-door' : ventana ? 'p_wall-window-shutters' : 'p_wall')
        : (ventana ? 'p_wall-wood-window-shutters' : 'p_wall-wood');
      piezas.push({ n, x: cx, y: piso, z: cz, ry, t: piso === 0 ? (puerta ? 6 : 3) : 4 });
      // Vidriera dentro del hueco (marca 5): de noche da luz calida; una de cada cuatro queda a oscuras.
      if (ventana) { const k = r(i * 5 + j * 11 + lado * 17 + piso * 3), col = k < 0.26 ? '#2a2018' : k < 0.6 ? '#ffb45a' : '#ff9a3c'; piezas.push({ geo: triangulos([[[0.45, 0.27, 0.3], [0.45, 0.27, -0.3], [0.45, 0.73, -0.3], col], [[0.45, 0.27, 0.3], [0.45, 0.73, -0.3], [0.45, 0.73, 0.3], col]], 5), x: cx, y: piso, z: cz, ry }); }
    }
  };
  for (let i = 0; i < nx; i++) { borde(i, nz - 1, 2); borde(i, 0, 3); }
  for (let j = 0; j < nz; j++) { borde(nx - 1, j, 0); borde(0, j, 1); }
  // Tejado: cumbrera a lo largo del lado largo.
  const largoX = nx >= nz, L = (largoX ? nx : nz) / 2, S = (largoX ? nz : nx) / 2, o = 0.22, y0 = pisos, alto = S * 0.95 + 0.15;
  const pend = alto / S, ya = y0 - o * pend;
  const P = (a, y, b) => largoX ? [a, y, b] : [b, y, a];
  const T = [], tc = techo || '#c2453a', gab = '#d9d3c7', vig = '#8a4f2a';
  for (const sg of [1, -1]) {
    // Faldon (dos triangulos), desde el alero hasta la cumbrera.
    const a0 = [-(L + o), ya, sg * (S + o)], a1 = [L + o, ya, sg * (S + o)], c0 = [-(L + o), y0 + alto, 0], c1 = [L + o, y0 + alto, 0];
    const q = sg > 0 ? [[a0, a1, c1], [a0, c1, c0]] : [[a1, a0, c0], [a1, c0, c1]];
    for (const [x, y, z] of q) T.push([P(...x), P(...y), P(...z), tc]);
    // Hastial (triangulo de pared) en cada extremo, por dentro del alero.
    const e = sg * L, g0 = [e, y0, -S], g1 = [e, y0, S], g2 = [e, y0 + alto - 0.02, 0];
    T.push(sg > 0 ? [P(...g0), P(...g2), P(...g1), gab] : [P(...g1), P(...g2), P(...g0), gab]);
    // Viga del alero en el hastial (linea de madera).
    const v0 = [e + sg * 0.01, y0, -S - 0.04], v1 = [e + sg * 0.01, y0 + alto, 0], v2 = [e + sg * 0.01, y0 + alto - 0.12, 0], v3 = [e + sg * 0.01, y0 - 0.1, -S - 0.04];
    T.push(sg > 0 ? [P(...v0), P(...v1), P(...v2), vig] : [P(...v0), P(...v2), P(...v1), vig]);
    T.push(sg > 0 ? [P(...v0), P(...v2), P(...v3), vig] : [P(...v0), P(...v3), P(...v2), vig]);
    const w0 = [e + sg * 0.01, y0, S + 0.04], w3 = [e + sg * 0.01, y0 - 0.1, S + 0.04];
    T.push(sg > 0 ? [P(...w0), P(...v2), P(...v1), vig] : [P(...w0), P(...v1), P(...v2), vig]);
    T.push(sg > 0 ? [P(...w0), P(...w3), P(...v2), vig] : [P(...w0), P(...v2), P(...w3), vig]);
  }
  // Al cambiar x por z la figura se refleja: se da la vuelta a los triangulos.
  piezas.push({ geo: triangulos(largoX ? T : T.map(([a, b, c, k]) => [a, c, b, k]), 2) });
  // Chimenea sobre un faldon.
  const ch = L - 0.8, cs = -S * 0.45;
  piezas.push({ n: 'p_chimney', ...(largoX ? { x: ch - 0.32, z: cs } : { x: cs, z: ch - 0.32 }), y: y0 + alto - S * 0.45 * pend - 0.35, sy: 1.1, t: 3 });
  return piezas;
}
