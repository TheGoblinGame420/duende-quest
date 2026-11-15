// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — el Abismo de Éter en el cliente
//
// Islas flotantes (la cara de arriba sigue alturaAbismo, la de abajo es un
// cono de roca con cristales colgando), los bastiones de la Luz y de la
// Sombra, la Fortaleza del Nucleo, los portales de vuelta y nubes de eter
// por debajo. Todo low-poly con sombreado plano.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { ABISMO, ABISMO_X0, alturaAbismo, portalBase, CENTRO_NUCLEO, MURO_NUCLEO, PUERTA_NUCLEO, MAQUINA, maquinasAbismo } from '/mmo/js/abismo3d.js';

const lam = (c, extra) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(extra || {}) });
const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/* v393: modelos de Blender (familia «abismo», tools/blender/modelos/abismo.py): panzas de roca con raices y cristales,
   puentes rotos, la aguja y el cristal del Nucleo, estandartes y portales de cada faccion. Junta copias colocadas
   ({ n, x, y, z, rot, s }) de modelos del paquete en UNA geometria relativa a `c` (como fundir() de ruinas.js). */
function fundirPaq(PAQ, piezas, lod, c) {
  const gs = piezas.map(p => PAQ.geo(p.n, lod));
  let nv = 0, ni = 0;
  for (const q of gs) { nv += q.attributes.position.count; ni += q.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), col = new Float32Array(nv * 3), tin = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  piezas.forEach((p, j) => {
    const q = gs[j], P = q.attributes.position.array, N = q.attributes.normal.array, C = q.attributes.color.array, T = q.attributes.tinte.array, I = q.index.array;
    const cs = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0), s = p.s || 1, n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = (ov + i) * 3, x = P[a] * s, z = P[a + 2] * s;
      pos[b] = x * cs + z * sn + p.x - c.x; pos[b + 1] = P[a + 1] * s + p.y - c.y; pos[b + 2] = -x * sn + z * cs + p.z - c.z;
      nor[b] = Math.round(N[a] * cs + N[a + 2] * sn); nor[b + 1] = N[a + 1]; nor[b + 2] = Math.round(-N[a] * sn + N[a + 2] * cs);
      col[b] = C[a]; col[b + 1] = C[a + 1]; col[b + 2] = C[a + 2];
      tin[ov + i] = T[i];
    }
    for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov;
    ov += n; oi += I.length;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/* Cara de arriba de una isla con color por vertice: hierba de eter (o la losa de su bastion) con manchas, y la franja
   del borde que se desploma en tierra y roca, a juego con la boca de la panza modelada. Misma altura que la fisica. */
const PISO = { luz: ['#7c8291', '#90959f'], sombra: ['#4a3552', '#5d4664'], nucleo: ['#6c6680', '#7d778e'], eter: ['#5b5477', '#4f5a43'] };
function pisoIsla(is, cx, cz) {
  const R = [0.01, 0.16, 0.32, 0.47, 0.6, 0.71, 0.8, 0.86, 0.9, 0.935, 0.965, 1.0], lados = is.r > 30 ? 40 : 28;
  const pos = [], col = [], idx = [], c = new THREE.Color(), c2 = new THREE.Color(), tierra = new THREE.Color('#3a3029'), rocaB = new THREE.Color('#4b4553');
  const pal = PISO[is.base || (is.nucleo ? 'nucleo' : 'eter')];
  c.set(pal[0]); const A = c.clone(); c.set(pal[1]); const B = c.clone();
  for (let j = 0; j < R.length; j++) for (let k = 0; k < lados; k++) {
    const a = k / lados * Math.PI * 2, r = R[j] * is.r, x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, Math.max(is.h - 4, alturaAbismo(cx + x, cz + z)), z);
    const m = rnd(Math.floor((cx + x) / 5), Math.floor((cz + z) / 5));
    c.copy(A).lerp(B, m * 0.8).multiplyScalar(0.86 + rnd(k, j) * 0.22);
    const borde = Math.min(1, Math.max(0, (R[j] - 0.86) / 0.11));
    if (borde > 0) c.lerp(c2.copy(tierra).lerp(rocaB, R[j] >= 0.99 ? 0.35 : 0), borde);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < R.length - 1; j++) for (let k = 0; k < lados; k++) {
    const a = j * lados + k, b = j * lados + (k + 1) % lados;
    idx.push(a, b, a + lados, b, b + lados, a + lados);   /* cara hacia arriba */
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// PAQ (opcional): paquete de modelos propios (mundo/js/modelado.js). opc: { nivel, sombras } (calidad efectiva y sombras).
export function construirAbismo(escena, kit, PAQ, opc) {
  const g = new THREE.Group();
  const solidos = [];
  const cesped = lam(0x6d5bd0), roca = lam(0x3a2f55), cristal = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const conoG = new THREE.ConeGeometry(1, 1, 9);
  const hay = n => !!(PAQ && PAQ.modelos && PAQ.modelos[n]);
  const nivel = (opc && opc.nivel) || 'media', baja = nivel === 'minima' || nivel === 'baja', alta = nivel === 'alta' || nivel === 'ultra';
  const sombras = !!(opc && opc.sombras), mallas = [], info = { islas: 0, puentes: 0, estandartes: 0, portales: 0, nucleo: false };
  // Un sitio: piezas fundidas por nivel de detalle dentro de un THREE.LOD (el motor elige el nivel con la camara).
  const sitio = (piezas, c, radio, sombra) => {
    if (!piezas.length) return null;
    const lod = new THREE.LOD();
    lod.position.set(c.x, c.y, c.z);
    const niveles = baja ? [[1, 0], [2, radio + 140]] : [[0, 0], [1, radio * 1.2 + (alta ? 90 : 60)], [2, radio * 2 + (alta ? 260 : 190)]];
    for (const [nv, d] of niveles) {
      const m = new THREE.Mesh(fundirPaq(PAQ, piezas, nv, c), PAQ.material);
      if (sombras) { m.castShadow = !!sombra && nv < 2; m.receiveShadow = true; }
      m.matrixAutoUpdate = false; m.updateMatrix();
      lod.addLevel(m, d, 0.06); mallas.push(m);
    }
    lod.matrixAutoUpdate = false; lod.updateMatrix();
    g.add(lod);
    return lod;
  };
  const modelado = hay('isla_panza_a') && hay('isla_panza_b') && hay('isla_panza_c');
  const pisoMat = modelado ? new THREE.MeshLambertMaterial({ vertexColors: true }) : null;
  // Puentes rotos: entre islas vecinas (hueco de menos de 75 m), un arranque en cada orilla mirando a la otra.
  const puentes = ABISMO.islas.map(() => []);
  if (modelado && hay('puente_roto_a') && hay('puente_roto_b')) {
    ABISMO.islas.forEach((a, i) => ABISMO.islas.forEach((b, j) => {
      if (j <= i) return;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d - a.r - b.r > 75) return;
      for (const [o, sg, k] of [[a, 1, i], [b, -1, j]]) puentes[k].push({ ux: dx / d * sg, uz: dz / d * sg, v: (i + j + (sg > 0 ? 0 : 1)) % 2 });
    }));
  }
  ABISMO.islas.forEach((is, n) => {
    const cx = ABISMO_X0 + is.x, cz = is.z;
    if (modelado) {
      // Arriba, la cara que pisa la fisica; debajo, la panza modelada (boca de radio 10 m: se escala con la isla).
      const tm = new THREE.Mesh(pisoIsla(is, cx, cz), pisoMat);
      tm.position.set(cx, 0, cz); tm.receiveShadow = true;
      g.add(tm);
      const yb = is.h - 3.25, s = is.r / 10;
      const piezas = [{ n: 'isla_panza_' + (is.base || is.nucleo ? 'ac'[n % 2] : 'abc'[n % 3]), x: cx, y: yb, z: cz, rot: n * 1.7, s }];
      for (const p of puentes[n]) {
        const sb = 1 + Math.max(0, is.r - 16) / 64, r0 = is.r * 0.93;
        piezas.push({ n: 'puente_roto_' + 'ab'[p.v], x: cx + p.ux * r0, y: yb - 2.5, z: cz + p.uz * r0, rot: -Math.atan2(p.uz, p.ux), s: sb });
        info.puentes++;
      }
      // Racimos de cristal en las islas sin edificios (donde antes iban los octaedros).
      if (!is.base && !is.nucleo && hay('cristal_eter')) for (let k = 0; k < 3; k++) {
        const a = k * 2.3 + n, rr = is.r * 0.55, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        piezas.push({ n: 'cristal_eter', x, y: alturaAbismo(x, z) - 0.15, z, rot: a * 2.1, s: 0.9 + rnd(n, k) * 0.35 });
      }
      sitio(piezas, { x: cx, y: is.h - 8, z: cz }, is.r * 1.6, false);
      info.islas++;
      return;
    }
    // Cara de arriba: anillos desplazados con la misma altura que usa la fisica.
    const top = new THREE.RingGeometry(0.01, is.r, 28, 7).rotateX(-Math.PI / 2);
    const p = top.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.max(is.h - 4, alturaAbismo(cx + p.getX(i), cz + p.getZ(i))));
    top.computeVertexNormals();
    const tm = new THREE.Mesh(top, is.base === 'luz' ? lam(0x9fb7e8) : is.base === 'sombra' ? lam(0x5a2f6e) : is.nucleo ? lam(0x8a7fb0) : cesped);
    tm.position.set(cx, 0, cz); tm.receiveShadow = true;
    // Debajo: cono de roca invertido.
    const base = new THREE.Mesh(conoG, roca);
    base.scale.set(is.r * 0.98, is.r * 1.5, is.r * 0.98); base.rotation.x = Math.PI;
    base.position.set(cx, is.h - 4 - is.r * 0.75, cz);
    g.add(tm, base);
    // Cristales colgando del fondo.
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + n, rr = is.r * 0.45;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0).scale(0.6, 2.2, 0.6), cristal);
      c.position.set(cx + Math.cos(a) * rr, is.h - 8 - is.r * 0.5, cz + Math.sin(a) * rr);
      g.add(c);
    }
    // Rocas sueltas y algun cristal arriba en las islas sin edificios.
    if (!is.base && !is.nucleo) for (let k = 0; k < 3; k++) {
      const a = k * 2.3 + n, rr = is.r * 0.55, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0).scale(0.7, 1.8, 0.7), cristal);
      c.position.set(x, alturaAbismo(x, z) + 1, z); g.add(c);
    }
  });
  // Bastiones: agujas de su faccion alrededor del centro de la isla.
  // Con el kit de castillo de Kenney: seis torres unidas por murallas (con dos
  // puertas: hacia el portal y hacia el Nucleo), estandartes y maquinas de
  // asedio. La Sombra lleva la piedra teñida de purpura.
  const E = 3.6;
  const bastionKit = (is, f) => {
    const cx = ABISMO_X0 + is.x, cz = is.z, R = is.r * 0.62, tinte = f === 'luz' ? '#ffffff' : '#8a6a9a';
    const pb = portalBase(f), piezas = [];
    const torres = [], pendones = [], nE = 'estandarte_' + f;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; torres.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R, a]); }
    for (const [x, z, a] of torres) {
      const y = alturaAbismo(x, z) - 0.3;
      for (const [n, h] of [['c_tower-square-base', 0], ['c_tower-square-mid-windows', 1.01], ['c_tower-square-mid', 2.02], ['c_tower-square-top-roof-high', 3.03]]) piezas.push({ n, x, y: y + h * E, z, ry: -a, s: E, color: tinte });
      /* v393: el pendon modelado de la faccion (mismo sitio y medida que la pieza del kit); sin el, la del kit. */
      if (hay(nE)) pendones.push({ n: nE, x: x + Math.cos(a) * 0.48 * E, y: y + 0.9 * E, z: z + Math.sin(a) * 0.48 * E, rot: -a });
      else piezas.push({ n: 'c_flag-banner-long', x: x + Math.cos(a) * 0.48 * E, y: y + 0.9 * E, z: z + Math.sin(a) * 0.48 * E, ry: -a, s: E, color: f === 'luz' ? '#ffe7a3' : '#d4545c' });
      solidos.push({ x, z, r: 0.5 * E + 0.2 });
    }
    if (pendones.length) { sitio(pendones, { x: cx, y: alturaAbismo(cx, cz) + 7, z: cz }, R + 4, true); info.estandartes += pendones.length; }
    for (let k = 0; k < 6; k++) {
      const [x0, z0] = torres[k], [x1, z1] = torres[(k + 1) % 6];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.round(L / E), fi = Math.atan2(dz, dx);
      for (let j = 1; j < n; j++) {
        const x = x0 + dx * j / n, z = z0 + dz * j / n;
        // Puertas: el tramo frente al portal y el que mira al Nucleo.
        if (Math.hypot(x - pb.x, z - pb.z) < 7 || Math.hypot(x - cx, Math.abs(z) - Math.abs(cz) + R) < 7) continue;
        piezas.push({ n: 'c_wall', x, y: alturaAbismo(x, z) - 0.4, z, ry: -fi, s: E, color: tinte });
        solidos.push({ x, z, r: 0.5 * E + 0.1 });
      }
    }
    // Maquinas de asedio mirando al Nucleo.
    // (las mismas posiciones que valida el servidor: maquinasAbismo)
    for (const q of maquinasAbismo()) if (q.f === f) {
      piezas.push({ n: MAQUINA[q.k].modelo, x: q.x, y: alturaAbismo(q.x, q.z) - 0.1, z: q.z, ry: q.ry, s: 2.6 });
      solidos.push({ x: q.x, z: q.z, r: 2.2 });
    }
    const m = new THREE.Mesh(kit.fundir(piezas), kit.material);
    m.castShadow = true;
    g.add(m);
  };
  const bastion = (is, colA, colB, punta) => {
    const cx = ABISMO_X0 + is.x, cz = is.z;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, x = cx + Math.cos(a) * is.r * 0.62, z = cz + Math.sin(a) * is.r * 0.62, y = alturaAbismo(x, z);
      const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 14, 6), lam(colA)); torre.position.set(x, y + 7, z);
      const cima = new THREE.Mesh(new THREE.ConeGeometry(2.2, punta, 6), lam(colB)); cima.position.set(x, y + 14 + punta / 2, z);
      torre.castShadow = cima.castShadow = true;
      g.add(torre, cima);
    }
  };
  const luz = ABISMO.islas.find(i => i.base === 'luz'), sombra = ABISMO.islas.find(i => i.base === 'sombra'), nucleo = ABISMO.islas.find(i => i.nucleo);
  if (kit) { bastionKit(luz, 'luz'); bastionKit(sombra, 'sombra'); }
  else { bastion(luz, 0xf5f0e1, 0xfacc15, 6); bastion(sombra, 0x2a1838, 0xb91c1c, 9); }
  // Fortaleza del Nucleo: muralla, torre y el nucleo que brilla y gira.
  const nx = ABISMO_X0 + nucleo.x, nz = nucleo.z, ny = alturaAbismo(nx, nz);
  // Con el kit: muralla de castillo con hueco al oeste (ahi va la Puerta del
  // Nucleo durante el asedio), cuatro torres y banderas del color del dueño.
  let muro, matBandera = null;
  if (kit) {
    const piezas = [], banderas = [], N = Math.round(Math.PI * 2 * MURO_NUCLEO / E);
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2, x = CENTRO_NUCLEO.x + Math.cos(a) * MURO_NUCLEO, z = CENTRO_NUCLEO.z + Math.sin(a) * MURO_NUCLEO;
      if (Math.hypot(x - PUERTA_NUCLEO.x, z - PUERTA_NUCLEO.z) < 4.6) continue;
      piezas.push({ n: 'c_wall', x, y: alturaAbismo(x, z) - 0.4, z, ry: -(a + Math.PI / 2), s: E });
      solidos.push({ x, z, r: E / 2 + 0.1 });
    }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, x = CENTRO_NUCLEO.x + Math.cos(a) * MURO_NUCLEO, z = CENTRO_NUCLEO.z + Math.sin(a) * MURO_NUCLEO, y = alturaAbismo(x, z) - 0.3;
      for (const [n, h] of [['c_tower-square-base', 0], ['c_tower-square-mid-windows', 1.01], ['c_tower-square-mid', 2.02], ['c_tower-square-top', 3.03]]) piezas.push({ n, x, y: y + h * E, z, ry: -a, s: E });
      banderas.push({ n: 'c_flag-wide', x, y: y + 3.15 * E, z, ry: -a, s: E * 1.3 });
      solidos.push({ x, z, r: 0.5 * E + 0.2 });
    }
    muro = new THREE.Mesh(kit.fundir(piezas), kit.material);
    matBandera = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    g.add(new THREE.Mesh(kit.fundir(banderas), matBandera));
  } else {
    muro = new THREE.Mesh(new THREE.CylinderGeometry(nucleo.r * 0.7, nucleo.r * 0.72, 7, 16, 1, true), lam(0x6b6478, { side: THREE.DoubleSide }));
    muro.position.set(nx, ny + 3, nz);
  }
  /* v393: la aguja modelada (misma huella: radio 7 al pie, 26 m) y el cristal facetado; sin ellos, los de antes. */
  const torreM = hay('nucleo_torre'), cristalM = hay('nucleo_cristal');
  const torre = torreM ? null : new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 26, 8), lam(0x4b4560));
  if (torre) torre.position.set(nx, ny + 13, nz);
  else { sitio([{ n: 'nucleo_torre', x: nx, y: ny, z: nz, rot: 0 }], { x: nx, y: ny + 13, z: nz }, 16, true); info.nucleo = true; }
  const nucleoM = new THREE.Mesh(cristalM ? PAQ.geo('nucleo_cristal', 0) : new THREE.IcosahedronGeometry(3.2, 1), new THREE.MeshBasicMaterial({ color: 0xa78bfa, vertexColors: cristalM }));
  nucleoM.position.set(nx, ny + 31, nz);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(6, 0.4, 6, 32), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  aro.position.copy(nucleoM.position);
  muro.castShadow = true;
  if (torre) torre.castShadow = true;
  g.add(muro, nucleoM, aro);
  if (torre) g.add(torre);
  // Portales de vuelta al pueblo en cada bastion.
  const portales = [];
  for (const f of ['luz', 'sombra']) {
    const pb = portalBase(f), y = alturaAbismo(pb.x, pb.z);
    const velo = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.4), new THREE.MeshBasicMaterial({ color: f === 'luz' ? 0xfde68a : 0xa855f7, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    velo.position.set(pb.x, y + 2.3, pb.z);
    g.add(velo); portales.push(velo);
    /* v393: portal de la faccion modelado (jambas a ±2,1 m como el trilito de ruinas.js, que ya no lo busca). */
    if (hay('portal_' + f)) { sitio([{ n: 'portal_' + f, x: pb.x, y: y - 0.05, z: pb.z, rot: 0 }], { x: pb.x, y: y + 3, z: pb.z }, 5, true); info.portales++; continue; }
    const arco = new THREE.Mesh(new THREE.TorusGeometry(2, 0.25, 6, 16, Math.PI), lam(0x5b5470)); arco.position.copy(velo.position).setY(y + 2.4);
    g.add(arco);
  }
  // Nubes de eter por debajo (planos translucidos que se mueven despacio).
  const nubes = [];
  const matNube = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  for (let k = 0; k < 14; k++) {
    const n = new THREE.Mesh(new THREE.CircleGeometry(40 + (k % 4) * 15, 12).rotateX(-Math.PI / 2), matNube);
    n.position.set(ABISMO_X0 - 250 + (k * 97) % 500, -30 - (k % 3) * 25, -250 + (k * 151) % 500);
    g.add(n); nubes.push(n);
  }
  escena.add(g);
  try { window.__dqAbismo = info; } catch (e) {}
  const COLOR_DUENO = { luz: ['#fde68a', '#fff7d6'], sombra: ['#c084fc', '#c9a3e8'] };
  return {
    grupo: g, solidos, mallas,
    // El nucleo y las banderas de la fortaleza toman el color del dueño.
    dueno(f) {
      const c = COLOR_DUENO[f] || ['#a78bfa', '#8f8aa3'];
      nucleoM.material.color.set(c[0]); aro.material.color.set(f ? c[0] : '#fde68a');
      if (matBandera) matBandera.color.set(c[1]);
    },
    animar(t) {
      nucleoM.rotation.y = t / 1500; nucleoM.rotation.x = cristalM ? Math.sin(t / 2300) * 0.12 : t / 2300;   /* el cristal alargado gira de pie */
      aro.rotation.x = Math.PI / 2 + Math.sin(t / 900) * 0.3; aro.rotation.z = t / 1200;
      for (const v of portales) v.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
      for (let i = 0; i < nubes.length; i++) nubes[i].position.x += Math.sin(t / 8000 + i) * 0.01;
    },
  };
}
