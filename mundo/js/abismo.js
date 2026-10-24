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

export function construirAbismo(escena, kit) {
  const g = new THREE.Group();
  const solidos = [];
  const cesped = lam(0x6d5bd0), roca = lam(0x3a2f55), cristal = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const conoG = new THREE.ConeGeometry(1, 1, 9);
  ABISMO.islas.forEach((is, n) => {
    const cx = ABISMO_X0 + is.x, cz = is.z;
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
    const torres = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; torres.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R, a]); }
    for (const [x, z, a] of torres) {
      const y = alturaAbismo(x, z) - 0.3;
      for (const [n, h] of [['c_tower-square-base', 0], ['c_tower-square-mid-windows', 1.01], ['c_tower-square-mid', 2.02], ['c_tower-square-top-roof-high', 3.03]]) piezas.push({ n, x, y: y + h * E, z, ry: -a, s: E, color: tinte });
      piezas.push({ n: 'c_flag-banner-long', x: x + Math.cos(a) * 0.48 * E, y: y + 0.9 * E, z: z + Math.sin(a) * 0.48 * E, ry: -a, s: E, color: f === 'luz' ? '#ffe7a3' : '#d4545c' });
      solidos.push({ x, z, r: 0.5 * E + 0.2 });
    }
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
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 26, 8), lam(0x4b4560)); torre.position.set(nx, ny + 13, nz);
  const nucleoM = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
  nucleoM.position.set(nx, ny + 31, nz);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(6, 0.4, 6, 32), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  aro.position.copy(nucleoM.position);
  muro.castShadow = torre.castShadow = true;
  g.add(muro, torre, nucleoM, aro);
  // Portales de vuelta al pueblo en cada bastion.
  const portales = [];
  for (const f of ['luz', 'sombra']) {
    const pb = portalBase(f), y = alturaAbismo(pb.x, pb.z);
    const velo = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.4), new THREE.MeshBasicMaterial({ color: f === 'luz' ? 0xfde68a : 0xa855f7, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    velo.position.set(pb.x, y + 2.3, pb.z);
    const arco = new THREE.Mesh(new THREE.TorusGeometry(2, 0.25, 6, 16, Math.PI), lam(0x5b5470)); arco.position.copy(velo.position).setY(y + 2.4);
    g.add(velo, arco); portales.push(velo);
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
  const COLOR_DUENO = { luz: ['#fde68a', '#fff7d6'], sombra: ['#c084fc', '#c9a3e8'] };
  return {
    grupo: g, solidos,
    // El nucleo y las banderas de la fortaleza toman el color del dueño.
    dueno(f) {
      const c = COLOR_DUENO[f] || ['#a78bfa', '#8f8aa3'];
      nucleoM.material.color.set(c[0]); aro.material.color.set(f ? c[0] : '#fde68a');
      if (matBandera) matBandera.color.set(c[1]);
    },
    animar(t) {
      nucleoM.rotation.y = t / 1500; nucleoM.rotation.x = t / 2300;
      aro.rotation.x = Math.PI / 2 + Math.sin(t / 900) * 0.3; aro.rotation.z = t / 1200;
      for (const v of portales) v.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
      for (let i = 0; i < nubes.length; i++) nubes[i].position.x += Math.sin(t / 8000 + i) * 0.01;
    },
  };
}
