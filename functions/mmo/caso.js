// ═══════════════════════════════════════════════════════
// EL CASO DEL TRAIDOR (ORIGINS) — servidor
//
// Se mezcla en MmoWorld. Datos en mmo/js/caso.js. La pista solo se entrega si su
// mision secundaria consta como cumplida en c.sec y una sola vez por personaje;
// el cliente no puede pedir pistas ni premios: solo marcar una sospecha, que no
// da nada. La mision final resuelve el caso (y el logro da el titulo).
// ═══════════════════════════════════════════════════════
import { CASO, PISTAS, SOSPECHOSOS, pistaDeMision, estadoCaso, reaccionCaso } from '../../mmo/js/caso.js';

const casoDe = c => {
  if (!c.caso || typeof c.caso !== 'object' || Array.isArray(c.caso)) c.caso = {};
  if (!c.caso.p || typeof c.caso.p !== 'object' || Array.isArray(c.caso.p)) c.caso.p = {};
  return c.caso;
};

export const Caso = {
  infoCaso(c) { return { t: 'caso', ...estadoCaso(c) }; },

  // Tras cumplir una secundaria. Devuelve true si cambio algo.
  avanzarCaso(s, misionId, calla) {
    const c = s.c, sec = c.sec || {};
    let cambio = false;
    const q = pistaDeMision(misionId);
    if (q && sec[misionId + ':ok']) {
      const k = casoDe(c);
      if (!k.p[q.id]) {
        k.p[q.id] = 1;
        const oro = q.oro;
        c.oro += oro;
        c.mat = c.mat || {};
        for (const m in q.mat || {}) c.mat[m] = Math.min(999, (c.mat[m] || 0) + q.mat[m]);
        if (!calla) this.enviar(s, { t: 'gana', xp: 0, oro, drops: [] });
        this.enviar(s, { t: 'pista', id: q.id, n: estadoCaso(c).p.length, oro, mat: q.mat || null, ...(calla ? { calla: 1 } : {}) });
        cambio = true;
      }
    }
    if (misionId === CASO.misionFinal && sec[misionId + ':ok']) {
      const k = casoDe(c);
      if (!k.res) {
        k.res = 1;
        this.enviar(s, { t: 'casoFin', s: k.s || '', txt: reaccionCaso(k.s, k.sN) });
        if (this.revisarLogros) this.revisarLogros(s, true);
        cambio = true;
      }
    }
    if (cambio) {
      s.sucio = true;
      this.enviar(s, this.infoCaso(c));
      this.actualizarYo(s);
    }
    return cambio;
  },

  // Al entrar: si una mision ya cumplida no llego a dar su pista, se entrega. Nunca repite.
  revisarCaso(s) {
    const c = s.c, sec = c.sec || {}, oro0 = c.oro, n0 = estadoCaso(c).p.length;
    for (const q of PISTAS) if (sec[q.mision + ':ok'] && !(c.caso && c.caso.p && c.caso.p[q.id])) this.avanzarCaso(s, q.mision, true);
    const nN = estadoCaso(c).p.length - n0;
    if (nN) this.enviar(s, { t: 'casoDia', n: nN, oro: c.oro - oro0 });   // un solo aviso, no una tanda de monedas al entrar
    if (sec[CASO.misionFinal + ':ok'] && !(c.caso && c.caso.res)) this.avanzarCaso(s, CASO.misionFinal);
  },

  marcarSospecha(s, m) {
    const c = s.c;
    if (!c) return;
    const k = casoDe(c);
    const n = estadoCaso(c).p.length, id = String((m && m.id) || '');
    if (k.res || (c.sec || {})[CASO.cierre + ':ok'] || n < CASO.minSospecha || (id && !SOSPECHOSOS.some(x => x.id === id)) || Date.now() - (s.casoT || 0) < 500) return this.enviar(s, this.infoCaso(c));
    s.casoT = Date.now();
    if (id) { if (k.s !== id) { k.s = id; k.sN = n; } } else { delete k.s; delete k.sN; }
    s.sucio = true;
    this.enviar(s, this.infoCaso(c));
  },
};
