// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Telegram Bot Webhook (Netlify Function)
// ═══════════════════════════════════════════════════════
'use strict';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = 'https://criptoduendesolana.netlify.app/telegram/index.html';
const SITE_URL = 'https://criptoduendesolana.netlify.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';
const PUMP_FUN_URL = 'https://pump.fun/coin/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';

// ── Telegram API helper ─────────────────────────
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ── Supabase helper ─────────────────────────────
async function supabaseQuery(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return r.json();
}

// ── Price feed (pump.fun first, DexScreener fallback) ──
const PUMP_API = 'https://frontend-api-v3.pump.fun/coins/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';

async function getPrice() {
  // Try pump.fun API first
  try {
    const r = await fetch(PUMP_API, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d && d.usd_market_cap) {
      const mcap = parseFloat(d.usd_market_cap || 0);
      const totalSupply = 1_000_000_000; // 1B tokens
      const price = mcap / totalSupply;
      return {
        priceUsd: price,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: mcap,
        liquidity: parseFloat(d.virtual_sol_reserves || 0) / 1e9 * 82,
        source: 'pump.fun',
      };
    }
  } catch (e) {}
  // Fallback to DexScreener
  try {
    const r = await fetch(DEXSCREENER_URL, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const pair = d?.pairs?.[0];
    if (!pair) return null;
    return {
      priceUsd: parseFloat(pair.priceUsd || 0),
      priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
      volume24h: parseFloat(pair.volume?.h24 || 0),
      marketCap: parseFloat(pair.marketCap || pair.fdv || 0),
      liquidity: parseFloat(pair.liquidity?.usd || 0),
      source: 'DexScreener',
    };
  } catch (e) { return null; }
}

// ── Format numbers ──────────────────────────────
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

// ═══════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════

async function handleStart(chatId, user, startPayload) {
  // Handle referral
  if (startPayload && startPayload.startsWith('ref_')) {
    const referrerId = startPayload.replace('ref_', '');
    await handleReferral(referrerId, user);
  }

  // Link or create profile
  const tgId = String(user.id);
  const username = (user.username || user.first_name || 'duende_' + tgId).slice(0, 20);

  // First check if profile with this telegram_id exists
  let profiles = [];
  try { profiles = await supabaseQuery(`profiles?telegram_id=eq.${tgId}&select=id,username`); } catch(e) {}

  if (!Array.isArray(profiles) || profiles.length === 0) {
    // Try to find by username and link telegram_id
    try {
      await supabaseQuery(`profiles?username=eq.${username}`, {
        method: 'PATCH',
        body: { telegram_id: tgId },
      });
    } catch(e) {
      // If no match by username, try creating via RPC
      try {
        await supabaseQuery('rpc/link_telegram', {
          method: 'POST',
          body: { p_tg_id: tgId, p_username: username },
        });
      } catch(e2) {}
    }
  }

  const referralLink = `https://t.me/duendequest_bot?start=ref_${user.id}`;

  await tg('sendMessage', {
    chat_id: chatId,
    text:
      `🧌 *¡Bienvenido a DUENDE QUEST, ${user.first_name || 'Duende'}!*\n\n` +
      `⚔️ Juego arcade play-to-earn en Solana\n` +
      `💰 Gana tokens $DUENDE jugando\n` +
      `⚡ Staking con hasta 240% APY\n` +
      `🏆 Compite en el ranking global\n\n` +
      `🎁 *Tu link de referido:*\n\`${referralLink}\`\n` +
      `_Invita amigos y ambos ganan 500 $DUENDE_`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 JUGAR AHORA', web_app: { url: WEBAPP_URL } }],
        [
          { text: '🚀 Comprar $DUENDE', url: PUMP_FUN_URL },
          { text: '🌐 Web', url: SITE_URL },
        ],
        [
          { text: '🏆 Ranking', callback_data: 'ranking' },
          { text: '💹 Precio', callback_data: 'price' },
        ],
        [
          { text: '📊 Mis Stats', callback_data: 'stats' },
          { text: '🎁 Referidos', callback_data: 'referral' },
        ],
      ],
    },
  });
}

async function handleRanking(chatId, messageId) {
  const scores = await supabaseQuery(
    'game_scores?select=username,score,wave&order=score.desc&limit=10'
  );

  let text = '🏆 *TOP 10 — DUENDE QUEST*\n\n';
  if (!scores || scores.length === 0) {
    text += '_Aún no hay puntuaciones. ¡Sé el primero!_';
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((s, i) => {
      const medal = medals[i] || `${i + 1}.`;
      text += `${medal} *${s.username}* — ${s.score.toLocaleString()} pts (Wave ${s.wave})\n`;
    });
  }

  const opts = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],
        [{ text: '🔄 Actualizar', callback_data: 'ranking' }],
      ],
    },
  };

  if (messageId) {
    opts.message_id = messageId;
    await tg('editMessageText', opts);
  } else {
    await tg('sendMessage', opts);
  }
}

