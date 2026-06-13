// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Scheduled jobs (Cloudflare Worker crons)
//   0 3,15 * * *  → keep-alive Supabase (no se pausa el free tier)
//   0 17 * * *    → recordatorio diario de misiones
//   0 12 * * 1    → torneo semanal: premia al top 3 (lunes 12:00 UTC)
// ═══════════════════════════════════════════════════════

import { tg, supabaseQuery, postDiscord, getDuendePriceUsd } from './lib.js';

const PUMP_URL = 'https://pump.fun/coin/HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';

// Ganchos de venta rotativos (uno distinto cada día según el día del año)
const HYPE = [
  '💎 Manos de diamante: el que aguanta, gana. ¿Ya tienes los tuyos?',
  '🧝 El Duende no duerme — y tu bolsa tampoco debería. HODL $DUENDE.',
  '🎮 Cada partida te da $DUENDE GRATIS. ¿Por qué no estás jugando?',
  '🚀 Los early siempre cuentan la mejor historia. Tú estás temprano.',
  '🔥 Comunidad fuerte = moneda fuerte. Trae un amigo hoy.',
  '👑 El TOP del torneo gana $DUENDE cada lunes. ¿Vas por la corona?',
  '🪙 Acumula jugando, compra en los dips, repite. El camino del duende.',
];

// ── Pulso diario del mercado $DUENDE (precio en vivo + gancho) ──
export async function marketPulse(env) {
  const price = await getDuendePriceUsd();
  const hype = HYPE[Math.floor(Date.now() / 86400000) % HYPE.length];
  const priceStr = price > 0 ? '$' + price.toFixed(8) : 'consulta el gráfico';
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  await postDiscord(env, `📊 **PULSO $DUENDE — ${fecha}**\n\n💰 Precio: **${priceStr}**\n${hype}\n\n🪙 Comprar: ${PUMP_URL}\n🎮 Jugar y ganar: https://t.me/duendequest_bot`);
  // Canal de Telegram (HTML para que las URLs con _ no rompan el mensaje)
  if (env.TELEGRAM_BOT_TOKEN && env.TG_CHANNEL_ID) {
    try {
      await tg(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: env.TG_CHANNEL_ID,
        text: `📊 <b>PULSO $DUENDE — ${fecha}</b>\n\n💰 Precio: <b>${priceStr}</b>\n${hype}`,
        parse_mode: 'HTML', disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: '🪙 COMPRAR $DUENDE', url: PUMP_URL }], [{ text: '🎮 JUGAR Y GANAR', url: 'https://t.me/duendequest_bot' }]] },
      });
    } catch (e) {}
  }
  console.log('[MarketPulse] posted, price', price);
}

const WEBAPP_URL = 'https://duende-quest.alfonso12hc.workers.dev/telegram/index.html';
const TOURNAMENT_PRIZES = [1000, 500, 250]; // $DUENDE para top 1-3

function envOf(env) {
  return {
    SUPABASE_URL: env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co',
    SUPABASE_KEY: env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || '',
  };
}

// ── Keep-alive ──
export async function keepAlive(env) {
  const e = envOf(env);
  const r = await fetch(`${e.SUPABASE_URL}/rest/v1/game_scores?select=id&limit=1`, {
    headers: { 'apikey': e.SUPABASE_KEY, 'Authorization': `Bearer ${e.SUPABASE_KEY}` },
  });
  console.log('[KeepAlive] Supabase ping:', r.status);
}

// ── Recordatorio diario ──
export async function dailyReminder(env) {
  const e = envOf(env);
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const profiles = await supabaseQuery(e, 'profiles?select=telegram_id&telegram_id=not.is.null&limit=500');
  if (!Array.isArray(profiles)) return;
  let sent = 0;
  for (const p of profiles) {
    if (!p.telegram_id || !/^\d+$/.test(p.telegram_id)) continue;
    try {
      await tg(token, 'sendMessage', {
        chat_id: p.telegram_id,
        text: '🎯 *Tus misiones diarias te esperan*\n\n🔥 No pierdas tu racha — el bonus de hoy puede ser de hasta *100 DQ*\n🏆 El torneo semanal está en juego',
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR AHORA', web_app: { url: WEBAPP_URL } }]] },
      });
      sent++;
      // respeta el rate limit de Telegram (~30 msg/s; vamos muy por debajo)
      if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1100));
    } catch (err) { /* usuario bloqueó el bot, etc. */ }
  }
  console.log('[DailyReminder] sent:', sent);
  await postDiscord(env, '🎯 **¡Nuevas misiones diarias disponibles!**\n🔥 No pierdas tu racha — hoy puedes ganar hasta 100 DQ\n🎮 Juega: https://t.me/duendequest_bot');
}

