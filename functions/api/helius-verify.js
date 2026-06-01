// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Helius NFT Verification (Cloudflare Pages)
// ═══════════════════════════════════════════════════════

const DEV_WALLET = 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J';

function getEnv(context) {
  return {
    HELIUS_API_KEY: context.env.HELIUS_API_KEY,
    SUPABASE_URL: context.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co',
    SUPABASE_KEY: context.env.SUPABASE_SERVICE_KEY || context.env.SUPABASE_ANON_KEY || '',
  };
}

async function supabaseQuery(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'apikey': env.SUPABASE_KEY, 'Authorization': `Bearer ${env.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': options.prefer || 'return=representation' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return r.json();
}

async function verifyTransaction(heliusKey, txSignature, expectedSol, senderWallet) {
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] }),
    });
    const data = await r.json();
    const tx = data?.result;
    if (!tx || tx.meta?.err) return { valid: false, error: 'TX failed or not found' };
    const instructions = tx.transaction?.message?.instructions || [];
    const transfers = instructions.filter(i => i.parsed?.type === 'transfer' && i.parsed?.info?.destination === DEV_WALLET);
    if (transfers.length === 0) return { valid: false, error: 'No transfer to dev wallet' };
    const totalSol = transfers.reduce((sum, t) => sum + (t.parsed?.info?.lamports || 0), 0) / 1e9;
    if (totalSol < expectedSol * 0.95) return { valid: false, error: `Expected ${expectedSol} SOL, got ${totalSol}` };
    return { valid: true, sol: totalSol };
  } catch (e) { return { valid: false, error: e.message }; }
}

async function getNFTs(heliusKey, walletAddress) {
  try {
    const r = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/nfts?api-key=${heliusKey}`);
    return await r.json();
  } catch (e) { return []; }
}

export async function onRequestPost(context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  const env = getEnv(context);

  try {
    const body = await context.request.json();
    const { action } = body;

    if (action === 'verify_skin_purchase') {
      const { tx_signature, skin_id, wallet_address, expected_sol, telegram_id } = body;
      if (!tx_signature || !skin_id || !wallet_address) return new Response(JSON.stringify({ error: 'Missing fields' }), { headers, status: 400 });
      const existing = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${wallet_address}&skin_id=eq.${skin_id}&select=id`);
      if (Array.isArray(existing) && existing.length > 0) return new Response(JSON.stringify({ success: true, already_owned: true }), { headers });
      const result = await verifyTransaction(env.HELIUS_API_KEY, tx_signature, expected_sol, wallet_address);
      if (!result.valid) return new Response(JSON.stringify({ success: false, error: result.error }), { headers });
      const purchaseData = { skin_id, payment_type: 'sol', amount_paid: result.sol, tx_signature, wallet_address };
      if (telegram_id) purchaseData.telegram_id = telegram_id;
      else {
        const profiles = await supabaseQuery(env, `profiles?or=(wallet_address.eq.${wallet_address},wallet_solana.eq.${wallet_address})&select=telegram_id`);
        purchaseData.telegram_id = (Array.isArray(profiles) && profiles[0]?.telegram_id) ? profiles[0].telegram_id : 'wallet_' + wallet_address.slice(0, 8);
      }
      await supabaseQuery(env, 'skin_purchases', { method: 'POST', body: purchaseData });
      return new Response(JSON.stringify({ success: true, sol: result.sol }), { headers });
    }

    if (action === 'get_owned_skins') {
      const { wallet_address, telegram_id } = body;
      let skins = [];
      if (telegram_id) { const data = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${telegram_id}&select=skin_id`); if (Array.isArray(data)) skins = data.map(s => s.skin_id); }
      if (wallet_address) {
        const profiles = await supabaseQuery(env, `profiles?or=(wallet_address.eq.${wallet_address},wallet_solana.eq.${wallet_address})&select=telegram_id`);
        if (Array.isArray(profiles) && profiles[0]?.telegram_id) {
          const data = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${profiles[0].telegram_id}&select=skin_id`);
          if (Array.isArray(data)) data.forEach(s => { if (!skins.includes(s.skin_id)) skins.push(s.skin_id); });
        }
      }
      return new Response(JSON.stringify({ skins }), { headers });
    }

    if (action === 'check_nfts') {
      const nfts = await getNFTs(env.HELIUS_API_KEY, body.wallet_address);
      return new Response(JSON.stringify({ nfts: nfts.length, items: nfts.slice(0, 20) }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { headers, status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { headers, status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
}
