// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — bonos de las mascotas místicas (SOLO SERVIDOR)
//
// La unica tabla con los NUMEROS de las 10 mascotas oficiales. El cliente no
// la importa: recibe el resultado ya calculado (oro, XP, botin) o un factor
// que el servidor tambien aplica y vigila (velocidad en `yo.mv`, bolsa en
// `yo.bmax`). El texto que ve el jugador esta en MASCOTAS[id].bono (data.js);
// el arnes comprueba que diga lo mismo que esta tabla.
//
//   oro         + oro de caza (dar() de world.js: 2D y 3D)
//   oroDoble    probabilidad de que el oro de una caza salga doble
//   xpMision    + XP al entregar misiones (principal, diaria, vecinos, encargos, secundarias)
//   suerte      + probabilidad de equipo al cazar y en cofres
//   regen       + regeneracion de vida y de recurso (mana / energia)
//   jefes       + oro y XP de jefes y del jefe mundial (NUNCA mTON)
//   vel         + velocidad (presupuesto de mover en 2D y 3D)
//   bolsa       + huecos de bolsa
//   escudoRacha si faltas un dia la racha sigue (una vez cada ESCUDO_RACHA_DIAS)
// Una sola mascota equipada (c.mascota), y tiene que ser suya (c.mascotas).
// ═══════════════════════════════════════════════════════
import { BOLSA_MAX } from '../../mmo/js/data.js';

export const PETS = {
  sapo_rey:         { oro: 0.12 },
  zorro_mistico:    { vel: 0.10 },
  buho_runas:       { xpMision: 0.15 },
  escarabajo_aureo: { oroDoble: 0.08 },
  dragon_jade:      { oro: 0.20 },
  gato_duende:      { suerte: 0.05 },
  hongo_brillante:  { regen: 0.10 },
  lobo_sombrio:     { jefes: 0.18 },
  fenix_esmeralda:  { oro: 0.25, escudoRacha: true },
  golem_cristal:    { bolsa: 0.15 },
};
export const ESCUDO_RACHA_DIAS = 7;

// La mistica que lleva puesta (y que es suya), o null.
export function petDe(c) {
  const id = c && c.mascota;
  return typeof id === 'string' && Object.hasOwn(PETS, id) && Array.isArray(c.mascotas) && c.mascotas.includes(id) ? PETS[id] : null;
}
// Valor del bono `clave` de la mascota equipada: numero (0 si no aplica); los de si/no dan 1.
export function bonoPet(c, clave) {
  const p = petDe(c), v = p ? p[clave] : 0;
  return typeof v === 'number' ? v : v ? 1 : 0;
}
export const bolsaMaxDe = c => BOLSA_MAX + Math.round(BOLSA_MAX * bonoPet(c, 'bolsa'));
