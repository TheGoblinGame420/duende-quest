// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — modelos 3D de personajes y monstruos
//
// Todo sale de primitivas de Three.js (sin texturas ni archivos): estilo
// low-poly con sombreado plano. Cada modelo es un "rig" de pivotes (cuerpo,
// cabeza, brazos, piernas, alas, cola...) que se anima por codigo.
//
// API:
//   crearDuende({ skin, clase, arma }) -> Modelo   (el jugador)
//   crearMonstruo(k, { ligero }?)       -> Modelo   (clave de MONSTRUOS; ligero = calidad baja)
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
import { MONSTRUOS, HOJAS, SKINS, CLASES, ARMAS, MONTURAS, APARIENCIA, LOOK_BASE, limpiarLook, statsMonstruo, DISFRAZ_ID } from '/mmo/js/data.js?v=376';
// Trajes 3D de las skins: un solo modulo generado por tools/unir_skins.mjs desde mundo/js/skins/*.js.
import { SKINS3D } from './skins3d.js?v=376';

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
  if (!g) {
    if (!FABRICA[k]) throw new Error('Geometría desconocida: «' + k + '». Las hay: ' + Object.keys(FABRICA).join(', '));
    g = FABRICA[k](); g.computeBoundingBox(); GEOS.set(k, g);
  }
  return g;
}

