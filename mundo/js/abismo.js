// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — el Abismo de Éter en el cliente
//
// Islas flotantes (la cara de arriba sigue alturaAbismo, la de abajo es un
// cono de roca con cristales colgando), los bastiones de la Luz y de la
// Sombra, la Fortaleza del Nucleo, los portales de vuelta y nubes de eter
// por debajo. Todo low-poly con sombreado plano.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { ABISMO, ABISMO_X0, alturaAbismo, portalBase } from '/mmo/js/abismo3d.js';

const lam = (c, extra) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(extra || {}) });

export function construirAbismo(escena) {
  const g = new THREE.Group();
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
  bastion(luz, 0xf5f0e1, 0xfacc15, 6);
  bastion(sombra, 0x2a1838, 0xb91c1c, 9);
  // Fortaleza del Nucleo: muralla, torre y el nucleo que brilla y gira.
  const nx = ABISMO_X0 + nucleo.x, nz = nucleo.z, ny = alturaAbismo(nx, nz);
  const muro = new THREE.Mesh(new THREE.CylinderGeometry(nucleo.r * 0.7, nucleo.r * 0.72, 7, 16, 1, true), lam(0x6b6478, { side: THREE.DoubleSide }));
  muro.position.set(nx, ny + 3, nz);
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
  return {
    grupo: g,
    animar(t) {
      nucleoM.rotation.y = t / 1500; nucleoM.rotation.x = t / 2300;
      aro.rotation.x = Math.PI / 2 + Math.sin(t / 900) * 0.3; aro.rotation.z = t / 1200;
      for (const v of portales) v.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
      for (let i = 0; i < nubes.length; i++) nubes[i].position.x += Math.sin(t / 8000 + i) * 0.01;
    },
  };
}
