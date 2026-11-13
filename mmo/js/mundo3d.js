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

import { alturaAbismo, camposAbismo } from './abismo3d.js';
export const MUNDO = {
  lado: 1800,          // el mapa va de -900 a 900 en x y en z (v376: antes 1320)
  limite: 880,         // hasta aqui se puede caminar (el borde es montaña)
  borde: 820,          // desde aqui sube la cordillera del borde (antes 580): la franja nueva tiene los LUGARES3D
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
  if (x > 4000) return 'eter';    // el Abismo de Eter (mmo/js/abismo3d.js)
  if (x > 2000) return 'cueva';   // la Cueva de los Goblins (mmo/js/cueva3d.js)
  if (Math.hypot(x - MUNDO.pueblo.x, z - MUNDO.pueblo.z) < MUNDO.pueblo.radio) return 'pueblo';
  let mejor = null, md = Infinity;
  for (const id of IDS) { const c = ZONAS3D[id]; const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < md) { md = d; mejor = id; } }
  return mejor;
}
// Pesos de las dos zonas mas cercanas (para fundir colores y relieve en los
// limites: no hay bordes duros entre zonas). Sin reservar memoria: se llama
// cientos de miles de veces al cargar y decenas por cuadro. El desempate con
// `<` estricto en el orden de IDS equivale al sort estable de antes.
let _a = IDS[0], _b = IDS[1], _k = 1;
function cercanas(x, z) {
  let da = Infinity, db = Infinity, ia = IDS[0], ib = IDS[1];   // con NaN queda como antes (noche/amanecer)
  for (let i = 0; i < IDS.length; i++) {
    // Distancias al cuadrado (el mismo orden) y solo dos raices al final: Math.hypot es lento y esto corre
    // cientos de miles de veces al cargar y cientos por cuadro.
    const id = IDS[i], c = ZONAS3D[id], dx = c.x - x, dz = c.z - z, d = dx * dx + dz * dz;
    if (d < da) { db = da; ib = ia; da = d; ia = id; } else if (d < db) { db = d; ib = id; }
  }
  _a = ia; _b = ib; da = Math.sqrt(da); db = Math.sqrt(db);
  _k = 0.5 + 0.5 * suave(Math.max(0, Math.min(1, (db - da) / 60)));   // 60 m de transicion
}
export function mezclaEn(x, z) {
  cercanas(x, z);
  return [[_a, _k], [_b, 1 - _k]];
}

