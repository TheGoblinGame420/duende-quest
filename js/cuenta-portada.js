// ═══════════════════════════════════════════════════════
// CUENTA EN LA PORTADA (index.html, botón #nav-cuenta)
//
// Entrar / crear cuenta sin salir de la portada: el mismo formulario
// (js/cuenta.js) y la misma sesión de Supabase Auth que usan CLASSIC,
// ORIGINS, Chicha Wars y el arcade (mismo dominio = misma sesión). El
// cliente es window._sb, que crea auth-manager.js en el 'load'.
// Con sesión, el botón abre un menú: jugar, tienda y cerrar sesión.
// En Telegram no aparece: allí la cuenta es la de Telegram.
// ═══════════════════════════════════════════════════════
import { abrirCuenta } from '/js/cuenta.js?v=400';

const b = document.getElementById('nav-cuenta');
const menu = document.getElementById('nav-cuenta-menu');
const enTg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || /tgWebAppData=/.test(location.hash);

if (b && menu && !enTg) {
  const sb = () => window._sb || null;
  let usuario = null;
  const cerrarMenu = () => { menu.hidden = true; b.setAttribute('aria-expanded', 'false'); };

  const pintar = async () => {
    const cli = sb();
    let u = null;
    if (cli) { try { const { data } = await cli.auth.getSession(); u = data && data.session && data.session.user; } catch (e) {} }
    usuario = u || null;
    b.textContent = usuario ? '👤 ' + String(usuario.email || 'Mi cuenta').split('@')[0].slice(0, 18) : 'Entrar';
    b.setAttribute('aria-haspopup', usuario ? 'menu' : 'dialog');
    b.title = usuario ? 'Tu cuenta: vale en todos los juegos del Duende' : 'Entra o crea tu cuenta gratis (vale en todos los juegos)';
    if (!usuario) cerrarMenu();
    b.hidden = false;
  };

  b.addEventListener('click', () => {
    if (!usuario) { cerrarMenu(); abrirCuenta({ modo: 'crear', sb, alListo: pintar }); return; }
    const abrir = menu.hidden;
    menu.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
  });
  menu.querySelector('[data-salir]').addEventListener('click', async () => {
    cerrarMenu();
    try { await sb().auth.signOut(); } catch (e) {}
    pintar();
  });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== b) cerrarMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { cerrarMenu(); b.focus(); } });

  // Se espera a window._sb (hasta 15 s) y se escucha el cambio de sesión.
  let n = 0;
  const esperar = () => {
    const cli = sb();
    if (cli) { pintar(); try { cli.auth.onAuthStateChange(() => { pintar(); }); } catch (e) {} return; }
    if (++n < 60) setTimeout(esperar, 250); else pintar();
  };
  esperar();
}
