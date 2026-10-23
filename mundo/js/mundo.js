// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — cliente del mundo abierto (Three.js)
//
// Estilo Ragnarok Online / Octopath: el mundo es 3D (relieve, bosques, agua,
// el pueblo) y los personajes y monstruos son los sprites de siempre, de pie
// y girados hacia la camara. Asi se usa todo el arte del juego y va fluido en
// el movil.
//
// Es el MISMO personaje del MMO 2D (mismo servidor, mismo 'hola' con
// modo: '3d'). El servidor manda; aqui se predice el movimiento propio y se
// interpolan los demas. El terreno, las zonas y los campamentos salen de
// mmo/js/mundo3d.js, igual que en el servidor.
// ═══════════════════════════════════════════════════════
import * as THREE from 'three';
import { MAPAS, MONSTRUOS, HOJAS, SKINS, CLASES, PODERES, ARMAS, VARA, MISIONES, DIARIA, statsMonstruo, xpParaSubir,
  habsDe, habPorId, costoHab, RECURSOS, GCD_MS, MONTURAS, velMontura } from '/mmo/js/data.js?v=246';
import { iniciarVentanas } from './ventanas.js?v=246';
import { crearDuende, crearMonstruo, crearNpc, crearMontura, precalentar } from './modelos.js?v=246';
import { MUNDO, ZONAS3D, NPCS3D, NPC_DIST, CASAS, SPAWN3D, ARENA3D, alturaEn, zonaEn, mezclaEn, pendienteEn, campamentos } from '/mmo/js/mundo3d.js?v=246';

const A = '/assets/';
const PX_M = 34;                       // pixeles del 2D por metro
const $ = id => document.getElementById(id);
const MOVIL = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
if (MOVIL) document.body.classList.add('movil');
const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
if (TG) { try { TG.ready(); TG.expand(); TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

// ── COLORES DE CADA ZONA ──
const SUELO = {
  pueblo: '#6fbf5a', noche: '#2c5a3b', amanecer: '#b5603f', selva: '#3fa34d', tormenta: '#6e6a85', desierto: '#e3c27a',
  castillo: '#7d7a72', cumbres: '#8f8799', cavernas: '#3e6670', abismo: '#d8c08a', acantilados: '#9a6fc4',
};
const CIELO = {
  pueblo: '#9ad0ff', noche: '#1d2756', amanecer: '#ffb48f', selva: '#a6e3b8', tormenta: '#6b6f9a', desierto: '#ffd9a0',
  castillo: '#7a6f8c', cumbres: '#c9b6e8', cavernas: '#2f4d5d', abismo: '#4a8fbf', acantilados: '#d9a8ff',
};
const LUZ = { noche: 0.8, cavernas: 0.8, tormenta: 0.85 };
const C = h => new THREE.Color(h);

// ── ESCENA ──
const lienzo = $('lienzo');
const render = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !MOVIL, powerPreference: 'high-performance' });
render.setPixelRatio(Math.min(devicePixelRatio || 1, MOVIL ? 1 : 1.5));
render.outputColorSpace = THREE.SRGBColorSpace;
const escena = new THREE.Scene();
escena.background = C(CIELO.pueblo);
escena.fog = new THREE.Fog(CIELO.pueblo, 40, MOVIL ? 170 : 230);
const camara = new THREE.PerspectiveCamera(60, 1, 0.3, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a78, 1.0);
const sol = new THREE.DirectionalLight(0xfff2dd, 1.0);
sol.position.set(120, 200, 80);
escena.add(hemi, sol);
function ajustar() {
  const w = innerWidth, h = innerHeight;
  render.setSize(w, h, false);
  camara.aspect = w / h; camara.updateProjectionMatrix();
}
addEventListener('resize', ajustar);
ajustar();

const progreso = (k, txt) => { $('carga-i').style.transform = `scaleX(${k})`; if (txt) $('carga-s').textContent = txt; };

// ── TERRENO ──
const LADO = MUNDO.lado, SEG = MOVIL ? 180 : 240;
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
// Caminos de tierra desde el pueblo a cada zona (guian al jugador).
const CAMINOS = Object.values(ZONAS3D).map(c => [0, 0, c.x * 0.72, c.z * 0.72]);
function enCamino(x, z) { let m = Infinity; for (const [a, b, c, d] of CAMINOS) m = Math.min(m, distSeg(x, z, a, b, c, d)); return m; }
function colorSuelo(x, z, h, out) {
  out.setRGB(0, 0, 0);
  const t = new THREE.Color();
  for (const [id, k] of mezclaEn(x, z)) { t.set(SUELO[id]); out.r += t.r * k; out.g += t.g * k; out.b += t.b * k; }
  // El pueblo: cesped claro que se funde con las zonas de alrededor y la plaza.
  const dp = Math.hypot(x, z);
  if (dp < MUNDO.pueblo.radio + 40) out.lerp(C(SUELO.pueblo), 1 - clamp((dp - MUNDO.pueblo.radio) / 40, 0, 1));
  if (dp < 26) out.lerp(C('#cdb98a'), 0.7);
  const p = pendienteEn(x, z);
  if (p > 0.6) out.lerp(C('#6b6460'), clamp((p - 0.6) * 1.5, 0, 0.85));       // roca en las laderas
  if (h > 26) out.lerp(C('#f2f4ff'), clamp((h - 26) / 10, 0, 0.9));           // nieve en las cumbres
  if (h < 1.2 && h > -3) out.lerp(C('#e0cf96'), clamp((1.2 - h) / 1.5, 0, 0.8)); // arena junto al agua
  const cam = enCamino(x, z);
  if (cam < 4 && Math.hypot(x, z) > 20) out.lerp(C('#a8865a'), (1 - cam / 4) * 0.75);
  const v = 0.92 + 0.16 * (((x * 73856093 ^ z * 19349663) >>> 0) % 100) / 100;
  out.multiplyScalar(v);
  return out;
}
function crearTerreno() {
  const g = new THREE.PlaneGeometry(LADO, LADO, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = alturaEn(x, z);
    pos.setY(i, h);
    colorSuelo(x, z, h, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  escena.add(m);
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(LADO * 1.4, LADO * 1.4).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a8fd0, transparent: true, opacity: 0.72 }));
  agua.position.y = MUNDO.agua;
  escena.add(agua);
  return agua;
}

// ── VEGETACION Y DECORADO (instanciado: miles de arboles en pocas llamadas) ──
function hashR(x, z, s) { let h = (x | 0) * 374761393 + (z | 0) * 668265263 + s * 2654435761; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const FLORA = {
  noche:       [['pino', 0.42, '#2f6e4a']],
  amanecer:    [['redondo', 0.22, '#d9733a'], ['roca', 0.06]],
  selva:       [['redondo', 0.45, '#2f9e44'], ['arbusto', 0.25, '#3fbf55']],
  tormenta:    [['muerto', 0.12, '#59546e'], ['roca', 0.16]],
  desierto:    [['cactus', 0.07, '#4f9a3f'], ['roca', 0.07]],
  castillo:    [['pilar', 0.05, '#8b8578'], ['pino', 0.06, '#3e5a46'], ['roca', 0.08]],
  cumbres:     [['nieve', 0.22, '#3d7458'], ['roca', 0.18]],
  cavernas:    [['cristal', 0.12, '#5eead4'], ['roca', 0.2]],
  abismo:      [['palma', 0.09, '#3fae6a'], ['roca', 0.05]],
  acantilados: [['magico', 0.24, '#e879f9'], ['cristal', 0.07, '#c084fc']],
  pueblo:      [['redondo', 0.05, '#4cae4c']],
};
// Arboles altos en una rejilla de 8 m: la camara se acerca si uno se mete
// entre ella y el duende (como en WoW).
const REJ = 8, rejilla = new Map();
const TAPAN = { pino: 1.7, nieve: 1.8, redondo: 2.1, muerto: 0.5, cactus: 0.6, pilar: 1.1, palma: 0.5, magico: 1.9 };
// Distancia (0..1 del segmento) a la que la camara choca con un arbol, o 1.
function choqueCamara(tx, tz, cx, cz) {
  let k = 1;
  const dx = cx - tx, dz = cz - tz, l2 = dx * dx + dz * dz || 1;
  const x0 = Math.floor(Math.min(tx, cx) / REJ), x1 = Math.floor(Math.max(tx, cx) / REJ);
  const z0 = Math.floor(Math.min(tz, cz) / REJ), z1 = Math.floor(Math.max(tz, cz) / REJ);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
    const l = rejilla.get(gx + ',' + gz);
    if (!l) continue;
    for (const a of l) {
      const u = clamp(((a.x - tx) * dx + (a.z - tz) * dz) / l2, 0, 1);
      if (u < 0.08) continue;   // pegado al duende: no acercar de golpe
      const d = Math.hypot(tx + dx * u - a.x, tz + dz * u - a.z);
      if (d < a.r) k = Math.min(k, u - a.r / Math.sqrt(l2));
    }
  }
  return clamp(k, 0.15, 1);
}
function crearFlora() {
  const tipos = {};
  const campos = campamentos(MAPAS, MONSTRUOS);
  const paso = MOVIL ? 9 : 7;
  for (let x = -600; x <= 600; x += paso) for (let z = -600; z <= 600; z += paso) {
    const jx = x + (hashR(x, z, 1) - 0.5) * paso, jz = z + (hashR(x, z, 2) - 0.5) * paso;
    const zona = zonaEn(jx, jz);
    const h = alturaEn(jx, jz);
    if (h < 0.5 || pendienteEn(jx, jz) > 0.95) continue;
    if (enCamino(jx, jz) < 5) continue;
    const dp = Math.hypot(jx, jz);
    if (dp < 34 || CASAS.some(c => Math.hypot(c.x - jx, c.z - jz) < 9)) continue;
    let r = hashR(x, z, 3);
    for (const [tipo, dens, color] of FLORA[zona] || []) {
      if (r < dens) {
        if (campos.some(c => Math.hypot(c.x - jx, c.z - jz) < 7)) break;
        const s = 0.75 + hashR(x, z, 4) * 0.6;
        (tipos[tipo] = tipos[tipo] || []).push({ x: jx, z: jz, y: h, s, rot: hashR(x, z, 5) * 6.28, color });
        if (TAPAN[tipo]) { const kc = Math.floor(jx / REJ) + ',' + Math.floor(jz / REJ); let c = rejilla.get(kc); if (!c) rejilla.set(kc, c = []); c.push({ x: jx, z: jz, r: TAPAN[tipo] * s }); }
        break;
      }
      r -= dens;
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const piezas = {
    pino: [[new THREE.CylinderGeometry(0.25, 0.35, 2, 5), '#5a3c25', 1], [new THREE.ConeGeometry(2, 6, 7), null, 4.6]],
    nieve: [[new THREE.CylinderGeometry(0.25, 0.35, 2, 5), '#5a3c25', 1], [new THREE.ConeGeometry(2.1, 6, 7), null, 4.6], [new THREE.ConeGeometry(1.1, 2.2, 7), '#f4f6ff', 6.9]],
    redondo: [[new THREE.CylinderGeometry(0.3, 0.45, 3, 6), '#6b4527', 1.5], [new THREE.IcosahedronGeometry(2.4, 0), null, 4.4]],
    arbusto: [[new THREE.IcosahedronGeometry(1.2, 0), null, 0.8]],
    muerto: [[new THREE.CylinderGeometry(0.15, 0.4, 5, 5), null, 2.5], [new THREE.CylinderGeometry(0.08, 0.15, 2.4, 4).rotateZ(0.9), null, 3.6]],
    cactus: [[new THREE.CylinderGeometry(0.45, 0.5, 3.2, 7), null, 1.6], [new THREE.CylinderGeometry(0.25, 0.25, 1.4, 6).rotateZ(1.57), null, 2]],
    pilar: [[new THREE.BoxGeometry(1.4, 5, 1.4), null, 2.5], [new THREE.BoxGeometry(2, 0.5, 2), null, 5.2]],
    cristal: [[new THREE.OctahedronGeometry(1.1, 0).scale(0.7, 1.8, 0.7), null, 1.6]],
    palma: [[new THREE.CylinderGeometry(0.2, 0.3, 6, 6), '#8a6a3f', 3], [new THREE.ConeGeometry(2.6, 1, 6), null, 6.1]],
    magico: [[new THREE.CylinderGeometry(0.25, 0.4, 3, 6), '#5b3a7a', 1.5], [new THREE.SphereGeometry(2.2, 7, 5), null, 4.4]],
    roca: [[new THREE.DodecahedronGeometry(1.3, 0), '#77716b', 0.5]],
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  for (const tipo in tipos) {
    const l = tipos[tipo];
    for (const [geo, colorFijo, alto] of piezas[tipo]) {
      const im = new THREE.InstancedMesh(geo, mat.clone(), l.length);
      if (tipo === 'cristal' || tipo === 'magico') im.material.emissive = C(l[0].color).multiplyScalar(0.35);
      l.forEach((t, i) => {
        e.set(0, t.rot, 0); q.setFromEuler(e);
        sc.set(t.s, t.s, t.s);
        v.set(t.x, t.y + alto * t.s, t.z);
        m4.compose(v, q, sc);
        im.setMatrixAt(i, m4);
        col.set(colorFijo || t.color || '#888888').offsetHSL(0, 0, (hashR(t.x | 0, t.z | 0, 9) - 0.5) * 0.12);
        im.setColorAt(i, col);
      });
      escena.add(im);
    }
  }
}
// El pueblo: casas, plaza, pozo y el portal a las mazmorras.
function crearPueblo() {
  const pared = new THREE.MeshLambertMaterial({ color: 0xd9c39a }), techo = new THREE.MeshLambertMaterial({ color: 0xa04a3a }), madera = new THREE.MeshLambertMaterial({ color: 0x5a3c25 });
  for (const c of CASAS) {
    const y = alturaEn(c.x, c.z);
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(c.w, 4, c.d), pared); cuerpo.position.y = 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(Math.max(c.w, c.d) * 0.78, 3.4, 4), techo); t.position.y = 5.7; t.rotation.y = Math.PI / 4;
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), madera); puerta.position.set(0, 1.2, c.d / 2 + 0.05);
    g.add(cuerpo, t, puerta);
    g.position.set(c.x, y, c.z); g.rotation.y = c.r;
    escena.add(g);
  }
  const pozo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0x9a948a }));
  pozo.position.set(0, alturaEn(0, 0) + 0.6, 0); escena.add(pozo);
  // Portal de mazmorras (por ahora, en el juego 2D).
  const px = 22, pz = -18, py = alturaEn(px, pz);
  const piedra = new THREE.MeshLambertMaterial({ color: 0x5b5470 });
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), piedra); p1.position.set(px - 2.2, py + 3, pz);
  const p2 = p1.clone(); p2.position.x = px + 2.2;
  const arco = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1, 1.2), piedra); arco.position.set(px, py + 6.3, pz);
  const velo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  velo.position.set(px, py + 2.9, pz);
  escena.add(p1, p2, arco, velo);
  return { x: px, z: pz, velo };
}

