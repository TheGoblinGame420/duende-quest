// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — el Abismo de Éter (zona PvP de facciones, como en AION)
//
// Compartido por el servidor y el cliente. Un archipielago de islas flotantes
// sobre el vacio, lejos del mundo (x >= ABISMO_X0). Las islas son circulos
// con altura; entre ellas no hay suelo (VACIO): se pasa volando o planeando y
// caer al vacio mata. Cada faccion (Luz y Sombra) tiene su bastion en un
// extremo; en el centro, la Fortaleza del Nucleo.
// ═══════════════════════════════════════════════════════
export const ABISMO_X0 = 6000;
export const VACIO = -140;
export const FACCIONES = {
  luz:    { nombre: 'Luz',    color: '#fde68a', color2: '#60a5fa', titulo: 'Guardianes de la Luz' },
  sombra: { nombre: 'Sombra', color: '#c084fc', color2: '#ef4444', titulo: 'Hijos de la Sombra' },
};
export const ABISMO = {
  nombre: 'Abismo de Éter',
  nvMin: 20,
  // [x, z, radio, altura] relativos a (ABISMO_X0, 0)
  islas: [
    { x: 0, z: -200, r: 48, h: 30, base: 'luz', nombre: 'Bastión de la Luz' },
    { x: 0, z: 200, r: 48, h: 30, base: 'sombra', nombre: 'Bastión de la Sombra' },
    { x: 0, z: 0, r: 42, h: 58, nucleo: true, nombre: 'Fortaleza del Núcleo' },
    { x: -115, z: -70, r: 24, h: 40, nombre: 'Isla del Viento' },
    { x: 115, z: -70, r: 24, h: 44, nombre: 'Isla de Cristal' },
    { x: -115, z: 70, r: 24, h: 44, nombre: 'Isla Rota' },
    { x: 115, z: 70, r: 24, h: 40, nombre: 'Isla del Eco' },
    { x: -55, z: -125, r: 16, h: 34 }, { x: 55, z: -125, r: 16, h: 36 },
    { x: -55, z: 125, r: 16, h: 36 }, { x: 55, z: 125, r: 16, h: 34 },
    { x: -185, z: 0, r: 20, h: 52, nombre: 'Aguja del Oeste' }, { x: 185, z: 0, r: 20, h: 52, nombre: 'Aguja del Este' },
  ],
  // Campamentos de elite: [isla, monstruo, cantidad]
  campos: [[3, 'caballero_negro', 2], [4, 'hechicero_corte', 2], [5, 'esqueleto_capa', 2], [6, 'guardia_real', 3],
    [11, 'murcielago', 2], [12, 'hellgato', 2], [7, 'esqueleto_real', 2], [10, 'esqueleto_real', 2]],
};
// Rangos por Puntos del Abismo (PA): se ganan abatiendo a la otra faccion y a
// los elites de las islas; morir a manos del enemigo cuesta algunos.
export const RANGOS = [
  { pa: 0, n: 'Recluta' }, { pa: 60, n: 'Soldado' }, { pa: 200, n: 'Centinela' }, { pa: 500, n: 'Oficial' },
  { pa: 1100, n: 'Capitán' }, { pa: 2400, n: 'Comandante' }, { pa: 5000, n: 'General' }, { pa: 10000, n: 'Héroe del Éter' },
];
export function rangoDe(pa) {
  let i = 0;
  while (i + 1 < RANGOS.length && (pa || 0) >= RANGOS[i + 1].pa) i++;
  return { i, n: RANGOS[i].n, sig: RANGOS[i + 1] ? RANGOS[i + 1].pa : 0 };
}
export const enAbismo = x => x >= ABISMO_X0 - 450;
// Los bastiones son santuario: ahi nadie pelea contra jugadores.
export const santuario = (x, z) => { const is = islaEn(x, z); return !!(is && is.base); };
function hsh(x, z) { let h = (x | 0) * 374761393 + (z | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// Isla bajo (x, z) o null.
export function islaEn(x, z) {
  const lx = x - ABISMO_X0;
  for (const is of ABISMO.islas) if ((lx - is.x) ** 2 + (z - is.z) ** 2 < is.r * is.r) return is;
  return null;
}
// Altura del suelo: la isla con una loma suave y el borde que cae; fuera, el vacio.
export function alturaAbismo(x, z) {
  const lx = x - ABISMO_X0;
  for (const is of ABISMO.islas) {
    const d2 = (lx - is.x) ** 2 + (z - is.z) ** 2;
    if (d2 >= is.r * is.r) continue;
    const k = Math.sqrt(d2) / is.r;
    const loma = (1 - k * k) * 2.5 + (hsh(Math.floor(x / 6), Math.floor(z / 6)) - 0.5) * 0.4;
    return is.h + loma - Math.max(0, k - 0.9) * 30;   // el borde se desploma
  }
  return VACIO;
}
// Punto de aparicion de cada faccion (en su bastion) y su portal de vuelta.
export function baseDe(f) {
  const is = ABISMO.islas.find(i => i.base === f) || ABISMO.islas[0];
  return { x: ABISMO_X0 + is.x, z: is.z + (f === 'luz' ? -12 : 12) };
}
export function portalBase(f) {
  const is = ABISMO.islas.find(i => i.base === f) || ABISMO.islas[0];
  return { x: ABISMO_X0 + is.x, z: is.z + (f === 'luz' ? -30 : 30) };
}
// Campamentos de elite (formato de campamentos(): zona 'eter').
export function camposAbismo(desde) {
  return ABISMO.campos.map(([i, k, n], j) => {
    const is = ABISMO.islas[i];
    return { id: desde + j, zona: 'eter', x: ABISMO_X0 + is.x, z: is.z, k, n, jefe: false };
  });
}

// ── ASEDIO DE LA FORTALEZA DEL NUCLEO ──
// Cada 2 horas (a las :25 de las horas pares UTC, entre los jefes mundiales
// del 3D de :15 y :45) hay 20 minutos de asedio. La faccion que no es dueña
// rompe la Puerta del Nucleo; entonces despierta el Guardian, y quien mas lo
// daña se queda la fortaleza. Si se acaba el tiempo, resiste el dueño.
export const ASEDIO = { cada: 2 * 3600000, desfase: 25 * 60000, dura: 20 * 60000, aviso: 120000 };
// Inicio del asedio en curso o del proximo.
export function proximoAsedio(ahora) {
  const ini = Math.floor((ahora - ASEDIO.desfase) / ASEDIO.cada) * ASEDIO.cada + ASEDIO.desfase;
  return ahora < ini + ASEDIO.dura ? ini : ini + ASEDIO.cada;
}
const NUC = ABISMO.islas.find(i => i.nucleo);
export const CENTRO_NUCLEO = { x: ABISMO_X0 + NUC.x, z: NUC.z };
export const MURO_NUCLEO = NUC.r * 0.7;   // radio de la muralla de la fortaleza
// La puerta mira al oeste: a la misma distancia de los dos bastiones.
export const PUERTA_NUCLEO = { x: CENTRO_NUCLEO.x - MURO_NUCLEO, z: CENTRO_NUCLEO.z };
// Maquinas de asedio de cada bastion (las dibuja el cliente y las valida el
// servidor): % de la vida de la puerta por disparo, recarga y vuelo (s).
export const MAQUINA = {
  catapulta: { nombre: 'Catapulta', modelo: 'c_siege-catapult', pct: 0.003, cd: 15000, vuelo: 2.6 },
  balista: { nombre: 'Balista', modelo: 'c_siege-ballista', pct: 0.002, cd: 10000, vuelo: 1.6 },
  trebuchet: { nombre: 'Trebuchet', modelo: 'c_siege-trebuchet', pct: 0.006, cd: 30000, vuelo: 3.2 },
};
export const MAQUINA_DIST = 5;   // m: hay que estar al lado para dispararla
export function maquinasAbismo() {
  const l = [];
  for (const f of ['luz', 'sombra']) {
    const is = ABISMO.islas.find(i => i.base === f), cx = ABISMO_X0 + is.x, cz = is.z, haciaN = f === 'luz' ? 1 : -1;
    for (const [k, dx] of [['catapulta', 9], ['balista', -9], ['trebuchet', 0]]) l.push({ i: l.length, f, k, x: cx + dx, z: cz + haciaN * (dx ? 4 : -2), ry: haciaN > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  return l;
}
