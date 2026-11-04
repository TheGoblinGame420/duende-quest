// ═══════════════════════════════════════════════════════
// MISIONES SECUNDARIAS DE ORIGINS (27-oct-2026) — servidor
//
// Se mezcla en MmoWorld. Los datos estan en mmo/js/secundarias.js. Estado por
// personaje en c.sec: { <id>: progreso, '<id>:ok': 1 }. Avanzan con los mismos
// eventos que las tareas (progresoTarea): caza (k = monstruo), recoger, cofre en
// la zona donde estas; pescar y fabricar (la Artesana esta en el pueblo) cuentan
// para la mision activa de esa clase en cualquier zona, primero la de donde estas.
// La XP se mide por el nivel del jugador, con tope en TOPE_XP niveles sobre el de
// la mision: volver a una zona de novatos no regala niveles altos.
// ═══════════════════════════════════════════════════════
import { SECUNDARIAS, secundariaDe, ingredientesDe } from '../../mmo/js/secundarias.js';
import { xpParaSubir } from '../../mmo/js/data.js';
import { zonaEn } from '../../mmo/js/mundo3d.js';

const EN_CUALQUIER_ZONA = new Set(['pescar', 'fabricar']);
const ZONAS = [...new Set(SECUNDARIAS.map(q => q.zona))];
const TOPE_XP = 6;

export const Secundarias = {
  infoSec(c) { return { t: 'sec', l: c.sec || {} }; },
  progresoSecundaria(s, tipo, o) {
    if (!s.m3 || !s.c || s.i3) return;
    const c = s.c, sec = c.sec || (c.sec = {});
    const aqui = zonaEn(s.p.x, s.p.z);
    const zonas = EN_CUALQUIER_ZONA.has(tipo) ? [aqui, ...ZONAS.filter(z => z !== aqui)] : [aqui];
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
    const xp = Math.max(10, Math.round(xpParaSubir(Math.min(c.nivel, q.nv + TOPE_XP)) * q.premio.xp)), oro = q.premio.oro;
    c.oro += oro;
    c.mat = c.mat || {};
    for (const k in q.premio.mat || {}) c.mat[k] = Math.min(999, (c.mat[k] || 0) + q.premio.mat[k]);
    this.sumarXp(s, xp);
    // Las de la Chichera y las de los ingredientes (y la de la receta perdida) sirven un vaso.
    if (this.darVasos && (q.ingr || q.quien === 'Mama Asiri' || q.id === 's2')) this.darVasos(s, 1, 'Mama Asiri te guardó un vaso de chicha.');
    this.enviar(s, { t: 'gana', xp, oro, drops: [] });
    // ingr/ingrN: el aviso del Recetario llega con el conteo real (el cliente aun no tiene el 'sec' nuevo).
    this.enviar(s, { t: 'secFin', id: q.id, xp, oro, mat: q.premio.mat || null, ...(q.ingr ? { ingr: q.ingr, ingrN: ingredientesDe(c.sec).length } : {}) });
    this.enviar(s, this.infoSec(c));
    if (this.avanzarCaso) this.avanzarCaso(s, q.id);
    s.sucio = true;
    this.actualizarYo(s);
  },
};
