// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Secure Wallet API (Cloudflare Worker)
//
// All $DUENDE-crediting operations from the Telegram Mini App go
// through here. The client NEVER decides amounts:
//   1. Identity  → Telegram initData HMAC verification
//   2. Payment   → TON transfer verified on-chain via toncenter
//   3. Amounts   → computed server-side from live prices
//   4. Replay    → tx hash recorded in ton_credits (unique)
//
// Actions: ton_buy | ton_stake | ton_sell | skin_ton
// ═══════════════════════════════════════════════════════

import {
  getEnv, json, corsHeaders, supabaseQuery, verifyInitData, findTonPayment,
  getDuendePriceUsd, getTonPriceUsd, SKIN_PRICES_USD,
} from './lib.js';

const MIN_PURCHASE_USD = 10;
const STAKE_LOCKS = { 7: 1, 30: 1.5, 90: 2.5 };

async function alreadyCredited(env, txHash) {
  const rows = await supabaseQuery(env, `ton_credits?tx_hash=eq.${encodeURIComponent(txHash)}&select=id`);
  return Array.isArray(rows) && rows.length > 0;
}

async function recordCredit(env, { txHash, tgId, nanotons, tokens, action }) {
  await supabaseQuery(env, 'ton_credits', {
    method: 'POST',
    body: { tx_hash: txHash, telegram_id: tgId, nanotons: String(nanotons), tokens_credited: tokens, action },
  });
}

async function creditDuende(env, tgId, amount) {
  return supabaseQuery(env, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: tgId, p_amount: amount } });
}

// Verifies identity + on-chain TON payment. Returns {tgId, payment, tonUsd, duendeUsd} or a Response error.
async function verifyTonFlow(request, env, body) {
  const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
  if (!user?.id) return { err: json(request, { error: 'auth_failed', detail: 'initData inválido o expirado' }, 401) };
  const tgId = String(user.id);

  const ton = parseFloat(body.ton) || 0;
  const [tonUsd, duendeUsd] = await Promise.all([getTonPriceUsd(), getDuendePriceUsd()]);
  if (ton * tonUsd < MIN_PURCHASE_USD * 0.95) return { err: json(request, { error: 'below_minimum' }, 400) };

  const payment = await findTonPayment(env, {
    fromWallet: body.wallet_ton || '',
    minNanotons: Math.floor(ton * 1e9),
  });
  if (!payment) return { err: json(request, { error: 'payment_not_found', detail: 'No se encontró la transacción TON. Espera 1-2 min y reintenta.' }, 402) };
  if (await alreadyCredited(env, payment.hash)) return { err: json(request, { error: 'already_credited' }, 409) };

  return { tgId, payment, ton, tonUsd, duendeUsd };
}

