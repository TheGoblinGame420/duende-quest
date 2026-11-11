// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Telegram Bot Webhook (Cloudflare Pages Function)
// ═══════════════════════════════════════════════════════

import { supabaseQuery, isFirstPurchase } from './lib.js';
import { textoPagoRecibido, ENTREGA } from '../../mmo/js/data.js';
import { grupoWebhook } from './grupo.js';

const WEBAPP_URL = 'https://duende-quest.alfonso12hc.workers.dev/telegram/index.html';
const SITE_URL = 'https://duende-quest.alfonso12hc.workers.dev';
// Exportada: los avisos de vuelta del MMO (functions/mmo/retencion.js) usan la misma.
export const MMO_URL = 'https://duende-quest.alfonso12hc.workers.dev/mmo/';
// El mundo abierto en 3D (el mismo personaje y servidor que el MMO).
export const MUNDO_URL = 'https://duende-quest.alfonso12hc.workers.dev/mundo/';
// El creador del juego y sus canales oficiales: se muestran en /start y
// /creador para que cualquiera pueda comprobar quién está detrás del juego.
const CREADOR_TG = 'https://t.me/ElDuendeOficial';
// Los dos unicos numeros oficiales (seguridad.html#numeros). El bot solo los muestra si le preguntan.
const WA_CREADOR = 'https://wa.me/51900877863';
const WA_CHICHA = 'https://wa.me/51916778731';
const TEXTO_WHATSAPP = '💬 *Habla con el creador (WhatsApp):* +51 900 877 863\n🥤 *La chicha (WhatsApp):* +51 916 778 731\nSon los únicos números oficiales.';
const BOTONES_WHATSAPP = [[{ text: '💬 WhatsApp del creador', url: WA_CREADOR }], [{ text: '🥤 WhatsApp de la chicha', url: WA_CHICHA }]];
const CANAL_TG = 'https://t.me/elduende420peru';
const GRUPO_TG = 'https://t.me/duendesolana420';
const TEXTO_CREADOR = '👤 *Creador:* @ElDuendeOficial\n📢 *Canal oficial:* t.me/elduende420peru\n💬 *Grupo oficial:* t.me/duendesolana420';
const BOTONES_CREADOR = [
  [{ text: '👤 Creador: @ElDuendeOficial', url: CREADOR_TG }],
  [{ text: '📢 Canal oficial', url: CANAL_TG }, { text: '💬 Grupo oficial', url: GRUPO_TG }],
];
// Seguridad: la misma frase en /start, /help y /mmo, y la pagina que la explica.
// La URL no lleva guiones bajos: se puede poner tal cual en mensajes Markdown.
const SEGURIDAD_URL = SITE_URL + '/seguridad.html';
const TEXTO_SEGURIDAD = '🔒 Nunca te pediremos contraseñas, frases semilla ni pagos por mensaje privado.';
const BOTON_SEGURIDAD = [{ text: '🔒 Seguridad', url: SEGURIDAD_URL }];
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';
// Trailer de la portada (assets/video/; cambiar el numero al regenerarlo).
const TRAILER_URL = 'https://duende-quest.alfonso12hc.workers.dev/assets/video/trailer-2.mp4';
const PUMP_FUN_URL = 'https://pump.fun/coin/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';

function getEnv(context) {
  return {
    BOT_TOKEN: context.env.TELEGRAM_BOT_TOKEN,
    SUPABASE_URL: context.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co',
    SUPABASE_KEY: context.env.SUPABASE_SERVICE_KEY || context.env.SUPABASE_ANON_KEY || '',
    DISCORD_WEBHOOK_URL: context.env.DISCORD_WEBHOOK_URL || '',
    // mmoInterno(env) los necesita: sin ellos /yo, /topmmo y /stats sin perfil daban siempre error.
    MMO: context.env.MMO,
    TELEGRAM_BOT_TOKEN: context.env.TELEGRAM_BOT_TOKEN,
  };
}

async function postDiscord(env, content) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  try {
    const r = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return r.ok;
  } catch (e) { return false; }
}

async function tg(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// supabaseQuery: la de lib.js (con tope de 5 s y sin lanzar si no es JSON).

const PUMP_API = 'https://frontend-api-v3.pump.fun/coins/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';

async function getPrice() {
  try {
    const r = await fetch(PUMP_API, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d && d.usd_market_cap) {
      const mcap = parseFloat(d.usd_market_cap || 0);
      const price = mcap / 1_000_000_000;
      return { priceUsd: price, priceChange24h: 0, volume24h: 0, marketCap: mcap, liquidity: parseFloat(d.virtual_sol_reserves || 0) / 1e9 * 82, source: 'pump.fun' };
    }
  } catch (e) {}
  try {
    const r = await fetch(DEXSCREENER_URL, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const pair = d?.pairs?.[0];
    if (!pair) return null;
    return { priceUsd: parseFloat(pair.priceUsd || 0), priceChange24h: parseFloat(pair.priceChange?.h24 || 0), volume24h: parseFloat(pair.volume?.h24 || 0), marketCap: parseFloat(pair.marketCap || pair.fdv || 0), liquidity: parseFloat(pair.liquidity?.usd || 0), source: 'DexScreener' };
  } catch (e) { return null; }
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

// ── Stars pricing ──
const STAR_USD = 0.013;
const STARS_PACKAGES = [
  { label: 'Básico', usd: 10 },
  { label: 'Estándar', usd: 25 },
  { label: 'Grande', usd: 50 },
  { label: 'Máximo', usd: 100 },
];

function calcStarsPackages(priceUsd) {
  if (!priceUsd || priceUsd <= 0) priceUsd = 0.0000001;
  return STARS_PACKAGES.map(pkg => {
    const stars = Math.ceil(pkg.usd / STAR_USD);
    const tokens = Math.floor(pkg.usd / priceUsd);
    return { ...pkg, stars, tokens };
  });
}

// ¿Primera compra? isFirstPurchase vive en lib.js (la misma que usa la factura).

async function createStarsInvoice(token, env, pkgIndex, tgId) {
  // Paquete inexistente (buy_99 a mano): ni se consulta el precio.
  if (!(pkgIndex >= 0 && pkgIndex < STARS_PACKAGES.length)) return;
  const price = await getPrice();
  // Sin precio real no se factura (el respaldo fijo daba ~20x mas tokens). En
  // el webhook se acredita como mucho lo de la factura (payload.tokens).
  const priceUsd = price?.priceUsd;
  if (!priceUsd || priceUsd <= 0) return;
  const packages = calcStarsPackages(priceUsd);
  const pkg = packages[pkgIndex];
  if (!pkg) return;
  const firstBuy = await isFirstPurchase(env, tgId);
  const tokens = firstBuy ? pkg.tokens * 2 : pkg.tokens;
  const result = await tg(token, 'createInvoiceLink', {
    // Telegram rechaza la factura si el titulo pasa de 32 caracteres.
    title: `${pkg.label}${firstBuy ? ' x2' : ''} · ${tokens.toLocaleString()} $DUENDE`.slice(0, 32),
    description: `${firstBuy ? 'Primera compra: cantidad doble. ' : ''}${tokens.toLocaleString()} tokens $DUENDE por ${pkg.stars} Stars (~$${pkg.usd} USD). Entrega a mano en máx. ${ENTREGA.plazoMaxH} h.`,
    payload: JSON.stringify({ pkg: pkgIndex, tokens, usd: pkg.usd, first_buy: firstBuy }),
    currency: 'XTR',
    prices: [{ label: `${tokens.toLocaleString()} $DUENDE`, amount: pkg.stars }],
  });
  return result?.result;
}

// ═══════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════

// Trailer ya enviado (por isolate): un /start en bucle de alguien sin perfil
// mandaba el video cada vez. Desde el boton Menu no se manda nunca.
const trailerEnviado = new Set();

async function handleStart(token, env, chatId, user, startPayload, desdeMenu) {
  const tgId = String(user.id);
  // SEGURIDAD: aqui habia un PATCH que movia a este telegram_id el perfil
  // cuyo username coincidiera con user.username || user.first_name. El
  // first_name lo elige cualquiera en Telegram, asi que bastaba con llamarse
  // como la victima y mandar /start para quedarse con su perfil y su saldo.
  // La vinculacion ya la hace link_profile (wallet.js) con initData verificado.
  let profiles = [];
  try { profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=id`); } catch(e) {}
  const esNuevo = !Array.isArray(profiles) || profiles.length === 0;
  // El referido solo cuenta para usuarios que aun no tenian perfil: antes dos
  // jugadores existentes podian referirse el uno al otro y cobrar 2000.
  if (esNuevo && startPayload && startPayload.startsWith('ref_')) {
    await handleReferral(token, env, startPayload.replace('ref_', ''), user);
  }
  const referralLink = `https://t.me/duendequest_bot?start=ref_${user.id}`;
  // A quien llega por primera vez: el trailer de 30 s (juego real, generado con
  // tools/promo/) antes de la bienvenida. Si falla, la bienvenida sale igual.
  if (esNuevo && !desdeMenu && !trailerEnviado.has(tgId)) {
    if (trailerEnviado.size > 5000) trailerEnviado.clear();
    trailerEnviado.add(tgId);
    try { await tg(token, 'sendVideo', { chat_id: chatId, video: TRAILER_URL, caption: '🎬 Así se juega DUENDE QUEST (30 s de juego real)', supports_streaming: true }); } catch (e) {}
  }
  // Al que llega nuevo (de un anuncio o invitado con ref_), un mensaje corto y
  // tres botones: el muro de texto con cripto y 13 botones lo espantaba. El
  // menu completo sigue en «⌂ Más opciones» (callback 'menu' -> desdeMenu).
  if (esNuevo && !desdeMenu) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: `🧌 *¡Bienvenido a DUENDE QUEST, ${mdSeguro(user.first_name || 'Duende')}!*\n\nRPG de duendes gratis y sin descargas: elige tu clase, sube de nivel y explora con tus amigos.\n\n${TEXTO_SEGURIDAD}`,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [
        [{ text: '🎮 Jugar gratis (3D)', web_app: { url: MUNDO_URL } }],
        [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL } }],
        [{ text: '⌂ Más opciones', callback_data: 'menu' }],
      ]},
    });
    return;
  }
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `🧌 *Bienvenido a DUENDE QUEST, ${mdSeguro(user.first_name || 'Duende')}*\n\nJuego de duendes gratis y sin descargas: juega aquí en Telegram o en el navegador.\n\n🌌 *ORIGINS 3D:* mundo abierto con alas, cueva y PvP, gratis en el celular.\n🎮 *Arcade:* campaña de 15 etapas con jefes y ranking global.\n🌍 *DUENDE QUEST ONLINE:* MMORPG estilo WoW con 4 clases, grupos, mazmorras con jefes, hermandades y 10 zonas hasta el nivel 60.\n🥤 *Premio:* junta 25.000 puntos cazando en el MMO y te enviamos un litro de chicha morada a tu casa. No es un sorteo: lo ganas jugando.\n💎 *Recompensas en TON (opcional):* desde el nivel 15, los jefes del MMO dan mTON del fondo del día, si lo hay (1.000 mTON = 1 TON). Retiro desde 5 TON.\n🪙 *$DUENDE:* token del juego en Solana; también se gana jugando.\n\n${TEXTO_SEGURIDAD}\nMás información: ${SEGURIDAD_URL}\n\n${TEXTO_CREADOR}\n\n*Invita a un amigo* (500 $DUENDE para cada uno):\n\`${referralLink}\``,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [
      [{ text: '🎮 Jugar gratis (3D)', web_app: { url: MUNDO_URL } }],
      [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL } }],
      [{ text: '🕹 Arcade', web_app: { url: WEBAPP_URL } }],
      [{ text: '🏆 Ranking', callback_data: 'ranking' }, { text: '📊 Mis estadísticas', callback_data: 'stats' }],
      [{ text: '🎁 Invitar amigos', callback_data: 'referral' }, { text: '💹 Precio', callback_data: 'price' }],
      [{ text: '⭐ Comprar con Stars', callback_data: 'buy' }, { text: '🪙 Pump.fun', url: PUMP_FUN_URL }],
      ...BOTONES_CREADOR,
      BOTON_SEGURIDAD,
    ]},
  });
}

