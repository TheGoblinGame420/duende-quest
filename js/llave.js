// ═══════════════════════════════════════════════════════
// «JUGAR EN CHROME» — tu cuenta de Telegram en el navegador (cliente)
// Lo usan CLASSIC (mmo/js/client.js) y ORIGINS (mundo/js/mundo.js). Servidor: functions/mmo/llave.js.
//  - En Telegram: pedirLlave() → el servidor responde { t: 'llave', cod } →
//    ventanaLlave(m) muestra «Abrir en el navegador» y «Copiar enlace».
//  - En el navegador: el enlace trae #llave=<cod>; authAparato() lo usa una vez
//    y el servidor responde { t: 'llaveOk', tok } → guardarAparato(tok).
//    Desde entonces el hola va con { k: 'dt', tok } (mismo duende que en Telegram).
//  - Cerrar sesión: olvidarAparato().
// ═══════════════════════════════════════════════════════
const LS = (() => { try { return localStorage; } catch (e) { return null; } })();
const SS = (() => { try { return sessionStorage; } catch (e) { return null; } })();
const get = (st, k) => { try { return st ? st.getItem(k) : null; } catch (e) { return null; } };
const set = (st, k, v) => { try { if (st) v == null ? st.removeItem(k) : st.setItem(k, v); } catch (e) {} };
const HEX = /^[a-f0-9]{32}$/;

// El enlace se lee una vez al cargar y sale de la barra (no queda en el historial ni en capturas).
(() => {
  const mm = /(^#|&)llave=([a-f0-9]{32})(&|$)/.exec(location.hash || '');
  if (!mm) return;
  set(SS, 'dq_llave', mm[2]);
  const resto = location.hash.slice(1).split('&').filter(p => p && !p.startsWith('llave=')).join('&');
  try { history.replaceState(history.state, '', location.pathname + location.search + (resto ? '#' + resto : '')); } catch (e) {}
})();

// Lo que va en hola.auth, o null si este navegador no tiene la cuenta de Telegram.
export function authAparato() {
  const cod = get(SS, 'dq_llave');
  if (HEX.test(cod || '')) return { k: 'llave', cod };
  const tok = get(LS, 'dq_dt');
  if (HEX.test(tok || '')) return { k: 'dt', tok };
  return null;
}
export const tieneAparato = () => HEX.test(get(LS, 'dq_dt') || '');
export function guardarAparato(tok) { if (HEX.test(tok || '')) set(LS, 'dq_dt', tok); set(SS, 'dq_llave', null); }
// El servidor no lo aceptó (enlace usado o caducado, o sesión cerrada desde Telegram). Devuelve el aviso.
export function falloAparato(k) {
  if (k === 'llave') { set(SS, 'dq_llave', null); return 'Ese enlace ya se usó o caducó. Pide otro en Telegram: Ajustes → «Jugar en Chrome o PC».'; }
  if (k === 'dt') { set(LS, 'dq_dt', null); return 'Tu sesión de Telegram en este navegador se cerró. Pide un enlace nuevo en Telegram: Ajustes → «Jugar en Chrome o PC».'; }
  return '';
}
export function olvidarAparato() { set(LS, 'dq_dt', null); set(SS, 'dq_llave', null); }

// Ventana en Telegram con el enlace recién pedido.
// op: { TG, mandar, pagina: '/mundo/' | '/mmo/' }
export function ventanaLlave(m, op) {
  const url = location.origin + (op.pagina || '/mundo/') + '#llave=' + m.cod;
  const viejo = document.getElementById('dql-fondo'); if (viejo) viejo.remove();
  const f = document.createElement('div');
  f.id = 'dql-fondo';
  f.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,4,24,.82);font:500 14px/1.45 system-ui,-apple-system,sans-serif;color:#efe7ff';
  const B = 'display:block;width:100%;min-height:46px;margin-top:10px;border-radius:10px;font:800 15px system-ui,sans-serif;cursor:pointer;';
  f.innerHTML = `<div style="max-width:380px;width:100%;background:#1c1033;border:1px solid #6d3fc0;border-radius:14px;padding:18px;box-sizing:border-box">
    <h3 style="margin:0 0 6px;font-size:18px;color:#ffd84a;text-align:center">Jugar en Chrome o PC</h3>
    <p style="margin:0 0 6px">Con este enlace entras en el navegador con <b>tu mismo duende de Telegram</b>: nivel, oro, compras y todo.</p>
    <p style="margin:0;font-size:12px;color:#cbbbe8">Sirve una sola vez y caduca en ${m.min || 15} minutos. No se lo pases a nadie: quien lo abra entra con tu cuenta.</p>
    <button type="button" data-l="abrir" style="${B}border:0;background:linear-gradient(180deg,#8b5cf6,#6d28d9);color:#fff">Abrir en el navegador de este celular</button>
    <button type="button" data-l="copiar" style="${B}border:1px solid #6d3fc0;background:#24123f;color:#e9d5ff">Copiar enlace (para la PC)</button>
    <p data-l="msg" style="min-height:1.2em;margin:8px 0 0;font-size:12px;text-align:center;color:#86efac"></p>
    ${m.aparatos ? `<p style="margin:10px 0 0;font-size:12px;color:#cbbbe8;text-align:center">Tu cuenta está abierta en ${m.aparatos} navegador${m.aparatos > 1 ? 'es' : ''}. <button type="button" data-l="cerrar-todo" style="background:none;border:0;padding:0;color:#c4b5fd;text-decoration:underline;font:inherit;cursor:pointer">Cerrar la sesión en todos</button></p>` : ''}
    <button type="button" data-l="x" style="${B}border:0;background:none;color:#cbbbe8;font-weight:600">Cerrar</button></div>`;
  const msg = t => { f.querySelector('[data-l="msg"]').textContent = t; };
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-l]'); if (!b) { if (e.target === f) f.remove(); return; }
    const a = b.dataset.l;
    if (a === 'x') f.remove();
    else if (a === 'abrir') { try { if (op.TG && op.TG.openLink) op.TG.openLink(url, { try_instant_view: false }); else window.open(url, '_blank', 'noopener'); } catch (er) { window.open(url, '_blank', 'noopener'); } msg('Se abrió en tu navegador. Si no, usa «Copiar enlace».'); }
    else if (a === 'copiar') { const ok = () => msg('Enlace copiado. Pégalo en Chrome de tu PC (o envíatelo a «Mensajes guardados»).'); try { navigator.clipboard.writeText(url).then(ok, () => prompt('Copia este enlace:', url)); } catch (er) { prompt('Copia este enlace:', url); } }
    else if (a === 'cerrar-todo') { if (confirm('¿Cerrar tu cuenta de Telegram en todos los navegadores donde la abriste?')) { op.mandar({ t: 'llaveCerrar' }); f.remove(); } }
  });
  ['keydown', 'touchstart', 'pointerdown', 'wheel'].forEach(t => f.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  document.body.appendChild(f);
}
