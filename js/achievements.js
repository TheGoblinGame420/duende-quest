// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Logros / hitos (módulo compartido)
// Se desbloquean una vez por jugador (localStorage) y dan bonus DQ.
// Usado por game.html y telegram/index.html vía el motor.
// ═══════════════════════════════════════════════════════
(function (global) {
  'use strict';

  const LIST = [
    { id: 'first_blood', icon: '⚔️', desc: 'Primer enemigo derrotado', reward: 10 },
    { id: 'wave5',  icon: '🌊', desc: 'Llega a la WAVE 5',     reward: 25 },
    { id: 'wave10', icon: '🌊', desc: 'Llega a la WAVE 10',    reward: 60 },
    { id: 'wave20', icon: '🔱', desc: 'Llega a la WAVE 20',    reward: 150 },
    { id: 'boss1',  icon: '👹', desc: 'Derrota tu primer BOSS', reward: 50 },
    { id: 'kills100', icon: '💀', desc: '100 enemigos en total', reward: 40 },
    { id: 'kills1000', icon: '☠️', desc: '1,000 enemigos en total', reward: 200 },
    { id: 'combo10', icon: '🔥', desc: 'Combo x5 alcanzado',   reward: 30 },
    { id: 'rich', icon: '💰', desc: 'Junta 100 monedas en una partida', reward: 35 },
  ];
  const META = LIST.reduce((m, a) => (m[a.id] = a, m), {});

  const DQAch = {
    elId: 'achievements-panel',
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
      this.render();
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

    // Fila compacta de medallas en la pantalla de inicio: las conseguidas
    // brillan, las que faltan quedan en gris con su pista al tocarlas.
    render() {
      const el = document.getElementById(this.elId);
      if (!el) return;
      const items = this.list();
      const got = items.filter(a => a.done).length;
      el.innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:.32rem;color:#ffb340;letter-spacing:.1em;margin-bottom:.35rem">' +
          '<span>🏅 LOGROS</span><span>' + got + '/' + items.length + '</span>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:.3rem">' +
          items.map(a => '<span title="' + a.desc + (a.done ? '' : ' (+' + a.reward + ' DQ)') + '" ' +
            'style="font-size:.55rem;line-height:1;padding:.25rem;border-radius:3px;' +
            (a.done ? 'background:rgba(255,179,64,.15);filter:none' : 'background:rgba(255,255,255,.03);filter:grayscale(1);opacity:.35') +
            '">' + a.icon + '</span>').join('') +
        '</div>';
    },

    init() { this._load(); this.render(); },
  };

  global.DQAch = DQAch;
})(window);