// ── MATERIALES COMPARTIDOS (por color y opciones) ──
// o: { e: brillo emisivo 0..1, op: opacidad, ds: dos caras, aura: aditivo sin luz }
const MATS = new Map();
// Luz de borde calida (fresnel barato) para que las siluetas se lean en pantallas
// chicas. Usa la normal 'normal' que Lambert ya calcula (con flatShading sale de
// dFdx/dFdy de vViewPosition), asi que no hace falta vNormal. Sin mallas nuevas.
const RIM_K = (() => { try { return (matchMedia('(pointer: coarse)').matches ? 0.24 : 0.32).toFixed(2); } catch (e) { return '0.28'; } })();
// El color (ya con su fuerza) va en un uniforme compartido: mundo.js lo cambia con la hora (calido de dia,
// azul de luna de noche). Quien no lo toque (galeria, taller) ve el blanco calido de siempre.
// uBordeK.x = 1 pondera el borde con el cielo (mas arriba, casi nada por debajo), .y = oclusion de las caras
// que miran al suelo (bajo el sombrero, la barbilla, las axilas). Con (0, 0) el sombreado es el de antes.
export const BORDE_DIA = new THREE.Color(1.0, 0.95, 0.87), BORDE_K = +RIM_K;
export const LUZ_BORDE = { value: BORDE_DIA.clone().multiplyScalar(BORDE_K) };
export const BORDE_FX = { value: new THREE.Vector2(0, 0) };
function conBorde(fs, extra) {
  return 'uniform vec3 uBorde;\nuniform vec2 uBordeK;\n' + fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + extra +
    '\n\tfloat rimF = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.0);' +
    '\n\tfloat rimY = dot(normal, viewMatrix[1].xyz);' +   // componente «arriba del mundo» de la normal (en espacio de vista)
    '\n\ttotalEmissiveRadiance += uBorde * rimF * mix(1.0, 0.55 + 0.6 * rimY, uBordeK.x);' +
    '\n\tdiffuseColor.rgb *= 1.0 - uBordeK.y * smoothstep(0.15, 0.95, -rimY);');
}
function ponBorde(s) { s.uniforms.uBorde = LUZ_BORDE; s.uniforms.uBordeK = BORDE_FX; }
function mat(color, o) {
  o = o || {};
  const c = col(color);
  const k = c.getHexString() + '|' + (o.e || 0) + '|' + (o.op || 1) + '|' + (o.ds ? 1 : 0) + '|' + (o.aura ? 1 : 0) + '|' + (o.vc ? 1 : 0);
  let m = MATS.get(k);
  if (m) return m;
  const op = o.op || 1;
  if (o.aura) {
    m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });   /* aditiva: sale igual en una pasada (antes, dos dibujos y programa rehecho en cada cuadro) */
  } else {
    m = new THREE.MeshLambertMaterial({
      color: c, flatShading: true, transparent: op < 1, opacity: op, depthWrite: op >= 1,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
      emissive: o.e ? c : new THREE.Color(0), emissiveIntensity: o.e || 0,
      vertexColors: !!o.vc,
    });
    if (op >= 1) { m.onBeforeCompile = s => { ponBorde(s); s.fragmentShader = conBorde(s.fragmentShader, ''); }; m.customProgramCacheKey = () => 'borde'; }
  }
  m.userData.compartido = true;
  MATS.set(k, m);
  return m;
}
const BLANCO = new THREE.MeshBasicMaterial({ color: 0xffffff });   // destello de golpe
const ROJO_AVISO = new THREE.MeshBasicMaterial({ color: 0xff3b2f });   // monstruo a punto de pegar

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
  g.userData.piezas = partes.length;
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
    ponBorde(s);
    s.vertexShader = 'attribute float brillo;\nvarying float vBrillo;\n' +
      s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBrillo = brillo;');
    s.fragmentShader = 'varying float vBrillo;\n' +
      conBorde(s.fragmentShader, '\n\ttotalEmissiveRadiance *= vColor.rgb * vBrillo;');
  };
  m.customProgramCacheKey = () => 'vcb-borde';
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
    // Desfase propio: asi dos goblins o dos NPC no respiran ni parpadean a la vez.
    this.fase = Math.random() * 40;
  }
  // estado: quieto | anda | corre | ataca | lanza | herido | muere | salta | vuela | nada
  //         (+ 'monta': sentado en la silla de una montura)
  animar(estado, tEstado, t) { animarRig(this, estado || 'quieto', tEstado || 0, t || 0); }
  // Destello blanco ~120 ms.
  golpe() {
    if (performance.now() < (this._rojoHasta || 0)) return; // el aviso rojo manda: tu golpe no lo borra
    for (const me of this.mallas) {
      if (me.userData.sinFlash) continue;
      if (!me.userData.m0) me.userData.m0 = me.material;
      me.material = BLANCO;
    }
    clearTimeout(this._tf);
    this._tf = setTimeout(() => this._restaurar(), 120);
  }
  // Brillo rojo de aviso (va a pegar): mismo cambio de material que el destello, ms milisegundos.
  avisoRojo(ms) {
    for (const me of this.mallas) {
      if (me.userData.sinFlash) continue;
      if (!me.userData.m0) me.userData.m0 = me.material;
      me.material = ROJO_AVISO;
    }
    this._rojoHasta = performance.now() + (ms || 300);
    clearTimeout(this._tf);
    this._tf = setTimeout(() => this._restaurar(), ms || 300);
  }
  _restaurar() {
    this._rojoHasta = 0;
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
const MENOS_MOV_R = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
function animarRig(m, est, te, t) {
  const r = m.r;
  if (!r) return;
  t += m.fase || 0;                                    // cada modelo con su propio ritmo
  const b = m.base, A = m.alto;
  for (const o of r.piv) { const u = o.userData.reposo; o.position.copy(u[0]); o.rotation.copy(u[1]); o.scale.copy(u[2]); }
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);

  const corre = est === 'corre';
  const mueve = est === 'anda' || corre || est === 'nada' || est === 'vuela';
  const f = t * r.paso * (corre ? 1.5 : 1) * (m.tipo === 'montura' ? m.ritmo || 1 : 1);   // fase del paso (las monturas rapidas galopan mas rapido)
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
  // Funda de brillo del arma: late suave (y mas fuerte en el tajo).
  if (r.filos) {
    const kf = 1 + 0.18 * Math.sin(t * 4.2) + (est === 'ataca' ? 0.35 * arco(te / r.tAtk) : 0);
    for (const o of r.filos) { o.scale.x *= kf; o.scale.y *= kf; }
  }
  // Parpadeo: cada ~3-5 s los ojos se cierran ~0,13 s (cerrados al morir).
  // Los ojos de los enemigos, en vez de parpadear tanto, laten con malicia.
  if (r.ojosP) {
    const per = 3.2 + (m.fase % 1.9), ph = t % per;
    let cierre = ph < 0.13 ? arco(ph / 0.13) : 0;
    if (!r.ojosMalos && ph > 0.25 && ph < 0.38 && m.fase % 3 < 1) cierre = arco((ph - 0.25) / 0.13);   // a veces, doble
    if (muerto) cierre = Math.min(1, te / 0.4);
    r.ojosP.scale.y *= 1 - 0.88 * cierre;
    if (r.ojosMalos && !muerto) { const kp = 1 + 0.12 * Math.max(0, Math.sin(t * 5)); r.ojosP.scale.x *= kp; r.ojosP.scale.z *= kp; }
  }
  // Orejas: vaiven suave y, de vez en cuando, un tic rapido (como un gato).
  if (r.orejas) {
    const tic = (t % 6.1) < 0.35 ? Math.sin((t % 6.1) / 0.35 * PI * 3) * 0.22 : 0;
    const va = mueve ? Math.sin(f) * 0.1 : Math.sin(t * 1.6) * 0.05;
    for (const [o, x] of r.orejas) {
      o.rotation.z += x * (va + (x > 0 ? tic : 0));
      o.rotation.x += mueve ? -0.12 - Math.abs(c) * 0.08 : 0;          // al correr se echan atras
      if (est === 'herido') o.rotation.z -= x * 0.35 * Math.max(0, 1 - te / 0.35);   // se encogen al recibir
    }
  }

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
        // Respira: el pecho se hincha (y y algo de z) y los hombros suben con el aire.
        const res = Math.sin(t * 2.4);
        if (cu) { cu.scale.y *= 1 + 0.03 * res; cu.scale.z *= 1 + 0.025 * res; cu.rotation.z += Math.sin(t * 0.9) * 0.025; }
        if (cb) { cb.rotation.y += Math.sin(t * 0.7) * 0.12; cb.rotation.z += Math.sin(t * 0.55 + 1) * 0.05; cb.rotation.x -= 0.03 * res; }
        if (bI) { bI.rotation.z += 0.05 * res; bD.rotation.z -= 0.05 * res; bI.rotation.x += 0.04 * res; bD.rotation.x += 0.04 * res; }
        if (pI) { pI.rotation.z += 0.02 * Math.sin(t * 0.9); pD.rotation.z += 0.02 * Math.sin(t * 0.9); }   // cambia el peso de pie
        if (m.tipo === 'npc') {
          // NPC del pueblo: mira a un lado y al otro (con pausas) y cada ~11 s saluda.
          // Si ya mira a alguien (m.mirarK), deja el vaiven de lado para no pelear con el giro.
          const mira = Math.sin(t * 0.33), pausa = (m.mirarK || 0) < 0.1 ? Math.sign(mira) * Math.min(1, Math.abs(mira) * 2.2) : 0;
          if (cb) { cb.rotation.y += pausa * 0.38; cb.rotation.x += Math.max(0, Math.sin(t * 0.21)) * 0.12; }
          if (cu) cu.rotation.y += pausa * 0.1;
          const kg = (t % 11) / 1.6;
          if (kg < 1 && bI) {
            const g = arco(kg), sacude = Math.sin(kg * PI * 6) * 0.35 * g;
            bI.rotation.z += 2.3 * g + sacude; bI.rotation.x -= 0.25 * g;
            if (cb) cb.rotation.z -= 0.12 * g;
          }
        }
      }
      // Gesto del jugador (v347): 2,5 s de pose sobre la quietud; si camina o pelea, se corta.
      // Lo marca mostrarGesto en el cliente (m.gesto / m.gestoT): sin coste de red.
      if (m.gesto) {
        const kg = (performance.now() - (m.gestoT || 0)) / 1000;
        if (est !== 'quieto' || kg > 2.5 || kg < 0) m.gesto = null;
        else {
          const g = m.gesto, am = Math.max(0, Math.min(1, kg / 0.2, (2.5 - kg) / 0.3)) * (MENOS_MOV_R ? 0.4 : 1);
          if (g === 'bailar') {
            const ph = kg * 8, sn = Math.sin(ph);
            b.position.y += Math.abs(sn) * 0.06 * A * am;
            b.rotation.y += Math.sin(ph * 0.5) * 0.35 * am;
            if (cu) cu.rotation.z += Math.sin(ph * 0.5) * 0.12 * am;
            if (bI) { bI.rotation.z += (1.2 + sn * 0.9) * am; bD.rotation.z -= (1.2 - sn * 0.9) * am; }
            if (pI) { pI.rotation.x -= Math.max(0, sn) * 0.35 * am; pD.rotation.x -= Math.max(0, -sn) * 0.35 * am; }
            if (cb) cb.rotation.z += sn * 0.12 * am;
          } else if (g === 'aplaudir') {
            const ab = 0.55 * (0.5 + 0.5 * Math.sin(kg * 18)) - 0.15;
            if (bI) { bI.rotation.x -= 1.25 * am; bD.rotation.x -= 1.25 * am; bI.rotation.z += ab * am; bD.rotation.z -= ab * am; }
            if (cb) cb.rotation.x += 0.06 * am;
          } else if (g === 'reir') {
            const sc = Math.sin(kg * 30);
            if (cu) { cu.rotation.x -= 0.15 * am; cu.rotation.z += sc * 0.06 * am; cu.scale.y *= 1 + sc * 0.03 * am; }
            if (cb) cb.rotation.x -= 0.25 * am;
            if (bI) { bI.rotation.x -= 0.5 * am; bD.rotation.x -= 0.5 * am; bI.rotation.z -= 0.2 * am; bD.rotation.z += 0.2 * am; }
            b.position.y += Math.abs(Math.sin(kg * 15)) * 0.015 * A * am;
          } else {
            // 'saludar' (y, mas suave, el resto): brazo derecho arriba que se sacude.
            const k2 = g === 'saludar' ? am : am * 0.6;
            if (bD) { bD.rotation.z -= 2.3 * k2 + Math.sin(kg * 14) * 0.35 * k2; bD.rotation.x -= 0.25 * k2; }
            if (cb) cb.rotation.z += 0.12 * k2;
          }
        }
      }
      if (amp && est !== 'nada') {
        // Paso con gracia: brazos que balancean y abren algo, torso que gira contra
        // las piernas, cabeza que se queda mirando al frente y rebote en dos tiempos.
        if (pI) { pI.rotation.x += s * amp; pD.rotation.x -= s * amp; }
        if (bI) {
          bI.rotation.x -= s * amp * 0.9; bD.rotation.x += s * amp * 0.9;
          bI.rotation.z += 0.08 + Math.max(0, s) * 0.06; bD.rotation.z -= 0.08 + Math.max(0, -s) * 0.06;
        }
        b.position.y += Math.abs(c) * 0.035 * A * (corre ? 1.4 : 1);
        b.rotation.z += s * (corre ? 0.035 : 0.025);
        if (cu) { cu.rotation.x += corre ? 0.2 : 0.07; cu.rotation.y += s * (corre ? 0.14 : 0.1); }
        if (cb) { cb.rotation.y -= s * (corre ? 0.12 : 0.08); cb.rotation.x -= corre ? 0.1 : 0.03; }
        if (r.bamboleo && cu) cu.rotation.z += s * 0.15;
        if (r.tunica) r.tunica.rotation.z += s * 0.06;
      }
      if (ataca) {
        // Pose de ataque mas marcada: carga agachado, estocada del cuerpo y brazo libre atras.
        const kc = Math.min(kA, 1);
        const carga = kc < 0.4 ? suave(kc / 0.4) : Math.max(0, 1 - (kc - 0.4) / 0.6 * 2);
        b.position.y -= carga * 0.035 * A;
        b.position.z += aA * 0.07 * A;
        b.rotation.x += aA * 0.08;
        if (cb) cb.rotation.x += aA * 0.12;
        if (bI && !r.dosArmas && !r.escudo && !(r.manoI && r.manoI.userData.escudo)) { bI.rotation.x += aA * 0.7; bI.rotation.z += aA * 0.25; }
      }
      if (ataca) {
        // Brazo derecho: arriba y atras, luego tajo hacia delante (~0.35 s).
        const k = Math.min(kA, 1), vuelta = kA < 1 ? 1 : Math.max(0, 1 - (kA - 1) * 4);
        const cmb = r.cmb ?? (m.combo | 0);   // combo visual (v344): 0 tajo de arriba, 1 tajo de vuelta (barrido), 2 estocada fuerte
        const ang = k < 0.4 ? lerp(0, -3.3, suave(k / 0.4)) : lerp(-3.3, -0.5, suave((k - 0.4) / 0.6));
        if (bD && cmb === 1) {
          // Tajo de vuelta: brazo a la altura del hombro que barre de un lado al otro.
          const kb = suave(clamp((k - 0.15) / 0.6, 0, 1));
          bD.rotation.x += -1.45 * Math.min(1, k / 0.15 + 0.3) * vuelta;
          bD.rotation.z += lerp(1.0, -1.15, kb) * vuelta;
          if (cu) cu.rotation.y += lerp(0.45, -0.55, kb) * vuelta - (k < 0.4 ? 0.35 * suave(k / 0.4) : 0.35 - 0.75 * suave((k - 0.4) / 0.6)) * vuelta;
        } else if (bD && cmb === 2) {
          // Estocada: el brazo se recoge atras y sale recto adelante con todo el cuerpo.
          const ke = k < 0.35 ? lerp(0, 0.8, suave(k / 0.35)) : lerp(0.8, -1.55, suave(clamp((k - 0.35) / 0.25, 0, 1)));
          bD.rotation.x += ke * vuelta;
          b.position.z += aA * 0.14 * A; b.position.y -= aA * 0.03 * A; b.rotation.x += aA * 0.1;
          if (pI) { pI.rotation.x -= 0.3 * aA; pD.rotation.x += 0.3 * aA; }
        } else if (bD) bD.rotation.x += ang * vuelta;
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
        if (m.montaAnda) b.rotation.x += 0.12;   // con la montura andando, el jinete se inclina hacia delante
      }
      // Mirar al objetivo (v351): m.mirar = giro relativo (rad), m.mirarK = peso 0..1 ya suavizado.
      if (m.mirarK && !muerto) {
        const a = Math.max(-1, Math.min(1, m.mirar || 0)) * m.mirarK;
        if (cb) cb.rotation.y += a * 0.7;
        if (cu) cu.rotation.y += a * 0.3;
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
      // Quieto, olfatea y mira a los lados (con pausas, como un animal alerta).
      if (m.mirarK && cb && !muerto) cb.rotation.y += Math.max(-1, Math.min(1, m.mirar || 0)) * m.mirarK * 0.6;   // mira al objetivo
      if (est === 'quieto' && cb && (m.mirarK || 0) < 0.1) { const mi = Math.sin(t * 0.45); cb.rotation.y += Math.sign(mi) * Math.min(1, Math.abs(mi) * 2) * 0.25; cb.rotation.x += Math.max(0, Math.sin(t * 7)) * 0.03 * (Math.sin(t * 0.6) > 0.6 ? 1 : 0); }
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

  if (m.tipo !== 'duende') animarExtra(m, r, b, est, te, t, f, mueve, ataca, aA, kA);   /* criaturas: capas, mandibulas, estocadas y muertes propias */
  // Comunes: retroceso al recibir y caida al morir.
  if (est === 'herido') {
    const e = Math.max(0, 1 - te / 0.35);
    b.rotation.x -= 0.32 * e;
    b.position.z -= 0.06 * A * e;
    // Aplastado al recibir: el cuerpo se achata y ensancha (b.scale se reinicia cada frame).
    const q = 0.14 * e * e * (MENOS_MOV_R ? 0.4 : 1) * (m.golpeFuerte ? 1.6 : 1);
    b.scale.y *= 1 - q; b.scale.x *= 1 + q * 0.5; b.scale.z *= 1 + q * 0.5;
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
  // Cabeza de la mascota $DUENDE (imagenes del dueño en Descargas): un cubo, no una bola.
  if (o.cabezaCubo) M(cb, 'caja', piel, [0, 0.27 * H, 0], [0.54 * H, 0.5 * H, 0.5 * H]);
  else M(cb, 'esfera', piel, [0, 0.26 * H, 0], [0.3 * H, 0.28 * H, 0.28 * H]);
  if (o.orejas) for (const x of [-1, 1]) {
    // Con orejasVivas cada oreja cuelga de su pivote (en su base) y se mueve sola.
    const og = o.orejasVivas ? piv(r, G(cb, [x * 0.24 * H, 0.3 * H, -0.03 * H])) : cb;
    const o0 = o.orejasVivas ? [0, 0, 0] : [x * 0.24 * H, 0.3 * H, -0.03 * H];
    M(og, 'cono', piel, o0, [0.075 * H, o.orejas * H, 0.045 * H], [0, -x * 0.25, -x * (o.orejaRot || 1.2)]);
    // Interior naranja de la oreja (como la mascota).
    if (o.orejaDentro) M(og, 'cono', o.orejaDentro, [o0[0] + x * 0.005 * H, o0[1], o0[2] + 0.025 * H], [0.05 * H, o.orejas * 0.82 * H, 0.03 * H], [0, -x * 0.25, -x * (o.orejaRot || 1.2)]);
    if (o.orejasVivas) (r.orejas || (r.orejas = [])).push([og, x]);
  }
  if (o.nariz === 'bola') M(cb, 'esfera', osc(piel, 0.92), [0, 0.21 * H, 0.27 * H], [0.08 * H, 0.07 * H, 0.09 * H]);
  else if (o.nariz === 'pico') M(cb, 'cono', piel, [0, 0.22 * H, 0.23 * H], [0.06 * H, 0.22 * H, 0.06 * H], [PI / 2 + 0.25, 0, 0]);
  else if (o.nariz === 'gancho') {   // la del duende 2D: larga, ancha en la base y caida hacia abajo
    MF(cb, [['cono', hx(osc(piel, 0.9)), [0, 0.27, 0.22], [0.085, 0.26, 0.075], [PI / 2 + 0.5, 0, 0]],
      ['esfera', hx(osc(piel, 0.9)), [0, 0.15, 0.4], [0.05, 0.045, 0.05]]], null, null, null, H);
  }
  // Ojos en su propio pivote (a la altura de los ojos) para poder parpadear:
  // se aplasta en y. Cejas, boca y mejillas siguen en la cabeza.
  const YO = 0.3;
  if (o.ojos === 'duende') {
    const cara = o.ojosGrandes ? partesOjos(true) : o.mascota ? partesMascota() : o.ojosVideo ? partesOjosVideo() : partesOjos2D(piel);
    const esOjo = p => p[2][1] >= 0.25 && p[2][1] <= 0.345;
    const resto = cara.filter(p => !esOjo(p));
    if (resto.length) MF(cb, resto, null, null, null, H);
    r.ojosP = piv(r, G(cb, [0, YO * H, 0]));
    MF(r.ojosP, cara.filter(esOjo), null, null, [0, -YO * H, 0], H);
  } else if (o.ojos) {
    const ojo = mat(o.ojos, { e: 1 });
    r.ojosP = piv(r, G(cb, [0, 0.31 * H, 0]));
    for (const x of [-1, 1]) M(r.ojosP, 'esferaB', ojo, [x * 0.1 * H, 0, 0.25 * H], [0.06 * H, 0.045 * H, 0.03 * H]);
    r.ojosMalos = !o.amigo;
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
// Cara de la mascota $DUENDE sobre la cabeza cubo (cara frontal en z = 0,25):
// ojos azules grandes, cejas en bloque inclinadas (mirada picara), nariz
// cuadrada, mejillas redondas, sonrisa ancha con colmillos y lengua.
function partesMascota() {
  const P = [], verde = '#7fbf2e', mejilla = '#b5e35c';
  for (const x of [-1, 1]) {
    P.push(['esfera', '#fbfbf7', [x * 0.12, 0.31, 0.252], [0.085, 0.095, 0.03]]);
    P.push(['esferaB', '#2563eb', [x * 0.115, 0.305, 0.272], [0.056, 0.062, 0.012]]);
    P.push(['esferaB', '#0b0b18', [x * 0.115, 0.305, 0.28], [0.028, 0.032, 0.008]]);
    P.push(['esferaB', '#ffffff', [x * 0.1, 0.325, 0.286], [0.014, 0.014, 0.005]]);
    P.push(['caja', verde, [x * 0.12, 0.415, 0.262], [0.17, 0.065, 0.06], [0, 0, x * 0.3]]);   /* ceño picaro: el extremo de dentro, mas bajo (11-nov: antes caia el de fuera y salia triste) */
    P.push(['esferaB', mejilla, [x * 0.2, 0.17, 0.252], [0.05, 0.05, 0.016]]);
  }
  P.push(['caja', verde, [0, 0.215, 0.27], [0.09, 0.075, 0.07]]);              // nariz cuadrada
  P.push(['caja', '#4a0f1c', [0, 0.1, 0.252], [0.26, 0.08, 0.012]]);           // boca
  P.push(['caja', '#ffffff', [0, 0.125, 0.258], [0.24, 0.03, 0.01]]);          // dientes
  for (const x of [-1, 1]) P.push(['cono', '#ffffff', [x * 0.1, 0.112, 0.259], [0.018, 0.045, 0.01], [Math.PI, 0, 0]]);   // colmillos
  P.push(['esferaB', '#e8607a', [0, 0.078, 0.257], [0.07, 0.025, 0.01]]);      // lengua
  return P;
}
// Las dos espadas de pixeles cruzadas detras de la cabeza (el sello de la mascota).
function partesEspadasPixel() {
  // (11-nov) Banda en escalera de dos pixeles de ancho, naranja por fuera y marron por dentro,
  // como en las imagenes del dueño: de lejos y de espaldas se leen como dos espadas, no como dos hilos.
  const P = [], c1 = '#d9782d', c2 = '#8a4a1c', p = 0.07;
  for (const x of [-1, 1]) for (let i = 0; i < 7; i++) {
    const px = Math.round((0.13 + i * p) * 1000) / 1000, py = Math.round((0.4 + i * p) * 1000) / 1000;
    P.push(['caja', c2, [x * px, py, -0.2], [p, p, 0.05]]);
    P.push(['caja', c1, [x * Math.round((px + p) * 1000) / 1000, py, -0.2], [p, p, 0.05]]);
  }
  return P;
}
// Ojos del duende de los videos del dueño (Descargas/duende_atleta_voz.mp4 y la
// mascota): grandes y amables, blanco, iris castaño, pupila con brillo y cejas
// castaño oscuro algo arqueadas (no fruncidas como los goblins enemigos).
function partesOjosVideo() {
  const P = [];
  for (const x of [-1, 1]) {
    P.push(['esfera', '#fbfaf5', [x * 0.105, 0.305, 0.238], [0.085, 0.092, 0.05]]);
    P.push(['esferaB', '#6b3f1f', [x * 0.1, 0.3, 0.282], [0.05, 0.056, 0.02]]);
    P.push(['esferaB', '#160f0a', [x * 0.1, 0.3, 0.297], [0.026, 0.03, 0.01]]);
    P.push(['esferaB', '#ffffff', [x * 0.088, 0.318, 0.305], [0.014, 0.014, 0.006]]);
    P.push(['caja', '#3b2414', [x * 0.112, 0.392, 0.255], [0.13, 0.034, 0.05], [0, 0, -x * 0.12]]);
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
  // Grado del equipo (o.gr 1-3, o.cg color): filo emisivo a lo largo de la hoja.
  if (o.gr) M(g, 'caja', mat(o.cg || '#ffe6b8', { e: o.gr >= 3 ? 0.9 : o.gr >= 2 ? 0.7 : 0.4 }), [0, -(o.ancho ?? 0.07) / 2, 0.09 + L / 2], [0.03, 0.022, L * 0.96]).userData.sinFlash = true;
  // Brillo de rareza: funda aditiva un poco mas grande que la hoja que late (o.r = rig).
  if (o.filo && o.r) {
    const fp = piv(o.r, G(g, hoja[2]));
    M(fp, 'caja', mat(o.filo, { aura: true, op: o.daga ? 0.32 : 0.24 }), [0, 0, 0], [0.06, (o.ancho ?? 0.07) * 1.7, L * 1.05]).userData.sinFlash = true;
    (o.r.filos || (o.r.filos = [])).push(fp);
  }
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
  mano.userData.escudo = true;   // el brazo del escudo no se echa atras al atacar
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
// Verde lima de los duendes de los videos del dueño (antes '#6cc644', mas oscuro con la luz).
const PIEL_DUENDE = '#8fd14f';
// Ropa de cada skin, sacada de su imagen 2D (assets/skins/*.png).
const ROPA_SKIN = {
  // Duende de siempre (heroe de la hoja animada): cuero marron con hebillas de bronce.
  // (25-oct) con el poncho andino a rayas de la mascota $Duende.
  comun:      { ropa: '#7a5230', pantalon: '#4e3420', botas: '#3a2616', acento: '#c9a227', poncho: ['#2f62c0', '#f2c23a', '#f8f4ea'] },
  // Tactico: sudadera verde de hacker, visor verde y lineas de codigo neon.
  tactico:    { ropa: '#1f6b35', pantalon: '#1a2a20', botas: '#121a14', acento: '#39ff6a', neon: '#39ff6a', visor: '#1aff5a', capucha: '#1a5a2c', teclado: '#39ff6a', codigo: '#39ff6a' },
  // Nigromante: sombras moradas con llamas violeta en las manos.
  necro:      { ropa: '#3a1f5c', pantalon: '#1e1230', botas: '#160d22', acento: '#b44cff', llamas: '#b44cff', capucha: '#24123a', tunica: '#2a1644', ojosBrillo: '#c77dff', orbe: '#b44cff', humo: '#7c3aed' },
  // Rey: traje azul con corbata roja y corona.
  king:       { ropa: '#22307a', pantalon: '#1a2358', botas: '#141a3a', acento: '#ffd84a', corbata: '#d22b2b', corona: true, gemas: true, ribete: '#38bdf8', movil: true },
  // Berserker (el juez): toga morada con ribetes dorados, capa y corona.
  berserker:  { ropa: '#6b2a8f', pantalon: '#3d1858', botas: '#2a1040', acento: '#ffd84a', cinto: '#ffd84a', corona: true, capa: '#4d1d6b', tunica: '#5b2380', borde: '#ffd84a', peluca: '#f1f1f1', chorrera: '#ffffff', mazo: '#e8b923', runas: '#b44cff' },
  // Legendaria: armadura negra con circuitos neon cian y magenta.
  // Disfraces de la mascota (30-oct): ropa + atuendo (sombrero o peinado) de cada imagen.
  bruja:        { ropa: '#3b1f4a', pantalon: '#4a2a16', botas: '#3a2616', acento: '#f07a1a', poncho: ['#3b1f4a', '#f07a1a', '#2a1430'], atuendo: 'bruja' },
  momia:        { ropa: '#e8e0c8', pantalon: '#d8cfb4', botas: '#c9bfa2', acento: '#b5a888', poncho: ['#e8e0c8', '#cfc4a6', '#f4efe0'], atuendo: 'momia' },
  frankenstein: { ropa: '#6b4423', pantalon: '#3b2350', botas: '#3a2616', acento: '#9aa3ad', atuendo: 'frankenstein' },
  vampiro:      { ropa: '#1a1420', pantalon: '#1a1420', botas: '#120d16', acento: '#c0262d', capa: '#8a1020', atuendo: 'vampiro' },
  esqueleto:    { ropa: '#2a2030', pantalon: '#2a2030', botas: '#5a3a1e', acento: '#efe6cf', poncho: ['#2a2030', '#efe6cf', '#2a2030'], atuendo: 'esqueleto' },
  lobo:         { ropa: '#b8322a', pantalon: '#2f3f6b', botas: '#5a3a1e', acento: '#7a4a26', atuendo: 'lobo' },
  pirata:       { ropa: '#5a3a1e', pantalon: '#3b2616', botas: '#4a2a16', acento: '#c9a227', cinto: '#c0262d', atuendo: 'pirata' },
  legendaria: { ropa: '#1b1f33', pantalon: '#12152a', botas: '#0c0e1c', acento: '#00f0ff', neon: '#ff3cf0', hombreras: true, puas: '#00f0ff', ojosBrillo: '#ff9a1f', orbe: '#00f0ff', hojaNeon: '#7df9ff' },
  // Exclusivas de pago (US$5-50): cada una con su propio aspecto, de menos a mas piezas.
  esmeralda:  { ropa: '#0f5e43', pantalon: '#0b3d2c', botas: '#082a1f', acento: '#34d399', neon: '#34d399', capucha: '#0b4a34', hombreras: true },
  sombra:     { ropa: '#1e1636', pantalon: '#140f26', botas: '#0d0a18', acento: '#a78bfa', capa: '#2a1d4f', ojosBrillo: '#c4b5fd', humo: '#7c3aed', hombreras: true },
  solar:      { ropa: '#7a4a06', pantalon: '#4a2c04', botas: '#2e1b02', acento: '#fbbf24', corona: true, capa: '#b45309', orbe: '#facc15', hojaNeon: '#fde68a', hombreras: true },
  cosmico:    { ropa: '#0b1d3a', pantalon: '#081428', botas: '#050d1c', acento: '#38bdf8', neon: '#a78bfa', puas: '#38bdf8', orbe: '#38bdf8', ojosBrillo: '#e0f2fe', hojaNeon: '#7dd3fc', capa: '#1e3a8a', hombreras: true },
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
  // Poncho: un tronco de cono sobre los hombros con franjas en el borde.
  if (R0.poncho) {
    const [pb, pf, pf2] = R0.poncho.map(hx);
    piezas.push(['tronco', pb, [0, T * 0.26, 0], [0.31 * W, T * 0.8, 0.29 * P]]);
    piezas.push(['toro', pf, [0, T * 0.3, 0], [0.302 * W, 0.25, 0.283 * P]]);
    piezas.push(['toro', pf2, [0, T * 0.4, 0], [0.285 * W, 0.22, 0.267 * P]]);
    piezas.push(['toro', pf, [0, T * 0.5, 0], [0.267 * W, 0.22, 0.25 * P]]);
  }
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
function formaDuende(r, R0, lk, colorPelo, L = 0.45) {
  for (const b of [r.bI, r.bD]) M(b, 'esfera', R0.mangas ?? R0.ropa, [0, -0.01, 0], [0.1, 0.09, 0.1]);
  for (const [mano, lado] of [[r.manoI, 1], [r.manoD, -1]]) M(mano, 'esferaB', R0.manos ?? PIEL_DUENDE, [-lado * 0.05, 0.03, 0.04], [0.035, 0.05, 0.035]);
  for (const p of [r.pI, r.pD]) if (p) M(p, 'semi', R0.botas, [0, -L + 0.02, 0.13], [0.09, 0.07, 0.1], [0, 0, 0]);
  const H = r.H, P2 = [];
  fuera(MF(r.cabeza, partesEspadasPixel(), null, null, null, H));
  if (lk.cara === 5) {
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
// ═══════════ TRAJES 3D POR SKIN ═══════════
// Cada skin tiene su traje en mundo/js/skins/<id>.js (sin imports; guia y contrato en
// mundo/js/skins/LEEME.md). tools/unir_skins.mjs los junta en skins3d.js, que es lo
// unico que carga el juego. Un traje es:
//   { id, base: { ropa, pantalon, botas, acento, cinto?, mangas?, manos?, hojaNeon? },
//     cuerpo?: { opciones extra de humano() }, escudoClase?: false,
//     cabeza?(r, K, ctx) -> tocado, vestir?(r, K, ctx) -> tocado | undefined }
// Si una skin no tiene traje (o el suyo falla al dibujarse) se ve con ROPA_SKIN +
// vestirSkin, el aspecto de reserva de siempre: un traje roto no tumba el juego.
const TRAJES = new Map();          // id de skin -> traje
const ERR_TRAJES = [];             // [{ id, donde, error }] (lo lee el taller)
let MEDIR_TRAJES = false;          // el taller cuenta lo que añade cada traje
// Registra (o reemplaza) el traje de una skin. Devuelve false si no tiene forma de traje.
export function registrarSkin3D(id, def) {
  if (typeof id !== 'string' || !id || !def || typeof def !== 'object') return false;
  if (def.base != null && typeof def.base !== 'object') return false;
  if (def.cabeza != null && typeof def.cabeza !== 'function') return false;
  if (def.vestir != null && typeof def.vestir !== 'function') return false;
  TRAJES.set(id, def);
  return true;
}
export function erroresSkin3D() { return ERR_TRAJES.slice(); }
// Solo para mundo/taller.html: cada duende lleva en m.traje lo que le añadio su traje.
export function depurarSkins3D(si) { MEDIR_TRAJES = !!si; }
function anotarErrorTraje(id, donde, e) {
  if (ERR_TRAJES.length >= 30 || ERR_TRAJES.some(x => x.id === id && x.donde === donde)) return;
  ERR_TRAJES.push({ id, donde, error: e });
  try { console.error('[skin3d] traje «' + id + '» (' + donde + '):', e); } catch (e2) {}
}
// Piezas, pivotes y mallas sueltas (las que no se pueden fundir: un draw call cada una) del rig.
function cuentaRig(r) {
  let piezas = 0, sueltas = 0;
  r.raiz.traverse(o => { if (o.isMesh) { piezas += o.geometry.userData.piezas || 1; if (brilloFusion(o) < 0) sueltas++; } });
  return [piezas, r.piv.length, sueltas];
}

// Atuendos de cabeza con nombre: los aventureros PNJ, el disfraz del editor de aspecto y
// la linea base de las skins disfraz. Devuelve el tocado, o null si no conoce el atuendo.
function ponerAtuendo(r, atuendo) {
  if (atuendo === 'frankenstein') {   // pelo negro plano y tornillos en el cuello
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'caja', '#141218', [0, 0.51 * H, -0.01 * H], [0.56 * H, 0.09 * H, 0.52 * H]);
    for (const x of [-1, 1]) M(g, 'cil', '#9aa3ad', [x * 0.3 * H, 0.12 * H, 0], [0.035 * H, 0.09 * H, 0.035 * H], [0, 0, PI / 2]);
    r.tocado = true; return 'gorra';
  }
  if (atuendo === 'lobo') {   // melena marron y orejas de lobo
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'semi', '#6b3f1f', [0, 0.4 * H, -0.03 * H], [0.32 * H, 0.2 * H, 0.31 * H]);
    for (const x of [-1, 1]) M(g, 'cono', '#6b3f1f', [x * 0.15 * H, 0.52 * H, -0.02 * H], [0.07 * H, 0.17 * H, 0.05 * H], [0, 0, -x * 0.25]);
    r.tocado = true; return 'gorra';
  }
  if (atuendo === 'esqueleto') {   // craneo de hueso sobre la cabeza
    const H = r.H, g = fuera(G(r.cabeza));
    M(g, 'semi', '#efe6cf', [0, 0.42 * H, 0], [0.31 * H, 0.22 * H, 0.3 * H]);
    for (const x of [-1, 1]) M(g, 'esferaB', '#1c1620', [x * 0.1 * H, 0.5 * H, 0.22 * H], [0.06 * H, 0.06 * H, 0.03 * H]);
    r.tocado = true; return 'gorra';
  }
  if (atuendo === 'bruja') { ACC.sombrero(r, '#3b1f4a', 0.95); return 'sombrero'; }
  if (atuendo === 'pirata') { ACC.sombrero(r, '#1c1a26', 0.32); M(fuera(G(r.cabeza)), 'caja', '#15121c', [0.12 * r.H, 0.31 * r.H, 0.27 * r.H], [0.14 * r.H, 0.13 * r.H, 0.03 * r.H]); return 'sombrero'; }   // parche en el ojo
  if (atuendo === 'militar') { ACC.gorra(r, '#3f5f2a'); return 'gorra'; }
  if (atuendo === 'vampiro') { ACC.capucha(r, '#5a0f1e'); return 'capucha'; }
  if (atuendo === 'momia') { ACC.capucha(r, '#e8e0c8'); ACC.mascara(r, '#d8cfb4'); return 'capucha'; }
  if (atuendo === 'campesino') { ACC.paja(r); return 'paja'; }
  return null;
}
// Tocado de la clase (y el escudo del guerrero, el halo del sacerdote, la mascara del picaro).
function tocadoClase(r, cl, cc) {
  if (cl === 'guerrero') { ACC.casco(r, '#9aa3ad', '#efe6cf'); escudo(r.manoI, '#7a4a26', 'redondo', null); return 'casco'; }
  if (cl === 'mago') { ACC.sombrero(r, osc(cc, 0.75), 0.8); return 'sombrero'; }
  if (cl === 'sacerdote') { ACC.capucha(r, '#f2efe6'); ACC.halo(r); return 'capucha'; }
  if (cl === 'picaro') { ACC.capucha(r, '#3d3550'); ACC.mascara(r); return 'capucha'; }
  return '';
}
// Caja de herramientas que reciben los trajes (no tienen imports). Una linea por
// herramienta en mundo/js/skins/LEEME.md.
const K = Object.freeze({
  THREE, PI, PIEL: PIEL_DUENDE, geos: Object.freeze(Object.keys(FABRICA)),
  M, MF, G, piv, fuera, mat, hx, osc, mez, ACC, capa, hombreras, espada, escudo, baston, auraSuelo,
  // Los adornos genericos de siempre (vestirSkin) con las banderas que se pasen:
  // poncho, corbata, capa, corona, neon... Devuelve el tocado (la capucha y la peluca lo cambian).
  generico(r, banderas, ctx) {
    const t = vestirSkin(r, Object.assign({}, ctx.base, banderas), ctx.cpo, ctx.tocado);
    ctx.tocado = t;
    return t;
  },
  // Un atuendo de cabeza con nombre (pirata, bruja, vampiro, momia, militar, campesino,
  // frankenstein, lobo, esqueleto). Devuelve su tocado ('' si no existe).
  atuendo(r, id) { return ponerAtuendo(r, id) ?? ''; },
});
try { for (const id in SKINS3D) if (SKINS3D[id]) registrarSkin3D(id, SKINS3D[id]); } catch (e) {}

// look = { cara 0-5, cuerpo 0-2, altura 0.9-1.12, pelo 0-7, colorPelo (indice) }
// grado 0-3: equipo y forja que se ven (filo que brilla; en 3, aura en el suelo). colorGrado: color
// de la rareza (grado 2-3). ligero: calidad baja, aura del suelo mas chica (y los trajes quitan adornos caros).
// Cabeza: manda el atuendo pasado por parametro (PNJ aventureros) o el disfraz del editor de
// aspecto; si no, la cabeza del traje de la skin; y solo si el traje no define cabeza, el tocado de la clase.
export function crearDuende(o = {}) {
  const { skin = 'comun', clase = null, arma = 'katana', look = null, atuendo = '', grado = 0, colorGrado = null, ligero = false } = o;
  const sk = SKINS[skin] || SKINS.comun;
  const idSkin = SKINS[skin] ? skin : 'comun';
  const cl = clase && CLASES[clase] ? clase : null;
  const lk = limpiarLook(look || LOOK_BASE);
  const brilla = !!(sk.premium || skin === 'legendaria');
  // Ropa segun la imagen de la skin; las premium (heroe teñido) en su color con neon.
  const RV = ROPA_SKIN[idSkin] || {
    ropa: sk.color, pantalon: hx(osc(sk.color, 0.45)), botas: '#26222e', acento: hx(mez(sk.color, '#ffffff', 0.55)), neon: sk.color, hombreras: true,
  };
  // Traje de la skin (o._sinTraje: el suyo fallo y se vuelve a armar con el aspecto de reserva).
  const def = o._sinTraje ? null : TRAJES.get(idSkin) || null;
  const bs = def && def.base;
  const R0 = !def ? RV : bs ? { ropa: bs.ropa ?? RV.ropa, pantalon: bs.pantalon ?? RV.pantalon, botas: bs.botas ?? RV.botas, acento: bs.acento ?? RV.acento, cinto: bs.cinto, mangas: bs.mangas, manos: bs.manos, hojaNeon: bs.hojaNeon }
    : { ropa: RV.ropa, pantalon: RV.pantalon, botas: RV.botas, acento: RV.acento, cinto: RV.cinto, hojaNeon: RV.hojaNeon };
  const ropa = R0.ropa;
  const r = nuevoRig('bipedo');
  const cpo = CUERPOS[lk.cuerpo] || CUERPOS[1];
  const oh = {
    piel: PIEL_DUENDE, ropa, ropaMat: mat(ropa, brilla ? { e: 0.3 } : null),
    pantalon: R0.pantalon, botas: R0.botas, cinto: R0.cinto || '#3a2412', mangas: R0.mangas, manos: R0.manos,
    // Orejas largas hacia arriba y afuera, como en los videos (antes casi horizontales).
    // Como la mascota $DUENDE (Descargas): cabeza cubo, cara propia, orejas con interior naranja.
    cabeza: 'duende', ojos: 'duende', ojosGrandes: lk.cara === 5, ojosVideo: true, mascota: lk.cara !== 5, cabezaCubo: lk.cara !== 5, orejaDentro: '#f07a3a',
    nariz: lk.cara === 5 ? 'bola' : null, orejas: 0.62, orejaRot: 0.98, orejasVivas: true, manoG: 1.36, cab: 1.18, L: 0.45, T: 0.46, A: 0.38,
    // (11-nov) Brazos, piernas y botas un 18 % mas gruesos y manos mas grandes: la mascota es rechoncha.
    ancho: cpo.ancho, panza: cpo.panza, grueso: cpo.grueso * 1.18,
  };
  if (def && def.cuerpo && typeof def.cuerpo === 'object') Object.assign(oh, def.cuerpo, { piel: PIEL_DUENDE, cabeza: 'duende', ojos: 'duende' });
  humano(r, oh);
  const cc = cl ? CLASES[cl].color : ropa;
  const gr = Math.max(0, Math.min(3, grado | 0)), cg = gr >= 2 && colorGrado ? colorGrado : '#ffe6b8';
  // Sin clase no lleva nada en la cabeza: se ve el peinado entero.
  let tocado = '';
  // Atuendos de los aventureros PNJ, como los duendes de las imagenes del dueño
  // (Descargas: pirata, militar, vampiro, momia, campesino). Sustituyen al tocado de clase.
  let at = atuendo || '';
  if (!def && !at && RV.atuendo) at = RV.atuendo;   // reserva: las skins disfraz traen su sombrero o peinado
  if (!at && lk.disfraz) at = DISFRAZ_ID[lk.disfraz] || '';
  const ctx = { skin: idSkin, sk, clase: cl, arma, lk, cpo, T: oh.T, L: oh.L, A: oh.A, H: r.H, ligero: !!ligero, grado: gr, PIEL: PIEL_DUENDE, base: R0, colorClase: cc, tocado: '' };
  let traje = null, donde = 'traje';
  try {
    const n0 = MEDIR_TRAJES && def ? cuentaRig(r) : null;
    let n1 = n0, n2 = n0;
    const tAt = at ? ponerAtuendo(r, at) : null;
    if (tAt != null) { tocado = tAt; if (n0) n2 = cuentaRig(r); }
    else if (def && def.cabeza) {
      donde = 'cabeza';
      tocado = def.cabeza(r, K, ctx);
      donde = 'traje';
      if (typeof tocado !== 'string') tocado = '';
      if (tocado) r.tocado = true;
      if (n0) n1 = n2 = cuentaRig(r);
      // La clase se sigue leyendo aunque la cabeza sea del traje: escudo del guerrero y halo del sacerdote.
      if (cl === 'guerrero' && def.escudoClase !== false) escudo(r.manoI, '#7a4a26', 'redondo', null);
      else if (cl === 'sacerdote') ACC.halo(r);
      if (n0) n2 = cuentaRig(r);
    } else {
      tocado = tocadoClase(r, cl, cc);
      if (n0) n2 = cuentaRig(r);   /* el tocado de la clase no cuenta como traje */
    }
    if (cl === 'guerrero') r.escudo = true;
    ctx.tocado = tocado;
    if (def) {
      if (def.vestir) {
        donde = 'vestir';
        const t2 = def.vestir(r, K, ctx);
        donde = 'traje';
        tocado = typeof t2 === 'string' ? t2 : ctx.tocado;
      } else tocado = K.generico(r, {}, ctx);
      if (n0) { const n3 = cuentaRig(r); traje = { piezas: n1[0] - n0[0] + n3[0] - n2[0], pivotes: n1[1] - n0[1] + n3[1] - n2[1], sueltas: n1[2] - n0[2] + n3[2] - n2[2] }; }
    } else tocado = vestirSkin(r, R0, cpo, tocado);
  } catch (e) {
    if (!def) throw e;
    // El traje fallo: se apunta y el duende se arma de nuevo con el aspecto de reserva.
    anotarErrorTraje(idSkin, donde, e);
    return crearDuende(Object.assign({}, o, { _sinTraje: true }));
  }
  // Pelo y rasgos de la cara (una malla cada uno, fuera de la medida de alto).
  const colorPelo = hx(APARIENCIA.colorPelo[lk.colorPelo] || APARIENCIA.colorPelo[1]);
  const pelo = tocado === 'peluca' ? [] : partesPelo(lk.pelo, tocado);
  if (pelo.length) fuera(MF(r.cabeza, pelo, colorPelo, null, null, r.H));
  const cara = partesCara(lk.cara, colorPelo);
  if (cara.length) fuera(MF(r.cabeza, cara, null, null, null, r.H));
  formaDuende(r, R0, lk, colorPelo, oh.L);
  // Arma: los de vara (mago, sacerdote) llevan baston.
  const G2 = gr ? { gr, cg } : {};
  if (cl && CLASES[cl].basico === 'vara') {
    const gb = baston(r, r.manoD, cl === 'sacerdote' ? '#fff3b0' : cc);
    if (gr) M(gb, 'cil', mat(cg, { e: gr >= 3 ? 0.9 : gr >= 2 ? 0.7 : 0.4 }), [0, 0.92, 0], gr >= 3 ? [0.14, 0.09, 0.14] : [0.09, 0.09, 0.09]).userData.sinFlash = true;   // anillo de grado bajo la punta
  } else if (arma === 'dagas') {
    // Brillo segun la rareza del arma: dagas violeta, odachi blanco frio, chispa celeste.
    espada(r.manoD, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color, filo: ARMAS.dagas.color, r, ...G2 });
    espada(r.manoI, { largo: 0.32, daga: true, guarda: ARMAS.dagas.color, filo: ARMAS.dagas.color, r, ...G2 });
    r.dosArmas = true;
  } else if (arma === 'odachi') espada(r.manoD, { largo: 1.25, hoja: '#ffffff', guarda: '#2b2b2b', filo: '#cfe8ff', r, ...G2 });
  else if (arma === 'chispa') espada(r.manoD, { largo: 0.8, hoja: ARMAS.chispa.color, e: 0.9, guarda: '#1e3a5f', filo: ARMAS.chispa.color, r, ...G2 });
  else if (R0.hojaNeon) espada(r.manoD, { largo: 0.95, hoja: R0.hojaNeon, e: 0.9, guarda: '#ff3cf0', filo: R0.hojaNeon, r, ...G2 });
  else espada(r.manoD, Object.assign({ largo: 0.75, guarda: ARMAS.katana.color, ...G2 }, gr >= 2 ? { filo: cg, r } : {}));   // forja 2-3: funda que late (se ve en el celular)
  if (brilla) auraSuelo(r, sk.color, 0.55);
  else if (gr >= 3) auraSuelo(r, cg, ligero ? 0.4 : 0.45);   // equipo legendario o forja alta: aura en el suelo (tambien en calidad baja, mas chica)
  // Clave de la fusion compartida: todo lo que cambia las piezas (si aun asi no coinciden, tomarFusion hornea una propia).
  const m = new Modelo(r, 1.75 * lk.altura, 'd:' + JSON.stringify([skin, cl, arma, Object.assign({}, lk, { altura: 0 })]) + (gr ? '#g' + gr + cg : '') + (ligero ? '#l' : '') + (atuendo ? '#a' + atuendo : '') + (o._sinTraje ? '#r' : ''));
  m.tipo = 'duende';
  m.look = lk;
  if (traje) m.traje = traje;
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

// ── KIT DE CRIATURAS (monstruos, jefes y PNJ) ──
// Geometrias facetadas baratas para dar forma (muslo, pecho, placas, garras) sin
// subir los triangulos: un miembro son 24 y una cuña 8, frente a los 120 de una esfera.
function geoCuna() {
  // Prisma en cuña: base 1 x 1 en z = 0 y filo horizontal en z = 1 (hocicos, placas, hojas).
  const A = [-0.5, -0.5, 0], B = [0.5, -0.5, 0], C = [0.5, 0.5, 0], D = [-0.5, 0.5, 0], E = [-0.5, 0, 1], F = [0.5, 0, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([A, D, C, A, C, B, D, E, F, D, F, C, A, F, E, A, B, F, A, E, D, B, C, F].flat(), 3));
  g.computeVertexNormals();
  return g;
}
Object.assign(FABRICA, {
  miembro: () => new THREE.CylinderGeometry(1, 0.68, 1, 6).translate(0, -0.5, 0),   // cuelga de y = 0, fino abajo
  pecho: () => new THREE.CylinderGeometry(1, 0.7, 1, 6).translate(0, 0.5, 0),       // base en y = 0, ancho arriba
  aro6: () => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),                      // banda abierta (cintos, vendas, ribetes)
  semiB: () => new THREE.SphereGeometry(1, 6, 2, 0, PI * 2, 0, PI / 2),             // cupula baja (hombreras, placas)
  cuna: geoCuna,
});

// Cuerpo de criatura bipeda: mismas marcas de rig que humano() (pI, pD, cuerpo, bI, bD,
// manoI, manoD, cabeza, H) pero con rodillas y codos doblados, pecho ancho y manos con garras.
// La cabeza la pone quien llama (r.cabeza queda vacia). o: { piel, ropa, pantalon, botas,
// mangas, antebrazo, manos, L, T, A, ancho, panza, grueso, cab, encorvado, tunica, ribete,
// garras, manoG, brazoG, hombro (color de la bola del hombro), ligero }
function criatura(r, o) {
  const R = r.raiz, lig = !!o.ligero;
  const L = o.L ?? 0.4, T = o.T ?? 0.46, Ab = o.A ?? 0.5, W = o.ancho ?? 1, H = o.cab ?? 1, P = o.panza ?? 1;
  const gr = 0.085 * (o.grueso ?? 1), enc = o.encorvado || 0;
  const piel = hx(o.piel), ropa = hx(o.ropa), pant = hx(o.pantalon ?? osc(o.ropa, 0.62)), bota = hx(o.botas ?? o.piel);
  const manga = hx(o.mangas ?? o.ropa), ante = hx(o.antebrazo ?? o.piel), mano = hx(o.manos ?? o.piel), una = '#e9dfc4';
  if (o.tunica) {
    const tn = hx(o.tunica), tg = r.tunica = piv(r, G(R, [0, 0, 0]));
    const Q = [['tronco', tn, [0, 0, 0], [0.37 * W * P, L + 0.07, 0.33 * W * P]]];
    if (o.ribete) Q.push(['aro6', hx(o.ribete), [0, 0.035, 0], [0.4 * W * P, 0.07, 0.36 * W * P]]);
    MF(tg, Q);
  } else {
    for (const s of [1, -1]) {
      const p = piv(r, G(R, [0.13 * W * s, L, 0]));
      const Q = [
        ['miembro', pant, [0, 0.02, 0], [gr * 1.3, L * 0.56, gr * 1.4], [-0.32, 0, 0]],                 // muslo (rodilla adelante)
        ['miembro', o.botas ? pant : piel, [0, -L * 0.5, L * 0.17], [gr * 0.95, L * 0.46, gr], [0.36, 0, 0]],   // espinilla
        ['caja', bota, [0, -L + 0.05, 0.07], [gr * 2, 0.1, 0.27]],
      ];
      if (o.garras && !o.botas && !lig) for (const x of [-0.55, 0.55]) Q.push(['cono4', una, [x * gr, -L + 0.035, 0.2], [0.024, 0.075, 0.024], [PI / 2, 0, 0]]);
      MF(p, Q);
      if (s > 0) r.pI = p; else r.pD = p;
    }
  }
  const cu = r.cuerpo = piv(r, G(R, [0, L, 0], [enc, 0, 0]));
  MF(cu, [
    ['caja', pant, [0, 0.03, 0], [0.33 * W, 0.15, 0.23]],                                 // cadera
    ['esferaB', ropa, [0, T * 0.34, 0.03 * P], [0.27 * W * P, T * 0.42, 0.22 * P]],        // barriga
    ['pecho', ropa, [0, T * 0.26, 0], [0.3 * W, T * 0.64, 0.2]],                           // pecho: ancho en los hombros
    ['caja', ropa, [0, T * 0.9, -0.03], [0.34 * W, 0.1, 0.2]],                             // lomo entre los hombros
  ]);
  const hy = T * 0.84, hom = 0.3 * W + 0.05, g2 = gr * (o.brazoG ?? 0.82);
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [hom * s, hy, 0], [o.brazoX ?? -enc - 0.08, 0, (o.brazoZ ?? 0.16) * s]));
    const hm = [0, -Ab * 0.98, Ab * 0.21], rm = 0.082 * (o.manoG ?? 1);
    const Q = [
      ['icos', hx(o.hombro ?? o.mangas ?? o.ropa), [0, 0, 0], g2 * 1.4],
      ['miembro', manga, [0, 0, 0], [g2, Ab * 0.52, g2]],
      ['miembro', ante, [0, -Ab * 0.47, 0], [g2 * 1.08, Ab * 0.55, g2 * 1.08], [-0.4, 0, 0]],       // antebrazo (codo doblado)
      ['icos', mano, hm, rm],
    ];
    if (o.garras && !lig) for (const [x, z] of [[-0.6, 0.2], [0, 0.55], [0.6, 0.2]]) Q.push(['cono4', una, [hm[0] + x * rm, hm[1] - rm * 0.6, hm[2] + z * rm], [0.02, 0.085, 0.02], [PI - 0.55, 0, 0]]);
    MF(b, Q);
    const mn = G(b, hm);
    if (s > 0) { r.bI = b; r.manoI = mn; } else { r.bD = b; r.manoD = mn; }
  }
  r.cabeza = piv(r, G(cu, [0, T + 0.01, o.cuelloZ ?? 0], [-enc * 0.8, 0, 0]));
  r.H = H; r.topeCabeza = 0.54 * H;
  return r;
}

// Cabeza de goblin: craneo (mismo sitio y tamaño que en humano(): los cascos encajan),
// nariz ganchuda, orejas grandes con su interior, cuencas oscuras con ceño en V y una
// mandibula saliente con colmillos que se abre al gruñir y al atacar (r.mandibula).
// o: { piel, ojos (color), amigo, ligero, mascara (color del pañuelo: tapa la boca), colmillos }
function cabezaGoblin(r, o) {
  const cb = r.cabeza, H = r.H, lig = !!o.ligero, amigo = !!o.amigo;
  const piel = hx(o.piel), pielO = hx(osc(o.piel, 0.7));
  const C = [
    ['esfera', piel, [0, 0.26, 0], [0.3, 0.28, 0.28]],
    ['cono', hx(osc(o.piel, 0.86)), [0, 0.27, 0.2], [0.075, amigo ? 0.24 : 0.3, 0.07], [PI / 2 + (amigo ? 0.3 : 0.5), 0, 0]],
  ];
  const dentro = hx(mez(o.piel, '#c8705a', 0.55)), atras = amigo ? -0.25 : 0.35;
  const oreja = x => [
    ['cono', piel, [0, 0, 0], [0.09, 0.42, 0.05], [0, x * atras, -x * 1.12]],
    ['cono', dentro, [x * 0.012, 0.004, 0.03], [0.055, 0.33, 0.028], [0, x * atras, -x * 1.12]],
  ];
  for (const x of [-1, 1]) {
    if (amigo) {
      const og = piv(r, G(cb, [x * 0.25 * H, 0.3 * H, -0.02 * H]));
      MF(og, oreja(x), null, null, null, H);
      (r.orejas || (r.orejas = [])).push([og, x]);
    } else for (const p of oreja(x)) C.push([p[0], p[1], [p[2][0] + x * 0.25, p[2][1] + 0.3, p[2][2] - 0.02], p[3], p[4]]);
  }
  if (amigo) {
    // PNJ: la cara amable de siempre (ojos del duende 2D) y una sonrisa.
    const cara = partesOjos2D(o.piel), esOjo = p => p[2][1] >= 0.25 && p[2][1] <= 0.345;
    for (const p of cara) if (!esOjo(p)) C.push(p);
    C.push(['caja', '#3a1c14', [0, 0.115, 0.25], [0.14, 0.022, 0.03]]);
    r.ojosP = piv(r, G(cb, [0, 0.3 * H, 0]));
    MF(r.ojosP, cara.filter(esOjo), null, null, [0, -0.3 * H, 0], H);
  } else {
    for (const x of [-1, 1]) {
      C.push(['caja', '#17120f', [x * 0.105, 0.305, 0.215], [0.13, 0.085, 0.1], [0, x * 0.3, x * 0.2]]);       // cuenca
      C.push(['caja', pielO, [x * 0.112, 0.368, 0.225], [0.18, 0.055, 0.11], [0.2, 0, x * 0.38]]);             // ceño
    }
    const ojo = mat(o.ojos, { e: 1 });
    r.ojosP = piv(r, G(cb, [0, 0.305 * H, 0]));
    for (const x of [-1, 1]) M(r.ojosP, 'esferaB', ojo, [x * 0.105 * H, 0, 0.256 * H], [0.05 * H, 0.034 * H, 0.026 * H], [0, 0, x * 0.3]);
    r.ojosMalos = true;
    const J = [];
    if (o.mascara) {
      // Pañuelo del asesino: tapa boca y menton; la nariz asoma por encima.
      const tela = hx(o.mascara);
      C.push(['caja', tela, [0, 0.12, 0.11], [0.42, 0.13, 0.3], [0.12, 0, 0]],['cuna', hx(osc(o.mascara, 0.8)), [0, 0.07, 0.2], [0.26, 0.1, 0.12], [PI / 2 - 0.2, 0, 0]]);
    } else {
      C.push(['caja', '#2a0f14', [0, 0.146, 0.185], [0.2, 0.034, 0.13]]);                                         // boca por dentro
      J.push(['caja', pielO, [0, -0.03, 0.115], [0.3, 0.085, 0.25]], ['caja', '#e9dfc4', [0, 0.02, 0.228], [0.15, 0.028, 0.02]]);
      for (const x of [-1, 1]) J.push(['cono4', '#f1e9cf', [x * 0.108, 0, 0.218], [0.03, o.colmillos ?? 0.12, 0.03], [0.12, 0, -x * 0.12]]);
      if (lig) for (const p of J) C.push([p[0], p[1], [p[2][0], p[2][1] + 0.125, p[2][2] + 0.01], p[3], p[4]]);
      else { r.mandibula = piv(r, G(cb, [0, 0.125 * H, 0.01 * H])); MF(r.mandibula, J, null, null, null, H); }
    }
  }
  MF(cb, C, null, null, null, H);
}

// Capa que cuelga de la nuca y ondea (r.cuelgan). En ligero va pegada al cuerpo, sin pivote.
function capaViva(r, color, T, largo, o = {}) {
  const c1 = hx(color), c2 = hx(osc(color, 0.72)), an = o.ancho ?? 0.46;
  const P = [
    ['caja', c1, [0, -largo * 0.25, -0.01], [an * 0.8, largo * 0.5, 0.035]],
    ['caja', c2, [0, -largo * 0.72, -0.03], [an, largo * 0.48, 0.035], [0.1, 0, 0]],
  ];
  if (!o.ligero) for (const x of [-0.36, -0.12, 0.12, 0.36]) P.push(['cono4', c2, [x * an, -largo * 0.94, -0.05], [an * 0.13, largo * (0.14 + 0.1 * Math.abs(x)), 0.02], [PI, 0, 0]]);
  if (o.ligero) { MF(r.cuerpo, P, null, null, [0, T * 0.86, -0.21]); return null; }
  const g = piv(r, G(r.cuerpo, [0, T * 0.86, -0.2], [0.14, 0, 0]));
  MF(g, P);
  (r.cuelgan || (r.cuelgan = [])).push([g, 'x', 0.04, 0.32, 2.1]);
  return g;
}
// Casco de hierro (unidades de cabeza): cupula con ala y, a pedido, nasal, carrilleras,
// pincho, cuernos o cresta (crestaT = de oreja a oreja, como los centuriones).
function cascoGob(r, color, o = {}) {
  r.tocado = true;
  const c = hx(color), c2 = hx(osc(color, 0.66));
  // La cupula empieza por encima de los ojos (y = 0,35): la mirada roja se ve bajo el ala.
  const P = [['semi', c, [0, 0.35, 0], [0.325, 0.25, 0.315]], ['caja', c2, [0, 0.365, 0.02], [0.66, 0.035, 0.68]]];
  if (o.nasal) P.push(['caja', c2, [0, 0.27, 0.3], [0.05, 0.2, 0.035]]);
  if (o.mejillas) for (const x of [-1, 1]) P.push(['caja', c, [x * 0.275, 0.2, 0.06], [0.04, 0.3, 0.2]]);
  if (o.pincho) P.push(['cono4', c2, [0, 0.58, 0], [0.05, 0.2, 0.05]]);
  if (o.cuernos) for (const x of [-1, 1]) P.push(['cono', hx(o.cuernos), [x * 0.27, 0.44, 0], [0.07, 0.36, 0.07], [0.25, 0, -x * 0.85]]);
  if (o.cresta) P.push(['caja', c2, [0, 0.6, -0.02], o.crestaT ? [0.5, 0.04, 0.07] : [0.07, 0.04, 0.44]], ['caja', hx(o.cresta), [0, 0.69, -0.02], o.crestaT ? [0.56, 0.13, 0.07] : [0.07, 0.13, 0.5]]);
  return fuera(MF(r.cabeza, P, null, null, null, r.H));
}
// Hombreras de placa con reborde (y pua si se pide).
function hombrerasB(r, color, o = {}) {
  const c = hx(color), c2 = hx(osc(color, 0.68)), k = o.k ?? 1;
  for (const b of [r.bI, r.bD]) {
    const s = b === r.bI ? 1 : -1;
    const P = [['semiB', c, [0.02 * s, -0.01, 0], [0.16 * k, 0.12 * k, 0.17 * k]], ['aro6', c2, [0.02 * s, 0, 0], [0.18 * k, 0.03, 0.19 * k]]];
    if (o.pua) P.push(['cono4', hx(o.pua), [0.03 * s, 0.08 * k, 0], [0.045 * k, 0.22 * k, 0.045 * k], [0, 0, -s * 0.35]]);
    if (o.piel) P.push(['esferaB', hx(o.piel), [0.03 * s, -0.02, -0.03], [0.19 * k, 0.1 * k, 0.2 * k]]);   // manto de piel
    fuera(MF(b, P));
  }
}
// Escudos de los goblins: 'torre' (rectangular con umbo), 'lagrima' (de caballero) o 'rodela'.
function escudoGob(mano, forma, color, borde = '#c9a227', emblema) {
  const g = fuera(G(mano, [0.09, 0.05, 0.04]));
  mano.userData.escudo = true;
  const c = hx(color), b = hx(borde), P = [];
  if (forma === 'torre') {
    P.push(['caja', c, [0, 0, 0], [0.045, 0.56, 0.34]], ['caja', b, [0.005, 0.27, 0], [0.05, 0.04, 0.36]], ['caja', b, [0.005, -0.27, 0], [0.05, 0.04, 0.36]], ['icos', b, [0.04, 0, 0], 0.07]);
    if (emblema) P.push(['caja', hx(emblema), [0.026, 0, 0], [0.012, 0.42, 0.05]], ['caja', hx(emblema), [0.026, 0.05, 0], [0.012, 0.05, 0.24]]);
  } else if (forma === 'lagrima') {
    P.push(['caja', c, [0, 0.1, 0], [0.045, 0.3, 0.34]], ['cuna', c, [0, -0.05, 0], [0.045, 0.34, 0.3], [PI / 2, 0, PI / 2]], ['caja', b, [0.005, 0.24, 0], [0.05, 0.04, 0.36]], ['icos', b, [0.04, 0.08, 0], 0.06]);
    if (emblema) P.push(['caja', hx(emblema), [0.026, 0.02, 0], [0.012, 0.36, 0.06]]);
  } else P.push(['cil', c, [0, 0, 0], [0.26, 0.04, 0.26], [0, 0, PI / 2]], ['aro6', b, [0, 0, 0], [0.28, 0.05, 0.28], [0, 0, PI / 2]], ['icos', b, [0.03, 0, 0], 0.07]);
  MF(g, P);
  return g;
}
// Armas de monstruo (la hoja apunta a +z como las del jugador).
function garroteClavos(mano, lig) {
  const g = grupoArma(mano);
  const P = [['tronco', '#6b4a2b', [0, 0, 0.72], [0.115, 0.74, 0.115], [-PI / 2, 0, 0]], ['aro6', '#c9b48a', [0, 0, 0.03], [0.052, 0.12, 0.052], [PI / 2, 0, 0]], ['aro6', '#4a4038', [0, 0, 0.62], [0.118, 0.06, 0.118], [PI / 2, 0, 0]]];
  if (!lig) P.push(['cono4', '#d8d0b8', [0.09, 0, 0.6], [0.03, 0.1, 0.03], [0, 0, -PI / 2]], ['cono4', '#d8d0b8', [-0.09, 0, 0.5], [0.03, 0.1, 0.03], [0, 0, PI / 2]], ['cono4', '#d8d0b8', [0, 0.09, 0.52], [0.03, 0.1, 0.03]], ['cono4', '#d8d0b8', [0, -0.09, 0.64], [0.03, 0.1, 0.03], [PI, 0, 0]]);
  MF(g, P);
  return g;
}
function dagaCurva(mano, filo = '#c4ccd4') {
  const g = grupoArma(mano);
  MF(g, [['caja', '#2b2233', [0, 0, -0.04], [0.04, 0.045, 0.17]], ['caja', '#8a6a2a', [0, 0, 0.06], [0.11, 0.05, 0.03]], ['caja', filo, [0, 0.005, 0.19], [0.022, 0.075, 0.24]], ['cuna', filo, [0, 0.03, 0.3], [0.022, 0.075, 0.16], [-0.35, 0, 0]]]);
  return g;
}
// Lanza con pendon. Con rig (r) la muñeca es un pivote: en la estocada la punta va al frente.
function lanzaGob(r, mano, pendon = '#a51f26', lig) {
  const g = fuera(G(mano, [0, 0, 0.02], [-1.35, 0, 0]));
  const P = [['cil', '#6b4a2b', [0, 0, 0.57], [0.025, 1.7, 0.025], [PI / 2, 0, 0]], ['cono4', '#d0d6dc', [0, 0, 1.4], [0.055, 0.26, 0.03], [PI / 2, 0, 0]], ['aro6', '#8a6a2a', [0, 0, 1.37], [0.04, 0.06, 0.04], [PI / 2, 0, 0]]];
  if (pendon) P.push(['cuna', hx(pendon), [0, -0.02, 1.22], [0.016, 0.2, 0.3], [PI / 2, 0, 0]]);
  MF(g, P);
  if (!lig) { piv(r, g); r.muneca = g; r.munecaInc = 1.35; r.cmb = 2; }
  return g;
}
// Hacha de guerra de dos filos (a dos manos).
function hachaDoble(mano, metal = '#e0c070', mango = '#4a3420', k = 1) {
  const g = grupoArma(mano, -0.7), m = hx(metal), m2 = hx(osc(metal, 0.7));
  MF(g, [
    ['cil', hx(mango), [0, 0, 0.36 * k], [0.03, 0.98 * k, 0.03], [PI / 2, 0, 0]],
    ['cuna', m, [0, 0.31 * k, 0.7 * k], [0.035, 0.46 * k, 0.28 * k], [PI / 2, 0, 0]],
    ['cuna', m, [0, -0.31 * k, 0.7 * k], [0.035, 0.46 * k, 0.28 * k], [-PI / 2, 0, 0]],
    ['caja', m2, [0, 0, 0.7 * k], [0.06, 0.1 * k, 0.14 * k]],
    ['cono4', m2, [0, 0, 0.84 * k], [0.035, 0.16 * k, 0.035], [PI / 2, 0, 0]],
  ]);
  return g;
}

// Animacion extra de las criaturas (la llama animarRig despues de la pose del estado; solo
// mira marcas del rig que ponen los monstruos, asi que el duende no cambia):
//   r.cuelgan [[pivote, eje, vaiven quieto, vuelo al moverse, velocidad]]: capas, pendones, colas.
//   r.mandibula (bipedos): gruñe quieto y se abre al atacar, al recibir y al morir.
//   r.acecha: quieto, se agazapa y tantea el arma.   r.dosManos: el tajo va con los dos brazos.
//   r.muneca + r.munecaInc: la lanza apunta al frente en la estocada.   r.cabezazo: embiste con la cabeza.
//   r.zarpa (cuadrupedos): se agazapa y da el zarpazo con una pata.   r.buche: saco que se hincha.
//   r.caer: 'frente' (de rodillas y de bruces), 'huesos' (se desarma), 'esfuma' (gira y se deshace).
function animarExtra(m, r, b, est, te, t, f, mueve, ataca, aA, kA) {
  const A = m.alto, muerto = est === 'muere', { cuerpo: cu, cabeza: cb, bI, bD, pI, pD } = r;
  if (r.cuelgan) for (const [o, eje, quieto, vuelo, vel] of r.cuelgan) o.rotation[eje] += Math.sin(t * vel + o.id) * quieto + (mueve ? vuelo * (1 + 0.25 * Math.sin(f * 2)) : 0) + (ataca ? aA * vuelo * 0.7 : 0);
  if (r.buche) r.buche.scale.multiplyScalar(1 + 0.16 * Math.max(0, Math.sin(t * 1.9)) + (est === 'lanza' ? 0.3 : 0));
  if (r.modo === 'bipedo') {
    if (r.mandibula) r.mandibula.rotation.x += muerto ? 0.45 * Math.min(1, te / 0.3) : ataca ? aA * 0.55 : est === 'herido' ? 0.4 * Math.max(0, 1 - te / 0.35) : est === 'lanza' ? 0.3 : 0.1 * Math.max(0, Math.sin(t * 1.7));
    if (r.acecha && est === 'quieto') {
      const w = 0.5 + 0.5 * Math.sin(t * 1.1), k = r.acecha;
      b.position.y -= 0.012 * A * w * k;
      if (cu) cu.rotation.x += 0.05 * w * k;
      if (cb) cb.rotation.x -= 0.04 * w * k;
      if (bD) bD.rotation.x -= 0.14 * Math.max(0, Math.sin(t * 0.8 + 1)) * k;
    }
    if (ataca) {
      const k = Math.min(kA, 1), vuelta = kA < 1 ? 1 : Math.max(0, 1 - (kA - 1) * 4);
      if (r.dosManos && bI && bD) {
        const ang = k < 0.4 ? lerp(0, -3.3, suave(k / 0.4)) : lerp(-3.3, -0.5, suave((k - 0.4) / 0.6));
        bI.rotation.x += ang * vuelta * 0.92; bI.rotation.z -= 0.55 * aA; bD.rotation.z += 0.3 * aA;
        if (cu) cu.rotation.x += (k < 0.4 ? -0.18 * suave(k / 0.4) : lerp(-0.18, 0.3, suave((k - 0.4) / 0.6))) * vuelta;
      }
      if (r.muneca) {
        const ke = k < 0.35 ? lerp(0, 0.8, suave(k / 0.35)) : lerp(0.8, -1.55, suave(clamp((k - 0.35) / 0.25, 0, 1)));
        r.muneca.rotation.x += (r.munecaInc - 0.15) * suave(clamp(k / 0.3, 0, 1)) * vuelta - ke * vuelta;
      }
      if (r.cabezazo && cu) { cu.rotation.x += (k < 0.4 ? -0.28 * suave(k / 0.4) : lerp(-0.28, 0.5, suave((k - 0.4) / 0.35))) * vuelta; b.position.y += aA * 0.05 * A; }
    }
  } else if (r.modo === 'cuadrupedo' && r.zarpa) {
    if (ataca) {
      const k = Math.min(kA, 1), carga = k < 0.4 ? suave(k / 0.4) : Math.max(0, 1 - (k - 0.4) / 0.3);
      b.position.z -= carga * 0.08 * A; b.position.y -= carga * 0.04 * A; b.rotation.x -= carga * 0.06;
      const p = r.patas[0] && r.patas[0][0];
      if (p) p.rotation.x -= (k < 0.4 ? -0.3 * suave(k / 0.4) : 1.25 * arco((k - 0.4) / 0.6));
    } else if (est === 'quieto') b.position.y -= 0.012 * A * (0.5 + 0.5 * Math.sin(t * 1.3));
  }
  if (muerto) {
    const k = Math.min(1, te / 1.4);
    if (r.caer === 'frente') {
      const k1 = suave(Math.min(1, k / 0.3)), k2 = suave(clamp((k - 0.25) / 0.3, 0, 1));
      b.position.y -= 0.16 * A * k1 * (1 - k2);
      if (pI) { pI.rotation.x += 1.2 * k1 * (1 - k2); pD.rotation.x += 0.9 * k1 * (1 - k2); }
      if (cu) cu.rotation.x += 0.3 * k1 * (1 - k2);
      if (cb) cb.rotation.x += 0.5 * k1 * (1 - k2);
      b.rotation.x = (PI / 2) * 0.94 * k2;
    } else if (r.caer === 'huesos') {
      const k1 = suave(Math.min(1, k / 0.4));
      b.scale.y *= 1 - 0.7 * k1; b.scale.x *= 1 + 0.2 * k1; b.scale.z *= 1 + 0.2 * k1;
      if (cb) { cb.rotation.z += 1.3 * k1; cb.rotation.x += 0.6 * k1; cb.position.x += 0.28 * k1; }
      if (bI) { bI.rotation.z += 0.7 * k1; bD.rotation.z -= 0.7 * k1; bD.rotation.x -= 0.8 * k1; }
      if (pI) { pI.rotation.z += 0.55 * k1; pD.rotation.z -= 0.55 * k1; }
      if (cu) cu.rotation.x += 0.5 * k1;
    } else if (r.caer === 'esfuma') {
      const k1 = suave(k);
      b.rotation.y += k1 * 7; b.position.y += 0.25 * A * k1;
      b.scale.set(Math.max(0.01, 1 - k1), Math.max(0.01, (1 + 0.7 * k1) * (1 - k1 * k1)), Math.max(0.01, 1 - k1));
    }
  }
}

// ── GOBLINS ──
const GOB = {
  // Colores sacados de las hojas 2D (assets/enemigos/sheets/<hoja>.png).
  goblin_normal:     { piel: '#4f8a3c', ropa: '#8a8a86', pantalon: '#6b4420', mangas: 'piel', enc: 0.24 },
  goblin_samurai:    { piel: '#4f8a3c', ropa: '#cfcfcf', pantalon: '#8a8a94', botas: '#4a4a52', enc: 0.1 },
  goblin_mage:       { piel: '#4f8a3c', ropa: '#55489a', tunica: true, ribete: '#c9a227', enc: 0.14 },
  goblin_peasant:    { piel: '#4f8a3c', ropa: '#8a5a22', pantalon: '#5e3a14', botas: '#3e2410', pelo: [1, '#5a3418'], enc: 0.2 },
  goblin_assassin:   { piel: '#4f8a3c', ropa: '#34347a', pantalon: '#24244f', botas: '#17172f', ancho: 0.92, enc: 0.3 },
  goblin_guard:      { piel: '#4f8a3c', ropa: '#9a9aa0', pantalon: '#5a5a66', botas: '#4a4a52', armadura: true, enc: 0.12 },
  goblin_knight:     { piel: '#4f8a3c', ropa: '#b4b4ba', pantalon: '#6a6a74', botas: '#55555e', armadura: true, pelo: [7, '#6b3a1c'], enc: 0.1 },
  goblin_lord:       { piel: '#4f8a3c', ropa: '#9a9a9a', tunica: true, ribete: '#f0e8d8', panza: 1.28, enc: 0.08 },
  goblin_centurion:  { piel: '#4f8a3c', ropa: '#c8904a', pantalon: '#7a4a22', botas: '#5a3a1a', armadura: true, enc: 0.08 },
  goblin_battlelord: { piel: '#4f8a3c', ropa: '#d8a848', pantalon: '#7a5226', botas: '#5a3a1c', ancho: 1.16, armadura: true, enc: 0.14 },
};
function goblin(c, v) {
  const d = GOB[v] || GOB.goblin_normal, r = nuevoRig('bipedo'), lig = !!c.ligero, amigo = !!c.amigo, jefe = !!c.jefe;
  // Con tinte (jefes, la corte, PNJ) el color va a la tela o las placas; lo de debajo queda
  // oscuro para que no sea un muñeco de un solo color.
  const acento = c.color || '#a51f26', ropa = jefe && c.color ? mez(c.color, '#24242e', 0.5) : principal(c, d.ropa);   /* jefes: placas oscuras teñidas y el tinte vivo en capa, cresta, hombreras y gema */
  const pant = c.color ? mez(ropa, '#17151f', 0.62) : d.pantalon;
  const T = 0.46, L = d.tunica ? 0.44 : 0.4, W = (d.ancho ?? 1) * (jefe ? 1.06 : 1), P = d.panza ?? (d.armadura ? 1 : 1.12);
  criatura(r, {
    ligero: lig, piel: d.piel, ropa, pantalon: pant, botas: c.color && d.botas ? mez(ropa, '#101016', 0.72) : d.botas,
    mangas: d.mangas === 'piel' ? d.piel : ropa, antebrazo: d.armadura ? osc(ropa, 0.72) : d.piel,
    cab: 1.08, L, T, A: 0.5, ancho: W, panza: P, encorvado: amigo ? 0.05 : d.enc, cuelloZ: amigo ? 0 : 0.03,
    tunica: d.tunica ? ropa : null, ribete: d.tunica ? d.ribete : null, garras: !amigo, manoG: 1.15,
  });
  cabezaGoblin(r, { piel: d.piel, ojos: v === 'goblin_assassin' ? '#ffe14a' : jefe && c.color ? mez(c.color, '#ffffff', 0.25) : '#ff3b2f', amigo, ligero: lig, mascara: v === 'goblin_assassin' ? osc(ropa, 0.8) : null });
  if (d.pelo) fuera(MF(r.cabeza, partesPelo(d.pelo[0], ''), d.pelo[1], null, null, r.H));
  // Detalles del torso (se funden con el cuerpo: no cuestan dibujos).
  const cu = r.cuerpo, D = [], cuero = '#3a2412', oro = '#c9a227';
  const cinto = (c1 = cuero, hebilla = oro) => D.push(['aro6', c1, [0, T * 0.2, 0.012 * P], [0.27 * W * P, 0.055, 0.238 * P]], ['caja', hebilla, [0, T * 0.2, 0.235 * P], [0.075, 0.065, 0.03]]);
  const harapos = (c1, n = 4) => { if (!lig) for (let i = 0; i < n; i++) { const a = -1.9 + (3.8 * i) / (n - 1); D.push(['cono4', hx(c1), [Math.sin(a) * 0.2 * W, 0.07, Math.cos(a) * 0.19 * P], [0.06, 0.13 + (i % 2) * 0.04, 0.03], [PI, 0, 0]]); } };
  const correa = (c1 = cuero) => { if (!lig) D.push(['caja', c1, [0.01, T * 0.56, 0.2], [0.06, T * 1.0, 0.035], [-0.12, 0, -0.85]]); };
  const gema = () => { if (jefe && c.color) M(cu, 'icos', mat(c.color, { e: 0.9 }), [0, T * 0.62, 0.2], 0.05); };
  switch (v) {
    case 'goblin_normal':
      harapos(osc(ropa, 0.8)); cinto('#5a4630', '#8a7a5a'); correa();
      if (!lig) D.push(['caja', '#6b4a2b', [-0.2 * W, T * 0.12, 0.13], [0.1, 0.11, 0.08]], ['cono4', '#e9dfc4', [0.03, T * 0.84, 0.2], [0.026, 0.08, 0.026], [PI, 0, 0]]);
      garroteClavos(r.manoD, lig);
      for (const b of [r.bI, r.bD]) MF(b, [['aro6', '#c9b48a', [0, -0.5 * 0.72, 0.5 * 0.1], [0.085, 0.09, 0.085], [-0.4, 0, 0]]]);
      break;
    case 'goblin_samurai':
      cinto('#2b2b33', '#8a1c1c');
      ACC.paja(r, '#7a4a1e');
      for (const b of [r.bI, r.bD]) fuera(MF(b, [['caja', '#8a1c1c', [b === r.bI ? 0.04 : -0.04, -0.06, 0], [0.07, 0.22, 0.22]], ['caja', '#2b2b33', [b === r.bI ? 0.045 : -0.045, 0.02, 0], [0.075, 0.03, 0.24]]]));
      if (!lig) D.push(['cil', '#3a2a1a', [0.1, T * 0.7, -0.2], [0.015, 0.9, 0.015]], ['caja', hx(acento), [0.1, T * 0.7 + 0.3, -0.34], [0.02, 0.4, 0.26]]);   // estandarte a la espalda
      espada(r.manoD, { largo: 0.86, guarda: '#2b2b2b', mango: '#2b2b2b', ancho: 0.06 });
      break;
    case 'goblin_mage':
      cinto('#3a2412', '#c084fc');
      if (!lig) D.push(['icos', '#7dd3fc', [0.17, T * 0.14, 0.17], 0.045], ['icos', '#a3e635', [-0.16, T * 0.14, 0.18], 0.04], ['caja', osc(ropa, 0.7), [0, T * 0.6, 0.2], [0.07, T * 0.7, 0.03]]);
      ACC.sombrero(r, osc(ropa, 0.85), 0.75); baston(r, r.manoD, '#c084fc');
      break;
    case 'goblin_peasant':
      harapos(osc(ropa, 0.75), 5); cinto('#c9b48a', '#8a6438');
      if (!lig) D.push(['caja', '#b88a48', [0.08, T * 0.42, 0.21], [0.11, 0.1, 0.03], [0, 0, 0.2]]);   // remiendo
      D.push(['esferaB', '#9a7a4a', [0.02, T * 0.52, -0.25], [0.2, 0.22, 0.15]], ['cono4', '#7a5c34', [0.02, T * 0.52 + 0.2, -0.25], [0.06, 0.1, 0.06]]);   // costal a la espalda
      correa('#7a5c34');
      if (!amigo) horca(r.manoD).translateZ(0.2);
      break;
    case 'goblin_assassin':
      cinto('#17172f', '#8a8a94'); correa('#17172f');
      if (!lig) D.push(['caja', '#17172f', [-0.01, T * 0.56, 0.2], [0.06, T * 1.0, 0.035], [-0.12, 0, 0.85]], ['caja', '#c4ccd4', [0.19 * W, T * 0.14, 0.14], [0.03, 0.12, 0.02], [0, 0, 0.3]]);
      ACC.capucha(r, osc(ropa, 0.85)); capaViva(r, osc(ropa, 0.62), T, 0.5, { ligero: lig, ancho: 0.42 });
      dagaCurva(r.manoD); dagaCurva(r.manoI); r.dosArmas = true; r.paso = 11;
      break;
    case 'goblin_guard': {
      const metal = c.color ? mez(ropa, '#e8e8ee', 0.25) : '#a8a8b0';
      cinto(cuero, oro);
      D.push(['aro6', osc(metal, 0.7), [0, T * 0.88, 0], [0.2, 0.07, 0.17]]);   // gola
      if (!lig) for (const x of [-1, 0, 1]) D.push(['cuna', hx(osc(metal, 0.85)), [x * 0.17 * W, T * 0.13, x ? 0.15 : 0.22], [0.14, 0.03, 0.17], [PI / 2, 0, 0]]);   // faldar
      cascoGob(r, amigo ? '#9aa4b4' : '#8d8d94', { nasal: !amigo, mejillas: true, pincho: true });
      hombrerasB(r, jefe ? acento : metal);
      lanzaGob(r, r.manoD, amigo ? '#2f6fd6' : acento, lig || amigo);
      if (amigo) escudoGob(r.manoI, 'rodela', '#2f6fd6', '#d7dde4');
      break;
    }
    case 'goblin_knight': {
      const metal = c.color ? mez(ropa, '#e8e8ee', 0.2) : '#c8c8ce';
      cinto(cuero, oro);
      D.push(['aro6', osc(metal, 0.7), [0, T * 0.88, 0], [0.2, 0.07, 0.17]], ['caja', hx(acento), [0, T * 0.02, 0.2], [0.17, 0.3, 0.03], [-0.12, 0, 0]]);   // gola y tabardo
      if (!lig) D.push(['caja', oro, [0, T * 0.62, 0.2], [0.1, 0.1, 0.03], [0, 0, PI / 4]]);   // rombo del peto
      hombrerasB(r, jefe ? acento : metal, { k: 1.1, pua: jefe ? '#e9dfc4' : null });
      espada(r.manoD, { largo: 0.9, ancho: 0.08 }); escudoGob(r.manoI, 'lagrima', c.color ? osc(ropa, 0.55) : '#6a6a74', metal, acento);
      if (jefe) capaViva(r, osc(acento, 0.7), T, 0.62, { ligero: lig });
      break;
    }
    case 'goblin_lord':
      cinto('#5a1c1c', oro);
      D.push(['esferaB', '#f0e8d8', [0, T * 0.9, 0.02], [0.3 * W, 0.1, 0.24]]);   // cuello de armiño
      if (!lig) D.push(['icos', oro, [0, T * 0.6, 0.215], 0.05], ['caja', oro, [0.07, T * 0.72, 0.19], [0.14, 0.02, 0.02], [0, 0, 0.6]], ['caja', oro, [-0.07, T * 0.72, 0.19], [0.14, 0.02, 0.02], [0, 0, -0.6]]);
      ACC.corona(r, '#ffd84a', 1.15); maza(r.manoD);
      capaViva(r, c.color ? osc(c.color, 0.45) : '#6b1420', T, 0.74, { ligero: lig, ancho: 0.56 });
      break;
    case 'goblin_centurion': {
      const metal = c.color ? mez(ropa, '#f0e0c0', 0.2) : '#d8a848';
      cinto('#5a1c1c', oro);
      for (let i = 0; i < (lig ? 0 : 7); i++) { const a = -1.5 + i * 0.5; D.push(['caja', i % 2 ? '#8a1c22' : '#7a4a22', [Math.sin(a) * 0.25 * W, T * 0.02, Math.cos(a) * 0.2], [0.09, 0.2, 0.03], [0, a, 0]]); }   // faldellin de tiras
      D.push(['aro6', hx(osc(metal, 0.7)), [0, T * 0.88, 0], [0.2, 0.07, 0.17]]);
      cascoGob(r, metal, { mejillas: true, cresta: jefe ? acento : '#a51f26', crestaT: true });
      hombrerasB(r, jefe ? acento : metal);
      espada(r.manoD, { largo: 0.5, ancho: 0.1 }); escudoGob(r.manoI, 'torre', jefe ? osc(acento, 0.75) : '#a51f26', '#e8b923', '#e8b923');
      capaViva(r, jefe ? osc(acento, 0.7) : '#8a1c22', T, 0.56, { ligero: lig });
      break;
    }
    case 'goblin_battlelord': {
      const metal = c.color ? mez(ropa, '#f0e8d0', 0.2) : '#d8a848';
      cinto('#3a2412', '#e9dfc4');
      D.push(['aro6', hx(osc(metal, 0.7)), [0, T * 0.88, 0], [0.22, 0.07, 0.18]]);
      if (!lig) D.push(['icos', '#e9dfc4', [0, T * 0.2, 0.25], 0.055], ['caja', hx(osc(metal, 0.75)), [0, T * 0.62, 0.2], [0.3, 0.035, 0.03]], ['caja', hx(osc(metal, 0.75)), [0, T * 0.46, 0.2], [0.24, 0.035, 0.03]]);
      cascoGob(r, metal, { nasal: true, cuernos: '#e9dfc4' }); ACC.corona(r, '#f0d878', 0.78);
      hombrerasB(r, jefe ? acento : osc(metal, 0.9), { k: 1.15, pua: '#f0d878', piel: '#4a3626' });
      hachaDoble(r.manoD, c.color ? mez(c.color, '#f0f0f0', 0.5) : '#e0c070', '#4a3420', 1.15);
      r.tAtk = 0.45; r.dosManos = true; r.escudo = true;
      capaViva(r, jefe ? osc(acento, 0.55) : '#5a1c22', T, 0.6, { ligero: lig, ancho: 0.5 });
      break;
    }
  }
  if (D.length) MF(cu, D);
  gema();
  if (!amigo) { r.acecha = 1; if (jefe && r.modo === 'bipedo') r.caer = 'frente'; }
  return r;
}

// ── ESQUELETOS ──
// Osamenta: huesos sueltos con nudos en las articulaciones, costillar hueco (se ve a
// traves), calavera con cuencas encendidas y una mandibula que castañetea.
// o: { L, T, A, g (grosor), W (ancho), cab, enc, costillas, ojo (color), nucleo (color de la brasa del pecho) }
function osamenta(r, c, o = {}) {
  const R = r.raiz, lig = !!c.ligero;
  const hueso = principal(c, o.hueso || '#efe9b8'), h = hx(hueso), h2 = hx(osc(hueso, 0.7)), hueco = '#221d18', diente = hx(mez(hueso, '#ffffff', 0.5));
  const L = o.L ?? 0.54, T = o.T ?? 0.5, Ab = o.A ?? 0.46, g = o.g ?? 1, W = o.W ?? 1, H = o.cab ?? 1, enc = o.enc ?? 0.14;
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.1 * W * s, L, 0]));
    MF(p, [
      ['miembro', h, [0, 0, 0], [0.046 * g, L * 0.5, 0.046 * g], [-0.14, 0, 0]],
      ['icos', h2, [0, -L * 0.49, L * 0.07], 0.05 * g],
      ['miembro', h, [0, -L * 0.49, L * 0.07], [0.04 * g, L * 0.46, 0.04 * g], [0.14, 0, 0]],
      ['caja', h, [0, -L + 0.035 * g, 0.07], [0.1 * g, 0.07 * g, 0.25 * Math.sqrt(g)]],
    ]);
    if (s > 0) r.pI = p; else r.pD = p;
  }
  const cu = r.cuerpo = piv(r, G(R, [0, L, 0], [enc, 0, 0]));
  const B = [
    ['caja', h, [0, 0.03, 0], [0.27 * W, 0.09 * g, 0.13 * g]],                                         // pelvis
    ['caja', h2, [0, T * 0.45, -0.04 * W], [0.055 * g, T * 0.86, 0.055 * g]],                           // columna
    ['caja', h, [0, T * 0.68, 0.13 * W], [0.05 * g, T * 0.44, 0.03 * g]],                               // esternon
    ['caja', h, [0, T * 0.94, 0], [0.5 * W, 0.05 * g, 0.07 * g]],                                       // claviculas
  ];
  const nc = o.costillas ?? 3;
  for (let i = 0; i < nc; i++) { const k = i / (nc - 1), a = lerp(0.15, 0.21, Math.sqrt(k)) * W; B.push(['aro6', h, [0, T * lerp(0.5, 0.82, k), 0.02 * W], [a, g > 1.5 ? 0.05 : 0.045, a * 0.66]]); }
  if (!lig) for (const [x, z, a] of [[-0.09, 0.07, 0.15], [0.08, 0.07, -0.2], [0, -0.08, 0]]) B.push(['cono4', c.color ? hx(osc(c.color, 0.45)) : '#4a3a36', [x * W, 0.02, z * g], [0.07 * W, 0.2 * Math.sqrt(g), 0.025], [PI, 0, a]]);   // harapo en la cadera
  MF(cu, B);
  if (o.nucleo) M(cu, 'icos', mat(o.nucleo, { e: 0.9 }), [0, T * 0.66, 0.02 * W], 0.075 * W * Math.sqrt(g));   // brasa dentro del costillar
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [0.26 * W * s, T * 0.92, 0], [-enc - 0.05, 0, 0.14 * s]));
    const hm = [0, -Ab * 0.97, Ab * 0.17];
    const Q = [
      ['icos', h2, [0, 0, 0], 0.052 * g], ['miembro', h, [0, 0, 0], [0.038 * g, Ab * 0.5, 0.038 * g]],
      ['icos', h2, [0, -Ab * 0.5, 0], 0.042 * g], ['miembro', h, [0, -Ab * 0.5, 0], [0.034 * g, Ab * 0.5, 0.034 * g], [-0.35, 0, 0]],
    ];
    if (o.punos) Q.push(['icos', h, hm, 0.075 * g], ['caja', h2, [hm[0], hm[1] - 0.03 * g, hm[2] + 0.05 * g], [0.12 * g, 0.05 * g, 0.06 * g]]);
    else {
      Q.push(['caja', h, hm, [0.075 * g, 0.09 * g, 0.05 * g]]);
      if (!lig) for (const x of [-0.028, 0, 0.028]) Q.push(['cono4', h, [hm[0] + x * g, hm[1] - 0.04, hm[2] + 0.01], [0.012 * g, 0.09, 0.012 * g], [PI - 0.3, 0, 0]]);
    }
    MF(b, Q);
    const mn = G(b, hm);
    if (s > 0) { r.bI = b; r.manoI = mn; } else { r.bD = b; r.manoD = mn; }
  }
  const cb = r.cabeza = piv(r, G(cu, [0, T + 0.03, 0.03 * W], [-enc * 0.8, 0, 0]));
  r.H = H; r.topeCabeza = 0.51 * H;
  const C = [
    ['esfera', h, [0, 0.27, 0], [0.24, 0.24, 0.26]],
    ['caja', h, [0, 0.13, 0.1], [0.2, 0.1, 0.19]],                                    // maxilar
    ['cono4', hueco, [0, 0.165, 0.2], [0.03, 0.07, 0.02]],                           // nariz
    ['caja', diente, [0, 0.085, 0.19], [0.15, 0.028, 0.02]],
  ];
  for (const x of [-1, 1]) C.push(['caja', hueco, [x * 0.088, 0.275, 0.21], [0.105, 0.095, 0.09], [0, 0, x * 0.22]]);
  MF(cb, C, null, null, null, H);
  /* Las brasas de las cuencas van en la cabeza (no parpadean: un pivote menos). */
  const ojo = mat(o.ojo || (c.color ? mez(c.color, '#ffffff', 0.3) : '#ffb347'), { e: 1 });
  for (const x of [-1, 1]) M(cb, 'icos', ojo, [x * 0.088 * H, 0.275 * H, 0.245 * H], 0.026 * H);
  const J = [['caja', h2, [0, -0.04, 0.095], [0.17, 0.05, 0.19]], ['caja', diente, [0, -0.012, 0.18], [0.13, 0.024, 0.02]]];
  if (lig) MF(cb, J, null, null, [0, 0.085 * H, 0.005 * H], H);
  else { r.mandibula = piv(r, G(cb, [0, 0.085 * H, 0.005 * H])); MF(r.mandibula, J, null, null, null, H); }
  r.caer = 'huesos'; r.hundir = 0.12; r.acecha = 1;
  return { h, h2, T, L, Ab, W, g };
}
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
    return r;
  }
  const lig = !!c.ligero, jefe = !!c.jefe;
  const d = osamenta(r, c, { nucleo: jefe ? c.color || '#ff7a1a' : null });
  if (jefe) hombrerasB(r, c.color ? mez(c.color, '#3a3a44', 0.5) : '#6a6a74', { k: 1.05 });
  // Espada mellada y, si no es ligero, media rodela podrida en el otro brazo.
  espada(r.manoD, { largo: 0.72, hoja: c.color ? hx(mez(c.color, '#9a8f7a', 0.5)) : '#9a8f7a', guarda: '#5b4a35', ancho: 0.075 });
  const real = c.k === 'esqueleto_real';
  if (!lig && !jefe && !real) escudoGob(r.manoI, 'rodela', '#5a4632', '#7a7468');
  /* Esqueleto Real: corona vieja de oro, fundida con la cabeza (sin dibujo de mas). */
  if (real) fuera(MF(r.cabeza, [['aro6', '#d8b23a', [0, 0.47, 0], [0.2, 0.07, 0.21]], ['cono4', '#d8b23a', [0, 0.5, 0.19], [0.04, 0.12, 0.03]], ['cono4', '#d8b23a', [0.17, 0.5, -0.08], [0.04, 0.1, 0.03]], ['cono4', '#d8b23a', [-0.17, 0.5, -0.08], [0.04, 0.1, 0.03]]]));
  r.paso = 8;
  return r;
}

