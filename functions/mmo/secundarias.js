// ═══════════════════════════════════════════════════════
// MISIONES SECUNDARIAS DE ORIGINS (27-oct-2026) — servidor
//
// Se mezcla en MmoWorld. Los datos estan en mmo/js/secundarias.js. Estado por
// personaje en c.sec: { <id>: progreso, '<id>:ok': 1 }. Avanzan con los mismos
// eventos que las tareas (progresoTarea): caza (k = monstruo), recoger, cofre en
// la zona donde estas; pescar y fabricar (la Artesana esta en el pueblo) cuentan
// para la mision activa de esa clase en cualquier zona.
// ═══════════════════════════════════════════════════════
import { SECUNDARIAS, secundariaDe } from '../../mmo/js/secundarias.js';
import { xpParaSubir } from '../../mmo/js/data.js';
import { zonaEn } from '../../mmo/js/mundo3d.js';

const EN_CUALQUIER_ZONA = new Set(['pescar', 'fabricar']);
const ZONAS = [...new Set(SECUNDARIAS.map(q => q.zona))];

export const Secundarias = {
  infoSec(c) { return { t: 'sec', l: c.sec || {} }; },
  progresoSecundaria(s, tipo, o) {
    if (!s.m3 || !s.c || s.i3) return;
    const c = s.c, sec = c.sec || (c.sec = {});
    const zonas = EN_CUALQUIER_ZONA.has(tipo) ? ZONAS : [zonaEn(s.p.x, s.p.z)];
    for (const z of zonas) {
      const q = secundariaDe(z, sec, c.nivel);
      if (!q || q.tipo !== tipo) continue;
      if (q.k && (!o || o.k !== q.k)) continue;
      sec[q.id] = (sec[q.id] || 0) + 1;
      s.sucio = true;
      if (sec[q.id] >= q.n) this.cumplirSecundaria(s, q);
      else this.enviar(s, this.infoSec(c));
      return;   // un evento avanza una sola mision
    }
  },
  cumplirSecundaria(s, q) {
    const c = s.c;
    c.sec[q.id + ':ok'] = 1;
    delete c.sec[q.id];
    const xp = Math.max(10, Math.round(xpParaSubir(c.nivel) * q.premio.xp)), oro = q.premio.oro;
    c.oro += oro;
    c.mat = c.mat || {};
    for (const k in q.premio.mat || {}) c.mat[k] = Math.min(999, (c.mat[k] || 0) + q.premio.mat[k]);
    this.sumarXp(s, xp);
    this.enviar(s, { t: 'gana', xp, oro, drops: [] });
    this.enviar(s, { t: 'secFin', id: q.id, xp, oro, mat: q.premio.mat || null });
    this.enviar(s, this.infoSec(c));
    s.sucio = true;
    this.actualizarYo(s);
  },
};
