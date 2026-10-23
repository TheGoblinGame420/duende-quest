// ── VENTANAS DEL MUNDO 3D ──
// Inventario y equipo, libro de clase (habilidades, talentos y
// especializacion), Mercader completo (con la tienda premium) y logros con
// titulos. Es un modulo aparte: crea su propio DOM y su CSS, y habla con el
// servidor con los MISMOS mensajes que el cliente 2D (mmo/js/client.js).
// Lo que se compra lo valida el servidor (en 3D hay que estar junto al
// Mercader: si no, contesta con un aviso).
//
// Uso (desde mundo.js):
//   const V = iniciarVentanas({ mandar, yo: () => yo, aviso, sfx, abrir, cerrar });
//   V.abrirInventario(); V.abrirLibro(); V.abrirTienda(); V.abrirLogros();
//   en cada 'yo' del servidor: V.actualizar();
//   en 'pedidoSol' y 'factura': V.alPedido(m)  (o alPedido(m) importado)
import {
  RANURAS, RAREZAS, BOLSA_MAX, NIVEL_MAX, nombreItem, iconoItem, precioVenta, textoBonos,
  CONJUNTOS, piezasConjunto, textoConjunto,
  TALENTOS, TALENTO_MAX, TALENTO_NIVEL, puntosTalento, costoReinicioTalentos,
  HABS, habsDe, costoHab, CLASES, RECURSOS, ESPECS, ESPEC_NIVEL, costoCambioClase,
  ARMAS, SKINS, PODERES, MONTURAS, TINTES, MASCOTAS, HOJAS, FORJA_MAX, costoForja, multForja,
  BANDA_MONTURA, TORRE, ambulanteActivo, ambulanteOferta,
  PAQUETES, estrellasDe, LOGROS, progresoLogro, statsJugador, ALAS,
} from '/mmo/js/data.js?v=261';

const A = '/assets/';
const TACTIL = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const TG = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null);

// Escapa texto del usuario o del servidor antes de meterlo en HTML.
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const fmt = n => (Number(n) || 0).toLocaleString('es', { useGrouping: 'always' });
const MON = `<img class="vv-mon" src="${A}items/equipo/I_GoldCoin.png" alt="oro">`;
const oro = n => `<span class="vv-precio">${MON}${fmt(n)}</span>`;

// ── Estado del modulo (una sola instancia por pagina) ──
let H = null;                 // { mandar, yo, aviso, sfx, abrir, cerrar, telegram, iniciarSesion }
let listo = false;
const est = {
  inv: 'equipo', ranura: '', filtro: '',
  libro: 'habs', clases: false,
  tienda: 'pw', foco: '',
  logros: 'todos',
};
let pendiente = null;          // confirmacion de dos toques { k, t }
let pagoActual = null;         // pedido de SOL/$DUENDE mostrado

const IDS = { inv: 'v-inv', libro: 'v-libro', tienda: 'v-tienda', logros: 'v-logros', pago: 'v-pago' };

// ── CSS propio (prefijo vv- para no chocar con el HUD) ──
const CSS = `
.vv{width:min(660px,94vw);max-height:88vh;max-height:min(88dvh,900px);padding:0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6);}
.vv:not(.estrecha){height:88vh;height:min(88dvh,820px);}
.vv.estrecha{width:min(480px,94vw);}
.vv>.cerrar{z-index:2;}
.vv-cab{flex:0 0 auto;padding:16px 16px 10px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(180deg,rgba(124,58,237,.12),transparent);}
.vv-cab h2{margin:2px 34px 10px;line-height:1.4;}
.vv-sub{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;align-items:center;font:600 12.5px var(--sans);color:var(--txt2);margin-bottom:10px;}
.vv-sub:empty{display:none;}
.vv-sub b{color:var(--txt);}
.vv-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;padding:1px;}
.vv-tabs::-webkit-scrollbar{display:none;}
.vv-tabs:empty{display:none;}
@media (min-width:720px){.vv-tabs{flex-wrap:wrap;justify-content:center;overflow:visible;}}
.vv-tab{flex:0 0 auto;position:relative;font:700 12px var(--sans);letter-spacing:.03em;min-height:34px;padding:7px 12px;border-radius:8px;border:1px solid var(--borde);background:rgba(255,255,255,.03);color:var(--txt2);cursor:pointer;}
.vv-tab:hover{color:var(--txt);background:rgba(255,255,255,.08);}
.vv-tab.on{background:var(--pri);border-color:#60a5fa;color:#fff;}
.vv-tab .pt{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--oro);color:#1a1200;font:800 10px/18px var(--sans);}
.vv-cuerpo{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:12px 16px 18px;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
.vv-lista{display:flex;flex-direction:column;gap:8px;}
.vv-item{display:flex;gap:10px;align-items:center;border:1px solid var(--borde);border-left:3px solid var(--rz,var(--borde));border-radius:10px;padding:9px 10px;background:rgba(255,255,255,.035);}
.vv-item.foco{box-shadow:0 0 0 2px var(--ok);}
.vv-ico{width:52px;height:52px;flex:0 0 52px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);border-radius:8px;overflow:hidden;}
.vv-ico img{max-width:44px;max-height:44px;image-rendering:pixelated;}
.vv-ico canvas{width:52px;height:52px;image-rendering:pixelated;}
.vv-ico .muestra{width:36px;height:36px;border-radius:8px;box-shadow:0 0 0 2px rgba(255,255,255,.15) inset;}
.vv-txt{flex:1 1 160px;min-width:0;}
.vv-txt>b{display:block;font:700 14px/1.3 var(--sans);margin-bottom:3px;}
.vv-txt small{display:block;font:500 12.5px/1.45 var(--sans);color:var(--txt2);}
.vv-acc{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex:0 0 auto;}
.vv .btn{padding:7px 12px;font-size:13px;min-height:34px;white-space:nowrap;}
.vv .btn.sec{color:var(--txt);}
.vv .btn.oro{background:linear-gradient(#f59e0b,#d97706);color:#1a1200;}
.vv .btn.ojo{background:#b45309;border:1px solid #f59e0b;color:#fff;}
.vv-precio{display:inline-flex;align-items:center;gap:4px;font:700 13px var(--sans);color:var(--oro);white-space:nowrap;}
.vv-mon{width:16px;height:16px;image-rendering:pixelated;vertical-align:-3px;}
.vv-etq{font:700 12px var(--sans);white-space:nowrap;color:var(--txt2);}
.vv-ok{color:var(--ok)!important;}.vv-warn{color:var(--warn)!important;}.vv-err{color:var(--err)!important;}.vv-dim{color:var(--txt3)!important;}
@media (max-width:520px){
  .vv-cab{padding:14px 12px 8px;}
  .vv-cuerpo{padding:10px 12px 16px;}
  .vv-item{flex-wrap:wrap;}
  .vv-acc{flex-direction:row;flex-wrap:wrap;width:100%;justify-content:flex-end;align-items:center;}
}
.vv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;}
.vv-stat{background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 4px;text-align:center;}
.vv-stat small{display:block;font:700 9.5px var(--sans);color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;}
.vv-stat b{font:800 15px var(--sans);}
.vv-ranuras{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px;}
.vv-ranura{position:relative;border:1px solid var(--rz,var(--borde));border-radius:10px;background:rgba(255,255,255,.04);aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;padding:4px;color:var(--txt);min-width:0;}
.vv-ranura img{width:56%;image-rendering:pixelated;}
.vv-ranura small{font:600 9.5px var(--sans);color:var(--txt2);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.vv-ranura .nv{position:absolute;top:3px;right:5px;font:700 9px var(--sans);color:var(--txt3);}
.vv-ranura.vacia{border-style:dashed;border-color:var(--borde);cursor:default;background:transparent;}
.vv-ranura.vacia span{color:var(--txt3);font:600 16px var(--sans);}
.vv-ranura.sel{box-shadow:0 0 0 2px var(--rz) inset,0 0 14px rgba(255,255,255,.08);}
.vv-cj{font:600 12px/1.45 var(--sans);text-align:center;margin:6px 0;}
.vv-cj span{color:var(--txt2);}
.vv-chips{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;margin:4px 0 10px;padding:1px;}
.vv-chips::-webkit-scrollbar{display:none;}
.vv-chip{flex:0 0 auto;font:600 12px var(--sans);padding:6px 11px;border-radius:999px;border:1px solid var(--borde);background:transparent;color:var(--txt2);cursor:pointer;}
.vv-chip.on{background:rgba(125,211,252,.14);color:var(--cian);border-color:rgba(125,211,252,.5);}
.vv-sec{display:flex;justify-content:space-between;align-items:center;gap:8px;font:800 11.5px var(--sans);color:var(--txt);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 8px;}
.vv-sec:first-child{margin-top:0;}
.vv-sec small{font:600 12px var(--sans);text-transform:none;letter-spacing:0;color:var(--txt2);}
.vv-nota{font:500 12px/1.5 var(--sans);color:var(--txt2);margin-top:10px;}
.vv-vacio{text-align:center;color:var(--txt2);padding:22px 8px;font:500 13px/1.5 var(--sans);}
.vv-full{width:100%;margin-top:8px;}
.vv-fila2{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}
.vv-fila2 .btn{flex:1 1 140px;white-space:normal;}
.vv-dif{display:inline-block;margin-right:6px;font-weight:700;white-space:nowrap;}
.vv-barra{height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin:6px 0 3px;}
.vv-barra i{display:block;height:100%;background:linear-gradient(90deg,#16a34a,#4ade80);}
.vv-cajas{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media (max-width:460px){.vv-cajas{grid-template-columns:1fr;}}
.vv-clase{border:1px solid var(--borde);border-radius:12px;padding:12px;background:rgba(255,255,255,.035);cursor:pointer;display:flex;flex-direction:column;gap:6px;text-align:left;color:var(--txt);font:inherit;transition:border-color .15s,box-shadow .15s;}
.vv-clase:hover,.vv-clase.sel{border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c);}
.vv-clase.bloq{opacity:.5;cursor:default;}
.vv-clase .cab{display:flex;gap:8px;align-items:center;}
.vv-clase .cab img{width:36px;height:36px;image-rendering:pixelated;}
.vv-clase .cab div>b{display:block;font:800 15px/1.3 var(--sans);color:var(--c);}
.vv-clase .cab small{font:500 12px var(--sans);color:var(--txt2);}
.vv-clase p{font:500 12.5px/1.45 var(--sans)!important;color:var(--txt2);margin:0!important;}
.vv-clase .habs{display:flex;gap:3px;flex-wrap:wrap;}
.vv-clase .habs img{width:22px;height:22px;image-rendering:pixelated;border:1px solid var(--borde);border-radius:4px;}
.vv-tals{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media (max-width:520px){.vv-tals{grid-template-columns:1fr;}}
.vv-tal{display:flex;gap:9px;align-items:center;border:1px solid var(--borde);border-radius:10px;padding:8px 9px;background:rgba(255,255,255,.035);}
.vv-tal.on{border-color:rgba(255,216,74,.5);}
.vv-tal img{width:30px;height:30px;image-rendering:pixelated;flex:0 0 30px;}
.vv-tal div{flex:1;min-width:0;}
.vv-tal>div>b{display:block;font:700 13px/1.3 var(--sans);}
.vv-tal small{display:block;font:500 12px/1.35 var(--sans);color:var(--txt2);}
.vv-tal .btn{padding:6px 12px;min-width:40px;font-size:16px;}
.vv-pips{display:flex;gap:3px;margin:4px 0 2px;}
.vv-pips i{width:14px;height:5px;border-radius:2px;background:rgba(255,255,255,.12);}
.vv-pips i.on{background:var(--oro);}
.vv-det{display:flex;gap:10px;align-items:center;border:1px solid var(--rz);border-radius:10px;padding:9px 10px;background:rgba(0,0,0,.25);margin-bottom:8px;}
.vv-monto{text-align:center;margin:6px 0 12px;}
.vv-monto>b{display:block;font:800 20px var(--sans);color:var(--cian);word-break:break-all;}
.vv-monto small{display:block;margin-top:6px;font:500 12.5px/1.45 var(--sans);color:var(--txt2);}
.vv-wallet{font:500 11.5px/1.4 ui-monospace,Menlo,Consolas,monospace;word-break:break-all;background:#0a0418;border:1px solid var(--borde);padding:8px;border-radius:6px;user-select:text;-webkit-user-select:text;}
.vv-input{width:100%;padding:10px;border-radius:8px;border:1px solid var(--borde);background:#0a0418;color:var(--txt);font:500 13px var(--sans);margin:6px 0;user-select:text;-webkit-user-select:text;}
.vv-p{font:500 12.5px/1.5 var(--sans);color:var(--txt2);margin:6px 0;}
.vv-qr{display:flex;justify-content:center;margin:6px 0;min-height:40px;}
.vv-qr img{background:#fff;border-radius:8px;}
.vv-pedidos .fila{font-size:13px;}
`;

