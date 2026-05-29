'use strict';
const WalletManager = {
  walletAddress: null,
  provider: null,

  getProvider() {
    if ('phantom' in window) {
      const provider = window.phantom?.solana;
      if (provider?.isPhantom) return provider;
    }
    if ('solana' in window && window.solana?.isPhantom) {
      return window.solana;
    }
    return null;
  },

  async connect() {
    const provider = this.getProvider();
    if (!provider) {
      window.open('https://phantom.app/', '_blank');
      return { success: false, reason: 'not_installed' };
    }
    try {
      const resp = await provider.connect();
      this.walletAddress = resp.publicKey.toString();
      this.provider = provider;
      localStorage.setItem('duende_wallet', this.walletAddress);
      await this.syncWithSupabase();
      return { success: true, address: this.walletAddress };
    } catch (err) {
      if (err.code === 4001) {
        return { success: false, reason: 'user_rejected' };
      }
      console.error('Wallet connect error:', err);
      return { success: false, reason: 'error', message: err.message };
    }
  },

  async disconnect() {
    if (this.provider) {
      await this.provider.disconnect();
    }
    this.walletAddress = null;
    this.provider = null;
    localStorage.removeItem('duende_wallet');
    updateWalletUI(null);
  },

  async autoConnect() {
    const provider = this.getProvider();
    const saved = localStorage.getItem('duende_wallet');
    if (!provider || !saved) return;
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      this.walletAddress = resp.publicKey.toString();
      this.provider = provider;
      updateWalletUI(this.walletAddress);
    } catch (_) {}
  },

  async syncWithSupabase() {
    if (!this.walletAddress || !window.supabaseClient) return;
    try {
      await window.supabaseClient
        .from('players')
        .upsert({ wallet_address: this.walletAddress }, { onConflict: 'wallet_address' });
    } catch (e) {
      console.warn('Supabase wallet sync failed:', e);
    }
  },

  setupListeners() {
    const provider = this.getProvider();
    if (!provider) return;
    provider.on('connect', (publicKey) => {
      this.walletAddress = publicKey.toString();
      updateWalletUI(this.walletAddress);
    });
    provider.on('disconnect', () => {
      this.walletAddress = null;
      updateWalletUI(null);
    });
    provider.on('accountChanged', (publicKey) => {
      if (publicKey) {
        this.walletAddress = publicKey.toString();
        updateWalletUI(this.walletAddress);
      } else {
        this.disconnect();
      }
    });
  }
};

function updateWalletUI(address) {
  const btn = document.getElementById('wallet-connect-btn');
  const display = document.getElementById('wallet-address-display');
  if (!btn) return;
  if (address) {
    const short = address.slice(0, 4) + '...' + address.slice(-4);
    btn.textContent = '✅ ' + short;
    btn.classList.add('connected');
    if (display) display.textContent = address;
  } else {
    btn.textContent = '🔗 Conectar Wallet';
    btn.classList.remove('connected');
    if (display) display.textContent = '';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  WalletManager.setupListeners();
  await WalletManager.autoConnect();
  const btn = document.getElementById('wallet-connect-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (WalletManager.walletAddress) {
        await WalletManager.disconnect();
      } else {
        const result = await WalletManager.connect();
        if (result.success) updateWalletUI(result.address);
        if (result.reason === 'user_rejected') {
          if (typeof showNotification === 'function') showNotification('Conexion cancelada', 'warning');
        }
      }
    });
  }
});
