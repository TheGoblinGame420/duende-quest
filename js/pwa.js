// ═══════════════════════════════════════════════════════
// DUENDE QUEST — instalar la web como app (PWA)
//
// Registra /sw.js y gestiona el boton "Instalar": cualquier elemento con
// data-instalar se muestra cuando el navegador permite instalar (Chrome,
// Edge, Android) y al tocarlo abre el dialogo nativo. En iPhone/iPad (Safari
// no tiene ese dialogo) se muestra igual y explica: Compartir → "Añadir a
// pantalla de inicio". Dentro de Telegram o ya instalada, no se muestra nada.
// ═══════════════════════════════════════════════════════
(function () {
  var enTelegram = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  var instalada = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var aviso = null;

  if ('serviceWorker' in navigator && !enTelegram && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  function botones() { return document.querySelectorAll('[data-instalar]'); }
  function mostrar(si) { botones().forEach(function (b) { b.hidden = !si; b.style.display = si ? '' : 'none'; }); }

  function ayudaIos() {
    var d = document.createElement('div');
    d.setAttribute('role', 'dialog');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:99999;background:#1b1033;color:#ede9fe;border:1px solid #7c3aed;border-radius:14px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    d.innerHTML = '<b style="color:#ffd84a">Instalar $DUENDE en tu iPhone/iPad</b><br>1. Toca <b>Compartir</b> (el cuadrado con la flecha ↑) abajo en Safari.<br>2. Elige <b>«Añadir a pantalla de inicio»</b>.<br>3. Toca <b>Añadir</b>: el juego queda como una app.<div style="text-align:right;margin-top:8px"><button style="font:600 14px system-ui;padding:8px 14px;border:0;border-radius:10px;background:#7c3aed;color:#fff">Entendido</button></div>';
    d.querySelector('button').onclick = function () { d.remove(); };
    document.body.appendChild(d);
  }

  window.dqInstalar = function () {
    if (aviso) {
      aviso.prompt();
      aviso.userChoice.then(function (r) { if (r && r.outcome === 'accepted') mostrar(false); aviso = null; });
    } else if (ios) ayudaIos();
  };

  addEventListener('beforeinstallprompt', function (e) {
    if (enTelegram || !botones().length) return;   // sin boton propio: que el navegador muestre su aviso
    e.preventDefault();
    aviso = e;
    mostrar(true);
  });
  addEventListener('appinstalled', function () { aviso = null; mostrar(false); });

  function iniciar() {
    botones().forEach(function (b) { b.addEventListener('click', function (ev) { ev.preventDefault(); window.dqInstalar(); }); });
    mostrar(!enTelegram && !instalada && ios);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  // Volver a la app tras mucho rato: si mientras tanto se publico otra version
  // (el ?v= de la pagina cambio), se recarga para no seguir con el JS viejo
  // contra el servidor nuevo. Mas de 10 min porque CLASSIC ya suelta el WS a
  // los 3 (8 en mazmorra). Va tambien sin SW (Telegram). Sin ?v= no hace nada.
  var guion = document.querySelector('script[src*="?v="]');
  var verPagina = guion && (guion.getAttribute('src').match(/\?v=(\d+)/) || [])[1];
  var ocultaDesde = 0, comprobando = false;
  if (verPagina) document.addEventListener('visibilitychange', function () {
    if (document.hidden) { ocultaDesde = Date.now(); return; }
    if (!ocultaDesde || comprobando || Date.now() - ocultaDesde < 600000) return;
    ocultaDesde = 0; comprobando = true;
    fetch(location.pathname, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var v = (t.match(/\?v=(\d+)/) || [])[1];
      // reload conserva query y hash (sesion de Telegram); dq_auto: la cuenta web de CLASSIC entra sola
      if (v && v !== verPagina) { try { sessionStorage.setItem('dq_auto', '1'); } catch (e) {} location.reload(); }
    }).catch(function () {}).then(function () { comprobando = false; });
  });
})();
