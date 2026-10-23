// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — modelos 3D de personajes y monstruos
//
// Todo sale de primitivas de Three.js (sin texturas ni archivos): estilo
// low-poly con sombreado plano. Cada modelo es un "rig" de pivotes (cuerpo,
// cabeza, brazos, piernas, alas, cola...) que se anima por codigo.
//
// API:
//   crearDuende({ skin, clase, arma }) -> Modelo   (el jugador)
//   crearMonstruo(k)                    -> Modelo   (clave de MONSTRUOS)
//   crearNpc(hoja)                      -> Modelo   (NPC del pueblo)
//   precalentar()                                    (crea las geometrias)
// Modelo = { obj, alto, animar(estado, tEstado, t), golpe(), dispose() }
//   obj: THREE.Group con los pies en y = 0 mirando a +Z.
//
// Rendimiento: geometrias unitarias y materiales compartidos por cache
// (cada pieza es una malla escalada), MeshLambertMaterial con flatShading,
// ninguna sombra y menos de ~30 mallas por modelo.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { MONSTRUOS, HOJAS, SKINS, CLASES, ARMAS, MONTURAS, statsMonstruo } from '/mmo/js/data.js?v=246';

const PX_M = 34;                 // pixeles del 2D por metro
const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const suave = k => k * k * (3 - 2 * k);
const arco = k => (k > 0 && k < 1 ? Math.sin(PI * k) : 0);

// ── COLORES ──
const col = c => (c && c.isColor ? c.clone() : new THREE.Color(c));
const osc = (c, k) => col(c).multiplyScalar(k);                  // oscurece (k < 1) o aclara
const mez = (a, b, k) => col(a).lerp(col(b), k);                  // mezcla dos colores

// ── GEOMETRIAS COMPARTIDAS (unitarias: cada malla se escala) ──
function forma(puntos) {
  const s = new THREE.Shape();
  puntos.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}
// Corona: cilindro abierto con picos en el borde de arriba.
function geoCorona() {
  const g = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const p = g.attributes.position;
  for (let i = 0; i <= 10; i++) if (i % 2 === 0) p.setY(i, 1.1);   // fila de arriba
  g.translate(0, 0.5, 0);
  g.computeVertexNormals();
  return g;
}
const FABRICA = {
  esfera: () => new THREE.SphereGeometry(1, 10, 7),
  esferaB: () => new THREE.SphereGeometry(1, 6, 4),                       // baja
  semi: () => new THREE.SphereGeometry(1, 10, 4, 0, PI * 2, 0, PI / 2),   // cupula (y de 0 a 1)
  caja: () => new THREE.BoxGeometry(1, 1, 1),
  cil: () => new THREE.CylinderGeometry(1, 1, 1, 8),                      // centrado
  cilT: () => new THREE.CylinderGeometry(1, 0.8, 1, 7).translate(0, -0.5, 0), // cuelga desde y = 0
  tronco: () => new THREE.CylinderGeometry(0.55, 1, 1, 8).translate(0, 0.5, 0), // base en y = 0
  cono: () => new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),        // base en 0, punta en y = 1
  cono4: () => new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0),       // pua / piramide
  icos: () => new THREE.IcosahedronGeometry(1, 0),
  toro: () => new THREE.TorusGeometry(1, 0.13, 5, 18).rotateX(PI / 2),    // aro horizontal
  anillo: () => new THREE.RingGeometry(0.72, 1, 28).rotateX(-PI / 2),     // aura del suelo
  corona: geoCorona,
  // Ala de murcielago/dragon: hacia +x, con el borde de ataque delante.
  ala: () => new THREE.ShapeGeometry(forma([[0, -0.1], [0.55, -0.12], [1, 0.05], [0.85, 0.35], [0.62, 0.22], [0.45, 0.55], [0.26, 0.3], [0, 0.45]])).rotateX(-PI / 2),
  // Ala de plumas (pajaros, angel).
  pluma: () => new THREE.ShapeGeometry(forma([[0, -0.08], [0.6, -0.12], [1, -0.02], [0.92, 0.14], [0.78, 0.3], [0.55, 0.42], [0.28, 0.48], [0, 0.4]])).rotateX(-PI / 2),
  // Aleta triangular en el plano YZ (hacia atras y arriba).
  aleta: () => new THREE.ShapeGeometry(forma([[0, 0], [1, 0], [0.25, 1]])).rotateY(PI / 2),
  // Cola de pez ahorquillada en el plano YZ (hacia atras).
  colaPez: () => new THREE.ShapeGeometry(forma([[0, 0], [1, 0.7], [0.7, 0], [1, -0.7]])).rotateY(PI / 2),
};
const GEOS = new Map();
function geo(k) {
  let g = GEOS.get(k);
  if (!g) { g = FABRICA[k](); g.computeBoundingBox(); GEOS.set(k, g); }
  return g;
}

// ── MATERIALES COMPARTIDOS (por color y opciones) ──
// o: { e: brillo emisivo 0..1, op: opacidad, ds: dos caras, aura: aditivo sin luz }
const MATS = new Map();
function mat(color, o) {
  o = o || {};
  const c = col(color);
  const k = c.getHexString() + '|' + (o.e || 0) + '|' + (o.op || 1) + '|' + (o.ds ? 1 : 0) + '|' + (o.aura ? 1 : 0);
  let m = MATS.get(k);
  if (m) return m;
  const op = o.op || 1;
  if (o.aura) {
    m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  } else {
    m = new THREE.MeshLambertMaterial({
      color: c, flatShading: true, transparent: op < 1, opacity: op, depthWrite: op >= 1,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
      emissive: o.e ? c : new THREE.Color(0), emissiveIntensity: o.e || 0,
    });
  }
  m.userData.compartido = true;
  MATS.set(k, m);
  return m;
}
const BLANCO = new THREE.MeshBasicMaterial({ color: 0xffffff });   // destello de golpe

// ── PIEZAS ──
// M(padre, geometria, color|material, pos, escala, rot, opciones de material)
// Las mallas son estaticas (matriz fija): lo que se anima son los pivotes.
function M(padre, g, c, pos, esc, rot, o) {
  const me = new THREE.Mesh(geo(g), c && c.isMaterial ? c : mat(c, o));
  if (pos) me.position.set(pos[0], pos[1], pos[2]);
  if (esc != null) typeof esc === 'number' ? me.scale.setScalar(esc) : me.scale.set(esc[0], esc[1], esc[2]);
  if (rot) me.rotation.set(rot[0], rot[1], rot[2]);
  me.matrixAutoUpdate = false;
  me.updateMatrix();
  padre.add(me);
  return me;
}
// Grupo (pivote) en una posicion y giro.
function G(padre, pos, rot) {
  const g = new THREE.Group();
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  padre.add(g);
  return g;
}
// Marca un objeto como animable: se guarda su pose de reposo.
function piv(r, o) { o.matrixAutoUpdate = true; r.piv.push(o); return o; }
// Fuera de la medida de altura (sombreros, armas, halos, auras).
function fuera(o) { o.userData.noAlto = true; return o; }

// ── RIG ──
// modo: 'bipedo' | 'cuadrupedo' | 'volador' | 'flota' | 'baba' | 'pez' |
//       'serpiente' | 'salto' | 'pulpo'
function nuevoRig(modo) {
  return {
    raiz: new THREE.Group(), modo, piv: [],
    giran: [], flamas: [], brillo: [], patas: [], segs: [], tent: [], pinzas: [],
    caer: 'atras', hundir: 0.4, paso: 9, aleteo: 0, amplAla: 0.6, colaAmp: 0.3, tAtk: 0.35,
  };
}

// Caja de medida que ignora lo marcado con fuera().
const _caja = new THREE.Box3();
function medir(o, box) {
  if (o.userData.noAlto) return;
  if (o.isMesh) { _caja.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(_caja); }
  for (const h of o.children) medir(h, box);
}

class Modelo {
  constructor(r, alto) {
    this.r = r;
    this.alto = alto;
    this.obj = new THREE.Group();
    this.obj.name = 'modelo';
    this.base = new THREE.Group();          // aqui van rebote, caidas y saltos
    this.obj.add(this.base);
    this.base.add(r.raiz);
    // Escala para medir 'alto' con los pies en y = 0.
    r.raiz.updateMatrixWorld(true);
    const box = new THREE.Box3();
    medir(r.raiz, box);
    if (box.isEmpty()) box.set(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
    // Los bichos muy alargados se limitan a largoMax veces su alto (si no, un
    // lagarto de 1,8 m de alto mediria 6 m de largo). Entonces 'alto' baja.
    const h = Math.max(0.01, box.max.y - box.min.y), largo = box.max.z - box.min.z;
    const s = alto / Math.max(h, r.largoMax ? largo / r.largoMax : 0);
    this.alto = h * s;
    r.raiz.scale.setScalar(s);
    r.raiz.position.y = -box.min.y * s;
    this.escala = s;
    this.ancho = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s;
    // Altura de la cadera (para sentarse en una montura con el estado 'monta').
    this.cadera = r.pI ? r.pI.position.y * s + r.raiz.position.y : this.alto * 0.3;
    for (const o of r.piv) o.userData.reposo = [o.position.clone(), o.rotation.clone(), o.scale.clone()];
    this.mallas = [];
    r.raiz.traverse(o => { if (o.isMesh) this.mallas.push(o); });
    this._tf = 0;
  }
  // estado: quieto | anda | corre | ataca | lanza | herido | muere | salta | vuela | nada
  //         (+ 'monta': sentado en la silla de una montura)
  animar(estado, tEstado, t) { animarRig(this, estado || 'quieto', tEstado || 0, t || 0); }
  // Destello blanco ~120 ms.
  golpe() {
    for (const me of this.mallas) {
      if (me.userData.sinFlash) continue;
      if (!me.userData.m0) me.userData.m0 = me.material;
      me.material = BLANCO;
    }
    clearTimeout(this._tf);
    this._tf = setTimeout(() => this._restaurar(), 120);
  }
  _restaurar() {
    for (const me of this.mallas) if (me.userData.m0) { me.material = me.userData.m0; me.userData.m0 = null; }
  }
  // Aura de jefe (se pone despues de medir: su radio sigue el ancho).
  _aura(c) {
    const me = auraSuelo(this.r, c, Math.max(0.5, (this.ancho * 0.55) / this.escala));
    me.userData.reposo = [me.position.clone(), me.rotation.clone(), me.scale.clone()];
    this.mallas.push(me);
  }
  // Las geometrias y materiales son compartidos: solo se suelta el modelo.
  dispose() {
    clearTimeout(this._tf);
    this._restaurar();
    this.obj.removeFromParent();
    this.mallas.length = 0;
    this.r = null;
  }
}

// ── ANIMACION PROCEDURAL ──
// Cada frame: los pivotes vuelven a su reposo y se les suma la pose del estado.
function animarRig(m, est, te, t) {
  const r = m.r;
  if (!r) return;
  const b = m.base, A = m.alto;
  for (const o of r.piv) { const u = o.userData.reposo; o.position.copy(u[0]); o.rotation.copy(u[1]); o.scale.copy(u[2]); }
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);

  const corre = est === 'corre';
  const mueve = est === 'anda' || corre || est === 'nada' || est === 'vuela';
  const f = t * r.paso * (corre ? 1.5 : 1);           // fase del paso
  const s = Math.sin(f), c = Math.cos(f);
  const amp = est === 'anda' ? 0.55 : corre ? 0.85 : est === 'nada' ? 0.5 : 0;
  const kA = te / r.tAtk;                              // progreso del ataque
  const ataca = est === 'ataca' && kA < 1.25;
  const aA = arco(kA);                                 // 0 -> 1 -> 0 durante el ataque
  const eL = est === 'lanza' ? Math.min(1, te / 0.25) : 0;
  const muerto = est === 'muere';

  // Lo que se mueve siempre: halos, auras, llamas y brillos.
  for (const [o, v] of r.giran) o.rotation.y += t * v;
  for (let i = 0; i < r.flamas.length; i++) r.flamas[i].scale.y *= 1 + 0.3 * Math.sin(t * 14 + i * 2.1);
  const brilla = eL ? 1.3 + 0.35 * Math.sin(t * 16) : 1 + 0.1 * Math.sin(t * 3);
  for (const o of r.brillo) o.scale.multiplyScalar(brilla);
  if (r.aura) r.aura.scale.multiplyScalar(1 + 0.06 * Math.sin(t * 3));

