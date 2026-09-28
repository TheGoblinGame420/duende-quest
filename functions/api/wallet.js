// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Secure Wallet API (Cloudflare Worker)
//
// All $DUENDE-crediting operations from the Telegram Mini App go
// through here. The client NEVER decides amounts:
//   1. Identity  → Telegram initData HMAC verification
//   2. Payment   → TON transfer verified on-chain via toncenter
//   3. Amounts   → computed server-side from live prices
//   4. Replay    → tx hash recorded in ton_credits (unique)
//   5. Canje DQ  → se paga contra dq_redeemable, que solo crece aquí al
//                  recibir partidas (tope por partida y por día). El saldo
//                  del cloud save (dq_coins) es cosmético y no da dinero.
// ═══════════════════════════════════════════════════════

import {
  getEnv, json, corsHeaders, supabaseQuery, verifyInitData, findTonPayment, tonDust, tonBucket, tonDustsValidos,
  getDuendePriceUsd, getTonPriceUsd, SKIN_PRICES_USD,
} from './lib.js';

const MIN_PURCHASE_USD = 10;
const MAX_WITHDRAW_USD_24H = 100;   // tope de retiros ton_sell por usuario y día
const STAKE_LOCKS = { 7: 1, 30: 1.5, 90: 2.5 };

// ── INTERRUPTORES DE EMERGENCIA ──
// Para pausar una vía sin desplegar código: pon la variable de entorno
// correspondiente a "off" (npx wrangler secret put PAUSE_STAKE, valor "off").
// Para reactivar, ponla a "on".
//
// ton_stake está APAGADO por defecto a propósito. Recibir cripto de un usuario,
// custodiarla y devolverla incrementada es, en Perú, la conducta del art. 11 de
// la Ley 26702 (captación de fondos del público sin autorización de la SBS),
// sancionada por el art. 246 del Código Penal. Además el código actual acredita
// la recompensa al instante y ningún proceso devuelve el principal en unlock_at.
// No lo reactives sin haber consultado con un abogado peruano y sin haber
// implementado la devolución del principal.
// ton_buy/ton_sell/request_redemption: distribuian $DUENDE (token de Solana)
// DENTRO de la Mini App de Telegram, que las Blockchain Guidelines de
// Telegram prohiben (solo permiten promocionar/distribuir tokens de TON).
// Decision del dueño (2026-09-28): comprar y canjear $DUENDE se hace solo en
// la web. Las skins (skin_ton) se quedan encendidas: no son un token, son un
// cosmetico pagado con TON o Stars, eso si lo permite Telegram.
const SWITCHES = {
  ton_stake: 'off',
  ton_buy: 'off',
  ton_sell: 'off',
  request_redemption: 'off',
};

function isEnabled(env, action) {
  const override = env[`PAUSE_${action.toUpperCase()}`];
  const value = override || SWITCHES[action] || 'on';
  return String(value).toLowerCase() !== 'off';
}

// ── Economía del canje DQ → $DUENDE ──
// El saldo canjeable NO es el del cloud save (ese lo manda el cliente y no es
// de fiar): se acumula aquí, partida a partida, con tope por partida y por día.
const DQ_PER_DUENDE = 1000;
const DQ_MIN_REDEEM = 5000;
const DQ_CAP_PER_GAME = 1500;  // techo duro de una sola partida
const DQ_CAP_PER_DAY = 3000;   // techo diario (≈3 $DUENDE/día jugando en serio)

// DQ plausible de una partida: las monedas escalan con las waves sobrevividas.
function plausibleDq(coins, wave) {
  return Math.max(0, Math.min(coins, 60 + wave * 30, DQ_CAP_PER_GAME));
}

