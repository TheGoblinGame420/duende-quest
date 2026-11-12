// ═══════════════════════════════════════════════════════
// ATMOSFERA de ORIGINS: lo que hace sentir el mundo vivo sin tocar modelos.
//   · Niebla baja: bancos planos y suaves que se posan en las hondonadas y, al
//     amanecer, tambien en el llano. Aparente (no es volumetrica): 1 llamada de dibujo.
//   · Rayos de luz entre los arboles (solo alta y ultra): laminas aditivas alineadas
//     con el sol que giran hacia la camara. 1 llamada de dibujo.
//   · Rayo de la tormenta: una cinta quebrada en el cielo durante el destello.
//   · Salpicaduras de la lluvia en el suelo (usa el banco de particulas que ya existe).
//   · Tinte y saturacion por zona, con transicion suave al cruzar (lo aplica mundo.js
//     al pase de color en alta/ultra y a la luz ambiente en el resto).
// Todo cuelga del nivel de graficos: en minima y baja no se crea ni se dibuja nada
// (salvo el rayo, que son 200 ms de una cinta). Sin texturas y sin reservar memoria por cuadro.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

// Tinte (multiplica el color final) y saturacion de cada zona. Paleta «medieval mistico»:
// desaturada, bosque frio y verdoso, desierto calido, cavernas azuladas, abismo violeta.
export const GRADO_ZONA = {
  pueblo:      [1.025, 1.0, 0.965, 1.0],
  noche:       [0.93, 1.0, 0.985, 0.9],
  amanecer:    [1.03, 1.0, 0.95, 0.98],
  selva:       [0.92, 1.02, 0.95, 0.92],
  tormenta:    [0.95, 0.97, 1.03, 0.84],
  desierto:    [1.07, 1.0, 0.89, 0.96],
  castillo:    [0.97, 0.96, 1.02, 0.82],
  cumbres:     [0.95, 0.99, 1.06, 0.9],
  cavernas:    [0.9, 0.99, 1.09, 0.92],
  abismo:      [1.0, 0.93, 1.1, 0.95],
  acantilados: [1.02, 0.95, 1.07, 0.95],
  cueva:       [0.9, 0.98, 1.1, 0.92],
  eter:        [1.02, 0.92, 1.12, 1.0],
};
const NEUTRO = [1, 1, 1, 1];
// Cuanta niebla baja admite cada zona (0 = nunca) y donde tiene sentido un rayo de sol entre copas.
const NIEBLA_ZONA = { pueblo: 0.45, noche: 1, amanecer: 0.75, selva: 1, tormenta: 0.85, desierto: 0.12, castillo: 0.95, cumbres: 0.55, cavernas: 0.8, abismo: 0.9, acantilados: 0.6 };
const RAYOS_ZONA = { noche: 1, amanecer: 0.8, selva: 1, tormenta: 0.4, castillo: 0.5, cavernas: 0.5, acantilados: 0.4 };
const NIVEL_N = { minima: 0, baja: 1, media: 2, alta: 3, ultra: 4 };

