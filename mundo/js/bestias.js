// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — monstruos modelados en Blender (familia «monstruos»)
//
// Los bichos que seguían con el modelo viejo de primitivas (araña, lagarto, serpiente...)
// ahora usan piezas modeladas en tools/blender/modelos/monstruos.py (assets/3d/dq_monstruos.*).
// Cada rig de aquí repite los MISMOS pivotes (posiciones, nombres y parámetros: paso, caer,
// hundir, H, topeCabeza, largoMax) que su arquetipo de modelos.js, así que animarRig los mueve
// igual; solo cambia lo que cuelga de cada pivote: una pieza del paquete en vez de primitivas.
//
// La piel teñible (marca 1 'hoja') toma el tinte del monstruo (MONSTRUOS[k].tinte o el color de
// siempre), los ojos y brasas (marca 7) brillan. Un material por tinte, compartido.
// Si el paquete no llegó (o con ?sinBestias), crearMonstruo sigue con el modelo viejo.
// Solo monstruos: NPC y monturas no pasan por aquí.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

const PI = Math.PI;
const SIN = typeof location !== 'undefined' && /[?&]sinBestias(=|&|$)/.test(location.search);

// K: utilidades internas de modelos.js (nuevoRig, G, piv, M, mat, fuera, conBorde, ponBorde).
export function crearBestias(PAQ, K) {
  if (SIN || !PAQ || !PAQ.modelos) return null;
  const tiene = n => !!PAQ.modelos['bes_' + n];

  // ── material: Lambert suave con color por vértice, tinte por uniforme y borde de modelos.js ──
  const MATS = new Map();
  function material(tinte, e) {
    const c = new THREE.Color(tinte);
    const k = c.getHexString() + '|' + (e || 0);
    let m = MATS.get(k);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ vertexColors: true });
    const uTin = { value: c }, uTinE = { value: e || 0 };
    m.onBeforeCompile = s => {
      K.ponBorde(s);
      s.uniforms.uTin = uTin; s.uniforms.uTinE = uTinE;
      s.vertexShader = 'attribute float tinte;\nuniform vec3 uTin;\nuniform float uTinE;\nvarying float vBesE;\n' + s.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        float besH = step(0.5, tinte) * step(tinte, 1.5);
        vColor.xyz = mix(vColor.xyz, vColor.xyz / vec3(0.12, 0.36, 0.08) * uTin, besH);
        vBesE = step(6.5, tinte) * step(tinte, 7.5) + besH * uTinE;`);
      s.fragmentShader = 'varying float vBesE;\n' + K.conBorde(s.fragmentShader, '\n\ttotalEmissiveRadiance += diffuseColor.rgb * vBesE;');
    };
    m.customProgramCacheKey = () => 'bestia-borde';
    m.userData.compartido = true;
    MATS.set(k, m);
    return m;
  }
  // Geometría de una pieza (nivel 0, o 1 en calidad baja). Modelo mide con boundingBox.
  function geo(n, lig) {
    const g = PAQ.geo('bes_' + n, lig ? 1 : 0);
    if (!g.boundingBox) g.computeBoundingBox();
    return g;
  }
  // Pieza colgada de un pivote (estática respecto a él: lo que se anima es el pivote).
  function P(padre, n, ctx, pos, rot, esc) {
    const me = new THREE.Mesh(geo(n, ctx.lig), ctx.m);
    if (pos) me.position.set(pos[0], pos[1], pos[2]);
    if (rot) me.rotation.set(rot[0], rot[1], rot[2]);
    if (esc != null) typeof esc === 'number' ? me.scale.setScalar(esc) : me.scale.set(esc[0], esc[1], esc[2]);
    me.matrixAutoUpdate = false;
    me.updateMatrix();
    padre.add(me);
    return me;
  }
  // c: { k, color (tinte del monstruo o null), jefe, e, ligero }
  const ctxDe = (c, def, e0) => ({ lig: !!c.ligero, m: material(c.color || def, (e0 || 0) + (c.e || 0)) });
  const { nuevoRig, G, piv } = K;

  const R = {};

  // ── ARAÑA DE CENIZA (misma armadura que arana() de modelos.js) ──
  if (tiene('arana_cuerpo')) R.arana = c => {
    const r = nuevoRig('cuadrupedo'), Rz = r.raiz, x = ctxDe(c, '#c0a830');
    r.paso = 13; r.ampPatas = 0.6; r.caer = 'panza'; r.hundir = 0.5;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0, 0]));
    P(cu, 'arana_cuerpo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.34, 0.3]));
    P(cb, 'arana_cabeza', x);
    for (const s of [-1, 1]) {
      const f = piv(r, G(cb, [s * 0.05, -0.08, 0.08]));
      P(f, 'arana_colmillo', x);
      r.pinzas.push(f);
    }
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
      const a = -0.75 + i * 0.5, giro = s > 0 ? a : PI - a;
      const p = piv(r, G(Rz, [s * 0.16, 0.32, 0.22 - i * 0.1], [0, giro, 0]));
      P(p, 'arana_pata', x, null, null, [1, 1 - Math.abs(i - 1.5) * 0.04, 1]);
      r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i < 2]);
    }
    r.lomo = cu; r.H = 0.6; r.topeCabeza = 0.18;
    return r;
  };

  return Object.keys(R).length ? R : null;
}
