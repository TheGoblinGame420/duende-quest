// ═══════════════════════════════════════════════════════
// CUENTA Y ENTRADA EN LA PORTADA (index.html)
//
// Una sola identidad, se entre por donde se entre:
//  - Navegador sin sesión: «Jugar ahora en el navegador» (entra al instante),
//    «Entrar con Telegram» y «Continuar como invitado». El botón «Entrar» de la
//    barra abre el formulario de cuenta (js/cuenta.js, Supabase Auth).
//  - Con la cuenta de correo, o con la de Telegram traída con el enlace de un uso
//    (?ott=, js/llave.js): el botón dice con quién sigues y el menú cierra sesión
//    DE VERDAD (servidor + todo lo guardado en el navegador).
//  - Dentro de Telegram (antes la portada no se enteraba y mostraba el duende de
//    invitado del webview): juegas con tu cuenta de Telegram y hay un botón para
//    llevarla al navegador o instalar la app.
// ═══════════════════════════════════════════════════════
import { abrirCuenta } from '/js/cuenta.js?v=405';
import { ottListo, tieneAparato, nombreAparato, abrirNavegador, cerrarSesionTotal } from '/js/llave.js?v=405';

const $ = id => document.getElementById(id);
const b = $('nav-cuenta'), menu = $('nav-cuenta-menu');
const cta = $('hero-cta-movil'), entTg = $('hero-ent-tg'), entInv = $('hero-ent-inv'), nota = $('hero-sin-tg');
const limpio = t => String(t || '').replace(/[<>&"]/g, '').slice(0, 18);

// Telegram de verdad: el SDK solo se baja dentro de Telegram (index.html, window.__tgListo) y trae initData.
if (window.__tgListo) { try { await window.__tgListo; } catch (e) {} }
const dentroTg = !!(window.TelegramWebviewProxy || window.parent !== window || (window.external && 'notify' in window.external));
const TG = dentroTg && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

function toast(txt, mal, accion) {
  const v = $('dq-portada-toast'); if (v) v.remove();
  const d = document.createElement('div');
  d.id = 'dq-portada-toast'; d.setAttribute('role', 'status');
  d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));z-index:9000;width:min(94vw,460px);display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--surface,#0d1614);border:1px solid ' + (mal ? 'var(--danger,#ff5d6c)' : 'var(--border-soft,rgba(109,245,189,.3))') + ';color:var(--text,#ecf7f1);font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.55)';
  const s = document.createElement('span'); s.style.cssText = 'flex:1;min-width:0'; s.textContent = txt; d.appendChild(s);
  if (accion) { const bt = document.createElement('a'); bt.href = accion.href; bt.textContent = accion.txt; bt.style.cssText = 'flex:none;padding:9px 14px;border-radius:10px;background:linear-gradient(180deg,#6ff8c0,#1ad68a);color:#03150d;font-weight:800;text-decoration:none;white-space:nowrap'; d.appendChild(bt); }
  const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '×';
  x.style.cssText = 'flex:none;min-width:36px;min-height:36px;background:none;border:0;color:var(--text-2,#a9bdb3);font-size:20px;cursor:pointer'; x.onclick = () => d.remove(); d.appendChild(x);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 12000);
}