// ── FANTASMAS (flotan, sin piernas) ──
function fantasma(c, v) {
  const r = nuevoRig('flota'), R = r.raiz, lig = !!c.ligero;
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
    // Espectro encapuchado: capucha en punta, manto de hombros, calavera palida con las
    // cuencas encendidas, manos de hueso y jirones magenta que arden. Se esfuma al morir.
    const negro = hx(principal(c, '#1e1424')), manto = hx(mez(principal(c, '#1e1424'), '#5a2a6a', 0.35)), hues = '#b8a8c0', rosa = mat('#e0207a', { e: 0.8 });
    const B = [
      ['esferaB', negro, [0, 0.42, -0.02], [0.38, 0.41, 0.37]],                                  // capucha
      ['cono', negro, [0, 0.7, -0.14], [0.17, 0.36, 0.17], [-1.0, 0, 0]],                        // punta caida hacia atras
      ['semiB', manto, [0, 0.16, -0.02], [0.47, 0.2, 0.4]],                                      // manto de hombros
      ['esfera', hues, [0, 0.4, 0.19], [0.21, 0.23, 0.17]],                                      // calavera
      ['caja', hues, [0, 0.27, 0.27], [0.15, 0.09, 0.1]],                                        // maxilar
      ['caja', '#120a16', [0, 0.25, 0.325], [0.11, 0.025, 0.02]],                                // boca
      ['cono4', '#120a16', [0, 0.33, 0.35], [0.025, 0.06, 0.02]],                                // nariz
    ];
    for (const x of [-1, 1]) B.push(['caja', '#120a16', [x * 0.08, 0.43, 0.315], [0.095, 0.09, 0.08], [0, 0, x * 0.25]]);
    MF(cu, B);
    const cola = r.cola = piv(r, G(cu, [0, 0.2, 0]));
    const Cq = [['cono', negro, [0, 0, -0.03], [0.36, 0.7, 0.33], [PI + 0.15, 0, 0]]];
    if (!lig) Cq.push(['cono', manto, [0.2, 0.02, 0], [0.15, 0.46, 0.12], [PI + 0.1, 0, 0.3]], ['cono', manto, [-0.2, 0.02, 0], [0.15, 0.42, 0.12], [PI + 0.1, 0, -0.3]], ['cono', negro, [0, 0.02, -0.2], [0.14, 0.5, 0.12], [PI + 0.4, 0, 0]]);
    MF(cola, Cq);
    const j = piv(r, G(cu, [0, 0.4, 0]));
    MF(j, [['cono', null, [0.3, 0.3, -0.1], [0.05, 0.4, 0.05], [0, 0, -0.9]], ['cono', null, [-0.3, 0.3, -0.1], [0.05, 0.4, 0.05], [0, 0, 0.9]], ['cono', null, [0.1, 0.42, -0.2], [0.04, 0.32, 0.04], [-0.5, 0, -0.3]], ['cono', null, [0, -0.5, -0.25], [0.05, 0.35, 0.05], [-2.4, 0, 0]], ['aro6', null, [0, -0.2, -0.02], [0.44, 0.035, 0.38]], ['icos', null, [-0.08, 0.03, 0.35], 0.026], ['icos', null, [0.08, 0.03, 0.35], 0.026]], rosa).userData.sinFlash = true;
    r.flamas.push(j);
    for (const lado of [1, -1]) {
      const b = piv(r, G(cu, [0.4 * lado, 0.26, 0.04], [0, 0, 0.45 * lado]));
      const Q = [['cono', manto, [0, 0.04, 0], [0.11, 0.34, 0.11], [PI, 0, 0]], ['icos', hues, [0, -0.33, 0.02], 0.055]];
      if (!lig) for (const x of [-0.035, 0, 0.035]) Q.push(['cono4', hues, [x, -0.36, 0.04], [0.014, 0.12, 0.014], [PI - 0.5, 0, 0]]);
      MF(b, Q);
      if (lado > 0) r.bI = b; else r.bD = b;
    }
    r.caer = 'esfuma'; r.hundir = 0;
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
  const r = nuevoRig('bipedo'), lig = !!c.ligero, jefe = !!c.jefe;
  if (c.amigo) {
    // Sabio del pueblo: tunica azul con ribete dorado, barba blanca, sombrero y baston.
    const tun = c.color || '#2f5fb3', piel = '#e6c3a0';
    criatura(r, { ligero: lig, piel, ropa: tun, tunica: tun, ribete: '#c9a227', cab: 1, L: 0.55, T: 0.52, A: 0.46, encorvado: 0.08, panza: 1.05 });
    cabezaGoblin(r, { piel, amigo: true, ligero: lig });
    MF(r.cuerpo, [['aro6', '#c9a227', [0, 0.52 * 0.2, 0.012], [0.285, 0.05, 0.25]], ['semiB', hx(osc(tun, 0.78)), [0, 0.52 * 0.78, -0.01], [0.4, 0.12, 0.3]], ['icos', '#a78bfa', [0, 0.52 * 0.74, 0.21], 0.04]]);
    ACC.barba(r, '#f2f2f2');
    ACC.sombrero(r, osc(tun, 0.75), 0.95);
    baston(r, r.manoD, '#a78bfa');
    r.paso = 7;
    return r;
  }
  // Cultista: capucha honda con el rostro en sombra y dos ojos encendidos, manto de hombros
  // con ribete dorado, mangas de campana, garras oscuras, amuleto y un orbe en la mano.
  const acento = c.color || '#ff6af0';
  const tun = jefe && c.color ? mez(c.color, '#1a1420', 0.55) : principal(c, '#7a0a66'), oscuro = hx(osc(tun, 0.62)), oro = '#e8b923', T = 0.52, L = 0.55;
  criatura(r, {
    ligero: lig, piel: '#24142a', ropa: tun, tunica: tun, ribete: oro, mangas: tun, antebrazo: osc(tun, 0.8), manos: '#3a2a3a', hombro: osc(tun, 0.8),
    cab: 1, L, T, A: 0.48, encorvado: 0.2, cuelloZ: 0.03, garras: true, manoG: 1.1, brazoG: 0.95,
  });
  const D = [
    ['semiB', oscuro, [0, T * 0.74, -0.01], [0.42, 0.14, 0.31]],                                  // manto de hombros
    ['aro6', oro, [0, T * 0.75, -0.01], [0.43, 0.035, 0.32]],
    ['aro6', '#3a2412', [0, T * 0.2, 0.012], [0.285, 0.05, 0.25]],                                // cordon
    ['caja', oscuro, [0, T * 0.02, 0.2], [0.13, 0.34, 0.03], [-0.1, 0, 0]],                       // estola
    ['icos', oro, [0, T * 0.56, 0.215], 0.05],                                                    // amuleto
  ];
  if (!lig) D.push(['caja', oro, [0.07, T * 0.7, 0.2], [0.15, 0.022, 0.02], [0, 0, 0.75]], ['caja', oro, [-0.07, T * 0.7, 0.2], [0.15, 0.022, 0.02], [0, 0, -0.75]], ['caja', '#5a3a1a', [0.2, T * 0.1, 0.12], [0.1, 0.13, 0.05], [0, 0, 0.15]]);
  MF(r.cuerpo, D);
  for (const b of [r.bI, r.bD]) MF(b, [['cono', hx(tun), [0, -0.48 * 0.98, 0.48 * 0.19], [0.12, 0.3, 0.12], [-0.4, 0, 0]]]);   // manga de campana
  const cb = r.cabeza, H = r.H;
  MF(cb, [
    ['esfera', '#0e0812', [0, 0.25, 0.02], [0.26, 0.25, 0.24]],                                   // rostro en sombra
    ['semi', hx(tun), [0, 0.2, -0.07], [0.36, 0.4, 0.33]],                                         // capucha
    ['cuna', hx(tun), [0, 0.47, 0.02], [0.5, 0.16, 0.32], [0.35, 0, 0]],                           // visera de la capucha
    ['cono', oscuro, [0, 0.47, -0.24], [0.12, 0.34, 0.12], [-1.2, 0, 0]],                          // punta
    ['caja', oscuro, [0.29, 0.17, -0.03], [0.07, 0.44, 0.36], [0, 0.2, -0.12]], ['caja', oscuro, [-0.29, 0.17, -0.03], [0.07, 0.44, 0.36], [0, -0.2, 0.12]],   // caidas laterales
    ['caja', oscuro, [0, 0.15, -0.26], [0.5, 0.4, 0.08]],                                          // caida de la nuca
  ], null, null, null, H);
  r.tocado = true;
  const ojo = mat(jefe && c.color ? mez(c.color, '#ffffff', 0.4) : '#ff4af0', { e: 1 });
  r.ojosP = piv(r, G(cb, [0, 0.3 * H, 0]));
  for (const x of [-1, 1]) M(r.ojosP, 'esferaB', ojo, [x * 0.09 * H, 0, 0.245 * H], [0.05 * H, 0.03 * H, 0.025 * H], [0, 0, x * 0.35]);
  r.ojosMalos = true;
  const orbe = piv(r, G(r.manoD, [0, -0.1, 0.06]));
  M(orbe, 'icos', mat(c.color ? mez(c.color, '#ffffff', 0.3) : '#ff6af0', { e: 1 }), [0, 0, 0], 0.085).userData.sinFlash = true;
  r.brillo.push(orbe);
  if (jefe) capaViva(r, osc(acento, 0.5), T, 0.8, { ligero: lig, ancho: 0.5 });
  r.paso = 7; r.acecha = 0.6;
  return r;
}

