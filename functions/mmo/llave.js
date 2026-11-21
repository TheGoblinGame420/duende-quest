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
// ═══════════════════════════════════════════════════════

const LLAVE_MS = 15 * 60 * 1000;
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

  // hola { k: 'llave' }: gasta la llave y crea el token de aparato. Devuelve el uid o null.
  async holaLlave(s, cod) {
    const v = this.llaves && this.llaves.get(cod);
    if (!v) return null;
    this.llaves.delete(cod);   // de un solo uso, aunque haya caducado
    if (v.exp < Date.now()) return null;
    const tok = hex(16), h = await sha(tok);
    await this.state.storage.put('dt:' + h, { uid: v.uid, t: Date.now() });
    let l = (await this.state.storage.get('dtl:' + v.uid)) || [];
    l.push(h);
    while (l.length > DT_MAX) await this.state.storage.delete('dt:' + l.shift());
    await this.state.storage.put('dtl:' + v.uid, l);
    s.dtNuevo = tok;   // se le manda al cliente al terminar de entrar (llaveOk)
    return v.uid;
  },

  // hola { k: 'dt' }: token de aparato guardado. Devuelve el uid o null.
  async holaDt(tok) {
    const h = await sha(tok), r = await this.state.storage.get('dt:' + h);
    if (!r || typeof r.uid !== 'string') return null;
    const ahora = Date.now();
    if (ahora - (r.t || 0) > DT_DIAS * 86400000) { await this.state.storage.delete('dt:' + h); return null; }
    // Usado: se renueva el plazo (como mucho una escritura al dia).
    if (ahora - (r.t || 0) > 86400000) await this.state.storage.put('dt:' + h, { ...r, t: ahora });
    return r.uid;
  },
};
