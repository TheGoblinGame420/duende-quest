// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Telegram Bot Webhook (Cloudflare Pages Function)
// ═══════════════════════════════════════════════════════

const WEBAPP_URL = 'https://duende-quest.alfonso12hc.workers.dev/telegram/index.html';
const SITE_URL = 'https://duende-quest.alfonso12hc.workers.dev';
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';
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
  { label: '🌟 Starter', usd: 10 },
  { label: '💎 Pro', usd: 25 },
  { label: '🔥 Mega', usd: 50 },
  { label: '👑 Whale', usd: 100 },
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
  const price = await getPrice();
  const priceUsd = price?.priceUsd || 0.0000001;
  const packages = calcStarsPackages(priceUsd);
  const pkg = packages[pkgIndex];
  if (!pkg) return;
  const firstBuy = await isFirstPurchase(env, tgId);
  const tokens = firstBuy ? pkg.tokens * 2 : pkg.tokens;
  const result = await tg(token, 'createInvoiceLink', {
    title: `${firstBuy ? '🎁 OFERTA 1ª COMPRA 2x — ' : ''}${pkg.label} — ${tokens.toLocaleString()} $DUENDE`,
    description: `${firstBuy ? '¡Bienvenida 2x! ' : ''}Compra ${tokens.toLocaleString()} tokens $DUENDE por ${pkg.stars} Stars (~$${pkg.usd} USD)`,
    payload: JSON.stringify({ pkg: pkgIndex, tokens, usd: pkg.usd, first_buy: firstBuy }),
    currency: 'XTR',
    prices: [{ label: `${tokens.toLocaleString()} $DUENDE`, amount: pkg.stars }],
  });
  return result?.result;
}

// ═══════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════

async function handleStart(token, env, chatId, user, startPayload) {
  if (startPayload && startPayload.startsWith('ref_')) {
    await handleReferral(token, env, startPayload.replace('ref_', ''), user);
  }
  const tgId = String(user.id);
  const username = (user.username || user.first_name || 'duende_' + tgId).slice(0, 20);
  let profiles = [];
  try { profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=id,username`); } catch(e) {}
  if (!Array.isArray(profiles) || profiles.length === 0) {
    try { await supabaseQuery(env, `profiles?username=eq.${username}`, { method: 'PATCH', body: { telegram_id: tgId } }); } catch(e) {
      try { await supabaseQuery(env, 'rpc/link_telegram', { method: 'POST', body: { p_tg_id: tgId, p_username: username } }); } catch(e2) {}
    }
  }
  const referralLink = `https://t.me/duendequest_bot?start=ref_${user.id}`;
  await tg(token, 'sendMessage', {
    chat_id: chatId,
    text: `🧌 *¡Bienvenido a DUENDE QUEST, ${user.first_name || 'Duende'}!*\n\n⚔️ Juego arcade play-to-earn en Solana\n💰 Gana tokens $DUENDE jugando\n⚡ Staking con hasta 240% APY\n🏆 Compite en el ranking global\n\n🎁 *Tu link de referido:*\n\`${referralLink}\`\n_Invita amigos y ambos ganan 500 $DUENDE_`,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '🎮 JUGAR AHORA', web_app: { url: WEBAPP_URL } }],
      [{ text: '⭐ Comprar con Stars', callback_data: 'buy' }, { text: '🚀 Pump.fun', url: PUMP_FUN_URL }],
      [{ text: '🏆 Ranking', callback_data: 'ranking' }, { text: '💹 Precio', callback_data: 'price' }],
      [{ text: '📊 Mis Stats', callback_data: 'stats' }, { text: '🎁 Referidos', callback_data: 'referral' }],
    ]},
  });
}