// Claro del Titan: circulo de menhires donde aparece el jefe mundial.
(() => {
  const piedra = new THREE.MeshLambertMaterial({ color: 0x6b6478 });
  const runa = new THREE.MeshBasicMaterial({ color: 0xff6b3d });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = ARENA3D.x + Math.cos(a) * ARENA3D.r, z = ARENA3D.z + Math.sin(a) * ARENA3D.r;
    const alto = 4 + (i % 3) * 1.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, alto, 1), piedra);
    m.position.set(x, alturaEn(x, z) + alto / 2 - 0.3, z); m.rotation.y = -a; m.rotation.z = (i % 2 ? 0.06 : -0.05);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), runa);
    r.position.set(0, alto * 0.15, 0.51); m.add(r);
    escena.add(m);
  }
  const suelo = new THREE.Mesh(new THREE.RingGeometry(ARENA3D.r - 1.2, ARENA3D.r - 0.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6b3d, transparent: true, opacity: 0.35, depthWrite: false }));
  suelo.position.set(ARENA3D.x, alturaEn(ARENA3D.x, ARENA3D.z) + 0.2, ARENA3D.z);
  escena.add(suelo);
})();

// ── SPRITES (planos que miran a la camara, con la hoja de animacion) ──
const imagenes = {};
function cargarImg(src) {
  if (imagenes[src]) return imagenes[src];
  return (imagenes[src] = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
}
const texturas = new Map();
function textura(img) {
  if (texturas.has(img)) return texturas.get(img);
  const t = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: true });
  texturas.set(img, mat);
  return mat;
}
// Hoja del duende teñida para las skins premium (igual que el 2D).
function teñir(img, hue, sat) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, giro = (hue || 0) / 360;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) { const dd = mx - mn; s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h /= 6; }
    h = (h + giro) % 1; s = Math.min(1, s * (sat || 1));
    const q2 = l < .5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q2;
    const k = t => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < .5 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2; };
    p[i] = k(h + 1 / 3) * 255; p[i + 1] = k(h) * 255; p[i + 2] = k(h - 1 / 3) * 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}
const sombraTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }); })();
const anilloMat = new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), anilloMat);
anillo.visible = false;
escena.add(anillo);

// Alas de luz (vuelo estilo AION).
function nuevasAlas() {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(0, 0); forma.quadraticCurveTo(0.9, 0.9, 2.1, 0.7); forma.quadraticCurveTo(1.4, 0.1, 1.9, -0.4); forma.quadraticCurveTo(0.9, -0.3, 0, 0);
  const geo = new THREE.ShapeGeometry(forma);
  const mat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  const izq = new THREE.Mesh(geo, mat), der = new THREE.Mesh(geo, mat);
  der.scale.x = -1;
  g.add(izq, der);
  g.visible = false;
  escena.add(g);
  return g;
}
const alasMesh = nuevasAlas();
// Alas en la espalda (ry = hacia donde mira; con sprites, hacia la camara).
function ponerAlas(g, x, y, z, ry, t) {
  const bat = Math.sin(t / 120) * 0.5;
  g.position.set(x - Math.sin(ry) * 0.25, y + 1.15, z - Math.cos(ry) * 0.25); g.rotation.set(0, ry, 0);
  g.children[0].rotation.y = 0.5 + bat; g.children[1].rotation.y = -0.5 - bat;
}
class Figura {
  // ancho/alto en metros del cuadro entero de la hoja.
  constructor(mat, ancho, alto, cols, filas) {
    this.g = new THREE.PlaneGeometry(ancho, alto); this.g.translate(0, alto / 2, 0);
    this.m = new THREE.Mesh(this.g, mat);
    this.cols = cols; this.filas = filas; this.izq = false; this.f = 1; this.ultimo = '';
    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), sombraTex);
    escena.add(this.m, this.sombra);
  }
  cuadro(col, fila, mirandoDer) {
    const k = col + ',' + fila + ',' + mirandoDer;
    if (k === this.ultimo) return;
    this.ultimo = k;
    let u0 = col / this.cols, u1 = (col + 1) / this.cols;
    if (mirandoDer === this.izq) [u0, u1] = [u1, u0];
    const v1 = 1 - fila / this.filas, v0 = 1 - (fila + 1) / this.filas;
    const uv = this.g.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
  }
  poner(x, y, z, yaw, escala) {
    this.m.position.set(x, y, z); this.m.rotation.set(0, yaw, 0);
    if (escala) this.m.scale.set(escala[0], escala[1], 1);
    this.sombra.position.set(x, alturaEn(x, z) + 0.05, z);
  }
  quitar() { escena.remove(this.m, this.sombra); this.g.dispose(); this.sombra.geometry.dispose(); }
}
// ── MODELOS 3D (mundo/js/modelos.js) ──
// Figura3D tiene la misma interfaz que Figura (poner, quitar y 'm' para
// elegir con el raton). Con ?sprites=1 se vuelve a los sprites de siempre.
let USAR_MODELOS = true;
try { if (/[?&]sprites=1/.test(location.search) || localStorage.getItem('dq3_sprites') === '1') USAR_MODELOS = false; } catch (e) {}
const golpeGeo = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
const golpeMat = new THREE.MeshBasicMaterial({ visible: false });
const sombraGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const vSilla = new THREE.Vector3();
class Figura3D {
  constructor(modelo, escala) {
    this.tipo = 'modelo'; this.modelo = modelo; this.escala = escala || 1;
    this.raiz = new THREE.Group(); this.raiz.add(modelo.obj); this.raiz.scale.setScalar(this.escala);
    this.alto = modelo.alto * this.escala;
    // Cilindro invisible para el clic (mas facil de acertar que las piezas).
    const r = Math.max(0.45, modelo.alto * 0.32);
    this.m = new THREE.Mesh(golpeGeo, golpeMat); this.m.scale.set(r, modelo.alto, r); this.raiz.add(this.m);
    this.sombra = new THREE.Mesh(sombraGeo, sombraTex); this.sombra.scale.setScalar(Math.max(1.2, this.alto * 0.8));
    this.est = 'quieto'; this.tE = 0; this.montura = null; this.mId = '';
    escena.add(this.raiz, this.sombra);
  }
  estado(e, t) { if (e !== this.est) { this.est = e; this.tE = t; } }
  // Montura bajo el jinete (id de MONTURAS o '').
  montar(id) {
    if (id === this.mId) return;
    if (this.montura) { escena.remove(this.montura.obj); this.montura.dispose(); this.montura = null; }
    this.mId = id || '';
    if (id) { try { this.montura = crearMontura(id); escena.add(this.montura.obj); } catch (e) { console.warn(e); this.mId = ''; } }
  }
  poner(x, y, z, ry, t, escala) {
    const ts = t / 1000;
    if (this.montura) {
      const mo = this.montura;
      mo.obj.position.set(x, y, z); mo.obj.rotation.set(0, ry, 0);
      mo.animar(this.andaMontura ? 'corre' : 'quieto', ts, ts);
      mo.obj.updateMatrixWorld(true);
      mo.silla.getWorldPosition(vSilla);
      this.raiz.position.copy(vSilla);
    } else this.raiz.position.set(x, y - (this.est === 'nada' ? 0.45 : 0), z);
    this.raiz.rotation.set(0, ry, 0);
    const k = escala === undefined ? 1 : escala;
    this.raiz.scale.setScalar(this.escala * k);
    this.modelo.animar(this.est, (t - this.tE) / 1000, ts);
    this.sombra.position.set(x, alturaEn(x, z) + 0.05, z);
  }
  quitar() { this.montar(''); escena.remove(this.raiz, this.sombra); this.modelo.dispose(); }
}
function figuraModelo(crear, escala) {
  if (!USAR_MODELOS) return null;
  try { return new Figura3D(crear(), escala); } catch (e) { console.warn('Modelo 3D:', e); return null; }
}
const altoFig = f => f.alto || f.g.parameters.height * 0.85;
// Estado de animacion de un jugador.
function estadoJugador(q, esYo, t, anda) {
  if (esYo ? P.muerto : q.muerto) return 'muere';
  if (t - (q.atkT || 0) < 420) return 'ataca';
  if (esYo ? !!lanzando : (q.lanza || 0) > t) return 'lanza';
  if (t - (q.heridoT || 0) < 250) return 'herido';
  if (esYo ? P.vuela : q.a === 3) return 'vuela';
  if (esYo && !P.suelo && P.vy > -6) return 'salta';
  if (anda && alturaEn(q.x, q.z) < -0.7) return 'nada';
  return anda ? 'corre' : 'quieto';
}

// Cuadros de la hoja del duende (los mismos del 2D).
const ANIM_IDX = { reposo: [1, 2, 3], camina: [4, 5, 6, 7, 8, 9], ataca: [10, 11, 12, 13, 14], herido: [15, 16, 17] };
let ANIM = null;

