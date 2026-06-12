// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Stars Invoice Generator (Cloudflare Worker)
// SECURITY: amounts are computed SERVER-SIDE. The client only
// chooses WHAT to buy (pkg_index or skin_id), never how much.
// ═══════════════════════════════════════════════════════

import {
  tg, json, corsHeaders, getDuendePriceUsd, getEnv, supabaseQuery,
  STAR_USD, STARS_PACKAGES, SKIN_PRICES_USD,
} from './lib.js';

// ¿Primera compra de este usuario? (server-side, se re-verifica al acreditar)
export async function isFirstPurchase(env, tgId) {
  if (!tgId) return false;
  const rows = await supabaseQuery(env, `stars_purchases?telegram_id=eq.${encodeURIComponent(tgId)}&tokens_credited=gt.0&select=id&limit=1`);
  return Array.isArray(rows) && rows.length === 0;
}

async function onRequestPost(context) {
  const { request } = context;
  const token = context.env.TELEGRAM_BOT_TOKEN;

  try {
    const body = await request.json();
    const tgId = String(body.tg_id || '');

    let invoice;
    if (body.skin_id) {
      // ── Skin purchase ──
      const skinId = String(body.skin_id);
      const usd = SKIN_PRICES_USD[skinId];
      if (!usd) return json(request, { error: 'unknown_skin' }, 400);
      const stars = Math.ceil(usd / STAR_USD);
      invoice = {
        title: `🎨 Skin: ${skinId}`,
        description: `Compra la skin ${skinId} por ${stars} Stars (~$${usd} USD)`,
        payload: JSON.stringify({ skin_id: skinId, usd, tg_id: tgId }),
        currency: 'XTR',
        prices: [{ label: `Skin ${skinId}`, amount: stars }],
      };
    } else {
      // ── Token package purchase ──
      const pkgIndex = parseInt(body.pkg_index, 10);
      const pkg = STARS_PACKAGES[pkgIndex];
      if (!pkg) return json(request, { error: 'unknown_package' }, 400);
      const env = getEnv(context);
      const [priceUsd, firstBuy] = await Promise.all([getDuendePriceUsd(), isFirstPurchase(env, tgId)]);
      const stars = Math.ceil(pkg.usd / STAR_USD);
      let tokens = Math.floor(pkg.usd / priceUsd);
      if (firstBuy) tokens *= 2; // oferta de bienvenida 2x (se re-verifica en el webhook)
      invoice = {
        title: `${firstBuy ? '🎁 OFERTA 1ª COMPRA 2x — ' : ''}${pkg.label} — ${tokens.toLocaleString()} $DUENDE`,
        description: `${firstBuy ? '¡Bienvenida 2x! ' : ''}Compra ${tokens.toLocaleString()} tokens $DUENDE por ${stars} Stars (~$${pkg.usd} USD)`,
        payload: JSON.stringify({ pkg: pkgIndex, tokens, usd: pkg.usd, tg_id: tgId, first_buy: firstBuy }),
        currency: 'XTR',
        prices: [{ label: `${tokens.toLocaleString()} $DUENDE`, amount: stars }],
      };
    }

    const result = await tg(token, 'createInvoiceLink', invoice);
    if (result.ok && result.result) return json(request, { invoice_url: result.result });
    return json(request, { error: result.description || 'Failed' }, 502);
  } catch (err) {
    return json(context.request, { error: 'server_error' }, 500);
  }
}

async function onRequestOptions(context) {
  return new Response('', { headers: corsHeaders(context.request) });
}

export default { onRequestPost, onRequestOptions };
