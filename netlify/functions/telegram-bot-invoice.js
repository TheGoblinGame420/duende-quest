// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Stars Invoice Generator (Netlify Function)
// Called by Mini App to create Telegram Stars payment links
// ═══════════════════════════════════════════════════════
'use strict';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  try {
    const { pkg_index, tokens, stars, usd, label, tg_id } = JSON.parse(event.body);

    if (!tokens || !stars || stars < 1) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid package' }) };
    }

    const result = await tg('createInvoiceLink', {
      title: `${label} — ${Number(tokens).toLocaleString()} $DUENDE`,
      description: `Compra ${Number(tokens).toLocaleString()} tokens $DUENDE por ${stars} Stars (~$${usd} USD)`,
      payload: JSON.stringify({ pkg: pkg_index, tokens, usd, tg_id }),
      currency: 'XTR',
      prices: [{ label: `${Number(tokens).toLocaleString()} $DUENDE`, amount: stars }],
    });

    if (result.ok && result.result) {
      return { statusCode: 200, headers, body: JSON.stringify({ invoice_url: result.result }) };
    }

    console.error('[Invoice Error]', JSON.stringify(result));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: result.description || 'Failed to create invoice' }),
    };
  } catch (err) {
    console.error('[Invoice Error]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