// Figura de un jugador segun su skin.
async function figuraJugador(skin) {
  const sk = SKINS[skin] || SKINS.comun;
  if (skin === 'comun' || sk.anim) {
    const img = await cargarImg(A + 'skins/duende_anim.png');
    if (!img || !ANIM) return null;
    const fuente = sk.anim ? (imagenes['t:' + skin] = imagenes['t:' + skin] || teñir(img, sk.hue, sk.sat)) : img;
    const [cw, ch] = ANIM.celda;
    const alto = 1.75 / (ANIM.altoDePie || 0.69);
    const f = new Figura(textura(fuente).clone(), alto * cw / ch, alto, Math.round(img.width / cw), 1);
    f.tipo = 'anim';
    return f;
  }
  const img = await cargarImg(A + 'skins/' + sk.img + '.png');
  if (!img) return null;
  const alto = 66 / PX_M;
  const f = new Figura(textura(img).clone(), Math.min(alto * img.width / img.height, 110 / PX_M), alto, 1, 1);
  f.tipo = 'fija';
  return f;
}
async function figuraHoja(k, altoPx) {
  const hoja = HOJAS[k];
  if (!hoja) return null;
  const img = await cargarImg(A + 'enemigos/sheets/' + k + '.png');
  if (!img) return null;
  const e = altoPx / hoja.ideal;
  const f = new Figura(textura(img), hoja.fw * e / PX_M, hoja.fh * e / PX_M, Math.round(img.width / hoja.fw), Math.round(img.height / hoja.fh));
  f.izq = !!hoja.izq; f.hoja = hoja;
  return f;
}

// ── ETIQUETAS (HTML sobre el lienzo: nitidas y baratas) ──
const capa = $('capa');
function etiqueta(clase) { const d = document.createElement('div'); d.className = 'lbl ' + (clase || ''); capa.appendChild(d); return d; }
const vtmp = new THREE.Vector3();
function aPantalla(x, y, z) {
  vtmp.set(x, y, z).project(camara);
  if (vtmp.z > 1 || vtmp.z < -1) return null;
  return [(vtmp.x + 1) / 2 * innerWidth, (1 - vtmp.y) / 2 * innerHeight];
}
function numero(x, y, z, txt, color, grande) {
  const d = document.createElement('div'); d.className = 'num'; d.textContent = txt; d.style.color = color || '#fff';
  if (grande) d.style.fontSize = '22px';
  capa.appendChild(d);
  numeros.push({ d, x, y, z, t: 0 });
}
let numeros = [];

// ── SONIDO ──
let sonido = (() => { try { return localStorage.getItem('dq_mmo_sonido') !== '0'; } catch (e) { return true; } })();
const SFX = {};
function sfx(n, vol) {
  if (!sonido) return;
  try { const a = SFX[n] = SFX[n] || new Audio(A.replace('assets/', '') + 'audio/sfx/' + n + '.mp3'); const c = a.cloneNode(); c.volume = vol || 0.4; c.play().catch(() => {}); } catch (e) {}
}

// ── ESTADO ──
let ws = null, miId = 0, yo = null, conectado = false, reintentos = 0, fatal = false, forzarInvitado = false;
const P = { x: SPAWN3D.x, z: SPAWN3D.z, y: 1.5, vy: 0, suelo: true, ry: 0, anda: false, atkT: 0, heridoT: 0, fig: null, skin: '', lbl: null, muerto: false };
const otros = new Map();     // id -> { x, z, ry, a, hp, mx, n, lv, cl, sk, fig, lbl, tx, tz }
const mons = new Map();      // id -> { k, nv, x, z, ry, hp, mx, st, fig, lbl, tx, tz, muereT }
const npcs = [];
let objetivo = 0, autoAtk = false, sigAtk = 0, avisoLejosT = 0;
let camYaw = Math.PI, camPitch = 0.42, camDist = 11, camReal = 11;
let zonaActual = '';
let portal = null, agua = null;
const teclas = {};

// ── RED ──
function urlWs() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mmo/ws'; }
function mandar(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
let _sb = null;
async function tokenWeb() {
  try {
    if (!window.supabase || !window.SUPABASE_URL) return null;
    _sb = _sb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data } = await _sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  } catch (e) { return null; }
}
function tokInvitado() {
  let inv = null;
  try { inv = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (!/^[a-f0-9]{32}$/.test(inv || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    inv = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('dq_mmo_tok', inv); } catch (e) {}
  }
  return inv;
}
async function autenticacion() {
  let previo = null; try { previo = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  const inv0 = /^[a-f0-9]{32}$/.test(previo || '') ? previo : undefined;
  if (TG && !forzarInvitado) return { auth: { k: 'tg', d: TG.initData }, inv: inv0 };
  const tok = forzarInvitado ? null : await tokenWeb();
  if (tok) return { auth: { k: 'web', tok }, inv: inv0 };
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  return { auth: { k: 'inv', tok: tokInvitado() }, nombre };
}
async function conectar() {
  if (ws && ws.readyState <= 1) return;
  const hola = await autenticacion();
  ws = new WebSocket(urlWs());
  ws.onopen = () => { conectado = true; mandar({ t: 'hola', ...hola, modo: '3d' }); };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } recibir(m); };
  ws.onclose = () => {
    conectado = false;
    if (fatal) return;
    reintentos++;
    if (reintentos > 6) return error('No se pudo conectar con el mundo. Revisa tu conexión.');
    setTimeout(conectar, Math.min(8000, 800 * reintentos));
  };
}
function error(txt) { fatal = true; $('error-txt').textContent = txt; abrir('v-error'); }
setInterval(() => mandar({ t: 'ping', ts: Date.now() }), 20000);

// ── MENSAJES DEL SERVIDOR ──
function recibir(m) {
  switch (m.t) {
    case 'bienvenido':
      miId = m.id; yo = m.yo; reintentos = 0;
      $('carga').style.display = 'none';
      cerrar('v-inicio');
      pintarHud();
      if (!yo.clase) abrirClases();
      if (m.nuevo) aviso('Bienvenido al mundo abierto, ' + yo.nombre + '. El Guardia Tito, en el pueblo, tiene tu primera misión.', 'ok');
      break;
    case 'm3':
      P.x = m.x; P.z = m.z; P.y = alturaEn(P.x, P.z);
      for (const o of [...otros.keys()]) quitarOtro(o);
      for (const p of m.jugadores) agregarOtro(p);
      break;
    case 'yo': {
      const antes = yo; yo = m.yo;
      V.actualizar();
      if (antes && (yo.skin !== antes.skin || yo.clase !== antes.clase || yo.arma !== antes.arma)) cambiarSkinPropia();
      if (yo.muerto && !(antes && antes.muerto)) morir();
      if (!yo.muerto) { cerrar('v-muerte'); P.muerto = false; }
      if (yo.clase) cerrar('v-clase');
      pintarHud();
      if ($('v-npc').classList.contains('on') && npcAbierto) abrirNpc(npcAbierto);
      break;
    }
    case 's3': foto(m); break;
    case 'pj3': agregarOtro(m.p); break;
    case 'pl': quitarOtro(m.id); break;
    case 'pa': { const o = otros.get(m.p); if (o) { const cambia = o.sk !== m.sk || o.cl !== (m.cl || '') || o.ar !== (m.ar || 'katana'); Object.assign(o, { sk: m.sk, cl: m.cl || '', ar: m.ar || 'katana', mo: m.mo || '', gm: m.gm || 0 }); if (cambia) rehacerFiguraOtro(o); } break; }
    case 'mundial3': mundial3 = { ...m, recibido: Date.now() }; break;
    case 'zona3': {
      // Pisoton: el circulo rojo se llena y, al llenarse, golpea.
      const y = alturaEn(m.x, m.z) + 0.18;
      const disco = new THREE.Mesh(new THREE.CircleGeometry(m.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.12, depthWrite: false }));
      const borde = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.35, m.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.9, depthWrite: false }));
      disco.position.set(m.x, y, m.z); borde.position.set(m.x, y + 0.01, m.z);
      escena.add(disco, borde);
      zonas3.set(m.id, { disco, borde, x: m.x, z: m.z, r: m.r, ini: performance.now(), ms: m.ms });
      if (Math.hypot(P.x - m.x, P.z - m.z) < m.r + 3) aviso('¡Pisotón! Sal del círculo rojo.', 'err');
      break;
    }
    case 'zona3f': {
      const z = zonas3.get(m.id);
      if (z) { escena.remove(z.disco, z.borde); z.disco.geometry.dispose(); z.borde.geometry.dispose(); onda(z.x, z.z, z.r, '#ff5a2a'); zonas3.delete(m.id); sacudir = 0.5; sfx('explosion', 0.45); }
      break;
    }
    case 'md3': { const o = mons.get(m.id); if (o) { o.muereT = performance.now(); o.st = 3; sfx('muerte', 0.3); } if (objetivo === m.id) { objetivo = 0; autoAtk = false; pintarBarra(); } break; }
    case 'at3': ataqueVisto(m); break;
    case 'ph': golpeJugador(m); break;
    case 'b3': { const o = mons.get(m.de), q = m.a === miId ? P : otros.get(m.a); if (o && q) proyectil(o, q, '#c084fc'); break; }
    case 'muerte': morir(m); break;
    case 'tp3': case 'snap3': P.x = m.x; P.z = m.z; P.y = alturaEn(P.x, P.z); break;
    case 'gana':
      if (m.xp) numero(P.x, P.y + 2.6, P.z, '+' + m.xp + ' XP', '#c084fc');
      if (m.oro) { numero(P.x + 0.6, P.y + 2.2, P.z, '+' + m.oro + ' oro', '#ffd84a'); sfx('moneda', 0.35); }
      if (m.item) aviso('Botín: ' + (m.item.nombre || 'equipo nuevo') + ' (pulsa I para verlo)', 'ok');
      break;
    case 'lv': if (m.p === miId) { aviso('¡Subiste al nivel ' + m.lv + '!', 'ok'); numero(P.x, P.y + 3, P.z, 'NIVEL ' + m.lv, '#ffe600', true); } else { const o = otros.get(m.p); if (o) o.lv = m.lv; } break;
    case 'toast': aviso(m.m, m.ok ? 'ok' : ''); break;
    case 'aviso': aviso(m.m); break;
    case 'no': aviso(m.m, 'err'); break;
    case 'chat': lineaChat(m); break;
    case 'cd': cdPoder[m.id] = performance.now() + m.hasta; break;
    case 'pedidoSol': case 'factura': V.alPedido(m); break;
    case 'pw': if (m.p === miId) sfx(m.i === 2 ? 'explosion' : 'boton', 0.4); break;
    case 'cast':
      if (m.p === miId) { lanzando = { id: m.id, ini: performance.now(), fin: performance.now() + m.ms }; $('lanzar').style.display = 'block'; $('lanzar-t').textContent = m.id === 'montar' ? 'Invocar montura' : (habPorId(m.id) || {}).nombre || ''; }
      else { const o = otros.get(m.p); if (o) o.lanza = performance.now() + m.ms; }
      break;
    case 'castFin':
      if (m.p === miId) { lanzando = null; $('lanzar').style.display = 'none'; }
      else { const o = otros.get(m.p); if (o) o.lanza = 0; }
      break;
    case 'hb': efectoHab(m); break;
    case 'cu': { const q = m.p === miId ? P : otros.get(m.p); if (q) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.4, q.z, '+' + m.n, '#4ade80', m.c); break; }
    case 'au': {
      const fin = m.ms < 0 ? Infinity : m.ms === 0 ? 0 : performance.now() + m.ms;
      const u = m.k === 'm' ? mons.get(m.id) : m.id === miId ? P : otros.get(m.id);
      if (u) { u.au = u.au || {}; if (fin) u.au[m.a] = fin; else delete u.au[m.a]; }
      break;
    }
    case 'res': if (m.p === miId) { aviso((m.de || 'Alguien') + ' te resucitó.', 'ok'); cerrar('v-muerte'); } break;
    case 'ranking': if (npcAbierto === 'ranking') pintarRanking(m.r); break;
    case 'err':
      if (m.auth && m.auth !== 'inv' && !forzarInvitado) { forzarInvitado = true; aviso('No pudimos verificar tu cuenta: entras como invitado.', 'err'); return; }
      if (m.fatal) { error(m.m || 'Desconectado.'); }
      break;
  }
}

