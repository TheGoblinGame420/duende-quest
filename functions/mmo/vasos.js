// ═══════════════════════════════════════════════════════
// VASOS DE CHICHA (ORIGINS) — servidor
//
// Se mezcla en MmoWorld. Datos en mmo/js/data.js (VASO, precioVaso). Una bendicion
// temporal que se gana jugando: misiones de la Chichera y de los ingredientes, y
// a veces cazando. Mama Asiri tambien vende unos pocos al dia por oro (sumidero).
// No hay paquete de dinero que los de: la tienda de pago no los conoce.
//
// Estado por personaje (todo opcional, con 0 por defecto):
//   c.vasos            vasos en la bolsa
//   c.vasoHoy          { d: dia, c: comprados, g: ganados cazando }
//   c.elix.vaso        fin de la bendicion activa (como los elixires: se guarda,
//                      vuelve al entrar y sigue tras morir; reponerElixires)
// Una sola activa y sin sumar tiempo: con una activa no se gasta otra.
// ═══════════════════════════════════════════════════════
import { VASO, precioVaso, hoyUTC, MONSTRUOS } from '../../mmo/js/data.js';
import { zonaEn } from '../../mmo/js/mundo3d.js';

const DOBLE_TOQUE_MS = 400;

// El contador de hoy, ya al dia (no se guarda nada si no cambia).
const hoyDe = c => {
  const d = hoyUTC(), h = c.vasoHoy;
  return h && h.d === d ? h : { d, c: 0, g: 0 };
};

export const Vasos = {
  infoVaso(c) { return { n: c.vasos | 0, hoy: hoyDe(c).c, ms: Math.max(0, ((c.elix || {}).vaso || 0) - Date.now()) }; },

  mensajeVaso(s, m) {
    if (m.a === 'comprar') return this.comprarVaso(s);
    if (m.a === 'tomar') return this.tomarVaso(s);
  },

  // Comprar: solo en el pueblo y hasta VASO.compraDia al dia. Sin el campo «falta»
  // en el aviso: no alcanzar el oro no lleva a la tienda de pago.
  comprarVaso(s) {
    const c = s.c, ahora = Date.now();
    if (!c || !s.m3 || s.muerto) return;
    if (ahora - (s.vasoT || 0) < DOBLE_TOQUE_MS) return;   // el doble toque no cobra dos veces
    if (s.i3 || zonaEn(s.p.x, s.p.z) !== 'pueblo') return this.no(s, 'Mama Asiri atiende en su puesto del Pueblo Duende.');
    const h = hoyDe(c);
    if (h.c >= VASO.compraDia) return this.no(s, `Hoy ya no hay más vasos, wawa: ${VASO.compraDia} por persona al día. Mañana hay olla nueva.`);
    if ((c.vasos | 0) >= VASO.max) return this.no(s, `Ya cargas ${VASO.max} vasos: toma alguno primero.`);
    const precio = precioVaso(c.nivel);
    if ((c.oro || 0) < precio) return this.no(s, `Un vaso cuesta ${precio.toLocaleString('es', { useGrouping: 'always' })} de oro y no te alcanza.`);
    s.vasoT = ahora;
    c.oro -= precio;
    c.vasos = (c.vasos | 0) + 1;
    h.c++;
    c.vasoHoy = h;
    this.enviar(s, { t: 'toast', ok: true, m: `🥤 Compraste un vaso de chicha por ${precio.toLocaleString('es', { useGrouping: 'always' })} de oro. Con yapa de cariño.` });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Tomar: en cualquier parte, una sola activa. Con otra activa no se gasta nada.
  tomarVaso(s) {
    const c = s.c, ahora = Date.now();
    if (!c || !s.m3 || s.muerto) return;
    if ((c.vasos | 0) <= 0) return this.no(s, 'No te queda ningún vaso. Mama Asiri vende en el pueblo.');
    if (this.elixir(s, 'vaso')) return this.no(s, `Ya tienes una chicha activa: te quedan ${Math.ceil((c.elix.vaso - ahora) / 60000)} min. Una sola a la vez.`);
    c.vasos--;
    c.elix = c.elix || {};
    c.elix.vaso = ahora + VASO.ms;
    this.ponerAura(s, 'vaso', VASO.ms);
    this.enviar(s, { t: 'vasoTomado', ms: VASO.ms });
    this.enviar(s, { t: 'toast', ok: true, m: `🥤 Un chorrito para la Pachamama y salud: +${Math.round((VASO.xp - 1) * 100)}% de XP de caza y vida poco a poco durante ${Math.round(VASO.ms / 60000)} min.` });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Vida por segundo (fraccion de la maxima) que suma la chicha activa. En duelo
  // o recien salido de una pelea contra otro jugador no cuenta.
  regenVaso(s, ahora) {
    if (s.duelo || !this.elixir(s, 'vaso') || ahora - (s.pvpT || 0) < 10000) return 0;
    return VASO.regen;
  },

  // Misiones: da su vaso y lo avisa. Devuelve cuantos entraron de verdad.
  darVasos(s, n, txt) {
    const c = s.c, dar = Math.min(n, VASO.max - (c.vasos | 0));
    if (dar <= 0) return 0;
    c.vasos = (c.vasos | 0) + dar;
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🥤 ${txt} Tómalo desde tu 🎒.` });
    this.yoLuego(s, true);
    return dar;
  },

  // Caza (dar en world.js): raro y con tope al dia, solo en ORIGINS y solo si
  // el monstruo es de tu nivel (o hasta 10 por debajo): no se farmea con grises.
  dropVaso(s, o) {
    if (!s.m3 || !o || !MONSTRUOS[o.k]) return;
    const c = s.c, nv = o.nv || MONSTRUOS[o.k].nivel;
    if (nv < c.nivel - 10 || (c.vasos | 0) >= VASO.max) return;
    const h = hoyDe(c);
    if (h.g >= VASO.cazaDia) return;
    if (Math.random() >= (o.jefe ? VASO.probJefe : VASO.probCaza)) return;
    h.g++;
    c.vasoHoy = h;
    this.darVasos(s, 1, 'Encontraste un vaso de chicha entre sus cosas.');
  },
};
