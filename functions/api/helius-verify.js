// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Helius NFT Verification (Cloudflare Pages)
// ═══════════════════════════════════════════════════════

import { verifyInitData } from './lib.js';

const DEV_WALLET = 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J';
// Direccion Solana en base58 (32-44 caracteres, sin 0 O I l).
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getEnv(context) {
  return {
    HELIUS_API_KEY: context.env.HELIUS_API_KEY,
    SUPABASE_URL: context.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co',
    SUPABASE_KEY: context.env.SUPABASE_SERVICE_KEY || context.env.SUPABASE_ANON_KEY || '',
  };
}

// Los valores que vienen del cliente se interpolan en filtros de PostgREST:
// sin escapar, un valor con `&`, `,` o `)` reescribe la consulta y deja leer
// filas ajenas de skin_purchases/profiles.
function enc(v) {
  return encodeURIComponent(String(v == null ? '' : v));
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

// SECURITY: skin prices live server-side; the client's `expected_sol` is ignored.
const SKIN_PRICES_USD = { tactico: 25, necro: 50, king: 75, berserker: 120, legendaria: 250 };

async function getSolPriceUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    const p = parseFloat(d?.solana?.usd || 0);
    if (p > 0) return p;
  } catch (e) {}
  return null;   // sin precio real no se verifica: con 170 fijo se podia pagar de menos
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
    // The transfer must go TO the dev wallet AND come FROM the claiming wallet
    const transfers = instructions.filter(i =>
      i.parsed?.type === 'transfer' &&
      i.parsed?.info?.destination === DEV_WALLET &&
      (!senderWallet || i.parsed?.info?.source === senderWallet)
    );
    if (transfers.length === 0) return { valid: false, error: 'No transfer from sender to dev wallet' };
    const totalSol = transfers.reduce((sum, t) => sum + (t.parsed?.info?.lamports || 0), 0) / 1e9;
    if (totalSol < expectedSol * 0.88) return { valid: false, error: `Expected ~${expectedSol.toFixed(4)} SOL, got ${totalSol}` };
    return { valid: true, sol: totalSol };
  } catch (e) { return { valid: false, error: e.message }; }
}

async function getNFTs(heliusKey, walletAddress) {
  try {
    const r = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/nfts?api-key=${heliusKey}`);
    return await r.json();
  } catch (e) { return []; }
}

async function onRequestPost(context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  const env = getEnv(context);

  try {
    const body = await context.request.json();
    const { action } = body;

    if (action === 'verify_skin_purchase') {
      const { tx_signature, skin_id, wallet_address, telegram_id } = body;
      if (!tx_signature || !skin_id || !wallet_address) return new Response(JSON.stringify({ error: 'Missing fields' }), { headers, status: 400 });
      if (!SOL_ADDR.test(wallet_address) || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(tx_signature)) return new Response(JSON.stringify({ error: 'Bad fields' }), { headers, status: 400 });
      // Server-side price — never trust the client's expected_sol
      const usd = SKIN_PRICES_USD[skin_id];
      if (!usd) return new Response(JSON.stringify({ error: 'Unknown skin' }), { headers, status: 400 });
      const existing = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${enc(wallet_address)}&skin_id=eq.${enc(skin_id)}&select=id`);
      if (Array.isArray(existing) && existing.length > 0) return new Response(JSON.stringify({ success: true, already_owned: true }), { headers });
      // Anti-replay: each tx signature can only unlock one purchase
      const replay = await supabaseQuery(env, `skin_purchases?tx_signature=eq.${encodeURIComponent(tx_signature)}&select=id`);
      if (Array.isArray(replay) && replay.length > 0) return new Response(JSON.stringify({ success: false, error: 'TX already used' }), { headers });
      const solUsd = await getSolPriceUsd();
      if (!solUsd) return new Response(JSON.stringify({ success: false, error: 'Precio de SOL no disponible, reintenta en un minuto' }), { headers, status: 503 });
      const expectedSol = usd / solUsd;
      const result = await verifyTransaction(env.HELIUS_API_KEY, tx_signature, expectedSol, wallet_address);
      if (!result.valid) return new Response(JSON.stringify({ success: false, error: result.error }), { headers });
      // La compra es de la wallet que PAGO. Antes el telegram_id venia del
      // cliente sin verificar, o se sacaba del perfil cuyo wallet_solana
      // coincidiera (columna que cualquier usuario puede editar): bastaba con
      // copiar de Solscan la firma de un pago ajeno para quedarse la skin.
      const purchaseData = { skin_id, payment_type: 'sol', amount_paid: result.sol, tx_signature, wallet_address };
      const tgUser = telegram_id && body.init_data ? await verifyInitData(body.init_data, context.env.TELEGRAM_BOT_TOKEN) : null;
      purchaseData.telegram_id = (tgUser && String(tgUser.id) === String(telegram_id)) ? String(telegram_id) : 'wallet_' + wallet_address.slice(0, 8);
      await supabaseQuery(env, 'skin_purchases', { method: 'POST', body: purchaseData });
      return new Response(JSON.stringify({ success: true, sol: result.sol }), { headers });
    }

    if (action === 'get_owned_skins') {
      // Las skins de una wallet son las que esa wallet pago. Por telegram_id
      // solo con initData verificado (antes cualquiera veia las de cualquiera).
      const { wallet_address, telegram_id } = body;
      let skins = [];
      const tgUser = telegram_id && body.init_data ? await verifyInitData(body.init_data, context.env.TELEGRAM_BOT_TOKEN) : null;
      if (tgUser && String(tgUser.id) === String(telegram_id)) {
        const data = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${enc(telegram_id)}&select=skin_id`);
        if (Array.isArray(data)) skins = data.map(s => s.skin_id);
      }
      if (wallet_address && SOL_ADDR.test(wallet_address)) {
        const data = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${enc(wallet_address)}&select=skin_id`);
        if (Array.isArray(data)) data.forEach(s => { if (!skins.includes(s.skin_id)) skins.push(s.skin_id); });
      }
      return new Response(JSON.stringify({ skins }), { headers });
    }

    if (action === 'check_nfts') {
      // Sin validar, la direccion iba cruda en la ruta de api.helius.xyz junto
      // a nuestra api-key: servia para llamar a otras rutas con nuestra cuota.
      if (!SOL_ADDR.test(String(body.wallet_address || ''))) return new Response(JSON.stringify({ error: 'Bad wallet' }), { headers, status: 400 });
      const nfts = await getNFTs(env.HELIUS_API_KEY, body.wallet_address);
      return new Response(JSON.stringify({ nfts: nfts.length, items: nfts.slice(0, 20) }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { headers, status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { headers, status: 500 });
  }
}

async function onRequestOptions() {
  return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export default { onRequestPost, onRequestOptions };
