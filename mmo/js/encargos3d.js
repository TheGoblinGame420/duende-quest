// ═══════════════════════════════════════════════════════
// $DUENDE ORIGINS — encargos de zona (compartido servidor/cliente)
//
// Cada una de las 10 zonas del mundo 3D tiene 5 encargos que no son "mata N":
// encontrar su hito (el punto mas alto cerca del centro), recoger plantas o
// vetas, sobrevolarla con las alas, abrir uno de sus cofres y vencer a su
// jefe. Se hacen en cualquier orden; completar los 5 da un premio de zona y
// cuenta para los logros de explorador.
// ═══════════════════════════════════════════════════════
// (Sin imports: ZONAS3D y alturaEn llegan como parametros, asi el navegador
// no carga mundo3d.js dos veces con y sin ?v=.)

export const HITOS = {
  noche: 'el Árbol de los Susurros', amanecer: 'la Roca del Alba', selva: 'la Cascada Escondida',
  tormenta: 'el Pararrayos Antiguo', desierto: 'el Oasis Perdido', castillo: 'la Atalaya en Ruinas',
  cumbres: 'el Pico Helado', cavernas: 'el Cristal Madre', abismo: 'el Faro de la Costa', acantilados: 'el Mirador Arcano',
};
export const HITO_DIST = 9;      // m: a esta distancia del hito se cuenta como encontrado
export const VOLAR_ALTO = 25;    // m sobre el suelo para el encargo de sobrevolar
export const ZONAS_ENC = ['noche', 'amanecer', 'selva', 'tormenta', 'desierto', 'castillo', 'cumbres', 'cavernas', 'abismo', 'acantilados'];

// El hito: el punto mas alto (en tierra firme) entre 30 y 60 m del centro de la zona.
const _hitos = {};
export function hitoDe(id, ZONAS3D, alturaEn) {
  if (_hitos[id]) return _hitos[id];
  const c = ZONAS3D[id];
  if (!c) return null;
  let mejor = null;
  for (let k = 0; k < 24; k++) for (const r of [30, 45, 60]) {
    const a = k / 24 * Math.PI * 2, x = Math.round(c.x + Math.cos(a) * r), z = Math.round(c.z + Math.sin(a) * r), h = alturaEn(x, z);
    if (h > 0.5 && (!mejor || h > mejor.h)) mejor = { x, z, h };
  }
  return (_hitos[id] = mejor ? { x: mejor.x, z: mejor.z } : { x: c.x, z: c.z });
}

export function encargosDe(id, MAPAS, MONSTRUOS) {
  const mp = MAPAS[id];
  if (!mp || !ZONAS_ENC.includes(id)) return [];
  const jefe = mp.jefe && MONSTRUOS[mp.jefe] ? MONSTRUOS[mp.jefe].nombre : 'el jefe de la zona';
  return [
    { id: id + ':hito', tipo: 'explorar', n: 1, txt: `Encuentra ${HITOS[id] || 'el hito de la zona'}` },
    { id: id + ':recoger', tipo: 'recoger', n: 4, txt: 'Recoge 4 plantas o vetas de la zona' },
    { id: id + ':volar', tipo: 'volar', n: 1, txt: `Sobrevuela la zona a ${VOLAR_ALTO} m de altura (V)` },
    { id: id + ':cofre', tipo: 'cofre', n: 1, txt: 'Abre un cofre del tesoro de la zona' },
    { id: id + ':jefe', tipo: 'jefe', n: 1, txt: `Derrota a ${jefe}, el jefe de la zona` },
  ];
}
// Premio de cada encargo y de completar la zona (oro; la XP la pone el servidor).
export const oroEncargo = nvZona => 40 + nvZona * 25;
export const oroZona = nvZona => 300 + nvZona * 60;