// ── Utilidades de pintado ──
function tarjeta(ico, nombre, desc, acc, extra, cls) {
  return `<div class="vv-item${cls ? ' ' + cls : ''}"${extra || ''}><div class="vv-ico">${ico}</div><div class="vv-txt"><b>${nombre}</b><small>${desc}</small></div><div class="vv-acc">${acc}</div></div>`;
}
const icoEquipo = (n, gris) => `<img src="${A}items/equipo/${n}.png" alt=""${gris ? ' style="filter:grayscale(1);opacity:.45"' : ''}>`;
const icoItem = it => `<img src="${A}items/equipo/${iconoItem(it)}.png" alt="" style="filter:drop-shadow(0 0 4px ${RAREZAS[it.r] ? RAREZAS[it.r].color : '#fff'})">`;
const icoArma = (id, d) => `<img src="${A}armas/${d.icono}_item.png" alt=""${id !== 'katana' && d.color ? ` style="filter:drop-shadow(0 0 4px ${d.color})"` : ''}>`;
const icoSkin = (id, d) => `<img src="${retratoSkin(id)}" alt=""${d.premium ? ` style="filter:drop-shadow(0 0 5px ${d.color})"` : ''}>`;
const icoHoja = (hoja, tinte) => `<canvas data-hoja="${esc(hoja)}" data-tinte="${esc(tinte || '')}" width="52" height="52"></canvas>`;
const muestraTinte = tn => `<div class="muestra" style="${tn.color === 'arcoiris' ? 'background:linear-gradient(90deg,#f43f5e,#facc15,#34d399,#38bdf8,#c084fc)' : 'background:' + tn.color}"></div>`;
const btn = (txt, act, datos, cls, off) => `<button class="btn ${cls || ''}" data-act="${act}"${Object.entries(datos || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${off ? ' disabled' : ''}>${txt}</button>`;
const etq = (txt, cls) => `<span class="vv-etq ${cls || ''}">${txt}</span>`;

// Confirmacion de dos toques (sin confirm(): en Telegram queda feo).
function confirmar(k) {
  if (pendiente && pendiente.k === k && Date.now() - pendiente.t < 4000) { pendiente = null; return true; }
  pendiente = { k, t: Date.now() };
  return false;
}
function pidiendo(k) { return !!(pendiente && pendiente.k === k && Date.now() - pendiente.t < 4000); }
function marcarSeguro(b) { b.classList.add('ojo'); b.textContent = '¿Seguro? Toca otra vez'; }

// ── Imagenes: hojas de monstruos (mascotas y monturas) y skins teñidas ──
const IMG = {};
let repinteProgramado = false;
function cargarImg(src) {
  let im = IMG[src];
  if (!im) {
    im = IMG[src] = new Image();
    im.onload = () => { if (!repinteProgramado) { repinteProgramado = true; requestAnimationFrame(() => { repinteProgramado = false; actualizar(); }); } };
    im.src = src;
  }
  return im;
}
// Copia teñida (mismo truco que el 2D: tiñe sin perder volumen).
const _tinte = new Map();
function tenido(im, hex) {
  const key = im.src + hex;
  if (_tinte.has(key)) return _tinte.get(key);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.45; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(im, 0, 0);
  _tinte.set(key, c);
  return c;
}
// Primer cuadro de caminar de la hoja, centrado en el lienzo de 52 px.
function dibujarHojas(raiz) {
  raiz.querySelectorAll('canvas[data-hoja]').forEach(c => {
    const hm = HOJAS[c.dataset.hoja];
    if (!hm) return;
    const im = cargarImg(A + 'enemigos/sheets/' + c.dataset.hoja + '.png');
    if (!im.complete || !im.naturalWidth) return;
    const src = c.dataset.tinte ? tenido(im, c.dataset.tinte) : im;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 52, 52); x.imageSmoothingEnabled = false;
    const e = Math.min(48 / hm.fw, 48 / hm.fh);
    x.save(); x.translate(26, 50); if (hm.izq) x.scale(-1, 1);
    x.drawImage(src, hm.mov[1] * hm.fw, hm.mov[0] * hm.fh, hm.fw, hm.fh, -hm.fw * e / 2, -hm.fh * e, hm.fw * e, hm.fh * e);
    x.restore();
  });
}
// Giro de tono pixel a pixel (skins premium, como teñir() del 2D).
function teñir(img, hue, sat) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const giro = (hue || 0) / 360;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const dd = mx - mn;
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      h = mx === r ? (gg - b) / dd + (gg < b ? 6 : 0) : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
      h /= 6;
    }
    h = (h + giro) % 1; s = Math.min(1, s * (sat || 1));
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q2;
    const k = t => { t = (t + 1) % 1; return t < 1 / 6 ? p2 + (q2 - p2) * 6 * t : t < 0.5 ? q2 : t < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - t) * 6 : p2; };
    p[i] = k(h + 1 / 3) * 255; p[i + 1] = k(h) * 255; p[i + 2] = k(h - 1 / 3) * 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}
const _retratos = {};
function retratoSkin(id) {
  const sk = SKINS[id];
  const base = A + 'skins/' + (sk ? sk.img : 'skin_hero') + '.png';
  if (!sk || !sk.anim) return base;
  if (_retratos[id]) return _retratos[id];
  const im = cargarImg(base);
  if (!im.complete || !im.naturalWidth) return base;
  try { _retratos[id] = teñir(im, sk.hue, sk.sat).toDataURL(); } catch (e) { return base; }
  return _retratos[id];
}

