// ═══════════════════════════════════════════════════════
// DUENDE QUEST — el bot en el GRUPO oficial de Telegram (lado del webhook).
// Toda la logica y el estado viven en el Durable Object (functions/mmo/grupo.js);
// aqui solo se decide que actualizaciones de Telegram le interesan y se le
// pasan por /interno/grupo. Un mensaje normal del grupo NO llega al Durable
// Object: primero pasa el filtro puro motivoSpam() y solo se reenvia lo que
// parece spam (el Durable Object decide con la lista de administradores).
//
// Lo llama telegram-bot.js con UNA linea: si devuelve true, la actualizacion
// ya esta atendida.
// ═══════════════════════════════════════════════════════

import { motivoSpam } from '../mmo/grupo.js';

async function llamar(env, cuerpo) {
  try {
    const stub = env.MMO.get(env.MMO.idFromName('mundo-1'));
    const r = await stub.fetch('https://mmo/interno/grupo', { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: JSON.stringify(cuerpo) });
    return await r.json();
  } catch (e) { console.error('[Grupo webhook]', e); return null; }
}

const esGrupo = chat => !!chat && (chat.type === 'group' || chat.type === 'supergroup');
// Solo lo que hace falta para moderar (ni fotos ni archivos viajan al Durable Object).
const recorte = m => ({
  message_id: m.message_id, chat: { id: m.chat.id, type: m.chat.type },
  from: m.from ? { id: m.from.id, first_name: m.from.first_name, is_bot: m.from.is_bot } : null,
  sender_chat: m.sender_chat ? { id: m.sender_chat.id } : null, is_automatic_forward: !!m.is_automatic_forward,
  text: m.text, caption: m.caption, entities: m.entities, caption_entities: m.caption_entities,
  contact: m.contact ? { phone_number: m.contact.phone_number } : null,
  reply_markup: m.reply_markup && m.reply_markup.inline_keyboard ? { inline_keyboard: m.reply_markup.inline_keyboard } : null,
});
const ENTRA = ['member', 'administrator', 'creator'], FUERA = ['left', 'kicked'];

export async function grupoWebhook(body, context) {
  try {
    const env = context.env;
    if (!env || !env.MMO || !env.TELEGRAM_BOT_TOKEN || !body) return false;
    const dueno = String(env.ADMIN_TG_ID || '');

    // Botones del panel /grupo (solo el dueño).
    const cb = body.callback_query;
    if (cb) {
      if (!String(cb.data || '').startsWith('grp:')) return false;
      await llamar(env, { tipo: 'cb', id: cb.id, de: cb.from && cb.from.id, data: cb.data, chat: cb.message && cb.message.chat && cb.message.chat.id, msg: cb.message && cb.message.message_id });
      return true;
    }
    // Al bot lo sacaron o le cambiaron los permisos.
    if (body.my_chat_member) {
      const m = body.my_chat_member;
      if (esGrupo(m.chat)) await llamar(env, { tipo: 'bot', chat: m.chat.id, estado: m.new_chat_member && m.new_chat_member.status });
      return true;
    }
    // Entradas vistas por chat_member (solo llega si el webhook lo pide en allowed_updates).
    if (body.chat_member) {
      const m = body.chat_member, antes = m.old_chat_member || {}, ahora = m.new_chat_member || {};
      const entro = (FUERA.includes(antes.status) || (antes.status === 'restricted' && antes.is_member === false)) && (ENTRA.includes(ahora.status) || (ahora.status === 'restricted' && ahora.is_member !== false));
      if (entro && esGrupo(m.chat) && ahora.user) await llamar(env, { tipo: 'entra', chat: m.chat.id, users: [{ id: ahora.user.id, first_name: ahora.user.first_name, is_bot: ahora.user.is_bot }] });
      return true;
    }

    const msg = body.message || body.edited_message;
    if (!msg || !msg.chat) return false;
    const texto = String(msg.text || '').trim();

    // /grupo …: solo el dueño (a los demas, silencio). Un administrador anonimo
    // recibe la pista de que debe escribirlo sin el modo anonimo.
    if (body.message && /^\/grupo(?:@\w+)?(?:\s|$)/i.test(texto)) {
      const anon = esGrupo(msg.chat) && !!msg.sender_chat && msg.sender_chat.id === msg.chat.id;
      const esDueno = !!dueno && String(msg.from && msg.from.id) === dueno;
      if (!esDueno && !anon) return esGrupo(msg.chat);   // en privado sigue el flujo normal del bot
      await llamar(env, { tipo: 'cmd', de: msg.from && msg.from.id, anon, msgId: msg.message_id, txt: texto.replace(/^\/grupo(?:@\w+)?\s*/i, ''), chat: { id: msg.chat.id, type: msg.chat.type, title: msg.chat.title, username: msg.chat.username } });
      return true;
    }
    if (!esGrupo(msg.chat)) return false;

    // Alguien entro al grupo.
    if (body.message && Array.isArray(msg.new_chat_members) && msg.new_chat_members.length) {
      await llamar(env, { tipo: 'entra', chat: msg.chat.id, users: msg.new_chat_members.map(u => ({ id: u.id, first_name: u.first_name, is_bot: u.is_bot })) });
      return true;
    }
    // Antiespam. El dueño nunca; los demas administradores los comprueba el Durable Object.
    if (dueno && String(msg.from && msg.from.id) === dueno) return false;
    if (!motivoSpam(msg)) return false;
    const r = await llamar(env, { tipo: 'msg', msg: recorte(msg) });
    return !!(r && r.borrado);
  } catch (e) { console.error('[Grupo webhook]', e); return false; }
}
