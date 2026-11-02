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
  /* iOS < 15.4 no trae Object.hasOwn: sin esto los modulos de CLASSIC y ORIGINS mueren al cargar */
  try { if (!Object.hasOwn) Object.hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); }; } catch (e) {}
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
  // start_param / startapp de la Mini App (t.me/duendequest_bot/jugar?startapp=...):
  //   ad_<campaña> → anuncio que llega por Telegram (s: tg_ad, c: campaña), sin invitacion
  //   mmo_<cod> / m3d_<cod> → invitacion de un amigo (ref: cod)
  //   <cod> de 6 → invitacion (enlaces viejos); 'premium' y lo demas no cuentan.
  function deSp(sp) {
    if (!sp || sp === 'premium') return null;
    var m = /^ad_([a-z0-9_]{1,40})$/.exec(sp);
    if (m) return { s: 'tg_ad', c: m[1], ref: '' };
    m = /^(?:mmo_|m3d_)?([a-z0-9]{6})$/.exec(sp);
    return m ? { s: '', c: '', ref: m[1] } : null;
  }
  // Captura (solo si no hay uno vigente: el primer toque manda).
  function capturar() {
    var o = leer();
    var q = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { q[k.toLowerCase()] = v; }); } catch (e) {}
    // fr/ft: el fbclid TAL CUAL (Meta lo necesita con mayusculas) y cuando llego.
    // Solo sale del navegador si acepta la medicion (dqOrigen().fbc y /js/medir.js).
    var fr = String(q.fbclid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 300);
    if (o) {
      if (fr.length >= 8 && !o.fr) { o.fr = fr; o.ft = Date.now(); try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch (e) {} }
      return o;
    }
    var sp = deSp(startParam()) || { s: '', c: '', ref: '' };
    var ref = limpio((/^[a-z0-9]{6}$/i.exec(q.ref || '') || [])[0] || sp.ref);
    o = { s: limpio(q.utm_source) || sp.s, c: limpio(q.utm_campaign) || sp.c, a: limpio(q.utm_content || q.utm_ad), fbc: limpio(q.fbclid), ref: ref, t: Date.now(), tg: enTg ? 1 : 0 };
    if (fr.length >= 8) { o.fr = fr; o.ft = o.t; }
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
    try {
      if (origen && !origen.ref && (origen.o === 'org' || origen.o === 'tg') && !origen.s) {
        var sp = deSp(startParam());
        if (sp) {
          if (sp.ref) { origen.ref = sp.ref; origen.o = 'ref'; }
          else { origen.s = sp.s; origen.c = sp.c; origen.o = 'tg'; }
          localStorage.setItem(CLAVE, JSON.stringify(origen));
        }
      }
    } catch (e) {}
    var g = origen && GRUPOS[origen.o] ? origen.o : 'org';
    // camp: utm_campaign (ya saneada) para el ROAS por campaña de /mmostats; el servidor la vuelve a sanear.
    // med/fbc: medicion de Meta (/js/medir.js). med 1 = acepto, 0 = la rechazo o retiro
    // (el servidor borra su fbc); fbc (id del clic del anuncio) SOLO con med 1 y fuera de Telegram.
    var med = window.dqMedirOk ? window.dqMedirOk() : undefined;
    var fbc = med === 1 && !enTg && origen && origen.fr ? 'fb.1.' + (origen.ft || origen.t || Date.now()) + '.' + origen.fr : undefined;
    // ad: utm_content (el video/anuncio de Meta), saneado igual: altas y D1 por anuncio en /mmostats.
    return { src: g, ref: (origen && /^[a-z0-9]{6}$/.test(origen.ref || '')) ? origen.ref : '', camp: (origen && origen.c) || '', ad: limpio(origen && origen.a), med: med, fbc: fbc };
  };
  // Consentimiento de la medicion de Meta: 1 acepto, 0 no, undefined aun no decide.
  window.dqMedirOk = function () {
    try { var v = localStorage.getItem('dq_medir'); return v === '1' ? 1 : v === '0' ? 0 : undefined; } catch (e) { return undefined; }
  };
  // /js/medir.js (aviso de consentimiento y pixel) solo para quien vino de un
  // anuncio de Meta o ya acepto, nunca dentro de Telegram ni si lo rechazo.
  // Sin META_PIXEL_ID en el servidor, medir.js no muestra nada ni carga nada de Meta.
  try {
    var okM = window.dqMedirOk();
    if (!enTg && okM !== 0 && (okM === 1 || (origen && (origen.o === 'meta' || origen.fr)))) {
      var sm = document.createElement('script');
      sm.src = '/js/medir.js?v=345'; sm.async = true;
      (document.head || document.documentElement).appendChild(sm);
    }
  } catch (e) {}

  // ── Modo anuncio ──
  // Quien llega de un anuncio (fbclid / utm_* en esta visita, la marca de la
  // portada dq_anuncio=1 en la pestaña, o primer toque 'meta' de menos de 30
  // dias) juega sin la parte cripto: <html class="anuncio"> y cada pagina
  // OCULTA mTON, wallet y pagos SOL/$DUENDE. Solo presentacion: no borra nada.
  var anuncio = false;
  try {
    anuncio = /[?&](fbclid|utm_[a-z]+|ad)=/i.test(location.search) || /^\/jugar(\/|$)/.test(location.pathname);
    try { if (anuncio) sessionStorage.setItem('dq_anuncio', '1'); else anuncio = sessionStorage.getItem('dq_anuncio') === '1'; } catch (e) {}
    if (!anuncio && origen && origen.o === 'meta') anuncio = true;
    // Anuncio que llego por el bot (/start ad_ o startapp=ad_): tambien sin cripto.
    if (!anuncio && origen && origen.s === 'tg_ad') anuncio = true;
    if (anuncio) document.documentElement.classList.add('anuncio');
    // La pestaña tampoco dice "$DUENDE ORIGINS/CLASSIC" (el <title> puede ir antes o despues de este script).
    if (anuncio) {
      var tit = function () { try { if (/\$DUENDE/.test(document.title)) document.title = document.title.replace(/\$DUENDE/g, 'Duende Quest'); } catch (e) {} };
      tit(); document.addEventListener('DOMContentLoaded', tit);
    }
  } catch (e) {}
  window.dqAnuncio = function () { return anuncio; };

  // ── Embudo ──
  var EVENTOS = { carga_ini: 1, arte_ok: 1, form_visto: 1, clic_entrar: 1, bienvenido: 1, mover: 1, fallo_webgl: 1, oculta: 1, t_hab: 1, t_volar: 1, t_fin: 1,
    mis_0: 1, mis_1: 1, mis_2: 1, mis_3: 1, mis_4: 1, mis_5: 1, jefe1_ver: 1, jefe1_muere: 1, jefe1_ok: 1,
    fps_baja_ok: 1, fps_baja_justo: 1, fps_baja_lento: 1, fps_media_ok: 1, fps_media_justo: 1, fps_media_lento: 1, fps_alta_ok: 1, fps_alta_justo: 1, fps_alta_lento: 1,
    gpu_mali: 1, gpu_adreno: 1, gpu_powervr: 1, gpu_apple: 1, gpu_intel: 1, gpu_swiftshader: 1, gpu_otra: 1, fuga_gpu: 1, nan_pos: 1 };
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
