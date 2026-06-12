// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Scheduled jobs (Cloudflare Worker crons)
//   0 3,15 * * *  → keep-alive Supabase (no se pausa el free tier)
//   0 17 * * *    → recordatorio diario de misiones
//   0 12 * * 1    → torneo semanal: premia al top 3 (lunes 12:00 UTC)
// ═══════════════════════════════════════════════════════

import { tg, supabaseQuery } from './lib.js';

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
  console.log('[Tournament] awarded week', weekKey, top.map(t => t.username));
}

export async function runCron(cronExpr, env) {
  if (cronExpr === '0 17 * * *') return dailyReminder(env);
  if (cronExpr === '0 12 * * 1') return weeklyTournament(env);
  return keepAlive(env);
}