// Los nombres del ranking los escriben los jugadores: un nombre con * _ [ `
// rompia el Markdown (Telegram rechazaba el mensaje y /ranking dejaba de
// funcionar para todos) o colaba un enlace en un mensaje oficial del bot.
// Ademas Telegram vuelve clicable cualquier @usuario, dominio o t.me/... del
// texto (un first_name '@SoporteVIP' salia como enlace en el aviso de
// referido o en el Top 10): solo letras, numeros y espacios, como world.js.
const mdTexto = t => String(t || '').replace(/[*_\[\]`]/g, '').slice(0, 60);   // nombres de compra: sin recortar a 20 ni quitar '$'
function mdSeguro(t) { return String(t || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20) || '?'; }

async function handleRanking(token, env, chatId, messageId) {
  const rows = await supabaseQuery(env, 'game_scores?verified=is.true&select=username,score,wave&order=score.desc&limit=50');
  // Una entrada por jugador: su mejor score
  const best = new Map();
  if (Array.isArray(rows)) for (const s of rows) { const k = (s.username || '?').toLowerCase(); if (!best.has(k) || s.score > best.get(k).score) best.set(k, s); }
  const scores = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  let text = '🏆 *Top 10 — DUENDE QUEST*\n\n';
  if (scores.length === 0) text += '_Aún no hay puntuaciones._';
  else { const medals = ['🥇','🥈','🥉']; scores.forEach((s,i) => { text += `${medals[i]||`${i+1}.`} *${mdSeguro(s.username)}* — ${s.score.toLocaleString()} pts (oleada ${s.wave})\n`; }); }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar (3D)', web_app: { url: MUNDO_URL } }, { text: '🕹 Arcade', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'ranking' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

// Rankings de la semana del MMO (nombres y marcas; nada privado).
async function handleTopMmo(token, env, chatId, messageId) {
  let r = null;
  try { r = await mmoInterno(env, 'tops'); } catch (e) {}
  const med = i => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
  let text = '🌍 *DUENDE QUEST ONLINE — esta semana*\n';
  if (!r || !r.ok) text += '\n_No se pudo leer el ranking ahora. Prueba en un momento._';
  else {
    text += `\n🏆 *Experiencia*\n` + (r.xp.length ? r.xp.map((x, i) => `${med(i)} *${mdSeguro(x.n)}* — ${x.xp.toLocaleString('es')} XP (Nv ${x.lv})`).join('\n') : '_Nadie aún._');
    text += `\n\n🗼 *Torre del Duende*\n` + (r.torre.length ? r.torre.map((x, i) => `${med(i)} *${mdSeguro(x.n)}* — piso ${x.p}`).join('\n') : '_Nadie ha subido aún._');
    if (r.des.length) text += `\n\n⚡ *Desafíos*\n` + r.des.map((x, i) => `${med(i)} *${mdSeguro(x.n)}* — +${x.k}`).join('\n');
    if (r.herm && r.herm.length) text += `\n\n🛡️ *Hermandades (gesta)*\n` + r.herm.map((x, i) => `${med(i)} *${mdSeguro(x.n)}* — ${x.p.toLocaleString('es')} pts`).join('\n');
    text += `\n\n⚔️ *Duelos (Elo)*\n` + (r.duel.length ? r.duel.map((x, i) => `${med(i)} *${mdSeguro(x.n)}* — ${x.e}`).join('\n') : '_Nadie aún._');
    text += `\n\n👥 Ahora mismo: ${r.online} en línea. Los 3 primeros de la Torre y de Desafíos se llevan oro y título el lunes.`;
  }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌌 Entrar en 3D', web_app: { url: MUNDO_URL } }], [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL } }], [{ text: '🔄 Actualizar', callback_data: 'topmmo' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts).catch(() => {}); } else await tg(token, 'sendMessage', opts);
}

async function handlePrice(token, chatId, messageId) {
  const p = await getPrice();
  let text;
  if (!p || p.priceUsd === 0) text = '💹 *$DUENDE — Precio*\n\n_No se pudo obtener el precio ahora. Inténtalo en un momento._';
  else { const arrow = p.priceChange24h >= 0 ? '📈' : '📉'; text = `💹 *$DUENDE — Precio de mercado*\n\nPrecio: *$${p.priceUsd.toFixed(8)}*\n${arrow} 24h: *${p.priceChange24h >= 0 ? '+' : ''}${p.priceChange24h.toFixed(2)}%*\nVolumen 24h: *$${fmtNum(p.volume24h)}*\nCapitalización: *$${fmtNum(p.marketCap)}*\nLiquidez: *$${fmtNum(p.liquidity)}*\n\nFuente: ${p.source}. El precio puede subir o bajar mucho; no es una inversión ni una recomendación.`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🪙 Ver $DUENDE en Pump.fun', url: PUMP_FUN_URL }], [{ text: '⭐ Comprar con Stars (/buy)', callback_data: 'buy' }], [{ text: '🔄 Actualizar', callback_data: 'price' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleStats(token, env, chatId, userId, messageId) {
  const tgId = String(userId);
  let profiles; try { profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=username,best_score,best_wave,total_coins,games_played,duende_balance`); } catch(e) { profiles = []; }
  // Sin perfil del arcade: es jugador de ORIGINS/CLASSIC, se le muestra su duende del MMO.
  if (!Array.isArray(profiles) || profiles.length === 0) return handleYo(token, env, chatId, userId);
  let text;
  if (!Array.isArray(profiles) || profiles.length === 0) text = '📊 *Tus estadísticas*\n\n_Aún no tienes perfil. Juega una partida para crearlo._';
  else { const p = profiles[0]; text = `📊 *Estadísticas de ${mdSeguro(p.username||'Duende')}*\n\n🏆 Mejor puntuación: *${Number(p.best_score||0).toLocaleString()}*\n🌊 Mejor oleada: *${p.best_wave||0}*\n🪙 Monedas: *${Number(p.total_coins||0).toLocaleString()}*\n🎮 Partidas: *${p.games_played||0}*\n💎 $DUENDE: *${Number(p.duende_balance||0).toLocaleString()}*`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar (3D)', web_app: { url: MUNDO_URL } }],[{ text: '🔄 Actualizar', callback_data: 'stats' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleReferralCmd(token, chatId, userId, messageId) {
  const referralLink = `https://t.me/duendequest_bot?start=ref_${userId}`;
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🎁 *Invita a un amigo*\n\nTu link:\n\`${referralLink}\`\n\nCuando alguien nuevo entra con tu link, cada uno recibe 500 $DUENDE (hasta 20 amigos).`, parse_mode: 'Markdown' });
}

async function handleReferral(token, env, referrerId, newUser) {
  if (String(referrerId) === String(newUser.id)) return;
  try {
    if (!/^\d{1,15}$/.test(String(referrerId))) return;
    // Tope por referente: sin esto, una sola persona podia crear cuentas de
    // Telegram desechables en cadena y drenar el suministro de $DUENDE sin
    // limite (500 DQ por cada una, sin verificacion de identidad posible).
    // 20 referidos reales ya es generosidad de sobra para crecimiento organico;
    // pasado eso se corta el bono (la cuenta nueva igual puede jugar normal).
    const yaReferidos = await supabaseQuery(env, `referrals?referrer_tg_id=eq.${referrerId}&select=id&limit=20`);
    if (Array.isArray(yaReferidos) && yaReferidos.length >= 20) return;
    const existing = await supabaseQuery(env, `referrals?referred_tg_id=eq.${newUser.id}&select=id`);
    if (Array.isArray(existing) && existing.length > 0) return;
    // El INSERT es el cerrojo (indice UNIQUE en referred_tg_id, sql/02-seguridad.sql):
    // si dos /start llegan a la vez, solo el que inserta la fila paga.
    const ins = await supabaseQuery(env, 'referrals', { method: 'POST', body: { referrer_tg_id: String(referrerId), referred_tg_id: String(newUser.id), referred_username: (newUser.username||newUser.first_name||'anon').slice(0,20) } });
    if (!Array.isArray(ins) || ins.length !== 1) return;
    await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: String(referrerId), p_amount: 500 } });
    await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: String(newUser.id), p_amount: 500 } });
    await tg(token, 'sendMessage', { chat_id: referrerId, text: `🎁 *Nuevo referido*\n\n${mdSeguro(newUser.first_name||'Alguien')} se unió con tu link.\n+500 $DUENDE añadidos a tu saldo.`, parse_mode: 'Markdown' });
  } catch(e) {}
}

async function handleBuy(token, chatId, userId, messageId) {
  const price = await getPrice();
  const priceUsd = price?.priceUsd;
  if (!priceUsd || priceUsd <= 0) return tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ No pudimos leer el precio de $DUENDE ahora mismo. Intenta en unos minutos.' });
  const packages = calcStarsPackages(priceUsd);
  let text = `⭐ *Comprar $DUENDE con Telegram Stars*\n\nPrecio actual: *$${priceUsd.toFixed(8)}*\nPagas con Stars dentro de Telegram (las Stars se compran con tarjeta en Telegram).\n\n`;
  packages.forEach(pkg => { text += `*${pkg.label}:* ${pkg.stars} Stars (~$${pkg.usd}) → ${pkg.tokens.toLocaleString()} $DUENDE\n`; });
  text += '\n' + textoPagoRecibido() + ' La cantidad depende del precio del momento, que puede variar mucho: compra solo lo que estés dispuesto a gastar.';
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: packages.map((pkg,i) => [{ text: `⭐ ${pkg.label} · ${pkg.stars} Stars`, callback_data: `buy_${i}` }]) } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

