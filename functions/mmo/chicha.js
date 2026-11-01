// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — premio físico: un litro de chicha morada
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada monstruo que cazas suelta SIEMPRE su 🥤 con puntos (no es al azar:
// un premio físico por suerte se parece a un sorteo, que en Perú necesita
// autorización). Con CHICHA.niveles[i] puntos se reclama un litro, que el
// dueño envía a mano: el bot le avisa con el contacto de Telegram del
// ganador y él coordina la dirección por privado. El juego NO guarda
// direcciones. Frenos contra bots: solo cuentas reales, puntos desde Nv 10,
// tope diario, reclamar desde Nv 15 con 48 h de personaje, Telegram
// obligatorio para el envío, aprobación manual y un tope de litros al mes.
// Los puntos no se compran, no se venden y no se gastan al reclamar.
// ═══════════════════════════════════════════════════════
import { CHICHA, MONSTRUOS, hoyUTC } from '../../mmo/js/data.js';

const mesUTC = () => new Date().toISOString().slice(0, 7);
// Desde aqui se miden los minutos jugados (c.tjs): los personajes nuevos empiezan en 0.
const TJS_DESDE = Date.UTC(2026, 10, 2);

export const Chicha = {
  infoChicha(c) {
    const ch = c.chicha || {};
    // dj / mj: días y minutos jugados (los requisitos del premio de Nv 60, para la lista del panel).
    return { p: ch.p || 0, hoy: ch.d === hoyUTC() ? ch.hoy || 0 : 0, rec: ch.rec || [], dj: (c.login || {}).total || 0, mj: Math.floor(this.segJugados(c) / 60) };
  },

  // Segundos de juego activo (los suma el tick de 10 s de world.js). Los personajes de
  // antes de medirlo arrancan con 45 min por día que entraron (tope CHICHA.min60): no se
  // les castiga por un dato que no existía.
  segJugados(c) {
    if (typeof c.tjs !== 'number') c.tjs = (c.creado || 0) >= TJS_DESDE ? 0 : Math.min(CHICHA.min60, ((c.login || {}).total || 0) * 45) * 60;
    return c.tjs;
  },
  sumarJugado(c, seg) { c.tjs = this.segJugados(c) + seg; },
  // Primeras 3 cazas con Nv < 10: el cliente enseña «🔒 🥤 desde Nv 10» (que se sepa desde el minuto 1).
  candadoChicha(c) { return c.nivel < CHICHA.nvPuntos && (c.kills || 0) <= 3; },
  // Lo que falta para el premio de Nv 60 (lista vacía = cumple).
  faltan60(c) {
    const f = [], dj = (c.login || {}).total || 0, mj = Math.floor(this.segJugados(c) / 60);
    if (dj < CHICHA.dias60) f.push(`${CHICHA.dias60} días jugados (llevas ${dj})`);
    if (mj < CHICHA.min60) f.push(`${Math.round(CHICHA.min60 / 60)} horas de juego (llevas ${Math.floor(mj / 60)})`);
    return f;
  },

  // Al cazar (desde dar()): 1 punto, 3 si el monstruo es de tu nivel o más,
  // 25 un jefe. Devuelve los puntos sumados (para el "+N 🥤" del cliente).
  sumarChicha(s, o) {
    const c = s.c;
    if (!o || c.nivel < CHICHA.nvPuntos || !this.elegibilidad(c).cuenta) return 0;
    // Premio real: solo quien pego o curo en esa pelea (el compañero de grupo que mira no suma).
    if (o.dano instanceof Map && !o.dano.has(s.id) && !(o.cura instanceof Map && o.cura.has(s.id))) return 0;
    const ch = c.chicha || (c.chicha = { p: 0, d: '', hoy: 0, rec: [] });
    const hoy = hoyUTC();
    if (ch.d !== hoy) { ch.d = hoy; ch.hoy = 0; }
    const nvM = o.nv || (MONSTRUOS[o.k] && MONSTRUOS[o.k].nivel) || 1;
    let n = o.jefe ? 25 : nvM >= c.nivel ? 3 : 1;
    n = Math.min(n, CHICHA.porDia - ch.hoy);
    if (n <= 0) return 0;
    ch.hoy += n; ch.p += n;
    if (ch.hoy >= CHICHA.porDia) this.enviar(s, { t: 'toast', m: `🥤 Llegaste al tope de ${CHICHA.porDia} puntos de chicha de hoy. Mañana sigues sumando.` });
    // Aviso al cruzar un nivel de premio.
    for (const meta of CHICHA.niveles) {
      if (ch.p >= meta && ch.p - n < meta && !(ch.rec || []).includes(meta)) {
        this.enviar(s, { t: 'toast', m: `${meta.toLocaleString('es', { useGrouping: 'always' })} puntos de chicha. Reclama tu litro de chicha morada en ${s.m3 ? 'la barra morada 🥤 de la pantalla' : 'Inventario → «Chicha»'}.`, ok: true });
      }
    }
    return n;
  },

  async reclamarChicha(s, m) {
    const c = s.c;
    // meta: puntos (10.000 / 50.000) o 'nv60' (2 litros por llegar a nivel 60).
    const meta = CHICHA.niveles.includes(m.meta) ? m.meta : m.meta === 'nv60' ? 'nv60' : null;
    if (!meta) return;
    const es60 = meta === 'nv60';
    const ch = c.chicha || {};
    const el = this.elegibilidad(c);
    if (!el.cuenta) return this.no(s, 'Los premios físicos son solo para cuentas (entra con Telegram).');
    if (!c.uid.startsWith('tg:')) return this.no(s, 'Para coordinar el envío necesitamos tu Telegram: entra al juego desde @duendequest_bot.');
    if (c.nivel < CHICHA.nvReclamo) return this.no(s, `Puedes reclamar desde nivel ${CHICHA.nvReclamo}.`);
    if (!el.edad) return this.no(s, 'Tu personaje necesita al menos 2 días de vida para reclamar premios.');
    if (es60 && c.nivel < CHICHA.nv60) return this.no(s, `Los ${CHICHA.litros60} litros de chicha son para quien llega a nivel ${CHICHA.nv60}. ¡Te faltan ${CHICHA.nv60 - c.nivel}!`);
    // Nv 60 blindado: además del nivel, tiempo de juego real (un bot que sube en 3 días no llega).
    const faltan = es60 ? this.faltan60(c) : [];
    if (faltan.length) return this.no(s, '🥤 Para los ' + CHICHA.litros60 + ' litros te falta: ' + faltan.join(' y ') + '. ¡Sigue jugando!');
    if (!es60 && (ch.p || 0) < meta) return this.no(s, `Te faltan puntos: tienes ${(ch.p || 0).toLocaleString('es', { useGrouping: 'always' })} de ${meta.toLocaleString('es', { useGrouping: 'always' })}.`);
    if ((ch.rec || []).includes(meta)) return this.no(s, 'Ese premio ya lo reclamaste.');
    this.chichas = this.chichas || [];
    if (this.chichas.some(x => x.uid === c.uid && x.estado === 'pendiente')) return this.no(s, 'Ya tienes un reclamo esperando: el equipo te escribirá por Telegram.');
    const mes = mesUTC();
    const delMes = this.chichas.filter(x => x.mes === mes && x.meta !== 'nv60' && x.estado !== 'rechazado').length;   // los de Nv 60 llevan su propio tope (mesMax60)
    if (!es60 && delMes >= CHICHA.mesMax) return this.no(s, 'Los litros de este mes ya se repartieron: guarda tus puntos y reclama el mes que viene (no se pierden).');
    // Nv 60 con su propio tope al mes: si está lleno, el reclamo entra EN COLA (se entrega el mes siguiente).
    const cola = es60 && this.chichas.filter(x => x.mes === mes && x.meta === 'nv60' && !x.cola && x.estado !== 'rechazado').length >= CHICHA.mesMax60;
    ch.rec = [...(ch.rec || []), meta];
    c.chicha = ch;
    const r = { id: Math.random().toString(36).slice(2, 7).toUpperCase(), uid: c.uid, nombre: c.nombre, nivel: c.nivel, meta, litros: es60 ? CHICHA.litros60 : 1, puntos: ch.p, mes, creado: Date.now(), estado: 'pendiente', cola: cola || undefined };
    this.chichas.push(r);
    if (this.chichas.length > 300) this.chichas = this.chichas.slice(-300);
    await this.state.storage.put('chichas', this.chichas);
    s.sucio = true;
    await this.guardar(s);
    this.actualizarYo(s);
    const tgId = c.uid.slice(3);
    // Para el dueño: horas, días y si subió sospechosamente rápido (menos de 21 días de vida o de 50 h).
    const hJ = Math.floor(this.segJugados(c) / 3600), dJ = (c.login || {}).total || 0, vida = Math.floor((Date.now() - (c.creado || Date.now())) / 86400000);
    const rapido = es60 && (vida < 21 || hJ < 50) ? ' ⚠️ rápido' : '';
    const queEs = es60 ? `${CHICHA.litros60} litros por llegar a nivel ${CHICHA.nv60}` : `${meta.toLocaleString('es', { useGrouping: 'always' })} puntos`;
    this.avisarAdmin(`🥤 *Premio de chicha #${r.id}* — ${queEs}\n👤 ${c.nombre.replace(/[^\p{L}\p{N} ]/gu, '')} · Nv ${c.nivel} · ${c.kills} cazas\n⏱ ${hJ} h jugadas · ${dJ} días jugados · ${vida} días de vida${rapido}${cola ? '\n⏳ EN COLA: el tope de Nv 60 de este mes está lleno, entrégalo el mes que viene.' : ''}\n📨 Contacto: [abrir chat](tg://user?id=${tgId}) (id ${tgId})\n\nEscríbele para pedirle la dirección. Al enviarlo: /chichaok ${r.id}\nSi es trampa o no se puede: /chichano ${r.id} motivo`);
    try { await this.tgEnviar('sendMessage', { chat_id: tgId, text: `🥤 ¡Reclamaste ${es60 ? `tus ${CHICHA.litros60} litros` : 'tu litro'} de chicha morada (${queEs})! Código #${r.id}. ${cola ? 'Este mes ya se repartieron los premios de nivel 60: quedas EN COLA y se envía el mes que viene. ' : ''}El equipo de DUENDE QUEST te escribirá por Telegram para coordinar el envío (solo dentro del Perú). Nunca te pediremos pagos ni contraseñas.` }); } catch (e) {}
    this.enviar(s, { t: 'toast', m: `Reclamo #${r.id} enviado${cola ? ' (en cola para el mes que viene)' : ''}. Te escribiremos por Telegram para coordinar la entrega.`, ok: true });
  },

  // Ordenes del dueño desde el bot: /chicha, /chichaok, /chichano.
  async internoChicha(accion, b) {
    this.chichas = this.chichas || [];
    if (accion === 'chichas') return { ok: true, pendientes: this.chichas.filter(x => x.estado === 'pendiente'), mes: this.chichas.filter(x => x.mes === mesUTC() && x.meta !== 'nv60' && x.estado !== 'rechazado').length, mesMax: CHICHA.mesMax, mes60: this.chichas.filter(x => x.mes === mesUTC() && x.meta === 'nv60' && !x.cola && x.estado !== 'rechazado').length, mesMax60: CHICHA.mesMax60 };
    const r = this.chichas.find(x => x.id === String(b.id || '').toUpperCase() && x.estado === 'pendiente');
    if (!r) return { ok: false, error: 'No hay un reclamo pendiente con ese código.' };
    r.estado = accion === 'chichaOk' ? 'enviado' : 'rechazado';
    r.cerrado = Date.now();
    if (b.motivo) r.motivo = String(b.motivo).slice(0, 200);
    // Rechazado sin ser trampa: puede volver a reclamarlo.
    if (r.estado === 'rechazado' && !b.trampa) {
      const { s, c } = await this.pjDe(r.uid);
      if (c && c.chicha) {
        c.chicha.rec = (c.chicha.rec || []).filter(x => x !== r.meta);
        if (s) { s.sucio = true; this.actualizarYo(s); } else await this.state.storage.put('c:' + r.uid, c);
      }
    }
    await this.state.storage.put('chichas', this.chichas);
    const txt = r.estado === 'enviado' ? `🥤 ¡${(r.litros || 1) > 1 ? `Tus ${r.litros} litros` : 'Tu litro'} de chicha morada (#${r.id}) va en camino! Gracias por jugar DUENDE QUEST ONLINE.` : `🥤 Tu reclamo de chicha #${r.id} no se pudo completar${r.motivo ? ': ' + r.motivo : ''}.`;
    try { await this.tgEnviar('sendMessage', { chat_id: r.uid.slice(3), text: txt }); } catch (e) {}
    return { ok: true, chicha: r };
  },
};