  // Alas (P = la que sale hacia +x, N = hacia -x). a > 0 = arriba.
  if (r.alaP) {
    const vel = r.aleteo * (mueve || est === 'lanza' ? 1.35 : 1);
    let a = Math.sin(t * vel) * r.amplAla;
    if (muerto) a = -0.25 - 0.2 * Math.min(1, te);
    else if (eL) a = 0.5 + Math.sin(t * vel) * 0.3;
    r.alaP.rotation.z += a; r.alaN.rotation.z -= a;
    if (r.vuela && !muerto) b.position.y -= Math.sin(t * vel) * 0.025 * A;
  }
  if (r.cola && r.colaAmp) r.cola.rotation.y += Math.sin(t * (mueve ? 8 : 2.5)) * r.colaAmp;

  const { cuerpo: cu, cabeza: cb, bI, bD, pI, pD } = r;
  switch (r.modo) {
    case 'bipedo': {
      if (est === 'quieto') {
        const res = Math.sin(t * 2.4);
        if (cu) cu.scale.y *= 1 + 0.022 * res;
        if (cb) cb.rotation.y += Math.sin(t * 0.7) * 0.12;
        if (bI) { bI.rotation.z += 0.05 * res; bD.rotation.z -= 0.05 * res; }
      }
      if (amp && est !== 'nada') {
        if (pI) { pI.rotation.x += s * amp; pD.rotation.x -= s * amp; }
        if (bI) { bI.rotation.x -= s * amp * 0.8; bD.rotation.x += s * amp * 0.8; }
        b.position.y += Math.abs(c) * 0.03 * A * (corre ? 1.4 : 1);
        if (cu) cu.rotation.x += corre ? 0.18 : 0.06;
        if (r.bamboleo && cu) cu.rotation.z += s * 0.15;
        if (r.tunica) r.tunica.rotation.z += s * 0.06;
      }
      if (ataca) {
        // Brazo derecho: arriba y atras, luego tajo hacia delante (~0.35 s).
        const k = Math.min(kA, 1), vuelta = kA < 1 ? 1 : Math.max(0, 1 - (kA - 1) * 4);
        const ang = k < 0.4 ? lerp(0, -3.3, suave(k / 0.4)) : lerp(-3.3, -0.5, suave((k - 0.4) / 0.6));
        if (bD) bD.rotation.x += ang * vuelta;
        if (r.dosArmas && bI) {
          const k2 = clamp((kA - 0.3) / 0.9, 0, 1);
          if (k2 > 0 && k2 < 1) bI.rotation.x += k2 < 0.4 ? lerp(0, -2.6, k2 / 0.4) : lerp(-2.6, -0.4, (k2 - 0.4) / 0.6);
        }
        if (cu) cu.rotation.y += (k < 0.4 ? 0.35 * suave(k / 0.4) : 0.35 - 0.75 * suave((k - 0.4) / 0.6)) * vuelta;
        if (!bD) b.position.z += aA * 0.12 * A;
        if (pI) { pI.rotation.x -= 0.25 * aA; pD.rotation.x += 0.2 * aA; }
      }
      if (eL) {
        if (bI) { bI.rotation.x -= 2.3 * eL; bD.rotation.x -= 2.3 * eL; bI.rotation.z += 0.35 * eL; bD.rotation.z -= 0.35 * eL; }
        if (cu) cu.rotation.x -= 0.12 * eL;
        if (cb) cb.rotation.x -= 0.2 * eL;
      }
      if (est === 'salta') {
        if (pI) { pI.rotation.x -= 1.0; pD.rotation.x -= 0.3; }
        if (bI) { bI.rotation.x -= 2.4; bD.rotation.x -= 2.4; bI.rotation.z += 0.5; bD.rotation.z -= 0.5; }
      }
      if (est === 'vuela') {
        b.rotation.x += 0.35;
        if (pI) { pI.rotation.x += 0.35; pD.rotation.x += 0.45; }
        if (bI && !r.alaP) { bI.rotation.z += 1.1; bD.rotation.z -= 1.1; }
      }
      if (est === 'nada') {
        // Tumbado boca abajo girando sobre la cadera (la cadera no se mueve).
        const h = m.cadera || A * 0.3, th = 1.25;
        b.rotation.x += th; b.position.y += h * (1 - Math.cos(th)); b.position.z -= h * Math.sin(th);
        const br = Math.sin(t * 4);
        if (bI) { bI.rotation.x -= 2.4 + br * 0.5; bD.rotation.x -= 2.4 + br * 0.5; bI.rotation.z += 0.6 + br * 0.5; bD.rotation.z -= 0.6 + br * 0.5; }
        if (pI) { pI.rotation.x += Math.sin(t * 10) * 0.35; pD.rotation.x -= Math.sin(t * 10) * 0.35; }
      }
      if (muerto && bI) { const k = Math.min(1, te / 0.6); bI.rotation.z += 0.9 * k; bD.rotation.z -= 0.9 * k; }
      if (est === 'monta') {
        // Sentado: la cadera queda en el origen (el punto 'silla' de la montura).
        b.position.y -= m.cadera * 0.92;
        if (pI) { pI.rotation.x -= 1.35; pD.rotation.x -= 1.35; pI.rotation.z += 0.45; pD.rotation.z -= 0.45; }
        if (bI) { bI.rotation.x -= 0.6; bD.rotation.x -= 0.6; }
        if (cu) cu.scale.y *= 1 + 0.015 * Math.sin(t * 2.4);
      }
      break;
    }
    case 'cuadrupedo': {
      const ampP = amp * (r.ampPatas || 1);
      // Al correr, galope (las de delante juntas y las de atras juntas); al andar, trote.
      const galope = corre && !r.ampPatas;
      for (const [p, ph, eje, del] of r.patas) {
        const fase = galope ? (del ? 0 : 2.2) + (ph ? 0.35 : 0) : ph;
        if (ampP) p.rotation[eje] += Math.sin(f + fase) * ampP * (eje === 'y' ? 0.6 : 1);
        if (est === 'salta') p.rotation.x += del ? -0.7 : 0.7;
        if (est === 'vuela' && r.vuela) p.rotation.x += del ? 0.5 : 0.9;   // patas recogidas al volar
      }
      if (ampP) {
        if (galope) { b.position.y += Math.max(0, Math.sin(f + 1.1)) * 0.07 * A; b.rotation.x += Math.sin(f + 1.1) * 0.07; }
        else { b.position.y += Math.abs(c) * 0.035 * A; if (cu) cu.rotation.x += s * 0.04; }
      }
      if (est === 'quieto' && cu) cu.scale.y *= 1 + 0.02 * Math.sin(t * 2.2);
      if (cb) cb.rotation.x += Math.sin(t * 1.3) * 0.05;
      if (ataca) {
        b.position.z += aA * 0.15 * A;
        if (cb) cb.rotation.x += aA * 0.35;
        if (r.mandibula) r.mandibula.rotation.x += aA * 0.7;
        for (const p of r.pinzas) p.rotation.x -= aA * 0.6;
      }
      if (eL) {
        b.rotation.x -= 0.28 * eL;
        if (cb) cb.rotation.x -= 0.35 * eL;
        if (r.mandibula) r.mandibula.rotation.x += 0.55 * eL;
      }
      if (est === 'vuela' && r.vuela) b.rotation.x += 0.12;
      break;
    }
    case 'volador': {
      b.rotation.x += mueve ? 0.25 : 0.05;
      for (const [p] of r.patas) p.rotation.x += 0.6;
      if (ataca) { b.position.z += aA * 0.2 * A; b.rotation.x += aA * 0.5; }
      if (eL && cb) cb.rotation.x -= 0.3 * eL;
      if (r.mandibula) r.mandibula.rotation.x += Math.max(aA * (ataca ? 1 : 0), eL) * 0.6;
      break;
    }
    case 'flota': {
      b.position.y += (0.05 + 0.05 * Math.sin(t * 2)) * A;
      if (mueve) b.rotation.x += 0.22;
      if (r.cola) r.cola.rotation.z += Math.sin(t * 2.6) * 0.15;
      if (bI) {
        const w = Math.sin(t * 2.2) * 0.25;
        bI.rotation.x -= 0.5 + w; bD.rotation.x -= 0.5 - w;
        if (ataca) { bI.rotation.x -= aA * 1.6; bD.rotation.x -= aA * 1.6; }
        if (eL) { bI.rotation.x -= 1.8 * eL; bD.rotation.x -= 1.8 * eL; bI.rotation.z += 0.4 * eL; bD.rotation.z -= 0.4 * eL; }
      }
      if (ataca) b.position.z += aA * 0.15 * A;
      break;
    }
    case 'baba': {
      let q = amp ? 0.15 * Math.sin(f * 0.7) : 0.06 * Math.sin(t * 3);
      if (ataca) q = 0.45 * Math.sin(PI * 2 * Math.min(1, kA));        // se estira y aplasta
      if (eL) q = 0.25 * eL + 0.05 * Math.sin(t * 14);
      if (est === 'salta') q = 0.3;
      if (cu) { cu.scale.y *= 1 + q; const xz = 1 / Math.sqrt(Math.max(0.2, 1 + q)); cu.scale.x *= xz; cu.scale.z *= xz; }
      if (ataca) b.position.z += aA * 0.12 * A;
      if (muerto && cu) { const k = Math.min(1, te / 1.2); cu.scale.y *= 1 - 0.85 * k; cu.scale.x *= 1 + 0.5 * k; cu.scale.z *= 1 + 0.5 * k; }
      break;
    }
    case 'pez': {
      const vel = mueve ? (corre ? 14 : 9) : 4;
      b.position.y += Math.sin(t * 1.6) * 0.04 * A;
      if (cu) cu.rotation.y += Math.sin(t * vel) * 0.1;
      if (r.cola) r.cola.rotation.y += Math.sin(t * vel - 1.2) * 0.55;
      if (r.aletas) for (let i = 0; i < r.aletas.length; i++) r.aletas[i].rotation.z += Math.sin(t * vel * 0.7) * 0.4 * (i ? -1 : 1);
      if (ataca) { b.position.z += aA * 0.25 * A; if (r.mandibula) r.mandibula.rotation.x += aA * 0.7; }
      if (eL && r.mandibula) r.mandibula.rotation.x += 0.5 * eL;
      break;
    }
    case 'serpiente': {
      const vel = mueve ? (corre ? 9 : 6) : 2, am = mueve ? 0.13 : 0.05, n = r.segs.length;
      for (let i = 0; i < n; i++) r.segs[i].position.x += Math.sin(t * vel - i * 0.9) * am * (0.4 + i / n);
      if (cb) {
        cb.rotation.y += Math.sin(t * vel + 0.9) * 0.15;
        if (ataca) { cb.position.z += aA * 0.45; cb.position.y -= aA * 0.15; cb.rotation.x += aA * 0.5; }
        if (eL) cb.position.y += 0.2 * eL;
      }
      if (r.mandibula && (ataca || eL)) r.mandibula.rotation.x += Math.max(ataca ? aA : 0, eL) * 0.8;
      if (r.lengua) r.lengua.scale.z *= 1 + Math.max(0, Math.sin(t * 7)) * 0.8;
      break;
    }
    case 'salto': {
      if (amp) {
        const fh = t * r.paso * 0.5 * (corre ? 1.4 : 1), h = Math.abs(Math.sin(fh));
        b.position.y += h * 0.25 * A;
        b.rotation.x -= Math.cos(fh) * Math.sign(Math.sin(fh)) * 0.12;
        if (pI) { pI.rotation.x += h * 0.9; pD.rotation.x += h * 0.9; }
        if (bI) { bI.rotation.x -= h * 0.6; bD.rotation.x -= h * 0.6; }
      } else if (cu) cu.scale.y *= 1 + 0.03 * Math.sin(t * 3);
      if (est === 'salta') { b.position.y += 0.1 * A; if (pI) { pI.rotation.x += 0.9; pD.rotation.x += 0.9; } }
      if (ataca) {
        b.position.z += aA * 0.2 * A; b.position.y += aA * 0.1 * A;
        if (r.lengua) r.lengua.scale.z *= 1 + aA * 9;
        if (r.mandibula) r.mandibula.rotation.x += aA * 0.6;
      }
      if (eL) { b.rotation.x -= 0.25 * eL; if (r.mandibula) r.mandibula.rotation.x += 0.5 * eL; }
      break;
    }
    case 'pulpo': {
      b.position.y += (0.05 + 0.05 * Math.sin(t * 1.8)) * A;
      const vel = mueve ? 6 : 2.5;
      for (let i = 0; i < r.tent.length; i++) {
        r.tent[i].rotation.x += Math.sin(t * vel + i * 0.8) * 0.3 - (eL ? 0.5 * eL : 0) - (ataca ? 0.6 * aA : 0);
      }
      if (ataca) b.position.z += aA * 0.12 * A;
      if (mueve) b.rotation.x += 0.15;
      break;
    }
  }

