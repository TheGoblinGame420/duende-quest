'use strict';
const DonationManager = {
  DEV_WALLET: 'B6pLnZFkot8JgAKZs5nq8V4B1LSdz7mdhNnUa85fbp4J',
  SOL_TO_DUENDE_RATE: 10000,
  MIN_SOL: 0.1,

  calculateReward(solAmount) {
    return Math.floor(solAmount * this.SOL_TO_DUENDE_RATE);
  },

  async sendDonation(solAmount) {
    if (!WalletManager.walletAddress || !WalletManager.provider) {
      if (typeof showNotification === 'function') showNotification('Conecta tu wallet primero', 'error');
      return { success: false };
    }
    if (solAmount < this.MIN_SOL) {
      if (typeof showNotification === 'function') showNotification('Minimo ' + this.MIN_SOL + ' SOL', 'warning');
      return { success: false };
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
    const p = typeof PriceFeed !== 'undefined' ? PriceFeed.priceUsd : 0;
    if (p > 0) {
      this.SOL_TO_DUENDE_RATE = Math.floor(1 / p);
    }
    const preview = document.getElementById('donation-duende-preview');
    const input = document.getElementById('donation-sol-input');
    if (preview && input) {
      const sol = parseFloat(input.value) || 0;
      if (sol > 0) {
        const duende = this.calculateReward(sol);
        preview.textContent = 'Recibiras: ' + duende.toLocaleString() + ' $DUENDE';
      }
    }
  },

  async registerDonation({ wallet, sol_amount, duende_earned, tx_signature }) {
    if (!window.supabaseClient) return;
    await window.supabaseClient.from('donations').insert({
      wallet_address: wallet,
      sol_amount,
      duende_earned,
      tx_signature,
      created_at: new Date().toISOString(),
    });
    await window.supabaseClient.rpc('add_duende_balance', {
      p_wallet: wallet,
      p_amount: duende_earned,
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
        ? 'Recibiras: ' + duende.toLocaleString() + ' $DUENDE'
        : 'Ingresa cantidad en SOL';
    });
  }

  if (btnSend) {
    btnSend.addEventListener('click', async () => {
      const sol = parseFloat(input?.value);
      if (!sol || sol < DonationManager.MIN_SOL) {
        if (typeof showNotification === 'function') showNotification('Minimo ' + DonationManager.MIN_SOL + ' SOL', 'warning');
        return;
      }
      btnSend.disabled = true;
      btnSend.textContent = 'Procesando...';
      const result = await DonationManager.sendDonation(sol);
      if (result.success) {
        if (typeof showNotification === 'function') showNotification('Listo! Recibiras ' + result.duendeEarned.toLocaleString() + ' $DUENDE', 'success');
        showTxLink(result.signature);
        input.value = '';
        preview.textContent = 'Ingresa cantidad en SOL';
      } else if (result.reason === 'user_rejected') {
        if (typeof showNotification === 'function') showNotification('Transaccion cancelada', 'warning');
      } else {
        if (typeof showNotification === 'function') showNotification('Error en la transaccion. Intenta de nuevo.', 'error');
      }
      btnSend.disabled = false;
      btnSend.textContent = 'ENVIAR SOL Y RECIBIR $DUENDE';
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
  a.textContent = 'Ver transaccion en Solscan →';
  container.innerHTML = '';
  container.appendChild(a);
}

document.addEventListener('DOMContentLoaded', initDonationPanel);