// ── JUGADORES Y MONSTRUOS ──
const claveYo = () => yo.skin + '|' + (yo.clase || '') + '|' + (yo.arma || '');
async function cambiarSkinPropia() {
  if (!yo) return;
  const clave = claveYo();
  if (P.cargando === clave || (P.fig && P.skin === clave)) return;
  P.cargando = clave;
  const f = figuraModelo(() => crearDuende({ skin: yo.skin, clase: yo.clase || null, arma: yo.arma || 'katana' })) || await figuraJugador(yo.skin);
  P.cargando = '';
  if (!f) return;
  if (P.fig) P.fig.quitar();
  P.fig = f; P.skin = clave;
}
async function agregarOtro(p) {
  if (!p || p.id === miId || p.p === miId) return;
  const id = p.id || p.p;
  quitarOtro(id);
  const o = { id, x: p.x, z: p.z, tx: p.x, tz: p.z, ry: p.r || 0, a: 0, hp: p.hp, mx: p.mx, n: p.n, lv: p.lv, cl: p.cl || '', sk: p.sk || 'comun', ar: p.ar || 'katana', mo: p.mo || '', gm: p.gm || 0, muerto: !!p.muerto, fig: null, lbl: etiqueta('pj'), f: 1 };
  otros.set(id, o);
  rehacerFiguraOtro(o);
}
async function rehacerFiguraOtro(o) {
  const f = figuraModelo(() => crearDuende({ skin: o.sk, clase: o.cl || null, arma: o.ar || 'katana' })) || await figuraJugador(o.sk);
  if (!otros.has(o.id)) { if (f) f.quitar(); return; }
  if (o.fig) o.fig.quitar();
  o.fig = f;
}
function quitarOtro(id) { const o = otros.get(id); if (!o) return; if (o.fig) o.fig.quitar(); if (o.alas) escena.remove(o.alas); o.lbl.remove(); otros.delete(id); }
async function agregarMon(d) {
  if (mons.has(d.id)) return;
  const def = MONSTRUOS[d.k];
  if (!def) return;
  const st = statsMonstruo(d.k, d.nv);
  const o = { id: d.id, k: d.k, nv: d.nv, x: d.x, z: d.z, tx: d.x, tz: d.z, ry: 0, hp: d.hp, mx: d.mx, st: 0, j: d.j, fig: null, lbl: etiqueta(d.j ? 'jefe' : ''), nace: performance.now(), muereT: 0, golpeT: 0, f: 1 };
  mons.set(d.id, o);
  o.mu = !!d.mu;
  o.fig = figuraModelo(() => crearMonstruo(d.k), d.mu ? 2.4 : d.j ? 1.15 : 1) || await figuraHoja(def.hoja, st.alto * (d.mu ? 2.4 : d.j ? 1.15 : 1));
  if (!mons.has(d.id) && o.fig) { o.fig.quitar(); o.fig = null; }
}
function quitarMon(id) { const o = mons.get(id); if (!o) return; if (o.fig) o.fig.quitar(); o.lbl.remove(); mons.delete(id); if (objetivo === id) { objetivo = 0; autoAtk = false; pintarBarra(); } }
function foto(m) {
  for (const [id, x, z, ry, a, hp, mx, muerto, h] of m.p) {
    if (id === miId) continue;
    const o = otros.get(id);
    if (!o) continue;
    o.tx = x; o.tz = z; o.ry = ry; o.a = a; o.hp = hp; o.mx = mx; o.muerto = !!muerto; o.h = h || 0;
  }
  if (m.n) for (const d of m.n) agregarMon(d);
  for (const [id, x, z, ry, hp, st] of m.m) {
    const o = mons.get(id);
    if (!o) continue;
    o.tx = x; o.tz = z; o.ry = ry; if (hp < o.hp) o.golpeT = performance.now(); o.hp = hp; o.st = st;
  }
  if (m.q) for (const id of m.q) quitarMon(id);
  if (yo) { yo.hp = m.hp; yo.rec = m.rec; P.rec = m.rec; yo.combo = m.cb || 0; pintarVida(); }
}
function ataqueVisto(m) {
  const o = mons.get(m.tg);
  if (!o) return;
  const de = m.p === miId ? P : otros.get(m.p);
  if (de) { de.atkT = performance.now(); if (m.v) proyectil(de, o, CLASES[(m.p === miId ? yo.clase : de.cl)] ? CLASES[(m.p === miId ? yo.clase : de.cl)].color : '#fff'); }
  if (m.p === miId || o.id === objetivo) {
    numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.2, o.z, (m.c ? '¡' : '') + m.d + (m.c ? '!' : ''), m.c ? '#ffd34d' : m.rayo ? '#7dd3fc' : '#fff', m.c);
    if (m.p === miId) sfx(m.c ? 'corte2' : 'golpe', 0.35);
  }
  o.golpeT = performance.now();
}
function golpeJugador(m) {
  const q = m.p === miId ? P : otros.get(m.p);
  if (!q) return;
  if (m.d > 0) numero(q.x, (q.y || alturaEn(q.x, q.z)) + 2.3, q.z, '-' + m.d, '#ff5a6a');
  if (m.p === miId) { P.heridoT = performance.now(); sfx('golpe', 0.25); }
}
let proyectiles = [], efectos = [], lanzando = null, objetivoP = 0, mundial3 = null, sacudir = 0;
const zonas3 = new Map();
let tocandoSubir = false, tocandoBajar = false;
// Anillo que se expande (habilidades de area, curas en grupo...).
function onda(x, z, radio, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, alturaEn(x, z) + 0.15, z);
  escena.add(m);
  efectos.push({ m, t: 0, dura: 0.5, radio });
}
const AREA = { torbellino: '#ff6633', abanico: '#cbd5e1', nova: '#9be7ff', meteoros: '#ff7a1a', rezo: '#4ade80', grito: '#ff3344' };
const A_DISTANCIA = { bola_fuego: '#ff7a1a', castigo: '#ffe9a8', misiles: '#c084fc', dolor: '#7c3aed', contrahechizo: '#7dd3fc', silencio: '#a78bfa', polimorfia: '#f9a8d4' };
function efectoHab(m) {
  const de = m.p === miId ? P : otros.get(m.p);
  const h = habPorId(m.id);
  if (de) de.atkT = performance.now();
  if (de && AREA[m.id]) onda(de.x, de.z, (h && h.radio ? h.radio / 17 : 6), AREA[m.id]);
  for (const [id, d, tipo] of m.h || []) {
    const o = mons.get(id);
    if (!o) continue;
    if (de && A_DISTANCIA[m.id]) proyectil(de, o, A_DISTANCIA[m.id]);
    if (m.p === miId || id === objetivo) numero(o.x + (Math.random() - 0.5), alturaEn(o.x, o.z) + 2.3, o.z, (tipo === 1 ? '¡' : '') + d + (tipo === 1 ? '!' : ''), tipo === 1 ? '#ffd34d' : '#ffe600', tipo === 1);
    o.golpeT = performance.now();
  }
  if (m.p === miId) { sfx(AREA[m.id] ? 'explosion' : 'corte2', 0.35); if (m.cp) aviso('Eviscerar con ' + m.cp + ' puntos de combo', 'ok'); }
}
const NOMBRE_AURA = { grito: 'Grito', muro: 'Muro', bloque: 'Hielo', escudoPoder: 'Escudo', renovar: 'Renovar', supresion: 'Supresión', evasion: 'Evasión', sigilo: 'Sigilo', aturdido: 'Aturdido', almaDebil: 'Alma débil' };
function pintarAuras() {
  const ahora = performance.now();
  const l = Object.entries(P.au || {}).filter(([a, fin]) => fin > ahora && NOMBRE_AURA[a]);
  const html = l.map(([a, fin]) => `<span>${NOMBRE_AURA[a]}${fin !== Infinity ? ' ' + Math.ceil((fin - ahora) / 1000) + 's' : ''}</span>`).join('');
  if ($('auras')._h !== html) { $('auras').innerHTML = html; $('auras')._h = html; }
  if (mundial3) {
    const def = MONSTRUOS[mundial3.k] || {};
    const desfase = Date.now() - mundial3.recibido;
    const ms = mundial3.vivo ? mundial3.hasta - Date.now() : mundial3.en - Date.now();
    const mmss = ms > 0 ? Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') : '';
    const txt = mundial3.vivo ? `👹 ¡${def.nombre} en el ${ARENA3D.nombre}! ${mmss}` : ms > 0 && ms < 30 * 60000 ? `👹 ${def.nombre}: ${mmss}` : '';
    if ($('mundial')._h !== txt) { $('mundial').textContent = txt; $('mundial')._h = txt; }
    void desfase;
  }
  const cb = yo && yo.clase === 'picaro' ? yo.combo || 0 : 0;
  const ch = '<i></i>'.repeat(cb);
  if ($('combo')._h !== ch) { $('combo').innerHTML = ch; $('combo')._h = ch; }
  if (lanzando) { const k = clamp((ahora - lanzando.ini) / (lanzando.fin - lanzando.ini), 0, 1); $('lanzar').querySelector('i').style.transform = `scaleX(${k})`; if (k >= 1 && ahora > lanzando.fin + 600) { lanzando = null; $('lanzar').style.display = 'none'; } }
  const alas = $('alas');
  const verAlas = P.vuela || P.alas < ALAS_MAX - 0.5;
  alas.style.display = verAlas ? 'block' : 'none';
  if (verAlas) alas.firstElementChild.style.transform = `scaleX(${(P.alas / ALAS_MAX).toFixed(3)})`;
}
function proyectil(de, a, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color }));
  escena.add(mesh);
  proyectiles.push({ mesh, de: { x: de.x, z: de.z, y: (de.y || alturaEn(de.x, de.z)) + 1.2 }, a, t: 0 });
}
function morir(m) {
  P.muerto = true; autoAtk = false;
  $('muerte-txt').textContent = m && m.golpes && m.golpes.length ? 'Te derribó: ' + m.golpes.map(g => g.n).filter((v, i, l) => l.indexOf(v) === i).slice(0, 2).join(', ') + '. Revives en el pueblo.' : 'Revives en el pueblo.';
  abrir('v-muerte');
}
$('b-revivir').onclick = () => { mandar({ t: 'revivir' }); cerrar('v-muerte'); };

