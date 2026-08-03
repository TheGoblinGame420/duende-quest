// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Daily Streak (shared module)
// Bonus de DQ creciente por entrar días consecutivos.
// Usado por game.html y telegram/index.html.
// ═══════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // día 1 → 10 DQ ... día 7+ → 100 DQ
  function bonusFor(day) { return Math.min(10 + (day - 1) * 15, 100); }

  const DQStreak = {
    storageKey: 'dq_streak',
    elId: 'streak-banner',
    onReward: null,   // function(day, bonus) — acreditar el bonus
    notify: null,     // function(msg)

    check() {
      const today = new Date().toISOString().slice(0, 10);
      let s = null;
      try { s = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); } catch (e) {}
      if (s && s.last === today) { this.render(s.day); return s.day; } // ya reclamado hoy

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const day = (s && s.last === yesterday) ? (s.day + 1) : 1;
      const bonus = bonusFor(day);
      localStorage.setItem(this.storageKey, JSON.stringify({ last: today, day }));
      if (typeof this.onReward === 'function') this.onReward(day, bonus);
      if (typeof this.notify === 'function') this.notify('🔥 RACHA DÍA ' + day + ' — +' + bonus + ' DQ!');
      this.render(day);
      return day;
    },

    // Mismo problema que en misiones: la racha solo se veía en la pantalla de
    // inicio. Ahora se pinta también en cualquier contenedor data-dq-streak.
    _targets() {
      const out = [];
      const legacy = document.getElementById(this.elId);
      if (legacy) out.push(legacy);
      document.querySelectorAll('[data-dq-streak]').forEach(e => { if (e !== legacy) out.push(e); });
      return out;
    },

    render(day) {
      const destinos = this._targets();
      if (!destinos.length) return;
      const next = bonusFor(day + 1);
      const html = '<span style="color:#ff9900">🔥 RACHA: DÍA ' + day + '</span>' +
        '<span style="color:rgba(255,255,255,.35);float:right">mañana +' + next + ' DQ</span>';
      destinos.forEach(el => { el.innerHTML = html; });
    },
  };

  global.DQStreak = DQStreak;
})(window);
