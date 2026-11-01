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
import { AMIGO_NIVEL, premioAmigo, AMIGOS_MAX } from '../../mmo/js/data.js';
import { CONTACTOS_MAX, maxGrupo } from './social.js';
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
    if (!s.cerrado) this.enviarContactos(s);
    // Invitado sin cuenta (gratis de crear): solo entra en la lista de quien invito
    // si este esta conectado y como mucho 5 por hora. Si no, un bucle de invitados
    // con su ?ref= le llenaba la lista de amigos y gastaba escrituras.
    if (c.uid.startsWith('inv:')) {
      if (!otro) return;
      const h = Math.floor(Date.now() / 3600000);
      this._refInvH = this._refInvH && this._refInvH.h === h ? this._refInvH : { h, n: new Map() };
      const n = (this._refInvH.n.get(de) || 0) + 1;
      this._refInvH.n.set(de, n);
      if (n > 5) return;
    }
    add(co, c.uid, c.nombre);
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
    if (!c.invitadoPor || c.refPagado || c.nivel < AMIGO_NIVEL) return;
    // Solo cuentas reales: Telegram o correo confirmado. El invitado lo cobra
    // al registrarse (world.js lo vuelve a revisar al entrar).
    if (c.uid.startsWith('inv:') || !(c.uid.startsWith('tg:') || (s.uidAuth || '').startsWith('tg:') || (s.extraAuth && s.extraAuth.emailOk))) return;
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
    else if (this.buzonAgregar) await this.buzonAgregar(c.invitadoPor, txtA);   // "Mientras no estabas"
    if (await this.quiereAvisos(c.invitadoPor)) { try { await this.tgEnviar('sendMessage', { chat_id: c.invitadoPor.slice(3), text: txtA }); } catch (e) {} }
  },

  async infoAmigos(s) {
    const cod = await this.codigoRef(s.c);
    s.sucio = true;
    this.enviar(s, { t: 'amigos', ref: cod, amigos: s.c.amigos || 0, nivel: AMIGO_NIVEL, max: AMIGOS_MAX });
  },
};
