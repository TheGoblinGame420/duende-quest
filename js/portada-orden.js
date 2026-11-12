// Portada más corta y fácil de recorrer (10-nov-2026).
// - Agrupa en bloques plegables la tienda/skins y la zona $DUENDE (token, hoja de ruta, donaciones).
//   No borra nada: cada sección sigue con su id y se abre sola si alguien llega por un enlace (#tokenomics, #nft-store...).
// - En celular: barra de secciones bajo el menú y botón flotante "Jugar gratis" al pasar la portada.
// - Desde el 11-nov-2026 (portada de memecoin con juego): el token va arriba y a la vista, en pestañas
//   (contrato y transparencia, tokenomics, hoja de ruta); el canje y el apoyo quedan plegados al final.
//   En modo anuncio (html.anuncio) todo eso está oculto por CSS y aquí no se arma nada con ello.
// - Botones [data-copiar]: copian la dirección del contrato.
// Sin JavaScript la página queda en el orden del HTML, con todo desplegado.
(function () {
  'use strict';
  var d = document, raiz = d.documentElement;
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = [
    '.pliegue{max-width:1100px;margin:1.2rem auto;padding:0 1rem}',
    '.pliegue>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.9rem;padding:1.1rem 1.2rem;background:var(--panel);border:1px solid var(--borde);border-radius:16px;box-shadow:0 10px 30px rgba(3,1,12,.45);transition:transform .15s,border-color .15s}',
    '.pliegue>summary::-webkit-details-marker{display:none}',
    '.pliegue>summary:hover{transform:translateY(-2px);border-color:var(--oro)}',
    '.pliegue>summary:active{transform:translateY(1px)}',
    '.pliegue-ico{font-size:30px;line-height:1;color:var(--oro)}',
    '.pliegue-t{font-family:var(--px);font-weight:800;font-size:clamp(16px,2.6vw,20px);line-height:1.3;letter-spacing:.02em;color:var(--txt)}',
    '.pliegue-d{display:block;margin-top:.25rem;font-size:.92rem;line-height:1.45;color:var(--txt2)}',
    '.pliegue-flecha{font:700 14px var(--sans);color:var(--oro);white-space:nowrap}',
    '.pliegue[open]>summary .pliegue-flecha{color:var(--txt2)}',
    '.pliegue[open]>summary{border-color:var(--oro)}',
    // Al abrir, el contenido "carga" como un nivel de juego: aparece por pasos
    '.pliegue[open]>.pliegue-cuerpo{animation:pliegue-abre .35s ease-out both}',
    '@keyframes pliegue-abre{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(0)}}',
    '.pliegue-cuerpo>.section{padding-left:0;padding-right:0}',
    '.pliegue-cerrar{display:block;margin:0 auto 1rem;font:600 14px var(--sans);min-height:44px;background:none;border:1px solid var(--borde);color:var(--txt2);border-radius:10px;padding:.6rem 1.1rem;cursor:pointer}',
    // Barra de secciones (solo celular)
    '.secciones{display:none}',
    '@media(max-width:1180px){.secciones{display:flex;gap:.45rem;overflow-x:auto;scrollbar-width:none;position:fixed;left:0;right:0;top:var(--alto-nav,56px);z-index:90;transform:translateY(-120%);transition:transform .25s ease;padding:.55rem .8rem;background:rgba(12,11,15,.94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-bottom:1px solid var(--borde)}',
    '.secciones.ver{transform:none}',
    '.secciones::-webkit-scrollbar{display:none}',
    '.secciones a{flex:none;display:inline-flex;align-items:center;min-height:40px;font-size:.85rem;font-weight:700;color:var(--txt2);text-decoration:none;padding:.4rem .85rem;border:1px solid var(--borde);border-radius:999px;transition:color .15s,border-color .15s}',
    '.secciones a.activa{color:#1b1305;background:var(--oro);border-color:var(--oro)}}',
    // Botón flotante
    '.jugar-flota{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;border-radius:14px;background:linear-gradient(180deg,#f9d877,#e8b03a);color:#1b1305;font-weight:800;font-size:1.05rem;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 12px 30px rgba(0,0,0,.55);transform:translateY(160%);transition:transform .3s steps(5)}',
    '.jugar-flota.ver{transform:none}',
    '.jugar-flota:active{transform:translateY(2px)}',
    '@media(min-width:821px){.jugar-flota{display:none}}',
    // Pestañas: varias secciones en el espacio de una
    '.pestanas{max-width:1120px;margin:0 auto;padding:3.4rem 1rem .6rem;scroll-margin-top:84px}',
    '.pestanas-t{font-family:var(--px);font-weight:800;font-size:clamp(25px,3.8vw,40px);line-height:1.15;letter-spacing:.02em;text-align:center;color:var(--txt);margin-bottom:1.3rem}',
    '.pestanas-t::after{content:"";display:block;width:56px;height:3px;border-radius:3px;margin:.8rem auto 0;background:linear-gradient(90deg,#c9962a,var(--oro))}',
    /* Dentro de una pestaña el título de la sección repite el de la pestaña: queda más chico y sin filete */
    '.pestanas-panel>.section>.px-title{font-size:clamp(19px,2.6vw,24px)}',
    '.pestanas-panel>.section>.px-title::after{display:none}',
    '.pestanas-lista{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;justify-content:center;padding:.2rem .1rem .6rem}',
    '.pestanas-lista::-webkit-scrollbar{display:none}',
    '@media(max-width:600px){.pestanas-lista{justify-content:flex-start}}',
    '.pestana{flex:none;font:700 14.5px/1.3 var(--sans);min-height:44px;color:var(--txt2);background:var(--panel);border:1px solid var(--borde);border-radius:999px;padding:.6rem 1.1rem;cursor:pointer;transition:color .15s,border-color .15s,background .15s}',
    '.pestana:hover{color:var(--txt);border-color:var(--oro)}',
    '.pestana[aria-selected="true"]{color:#1b1305;background:var(--oro);border-color:var(--oro)}',
    '.pestanas-panel>.section{padding-top:1rem}',
    '.pestanas-panel>.section.entra{animation:pestana-entra .3s ease-out both}',
    '@keyframes pestana-entra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@media(prefers-reduced-motion:reduce){.pliegue[open]>.pliegue-cuerpo,.jugar-flota,.pliegue>summary,.pestanas-panel>.section.entra{animation:none;transition:none}}'
  ].join('\n');
  var st = d.createElement('style'); st.textContent = css; d.head.appendChild(st);

  // ---------- Bloques plegables ----------
  function plegar(ids, ico, titulo, desc, idBloque) {
    var secs = ids.map(function (id) { return d.getElementById(id); }).filter(Boolean);
    if (!secs.length) return null;
    var det = d.createElement('details');
    det.className = 'pliegue'; det.id = idBloque;
    det.innerHTML = '<summary><span class="pliegue-ico" aria-hidden="true">' + ico + '</span><span><span class="pliegue-t">' + titulo +
      '</span><span class="pliegue-d">' + desc + '</span></span><span class="pliegue-flecha">Ver +</span></summary><div class="pliegue-cuerpo"></div>';
    secs[0].parentNode.insertBefore(det, secs[0]);
    var cuerpo = det.querySelector('.pliegue-cuerpo');
    secs.forEach(function (s) { cuerpo.appendChild(s); });
    var cerrar = d.createElement('button');
    cerrar.type = 'button'; cerrar.className = 'pliegue-cerrar'; cerrar.textContent = 'Cerrar ' + titulo.toLowerCase();
    cerrar.addEventListener('click', function () { det.open = false; det.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' }); });
    cuerpo.appendChild(cerrar);
    det.addEventListener('toggle', function () {
      det.querySelector('.pliegue-flecha').textContent = det.open ? 'Cerrar x' : 'Ver +';
      // Las secciones con aparición al bajar ya están en pantalla al abrir
      if (det.open) cuerpo.querySelectorAll('.reveal').forEach(function (r) { r.classList.add('visible'); });
    });
    // Si todo lo de adentro está oculto (p. ej. visitas desde anuncios, sin parte cripto), el bloque tampoco se muestra
    var visibles = secs.filter(function (s) { return getComputedStyle(s).display !== 'none'; });
    if (!visibles.length) det.hidden = true;
    return det;
  }

  // ---------- Pestañas ----------
  function pestanas(items, titulo, idBloque) {
    var secs = items.map(function (x) { return [d.getElementById(x[0]), x[1]]; })
      .filter(function (x) { return x[0] && getComputedStyle(x[0]).display !== 'none'; });
    if (secs.length < 2) return null;
    var cont = d.createElement('section');
    cont.className = 'pestanas'; cont.id = idBloque; cont.setAttribute('aria-label', titulo);
    cont.innerHTML = '<h2 class="pestanas-t">' + titulo + '</h2><div class="pestanas-lista" role="tablist"></div><div class="pestanas-panel"></div>';
    secs[0][0].parentNode.insertBefore(cont, secs[0][0]);
    var lista = cont.querySelector('.pestanas-lista'), panel = cont.querySelector('.pestanas-panel');
    secs.forEach(function (x, i) {
      var sec = x[0], b = d.createElement('button');
      b.type = 'button'; b.className = 'pestana'; b.setAttribute('role', 'tab'); b.id = 'tab-' + sec.id;
      b.setAttribute('aria-controls', sec.id); b.textContent = x[1];
      sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-labelledby', b.id);
      lista.appendChild(b); panel.appendChild(sec);
      b.addEventListener('click', function () { activar(sec.id, true); });
    });
    function activar(id, animar) {
      secs.forEach(function (x) {
        var on = x[0].id === id, b = d.getElementById('tab-' + x[0].id);
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
        x[0].hidden = !on;
        if (on) {
          x[0].querySelectorAll('.reveal').forEach(function (r) { r.classList.add('visible'); });
          if (animar) { x[0].classList.remove('entra'); void x[0].offsetWidth; x[0].classList.add('entra'); }
          if (lista.scrollWidth > lista.clientWidth) lista.scrollTo({ left: b.offsetLeft - (lista.clientWidth - b.offsetWidth) / 2, behavior: (quieto || !animar) ? 'auto' : 'smooth' });
        }
      });
    }
    // Flechas del teclado entre pestañas
    lista.addEventListener('keydown', function (e) {
      var bs = [].slice.call(lista.children), i = bs.indexOf(d.activeElement);
      if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var j = (i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length; bs[j].focus(); bs[j].click();
    });
    activar(secs[0][0].id, false);
    cont._activar = activar;
    return cont;
  }

  function iniciar() {
    // El token, a la vista y en pestañas (en modo anuncio las tres secciones están ocultas y no se arma)
    pestanas([['trust', 'Contrato y transparencia'], ['tokenomics', 'Tokenomics'], ['roadmap', 'Hoja de ruta']], 'El token $DUENDE', 'bloque-token');
    // El juego: qué es, tráiler, capturas y modo arcade en un solo bloque
    pestanas([['que-es', 'Qué es'], ['trailer', 'Tráiler'], ['capturas', 'Capturas'], ['game', 'Modo arcade']], 'Conoce el juego', 'bloque-juego');
    // Comunidad: Telegram, ranking y canales oficiales
    pestanas([['ranking', 'Ranking'], ['telegram', 'Telegram'], ['community', 'Canales oficiales']], 'Comunidad', 'bloque-comunidad');
    plegar(['nfts', 'boosters', 'arsenal', 'nft-store'], '🛡', 'Tienda, skins y potenciadores',
      'Todo opcional: el juego completo es gratis. Mira skins, armas, cofres y sus precios.', 'bloque-tienda');
    plegar(['exchange', 'donate'], '🪙', 'Comprar directo, canjear y apoyar',
      'Todo opcional. Compra $DUENDE directo al creador, canjea o dona para que el juego siga creciendo.', 'bloque-duende');
    var bt = d.getElementById('bloque-tienda'), bd = d.getElementById('bloque-duende');
    if (bt && bd && (bd.compareDocumentPosition(bt) & Node.DOCUMENT_POSITION_FOLLOWING)) bt.insertAdjacentElement('afterend', bd);
    // Orden: los dos juegos, el token (utilidad, cómo comprar, datos), el juego en detalle, comunidad, tienda y preguntas
    var orden = ['juegos', 'utilidad', 'como-comprar', 'bloque-token', 'lo-nuevo', 'bloque-juego', 'empieza', 'bloque-comunidad', 'bloque-tienda', 'bloque-duende', 'faq']
      .map(function (id) { return d.getElementById(id); }).filter(Boolean);
    for (var k = 1; k < orden.length; k++) orden[k - 1].insertAdjacentElement('afterend', orden[k]);

    // ---------- Celular: lo secundario queda plegado (12-nov-2026) ----------
    // En pantallas de hasta 700 px los pasos y las novedades muestran solo el título (se abren con un toque)
    // y el detalle de transparencia y tokenomics va en un bloque que se despliega. El contrato, el botón de
    // jugar y los avisos de riesgo quedan siempre a la vista. En escritorio todo sigue desplegado.
    var cel = matchMedia('(max-width:700px)'), plgBotones = [], plgGrupos = [];
    function plegarItems(selItems, selCabeza, abierto) {
      [].forEach.call(d.querySelectorAll(selItems), function (it, i) {
        var cab = it.querySelector(selCabeza);
        if (!cab || it.classList.contains('plg')) return;
        var cuerpos = [].filter.call(cab.parentNode.children, function (x) { return x !== cab && x.tagName === 'P'; });
        if (!cuerpos.length) return;
        cuerpos.forEach(function (c) { c.classList.add('plg-c'); });
        var b = d.createElement('button'); b.type = 'button'; b.className = 'plg-btn';
        while (cab.firstChild) b.appendChild(cab.firstChild);
        cab.appendChild(b);
        it.classList.add('plg');
        if (i === abierto) it.classList.add('plg-ab');
        b.addEventListener('click', function () { if (!cel.matches) return; it.classList.toggle('plg-ab'); sincPlegado(); });
        plgBotones.push([b, it]);
      });
    }
    function plegarGrupo(idSec, selDesde, selHasta, titulo) {
      var s = d.getElementById(idSec); if (!s) return;
      var a = s.querySelector(selDesde), z = s.querySelector(selHasta);
      if (!a || !z || a.parentNode !== s || z.parentNode !== s) return;
      var det = d.createElement('details'); det.className = 'plg-grupo';
      var sum = d.createElement('summary'); sum.textContent = titulo; det.appendChild(sum);
      s.insertBefore(det, a);
      for (var n = a; n && n !== z;) { var sig = n.nextSibling; det.appendChild(n); n = sig; }
      plgGrupos.push(det);
    }
    function sincPlegado() {
      plgBotones.forEach(function (x) {
        if (cel.matches) { x[0].setAttribute('aria-expanded', String(x[1].classList.contains('plg-ab'))); x[0].tabIndex = 0; }
        else { x[0].removeAttribute('aria-expanded'); x[0].tabIndex = -1; }
      });
    }
    function sincGrupos() { plgGrupos.forEach(function (g) { g.open = !cel.matches; }); }
    plegarItems('#como-comprar .compra-pasos > li', 'h3', -1);
    plegarItems('#empieza .pasos > li', 'h3', -1);
    plegarItems('#lo-nuevo .nuevo-card', 'b', -1);
    plegarItems('#utilidad .util-card', 'h3', -1);
    plegarItems('#que-es .about-card', 'h3', -1);
    plegarGrupo('trust', '.trust-grid', '.legal-note', 'Liquidez, impuestos, holders y enlaces para verificar');
    plegarGrupo('tokenomics', '.tgrid', '.sec-line', 'Supply, lanzamiento y permisos, en detalle');
    sincPlegado(); sincGrupos();
    var alCambiar = function () { sincPlegado(); sincGrupos(); };
    if (cel.addEventListener) cel.addEventListener('change', alCambiar); else if (cel.addListener) cel.addListener(alCambiar);

    // Un enlace a una sección plegada la abre antes de bajar hasta ella
    function abrirDestino(hash) {
      if (!hash || hash.length < 2) return false;
      var el; try { el = d.querySelector(hash); } catch (e) { return false; }
      if (!el) return false;
      var tab = el.closest('.pestanas'), det = el.closest('details.pliegue');
      if (tab && tab._activar && el.getAttribute('role') === 'tabpanel') tab._activar(el.id, true);
      else if (tab && tab._activar && el.closest('[role="tabpanel"]')) tab._activar(el.closest('[role="tabpanel"]').id, true);
      if (!det && !tab) return false;
      if (det) det.open = true;
      requestAnimationFrame(function () { el.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' }); });
      return true;
    }
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && abrirDestino(a.getAttribute('href'))) { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); }
    });
    addEventListener('hashchange', function () { abrirDestino(location.hash); });
    if (location.hash) abrirDestino(location.hash);

    // ---------- Barra de secciones en celular ----------
    var nav = d.querySelector('body > nav, nav[aria-label="Principal"]');
    var lista = [['juegos', 'Juegos'], ['utilidad', 'Utilidad'], ['como-comprar', 'Comprar'], ['bloque-token', 'Token'], ['lo-nuevo', 'Novedades'], ['bloque-juego', 'El juego'], ['empieza', 'Empieza'], ['bloque-comunidad', 'Comunidad'], ['bloque-tienda', 'Tienda'], ['faq', 'Preguntas']]
      .filter(function (x) { var el = d.getElementById(x[0]); return el && !el.hidden && getComputedStyle(el).display !== 'none'; });
    if (nav && lista.length) {
      var barra = d.createElement('div');
      barra.className = 'secciones'; barra.setAttribute('aria-label', 'Secciones');
      barra.innerHTML = lista.map(function (x) { return '<a href="#' + x[0] + '" data-sec="' + x[0] + '">' + x[1] + '</a>'; }).join('');
      nav.insertAdjacentElement('afterend', barra);
      var medir = function () { raiz.style.setProperty('--alto-nav', nav.getBoundingClientRect().height + 'px'); };
      medir(); addEventListener('resize', medir);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entradas) {
          entradas.forEach(function (en) {
            if (!en.isIntersecting) return;
            barra.querySelectorAll('a').forEach(function (a) { a.classList.toggle('activa', a.dataset.sec === en.target.id); });
            var act = barra.querySelector('a.activa');
            if (act) barra.scrollTo({ left: act.offsetLeft - 12, behavior: quieto ? 'auto' : 'smooth' });
          });
        }, { rootMargin: '-45% 0px -50% 0px' });
        lista.forEach(function (x) { io.observe(d.getElementById(x[0])); });
      }
    }

    // ---------- Copiar (dirección del contrato) ----------
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-copiar]');
      if (!b) return;
      var txt = b.getAttribute('data-copiar'), antes = b.getAttribute('data-txt') || b.textContent;
      b.setAttribute('data-txt', antes);
      var listo = function (ok) {
        b.textContent = ok ? '✓ Copiada' : 'No se pudo copiar'; b.classList.toggle('ok', ok);
        clearTimeout(b._t); b._t = setTimeout(function () { b.textContent = antes; b.classList.remove('ok'); }, 2000);
      };
      // Sin permiso del portapapeles (http, navegador viejo): selección + execCommand
      var plan = function () {
        try {
          var ta = d.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-99px;top:0;opacity:0';
          d.body.appendChild(ta); ta.select(); var ok = d.execCommand('copy'); ta.remove(); listo(ok);
        } catch (er) { listo(false); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { listo(true); }, plan); else plan();
    });

    // ---------- Botón flotante "Jugar gratis" ----------
    var hero = d.querySelector('section.hero');
    if (hero) {
      var flota = d.createElement('a');
      flota.className = 'jugar-flota'; flota.href = '/jugar/?web=1'; flota.innerHTML = '<span aria-hidden="true">▶</span> Jugar gratis ahora';
      d.body.appendChild(flota);
      var mostrar = function () {
        var pasado = hero.getBoundingClientRect().bottom < 0;
        var alFinal = innerHeight + scrollY > d.documentElement.scrollHeight - 300;
        flota.classList.toggle('ver', pasado && !alFinal);
        var b = d.querySelector('.secciones'); if (b) b.classList.toggle('ver', pasado);
      };
      addEventListener('scroll', mostrar, { passive: true }); mostrar();
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
