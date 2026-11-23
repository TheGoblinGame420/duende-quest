// ═══════════════════════════════════════════════════════
// DUENDE QUEST — dominio oficial (una sola fuente)
//
// duendequest.com es el dominio de produccion. Desde v401 las paginas del viejo
// workers.dev se mudan solas al oficial llevando el duende del invitado
// (functions/api/mudanza.js + /mudanza.html). Todo lo que reconozca enlaces
// oficiales (antispam del grupo, filtro del chat, CORS) acepta los dos.
//
// APP_URL (variable de entorno opcional, solo https://host sin ruta) cambia
// el sitio que se usa en los enlaces que genera el servidor.
// ═══════════════════════════════════════════════════════
export const DOMINIO = 'duendequest.com';
export const DOMINIO_VIEJO = 'duende-quest.alfonso12hc.workers.dev';
export const HOST_WWW = 'www.' + DOMINIO;   // se muda al dominio sin www (functions/api/mudanza.js)
export const SITIO = 'https://' + DOMINIO;
// Cabecera HSTS, igual en todas partes (_headers lleva la misma a mano). Con subdominios; sin «preload» a proposito:
// entrar en la lista de los navegadores es un compromiso dificil de deshacer.
export const HSTS = 'max-age=31536000; includeSubDomains';
// Hosts que cuentan como «nuestros» (sin www: quien compara ya se lo quita).
export const HOSTS_OFICIALES = [DOMINIO, DOMINIO_VIEJO];
export const ORIGENES_OFICIALES = [SITIO, 'https://www.' + DOMINIO, 'https://' + DOMINIO_VIEJO];

export function sitioDe(env) {
  const u = env && typeof env.APP_URL === 'string' ? env.APP_URL.trim().replace(/\/+$/, '') : '';
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(u) ? u : SITIO;
}