async function onRequestPost(context) {
  const { request } = context;
  const env = getEnv(context);

  try {
    const body = await request.json();
    const action = body.action;

    // ── BUY $DUENDE WITH TON ──
    if (action === 'ton_buy') {
      const v = await verifyTonFlow(request, env, body);
      if (v.err) return v.err;
      const paidUsd = (v.payment.nanotons / 1e9) * v.tonUsd;
      const tokens = Math.floor(paidUsd / v.duendeUsd);
      await recordCredit(env, { txHash: v.payment.hash, tgId: v.tgId, nanotons: v.payment.nanotons, tokens, action });
      await creditDuende(env, v.tgId, tokens);
      await supabaseQuery(env, 'stars_purchases', {
        method: 'POST',
        body: { telegram_id: v.tgId, amount_usd: +paidUsd.toFixed(2), amount_stars: 0, tokens_credited: tokens, tx_id: 'ton_' + v.payment.hash },
      });
      return json(request, { success: true, tokens });
    }

    // ── STAKE TON → $DUENDE REWARD ──
    if (action === 'ton_stake') {
      const lockDays = parseInt(body.lock_days, 10);
      const mult = STAKE_LOCKS[lockDays];
      if (!mult) return json(request, { error: 'invalid_lock' }, 400);
      const v = await verifyTonFlow(request, env, body);
      if (v.err) return v.err;
      const paidUsd = (v.payment.nanotons / 1e9) * v.tonUsd;
      const apy = Math.min(240, Math.max(50, Math.floor(1000 * v.tonUsd / v.duendeUsd / 1000000)));
      const baseTokens = Math.floor(paidUsd / v.duendeUsd);
      const reward = Math.floor(baseTokens * (apy / 100) * (lockDays / 365) * mult);
      const unlockDate = new Date(Date.now() + lockDays * 86400000).toISOString();
      await recordCredit(env, { txHash: v.payment.hash, tgId: v.tgId, nanotons: v.payment.nanotons, tokens: reward, action });
      await supabaseQuery(env, 'ton_stakes', {
        method: 'POST',
        body: {
          telegram_id: v.tgId, wallet_ton: body.wallet_ton || '', amount_ton: +(v.payment.nanotons / 1e9).toFixed(4),
          amount_usd: +paidUsd.toFixed(2), lock_days: lockDays, multiplier: mult, apy, reward_duende: reward, unlock_at: unlockDate,
        },
      });
      await creditDuende(env, v.tgId, reward);
      return json(request, { success: true, reward, apy });
    }

    // ── SELL $DUENDE → WITHDRAWAL REQUEST ──
    if (action === 'ton_sell') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const tokens = Math.floor(parseFloat(body.tokens) || 0);
      if (tokens <= 0) return json(request, { error: 'invalid_amount' }, 400);
      if (!body.wallet_ton) return json(request, { error: 'missing_wallet' }, 400);

      const [tonUsd, duendeUsd] = await Promise.all([getTonPriceUsd(), getDuendePriceUsd()]);
      const usd = tokens * duendeUsd;
      if (usd < MIN_PURCHASE_USD * 0.95) return json(request, { error: 'below_minimum' }, 400);

      const profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=duende_balance`);
      const balance = Number(profiles?.[0]?.duende_balance || 0);
      if (tokens > balance) return json(request, { error: 'insufficient_balance', balance }, 400);

      await creditDuende(env, tgId, -tokens);
      await supabaseQuery(env, 'withdrawal_requests', {
        method: 'POST',
        body: {
          telegram_id: tgId, wallet_ton: body.wallet_ton, tokens_burned: tokens,
          ton_amount: +(usd / tonUsd).toFixed(6), usd_value: +usd.toFixed(2), status: 'pending',
        },
      });
      return json(request, { success: true, ton_amount: +(usd / tonUsd).toFixed(6) });
    }

    // ── BUY SKIN WITH TON ──
    if (action === 'skin_ton') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const skinId = String(body.skin_id || '');
      const usd = SKIN_PRICES_USD[skinId];
      if (!usd) return json(request, { error: 'unknown_skin' }, 400);

      const owned = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${tgId}&skin_id=eq.${skinId}&select=id`);
      if (Array.isArray(owned) && owned.length > 0) return json(request, { success: true, already_owned: true });

      const tonUsd = await getTonPriceUsd();
      const expectedNanotons = Math.floor((usd / tonUsd) * 1e9);
      const payment = await findTonPayment(env, { fromWallet: body.wallet_ton || '', minNanotons: Math.floor(expectedNanotons * 0.95) });
      if (!payment) return json(request, { error: 'payment_not_found', detail: 'No se encontró la transacción TON. Espera 1-2 min y reintenta.' }, 402);
      if (await alreadyCredited(env, payment.hash)) return json(request, { error: 'already_credited' }, 409);

      await recordCredit(env, { txHash: payment.hash, tgId, nanotons: payment.nanotons, tokens: 0, action: 'skin_' + skinId });
      await supabaseQuery(env, 'skin_purchases', {
        method: 'POST',
        body: { telegram_id: tgId, skin_id: skinId, payment_type: 'ton', amount_paid: +(payment.nanotons / 1e9).toFixed(4) },
      });
      return json(request, { success: true, skin_id: skinId });
    }

    // ── LINK / GET PROFILE (identidad verificada, sin secuestro por username) ──
    if (action === 'link_profile') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      let profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=*&limit=1`);
      if (Array.isArray(profiles) && profiles.length > 0) return json(request, { success: true, profile: profiles[0] });
      // crear perfil nuevo ligado al telegram_id verificado
      const username = (user.username || user.first_name || 'duende_' + tgId).slice(0, 20);
      const created = await supabaseQuery(env, 'profiles', { method: 'POST', body: { telegram_id: tgId, username } });
      return json(request, { success: true, profile: Array.isArray(created) ? created[0] : created });
    }

    // ── UPDATE PROFILE (solo campos permitidos, solo el dueño) ──
    if (action === 'update_profile') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const allowed = {};
      if (typeof body.equipped_skin === 'string' && body.equipped_skin.length <= 30) allowed.equipped_skin = body.equipped_skin;
      if (typeof body.wallet_ton === 'string' && body.wallet_ton.length <= 80) allowed.wallet_ton = body.wallet_ton;
      if (Object.keys(allowed).length === 0) return json(request, { error: 'no_fields' }, 400);
      await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}`, { method: 'PATCH', body: allowed });
      return json(request, { success: true });
    }

    // ── SUBMIT SCORE (firmado con initData + límites anti-cheat) ──
    if (action === 'submit_score') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const score = Math.max(0, Math.min(5000000, Math.floor(+body.score || 0)));
      const wave = Math.max(1, Math.min(500, Math.floor(+body.wave || 1)));
      const level = Math.max(1, Math.min(200, Math.floor(+body.level || 1)));
      const coins = Math.max(0, Math.min(100000, Math.floor(+body.coins || 0)));
      const username = (user.username || user.first_name || 'duende_' + tgId).slice(0, 20);
      await supabaseQuery(env, 'game_scores', { method: 'POST', body: { username, score, wave, level, telegram_id: tgId } });
      // actualizar bests del perfil
      const profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=best_score,best_wave,games_played,total_coins&limit=1`);
      const p = Array.isArray(profiles) && profiles[0] ? profiles[0] : {};
      await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}`, {
        method: 'PATCH',
        body: {
          best_score: Math.max(Number(p.best_score || 0), score),
          best_wave: Math.max(Number(p.best_wave || 0), wave),
          games_played: Number(p.games_played || 0) + 1,
          total_coins: Number(p.total_coins || 0) + coins,
        },
      });
      return json(request, { success: true });
    }

    return json(request, { error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('[Wallet API]', err);
    return json(context.request, { error: 'server_error' }, 500);
  }
}

async function onRequestOptions(context) {
  return new Response('', { headers: corsHeaders(context.request) });
}

export default { onRequestPost, onRequestOptions };
