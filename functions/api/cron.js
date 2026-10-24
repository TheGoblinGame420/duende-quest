// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Scheduled jobs (Cloudflare Worker crons)
//   0 3,15 * * *  → keep-alive Supabase (no se pausa el free tier)
//   0 17 * * *    → avisos de vuelta del MMO + recordatorio diario de misiones
//   0 12 * * 1    → torneo semanal: premia al top 3 (lunes 12:00 UTC)
//   0 0 * * *     → fondo diario de mTON del MMO
// ═══════════════════════════════════════════════════════

import { tg, supabaseQuery, postDiscord } from './lib.js';

// El "pulso del mercado" (precio de $DUENDE publicado solo cada dia en
// Telegram y Discord) se quito el 24-oct-2026 a pedido del dueño: molestaba.
// El precio sale cuando alguien escribe /price en el bot, y para comprar /buy.

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
// saltar = telegram_id que no deben recibirlo: los que ya recibieron hoy el
// aviso del MMO (un solo mensaje del bot a la misma hora) y los que pidieron
// no recibir avisos (/avisos off) o bloquearon al bot.
export async function dailyReminder(env, saltar = new Set()) {
  const e = envOf(env);
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const profiles = await supabaseQuery(e, 'profiles?select=telegram_id&telegram_id=not.is.null&limit=500');
  if (!Array.isArray(profiles)) return;
  let sent = 0;
  for (const p of profiles) {
    if (!p.telegram_id || !/^\d+$/.test(p.telegram_id)) continue;
    if (saltar.has(String(p.telegram_id))) continue;
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

// ── Avisos de vuelta de DUENDE QUEST ONLINE ──
// Los arma y manda el propio Durable Object (functions/mmo/retencion.js),
// que tiene el estado de cada personaje. Devuelve a quien escribio y a quien
// no hay que escribir, para que el recordatorio del arcade no repita.
export async function mmoRecordatorios(env) {
  if (!env.MMO) return null;
  const stub = env.MMO.get(env.MMO.idFromName('mundo-1'));
  // Cada llamada manda como mucho ~40 (limite de subpeticiones del DO por
  // invocacion); se repite mientras queden, con un tope de tandas.
  let d = null;
  for (let tanda = 0; tanda < 8; tanda++) {
    let x;
    try {
      const r = await stub.fetch('https://mmo/interno/recordatorios', { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: '{}' });
      x = await r.json();
    } catch (e) {
      // Una tanda que falla no tira lo que ya se juntó (ids de los avisados).
      if (d) { console.error('[MMO avisos tanda]', e); break; }
      throw e;
    }
    if (!d) d = x;
    else { for (const k of ['candidatos', 'enviados', 'bloqueados', 'fallidos']) d[k] = (d[k] || 0) + (x[k] || 0); d.ids = [...(d.ids || []), ...(x.ids || [])]; d.callar = x.callar || d.callar; d.hoy = x.hoy || d.hoy; }
    if (!x.ok || !x.quedan || !x.enviados) break;
  }
  console.log('[MMO avisos]', { candidatos: d.candidatos, enviados: d.enviados, bloqueados: d.bloqueados, fallidos: d.fallidos });
  return d;
}

// ── Torneo semanal ──
export async function weeklyTournament(env) {
  const e = envOf(env);
  const token = env.TELEGRAM_BOT_TOKEN;
  // Clave de la semana premiada: el lunes de la semana natural en curso.
  // Antes era la fecha de ejecución, así que relanzar el cron un martes creaba
  // una clave nueva y volvía a pagar los mismos scores.
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const weekKey = monday.toISOString().slice(0, 10);

  // anti doble pago: ¿ya se premió esta semana?
  const done = await supabaseQuery(e, `tournament_awards?week_key=eq.${weekKey}&select=id&limit=1`);
  if (Array.isArray(done) && done.length > 0) { console.log('[Tournament] already awarded'); return; }

  // Top de la semana pasada. Solo scores VERIFICADOS y con telegram_id: la
  // política de INSERT de game_scores sigue abierta para el juego web, así que
  // cualquiera puede meter un score de 5.000.000 con la clave anon. El trigger
  // mark_score_verified marca como verified=false todo lo que no inserte el
  // Worker, y aquí premiamos solo lo verificado.
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = await supabaseQuery(e, `game_scores?select=username,score,telegram_id&created_at=gte.${since}&verified=is.true&telegram_id=not.is.null&order=score.desc&limit=200`);
  if (!Array.isArray(rows) || rows.length === 0) { console.log('[Tournament] no verified scores'); return; }
  // Una entrada por jugador, por telegram_id (el username no identifica: se repite entre web y Telegram).
  const best = new Map();
  for (const s of rows) { const k = String(s.telegram_id); if (!best.has(k) || s.score > best.get(k).score) best.set(k, s); }
  const top = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 3);

  for (let i = 0; i < top.length; i++) {
    const w = top[i];
    const prize = TOURNAMENT_PRIZES[i];
    const tgId = w.telegram_id;
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
  const podium = top.map((t, i) => `${medals[i]} **${String(t.username || '?').replace(/[*_\[\]`()~|>]/g, '').slice(0, 20)}** — ${Number(t.score).toLocaleString()} pts → +${TOURNAMENT_PRIZES[i].toLocaleString()} $DUENDE`).join('\n');
  await postDiscord(env, `🏆 **¡GANADORES DEL TORNEO SEMANAL!** 🏆\n\n${podium}\n\n¡Felicidades duendes! 🧝 La nueva semana ya empezó — ¿quién será el próximo rey? 👑\n🎮 https://t.me/duendequest_bot`);
  console.log('[Tournament] awarded week', weekKey, top.map(t => t.username));
}

