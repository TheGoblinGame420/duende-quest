'use strict';
// ── DUENDE QUEST — AUTH & GLOBAL LEADERBOARD ──
// Requires: Supabase JS v2 (CDN), js/config.js loaded first

let _sb = null;
let currentUser = null;
let currentProfile = null;

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function initSupabase() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL === 'YOUR_SUPABASE_URL') return false;
  try {
    const { createClient } = window.supabase;
    _sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window._sb = _sb;
    window.supabaseClient = _sb;
    return true;
  } catch (e) {
    console.warn('[Auth] Supabase init failed:', e);
    return false;
  }
}

window.addEventListener('load', async () => {
  if (!initSupabase()) {
    console.log('[Auth] Offline mode — add Supabase config to js/config.js');
    return;
  }

  _sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await _loadProfile(session.user);
    } else {
      currentUser = null;
      currentProfile = null;
      _updateMenuUI();
    }
  });

  const { data: { user } } = await _sb.auth.getUser();
  if (user) await _loadProfile(user);
});

// ─────────────────────────────────────────────
// AUTH MODAL
// ─────────────────────────────────────────────
function showAuthModal(tab) {
  tab = tab || 'login';
  if (currentProfile) { showProfileModal(); return; }
  document.querySelectorAll('.ov').forEach(o => o.classList.remove('show'));
  document.getElementById('ov-auth').classList.add('show');
  switchAuthTab(tab);
  clearAuthError();
}

function switchAuthTab(tab) {
  clearAuthError();
  const lf = document.getElementById('auth-login-form');
  const rf = document.getElementById('auth-register-form');
  const lt = document.getElementById('auth-login-tab');
  const rt = document.getElementById('auth-register-tab');

  const activeStyle = 'linear-gradient(135deg,#00ff88,#00cc6a)';
  const inactiveStyle = 'rgba(255,255,255,.08)';

  if (tab === 'login') {
    lf.style.display = 'flex'; rf.style.display = 'none';
    lt.style.background = activeStyle; lt.style.color = '#000';
    rt.style.background = inactiveStyle; rt.style.color = 'rgba(255,255,255,.5)';
  } else {
    lf.style.display = 'none'; rf.style.display = 'flex';
    rt.style.background = activeStyle; rt.style.color = '#000';
    lt.style.background = inactiveStyle; lt.style.color = 'rgba(255,255,255,.5)';
  }
}