// ── GHOUL ARDIENTE (encorvado y en llamas) ──
// Cadaver calcinado y flaco, de brazos largos con garras, con grietas de lava en el
// cuerpo y una calavera negra dentro de la llamarada. Ataca a dos garras.
function ghoul(c) {
  const r = nuevoRig('bipedo'), lig = !!c.ligero, jefe = !!c.jefe, piel = '#5a2030', fuego = principal(c, '#ff8a10'), T = 0.56, Ab = 0.64;
  criatura(r, {
    ligero: lig, piel, ropa: piel, pantalon: '#3a1420', mangas: piel, antebrazo: osc(piel, 0.8), manos: '#2a0e14', hombro: '#3a1420',
    L: 0.5, T, A: Ab, ancho: 1.08, grueso: 0.95, panza: 0.88, encorvado: 0.34, cuelloZ: 0.05, garras: true, manoG: 1.35, cab: 1,
  });
  const lava = mat(fuego, { e: 0.8 });
  const G0 = [
    ['caja', null, [0.03, T * 0.56, 0.2], [0.035, T * 0.5, 0.03], [0, 0, 0.35]], ['caja', null, [-0.08, T * 0.4, 0.215], [0.03, T * 0.32, 0.03], [0, 0, -0.5]],
    ['caja', null, [0, T * 0.5, -0.2], [0.04, T * 0.62, 0.03], [0, 0, 0.1]], ['caja', null, [0.1, T * 0.62, -0.19], [0.03, 0.2, 0.03], [0, 0, -0.7]],
  ];
  if (!lig) G0.push(['caja', null, [0.11, T * 0.3, 0.2], [0.03, 0.16, 0.03], [0, 0, 0.9]], ['caja', null, [-0.11, T * 0.66, -0.19], [0.03, 0.18, 0.03], [0, 0, 0.6]]);
  MF(r.cuerpo, G0, lava);
  if (!lig) {
    MF(r.cuerpo, [['cono4', '#2a0e14', [0, T * 0.95, -0.12], [0.05, 0.2, 0.05], [-0.7, 0, 0]], ['cono4', '#2a0e14', [0, T * 0.7, -0.2], [0.045, 0.17, 0.045], [-1.0, 0, 0]], ['cono4', '#2a0e14', [0, T * 0.45, -0.22], [0.04, 0.14, 0.04], [-1.2, 0, 0]]]);   // espinazo
    for (const b of [r.bI, r.bD]) MF(b, [['caja', null, [0, -Ab * 0.72, Ab * 0.1 + 0.07], [0.025, Ab * 0.3, 0.025], [-0.4, 0, 0]]], lava);
  }
  // Calavera calcinada (cuenta para el alto) con las cuencas al rojo.
  const cb = r.cabeza;
  MF(cb, [['esferaB', '#2a0e14', [0, 0.22, 0.02], [0.2, 0.21, 0.21]], ['caja', '#1c080c', [0, 0.07, 0.1], [0.17, 0.09, 0.17]], ['caja', '#e9dfc4', [0, 0.115, 0.185], [0.13, 0.025, 0.02]]]);
  const ojo = mat('#ffe27a', { e: 1 });
  for (const x of [-1, 1]) M(cb, 'icos', ojo, [x * 0.08, 0.24, 0.19], 0.042);
  // Llamarada: no cuenta para el alto y arde con las llamas del rig.
  const g = piv(r, fuera(G(cb, [0, 0.24, -0.06])));
  M(g, 'icos', mat(fuego, { e: 1 }), [0, 0.06, -0.04], 0.26).userData.sinFlash = true;
  MF(g, [['cono', null, [0, 0.2, -0.1], [0.17, 0.5, 0.17], [-0.55, 0, 0]], ['cono', null, [0.17, 0.14, -0.04], [0.1, 0.36, 0.1], [-0.4, 0, -0.5]], ['cono', null, [-0.17, 0.14, -0.04], [0.1, 0.36, 0.1], [-0.4, 0, 0.5]], ['cono', null, [0, 0.02, -0.22], [0.11, 0.34, 0.11], [-1.3, 0, 0]]], mat('#ffd040', { e: 1 })).userData.sinFlash = true;
  r.flamas.push(g);
  r.topeCabeza = 0.5; r.H = 1;
  r.paso = 10; r.dosArmas = true; r.acecha = 1;
  if (jefe) r.caer = 'frente';
  return r;
}

