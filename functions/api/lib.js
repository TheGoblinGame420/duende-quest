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
export async function getDuendePriceUsd() {
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
  return 0.0000001; // floor fallback
}

export async function getTonPriceUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.['the-open-network']?.usd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return 3.5;
}

export async function getSolPriceUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.solana?.usd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return 170;
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

// ── TON on-chain payment verification (toncenter) ──
// Looks for a recent incoming transfer to the dev wallet matching the
// expected amount (and sender when address formats are comparable).
// Anti-replay is enforced by the caller via the ton_credits table.
export async function findTonPayment(env, { fromWallet, minNanotons, windowSeconds = 1200 }) {
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
    candidates.push({
      hash: txn.transaction_id?.hash || '',
      nanotons: value,
      utime: txn.utime,
      source: inMsg.source || '',
    });
  }
  if (candidates.length === 0) return null;
  // Prefer exact sender match (raw vs friendly formats may differ; fall back to amount+window match)
  const exact = candidates.find(c => fromWallet && c.source === fromWallet);
  return exact || candidates[0];
}
