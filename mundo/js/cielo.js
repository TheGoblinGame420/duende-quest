// ═══════════════════════════════════════════════════════
// CIELO Y PAISAJE LEJANO de ORIGINS (lo usa mundo.js).
//
//  · Cupula: degradado atmosferico por hora, sol con disco y halo, luna con
//    fase y mares, Via Lactea y una capa de nubes con volumen aparente (una
//    textura de ruido horneada al arrancar: 1 a 3 lecturas por pixel de cielo).
//  · Cordillera lejana: tres capas de siluetas (nieve, mesetas o lomas segun
//    hacia que zona se mire) que se funden con la bruma del horizonte. Un solo
//    dibujo, sigue a la camara.
//  · Nubes 3D: cumulos instanciados que derivan en la GPU (un dibujo, sin
//    trabajo de JS por cuadro) y se desvanecen a lo lejos.
//
// Todo cuelga de la calidad: 'baja' (minima y baja del menu) usa las versiones
// sencillas (menos lecturas de textura, menos capas y menos triangulos).
// Nada reserva memoria por cuadro. Si un shader no compila en algun movil, su
// pieza se oculta sola (respaldos de mundo.js, marca «dq:nombre»).
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

// ── RUIDO ──
function azar(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
// Ruido de valor que se repite cada «per» celdas (para texturas y perfiles sin costura).
function ruidoRep(x, y, per, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = azar(x0, y0, s), b = azar(x1, y0, s), c = azar(x0, y1, s), d = azar(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbmRep(u, v, base, oct, s) {
  let amp = 0.5, f = base, sum = 0, tot = 0;
  for (let o = 0; o < oct; o++) { sum += amp * ruidoRep(u * f, v * f, f, s + o * 17); tot += amp; amp *= 0.5; f *= 2; }
  return sum / tot;
}
// Textura de ruido repetible. R: masas de nubes · G: detalle fino · B: manchas (Via Lactea, mares de la luna).
function texturaRuido(N) {
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N, k = (j * N + i) * 4;
    // Nubes: masas grandes con borde abullonado (el pliegue del ruido da los «coliflores»).
    const masa = fbmRep(u, v, 4, 5, 11), pliegue = 1 - Math.abs(2 * fbmRep(u, v, 8, 3, 47) - 1);
    d[k] = Math.round(clamp(((masa * 0.8 + pliegue * 0.2) - 0.5) * 2.1 + 0.5, 0, 1) * 255);
    d[k + 1] = Math.round(clamp((fbmRep(u, v, 16, 3, 83) - 0.5) * 1.9 + 0.5, 0, 1) * 255);
    d[k + 2] = Math.round(clamp((fbmRep(u, v, 5, 4, 131) - 0.5) * 2.0 + 0.5, 0, 1) * 255);
    d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ── GLSL COMPARTIDO ──
// Color del cielo sin astros ni nubes: lo usan la cupula y la cordillera (asi la bruma de las
// montañas es exactamente el cielo que tienen detras).
const GLSL_BASE = `
uniform vec3 uHor; uniform vec3 uTop; uniform vec3 uSol; uniform vec3 uOca; uniform float uOcaK; uniform float uBruma;
vec3 dqCieloBase(vec3 d) {
  float h = d.y;
  vec3 c = mix(uHor, uTop, pow(smoothstep(-0.02, 0.7, h), 0.75));
  float lado = 0.5 + 0.5 * dot(normalize(d.xz + vec2(0.0001)), normalize(uSol.xz + vec2(0.0001)));
  float banda = exp(-max(h, 0.0) * 5.0) * (0.3 + 0.7 * lado * lado);
  c = mix(c, uOca, clamp(banda * uOcaK, 0.0, 0.85));
  float contra = (1.0 - lado) * (1.0 - lado) * exp(-abs(h - 0.14) * 7.0) * uOcaK;
  c = mix(c, vec3(0.42, 0.25, 0.44), clamp(contra * 0.38, 0.0, 0.5));
  c = mix(c, uHor * 1.06, clamp(uBruma * exp(-abs(h) * 8.0), 0.0, 0.9));
  c = mix(c, uHor * 0.8, smoothstep(0.0, -0.25, h));
  return c;
}`;
// Densidad de la capa de nubes de la cupula en la direccion d (0..1). La usan la cupula, las
// estrellas (se apagan detras de las nubes) y el reflejo del agua.
const GLSL_NUBE = `
uniform sampler2D dqRuido; uniform vec4 dqDes; uniform float dqNub;
float dqNube(vec3 d, out vec2 uv, out float n) {
  float h = d.y; uv = vec2(0.0); n = 0.0;
  if (h < 0.012 || dqNub < 0.01) return 0.0;
  uv = d.xz / (h + 0.2) * 0.13 + dqDes.xy;
  n = texture2D(dqRuido, uv).r;
  float nd = n;
  #ifndef BAJA
  nd = n * 0.74 + texture2D(dqRuido, uv * 3.1 + dqDes.zw).g * 0.26;
  #endif
  float th = mix(0.8, 0.22, dqNub);
  return smoothstep(th, th + 0.2, nd) * smoothstep(0.012, 0.17, h);
}`;

// ── CORDILLERA ──
// Perfil del horizonte segun hacia que zona se mire: alto (0..1), agudo (picos de sierra),
// mesa (cimas planas), nieve (altura relativa donde empieza; 2 = sin nieve) y color de la roca.
const PERFIL = {
  cumbres:     { alto: 1.0,  agudo: 1.0, mesa: 0,   nieve: 0.34, color: '#6d6a8c' },
  castillo:    { alto: 0.7,  agudo: 0.9, mesa: 0,   nieve: 0.5,  color: '#5c566e' },
  tormenta:    { alto: 0.72, agudo: 1.0, mesa: 0,   nieve: 0.56, color: '#565a78' },
  noche:       { alto: 0.52, agudo: 0.6, mesa: 0,   nieve: 0.6,  color: '#48507a' },
  amanecer:    { alto: 0.55, agudo: 0.6, mesa: 0.2, nieve: 0.62, color: '#9c6a58' },
  cavernas:    { alto: 0.6,  agudo: 0.8, mesa: 0,   nieve: 0.66, color: '#4a6c78' },
  acantilados: { alto: 0.78, agudo: 0.3, mesa: 0.8, nieve: 2,    color: '#7a5ea4' },
  desierto:    { alto: 0.46, agudo: 0.1, mesa: 1.0, nieve: 2,    color: '#b88a5c' },
  selva:       { alto: 0.42, agudo: 0.15, mesa: 0,  nieve: 2,    color: '#3f7858' },
  abismo:      { alto: 0.36, agudo: 0.35, mesa: 0,  nieve: 2,    color: '#5c82a0' },
};
const PERFIL_DEF = { alto: 0.5, agudo: 0.5, mesa: 0, nieve: 0.7, color: '#5e6480' };

function geometriaCordillera(zonas, baja) {
  const SEG = baja ? 160 : 288, FILAS = 4;
  // De atras hacia delante (se pintan en ese orden): sierra alta, estribaciones y lomas.
  const capas = (baja ? [0, 2] : [0, 1, 2]).map(i => [
    { R: 700, alto: 190, bruma: 0.52, sem: 3,  agudo: 1,    osc: 0.92 },
    { R: 640, alto: 110, bruma: 0.4,  sem: 29, agudo: 0.8,  osc: 0.8 },
    { R: 580, alto: 52,  bruma: 0.27, sem: 61, agudo: 0.35, osc: 0.66 },
  ][i]);
  const ALTO_MAX = 190;
  const dirs = Object.keys(zonas || {}).map(id => { const p = PERFIL[id] || PERFIL_DEF; return { ang: Math.atan2(zonas[id].z, zonas[id].x), p, c: new THREE.Color(p.color) }; });
  if (!dirs.length) dirs.push({ ang: 0, p: PERFIL_DEF, c: new THREE.Color(PERFIL_DEF.color) });
  const mez = { alto: 0, agudo: 0, mesa: 0, nieve: 0, r: 0, g: 0, b: 0 };
  function mezcla(a) {
    let tot = 0; mez.alto = mez.agudo = mez.mesa = mez.nieve = mez.r = mez.g = mez.b = 0;
    for (const z of dirs) {
      let da = Math.abs(a - z.ang) % TAU; if (da > Math.PI) da = TAU - da;
      const w = Math.exp(-(da / 0.42) * (da / 0.42)) + 0.002;
      tot += w; mez.alto += z.p.alto * w; mez.agudo += z.p.agudo * w; mez.mesa += z.p.mesa * w; mez.nieve += Math.min(z.p.nieve, 1.3) * w;
      mez.r += z.c.r * w; mez.g += z.c.g * w; mez.b += z.c.b * w;
    }
    for (const k in mez) mez[k] /= tot;
    return mez;
  }
  const r1 = (a, f, s) => ruidoRep(a / TAU * f, 0.5, f, s);
  const sierra = (a, f, s) => 1 - Math.abs(2 * r1(a, f, s) - 1);
  const nv = capas.length * SEG * FILAS * 6;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), dat = new Float32Array(nv * 3);
  let k = 0;
  const P = [], va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (const capa of capas) {
    // Rejilla de puntos de la capa: columnas por angulo y filas desde bajo el horizonte hasta la cresta.
    P.length = 0;
    for (let i = 0; i <= SEG; i++) {
      const a = (i % SEG) / SEG * TAU - Math.PI, m = mezcla(a), s = capa.sem;
      const picos = Math.pow(0.5 * sierra(a, 8, s) + 0.3 * sierra(a, 19, s + 1) + 0.2 * sierra(a, 47, s + 2), 2.1) * 1.5;
      // Macizos y collados: la sierra no es un muro parejo.
      const macizo = 0.3 + 0.7 * suave(0.25, 0.8, 0.65 * r1(a, 5, s + 7) + 0.35 * r1(a, 11, s + 8));
      const lomas = 0.6 * r1(a, 7, s + 3) + 0.3 * r1(a, 17, s + 4) + 0.1 * r1(a, 40, s + 5);
      let forma = lomas + (picos - lomas) * clamp(m.agudo * capa.agudo, 0, 1);
      if (m.mesa > 0.01) { const mesa = 0.55 * suave(0.36, 0.47, lomas) + 0.4 * suave(0.56, 0.63, lomas) + 0.05 * r1(a, 60, s + 6); forma += (mesa - forma) * m.mesa; }
      const alto = capa.alto * (0.4 + 0.6 * m.alto) * macizo * (0.1 + 0.9 * clamp(forma, 0, 1.15));
      const fila = [];
      for (let j = 0; j <= FILAS; j++) {
        const t = j === 0 ? 0 : (j - 1) / (FILAS - 1), dentro = j > 1 && j < FILAS;
        const jit = dentro ? azar(i % SEG, j, s + 9) - 0.5 : 0, jit2 = dentro ? azar(i % SEG, j, s + 10) - 0.5 : 0;
        const y = j === 0 ? -capa.R * 0.2 : alto * clamp(t + jit * 0.22, 0, 1);
        const r = j === 0 ? capa.R : capa.R - alto * 0.95 * (1 - t) + jit2 * alto * 0.5;
        fila.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, alt: Math.max(0, y) / ALTO_MAX + (azar(i % SEG, j, s + 12) - 0.5) * 0.05, nieve: m.nieve > 1.25 ? 9 : m.nieve, r: m.r, g: m.g, b: m.b });
      }
      P.push(fila);
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < FILAS; j++) {
      const A = P[i][j], B = P[i + 1][j], Cc = P[i + 1][j + 1], D = P[i][j + 1];
      // La diagonal alterna para que las caras no formen bandas.
      const tris = (i + j) % 2 ? [A, B, Cc, A, Cc, D] : [A, B, D, B, Cc, D];
      for (let q = 0; q < 6; q += 3) {
        const p0 = tris[q], p1 = tris[q + 1], p2 = tris[q + 2];
        va.set(p0.x, p0.y, p0.z); vb.set(p1.x, p1.y, p1.z); vc.set(p2.x, p2.y, p2.z);
        nn.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va)).normalize();
        if (nn.x * -va.x + nn.z * -va.z < 0) nn.negate();   // siempre de cara al centro (donde esta la camara)
        const tinte = (0.88 + 0.24 * azar(i, j * 2 + q, capa.sem + 20)) * capa.osc;
        for (let w = 0; w < 3; w++) {
          const p = tris[q + w];
          pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
          nor[k * 3] = nn.x; nor[k * 3 + 1] = nn.y; nor[k * 3 + 2] = nn.z;
          col[k * 3] = p.r * tinte; col[k * 3 + 1] = p.g * tinte; col[k * 3 + 2] = p.b * tinte;
          dat[k * 3] = p.alt; dat[k * 3 + 1] = p.nieve; dat[k * 3 + 2] = capa.bruma;
          k++;
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aDat', new THREE.BufferAttribute(dat, 3));
  return g;
}

// ── NUBES 3D ──
function geometriaNubes(n, puffs, detalle) {
  const base = new THREE.IcosahedronGeometry(1, detalle);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', base.attributes.position);
  if (base.index) g.setIndex(base.index);
  const nube = new Float32Array(n * puffs * 4), puff = new Float32Array(n * puffs * 4);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 1100, z = (Math.random() - 0.5) * 1100, y = 78 + Math.random() * 34, s = 9 + Math.random() * 11, v = 1.2 + Math.random() * 1.6;
    const largo = 1.1 + Math.random() * 0.9;
    for (let p = 0; p < puffs; p++) {
      // Un cumulo: el copo mayor en el centro y los demas alrededor, todos con la panza a la misma altura.
      const centro = p === 0, r = s * (centro ? 1 : 0.45 + Math.random() * 0.4);
      const ox = centro ? 0 : (Math.random() - 0.5) * 2 * s * largo, oz = centro ? 0 : (Math.random() - 0.5) * 1.3 * s;
      nube.set([x, y, z, v], k * 4);
      puff.set([ox, r * 0.62 + (centro ? 0 : Math.random() * s * 0.12), oz, r], k * 4);
      k++;
    }
  }
  g.setAttribute('aNube', new THREE.InstancedBufferAttribute(nube, 4));
  g.setAttribute('aPuff', new THREE.InstancedBufferAttribute(puff, 4));
  g.instanceCount = n * puffs;
  return g;
}

// Colores de referencia (se mezclan segun la hora y el clima; nada se crea por cuadro).
const K = h => new THREE.Color(h);
const NUB_L_DIA = K('#fffdf6'), NUB_L_OCA = K('#ffb27e'), NUB_L_NOC = K('#56618a'), NUB_S_DIA = K('#a9b6d2'), NUB_S_OCA = K('#7a5f86'), NUB_S_NOC = K('#141a30'), NUB_GRIS = K('#7b8090');
const LUZ_DIA = K('#fff4e0'), LUZ_OCA = K('#ff9a5c'), LUZ_NOC = K('#7f95d8'), SOL_ALTO = K('#fff1c9'), SOL_BAJO = K('#ff9440');

export function crearCielo({ escena, calidad = 'media', movil = false, zonas = null, respaldos = null, diaMs = 2880000 } = {}) {
  const baja = calidad === 'baja', alta = calidad === 'alta';
  const DEF = baja ? '#define BAJA\n' : '';
  const ruido = texturaRuido(baja ? 128 : 256);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const u = {
    uHor: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uSol: { value: V3(0, 1, 0) }, uSolC: { value: K('#fff1c9') }, uNoche: { value: 0 },
    uOca: { value: K('#ff9a5a') }, uOcaK: { value: 0 }, uBruma: { value: 0.12 }, uLunaC: { value: K('#dfe8ff') },
    uLuna: { value: V3(0, 1, 0) }, uSolK: { value: 1 }, uLunaK: { value: 0 }, uFase: { value: V3(0, 0, 1) }, uVia: { value: 0 },
    uNubL: { value: NUB_L_DIA.clone() }, uNubS: { value: NUB_S_DIA.clone() },
    dqRuido: { value: ruido }, dqDes: { value: new THREE.Vector4() }, dqNub: { value: 0.4 },
    // cordillera y nubes 3D
    uLuzD: { value: V3(0.3, 0.8, 0.3) }, uLuzC: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.5, 0.5) }, uVelo: { value: 0 }, uDy: { value: 0 },
    uCam: { value: V3(0, 0, 0) }, uT: { value: 0 },
  };
  // Via Lactea: una franja sobre un circulo maximo inclinado.
  const viaN = V3(0.78, 0.3, 0.55).normalize(), viaA = V3(0, 1, 0).cross(viaN).normalize(), viaB = viaN.clone().cross(viaA).normalize();
  const v3 = v => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;

  // ── Cupula ──
  const m = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: DEF + `uniform vec3 uSolC; uniform float uNoche; uniform vec3 uLunaC; uniform vec3 uLuna; uniform float uSolK; uniform float uLunaK; uniform vec3 uFase; uniform float uVia;
      uniform vec3 uNubL; uniform vec3 uNubS; varying vec3 vD;
      // dq:cielo
      ${GLSL_BASE}
      ${GLSL_NUBE}
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = dqCieloBase(d);
        float s = max(dot(d, uSol), 0.0);
        float l = max(dot(d, uLuna), 0.0);
        float sobre = smoothstep(-0.05, 0.0, h);
        #ifndef BAJA
        if (uVia > 0.01 && h > 0.0) {
          float b = dot(d, ${v3(viaN)});
          vec2 q = vec2(dot(d, ${v3(viaA)}), dot(d, ${v3(viaB)}));
          float polvo = texture2D(dqRuido, q * 0.55 + vec2(b * 0.5, 0.21)).b;
          float fino = texture2D(dqRuido, q * 2.3).g;
          float franja = exp(-b * b * (9.0 + 14.0 * polvo));
          float v = franja * (0.25 + 1.1 * polvo) * (0.55 + 0.7 * fino) * smoothstep(0.0, 0.3, h) * uVia;
          c += vec3(0.2, 0.26, 0.5) * v * 0.3 + vec3(0.5, 0.36, 0.42) * v * v * 0.22;
        }
        c += uSolC * (pow(s, 8.0) * 0.2 + pow(s, 60.0) * 0.3 + pow(s, 900.0) * 1.1 + smoothstep(0.99952, 0.99972, s) * 1.5) * uSolK * sobre;
        c += uLunaC * (pow(l, 14.0) * 0.1 + pow(l, 120.0) * 0.18) * uLunaK;
        if (l > 0.9985 && uLunaK > 0.01) {
          vec3 ex = normalize(cross(vec3(0.0, 1.0, 0.0), uLuna)); vec3 ey = cross(uLuna, ex);
          vec2 q = vec2(dot(d, ex), dot(d, ey)) / 0.042; float r2 = dot(q, q);
          if (r2 < 1.0) {
            vec3 nl = vec3(q, sqrt(1.0 - r2));
            float fase = smoothstep(-0.08, 0.22, dot(nl, uFase));
            float mar = texture2D(dqRuido, q * 0.17 + 0.37).b;
            vec3 lc = uLunaC * (0.62 + 0.5 * mar) * (0.75 + 0.25 * nl.z);
            c = mix(c, c * 0.55 + lc * (0.035 + 1.05 * fase), smoothstep(1.0, 0.86, r2) * uLunaK);
          }
        }
        #else
        c += uSolC * (pow(s, 8.0) * 0.2 + pow(s, 60.0) * 0.3 + smoothstep(0.9975, 0.9995, s) * 1.6) * uSolK * sobre;
        c += uLunaC * (pow(l, 14.0) * 0.1 + smoothstep(0.975, 1.0, l) * 0.18 + smoothstep(0.9989, 0.9993, l) * 0.85) * uLunaK;
        #endif
        vec2 uv; float n;
        float dens = dqNube(d, uv, n);
        if (dens > 0.003) {
          #ifndef BAJA
          // Luz: se mira un poco hacia el sol; si alli hay menos nube, este borde esta iluminado.
          vec2 hs = normalize(uSol.xz + vec2(0.0001)) * 0.02;
          float n2 = texture2D(dqRuido, uv + hs).r;
          float luz = clamp(0.55 + (n - n2) * 4.2, 0.0, 1.0);
          luz *= 1.0 - 0.45 * smoothstep(0.35, 1.0, dens);
          vec3 nc = mix(uNubS, uNubL, luz) + uSolC * pow(s, 10.0) * 0.45 * (1.0 - dens * 0.7) * uSolK;
          #else
          vec3 nc = mix(uNubS, uNubL, 0.75 - 0.4 * dens);
          #endif
          nc = mix(uHor, nc, smoothstep(0.0, 0.26, h));
          c = mix(c, nc, dens * 0.94);
        }
        #ifndef BAJA
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        #endif
        gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  m.renderOrder = -10; m.frustumCulled = false; escena.add(m);
  // Si la cupula no compila queda el color de fondo de la escena.
  if (respaldos) respaldos.push(['cielo', () => { m.visible = false; }]);

  // ── Cordillera lejana ──
  // Se pinta justo despues de la cupula y antes que el mundo (sin prueba de profundidad, pero
  // la escribe: las estrellas, que van despues y mas lejos, quedan tapadas por las cimas).
  let cordillera = null, cordilleraOk = true;
  try {
    cordillera = new THREE.Mesh(geometriaCordillera(zonas, baja), new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide, fog: false, depthFunc: THREE.AlwaysDepth,
      vertexShader: `// dq:cordillera
        attribute vec3 aCol; attribute vec3 aDat; uniform float uDy;
        varying vec3 vN; varying vec3 vCol; varying vec3 vP; varying vec3 vDat;
        void main() { vN = normal; vCol = aCol; vDat = aDat; vP = position + vec3(0.0, uDy, 0.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `// dq:cordillera
        uniform vec3 uLuzD; uniform vec3 uLuzC; uniform vec3 uAmb; uniform float uVelo;
        varying vec3 vN; varying vec3 vCol; varying vec3 vP; varying vec3 vDat;
        ${GLSL_BASE}
        void main() {
          vec3 d = normalize(vP); float el = d.y;
          vec3 n = normalize(vN);
          float dif = max(dot(n, uLuzD), 0.0);
          float nieve = smoothstep(vDat.y - 0.025, vDat.y + 0.045, vDat.x + n.y * 0.06);
          vec3 roca = mix(vCol, vec3(0.9, 0.93, 1.0), nieve) * (uAmb + uLuzC * dif * (1.0 + 0.25 * nieve));
          vec3 hz = dqCieloBase(normalize(vec3(d.x, max(el, 0.0), d.z)));
          float claro = (1.0 - vDat.z) * smoothstep(-0.01, 0.1, el) * (1.0 - uVelo);
          vec3 c = mix(hz, roca, claro);
          c = mix(uHor, c, smoothstep(-0.004, 0.03, el));
          gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    cordillera.renderOrder = -9; cordillera.frustumCulled = false; escena.add(cordillera);
    if (respaldos) respaldos.push(['cordillera', () => { cordilleraOk = false; cordillera.visible = false; }]);
  } catch (e) { console.warn('[3D] sin cordillera', e); cordillera = null; }

  // ── Nubes 3D (cumulos cercanos) ──
  let nubes = null, nubesOk = true;
  try {
    const N = movil ? 22 : 40, PUFFS = baja ? 4 : alta ? 7 : 6;
    nubes = new THREE.Mesh(geometriaNubes(N, PUFFS, alta && !movil ? 2 : 1), new THREE.ShaderMaterial({
      uniforms: u, transparent: true, fog: false,
      vertexShader: `// dq:nubes3
        attribute vec4 aNube; attribute vec4 aPuff;
        uniform vec3 uCam; uniform float uT; uniform vec3 uLuzD; uniform vec3 uNubL; uniform vec3 uNubS; uniform vec3 uHor;
        varying vec3 vC; varying float vA;
        void main() {
          vec3 c = aNube.xyz; c.x += aNube.w * uT;
          c.xz = uCam.xz + mod(c.xz - uCam.xz + 550.0, 1100.0) - 550.0;
          vec3 nrm = normalize(position);
          vec3 w = c + aPuff.xyz + position * vec3(1.35, 0.78, 1.1) * aPuff.w;
          // Arriba y hacia la luz, claro; la panza, en sombra.
          float k = clamp((dot(nrm, uLuzD) * 0.5 + 0.5) * 0.6 + (nrm.y * 0.5 + 0.5) * 0.62 - 0.14, 0.0, 1.0);
          k = k * k * (3.0 - 2.0 * k);
          float dl = length(w.xz - uCam.xz);
          vC = mix(mix(uNubS, uNubL, k), uHor, smoothstep(160.0, 540.0, dl) * 0.6);
          vA = (1.0 - smoothstep(380.0, 540.0, length(c.xz - uCam.xz))) * 0.96;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `// dq:nubes3
        varying vec3 vC; varying float vA;
        void main() {
          gl_FragColor = vec4(vC, vA);
          #include <colorspace_fragment>
        }`,
    }));
    nubes.frustumCulled = false; nubes.renderOrder = -5; escena.add(nubes);
    if (respaldos) respaldos.push(['nubes3', () => { nubesOk = false; nubes.visible = false; }]);
  } catch (e) { console.warn('[3D] sin nubes 3D', e); nubes = null; }

  // ── Estado (objetivos que fija ambiente() y que cuadro() alcanza poco a poco) ──
  const solV = V3(0, 1, 0), lunaV = V3(0, -1, 0), luzD = V3(0.3, 0.8, 0.3);
  const nubL = NUB_L_DIA.clone(), nubS = NUB_S_DIA.clone(), luzC = new THREE.Color(1, 1, 1), tmp = new THREE.Color();
  let nubObj = 0.4, veloObj = 0, viaObj = 0, solK = 1, lunaK = 0, luzZona = 1, fijo = false, oculto = false, listo = false;
  const COBERTURA = { despejado: 0.4, lluvia: 0.86, tormenta: 1, nieve: 0.8, niebla: 0.7, arena: 0.3 };
  const COB_ZONA = { desierto: 0.24, selva: 0.5, tormenta: 0.62, cumbres: 0.46, amanecer: 0.44, castillo: 0.52 };
  const VELO = { despejado: 0, lluvia: 0.5, tormenta: 0.66, nieve: 0.7, niebla: 1, arena: 1 };

  return {
    m, u, nubes, cordillera, ruido, sol: solV, luna: lunaV, luz: luzD,
    // Cada ~250 ms: hora del mundo (0..24), zona, clima, cuanto es de noche (0..1), fuerza del
    // ocaso (0..1), luz de la zona (LUZ de mundo.js), nubosidad del clima (1 = despejado) y reloj.
    ambiente(h, z, cl, nocheK, ocaso, luz, nub, ahora) {
      // El sol sale a las 5:20 y se pone a las 19:00; la luna hace el camino contrario de noche.
      const DIA0 = 5.33, DIA1 = 19, largoD = DIA1 - DIA0;
      if (h >= DIA0 && h <= DIA1) {
        const f = Math.PI * (h - DIA0) / largoD;
        solV.set(Math.cos(f), Math.sin(f) * 0.95, 0.35).normalize(); lunaV.set(-Math.cos(f), -Math.sin(f) * 0.9, -0.3).normalize();
      } else {
        const f = Math.PI * ((h - DIA1 + 24) % 24) / (24 - largoD);
        lunaV.set(Math.cos(f), Math.sin(f) * 0.9, -0.3).normalize(); solV.set(-Math.cos(f), -Math.sin(f) * 0.95, 0.35).normalize();
      }
      fijo = z === 'cueva' || z === 'eter'; oculto = z === 'cueva';
      luzZona = luz || 1;
      solK = oculto ? 0 : suave(-0.07, 0.01, solV.y) * (z === 'eter' ? 0.5 : 1);
      lunaK = oculto ? 0 : suave(-0.06, 0.03, lunaV.y) * suave(0.3, 0.7, nocheK);
      u.uSolC.value.copy(SOL_ALTO).lerp(SOL_BAJO, 1 - suave(0.02, 0.4, solV.y));
      // Fase de la luna: cambia cada dia del mundo (ciclo de 8 dias; nunca llega a luna nueva).
      const fa = 2.1 * Math.sin(Math.floor((ahora || 0) / diaMs) % 8 / 8 * TAU);
      u.uFase.value.set(Math.sin(fa), 0.12, Math.cos(fa)).normalize();
      // De donde viene la luz para nubes, cordillera y brillos del agua: del sol, o de la luna de noche.
      const wS = solK * (1 - nocheK) + 0.02, wL = lunaK * 0.6;
      luzD.set(solV.x * wS + lunaV.x * wL, Math.max(0, solV.y) * wS + Math.max(0, lunaV.y) * wL + 0.12, solV.z * wS + lunaV.z * wL).normalize();
      const nk = suave(0.72, 1, nocheK), oc = fijo ? 0 : ocaso, gris = clamp((1 - nub) * 1.7, 0, 0.85);
      nubL.copy(NUB_L_DIA).lerp(NUB_L_OCA, oc * 0.85).lerp(NUB_L_NOC, nk);
      nubS.copy(NUB_S_DIA).lerp(NUB_S_OCA, oc * 0.8).lerp(NUB_S_NOC, nk);
      if (gris > 0) { tmp.copy(NUB_GRIS).multiplyScalar(1 - nk * 0.8); nubL.lerp(tmp, gris); nubS.lerp(tmp.multiplyScalar(0.62), gris); }
      luzC.copy(LUZ_DIA).lerp(LUZ_OCA, oc * 0.8).lerp(LUZ_NOC, nk).multiplyScalar((0.85 - 0.5 * nk) * (0.45 + 0.55 * nub) * luzZona);
      nubObj = oculto ? 0 : z === 'eter' ? 0.3 : cl === 'despejado' ? (COB_ZONA[z] || COBERTURA.despejado) : (COBERTURA[cl] || 0.5);
      veloObj = fijo ? 1 : Math.max(VELO[cl] || 0, z === 'cumbres' ? 0.12 : 0);
      viaObj = z === 'eter' ? 0.8 : oculto ? 0 : suave(0.6, 1, nocheK) * (cl === 'despejado' ? 1 : 0.15);
    },
    // Cada cuadro. hor = color del horizonte (el de la niebla), top = color del cenit.
    cuadro(cam, t, dt, hor, top, nocheK, ocaK, brumaObj) {
      const p = cam.position, k = listo ? Math.min(1, dt * 0.8) : 1, seg = t / 1000;
      listo = true;
      m.position.copy(p);
      u.uHor.value.copy(hor); u.uTop.value.copy(top); u.uNoche.value = nocheK; u.uOcaK.value = ocaK;
      u.uBruma.value += (brumaObj - u.uBruma.value) * Math.min(1, dt);
      u.uSol.value.copy(solV); u.uLuna.value.copy(lunaV); u.uLuzD.value.copy(luzD);
      u.uSolK.value += (solK - u.uSolK.value) * k; u.uLunaK.value += (lunaK - u.uLunaK.value) * k;
      u.dqNub.value += (nubObj - u.dqNub.value) * Math.min(1, k * 0.5);
      u.uVelo.value += (veloObj - u.uVelo.value) * k; u.uVia.value += (viaObj - u.uVia.value) * k;
      // Las nubes toman un poco del color del cielo de la zona (en la Noche Eterna no quedan blancas).
      u.uNubL.value.lerp(tmp.copy(nubL).lerp(hor, 0.2).multiplyScalar(0.55 + 0.45 * luzZona), k);
      u.uNubS.value.lerp(tmp.copy(nubS).lerp(hor, 0.34).multiplyScalar(0.55 + 0.45 * luzZona), k);
      u.uLuzC.value.lerp(luzC, k);
      u.uAmb.value.lerp(tmp.copy(hor).multiplyScalar(0.5).lerp(top, 0.22), k);
      // Deriva de la capa de nubes (ya envuelta a 0..1: sin perdida de precision en moviles).
      u.dqDes.value.set((seg * 0.0042) % 1, (seg * 0.0016) % 1, (seg * -0.0065) % 1, (seg * 0.0011) % 1);
      u.uCam.value.copy(p); u.uT.value = seg;
      if (nubes) nubes.visible = nubesOk && !oculto;
      if (cordillera) {
        const ver = cordilleraOk && !fijo && u.uVelo.value < 0.985;
        cordillera.visible = ver;
        if (ver) { const dy = -Math.max(0, p.y) * 0.12; cordillera.position.set(p.x, p.y + dy, p.z); u.uDy.value = dy; }
      }
    },
    // Estrellas (PointsMaterial de mundo.js, ya con su parpadeo «vTw»): se apagan tras la luna y las nubes.
    velarEstrellas(sh) {
      if (baja) return;
      const v = sh.vertexShader, ancla = 'gl_PointSize = size * (0.8 + 0.45 * vTw);';
      if (!v.includes(ancla) || !v.includes('#include <common>')) return;
      sh.uniforms.dqRuido = u.dqRuido; sh.uniforms.dqDes = u.dqDes; sh.uniforms.dqNub = u.dqNub; sh.uniforms.uLuna = u.uLuna; sh.uniforms.uLunaK = u.uLunaK;
      sh.vertexShader = v.replace('#include <common>', '#include <common>\nuniform vec3 uLuna; uniform float uLunaK;' + GLSL_NUBE)
        .replace(ancla, `vec3 dqD = normalize(position); vec2 dqUv; float dqN;
          vTw *= (1.0 - smoothstep(0.9972, 0.9984, dot(dqD, uLuna)) * step(0.01, uLunaK)) * (1.0 - dqNube(dqD, dqUv, dqN));
          ` + ancla);
    },
  };
}
