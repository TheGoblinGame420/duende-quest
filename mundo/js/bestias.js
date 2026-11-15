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
// siempre): el color pintado en Blender es un multiplicador; hasta 1 oscurece el tinte y lo que
// pasa de 1 aclara hacia ese color (vientres, gargantas). Los ojos y brasas (marca 7) brillan.
// Un material por tinte, compartido.
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
        vec3 besM = vColor.xyz / vec3(0.12, 0.36, 0.08);
        vColor.xyz = mix(vColor.xyz, uTin * min(besM, vec3(1.0)) + max(besM - 1.0, vec3(0.0)) * 0.45, besH);
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

  // Cuatro patas al trote (como cuatroPatas de modelos.js): pivote en la raíz, abiertas `abre` en Z.
  function patas4(r, n, x, y, zD, zT, ctx, abre = 0, esc = null) {
    for (const [px, pz, ph, del] of [[x, zD, 0, true], [-x, zD, PI, true], [x, zT, PI, false], [-x, zT, 0, false]]) {
      const p = piv(r, G(r.raiz, [px, y, pz], [0, 0, px > 0 ? abre : -abre]));
      P(p, n, ctx, null, null, esc);
      r.patas.push([p, ph, 'x', del]);
    }
  }

  // ── LAGARTO (lagarto) ──
  if (tiene('lagarto_cuerpo')) R.lagarto = c => {
    const r = nuevoRig('cuadrupedo'), Rz = r.raiz, x = ctxDe(c, '#b01890');
    r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0.32, 0]));
    P(cu, 'lagarto_cuerpo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.06, 0.55]));
    P(cb, 'lagarto_cabeza', x);
    const mj = r.mandibula = piv(r, G(cb, [0, -0.06, 0.05]));
    P(mj, 'lagarto_mandibula', x);
    const cola = r.cola = piv(r, G(cu, [0, 0, -0.55]));
    P(cola, 'lagarto_cola', x);
    patas4(r, 'lagarto_pata', 0.24, 0.32, 0.3, -0.3, x, 0.5);
    r.lomo = cu; r.H = 0.6; r.largoMax = 2.0;
    return r;
  };

  // ── SERPIENTE (serpiente): segmentos que ondulan (r.segs), cuello con capucha, cabeza y mandíbula ──
  if (tiene('serp_seg')) R.serpiente = c => {
    const r = nuevoRig('serpiente'), Rz = r.raiz, x = ctxDe(c, '#0a7860');
    r.caer = 'lado'; r.hundir = 0.3;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ra = 0.15 * (1 - i * 0.09);
      r.segs.push(piv(r, P(Rz, 'serp_seg', x, [0, ra * 0.85, 0.1 - i * 0.22], null, [ra, ra * 0.85, ra * 1.3])));
    }
    r.segs.push(piv(r, P(Rz, 'serp_cola', x, [0, 0.05, 0.14 - n * 0.22])));
    const cb = r.cabeza = piv(r, G(Rz, [0, 0.12, 0.2]));
    P(cb, 'serp_cuello', x);
    const h = G(cb, [0, 0.5, 0.1]);
    P(h, 'serp_cabeza', x);
    const mj = r.mandibula = piv(r, G(h, [0, -0.06, 0.02]));
    P(mj, 'serp_mandibula', x);
    const lg = r.lengua = piv(r, G(h, [0, -0.03, 0.26]));
    K.M(lg, 'cilT', '#e0245e', [0, 0, 0], [0.012, 0.12, 0.006], [-PI / 2, 0, 0]);
    r.H = 0.6; r.topeCabeza = 0.6; r.largoMax = 2.0;
    return r;
  };

  // ── ZARIGÜEYA (zarigueya): ahora con mandíbula que se abre al bufar ──
  if (tiene('zari_cuerpo')) R.zarigueya = c => {
    const r = nuevoRig('cuadrupedo'), Rz = r.raiz, x = ctxDe(c, '#34508a');
    r.paso = 12; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.4;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0.38, 0]));
    P(cu, 'zari_cuerpo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.08, 0.42]));
    P(cb, 'zari_cabeza', x);
    const mj = r.mandibula = piv(r, G(cb, [0, -0.06, 0.12]));
    P(mj, 'zari_mandibula', x, [0, 0.03, -0.02]);
    const cola = r.cola = piv(r, G(cu, [0, 0, -0.42]));
    P(cola, 'zari_cola', x);
    patas4(r, 'zari_pata', 0.17, 0.32, 0.25, -0.25, x);
    r.lomo = cu; r.H = 0.6; r.largoMax = 2.0;
    return r;
  };

  // ── GATO INFERNAL (hellgato): runas que arden en el lomo y llama violeta en la cola ──
  if (tiene('gato_cuerpo')) R.hellgato = c => {
    const r = nuevoRig('cuadrupedo'), Rz = r.raiz, x = ctxDe(c, '#3a1c66');
    r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0.62, 0]));
    P(cu, 'gato_cuerpo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.22, 0.62]));
    P(cb, 'gato_cabeza', x);
    const mj = r.mandibula = piv(r, G(cb, [0, -0.09, 0.06]));
    P(mj, 'gato_mandibula', x);
    const cola = r.cola = piv(r, G(cu, [0, 0.08, -0.58]));
    P(cola, 'gato_cola', x);
    K.fuera(cola);                                   // la cola alzada no cuenta en el alto
    const fl = piv(r, G(cola, [0, 0.57, -0.4], [-0.6, 0, 0]));
    K.M(fl, 'cono', K.mat('#c084fc', { e: 1 }), [0, 0, 0], [0.07, 0.22, 0.07]).userData.sinFlash = true;
    r.flamas.push(fl);
    patas4(r, 'gato_pata', 0.15, 0.52, 0.4, -0.38, x);
    r.lomo = cu; r.H = 0.8; r.largoMax = 2.2;
    return r;
  };

  // ── CONEJO SALVAJE (conejo): bípedo con cuchillo oxidado, bandolera y oreja rota ──
  if (tiene('conejo_cuerpo')) R.conejo = c => {
    const r = nuevoRig('bipedo'), Rz = r.raiz, x = ctxDe(c, '#a03a1c');
    r.paso = 11;
    for (const s of [1, -1]) {
      const p = piv(r, G(Rz, [0.12 * s, 0.38, 0]));
      P(p, 'conejo_pierna', x);
      if (s > 0) r.pI = p; else r.pD = p;
    }
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0.38, 0]));
    P(cu, 'conejo_cuerpo', x);
    for (const s of [1, -1]) {
      const b = piv(r, G(cu, [0.25 * s, 0.42, 0], [0, 0, 0.15 * s]));
      P(b, 'conejo_brazo', x);
      const mano = G(b, [0, -0.3, 0]);
      if (s > 0) { r.bI = b; r.manoI = mano; } else { r.bD = b; r.manoD = mano; }
    }
    const arma = K.fuera(G(r.manoD, [0, 0, 0.02], [-0.55, 0, 0]));
    P(arma, 'conejo_cuchillo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.56, 0]));
    P(cb, 'conejo_cabeza', x);
    r.H = 1; r.topeCabeza = 0.34;
    return r;
  };

  // ── BABOSA ABISAL (baba): un solo cuerpo que se aplasta; brilla un poco, como antes ──
  if (tiene('baba_cuerpo')) R.baba = c => {
    const r = nuevoRig('baba'), Rz = r.raiz, x = ctxDe(c, '#f090a8', 0.12);
    r.caer = 'nada'; r.hundir = 0.05;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0, 0]));
    P(cu, 'baba_cuerpo', x);
    r.cabeza = cu; r.H = 1; r.topeCabeza = 0.66;
    return r;
  };

  // ── PULPO BRUJO (pulpo · Kraken): el brujo lleva sombrero y anteojos; el Kraken, no ──
  if (tiene('pulpo_cuerpo')) R.pulpo = c => {
    const r = nuevoRig('pulpo'), Rz = r.raiz, x = ctxDe(c, '#5a8a20');
    r.caer = 'encoge';
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0, 0]));
    P(cu, 'pulpo_cuerpo', x);
    if (c.k === 'pulpo') K.fuera(P(cu, 'pulpo_sombrero', x));          // el sombrero no cuenta en el alto
    for (let i = 0; i < 8; i++) {
      const g = G(cu, [0, 0.5, 0], [0, (i * PI) / 4, 0]);
      const p = piv(r, G(g, [0, 0, 0.18]));
      P(p, 'pulpo_tent', x);
      r.tent.push(p);
    }
    r.cabeza = cu; r.H = 0.9; r.topeCabeza = 1.18;
    return r;
  };

  // ── SALTARÍN ABISAL (saltador): ahora abre la boca de agujas al atacar ──
  if (tiene('salt_cuerpo')) R.saltador = c => {
    const r = nuevoRig('salto'), Rz = r.raiz, x = ctxDe(c, '#c07a20');
    r.paso = 9; r.caer = 'panza'; r.hundir = 0.5; r.aleteo = 9; r.amplAla = 0.3;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0, 0]));
    P(cu, 'salt_cuerpo', x);
    const mj = r.mandibula = piv(r, G(cu, [0, 0.36, 0.3]));
    P(mj, 'salt_mandibula', x);
    const gema = piv(r, G(cu, [0, 0.56, 0.47]));
    K.M(gema, 'icos', K.mat('#3a8bff', { e: 0.9 }), [0, 0, 0], 0.07).userData.sinFlash = true;
    r.brillo.push(gema);
    for (const s of [1, -1]) {
      const p = piv(r, G(cu, [0.3 * s, 0.4, -0.02], [0, 0, -0.25 * s]));
      P(p, 'salt_aleta', x);
      if (s > 0) r.alaP = p; else r.alaN = p;
    }
    for (const s of [1, -1]) {
      const pa = piv(r, G(Rz, [0.22 * s, 0.25, -0.1]));
      P(pa, 'salt_pata', x);
      if (s > 0) r.pI = pa; else r.pD = pa;
    }
    r.cabeza = cu; r.H = 1; r.topeCabeza = 0.78;
    return r;
  };

  // ── MURCIÉLAGO VAMPIRO (murcielago): alas de membrana con dedos (dos piezas espejadas) ──
  if (tiene('murc_cuerpo')) R.murcielago = c => {
    const r = nuevoRig('volador'), Rz = r.raiz, x = ctxDe(c, '#303048');
    r.vuela = true; r.aleteo = 15; r.amplAla = 0.8; r.caer = 'lado'; r.hundir = 0.5;
    const cu = r.cuerpo = piv(r, G(Rz, [0, 0.35, 0]));
    P(cu, 'murc_cuerpo', x);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.08, 0]));
    P(cb, 'murc_cabeza', x);
    for (const s of [1, -1]) {
      const p = piv(r, G(cu, [0.16 * s, 0.1, 0.02], [0, 0, 0.15 * s]));
      P(p, s > 0 ? 'murc_ala_d' : 'murc_ala_i', x);
      if (s > 0) r.alaP = p; else r.alaN = p;
    }
    for (const s of [-1, 1]) {
      const p = piv(r, G(cu, [0.07 * s, -0.15, 0]));
      P(p, 'murc_pie', x);
      r.patas.push([p, 0, 'x', false]);
    }
    r.lomo = cu; r.H = 0.5; r.topeCabeza = 0.15;
    return r;
  };

  // ── PECES (pez · pez_dardo): escamas, aletas con radios, cola ahorquillada ──
  const pezB = (c, v) => {
    const r = nuevoRig('pez'), Rz = r.raiz;
    const D = v === 'pez' ? { piel: '#8a1840', cu: [0.2, 0.28, 0.4], n: 'pez' } : { piel: '#a85a20', cu: [0.09, 0.11, 0.45], n: 'dardo' };
    const x = ctxDe(c, D.piel), [sx, sy, sz] = D.cu;
    r.caer = 'panza'; r.hundir = 0.3; r.colaAmp = 0; r.vuela = true;
    const cu = r.cuerpo = piv(r, G(Rz, [0, sy + 0.05, 0]));
    P(cu, D.n + '_cuerpo', x);
    const cola = r.cola = piv(r, G(cu, [0, 0, -sz * 0.92]));
    P(cola, D.n + '_cola', x);
    r.aletas = [];
    for (const s of [1, -1]) {
      const p = piv(r, G(cu, [sx * 0.9 * s, -sy * 0.2, sz * 0.2]));
      P(p, 'pez_aleta', x, null, s > 0 ? null : [0, PI, 0], v === 'pez' ? 1 : 0.6);
      r.aletas.push(p);
    }
    if (v === 'pez') {
      const mj = r.mandibula = piv(r, G(cu, [0, -sy * 0.3, sz * 0.7]));
      P(mj, 'pez_mandibula', x);
    }
    r.cabeza = cu; r.H = 0.6; r.topeCabeza = sy;
    if (v === 'pez_dardo') r.largoMax = 3.2;
    return r;
  };
  if (tiene('pez_cuerpo')) R.pez = c => pezB(c, 'pez');
  if (tiene('dardo_cuerpo')) R.pez_dardo = c => pezB(c, 'pez_dardo');

  return Object.keys(R).length ? R : null;
}