// ── DOM: las cuatro ventanas y la de pago ──
function crearModal(id, titulo, estrecha) {
  const m = document.createElement('div');
  m.className = 'modal'; m.id = id;
  m.innerHTML = `<div class="ventana vv${estrecha ? ' estrecha' : ''}"><button class="bt cerrar" data-cerrar aria-label="Cerrar">✕</button>
    <div class="vv-cab"><h2 data-t>${titulo}</h2><div class="vv-sub" data-sub></div><div class="vv-tabs" data-tabs></div></div>
    <div class="vv-cuerpo" data-cuerpo></div></div>`;
  document.body.appendChild(m);
  m.querySelector('[data-cerrar]').onclick = () => cerrarV(id);
  // Clic fuera de la ventana: cierra.
  m.addEventListener('click', e => { if (e.target === m) cerrarV(id); });
  // Las teclas escritas en un campo no mueven al duende.
  m.addEventListener('keydown', e => { if (e.target.matches('input,textarea') && e.key !== 'Escape') e.stopPropagation(); });
  m.addEventListener('keyup', e => { if (e.target.matches('input,textarea')) e.stopPropagation(); });
  return m;
}
const $v = id => document.getElementById(id);
const parte = (id, p) => $v(id).querySelector('[data-' + p + ']');
const abierta = id => { const m = $v(id); return !!(m && m.classList.contains('on')); };
function cerrarV(id) { if (H) H.cerrar(id); else $v(id).classList.remove('on'); }
function abrirV(id) {
  // Una ventana del modulo a la vez.
  for (const k in IDS) if (IDS[k] !== id && abierta(IDS[k])) cerrarV(IDS[k]);
  H.abrir(id);
  const c = parte(id, 'cuerpo'); if (c) c.scrollTop = 0;
}
function pintarTabs(id, tabs, actual, act) {
  const el = parte(id, 'tabs');
  el.innerHTML = tabs.map(([k, txt, pt]) => `<button class="vv-tab${k === actual ? ' on' : ''}" data-act="${act}" data-id="${k}">${txt}${pt ? `<span class="pt">${pt}</span>` : ''}</button>`).join('');
  // En el movil las pestañas se desplazan: la elegida queda a la vista.
  const on = el.querySelector('.on');
  if (on && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
}

// ═══════════════════ INVENTARIO ═══════════════════
const puntaje = b => ((b && b.atk) || 0) * 3 + ((b && b.def) || 0) * 2 + ((b && b.hp) || 0) * 0.3 + ((b && b.crit) || 0) * 300;
const puedeUsar = (it, y) => it.nv <= y.nivel || (!!it.des && y.nivel >= NIVEL_MAX);
// Diferencia de bonos entre una pieza y la que llevas puesta.
function difBonos(a, b) {
  const l = [];
  for (const [k, n] of [['atk', 'ATQ'], ['def', 'DEF'], ['hp', 'VIDA'], ['crit', 'CRÍT']]) {
    const d = ((a && a[k]) || 0) - ((b && b[k]) || 0);
    if (Math.abs(d) < 1e-9) continue;
    const v = k === 'crit' ? Math.round(d * 100) + '%' : Math.round(d);
    if (v === 0 || v === '0%') continue;
    l.push(`<span class="vv-dif ${d > 0 ? 'vv-ok' : 'vv-err'}">${d > 0 ? '+' : ''}${v} ${n}</span>`);
  }
  return l.join('');
}
function htmlStats(y) {
  const ar = ARMAS[y.arma];
  return `<div class="vv-stats">
    <div class="vv-stat"><small>Ataque</small><b>${fmt(y.atk)}</b></div>
    <div class="vv-stat"><small>Defensa</small><b>${fmt(y.def)}</b></div>
    <div class="vv-stat"><small>Vida</small><b>${fmt(y.maxHp)}</b></div>
    <div class="vv-stat"><small>Crítico</small><b>${Math.round((y.crit || 0.12) * 100)}%</b></div>
  </div>` + (ar ? `<p class="vv-cj" style="margin-top:-2px"><span>Arma:</span> <b>${esc(ar.nombre)} +${(y.forja || {})[y.arma] || 0}</b> <span>· Monstruos ${fmt(y.kills)} · Jefes ${fmt(y.jefes)}</span></p>` : '');
}
function pintarInventario() {
  const y = H.yo(); if (!y) return;
  const id = IDS.inv;
  parte(id, 'sub').innerHTML = `<span><b>${esc(y.nombre)}</b> · Nv ${y.nivel}</span><span>${oro(y.oro)}</span><span>Bolsa <b>${(y.bolsa || []).length}/${BOLSA_MAX}</b></span>`;
  pintarTabs(id, [['equipo', 'EQUIPO'], ['skin', 'SKINS'], ['arma', 'ARMAS']], est.inv, 'itab');
  const c = parte(id, 'cuerpo');
  c.innerHTML = htmlStats(y) + (est.inv === 'equipo' ? htmlEquipo(y) : htmlColeccion(y, est.inv));
  dibujarHojas(c);
}
function htmlEquipo(y) {
  const eq = y.eq || {}, bolsa = y.bolsa || [];
  const pz = piezasConjunto(eq);
  let h = '<div class="vv-ranuras">';
  for (const k in RANURAS) {
    const it = eq[k];
    h += it
      ? `<button class="vv-ranura${est.ranura === k ? ' sel' : ''}" style="--rz:${RAREZAS[it.r].color}" data-act="ranura" data-id="${k}" title="${esc(nombreItem(it))}"><span class="nv">${it.nv}</span><img src="${A}items/equipo/${iconoItem(it)}.png" alt="">${'<small>' + RANURAS[k].nombre + '</small>'}</button>`
      : `<div class="vv-ranura vacia"><span>—</span><small>${RANURAS[k].nombre}</small></div>`;
  }
  h += '</div>';
  // Detalle de la pieza puesta que tocaste (con el boton de quitar).
  const sel = est.ranura && eq[est.ranura];
  if (sel) {
    const rz = RAREZAS[sel.r];
    h += `<div class="vv-det" style="--rz:${rz.color}"><div class="vv-ico">${icoItem(sel)}</div><div class="vv-txt"><b style="color:${rz.color}">${esc(nombreItem(sel))} <span class="vv-dim">Nv${sel.nv}</span></b><small>${esc(rz.nombre)} · ${esc(RANURAS[sel.s].nombre)} · ${esc(textoBonos(sel.b || {}))}${sel.cj && CONJUNTOS[sel.cj] ? `<br><span style="color:${CONJUNTOS[sel.cj].color}">Conjunto ${esc(CONJUNTOS[sel.cj].nombre)}</span>` : ''}</small></div><div class="vv-acc">${btn('Quitar', 'quitar', { id: est.ranura }, 'sec', bolsa.length >= BOLSA_MAX)}</div></div>`;
  } else h += '<p class="vv-nota" style="text-align:center;margin:0 0 6px">Toca una pieza puesta para verla o quitarla.</p>';
  // Conjuntos que llevas puestos.
  for (const cid in pz) {
    const cj = CONJUNTOS[cid];
    h += `<p class="vv-cj" style="color:${cj.color}">◆ ${esc(cj.nombre)} ${pz[cid]}/5 — ${pz[cid] >= 4 ? 'bono completo' : pz[cid] >= 2 ? 'bono de 2 activo' : 'sin bono aún'}<br><span>${esc(textoConjunto(cj))}</span></p>`;
  }
  // Atajos: lo mejor de la bolsa para cada ranura y vender lo comun.
  const comunes = bolsa.filter(x => x.r === 0);
  const mejoras = Object.keys(RANURAS).map(k => {
    const puesto = eq[k];
    const protege = puesto && puesto.cj && pz[puesto.cj] >= 2;   // no se rompe un conjunto activo
    const cand = bolsa.filter(x => x.s === k && puedeUsar(x, y) && (!protege || x.cj === puesto.cj)).sort((a, b) => puntaje(b.b) - puntaje(a.b))[0];
    return cand && (!puesto || puntaje(cand.b) > puntaje(puesto.b)) ? cand : null;
  }).filter(Boolean);
  if (mejoras.length || comunes.length) {
    h += '<div class="vv-fila2">';
    if (mejoras.length) h += btn(`▲ Equipar lo mejor (${mejoras.length})`, 'mejor', {}, '');
    if (comunes.length) h += btn(pidiendo('comunes') ? '¿Seguro? Toca otra vez' : `Vender ${comunes.length} comunes (+${fmt(comunes.reduce((a, x) => a + precioVenta(x), 0))})`, 'comunes', {}, pidiendo('comunes') ? 'ojo' : 'sec');
    h += '</div>';
  }
  // Filtro por ranura.
  h += `<div class="vv-sec">Bolsa <small>${bolsa.length}/${BOLSA_MAX}</small></div>`;
  if (!bolsa.length) return h + '<p class="vv-vacio">La bolsa está vacía. Los monstruos sueltan equipo al morir, y los jefes siempre.</p>';
  const cuenta = k => bolsa.filter(x => x.s === k).length;
  h += '<div class="vv-chips">' + `<button class="vv-chip${!est.filtro ? ' on' : ''}" data-act="filtro" data-id="">Todo ${bolsa.length}</button>` +
    Object.keys(RANURAS).filter(k => cuenta(k)).map(k => `<button class="vv-chip${est.filtro === k ? ' on' : ''}" data-act="filtro" data-id="${k}">${RANURAS[k].nombre} ${cuenta(k)}</button>`).join('') + '</div>';
  const orden = bolsa.filter(x => !est.filtro || x.s === est.filtro).sort((a, b) => b.r - a.r || b.nv - a.nv);
  h += '<div class="vv-lista">';
  for (const it of orden) {
    const rz = RAREZAS[it.r] || RAREZAS[0];
    const puesto = eq[it.s];
    const dif = puntaje(it.b) - (puesto ? puntaje(puesto.b) : 0);
    const rompe = puesto && puesto.cj && puesto.cj !== it.cj && pz[puesto.cj] >= 2;
    const flecha = dif > 0 && !rompe ? ' <span class="vv-ok">▲ Mejor</span>' : dif > 0 ? ' <span class="vv-warn">⚠ rompe tu conjunto</span>' : '';
    const comp = puesto ? `<br>vs puesta: ${difBonos(it.b, puesto.b) || '<span class="vv-dim">igual</span>'}` : '<br><span class="vv-ok">Ranura vacía</span>';
    const k = 'vender:' + it.id;
    const acc = (puedeUsar(it, y) ? btn('Equipar', 'equipar-item', { id: it.id }) : etq('Nv ' + it.nv, 'vv-warn'))
      + btn(pidiendo(k) ? '¿Seguro? Toca otra vez' : `Vender ${MON}${fmt(precioVenta(it))}`, 'vender', { id: it.id }, pidiendo(k) ? 'ojo' : 'sec');
    h += tarjeta(icoItem(it), `<span style="color:${rz.color}">${esc(nombreItem(it))}</span> <span class="vv-dim">Nv${it.nv}</span>${flecha}`,
      `${esc(rz.nombre)} · ${esc(RANURAS[it.s] ? RANURAS[it.s].nombre : '')} · ${esc(textoBonos(it.b || {}))}${comp}${it.cj && CONJUNTOS[it.cj] ? `<br><span style="color:${CONJUNTOS[it.cj].color}">Conjunto: ${esc(textoConjunto(CONJUNTOS[it.cj]))}</span>` : ''}`,
      acc, ` style="--rz:${rz.color}"`);
  }
  return h + '</div>';
}
// Skins y armas que tienes (las que no, se compran en el Mercader).
function htmlColeccion(y, tab) {
  const tabla = tab === 'arma' ? ARMAS : SKINS;
  const tiene = (tab === 'arma' ? y.armas : y.skins) || [];
  const puesto = tab === 'arma' ? y.arma : y.skin;
  let h = '<div class="vv-lista">';
  for (const id in tabla) {
    const d = tabla[id];
    const ico = tab === 'arma' ? icoArma(id, d) : icoSkin(id, d);
    const acc = !tiene.includes(id) ? btn('Ver en el Mercader', 'ir-tienda', { id: tab }, 'sec')
      : puesto === id ? etq('✓ Equipado', 'vv-ok') : btn('Equipar', 'equipar', { k: tab, id });
    const mas = tab === 'arma' && tiene.includes(id) ? ' +' + ((y.forja || {})[id] || 0) : '';
    const nom = d.premium ? `<span style="color:${d.color}">${esc(d.nombre)}</span>` : esc(d.nombre) + mas;
    h += tarjeta(ico, nom + (tiene.includes(id) ? '' : ' <span class="vv-dim">🔒</span>'), esc(d.desc) + (tab === 'skin' && puesto !== id ? difSkin(y, id) : ''), acc, d.color && tiene.includes(id) ? ` style="--rz:${d.color}"` : '');
  }
  return h + '</div>';
}
// Cuanto cambian tus estadisticas con otra skin.
function difSkin(y, id) {
  if (!y.clase) return '';
  try {
    const a = statsJugador(y.nivel, y.skin, y.eq, y.clase, y.espec, y.tal, y.runas);
    const b = statsJugador(y.nivel, id, y.eq, y.clase, y.espec, y.tal, y.runas);
    const l = [];
    const v = (x, z, t) => `<b class="${z > x ? 'vv-ok' : 'vv-err'}">${t}</b>`;
    if (b.atk !== a.atk) l.push(`Ataque ${a.atk} → ${v(a.atk, b.atk, b.atk)}`);
    if (b.maxHp !== a.maxHp) l.push(`Vida ${a.maxHp} → ${v(a.maxHp, b.maxHp, b.maxHp)}`);
    if (b.def !== a.def) l.push(`Defensa ${a.def} → ${v(a.def, b.def, b.def)}`);
    if (Math.abs(b.crit - a.crit) > 0.001) l.push(`Crítico ${Math.round(a.crit * 100)}% → ${v(a.crit, b.crit, Math.round(b.crit * 100) + '%')}`);
    return l.length ? '<br>' + l.map(x => `<span style="white-space:nowrap">${x}</span>`).join(' · ') : '';
  } catch (e) { return ''; }
}

// ═══════════════════ LIBRO DE CLASE ═══════════════════
function talentosLibres(y) {
  const tal = y.tal || {};
  return Math.max(0, puntosTalento(y.nivel) - Object.values(tal).reduce((a, b) => a + b, 0));
}
function pintarLibro() {
  const y = H.yo(); if (!y) return;
  const id = IDS.libro;
  const cl = CLASES[y.clase];
  if (!cl || est.clases) {
    parte(id, 'sub').innerHTML = cl ? `<span>Clase actual: <b style="color:${cl.color}">${esc(cl.nombre)}</b></span><span>${oro(y.oro)}</span>` : '<span>Elige tu clase para empezar</span>';
    parte(id, 'tabs').innerHTML = '';
    parte(id, 'cuerpo').innerHTML = htmlClases(y);
    return;
  }
  const rc = RECURSOS[cl.recurso];
  parte(id, 'sub').innerHTML = `<span><b style="color:${cl.color};font-size:15px">${esc(cl.nombre)}</b></span><span>${esc(cl.rol)} · <b style="color:${rc.color}">${esc(rc.nombre)}</b></span><span>Nv ${y.nivel}</span>`;
  const libres = y.nivel >= TALENTO_NIVEL ? talentosLibres(y) : 0;
  pintarTabs(id, [['habs', 'HABILIDADES'], ['tal', 'TALENTOS', libres || ''], ['espec', 'ESPECIALIZACIÓN']], est.libro, 'ltab');
  const c = parte(id, 'cuerpo');
  c.innerHTML = est.libro === 'tal' ? htmlTalentos(y) : est.libro === 'espec' ? htmlEspec(y) : htmlHabs(y);
}
function htmlHabs(y) {
  const cl = CLASES[y.clase], rec = RECURSOS[cl.recurso].nombre;
  const lista = HABS.filter(x => x.clase === y.clase);
  const barra = habsDe(y.clase);
  let h = `<div class="vv-sec">Habilidades <small>${lista.filter(x => y.nivel >= x.nv).length} de ${lista.length} aprendidas</small></div><div class="vv-lista">`;
  for (const hb of lista) {
    const bloq = y.nivel < hb.nv;
    const costo = costoHab(hb, y.recMax || 0, y.espec);
    const datos = [hb.costo ? costo + ' ' + rec.toLowerCase() : 'sin costo', hb.cast ? (hb.cast / 1000).toLocaleString('es') + ' s de lanzamiento' : 'instantánea', hb.cd ? 'recarga ' + Math.round(hb.cd / 1000) + ' s' : '', hb.rango ? 'alcance ' + hb.rango : '', hb.radio ? 'radio ' + hb.radio : ''].filter(Boolean).join(' · ');
    const i = barra.indexOf(hb);
    const acc = bloq ? etq('🔒 Nv ' + hb.nv, 'vv-warn') : etq(hb.barra === false ? 'Botón de acción' : 'Aprendida' + (i >= 0 ? ' · ' + (i + 1) : ''), 'vv-ok');
    h += tarjeta(icoEquipo(hb.icono, bloq), esc(hb.nombre) + ` <span class="vv-dim" style="white-space:nowrap">Nv ${hb.nv}</span>`,
      esc(hb.desc.replace(/\s*[\d,]+ s de lanzamiento\./, '')) + `<br><span class="vv-dim">${esc(datos)}</span>`, acc, bloq ? '' : ` style="--rz:${cl.color}"`);
  }
  return h + '</div>';
}
function htmlTalentos(y) {
  const tal = y.tal || {};
  if (y.nivel < TALENTO_NIVEL) return `<p class="vv-vacio">Los talentos se desbloquean a nivel ${TALENTO_NIVEL}: desde ahí ganas 1 punto por nivel para repartir.</p>` + htmlListaTal(tal, 0, true);
  const libres = talentosLibres(y);
  let h = `<div class="vv-sec">Talentos <small>Puntos libres: <b class="${libres ? 'vv-ok' : ''}">${libres}</b> · un punto por nivel desde el ${TALENTO_NIVEL}</small></div>`;
  h += htmlListaTal(tal, libres, false);
  if (Object.values(tal).some(Boolean)) {
    const k = 'talReset';
    h += btn(pidiendo(k) ? '¿Seguro? Toca otra vez' : `Reiniciar talentos (${MON}${fmt(costoReinicioTalentos(y.nivel))})`, 'tal-reset', {}, 'vv-full ' + (pidiendo(k) ? 'ojo' : 'sec'), y.oro < costoReinicioTalentos(y.nivel));
  }
  return h;
}
function htmlListaTal(tal, libres, bloq) {
  let h = '<div class="vv-tals">';
  for (const t of TALENTOS) {
    const r = tal[t.id] || 0;
    const pips = Array.from({ length: TALENTO_MAX }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
    const total = r ? ` · ahora +${Math.round(r * t.por * 100)}%` : '';
    h += `<div class="vv-tal${r ? ' on' : ''}"${bloq ? ' style="opacity:.55"' : ''}><img src="${A}items/equipo/${t.icono}.png" alt=""><div><b>${esc(t.nombre)} <span class="vv-dim">${r}/${TALENTO_MAX}</span></b><div class="vv-pips">${pips}</div><small>${esc(t.txt)} por rango${total}</small></div>${bloq ? '' : btn('+', 'tal', { id: t.id }, 'sec', !(libres > 0 && r < TALENTO_MAX))}</div>`;
  }
  return h + '</div>';
}
function htmlEspec(y) {
  const cl = CLASES[y.clase];
  let h = `<div class="vv-sec">Especialización <small>${y.nivel < ESPEC_NIVEL ? 'desde nivel ' + ESPEC_NIVEL : 'cambio gratis fuera de combate'}</small></div><div class="vv-cajas">`;
  for (const [id, e] of Object.entries(ESPECS[y.clase] || {})) {
    const sel = y.espec === id && y.nivel >= ESPEC_NIVEL;
    const bloq = y.nivel < ESPEC_NIVEL;
    h += `<button class="vv-clase${sel ? ' sel' : ''}${bloq ? ' bloq' : ''}" data-act="espec" data-id="${id}" style="--c:${cl.color}">
      <div class="cab"><img src="${A}items/equipo/${e.icono}.png" alt=""><div><b>${esc(e.nombre)}${sel ? ' ✓' : ''}</b><small>${esc(e.rol)}${sel ? ' · activa' : ''}</small></div></div><p>${esc(e.desc)}</p></button>`;
  }
  h += '</div>';
  const costoC = costoCambioClase(y.nivel);
  h += `<div class="vv-sec">Clase</div>`;
  h += btn(`Cambiar de clase${costoC ? ` (${MON}${fmt(costoC)})` : ' (gratis hasta Nv 10)'}`, 'ver-clases', {}, 'sec vv-full');
  return h;
}
function htmlClases(y) {
  const costo = y.clase ? costoCambioClase(y.nivel) : 0;
  let h = `<p class="vv-p" style="text-align:center;margin-bottom:10px">${y.clase
    ? (costo ? `Cambiar de clase a tu nivel cuesta ${MON}<b>${fmt(costo)}</b> oro. Tus talentos y tu equipo se quedan; la especialización se elige de nuevo.` : 'Hasta nivel 10 cambiar de clase es gratis.')
    : 'Cada clase juega distinto y cumple un papel en el grupo: el tanque aguanta, el sanador cura y los demás hacen daño. Hasta nivel 10 puedes cambiarla gratis.'}</p><div class="vv-cajas">`;
  for (const [id, cl] of Object.entries(CLASES)) {
    const habs = habsDe(id).map(hb => `<img src="${A}items/equipo/${hb.icono}.png" title="${esc(hb.nombre)} (Nv ${hb.nv})" alt="">`).join('');
    const k = 'clase:' + id;
    h += `<button class="vv-clase${y.clase === id ? ' sel' : ''}" data-act="clase" data-id="${id}" style="--c:${cl.color}">
      <div class="cab"><img src="${A}items/equipo/${cl.icono}.png" alt=""><div><b>${esc(cl.nombre)}${y.clase === id ? ' ✓' : ''}</b><small>${esc(cl.rol)} · ${esc(RECURSOS[cl.recurso].nombre)}</small></div></div>
      <p>${pidiendo(k) ? `<b class="vv-warn">¿Cambiar a ${esc(cl.nombre)} por ${fmt(costo)} oro? Toca otra vez.</b>` : esc(cl.desc)}</p><div class="habs">${habs}</div></button>`;
  }
  h += '</div>';
  if (y.clase) h += btn('← Volver al libro', 'volver', {}, 'sec vv-full');
  return h;
}

// ═══════════════════ MERCADER ═══════════════════
const TABS_TIENDA = [['pw', 'PODERES'], ['arma', 'ARMAS'], ['forja', 'FORJA'], ['skin', 'SKINS'], ['montura', 'MONTURAS'], ['alas', 'ALAS'], ['tinte', 'COLORES'], ['mascota', 'MASCOTAS'], ['ambulante', 'AMBULANTE'], ['premium', 'PREMIUM']];
const esTg = () => (H && typeof H.telegram === 'function' ? !!H.telegram() : !!TG());
function pintarTienda() {
  const y = H.yo(); if (!y) return;
  const id = IDS.tienda;
  parte(id, 'sub').innerHTML = `<span>Tu oro: ${oro(y.oro)}</span>` + (est.tienda === 'premium' ? '' : '<span class="vv-dim">Compra junto al Mercader del pueblo</span>');
  pintarTabs(id, TABS_TIENDA.map(([k, t]) => [k, t, k === 'ambulante' && ambulanteActivo() ? '!' : '']), est.tienda, 'ttab');
  const c = parte(id, 'cuerpo');
  const t = est.tienda;
  c.innerHTML = t === 'premium' ? htmlPremium(y) : t === 'forja' ? htmlForja(y) : t === 'tinte' ? htmlTintes(y) : t === 'mascota' ? htmlMascotas(y)
    : t === 'ambulante' ? htmlAmbulante(y) : t === 'montura' ? htmlMonturas(y) : t === 'alas' ? htmlAlas(y) : t === 'pw' ? htmlPoderes(y) : htmlArmasSkins(y, t);
  dibujarHojas(c);
}
const precioYBoton = (y, precio, k, id, nv, txt) => (nv && y.nivel < nv)
  ? etq('Nv ' + nv, 'vv-warn') + oro(precio)
  : oro(precio) + btn(txt || 'Comprar', 'comprar', { k, id }, '', y.oro < precio);
function htmlPoderes(y) {
  let h = '<div class="vv-lista">';
  for (const p of PODERES) {
    const n = (y.pw || {})[p.id] || 0;
    h += tarjeta(`<img src="${A}items/${p.icono}.png" alt="">`, `${esc(p.nombre)} <span class="vv-dim">· tienes ${n}</span>`, esc(p.desc) + `<br><span class="vv-dim">Tecla ${esc(p.tecla)}</span>`,
      oro(p.precio) + `<span style="display:flex;gap:6px">${btn('Comprar', 'comprar', { k: 'pw', id: p.id, n: 1 }, '', y.oro < p.precio || n >= 99)}${btn('×5', 'comprar', { k: 'pw', id: p.id, n: 5 }, 'sec', y.oro < p.precio * 5 || n + 5 > 99)}</span>`);
  }
  return h + '</div><p class="vv-nota">Máximo 99 de cada consumible.</p>';
}
function htmlForja(y) {
  let h = '<div class="vv-lista">';
  const f2 = n => multForja(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const id of y.armas || []) {
    const d = ARMAS[id]; if (!d) continue;
    const n = (y.forja || {})[id] || 0;
    const desc = 'Daño ×' + f2(n) + (n < FORJA_MAX ? ' → <b class="vv-ok">×' + f2(n + 1) + '</b>' : ' · máximo');
    const pips = `<span class="vv-pips" style="margin-top:6px">${Array.from({ length: FORJA_MAX }, (_, i) => `<i class="${i < n ? 'on' : ''}" style="width:9px"></i>`).join('')}</span>`;
    const acc = n >= FORJA_MAX ? etq('✓ +' + FORJA_MAX, 'vv-ok') : oro(costoForja(n)) + btn('Mejorar a +' + (n + 1), 'comprar', { k: 'forja', id }, 'oro', y.oro < costoForja(n));
    h += tarjeta(icoArma(id, d), `${esc(d.nombre)} +${n}${y.arma === id ? ' <span class="vv-ok">· equipada</span>' : ''}`, desc + pips, acc, ` style="--rz:${d.color}"`);
  }
  return h + `</div><p class="vv-nota">Cada mejora sale siempre bien: +7% de daño por nivel, hasta +${FORJA_MAX}. Compra más armas en la pestaña «Armas» para forjarlas también.</p>`;
}
function htmlTintes(y) {
  let h = '<div class="vv-lista">';
  for (const [id, tn] of Object.entries(TINTES)) {
    const tiene = (y.tintes || []).includes(id);
    if (tn.amb && !tiene) continue;   // los del ambulante, en su pestaña
    const acc = tiene ? (y.tinte === id ? etq('✓ En uso', 'vv-ok') : btn('Usar', 'comprar', { k: 'tinte', id }, 'sec')) : precioYBoton(y, tn.precio, 'tinte', id, tn.nv);
    h += tarjeta(muestraTinte(tn), `<span style="color:${tn.color === 'arcoiris' ? '#facc15' : tn.color}">${esc(tn.nombre)}</span>`, 'Color de tu nombre sobre tu duende: lo ven todos. Solo estética.', acc);
  }
  h += '</div>';
  if (y.tinte) h += btn('Volver al color de mi clase', 'comprar', { k: 'tinte', id: '' }, 'sec vv-full');
  return h;
}
function htmlMascotas(y) {
  let h = '<div class="vv-lista">';
  for (const [id, ma] of Object.entries(MASCOTAS)) {
    const tiene = (y.mascotas || []).includes(id);
    if ((ma.amb || ma.pase || ma.pesca) && !tiene) continue;   // ambulante, pase y pesca no se venden aqui
    const acc = tiene ? (y.mascota === id ? etq('✓ Te acompaña', 'vv-ok') : btn('Llevar', 'comprar', { k: 'mascota', id }, 'sec')) : precioYBoton(y, ma.precio, 'mascota', id, ma.nv);
    h += tarjeta(icoHoja(ma.hoja, ma.tinte), esc(ma.nombre), 'Te sigue a todas partes y la ven todos. Solo estética: no da nada.' + (!tiene ? ` <span class="vv-dim">Desde Nv ${ma.nv}.</span>` : ''), acc);
  }
  h += '</div>';
  if (y.mascota) h += btn('Guardar a mi mascota', 'comprar', { k: 'mascota', id: '' }, 'sec vv-full');
  return h;
}
function htmlAmbulante(y) {
  const activo = ambulanteActivo(), of = ambulanteOferta();
  let h = `<p class="vv-p" style="margin-bottom:10px">${activo ? '🧳 <b class="vv-ok">El ambulante está aquí este fin de semana.</b>' : '🧳 El ambulante llega el <b>viernes</b> y se va el domingo (UTC).'} Cada semana trae otra cosa (solo estética). Su oferta de esta semana:</p><div class="vv-lista">`;
  const fila = (k, id, d, ico, nom) => {
    const tiene = ((k === 'tinte' ? y.tintes : y.mascotas) || []).includes(id);
    const acc = tiene ? etq('✓ Ya es tuyo', 'vv-ok')
      : y.nivel < d.nv ? etq('Nv ' + d.nv, 'vv-warn') + oro(d.precio)
      : oro(d.precio) + btn(activo ? 'Comprar' : 'El viernes', 'comprar', { k, id }, '', !activo || y.oro < d.precio);
    h += tarjeta(ico, nom, k === 'tinte' ? 'Color de nombre exclusivo del ambulante.' : 'Mascota exclusiva del ambulante.', acc);
  };
  for (const id of of.tintes) { const tn = TINTES[id]; if (tn) fila('tinte', id, tn, muestraTinte(tn), `<span style="color:${tn.color}">${esc(tn.nombre)}</span>`); }
  for (const id of of.mascotas) { const ma = MASCOTAS[id]; if (ma) fila('mascota', id, ma, icoHoja(ma.hoja, ma.tinte), esc(ma.nombre)); }
  return h + '</div>';
}
function htmlMonturas(y) {
  let h = '<div class="vv-lista">';
  for (const [id, mo] of Object.entries(MONTURAS)) {
    const tiene = (y.monturas || []).includes(id);
    const acc = tiene ? (y.montura === id ? etq('✓ En uso', 'vv-ok') : btn('Usar', 'comprar', { k: 'montura', id }, 'sec'))
      : mo.banda ? etq(`⚔️ Banda ${(y.banda || {}).t || 0}/${BANDA_MONTURA}`)
      : mo.torre ? etq(`🗼 Piso ${y.torreMax || 0}/${TORRE.montura}`)
      : precioYBoton(y, mo.precio, 'montura', id, mo.nv);
    h += tarjeta(icoHoja(mo.hoja, mo.tinte), esc(mo.nombre), `+${Math.round((mo.vel - 1) * 100)}% de velocidad · ` + (mo.banda ? `no se vende: vence al Titán de la banda en ${BANDA_MONTURA} semanas distintas` : mo.torre ? `no se vende: supera el piso ${TORRE.montura} de la Torre del Duende` : `desde Nv ${mo.nv}`), acc);
  }
  return h + '</div><p class="vv-nota">Se monta en 1,5 s fuera de combate. No se puede montar en mazmorras ni en el Coliseo.</p>';
}
function htmlAlas(y) {
  let h = '<div class="vv-lista">';
  for (const [id, al] of Object.entries(ALAS)) {
    const tiene = (y.alas || ['aprendiz']).includes(id);
    const acc = tiene ? ((y.ala || 'aprendiz') === id ? etq('✓ Puestas', 'vv-ok') : btn('Ponérmelas', 'comprar', { k: 'alas', id }, 'sec'))
      : al.premium ? btn('Ver en PREMIUM', 'ttab', { id: 'premium' }, 'sec')
      : al.mazmorras ? etq(`🏆 Mazmorras ${y.mazmorras || 0}/${al.mazmorras}`)
      : precioYBoton(y, al.precio, 'alas', id, al.nv);
    const ico = `<span style="display:inline-block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle,${al.color},transparent 70%);box-shadow:0 0 ${al.brillo ? 12 : 4}px ${al.color}"></span>`;
    h += tarjeta(ico, `<span style="color:${al.color}">${esc(al.nombre)}</span>`, `${al.vuelo} s de vuelo · +${Math.round((al.vel - 1) * 100)}% en el aire · ` + (al.premium ? 'premium (SOL o $DUENDE)' : al.mazmorras ? `se ganan con ${al.mazmorras} mazmorras` : al.precio ? `desde Nv ${al.nv}` : 'las de todos'), acc);
  }
  return h + '</div><p class="vv-nota">En el mundo 3D: V o doble salto para volar; mantén Espacio al caer para planear gratis.</p>';
}
// Botones de pago con dinero (SOL / $DUENDE en la web, Stars en Telegram).
function botonesPago(y, pid, usd, principal) {
  if (!(y.p2e && y.p2e.cuenta)) return btn('Iniciar sesión', 'cuenta', {}, 'sec');
  if (esTg()) return btn(`${estrellasDe(usd)} Stars`, 'premium', { id: pid, metodo: 'stars' }, principal ? '' : 'sec');
  return btn(principal ? 'Pagar con SOL' : `~$${usd} en SOL`, 'premium', { id: pid, metodo: 'sol' }, principal ? '' : 'sec') + btn('$DUENDE −10%', 'premium', { id: pid, metodo: 'duende' }, 'sec');
}
function htmlArmasSkins(y, tab) {
  const tabla = tab === 'arma' ? ARMAS : SKINS;
  const tiene = (tab === 'arma' ? y.armas : y.skins) || [];
  const puesto = tab === 'arma' ? y.arma : y.skin;
  let h = '<div class="vv-lista">';
  for (const id in tabla) {
    const d = tabla[id];
    const ico = tab === 'arma' ? icoArma(id, d) : icoSkin(id, d);
    let acc;
    if (tiene.includes(id)) acc = puesto === id ? etq('✓ Equipado', 'vv-ok') : btn('Equipar', 'equipar', { k: tab, id }, 'sec');
    else if (typeof d.precio !== 'number') acc = `<span class="vv-etq" style="color:${d.color}">Exclusiva · $${d.usd}</span>` + botonesPago(y, 'skin_' + id, d.usd, true);
    else {
      acc = oro(d.precio) + btn('Comprar', 'comprar', { k: tab, id }, '', y.oro < d.precio);
      if (tab === 'skin' && d.usd && y.p2e && y.p2e.cuenta) acc += botonesPago(y, 'skin_' + id, d.usd, false);
    }
    const nom = d.premium ? `<span style="color:${d.color}">${esc(d.nombre)}</span>` : esc(d.nombre);
    h += tarjeta(ico, nom, esc(d.desc) + (tab === 'skin' && puesto !== id ? difSkin(y, id) : ''), acc, d.color ? ` style="--rz:${d.color}"` : '');
  }
  h += '</div>';
  if (tab === 'skin') h += `<p class="vv-nota">Cada skin da sus poderes mientras la llevas. Se compran con oro o, con tu cuenta, con dinero: ${esTg() ? 'Telegram Stars' : 'SOL o $DUENDE (10% de descuento) a la wallet de El Duende'}; El Duende revisa el pago y te la entrega en tu personaje. Las cuatro exclusivas (Esmeralda, Sombrío, Solar y Cósmico) solo se consiguen así; ninguna cambia lo que se gana en mTON.</p>`;
  return h;
}
function htmlPremium(y) {
  const cuentaTg = esTg();
  const cuenta = y.p2e && y.p2e.cuenta;
  let h = `<p class="vv-p" style="margin-bottom:10px">Compras opcionales para apoyar el juego. <b>El Duende</b> revisa cada pago y lo entrega en tu personaje. ${cuentaTg ? 'En Telegram se paga con Stars.' : 'En la web se paga con SOL o con $DUENDE (10% de descuento).'} Con dinero <b>no</b> se compran mTON: solo se ganan jugando.</p><div class="vv-lista">`;
  const lista = PAQUETES.slice().sort((a, b) => (b.id === est.foco) - (a.id === est.foco));
  for (const pq of lista) {
    const sk = pq.skin && SKINS[pq.skin];
    let acc;
    if (pq.skin && (y.skins || []).includes(pq.skin)) acc = etq('✓ Ya la tienes', 'vv-ok');
    else if (!cuenta) acc = etq(cuentaTg ? estrellasDe(pq.usd) + ' Stars' : '$' + pq.usd) + btn('Iniciar sesión', 'cuenta', {}, 'sec');
    else acc = etq(cuentaTg ? estrellasDe(pq.usd) + ' Stars' : '$' + pq.usd, 'vv-ok') + botonesPago(y, pq.id, pq.usd, true);
    const ico = sk ? icoSkin(pq.skin, sk) : icoEquipo(pq.icono);
    const nom = sk && sk.premium ? `<span style="color:${sk.color}">${esc(pq.nombre)}</span>` : esc(pq.nombre);
    const nota = sk ? `<br><span class="vv-dim">${sk.premium ? 'Skin exclusiva: solo se consigue aquí.' : 'Skin con poderes: también se consigue con oro.'}</span>` : '';
    h += tarjeta(ico, nom, esc(pq.desc) + nota, acc, sk ? ` style="--rz:${sk.color}"` : ' style="--rz:var(--oro)"', pq.id === est.foco ? 'foco' : '');
  }
  h += '</div>';
  const ps = y.pedidos || [];
  if (ps.length) {
    const col = { pagado: 'vv-warn', por_verificar: 'vv-warn', entregado: 'vv-ok', anulado: 'vv-err', esperando_pago: 'vv-dim', comprobando: 'vv-dim' };
    const txt = { pagado: 'Por entregar', por_verificar: 'En revisión', entregado: 'Entregado', anulado: 'Anulado', esperando_pago: 'Sin pagar', comprobando: 'Comprobando…' };
    h += '<div class="vv-sec">Tus compras</div><div class="vv-pedidos">' + ps.slice().reverse().map(x => `<div class="fila"><span>#${esc(x.codigo)} · ${esc(x.nombre)}</span><span class="${col[x.estado] || ''}">${esc(txt[x.estado] || x.estado)}${x.estado === 'esperando_pago' && (x.lamports || x.raw) ? ' ' + btn('Pagar', 'retomar', { id: x.codigo }, 'sec') : ''}</span></div>`).join('') + '</div>';
  }
  return h;
}

// ═══════════════════ LOGROS ═══════════════════
function pintarLogros() {
  const y = H.yo(); if (!y) return;
  const id = IDS.logros;
  const tienen = y.logros || [];
  const tit = LOGROS.find(x => x.id === y.titulo);
  parte(id, 'sub').innerHTML = `<span><b>${tienen.length}</b> de ${LOGROS.length} logros</span><span>Título: <b class="${tit ? 'vv-ok' : 'vv-dim'}">${tit ? esc(tit.titulo) : 'ninguno'}</b></span>`;
  pintarTabs(id, [['todos', 'TODOS'], ['hechos', 'CONSEGUIDOS'], ['faltan', 'PENDIENTES']], est.logros, 'lgtab');
  let h = '<p class="vv-p" style="text-align:center;margin-bottom:10px">Cada logro da oro y un título para lucir sobre tu nombre.</p>';
  if (y.titulo) h += btn('Quitar título', 'titulo', { id: '' }, 'sec vv-full') + '<div style="height:8px"></div>';
  const lista = LOGROS.filter(L => est.logros === 'todos' || (est.logros === 'hechos') === tienen.includes(L.id));
  if (!lista.length) h += `<p class="vv-vacio">${est.logros === 'hechos' ? 'Aún no tienes logros: caza, vence jefes y explora para conseguirlos.' : '¡Los tienes todos!'}</p>`;
  h += '<div class="vv-lista">';
  for (const L of lista) {
    const ok = tienen.includes(L.id);
    const acc = !ok ? `<span class="vv-precio" style="opacity:.75">+${MON}${fmt(L.oro)}</span>`
      : y.titulo === L.id ? etq('✓ En uso', 'vv-ok') : btn('Usar título', 'titulo', { id: L.id }, 'sec');
    let pr = null;
    if (!ok) try { pr = progresoLogro(L.id, { ...y, amigos: y.amigosN || 0 }); } catch (e) { pr = null; }
    const barra = pr && pr[0] > 0 ? `<div class="vv-barra"><i style="width:${Math.round(pr[0] / pr[1] * 100)}%"></i></div><span class="vv-dim">${fmt(pr[0])} / ${fmt(pr[1])}</span>` : '';
    h += tarjeta(icoEquipo('Ac_Medal02', !ok), `<span class="${ok ? '' : 'vv-dim'}" style="${ok ? 'color:var(--oro)' : ''}">${esc(L.titulo)}</span>`, esc(L.desc) + barra, acc, ok ? ' style="--rz:var(--oro)"' : '');
  }
  parte(id, 'cuerpo').innerHTML = h + '</div>';
}

// ═══════════════════ PAGOS (SOL / $DUENDE / Stars) ═══════════════════
// Telegram abre su propia ventana de pago de Stars.
function abrirFactura(m) {
  const tg = TG() || (window.Telegram && window.Telegram.WebApp);
  if (!tg || !tg.openInvoice) { window.open(m.link, '_blank'); return; }
  tg.openInvoice(m.link, st => {
    if (st === 'paid') H.aviso('Pago recibido. El Duende te entregará tu compra en breve.', 'ok');
    else if (st === 'failed') H.aviso('El pago no se completó.', 'err');
  });
}
function cargarScript(src, sri) {
  return new Promise((ok, mal) => { const sc = document.createElement('script'); sc.src = src; if (sri) { sc.integrity = sri; sc.crossOrigin = 'anonymous'; } sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(sc); });
}
function walletSol() {
  return (window.phantom && window.phantom.solana) || (window.solflare && window.solflare.isSolflare ? window.solflare : null) || window.solana || null;
}
const hayWalletSol = () => !!walletSol();
// Enlace Solana Pay del pedido (monto exacto; las wallets lo leen del QR).
function uriSolPay(m) {
  return `solana:${m.wallet}?amount=${(m.lamports / 1e9).toFixed(9)}${m.ref ? '&reference=' + m.ref : ''}&label=${encodeURIComponent('DUENDE QUEST')}&message=${encodeURIComponent('Pedido #' + m.codigo)}`;
}
// SOL: con Phantom (un toque) o desde cualquier wallet pegando la firma.
function mostrarPedidoSol(m) {
  pagoActual = m;
  const id = IDS.pago;
  const esD = m.metodo === 'duende';
  const unidad = esD ? '$DUENDE' : 'SOL';
  // Monto exacto en texto (sin coma flotante): sus ultimas cifras identifican el pedido.
  const exacto = (raw, dec) => { const t = String(raw).padStart(dec + 1, '0'); return t.slice(0, -dec) + '.' + t.slice(-dec); };
  const monto = esD ? exacto(m.raw, m.dec) : (m.lamports / 1e9).toFixed(9);
  parte(id, 't').textContent = esD ? 'PAGAR CON $DUENDE' : 'PAGAR CON SOL';
  parte(id, 'sub').innerHTML = `<span>${esc(m.nombre)} · pedido <b>#${esc(m.codigo)}</b></span>`;
  parte(id, 'cuerpo').innerHTML =
    `<div class="vv-monto"><b>${esc(monto)} ${unidad}</b><small>(~$${esc(m.usd)}) · paga el monto <b>exacto</b>: sus últimas cifras identifican tu pedido</small></div>` +
    `<button class="btn" data-p="phantom" style="width:100%;padding:12px;margin-bottom:10px">Pagar con Phantom${hayWalletSol() && !window.phantom ? ' / tu wallet' : ''}</button>` +
    (esD ? `<p class="vv-p" style="font-size:11px">Token: <span class="vv-wallet" style="display:inline;padding:2px 4px">${esc(m.mint)}</span></p>` : '') +
    (!esD && TACTIL && !hayWalletSol() ? `<button class="btn sec" data-p="solflare" style="width:100%;padding:10px;margin-bottom:10px">Pagar con Solflare</button>` : '') +
    (esD || TACTIL ? '' : `<p class="vv-p">O escanea con tu wallet del móvil (Solana Pay):</p><div class="vv-qr" data-qr></div>`) +
    (!esD && TACTIL ? `<a class="btn sec" href="${esc(uriSolPay(m))}" style="display:block;text-align:center;text-decoration:none;margin-bottom:6px">Abrir en mi wallet</a>` : '') +
    (esD ? '' : `<button class="btn" data-p="buscar" style="width:100%;margin:4px 0 10px">✅ Ya pagué: comprobar</button>`) +
    `<p class="vv-p">¿Otra wallet? Envía <b>${esc(monto)} ${unidad}</b> a la wallet de El Duende:</p>` +
    `<p class="vv-wallet">${esc(m.wallet)}</p>` +
    `<div class="vv-fila2" style="margin-top:8px"><button class="btn sec" data-p="copia-w">Copiar wallet</button><button class="btn sec" data-p="copia-m">Copiar monto</button></div>` +
    `<p class="vv-p">Y pega aquí la firma (signature) de la transacción:</p>` +
    `<input class="vv-input" data-firma placeholder="Firma de la transacción" autocomplete="off" spellcheck="false">` +
    `<button class="btn sec" data-p="firma" style="width:100%">Enviar comprobante</button>` +
    `<p class="vv-p" style="margin-top:10px">Tienes 30 minutos. El pago va directo a la wallet de El Duende y él te entrega la compra a mano.</p>`;
  const c = parte(id, 'cuerpo');
  const copiar = t => {
    try { navigator.clipboard.writeText(t).then(() => H.aviso('Copiado', 'ok'), () => H.aviso('No se pudo copiar: cópialo a mano.', 'err')); } catch (e) { H.aviso('No se pudo copiar: cópialo a mano.', 'err'); }
  };
  c.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (p === 'copia-w') copiar(m.wallet);
    else if (p === 'copia-m') copiar(monto);
    else if (p === 'firma') { const f = c.querySelector('[data-firma]').value.trim(); if (f) { H.sfx('boton', 0.3); H.mandar({ t: 'pedidoFirma', codigo: m.codigo, firma: f }); H.aviso('Comprobante enviado. Lo estamos revisando…', 'ok'); } else H.aviso('Pega primero la firma de la transacción.', 'err'); }
    else if (p === 'buscar') { H.sfx('boton', 0.3); H.aviso('Buscando tu pago en la red…', 'ok'); H.mandar({ t: 'pedidoBuscar', codigo: m.codigo }); }
    else if (p === 'phantom') pagarConPhantom(m);
    else if (p === 'solflare') {
      H.aviso('Abriendo el juego dentro de Solflare: entra con tu cuenta y, en la tienda premium → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
      window.location.href = 'https://solflare.com/ul/v1/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
    }
  });
  // Las otras ventanas del modulo se cierran; esta queda encima.
  abrirV(id);
  if (!esD && !TACTIL) cargarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1').then(() => {
    const q0 = c.querySelector('[data-qr]');
    if (!q0 || pagoActual !== m || !window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(uriSolPay(m)); q.make();
    q0.innerHTML = q.createImgTag(4, 8);
    const img = q0.querySelector('img'); if (img) img.alt = 'QR de pago Solana Pay';
  }).catch(() => { const q0 = c.querySelector('[data-qr]'); if (q0) q0.textContent = ''; });
}
async function pagarConPhantom(m) {
  const prov = walletSol();
  if (!prov) {
    // En el movil se abre el juego dentro de la app de Phantom (alli si se firma).
    if (TACTIL) {
      H.aviso('Abriendo el juego dentro de Phantom: entra con tu cuenta y, en la tienda premium → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
      window.location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
      return;
    }
    H.aviso('No encontramos Phantom en este navegador. Instálalo o paga desde otra wallet y pega la firma.', 'err');
    window.open('https://phantom.app/', '_blank');
    return;
  }
  try {
    // Version fija con SRI (en dic-2024 dos versiones 1.95.x venian con puerta trasera).
    if (!window.solanaWeb3) await cargarScript('https://unpkg.com/@solana/web3.js@1.98.0/lib/index.iife.min.js', 'sha384-1/Ll6ABlJDlMx1URcif2stL9Fxod/1rg71YHzGqTl6Bwzi0Vq993Jt/oVLFXfUgQ');
    const { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } = window.solanaWeb3;
    const r = await prov.connect();
    const publicKey = (r && r.publicKey) || prov.publicKey;
    if (!publicKey) throw new Error('la wallet no dio su dirección');
    const con = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    let tx;
    if (m.metodo === 'duende') {
      // TransferChecked del token SPL hacia la cuenta del token de El Duende.
      const mint = new PublicKey(m.mint), dest = new PublicKey(m.wallet);
      const [mias, suyas, infoMint] = await Promise.all([
        con.getParsedTokenAccountsByOwner(publicKey, { mint }), con.getParsedTokenAccountsByOwner(dest, { mint }), con.getAccountInfo(mint)]);
      const origen = mias.value.find(a => BigInt(a.account.data.parsed.info.tokenAmount.amount) >= BigInt(m.raw));
      if (!origen) { H.aviso('No tienes suficientes $DUENDE en esta wallet para este pedido.', 'err'); return; }
      if (!suyas.value.length || !infoMint) { H.aviso('No se pudo preparar el pago con la wallet: envía el monto a mano y pega la firma.', 'err'); return; }
      const datos = new Uint8Array(10); datos[0] = 12;   // TransferChecked
      let resto = BigInt(m.raw); for (let i = 1; i <= 8; i++) { datos[i] = Number(resto & 255n); resto >>= 8n; }
      datos[9] = m.dec;
      tx = new Transaction().add(new TransactionInstruction({ programId: infoMint.owner, data: datos, keys: [
        { pubkey: origen.pubkey, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: suyas.value[0].pubkey, isSigner: false, isWritable: true }, { pubkey: publicKey, isSigner: true, isWritable: false }] }));
    } else {
      const ix = SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: new PublicKey(m.wallet), lamports: m.lamports });
      if (m.ref) ix.keys.push({ pubkey: new PublicKey(m.ref), isSigner: false, isWritable: false });
      tx = new Transaction().add(ix);
    }
    tx.feePayer = publicKey;
    tx.recentBlockhash = (await con.getLatestBlockhash()).blockhash;
    let signature;
    if (prov.signAndSendTransaction) { const res = await prov.signAndSendTransaction(tx); signature = typeof res === 'string' ? res : res && res.signature; }
    else signature = await con.sendRawTransaction((await prov.signTransaction(tx)).serialize());
    if (!signature) throw new Error('la wallet no devolvió la firma');
    H.aviso('Pago enviado. Comprobando…', 'ok');
    H.mandar({ t: 'pedidoFirma', codigo: m.codigo, firma: signature });
    cerrarV(IDS.pago);
  } catch (e) { H.aviso('No se completó el pago con tu wallet: ' + ((e && e.message) || e), 'err'); }
}
// Respuesta del servidor a { t: 'pedido' }: 'pedidoSol' o 'factura'.
export function alPedido(m) {
  if (!m || !H) return;
  if (m.t === 'factura') abrirFactura(m);
  else if (m.t === 'pedidoSol') mostrarPedidoSol(m);
}

