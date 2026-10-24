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
// ninguna sombra y menos de ~30 mallas por modelo. Al crear el Modelo, las
// piezas fijas de cada pivote se funden en una malla (fusionarRig): ~6-14 draw calls.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { MONSTRUOS, HOJAS, SKINS, CLASES, ARMAS, MONTURAS, APARIENCIA, LOOK_BASE, limpiarLook, statsMonstruo } from '/mmo/js/data.js?v=286';

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
  const k = c.getHexString() + '|' + (o.e || 0) + '|' + (o.op || 1) + '|' + (o.ds ? 1 : 0) + '|' + (o.aura ? 1 : 0) + '|' + (o.vc ? 1 : 0);
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
      vertexColors: !!o.vc,
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
// ── MALLAS FUSIONADAS ──
// Varias piezas en UNA malla (un solo draw call) con color por vertice.
// partes: [[geometria, color, pos, escala, rot], ...]. Se cachea por contenido.
// (Sin escalas negativas: invertirian las caras.)
const FUS = new Map();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function fusion(partes) {
  const clave = JSON.stringify(partes);
  let g = FUS.get(clave);
  if (g) return g;
  const pos = [], cols = [];
  for (const [gk, color, p, es, ro] of partes) {
    const src = geo(gk), gg = src.index ? src.toNonIndexed() : src.clone();
    _e.set(ro ? ro[0] : 0, ro ? ro[1] : 0, ro ? ro[2] : 0);
    _q.setFromEuler(_e);
    if (es == null) _s.set(1, 1, 1); else if (typeof es === 'number') _s.setScalar(es); else _s.set(es[0], es[1], es[2]);
    _m4.compose(_v.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0), _q, _s);
    gg.applyMatrix4(_m4);
    const a = gg.attributes.position.array;
    _c.set(color == null ? '#ffffff' : color);
    for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); cols.push(_c.r, _c.g, _c.b); }
    gg.dispose();
  }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  FUS.set(clave, g);
  return g;
}
// MF(padre, partes, color?, opciones?, pos?, escala?): sin color usa el de cada pieza.
function MF(padre, partes, c, o, pos, esc) {
  const m = c ? (c.isMaterial ? c : mat(c, o)) : mat('#ffffff', Object.assign({ vc: true }, o));
  const me = new THREE.Mesh(fusion(partes), m);
  if (pos) me.position.set(pos[0], pos[1], pos[2]);
  if (esc != null) typeof esc === 'number' ? me.scale.setScalar(esc) : me.scale.set(esc[0], esc[1], esc[2]);
  me.matrixAutoUpdate = false;
  me.updateMatrix();
  padre.add(me);
  return me;
}
// Hex de un color (para las claves de fusion).
const hx = c => '#' + col(c).getHexString();