  // Comunes: retroceso al recibir y caida al morir.
  if (est === 'herido') {
    const e = Math.max(0, 1 - te / 0.35);
    b.rotation.x -= 0.32 * e;
    b.position.z -= 0.06 * A * e;
  }
  if (muerto) {
    const k = Math.min(1, te / 1.4), caida = suave(Math.min(1, k / 0.5)), hunde = Math.max(0, (k - 0.55) / 0.45);
    if (r.caer === 'atras') b.rotation.x = -(PI / 2) * 0.92 * caida;
    else if (r.caer === 'lado') b.rotation.z = (PI / 2) * caida;
    else if (r.caer === 'panza') b.rotation.z = PI * caida;            // peces: panza arriba
    else if (r.caer === 'encoge') b.scale.setScalar(Math.max(0.01, 1 - k));
    b.position.y -= hunde * A * r.hundir;
  }
}

// ═══════════ HUMANOIDES (duende, goblins, esqueletos, magos...) ═══════════
// Medidas en "metros de diseño" (luego se escala al alto pedido).
// o: { piel, ropa, ropaMat, pantalon, botas, cinto, mangas, manos,
//      L (pierna), T (torso), A (brazo), ancho, panza, grueso, cab (escala cabeza),
//      cabeza: 'duende'|'goblin'|'calavera'|'liso', ojos: 'duende'|color, nariz: 'bola'|'pico'|null,
//      orejas (largo), colmillos, tunica (color), huesos, encorvado }
function humano(r, o) {
  const R = r.raiz;
  const L = o.L ?? 0.5, T = o.T ?? 0.5, Ab = o.A ?? 0.4, W = o.ancho ?? 1, H = o.cab ?? 1, P = o.panza ?? 1;
  const piel = o.piel;
  const base0 = o.ropa ?? piel;
  const mRopa = o.ropaMat || (base0.isMaterial ? base0 : mat(base0));
  const gr = o.huesos ? 0.045 : 0.085 * (o.grueso ?? 1);
  // Piernas o tunica
  if (o.tunica) {
    r.tunica = piv(r, M(R, 'tronco', o.tunicaMat || o.tunica, [0, 0, 0], [0.36 * W * P, L + 0.06, 0.32 * W * P]));
  } else {
    for (const lado of [1, -1]) {
      const p = piv(r, G(R, [0.12 * W * lado, L, 0]));
      M(p, 'cilT', o.pantalon ?? mRopa, [0, 0, 0], [gr, L - 0.08, gr]);
      M(p, 'caja', o.botas ?? osc(o.ropa ?? piel, 0.5), [0, -(L - 0.06), 0.04], [o.huesos ? 0.11 : 0.17 * (o.grueso ?? 1), 0.12, 0.26]);
      if (lado > 0) r.pI = p; else r.pD = p;        // la izquierda del personaje esta en +x
    }
  }
  // Cuerpo (pivote en la cadera)
  const cu = r.cuerpo = piv(r, G(R, [0, L, 0], [o.encorvado || 0, 0, 0]));
  if (o.huesos) {
    M(cu, 'cil', piel, [0, T * 0.45, -0.02], [0.035, T * 0.9, 0.035]);                       // columna
    M(cu, 'esferaB', piel, [0, T * 0.66, 0.02], [0.2 * W, 0.17, 0.13]);                      // costillas
    M(cu, 'caja', piel, [0, 0.02, 0], [0.26 * W, 0.08, 0.12]);                               // pelvis
  } else {
    M(cu, 'esfera', mRopa, [0, T * 0.5, 0], [0.27 * W * P, T * 0.58, 0.22 * P]);
    M(cu, 'caja', o.pantalon ?? mRopa, [0, 0.02, 0], [0.34 * W, 0.14, 0.22]);
    if (o.cinto && !o.sinCinto) M(cu, 'cil', o.cinto, [0, T * 0.18, 0], [0.235 * W * P, 0.06, 0.19 * P]);
  }
  // Brazos (pivote en el hombro). D = derecho (en -x), I = izquierdo (en +x).
  const hy = T * 0.84, hx = (o.huesos ? 0.2 : 0.25) * W * Math.sqrt(P) + 0.05;
  for (const lado of [1, -1]) {
    const b = piv(r, G(cu, [hx * lado, hy, 0], [0, 0, 0.12 * lado]));
    M(b, 'cilT', o.mangas ?? mRopa, [0, 0, 0], [gr * 0.8, Ab, gr * 0.8]);
    M(b, 'esfera', o.manos ?? piel, [0, -Ab - 0.02, 0], (o.huesos ? 0.06 : 0.085) * (o.manoG ?? 1));
    const mano = G(b, [0, -Ab - 0.02, 0]);
    if (lado > 0) { r.bI = b; r.manoI = mano; } else { r.bD = b; r.manoD = mano; }
  }
  // Cabeza
  const cb = r.cabeza = piv(r, G(cu, [0, T + 0.01, 0], [-(o.encorvado || 0) * 0.8, 0, 0]));
  r.H = H;
  const tipo = o.cabeza || 'goblin';
  if (tipo === 'calavera') {
    M(cb, 'esfera', piel, [0, 0.24 * H, 0], [0.24 * H, 0.24 * H, 0.25 * H]);
    M(cb, 'caja', piel, [0, 0.07 * H, 0.07 * H], [0.18 * H, 0.08 * H, 0.16 * H]);            // mandibula
    const ojo = mat(o.ojos || '#7df9ff', { e: 1 });
    for (const x of [-1, 1]) M(cb, 'esferaB', ojo, [x * 0.08 * H, 0.25 * H, 0.2 * H], [0.05 * H, 0.05 * H, 0.03 * H]);
    r.topeCabeza = 0.48 * H;
    return r;
  }
  M(cb, 'esfera', piel, [0, 0.26 * H, 0], [0.3 * H, 0.28 * H, 0.28 * H]);
  if (o.orejas) for (const x of [-1, 1]) M(cb, 'cono', piel, [x * 0.24 * H, 0.3 * H, -0.03 * H], [0.075 * H, o.orejas * H, 0.045 * H], [0, -x * 0.25, -x * 1.2]);
  if (o.nariz === 'bola') M(cb, 'esfera', osc(piel, 0.92), [0, 0.21 * H, 0.27 * H], [0.08 * H, 0.07 * H, 0.09 * H]);
  else if (o.nariz === 'pico') M(cb, 'cono', piel, [0, 0.22 * H, 0.23 * H], [0.06 * H, 0.22 * H, 0.06 * H], [PI / 2 + 0.25, 0, 0]);
  if (o.ojos === 'duende') {
    for (const x of [-1, 1]) {
      M(cb, 'esfera', '#ffffff', [x * 0.1 * H, 0.3 * H, 0.245 * H], [0.07 * H, 0.075 * H, 0.04 * H]);
      M(cb, 'esferaB', '#1b1430', [x * 0.1 * H, 0.3 * H, 0.283 * H], [0.042 * H, 0.05 * H, 0.02 * H]);
    }
  } else if (o.ojos) {
    const ojo = mat(o.ojos, { e: 1 });
    for (const x of [-1, 1]) M(cb, 'esferaB', ojo, [x * 0.1 * H, 0.31 * H, 0.25 * H], [0.06 * H, 0.045 * H, 0.03 * H]);
  }
  if (o.colmillos) for (const x of [-1, 1]) M(cb, 'cono', '#f4efd8', [x * 0.07 * H, 0.1 * H, 0.22 * H], [0.025 * H, 0.08 * H, 0.025 * H]);
  r.topeCabeza = 0.54 * H;
  return r;
}

// ── ACCESORIOS DE CABEZA (todos fuera de la medida de altura) ──
const ACC = {
  casco(r, c, cuernos) {
    r.tocado = true;
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'semi', c, [0, 0.27 * H, 0], [0.32 * H, 0.3 * H, 0.31 * H]);
    if (cuernos) for (const x of [-1, 1]) M(g, 'cono', cuernos, [x * 0.25 * H, 0.42 * H, 0], [0.05 * H, 0.26 * H, 0.05 * H], [0, 0, -x * 0.75]);
    return g;
  },
  sombrero(r, c, alto = 0.75) {
    r.tocado = true;
    const H = r.H, g = fuera(G(r.cabeza, [0, 0.44 * H, 0], [-0.15, 0, 0]));
    M(g, 'cil', c, [0, 0, 0], [0.42 * H, 0.025 * H, 0.42 * H]);
    M(g, 'cono', c, [0, 0, 0], [0.26 * H, alto * H, 0.26 * H], [-0.12, 0, 0]);
    return g;
  },
  paja(r, c = '#e3c86b') {
    r.tocado = true;
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'cono', c, [0, 0.42 * H, 0], [0.55 * H, 0.24 * H, 0.55 * H]);
    return g;
  },
  gorra(r, c) {
    r.tocado = true;
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'semi', c, [0, 0.33 * H, -0.01 * H], [0.31 * H, 0.24 * H, 0.31 * H]);
    M(g, 'caja', osc(c, 0.75), [0, 0.35 * H, 0.3 * H], [0.24 * H, 0.025 * H, 0.14 * H]);
    return g;
  },
  capucha(r, c) {
    r.tocado = true;
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'semi', c, [0, 0.2 * H, -0.07 * H], [0.35 * H, 0.38 * H, 0.32 * H]);
    M(g, 'cono', c, [0, 0.45 * H, -0.24 * H], [0.11 * H, 0.3 * H, 0.11 * H], [-1.25, 0, 0]);
    return g;
  },
  mascara(r, c = '#1c1a26') {
    const H = r.H;
    return M(fuera(G(r.cabeza)), 'caja', c, [0, 0.11 * H, 0.16 * H], [0.38 * H, 0.1 * H, 0.24 * H]);
  },
  halo(r, c = '#ffe27a') {
    const H = r.H, g = piv(r, fuera(G(r.cabeza, [0, 0.8 * H, -0.05 * H], [0.25, 0, 0])));
    const me = M(g, 'toro', mat(c, { e: 1 }), [0, 0, 0], [0.22 * H, 0.22 * H, 0.22 * H]);
    me.userData.sinFlash = true;
    r.giran.push([g, 1.2]);
    return g;
  },
  corona(r, c = '#ffd84a', esc = 1) {
    // Con casco o sombrero la corona rodea el tocado (algo mas grande).
    esc *= r.coronaEsc || (r.tocado ? 1.15 : 1);
    const H = r.H * esc, g = fuera(G(r.cabeza, [0, (r.topeCabeza || 0.5 * r.H) - (r.tocado ? 0.02 : 0.09) * r.H, 0]));
    M(g, 'corona', mat(c, { e: 0.35, ds: true }), [0, 0, 0], [0.2 * H, 0.16 * H, 0.2 * H]);
    r.conCorona = true;
    return g;
  },
  romano(r, c, cresta = '#c0262d') {
    const g = ACC.casco(r, c), H = r.H;
    M(g, 'caja', cresta, [0, 0.6 * H, -0.02 * H], [0.05 * H, 0.14 * H, 0.42 * H]);
    return g;
  },
  yelmo(r, c, pluma = '#d22b2b') {
    const g = ACC.casco(r, c), H = r.H;
    M(g, 'caja', osc(c, 0.6), [0, 0.3 * H, 0.24 * H], [0.36 * H, 0.05 * H, 0.08 * H]);             // visera
    M(g, 'cono', pluma, [0, 0.5 * H, -0.05 * H], [0.06 * H, 0.32 * H, 0.06 * H], [-0.5, 0, 0]);
    return g;
  },
  kabuto(r, c, oro = '#e8b923') {
    const g = ACC.casco(r, c), H = r.H;
    for (const x of [-1, 1]) M(g, 'cono', oro, [x * 0.06 * H, 0.45 * H, 0.24 * H], [0.03 * H, 0.26 * H, 0.03 * H], [0.2, 0, -x * 0.55]);
    M(g, 'tronco', c, [0, 0.12 * H, -0.02 * H], [0.34 * H, 0.16 * H, 0.32 * H]);                  // cubrenuca
    return g;
  },
  barba(r, c = '#eeeeee') {
    const H = r.H;
    M(r.cabeza, 'cono', c, [0, 0.15 * H, 0.2 * H], [0.15 * H, 0.42 * H, 0.09 * H], [PI + 0.15, 0, 0]);
  },
};
// Hombreras (opcionalmente con pua).
function hombreras(r, c, pua) {
  for (const b of [r.bI, r.bD]) {
    M(b, 'semi', c, [0, -0.02, 0], [0.14, 0.11, 0.14]);
    if (pua) M(b, 'cono4', pua, [0, 0.06, 0], [0.05, 0.2, 0.05]);
  }
}
// Capa a la espalda.
function capa(r, c, T = 0.5, L = 0.5) {
  const alto = T * 0.85 + L * 0.75;
  M(r.cuerpo, 'caja', c, [0, T * 0.85 - alto / 2, -0.24], [0.44, alto, 0.03], [0.12, 0, 0]);
}

