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
  RANURAS, RAREZAS, BOLSA_MAX, NIVEL_MAX, nombreItem, iconoItem, precioVenta, costoReforja, textoBonos,
  CONJUNTOS, piezasConjunto, textoConjunto,
  TALENTOS, TALENTO_MAX, TALENTO_NIVEL, puntosTalento, costoReinicioTalentos,
  HABS, habsDe, costoHab, CLASES, RECURSOS, ESPECS, ESPEC_NIVEL, costoCambioClase,
  ARMAS, SKINS, precioOro, PODERES, MONTURAS, TINTES, MASCOTAS, HOJAS, FORJA_MAX, costoForja, multForja,
  BANDA_MONTURA, TORRE, ambulanteActivo, ambulanteOferta,
  EXPEDICION, premioExpedicion, MATERIALES,
  PAQUETES, estrellasDe, solesDeStars, precioLocal, ordenTienda, grupoPaquete, GRUPOS_TIENDA, LOGROS, progresoLogro, statsJugador, ALAS, paqueteParaFaltante, ENTREGA, textoPagoRecibido, PEDIDO_VIGENCIA_MS,
  pagoLocalActivo, textoSoles, YAPE_VIGENCIA_MS, premioDiaria, MISIONES,
  ORO_POR_USD, STAR_TIENDA_USD, PEN_POR_USD,
  temporadaDe, TEMPORADAS,
} from '/mmo/js/data.js?v=342';

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
  tienda: 'pw', foco: '', via: 'npc',   // via: de donde se abrio la tienda (va en el pedido, para el dueño)
  logros: 'todos',
};
let pendiente = null;          // confirmacion de dos toques { k, t }
let pagoActual = null;         // pedido de SOL/$DUENDE mostrado
let facturaWebCod = '';        // pedido de Stars abierto desde la web (se confirma al llegar pagado)

const IDS = { inv: 'v-inv', libro: 'v-libro', tienda: 'v-tienda', logros: 'v-logros', pago: 'v-pago', exped: 'v-exped', ttemp: 'v-ttemp' };
let ttemp = null;              // estado de la tienda de la fiesta que manda el servidor { tp, saldo, comprado }

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
.vv .btn,#probador3 .btn{padding:7px 12px;font-size:13px;min-height:34px;white-space:nowrap;}
#probador3 .btn.sec{color:var(--txt);}
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
@media (max-width:520px){.vv-stats{gap:4px;margin-bottom:6px}.vv-stat{padding:3px 2px}.vv-stat small{font-size:8.5px;margin:0}.vv-stat b{font-size:13px}}
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
.vv-pedidos .fila>span:last-child{text-align:right;flex-shrink:0;max-width:60%;}
.vv-pedidos .fila .btn{padding:4px 8px;font-size:12px;margin-top:2px;}
.vv-plazo{display:block;font-size:11px;color:var(--txt2);margin-top:2px;}
#vv-franja{position:fixed;left:50%;top:calc(46px + env(safe-area-inset-top,0px) + var(--tg-top,0px));transform:translateX(-50%);z-index:8;display:none;max-width:calc(100vw - 32px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(14,9,30,.86);border:1px solid #4ade80;border-radius:999px;padding:5px 12px;font:700 12px var(--sans);color:#d1fae5;cursor:pointer;pointer-events:auto;}
#vv-franja.pend{border-color:#facc15;color:#fef3c7;}
body.movil #vv-franja{font-size:11px;padding:4px 10px;}
/* Movil/compacto: arriba al centro tapaba la vida y el minimapa (y "en camino" puede durar horas).
   Va a la derecha bajo el menu, en 2 lineas si hace falta, con 40 px para el dedo; los avisos bajan. */
