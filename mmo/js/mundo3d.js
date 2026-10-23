// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — el mundo abierto (compartido por servidor y cliente)
//
// Un solo mapa continuo de 1.320 m de lado, sin pantallas de carga, como en
// WoW o AION. El Pueblo Duende en el centro y las 10 zonas del juego a su
// alrededor en espiral: las de nivel bajo cerca del pueblo y las de nivel
// alto en el borde. Cada zona usa su bestiario, su jefe y sus colores de
// siempre (MAPAS en data.js), asi el 3D es el mismo juego en otra vista.
//
// Todo es determinista (ruido con semilla fija): el servidor y el navegador
// calculan el mismo relieve, las mismas regiones y los mismos campamentos sin
// mandarse el mapa.
//
// Unidades: metros. x hacia el este, z hacia el sur, y hacia arriba.
//
// No importa data.js: quien lo usa le pasa MAPAS y MONSTRUOS (el servidor y el
// navegador cargan data.js por rutas distintas y asi no se duplica).
// ═══════════════════════════════════════════════════════

export const MUNDO = {
  lado: 1320,          // el mapa va de -660 a 660 en x y en z
  limite: 640,         // hasta aqui se puede caminar (el borde es montaña)
  agua: 0,             // nivel del mar
  pueblo: { x: 0, z: 0, radio: 70 },
  velocidad: 7,        // metros por segundo a pie (la de WoW)
};

// Centro de cada zona. Espiral: nivel bajo cerca del pueblo.
export const ZONAS3D = {
  noche:       { x: -175, z: -120 },
  amanecer:    { x: 185,  z: -150 },
  selva:       { x: 230,  z: 185 },
  tormenta:    { x: -210, z: 225 },
  desierto:    { x: -440, z: -20 },
  castillo:    { x: 0,    z: -440 },
  cumbres:     { x: 440,  z: -390 },
  cavernas:    { x: 470,  z: 125 },
  abismo:      { x: 70,   z: 470 },
  acantilados: { x: -440, z: 440 },
};
const IDS = Object.keys(ZONAS3D);

// Relieve propio de cada zona: amplitud de las colinas y desnivel.
const RELIEVE = {
  noche: [5, 2.4], amanecer: [11, 4.5], selva: [6, 2], tormenta: [16, 6.5], desierto: [7, 2.8],
  castillo: [9, 4.5], cumbres: [26, 13], cavernas: [14, 3.5], abismo: [6, -2.2], acantilados: [22, 10],
};

// ── RUIDO (value noise con semilla fija) ──
function hash(x, z) {
  let h = (x | 0) * 374761393 + (z | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const suave = t => t * t * (3 - 2 * t);
function ruido(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = suave(xf), v = suave(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * (ruido(x * f, z * f) * 2 - 1); f *= 2.03; amp *= 0.5; }
  return s;
}

// ── REGIONES ──
// La zona de un punto es la del centro mas cercano; el pueblo, un circulo.
export function zonaEn(x, z) {
  if (Math.hypot(x - MUNDO.pueblo.x, z - MUNDO.pueblo.z) < MUNDO.pueblo.radio) return 'pueblo';
  let mejor = null, md = Infinity;
  for (const id of IDS) { const c = ZONAS3D[id]; const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < md) { md = d; mejor = id; } }
  return mejor;
}
// Pesos de las dos zonas mas cercanas (para fundir colores y relieve en los
// limites: no hay bordes duros entre zonas).
export function mezclaEn(x, z) {
  const d = IDS.map(id => [id, Math.hypot(ZONAS3D[id].x - x, ZONAS3D[id].z - z)]).sort((a, b) => a[1] - b[1]);
  const [a, b] = d;
  const t = Math.max(0, Math.min(1, (b[1] - a[1]) / 60));   // 60 m de transicion
  const k = 0.5 + 0.5 * suave(t);
  return [[a[0], k], [b[0], 1 - k]];
}

// ── ALTURA DEL TERRENO ──
export function alturaEn(x, z) {
  let h = 0;
  for (const [id, k] of mezclaEn(x, z)) {
    const [amp, base] = RELIEVE[id];
    h += k * (base + amp * fbm(x / 70 + 13, z / 70 - 7));
  }
  h += 1.2 * fbm(x / 9, z / 9);   // detalle fino
  // El pueblo es llano y algo elevado (se ve desde las zonas).
  const dp = Math.hypot(x - MUNDO.pueblo.x, z - MUNDO.pueblo.z);
  const llano = suave(Math.max(0, Math.min(1, (dp - MUNDO.pueblo.radio) / 60)));
  h = 1.5 + (h - 1.5) * llano;
  // Caminos de tierra del pueblo a cada zona: casi llanos.
  // El borde del mundo sube como una cordillera.
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r > 580) h += ((r - 580) / 60) ** 2 * 28;
  return h;
}
// Pendiente aproximada (para no poner campamentos en precipicios).
export function pendienteEn(x, z) {
  const e = 2;
  return Math.hypot(alturaEn(x + e, z) - alturaEn(x - e, z), alturaEn(x, z + e) - alturaEn(x, z - e)) / (2 * e);
}

