// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Verificación de pagos SOL (Cloudflare Worker)
// ═══════════════════════════════════════════════════════
// SEGURIDAD (reescrito 2026-09-28): antes, verify_skin_purchase confiaba en
// que el CLIENTE dijera qué wallet había pagado (`wallet_address`) y sólo
// comprobaba que esa firma+wallet+monto existieran en la cadena. La cadena es
// PÚBLICA: cualquiera podía ver el pago real de otra persona en Solscan y
// llamar a este endpoint con esos mismos datos, reclamando la skin para sí
// mismo antes de que el pagador real terminara su propia llamada.
//
// Ahora se usa el patrón "reference" de Solana Pay: el servidor genera una
// clave pública AL AZAR (sin par privado — no hace falta, es solo un
// identificador) antes del pago; el cliente la mete como cuenta adicional,
// de solo lectura, en la misma transacción de transferencia; el servidor NO
// confía en nada que diga el cliente sobre el pago — busca en la cadena, por
// esa referencia, la transacción que la contiene, y lee de ahí el monto y el
// remitente real. Nadie puede "robar" un pago ajeno porque la referencia de
// CADA compra es impredecible y solo la genera el propio comprador al
// empezar su compra.

import { verifySupabaseUser, verifyInitData, getSolPriceUsd, SOL_DEV_WALLET } from './lib.js';

const DEV_WALLET = SOL_DEV_WALLET;
// Direccion Solana en base58 (32-44 caracteres, sin 0 O I l).
const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ORDEN_VIGENCIA_MS = 30 * 60 * 1000; // 30 minutos para pagar

