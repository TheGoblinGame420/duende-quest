// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — particulas en la GPU
//
// Un solo THREE.Points con un anillo de N particulas: chispas al golpear,
// polvo al aterrizar, estallidos al morir... Cada particula guarda su origen,
// velocidad, nacimiento y vida; la posicion se calcula en el shader (sin
// tocar la CPU por cuadro salvo el reloj). Aditivas, sin escribir profundidad.
// Aparte, un "ambiente" de motas que siguen a la camara (luciernagas de
// noche, eter en el Abismo, polvo en la cueva).
// Cada particula lleva una FORMA (atributo frm): punto, chispa alargada en la
// direccion en que vuela, estrella suave de 4 puntas, humo que se hincha,
// anillo expansivo (onda de un critico) y destello. El ambiente cambia por
// zona: luciernagas, hojas que caen, copos, ceniza con brasas, arena con
// viento, motas de eter y polvo de cueva.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';

// Formas (frm): 0 punto · 1 chispa · 2 estrella · 3 humo · 4 anillo · 5 destello
const FORMAS = { punto: 0, chispa: 1, estrella: 2, humo: 3, anillo: 4, destello: 5 };
const VERT = `
attribute vec3 vel; attribute vec4 dat; attribute vec3 col; attribute float frm;
uniform float uT; uniform float uEsc; uniform float uMaxPx;
varying vec3 vCol; varying float vA; varying float vF; varying vec2 vDir; varying float vW;
void main() {
  float edad = uT - dat.x;            // dat: nacimiento, vida, tamaño, gravedad
  // max(): las particulas nunca usadas tienen vida 0; sin el, k = infinito, el tamaño y el alfa salian NaN y en
  // Windows (ANGLE) se dibujaban como puntos enormes en el origen del mundo (la plaza): sobredibujo y, en calidad
  // alta, pantalla negra (el NaN entra al resplandor del post-proceso).
  float k = edad / max(dat.y, 0.001);
  vec3 v = vel + vec3(0.0, -dat.w * edad, 0.0);
  vec3 p = position + vel * edad + vec3(0.0, -0.5 * dat.w * edad * edad, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  if (frm > 3.5) mv.z += 0.8;         // anillo y destello: un poco hacia la camara, que no se hundan en el monstruo
  gl_Position = projectionMatrix * mv;
  float vivo = step(0.0, edad) * step(k, 1.0);
  float esc = 1.0 - 0.6 * k;                              // punto, chispa, estrella: se apagan encogiendo
  if (frm > 2.5 && frm < 3.5) esc = 0.6 + 1.6 * k;        // humo: se hincha
  else if (frm > 3.5 && frm < 4.5) esc = 0.15 + 1.85 * sqrt(k);   // anillo: onda que se abre
  else if (frm > 4.5) esc = 0.7 + 0.6 * k;               // destello
  gl_PointSize = min(vivo * dat.z * uEsc * esc / max(0.5, -mv.z), uMaxPx);   // tope por calidad: menos overdraw con un critico pegado a la camara
  // Chispa: direccion de vuelo en pantalla (en espacio de vista basta) y lo fina que va segun la rapidez.
  vec2 vv = (modelViewMatrix * vec4(v, 0.0)).xy;
  float lv = length(vv);
  vDir = lv > 0.001 ? vec2(vv.x, -vv.y) / lv : vec2(1.0, 0.0);
  vW = mix(1.0, 0.2, clamp(lv / 3.0, 0.0, 1.0));
  vF = frm; vCol = col;
  vA = vivo * (frm > 3.5 ? 1.0 - k : 1.0 - k * k);
}`;
const FRAG = `
uniform float uNuc;
varying vec3 vCol; varying float vA; varying float vF; varying vec2 vDir; varying float vW;
void main() {
  vec2 c = gl_PointCoord - 0.5; float a;
  if (vF < 0.5) { float d = dot(c, c); if (d > 0.25) discard; a = 1.0 - d * 4.0; }
  else if (vF < 1.5) {
    float u = dot(c, vDir), w = dot(c, vec2(-vDir.y, vDir.x)) / vW;
    float d = (u * u + w * w) * 4.0; if (d > 1.0) discard; a = (1.0 - d) * (1.0 - d) * 1.4;
  } else if (vF < 2.5) {
    vec2 q = abs(c) * 2.0; float d = length(c) * 2.0; if (d > 1.0) discard;
    a = clamp(0.02 / (q.x * q.y + 0.02) * (1.0 - d) + exp(-d * d * 12.0) * 0.8, 0.0, 1.0);
  } else if (vF < 3.5) { float d = dot(c, c) * 4.0; if (d > 1.0) discard; a = (1.0 - d) * (1.0 - d) * 0.45; }
  else if (vF < 4.5) { float r = length(c) * 2.0; if (r > 1.0) discard; a = smoothstep(0.68, 0.86, r) * (1.0 - smoothstep(0.89, 1.0, r)) * 1.3; }
  else { float r = length(c) * 2.0; if (r > 1.0) discard; a = exp(-r * r * 5.0); }
  // Nucleo caliente (uNuc > 0, de calidad media para arriba): el centro de chispas, estrellas y destellos tira a
  // blanco y el color gana fuerza; con el resplandor del post-proceso es lo que hace brillar un golpe. El humo no.
  float nuc = vF > 2.5 && vF < 3.5 ? 0.0 : uNuc;
  gl_FragColor = vec4(vCol * (1.0 + 0.3 * nuc) + vec3(nuc * a * a * 0.55), vA * a);
}`;
// Ambientes por zona. m: modo del shader · c/c2: colores (c2 para la fraccion < corte)
// · tam: metros · frac: parte de las motas que se dibujan · add: aditivo (brilla) · a: opacidad.
const AMB = {
  luciernagas: { m: 0, c: '#d9f99d', c2: '#fde047', corte: 0.35, tam: 0.17, frac: 0.55, add: true,  a: 0.95 },
  eter:        { m: 1, c: '#c4b5fd', c2: '#67e8f9', corte: 0.3,  tam: 0.15, frac: 0.8,  add: true,  a: 0.9 },
  polvo:       { m: 2, c: '#a8a29e', c2: '#d6d3d1', corte: 0.5,  tam: 0.13, frac: 0.6,  add: true,  a: 0.7 },
  hojas:       { m: 3, c: '#4d7c0f', c2: '#d97706', corte: 0.4,  tam: 0.32, frac: 0.35, add: false, a: 0.9 },
  nieve:       { m: 4, c: '#ffffff', c2: '#e0f2fe', corte: 0.4,  tam: 0.16, frac: 1,    add: false, a: 0.85 },
  ceniza:      { m: 5, c: '#57534e', c2: '#fb923c', corte: 0.3,  tam: 0.15, frac: 0.8,  add: false, a: 0.85 },
  arena:       { m: 6, c: '#d6b47a', c2: '#ecd3a0', corte: 0.4,  tam: 0.22, frac: 1,    add: false, a: 0.5 },
};