// ── ALTURA DEL TERRENO ──
export function alturaEn(x, z) {
  if (x > 4000) return alturaAbismo(x, z);
  if (x > 2000) return 0;
  cercanas(x, z);
  // El relieve grande se calcula una vez (antes, una por zona con los mismos argumentos).
  const f = fbm(x / 70 + 13, z / 70 - 7), A = RELIEVE[_a], B = RELIEVE[_b];
  let h = 0;
  h += _k * (A[1] + A[0] * f);
  h += (1 - _k) * (B[1] + B[0] * f);
  h += 1.2 * fbm(x / 9, z / 9);   // detalle fino
  // El pueblo es llano y algo elevado (se ve desde las zonas).
  const dp = Math.hypot(x - MUNDO.pueblo.x, z - MUNDO.pueblo.z);
  const llano = suave(Math.max(0, Math.min(1, (dp - MUNDO.pueblo.radio) / 60)));
  h = 1.5 + (h - 1.5) * llano;
  // Caminos de tierra del pueblo a cada zona: casi llanos.
  // El borde del mundo sube como una cordillera.
  const r = Math.max(Math.abs(x), Math.abs(z));
  if (r > MUNDO.borde) h += ((r - MUNDO.borde) / 60) ** 2 * 28;
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
  { id: 'chichera', nombre: 'Mama Asiri',      hoja: 'goblin_peasant', tipo: 'chichera',  x: 24,  z: 13 },
];
// ── HORA Y CLIMA DEL MUNDO ──
// Un dia del mundo dura 48 minutos y es el mismo para todos (sale del reloj).
export const DIA_MS = 48 * 60 * 1000;
export const horaMundo = t => (t % DIA_MS) / DIA_MS * 24;
export const esNoche = t => { const h = horaMundo(t); return h < 5.5 || h >= 19.5; };
// Clima por zona en tandas de 12 minutos (determinista: todos ven lo mismo).
const CLIMAS = {
  amanecer: ['lluvia'], selva: ['lluvia', 'lluvia', 'tormenta'], tormenta: ['tormenta', 'lluvia'],
  noche: ['niebla'], cumbres: ['nieve'], desierto: ['arena'], castillo: ['niebla', 'lluvia'],
  abismo: ['niebla'], acantilados: ['lluvia', 'niebla'],
};
const NOMBRE_ZONA_N = z => [...z].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) | 0;
export function climaEn(zona, t) {
  const l = CLIMAS[zona];
  if (!l) return 'despejado';
  const tanda = Math.floor(t / (12 * 60 * 1000));
  const r = hash(tanda, NOMBRE_ZONA_N(zona));
  if (r > (zona === 'tormenta' ? 0.75 : 0.4)) return 'despejado';
  return l[Math.floor(hash(tanda + 7, NOMBRE_ZONA_N(zona)) * l.length)];
}
export const NPC_DIST = 6;            // metros para hablar
export const SPAWN3D = { x: 0, z: 22 };
// Claro del Titan: donde aparece el jefe mundial del 3D (llano, en el
// Amanecer para que lleguen todos los niveles).
export const ARENA3D = { x: 82, z: -47, r: 22, nombre: 'Claro del Titán' };
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
// Primera hora (Bosque, Colinas, Selva): un claro de 2 con su vecino a 55 m o mas sube a 3
// (la parada vale la caminata y el grupo mas grande sigue siendo de 3), y estos claros
// puente cubren los tramos vacios del camino. Van al final de la lista y con `puente`:
// nodos, cofres y reapariciones no los miran, asi no se mueve nada de lo que ya existia.
const ZONAS_PRIMERA_HORA = ['noche', 'amanecer', 'selva'];
const PUENTES3D = [
  ['noche', 'goblin_assassin', -135, -135, 2],
  ['amanecer', 'goblin_guard', 225, -45, 3],
  ['amanecer', 'pajaro', 255, -165, 3],
  ['selva', 'hongo', 75, 108, 3],
  ['selva', 'hongo', 181, 85, 3],
];
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
      const cp = { id: l.length, zona: id, x: p.x, z: p.z, k, n: 2 + (i % 2), jefe: false };
      // Campamento mixto: uno de cada tres suma un tirador de la zona (el de
      // nivel mas parecido) que dispara desde atras mientras los otros cargan.
      const mb = MONSTRUOS[k] || {};
      // (Nunca por debajo de Nv 8: ahí aprenden a pelear los recién llegados.)
      if (i % 3 === 2 && !mb.dispara && !mb.jefe && mb.nivel >= 8) {
        const tir = tipos.filter(t => MONSTRUOS[t] && MONSTRUOS[t].dispara && !MONSTRUOS[t].jefe)
          .sort((a, b) => Math.abs(MONSTRUOS[a].nivel - mb.nivel) - Math.abs(MONSTRUOS[b].nivel - mb.nivel))[0];
        if (tir) { cp.k2 = tir; cp.n2 = 1; }
      }
      l.push(cp);
    });
    if (jefe) l.push({ id: l.length, zona: id, x: jefe.x, z: jefe.z, k: mp.jefe, n: 1, jefe: true });
    n++;
  }
  for (const cp of l) if (ZONAS_PRIMERA_HORA.includes(cp.zona) && !cp.jefe && cp.n === 2 && !l.some(o => o !== cp && o.zona === cp.zona && !o.jefe && Math.hypot(o.x - cp.x, o.z - cp.z) < 55)) cp.n = 3;
  l.push(...camposAbismo(l.length));   // los de elite del Abismo de Eter
  for (const [zona, k, x, z, cuantos] of PUENTES3D) if (MONSTRUOS[k]) l.push({ id: l.length, zona, x, z, k, n: cuantos, jefe: false, puente: true });
  l.push(...camposExteriores(l.length, MAPAS, MONSTRUOS));   // v376: la franja nueva del borde (600-800 m) tambien tiene vida
  return (_campos = l);
}