// ── HUD ──
function pintarHud() {
  if (!yo) return;
  const cl = CLASES[yo.clase];
  $('m-nombre').textContent = (yo.dios ? 'GM ' : '') + yo.nombre;
  $('m-nivel').textContent = 'Nv ' + yo.nivel + (cl ? ' · ' + cl.nombre : '');
  $('oro').textContent = Number(yo.oro || 0).toLocaleString('es') + ' oro';
  $('m-rec').style.display = cl ? '' : 'none';
  if (cl) $('m-rec').firstElementChild.style.background = RECURSOS[cl.recurso].color;
  $('xp').firstElementChild.style.transform = `scaleX(${clamp(yo.xp / (yo.xpSig || xpParaSubir(yo.nivel)), 0, 1)})`;
  pintarVida(); pintarBarra();
  if (!P.fig || P.skin !== claveYo()) cambiarSkinPropia();
}
function pintarVida() {
  if (!yo) return;
  const hp = $('m-hp'), rc = $('m-rec');
  hp.firstElementChild.style.transform = `scaleX(${clamp(yo.hp / yo.maxHp, 0, 1)})`;
  hp.lastElementChild.textContent = Math.ceil(yo.hp) + ' / ' + yo.maxHp;
  if (yo.recMax) { rc.firstElementChild.style.transform = `scaleX(${clamp((yo.rec || 0) / yo.recMax, 0, 1)})`; rc.lastElementChild.textContent = Math.round(yo.rec || 0) + ' / ' + yo.recMax; }
}
const cdPoder = {}, cdHab = {};
let gcdHasta = 0, misHabs = [];
function pintarBarra() {
  if (!yo) return;
  const b = $('barra');
  const clave = (yo.clase || '') + ':' + yo.nivel;
  if (b.dataset.hecho !== clave) {
    b.dataset.hecho = clave;
    b.innerHTML = '';
    misHabs = yo.clase ? habsDe(yo.clase).slice(0, 8) : [];
    const atk = document.createElement('button'); atk.className = 'acc'; atk.id = 'acc-atk';
    atk.innerHTML = '<span class="t">1</span><img src="' + A + 'armas/katana_comun_item.png" alt=""><span class="cd"></span>';
    atk.title = 'Ataque automático (1 o Z)';
    atk.onclick = () => alternarAtaque();
    b.appendChild(atk);
    misHabs.forEach((h, i) => {
      const d = document.createElement('button'); d.className = 'acc' + (yo.nivel < h.nv ? ' bloq' : ''); d.dataset.hab = h.id;
      d.innerHTML = `<span class="t">${i + 2}</span><img src="${A}items/equipo/${h.icono}.png" alt="">${yo.nivel < h.nv ? '<span class="lv">Nv ' + h.nv + '</span>' : ''}<span class="cd"></span>`;
      d.title = h.nombre + ' (' + (i + 2) + ') — ' + h.desc;
      d.onclick = () => usarHab(h);
      b.appendChild(d);
    });
    PODERES.forEach((p, i) => {
      const d = document.createElement('button'); d.className = 'acc'; d.dataset.pw = p.id;
      d.innerHTML = `<span class="t">${p.tecla}</span><img src="${A}items/${p.icono}.png" alt=""><span class="n"></span><span class="cd"></span>`;
      d.title = p.nombre + ' (' + p.tecla + ') — ' + p.desc;
      d.onclick = () => usarPoder(i);
      b.appendChild(d);
    });
  }
  $('acc-atk').classList.toggle('on', autoAtk);
  b.querySelectorAll('[data-pw]').forEach(d => { d.querySelector('.n').textContent = (yo.pw && yo.pw[d.dataset.pw]) || 0; });
}
function pintarCds() {
  const ahora = performance.now();
  $('barra').querySelectorAll('[data-hab]').forEach(d => {
    const h = habPorId(d.dataset.hab), c = cdHab[h.id];
    let k = c && c.fin > ahora ? (c.fin - ahora) / c.ms : 0;
    if (h.gcd !== false && gcdHasta > ahora) k = Math.max(k, (gcdHasta - ahora) / GCD_MS);
    d.querySelector('.cd').style.transform = `scaleY(${k})`;
    const sin = yo && yo.recMax !== undefined && (P.rec || 0) < costoHab(h, yo.recMax || 100, yo.espec);
    d.style.filter = sin && yo.nivel >= h.nv ? 'grayscale(.8) brightness(.7)' : '';
  });
  $('barra').querySelectorAll('[data-pw]').forEach(d => {
    const p = PODERES.find(x => x.id === d.dataset.pw), fin = cdPoder[p.id] || 0;
    d.querySelector('.cd').style.transform = `scaleY(${fin > ahora ? (fin - ahora) / p.cd : 0})`;
  });
}
function pintarObjetivo() {
  const o = mons.get(objetivo);
  const caja = $('obj');
  if (!o) { caja.style.display = 'none'; anillo.visible = false; return; }
  const def = MONSTRUOS[o.k];
  caja.style.display = 'block';
  $('o-nombre').textContent = (o.j ? '★ ' : '') + def.nombre;
  $('o-nivel').textContent = 'Nv ' + o.nv;
  const hp = $('o-hp');
  hp.firstElementChild.style.transform = `scaleX(${clamp(o.hp / o.mx, 0, 1)})`;
  hp.lastElementChild.textContent = Math.ceil(o.hp) + ' / ' + o.mx;
  anillo.visible = true;
  anillo.position.set(o.x, alturaEn(o.x, o.z) + 0.08, o.z);
  const s = o.j ? 2 : 1; anillo.scale.set(s, s, s);
}
const avisos = $('avisos');
function aviso(txt, tipo) {
  const d = document.createElement('div'); d.textContent = txt; if (tipo) d.className = tipo;
  avisos.appendChild(d);
  while (avisos.children.length > 4) avisos.firstChild.remove();
  setTimeout(() => d.remove(), 4500);
}
function lineaChat(m) {
  const d = document.createElement('div');
  if (m.sis || !m.n) d.textContent = m.m;
  else { const b = document.createElement('b'); b.textContent = (m.gm ? '[GM] ' : '') + m.n + ': '; b.style.color = m.gm ? '#ffd84a' : (CLASES[m.cl] ? CLASES[m.cl].color : '#fff'); d.appendChild(b); d.appendChild(document.createTextNode(m.m)); }
  const log = $('chat-log'); log.appendChild(d);
  while (log.children.length > 8) log.firstChild.remove();
}
function tituloZona(id) {
  const mp = MAPAS[id];
  $('tz-n').textContent = mp ? mp.nombre : 'Pueblo Duende';
  $('tz-s').textContent = mp && mp.nv ? 'Nivel ' + mp.nv[0] + '-' + mp.nv[1] : 'Zona segura';
  $('mini-z').textContent = $('tz-n').textContent;
  const t = $('titulo-zona'); t.style.opacity = 1;
  clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = 0; }, 3200);
}

// ── VENTANAS ──
function abrir(id) { $(id).classList.add('on'); for (const k in teclas) teclas[k] = false; }
function cerrar(id) { $(id).classList.remove('on'); if (id === 'v-npc') npcAbierto = ''; }
document.querySelectorAll('[data-cerrar]').forEach(b => b.onclick = () => cerrar(b.closest('.modal').id));
function abrirClases() {
  const c = $('clases'); c.innerHTML = '';
  for (const [id, cl] of Object.entries(CLASES)) {
    const b = document.createElement('button');
    b.innerHTML = `<span style="color:${cl.color}">${esc(cl.nombre)}</span><small>${esc(cl.rol)}</small>`;
    b.onclick = () => mandar({ t: 'clase', id });
    c.appendChild(b);
  }
  abrir('v-clase');
}
let npcAbierto = '';
function abrirNpc(tipo) {
  npcAbierto = tipo;
  const n = NPCS3D.find(x => x.tipo === tipo);
  $('npc-t').textContent = n.nombre.toUpperCase();
  const cu = $('npc-c');
  if (tipo === 'guia') {
    const q = MISIONES[yo.mis.i];
    let h = q ? `<p><b style="color:#fff">${esc(q.nombre)}</b><br>Caza ${q.n} × ${esc(MONSTRUOS[q.tipo].nombre)} (${Math.min(yo.mis.p, q.n)}/${q.n}). Recompensa: ${q.xp} XP y ${q.oro} oro.</p><button class="btn" id="n-mision" ${yo.mis.p >= q.n ? '' : 'disabled'} style="width:100%">Entregar misión</button>` : '<p>Completaste todas las misiones. ¡Eres una leyenda del pueblo!</p>';
    const d = yo.diaria || { p: 0 };
    h += `<p style="margin-top:14px"><b style="color:#fff">${esc(DIARIA.nombre)}</b><br>Caza ${DIARIA.n} monstruos de tu nivel (${Math.min(d.p || 0, DIARIA.n)}/${DIARIA.n}).</p><button class="btn sec" id="n-diaria" ${d.ok || (d.p || 0) < DIARIA.n ? 'disabled' : ''} style="width:100%">${d.ok ? 'Ya cobrada hoy' : 'Cobrar la caza del día'}</button>`;
    cu.innerHTML = h;
    const b = $('n-mision'); if (b) b.onclick = () => { mandar({ t: 'mision' }); sfx('moneda', 0.4); };
    $('n-diaria').onclick = () => mandar({ t: 'mision', diaria: true });
  } else if (tipo === 'tienda') {
    cu.innerHTML = '<button class="btn" id="n-tienda" style="width:100%;margin-bottom:8px">Ver toda la tienda: armas, forja, skins, monturas…</button><p>Consumibles para el camino:</p>' + PODERES.map(p => `<div class="fila"><span><img src="${A}items/${p.icono}.png" style="width:22px;vertical-align:middle;image-rendering:pixelated"> ${esc(p.nombre)} <small style="color:var(--txt3)">(${(yo.pw && yo.pw[p.id]) || 0})</small></span><span><b style="color:var(--oro)">${p.precio}</b> <button class="btn" data-c="${p.id}" data-n="1">×1</button> <button class="btn sec" data-c="${p.id}" data-n="5">×5</button></span></div>`).join('');
    cu.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { mandar({ t: 'comprar', k: 'pw', id: b.dataset.c, n: +b.dataset.n }); sfx('moneda', 0.3); });
    $('n-tienda').onclick = () => { cerrar('v-npc'); V.abrirTienda('arma'); };
  } else if (tipo === 'ranking') {
    cu.innerHTML = '<p>Cargando el ranking…</p>';
    mandar({ t: 'ranking' });
  } else {
    cu.innerHTML = '<p>La artesanía (recolectar, fabricar pociones y elixires) está por ahora en el juego 2D, con tu mismo personaje.</p><a class="btn" href="/mmo/" style="display:block;text-align:center;text-decoration:none">Abrir el juego 2D</a>';
  }
  abrir('v-npc');
}
function pintarRanking(r) {
  $('npc-c').innerHTML = (r || []).slice(0, 15).map((x, i) => `<div class="fila"><span>${i + 1}. ${esc(x.n)}</span><b style="color:${x.yo ? 'var(--ok)' : 'var(--txt)'}">Nv ${x.lv}</b></div>`).join('') || '<p>Aún no hay nadie.</p>';
}
// Inventario, libro de clase, tienda completa y logros (mundo/js/ventanas.js).
const V = iniciarVentanas({ mandar, yo: () => yo, aviso, sfx, abrir, cerrar, telegram: () => !!TG && !forzarInvitado });
$('b-inv').onclick = () => V.abrirInventario();
$('b-libro').onclick = () => V.abrirLibro();
$('b-logros').onclick = () => V.abrirLogros();
$('b-premium').onclick = () => V.abrirTienda('premium');
$('b-mapa').onclick = () => abrirMapa();
$('b-ayuda').onclick = () => abrir('v-ayuda');
$('b-chat').onclick = () => { const i = $('chat-in'); i.style.display = 'block'; i.focus(); };
$('b-reconectar').onclick = () => location.reload();