// cal (opcional): 'alta' | 'media' | 'baja' — fija el tamaño maximo en pantalla de cada particula.
export function crearParticulas(escena, max, movil, pobre, cal) {
  const N = max || 1500;
  const MULT = pobre ? 0.4 : movil ? 0.6 : 1;   // menos particulas en moviles modestos
  const cuenta = n => Math.max(1, Math.round(n * MULT));
  // Tope de px por particula: en baja un pisoton o un critico cerca de la camara no llena la pantalla de quads aditivos.
  const MAXPX = pobre || cal === 'baja' ? 110 : cal === 'media' || (!cal && movil) ? 200 : 480;
  // En baja, humo y anillos (los quads mas grandes) salen a la mitad.
  const mitad = (f, n) => (pobre && (f === 3 || f === 4)) ? Math.ceil(n / 2) : n;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), dat = new Float32Array(N * 4), col = new Float32Array(N * 3), frm = new Float32Array(N);
  for (let i = 0; i < N; i++) dat[i * 4] = -1e6;   // todas muertas
  const at = (n, a, k) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, b); return b; };
  const aP = at('position', pos, 3), aV = at('vel', vel, 3), aD = at('dat', dat, 4), aC = at('col', col, 3), aF = at('frm', frm, 1);
  const u = { uT: { value: 0 }, uEsc: { value: 320 }, uMaxPx: { value: MAXPX }, uNuc: { value: 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 5;
  escena.add(pts);
  let cab = 0, sucioIni = N, sucioFin = 0;
  const c = new THREE.Color();
  const reloj = () => performance.now() / 1000;
  // Una particula suelta: posicion, velocidad, nacimiento (s), vida (s), tamaño (m), gravedad, color y forma.
  function una(x, y, z, vx, vy, vz, nac, vida, tam, gr, cr, cg, cb, f) {
    const i = cab; cab = (cab + 1) % N;
    sucioIni = Math.min(sucioIni, i); sucioFin = Math.max(sucioFin, i + 1);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    dat[i * 4] = nac; dat[i * 4 + 1] = vida; dat[i * 4 + 2] = tam; dat[i * 4 + 3] = gr;
    col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;
    frm[i] = f;
  }
  // o.forma (opcional): 'punto' | 'chispa' | 'estrella' | 'humo' | 'anillo' | 'destello'
  // o.retraso (opcional): segundos en que se reparten los nacimientos.
  function emitir(x, y, z, o) {
    o = o || {};
    const f = FORMAS[o.forma] || 0, ret = o.retraso || 0.04;
    const n = mitad(f, cuenta(o.n || 12));
    c.set(o.color || '#ffd34d');
    const v = o.vel || 4, vida = o.vida || 0.6, tam = o.tam || 1, gr = o.grav === undefined ? 9 : o.grav, sube = o.sube || 0, r = o.radio || 0.15;
    const tb = f === 1 ? 0.45 : f === 3 ? 0.5 : 0.16;   // la chispa y el humo se ven mas grandes que un punto
    const t0 = reloj();
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = o.plano ? (Math.random() - 0.5) * 0.3 : Math.random() * 2 - 1, s = v * (0.4 + Math.random() * 0.6);
      const ce = Math.sqrt(1 - e * e), j = 0.85 + Math.random() * 0.3;
      una(x + Math.cos(a) * r, y, z + Math.sin(a) * r,
        Math.cos(a) * ce * s, (o.plano ? 0.6 : e) * s + sube, Math.sin(a) * ce * s,
        t0 + Math.random() * ret, vida * (0.6 + Math.random() * 0.5), tb * tam * (0.6 + Math.random() * 0.7), gr,   // tam en metros
        c.r * j, c.g * j, c.b * j, f);
    }
  }
  // Golpe: chispas alargadas que saltan y un destello; el critico suma un anillo expansivo y estrellas.
  function golpe(x, y, z, o) {
    o = o || {};
    const crit = !!o.critico, t0 = reloj();
    c.set(o.color || '#fff1c1');
    const n = cuenta(crit ? 22 : 10), v = crit ? 9 : 6;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.5 - 0.5, s = v * (0.45 + Math.random() * 0.55), ce = Math.sqrt(Math.max(0, 1 - e * e));
      una(x, y, z, Math.cos(a) * ce * s, e * s + 1.5, Math.sin(a) * ce * s, t0 + Math.random() * 0.03, 0.22 + Math.random() * 0.18, 0.28 + Math.random() * 0.2, 16, c.r, c.g, c.b, 1);
    }
    una(x, y, z, 0, 0, 0, t0, crit ? 0.2 : 0.13, crit ? 2.4 : 1.3, 0, (c.r + 1) / 2, (c.g + 1) / 2, (c.b + 1) / 2, 5);
    if (crit) {
      una(x, y, z, 0, 0, 0, t0, 0.36, 2.0, 0, 1, 0.85, 0.35, 4);
      if (mitad(4, 2) > 1) una(x, y, z, 0, 0, 0, t0 + 0.07, 0.42, 2.9, 0, 1, 0.62, 0.2, 4);   // en baja, un solo anillo
      emitir(x, y, z, { n: 6, color: '#fff3b0', vel: 2.5, vida: 0.6, grav: -1, tam: 1.8, forma: 'estrella' });
    }
  }
  // Subir de nivel: columna de luz, espiral de chispas doradas de dos brazos, anillo en los pies y destello.
  function subirNivel(x, y, z) {
    const t0 = reloj(), R = Math.random;
    const nc = cuenta(36);
    for (let k = 0; k < nc; k++) {
      const a = R() * 6.283, r = R() * 0.3;
      una(x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 0, 7 + R() * 5, 0, t0 + k / nc * 0.9, 0.7 + R() * 0.3, 0.5 + R() * 0.5, 0, 1, 0.95, 0.7, R() < 0.5 ? 5 : 2);
    }
    const ne = cuenta(64);
    for (let k = 0; k < ne; k++) {
      const s = k / ne, a = s * 14 + (k % 2) * Math.PI, r = 0.95 - s * 0.25, ca = Math.cos(a), sa = Math.sin(a), j = 0.85 + R() * 0.3;
      una(x + ca * r, y + 0.15, z + sa * r, -sa * 2.4, 3, ca * 2.4, t0 + s * 1.2, 1.1, 0.35 + R() * 0.15, 0, j, 0.84 * j, 0.29 * j, 2);
    }
    una(x, y + 0.15, z, 0, 0, 0, t0, 0.6, 2.4, 0, 1, 0.9, 0.4, 4);
    una(x, y + 1.1, z, 0, 0.5, 0, t0, 0.35, 2.6, 0, 1, 1, 0.85, 5);
    emitir(x, y + 1, z, { n: 24, color: '#fff7cc', vel: 7, vida: 0.5, grav: 6, forma: 'chispa' });
  }
  // Brillo pulsante (botin epico/legendario): llamado cada ~0.4-0.8 s da un latido de luz con estrellitas.
  function brillo(x, y, z, color, fuerte) {
    const t0 = reloj(), R = Math.random;
    c.set(color || '#c084fc');
    una(x, y, z, 0, 0.3, 0, t0, 0.75, fuerte ? 2.2 : 1.5, 0, c.r, c.g, c.b, 5);
    const n = cuenta(fuerte ? 4 : 2);
    for (let k = 0; k < n; k++) una(x + (R() - 0.5) * 0.8, y + R() * 0.3, z + (R() - 0.5) * 0.8, (R() - 0.5) * 0.4, 0.8 + R(), (R() - 0.5) * 0.4, t0 + R() * 0.3, 1, 0.3 + R() * 0.15, -0.3, c.r, c.g, c.b, 2);
  }
  // Motas de ambiente: una nube que se recoloca alrededor de la camara.
  // El modo (uniform uModo) decide como se mueven y se dibujan: caen, suben, las lleva el viento...
  const NA = pobre ? 60 : movil ? 110 : 240, LADO = 46, MED = (LADO / 2).toFixed(1);
  const ga = new THREE.BufferGeometry(), pa = new Float32Array(NA * 3), fa = new Float32Array(NA);
  for (let i = 0; i < NA; i++) { pa[i * 3] = (Math.random() - 0.5) * LADO; pa[i * 3 + 1] = Math.random() * 14; pa[i * 3 + 2] = (Math.random() - 0.5) * LADO; fa[i] = Math.random() * 6.28; }
  ga.setAttribute('position', new THREE.BufferAttribute(pa, 3)); ga.setAttribute('fase', new THREE.BufferAttribute(fa, 1));
  const ua = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#d9f99d') }, uCol2: { value: new THREE.Color('#fde047') }, uCorte: { value: 0.35 }, uA: { value: 0 }, uEsc: { value: 320 }, uModo: { value: 0 }, uTam: { value: 0.17 } };
  const ma = new THREE.ShaderMaterial({
    uniforms: ua, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float fase; uniform float uT; uniform vec3 uC; uniform float uEsc; uniform float uModo; uniform float uTam;
      varying float vB; varying float vV; varying float vRot;
      void main() {
        float m = uModo, r = fract(fase * 7.31);
        vec3 b = position; float cae = 0.0;
        if (m > 2.5 && m < 3.5) cae = 1.0 + r * 0.6;                          // hojas
        else if (m > 3.5 && m < 4.5) cae = 0.9 + r * 0.7;                     // copos
        else if (m > 4.5 && m < 5.5) cae = r < 0.3 ? -1.4 - r * 2.0 : 0.6 + r * 0.5;   // ceniza cae, las brasas suben
        else if (m > 0.5 && m < 1.5) cae = -0.35 - r * 0.3;                   // eter: sube lento
        else if (m > 5.5) cae = 0.25;                                          // arena
        b.y = mod(b.y - uT * cae, 14.0);
        if (m > 5.5) { b.x += uT * (7.0 + r * 5.0); b.z += uT * (1.5 + r); }  // arena: la lleva el viento
        vec3 p = b; p.xz = mod(p.xz - uC.xz + ${MED}, ${LADO.toFixed(1)}) - ${MED} + uC.xz;
        p.y += uC.y - 4.0;
        float am = m < 0.5 ? 0.9 : (m > 2.5 && m < 3.5) ? 1.3 : m > 5.5 ? 0.2 : 0.45;
        p.x += sin(uT * 0.4 + fase * 2.0) * am; p.z += cos(uT * 0.5 + fase) * am;
        if (m < 0.5) p.y += sin(uT * 0.7 + fase) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float borde = smoothstep(0.0, 1.5, b.y) * smoothstep(14.0, 12.5, b.y);   // sin aparecer de golpe arriba o abajo
        vB = m < 0.5 ? pow(0.5 + 0.5 * sin(uT * 2.3 + fase * 3.0), 2.0) * 1.3 : m < 1.5 ? 0.6 + 0.4 * sin(uT * 1.7 + fase * 3.0) : borde;
        vV = r; vRot = uT * (0.8 + r * 2.0) + fase;
        gl_PointSize = uEsc * uTam * (0.7 + r * 0.6) / max(1.0, -mv.z);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uCol2; uniform float uCorte; uniform float uA; uniform float uModo;
      varying float vB; varying float vV; varying float vRot;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float a; float m = uModo;
        vec3 col = vV < uCorte ? uCol2 : uCol;
        if (m < 1.5) { float r = length(c) * 2.0; if (r > 1.0) discard; a = exp(-r * r * 6.0) + (m > 0.5 ? 0.25 * (1.0 - r) : 0.0); }
        else if (m > 2.5 && m < 3.5) {
          float s = sin(vRot), co = cos(vRot); vec2 q = vec2(co * c.x - s * c.y, s * c.x + co * c.y);
          float d = q.x * q.x * 4.0 + q.y * q.y * 25.0; if (d > 1.0) discard;
          a = 0.95; col *= 0.75 + 0.5 * (0.5 - q.y);
        } else if (m > 5.5) { float d = c.x * c.x * 4.0 + c.y * c.y * 49.0; if (d > 1.0) discard; a = 1.0 - d; }
        else { float d = dot(c, c) * 4.0; if (d > 1.0) discard; a = 1.0 - d * d; }
        gl_FragColor = vec4(col, uA * vB * a);
      }`,
  });
  const amb = new THREE.Points(ga, ma);
  amb.frustumCulled = false; amb.renderOrder = 5; amb.visible = false;
  escena.add(amb);
  let ambAct = '', ambPend = '';
  function ponAmbiente(tipo) {
    ambAct = tipo;
    const d = AMB[tipo]; if (!d) return;
    ua.uModo.value = d.m; ua.uCol.value.set(d.c); ua.uCol2.value.set(d.c2); ua.uCorte.value = d.corte; ua.uTam.value = d.tam;
    ga.setDrawRange(0, Math.max(8, Math.round(NA * d.frac)));
    const bl = d.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (ma.blending !== bl) { ma.blending = bl; ma.needsUpdate = true; }
  }
  return {
    emitir, golpe, subirNivel, brillo,
    // Nucleo caliente de las particulas (mundo.js lo enciende de calidad media para arriba).
    calidad(fina) { u.uNuc.value = fina ? 1 : 0; },
    // tipo: 'luciernagas' | 'eter' | 'polvo' | 'hojas' | 'nieve' | 'ceniza' | 'arena' | ''
    ambiente(tipo) { ambPend = AMB[tipo] ? tipo : ''; },
    actualizar(dt, cam, alto) {
      const t = reloj();
      u.uT.value = t; ua.uT.value = t;
      u.uEsc.value = ua.uEsc.value = alto * 0.87;   // px por metro a 1 m (fov 60)
      if (sucioFin > sucioIni) {
        for (const b of [aP, aV, aD, aC, aF]) { b.clearUpdateRanges ? (b.clearUpdateRanges(), b.addUpdateRange(sucioIni * b.itemSize, (sucioFin - sucioIni) * b.itemSize)) : (b.updateRange = { offset: sucioIni * b.itemSize, count: (sucioFin - sucioIni) * b.itemSize }); b.needsUpdate = true; }
        sucioIni = N; sucioFin = 0;
      }
      // Cambio de ambiente: se apaga el que hay y luego se enciende el nuevo (sin saltos de color ni forma).
      if (ambPend !== ambAct) { ua.uA.value -= Math.min(1, dt * 2); if (ua.uA.value <= 0.02) { ua.uA.value = 0; ponAmbiente(ambPend); } }
      else ua.uA.value += ((ambAct ? AMB[ambAct].a : 0) - ua.uA.value) * Math.min(1, dt * 1.5);
      amb.visible = ua.uA.value > 0.02;
      ua.uC.value.copy(cam);
    },
  };
}
