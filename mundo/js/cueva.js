// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — la Cueva de los Goblins en el cliente
//
// Suelo y paredes salen de las salas de CUEVA (mmo/js/cueva3d.js): se
// rasteriza la union en celdas de 1 m y cada borde entre una celda
// caminable y una que no lo es lleva un bloque de roca (InstancedMesh). Con
// antorchas, estalagmitas, cristales, trono, portal de salida y cofre.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { CUEVA, CUEVA_X0 } from '/mmo/js/cueva3d.js?v=293';
import { transparentar } from './tapa.js?v=293';

const dentro = (x, z) => CUEVA.salas.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1);
const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export function construirCueva(escena) {
  const g = new THREE.Group();
  g.position.set(CUEVA_X0, 0, 0);
  // Celdas caminables y bordes.
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [a, b, c, d] of CUEVA.salas) { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, c); z1 = Math.max(z1, d); }
  const suelo = [], muros = [];
  for (let x = x0 - 1; x <= x1; x++) for (let z = z0 - 1; z <= z1; z++) {
    if (dentro(x, z)) { suelo.push([x, z]); continue; }
    if (dentro(x + 1, z) || dentro(x - 1, z) || dentro(x, z + 1) || dentro(x, z - 1) || dentro(x + 1, z + 1) || dentro(x - 1, z - 1) || dentro(x + 1, z - 1) || dentro(x - 1, z + 1)) muros.push([x, z]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  // Suelo: losas con variacion de tono.
  const piso = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), suelo.length);
  suelo.forEach(([x, z], i) => {
    v.set(x + 0.5, -0.1 + rnd(x, z) * 0.06, z + 0.5); s.set(1, 1, 1); q.identity();
    m4.compose(v, q, s); piso.setMatrixAt(i, m4);
    piso.setColorAt(i, col.setHSL(0.07, 0.12, 0.13 + rnd(z, x) * 0.07));
  });
  g.add(piso);
  // Muros: bloques de roca de altura irregular.
  const roca = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.85, 0), transparentar(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), muros.length * 2);
  let k = 0;
  for (const [x, z] of muros) {
    for (let j = 0; j < 2; j++) {
      const h = 1.6 + rnd(x + j, z) * 2.6;
      v.set(x + 0.5 + (rnd(x, z + j) - 0.5) * 0.4, j ? h * 0.9 + 1 : h * 0.45, z + 0.5 + (rnd(z, x + j) - 0.5) * 0.4);
      q.setFromEuler(new THREE.Euler(rnd(x, j) * 3, rnd(z, j) * 3, 0)); s.set(1.05, h * 0.55, 1.05);
      m4.compose(v, q, s); roca.setMatrixAt(k, m4);
      roca.setColorAt(k++, col.setHSL(0.72, 0.08, 0.16 + rnd(x * j, z) * 0.08));
    }
  }
  g.add(roca);
  // Techo de roca oscura (la camara nunca sube por encima).
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 8, z1 - z0 + 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x120c18, side: THREE.DoubleSide }));
  techo.position.set((x0 + x1) / 2, 8, (z0 + z1) / 2);
  g.add(techo);
  // Estalagmitas y cristales que brillan, sueltos por las salas.
  const conoG = new THREE.ConeGeometry(0.45, 1, 6).translate(0, 0.5, 0);
  const estal = new THREE.InstancedMesh(conoG, new THREE.MeshLambertMaterial({ color: 0x4a4252, flatShading: true }), 40);
  const crist = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.4, 0).scale(0.6, 1.8, 0.6), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }), 24);
  let ne = 0, nc = 0;
  for (let i = 0; i < 400 && (ne < 40 || nc < 24); i++) {
    const [x, z] = suelo[Math.floor(rnd(i, 3) * suelo.length)];
    // Lejos del centro de paso: solo junto a los muros.
    if (dentro(x + 2, z) && dentro(x - 2, z) && dentro(x, z + 2) && dentro(x, z - 2)) continue;
    if (Math.hypot(x - CUEVA.entrada.x, z - CUEVA.entrada.z) < 4) continue;
    if (ne < 40) { v.set(x + 0.5, 0, z + 0.5); q.identity(); s.set(1, 1.2 + rnd(i, 5) * 2.4, 1); m4.compose(v, q, s); estal.setMatrixAt(ne++, m4); }
    else if (nc < 24) { v.set(x + 0.5, 0.6, z + 0.5); q.setFromEuler(new THREE.Euler(0.2, rnd(i, 7) * 3, 0.15)); s.set(1, 1, 1); m4.compose(v, q, s); crist.setMatrixAt(nc++, m4); }
  }
  estal.count = ne; crist.count = nc;
  g.add(estal, crist);
  // Antorchas: palo + llama; luces solo en unas pocas (son caras).
  const llamas = [];
  const palo = new THREE.MeshLambertMaterial({ color: 0x3b2a1a }), fuego = new THREE.MeshBasicMaterial({ color: 0xffa53a });
  const ANT = [[-9, 3], [9, 3], [-19, 45], [19, 45], [-19, 68], [19, 68], [-14, 95], [14, 95], [-14, 114], [14, 114], [36, 88], [76, 88], [36, 124], [76, 124]];
  ANT.forEach(([x, z], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 5), palo); p.position.set(x, 1.6, z);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), fuego); f.position.set(x, 2.5, z);
    g.add(p, f); llamas.push(f);
    if (i % 2 === 0) { const l = new THREE.PointLight(0xff9a3c, 2.2, 16, 1.6); l.position.set(x, 2.8, z); g.add(l); llamas.push(l); }
  });
  // Trono del Rey Goblin.
  const oro = new THREE.MeshLambertMaterial({ color: 0xc9a227, flatShading: true }), rojo = new THREE.MeshLambertMaterial({ color: 0x8b1e2b });
  const j = CUEVA.jefe;
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 4), oro); base.position.set(j.x + 7, 0.3, j.z);
  const resp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.5, 3.2), oro); resp.position.set(j.x + 9.2, 2.6, j.z);
  const coj = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 2.4), rojo); coj.position.set(j.x + 7.6, 0.8, j.z);
  const alfombra = new THREE.Mesh(new THREE.PlaneGeometry(26, 3).rotateX(-Math.PI / 2), rojo); alfombra.position.set(j.x - 6, 0.02, j.z);
  g.add(base, resp, coj, alfombra);
  // Portal de salida (violeta, como el del pueblo).
  const so = CUEVA.salida;
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.4), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  velo.position.set(so.x, 2.3, so.z - 1.2);
  const arco = new THREE.Mesh(new THREE.TorusGeometry(2, 0.25, 6, 16, Math.PI), new THREE.MeshLambertMaterial({ color: 0x5b5470 }));
  arco.position.set(so.x, 2.4, so.z - 1.2);
  g.add(velo, arco);
  // Cofre del tesoro (se abre al caer el jefe).
  const cofre = new THREE.Group();
  const caja = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x7a4a22 }));
  caja.position.y = 0.4;
  const tapa = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.3, 0.95), oro); tapa.position.set(0, 0.95, 0);
  cofre.add(caja, tapa); cofre.position.set(CUEVA.cofre.x, 0, CUEVA.cofre.z); cofre.visible = false;
  g.add(cofre);
  escena.add(g);
  return {
    grupo: g, velo, cofre, tapa,
    animar(t) {
      for (let i = 0; i < llamas.length; i++) {
        const o = llamas[i];
        if (o.isLight) o.intensity = 2 + Math.sin(t / 90 + i) * 0.4;
        else o.scale.y = 1 + Math.sin(t / 70 + i * 2) * 0.25;
      }
      velo.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
      if (cofre.visible) tapa.rotation.x = Math.max(-1.1, tapa.rotation.x - 0.02);
    },
  };
}