// ── FUSION DEL RIG POR PIVOTE (menos draw calls) ──
// Las piezas estaticas que cuelgan de un mismo pivote animado (directamente o a
// traves de grupos fijos: mano, arma, casco...) nunca se mueven entre si, asi que
// se hornean en UNA malla con color por vertice. La animacion no cambia: lo que
// se mueve son los pivotes. Solo piezas opacas de Lambert (de mat()/MF), sin
// sinFlash, de una cara y sin espejo (determinante > 0). Las que brillan
// (emissive = su color, como mat(c, { e })) llevan su brillo por vertice
// (atributo 'brillo') y un material cuyo emissive = color del vertice * brillo.
// La geometria se cachea por clave del modelo + pivote (+ brillo) y se comparte
// entre modelos iguales; lleva cuenta de usos y las que nadie usa se sueltan
// (se guardan las RIGF_LIBRES mas recientes por si vuelve a aparecer el modelo).
const RIGF = new Map();          // clave -> { g, firma, usos }
const RIGF_LIBRES = 48;
// Para comparar en la galeria: ?sinFusion=1 desactiva la fusion.
const FUSION = !(typeof location !== 'undefined' && /[?&]sinFusion=1(&|$)/.test(location.search));
const _negro = new THREE.Color(0), _c2 = new THREE.Color();
// Material blanco con color por vertice; con brillo, emissive = color del vertice * brillo.
function matVC(brillo) {
  if (!brillo) return mat('#ffffff', { vc: true });
  let m = MATS.get('vcb');
  if (m) return m;
  m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1 });
  m.onBeforeCompile = s => {
    s.vertexShader = 'attribute float brillo;\nvarying float vBrillo;\n' +
      s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBrillo = brillo;');
    s.fragmentShader = 'varying float vBrillo;\n' +
      s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb * vBrillo;');
  };
  m.customProgramCacheKey = () => 'vcb';
  m.userData.compartido = true;
  MATS.set('vcb', m);
  return m;
}
// Brillo de una pieza fusionable (0 = sin brillo) o -1 si no se puede fusionar.
function brilloFusion(me) {
  const m = me.material;
  if (!me.isMesh || me.isInstancedMesh || me.isSkinnedMesh || me.morphTargetInfluences) return -1;
  if (me.matrixAutoUpdate !== false || me.userData.sinFlash || !me.visible || me.children.length) return -1;
  if (!m || !m.isMeshLambertMaterial || m.transparent || m.opacity < 1 || m.side !== THREE.FrontSide || m.map || !m.flatShading) return -1;
  if (!me.geometry.attributes.position || me.geometry.morphAttributes.position) return -1;
  if (m.emissiveIntensity > 0 && !m.emissive.equals(_negro)) {
    // Solo el brillo "del propio color" (mat(c, { e })) se puede llevar al vertice.
    if (m.vertexColors || !m.emissive.equals(m.color)) return -1;
    return m.emissiveIntensity;
  }
  return 0;
}
// Firma de las piezas (geometria, material y matriz) para no reutilizar por error.
function firmaPiezas(piezas) {
  let s = '';
  for (const [me, mm] of piezas) {
    let h = 0;
    const el = mm.elements;
    for (let i = 0; i < 16; i++) h += Math.round(el[i] * 1e4) * (i + 1);
    s += me.geometry.id + ':' + me.material.id + ':' + h + ';';
  }
  return s;
}
// Hornea las piezas (con su matriz relativa al pivote) en una sola geometria.
function hornear(piezas) {
  const geos = piezas.map(([me]) => (me.geometry.index ? me.geometry.toNonIndexed() : me.geometry));
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
  const br = piezas.some(x => x[2] > 0) ? new Float32Array(n) : null;
  let j = 0;
  piezas.forEach(([me, mm, e], i) => {
    const g = geos[i], p = g.attributes.position, m = me.material;
    const vc = m.vertexColors ? g.attributes.color : null;
    for (let v = 0; v < p.count; v++, j += 3) {
      _v.fromBufferAttribute(p, v).applyMatrix4(mm);
      pos[j] = _v.x; pos[j + 1] = _v.y; pos[j + 2] = _v.z;
      _c.copy(m.color);
      if (vc) _c.multiply(_c2.setRGB(vc.getX(v), vc.getY(v), vc.getZ(v)));
      cols[j] = _c.r; cols[j + 1] = _c.g; cols[j + 2] = _c.b;
      if (br) br[j / 3] = e;
    }
    if (g !== me.geometry) g.dispose();
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (br) g.setAttribute('brillo', new THREE.BufferAttribute(br, 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
function tomarFusion(clave, piezas) {
  const firma = firmaPiezas(piezas);
  let ent = clave ? RIGF.get(clave) : null;
  if (ent && ent.firma !== firma) ent = null, clave = null;     // no coincide: geometria propia
  if (!ent) ent = { g: hornear(piezas), firma, usos: 0, propia: !clave };
  else RIGF.delete(clave);
  if (clave) RIGF.set(clave, ent);                               // al final = la mas reciente
  ent.usos++;
  return ent;
}
function soltarFusion(ent) {
  if (--ent.usos > 0) return;
  if (ent.propia) { ent.g.dispose(); return; }
  let libres = 0;
  for (const e of RIGF.values()) if (!e.usos) libres++;
  for (const [k, e] of RIGF) {
    if (libres <= RIGF_LIBRES) break;
    if (!e.usos) { e.g.dispose(); RIGF.delete(k); libres--; }
  }
}
// Fusiona el rig r (ya en pose de reposo). Devuelve las entradas usadas (para soltarlas).
function fusionarRig(r, clave) {
  if (!FUSION) return [];
  // Bordes: la raiz y los pivotes animados (animarRig solo mueve r.piv: lo vuelve
  // a su reposo cada frame). Todo lo demas es fijo respecto a su borde.
  // Lo que el rig nombra (manos, marca de la silla, giran, aura...) no se fusiona
  // ni se quita aunque se quede vacio.
  const bordes = new Set(r.piv);
  bordes.add(r.raiz);
  const nombrados = new Set();
  const mirar = v => {
    if (!v || typeof v !== 'object') return;
    if (v.isObject3D) nombrados.add(v);
    else if (Array.isArray(v)) v.forEach(mirar);
  };
  for (const k in r) if (k !== 'raiz') mirar(r[k]);
  const lista = [];
  r.raiz.traverse(o => { if (bordes.has(o)) lista.push(o); });
  const usadas = [];
  lista.forEach((piv0, i) => {
    const piezas = [];             // [malla, matriz relativa al pivote, brillo]
    const recorrer = (o, mo) => {
      for (const h of o.children) {
        if (bordes.has(h) || !h.visible) continue;
        if (h.matrixAutoUpdate) h.updateMatrix();
        const mh = mo ? new THREE.Matrix4().multiplyMatrices(mo, h.matrix) : h.matrix.clone();
        const e = brilloFusion(h);
        if (e >= 0 && !nombrados.has(h) && mh.determinant() > 0) piezas.push([h, mh, e]);
        if (h.children.length) recorrer(h, mh);
      }
    };
    recorrer(piv0, null);
    if (piezas.length < 2) return;
    {
      const ent = tomarFusion(clave ? clave + '#' + i : null, piezas);
      usadas.push(ent);
      const me = new THREE.Mesh(ent.g, matVC(!!ent.g.attributes.brillo));
      me.name = 'fusion';
      me.matrixAutoUpdate = false;
      me.updateMatrix();
      me.castShadow = piezas.some(([p]) => p.castShadow);
      me.receiveShadow = piezas.some(([p]) => p.receiveShadow);
      for (const [p] of piezas) {
        let padre = p.parent;
        p.removeFromParent();
        // Grupos fijos que se quedan vacios: fuera (menos matrices por frame).
        while (padre && padre !== piv0 && !bordes.has(padre) && !nombrados.has(padre) && !padre.isMesh && !padre.children.length) {
          const pp = padre.parent;
          padre.removeFromParent();
          padre = pp;
        }
      }
      piv0.add(me);
    }
  });
  return usadas;
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
  // clave: identifica el modelo (mismo rig = misma clave) para compartir la fusion.
  constructor(r, alto, clave) {
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
    // Piezas fijas de cada pivote en una sola malla (antes de llenar mallas: golpe() sigue igual).
    this._fus = fusionarRig(r, clave || null);
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
  // Las geometrias y materiales son compartidos: solo se suelta el modelo
  // (y su uso de las geometrias fusionadas, que se liberan cuando nadie las usa).
  dispose() {
    clearTimeout(this._tf);
    this._restaurar();
    if (this._fus) { for (const ent of this._fus) soltarFusion(ent); this._fus = null; }
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
  const hy = T * 0.84, hom = o.huesos ? 0.2 * W + 0.05 : 0.27 * W * P * 0.8 + 0.09;
  for (const lado of [1, -1]) {
    const b = piv(r, G(cu, [hom * lado, hy, 0], [0, 0, 0.12 * lado]));
    M(b, 'cilT', o.mangas ?? mRopa, [0, 0, 0], [gr * 0.8, Ab, gr * 0.8]);
    M(b, 'esfera', o.manos ?? piel, [0, -Ab - 0.02, 0], (o.huesos ? 0.06 : 0.085) * (o.manoG ?? 1));
    const mano = G(b, [0, -Ab - 0.02, 0]);
    if (lado > 0) { r.bI = b; r.manoI = mano; } else { r.bD = b; r.manoD = mano; }
  }
  // Cabeza
  const cb = r.cabeza = piv(r, G(cu, [0, T + 0.01, 0], [-(o.encorvado || 0) * 0.8, 0, 0]));
  r.H = H;
  const tipo = o.cabeza || 'goblin';
  if (tipo === 'nada') { r.topeCabeza = 0.5 * H; return r; }
  if (tipo === 'calavera') {
    const hueso = o.calavera ?? piel;
    M(cb, 'esfera', hueso, [0, 0.24 * H, 0], [0.24 * H, 0.24 * H, 0.25 * H]);
    M(cb, 'caja', hueso, [0, 0.07 * H, 0.07 * H], [0.18 * H, 0.08 * H, 0.16 * H]);            // mandibula
    const ojo = mat(o.ojos || '#7df9ff', { e: 1 });
    for (const x of [-1, 1]) M(cb, 'esferaB', ojo, [x * 0.08 * H, 0.25 * H, 0.2 * H], [0.05 * H, 0.05 * H, 0.03 * H]);
    r.topeCabeza = 0.48 * H;
    return r;
  }
  M(cb, 'esfera', piel, [0, 0.26 * H, 0], [0.3 * H, 0.28 * H, 0.28 * H]);
  if (o.orejas) for (const x of [-1, 1]) M(cb, 'cono', piel, [x * 0.24 * H, 0.3 * H, -0.03 * H], [0.075 * H, o.orejas * H, 0.045 * H], [0, -x * 0.25, -x * (o.orejaRot || 1.2)]);
  if (o.nariz === 'bola') M(cb, 'esfera', osc(piel, 0.92), [0, 0.21 * H, 0.27 * H], [0.08 * H, 0.07 * H, 0.09 * H]);
  else if (o.nariz === 'pico') M(cb, 'cono', piel, [0, 0.22 * H, 0.23 * H], [0.06 * H, 0.22 * H, 0.06 * H], [PI / 2 + 0.25, 0, 0]);
  else if (o.nariz === 'gancho') {   // la del duende 2D: larga, ancha en la base y caida hacia abajo
    MF(cb, [['cono', hx(osc(piel, 0.9)), [0, 0.27, 0.22], [0.085, 0.26, 0.075], [PI / 2 + 0.5, 0, 0]],
      ['esfera', hx(osc(piel, 0.9)), [0, 0.15, 0.4], [0.05, 0.045, 0.05]]], null, null, null, H);
  }
  if (o.ojos === 'duende') {
    MF(cb, o.ojosGrandes ? partesOjos(true) : partesOjos2D(piel), null, null, null, H);
  } else if (o.ojos) {
    const ojo = mat(o.ojos, { e: 1 });
    for (const x of [-1, 1]) M(cb, 'esferaB', ojo, [x * 0.1 * H, 0.31 * H, 0.25 * H], [0.06 * H, 0.045 * H, 0.03 * H]);
  }
  if (o.colmillos) for (const x of [-1, 1]) M(cb, 'cono', '#f4efd8', [x * 0.07 * H, 0.1 * H, 0.22 * H], [0.025 * H, 0.08 * H, 0.025 * H]);
  r.topeCabeza = 0.54 * H;
  return r;
}

// Ojos como en las imagenes 2D: rasgados, iris ambar, pupila y ceja gruesa
// de piel fruncida hacia el centro (mirada picara).
function partesOjos2D(piel) {
  const P = [], ceja = hx(osc(piel, 0.72));
  for (const x of [-1, 1]) {
    P.push(['esfera', '#fff1b8', [x * 0.105, 0.3, 0.246], [0.07, 0.042, 0.03]]);
    P.push(['esferaB', '#f59e0b', [x * 0.1, 0.298, 0.268], [0.036, 0.036, 0.014]]);
    P.push(['esferaB', '#1b1430', [x * 0.1, 0.298, 0.276], [0.014, 0.027, 0.008]]);
    P.push(['caja', ceja, [x * 0.11, 0.352, 0.24], [0.15, 0.05, 0.07], [0, 0, x * 0.42]]);
  }
  return P;
}
// Ojos del duende en unidades de cabeza (H = 1).
function partesOjos(grandes) {
  const P = [];
  for (const x of [-1, 1]) {
    if (grandes) {
      P.push(['esfera', '#ffffff', [x * 0.115, 0.31, 0.24], [0.1, 0.112, 0.055]]);
      P.push(['esferaB', '#1b1430', [x * 0.112, 0.305, 0.29], [0.065, 0.078, 0.028]]);
      P.push(['esferaB', '#ffffff', [x * 0.095, 0.335, 0.312], [0.022, 0.022, 0.012]]);
    } else {
      P.push(['esfera', '#ffffff', [x * 0.1, 0.3, 0.245], [0.07, 0.075, 0.04]]);
      P.push(['esferaB', '#1b1430', [x * 0.1, 0.3, 0.283], [0.042, 0.05, 0.02]]);
    }
  }
  return P;
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
  const P = [['semi', hx(c), [0, -0.02, 0], [0.14, 0.11, 0.14]]];
  if (pua) P.push(['cono4', hx(pua), [0, 0.06, 0], [0.05, 0.2, 0.05]], ['cono4', hx(pua), [0, 0.02, -0.08], [0.035, 0.14, 0.035], [-0.6, 0, 0]]);
  for (const b of [r.bI, r.bD]) MF(b, P);
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
  const P = [
    ['caja', hx(o.mango ?? '#3b2a1e'), [0, 0, -0.05], [0.04, 0.04, 0.2]],
    ['caja', hx(o.guarda ?? '#c9a227'), [0, 0, 0.07], [o.daga ? 0.1 : 0.15, 0.05, 0.035]],
  ];
  const hoja = ['caja', hx(o.hoja ?? '#d7dde4'), [0, 0, 0.09 + L / 2], [0.025, o.ancho ?? 0.07, L]];
  if (o.e) M(g, 'caja', mat(o.hoja, { e: o.e }), hoja[2], hoja[3]).userData.sinFlash = true;
  else P.push(hoja);
  MF(g, P);
  return g;
}
function garrote(mano, c = '#6b4a2b') {
  const g = grupoArma(mano);
  MF(g, [['tronco', hx(c), [0, 0, 0.65], [0.1, 0.65, 0.1], [-PI / 2, 0, 0]], ['cono4', '#d8d0b8', [0.08, 0, 0.55], [0.03, 0.08, 0.03], [0, 0, -PI / 2]]]);
  return g;
}
function hacha(mano, c = '#9aa3ad', mango = '#5a3d22', grande = 1) {
  const g = grupoArma(mano, -0.7), k = grande;
  MF(g, [
    ['cil', hx(mango), [0, 0, 0.35 * k], [0.03, 0.9 * k, 0.03], [PI / 2, 0, 0]],
    ['caja', hx(c), [0, 0.13 * k, 0.68 * k], [0.03, 0.3 * k, 0.24 * k]],
    ['caja', hx(c), [0, -0.1 * k, 0.68 * k], [0.03, 0.2 * k, 0.16 * k]],
  ]);
  return g;
}
function maza(mano, c = '#c9a227') {
  const g = grupoArma(mano);
  MF(g, [['cil', '#4a3420', [0, 0, 0.25], [0.03, 0.55, 0.03], [PI / 2, 0, 0]], ['icos', hx(c), [0, 0, 0.58], 0.13]]);
  return g;
}
function lanzaA(mano, c = '#c0c6cc') {
  const g = grupoArma(mano, -1.35);
  MF(g, [['cil', '#6b4a2b', [0, 0, 0.35], [0.025, 1.7, 0.025], [PI / 2, 0, 0]], ['cono4', hx(c), [0, 0, 1.18], [0.05, 0.24, 0.03], [PI / 2, 0, 0]]]);
  return g;
}
function horca(mano) {
  const g = grupoArma(mano, -1.3);
  const P = [['cil', '#8a6438', [0, 0, 0.3], [0.025, 1.4, 0.025], [PI / 2, 0, 0]], ['caja', '#8d949b', [0, 0, 1.0], [0.24, 0.03, 0.03]]];
  for (const x of [-0.1, 0, 0.1]) P.push(['cono', '#8d949b', [x, 0, 1.0], [0.015, 0.22, 0.015], [PI / 2, 0, 0]]);
  MF(g, P);
  return g;
}
function guadana(mano, c = '#b9c2cc') {
  const g = grupoArma(mano, -1.25);
  MF(g, [['cil', '#3a2c22', [0, 0, 0.3], [0.025, 1.5, 0.025], [PI / 2, 0, 0]], ['caja', hx(c), [0, -0.25, 1.02], [0.02, 0.5, 0.07], [0.35, 0, 0]]]);
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
// Ropa de cada skin, sacada de su imagen 2D (assets/skins/*.png).
const ROPA_SKIN = {
  // Duende de siempre (heroe de la hoja animada): cuero marron con hebillas de bronce.
  comun:      { ropa: '#7a5230', pantalon: '#4e3420', botas: '#3a2616', acento: '#c9a227' },
  // Tactico: sudadera verde de hacker, visor verde y lineas de codigo neon.
  tactico:    { ropa: '#1f6b35', pantalon: '#1a2a20', botas: '#121a14', acento: '#39ff6a', neon: '#39ff6a', visor: '#1aff5a', capucha: '#1a5a2c', teclado: '#39ff6a', codigo: '#39ff6a' },
  // Nigromante: sombras moradas con llamas violeta en las manos.
  necro:      { ropa: '#3a1f5c', pantalon: '#1e1230', botas: '#160d22', acento: '#b44cff', llamas: '#b44cff', capucha: '#24123a', tunica: '#2a1644', ojosBrillo: '#c77dff', orbe: '#b44cff', humo: '#7c3aed' },
  // Rey: traje azul con corbata roja y corona.
  king:       { ropa: '#22307a', pantalon: '#1a2358', botas: '#141a3a', acento: '#ffd84a', corbata: '#d22b2b', corona: true, gemas: true, ribete: '#38bdf8', movil: true },
  // Berserker (el juez): toga morada con ribetes dorados, capa y corona.
  berserker:  { ropa: '#6b2a8f', pantalon: '#3d1858', botas: '#2a1040', acento: '#ffd84a', cinto: '#ffd84a', corona: true, capa: '#4d1d6b', tunica: '#5b2380', borde: '#ffd84a', peluca: '#f1f1f1', chorrera: '#ffffff', mazo: '#e8b923', runas: '#b44cff' },
  // Legendaria: armadura negra con circuitos neon cian y magenta.
  legendaria: { ropa: '#1b1f33', pantalon: '#12152a', botas: '#0c0e1c', acento: '#00f0ff', neon: '#ff3cf0', hombreras: true, puas: '#00f0ff', ojosBrillo: '#ff9a1f', orbe: '#00f0ff', hojaNeon: '#7df9ff' },
};
// Detalles de la skin: cuello y hebilla, corbata, neon, visor, llamas, corona, capa.
function vestirSkin(r, R0, cpo, tocado) {
  const T = 0.46, W = cpo.ancho, P = cpo.panza, ac = hx(R0.acento);
  const cu = r.cuerpo, H = r.H;
  const piezas = [
    ['toro', ac, [0, T * 0.97, 0], [0.16 * W, 0.2, 0.15]],
    ['caja', ac, [0, T * 0.18, 0.19 * P + 0.01], [0.09, 0.07, 0.03]],
  ];
  if (R0.corbata) piezas.push(['caja', hx(R0.corbata), [0, T * 0.62, 0.2 * P + 0.02], [0.06, 0.24, 0.03]], ['cono4', hx(R0.corbata), [0, T * 0.47, 0.2 * P + 0.02], [0.045, 0.08, 0.02], [PI, 0, 0]]);
  if (R0.cinto && R0.capa) piezas.push(['caja', ac, [0, T * 0.55, 0.2 * P + 0.015], [0.05, T * 0.75, 0.02]]);
  MF(cu, piezas);
  if (R0.neon) {
    const m = mat(R0.neon, { e: 0.9 });
    const lineas = [];
    for (const s of [-1, 1]) lineas.push(['caja', null, [s * 0.11 * W * P, T * 0.55, 0.2 * P], [0.025, 0.2, 0.02], [0, 0, s * 0.35]]);
    lineas.push(['caja', null, [0, T * 0.3, 0.215 * P], [0.18 * W, 0.02, 0.02]]);
    MF(cu, lineas, m).userData.sinFlash = true;
  }
  if (R0.hombreras) hombreras(r, R0.neon ? mez(R0.ropa, R0.neon, 0.5) : R0.acento, R0.puas);
  // Tunica larga hasta los pies (nigromante, juez), con ribete.
  if (R0.tunica) {
    const L = 0.45;
    M(cu, 'tronco', R0.tunica, [0, -L + 0.03, 0], [0.31 * W * P, L + 0.12, 0.28 * P]);
    if (R0.borde) M(cu, 'toro', mat(R0.borde, { e: 0.25 }), [0, -L + 0.07, 0], [0.3 * W * P, 0.5, 0.27 * P]);
  }
  // Ribetes de neon del traje (rey): solapas y bajo de la chaqueta.
  if (R0.ribete) {
    const m = mat(R0.ribete, { e: 0.8 });
    MF(cu, [['caja', null, [-0.07, T * 0.62, 0.2 * P + 0.012], [0.02, 0.28, 0.02], [0, 0, -0.35]], ['caja', null, [0.07, T * 0.62, 0.2 * P + 0.012], [0.02, 0.28, 0.02], [0, 0, 0.35]],
      ['toro', null, [0, T * 0.06, 0], [0.24 * W * P, 0.35, 0.2 * P]]], m).userData.sinFlash = true;
  }
  // Lineas de codigo en la sudadera (tactico).
  if (R0.codigo) {
    const m = mat(R0.codigo, { e: 1 }), puntos = [];
    for (let i = 0; i < 9; i++) puntos.push(['caja', null, [((i * 37) % 7 - 3) * 0.045 * W, T * (0.25 + (i % 5) * 0.12), 0.21 * P], [0.03 + (i % 3) * 0.015, 0.018, 0.02]]);
    MF(cu, puntos, m).userData.sinFlash = true;
  }
  // Capucha puesta (si la clase no lleva ya algo en la cabeza).
  if (R0.capucha && !tocado) { ACC.capucha(r, R0.capucha); r.tocado = true; tocado = 'capucha'; }
  // Peluca de juez: rizos blancos a los lados y detras.
  if (R0.peluca) {
    const P2 = [];
    for (const x of [-1, 1]) for (let k = 0; k < 3; k++) P2.push(['esfera', hx(R0.peluca), [x * 0.27, 0.3 - k * 0.1, -0.04 - k * 0.02], [0.085, 0.07, 0.085]]);
    P2.push(['esfera', hx(R0.peluca), [0, 0.42, -0.12], [0.27, 0.12, 0.2]]);
    fuera(MF(r.cabeza, P2, null, null, null, H));
    tocado = tocado || 'peluca';
  }
  // Chorrera blanca del juez.
  if (R0.chorrera) MF(cu, [['cono', hx(R0.chorrera), [0, T * 0.6, 0.2 * P + 0.02], [0.07, 0.2, 0.03], [PI, 0, 0]], ['esferaB', hx(R0.chorrera), [0, T * 0.86, 0.17 * P], [0.09, 0.05, 0.05]]]);
  // Ojos que brillan (nigromante bajo la capucha, legendaria).
  if (R0.ojosBrillo) {
    const m = mat(R0.ojosBrillo, { e: 1 });
    for (const x of [-1, 1]) fuera(M(r.cabeza, 'esferaB', m, [x * 0.1 * H, 0.3 * H, 0.27 * H], [0.05 * H, 0.04 * H, 0.03 * H])).userData.sinFlash = true;
  }
  // Orbe de energia que flota junto al hombro y gira.
  if (R0.orbe) {
    const g = piv(r, fuera(G(r.cuerpo, [-0.42, T + 0.25, 0.05])));
    M(g, 'icos', mat(R0.orbe, { e: 1 }), [0, 0, 0], 0.09).userData.sinFlash = true;
    M(g, 'toro', mat(R0.orbe, { e: 0.8 }), [0, 0, 0], [0.16, 0.16, 0.16], [0.6, 0, 0]).userData.sinFlash = true;
    r.giran.push([g, 1.6]);
  }
  // Humo/aura oscura a los pies.
  if (R0.humo) {
    const m = mat(R0.humo, { aura: true, op: 0.35 }), g = piv(r, fuera(G(r.raiz, [0, 0.08, 0])));
    for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M(g, 'esferaB', m, [Math.cos(a) * 0.32, 0.05 + (k % 2) * 0.06, Math.sin(a) * 0.32], [0.16, 0.1, 0.16]).userData.sinFlash = true; }
    r.giran.push([g, 0.6]);
  }
  // Anillos de runas que giran alrededor del cuerpo (juez).
  if (R0.runas) {
    const m = mat(R0.runas, { aura: true, op: 0.28 });
    for (const [y, inc, v] of [[0.5, 0.3, 0.9], [1.0, -0.25, -1.2]]) {
      const g = piv(r, fuera(G(r.raiz, [0, y, 0], [inc, 0, 0])));
      M(g, 'toro', m, [0, 0, 0], [0.66, 0.3, 0.66]).userData.sinFlash = true;
      r.giran.push([g, v]);
    }
  }
  // Teclado holografico flotando delante (tactico).
  if (R0.teclado) {
    const g = fuera(G(r.cuerpo, [0, T * 0.35, 0.36]));
    M(g, 'caja', mat(R0.teclado, { e: 0.9, op: 0.75 }), [0, 0, 0], [0.42, 0.02, 0.15], [0.35, 0, 0]).userData.sinFlash = true;
  }
  // Movil con el grafico en verde (rey).
  if (R0.movil) {
    const g = fuera(G(r.manoI, [0.03, 0.08, 0.07], [0, -0.5, 0]));
    g.scale.setScalar(1.4);
    M(g, 'caja', '#111827', [0, 0.06, 0], [0.025, 0.2, 0.12]);
    const pant = [['caja', null, [0.014, 0.06, 0], [0.005, 0.17, 0.1]]];
    MF(g, pant, mat('#0b3b2a', { e: 0.6 }));
    MF(g, [['caja', null, [0.018, 0.04, -0.02], [0.004, 0.012, 0.05], [0.7, 0, 0]], ['caja', null, [0.018, 0.09, 0.025], [0.004, 0.012, 0.05], [0.9, 0, 0]]], mat('#22ff88', { e: 1 })).userData.sinFlash = true;
  }
  // Mazo de juez dorado en la mano izquierda.
  if (R0.mazo && !r.escudo) {
    const g = fuera(G(r.manoI, [0, 0, 0.02], [-0.5, 0, 0]));
    MF(g, [['cil', '#6b4a2b', [0, 0, 0.2], [0.025, 0.42, 0.025], [PI / 2, 0, 0]], ['cil', hx(R0.mazo), [0, 0, 0.42], [0.08, 0.24, 0.08], [0, 0, PI / 2]]]);
  }
  if (R0.visor) {
    const v = M(r.cabeza, 'caja', mat(R0.visor, { e: 0.6, op: 0.9 }), [0, 0.31 * H, 0.27 * H], [0.42 * H, 0.1 * H, 0.08 * H]);
    v.userData.sinFlash = true; fuera(v);
  }
  if (R0.llamas) {
    const m = mat(R0.llamas, { e: 1, op: 0.85 });
    for (const mano of [r.manoI, r.manoD]) {
      const g = piv(r, G(mano, [0, 0.02, 0]));
      M(g, 'cono', m, [0, 0, 0], [0.08, 0.24, 0.08]).userData.sinFlash = true;
      r.flamas.push(g);
    }
  }
  if (R0.capa) capa(r, R0.capa, T, 0.45);
  if (R0.corona) {
    const cg = ACC.corona(r, '#ffd84a');
    if (R0.gemas) for (const [x, c] of [[0, '#e11d48'], [-0.11, '#22d3ee'], [0.11, '#22d3ee']]) M(cg, 'esferaB', mat(c, { e: 0.6 }), [x * r.H, 0.1 * r.H, 0.19 * r.H], [0.035 * r.H, 0.035 * r.H, 0.02 * r.H]);
  }
  return tocado;
}
// Forma del duende: hombros redondos, pulgares, punteras de bota, boca con
// dientes y cejas picaras (como en las imagenes 2D).
function formaDuende(r, R0, lk, colorPelo) {
  for (const b of [r.bI, r.bD]) M(b, 'esfera', R0.ropa, [0, -0.01, 0], [0.1, 0.09, 0.1]);
  for (const [mano, lado] of [[r.manoI, 1], [r.manoD, -1]]) M(mano, 'esferaB', PIEL_DUENDE, [-lado * 0.05, 0.03, 0.04], [0.035, 0.05, 0.035]);
  for (const p of [r.pI, r.pD]) if (p) M(p, 'semi', R0.botas, [0, -0.45 + 0.02, 0.13], [0.09, 0.07, 0.1], [0, 0, 0]);
  const H = r.H, P2 = [];
  if (lk.cara !== 4) {
    P2.push(['caja', '#3a0f1f', [0, 0.1, 0.25], [0.19, 0.04, 0.02]]);
    for (const x of [-0.06, -0.02, 0.02, 0.06]) P2.push(['caja', '#fbf5e0', [x, 0.108, 0.258], [0.03, 0.022, 0.012]]);
    for (const x of [-1, 1]) P2.push(['caja', '#3a0f1f', [x * 0.115, 0.118, 0.236], [0.06, 0.03, 0.02], [0, 0, x * 0.55]]);
  }
  if (lk.cara === 5) for (const x of [-1, 1]) P2.push(['caja', hx(osc(colorPelo, 0.7)), [x * 0.1, 0.39, 0.236], [0.11, 0.025, 0.025], [0, 0, x * 0.32]]);
  fuera(MF(r.cabeza, P2, null, null, null, H));
}
// Complexion: ancho de hombros, barriga y grosor de brazos y piernas.
const CUERPOS = [
  { ancho: 0.8, panza: 0.78, grueso: 0.75 },   // Delgado
  { ancho: 1, panza: 1, grueso: 1 },           // Normal
  { ancho: 1.2, panza: 1.42, grueso: 1.32 },   // Robusto
];
// look = { cara 0-5, cuerpo 0-2, altura 0.9-1.12, pelo 0-7, colorPelo (indice) }
export function crearDuende({ skin = 'comun', clase = null, arma = 'katana', look = null } = {}) {
  const sk = SKINS[skin] || SKINS.comun;
  const cl = clase && CLASES[clase] ? clase : null;
  const lk = limpiarLook(look || LOOK_BASE);
  const brilla = !!(sk.premium || skin === 'legendaria');
  // Ropa segun la imagen de la skin; las premium (heroe teñido) en su color con neon.
  const R0 = ROPA_SKIN[SKINS[skin] ? skin : 'comun'] || {
    ropa: sk.color, pantalon: hx(osc(sk.color, 0.45)), botas: '#26222e', acento: hx(mez(sk.color, '#ffffff', 0.55)), neon: sk.color, hombreras: true,
  };
  const ropa = R0.ropa;
  const r = nuevoRig('bipedo');
  const cpo = CUERPOS[lk.cuerpo] || CUERPOS[1];
  humano(r, {
    piel: PIEL_DUENDE, ropa, ropaMat: mat(ropa, brilla ? { e: 0.3 } : null),
    pantalon: R0.pantalon, botas: R0.botas, cinto: R0.cinto || '#3a2412',
    cabeza: 'duende', ojos: 'duende', ojosGrandes: lk.cara === 5, nariz: lk.cara === 5 ? 'bola' : 'gancho', orejas: 0.56, orejaRot: 1.38, manoG: 1.18, cab: 1.18, L: 0.45, T: 0.46, A: 0.38,
    ancho: cpo.ancho, panza: cpo.panza, grueso: cpo.grueso,
  });
  const cc = cl ? CLASES[cl].color : ropa;
  // Sin clase no lleva nada en la cabeza: se ve el peinado entero.
  let tocado = '';
  if (cl === 'guerrero') { ACC.casco(r, '#9aa3ad', '#efe6cf'); escudo(r.manoI, '#7a4a26', 'redondo', null); tocado = 'casco'; }
  else if (cl === 'mago') { ACC.sombrero(r, osc(cc, 0.75), 0.8); tocado = 'sombrero'; }
  else if (cl === 'sacerdote') { ACC.capucha(r, '#f2efe6'); ACC.halo(r); tocado = 'capucha'; }
  else if (cl === 'picaro') { ACC.capucha(r, '#3d3550'); ACC.mascara(r); tocado = 'capucha'; }
  if (cl === 'guerrero') r.escudo = true;
  tocado = vestirSkin(r, R0, cpo, tocado);
  // Pelo y rasgos de la cara (una malla cada uno, fuera de la medida de alto).
  const colorPelo = hx(APARIENCIA.colorPelo[lk.colorPelo] || APARIENCIA.colorPelo[1]);
  const pelo = tocado === 'peluca' ? [] : partesPelo(lk.pelo, tocado);
  if (pelo.length) fuera(MF(r.cabeza, pelo, colorPelo, null, null, r.H));
  const cara = partesCara(lk.cara, colorPelo);
  if (cara.length) fuera(MF(r.cabeza, cara, null, null, null, r.H));
  formaDuende(r, R0, lk, colorPelo);
  // Arma: los de vara (mago, sacerdote) llevan baston.
  if (cl && CLASES[cl].basico === 'vara') baston(r, r.manoD, cl === 'sacerdote' ? '#fff3b0' : cc);
  else if (arma === 'dagas') {
    espada(r.manoD, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color });
    espada(r.manoI, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color });
    r.dosArmas = true;
  } else if (arma === 'odachi') espada(r.manoD, { largo: 1.25, hoja: '#ffffff', guarda: '#2b2b2b' });
  else if (arma === 'chispa') espada(r.manoD, { largo: 0.8, hoja: ARMAS.chispa.color, e: 0.9, guarda: '#1e3a5f' });
  else if (R0.hojaNeon) espada(r.manoD, { largo: 0.95, hoja: R0.hojaNeon, e: 0.9, guarda: '#ff3cf0' });
  else espada(r.manoD, { largo: 0.75, guarda: ARMAS.katana.color });
  if (brilla) auraSuelo(r, sk.color, 0.55);
  const m = new Modelo(r, 1.75 * lk.altura, 'd:' + JSON.stringify([skin, cl, arma, Object.assign({}, lk, { altura: 0 })]));
  m.tipo = 'duende';
  m.look = lk;
  return m;
}

// ── PELO (unidades de cabeza: centro (0, .26, 0), radios .3/.28/.28) ──
// tocado: 'gorra' | 'casco' | 'sombrero' | 'capucha'. Con tocado solo se
// pone lo que asoma por debajo (nuca, coleta, melena, rastas, puntas).
// Pua que sale de la cabeza en la direccion (theta desde arriba, phi: 0 = atras).
const _arriba = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _eu = new THREE.Euler(), _qq = new THREE.Quaternion();
function puaPelo(P, th, ph, rad, largo, ancho = 0.07, dy = 0) {
  _dir.set(Math.sin(th) * Math.sin(ph), Math.cos(th), -Math.sin(th) * Math.cos(ph));
  _qq.setFromUnitVectors(_arriba, _dir);
  _eu.setFromQuaternion(_qq);
  const r3 = v => Math.round(v * 1000) / 1000;
  P.push(['cono4', null, [r3(_dir.x * rad), r3(0.26 + dy + _dir.y * rad), r3(_dir.z * rad)], [ancho, largo, ancho], [r3(_eu.x), r3(_eu.y), r3(_eu.z)]]);
}
function partesPelo(estilo, tocado) {
  const P = [];
  const libre = tocado === 'gorra' ? false : !tocado;
  const capu = tocado === 'capucha', casco = tocado === 'casco', sombrero = tocado === 'sombrero';
  // Nuca: punto de la cabeza por donde asoma el pelo bajo el tocado.
  const ny = capu ? 0.1 : casco ? 0.2 : 0.27, nz = capu ? -0.38 : casco ? -0.31 : -0.29;
  // Casquete inclinado: alto por delante (deja ver los ojos) y bajo por la nuca.
  const casquete = () => { if (libre) P.push(['semi', null, [0, 0.33, -0.03], [0.32, 0.24, 0.31], [-0.35, 0, 0]]); };
  const nuca = (w = 0.36) => P.push(['esfera', null, [0, ny, nz + 0.03], [w * 0.7, 0.1, 0.08]]);
  switch (estilo) {
    case 1:   // Corto
      if (libre) { casquete(); P.push(['caja', null, [0, 0.46, 0.2], [0.36, 0.07, 0.12], [0.5, 0, 0]]); }
      else nuca();
      break;
    case 2:   // Cresta (atraviesa casco y gorra; con capucha o sombrero solo la nuca)
      if (capu || sombrero) { nuca(0.18); break; }
      for (let i = 0; i < 6; i++) {
        const a = -0.75 + i * 0.4, rr = libre ? 0.26 : 0.33, h = 0.3 - Math.abs(i - 2) * 0.03;
        P.push(['cono4', null, [0, Math.round((0.26 + rr * Math.cos(a)) * 1000) / 1000, Math.round(-rr * Math.sin(a) * 1000) / 1000], [0.045, h, 0.12], [-a, 0, 0]]);
      }
      break;
    case 3:   // Coleta
      casquete();
      if (!libre) nuca(0.24);
      P.push(['esferaB', null, [0, ny + 0.05, nz - 0.02], 0.075]);
      P.push(['cono', null, [0, ny + 0.05, nz - 0.03], [0.1, 0.55, 0.08], [-2.75, 0, 0]]);
      break;
    case 4:   // Melena
      casquete();
      P.push(['esfera', null, [0, libre ? 0.18 : ny - 0.02, libre ? -0.17 : nz + 0.05], [0.33, 0.32, 0.15]]);
      for (const x of [-1, 1]) P.push(['caja', null, [x * 0.27, capu ? 0.02 : 0.1, -0.02], [0.08, 0.32, 0.17]]);
      break;
    case 5:   // Moño
      casquete();
      if (libre) P.push(['esfera', null, [0, 0.6, -0.1], 0.15]);
      else { nuca(0.24); P.push(['esfera', null, [0, ny + 0.06, nz - 0.07], 0.14]); }
      break;
    case 6:   // Rastas
      casquete();
      for (let i = 0; i < 7; i++) {
        const a = -1.35 + i * 0.45, rr = capu ? 0.36 : 0.29;
        const x = Math.round(Math.sin(a) * rr * 1000) / 1000, z = Math.round((-Math.cos(a) * rr + (capu ? -0.03 : 0)) * 1000) / 1000;
        P.push(['cilT', null, [x, libre ? 0.32 : ny + 0.08, z], [0.04, 0.46, 0.04], [Math.round(Math.cos(a) * 25) / 100, 0, Math.round(Math.sin(a) * 25) / 100]]);
      }
      break;
    case 7:   // Puntas
      casquete();
      if (libre) {
        for (const [th, ph] of [[0.15, 0], [0.75, 0], [0.75, 1.25], [0.75, -1.25], [1.25, 0.55], [1.25, -0.55], [1.0, 2.3], [1.0, -2.3]]) puaPelo(P, th, ph, 0.27, 0.3);
      } else {
        const rad = capu ? 0.4 : 0.33, dy = ny - 0.26;
        for (const ph of [-1.45, -0.75, 0, 0.75, 1.45]) puaPelo(P, 1.7, ph, rad, 0.26, 0.08, dy);
        if (!capu) for (const x of [-1, 1]) puaPelo(P, 1.5, x * 2.2, rad, 0.2, 0.07, dy);    // mechones de delante
      }
      break;
  }
  return P;
}
// ── CARA (unidades de cabeza). Rasgos grandes para verlos de lejos. ──
function partesCara(cara, colorPelo) {
  const P = [];
  if (cara === 1) {          // Pecosa
    for (const x of [-1, 1]) for (const [px, py] of [[0.1, 0.2], [0.155, 0.215], [0.13, 0.17], [0.19, 0.18]])
      P.push(['esferaB', '#9a3b14', [x * px, py, Math.round((zCara(px, py) + 0.004) * 1000) / 1000], [0.03, 0.03, 0.014]]);
  } else if (cara === 2) {   // Cicatriz: tajo que cruza el ojo izquierdo, de la frente a la mejilla
    for (const [px, py, zz] of [[0.055, 0.45, 0], [0.085, 0.37, 0], [0.1, 0.3, 0.3], [0.13, 0.22, 0], [0.16, 0.14, 0]]) {
      P.push(['caja', '#9e1f33', [px, py, Math.max(zz, zCara(px, py) + 0.005)], [0.05, 0.1, 0.035], [0, 0, 0.38]]);
    }
    for (const [px, py] of [[0.07, 0.41], [0.145, 0.18]]) P.push(['caja', '#f2c6cc', [px, py, zCara(px, py) + 0.02], [0.11, 0.018, 0.02], [0, 0, 0.38]]);
  } else if (cara === 3) {   // Bigotes: mostacho de manillar que sobresale por los lados
    for (const x of [-1, 1]) {
      P.push(['esfera', colorPelo, [x * 0.12, 0.145, 0.25], [0.15, 0.045, 0.06], [0, 0, x * 0.3]]);
      P.push(['cono', colorPelo, [x * 0.25, 0.18, 0.2], [0.03, 0.12, 0.03], [0, 0, -x * 0.6]]);
    }
  } else if (cara === 4) {   // Barba: barba ancha y de patillas
    P.push(['esfera', colorPelo, [0, 0.11, 0.12], [0.28, 0.13, 0.19]]);
    P.push(['cono', colorPelo, [0, 0.07, 0.19], [0.2, 0.36, 0.11], [PI + 0.25, 0, 0]]);
    for (const x of [-1, 1]) P.push(['caja', colorPelo, [x * 0.27, 0.2, 0.02], [0.05, 0.2, 0.12]]);
  }
  return P;
}
// Profundidad de la cara (z de la superficie de la cabeza en x, y).
function zCara(x, y) {
  const k = 1 - (x / 0.3) ** 2 - ((y - 0.26) / 0.28) ** 2;
  return Math.round((k > 0 ? 0.28 * Math.sqrt(k) : 0) * 1000) / 1000;
}

// ═══════════ ARQUETIPOS DE MONSTRUOS ═══════════
// c = { k, color (tinte o null), jefe, e (brillo emisivo), amigo (NPC) }
// mc(c, defecto): material del color principal (tinte si lo hay).
const mc = (c, def, extra) => mat(c.color || def, c.e || extra ? { e: Math.max(c.e || 0, extra || 0) } : null);
const principal = (c, def) => c.color || def;

// ── GOBLINS ──
const GOB = {
  // Colores sacados de las hojas 2D (assets/enemigos/sheets/<hoja>.png).
  goblin_normal:     { piel: '#4f8a3c', ropa: '#8f8f8f', pantalon: '#784818', botas: '#8a8a8a' },
  goblin_samurai:    { piel: '#4f8a3c', ropa: '#cfcfcf', pantalon: '#a8a8a8', botas: '#6a6a6a' },
  goblin_mage:       { piel: '#4f8a3c', ropa: '#55489a', tunica: true },
  goblin_peasant:    { piel: '#4f8a3c', ropa: '#8a5a22', pantalon: '#6b3f14', botas: '#4a2a12', pelo: [1, '#5a3418'] },
  goblin_assassin:   { piel: '#4f8a3c', ropa: '#34347a', pantalon: '#26265a', botas: '#1a1a3a' },
  goblin_guard:      { piel: '#4f8a3c', ropa: '#9a9a9a', pantalon: '#7a7a7a', botas: '#5a5a5a', armadura: true },
  goblin_knight:     { piel: '#4f8a3c', ropa: '#b4b4b4', pantalon: '#808080', botas: '#5a5a5a', armadura: true, pelo: [7, '#6b3a1c'] },
  goblin_lord:       { piel: '#4f8a3c', ropa: '#9a9a9a', tunica: true, panza: 1.25 },
  goblin_centurion:  { piel: '#4f8a3c', ropa: '#c8904a', pantalon: '#9a6a30', botas: '#6b4a22', armadura: true },
  goblin_battlelord: { piel: '#4f8a3c', ropa: '#d8a848', pantalon: '#b07a38', botas: '#7a5226', ancho: 1.15, armadura: true },
};
function goblin(c, v) {
  const d = GOB[v] || GOB.goblin_normal, r = nuevoRig('bipedo');
  const ropa = principal(c, d.ropa), mr = mc(c, d.ropa);
  humano(r, {
    piel: d.piel, ropa, ropaMat: mr,
    pantalon: c.color ? osc(ropa, 0.7) : d.pantalon ?? osc(ropa, 0.6), botas: d.botas ?? '#3a2a1c', cinto: d.armadura || d.tunica ? null : '#3a2412',
    cabeza: 'goblin', ojos: c.amigo ? 'duende' : v === 'goblin_assassin' ? '#ffe14a' : '#ff3b2f',
    nariz: 'pico', orejas: 0.36, colmillos: !c.amigo, cab: 1.05, L: 0.42, T: 0.48, A: 0.4,
    panza: d.panza, ancho: d.ancho, tunica: d.tunica ? ropa : null, tunicaMat: d.tunica ? mr : null,
  });
  if (d.pelo) fuera(MF(r.cabeza, partesPelo(d.pelo[0], ''), d.pelo[1], null, null, r.H));
  switch (v) {
    case 'goblin_normal': garrote(r.manoD); break;
    case 'goblin_samurai': ACC.paja(r, '#7a4a1e'); espada(r.manoD, { largo: 0.8, guarda: '#2b2b2b', mango: '#2b2b2b' }); break;
    case 'goblin_mage': ACC.sombrero(r, osc(ropa, 0.85), 0.75); baston(r, r.manoD, '#c084fc'); break;
    case 'goblin_peasant': if (!c.amigo) horca(r.manoD); break;
    case 'goblin_assassin':
      ACC.capucha(r, osc(ropa, 0.85)); capa(r, osc(ropa, 0.7), 0.48, 0.42);
      espada(r.manoD, { largo: 0.32, daga: true }); espada(r.manoI, { largo: 0.32, daga: true }); r.dosArmas = true; r.paso = 11; break;
    case 'goblin_guard': ACC.casco(r, '#8d8d8d'); hombreras(r, '#b0b0b0'); lanzaA(r.manoD); if (c.amigo) escudo(r.manoI, '#2f6fd6', 'redondo', '#d7dde4'); break;
    case 'goblin_knight': hombreras(r, '#c8c8c8'); espada(r.manoD, { largo: 0.85 }); escudo(r.manoI, '#7a7a7a', 'rect', '#c8c8c8'); break;
    case 'goblin_lord': ACC.corona(r); maza(r.manoD); break;
    case 'goblin_centurion': ACC.romano(r, '#c69a3e', '#6b3a1c'); hombreras(r, '#d8a848'); espada(r.manoD, { largo: 0.5, ancho: 0.09 }); escudo(r.manoI, '#a51f26', 'rect', '#e8b923'); break;
    case 'goblin_battlelord': ACC.casco(r, '#d8a848'); ACC.corona(r, '#f0d878'); hombreras(r, '#c8903a', '#f0d878'); hacha(r.manoD, '#e0c070', '#4a3420', 1.3); r.tAtk = 0.45; break;
  }
  return r;
}

// ── ESQUELETOS ──
function esqueleto(c, conCapa) {
  const r = nuevoRig('bipedo');
  if (conCapa) {
    // Esqueleto Errante: cadaver encorvado de carne oscura con harapos rojos.
    const harapo = principal(c, '#7a1c2c'), carne = '#5a2a2a';
    humano(r, {
      piel: carne, ropa: '#3a1a1e', ropaMat: mc(c, '#3a1a1e'), pantalon: '#2a1216', botas: '#2a1216', manos: '#a07868', mangas: carne,
      cabeza: 'calavera', calavera: '#b89a8a', ojos: c.color ? mez(c.color, '#ffffff', 0.3) : '#ff4a3a',
      L: 0.48, T: 0.5, A: 0.5, encorvado: 0.35, grueso: 0.75,
    });
    capa(r, harapo, 0.5, 0.48);
    MF(r.cuerpo, [['cono', hx(harapo), [0.16, 0.12, 0.17], [0.05, 0.3, 0.03], [PI + 0.2, 0, 0.2]], ['cono', hx(harapo), [-0.12, 0.2, 0.18], [0.04, 0.26, 0.03], [PI - 0.1, 0, -0.2]]]);
    if (c.jefe) baston(r, r.manoD, c.color || '#ff4a3a');
    r.paso = 7;
  } else {
    const hueso = principal(c, '#efe9b8');
    humano(r, { piel: c.color ? mat(hueso, { e: c.e }) : hueso, huesos: true, cabeza: 'calavera', ojos: c.color ? mez(c.color, '#ffffff', 0.3) : '#3a3a30', L: 0.52, T: 0.5, A: 0.42, botas: hueso });
    espada(r.manoD, { largo: 0.7, hoja: '#9a8f7a', guarda: '#5b4a35' });
    r.paso = 8;
  }
  return r;
}

// ── FANTASMAS (flotan, sin piernas) ──
function fantasma(c, v) {
  const r = nuevoRig('flota'), R = r.raiz;
  r.caer = 'encoge';
  const cu = r.cuerpo = piv(r, G(R, [0, 0.62, 0]));
  r.cabeza = piv(r, G(cu, [0, 0.38, 0]));
  r.H = 0.9; r.topeCabeza = 0.46;
  const brazos = (m, largo = 0.32) => {
    for (const lado of [1, -1]) {
      const b = piv(r, G(cu, [0.36 * lado, 0.42, 0], [0, 0, 0.5 * lado]));
      M(b, 'cono', m, [0, 0, 0], [0.09, largo, 0.09], [PI, 0, 0]);
      if (lado > 0) r.bI = b; else r.bD = b;
    }
  };
  if (v === 'fantasma') {
    // Sombra negra con jirones magenta y cara de calavera palida.
    const negro = mat(principal(c, '#1e1424'), { op: 0.92 }), rosa = mat('#e0207a', { e: 0.8 });
    M(cu, 'esfera', negro, [0, 0.38, 0], [0.4, 0.46, 0.38]);
    const cola = r.cola = piv(r, G(cu, [0, 0.2, 0]));
    M(cola, 'cono', negro, [0, 0, -0.03], [0.37, 0.66, 0.35], [PI + 0.15, 0, 0]);
    M(cu, 'esfera', '#a898b0', [0, 0.42, 0.2], [0.24, 0.25, 0.2]);
    MF(cu, [['esferaB', '#1b1430', [-0.09, 0.46, 0.38], [0.065, 0.075, 0.03]], ['esferaB', '#1b1430', [0.09, 0.46, 0.38], [0.065, 0.075, 0.03]], ['esferaB', '#1b1430', [0, 0.33, 0.39], [0.05, 0.03, 0.02]]]);
    const j = piv(r, G(cu, [0, 0.4, 0]));
    MF(j, [['cono', null, [0.3, 0.3, -0.1], [0.05, 0.4, 0.05], [0, 0, -0.9]], ['cono', null, [-0.3, 0.3, -0.1], [0.05, 0.4, 0.05], [0, 0, 0.9]], ['cono', null, [0.1, 0.42, -0.2], [0.04, 0.32, 0.04], [-0.5, 0, -0.3]], ['cono', null, [0, -0.5, -0.25], [0.05, 0.35, 0.05], [-2.4, 0, 0]]], rosa).userData.sinFlash = true;
    r.flamas.push(j);
    brazos(rosa, 0.36);
  } else if (v === 'fantasma_halo') {
    // Alma Errante: encapuchado morado, resplandor cian y un farol.
    const tun = mat(principal(c, '#2a1a5c'), { op: 0.95 });
    M(cu, 'esfera', tun, [0, 0.38, 0], [0.38, 0.46, 0.36]);
    const cola = r.cola = piv(r, G(cu, [0, 0.2, 0]));
    M(cola, 'cono', tun, [0, 0, -0.03], [0.36, 0.7, 0.34], [PI + 0.12, 0, 0]);
    M(cu, 'semi', osc(principal(c, '#2a1a5c'), 0.7), [0, 0.5, -0.04], [0.36, 0.42, 0.36]);
    M(cu, 'esfera', '#0c0820', [0, 0.52, 0.18], [0.22, 0.22, 0.18]);
    MF(cu, [['esferaB', '#40f0ff', [-0.08, 0.54, 0.34], [0.045, 0.035, 0.02]], ['esferaB', '#40f0ff', [0.08, 0.54, 0.34], [0.045, 0.035, 0.02]]], mat('#40f0ff', { e: 1 }));
    const aura = M(cu, 'esfera', mat('#00c8e0', { aura: true, op: 0.1 }), [0, 0.25, 0], [0.6, 0.9, 0.56]);
    aura.userData.sinFlash = true; fuera(aura);
    brazos(tun);
    const farol = piv(r, G(r.bD, [0, -0.36, 0]));
    MF(farol, [['caja', '#3a2a1a', [0, 0.05, 0], [0.1, 0.03, 0.1]], ['caja', '#3a2a1a', [0, -0.09, 0], [0.1, 0.03, 0.1]]]);
    M(farol, 'icos', mat('#ff9a30', { e: 1 }), [0, -0.02, 0], 0.07).userData.sinFlash = true;
    r.brillo.push(farol);
  } else {
    // Espectro Marino: torso marron de ghoul sobre una cola de llamas azules.
    const llama = mat(principal(c, '#00a8f0'), { e: 0.8, op: 0.85 }), piel = '#7a4a30';
    const cola = r.cola = piv(r, G(cu, [0, 0.2, 0]));
    M(cola, 'cono', llama, [0, 0, -0.03], [0.42, 0.85, 0.38], [PI + 0.1, 0, 0]);
    const fl = piv(r, G(cu, [0, 0.12, 0]));
    MF(fl, [['cono', null, [0.25, 0, 0], [0.12, 0.35, 0.12], [0, 0, -0.5]], ['cono', null, [-0.25, 0, 0], [0.12, 0.35, 0.12], [0, 0, 0.5]], ['cono', null, [0, 0, -0.25], [0.12, 0.3, 0.12], [-0.5, 0, 0]]], llama).userData.sinFlash = true;
    r.flamas.push(fl);
    M(cu, 'esfera', piel, [0, 0.38, 0], [0.3, 0.34, 0.24]);
    M(cu, 'esfera', piel, [0, 0.78, 0.04], [0.19, 0.19, 0.18]);
    MF(cu, [['esferaB', '#7dfcff', [-0.07, 0.8, 0.19], [0.04, 0.03, 0.02]], ['esferaB', '#7dfcff', [0.07, 0.8, 0.19], [0.04, 0.03, 0.02]]], mat('#7dfcff', { e: 1 }));
    brazos(mat(piel), 0.4);
    r.topeCabeza = 0.6;
  }
  return r;
}

// ── HECHICERO (mago con tunica, barba y gran sombrero) ──
function hechicero(c) {
  const r = nuevoRig('bipedo');
  if (c.amigo) {
    const tun = '#2f5fb3';
    humano(r, {
      piel: '#e6c3a0', ropa: tun, ropaMat: mat(tun), tunica: tun, tunicaMat: mat(tun),
      cabeza: 'goblin', ojos: 'duende', nariz: 'pico', orejas: 0.18, cab: 1, L: 0.55, T: 0.55, A: 0.45,
    });
    ACC.barba(r, '#f2f2f2');
    ACC.sombrero(r, osc(tun, 0.75), 0.95);
    baston(r, r.manoD, '#a78bfa');
    r.paso = 7;
    return r;
  }
  const tun = principal(c, '#7a0a66'), mt = mc(c, tun);
  humano(r, {
    piel: '#24142a', ropa: tun, ropaMat: mt, tunica: tun, tunicaMat: mt, mangas: mt, manos: '#3a2a3a',
    cabeza: 'goblin', ojos: '#ff4af0', nariz: null, orejas: 0, cab: 1, L: 0.55, T: 0.55, A: 0.45,
  });
  ACC.capucha(r, osc(tun, 0.8));
  MF(r.cuerpo, [['toro', '#e8b923', [0, 0.5, 0.05], [0.17, 0.17, 0.12], [0.5, 0, 0]], ['esferaB', '#e8b923', [0, 0.34, 0.2], 0.04]]);
  const orbe = piv(r, G(r.manoD, [0, -0.06, 0.04]));
  M(orbe, 'icos', mat(c.color ? mez(c.color, '#ffffff', 0.3) : '#ff6af0', { e: 1 }), [0, 0, 0], 0.08).userData.sinFlash = true;
  r.brillo.push(orbe);
  r.paso = 7;
  return r;
}

// ── GHOUL ARDIENTE (encorvado y en llamas) ──
function ghoul(c) {
  const r = nuevoRig('bipedo'), piel = '#5a2030', fuego = principal(c, '#ff8a10');
  humano(r, {
    piel, ropa: piel, ropaMat: mat(piel, c.e ? { e: c.e } : null), pantalon: '#3a1420', botas: '#2a0e14',
    cabeza: 'nada', L: 0.5, T: 0.55, A: 0.62, ancho: 1.1, encorvado: 0.3, manoG: 1.3,
  });
  const g = piv(r, fuera(G(r.cabeza, [0, 0.22, 0])));
  M(g, 'icos', mat(fuego, { e: 1 }), [0, 0, 0], 0.3).userData.sinFlash = true;
  MF(g, [['cono', null, [0, 0.15, -0.12], [0.16, 0.45, 0.16], [-0.6, 0, 0]], ['cono', null, [0.15, 0.1, -0.05], [0.1, 0.32, 0.1], [-0.4, 0, -0.5]], ['cono', null, [-0.15, 0.1, -0.05], [0.1, 0.32, 0.1], [-0.4, 0, 0.5]]], mat('#ffd040', { e: 1 })).userData.sinFlash = true;
  MF(g, [['esferaB', '#3a0a00', [-0.1, 0.02, 0.26], [0.06, 0.05, 0.03]], ['esferaB', '#3a0a00', [0.1, 0.02, 0.26], [0.06, 0.05, 0.03]]]);
  r.flamas.push(g);
  // El alto se mide sin la llamarada: cuenta la bola de fuego como cabeza.
  M(r.cabeza, 'esferaB', mat(piel), [0, 0.2, 0], 0.22);
  r.topeCabeza = 0.5; r.H = 1;
  r.paso = 10;
  return r;
}

// ── COLOSO (gigante de hueso y piedra) ──
function coloso(c) {
  const r = nuevoRig('bipedo'), hueso = principal(c, '#dcdcdc'), mh = mc(c, '#dcdcdc');
  humano(r, {
    piel: hueso, ropa: hueso, ropaMat: mh, pantalon: mh, botas: osc(hueso, 0.7), mangas: mh, manos: hueso,
    cabeza: 'calavera', ojos: '#ff3a2a', cab: 0.75, L: 0.6, T: 0.75, A: 0.7, ancho: 1.5, grueso: 1.6, manoG: 1.7,
  });
  M(r.cuerpo, 'esfera', mat('#b01818', { e: 0.5 }), [0, 0.42, 0.14], [0.3, 0.27, 0.14]);
  const cost = [];
  for (const y of [0.3, 0.4, 0.5, 0.6]) cost.push(['caja', hx(hueso), [0, y, 0.25], [0.52, 0.035, 0.06]]);
  cost.push(['caja', hx(hueso), [0, 0.45, 0.27], [0.06, 0.4, 0.05]]);
  MF(r.cuerpo, cost);
  hombreras(r, osc(hueso, 0.8), '#f0eadc');
  r.paso = 5; r.tAtk = 0.5; r.hundir = 0.35;
  return r;
}

// ── ANGEL (alas de plumas, halo y espada) ──
function angel(c) {
  const r = nuevoRig('bipedo'), cuerpo = principal(c, '#c01830');
  humano(r, {
    piel: '#d84838', ropa: cuerpo, ropaMat: mc(c, cuerpo), tunica: cuerpo, tunicaMat: mc(c, cuerpo), botas: '#d89048', cinto: '#d89048',
    cabeza: 'goblin', ojos: '#ffd84a', nariz: null, orejas: 0.1, cab: 0.85, L: 0.6, T: 0.55, A: 0.45, ancho: 0.8,
  });
  fuera(MF(r.cabeza, partesPelo(4, ''), '#d89048', null, null, r.H));
  const mA = mat('#f4f4ff', { ds: true, e: 0.4 });
  for (const lado of [1, -1]) {
    const p = piv(r, fuera(G(r.cuerpo, [0.08 * lado, 0.42, -0.2], [0, lado * 0.35, 0])));
    M(p, 'pluma', mA, [0, 0, 0], [1.7 * lado, 1, 1.0], [-1.2, 0, lado * 0.5]);
    if (lado > 0) r.alaP = p; else r.alaN = p;
  }
  r.aleteo = 3; r.amplAla = 0.35; r.vuela = true;
  ACC.halo(r, '#ffe27a');
  espada(r.manoD, { largo: 0.95, hoja: '#ffd0a0', e: 0.6 });
  return r;
}

// ── COSA DEL PANTANO (encorvada, musgo colgando) ──
function cosa(c) {
  const r = nuevoRig('bipedo'), verde = principal(c, '#48a800'), m = mat(verde, { e: 0.12 + (c.e || 0) });
  humano(r, {
    piel: m, ropa: verde, ropaMat: m, pantalon: m, botas: osc(verde, 0.6), mangas: m, manos: m,
    cabeza: 'goblin', ojos: '#d8ff40', nariz: null, orejas: 0, cab: 0.95, L: 0.45, T: 0.55, A: 0.6, ancho: 1.3, encorvado: 0.35, manoG: 1.3,
  });
  const gota = hx('#90d800'), mg = mat('#90d800', { e: 0.25 });
  MF(r.cabeza, [['cono', gota, [0, 0.4, 0.05], [0.3, 0.38, 0.3], [PI, 0, 0]], ['cono', gota, [0.18, 0.15, 0.2], [0.05, 0.22, 0.05], [PI, 0, 0]], ['cono', gota, [-0.15, 0.12, 0.22], [0.04, 0.2, 0.04], [PI, 0, 0]]], mg);
  for (const b of [r.bI, r.bD]) MF(b, [['cono', gota, [0, -0.05, 0], [0.11, 0.35, 0.11], [PI, 0, 0]], ['cono', gota, [0, -0.5, 0.03], [0.04, 0.2, 0.04], [PI, 0, 0]]], mg);
  M(r.raiz, 'semi', '#2a7a10', [0, 0, 0], [0.5, 0.05, 0.45]);
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
  const r = nuevoRig('bipedo'), R = r.raiz, sombrero = principal(c, '#9a2018');
  r.bamboleo = true; r.paso = 8; r.caer = 'lado';
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.12 * s, 0.16, 0]));
    MF(p, [['cilT', '#8a7070', [0, 0, 0], [0.06, 0.1, 0.06]], ['esferaB', '#4a3434', [0, -0.12, 0.03], [0.08, 0.05, 0.1]]]);
    if (s > 0) r.pI = p; else r.pD = p;
  }
  const cu = r.cuerpo = piv(r, G(R, [0, 0.16, 0]));
  M(cu, 'tronco', '#7a6262', [0, 0, 0], [0.27, 0.44, 0.25]);
  MF(cu, [['esferaB', '#1b1414', [-0.08, 0.27, 0.19], [0.04, 0.06, 0.02]], ['esferaB', '#1b1414', [0.08, 0.27, 0.19], [0.04, 0.06, 0.02]]]);
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [0.22 * s, 0.2, 0], [0, 0, 0.5 * s]));
    M(b, 'cilT', '#8a7070', [0, 0, 0], [0.045, 0.15, 0.045]);
    if (s > 0) r.bI = b; else r.bD = b;
  }
  const cb = r.cabeza = piv(r, G(cu, [0, 0.38, 0]));
  M(cb, 'semi', mc(c, sombrero), [0, 0, 0], [0.5, 0.36, 0.5]);
  const P = [['cil', '#d8c8b0', [0, 0.01, 0], [0.48, 0.03, 0.48]]];
  for (const p of [[0, 0.35, 0], [0.29, 0.26, 0.15], [-0.25, 0.26, 0.21], [0.05, 0.26, -0.33], [-0.3, 0.2, -0.2]]) P.push(['esferaB', '#fff2e0', p, [0.08, 0.04, 0.08]]);
  MF(cb, P);
  r.H = 1; r.topeCabeza = 0.36;
  return r;
}