body.movil #vv-franja,body.compacto #vv-franja{left:auto;right:calc(8px + env(safe-area-inset-right,0px));transform:none;top:calc(178px + env(safe-area-inset-top,0px) + var(--tg-top,0px));max-width:min(210px,62vw);white-space:normal;text-align:center;line-height:1.25;min-height:40px;padding:5px 12px;border-radius:14px;}
body.movil #vv-franja[style*="block"],body.compacto #vv-franja[style*="block"]{display:flex!important;align-items:center;justify-content:center;}
body.movil:has(#vv-franja[style*="block"]) #avisos,body.compacto:has(#vv-franja[style*="block"]) #avisos{top:calc(226px + env(safe-area-inset-top,0px) + var(--tg-top,0px));}
body.movil:has(#botones.abierto) #vv-franja,body.compacto:has(#botones.abierto) #vv-franja{visibility:hidden;}   /* no tapa el menu ⋯ abierto */
@media (orientation:landscape) and (max-height:500px){
 body.movil #vv-franja{top:calc(106px + env(safe-area-inset-top,0px) + var(--tg-top,0px));max-width:min(210px,34vw);}
 body.movil:has(#vv-franja[style*="block"]) #avisos{top:calc(56px + env(safe-area-inset-top,0px) + var(--tg-top,0px));}
}
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
// protegida: la de pago no se cierra al tocar el fondo (solo con su ✕).
function crearModal(id, titulo, estrecha, protegida) {
  const m = document.createElement('div');
  m.className = 'modal'; m.id = id;
  m.innerHTML = `<div class="ventana vv${estrecha ? ' estrecha' : ''}"><button class="bt cerrar" data-cerrar aria-label="Cerrar">✕</button>
    <div class="vv-cab"><h2 data-t>${titulo}</h2><div class="vv-sub" data-sub></div><div class="vv-tabs" data-tabs></div></div>
    <div class="vv-cuerpo" data-cuerpo></div></div>`;
  document.body.appendChild(m);
  m.querySelector('[data-cerrar]').onclick = () => cerrarV(id);
  // Clic fuera de la ventana: cierra.
  m.addEventListener('click', e => { if (e.target === m && !protegida) cerrarV(id); });
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
// Si una pieza recien ganada mejora la puesta (para la tarjeta «▲ Mejor · Equipar» del botin 3D).
// No cuenta como mejora si rompe un conjunto de 2 o mas piezas.
function compararConPuesta(it, y) {
  if (!it || !y || it.vendido || !it.s || !puedeUsar(it, y)) return false;
  const eq = y.eq || {}, puesto = eq[it.s];
  if (puesto && puesto.cj && piezasConjunto(eq)[puesto.cj] >= 2 && it.cj !== puesto.cj) return false;
  return !puesto || puntaje(it.b) > puntaje(puesto.b);
}
// Comunes que se pueden vender sin perder nada: no las que serian una mejora de lo que llevas.
const comunesVendibles = y => { const eq = y.eq || {}; return (y.bolsa || []).filter(x => x.r === 0 && !(puedeUsar(x, y) && (!eq[x.s] || puntaje(x.b) > puntaje(eq[x.s].b)))); };
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
  c.innerHTML = (est.inv === 'equipo' ? htmlFilaMejor(y) : '') + htmlStats(y) + (est.inv === 'equipo' ? htmlEquipo(y) : htmlColeccion(y, est.inv));
  dibujarHojas(c);
}
// Atajos: lo mejor de la bolsa para cada ranura y vender lo comun (arriba del todo, visible en movil).
function htmlFilaMejor(y) {
  const eq = y.eq || {}, bolsa = y.bolsa || [];
  const pz = piezasConjunto(eq);
  const comunes = comunesVendibles(y);
  const mejoras = Object.keys(RANURAS).map(k => {
    const puesto = eq[k];
    const protege = puesto && puesto.cj && pz[puesto.cj] >= 2;   // no se rompe un conjunto activo
    const cand = bolsa.filter(x => x.s === k && puedeUsar(x, y) && (!protege || x.cj === puesto.cj)).sort((a, b) => puntaje(b.b) - puntaje(a.b))[0];
    return cand && (!puesto || puntaje(cand.b) > puntaje(puesto.b)) ? cand : null;
  }).filter(Boolean);
  if (!mejoras.length && !comunes.length) return '';
  let h = '<div class="vv-fila2">';
  if (mejoras.length) h += btn(`▲ Equipar lo mejor (${mejoras.length})`, 'mejor', {}, '');
  if (comunes.length) h += btn(pidiendo('comunes') ? '¿Seguro? Toca otra vez' : `Vender ${comunes.length} comunes (+${fmt(comunes.reduce((a, x) => a + precioVenta(x), 0))})`, 'comunes', {}, pidiendo('comunes') ? 'ojo' : 'sec');
  return h + '</div>';
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
    h += `<div class="vv-det" style="--rz:${rz.color}"><div class="vv-ico">${icoItem(sel)}</div><div class="vv-txt"><b style="color:${rz.color}">${esc(nombreItem(sel))} <span class="vv-dim">Nv${sel.nv}</span></b><small>${esc(rz.nombre)} · ${esc(RANURAS[sel.s].nombre)} · ${esc(textoBonos(sel.b || {}))}${sel.cj && CONJUNTOS[sel.cj] ? `<br><span style="color:${CONJUNTOS[sel.cj].color}">Conjunto ${esc(CONJUNTOS[sel.cj].nombre)}</span>` : ''}</small></div><div class="vv-acc">${btn('Quitar', 'quitar', { id: est.ranura }, 'sec', bolsa.length >= BOLSA_MAX)}${sel.r >= 1 && y.nivel >= NIVEL_MAX ? btn(pidiendo('reforjar:' + sel.id) ? '¿Seguro? Toca otra vez' : `Reforjar ${MON}${fmt(costoReforja(sel))}`, 'reforjar', { id: sel.id }, pidiendo('reforjar:' + sel.id) ? 'ojo' : 'sec') : ''}</div></div>`;
  } else if (!bolsa.length) h += '<p class="vv-nota" style="text-align:center;margin:0 0 6px">Toca una pieza puesta para verla o quitarla.</p>';
  // Conjuntos que llevas puestos.
  for (const cid in pz) {
    const cj = CONJUNTOS[cid];
    h += `<p class="vv-cj" style="color:${cj.color}">◆ ${esc(cj.nombre)} ${pz[cid]}/5 — ${pz[cid] >= 4 ? 'bono completo' : pz[cid] >= 2 ? 'bono de 2 activo' : 'sin bono aún'}<br><span>${esc(textoConjunto(cj))}</span></p>`;
  }
  // (Los atajos «Equipar lo mejor» / «Vender comunes» van arriba del todo: ver htmlFilaMejor.)
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
      + btn(pidiendo(k) ? '¿Seguro? Toca otra vez' : `Vender ${MON}${fmt(precioVenta(it))}`, 'vender', { id: it.id }, pidiendo(k) ? 'ojo' : 'sec')
      + (it.r >= 1 && y.nivel >= NIVEL_MAX ? btn(pidiendo('reforjar:' + it.id) ? '¿Seguro? Toca otra vez' : `Reforjar ${MON}${fmt(costoReforja(it))}`, 'reforjar', { id: it.id }, pidiendo('reforjar:' + it.id) ? 'ojo' : 'sec') : '');
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
const TABS_TIENDA = [['pw', 'PODERES'], ['arma', 'ARMAS'], ['forja', 'FORJA'], ['skin', 'SKINS'], ['montura', 'MONTURAS'], ['alas', 'ALAS'], ['tinte', 'COLORES'], ['mascota', 'MASCOTAS'], ['ambulante', 'AMBULANTE'], ['premium', '💎 PAQUETES']];
const esTg = () => (H && typeof H.telegram === 'function' ? !!H.telegram() : !!TG());
// Modo anuncio (js/origen.js): quien llega de Meta no ve pagos SOL/$DUENDE ni mTON (solo se ocultan).
const anuncio = () => { try { return !!(window.dqAnuncio && window.dqAnuncio()); } catch (e) { return false; } };
function pintarTienda() {
  const y = H.yo(); if (!y) return;
  const id = IDS.tienda;
  parte(id, 'sub').innerHTML = `<span>Tu oro: ${oro(y.oro)}</span>` + (est.tienda === 'premium' || est.tienda === 'skin' ? '' : '<span class="vv-dim">Compra junto al Mercader del pueblo</span>');
  pintarTabs(id, TABS_TIENDA.map(([k, t]) => [k, t, k === 'ambulante' && ambulanteActivo() ? '!' : '']), est.tienda, 'ttab');
  const c = parte(id, 'cuerpo');
  const t = est.tienda;
  if (t === 'premium') evCompra('tv');
  c.innerHTML = t === 'premium' ? htmlPremium(y) : t === 'forja' ? htmlForja(y) : t === 'tinte' ? htmlTintes(y) : t === 'mascota' ? htmlMascotas(y)
    : t === 'ambulante' ? htmlAmbulante(y) : t === 'montura' ? htmlMonturas(y) : t === 'alas' ? htmlAlas(y) : t === 'pw' ? htmlPoderes(y) : htmlArmasSkins(y, t);
  dibujarHojas(c);
}
// Sin oro suficiente: en vez de un «Comprar» apagado, «Te faltan N», que lleva
// al paquete de oro justo de la tienda premium (pago manual, como siempre).
const faltaOro = (y, precio) => { const f = Math.max(1, precio - (y.oro || 0)), pq = paqueteParaFaltante(f); return btn('Te faltan ' + fmt(f), 'ir-tienda-foco', { id: pq ? pq.id : '' }, 'sec vv-falta'); };
const botonOro = (y, precio, txt, act, datos, cls) => y.oro < precio ? faltaOro(y, precio) : btn(txt, act, datos, cls || '');
const precioYBoton = (y, precio, k, id, nv, txt) => (nv && y.nivel < nv)
  ? etq('Nv ' + nv, 'vv-warn') + oro(precio)
  : oro(precio) + botonOro(y, precio, txt || 'Comprar', 'comprar', { k, id });
function htmlPoderes(y) {
  let h = '<div class="vv-lista">';
  for (const p of PODERES) {
    const n = (y.pw || {})[p.id] || 0;
    h += tarjeta(`<img src="${A}items/${p.icono}.png" alt="">`, `${esc(p.nombre)} <span class="vv-dim">· tienes ${n}</span>`, esc(p.desc) + `<br><span class="vv-dim">Tecla ${esc(p.tecla)}</span>`,
      oro(p.precio) + `<span style="display:flex;gap:6px">${n < 99 && y.oro < p.precio ? faltaOro(y, p.precio) : btn('Comprar', 'comprar', { k: 'pw', id: p.id, n: 1 }, '', n >= 99)}${btn('×5', 'comprar', { k: 'pw', id: p.id, n: 5 }, 'sec', y.oro < p.precio * 5 || n + 5 > 99)}</span>`);
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
    const acc = n >= FORJA_MAX ? etq('✓ +' + FORJA_MAX, 'vv-ok') : oro(costoForja(n)) + botonOro(y, costoForja(n), 'Mejorar a +' + (n + 1), 'comprar', { k: 'forja', id }, 'oro');
    h += tarjeta(icoArma(id, d), `${esc(d.nombre)} +${n}${y.arma === id ? ' <span class="vv-ok">· equipada</span>' : ''}`, desc + pips, acc, ` style="--rz:${d.color}"`);
  }
  return h + `</div><p class="vv-nota">Cada mejora sale siempre bien: +7% de daño por nivel, hasta +${FORJA_MAX}. Compra más armas en la pestaña «Armas» para forjarlas también.</p>`;
}
function htmlTintes(y) {
  let h = '<div class="vv-lista">';
  for (const [id, tn] of Object.entries(TINTES)) {
    const tiene = (y.tintes || []).includes(id);
    if ((tn.amb || tn.racha || tn.temp) && !tiene) continue;   // los del ambulante, en su pestaña; el de racha no se vende; los de fiesta, en su tienda
    const acc = tiene ? (y.tinte === id ? etq('✓ En uso', 'vv-ok') : btn('Usar', 'comprar', { k: 'tinte', id }, 'sec')) : precioYBoton(y, tn.precio, 'tinte', id, tn.nv);
    h += tarjeta(muestraTinte(tn), `<span style="color:${tn.color === 'arcoiris' ? '#facc15' : tn.color}">${esc(tn.nombre)}</span>`, 'Color de tu nombre sobre tu duende en ORIGINS y CLASSIC: lo ven todos. Solo estética.', acc);
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
    h += tarjeta(icoHoja(ma.hoja, ma.tinte), esc(ma.nombre), 'Te sigue en ORIGINS y CLASSIC, y la ven todos. En expediciones da +15% de oro.' + (!tiene ? ` <span class="vv-dim">Desde Nv ${ma.nv}.</span>` : ''), acc);
  }
  h += '</div>';
  if (y.mascota) h += btn('Guardar a mi mascota', 'comprar', { k: 'mascota', id: '' }, 'sec vv-full');
  return h;
}
function htmlAmbulante(y) {
  const activo = ambulanteActivo(), of = ambulanteOferta();
  let h = `<p class="vv-p" style="margin-bottom:10px">${activo ? '🧳 <b class="vv-ok">El ambulante está aquí este fin de semana.</b>' : '🧳 El ambulante llega el <b>viernes</b> y se va el domingo (hora de Perú).'} Cada semana trae otra cosa (solo estética). Su oferta de esta semana:</p><div class="vv-lista">`;
  const fila = (k, id, d, ico, nom) => {
    const tiene = ((k === 'tinte' ? y.tintes : y.mascotas) || []).includes(id);
    const acc = tiene ? etq('✓ Ya es tuyo', 'vv-ok')
      : y.nivel < d.nv ? etq('Nv ' + d.nv, 'vv-warn') + oro(d.precio)
      : oro(d.precio) + (activo ? botonOro(y, d.precio, 'Comprar', 'comprar', { k, id }) : btn('El viernes', 'comprar', { k, id }, '', true));
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
      : al.premium ? btn('Ver en PAQUETES', 'ttab', { id: 'premium' }, 'sec')
      : al.mazmorras ? etq(`🏆 Mazmorras ${y.mazmorras || 0}/${al.mazmorras}`)
      : precioYBoton(y, al.precio, 'alas', id, al.nv);
    const ico = `<span style="display:inline-block;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle,${al.color},transparent 70%);box-shadow:0 0 ${al.brillo ? 12 : 4}px ${al.color}"></span>`;
    h += tarjeta(ico, `<span style="color:${al.color}">${esc(al.nombre)}</span>`, `${al.vuelo} s de vuelo · +${Math.round((al.vel - 1) * 100)}% en el aire · ` + (al.premium ? (anuncio() ? 'premium' : 'premium (SOL o $DUENDE)') : al.mazmorras ? `se ganan con ${al.mazmorras} mazmorras` : al.precio ? `desde Nv ${al.nv}` : 'las de todos'), acc);
  }
  return h + '</div><p class="vv-nota">En el mundo 3D: V o doble salto para volar; mantén Espacio al caer para planear gratis.</p>';
}
// Botones de pago con dinero (Stars en Telegram; en la web Stars, SOL o $DUENDE).
// Stars desde la web: el servidor crea la factura y se paga en Telegram (movil: enlace; PC: QR).
function botonesPago(y, pid, usd, principal) {
  if (!(y.p2e && y.p2e.cuenta)) return btn('Crear cuenta / Entrar', 'cuenta', { id: pid }, 'sec');
  if (esTg()) return btn(`${estrellasDe(usd)} Stars`, 'premium', { id: pid, metodo: 'stars' }, principal ? '' : 'sec');
  // Yape / Plin (PAGO_LOCAL con el numero del dueño): principal en soles; lo demas, plegado.
  const pqL = pagoLocalActivo() && PAQUETES.find(p => p.id === pid);
  if (pqL && pqL.pen) {
    const otros = btn(`⭐ ${estrellasDe(usd)} Stars (tarjeta en Telegram)`, 'premium', { id: pid, metodo: 'stars' }, 'sec')
      + (anuncio() ? '' : btn(`~US$${usd} en Solana`, 'premium', { id: pid, metodo: 'sol' }, 'sec') + btn('$DUENDE −10%', 'premium', { id: pid, metodo: 'duende' }, 'sec'));
    return btn(`Yape / Plin ${textoSoles(pqL.pen)}`, 'premium', { id: pid, metodo: 'yape' }, principal ? '' : 'sec')
      + `<details style="font-size:12px;margin-top:4px"><summary style="cursor:pointer;opacity:.75">Otros métodos</summary>${otros}</details>`;
  }
  const bStars = btn(principal ? (anuncio() ? `⭐ Pagar ${estrellasDe(usd)} Stars (tarjeta en Telegram)` : '⭐ Pagar con Stars (tarjeta en Telegram)') :`⭐ ${estrellasDe(usd)} Stars`, 'premium', { id: pid, metodo: 'stars' }, principal && anuncio() ? '' : 'sec');
  if (anuncio()) return bStars;
  return btn(principal ? 'Pagar con Solana (cripto)' : `~US$${usd} en Solana`, 'premium', { id: pid, metodo: 'sol' }, principal ? '' : 'sec') + bStars + btn('$DUENDE −10%', 'premium', { id: pid, metodo: 'duende' }, 'sec');
}
// Skin de oro que aun no alcanzas: barra de cuanto llevas y de donde sale el oro jugando.
function barraGanala(y, pr) {
  const pc = Math.max(0, Math.min(100, Math.round((y.oro || 0) / Math.max(1, pr) * 100)));
  const dia = y.diaria && y.diaria.ok ? 0 : ((premioDiaria(y.nivel || 1) || {}).oro || 0);
  const mis = (MISIONES[y.mis && y.mis.i] || {}).oro || 0;
  const partes = [];
  if (dia) partes.push('caza del día +' + fmt(dia) + ' oro');
  if (mis) partes.push('misión actual +' + fmt(mis) + ' oro');
  partes.push('monstruos y expediciones');
  return `<div style="margin:4px 6px 0"><div style="background:#333;height:5px;border-radius:3px;overflow:hidden"><div style="background:#fbbf24;height:100%;width:${pc}%"></div></div><div style="font-size:11px;opacity:.8;margin-top:3px;line-height:1.3">Llevas ${pc}% · Gánala jugando: ${partes.join(' · ')}</div></div>`;
}
// Precio y botones de compra de un arma o skin que aún no tienes (la tarjeta y el probador 3D usan lo mismo).
function accPrecio(y, tab, id, d) {
  if (typeof d.precio !== 'number') return `<span class="vv-etq" style="color:${d.color}">Exclusiva · ${esTg() ? estrellasDe(d.usd) + ' ⭐' : anuncio() && !(pagoLocalActivo() && (PAQUETES.find(p => p.id === 'skin_' + id) || {}).pen) ? estrellasDe(d.usd) + ' ⭐ · ≈ ' + solesDeStars(estrellasDe(d.usd)) : 'US$' + d.usd + ' · ≈ ' + precioLocal(d.usd)}</span>` + botonesPago(y, 'skin_' + id, d.usd, true);
  const pr = precioOro(tab, id);
  let acc = (pr !== d.precio ? `<s style="opacity:.55;font-size:11px">${d.precio.toLocaleString('es')}</s> 🎃 ` : '') + oro(pr) + botonOro(y, pr, 'Comprar', 'comprar', { k: tab, id });
  if (tab === 'skin' && d.usd) acc += botonesPago(y, 'skin_' + id, d.usd, false);
  return acc;
}
function htmlArmasSkins(y, tab) {
  const tabla = tab === 'arma' ? ARMAS : SKINS;
  const tiene = (tab === 'arma' ? y.armas : y.skins) || [];
  const puesto = tab === 'arma' ? y.arma : y.skin;
  let h = '<div class="vv-lista">';
  for (const id in tabla) {
    const d = tabla[id];
    const ico = tab === 'arma' ? icoArma(id, d) : icoSkin(id, d);
    let acc, extra = '';
    if (tiene.includes(id)) acc = puesto === id ? etq('✓ Equipado', 'vv-ok') : btn('Equipar', 'equipar', { k: tab, id }, 'sec');
    else {
      acc = accPrecio(y, tab, id, d);
      // Probador 3D (ORIGINS): te la pones unos segundos, solo tú la ves y no se manda nada.
      if (tab === 'skin' && H && H.probarSkin) acc += btn('👀 Probar', 'probarSkin', { id }, 'sec');
      if (tab === 'skin' && typeof d.precio === 'number' && (y.oro || 0) < precioOro(tab, id)) extra = barraGanala(y, precioOro(tab, id));
    }
    const nom = d.premium ? `<span style="color:${d.color}">${esc(d.nombre)}</span>` : esc(d.nombre);
    h += extra ? '<div>' : '';
    h += tarjeta(ico, nom, esc(d.desc) + (tab === 'skin' && puesto !== id ? difSkin(y, id) : ''), acc, d.color ? ` style="--rz:${d.color}"` : '', est.foco === id ? 'foco' : '');
    if (extra) h += extra + '</div>';
  }
  h += '</div>';
  if (tab === 'skin') h += `<p class="vv-nota" style="color:#fde68a"><b>Una skin, dos juegos:</b> la que consigas la llevas también en CLASSIC (2D), con los mismos poderes. En PvP (duelos y Abismo) sus ventajas de combate no cuentan: ahí todos pelean igual.</p><p class="vv-nota">Cada skin da sus poderes mientras la llevas. Se compran con oro o, con tu cuenta, con dinero: ${esTg() || anuncio() ? 'Telegram Stars' : 'SOL o $DUENDE (10% de descuento) a la wallet de El Duende'}; El Duende revisa el pago y la activa en tu personaje. Los siete disfraces de la mascota (Bruja, Momia, Frankenstein, Vampiro, Esqueleto, Lobo y Pirata) se compran solo con oro y cambian tu duende 3D con su sombrero o peinado. Las cuatro exclusivas (Esmeralda, Sombrío, Solar y Cósmico) solo se consiguen así${anuncio() ? '' : '; ninguna cambia lo que se gana en mTON'}.</p>`;
  return h;
}
// Valor en dolares de un paquete si lo compraras suelto: oro al mejor cambio de los
// paquetes de oro y cada poder/pocion al precio por unidad del paquete suelto que lo
// vende (sin equivalente, esa parte no cuenta). Solo se muestra: no cambia ningun precio.
function valorPorSeparado(pq) {
  let v = pq.oro && ORO_POR_USD > 0 ? pq.oro / ORO_POR_USD : 0;
  for (const [k, n] of Object.entries(pq.pw || {})) {
    const suelto = PAQUETES.find(p => !p.unaVez && p.pw && p.pw[k] > 0);
    if (!suelto || !(n > 0)) continue;
    const uds = Object.values(suelto.pw).reduce((a, b) => a + (b || 0), 0);
    if (uds > 0) v += n * suelto.usd / uds;
  }
  return v;
}
function htmlPremium(y) {
  const cuentaTg = esTg();
  const cuenta = y.p2e && y.p2e.cuenta;
  // Una linea clara y el detalle plegado (en movil no tapa los paquetes).
  let h = `<p class="vv-p" style="margin-bottom:4px">Compras opcionales: <b>El Duende</b> revisa cada pago y lo entrega en tu personaje <b>a mano, de ${esc(ENTREGA.horario)} (máx. ${ENTREGA.plazoMaxH} h)</b>.</p><details class="vv-nota" style="margin:0 0 10px"><summary style="cursor:pointer">Cómo funciona</summary>${cuentaTg ? 'En Telegram se paga con Stars. Si no tienes Stars, Telegram te las vende y te muestra el precio final en tu moneda antes de pagar.' : anuncio() ? 'Se paga con Stars de Telegram (se compran con tarjeta dentro de Telegram): el botón abre Telegram, o en PC escaneas un QR con el celular.' : 'En la web se paga con Stars de Telegram (se compran con tarjeta dentro de Telegram), con Solana (SOL, una criptomoneda: no son soles) o con $DUENDE (10% de descuento).'}${anuncio() ? '' : ' Con dinero <b>no</b> se compran mTON: solo se ganan jugando.'}${pagoLocalActivo() && !cuentaTg ? ' Con Yape / Plin pagas en soles el precio que ves; El Duende revisa tu yapeo y te lo entrega.' : ' Los soles (S/) son solo referencia aproximada.'}</details>`;
  // Lo elegido va primero; luego por grupos con subtitulo.
  // El Pack de bienvenida (SOLO 1 VEZ) sale solo mientras el servidor diga que aun puedes.
  const lista = ordenTienda(PAQUETES.filter(p => !p.unaVez || y.puedeBienvenida), est.foco);
  // Con Yape / Plin en la web, el precio en soles es el de verdad (redondo, pq.pen).
  // En Telegram, los soles son los de las Stars (Telegram las vende a ~US$0,02 c/u).
  const precio = (usd, pen) => !cuentaTg && pen && pagoLocalActivo() ? textoSoles(pen) + ' · ≈ US$' + usd : cuentaTg || anuncio() ? estrellasDe(usd) + ' ⭐ · ≈ ' + solesDeStars(estrellasDe(usd)) : 'US$' + usd + ' · ≈ ' + precioLocal(usd);
  let grupo = '', abierta = false;
  for (const pq of lista) {
    const g = pq.id === est.foco ? '' : grupoPaquete(pq);
    if (g && g !== grupo) { grupo = g; h += `${abierta ? '</div>' : ''}<div class="vv-sec">${esc((GRUPOS_TIENDA.find(x => x[0] === g) || [])[1] || '')}</div><div class="vv-lista">`; abierta = true; }
    else if (!abierta) { h += '<div class="vv-lista">'; abierta = true; }
    const sk = pq.skin && SKINS[pq.skin];
    let acc;
    if (pq.skin && (y.skins || []).includes(pq.skin)) acc = etq('✓ Ya la tienes', 'vv-ok');
    else if (!cuenta) acc = etq(precio(pq.usd, pq.pen)) + btn('Crear cuenta / Entrar', 'cuenta', { id: pq.id }, 'sec');
    else acc = etq(precio(pq.usd, pq.pen), 'vv-ok') + botonesPago(y, pq.id, pq.usd, true);
    const ico = sk ? icoSkin(pq.skin, sk) : icoEquipo(pq.icono);
    const nom = (sk && sk.premium ? `<span style="color:${sk.color}">${esc(pq.nombre)}</span>` : esc(pq.nombre))
      + (pq.etiqueta ? ` <span style="font-size:10px;padding:1px 5px;border-radius:6px;background:#22c55e;color:#000;white-space:nowrap">${esc(pq.etiqueta)}</span>` : '');
    let nota = sk ? `<br><span class="vv-dim">${sk.premium ? 'Skin exclusiva: solo se consigue aquí.' : 'Skin con poderes: también se consigue con oro.'}</span>` : '';
    if (pq.unaVez) {
      // Valor honesto por separado: lo que costaria lo mismo en los paquetes sueltos, comparado
      // con lo que de verdad pagas por el metodo que ves (soles de Yape, Stars o dolares).
      const vs = valorPorSeparado(pq);
      const yape = !cuentaTg && pq.pen && pagoLocalActivo(), stars = !yape && (cuentaTg || anuncio());
      const pagas = yape ? pq.pen / PEN_POR_USD : stars ? estrellasDe(pq.usd) * STAR_TIENDA_USD : pq.usd;
      if (vs > pagas + 0.05) nota += `<br><span class="vv-ok" style="font-size:12px">Por separado ≈ US$${vs.toFixed(2)} (≈ ${precioLocal(vs)}) · tú pagas ${yape ? textoSoles(pq.pen) : stars ? estrellasDe(pq.usd) + ' ⭐' : 'US$' + pq.usd}</span>`;
    }
    h += tarjeta(ico, nom, esc(pq.desc) + nota, acc, sk ? ` style="--rz:${sk.color}"` : ' style="--rz:var(--oro)"', pq.id === est.foco ? 'foco' : '');
  }
  h += '</div>';
  const ps = y.pedidos || [];
  if (ps.length) {
    const col = { pagado: 'vv-warn', por_verificar: 'vv-warn', entregado: 'vv-ok', anulado: 'vv-err', esperando_pago: 'vv-dim', comprobando: 'vv-dim' };
    const txt = { pagado: 'Por entregar', por_verificar: 'En revisión', entregado: 'Entregado', anulado: 'Anulado', esperando_pago: 'Sin pagar', comprobando: 'Comprobando…' };
    h += '<div class="vv-sec">Tus compras</div><div class="vv-pedidos">' + ps.slice().reverse().map(x => `<div class="fila"><span>#${esc(x.codigo)} · ${esc(x.nombre)}</span><span class="${col[x.estado] || ''}">${esc(txt[x.estado] || x.estado)}${x.estado === 'esperando_pago' && (x.lamports || x.raw || x.yape) ? ' ' + btn('Pagar', 'retomar', { id: x.codigo }, 'sec') : ''}${textoPlazo(x)} ${x.reclamado ? '<small class="vv-dim">Avisado</small>' : btn('¿Problema?', 'reclamo', { id: x.codigo }, 'sec')}</span></div>`).join('') + '</div>'
      + `<p class="vv-nota">Las compras se entregan a mano de ${esc(ENTREGA.horario)}, ${esc(ENTREGA.plazo)}. Te avisamos al entregarlas. ¿Algo salió mal? Pulsa «¿Problema?» y El Duende lo revisa. <a href="/reembolsos.html" target="_blank" rel="noopener" style="color:inherit">Entregas y reembolsos</a></p>`;
  }
  return h;
}

// «Pagado hace 14 min · plazo hasta 16:40» (entrega manual, plazo honesto de ENTREGA).
function textoPlazo(x) {
  if (!x.pagadoEn || (x.estado !== 'pagado' && x.estado !== 'por_verificar')) return '';
  const min = Math.max(0, Math.round((Date.now() - x.pagadoEn) / 60000));
  const hace = min < 60 ? min + ' min' : min < 1440 ? Math.floor(min / 60) + ' h' : Math.floor(min / 1440) + ' d';
  const fin = new Date(x.pagadoEn + ENTREGA.plazoMaxH * 3600000);
  let hasta = '';
  try { hasta = fin.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }); } catch (e) { hasta = fin.getHours() + ':' + String(fin.getMinutes()).padStart(2, '0'); }
  if (fin.toDateString() !== new Date().toDateString()) hasta = (fin - Date.now() < 86400000 * 2 && fin > Date.now() ? 'mañana ' : fin.toLocaleDateString('es-PE') + ' ') + hasta;
  return `<small class="vv-plazo">Pagado hace ${hace} · plazo hasta ${esc(hasta)}</small>`;
}

// ═══════════════════ PAGO A PRUEBA DE CIERRES ═══════════════════
// El pedido de SOL/$DUENDE abierto se guarda en la pestaña (sessionStorage):
// si se cierra la ventana o se recarga, la franja de arriba vuelve a los datos.
const CLAVE_PAGO = 'dq_pago';
// Reabrir el mismo pedido desde la franja conserva su hora (no alarga los 30 min).
function guardarPago(m) { try { let t = Date.now(); const g = JSON.parse(sessionStorage.getItem(CLAVE_PAGO) || 'null'); if (g && g.m && g.m.codigo === m.codigo && g.t) t = g.t; sessionStorage.setItem(CLAVE_PAGO, JSON.stringify({ m, t })); } catch (e) {} }
function olvidarPago() { try { sessionStorage.removeItem(CLAVE_PAGO); } catch (e) {} }
function pagoGuardado() {
  let g = null;
  try { g = JSON.parse(sessionStorage.getItem(CLAVE_PAGO) || 'null'); } catch (e) { g = null; }
  if (!g || !g.m || !g.m.codigo || Date.now() - (g.t || 0) > (g.m.t === 'pedidoYape' ? YAPE_VIGENCIA_MS : PEDIDO_VIGENCIA_MS)) { if (g) olvidarPago(); return null; }
  const y = H && H.yo(), x = y && (y.pedidos || []).find(p => p.codigo === g.m.codigo);
  // Ya pagado, anulado o caducado en el servidor: no se insiste (recien creado puede no estar aun).
  if (y && y.pedidos && (x ? x.estado !== 'esperando_pago' : Date.now() - g.t > 60000)) { olvidarPago(); return null; }
  return g.m;
}
function pintarFranja() {
  const fr = document.getElementById('vv-franja'); if (!fr || !H) return;
  const y = H.yo();
  // Pago con Stars desde la web: al llegar pagado se cierra la ventana (evita pagar doble).
  if (facturaWebCod && y && ((y.pedidos || []).some(x => String(x.codigo) === facturaWebCod && (x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'comprobando')))) {
    if (abierta(IDS.pago) && !pagoActual) cerrarV(IDS.pago);
    H.aviso('✅ Pago recibido. ' + textoPagoRecibido(), 'ok');
    facturaWebCod = '';
  }
  const p = !abierta(IDS.pago) ? pagoGuardado() : null;
  const enCamino = ((y && y.pedidos) || []).filter(x => x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'comprobando').length;
  const txt = p ? `💳 Pedido #${p.codigo} pendiente: ver datos` : enCamino ? `📦 ${enCamino} compra${enCamino > 1 ? 's' : ''} en camino` : '';
  if (fr.textContent !== txt) fr.textContent = txt;
  fr.classList.toggle('pend', !!p);
  fr.style.display = txt ? 'block' : 'none';
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
  // Meta comunitaria de la temporada «Entre todos» (mundo.js guarda el ultimo tg del servidor).
  const tgG = window.dqTempG;
  if (tgG && tgG.fin > Date.now() && tgG.meta > 0) {
    const pc = Math.round(Math.min(1, tgG.n / tgG.meta) * 100), fel = tgG.feliz > Date.now();
    h += `<div class="vv-p" style="margin:-4px 0 10px;padding:6px 8px;border-radius:8px;background:rgba(74,222,128,.10);border:1px solid rgba(74,222,128,.35)">🤝 <b>Entre todos:</b> ${fmt(tgG.n)} / ${fmt(tgG.meta)} ${esc(tgG.cosas || '')} ${esc(tgG.emoji || '')}<div class="vv-barra"><i style="width:${pc}%"></i></div><span class="vv-dim">${fel ? '🎉 ¡Hora Feliz de todos activa! +50% de experiencia por caza.' : (tgG.n >= tgG.meta ? '¡Cumplimos todas las metas de esta temporada!' : 'Cada meta cumplida da 1 h de Hora Feliz para todos.')}</span></div>`;
  }
  // Meta a la vista: el logro pendiente mas avanzado (desde la mitad) arriba de todo.
  let sig = null, sigR = 0.5;
  for (const L of LOGROS) {
    if (tienen.includes(L.id)) continue;
    let p = null; try { p = progresoLogro(L.id, { ...y, amigos: y.amigosN || 0 }); } catch (e) { p = null; }
    if (!p || !(p[1] > 0)) continue;
    const r = p[0] / p[1];
    if (r >= sigR && r < 1) { sig = { L, p }; sigR = r; }
  }
  if (sig) h += `<div class="vv-p" style="text-align:center;margin:-4px 0 10px;padding:6px 8px;border-radius:8px;background:rgba(255,216,74,.10);border:1px solid rgba(255,216,74,.35)">🎯 Siguiente: <b style="color:var(--oro)">${esc(sig.L.titulo)}</b> ${fmt(sig.p[0])}/${fmt(sig.p[1])}${sig.L.oro ? ' · +' + fmt(sig.L.oro) + ' oro' : ''}</div>`;
  if (y.titulo) h += btn('Quitar título', 'titulo', { id: '' }, 'sec vv-full') + '<div style="height:8px"></div>';
  const lista = LOGROS.filter(L => est.logros === 'todos' || (est.logros === 'hechos') === tienen.includes(L.id));
  if (!lista.length) h += `<p class="vv-vacio">${est.logros === 'hechos' ? 'Aún no tienes logros: caza, vence jefes y explora para conseguirlos.' : '¡Los tienes todos!'}</p>`;
  h += '<div class="vv-lista">';
  for (const L of lista) {
    const ok = tienen.includes(L.id);
    const acc = !ok ? (L.oro ? `<span class="vv-precio" style="opacity:.75">+${MON}${fmt(L.oro)}</span>` : '<span class="vv-precio" style="opacity:.75">Título</span>')
      : y.titulo === L.id ? etq('✓ En uso', 'vv-ok') : btn('Usar título', 'titulo', { id: L.id }, 'sec');
    let pr = null;
    if (!ok) try { pr = progresoLogro(L.id, { ...y, amigos: y.amigosN || 0 }); } catch (e) { pr = null; }
    const barra = pr && pr[0] > 0 ? `<div class="vv-barra"><i style="width:${Math.round(pr[0] / pr[1] * 100)}%"></i></div><span class="vv-dim">${fmt(pr[0])} / ${fmt(pr[1])}</span>` : '';
    h += tarjeta(icoEquipo('Ac_Medal02', !ok), `<span class="${ok ? '' : 'vv-dim'}" style="${ok ? 'color:var(--oro)' : ''}">${esc(L.titulo)}</span>`, esc(L.desc) + barra, acc, ok ? ' style="--rz:var(--oro)"' : '');
  }
  parte(id, 'cuerpo').innerHTML = h + '</div>';
}

// ═══════════════════ EXPEDICION (functions/mmo/expediciones.js) ═══════════════════
// Copia de cajaExpedicion del 2D (client.js): tu mascota (o un duendecillo)
// sale 1, 4 u 8 h y vuelve con oro, XP y materiales. La primera vez, una de
// 15 min para que vea el ciclo entero en la misma partida.
const textoMin = ms => { const tot = Math.max(1, Math.ceil(ms / 60000)), hh = Math.floor(tot / 60), mm = tot % 60; return (hh ? hh + ' h' : '') + (hh && mm ? ' ' : '') + (mm || !hh ? mm + ' min' : ''); };
function pintarExped() {
  const y = H.yo(); if (!y) return;
  const id = IDS.exped, ex = y.exped;
  const masc = y.mascota && MASCOTAS[y.mascota];
  const quien = masc ? masc.nombre : 'Un duendecillo explorador';
  parte(id, 'sub').innerHTML = `<span>Expediciones hechas: <b>${fmt(y.expediciones || 0)}</b></span>`;
  let h = '';
  if (y.nivel < EXPEDICION.nv) h = `<p class="vv-vacio">Las expediciones se abren a nivel ${EXPEDICION.nv}. ¡Caza un poco y vuelve!</p>`;
  else if (!ex) {
    let dest = 'bosque'; try { dest = localStorage.getItem('dq_exped') || 'bosque'; } catch (e) {}
    if (!EXPEDICION.destinos[dest]) dest = 'bosque';
    h += `<p class="vv-p">${esc(quien)} explora mientras no juegas y vuelve con oro, experiencia y el doble de materiales de su destino${masc ? '; con tu mascota, +15% de oro' : '. Con una mascota, +15% de oro'}. Una a la vez.</p>`;
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + Object.entries(EXPEDICION.destinos).map(([k, d]) => btn(`${d.emoji} ${esc(d.nombre)}<br><small>×${d.mat === 'pescado' ? 3 : 2} ${esc(MATERIALES[d.mat].nombre)}</small>`, 'exdest', { id: k }, k === dest ? '' : 'sec')).join('').replace(/<button /g, '<button style="flex:1;min-width:84px;white-space:normal;line-height:1.25;padding:8px 6px" ') + '</div>';
    // La de 15 min solo si aun no recogio ninguna (el servidor lo vuelve a mirar).
    const horas = (y.expediciones ? [] : [EXPEDICION.primera]).concat(EXPEDICION.horas);
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">' + horas.map(hh => {
      const pr = premioExpedicion(hh, y.nivel, dest); if (masc) pr.oro = Math.round(pr.oro * 1.15);
      return btn(`${hh < 1 ? Math.round(hh * 60) + ' min' : hh + ' h'}<br><small>🪙 ${fmt(pr.oro)}</small>`, 'exped', { h: hh, d: dest }, hh < 1 ? '' : 'sec');
    }).join('').replace(/<button /g, '<button style="flex:1;min-width:70px;padding:8px 6px;line-height:1.25" ') + '</div>';
    if (!y.expediciones) h += '<p class="vv-p" style="color:#4ade80">✨ Primera vez: prueba la de 15 min y recógela en esta misma partida.</p>';
  } else {
    const ms = ex.fin - Date.now(), d = EXPEDICION.destinos[ex.d] || EXPEDICION.destinos.bosque;
    if (ms <= 0) h += `<p class="vv-p" style="text-align:center;font-size:14px">${d.emoji} ${esc(quien)} ya volvió ${esc(d.a.replace(/^al /, 'del ').replace(/^a la /, 'de la '))}.</p>` + btn('Recoger', 'exrec', {}, 'vv-full') + (EXPEDICION.horas.includes(ex.h) && y.nivel >= EXPEDICION.nv ? btn(`🔁 Recoger y repetir (${ex.h} h)`, 'exrep', { h: ex.h, d: ex.d || 'bosque' }, 'sec vv-full').replace('<button ', '<button style="margin-top:6px" ') : '');
    else h += `<p class="vv-p" style="text-align:center">${d.emoji} ${esc(quien)} está ${esc(d.a.replace(/^al /, 'en el ').replace(/^a la /, 'en la '))}: vuelve en <b>${textoMin(ms)}</b>.</p><div class="vv-barra"><i style="width:${Math.round(Math.min(1, 1 - ms / Math.max(1, ex.fin - ex.ini)) * 100)}%"></i></div><p class="vv-p">Puedes cerrar el juego: la expedición sigue sola.</p>`;
  }
  parte(id, 'cuerpo').innerHTML = h;
}