// ── COLOSO (gigante de hueso y piedra) ──
// Osamenta de gigante: costillar enorme con un nucleo rojo dentro, calavera chica con
// cuernos, espinazo de puas y puños como mazas. Golpea con los dos brazos y se desarma al caer.
function coloso(c) {
  const r = nuevoRig('bipedo'), lig = !!c.ligero;
  const d = osamenta(r, c, { hueso: '#dcdcdc', L: 0.56, T: 0.76, A: 0.74, g: 2.6, W: 1.95, cab: 0.95, enc: 0.22, costillas: 4, punos: true, ojo: '#ff3a2a', nucleo: '#e02818' });
  /* Placas de piedra en antebrazos y espinillas: es de hueso y piedra. */
  const piedra = '#7c7c86';
  for (const b of [r.bI, r.bD]) MF(b, [['caja', piedra, [0, -d.Ab * 0.74, d.Ab * 0.1 - 0.02], [0.2, d.Ab * 0.34, 0.16], [-0.35, 0, 0]]]);
  for (const q of [r.pI, r.pD]) MF(q, [['caja', piedra, [0, -d.L * 0.72, d.L * 0.07], [0.2, d.L * 0.3, 0.17], [0.14, 0, 0]], ['cono4', '#f0eadc', [0, -d.L * 0.5, d.L * 0.1 + 0.08], [0.05, 0.16, 0.05], [1.2, 0, 0]]]);
  hombrerasB(r, piedra, { k: 1.5, pua: '#f0eadc' });
  const P = [];
  for (const [y, z, l] of [[0.9, -0.1, 0.24], [0.66, -0.16, 0.2], [0.42, -0.16, 0.16]]) P.push(['cono4', d.h2, [0, d.T * y, z], [0.07, l, 0.07], [-1.0, 0, 0]]);
  MF(r.cuerpo, P);
  if (!lig) fuera(MF(r.cabeza, [['cono', '#f0eadc', [0.2, 0.36, 0], [0.06, 0.3, 0.06], [0.2, 0, -0.9]], ['cono', '#f0eadc', [-0.2, 0.36, 0], [0.06, 0.3, 0.06], [0.2, 0, 0.9]]], null, null, null, r.H));
  r.paso = 5; r.tAtk = 0.5; r.hundir = 0.2; r.dosManos = true; r.escudo = true;
  return r;
}

