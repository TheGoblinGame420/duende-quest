// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Logros / hitos (módulo compartido)
// Se desbloquean una vez por jugador (localStorage) y dan bonus DQ.
// Usado por game.html y telegram/index.html vía el motor.
// ═══════════════════════════════════════════════════════
(function (global) {
  'use strict';

  const LIST = [
    { id: 'first_blood', desc: 'Primer enemigo derrotado', reward: 10 },
    { id: 'wave5',  desc: 'Llega a la WAVE 5',     reward: 25 },
    { id: 'wave10', desc: 'Llega a la WAVE 10',    reward: 60 },
    { id: 'wave20', desc: 'Llega a la WAVE 20',    reward: 150 },
    { id: 'boss1',  desc: 'Derrota tu primer BOSS', reward: 50 },
    { id: 'kills100', desc: '100 enemigos en total', reward: 40 },
    { id: 'kills1000', desc: '1,000 enemigos en total', reward: 200 },
    { id: 'combo10', desc: 'Combo x5 alcanzado',   reward: 30 },
    { id: 'rich', desc: 'Junta 100 monedas en una partida', reward: 35 },
  ];
  const META = LIST.reduce((m, a) => (m[a.id] = a, m), {});

  const DQAch = {
    onReward: null,  // function(ach) — acreditar ach.reward
    notify: null,    // function(msg)
    _done: null,
    _killsTotal: 0,

    _load() {
      if (this._done) return;
      try { this._done = JSON.parse(localStorage.getItem('dq_ach') || '{}'); } catch (e) { this._done = {}; }
      this._killsTotal = +localStorage.getItem('dq_kills_total') || 0;
    },
    unlock(id) {
      this._load();
      if (this._done[id]) return;
      const a = META[id]; if (!a) return;
      this._done[id] = 1;
      localStorage.setItem('dq_ach', JSON.stringify(this._done));
      if (typeof this.onReward === 'function') this.onReward(a);
      if (typeof this.notify === 'function') this.notify('🏅 LOGRO: ' + a.desc + ' (+' + a.reward + ' DQ)');
    },
    // eventos que llama el motor
    onKill() {
      this._load();
      this.unlock('first_blood');
      this._killsTotal++;
      localStorage.setItem('dq_kills_total', this._killsTotal);
      if (this._killsTotal >= 100) this.unlock('kills100');
      if (this._killsTotal >= 1000) this.unlock('kills1000');
    },
    onBoss() { this.unlock('boss1'); },
    onWave(w) { if (w >= 5) this.unlock('wave5'); if (w >= 10) this.unlock('wave10'); if (w >= 20) this.unlock('wave20'); },
    onCombo(mult) { if (mult >= 5) this.unlock('combo10'); },
    onSessionCoins(c) { if (c >= 100) this.unlock('rich'); },
    list() { this._load(); return LIST.map(a => ({ ...a, done: !!this._done[a.id] })); },
  };

  global.DQAch = DQAch;
})(window);
