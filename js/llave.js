// ═══════════════════════════════════════════════════════
// «JUGAR EN EL NAVEGADOR» — tu cuenta de Telegram fuera de Telegram (cliente)
// Lo usan la portada, CLASSIC (mmo/js/client.js) y ORIGINS (mundo/js/mundo.js).
// Servidor: functions/api/auth.js y functions/mmo/llave.js.
//
//  - En Telegram: abrirNavegador() pide a POST /api/auth/telegram-handoff (con el
//    initData) un enlace de UN SOLO USO que vale 60 s y lo abre con openLink:
//    https://duendequest.com/?ott=<32 hex>[&ir=mundo|mmo]. Para la PC hay otro
//    que vale 10 minutos (da tiempo a copiarlo).
//  - En el navegador: al cargar se lee ?ott=, se quita de la barra y se canjea en
//    POST /api/auth/canje. El servidor pone la cookie de sesión (HttpOnly: este
//    código no la ve) y aquí solo queda una marca (dq_ck). Las cuentas que ese
//    navegador tuviera abiertas (otra de Telegram o la de correo) se cierran.
//    Desde entonces el hola va con { k: 'ck' } y entra el MISMO duende.
//  - cerrarSesionTotal(): el servidor invalida el token y se borra todo lo que el
//    sitio guardó en el navegador (cookies, localStorage, sessionStorage, IndexedDB).
//  - Sigue valiendo lo de v399: #llave=<cod> y el token de aparato en localStorage (dq_dt).
// ═══════════════════════════════════════════════════════
const LS = (() => { try { return localStorage; } catch (e) { return null; } })();
const SS = (() => { try { return sessionStorage; } catch (e) { return null; } })();
const get = (st, k) => { try { return st ? st.getItem(k) : null; } catch (e) { return null; } };
const set = (st, k, v) => { try { if (st) v == null ? st.removeItem(k) : st.setItem(k, v); } catch (e) {} };
const HEX = /^[a-f0-9]{32}$/;
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const post = (ruta, cuerpo, ms = 8000) => {
  const ab = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ab ? setTimeout(() => ab.abort(), ms) : 0;
  return fetch(ruta, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}), signal: ab ? ab.signal : undefined })
    .then(async r => { let j = {}; try { j = await r.json(); } catch (e) {} return { st: r.status, ok: r.ok && !!j.ok, j }; })
    .finally(() => clearTimeout(t));
};

// El enlace viejo (#llave=) se lee una vez al cargar y sale de la barra (no queda en el historial ni en capturas).
(() => {
  const mm = /(^#|&)llave=([a-f0-9]{32})(&|$)/.exec(location.hash || '');
  if (!mm) return;
  set(SS, 'dq_llave', mm[2]);
  const resto = location.hash.slice(1).split('&').filter(p => p && !p.startsWith('llave=')).join('&');
  try { history.replaceState(history.state, '', location.pathname + location.search + (resto ? '#' + resto : '')); } catch (e) {}
})();

// Las cuentas que este navegador tenía abiertas dejan de estarlo (el duende de invitado no se toca: no es una cuenta).
function cerrarCuentasLocales() {
  set(LS, 'dq_dt', null); set(SS, 'dq_llave', null); set(SS, 'dq_auto', null);
  try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k); } catch (e) {}
}

