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
  };
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

async function createStarsInvoice(token, pkgIndex) {
  const price = await getPrice();
  const priceUsd = price?.priceUsd || 0.0000001;
  const packages = calcStarsPackages(priceUsd);
  const pkg = packages[pkgIndex];
  if (!pkg) return;
  const result = await tg(token, 'createInvoiceLink', {
    title: `${pkg.label} — ${pkg.tokens.toLocaleString()} $DUENDE`,
    description: `Compra ${pkg.tokens.toLocaleString()} tokens $DUENDE por ${pkg.stars} Stars (~$${pkg.usd} USD)`,
    payload: JSON.stringify({ pkg: pkgIndex, tokens: pkg.tokens, usd: pkg.usd }),
    currency: 'XTR',
    prices: [{ label: `${pkg.tokens.toLocaleString()} $DUENDE`, amount: pkg.stars }],
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
  const scores = await supabaseQuery(env, 'game_scores?select=username,score,wave&order=score.desc&limit=10');
  let text = '🏆 *TOP 10 — DUENDE QUEST*\n\n';
  if (!scores || scores.length === 0) text += '_Aún no hay puntuaciones._';
  else { const medals = ['🥇','🥈','🥉']; scores.forEach((s,i) => { text += `${medals[i]||`${i+1}.`} *${s.username}* — ${s.score.toLocaleString()} pts (Wave ${s.wave})\n`; }); }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'ranking' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handlePrice(token, chatId, messageId) {
  const p = await getPrice();
  let text;
  if (!p || p.priceUsd === 0) text = '💹 *$DUENDE — Precio*\n\n_No se pudo obtener._';
  else { const arrow = p.priceChange24h >= 0 ? '🟢 📈' : '🔴 📉'; text = `💹 *$DUENDE — Precio en vivo*\n\n💰 Precio: *$${p.priceUsd.toFixed(8)}*\n${arrow} 24h: *${p.priceChange24h >= 0 ? '+' : ''}${p.priceChange24h.toFixed(2)}%*\n📊 Vol 24h: *$${fmtNum(p.volume24h)}*\n🏦 Market Cap: *$${fmtNum(p.marketCap)}*\n💧 Liquidez: *$${fmtNum(p.liquidity)}*\n\n_Fuente: ${p.source}_`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🚀 Comprar $DUENDE', url: PUMP_FUN_URL }],[{ text: '🔄 Actualizar', callback_data: 'price' }]] } };
  if (messageId) { opts.message_id = messageId; await tg(token, 'editMessageText', opts); } else await tg(token, 'sendMessage', opts);
}

async function handleStats(token, env, chatId, userId, messageId) {
  const tgId = String(userId);
  let profiles; try { profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=username,best_score,best_wave,total_coins,games_played,duende_balance`); } catch(e) { profiles = []; }
  let text;
  if (!Array.isArray(profiles) || profiles.length === 0) text = '📊 *Tus Stats*\n\n_No tienes perfil. ¡Juega tu primera partida!_';
  else { const p = profiles[0]; text = `📊 *Stats de ${p.username||'Duende'}*\n\n🏆 Mejor Score: *${Number(p.best_score||0).toLocaleString()}*\n🌊 Mejor Wave: *${p.best_wave||0}*\n🪙 Monedas: *${Number(p.total_coins||0).toLocaleString()}*\n🎮 Partidas: *${p.games_played||0}*\n💎 $DUENDE: *${Number(p.duende_balance||0).toLocaleString()}*`; }
  const opts = { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '🔄 Actualizar', callback_data: 'stats' }]] } };
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

async function handlePlay(token, chatId) {
  await tg(token, 'sendMessage', { chat_id: chatId, text: '🎮 *¡A jugar!*', parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 ABRIR JUEGO', web_app: { url: WEBAPP_URL } }]] } });
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

export async function onRequestPost(context) {
  const env = getEnv(context);
  const token = env.BOT_TOKEN;

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
        const tokens = payload.tokens || 0;
        if (tokens > 0) {
          await supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: tgId, p_amount: tokens } });
          await supabaseQuery(env, 'stars_purchases', { method: 'POST', body: { telegram_id: tgId, amount_usd: payload.usd||0, amount_stars: payment.total_amount||0, tokens_credited: tokens, tx_id: payment.telegram_payment_charge_id||'' } });
        }
        await tg(token, 'sendMessage', { chat_id: chatId, text: `✅ *¡Pago exitoso!*\n\n💎 +${tokens.toLocaleString()} $DUENDE acreditados\n⭐ ${payment.total_amount} Stars`, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],[{ text: '⭐ Comprar más', callback_data: 'buy' }]] } });
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
        const invoiceUrl = await createStarsInvoice(token, pkgIndex);
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
      }
    }

    return new Response('OK');
  } catch (err) {
    console.error('[Bot Error]', err);
    return new Response('OK');
  }
}