if (TG) {
  // ── Dentro de Telegram ──
  if (b) b.hidden = true;
  if (cta) { cta.textContent = '▶ Jugar con mi cuenta de Telegram'; }
  if (entInv) entInv.hidden = true;
  if (entTg) {
    entTg.textContent = 'Jugar en el navegador o instalar la app';
    entTg.removeAttribute('target'); entTg.setAttribute('href', '#'); entTg.setAttribute('role', 'button');
    entTg.addEventListener('click', e => { e.preventDefault(); abrirNavegador({ TG, pagina: '/' }); });
  }
  if (nota) nota.textContent = 'Estás en Telegram: juegas con tu cuenta de Telegram, sin registrarte.';
  // Botón del bot «Jugar en navegador / Instalar app» (?tg=nav): la ventana del enlace se abre sola.
  if (/[?&]tg=nav(&|$)/.test(location.search)) abrirNavegador({ TG, pagina: '/mundo/' });
} else {
  // ── Navegador ──
  const sb = () => window._sb || null;
  let usuario = null, deTelegram = false;
  const cerrarMenu = () => { if (menu) menu.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); };

  const pintar = async () => {
    const cli = sb();
    let u = null;
    if (cli) { try { const { data } = await cli.auth.getSession(); u = data && data.session && data.session.user; } catch (e) {} }
    deTelegram = tieneAparato();
    usuario = deTelegram ? null : (u || null);   // la cuenta de Telegram traída con el enlace manda (es la que usa el juego)
    const quien = deTelegram ? (limpio(nombreAparato()) || 'Mi duende') : usuario ? limpio(String(usuario.email || 'Mi cuenta').split('@')[0]) : '';
    if (b) {
      b.textContent = quien ? '👤 ' + quien : 'Entrar';
      b.setAttribute('aria-haspopup', quien ? 'menu' : 'dialog');
      b.title = deTelegram ? 'Tu cuenta de Telegram en este navegador' : usuario ? 'Tu cuenta: vale en todos los juegos del Duende' : 'Entra o crea tu cuenta gratis (vale en todos los juegos)';
      if (!quien) cerrarMenu();
      b.hidden = false;
    }
    // Entrada del héroe: con cuenta, un solo camino claro; sin cuenta, los tres.
    let invitado = '';
    try { invitado = limpio(localStorage.getItem('dq_mmo_nombre')); } catch (e) {}
    if (cta) cta.textContent = quien ? '▶ Continuar con ' + quien : '▶ Jugar ahora en el navegador';
    if (entInv) { entInv.hidden = !!quien; entInv.textContent = invitado ? 'Continuar como invitado (' + invitado + ')' : 'Continuar como invitado'; }
    if (nota) nota.hidden = !!quien;
  };

  if (b && menu) {
    b.addEventListener('click', () => {
      if (!usuario && !deTelegram) { cerrarMenu(); abrirCuenta({ modo: 'crear', sb, alListo: pintar }); return; }
      const abrir = menu.hidden;
      menu.hidden = !abrir;
      b.setAttribute('aria-expanded', String(abrir));
    });
    menu.querySelector('[data-salir]').addEventListener('click', async () => {
      cerrarMenu();
      await cerrarSesionTotal({ sb });   // pregunta, invalida en el servidor, vacía el navegador y vuelve a la portada
    });
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== b) cerrarMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { cerrarMenu(); b.focus(); } });
  }

  // Enlace «Jugar en el navegador» de Telegram (?ott=): ya se canjeó al cargar js/llave.js.
  let res = null;
  try { res = await ottListo; } catch (e) {}
  if (res && res.ok) toast('Entraste con tu cuenta de Telegram' + (res.nombre ? ' (' + limpio(res.nombre) + ')' : '') + '. Este navegador la recordará.', false, { href: '/jugar/?web=1', txt: 'Jugar' });
  else if (res && !res.ok) toast(res.m || 'Ese enlace ya no vale. Pide otro en Telegram.', true);

  // Se espera a window._sb (hasta 15 s) y se escucha el cambio de sesión.
  let n = 0;
  const esperar = () => {
    const cli = sb();
    if (cli) { pintar(); try { cli.auth.onAuthStateChange(() => { pintar(); }); } catch (e) {} return; }
    if (++n < 60) setTimeout(esperar, 250); else pintar();
  };
  pintar();
  esperar();
}

// ── «Empieza en 3 pasos»: el paso tocado se abre y muestra su detalle; rota solo hasta que alguien lo toca ──
(() => {
  const lista = document.querySelector('#empieza .pasos');
  if (!lista) return;
  const pasos = [...lista.children];
  let i = 0, reloj = 0;
  const activar = (k, deUsuario) => {
    i = k;
    pasos.forEach((li, j) => { li.classList.toggle('activo', j === k); li.setAttribute('aria-expanded', String(j === k)); });
    if (deUsuario) { if (reloj > 0) clearInterval(reloj); reloj = -1; try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
  };
  pasos.forEach((li, j) => {
    li.tabIndex = 0; li.setAttribute('role', 'button');
    li.addEventListener('click', e => { if (e.target.closest('a,button')) return; activar(j, true); });
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(j, true); } });
  });
  activar(0, false);
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!quieto && 'IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      if (es[0].isIntersecting && !reloj && reloj !== -1) reloj = setInterval(() => activar((i + 1) % pasos.length, false), 4500);
      else if (!es[0].isIntersecting && reloj > 0) { clearInterval(reloj); reloj = 0; }
    }, { threshold: 0.4 }).observe(lista);
  }
  lista.addEventListener('pointerdown', () => { if (reloj > 0) clearInterval(reloj); reloj = -1; }, { once: true });
})();
