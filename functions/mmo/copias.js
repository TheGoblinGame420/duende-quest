// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — copias de seguridad del mundo
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Todo el progreso vive en el storage del Durable Object. Una vez al dia (la
// alarma de cada hora de retencion.js, a partir de las 04:00 UTC) se vuelca
// TODO el storage (menos las propias copias) a un JSON comprimido con gzip:
//  - FUERA de Cloudflare: si existe el binding R2 `COPIAS` se sube ahi
//    (mmo/AAAA-MM-DD-HH.json.gz); si no, el bot lo manda como archivo al chat
//    privado del dueño (ADMIN_TG_ID). Telegram guarda los archivos sin limite
//    de tiempo: el historial del chat ES el archivo de copias.
//  - DENTRO: las ultimas BK_MAX copias en trozos 'bk:<id>:<i>' (sirven para
//    deshacer un error de logica sin descargar nada) e indice 'bk:idx'.
// Restaurar (panel de dios, pestaña Copias): un jugador desde una copia
// interna, o el mundo entero desde una copia interna o desde el archivo
// .json.gz que llego por Telegram (se sube desde el panel).
// ═══════════════════════════════════════════════════════
import { getEnv } from '../api/lib.js';

export const BK_MAX = 7;
const TROZO = 512 * 1024;          // bytes por valor del storage
const SUBIDA_MAX = 900 * 1024;     // un mensaje WebSocket de Workers llega hasta 1 MiB
const HORA_COPIA = 4;              // UTC
const PAGINA = 500;                // claves por lectura del storage

async function porStream(bytes, stream) {
  const r = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(r).arrayBuffer());
}
export const gzip = texto => porStream(new TextEncoder().encode(texto), new CompressionStream('gzip'));
export const gunzip = async bytes => new TextDecoder().decode(await porStream(bytes, new DecompressionStream('gzip')));
const idCopia = (t = Date.now()) => new Date(t).toISOString().slice(0, 13).replace('T', '-');
function b64aBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
// Los retiros viven fuera del personaje: los pedidos despues de la copia (pendientes
// o pagados) ya salieron de c.mton, pero la copia aun los tiene. Sin esto, restaurar
// devolveria esos mTON y se pagarian dos veces en TON real. Los rechazados ya volvieron al saldo.
function sinRetirosPosteriores(c, retiros, t) {
  if (!c || !c.uid || !t) return c;
  const gastado = (retiros || []).filter(r => r.uid === c.uid && r.creado > t && r.estado !== 'rechazado').reduce((a, r) => a + (r.mton || 0), 0);
  return gastado ? { ...c, mton: Math.max(0, (c.mton || 0) - gastado) } : c;
}

