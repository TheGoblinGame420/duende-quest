'use strict';
const PriceFeed = {
  price: 0, priceUsd: 0, mcap: 0, volume24h: 0, priceChange24h: 0,
  _timer: null,
  async fetch() {
    try {
      const r = await fetch(window.DUENDE_CFG.DEXSCREENER_URL, {signal: AbortSignal.timeout(4000)});
      const d = await r.json();
      const pair = d?.pairs?.[0];
      if (!pair) return;
      this.priceUsd       = parseFloat(pair.priceUsd) || 0;
      this.mcap           = parseFloat(pair.fdv) || 0;
      this.volume24h      = parseFloat(pair.volume?.h24) || 0;
      this.priceChange24h = parseFloat(pair.priceChange?.h24) || 0;
      this._broadcast();
    } catch(_) {}
  },
  start(intervalMs = 30000) {
    this.fetch();
    this._timer = setInterval(() => this.fetch(), intervalMs);
  },
  _broadcast() {
    document.querySelectorAll('[data-price-usd]').forEach(el => {
      el.textContent = this.priceUsd > 0
        ? '$' + this.priceUsd.toFixed(8)
        : '---';
    });
    document.querySelectorAll('[data-mcap]').forEach(el => {
      el.textContent = this.mcap > 1e6
        ? '$' + (this.mcap/1e6).toFixed(2) + 'M'
        : this.mcap > 1e3 ? '$' + (this.mcap/1e3).toFixed(1) + 'K'
        : '$' + this.mcap.toFixed(0);
    });
    document.querySelectorAll('[data-volume]').forEach(el => {
      el.textContent = '$' + (this.volume24h/1000).toFixed(1) + 'K';
    });
    document.querySelectorAll('[data-change24h]').forEach(el => {
      const pct = this.priceChange24h;
      el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
      el.style.color  = pct >= 0 ? '#00ff88' : '#ff3333';
    });
    if (typeof StakingManager !== 'undefined') StakingManager.updateAPYDisplay();
    if (typeof DonationManager !== 'undefined' && DonationManager.updateDuendeRate) DonationManager.updateDuendeRate();
    document.dispatchEvent(new CustomEvent('priceUpdated', {detail: this}));
  }
};
document.addEventListener('DOMContentLoaded', () => PriceFeed.start());
