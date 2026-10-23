// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — particulas en la GPU
//
// Un solo THREE.Points con un anillo de N particulas: chispas al golpear,
// polvo al aterrizar, estallidos al morir... Cada particula guarda su origen,
// velocidad, nacimiento y vida; la posicion se calcula en el shader (sin
// tocar la CPU por cuadro salvo el reloj). Aditivas, sin escribir profundidad.
// Aparte, un "ambiente" de motas que siguen a la camara (luciernagas de
// noche, eter en el Abismo, polvo en la cueva).
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

const VERT = `
attribute vec3 vel; attribute vec4 dat; attribute vec3 col;
uniform float uT; uniform float uEsc;
varying vec3 vCol; varying float vA;
void main() {
  float edad = uT - dat.x;            // dat: nacimiento, vida, tamaño, gravedad
  float k = edad / dat.y;
  vec3 p = position + vel * edad + vec3(0.0, -0.5 * dat.w * edad * edad, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float vivo = step(0.0, edad) * step(k, 1.0);
  gl_PointSize = vivo * dat.z * uEsc * (1.0 - 0.6 * k) / max(0.5, -mv.z);
  vCol = col; vA = vivo * (1.0 - k * k);
}`;
const FRAG = `
varying vec3 vCol; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
  if (d > 0.25) discard;
  gl_FragColor = vec4(vCol, vA * (1.0 - d * 4.0));
}`;

export function crearParticulas(escena, max, movil) {
  const N = max || 1500;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), dat = new Float32Array(N * 4), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) dat[i * 4] = -1e6;   // todas muertas
  const at = (n, a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, b); return b; };
  const aP = at('position', pos, 3), aV = at('vel', vel, 3), aD = at('dat', dat, 4), aC = at('col', col, 3);
  const u = { uT: { value: 0 }, uEsc: { value: 320 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 5;
  escena.add(pts);
  let cab = 0, sucioIni = N, sucioFin = 0;
  const c = new THREE.Color();
  const reloj = () => performance.now() / 1000;
  function emitir(x, y, z, o) {
    o = o || {};
    const n = Math.round((o.n || 12) * (movil ? 0.6 : 1));
    c.set(o.color || '#ffd34d');
    const v = o.vel || 4, vida = o.vida || 0.6, tam = o.tam || 1, gr = o.grav === undefined ? 9 : o.grav, sube = o.sube || 0, r = o.radio || 0.15;
    const t0 = reloj();
    for (let k = 0; k < n; k++) {
      const i = cab; cab = (cab + 1) % N;
      sucioIni = Math.min(sucioIni, i); sucioFin = Math.max(sucioFin, i + 1);
      const a = Math.random() * Math.PI * 2, e = o.plano ? (Math.random() - 0.5) * 0.3 : Math.random() * 2 - 1, s = v * (0.4 + Math.random() * 0.6);
      const ce = Math.sqrt(1 - e * e);
      pos[i * 3] = x + Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + Math.sin(a) * r;
      vel[i * 3] = Math.cos(a) * ce * s; vel[i * 3 + 1] = (o.plano ? 0.6 : e) * s + sube; vel[i * 3 + 2] = Math.sin(a) * ce * s;
      dat[i * 4] = t0 + Math.random() * 0.04; dat[i * 4 + 1] = vida * (0.6 + Math.random() * 0.5); dat[i * 4 + 2] = 0.16 * tam * (0.6 + Math.random() * 0.7);   // metros dat[i * 4 + 3] = gr;
      const j = 0.85 + Math.random() * 0.3;
      col[i * 3] = c.r * j; col[i * 3 + 1] = c.g * j; col[i * 3 + 2] = c.b * j;
    }
  }
  // Motas de ambiente: una nube que se recoloca alrededor de la camara.
  const NA = movil ? 70 : 160, LADO = 46;
  const ga = new THREE.BufferGeometry(), pa = new Float32Array(NA * 3), fa = new Float32Array(NA);
  for (let i = 0; i < NA; i++) { pa[i * 3] = (Math.random() - 0.5) * LADO; pa[i * 3 + 1] = Math.random() * 14; pa[i * 3 + 2] = (Math.random() - 0.5) * LADO; fa[i] = Math.random() * 6.28; }
  ga.setAttribute('position', new THREE.BufferAttribute(pa, 3)); ga.setAttribute('fase', new THREE.BufferAttribute(fa, 1));
  const ua = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#d9f99d') }, uA: { value: 0 }, uEsc: { value: 320 } };
  const ma = new THREE.ShaderMaterial({
    uniforms: ua, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float fase; uniform float uT; uniform vec3 uC; uniform float uEsc; varying float vB;
      void main() {
        vec3 p = position; p.xz = mod(p.xz - uC.xz + ${(LADO / 2).toFixed(1)}, ${LADO.toFixed(1)}) - ${(LADO / 2).toFixed(1)} + uC.xz;
        p.y += uC.y - 4.0 + sin(uT * 0.7 + fase) * 0.8; p.x += sin(uT * 0.4 + fase * 2.0) * 0.9; p.z += cos(uT * 0.5 + fase) * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vB = 0.5 + 0.5 * sin(uT * 2.3 + fase * 3.0);
        gl_PointSize = uEsc * 0.13 / max(1.0, -mv.z);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vB;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; gl_FragColor = vec4(uCol, uA * vB * (1.0 - d * 4.0)); }`,
  });
  const amb = new THREE.Points(ga, ma);
  amb.frustumCulled = false; amb.renderOrder = 5; amb.visible = false;
  escena.add(amb);
  let ambObj = 0;
  return {
    emitir,
    // tipo: 'luciernagas' | 'eter' | 'polvo' | ''
    ambiente(tipo) {
      ambObj = tipo ? 1 : 0;
      if (tipo === 'eter') ua.uCol.value.set('#c4b5fd'); else if (tipo === 'polvo') ua.uCol.value.set('#a8a29e'); else if (tipo) ua.uCol.value.set('#d9f99d');
    },
    actualizar(dt, cam, alto) {
      const t = reloj();
      u.uT.value = t; ua.uT.value = t;
      u.uEsc.value = ua.uEsc.value = alto * 0.87;   // px por metro a 1 m (fov 60)
      if (sucioFin > sucioIni) {
        for (const b of [aP, aV, aD, aC]) { b.clearUpdateRanges ? (b.clearUpdateRanges(), b.addUpdateRange(sucioIni * b.itemSize, (sucioFin - sucioIni) * b.itemSize)) : (b.updateRange = { offset: sucioIni * b.itemSize, count: (sucioFin - sucioIni) * b.itemSize }); b.needsUpdate = true; }
        sucioIni = N; sucioFin = 0;
      }
      ua.uA.value += (ambObj * 0.9 - ua.uA.value) * Math.min(1, dt * 1.5);
      amb.visible = ua.uA.value > 0.02;
      ua.uC.value.copy(cam);
    },
  };
}
