// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — Modo Dios (moderacion del dueño) y nombres unicos
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Quien es dios lo decide SOLO el servidor, nunca el cliente:
//  - la cuenta de Telegram ADMIN_TG_ID (la misma que manda en el bot), y
//  - lo que liste el secreto MMO_ADMINS (separado por comas): SOLO uids como
//    "web:<id de Supabase>" o "tg:<id>". Los correos ya no cuentan (un correo
//    ajeno se podia registrar sin confirmar y heredar el Modo Dios).
// Los invitados nunca lo son.
//
// Dos niveles: 'dueno' (ADMIN_TG_ID) y 'mod' (MMO_ADMINS). Solo el dueño mueve
// economia o copias (oro, skins, pedidos, copias, golpe divino, jefe mundial).
// Un mod no actua sobre otro admin ni sobre el dueño; el dueño si puede
// expulsar o banear a un mod. Sin ADMIN_TG_ID configurado, MMO_ADMINS es dueño
// (como antes, para no dejar el juego sin nadie con todos los poderes).
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
import { riesgoEstafa, riesgoContacto, RE_GROSERIA } from './social.js';
const RE_GROSERIA_1 = new RegExp(RE_GROSERIA.source, 'i');

// Por subcadena (sin espacios): imita al equipo o a quien cobra ("Tienda Duende", "Yape Pagos").
// 'mod', 'gm', 'dios' van como palabra suelta en nombreReservado (si no, caen 'Modesto', 'Claudio Soto').
const RESERVADO = /admin|moderador|staff|soporte|sistema|oficial|elduende|duendequest|dueno|owner|creador|developer|tienda|pagos|yape|plin(?!io)|cajer|cobrador|vendedor|ventas|vendooro|telegram|equipoduende|duendeteam|teamduende|duendeoficial/;
// Lo mismo con las letras que se confunden a la vista (Adm1n, EIDuende, T1enda, M0derador…):
// i/l/1/| → l, 0/ø → o, 3 → e, 4/@ → a, 5/$ → s, 7 → t, ð → d, rn → m.
const RESERVADO_ESQ = /admln|moderador|staff|soporte|slstema|oflclal|elduende|duendequest|dueno|owner|creador|developer|tlenda|pagos|yape|plln(?!lo)|cajer|cobrador|vendedor|ventas|vendooro|telegram|equlpoduende|duendeteam|teamduende|duendeoflclal/;
// Groserias por subcadena sobre el nombre sin espacios ('Soy Puta', 'XPendejo'). 'verga' sin 'Vergara' (apellido); 'puta' sin Diputado/Computadora/Disputa.
const RE_GROSERIA_NOMBRE = /putamadre|conchatumadre|conchatumare|conchasumare|ctmr|csmr|chucha|mierd|pendej|cojud|huev[oó]n|huevon|webon|maric[oó]n|maricon|cabr[oó]n|cabron|poronga|pinga|cacher|porno|violar|nazi|hitler|(?<!d[il]|com|re|[il]m|am|d[il]s)put[ao]|verga(?!ra)/;
const PAL_RESERVADA = new Set(['mod', 'mods', 'gm', 'dios', 'dlos', 'admin', 'admln', 'staff']);
// Solo para nombres NUEVOS (los ya creados se quedan como estan): imitan al premio o a quien lo entrega
// («MamaAsiri», «ChichaEnvios», «DuendeToken»). Pasan nombres de verdad: Yasiri, Kasiri, Jasiri, Chicharito, Chicharrón.
const RESERVADO_PREMIO = /chicha(?!rr|ron|rit)|chicher[ao]|(?<![ykj])asiri|envio|entrega|premio|reclam[ao]|wh?at?s+app?|guas+ap+|waz+ap+|wsp|wpp|token|ventaduende|duendeventa|compraduende/;
const RESERVADO_PREMIO_ESQ = /chlcha(?!rr|ron|rlt)|chlcher[ao]|(?<![ykj])aslrl|envlo|entrega|premlo|reclam[ao]|wh?at?s+app?|guas+ap+|waz+ap+|wsp|wpp|token|ventaduende|duendeventa|compraduende/;
// Un nombre con 5 cifras o mas puede llevar un telefono falso encima de la cabeza.
export const CIFRAS_NOMBRE_MAX = 4;
export const cifrasNombre = n => (String(n || '').match(/\d/g) || []).length;
export const esqueleto = n => claveNombre(n).replace(/[il1|!]/g, 'l').replace(/[0ø]/g, 'o').replace(/3/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/ð/g, 'd').replace(/rn/g, 'm');
// Clave para comparar nombres: minusculas, sin tildes, sin espacios ni '_'
// (asi "El_Duende", "el duende" y "ÉlDuende" son el mismo). Las letras no
// latinas no llegan aqui: limpiarNombre las quita (el cirilico o el griego
// identicos a los latinos servian para saltarse la unicidad).
export const claveNombre = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_]+/g, '');
const ORO_MAX_DAR = 10000000;
const MODOS = ['inv', 'golpe', 'vel'];
// Lo que solo puede hacer el dueño (mueve economia o copias).
const SOLO_DUENO = new Set(['oro', 'skin', 'mundial3', 'copias', 'copiaYa', 'restaurarPj', 'restaurarMundo', 'subirCopia', 'entregar', 'anular']);
// Acciones sobre otro jugador: un mod no las usa contra un admin.
const SOBRE_OTRO = new Set(['traer', 'oro', 'skin', 'renombrar', 'expulsar', 'silenciar', 'banear']);