async function handleRanking(token, env, chatId, messageId) {
  const rows = await supabaseQuery(env, 'game_scores?select=username,score,wave&order=score.desc&limit=50');
  // Una entrada por jugador: su mejor score
  const best = new Map();
  if (Array.isArray(rows)) for (const s of rows) { const k = (s.username || '?').toLowerCase(); if (!best.has(k) || s.score > best.get(k).score) best.set(k, s); }
  const scores = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  let text = '🏆 *TOP 10 — DUENDE QUEST*\n\n';
  if (scores.length === 0) text += '_Aún no hay puntuaciones._';
  else { const medals = ['🥇','🥈','🥉']; scores.forEach((s,i) => { text += `${medals[i]||`${i+1}.`} *${s.username}* — ${s.score.toLocaleString()} pts (Wave ${s.wave})\n`; }); }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'ranking' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handlePrice(token, chatId, messageId) {
  const p = await getPrice();
  let text;
  if (!p || p.priceUsd === 0) text = '💹 *$DUENDE — Precio*\n\n_No se pudo obtener._';
  else { const arrow = p.priceChange24h >= 0 ? '🟢 📈' : '🔴 📉'; text = `💹 *$DUENDE — Precio en vivo*\n\n💰 Precio: *$${p.priceUsd.toFixed(8)}*\n${arrow} 24h: *${p.priceChange24h >= 0 ? '+' : ''}${p.priceChange24h.toFixed(2)}%*\n📊 Vol 24h: *$${fmtNum(p.volume24h)}*\n🏦 Market Cap: *$${fmtNum(p.marketCap)}*\n💧 Liquidez: *$${fmtNum(p.liquidity)}*\n\n_Fuente: ${p.source}_`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 Comprar $DUENDE', url: PUMP_FUN_URL }],[{ text: '🔄 Actualizar', callback_data: 'price' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleStats(token, env, chatId, userId, messageId) {
  const tgId = String(userId);
  let profiles; try { profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=username,best_score,best_wave,total_coins,games_played,duende_balance`); } catch(e) { profiles = []; }
  let text;
  if (!Array.isArray(profiles) || profiles.length === 0) text = '📊 *Tus Stats*\n\n_No tienes perfil. ¡Juega tu primera partida!_';
  else { const p = profiles[0]; text = `📊 *Stats de ${p.username||'Duende'}*\n\n🏆 Mejor Score: *${Number(p.best_score||0).toLocaleString()}*\n🌊 Mejor Wave: *${p.best_wave||0}*\n🪙 Monedas: *${Number(p.total_coins||0).toLocaleString()}*\n🎮 Partidas: *${p.games_played||0}*\n💎 $DUENDE: *${Number(p.duende_balance||0).toLocaleString()}*`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'stats' }, { text: '⌂ Menú', callback_data: 'menu' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleReferralCmd(token, chatId, userId, messageId) {
  const referralLink = `https://t.me/duendequest_bot?start=ref_${userId}`;
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🎁 *Referidos*\n\n📎 *Tu link:*\n\`${referralLink}\`\n\n_Comparte tu link. Ambos ganan 500 $DUENDE._`, parse_mode: 'Markdown' });
}

async function handleReferral(token, env, referrerId, newUser) {
  if (String(referrerId) === String(newUser.id)) return;
  try {
    const existing = await supabaseQuery(env, `referrals?referred_tg_id=eq.${newUser.id}&select=id`);
    if (Array.isArray(existing) && existing.length > 0) return;
    await supabaseQuery(env, 'referrals', { method: 'POST', body: { referrer_tg_id: String(referrerId), referred_tg_id: String(newUser.id), referred_username: (newUser.username||newUser.first_name||'anon').slice(0,20) } });
    await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: String(referrerId), p_amount: 500 } });
    await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: String(newUser.id), p_amount: 500 } });
    await tg(token, 'sendMessage', { chat_id: referrerId, text: `🎉 *¡Nuevo referido!*\n\n${newUser.first_name||'Alguien'} se unió.\n💎 +500 $DUENDE`, parse_mode: 'Markdown' });
  } catch(e) {}
}

async function handleBuy(token, chatId, userId, messageId) {
  const price = await getPrice();
  const priceUsd = price?.priceUsd || 0.0000001;
  const packages = calcStarsPackages(priceUsd);
  let text = `⭐ *COMPRAR $DUENDE CON STARS*\n\n💰 Precio actual: *$${priceUsd.toFixed(8)}*\n_Paga con tarjeta de crédito via Telegram Stars_\n\n`;
  packages.forEach(pkg => { text += `${pkg.label}\n   ⭐ ${pkg.stars} Stars (~$${pkg.usd}) → *${pkg.tokens.toLocaleString()} $DUENDE*\n\n`; });
  text += '_Los tokens se acreditan al instante_';
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: packages.map((pkg,i) => [{ text: `${pkg.label} — ⭐${pkg.stars} Stars`, callback_data: `buy_${i}` }]) } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleHelp(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: `🧌 *DUENDE QUEST — Comandos*\n\n/start — Menú principal\n/play — Abrir el juego\n/ranking — Top 10\n/price — Precio $DUENDE\n/stats — Tus estadísticas\n/buy — Comprar $DUENDE con Stars 💳\n/referral — Tu link de referidos\n/help — Comandos`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }]] } });
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
      await tg(token, 'sendMessage', { chat_id: r.telegram_id, text: `🎉 *¡Tu canje fue enviado!*\n\n💎 ${Number(r.duende_amount).toLocaleString()} $DUENDE están en camino a tu wallet${txsig ? `\n🔗 https://solscan.io/tx/${txsig}` : ''}\n\n¡Gracias por jugar, duende! 🧝`, parse_mode: 'Markdown' });
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
    `🔴🔴 <b>¡EL DUENDE ESTÁ EN VIVO!</b> 🔴🔴\n\n` +
    `${playingLine}${noteLine}\n\n` +
    `🧝 Mientras ves, juega <b>DUENDE QUEST</b> y gana $DUENDE\n` +
    `🪙 $DUENDE en pump.fun`;
  // Versión Discord (texto plano con ** y links visibles)
  const msgDiscord =
    `🔴🔴 **¡EL DUENDE ESTÁ EN VIVO!** 🔴🔴\n\n` +
    `${(game ? `${emoji} Jugando: **${game}**` : '🎮 Stream en vivo')}${noteLine}\n\n` +
    `👉 **Entra ahora:** ${kick}\n` +
    `🧝 Juega y gana $DUENDE: https://t.me/duendequest_bot\n` +
    `🪙 Compra $DUENDE: ${PUMP_FUN_URL}`;

  const okD = await postDiscord(env, msgDiscord);
  let okT = false;
  if (context.env.TG_CHANNEL_ID) {
    try {
      const r = await tg(token, 'sendMessage', { chat_id: context.env.TG_CHANNEL_ID, text: msgHtml, parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: '🔴 VER STREAM EN KICK', url: kick }], [{ text: '🎮 JUGAR DUENDE QUEST', url: 'https://t.me/duendequest_bot' }]] } });
      okT = !!r.ok;
    } catch (e) {}
  }
  await tg(token, 'sendMessage', { chat_id: chatId, text: `Anuncio enviado:\n${okD ? '✅' : '❌'} Discord\n${okT ? '✅' : '⚠️ Telegram (falta configurar TG_CHANNEL_ID o el bot no es admin del canal)'}` });
}