async function handlePrice(chatId, messageId) {
  const p = await getPrice();
  let text;
  if (!p || p.priceUsd === 0) {
    text = '💹 *$DUENDE — Precio*\n\n_No se pudo obtener el precio. Intenta en unos segundos._';
  } else {
    const arrow = p.priceChange24h >= 0 ? '🟢 📈' : '🔴 📉';
    text =
      `💹 *$DUENDE — Precio en vivo*\n\n` +
      `💰 Precio: *$${p.priceUsd.toFixed(8)}*\n` +
      `${arrow} 24h: *${p.priceChange24h >= 0 ? '+' : ''}${p.priceChange24h.toFixed(2)}%*\n` +
      `📊 Vol 24h: *$${fmtNum(p.volume24h)}*\n` +
      `🏦 Market Cap: *$${fmtNum(p.marketCap)}*\n` +
      `💧 Liquidez: *$${fmtNum(p.liquidity)}*\n\n` +
      `_Fuente: ${p.source || 'API'} · ${new Date().toLocaleTimeString('es-ES')}_`;
  }

  const opts = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Comprar $DUENDE', url: PUMP_FUN_URL }],
        [{ text: '🔄 Actualizar', callback_data: 'price' }],
      ],
    },
  };

  if (messageId) {
    opts.message_id = messageId;
    await tg('editMessageText', opts);
  } else {
    await tg('sendMessage', opts);
  }
}

async function handleStats(chatId, userId, messageId) {
  const tgId = String(userId);
  let profiles;
  try {
    profiles = await supabaseQuery(
      `profiles?telegram_id=eq.${tgId}&select=username,best_score,best_wave,total_coins,games_played,duende_balance`
    );
  } catch (e) { profiles = []; }

  let text;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    text = '📊 *Tus Stats*\n\n_No tienes perfil aún. ¡Juega tu primera partida para crear tu perfil!_';
  } else {
    const p = profiles[0];
    text =
      `📊 *Stats de ${p.username || 'Duende'}*\n\n` +
      `🏆 Mejor Score: *${Number(p.best_score || 0).toLocaleString()}*\n` +
      `🌊 Mejor Wave: *${p.best_wave || 0}*\n` +
      `🪙 Monedas Total: *${Number(p.total_coins || 0).toLocaleString()}*\n` +
      `🎮 Partidas: *${p.games_played || 0}*\n` +
      `💎 Balance $DUENDE: *${Number(p.duende_balance || 0).toLocaleString()}*\n\n` +
      `_Sigue jugando para subir en el ranking_`;
  }

  const opts = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],
        [{ text: '🔄 Actualizar', callback_data: 'stats' }],
      ],
    },
  };

  if (messageId) {
    opts.message_id = messageId;
    await tg('editMessageText', opts);
  } else {
    await tg('sendMessage', opts);
  }
}

async function handleReferralCmd(chatId, userId, messageId) {
  const tgId = String(userId);
  const referralLink = `https://t.me/duendequest_bot?start=ref_${userId}`;

  // Count referrals
  const referrals = await supabaseQuery(
    `referrals?referrer_tg_id=eq.${tgId}&select=id`,
  );
  const count = Array.isArray(referrals) ? referrals.length : 0;
  const earned = count * 500;

  const text =
    `🎁 *Sistema de Referidos*\n\n` +
    `📎 *Tu link:*\n\`${referralLink}\`\n\n` +
    `👥 Referidos: *${count}*\n` +
    `💎 $DUENDE ganados: *${earned.toLocaleString()}*\n\n` +
    `_Comparte tu link. Cuando alguien juegue su primera partida, ambos ganan 500 $DUENDE._`;

  const opts = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 Compartir link', switch_inline_query: `¡Juega Duende Quest y gana $DUENDE! 🧌🎮\n${referralLink}` }],
        [{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],
      ],
    },
  };

  if (messageId) {
    opts.message_id = messageId;
    await tg('editMessageText', opts);
  } else {
    await tg('sendMessage', opts);
  }
}