// ── Torneo semanal ──
export async function weeklyTournament(env) {
  const e = envOf(env);
  const token = env.TELEGRAM_BOT_TOKEN;
  // clave de la semana premiada (lunes actual = cierre de la semana anterior)
  const weekKey = new Date().toISOString().slice(0, 10);

  // anti doble pago: ¿ya se premió esta semana?
  const done = await supabaseQuery(e, `tournament_awards?week_key=eq.${weekKey}&select=id&limit=1`);
  if (Array.isArray(done) && done.length > 0) { console.log('[Tournament] already awarded'); return; }

  // top de la semana pasada, una entrada por jugador
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = await supabaseQuery(e, `game_scores?select=username,score,telegram_id&created_at=gte.${since}&order=score.desc&limit=200`);
  if (!Array.isArray(rows) || rows.length === 0) { console.log('[Tournament] no scores'); return; }
  const best = new Map();
  for (const s of rows) { const k = (s.username || '?').toLowerCase(); if (!best.has(k) || s.score > best.get(k).score) best.set(k, s); }
  const top = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 3);

  for (let i = 0; i < top.length; i++) {
    const w = top[i];
    const prize = TOURNAMENT_PRIZES[i];
    // localizar telegram_id (en el score o via perfil por username)
    let tgId = w.telegram_id;
    if (!tgId) {
      const prof = await supabaseQuery(e, `profiles?username=eq.${encodeURIComponent(w.username)}&select=telegram_id&limit=1`);
      tgId = Array.isArray(prof) && prof[0]?.telegram_id;
    }
    await supabaseQuery(e, 'tournament_awards', {
      method: 'POST',
      body: { week_key: weekKey, position: i + 1, username: w.username, score: w.score, prize_duende: prize, telegram_id: tgId || null },
    });
    if (tgId && /^\d+$/.test(String(tgId))) {
      await supabaseQuery(e, 'rpc/add_duende_by_tgid', { method: 'POST', body: { p_tg_id: String(tgId), p_amount: prize } });
      if (token) {
        try {
          await tg(token, 'sendMessage', {
            chat_id: tgId,
            text: `🏆 *¡TORNEO SEMANAL — PUESTO #${i + 1}!*\n\nTu mejor score: *${Number(w.score).toLocaleString()}*\n💎 Premio: *+${prize.toLocaleString()} $DUENDE*\n\n¡La nueva semana ya empezó — defiende tu corona!`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🎮 JUGAR', web_app: { url: WEBAPP_URL } }]] },
          });
        } catch (err) {}
      }
    }
  }
  // Anuncio público en Discord con los ganadores
  const medals = ['🥇', '🥈', '🥉'];
  const podium = top.map((t, i) => `${medals[i]} **${t.username}** — ${Number(t.score).toLocaleString()} pts → +${TOURNAMENT_PRIZES[i].toLocaleString()} $DUENDE`).join('\n');
  await postDiscord(env, `🏆 **¡GANADORES DEL TORNEO SEMANAL!** 🏆\n\n${podium}\n\n¡Felicidades duendes! 🧝 La nueva semana ya empezó — ¿quién será el próximo rey? 👑\n🎮 https://t.me/duendequest_bot`);
  console.log('[Tournament] awarded week', weekKey, top.map(t => t.username));
}

export async function runCron(cronExpr, env) {
  if (cronExpr === '0 17 * * *') return dailyReminder(env);
  if (cronExpr === '0 12 * * 1') return weeklyTournament(env);
  if (cronExpr === '0 0 * * *') return marketPulse(env);
  return keepAlive(env);
}