async function handlePlay(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: '🎮 *¡A jugar!*', parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 ABRIR JUEGO', web_app: { url: WEBAPP_URL } }]] } });
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

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
    console.warn('[SECURITY] TELEGRAM_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  try {
    const body = await context.request.json();

    // Pre-checkout query
    if (body.pre_checkout_query) {
      await tg(token, 'answerPreCheckoutQuery', { pre_checkout_query_id: body.pre_checkout_query.id, ok: true });
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
        if (chargeId) {
          const dup = await supabaseQuery(env, `stars_purchases?tx_id=eq.${encodeURIComponent(chargeId)}&select=id`);
          if (Array.isArray(dup) && dup.length > 0) return new Response('OK');
        }

        // Skin purchase paid with Stars → record server-side (client no longer inserts)
        if (payload.skin_id) {
          await supabaseQuery(env, 'skin_purchases', { method: 'POST', body: { telegram_id: tgId, skin_id: payload.skin_id, payment_type: 'stars', amount_paid: starsPaid, tx_signature: chargeId } });
          await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: starsPaid * STAR_USD, amount_stars: starsPaid, tokens_credited: 0, tx_id: chargeId } });
          await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *¡Skin desbloqueada!*\n\n🎨 Ya puedes equiparla en el juego\n⭐ ${starsPaid} Stars`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }]] } });
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
          await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: tgId, p_amount: tokens } });
          await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: +paidUsd.toFixed(2), amount_stars: starsPaid, tokens_credited: tokens, tx_id: chargeId } });
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *¡Pago exitoso!*\n\n💎 +${tokens.toLocaleString()} $DUENDE acreditados\n⭐ ${starsPaid} Stars`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '⭐ Comprar más', callback_data: 'buy' }]] } });
      } catch(e) {
        await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ Pago recibido pero error acreditando tokens.' });
      }
      return new Response('OK');
    }

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
        if (invoiceUrl) await tg(token, 'sendMessage', { chat_id: chatId, text: '⭐ Toca para pagar:', reply_markup: { inline_keyboard: [[{ text: '💳 Pagar con Stars', url: invoiceUrl }]] } });
        else await tg(token, 'sendMessage', { chat_id: chatId, text: '❌ Error creando factura.' });
        return new Response('OK');
      }

      switch (data) {
        case 'ranking': await handleRanking(token, env, chatId, messageId); break;
        case 'price': await handlePrice(token, chatId, messageId); break;
        case 'stats': await handleStats(token, env, chatId, user.id, messageId); break;
        case 'referral': await handleReferralCmd(token, chatId, user.id, messageId); break;
        case 'buy': await handleBuy(token, chatId, user.id, messageId); break;
        case 'menu': await handleStart(token, env, chatId, user, ''); break;
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
        case '/start': await handleStart(token, env, chatId, user, payload); break;
        case '/play': case '/jugar': await handlePlay(token, chatId); break;
        case '/ranking': case '/top': await handleRanking(token, env, chatId); break;
        case '/price': case '/precio': await handlePrice(token, chatId); break;
        case '/stats': await handleStats(token, env, chatId, user.id); break;
        case '/referral': case '/ref': await handleReferralCmd(token, chatId, user.id); break;
        case '/buy': case '/comprar': case '/stars': await handleBuy(token, chatId, user.id); break;
        case '/help': case '/ayuda': await handleHelp(token, chatId); break;
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