// ═══════════════════ ACCIONES (delegadas por ventana) ═══════════════════
const ACC = {
  // Inventario
  itab: b => { est.inv = b.dataset.id; H.sfx('boton', 0.2); pintarInventario(); },
  ranura: b => { est.ranura = est.ranura === b.dataset.id ? '' : b.dataset.id; H.sfx('boton', 0.2); pintarInventario(); },
  quitar: b => { H.sfx('boton', 0.3); H.mandar({ t: 'item', a: 'quitar', ranura: b.dataset.id }); est.ranura = ''; },
  filtro: b => { est.filtro = b.dataset.id; pintarInventario(); },
  'equipar-item': b => { H.sfx('boton', 0.3); H.mandar({ t: 'item', a: 'equipar', id: b.dataset.id }); },
  vender: b => {
    const y = H.yo(), it = ((y && y.bolsa) || []).find(x => x.id === b.dataset.id);
    // Lo epico, legendario o de conjunto pide un segundo toque.
    if (it && (it.r >= 2 || it.cj) && !confirmar('vender:' + it.id)) { marcarSeguro(b); return; }
    H.sfx('moneda', 0.3); H.mandar({ t: 'item', a: 'vender', id: b.dataset.id });
  },
  mejor: () => {
    const y = H.yo(); if (!y) return;
    const eq = y.eq || {}, bolsa = y.bolsa || [], pz = piezasConjunto(eq);
    const mejoras = Object.keys(RANURAS).map(k => {
      const puesto = eq[k];
      const protege = puesto && puesto.cj && pz[puesto.cj] >= 2;
      const cand = bolsa.filter(x => x.s === k && puedeUsar(x, y) && (!protege || x.cj === puesto.cj)).sort((a, b) => puntaje(b.b) - puntaje(a.b))[0];
      return cand && (!puesto || puntaje(cand.b) > puntaje(puesto.b)) ? cand : null;
    }).filter(Boolean);
    H.sfx('boton', 0.4);
    mejoras.forEach(x => H.mandar({ t: 'item', a: 'equipar', id: x.id }));
  },
  comunes: b => {
    if (!confirmar('comunes')) { marcarSeguro(b); return; }
    const y = H.yo(); H.sfx('moneda', 0.4);
    ((y && y.bolsa) || []).filter(x => x.r === 0).forEach(x => H.mandar({ t: 'item', a: 'vender', id: x.id }));
  },
  equipar: b => { H.sfx('boton', 0.3); H.mandar({ t: 'equipar', k: b.dataset.k, id: b.dataset.id }); },
  'ir-tienda': b => { abrirTienda(b.dataset.id); },
  // Libro
  ltab: b => { est.libro = b.dataset.id; H.sfx('boton', 0.2); pintarLibro(); },
  tal: b => { H.sfx('boton', 0.3); H.mandar({ t: 'talento', id: b.dataset.id }); },
  'tal-reset': b => { if (!confirmar('talReset')) { marcarSeguro(b); return; } H.sfx('explosion', 0.3); H.mandar({ t: 'talentoReset' }); },
  espec: b => {
    const y = H.yo(); if (!y) return;
    if (y.nivel < ESPEC_NIVEL) { H.aviso('Las especializaciones se eligen desde el nivel ' + ESPEC_NIVEL + '.', 'err'); return; }
    if (y.espec === b.dataset.id) return;
    H.sfx('explosion', 0.3); H.mandar({ t: 'espec', id: b.dataset.id });
  },
  'ver-clases': () => { est.clases = true; H.sfx('boton', 0.2); pintarLibro(); },
  volver: () => { est.clases = false; pintarLibro(); },
  clase: b => {
    const y = H.yo(); if (!y) return;
    const id = b.dataset.id;
    if (id === y.clase) { est.clases = false; pintarLibro(); return; }
    const costo = y.clase ? costoCambioClase(y.nivel) : 0;
    if (costo && y.oro < costo) { H.aviso('No te alcanza el oro para cambiar de clase.', 'err'); return; }
    if (costo && !confirmar('clase:' + id)) { pintarLibro(); return; }
    H.sfx('explosion', 0.35); H.mandar({ t: 'clase', id });
    est.clases = false;
  },
  // Mercader
  ttab: b => { est.tienda = b.dataset.id; est.foco = ''; H.sfx('boton', 0.2); pintarTienda(); parte(IDS.tienda, 'cuerpo').scrollTop = 0; },
  comprar: b => { H.sfx('boton', 0.3); H.mandar({ t: 'comprar', k: b.dataset.k, id: b.dataset.id, n: +b.dataset.n || 1 }); },
  premium: b => { H.sfx('boton', 0.3); H.mandar({ t: 'pedido', id: b.dataset.id, metodo: b.dataset.metodo }); H.aviso('Preparando tu pedido…', 'ok'); },
  retomar: b => {
    const y = H.yo(), x = ((y && y.pedidos) || []).find(p => p.codigo === b.dataset.id);
    if (x && x.raw) mostrarPedidoSol({ metodo: 'duende', codigo: x.codigo, raw: x.raw, mint: x.mint, dec: x.dec, wallet: x.wallet, usd: x.usd, nombre: x.nombre });
    else if (x && x.lamports) mostrarPedidoSol({ codigo: x.codigo, lamports: x.lamports, wallet: x.wallet, usd: x.usd, nombre: x.nombre, ref: x.ref });
  },
  cuenta: () => {
    if (H.iniciarSesion) H.iniciarSesion();
    else { H.aviso('Inicia sesión en el juego online y vuelve: entrarás con tu cuenta.', 'ok'); setTimeout(() => { location.href = '/mmo/'; }, 900); }
  },
  // Logros
  lgtab: b => { est.logros = b.dataset.id; H.sfx('boton', 0.2); pintarLogros(); },
  titulo: b => { H.sfx('boton', 0.3); H.mandar({ t: 'titulo', id: b.dataset.id }); },
};
function delegar(m) {
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !m.contains(b)) return;
    const f = ACC[b.dataset.act];
    if (f) f(b);
  });
}

