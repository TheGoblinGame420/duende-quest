// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — expediciones
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
// Mandas a tu mascota (o a un duendecillo explorador) 1, 4 u 8 horas y al
// volver trae oro, un poco de experiencia y materiales (ver EXPEDICION en
// data.js). Una a la vez. Es el "vuelve luego" de la Mini App; da menos
// que jugar esas horas. Nunca mTON.
// c.exped = { h, ini, fin, nv }   (nv: tu nivel al salir, fija el premio)
// ═══════════════════════════════════════════════════════
import { EXPEDICION, premioExpedicion, MATERIALES, MASCOTAS, NIVEL_MAX } from '../../mmo/js/data.js';

export const Expediciones = {
  expedicion(s, m) {
    const c = s.c;
    const ahora = Date.now();
    if (m.recoger) {
      const e = c.exped;
      if (!e) return;
      if (ahora < e.fin) return this.no(s, 'Tu expedición aún no ha vuelto.');
      c.exped = null;
      const pr = premioExpedicion(e.h, e.nv, e.d);
      // A nivel maximo la XP no sirve: se cambia por oro (1 por 2 de XP).
      if (c.nivel >= NIVEL_MAX) { pr.oro += Math.round(pr.xp / 2); pr.xp = 0; }
      c.oro += pr.oro;
      if (pr.xp) this.sumarXp(s, pr.xp);
      c.mat = c.mat || {};
      for (const k in pr.mat) c.mat[k] = Math.min(999, (c.mat[k] || 0) + pr.mat[k]);
      c.expediciones = (c.expediciones || 0) + 1;
      s.sucio = true;
      const mats = Object.entries(pr.mat).map(([k, n]) => `${n} ${MATERIALES[k].nombre}`).join(', ');
      this.enviar(s, { t: 'toast', ok: true, m: `🧭 Volvió la expedición: +${pr.oro.toLocaleString('es')} oro${pr.xp ? ', +' + pr.xp.toLocaleString('es') + ' XP' : ''} y ${mats}.` });
      this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });   // vuelve la mascota
      this.revisarLogros(s);
      this.actualizarYo(s);
      this.guardar(s);
      return;
    }
    const h = EXPEDICION.horas.includes(m.h) ? m.h : 0;
    if (!h) return;
    if (c.nivel < EXPEDICION.nv) return this.no(s, `Las expediciones se abren a nivel ${EXPEDICION.nv}.`);
    if (c.exped) return this.no(s, c.exped.fin <= ahora ? 'Recoge antes la expedición que ya volvió.' : 'Ya tienes una expedición en camino.');
    const d = typeof m.d === 'string' && Object.hasOwn(EXPEDICION.destinos, m.d) ? m.d : 'bosque';
    c.exped = { h, d, ini: ahora, fin: ahora + h * 3600000, nv: c.nivel };
    s.sucio = true;
    const quien = c.mascota && MASCOTAS[c.mascota] ? MASCOTAS[c.mascota].nombre : 'Un duendecillo explorador';
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });   // la mascota se va
    this.enviar(s, { t: 'toast', ok: true, m: `🧭 ${quien} sale de expedición al ${EXPEDICION.destinos[d].nombre}: vuelve en ${h} h. Recógela en el registro de misiones (L).` });
    this.actualizarYo(s);
    this.guardar(s);
  },
};
