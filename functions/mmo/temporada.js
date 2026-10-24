// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — equilibrio de facciones y Temporada del Abismo
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Equilibrio (como en AION, sin tocar estadisticas: el PvP sigue justo):
// - La faccion con menos miembros es la "debil": quien se une a ella cobra un
//   bono de reclutamiento y todos sus miembros ganan PA x1,5 (Bendicion del
//   Eter). Si en el Abismo estan en inferioridad 2 a 1, PA x2.
// - La puntuacion de temporada de cada faccion se divide por la raiz de sus
//   participantes: la faccion grande no gana solo por ser grande.
//
// Temporada del Abismo: mensual (el mismo mes que el pase). Cuenta los PA
// ganados (no resta las muertes). Al cerrar el mes, cada jugador cobra al
// entrar (aunque llegue semanas despues): premio por su liga (Bronce a
// Diamante), +50 % si su faccion gano y un legendario si quedo en el podio.
//
// this.facc (storage 'facc'): { n: {luz, sombra}, mes, pts: {luz, sombra},
//   as: {luz, sombra}, l: { uid: { n, f, p } }, hist: [{ mes, ganador, sc, top }] }
// c.tempA = { mes, p } · c.tempGanadas, c.tempTop, c.tempCampeon, c.tempMejor
// ═══════════════════════════════════════════════════════
import { paseMes, multLogin, nombreItem } from '../../mmo/js/data.js';
import { FACCIONES, enAbismo, TEMP_ABISMO, tierTemp, FACC_BONO, RECLUTA, faccionDebil } from '../../mmo/js/abismo3d.js';

const vacioF = () => ({ luz: 0, sombra: 0 });