// ── ARMAS (en la mano; la hoja apunta a +z, inclinada hacia arriba) ──
function grupoArma(mano, inclina = -0.55) { return fuera(G(mano, [0, 0, 0.02], [inclina, 0, 0])); }
function espada(mano, o = {}) {
  const g = grupoArma(mano), L = o.largo ?? 0.75;
  M(g, 'caja', o.mango ?? '#3b2a1e', [0, 0, -0.05], [0.04, 0.04, 0.2]);
  M(g, 'caja', o.guarda ?? '#c9a227', [0, 0, 0.07], [o.daga ? 0.1 : 0.15, 0.05, 0.035]);
  const hoja = M(g, 'caja', o.hoja ?? '#d7dde4', [0, 0, 0.09 + L / 2], [0.025, o.ancho ?? 0.07, L], null, o.e ? { e: o.e } : null);
  if (o.e) hoja.userData.sinFlash = true;
  return g;
}
function garrote(mano, c = '#6b4a2b') {
  const g = grupoArma(mano);
  M(g, 'tronco', c, [0, 0, 0.65], [0.1, 0.65, 0.1], [-PI / 2, 0, 0]);
  return g;
}
function hacha(mano, c = '#9aa3ad', mango = '#5a3d22', grande = 1) {
  const g = grupoArma(mano, -0.7);
  M(g, 'cil', mango, [0, 0, 0.35 * grande], [0.03, 0.9 * grande, 0.03], [PI / 2, 0, 0]);
  M(g, 'caja', c, [0, 0.13 * grande, 0.68 * grande], [0.03, 0.3 * grande, 0.24 * grande]);
  M(g, 'caja', c, [0, -0.1 * grande, 0.68 * grande], [0.03, 0.2 * grande, 0.16 * grande]);
  return g;
}
function maza(mano, c = '#c9a227') {
  const g = grupoArma(mano);
  M(g, 'cil', '#4a3420', [0, 0, 0.25], [0.03, 0.55, 0.03], [PI / 2, 0, 0]);
  M(g, 'icos', c, [0, 0, 0.58], 0.13);
  return g;
}
function lanzaA(mano, c = '#c0c6cc') {
  const g = grupoArma(mano, -1.35);
  M(g, 'cil', '#6b4a2b', [0, 0, 0.35], [0.025, 1.7, 0.025], [PI / 2, 0, 0]);
  M(g, 'cono4', c, [0, 0, 1.18], [0.05, 0.24, 0.03], [PI / 2, 0, 0]);
  return g;
}
function horca(mano) {
  const g = grupoArma(mano, -1.3);
  M(g, 'cil', '#8a6438', [0, 0, 0.3], [0.025, 1.4, 0.025], [PI / 2, 0, 0]);
  M(g, 'caja', '#8d949b', [0, 0, 1.0], [0.24, 0.03, 0.03]);
  for (const x of [-0.1, 0, 0.1]) M(g, 'cono', '#8d949b', [x, 0, 1.0], [0.015, 0.22, 0.015], [PI / 2, 0, 0]);
  return g;
}
function guadana(mano, c = '#b9c2cc') {
  const g = grupoArma(mano, -1.25);
  M(g, 'cil', '#3a2c22', [0, 0, 0.3], [0.025, 1.5, 0.025], [PI / 2, 0, 0]);
  M(g, 'caja', c, [0, -0.25, 1.02], [0.02, 0.5, 0.07], [0.35, 0, 0]);
  return g;
}
// Baston de mago: vara vertical con punta brillante (pulsa al lanzar).
function baston(r, mano, c = '#7dd3fc', madera = '#6b4a2b') {
  const g = fuera(G(mano, [0, 0, 0.02], [0.12, 0, 0]));
  M(g, 'cil', madera, [0, 0.3, 0], [0.03, 1.4, 0.03]);
  const p = piv(r, G(g, [0, 1.07, 0]));
  const tip = M(p, 'icos', mat(c, { e: 1 }), [0, 0, 0], 0.09);
  tip.userData.sinFlash = true;
  r.brillo.push(p);
  return g;
}
function escudo(mano, c, forma = 'redondo', borde = '#c9a227') {
  const g = fuera(G(mano, [0.09, 0.05, 0.04]));
  if (forma === 'rect') M(g, 'caja', c, [0, 0, 0], [0.04, 0.5, 0.32]);
  else M(g, 'cil', c, [0, 0, 0], [0.25, 0.04, 0.25], [0, 0, PI / 2]);
  if (borde) M(g, 'esferaB', borde, [0.03, 0, 0], 0.06);
  return g;
}
// Aura en el suelo (jefes y skins premium).
function auraSuelo(r, c, radio = 0.6) {
  const me = piv(r, M(r.raiz, 'anillo', mat(c, { aura: true, op: 0.55 }), [0, 0.03, 0], radio));
  me.userData.sinFlash = true;
  fuera(me);
  r.aura = me;
  r.giran.push([me, 0.8]);
  return me;
}

// ═══════════ EL DUENDE (jugador) ═══════════
const PIEL_DUENDE = '#6cc644';
export function crearDuende({ skin = 'comun', clase = null, arma = 'katana' } = {}) {
  const sk = SKINS[skin] || SKINS.comun;
  const cl = clase && CLASES[clase] ? clase : null;
  const ropa = !SKINS[skin] || skin === 'comun' ? '#8b5a2b' : sk.color;     // comun = cuero marron
  const brilla = !!(sk.premium || skin === 'legendaria');
  const r = nuevoRig('bipedo');
  humano(r, {
    piel: PIEL_DUENDE, ropa, ropaMat: mat(ropa, brilla ? { e: 0.35 } : null),
    pantalon: osc(ropa, 0.55), botas: '#4a2e18', cinto: '#3a2412',
    cabeza: 'duende', ojos: 'duende', nariz: 'bola', orejas: 0.42, cab: 1.18, L: 0.45, T: 0.46, A: 0.38,
  });
  const cc = cl ? CLASES[cl].color : ropa;
  if (cl === 'guerrero') { ACC.casco(r, '#9aa3ad', '#efe6cf'); escudo(r.manoI, '#7a4a26', 'redondo', null); }
  else if (cl === 'mago') ACC.sombrero(r, osc(cc, 0.75), 0.8);
  else if (cl === 'sacerdote') { ACC.capucha(r, '#f2efe6'); ACC.halo(r); }
  else if (cl === 'picaro') { ACC.capucha(r, '#3d3550'); ACC.mascara(r); }
  else ACC.gorra(r, ropa);
  // Arma: los de vara (mago, sacerdote) llevan baston.
  if (cl && CLASES[cl].basico === 'vara') baston(r, r.manoD, cl === 'sacerdote' ? '#fff3b0' : cc);
  else if (arma === 'dagas') {
    espada(r.manoD, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color });
    espada(r.manoI, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color });
    r.dosArmas = true;
  } else if (arma === 'odachi') espada(r.manoD, { largo: 1.25, hoja: '#ffffff', guarda: '#2b2b2b' });
  else if (arma === 'chispa') espada(r.manoD, { largo: 0.8, hoja: ARMAS.chispa.color, e: 0.9, guarda: '#1e3a5f' });
  else espada(r.manoD, { largo: 0.75, guarda: ARMAS.katana.color });
  if (brilla) auraSuelo(r, sk.color, 0.55);
  const m = new Modelo(r, 1.75);
  m.tipo = 'duende';
  return m;
}

// ═══════════ ARQUETIPOS DE MONSTRUOS ═══════════
// c = { k, color (tinte o null), jefe, e (brillo emisivo), amigo (NPC) }
// mc(c, defecto): material del color principal (tinte si lo hay).
const mc = (c, def, extra) => mat(c.color || def, c.e || extra ? { e: Math.max(c.e || 0, extra || 0) } : null);
const principal = (c, def) => c.color || def;

// ── GOBLINS ──
const GOB = {
  goblin_normal:     { piel: '#7da543', ropa: '#8a6a3a', torsoPiel: true },
  goblin_samurai:    { piel: '#6f9a3c', ropa: '#b3262b', armadura: true },
  goblin_mage:       { piel: '#5f8f4a', ropa: '#6b3fa0', tunica: true },
  goblin_peasant:    { piel: '#86ad4c', ropa: '#b08a55', pantalon: '#6b4f2a' },
  goblin_assassin:   { piel: '#557a3a', ropa: '#2b2b38' },
  goblin_guard:      { piel: '#6c9a40', ropa: '#3b6fb6' },
  goblin_knight:     { piel: '#6c9a40', ropa: '#9aa3ad', armadura: true },
  goblin_lord:       { piel: '#78a046', ropa: '#d4a72c', panza: 1.3 },
  goblin_centurion:  { piel: '#6f9a3c', ropa: '#b8862e', armadura: true },
  goblin_battlelord: { piel: '#5d8a34', ropa: '#4a4f57', ancho: 1.15, armadura: true },
};
function goblin(c, v) {
  const d = GOB[v] || GOB.goblin_normal, r = nuevoRig('bipedo');
  const ropa = principal(c, d.ropa), mr = mc(c, d.ropa);
  const oscuro = osc(ropa, 0.5);
  humano(r, {
    piel: d.piel, ropa, ropaMat: d.torsoPiel ? mat(d.piel) : mr,
    pantalon: d.torsoPiel ? mr : d.pantalon ?? oscuro, botas: '#3a2a1c', cinto: '#3a2412',
    mangas: d.torsoPiel ? mat(d.piel) : undefined,
    cabeza: 'goblin', ojos: c.amigo ? 'duende' : v === 'goblin_assassin' ? '#ffe14a' : '#ff3b2f',
    nariz: 'pico', orejas: 0.34, colmillos: !c.amigo, cab: 1.05, L: 0.42, T: 0.48, A: 0.4,
    panza: d.panza, ancho: d.ancho, sinCinto: !!d.armadura, tunica: d.tunica ? ropa : null, tunicaMat: d.tunica ? mr : null,
  });
  switch (v) {
    case 'goblin_normal': garrote(r.manoD); break;
    case 'goblin_samurai': ACC.kabuto(r, osc(ropa, 0.6)); hombreras(r, '#2b2b2b'); espada(r.manoD, { largo: 0.75, guarda: '#e8b923' }); break;
    case 'goblin_mage': ACC.sombrero(r, osc(ropa, 0.8), 0.7); baston(r, r.manoD, '#c084fc'); break;
    case 'goblin_peasant': ACC.paja(r); if (!c.amigo) horca(r.manoD); break;
    case 'goblin_assassin': ACC.capucha(r, '#1f1d29'); ACC.mascara(r, '#3a1418'); espada(r.manoD, { largo: 0.32, daga: true }); espada(r.manoI, { largo: 0.32, daga: true }); r.dosArmas = true; r.paso = 11; break;
    case 'goblin_guard': ACC.casco(r, '#8d949b'); lanzaA(r.manoD); escudo(r.manoI, ropa, 'redondo', '#d7dde4'); break;
    case 'goblin_knight': ACC.yelmo(r, '#aab3bd'); hombreras(r, '#aab3bd'); espada(r.manoD, { largo: 0.85 }); escudo(r.manoI, osc(ropa, 0.8), 'rect', '#c9a227'); break;
    case 'goblin_lord': ACC.corona(r); capa(r, '#a01d2a', 0.48, 0.42); maza(r.manoD); hombreras(r, '#c9a227'); break;
    case 'goblin_centurion': ACC.romano(r, '#c69a3e'); capa(r, '#a51f26', 0.48, 0.42); espada(r.manoD, { largo: 0.5, ancho: 0.09 }); escudo(r.manoI, '#a51f26', 'rect', '#e8b923'); break;
    case 'goblin_battlelord': ACC.casco(r, '#3c4047', '#e9e0c8'); hombreras(r, '#3c4047', '#d9d2c0'); hacha(r.manoD, '#b9c2cc', '#4a3420', 1.3); r.tAtk = 0.45; break;
  }
  return r;
}

