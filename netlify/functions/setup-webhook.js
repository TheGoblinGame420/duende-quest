// One-time function to register the webhook with Telegram
// Visit: https://criptoduendesolana.netlify.app/.netlify/functions/setup-webhook
'use strict';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = 'https://criptoduendesolana.netlify.app/.netlify/functions/telegram-bot';

exports.handler = async (event) => {
  if (!BOT_TOKEN) {
    return { statusCode: 500, body: 'TELEGRAM_BOT_TOKEN not set' };
  }

  try {
    // Set webhook
    const setRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true,
        }),
      }
    );
    const setData = await setRes.json();

    // Set bot commands
    const cmdsRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: '🧌 Menú principal' },
            { command: 'play', description: '🎮 Abrir el juego' },
            { command: 'ranking', description: '🏆 Top 10 jugadores' },
            { command: 'price', description: '💹 Precio $DUENDE' },
            { command: 'stats', description: '📊 Tus estadísticas' },
            { command: 'referral', description: '🎁 Link de referidos' },
            { command: 'help', description: '❓ Lista de comandos' },
          ],
        }),
      }
    );
    const cmdsData = await cmdsRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: setData,
        commands: cmdsData,
        webhook_url: WEBHOOK_URL,
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};