// ── FRANJA EXTERIOR (v376) ──
// El mundo crecio de 1320 a 1800 m: entre los 600 y los 800 m del centro cada zona gana tierra nueva.
// Ahi van campamentos de los monstruos mas fuertes de la zona (al final de la lista: los id de los
// demas no cambian) y los LUGARES3D, sitios con nombre que se descubren al llegar.
function camposExteriores(id0, MAPAS, MONSTRUOS) {
  const l = [];
  let n = 0;
  for (const id of IDS) {
    const mp = MAPAS[id];
    if (!mp || !mp.monstruos || !mp.monstruos.length) continue;
    const r = rng(7001 + n * 104729), puntos = [];
    for (let i = 0; i < 500 && puntos.length < 5; i++) {
      const ang = r() * Math.PI * 2, dist = 610 + r() * 190;
      const x = Math.round(Math.cos(ang) * dist), z = Math.round(Math.sin(ang) * dist);
      if (zonaEn(x, z) !== id || Math.max(Math.abs(x), Math.abs(z)) > MUNDO.borde - 15) continue;
      if (alturaEn(x, z) < MUNDO.agua + (id === 'abismo' ? -3.5 : 0.8) || pendienteEn(x, z) > 0.55) continue;
      if (puntos.some(p => Math.hypot(p.x - x, p.z - z) < 40)) continue;
      puntos.push({ x, z });
    }
    const tipos = mp.monstruos.filter(k => MONSTRUOS[k] && !MONSTRUOS[k].jefe).sort((a, b) => MONSTRUOS[a].nivel - MONSTRUOS[b].nivel);
    const altos = tipos.slice(Math.floor(tipos.length / 2));
    puntos.forEach((p, i) => { if (altos.length) l.push({ id: id0 + l.length, zona: id, x: p.x, z: p.z, k: altos[i % altos.length], n: 2 + (i % 2), jefe: false, exterior: true }); });
    n++;
  }
  return l;
}
// Lugares con nombre de la franja exterior: [id, nombre, angulo en grados (atan2 z,x), estilo, lore]. La zona sale del sitio.
// estilo = el kit con que se arma en el cliente (mundo/js/lugares.js). Se colocan hacia fuera desde el
// centro de su zona, en tierra firme y poco empinada; la caleta busca la orilla.
const LUGARES_DEF = [
  ['panteon',   'Panteón de los Ñaupas',      -135,       'panteon',  'Aquí descansan los primeros duendes del valle. De noche, las velas se encienden solas.'],
  ['lenadores', 'Campamento de los Leñadores', -60,    'lenadores',  'Los leñadores del pueblo cortan aquí la madera para las casas y las ollas de chicha.'],
  ['naufragio', 'Naufragio del Galeón Negro',  50,       'naufragio',  'Un barco pirata que la tormenta tiró selva adentro. Dicen que su cofre sigue enterrado.'],
  ['atalaya',   'Atalaya de la Tormenta',      150,    'atalaya',  'Desde lo alto, los vigías avisaban al pueblo cuando bajaban los rayos de los Picos.'],
  ['vigia',     'Torre del Vigía del Desierto',190,    'vigia',  'Una torre de piedra que guía a las caravanas entre las dunas doradas.'],
  ['cripta',    'Cripta del Rey Olvidado',     -100,    'cripta',  'Antes del Rey Goblin hubo otro rey. Su nombre se borró de todas las piedras menos de esta.'],
  ['puesto',    'Puesto de Avanzada del Ocaso', -25,    'puesto',  'El último refugio antes de las cumbres: fogata, tiendas y herramientas para el frío.'],
  ['mina',      'Mina Abandonada',             20,    'mina',  'Los mineros se fueron de golpe y dejaron todo. Algo los asustó en las Cavernas.'],
  ['caleta',    'Caleta del Pirata Cojo',      95,      'caleta',  'Un muelle escondido donde los piratas cambiaban perlas del Abismo por chicha morada.'],
  ['santuario', 'Santuario de los Acantilados',120, 'santuario',  'Columnas y altares de una magia vieja. El viento suena aquí como una quena.'],
];
let _lugares = null;
export const LUGAR_DIST = 45;   // a esta distancia del centro se descubre
export function lugares3d() {
  if (_lugares) return _lugares;
  const l = [];
  for (const [id, nombre, grados, estilo, lore] of LUGARES_DEF) {
    const a0 = grados * Math.PI / 180, costa = estilo === 'caleta';
    let mejor = null;
    for (let k = 0; k < 400 && !mejor; k++) {
      const a = a0 + ((k % 9) - 4) * 0.02, R = 700 + (Math.floor(k / 9) % 2 ? 1 : -1) * Math.floor(k / 18) * 8;
      if (R < 600 || R > 790) continue;
      const x = Math.round(Math.cos(a) * R), z = Math.round(Math.sin(a) * R), h = alturaEn(x, z);
      if (pendienteEn(x, z) > (costa ? 0.25 : 0.32)) continue;
      const orilla = alturaEn(x - Math.cos(a) * 25, z - Math.sin(a) * 25) < MUNDO.agua - 0.5 || alturaEn(x + Math.cos(a) * 25, z + Math.sin(a) * 25) < MUNDO.agua - 0.5;
      if (costa ? !(h > MUNDO.agua + 0.4 && h < MUNDO.agua + 3 && orilla) : h < MUNDO.agua + 1) continue;
      mejor = { x, z };
    }
    if (!mejor) {   // sin sitio ideal: el punto de tierra mas cercano al rayo
      for (let R = 700; R > 600 && !mejor; R -= 10) { const x = Math.round(Math.cos(a0) * R), z = Math.round(Math.sin(a0) * R); if (alturaEn(x, z) > MUNDO.agua + 0.5) mejor = { x, z }; }
    }
    if (mejor) l.push({ id, nombre, zona: zonaEn(mejor.x, mejor.z), estilo, lore, x: mejor.x, z: mejor.z, ry: Math.atan2(-mejor.x, -mejor.z) });
  }
  return (_lugares = l);
}

