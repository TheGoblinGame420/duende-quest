// DUENDE QUEST — medicion de anuncios de Meta (pixel), OPCIONAL y con permiso.
// Lo carga /js/origen.js solo para quien llego de un anuncio de Meta (o ya
// acepto antes), nunca dentro de Telegram ni si lo rechazo.
//
// 1) Pregunta a /api/medir el ID del pixel. Si el dueño no configuro
//    META_PIXEL_ID y META_CAPI_TOKEN responde '' y aqui termina todo: sin
//    aviso y sin cargar NADA de Meta.
// 2) Sin decision guardada (localStorage dq_medir) muestra un aviso con
//    «Aceptar» y «No, gracias». Hasta que acepte no se carga fbevents.js ni se
//    pone ninguna cookie de Meta. El permiso se retira en /privacidad.html#medicion.
// 3) Con permiso: cookie _fbc del clic del anuncio, pixel y PageView.
//    window.dqMedir(evento, datos, eventID) manda un evento con el mismo
//    eventID que la Conversions API del servidor (functions/mmo/meta.js), asi
//    Meta lo cuenta una sola vez. Sin permiso o sin pixel no hace nada.
// Todo en try/catch: un fallo aqui nunca rompe la pagina ni el juego.
(function () {
  'use strict';
  if (window.__dqMedir) return;
  window.__dqMedir = 1;
  var CLAVE = 'dq_medir';
  var pixel = '', cargado = false, cola = [];
  var ESTANDAR = { PageView: 1, CompleteRegistration: 1, InitiateCheckout: 1, Purchase: 1, ViewContent: 1, AddToCart: 1 };

  function consiente() { try { return window.dqMedirOk ? window.dqMedirOk() : (localStorage.getItem(CLAVE) === '1' ? 1 : undefined); } catch (e) { return undefined; } }
  function guardar(v) { try { localStorage.setItem(CLAVE, v); } catch (e) {} }

  window.dqMedir = function (ev, datos, id) {
    try {
      if (consiente() !== 1 || typeof ev !== 'string') return;
      if (!cargado) { if (cola.length < 20) cola.push([ev, datos, id]); return; }
      var op = id ? { eventID: String(id).slice(0, 60) } : undefined;
      window.fbq(ESTANDAR[ev] ? 'track' : 'trackCustom', ev, datos || {}, op);
    } catch (e) {}
  };

  function cargarPixel() {
    if (cargado || !pixel || consiente() !== 1) return;
    try {
      // Cookie _fbc con el clic del anuncio guardado por origen.js: el pixel la usa
      // aunque el fbclid ya no este en la URL (se acepto en otra pagina).
      var o = JSON.parse(localStorage.getItem('dq_origen') || 'null');
      if (o && o.fr && !/(^|;\s*)_fbc=/.test(document.cookie)) {
        document.cookie = '_fbc=fb.1.' + (o.ft || o.t || Date.now()) + '.' + o.fr + ';path=/;max-age=7776000;SameSite=Lax' + (location.protocol === 'https:' ? ';Secure' : '');
      }
    } catch (e) {}
    try {
      // Fragmento oficial de Meta (fbevents.js), sin <noscript>.
      /* eslint-disable */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', pixel);
      window.fbq('track', 'PageView');
      cargado = true;
      var c = cola; cola = [];
      for (var i = 0; i < c.length; i++) window.dqMedir(c[i][0], c[i][1], c[i][2]);
    } catch (e) {}
  }

  function aviso() {
    if (document.getElementById('dq-medir')) return;
    var d = document.createElement('div');
    d.id = 'dq-medir';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Permiso de medición');
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' + (/^\/jugar(\/|$)/.test(location.pathname) ? 'top:calc(12px + env(safe-area-inset-top,0px))' : 'bottom:calc(12px + env(safe-area-inset-bottom,0px))') + ';z-index:2147483000;width:calc(100% - 24px);max-width:460px;box-sizing:border-box;background:#1b1530;color:#f2ecff;border:1px solid #6d5bb8;border-radius:12px;padding:12px 14px;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45)';
    d.innerHTML = '<div style="margin-bottom:10px">¿Nos ayudas a saber si nuestros anuncios funcionan? Con tu permiso usamos el píxel de Meta (Facebook/Instagram) y avisamos a Meta cuando juegas o compras desde un anuncio. Nunca enviamos tu nombre, correo ni teléfono. <a href="/privacidad.html#medicion" target="_blank" rel="noopener" style="color:#c9b8ff">Más info</a></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'
      + '<button type="button" data-v="0" style="min-height:40px;padding:8px 14px;border-radius:8px;border:1px solid #6d5bb8;background:transparent;color:#f2ecff;font:inherit;cursor:pointer">No, gracias</button>'
      + '<button type="button" data-v="1" style="min-height:40px;padding:8px 16px;border-radius:8px;border:0;background:#7c5cff;color:#fff;font:inherit;font-weight:600;cursor:pointer">Aceptar</button></div>';
    d.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-v]') : null;
      if (!b) return;
      e.stopPropagation();
      guardar(b.getAttribute('data-v'));
      try { d.parentNode.removeChild(d); } catch (er) {}
      if (b.getAttribute('data-v') === '1') cargarPixel();
    });
    // Que los toques en el aviso no muevan al personaje ni la camara del juego.
    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(function (t) { d.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
    (document.body || document.documentElement).appendChild(d);
  }

  function seguir(p) {
    pixel = /^\d{5,25}$/.test(String(p || '')) ? String(p) : '';
    if (!pixel) return;   // el dueño aun no configuro el pixel: nada de Meta
    var v = consiente();
    if (v === 1) cargarPixel();
    else if (v === undefined) {
      if (document.body) aviso();
      else document.addEventListener('DOMContentLoaded', aviso);
    }
  }

  try {
    if (consiente() === 0) return;
    var g = null;
    try { g = sessionStorage.getItem('dq_medir_p'); } catch (e) {}
    if (g !== null) return seguir(g);
    fetch('/api/medir', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : { p: '' }; }).then(function (j) {
      var p = (j && j.p) || '';
      try { sessionStorage.setItem('dq_medir_p', p); } catch (e) {}
      seguir(p);
    }).catch(function () {});
  } catch (e) {}
})();