// ── ANGEL (alas de plumas, halo y espada) ──
// Angel caido: figura esbelta de tunica roja con peto y brazales dorados, melena, ojos de
// oro, halo y dos alas de plumas blancas con las puntas quemadas. Cae de bruces.
function angel(c) {
  const r = nuevoRig('bipedo'), lig = !!c.ligero, tun = principal(c, '#c01830'), piel = '#d84838', oro = '#d89048', T = 0.55, L = 0.6;
  criatura(r, {
    ligero: lig, piel, ropa: tun, tunica: tun, ribete: oro, mangas: piel, antebrazo: oro, manos: piel, hombro: oro,
    L, T, A: 0.5, ancho: 0.86, grueso: 0.85, panza: 0.85, cab: 0.9, encorvado: 0.04, brazoZ: 0.14,
  });
  const D = [
    ['pecho', oro, [0, T * 0.4, 0.012], [0.275, T * 0.5, 0.195]],                       // peto
    ['aro6', '#8a5a1c', [0, T * 0.2, 0.01], [0.25, 0.05, 0.2]],
    ['caja', hx(osc(tun, 0.6)), [0, -0.02, 0.19], [0.13, 0.4, 0.03], [-0.1, 0, 0]],    // estola
    ['icos', '#ffe27a', [0, T * 0.66, 0.2], 0.045],
  ];
  MF(r.cuerpo, D);
  hombrerasB(r, oro, { k: 0.95 });
  const cb = r.cabeza, H = r.H;
  const C = [['esfera', piel, [0, 0.26, 0], [0.27, 0.28, 0.27]], ['cuna', hx(osc(piel, 0.85)), [0, 0.22, 0.24], [0.05, 0.1, 0.07]], ['caja', '#5a1420', [0, 0.12, 0.24], [0.1, 0.02, 0.03]]];
  for (const x of [-1, 1]) {
    C.push(['caja', '#3a0c14', [x * 0.1, 0.3, 0.215], [0.11, 0.06, 0.08], [0, 0, x * 0.25]]);
    C.push(['cono', piel, [x * 0.25, 0.28, -0.02], [0.05, 0.2, 0.035], [0, x * 0.4, -x * 1.0]]);
  }
  MF(cb, C, null, null, null, H);
  const ojo = mat('#ffd84a', { e: 1 });
  r.ojosP = piv(r, G(cb, [0, 0.3 * H, 0]));
  for (const x of [-1, 1]) M(r.ojosP, 'esferaB', ojo, [x * 0.1 * H, 0, 0.25 * H], [0.045 * H, 0.028 * H, 0.025 * H], [0, 0, x * 0.3]);
  r.ojosMalos = true;
  fuera(MF(cb, partesPelo(4, ''), '#d89048', null, null, H));
  // Alas: el abanico de plumas (que apunta atras) se gira para que cuelgue hacia abajo.
  for (const s of [1, -1]) {
    const p = piv(r, fuera(G(r.cuerpo, [0.1 * s, T * 0.82, -0.2], [0, s * 0.35, s * 0.5])));
    MF(G(p, [0, 0, 0], [-PI / 2, 0, 0]), partesAla(s, 1.15, '#f4f4ff', '#d4d8ea', lig ? 5 : 7, { cuerda: 0.2, pluma: 1.8, ancho: 0.21, puntas: 1, c3: '#8a3040' }));
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  r.aleteo = 3; r.amplAla = 0.3; r.vuela = true; r.caer = 'frente';
  ACC.halo(r, '#ffe27a');
  espada(r.manoD, { largo: 1.0, hoja: '#ffd0a0', e: 0.6, ancho: 0.09 });
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
  // Chispa blanca en cada ojo (se funde con el resto: no cuesta draw calls).
  if (brillo) { const w = mat('#ffffff', { e: 1 }); for (const s of [-1, 1]) M(padre, 'esferaB', w, [s * x - ra * 0.3, y + ra * 0.4, z + ra * 0.55], ra * 0.32); }
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
// Seta con cara: sombrero con laminas por debajo y motas en relieve, tallo panzudo con
// ceño, ojos de brasa y boca dentada, brazos y pies de raiz. Embiste con el sombrero.
function hongo(c) {
  const r = nuevoRig('bipedo'), R = r.raiz, lig = !!c.ligero, sombrero = principal(c, '#9a2018');
  const tallo = '#8a7068', tallo2 = '#5e4a44', raizC = '#4a3430', mota = '#fff2e0';
  r.bamboleo = true; r.paso = 8; r.caer = 'lado'; r.cabezazo = true;
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.13 * s, 0.15, 0]));
    const Q = [['miembro', tallo2, [0, 0, 0], [0.075, 0.11, 0.075]], ['cuna', raizC, [0, -0.115, -0.06], [0.15, 0.07, 0.25]]];
    if (!lig) Q.push(['cono4', raizC, [s * 0.07, -0.13, 0.02], [0.03, 0.12, 0.03], [PI / 2, 0, -s * 0.7]]);
    MF(p, Q);
    if (s > 0) r.pI = p; else r.pD = p;
  }
  const cu = r.cuerpo = piv(r, G(R, [0, 0.15, 0]));
  const B = [
    ['tronco', tallo, [0, 0, 0], [0.29, 0.46, 0.27]],
    ['esferaB', tallo, [0, 0.13, 0.03], [0.28, 0.17, 0.27]],                       // panza del tallo
    ['aro6', '#b8a090', [0, 0.335, 0], [0.225, 0.05, 0.21]],                        // anillo
    ['caja', '#1b1010', [0, 0.165, 0.27], [0.15, 0.05, 0.05]],                      // boca
  ];
  for (const x of [-1, 1]) {
    B.push(['caja', '#1b1010', [x * 0.085, 0.265, 0.2], [0.085, 0.085, 0.06], [0, 0, x * 0.25]]);
    B.push(['caja', tallo2, [x * 0.09, 0.318, 0.205], [0.13, 0.04, 0.07], [0.2, 0, x * 0.42]]);
    B.push(['cono4', mota, [x * 0.045, 0.19, 0.285], [0.02, 0.05, 0.02], [PI, 0, 0]]);
  }
  MF(cu, B);
  const ojo = mat(c.color ? mez(c.color, '#ffffff', 0.4) : '#ffd84a', { e: 1 });
  for (const x of [-1, 1]) M(cu, 'icos', ojo, [x * 0.085, 0.262, 0.225], 0.027);
  for (const s of [1, -1]) {
    const b = piv(r, G(cu, [0.23 * s, 0.22, 0.02], [-0.15, 0, 0.55 * s]));
    const Q = [['miembro', tallo2, [0, 0, 0], [0.05, 0.2, 0.05]], ['icos', raizC, [0, -0.2, 0], 0.05]];
    if (!lig) Q.push(['cono4', raizC, [0.02, -0.22, 0.02], [0.018, 0.09, 0.018], [PI - 0.5, 0, 0.4]], ['cono4', raizC, [-0.02, -0.22, 0.02], [0.018, 0.09, 0.018], [PI - 0.5, 0, -0.4]]);
    MF(b, Q);
    if (s > 0) r.bI = b; else r.bD = b;
  }
  const cb = r.cabeza = piv(r, G(cu, [0, 0.4, 0]));
  const P = [
    ['semi', hx(sombrero), [0, 0, 0], [0.52, 0.36, 0.52]],
    ['cono', '#d8c8b0', [0, 0.02, 0], [0.5, 0.2, 0.5], [PI, 0, 0]],                 // laminas
    ['aro6', hx(osc(sombrero, 0.7)), [0, 0.02, 0], [0.56, 0.05, 0.56]],             // borde
  ];
  // Motas en relieve, tumbadas sobre la curva del sombrero.
  for (const [a, e, t] of [[0, 1.5, 0.1], [0.5, 0.78, 0.09], [2.2, 0.72, 0.1], [-1.6, 0.8, 0.085], [3.7, 0.62, 0.09], [1.3, 0.34, 0.07], [-0.6, 0.3, 0.08], [-2.7, 0.3, 0.07]].slice(0, lig ? 5 : 8)) {
    const x = 0.5 * Math.cos(e) * Math.sin(a), y = 0.345 * Math.sin(e), z = 0.5 * Math.cos(e) * Math.cos(a);
    const nx = x / 0.27, ny = y / 0.13, nz = z / 0.27, n = Math.hypot(nx, ny, nz);
    P.push(['semiB', mota, [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)], [t, t * 0.5, t], [+Math.atan2(nz, ny).toFixed(3), 0, +(-Math.asin(nx / n)).toFixed(3)]]);
  }
  if (!lig) P.push(['miembro', '#d8c8b0', [-0.3, 0.42, -0.18], [0.03, 0.16, 0.03], [0, 0, 0.5]], ['semiB', hx(sombrero), [-0.31, 0.41, -0.18], [0.1, 0.07, 0.1], [0, 0, 0.5]]);   // seta hija
  MF(cb, P);
  r.H = 1; r.topeCabeza = 0.36; r.acecha = 0.6;
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
// Sapo gordo con gafas doradas: cabeza ancha de boca partida, ojos saltones, buche que
// se hincha al croar (r.buche), verrugas, ancas plegadas con aletas y manos de dedos.
function rana(c) {
  const r = nuevoRig('salto'), R = r.raiz, lig = !!c.ligero, verde = principal(c, '#1f7a52');
  const v = hx(verde), v2 = hx(osc(verde, 0.7)), panza = c.color ? hx(mez(c.color, '#f4f0c0', 0.6)) : '#c8c048', oro = '#e8c040';
  r.paso = 9; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0, 0]));
  const B = [
    ['esfera', v, [0, 0.36, -0.02], [0.4, 0.3, 0.44], [-0.3, 0, 0]],
    ['esferaB', panza, [0, 0.31, 0.13], [0.33, 0.24, 0.3], [-0.3, 0, 0]],
    ['esfera', v, [0, 0.53, 0.25], [0.34, 0.19, 0.27]],                             // cabeza ancha
    ['caja', '#143f2c', [0, 0.475, 0.4], [0.46, 0.03, 0.22]],                       // boca partida
    ['caja', oro, [0, 0.69, 0.37], [0.12, 0.028, 0.028]],                           // puente de las gafas
  ];
  for (const x of [-1, 1]) {
    B.push(['esferaB', v, [x * 0.17, 0.665, 0.27], 0.118]);                                             // ojo saliente
    B.push(['cil', oro, [x * 0.17, 0.675, 0.355], [0.12, 0.035, 0.12], [PI / 2, 0, 0]]);                // montura
    B.push(['cil', '#1b1430', [x * 0.17, 0.675, 0.372], [0.088, 0.03, 0.088], [PI / 2, 0, 0]]);        // lente
    B.push(['caja', '#ffffff', [x * 0.17 - 0.035, 0.705, 0.39], [0.03, 0.03, 0.01]]);                   // brillo
    B.push(['caja', '#3a2412', [x * 0.275, 0.665, 0.24], [0.025, 0.04, 0.2]]);                          // patilla
  }
  if (!lig) for (const [x, y, z] of [[0.2, 0.62, -0.12], [-0.16, 0.66, -0.02], [0.02, 0.6, -0.3], [-0.24, 0.52, -0.26], [0.27, 0.5, -0.28]]) B.push(['icos', v2, [x, y, z], 0.05]);   // verrugas
  MF(cu, B);
  r.buche = piv(r, G(cu, [0, 0.37, 0.36]));
  M(r.buche, 'esferaB', mat(c.color ? mez(c.color, '#ffffff', 0.55) : '#e8dc7a'), [0, 0, 0], [0.2, 0.13, 0.15]);
  const lg = r.lengua = piv(r, G(cu, [0, 0.47, 0.5]));
  M(lg, 'cilT', '#ff6b9a', [0, 0, 0], [0.03, 0.08, 0.015], [-PI / 2, 0, 0]);
  for (const s of [1, -1]) {
    const p = piv(r, G(R, [0.28 * s, 0.24, -0.18]));
    MF(p, [
      ['esferaB', v, [0, 0, 0], [0.14, 0.12, 0.26]],                                                  // muslo
      ['miembro', v2, [s * 0.03, 0.03, 0.2], [0.07, 0.32, 0.07], [0.76, 0, 0]],                       // caña plegada
      ['cuna', v2, [s * 0.03, -0.215, -0.06], [0.2, 0.04, 0.36], [0, s * 0.3, 0]],                    // aleta
    ]);
    const b = piv(r, G(R, [0.2 * s, 0.3, 0.28], [0.2, 0, 0]));
    MF(b, [
      ['miembro', v, [0, 0, 0], [0.065, 0.15, 0.065], [0, 0, s * 0.6]],
      ['miembro', v2, [s * 0.085, -0.124, 0], [0.05, 0.17, 0.05], [-0.2, 0, -s * 0.35]],
      ['cuna', v2, [s * 0.027, -0.275, -0.02], [0.15, 0.03, 0.17], [0, s * 0.25, 0]],
    ]);
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
// Pata de bestia en dos tramos con zarpa: las delanteras llevan el codo atras y las
// traseras el corvejon. o: { largo, g (grosor), c1, c2 (zarpa), del, ph, garras }
function pataB(r, padre, pos, o) {
  const p = piv(r, G(padre, pos)), L = o.largo, g = o.g;
  const Q = o.del
    ? [['miembro', o.c1, [0, 0.03, 0], [g * 1.5, L * 0.52, g * 1.75], [0.25, 0, 0]], ['miembro', o.c1, [0, -L * 0.47, -L * 0.125], [g, L * 0.52, g], [-0.24, 0, 0]]]
    : [['miembro', o.c1, [0, 0.03, 0], [g * 1.7, L * 0.52, g * 2.1], [-0.45, 0, 0]], ['miembro', o.c1, [0, -L * 0.43, L * 0.22], [g, L * 0.64, g], [0.58, 0, 0]]];
  const zf = o.del ? 0.02 : -L * 0.1;
  Q.push(['esferaB', o.c2, [0, -L + g * 0.75, zf + g * 0.6], [g * 1.5, g * 0.85, g * 2.1]]);
  if (o.garras) for (const x of [-0.8, 0, 0.8]) Q.push(['cono4', '#e9dfc4', [x * g, -L + g * 0.5, zf + g * 2.2], [g * 0.3, g * 1.1, g * 0.3], [PI / 2 + 0.3, 0, 0]]);
  MF(p, Q);
  r.patas.push([p, o.ph, 'x', !!o.del]);
  return p;
}
// Lobo de brasa: pecho hondo y cintura fina, cuello alzado, hocico en cuña con colmillos,
// costillas y lomo que arden, crin y cola de fuego. Da el zarpazo agazapandose (r.zarpa).
function hellhound(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, lig = !!c.ligero, piel = principal(c, '#161016');
  const p1 = hx(piel), p2 = hx(osc(piel, 0.6)), p3 = hx(mez(piel, '#6a4050', 0.4));
  const fuego = mat('#ff6a1a', { e: 1 }), brasa = mat('#c83a08', { e: 0.6 });
  r.paso = 9; r.caer = 'lado'; r.hundir = 0.5; r.colaAmp = 0.25; r.zarpa = !c.montura;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.82, 0]));
  MF(cu, [
    ['esfera', p1, [0, 0.01, 0.3], [0.31, 0.36, 0.44]],                 // pecho hondo
    ['esferaB', p1, [0, 0.05, -0.3], [0.24, 0.25, 0.42]],               // lomo y grupa
    ['esferaB', p3, [0, 0.24, 0.4], [0.2, 0.17, 0.3]],                  // cruz
    ['tronco', p1, [0, 0.06, 0.5], [0.21, 0.46, 0.21], [0.78, 0, 0]],   // cuello
  ]);
  // Costillas de brasa a los lados (las rayas rojas de la hoja 2D).
  const rayas = [];
  for (const s of [-1, 1]) for (const [z, h] of [[0.44, 0.32], [0.27, 0.36], [0.1, 0.32], [-0.1, 0.22], [-0.28, 0.2]]) rayas.push(['caja', null, [s * (z > 0 ? 0.295 : 0.225), 0.02, z], [0.03, h, 0.055], [0, 0, s * 0.22]]);
  MF(cu, rayas, brasa);
  if (!c.montura) {
    // Crin y lomo en llamas (arden con las demas llamas del rig).
    const cr = piv(r, G(cu, [0, 0.3, 0]));
    MF(cr, [['cono', null, [0, 0.12, 0.5], [0.07, 0.34, 0.1], [-0.5, 0, 0]], ['cono', null, [0, 0.08, 0.28], [0.08, 0.4, 0.11], [-0.6, 0, 0]], ['cono', null, [0, 0, 0.02], [0.07, 0.32, 0.1], [-0.7, 0, 0]], ['cono', null, [0, -0.03, -0.26], [0.06, 0.26, 0.09], [-0.8, 0, 0]]], fuego).userData.sinFlash = true;
    fuera(cr); r.flamas.push(cr);
  }
  const cb = r.cabeza = piv(r, G(cu, [0, 0.36, 0.8]));
  const C = [
    ['esferaB', p1, [0, 0, 0], [0.19, 0.17, 0.21]],
    ['cuna', p1, [0, -0.025, 0.1], [0.21, 0.17, 0.37]],                 // hocico
    ['caja', p2, [0, 0.0, 0.43], [0.09, 0.05, 0.06]],                   // trufa
  ];
  for (const s of [-1, 1]) {
    C.push(['cono4', p1, [s * 0.12, 0.1, -0.08], [0.06, 0.27, 0.035], [-0.75, 0, -s * 0.3]]);            // oreja echada atras
    C.push(['caja', p2, [s * 0.1, 0.095, 0.1], [0.12, 0.04, 0.1], [0.15, 0, s * 0.35]]);                 // ceño
    C.push(['cono4', '#f1e9cf', [s * 0.065, -0.07, 0.34], [0.022, 0.09, 0.022], [PI, 0, 0]]);            // colmillo de arriba
  }
  MF(cb, C);
  const ojo = mat('#7df9ff', { e: 1 });
  for (const s of [-1, 1]) M(cb, 'icos', ojo, [s * 0.105, 0.055, 0.15], 0.032);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.1, 0.06]));
  MF(mj, [['cuna', p2, [0, -0.01, 0], [0.16, 0.06, 0.36]], ['cono4', '#f1e9cf', [0.06, 0.0, 0.26], [0.02, 0.07, 0.02]], ['cono4', '#f1e9cf', [-0.06, 0.0, 0.26], [0.02, 0.07, 0.02]], ['caja', '#b02a3a', [0, 0.012, 0.14], [0.08, 0.015, 0.22]]]);
  if (c.jefe && !lig) {
    // Collar de puas con un eslabon de la cadena rota.
    MF(cu, [['aro6', '#6a6a74', [0, 0.25, 0.68], [0.2, 0.07, 0.2], [0.78, 0, 0]], ['cono4', '#c8c8ce', [0.19, 0.27, 0.66], [0.03, 0.1, 0.03], [0, 0, -1.3]], ['cono4', '#c8c8ce', [-0.19, 0.27, 0.66], [0.03, 0.1, 0.03], [0, 0, 1.3]], ['caja', '#6a6a74', [0, 0.07, 0.76], [0.04, 0.14, 0.04], [0.3, 0, 0]]]);
  }
  const cola = r.cola = piv(r, G(cu, [0, 0.14, -0.66]));
  M(cola, 'miembro', p1, [0, 0, 0], [0.06, 0.26, 0.06], [2.2, 0, 0]);
  const fl = piv(r, G(cola, [0, 0.13, -0.18], [-0.75, 0, 0]));
  MF(fl, [['cono', null, [0, 0, 0], [0.09, 0.4, 0.09]], ['cono', null, [0.05, 0, 0.02], [0.05, 0.3, 0.05], [0, 0, -0.4]], ['cono', null, [-0.05, 0, 0.02], [0.05, 0.3, 0.05], [0, 0, 0.4]]], fuego).userData.sinFlash = true;
  r.flamas.push(fl);
  const o = { g: 0.075, c1: p1, c2: p2, garras: !lig };
  pataB(r, R, [0.2, 0.76, 0.4], { ...o, largo: 0.76, del: true, ph: 0 });
  pataB(r, R, [-0.2, 0.76, 0.4], { ...o, largo: 0.76, del: true, ph: PI });
  pataB(r, R, [0.19, 0.8, -0.44], { ...o, largo: 0.8, ph: PI });
  pataB(r, R, [-0.19, 0.8, -0.44], { ...o, largo: 0.8, ph: 0 });
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
// Ala de plumas hacia el lado s: cobertera y un abanico de remeras (conos aplastados)
// que van de apuntar atras, junto al cuerpo, a apuntar afuera, en la punta.
function partesAla(s, env, c1, c2, n = 5, o = {}) {
  const P = [['cuna', c1, [s * env * 0.02, 0.014, -0.01], [env * (o.cuerda ?? 0.42), 0.045, env * 0.86], [0, s * (PI / 2 - 0.12), 0]]];   /* brazo del ala: grueso en el hombro, filo en la punta */
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), a = lerp(1.45, 0.4, k), len = env * (0.34 + 0.1 * k) * (o.pluma ?? 1);
    P.push(['cono', o.puntas && i >= n - o.puntas ? o.c3 : i % 2 ? c1 : c2, [+(s * env * lerp(0.1, 0.6, k)).toFixed(3), -0.004 - i * 0.003, -0.02], [0.012, +len.toFixed(3), env * (o.ancho ?? 0.2)], [0, +(s * a).toFixed(3), -s * PI / 2]]);
  }
  return P;
}
function ave(c, v) {
  const r = nuevoRig('volador'), R = r.raiz, lig = !!c.ligero;
  const D = {
    // Pajaro Hueso: paloma blanca crema con cresta gris.
    pajaro:     { cuerpo: '#efdcc4', cabeza: '#f4e6d2', pico: '#9a9a9a', ojo: '#ff5a3a', ala: '#e8d8c0', ala2: '#b8a890', geo: 'pluma', env: 0.75, aleteo: 12 },
    // Aguila de Tormenta: morado oscuro, alas malva, cabeza gris clara y pico amarillo.
    aguila:     { cuerpo: '#3a1c34', cabeza: '#d8d8d8', pico: '#d8a848', ojo: '#ffb020', ala: '#603048', ala2: '#3a1c34', geo: 'pluma', env: 1.05, aleteo: 7 },
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
    // Cuerpo con pechuga, cola en abanico, cabeza con cuencas (la mascara de hueso del
    // pajaro), pico ganchudo de dos piezas y cresta o cejas de rapaz.
    const p1 = hx(piel), pico = D.pico, cab = c.color && v === 'pajaro' ? p1 : D.cabeza;
    const colaC = c.color && v !== 'pajaro' ? hx(osc(c.color, 0.8)) : D.ala, colaC2 = c.color && v !== 'pajaro' ? hx(osc(c.color, 0.6)) : D.ala2;
    const B = [['esferaB', p1, [0, 0, 0], [0.2, 0.2, 0.3]], ['esferaB', hx(mez(piel, '#ffffff', 0.25)), [0, -0.04, 0.12], [0.16, 0.15, 0.18]]];
    for (const [x, a, l] of [[0, 0, 0.36], [-0.05, 0.38, 0.3], [0.05, -0.38, 0.3]]) B.push(['cono', x ? colaC2 : colaC, [x, 0.03, -0.24], [0.07, l, 0.012], [-PI / 2 - 0.2, 0, a]]);
    MF(cu, B);
    const cb = r.cabeza = piv(r, G(cu, [0, 0.18, 0.26]));
    const C = [['esferaB', cab, [0, 0, 0], 0.135], ['cuna', pico, [0, 0.0, 0.09], [0.075, 0.07, 0.17]], ['cono4', pico, [0, -0.01, 0.24], [0.022, 0.07, 0.022], [PI - 0.25, 0, 0]]];
    for (const x of [-1, 1]) C.push(['caja', v === 'pajaro' ? '#2a2018' : '#1b1016', [x * 0.07, 0.03, 0.085], [0.06, 0.055, 0.06], [0, x * 0.5, x * 0.2]]);
    if (v === 'pajaro') for (const [z, l, a] of [[-0.02, 0.22, -0.55], [-0.08, 0.24, -0.95]]) C.push(['cono4', '#8a8a8a', [0, 0.1, z], [0.03, l, 0.05], [a, 0, 0]]);
    else for (const x of [-1, 1]) C.push(['caja', hx(osc(piel, 1.3)), [x * 0.075, 0.075, 0.07], [0.09, 0.03, 0.1], [0.2, 0, x * 0.4]]);
    MF(cb, C);
    const ojo = mat(D.ojo, { e: 1 });
    for (const x of [-1, 1]) M(cb, 'icos', ojo, [x * 0.088, 0.03, 0.1], 0.022);
    const mj = r.mandibula = piv(r, G(cb, [0, -0.03, 0.08]));
    M(mj, 'cuna', osc(pico, 0.8), [0, -0.012, 0], [0.06, 0.035, 0.14]);
  }
  const s1 = c.color && v !== 'pajaro' ? osc(c.color, 0.8) : D.ala;
  const mAla = mat(s1, { ds: true });
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.16 * s, 0.1, 0.02], [0, 0, 0.15 * s]));
    if (v === 'murcielago') M(p, D.geo, mAla, [0, 0, 0], [D.env * s, 1, D.env * 0.6]);
    else MF(p, partesAla(s, D.env, hx(s1), c.color && v !== 'pajaro' ? hx(osc(c.color, 0.6)) : D.ala2, lig ? 3 : 4));
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  const pie = v === 'murcielago' ? '#1b1b2b' : v === 'aguila' ? '#d8a848' : '#9a9a9a';
  for (const s of [-1, 1]) {
    const p = piv(r, G(cu, [0.07 * s, -0.15, 0]));
    const Q = [['cilT', pie, [0, 0, 0], [0.02, 0.16, 0.02]], v === 'murcielago' ? ['esferaB', pie, [0, -0.17, 0.03], [0.04, 0.015, 0.05]] : ['caja', pie, [0, -0.17, 0.03], [0.07, 0.025, 0.09]]];
    if (v !== 'murcielago' && !lig) for (const x of [-0.025, 0.025]) Q.push(['cono4', '#3a3a3a', [x, -0.17, 0.07], [0.01, 0.05, 0.01], [PI / 2 + 0.5, 0, 0]]);
    MF(p, Q);
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
// Cangrejo de cristal: caparazon bajo con una roca de prismas encima (los mayores
// brillan), ojos en pedunculo, una pinza mas grande que la otra con el dedo de abajo
// articulado y seis patas de dos tramos acabadas en punta.
function cangrejo(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, lig = !!c.ligero, carne = principal(c, '#8a0a8a');
  const k1 = hx(carne), k2 = hx(osc(carne, 0.62)), k3 = hx(mez(carne, '#ffffff', 0.32));
  const cristal = c.color ? hx(mez(c.color, '#6090d8', 0.55)) : '#6090d8', roca = c.color ? hx(mez(c.color, '#2a3a78', 0.7)) : '#3a5ab8';
  const brillo = mat(c.color ? mez(c.color, '#ffffff', 0.45) : '#9cc8ff', { e: 0.75 });
  r.paso = 12; r.ampPatas = 0.5; r.caer = 'panza'; r.hundir = 0.5;
  const cu = r.cuerpo = piv(r, G(R, [0, 0.38, 0]));
  const B = [
    ['esfera', k1, [0, 0, 0], [0.44, 0.2, 0.36]],
    ['esferaB', k3, [0, -0.07, 0.08], [0.36, 0.14, 0.3]],                // vientre claro
    ['cuna', k2, [0, 0.02, 0.24], [0.56, 0.15, 0.16]],                   // visera del caparazon
    ['semi', roca, [0, 0.06, -0.06], [0.4, 0.28, 0.34]],                 // roca
  ];
  const prismas = [[0, -0.06, 0.5, 0.11], [0.2, 0.02, 0.36, 0.09], [-0.21, -0.02, 0.4, 0.09], [0.1, -0.26, 0.36, 0.08], [-0.12, -0.27, 0.3, 0.08], [0.02, 0.17, 0.26, 0.07], [0.31, -0.16, 0.22, 0.06], [-0.31, -0.14, 0.24, 0.06]];
  prismas.forEach(([x, z, h, g], i) => {
    const pos = [x, 0.2 + (0.3 - h) * 0.2, z], esc = [g, h, g], rot = [z * 1.1, x * 3, -x * 1.6];
    if (i < 3) M(cu, 'cono4', brillo, pos, esc, rot);          // los tres mayores brillan (van fundidos: no son dibujos de mas)
    else if (!lig || i < 6) B.push(['cono4', cristal, pos, esc, rot]);
  });
  MF(cu, B);
  const cb = r.cabeza = piv(r, G(cu, [0, 0.1, 0.3]));
  const C = [['caja', '#2a0020', [0, -0.07, 0.07], [0.16, 0.06, 0.05]]];
  for (const s of [-1, 1]) {
    C.push(['caja', k1, [s * 0.11, 0.07, 0], [0.04, 0.17, 0.04]], ['caja', '#1b1430', [s * 0.11, 0.17, 0.05], [0.03, 0.05, 0.02]]);
    C.push(['cono4', k2, [s * 0.05, -0.04, 0.1], [0.025, 0.1, 0.025], [PI, 0, s * 0.3]]);     // palpos
  }
  MF(cb, C);
  const ojo = mat('#ffe14a', { e: 1 });
  for (const s of [-1, 1]) M(cb, 'icos', ojo, [s * 0.11, 0.17, 0], 0.052);
  for (const s of [1, -1]) {
    const brazo = piv(r, G(cu, [s * 0.38, 0, 0.18], [0, s * 0.5, 0]));
    const Q = [
      ['miembro', k1, [0, 0, 0], [0.07, 0.26, 0.07], [-PI / 2, 0, 0]],
      ['esferaB', k1, [0, 0.03, 0.36], [0.13, 0.12, 0.17]],                 // mano de la pinza
      ['cuna', k1, [0, 0.07, 0.44], [0.11, 0.1, 0.23]],                     // dedo fijo
    ];
    MF(brazo, Q);
    const inf = piv(r, G(brazo, [0, -0.02, 0.4], [0.28, 0, 0]));
    M(inf, 'cuna', k2, [0, -0.025, 0], [0.09, 0.06, 0.24]);
    r.pinzas.push(inf);
    if (s < 0) brazo.scale.setScalar(1.12);                                 // la pinza derecha, de machacar
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5, giro = s > 0 ? a : PI - a;
      const p = piv(r, G(R, [s * 0.3, 0.36, 0.08 - i * 0.14], [0, giro, 0]));
      MF(p, [['miembro', k1, [0, 0, 0], [0.045, 0.28, 0.045], [0, 0, 2.0]], ['cono', k2, [0.255, 0.117, 0], [0.04, 0.5, 0.04], [0, 0, PI + 0.25]]]);
      r.patas.push([p, (i % 2 ? PI : 0) + (s > 0 ? 0 : PI), 'y', i === 0]);
    }
  }
  r.lomo = cu; r.H = 0.6; r.topeCabeza = 0.32;
  return r;
}

