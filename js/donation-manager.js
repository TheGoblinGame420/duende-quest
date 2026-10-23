'use strict';
// Cantidades en formato español ("10.000"), igual que el resto de la página.
function fmtDuende(n) {
  try { return Number(n).toLocaleString('es', { useGrouping: 'always' }); }
  catch (_) { return Number(n).toLocaleString('es'); }
}
const DonationManager = {
  DEV_WALLET: 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J',
  SOL_TO_DUENDE_RATE: 10000,
  MIN_SOL: 0.1,

  calculateReward(solAmount) {
    return Math.floor(solAmount * this.SOL_TO_DUENDE_RATE);
  },

  async sendDonation(solAmount) {
    if (!WalletManager.walletAddress || !WalletManager.provider) {
      if (typeof showNotification === 'function') showNotification('Conecta tu wallet primero: pulsa «Conectar wallet» en el paso 1 de esta tarjeta.', 'error');
      return { success: false, reason: 'no_wallet' };
    }
    if (solAmount < this.MIN_SOL) {
      if (typeof showNotification === 'function') showNotification('Mínimo ' + this.MIN_SOL + ' SOL', 'warning');
      return { success: false, reason: 'min' };
    }
    // La wallet del proyecto no puede enviarse SOL a si misma (pasaba al
    // probar la pagina con la wallet de desarrollo conectada).
    if (WalletManager.walletAddress === this.DEV_WALLET) {
      if (typeof showNotification === 'function') showNotification('Tienes conectada la wallet del proyecto: conecta otra wallet para enviar SOL.', 'warning');
      return { success: false, reason: 'self' };
    }
    const provider = WalletManager.provider;
    let firma = null;
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;
      const fromPubKey = new PublicKey(WalletManager.walletAddress);
      const toPubKey = new PublicKey(this.DEV_WALLET);
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      // Varios servidores publicos de Solana: si uno rechaza la peticion del
      // navegador (pasa con api.mainnet-beta), se prueba el siguiente.
      let connection = null, blockhash = null, lastValidBlockHeight = 0;
      for (const rpc of ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com']) {
        try {
          const c = new Connection(rpc, 'confirmed');
          ({ blockhash, lastValidBlockHeight } = await c.getLatestBlockhash());
          connection = c; break;
        } catch (e) { console.warn('[Donación] RPC sin respuesta:', rpc, e && e.message); }
      }
      if (!connection) throw new Error('No hay conexión con la red de Solana');
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubKey,
      }).add(
        SystemProgram.transfer({ fromPubkey: fromPubKey, toPubkey: toPubKey, lamports })
      );
      const signed = await provider.signAndSendTransaction(tx);
      firma = typeof signed === 'string' ? signed : signed && signed.signature;
      if (!firma) throw new Error('La wallet no devolvió la firma');
      // Con la firma en la mano el pago YA salio: si la confirmacion tarda o
      // falla la consulta, no se dice "no se pudo enviar" (antes se decia, y
      // la persona podia volver a pagar).
      try { await connection.confirmTransaction({ signature: firma, blockhash, lastValidBlockHeight }); }
      catch (e) { console.warn('[Donación] confirmación lenta:', e && e.message); }
      const signed2 = { signature: firma };
      const duendeEarned = this.calculateReward(solAmount);
      await this.registerDonation({
        wallet: WalletManager.walletAddress,
        sol_amount: solAmount,
        duende_earned: duendeEarned,
        tx_signature: signed2.signature,
      }).catch(() => {});
      return { success: true, signature: signed2.signature, duendeEarned };
    } catch (err) {
      if (err && (err.code === 4001 || /reject|cancel/i.test(err.message || ''))) {
        return { success: false, reason: 'user_rejected' };
      }
      console.error('Donation error:', err);
      if (firma) return { success: true, signature: firma, duendeEarned: this.calculateReward(solAmount) };
      return { success: false, reason: 'error', message: (err && err.message) || '' };
    }
  },

  updateDuendeRate() {
    // NO recalcular SOL_TO_DUENDE_RATE aqui: la formula anterior hacia
    // Math.floor(1/precioDuendeUsd), que es "tokens por $1", no "tokens por
    // SOL" (le faltaba multiplicar por el precio de SOL en USD, que ronda
    // los $70-200, no $1). Con el precio real de $DUENDE el resultado se
    // quedaba en un ~1-2% del valor que la propia pagina promete arriba
    // ("Tasa: 1 SOL = 10.000 $DUENDE"), estafando sin querer a quien donara
    // SOL de verdad. La tasa se queda fija en la que se anuncia.
    const preview = document.getElementById('donation-duende-preview');
    const input = document.getElementById('donation-sol-input');
    if (preview && input) {
      const sol = parseFloat(input.value) || 0;
      if (sol > 0) {
        const duende = this.calculateReward(sol);
        preview.textContent = 'Recibirás ' + fmtDuende(duende) + ' $DUENDE (te los envía el creador a mano)';
      }
    }
  },

  async registerDonation({ wallet, sol_amount, duende_earned, tx_signature }) {
    if (!window.supabaseClient) return;
    // Solo registro: el crédito de $DUENDE lo procesa el servidor/admin tras
    // verificar la TX (nunca acreditar saldo desde el navegador — es falsificable).
    await window.supabaseClient.from('donations').insert({
      wallet_address: wallet,
      sol_amount,
      duende_earned,
      tx_signature,
      created_at: new Date().toISOString(),
    });
  }
};

