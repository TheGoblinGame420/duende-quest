// ═══════════════════════════════════════════════════════
// INTERFAZ VIVA — inventario y botones con resorte, brillo por rareza,
// micro-interacciones y vibracion. Lo usan CLASSIC (mmo/js/client.js) y
// ORIGINS (mundo/js/ventanas.js). Es SOLO presentacion: no manda nada al
// servidor ni cambia textos, precios o reglas.
//
//   import * as vivo from '/js/vivo.js?v=N';
//   vivo.iniciar({ juego: '2d' | '3d', ligero: () => bool, tg: () => Telegram.WebApp | null });
//   vivo.abrir(modal)             al abrir una ventana (entrada escalonada de sus tarjetas)
//   vivo.alEquipar(boton)         la pieza vuela a su ranura ([data-ran="<ranura>"]) y la ranura destella
//   vivo.alVender(boton, oro, d)  una moneda salta al contador de oro (d: elemento o selector)
//   vivo.repintado()              tras repintar el inventario (destellos que esperaban al servidor)
//   vivo.fallo()                  el servidor dijo que no: sacudida corta de lo ultimo que se toco
//   vivo.vibrar(tipo | ms | patron)
//
// Las tarjetas son .item (2D) y .vv-item (3D); las de equipo llevan
// data-rz="0..3" (indice de RAREZAS en data.js), style="--rz:<color>" y data-s="<ranura>".
// Todo va con transform y opacity (lo compone la GPU, no repinta por cuadro).
// Con «modo ligero» (2D), graficos bajos (3D) o prefers-reduced-motion no hay
// animaciones: quedan los colores de rareza y la vibracion.
// ═══════════════════════════════════════════════════════
const doc = document, raiz = doc.documentElement;
const TACTIL = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const TARJ = '.item,.vv-item';
let op = { juego: '', ligero: () => false, tg: () => null };
let listo = false;

// ── Resorte amortiguado de verdad: x'' = -k (x - 1) - c x'. Se simula una vez y
// se pasa a linear() de CSS; quien no entiende linear() usa un cubic-bezier con rebote. ──
function resorte(k, c, puntos) {
  const dt = 1 / 240, m = [];
  let x = 0, v = 0, t = 0, quieto = 0;
  while (t < 2.5 && quieto < 20) {
    v += (-k * (x - 1) - c * v) * dt; x += v * dt; t += dt; m.push(x);
    quieto = Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.03 ? quieto + 1 : 0;
  }
  const p = [];
  for (let i = 0; i <= puntos; i++) p.push(i === 0 ? 0 : i === puntos ? 1 : +m[Math.min(m.length - 1, Math.round(i / puntos * (m.length - 1)))].toFixed(3));
  return { css: 'linear(' + p.join(',') + ')', ms: Math.round(t * 1000) };
}
const R_VENTANA = resorte(210, 19, 36);   // ventanas y tarjetas: un rebote corto
const R_BOTON = resorte(420, 17, 36);     // al soltar un boton o una ranura: mas vivo
const ESCALONES = 10, PASO_MS = 22;       // entrada escalonada: las 10 primeras de una en una, el resto juntas

