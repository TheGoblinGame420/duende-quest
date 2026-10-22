// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — pase de temporada (gratis, mensual)
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
// c.pase = { mes: 'AAAA-MM', p: puntos, cob: [niveles cobrados] }; al
// cambiar el mes empieza de cero. c.paseMax = el nivel mas alto cobrado
// alguna vez (logros). Los puntos los dan: tareas.js (cobrarTarea y
// bonoTareas), mazmorras.js (al completar) y world.js (jefe mundial).
// Nada de esto da mTON ni se compra.
// ═══════════════════════════════════════════════════════
import { PASE, paseMes, premioPase, MASCOTAS } from '../../mmo/js/data.js';

export const Pase = {
  paseDe(c) {
    const mes = paseMes();
    if (!c.pase || c.pase.mes !== mes) c.pase = { mes, p: 0, cob: [] };
    return c.pase;
  },
  infoPase(c) { const pa = this.paseDe(c); return { mes: pa.mes, p: pa.p, cob: pa.cob }; },
  puntoPase(s, n) {
    const c = s && s.c;
    if (!c || !(n > 0)) return;
    const pa = this.paseDe(c);
    const tope = PASE.niveles * PASE.porNivel;
    if (pa.p >= tope) return;
    const antes = Math.floor(pa.p / PASE.porNivel);
    pa.p = Math.min(tope, pa.p + n);
    const ahora = Math.floor(pa.p / PASE.porNivel);
    s.sucio = true;
    if (ahora > antes) this.enviar(s, { t: 'toast', ok: true, m: `Pase de temporada: nivel ${ahora}. Cobra el premio en el registro de misiones (L).` });
    this.enviar(s, { t: 'pase', pase: this.infoPase(c) });
  },
  cobrarPase(s, m) {
    const c = s.c;
    const pa = this.paseDe(c);
    const n = m.n | 0;
    if (n < 1 || n > PASE.niveles) return;
    if (pa.cob.includes(n)) return this.no(s, 'Ya cobraste ese nivel del pase.');
    if (Math.floor(pa.p / PASE.porNivel) < n) return this.no(s, 'Aún no llegas a ese nivel del pase.');
    const pr = premioPase(n, c.nivel);
    pa.cob.push(n);
    if (pr.oro) c.oro += pr.oro;
    if (pr.pw) for (const k in pr.pw) c.pw[k] = Math.min(99, (c.pw[k] || 0) + pr.pw[k]);
    if (pr.mascota && MASCOTAS[pr.mascota]) { c.mascotas = c.mascotas || []; if (!c.mascotas.includes(pr.mascota)) c.mascotas.push(pr.mascota); }
    if (pr.item) this.darItem(s, this.generarItem(c.nivel, pr.item));
    c.paseMax = Math.max(c.paseMax || 0, n);
    s.sucio = true;
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', ok: true, m: `🎟️ Premio del nivel ${n} del pase: ${pr.txt}.` });
    this.enviar(s, { t: 'pase', pase: this.infoPase(c) });
    this.actualizarYo(s);
    this.guardar(s);
  },
};
