// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — invita a un amigo
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada personaje tiene un codigo propio (c.ref, indice `ref:<codigo>` →
// uid en el storage). El enlace de Telegram pasa por el bot
// (t.me/duendequest_bot?start=mmo_<codigo>), que responde con el boton del
// MMO con ?ref=<codigo>; en la web el enlace es /mmo/?ref=<codigo>.
// Solo cuenta para personajes NUEVOS de cuentas reales (Telegram o web) y
// el premio llega cuando el amigo llega a nivel 10: asi no sirve crear
// cuentas vacias. Premios del juego (oro, titulo, montura). Nunca mTON.
// ═══════════════════════════════════════════════════════
import { AMIGO_NIVEL, premioAmigo, AMIGOS_MAX, KIT_COMP, AMIGO_BONO_XP, AMIGO_HITO, INVITADOS_MAX } from '../../mmo/js/data.js';
import { CONTACTOS_MAX, maxGrupo, pub } from './social.js';
import { MMO_URL } from '../api/telegram-bot.js';

const CODIGO = /^[a-z0-9]{6}$/;

export const Amigos = {
  async codigoRef(c) {
    if (c.ref) return c.ref;
    for (let i = 0; i < 5; i++) {
      const cod = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
      if (!(await this.state.storage.get('ref:' + cod))) {
        await this.state.storage.put('ref:' + cod, c.uid);
        c.ref = cod;
        return cod;
      }
    }
    return null;
  },

  // Al crear el personaje (o al heredar uno de invitado): quien lo invito, si
  // el codigo es valido. Tambien los invitados de la web: el premio igual
  // espera a nivel 10 y a una cuenta real (revisarAmigo).
  async anotarInvitacion(c, ref) {
    if (!CODIGO.test(ref || '') || c.invitadoPor) return;
    const de = await this.state.storage.get('ref:' + ref);
    if (!de || de === c.uid || (this.uidsPrueba && this.uidsPrueba.has(c.uid))) return;
    c.invitadoPor = de;
  },

  // Al entrar por primera vez con el enlace: los dos quedan en la lista de
  // amigos; si quien invito esta conectado le llega su invitacion de grupo y,
  // si no, un aviso por Telegram (solo si acepta avisos).
  async alLlegarInvitado(s) {
    const c = s.c, de = c.invitadoPor;
    // pjDe: si quien invito esta ENTRANDO se espera (si no, su guardado pisaba el contacto).
    const { s: otro, c: co } = await this.pjDe(de);
    if (!co) return;
    const add = (x, u, n) => { const l = x.contactos || (x.contactos = []); if (!l.some(a => a.u === u) && l.length < CONTACTOS_MAX) l.push({ u, n }); };
    add(c, de, co.nombre);
    s.sucio = true;
    this.darKitComp(s, co.nombre);
    if (!s.cerrado) this.enviarContactos(s);
    // Invitado sin cuenta (gratis de crear): solo entra en la lista de quien invito
    // si este esta conectado y como mucho 5 por hora. Si no, un bucle de invitados
    // con su ?ref= le llenaba la lista de amigos y gastaba escrituras.
    if (c.uid.startsWith('inv:')) {
      const h = Math.floor(Date.now() / 3600000);
      this._refInvH = this._refInvH && this._refInvH.h === h ? this._refInvH : { h, n: new Map() };
      const n = (this._refInvH.n.get(de) || 0) + 1;
      this._refInvH.n.set(de, n);
      if (n > 5) return;
      // Invitador desconectado: solo entra en «Mis invitados» (no en contactos) y
      // le queda un aviso en el buzon. Antes no se anotaba y veia «Mis invitados (0)».
      if (!otro) {
        const li = co.invitados || (co.invitados = []);
        if (li.some(a => a.u === c.uid)) return;
        li.push({ u: c.uid, n: c.nombre, t: Date.now() });
        if (li.length > INVITADOS_MAX) li.splice(0, li.length - INVITADOS_MAX);
        await this.state.storage.put('c:' + de, co);
        if (this.buzonAgregar) await this.buzonAgregar(de, '🤝 ' + c.nombre + ' entró con tu enlace. Jueguen juntos: a nivel ' + AMIGO_NIVEL + ' ganan oro los dos.', true);
        return;
      }
    }
    add(co, c.uid, c.nombre);
    // «Mis invitados» (infoAmigos): los ultimos INVITADOS_MAX que llegaron con su enlace.
    const li = co.invitados || (co.invitados = []);
    if (!li.some(a => a.u === c.uid)) { li.push({ u: c.uid, n: c.nombre }); if (li.length > INVITADOS_MAX) li.splice(0, li.length - INVITADOS_MAX); }
    if (otro) {
      otro.sucio = true; this.enviarContactos(otro);
      const g = this.grupoDe(otro);
      const invita = !s.cerrado && (!g || (g.lider === de && g.uids.length < maxGrupo(g)));
      this.enviar(otro, { t: 'toast', ok: true, m: `🤝 ${c.nombre} entró con tu enlace: ya está en tu lista de amigos${invita ? ' y le mandamos tu invitación de grupo' : ''}.` });
      if (invita) {
        s.invitacion = { de, hasta: Date.now() + 120000 };
        this.enviar(s, { t: 'invitacion', de: co.nombre, nv: co.nivel, cl: co.clase || '', ms: 120000 });
      }
    } else {
      await this.state.storage.put('c:' + de, co);
      // Un invitado sin cuenta no dispara avisos de Telegram (tokens de invitado sin fin = spam al invitador).
      if (!c.uid.startsWith('inv:') && await this.quiereAvisos(de)) { try { await this.tgEnviar('sendMessage', { chat_id: de.slice(3), text: `🤝 ${c.nombre} acaba de crear su duende con tu enlace y ya está en tu lista de amigos. Entra ahora y jueguen juntos en grupo.`, reply_markup: { inline_keyboard: [[{ text: '🌍 Jugar con mi amigo', web_app: { url: MMO_URL } }]] } }); } catch (e) {} }
    }
  },

  // Al subir de nivel: si llega a AMIGO_NIVEL, premio para los dos.
  async revisarAmigo(s) {
    const c = s.c;
    // Hito a mitad de camino (Nv 5): 3 pociones al invitado y un aviso a quien
    // lo invito si esta conectado (sin oro: no se farmea con cuentas vacias).
    if (c.invitadoPor && !c.refN5 && c.nivel >= AMIGO_HITO && c.nivel < AMIGO_NIVEL) {
      c.refN5 = 1; s.sucio = true;
      c.pw = c.pw || {}; c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + 3);
      const otro = this.porUid.get(c.invitadoPor);
      this.enviar(s, { t: 'toast', ok: true, m: `🤝 ¡Nivel ${AMIGO_HITO}! Vas a mitad de camino: +3 pociones. A nivel ${AMIGO_NIVEL} ganan oro los dos${otro && otro.c ? ` (tú y ${otro.c.nombre})` : ''}.` });
      if (otro && otro.c && !otro.cerrado) this.enviar(otro, { t: 'toast', ok: true, m: `🤝 Tu invitado ${c.nombre} llegó a nivel ${AMIGO_HITO}. A nivel ${AMIGO_NIVEL} ganan los dos: ¡ayúdalo en grupo (+25% de XP para él)!` });
      this.actualizarYo(s);
    }
    if (!c.invitadoPor || c.refPagado || c.nivel < AMIGO_NIVEL) return;
    // Solo cuentas reales: Telegram o correo confirmado. El invitado lo cobra
    // al registrarse (world.js lo vuelve a revisar al entrar).
    if (c.uid.startsWith('inv:') || !(c.uid.startsWith('tg:') || (s.uidAuth || '').startsWith('tg:') || (s.extraAuth && s.extraAuth.emailOk))) {
      // Una sola vez: que sepa como cobrar (antes salia en silencio).
      // 1 = avisado como invitado, 2 = avisado con cuenta (al heredar el duende se copia el 1 y aun falta el de confirmar correo).
      const inv = c.uid.startsWith('inv:'), tipo = inv ? 1 : 2;
      if (c.nivel >= AMIGO_NIVEL && !((c.refAvisoCta || 0) >= tipo)) {
        c.refAvisoCta = tipo; s.sucio = true;
        this.enviar(s, { t: 'toast', ok: true, m: inv ? '🤝 ¡Nivel ' + AMIGO_NIVEL + '! Tu premio de amigo y el de quien te invitó te esperan: crea tu cuenta gratis con Telegram o con tu correo (confirmado) y se cobran al entrar. Tu duende pasa a tu cuenta.' : '🤝 ¡Nivel ' + AMIGO_NIVEL + '! Confirma tu correo y vuelve a entrar para cobrar tu premio de amigo (y el de quien te invitó).' });
      }
      return;
    }
    // Nadie se cobra a si mismo (cuenta vinculada o heredada con su propio codigo).
    if (c.invitadoPor === c.uid || c.invitadoPor === s.uidAuth) { delete c.invitadoPor; s.sucio = true; return; }
    c.refPagado = true;
    if (this.refContar) this.refContar('refPagado');
    s.sucio = true;
    const pr = premioAmigo(c.nivel);
    c.oro += pr.oro;
    this.enviar(s, { t: 'toast', m: `Nivel ${AMIGO_NIVEL} alcanzado. Premio de invitado: +${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro.`, ok: true });
    // pjDe: si el invitador esta ENTRANDO se espera (si no, su guardado pisaba el premio).
    const { s: otro, c: co } = await this.pjDe(c.invitadoPor);
    if (!co) return;
    co.amigos = (co.amigos || 0) + 1;
    if (co.amigos <= AMIGOS_MAX) {
      const prO = premioAmigo(co.nivel);
      co.oro += prO.oro;
      // Al quinto amigo, una montura de regalo (si no la tenia ya).
      co.monturas = co.monturas || [];
      if (co.amigos === 5 && !co.monturas.includes('conejo')) co.monturas.push('conejo');
    }
    if (otro) { this.revisarLogros(otro); this.actualizarYo(otro); await this.guardar(otro); }
    else await this.state.storage.put('c:' + c.invitadoPor, co);
    const txtA = `🤝 ¡Tu amigo ${c.nombre} llegó a nivel ${AMIGO_NIVEL} en DUENDE QUEST ONLINE! Ganaste oro${co.amigos === 5 ? ' y el Conejo Saltarín de montura' : ''}. Amigos invitados: ${co.amigos}.`;
    if (otro) this.enviar(otro, { t: 'toast', m: txtA, ok: true });
    else if (this.buzonAgregar) await this.buzonAgregar(c.invitadoPor, txtA, true);   // "Mientras no estabas"
    if (await this.quiereAvisos(c.invitadoPor)) { try { await this.tgEnviar('sendMessage', { chat_id: c.invitadoPor.slice(3), text: txtA }); } catch (e) {} }
  },

  // Kit «Compañero» de una sola vez por personaje, con topes por dia: 10 por
  // codigo de quien invita y 3 por IP (en memoria; un reinicio los vacia, y el
  // kit es pequeño: oro y pociones). Ademas, la tarjeta de «a Nv 10 ganan los dos».
  darKitComp(s, deNombre) {
    const c = s.c;
    if (c.kitComp || (this.uidsPrueba && this.uidsPrueba.has(c.uid))) return;
    const d = Math.floor(Date.now() / 86400000);
    if (!this._kitComp || this._kitComp.d !== d) this._kitComp = { d, de: new Map(), ip: new Map() };
    const K = this._kitComp, nDe = (K.de.get(c.invitadoPor) || 0) + 1, nIp = s.ip ? (K.ip.get(s.ip) || 0) + 1 : 0;
    const txt = `🤝 ${deNombre} te invitó: a nivel ${AMIGO_NIVEL} ganan los dos (${premioAmigo(AMIGO_NIVEL).oro.toLocaleString('es', { useGrouping: 'always' })} de oro para ti). En grupo con tu amigo ganas +${Math.round(AMIGO_BONO_XP * 100)}% de XP hasta nivel ${AMIGO_NIVEL}.`;
    if (nDe > 10 || nIp > 3) { this.enviar(s, { t: 'toast', ok: true, m: txt }); return; }
    K.de.set(c.invitadoPor, nDe); if (s.ip) K.ip.set(s.ip, nIp);
    c.kitComp = 1;
    c.oro += KIT_COMP.oro;
    c.pw = c.pw || {}; c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + KIT_COMP.pociones);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🎁 Kit Compañero: +${KIT_COMP.oro} oro, +${KIT_COMP.pociones} pociones y el título «Compañero». ` + txt });
    this.revisarLogros(s);
    this.actualizarYo(s);
  },

  // +25% de XP de caza para el invitado de nivel < AMIGO_NIVEL si esta en el
  // mismo grupo que quien lo invito y este esta conectado (dar() en world.js).
  bonoCompanero(s) {
    const c = s.c;
    if (!c || !c.invitadoPor || c.nivel >= AMIGO_NIVEL || !s.gid) return 1;
    const o = this.porUid.get(c.invitadoPor);
    return o && o.c && !o.cerrado && o.gid === s.gid ? 1 + AMIGO_BONO_XP : 1;
  },

  // «Mis invitados»: nivel, si esta conectado y si ya llego a Nv 10. Los
  // desconectados se leen del storage en un solo get (como mucho 20).
  async infoAmigos(s) {
    const c = s.c;
    // Leer del storage como mucho cada 2 s (cada vez son hasta 20 personajes).
    const leer = Date.now() - (s.amigosT || 0) >= 2000;
    if (leer) s.amigosT = Date.now();
    const cod = await this.codigoRef(c);
    s.sucio = true;
    const li = (c.invitados || []).slice(-INVITADOS_MAX);
    const fuera = li.filter(a => !(this.porUid.get(a.u) || {}).c).map(a => 'c:' + a.u);
    // Entre lecturas se reusa la ultima (s.amigosG): si no, «Actualizar» seguido
    // mostraba a los desconectados sin nivel y a los ya borrados.
    let guard = s.amigosG || new Map();
    if (fuera.length && leer) try { guard = s.amigosG = await this.state.storage.get(fuera); } catch (e) {}
    const invitados = [];
    for (const a of li) {
      const x = this.porUid.get(a.u), cx = (x && x.c) || guard.get('c:' + a.u);
      // Invitado que ya no existe (heredado a una cuenta o borrado): se omite.
      if (!cx) { if (!leer) invitados.push({ n: a.n, lv: 0, on: 0, uid: pub(a.u) }); continue; }
      const on = !!(x && x.c && !x.cerrado);
      invitados.push({ n: cx.nombre || a.n, lv: cx.nivel || 1, cl: cx.clase || '', on: on ? 1 : 0, id: on ? x.id : undefined, g: on && x.gid ? 1 : 0, m3: on && x.m3 ? 1 : 0, ok: cx.refPagado ? 1 : 0, uid: pub(a.u) });
    }
    // Quien te invito (si sigue en tu lista de amigos): para la tarjeta de arriba.
    let por = null;
    if (c.invitadoPor && !c.refPagado) {
      const x = this.porUid.get(c.invitadoPor), ct = (c.contactos || []).find(a => a.u === c.invitadoPor);
      if (x && x.c) por = { n: x.c.nombre, on: x.cerrado ? 0 : 1, id: x.cerrado ? undefined : x.id, bono: this.bonoCompanero(s) > 1 ? 1 : 0 };
      else if (ct) por = { n: ct.n, on: 0 };
    }
    this.enviar(s, { t: 'amigos', ref: cod, amigos: c.amigos || 0, nivel: AMIGO_NIVEL, max: AMIGOS_MAX, invitados, por, bono: Math.round(AMIGO_BONO_XP * 100), lvYo: c.nivel });
  },
};