// ═══════════════════ API ═══════════════════
function abrirInventario(tab) {
  if (!H || !H.yo()) return;
  if (typeof tab === 'string') est.inv = tab;
  pintarInventario(); abrirV(IDS.inv);
}
function abrirLibro(tab) {
  if (!H || !H.yo()) return;
  if (typeof tab === 'string') est.libro = tab;
  est.clases = false;
  pintarLibro(); abrirV(IDS.libro);
}
function abrirTienda(tab, foco) {
  if (!H || !H.yo()) return;
  if (typeof tab === 'string') est.tienda = tab;
  est.foco = typeof foco === 'string' ? foco : '';
  pintarTienda(); abrirV(IDS.tienda);
}
function abrirLogros() {
  if (!H || !H.yo()) return;
  pintarLogros(); abrirV(IDS.logros);
}
// Repinta la ventana abierta (el host la llama con cada 'yo').
function actualizar() {
  if (!H || !H.yo()) return;
  // Si la pieza elegida ya no esta puesta, se suelta la seleccion.
  const y = H.yo();
  if (est.ranura && !(y.eq || {})[est.ranura]) est.ranura = '';
  if (est.clases && y.clase && abierta(IDS.libro) === false) est.clases = false;
  if (abierta(IDS.inv)) pintarInventario();
  if (abierta(IDS.libro)) pintarLibro();
  if (abierta(IDS.tienda)) pintarTienda();
  if (abierta(IDS.logros)) pintarLogros();
}

export function iniciarVentanas(opciones) {
  const o = opciones || {};
  H = {
    mandar: o.mandar || (() => {}),
    yo: o.yo || (() => null),
    aviso: o.aviso || (() => {}),
    sfx: o.sfx || (() => {}),
    abrir: o.abrir || (id => document.getElementById(id).classList.add('on')),
    cerrar: o.cerrar || (id => document.getElementById(id).classList.remove('on')),
    telegram: o.telegram,             // opcional: () => true si se paga con Stars
    iniciarSesion: o.iniciarSesion,   // opcional: boton «Iniciar sesión»
  };
  if (!listo) {
    listo = true;
    const st = document.createElement('style'); st.id = 'vv-css'; st.textContent = CSS;
    document.head.appendChild(st);
    delegar(crearModal(IDS.inv, 'INVENTARIO'));
    delegar(crearModal(IDS.libro, 'LIBRO DE CLASE'));
    delegar(crearModal(IDS.tienda, 'MERCADER'));
    delegar(crearModal(IDS.logros, 'LOGROS'));
    crearModal(IDS.pago, 'PAGAR', true);
  }
  return { abrirInventario, abrirLibro, abrirTienda, abrirLogros, actualizar, alPedido };
}