// ── MAPA (minimapa y mapa del mundo, pintados una vez) ──
let mapaBase = null;
function pintarMapaBase() {
  const N = 220, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), col = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const wx = (i / N - 0.5) * LADO, wz = (j / N - 0.5) * LADO, h = alturaEn(wx, wz);
    if (h < MUNDO.agua) col.set('#2f74b5'); else colorSuelo(wx, wz, h, col);
    const k = (j * N + i) * 4;
    img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  mapaBase = c;
}
function aMapa(wx, wz, N) { return [(wx / LADO + 0.5) * N, (wz / LADO + 0.5) * N]; }
function pintarMini() {
  if (!mapaBase) return;
  const cv = $('mini-c'), x = cv.getContext('2d'), S = 150, vista = 240;
  const N = mapaBase.width, [mx, mz] = aMapa(P.x, P.z, N), lado = vista / LADO * N;
  x.clearRect(0, 0, S, S);
  x.drawImage(mapaBase, mx - lado / 2, mz - lado / 2, lado, lado, 0, 0, S, S);
  const k = S / vista;
  const punto = (wx, wz, color, r) => { const px = (wx - P.x) * k + S / 2, pz = (wz - P.z) * k + S / 2; if (px < 0 || pz < 0 || px > S || pz > S) return; x.fillStyle = color; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill(); };
  for (const o of mons.values()) if (!o.muereT) punto(o.x, o.z, o.j ? '#ffd84a' : '#ff4455', o.j ? 3.5 : 2);
  for (const o of otros.values()) punto(o.x, o.z, '#4ade80', 2.5);
  for (const n of NPCS3D) punto(n.x, n.z, '#7dd3fc', 2);
  if (mundial3 && mundial3.vivo) punto(ARENA3D.x, ARENA3D.z, '#ff6b3d', 5);
  // Flecha propia (hacia donde mira la camara).
  x.save(); x.translate(S / 2, S / 2); x.rotate(-camYaw + Math.PI);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(-5, 5); x.closePath(); x.fill(); x.restore();
}
function abrirMapa() {
  const cv = $('mapa-c'), x = cv.getContext('2d'), S = cv.width;
  x.imageSmoothingEnabled = true;
  x.drawImage(mapaBase, 0, 0, S, S);
  x.font = '600 12px system-ui'; x.textAlign = 'center';
  for (const [id, c] of Object.entries(ZONAS3D)) {
    const [px, pz] = aMapa(c.x, c.z, S), mp = MAPAS[id];
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px - 62, pz - 14, 124, 30);
    x.fillStyle = '#fff'; x.fillText(mp.nombre, px, pz);
    x.fillStyle = '#ffd84a'; x.fillText('Nv ' + mp.nv[0] + '-' + mp.nv[1], px, pz + 13);
  }
  for (const cp of campamentos(MAPAS, MONSTRUOS)) if (cp.jefe) { const [px, pz] = aMapa(cp.x, cp.z, S); x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(px, pz, 5, 0, 7); x.fill(); }
  const [ux, uz] = aMapa(0, 0, S); x.fillStyle = '#fff'; x.fillText('Pueblo Duende', ux, uz - 8);
  { const [ax, az] = aMapa(ARENA3D.x, ARENA3D.z, S); x.fillStyle = mundial3 && mundial3.vivo ? '#ff6b3d' : '#c4a484'; x.beginPath(); x.arc(ax, az, 7, 0, 7); x.fill(); x.fillText(ARENA3D.nombre, ax, az - 11); }
  const [yx, yz] = aMapa(P.x, P.z, S); x.fillStyle = '#4ade80'; x.beginPath(); x.arc(yx, yz, 6, 0, 7); x.fill(); x.strokeStyle = '#000'; x.stroke();
  abrir('v-mapa');
}

// ── ENTRADA ──
function chatAbierto() { return document.activeElement === $('chat-in'); }
function hayVentana() { return !!document.querySelector('.modal.on'); }
addEventListener('keydown', e => {
  if (chatAbierto()) {
    if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) mandar({ t: 'chat', m: v, canal: 'general' }); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
    return;
  }
  if (hayVentana()) {
    if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(m => { if (!['v-clase', 'v-muerte', 'v-inicio', 'v-error'].includes(m.id)) cerrar(m.id); });
    if (e.code === 'KeyM' && $('v-mapa').classList.contains('on')) cerrar('v-mapa');
    for (const [k, id] of [['KeyI', 'v-inv'], ['KeyP', 'v-libro'], ['KeyL', 'v-logros']]) if (e.code === k && $(id) && $(id).classList.contains('on')) cerrar(id);
    return;
  }
  teclas[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); saltar(); }
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) cicloObjetivo(); }
  if ((e.code === 'Digit1' || e.code === 'KeyZ') && !e.repeat) alternarAtaque();
  const nh = /^Digit([2-9])$/.exec(e.code);
  if (nh && !e.repeat) usarHab(misHabs[+nh[1] - 2]);
  if (e.code === 'KeyY' && !e.repeat) montar();
  if (e.code === 'KeyV' && !e.repeat) volar();
  const i = { KeyQ: 0, KeyF: 1, KeyG: 2, KeyT: 3 }[e.code];
  if (i !== undefined && !e.repeat) usarPoder(i);
  if (e.code === 'KeyE' && !e.repeat) hablar();
  if (e.code === 'KeyM' && !e.repeat) abrirMapa();
  if (e.code === 'KeyI' && !e.repeat) V.abrirInventario();
  if (e.code === 'KeyP' && !e.repeat) V.abrirLibro();
  if (e.code === 'KeyL' && !e.repeat) V.abrirLogros();
  if (e.code === 'Enter') { e.preventDefault(); $('chat-in').style.display = 'block'; $('chat-in').focus(); }
  if (e.code === 'Escape') { objetivo = 0; autoAtk = false; pintarBarra(); }
});
addEventListener('keyup', e => { teclas[e.code] = false; });
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; });
$('chat-in').addEventListener('keydown', e => e.stopPropagation(), true);
$('chat-in').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) mandar({ t: 'chat', m: v, canal: 'general' }); $('chat-in').value = ''; $('chat-in').blur(); $('chat-in').style.display = 'none'; }
  if (e.key === 'Escape') { $('chat-in').blur(); $('chat-in').style.display = 'none'; }
});

// Raton: arrastrar gira la camara; un clic (sin arrastre) elige objetivo.
let arrastre = null;
lienzo.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  arrastre = { x: e.clientX, y: e.clientY, mov: 0 };
  lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener('pointermove', e => {
  if (!arrastre || e.pointerType === 'touch') return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.mov += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * 0.006; camPitch = clamp(camPitch + dy * 0.004, 0.08, 1.25);
});
lienzo.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  if (arrastre && arrastre.mov < 6) elegirEn(e.clientX, e.clientY, e.detail >= 2);
  arrastre = null;
});
lienzo.addEventListener('contextmenu', e => e.preventDefault());
lienzo.addEventListener('wheel', e => { camDist = clamp(camDist + Math.sign(e.deltaY) * 1.2, 4, 26); e.preventDefault(); }, { passive: false });
const ray = new THREE.Raycaster(), vec2 = new THREE.Vector2();
function elegirEn(cx, cy, doble) {
  vec2.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(vec2, camara);
  const lista = [...mons.values()].filter(o => o.fig && !o.muereT);
  const hits = ray.intersectObjects(lista.map(o => o.fig.m), false);
  if (hits.length) {
    const o = lista.find(x => x.fig.m === hits[0].object);
    if (o) {
      if (objetivo === o.id || doble) { autoAtk = true; }
      objetivo = o.id; pintarBarra(); sfx('boton', 0.2);
      return;
    }
  }
  // Clic cerca de un PNJ: hablar.
  for (const n of npcs) { const s = aPantalla(n.x, n.y + 1.2, n.z); if (s && Math.hypot(s[0] - cx, s[1] - cy) < 40 && Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST + 2) { abrirNpc(n.tipo); return; } }
}
function cicloObjetivo() {
  const l = [...mons.values()].filter(o => !o.muereT && Math.hypot(o.x - P.x, o.z - P.z) < 45).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  if (!l.length) { objetivo = 0; return; }
  const i = l.findIndex(o => o.id === objetivo);
  objetivo = l[(i + 1) % l.length].id;
  sfx('boton', 0.2);
}
function alternarAtaque() {
  if (!objetivo) cicloObjetivo();
  autoAtk = !!objetivo && !autoAtk;
  pintarBarra();
}
function usarPoder(i) { if (!yo || P.muerto) return; mandar({ t: 'pw', i }); }
function usarHab(h) {
  if (!yo || P.muerto || !h) return;
  if (yo.nivel < h.nv) return aviso(`Aprendes ${h.nombre} a nivel ${h.nv}.`, 'err');
  const ahora = performance.now();
  if (h.gcd !== false && ahora < gcdHasta) return;
  if (cdHab[h.id] && cdHab[h.id].fin > ahora) return aviso(h.nombre + ' todavía no está lista.', 'err');
  // Enemigo: el objetivo elegido (o el servidor busca el mas cercano).
  // Aliado: el jugador elegido o uno mismo.
  if (h.obj === 'enemigo' && !objetivo) cicloObjetivo();
  mandar({ t: 'hab3', id: h.id, tg: h.obj === 'enemigo' ? objetivo : 0, tp: h.obj === 'aliado' || h.obj === 'muerto' ? objetivoP : 0 });
  if (h.gcd !== false) gcdHasta = ahora + GCD_MS;
  if (h.obj === 'enemigo' && objetivo && !autoAtk && h.id !== 'polimorfia') { autoAtk = true; pintarBarra(); }
}
function montar() { if (!yo || P.muerto) return; if (P.vuela) return aviso('Aterriza antes de montar.', 'err'); mandar({ t: 'montar' }); }
// ── VUELO (como las alas de AION) ──
// Fuera del pueblo, V (o doble salto en el aire) despliega las alas: Espacio
// sube, C baja. Las alas tienen 60 s de energia que se recarga en el suelo.
const ALAS_MAX = 60;
P.alas = ALAS_MAX; P.vuela = false;
function volar(on) {
  if (on === undefined) on = !P.vuela;
  if (on) {
    if (P.muerto || !yo) return;
    if (yo.montado) return aviso('Bájate de la montura para volar.', 'err');
    if (zonaEn(P.x, P.z) === 'pueblo') return aviso('En el pueblo no se puede volar.', 'err');
    if (P.alas < 3) return aviso('Tus alas necesitan descansar.', 'err');
    P.vuela = true; P.vy = 0; if (P.suelo) P.y += 1.5; P.suelo = false;
    sfx('salto', 0.3);
  } else P.vuela = false;
  if (MOVIL) $('t-bajar').style.visibility = P.vuela ? 'visible' : 'hidden';
}
function saltar() {
  if (P.muerto) return;
  if (P.suelo) { P.vy = 8; P.suelo = false; sfx('salto', 0.25); return; }
  // Segundo salto en el aire: se despliegan las alas.
  if (!P.vuela) volar(true);
}
function npcCercano() { return npcs.find(n => Math.hypot(P.x - n.x, P.z - n.z) < NPC_DIST) || (portal && Math.hypot(P.x - portal.x, P.z - portal.z) < 5 ? { tipo: 'portal', nombre: 'Mazmorras' } : null); }
function hablar() {
  const n = npcCercano();
  if (!n) return;
  if (n.tipo === 'portal') { aviso('Las mazmorras, la Torre y la banda se juegan por ahora en el juego 2D con tu mismo personaje.', 'ok'); setTimeout(() => { location.href = '/mmo/'; }, 1500); return; }
  abrirNpc(n.tipo);
}
$('hablar').onclick = hablar;