// ── ESQUELETOS ──
function esqueleto(c, conCapa) {
  const r = nuevoRig('bipedo'), hueso = principal(c, '#e8e2cf');
  const ojos = c.color && !conCapa ? mez(c.color, '#ffffff', 0.3) : '#7df9ff';
  if (conCapa) {
    const capaC = principal(c, '#3b3550');
    humano(r, { piel: '#e8e2cf', huesos: true, cabeza: 'calavera', ojos, tunica: capaC, tunicaMat: mc(c, '#3b3550'), L: 0.5, T: 0.5, A: 0.42, ropa: capaC });
    ACC.capucha(r, osc(capaC, 0.8));
    guadana(r.manoD);
    if (c.jefe) baston(r, r.manoI, ojos);
  } else {
    humano(r, { piel: c.color ? mat(hueso, { e: c.e }) : hueso, huesos: true, cabeza: 'calavera', ojos, L: 0.52, T: 0.5, A: 0.42, botas: hueso });
    espada(r.manoD, { largo: 0.7, hoja: '#9a8f7a', guarda: '#5b4a35' });
    escudo(r.manoI, '#6b4a2b', 'redondo', '#8a8178');
  }
  r.paso = 8;
  return r;
}

// ── FANTASMAS (flotan, sin piernas) ──
function fantasma(c, v) {
  const r = nuevoRig('flota'), R = r.raiz;
  r.caer = 'encoge';
  const base = v === 'espectro' ? '#2dd4bf' : v === 'fantasma_halo' ? '#bfe3ff' : '#eef6ff';
  const cuerpoC = principal(c, base);
  const m = mat(cuerpoC, { op: v === 'espectro' ? 0.82 : 0.78, e: v === 'fantasma' ? 0.15 : 0.35 });
  const cu = r.cuerpo = piv(r, G(R, [0, 0.62, 0]));
  M(cu, 'esfera', m, [0, 0.38, 0], [0.4, 0.46, 0.38]);
  const cola = r.cola = piv(r, G(cu, [0, 0.2, 0]));
  M(cola, 'cono', m, [0, 0, -0.03], [0.37, v === 'espectro' ? 0.82 : 0.66, 0.35], [PI + 0.15, 0, 0]);
  for (const lado of [1, -1]) {
    const b = piv(r, G(cu, [0.36 * lado, 0.42, 0], [0, 0, 0.5 * lado]));
    M(b, 'cono', m, [0, 0, 0], [0.09, 0.32, 0.09], [PI, 0, 0]);
    if (lado > 0) r.bI = b; else r.bD = b;
  }
  const ojo = v === 'espectro' ? mat('#e0fffb', { e: 1 }) : mat('#1b1430');
  for (const x of [-1, 1]) M(cu, 'esferaB', ojo, [x * 0.13, 0.48, 0.33], [0.07, 0.1, 0.04]);
  if (v !== 'espectro') M(cu, 'esferaB', '#1b1430', [0, 0.3, 0.36], [0.07, 0.06, 0.03]);       // boca "oh"
  const cb = r.cabeza = piv(r, G(cu, [0, 0.38, 0]));
  r.H = 0.9; r.topeCabeza = 0.46;
  if (v === 'espectro') { const g = fuera(G(cu)); M(g, 'semi', osc(cuerpoC, 0.55), [0, 0.42, -0.06], [0.45, 0.48, 0.42]); M(g, 'cono', osc(cuerpoC, 0.55), [0, 0.86, -0.2], [0.12, 0.3, 0.12], [-1.1, 0, 0]); }
  if (v === 'fantasma_halo') ACC.halo(r, '#ffe27a');
  return r;
}

// ── HECHICERO (mago con tunica, barba y gran sombrero) ──
function hechicero(c) {
  const r = nuevoRig('bipedo'), tun = principal(c, c.amigo ? '#2f5fb3' : '#3a2a7a');
  humano(r, {
    piel: '#e6c3a0', ropa: tun, ropaMat: mc(c, tun), tunica: tun, tunicaMat: mc(c, tun),
    cabeza: 'goblin', ojos: c.amigo ? 'duende' : '#ffd84a', nariz: 'pico', orejas: 0.18, cab: 1, L: 0.55, T: 0.55, A: 0.45,
  });
  ACC.barba(r, c.amigo ? '#f2f2f2' : '#cfcfcf');
  ACC.sombrero(r, osc(tun, 0.75), 0.95);
  baston(r, r.manoD, c.color ? mez(c.color, '#ffffff', 0.3) : '#a78bfa');
  r.paso = 7;
  return r;
}

// ── GHOUL ARDIENTE (encorvado y en llamas) ──
function ghoul(c) {
  const r = nuevoRig('bipedo'), piel = '#5a2a22', fuego = principal(c, '#ff7a1a');
  humano(r, {
    piel, ropa: piel, ropaMat: mat(piel, c.e ? { e: c.e } : null), pantalon: '#2b1410', botas: '#1c0e0b',
    cabeza: 'goblin', ojos: '#ffb020', nariz: null, orejas: 0.12, colmillos: true, cab: 0.9,
    L: 0.5, T: 0.55, A: 0.62, ancho: 1.15, encorvado: 0.4, manoG: 1.4,
  });
  const fm = mat(fuego, { e: 1, op: 0.9 });
  const sitios = [[r.cabeza, [0, 0.5, -0.02], 0.13, 0.4], [r.bI, [0, 0.05, 0], 0.1, 0.3], [r.bD, [0, 0.05, 0], 0.1, 0.3], [r.cuerpo, [0, 0.5, -0.2], 0.14, 0.35]];
  for (const [padre, p, ra, h] of sitios) {
    const g = piv(r, fuera(G(padre, p)));
    M(g, 'cono', fm, [0, 0, 0], [ra, h, ra]).userData.sinFlash = true;
    r.flamas.push(g);
  }
  r.paso = 10;
  return r;
}

// ── COLOSO (gigante de hueso y piedra) ──
function coloso(c) {
  const r = nuevoRig('bipedo'), piedra = principal(c, '#b8b2a0');
  const mp = mc(c, '#b8b2a0');
  humano(r, {
    piel: piedra, ropa: piedra, ropaMat: mp, pantalon: mat(osc(piedra, 0.7)), botas: osc(piedra, 0.5), mangas: mp, manos: osc(piedra, 0.8),
    cabeza: 'calavera', ojos: '#ff5a2a', cab: 0.75, L: 0.6, T: 0.75, A: 0.7, ancho: 1.6, grueso: 1.9, manoG: 1.9,
  });
  hombreras(r, osc(piedra, 0.75), '#e9e0c8');
  for (let i = 0; i < 3; i++) M(r.cuerpo, 'cono4', '#e9e0c8', [(i - 1) * 0.18, 0.62, -0.22], [0.06, 0.28, 0.06], [-0.6, 0, 0]);
  r.paso = 5; r.tAtk = 0.5; r.hundir = 0.35;
  return r;
}

// ── ANGEL (alas de plumas, halo y espada) ──
function angel(c) {
  const r = nuevoRig('bipedo'), tun = principal(c, '#3b2f4f');
  humano(r, {
    piel: '#e9cdb6', ropa: tun, ropaMat: mc(c, tun), tunica: tun, tunicaMat: mc(c, tun), botas: '#d9c37a',
    cabeza: 'goblin', ojos: '#ff4b4b', nariz: null, orejas: 0.1, cab: 0.95, L: 0.6, T: 0.55, A: 0.45,
  });
  const alaC = c.color ? '#f7f3e8' : '#2a2238';
  const mA = mat(alaC, { ds: true, e: c.color ? 0.2 : 0 });
  for (const lado of [1, -1]) {
    const p = piv(r, fuera(G(r.cuerpo, [0.08 * lado, 0.42, -0.2], [0, lado * 0.35, 0])));
    M(p, 'pluma', mA, [0, 0, 0], [1.25 * lado, 1, 0.75], [-1.2, 0, lado * 0.5]);
    if (lado > 0) r.alaP = p; else r.alaN = p;
  }
  r.aleteo = 3; r.amplAla = 0.35; r.vuela = true;
  ACC.halo(r, c.color ? '#ffe27a' : '#ff5a5a');
  espada(r.manoD, { largo: 0.95, hoja: c.color ? '#fff3b0' : '#ff8a8a', e: 0.6 });
  return r;
}

// ── COSA DEL PANTANO (encorvada, musgo colgando) ──
function cosa(c) {
  const r = nuevoRig('bipedo'), verde = principal(c, '#4f6b2f');
  humano(r, {
    piel: verde, ropa: verde, ropaMat: mc(c, verde), pantalon: osc(verde, 0.75), botas: osc(verde, 0.5),
    cabeza: 'goblin', ojos: '#e8ff5a', nariz: null, orejas: 0, cab: 0.95, L: 0.45, T: 0.55, A: 0.6, ancho: 1.3, encorvado: 0.35, manoG: 1.3,
  });
  const musgo = osc(verde, 0.65);
  M(r.cabeza, 'cono', musgo, [0, 0.42, 0.05], [0.28, 0.35, 0.28], [PI, 0, 0]);
  for (const b of [r.bI, r.bD]) M(b, 'cono', musgo, [0, -0.05, 0], [0.11, 0.35, 0.11], [PI, 0, 0]);
  r.paso = 6;
  return r;
}

// ── PIEZAS DE ANIMALES ──
// Dos ojos (brillantes si se pide color con brillo).
function ojos(padre, color, x, y, z, ra, brillo = true) {
  const m = mat(color, brillo ? { e: 1 } : null);
  for (const s of [-1, 1]) M(padre, 'esferaB', m, [s * x, y, z], [ra, ra * 1.1, ra * 0.7]);
}
// Pata colgando de un pivote (cuadrupedos). del = pata delantera.
function pata(r, padre, pos, largo, grosor, m, pie, ph, del, abre = 0) {
  const p = piv(r, G(padre, pos, [0, 0, abre]));
  M(p, 'cilT', m, [0, 0, 0], [grosor, largo, grosor]);
  if (pie) M(p, 'esferaB', pie, [0, -largo, 0.03], [grosor * 1.3, grosor * 0.8, grosor * 1.7]);
  r.patas.push([p, ph, 'x', del]);
  return p;
}
// Cuatro patas al trote (diagonales en fase).
function cuatroPatas(r, x, y, zD, zT, largo, grosor, m, pie, abre = 0) {
  pata(r, r.raiz, [x, y, zD], largo, grosor, m, pie, 0, true, abre);
  pata(r, r.raiz, [-x, y, zD], largo, grosor, m, pie, PI, true, -abre);
  pata(r, r.raiz, [x, y, zT], largo, grosor, m, pie, PI, false, abre);
  pata(r, r.raiz, [-x, y, zT], largo, grosor, m, pie, 0, false, -abre);
}
// Silla de montar: marca el punto donde se sienta el jinete.
function silla(r, padre, pos, ancho = 0.3, c = '#7a4a26') {
  M(padre, 'caja', '#2f5fb3', [pos[0], pos[1] - 0.01, pos[2]], [ancho * 2.2, 0.04, ancho * 1.6]);
  M(padre, 'caja', c, [pos[0], pos[1] + 0.04, pos[2]], [ancho * 1.4, 0.08, ancho * 1.3]);
  r.marcaSilla = G(padre, [pos[0], pos[1] + 0.08, pos[2]]);
}
// Pua de jefe en el lomo.
function puas(padre, c, pts, esc = 1) {
  for (const [x, y, z] of pts) M(padre, 'cono4', c, [x, y, z], [0.06 * esc, 0.22 * esc, 0.08 * esc], [-0.45, 0, 0]);
}