export function crearAtmosfera({ escena, alturaEn, aguaEn, movil = false }) {
  let nivel = 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ── NIEBLA BAJA ─────────────────────────────────────────
  // Cada banco son 2 laminas horizontales (una ancha a ras y otra menor encima) para que el corte con el
  // terreno no sea una linea. Se recolocan de una en una, apagandose antes de saltar.
  const NB_MAX = 22, NB_I = NB_MAX * 2, RADIO_NB = 58;
  let nbActivos = 0, nb = null;
  const nbX = new Float32Array(NB_MAX), nbZ = new Float32Array(NB_MAX), nbA = new Float32Array(NB_MAX), nbVivo = new Uint8Array(NB_MAX);
  function crearNiebla() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    const aP = new THREE.InstancedBufferAttribute(new Float32Array(NB_I * 4), 4), aK = new THREE.InstancedBufferAttribute(new Float32Array(NB_I * 2), 2);
    aP.setUsage(THREE.DynamicDrawUsage); aK.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', aP); g.setAttribute('aK', aK);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uCol: { value: new THREE.Color('#c8d4dc') }, uLejos: { value: RADIO_NB } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `attribute vec4 aP; attribute vec2 aK; uniform float uT; uniform float uLejos;
        varying vec2 vQ; varying float vA; varying float vF;
        void main() {
          vQ = position.xz; vF = aK.y;
          vec3 p = aP.xyz + vec3(position.x, 0.0, position.z) * aP.w;
          p.x += sin(uT * 0.07 + aK.y) * 1.6; p.z += cos(uT * 0.05 + aK.y * 1.7) * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = aK.x * smoothstep(1.5, 7.0, d) * (1.0 - smoothstep(uLejos * 0.72, uLejos, d));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uT; uniform float uA; uniform vec3 uCol;
        varying vec2 vQ; varying float vA; varying float vF;
        void main() {
          float r = length(vQ); if (r > 1.0) discard;
          float f = 1.0 - r; f = f * f * (3.0 - 2.0 * f);
          float n = 0.78 + 0.22 * sin(vQ.x * 5.1 + vF + uT * 0.11) * sin(vQ.y * 4.3 - vF * 1.3 + uT * 0.08);
          gl_FragColor = vec4(uCol, uA * vA * f * n);
        }`,
    });
    const o = new THREE.Mesh(g, m);
    o.frustumCulled = false; o.renderOrder = 3; o.visible = false; o.matrixAutoUpdate = false; o.updateMatrix(); o.updateMatrixWorld(true);
    escena.add(o);
    return { o, g, m, aP, aK };
  }
  // Hondonada: el punto queda por debajo de la media de sus 4 vecinos a 8 m.
  function hondura(x, z, h) {
    return (alturaEn(x + 8, z) + alturaEn(x - 8, z) + alturaEn(x, z + 8) + alturaEn(x, z - 8)) * 0.25 - h;
  }
  let nbTurno = 0;
  function colocarBanco(i, px, pz, llano) {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * 6.2832, d = 9 + Math.random() * (RADIO_NB - 16), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      if (x > 1900) return false;
      const h = alturaEn(x, z), hon = hondura(x, z, h);
      if (!(hon > 0.3 || Math.random() < llano)) continue;
      const y = Math.max(h, aguaEn(x)) + 0.28, r = 7 + Math.random() * 6 + clamp(hon, 0, 2) * 3, f = Math.random() * 6.28, j = i * 2;
      nb.aP.setXYZW(j, x, y, z, r); nb.aP.setXYZW(j + 1, x + 1.5, y + 0.55, z - 1, r * 0.68);
      nb.aK.setXY(j, 0, f); nb.aK.setXY(j + 1, 0, f + 2.1);
      nbX[i] = x; nbZ[i] = z; nbA[i] = 0; nbVivo[i] = 1;
      nb.aP.needsUpdate = true;
      return true;
    }
    return false;
  }
  function moverNiebla(e, fuerza) {
    const quiero = nivel >= 2 && fuerza > 0.06;   /* por debajo no se ve: ni se dibuja ni se recoloca */
    if (!quiero) { if (nb && nb.o.visible) nb.o.visible = false; return; }
    if (!nb) nb = crearNiebla();
    const n = nivel >= 4 ? NB_MAX : nivel === 3 ? (movil ? 12 : 16) : (movil ? 8 : 10);
    if (n !== nbActivos) { nbActivos = n; nb.g.instanceCount = n * 2; }
    nb.o.visible = true;
    nb.m.uniforms.uT.value = e.t / 1000;
    nb.m.uniforms.uA.value += (fuerza - nb.m.uniforms.uA.value) * Math.min(1, e.dt * 0.8);
    // Color: el de la niebla del horizonte, aclarado de dia; de noche, un gris azulado que aun se lee.
    const c = nb.m.uniforms.uCol.value; c.copy(e.niebla); c.r = c.r * 0.6 + 0.3 - 0.16 * e.nocheK; c.g = c.g * 0.6 + 0.32 - 0.15 * e.nocheK; c.b = c.b * 0.6 + 0.34 - 0.1 * e.nocheK;
    // Un banco por cuadro: aparece, se mantiene, y si quedo lejos se apaga y salta a otro sitio.
    let cambio = false;
    const i = nbTurno = (nbTurno + 1) % n;
    const lejos = nbVivo[i] && Math.hypot(nbX[i] - e.px, nbZ[i] - e.pz) > RADIO_NB;
    const paso = e.dt * n * 0.5;   // cada banco se visita 1 de cada n cuadros
    if (!nbVivo[i]) colocarBanco(i, e.px, e.pz, e.llano);
    else if (lejos) { nbA[i] -= paso; if (nbA[i] <= 0) { nbA[i] = 0; nbVivo[i] = 0; } cambio = true; }
    else if (nbA[i] < 1) { nbA[i] = Math.min(1, nbA[i] + paso); cambio = true; }
    if (cambio) { nb.aK.setX(i * 2, nbA[i]); nb.aK.setX(i * 2 + 1, nbA[i] * 0.8); nb.aK.needsUpdate = true; }
  }

  // ── RAYOS DE LUZ ────────────────────────────────────────
  const RY_MAX = 10, RADIO_RY = 46;
  let ry = null, ryTurno = 0, ryActivos = 0;
  const ryX = new Float32Array(RY_MAX), ryZ = new Float32Array(RY_MAX), ryA = new Float32Array(RY_MAX), ryVivo = new Uint8Array(RY_MAX);
  function crearRayos() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const aB = new THREE.InstancedBufferAttribute(new Float32Array(RY_MAX * 4), 4), aK = new THREE.InstancedBufferAttribute(new Float32Array(RY_MAX * 2), 2);
    aB.setUsage(THREE.DynamicDrawUsage); aK.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aB', aB); g.setAttribute('aK', aK); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 }, uSol: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uCol: { value: new THREE.Color('#ffe2a8') } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute vec4 aB; attribute vec2 aK; uniform vec3 uSol; uniform float uT;
        varying vec2 vQ; varying float vA;
        void main() {
          vQ = vec2(position.x * 2.0, position.y);
          vec3 lado = normalize(cross(uSol, cameraPosition - aB.xyz));
          vec3 p = aB.xyz + uSol * (position.y * 19.0 - 1.0) + lado * position.x * aB.w * (0.75 + 0.5 * position.y);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = aK.x * smoothstep(3.0, 11.0, d) * (1.0 - smoothstep(46.0, 62.0, d)) * (0.8 + 0.2 * sin(uT * 0.6 + aK.y));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uA; uniform vec3 uCol; varying vec2 vQ; varying float vA;
        void main() {
          float x = 1.0 - abs(vQ.x); x = x * x;
          float y = smoothstep(0.0, 0.16, vQ.y) * (1.0 - smoothstep(0.45, 1.0, vQ.y));
          gl_FragColor = vec4(uCol * (uA * vA * x * y), 1.0);
        }`,
    });
    const o = new THREE.Mesh(g, m);
    o.frustumCulled = false; o.renderOrder = 4; o.visible = false; o.matrixAutoUpdate = false; o.updateMatrix(); o.updateMatrixWorld(true);
    escena.add(o);
    return { o, g, m, aB, aK };
  }
  function moverRayos(e, fuerza) {
    const quiero = nivel >= 3 && fuerza > 0.015;
    if (!quiero) { if (ry && ry.o.visible) ry.o.visible = false; return; }
    if (!ry) ry = crearRayos();
    const n = nivel >= 4 ? RY_MAX : movil ? 4 : 6;
    if (n !== ryActivos) { ryActivos = n; ry.g.instanceCount = n; }
    ry.o.visible = true;
    const u = ry.m.uniforms;
    u.uT.value = e.t / 1000; u.uA.value += (fuerza - u.uA.value) * Math.min(1, e.dt * 0.8);
    u.uSol.value.copy(e.solDir).normalize();
    const i = ryTurno = (ryTurno + 1) % n, paso = e.dt * n * 0.4;
    let cambio = false;
    if (!ryVivo[i]) {
      {
        const a = Math.random() * 6.2832, d = 10 + Math.random() * (RADIO_RY - 14), x = e.px + Math.cos(a) * d, z = e.pz + Math.sin(a) * d;
        if (x < 1900) {
          const h = alturaEn(x, z);
          if (h > aguaEn(x) + 0.2) { ry.aB.setXYZW(i, x, h, z, 1.6 + Math.random() * 2.6); ry.aB.needsUpdate = true; ry.aK.setXY(i, 0, Math.random() * 6.28); ryX[i] = x; ryZ[i] = z; ryA[i] = 0; ryVivo[i] = 1; cambio = true; }
        }
      }
    } else if (Math.hypot(ryX[i] - e.px, ryZ[i] - e.pz) > RADIO_RY) { ryA[i] -= paso; if (ryA[i] <= 0) { ryA[i] = 0; ryVivo[i] = 0; } cambio = true; }
    else if (ryA[i] < 1) { ryA[i] = Math.min(1, ryA[i] + paso); cambio = true; }
    if (cambio) { ry.aK.setX(i, ryA[i]); ry.aK.needsUpdate = true; }
  }

  // ── RAYO DE LA TORMENTA ─────────────────────────────────
  const TR = 14;   // tramos de la cinta
  let rayo = null, rayoT = -1e9;
  function crearRayo() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array((TR + 1) * 2 * 3), idx = [];
    for (let i = 0; i < TR; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: '#e6edff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false });
    const o = new THREE.Mesh(g, m);
    o.frustumCulled = false; o.visible = false; o.renderOrder = 1; o.matrixAutoUpdate = false; o.updateMatrix(); o.updateMatrixWorld(true);
    escena.add(o);
    return { o, pos, m };
  }
  // Cae un rayo a 130-220 m, dentro de lo que mira la camara (si no, solo se veria el fogonazo).
  function relampago(t, cam, yaw) {
    if (nivel < 1) return;
    if (!rayo) rayo = crearRayo();
    rayoT = t;
    const a = yaw + (Math.random() - 0.5) * 1.3, d = 130 + Math.random() * 90;
    const bx = cam.position.x - Math.sin(a) * d, bz = cam.position.z - Math.cos(a) * d, by = cam.position.y - 12, alto = 120 + Math.random() * 40;
    // Lado de la cinta: perpendicular a la linea camara → rayo.
    const lx = Math.cos(a), lz = -Math.sin(a), p = rayo.pos;
    let x = bx + (Math.random() - 0.5) * 50, z = bz;
    for (let i = 0; i <= TR; i++) {
      const k = i / TR, y = by + alto * (1 - k), w = 0.5 + 1.3 * (1 - k);
      if (i) { const q = (Math.random() - 0.5) * 16; x += lx * q; z += lz * q; }
      const j = i * 6;
      p[j] = x - lx * w; p[j + 1] = y; p[j + 2] = z - lz * w;
      p[j + 3] = x + lx * w; p[j + 4] = y; p[j + 5] = z + lz * w;
    }
    rayo.o.geometry.attributes.position.needsUpdate = true;
  }

  // ── TINTE POR ZONA ──────────────────────────────────────
  const tinte = new THREE.Vector3(1, 1, 1);
  const est = { tinte, sat: 1, nieblaK: 0, rayosK: 0 };

  let salpAcum = 0;
  // e: { t (ms), dt (s), cuadro, px, py, pz, zona, hora, dia (0..1), nocheK, ocaso (0..1), clima, solDir, niebla (Color), FX, fx (0..2) }
  function cuadro(e) {
    // Tinte: hacia el de la zona, en ~2 s.
    const g = GRADO_ZONA[e.zona] || NEUTRO, kt = Math.min(1, e.dt * 0.9);
    tinte.x += (g[0] - tinte.x) * kt; tinte.y += (g[1] - tinte.y) * kt; tinte.z += (g[2] - tinte.z) * kt; est.sat += (g[3] - est.sat) * kt;

    const interior = e.zona === 'cueva' || e.zona === 'eter';
    // Niebla baja: maxima al amanecer (5-8 h), media de noche y al ocaso, casi nada a mediodia.
    const h = e.hora, alba = clamp(1 - Math.abs(h - 6.3) / 2.2, 0, 1);
    const horaK = Math.max(alba, 0.5 * e.nocheK, 0.4 * e.ocaso, 0.16);
    const climaK = e.clima === 'niebla' ? 1.5 : e.clima === 'lluvia' || e.clima === 'tormenta' ? 1.15 : e.clima === 'arena' ? 0 : e.clima === 'nieve' ? 0.8 : 1;
    const nbK = interior ? 0 : clamp((NIEBLA_ZONA[e.zona] || 0) * horaK * climaK, 0, 1) * 0.62;
    e.llano = alba * 0.5 + (e.clima === 'niebla' ? 0.35 : 0) + 0.06;
    est.nieblaK = nbK;
    moverNiebla(e, nbK);

    // Rayos: de dia y despejado; mas marcados con el sol bajo (mañana y tarde).
    const bajo = clamp(1 - Math.abs(h - 8) / 2.6, 0, 1) + clamp(1 - Math.abs(h - 16.8) / 2.2, 0, 1);
    const ryK = interior || e.clima !== 'despejado' ? 0 : (RAYOS_ZONA[e.zona] || 0) * e.dia * (0.1 + 0.11 * Math.min(1, bajo)) * (1 - e.nocheK);
    est.rayosK = ryK;
    moverRayos(e, ryK);

    // Rayo de la tormenta: dos fogonazos, como el destello de la luz.
    if (rayo) {
      const dtR = e.t - rayoT, ver = dtR < 120 || (dtR > 220 && dtR < 300);
      if (rayo.o.visible !== ver) rayo.o.visible = ver;
      if (ver) rayo.m.opacity = dtR < 120 ? 1 : 0.55;
    }

    // Salpicaduras: gotas que rebotan en el suelo cerca del duende.
    if (nivel >= 2 && e.fx >= 1 && e.FX && (e.clima === 'lluvia' || e.clima === 'tormenta') && !interior) {
      salpAcum += e.dt * (movil ? 16 : e.clima === 'tormenta' ? 46 : 32);
      let tope = 4;
      while (salpAcum >= 1 && tope-- > 0) {
        salpAcum -= 1;
        const a = Math.random() * 6.2832, d = 1.5 + Math.random() * Math.random() * 15, x = e.px + Math.cos(a) * d, z = e.pz + Math.sin(a) * d;
        const y = Math.max(alturaEn(x, z), aguaEn(x));
        e.FX.emitir(x, y + 0.05, z, { n: 2, color: '#c9d8f2', vel: 1.5, vida: 0.24, grav: 8, plano: true, radio: 0.05, tam: 0.3, retraso: 0.01 });
      }
      if (salpAcum > 4) salpAcum = 0;
    }
  }

  return {
    cuadro, relampago, est,
    calidad(n) { nivel = NIVEL_N[n] == null ? 2 : NIVEL_N[n]; },
    info() { return { nivel, niebla: +est.nieblaK.toFixed(3), bancos: nb ? nb.g.instanceCount / 2 : 0, bancosVivos: nbVivo.reduce((s, v) => s + v, 0), rayos: +est.rayosK.toFixed(3), rayosVivos: ryVivo.reduce((s, v) => s + v, 0), tinte: [tinte.x, tinte.y, tinte.z].map(v => +v.toFixed(3)), sat: +est.sat.toFixed(3), rayoVisible: !!(rayo && rayo.o.visible) }; },
  };
}
