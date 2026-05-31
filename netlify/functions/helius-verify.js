// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Helius NFT Verification + TX Verify
// Verifies Solana transactions & NFT ownership via Helius
// ═══════════════════════════════════════════════════════
'use strict';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;
const DEV_WALLET = 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://byspuovhhbmndqskvvjo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

async function supabaseQuery(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return r.json();
}

// Verify a SOL transaction on-chain via Helius
async function verifyTransaction(txSignature, expectedSol, senderWallet) {
  try {
    const r = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [txSignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const data = await r.json();
    const tx = data?.result;
    if (!tx || tx.meta?.err) return { valid: false, error: 'Transaction failed or not found' };

    // Check it's a transfer to our wallet
    const instructions = tx.transaction?.message?.instructions || [];
    const transfers = instructions.filter(i =>
      i.parsed?.type === 'transfer' &&
      i.parsed?.info?.destination === DEV_WALLET
    );

    if (transfers.length === 0) return { valid: false, error: 'No transfer to dev wallet found' };

    const totalLamports = transfers.reduce((sum, t) => sum + (t.parsed?.info?.lamports || 0), 0);
    const totalSol = totalLamports / 1e9;
    const expectedMin = expectedSol * 0.95; // 5% tolerance

    if (totalSol < expectedMin) return { valid: false, error: `Expected ${expectedSol} SOL, got ${totalSol}` };

    // Verify sender
    const signers = tx.transaction?.message?.accountKeys?.filter(k => k.signer) || [];
    const senderMatch = signers.some(s => s.pubkey === senderWallet);
    if (senderWallet && !senderMatch) return { valid: false, error: 'Sender mismatch' };

    return { valid: true, sol: totalSol, sender: signers[0]?.pubkey };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// Get NFTs owned by a wallet (for future NFT collection verification)
async function getNFTs(walletAddress, collectionAddress) {
  try {
    const r = await fetch(`${HELIUS_API}/addresses/${walletAddress}/nfts?api-key=${HELIUS_API_KEY}`);
    const nfts = await r.json();
    if (collectionAddress) {
      return nfts.filter(n =>
        n.collection === collectionAddress ||
        n.grouping?.find(g => g.group_key === 'collection' && g.group_value === collectionAddress)
      );
    }
    return nfts;
  } catch (e) {
    return [];
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const body = JSON.parse(event.body);
    const { action } = body;

    // ── Verify SOL transaction for skin purchase ──
    if (action === 'verify_skin_purchase') {
      const { tx_signature, skin_id, wallet_address, expected_sol, telegram_id } = body;
      if (!tx_signature || !skin_id || !wallet_address) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };
      }

      // Check if already processed
      const existing = await supabaseQuery(
        `skin_purchases?wallet_address=eq.${wallet_address}&skin_id=eq.${skin_id}&select=id`
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, already_owned: true }) };
      }

      // Verify on-chain
      const result = await verifyTransaction(tx_signature, expected_sol, wallet_address);
      if (!result.valid) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: result.error }) };
      }

      // Record purchase
      const purchaseData = {
        skin_id,
        payment_type: 'sol',
        amount_paid: result.sol,
        tx_signature,
      };

      // Try to link with telegram_id or wallet
      if (telegram_id) {
        purchaseData.telegram_id = telegram_id;
      } else {
        // Find profile by wallet
        const profiles = await supabaseQuery(
          `profiles?or=(wallet_address.eq.${wallet_address},wallet_solana.eq.${wallet_address})&select=telegram_id`
        );
        if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].telegram_id) {
          purchaseData.telegram_id = profiles[0].telegram_id;
        } else {
          purchaseData.telegram_id = 'wallet_' + wallet_address.slice(0, 8);
        }
      }

      await supabaseQuery('skin_purchases', { method: 'POST', body: purchaseData });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, sol: result.sol }) };
    }

    // ── Check owned skins by wallet ──
    if (action === 'get_owned_skins') {
      const { wallet_address, telegram_id } = body;
      let skins = [];

      if (telegram_id) {
        const data = await supabaseQuery(`skin_purchases?telegram_id=eq.${telegram_id}&select=skin_id`);
        if (Array.isArray(data)) skins = data.map(s => s.skin_id);
      }

      if (wallet_address) {
        // Also check by wallet via profile link
        const profiles = await supabaseQuery(
          `profiles?or=(wallet_address.eq.${wallet_address},wallet_solana.eq.${wallet_address})&select=telegram_id`
        );
        if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].telegram_id) {
          const data = await supabaseQuery(`skin_purchases?telegram_id=eq.${profiles[0].telegram_id}&select=skin_id`);
          if (Array.isArray(data)) {
            data.forEach(s => { if (!skins.includes(s.skin_id)) skins.push(s.skin_id); });
          }
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ skins }) };
    }

    // ── Check NFTs (for future collection) ──
    if (action === 'check_nfts') {
      const { wallet_address, collection } = body;
      const nfts = await getNFTs(wallet_address, collection);
      return { statusCode: 200, headers, body: JSON.stringify({ nfts: nfts.length, items: nfts.slice(0, 20) }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('[Helius Error]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};
