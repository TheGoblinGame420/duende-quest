// ═══════════════════════════════════════════════════════
// CHICHA WARS — la cuenta en el servidor de Duende Quest (POST /mmo/cw)
// Misma identidad que Duende Quest en este navegador: la sesion de correo
// (Supabase, la abre CLASSIC u ORIGINS), Telegram dentro de la Mini App o el
// invitado (dq_mmo_tok, el mismo duende invitado).
// ═══════════════════════════════════════════════════════
let sb = null;
async function tokenWeb() {
  try {
    if (!window.supabase || !window.SUPABASE_URL) return null;
    sb = sb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  } catch (e) { return null; }
}
function tokInvitado() {
  let t = null;
  try { t = localStorage.getItem('dq_mmo_tok'); } catch (e) {}
  if (!/^[a-f0-9]{32}$/.test(t || '')) {
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    t = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('dq_mmo_tok', t); } catch (e) {}
  }
  return t;
}
async function auth() {
  const TG = window.Telegram && window.Telegram.WebApp;
  if (TG && TG.initData) return { k: 'tg', d: TG.initData };
  const tok = await tokenWeb();
  if (tok) return { k: 'web', tok };
  return { k: 'inv', tok: tokInvitado() };
}
// Espera al SDK de Supabase (se carga con defer) como mucho 4 s.
const sdkListo = new Promise(r => { let n = 0; const f = () => (window.supabase && window.SUPABASE_URL) || n++ > 40 ? r() : setTimeout(f, 100); f(); });

export async function pedir(a, datos = {}) {
  await sdkListo;
  try {
    const r = await fetch('/mmo/cw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth: await auth(), a, ...datos }) });
    const j = await r.json().catch(() => ({ ok: false }));
    return j;
  } catch (e) { return { ok: false, red: true, m: 'Sin conexión con el servidor.' }; }
}
