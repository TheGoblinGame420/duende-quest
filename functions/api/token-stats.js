// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Token stats reales (holders + market cap)
// Holders: Helius DAS getTokenAccounts (server-side, paginado).
// Cacheado 5 min con Cache API para no agotar la cuota.
// ═══════════════════════════════════════════════════════

import { json, corsHeaders, TOKEN_CA, getDuendePriceUsd } from './lib.js';

async function countHolders(heliusKey) {
  if (!heliusKey) return null;
  let page = 1, total = 0;
  const MAX_PAGES = 12; // tope de seguridad (~12k holders)
  while (page <= MAX_PAGES) {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'dq', method: 'getTokenAccounts',
        params: { mint: TOKEN_CA, page, limit: 1000, options: { showZeroBalance: false } },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    const accts = d?.result?.token_accounts;
    if (!Array.isArray(accts) || accts.length === 0) break;
    // contar solo cuentas con saldo > 0
    total += accts.filter(a => Number(a.amount || 0) > 0).length;
    if (accts.length < 1000) break;
    page++;
  }
  return total;
}

async function onRequestGet(context) {
  const { request, env } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/token-stats', { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let holders = null;
  try { holders = await countHolders(env.HELIUS_API_KEY); } catch (e) {}
  const mcap = await getDuendePriceUsd().then(p => p * 1e9).catch(() => 0); // supply pump.fun = 1B

  const res = json(request, { holders, mcap, ts: Date.now() });
  res.headers.set('Cache-Control', 'public, max-age=300'); // 5 min
  context.ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function onRequestOptions(context) {
  return new Response('', { headers: corsHeaders(context.request) });
}

export default { onRequestGet, onRequestOptions };
