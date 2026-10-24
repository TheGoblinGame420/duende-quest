// ═══════════════════════════════════════════════════════
// Empaqueta modelos de los kits CC0 de Kenney (kenney.nl) para el 3D.
//
//   node tools/kenney_build.mjs <carpeta con los zips descomprimidos>
//
// Lee cada GLB, aplica las transformaciones de sus nodos, junta todas sus
// primitivas y "hornea" el color (factor del material × textura de paleta
// muestreada en la UV) en un color por vertice. Sale un solo binario
// (assets/3d/kenney.bin) con posiciones, colores e indices de todos los
// modelos, y un indice JSON (assets/3d/kenney.json). En el juego se dibujan
// con un unico MeshLambertMaterial de sombreado plano (sin normales ni
// texturas), igual que el resto del mundo, y se pueden instanciar.
// Los vertices de hojas y hierba llevan una marca "tinte": el juego los tiñe
// con el color de cada zona sin tocar troncos ni piedras.
// ═══════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const RAIZ = process.argv[2];
if (!RAIZ) { console.error('Uso: node tools/kenney_build.mjs <carpeta de los kits>'); process.exit(1); }
const KITS = {
  n: path.join(RAIZ, 'x_kenney_nature-kit/Models/GLTF format'),
  p: path.join(RAIZ, 'x_kenney_fantasy-town-kit_2.0/Models/GLB format'),
  c: path.join(RAIZ, 'x_kenney_castle-kit/Models/GLB format'),
};
const LISTA = {
  n: ['tree_default', 'tree_oak', 'tree_fat', 'tree_tall', 'tree_simple', 'tree_simple_dark', 'tree_pineTallA_detailed', 'tree_pineTallA', 'tree_pineTallC',
    'tree_pineTallD', 'tree_pineSmallB', 'tree_pineRoundC', 'tree_palmTall', 'tree_palmBend',
    'plant_bushLarge', 'plant_bushDetailed', 'plant_bush', 'cactus_tall', 'cactus_short',
    'rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'stone_largeA', 'stone_largeB', 'stone_largeC', 'rock_tallA', 'stone_tallA', 'stone_tallB',
    'statue_column', 'statue_columnDamaged', 'statue_obelisk', 'statue_block',
    'flower_purpleA', 'flower_redA', 'flower_yellowA', 'flower_purpleB', 'flower_yellowB', 'mushroom_red', 'mushroom_redGroup', 'mushroom_tanGroup',
    'grass_large', 'grass_leafsLarge', 'stump_old', 'stump_roundDetailed', 'log', 'log_stack', 'campfire_stones', 'campfire_logs',
    'tent_detailedOpen', 'fence_simple', 'sign', 'pot_large', 'lily_large', 'crop_pumpkin'],
  p: ['wall', 'wall-window-shutters', 'wall-window-glass', 'wall-window-round', 'wall-door', 'wall-corner', 'wall-half', 'wall-slope',
    'wall-wood', 'wall-wood-window-shutters', 'wall-wood-window-glass', 'wall-wood-door', 'wall-wood-corner', 'wall-wood-slope', 'wall-wood-half',
    'roof', 'roof-left', 'roof-right', 'roof-gable', 'roof-gable-end', 'roof-gable-top', 'roof-corner', 'roof-point', 'roof-flat', 'roof-window',
    'roof-high', 'roof-high-gable', 'roof-high-gable-end', 'roof-high-point', 'chimney', 'chimney-base', 'chimney-top',
    'fountain-round', 'fountain-round-detail', 'stall', 'stall-red', 'stall-green', 'stall-bench', 'stall-stool', 'lantern',
    'windmill', 'blade', 'watermill', 'wheel', 'cart', 'cart-high', 'banner-red', 'banner-green', 'fence', 'fence-gate', 'hedge', 'hedge-large',
    'planks', 'overhang', 'poles', 'pillar-stone', 'pillar-wood', 'stairs-wood', 'rock-large', 'tree', 'tree-high'],
  c: ['tower-square-base', 'tower-square-mid', 'tower-square-mid-windows', 'tower-square-mid-door', 'tower-square-top', 'tower-square-top-roof',
    'tower-square-top-roof-high', 'tower-square-roof', 'tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-top', 'tower-hexagon-roof',
    'wall', 'wall-corner', 'wall-doorway', 'wall-half', 'wall-pillar', 'gate', 'metal-gate', 'flag', 'flag-banner-long', 'flag-banner-short',
    'flag-pennant', 'flag-wide', 'siege-catapult', 'siege-ballista', 'siege-trebuchet', 'siege-tower', 'stairs-stone', 'rocks-large', 'bridge-straight', 'tower-top'],
};

// ── PNG (8 bits; RGB, RGBA o paleta) ──
function leerPng(f) {
  const b = fs.readFileSync(f);
  let w = 0, h = 0, tipo = 0, pal = null, trns = null; const idat = [];
  for (let o = 8; o < b.length;) {
    const len = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8) throw new Error('PNG de ' + d[8] + ' bits'); tipo = d[9]; }
    else if (t === 'PLTE') pal = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const crudo = zlib.inflateSync(Buffer.concat(idat));
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : 1, fila = w * bpp;
  const px = Buffer.alloc(h * fila);
  for (let y = 0; y < h; y++) {
    const f0 = crudo[y * (fila + 1)], src = y * (fila + 1) + 1;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? px[y * fila + x - bpp] : 0, up = y ? px[(y - 1) * fila + x] : 0, c = y && x >= bpp ? px[(y - 1) * fila + x - bpp] : 0;
      let v = crudo[src + x];
      if (f0 === 1) v += a; else if (f0 === 2) v += up; else if (f0 === 3) v += (a + up) >> 1;
      else if (f0 === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * fila + x] = v & 255;
    }
  }
  return { w, h, rgb(u, v) {
    const x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w))), y = Math.min(h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * h)));
    const i = (y * w + x) * bpp;
    if (tipo === 3) { const k = px[i]; return [pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2]]; }
    return [px[i], px[i + 1], px[i + 2]];
  } };
}
const aLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const aSrgb = l => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));