// Tactil: joystick a la izquierda, arrastrar a la derecha gira la camara.
const joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
const camTouch = { id: null, x: 0, y: 0, mov: 0 };
if (MOVIL) {
  const base = $('joy').querySelector('.base'), pomo = base.firstElementChild;
  $('joy').addEventListener('touchstart', e => {
    const t = e.changedTouches[0]; joy.id = t.identifier; joy.x = t.clientX; joy.y = t.clientY; joy.dx = joy.dy = 0;
    base.style.display = 'block'; base.style.left = (t.clientX - 60) + 'px'; base.style.top = (t.clientY - 60) + 'px';
    e.preventDefault();
  }, { passive: false });
  $('joy').addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      let dx = t.clientX - joy.x, dy = t.clientY - joy.y; const d = Math.hypot(dx, dy);
      if (d > 50) { dx = dx / d * 50; dy = dy / d * 50; }
      joy.dx = dx / 50; joy.dy = dy / 50;
      pomo.style.left = (33 + dx) + 'px'; pomo.style.top = (33 + dy) + 'px';
    }
    e.preventDefault();
  }, { passive: false });
  const finJoy = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.dx = joy.dy = 0; base.style.display = 'none'; pomo.style.left = pomo.style.top = '33px'; } };
  $('joy').addEventListener('touchend', finJoy); $('joy').addEventListener('touchcancel', finJoy);
  lienzo.addEventListener('touchstart', e => { const t = e.changedTouches[0]; camTouch.id = t.identifier; camTouch.x = t.clientX; camTouch.y = t.clientY; camTouch.mov = 0; }, { passive: true });
  lienzo.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === camTouch.id) {
      const dx = t.clientX - camTouch.x, dy = t.clientY - camTouch.y; camTouch.x = t.clientX; camTouch.y = t.clientY; camTouch.mov += Math.abs(dx) + Math.abs(dy);
      camYaw -= dx * 0.008; camPitch = clamp(camPitch + dy * 0.005, 0.08, 1.25);
    }
  }, { passive: true });
  lienzo.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === camTouch.id) { if (camTouch.mov < 10) elegirEn(t.clientX, t.clientY, false); camTouch.id = null; } }, { passive: true });
  $('t-atk').addEventListener('touchstart', e => { e.preventDefault(); alternarAtaque(); }, { passive: false });
  $('t-salto').addEventListener('touchstart', e => { e.preventDefault(); if (P.vuela) tocandoSubir = true; else saltar(); }, { passive: false });
  $('t-salto').addEventListener('touchend', () => { tocandoSubir = false; });
  $('t-bajar').addEventListener('touchstart', e => { e.preventDefault(); tocandoBajar = true; }, { passive: false });
  $('t-bajar').addEventListener('touchend', () => { tocandoBajar = false; });
  $('t-volar').addEventListener('touchstart', e => { e.preventDefault(); volar(); }, { passive: false });
  $('t-montar').addEventListener('touchstart', e => { e.preventDefault(); montar(); }, { passive: false });
  $('t-obj').addEventListener('touchstart', e => { e.preventDefault(); cicloObjetivo(); }, { passive: false });
}

// ── BUCLE ──
let ultimoT = performance.now(), enviadoT = 0, ultimoEnv = '', cuadro = 0;
const fwd = new THREE.Vector3(), der = new THREE.Vector3();
function fisica(dt) {
  if (!yo || P.muerto || hayVentana() || chatAbierto()) { P.anda = false; return; }
  let f = 0, s = 0;
  if (teclas.KeyW || teclas.ArrowUp) f += 1;
  if (teclas.KeyS || teclas.ArrowDown) f -= 1;
  if (teclas.KeyD || teclas.ArrowRight) s += 1;
  if (teclas.KeyA || teclas.ArrowLeft) s -= 1;
  if (joy.id !== null) { f = -joy.dy; s = joy.dx; }
  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)); der.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let mx = fwd.x * f + der.x * s, mz = fwd.z * f + der.z * s;
  // Con el ataque automatico puesto y sin mover el duende, va solo hasta su
  // objetivo (como hacer clic para atacar en WoW): comodo en el movil.
  if (!f && !s && autoAtk) {
    const o = mons.get(objetivo);
    if (o && !o.muereT) {
      const dx = o.x - P.x, dz = o.z - P.z, d = Math.hypot(dx, dz);
      if (d > rangoAtaque(o) * 0.85 && d < 45) { mx = dx / d; mz = dz / d; }
    }
  }
  const mag = Math.hypot(mx, mz);
  P.anda = mag > 0.15;
  if (P.anda) {
    mx /= Math.max(1, mag); mz /= Math.max(1, mag);
    const nadando = !P.vuela && alturaEn(P.x, P.z) < -0.7;
    const vel = MUNDO.velocidad * (nadando ? 0.55 : 1) * (P.vuela ? 1.25 : velMontura(yo.montado)) * (yo.dios && yo.diosModo && yo.diosModo.vel ? 3 : 1);
    const nx = clamp(P.x + mx * vel * dt, -MUNDO.limite, MUNDO.limite), nz = clamp(P.z + mz * vel * dt, -MUNDO.limite, MUNDO.limite);
    // Las laderas muy empinadas (la cordillera del borde) no se suben.
    const sube = alturaEn(nx, nz) - alturaEn(P.x, P.z);
    if (P.vuela || sube / (vel * dt + 1e-3) < 1.4) { P.x = nx; P.z = nz; }
    P.ry = Math.atan2(mx, mz);
    if (mx * der.x + mz * der.z > 0.05) P.f = 1; else if (mx * der.x + mz * der.z < -0.05) P.f = -1;
  }
  // Gravedad y suelo (en el agua se nada en la superficie).
  const suelo = Math.max(alturaEn(P.x, P.z), MUNDO.agua - 0.9);
  if (P.vuela) {
    // Volando: Espacio sube, C (o Mayus) baja; las alas se cansan.
    const arriba = teclas.Space || tocandoSubir, abajo = teclas.KeyC || teclas.ShiftLeft || tocandoBajar;
    P.vy = arriba ? 6 : abajo ? -7 : Math.sin(performance.now() / 500) * 0.3;
    P.y = Math.min(P.y + P.vy * dt, suelo + 45);
    P.alas = Math.max(0, P.alas - dt);
    if (P.alas <= 0) { volar(false); aviso('Tus alas se cansaron: planeas hacia el suelo.'); }
    if (P.y <= suelo + 0.05) { P.y = suelo; volar(false); P.suelo = true; }
  } else {
    // Sin alas se cae, pero planeando si aun queda energia (caida suave).
    P.vy -= (P.alas > 0 && P.vy < -6 ? 6 : 22) * dt; P.y += P.vy * dt;
    if (P.y <= suelo) { P.y = suelo; P.vy = 0; P.suelo = true; }
    if (P.suelo) P.alas = Math.min(ALAS_MAX, P.alas + dt * 3);
  }
  if (P.vuela && zonaEn(P.x, P.z) === 'pueblo') { volar(false); aviso('En el pueblo no se puede volar: bajas.'); }
  // Enviar la posicion (hasta ~10 por segundo).
  const ahora = performance.now();
  const alt = Math.max(0, P.y - suelo);
  const clave = P.x.toFixed(1) + ',' + P.z.toFixed(1) + ',' + (P.anda ? 1 : 0) + ',' + alt.toFixed(0);
  if (ahora - enviadoT > 100 && clave !== ultimoEnv) { mandar({ t: 'mv3', x: +P.x.toFixed(2), z: +P.z.toFixed(2), r: +P.ry.toFixed(2), a: P.vuela ? 3 : P.anda ? 1 : 0, h: +alt.toFixed(1) }); enviadoT = ahora; ultimoEnv = clave; }
}
function rangoAtaque(o) {
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  return vara ? 23 : 3.0 * (arma.alcance || 1) + (o.j ? 1.2 : 0.3);
}
function ataqueAuto() {
  if (!autoAtk || !yo || P.muerto) return;
  const o = mons.get(objetivo);
  if (!o || o.muereT) { autoAtk = false; pintarBarra(); return; }
  const arma = ARMAS[yo.arma] || ARMAS.katana;
  const vara = CLASES[yo.clase] && CLASES[yo.clase].basico === 'vara';
  const rango = rangoAtaque(o);
  const d = Math.hypot(o.x - P.x, o.z - P.z);
  const ahora = performance.now();
  if (d > rango) { if (d > 45 && ahora - avisoLejosT > 2500) { avisoLejosT = ahora; aviso('Tu objetivo está demasiado lejos.'); } return; }
  if (ahora < sigAtk) return;
  sigAtk = ahora + (vara ? VARA.cdMs * arma.cd : 1000 * arma.cd);
  mandar({ t: 'atk3', tg: o.id });
  P.atkT = ahora;
  // Mirar al objetivo.
  const dx = o.x - P.x, dz = o.z - P.z; P.ry = Math.atan2(dx, dz);
  P.f = dx * der.x + dz * der.z >= 0 ? 1 : -1;
  sfx(vara ? 'boton' : 'corte', 0.3);
}
function animarJugador(q, esYo, t) {
  const f = q.fig;
  if (!f) return;
  if (!esYo) q.y = Math.max(alturaEn(q.x, q.z), MUNDO.agua - 0.9) + (q.vh = lerp(q.vh || 0, q.h || 0, 0.15));
  const y = esYo ? P.y : q.y;
  const anda = esYo ? P.anda : q.a === 1;
  if (!esYo) { const dx = q.tx - q.x, dz = q.tz - q.z; if (Math.abs(dx * der.x + dz * der.z) > 0.02) q.f = (dx * der.x + dz * der.z) > 0 ? 1 : -1; }
  const mira = (esYo ? P.f : q.f) !== -1;
  if (f.tipo === 'modelo') {
    const mo = esYo ? (yo && yo.montado) || '' : q.mo || '';
    f.montar(P.vuela && esYo ? '' : mo);
    f.andaMontura = anda;
    const e = estadoJugador(q, esYo, t, anda);
    f.estado(f.montura && e !== 'ataca' && e !== 'lanza' && e !== 'muere' ? 'monta' : e, t);
    if ((q.heridoT || 0) !== f.heridoVisto) { f.heridoVisto = q.heridoT || 0; if (t - f.heridoVisto < 300) f.modelo.golpe(); }
    f.poner(q.x, y, q.z, esYo ? P.ry : q.ry, t);
    if (!esYo) {
      const vuela = q.a === 3;
      if (vuela && !q.alas) q.alas = nuevasAlas();
      if (q.alas) { q.alas.visible = vuela; if (vuela) ponerAlas(q.alas, q.x, y, q.z, q.ry, t); }
    }
    return;
  }
  if (f.tipo === 'anim') {
    let lista = ANIM_IDX.reposo, vel = 0.23;
    const atk = t - (q.atkT || 0) < 350, herido = t - (q.heridoT || 0) < 250;
    if (atk) lista = ANIM_IDX.ataca; else if (herido) lista = ANIM_IDX.herido; else if (anda || (esYo && !P.suelo)) { lista = ANIM_IDX.camina; vel = 0.09; }
    const idx = atk ? lista[Math.min(lista.length - 1, Math.floor((t - q.atkT) / 350 * lista.length))] : lista[Math.floor(t / 1000 / vel) % lista.length];
    f.cuadro(idx, 0, mira);
    f.poner(q.x, y, q.z, camYaw);
  } else {
    f.cuadro(0, 0, mira);
    const rebote = anda ? Math.abs(Math.sin(t / 90)) * 0.12 : Math.sin(t / 400) * 0.03;
    f.poner(q.x, y + rebote, q.z, camYaw, [1, 1 + (t - (q.atkT || 0) < 200 ? -0.08 : 0)]);
  }
  f.m.material.opacity = (esYo ? P.muerto : q.muerto) ? 0.35 : 1;
}
function animarMon(o, t) {
  const f = o.fig;
  if (!f) return;
  if (f.tipo === 'modelo') {
    const mueve = o.st === 1 || Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05;
    let e = o.muereT ? 'muere' : o.st === 2 ? 'ataca' : t - o.golpeT < 220 ? 'herido' : mueve ? (o.st === 1 ? 'corre' : 'anda') : 'quieto';
    if (MONSTRUOS[o.k].vuela && !o.muereT && e !== 'ataca') e = 'vuela';
    f.estado(e, t);
    if (e === 'ataca' && t - f.tE > (o.j ? 1250 : 1600)) f.tE = t;   // un golpe por ataque del servidor
    if (o.golpeT !== f.golpeVisto) { f.golpeVisto = o.golpeT; if (t - o.golpeT < 300) f.modelo.golpe(); }
    const def = MONSTRUOS[o.k];
    const y = Math.max(alturaEn(o.x, o.z), def.vuela ? alturaEn(o.x, o.z) + 1.2 : MUNDO.agua - 0.9);
    o.ryV = lerpAng(o.ryV === undefined ? o.ry : o.ryV, o.ry, 0.2);
    f.poner(o.x, y, o.z, o.ryV, t, Math.min(1, (t - o.nace) / 400));
    return;
  }
  const h = f.hoja;
  const dx = o.tx - o.x, dz = o.tz - o.z;
  const sx = Math.sin(o.ry), sz = Math.cos(o.ry);
  const lado = sx * der.x + sz * der.z;
  if (Math.abs(lado) > 0.05) o.f = lado > 0 ? 1 : -1;
  let fila = h.mov[0], col = h.mov[1];
  if (o.muereT) {
    const k = Math.min(1, (t - o.muereT) / 1400);
    fila = h.golpe[0]; col = h.muerte[0] + Math.min(h.muerte[1] - 1, Math.floor(k * h.muerte[1]));
  } else if (t - o.golpeT < 260 || o.st === 2) {
    fila = h.golpe[0]; col = h.golpe[1] + Math.floor(t / 160) % h.golpe[2];
  } else if (o.st === 1 || Math.hypot(dx, dz) > 0.05) {
    col = h.mov[1] + Math.floor(t / 110) % h.mov[2];
  } else col = h.mov[1] + Math.floor(t / 420) % Math.min(2, h.mov[2]);
  f.cuadro(col, fila, o.f !== -1);
  const def = MONSTRUOS[o.k];
  const y = Math.max(alturaEn(o.x, o.z), def.vuela ? alturaEn(o.x, o.z) + 1.2 + Math.sin(t / 300 + o.id) * 0.3 : MUNDO.agua - 0.9);
  const nace = Math.min(1, (t - o.nace) / 400);
  f.poner(o.x, y, o.z, camYaw, [nace, nace]);
}
function etiquetas(t) {
  const ponLbl = (lbl, x, y, z, html, maxD, extra) => {
    const d = Math.hypot(x - P.x, z - P.z);
    const s = d < maxD ? aPantalla(x, y, z) : null;
    if (!s) { if (lbl.style.display !== 'none') lbl.style.display = 'none'; return; }
    if (lbl.style.display === 'none') lbl.style.display = '';
    if (lbl._h !== html) { lbl.innerHTML = html; lbl._h = html; }
    lbl.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-100%)`;
    if (extra) extra(lbl);
  };
  if (yo && P.lbl) ponLbl(P.lbl, P.x, P.y + 2.15 + (P.fig && P.fig.montura ? 1.2 : 0), P.z, `<span style="color:${yo.dios ? '#ffd84a' : '#ffe600'}">${yo.dios ? 'GM ' : ''}${esc(yo.nombre)}</span>`, 999);
  for (const o of otros.values()) {
    const cl = CLASES[o.cl];
    ponLbl(o.lbl, o.x, (o.y || alturaEn(o.x, o.z)) + 2.15 + (o.fig && o.fig.montura ? 1.2 : 0), o.z, `<span style="color:${o.gm ? '#ffd84a' : cl ? cl.color : '#fff'}">${o.gm ? 'GM ' : ''}${esc(o.n)} · Nv${o.lv}</span><span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>`, 70);
  }
  for (const o of mons.values()) {
    const def = MONSTRUOS[o.k], el = o.id === objetivo;
    const alto = o.fig ? altoFig(o.fig) : 2;
    const herido = o.hp < o.mx || el;
    ponLbl(o.lbl, o.x, alturaEn(o.x, o.z) + alto + 0.2, o.z, `<span style="color:${o.j ? '#ff6bf0' : colorNivel(o.nv)}">${o.j ? '★ ' : ''}${herido || o.j ? esc(def.nombre) + ' ' : ''}Nv${o.nv}</span>${herido ? `<span class="b"><i style="transform:scaleX(${clamp(o.hp / o.mx, 0, 1).toFixed(2)})"></i></span>` : ''}`, el ? 90 : (o.j ? 70 : 38));
  }
  for (const n of npcs) ponLbl(n.lbl, n.x, n.y + 2.4, n.z, `${n.tipo === 'guia' && misionLista() ? '<b style="color:#ffd84a;font-size:18px">!</b><br>' : ''}<span style="color:#4ade80">${esc(n.nombre)}</span>`, 60);
}
function misionLista() { if (!yo) return false; const q = MISIONES[yo.mis.i]; const d = yo.diaria || {}; return (q && yo.mis.p >= q.n) || (!d.ok && (d.p || 0) >= DIARIA.n); }
function colorNivel(nv) { const d = nv - (yo ? yo.nivel : 1); return d >= 5 ? '#ff3344' : d >= 2 ? '#ff9900' : d <= -8 ? '#9a9a9a' : d <= -3 ? '#4ade80' : '#ffe600'; }
const cieloAct = C(CIELO.pueblo), cieloObj = C(CIELO.pueblo);
function bucle(t) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (t - ultimoT) / 1000); ultimoT = t;
  cuadro++;
  fisica(dt);
  ataqueAuto();
  // Interpolacion de los demas.
  const k = Math.min(1, dt * 10);
  for (const o of otros.values()) { o.x = lerp(o.x, o.tx, k); o.z = lerp(o.z, o.tz, k); animarJugador(o, false, t); }
  for (const o of [...mons.values()]) {
    o.x = lerp(o.x, o.tx, k); o.z = lerp(o.z, o.tz, k);
    if (o.muereT && t - o.muereT > 1600) { quitarMon(o.id); continue; }
    animarMon(o, t);
  }
  if (P.fig) animarJugador(P, true, t);
  for (const n of npcs) if (n.fig && n.fig.tipo === 'modelo') {
    const cerca = Math.hypot(P.x - n.x, P.z - n.z) < 12;
    n.ry = lerpAng(n.ry || 0, cerca ? Math.atan2(P.x - n.x, P.z - n.z) : 0, 0.08);
    n.fig.poner(n.x, n.y, n.z, n.ry, t);
  } else if (n.fig) { const h = n.fig.hoja; n.fig.cuadro(h.mov[1] + Math.floor(t / 600 + n.x) % 2, h.mov[0], P.x > n.x); n.fig.poner(n.x, n.y, n.z, camYaw); }
  // Proyectiles.
  proyectiles = proyectiles.filter(p => {
    p.t += dt / 0.28;
    const a = p.a, ay = (a.y || alturaEn(a.x, a.z)) + 1.2;
    p.mesh.position.set(lerp(p.de.x, a.x, p.t), lerp(p.de.y, ay, p.t) + Math.sin(p.t * Math.PI) * 0.8, lerp(p.de.z, a.z, p.t));
    if (p.t >= 1) { escena.remove(p.mesh); p.mesh.geometry.dispose(); return false; }
    return true;
  });
  // Camara: detras del duende, sin meterse en el suelo.
  const tx = P.x, ty = P.y + 1.4, tz = P.z;
  // Si un arbol tapa, la camara se acerca (suave al alejarse otra vez).
  const kChoque = choqueCamara(tx, tz, tx + Math.sin(camYaw) * Math.cos(camPitch) * camDist, tz + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
  camReal = kChoque * camDist < camReal ? kChoque * camDist : lerp(camReal, kChoque * camDist, 0.08);
  let cx = tx + Math.sin(camYaw) * Math.cos(camPitch) * camReal, cz = tz + Math.cos(camYaw) * Math.cos(camPitch) * camReal;
  let cy = ty + Math.sin(camPitch) * camReal;
  cy = Math.max(cy, alturaEn(cx, cz) + 0.8, MUNDO.agua + 0.5);
  camara.position.set(cx, cy, cz); camara.lookAt(tx, ty, tz);
  // Zona actual: titulo, cielo y niebla de su color.
  if (cuadro % 15 === 0) {
    const z = zonaEn(P.x, P.z);
    if (z !== zonaActual) { zonaActual = z; tituloZona(z); cieloObj.set(CIELO[z] || CIELO.pueblo); const luz = LUZ[z] || 1; hemi.intensity = 0.9 * luz; sol.intensity = 1.0 * luz; }
    if (yo) { const n = npcCercano(); const b = $('hablar'); b.style.display = n ? 'block' : 'none'; if (n) b.textContent = (MOVIL ? '' : 'E · ') + (n.tipo === 'portal' ? 'Mazmorras' : 'Hablar con ' + n.nombre); }
  }
  cieloAct.lerp(cieloObj, Math.min(1, dt * 1.5));
  escena.background.copy(cieloAct); escena.fog.color.copy(cieloAct);
  if (agua) agua.material.opacity = 0.7 + Math.sin(t / 900) * 0.04;
  if (portal) portal.velo.material.opacity = 0.45 + Math.sin(t / 300) * 0.15;
  pintarObjetivo();
  if (cuadro % 6 === 0) { pintarMini(); pintarCds(); pintarAuras(); }
  efectos = efectos.filter(e => {
    e.t += dt / e.dura;
    const r = 0.5 + e.radio * Math.min(1, e.t);
    e.m.scale.set(r, r, r); e.m.material.opacity = 0.8 * (1 - e.t);
    if (e.t >= 1) { escena.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); return false; }
    return true;
  });
  for (const z of zonas3.values()) { const k = clamp((performance.now() - z.ini) / z.ms, 0, 1); z.disco.material.opacity = 0.12 + 0.4 * k; z.disco.scale.setScalar(Math.max(0.05, k)); }
  if (sacudir > 0) { sacudir = Math.max(0, sacudir - dt); camara.position.x += (Math.random() - 0.5) * sacudir; camara.position.y += (Math.random() - 0.5) * sacudir; }
  alasMesh.visible = P.vuela && !!yo;
  if (alasMesh.visible) ponerAlas(alasMesh, P.x, P.y, P.z, P.fig && P.fig.tipo === 'modelo' ? P.ry : camYaw, t);
  etiquetas(t);
  numeros = numeros.filter(n => {
    n.t += dt;
    const s = aPantalla(n.x, n.y + n.t * 1.2, n.z);
    if (!s || n.t > 1.1) { n.d.remove(); return false; }
    n.d.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) translate(-50%,-50%)`;
    n.d.style.opacity = 1 - Math.max(0, n.t - 0.7) / 0.4;
    return true;
  });
  render.render(escena, camara);
}