// ?ott=: se quita de la barra ANTES de nada y se canjea. Quien importe este módulo puede esperar a ottListo.
// Resuelve a null (no había enlace), { ok: true, nombre, nivel } o { ok: false, m }.
function leerOtt() {
  let p;
  try { p = new URLSearchParams(location.search); } catch (e) { return null; }
  const ott = p.get('ott');
  if (ott == null) return null;
  const ir = p.get('ir');
  p.delete('ott'); p.delete('ir');
  const q = p.toString();
  try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  return { ott: HEX.test(ott) ? ott : '', ir: ir === 'mundo' || ir === 'mmo' ? ir : '' };
}
export const ottListo = (async () => {
  const o = leerOtt();
  if (!o) return null;
  if (!o.ott) return { ok: false, m: 'Ese enlace no vale. Pide otro en Telegram.' };
  try {
    const viejo = get(LS, 'dq_dt');
    const r = await post('/api/auth/canje', { ott: o.ott, viejo: HEX.test(viejo || '') ? viejo : undefined });
    if (!r.ok) return { ok: false, m: r.j.m || 'Ese enlace ya se usó o caducó. Pide otro en Telegram.' };
    cerrarCuentasLocales();
    set(LS, 'dq_ck', '1');
    set(LS, 'dq_ck_nombre', String(r.j.nombre || '').slice(0, 24) || null);
    set(SS, 'dq_ott_ok', String(r.j.nombre || '') || '1');
    // Desde la portada con destino: directo al juego (allí sale el aviso de bienvenida).
    if (o.ir && (location.pathname === '/' || location.pathname === '/index.html')) { location.replace('/' + o.ir + '/'); await new Promise(() => {}); }
    return { ok: true, nombre: r.j.nombre || '', nivel: r.j.nivel || 0 };
  } catch (e) {
    return { ok: false, m: 'No hubo conexión para abrir tu cuenta. Pide otro enlace en Telegram.' };
  }
})();
// Aviso de bienvenida tras el canje (una vez): '' si no toca.
export function avisoOtt() {
  const n = get(SS, 'dq_ott_ok');
  if (!n) return '';
  set(SS, 'dq_ott_ok', null);
  return 'Entraste con tu cuenta de Telegram' + (n !== '1' ? ' (' + n + ')' : '') + '. Este navegador la recordará.';
}

// Lo que va en hola.auth, o null si este navegador no tiene la cuenta de Telegram.
export function authAparato() {
  const cod = get(SS, 'dq_llave');
  if (HEX.test(cod || '')) return { k: 'llave', cod };
  if (get(LS, 'dq_ck') === '1') return { k: 'ck' };   // la cookie HttpOnly viaja sola con el WebSocket
  const tok = get(LS, 'dq_dt');
  if (HEX.test(tok || '')) return { k: 'dt', tok };
  return null;
}
export const tieneAparato = () => get(LS, 'dq_ck') === '1' || HEX.test(get(LS, 'dq_dt') || '');
export const nombreAparato = () => (tieneAparato() ? get(LS, 'dq_ck_nombre') || '' : '');
export function nombrarAparato(n) { if (tieneAparato() && n) set(LS, 'dq_ck_nombre', String(n).slice(0, 24)); }
export function guardarAparato(tok) { if (HEX.test(tok || '')) set(LS, 'dq_dt', tok); set(SS, 'dq_llave', null); }
// El servidor no lo aceptó (enlace usado o caducado, o sesión cerrada). Devuelve el aviso.
export function falloAparato(k) {
  const pide = ' Pide un enlace nuevo en Telegram: Ajustes → «Jugar en el navegador».';
  if (k === 'llave') { set(SS, 'dq_llave', null); return 'Ese enlace ya se usó o caducó.' + pide; }
  if (k === 'dt') { set(LS, 'dq_dt', null); return 'Tu sesión de Telegram en este navegador se cerró.' + pide; }
  if (k === 'ck') { set(LS, 'dq_ck', null); set(LS, 'dq_ck_nombre', null); return 'Tu sesión de Telegram en este navegador se cerró.' + pide; }
  return '';
}
export function olvidarAparato() { set(LS, 'dq_dt', null); set(LS, 'dq_ck', null); set(LS, 'dq_ck_nombre', null); set(SS, 'dq_llave', null); }

// ── Una sola cuenta: dentro de Telegram, con tu cuenta de correo abierta en este mismo sitio ──
// El servidor las une al momento (vincProbar) si el correo aún no tiene un duende con progreso.
// op: { TG, mandar, tokenWeb, invitado }
const claveUnir = TG => { let id = ''; try { id = String((TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.id) || ''); } catch (e) {} return 'dq_vinc_web_' + id; };
let unirTG = null;
export async function unirCuentaWeb(op = {}) {
  if (!op.TG || op.invitado || typeof op.mandar !== 'function' || typeof op.tokenWeb !== 'function') return;
  unirTG = op.TG;
  if (get(LS, claveUnir(op.TG))) return;   // ya unidas, o ya se le dijo que tiene que elegir
  try { const tok = await op.tokenWeb(); if (tok) op.mandar({ t: 'vincProbar', tok }); } catch (e) {}
}
// Respuesta { t: 'vincProbar' }: devuelve el aviso que hay que mostrar ('' si ninguno; el éxito ya lo dice el servidor).
export function respuestaUnir(m) {
  if (!m || !unirTG) return '';
  if (m.ok) { set(LS, claveUnir(unirTG), '1'); return ''; }
  if (m.propio || (m.m && !/comprobar/.test(m.m))) { set(LS, claveUnir(unirTG), 'no'); return m.m || ''; }
  return '';   // prueba no reconocida (sesión de correo caducada): se intenta la próxima vez
}