function closeAuthModal() {
  document.getElementById('ov-auth').classList.remove('show');
  document.getElementById('ov-menu').classList.add('show');
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function authLogin() {
  if (!_sb) { showAuthError('Configura Supabase en js/config.js'); return; }
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-password').value;
  if (!email || !pwd) { showAuthError('Completa todos los campos'); return; }

  _setAuthBusy(true);
  const { data, error } = await _sb.auth.signInWithPassword({ email, password: pwd });
  _setAuthBusy(false);

  if (error) { showAuthError(_friendlyError(error.message)); return; }
  await _loadProfile(data.user);
  closeAuthModal();
}

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
async function authRegister() {
  if (!_sb) { showAuthError('Configura Supabase en js/config.js'); return; }
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const pwd      = document.getElementById('reg-password').value;

  if (!username || !email || !pwd) { showAuthError('Completa todos los campos'); return; }
  if (username.length < 3 || username.length > 20) { showAuthError('Username: 3-20 caracteres'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError('Username: solo letras, números y _'); return; }
  if (pwd.length < 6) { showAuthError('Contraseña: mínimo 6 caracteres'); return; }

  _setAuthBusy(true);
  const { data, error } = await _sb.auth.signUp({
    email,
    password: pwd,
    options: { data: { username } }
  });
  _setAuthBusy(false);

  if (error) { showAuthError(_friendlyError(error.message)); return; }

  if (data.user && data.session) {
    await new Promise(r => setTimeout(r, 600));
    await _loadProfile(data.user);
    closeAuthModal();
    if (typeof showPUNotif === 'function') showPUNotif('✅ ¡BIENVENIDO ' + username.toUpperCase() + '!');
  } else {
    showAuthError('Revisa tu email y confirma la cuenta para entrar');
  }
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
async function authLogout() {
  if (_sb) await _sb.auth.signOut();
  currentUser = null;
  currentProfile = null;
  _updateMenuUI();
  const pf = document.getElementById('ov-profile');
  if (pf) pf.classList.remove('show');
  document.getElementById('ov-menu').classList.add('show');
}

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────
async function _loadProfile(user) {
  currentUser = user;
  if (!_sb) return;
  const { data } = await _sb.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = data;
  _updateMenuUI();
}

function _updateMenuUI() {
  const btn  = document.getElementById('menu-auth-btn');
  const info = document.getElementById('menu-user-info');

  if (currentProfile) {
    if (btn) {
      btn.textContent = '👤 ' + currentProfile.username.toUpperCase();
      btn.style.background = 'linear-gradient(135deg,#7c3aed,#5b21b6)';
      btn.style.color = '#fff';
    }
    if (info) {
      info.style.display = 'flex';
      info.innerHTML =
        '<span style="color:#00ff88;font-size:.45rem">👤 ' + _escHtml(currentProfile.username) + '</span>' +
        '<span style="color:#ffe600;font-size:.32rem">🏆 ' + (currentProfile.best_score || 0).toLocaleString() + '</span>' +
        '<span style="color:rgba(255,255,255,.35);font-size:.28rem">🎮 ' + (currentProfile.games_played || 0) + ' partidas jugadas</span>';
    }
  } else {
    if (btn) {
      btn.textContent = '🔑 CUENTA';
      btn.style.background = 'rgba(124,58,237,.2)';
      btn.style.color = '#a78bfa';
    }
    if (info) info.style.display = 'none';
  }
}

function showProfileModal() {
  if (!currentProfile) { showAuthModal('login'); return; }
  document.querySelectorAll('.ov').forEach(o => o.classList.remove('show'));
  const modal = document.getElementById('ov-profile');
  if (!modal) { document.getElementById('ov-menu').classList.add('show'); return; }

  document.getElementById('profile-username').textContent = currentProfile.username;
  document.getElementById('profile-best').textContent    = (currentProfile.best_score || 0).toLocaleString();
  document.getElementById('profile-wave').textContent    = currentProfile.best_wave || 0;
  document.getElementById('profile-games').textContent   = currentProfile.games_played || 0;
  document.getElementById('profile-coins').textContent   = (currentProfile.total_coins || 0).toLocaleString();

  const wb = document.getElementById('profile-wallet-btn');
  if (wb) {
    if (currentProfile.wallet_solana) {
      const w = currentProfile.wallet_solana;
      window._phantomPubkey = w; // expose for DQ Wallet panel
      wb.textContent = '👻 ' + w.slice(0, 6) + '...' + w.slice(-4);
      wb.style.color = '#00ff88';
    } else {
      wb.textContent = '👻 CONECTAR PHANTOM';
      wb.style.color = '';
    }
  }

  modal.classList.add('show');
}

// ─────────────────────────────────────────────
// SCORE SUBMISSION
// ─────────────────────────────────────────────
async function submitScore(data) {
  if (!_sb || !currentUser || !currentProfile) return;
  try {
    await _sb.from('game_scores').insert({
      user_id:       currentUser.id,
      username:      currentProfile.username,
      score:         data.score,
      wave:          data.wave,
      level:         data.level    || 1,
      coins:         data.coins    || 0,
      bosses_killed: data.bosses_killed || 0,
      combos_max:    data.combos_max    || 0
    });
    const { data: updated } = await _sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (updated) { currentProfile = updated; _updateMenuUI(); }
  } catch (e) {
    console.warn('[Auth] Score submit failed:', e);
  }
}

// ─────────────────────────────────────────────
// GLOBAL LEADERBOARD
// ─────────────────────────────────────────────
async function showGlobalRanking(filter) {
  filter = filter || 'alltime';
  document.querySelectorAll('.ov').forEach(o => o.classList.remove('show'));
  document.getElementById('ov-rank').classList.add('show');

  const titleEl   = document.getElementById('rank-title');
  const filtersEl = document.getElementById('rank-filters');
  const list      = document.getElementById('rank-list');

  if (_sb) {
    if (titleEl) titleEl.textContent = '🌍 RANKING GLOBAL';
    if (filtersEl) {
      filtersEl.style.display = 'flex';
      ['alltime', 'week', 'today'].forEach(f => {
        const b = document.getElementById('rank-filter-' + f);
        if (!b) return;
        b.style.background = f === filter
          ? 'linear-gradient(135deg,#ffe600,#cc9900)'
          : 'rgba(255,255,255,.08)';
        b.style.color = f === filter ? '#000' : 'rgba(255,255,255,.5)';
      });
    }

    list.innerHTML = '<div style="font-size:.38rem;color:rgba(255,255,255,.3);text-align:center;padding:1.2rem">⌛ CARGANDO...</div>';

    const timeout = new Promise(res => setTimeout(() => res(null), 6000));
    const scores  = await Promise.race([_fetchLeaderboard(filter), timeout]);

    if (scores === null) {
      // Timeout or DB error — fall back to local ranking
      if (titleEl) titleEl.textContent = '🏆 RANKING LOCAL';
      if (filtersEl) filtersEl.style.display = 'none';
      const localRanking = (typeof ranking !== 'undefined') ? ranking : [];
      if (localRanking.length === 0) {
        list.innerHTML = '<div style="font-size:.38rem;color:rgba(255,255,255,.3);text-align:center;padding:1.2rem">⚠️ SIN CONEXIÓN — juega para generar récords locales</div>';
      } else {
        list.innerHTML = localRanking.slice(0, 15).map((r, i) => {
          const medals = ['🥇', '🥈', '🥉'];
          const cls = ['gold', 'silver', 'bronze'][i] || '';
          return '<div class="rank-row"><span class="rank-pos ' + cls + '">' + (medals[i] || '#' + (i+1)) +
            '</span><span class="rank-name">WAVE ' + r.wave + '</span>' +
            '<span class="rank-score">' + r.score.toLocaleString() + '</span>' +
            '<span class="rank-wave">' + (r.date || '') + '</span></div>';
        }).join('');
      }
      return;
    }
    if (scores.length === 0) {
      list.innerHTML = '<div style="font-size:.38rem;color:rgba(255,255,255,.3);text-align:center;padding:1.2rem">SIN PARTIDAS AÚN — ¡SÉ EL PRIMERO!</div>';
      return;
    }

    list.innerHTML = scores.map((r, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const cls    = ['gold', 'silver', 'bronze'][i] || '';
      const date   = new Date(r.created_at).toLocaleDateString('es');
      const isMe   = currentProfile && r.username === currentProfile.username;
      return '<div class="rank-row' + (isMe ? ' rank-me' : '') + '">' +
        '<span class="rank-pos ' + cls + '">' + (medals[i] || '#' + (i + 1)) + '</span>' +
        '<span class="rank-name">' + _escHtml(r.username) + '</span>' +
        '<span class="rank-score">' + r.score.toLocaleString() + '</span>' +
        '<span class="rank-wave">W' + r.wave + '</span>' +
        '<span class="rank-wave" style="font-size:.28rem;color:rgba(255,255,255,.2)">' + date + '</span>' +
        '</div>';
    }).join('');

  } else {
    if (titleEl) titleEl.textContent = '🏆 RANKING LOCAL';
    if (filtersEl) filtersEl.style.display = 'none';

    const localRanking = (typeof ranking !== 'undefined') ? ranking : [];
    if (localRanking.length === 0) {
      list.innerHTML = '<div style="font-size:.38rem;color:rgba(255,255,255,.3);text-align:center;padding:1.2rem">SIN PARTIDAS AÚN</div>';
    } else {
      list.innerHTML = localRanking.map((r, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const cls    = ['gold', 'silver', 'bronze'][i] || '';
        return '<div class="rank-row">' +
          '<span class="rank-pos ' + cls + '">' + (medals[i] || '#' + (i + 1)) + '</span>' +
          '<span class="rank-name">WAVE ' + r.wave + '</span>' +
          '<span class="rank-score">' + r.score.toLocaleString() + '</span>' +
          '<span class="rank-wave">' + (r.date || '') + '</span>' +
          '</div>';
      }).join('');
    }
  }
}

async function _fetchLeaderboard(filter) {
  let q = _sb
    .from('game_scores')
    .select('username, score, wave, level, created_at')
    .order('score', { ascending: false })
    .limit(50);

  if (filter === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    q = q.gte('created_at', d.toISOString());
  } else if (filter === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 7);
    q = q.gte('created_at', d.toISOString());
  }

  const { data, error } = await q;
  if (error) { console.warn('[Leaderboard]', error); return null; }
  // Una entrada por jugador: su mejor score
  const best = new Map();
  for (const s of (data || [])) {
    const k = (s.username || '?').toLowerCase();
    if (!best.has(k) || s.score > best.get(k).score) best.set(k, s);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}

// ─────────────────────────────────────────────
// PHANTOM WALLET (Solana)
// ─────────────────────────────────────────────
async function connectPhantom() {
  if (!window.solana || !window.solana.isPhantom) {
    window.open('https://phantom.app/', '_blank');
    return;
  }
  try {
    const resp   = await window.solana.connect();
    const pubkey = resp.publicKey.toString();
    window._phantomPubkey = pubkey; // expose for DQ Wallet panel
    const short  = pubkey.slice(0, 6) + '...' + pubkey.slice(-4);

    const wb = document.getElementById('profile-wallet-btn');
    if (wb) { wb.textContent = '👻 ' + short; wb.style.color = '#00ff88'; }

    if (_sb && currentUser) {
      await _sb.from('profiles').update({ wallet_solana: pubkey }).eq('id', currentUser.id);
      if (currentProfile) currentProfile.wallet_solana = pubkey;
    }
    if (typeof showPUNotif === 'function') showPUNotif('👻 PHANTOM: ' + short);

  } catch (e) {
    console.warn('[Phantom]', e);
  }
}

// ─────────────────────────────────────────────
// TELEGRAM LOGIN
// ─────────────────────────────────────────────
async function loginWithTelegram(initData) {
  if (!_sb || !initData) return { success: false };
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get('user');
    if (!userRaw) return { success: false };
    const tgUser = JSON.parse(decodeURIComponent(userRaw));
    const tgId = String(tgUser.id);
    const username = tgUser.username || tgUser.first_name || 'tg_' + tgId;

    const { data, error } = await _sb.from('profiles').upsert({
      telegram_id: tgId,
      username: username.slice(0, 20),
    }, { onConflict: 'telegram_id' }).select().single();

    if (error) { console.warn('[TG Auth]', error); return { success: false }; }
    currentProfile = data;
    return { success: true, profile: data };
  } catch (e) {
    console.warn('[TG Auth]', e);
    return { success: false };
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function _setAuthBusy(busy) {
  document.querySelectorAll('#ov-auth .ob').forEach(b => b.disabled = busy);
  const lf = document.getElementById('auth-login-form');
  const isLogin = lf && lf.style.display !== 'none';
  const btn = isLogin
    ? document.querySelector('#auth-login-form .ob')
    : document.querySelector('#auth-register-form .ob');
  if (btn) btn.textContent = busy ? '⌛ ...' : (isLogin ? '▶ ENTRAR' : '✅ CREAR CUENTA');
}

function _friendlyError(msg) {
  if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return 'Email o contraseña incorrectos';
  if (msg.includes('already registered') || msg.includes('already exists'))  return 'Este email ya está registrado';
  if (msg.includes('Password should'))   return 'Contraseña muy corta (mínimo 6)';
  if (msg.includes('not confirmed'))     return 'Confirma tu email primero';
  if (msg.includes('rate limit'))        return 'Demasiados intentos. Espera un momento';
  return msg;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