// Pez Ogro (y el Leviatan): pez abisal panzudo de mandibula saliente llena de dientes,
// ceño, branquias, cresta de puas, un farolillo que cuelga delante y aletas macizas.
function pezOgro(c) {
  const r = nuevoRig('pez'), R = r.raiz, lig = !!c.ligero, piel = principal(c, '#183048');
  const p1 = hx(piel), p2 = hx(osc(piel, 0.62)), panza = c.color ? hx(mez(c.color, '#ffffff', 0.5)) : '#1c5a70', aleta = c.color ? hx(osc(c.color, 0.5)) : '#2a9a48', diente = '#f4efd8';
  const sx = 0.42, sy = 0.42, sz = 0.5;
  r.caer = 'panza'; r.hundir = 0.3; r.colaAmp = 0; r.vuela = true;
  const cu = r.cuerpo = piv(r, G(R, [0, sy + 0.05, 0]));
  const B = [
    ['esfera', p1, [0, 0, 0.02], [sx, sy, sz]],
    ['esferaB', panza, [0, -sy * 0.32, 0.1], [sx * 0.8, sy * 0.62, sz * 0.72]],
    ['tronco', p1, [0, 0.02, -sz * 0.55], [sx * 0.52, sz * 0.6, sy * 0.6], [-PI / 2, 0, 0]],          // pedunculo de la cola
    ['caja', '#1a0810', [0, -sy * 0.2, sz * 0.74], [sx * 1.0, sy * 0.16, sz * 0.3]],                   // boca por dentro
  ];
  for (const s of [-1, 1]) {
    B.push(['caja', p2, [s * sx * 0.5, sy * 0.44, sz * 0.66], [sx * 0.55, 0.07, 0.16], [0.3, 0, s * 0.38]]);     // ceño
    B.push(['caja', '#0c1420', [s * sx * 0.58, sy * 0.28, sz * 0.76], [0.13, 0.11, 0.08], [0, s * 0.6, 0]]);     // cuenca
    if (!lig) B.push(['caja', '#0c1420', [s * sx * 0.95, 0, sz * 0.22], [0.03, sy * 0.5, 0.04]], ['caja', '#0c1420', [s * sx * 0.97, 0, sz * 0.05], [0.03, sy * 0.42, 0.04]], ['icos', '#d87830', [s * sx * 0.78, sy * 0.3, -sz * 0.3], 0.05], ['icos', '#d87830', [s * sx * 0.7, -sy * 0.1, -sz * 0.55], 0.04]);
  }
  for (const [x, a] of [[-0.24, 0.25], [-0.09, 0.08], [0.09, -0.08], [0.24, -0.25]]) B.push(['cono4', diente, [x, -sy * 0.14, sz * 0.9 - Math.abs(x) * 0.25], [0.035, 0.13, 0.03], [PI, 0, a]]);   // dientes de arriba
  [[0.26, 0.3], [0, 0.4], [-0.26, 0.3], [-0.48, 0.2]].forEach(([z, h]) => B.push(['cono4', aleta, [0, sy * 0.88, z], [0.06, h, 0.11], [-0.45, 0, 0]]));   // cresta
  MF(cu, B);
  const ojo = mat('#ff3030', { e: 1 });
  for (const s of [-1, 1]) M(cu, 'icos', ojo, [s * sx * 0.6, sy * 0.28, sz * 0.82], 0.06);
  // Farolillo de pez abisal: cuelga delante de la boca, se mece y late.
  const far = piv(r, G(cu, [0, sy * 0.86, sz * 0.5], [0.5, 0, 0]));
  M(far, 'caja', p2, [0, 0.17, 0], [0.03, 0.34, 0.03]);
  M(far, 'caja', p2, [0, 0.36, 0.07], [0.025, 0.03, 0.18], [0.5, 0, 0]);
  M(far, 'icos', mat(c.color ? mez(c.color, '#ffffff', 0.5) : '#ffe27a', { e: 1 }), [0, 0.32, 0.17], 0.06);
  fuera(far); (r.cuelgan || (r.cuelgan = [])).push([far, 'x', 0.1, 0.18, 1.7]);
  const cola = r.cola = piv(r, G(cu, [0, 0.02, -sz * 1.1]));
  M(cola, 'colaPez', mat(aleta, { ds: true }), [0, 0, 0], [1, sy * 1.05, sz * 0.62]);
  r.aletas = [];
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [sx * 0.9 * s, -sy * 0.2, sz * 0.15]));
    M(p, 'cuna', aleta, [0, 0, 0], [0.3, 0.04, 0.3], [0, s * (PI / 2 + 0.7), 0]);
    r.aletas.push(p);
  }
  const mj = r.mandibula = piv(r, G(cu, [0, -sy * 0.3, sz * 0.62]));
  const J = [['caja', p2, [0, -0.035, sz * 0.14], [sx * 1.15, sy * 0.22, sz * 0.44]]];
  for (const [x, h] of [[-0.2, 0.15], [-0.1, 0.1], [0, 0.09], [0.1, 0.1], [0.2, 0.15]]) J.push(['cono4', diente, [x, sy * 0.05, sz * 0.32 - Math.abs(x) * 0.2], [0.035, h, 0.03]]);
  MF(mj, J);
  r.cabeza = cu; r.H = 0.6; r.topeCabeza = sy;
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
// Ala de dragon maciza (membrana con grosor) para cada lado: asi se funde con los huesos
// del ala en una sola malla. D = hacia +x, I = hacia -x.
const PUNTOS_ALA = [[0, -0.1], [0.55, -0.12], [1, 0.05], [0.85, 0.35], [0.62, 0.22], [0.45, 0.55], [0.26, 0.3], [0, 0.45]];
Object.assign(FABRICA, {
  alaD: () => new THREE.ExtrudeGeometry(forma(PUNTOS_ALA), { depth: 0.02, bevelEnabled: false }).rotateX(-PI / 2),
  alaI: () => new THREE.ExtrudeGeometry(forma(PUNTOS_ALA.map(([x, y]) => [-x, y]).reverse()), { depth: 0.02, bevelEnabled: false }).rotateX(-PI / 2),
});
// Dragon ancestral: pecho ancho con placas en el vientre, cuello con cresta, cabeza de
// hocico en cuña con cuernos echados atras y dientes, patas de bestia con garras, alas de
// membrana con sus dedos y cola en dos tramos con punta de lanza.
function dragon(c) {
  const r = nuevoRig('cuadrupedo'), R = r.raiz, lig = !!c.ligero, piel = principal(c, '#1c1c70');
  const p1 = hx(piel), p2 = hx(osc(piel, 0.62)), vientre = c.color ? hx(mez(c.color, '#ffffff', 0.4)) : '#2a7aa8', cuerno = '#c8c8e8', memb = c.color ? hx(osc(c.color, 0.55)) : '#4a1a40';
  r.paso = 6; r.vuela = !!c.vuela; r.aleteo = 4.5; r.amplAla = 0.55; r.caer = 'lado'; r.hundir = 0.45; r.tAtk = 0.5; r.colaAmp = 0.25; r.zarpa = !c.montura;
  const cu = r.cuerpo = piv(r, G(R, [0, 1.1, 0]));
  const B = [['esfera', p1, [0, 0, 0], [0.55, 0.5, 1.0]], ['esferaB', p1, [0, 0.08, 0.52], [0.5, 0.48, 0.52]]];
  for (let i = 0; i < 4; i++) B.push(['caja', vientre, [0, -0.4 + Math.abs(i - 1.3) * 0.045, 0.62 - i * 0.37], [0.5 - Math.abs(i - 1.3) * 0.07, 0.1, 0.34], [(i - 1.3) * 0.16, 0, 0]]);   // placas del vientre
  for (const [y, z, k] of c.montura ? [[0.36, -0.7, 1]] : [[0.5, 0.52, 1.25], [0.5, 0.12, 1.4], [0.46, -0.3, 1.2], [0.36, -0.7, 1]]) B.push(['cono4', cuerno, [0, y, z], [0.07 * k, 0.26 * k, 0.1 * k], [-0.45, 0, 0]]);
  MF(cu, B);
  const cuello = piv(r, G(cu, [0, 0.3, 0.78], [0.55, 0, 0]));
  const N = [['tronco', p1, [0, 0, 0], [0.27, 0.9, 0.27]], ['caja', vientre, [0, 0.4, 0.14], [0.2, 0.7, 0.1], [-0.12, 0, 0]]];
  if (!lig && !c.montura) for (const y of [0.25, 0.5, 0.72]) N.push(['cono4', cuerno, [0, y, -0.2 + y * 0.1], [0.05, 0.18, 0.07], [-1.1, 0, 0]]);
  MF(cuello, N);
  const cb = r.cabeza = piv(r, G(cuello, [0, 0.85, 0], [-0.55, 0, 0]));
  const C = [
    ['esferaB', p1, [0, 0.02, 0.06], [0.27, 0.23, 0.3]],
    ['cuna', p1, [0, -0.02, 0.18], [0.32, 0.25, 0.56]],                                    // hocico
    ['caja', p2, [0, 0.07, 0.6], [0.16, 0.05, 0.1]],                                       // narices
  ];
  for (const s of [-1, 1]) {
    C.push(['cono', cuerno, [s * 0.14, 0.16, -0.1], [0.06, 0.46, 0.06], [-1.05, 0, -s * 0.3]]);           // cuerno
    C.push(['cono4', cuerno, [s * 0.24, -0.02, -0.02], [0.04, 0.2, 0.04], [-1.2, 0, -s * 1.1]]);          // pua de la mejilla
    C.push(['caja', p2, [s * 0.14, 0.15, 0.2], [0.16, 0.05, 0.16], [0.2, 0, s * 0.35]]);                 // ceño
    if (!lig) C.push(['cono4', '#f4efd8', [s * 0.11, -0.09, 0.42], [0.025, 0.1, 0.025], [PI, 0, 0]], ['cono4', '#f4efd8', [s * 0.07, -0.07, 0.58], [0.022, 0.08, 0.022], [PI, 0, 0]]);
  }
  MF(cb, C);
  const ojo = mat('#ffd84a', { e: 1 });
  for (const s of [-1, 1]) M(cb, 'icos', ojo, [s * 0.16, 0.09, 0.28], 0.045);
  const mj = r.mandibula = piv(r, G(cb, [0, -0.13, 0.16]));
  MF(mj, [['cuna', p2, [0, -0.01, 0], [0.26, 0.1, 0.54]], ['caja', '#b02a3a', [0, 0.03, 0.2], [0.1, 0.02, 0.3]], ['cono4', '#f4efd8', [0.09, 0.01, 0.3], [0.025, 0.09, 0.025]], ['cono4', '#f4efd8', [-0.09, 0.01, 0.3], [0.025, 0.09, 0.025]]]);
  for (const s of [1, -1]) {
    const p = piv(r, G(cu, [0.35 * s, 0.4, 0.25], [0, 0, 0.45 * s]));
    const g = G(p, [0, 0, 0], [-0.35, 0, 0]);
    // Membrana (2,2 x 1,6) y, encima, el brazo del ala y dos dedos.
    const W = [[s > 0 ? 'alaD' : 'alaI', memb, [0, 0, 0], [2.2, 1, 1.6]], ['caja', p1, [s * 1.1, 0.03, 0.05], [2.2, 0.07, 0.09], [0, s * 0.11, 0]], ['cono4', cuerno, [s * 1.2, 0.03, 0.17], [0.05, 0.2, 0.05], [PI / 2, 0, 0]]];
    if (!lig) W.push(['caja', p1, [s * 1.6, 0.03, -0.24], [0.06, 0.05, 0.72], [0, -s * 0.72, 0]], ['caja', p1, [s * 1.16, 0.03, -0.38], [0.06, 0.05, 1.05], [0, s * 0.3, 0]]);
    MF(g, W);
    if (s > 0) r.alaP = p; else r.alaN = p;
  }
  const cola = r.cola = piv(r, G(cu, [0, -0.05, -0.95]));
  MF(cola, [
    ['tronco', p1, [0, 0, 0], [0.3, 1.0, 0.24], [-1.75, 0, 0]],
    ['cono', p1, [0, -0.18, -0.98], [0.165, 1.0, 0.13], [-1.6, 0, 0]],
    ['cuna', cuerno, [0, -0.21, -1.86], [0.34, 0.05, 0.3], [0, PI, 0]],
    ['cono4', cuerno, [0, 0.14, -0.4], [0.05, 0.2, 0.07], [-0.6, 0, 0]], ['cono4', cuerno, [0, 0.04, -0.85], [0.045, 0.17, 0.06], [-0.6, 0, 0]],
  ]);
  const o = { g: 0.14, c1: p1, c2: p2 };
  pataB(r, R, [0.42, 0.95, 0.55], { ...o, largo: 0.95, del: true, ph: 0, garras: !lig });
  pataB(r, R, [-0.42, 0.95, 0.55], { ...o, largo: 0.95, del: true, ph: PI, garras: !lig });
  pataB(r, R, [0.42, 0.98, -0.5], { ...o, largo: 0.98, ph: PI });
  pataB(r, R, [-0.42, 0.98, -0.5], { ...o, largo: 0.98, ph: 0 });
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
  pez_grande: pezOgro,
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
// o (opcional): { ligero: true } = calidad baja (sin adornos menudos ni pivotes de capa o mandibula).
export function crearMonstruo(k, o) {
  const d = MONSTRUOS[k] || { hoja: 'goblin_normal', nivel: 1 };
  let alto = 62 / PX_M;
  try { if (MONSTRUOS[k]) alto = statsMonstruo(k).alto / PX_M; } catch (e) {}
  const c = { k, color: d.tinte || null, jefe: !!d.jefe, e: d.jefe ? 0.22 : 0, vuela: !!d.vuela, ligero: !!(o && o.ligero) };
  const r = (ARQ[d.hoja] || ARQ.goblin_normal)(c);
  if (c.jefe) decorarJefe(r);
  const m = new Modelo(r, alto, 'm:' + k + (c.jefe ? ':j' : '') + (c.ligero ? '#l' : ''));
  if (c.jefe) m._aura(c.color || '#ff4444');
  m.tipo = 'monstruo'; m.k = k; m.hoja = d.hoja; m.vuela = !!d.vuela; m.jefe = c.jefe;
  return m;
}

// NPC del pueblo: los mismos arquetipos con colores amables y ojos de duende.
// look (opcional, vecinos de mundo/js/vecinos.js): { color: ropa, acc: 'paja' | 'capucha', accC: color del accesorio }.
export function crearNpc(hoja, look) {
  const c = { k: 'npc_' + hoja, color: (look && look.color) || null, jefe: false, e: 0, amigo: true };
  let r;
  if (hoja === 'goblin_guard') { c.color = c.color || '#2f6fd6'; r = goblin(c, 'goblin_guard'); }
  else if (hoja === 'goblin_mage') { c.color = c.color || '#b9a4f5'; r = goblin(c, 'goblin_mage'); }
  else if (hoja === 'goblin_peasant') r = goblin(c, 'goblin_peasant');
  else if (hoja === 'hechicero') r = hechicero(c);
  else r = (ARQ[hoja] || ARQ.goblin_peasant)(c);
  if (look && look.acc && ACC[look.acc]) ACC[look.acc](r, look.accC);
  const m = new Modelo(r, 62 / PX_M, 'n:' + hoja + (look ? ':' + (look.color || '') + ':' + (look.acc || '') + ':' + (look.accC || '') : ''));
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