// ── CSS (un solo sitio para los dos juegos) ──
function css() {
  let demoras = '';
  for (let i = 1; i <= ESCALONES; i++) demoras += `html.vivo [data-vivo-e] :is(.item,.vv-item,.ranura,.vv-ranura):nth-child(${i}){animation-delay:${i * PASO_MS}ms}`;
  demoras += `html.vivo [data-vivo-e] :is(.item,.vv-item,.ranura,.vv-ranura):nth-child(n+${ESCALONES + 1}){animation-delay:${(ESCALONES + 1) * PASO_MS}ms}`;
  return `
:root{--vivo-r:cubic-bezier(.34,1.56,.64,1);--vivo-r-ms:420ms;--vivo-b:cubic-bezier(.34,1.7,.6,1);--vivo-b-ms:360ms;}
@supports (transition-timing-function:linear(0,1)){:root{--vivo-r:${R_VENTANA.css};--vivo-r-ms:${R_VENTANA.ms}ms;--vivo-b:${R_BOTON.css};--vivo-b-ms:${R_BOTON.ms}ms;}}

/* Tarjetas: luz que sigue al dedo o al puntero (--mx/--my las pone vivo.js) */
html.vivo :is(.item,.vv-item){position:relative;isolation:isolate;transition:transform var(--vivo-r-ms) var(--vivo-r),border-color .2s ease,box-shadow .25s ease;-webkit-tap-highlight-color:transparent;}
html.vivo :is(.item,.vv-item)::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s ease;background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--rz,var(--primary,#22e39a)) 22%,transparent),transparent 70%);}
html.vivo :is(.item,.vv-item).vivo-sobre::before{opacity:1;}
html.vivo :is(.item,.vv-item).vivo-pulsa{transform:scale(.982);transition-duration:.08s,.2s,.25s;transition-timing-function:ease-out,ease,ease;}

/* Rareza: borde, halo y un velo del color de la pieza (el texto queda encima, sin perder contraste) */
html.vivo :is(.item,.vv-item)[data-rz]:not([data-rz="0"]){border-color:color-mix(in srgb,var(--rz) 46%,var(--border,#213832));background-image:linear-gradient(100deg,color-mix(in srgb,var(--rz) 10%,transparent),transparent 58%);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rz) 12%,transparent),0 8px 20px -14px var(--rz);}
html.vivo .vv-item[data-rz]{border-left-color:var(--rz);}
html.vivo :is(.item,.vv-item)[data-rz]:not([data-rz="0"]).vivo-sobre{border-color:color-mix(in srgb,var(--rz) 78%,var(--border,#213832));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rz) 22%,transparent),0 10px 28px -12px var(--rz);}
html.vivo .vv-item[data-rz].vivo-sobre{border-left-color:var(--rz);}
html.vivo :is(.item,.vv-item)[data-rz="3"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rz) 20%,transparent),0 8px 26px -12px var(--rz),0 0 0 1px color-mix(in srgb,var(--rz) 18%,transparent);}
/* El recuadro del icono toma la luz de su rareza */
html.vivo :is(.item,.vv-item)[data-rz]:not([data-rz="0"]) :is(.ico,.vv-ico){background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--rz) 30%,transparent),rgba(0,0,0,.34) 72%);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rz) 38%,transparent);}
/* Epico y Legendario: un barrido de brillo de vez en cuando */
html.vivo :is(.item,.vv-item):is([data-rz="2"],[data-rz="3"]){overflow:hidden;}
html.vivo :is(.item,.vv-item):is([data-rz="2"],[data-rz="3"])::after{content:'';position:absolute;z-index:-1;top:-20%;bottom:-20%;left:0;width:36%;pointer-events:none;background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--rz) 24%,transparent) 42%,rgba(255,255,255,.10) 50%,color-mix(in srgb,var(--rz) 24%,transparent) 58%,transparent);transform:translateX(-150%) skewX(-14deg);animation:vivoBarrido 5.6s ease-in-out infinite;}
html.vivo :is(.item,.vv-item)[data-rz="3"]::after{animation-duration:3.8s;}
@keyframes vivoBarrido{0%,64%{transform:translateX(-150%) skewX(-14deg)}100%{transform:translateX(440%) skewX(-14deg)}}

/* Ranuras del equipo */
html.vivo :is(.ranura,.vv-ranura){position:relative;transition:transform var(--vivo-b-ms) var(--vivo-b),box-shadow .25s ease,border-color .2s ease;-webkit-tap-highlight-color:transparent;}
html.vivo :is(.ranura,.vv-ranura):not(.vacia):not(.sel){box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rz,transparent) 22%,transparent),0 0 16px -7px var(--rz,transparent);}
html.vivo :is(.ranura,.vv-ranura):not(.vacia):active{transform:scale(.9);transition-duration:.07s,.25s,.2s;transition-timing-function:ease-out,ease,ease;}
@media (hover:hover){html.vivo :is(.ranura,.vv-ranura):not(.vacia):hover{transform:translateY(-2px) scale(1.04);}}

/* Botones de las ventanas: se hunden al tocar y vuelven con rebote (la jerarquia de colores no cambia) */
html.vivo :is(.modal,.vv) .btn{transition:transform var(--vivo-b-ms) var(--vivo-b),background .2s ease,border-color .2s ease,box-shadow .2s ease;}
html.vivo :is(.modal,.vv) .btn:active:not(:disabled){transform:scale(.93);transition-duration:.07s,.2s,.2s,.2s;transition-timing-function:ease-out,ease,ease,ease;}
html.vivo :is(.modal,.vv) :is(.tab,.vv-chip){transition:transform var(--vivo-b-ms) var(--vivo-b),background .2s ease,color .2s ease,border-color .2s ease;}
html.vivo :is(.modal,.vv) :is(.tab,.vv-chip):active{transform:scale(.93);transition-duration:.07s,.2s,.2s,.2s;transition-timing-function:ease-out,ease,ease,ease;}
@media (pointer:coarse){html.vivo :is(.item,.vv-item) .btn{min-height:44px;}}

/* Ventanas: entran con resorte y salen con un fundido corto */
@keyframes vivoAbre{from{opacity:0;transform:translateY(16px) scale(.94)}}
@keyframes vivoFondo{from{opacity:0}}
html.vivo2d .modal.on{animation:vivoFondo .2s ease backwards;}
html.vivo2d .modal.on>.ventana{animation:vivoAbre var(--vivo-r-ms) var(--vivo-r) backwards;}
html.vivo3d .modal.on>.ventana.vv{animation:vivoAbre var(--vivo-r-ms) var(--vivo-r) backwards;}
@supports (transition-behavior:allow-discrete){
  html.vivo2d .modal,html.vivo3d .modal:has(>.ventana.vv){transition:opacity .15s ease,display .15s allow-discrete;}
  html.vivo2d .modal:not(.on),html.vivo3d .modal:has(>.ventana.vv):not(.on){opacity:0;pointer-events:none!important;}
  html.vivo2d .modal:not(.on)>.ventana,html.vivo3d .modal:not(.on)>.ventana.vv{transform:translateY(8px) scale(.97);transition:transform .15s ease;pointer-events:none!important;}
}
/* Tarjetas y ranuras: entrada escalonada solo al abrir (data-vivo-e dura un momento) */
@keyframes vivoEntra{from{opacity:0;transform:translateY(12px) scale(.96)}}
html.vivo [data-vivo-e] :is(.item,.vv-item,.ranura,.vv-ranura){animation:vivoEntra var(--vivo-r-ms) var(--vivo-r) backwards;}
${demoras}

/* Piezas sueltas que crea vivo.js (vuelo, moneda, +oro, anillo) */
.vivo-vuelo{position:fixed;left:0;top:0;z-index:2147482000;pointer-events:none;will-change:transform,opacity;image-rendering:pixelated;}
.vivo-moneda{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b0,#f5c84c 45%,#c9962a 78%,#8a6412);box-shadow:0 0 10px rgba(245,200,76,.7);}
.vivo-mas{font:800 15px/1 var(--sans,system-ui,sans-serif);color:var(--accent,#f5c84c);text-shadow:0 1px 2px rgba(0,0,0,.8),0 0 10px rgba(245,200,76,.45);white-space:nowrap;}
.vivo-anillo{border:2px solid var(--primary,#22e39a);border-radius:12px;box-sizing:border-box;}

/* Modo ligero, graficos bajos o «reducir movimiento»: sin animaciones */
html.vivo-quieto :is(.item,.vv-item)::after{display:none!important;}
html.vivo-quieto :is(.item,.vv-item)::before{display:none!important;}
html.vivo-quieto [data-vivo-e] :is(.item,.vv-item,.ranura,.vv-ranura),html.vivo-quieto .modal.on,html.vivo-quieto .modal.on>.ventana{animation:none!important;}
html.vivo-quieto .modal,html.vivo-quieto .modal>.ventana{transition:none!important;}
html.vivo-quieto :is(.item,.vv-item,.ranura,.vv-ranura),html.vivo-quieto :is(.modal,.vv) :is(.btn,.tab,.vv-chip){transition-duration:.01s!important;}
`;
}

