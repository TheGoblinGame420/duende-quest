// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Telegram Bot Webhook (Cloudflare Pages Function)
// ═══════════════════════════════════════════════════════

const WEBAPP_URL = 'https://duende-quest.alfonso12hc.workers.dev/telegram/index.html';
const SITE_URL = 'https://duende-quest.alfonso12hc.workers.dev';
// Exportada: los avisos de vuelta del MMO (functions/mmo/retencion.js) usan la misma.
export const MMO_URL = 'https://duende-quest.alfonso12hc.workers.dev/mmo/';
// El mundo abierto en 3D (el mismo personaje y servidor que el MMO).
export const MUNDO_URL = 'https://duende-quest.alfonso12hc.workers.dev/mundo/';
// El creador del juego y sus canales oficiales: se muestran en /start y
// /creador para que cualquiera pueda comprobar quién está detrás del juego.
const CREADOR_TG = 'https://t.me/ElDuendeOficial';
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

async function supabaseQuery(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return r.json();
}

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

// ¿Primera compra? (server-side; se re-verifica al acreditar el pago)
async function isFirstPurchase(env, tgId) {
  if (!tgId) return false;
  const rows = await supabaseQuery(env, `stars_purchases?telegram_id=eq.${encodeURIComponent(tgId)}&tokens_credited=gt.0&select=id&limit=1`);
  return Array.isArray(rows) && rows.length === 0;
}

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
    description: `${firstBuy ? 'Primera compra: cantidad doble. ' : ''}${tokens.toLocaleString()} tokens $DUENDE por ${pkg.stars} Stars (~$${pkg.usd} USD). Se acreditan al instante en tu saldo del juego.`,
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
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `🧌 *Bienvenido a DUENDE QUEST, ${mdSeguro(user.first_name || 'Duende')}*\n\nJuego de duendes gratis y sin descargas: juega aquí en Telegram o en el navegador.\n\n🎮 *Arcade:* campaña de 15 etapas con jefes y ranking global.\n🌍 *DUENDE QUEST ONLINE:* MMORPG estilo WoW con 4 clases, grupos, mazmorras con jefes, hermandades y 10 zonas hasta el nivel 60.\n🥤 *Premio:* junta 10.000 puntos cazando en el MMO y te enviamos un litro de chicha morada a tu casa. No es un sorteo: lo ganas jugando.\n💎 *Recompensas en TON (opcional):* desde el nivel 15, los jefes del MMO dan mTON del fondo del día, si lo hay (1.000 mTON = 1 TON). Retiro desde 5 TON.\n🪙 *$DUENDE:* token del juego en Solana; también se gana jugando.\n\n${TEXTO_SEGURIDAD}\nMás información: ${SEGURIDAD_URL}\n\n${TEXTO_CREADOR}\n\n*Invita a un amigo* (500 $DUENDE para cada uno):\n\`${referralLink}\``,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [
      [{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }],
      [{ text: '🌍 Jugar el MMO online', web_app: { url: MMO_URL } }],
      [{ text: '🌌 Mundo abierto 3D', web_app: { url: MUNDO_URL } }],
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
function mdSeguro(t) { return String(t || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20) || '?'; }

async function handleRanking(token, env, chatId, messageId) {
  const rows = await supabaseQuery(env, 'game_scores?select=username,score,wave&order=score.desc&limit=50');
  // Una entrada por jugador: su mejor score
  const best = new Map();
  if (Array.isArray(rows)) for (const s of rows) { const k = (s.username || '?').toLowerCase(); if (!best.has(k) || s.score > best.get(k).score) best.set(k, s); }
  const scores = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  let text = '🏆 *Top 10 — DUENDE QUEST*\n\n';
  if (scores.length === 0) text += '_Aún no hay puntuaciones._';
  else { const medals = ['🥇','🥈','🥉']; scores.forEach((s,i) => { text += `${medals[i]||`${i+1}.`} *${mdSeguro(s.username)}* — ${s.score.toLocaleString()} pts (oleada ${s.wave})\n`; }); }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'ranking' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
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
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌍 Entrar al mundo', web_app: { url: MMO_URL } }], [{ text: '🔄 Actualizar', callback_data: 'topmmo' }]] } };
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
  let text;
  if (!Array.isArray(profiles) || profiles.length === 0) text = '📊 *Tus estadísticas*\n\n_Aún no tienes perfil. Juega una partida para crearlo._';
  else { const p = profiles[0]; text = `📊 *Estadísticas de ${mdSeguro(p.username||'Duende')}*\n\n🏆 Mejor puntuación: *${Number(p.best_score||0).toLocaleString()}*\n🌊 Mejor oleada: *${p.best_wave||0}*\n🪙 Monedas: *${Number(p.total_coins||0).toLocaleString()}*\n🎮 Partidas: *${p.games_played||0}*\n💎 $DUENDE: *${Number(p.duende_balance||0).toLocaleString()}*`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'stats' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
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
  text += '\nLos tokens se acreditan al instante en tu saldo del juego. La cantidad depende del precio del momento, que puede variar mucho: compra solo lo que estés dispuesto a gastar.';
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
async function handleMmoAdmin(token, context, chatId, userId, cmd, payload) {
  if (String(userId) !== String(context.env.ADMIN_TG_ID || '')) return; // silencio para no-admins
  const env = context.env;
  const enviar = text => tg(token, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
  const [arg1, arg2] = payload.trim().split(/\s+/);
  const fondoTxt = f => `Fondo de hoy: ${(f.total / 1000).toFixed(3)} TON (auto ${(f.auto / 1000).toFixed(3)} + tuyo ${(f.extra / 1000).toFixed(3)}) · repartido ${(f.gastado / 1000).toFixed(3)} TON`;
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
    if (!r.pedidos.length) return enviar('✅ No hay compras por entregar.');
    const lineas = r.pedidos.map(x => `#${x.codigo} · ${x.nombre} ($${x.usd}) · ${x.jugador}\n` + (x.metodo === 'stars'
      ? `⭐ ${x.starsPagadas} Stars pagadas (verificado por Telegram)`
      : (x.metodo === 'duende' ? `🍄 ${(x.duendeRaw / 1e6).toLocaleString('es')} $DUENDE` : `◎ ${(x.lamports / 1e9).toFixed(9)} SOL`) + ` · ${x.cadena ? (x.cadena.ok ? '✅ visto en la cadena' : '❌ ' + x.cadena.motivo) : '⚠️ sin comprobar'}\nhttps://solscan.io/tx/${x.firma}`));
    return enviar('🛒 Compras por entregar:\n\n' + lineas.join('\n\n') + '\n\n/entregar CODIGO para darle lo que compró · /anular CODIGO motivo para cancelar (las Stars se devuelven solas; el SOL lo devuelves tú).');
  }
  if (cmd === '/ventas') {
    const r = await mmoInterno(env, 'ventas');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const bloque = (t, x) => `${t}: ${x.n} venta${x.n === 1 ? '' : 's'} · $${x.usd} (◎ ${x.sol} con SOL · ⭐ ${x.stars} con Stars)` + (x.top.length ? '\n' + x.top.map(y => `  · ${y.nombre}: ${y.n} ($${Math.round(y.usd * 100) / 100})`).join('\n') : '');
    return enviar('🛒 Ventas del MMO (entregadas)\n\n' + bloque('Últimos 7 días', r.d7) + '\n\n' + bloque('Últimos 30 días', r.d30) + `\n\n⏳ Por entregar: ${r.pendientes}` + (r.pendientes ? ' (/pedidos)' : '') + ` · ❌ Anuladas (30 d): ${r.anulados30}`);
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
    return enviar(r.ok ? `❌ Pedido #${r.pedido.codigo} anulado.${r.reembolso || (r.pedido.metodo === 'sol' ? ' Si llegó SOL, devuélvelo tú desde tu wallet.' : '')}` : '❌ ' + r.error);
  }
  // Premio de chicha morada (functions/mmo/chicha.js).
  if (cmd === '/chicha') {
    const r = await mmoInterno(env, 'chichas');
    if (!r.ok) return enviar('❌ ' + (r.error || 'error'));
    const cab = `🥤 Litros de este mes: ${r.mes}/${r.mesMax}\n\n`;
    if (!r.pendientes.length) return enviar(cab + '✅ No hay premios de chicha por enviar.');
    const lineas = r.pendientes.map(x => `#${x.id} · ${x.nombre} Nv${x.nivel} · ${x.meta.toLocaleString('es')} pts\nContacto: tg://user?id=${x.uid.slice(3)} (id ${x.uid.slice(3)})`);
    return enviar(cab + lineas.join('\n\n') + '\n\nEscríbele para pedir la dirección. Enviado: /chichaok CODIGO · No se puede: /chichano CODIGO motivo (añade "trampa" al final para que no pueda volver a reclamarlo).');
  }
  if (cmd === '/chichaok' || cmd === '/chichano') {
    if (!arg1) return enviar('Uso: ' + cmd + ' CODIGO' + (cmd === '/chichano' ? ' motivo' : ''));
    const resto = payload.trim().split(/\s+/).slice(1);
    const trampa = resto[resto.length - 1] === 'trampa';
    const r = await mmoInterno(env, cmd === '/chichaok' ? 'chichaOk' : 'chichaNo', { id: arg1, motivo: resto.filter(x => x !== 'trampa').join(' '), trampa });
    return enviar(r.ok ? `🥤 Premio #${r.chicha.id} marcado como ${r.chicha.estado}. Se le avisó al jugador.` : '❌ ' + r.error);
  }
  if (cmd === '/mmostats') {
    const r = await mmoInterno(env, 'stats');
    return enviar(r && r.ok ? textoMmoStats(r) : '❌ ' + ((r && r.error) || 'error'));
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

// /mmostats: la retencion real del MMO (la calcula functions/mmo/retencion.js).
// Texto plano: los nombres del top los eligen los jugadores.
function textoMmoStats(r) {
  const dm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
  const ret = x => x.pct === null ? '— (aún sin cohortes completas)' : `${String(x.pct).replace('.', ',')}% (${x.vuelven} de ${x.base})`;
  const dato = v => v === null ? '…' : v;
  const a = r.activos, t = r.tipos30;
  const tramos = Object.entries(r.niveles30).sort((x, y) => parseInt(x[0]) - parseInt(y[0])).map(([k, v]) => `Nv ${k}: ${v}`).join(' · ') || '—';
  const altas = r.altas.map(x => `${dm(x.dia)} ${x.n}`).join(' · ');
  const cohortes = r.cohortes.slice(0, 10).map(x => `${dm(x.dia)}: ${x.n} alta${x.n === 1 ? '' : 's'} → D1 ${dato(x.d1)} · D7 ${dato(x.d7)} · D30 ${dato(x.d30)}`).join('\n') || 'Aún no hay altas registradas.';
  const top = r.top.map((x, i) => `${i + 1}. ${String(x.n || '?').slice(0, 20)} — Nv ${x.lv}`).join('\n') || '—';
  return `📊 DUENDE QUEST ONLINE — retención (${r.hoy}, días UTC)\n\n` +
    `👥 Activos: hoy ${a.hoy} · 7 días ${a.d7} · 30 días ${a.d30} (en línea ahora: ${r.online})\n` +
    `   En 30 días: ${t.tg} Telegram · ${t.web} web · ${t.inv} invitados\n` +
    `   Niveles: ${tramos}\n` +
    `⏱️ Sesión media (7 días): ${String(r.sesion.media).replace('.', ',')} min · ${r.sesion.sesiones7} sesiones · ${r.sesion.minutos7} min en total\n\n` +
    `🆕 Altas por día (últimos 14):\n${altas}\n\n` +
    `🔁 Retención (últimas 30 cohortes con el día ya cumplido):\n` +
    `D1: ${ret(r.retencion.d1)}\nD7: ${ret(r.retencion.d7)}\nD30: ${ret(r.retencion.d30)}\n\n` +
    `📅 Cohortes recientes (cuántos volvieron ese día exacto; … = aún no llega):\n${cohortes}\n\n` +
    `🏆 Top niveles:\n${top}\n\n` +
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
  const boton = { inline_keyboard: [[{ text: '🌍 Entrar al mundo', web_app: { url: MMO_URL } }]] };
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
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🧌 *DUENDE QUEST — ¿Quién está detrás?*\n\nEl juego lo crea y mantiene *El Duende* desde Perú 🇵🇪. Estos son los únicos canales oficiales: desconfía de cualquier otra cuenta que diga ser del juego.\n\n${TEXTO_CREADOR}\n🤖 *Bot oficial:* @duendequest\\_bot\n\n${TEXTO_SEGURIDAD}`, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [...BOTONES_CREADOR, BOTON_SEGURIDAD, [{ text: '⌂ Menú', callback_data: 'menu' }]] } });
}

async function handleHelp(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🧌 *DUENDE QUEST — Comandos*\n\n/start — Menú principal\n/play — Abrir el juego\n/mmo — DUENDE QUEST ONLINE (MMORPG)\n/mundo — El mundo abierto en 3D\n/topmmo — Ranking de la semana del MMO\n/yo — Tu personaje del MMO\n/avisos — Avisos para volver al MMO (on / off)\n/ranking — Top 10\n/stats — Tus estadísticas\n/referral — Tu link para invitar amigos\n/price — Precio de $DUENDE\n/buy — Comprar $DUENDE con Stars\n/creador — Creador y canales oficiales\n/help — Esta ayuda\n\n${TEXTO_SEGURIDAD}\nMás información: ${SEGURIDAD_URL}\n\n${TEXTO_CREADOR}`, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }], BOTON_SEGURIDAD] } });
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
    supabaseQuery(env, `game_scores?created_at=gte.${today.toISOString()}&select=username,score&order=score.desc&limit=1`),
    supabaseQuery(env, `redemptions?status=eq.pending&select=id,username,wallet_sol,dq_amount,duende_amount&order=created_at.asc`),
  ]);
  const uniq = a => Array.isArray(a) ? new Set(a.map(s => (s.username || '?').toLowerCase())).size : 0;
  const n = a => Array.isArray(a) ? a.length : 0;
  const usdWeek = (Array.isArray(buysWeek) ? buysWeek : []).reduce((s, b) => s + Number(b.amount_usd || 0), 0);
  const wdUsd = (Array.isArray(pendingWd) ? pendingWd : []).reduce((s, w) => s + Number(w.usd_value || 0), 0);
  const top = Array.isArray(topToday) && topToday[0] ? `${topToday[0].username} — ${Number(topToday[0].score).toLocaleString()}` : '—';
  // Canjes DQ → $DUENDE pendientes (con instrucciones de pago)
  let redLines = '';
  if (Array.isArray(redemptions) && redemptions.length) {
    redLines = '\n\n*🎁 CANJES PENDIENTES (' + redemptions.length + ')*\n' + redemptions.slice(0, 10).map(r =>
      `• ${r.duende_amount.toLocaleString()} \$DUENDE → \`${r.wallet_sol}\`\n   _paga y luego:_ /pay ${r.id}`
    ).join('\n');
  } else {
    redLines = '\n\n🎁 Canjes pendientes: *0*';
  }
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `📊 *PANEL ADMIN — DUENDE QUEST*\n\n*Hoy*\n🎮 Partidas: *${n(scoresToday)}* · 👥 Jugadores: *${uniq(scoresToday)}*\n🏆 Top: ${top}\n\n*Últimos 7 días*\n🎮 Partidas: *${n(scoresWeek)}* · 👥 Jugadores: *${uniq(scoresWeek)}*\n⭐ Compras: *${n(buysWeek)}* (~$${usdWeek.toFixed(2)})\n\n*Pendiente*\n💸 Retiros TON: *${n(pendingWd)}* (~$${wdUsd.toFixed(2)})${redLines}`,
    parse_mode: 'Markdown',
  });
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
  await tg(token, 'sendMessage', { chat_id: chatId, text: '🎮 *DUENDE QUEST*\n\nToca el botón para abrir el juego.', parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Abrir el juego', web_app: { url: WEBAPP_URL } }]] } });
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
      let pagoOk = true;
      try {
        const pl = JSON.parse(body.pre_checkout_query.invoice_payload || '{}');
        if (pl.mmo) pagoOk = !!(await mmoInterno(context.env, 'pedidoValido', { codigo: pl.mmo })).ok;
      } catch (e) {}
      await tg(token, 'answerPreCheckoutQuery', pagoOk
        ? { pre_checkout_query_id: body.pre_checkout_query.id, ok: true }
        : { pre_checkout_query_id: body.pre_checkout_query.id, ok: false, error_message: 'Este pedido ya venció o ya se pagó. Vuelve a pedirlo desde el juego.' });
      return new Response('OK');
    }

    // Successful payment
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment;
      const chatId = body.message.chat.id;
      const tgId = String(body.message.from.id);
      try {
        const payload = JSON.parse(payment.invoice_payload);
        const starsPaid = payment.total_amount || 0;
        const chargeId = payment.telegram_payment_charge_id || '';

        // Anti-replay: never credit the same charge twice
        if (!chargeId) return new Response('OK');
        const dup = await supabaseQuery(env, `stars_purchases?tx_id=eq.${encodeURIComponent(chargeId)}&select=id`);
        if (Array.isArray(dup) && dup.length > 0) return new Response('OK');

        // Tienda del MMO: se registra el pago (cuenta para el fondo de mTON) y
        // el dueño entrega a mano con /entregar.
        if (payload.mmo) {
          const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: +(starsPaid * STAR_USD).toFixed(2), amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } });
          if (!Array.isArray(reg) || reg.length !== 1) return new Response('OK');
          const rsp = await mmoInterno(context.env, 'pedidoPagado', { codigo: payload.mmo, stars: starsPaid, charge: chargeId, tgId });
          await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Pago recibido* (${starsPaid} Stars)\n\nCompra: "${(rsp && rsp.nombre) || 'del MMO'}" · pedido #${payload.mmo}\n\nLa entrega es manual: El Duende la revisa y la añade a tu personaje. Te avisaremos aquí apenas esté lista. Guarda el número de pedido por si necesitas reclamar.`, parse_mode: 'Markdown' });
          return new Response('OK');
        }

        // Skin purchase paid with Stars → record server-side (client no longer inserts)
        if (payload.skin_id) {
          const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: starsPaid * STAR_USD, amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } });
          if (!Array.isArray(reg) || reg.length !== 1) return new Response('OK');   // reintento del webhook
          await supabaseQuery(env, 'skin_purchases', { method: 'POST', body: { telegram_id: tgId, skin_id: payload.skin_id, payment_type: 'stars', amount_paid: starsPaid, tx_signature: chargeId } });
          await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Skin desbloqueada*\n\nYa puedes equiparla en el juego.\nPagado: ${starsPaid} Stars`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }]] } });
          return new Response('OK');
        }

        // Token purchase: NEVER trust payload.tokens — recompute from the Stars actually paid
        const price = await getPrice();
        const priceUsd = price?.priceUsd || 0.0000001;
        const paidUsd = starsPaid * STAR_USD;
        // Oferta 1ª compra 2x: solo si realmente no tiene compras previas (re-verificado aquí)
        const firstBuyMult = (payload.first_buy && await isFirstPurchase(env, tgId)) ? 2 : 1;
        const maxTokens = Math.floor((paidUsd / priceUsd) * 1.05 * firstBuyMult); // 5% price-drift tolerance
        const tokens = Math.max(0, Math.min(parseInt(payload.tokens, 10) || 0, maxTokens)) || maxTokens;
        if (tokens > 0) {
          // Registrar ANTES de acreditar: tx_id es UNIQUE, asi que si Telegram
          // reintenta el webhook o llegan dos a la vez, solo uno inserta y paga.
          // Antes se acreditaba primero y el INSERT duplicado fallaba en silencio.
          const reg = await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: +paidUsd.toFixed(2), amount_stars: starsPaid, tokens_credited: tokens, tx_id: chargeId } });
          if (!Array.isArray(reg) || reg.length !== 1) return new Response('OK');
          await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: tgId, p_amount: tokens } });
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *Pago completado*\n\n+${tokens.toLocaleString()} $DUENDE añadidos a tu saldo del juego.\nPagado: ${starsPaid} Stars`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }],[{ text: '⭐ Comprar más', callback_data: 'buy' }]] } });
      } catch(e) {
        await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ Recibimos tu pago, pero hubo un error al acreditar los tokens. Escribe a @ElDuendeOficial (creador oficial) con la fecha y la cantidad de Stars para resolverlo.' });
      }
      return new Response('OK');
    }

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
        // Se quitan los botones del aviso para no pulsarlos dos veces.
        await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        const txt = !r ? '❌ No se pudo hablar con el MMO ahora. Prueba con el comando.'
          : !r.ok ? '❌ ' + r.error
          : acc === 'mmoent' ? `🎁 Pedido #${r.pedido.codigo} entregado a ${r.pedido.jugador}: ${r.pedido.nombre}. Se le avisó.`
          : `❌ Pedido #${r.pedido.codigo} anulado.${r.reembolso || (r.pedido.metodo === 'sol' ? ' Si llegó SOL, devuélvelo tú desde tu wallet.' : '')}`;
        await tg(token, 'sendMessage', { chat_id: chatId, text: txt });
        return new Response('OK');
      }

      // Boton "No quiero más avisos" de los avisos de vuelta del MMO.
      if (data === 'mmoavisos:off') {
        let r = null;
        try { r = await mmoInterno(context.env, 'avisos', { tgId: String(user.id), on: false }); } catch (e) {}
        if (r && r.ok) {
          // Se quita el boton del aviso para que no quede algo que ya no hace nada.
          await tg(token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [[{ text: '🌍 Volver al mundo', web_app: { url: MMO_URL } }]] } }).catch(() => {});
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
      const msg = body.message;
      const chatId = msg.chat.id;
      const user = msg.from;
      const text = (msg.text || '').trim();
      const [rawCmd, ...pp] = text.split(' ');
      const cmd = rawCmd.split('@')[0].toLowerCase();
      const payload = pp.join(' ');

      switch (cmd) {
        case '/start':
          // Invitacion al MMO: t.me/duendequest_bot?start=mmo_<codigo>
          if (/^mmo_[a-z0-9]{6}$/.test(payload || '')) {
            await tg(token, 'sendMessage', { chat_id: chatId, text: '🤝 *Un amigo te invita a DUENDE QUEST ONLINE*\n\nMMORPG de duendes al estilo WoW, gratis y sin descargas: elige tu clase, haz grupo con tu amigo y entren juntos a las mazmorras. Cuando llegues al nivel 10, los dos reciben oro del juego.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌍 Entrar al mundo', web_app: { url: MMO_URL + '?ref=' + payload.slice(4) } }]] } });
            break;
          }
          await handleStart(token, env, chatId, user, payload); break;
        case '/play': case '/jugar': await handlePlay(token, chatId); break;
        case '/mundo': case '/3d':
          await tg(token, 'sendMessage', { chat_id: chatId, text: '🌌 *DUENDE QUEST 3D*\nEl mundo abierto con tu mismo personaje: vuela con alas, entra a la Cueva de los Goblins y, desde el nivel 20, elige facción en el Abismo de Éter.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌌 Entrar al mundo 3D', web_app: { url: MUNDO_URL } }], BOTON_SEGURIDAD] } });
          break;
        case '/mmo': case '/online':
          await tg(token, 'sendMessage', { chat_id: chatId, text: '*DUENDE QUEST ONLINE*\nRPG online de duendes. Gratis, en Telegram y en el navegador.\n\n• 4 clases, grupos y hermandades\n• 6 mazmorras, la banda del Titán y la Torre del Duende\n• Jefe mundial cada 30 minutos\n• Pesca, expediciones y artesanía\n• 10 zonas hasta el nivel 60\n• Mundo abierto en 3D: vuelo con alas, el Abismo de Éter y PvP de facciones\n\n*Skins:* dan bonificaciones; se compran con oro del juego o con Stars.\n*Chicha morada:* con 10.000 puntos de caza te enviamos un litro a casa.\n*mTON (opcional):* desde Nv 15, jefes y caza del día reparten un fondo diario. 1.000 mTON = 1 TON; retiro desde 5 TON, revisado a mano.\n\n' + TEXTO_SEGURIDAD, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🌍 Entrar al mundo', web_app: { url: MMO_URL } }], [{ text: '🌌 Mundo abierto 3D', web_app: { url: MUNDO_URL } }], [{ text: '🏆 Ranking de la semana', callback_data: 'topmmo' }, { text: '🧝 Mi personaje', callback_data: 'yo' }], BOTON_SEGURIDAD] } });
          break;
        case '/ranking': case '/top': await handleRanking(token, env, chatId); break;
        case '/topmmo': case '/torre': await handleTopMmo(token, env, chatId); break;
        case '/yo': case '/personaje': await handleYo(token, env, chatId, user.id); break;
        case '/price': case '/precio': await handlePrice(token, chatId); break;
        case '/stats': await handleStats(token, env, chatId, user.id); break;
        case '/referral': case '/ref': await handleReferralCmd(token, chatId, user.id); break;
        case '/buy': case '/comprar': case '/stars': await handleBuy(token, chatId, user.id); break;
        case '/help': case '/ayuda': await handleHelp(token, chatId); break;
        case '/creador': case '/creator': case '/oficial': await handleCreador(token, chatId); break;
        case '/retiros': case '/pagado': case '/rechazar': case '/fondo': case '/pedidos': case '/ventas': case '/entregar': case '/anular': case '/mmostats': case '/chicha': case '/chichaok': case '/chichano': await handleMmoAdmin(token, context, chatId, user.id, cmd, payload); break;
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
      }
    }

    return new Response('OK');
  } catch (err) {
    console.error('[Bot Error]', err);
    return new Response('OK');
  }
}

export default { onRequestPost };
