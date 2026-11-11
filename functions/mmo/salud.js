// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — salud del Durable Object: cupo de escrituras y lag
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// - Cuenta cada storage.put/delete por prefijo de clave ('c', 'ranking',
//   'ret', ...), los mensajes recibidos por tipo y sus bytes, y el lag del
//   bucle (ms de retraso de cada tick sobre TICK_MS, media movil).
// - Lo del dia se guarda cada 10 min en met:<YYYY-MM-DD> (sobrevive a un
//   reinicio del DO: el cupo diario es de Cloudflare, no de la instancia).
// - Aviso al dueño (una vez al dia) al 60% y al 85% del cupo de escrituras.
// - Modo degradado desde el 80%: guardado cada 180 s, rankings en memoria
//   (se vuelcan cada 10 min) y sin invitados nuevos.
// - Lag por encima de LAG_MAX_MS durante 30 s: se rechazan entradas nuevas.
//
// El cupo por defecto es el del plan gratis (100.000 filas escritas al dia);
// con Workers Paid se sube con la variable de entorno MMO_CUPO_ESCRITURAS.
// Umbrales a calibrar contra el panel de Cloudflare (SIGUIENTE.md).
// ═══════════════════════════════════════════════════════

import { TICK_MS } from '../../mmo/js/data.js';

const CUPO_ESCRITURAS = 100000;      // plan gratis: filas escritas por dia (UTC)
const DEGRADADO_PCT = 0.8;
const AVISOS_PCT = [0.6, 0.85];
const LAG_MAX_MS = 80;
const LAG_SOSTENIDO_MS = 30000;
const LAG_ALFA = 0.1;                // media movil del lag
const MIN_ONLINE_LENTO = 10;         // con poca gente el lag no es por carga: no se rechaza a nadie
const VOLCAR_MET_MS = 10 * 60000;
const MAX_TIPOS = 80;                // tope de tipos de mensaje distintos que se cuentan

const diaHoy = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const metVacio = d => ({ d, w: 0, del: 0, pre: {}, msg: {}, nMsg: 0, bytes: 0, lagMax: 0, avisos: [] });
const prefijo = k => { const s = String(k); const i = s.indexOf(':'); return (i > 0 ? s.slice(0, i) : s).slice(0, 24); };

