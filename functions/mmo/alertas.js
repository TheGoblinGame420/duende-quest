// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — Alertas al dueño (chat privado ADMIN_TG_ID)
//
// Que avisos le llegan al dueño por Telegram y cuales no. Se elige con
// /alertas en el bot y se guarda en el almacenamiento del mundo ('alertasAdmin':
// solo lo que el dueño cambio; lo demas sigue el valor por defecto de abajo).
//
// NUNCA escribe a un jugador: todo sale por avisarAdmin (world.js), que solo
// conoce ADMIN_TG_ID. El precio de $DUENDE no se publica solo en ningun sitio.
//
// Registros y «llego a nivel 10» son informativos y pueden venir en racha (un
// anuncio, un directo): el primero sale al momento y los que lleguen en los
// 5 min siguientes se juntan en un solo resumen.
// ═══════════════════════════════════════════════════════

// [id, etiqueta del boton, nombre para /alertas, encendido por defecto]
export const ALERTAS_TIPOS = [
  ['compras', 'Compras', 'Compras (pedido pagado, con sus botones)', 1],
  ['registros', 'Registros', 'Registros (cuenta nueva o invitado que crea su cuenta)', 1],
  ['nivel10', 'Nivel 10', 'Alguien llega a nivel 10', 1],
  ['pendientes', 'Sin entregar', 'Recordatorio de pedidos sin entregar', 1],
  ['retiros', 'Retiros', 'Retiros de mTON por pagar', 1],
  ['chicha', 'Chicha', 'Reclamos del premio de chicha', 1],
  ['reportes', 'Reportes', 'Reportes entre jugadores', 0],
  ['cupo', 'Cupo', 'Cupo de escrituras del servidor', 0],
];
const POR_DEFECTO = Object.fromEntries(ALERTAS_TIPOS.map(([id, , , on]) => [id, !!on]));
export const ALERTA_VENTANA_MS = 5 * 60 * 1000;   // antirafaga de registros y nivel 10
const COLA_MAX = 300;        // en una oleada se cuentan todos, pero solo se guardan tantos nombres
const NOMBRES_MAX = 12;      // nombres por tipo en un resumen; el resto va como «y N más»

const limpio = t => String(t || '').replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 24) || 'sin nombre';
const origenDe = uid => uid.startsWith('tg:') ? 'Telegram' : uid.startsWith('inv:') ? 'invitado' : 'correo';

