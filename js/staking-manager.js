'use strict';
const StakingManager = {
  LOCK_OPTIONS: [
    { days: 7,  label: '7 días',  multiplier: 1.0, badge: 'FLEXIBLE' },
    { days: 30, label: '30 días', multiplier: 1.5, badge: 'POPULAR' },
    { days: 90, label: '90 días', multiplier: 2.5, badge: '🔥 MÁXIMO' },
  ],
  getAPY() {
    const p = PriceFeed?.priceUsd || 0;
    if (p <= 0) return 120;
    return Math.min(240, Math.max(50, Math.floor(1000 / p)));
  },
  calcReward(solAmount, lockDays) {
    const option = this.LOCK_OPTIONS.find(o => o.days === lockDays);
    const mult   = option?.multiplier || 1;
    const apy    = this.getAPY();
    const baseRate = window.DUENDE_CFG.SOL_PER_DUENDE;
    return Math.floor(solAmount * baseRate * (apy / 100) * (lockDays / 365) * mult);
  },
  updateAPYDisplay() {
    const apy = this.getAPY();
    document.querySelectorAll('[data-staking-apy]').forEach(el => {
      el.textContent = apy + '%';
    });
    const inp = document.getElementById('stake-sol-input');
    if (inp && parseFloat(inp.value) > 0) this._updatePreview();
  },
  _updatePreview() {
    const sol     = parseFloat(document.getElementById('stake-sol-input')?.value) || 0;
    const days    = parseInt(document.querySelector('.stake-lock-btn.active')?.dataset.days || '30');
    const reward  = sol >= window.DUENDE_CFG.MIN_STAKING ? this.calcReward(sol, days) : 0;
    const preview = document.getElementById('stake-reward-preview');
    const unlockD = document.getElementById('stake-unlock-date');
    if (preview) preview.textContent = reward > 0 ? reward.toLocaleString() + ' $DUENDE' : '---';
    if (unlockD && sol > 0) {
      const d = new Date(); d.setDate(d.getDate() + days);
      unlockD.textContent = d.toLocaleDateString('es');
    }
  },
  async stake(solAmount, lockDays) {
    if (!WalletManager.walletAddress || !WalletManager.provider) {
      if (typeof showNotification === 'function') showNotification('Conecta tu wallet primero', 'error');
      return {success:false};
    }
    if (solAmount < window.DUENDE_CFG.MIN_STAKING) {
      if (typeof showNotification === 'function') showNotification('Mínimo ' + window.DUENDE_CFG.MIN_STAKING + ' SOL para stakear', 'warning');
      return {success:false};
    }
    const {Connection,PublicKey,Transaction,SystemProgram,LAMPORTS_PER_SOL} = solanaWeb3;
    try {
      const conn = new Connection('https://api.mainnet-beta.solana.com','confirmed');
      const from = new PublicKey(WalletManager.walletAddress);
      const to   = new PublicKey(window.DUENDE_CFG.DEV_WALLET);
      const {blockhash, lastValidBlockHeight} = await conn.getLatestBlockhash();
      const tx = new Transaction({recentBlockhash:blockhash,feePayer:from})
        .add(SystemProgram.transfer({fromPubkey:from, toPubkey:to, lamports:Math.floor(solAmount*LAMPORTS_PER_SOL)}));
      const {signature} = await WalletManager.provider.signAndSendTransaction(tx);
      await conn.confirmTransaction({signature,blockhash,lastValidBlockHeight});
      const apy      = this.getAPY();
      const expected = this.calcReward(solAmount, lockDays);
      const unlocksAt = new Date(); unlocksAt.setDate(unlocksAt.getDate() + lockDays);
      if (window.supabaseClient) {
        await window.supabaseClient.from('stakes').insert({
          wallet_address:  WalletManager.walletAddress,
          sol_amount:      solAmount,
          lock_days:       lockDays,
          apy_at_stake:    apy,
          duende_expected: expected,
          tx_signature:    signature,
          unlocks_at:      unlocksAt.toISOString(),
        });
      }
      return {success:true, signature, expected};
    } catch(err) {
      if (err.code===4001) return {success:false,reason:'user_rejected'};
      console.error('[Staking]',err);
      return {success:false,reason:'error'};
    }
  },
  async loadMyStakes() {
    if (!WalletManager.walletAddress || !window.supabaseClient) return [];
    const {data} = await window.supabaseClient.from('stakes')
      .select('*').eq('wallet_address', WalletManager.walletAddress).order('staked_at',{ascending:false});
    return data || [];
  }
};
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.stake-lock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stake-lock-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      StakingManager._updatePreview();
    });
  });
  document.getElementById('stake-sol-input')?.addEventListener('input', () => StakingManager._updatePreview());
  document.getElementById('btn-stake')?.addEventListener('click', async () => {
    const sol  = parseFloat(document.getElementById('stake-sol-input')?.value);
    const days = parseInt(document.querySelector('.stake-lock-btn.active')?.dataset.days || '30');
    const btn  = document.getElementById('btn-stake');
    btn.disabled = true; btn.textContent = 'Procesando...';
    const res = await StakingManager.stake(sol, days);
    if (res.success) {
      if (typeof showNotification === 'function') showNotification('🔒 Stakeado! Ganarás ' + res.expected.toLocaleString() + ' $DUENDE', 'success');
    } else if (res.reason === 'user_rejected') {
      if (typeof showNotification === 'function') showNotification('Transacción cancelada', 'warning');
    } else if (res.reason === 'error') {
      if (typeof showNotification === 'function') showNotification('Error al stakear. Intenta de nuevo.', 'error');
    }
    btn.disabled = false; btn.textContent = '🔒 STAKEAR AHORA';
  });
});