// ═══════════════════ PAGOS (SOL / $DUENDE / Stars) ═══════════════════
// Telegram abre su propia ventana de pago de Stars.
// Desde la web (sin Mini App): ventana con el enlace (movil: un toque abre
// Telegram, sin bloqueo de emergentes) y un QR en PC para pagar desde el celular.
function abrirFactura(m) {
  evCompra('fa');
  window.dqPagoT = Date.now();   // con un pago abierto no se recarga por version nueva (mundo.js)
  const tg = TG() || (window.Telegram && window.Telegram.WebApp);
  if (!tg || !tg.openInvoice || !tg.initData) { mostrarFacturaWeb(m); return; }
  tg.openInvoice(m.link, st => {
    if (st === 'paid') H.aviso('Pago recibido. ' + textoPagoRecibido(), 'ok');
    else if (st === 'failed') { H.mandar({ t: 'pedidoCancelar', codigo: m.codigo }); H.aviso('El pago no se completó (no se te cobró). Puedes reintentar desde la tienda.', 'err'); }
    else if (st === 'cancelled') { H.mandar({ t: 'pedidoCancelar', codigo: m.codigo }); reintentarFactura(tg, m); }
  });
}
// Cerro la factura sin pagar: un toque para volver a abrirla (el enlace sigue
// valiendo un rato). Sin ventana emergente de Telegram (versiones viejas), solo el aviso.
function reintentarFactura(tg, m) {
  try {
    if (tg.showPopup && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.2'))) {
      tg.showPopup({ title: 'Pago sin terminar', message: 'Cerraste el pago antes de terminar. Tu pedido sigue abierto unos minutos.', buttons: [{ id: 'si', type: 'default', text: 'Reintentar' }, { type: 'cancel' }] }, id => { if (id === 'si') abrirFactura(m); });
      return;
    }
  } catch (e) {}
  H.aviso('Cerraste el pago sin terminar. Puedes volver a intentarlo desde la tienda.');
}
// Embudo de compra (/ventas del dueño): vio la tienda premium (tv) o abrio una
// factura (fa). Una vez por sesion; el servidor ademas lo cuenta una vez al dia.
function evCompra(k) {
  const ya = evCompra.ya || (evCompra.ya = new Set());
  if (ya.has(k) || !H || !H.mandar) return;
  ya.add(k); H.mandar({ t: 'ev', k });
}
function mostrarFacturaWeb(m) {
  if (!/^https:\/\/t\.me\//.test(String(m.link || ''))) { H.aviso('No se pudo abrir el pago con Stars.', 'err'); return; }
  const id = IDS.pago;
  pagoActual = null;
  facturaWebCod = String(m.codigo || '');
  // Paquete y monto antes de ir a Telegram (el mensaje 'factura' no trae el paquete:
  // se toma el ultimo que se pidio, o el pedido con ese codigo si ya figura).
  const xPd = (((H && H.yo && H.yo()) || {}).pedidos || []).find(p => String(p.codigo) === String(m.codigo));
  const pqF = PAQUETES.find(p => p.id === (m.id || (xPd && xPd.paquete) || est.ultPedidoId)) || (xPd && xPd.usd ? { nombre: xPd.nombre || '', usd: xPd.usd } : null);
  const montoF = pqF ? `<p class="vv-p" style="text-align:center;margin-bottom:6px"><b>${esc(pqF.nombre)}</b> · ${estrellasDe(pqF.usd)} ⭐ (≈ ${solesDeStars(estrellasDe(pqF.usd))})</p>` : '';
  parte(id, 't').textContent = 'PAGAR CON STARS';
  parte(id, 'sub').innerHTML = `<span>Pedido <b>#${esc(m.codigo)}</b></span>`;
  parte(id, 'cuerpo').innerHTML =
    `<p class="vv-p">Se paga dentro de Telegram con Stars (puedes comprarlas con tarjeta allí mismo).</p>` + montoF +
    `<p class="vv-nota" style="margin-bottom:8px">Si no tienes Telegram, instálalo gratis: Telegram te vende las Stars con tarjeta y te muestra el total antes de pagar.</p>` +
    `<a class="btn" href="${esc(m.link)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;padding:12px;margin-bottom:10px">⭐ Abrir Telegram y pagar</a>` +
    (TACTIL ? '' : `<p class="vv-p">O escanea con la cámara de tu celular:</p><div class="vv-qr" data-qr></div>`) +
    `<p class="vv-p" style="margin-top:10px">Tienes 3 horas para pagarlo (si necesitas instalar Telegram o comprar Stars, no hay apuro). ${esc(textoPagoRecibido())} Si cierras esta ventana, vuelve a pulsar el mismo paquete y te sale el mismo pedido.</p>`;
  const c = parte(id, 'cuerpo');
  abrirV(id);
  if (!TACTIL) cargarScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1').then(() => {
    const q0 = c.querySelector('[data-qr]');
    if (!q0 || !window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(m.link); q.make();
    q0.innerHTML = q.createImgTag(4, 8);
    const img = q0.querySelector('img'); if (img) img.alt = 'QR del pago con Stars';
  }).catch(() => { const q0 = c.querySelector('[data-qr]'); if (q0) q0.textContent = ''; });
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
  pagoActual = m; guardarPago(m);
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
    `<p class="vv-p" style="margin-top:10px">Tienes 30 minutos. El pago va directo a la wallet de El Duende. ${esc(textoPagoRecibido())} Si cierras esta ventana, la franja de arriba te devuelve a estos datos.</p>`;
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
      H.aviso('Abriendo el juego dentro de Solflare: entra con tu cuenta y, en Tienda → 💎 PAQUETES → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
      window.location.href = 'https://solflare.com/ul/v1/browse/' + encodeURIComponent(location.origin + location.pathname + location.search) + '?ref=' + encodeURIComponent(location.origin);
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
      H.aviso('Abriendo el juego dentro de Phantom: entra con tu cuenta y, en Tienda → 💎 PAQUETES → Tus compras, pulsa «Pagar» en el pedido #' + m.codigo + '.', 'ok');
      window.location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.origin + location.pathname + location.search) + '?ref=' + encodeURIComponent(location.origin);
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
  window.dqPagoT = Date.now();   // Yape / SOL tambien: quien vuelve de su app de pago no se recarga (mundo.js, version nueva)
  if (m.t === 'factura') abrirFactura(m);
  else if (m.t === 'pedidoSol') mostrarPedidoSol(m);
  else if (m.t === 'pedidoYape') mostrarPedidoYape(m);
  // El servidor recibio el numero de operacion: se cierra la ventana y la franja.
  else if (m.t === 'yapeOk') { if (pagoActual && pagoActual.codigo === m.codigo) { olvidarPago(); cerrarV(IDS.pago); } }
}
// Yape / Plin (PAGO_LOCAL): monto exacto en soles, #codigo en la nota y el
// numero de operacion. NADA se entrega solo: El Duende lo revisa en su app.
function mostrarPedidoYape(m) {
  if (!m || !m.numero) { H.aviso('El pago con Yape / Plin aún no está disponible.', 'err'); return; }
  pagoActual = m; guardarPago(m);
  const id = IDS.pago;
  let hora = '';
  try { hora = new Date(m.vence).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }); } catch (e) { hora = ''; }
  if (hora && new Date(m.vence).toDateString() !== new Date().toDateString()) hora += ' de mañana';
  parte(id, 't').textContent = 'PAGAR CON YAPE / PLIN';
  parte(id, 'sub').innerHTML = `<span>${esc(m.nombre)} · pedido <b>#${esc(m.codigo)}</b></span>`;
  parte(id, 'cuerpo').innerHTML =
    `<div class="vv-monto"><b>S/ ${esc(m.monto)}</b><small>Yapea este monto <b>exacto</b> (con sus céntimos): así sabemos que es tu pedido</small></div>` +
    (/^\/[\w/.-]+$/.test(m.qr || '') ? `<div class="vv-qr"><img src="${esc(m.qr)}" alt="QR de Yape de El Duende" style="width:180px;max-width:70%;background:#fff;border-radius:8px;padding:6px"></div>` : '') +
    `<p class="vv-p">1. Yapea o plinea al número <b style="font-size:15px;white-space:nowrap">${esc(m.numero)}</b>${m.titular ? ` (${esc(m.titular)})` : ''}.</p>` +
    `<div class="vv-fila2" style="margin-top:6px"><button class="btn sec" data-p="num">Copiar número</button><button class="btn sec" data-p="monto">Copiar monto</button></div>` +
    `<p class="vv-p">2. En la nota del yapeo escribe <b>#${esc(m.codigo)}</b>. <button class="btn sec" data-p="cod" style="padding:3px 8px">Copiar</button></p>` +
    `<p class="vv-p">3. Pega aquí el número de operación del comprobante:</p>` +
    `<input class="vv-input" data-op inputmode="numeric" maxlength="16" placeholder="Nº de operación (solo cifras)" autocomplete="off" spellcheck="false">` +
    `<button class="btn" data-p="ok" style="width:100%;padding:12px">✅ Ya pagué: enviar operación</button>` +
    `<p class="vv-p" style="margin-top:10px">${hora ? 'Tienes hasta las ' + esc(hora) + '. ' : ''}Cada número de operación vale para un solo pedido. ${esc(textoPagoRecibido())} Si cierras esta ventana, la franja de arriba te devuelve a estos datos.</p>`;
  const c = parte(id, 'cuerpo');
  const copiar = t => {
    try { navigator.clipboard.writeText(t).then(() => H.aviso('Copiado', 'ok'), () => H.aviso('No se pudo copiar: cópialo a mano.', 'err')); } catch (e) { H.aviso('No se pudo copiar: cópialo a mano.', 'err'); }
  };
  const inp = c.querySelector('[data-op]');
  const enviar = () => {
    const op = inp.value.replace(/[\s-]/g, '');
    if (!/^\d{6,12}$/.test(op)) { H.aviso('El número de operación son solo cifras (de 6 a 12). Lo ves en el comprobante.', 'err'); return; }
    if (Date.now() - (est.ultYape || 0) < 4000) return;
    est.ultYape = Date.now();
    H.sfx('boton', 0.3); H.mandar({ t: 'pedidoYapeOk', codigo: m.codigo, operacion: op });
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') enviar(); });
  c.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (p === 'num') copiar(String(m.numero).replace(/\s/g, ''));
    else if (p === 'monto') copiar(m.monto);
    else if (p === 'cod') copiar('#' + m.codigo);
    else if (p === 'ok') enviar();
  });
  abrirV(id);
}