// ── BABA (cupula de gelatina que se aplasta) ──
function baba(c) {
  const r = nuevoRig('baba'), R = r.raiz, color = principal(c, '#f090a8');
  r.caer = 'nada'; r.hundir = 0.05;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'semi', mat(color, { op: 0.88, e: 0.15 + (c.e || 0) }), [0, 0, 0], [0.6, 0.66, 0.55]);
  M(cu, 'esfera', mez(color, '#ffffff', 0.45), [0.18, 0.5, 0.22], [0.12, 0.1, 0.1]);
  MF(cu, [['esferaB', '#1b1430', [-0.17, 0.42, 0.41], [0.05, 0.065, 0.03]], ['esferaB', '#1b1430', [0.12, 0.42, 0.44], [0.05, 0.065, 0.03]], ['esferaB', '#ffffff', [-0.16, 0.45, 0.435], 0.015], ['esferaB', '#a84860', [-0.02, 0.3, 0.5], [0.05, 0.02, 0.02]]]);
  M(cu, 'esfera', mez(color, '#ff5f8a', 0.4), [0.24, 0.66, 0], 0.09);
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.66;
  return r;
}

// ── RANA / SAPO ──
function rana(c) {
  const r = nuevoRig('salto'), R = r.raiz, verde = principal(c, '#1f7a52'), m = mc(c, verde);
  r.paso = 9; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.36, 0], [0.4, 0.3, 0.44], [-0.3, 0, 0]);
  M(cu, 'esfera', '#c8c048', [0, 0.32, 0.14], [0.32, 0.24, 0.3], [-0.3, 0, 0]);
  M(cu, 'esfera', m, [0, 0.52, 0.26], [0.32, 0.2, 0.26]);
  MF(cu, [
    ['esfera', hx(verde), [-0.16, 0.66, 0.28], 0.11], ['esfera', hx(verde), [0.16, 0.66, 0.28], 0.11],
    ['esferaB', '#1b1430', [-0.16, 0.68, 0.38], [0.06, 0.07, 0.03]], ['esferaB', '#1b1430', [0.16, 0.68, 0.38], [0.06, 0.07, 0.03]],
    ['toro', '#e8c040', [-0.16, 0.67, 0.37], [0.12, 0.12, 0.12], [PI / 2, 0, 0]], ['toro', '#e8c040', [0.16, 0.67, 0.37], [0.12, 0.12, 0.12], [PI / 2, 0, 0]],
    ['caja', '#e8c040', [0, 0.69, 0.4], [0.1, 0.02, 0.02]],
  ]);
  const lg = r.lengua = piv(r, G(cu, [0, 0.45, 0.5]));
  M(lg, 'cilT', '#ff6b9a', [0, 0, 0], [0.03, 0.08, 0.015], [-PI / 2, 0, 0]);
  const pata = hx(osc(verde, 0.75));
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.28 * s, 0.24, -0.18]));
    MF(p, [['esfera', hx(verde), [0, 0, 0], [0.13, 0.1, 0.24]], ['caja', pata, [0, -0.2, 0.12], [0.15, 0.04, 0.3]]]);
    const b = piv(r, G(R, [0.2 * s, 0.3, 0.28], [0.2, 0, 0]));
    MF(b, [['cilT', hx(verde), [0, 0, 0], [0.05, 0.27, 0.05]], ['esferaB', pata, [0, -0.28, 0.04], [0.07, 0.03, 0.09]]]);
    if (s > 0) { r.pI = p; r.bI = b; } else { r.pD = p; r.bD = b; }
  }
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.78;
  if (c.montura) silla(r, cu, [0, 0.62, -0.08], 0.26);
  return r;
}

