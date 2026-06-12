// ═══════════════════════════════════════════════════════
// DUENDE QUEST — Daily Missions (shared module)
// Usado por game.html (web) y telegram/index.html (Mini App).
// Las recompensas se acreditan via el callback onReward que
// configura cada página (los DQ son moneda local del juego;
// los $DUENDE reales solo se acreditan server-side).
// ═══════════════════════════════════════════════════════
(function (global) {
  'use strict';

  const POOL = [
    { id: 'kill20', desc: 'Elimina 20 enemigos', type: 'kill', goal: 20, reward: 30 },
    { id: 'kill50', desc: 'Elimina 50 enemigos', type: 'kill', goal: 50, reward: 60 },
    { id: 'coin30', desc: 'Recoge 30 monedas',   type: 'coin', goal: 30, reward: 25 },
    { id: 'coin80', desc: 'Recoge 80 monedas',   type: 'coin', goal: 80, reward: 55 },
    { id: 'wave5',  desc: 'Llega a la WAVE 5',   type: 'wave', goal: 5,  reward: 40 },
    { id: 'wave8',  desc: 'Llega a la WAVE 8',   type: 'wave', goal: 8,  reward: 80 },
    { id: 'boss1',  desc: 'Derrota 1 BOSS',      type: 'boss', goal: 1,  reward: 50 },
    { id: 'chest3', desc: 'Abre 3 cofres',       type: 'chest', goal: 3, reward: 35 },
  ];

  const DQMissions = {
    state: null,
    elId: 'daily-missions',
    storageKey: 'dq_missions',
    onReward: null,             // function(mission) — acreditar mission.reward
    notify: null,               // function(msg)     — toast/notificación

    load() {
      const today = new Date().toISOString().slice(0, 10);
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); } catch (e) {}
      if (saved && saved.date === today && Array.isArray(saved.list)) {
        this.state = saved;
      } else {
        // selección diaria determinista (mismas misiones para todos)
        let seed = 0;
        for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
        const pool = POOL.slice(), picks = [];
        for (let i = 0; i < 3; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          picks.push(pool.splice(seed % pool.length, 1)[0]);
        }
        this.state = { date: today, list: picks.map(m => ({ ...m, progress: 0, done: false })) };
        this.save();
      }
      this.render();
    },

    save() { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); },

    event(type, val) {
      if (!this.state) return;
      let changed = false;
      this.state.list.forEach(m => {
        if (m.done || m.type !== type) return;
        m.progress = type === 'wave' ? Math.max(m.progress, val) : m.progress + (val || 1);
        if (m.progress >= m.goal) {
          m.progress = m.goal;
          m.done = true;
          if (typeof this.onReward === 'function') this.onReward(m);
          if (typeof this.notify === 'function') this.notify('🎯 MISIÓN CUMPLIDA: +' + m.reward + ' DQ!');
        }
        changed = true;
      });
      if (changed) { this.save(); this.render(); }
    },

    render() {
      const el = document.getElementById(this.elId);
      if (!el || !this.state) return;
      el.innerHTML = '<div style="font-size:.32rem;color:#ffe600;letter-spacing:.1em;margin-bottom:.35rem">🎯 MISIONES DIARIAS</div>' +
        this.state.list.map(m => {
          const pct = Math.min(100, Math.round(m.progress / m.goal * 100));
          return '<div style="margin-bottom:.3rem">' +
            '<div style="display:flex;justify-content:space-between;font-size:.28rem;color:' + (m.done ? '#00ff88' : 'rgba(255,255,255,.55)') + ';line-height:1.8">' +
              '<span>' + (m.done ? '✅' : '▫️') + ' ' + m.desc + '</span><span>' + (m.done ? '+' + m.reward + ' DQ' : m.progress + '/' + m.goal) + '</span>' +
            '</div>' +
            '<div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + (m.done ? '#00ff88' : '#ffe600') + '"></div>' +
            '</div>' +
          '</div>';
        }).join('');
    },
  };

  global.DQMissions = DQMissions;
})(window);
