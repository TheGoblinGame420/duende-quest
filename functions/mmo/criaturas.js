// ═══════════════════════════════════════════════════════
// CRIATURAS (Fase 2, 17-nov-2026) — servidor
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo), como combate.js.
// El modelo y los topes estan en mmo/js/data.js (CRIATURA_*, normalizarCriaturas).
//
// Donde viven: en el personaje (c.cri), dentro del almacenamiento del Durable
// Object, y se guardan con el resto del progreso (guardar()). No hay tabla en
// Supabase: la base solo podria recibir una copia de solo lectura, y la
// autoridad (quien tiene que criatura) es siempre este servidor.
//
// Mensaje del cliente: { t: 'cri', a: 'ver' | 'apodo' | 'soltar' | 'equipo', ... }
//   ver                   → responde { t: 'cri', ... } (infoCriaturas)
//   apodo  { i, n }       → apodo nuevo (limpiarNombre + groserias); n '' lo quita
//   soltar { i }          → la libera (sale tambien del equipo)
//   equipo { l: [ids] }   → hasta CRIATURA_EQUIPO ids propios, sin repetir
// Entrada para otras partes del servidor: darCriatura(s, k, nv).
//
// CAPTURA (Fase 3): { t: 'capturar', id } — el cliente solo dice a que monstruo
// lanza la red. Aqui se valida todo (zona abierta, monstruo vivo y capturable,
// alcance, vida baja, nivel, que el daño sea sobre todo tuyo, hueco y espera) y
// se tira el dado. Exito: el monstruo sale del mapa sin botin ni XP y pasa a
// c.cri. Fallo: se enfada contigo. A todos los del mapa: { t: 'capt', id, p, ok }.
// ═══════════════════════════════════════════════════════
import { CRIATURA_MAX, CRIATURA_EQUIPO, NIVEL_MAX, criaturaCapturable, nombreCriatura, normalizarCriaturas, limpiarNombre, CAPTURA, probCaptura, MAPAS, MONSTRUOS } from '../../mmo/js/data.js';
import { RE_GROSERIA, groseriaDisfrazada } from './social.js';

// c.cri ya normalizados en esta vida del objeto. normalizarCriaturas crea objetos
// nuevos: hacerlo en cada uso dejaba viejas las referencias (la que devuelve
// darCriatura). Un personaje leido del almacenamiento o restaurado de una copia
// trae otro objeto, asi que se vuelve a normalizar solo.
const NORMALES = new WeakSet();