// ── HONGO (camina bamboleandose) ──
function hongo(c) {
  const r = nuevoRig('bipedo'), R = r.raiz, sombrero = principal(c, '#d33a2c');
  r.bamboleo = true; r.paso = 8; r.caer = 'lado';
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.1 * s, 0.16, 0]));
    M(p, 'cilT', '#efe2c4', [0, 0, 0], [0.06, 0.1, 0.06]);
    M(p, 'esferaB', '#8a6a4a', [0, -0.12, 0.03], [0.08, 0.05, 0.1]);
    if (s > 0) r.pI = p; else r.pD = p;
  }
  const cu = r.cuerpo = piv(r, G(R, [0, 0.16, 0]));
  M(cu, 'tronco', '#f1e6cf', [0, 0, 0], [0.2, 0.42, 0.2]);
  ojos(cu, '#1b1430', 0.07, 0.26, 0.15, 0.04, false);
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [0.17 * s, 0.2, 0], [0, 0, 0.5 * s]));
    M(b, 'cilT', '#f1e6cf', [0, 0, 0], [0.04, 0.15, 0.04]);
    if (s > 0) r.bI = b; else r.bD = b;
  }
  const cb = r.cabeza = piv(r, G(cu, [0, 0.36, 0]));
  M(cb, 'semi', mc(c, sombrero), [0, 0, 0], [0.48, 0.34, 0.48]);
  M(cb, 'cil', '#e8d9b5', [0, 0.01, 0], [0.46, 0.03, 0.46]);
  for (const p of [[0, 0.33, 0], [0.28, 0.25, 0.14], [-0.24, 0.25, 0.2], [0.05, 0.25, -0.31]]) M(cb, 'esferaB', '#fff7e6', p, [0.08, 0.04, 0.08]);
  r.H = 1; r.topeCabeza = 0.34;
  return r;
}

// ── BABA (cupula de gelatina que se aplasta) ──
function baba(c) {
  const r = nuevoRig('baba'), R = r.raiz, color = principal(c, '#6366f1');
  r.caer = 'nada'; r.hundir = 0.05;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'semi', mat(color, { op: 0.82, e: 0.2 + (c.e || 0) }), [0, 0, 0], [0.55, 0.72, 0.55]);
  M(cu, 'esfera', osc(color, 0.55), [0, 0.26, -0.05], 0.17);
  for (const s of [-1, 1]) {
    M(cu, 'esfera', '#ffffff', [s * 0.16, 0.47, 0.38], 0.085);
    M(cu, 'esferaB', '#1b1430', [s * 0.16, 0.47, 0.455], [0.045, 0.05, 0.02]);
  }
  M(cu, 'esferaB', '#1b1430', [0, 0.3, 0.49], [0.1, 0.04, 0.03]);
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.72;
  return r;
}

// ── RANA / SAPO ──
function rana(c) {
  const r = nuevoRig('salto'), R = r.raiz, verde = principal(c, '#4caf50'), m = mc(c, verde);
  r.paso = 9; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.32, 0], [0.42, 0.27, 0.48]);
  M(cu, 'esfera', mez(verde, '#fff2c4', 0.6), [0, 0.24, 0.08], [0.36, 0.2, 0.4]);
  M(cu, 'esfera', m, [0, 0.42, 0.28], [0.34, 0.2, 0.28]);
  for (const s of [-1, 1]) {
    M(cu, 'esfera', m, [s * 0.17, 0.58, 0.3], 0.11);
    M(cu, 'esferaB', '#1b1430', [s * 0.17, 0.6, 0.4], [0.06, 0.07, 0.03]);
  }
  const lg = r.lengua = piv(r, G(cu, [0, 0.36, 0.5]));
  M(lg, 'cilT', '#ff6b9a', [0, 0, 0], [0.03, 0.08, 0.015], [-PI / 2, 0, 0]);
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.28 * s, 0.24, -0.18]));
    M(p, 'esfera', m, [0, 0, 0], [0.13, 0.1, 0.24]);
    M(p, 'caja', osc(verde, 0.8), [0, -0.2, 0.12], [0.15, 0.04, 0.3]);
    const b = piv(r, G(R, [0.2 * s, 0.28, 0.28], [0.2, 0, 0]));
    M(b, 'cilT', m, [0, 0, 0], [0.05, 0.25, 0.05]);
    M(b, 'esferaB', osc(verde, 0.8), [0, -0.26, 0.04], [0.07, 0.03, 0.09]);
    if (s > 0) { r.pI = p; r.bI = b; } else { r.pD = p; r.bD = b; }
  }
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.7;
  if (c.montura) silla(r, cu, [0, 0.58, -0.05], 0.26);
  return r;
}

// ── CONEJO ──
function conejo(c) {
  const r = nuevoRig('salto'), R = r.raiz, pelo = principal(c, '#b08968'), m = mc(c, pelo);
  r.paso = 10; r.caer = 'lado'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.38, -0.05], [0.3, 0.3, 0.42]);
  M(cu, 'esfera', '#ffffff', [0, 0.42, -0.46], 0.1);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.62, 0.28]));
  M(cb, 'esfera', m, [0, 0, 0], [0.21, 0.2, 0.23]);
  for (const s of [-1, 1]) M(cb, 'esfera', m, [s * 0.08, 0.32, -0.02], [0.06, 0.3, 0.035], [-0.15, 0, -s * 0.15]);
  ojos(cb, c.amigo || c.montura ? '#1b1430' : '#ff3b2f', 0.13, 0.05, 0.15, 0.04, !(c.amigo || c.montura));
  M(cb, 'esferaB', '#ff9fb2', [0, -0.02, 0.23], 0.035);
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.2 * s, 0.22, -0.15]));
    M(p, 'esfera', m, [0, 0, 0], [0.1, 0.16, 0.2]);
    M(p, 'caja', osc(pelo, 0.85), [0, -0.19, 0.06], [0.1, 0.06, 0.34]);
    const b = piv(r, G(R, [0.12 * s, 0.3, 0.22]));
    M(b, 'cilT', m, [0, 0, 0], [0.045, 0.28, 0.045]);
    if (s > 0) { r.pI = p; r.bI = b; } else { r.pD = p; r.bD = b; }
  }
  r.H = 1; r.topeCabeza = 0.6;
  if (c.montura) silla(r, cu, [0, 0.67, -0.12], 0.24);
  return r;
}

// ── SALTARIN ABISAL (pez-sapo de las profundidades con farolillo) ──
function saltador(c) {
  const r = nuevoRig('salto'), R = r.raiz, piel = principal(c, '#273469'), m = mc(c, piel);
  r.paso = 9; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.5, 0], [0.4, 0.36, 0.4]);
  M(cu, 'esfera', mez(piel, '#9fb4ff', 0.35), [0, 0.38, 0.12], [0.3, 0.2, 0.3]);
  ojos(cu, '#e0fffb', 0.15, 0.62, 0.33, 0.05);
  const mj = r.mandibula = piv(r, G(cu, [0, 0.42, 0.28]));
  M(mj, 'caja', osc(piel, 0.6), [0, -0.02, 0.06], [0.34, 0.06, 0.16]);
  for (const s of [-1, 1]) M(mj, 'cono4', '#f4efd8', [s * 0.09, 0.01, 0.11], [0.025, 0.08, 0.025]);
  const farol = fuera(G(cu, [0, 0.82, 0.1]));
  M(farol, 'cil', osc(piel, 0.8), [0, 0.12, 0.1], [0.015, 0.3, 0.015], [0.7, 0, 0]);
  const p = piv(r, G(farol, [0, 0.22, 0.26]));
  M(p, 'icos', mat('#7dfcff', { e: 1 }), [0, 0, 0], 0.07).userData.sinFlash = true;
  r.brillo.push(p);
  for (const s of [1, -1]) {
    const pa = piv(r, G(R, [0.25 * s, 0.25, -0.1]));
    M(pa, 'esfera', m, [0, 0, 0], [0.12, 0.18, 0.2]);
    M(pa, 'caja', osc(piel, 0.8), [0, -0.2, 0.08], [0.14, 0.05, 0.3]);
    if (s > 0) r.pI = pa; else r.pD = pa;
  }
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.86;
  return r;
}

// ── SERPIENTE ──
function serpiente(c) {
  const largoMax = 2.0;
  const r = nuevoRig('serpiente'), R = r.raiz, piel = principal(c, '#4d8b31');
  r.caer = 'lado'; r.hundir = 0.3;
  const m1 = mc(c, piel), m2 = mat(mez(piel, '#e8d36a', 0.45));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ra = 0.15 * (1 - i * 0.09);
    r.segs.push(piv(r, M(R, 'esfera', i % 2 ? m2 : m1, [0, ra * 0.85, 0.1 - i * 0.22], [ra, ra * 0.85, ra * 1.3])));
  }
  r.segs.push(piv(r, M(R, 'cono', m1, [0, 0.05, 0.12 - n * 0.22], [0.05, 0.28, 0.05], [-PI / 2, 0, 0])));
  const cb = r.cabeza = piv(r, G(R, [0, 0.12, 0.2]));
  M(cb, 'esfera', m1, [0, 0.14, 0.02], [0.11, 0.2, 0.11], [0.3, 0, 0]);
  const h = G(cb, [0, 0.34, 0.1]);
  M(h, 'esfera', m1, [0, 0, 0.06], [0.14, 0.1, 0.2]);
  ojos(h, '#ffd84a', 0.08, 0.05, 0.16, 0.03);
  const mj = r.mandibula = piv(r, G(h, [0, -0.05, 0.02]));
  M(mj, 'caja', m2, [0, 0, 0.1], [0.12, 0.03, 0.18]);
  const lg = r.lengua = piv(r, G(h, [0, -0.03, 0.24]));
  M(lg, 'cilT', '#e0245e', [0, 0, 0], [0.012, 0.12, 0.006], [-PI / 2, 0, 0]);
  r.H = 0.6; r.topeCabeza = 0.15; r.largoMax = largoMax;
  return r;
}

// ── LAGARTO ──
function lagarto(c) {
  const largoMax = 2.0;
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#8fb04a'), m = mc(c, piel);
  const alza = c.montura ? 0.3 : 0;
  r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.32 + alza, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.28, 0.18, 0.6]);
  M(cu, 'esfera', mez(piel, '#f1e3b0', 0.5), [0, -0.06, 0.05], [0.22, 0.12, 0.5]);
  if (!c.montura) for (let i = 0; i < 3; i++) M(cu, 'cono4', osc(piel, 0.6), [0, 0.15, 0.25 - i * 0.25], [0.05, 0.14, 0.08], [-0.4, 0, 0]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.06, 0.55]));
  M(cb, 'esfera', m, [0, 0, 0.12], [0.17, 0.12, 0.24]);
  ojos(cb, '#ffd84a', 0.1, 0.06, 0.2, 0.035);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.06, 0.05]));
  M(mj, 'caja', osc(piel, 0.85), [0, -0.02, 0.15], [0.2, 0.05, 0.26]);
  const cola = r.cola = piv(r, G(cu, [0, 0, -0.55]));
  M(cola, 'cono', m, [0, 0, 0], [0.14, c.montura ? 0.6 : 0.85, 0.1], [-1.7, 0, 0]);
  cuatroPatas(r, 0.24, 0.32 + alza, 0.3, -0.3, 0.3 + alza, 0.055 + alza * 0.08, m, osc(piel, 0.7), alza ? 0.15 : 0.5);
  if (c.montura) silla(r, cu, [0, 0.17, -0.02], 0.26);
  r.lomo = cu; r.H = 0.6; r.largoMax = largoMax;
  return r;
}