// ── Estado «quieto»: se revisa al abrir una ventana y cuando cambia la preferencia del sistema ──
function quieto() {
  let l = false;
  try { l = !!op.ligero(); } catch (e) {}
  // window.__dqVivo = 'vivo' | 'quieto': solo para las pruebas (tools/fotos_inventario.mjs), porque
  // el Chrome sin ventana dibuja lento y los dos juegos entran solos en su modo ligero.
  const forzado = window.__dqVivo;
  const q = forzado === 'vivo' ? false : forzado === 'quieto' ? true : l || REDUCE.matches;
  raiz.classList.toggle('vivo-quieto', q);
  return q;
}

// ── Vibracion: respeta el ajuste del juego (localStorage dq3_vib: normal | suave | off) ──
const PATRON = { toque: 8, equipar: [10, 30, 18], vender: [6, 24, 10], error: [22, 40, 22] };
let vibT = 0;
export function vibrar(tipo) {
  let modo = 'normal';
  try { modo = localStorage.getItem('dq3_vib') || 'normal'; } catch (e) {}
  if (modo === 'off') return;
  const fuerte = tipo === 'equipar' || tipo === 'error';
  if (modo === 'suave' && !fuerte) return;
  const ahora = performance.now();
  if (!fuerte && ahora - vibT < 70) return;
  vibT = ahora;
  let tg = null;
  try { tg = op.tg ? op.tg() : null; } catch (e) {}
  const hf = tg && tg.HapticFeedback && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.1')) ? tg.HapticFeedback : null;
  try {
    if (hf) {
      if (tipo === 'equipar') hf.notificationOccurred('success');
      else if (tipo === 'error') hf.notificationOccurred('error');
      else hf.impactOccurred(tipo === 'vender' ? 'medium' : 'light');
      return;
    }
    // Fuera de Telegram: la vibracion del sistema (Android; el iPhone no la tiene en el navegador).
    if (TACTIL && navigator.vibrate) navigator.vibrate(typeof tipo === 'number' || Array.isArray(tipo) ? tipo : PATRON[tipo] || 8);
  } catch (e) {}
}

