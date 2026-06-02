// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Stars Invoice Generator (Cloudflare Pages)
// ═══════════════════════════════════════════════════════

async function tgApi(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function onRequestPost(context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  const token = context.env.TELEGRAM_BOT_TOKEN;

  try {
    const { pkg_index, tokens, stars, usd, label, tg_id, skin_id } = await context.request.json();
    if (!stars || stars < 1) return new Response(JSON.stringify({ error: 'Invalid' }), { headers, status: 400 });

    const result = await tgApi(token, 'createInvoiceLink', {
      title: `${label} — ${Number(tokens||0).toLocaleString()} $DUENDE`,
      description: skin_id ? `Compra skin ${label}` : `Compra ${Number(tokens).toLocaleString()} tokens $DUENDE por ${stars} Stars (~$${usd} USD)`,
      payload: JSON.stringify({ pkg: pkg_index, tokens: tokens||0, usd, tg_id, skin_id: skin_id||null }),
      currency: 'XTR',
      prices: [{ label: skin_id ? label : `${Number(tokens).toLocaleString()} $DUENDE`, amount: stars }],
    });

    if (result.ok && result.result) return new Response(JSON.stringify({ invoice_url: result.result }), { headers });
    return new Response(JSON.stringify({ error: result.description || 'Failed' }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { headers, status: 500 });
  }
}

async function onRequestOptions() {
  return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export default { onRequestPost, onRequestOptions };
