// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — Huevo Místico y mascotas místicas (servidor)
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Va sobre las mascotas de siempre: c.mascota es la UNICA equipada y
// c.mascotas las que tiene. Las 10 místicas (MISTICAS, data.js) no se venden:
// nacen de un Huevo Místico. Sus bonos son numeros de pets-config.js y solo
// se calculan aqui, en el servidor.
//
//  c.huevo     = { p }  puntos de incubacion del huevo que tiene (o null)
//  c.huevoDado = 1      ya se le entrego el primero (una vez por personaje)
//  c.eclos     = n      huevos que ya eclosionaron (fija la meta del siguiente)
//  c.petRegalo = 1      ya se le miro el regalo de la v405 (regaloMascota)
//
// El huevo es SOLO de cuentas registradas (uid 'tg:' o 'web:'; un invitado
// 'inv:' no lo recibe hasta crear su cuenta). Incuba unicamente equipado
// (c.mascota === 'huevo') y con actividad que el servidor ya valida: cazas con
// participacion real (dar) y misiones entregadas. Al llegar a la meta nace una
// mistica al azar (peso por rareza) entre las que aun no tiene.
//
// Mensajes:  servidor → mapa  { t: 'eclosion', id: <sesion>, m: <mascota> }
//            (equipar o guardar usa el { t: 'comprar', k: 'mascota', id } de siempre)
// ═══════════════════════════════════════════════════════
import { MASCOTAS, MISTICAS, RAREZAS_MASCOTA, HUEVO, metaHuevo, MONSTRUOS } from '../../mmo/js/data.js';
import { bonoPet, bolsaMaxDe, ESCUDO_RACHA_DIAS, REGALO_PET } from './pets-config.js';

const registrada = c => !!c && typeof c.uid === 'string' && (c.uid.startsWith('tg:') || c.uid.startsWith('web:'));

