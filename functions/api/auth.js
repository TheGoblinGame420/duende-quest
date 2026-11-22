// ═══════════════════════════════════════════════════════
// DUENDE QUEST — /api/auth/*: tu cuenta de Telegram en el navegador, por HTTP
//
//  POST /api/auth/telegram-handoff  { initData, largo? }
//      Solo dentro de Telegram. Verifica el initData (HMAC-SHA256 con el token
//      del bot) y devuelve un OTT: 32 hex, un solo uso, 60 s (10 min con largo,
//      para copiar el enlace a la PC). El OTT vive en la memoria del mundo.
//  POST /api/auth/canje             { ott, viejo?, hayWeb?, confirmar? }   (409 { cambiar } si ya hay OTRA cuenta abierta: se pregunta antes)
//      En el navegador (https://duendequest.com/?ott=...). Gasta el OTT y pone
//      la cookie de sesion: dq_s; HttpOnly; Secure; SameSite=Lax. El WebSocket
//      del juego la trae sola y el hola dice { k: 'ck' } (functions/mmo/llave.js).
//  POST /api/auth/salir             { dt? }
//      Cierra la sesion de verdad: el token deja de existir en el servidor (y sus
//      sesiones abiertas se cierran), se borra la cookie y Clear-Site-Data pide
//      al navegador vaciar cookies y almacenamiento del sitio.
//
// Todas exigen un Origin nuestro: otra web no puede canjear ni cerrar por ti.
// ═══════════════════════════════════════════════════════
import { getEnv, verifyInitData } from './lib.js';
import { ORIGENES_OFICIALES } from './dominio.js';
import { COOKIE_SESION, COOKIE_DIAS } from '../mmo/llave.js';

const HEX = /^[a-f0-9]{32}$/;
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function responder(o, estado = 200, extra) {
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const [k, v] of extra || []) h.append(k, v);
  return new Response(JSON.stringify(o), { status: estado, headers: h });
}
// El Origin tiene que ser nuestro. En local (tools/mmo_local.mjs) vale localhost, pero solo si la peticion tambien va a localhost.
export function origenPropio(request) {
  const o = request.headers.get('Origin') || '';
  if (ORIGENES_OFICIALES.includes(o)) return true;
  let host = '';
  try { host = new URL(request.url).hostname; } catch (e) {}
  return LOCAL.test(o) && (host === 'localhost' || host === '127.0.0.1');
}
const cookieDe = request => { const m = /(?:^|;\s*)dq_s=([a-f0-9]{32})(?:;|$)/.exec(request.headers.get('Cookie') || ''); return m ? m[1] : ''; };
const ponerCookie = tok => `${COOKIE_SESION}=${tok}; Max-Age=${COOKIE_DIAS * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const quitarCookie = () => `${COOKIE_SESION}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

export async function authApi(request, env, path) {
  if (request.method !== 'POST') return responder({ ok: false }, 405);
  if (!origenPropio(request)) return responder({ ok: false, m: 'origen' }, 403);
  const e = getEnv({ env });
  if (!env.MMO || !e.BOT_TOKEN) return responder({ ok: false, m: 'No disponible ahora.' }, 503);
  let b = {};
  try { const t = await request.text(); if (t.length > 8192) return responder({ ok: false }, 413); b = t ? JSON.parse(t) : {}; } catch (er) { b = {}; }
  if (!b || typeof b !== 'object') b = {};
  const interno = async (accion, cuerpo) => {
    const r = await env.MMO.get(env.MMO.idFromName('mundo-1')).fetch('https://mmo/interno/' + accion, { method: 'POST', headers: { 'x-interno': env.TELEGRAM_BOT_TOKEN || '' }, body: JSON.stringify(cuerpo) });
    return r.ok ? r.json() : { ok: false };
  };
  try {
    if (path === '/api/auth/telegram-handoff') {
      // 24 h, igual que el hola del juego: Telegram entrega el initData del momento en que se abrio la Mini App.
      const u = await verifyInitData(typeof b.initData === 'string' ? b.initData : '', e.BOT_TOKEN, 24 * 3600);
      if (!u || !u.id || !/^\d{1,20}$/.test(String(u.id))) return responder({ ok: false, m: 'Telegram no verificó tu sesión. Cierra el juego y ábrelo otra vez desde el bot.' }, 401);
      const r = await interno('ott', { uid: 'tg:' + u.id, largo: !!b.largo, nombre: String(u.username || u.first_name || '').slice(0, 24) });
      if (!r.ok) return responder({ ok: false, m: 'Ya pediste varios enlaces. Usa uno de ellos o espera un minuto.' }, 429);
      return responder({ ok: true, ott: r.ott, seg: r.seg });
    }
    if (path === '/api/auth/canje') {
      if (!HEX.test(b.ott || '')) return responder({ ok: false, m: 'Ese enlace no vale.' }, 400);
      // Lo que ese navegador tuviera de antes (cookie o token viejo en localStorage) deja de valer al entrar con otra llave.
      const r = await interno('canje', { cod: b.ott, ip: request.headers.get('CF-Connecting-IP') || '', viejo: HEX.test(b.viejo || '') ? b.viejo : '', antes: cookieDe(request), hayWeb: !!b.hayWeb, confirmar: !!b.confirmar });
      // Ese navegador ya tiene OTRA cuenta abierta: el cliente pregunta y repite con confirmar (el OTT no se ha gastado).
      if (r.cambiar) return responder({ ok: false, cambiar: true, a: r.a || '' }, 409);
      if (!r.ok) return responder({ ok: false, m: r.m === 'espera' ? 'Demasiados intentos. Espera unos minutos.' : 'Ese enlace ya se usó o caducó. Pide otro en Telegram.' }, r.m === 'espera' ? 429 : 410);
      return responder({ ok: true, nombre: r.nombre || '', nivel: r.nivel || 0 }, 200, [['Set-Cookie', ponerCookie(r.tok)]]);
    }
    if (path === '/api/auth/salir') {
      const toks = [cookieDe(request), HEX.test(b.dt || '') ? b.dt : ''].filter(Boolean);
      let n = 0;
      if (toks.length) { const r = await interno('salir', { toks }); n = r.n || 0; }
      // "cookies" y "storage": cookies, localStorage, sessionStorage, IndexedDB, cachés y service workers de este sitio.
      return responder({ ok: true, n }, 200, [['Set-Cookie', quitarCookie()], ['Clear-Site-Data', '"cookies", "storage"']]);
    }
  } catch (er) {
    console.error('[auth]', path, er);
    return responder({ ok: false, m: 'El servidor no respondió. Prueba otra vez.' }, 503);
  }
  return responder({ ok: false }, 404);
}