// ── Luz que sigue al puntero: un solo oyente, una pasada por cuadro ──
let sobre = null, ultimo = null, raf = 0, soltarT = 0;
function ponerSobre(t) {
  if (t === sobre) return;
  if (sobre) sobre.classList.remove('vivo-sobre');
  sobre = t;
  if (t) t.classList.add('vivo-sobre');
}
function pintarLuz() {
  raf = 0;
  const e = ultimo; ultimo = null;
  if (!e || raiz.classList.contains('vivo-quieto')) { ponerSobre(null); return; }
  const t = e.target && e.target.closest ? e.target.closest(TARJ) : null;
  ponerSobre(t);
  if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
  t.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
}
function alMover(e) { ultimo = e; if (!raf) raf = requestAnimationFrame(pintarLuz); }

// Lo ultimo que se pulso dentro de una ventana (para la sacudida de «no se pudo»).
let pulsado = null;
function alBajar(e) {
  const t = e.target && e.target.closest ? e.target : null;
  if (!t) return;
  // En cuanto el jugador toca algo, la entrada escalonada se da por terminada (lo que se repinte no vuelve a entrar).
  const entrando = t.closest('[data-vivo-e]');
  if (entrando) entrando.removeAttribute('data-vivo-e');
  const tarj = t.closest(TARJ), boton = t.closest('.btn,.ranura:not(.vacia),.vv-ranura:not(.vacia)');
  if (tarj) { clearTimeout(soltarT); alMover(e); if (boton) tarj.classList.add('vivo-pulsa'); }
  if (boton && boton.closest('.modal,.vv')) { pulsado = { el: tarj || boton, t: performance.now() }; if (!boton.disabled) vibrar('toque'); }
}
function alSoltar(e) {
  doc.querySelectorAll('.vivo-pulsa').forEach(x => x.classList.remove('vivo-pulsa'));
  // Con el dedo no hay «salir»: la luz se apaga sola un momento despues.
  if (e.pointerType !== 'mouse') { clearTimeout(soltarT); soltarT = setTimeout(() => ponerSobre(null), 420); }
}

