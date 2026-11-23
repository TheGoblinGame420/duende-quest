// ═══════════════════════════════════════════════════════
// DUENDE QUEST — mudanza del dominio viejo (workers.dev) a duendequest.com
//
// Toda PAGINA pedida en el dominio viejo se va al oficial con la misma ruta,
// parametros y #hash. Un 301 a secas dejaria a los invitados sin su duende:
// su llave vive en el localStorage de ESE origen y el servidor no la ve. Por
// eso hay dos caminos:
//   · Buscadores, vistas previas, HEAD y quien ya paso sin nada que llevar
//     (cookie dqm=0): 301 de verdad.
//   · Un navegador: pagina puente (200) que lee lo guardado (dq_*, dq3_*,
//     cw_*, la sesion de la cuenta) y salta a duendequest.com/mudanza con eso
//     en el #fragmento (no viaja al servidor ni queda en registros). Alli
//     /mudanza.html lo guarda SIN pisar nada y sigue a la ruta pedida.
// No se redirige: /api/* (webhooks del bot y de pagos), el WebSocket ni los
// archivos (JS, imagenes, manifiesto): un cliente viejo abierto sigue vivo
// hasta que recarga. Rutas que llegan aqui: run_worker_first en wrangler.toml.
//
// Desde el 22-nov-2026 se mudan igual las otras dos formas de escribir el sitio,
// para que haya UNA sola direccion (https://duendequest.com): «www.» y «http://».
// Cada una es otro origen para el navegador (otro localStorage), por eso usan el
// mismo puente y no un 301 a secas.
// ═══════════════════════════════════════════════════════
import { DOMINIO, DOMINIO_VIEJO, HOST_WWW, SITIO, HSTS } from './dominio.js';

const NO_PAGINA = ['/api/', '/mmo/ws', '/mmo/ev', '/mmo/cw', '/mmo/rank', '/interno/'];
const ROBOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|curl|wget|python|httpclient|headless|lighthouse|monitor|uptime/i;

// ¿Es una pagina (y no un archivo ni una ruta de la API)?
export function esPagina(path) {
  if (NO_PAGINA.some(p => path === p || path.startsWith(p))) return false;
  const fin = path.slice(path.lastIndexOf('/') + 1);
  return !fin.includes('.') || /\.html?$/i.test(fin);
}

export function tocaMudanza(request, url) {
  const otroOrigen = url.hostname === DOMINIO_VIEJO || url.hostname === HOST_WWW || (url.hostname === DOMINIO && url.protocol === 'http:');
  return otroOrigen && (request.method === 'GET' || request.method === 'HEAD') && esPagina(url.pathname);
}

// Corre en el NAVEGADOR: lee lo guardado y salta. Va como TEXTO (no como funcion
// con toString) para que el empaquetado del Worker no le meta ayudantes suyos
// (__name de esbuild) que en la pagina no existen.
export const PUENTE = String.raw`function (N) {
  var to = location.pathname + location.search + location.hash;
  var k = {}, n = 0, tam = 0, i, c, cs = [];
  var PRIMERO = ['dq_mmo_tok', 'dq_dt', 'dq_mmo_nombre', 'cw_estado', 'dq_save'];
  function meter(c) {
    if (Object.prototype.hasOwnProperty.call(k, c)) return;
    var v = null;
    try { v = localStorage.getItem(c); } catch (e) { return; }
    if (typeof v !== 'string' || v.length > 12000 || tam + c.length + v.length > 30000) return;
    k[c] = v; n++; tam += c.length + v.length;
  }
  try {
    for (i = 0; i < PRIMERO.length; i++) meter(PRIMERO[i]);
    for (i = 0; i < localStorage.length; i++) { c = localStorage.key(i); if (c && /^(dq_|dq3_|cw_|duende_|sb-)/.test(c)) cs.push(c); }
    cs.sort(function (a, b) { return (/^sb-/.test(b) ? 1 : 0) - (/^sb-/.test(a) ? 1 : 0); });
    for (i = 0; i < cs.length; i++) meter(cs[i]);
  } catch (e) {}
  var dest = N + to;
  if (n) {
    try {
      dest = N + '/mudanza#' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, to: to, k: k })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) { dest = N + to; }
  } else {
    // Nada que llevar: la proxima vez el servidor responde 301 directo.
    try { document.cookie = 'dqm=0; Max-Age=31536000; Path=/; Secure; SameSite=Lax'; } catch (e) {}
  }
  location.replace(dest);
}`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function respuestaMudanza(request, url) {
  const destino = SITIO + url.pathname + url.search;
  const ua = request.headers.get('User-Agent') || '';
  const yaPaso = /(?:^|;\s*)dqm=0(?:;|$)/.test(request.headers.get('Cookie') || '');
  const comunes = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': HSTS,
    'X-Robots-Tag': 'noindex'
  };
  if (request.method === 'HEAD' || yaPaso || !ua || ROBOT.test(ua)) {
    // 1 dia de cache: permanente para los buscadores, pero se puede corregir.
    return new Response(null, { status: 301, headers: { ...comunes, Location: destino, 'Cache-Control': 'public, max-age=86400', Vary: 'Cookie, User-Agent' } });
  }
  const d = esc(destino);
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><link rel="canonical" href="' + d + '"><title>Duende Quest</title>'
    + '<noscript><meta http-equiv="refresh" content="0;url=' + d + '"></noscript>'
    + '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#060b0a;color:#eaf6ef;font:16px system-ui,sans-serif;text-align:center}a{color:#f5c84c}</style>'
    + '</head><body><p>Te llevamos a duendequest.com con tu duende…<br><a href="' + d + '">Continuar</a></p>'
    + '<script>(' + PUENTE + ')(' + JSON.stringify(SITIO) + ');</script></body></html>';
  return new Response(html, {
    status: 200,
    headers: {
      ...comunes,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Cookie, User-Agent',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; base-uri 'none'"
    }
  });
}