export const Dios = {
  // ── QUIEN ES DIOS ──
  esDios(s) { return !!(s && s.c && s.dios); },
  esDueno(s) { return !!(s && s.c && s.dios === 'dueno'); },
  // Devuelve 'dueno', 'mod' o false.
  calcularDios(s, extra) {
    const env = getEnv({ env: this.env });
    // Con cuentas vinculadas cuenta tambien la cuenta con la que se entro.
    // Y las vinculadas (c.vinc): el dueño que entra por la web a su duende de Telegram ve los PEDIDOS.
    const v = s.c.vinc && typeof s.c.vinc === 'object' ? s.c.vinc : {};
    const uids = [s.c.uid, s.uidAuth, v.tg, v.web].filter(u => typeof u === 'string' && u);
    if (uids.every(u => u.startsWith('inv:'))) return false;
    if (env.ADMIN_TG_ID && uids.includes('tg:' + env.ADMIN_TG_ID)) return 'dueno';
    const lista = String(this.env.MMO_ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (uids.some(u => lista.includes(u.toLowerCase()))) return env.ADMIN_TG_ID ? 'mod' : 'dueno';
    // El correo NO da dios: con 'Confirm email' apagado en Supabase cualquiera puede
    // registrar un correo ajeno ya "confirmado". Solo valen uids (web:<uuid> / tg:<id>);
    // el aviso del log dice que uid añadir a MMO_ADMINS.
    if (extra && extra.email && lista.includes(String(extra.email).toLowerCase()))
      console.warn('[MMO] correo de MMO_ADMINS sin su uid en la lista; añade a MMO_ADMINS:', uids.filter(u => u.startsWith('web:')).join(','));
    return false;
  },
  diosActivo(s) { return !!(s && s.dios && s.diosModo && MODOS.some(k => s.diosModo[k])); },

  // ── NOMBRES UNICOS ──
  // Lo que ya valia antes: imitar al equipo o groserias. Se sigue aplicando a los nombres ya creados.
  nombreDelEquipo(n) {
    const pal = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[\s_]+/);
    const k = claveNombre(n), e = esqueleto(n);
    return pal.some(p => PAL_RESERVADA.has(p) || PAL_RESERVADA.has(esqueleto(p))) || RESERVADO.test(k) || RESERVADO_ESQ.test(e) ||
      RE_GROSERIA_1.test(String(n || '')) || RE_GROSERIA_1.test(k) || RE_GROSERIA_NOMBRE.test(k) || RE_GROSERIA_NOMBRE.test(e);
  },
  // Para nombres nuevos: ademas, el premio, quien lo entrega, 5 cifras o mas, y una cifra metida en medio («Chi9cha»).
  nombreReservado(n) {
    if (this.nombreDelEquipo(n) || cifrasNombre(n) > CIFRAS_NOMBRE_MAX) return true;
    return this.nombrePremio(n) || RESERVADO.test(claveNombre(n).replace(/\d/g, ''));
  },
  // Solo el premio y quien lo entrega; las hermandades lo miran sobre el nombre entero («Chi Cha»).
  nombrePremio(n) {
    const k = claveNombre(n), kSin = k.replace(/\d/g, '');
    return RESERVADO_PREMIO.test(k) || RESERVADO_PREMIO.test(kSin) || RESERVADO_PREMIO_ESQ.test(esqueleto(n));
  },
  // Devuelve un nombre libre para uid partiendo de "deseado" (le añade cifras
  // si ya es de otro). No lo reserva: eso lo hace reservarNombre al guardarse.
  // yaCreado: el nombre ya existia (invitado que pasa a cuenta): no le cae lo que se prohibio despues.
  async nombreLibre(deseado, uid, dios, yaCreado) {
    let base = limpiarNombre(deseado) || 'Duende';
    if (!dios && (yaCreado ? this.nombreDelEquipo(base) : this.nombreReservado(base))) base = 'Duende';
    // Al sumar 4 cifras por choque se quitan las que traia: «Juan916» no acaba en «Juan9161234».
    const raiz = (dios ? base : base.replace(/\d+/g, '').trim()) || 'Duende';
    for (let i = 0; i < 12; i++) {
      const n = i === 0 && base !== 'Duende' ? base : (raiz.slice(0, 11) + Math.floor(1000 + Math.random() * 9000));
      const dueno = await this.state.storage.get('n:' + claveNombre(n));
      // Tampoco uno que se vea igual ('AIonso' con I mayuscula, 'Pedr0'): clave ne: por esqueleto.
      const duenoEsq = await this.state.storage.get('ne:' + esqueleto(n));
      if ((!dueno || dueno === uid) && (!duenoEsq || duenoEsq === uid)) return n;
    }
    return 'Duende' + Date.now().toString(36).slice(-6);
  },
  // n: por claveNombre y ne: por esqueleto. Los nombres viejos ganan su ne: al volver a entrar.
  async reservarNombre(c, antes) {
    if (antes && claveNombre(antes) !== claveNombre(c.nombre)) {
      const k = 'n:' + claveNombre(antes);
      if ((await this.state.storage.get(k)) === c.uid) await this.state.storage.delete(k);
    }
    if (antes && esqueleto(antes) !== esqueleto(c.nombre)) {
      const k = 'ne:' + esqueleto(antes);
      if ((await this.state.storage.get(k)) === c.uid) await this.state.storage.delete(k);
    }
    for (const k of ['n:' + claveNombre(c.nombre), 'ne:' + esqueleto(c.nombre)]) {
      const dueno = await this.state.storage.get(k);
      if (!dueno) await this.state.storage.put(k, c.uid);
    }
  },
  // Herencia invitado→cuenta: la reserva del nombre pasa del uid del invitado a la cuenta.
  async pasarNombre(uidInv, uid, nombre) {
    if (!uidInv || !uid || !nombre) return;
    for (const k of ['n:' + claveNombre(nombre), 'ne:' + esqueleto(nombre)]) {
      if ((await this.state.storage.get(k)) === uidInv) await this.state.storage.put(k, uid);
    }
  },
  // El invitado ('DuendeNNNN') elige su nombre una sola vez y gratis (Ajustes en ORIGINS y CLASSIC).
  async miNombre(s, m) {
    const c = s && s.c;
    if (!c) return;
    const ahora = Date.now();
    if (ahora - (s.miNombreT || 0) < 2000) return this.enviar(s, { t: 'toast', m: 'Espera unos segundos e inténtalo otra vez.' });
    if (c.nombreLibreUsado || !/^Duende[0-9a-z]{3,6}$/i.test(c.nombre || '')) return this.enviar(s, { t: 'toast', m: 'Ya elegiste tu nombre.' });
    if (typeof m.n !== 'string' || m.n.trim().length < 3 || m.n.trim().length > 16) return this.enviar(s, { t: 'toast', m: 'El nombre debe tener de 3 a 16 letras.' });
    const pedido = String(m.n).slice(0, 16);
    const limpio = limpiarNombre(pedido);
    const antes = c.nombre;
    s.miNombreT = ahora;
    const n = await this.nombreLibre(pedido, c.uid, false);
    if (s.cerrado || s.c !== c) return;
    if (!limpio || limpio.length < 3 || /^duende/i.test(n) || n !== limpio) {
      if (!limpio || limpio.length < 3) return this.enviar(s, { t: 'toast', m: 'El nombre debe tener de 3 a 16 letras.' });
      if (cifrasNombre(limpio) > CIFRAS_NOMBRE_MAX) return this.enviar(s, { t: 'toast', m: `Ese nombre lleva muchas cifras y parece un teléfono: usa ${CIFRAS_NOMBRE_MAX} como máximo.` });
      if (this.nombreReservado(limpio)) return this.enviar(s, { t: 'toast', m: 'Ese nombre no está permitido (parece del equipo o de quien entrega los premios, o es una grosería). Prueba otro.' });
      return this.enviar(s, { t: 'toast', m: 'Otro jugador ya se llama así: prueba agregando algo, como «' + limpio.slice(0, 11) + ' Inca»' });
    }
    c.nombre = n;
    c.nombreLibreUsado = 1;
    await this.reservarNombre(c, antes);
    // ORIGINS (s.k '~3d') solo entiende 'pj3' (con 'pl'+'pj' el duende desaparecia para los demas).
    if (s.k === '~3d' && this.info3d) this.aClave(s.k, { t: 'pj3', p: this.info3d(s) }, s);
    else { this.aClave(s.k, { t: 'pl', id: s.id }, s); this.aClave(s.k, { t: 'pj', p: this.infoJugador(s) }, s); }
    this.actualizarYo(s); s.sucio = true; await this.guardar(s);
    this.enviar(s, { t: 'toast', m: `✏️ ¡Listo! Ahora te llamas «${n}».`, ok: true, miNombre: n });
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
    const mod = this.mod;
    if (!mod) return 0;
    let h = mod.mute[s.c.uid] || 0;
    if (h && h < Date.now()) { delete mod.mute[s.c.uid]; this.guardarMod(); h = 0; }
    // El silencio queda tambien en el dispositivo (huella 'dev') y, en IPv6, en
    // su /64: un invitado no se libra entrando con otro token. Solo para
    // invitados y nunca en una IPv4 (CGNAT: la comparten cientos de moviles).
    if (!h && mod.muteIp && s.c.uid.startsWith('inv:')) {
      for (const k of this.clavesBloqueo(s)) {
        const hi = mod.muteIp[k] || 0;
        if (hi && hi < Date.now()) { delete mod.muteIp[k]; this.guardarMod(); } else if (hi > h) h = hi;
      }
    }
    return h;
  },
  // Claves con las que se bloquea a un invitado: 'd:' + su huella de dispositivo
  // y, solo en IPv6, su /64 (claveIp de world.js). La IPv4 nunca.
  clavesBloqueo(s) {
    const l = [];
    if (s.dev) l.push('d:' + s.dev);
    if (s.ip && s.ip.includes(':')) l.push(s.ip);
    return l;
  },

  // ── PANEL ──
  async dios(s, m) {
    if (!this.esDios(s)) return;   // el cliente no decide: si no lo es, silencio
    const a = String(m.a || '');
    const ok = t => this.enviar(s, { t: 'toast', m: t, ok: true });
    const t = this.sesiones.get(m.p | 0);
    const objetivo = t && t.c ? t : null;
    s.diosModo = s.diosModo || {};
    const dueno = this.esDueno(s);
    if (!dueno && (SOLO_DUENO.has(a) || (a === 'modo' && m.k === 'golpe'))) return this.no(s, 'Solo el dueño puede hacer eso.');
    if (!dueno && SOBRE_OTRO.has(a) && objetivo && objetivo !== s && this.esDios(objetivo)) return this.no(s, 'Un moderador no puede actuar sobre otro admin.');
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
        // Un moderador firma con su nombre y pasa el filtro antiestafa: nadie anuncia una cartera «del equipo».
        if (!dueno && (riesgoEstafa(txt) || riesgoContacto(txt))) return this.no(s, '🛡 Los anuncios de moderador no pueden llevar carteras, enlaces, cobros, teléfonos ni frases semilla.');
        this.aTodos({ t: 'aviso', m: dueno ? '📢 ' + txt : '📢 [Mod ' + s.c.nombre + '] ' + txt });
        this.registrarMod(s, 'anuncio: ' + txt);
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
        const n = await this.nombreLibre(m.n, objetivo.c.uid, this.esDueno(objetivo));
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
        mod.muteIp = mod.muteIp || {};
        for (const k in mod.muteIp) if (mod.muteIp[k] < Date.now()) delete mod.muteIp[k];
        // Solo al silenciar a un INVITADO y como mucho 1 h en su dispositivo (o su /64
        // en IPv6). Nunca en la IPv4: por CGNAT la comparten muchos invitados que no hicieron nada.
        if (!min) { for (const k of [objetivo.ip, ...this.clavesBloqueo(objetivo)]) if (k) delete mod.muteIp[k]; }
        else if (objetivo.c.uid.startsWith('inv:')) for (const k of this.clavesBloqueo(objetivo)) mod.muteIp[k] = Date.now() + Math.min(min, 60) * 60000;
        this.guardarMod();
        this.enviar(objetivo, { t: 'toast', m: min ? `🔇 Un moderador te silenció ${min} min.` : '🔊 Ya puedes volver a escribir en el chat.' });
        this.registrarMod(s, `${min ? 'silenció ' + min + ' min' : 'quitó silencio'} a ${objetivo.c.nombre}`);
        return ok(min ? `🔇 ${objetivo.c.nombre} silenciado ${min} min.` : `🔊 ${objetivo.c.nombre} puede volver a hablar.`);
      }
      case 'banear': {
        // El dueño si puede banear a un mod; al dueño no lo banea nadie.
        if (!objetivo || objetivo === s || this.esDueno(objetivo)) return;
        const horas = Math.max(0, Math.min(24 * 365, Number(m.horas) || 0));
        const mod = await this.cargarMod();
        mod.ban[objetivo.c.uid] = { n: objetivo.c.nombre, hasta: horas ? Date.now() + horas * 3600000 : 0, motivo: String(m.motivo || '').slice(0, 80), t: Date.now(), d: dueno ? 1 : 0 };
        // A un INVITADO se le banea tambien el dispositivo (huella 'dev') y, en IPv6,
        // su /64, como mucho 24 h: si no, borraba su token y volvia al momento. La
        // IPv4 no (CGNAT). Solo afecta a invitados (world.js, hola).
        const ks = this.clavesBloqueo(objetivo);
        if (ks.length && objetivo.c.uid.startsWith('inv:')) {
          mod.banIp = mod.banIp || {};
          for (const k in mod.banIp) if (mod.banIp[k] < Date.now()) delete mod.banIp[k];
          for (const k of ks) mod.banIp[k] = Date.now() + Math.min(horas || 24, 24) * 3600000;
          mod.ban[objetivo.c.uid].ks = ks;
        }
        this.guardarMod();
        this.registrarMod(s, `baneó a ${objetivo.c.nombre} (${horas ? horas + ' h' : 'permanente'})`);
        this.expulsar(objetivo, 'Fuiste baneado' + (horas ? ` por ${horas} h` : '') + (m.motivo ? ': ' + String(m.motivo).slice(0, 80) : '.'));
        return ok('⛔ Baneado.');
      }
      case 'desbanear': {
        const mod = await this.cargarMod();
        const uid = Object.keys(mod.ban).find(u => mod.ban[u].t === Number(m.t));
        if (!uid) return;
        // Un ban puesto por el dueño solo lo quita el dueño.
        if (mod.ban[uid].d && !dueno) return this.no(s, 'Ese ban lo puso el dueño: solo él puede quitarlo.');
        this.registrarMod(s, `desbaneó a ${mod.ban[uid].n}`);
        if (mod.ban[uid].ip && mod.banIp) delete mod.banIp[mod.ban[uid].ip];
        if (Array.isArray(mod.ban[uid].ks) && mod.banIp) for (const k of mod.ban[uid].ks) delete mod.banIp[k];
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
        const u = this.juntarSubida(s, m);
        if (!u) return;   // aun faltan trozos del archivo
        if (u.error) return this.no(s, u.error);
        this.registrarMod(s, 'restaura el mundo desde un archivo subido');
        const r = await this.restaurarSubida(u.b64);
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
    if (!this.modLog) {
      // Primera acción tras un reinicio: junta lo guardado con lo nuevo.
      this.modLog = [];
      this.state.storage.get('modLog').then(v => { if (Array.isArray(v)) { this.modLog = v.concat(this.modLog).slice(-50); this.state.storage.put('modLog', this.modLog).catch(() => {}); } }).catch(() => {});
    }
    this.modLog.push({ t: Date.now(), de: s.c.nombre, txt: String(txt).slice(0, 120) });
    if (this.modLog.length > 50) this.modLog.shift();
    // Persistente: sobrevive a reinicios del objeto (antes se perdía y no quedaba rastro de lo que hizo un mod).
    this.state.storage.put('modLog', this.modLog).catch(() => {});
    console.log('[MMO dios]', s.c.nombre, txt);
  },

  async enviarPanelDios(s) {
    const mod = await this.cargarMod();
    if (!this.modLog) { const v = await this.state.storage.get('modLog').catch(() => null); this.modLog = this.modLog || (Array.isArray(v) ? v : []); }
    const ahora = Date.now();
    const jugadores = [...this.sesiones.values()].filter(x => x.c).map(x => ({
      p: x.id, n: x.c.nombre, lv: x.c.nivel, mapa: x.c.mapa, inst: x.k.includes('#') ? 1 : 0,
      tipo: x.c.uid.split(':')[0], skins: x.c.skins, oro: x.c.oro, mute: this.silenciado(x) > ahora ? 1 : 0, gm: x.dios ? 1 : 0, dn: x.dios === 'dueno' ? 1 : 0,
    }));
    const dueno = this.esDueno(s);
    // Los pedidos (pagos) solo los ve el dueño.
    const pedidos = !dueno ? [] : this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'esperando_pago').slice(-40).map(x => ({
      codigo: x.codigo, jugador: x.jugador, nombre: x.nombre, usd: x.usd, metodo: x.metodo, estado: x.estado, creado: x.creado,
      firma: x.firma || '', cadena: x.cadena || null, monto: x.metodo === 'duende' ? x.duendeRaw / 1e6 + ' $DUENDE' : x.metodo === 'sol' ? (x.lamports / 1e9).toFixed(9) + ' SOL' : (x.starsPagadas || x.stars) + ' Stars',
    }));
    const bans = Object.values(mod.ban).map(b => ({ n: b.n, hasta: b.hasta, motivo: b.motivo, t: b.t, d: b.d ? 1 : 0 }));
    this.enviar(s, { t: 'diosPanel', nivel: s.dios, jugadores, pedidos, bans, log: (this.modLog || []).slice(-15), modo: s.diosModo || {}, fallosSupabase: dueno ? this.fallosSupabase || 0 : 0 });
  },
};