export const Alertas = {
  // Lo que el dueño cambio (se lee una vez y queda en memoria).
  async alertasPref() {
    if (!this._alPref) {
      let p = null;
      try { p = await this.state.storage.get('alertasAdmin'); } catch (e) { console.error('[MMO alertas]', e); }
      // Otra llamada pudo cargarlo (o cambiarlo) mientras se esperaba: gana la que ya esta.
      if (!this._alPref) this._alPref = p && typeof p === 'object' ? p : {};
    }
    return this._alPref;
  },
  // Un tipo desconocido (o sin tipo) siempre se envia: callar por error un aviso de dinero seria peor.
  async alertaActiva(tipo) {
    if (!tipo || !Object.hasOwn(POR_DEFECTO, tipo)) return true;
    const p = await this.alertasPref();
    return typeof p[tipo] === 'boolean' ? p[tipo] : POR_DEFECTO[tipo];
  },
  async alertasEstado() {
    const p = await this.alertasPref();
    return { ok: true, tipos: ALERTAS_TIPOS.map(([id, corto, nombre, def]) => ({ id, corto, nombre, on: typeof p[id] === 'boolean' ? p[id] : !!def, def: !!def })) };
  },
  // Orden del bot (/alertas): { tipo, on } cambia uno; { tipo: 'defecto' } vuelve a lo de fabrica; sin tipo solo lee.
  async alertasInterno(b) {
    const tipo = b && typeof b.tipo === 'string' ? b.tipo : '';
    if (!tipo) return this.alertasEstado();
    const p = await this.alertasPref();
    if (tipo === 'defecto') { for (const k of Object.keys(p)) delete p[k]; }
    else if (!Object.hasOwn(POR_DEFECTO, tipo) || typeof b.on !== 'boolean') return { ok: false, error: 'No conozco ese aviso. Tipos: ' + ALERTAS_TIPOS.map(x => x[0]).join(', ') };
    else if (b.on === POR_DEFECTO[tipo]) delete p[tipo];
    else p[tipo] = b.on;
    try { await this.state.storage.put('alertasAdmin', p); }
    catch (e) { console.error('[MMO alertas guardar]', e); return { ok: false, error: 'No se pudo guardar. Prueba otra vez.' }; }
    return this.alertasEstado();
  },

  // ── Informativos agrupables: registros y nivel 10 ──
  alertaInfo(tipo, nombre, detalle) {
    const q = this._alCola || (this._alCola = []);
    if (q.length < COLA_MAX) q.push({ tipo, nombre, detalle: detalle || '' });
    else this._alDemas = (this._alDemas || 0) + 1;
    this.alertasVolcar(Date.now()).catch(e => console.error('[MMO alertas volcar]', e));
  },
  // Cuenta nueva (Telegram o correo) o invitado que pasa su duende a una cuenta. Un invitado anonimo no avisa.
  alertaRegistro(c, heredado) {
    if (!c || !c.uid || c.uid.startsWith('inv:')) return;
    if (this.env && this.env.ADMIN_TG_ID && c.uid === 'tg:' + this.env.ADMIN_TG_ID) return;   // el propio dueño
    this.alertaInfo('registros', limpio(c.nombre), origenDe(c.uid) + (heredado ? ', era invitado · Nv ' + (c.nivel || 1) : '') + (c.invitadoPor ? ', vino invitado por un amigo' : ''));
  },
  // Una sola vez por personaje (c.av10; lo conserva al pasar de invitado a cuenta). Las cuentas de prueba no avisan.
  alertaNivel10(c) {
    if (!c || c.av10 || (this.esPrueba && this.esPrueba(c))) return;
    c.av10 = 1;
    this.alertaInfo('nivel10', limpio(c.nombre), origenDe(c.uid));
  },
  // Lo llaman alertaInfo (al momento) y el tick cada 10 s (lo que quedo esperando la ventana).
  async alertasVolcar(ahora) {
    const q = this._alCola;
    if (!q || !q.length || this._alEnviando) return false;
    if (this._alT && ahora - this._alT < ALERTA_VENTANA_MS && ahora >= this._alT) return false;
    this._alEnviando = true;
    try {
      const lote = q.splice(0);
      const demas = this._alDemas || 0; this._alDemas = 0;
      const partes = [];
      for (const [tipo, uno, varios] of [['registros', '🆕 Registro', '🆕 Registros'], ['nivel10', '⭐ Nivel 10', '⭐ Llegaron a nivel 10']]) {
        const l = lote.filter(x => x.tipo === tipo);
        if (!l.length || !(await this.alertaActiva(tipo))) continue;
        const txt = x => x.nombre + (x.detalle ? ' (' + x.detalle + ')' : '');
        if (l.length === 1) partes.push(`${uno} — ${txt(l[0])}`);
        else partes.push(`${varios}: ${l.length}\n` + l.slice(0, NOMBRES_MAX).map(x => '· ' + txt(x)).join('\n') + (l.length > NOMBRES_MAX ? `\n· y ${l.length - NOMBRES_MAX} más` : ''));
      }
      if (!partes.length) return false;   // todo apagado: no cuenta como envio (no abre ventana)
      this._alT = ahora;
      const total = lote.length + demas;
      const cab = total > 1 ? `🔔 Resumen: ${total} novedades${demas ? ' (oleada: no caben todos los nombres)' : ''}\n\n` : '';
      await this.avisarAdmin(cab + partes.join('\n\n') + '\n\nElige qué te llega: /alertas', null, true);
      return true;
    } finally { this._alEnviando = false; }
  },
};
