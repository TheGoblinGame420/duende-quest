// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — ruinas, portales y entradas modelados en Blender
//
// Paquete assets/3d/dq_ruinas.* (tools/blender/modelos/ruinas.py). crearRuinas()
// pone los modelos en las MISMAS posiciones que las piezas de cajas de
// arquitectura.js, cueva.js y abismo.js y solo entonces quita la pieza vieja:
//   · portal de las mazmorras, 12 menhires del Claro del Titan (y sus columnas
//     caidas), arcos de los caminos y murete en ruinas: se recortan de la malla
//     fundida de crearObra() (y sus runas de la malla de runas);
//   · hitos de zona: basa (en la obra) y obelisco del kit;
//   · salida de la Cueva y portales del Abismo: el arco de toro.
// La Puerta del Nucleo no pasa por aqui: el modelo `puerta_nucleo` declara que
// sustituye a la pieza `c_metal-gate` del kit.
// Colisiones, llamas, velos y puntos de interaccion no se tocan. Si el paquete
// o un modelo no llegan, esa pieza se queda como estaba.
// Dibujo: cada «sitio» (portal, claro, cuarto del cerco, hito...) es un
// THREE.LOD con sus piezas fundidas en UNA malla por nivel de detalle.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

const RM = 32.5, PASO = 2.9 / RM;   // radio del cerco del pueblo y paso de los tramos del murete (los de crearObra)
const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Junta copias colocadas ({ n, x, y, z, rot, s, k }) de modelos del paquete en una geometria relativa a `c`.
function fundir(PAQ, piezas, lod, c) {
  const gs = piezas.map(p => PAQ.geo(p.n, lod));
  let nv = 0, ni = 0;
  for (const g of gs) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), col = new Float32Array(nv * 3), tin = new Float32Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  piezas.forEach((p, j) => {
    const g = gs[j], P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, T = g.attributes.tinte.array, I = g.index.array;
    const cs = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0), s = p.s || 1, k = p.k || 1, n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = (ov + i) * 3, x = P[a] * s, z = P[a + 2] * s, kk = T[i] === 7 ? 1 : k;
      pos[b] = x * cs + z * sn + p.x - c.x; pos[b + 1] = P[a + 1] * s + p.y - c.y; pos[b + 2] = -x * sn + z * cs + p.z - c.z;
      nor[b] = Math.round(N[a] * cs + N[a + 2] * sn); nor[b + 1] = N[a + 1]; nor[b + 2] = Math.round(-N[a] * sn + N[a + 2] * cs);
      col[b] = C[a] * kk; col[b + 1] = C[a + 1] * kk; col[b + 2] = C[a + 2] * kk;
      tin[ov + i] = T[i];
    }
    for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + ov;
    ov += n; oi += I.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tinte', new THREE.BufferAttribute(tin, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Quita de una geometria indexada los grupos de `paso` indices (3 = triangulos, 6 = cuadros de runa) que diga `quitar`.
function recortar(geo, paso, quitar) {
  const P = geo.attributes.position.array, T = geo.attributes.tinte ? geo.attributes.tinte.array : null, I = geo.index.array, out = new I.constructor(I.length);
  let n = 0, fuera = 0;
  for (let i = 0; i + paso <= I.length; i += paso) {
    let x = 0, y = 0, z = 0, my = -1e9;
    for (let j = 0; j < paso; j++) { const a = I[i + j] * 3; x += P[a]; y += P[a + 1]; z += P[a + 2]; if (P[a + 1] > my) my = P[a + 1]; }
    if (quitar(x / paso, y / paso, z / paso, T ? T[I[i]] : 0, my)) { fuera++; continue; }
    for (let j = 0; j < paso; j++) out[n++] = I[i + j];
  }
  if (fuera) geo.setIndex(new THREE.BufferAttribute(out.slice(0, n), 1));
  return fuera;
}

