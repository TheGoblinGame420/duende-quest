'use strict';
// Formato de números en español ("10.000"); 'always' para que 1.997 tampoco
// salga como "1997" (el español solo agrupa desde 5 cifras por defecto).
function fmtEs(n) {
  try { return Number(n).toLocaleString('es', { useGrouping: 'always' }); }
  catch (_) { return Number(n).toLocaleString('es'); }
}
// /api/token-stats devuelve mcap = precio * 1e9; si pump.fun y DexScreener
// fallan, el precio cae al suelo 0.0000001 → mcap = 100. Eso no es un dato
// real: por debajo de este umbral se trata como "sin dato".
const MCAP_MINIMO_REAL = 100;

const PriceFeed = {
  price: 0, priceUsd: 0, mcap: 0, volume24h: 0, priceChange24h: 0,
  hasPair: null,   // null = aún no se sabe; false = DexScreener sin par
  _timer: null,
  async fetch() {
    try {
      const r = await fetch(window.DUENDE_CFG.DEXSCREENER_URL, {signal: AbortSignal.timeout(4000)});
      const d = await r.json();
      const pair = d?.pairs?.[0];
      if (!pair) { this.hasPair = false; this._applyPairUI(); return; }
      this.hasPair = true;
      this.priceUsd       = parseFloat(pair.priceUsd) || 0;
      this.mcap           = parseFloat(pair.fdv) || 0;
      this.volume24h      = parseFloat(pair.volume?.h24) || 0;
      this.priceChange24h = parseFloat(pair.priceChange?.h24) || 0;
      this._applyPairUI();
      this._broadcast();
    } catch(_) {}
  },
  holders: null,
  async fetchHolders() {
    try {
      const r = await fetch('/api/token-stats', { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (typeof d.holders === 'number' && d.holders >= 0) this.holders = d.holders;
      // Sin par en DEX, el market cap sale de la curva de pump.fun (vía la API).
      if (!this.hasPair && typeof d.mcap === 'number' && d.mcap > MCAP_MINIMO_REAL) this.mcap = d.mcap;
      this._broadcast();
    } catch (_) {}
  },
  start(intervalMs = 30000) {
    this.fetch();
    this.fetchHolders();
    this._timer = setInterval(() => this.fetch(), intervalMs);
    setInterval(() => this.fetchHolders(), 300000); // holders cada 5 min
  },
  // Muestra el bloque de DexScreener (precio, volumen, gráfico) solo si hay par;
  // si no, deja el aviso "Aún sin par en DEX" con el enlace a pump.fun.
  _applyPairUI() {
    const hay = this.hasPair === true;
    document.querySelectorAll('[data-solo-dex]').forEach(el => { el.hidden = !hay; });
    const aviso = document.getElementById('dex-sin-par');
    if (aviso) aviso.hidden = hay;
    const chart = document.getElementById('dex-chart');
    if (hay && chart && !chart.getAttribute('src') && chart.dataset.src) chart.setAttribute('src', chart.dataset.src);
  },
  _fmtMcap(m) {
    return m > 1e6 ? '$' + (m/1e6).toFixed(2).replace('.', ',') + ' M'
      : m > 1e3 ? '$' + (m/1e3).toFixed(1).replace('.', ',') + ' K'
      : '$' + m.toFixed(0);
  },
  _broadcast() {
    document.querySelectorAll('[data-price-usd]').forEach(el => {
      el.textContent = this.priceUsd > 0
        ? '$' + this.priceUsd.toFixed(8)
        : '---';
    });
    const hayMcap = this.mcap > MCAP_MINIMO_REAL;
    document.querySelectorAll('[data-solo-mcap]').forEach(el => { el.hidden = !hayMcap; });
    document.querySelectorAll('[data-mcap]').forEach(el => {
      el.textContent = hayMcap ? this._fmtMcap(this.mcap) : '—';
    });
    document.querySelectorAll('[data-volume]').forEach(el => {
      el.textContent = '$' + (this.volume24h/1000).toFixed(1).replace('.', ',') + ' K';
    });
    document.querySelectorAll('[data-change24h]').forEach(el => {
      const pct = this.priceChange24h;
      el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
      el.style.color  = pct >= 0 ? 'var(--ok)' : 'var(--err)';
    });
    if (this.holders !== null) {
      document.querySelectorAll('[data-holders]').forEach(el => { el.textContent = fmtEs(this.holders); });
    }
    if (typeof StakingManager !== 'undefined') StakingManager.updateAPYDisplay();
    if (typeof DonationManager !== 'undefined' && DonationManager.updateDuendeRate) DonationManager.updateDuendeRate();
    document.dispatchEvent(new CustomEvent('priceUpdated', {detail: this}));
  }
};
document.addEventListener('DOMContentLoaded', () => PriceFeed.start());