// ── CONEJO ──
function conejo(c) {
  if (c.montura) return conejoMontura(c);
  const r = nuevoRig('bipedo'), R = r.raiz, pelo = principal(c, '#a03a1c'), m = mc(c, pelo), crema = '#f0d878';
  r.paso = 11;
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.12 * s, 0.38, 0]));
    MF(p, [['cilT', hx(pelo), [0, 0, 0], [0.075, 0.3, 0.075]], ['caja', '#c09048', [0, -0.34, 0.08], [0.13, 0.08, 0.3]]]);
    if (s > 0) r.pI = p; else r.pD = p;
  }
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  M(cu, 'esfera', m, [0, 0.25, 0], [0.24, 0.3, 0.2]);
  M(cu, 'esfera', crema, [0, 0.24, 0.12], [0.17, 0.22, 0.1]);
  M(cu, 'esfera', '#f4f4f4', [0, 0.1, -0.2], 0.08);
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [0.25 * s, 0.42, 0], [0, 0, 0.15 * s]));
    MF(b, [['cilT', hx(pelo), [0, 0, 0], [0.05, 0.28, 0.05]], ['esferaB', crema, [0, -0.3, 0], 0.065]]);
    const mano = G(b, [0, -0.3, 0]);
    if (s > 0) { r.bI = b; r.manoI = mano; } else { r.bD = b; r.manoD = mano; }
  }
  espada(r.manoD, { largo: 0.32, daga: true, hoja: '#5aa0ff', guarda: '#2b4a8a', e: 0.4 });
  const cb = r.cabeza = piv(r, G(cu, [0, 0.56, 0]));
  M(cb, 'esfera', m, [0, 0.14, 0], [0.2, 0.19, 0.2]);
  MF(cb, [
    ['esfera', crema, [0, 0.08, 0.16], [0.1, 0.07, 0.07]], ['esferaB', '#ff9fb2', [0, 0.12, 0.23], 0.03],
    ['esferaB', '#1b1430', [-0.08, 0.18, 0.16], [0.03, 0.04, 0.02]], ['esferaB', '#1b1430', [0.08, 0.18, 0.16], [0.03, 0.04, 0.02]],
    ['esfera', hx(pelo), [-0.08, 0.5, -0.02], [0.06, 0.32, 0.04], [0, 0, 0.2]], ['esfera', hx(pelo), [0.08, 0.5, -0.02], [0.06, 0.32, 0.04], [0, 0, -0.2]],
    ['esfera', '#d8584a', [-0.08, 0.5, 0.01], [0.035, 0.26, 0.02], [0, 0, 0.2]], ['esfera', '#d8584a', [0.08, 0.5, 0.01], [0.035, 0.26, 0.02], [0, 0, -0.2]],
  ]);
  r.H = 1; r.topeCabeza = 0.34;
  return r;
}
function conejoMontura(c) {
  const r = nuevoRig('salto'), R = r.raiz, pelo = principal(c, '#b08968'), m = mc(c, pelo);
  r.paso = 10; r.caer = 'lado'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.38, -0.05], [0.3, 0.3, 0.42]);
  M(cu, 'esfera', '#ffffff', [0, 0.42, -0.46], 0.1);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.62, 0.28]));
  M(cb, 'esfera', m, [0, 0, 0], [0.21, 0.2, 0.23]);
  MF(cb, [
    ['esfera', hx(pelo), [-0.08, 0.32, -0.02], [0.06, 0.3, 0.035], [-0.15, 0, 0.15]], ['esfera', hx(pelo), [0.08, 0.32, -0.02], [0.06, 0.3, 0.035], [-0.15, 0, -0.15]],
    ['esferaB', '#1b1430', [-0.13, 0.05, 0.15], 0.04], ['esferaB', '#1b1430', [0.13, 0.05, 0.15], 0.04], ['esferaB', '#ff9fb2', [0, -0.02, 0.23], 0.035],
  ]);
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.2 * s, 0.22, -0.15]));
    MF(p, [['esfera', hx(pelo), [0, 0, 0], [0.1, 0.16, 0.2]], ['caja', hx(osc(pelo, 0.85)), [0, -0.19, 0.06], [0.1, 0.06, 0.34]]]);
    const b = piv(r, G(R, [0.12 * s, 0.3, 0.22]));
    M(b, 'cilT', m, [0, 0, 0], [0.045, 0.28, 0.045]);
    if (s > 0) { r.pI = p; r.bI = b; } else { r.pD = p; r.bD = b; }
  }
  r.H = 1; r.topeCabeza = 0.6;
  silla(r, cu, [0, 0.67, -0.12], 0.24);
  return r;
}

