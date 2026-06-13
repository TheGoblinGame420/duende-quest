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

    // Serve static files
    return env.ASSETS.fetch(request);
  },

  // Crons: keep-alive de Supabase, recordatorio diario y torneo semanal (ver functions/api/cron.js)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCron(event.cron, env).catch(e => console.error('[Cron]', event.cron, e)));
  }
};
