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

  // Al crear el personaje: quien lo invito (si el codigo es valido).
  async anotarInvitacion(c, ref) {
    if (!CODIGO.test(ref || '') || c.uid.startsWith('inv:')) return;
    const de = await this.state.storage.get('ref:' + ref);
    if (!de || de === c.uid) return;
    c.invitadoPor = de;
  },

  // Al subir de nivel: si llega a AMIGO_NIVEL, premio para los dos.
  async revisarAmigo(s) {
    const c = s.c;
    if (!c.invitadoPor || c.refPagado || c.nivel < AMIGO_NIVEL) return;
    c.refPagado = true;
    s.sucio = true;
    const pr = premioAmigo(c.nivel);
    c.oro += pr.oro;
    this.enviar(s, { t: 'toast', m: `Nivel ${AMIGO_NIVEL} alcanzado. Premio de invitado: +${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro.`, ok: true });
    const otro = this.porUid.get(c.invitadoPor);
    const co = otro ? otro.c : await this.state.storage.get('c:' + c.invitadoPor);
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
    if (await this.quiereAvisos(c.invitadoPor)) { try { await this.tgEnviar('sendMessage', { chat_id: c.invitadoPor.slice(3), text: txtA }); } catch (e) {} }
  },

  async infoAmigos(s) {
    const cod = await this.codigoRef(s.c);
    s.sucio = true;
    this.enviar(s, { t: 'amigos', ref: cod, amigos: s.c.amigos || 0, nivel: AMIGO_NIVEL, max: AMIGOS_MAX });
  },
};
