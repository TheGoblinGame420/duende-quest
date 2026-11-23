// DUENDE QUEST — Cloudflare Worker entry point
// Routes API requests to functions, serves static files for everything else

import telegramBot from './functions/api/telegram-bot.js';
import telegramInvoice from './functions/api/telegram-bot-invoice.js';
import heliusVerify from './functions/api/helius-verify.js';
import walletApi from './functions/api/wallet.js';
import tokenStats from './functions/api/token-stats.js';
import { runCron } from './functions/api/cron.js';
import { evValido } from './functions/mmo/retencion.js';
import { tocaMudanza, respuestaMudanza } from './functions/api/mudanza.js';
import { authApi } from './functions/api/auth.js';
import { SITIO, HSTS } from './functions/api/dominio.js';
export { MmoWorld } from './functions/mmo/world.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const context = { request, env, ctx };

    // Dominio viejo (workers.dev), www y http: las paginas se mudan a
    // https://duendequest.com con el duende del jugador (functions/api/mudanza.js).
    // La API, el WebSocket y los archivos siguen sirviendose igual.
    if (tocaMudanza(request, url)) return respuestaMudanza(request, url);

    // Tu cuenta de Telegram en el navegador: OTT, canje con cookie HttpOnly y cierre de sesion (functions/api/auth.js).
    if (path.startsWith('/api/auth/')) return authApi(request, env, path);

    // Route API calls
    if (path === '/api/telegram-bot') return telegramBot.onRequestPost(context);
    if (path === '/api/telegram-bot-invoice') {
      if (request.method === 'OPTIONS') return telegramInvoice.onRequestOptions(context);
      return telegramInvoice.onRequestPost(context);
    }
    if (path === '/api/helius-verify') {
      if (request.method === 'OPTIONS') return heliusVerify.onRequestOptions(context);
      return heliusVerify.onRequestPost(context);
    }
    if (path === '/api/wallet') {
      if (request.method === 'OPTIONS') return walletApi.onRequestOptions(context);
      return walletApi.onRequestPost(context);
    }
    if (path === '/api/token-stats') {
      if (request.method === 'OPTIONS') return tokenStats.onRequestOptions(context);
      return tokenStats.onRequestGet(context);
    }
    // Antes de publicar (tools/deploy.mjs): cuantos hay conectados ({solo:1}) o
    // guardar a todos y cerrar con 1012 (functions/mmo/copias.js, mantenimiento).
    // Apagado (404) mientras el dueño no ponga el secreto DEPLOY_SECRET (16+ caracteres).
    if (path === '/api/mantenimiento') {
      const sec = String(env.DEPLOY_SECRET || '');
      if (request.method !== 'POST' || sec.length < 16 || !env.MMO) return new Response('no', { status: 404 });
      if (request.headers.get('x-deploy') !== sec) return new Response('no', { status: 403 });
      let b = {};
      try { b = await request.json(); } catch (e) {}
      const r = await env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/interno/mantenimiento', { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: JSON.stringify({ solo: b && b.solo ? 1 : 0 }) });
      return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    // Pixel de Meta (/js/medir.js): solo dice el ID publico del pixel, o '' si
    // el dueño no configuro META_PIXEL_ID y META_CAPI_TOKEN (todo apagado).
    if (path === '/api/medir') {
      const p = env.META_PIXEL_ID && env.META_CAPI_TOKEN && /^\d{5,25}$/.test(String(env.META_PIXEL_ID)) ? String(env.META_PIXEL_ID) : '';
      return new Response(JSON.stringify({ p }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
    }
    // Embudo de la carga del juego (beacon de /js/origen.js). Publico: aqui solo
    // se valida con lista blanca y se pasa limpio al Durable Object, que limita
    // por IP y suma contadores (functions/mmo/retencion.js, evRecibir). Siempre 204.
    if (path === '/mmo/ev') {
      const nada = new Response(null, { status: 204 });
      if (request.method !== 'POST' || !env.MMO) return nada;
      try {
        const txt = await request.text();
        if (txt.length > 400) return nada;
        const b = JSON.parse(txt);
        const ORG = ['meta', 'tg', 'wa', 'etiqueta', 'ref', 'org'];
        // La lista de pasos es una sola, EV_PASOS (retencion.js): una copia aqui se quedo sin golpe1, caza1, cueva_* y los demas, y se perdian.
        if (!b || !evValido(b.e, b.j)) return nada;
        const limpio = { e: b.e, j: b.j, org: ORG.includes(b.org) ? b.org : 'org', ms: Number.isFinite(b.ms) ? Math.round(b.ms) : -1, movil: b.movil ? 1 : 0, tg: b.tg ? 1 : 0 };
        const ip = request.headers.get('CF-Connecting-IP') || '';
        ctx.waitUntil(env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/mmo/ev', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(limpio) }).catch(e => console.error('[MMO ev]', e)));
      } catch (e) {}
      return nada;
    }
    // Chicha Wars (functions/mmo/chichawars.js): su cuenta, cambio a oro y mercado, por HTTP al mismo Durable Object.
    if (path === '/mmo/cw') {
      if (request.method !== 'POST' || !env.MMO) return new Response(null, { status: 405 });
      try {
        const ip = request.headers.get('CF-Connecting-IP') || '';
        return await env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/mmo/cw', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: await request.text() });
      } catch (e) { console.error('[MMO cw]', e); return new Response(JSON.stringify({ ok: false, m: 'Servidor no disponible' }), { status: 503 }); }
    }
    // Ranking publico de la portada (functions/mmo/ranktodos.js, rankPublico):
    // cacheado 30 s en el borde para que las visitas no despierten al Durable Object.
    if (path === '/mmo/rank') {
      if (request.method !== 'GET' || !env.MMO) return new Response(null, { status: 405 });
      const clave = new Request(url.origin + '/mmo/rank');
      try {
        const guardada = await caches.default.match(clave);
        if (guardada) return guardada;
        const r0 = await env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/mmo/rank');
        const r = new Response(r0.body, { status: r0.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
        if (r.ok) ctx.waitUntil(caches.default.put(clave, r.clone()));
        return r;
      } catch (e) { console.error('[MMO rank]', e); return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
    }
    // DUENDE QUEST ONLINE: todo el mundo vive en un solo Durable Object.
    if (path === '/mmo/ws') {
      if (!env.MMO) return new Response('MMO no configurado', { status: 503 });
      try {
        return await env.MMO.get(env.MMO.idFromName('mundo-1')).fetch(request);
      } catch (e) {
        console.error('[MMO]', e);
        return new Response('MMO no disponible', { status: 503 });
      }
    }

    // Respaldo: los estaticos normales ya NO llegan aqui (run_worker_first en
    // wrangler.toml cubre solo /api/*, /mmo/ws y /mmo/ev) y toman sus
    // cabeceras de _headers. Aqui solo caen esas rutas sin match y las
    // peticiones no-navegacion a archivos que no existen; se les ponen las
    // mismas cabeceras a mano. Mantener ambas listas iguales.
    // security.txt (RFC 9116): a donde escribir si alguien encuentra un fallo de seguridad.
    // Va aqui y no como archivo para no depender de como se publican las carpetas con punto.
    if (path === '/.well-known/security.txt' || path === '/security.txt') {
      const vence = new Date(Math.floor(Date.now() / 86400000 + 330) * 86400000).toISOString();   // ~11 meses (la norma pide menos de un año)
      return new Response(['Contact: mailto:contacto@duendequest.com', 'Contact: https://t.me/ElDuendeOficial', 'Contact: ' + SITIO + '/seguridad', 'Expires: ' + vence, 'Preferred-Languages: es, en', 'Canonical: ' + SITIO + '/.well-known/security.txt', 'Policy: ' + SITIO + '/seguridad', ''].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Strict-Transport-Security': HSTS } });
    }
    // /favicon.ico: lo piden solos algunos navegadores, buscadores y vistas previas (daba 404). Es el icono de la app.
    const esIcono = path === '/favicon.ico';
    const res = await env.ASSETS.fetch(esIcono ? new Request(new URL('/assets/ui/icon-192.png', url), { method: request.method === 'HEAD' ? 'HEAD' : 'GET' }) : request);
    const headers = new Headers(res.headers);
    if (esIcono && res.ok) headers.set('Cache-Control', 'public, max-age=604800');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Strict-Transport-Security', HSTS);
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // frame-ancestors: sin esto Telegram podria no poder incrustar la Mini
    // App dentro de web.telegram.org en algunos clientes.
    headers.set('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; object-src 'none'; base-uri 'self'");
    // TON Connect: las wallets externas (Tonkeeper, etc.) leen el manifiesto
    // desde su propio origen; sin CORS aqui la conexion fallaba en silencio.
    if (path === '/tonconnect-manifest.json') headers.set('Access-Control-Allow-Origin', '*');
    // App instalable (PWA): el service worker se revisa siempre (si no, una
    // version vieja quedaria pegada) y controla todo el sitio.
    if (path === '/sw.js') { headers.set('Cache-Control', 'no-cache'); headers.set('Service-Worker-Allowed', '/'); }
    // Imagenes/audio bajo assets/ no tienen nombre de archivo con hash, asi que
    // no se puede cachear "para siempre": si se regenera un PNG con el mismo
    // nombre (ya paso con telegram_app_banner.png), un cache eterno serviria la
    // version vieja. 1 dia es un punto medio real: en una sesion de juego con
    // 19 hojas de sprites, el jugador deja de re-pedir y re-validar cada una en
    // cada recarga, y una actualizacion tarda como mucho 24h en notarse en vez
    // de nunca cachearse (el resto de rutas, HTML/JS/manifest, se despliega
    // varias veces por hora y sigue sin cache para no dejar a nadie con una
    // version vieja del motor del juego).
    // /audio/ (bg_music.ogg pesa ~600 KB) sigue la misma regla que /assets/.
    // Nunca se aplica a una respuesta HTML (p. ej. el fallback SPA) ni a errores.
    const cacheable = (res.status === 200 || res.status === 304) && !(res.headers.get('Content-Type') || '').includes('text/html');
    if (cacheable && (path.startsWith('/assets/') || path.startsWith('/audio/'))) {
      headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    } else if (cacheable && url.searchParams.has('v') && /\.(js|css)$/.test(path)) {
      // JS/CSS pedido con ?v=N (mmo/js/client.js?v=45 y su import data.js?v=45):
      // la URL cambia en cada version, asi que puede cachearse 7 dias sin
      // revalidar. REGLA: cualquier cambio en esos archivos DEBE subir el ?v=
      // (en el HTML y en el import), o el jugador seguira con el JS viejo.
      // OJO: esta rama solo corre si el Worker sirve la peticion (run_worker_first
      // en wrangler.toml no incluye /mundo/js/* ni /mmo/js/*). Los JS estaticos
      // reciben su Cache-Control de _headers (bloques /mundo/js/* y /mmo/js/*).
      headers.set('Cache-Control', 'public, max-age=604800');
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },

  // Crons: keep-alive de Supabase, recordatorio diario y torneo semanal (ver functions/api/cron.js)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(event.cron, env).catch(e => console.error('[Cron]', event.cron, e)));
  }
};
