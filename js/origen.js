// DUENDE QUEST — de donde llego el jugador (atribucion "primer toque") y
// embudo de la carga del juego. Script clasico, sin dependencias: lo cargan
// la web (/), /inicio/, /jugar/, /mmo/, /mundo/ y /telegram/ antes que nada.
//
// 1) ORIGEN: la primera vez que este navegador llega (o si lo guardado tiene
//    mas de 30 dias) guarda en localStorage 'dq_origen':
//      { s: utm_source, c: utm_campaign, a: utm_content, fbc: fbclid,
//        ref: codigo de invitacion o start_param, t: cuando, o: grupo }
//    Todo saneado a [a-z0-9_-]{0,40}. Nada personal: solo la etiqueta del enlace.
//    El grupo (o) es uno de meta | tg | wa | ref | org y viaja en el 'hola'
//    (src): el servidor lo vuelve a validar con la misma lista blanca.
// 2) EMBUDO: window.dqPaso(e, j) manda un beacon a /mmo/ev UNA vez por sesion
//    (sessionStorage) con { e, j, ms, org, movil, tg }. ms es el tiempo desde
//    que abrio la pagina, salvo 'bienvenido' y 'mover': desde el clic en
//    entrar (-1 si entro directo, sin formulario). Si la pestaña se oculta
//    antes de 'mover', manda 'oculta' (abandono durante la carga).
// Todo va en try/catch: un fallo aqui nunca puede romper la pagina.
(function () {
  'use strict';
  var CLAVE = 'dq_origen', DIAS = 30, GRUPOS = { meta: 1, tg: 1, wa: 1, ref: 1, org: 1 };
  var limpio = function (v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); };
  var enTg = false;
  try { enTg = !!(window.TelegramWebviewProxy || window.parent !== window || (window.external && 'notify' in window.external)) || /tgWebApp/.test(location.hash + location.search); } catch (e) {}

  function leer() {
    try { var o = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (o && typeof o === 'object' && Date.now() - (o.t || 0) < DIAS * 86400000) return o; } catch (e) {}
    return null;
  }
  function grupo(o) {
    if (o.fbc || /^(fb|facebook|ig|instagram|meta|an|messenger|threads)/.test(o.s)) return 'meta';
    if (/^(tg|telegram)/.test(o.s)) return 'tg';
    if (/^(wa|whatsapp)/.test(o.s)) return 'wa';
    if (o.ref) return 'ref';
    if (o.tg) return 'tg';
    return 'org';
  }
  function startParam() {
    try { var w = window.Telegram && window.Telegram.WebApp; if (w && w.initDataUnsafe && w.initDataUnsafe.start_param) return limpio(w.initDataUnsafe.start_param); } catch (e) {}
    var m = /[?&#]tgWebAppStartParam=([^&#]+)/.exec(location.search + location.hash);
    return m ? limpio(decodeURIComponent(m[1])) : '';
  }
  // Captura (solo si no hay uno vigente: el primer toque manda).
  function capturar() {
    var o = leer();
    if (o) return o;
    var q = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { q[k.toLowerCase()] = v; }); } catch (e) {}
    var sp = startParam();
    // start_param 'premium' es un atajo a la tienda, no una invitacion.
    var ref = limpio((/^[a-z0-9]{6}$/i.exec(q.ref || '') || [])[0] || (sp && sp !== 'premium' ? sp : ''));
    o = { s: limpio(q.utm_source), c: limpio(q.utm_campaign), a: limpio(q.utm_content || q.utm_ad), fbc: limpio(q.fbclid), ref: ref, t: Date.now(), tg: enTg ? 1 : 0 };
    o.o = grupo(o);
    try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {}
    return o;
  }
  var origen = null;
  try { origen = capturar(); } catch (e) { origen = { o: 'org' }; }
  // Lo que usan los juegos: el grupo (src del 'hola') y el codigo de invitacion guardado.
  window.dqOrigen = function () {
    // En Telegram el start_param llega cuando carga su SDK: si aun no habia origen
    // propio (organico o solo "dentro de Telegram"), se completa ahora sin pisar un utm anterior.
    try { if (origen && !origen.ref && (origen.o === 'org' || origen.o === 'tg')) { var sp = startParam(); if (sp && sp !== 'premium') { origen.ref = sp; origen.o = 'ref'; localStorage.setItem(CLAVE, JSON.stringify(origen)); } } } catch (e) {}
    var g = origen && GRUPOS[origen.o] ? origen.o : 'org';
    return { src: g, ref: (origen && /^[a-z0-9]{6}$/.test(origen.ref || '')) ? origen.ref : '' };
  };

  // ── Modo anuncio ──
  // Quien llega de un anuncio (fbclid / utm_* en esta visita, la marca de la
  // portada dq_anuncio=1 en la pestaña, o primer toque 'meta' de menos de 30
  // dias) juega sin la parte cripto: <html class="anuncio"> y cada pagina
  // OCULTA mTON, wallet y pagos SOL/$DUENDE. Solo presentacion: no borra nada.
  var anuncio = false;
  try {
    anuncio = /[?&](fbclid|utm_[a-z]+)=/i.test(location.search);
    try { if (anuncio) sessionStorage.setItem('dq_anuncio', '1'); else anuncio = sessionStorage.getItem('dq_anuncio') === '1'; } catch (e) {}
    if (!anuncio && origen && origen.o === 'meta') anuncio = true;
    if (anuncio) document.documentElement.classList.add('anuncio');
  } catch (e) {}
  window.dqAnuncio = function () { return anuncio; };

  // ── Embudo ──
  var EVENTOS = { carga_ini: 1, arte_ok: 1, form_visto: 1, clic_entrar: 1, bienvenido: 1, mover: 1, fallo_webgl: 1, oculta: 1 };
  var hechos = {}, clicT = -1, juego = '';
  var movil = false;
  try { movil = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch (e) {}
  window.dqPaso = function (e, j) {
    try {
      if (!EVENTOS[e] || (j !== 'origins' && j !== 'classic')) return;
      var k = j + ':' + e;
      if (hechos[k]) return;
      hechos[k] = 1;
      juego = j;
      var ahora = Math.round(performance.now());
      if (e === 'clic_entrar') clicT = ahora;
      var ss = 'dq_ev_' + k;
      try { if (sessionStorage.getItem(ss)) return; sessionStorage.setItem(ss, '1'); } catch (er) {}
      var ms = (e === 'bienvenido' || e === 'mover') ? (clicT >= 0 ? ahora - clicT : -1) : ahora;
      var cuerpo = JSON.stringify({ e: e, j: j, ms: ms, org: window.dqOrigen().src, movil: movil ? 1 : 0, tg: enTg ? 1 : 0 });
      if (navigator.sendBeacon) navigator.sendBeacon('/mmo/ev', cuerpo);
      else fetch('/mmo/ev', { method: 'POST', body: cuerpo, keepalive: true }).catch(function () {});
    } catch (er) {}
  };
  // Se va (o minimiza) antes de moverse por primera vez: abandono en la carga.
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && juego && !hechos[juego + ':mover']) window.dqPaso('oculta', juego);
    });
  } catch (e) {}
})();
