// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — gastos en $DUENDE (utilidad del token) y registro de quema
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Tres productos que SOLO se pagan con $DUENDE (GASTOS_DUENDE, data.js):
//   eclosion   el Huevo Místico eclosiona ya
//   evo        la mascota mística equipada sube un nivel (hasta MASCOTA_NV_MAX)
//   protector  un protector de racha comprado (hasta PROTECTOR_COMPRA_MAX)
//
// El COBRO es el de siempre y aquí no se toca: el pedido (pedidoUno, world.js)
// reserva un monto exacto y único; pedidoFirma lee la transacción en Solana y
// comprueba destinatario (la wallet de El Duende), mint y monto exacto, que no
// sea anterior al pedido, y guarda 'firma:<firma>' para que no sirva dos veces.
// Lo nuevo: estos tres se ENTREGAN SOLOS en cuanto la cadena confirma (decisión
// del dueño, 22-nov-2026; skins, oro y lo demás siguen con entrega manual).
//
// QUEMA: los tokens llegan a la wallet de El Duende (así lo exige la
// verificación). Cada gasto entregado se apunta como «por quemar». El dueño
// quema desde su wallet y registra la firma: el servidor lee esa transacción y
// solo cuenta lo que DE VERDAD salió de circulación (la suma de saldos del
// token baja; una transferencia no cuenta). El juego solo enseña como quemado
// lo que tiene firma en la cadena.
//   storage 'quema' = { pend, hecho, n, q: [{ f, raw, t }] }   (raw: unidades mínimas, 6 decimales)
//
// Mensajes: { t: 'gastos' } → { t: 'gastos', l, quema, nv, prot, tg }
//           { t: 'gastos', a: 'quema', firma }   (solo el dueño)
// ═══════════════════════════════════════════════════════
import { GASTOS_DUENDE, MASCOTAS, MASCOTA_NV_MAX, PROTECTOR_COMPRA_MAX, DUENDE_MINT, DUENDE_DECIMALES } from '../../mmo/js/data.js';
import { SOL_DEV_WALLET } from '../api/lib.js';

export const gastoDe = id => GASTOS_DUENDE.find(x => x.id === id) || null;
const fmtD = raw => (raw / 10 ** DUENDE_DECIMALES).toLocaleString('es', { maximumFractionDigits: 2, useGrouping: 'always' });
const FIRMA_RE = /^[1-9A-HJ-NP-Za-km-z]{60,100}$/;