// ── Matrices 4x4 (columnas, como glTF) ──
const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; }
function trs(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

const texCache = new Map();
function leerGlb(f) {
  const b = fs.readFileSync(f);
  const jl = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jl));
  const bin = b.subarray(20 + jl + 8);
  const acc = i => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const paso = bv.byteStride || n * T.BYTES_PER_ELEMENT, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const out = new Float64Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const o = base + k * paso + c * T.BYTES_PER_ELEMENT;
      let v = T === Float32Array ? bin.readFloatLE(o) : T === Uint32Array ? bin.readUInt32LE(o) : T === Uint16Array ? bin.readUInt16LE(o) : bin[o];
      if (a.normalized) v /= T === Uint16Array ? 65535 : 255;
      out[k * n + c] = v;
    }
    return out;
  };
  const tex = m => {
    const t = m && m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
    if (!t) return null;
    const img = j.images[j.textures[t.index].source];
    const ruta = path.join(path.dirname(f), img.uri);
    if (!texCache.has(ruta)) texCache.set(ruta, leerPng(ruta));
    return texCache.get(ruta);
  };
  const pos = [], col = [], tin = [], idx = [];
  const visitar = (ni, padre) => {
    const n = j.nodes[ni], M = mul(padre, trs(n));
    if (n.mesh !== undefined) for (const pr of j.meshes[n.mesh].primitives) {
      const P = acc(pr.attributes.POSITION), UV = pr.attributes.TEXCOORD_0 !== undefined ? acc(pr.attributes.TEXCOORD_0) : null;
      const mat = j.materials[pr.material] || {}, fac = (mat.pbrMetallicRoughness || {}).baseColorFactor || [1, 1, 1, 1], T = tex(mat);
      const tinte = /leaf|grass|bush/i.test(mat.name || '') ? 1 : 0;
      const b0 = pos.length / 3, nv = P.length / 3;
      for (let k = 0; k < nv; k++) {
        const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2];
        pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
        const t = T && UV ? T.rgb(UV[k * 2], UV[k * 2 + 1]) : [255, 255, 255];
        col.push(aSrgb(Math.min(1, fac[0] * aLin(t[0]))), aSrgb(Math.min(1, fac[1] * aLin(t[1]))), aSrgb(Math.min(1, fac[2] * aLin(t[2]))));
        tin.push(tinte);
      }
      const I = pr.indices !== undefined ? acc(pr.indices) : Array.from({ length: nv }, (_, k) => k);
      // Si la matriz invierte (escala negativa) se da la vuelta a los triangulos.
      const det = M[0] * (M[5] * M[10] - M[9] * M[6]) - M[4] * (M[1] * M[10] - M[9] * M[2]) + M[8] * (M[1] * M[6] - M[5] * M[2]);
      for (let k = 0; k < I.length; k += 3) det < 0 ? idx.push(b0 + I[k], b0 + I[k + 2], b0 + I[k + 1]) : idx.push(b0 + I[k], b0 + I[k + 1], b0 + I[k + 2]);
    }
    for (const c of n.children || []) visitar(c, M);
  };
  for (const ni of j.scenes[j.scene || 0].nodes) visitar(ni, ident());
  return { pos, col, tin, idx };
}

const indice = {}, trozos = [];
let off = 0;
const pon = (buf) => { const pad = (4 - (off % 4)) % 4; if (pad) { trozos.push(Buffer.alloc(pad)); off += pad; } const o = off; trozos.push(buf); off += buf.length; return o; };
let total = 0;
for (const k of Object.keys(LISTA)) for (const n of LISTA[k]) {
  const f = path.join(KITS[k], n + '.glb');
  if (!fs.existsSync(f)) { console.warn('falta', k, n); continue; }
  const m = leerGlb(f), nv = m.pos.length / 3;
  if (nv > 65535) throw new Error(n + ': demasiados vertices');
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], m.pos[i * 3 + c]); max[c] = Math.max(max[c], m.pos[i * 3 + c]); }
  const P = Buffer.from(new Float32Array(m.pos).buffer), C = Buffer.from(Uint8Array.from(m.col)), T = Buffer.from(Uint8Array.from(m.tin)), I = Buffer.from(new Uint16Array(m.idx).buffer);
  const conTinte = m.tin.some(x => x);
  indice[k + '_' + n] = { v: nv, i: m.idx.length, p: pon(P), c: pon(C), t: conTinte ? pon(T) : -1, x: pon(I), min: min.map(x => +x.toFixed(3)), max: max.map(x => +x.toFixed(3)) };
  total += nv;
}
fs.mkdirSync('assets/3d', { recursive: true });
const todo = Buffer.concat(trozos);
fs.writeFileSync('assets/3d/kenney.bin', todo);
fs.writeFileSync('assets/3d/kenney.bin.gz', zlib.gzipSync(todo, { level: 9 }));
fs.writeFileSync('assets/3d/kenney.json', JSON.stringify(indice));
console.log(Object.keys(indice).length, 'modelos,', total, 'vertices,', (off / 1024).toFixed(0), 'KB');
