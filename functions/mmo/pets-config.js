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
import { BOLSA_MAX, MASCOTA_NV_MAX } from '../../mmo/js/data.js';

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
// Cada nivel de la mascota (c.petNv[id], se sube con $DUENDE: gastos.js) suma este tanto de SU bono:
// nivel 5 = bono x1,5 (un Sapo de +12 % pasa a +18 %). Los bonos de si/no no cambian.
export const EVO_PASO = 0.10;
export const nivelPet = c => { const id = c && c.mascota, n = c && c.petNv && typeof c.petNv === 'object' ? c.petNv[id] | 0 : 0; return Math.max(0, Math.min(MASCOTA_NV_MAX, n)); };

// La mistica que lleva puesta (y que es suya), o null.
export function petDe(c) {
  const id = c && c.mascota;
  return typeof id === 'string' && Object.hasOwn(PETS, id) && Array.isArray(c.mascotas) && c.mascotas.includes(id) ? PETS[id] : null;
}
// Valor del bono `clave` de la mascota equipada: numero (0 si no aplica); los de si/no dan 1.
export function bonoPet(c, clave) {
  const p = petDe(c), v = p ? p[clave] : 0;
  return typeof v === 'number' ? v * (1 + EVO_PASO * nivelPet(c)) : v ? 1 : 0;
}
export const bolsaMaxDe = c => BOLSA_MAX + Math.round(BOLSA_MAX * bonoPet(c, 'bolsa'));

// Regalo de la v405 (dueño, 22-nov-2026): a los duendes que YA existian, su primer Huevo Místico
// eclosiona solo la proxima vez que entren con cuenta, y la mascota sale ya puesta. Los duendes
// creados despues de esta fecha siguen incubando su huevo como siempre.
// Es un objeto para que el arnes pueda mover la fecha sin depender del dia en que se ejecute.
// espera: el aviso sale unos segundos despues de entrar, cuando el mundo ya cargo (antes se perdia tras la pantalla de carga).
export const REGALO_PET = { hasta: Date.UTC(2026, 10, 23, 5), espera: 6000 };   // 23-nov-2026 00:00, hora de Perú
