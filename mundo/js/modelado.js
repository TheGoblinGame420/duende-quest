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
// Follaje: las copas llevan un nucleo (marca 10) y encima tarjetas de hojas
// (marca 9, con UV) recortadas con assets/3d/dq_follaje.png, la unica textura,
// horneada en Blender y compartida por todos los arboles. En calidad baja y
// minima (o si la textura no llega) las tarjetas no se dibujan: queda la masa.
// Si el indice o un paquete no llegan, el mundo se ve con el kit de siempre.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { transparentar } from './tapa.js?v=375';

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
        if (buf.byteLength !== j.bytes || (j.v !== 2 && j.v !== 3)) throw new Error('paquete de otra version');
        return { j, buf };
      } catch (e) { console.warn('[3D] sin el paquete de modelos «' + f + '»:', e); return null; }
    }))).filter(Boolean);
    return paqs.length ? crear(paqs, { ...(fx || {}), base }) : null;
  })();
  return promesa;
}

function crear(paqs, fx) {
  const modelos = {}, cache = new Map(), floraDe = {}, kit = {};
  let ligera = false;   // calidad con la que se cargo el mundo
  try { const e = window.dqGfx && window.dqGfx.ajustes && window.dqGfx.ajustes.efectivo; ligera = e === 'baja' || e === 'minima'; } catch (e) { /* sin menu */ }
  let follaje = '';   // la textura de follaje (la declara el paquete que la hornea)
  for (const { j } of paqs) if (!follaje && j.tex && j.tex.follaje) follaje = fx.base + j.tex.follaje.f + '?h=' + j.tex.follaje.h;
  for (const { j, buf } of paqs) for (const n in j.modelos) {
    const m = modelos[n] = { ...j.modelos[n], buf, familia: j.familia }, s = m.sus || {};
    if (s.flora) (floraDe[s.flora] = floraDe[s.flora] || []).push({ n, alto: s.tam || s.alto || 0, modo: s.modo || '', zonas: s.zonas || null, orilla: !!s.orilla, lejos: s.lejos && j.modelos[s.lejos] ? s.lejos : n });
    if (s.kit) kit[s.kit] = n;
  }
  // Geometria de un modelo en un nivel (0 alto, 1 medio, 2 bajo). Se crea una vez.
  function geo(n, lod = 0) {
    const k = n + '|' + lod;
    if (cache.has(k)) return cache.get(k);
    const m = modelos[n];
    if (!m) throw new Error('modelo ' + n + ' no esta en los paquetes');
    const L = m.lods[Math.min(lod, m.lods.length - 1)], v = L.v, buf = m.buf;
    // Formato v2/v3 (tools/blender/dq_lib.py, _bloque): planos de bytes; posiciones a 12 bits en diferencias, indices relativos.
    // v3: los niveles con tarjetas de follaje (L.uv) llevan dos planos mas (u, v) antes de los indices.
    const B = new Uint8Array(buf, L.o), ni = L.i, oi = (L.uv ? 16 : 14) * v;
    const zz = (o, k) => { const u = B[o + k] | (B[o + k + (o < 6 * v ? v : ni)] << 8); return (u >>> 1) ^ -(u & 1); };
    const pos = new Float32Array(v * 3), nor = new Int8Array(v * 3), col = new Float32Array(v * 3), tin = new Float32Array(v), w8 = new Uint8Array(v), idx = new Uint16Array(ni);
    for (let e = 0; e < 3; e++) {
      const k = (m.max[e] - m.min[e]) / 4095;
      for (let i = 0, a = 0; i < v; i++) { a += zz(e * 2 * v, i); pos[i * 3 + e] = m.min[e] + a * k; nor[i * 3 + e] = B[6 * v + e * v + i] << 24 >> 24; col[i * 3 + e] = LIN[B[9 * v + e * v + i]]; }
    }
    for (let i = 0; i < v; i++) { tin[i] = B[12 * v + i]; w8[i] = B[13 * v + i]; }
    for (let i = 0, tope = -1; i < ni; i++) { const x = tope + 1 - zz(oi, i); idx[i] = x; if (x > tope) tope = x; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
    g.setAttribute('dqW', new THREE.BufferAttribute(w8, 1, true));
    if (L.uv) { const uv = new Uint8Array(v * 2); for (let i = 0; i < v; i++) { uv[i * 2] = B[14 * v + i]; uv[i * 2 + 1] = B[15 * v + i]; } g.setAttribute('dqUV', new THREE.BufferAttribute(uv, 2, true)); }
    /* En calidad baja o minima (al cargar) las tarjetas de follaje ni se suben: queda la masa simple. */
    let ix = idx;
    if (L.uv && ligera) { let k = 0; ix = new Uint16Array(ni); for (let i = 0; i < ni; i += 3) if (tin[idx[i]] !== 9) { ix[k++] = idx[i]; ix[k++] = idx[i + 1]; ix[k++] = idx[i + 2]; } ix = ix.subarray(0, k); }
    g.setIndex(new THREE.BufferAttribute(ix, 1));
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
  return { modelos, geo, flora, kit, material: materialOrganico(fx, ligera ? '' : follaje, ligera), caja: n => modelos[n] && { min: modelos[n].min, max: modelos[n].max }, tris: (n, lod) => modelos[n].lods[lod].i / 3 };
}

// Textura de detalle (UNA para todos los modelos propios; 256 px, 128 en calidad baja). Sin UV: se proyecta desde la
// posicion del modelo, salvo en las tarjetas de follaje, que traen sus UV. Canales:
//   R = recorte de las tarjetas de hojas          G = corteza (relieve ya iluminado, horneado en Blender)
//   B = claro y oscuro de las hojas                A = grano generico (piedra, madera lisa), hecho aqui.
// Nace entera hecha aqui (R lleno, G = grano, B = manchas) y, cuando llega assets/3d/dq_follaje.png, R, G y B se
// cambian por los horneados y se encienden las tarjetas (uDqCartas). Si no llega, el mundo se ve como antes.
function texturaDetalle(N) {
  const d = new Uint8Array(N * N * 4), K = 10, h = (x, y, s) => { let n = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2654435761; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const rp = (x, y, px, py, s) => { const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), mx = v => ((v % px) + px) % px, my = v => ((v % py) + py) % py;
    const a = h(mx(x0), my(y0), s), b = h(mx(x0 + 1), my(y0), s), c = h(mx(x0), my(y0 + 1), s), e = h(mx(x0 + 1), my(y0 + 1), s); return (a + (b - a) * sx) * (1 - sy) + (c + (e - c) * sx) * sy; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * K, v = y / N * K, cx = Math.floor(u), cy = Math.floor(v);
    let f1 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = cx + i, gy = cy + j, mx = ((gx % K) + K) % K, my = ((gy % K) + K) % K; f1 = Math.min(f1, Math.hypot(u - (gx + 0.15 + h(mx, my, 1) * 0.7), v - (gy + 0.15 + h(mx, my, 2) * 0.7))); }
    const hoja = Math.min(1, Math.max(0, 0.92 - f1 * 0.95)) * 0.75 + rp(u * 3.2, v * 3.2, 32, 32, 3) * 0.25;
    const veta = rp(u * 6.4, v * 0.8, 64, 8, 4) * 0.55 + rp(u * 12.8, v * 1.6, 128, 16, 5) * 0.25 + rp(u * 3.2, v * 3.2, 32, 32, 6) * 0.2;
    const o = (y * N + x) * 4; d[o] = 255; d[o + 1] = veta * 255; d[o + 2] = hoja * 255; d[o + 3] = veta * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Baja la textura de follaje horneada y la vuelca en la de detalle (al tamaño que esta tenga). El PNG no lleva canal
// alfa a proposito: asi el lienzo no premultiplica ni toca los canales.
function cargarFollaje(url, tex, cartas) {
  if (!url || typeof Image !== 'function' || typeof document === 'undefined') return;
  const img = new Image();
  img.onload = () => {
    try {
      const N = tex.image.width, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N);
      const s = g.getImageData(0, 0, N, N).data, d = tex.image.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = (y * N + x) * 4, b = ((N - 1 - y) * N + x) * 4; d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; }
      tex.needsUpdate = true; cartas.value = 1;
    } catch (e) { console.warn('[3D] sin la textura de follaje (las copas se quedan en masa):', e); }
  };
  img.onerror = () => console.warn('[3D] sin la textura de follaje (las copas se quedan en masa)');
  img.src = url;
}

// Material de los modelos propios: color por vertice con sombreado suave. Marcas (`tinte`):
//   1 hoja    → toma el color de la instancia (el verde de la zona) y se mece con el viento (dqW);
//   9 fronda  → tarjeta de hojas: como la hoja, recortada con la textura (R) por sus UV. Si su «temblor» (4 bits
//               bajos de dqW) no es 0, es un CARTEL: sus 4 vertices llegan en el mismo punto y aqui se abren en
//               pantalla (lado = 0,3 m + 0,15 m · esos bits), mirando a la camara y apuntando hacia fuera de la copa;
//   10 nucleo → masa interior de una copa con tarjetas: hoja que se oscurece mientras las tarjetas se dibujan;
//   3 piedra y 8 monolito → el musgo de la zona cubre lo que mira arriba;
//   4 madera  → corteza con relieve horneado;  7 emisivo → brilla (mas de noche);  el resto → su color tal cual.
// Viento (dqW): 4 bits altos = balanceo lento de todo el arbol (tronco), 4 bajos = temblor rapido de la hoja.
// De calidad media para arriba (uMusgo = 1) suma el detalle de hoja y corteza, las tarjetas, la variacion de tono por
// arbol y por altura, la hoja a contraluz y un borde de luz en el follaje. En baja y minima: la masa simple de siempre.
function materialOrganico(fx, follaje, ligera) {
  const mat = transparentar(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const prev = mat.onBeforeCompile, cero = { value: 0 }, det = { value: texturaDetalle(ligera ? 128 : 256) }, cartas = { value: 0 };
  cargarFollaje(follaje, det.value, cartas);
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.uT = fx.uT || cero; sh.uniforms.uViento = fx.uViento || cero; sh.uniforms.uMusgo = fx.uMusgo || cero; sh.uniforms.uBrillo = fx.uBrillo || { value: 1 }; sh.uniforms.uDqDet = det; sh.uniforms.uDqCartas = cartas;
    sh.vertexShader = '// dq:modelado\nattribute float tinte;\nattribute float dqW;\nattribute vec2 dqUV;\nuniform float uT;\nuniform float uViento;\nuniform float uMusgo;\nuniform float uDqCartas;\nvarying vec4 vDqMus;\nvarying vec3 vDqP;\nvarying vec3 vDqN;\nvarying vec4 vDqM;\nvarying vec2 vDqUV;\n' + sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      float dqCarta = step(8.5, tinte) * step(tinte, 9.5);
      float dqHoja = step(0.5, tinte) * step(tinte, 1.5) + step(8.5, tinte);
      float dqCon = step(0.5, uMusgo * uDqCartas);
      float dqB = floor(dqW * 255.0 + 0.5);
      float dqLento = floor(dqB / 16.0) / 15.0;
      float dqBajo = dqB - floor(dqB / 16.0) * 16.0;
      float dqCartel = dqCarta * step(0.5, dqBajo);
      vec2 dqEsq = fract(dqUV * 2.0);
      vDqM = vec4(dqHoja, step(6.5, tinte) * step(tinte, 7.5), dqCarta, step(3.5, tinte) * step(tinte, 4.5));
      vDqUV = dqUV;
      vDqP = position; vDqN = normal;
      vDqMus = vec4(0.0);
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(color, instanceColor.xyz * color / vec3(0.12, 0.36, 0.08), dqHoja);
        vDqMus = vec4(instanceColor.xyz * 0.62, uMusgo * (step(2.5, tinte) * step(tinte, 3.5) + step(7.5, tinte) * step(tinte, 8.5)));
      #endif
      #ifdef USE_INSTANCING
        /* Cada arbol, su tono (de calido a frio) y mas claro arriba que abajo; el nucleo de la copa, en sombra. */
        float dqAz = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vColor.xyz *= mix(vec3(1.0), mix(vec3(1.1, 1.0, 0.8), vec3(0.88, 1.0, 1.1), dqAz) * mix(0.88, 1.1, clamp(position.y * 0.11, 0.0, 1.0)), dqHoja * uMusgo);
      #endif
      vColor.xyz *= 1.0 - 0.5 * step(9.5, tinte) * dqCon;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float dqEsc = max(length(instanceMatrix[1].xyz), 0.0001);
        /* Temblor: en la hoja, lo que diga el modelo; en una tarjeta fija, nada donde nace y todo en la punta; el cartel tiembla al abrirse. */
        float dqRapido = mix(dqBajo / 15.0, dqEsq.y * (1.0 - dqCartel), dqCarta);
        float dqFase = uT * 1.25 + instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.17;
        /* Dos frecuencias: el tronco y la copa entera se balancean despacio; la hoja tiembla rapido encima. */
        transformed.xz += uViento * dqLento / dqEsc * clamp(position.y * dqEsc * 0.14, 0.0, 1.0) * 0.17 * vec2(sin(dqFase) + 0.4 * sin(dqFase * 2.3 + position.y * 0.5), cos(dqFase * 0.8) * 0.6);
        float dqF2 = uT * 4.7 + dqFase * 3.0 + position.x * 1.7 + position.z * 2.3 + position.y * 1.1;
        transformed += uViento * dqRapido * dqHoja / dqEsc * (vec3(0.0, 0.035, 0.0) * sin(dqF2 * 0.62) + normal * (0.012 + 0.03 * dqCarta) * sin(dqF2));
        /* Sin tarjetas (calidad baja, o la textura no llego): se pliegan en un punto y no se dibujan. */
        transformed *= 1.0 - dqCarta * (1.0 - dqCon);
      #endif`).replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        if (dqCartel * dqCon > 0.5) {
          /* Cartel: el racimo se abre en pantalla, con su tallo hacia el centro de la copa (la normal, vista desde la camara). */
          vec2 dqQ = step(0.5, dqEsq) - 0.5;
          float dqG = (fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5) * 1.3 + 0.07 * uViento * sin(dqF2 * 0.5);
          vec2 dqUp = normalize(normalize(transformedNormal).xy + vec2(0.0, 0.3));
          dqUp = vec2(dqUp.x * cos(dqG) - dqUp.y * sin(dqG), dqUp.x * sin(dqG) + dqUp.y * cos(dqG));
          /* Pegado a la camara (el duende bajo la copa) el racimo se encoge: no tapa media pantalla. */
          float dqLado = (0.3 + 0.15 * dqBajo) * dqEsc * smoothstep(0.8, 3.2, -mvPosition.z);
          mvPosition.xy += (vec2(dqUp.y, -dqUp.x) * dqQ.x + dqUp * (dqQ.y + 0.32)) * dqLado;
          mvPosition.z += dqLado * 0.38;   /* un poco hacia la camara: el racimo queda por delante de la masa de la que sale */
          gl_Position = projectionMatrix * mvPosition;
        }
      #endif`);
    sh.fragmentShader = '// dq:modelado\nuniform float uBrillo;\nuniform float uMusgo;\nuniform sampler2D uDqDet;\nvarying vec4 vDqMus;\nvarying vec3 vDqP;\nvarying vec3 vDqN;\nvarying vec4 vDqM;\nvarying vec2 vDqUV;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      /* Una sola lectura de textura: las tarjetas por sus UV; lo demas, proyectado por el eje que mas mira la cara
         (en hojas, manchas; en madera, la corteza a lo largo del tronco). */
      vec3 dqA = abs(vDqN);
      vec2 dqUV = dqA.y > 0.62 ? vDqP.xz : (dqA.x > dqA.z ? vDqP.zy : vDqP.xy);
      vec4 dqD = texture2D(uDqDet, mix(dqUV * mix(vec2(0.5, 0.16), vec2(0.36), vDqM.x), vDqUV, vDqM.z));
      if (vDqM.z > 0.5 && dqD.r < 0.4) discard;
      #include <map_fragment>`).replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      diffuseColor.rgb = mix(diffuseColor.rgb, vDqMus.rgb, vDqMus.a * smoothstep(0.45, 0.85, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));
      {
        float dqR = 1.0 - abs(dot(normal, normalize(vViewPosition)));
        float dqK = mix(mix(0.55 + 0.9 * dqD.a, 0.34 + 1.32 * dqD.g, vDqM.w), mix(0.55 + 0.9 * dqD.b, 0.42 + 1.16 * dqD.b, vDqM.z), vDqM.x);
        diffuseColor.rgb *= mix(1.0, dqK * (1.0 + vDqM.x * 0.45 * dqR * dqR * dqR), uMusgo * (1.0 - vDqM.y));
      }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
      {
        /* Hoja a contraluz: con el sol detras, la luz la atraviesa y se enciende en amarillo verdoso. */
        vec3 dqL = directionalLights[0].direction;
        float dqTr = pow(max(-dot(normalize(vViewPosition), dqL), 0.0), 3.0) * 0.6 + max(-dot(normal, dqL), 0.0) * 0.2;
        reflectedLight.directDiffuse += directionalLights[0].color * diffuseColor.rgb * vec3(1.15, 1.1, 0.55) * (RECIPROCAL_PI * dqTr * vDqM.x * uMusgo * (0.4 + 0.6 * vDqM.z));
      }
      #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n      totalEmissiveRadiance += diffuseColor.rgb * vDqM.y * uBrillo;');
  };
  mat.customProgramCacheKey = () => 'tapa-dqm2';
  mat.userData.dqCartas = cartas;   /* para medir: 0 pliega las tarjetas, 1 las dibuja */
  return mat;
}