// ── SALTARIN ABISAL (pez-sapo de las profundidades con farolillo) ──
function saltador(c) {
  const r = nuevoRig('salto'), R = r.raiz, oro = principal(c, '#c07a20'), m = mc(c, oro);
  r.paso = 9; r.caer = 'panza'; r.hundir = 0.5; r.aleteo = 9; r.amplAla = 0.3;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.48, -0.05], [0.34, 0.3, 0.4]);
  MF(cu, [
    ['esfera', '#d89030', [0, 0.52, 0.32], [0.2, 0.18, 0.16]], ['caja', '#7a4a10', [0, 0.62, -0.05], [0.025, 0.04, 0.7]],
    ['cono', '#7a4a10', [-0.08, 0.5, 0.45], [0.025, 0.14, 0.025], [1.3, 0, 0.3]], ['cono', '#7a4a10', [0.08, 0.5, 0.45], [0.025, 0.14, 0.025], [1.3, 0, -0.3]],
  ]);
  const gema = piv(r, G(cu, [0, 0.56, 0.47]));
  M(gema, 'icos', mat('#3a8bff', { e: 0.9 }), [0, 0, 0], 0.07).userData.sinFlash = true;
  r.brillo.push(gema);
  ojos(cu, '#ffe14a', 0.11, 0.6, 0.44, 0.03);
  const hoja = mat('#2f8a1c', { e: 0.1 });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.3 * s, 0.4, -0.02], [0, 0, -0.25 * s]));
    M(p, 'cono', hoja, [0, 0, 0], [0.12, 0.65, 0.04]);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  const pt = hx(osc(oro, 0.7));
  for (const s of [1, -1]) {
    const pa = piv(r, G(R, [0.22 * s, 0.25, -0.1]));
    MF(pa, [['esfera', pt, [0, 0, 0], [0.1, 0.16, 0.18]], ['caja', pt, [0, -0.2, 0.08], [0.12, 0.05, 0.28]]]);
    if (s > 0) r.pI = pa; else r.pD = pa;
  }
  r.cabeza = cu; r.H = 1; r.topeCabeza = 0.78;
  return r;
}

