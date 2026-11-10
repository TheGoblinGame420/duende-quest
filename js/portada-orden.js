// Portada más corta y fácil de recorrer (10-nov-2026).
// - Agrupa en bloques plegables la tienda/skins y la zona $DUENDE (token, hoja de ruta, donaciones).
//   No borra nada: cada sección sigue con su id y se abre sola si alguien llega por un enlace (#tokenomics, #nft-store...).
// - En celular: barra de secciones bajo el menú y botón flotante "Jugar gratis" al pasar la portada.
// Sin JavaScript la página queda exactamente como antes.
(function () {
  'use strict';
  var d = document, raiz = d.documentElement;
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = [
    '.pliegue{max-width:1100px;margin:1.2rem auto;padding:0 1rem}',
    '.pliegue>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.9rem;padding:1.1rem 1.2rem;background:var(--panel);border:1px solid var(--borde);border-radius:14px;box-shadow:0 6px 0 rgba(0,0,0,.35);transition:transform .15s steps(3),box-shadow .15s steps(3)}',
    '.pliegue>summary::-webkit-details-marker{display:none}',
    '.pliegue>summary:hover{transform:translateY(-2px);box-shadow:0 8px 0 rgba(0,0,0,.35)}',
    '.pliegue>summary:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.35)}',
    '.pliegue-ico{font-size:30px;line-height:1;image-rendering:pixelated}',
    '.pliegue-t{font-family:var(--px);font-size:clamp(11px,2.6vw,14px);line-height:1.6;color:var(--txt)}',
    '.pliegue-d{display:block;margin-top:.25rem;font-size:.9rem;color:var(--txt2)}',
    '.pliegue-flecha{font-family:var(--px);font-size:12px;color:var(--oro);white-space:nowrap}',
    '.pliegue[open]>summary .pliegue-flecha{color:var(--txt2)}',
    '.pliegue[open]>summary{border-color:var(--oro)}',
    // Al abrir, el contenido "carga" como un nivel de juego: aparece por pasos
    '.pliegue[open]>.pliegue-cuerpo{animation:pliegue-abre .45s steps(6) both}',
    '@keyframes pliegue-abre{from{opacity:0;clip-path:inset(0 0 100% 0)}to{opacity:1;clip-path:inset(0)}}',
    '.pliegue-cuerpo>.section{padding-left:0;padding-right:0}',
    '.pliegue-cerrar{display:block;margin:0 auto 1rem;font-family:var(--px);font-size:11px;background:none;border:1px solid var(--borde);color:var(--txt2);border-radius:8px;padding:.6rem 1rem;cursor:pointer}',
    // Barra de secciones (solo celular)
    '.secciones{display:none}',
    '@media(max-width:820px){.secciones{display:flex;gap:.45rem;overflow-x:auto;scrollbar-width:none;position:fixed;left:0;right:0;top:var(--alto-nav,56px);z-index:90;transform:translateY(-120%);transition:transform .25s steps(4);padding:.55rem .8rem;background:rgba(11,15,23,.94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-bottom:1px solid var(--borde)}',
    '.secciones.ver{transform:none}',
    '.secciones::-webkit-scrollbar{display:none}',
    '.secciones a{flex:none;font-size:.85rem;font-weight:700;color:var(--txt2);text-decoration:none;padding:.4rem .8rem;border:1px solid var(--borde);border-radius:999px;transition:color .15s,border-color .15s}',
    '.secciones a.activa{color:#0b0f17;background:var(--oro);border-color:var(--oro)}}',
    // Botón flotante
    '.jugar-flota{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:52px;border-radius:12px;background:var(--pri);color:#fff;font-weight:800;font-size:1.05rem;text-decoration:none;box-shadow:0 6px 0 var(--pri2),0 12px 30px rgba(0,0,0,.5);transform:translateY(160%);transition:transform .3s steps(5)}',
    '.jugar-flota.ver{transform:none}',
    '.jugar-flota:active{transform:translateY(4px);box-shadow:0 2px 0 var(--pri2)}',
    '@media(min-width:821px){.jugar-flota{display:none}}',
    '@media(prefers-reduced-motion:reduce){.pliegue[open]>.pliegue-cuerpo,.jugar-flota,.pliegue>summary{animation:none;transition:none}}'
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

  function iniciar() {
    plegar(['nfts', 'boosters', 'arsenal', 'nft-store'], '🛡️', 'Tienda, skins y potenciadores',
      'Todo opcional: el juego completo es gratis. Mira skins, armas, cofres y sus precios.', 'bloque-tienda');
    plegar(['trust', 'tokenomics', 'exchange', 'roadmap', 'donate'], '🪙', 'Zona $DUENDE',
      'El token es opcional para jugar. Transparencia, hoja de ruta y cómo apoyar el proyecto.', 'bloque-duende');
    var bt = d.getElementById('bloque-tienda'), bd = d.getElementById('bloque-duende');
    if (bt && bd && (bd.compareDocumentPosition(bt) & Node.DOCUMENT_POSITION_FOLLOWING)) bt.insertAdjacentElement('afterend', bd);

    // Un enlace a una sección plegada la abre antes de bajar hasta ella
    function abrirDestino(hash) {
      if (!hash || hash.length < 2) return false;
      var el; try { el = d.querySelector(hash); } catch (e) { return false; }
      var det = el && el.closest('details.pliegue');
      if (!det) return false;
      det.open = true;
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
    var lista = [['que-es', 'El juego'], ['capturas', 'Capturas'], ['empieza', 'Empieza'], ['ranking', 'Ranking'], ['community', 'Comunidad'], ['bloque-tienda', 'Tienda'], ['faq', 'Preguntas']]
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