// ── Play to earn del MMO: retiros de mTON y fondo diario (solo el dueño) ──
async function mmoInterno(env, accion, body) {
  if (!env.MMO) return { ok: false, error: 'MMO no configurado' };
  const stub = env.MMO.get(env.MMO.idFromName('mundo-1'));
  const r = await stub.fetch('https://mmo/interno/' + accion, { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: JSON.stringify(body || {}) });
  return r.json();
}
// Compras del arcade con Stars (skin o $DUENDE) de los ultimos 14 dias aun sin
// acreditar: las del MMO (cargos) y las skins ya activadas no cuentan.
async function starsSinAcreditar(context, cargosMmo) {
  const sb = getEnv(context);
  const desde = new Date(Date.now() - 14 * 86400000).toISOString();
  const filas = await supabaseQuery(sb, `stars_purchases?tokens_credited=eq.0&amount_stars=gt.0&created_at=gte.${desde}&select=tx_id,telegram_id,amount_stars,created_at&order=created_at.desc&limit=30`);
  if (!Array.isArray(filas)) return '⚠️ No pude leer las compras del arcade (Supabase).';
  let l = filas.filter(f => f.tx_id && !cargosMmo.includes(f.tx_id));
  if (l.length) {
    const lista = l.map(f => '"' + String(f.tx_id).replace(/"/g, '') + '"').join(',');
    const sk = await supabaseQuery(sb, `skin_purchases?tx_signature=in.(${encodeURIComponent(lista)})&select=tx_signature`);
    if (Array.isArray(sk)) l = l.filter(f => !sk.some(x => x.tx_signature === f.tx_id));
  }
  if (!l.length) return '';
  return '⭐ Compras del arcade con Stars sin acreditar (14 días):\n\n' + l.map(f => `${f.amount_stars} Stars · tg ${f.telegram_id} · ${new Date(f.created_at).toLocaleString('es', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}\n/starsok ${f.tx_id} …`).join('\n\n')
    + '\n\nCompleta con la cantidad de $DUENDE o skin:ID (vienen en el aviso de la compra).';
}
// "❌ Devolver" de una compra del arcade: solo si aun no se acredito ni se activo la skin.
// tgAviso: el id de Telegram del aviso "Stars cobradas sin pedido confirmado", por si
// Supabase no llego a guardar el cobro (sin el no habia forma de devolverlo con el boton).
async function devolverStarsArcade(context, token, cargo, tgAviso) {
  const sb = getEnv(context);
  // Si el cargo es de un pedido del MMO (p. ej. el MMO tardo en contestar al webhook
  // pero si lo marco pagado), se devuelve con /anular: asi el pedido no queda
  // "por entregar" con las Stars ya devueltas (devolucion + entrega = doble).
  let mmo = null;
  try { mmo = await mmoInterno(context.env, 'pedidos'); } catch (e) {}
  if (!mmo || !mmo.ok) return '❌ No pude comprobar los pedidos del MMO ahora: no se devolvió nada. Prueba en un rato.';
  if ((mmo.cargos || []).includes(cargo)) return '❌ Ese cobro es de un pedido del MMO: míralo en /pedidos y, si no se puede entregar, usa /anular CODIGO (devuelve las Stars y cierra el pedido).';
  const filas = await supabaseQuery(sb, `stars_purchases?tx_id=eq.${encodeURIComponent(cargo)}&select=telegram_id,tokens_credited&limit=1`);
  const f = Array.isArray(filas) ? filas[0] : null;
  if (!f && Array.isArray(filas) && /^\d{3,20}$/.test(String(tgAviso || ''))) {
    // Cobro que Supabase no guardo: sin fila no hay cerrojo, pero Telegram no devuelve dos veces el mismo cargo.
    const rsp = await tg(token, 'refundStarPayment', { user_id: Number(tgAviso), telegram_payment_charge_id: cargo }).catch(() => null);
    if (!rsp || !rsp.ok) return '❌ Telegram no aceptó la devolución: ' + ((rsp && rsp.description) || 'sin respuesta');
    await tg(token, 'sendMessage', { chat_id: tgAviso, text: '↩️ Te devolvimos las Stars de tu compra. Si tienes dudas, habla con el creador del juego por WhatsApp (+51 900 877 863) o escribe a @ElDuendeOficial.' }).catch(() => {});
    return `↩️ Stars devueltas a tg ${tgAviso} (el cobro no estaba en Supabase).`;
  }
  if (!f) return Array.isArray(filas) ? '❌ No hay un pago con ese cargo.' : '❌ No pude leer el pago (Supabase). Inténtalo en un rato.';
  if (Number(f.tokens_credited) < 0) return '↩️ Ese pago ya estaba devuelto.';
  if (Number(f.tokens_credited) > 0) return '❌ Ese pago ya se acreditó: no se devuelve.';
  const ya = await supabaseQuery(sb, `skin_purchases?tx_signature=eq.${encodeURIComponent(cargo)}&select=id&limit=1`);
  if (!Array.isArray(ya)) return '❌ No pude comprobar la skin (Supabase). Inténtalo en un rato.';
  if (ya.length) return '❌ Esa skin ya se activó: no se devuelve.';
  // Cerrojo ANTES de devolver: se marca como devuelto (-1) solo si sigue en 0. Asi un
  // /starsok a la vez (o dos toques) no acredita un pago devuelto ni devuelve dos veces.
  const marca = await supabaseQuery(sb, `stars_purchases?tx_id=eq.${encodeURIComponent(cargo)}&tokens_credited=eq.0`, { method: 'PATCH', body: { tokens_credited: -1 } }).catch(() => null);
  if (!Array.isArray(marca) || marca.length !== 1) return '❌ Ese pago cambió mientras tanto (o Supabase no respondió): no se devolvió nada.';
  const rsp = await tg(token, 'refundStarPayment', { user_id: Number(f.telegram_id), telegram_payment_charge_id: cargo }).catch(() => null);
  if (!rsp || !rsp.ok) {
    // No se devolvio: se quita la marca para poder acreditarlo o reintentar.
    await supabaseQuery(sb, `stars_purchases?tx_id=eq.${encodeURIComponent(cargo)}&tokens_credited=eq.-1`, { method: 'PATCH', body: { tokens_credited: 0 } }).catch(() => {});
    return '❌ Telegram no aceptó la devolución: ' + ((rsp && rsp.description) || 'sin respuesta');
  }
  await tg(token, 'sendMessage', { chat_id: f.telegram_id, text: '↩️ Te devolvimos las Stars de tu compra. Si tienes dudas, habla con el creador del juego por WhatsApp (+51 900 877 863) o escribe a @ElDuendeOficial.' }).catch(() => {});
  return `↩️ Stars devueltas a tg ${f.telegram_id}.`;
}
async function handleMmoAdmin(token, context, chatId, userId, cmd, payload) {
  if (String(userId) !== String(context.env.ADMIN_TG_ID || '')) return; // silencio para no-admins
  const env = context.env;
  // Listas largas: Telegram corta a 4096; se parte por bloques (\n\n) en trozos de <= 4000 y se manda en orden.
  const enviar = async text => {
    text = String(text || '');
    const trozos = [];
    if (text.length <= 4000) trozos.push(text);
    else {
      let act = '';
      for (let bloque of text.split('\n\n')) {
        while (bloque.length > 4000) {
          if (act) { trozos.push(act); act = ''; }
          // Corta en un salto de linea (o antes de un emoji partido): medio emoji hace que Telegram rechace el mensaje.
          let n = bloque.lastIndexOf('\n', 4000);
          if (n < 1) { n = 4000; if (/[\uD800-\uDBFF]/.test(bloque[n - 1])) n--; }
          trozos.push(bloque.slice(0, n)); bloque = bloque.slice(n).replace(/^\n/, '');
        }
        if (act && act.length + 2 + bloque.length > 4000) { trozos.push(act); act = ''; }
        act = act ? act + '\n\n' + bloque : bloque;
      }
      if (act) trozos.push(act);
    }
    let res = null;
    for (const t of trozos) {
      res = await tg(token, 'sendMessage', { chat_id: chatId, text: t, disable_web_page_preview: true }).catch(e => ({ ok: false, description: String(e && e.message || e) }));
      if (res && res.ok === false) {
        await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ No pude mostrar la lista (' + String(res.description || 'error').slice(0, 200) + ')' }).catch(() => {});
        return res;
      }
    }
    return res;
  };
  const [arg1, arg2] = payload.trim().replace(/^#/, '').split(/\s+/);
  const fondoTxt = f => `Fondo de hoy: ${(f.total / 1000).toFixed(3)} TON (auto ${(f.auto / 1000).toFixed(3)} + tuyo ${(f.extra / 1000).toFixed(3)}) · repartido ${(f.gastado / 1000).toFixed(3)} TON`;
  // /skinweb REFERENCIA: activa a mano una skin de la web ya pagada y verificada en la
  // cadena (desde el 27-oct-2026 la web no la entrega sola: helius-verify avisa al dueño).
  // /starsok CARGO cantidad | skin:ID — acredita a mano una compra del arcade con Stars.
  if (cmd === '/starsok') {
    if (!arg1 || !arg2) return enviar('Uso: /starsok CARGO 12345  (tokens)  o  /starsok CARGO skin:ID');
    const sb = getEnv(context);
    // Cerrojo: solo la fila aun sin acreditar (tokens_credited 0) pasa; dos comandos a la vez no pagan dos veces.
    const filas = await supabaseQuery(sb, `stars_purchases?tx_id=eq.${encodeURIComponent(arg1)}&select=telegram_id,tokens_credited,amount_stars&limit=1`);
    const f = Array.isArray(filas) ? filas[0] : null;
    if (!f) return enviar('❌ No hay un pago con ese cargo.');
    if (Number(f.tokens_credited) < 0) return enviar('↩️ Ese pago se devolvió: no se acredita.');
    if (Number(f.tokens_credited) !== 0) return enviar('✅ Ese pago ya estaba acreditado.');
    if (arg2.startsWith('skin:')) {
      const skin = arg2.slice(5);
      const ya = await supabaseQuery(sb, `skin_purchases?tx_signature=eq.${encodeURIComponent(arg1)}&select=id&limit=1`);
      if (Array.isArray(ya) && ya.length) return enviar('✅ Esa skin ya estaba activada.');
      const r = await supabaseQuery(sb, 'skin_purchases', { method: 'POST', body: { telegram_id: f.telegram_id, skin_id: skin, payment_type: 'stars', amount_paid: f.amount_stars, tx_signature: arg1 } });
      if (!Array.isArray(r) || r.length !== 1) return enviar('❌ No se pudo guardar: ' + JSON.stringify(r).slice(0, 200));
      await tg(token, 'sendMessage', { chat_id: f.telegram_id, text: `✅ Tu skin ${skin} ya está activada. ¡A jugar!` }).catch(() => {});
      return enviar(`✅ Skin ${skin} activada para tg ${f.telegram_id}.`);
    }
    const tokens = parseInt(arg2, 10);
    if (!(tokens > 0)) return enviar('❌ Cantidad no válida.');
    const marcada = await supabaseQuery(sb, `stars_purchases?tx_id=eq.${encodeURIComponent(arg1)}&tokens_credited=eq.0`, { method: 'PATCH', body: { tokens_credited: tokens } });
    if (!Array.isArray(marcada) || marcada.length !== 1) return enviar('✅ Ese pago ya estaba acreditado (o cambió mientras tanto).');
    await supabaseQuery(sb, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: f.telegram_id, p_amount: tokens } });
    await tg(token, 'sendMessage', { chat_id: f.telegram_id, text: `✅ +${tokens.toLocaleString('es')} $DUENDE añadidos a tu saldo del juego. ¡Gracias por tu compra!` }).catch(() => {});
    return enviar(`✅ ${tokens.toLocaleString('es')} $DUENDE acreditados a tg ${f.telegram_id}.`);
  }
  if (cmd === '/skinweb') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(arg1 || '')) return enviar('Uso: /skinweb REFERENCIA (viene en el aviso de la compra)');
    const sb = getEnv(context);
    const ords = await supabaseQuery(sb, `sol_orders?reference=eq.${encodeURIComponent(arg1)}&select=*&limit=1`);
    const o = Array.isArray(ords) ? ords[0] : null;
    if (!o) return enviar('❌ No existe esa orden.');
    if (o.status !== 'filled' || !o.tx_signature) return enviar('❌ Esa orden no tiene un pago verificado.');
    const ya = await supabaseQuery(sb, `skin_purchases?tx_signature=eq.${encodeURIComponent(o.tx_signature)}&select=id&limit=1`);
    if (Array.isArray(ya) && ya.length) return enviar('✅ Esa skin ya estaba activada.');
    const fila = { skin_id: o.skin_id, payment_type: 'sol', amount_paid: (o.expected_lamports || 0) / 1e9, tx_signature: o.tx_signature, wallet_address: o.wallet_address,
      telegram_id: o.telegram_id ? String(o.telegram_id) : 'wallet_' + String(o.wallet_address || '').slice(0, 8) };
    const r = await supabaseQuery(sb, 'skin_purchases', { method: 'POST', body: fila });
    return enviar(Array.isArray(r) && r.length === 1 ? `✅ Skin ${o.skin_id} activada para ${fila.telegram_id} (${o.wallet_address}).` : '❌ No se pudo guardar: ' + JSON.stringify(r).slice(0, 200));
  }
  if (cmd === '/retiros') {
    const r = await mmoInterno(env, 'retiros');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    if (!r.pendientes.length) return enviar('✅ No hay retiros pendientes.\n' + fondoTxt(r.fondo));
    const lineas = r.pendientes.map(x => `#${x.id} · ${x.ton} TON · ${x.nombre} Nv${x.nivel} · ${x.kills} cazas · ${x.edadDias} días\n${x.amigable}`);
    return enviar('💸 Retiros pendientes:\n\n' + lineas.join('\n\n') + '\n\nPaga desde tu wallet y responde /pagado CODIGO (o /rechazar CODIGO, o /rechazar CODIGO trampa para no devolver los mTON).\n\n' + fondoTxt(r.fondo));
  }
  if (cmd === '/pagado' || cmd === '/rechazar') {
    if (!arg1) return enviar('Uso: ' + cmd + ' CODIGO');
    const r = await mmoInterno(env, cmd === '/pagado' ? 'pagado' : 'rechazar', { id: arg1, tx: cmd === '/pagado' ? arg2 : undefined, trampa: arg2 === 'trampa' });
    return enviar(r.ok ? `✅ Retiro #${r.retiro.id} marcado como ${r.retiro.estado}. Se le avisó al jugador.` : '❌ ' + r.error);
  }
  if (cmd === '/pedidos') {
    const r = await mmoInterno(env, 'pedidos');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const arcade = await starsSinAcreditar(context, r.cargos || []).catch(() => '⚠️ No pude leer las compras del arcade (Supabase no respondió).');
    if (arcade) await enviar(arcade);
    if (!r.pedidos.length) return enviar('✅ No hay compras del MMO por entregar.');
    const lineas = r.pedidos.map(x => `#${x.codigo} · ${x.nombre} ($${x.usd}) · ${x.jugador}\n` + (x.metodo === 'stars'
      ? (x.estado === 'por_verificar' ? `⚠️ POR REVISAR: pagó ${x.starsPagadas} de ${x.stars} Stars desde tg ${x.tgPagador || '?'}` : `⭐ ${x.starsPagadas} Stars pagadas (verificado por Telegram)`)
      : x.metodo === 'yape' ? `🟣 S/ ${((x.centimos || 0) / 100).toFixed(2)} por Yape/Plin · operación ${x.operacion || '?'} · ⚠️ revísalo en tu app (monto exacto y nota #${x.codigo})`
      : (x.metodo === 'duende' ? `🍄 ${(x.duendeRaw / 1e6).toLocaleString('es')} $DUENDE` : `◎ ${(x.lamports / 1e9).toFixed(9)} SOL`) + ` · ${x.cadena ? (x.cadena.ok ? '✅ visto en la cadena' : '❌ ' + x.cadena.motivo) : '⚠️ sin comprobar'}\nhttps://solscan.io/tx/${x.firma}`));
    return enviar('🛒 Compras por entregar:\n\n' + lineas.join('\n\n') + '\n\n/entregar CODIGO para darle lo que compró · /anular CODIGO motivo para cancelar (las Stars se devuelven solas; el SOL lo devuelves tú).');
  }
  if (cmd === '/ventas') {
    const r = await mmoInterno(env, 'ventas');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const bloque = (t, x) => `${t}: ${x.n} venta${x.n === 1 ? '' : 's'} · $${x.usd} (◎ ${x.sol} con SOL · ⭐ ${x.stars} con Stars${x.yape ? ` · 🟣 ${x.yape} con Yape/Plin, S/ ${x.soles}` : ''})` + (x.top.length ? '\n' + x.top.map(y => `  · ${y.nombre}: ${y.n} ($${Math.round(y.usd * 100) / 100})`).join('\n') : '');
    return enviar('🛒 Ventas del MMO (entregadas)\n\n' + bloque('Últimos 7 días', r.d7) + '\n\n' + bloque('Últimos 30 días', r.d30) + `\n\n⏳ Por entregar: ${r.pendientes}` + (r.pendientes ? ' (/pedidos)' : '') + ` · ❌ Anuladas (30 d): ${r.anulados30}` + textoVentasDetalle(r));
  }
  // /gasto AAAA-MM-DD|hoy|ayer meta 42.50 [campaña] — lo gastado en anuncios ese
  // dia (US$). Misma fecha, origen y campaña lo corrige; 0 lo borra. Solo anota:
  // con esto /mmostats calcula CPI y ROAS D7.
  if (cmd === '/gasto') {
    const p = payload.trim().split(/\s+/).filter(Boolean);
    if (!p.length) {
      const r = await mmoInterno(env, 'gasto', {});
      if (!r || !r.ok) return enviar('❌ ' + ((r && r.error) || 'error'));
      return enviar('💸 Gasto en anuncios (últimos anotados, US$):\n' + (r.l.length ? r.l.map(x => `${x.f} · ${x.src}${x.camp ? ' · ' + x.camp : ''} · $${x.usd}`).join('\n') : '— (nada anotado)')
        + '\n\nAnotar: /gasto 2026-11-01 meta 42.50 campaña\n(fecha: AAAA-MM-DD, hoy o ayer · origen: meta, tg, wa, etiqueta o ref · campaña opcional = utm_campaign del anuncio · 0 borra esa fila)');
    }
    const iso = t => new Date(t - 5 * 3600000).toISOString().slice(0, 10);   // dia de Lima (UTC-5), igual que diaJuego
    const f = p[0] === 'hoy' ? iso(Date.now()) : p[0] === 'ayer' ? iso(Date.now() - 86400000) : p[0];
    const usd = Number(String(p[2] || '').replace(',', '.'));
    if (!p[1] || !p[2] || !Number.isFinite(usd)) return enviar('Uso: /gasto 2026-11-01 meta 42.50 campaña  (monto en US$; fecha también hoy o ayer)');
    // La campaña se sanea igual que en el servidor (campDe): asi el aviso muestra la que se guarda.
    const camp = String(p[3] || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (p[3] && !camp) return enviar('Campaña no válida: usa letras, números, _ o - (la misma utm_campaign del anuncio).');
    const r = await mmoInterno(env, 'gasto', { f, src: p[1].toLowerCase(), usd, camp });
    if (!r || !r.ok) return enviar('❌ ' + ((r && r.error) || 'error'));
    return enviar(`✅ Anotado: ${f} · ${p[1].toLowerCase()}${camp ? ' · ' + camp : ''} · $${Math.round(usd * 100) / 100}${usd === 0 ? ' (borrado)' : ''}. Míralo en /mmostats.`);
  }
  if (cmd === '/entregar') {
    if (!arg1) return enviar('Uso: /entregar CODIGO');
    const r = await mmoInterno(env, 'entregar', { codigo: arg1 });
    return enviar(r.ok ? `🎁 Pedido #${r.pedido.codigo} entregado a ${r.pedido.jugador}: ${r.pedido.nombre}. Se le avisó.` : '❌ ' + r.error);
  }
  if (cmd === '/anular') {
    if (!arg1) return enviar('Uso: /anular CODIGO motivo');
    const motivo = payload.trim().split(/\s+/).slice(1).join(' ');
    const r = await mmoInterno(env, 'anular', { codigo: arg1, motivo });
    return enviar(r.ok ? `❌ Pedido #${r.pedido.codigo} anulado.${r.reembolso || (r.pedido.metodo === 'sol' ? ' Si llegó SOL, devuélvelo tú desde tu wallet.' : r.pedido.metodo === 'yape' ? ' Si llegó el Yape/Plin, devuélvelo tú desde tu app.' : '')}` : '❌ ' + r.error);
  }
  // Premio de chicha morada (functions/mmo/chicha.js).
  if (cmd === '/chicha') {
    const r = await mmoInterno(env, 'chichas');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const ahora = Date.now(), mes60 = (r.meses60 || []).map(m => `${m.mes}: ${m.n}/${r.mesMax60} · ${m.pend} por enviar (${m.pend * 2} L)`).join('\n');
    const cab = `🥤 Litros por puntos de este mes: ${r.mes}/${r.mesMax}${mes60 ? `\nNv 60 por mes de entrega:\n${mes60}` : ''}\n\n`;
    if (!r.pendientes.length) return enviar(cab + '✅ No hay premios de chicha por enviar.');
    const lineas = r.pendientes.map(x => `#${x.id} · ${x.nombre} Nv${x.nivel} · ${x.meta === 'nv60' ? `Nv 60 (${x.litros || 2} L)${x.cola ? ' · EN COLA' : ''} · entrega ${x.mesEnt || x.mes}` : x.meta.toLocaleString('es') + ' pts · ' + x.mes} · ${x.coord ? 'coordinado' : x.cola ? 'sin coordinar' : `sin coordinar (${Math.floor((ahora - (x.desde || x.creado || ahora)) / 86400000)} d)`}\nContacto: ${x.uid.startsWith('tg:') ? `tg://user?id=${x.uid.slice(3)} (id ${x.uid.slice(3)})` : 'cuenta de correo: te escribe por WhatsApp con su código'}\n🔑 Clave de entrega: ${x.clave || '—'}${(x.alertas || []).length ? '\n' + x.alertas.join('\n') : ''}`);
    return enviar(cab + lineas.join('\n\n') + '\n\nPor WhatsApp, antes de tomar la dirección, pide la clave de entrega: solo la ve el jugador dentro de su cuenta. Si no coincide, no envíes. Anota su teléfono: /chichatel CODIGO NUMERO (avisa si se repite). Enviado: /chichaok CODIGO · No se puede: /chichano CODIGO motivo (añade "trampa" al final para que no pueda volver a reclamarlo).\nTelegram: puedes escribirle tú; a ese chat no le pidas la clave, ya es su cuenta. Correo: espera su WhatsApp con el código. Coordinado: /chichacoord CODIGO · Sin coordinar: /chichasin · Liberar: /chichalibera CODIGO');
  }
  // Los reclamos que nadie coordina no caducan solos: el dueño los ve y decide cuáles liberar.
  if (cmd === '/chichasin') {
    const r = await mmoInterno(env, 'chichasSin', { dias: Number(arg1) || 0 });
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const ahora = Date.now(), lineas = r.lista.map(x => `#${x.id} · ${x.nombre} · ${x.meta === 'nv60' ? 'Nv 60' : x.meta.toLocaleString('es') + ' pts'} · le toca hace ${Math.floor((ahora - (x.desde || x.creado || ahora)) / 86400000)} d`);
    const cola = r.enCola ? `\n\n${r.enCola} más en cola para meses siguientes (aún no les toca).` : '';
    if (!lineas.length) return enviar(`✅ Nada sin coordinar${r.dias ? ` con ${r.dias} días o más` : ''}.${cola}`);
    return enviar(`🥤 Sin coordinar${r.dias ? ` (${r.dias} días o más)` : ''}, del más antiguo al más nuevo:\n\n${lineas.join('\n')}${cola}\n\nCoordinado: /chichacoord CODIGO · Liberar el cupo: /chichalibera CODIGO`);
  }
  if (cmd === '/chichacoord') {
    if (!arg1) return enviar('Uso: /chichacoord CODIGO');
    const r = await mmoInterno(env, 'chichaCoord', { id: arg1 });
    return enviar(r.ok ? `🥤 Premio #${r.chicha.id} marcado como coordinado. Al enviarlo: /chichaok ${r.chicha.id}` : '❌ ' + r.error);
  }
  if (cmd === '/chichalibera') {
    if (!arg1) return enviar('Uso: /chichalibera CODIGO [motivo]');
    const r = await mmoInterno(env, 'chichaLibera', { id: arg1, motivo: payload.trim().split(/\s+/).slice(1).join(' ') });
    return enviar(r.ok ? `🥤 Premio #${r.chicha.id} liberado: ${r.mesPasado ? 'su cupo era de un mes ya pasado, así que no adelanta a nadie, y' : 'su cupo queda libre y'} el jugador puede volver a reclamarlo (lo verá en su panel; no se le escribió).` : '❌ ' + r.error);
  }
  if (cmd === '/chichatel') {
    const tel = payload.trim().split(/\s+/).slice(1).join('');
    if (!arg1 || !tel) return enviar('Uso: /chichatel CODIGO NUMERO');
    const r = await mmoInterno(env, 'chichaTel', { id: arg1, tel });
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    return enviar(`☎️ Teléfono anotado en #${r.id} (solo su huella, no el número).\n${(r.alertas || []).length ? r.alertas.join('\n') : '✅ Sin coincidencias con otros reclamos.'}`);
  }
  if (cmd === '/chichaok' || cmd === '/chichano') {
    if (!arg1) return enviar('Uso: ' + cmd + ' CODIGO' + (cmd === '/chichano' ? ' motivo' : ''));
    const resto = payload.trim().split(/\s+/).slice(1);
    const trampa = resto[resto.length - 1] === 'trampa';
    const r = await mmoInterno(env, cmd === '/chichaok' ? 'chichaOk' : 'chichaNo', { id: arg1, motivo: resto.filter(x => x !== 'trampa').join(' '), trampa });
    return enviar(r.ok ? `🥤 Premio #${r.chicha.id} marcado como ${r.chicha.estado}. ${r.avisado ? 'Se le avisó al jugador.' : 'No se le pudo avisar ahora: lo verá en su panel al entrar. Si tienes su WhatsApp, díselo tú.'}` : '❌ ' + r.error);
  }
  if (cmd === '/mmostats') {
    const r = await mmoInterno(env, 'stats');
    // Tope de Telegram: 4096 caracteres; enviar() lo parte en varios mensajes si hace falta.
    return enviar(r && r.ok ? textoMmoStats(r) :'❌ ' + ((r && r.error) || 'error'));
  }
  if (cmd === '/fondo') {
    if (arg1 !== undefined) {
      const ton = Number(String(arg1).replace(',', '.'));
      if (!(ton >= 0 && ton <= 1000)) return enviar('Uso: /fondo 0.5  (TON diarios que agregas tú, aparte del % automático de ingresos)');
      const r = await mmoInterno(env, 'fondo', { extra: Math.round(ton * 1000) });
      return enviar(r.ok ? '✅ Listo. ' + fondoTxt(r) : '❌ ' + r.error);
    }
    const r = await mmoInterno(env, 'fondo', {});
    return enviar(fondoTxt(r) + '\n\nDesde el 22-oct el % automático de ingresos está en 0: el fondo es solo lo que agregas tú (así no sale de lo que pagan otros jugadores). Para sumar TON tuyos cada día: /fondo 0.5');
  }
}

// /ventas: por metodo, via, origen y campaña (30 dias), espera pagado→entregado
// y el embudo de compra de 7 dias (functions/mmo/retencion.js).
function textoVentasDetalle(r) {
  const d = r.d30;
  if (!d) return '';
  const g = l => (l || []).map(x => `${x.k} ${x.n} ($${x.usd})`).join(' · ') || '—';
  let t = '';
  if (d.grupos) t += `\n\n📦 30 días por método: ${g(d.grupos.metodo)}\n🚪 Por dónde abrió la tienda: ${g(d.grupos.via)}\n🎯 Por origen del jugador: ${g(d.grupos.origen)}` + (d.grupos.campana && d.grupos.campana.length ? `\n📣 Por campaña: ${g(d.grupos.campana)}` : '');
  if (d.espera !== null && d.espera !== undefined) t += `\n⏱️ Pagado → entregado (mediana): ${String(d.espera).replace('.', ',')} h`;
  const e = r.embudo;
  if (e && e.tot) {
    const fila = x => `tienda ${x.tv || 0} → factura ${x.fa || 0} (la cierran sin pagar ${x.fc || 0}) · pedidos ⭐${x.pq_stars || 0} ◎${x.pq_sol || 0} 🍄${x.pq_duende || 0}${x.pq_yape ? ' 🟣' + x.pq_yape : ''} → pagan ${x.pg || 0} → entregados ${x.en || 0} · caducan ${x.cad || 0}`;
    t += `\n\n🪜 Embudo de compra (7 días; jugadores distintos por día):\nTodos: ${fila(e.tot)}` + (e.meta && (e.meta.tv || e.meta.pg) ? `\nMeta: ${fila(e.meta)}` : '');
  }
  return t;
}

// /mmostats: un % con su intervalo de Wilson al 95% (lo calcula retencion.js):
// '32% (17–51)', y '⚠️ poca muestra' si la base es menor de 30.
function pcIntervalo(v, i, base) {
  if (v === null || v === undefined || !base) return '—';
  const t = String(Math.round(v)) + '%' + (Array.isArray(i) ? ` (${i[0]}–${i[1]})` : '');
  return base < 30 ? t + ' ⚠️ poca muestra' : t;
}

// /mmostats: por version publicada (?v=): altas de 14 dias, cuantas volvieron a
// entrar el mismo dia y su D1/D3 con intervalo. Dice si una version subio o bajo el D1.
function textoVersiones(r) {
  const l = r.versiones || [];
  if (!l.length) return '';
  const filas = l.map(e => `v${e.v}: altas ${e.n} · volvió hoy ${e.s2}${e.s2pct != null ? ' (' + String(e.s2pct).replace('.', ',') + '%)' : ''} · D1 ${pcIntervalo(e.d1, e.d1i, e.d1base)} · D3 ${pcIntervalo(e.d3, e.d3i, e.d3base)}`);
  return `🧪 Por versión (altas de 14 días; volvió hoy = 2.ª sesión el mismo día del alta; su % sin las altas de hoy):\n${filas.join('\n')}\n(D1/D3 solo de cohortes con el día ya cumplido; entre paréntesis, el rango probable al 95%.)\n\n`;
}

// /mmostats: anuncios de los ultimos 7 dias (gasto de /gasto, altas por origen
// y campaña). Las Stars del arcade no cuentan: solo la tienda del MMO.
function textoAnuncios(r) {
  const a = r.anuncios;
  if (!a || (!Object.keys(a.porSrc || {}).length && !(a.camps || []).length && !(a.ads || []).length)) return '';
  const nom = { meta: 'Meta', tg: 'Telegram', wa: 'WhatsApp', etiqueta: 'Etiqueta (QR)', ref: 'Invitación' };
  const usd = v => v === null || v === undefined ? '—' : '$' + String(v).replace('.', ',');
  const x = v => v === null || v === undefined ? '—' : String(v).replace('.', ',') + 'x';
  const pc = v => v === null || v === undefined ? '—' : String(v).replace('.', ',') + '%';
  const dm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const filas = Object.entries(a.porSrc || {}).map(([k, e]) => `${nom[k] || k} 7d: gasto ${usd(e.gasto)} · altas ${e.altas} · CPI ${usd(e.cpi)} · D1 ${pc(e.d1)} · D3 ${pc(e.d3)} · ARPU D7 ${usd(e.arpu)} · ROAS D7 ${x(e.roas)}`);
  const camps = (a.camps || []).map(e => `  · ${e.camp}: gasto ${usd(e.gasto)} · altas ${e.altas} · CPI ${usd(e.cpi)} · D1 ${e.d1i ? pcIntervalo(e.d1, e.d1i, e.d1base) : pc(e.d1)} · D3 ${e.d3i ? pcIntervalo(e.d3, e.d3i, e.d3base) : pc(e.d3)} · ARPU D7 ${usd(e.arpu)} · ROAS D7 ${x(e.roas)}`);
  // Por anuncio (utm_content): que video trae gente que VUELVE, no solo clics.
  const ads = (a.ads || []).map(e => `  · ${e.ad}: altas ${e.altas} · D1 ${e.d1i ? pcIntervalo(e.d1, e.d1i, e.d1base) : pc(e.d1)}${e.d1base ? ` [${e.d1n}/${e.d1base}]` : ''} · D3 ${e.d3i ? pcIntervalo(e.d3, e.d3i, e.d3base) : pc(e.d3)}${e.d3base ? ` [${e.d3n}/${e.d3base}]` : ''}`);
  return `📣 Anuncios (altas del ${dm(a.desde)} al ${dm(a.hasta)}; gasto anotado con /gasto):\n${filas.join('\n')}${camps.length ? '\nPor campaña:\n' + camps.join('\n') : ''}${ads.length ? '\nPor anuncio (utm_content, altas de 14 días): altas · D1 · D3\n' + ads.join('\n') : ''}\n(D3 = volvieron al 3er día: con 20+ altas por anuncio sirve para pausar o escalar. ARPU y ROAS D7 = compras de la tienda del MMO entregadas, hechas en sus 7 primeros días; aún crecen. Las Stars del arcade no cuentan.)\n\n`;
}

// /mmostats, por origen (/js/origen.js): altas y embudo de 14 dias con su
// D1/D7, y el embudo de la carga de 7 dias (beacon /mmo/ev). Vacio si aun no hay datos.
const NOMBRE_ORIGEN = { meta: 'Meta', tg: 'Telegram', wa: 'WhatsApp', etiqueta: 'Etiqueta (QR)', ref: 'Invitación', org: 'Orgánico' };
function textoOrigenes(r) {
  const pc = x => !x || x.pct === null ? '—' : String(x.pct).replace('.', ',') + '%';
  let t = '';
  const o = r.origenes || {};
  const filas = Object.keys(NOMBRE_ORIGEN).filter(k => o[k]).map(k => `${NOMBRE_ORIGEN[k]}: altas ${o[k].n} · c1 ${o[k].c1} · m1 ${o[k].m1} · n5 ${o[k].n5} · D1 ${pc(o[k].d1)} · D2 ${pc(o[k].d2)} · D3 ${pc(o[k].d3)} · D7 ${pc(o[k].d7)}`);
  if (filas.length) t += `🎯 Por origen (altas de 14 días):\n${filas.join('\n')}\n\n`;
  const c = r.carga && r.carga.por ? r.carga.por : {};
  const PASOS = [['carga_ini', 'abre'], ['arte_ok', 'carga'], ['form_visto', 'formulario'], ['clic_entrar', 'clic'], ['bienvenido', 'dentro'], ['mover', 'se mueve'], ['golpe1', '1er golpe'], ['caza1', '1ra caza']];
  const cf = Object.keys(NOMBRE_ORIGEN).filter(k => c[k] && c[k].pasos.carga_ini).map(k => {
    const p = c[k].pasos, base = p.carga_ini;
    const pm = base ? Math.round((p.mover || 0) / base * 100) : 0;
    const m20 = c[k].movil20 ? ` · móvil clic→mover ≤20 s: ${pc(c[k].movil20)} (mediana ${c[k].movil20.mediana})` : '';
    // Mediana (por tramo, en segundos) del clic en entrar al 1er golpe y a la 1ra caza, movil y PC juntos.
    const mgc = c[k].golpe1Med || c[k].caza1Med ? ` · mediana clic→1er golpe ${c[k].golpe1Med || '—'} · clic→1ra caza ${c[k].caza1Med || '—'}` : '';
    return `${NOMBRE_ORIGEN[k]}: ${PASOS.map(([e, n]) => `${n} ${p[e] || 0}`).join(' → ')} (${pm}% se mueve) · se van ${p.oculta || 0} · sin 3D ${p.fallo_webgl || 0}${p.t_hab || p.t_volar || p.t_fin ? ` · tutorial: habilidad ${p.t_hab || 0} → alas (solo 3D) ${p.t_volar || 0} → fin ${p.t_fin || 0}` : ''}${p.mis_0 || p.jefe1_ver ? ` · misiones (3D) ${['mis_0', 'mis_1', 'mis_2', 'mis_3', 'mis_4', 'mis_5'].map(e => p[e] || 0).join('→')} · 1er jefe: lo ve ${p.jefe1_ver || 0}, muere ${p.jefe1_muere || 0}, lo vence ${p.jefe1_ok || 0}` : ''}${p.cueva_entra ? ` · cueva: entra ${p.cueva_entra || 0}, ve al Rey ${p.cueva_rey_ve || 0}, cae ${p.cueva_muere || 0}, completa ${p.cueva_ok || 0}` : ''}${m20}${mgc}`;
  });
  if (cf.length) t += `🚪 Carga del juego (7 días, sesiones):\n${cf.join('\n')}\n\n`;
  // Paginas de aterrizaje (js/origen.js, j='web'): visitas contra clics en Jugar, y el QR de la botella hasta abrir el juego.
  const suma = e => Object.values(c).reduce((s, x) => s + ((x && x.pasos && x.pasos[e]) || 0), 0);
  const ld = [['ld_portada', 'Portada'], ['ld_jugar', '/jugar/'], ['ld_chicha', '/chicha/']].filter(([k]) => suma(k + '_ver') || suma(k + '_clic')).map(([k, n]) => {
    const v = suma(k + '_ver'), cl = suma(k + '_clic');
    return `${n}: visitas ${v} → clic en Jugar ${cl}${v ? ` (${Math.round(cl / v * 100)}%)` : ''}`;
  });
  const qr = c.etiqueta && c.etiqueta.pasos;
  if (qr && qr.ld_chicha_ver) ld.push(`QR de la botella: escaneos ${qr.ld_chicha_ver} → clic ${qr.ld_chicha_clic || 0} → abren el juego ${qr.carga_ini || 0}`);
  if (ld.length) t += `🛬 Páginas de aterrizaje (7 días, sesiones):\n${ld.join('\n')}\n\n`;
  return t;
}

// Pasos del tutorial (sesiones de 7 dias, sumando todos los origenes): solo lectura.
function tutoTotal(r) {
  const c = r.carga && r.carga.por ? r.carga.por : {};
  const s = { t_hab: 0, t_volar: 0, t_fin: 0 };
  for (const k in c) for (const e in s) s[e] += (c[k] && c[k].pasos && c[k].pasos[e]) || 0;
  return s.t_hab || s.t_volar || s.t_fin ? ` · tutorial (sesiones 7 d): habilidad ${s.t_hab} → alas (solo 3D) ${s.t_volar} → fin ${s.t_fin}` : '';
}

// /mmostats: la retencion real del MMO (la calcula functions/mmo/retencion.js).
// Texto plano: los nombres del top los eligen los jugadores.
function textoMmoStats(r) {
  const dm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const ret = x => x.pct === null ? '— (aún sin cohortes completas)' : `${String(x.pct).replace('.', ',')}% (${x.vuelven} de ${x.base})`;
  const dato = v => v === null ? '…' : v;
  const a = r.activos, t = r.tipos30;
  const tramos = Object.entries(r.niveles30).sort((x, y) => parseInt(x[0]) - parseInt(y[0])).map(([k, v]) => `Nv ${k}: ${v}`).join(' · ') || '—';
  const altas = r.altas.map(x => `${dm(x.dia)} ${x.n}`).join(' · ');
  const cohortes = r.cohortes.slice(0, 10).map(x => `${dm(x.dia)}: ${x.n} alta${x.n === 1 ? '' : 's'} → D1 ${dato(x.d1)}${x.d2 !== undefined && x.d2 !== null ? ` · D2 ${x.d2}` : ''}${x.d3 !== undefined && x.d3 !== null ? ` · D3 ${x.d3}` : ''} · D7 ${dato(x.d7)} · D30 ${dato(x.d30)}`).join('\n') || 'Aún no hay altas registradas.';
  const top = r.top.map((x, i) => `${i + 1}. ${String(x.n || '?').slice(0, 20)} — Nv ${x.lv}`).join('\n') || '—';
  return `📊 DUENDE QUEST ONLINE — retención (${r.hoy}, días de Lima)\n\n` +
    `👥 Activos: hoy ${a.hoy} · 7 días ${a.d7} · 30 días ${a.d30} (en línea ahora: ${r.online})\n` +
    `   En 30 días: ${t.tg} Telegram · ${t.web} web · ${t.inv} invitados\n` +
    `   Niveles: ${tramos}\n` +
    `⏱️ Sesión media (7 días): ${String(r.sesion.media).replace('.', ',')} min · ${r.sesion.sesiones7} sesiones · ${r.sesion.minutos7} min en total\n\n` +
    `🆕 Altas por día (últimos 14):\n${altas}\n\n` +
    (r.embudo && r.embudo.n ? `🪜 Embudo de esas altas: primera caza ${r.embudo.c1}/${r.embudo.n} · misión 1 ${r.embudo.m1}${tutoTotal(r)} · nivel 5 ${r.embudo.n5} · nivel 10 ${r.embudo.n10} · 1ª expedición ${r.embudo.ex1 || 0} · «Avísame por Telegram» (web) ${r.embudo.avisoTgOk || 0}${r.embudo.iab && r.embudo.iab.n ? ` · desde Facebook/Instagram ${r.embudo.iab.n} (D1 ${r.embudo.iab.d1 && r.embudo.iab.d1.pct != null ? r.embudo.iab.d1.pct + '%' : '—'})` : ''}\n\n` : '') +
    (r.avisos && Object.keys(r.avisos).length ? `🔔 Avisos diarios (14 días, por su primera línea · volvieron en 24 h): ${Object.entries(r.avisos).map(([k, a]) => `${k} ${a.vuelven}/${a.env}${a.pct != null ? ' (' + String(a.pct).replace('.', ',') + '%)' : ''}`).join(' · ')}\n\n` : '') +
    (r.invitaciones && r.invitaciones.refLlega ? `🤝 Invitados por enlace (14 días): llegan ${r.invitaciones.refLlega} · con cuenta ${r.invitaciones.refCuenta} · premio Nv 10 ${r.invitaciones.refPagado} · llegan a Nv 10 ${r.invitaciones.n10pct != null ? r.invitaciones.n10pct + '%' : '—'} (resto ${r.invitaciones.n10restoPct != null ? r.invitaciones.n10restoPct + '%' : '—'})\n\n` : '') +
    textoOrigenes(r) + textoAnuncios(r) + textoVersiones(r) +
    `🔁 Retención (últimas 30 cohortes con el día ya cumplido):\n` +
    `D1: ${ret(r.retencion.d1)}\n${r.retencion.d3 && r.retencion.d3.base ? `D2: ${ret(r.retencion.d2)}\nD3: ${ret(r.retencion.d3)}\n` : ''}D7: ${ret(r.retencion.d7)}\nD30: ${ret(r.retencion.d30)}\n\n` +
    `📅 Cohortes recientes (cuántos volvieron ese día exacto; … = aún no llega):\n${cohortes}\n\n` +
    `🏆 Top niveles:\n${top}\n\n` +
    (r.salud ? `🩺 Servidor hoy: ${r.salud.escrituras.toLocaleString('es')} escrituras de ${r.salud.cupo.toLocaleString('es')} (${String(r.salud.pct).replace('.', ',')}%)` +
      `${r.salud.degradado ? ' · ⚠️ MODO AHORRO' : ''}${r.salud.lento ? ' · ⚠️ LAG ALTO' : ''}\n` +
      `   Por clave: ${r.salud.porPrefijo.map(x => `${x.k} ${x.n}`).join(' · ') || '—'}\n` +
      `   Mensajes: ${r.salud.mensajes.toLocaleString('es')} (${r.salud.kb.toLocaleString('es')} KB) · ${r.salud.tipos.map(x => `${x.k} ${x.n}`).join(' · ') || '—'}\n` +
      `   Lag del bucle: ${r.salud.lag} ms (máx. hoy ${r.salud.lagMax} ms)\n\n` : '') +
    `Se cuenta desde que se activó la medición; no incluye a los bots de prueba.`;
}

// /avisos on|off: avisos para volver al MMO (y el recordatorio diario del
// arcade, que el cron tambien se salta para quien pidio no recibir avisos).
async function handleAvisos(token, context, chatId, userId, payload) {
  const arg = (payload || '').trim().toLowerCase();
  const on = ['on', 'si', 'sí', 'activar'].includes(arg) ? true : ['off', 'no', 'desactivar'].includes(arg) ? false : undefined;
  let r = null;
  try { r = await mmoInterno(context.env, 'avisos', { tgId: String(userId), on }); } catch (e) {}
  if (!r || !r.ok) { await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ No se pudo guardar ahora. Intenta de nuevo en un rato.' }); return; }
  const texto = on === true ? '🔔 Listo: te avisaremos (como mucho una vez al día) cuando tengas algo pendiente en DUENDE QUEST ONLINE.\n\nPara dejar de recibirlos: /avisos off'
    : on === false ? '🔕 Listo: no te mandaremos más avisos para volver al juego.\n\nSi cambias de idea: /avisos on'
    : `Avisos para volver al juego: ${r.on ? '🔔 activados' : '🔕 desactivados'}.\n\n/avisos on — activarlos\n/avisos off — desactivarlos`;
  await tg(token, 'sendMessage', { chat_id: chatId, text: texto });
}

// /yo: tu personaje del MMO (solo el tuyo).
async function handleYo(token, env, chatId, userId) {
  let r = null;
  try { r = await mmoInterno(env, 'perfil', { tgId: String(userId) }); } catch (e) {}
  const boton = { inline_keyboard: [[{ text: '🌌 Entrar en 3D', web_app: { url: MUNDO_URL } }], [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL } }]] };
  if (!r || !r.ok) return tg(token, 'sendMessage', { chat_id: chatId, text: '❌ No se pudo leer tu personaje ahora. Prueba en un momento.' });
  if (!r.existe) return tg(token, 'sendMessage', { chat_id: chatId, text: '🌍 Aún no tienes personaje en DUENDE QUEST ONLINE. ¡Entra y elige tu clase!', reply_markup: boton });
  const clases = { guerrero: '⚔️ Guerrero', mago: '🔥 Mago', sacerdote: '✨ Sacerdote', picaro: '🗡️ Pícaro' };
  const dest = { bosque: 'al Bosque', mina: 'a la Mina', lago: 'al Lago' };
  let t = `🧝 *${mdSeguro(r.n)}* — Nv ${r.lv}${r.cl ? ' · ' + (clases[r.cl] || r.cl) : ''}${r.en ? ' · 🟢 conectado' : ''}\n\n`;
  t += `🪙 ${r.oro.toLocaleString('es')} oro · 💎 ${r.mton.toLocaleString('es')} mTON\n`;
  t += `🗼 Torre: piso ${r.torre} esta semana (récord ${r.torreMax})\n`;
  t += `🎣 ${r.peces.toLocaleString('es')} peces · ${r.especies}/11 especies\n`;
  t += `🏰 ${r.mazmorras} mazmorras · 🏅 ${r.logros} logros${r.elo ? ' · ⚔️ Elo ' + r.elo : ''}${r.racha ? ' · 🔥 racha ' + r.racha + ' días' : ''}\n`;
  if (r.exped) t += r.exped.listo ? `\n🧭 Tu expedición ${dest[r.exped.d] || ''} *ya volvió*: entra a recogerla.` : `\n🧭 Expedición ${dest[r.exped.d] || ''}: vuelve en ${r.exped.min >= 60 ? Math.floor(r.exped.min / 60) + ' h ' : ''}${r.exped.min % 60} min.`;
  else if (r.lv >= 5) t += `\n🧭 No tienes ninguna expedición en marcha: mándala antes de irte.`;
  await tg(token, 'sendMessage', { chat_id: chatId, text: t, parse_mode: 'Markdown', reply_markup: boton });
}

