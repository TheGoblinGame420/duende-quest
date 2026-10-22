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
    const provider = WalletManager.provider;
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const fromPubKey = new PublicKey(WalletManager.walletAddress);
      const toPubKey = new PublicKey(this.DEV_WALLET);
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubKey,
      }).add(
        SystemProgram.transfer({ fromPubkey: fromPubKey, toPubkey: toPubKey, lamports })
      );
      const signed = await provider.signAndSendTransaction(tx);
      await connection.confirmTransaction({
        signature: signed.signature,
        blockhash,
        lastValidBlockHeight,
      });
      const duendeEarned = this.calculateReward(solAmount);
      await this.registerDonation({
        wallet: WalletManager.walletAddress,
        sol_amount: solAmount,
        duende_earned: duendeEarned,
        tx_signature: signed.signature,
      });
      return { success: true, signature: signed.signature, duendeEarned };
    } catch (err) {
      if (err.code === 4001) {
        return { success: false, reason: 'user_rejected' };
      }
      console.error('Donation error:', err);
      return { success: false, reason: 'error', message: err.message };
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
      } else if (result.reason === 'no_wallet' || result.reason === 'min') {
        // ya se avisó dentro de sendDonation
      } else if (result.reason === 'user_rejected') {
        if (typeof showNotification === 'function') showNotification('Transacción cancelada', 'warning');
      } else {
        if (typeof showNotification === 'function') showNotification('No se pudo enviar la transacción. Intenta de nuevo.', 'error');
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