// ── Fondo diario de mTON (play to earn del MMO) ──
// Se reparte como maximo un % de lo que entro la semana anterior: TON
// verificados on-chain (ton_credits) + Stars (stars_purchases, en USD, que se
// pasan a TON al precio del dia). Asi nunca se promete mas de lo que entro.
// El dueño puede sumar TON propios con /fondo <TON> en el bot.
// 0 desde el 22-oct-2026: el fondo de mTON lo aporta solo el creador (/fondo),
// nunca lo que pagan otros jugadores (no parecer un "pozo").
const FONDO_PCT = 0;
async function precioTonUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
    const d = await r.json();
    const p = Number(d && d['the-open-network'] && d['the-open-network'].usd);
    return p > 0 ? p : 0;
  } catch (e) { return 0; }
}
export async function mmoFondo(env) {
  if (!env.MMO) return;
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const [tons, stars, precio] = await Promise.all([
    supabaseQuery(env, `ton_credits?created_at=gte.${desde}&select=nanotons`),
    supabaseQuery(env, `stars_purchases?created_at=gte.${desde}&select=amount_usd`),
    precioTonUsd(),
  ]);
  const tonSemana = (Array.isArray(tons) ? tons : []).reduce((a, x) => a + Number(x.nanotons || 0) / 1e9, 0);
  const usdSemana = (Array.isArray(stars) ? stars : []).reduce((a, x) => a + Number(x.amount_usd || 0), 0);
  const ingresoTon = tonSemana + (precio ? usdSemana / precio : 0);
  const autoMton = Math.floor(ingresoTon * FONDO_PCT / 7 * 1000);
  const stub = env.MMO.get(env.MMO.idFromName('mundo-1'));
  const r = await stub.fetch('https://mmo/interno/fondo', { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: JSON.stringify({ auto: autoMton, precioTon: precio }) });
  console.log('[Fondo mTON]', { tonSemana, usdSemana, precio, autoMton, resp: await r.text() });
}

export async function runCron(cronExpr, env) {
  if (cronExpr === '0 17 * * *') {
    // Primero el MMO: si falla, el recordatorio del arcade sale igual.
    // Ni a los avisados hoy por el MMO (a su hora o ahora) ni a los que se
    // avisaran mas tarde a su hora habitual: un solo mensaje por persona.
    let saltar = null;
    try {
      const d = await mmoRecordatorios(env);
      if (!env.MMO) saltar = new Set();
      else if (d && d.ok) saltar = new Set([...(d.ids || []), ...(d.callar || []), ...(d.hoy || [])].map(String));
    } catch (e) { console.error('[Cron avisos MMO]', e); }
    // Si fallo, se pide solo la lista; si tampoco llega, hoy no sale el
    // recordatorio del arcade (mejor ninguno que dos al mismo jugador).
    if (!saltar) {
      try {
        const stub = env.MMO.get(env.MMO.idFromName('mundo-1'));
        const r = await stub.fetch('https://mmo/interno/avisadosHoy', { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: '{}' });
        const x = await r.json();
        if (x && x.ok) saltar = new Set([...(x.callar || []), ...(x.hoy || [])].map(String));
      } catch (e) { console.error('[Cron avisados MMO]', e); }
    }
    if (!saltar) { console.error('[Cron] sin la lista del MMO: hoy no sale el recordatorio del arcade'); return; }
    return dailyReminder(env, saltar);
  }
  if (cronExpr === '0 12 * * 1') return weeklyTournament(env);
  if (cronExpr === '0 0 * * *') {
    return mmoFondo(env);
  }
  return keepAlive(env);
}
