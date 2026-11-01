// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — Conversions API de Meta (anuncios de Facebook/Instagram)
//
// APAGADO por defecto: solo funciona si el Worker tiene las DOS variables
//   META_PIXEL_ID    id del pixel/conjunto de datos (Administrador de eventos)
//   META_CAPI_TOKEN  token de acceso de la Conversions API (secreto:
//                    `wrangler secret put META_CAPI_TOKEN`)
//   META_TEST_CODE   opcional: codigo de "Probar eventos" mientras se prueba
// Sin ellas no se guarda nada nuevo ni se llama a Meta.
//
// Solo se manda algo de jugadores que:
//   1) llegaron de un anuncio de Meta (fbclid en el enlace, /js/origen.js), y
//   2) ACEPTARON la medicion en el aviso de /js/medir.js (dq_medir=1), fuera de
//      Telegram. Sin las dos cosas el cliente no manda fbc y aqui no hay nada.
// El cliente manda fbc ('fb.1.<ms>.<fbclid>') en el 'hola'; se guarda una vez
// en c.ret.fbc. Si retira el consentimiento (med: 0) se borra.
//
// Que viaja a Meta: el fbc (id del clic en el anuncio) y external_id =
// sha256(uid) — un seudonimo, nunca nombre, email, telefono, IP ni ID de Telegram.
// Eventos (para optimizar la campaña: primero Jugo3Min, VolvioD1 cuando haya volumen):
//   Jugo3Min              3 minutos jugados en total (retencion.js, retAlGuardar)
//   CompleteRegistration  entrego la mision 1 (retencion.js, hitoEmbudo 'm1')
//   VolvioD1              volvio al dia siguiente del alta (retencion.js, retNuevoDia)
//   InitiateCheckout      abrio un pedido; event_id = codigo (el pixel usa el mismo: dedup)
//   Purchase              el dueño entrego el pedido (world.js, entregarPedido)
// Fire-and-forget: nunca se espera ni puede romper ni frenar una entrega.
// ═══════════════════════════════════════════════════════

import { MMO_URL, MUNDO_URL } from '../api/telegram-bot.js';

const VERSION = 'v21.0';
const CLIC_MAX_MS = 90 * 86400000;   // un clic de mas de 90 dias ya no atribuye nada
const FBC_OK = /^fb\.1\.\d{10,13}\.[A-Za-z0-9_-]{8,300}$/;

export const metaActivo = env => !!(env && env.META_PIXEL_ID && env.META_CAPI_TOKEN && /^\d{5,25}$/.test(String(env.META_PIXEL_ID)));

// En el 'hola' (world.js, despues de retEntrar: c.ret ya existe).
export function metaHola(env, c, m) {
  try {
    if (!c || !c.ret || !m) return;
    if (m.med === 0) { delete c.ret.fbc; return; }   // retiro el consentimiento
    if (c.ret.fbc || !metaActivo(env) || typeof m.fbc !== 'string' || !FBC_OK.test(m.fbc)) return;
    c.ret.fbc = m.fbc;
  } catch (e) {}
}

async function sha256(txt) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(txt)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// mundo: el DO (this de world.js); c: el personaje; datos: custom_data; id: event_id.
export function metaEvento(mundo, c, nombre, datos, id) {
  try {
    const env = mundo && mundo.env;
    const fbc = c && c.ret && c.ret.fbc;
    if (!fbc || !metaActivo(env) || !c.uid) return;
    if (mundo.uidsPrueba && mundo.uidsPrueba.has(c.uid)) return;
    const t = Number(fbc.split('.')[2]);
    if (!(t > 0) || Date.now() - (t < 1e12 ? t * 1000 : t) > CLIC_MAX_MS) return;
    (async () => {
      const ev = {
        event_name: nombre,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: c.en3d ? MUNDO_URL : MMO_URL,
        user_data: { fbc, external_id: [await sha256(c.uid)] },
      };
      if (id) ev.event_id = String(id).slice(0, 60);
      if (datos && Object.keys(datos).length) ev.custom_data = datos;
      const cuerpo = { data: [ev] };
      if (env.META_TEST_CODE) cuerpo.test_event_code = String(env.META_TEST_CODE);
      const r = await fetch(`https://graph.facebook.com/${VERSION}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      if (!r.ok) console.error('[META CAPI]', nombre, r.status, (await r.text()).slice(0, 200));
    })().catch(e => console.error('[META CAPI]', nombre, e && e.message));
  } catch (e) {}
}