export const Copias = {
  async indiceCopias() { return (await this.state.storage.get('bk:idx')) || []; },

  // Recorre el storage por paginas: st.list() sin limite metia todos los
  // valores en memoria a la vez (con muchos personajes tumbaba el objeto).
  async *recorrerStorage(rango) {
    for (let desde; ;) {
      const o = { ...rango, limit: PAGINA };
      if (desde !== undefined) { delete o.start; o.startAfter = desde; }
      const p = await this.state.storage.list(o);
      yield* p;
      if (p.size < PAGINA) return;
      desde = [...p.keys()].pop();
    }
  },
  // Todo menos las copias: ni se leen sus trozos de 512 KB ('bk:' < 'bk;').
  async *recorrerSinCopias() {
    yield* this.recorrerStorage({ end: 'bk:' });
    yield* this.recorrerStorage({ start: 'bk;' });
  },

  // Todo el storage menos las copias (y la alarma, que no es una clave), ya
  // comprimido: el JSON se escribe en el gzip por partes, sin tener el mundo
  // entero + su texto + el gzip en memoria a la vez. Mismo formato de siempre.
  async volcarStorage(t, motivo) {
    // Lo que esta en memoria y aun no se guardo, primero al storage.
    for (const s of this.sesiones.values()) if (s.c && s.sucio && !s.noGuardar) await this.guardar(s);
    const cs = new CompressionStream('gzip'), w = cs.writable.getWriter(), enc = new TextEncoder();
    const salida = new Response(cs.readable).arrayBuffer();
    salida.catch(() => {});
    let nPj = 0, claves = 0;
    try {
      let parte = JSON.stringify({ v: 1, t, motivo }).slice(0, -1) + ',"datos":{';
      for await (const [k, v] of this.recorrerSinCopias()) {
        const j = JSON.stringify(v);
        if (k.startsWith('bk:') || j === undefined) continue;
        parte += (claves++ ? ',' : '') + JSON.stringify(k) + ':' + j;
        if (k.startsWith('c:')) nPj++;
        if (parte.length > 65536) { await w.write(enc.encode(parte)); parte = ''; }
      }
      await w.write(enc.encode(parte + '}}'));
      await w.close();
    } catch (err) { w.abort(err).catch(() => {}); throw err; }
    return { gz: new Uint8Array(await salida), nPj, claves };
  },

  // Hace una copia: devuelve la entrada del indice.
  async hacerCopia(motivo = 'auto') {
    if (this.copiando) return null;
    this.copiando = true;
    try {
      const st = this.state.storage, t = Date.now(), base = idCopia(t);
      const { gz, nPj, claves } = await this.volcarStorage(t, motivo);
      let idx = await this.indiceCopias();
      // El id es por hora: si ya hay copia de esta hora no se pisa (puede ser la que se restaura), lleva sufijo -2, -3...
      let id = base; for (let n = 2; idx.some(x => x.id === id); n++) id = `${base}-${n}`;
      const trozos = Math.ceil(gz.length / TROZO);
      for (let i = 0; i < trozos; i++) await st.put(`bk:${id}:${i}`, gz.slice(i * TROZO, (i + 1) * TROZO));
      const e = { id, t, motivo, pj: nPj, claves, bytes: gz.length, trozos, fuera: null };
      idx.unshift(e);
      for (const v of idx.slice(BK_MAX)) for (let i = 0; i < v.trozos; i++) await st.delete(`bk:${v.id}:${i}`);
      idx = idx.slice(0, BK_MAX);
      await st.put('bk:idx', idx);
      e.fuera = await this.copiaFuera(id, gz, e);
      await st.put('bk:idx', idx);
      console.log('[MMO copia]', { id, pj: nPj, bytes: gz.length, fuera: e.fuera });
      return e;
    } catch (err) {
      console.error('[MMO copia]', err);
      return null;
    } finally { this.copiando = false; }
  },

  // Fuera de Cloudflare: R2 si esta configurado; si no, el Telegram del dueño.
  async copiaFuera(id, gz, e) {
    const r2 = this.env && this.env.COPIAS;
    if (r2 && r2.put) {
      try { await r2.put(`mmo/${id}.json.gz`, gz, { httpMetadata: { contentType: 'application/gzip' } }); return 'r2'; }
      catch (err) { console.error('[MMO copia R2]', err); }
    }
    const env = getEnv({ env: this.env || {} });
    if (!env.BOT_TOKEN || !env.ADMIN_TG_ID) return null;
    try {
      const fd = new FormData();
      fd.append('chat_id', String(env.ADMIN_TG_ID));
      fd.append('caption', `💾 Copia de Duende Quest ${id} UTC · ${e.pj} personajes · ${(gz.length / 1024).toFixed(0)} KB (${e.motivo}).\nGuárdala: para restaurar, súbela en el panel de dios → Copias.`);
      fd.append('document', new Blob([gz], { type: 'application/gzip' }), `duende-quest-${id}.json.gz`);
      const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDocument`, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      return j.ok ? 'telegram' : null;
    } catch (err) { console.error('[MMO copia TG]', err); return null; }
  },

  // La alarma de cada hora llama aqui: una copia al dia desde las 04:00 UTC.
  async copiaDiariaSiToca() {
    const ahora = new Date(Date.now());
    if (ahora.getUTCHours() < HORA_COPIA) return null;
    const hoy = ahora.toISOString().slice(0, 10);
    const idx = await this.indiceCopias();
    if (idx.some(x => x.motivo === 'auto' && x.id.startsWith(hoy))) return null;
    // Como mucho 2 intentos al dia: si la copia tumba el objeto (memoria) no
    // se reintenta cada hora echando a todos ('bk:' no entra en las copias).
    const int = (await this.state.storage.get('bk:intento')) || {};
    const n = int.d === hoy ? int.n || 0 : 0;
    if (n >= 2) return null;
    await this.state.storage.put('bk:intento', { d: hoy, n: n + 1 });
    return this.hacerCopia('auto');
  },

  async leerCopia(id) {
    const e = (await this.indiceCopias()).find(x => x.id === id);
    if (!e) return null;
    const partes = [];
    for (let i = 0; i < e.trozos; i++) partes.push(await this.state.storage.get(`bk:${id}:${i}`));
    if (partes.some(p => !p)) return null;
    const gz = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of partes) { gz.set(p, o); o += p.length; }
    return JSON.parse(await gunzip(gz));
  },

  // Un jugador (por nombre o uid) vuelve a como estaba en la copia.
  async restaurarJugador(id, quien) {
    const copia = await this.leerCopia(id);
    if (!copia) return { ok: false, error: 'No encuentro esa copia.' };
    const q = String(quien || '').trim().toLowerCase();
    const k = Object.keys(copia.datos).find(k => k.startsWith('c:') && (k.slice(2).toLowerCase() === q || String(copia.datos[k].nombre || '').toLowerCase() === q));
    if (!k) return { ok: false, error: `En la copia ${id} no hay nadie llamado «${quien}».` };
    const s = this.porUid.get(copia.datos[k].uid);
    const ahora = s ? s.c : await this.state.storage.get(k);
    const c = sinRetirosPosteriores(copia.datos[k], this.retiros, copia.t);
    // La wallet sigue la del personaje actual: la clave 'w:' no se restaura.
    if (ahora) { if (ahora.wallet) c.wallet = ahora.wallet; else delete c.wallet; }
    if (s) { s.noGuardar = true; this.expulsar(s, 'Un moderador está restaurando tu personaje. Vuelve a entrar en unos segundos.'); }
    await this.state.storage.put(k, c);
    return { ok: true, nombre: c.nombre, nivel: c.nivel };
  },

  // El mundo entero vuelve a la copia (interna por id, o el archivo subido).
  async restaurarMundo(copia) {
    if (!copia || copia.v !== 1 || !copia.datos || typeof copia.datos !== 'object') return { ok: false, error: 'Ese archivo no es una copia de Duende Quest.' };
    const st = this.state.storage;
    // Copia de lo de ahora antes de pisarlo: se puede deshacer.
    await this.hacerCopia('antes de restaurar');
    for (const s of [...this.sesiones.values()]) { s.noGuardar = true; this.expulsar(s, 'El servidor se está restaurando desde una copia. Vuelve a entrar en un minuto.'); }
    // Los retiros NO vuelven atras: uno ya pagado no puede desaparecer ni volver a pendiente.
    const retirosAhora = this.retiros || [];
    // Solo las claves que sobran (sin valores), recorriendo por paginas.
    const sobran = [];
    for await (const [k] of this.recorrerSinCopias()) if (!k.startsWith('bk:') && !Object.hasOwn(copia.datos, k)) sobran.push(k);
    for (const k of sobran) await st.delete(k);
    for (const [k, v] of Object.entries(copia.datos)) if (!k.startsWith('bk:')) await st.put(k, k.startsWith('c:') ? sinRetirosPosteriores(v, retirosAhora, copia.t) : v);
    await st.put('retiros', retirosAhora);
    // Lo que el mundo tiene en memoria se vuelve a leer del storage.
    this.facc = null; this.rh = null; this.rhP = null; this.rtP = null; this._retIdx = null; this.mod = null;
    if (this.herms) this.herms.clear();
    await this.migrar();
    return { ok: true, pj: Object.keys(copia.datos).filter(k => k.startsWith('c:')).length, t: copia.t };
  },
  async restaurarSubida(b64) {
    if (typeof b64 !== 'string' || b64.length > SUBIDA_MAX * 1.4) return { ok: false, error: 'Archivo demasiado grande para subirlo desde el panel (máx. 900 KB).' };
    let copia;
    try { copia = JSON.parse(await gunzip(b64aBytes(b64))); } catch (e) { return { ok: false, error: 'No se pudo leer el archivo (¿es el .json.gz de la copia?).' }; }
    return this.restaurarMundo(copia);
  },

  async infoCopias() {
    const env = getEnv({ env: this.env || {} });
    return { l: await this.indiceCopias(), destino: this.env && this.env.COPIAS ? 'r2' : env.BOT_TOKEN && env.ADMIN_TG_ID ? 'telegram' : null };
  },
};