async function handleCreador(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🧌 *DUENDE QUEST — ¿Quién está detrás?*\n\nEl juego lo crea y mantiene *El Duende* desde Perú 🇵🇪. Estos son los únicos canales oficiales: desconfía de cualquier otra cuenta que diga ser del juego.\n\n${TEXTO_CREADOR}\n🤖 *Bot oficial:* @duendequest\\_bot\n\n${TEXTO_WHATSAPP}\n\n${TEXTO_SEGURIDAD}`, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [...BOTONES_WHATSAPP, ...BOTONES_CREADOR, BOTON_SEGURIDAD, [{ text: '⌂ Menú', callback_data: 'menu' }]] } });
}

// ── Soporte de compras (Telegram lo exige para cobrar con Stars) ──
// /paysupport y /terms responden texto fijo; /miscompras solo lee. Ninguno
// entrega ni devuelve nada: eso lo hace el dueño a mano.
const REEMBOLSOS_URL = SITE_URL + '/reembolsos.html';
const TERMINOS_URL = SITE_URL + '/terminos.html';
const BOTONES_SOPORTE = [[{ text: '💬 Habla con el creador (WhatsApp)', url: WA_CREADOR }], [{ text: '📄 Entregas y reembolsos', url: REEMBOLSOS_URL }], [{ text: '👤 Escribir a @ElDuendeOficial', url: CREADOR_TG }]];
const TEXTO_PAYSUPPORT = '🆘 Ayuda con un pago\n\n'
  + 'Todas las compras se entregan a mano: El Duende revisa cada pago de ' + ENTREGA.horario + ', ' + ENTREGA.plazo + ' (máximo ' + ENTREGA.plazoMaxH + ' h).\n\n'
  + 'Si pagaste y no recibiste tu compra:\n'
  + '1. Mira su estado con /miscompras (o en el juego: Tienda → 💎 PAQUETES → Tus compras).\n'
  + '2. En el juego, pulsa «¿Problema?» en ese pedido: a El Duende le llega un aviso con tus datos.\n'
  + '3. O habla con el creador del juego por WhatsApp (+51 900 877 863) o escribe a @ElDuendeOficial, con tu número de pedido, la fecha y cuántas Stars pagaste.\n\n'
  + 'Si el pedido no se puede entregar, se anula y Telegram te devuelve las Stars.\n\n'
  + TEXTO_SEGURIDAD;
const TEXTO_TERMS = '📄 Condiciones de compra\n\n'
  + '• Las compras (skins, paquetes de la tienda y $DUENDE) son opcionales. Se pagan con Telegram Stars (también desde la web), o en la web con SOL o $DUENDE.\n'
  + '• Antes de pagar ves el precio y lo que recibes. La entrega es manual, de ' + ENTREGA.horario + ', como máximo en ' + ENTREGA.plazoMaxH + ' h.\n'
  + '• Se devuelven las Stars si pagaste y no se pudo entregar por un error nuestro, si el pedido se anula o si pagaste dos veces lo mismo.\n'
  + '• No se devuelve una compra ya entregada que funciona como se describía. El precio de $DUENDE puede variar mucho: compra solo lo que estés dispuesto a gastar.\n'
  + '• Con dinero no se compran mTON: solo se ganan jugando.\n\n'
  + 'Ayuda con un pago: /paysupport\nTérminos completos: ' + TERMINOS_URL;
async function handlePaySupport(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: TEXTO_PAYSUPPORT, disable_web_page_preview: true, reply_markup: { inline_keyboard: BOTONES_SOPORTE } });
}
async function handleTerms(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: TEXTO_TERMS, disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '📄 Términos completos', url: TERMINOS_URL }], [{ text: '↩️ Entregas y reembolsos', url: REEMBOLSOS_URL }]] } });
}
// Tus pagos con Stars: los pedidos de la tienda del MMO (con su estado) y las
// compras del arcade (Supabase). Solo lectura; si algo no responde, se dice.
async function handleMisCompras(token, env, context, chatId, userId) {
  const tgId = String(userId);
  const ESTADO = { pagado: '⏳ Por entregar', por_verificar: '🔎 En revisión', entregado: '✅ Entregado', anulado: '↩️ Anulado', anulando: '↩️ Anulándose', comprobando: '· Comprobando' };
  const fecha = t => t ? new Date(t).toLocaleString('es', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  let mmo = null, arcade = null;
  try { mmo = await mmoInterno(context.env, 'misCompras', { tgId }); } catch (e) {}
  try { arcade = await supabaseQuery(env, `stars_purchases?telegram_id=eq.${encodeURIComponent(tgId)}&select=tx_id,amount_stars,tokens_credited,created_at&order=created_at.desc&limit=10`); } catch (e) {}
  const lineas = [];
  const cargosMmo = (mmo && mmo.ok && Array.isArray(mmo.cargos)) ? mmo.cargos.slice() : [];
  // Skins del arcade ya activadas: su fila sigue con tokens_credited 0 (no salian como «En revisión» para siempre).
  let skinsOk = [];
  if (Array.isArray(arcade) && arcade.length) {
    const lista = arcade.filter(f => f.tx_id).map(f => '"' + String(f.tx_id).replace(/"/g, '') + '"').join(',');
    try { const sk = lista ? await supabaseQuery(env, `skin_purchases?tx_signature=in.(${encodeURIComponent(lista)})&select=tx_signature,skin_id`) : []; if (Array.isArray(sk)) skinsOk = sk; } catch (e) {}
  }
  if (mmo && mmo.ok) for (const x of (mmo.l || []).slice().reverse()) {
    if (x.estado === 'esperando_pago' || x.estado === 'vencido') continue;
    if (x.charge) cargosMmo.push(x.charge);
    lineas.push(`#${x.codigo} · ${String(x.nombre || '').slice(0, 40)}\n   ${ESTADO[x.estado] || x.estado}${x.pagadoEn ? ' · pagado ' + fecha(x.pagadoEn) : ''}`);
  }
  if (Array.isArray(arcade)) for (const f of arcade) {
    if (!f.tx_id || cargosMmo.includes(f.tx_id)) continue;
    const n = Number(f.tokens_credited);
    const sk = skinsOk.find(x => x.tx_signature === f.tx_id);
    // Sin la lectura del MMO no se sabe si esa compra es un pedido ya entregado.
    lineas.push(`⭐ ${f.amount_stars} Stars · ${fecha(f.created_at)}\n   ${sk ? '✅ Skin activada' : n > 0 ? '✅ Acreditado' : n < 0 ? '↩️ Devuelto' : (mmo && mmo.ok) ? '⏳ En revisión' : '⏳ Estado no disponible ahora'}`);
  }
  const fallo = !(mmo && mmo.ok) || !Array.isArray(arcade);
  let text = lineas.length ? '🧾 Tus compras\n\n' + lineas.slice(0, 12).join('\n\n') : '🧾 No encontramos compras de esta cuenta de Telegram.';
  if (fallo) text += '\n\n⚠️ No pudimos leer todo ahora mismo: prueba otra vez en un rato.';
  text += '\n\nLa entrega es a mano, como máximo en ' + ENTREGA.plazoMaxH + ' h. ¿Algún problema? /paysupport';
  await tg(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, reply_markup: { inline_keyboard: BOTONES_SOPORTE } });
}
// La lista de comandos del menu de Telegram (incluye /paysupport y /terms, que
// Telegram pide a quien cobra con Stars). Una vez por isolate, en segundo plano.
let _comandosListos = false;
const COMANDOS_BOT = [
  ['start', 'Menú principal'], ['play', 'Abrir el juego'], ['mmo', 'CLASSIC: el MMORPG en 2D'], ['mundo', 'ORIGINS: el mundo abierto en 3D'],
  ['yo', 'Tu personaje'], ['topmmo', 'Ranking de la semana'], ['price', 'Precio de $DUENDE'], ['buy', 'Comprar con Stars'],
  ['miscompras', 'Tus compras y su estado'], ['paysupport', 'Ayuda con un pago'], ['terms', 'Condiciones de compra'],
  ['avisos', 'Avisos para volver (on / off)'], ['creador', 'Creador y canales oficiales'], ['help', 'Todos los comandos'],
];
function registrarComandos(token, context) {
  if (_comandosListos || !token) return;
  _comandosListos = true;
  const p = tg(token, 'setMyCommands', { commands: COMANDOS_BOT.map(([command, description]) => ({ command, description })) })
    .then(r => { if (!r || !r.ok) _comandosListos = false; }).catch(() => { _comandosListos = false; });
  if (context && typeof context.waitUntil === 'function') context.waitUntil(p);
}