export const Criaturas = {
  criaturasDe(c) {
    if (c.cri && NORMALES.has(c.cri)) return c.cri;
    const cri = normalizarCriaturas(c);
    NORMALES.add(cri);
    return cri;
  },

  infoCriaturas(c) {
    const cri = this.criaturasDe(c);
    return { t: 'cri', l: cri.l, eq: cri.eq, max: CRIATURA_MAX, eqMax: CRIATURA_EQUIPO };
  },

  // La da el servidor (captura, premio, Modo Dios). null si no cabe o el tipo no vale.
  darCriatura(s, k, nv) {
    if (!s || !s.c || !criaturaCapturable(k)) return null;
    const cri = this.criaturasDe(s.c);
    if (cri.l.length >= CRIATURA_MAX) return null;
    const cr = { i: cri.sig++, k, nv: Math.max(1, Math.min(NIVEL_MAX, Math.floor(Number(nv) || 1))), xp: 0, a: '', t: Date.now() };
    cri.l.push(cr);
    // Si el equipo tiene hueco, se une sola: recien capturada es la que quieres ver.
    if (cri.eq.length < CRIATURA_EQUIPO) cri.eq.push(cr.i);
    s.sucio = true;
    this.enviar(s, this.infoCriaturas(s.c));
    this.refrescarCompanero(s);   // la primera capturada ya te sigue
    return cr;
  },

  capturar(s, m) {
    if (!s.c || s.m3 || s.muerto || !m) return;
    const ahora = Date.now();
    if (ahora < (s.capT || 0)) return this.no(s, 'Tu red todavía no está lista.');
    const w = this.mundoDe(s), mapa = MAPAS[w.mapa];
    if (!mapa || !mapa.zona || mapa.instancia || mapa.coliseo || w.inst || w.torre) return this.no(s, 'Aquí no se puede capturar.');
    const o = Number.isSafeInteger(m.id) ? w.mons.get(m.id) : null;
    if (!o || o.muere) return this.no(s, 'No hay nada que capturar ahí.');
    if (!criaturaCapturable(o.k) || o.jefe || o.ex || o.mazmorra || MONSTRUOS[o.k].mundial) return this.no(s, 'Esa criatura no se deja capturar.');
    if (Math.abs(o.x - s.x) > CAPTURA.rango || Math.abs(o.y - s.y) > CAPTURA.rango + 80) return this.no(s, 'Acércate más para lanzar la red.');
    if (o.hp > o.max * CAPTURA.hpMax) return this.no(s, 'Debilítala primero: menos del ' + Math.round(CAPTURA.hpMax * 100) + ' % de vida.');
    const nvMon = o.nv || MONSTRUOS[o.k].nivel || 1;
    if (nvMon > s.c.nivel + CAPTURA.nvSobre) return this.no(s, 'Es demasiado fuerte para ti.');
    let total = 0; for (const d of o.dano.values()) total += d;
    if ((o.dano.get(s.id) || 0) < total * CAPTURA.parte || !total) return this.no(s, 'Solo puedes capturar las que debilitaste tú.');
    const cri = this.criaturasDe(s.c);
    if (cri.l.length >= CRIATURA_MAX) return this.no(s, 'Ya tienes ' + CRIATURA_MAX + ' criaturas: suelta alguna primero.');
    s.capT = ahora + CAPTURA.cdMs;
    if (s.cast) this.cancelarCast(s);
    const ok = Math.random() < probCaptura(o.hp / o.max, nvMon, s.c.nivel);
    this.aClave(s.k, { t: 'capt', id: o.id, p: s.id, ok: ok ? 1 : 0 });
    if (!ok) {
      // Se suelta de la red y va a por ti.
      o.amen.set(s.id, (o.amen.get(s.id) || 0) + o.max);
      o.tocadoT = ahora;
      return;
    }
    w.mons.delete(o.id);
    this.aClave(s.k, { t: 'md', id: o.id, pr: [], fuera: 1 });
    this.darCriatura(s, o.k, nvMon);
    this.enviar(s, { t: 'toast', m: '¡Capturaste a ' + MONSTRUOS[o.k].nombre + ' (Nv ' + nvMon + ')!', ok: true });
  },

  criatura(s, m) {
    if (!s.c || !m || typeof m.a !== 'string') return;
    const cri = this.criaturasDe(s.c);
    const de = i => cri.l.find(cr => cr.i === (Number.isSafeInteger(i) ? i : -1));
    if (m.a === 'ver') return this.enviar(s, this.infoCriaturas(s.c));
    if (m.a === 'apodo') {
      const cr = de(m.i);
      if (!cr) return this.no(s, 'Esa criatura no es tuya.');
      const pedido = typeof m.n === 'string' ? m.n.slice(0, 40) : '';
      const n = limpiarNombre(pedido);
      if (pedido.trim() && !n) return this.no(s, 'El apodo debe tener de 3 a 16 letras o números.');
      if (n && (new RegExp(RE_GROSERIA.source, 'i').test(n) || groseriaDisfrazada(n))) return this.no(s, 'Ese apodo tiene palabras no permitidas.');
      cr.a = n;
    } else if (m.a === 'soltar') {
      const cr = de(m.i);
      if (!cr) return this.no(s, 'Esa criatura no es tuya.');
      cri.l = cri.l.filter(x => x !== cr);
      cri.eq = cri.eq.filter(i => i !== cr.i);
      this.enviar(s, { t: 'toast', m: nombreCriatura(cr) + ' vuelve a la naturaleza.' });
    } else if (m.a === 'equipo') {
      if (!Array.isArray(m.l) || m.l.length > CRIATURA_EQUIPO) return;
      const eq = [];
      for (const i of m.l) { if (!de(i)) return this.no(s, 'Esa criatura no es tuya.'); if (!eq.includes(i)) eq.push(i); }
      cri.eq = eq;
    } else return;
    s.sucio = true;
    this.enviar(s, this.infoCriaturas(s.c));
    this.refrescarCompanero(s);
  },
  // Compañero que te sigue por el mapa (lo ven todos): la primera del equipo.
  // Va en infoApariencia como cc = [tipo, apodo] (o nada).
  companeroDe(c) {
    if (!c || !c.cri) return undefined;
    const cri = this.criaturasDe(c), cr = cri.eq.length ? cri.l.find(x => x.i === cri.eq[0]) : null;
    return cr ? [cr.k, cr.a || ''] : undefined;
  },
  refrescarCompanero(s) {
    if (!s || !s.c || s.m3) return;
    const cc = JSON.stringify(this.companeroDe(s.c) || null);
    if (s.ccAnt === cc) return;
    s.ccAnt = cc;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
  },
};