// ── PUNTOS DE REAPARICION ──
// Antes se revivia siempre en el pueblo (hasta 600 m de caminata y la espiral
// de muertes). Por zona, varios claros: se avanza desde el pueblo en abanico
// hasta el primer sitio libre de cada rayo; la entrada es el mas cercano al
// pueblo. Nunca a menos de 45 m de un campamento (tampoco del jefe), en tierra
// firme y poco empinada (en las Cumbres y la costa se afloja si no hay nada).
// Iguales en servidor y cliente.
let _rev3 = null;
export function puntosRev3d(MAPAS, MONSTRUOS) {
  if (_rev3) return _rev3;
  const campos = campamentos(MAPAS, MONSTRUOS).filter(c => c.zona !== 'eter' && !c.puente);
  const l = [];
  for (const id of IDS) {
    const c = ZONAS3D[id], ang0 = Math.atan2(c.z - MUNDO.pueblo.z, c.x - MUNDO.pueblo.x), dc = Math.hypot(c.x, c.z);
    let pz = [];
    for (const [agua, pend, lejos] of [[0.8, 0.45, 45], [0.3, 0.7, 38]]) {
      const libre = (x, z) => zonaEn(x, z) === id && Math.max(Math.abs(x), Math.abs(z)) < 600
        && alturaEn(x, z) > MUNDO.agua + agua && pendienteEn(x, z) < pend
        && !campos.some(k => Math.hypot(k.x - x, k.z - z) < lejos)
        && Math.hypot(ARENA3D.x - x, ARENA3D.z - z) > ARENA3D.r + 30;   // lejos del pisoton del jefe mundial
      for (let r = -4; r <= 4; r++) {
        const ang = ang0 + r * 0.2;
        for (let d = MUNDO.pueblo.radio + 12; d < dc + 150; d += 4) {
          const x = Math.round(Math.cos(ang) * d), z = Math.round(Math.sin(ang) * d);
          if (!libre(x, z)) continue;
          if (!pz.some(p => Math.hypot(p.x - x, p.z - z) < 50)) pz.push({ zona: id, x, z, dp: d });
          break;
        }
      }
      if (pz.length) break;
    }
    pz.sort((a, b) => a.dp - b.dp);
    pz.forEach((p, i) => l.push({ zona: id, x: p.x, z: p.z, entrada: i === 0 }));
  }
  return (_rev3 = l);
}
// Donde se revive tras caer en (x, z): hasta Nv 10 en la entrada de esa zona;
// desde Nv 10 en el claro mas cercano a menos de 250 m. null = el pueblo.
export function revivirEn3d(x, z, nivel, MAPAS, MONSTRUOS) {
  const zona = zonaEn(x, z), l = puntosRev3d(MAPAS, MONSTRUOS);
  if (zona === 'pueblo' || zona === 'cueva' || zona === 'eter') return null;
  const mz = MAPAS && MAPAS[zona]; if (mz && mz.nv && mz.nv[0] > nivel + 2) return null;
  if (nivel < 10) { const e = l.find(p => p.zona === zona && p.entrada); if (e) return e; }
  let mejor = null, md = 250;
  for (const p of l) { const d = Math.hypot(p.x - x, p.z - z); if (d < md) { md = d; mejor = p; } }
  return mejor;
}

