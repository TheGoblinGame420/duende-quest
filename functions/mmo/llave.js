// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — «Jugar en Chrome»: tu cuenta de Telegram fuera de Telegram
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Fuera de Telegram no hay initData: el mismo jugador entraba en Chrome como un
// invitado nuevo (y el dueño sin su Modo Dios). Ahora:
//  1. Dentro de Telegram (sesion verificada con initData) se pide una LLAVE:
//     un enlace de un solo uso que vale 15 minutos (solo en memoria).
//  2. El enlace abre /mundo/#llave=... (o /mmo/) en el navegador; el hola trae
//     { k: 'llave', cod }. El servidor la gasta y crea un TOKEN DE APARATO de 32
//     hex que el cliente guarda (localStorage dq_dt). En el storage solo va su
//     hash: 'dt:<sha256>' -> { uid, t }.
//  3. Las siguientes veces el hola trae { k: 'dt', tok }: entra como 'tg:<id>',
//     el mismo duende, con sus compras y su Modo Dios (dios.js mira el uid).
// Como mucho DT_MAX aparatos por cuenta (el mas viejo se borra); caducan a los
// DT_DIAS sin usarse. Desde Telegram se pueden cerrar todos (llaveCerrar).
// El riesgo es el mismo que el del token de invitado: quien copie el
// localStorage de ese navegador entra con la cuenta. Por eso la llave solo se
// pide con la sesion de Telegram, es de un uso y caduca pronto.
//
// v403 — el mismo camino por HTTP (functions/api/auth.js), sin esperar al mundo:
//  - POST /api/auth/telegram-handoff { initData }: el Worker verifica el HMAC y
//    pide aqui un OTT (ottCrear): un solo uso, 60 s (10 min el de «copiar para la PC»).
//  - POST /api/auth/canje { ott }: ottCanjear lo gasta y crea el token de aparato,
//    que el Worker pone en la cookie dq_s (HttpOnly; Secure; SameSite=Lax): el
//    JavaScript de la pagina ya no lo ve (un XSS no se lo puede llevar).
//  - El WebSocket trae la cookie en su peticion de subida: _fetch la lee (solo si
//    el Origin es nuestro) y el hola dice { k: 'ck' }.
//  - POST /api/auth/salir: dtCerrar borra ESE token y echa a sus sesiones.
// ═══════════════════════════════════════════════════════
import { ORIGENES_OFICIALES } from '../api/dominio.js';