// ── SERPIENTE ──
function serpiente(c) {
  const largoMax = 2.0;
  const r = nuevoRig('serpiente'), R = r.raiz, piel = principal(c, '#0a7860');
  r.caer = 'lado'; r.hundir = 0.3;
  const m1 = mc(c, piel), m2 = mat('#c0a818');
  const n = 7;
  for (let i = 0; i < n; i++) {
    const ra = 0.15 * (1 - i * 0.09);
    r.segs.push(piv(r, M(R, 'esfera', i % 2 ? m2 : m1, [0, ra * 0.85, 0.1 - i * 0.22], [ra, ra * 0.85, ra * 1.3])));
  }
  r.segs.push(piv(r, M(R, 'cono', m1, [0, 0.05, 0.12 - n * 0.22], [0.05, 0.28, 0.05], [-PI / 2, 0, 0])));
  const cb = r.cabeza = piv(r, G(R, [0, 0.12, 0.2]));
  MF(cb, [['esfera', hx(piel), [0, 0.2, 0.02], [0.11, 0.28, 0.11], [0.15, 0, 0]], ['esfera', '#c0a818', [0, 0.2, 0.08], [0.07, 0.24, 0.06], [0.15, 0, 0]]]);
  const h = G(cb, [0, 0.5, 0.1]);
  M(h, 'esfera', m1, [0, 0, 0.06], [0.17, 0.12, 0.22]);
  ojos(h, '#ffd84a', 0.09, 0.05, 0.17, 0.035);
  const mj = r.mandibula = piv(r, G(h, [0, -0.06, 0.02]));
  M(mj, 'caja', m2, [0, 0, 0.1], [0.14, 0.03, 0.2]);
  const lg = r.lengua = piv(r, G(h, [0, -0.03, 0.26]));
  M(lg, 'cilT', '#e0245e', [0, 0, 0], [0.012, 0.12, 0.006], [-PI / 2, 0, 0]);
  r.H = 0.6; r.topeCabeza = 0.6; r.largoMax = largoMax;
  return r;
}