// ctx: { escena, KIT, PAQ, alturaEn, CAMINOS, portal:{x,z}, arena:{x,z,r}, hitos:[{x,z}], cueva, abismo, nivel, sombras, respaldos }
export function crearRuinas(ctx) {
  const { escena, KIT, PAQ, alturaEn } = ctx;
  if (!PAQ || !PAQ.modelos) return null;
  const hay = n => !!PAQ.modelos[n];
  const baja = ctx.nivel === 'minima' || ctx.nivel === 'baja', alta = ctx.nivel === 'alta' || ctx.nivel === 'ultra';
  const mallas = [], info = { sitios: 0, piezas: 0, muretes: 0, arcos: 0, menhires: 0, hitos: 0, entradas: 0, quitados: 0, runasQuitadas: 0 };

  // Un sitio: piezas fundidas por nivel de detalle dentro de un THREE.LOD (el motor elige el nivel con la camara).
  const sitio = (padre, piezas, c, radio, sombra) => {
    if (!piezas.length) return null;
    const lod = new THREE.LOD();
    lod.position.set(c.x, c.y, c.z);
    const niveles = baja ? [[1, 0], [2, radio + 55]] : [[0, 0], [1, radio + (alta ? 52 : 36)], [2, radio + (alta ? 125 : 92)]];
    for (const [nv, d] of niveles) {
      const m = new THREE.Mesh(fundir(PAQ, piezas, nv, c), PAQ.material);
      if (ctx.sombras) { m.castShadow = !!sombra && nv < 2; m.receiveShadow = true; }
      m.matrixAutoUpdate = false; m.updateMatrix();
      lod.addLevel(m, d, 0.06); mallas.push(m);
    }
    lod.matrixAutoUpdate = false; lod.updateMatrix();
    padre.add(lod); lod.updateMatrixWorld(true);
    info.sitios++; info.piezas += piezas.length;
    return lod;
  };

  // ── La obra vieja: la malla fundida de crearObra() (se reconoce por la clave del arco del portal) y sus runas ──
  const px = ctx.portal ? ctx.portal.x : 0, pz = ctx.portal ? ctx.portal.z : 0, py = ctx.portal ? alturaEn(px, pz) : 0;
  let obra = null, runas = null;
  if (KIT && ctx.portal) for (const o of escena.children) {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.index) continue;
    if (o.material === KIT.material && !obra && o.geometry.attributes.tinte) {
      const P = o.geometry.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - px) < 1.2 && Math.abs(P[i + 2] - pz) < 1.2 && P[i + 1] > py + 8.2 && P[i + 1] < py + 10) { obra = o; break; }
    } else if (!runas && o.material && o.material.blending === THREE.AdditiveBlending && o.material.map && o.material.vertexColors && o.renderOrder === 1 && o.geometry.attributes.uv && !o.geometry.attributes.tinte) runas = o;
  }

  const zonas = [];   // (x, y, z, tinte) → true: ese triangulo de la obra vieja se quita
  const zonasRuna = [];
  if (obra) {
    // Portal de las mazmorras.
    if (hay('portal_mazmorra')) {
      sitio(escena, [{ n: 'portal_mazmorra', x: px, y: py, z: pz, rot: 0 }], { x: px, y: py + 4, z: pz }, 7, true);
      zonas.push((x, y, z) => Math.abs(x - px) < 6.3 && Math.abs(z - pz) < 2.1);
      zonasRuna.push((x, y, z) => Math.abs(x - px) < 6.3 && Math.abs(z - pz) < 2.1);
    }
    // Menhires del Claro del Titan (mismo corro, mismas alturas por turno) y columnas caidas junto a tres de ellos.
    const A = ctx.arena;
    if (A && hay('menhir_a') && hay('menhir_b') && hay('menhir_c')) {
      const l = [];
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, x = A.x + Math.cos(a) * A.r, z = A.z + Math.sin(a) * A.r;
        l.push({ n: 'menhir_' + 'abc'[i % 3], x, y: alturaEn(x, z), z, rot: -a + Math.PI / 2 + (i % 2 ? Math.PI : 0), s: 0.96 + rnd(i, 3) * 0.1, k: 0.92 + rnd(i, 5) * 0.16 });
        if (i % 4 === 1 && hay('columna_caida')) { const cx = x + Math.cos(a) * 2.2, cz = z + Math.sin(a) * 2.2; l.push({ n: 'columna_caida', x: cx, y: alturaEn(cx, cz), z: cz, rot: a * 3 }); }
      }
      sitio(escena, l, { x: A.x, y: alturaEn(A.x, A.z) + 3, z: A.z }, A.r + 4, true);
      info.menhires = 12;
      zonas.push((x, y, z) => Math.abs(Math.hypot(x - A.x, z - A.z) - A.r) < 3.9);
      zonasRuna.push((x, y, z) => Math.abs(Math.hypot(x - A.x, z - A.z) - A.r) < 1.3);
    }
    // Arcos de los caminos: crearObra deja sus sitios (redondeados) en __dqObra; el angulo exacto sale del camino.
    const arcos = [];
    let dq = null; try { dq = window.__dqObra; } catch (e) {}
    if (dq && Array.isArray(dq.arcos) && hay('arco_camino')) {
      for (const [, , cx, cz] of ctx.CAMINOS || []) {
        const a = Math.atan2(cz, cx), x = Math.cos(a) * RM, z = Math.sin(a) * RM;
        if (arcos.some(o => Math.hypot(o.x - x, o.z - z) < 1) || !dq.arcos.some(o => o[0] === Math.round(x) && o[1] === Math.round(z))) continue;
        arcos.push({ x, z, a });
      }
      if (arcos.length !== dq.arcos.length) arcos.length = 0;   // no cuadran: mejor dejar los de antes
    }
    // Murete: los tramos se leen de la propia obra (los triangulos de piedra que estan sobre el cerco).
    const tramos = new Map();
    const hayMurete = arcos.length && hay('murete_a') && hay('murete_b') && hay('murete_c');
    if (arcos.length) {
      zonas.push((x, y, z, t, my) => {
        const r = Math.hypot(x, z);
        if (Math.abs(r - RM) > 1.6) return false;
        if (arcos.some(o => Math.hypot(o.x - x, o.z - z) < 5.7)) return true;
        if (!hayMurete || t !== 3 || Math.abs(r - RM) > 1.0) return false;
        let an = Math.atan2(z, x); if (an < 0) an += Math.PI * 2;
        const k = Math.round((an - 0.05) / PASO), tr = tramos.get(k);
        if (!tr) tramos.set(k, { my }); else if (my > tr.my) tr.my = my;
        return true;
      });
      zonasRuna.push((x, y, z) => arcos.some(o => Math.hypot(o.x - x, o.z - z) < 5.7));
    }
    // Hitos: la basa esta en la obra; el obelisco es una malla suelta del kit.
    const hitos = hay('hito') ? (ctx.hitos || []).filter(Boolean) : [];
    for (const h of hitos) {
      const y = alturaEn(h.x, h.z);
      sitio(escena, [{ n: 'hito', x: h.x, y, z: h.z, rot: Math.floor(rnd(h.x, h.z) * 4) * Math.PI / 2 + 0.3, k: 0.95 + rnd(h.z, h.x) * 0.12 }], { x: h.x, y: y + 3, z: h.z }, 4, true);
      for (const o of escena.children) if (o.isMesh && !o.isInstancedMesh && o.position.x === h.x && o.position.z === h.z && Math.abs(o.position.y - (y - 0.1)) < 0.02) o.visible = false;
      info.hitos++;
    }
    if (hitos.length) {
      zonas.push((x, y, z) => hitos.some(h => Math.abs(x - h.x) < 2 && Math.abs(z - h.z) < 2 && Math.hypot(x - h.x, z - h.z) < 1.95));
      zonasRuna.push((x, y, z) => hitos.some(h => Math.abs(x - h.x) < 1.4 && Math.abs(z - h.z) < 1.4));
    }
    // Fuera lo viejo (de una pasada) y, con los tramos ya leidos, el cerco nuevo en cuatro cuartos.
    if (zonas.length) info.quitados = recortar(obra.geometry, 3, (x, y, z, t, my) => { for (const f of zonas) if (f(x, y, z, t, my)) return true; return false; });
    if (runas && zonasRuna.length) info.runasQuitadas = recortar(runas.geometry, 6, (x, y, z) => { for (const f of zonasRuna) if (f(x, y, z)) return true; return false; });
    if (arcos.length) {
      const cuartos = [[], [], [], []], cuarto = a => Math.floor((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
      for (const o of arcos) cuartos[cuarto(o.a)].push({ n: 'arco_camino', x: o.x, y: alturaEn(o.x, o.z), z: o.z, rot: -o.a, k: 0.95 + rnd(o.x, o.z) * 0.1 });
      for (const k of tramos.keys()) {
        const a = 0.05 + k * PASO, x = Math.cos(a) * RM, z = Math.sin(a) * RM;
        cuartos[cuarto(a)].push({ n: 'murete_' + 'abc'[Math.floor(rnd(k, 7) * 3) % 3], x, y: alturaEn(x, z), z, rot: -a + (rnd(k, 9) > 0.5 ? Math.PI : 0), s: 0.94 + rnd(k, 1) * 0.2, k: 0.9 + rnd(k, 4) * 0.2 });
      }
      cuartos.forEach((l, q) => { const a = (q + 0.5) * Math.PI / 2, x = Math.cos(a) * RM * 0.9, z = Math.sin(a) * RM * 0.9; sitio(escena, l, { x, y: alturaEn(x, z) + 2, z }, 26, true); });
      info.arcos = arcos.length; info.muretes = tramos.size;
    }
  }

  // ── Entradas: salida de la Cueva y portales de vuelta del Abismo (el arco de medio toro pasa a trilito) ──
  if (hay('portal_menor')) for (const g of [ctx.cueva && ctx.cueva.grupo, ctx.abismo && ctx.abismo.grupo]) {
    if (!g) continue;
    for (const o of [...g.children]) {
      const pr = o.isMesh && o.geometry && o.geometry.type === 'TorusGeometry' && o.geometry.parameters;
      if (!pr || !(pr.arc < 4) || Math.abs(pr.radius - 2) > 0.01) continue;
      const y = o.position.y - 2.4;
      if (sitio(g, [{ n: 'portal_menor', x: o.position.x, y, z: o.position.z, rot: 0 }], { x: o.position.x, y: y + 3, z: o.position.z }, 4, false)) { o.visible = false; info.entradas++; }
    }
  }

  // Si el shader de los modelos no compila en un telefono, mundo.js cambia de material: aqui tambien.
  if (ctx.respaldos && mallas.length) ctx.respaldos.push(['modelado', () => { const m2 = new THREE.MeshLambertMaterial({ vertexColors: true }); for (const m of mallas) m.material = m2; }]);
  try { window.__dqRuinas = info; } catch (e) {}
  return info;
}