// ── RECOLECCION ──
// 24 puntos por zona (hierbas y vetas, alternadas), lejos de los
// campamentos y en tierra firme. Deterministas: el servidor y el cliente
// calculan la misma lista.
// ── COFRES DEL TESORO (3 por zona) ──
// El legendario en el punto mas alto que se encuentra (hay que trepar o
// volar), el epico lejos del centro y el comun cerca. Iguales en servidor y
// cliente (semilla fija).
export const COFRE3D_DIST = 3.5;
let _cofres3 = null;
export function cofres3d(MAPAS, MONSTRUOS) {
  if (_cofres3) return _cofres3;
  const campos = campamentos(MAPAS, MONSTRUOS).filter(c => !c.puente);
  const l = [];
  let n = 0;
  for (const id of IDS) {
    const c = ZONAS3D[id], r = rng(9157 + n * 7919), cand = [];
    for (let i = 0; i < 500; i++) {
      const ang = r() * Math.PI * 2, dist = 20 + r() * 160;
      const x = Math.round(c.x + Math.cos(ang) * dist), z = Math.round(c.z + Math.sin(ang) * dist);
      if (zonaEn(x, z) !== id || Math.max(Math.abs(x), Math.abs(z)) > 560) continue;
      if (alturaEn(x, z) < MUNDO.agua + 1 || pendienteEn(x, z) > 0.9) continue;
      if (campos.some(p => Math.hypot(p.x - x, p.z - z) < 12)) continue;
      cand.push({ x, z, h: alturaEn(x, z), d: dist });
    }
    if (cand.length >= 3) {
      const alto = cand.reduce((a, b) => (b.h > a.h ? b : a));
      const resto = cand.filter(p => Math.hypot(p.x - alto.x, p.z - alto.z) > 40);
      const lejos = resto.reduce((a, b) => (b.d > a.d ? b : a), resto[0]);
      const cerca = resto.filter(p => p !== lejos && Math.hypot(p.x - lejos.x, p.z - lejos.z) > 30).reduce((a, b) => (b.d < a.d ? b : a), resto[1] || resto[0]);
      for (const [p, tipo] of [[alto, 'legendario'], [lejos, 'epico'], [cerca, 'comun']]) if (p) l.push({ i: l.length, zona: id, x: p.x, z: p.z, tipo });
    }
    n++;
  }
  return (_cofres3 = l);
}
export const RECOGER_DIST = 3.5;
let _nodos = null;
export function nodos3d(MAPAS, MONSTRUOS) {
  if (_nodos) return _nodos;
  const campos = campamentos(MAPAS, MONSTRUOS).filter(c => !c.puente);
  const l = [];
  let n = 0;
  for (const id of IDS) {
    const c = ZONAS3D[id];
    const r = rng(4243 + n * 104729);
    let puestos = 0;
    for (let i = 0; i < 600 && puestos < 24; i++) {
      const ang = r() * Math.PI * 2, dist = 15 + r() * 165;
      const x = Math.round(c.x + Math.cos(ang) * dist), z = Math.round(c.z + Math.sin(ang) * dist);
      if (zonaEn(x, z) !== id || Math.max(Math.abs(x), Math.abs(z)) > 570) continue;
      if (alturaEn(x, z) < MUNDO.agua + 0.8 || pendienteEn(x, z) > 0.5) continue;
      if (campos.some(p => Math.hypot(p.x - x, p.z - z) < 14)) continue;
      if (l.some(p => Math.hypot(p.x - x, p.z - z) < 12)) continue;
      l.push({ i: l.length, zona: id, x, z, tipo: puestos % 2 ? 'mineral' : 'hierba' });
      puestos++;
    }
    n++;
  }
  l.push(...arbolesTalables(l.length, campos));   // v378: al final, los indices de plantas y vetas no cambian
  return (_nodos = l);
}