async function handleHelp(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🧌 *DUENDE QUEST — Comandos*\n\n/start — Menú principal\n/play — Abrir el juego\n/mmo — CLASSIC: el MMORPG en 2D\n/mundo — ORIGINS: el mundo abierto en 3D\n/topmmo — Ranking de la semana del MMO\n/yo — Tu personaje del MMO\n/avisos — Avisos para volver al MMO (on / off)\n/ranking — Top 10\n/stats — Tus estadísticas\n/referral — Tu link para invitar amigos\n/price — Precio de $DUENDE\n/buy — Comprar $DUENDE con Stars\n/miscompras — Tus compras y su estado\n/paysupport — Ayuda con un pago\n/terms — Condiciones de compra\n/creador — Creador y canales oficiales\n/help — Esta ayuda\n\n${TEXTO_SEGURIDAD}\nMás información: ${SEGURIDAD_URL}\n\n${TEXTO_CREADOR}`, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: MUNDO_URL } }], BOTON_SEGURIDAD] } });
}

// ── /admin: métricas privadas (solo el dueño, via env ADMIN_TG_ID) ──
async function handleAdmin(token, env, context, chatId, userId) {
  const adminId = context.env.ADMIN_TG_ID;
  if (!adminId) { await tg(token, 'sendMessage', { chat_id: chatId, text: '⚙️ Configura el secret ADMIN_TG_ID con tu Telegram ID:\n`npx wrangler secret put ADMIN_TG_ID`\n\nTu ID es: `' + userId + '`', parse_mode: 'Markdown' }); return; }
  if (String(userId) !== String(adminId)) return; // silencio total para no-admins

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const [scoresToday, scoresWeek, buysWeek, pendingWd, topToday, redemptions] = await Promise.all([
    supabaseQuery(env, `game_scores?created_at=gte.${today.toISOString()}&select=username`),
    supabaseQuery(env, `game_scores?created_at=gte.${week}&select=username`),
    supabaseQuery(env, `stars_purchases?created_at=gte.${week}&select=amount_usd,amount_stars`),
    supabaseQuery(env, `withdrawal_requests?status=eq.pending&select=tokens_burned,usd_value`),
    supabaseQuery(env, `game_scores?created_at=gte.${today.toISOString()}&verified=is.true&select=username,score&order=score.desc&limit=1`),
    supabaseQuery(env, `redemptions?status=eq.pending&select=id,username,wallet_sol,dq_amount,duende_amount&order=created_at.asc`),
  ]);
  const uniq = a => Array.isArray(a) ? new Set(a.map(s => (s.username || '?').toLowerCase())).size : 0;
  const n = a => Array.isArray(a) ? a.length : 0;
  const usdWeek = (Array.isArray(buysWeek) ? buysWeek : []).reduce((s, b) => s + Number(b.amount_usd || 0), 0);
  const wdUsd = (Array.isArray(pendingWd) ? pendingWd : []).reduce((s, w) => s + Number(w.usd_value || 0), 0);
  const top = Array.isArray(topToday) && topToday[0] ? `${mdSeguro(topToday[0].username)} — ${Number(topToday[0].score).toLocaleString()}` : '—';
  // Canjes DQ → $DUENDE pendientes (con instrucciones de pago)
  let redLines = '';
  if (Array.isArray(redemptions) && redemptions.length) {
    redLines = '\n\n*🎁 CANJES PENDIENTES (' + redemptions.length + ')*\n' + redemptions.slice(0, 10).map(r =>
      `• ${r.duende_amount.toLocaleString()} \$DUENDE → \`${r.wallet_sol}\`\n   _paga y luego:_ /pay ${r.id}`
    ).join('\n');
  } else {
    redLines = '\n\n🎁 Canjes pendientes: *0*';
  }
  const panel = {
    chat_id: chatId,
    text: `📊 *PANEL ADMIN — DUENDE QUEST*\n\n*Hoy*\n🎮 Partidas: *${n(scoresToday)}* · 👥 Jugadores: *${uniq(scoresToday)}*\n🏆 Top: ${top}\n\n*Últimos 7 días*\n🎮 Partidas: *${n(scoresWeek)}* · 👥 Jugadores: *${uniq(scoresWeek)}*\n⭐ Compras: *${n(buysWeek)}* (~$${usdWeek.toFixed(2)})\n\n*Pendiente*\n💸 Retiros TON: *${n(pendingWd)}* (~$${wdUsd.toFixed(2)})${redLines}`,
    parse_mode: 'Markdown',
  };
  const res = await tg(token, 'sendMessage', panel);
  // Si el Markdown no se pudo parsear, el panel llega igual en texto plano
  if (!res || !res.ok) {
    console.error('[admin] panel rechazado', res && res.description);
    delete panel.parse_mode;
    await tg(token, 'sendMessage', panel);
  }
}