function initDonationPanel() {
  const panel = document.getElementById('donation-panel');
  if (!panel) return;
  const input = document.getElementById('donation-sol-input');
  const preview = document.getElementById('donation-duende-preview');
  const btnSend = document.getElementById('btn-send-donation');

  if (input && preview) {
    input.addEventListener('input', () => {
      const sol = parseFloat(input.value) || 0;
      const duende = DonationManager.calculateReward(sol);
      preview.textContent = sol > 0
        ? 'Recibirás ' + fmtDuende(duende) + ' $DUENDE (te los envía el creador a mano)'
        : 'Elige un monto para ver cuánto recibes';
    });
  }

  if (btnSend) {
    btnSend.addEventListener('click', async () => {
      const sol = parseFloat(input?.value);
      if (!sol || sol < DonationManager.MIN_SOL) {
        if (typeof showNotification === 'function') showNotification('Mínimo ' + DonationManager.MIN_SOL + ' SOL', 'warning');
        return;
      }
      btnSend.disabled = true;
      btnSend.textContent = 'Procesando...';
      const result = await DonationManager.sendDonation(sol);
      if (result.success) {
        if (typeof showNotification === 'function') showNotification('¡Gracias por tu apoyo! El creador te enviará ' + fmtDuende(result.duendeEarned) + ' $DUENDE a tu wallet. Guarda el enlace de la transacción.', 'success');
        showTxLink(result.signature);
        input.value = '';
        preview.textContent = 'Elige un monto para ver cuánto recibes';
      } else if (result.reason === 'no_wallet' || result.reason === 'min' || result.reason === 'self') {
        // ya se avisó dentro de sendDonation
      } else if (result.reason === 'user_rejected') {
        if (typeof showNotification === 'function') showNotification('Transacción cancelada', 'warning');
      } else {
        const m = result.message || '';
        const porque = /insufficient|lamports|0x1/i.test(m) ? ' No tienes SOL suficiente (cuenta también la comisión de la red).' : /conexi|network|fetch|403|429/i.test(m) ? ' La red de Solana no respondió: espera un minuto.' : '';
        if (typeof showNotification === 'function') showNotification('No se pudo enviar la transacción.' + porque + ' No se cobró nada.', 'error');
      }
      btnSend.disabled = false;
      btnSend.textContent = 'Enviar SOL y recibir $DUENDE';
    });
  }
}

function showTxLink(signature) {
  const container = document.getElementById('tx-link-container');
  if (!container) return;
  const a = document.createElement('a');
  a.href = 'https://solscan.io/tx/' + encodeURIComponent(signature);
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Ver tu transacción en Solscan';
  container.innerHTML = '';
  container.appendChild(a);
}

document.addEventListener('DOMContentLoaded', initDonationPanel);