export const Salud = {
  // Envuelve this.state.storage para contar put y delete (todo el codigo usa
  // this.state.storage, tambien los modulos mezclados). Si el entorno no deja
  // envolverlo, se sigue sin contar.
  medirStorage() {
    const est = this.state, st = est && est.storage;
    if (!st || this._storageMedido) return;
    try {
      const yo = this;
      const prox = new Proxy(st, {
        get(t, k) {
          if (k === 'put') return (a, b, o) => { yo.contarEscritura(a, 'w'); return t.put(a, b, o); };
          if (k === 'delete') return (a, o) => { yo.contarEscritura(a, 'del'); return t.delete(a, o); };
          const v = Reflect.get(t, k);
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
      this.state = new Proxy(est, {
        get(t, k) {
          if (k === 'storage') return prox;
          const v = Reflect.get(t, k);
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
      this._storageMedido = true;
    } catch (e) { console.error('[MMO salud]', e); }
  },

  metHoy() {
    const d = diaHoy();
    if (!this.met || this.met.d !== d) this.met = metVacio(d);
    return this.met;
  },

  // a: una clave, un array de claves o un objeto { clave: valor } (put en lote).
  contarEscritura(a, tipo) {
    try {
      const m = this.metHoy();
      const claves = Array.isArray(a) ? a : (a && typeof a === 'object') ? Object.keys(a) : [a];
      for (const k of claves) {
        m[tipo]++;
        const p = prefijo(k);
        m.pre[p] = (m.pre[p] || 0) + 1;
      }
    } catch (e) {}
  },

  contarMsg(t, bytes) {
    const m = this.metHoy();
    m.nMsg++; m.bytes += bytes || 0;
    if (typeof t === 'string' && t.length <= 20 && (t in m.msg || Object.keys(m.msg).length < MAX_TIPOS)) m.msg[t] = (m.msg[t] || 0) + 1;
  },

  // En cada tick: retraso sobre los TICK_MS esperados. Un hueco de mas de 2 s
  // es el bucle que se reanuda (nadie conectado) o un salto de reloj: no cuenta.
  medirLag(ahora) {
    const prev = this.tickPrevT;
    this.tickPrevT = ahora;
    if (!prev) return;
    const hueco = ahora - prev;
    if (hueco > 2000 || hueco < 0) return;
    const lag = Math.max(0, hueco - TICK_MS);
    this.lagEwma = (this.lagEwma || 0) * (1 - LAG_ALFA) + lag * LAG_ALFA;
    const m = this.metHoy();
    if (this.lagEwma > m.lagMax) m.lagMax = Math.round(this.lagEwma);
    if (this.lagEwma > LAG_MAX_MS) { if (!this.lentoDesde) this.lentoDesde = ahora; this.lentoN = (this.lentoN || 0) + 1; }
    else { this.lentoDesde = 0; this.lentoN = 0; }
  },

  cupoEscrituras() {
    const v = Number(this.env && this.env.MMO_CUPO_ESCRITURAS);
    return v > 0 ? v : CUPO_ESCRITURAS;
  },
  usoCupo() { const m = this.metHoy(); return (m.w + m.del) / this.cupoEscrituras(); },
  degradado() { return this.usoCupo() >= DEGRADADO_PCT; },
  // Lag alto sostenido 30 s (y al menos 100 ticks seguidos: un salto de reloj no basta).
  lento() {
    return !!this.lentoDesde && Date.now() - this.lentoDesde >= LAG_SOSTENIDO_MS && (this.lentoN || 0) >= 100 && this.contarOnline() >= MIN_ONLINE_LENTO;
  },

  // Lo del dia de hoy (al arrancar o restaurar una copia).
  async cargarMet() {
    try {
      const d = diaHoy();
      const m = await this.state.storage.get('met:' + d);
      const ahora = this.metHoy();
      // Al restaurar una copia (copias.js llama a migrar) la memoria ya trae todo el
      // dia y el met: guardado es el de la copia: sumarlos contaria doble. Se queda la memoria.
      if (m && m.d === d && (ahora.w + ahora.del) <= ((m.w || 0) + (m.del || 0))) {
        // Lo contado antes de cargar (las escrituras de migrar) se suma.
        m.w = (m.w || 0) + ahora.w; m.del = (m.del || 0) + ahora.del;
        m.pre = m.pre || {}; for (const k in ahora.pre) m.pre[k] = (m.pre[k] || 0) + ahora.pre[k];
        m.msg = m.msg || {}; m.avisos = m.avisos || [];
        this.met = m;
      }
    } catch (e) { console.error('[MMO met]', e); }
  },

  async volcarMet() {
    const m = this.metHoy();
    this.metT = Date.now();
    // La propia escritura tambien cuenta.
    try { await this.state.storage.put('met:' + m.d, m); } catch (e) { console.error('[MMO met]', e); }
  },

  // Cada 10 s (desde tick): avisos al dueño y volcado cada 10 min.
  revisarSalud(ahora) {
    const m = this.metHoy(), uso = this.usoCupo();
    for (const p of AVISOS_PCT) {
      if (uso < p || m.avisos.includes(p)) continue;
      m.avisos.push(p);
      const pctTxt = Math.round(p * 100);
      this.avisarAdmin(`📈 Cupo de escrituras del MMO al ${pctTxt}% (${(m.w + m.del).toLocaleString('es')} de ${this.cupoEscrituras().toLocaleString('es')} hoy, día UTC)\n` +
        (p >= DEGRADADO_PCT ? 'Desde el 80% el servidor guarda cada 3 min, pausa los rankings y no deja entrar invitados nuevos hasta mañana.' : 'Al 80% el servidor pasa a modo ahorro (guardado cada 3 min, rankings pausados, sin invitados nuevos).') +
        '\nSi pasa seguido: Workers Paid (5 USD) y MMO_CUPO_ESCRITURAS. Detalle en /mmostats.', null, true, 'cupo').catch(() => {});
      this.volcarMet().catch(() => {});
    }
    if (ahora - (this.metT || 0) > VOLCAR_MET_MS) this.volcarMet().catch(() => {});
  },

  // Para /mmostats (por la ruta interna 'stats').
  infoSalud() {
    const m = this.metHoy();
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));
    return {
      dia: m.d, escrituras: m.w + m.del, cupo: this.cupoEscrituras(), pct: Math.round(this.usoCupo() * 1000) / 10,
      porPrefijo: top(m.pre, 8), mensajes: m.nMsg, kb: Math.round(m.bytes / 1024), tipos: top(m.msg, 6),
      lag: Math.round(this.lagEwma || 0), lagMax: m.lagMax, degradado: this.degradado(), lento: this.lento(),
    };
  },
};