// ── LAGARTO ──
function lagarto(c) {
  const largoMax = 2.0;
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#b01890'), m = mc(c, piel);
  const alza = c.montura ? 0.3 : 0;
  r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.32 + alza, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.28, 0.18, 0.6]);
  M(cu, 'esfera', mez(piel, '#ffb0e0', 0.45), [0, -0.06, 0.05], [0.22, 0.12, 0.5]);
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
  const r = nuevoRig('cuadrupedo'), R = r.raiz, pelo = principal(c, '#34508a'), m = mc(c, pelo);
  r.paso = 12; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.4;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.25, 0.22, 0.45]);
  M(cu, 'esfera', '#90c0c0', [0, -0.07, 0.1], [0.18, 0.13, 0.3]);
  // Cabeza celeste con la boca abierta (dientes) y orejas rosas, como en la hoja 2D.
  const cb = r.cabeza = piv(r, G(cu, [0, 0.08, 0.42]));
  M(cb, 'esfera', '#90c0c0', [0, 0, 0.05], [0.15, 0.14, 0.18]);
  MF(cb, [
    ['cono', '#90c0c0', [0, 0.01, 0.18], [0.07, 0.18, 0.07], [PI / 2, 0, 0]], ['esferaB', '#ff9fb2', [0, 0.01, 0.37], 0.035],
    ['esfera', '#b04898', [-0.1, 0.13, 0], [0.06, 0.07, 0.02]], ['esfera', '#b04898', [0.1, 0.13, 0], [0.06, 0.07, 0.02]],
    ['caja', '#5a1830', [0, -0.07, 0.2], [0.09, 0.03, 0.12]],
    ['cono4', '#ffffff', [-0.035, -0.06, 0.27], [0.015, 0.05, 0.015], [PI, 0, 0]], ['cono4', '#ffffff', [0.035, -0.06, 0.27], [0.015, 0.05, 0.015], [PI, 0, 0]],
  ]);
  ojos(cb, '#1b1430', 0.07, 0.05, 0.17, 0.028, false);
  const cola = r.cola = piv(r, G(cu, [0, 0, -0.42]));
  M(cola, 'cono', '#b04898', [0, 0, 0], [0.045, 0.75, 0.045], [-1.75, 0, 0]);
  cuatroPatas(r, 0.17, 0.32, 0.25, -0.25, 0.3, 0.05, mat('#24385f'), '#1a2848');
  r.lomo = cu; r.H = 0.6; r.largoMax = largoMax;
  return r;
}

// ── SABUESO INFERNAL ──
function hellhound(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#161016'), m = mc(c, piel);
  const fuego = mat('#ff6a1a', { e: 1 });
  r.paso = 9; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.25;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.82, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.3, 0.3, 0.66]);
  M(cu, 'esfera', m, [0, 0.06, 0.38], [0.32, 0.34, 0.34]);
  if (!c.montura) puas(cu, fuego, [[0, 0.32, 0.25], [0, 0.3, -0.05], [0, 0.26, -0.35]]);
  // Rayas rojas de brasa a los lados (las costillas de la hoja 2D).
  const rayas = [];
  for (const s of [-1, 1]) for (const z of [0.32, 0.12, -0.08, -0.28]) rayas.push(['caja', null, [s * 0.285, 0.02, z], [0.03, 0.34, 0.05], [0, 0, s * 0.25]]);
  MF(cu, rayas, mat('#c83a08', { e: 0.6 }));
  const cb = r.cabeza = piv(r, G(cu, [0, 0.25, 0.72]));
  M(cb, 'esfera', m, [0, 0, 0], [0.2, 0.19, 0.24]);
  M(cb, 'caja', m, [0, -0.04, 0.25], [0.15, 0.12, 0.22]);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.1, 0.12]));
  M(mj, 'caja', osc(piel, 0.7), [0, 0, 0.12], [0.14, 0.05, 0.25]);
  for (const s of [-1, 1]) M(cb, 'cono4', m, [s * 0.12, 0.15, -0.05], [0.06, 0.18, 0.04], [0, 0, -s * 0.3]);
  ojos(cb, '#ff2a2a', 0.1, 0.06, 0.2, 0.04);
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
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#3a1c66'), m = mc(c, piel);
  r.paso = 11; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.35;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.62, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.22, 0.22, 0.6]);
  // Rayas violeta del lomo (hoja 2D: pantera morada con vetas claras).
  MF(cu, [0.35, 0.12, -0.12, -0.35].map(z => ['caja', null, [0, 0.19, z], [0.3, 0.04, 0.06], [0, 0, 0]]), mat('#9018a8', { e: 0.3 }));
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
    // Pajaro Hueso: paloma blanca crema con cresta gris.
    pajaro:     { cuerpo: '#efdcc4', cabeza: '#f4e6d2', pico: '#9a9a9a', ojo: '#3a2a20', ala: '#e8d8c0', geo: 'pluma', env: 0.75, aleteo: 12 },
    // Aguila de Tormenta: morado oscuro, alas malva, cabeza gris clara y pico amarillo.
    aguila:     { cuerpo: '#3a1c34', cabeza: '#d8d8d8', pico: '#d8a848', ojo: '#ffb020', ala: '#603048', geo: 'pluma', env: 1.05, aleteo: 7 },
    // Murcielago: bola gris azulada con un gran ojo rojo y alas pardo rojizas.
    murcielago: { cuerpo: '#303048', cabeza: '#303048', pico: null, ojo: '#ff2a2a', ala: '#a84830', geo: 'ala', env: 0.85, aleteo: 15 },
  }[v];
  const piel = principal(c, D.cuerpo), m = mc(c, piel);
  r.vuela = true; r.aleteo = D.aleteo; r.amplAla = v === 'murcielago' ? 0.8 : 0.6; r.caer = 'lado'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.35, 0]));
  if (v === 'murcielago') {
    M(cu, 'esfera', m, [0, 0.08, 0], [0.26, 0.26, 0.24]);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.08, 0]));
    MF(cb, [
      ['esfera', '#f0e8e0', [0, 0.06, 0.2], [0.12, 0.12, 0.06]], ['esferaB', '#c01818', [0, 0.06, 0.25], [0.07, 0.08, 0.03]], ['esferaB', '#1b1430', [0, 0.06, 0.27], [0.03, 0.04, 0.02]],
      ['cono', '#f4efd8', [-0.06, -0.1, 0.2], [0.02, 0.08, 0.02], [PI, 0, 0]], ['cono', '#f4efd8', [0.06, -0.1, 0.2], [0.02, 0.08, 0.02], [PI, 0, 0]],
      ['cono4', hx(piel), [-0.12, 0.26, 0], [0.06, 0.18, 0.04], [0, 0, 0.3]], ['cono4', hx(piel), [0.12, 0.26, 0], [0.06, 0.18, 0.04], [0, 0, -0.3]],
    ]);
  } else {
    M(cu, 'esfera', m, [0, 0, 0], [0.2, 0.2, 0.3]);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.18, 0.26]));
    M(cb, 'esfera', c.color && v === 'pajaro' ? m : D.cabeza, [0, 0, 0], 0.13);
    if (v === 'pajaro') M(cb, 'cono', '#8a8a8a', [0, 0.1, -0.04], [0.04, 0.2, 0.06], [-0.6, 0, 0]);
    const mj = r.mandibula = piv(r, G(cb, [0, -0.02, 0.1]));
    M(mj, 'cono', D.pico, [0, 0, 0], [0.05, v === 'aguila' ? 0.16 : 0.18, 0.05], [PI / 2 + 0.25, 0, 0]);
    ojos(cb, D.ojo, 0.065, 0.03, 0.1, 0.028, v === 'aguila');
  }
  const mAla = mat(c.color && v !== 'pajaro' ? osc(c.color, 0.8) : D.ala, { ds: true });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.16 * s, 0.1, 0.02], [0, 0, 0.15 * s]));
    M(p, D.geo, mAla, [0, 0, 0], [D.env * s, 1, D.env * 0.6]);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  if (v !== 'murcielago') M(cu, 'caja', mAla, [0, 0.02, -0.34], [0.2, 0.02, 0.2], [-0.3, 0, 0]);
  const pie = v === 'murcielago' ? '#1b1b2b' : v === 'aguila' ? '#d8a848' : '#9a9a9a';
  for (const s of [-1, 1]) {
    const p = piv(r, G(cu, [0.07 * s, -0.15, 0]));
    MF(p, [['cilT', pie, [0, 0, 0], [0.02, 0.16, 0.02]], ['esferaB', pie, [0, -0.17, 0.03], [0.04, 0.015, 0.05]]]);
    r.patas.push([p, 0, 'x', false]);
  }
  if (c.montura) silla(r, cu, [0, v === 'murcielago' ? 0.32 : 0.19, -0.04], 0.16);
  r.lomo = cu; r.H = 0.5; r.topeCabeza = 0.15;
  return r;
}