// ── ZARIGUEYA ──
function zarigueya(c) {
  const largoMax = 2.0;
  const r = nuevoRig('cuadrupedo'), R = r.raiz, pelo = principal(c, '#8d8d8d'), m = mc(c, pelo);
  r.paso = 12; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.4;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.25, 0.22, 0.45]);
  M(cu, 'esfera', '#d8d3c8', [0, -0.07, 0.1], [0.18, 0.13, 0.3]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.08, 0.42]));
  M(cb, 'esfera', '#f1ede4', [0, 0, 0.05], [0.15, 0.14, 0.18]);
  M(cb, 'cono', '#f1ede4', [0, -0.02, 0.18], [0.07, 0.18, 0.07], [PI / 2, 0, 0]);
  M(cb, 'esferaB', '#ff9fb2', [0, -0.02, 0.37], 0.035);
  for (const s of [-1, 1]) M(cb, 'esfera', '#2b2b2b', [s * 0.1, 0.13, 0], [0.06, 0.07, 0.02]);
  ojos(cb, '#ff3b2f', 0.07, 0.05, 0.17, 0.028);
  const cola = r.cola = piv(r, G(cu, [0, 0, -0.42]));
  M(cola, 'cono', '#f2b8c6', [0, 0, 0], [0.045, 0.75, 0.045], [-1.75, 0, 0]);
  cuatroPatas(r, 0.17, 0.32, 0.25, -0.25, 0.3, 0.05, mat('#3b3b3b'), '#2b2b2b');
  r.lomo = cu; r.H = 0.6; r.largoMax = largoMax;
  return r;
}

// ── SABUESO INFERNAL ──
function hellhound(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#2a1414'), m = mc(c, piel);
  const fuego = mat('#ff6a1a', { e: 1 });
  r.paso = 9; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.25;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.82, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.3, 0.3, 0.66]);
  M(cu, 'esfera', m, [0, 0.06, 0.38], [0.32, 0.34, 0.34]);
  if (!c.montura) puas(cu, fuego, [[0, 0.32, 0.25], [0, 0.3, -0.05], [0, 0.26, -0.35]]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.25, 0.72]));
  M(cb, 'esfera', m, [0, 0, 0], [0.2, 0.19, 0.24]);
  M(cb, 'caja', m, [0, -0.04, 0.25], [0.15, 0.12, 0.22]);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.1, 0.12]));
  M(mj, 'caja', osc(piel, 0.7), [0, 0, 0.12], [0.14, 0.05, 0.25]);
  for (const s of [-1, 1]) M(cb, 'cono4', m, [s * 0.12, 0.15, -0.05], [0.06, 0.18, 0.04], [0, 0, -s * 0.3]);
  ojos(cb, '#ffcc33', 0.1, 0.06, 0.2, 0.04);
  const cola = r.cola = piv(r, G(cu, [0, 0.1, -0.62]));
  const fl = piv(r, G(cola, [0, 0, 0], [-0.8, 0, 0]));
  M(fl, 'cono', fuego, [0, 0, 0], [0.08, 0.5, 0.08]).userData.sinFlash = true;
  r.flamas.push(fl);
  cuatroPatas(r, 0.2, 0.72, 0.42, -0.4, 0.68, 0.085, m, osc(piel, 0.6));
  if (c.montura) silla(r, cu, [0, 0.29, -0.08], 0.28);
  r.lomo = cu; r.H = 1;
  return r;
}

// ── GATO INFERNAL ──
function hellgato(c) {
  const largoMax = 2.2;
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#3b1d4a'), m = mc(c, piel);
  r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.62, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.22, 0.22, 0.6]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.22, 0.62]));
  M(cb, 'esfera', m, [0, 0, 0], [0.18, 0.16, 0.18]);
  M(cb, 'esfera', osc(piel, 1.4), [0, -0.05, 0.13], [0.09, 0.07, 0.08]);
  for (const s of [-1, 1]) M(cb, 'cono4', m, [s * 0.1, 0.12, -0.01], [0.07, 0.17, 0.05], [0, 0, -s * 0.2]);
  ojos(cb, '#a3ff3a', 0.08, 0.04, 0.15, 0.035);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.09, 0.06]));
  M(mj, 'caja', osc(piel, 0.7), [0, 0, 0.06], [0.1, 0.03, 0.12]);
  const cola = r.cola = piv(r, G(cu, [0, 0.08, -0.58]));
  M(cola, 'cono', m, [0, 0, 0], [0.045, 0.7, 0.045], [-0.6, 0, 0]);
  fuera(cola);                                   // la cola alzada no cuenta en el alto
  const fl = piv(r, G(cola, [0, 0.57, -0.4], [-0.6, 0, 0]));
  M(fl, 'cono', mat('#c084fc', { e: 1 }), [0, 0, 0], [0.07, 0.22, 0.07]).userData.sinFlash = true;
  r.flamas.push(fl);
  cuatroPatas(r, 0.15, 0.52, 0.4, -0.38, 0.5, 0.055, m, osc(piel, 0.7));
  if (c.montura) silla(r, cu, [0, 0.21, -0.05], 0.24);
  r.lomo = cu; r.H = 0.8; r.largoMax = largoMax;
  return r;
}

// ── AVES Y MURCIELAGO ──
function ave(c, v) {
  const r = nuevoRig('volador'), R = r.raiz;
  const D = {
    pajaro:     { cuerpo: '#e6dfcc', cabeza: '#e6dfcc', pico: '#cbb98f', ojo: '#ff3b2f', ala: '#d9d0b8', geo: 'pluma', env: 0.7, aleteo: 12 },
    aguila:     { cuerpo: '#7a5230', cabeza: '#f2efe6', pico: '#f2c230', ojo: '#ffb020', ala: '#5e3d22', geo: 'pluma', env: 1.05, aleteo: 7 },
    murcielago: { cuerpo: '#3b2a4a', cabeza: '#3b2a4a', pico: null, ojo: '#ff2a2a', ala: '#5b3a6e', geo: 'ala', env: 0.85, aleteo: 15 },
  }[v];
  const piel = principal(c, D.cuerpo), m = mc(c, piel);
  r.vuela = true; r.aleteo = D.aleteo; r.amplAla = v === 'murcielago' ? 0.8 : 0.6; r.caer = 'lado'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.35, 0]));
  M(cu, 'esfera', m, [0, 0, 0], v === 'murcielago' ? [0.18, 0.24, 0.17] : [0.2, 0.2, 0.3]);
  const cb = r.cabeza = piv(r, G(cu, v === 'murcielago' ? [0, 0.26, 0.04] : [0, 0.18, 0.26]));
  M(cb, 'esfera', c.color && v !== 'aguila' ? m : D.cabeza, [0, 0, 0], v === 'murcielago' ? 0.15 : 0.13);
  if (D.pico) {
    const mj = r.mandibula = piv(r, G(cb, [0, -0.02, 0.1]));
    M(mj, 'cono', D.pico, [0, 0, 0], [0.05, v === 'aguila' ? 0.16 : 0.2, 0.05], [PI / 2 + 0.25, 0, 0]);
  } else {
    for (const s of [-1, 1]) {
      M(cb, 'cono4', m, [s * 0.08, 0.1, 0], [0.06, 0.18, 0.04], [0, 0, -s * 0.25]);
      M(cb, 'cono', '#f4efd8', [s * 0.035, -0.07, 0.12], [0.015, 0.06, 0.015], [PI, 0, 0]);
    }
  }
  ojos(cb, D.ojo, 0.065, 0.03, 0.1, 0.028);
  const mAla = mat(c.color && v !== 'pajaro' ? osc(c.color, 0.8) : D.ala, { ds: true });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.14 * s, 0.08, 0.02], [0, 0, 0.15 * s]));
    M(p, D.geo, mAla, [0, 0, 0], [D.env * s, 1, D.env * 0.6]);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  if (v !== 'murcielago') M(cu, 'caja', mAla, [0, 0.02, -0.34], [0.2, 0.02, 0.2], [-0.3, 0, 0]);
  for (const s of [-1, 1]) {
    const p = piv(r, G(cu, [0.07 * s, -0.15, 0]));
    M(p, 'cilT', D.pico || '#2b1d36', [0, 0, 0], [0.02, 0.16, 0.02]);
    M(p, 'esferaB', D.pico || '#2b1d36', [0, -0.17, 0.03], [0.04, 0.015, 0.05]);
    r.patas.push([p, 0, 'x', false]);
  }
  if (c.montura) silla(r, cu, [0, v === 'murcielago' ? 0.2 : 0.19, -0.04], 0.16);
  r.lomo = cu; r.H = 0.5; r.topeCabeza = 0.15;
  return r;
}

// ── ARAÑA ──
function arana(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#3d3a3a'), m = mc(c, piel);
  r.paso = 13; r.ampPatas = 0.6; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.42, -0.42], [0.42, 0.34, 0.5]);
  M(cu, 'esferaB', mat('#ff7a1a', { e: 0.9 }), [0, 0.74, -0.42], [0.13, 0.04, 0.16]);
  M(cu, 'esfera', m, [0, 0.32, 0.12], [0.26, 0.2, 0.28]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.34, 0.3]));
  ojos(cb, '#ff2a2a', 0.07, 0.06, 0.06, 0.045);
  ojos(cb, '#ff2a2a', 0.13, 0.03, 0.02, 0.03);
  for (const s of [-1, 1]) {
    const f = piv(r, G(cb, [s * 0.05, -0.08, 0.08]));
    M(f, 'cono', '#1b1414', [0, 0, 0], [0.025, 0.12, 0.025], [PI - 0.2, 0, 0]);
    r.pinzas.push(f);
  }
  const mp = mat(osc(piel, 0.8));
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const a = -0.75 + i * 0.5, giro = s > 0 ? a : PI - a;
    const p = piv(r, G(R, [s * 0.16, 0.32, 0.22 - i * 0.1], [0, giro, 0]));
    M(p, 'cilT', mp, [0, 0, 0], [0.03, 0.4, 0.03], [0, 0, 2.09]);
    M(p, 'cilT', mp, [0.35, 0.2, 0], [0.025, 0.56, 0.025], [0, 0, 0.367]);
    r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i < 2]);
  }
  r.lomo = cu; r.H = 0.6;
  return r;
}

// ── CANGREJO ──
function cangrejo(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#7dd3fc'), m = mc(c, piel, 0.15);
  r.paso = 12; r.ampPatas = 0.5; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.45, 0.2, 0.34]);
  const cris = mat(mez(piel, '#ffffff', 0.5), { e: 0.4 });
  M(cu, 'icos', cris, [0.15, 0.18, -0.05], [0.1, 0.16, 0.1]);
  M(cu, 'icos', cris, [-0.12, 0.17, -0.1], [0.08, 0.13, 0.08]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.1, 0.22]));
  for (const s of [-1, 1]) {
    M(cb, 'cil', m, [s * 0.1, 0.08, 0], [0.02, 0.16, 0.02]);
    M(cb, 'esferaB', '#1b1430', [s * 0.1, 0.17, 0], 0.045);
  }
  const mp = mat(osc(piel, 0.8));
  for (const s of [1, -1]) {
    const brazo = piv(r, G(cu, [s * 0.36, 0, 0.18], [0, s * 0.5, 0]));
    M(brazo, 'cilT', mp, [0, 0, 0], [0.05, 0.25, 0.05], [-PI / 2, 0, 0]);
    M(brazo, 'caja', m, [0, 0.03, 0.36], [0.14, 0.1, 0.2]);
    const inf = piv(r, G(brazo, [0, -0.02, 0.28]));
    M(inf, 'caja', m, [0, -0.04, 0.09], [0.1, 0.05, 0.18]);
    r.pinzas.push(inf);
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5, giro = s > 0 ? a : PI - a;
      const p = piv(r, G(R, [s * 0.3, 0.36, 0.08 - i * 0.14], [0, giro, 0]));
      M(p, 'cilT', mp, [0, 0, 0], [0.03, 0.53, 0.03], [0, 0, 0.85]);
      r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i === 0]);
    }
  }
  r.lomo = cu; r.H = 0.6;
  return r;
}