async function handleReferral(referrerId, newUser) {
  if (String(referrerId) === String(newUser.id)) return; // Can't refer yourself

  try {
    // Check if already referred
    const existing = await supabaseQuery(
      `referrals?referred_tg_id=eq.${newUser.id}&select=id`
    );
    if (Array.isArray(existing) && existing.length > 0) return;

    // Record referral
    await supabaseQuery('referrals', {
      method: 'POST',
      body: {
        referrer_tg_id: String(referrerId),
        referred_tg_id: String(newUser.id),
        referred_username: (newUser.username || newUser.first_name || 'anon').slice(0, 20),
      },
    });

    // Add bonus to both
    await supabaseQuery('rpc/add_duende_by_tgid', {
      method: 'POST',
      body: { p_tg_id: String(referrerId), p_amount: 500 },
    });
    await supabaseQuery('rpc/add_duende_by_tgid', {
      method: 'POST',
      body: { p_tg_id: String(newUser.id), p_amount: 500 },
    });

    // Notify referrer
    await tg('sendMessage', {
      chat_id: referrerId,
      text: `🎉 *¡Nuevo referido!*\n\n${newUser.first_name || 'Alguien'} se unió con tu link.\n💎 +500 $DUENDE para ti.`,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error('[Referral error]', e);
  }
}

async function handleHelp(chatId) {
  await tg('sendMessage', {
    chat_id: chatId,
    text:
      `🧌 *DUENDE QUEST — Comandos*\n\n` +
      `/start — Menú principal\n` +
      `/play — Abrir el juego\n` +
      `/ranking — Top 10 jugadores\n` +
      `/price — Precio $DUENDE en vivo\n` +
      `/stats — Tus estadísticas\n` +
      `/referral — Tu link de referidos\n` +
      `/help — Esta lista de comandos\n\n` +
      `_Toca los botones para interactuar_`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }],
      ],
    },
  });
}

async function handlePlay(chatId) {
  await tg('sendMessage', {
    chat_id: chatId,
    text: '🎮 *¡A jugar!*\n\nToca el botón para abrir Duende Quest:',
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 ABRIR JUEGO', web_app: { url: WEBAPP_URL } }],
      ],
    },
  });
}

// ── Send promo message to channel (called via /announce) ──
async function handleAnnounce(chatId, userId) {
  // Only bot owner can announce — replace with your TG user ID
  // You can find yours by sending /stats and checking logs
  const OWNER_IDS = [String(userId)]; // Allow current user for now

  await tg('sendMessage', {
    chat_id: chatId,
    text:
      `🧌🎮 *DUENDE QUEST* 🎮🧌\n\n` +
      `Juega, mata enemigos, sube de nivel y gana *$DUENDE*\n\n` +
      `⚔️ Oleadas infinitas de enemigos\n` +
      `💰 Gana tokens $DUENDE jugando\n` +
      `⚡ Staking con hasta 240% APY\n` +
      `🏆 Compite en el ranking global`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 JUGAR AHORA', web_app: { url: WEBAPP_URL } }],
        [
          { text: '🚀 Comprar $DUENDE', url: PUMP_FUN_URL },
          { text: '🌐 Web', url: SITE_URL },
        ],
      ],
    },
  });
}

// ═══════════════════════════════════════════════════════
// WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const body = JSON.parse(event.body);

    // Handle callback queries (inline button presses)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const data = cb.data;
      const user = cb.from;

      // Answer callback to remove loading state
      await tg('answerCallbackQuery', { callback_query_id: cb.id });

      switch (data) {
        case 'ranking': await handleRanking(chatId, messageId); break;
        case 'price': await handlePrice(chatId, messageId); break;
        case 'stats': await handleStats(chatId, user.id, messageId); break;
        case 'referral': await handleReferralCmd(chatId, user.id, messageId); break;
      }

      return { statusCode: 200, body: 'OK' };
    }

    // Handle messages
    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;
      const user = msg.from;
      const text = (msg.text || '').trim();

      // Extract command and payload
      const [rawCmd, ...payloadParts] = text.split(' ');
      const cmd = rawCmd.split('@')[0].toLowerCase(); // Handle /cmd@botname
      const payload = payloadParts.join(' ');

      switch (cmd) {
        case '/start': await handleStart(chatId, user, payload); break;
        case '/play': case '/jugar': await handlePlay(chatId); break;
        case '/ranking': case '/top': await handleRanking(chatId); break;
        case '/price': case '/precio': await handlePrice(chatId); break;
        case '/stats': case '/estadisticas': await handleStats(chatId, user.id); break;
        case '/referral': case '/referido': case '/ref': await handleReferralCmd(chatId, user.id); break;
        case '/help': case '/ayuda': await handleHelp(chatId); break;
        case '/announce': await handleAnnounce(chatId, user.id); break;
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[Bot Error]', err);
    return { statusCode: 200, body: 'OK' }; // Always return 200 to TG
  }
};
