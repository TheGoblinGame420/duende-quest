// DUENDE QUEST — Cloudflare Worker entry point
// Routes API requests to functions, serves static files for everything else

import telegramBot from './functions/api/telegram-bot.js';
import telegramInvoice from './functions/api/telegram-bot-invoice.js';
import heliusVerify from './functions/api/helius-verify.js';
import walletApi from './functions/api/wallet.js';
import tokenStats from './functions/api/token-stats.js';
import { runCron } from './functions/api/cron.js';

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

    // Serve static files. El archivo _headers de una sesion anterior NO hace
    // nada: es una convencion de Cloudflare Pages, y este sitio es un Worker
    // con Static Assets ([assets] en wrangler.toml), que no lo lee. Las
    // cabeceras de seguridad se aplican aqui, a mano, sobre la respuesta.
    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Strict-Transport-Security', 'max-age=31536000');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // frame-ancestors: sin esto Telegram podria no poder incrustar la Mini
    // App dentro de web.telegram.org en algunos clientes.
    headers.set('Content-Security-Policy', "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org");
    // TON Connect: las wallets externas (Tonkeeper, etc.) leen el manifiesto
    // desde su propio origen; sin CORS aqui la conexion fallaba en silencio.
    if (path === '/tonconnect-manifest.json') headers.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },

  // Crons: keep-alive de Supabase, recordatorio diario y torneo semanal (ver functions/api/cron.js)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(event.cron, env).catch(e => console.error('[Cron]', event.cron, e)));
  }
};