// ── PECES ──
function pez(c, v) {
  const r = nuevoRig('pez'), R = r.raiz;
  const D = {
    pez:        { piel: '#5a6b8c', cu: [0.2, 0.28, 0.4], aleta: '#8b1e1e' },
    pez_dardo:  { piel: '#5fb8e6', cu: [0.09, 0.11, 0.45], aleta: '#2b6f99' },
    pez_grande: { piel: '#6b7a3a', cu: [0.42, 0.42, 0.5], aleta: '#4a5527' },
  }[v];
  const piel = principal(c, D.piel), m = mc(c, piel), mA = mat(c.color ? osc(c.color, 0.7) : D.aleta, { ds: true });
  const [sx, sy, sz] = D.cu;
  r.caer = 'panza'; r.hundir = 0.3; r.colaAmp = 0; r.vuela = true;
  const cu = r.cuerpo = piv(r, G(R, [0, sy + 0.05, 0]));
  M(cu, 'esfera', m, [0, 0, 0], D.cu);
  if (v === 'pez') M(cu, 'esfera', '#c2412d', [0, -0.1, 0.08], [0.15, 0.17, 0.28]);
  M(cu, 'aleta', mA, [0, sy * 0.75, sz * 0.25], [1, sy * 0.8, sz * 0.75]);
  const cola = r.cola = piv(r, G(cu, [0, 0, -sz * 0.92]));
  M(cola, 'colaPez', mA, [0, 0, 0], [1, sy * 0.9, sz * 0.6]);
  ojos(cu, v === 'pez_grande' ? '#ffd84a' : '#fff06a', sx * 0.6, sy * 0.3, sz * 0.72, Math.max(0.03, sx * 0.18));
  r.aletas = [];
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [sx * 0.9 * s, -sy * 0.2, sz * 0.2]));
    M(p, 'caja', mA, [s * sx * 0.3, 0, 0], [sx * 0.6, 0.01, sz * 0.25]);
    r.aletas.push(p);
  }
  if (v === 'pez_dardo') M(cu, 'cono', m, [0, 0, sz * 0.9], [0.025, 0.35, 0.025], [PI / 2, 0, 0]);
  else {
    const mj = r.mandibula = piv(r, G(cu, [0, -sy * 0.3, sz * 0.7]));
    M(mj, 'caja', osc(piel, 0.8), [0, -0.01, sz * 0.12], [sx * 0.7, sy * 0.18, sz * 0.35]);
    const dn = v === 'pez_grande' ? [-0.2, -0.07, 0.07, 0.2] : [-0.04, 0.04];
    for (const x of dn) M(mj, 'cono4', '#f4efd8', [x, sy * 0.06, sz * 0.25], [0.025 + sx * 0.04, sy * 0.15, 0.025]);
  }
  if (v === 'pez_grande' && c.jefe) puas(cu, mat('#e0fffb', { e: 0.6 }), [[0, sy * 0.95, 0.15], [0, sy * 0.95, -0.15]], 1.3);
  r.cabeza = cu; r.H = 0.6; r.topeCabeza = sy;
  if (v === 'pez_dardo') r.largoMax = 3.2;
  return r;
}

// ── PULPO (con sombrero de brujo) ──
function pulpo(c) {
  const r = nuevoRig('pulpo'), R = r.raiz, piel = principal(c, '#8b5cf6'), m = mc(c, piel);
  r.caer = 'encoge';
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.8, -0.03], [0.36, 0.42, 0.34]);
  for (const s of [-1, 1]) {
    M(cu, 'esfera', '#ffffff', [s * 0.14, 0.72, 0.26], 0.1);
    M(cu, 'esferaB', mat('#ffe14a', { e: 0.8 }), [s * 0.14, 0.72, 0.35], [0.05, 0.07, 0.03]);
  }
  for (let i = 0; i < 8; i++) {
    const g = G(cu, [0, 0.5, 0], [0, (i * PI) / 4, 0]);
    const p = piv(r, G(g, [0, 0, 0.18]));
    M(p, 'cono', m, [0, 0, 0], [0.08, 0.55, 0.08], [2.5, 0, 0]);
    r.tent.push(p);
  }
  r.cabeza = cu; r.H = 0.9; r.topeCabeza = 1.18;
  if (c.k === 'pulpo') {
    const h = fuera(G(cu, [0, 1.12, -0.05], [-0.2, 0, 0]));
    M(h, 'cil', '#2a1840', [0, 0, 0], [0.34, 0.02, 0.34]);
    M(h, 'cono', '#2a1840', [0, 0, 0], [0.2, 0.5, 0.2], [-0.2, 0, 0]);
  }
  return r;
}

// ── DRAGON ──
function dragon(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#b91c1c'), m = mc(c, piel);
  const cuerno = '#f1e3c0';
  r.paso = 6; r.vuela = !!c.vuela; r.aleteo = 4.5; r.amplAla = 0.55; r.caer = 'lado'; r.hundir = 0.45; r.tAtk = 0.5; r.colaAmp = 0.25;
  const cu = r.cuerpo = piv(r, G(R, [0, 1.1, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.55, 0.5, 1.0]);
  M(cu, 'esfera', '#e8b04a', [0, -0.15, 0.1], [0.45, 0.4, 0.8]);
  puas(cu, cuerno, c.montura ? [[0, 0.36, -0.7]] : [[0, 0.41, 0.5], [0, 0.48, 0.1], [0, 0.46, -0.3], [0, 0.34, -0.7]], 1.2);
  const cuello = piv(r, G(cu, [0, 0.3, 0.75], [0.55, 0, 0]));
  M(cuello, 'tronco', m, [0, 0, 0], [0.24, 0.85, 0.24]);
  const cb = r.cabeza = piv(r, G(cuello, [0, 0.85, 0], [-0.55, 0, 0]));
  M(cb, 'esfera', m, [0, 0, 0.12], [0.28, 0.24, 0.4]);
  M(cb, 'caja', m, [0, -0.04, 0.48], [0.24, 0.16, 0.32]);
  for (const s of [-1, 1]) M(cb, 'cono', cuerno, [s * 0.13, 0.15, -0.1], [0.05, 0.35, 0.05], [-1.0, 0, -s * 0.25]);
  ojos(cb, '#ffd84a', 0.15, 0.07, 0.32, 0.045);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.13, 0.2]));
  M(mj, 'caja', osc(piel, 0.7), [0, 0, 0.2], [0.2, 0.06, 0.42]);
  const mAla = mat(osc(piel, 0.6), { ds: true });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.35 * s, 0.4, 0.25], [0, 0, 0.45 * s]));
    M(p, 'ala', mAla, [0, 0, 0], [2.2 * s, 1, 1.6], [-0.35, 0, 0]);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  const cola = r.cola = piv(r, G(cu, [0, -0.05, -0.95]));
  M(cola, 'tronco', m, [0, 0, 0], [0.28, 1.5, 0.2], [-1.75, 0, 0]);
  M(cola, 'cono4', cuerno, [0, -0.27, -1.48], [0.15, 0.3, 0.05], [-1.75, 0, 0]);
  cuatroPatas(r, 0.42, 0.95, 0.55, -0.5, 0.85, 0.18, m, osc(piel, 0.6));
  if (c.montura) silla(r, cu, [0, 0.5, 0.05], 0.3);
  r.lomo = cu; r.H = 1.4;
  return r;
}

// ═══════════ TABLA: hoja -> arquetipo ═══════════
const ARQ = {
  goblin_normal: c => goblin(c, 'goblin_normal'),
  goblin_samurai: c => goblin(c, 'goblin_samurai'),
  goblin_mage: c => goblin(c, 'goblin_mage'),
  goblin_peasant: c => goblin(c, 'goblin_peasant'),
  goblin_assassin: c => goblin(c, 'goblin_assassin'),
  goblin_guard: c => goblin(c, 'goblin_guard'),
  goblin_knight: c => goblin(c, 'goblin_knight'),
  goblin_lord: c => goblin(c, 'goblin_lord'),
  goblin_centurion: c => goblin(c, 'goblin_centurion'),
  goblin_battlelord: c => goblin(c, 'goblin_battlelord'),
  esqueleto: c => esqueleto(c, false),
  esqueleto_capa: c => esqueleto(c, true),
  fantasma: c => fantasma(c, 'fantasma'),
  fantasma_halo: c => fantasma(c, 'fantasma_halo'),
  espectro: c => fantasma(c, 'espectro'),
  hechicero, ghoul_ardiente: ghoul, coloso, angel, cosa,
  hongo, baba, rana, conejo, saltador, serpiente, lagarto, zarigueya, hellhound, hellgato,
  pajaro: c => ave(c, 'pajaro'),
  aguila: c => ave(c, 'aguila'),
  murcielago: c => ave(c, 'murcielago'),
  arana, cangrejo,
  pez: c => pez(c, 'pez'),
  pez_dardo: c => pez(c, 'pez_dardo'),
  pez_grande: c => pez(c, 'pez_grande'),
  pulpo, dragon,
};

// Jefes: corona (o puas doradas si ya llevan casco/sombrero) y aura en el suelo.
function decorarJefe(r) {
  const oro = mat('#ffd84a', { e: 0.6 });
  if (r.conCorona) {
    // Ya tiene corona (Rey Goblin): puas doradas en los hombros.
    if (r.bI) for (const b of [r.bI, r.bD]) M(fuera(G(b)), 'cono4', oro, [0, 0.07, 0], [0.06, 0.24, 0.06]);
    return;
  }
  if (r.cabeza) {
    if (r.H == null) r.H = 1;
    if (r.topeCabeza == null) r.topeCabeza = 0.18 * r.H;
    if (r.modo !== 'bipedo' && r.coronaEsc == null) r.coronaEsc = 0.7;      // bestias: corona mas pequeña
    ACC.corona(r);
  }
}

// ═══════════ API ═══════════
export function crearMonstruo(k) {
  const d = MONSTRUOS[k] || { hoja: 'goblin_normal', nivel: 1 };
  let alto = 62 / PX_M;
  try { if (MONSTRUOS[k]) alto = statsMonstruo(k).alto / PX_M; } catch (e) {}
  const c = { k, color: d.tinte || null, jefe: !!d.jefe, e: d.jefe ? 0.22 : 0, vuela: !!d.vuela };
  const r = (ARQ[d.hoja] || ARQ.goblin_normal)(c);
  if (c.jefe) decorarJefe(r);
  const m = new Modelo(r, alto);
  if (c.jefe) m._aura(c.color || '#ff4444');
  m.tipo = 'monstruo'; m.k = k; m.hoja = d.hoja; m.vuela = !!d.vuela; m.jefe = c.jefe;
  return m;
}

// NPC del pueblo: los mismos arquetipos con colores amables y ojos de duende.
export function crearNpc(hoja) {
  const c = { k: 'npc_' + hoja, color: null, jefe: false, e: 0, amigo: true };
  let r;
  if (hoja === 'goblin_guard') { c.color = '#2f6fd6'; r = goblin(c, 'goblin_guard'); }
  else if (hoja === 'goblin_mage') { c.color = '#b9a4f5'; r = goblin(c, 'goblin_mage'); }
  else if (hoja === 'goblin_peasant') r = goblin(c, 'goblin_peasant');
  else if (hoja === 'hechicero') r = hechicero(c);
  else r = (ARQ[hoja] || ARQ.goblin_peasant)(c);
  const m = new Modelo(r, 62 / PX_M);
  m.tipo = 'npc'; m.hoja = hoja;
  return m;
}

// Monturas: alto sin jinete (m) por hoja; 'silla' = punto donde va el duende.
const ALTO_MONTURA = { lagarto: 1.4, conejo: 2.1, rana: 1.25, hellgato: 1.6, hellhound: 1.5, aguila: 1.5, dragon: 1.9, murcielago: 1.7 };
export function crearMontura(id) {
  const d = MONTURAS[id] || MONTURAS.lagarto || { hoja: 'lagarto' };
  const c = { k: 'montura_' + id, color: d.tinte || null, jefe: false, e: 0, montura: true };
  const r = (ARQ[d.hoja] || ARQ.lagarto)(c);
  if (!r.marcaSilla) {
    // Por si un arquetipo no trae silla: encima del cuerpo.
    const cu = r.lomo || r.cuerpo || r.raiz;
    r.raiz.updateMatrixWorld(true);
    const box = new THREE.Box3(); medir(r.raiz, box);
    r.marcaSilla = G(cu, [0, 0, 0]);
    r.marcaSilla.position.y = box.max.y * 0.8 - cu.position.y;
  }
  const m = new Modelo(r, ALTO_MONTURA[d.hoja] || 1.5);
  m.obj.updateMatrixWorld(true);
  const v = r.marcaSilla.getWorldPosition(new THREE.Vector3());
  m.silla = new THREE.Object3D();
  m.silla.name = 'silla';
  m.silla.position.copy(v);
  m.base.add(m.silla);          // sigue el rebote del galope
  m.tipo = 'montura'; m.id = id; m.hoja = d.hoja;
  return m;
}

// Crea de antemano las geometrias compartidas (evita tirones al aparecer).
export function precalentar() {
  for (const k of Object.keys(FABRICA)) geo(k);
  mat('#ffffff'); mat('#1b1430');
}