// ── ARBOLES TALABLES (v378) ──
// Puntos de recoleccion de tipo 'madera' con la forma de un arbol (el cliente lo dibuja; al talarlo queda
// el tocon hasta que vuelve a crecer, como las plantas). 12 alrededor del Campamento de los Leñadores y 3
// cerca del centro de cada zona de la primera hora, para que el novato lo descubra pronto.
function arbolesTalables(i0, campos) {
  const l = [], libre = (x, z) => alturaEn(x, z) > MUNDO.agua + 0.8 && pendienteEn(x, z) < 0.45 && !campos.some(p => Math.hypot(p.x - x, p.z - z) < 14) && !l.some(p => Math.hypot(p.x - x, p.z - z) < 6);
  const len = lugares3d().find(x => x.id === 'lenadores');
  if (len) { const r = rng(5501); for (let k = 0; k < 300 && l.length < 12; k++) { const a = r() * Math.PI * 2, d = 17 + r() * 14, x = Math.round(len.x + Math.cos(a) * d), z = Math.round(len.z + Math.sin(a) * d); if (libre(x, z)) l.push({ i: i0 + l.length, zona: zonaEn(x, z), x, z, tipo: 'madera' }); } }
  ZONAS_PRIMERA_HORA.forEach((id, n) => {
    const c = ZONAS3D[id], r = rng(6607 + n * 31); let k = 0;
    for (let t = 0; t < 300 && k < 3; t++) { const a = r() * Math.PI * 2, d = 20 + r() * 60, x = Math.round(c.x + Math.cos(a) * d), z = Math.round(c.z + Math.sin(a) * d); if (zonaEn(x, z) === id && libre(x, z)) { l.push({ i: i0 + l.length, zona: id, x, z, tipo: 'madera' }); k++; } }
  });
  return l;
}

// ── CORRIENTES DE VIENTO DEL MUNDO ABIERTO ──
// Una por zona, a ~25 m del cofre legendario (el punto mas alto) y en la
// parte mas baja de ese anillo: el novato sin alas entra volando o planeando,
// el servidor le recarga las alas y sube hasta el cofre. Mismo formato que
// CORRIENTES del Abismo ({ x, z, r }) mas la zona y la altura del suelo (y).
// Indices desplazados (+100) para no chocar con los del Abismo en s.corrT.
export const CORRIENTE_MUNDO_BASE = 100;
let _corrM = null;
export function corrientesMundo(MAPAS, MONSTRUOS) {
  if (_corrM) return _corrM;
  const l = [];
  for (const c of cofres3d(MAPAS, MONSTRUOS)) {
    if (c.tipo !== 'legendario' || c.zona === 'pueblo') continue;
    let mejor = null;
    for (let k = 0; k < 12; k++) {
      const ang = k * Math.PI / 6;
      const x = Math.round(c.x + Math.cos(ang) * 25), z = Math.round(c.z + Math.sin(ang) * 25);
      if (zonaEn(x, z) !== c.zona || Math.max(Math.abs(x), Math.abs(z)) > 570) continue;
      const y = alturaEn(x, z);
      if (y < MUNDO.agua + 0.5) continue;
      if (!mejor || y < mejor.y) mejor = { x, z, y };
    }
    if (mejor) l.push({ x: mejor.x, z: mejor.z, r: 8, y: Math.round(mejor.y * 10) / 10, zona: c.zona });
  }
  return (_corrM = l);
}
// Indice (+100) de la corriente en (x, z), o -1. Mismo criterio que corrienteEn.
export function corrienteEnMundo(x, z, MAPAS, MONSTRUOS) {
  const i = corrientesMundo(MAPAS, MONSTRUOS).findIndex(c => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r);
  return i < 0 ? -1 : CORRIENTE_MUNDO_BASE + i;
}