// ── /pay <id> [txsig]: marca un canje como pagado (solo admin) ──
async function handlePay(token, env, context, chatId, userId, payload) {
  if (String(userId) !== String(context.env.ADMIN_TG_ID || '')) return;
  const [id, txsig] = payload.trim().split(/\s+/);
  if (!id) { await tg(token, 'sendMessage', { chat_id: chatId, text: 'Uso: /pay <id> [firma_tx]\nVe los IDs con /admin' }); return; }
  const rows = await supabaseQuery(env, `redemptions?id=eq.${encodeURIComponent(id)}&select=telegram_id,duende_amount,status&limit=1`);
  const r = Array.isArray(rows) && rows[0];
  if (!r) { await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ Canje no encontrado' }); return; }
  if (r.status === 'paid') { await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ Ese canje ya está pagado' }); return; }
  await supabaseQuery(env, `redemptions?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'paid', tx_signature: txsig || '', paid_at: new Date().toISOString() } });
  await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ Canje marcado como PAGADO: ${Number(r.duende_amount).toLocaleString()} $DUENDE` });
  // avisar al jugador
  if (r.telegram_id && /^\d+$/.test(String(r.telegram_id))) {
    try {
      await tg(token, 'sendMessage', { chat_id: r.telegram_id, text: `✅ *Canje enviado*\n\n${Number(r.duende_amount).toLocaleString()} $DUENDE están en camino a tu wallet.${txsig ? `\nComprobante: https://solscan.io/tx/${txsig}` : ''}\n\nGracias por jugar.`, parse_mode: 'Markdown' });
    } catch (e) {}
  }
}

// ── /live: anuncia tu stream en Discord + canal de Telegram (solo admin) ──
// Uso: /live  ó  /live Axie Origins  ó  /live Sunflower Land | hoy sorteo!
const GAME_EMOJI = {
  'axie origins': '⚔️', 'axie classic': '🐾', 'axie': '🐾',
  'sunflower land': '🌻', 'sunflower': '🌻', 'roblox': '🟦',
  'duende quest': '🧝', 'irl': '📸', 'just chatting': '💬',
};
async function handleLive(token, env, context, chatId, userId, payload) {
  if (String(userId) !== String(context.env.ADMIN_TG_ID || '')) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: '⛔ Solo el admin puede usar /live' });
    return;
  }
  const kick = context.env.KICK_URL || 'https://kick.com/elduende420kick';
  const [rawGame, ...noteParts] = (payload || '').split('|');
  const game = (rawGame || '').trim();
  const note = noteParts.join('|').trim();
  const emoji = GAME_EMOJI[game.toLowerCase()] || '🎮';
  const playingLine = game ? `${emoji} Jugando: <b>${game}</b>` : '🎮 Stream en vivo';
  const noteLine = note ? `\n📣 ${note}` : '';

  // HTML: no se rompe con los guiones bajos de las URLs
  const msgHtml =
    `🔴 <b>El Duende está en vivo</b>\n\n` +
    `${playingLine}${noteLine}\n\n` +
    `🧝 Mientras ves, puedes jugar <b>DUENDE QUEST</b> gratis en Telegram (con recompensas en $DUENDE)\n` +
    `🪙 $DUENDE en pump.fun`;
  // Versión Discord (texto plano con ** y links visibles)
  const msgDiscord =
    `🔴 **El Duende está en vivo**\n\n` +
    `${(game ? `${emoji} Jugando: **${game}**` : '🎮 Stream en vivo')}${noteLine}\n\n` +
    `**Ver el stream:** ${kick}\n` +
    `🧝 Jugar DUENDE QUEST (gratis, con recompensas en $DUENDE): https://t.me/duendequest_bot\n` +
    `🪙 $DUENDE en pump.fun: ${PUMP_FUN_URL}`;

  const okD = await postDiscord(env, msgDiscord);
  let okT = false;
  if (context.env.TG_CHANNEL_ID) {
    try {
      const r = await tg(token, 'sendMessage', { chat_id: context.env.TG_CHANNEL_ID, text: msgHtml, parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: '🔴 Ver en Kick', url: kick }], [{ text: '🎮 Jugar DUENDE QUEST', url: 'https://t.me/duendequest_bot' }]] } });
      okT = !!r.ok;
    } catch (e) {}
  }
  await tg(token, 'sendMessage', { chat_id: chatId, text: `Anuncio enviado:\n${okD ? '✅' : '❌'} Discord\n${okT ? '✅' : '⚠️ Telegram (falta configurar TG_CHANNEL_ID o el bot no es admin del canal)'}` });
}