// ── ARAÑA ──
function arana(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, abd = principal(c, '#c0a830'), m = mc(c, abd);
  r.paso = 13; r.ampPatas = 0.6; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.42, -0.42], [0.42, 0.34, 0.5]);
  M(cu, 'esferaB', '#780030', [0, 0.74, -0.42], [0.14, 0.04, 0.2]);
  M(cu, 'esfera', '#484848', [0, 0.32, 0.12], [0.26, 0.2, 0.28]);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.34, 0.3]));
  MF(cb, [['esferaB', '#ff2a2a', [-0.07, 0.06, 0.06], 0.045], ['esferaB', '#ff2a2a', [0.07, 0.06, 0.06], 0.045], ['esferaB', '#ff2a2a', [-0.13, 0.03, 0.02], 0.03], ['esferaB', '#ff2a2a', [0.13, 0.03, 0.02], 0.03]], mat('#ff2a2a', { e: 1 }));
  for (const s of [-1, 1]) {
    const f = piv(r, G(cb, [s * 0.05, -0.08, 0.08]));
    M(f, 'cono', '#1b1414', [0, 0, 0], [0.025, 0.12, 0.025], [PI - 0.2, 0, 0]);
    r.pinzas.push(f);
  }
  const rojo = hx(c.color ? osc(c.color, 0.7) : '#c01830');
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
    const a = -0.75 + i * 0.5, giro = s > 0 ? a : PI - a;
    const p = piv(r, G(R, [s * 0.16, 0.32, 0.22 - i * 0.1], [0, giro, 0]));
    MF(p, [['cilT', rojo, [0, 0, 0], [0.035, 0.4, 0.035], [0, 0, 2.09]], ['cilT', '#d0d0d0', [0.35, 0.2, 0], [0.028, 0.56, 0.028], [0, 0, 0.367]]]);
    r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i < 2]);
  }
  r.lomo = cu; r.H = 0.6; r.topeCabeza = 0.18;
  return r;
}

// ── CANGREJO ──
function cangrejo(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, carne = principal(c, '#8a0a8a'), m = mc(c, carne);
  r.paso = 12; r.ampPatas = 0.5; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.42, 0.2, 0.34]);
  const concha = [['semi', '#3a5ab8', [0, 0.06, -0.06], [0.4, 0.34, 0.34]]];
  for (const [x, z, h] of [[0, -0.05, 0.3], [0.2, 0.0, 0.22], [-0.2, 0.0, 0.22], [0.1, -0.25, 0.22], [-0.1, -0.25, 0.22], [0, 0.18, 0.18]]) {
    concha.push(['cono4', '#6090d8', [x, 0.2 + (0.3 - h) * 0.3, z], [0.07, h + 0.12, 0.07], [-z * 0.8, 0, -x * 1.5]]);
  }
  MF(cu, concha);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.1, 0.26]));
  MF(cb, [['cil', hx(carne), [-0.1, 0.06, 0], [0.02, 0.14, 0.02]], ['cil', hx(carne), [0.1, 0.06, 0], [0.02, 0.14, 0.02]], ['esferaB', '#ffe14a', [-0.1, 0.15, 0], 0.045], ['esferaB', '#ffe14a', [0.1, 0.15, 0], 0.045], ['esferaB', '#2a0020', [0, -0.07, 0.06], [0.1, 0.04, 0.03]]]);
  const pinza = hx(c.color ? c.color : '#a80078');
  for (const s of [1, -1]) {
    const brazo = piv(r, G(cu, [s * 0.36, 0, 0.18], [0, s * 0.5, 0]));
    MF(brazo, [['cilT', pinza, [0, 0, 0], [0.05, 0.25, 0.05], [-PI / 2, 0, 0]], ['caja', pinza, [0, 0.03, 0.36], [0.15, 0.11, 0.21]]]);
    const inf = piv(r, G(brazo, [0, -0.02, 0.28]));
    M(inf, 'caja', mat(pinza), [0, -0.04, 0.09], [0.1, 0.05, 0.18]);
    r.pinzas.push(inf);
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5, giro = s > 0 ? a : PI - a;
      const p = piv(r, G(R, [s * 0.3, 0.36, 0.08 - i * 0.14], [0, giro, 0]));
      M(p, 'cilT', pinza, [0, 0, 0], [0.03, 0.53, 0.03], [0, 0, 0.85]);
      r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i === 0]);
    }
  }
  r.lomo = cu; r.H = 0.6; r.topeCabeza = 0.32;
  return r;
}

// ── PECES ──
function pez(c, v) {
  const r = nuevoRig('pez'), R = r.raiz;
  const D = {
    pez:        { piel: '#8a1840', panza: '#c03048', cu: [0.2, 0.28, 0.4], aleta: '#c05a20', ojo: '#ffd84a' },
    pez_dardo:  { piel: '#a85a20', panza: '#d87848', cu: [0.09, 0.11, 0.45], aleta: '#d87848', ojo: '#fff06a' },
    pez_grande: { piel: '#183048', panza: '#184860', cu: [0.42, 0.42, 0.5], aleta: '#2a9a48', ojo: '#ff3030' },
  }[v];
  const piel = principal(c, D.piel), m = mc(c, piel), mA = mat(c.color && v !== 'pez_grande' ? osc(c.color, 0.7) : D.aleta, { ds: true });
  const [sx, sy, sz] = D.cu;
  r.caer = 'panza'; r.hundir = 0.3; r.colaAmp = 0; r.vuela = true;
  const cu = r.cuerpo = piv(r, G(R, [0, sy + 0.05, 0]));
  M(cu, 'esfera', m, [0, 0, 0], D.cu);
  M(cu, 'esfera', D.panza, [0, -sy * 0.35, sz * 0.15], [sx * 0.75, sy * 0.6, sz * 0.7]);
  M(cu, 'aleta', mA, [0, sy * 0.75, sz * 0.25], [1, sy * 0.8, sz * 0.75]);
  const cola = r.cola = piv(r, G(cu, [0, 0, -sz * 0.92]));
  M(cola, 'colaPez', mA, [0, 0, 0], [1, sy * 0.9, sz * 0.6]);
  ojos(cu, D.ojo, sx * 0.6, sy * 0.3, sz * 0.72, Math.max(0.03, sx * 0.18));
  r.aletas = [];
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [sx * 0.9 * s, -sy * 0.2, sz * 0.2]));
    M(p, 'caja', mA, [s * sx * 0.3, 0, 0], [sx * 0.6, 0.01, sz * 0.25]);
    r.aletas.push(p);
  }
  if (v === 'pez_dardo') M(cu, 'cono', m, [0, 0, sz * 0.9], [0.025, 0.35, 0.025], [PI / 2, 0, 0]);
  else {
    const mj = r.mandibula = piv(r, G(cu, [0, -sy * 0.3, sz * 0.7]));
    const P = [['caja', hx(osc(piel, 0.8)), [0, -0.01, sz * 0.12], [sx * 0.7, sy * 0.18, sz * 0.35]]];
    for (const x of v === 'pez_grande' ? [-0.2, -0.07, 0.07, 0.2] : [-0.04, 0.04]) P.push(['cono4', '#f4efd8', [x, sy * 0.06, sz * 0.25], [0.025 + sx * 0.04, sy * 0.15, 0.025]]);
    MF(mj, P);
  }
  // Pez Ogro: cresta de puas verdes en el lomo (en todos, no solo en el jefe).
  if (v === 'pez_grande') MF(cu, [[0.2, 0.3], [-0.05, 0.36], [-0.3, 0.26]].map(([z, h]) => ['cono4', '#2a9a48', [0, sy * 0.9, z], [0.06, h, 0.1], [-0.4, 0, 0]]));
  r.cabeza = cu; r.H = 0.6; r.topeCabeza = sy;
  if (v === 'pez_dardo') r.largoMax = 3.2;
  return r;
}

// ── PULPO (con sombrero de brujo) ──
function pulpo(c) {
  const r = nuevoRig('pulpo'), R = r.raiz, piel = principal(c, '#5a8a20'), m = mc(c, piel);
  r.caer = 'encoge';
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  M(cu, 'esfera', m, [0, 0.8, -0.03], [0.36, 0.42, 0.34]);
  MF(cu, [
    ['esfera', '#1a2a0a', [-0.14, 0.72, 0.27], 0.1], ['esfera', '#1a2a0a', [0.14, 0.72, 0.27], 0.1],
    ['esferaB', '#e0208a', [-0.14, 0.72, 0.34], [0.06, 0.07, 0.04]], ['esferaB', '#e0208a', [0.14, 0.72, 0.34], [0.06, 0.07, 0.04]],
  ]);
  if (c.k === 'pulpo') MF(cu, [['toro', '#e8c040', [-0.14, 0.72, 0.33], [0.12, 0.12, 0.12], [PI / 2, 0, 0]], ['toro', '#e8c040', [0.14, 0.72, 0.33], [0.12, 0.12, 0.12], [PI / 2, 0, 0]], ['cil', '#e8c040', [0, 0.95, 0], [0.37, 0.03, 0.35]]]);
  for (let i = 0; i < 8; i++) {
    const g = G(cu, [0, 0.5, 0], [0, (i * PI) / 4, 0]);
    const p = piv(r, G(g, [0, 0, 0.18]));
    M(p, 'cono', m, [0, 0, 0], [0.08, 0.55, 0.08], [2.5, 0, 0]);
    r.tent.push(p);
  }
  r.cabeza = cu; r.H = 0.9; r.topeCabeza = 1.18;
  return r;
}

// ── DRAGON ──
function dragon(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, piel = principal(c, '#1c1c70'), m = mc(c, piel);
  const cuerno = '#c8c8e8';
  r.paso = 6; r.vuela = !!c.vuela; r.aleteo = 4.5; r.amplAla = 0.55; r.caer = 'lado'; r.hundir = 0.45; r.tAtk = 0.5; r.colaAmp = 0.25;
  const cu = r.cuerpo = piv(r, G(R, [0, 1.1, 0]));
  M(cu, 'esfera', m, [0, 0, 0], [0.55, 0.5, 1.0]);
  M(cu, 'esfera', c.color ? mez(c.color, '#ffffff', 0.4) : '#186090', [0, -0.15, 0.1], [0.45, 0.4, 0.8]);
  puas(cu, cuerno, c.montura ? [[0, 0.36, -0.7]] : [[0, 0.41, 0.5], [0, 0.48, 0.1], [0, 0.46, -0.3], [0, 0.34, -0.7]], 1.2);
  const cuello = piv(r, G(cu, [0, 0.3, 0.75], [0.55, 0, 0]));
  M(cuello, 'tronco', m, [0, 0, 0], [0.24, 0.85, 0.24]);
  const cb = r.cabeza = piv(r, G(cuello, [0, 0.85, 0], [-0.55, 0, 0]));
  M(cb, 'esfera', m, [0, 0, 0.12], [0.28, 0.24, 0.4]);
  MF(cb, [
    ['caja', hx(piel), [0, -0.04, 0.48], [0.24, 0.16, 0.32]],
    ['cono', cuerno, [-0.13, 0.15, -0.1], [0.05, 0.35, 0.05], [-1.0, 0, 0.25]], ['cono', cuerno, [0.13, 0.15, -0.1], [0.05, 0.35, 0.05], [-1.0, 0, -0.25]],
  ]);
  ojos(cb, '#ffd84a', 0.15, 0.07, 0.32, 0.045);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.13, 0.2]));
  M(mj, 'caja', osc(piel, 0.7), [0, 0, 0.2], [0.2, 0.06, 0.42]);
  const mAla = mat(c.color ? osc(c.color, 0.6) : '#4a1a40', { ds: true });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.35 * s, 0.4, 0.25], [0, 0, 0.45 * s]));
    M(p, 'ala', mAla, [0, 0, 0], [2.2 * s, 1, 1.6], [-0.35, 0, 0]);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  const cola = r.cola = piv(r, G(cu, [0, -0.05, -0.95]));
  MF(cola, [['tronco', hx(piel), [0, 0, 0], [0.28, 1.9, 0.2], [-1.75, 0, 0]], ['cono4', cuerno, [-0, -0.34, -1.87], [0.15, 0.3, 0.05], [-1.75, 0, 0]]]);
  cuatroPatas(r, 0.42, 0.95, 0.55, -0.5, 0.85, 0.18, m, osc(piel, 0.6));
  if (c.montura) silla(r, cu, [0, 0.5, 0.05], 0.3);
  r.lomo = cu; r.H = 1; r.topeCabeza = 0.24;
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
  const m = new Modelo(r, alto, 'm:' + k + (c.jefe ? ':j' : ''));
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
  const m = new Modelo(r, 62 / PX_M, 'n:' + hoja);
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
  const m = new Modelo(r, ALTO_MONTURA[d.hoja] || 1.5, 'mo:' + id);
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