// ── Piezas sueltas: vuelo, anillo, +oro ──
const caja = el => { try { const r = el.getBoundingClientRect(); return r.width || r.height ? r : null; } catch (e) { return null; } };
const enPantalla = r => !!r && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
function suelto(clase, r) {
  const d = doc.createElement('div');
  d.className = 'vivo-vuelo ' + clase;
  d.style.transform = `translate(${Math.round(r.left)}px,${Math.round(r.top)}px)`;
  doc.body.appendChild(d);
  return d;
}
function anim(el, cuadros, opciones, fin) {
  try {
    const a = el.animate(cuadros, opciones);
    a.onfinish = a.oncancel = () => { if (fin) fin(); };
    return a;
  } catch (e) { if (fin) fin(); return null; }
}
// Anillo que se abre desde un elemento (ranura que recibe la pieza, contador de oro).
export function destello(el, color) {
  const r = el && caja(el);
  if (!r || !enPantalla(r)) return;
  if (raiz.classList.contains('vivo-quieto')) return;
  let col = color || '';
  try { col = col || getComputedStyle(el).getPropertyValue('--rz').trim(); } catch (e) {}
  const a = suelto('vivo-anillo', r);
  a.style.width = r.width + 'px'; a.style.height = r.height + 'px';
  if (col) { a.style.borderColor = col; a.style.boxShadow = '0 0 18px ' + col; }
  try { a.style.borderRadius = getComputedStyle(el).borderRadius; } catch (e) {}
  const base = `translate(${Math.round(r.left)}px,${Math.round(r.top)}px)`;
  anim(a, [{ transform: base + ' scale(.82)', opacity: .95 }, { transform: base + ' scale(1.38)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.7,.2,1)' }, () => a.remove());
  anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: .28 }, { transform: 'scale(.97)', offset: .62 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
}
function vuelo(nodo, de, a, ms, fin) {
  const dx = a.left + a.width / 2 - (de.left + de.width / 2), dy = a.top + a.height / 2 - (de.top + de.height / 2);
  const esc = Math.max(.35, Math.min(1.4, Math.min(a.width, a.height) * .62 / Math.max(1, Math.max(de.width, de.height))));
  const b = `translate(${Math.round(de.left)}px,${Math.round(de.top)}px)`;
  const arco = Math.min(70, 24 + Math.hypot(dx, dy) * .12);
  anim(nodo, [
    { transform: `${b} translate(0,0) scale(1)`, opacity: 1 },
    { transform: `${b} translate(${dx * .45}px,${dy * .45 - arco}px) scale(1.18)`, opacity: 1, offset: .42 },
    { transform: `${b} translate(${dx}px,${dy}px) scale(${esc})`, opacity: .85 },
  ], { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)' }, () => { nodo.remove(); if (fin) fin(); });
}

// Destellos que esperan a que el servidor confirme (el inventario se repinta con innerHTML).
let espera = [];
const firma = el => (el ? el.className + '|' + el.innerHTML : '');
export function repintado() {
  if (!espera.length) return;
  const ahora = performance.now();
  espera = espera.filter(p => {
    if (ahora > p.hasta) return false;
    if (!p.aterrizo) return true;
    const el = doc.querySelector(p.sel);
    if (!el || firma(el) === p.antes) return true;   // aun no cambio: sigue esperando
    destello(el);
    return false;
  });
}

// «Equipar»: el icono de la tarjeta vuela a su ranura y la ranura destella cuando el servidor la cambia.
export function alEquipar(boton) {
  vibrar('equipar');
  const tarj = boton && boton.closest ? boton.closest(TARJ) : null;
  const s = tarj && tarj.dataset ? tarj.dataset.s : '';
  if (!s) return;
  const sel = `[data-ran="${String(s).replace(/[^a-z0-9_-]/gi, '')}"]`;
  const ran = doc.querySelector(sel);
  const p = { sel, antes: firma(ran), aterrizo: false, hasta: performance.now() + 2600 };
  espera.push(p);
  const llegar = () => { p.aterrizo = true; repintado(); };
  const ico = tarj.querySelector('.ico img,.vv-ico img');
  const de = ico && caja(ico), a = ran && caja(ran);
  if (quieto() || !de || !a || !enPantalla(de) || !enPantalla(a)) { llegar(); return; }
  const f = suelto('', de);
  const img = doc.createElement('img');
  img.src = ico.currentSrc || ico.src; img.alt = '';
  img.style.cssText = `display:block;width:${de.width}px;height:${de.height}px;image-rendering:pixelated;filter:drop-shadow(0 0 8px ${getComputedStyle(tarj).getPropertyValue('--rz').trim() || 'rgba(34,227,154,.8)'})`;
  f.appendChild(img);
  anim(tarj, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.97)', opacity: .55 }], { duration: 300, easing: 'ease-out', fill: 'none' });
  vuelo(f, de, a, 430, llegar);
}

// «Vender»: sale «+oro» del boton y una moneda salta al contador (si se ve).
export function alVender(boton, cuanto, destino) {
  vibrar('vender');
  const de = boton && caja(boton);
  if (!de || !enPantalla(de) || quieto()) return;
  const n = Number(cuanto) || 0;
  if (n > 0) {
    const m = suelto('vivo-mas', { left: de.left + de.width / 2 - 18, top: de.top - 4 });
    m.textContent = '+' + n.toLocaleString('es', { useGrouping: 'always' });
    const b = m.style.transform;
    anim(m, [{ transform: b + ' translateY(0) scale(.7)', opacity: 0 }, { transform: b + ' translateY(-14px) scale(1.12)', opacity: 1, offset: .25 }, { transform: b + ' translateY(-40px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' }, () => m.remove());
  }
  const buscar = () => { try { return typeof destino === 'string' ? doc.querySelector(destino) : (destino && destino.isConnected ? destino : null); } catch (e) { return null; } };
  const d = buscar(), a = d && caja(d);
  if (!a || !enPantalla(a)) return;
  const ori = { left: de.left + de.width / 2 - 9, top: de.top + de.height / 2 - 9, width: 18, height: 18 };
  const c = suelto('vivo-moneda', ori);
  vuelo(c, ori, { left: a.left, top: a.top, width: Math.max(26, Math.min(a.width, 60)), height: Math.max(26, a.height) }, 520, () => {
    const dd = buscar();
    if (dd) anim(dd, [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: .3 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
  });
}

// El servidor contesto que no (bolsa llena, falta oro, falta nivel...): sacudida de lo ultimo que se toco.
export function fallo() {
  const p = pulsado; pulsado = null;
  if (!p || performance.now() - p.t > 1500 || !p.el || !p.el.isConnected) return;
  vibrar('error');
  if (quieto()) return;
  anim(p.el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }], { duration: 340, easing: 'ease-out' });
}

// Al abrir una ventana (o cambiar de pestaña): sus tarjetas entran una tras otra, una sola vez.
const entradas = new WeakMap();
export function abrir(modal) {
  if (!modal || !modal.setAttribute) return;
  if (quieto()) return;
  modal.setAttribute('data-vivo-e', '');
  clearTimeout(entradas.get(modal));
  // Se quita cuando la ultima tarjeta termino de entrar: lo que se repinte despues ya no se anima.
  entradas.set(modal, setTimeout(() => modal.removeAttribute('data-vivo-e'), (ESCALONES + 1) * PASO_MS + R_VENTANA.ms + 40));
}

export function iniciar(opciones) {
  op = { ...op, ...(opciones || {}) };
  raiz.classList.add('vivo');
  if (op.juego) raiz.classList.add('vivo' + op.juego);
  quieto();
  if (listo) return;
  listo = true;
  const st = doc.createElement('style');
  st.id = 'dq-vivo';
  st.textContent = css();
  doc.head.appendChild(st);
  doc.addEventListener('pointermove', alMover, { passive: true });
  doc.addEventListener('pointerdown', alBajar, { passive: true });
  doc.addEventListener('pointerup', alSoltar, { passive: true });
  doc.addEventListener('pointercancel', alSoltar, { passive: true });
  try { REDUCE.addEventListener('change', quieto); } catch (e) {}
}
