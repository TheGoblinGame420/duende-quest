// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — Modo Dios (moderacion del dueño) y nombres unicos
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Quien es dios lo decide SOLO el servidor, nunca el cliente:
//  - la cuenta de Telegram ADMIN_TG_ID (la misma que manda en el bot), y
//  - lo que liste el secreto MMO_ADMINS (separado por comas): uids como
//    "web:<id de Supabase>" o correos de cuentas web con el correo
//    confirmado ("dueño@correo.com").
// Los invitados nunca lo son.
//
// Poderes: invencible, matar de un golpe, moverse sin limite de velocidad,
// viajar a cualquier mapa o junto a un jugador, traerlo, curarse. Moderacion:
// expulsar, silenciar, banear (por uid, sobrevive a reconexiones),
// renombrar, dar oro o skins, anuncios a todo el servidor y entregar o anular
// las compras premium (SOL / $DUENDE / Stars) desde el propio juego.
// Mientras un poder de dios esta encendido no se gana mTON ni se sube en el
// ranking: el dueño no compite con sus jugadores.
//
// Nombres: dos personajes no pueden llamarse igual (sin distinguir
// mayusculas) y los nombres que imitan al equipo ("admin", "moderador",
// "El Duende"...) quedan reservados. Antes un invitado podia entrar con el
// nombre de cualquiera.
// ═══════════════════════════════════════════════════════
import { MAPAS, SKINS, MONSTRUOS, MUNDIALES, limpiarNombre } from '../../mmo/js/data.js';
import { getEnv } from '../api/lib.js';

const RESERVADO = /admin|moderador|^mod|mod$|^gm|gm$|staff|soporte|sistema|oficial|elduende|duendequest|dios/;
// Clave para comparar nombres: minusculas, sin tildes, sin espacios ni '_'
// (asi "El_Duende", "el duende" y "ÉlDuende" son el mismo). Las letras no
// latinas no llegan aqui: limpiarNombre las quita (el cirilico o el griego
// identicos a los latinos servian para saltarse la unicidad).
export const claveNombre = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_]+/g, '');
const ORO_MAX_DAR = 10000000;
const MODOS = ['inv', 'golpe', 'vel'];