// Estado visible en la consola para depurar (solo lectura).
window.__dq3 = { P, mons, otros, get objetivo() { return objetivo; }, get autoAtk() { return autoAtk; }, get yo() { return yo; }, cuadro: () => bucle(performance.now()), recibir };

// ── INICIO ──
async function inicio() {
  progreso(0.1, 'Cargando el arte del juego…');
  try { ANIM = await (await fetch(A + 'skins/duende_anim.json')).json(); } catch (e) {}
  await cargarImg(A + 'skins/duende_anim.png');
  progreso(0.3, 'Levantando montañas…');
  await new Promise(r => setTimeout(r, 20));
  agua = crearTerreno();
  progreso(0.55, 'Plantando bosques…');
  await new Promise(r => setTimeout(r, 20));
  crearFlora();
  portal = crearPueblo();
  progreso(0.75, 'Dibujando el mapa…');
  await new Promise(r => setTimeout(r, 20));
  pintarMapaBase();
  if (USAR_MODELOS) try { precalentar(); } catch (e) { console.warn(e); }
  for (const n of NPCS3D) {
    const fig = figuraModelo(() => crearNpc(n.hoja)) || await figuraHoja(n.hoja, 62);
    npcs.push({ ...n, y: alturaEn(n.x, n.z), fig, lbl: etiqueta('') });
  }
  P.lbl = etiqueta('yo');
  progreso(1, 'Conectando…');
  requestAnimationFrame(bucle);
  // Quien ya tiene sesion (Telegram, cuenta web o invitado con nombre) entra directo.
  const tok = TG ? null : await tokenWeb();
  let nombre = ''; try { nombre = localStorage.getItem('dq_mmo_nombre') || ''; } catch (e) {}
  let inv = null; try { inv = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (TG || tok || (inv && nombre)) { conectar(); return; }
  $('carga').style.display = 'none';
  abrir('v-inicio');
  const entrar = () => {
    const n = $('in-nombre').value.trim();
    if (n.length < 3) { $('in-nombre').focus(); return; }
    try { localStorage.setItem('dq_mmo_nombre', n); } catch (e) {}
    $('carga').style.display = 'flex'; progreso(1, 'Entrando al mundo…');
    conectar();
  };
  $('b-entrar').onclick = entrar;
  $('in-nombre').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') entrar(); });
}
inicio();