const LLAVE_MS = 15 * 60 * 1000;
const OTT_MS = 60 * 1000;            // «abrir en el navegador de este celular»
const OTT_LARGO_MS = 10 * 60 * 1000; // «copiar el enlace para la PC»
export const COOKIE_SESION = 'dq_s';
export const COOKIE_DIAS = 120;
// La cookie de sesion de una peticion (o '' si no la trae o no es de nuestro sitio).
// Un WebSocket abierto desde otra web no trae cookies SameSite=Lax; el Origin es la segunda cerradura.
export function cookieSesion(request) {
  try {
    const o = request.headers.get('Origin') || '';
    if (o && !ORIGENES_OFICIALES.includes(o) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return '';
    const m = /(?:^|;\s*)dq_s=([a-f0-9]{32})(?:;|$)/.exec(request.headers.get('Cookie') || '');
    return m ? m[1] : '';
  } catch (e) { return ''; }
}
const DT_MAX = 5;
const DT_DIAS = 120;
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dq-dt:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const Llave = {
  // Mensaje { t: 'llave' } (pedir enlace) o { t: 'llaveCerrar' } (cerrar los aparatos).
  async llave(s, m) {
    // Solo quien entro con Telegram de verdad (no con un token de aparato ni con correo).
    if (s.authK !== 'tg') return this.no(s, 'Esto se pide desde Telegram.');
    const uid = s.uidAuth || s.c.uid;
    if (m.t === 'llaveCerrar') {
      const l = (await this.state.storage.get('dtl:' + uid)) || [];
      for (const h of l) await this.state.storage.delete('dt:' + h);
      await this.state.storage.delete('dtl:' + uid);
      // Las sesiones abiertas con un token de aparato de esta cuenta se cierran.
      for (const x of this.sesiones.values()) if (x !== s && x.authK === 'dt' && x.c && (x.uidAuth || x.c.uid) === uid) this.expulsar(x, 'Cerraste la sesión de este navegador desde Telegram.');
      return this.enviar(s, { t: 'toast', m: '🔒 Listo: ningún navegador queda con tu cuenta de Telegram (' + l.length + ').', ok: true });
    }
    this.llaves = this.llaves || new Map();
    const ahora = Date.now();
    for (const [k, v] of this.llaves) if (v.exp < ahora) this.llaves.delete(k);
    // Tope: 5 enlaces vivos por cuenta (pulsar muchas veces no llena la memoria).
    let vivos = 0; for (const v of this.llaves.values()) if (v.uid === uid) vivos++;
    if (vivos >= 5) return this.no(s, 'Ya pediste varios enlaces: usa uno de ellos o espera 15 minutos.');
    const cod = hex(16);
    this.llaves.set(cod, { uid, exp: ahora + LLAVE_MS });
    const l = (await this.state.storage.get('dtl:' + uid)) || [];
    this.enviar(s, { t: 'llave', cod, min: LLAVE_MS / 60000, aparatos: l.length });
  },

  // Gasta una llave u OTT: de un solo uso, aunque haya caducado. Devuelve el uid o null.
  gastarLlave(cod) {
    const v = this.llaves && this.llaves.get(cod);
    if (!v) return null;
    this.llaves.delete(cod);
    return v.exp < Date.now() ? null : v.uid;
  },
  // Token de aparato nuevo para esa cuenta (en el storage solo va su hash).
  async crearAparato(uid) {
    const tok = hex(16), h = await sha(tok);
    await this.state.storage.put('dt:' + h, { uid, t: Date.now() });
    let l = (await this.state.storage.get('dtl:' + uid)) || [];
    l.push(h);
    while (l.length > DT_MAX) await this.state.storage.delete('dt:' + l.shift());
    await this.state.storage.put('dtl:' + uid, l);
    return tok;
  },

  // hola { k: 'llave' }: gasta la llave y crea el token de aparato. Devuelve el uid o null.
  async holaLlave(s, cod) {
    const uid = this.gastarLlave(cod);
    if (!uid) return null;
    s.dtNuevo = await this.crearAparato(uid);   // se le manda al cliente al terminar de entrar (llaveOk)
    return uid;
  },

  // hola { k: 'dt' } o { k: 'ck' }: token de aparato guardado (localStorage o cookie). Devuelve el uid o null.
  async holaDt(tok, s) {
    const h = await sha(tok), r = await this.state.storage.get('dt:' + h);
    if (!r || typeof r.uid !== 'string') return null;
    const ahora = Date.now();
    if (ahora - (r.t || 0) > DT_DIAS * 86400000) { await this.state.storage.delete('dt:' + h); return null; }
    // Usado: se renueva el plazo (como mucho una escritura al dia).
    if (ahora - (r.t || 0) > 86400000) await this.state.storage.put('dt:' + h, { ...r, t: ahora });
    if (s) s.dtH = h;   // dtCerrar echa a las sesiones de ESTE token
    return r.uid;
  },

  // ── Por HTTP (functions/api/auth.js, solo con x-interno) ──
  // OTT para una cuenta de Telegram que el Worker ya verifico con initData.
  ottCrear(uid, largo) {
    if (typeof uid !== 'string' || !/^tg:\d{1,20}$/.test(uid)) return null;
    this.llaves = this.llaves || new Map();
    const ahora = Date.now();
    for (const [k, v] of this.llaves) if (v.exp < ahora) this.llaves.delete(k);
    // Tope de enlaces vivos por cuenta: la ventana renueva el corto cada 45 s (2 vivos) mas el largo.
    let vivos = 0; for (const v of this.llaves.values()) if (v.uid === uid) vivos++;
    if (vivos >= 8) return null;
    const cod = hex(16), ms = largo ? OTT_LARGO_MS : OTT_MS;
    this.llaves.set(cod, { uid, exp: ahora + ms });
    return { ott: cod, seg: ms / 1000 };
  },
  // Canje: gasta el OTT y devuelve el token de aparato (va a la cookie) y a quien pertenece.
  async ottCanjear(cod, ip, viejo) {
    // Contra el tanteo: 20 fallos por IP cada 10 min (los codigos son de 128 bits; esto solo ahorra trabajo).
    const ahora = Date.now();
    this.ottFallos = (this.ottFallos || []).filter(x => ahora - x.t < 600000);
    if (ip && this.ottFallos.filter(x => x.ip === ip).length >= 20) return { ok: false, m: 'espera' };
    const uid = /^[a-f0-9]{32}$/.test(cod || '') ? this.gastarLlave(cod) : null;
    if (!uid) { if (this.ottFallos.length < 2000) this.ottFallos.push({ ip: ip || '', t: ahora }); return { ok: false }; }
    // El token de aparato que ese navegador tuviera de antes (otra cuenta o la misma) deja de valer.
    if (/^[a-f0-9]{32}$/.test(viejo || '')) await this.dtCerrar(viejo);
    const tok = await this.crearAparato(uid);
    let nombre = '', nivel = 0;
    try {
      const prin = await this.uidPrincipal(uid);
      const s = this.porUid.get(prin), c = s ? s.c : await this.state.storage.get('c:' + prin);
      if (c) { nombre = c.nombre || ''; nivel = c.nivel || 1; }
    } catch (e) {}
    return { ok: true, tok, nombre, nivel };
  },
  // Cerrar sesion de verdad: ESE token deja de existir en el servidor y sus sesiones abiertas se cierran.
  async dtCerrar(tok) {
    if (!/^[a-f0-9]{32}$/.test(tok || '')) return false;
    const h = await sha(tok), r = await this.state.storage.get('dt:' + h);
    if (!r) return false;
    await this.state.storage.delete('dt:' + h);
    if (typeof r.uid === 'string') {
      const l = ((await this.state.storage.get('dtl:' + r.uid)) || []).filter(x => x !== h);
      if (l.length) await this.state.storage.put('dtl:' + r.uid, l); else await this.state.storage.delete('dtl:' + r.uid);
    }
    for (const x of this.sesiones.values()) if (x.dtH === h && !x.cerrado) this.expulsar(x, 'Cerraste la sesión en este navegador.');
    return true;
  },
};