// ── Cerrar sesión de verdad ──
// op: { sb: cliente de Supabase o función que lo devuelve, preguntar: false para no confirmar, ir: '/' }
export async function cerrarSesionTotal(op = {}) {
  if (op.preguntar !== false && !confirm('¿Cerrar sesión en este navegador?\n\nSe cierra tu cuenta aquí y se borra todo lo que el juego guardó en este navegador: ajustes y, si no lo pasaste a tu cuenta, el duende de invitado de este aparato.\n\nTu cuenta y su duende siguen a salvo: vuelves a entrar cuando quieras.')) return false;
  const dt = get(LS, 'dq_dt');
  // 1. El servidor invalida la sesión de Telegram de este navegador (cookie y token viejo) y manda Clear-Site-Data.
  try { await post('/api/auth/salir', { dt: HEX.test(dt || '') ? dt : undefined }, 6000); } catch (e) {}
  // 2. La cuenta de correo: Supabase revoca esta sesión.
  try {
    const cli = typeof op.sb === 'function' ? op.sb() : op.sb;
    if (cli && cli.auth) await Promise.race([cli.auth.signOut({ scope: 'local' }), new Promise(r => setTimeout(r, 4000))]);
  } catch (e) {}
  // 3. Y aquí no queda nada (por si el navegador no obedece Clear-Site-Data).
  await vaciarNavegador();
  try { location.replace(op.ir || '/'); } catch (e) { location.href = '/'; }
  return true;
}
export async function vaciarNavegador() {
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try { for (const c of document.cookie.split(';')) { const n = c.split('=')[0].trim(); if (n) document.cookie = n + '=; Max-Age=0; Path=/'; } } catch (e) {}
  try {
    if (self.indexedDB && indexedDB.databases) {
      const l = await indexedDB.databases();
      await Promise.all(l.map(d => d && d.name ? new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => r(); setTimeout(r, 1500); }) : null));
    }
  } catch (e) {}
  try { if (self.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
}

// ── Ventana en Telegram: «Jugar en el navegador / Instalar app» ──
// op: { TG, pagina: '/mundo/' | '/mmo/' | '/', mandar? (para «cerrar en todos») }
export function abrirNavegador(op = {}) {
  const TG = op.TG || (window.Telegram && window.Telegram.WebApp) || null;
  const ir = op.pagina === '/mmo/' ? 'mmo' : op.pagina === '/mundo/' ? 'mundo' : '';
  const url = cod => location.origin + '/?ott=' + cod + (ir ? '&ir=' + ir : '');
  const viejo = document.getElementById('dql-fondo'); if (viejo) viejo.remove();
  const f = document.createElement('div');
  f.id = 'dql-fondo';
  f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', 'Jugar en el navegador');
  f.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,5,.84);font:500 14px/1.45 system-ui,-apple-system,sans-serif;color:var(--text,#ecf7f1)';
  const B = 'display:block;width:100%;min-height:48px;margin-top:10px;border-radius:12px;font:800 15px system-ui,sans-serif;cursor:pointer;';
  f.innerHTML = `<div style="max-width:390px;width:100%;background:var(--surface,#0d1614);border:1px solid var(--border-soft,rgba(109,245,189,.28));border-radius:16px;padding:18px;box-sizing:border-box;box-shadow:0 18px 60px rgba(0,0,0,.6)">
    <h3 style="margin:0 0 6px;font-size:18px;color:var(--accent,#f5c84c);text-align:center">Jugar en el navegador o instalar la app</h3>
    <p style="margin:0 0 6px">Abre Duende Quest en Chrome o Safari con <b>tu mismo duende de Telegram</b>: nivel, oro, compras y todo. Allí puedes añadirlo a tu pantalla de inicio como una app.</p>
    <p style="margin:0;font-size:12px;color:var(--text-2,#a9bdb3)">El enlace sirve una sola vez. No se lo pases a nadie: quien lo abra entra con tu cuenta.</p>
    <button type="button" data-l="abrir" disabled style="${B}border:0;background:linear-gradient(180deg,#6ff8c0,#1ad68a);color:#03150d;opacity:.55">Preparando tu enlace…</button>
    <button type="button" data-l="copiar" disabled style="${B}border:1px solid var(--border,#213832);background:var(--surface-2,#13201c);color:var(--text,#ecf7f1);opacity:.55">Copiar enlace para la PC (vale 10 min)</button>
    <p data-l="msg" role="status" style="min-height:1.2em;margin:8px 0 0;font-size:12px;text-align:center;color:var(--primary-soft,#6df5bd)"></p>
    ${op.mandar ? '<p style="margin:8px 0 0;font-size:12px;color:var(--text-2,#a9bdb3);text-align:center"><button type="button" data-l="cerrar-todo" style="background:none;border:0;padding:6px;color:var(--primary-soft,#6df5bd);text-decoration:underline;font:inherit;cursor:pointer">Cerrar mi cuenta en todos los navegadores</button></p>' : ''}
    <button type="button" data-l="x" style="${B}border:0;background:none;color:var(--text-2,#a9bdb3);font-weight:600">Cerrar</button></div>`;
  const q = s => f.querySelector('[data-l="' + s + '"]');
  const msg = (t, mal) => { const p = q('msg'); p.textContent = t; p.style.color = mal ? 'var(--danger,#ff5d6c)' : 'var(--primary-soft,#6df5bd)'; };
  const listo = (b, txt) => { b.disabled = false; b.style.opacity = '1'; if (txt) b.textContent = txt; };
  let corto = '', largo = '', vivo = true, relojC = 0, relojL = 0;
  const pedir = async esLargo => {
    if (!vivo) return;
    if (!TG || !TG.initData) { msg('Esto se abre desde el juego dentro de Telegram.', true); return; }
    try {
      const r = await post('/api/auth/telegram-handoff', { initData: TG.initData, largo: esLargo ? 1 : undefined });
      if (!vivo) return;
      if (!r.ok) { msg(r.j.m || 'No se pudo preparar el enlace. Prueba otra vez.', true); return; }
      if (esLargo) { largo = r.j.ott; listo(q('copiar')); } else { corto = r.j.ott; listo(q('abrir'), 'Abrir en el navegador de este celular'); }
    } catch (e) { if (vivo) msg('Sin conexión. Cierra esta ventana y prueba otra vez.', true); }
  };
  // El corto vale 60 s: se renueva cada 45 s mientras la ventana siga abierta (y al usarlo).
  const renovar = () => { clearInterval(relojC); clearInterval(relojL); relojC = setInterval(() => pedir(false), 45000); relojL = setInterval(() => pedir(true), 9 * 60000); };
  const cerrar = () => { vivo = false; clearInterval(relojC); clearInterval(relojL); f.remove(); };
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-l]'); if (!b) { if (e.target === f) cerrar(); return; }
    const a = b.dataset.l;
    if (a === 'x') cerrar();
    else if (a === 'abrir' && corto) {
      const u = url(corto); corto = '';
      try { if (TG && TG.openLink) TG.openLink(u, { try_instant_view: false }); else window.open(u, '_blank', 'noopener'); } catch (er) { window.open(u, '_blank', 'noopener'); }
      msg('Se abrió en tu navegador. Si no, usa «Copiar enlace».');
      b.disabled = true; b.style.opacity = '.55'; pedir(false);
    } else if (a === 'copiar' && largo) {
      const u = url(largo); largo = '';
      const ok = () => msg('Enlace copiado. Pégalo en Chrome de tu PC en los próximos 10 minutos.');
      try { navigator.clipboard.writeText(u).then(ok, () => prompt('Copia este enlace:', u)); } catch (er) { prompt('Copia este enlace:', u); }
      b.disabled = true; b.style.opacity = '.55'; pedir(true);
    } else if (a === 'cerrar-todo') {
      if (confirm('¿Cerrar tu cuenta de Telegram en todos los navegadores donde la abriste?')) { op.mandar({ t: 'llaveCerrar' }); cerrar(); }
    }
  });
  ['keydown', 'touchstart', 'pointerdown', 'wheel'].forEach(t => f.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  document.body.appendChild(f);
  pedir(false); pedir(true); renovar();
  return f;
}
// Compatibilidad: el servidor aún responde { t: 'llave' } a clientes viejos.
export function ventanaLlave(m, op) { return abrirNavegador(op); }