export const Gastos = {
  // ¿Se puede aplicar este gasto a este personaje ahora? Devuelve '' o el motivo.
  // pd (opcional): el pedido ya creado (trae la mascota que se quiso subir).
  gastoDisponible(c, pq, pd) {
    if (!c || !pq || !pq.efecto) return 'Ese producto no existe.';
    if (pq.efecto === 'eclosion') return c.huevo ? '' : 'Ahora no tienes un Huevo Místico por eclosionar.';
    if (pq.efecto === 'evo') {
      const id = pd ? pd.pet : c.mascota, ma = typeof id === 'string' && Object.hasOwn(MASCOTAS, id) ? MASCOTAS[id] : null;
      if (!ma || !ma.mistica || !(c.mascotas || []).includes(id)) return 'Lleva puesta la mascota mística que quieres subir de nivel.';
      if (((c.petNv || {})[id] | 0) >= MASCOTA_NV_MAX) return ma.nombre + ' ya está en el nivel máximo (' + MASCOTA_NV_MAX + ').';
      return '';
    }
    if (pq.efecto === 'protector') return (((c.login || {}).amuC) | 0) >= PROTECTOR_COMPRA_MAX ? 'Ya guardas ' + PROTECTOR_COMPRA_MAX + ' protectores comprados: úsalos antes de comprar más.' : '';
    return 'Ese producto no existe.';
  },

  // Aplica el gasto al personaje (conectado o no). Devuelve la nota para el aviso.
  gastoAplicar(c, pq, pd, s) {
    if (pq.efecto === 'eclosion') {
      if (s && s.c === c) { const id = this.huevoEclosionar(s); return id ? ' Nació ' + MASCOTAS[id].nombre + '.' : ''; }
      const id = this.huevoNacer(c);
      return id ? ' Nació ' + MASCOTAS[id].nombre + ': te espera al entrar.' : '';
    }
    if (pq.efecto === 'evo') {
      const id = pd && pd.pet ? pd.pet : c.mascota;
      c.petNv = c.petNv && typeof c.petNv === 'object' ? c.petNv : {};
      c.petNv[id] = Math.min(MASCOTA_NV_MAX, (c.petNv[id] | 0) + 1);
      if (s) { s.sucio = true; this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); }
      return ' ' + MASCOTAS[id].nombre + ' subió a nivel ' + c.petNv[id] + '.';
    }
    if (pq.efecto === 'protector') {
      c.login = c.login && typeof c.login === 'object' ? c.login : {};
      c.login.amuC = Math.min(PROTECTOR_COMPRA_MAX, (c.login.amuC | 0) + 1);
      return ' Guardas ' + c.login.amuC + (c.login.amuC === 1 ? ' protector comprado.' : ' protectores comprados.');
    }
    return '';
  },

  // Pago ya confirmado en la cadena (pedidoFirma): entrega sola. Si no se puede aplicar
  // (el huevo eclosionó mientras tanto...), queda pagado y lo resuelve el dueño.
  async gastoEntregar(s, pd, firma, monto) {
    const r = await this.entregarPedido({ codigo: pd.codigo, por: 'auto' });
    const quien = String(pd.jugador || '').replace(/[^\p{L}\p{N} ]/gu, '');
    if (r && r.ok) {
      this.avisarAdmin(`🔥 *Gasto en $DUENDE · pedido #${pd.codigo}* — ${pd.nombre} ($${pd.usd})\n👤 ${quien}\n💰 Pagó ${monto} (monto exacto, confirmado en la cadena)\n🔗 https://solscan.io/tx/${firma}\n\nEntregado solo. Queda apuntado para quemar.`, null, false, 'co');
      if (s && !s.cerrado) this.enviar(s, await this.gastosInfo(s));
      return true;
    }
    if (s && !s.cerrado) { this.enviar(s, { t: 'toast', m: '📨 Pago confirmado en la cadena, pero no se pudo aplicar ahora (' + ((r && r.error) || 'sin detalle') + '). El equipo lo revisa y te escribe: o te lo entrega o te devuelve el pago.' }); this.actualizarYo(s); }
    this.avisarAdmin(`🛒 *Gasto en $DUENDE · pedido #${pd.codigo}* ⚠️ *no se pudo entregar solo* — ${pd.nombre} ($${pd.usd})\n👤 ${quien}\n💰 Pagó ${monto}\n🔗 https://solscan.io/tx/${firma}\nMotivo: ${(r && r.error) || '?'}\n\nRevísalo: /entregar ${pd.codigo} cuando se pueda, o devuélvelo y anúlalo.`, null, false, 'co');
    return false;
  },

  // ── Registro de quema ──
  async quemaLeer() {
    const q = (await this.state.storage.get('quema')) || {};
    return { pend: Math.max(0, +q.pend || 0), hecho: Math.max(0, +q.hecho || 0), n: +q.n || 0, q: Array.isArray(q.q) ? q.q : [] };
  },
  // Un gasto entregado: su monto queda «por quemar».
  async quemaSumar(raw) {
    if (!(raw > 0)) return;
    const q = await this.quemaLeer();
    q.pend += raw; q.n++;
    await this.state.storage.put('quema', q);
  },
  // Saldos del token antes y después de una transacción (aparte de leerTx, que no se toca). null = no se pudo consultar.
  async leerQuema(firma) {
    try {
      const key = this.env.HELIUS_API_KEY;
      const url = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [firma, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
      if (r.ok === false) return null;
      const d = await r.json();
      if (!d || d.error) return null;
      const tx = d.result;
      if (!tx) return { ok: false, motivo: 'la transacción no existe (o aún no se confirma)' };
      if (!tx.meta || tx.meta.err) return { ok: false, motivo: 'la transacción falló' };
      return { ok: true, pre: tx.meta.preTokenBalances || [], post: tx.meta.postTokenBalances || [] };
    } catch (e) { return null; }
  },
  // Cuánto $DUENDE dejó de existir en esa transacción, saliendo de la wallet de El Duende.
  // Una transferencia suma cero (lo que sale de una cuenta entra en otra): solo una quema baja el total.
  async verificarQuema(firma) {
    const tx = await this.leerQuema(firma);
    if (tx === null) return null;
    if (!tx.ok) return tx;
    const num = b => Number((b.uiTokenAmount && b.uiTokenAmount.amount) || 0);
    const antes = new Map(), despues = new Map(), mias = new Set();
    for (const b of tx.pre) if (b.mint === DUENDE_MINT) { antes.set(b.accountIndex, num(b)); if (b.owner === SOL_DEV_WALLET) mias.add(b.accountIndex); }
    for (const b of tx.post) if (b.mint === DUENDE_MINT) { despues.set(b.accountIndex, num(b)); if (b.owner === SOL_DEV_WALLET) mias.add(b.accountIndex); }
    let total = 0, mio = 0;
    for (const i of new Set([...antes.keys(), ...despues.keys()])) {
      const d = (despues.get(i) || 0) - (antes.get(i) || 0);
      total += d;
      if (mias.has(i)) mio += d;
    }
    const raw = Math.min(-total, -mio);   // lo que desapareció Y salió de la wallet de El Duende
    if (!(raw > 0) || !Number.isSafeInteger(raw)) return { ok: false, motivo: 'en esa transacción no se quemó $DUENDE desde la wallet de El Duende (una transferencia no es una quema)' };
    return { ok: true, raw };
  },
  // El dueño registra una quema hecha desde su wallet.
  async registrarQuema(s, firma) {
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (!this.esDueno(s)) return;   // el cliente no decide: si no es el dueño, silencio
    firma = String(firma || '').trim();
    if (!FIRMA_RE.test(firma)) return no('Esa firma de transacción no es válida. Cópiala de Solscan.');
    if (!this.ritmoSol(s.c.uid, 'q', 6000)) return no('Espera unos segundos antes de volver a intentarlo.');
    if (await this.state.storage.get('firma:' + firma)) return no('Esa transacción ya está registrada.');
    const v = await this.verificarQuema(firma);
    if (!v) return no('No pudimos consultar la red de Solana ahora. Prueba en un minuto.');
    if (!v.ok) return no('No se registró: ' + v.motivo + '.');
    if (await this.state.storage.get('firma:' + firma)) return no('Esa transacción ya está registrada.');
    await this.state.storage.put('firma:' + firma, 'quema');
    const q = await this.quemaLeer();
    q.hecho += v.raw; q.pend = Math.max(0, q.pend - v.raw);
    q.q.push({ f: firma, raw: v.raw, t: Date.now() });
    if (q.q.length > 50) q.q = q.q.slice(-50);
    await this.state.storage.put('quema', q);
    console.log('[MMO quema]', firma, v.raw);
    this.enviar(s, { t: 'toast', ok: true, m: '🔥 Quema registrada: ' + fmtD(v.raw) + ' $DUENDE fuera de circulación, con su firma en la cadena.' });
    this.enviar(s, await this.gastosInfo(s));
  },

  // Lo que pinta la ventana: los tres gastos (y si se puede cada uno), niveles, protectores y la quema.
  async gastosInfo(s) {
    const c = s.c, q = await this.quemaLeer();
    return {
      t: 'gastos',
      l: GASTOS_DUENDE.map(g => ({ id: g.id, no: this.gastoDisponible(c, g) || undefined })),
      nv: c.petNv || undefined, prot: ((c.login || {}).amuC) | 0,
      tg: s.authK === 'tg' ? 1 : undefined,   // dentro de Telegram no se paga con el token
      quema: { pend: q.pend, hecho: q.hecho, n: q.n, q: q.q.slice(-3).reverse() },
      dueno: this.esDueno(s) ? 1 : undefined,
    };
  },
  async gastos(s, m) {
    if (!s.c) return;
    if (m && m.a === 'quema') return this.registrarQuema(s, m.firma);
    const ahora = Date.now();
    if (ahora - (s.gastosT || 0) < 1500) return;   // la ventana lo pide al abrirse: una lectura del storage cada vez
    s.gastosT = ahora;
    this.enviar(s, await this.gastosInfo(s));
  },
};
