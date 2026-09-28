// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Shared backend utilities (Cloudflare Worker)
// Security-critical helpers: keep all price/amount math HERE,
// never trust amounts coming from the client.
// ═══════════════════════════════════════════════════════

export const TOKEN_CA = 'HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';
export const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`;
export const PUMP_API = `https://frontend-api-v3.pump.fun/coins/${TOKEN_CA}`;
export const TON_DEV_WALLET = 'UQAm2w4HcJ1tW8RBNj7BZQh0Q-ckpzlxzD-r8p2JduHkpQnc';
export const SOL_DEV_WALLET = 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J';

export const STAR_USD = 0.013;
export const STARS_PACKAGES = [
  { label: '🌟 Starter', usd: 10 },
  { label: '💎 Pro', usd: 25 },
  { label: '🔥 Mega', usd: 50 },
  { label: '👑 Whale', usd: 100 },
];
// Single source of truth for skin prices (USD). Clients only display these.
export const SKIN_PRICES_USD = {
  tactico: 25, necro: 50, king: 75, berserker: 120, legendaria: 250,
};

const ALLOWED_ORIGINS = [
  'https://duende-quest.alfonso12hc.workers.dev',
  'http://localhost:3456',
  'http://127.0.0.1:3456',
];

export function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

export function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { headers: corsHeaders(request), status });
}

export function getEnv(context) {
  return {
    BOT_TOKEN: context.env.TELEGRAM_BOT_TOKEN,
    WEBHOOK_SECRET: context.env.TELEGRAM_WEBHOOK_SECRET || '',
    HELIUS_API_KEY: context.env.HELIUS_API_KEY,
    TONCENTER_API_KEY: context.env.TONCENTER_API_KEY || '',
    SUPABASE_URL: context.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co',
    // Privileged writes REQUIRE the service key. The anon-key fallback exists only
    // so reads keep working until SUPABASE_SERVICE_KEY is configured.
    SUPABASE_KEY: context.env.SUPABASE_SERVICE_KEY || context.env.SUPABASE_ANON_KEY || '',
    HAS_SERVICE_KEY: !!context.env.SUPABASE_SERVICE_KEY,
    DISCORD_WEBHOOK_URL: context.env.DISCORD_WEBHOOK_URL || '',
    ADMIN_TG_ID: context.env.ADMIN_TG_ID || '',
  };
}

export async function tg(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Publica un mensaje en Discord via webhook (no-op si no está configurado)
export async function postDiscord(env, content) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
  } catch (e) { console.error('[Discord]', e); }
}

export async function supabaseQuery(env, path, options = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
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

// ── Live prices (server-side only) ──
// estricto = true devuelve null si fallan las fuentes en vez del precio de
// respaldo. Para mostrar precios el respaldo vale; para mover dinero no: con
// $DUENDE a 0,0000001 (20 veces por debajo del real) ton_buy entregaba 20
// veces mas tokens de los pagados.
export async function getDuendePriceUsd(estricto = false) {
  try {
    const r = await fetch(PUMP_API, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d && d.usd_market_cap) return parseFloat(d.usd_market_cap) / 1_000_000_000;
  } catch (e) {}
  try {
    const r = await fetch(DEXSCREENER_URL, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.pairs?.[0]?.priceUsd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return estricto ? null : 0.0000001; // floor fallback
}

export async function getTonPriceUsd(estricto = false) {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.['the-open-network']?.usd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return estricto ? null : 3.5;
}

export async function getSolPriceUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.solana?.usd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return null; // sin precio real no se cobra de menos por un valor fijo desfasado
}

// ── Sesion de la web (Supabase Auth) ──
// Equivalente a verifyInitData pero para game.html/index.html, que no tienen
// Telegram. El cliente manda el access_token de su propia sesion de
// Supabase; se lo pasamos a Supabase Auth para que diga de quien es. No hace
// falta ningun secreto nuevo: la apikey puede ser la de servicio que ya
// tenemos, lo que decide la respuesta es el Bearer del USUARIO.
export async function verifySupabaseUser(env, accessToken) {
  try {
    if (!accessToken) return null;
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch (e) {
    return null;
  }
}

// ── Telegram WebApp initData verification (HMAC-SHA256) ──
// Returns the verified Telegram user object, or null if invalid/stale.
export async function verifyInitData(initData, botToken, maxAgeSeconds = 6 * 3600) {
  try {
    if (!initData || !botToken) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const enc = new TextEncoder();
    const seedKey = await crypto.subtle.importKey('raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const secret = await crypto.subtle.sign('HMAC', seedKey, enc.encode(botToken));
    const hmacKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== hash) return null;
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (!authDate || (Date.now() / 1000) - authDate > maxAgeSeconds) return null;
    return JSON.parse(params.get('user') || 'null');
  } catch (e) {
    return null;
  }
}

// ── Firma de pagos TON ──
// Antes el servidor aceptaba CUALQUIER pago reciente a la wallet dev que
// superase el importe, asi que un atacante que viera en la cadena el pago de
// otro podia reclamarlo como suyo. Ahora cada usuario recibe un "resto" unico
// (los 6 ultimos digitos del importe en nanotons), derivado con HMAC de su
// telegram_id, la accion y una ventana de 10 minutos. El pago solo cuenta si
// acaba en SU resto. Sin tablas nuevas: el servidor lo recalcula al verificar.
export function tonBucket(t = Date.now()) { return Math.floor(t / 600000); }
export async function tonDust(secret, tgId, action, bucket) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('ton-dust:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(tgId + '|' + action + '|' + bucket)));
  const n = ((sig[0] << 24) >>> 0) + (sig[1] << 16) + (sig[2] << 8) + sig[3];
  return 1000 + (n % 998000);   // 0,000001-0,000999 TON: invisible para el usuario
}
// Restos validos ahora y en las dos ventanas anteriores (el pago tarda en confirmarse).
export async function tonDustsValidos(secret, tgId, action) {
  const b = tonBucket();
  return Promise.all([b, b - 1, b - 2].map(x => tonDust(secret, tgId, action, x)));
}

// ── TON on-chain payment verification (toncenter) ──
// Busca un pago reciente a la wallet dev cuyo importe acabe en uno de los
// restos del usuario (ver tonDust). El anti-replay lo hace quien llama,
// insertando el hash en ton_credits (UNIQUE) ANTES de acreditar.
export async function findTonPayment(env, { dusts, minNanotons, windowSeconds = 1200 }) {
  const key = env.TONCENTER_API_KEY ? `&api_key=${encodeURIComponent(env.TONCENTER_API_KEY)}` : '';
  const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(TON_DEV_WALLET)}&limit=30${key}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const d = await r.json();
  if (!d?.ok || !Array.isArray(d.result)) return null;
  const since = Math.floor(Date.now() / 1000) - windowSeconds;
  const candidates = [];
  for (const txn of d.result) {
    const inMsg = txn.in_msg;
    if (!inMsg || txn.utime < since) continue;
    const value = parseInt(inMsg.value || '0', 10);
    if (value < minNanotons * 0.99) continue;
    if (!Array.isArray(dusts) || !dusts.includes(value % 1000000)) continue;
    candidates.push({
      hash: txn.transaction_id?.hash || '',
      nanotons: value,
      utime: txn.utime,
      source: inMsg.source || '',
    });
  }
  // Solo pagos firmados con el resto del usuario. Se devuelven TODOS: si el
  // usuario pago dos veces seguidas, quien llama reclama el primero libre (con
  // solo el primero, un pago viejo quedaba tapado por uno ya acreditado).
  return candidates;
}
