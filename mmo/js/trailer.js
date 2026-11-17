// ═══════════════════════════════════════════════════════
// Modo trailer de CLASSIC (2D): /mmo/?trailer=1, SOLO en el servidor local
// (localhost / 127.0.0.1). client.js lo carga con import() solo entonces: un
// jugador normal nunca baja este archivo ni nota nada.
//
//   ?trailer=1                 limpia la pantalla y juega solo (escena auto)
//   &escena=boss|captura|auto  qué coreografía repite
//   &zoom=1.25                 acercamiento de la cámara (por defecto 1.25)
//
// El "director" juega con las MISMAS teclas que un jugador (eventos de
// teclado sobre window): el servidor sigue decidiendo el daño, la captura y
// todo lo demás. Preparar la escena (nivel, jefe cerca, vida) lo hace el
// grabador con /__dev del servidor local (scripts/record-clips.mjs).
//
// Cuando el arte está cargado y el personaje ya está en el mapa:
//   window.__TRAILER_READY__ = true
// y window.__TRAILER__ = { escena(nombre), parar() } para el grabador.
// ═══════════════════════════════════════════════════════

export function iniciarTrailer(api) {
  const q = new URLSearchParams(location.search);
  const ZOOM = Math.min(2, Math.max(1, +q.get('zoom') || 1.25));
  let escena = q.get('escena') || 'auto';
  window.__TRAILER_READY__ = false;

  // ── Pantalla limpia: solo el lienzo (ahí van ya los números de daño, los
  // nombres y las partículas). El lienzo ocupa toda la ventana.
  document.body.classList.add('trailer');
  const css = document.createElement('style');
  css.textContent = `
    body.trailer *{visibility:hidden!important}
    body.trailer #escena,body.trailer #gc{visibility:visible!important}
    body.trailer #pie,body.trailer #tactil{display:none!important}
    body.trailer #escena{position:fixed!important;inset:0!important;overflow:hidden!important;z-index:1}
    body.trailer #gc{will-change:transform}
    body.trailer{cursor:none}
    body.trailer.trailer-v #escena{bottom:16%!important}`;
  document.head.appendChild(css);
  // En vertical el suelo del mapa queda pegado al borde de abajo, justo donde
  // TikTok/Reels ponen su texto: la escena sube un 16 % y esa franja se pinta
  // con el color del suelo (se mira cada segundo en la última fila del lienzo).
  if (innerHeight > innerWidth * 1.1) {
    document.body.classList.add('trailer-v');
    setInterval(() => {
      try {
        const d = api.cv.getContext('2d').getImageData(api.cv.width >> 1, api.cv.height - 2, 1, 1).data;
        const c = `rgb(${d[0]},${d[1]},${d[2]})`, os = `rgb(${d[0] * 0.35 | 0},${d[1] * 0.35 | 0},${d[2] * 0.35 | 0})`;
        document.documentElement.style.background = `linear-gradient(180deg,${c} 84%,${os} 100%)`;
      } catch (e) {}
    }, 1000);
  }
  setTimeout(() => { try { api.ajustarVista(); } catch (e) {} }, 50);

  // ── Teclas sintéticas (las mismas que lee client.js) ──
  const abajo = new Set();
  const tecla = (code, on) => {
    if (on && abajo.has(code)) return;
    if (on) abajo.add(code); else abajo.delete(code);
    dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  };
  const pulsar = (code, ms = 60) => { tecla(code, true); setTimeout(() => tecla(code, false), ms); };
  const soltarTodo = () => { for (const c of [...abajo]) tecla(c, false); };

  // ── Zoom cinematográfico: escala el lienzo (CSS, nítido porque ya es pixel
  // art) y lo desplaza para dejar al duende centrado y a ~70 % del alto, sin
  // asomar nunca el borde del lienzo. Va en su propio rAF, con suavizado.
  const cv = api.cv;
  let ox = null, oy = 0;
  const zoom = () => {
    requestAnimationFrame(zoom);
    if (!api.yo) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const px = (api.P.x - api.camX) / api.VW * w;
    const py = (api.P.y + api.OY - 30) / cv.height * h;   // un poco por encima de los pies
    const tx = Math.min(0, Math.max(w - ZOOM * w, w / 2 - ZOOM * px));
    const ty = Math.min(0, Math.max(h - ZOOM * h, h * 0.7 - ZOOM * py));
    if (ox === null) { ox = tx; oy = ty; }
    ox += (tx - ox) * 0.06; oy += (ty - oy) * 0.06;
    cv.style.transformOrigin = '0 0';
    cv.style.transform = 'translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px) scale(' + ZOOM + ')';
  };
  requestAnimationFrame(zoom);

  // ── Director ──
  const vivo = o => o && !o.muereT && o.hp > 0;
  const dist = o => Math.abs(o.x - api.P.x);
  function elegir(soloJefe, sinJefe) {
    let mejor = null, md = 1e9;
    for (const o of api.mons.values()) {
      if (!vivo(o)) continue;
      const j = api.esJefe(o);
      if (soloJefe && !j) continue;
      if (sinJefe && (j || o.ex)) continue;
      const d = dist(o);
      if (d < md) { md = d; mejor = o; }
    }
    return mejor;
  }
  let t = 0, ultGolpe = 0, ultHab = 0, nHab = 0, ultSalto = 0, ultRed = 0;
  function pasoDirector() {
    if (!api.yo || api.P.muerto) { soltarTodo(); return; }
    try { api.cerrarModales(); } catch (e) {}
    t += 100;
    const ahora = performance.now();
    const modo = escena === 'auto' ? (elegir(true) ? 'boss' : 'captura') : escena;
    const o = modo === 'boss' ? (elegir(true) || elegir(false)) : elegir(false, true);
    if (!o) {   // nadie a la vista: pasea hacia la derecha con algún salto
      tecla('ArrowLeft', false); tecla('ArrowRight', true);
      if (ahora - ultSalto > 1400) { pulsar('ArrowUp', 180); ultSalto = ahora; }
      return;
    }
    const ob = api.objetivo;
    if (!ob || ob.k !== 'm' || ob.id !== o.id) api.objetivo = { k: 'm', id: o.id };
    const dx = o.x - api.P.x, lejos = Math.abs(dx) > (modo === 'boss' ? 95 : 70);
    if (lejos) {
      tecla(dx > 0 ? 'ArrowLeft' : 'ArrowRight', false);
      tecla(dx > 0 ? 'ArrowRight' : 'ArrowLeft', true);
      if (Math.abs(dx) > 260 && ahora - ultSalto > 900) { pulsar('KeyX'); ultSalto = ahora; }   // dash para llegar antes
      return;
    }
    tecla('ArrowLeft', false); tecla('ArrowRight', false);
    // (El golpe ya gira al duende hacia el monstruo: client.js atacar.)
    // Captura: con el monstruo débil, la red (el servidor tira el dado).
    if (modo === 'captura' && o.mx > 0 && o.hp <= o.mx * 0.33 && ahora - ultRed > 6500) { pulsar('KeyC'); ultRed = ahora; return; }
    if (modo === 'captura' && o.mx > 0 && o.hp <= o.mx * 0.33) return;   // espera la red, no lo mates
    if (ahora - ultGolpe > 340) { pulsar('KeyZ', 50); ultGolpe = ahora; }
    if (ahora - ultHab > (modo === 'boss' ? 1100 : 1900)) { pulsar('Digit' + (1 + (nHab++ % 4))); ultHab = ahora; }
    if (modo === 'boss' && ahora - ultSalto > 2600) { pulsar('ArrowUp', 220); ultSalto = ahora; }
  }
  let reloj = 0;
  const arrancar = () => { if (!reloj) reloj = setInterval(pasoDirector, 100); };

  window.__TRAILER__ = {
    escena(n) { escena = n || 'auto'; soltarTodo(); arrancar(); return escena; },
    parar() { clearInterval(reloj); reloj = 0; soltarTodo(); },
    get zoom() { return ZOOM; },
  };

  // ── Listo para grabar: arte cargado, personaje con clase en el mapa y un
  // respiro para que lleguen la primera foto y los fondos.
  const listo = () => {
    if (api.yo && api.yo.clase && api.cargado() && !document.querySelector('#m-inicio.on,#m-clase.on')) {
      setTimeout(() => { if (!q.has('quieto')) arrancar(); window.__TRAILER_READY__ = true; }, 1500);   // &quieto=1: el grabador da la orden
      return;
    }
    setTimeout(listo, 200);
  };
  listo();
}
