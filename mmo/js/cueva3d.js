// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — la Cueva de los Goblins (mazmorra instanciada)
//
// Compartido por el servidor y el cliente. La cueva esta en una franja del
// plano lejos del mundo (x >= CUEVA_X0), donde el suelo es plano (alturaEn
// devuelve 0 alli): cada grupo tiene su instancia (los monstruos llevan su
// id en o.i3) pero todas comparten las mismas coordenadas.
//
// Salas y pasillos son rectangulos [x0, z0, x1, z1] en metros, relativos a
// (CUEVA_X0, 0). Se camina por su union.
// ═══════════════════════════════════════════════════════
export const CUEVA_X0 = 3000;
export const CUEVA = {
  id: 'cueva',
  nombre: 'Cueva de los Goblins',
  max: 5,                                   // jugadores por instancia (un grupo)
  salas: [
    [-10, 0, 10, 22],                       // entrada
    [-3, 21, 3, 42],                        // pasillo
    [-20, 41, 20, 72],                      // sala de la guardia
    [-3, 71, 3, 92],                        // pasillo
    [-15, 91, 15, 118],                     // sala de los magos
    [14, 100, 36, 107],                     // pasillo al trono
    [35, 84, 77, 128],                      // salon del trono
  ],
  entrada: { x: 0, z: 6 },
  salida: { x: 0, z: 2 },                   // portal de vuelta
  // Grupos: [x, z, monstruo, cantidad]
  grupos: [
    [-8, 52, 'goblin_normal', 3], [9, 60, 'goblin_guard', 2], [0, 66, 'goblin_assassin', 2],
    [-7, 100, 'goblin_mage', 2], [8, 110, 'goblin_guard', 2], [24, 103, 'goblin_assassin', 2],
    [46, 95, 'goblin_guard', 2], [46, 118, 'goblin_guard', 2],
  ],
  jefe: { x: 62, z: 106, k: 'jefe_rey' },
  cofre: { x: 70, z: 106 },
};
// Portal del pueblo (el mismo arco violeta del cliente).
export const PORTAL_PUEBLO = { x: 22, z: -18 };
export const enCueva = x => x >= CUEVA_X0 - 200;
export function caminable(x, z, margen = 0.6) {
  const lx = x - CUEVA_X0;
  for (const [x0, z0, x1, z1] of CUEVA.salas) if (lx >= x0 + margen && lx <= x1 - margen && z >= z0 + margen && z <= z1 - margen) return true;
  return false;
}
// ¿Se ve (y se puede ir en linea recta) de A a B sin atravesar roca? (coordenadas absolutas)
export function vistaCueva(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az);
  for (let d = 0.5; d < L; d += 0.5) { const k = d / L; if (!caminable(ax + (bx - ax) * k, az + (bz - az) * k, 0)) return false; }
  return true;
}
// Puertas entre salas y pasillos (centros de cada union, relativas a CUEVA_X0).
const PUERTAS = [[0, 21.5], [0, 41.5], [0, 71.5], [0, 91.5], [14.5, 103.5], [35.5, 103.5]];
// A donde ir para llegar a (tx, tz) sin atravesar roca: directo si se ve, si no
// por la puerta visible que deja el camino mas corto.
export function pasoCueva(x, z, tx, tz) {
  if (vistaCueva(x, z, tx, tz)) return [tx, tz];
  let mejor = null, md = Infinity;
  for (const [px, pz] of PUERTAS) {
    const ax = CUEVA_X0 + px;
    if (Math.hypot(ax - x, pz - z) < 0.8 || !vistaCueva(x, z, ax, pz)) continue;
    const d = Math.hypot(ax - x, pz - z) + Math.hypot(tx - ax, tz - pz);
    if (d < md) { md = d; mejor = [ax, pz]; }
  }
  return mejor || [tx, tz];
}
// Nivel de la instancia: el del mas alto del grupo (5 a 60).
export const nivelCueva = nv => Math.max(5, Math.min(60, nv | 0));
