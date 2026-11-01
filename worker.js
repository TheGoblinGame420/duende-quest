// DUENDE QUEST — Cloudflare Worker entry point
// Routes API requests to functions, serves static files for everything else

import telegramBot from './functions/api/telegram-bot.js';
import telegramInvoice from './functions/api/telegram-bot-invoice.js';
import heliusVerify from './functions/api/helius-verify.js';
import walletApi from './functions/api/wallet.js';
import tokenStats from './functions/api/token-stats.js';
import { runCron } from './functions/api/cron.js';
export { MmoWorld } from './functions/mmo/world.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const context = { request, env, ctx };

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
        const EV = ['carga_ini', 'arte_ok', 'form_visto', 'clic_entrar', 'bienvenido', 'mover', 'fallo_webgl', 'oculta'];
        const ORG = ['meta', 'tg', 'wa', 'ref', 'org'];
        if (!b || !EV.includes(b.e) || (b.j !== 'origins' && b.j !== 'classic')) return nada;
        const limpio = { e: b.e, j: b.j, org: ORG.includes(b.org) ? b.org : 'org', ms: Number.isFinite(b.ms) ? Math.round(b.ms) : -1, movil: b.movil ? 1 : 0, tg: b.tg ? 1 : 0 };
        const ip = request.headers.get('CF-Connecting-IP') || '';
        ctx.waitUntil(env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/mmo/ev', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(limpio) }).catch(e => console.error('[MMO ev]', e)));
      } catch (e) {}
      return nada;
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
    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Strict-Transport-Security', 'max-age=31536000');
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
      headers.set('Cache-Control', 'public, max-age=604800');
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },

  // Crons: keep-alive de Supabase, recordatorio diario y torneo semanal (ver functions/api/cron.js)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(event.cron, env).catch(e => console.error('[Cron]', event.cron, e)));
  }
};