export const Dios = {
  // ── QUIEN ES DIOS ──
  esDios(s) { return !!(s && s.c && s.dios); },
  calcularDios(s, extra) {
    const env = getEnv({ env: this.env });
    const uid = s.c.uid;
    if (uid.startsWith('inv:')) return false;
    if (env.ADMIN_TG_ID && uid === 'tg:' + env.ADMIN_TG_ID) return true;
    const lista = String(this.env.MMO_ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (lista.includes(uid.toLowerCase())) return true;
    return !!(extra && extra.email && extra.emailOk && lista.includes(String(extra.email).toLowerCase()));
  },
  diosActivo(s) { return !!(s && s.dios && s.diosModo && MODOS.some(k => s.diosModo[k])); },

  // ── NOMBRES UNICOS ──
  nombreReservado(n) { return RESERVADO.test(claveNombre(n)); },
  // Devuelve un nombre libre para uid partiendo de "deseado" (le añade cifras
  // si ya es de otro). No lo reserva: eso lo hace reservarNombre al guardarse.
  async nombreLibre(deseado, uid, dios) {
    let base = limpiarNombre(deseado) || 'Duende';
    if (!dios && this.nombreReservado(base)) base = 'Duende';
    for (let i = 0; i < 12; i++) {
      const n = i === 0 && base !== 'Duende' ? base : (base.slice(0, 11) + Math.floor(1000 + Math.random() * 9000));
      const dueno = await this.state.storage.get('n:' + claveNombre(n));
      if (!dueno || dueno === uid) return n;
    }
    return 'Duende' + Date.now().toString(36).slice(-6);
  },
  async reservarNombre(c, antes) {
    if (antes && claveNombre(antes) !== claveNombre(c.nombre)) {
      const k = 'n:' + claveNombre(antes);
      if ((await this.state.storage.get(k)) === c.uid) await this.state.storage.delete(k);
    }
    const k = 'n:' + claveNombre(c.nombre);
    const dueno = await this.state.storage.get(k);
    if (!dueno) await this.state.storage.put(k, c.uid);
  },

  // ── SANCIONES ──
  async cargarMod() {
    if (!this.mod) this.mod = (await this.state.storage.get('mod')) || { ban: {}, mute: {} };
    return this.mod;
  },
  guardarMod() { this.state.storage.put('mod', this.mod).catch(() => {}); },
  async baneado(uid) {
    const mod = await this.cargarMod();
    const b = mod.ban[uid];
    if (!b) return null;
    if (b.hasta && b.hasta < Date.now()) { delete mod.ban[uid]; this.guardarMod(); return null; }
    return b;
  },
  silenciado(s) {
    const h = this.mod && this.mod.mute[s.c.uid];
    if (!h) return 0;
    if (h < Date.now()) { delete this.mod.mute[s.c.uid]; this.guardarMod(); return 0; }
    return h;
  },

  // ── PANEL ──
  async dios(s, m) {
    if (!this.esDios(s)) return;   // el cliente no decide: si no lo es, silencio
    const a = String(m.a || '');
    const ok = t => this.enviar(s, { t: 'toast', m: t, ok: true });
    const t = this.sesiones.get(m.p | 0);
    const objetivo = t && t.c ? t : null;
    s.diosModo = s.diosModo || {};
    switch (a) {
      case 'estado': return this.enviarPanelDios(s);
      case 'modo': {
        if (!MODOS.includes(m.k)) return;
        s.diosModo[m.k] = !!m.v;
        if (m.k === 'inv' && m.v) s.hp = s.st.maxHp;
        this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
        this.enviar(s, { t: 'diosModo', modo: s.diosModo });
        return ok(`⚡ ${{ inv: 'Invencible', golpe: 'Golpe divino', vel: 'Velocidad libre' }[m.k]}: ${m.v ? 'activado' : 'desactivado'}`);
      }
      case 'curar':
        s.hp = s.st.maxHp; s.rec = s.st.recMax; s.muerto = false;
        this.actualizarYo(s);
        return ok('✨ Vida y recurso al máximo.');
      case 'tp': {
        const id = String(m.mapa || '');
        if (!Object.hasOwn(MAPAS, id) || MAPAS[id].instancia) return this.no(s, 'Ese mapa no existe (las mazmorras son instancias: entra por su portal).');
        this.entrarMapa(s, id, MAPAS[id].spawn || 150);
        return ok('🌀 Viajaste a ' + MAPAS[id].nombre + '.');
      }
      case 'irA': {
        if (!objetivo || objetivo === s) return;
        if (objetivo.k.includes('#')) return this.no(s, `${objetivo.c.nombre} está en una mazmorra (instancia privada).`);
        this.entrarMapa(s, objetivo.c.mapa, objetivo.x);
        return ok('🌀 Estás junto a ' + objetivo.c.nombre + '.');
      }
      case 'traer': {
        if (!objetivo || objetivo === s) return;
        if (s.k.includes('#') || objetivo.k.includes('#') || objetivo.duelo || objetivo.m3) return this.no(s, 'No se puede traer a nadie desde o hacia una mazmorra, un duelo o el mundo 3D.');
        this.entrarMapa(objetivo, s.c.mapa, s.x);
        this.enviar(objetivo, { t: 'toast', m: '🌀 Un moderador te trajo a su lado.' });
        return ok('🌀 Trajiste a ' + objetivo.c.nombre + '.');
      }
      case 'mundial3': {
        // Invoca ya al jefe mundial del 3D (si no hay uno vivo).
        const W = this.iniciar3d();
        if (W.mundial && W.mundial.o && !W.mundial.o.muere) return this.no(s, 'Ya hay un jefe mundial en el mundo 3D.');
        const k = MUNDIALES.includes(m.k) ? m.k : MUNDIALES[Math.floor(Math.random() * MUNDIALES.length)];
        this.aparecerMundial3(k, this.sesiones3d().length);
        return ok('👹 Invocaste a ' + MONSTRUOS[k].nombre + ' en el mundo 3D.');
      }
      case 'anuncio': {
        const txt = String(m.m || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
        if (!txt) return;
        this.aTodos({ t: 'aviso', m: '📢 ' + txt });
        return;
      }
      case 'oro': {
        if (!objetivo) return;
        const n = Math.floor(Number(m.n));
        if (!Number.isFinite(n) || n === 0 || Math.abs(n) > ORO_MAX_DAR) return this.no(s, `Cantidad entre 1 y ${ORO_MAX_DAR.toLocaleString('es')} (negativa para quitar).`);
        objetivo.c.oro = Math.max(0, objetivo.c.oro + n);
        objetivo.sucio = true;
        this.actualizarYo(objetivo); await this.guardar(objetivo);
        if (objetivo !== s) this.enviar(objetivo, { t: 'toast', m: n > 0 ? `🎁 Un moderador te dio ${n.toLocaleString('es')} oro.` : `Un moderador te quitó ${(-n).toLocaleString('es')} oro.`, ok: n > 0 });
        this.registrarMod(s, `oro ${n} a ${objetivo.c.nombre}`);
        return ok(`💰 ${objetivo.c.nombre}: ${n > 0 ? '+' : ''}${n.toLocaleString('es')} oro.`);
      }
      case 'skin': {
        if (!objetivo || typeof m.id !== 'string' || !Object.hasOwn(SKINS, m.id) || m.id === 'comun') return;
        const c = objetivo.c;
        if (m.quitar) {
          c.skins = c.skins.filter(x => x !== m.id);
          if (c.skin === m.id) this.equipar(objetivo, { k: 'skin', id: 'comun' });
        } else if (!c.skins.includes(m.id)) {
          c.skins.push(m.id);
          this.equipar(objetivo, { k: 'skin', id: m.id });
          this.enviar(objetivo, { t: 'toast', m: `🎁 ¡Recibiste la skin ${SKINS[m.id].nombre}! Sus poderes ya están activos.`, ok: true });
        }
        this.actualizarYo(objetivo); await this.guardar(objetivo);
        this.registrarMod(s, `${m.quitar ? 'quitó' : 'dio'} skin ${m.id} a ${c.nombre}`);
        return ok(`🎭 ${m.quitar ? 'Quitaste' : 'Diste'} ${SKINS[m.id].nombre} a ${c.nombre}.`);
      }
      case 'renombrar': {
        if (!objetivo) return;
        const antes = objetivo.c.nombre;
        const n = await this.nombreLibre(m.n, objetivo.c.uid, this.esDios(objetivo));
        objetivo.c.nombre = n;
        await this.reservarNombre(objetivo.c, antes);
        this.aClave(objetivo.k, { t: 'pl', id: objetivo.id }, objetivo);
        this.aClave(objetivo.k, { t: 'pj', p: this.infoJugador(objetivo) }, objetivo);
        this.actualizarYo(objetivo); await this.guardar(objetivo);
        this.enviar(objetivo, { t: 'toast', m: `Un moderador cambió tu nombre a «${n}».` });
        this.registrarMod(s, `renombró ${antes} → ${n}`);
        return ok(`✏️ ${antes} ahora se llama ${n}.`);
      }
      case 'expulsar': {
        if (!objetivo || objetivo === s) return;
        this.registrarMod(s, `expulsó a ${objetivo.c.nombre}`);
        this.expulsar(objetivo, 'Un moderador te desconectó' + (m.motivo ? ': ' + String(m.motivo).slice(0, 80) : '.'));
        return ok('👢 Expulsado.');
      }
      case 'silenciar': {
        if (!objetivo || objetivo === s) return;
        const min = Math.max(0, Math.min(7 * 24 * 60, Math.floor(Number(m.min) || 0)));
        const mod = await this.cargarMod();
        if (min) mod.mute[objetivo.c.uid] = Date.now() + min * 60000; else delete mod.mute[objetivo.c.uid];
        this.guardarMod();
        this.enviar(objetivo, { t: 'toast', m: min ? `🔇 Un moderador te silenció ${min} min.` : '🔊 Ya puedes volver a escribir en el chat.' });
        this.registrarMod(s, `${min ? 'silenció ' + min + ' min' : 'quitó silencio'} a ${objetivo.c.nombre}`);
        return ok(min ? `🔇 ${objetivo.c.nombre} silenciado ${min} min.` : `🔊 ${objetivo.c.nombre} puede volver a hablar.`);
      }
      case 'banear': {
        if (!objetivo || objetivo === s || this.esDios(objetivo)) return;
        const horas = Math.max(0, Math.min(24 * 365, Number(m.horas) || 0));
        const mod = await this.cargarMod();
        mod.ban[objetivo.c.uid] = { n: objetivo.c.nombre, hasta: horas ? Date.now() + horas * 3600000 : 0, motivo: String(m.motivo || '').slice(0, 80), t: Date.now() };
        this.guardarMod();
        this.registrarMod(s, `baneó a ${objetivo.c.nombre} (${horas ? horas + ' h' : 'permanente'})`);
        this.expulsar(objetivo, 'Fuiste baneado' + (horas ? ` por ${horas} h` : '') + (m.motivo ? ': ' + String(m.motivo).slice(0, 80) : '.'));
        return ok('⛔ Baneado.');
      }
      case 'desbanear': {
        const mod = await this.cargarMod();
        const uid = Object.keys(mod.ban).find(u => mod.ban[u].t === Number(m.t));
        if (!uid) return;
        this.registrarMod(s, `desbaneó a ${mod.ban[uid].n}`);
        delete mod.ban[uid];
        this.guardarMod();
        ok('✅ Ban retirado.');
        return this.enviarPanelDios(s);
      }
      // ── COPIAS DE SEGURIDAD (copias.js) ──
      case 'copias': return this.enviar(s, { t: 'diosCopias', ...(await this.infoCopias()) });
      case 'copiaYa': {
        const e = await this.hacerCopia('manual');
        if (!e) return this.no(s, 'No se pudo hacer la copia (mira los registros del servidor).');
        this.registrarMod(s, `copia ${e.id}`);
        ok(`💾 Copia ${e.id}: ${e.pj} personajes, ${(e.bytes / 1024).toFixed(0)} KB${e.fuera === 'telegram' ? ' · enviada a tu Telegram' : e.fuera === 'r2' ? ' · subida a R2' : ' · solo interna (sin destino externo)'}.`);
        return this.enviar(s, { t: 'diosCopias', ...(await this.infoCopias()) });
      }
      case 'restaurarPj': {
        const r = await this.restaurarJugador(String(m.id || ''), String(m.quien || '').slice(0, 80));
        if (!r.ok) return this.no(s, r.error);
        this.registrarMod(s, `restauró a ${r.nombre} desde ${m.id}`);
        return ok(`♻️ ${r.nombre} (Nv ${r.nivel}) vuelve a como estaba en la copia ${m.id}.`);
      }
      case 'restaurarMundo': {
        this.registrarMod(s, `restaura el mundo desde ${m.id}`);
        const r = await this.restaurarMundo(await this.leerCopia(String(m.id || '')));
        if (!r.ok) return this.no(s, r.error);
        return;   // todos (tambien el dueño) quedan desconectados
      }
      case 'subirCopia': {
        this.registrarMod(s, 'restaura el mundo desde un archivo subido');
        const r = await this.restaurarSubida(m.b64);
        if (!r.ok) return this.no(s, r.error);
        return;
      }
      case 'entregar': {
        const r = await this.entregarPedido({ codigo: m.codigo, por: 'dios' });
        if (!r.ok) return this.no(s, r.error);
        this.registrarMod(s, `entregó pedido ${r.pedido.codigo}`);
        ok(`🎁 Pedido #${r.pedido.codigo} entregado a ${r.pedido.jugador}.`);
        return this.enviarPanelDios(s);
      }
      case 'anular': {
        const r = await this.anularPedido({ codigo: m.codigo, motivo: m.motivo });
        if (!r.ok) return this.no(s, r.error);
        this.registrarMod(s, `anuló pedido ${r.pedido.codigo}`);
        ok(`❌ Pedido #${r.pedido.codigo} anulado.${r.reembolso || ''}`);
        return this.enviarPanelDios(s);
      }
    }
  },

  registrarMod(s, txt) {
    this.modLog = this.modLog || [];
    this.modLog.push({ t: Date.now(), de: s.c.nombre, txt: String(txt).slice(0, 120) });
    if (this.modLog.length > 50) this.modLog.shift();
    console.log('[MMO dios]', s.c.nombre, txt);
  },

  async enviarPanelDios(s) {
    const mod = await this.cargarMod();
    const ahora = Date.now();
    const jugadores = [...this.sesiones.values()].filter(x => x.c).map(x => ({
      p: x.id, n: x.c.nombre, lv: x.c.nivel, mapa: x.c.mapa, inst: x.k.includes('#') ? 1 : 0,
      tipo: x.c.uid.split(':')[0], skins: x.c.skins, oro: x.c.oro, mute: (mod.mute[x.c.uid] || 0) > ahora ? 1 : 0, gm: x.dios ? 1 : 0,
    }));
    const pedidos = this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'esperando_pago').slice(-40).map(x => ({
      codigo: x.codigo, jugador: x.jugador, nombre: x.nombre, usd: x.usd, metodo: x.metodo, estado: x.estado, creado: x.creado,
      firma: x.firma || '', cadena: x.cadena || null, monto: x.metodo === 'duende' ? x.duendeRaw / 1e6 + ' $DUENDE' : x.metodo === 'sol' ? (x.lamports / 1e9).toFixed(9) + ' SOL' : (x.starsPagadas || x.stars) + ' Stars',
    }));
    const bans = Object.values(mod.ban).map(b => ({ n: b.n, hasta: b.hasta, motivo: b.motivo, t: b.t }));
    this.enviar(s, { t: 'diosPanel', jugadores, pedidos, bans, log: (this.modLog || []).slice(-15), modo: s.diosModo || {} });
  },
};