function getEnv(context) {
  return {
    HELIUS_API_KEY: context.env.HELIUS_API_KEY,
    TELEGRAM_BOT_TOKEN: context.env.TELEGRAM_BOT_TOKEN,
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

// ── Base58 (alfabeto de Bitcoin/Solana) — solo para fabricar la referencia.
// No hace falta ninguna libreria: una clave publica de Solana es, para este
// uso, simplemente 32 bytes al azar codificados en base58. No necesita un
// par de firma valido: nunca se usa para firmar, solo se lee de la cadena.
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function toBase58(bytes) {
  let digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (let k = 0; k < bytes.length && bytes[k] === 0; k++) out += '1';
  for (let k = digits.length - 1; k >= 0; k--) out += B58_ALPHABET[digits[k]];
  return out;
}
function nuevaReferencia() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase58(bytes);
}

// Busca en la cadena, POR REFERENCIA (nunca por lo que diga el cliente), la
// transaccion que pago una orden. Devuelve {sol, wallet_address, tx_signature}
// o null. La referencia se mete en la transaccion como cuenta de solo
// lectura (ver game.html: tx.keys.push({pubkey:reference,...})), asi que
// aparece en accountKeys de cualquier transaccion que la incluya.
async function buscarPagoPorReferencia(heliusKey, reference, expectedLamports) {
  try {
    const rpc = async (method, params) => {
      const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      return (await r.json())?.result;
    };
    const firmas = await rpc('getSignaturesForAddress', [reference, { limit: 5 }]);
    if (!Array.isArray(firmas) || firmas.length === 0) return null;
    for (const f of firmas) {
      if (f.err) continue;
      const tx = await rpc('getTransaction', [f.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
      if (!tx || tx.meta?.err) continue;
      const instructions = tx.transaction?.message?.instructions || [];
      const transfer = instructions.find(i => i.parsed?.type === 'transfer' && i.parsed?.info?.destination === DEV_WALLET);
      if (!transfer) continue;
      const lamports = transfer.parsed.info.lamports || 0;
      if (lamports < expectedLamports * 0.97) continue; // 3% de margen por volatilidad del precio
      return { sol: lamports / 1e9, wallet_address: transfer.parsed.info.source, tx_signature: f.signature };
    }
    return null;
  } catch (e) { return null; }
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
  const j = (body, status = 200) => new Response(JSON.stringify(body), { headers, status });

  try {
    const body = await context.request.json();
    const { action } = body;

    // ── PASO 1: crear la orden, ANTES de pagar. Devuelve la referencia que
    // el cliente mete en su transaccion. ──
    if (action === 'create_sol_order') {
      const skinId = String(body.skin_id || '');
      const usd = SKIN_PRICES_USD[skinId];
      if (!usd) return j({ error: 'unknown_skin' }, 400);
      const solUsd = await getSolPriceUsd();
      if (!solUsd) return j({ error: 'price_unavailable', detail: 'Precio de SOL no disponible, reintenta en un minuto' }, 503);
      const expectedLamports = Math.floor((usd / solUsd) * 1e9);
      const reference = nuevaReferencia();
      await supabaseQuery(env, 'sol_orders', {
        method: 'POST',
        body: { reference, kind: 'skin', skin_id: skinId, expected_lamports: expectedLamports, status: 'pending' },
      });
      return j({ success: true, reference, dev_wallet: DEV_WALLET, lamports: expectedLamports, sol: expectedLamports / 1e9 });
    }

    // ── PASO 2: confirmar el pago DESPUES de enviarlo. Solo se pide la
    // referencia; todo lo demas (monto, remitente) se lee de la cadena. ──
    if (action === 'verify_skin_purchase') {
      const reference = String(body.reference || '');
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(reference)) return j({ error: 'bad_reference' }, 400);

      const ordenes = await supabaseQuery(env, `sol_orders?reference=eq.${enc(reference)}&select=*&limit=1`);
      const orden = Array.isArray(ordenes) ? ordenes[0] : null;
      if (!orden) return j({ error: 'order_not_found' }, 404);
      if (orden.status === 'filled') {
        // Idempotente: si ya se proceso, devolver el resultado guardado en vez de error.
        return j({ success: true, sol: (orden.expected_lamports || 0) / 1e9, already_owned: true });
      }
      if (Date.now() - Date.parse(orden.created_at) > ORDEN_VIGENCIA_MS) return j({ error: 'order_expired', detail: 'La orden expiró, vuelve a intentar la compra' }, 410);

      const pago = await buscarPagoPorReferencia(env.HELIUS_API_KEY, reference, orden.expected_lamports);
      if (!pago) return j({ success: false, error: 'payment_not_found', detail: 'No se encontró el pago todavía. Espera unos segundos y reintenta.' }, 402);

      // tx_signature es UNIQUE en skin_purchases: cierra la carrera si dos
      // peticiones llegan a la vez para la misma orden.
      const marcada = await supabaseQuery(env, `sol_orders?reference=eq.${enc(reference)}&status=eq.pending`, {
        method: 'PATCH', body: { status: 'filled', wallet_address: pago.wallet_address, tx_signature: pago.tx_signature, filled_at: new Date().toISOString() },
      });
      if (!Array.isArray(marcada) || marcada.length !== 1) return j({ success: true, already_owned: true }); // otra peticion ya la proceso

      const yaLaTenia = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${enc(pago.wallet_address)}&skin_id=eq.${enc(orden.skin_id)}&select=id`);
      if (Array.isArray(yaLaTenia) && yaLaTenia.length > 0) return j({ success: true, already_owned: true, wallet_address: pago.wallet_address });

      const purchaseData = { skin_id: orden.skin_id, payment_type: 'sol', amount_paid: pago.sol, tx_signature: pago.tx_signature, wallet_address: pago.wallet_address };
      const telegram_id = body.telegram_id;
      const tgUser = telegram_id && body.init_data ? await verifyInitData(body.init_data, env.TELEGRAM_BOT_TOKEN) : null;
      purchaseData.telegram_id = (tgUser && String(tgUser.id) === String(telegram_id)) ? String(telegram_id) : 'wallet_' + pago.wallet_address.slice(0, 8);
      await supabaseQuery(env, 'skin_purchases', { method: 'POST', body: purchaseData });
      return j({ success: true, sol: pago.sol, wallet_address: pago.wallet_address });
    }

    if (action === 'get_owned_skins') {
      // Las skins de una wallet son las que esa wallet pago. Por telegram_id
      // solo con initData verificado (antes cualquiera veia las de cualquiera).
      // Por cuenta web, con el access_token de su propia sesion de Supabase.
      const { wallet_address, telegram_id, access_token } = body;
      let skins = [];
      const tgUser = telegram_id && body.init_data ? await verifyInitData(body.init_data, env.TELEGRAM_BOT_TOKEN) : null;
      if (tgUser && String(tgUser.id) === String(telegram_id)) {
        const data = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${enc(telegram_id)}&select=skin_id`);
        if (Array.isArray(data)) skins = data.map(s => s.skin_id);
      }
      if (access_token) {
        const webUser = await verifySupabaseUser(env, access_token);
        if (webUser) {
          const prof = await supabaseQuery(env, `profiles?id=eq.${enc(webUser.id)}&select=wallet_solana&limit=1`);
          const w = prof?.[0]?.wallet_solana;
          if (w && SOL_ADDR.test(w)) {
            const data = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${enc(w)}&select=skin_id`);
            if (Array.isArray(data)) data.forEach(s => { if (!skins.includes(s.skin_id)) skins.push(s.skin_id); });
          }
        }
      }
      if (wallet_address && SOL_ADDR.test(wallet_address)) {
        const data = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${enc(wallet_address)}&select=skin_id`);
        if (Array.isArray(data)) data.forEach(s => { if (!skins.includes(s.skin_id)) skins.push(s.skin_id); });
      }
      return j({ skins });
    }

    if (action === 'check_nfts') {
      // Sin validar, la direccion iba cruda en la ruta de api.helius.xyz junto
      // a nuestra api-key: servia para llamar a otras rutas con nuestra cuota.
      if (!SOL_ADDR.test(String(body.wallet_address || ''))) return j({ error: 'Bad wallet' }, 400);
      const nfts = await getNFTs(env.HELIUS_API_KEY, body.wallet_address);
      return j({ nfts: nfts.length, items: nfts.slice(0, 20) });
    }

    return j({ error: 'Unknown action' }, 400);
  } catch (err) {
    return j({ error: 'Server error' }, 500);
  }
}

async function onRequestOptions() {
  return new Response('', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export default { onRequestPost, onRequestOptions };