async function handlePlay(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: '🎮 *DUENDE QUEST*\n\nToca el botón para abrir el juego.', parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Abrir el juego', web_app: { url: MUNDO_URL } }]] } });
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

// Anti-abuso: tope de actualizaciones por usuario (por isolate). Sin esto, un
// cliente a mano podia mandar /start o botones en bucle y gastar el limite de
// envios del bot para todos. Los pagos salen antes y nunca se cortan.
const RL_VENTANA = 10000, RL_MAX = 8;
const rlUsuarios = new Map();
function demasiadas(id) {
  const ahora = Date.now();
  let e = rlUsuarios.get(id);
  if (!e || ahora - e.t > RL_VENTANA) {
    if (rlUsuarios.size > 5000) { for (const [k, v] of rlUsuarios) if (ahora - v.t > RL_VENTANA) rlUsuarios.delete(k); if (rlUsuarios.size > 5000) rlUsuarios.clear(); }
    e = { t: ahora, n: 0 }; rlUsuarios.set(id, e);
  }
  return ++e.n > RL_MAX;
}

async function onRequestPost(context) {
  const env = getEnv(context);
  const token = env.BOT_TOKEN;

  // ── SECURITY: only Telegram may call this webhook ──
  // setWebhook must be registered with secret_token=TELEGRAM_WEBHOOK_SECRET (see SECURITY-SETUP.md).
  // While the secret is not configured yet, requests pass (backward compat) but are logged.
  const expectedSecret = context.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = context.request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== expectedSecret) return new Response('Unauthorized', { status: 401 });
  } else {
    // Sin secreto, cualquiera podria hacerse pasar por Telegram (comandos de
    // admin, pagos falsos): mejor cerrado que abierto.
    console.error('[SECURITY] TELEGRAM_WEBHOOK_SECRET not set — webhook closed');
    return new Response('Webhook secret not configured', { status: 503 });
  }

  try {
    const body = await context.request.json();

    // Pre-checkout query
    if (body.pre_checkout_query) {
      // Compras de la tienda del MMO: solo se cobra si el pedido sigue abierto
      // (no vencido ni ya pagado), asi nadie paga dos veces lo mismo.
      let pagoOk = true, motivo = '';
      try {
        const pl = JSON.parse(body.pre_checkout_query.invoice_payload || '{}');
        if (pl.mmo) { const v = await mmoInterno(context.env, 'pedidoValido', { codigo: pl.mmo }); pagoOk = !!(v && v.ok); motivo = (v && v.motivo) || ''; }
      } catch (e) {}
      await tg(token, 'answerPreCheckoutQuery', pagoOk
        ? { pre_checkout_query_id: body.pre_checkout_query.id, ok: true }
        : { pre_checkout_query_id: body.pre_checkout_query.id, ok: false, error_message: motivo === 'bienvenida' ? 'El Pack de bienvenida es solo para tu primera compra y ya tienes una pagada. No se te cobró nada.' : 'Este pedido ya venció o ya se pagó. En este intento no se te cobró nada. Si ya lo pagaste, míralo en «Tus compras»; si no, vuelve al juego y pulsa el paquete otra vez.' });
      return new Response('OK');
    }

    // Successful payment
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment;
      const chatId = body.message.chat.id;
      const tgId = String(body.message.from.id);
      const starsPaid = payment.total_amount || 0;
      const chargeId = payment.telegram_payment_charge_id || '';
      const quien = (body.message.from.username ? '@' + body.message.from.username : body.message.from.first_name || '') + ' (tg ' + tgId + ')';
      let codPedido = '';
      // A PRUEBA DE FALLOS: las Stars ya se cobraron. Si algo falla al registrar
      // el pago (MMO caido, Supabase sin responder, error inesperado), al dueño
      // le llega SIEMPRE este aviso (con "Cargo:" para el boton Devolver) y al
      // cliente un "pago recibido, lo revisamos". Nada se entrega solo.
      const avisoFallo = (motivo) => Promise.all([
        context.env.ADMIN_TG_ID ? tg(token, 'sendMessage', { chat_id: context.env.ADMIN_TG_ID, text: `⚠️ Stars cobradas sin pedido confirmado${codPedido ? ' #' + codPedido : ''}\n${starsPaid} Stars · De: ${quien}\nMotivo: ${motivo}\nCargo: ${chargeId || '(sin cargo)'}\n\nRevísalo a mano: si corresponde, entrégalo (/entregar ${codPedido || 'CODIGO'}) o devuelve las Stars.`, disable_web_page_preview: true, reply_markup: chargeId ? { inline_keyboard: [[{ text: '❌ Devolver', callback_data: 'stno:' + chargeId.slice(-40) }]] } : undefined }).catch(() => {}) : null,
        tg(token, 'sendMessage', { chat_id: chatId, text: `✅ Pago recibido (${starsPaid} Stars)${codPedido ? ' · pedido #' + codPedido : ''}\n\nLo revisamos a mano y te avisamos aquí. Si tienes dudas: /paysupport` }).catch(() => {}),
      ]);
      // Respuesta del Durable Object con plazo: si se cuelga, se avisa igual.
      const conPlazo = (p, ms) => Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);
      try {
        const payload = JSON.parse(payment.invoice_payload);
        codPedido = payload && payload.mmo ? String(payload.mmo).slice(0, 12) : '';

        // Anti-replay: never credit the same charge twice
        if (!chargeId) { await avisoFallo('pago sin identificador de cargo'); return new Response('OK'); }
        // Supabase con plazo de 5 s: si se cuelga (lanza), se sigue; el insert de abajo lo decide.
        const dup = await supabaseQuery(env, `stars_purchases?tx_id=eq.${encodeURIComponent(chargeId)}&select=id`).catch(() => null);
        if (Array.isArray(dup) && dup.length > 0) return new Response('OK');

        // Tienda del MMO: se registra el pago (cuenta para el fondo de mTON) y
        // el dueño entrega a mano con /entregar.
        if (payload.mmo) {
          const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: +(starsPaid * STAR_USD).toFixed(2), amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } }).catch(e => ({ error: String((e && e.message) || e) }));   // si Supabase se cuelga, el pedido igual se marca pagado en el MMO
          const regOk = Array.isArray(reg) && reg.length === 1;
          // Fila repetida (23505): es un reintento del webhook, ya se atendio.
          if (!regOk && reg && reg.code === '23505') return new Response('OK');
          let rsp = null;
          try { rsp = await conPlazo(mmoInterno(context.env, 'pedidoPagado', { codigo: payload.mmo, stars: starsPaid, charge: chargeId, tgId }), 15000); } catch (e) { rsp = null; }
          if (!rsp || !rsp.ok) {
            await avisoFallo((!rsp ? 'el MMO no respondió' : 'el MMO no confirmó el pedido (' + String(rsp.error || '?').slice(0, 80) + ')') + (regOk ? '' : '; tampoco quedó en Supabase'));
            return new Response('OK');
          }
          if (!regOk) await avisoFallo('el pedido quedó pagado en el MMO, pero Supabase no guardó el cobro (no cuenta para el fondo)');
          else await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Pago recibido* (${starsPaid} Stars)\n\nCompra: "${mdTexto(rsp.nombre) || 'del MMO'}" · pedido #${codPedido}\n\n${textoPagoRecibido()} Te avisaremos aquí apenas esté lista. Guarda el número de pedido por si necesitas reclamar.`, parse_mode: 'Markdown' });
          return new Response('OK');
        }

        // ENTREGA MANUAL (27-oct-2026, decision del dueño): las compras del arcade con
        // Stars (skin o $DUENDE) se registran con tokens_credited 0 y al dueño le llega el
        // aviso con el comando exacto; el acredita con /starsok tras revisarlo.
        // Botones de un toque (solo el dueño los puede usar): el cargo va recortado
        // (callback_data < 64 bytes) y el completo se lee del propio aviso.
        const botonesStars = [[{ text: '✅ Acreditar', callback_data: 'stok:' + chargeId.slice(-40) }, { text: '❌ Devolver', callback_data: 'stno:' + chargeId.slice(-40) }]];
        const avisarDueno = txt => context.env.ADMIN_TG_ID ? tg(token, 'sendMessage', { chat_id: context.env.ADMIN_TG_ID, text: txt, disable_web_page_preview: true, reply_markup: { inline_keyboard: botonesStars } }).catch(() => {}) : null;
        // Registro del cobro: si falla y no es un reintento (fila repetida 23505), aviso obligatorio.
        const regFallo = reg => !(Array.isArray(reg) && reg.length === 1) && !(reg && reg.code === '23505');
        if (payload.skin_id) {
          const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: starsPaid * STAR_USD, amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } });
          if (regFallo(reg)) { await avisoFallo('Supabase no guardó el cobro de la skin ' + String(payload.skin_id).slice(0, 30)); return new Response('OK'); }
          if (!Array.isArray(reg) || reg.length !== 1) return new Response('OK');   // reintento del webhook
          await avisarDueno(`⭐ Skin del arcade pagada (por revisar)\nSkin: ${payload.skin_id} · ${starsPaid} Stars\nDe: ${quien}\n\nActívala:\n/starsok ${chargeId} skin:${payload.skin_id}`);
          await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Pago recibido* (${starsPaid} Stars)\n\nEl equipo revisa el pago y activa tu skin. ${textoPagoRecibido()} Te avisaremos aquí.`, parse_mode: 'Markdown' });
          return new Response('OK');
        }

        // Compra de $DUENDE: NUNCA se confia en payload.tokens — se recalcula con las Stars pagadas.
        const price = await getPrice();
        const priceUsd = price?.priceUsd || 0.0000001;
        const paidUsd = starsPaid * STAR_USD;
        // Oferta 1ª compra 2x: solo si realmente no tiene compras previas (re-verificado aquí)
        const firstBuyMult = (payload.first_buy && await isFirstPurchase(env, tgId, chargeId)) ? 2 : 1;
        const maxTokens = Math.floor((paidUsd / priceUsd) * 1.05 * firstBuyMult); // 5% price-drift tolerance
        const tokens = Math.max(0, Math.min(parseInt(payload.tokens, 10) || 0, maxTokens)) || maxTokens;
        const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: +paidUsd.toFixed(2), amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } });
        if (regFallo(reg)) { await avisoFallo(`Supabase no guardó el cobro de $DUENDE (le tocarían ${tokens.toLocaleString('es')})`); return new Response('OK'); }
        if (!Array.isArray(reg) || reg.length !== 1) return new Response('OK');
        // Doble control por si dos pagos llegan a la vez: si aparecen otras compras,
        // se avisa al dueño para que no repita la 2x (la cifra la decide el al revisar).
        let otrasCompras = '';
        if (firstBuyMult > 1) {
          const previas = await supabaseQuery(env, `stars_purchases?telegram_id=eq.${encodeURIComponent(tgId)}&tx_id=neq.${encodeURIComponent(chargeId)}&select=id&limit=20`);
          if (Array.isArray(previas) && previas.length) otrasCompras = `\n⚠️ OJO: tiene ${previas.length} compra(s) de Stars anteriores (sin acreditar, skins o MMO); la 2x solo vale para la primera.`;
        }
        await avisarDueno(`⭐ Compra de $DUENDE con Stars (por revisar)\n${starsPaid} Stars (~$${paidUsd.toFixed(2)}) · le tocan ${tokens.toLocaleString('es')} $DUENDE${firstBuyMult > 1 ? ' (oferta 2x de 1ª compra)' : ''}${otrasCompras}\nDe: ${quien}\n\nAcredita:\n/starsok ${chargeId} ${tokens}`);
        await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Pago recibido* (${starsPaid} Stars)\n\nEl equipo revisa el pago y acredita tus $DUENDE en breve. Te avisaremos aquí.`, parse_mode: 'Markdown' });
      } catch(e) {
        // Antes solo se le decia al cliente que escribiera: ahora el dueño se entera siempre.
        console.error('[Bot pago]', e);
        await avisoFallo('error inesperado: ' + String((e && e.message) || e).slice(0, 120));
      }
      return new Response('OK');
    }

    // Grupo oficial (functions/api/grupo.js): /grupo, bienvenida y antiespam.
    if (await grupoWebhook(body, context)) return new Response('OK');

    // Anti-abuso: quien manda demasiadas actualizaciones seguidas se ignora un
    // rato (el admin nunca; pre-checkout y pagos ya respondieron arriba).
    const deId = body.callback_query?.from?.id ?? body.message?.from?.id;
    if (deId && String(deId) !== String(context.env.ADMIN_TG_ID || '') && demasiadas(String(deId))) return new Response('OK');

    // Callback queries
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const data = cb.data;
      const user = cb.from;
      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id });

      if (data.startsWith('buy_')) {
        const pkgIndex = parseInt(data.replace('buy_', ''), 10);
        const invoiceUrl = await createStarsInvoice(token, env, pkgIndex, String(user.id));
        if (invoiceUrl) await tg(token, 'sendMessage', { chat_id: chatId, text: '⭐ Toca el botón para pagar con Stars. El pago se hace dentro de Telegram.', reply_markup: { inline_keyboard: [[{ text: '💳 Pagar con Stars', url: invoiceUrl }]] } });
        else await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ No se pudo crear la factura. Inténtalo de nuevo en un momento.' });
        return new Response('OK');
      }

      // Botones de las compras del arcade con Stars (solo el dueño): acreditar con
      // un toque (lo mismo que /starsok, con la cifra del propio aviso) o devolver
      // las Stars (pide confirmación: no se deshace).
      const mSt = /^st(ok|no|no2):([A-Za-z0-9_.-]{6,40})$/.exec(data);
      if (mSt) {
        if (String(user.id) !== String(context.env.ADMIN_TG_ID || '')) return new Response('OK');
        // El cargo completo sale del mensaje del bot ("/starsok CARGO X" o "Cargo: X").
        const txtMsg = cb.message.text || '';
        const mCmd = /\/starsok (\S+) (\S+)/.exec(txtMsg);
        const cargo = mCmd ? mCmd[1] : ((/Cargo: (\S+)/.exec(txtMsg) || [])[1] || '');
        if (!cargo || !cargo.endsWith(mSt[2])) { await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ No encontré el cargo en el aviso. Usa /starsok a mano.' }); return new Response('OK'); }
        const sinBotones = () => tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        if (mSt[1] === 'ok') {
          if (!mCmd) return new Response('OK');
          await sinBotones();
          await handleMmoAdmin(token, context, chatId, user.id, '/starsok', cargo + ' ' + mCmd[2]);
          return new Response('OK');
        }
        // "(tg 123)" del aviso: pasa a la confirmacion por si el cobro no quedo en Supabase.
        // Se toma el ULTIMO: el nombre del jugador va antes y podria traer un "(tg N)" falso.
        const tgAviso = ([...txtMsg.matchAll(/\(tg (\d{3,20})\)/g)].pop() || [])[1] || '';
        if (mSt[1] === 'no') {
          await tg(token, 'sendMessage', { chat_id: chatId, text: `¿Devolver las Stars de esta compra? No se deshace.\nCargo: ${cargo}${tgAviso ? '\nDe: (tg ' + tgAviso + ')' : ''}`, reply_markup: { inline_keyboard: [[{ text: '↩️ Sí, devolver', callback_data: 'stno2:' + mSt[2] }]] } });
          return new Response('OK');
        }
        await sinBotones();
        let txt;
        try { txt = await devolverStarsArcade(context, token, cargo, tgAviso); } catch (e) { txt = '❌ No se pudo devolver ahora. Prueba otra vez en un rato.'; }
        await tg(token, 'sendMessage', { chat_id: chatId, text: txt });
        return new Response('OK');
      }

      // "⏳ En 1 h / Mañana" del aviso de un pedido del MMO: al jugador le llega
      // una plantilla y al dueño un recordatorio a esa hora. No entrega nada.
      if (/^mmo(1h|man):[A-Z0-9]{4,10}$/.test(data)) {
        if (String(user.id) !== String(context.env.ADMIN_TG_ID || '')) return new Response('OK');
        const [acc, codigo] = data.split(':');
        let r = null;
        try { r = await mmoInterno(context.env, 'posponer', { codigo, cuando: acc === 'mmoman' ? 'man' : '1h' }); } catch (e) {}
        const hora = r && r.cuando ? new Date(r.cuando).toLocaleString('es', { timeZone: 'America/Lima', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const txt = !r ? '❌ No se pudo hablar con el MMO ahora. Prueba otra vez.'
          : !r.ok ? '❌ ' + r.error
          : `⏳ Pedido #${r.pedido.codigo}: ${r.avisado ? 'le avisé a ' + r.pedido.jugador + ' que llega ' + (acc === 'mmoman' ? 'mañana' : 'en 1 h') : 'al jugador ya se le avisó hace poco'}. Te lo recuerdo el ${hora} (hora de Perú).`;
        await tg(token, 'sendMessage', { chat_id: chatId, text: txt });
        return new Response('OK');
      }

      // Botones del aviso de un pedido del MMO (solo el dueño): entregar con un
      // toque; anular pide confirmación (no se deshace).
      if (/^mmo(ent|anu|anu2):[A-Z0-9]{4,10}$/.test(data)) {
        if (String(user.id) !== String(context.env.ADMIN_TG_ID || '')) return new Response('OK');
        const [acc, codigo] = data.split(':');
        if (acc === 'mmoanu') {
          await tg(token, 'sendMessage', { chat_id: chatId, text: `¿Anular el pedido #${codigo}? Si pagó con SOL, el SOL lo devuelves tú.`, reply_markup: { inline_keyboard: [[{ text: '❌ Sí, anular', callback_data: 'mmoanu2:' + codigo }]] } });
          return new Response('OK');
        }
        let r = null;
        try { r = await mmoInterno(context.env, acc === 'mmoent' ? 'entregar' : 'anular', acc === 'mmoent' ? { codigo } : { codigo, motivo: 'anulado por El Duende' }); } catch (e) {}
        // Se quitan los botones del aviso para no pulsarlos dos veces, pero solo si
        // ya no tiene sentido reintentar (hecho, o el pedido ya no está abierto).
        // Con fallo de red o «ya se está entregando» se quedan para reintentar.
        if (r && (r.ok || /No hay un pedido pagado|no se puede anular/i.test(r.error || ''))) await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        const txt = !r ? '❌ No se pudo hablar con el MMO ahora. Prueba con el comando.'
          : !r.ok ? '❌ ' + r.error
          : acc === 'mmoent' ? `🎁 Pedido #${r.pedido.codigo} entregado a ${r.pedido.jugador}: ${r.pedido.nombre}. Se le avisó.`
          : `❌ Pedido #${r.pedido.codigo} anulado.${r.reembolso || (r.pedido.metodo === 'sol' ? ' Si llegó SOL, devuélvelo tú desde tu wallet.' : r.pedido.metodo === 'yape' ? ' Si llegó el Yape/Plin, devuélvelo tú desde tu app.' : '')}`;
        await tg(token, 'sendMessage', { chat_id: chatId, text: txt });
        return new Response('OK');
      }

      // Boton "No quiero más avisos" de los avisos de vuelta del MMO.
      if (data === 'mmoavisos:off') {
        let r = null;
        try { r = await mmoInterno(context.env, 'avisos', { tgId: String(user.id), on: false }); } catch (e) {}
        if (r && r.ok) {
          // Se quita el boton del aviso para que no quede algo que ya no hace nada.
          // Se conserva la primera fila del aviso original (puede apuntar a ORIGINS o a CLASSIC).
          const fila = ((body.callback_query.message || {}).reply_markup || {}).inline_keyboard?.[0];
          await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: fila && !fila.some(b => b && b.callback_data === 'mmoavisos:off') ? [fila] : [] } }).catch(() => {});
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: r && r.ok ? '🔕 Listo: no te mandaremos más avisos para volver al juego.\n\nSi cambias de idea: /avisos on' : '❌ No se pudo guardar ahora. Prueba otra vez o escribe /avisos off' });
        return new Response('OK');
      }

      switch (data) {
        case 'ranking': await handleRanking(token, env, chatId, messageId); break;
        case 'topmmo': await handleTopMmo(token, env, chatId, messageId); break;
        case 'yo': await handleYo(token, env, chatId, user.id); break;
        case 'price': await handlePrice(token, chatId, messageId); break;
        case 'stats': await handleStats(token, env, chatId, user.id, messageId); break;
        case 'referral': await handleReferralCmd(token, chatId, user.id, messageId); break;
        case 'buy': await handleBuy(token, chatId, user.id, messageId); break;
        case 'menu': await handleStart(token, env, chatId, user, '', true); break;
        case 'creador': await handleCreador(token, chatId); break;
      }
      return new Response('OK');
    }

    // Messages
    if (body.message) {
      registrarComandos(token, context);
      const msg = body.message;
      const chatId = msg.chat.id;
      const user = msg.from;
      const text = (msg.text || '').trim();
      const [rawCmd, ...pp] = text.split(' ');
      const cmd = rawCmd.split('@')[0].toLowerCase();
      const payload = pp.join(' ');

      switch (cmd) {
        case '/start':
          // «Avísame por Telegram» de un jugador web o invitado: t.me/duendequest_bot?start=av_<codigo>.
          // Lo pidio el en el juego y acaba de abrir el chat: solo se le contesta a el.
          if (/^av_[a-z0-9]{10}$/.test(payload || '')) {
            if (msg.chat.type !== 'private') break;
            let r = null;
            try { r = await mmoInterno(context.env, 'avisoTg', { cod: payload.slice(3), chatId: String(chatId) }); } catch (e) {}
            const txt = r && r.ok
              ? `🔔 ¡Listo${r.nombre ? ', ' + r.nombre : ''}! Te avisaremos aquí (como mucho una vez al día) cuando tengas algo pendiente en DUENDE QUEST: tu racha, la caza del día o un evento.` +
                (r.oro ? `\n\n🎁 +${r.oro} de oro ya están en tu personaje.` : '') +
                (r.off ? '\n\n⚠️ Tenías los avisos desactivados en este chat: escribe /avisos on para recibirlos.' : '\n\nPara dejar de recibirlos: /avisos off')
              : r && r.caducado ? '⌛ Ese enlace ya caducó (dura 10 minutos). Vuelve al juego y toca otra vez «Avísame por Telegram».'
              : '❌ No se pudo activar ahora. Vuelve al juego y prueba otra vez en un rato.';
            await tg(token, 'sendMessage', { chat_id: chatId, text: txt, disable_web_page_preview: true });
            break;
          }
          // Invitacion: t.me/duendequest_bot?start=mmo_<codigo> (CLASSIC, enlaces viejos)
          // o m3d_<codigo> (ORIGINS 3D). Responde solo a quien escribio /start.
          if (/^(mmo|m3d)_[a-z0-9]{6}$/.test(payload || '')) {
            const es3d = payload.startsWith('m3d_'), cod = payload.slice(4);
            let quien = 'Un amigo';
            try { const r = await mmoInterno(context.env, 'invitador', { ref: cod }); if (r && r.ok && r.n) quien = mdSeguro(r.n) + ' (Nv ' + (Number(r.lv) || 1) + ')'; } catch (e) {}
            const intro = es3d ? 'Mundo abierto en 3D, gratis y sin descargas: vuela con alas, explora con tu amigo y entren juntos a la Cueva de los Goblins.' : 'MMORPG de duendes al estilo WoW, gratis y sin descargas: elige tu clase, haz grupo con tu amigo y entren juntos a las mazmorras.';
            await tg(token, 'sendMessage', { chat_id: chatId, text: '🤝 *' + quien + ' te invita a DUENDE QUEST' + (es3d ? ' 3D' : ' ONLINE') + '*\n\n' + intro + ' Cuando llegues al nivel 10, los dos reciben oro del juego.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: es3d ? '🌌 Entrar al mundo 3D' : '🌍 Entrar al mundo', web_app: { url: (es3d ? MUNDO_URL : MMO_URL) + '?ref=' + cod } }]] } });
            break;
          }
          // Anuncio: t.me/duendequest_bot?start=ad_<campaña> (Meta, la web: ad_web...).
          // Bienvenida corta SIN cripto (ni TON ni $DUENDE) y el juego con utm_source=tg_ad,
          // que activa el modo anuncio de origen.js. Solo responde a este /start.
          if (/^ad_[a-z0-9_]{1,40}$/.test(payload || '')) {
            const cmp = payload.slice(3);
            try { await Promise.race([mmoInterno(context.env, 'tgOrigen', { tgId: String(user.id), c: cmp }), new Promise(res => setTimeout(res, 4000))]); } catch (e) {}
            await tg(token, 'sendMessage', { chat_id: chatId, text: '🧌 *¡Bienvenido a DUENDE QUEST!*\nRPG de duendes gratis y sin descargas: elige tu clase, sube de nivel y explora el mundo con tus amigos.', parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar gratis', web_app: { url: MUNDO_URL + '?utm_source=tg_ad&utm_campaign=' + cmp } }], [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL + '?utm_source=tg_ad&utm_campaign=' + cmp } }]] } });
            break;
          }
          await handleStart(token, env, chatId, user, payload); break;
        case '/play': case '/jugar': await handlePlay(token, chatId); break;
        case '/mundo': case '/3d':
          await tg(token, 'sendMessage', { chat_id: chatId, text: '🌌 *DUENDE QUEST 3D*\nEl mundo abierto con tu mismo personaje: vuela con alas, entra a la Cueva de los Goblins y, desde el nivel 20, elige facción en el Abismo de Éter.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌌 Entrar al mundo 3D', web_app: { url: MUNDO_URL } }], BOTON_SEGURIDAD] } });
          break;
        case '/mmo': case '/online':
          await tg(token, 'sendMessage', { chat_id: chatId, text: '*DUENDE QUEST ONLINE*\nRPG online de duendes. Gratis, en Telegram y en el navegador.\n\n• 4 clases, grupos y hermandades\n• 6 mazmorras, la banda del Titán y la Torre del Duende\n• Jefe mundial cada 30 minutos\n• Pesca, expediciones y artesanía\n• 10 zonas hasta el nivel 60\n• Mundo abierto en 3D: vuelo con alas, el Abismo de Éter y PvP de facciones\n\n*Skins:* dan bonificaciones; se compran con oro del juego o con Stars.\n*Chicha morada:* con 25.000 puntos de caza te enviamos un litro a casa.\n*mTON (opcional):* desde Nv 15, jefes y caza del día reparten un fondo diario. 1.000 mTON = 1 TON; retiro desde 5 TON, revisado a mano.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌍 Entrar al mundo', web_app: { url: MMO_URL } }], [{ text: '🌌 Mundo abierto 3D', web_app: { url: MUNDO_URL } }], [{ text: '🏆 Ranking de la semana', callback_data: 'topmmo' }, { text: '🧝 Mi personaje', callback_data: 'yo' }], BOTON_SEGURIDAD] } });
          break;
        case '/ranking': case '/top': await handleRanking(token, env, chatId); break;
        case '/topmmo': case '/torre': await handleTopMmo(token, env, chatId); break;
        case '/yo': case '/personaje': await handleYo(token, env, chatId, user.id); break;
        case '/price': case '/precio': await handlePrice(token, chatId); break;
        case '/stats': await handleStats(token, env, chatId, user.id); break;
        case '/referral': case '/ref': await handleReferralCmd(token, chatId, user.id); break;
        case '/buy': case '/comprar': case '/stars': await handleBuy(token, chatId, user.id); break;
        case '/help': case '/ayuda': await handleHelp(token, chatId); break;
        case '/paysupport': case '/soporte': await handlePaySupport(token, chatId); break;
        case '/terms': case '/terminos': await handleTerms(token, chatId); break;
        case '/miscompras': case '/compras': await handleMisCompras(token, env, context, chatId, user.id); break;
        case '/creador': case '/creator': case '/oficial': await handleCreador(token, chatId); break;
        case '/retiros': case '/pagado': case '/rechazar': case '/fondo': case '/pedidos': case '/ventas': case '/entregar': case '/anular': case '/mmostats': case '/gasto': case '/chicha': case '/chichasin': case '/chichacoord': case '/chichalibera': case '/chichaok': case '/chichano': case '/chichatel': case '/skinweb': case '/starsok': await handleMmoAdmin(token, context, chatId, user.id, cmd, payload); break;
        case '/avisos': await handleAvisos(token, context, chatId, user.id, payload); break;
        case '/admin': await handleAdmin(token, env, context, chatId, user.id); break;
        case '/live': case '/envivo': await handleLive(token, env, context, chatId, user.id, payload); break;
        case '/pay': case '/pagar': await handlePay(token, env, context, chatId, user.id, payload); break;
        case '/announce': case '/anuncio': {
          if (String(user.id) !== String(context.env.ADMIN_TG_ID || '')) break; // solo admin
          if (!payload.trim()) { await tg(token, 'sendMessage', { chat_id: chatId, text: 'Uso: /announce tu mensaje aquí — se publica en Discord #anuncios' }); break; }
          const ok = await postDiscord(env, payload.trim());
          await tg(token, 'sendMessage', { chat_id: chatId, text: ok ? '✅ Publicado en Discord' : '❌ No se pudo publicar (¿webhook configurado?)' });
          break;
        }
        default:
          // Texto libre ('hola', 'no carga') o comando desconocido: solo en chat privado
          // y solo a quien acaba de escribir, para que el bot no parezca muerto.
          // En grupos calla. Sin precios ni cripto (eso solo con /price y /buy).
          if (msg.chat && msg.chat.type === 'private' && text && !(user && user.is_bot)) {
            await tg(token, 'sendMessage', { chat_id: chatId, text: '🧌 Soy el bot de DUENDE QUEST. Toca «Jugar gratis» para entrar (sin descargas). Todos los comandos: /help', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar gratis (3D)', web_app: { url: MUNDO_URL } }], [{ text: '🌍 CLASSIC (2D)', web_app: { url: MMO_URL } }], BOTON_SEGURIDAD] } });
          }
          break;
      }
    }

    return new Response('OK');
  } catch (err) {
    console.error('[Bot Error]', err);
    return new Response('OK');
  }
}

export default { onRequestPost };