export const Temporada = {
  // Estado global (se crea si aun no se cargo del storage).
  faccEstado() {
    if (!this.facc) this.facc = { n: vacioF(), mes: paseMes(), pts: vacioF(), as: vacioF(), l: {}, hist: [] };
    return this.facc;
  },
  guardarFacc() {
    if (this.state && this.state.storage && this.facc) this.state.storage.put('facc', this.facc).catch(e => console.error('[MMO facc]', e));
  },
  // Al arrancar: carga; la primera vez cuenta los miembros de cada faccion.
  async cargarFacc() {
    const st = this.state && this.state.storage;
    if (!st) return;
    this.facc = (await st.get('facc')) || null;
    const F = this.faccEstado();
    if (!F.contado && st.list) {
      const n = vacioF();
      try {
        const todos = await st.list({ prefix: 'c:' });
        for (const c of todos.values()) if (c && c.faccion && Object.hasOwn(n, c.faccion)) n[c.faccion]++;
        F.n = n;
      } catch (e) { console.error('[MMO facc contar]', e); }
      F.contado = true;
      this.guardarFacc();
    }
  },
  debilAhora() { return faccionDebil(this.faccEstado().n); },
  // Miembros conectados de cada faccion dentro del Abismo.
  enAbismoPorF() {
    const n = vacioF();
    for (const s of this.sesiones.values()) if (s.c && s.m3 && !s.cerrado && s.c.faccion && s.p && enAbismo(s.p.x)) n[s.c.faccion]++;
    return n;
  },
  // Multiplicador de PA por equilibrio y su motivo.
  multPA(s) {
    const f = s.c.faccion;
    if (!f) return { x: 1 };
    const otra = f === 'luz' ? 'sombra' : 'luz';
    if (s.p && enAbismo(s.p.x)) {
      const on = this.enAbismoPorF();
      if (on[otra] >= 2 && on[f] * 2 <= on[otra]) return { x: 2, por: 'en inferioridad' };
    }
    if (this.debilAhora() === f) return { x: FACC_BONO, por: 'Bendición del Éter' };
    return { x: 1 };
  },

  // ── TEMPORADA ──
  // Devuelve el estado de la temporada en curso; si cambio el mes, cierra la anterior.
  temporadaA() {
    const F = this.faccEstado(), mes = paseMes();
    if (F.mes !== mes) {
      const viejo = F.mes;
      if (viejo && (F.pts.luz || F.pts.sombra || F.as.luz || F.as.sombra)) {
        const sc = this.puntuacionTemp(F);
        const ganador = sc.luz > sc.sombra ? 'luz' : sc.sombra > sc.luz ? 'sombra' : null;
        const top = Object.entries(F.l).filter(([, x]) => x.p > 0).sort((a, b) => b[1].p - a[1].p).slice(0, 3);
        F.hist = [{ mes: viejo, ganador, sc, top: top.map(([uid]) => uid), tops: top.map(([, x]) => ({ n: x.n, f: x.f, p: x.p })) }, ...(F.hist || [])].slice(0, 4);
        if (this.aTodos) this.aTodos({ t: 'aviso', m: ganador ? `🏆 Termina la Temporada del Abismo ${viejo}: ¡ganan los ${FACCIONES[ganador].titulo}! Entra para cobrar tus premios.` : `🏆 Termina la Temporada del Abismo ${viejo} en empate. Entra para cobrar tus premios.` });
      }
      F.mes = mes; F.pts = vacioF(); F.as = vacioF(); F.l = {};
      this.guardarFacc();
      if (this.sesiones) for (const s of this.sesiones.values()) if (s.c) this.cobrarTemporada(s);
    }
    return F;
  },
  // Puntuacion de faccion: PA / raiz(participantes) + 100 por asedio ganado.
  puntuacionTemp(F) {
    const act = vacioF();
    for (const x of Object.values(F.l)) if (x.p > 0 && Object.hasOwn(act, x.f)) act[x.f]++;
    const sc = vacioF();
    for (const f in sc) sc[f] = Math.round((F.pts[f] || 0) / Math.sqrt(Math.max(1, act[f])) + 100 * (F.as[f] || 0));
    return sc;
  },
  // Anota PA ganados en la temporada (lo llama sumarPA con n > 0).
  anotarTemp(s, n) {
    const c = s.c;
    if (!c.faccion || !(n > 0)) return;
    const F = this.temporadaA();
    if (!c.tempA || c.tempA.mes !== F.mes) c.tempA = { mes: F.mes, p: 0 };
    const t0 = tierTemp(c.tempA.p);
    c.tempA.p += n;
    F.pts[c.faccion] = (F.pts[c.faccion] || 0) + n;
    F.l[c.uid] = { n: c.nombre, f: c.faccion, p: c.tempA.p };
    const t1 = tierTemp(c.tempA.p);
    if (t1 > t0) this.enviar(s, { t: 'toast', ok: true, m: `🏆 Temporada del Abismo: subes a la liga ${TEMP_ABISMO[t1].n}. Su premio se cobra al cerrar el mes.` });
    this.guardarFacc();
  },
  anotarAsedioTemp(f) {
    if (!f) return;
    const F = this.temporadaA();
    F.as[f] = (F.as[f] || 0) + 1;
    this.guardarFacc();
  },
  // Premio de la temporada que ya cerro (al entrar o al cerrarse con el jugador dentro).
  cobrarTemporada(s) {
    const c = s.c;
    const F = this.faccEstado();
    const ta = c.tempA;
    if (!ta || ta.mes === F.mes) return null;
    c.tempA = null;
    s.sucio = true;
    if (!(ta.p > 0)) return null;
    const h = (F.hist || []).find(x => x.mes === ta.mes);
    const tier = tierTemp(ta.p), gana = !!(h && h.ganador && h.ganador === c.faccion);
    const puesto = h ? h.top.indexOf(c.uid) : -1;
    const mult = multLogin(c.nivel), T = tier >= 0 ? TEMP_ABISMO[tier] : null;
    let oro = T ? T.oro * mult : 0, pociones = T ? T.pociones : 0;
    if (gana) oro = Math.round(oro * 1.5) + 500 * mult;
    if (puesto >= 0) oro += [6000, 4000, 2500][puesto] * mult;
    const items = [];
    if (T && T.item >= 0) items.push(this.darItem(s, this.generarItem(c.nivel, T.item)));
    if (puesto === 0 || (puesto > 0 && (!T || T.item < 3))) items.push(this.darItem(s, this.generarItem(c.nivel, puesto === 0 ? 3 : 2)));
    c.oro += oro;
    if (pociones) c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pociones);
    if (gana) c.tempGanadas = (c.tempGanadas || 0) + 1;
    if (puesto >= 0) c.tempTop = (c.tempTop || 0) + 1;
    if (puesto === 0) c.tempCampeon = (c.tempCampeon || 0) + 1;
    c.tempMejor = Math.max(c.tempMejor ?? -1, tier);
    const r = { t: 'tempFin', mes: ta.mes, p: ta.p, liga: T ? T.n : '', gana, ganador: h ? h.ganador : null, puesto, oro, pociones, items: items.map(nombreItem) };
    this.enviar(s, r);
    this.enviar(s, { t: 'toast', ok: true, m: `🏆 Temporada del Abismo ${ta.mes}: ${T ? 'liga ' + T.n + ' · ' : ''}+${oro.toLocaleString('es', { useGrouping: 'always' })} oro${items.length ? ' · ' + items.map(nombreItem).join(', ') : ''}.` });
    if (this.revisarLogros) this.revisarLogros(s, true);
    return r;
  },
  // Lo que ve el jugador: marcador, su liga, la anterior y el podio.
  infoTemp(c) {
    const F = this.temporadaA();
    const fin = Date.UTC(+F.mes.slice(0, 4), +F.mes.slice(5, 7), 1);   // 1 del mes siguiente
    const p = c.tempA && c.tempA.mes === F.mes ? c.tempA.p : 0, tier = tierTemp(p);
    const top = Object.entries(F.l).filter(([, x]) => x.p > 0).sort((a, b) => b[1].p - a[1].p).slice(0, 5)
      .map(([uid, x]) => ({ n: x.n, f: x.f, p: x.p, yo: uid === c.uid }));
    const ult = (F.hist || [])[0];
    return { t: 'temp3', mes: F.mes, fin, n: F.n, debil: this.debilAhora(), sc: this.puntuacionTemp(F), as: F.as, p, tier, top,
      ult: ult ? { mes: ult.mes, ganador: ult.ganador, tops: ult.tops } : null };
  },
  // Bono al unirse a la faccion con menos miembros (lo llama elegirFaccion antes de anotar).
  unirseFaccion(s, f) {
    const F = this.faccEstado(), c = s.c;
    const debil = this.debilAhora() === f;
    F.n[f] = (F.n[f] || 0) + 1;
    this.guardarFacc();
    if (!debil) return null;
    const mult = multLogin(c.nivel), oro = RECLUTA.oro * mult;
    c.oro += oro;
    const it = this.darItem(s, this.generarItem(c.nivel, RECLUTA.item));
    this.sumarPA(s, RECLUTA.pa, 'reclutamiento');
    this.enviar(s, { t: 'toast', ok: true, m: `🎖 Bono de reclutamiento por reforzar a los ${FACCIONES[f].titulo}: +${oro.toLocaleString('es', { useGrouping: 'always' })} oro y ${nombreItem(it)}. Mientras seáis menos, ganáis PA ×${String(FACC_BONO).replace('.', ',')}.` });
    return { oro, item: it };
  },
};