export const MascotasMisticas = {
  // Bono de la mistica equipada (0 si no lleva o no aplica). Lo usan dar(), mision(), mover...
  bonoMascota(c, clave) { return bonoPet(c, clave); },
  bolsaMax(c) { return bolsaMaxDe(c); },

  // Al cargar el personaje (hola): arregla datos rotos y entrega el primer huevo.
  // Sin mensajes: devuelve true si lo acaba de entregar (el aviso sale despues de 'bienvenido').
  huevoAlEntrar(c) {
    if (c.huevo && (typeof c.huevo !== 'object' || !(c.huevo.p >= 0))) c.huevo = { p: 0 };
    if (!Array.isArray(c.mascotas)) c.mascotas = [];
    const ma = typeof c.mascota === 'string' && Object.hasOwn(MASCOTAS, c.mascota) ? MASCOTAS[c.mascota] : null;
    // Un huevo que ya no tiene, o una mistica que no es suya (copia vieja o datos tocados): se guarda.
    if (ma && ((ma.huevo && !c.huevo) || (ma.mistica && !c.mascotas.includes(c.mascota)))) c.mascota = '';
    if (!registrada(c) || c.huevoDado) return false;
    c.huevoDado = 1;
    c.eclos = c.eclos || 0;
    if (!MISTICAS.some(k => !c.mascotas.includes(k))) return false;   // ya las tiene todas
    c.huevo = { p: 0 };
    if (!c.mascota) c.mascota = 'huevo';
    return true;
  },
  // Regalo de la v405 a los duendes que ya existian (REGALO_PET, pets-config.js): su primer huevo
  // eclosiona solo y la mascota queda puesta. Una vez por personaje, solo con cuenta, y solo si aun no
  // tenia ninguna mistica. Va despues de huevoAlEntrar. Solo datos: devuelve el id de la que nacio, o ''.
  regaloMascota(c) {
    if (!registrada(c) || c.petRegalo || !c.huevo) return '';
    if ((c.creado || 0) >= REGALO_PET.hasta) return '';
    c.petRegalo = 1;
    if ((c.eclos || 0) > 0 || (c.mascotas || []).some(k => MISTICAS.includes(k))) return '';
    return this.huevoNacer(c);
  },
  // El aviso del regalo (despues de 'bienvenido'): se guarda ya, para que al volver sea la misma mascota.
  regaloAvisar(s, id) {
    const c = s.c, ma = MASCOTAS[id];
    if (!ma) return;
    s.sucio = true;
    const avisar = () => {
      if (s.cerrado || s.c !== c) return;
      this.enviar(s, { t: 'toast', ok: true, imp: 1, m: `🎁 Regalo por tener tu cuenta: nació ${ma.nombre} (${RAREZAS_MASCOTA[ma.rareza].nombre}) y ya te acompaña. ${ma.bono}.${c.huevo ? ' Tienes otro huevo para incubar.' : ''} Cámbiala en Mascotas.` });
      if (c.mascota === id) this.aClave(s.k, { t: 'eclosion', id: s.id, m: id });   // el destello (solo adorno)
    };
    if (REGALO_PET.espera > 0) setTimeout(avisar, REGALO_PET.espera); else avisar();
    this.revisarLogros(s);
    this.guardar(s);
  },
  // Para datosPropios: barra del huevo (o null si no tiene).
  infoHuevo(c) { return c.huevo ? { p: Math.floor(c.huevo.p || 0), meta: metaHuevo(c.eclos || 0) } : null; },

  // Puntos de incubacion por una caza (lo llama dar()): solo con el huevo equipado,
  // pegando de verdad y con presas de su nivel (ni grises ni con poderes de dios).
  huevoCaza(s, o, participo) {
    const c = s.c;
    if (!c.huevo || c.mascota !== 'huevo' || !o || participo === false || participo === 'grupo') return;
    const nvM = o.nv || (MONSTRUOS[o.k] || {}).nivel || 1;
    if (nvM < (c.nivel || 1) - 10) return;
    this.huevoSumar(s, o.jefe ? HUEVO.jefe : HUEVO.caza);
  },
  huevoSumar(s, n) {
    const c = s.c;
    if (!c.huevo || c.mascota !== 'huevo' || !(n > 0) || this.diosActivo(s)) return;
    c.huevo.p = (c.huevo.p || 0) + n;
    s.sucio = true;
    if (c.huevo.p >= metaHuevo(c.eclos || 0)) this.huevoEclosionar(s);
  },
  // Nace una mistica que no tenga (peso por rareza). Devuelve su id, o '' si ya las tenia todas.
  // Solo los datos (vale con el jugador desconectado: eclosión instantánea pagada, gastos.js). Devuelve el id o ''.
  huevoNacer(c) {
    c.mascotas = c.mascotas || [];
    const faltan = MISTICAS.filter(k => !c.mascotas.includes(k));
    if (!c.huevo || !faltan.length) { c.huevo = null; if (c.mascota === 'huevo') c.mascota = ''; return ''; }
    const peso = k => RAREZAS_MASCOTA[MASCOTAS[k].rareza].peso;
    let r = Math.random() * faltan.reduce((a, k) => a + peso(k), 0), id = faltan[faltan.length - 1];
    for (const k of faltan) { r -= peso(k); if (r < 0) { id = k; break; } }
    c.mascotas.push(id);
    c.mascota = id;
    c.eclos = (c.eclos || 0) + 1;
    // Si aun le faltan, llega otro huevo (sin equipar: elige entre llevar a su mascota o incubar).
    c.huevo = faltan.length > 1 ? { p: 0 } : null;
    return id;
  },
  huevoEclosionar(s) {
    const c = s.c;
    const id = this.huevoNacer(c);
    if (!id) return '';
    s.sucio = true;
    const ma = MASCOTAS[id], rz = RAREZAS_MASCOTA[ma.rareza];
    this.aClave(s.k, { t: 'eclosion', id: s.id, m: id });
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.enviar(s, { t: 'toast', ok: true, m: `🥚 ¡Tu Huevo Místico eclosionó! Nació ${ma.nombre} (${rz.nombre}): ${ma.bono}.${c.huevo ? ' Te llegó otro huevo: llévalo para incubarlo.' : ''}` });
    this.revisarLogros(s);
    this.actualizarYo(s);
    this.guardar(s);
    return id;
  },

  // Entregar una mision tambien incuba (lo llaman mision() y la diaria).
  huevoMision(s) { this.huevoSumar(s, HUEVO.mision); },
  // Buho Sabio: +XP al entregar misiones.
  xpMisionMascota(c, xp) { const k = bonoPet(c, 'xpMision'); return k ? Math.round(xp * (1 + k)) : xp; },

  // Fenix: si falto exactamente un dia, la racha sigue (una vez cada ESCUDO_RACHA_DIAS). Lo usa procesarLogin.
  escudoRacha(c) {
    if (!bonoPet(c, 'escudoRacha')) return false;
    const ahora = Date.now();
    if (ahora - (c.petEscudoT || 0) < ESCUDO_RACHA_DIAS * 86400000) return false;
    c.petEscudoT = ahora;
    return true;
  },
};