// ── PUEBLO ──
// Los mismos personajes del pueblo 2D; el portal lleva a las mazmorras.
export const NPCS3D = [
  { id: 'guia',     nombre: 'Guardia Tito',    hoja: 'goblin_guard',   tipo: 'guia',      x: -14, z: 10 },
  { id: 'mercader', nombre: 'Mercader Grumo',  hoja: 'goblin_peasant', tipo: 'tienda',    x: 16,  z: 8 },
  { id: 'sabio',    nombre: 'Sabio Hechicero', hoja: 'hechicero',      tipo: 'ranking',   x: 2,   z: -20 },
  { id: 'artesana', nombre: 'Artesana Lila',   hoja: 'goblin_mage',    tipo: 'artesania', x: -20, z: -12 },
];
export const NPC_DIST = 6;            // metros para hablar
export const SPAWN3D = { x: 0, z: 22 };
// Casas del pueblo (decorado; el servidor no las necesita).
export const CASAS = [
  { x: -34, z: 18, w: 10, d: 8, r: 0.3 }, { x: 36, z: 22, w: 9, d: 9, r: -0.4 }, { x: -30, z: -34, w: 11, d: 8, r: 0.9 },
  { x: 32, z: -30, w: 9, d: 10, r: -0.8 }, { x: 0, z: 44, w: 12, d: 8, r: 0 }, { x: -50, z: -4, w: 8, d: 8, r: 1.5 },
  { x: 50, z: -2, w: 8, d: 9, r: -1.5 },
];

// ── CAMPAMENTOS DE MONSTRUOS ──
// En cada zona, 14 claros donde viven 2-3 monstruos de su bestiario; los mas
// cercanos al pueblo tienen los de menor nivel (como en el 2D, que empezaba
// por los faciles). El jefe de la zona vive en el claro mas lejano.
function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
let _campos = null;
export function campamentos(MAPAS, MONSTRUOS) {
  if (_campos) return _campos;
  const l = [];
  let n = 0;
  for (const id of IDS) {
    const mp = MAPAS[id], c = ZONAS3D[id];
    if (!mp || !mp.monstruos || !mp.monstruos.length) continue;
    const r = rng(9001 + n * 7919);
    const puntos = [];
    for (let i = 0; i < 400 && puntos.length < 15; i++) {
      const ang = r() * Math.PI * 2, dist = 25 + r() * 150;
      const x = Math.round(c.x + Math.cos(ang) * dist), z = Math.round(c.z + Math.sin(ang) * dist);
      if (zonaEn(x, z) !== id || Math.max(Math.abs(x), Math.abs(z)) > 560) continue;
      // El Abismo Marino es costa: sus criaturas viven tambien en aguas bajas.
      if (alturaEn(x, z) < MUNDO.agua + (id === 'abismo' ? -3.5 : 0.8) || pendienteEn(x, z) > 0.55) continue;
      if (puntos.some(p => Math.hypot(p.x - x, p.z - z) < 26)) continue;
      puntos.push({ x, z, dp: Math.hypot(x, z) });
    }
    puntos.sort((a, b) => a.dp - b.dp);
    const tipos = [...mp.monstruos].sort((a, b) => MONSTRUOS[a].nivel - MONSTRUOS[b].nivel);
    const jefe = mp.jefe && puntos.length ? puntos.pop() : null;
    puntos.forEach((p, i) => {
      const k = tipos[Math.min(tipos.length - 1, Math.floor(i / puntos.length * tipos.length))];
      l.push({ id: l.length, zona: id, x: p.x, z: p.z, k, n: 2 + (i % 2), jefe: false });
    });
    if (jefe) l.push({ id: l.length, zona: id, x: jefe.x, z: jefe.z, k: mp.jefe, n: 1, jefe: true });
    n++;
  }
  return (_campos = l);
}