// Candidatos de username para un perfil nuevo, del más bonito al más seguro.
// profiles.username exige longitud 3-20 y es UNIQUE, así que hay que tener
// alternativas: el último candidato lleva el telegram_id y no puede chocar.
function buildUsernames(user, tgId) {
  const clean = s => String(s || '').replace(/[^\w]/g, '').slice(0, 20);
  const base = clean(user.username) || clean(user.first_name);
  const out = [];
  if (base.length >= 3) out.push(base);
  if (base.length >= 1 && base.length < 3) out.push((base + '_dq').slice(0, 20));
  if (base.length >= 3) out.push((base.slice(0, 14) + '_' + tgId.slice(-4)).slice(0, 20));
  out.push(('duende_' + tgId).slice(0, 20));
  return out;
}

async function alreadyCredited(env, txHash) {
  const rows = await supabaseQuery(env, `ton_credits?tx_hash=eq.${encodeURIComponent(txHash)}&select=id`);
  return Array.isArray(rows) && rows.length > 0;
}

// El INSERT es el cerrojo: ton_credits.tx_hash es UNIQUE, asi que de dos
// peticiones simultaneas con el mismo pago solo una consigue la fila. Antes se
// hacia SELECT -> INSERT (ignorando su error) -> acreditar, y disparar varias
// peticiones a la vez acreditaba el mismo pago N veces.
// Devuelve true solo si ESTA peticion registro el pago.
async function claimCredit(env, { txHash, tgId, nanotons, tokens, action }) {
  const rows = await supabaseQuery(env, 'ton_credits', {
    method: 'POST',
    body: { tx_hash: txHash, telegram_id: tgId, nanotons: String(nanotons), tokens_credited: tokens, action },
  });
  return Array.isArray(rows) && rows.length === 1;
}