// ═══════════════════ ACCIONES (delegadas por ventana) ═══════════════════
const ACC = {
  // Inventario
  itab: b => { est.inv = b.dataset.id; H.sfx('boton', 0.2); pintarInventario(); },
  ranura: b => { est.ranura = est.ranura === b.dataset.id ? '' : b.dataset.id; H.sfx('boton', 0.2); pintarInventario(); },
  quitar: b => { H.sfx('boton', 0.3); H.mandar({ t: 'item', a: 'quitar', ranura: b.dataset.id }); est.ranura = ''; },
  filtro: b => { est.filtro = b.dataset.id; pintarInventario(); },
  'equipar-item': b => { H.sfx('boton', 0.3); H.mandar({ t: 'item', a: 'equipar', id: b.dataset.id }); },
  // Reforjar (junto a la Artesana) pide un segundo toque: la linea nueva puede salir peor.
  reforjar: b => {
    if (!confirmar('reforjar:' + b.dataset.id)) { marcarSeguro(b); return; }
    H.sfx('moneda', 0.3); H.mandar({ t: 'item', a: 'reforjar', id: b.dataset.id });
  },
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
    if (y) comunesVendibles(y).forEach(x => H.mandar({ t: 'item', a: 'vender', id: x.id }));
  },
  equipar: b => { H.sfx('boton', 0.3); H.mandar({ t: 'equipar', k: b.dataset.k, id: b.dataset.id }); },
  probarSkin: b => { if (!H.probarSkin || !SKINS[b.dataset.id]) return; H.sfx('boton', 0.2); H.probarSkin(b.dataset.id); },
  'ir-tienda': b => { abrirTienda(b.dataset.id, undefined, 'oro'); },
  // «Te faltan N de oro»: a la tienda premium con el paquete justo resaltado.
  'ir-tienda-foco': b => { H.sfx('boton', 0.2); abrirTienda('premium', b.dataset.id || '', 'falta'); },
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
  // Candados contra doble toque (en movil un toque doble compraba dos veces o creaba dos pedidos).
  comprar: b => { if (Date.now() - (est.ultCompra || 0) < 600) return; est.ultCompra = Date.now(); H.sfx('boton', 0.3); H.mandar({ t: 'comprar', k: b.dataset.k, id: b.dataset.id, n: +b.dataset.n || 1 }); },
  premium: b => { if (Date.now() - (est.ultPedido || 0) < 2500) return; est.ultPedido = Date.now(); est.ultPedidoId = b.dataset.id; H.sfx('boton', 0.3); H.mandar({ t: 'pedido', id: b.dataset.id, metodo: b.dataset.metodo, via: est.via }); H.aviso('Preparando tu pedido…', 'ok'); },
  retomar: b => {
    const y = H.yo(), x = ((y && y.pedidos) || []).find(p => p.codigo === b.dataset.id);
    if (x && x.yape) mostrarPedidoYape(x.yape);
    else if (x && x.raw) mostrarPedidoSol({ metodo: 'duende', codigo: x.codigo, raw: x.raw, mint: x.mint, dec: x.dec, wallet: x.wallet, usd: x.usd, nombre: x.nombre });
    else if (x && x.lamports) mostrarPedidoSol({ codigo: x.codigo, lamports: x.lamports, wallet: x.wallet, usd: x.usd, nombre: x.nombre, ref: x.ref });
  },
  // «¿Problema?» en Tus compras: avisa al dueño de ese pedido (el servidor limita los avisos).
  reclamo: b => {
    H.sfx('boton', 0.3); b.disabled = true; b.textContent = 'Avisando…';
    H.mandar({ t: 'reclamoPedido', codigo: b.dataset.id });
    setTimeout(() => { if (b.isConnected && b.disabled) { b.disabled = false; b.textContent = '¿Problema?'; } }, 5000);
  },
  cuenta: b => {
    if (H.iniciarSesion) H.iniciarSesion();
    else {
      // La cuenta se abre en CLASSIC (#cuenta) y, al entrar, vuelve aquí con la tienda en el paquete que quería (&f=; localStorage por si el correo abre otra pestaña).
      H.aviso('Entra o crea tu cuenta gratis con tu correo: al terminar vuelves aquí a la tienda.', 'ok');
      const f = b && b.dataset && /^[\w-]+$/.test(b.dataset.id || '') ? '&f=' + b.dataset.id : '';
      try { sessionStorage.setItem('dq_volver', '/mundo/#premium' + f); localStorage.setItem('dq_volver', '/mundo/#premium' + f); } catch (e) {}
      const hTg = TG() && location.hash && location.hash.length > 1 ? location.hash : '';
      setTimeout(() => { location.href = '/mmo/' + (hTg ? hTg + '&cuenta&volver=mundo' : '#cuenta&volver=mundo'); }, 900);
    }
  },
  // Logros
  lgtab: b => { est.logros = b.dataset.id; H.sfx('boton', 0.2); pintarLogros(); },
  titulo: b => { H.sfx('boton', 0.3); H.mandar({ t: 'titulo', id: b.dataset.id }); },
  // Expedicion
  exdest: b => { H.sfx('boton', 0.2); try { localStorage.setItem('dq_exped', b.dataset.id); } catch (e) {} pintarExped(); },
  exped: b => { H.sfx('boton', 0.4); H.mandar({ t: 'exped', h: +b.dataset.h, d: b.dataset.d }); },
  exrec: b => { H.sfx('moneda', 0.5); H.mandar({ t: 'exped', recoger: 1 }); },
  exrep: b => { H.sfx('moneda', 0.5); H.mandar({ t: 'exped', recoger: 1, repetir: 1 }); },   // el servidor la relanza con las mismas horas y destino
  // Tienda de la fiesta: los de una vez piden doble toque (no se devuelven).
  ttemp: b => {
    if (b.dataset.una === '1' && !confirmar('tt' + b.dataset.id)) { marcarSeguro(b); return; }
    H.sfx('moneda', 0.4); H.mandar({ t: 'tiendaTemp', id: b.dataset.id });
  },
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
function abrirTienda(tab, foco, via) {
  if (!H || !H.yo()) return;
  if (typeof tab === 'string') est.tienda = tab;
  est.via = via === 'hud' || via === 'oro' || via === 'bot' || via === 'falta' || via === 'bienv' || via === 'revivir' ? via : 'npc';
  est.foco = typeof foco === 'string' ? foco : '';
  pintarTienda(); abrirV(IDS.tienda);
  if (est.foco) requestAnimationFrame(() => { try { const c = parte(IDS.tienda, 'cuerpo'), f = c.querySelector('.vv-item.foco'); if (f) c.scrollTop += f.getBoundingClientRect().top - c.getBoundingClientRect().top - (c.clientHeight - f.offsetHeight) / 2; } catch (e) {} });   /* solo el cuerpo: scrollIntoView movía también body/.modal (overflow:hidden) y descuadraba el HUD en móvil */
}
function abrirLogros() {
  if (!H || !H.yo()) return;
  pintarLogros(); abrirV(IDS.logros);
}
function abrirExpedicion() {
  if (!H || !H.yo()) return;
  pintarExped(); abrirV(IDS.exped);
}
// ═══════════════════ TIENDA DE LA FIESTA ═══════════════════
// Puesto de la Abuela en la plaza: se paga SOLO con el objeto del evento
// (data TEMPORADAS[].tienda; el servidor valida y descuenta en tiendaTemp).
// La fiesta segun el reloj del servidor ('yo'.temp): con el reloj del movil
// adelantado o atrasado, el saldo no llegaba nunca y los botones quedaban grises.
function tempDelServidor(y) { return y && typeof y.temp === 'string' ? TEMPORADAS.find(x => x.id === y.temp) || null : temporadaDe(); }
function pintarTiendaTemp() {
  const y = H.yo(); if (!y) return;
  const tp = tempDelServidor(y), sub = parte(IDS.ttemp, 'sub'), cu = parte(IDS.ttemp, 'cuerpo');
  parte(IDS.ttemp, 't').textContent = tp ? 'TIENDA DE LA FIESTA ' + tp.emoji : 'TIENDA DE LA FIESTA';
  if (!tp || !tp.tienda) {
    const prox = TEMPORADAS.filter(x => x.ini > Date.now()).sort((a, b) => a.ini - b.ini)[0];
    sub.innerHTML = '';
    cu.innerHTML = `<p class="vv-nota" style="font-size:14px;text-align:center;margin:18px 0">La Abuela guardó su puesto. Vuelve en la próxima fiesta${prox ? `: ${prox.emoji} <b>${esc(prox.nombre)}</b>` : ''}.</p>`;
    return;
  }
  const est0 = ttemp && ttemp.tp === tp.id ? ttemp : null;
  const saldo = est0 ? est0.saldo : null, comprado = est0 ? est0.comprado || [] : [];
  sub.innerHTML = `<span>Tienes <b style="color:${tp.color}">${saldo === null ? '…' : fmt(saldo)} ${esc(tp.cosas)} ${tp.emoji}</b></span><span>hasta el ${esc(tp.hasta)}</span>`;
  let h = '<div class="vv-lista">';
  for (const a of tp.tienda) {
    const ya = a.una && comprado.includes(a.id);
    const desc = a.premio.titulo ? 'Exclusivo de esta fiesta: sale bajo tu nombre. Es tuyo para siempre.'
      : a.premio.tinte ? 'Tu nombre de este color en ORIGINS y CLASSIC. Es tuyo para siempre (cámbialo en la tienda).'
      : a.premio.oroNivel ? `Ahora: ${fmt(a.premio.oroNivel * (y.nivel || 1))} de oro. Cómpralo las veces que quieras.`
      : 'Para el camino. Cómpralo las veces que quieras.';
    const ico = a.premio.tinte && TINTES[a.premio.tinte] ? muestraTinte(TINTES[a.premio.tinte]) : `<span style="font-size:28px">${a.emoji}</span>`;
    const acc = ya ? etq('✓ Ya es tuyo', 'vv-ok') : `<span class="vv-precio" style="color:${tp.color}">${tp.emoji} ${a.costo}</span>` + btn('Canjear', 'ttemp', { id: a.id, una: a.una ? '1' : '0' }, '', saldo === null || saldo < a.costo);
    h += tarjeta(ico, esc(a.nombre), desc, acc, ` style="--rz:${tp.color}"`);
  }
  cu.innerHTML = h + `</div><p class="vv-nota">Los monstruos sueltan ${esc(tp.cosas)} durante la fiesta (los jefes, varias). Canjear no te quita los logros: cuentan todo lo que juntaste.</p>`;
}
function abrirTiendaTemp() {
  if (!H || !H.yo()) return;
  if (tempDelServidor(H.yo())) H.mandar({ t: 'tiendaTemp' });   // pide saldo y lo ya comprado
  pintarTiendaTemp(); abrirV(IDS.ttemp);
}
// Respuesta del servidor ('tiendaTemp'): guarda el estado y repinta si esta abierta.
function alTiendaTemp(m) {
  ttemp = m && m.tp ? m : null;
  if (H && abierta(IDS.ttemp)) pintarTiendaTemp();
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
  if (abierta(IDS.exped)) pintarExped();
  if (abierta(IDS.ttemp)) pintarTiendaTemp();
  pintarFranja();
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
    probarSkin: o.probarSkin,         // opcional: probador 3D de skins (ORIGINS)
  };
  if (!listo) {
    listo = true;
    const st = document.createElement('style'); st.id = 'vv-css'; st.textContent = CSS;
    document.head.appendChild(st);
    delegar(crearModal(IDS.inv, 'INVENTARIO'));
    delegar(crearModal(IDS.libro, 'LIBRO DE CLASE'));
    delegar(crearModal(IDS.tienda, 'MERCADER'));
    delegar(crearModal(IDS.logros, 'LOGROS'));
    delegar(crearModal(IDS.exped, 'EXPEDICIÓN', true));
    delegar(crearModal(IDS.ttemp, 'TIENDA DE LA FIESTA', true));
    // Cuenta atras de la expedicion en camino (sin repintar mientras elige destino y horas).
    setInterval(() => { const y = H.yo(); if (abierta(IDS.exped) && y && y.exped) pintarExped(); }, 5000);
    crearModal(IDS.pago, 'PAGAR', true, true);
    // Franja «Pedido #X pendiente» / «N compras en camino».
    const fr = document.createElement('div'); fr.id = 'vv-franja'; fr.setAttribute('role', 'button');
    fr.onclick = () => { const p = pagoGuardado(); if (p && fr.classList.contains('pend')) (p.t === 'pedidoYape' ? mostrarPedidoYape : mostrarPedidoSol)(p); else abrirTienda('premium'); };
    document.body.appendChild(fr);
    setInterval(pintarFranja, 2000);
  }
  return { abrirInventario, abrirLibro, abrirTienda, abrirLogros, abrirExpedicion, abrirTiendaTemp, alTiendaTemp, actualizar, alPedido, compararConPuesta,
    // Probador 3D: el mismo precio y botones de compra que la tarjeta de la tienda, y sus clics.
    compraSkin: id => { const y = H.yo(), d = SKINS[id]; return y && d ? ((y.skins || []).includes(id) ? (y.skin === id ? etq('✓ Equipado', 'vv-ok') : btn('Equipar', 'equipar', { k: 'skin', id }, '')) : accPrecio(y, 'skin', id, d)) : ''; },
    delegarCompra: el => delegar(el) };
}
