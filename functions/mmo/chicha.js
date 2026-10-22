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

export const Chicha = {
  infoChicha(c) {
    const ch = c.chicha || {};
    return { p: ch.p || 0, hoy: ch.d === hoyUTC() ? ch.hoy || 0 : 0, rec: ch.rec || [] };
  },

  // Al cazar (desde dar()): 1 punto, 3 si el monstruo es de tu nivel o más,
  // 25 un jefe. Devuelve los puntos sumados (para el "+N 🥤" del cliente).
  sumarChicha(s, o) {
    const c = s.c;
    if (!o || c.nivel < CHICHA.nvPuntos || !this.elegibilidad(c).cuenta) return 0;
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
        this.enviar(s, { t: 'toast', m: `🥤 ¡${meta.toLocaleString('es')} puntos de chicha! Puedes reclamar tu litro de chicha morada en 🎒 → 🥤 CHICHA.`, ok: true });
      }
    }
    return n;
  },

  async reclamarChicha(s, m) {
    const c = s.c;
    const meta = CHICHA.niveles.includes(m.meta) ? m.meta : null;
    if (!meta) return;
    const ch = c.chicha || {};
    const el = this.elegibilidad(c);
    if (!el.cuenta) return this.no(s, 'Los premios físicos son solo para cuentas (entra con Telegram).');
    if (!c.uid.startsWith('tg:')) return this.no(s, 'Para coordinar el envío necesitamos tu Telegram: entra al juego desde @duendequest_bot.');
    if (c.nivel < CHICHA.nvReclamo) return this.no(s, `Puedes reclamar desde nivel ${CHICHA.nvReclamo}.`);
    if (!el.edad) return this.no(s, 'Tu personaje necesita al menos 2 días de vida para reclamar premios.');
    if ((ch.p || 0) < meta) return this.no(s, `Te faltan puntos: tienes ${(ch.p || 0).toLocaleString('es')} de ${meta.toLocaleString('es')}.`);
    if ((ch.rec || []).includes(meta)) return this.no(s, 'Ese premio ya lo reclamaste.');
    this.chichas = this.chichas || [];
    if (this.chichas.some(x => x.uid === c.uid && x.estado === 'pendiente')) return this.no(s, 'Ya tienes un reclamo esperando: el equipo te escribirá por Telegram.');
    const mes = mesUTC();
    const delMes = this.chichas.filter(x => x.mes === mes && x.estado !== 'rechazado').length;
    if (delMes >= CHICHA.mesMax) return this.no(s, 'Los litros de este mes ya se repartieron: guarda tus puntos y reclama el mes que viene (no se pierden).');
    ch.rec = [...(ch.rec || []), meta];
    c.chicha = ch;
    const r = { id: Math.random().toString(36).slice(2, 7).toUpperCase(), uid: c.uid, nombre: c.nombre, nivel: c.nivel, meta, puntos: ch.p, mes, creado: Date.now(), estado: 'pendiente' };
    this.chichas.push(r);
    if (this.chichas.length > 300) this.chichas = this.chichas.slice(-300);
    await this.state.storage.put('chichas', this.chichas);
    s.sucio = true;
    await this.guardar(s);
    this.actualizarYo(s);
    const tgId = c.uid.slice(3);
    this.avisarAdmin(`🥤 *Premio de chicha #${r.id}* — ${meta.toLocaleString('es')} puntos\n👤 ${c.nombre.replace(/[^\p{L}\p{N} ]/gu, '')} · Nv ${c.nivel} · ${c.kills} cazas\n📨 Contacto: [abrir chat](tg://user?id=${tgId}) (id ${tgId})\n\nEscríbele para pedirle la dirección. Al enviarlo: /chichaok ${r.id}\nSi es trampa o no se puede: /chichano ${r.id} motivo`);
    try { await this.tgEnviar('sendMessage', { chat_id: tgId, text: `🥤 ¡Reclamaste tu litro de chicha morada (premio de ${meta.toLocaleString('es')} puntos)! Código #${r.id}. El equipo de DUENDE QUEST te escribirá por Telegram para coordinar el envío. Nunca te pediremos pagos ni contraseñas.` }); } catch (e) {}
    this.enviar(s, { t: 'toast', m: `🥤 ¡Reclamo #${r.id} enviado! El equipo te escribirá por Telegram para coordinar la entrega.`, ok: true });
  },

  // Ordenes del dueño desde el bot: /chicha, /chichaok, /chichano.
  async internoChicha(accion, b) {
    this.chichas = this.chichas || [];
    if (accion === 'chichas') return { ok: true, pendientes: this.chichas.filter(x => x.estado === 'pendiente'), mes: this.chichas.filter(x => x.mes === mesUTC() && x.estado !== 'rechazado').length, mesMax: CHICHA.mesMax };
    const r = this.chichas.find(x => x.id === String(b.id || '').toUpperCase() && x.estado === 'pendiente');
    if (!r) return { ok: false, error: 'No hay un reclamo pendiente con ese código.' };
    r.estado = accion === 'chichaOk' ? 'enviado' : 'rechazado';
    r.cerrado = Date.now();
    if (b.motivo) r.motivo = String(b.motivo).slice(0, 200);
    // Rechazado sin ser trampa: puede volver a reclamarlo.
    if (r.estado === 'rechazado' && !b.trampa) {
      const s = this.porUid.get(r.uid);
      const c = s ? s.c : await this.state.storage.get('c:' + r.uid);
      if (c && c.chicha) {
        c.chicha.rec = (c.chicha.rec || []).filter(x => x !== r.meta);
        if (s) { s.sucio = true; this.actualizarYo(s); } else await this.state.storage.put('c:' + r.uid, c);
      }
    }
    await this.state.storage.put('chichas', this.chichas);
    const txt = r.estado === 'enviado' ? `🥤 ¡Tu litro de chicha morada (#${r.id}) va en camino! Gracias por jugar DUENDE QUEST ONLINE.` : `🥤 Tu reclamo de chicha #${r.id} no se pudo completar${r.motivo ? ': ' + r.motivo : ''}.`;
    try { await this.tgEnviar('sendMessage', { chat_id: r.uid.slice(3), text: txt }); } catch (e) {}
    return { ok: true, chicha: r };
  },
};
