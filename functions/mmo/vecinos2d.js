// ═══════════════════════════════════════════════════════
// VECINOS DEL MUNDO 2D (Fase 2 del mundo vivo, 17-nov-2026) — servidor
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo), como criaturas.js.
// Los datos (quién vive dónde y sus encargos) están en mmo/js/vecinos2d.js.
//
// Progreso en el personaje: c.v2 = { <idEncargo>: numero | true }.
//   numero = aceptado (le hablaste) y lo que llevas · true = cobrado.
// Un encargo solo avanza si lo aceptaste y estás en SU zona abierta (no en
// mazmorras, torre ni coliseo). Se cobra volviendo a hablar con el vecino:
// el servidor comprueba que estés cerca de él.
//
// Mensaje del cliente: { t: 'v2', a: 'hablar', id: <idVecino> }
// Respuesta: { t: 'v2', l: c.v2 } y, al cobrar, el 'gana' de siempre.
// ═══════════════════════════════════════════════════════
import { MAPAS, xpParaSubir } from '../../mmo/js/data.js';
import { VECINOS2D, VECINO_DIST, vecinoPorId, encargoVecino } from '../../mmo/js/vecinos2d.js';

const TOPE_XP = 6;           // como las secundarias del 3D: volver a una zona baja no regala niveles altos
const MARGEN_DIST = 60;      // latencia: el cliente ve al vecino un poco antes que el servidor

// Premio de un encargo: XP según el nivel (con tope) y oro según la zona.
export function premioVecino(q, nivel, zona) {
  const nvZ = ((MAPAS[zona] || {}).nv || [1])[0];
  const peso = q.tipo === 'jefe' ? 0.35 : q.k ? 0.16 : 0.24;
  const xp = Math.max(15, Math.round(xpParaSubir(Math.min(nivel, q.nv + TOPE_XP)) * peso));
  const oro = Math.round((20 + nvZ * 12) * (q.tipo === 'jefe' ? 3 : q.k ? 1 : 1.5));
  return { xp, oro };
}

export const Vecinos2D = {
  infoVecinos(c) { return { t: 'v2', l: c.v2 || {} }; },

  // Hablar con un vecino: acepta su encargo, o lo cobra si ya está cumplido.
  vecino(s, m) {
    if (!s.c || s.m3 || !m || m.a !== 'hablar' || typeof m.id !== 'string') return;
    const ahora = Date.now();
    if (ahora - (s.v2T || 0) < 300) return;
    s.v2T = ahora;
    const hit = vecinoPorId(m.id);
    if (!hit) return;
    const { v, zona } = hit;
    const w = this.mundoDe(s);
    if (!w || w.mapa !== zona || w.inst || w.torre) return this.no(s, 'Ese vecino vive en otra zona.');
    if (Math.abs(s.x - v.x) > VECINO_DIST + MARGEN_DIST) return this.no(s, 'Acércate a ' + v.nombre + ' para hablar.');
    const c = s.c, v2 = c.v2 || (c.v2 = {});
    const e = encargoVecino(v, v2, c.nivel);
    if (!e) return this.enviar(s, this.infoVecinos(c));
    if (e.bloq) return this.no(s, v.nombre + ': vuelve cuando seas nivel ' + e.q.nv + '.');
    const q = e.q;
    if (typeof v2[q.id] !== 'number') {
      v2[q.id] = 0; s.sucio = true;
      this.enviar(s, this.infoVecinos(c));
      return this.enviar(s, { t: 'toast', m: 'Encargo nuevo de ' + v.nombre + ': ' + q.pide + '.', ok: true });
    }
    if (v2[q.id] < q.n) return this.enviar(s, this.infoVecinos(c));
    // Cumplido: se cobra aquí.
    v2[q.id] = true; s.sucio = true;
    const pr = premioVecino(q, c.nivel, zona);
    c.oro += pr.oro;
    this.enviar(s, { t: 'gana', xp: pr.xp, oro: pr.oro, drops: [] });
    this.sumarXp(s, pr.xp);
    this.enviar(s, this.infoVecinos(c));
    this.enviar(s, { t: 'v2fin', id: v.id, q: q.id, xp: pr.xp, oro: pr.oro });
    this.actualizarYo(s);
  },

  // Desde progresoTarea: una caza o un jefe en la zona abierta del jugador.
  progresoVecinos(s, tipo, o) {
    if (s.m3 || !s.c || !o || (tipo !== 'caza' && tipo !== 'jefe')) return;
    const v2 = s.c.v2;
    if (!v2) return;
    const w = this.mundoDe(s);
    if (!w || w.inst || w.torre) return;
    const zona = w.mapa, mapa = MAPAS[zona];
    if (!mapa || !mapa.zona || !VECINOS2D[zona]) return;
    for (const v of VECINOS2D[zona]) {
      const e = encargoVecino(v, v2, s.c.nivel);
      if (!e || e.bloq || typeof v2[e.q.id] !== 'number' || v2[e.q.id] >= e.q.n) continue;
      const q = e.q;
      if (q.tipo !== tipo) continue;
      if (tipo === 'jefe' && o.k !== mapa.jefe) continue;
      if (tipo === 'caza' && (o.jefe || (q.k && o.k !== q.k))) continue;
      v2[q.id]++; s.sucio = true;
      this.enviar(s, this.infoVecinos(s.c));
      if (v2[q.id] >= q.n) this.enviar(s, { t: 'toast', m: '¡Listo! Vuelve con ' + v.nombre + ' para cobrar.', ok: true });
    }
  },
};
