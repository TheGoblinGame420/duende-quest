// DUENDE QUEST — Cloudflare Worker entry point
// Routes API requests to functions, serves static files for everything else

import telegramBot from './functions/api/telegram-bot.js';
import telegramInvoice from './functions/api/telegram-bot-invoice.js';
import heliusVerify from './functions/api/helius-verify.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route API calls
    if (path === '/api/telegram-bot') return telegramBot.onRequestPost({ request, env, ctx });
    if (path === '/api/telegram-bot-invoice') {
      if (request.method === 'OPTIONS') return telegramInvoice.onRequestOptions();
      return telegramInvoice.onRequestPost({ request, env, ctx });
    }
    if (path === '/api/helius-verify') {
      if (request.method === 'OPTIONS') return heliusVerify.onRequestOptions();
      return heliusVerify.onRequestPost({ request, env, ctx });
    }

    // Serve static files
    return env.ASSETS.fetch(request);
  }
};