// ── Ticket de partida ──
// El score lo calcula el cliente, asi que no se puede probar que sea real.
// Lo que si se puede es acotarlo: el servidor firma la hora de inicio de la
// partida y al recibir el score comprueba que la oleada y los puntos caben
// en el tiempo jugado. Medido con el jugador automatico: ~30 s por oleada y
// ~5.000 puntos por oleada; los topes dejan 4-5 veces de margen.
async function firmarRun(secret, tgId, ts) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('run:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(tgId + '|' + ts)));
  return [...sig.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function leerRun(secret, tgId, run) {
  const [tsStr, sig] = String(run || '').split('.');
  const ts = parseInt(tsStr, 10);
  if (!ts || !sig || sig !== await firmarRun(secret, tgId, ts)) return null;
  return ts;
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
  const [tonUsd, duendeUsd] = await Promise.all([getTonPriceUsd(true), getDuendePriceUsd(true)]);
  if (!tonUsd || !duendeUsd) return { err: json(request, { error: 'price_unavailable', detail: 'Precio no disponible, reintenta en un minuto.' }, 503) };
  if (ton * tonUsd < MIN_PURCHASE_USD * 0.95) return { err: json(request, { error: 'below_minimum' }, 400) };

  const pagos = await findTonPayment(env, {
    dusts: await tonDustsValidos(env.BOT_TOKEN, tgId, body.action),
    minNanotons: Math.floor(ton * 1e9) - 1000000,
  });
  if (!pagos.length) return { err: json(request, { error: 'payment_not_found', detail: 'No se encontró la transacción TON. Espera 1-2 min y reintenta.' }, 402) };

  return { tgId, pagos, ton, tonUsd, duendeUsd };
}

async function onRequestPost(context) {
  const { request } = context;
  const env = getEnv(context);

  try {
    const body = await request.json();
    const action = body.action;

    // getEnv() devuelve un objeto acotado, así que el override se lee del entorno crudo.
    if (!isEnabled(context.env, action)) {
      return json(request, { error: 'paused', detail: 'Esta función está temporalmente desactivada.' }, 503);
    }

    // ── RESTO DE PAGO TON (ver tonDust en lib.js) ──
    // El cliente lo pide justo antes de pagar y lo pone en los 6 ultimos
    // digitos del importe en nanotons.
    if (action === 'ton_quote') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const pay = String(body.pay_action || '');
      if (!['ton_buy', 'skin_ton', 'ton_stake'].includes(pay)) return json(request, { error: 'bad_action' }, 400);
      return json(request, { success: true, dust: await tonDust(env.BOT_TOKEN, String(user.id), pay, tonBucket()) });
    }

    // ── BUY $DUENDE WITH TON ──
    if (action === 'ton_buy') {
      const v = await verifyTonFlow(request, env, body);
      if (v.err) return v.err;
      let tokens = 0, pago = null;
      for (const p of v.pagos) {
        const t = Math.floor(((p.nanotons / 1e9) * v.tonUsd) / v.duendeUsd);
        if (await claimCredit(env, { txHash: p.hash, tgId: v.tgId, nanotons: p.nanotons, tokens: t, action })) { pago = p; tokens = t; break; }
      }
      if (!pago) return json(request, { error: 'already_credited' }, 409);
      v.payment = pago;
      const paidUsd = (pago.nanotons / 1e9) * v.tonUsd;
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
      v.payment = v.pagos[0];
      const paidUsd = (v.payment.nanotons / 1e9) * v.tonUsd;
      const apy = Math.min(240, Math.max(50, Math.floor(1000 * v.tonUsd / v.duendeUsd / 1000000)));
      const baseTokens = Math.floor(paidUsd / v.duendeUsd);
      const reward = Math.floor(baseTokens * (apy / 100) * (lockDays / 365) * mult);
      const unlockDate = new Date(Date.now() + lockDays * 86400000).toISOString();
      if (!(await claimCredit(env, { txHash: v.payment.hash, tgId: v.tgId, nanotons: v.payment.nanotons, tokens: reward, action }))) {
        return json(request, { error: 'already_credited' }, 409);
      }
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

      // El destino del retiro es SIEMPRE profiles.wallet_ton, nunca el del
      // body: antes se mandaba a body.wallet_ton (lo que pusiera el cliente
      // en esa peticion), asi que un initData robado (vale 6h) bastaba para
      // retirar a la wallet del atacante conectandola en el momento. Ademas
      // se exige que llevara >=24h registrada (wallet_ton_actualizado, que
      // solo mueve un trigger — el cliente no puede adelantarlo).
      const perfilW = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=wallet_ton,wallet_ton_actualizado&limit=1`);
      const walletTon = perfilW?.[0]?.wallet_ton || '';
      const actualizada = perfilW?.[0]?.wallet_ton_actualizado;
      if (!walletTon) return json(request, { error: 'missing_wallet', detail: 'Conecta y guarda tu wallet TON desde WALLET antes de retirar' }, 400);
      if (!actualizada || Date.now() - Date.parse(actualizada) < 24 * 3600000) {
        return json(request, { error: 'wallet_too_new', detail: 'Tu wallet TON debe llevar al menos 24h conectada antes de poder retirar a ella' }, 403);
      }

      const [tonUsd, duendeUsd] = await Promise.all([getTonPriceUsd(true), getDuendePriceUsd(true)]);
      if (!tonUsd || !duendeUsd) return json(request, { error: 'price_unavailable' }, 503);
      const usd = tokens * duendeUsd;
      if (usd < MIN_PURCHASE_USD * 0.95) return json(request, { error: 'below_minimum' }, 400);

      // una solicitud pendiente a la vez
      const openWd = await supabaseQuery(env, `withdrawal_requests?telegram_id=eq.${tgId}&status=eq.pending&select=id&limit=1`);
      if (Array.isArray(openWd) && openWd.length > 0) return json(request, { error: 'already_pending', detail: 'Ya tienes un retiro pendiente' }, 409);

      // Tope de 24 h por usuario: con un initData robado (vale 6 h) se podia
      // pedir el saldo entero de golpe a cualquier wallet. Con el tope, el
      // dueño tiene tiempo de ver una peticion rara antes de aprobarla.
      const desde = new Date(Date.now() - 86400000).toISOString();
      const recientes = await supabaseQuery(env, `withdrawal_requests?telegram_id=eq.${tgId}&created_at=gte.${encodeURIComponent(desde)}&select=usd_value`);
      const usd24h = Array.isArray(recientes) ? recientes.reduce((t, r) => t + Number(r.usd_value || 0), 0) : 0;
      if (usd24h + usd > MAX_WITHDRAW_USD_24H) {
        return json(request, { error: 'daily_limit', detail: `Máximo $${MAX_WITHDRAW_USD_24H} en retiros cada 24 h` }, 429);
      }

      // Descuento atómico: si no alcanza no toca nada y devuelve -1. Antes esto
      // era leer-comparar-restar en tres pasos, y dos peticiones a la vez
      // generaban dos retiros con el mismo saldo.
      const spent = await supabaseQuery(env, 'rpc/spend_duende', { method: 'POST', body: { p_tg_id: tgId, p_amount: tokens } });
      const newBalance = Number(Array.isArray(spent) ? spent[0] : spent);
      if (!Number.isFinite(newBalance) || newBalance < 0) {
        const profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=duende_balance`);
        const balance = Number(profiles?.[0]?.duende_balance || 0);
        return json(request, { error: 'insufficient_balance', balance }, 400);
      }

      await supabaseQuery(env, 'withdrawal_requests', {
        method: 'POST',
        body: {
          telegram_id: tgId, wallet_ton: walletTon, tokens_burned: tokens,
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

      const tonUsd = await getTonPriceUsd(true);
      if (!tonUsd) return json(request, { error: 'price_unavailable' }, 503);
      const expectedNanotons = Math.floor((usd / tonUsd) * 1e9);
      const pagos = await findTonPayment(env, {
        dusts: await tonDustsValidos(env.BOT_TOKEN, tgId, 'skin_ton'),
        minNanotons: Math.floor(expectedNanotons * 0.95),
      });
      if (!pagos.length) return json(request, { error: 'payment_not_found', detail: 'No se encontró la transacción TON. Espera 1-2 min y reintenta.' }, 402);
      let payment = null;
      for (const p of pagos) {
        if (await claimCredit(env, { txHash: p.hash, tgId, nanotons: p.nanotons, tokens: 0, action: 'skin_' + skinId })) { payment = p; break; }
      }
      if (!payment) return json(request, { error: 'already_credited' }, 409);
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

      // Crear perfil nuevo ligado al telegram_id verificado.
      // profiles.username tiene UNIQUE y CHECK de longitud 3-20: un nombre corto
      // o repetido hacía fallar el INSERT en silencio y el jugador se quedaba
      // sin perfil (y sin cloud save).
      for (const candidate of buildUsernames(user, tgId)) {
        const created = await supabaseQuery(env, 'profiles', { method: 'POST', body: { telegram_id: tgId, username: candidate } });
        if (Array.isArray(created) && created[0]?.id) return json(request, { success: true, profile: created[0] });
      }
      // Si el telegram_id ya existía por una carrera, devolvemos el perfil que ganó.
      profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=*&limit=1`);
      if (Array.isArray(profiles) && profiles.length > 0) return json(request, { success: true, profile: profiles[0] });
      return json(request, { error: 'profile_failed' }, 500);
    }

    // ── UPDATE PROFILE (solo campos permitidos, solo el dueño) ──
    if (action === 'update_profile') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const allowed = {};
      if (typeof body.equipped_skin === 'string' && body.equipped_skin.length <= 30) {
        // Solo se puede equipar una skin comprada: antes bastaba con mandar
        // 'legendaria' para tenerla (y sus buffs) sin pagar.
        if (body.equipped_skin !== 'comun') {
          if (!SKIN_PRICES_USD[body.equipped_skin]) return json(request, { error: 'unknown_skin' }, 400);
          const own = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${tgId}&skin_id=eq.${encodeURIComponent(body.equipped_skin)}&select=id&limit=1`);
          if (!Array.isArray(own) || own.length === 0) return json(request, { error: 'not_owned' }, 403);
        }
        allowed.equipped_skin = body.equipped_skin;
      }
      if (typeof body.wallet_ton === 'string' && body.wallet_ton.length <= 80) allowed.wallet_ton = body.wallet_ton;
      if (Object.keys(allowed).length === 0) return json(request, { error: 'no_fields' }, 400);
      await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}`, { method: 'PATCH', body: allowed });
      return json(request, { success: true });
    }

    // ── MIS DATOS: saldo, skins compradas y stakes del usuario verificado ──
    // Antes la Mini App los leia directamente de Supabase con la clave anon,
    // lo que obligaba a dejar esas tablas legibles por CUALQUIERA (mapa
    // telegram_id <-> wallets <-> saldos). Pasando por aqui se pueden cerrar.
    if (action === 'my_data') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const [prof, skins, stakes] = await Promise.all([
        supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=duende_balance,dq_redeemable,equipped_skin&limit=1`),
        supabaseQuery(env, `skin_purchases?telegram_id=eq.${tgId}&select=skin_id`),
        supabaseQuery(env, `ton_stakes?telegram_id=eq.${tgId}&select=*&order=created_at.desc&limit=5`),
      ]);
      return json(request, {
        success: true,
        profile: Array.isArray(prof) ? prof[0] || null : null,
        skins: Array.isArray(skins) ? skins.map(s => s.skin_id) : [],
        stakes: Array.isArray(stakes) ? stakes : [],
      });
    }

    // ── INICIO DE PARTIDA: ticket firmado para submit_score ──
    if (action === 'start_game') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const ts = Date.now();
      return json(request, { success: true, run: ts + '.' + await firmarRun(env.BOT_TOKEN, String(user.id), ts) });
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
      // Antes se aceptaba score 5.000.000 en la oleada 500 con una sola peticion
      // y sin jugar: primer puesto del torneo y 1.500 DQ canjeables por envio.
      const inicio = await leerRun(env.BOT_TOKEN, tgId, body.run);
      if (!inicio) return json(request, { error: 'bad_run' }, 400);
      const seg = (Date.now() - inicio) / 1000;
      if (seg < 15 || seg > 6 * 3600) return json(request, { error: 'implausible' }, 422);
      if (wave > 1 + seg / 20 || score > 25000 * wave + 30000) return json(request, { error: 'implausible' }, 422);
      // Un ticket vale para un solo envio: si ya hay un score posterior al
      // inicio de esta partida, el ticket esta gastado.
      const ultimo = await supabaseQuery(env, `game_scores?telegram_id=eq.${tgId}&select=created_at&order=created_at.desc&limit=1`);
      if (Array.isArray(ultimo) && ultimo[0] && Date.parse(ultimo[0].created_at) >= inicio) {
        return json(request, { error: 'run_used' }, 409);
      }
      const username = (user.username || user.first_name || 'duende_' + tgId).slice(0, 20);
      // verified explicito: la columna tiene DEFAULT false y Postgres lo aplica
      // ANTES del trigger, asi que el COALESCE(NEW.verified, true) del trigger
      // nunca daba true y el torneo semanal no encontraba a nadie que premiar.
      await supabaseQuery(env, 'game_scores', { method: 'POST', body: { username, score, wave, level, telegram_id: tgId, verified: true } });
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

      // DQ canjeable: única vía de entrada, acotada por partida y por día
      let granted = 0;
      try {
        const day = new Date().toISOString().slice(0, 10);
        const res = await supabaseQuery(env, 'rpc/accrue_dq', {
          method: 'POST',
          body: { p_tg_id: tgId, p_amount: plausibleDq(coins, wave), p_day: day, p_daily_cap: DQ_CAP_PER_DAY },
        });
        granted = Number(Array.isArray(res) ? res[0] : res) || 0;
      } catch (e) {
        console.error('[accrue_dq]', e);
      }
      return json(request, { success: true, dq_granted: granted });
    }

    // ── CLOUD SAVE: sincroniza progreso DQ del jugador (Telegram) ──
    // OJO: estos valores los manda el cliente y son SOLO cosméticos (que no se
    // pierda el progreso al cambiar de teléfono). El dinero real vive en
    // dq_redeemable, que solo crece desde submit_score. No mezclar los dos.
    if (action === 'sync_progress') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const patch = {
        dq_coins: Math.max(0, Math.min(10000000, Math.floor(+body.dq_coins || 0))),
        dq_level: Math.max(1, Math.min(200, Math.floor(+body.dq_level || 1))),
        dq_xp: Math.max(0, Math.min(1000000, Math.floor(+body.dq_xp || 0))),
        streak_day: Math.max(0, Math.min(3650, Math.floor(+body.streak_day || 0))),
        streak_last: String(body.streak_last || '').slice(0, 10),
      };
      await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}`, { method: 'PATCH', body: patch });
      return json(request, { success: true });
    }

    // ── CANJE DQ → $DUENDE (manual semanal) ──
    // 1000 DQ = 1 $DUENDE. Se paga SOLO contra dq_redeemable (ganado partida a
    // partida en el servidor), nunca contra el saldo del cloud save.
    if (action === 'request_redemption') {
      const user = await verifyInitData(body.init_data, env.BOT_TOKEN);
      if (!user?.id) return json(request, { error: 'auth_failed' }, 401);
      const tgId = String(user.id);
      const wallet = String(body.wallet_sol || '').trim();
      const dq = Math.floor(+body.dq_amount || 0);

      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) return json(request, { error: 'bad_wallet', detail: 'Dirección Solana inválida' }, 400);
      if (dq < DQ_MIN_REDEEM) return json(request, { error: 'below_minimum', detail: `Mínimo ${DQ_MIN_REDEEM.toLocaleString()} DQ` }, 400);
      if (dq % DQ_PER_DUENDE !== 0) return json(request, { error: 'bad_amount', detail: `Múltiplos de ${DQ_PER_DUENDE} DQ` }, 400);

      // una solicitud pendiente a la vez
      const open = await supabaseQuery(env, `redemptions?telegram_id=eq.${tgId}&status=eq.pending&select=id&limit=1`);
      if (Array.isArray(open) && open.length > 0) return json(request, { error: 'already_pending', detail: 'Ya tienes un canje pendiente' }, 409);

      // descuento atómico: si no alcanza, no toca nada y devuelve -1
      const rpc = await supabaseQuery(env, 'rpc/redeem_dq', { method: 'POST', body: { p_tg_id: tgId, p_dq: dq } });
      const newBalance = Number(Array.isArray(rpc) ? rpc[0] : rpc);
      if (!Number.isFinite(newBalance) || newBalance < 0) {
        const profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=dq_redeemable`);
        const balance = Number(profiles?.[0]?.dq_redeemable || 0);
        return json(request, { error: 'insufficient', detail: `Saldo canjeable: ${balance.toLocaleString()} DQ`, balance }, 400);
      }

      const duende = dq / DQ_PER_DUENDE;
      const profiles = await supabaseQuery(env, `profiles?telegram_id=eq.${tgId}&select=username`);
      await supabaseQuery(env, 'redemptions', {
        method: 'POST',
        body: { telegram_id: tgId, username: profiles?.[0]?.username || '', wallet_sol: wallet, dq_amount: dq, duende_amount: duende, status: 'pending' },
      });
      return json(request, { success: true, duende, dq, new_balance: newBalance });
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
