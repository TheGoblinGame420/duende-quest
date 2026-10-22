// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — servidor del mundo (Durable Object)
//
// Un solo objeto lleva todo el mundo: con la escala actual (decenas de
// jugadores a la vez como mucho) es mas simple y barato que repartir mapas
// entre varios objetos, y los mensajes ya van filtrados por mapa por si
// algun dia hay que partirlo.
//
// Autoridad: el servidor decide vida, daño, oro, experiencia, compras y
// monstruos. El cliente solo manda intenciones (moverse, atacar, usar un
// poder). La posicion del jugador la manda el cliente (responde al instante)
// pero se valida contra la velocidad maxima posible.
// ═══════════════════════════════════════════════════════

import {
  MAPAS, MONSTRUOS, statsMonstruo, statsJugador, xpParaSubir, SKINS, ARMAS, PODERES, MISIONES, DIARIA, premioDiaria, hoyUTC,
  FORJA_MAX, costoForja, multForja,
  RANURAS, RAREZAS, BOLSA_MAX, baseItem, precioVenta, nombreItem,
  LOGIN_PREMIOS, multLogin, LOGROS, MUNDIAL_DURA_MS, proximoMundial,
  MTON_POR_TON, RETIRO_MIN_MTON, MTON_NIVEL_MIN, MTON_EDAD_MIN_MS, WALLET_ESPERA_MS, FONDO_REFERENCIA_MTON, tonAmigable,
  RETIRO_MAX_MTON, RETIRO_CADA_MS, TOPE_DIARIO_PCT, FONDO_PCT_INGRESOS, PAQUETES, estrellasDe, PEDIDO_VIGENCIA_MS,
  SUELO, TICK_MS, NIVEL_MAX, FIS, limpiarNombre, CLASES, HABS, MONTURAS, velMontura, descansoGanado, DESCANSO_MAX,
} from '../../mmo/js/data.js';
import { getEnv, verifyInitData, verifySupabaseUser, supabaseQuery, tg, getSolPriceUsd, SOL_DEV_WALLET } from '../api/lib.js';
import { Combate } from './combate.js';
import { Social, pub } from './social.js';
import { Mazmorras } from './mazmorras.js';
import { Hermandades } from './hermandades.js';

const MAX_JUGADORES = 300;
const GUARDAR_CADA_MS = 20000;
const JEFE_REAPARECE_MS = 5 * 60 * 1000;
const JEFE_PRIMERO_MS = 60 * 1000;
const ESCUDO_MS = 5000;
const FUEGO_MS = 8000;
const INVULNERABLE_GOLPE_MS = 900;
const INACTIVO_MS = 10 * 60 * 1000;
const EVASION = HABS.find(h => h.id === 'evasion').esquiva;
const REDUCE_MURO = HABS.find(h => h.id === 'muro').reduce;
const REDUCE_SUPRESION = HABS.find(h => h.id === 'supresion').reduce;
// Bots de las pruebas en produccion (sus tokens de invitado son fijos): juegan
// de verdad pero no deben aparecer en el ranking de los jugadores reales.
const UIDS_PRUEBA = new Set(['inv:db4c11dc0a66af5e7b009f14', 'inv:145ca8bcf50bad57e9077518']);

async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

function personajeNuevo(uid, nombre) {
  return {
    uid, nombre, nivel: 1, xp: 0, oro: 100,
    mapa: 'pueblo', x: MAPAS.pueblo.spawn,
    arma: 'katana', armas: ['katana'],
    skin: 'comun', skins: ['comun'],
    pw: { pocion: 5, escudo: 1, rayo: 1, fuego: 1 },
    kills: 0, jefes: 0, creado: Date.now(),
    mis: { i: 0, p: 0 },
    eq: {}, bolsa: [], logros: [], titulo: '', mundiales: 0, login: null,
    mton: 0, mtonTotal: 0, wallet: null,
    clase: null, herm: null,
  };
}

const idItem = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);

// Objeto de equipo al azar de nivel nv. rMin = rareza minima (los jefes y la
// racha diaria la garantizan). Lo genera SIEMPRE el servidor.
function generarItem(nv, rMin) {
  const ranuras = Object.keys(RANURAS);
  const s = ranuras[Math.floor(Math.random() * ranuras.length)];
  const total = RAREZAS.reduce((a, x) => a + x.peso, 0);
  let tiro = Math.random() * total, r = 0;
  for (let i = 0; i < RAREZAS.length; i++) { tiro -= RAREZAS[i].peso; if (tiro <= 0) { r = i; break; } }
  r = Math.max(r, rMin || 0);
  const mult = RAREZAS[r].mult;
  const base = baseItem(s, nv);
  const b = {};
  for (const k in base) b[k] = k === 'crit' ? Math.round(base[k] * mult * 100) / 100 : Math.max(1, Math.round(base[k] * mult));
  // Raro en adelante: una linea extra al azar (lo que hace que valga la pena
  // mirar cada objeto que cae).
  if (r >= 1) {
    const extra = ['atk', 'def', 'hp', 'crit'][Math.floor(Math.random() * 4)];
    const v = extra === 'crit' ? Math.round(0.01 * r * 100) / 100 : Math.max(1, Math.round(nv * r * (extra === 'hp' ? 1.2 : extra === 'atk' ? 0.12 : 0.1)));
    b[extra] = extra === 'crit' ? Math.round(((b[extra] || 0) + v) * 100) / 100 : (b[extra] || 0) + v;
  }
  return { id: idItem(), s, nv: Math.max(1, Math.round(nv)), r, b };
}

export class MmoWorld {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sesiones = new Map();          // id de sesion -> sesion
    this.porUid = new Map();            // uid -> sesion
    // Cada "clave" es un mundo vivo con sus monstruos: un mapa abierto
    // ('noche') o una instancia privada de mazmorra ('cripta#a1b2'). Los
    // jugadores llevan la suya en s.k y los monstruos en o.cl.
    this.mundo = {};
    for (const id in MAPAS) if (!MAPAS[id].instancia) this.mundoK(id);
    this.sigBala = 1;
    this.sigSesion = 1;
    this.sigMon = 1;
    this.bucle = null;
    this.fondo = null;
    this.retiros = [];
    this.pedidos = [];
    this.ingresosSol = [];
    if (state.blockConcurrencyWhile) state.blockConcurrencyWhile(() => this.migrar());
  }

  // Migraciones de una sola vez sobre el almacenamiento del mundo.
  async migrar() {
    try {
      this.fondo = (await this.state.storage.get('fondo')) || null;
      this.retiros = (await this.state.storage.get('retiros')) || [];
      this.pedidos = (await this.state.storage.get('pedidos')) || [];
      this.ingresosSol = (await this.state.storage.get('ingresosSol')) || [];
      // Los personajes de prueba de las verificaciones en produccion del
      // 30-sep-2026 ("Bot Prueba" subio a Nv 2) no deben salir en el ranking real.
      if (!(await this.state.storage.get('mig:ranking-pruebas'))) {
        const r = (await this.state.storage.get('ranking')) || [];
        const pruebas = ['Bot Prueba', 'Probador', 'ClaudeTest', 'Duendecillo Bot', 'Sim'];
        await this.state.storage.put('ranking', r.filter(x => !pruebas.includes(x.n)));
        await this.state.storage.put('mig:ranking-pruebas', 1);
      }
    } catch (e) { console.error('[MMO migrar]', e); }
  }

  async fetch(request) {
    try { return await this._fetch(request); }
    catch (e) { console.error('[MMO fetch]', e); return new Response('Error del servidor', { status: 500 }); }
  }

  async _fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/interno/')) return this.interno(request, url.pathname.slice(9));
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(JSON.stringify({ ok: true, online: this.contarOnline() }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (this.sesiones.size >= MAX_JUGADORES) return new Response('Servidor lleno', { status: 503 });
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    this.abrir(servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  contarOnline() { let n = 0; for (const s of this.sesiones.values()) if (s.c) n++; return n; }

  // ── CONEXION ──
  abrir(ws) {
    const s = { id: this.sigSesion++, ws, c: null, cuenta: 0, ventana: Date.now(), cerrado: false };
    this.sesiones.set(s.id, s);
    ws.addEventListener('message', ev => {
      this.recibir(s, ev.data).catch(e => { console.error('[MMO]', e); this.enviar(s, { t: 'err', m: 'Error del servidor' }); });
    });
    const cerrar = () => this.cerrar(s);
    ws.addEventListener('close', cerrar);
    ws.addEventListener('error', cerrar);
    setTimeout(() => { if (!s.c && !s.cerrado) this.expulsar(s, 'Sin identificación'); }, 15000);
  }

  expulsar(s, motivo) {
    this.enviar(s, { t: 'err', m: motivo, fatal: true });
    try { s.ws.close(4000, 'fin'); } catch (e) {}
    this.cerrar(s);
  }

  async cerrar(s) {
    if (s.cerrado) return;
    s.cerrado = true;
    this.sesiones.delete(s.id);
    if (s.c) {
      if (this.porUid.get(s.c.uid) === s) this.porUid.delete(s.c.uid);
      this.desconectarDeGrupo(s);
      this.aClave(s.k, { t: 'pl', id: s.id }, s);
      this.olvidar(s);
      this.salirDeMundo(s);
      await this.guardar(s);
    }
    if (this.contarOnline() === 0 && this.bucle) { clearInterval(this.bucle); this.bucle = null; }
  }

  enviar(s, obj) {
    if (s.cerrado) return;
    try { s.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) {}
  }

  // A todos los que estan en el mismo mundo (mapa abierto o instancia).
  aClave(clave, obj, excepto) {
    const txt = JSON.stringify(obj);
    for (const s of this.sesiones.values()) if (s.c && s.k === clave && s !== excepto) this.enviar(s, txt);
  }

  mundoK(clave) {
    let w = this.mundo[clave];
    if (!w) w = this.mundo[clave] = { clave, mapa: clave.split('#')[0], mons: new Map(), balas: [], jefeEn: 0, spawnEn: 0 };
    return w;
  }
  mundoDe(s) { return this.mundoK(s.k); }

  // Los monstruos se olvidan de quien muere, se va o se desconecta.
  olvidar(s) {
    const w = this.mundo[s.k];
    if (!w) return;
    for (const o of w.mons.values()) {
      o.amen.delete(s.id);
      if (o.au.provoca && o.au.provoca.sid === s.id) delete o.au.provoca;
    }
  }
  // Gancho para las instancias (mazmorras): se sobreescribe en su modulo.
  salirDeMundo(s) {}

  aTodos(obj) {
    const txt = JSON.stringify(obj);
    for (const s of this.sesiones.values()) if (s.c) this.enviar(s, txt);
  }

  // ── MENSAJES ──
  async recibir(s, data) {
    if (s.cerrado) return;
    const ahora = Date.now();
    if (ahora - s.ventana > 1000) { s.ventana = ahora; s.cuenta = 0; }
    if (++s.cuenta > 60) { if (s.cuenta > 200) this.expulsar(s, 'Demasiados mensajes'); return; }
    if (typeof data !== 'string' || data.length > 4000) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hola') return this.hola(s, m);
    if (!s.c) return;
    if (m.t !== 'ping') s.actT = ahora;
    switch (m.t) {
      case 'mv': return this.mover(s, m);
      case 'atk': return this.atacar(s, m);
      case 'clase': return this.elegirClase(s, m);
      case 'espec': return this.elegirEspec(s, m);
      case 'montar': return this.montar(s);
      case 'invitar': return this.invitar(s, m);
      case 'grupoResp': return this.respuestaGrupo(s, m);
      case 'salirGrupo': return this.salirGrupo(s);
      case 'expulsarGrupo': return this.expulsarGrupo(s, m);
      case 'liderGrupo': return this.liderGrupo(s, m);
      case 'quien': return this.quien(s);
      case 'mazmorra': return this.entrarMazmorra(s, m);
      case 'hermCrear': return this.crearHermandad(s, m);
      case 'hermInvitar': return this.invitarHerm(s, m);
      case 'hermResp': return this.respuestaHerm(s, m);
      case 'hermSalir': return this.salirHerm(s);
      case 'hermExpulsar': return this.expulsarHerm(s, m);
      case 'hermRango': return this.rangoHerm(s, m);
      case 'hermMotd': return this.motdHerm(s, m);
      case 'herm': return this.verHerm(s);
      case 'cancelar': return this.cancelarCast(s);
      case 'pw': return this.poder(s, m);
      case 'portal': return this.portal(s, m);
      case 'chat': return this.chat(s, m);
      case 'comprar': return this.comprar(s, m);
      case 'equipar': return this.equipar(s, m);
      case 'revivir': return this.revivir(s);
      case 'mision': return this.mision(s, m);
      case 'regreso': return this.regreso(s);
      case 'ranking': return this.enviarRanking(s);
      case 'hab': return this.habilidad(s, m);
      case 'item': return this.item(s, m);
      case 'titulo': return this.ponerTitulo(s, m);
      case 'wallet': return this.ponerWallet(s, m);
      case 'retirar': return this.retirar(s);
      case 'fondo': return this.enviar(s, { t: 'fondo', ...this.infoFondo() });
      case 'pedido': return this.pedido(s, m);
      case 'pedidoFirma': return this.pedidoFirma(s, m);
      case 'ping': return this.enviar(s, { t: 'pong', ts: m.ts });
    }
  }

  // ── IDENTIDAD ──
  async hola(s, m) {
    if (s.c || s.autenticando) return;
    s.autenticando = true;
    const env = getEnv({ env: this.env });
    const a = m.auth || {};
    let uid = null, nombre = null, pagadas = null;
    try {
      if (a.k === 'tg' && typeof a.d === 'string') {
        // 24 h y no las 6 h de las rutas de dinero: si la Mini App quedo
        // abierta en segundo plano, Telegram entrega el initData del momento
        // en que se abrio y con 6 h el jugador quedaba bloqueado. Aqui no se
        // mueve dinero real, asi que la ventana larga no arriesga nada.
        const u = await verifyInitData(a.d, env.BOT_TOKEN, 24 * 3600);
        if (u?.id) {
          uid = 'tg:' + u.id;
          nombre = limpiarNombre(u.username || u.first_name) || 'Duende' + String(u.id).slice(-4);
          pagadas = { tgId: String(u.id) };
        }
      } else if (a.k === 'web' && typeof a.tok === 'string') {
        const u = await verifySupabaseUser(env, a.tok);
        if (u?.id) {
          uid = 'web:' + u.id;
          nombre = limpiarNombre(u.user_metadata && u.user_metadata.username) || 'Duende' + u.id.slice(0, 4);
          pagadas = { webId: u.id };
        }
      } else if (a.k === 'inv' && /^[a-f0-9]{32}$/.test(a.tok || '')) {
        uid = 'inv:' + (await sha256hex('dq-mmo:' + a.tok)).slice(0, 24);
        nombre = limpiarNombre(m.nombre) || 'Duende' + Math.floor(1000 + Math.random() * 9000);
      }
    } catch (e) { uid = null; }
    if (!uid) {
      // auth: el cliente reintenta como invitado en vez de quedar bloqueado.
      console.warn('[MMO] identidad no verificada', a.k);
      s.autenticando = false;
      this.enviar(s, { t: 'err', m: 'No se pudo verificar tu identidad.', fatal: true, auth: String(a.k || '') });
      try { s.ws.close(4000, 'auth'); } catch (e) {}
      this.cerrar(s);
      return;
    }
    if (s.cerrado) return;

    // Misma cuenta abierta en otra pestaña: la vieja se cierra.
    const vieja = this.porUid.get(uid);
    if (vieja && vieja !== s) { await this.guardar(vieja); this.expulsar(vieja, 'Tu cuenta se abrió en otro dispositivo'); }

    let c = await this.state.storage.get('c:' + uid);
    let heredado = false;
    // Quien jugo como invitado y luego entra con su cuenta (web o Telegram)
    // no empieza de cero: si la cuenta aun no tiene personaje, hereda el del
    // invitado (el token es secreto: solo lo tiene quien jugo con el).
    if (!c && !uid.startsWith('inv:') && /^[a-f0-9]{32}$/.test(m.inv || '')) {
      const uidInv = 'inv:' + (await sha256hex('dq-mmo:' + m.inv)).slice(0, 24);
      const previo = uidInv !== uid && await this.state.storage.get('c:' + uidInv);
      if (previo && !this.porUid.has(uidInv)) {
        c = { ...previo, uid, nombre };
        await this.state.storage.delete('c:' + uidInv);
        heredado = true;
        const r = (await this.state.storage.get('ranking')) || [];
        const fila = r.find(x => x.uid === uidInv);
        if (fila) { fila.uid = uid; fila.n = nombre; await this.state.storage.put('ranking', r); }
      }
    }
    const nuevo = !c;
    if (!c) c = personajeNuevo(uid, nombre);
    c.skins = c.skins || ['comun']; c.armas = c.armas || ['katana']; c.pw = c.pw || {};
    c.mis = c.mis || { i: 0, p: 0 };
    c.forja = c.forja || {};
    c.mton = c.mton || 0; c.mtonTotal = c.mtonTotal || 0; c.wallet = c.wallet || null;
    c.eq = c.eq || {}; c.bolsa = c.bolsa || []; c.logros = c.logros || []; c.titulo = c.titulo || ''; c.mundiales = c.mundiales || 0;
    for (const p of PODERES) if (typeof c.pw[p.id] !== 'number') c.pw[p.id] = 0;
    if (!Object.hasOwn(CLASES, c.clase || '')) c.clase = null;
    // Las mazmorras son instancias que no sobreviven a una desconexion: se
    // vuelve a la puerta (en el pueblo).
    if (!MAPAS[c.mapa] || MAPAS[c.mapa].instancia) { c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn; }

    // Skins pagadas con dinero real en el juego principal: se regalan aqui.
    const extra = pagadas ? await this.skinsPagadas(env, pagadas) : [];
    const regaladas = extra.filter(k => typeof k === 'string' && Object.hasOwn(SKINS, k) && !c.skins.includes(k));
    c.skins.push(...regaladas);

    s.c = c;
    s.st = this.stats(c);
    // Se guarda la vida y si estaba muerto: si no, cerrar la pestaña justo
    // antes de morir te devolvia con la vida llena en el mismo sitio.
    if (c.muerto) {
      c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
      c.muerto = false; c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn;
      s.hp = s.st.maxHp;
    } else {
      s.hp = typeof c.hp === 'number' ? clamp(c.hp, 1, s.st.maxHp) : s.st.maxHp;
    }
    s.muerto = false;
    s.golpeT = 0;
    s.k = c.mapa;
    s.x = clamp(c.x || 200, 20, MAPAS[c.mapa].ancho - 20);
    s.y = SUELO; s.f = 1; s.a = 0;
    s.movT = Date.now(); s.atkT = 0; s.chatT = 0; s.cdPw = {}; s.cdHab = {}; s.inv = 0; s.escudo = 0; s.fuego = 0; s.auraT = 0;
    s.au = {}; s.combo = 0; s.cast = null; s.gcdHasta = 0; s.combateT = 0; s.gastoT = 0; s.cdHogar = 0;
    this.recursoInicial(s);
    s.sucio = true; s.guardadoT = Date.now(); s.actT = Date.now();
    this.porUid.set(uid, s);
    const login = this.procesarLogin(s);
    // XP de descanso por el tiempo fuera (c.salida se pone al guardar).
    let descansado = 0;
    if (c.salida && c.nivel < NIVEL_MAX) {
      const antes = c.descanso || 0;
      c.descanso = Math.min(Math.round(xpParaSubir(c.nivel) * DESCANSO_MAX), antes + descansoGanado(c.nivel, Date.now() - c.salida));
      descansado = c.descanso - antes;
    }
    if (nuevo || heredado || login) await this.guardar(s);

    this.enviar(s, { t: 'bienvenido', id: s.id, yo: this.datosPropios(s), nuevo, heredado, regaladas, on: this.contarOnline() });
    if (login) this.enviar(s, { t: 'login', ...login });
    if (descansado > 0) this.enviar(s, { t: 'toast', m: `😴 Descansaste: tus próximas cazas dan el DOBLE de experiencia (+${c.descanso.toLocaleString('es')} XP de descanso).`, ok: true });
    this.enviar(s, this.estadoMundial());
    this.entrarMapa(s, c.mapa, s.x, true);
    this.reengancharGrupo(s);
    await this.cargarHermandadDe(s);
    if (c.herm) this.refrescarApariencia(s);
    this.revisarLogros(s);
    if (!this.bucle) this.bucle = setInterval(() => this.tick(), TICK_MS);
  }

  async skinsPagadas(env, p) {
    if (!env.HAS_SERVICE_KEY) return [];
    try {
      if (p.tgId) {
        const d = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${encodeURIComponent(p.tgId)}&select=skin_id`);
        return Array.isArray(d) ? d.map(r => r.skin_id) : [];
      }
      if (p.webId) {
        const prof = await supabaseQuery(env, `profiles?id=eq.${encodeURIComponent(p.webId)}&select=wallet_solana&limit=1`);
        const w = Array.isArray(prof) && prof[0] && prof[0].wallet_solana;
        if (!w) return [];
        const d = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${encodeURIComponent(w)}&select=skin_id`);
        return Array.isArray(d) ? d.map(r => r.skin_id) : [];
      }
    } catch (e) {}
    return [];
  }

  stats(c) { return statsJugador(c.nivel, c.skin, c.eq, c.clase, c.espec); }

  // ── mTON / PLAY TO EARN ──
  // Quien puede ganar: cuenta real (Telegram o web, no invitado), Nv 15+ y
  // personaje con 48 h. Frena granjas de bots con cuentas desechables.
  elegibilidad(c) {
    return {
      cuenta: !c.uid.startsWith('inv:') && !UIDS_PRUEBA.has(c.uid),
      nivel: c.nivel >= MTON_NIVEL_MIN,
      edad: Date.now() - (c.creado || Date.now()) >= MTON_EDAD_MIN_MS,
    };
  }

  // El fondo del dia (UTC). auto = % de ingresos de la semana (lo pone el
  // cron cada medianoche); extra = TON diarios que el dueño agrega a mano.
  fondoHoy() {
    const hoy = hoyUTC();
    const f = this.fondo || { dia: '', auto: 0, extra: 0, gastado: 0, porUid: {} };
    if (f.dia !== hoy) { f.dia = hoy; f.gastado = 0; f.porUid = {}; f.avisados = {}; }
    this.fondo = f;
    return f;
  }
  infoFondo() {
    const f = this.fondoHoy();
    const total = Math.round((f.auto || 0) + (f.extra || 0));
    return { total, gastado: Math.round(f.gastado), auto: Math.round(f.auto || 0), extra: Math.round(f.extra || 0) };
  }
  guardarFondo() { this.state.storage.put('fondo', this.fondo).catch(() => {}); }

  darMton(s, base, motivo) {
    const c = s.c;
    const el = this.elegibilidad(c);
    const f = this.fondoHoy();
    const total = (f.auto || 0) + (f.extra || 0);
    if (!el.cuenta || !el.nivel || !el.edad) {
      // Una vez por dia se le explica por que no gano mTON.
      if (!f.avisados) f.avisados = {};
      if (el.cuenta && !f.avisados[c.uid]) {
        f.avisados[c.uid] = 1;
        this.enviar(s, { t: 'toast', m: !el.nivel ? `💎 Desde nivel ${MTON_NIVEL_MIN} ganas mTON (TON real) en jefes y misiones.` : '💎 Tu personaje gana mTON a partir de su 2º día de vida.' });
      }
      return 0;
    }
    if (total <= 0) return 0;
    const factor = clamp(total / FONDO_REFERENCIA_MTON, 0.25, 5);
    const topeCuenta = Math.max(50, total * TOPE_DIARIO_PCT);
    const ya = f.porUid[c.uid] || 0;
    const n = Math.floor(Math.min(base * factor, total - f.gastado, topeCuenta - ya));
    if (n <= 0) {
      if (!f.avisados) f.avisados = {};
      if (!f.avisados['x' + c.uid]) { f.avisados['x' + c.uid] = 1; this.enviar(s, { t: 'toast', m: f.gastado >= total ? '💎 El fondo de mTON de hoy ya se repartió. Vuelve mañana.' : '💎 Llegaste al máximo de mTON por jugador de hoy.' }); }
      return 0;
    }
    c.mton += n; c.mtonTotal += n;
    f.gastado += n; f.porUid[c.uid] = ya + n;
    s.sucio = true;
    this.guardarFondo();
    this.enviar(s, { t: 'mton', n, total: c.mton, motivo });
    return n;
  }

  ponerWallet(s, m) {
    const c = s.c;
    const a = String(m.a || '').toLowerCase();
    if (!/^(-1|0):[0-9a-f]{64}$/.test(a)) return this.enviar(s, { t: 'toast', m: 'Dirección de wallet no válida.' });
    if (c.uid.startsWith('inv:')) return this.enviar(s, { t: 'toast', m: 'Inicia sesión con Telegram o tu cuenta para conectar una wallet.' });
    if (c.wallet && c.wallet.a === a) return;
    if (this.retiros.some(x => x.uid === c.uid && x.estado === 'pendiente')) return this.enviar(s, { t: 'toast', m: 'No puedes cambiar de wallet con un retiro pendiente.' });
    return this.state.storage.get('w:' + a).then(async dueno => {
      if (dueno && dueno !== c.uid) return this.enviar(s, { t: 'toast', m: 'Esa wallet ya está ligada a otra cuenta del juego.' });
      if (c.wallet) await this.state.storage.delete('w:' + c.wallet.a);
      await this.state.storage.put('w:' + a, c.uid);
      c.wallet = { a, desde: Date.now() };
      await this.guardar(s);
      this.enviar(s, { t: 'toast', m: `👛 Wallet conectada. Podrás retirar a ella dentro de ${WALLET_ESPERA_MS / 3600000} horas (protección por si te roban la cuenta).`, ok: true });
      this.actualizarYo(s);
    });
  }

  async retirar(s) {
    const c = s.c;
    const el = this.elegibilidad(c);
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (!el.cuenta || !el.nivel) return no(`Para retirar necesitas una cuenta de Telegram o web y nivel ${MTON_NIVEL_MIN}.`);
    if (!c.wallet) return no('Primero conecta tu wallet TON.');
    if (Date.now() - c.wallet.desde < WALLET_ESPERA_MS) return no('Tu wallet es nueva: podrás retirar cuando cumpla ' + (WALLET_ESPERA_MS / 3600000) + ' horas conectada.');
    if (c.mton < RETIRO_MIN_MTON) return no(`El retiro mínimo es ${RETIRO_MIN_MTON.toLocaleString('es')} mTON (${RETIRO_MIN_MTON / MTON_POR_TON} TON).`);
    if (this.retiros.some(x => x.uid === c.uid && x.estado === 'pendiente')) return no('Ya tienes un retiro pendiente de aprobación.');
    const ultimo = this.retiros.filter(x => x.uid === c.uid && x.estado === 'pagado').map(x => x.creado).sort((a, b) => b - a)[0];
    if (ultimo && Date.now() - ultimo < RETIRO_CADA_MS) {
      const dias = Math.ceil((RETIRO_CADA_MS - (Date.now() - ultimo)) / 86400000);
      return no(`Solo se puede retirar una vez por semana: te faltan ${dias} día(s).`);
    }
    const mton = Math.min(Math.floor(c.mton), RETIRO_MAX_MTON);
    const r = {
      id: Math.random().toString(36).slice(2, 8).toUpperCase(), uid: c.uid, nombre: c.nombre, nivel: c.nivel,
      mton, ton: mton / MTON_POR_TON, wallet: c.wallet.a, amigable: tonAmigable(c.wallet.a),
      creado: Date.now(), estado: 'pendiente', kills: c.kills, edadDias: Math.floor((Date.now() - (c.creado || Date.now())) / 86400000),
    };
    c.mton -= mton;
    this.retiros.push(r);
    if (this.retiros.length > 300) this.retiros = this.retiros.filter(x => x.estado === 'pendiente').concat(this.retiros.filter(x => x.estado !== 'pendiente').slice(-200));
    await this.state.storage.put('retiros', this.retiros);
    await this.guardar(s);
    this.enviar(s, { t: 'toast', m: `💸 Retiro de ${r.ton} TON solicitado. El equipo lo revisa y lo paga a tu wallet (normalmente en 24-48 h).`, ok: true });
    this.actualizarYo(s);
    // Solo letras/numeros: un nombre con * _ ` rompia el Markdown del aviso.
    const nom = r.nombre.replace(/[^\p{L}\p{N} ]/gu, '');
    this.avisarAdmin(`💸 *Retiro #${r.id}* — ${r.ton} TON\n👤 ${nom} · Nv ${r.nivel} · ${r.kills} cazas · personaje de ${r.edadDias} días\n👛 \`${r.amigable}\`\n\nPágalo desde tu wallet y luego: /pagado ${r.id}\nSi es trampa: /rechazar ${r.id}`);
  }

  // ── TIENDA PREMIUM (Stars / SOL, entrega manual) ──
  buscarPedido(codigo) { return this.pedidos.find(x => x.codigo === String(codigo || '').toUpperCase()); }
  async guardarPedidos() {
    // Los que nunca se pagaron caducan; se guardan los ultimos 300.
    const ahora = Date.now();
    for (const x of this.pedidos) if (x.estado === 'esperando_pago' && ahora - x.creado > PEDIDO_VIGENCIA_MS) x.estado = 'vencido';
    this.pedidos = this.pedidos.filter(x => x.estado !== 'vencido' || ahora - x.creado < 86400000).slice(-300);
    await this.state.storage.put('pedidos', this.pedidos);
  }
  transparencia() {
    const pagados = this.retiros.filter(x => x.estado === 'pagado');
    return { retirosPagados: pagados.length, tonPagados: Math.round(pagados.reduce((a, x) => a + x.ton, 0) * 1000) / 1000, pct: Math.round(FONDO_PCT_INGRESOS * 100) };
  }

  async pedido(s, m) {
    const c = s.c;
    const pq = PAQUETES.find(x => x.id === m.id);
    if (!pq) return;
    const metodo = m.metodo === 'sol' ? 'sol' : 'stars';
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (c.uid.startsWith('inv:')) return no('Para comprar entra con tu cuenta de Telegram o inicia sesión en el juego web.');
    if (metodo === 'stars' && !c.uid.startsWith('tg:')) return no('Las Stars solo se pueden usar dentro de Telegram. En la web se paga con SOL.');
    if (metodo === 'sol' && c.uid.startsWith('tg:')) return no('Dentro de Telegram se paga con Stars.');
    await this.guardarPedidos();
    if (this.pedidos.filter(x => x.uid === c.uid && x.estado === 'esperando_pago').length >= 3) return no('Tienes compras sin pagar: termina o espera 30 minutos.');
    const env = getEnv({ env: this.env });
    const pd = {
      codigo: Math.random().toString(36).slice(2, 8).toUpperCase(), uid: c.uid, jugador: c.nombre,
      paquete: pq.id, nombre: pq.nombre, usd: pq.usd, metodo, creado: Date.now(), estado: 'esperando_pago',
    };
    if (metodo === 'stars') {
      pd.stars = estrellasDe(pq.usd);
      let link = null;
      try {
        const rsp = await tg(env.BOT_TOKEN, 'createInvoiceLink', {
          title: `🌍 ${pq.nombre}`, description: `DUENDE QUEST ONLINE — ${pq.desc}. Pedido #${pd.codigo}.`,
          payload: JSON.stringify({ mmo: pd.codigo }), currency: 'XTR', prices: [{ label: pq.nombre, amount: pd.stars }],
        });
        link = rsp && rsp.result;
      } catch (e) {}
      if (!link) return no('No se pudo crear el pago con Stars. Intenta de nuevo en un rato.');
      this.pedidos.push(pd);
      await this.guardarPedidos();
      return this.enviar(s, { t: 'factura', codigo: pd.codigo, link });
    }
    const precio = await getSolPriceUsd();
    if (!precio) return no('No se pudo leer el precio del SOL ahora. Intenta en un minuto.');
    // Monto con 4 cifras finales propias de este pedido: si pagas desde otra
    // wallet, El Duende lo reconoce en Solscan solo por el monto.
    const marca = 1 + Math.floor(Math.random() * 9998);
    pd.lamports = Math.ceil(pq.usd / precio * 1e9 / 1e4) * 1e4 + marca;
    pd.precioSol = precio;
    this.pedidos.push(pd);
    await this.guardarPedidos();
    this.enviar(s, { t: 'pedidoSol', codigo: pd.codigo, lamports: pd.lamports, wallet: SOL_DEV_WALLET, usd: pq.usd, nombre: pq.nombre });
  }

  async pedidoFirma(s, m) {
    const c = s.c;
    const pd = this.buscarPedido(m.codigo);
    const firma = String(m.firma || '').trim();
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (!pd || pd.uid !== c.uid || pd.metodo !== 'sol' || pd.estado !== 'esperando_pago') return no('Ese pedido ya no está esperando pago.');
    if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(firma)) return no('Esa firma de transacción no es válida. Cópiala de Phantom o de Solscan.');
    if (await this.state.storage.get('firma:' + firma)) return no('Esa transacción ya se usó para otro pedido.');
    await this.state.storage.put('firma:' + firma, pd.codigo);
    pd.firma = firma; pd.estado = 'por_verificar'; pd.pagadoEn = Date.now();
    // Recien enviada, la transaccion tarda unos segundos en confirmarse.
    for (let i = 0; i < 4; i++) {
      pd.cadena = await this.verificarSol(firma, pd.lamports, pd.creado);
      if (!pd.cadena || pd.cadena.ok || !/no existe/.test(pd.cadena.motivo) || i === 3) break;
      await new Promise(r => setTimeout(r, 5000));
    }
    await this.guardarPedidos();
    no('📨 Recibimos tu pago. El Duende lo revisa y te entrega la compra (te avisamos aquí y por Telegram).');
    this.actualizarYo(s);
    const v = pd.cadena;
    const chequeo = v === null ? '⚠️ No se pudo consultar la cadena: revísalo tú' : v.ok ? `✅ En la cadena: ${(v.recibido / 1e9).toFixed(6)} SOL llegaron a tu wallet` : `❌ En la cadena NO aparece el pago esperado (${v.motivo})`;
    this.avisarAdmin(`◎ *Pedido #${pd.codigo}* — ${pd.nombre} ($${pd.usd})\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n💰 Debe pagar ${(pd.lamports / 1e9).toFixed(9)} SOL a tu wallet\n${chequeo}\n🔗 https://solscan.io/tx/${firma}\n\nSi está bien: /entregar ${pd.codigo}\nSi no: /anular ${pd.codigo}`);
  }

  // Comprueba en la cadena que la transaccion existe, salio bien y dejo en la
  // wallet del dueño al menos lo pedido. Es una AYUDA para la revision manual:
  // la decision la toma el dueño con /entregar.
  async verificarSol(firma, lamports, desde) {
    try {
      const key = this.env.HELIUS_API_KEY;
      const url = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [firma, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
      const d = await r.json();
      const tx = d && d.result;
      if (!tx) return { ok: false, motivo: 'la transacción no existe (o aún no se confirma)', recibido: 0 };
      if (tx.meta && tx.meta.err) return { ok: false, motivo: 'la transacción falló', recibido: 0 };
      const claves = (tx.transaction.message.accountKeys || []).map(k => typeof k === 'string' ? k : k.pubkey);
      const i = claves.indexOf(SOL_DEV_WALLET);
      const recibido = i >= 0 ? tx.meta.postBalances[i] - tx.meta.preBalances[i] : 0;
      if (tx.blockTime && tx.blockTime * 1000 < desde - 120000) return { ok: false, motivo: 'es un pago anterior al pedido', recibido };
      if (recibido < lamports * 0.99) return { ok: false, motivo: `llegaron ${(recibido / 1e9).toFixed(6)} SOL`, recibido };
      return { ok: true, recibido };
    } catch (e) { return null; }
  }

  async pedidoPagadoStars(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.metodo !== 'stars') return { ok: false, error: 'pedido desconocido' };
    if (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido') return { ok: true, repetido: true, nombre: pd.nombre };
    if ('tg:' + b.tgId !== pd.uid || (b.stars | 0) < pd.stars) {
      this.avisarAdmin(`⚠️ Pago de Stars raro en el pedido #${pd.codigo}: pagó ${b.stars} (se pedían ${pd.stars}) desde tg ${b.tgId}. Revísalo; para devolverlo: /anular ${pd.codigo}`);
    }
    pd.estado = 'pagado'; pd.charge = String(b.charge || ''); pd.tgPagador = String(b.tgId || ''); pd.starsPagadas = b.stars | 0; pd.pagadoEn = Date.now();
    await this.guardarPedidos();
    this.avisarAdmin(`⭐ *Pedido #${pd.codigo}* pagado — ${pd.nombre} (${pd.starsPagadas} Stars, ya están en tu bot)\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n\nEntrégalo: /entregar ${pd.codigo}\nO devuelve las Stars: /anular ${pd.codigo}`);
    const s = this.porUid.get(pd.uid);
    if (s) this.actualizarYo(s);
    return { ok: true, nombre: pd.nombre };
  }

  async entregarPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || (pd.estado !== 'pagado' && pd.estado !== 'por_verificar')) return { ok: false, error: 'No hay un pedido pagado con ese código.' };
    const pq = PAQUETES.find(x => x.id === pd.paquete);
    const s = this.porUid.get(pd.uid);
    const c = s ? s.c : await this.state.storage.get('c:' + pd.uid);
    if (!c || !pq) return { ok: false, error: 'No encontré al jugador o el paquete.' };
    c.oro += pq.oro || 0;
    for (const k in (pq.pw || {})) c.pw[k] = Math.min(99, (c.pw[k] || 0) + pq.pw[k]);
    pd.estado = 'entregado'; pd.entregado = Date.now();
    if (pd.metodo === 'sol') {
      this.ingresosSol.push({ usd: pd.usd, t: Date.now() });
      this.ingresosSol = this.ingresosSol.filter(x => Date.now() - x.t < 30 * 86400000);
      await this.state.storage.put('ingresosSol', this.ingresosSol);
    }
    if (s) await this.guardar(s); else await this.state.storage.put('c:' + pd.uid, c);
    await this.guardarPedidos();
    await this.avisarJugador(pd.uid, `🎁 ¡Tu compra "${pd.nombre}" ya está en tu personaje! Gracias por apoyar DUENDE QUEST.`);
    return { ok: true, pedido: pd };
  }

  async anularPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.estado === 'entregado' || pd.estado === 'anulado') return { ok: false, error: 'Ese pedido no se puede anular (no existe, ya se entregó o ya se anuló).' };
    let reembolso = '';
    if (pd.metodo === 'stars' && pd.charge && pd.tgPagador) {
      try {
        const env = getEnv({ env: this.env });
        const rsp = await tg(env.BOT_TOKEN, 'refundStarPayment', { user_id: Number(pd.tgPagador), telegram_payment_charge_id: pd.charge });
        reembolso = rsp && rsp.ok ? ' Las Stars se devolvieron solas.' : ' ⚠️ Telegram no aceptó devolver las Stars: ' + ((rsp && rsp.description) || '?');
      } catch (e) { reembolso = ' ⚠️ No se pudieron devolver las Stars.'; }
    }
    pd.estado = 'anulado'; pd.motivo = String(b.motivo || '').slice(0, 120);
    await this.guardarPedidos();
    await this.avisarJugador(pd.uid, `❌ Tu compra "${pd.nombre}" (#${pd.codigo}) fue anulada${pd.motivo ? ': ' + pd.motivo : ''}.${pd.metodo === 'stars' && reembolso.includes('devolvieron') ? ' Tus Stars fueron devueltas.' : ''}`);
    return { ok: true, pedido: pd, reembolso };
  }

  async avisarAdmin(texto) {
    try {
      const env = getEnv({ env: this.env });
      if (env.BOT_TOKEN && env.ADMIN_TG_ID) await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: env.ADMIN_TG_ID, text: texto, parse_mode: 'Markdown' });
    } catch (e) { console.error('[MMO avisarAdmin]', e); }
  }
  async avisarJugador(uid, texto) {
    const s = this.porUid.get(uid);
    if (s) { this.enviar(s, { t: 'toast', m: texto, ok: true }); this.actualizarYo(s); }
    if (uid.startsWith('tg:')) {
      try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: uid.slice(3), text: texto }); } catch (e) {}
    }
  }

  // Ordenes del bot (/retiros, /pagado, /rechazar, /fondo) y del cron.
  async interno(request, accion) {
    const json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
    if (!this.env.TELEGRAM_BOT_TOKEN || request.headers.get('x-interno') !== this.env.TELEGRAM_BOT_TOKEN) return new Response('no', { status: 403 });
    let b = {};
    try { b = await request.json(); } catch (e) {}
    const f = this.fondoHoy();
    if (accion === 'fondo') {
      if (typeof b.auto === 'number' && b.auto >= 0) {
        // Las compras en SOL de la tienda del MMO viven aqui (no en Supabase):
        // se suman al % de ingresos con el precio del TON que manda el cron.
        const semana = Date.now() - 7 * 86400000;
        const usdSol = this.ingresosSol.filter(x => x.t >= semana).reduce((a, x) => a + x.usd, 0);
        const extraSol = b.precioTon > 0 ? usdSol / b.precioTon * FONDO_PCT_INGRESOS / 7 * MTON_POR_TON : 0;
        f.auto = Math.round(b.auto + extraSol);
      }
      if (typeof b.extra === 'number' && b.extra >= 0) f.extra = Math.round(b.extra);
      this.guardarFondo();
      return json({ ok: true, ...this.infoFondo() });
    }
    if (accion === 'retiros') return json({ ok: true, pendientes: this.retiros.filter(x => x.estado === 'pendiente'), fondo: this.infoFondo() });
    if (accion === 'pedidoValido') {
      const pd = this.buscarPedido(b.codigo);
      const ok = !!pd && pd.metodo === 'stars' && pd.estado === 'esperando_pago' && Date.now() - pd.creado < PEDIDO_VIGENCIA_MS;
      return json({ ok });
    }
    if (accion === 'pedidoPagado') return json(await this.pedidoPagadoStars(b));
    if (accion === 'pedidos') return json({ ok: true, pedidos: this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar') });
    if (accion === 'entregar') return json(await this.entregarPedido(b));
    if (accion === 'anular') return json(await this.anularPedido(b));
    if (accion === 'pagado' || accion === 'rechazar') {
      const r = this.retiros.find(x => x.id === String(b.id || '').toUpperCase() && x.estado === 'pendiente');
      if (!r) return json({ ok: false, error: 'No hay un retiro pendiente con ese código.' });
      r.estado = accion === 'pagado' ? 'pagado' : 'rechazado';
      r.cerrado = Date.now();
      if (b.tx) r.tx = String(b.tx).slice(0, 120);
      if (accion === 'rechazar') {
        // Se le devuelven los mTON (salvo que el dueño lo marque como trampa).
        const s = this.porUid.get(r.uid);
        const c = s ? s.c : await this.state.storage.get('c:' + r.uid);
        if (c && !b.trampa) {
          c.mton = (c.mton || 0) + r.mton;
          if (s) await this.guardar(s); else await this.state.storage.put('c:' + r.uid, c);
        }
      }
      await this.state.storage.put('retiros', this.retiros);
      await this.avisarJugador(r.uid, accion === 'pagado'
        ? `✅ ¡Tu retiro de ${r.ton} TON fue pagado a tu wallet! Gracias por jugar DUENDE QUEST ONLINE.`
        : `❌ Tu retiro de ${r.ton} TON fue rechazado${b.trampa ? ' por uso de trampas.' : '. Los mTON volvieron a tu saldo.'}`);
      return json({ ok: true, retiro: r });
    }
    return json({ ok: false, error: 'acción desconocida' });
  }

  // Recompensa por entrar: una por dia UTC, racha de 7 (faltar un dia la
  // reinicia). Devuelve lo que se dio, o null si hoy ya se cobro.
  procesarLogin(s) {
    const c = s.c;
    const hoy = hoyUTC();
    const L = c.login || { d: null, racha: 0, total: 0 };
    if (L.d === hoy) return null;
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const racha = L.d === ayer ? (L.racha % LOGIN_PREMIOS.length) + 1 : 1;
    const pr = LOGIN_PREMIOS[racha - 1];
    const oro = Math.round((pr.oro || 0) * multLogin(c.nivel));
    c.oro += oro;
    for (const k in (pr.pw || {})) c.pw[k] = Math.min(99, (c.pw[k] || 0) + pr.pw[k]);
    let item = null;
    if (pr.item !== undefined) item = this.darItem(s, generarItem(c.nivel, pr.item), true);
    c.login = { d: hoy, racha, total: (L.total || 0) + 1 };
    return { racha, oro, pw: pr.pw || null, item, txt: pr.txt };
  }

  // Mete un objeto en la bolsa (si esta llena se vende solo).
  darItem(s, it, silencioso) {
    const c = s.c;
    if (it.r === 3) {
      c.tuvoLegendario = true;
      this.aTodos({ t: 'aviso', m: `🌟 ¡${c.nombre} encontró un objeto LEGENDARIO: ${nombreItem(it)}!` });
    }
    if (c.bolsa.length >= BOLSA_MAX) {
      const v = precioVenta(it);
      c.oro += v;
      if (!silencioso) this.enviar(s, { t: 'toast', m: `🎒 Bolsa llena: ${nombreItem(it)} se vendió solo por ${v} oro.` });
      return it;
    }
    c.bolsa.push(it);
    return it;
  }

  // Logros: se revisan cuando cambia algo que los pueda cumplir.
  revisarLogros(s) {
    const c = s.c;
    let cambio = false;
    for (const L of LOGROS) {
      if (c.logros.includes(L.id)) continue;
      let ok = false;
      try { ok = !!L.cond(c); } catch (e) {}
      if (!ok) continue;
      c.logros.push(L.id);
      c.oro += L.oro;
      cambio = true;
      this.enviar(s, { t: 'logro', id: L.id, titulo: L.titulo, oro: L.oro });
    }
    if (cambio) { s.sucio = true; this.actualizarYo(s); }
  }

  diariaDe(c) {
    const hoy = hoyUTC();
    if (!c.diaria || c.diaria.d !== hoy) c.diaria = { d: hoy, p: 0, ok: false };
    return c.diaria;
  }

  datosPropios(s) {
    const c = s.c;
    this.diariaDe(c);
    return {
      diaria: c.diaria,
      nombre: c.nombre, nivel: c.nivel, xp: c.xp, xpSig: xpParaSubir(c.nivel), oro: c.oro,
      hp: Math.ceil(s.hp), maxHp: s.st.maxHp, atk: s.st.atk, def: s.st.def,
      arma: c.arma, armas: c.armas, skin: c.skin, skins: c.skins, pw: c.pw,
      kills: c.kills, jefes: c.jefes, muerto: s.muerto, mis: c.mis, forja: c.forja,
      eq: c.eq, bolsa: c.bolsa, logros: c.logros, titulo: c.titulo, mundiales: c.mundiales, login: c.login, crit: s.st.crit,
      clase: c.clase, rec: Math.round(s.rec || 0), recMax: s.st.recMax, combo: s.combo || 0, mazDia: c.mazDia || null, mazmorras: c.mazmorras || 0, herm: c.herm || null, pid: pub(c.uid), descanso: c.descanso || 0,
      espec: c.espec || null, monturas: c.monturas || [], montura: c.montura || null, montado: s.montado || null,
      mton: c.mton, wallet: c.wallet ? { a: tonAmigable(c.wallet.a), desde: c.wallet.desde } : null,
      p2e: this.elegibilidad(c), creado: c.creado,
      retiros: this.retiros.filter(x => x.uid === c.uid).slice(-5).map(x => ({ id: x.id, ton: x.ton, estado: x.estado, creado: x.creado })),
      pedidos: this.pedidos.filter(x => x.uid === c.uid && x.estado !== 'esperando_pago' && x.estado !== 'vencido').slice(-5)
        .map(x => ({ codigo: x.codigo, nombre: x.nombre, metodo: x.metodo, estado: x.estado, creado: x.creado })),
      transparencia: this.transparencia(),
    };
  }
  actualizarYo(s) { this.enviar(s, { t: 'yo', yo: this.datosPropios(s) }); }

  infoJugador(s) {
    return { ...this.infoApariencia(s), n: s.c.nombre, lv: s.c.nivel, x: Math.round(s.x), y: Math.round(s.y), f: s.f, hp: Math.ceil(s.hp), muerto: s.muerto, au: this.aurasVivas(s.au) };
  }
  // Lo que cambia al equiparse o elegir clase (mensaje 'pa').
  infoApariencia(s) {
    return { p: s.id, id: s.id, sk: s.c.skin, ar: s.c.arma, mx: s.st.maxHp, ti: this.textoTitulo(s.c), cl: s.c.clase || '', rmx: s.st.recMax, hn: this.nombreHermandad(s.c.herm), mo: s.montado || '', es: s.c.espec || '' };
  }
  // Auras con su tiempo restante, para quien llega al mapa y no vio cuando se pusieron.
  aurasVivas(au) {
    const r = {}, ahora = Date.now();
    for (const a in (au || {})) if (au[a].hasta > ahora) r[a] = au[a].hasta === Infinity ? -1 : au[a].hasta - ahora;
    return r;
  }
  textoTitulo(c) { const L = LOGROS.find(x => x.id === c.titulo); return L ? L.titulo : '';
  }

  infoMonstruo(m) {
    return { id: m.id, k: m.k, x: Math.round(m.x), y: Math.round(m.y), f: m.f, hp: Math.ceil(m.hp), mx: m.max, st: this.codigoEstado(m), au: this.aurasVivas(m.au), nv: m.nv || undefined };
  }

  codigoEstado(m) {
    if (m.muere) return 2;
    if (m.embiste) return 4;
    if (m.aviso) return 3;
    if (Date.now() < m.golpeHasta) return 1;
    return 0;
  }

  // ── MAPAS ──
  // clave = mundo vivo (por defecto el mismo id del mapa; las mazmorras
  // pasan una clave de instancia propia).
  entrarMapa(s, mapaId, x, primeraVez, clave) {
    const k = clave || mapaId;
    if (!primeraVez) {
      this.cancelarCast(s);
      this.aClave(s.k, { t: 'pl', id: s.id }, s);
      this.olvidar(s);
      if (s.k !== k) this.salirDeMundo(s, k);
    }
    if (s.montado && (k.includes('#') || mapaId === 'coliseo')) s.montado = null;
    s.c.mapa = mapaId;
    s.k = k;
    s.x = clamp(x, 20, MAPAS[mapaId].ancho - 20);
    s.y = SUELO;
    s.movT = Date.now();
    s.sucio = true;
    const w = this.mundoK(k);
    if (MAPAS[mapaId].jefe && !w.jefeEn) w.jefeEn = Date.now() + JEFE_PRIMERO_MS;
    const jugadores = [];
    for (const o of this.sesiones.values()) if (o.c && o !== s && o.k === k) jugadores.push(this.infoJugador(o));
    this.enviar(s, { t: 'mapa', mapa: mapaId, clave: k, x: Math.round(s.x), jugadores, mons: [...w.mons.values()].map(m => this.infoMonstruo(m)),
      muros: w.muros || [], inst: w.inst ? { id: w.inst.id, nv: w.inst.nv, hechos: w.inst.hechos } : null });
    this.aClave(k, { t: 'pj', p: this.infoJugador(s) }, s);
  }

  portal(s, m) {
    if (s.muerto) return;
    const mapa = MAPAS[s.c.mapa];
    const p = mapa.portales[m.i | 0];
    if (!p || Math.abs(s.x - p.x) > 90) return;
    // El portal de mazmorras abre el buscador (el cliente elige cual).
    if (p.buscador) return this.enviar(s, { t: 'buscador' });
    // Salir de una mazmorra lleva de vuelta a su puerta del mundo abierto.
    this.entrarMapa(s, p.a, p.ax);
    this.guardar(s);
  }

  // ── MOVIMIENTO ──
  mover(s, m) {
    if (s.muerto) return;
    const x = num(m.x), y = num(m.y);
    if (x === null || y === null) return;
    const ahora = Date.now();
    // Justo despues de que el servidor lo mueve (Carga), llegan posiciones
    // viejas que el cliente mando antes de enterarse: se ignoran.
    if (ahora < (s.snapHasta || 0)) return;
    // Encerrado en un Bloque de Hielo no se mueve.
    if (this.aura(s, 'bloque') || this.aura(s, 'aturdido')) { if (Math.abs(x - s.x) > 4) this.enviar(s, { t: 'snap', x: Math.round(s.x), y: Math.round(s.y) }); return; }
    const dt = Math.max(16, ahora - s.movT);
    // Maximo posible: correr + un dash entero + margen por latencia.
    const maxDx = (FIS.vel * velMontura(s.montado) * 60 * dt / 1000) + FIS.dashVel * FIS.dashT + 60;
    const ancho = MAPAS[s.c.mapa].ancho;
    if (Math.abs(x - s.x) > maxDx * 1.25) {
      this.enviar(s, { t: 'snap', x: Math.round(s.x), y: Math.round(s.y) });
      s.movT = ahora;
      return;
    }
    // Las barreras de las mazmorras no se cruzan hasta vencer a su jefe.
    const tope = this.topeMuros(s);
    if (x > tope) {
      if (x > tope + 40) this.enviar(s, { t: 'snap', x: Math.round(Math.min(s.x, tope)), y: Math.round(s.y) });
      m = { ...m, x: Math.min(s.x, tope) };
    }
    // Moverse cancela el hechizo que se esta lanzando (como en WoW).
    if (s.cast && (Math.abs(m.x - s.cast.x) > 6 || Math.abs(y - s.cast.y) > 6)) this.cancelarCast(s, s.cast.h === 'hogar' ? 'Te moviste: la Piedra de Hogar se canceló.' : '');
    s.x = clamp(m.x, 10, ancho - 10);
    s.y = clamp(y, 40, SUELO);
    s.f = m.f === -1 ? -1 : 1;
    s.a = clamp(m.a | 0, 0, 6);
    s.movT = ahora;
    s.c.x = Math.round(s.x);
  }

  // ── EQUIPO ──
  item(s, m) {
    const c = s.c;
    if (typeof m.id !== 'string' && typeof m.ranura !== 'string') return;
    if (m.a === 'quitar') {
      if (!Object.hasOwn(RANURAS, m.ranura) || !c.eq[m.ranura]) return;
      if (c.bolsa.length >= BOLSA_MAX) return this.enviar(s, { t: 'toast', m: 'Tu bolsa está llena: vende algo primero.' });
      c.bolsa.push(c.eq[m.ranura]);
      delete c.eq[m.ranura];
    } else {
      const i = c.bolsa.findIndex(x => x.id === m.id);
      if (i < 0) return;
      const it = c.bolsa[i];
      if (m.a === 'equipar') {
        if (it.nv > c.nivel) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${it.nv} para usar eso.` });
        c.bolsa.splice(i, 1);
        if (c.eq[it.s]) c.bolsa.push(c.eq[it.s]);
        c.eq[it.s] = it;
      } else if (m.a === 'vender') {
        c.bolsa.splice(i, 1);
        c.oro += precioVenta(it);
      } else return;
    }
    const pct = s.hp / s.st.maxHp;
    s.st = this.stats(c);
    s.hp = Math.max(1, Math.min(s.st.maxHp, Math.round(s.st.maxHp * pct)));
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.revisarLogros(s);
    this.actualizarYo(s);
  }

  ponerTitulo(s, m) {
    const c = s.c;
    if (m.id !== '' && !(typeof m.id === 'string' && c.logros.includes(m.id))) return;
    c.titulo = m.id;
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.actualizarYo(s);
  }

  // ── JEFE MUNDIAL ──
  estadoMundial() {
    const m = this.mundial;
    return { t: 'mundial', vivo: !!(m && m.o && !m.o.muere), en: m && m.o ? 0 : proximoMundial(Date.now()) };
  }

  revisarMundial(ahora) {
    const prox = proximoMundial(ahora);
    if (!this.mundial) this.mundial = { avisado: 0, o: null, hasta: 0 };
    const M = this.mundial;
    if (M.o) {
      if (M.o.muere) { M.o = null; this.aTodos(this.estadoMundial()); return; }
      if (ahora > M.hasta) {
        this.mundo.coliseo.mons.delete(M.o.id);
        this.aClave('coliseo', { t: 'md', id: M.o.id, pr: [], huye: true });
        M.o = null;
        this.aTodos({ t: 'aviso', m: '👹 El Gran Duende Corrupto escapó del Coliseo… vuelve en 30 minutos.' });
        this.aTodos(this.estadoMundial());
      }
      return;
    }
    // Aviso 2 minutos antes, a todos los conectados.
    if (prox - ahora <= 120000 && prox - ahora > 5000 && M.avisado !== prox) {
      M.avisado = prox;
      this.aTodos({ t: 'aviso', m: '👹 ¡El Gran Duende Corrupto llega al Coliseo en 2 minutos! Entra por el portal del pueblo: todos los niveles ganan.' });
    }
    // Aparece en la media hora en punto (con margen de un tick).
    const ult = prox - (prox - ahora > 1000 ? 30 * 60 * 1000 : 0);
    if (ahora >= ult && ahora - ult < 5000 && M.ultimo !== ult) {
      M.ultimo = ult;
      const o = this.crearMonstruo('coliseo', 'jefe_mundial', 800);
      const n = Math.max(1, this.contarOnline());
      o.hp = o.max = 20000 + 15000 * n;
      M.o = o; M.hasta = ahora + MUNDIAL_DURA_MS;
      this.aClave('coliseo', { t: 'ms', m: this.infoMonstruo(o) });
      this.aTodos({ t: 'aviso', m: '👹 ¡EL GRAN DUENDE CORRUPTO APARECIÓ EN EL COLISEO! Tienes 10 minutos.' });
      this.aTodos(this.estadoMundial());
    }
  }

  premiosMundial(o) {
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const nombres = [];
    for (const [sid, d] of o.dano) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.k !== 'coliseo') continue;
      const c = s.c;
      const parte = d / total;
      const xp = Math.round(xpParaSubir(c.nivel) * (0.25 + Math.min(0.25, parte)));
      const oro = Math.round(80 * c.nivel * (1 + Math.min(1, parte * 3)));
      c.oro += oro;
      c.mundiales = (c.mundiales || 0) + 1;
      const it = this.darItem(s, generarItem(c.nivel, parte > 0.15 ? 2 : 1));
      // Premio fijo para todos los que ayudaron: si dependiera del daño, una
      // skin pagada con mas ataque daria mas mTON (y se pagaria para ganar).
      if (parte >= 0.02) this.darMton(s, 80, 'mundial');
      this.sumarXp(s, xp);
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it, x: Math.round(o.x), y: Math.round(o.y - o.h) });
      this.enviar(s, { t: 'toast', m: `👹 ¡Venciste al jefe mundial! +${xp} XP · +${oro} oro · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}`, ok: true });
      s.sucio = true;
      this.revisarLogros(s);
      this.actualizarYo(s);
      nombres.push(c.nombre);
    }
    this.aTodos({ t: 'aviso', m: `🏆 ¡El Gran Duende Corrupto cayó! Héroes: ${nombres.slice(0, 6).join(', ')}${nombres.length > 6 ? ' y ' + (nombres.length - 6) + ' más' : ''}` });
  }

  // amen = multiplicador de amenaza de la habilidad (el guerrero ademas
  // genera el doble por ser tanque, ver CLASES[].amenaza).
  danar(o, dmg, s, amen) {
    if (o.muere) return 0;
    const ahora = Date.now();
    // Caparazon (jefes de mazmorra): casi no recibe daño mientras dura.
    const cap = this.auraMon(o, 'caparazon');
    if (cap) dmg = Math.max(1, Math.round(dmg * (1 - (cap.reduce || 0.9))));
    if (o.agresivo && s) this.alPegar(o, s);
    o.hp -= dmg;
    o.golpeHasta = ahora + 280;
    // La oveja se rompe al recibir daño.
    if (o.au.oveja) this.quitarAuraMon(o, 'oveja');
    if (s) {
      o.dano.set(s.id, (o.dano.get(s.id) || 0) + dmg);
      const cl = CLASES[s.c.clase];
      const sp = this.especDe(s);
      o.amen.set(s.id, (o.amen.get(s.id) || 0) + dmg * (cl ? cl.amenaza : 1) * ((sp && sp.amenaza) || 1) * (amen || 1));
      s.combateT = ahora;
      if (!o.jefe && !this.auraMon(o, 'raiz') && !this.auraMon(o, 'aturdido')) o.x = clamp(o.x + (o.x > s.x ? 7 : -7), 20, MAPAS[o.mapa].ancho - 20);
    }
    if (o.hp <= 0) this.matar(o);
    return dmg;
  }

  matar(o) {
    o.muere = true;
    o.hp = 0;
    o.borrarEn = Date.now() + 1600;
    if (MONSTRUOS[o.k].mundial) {
      this.premiosMundial(o);
      this.aClave(o.cl, { t: 'md', id: o.id, pr: [] });
      return;
    }
    const base = statsMonstruo(o.k, o.nv);
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    // Quien cobra: cada participante y, si esta en un grupo, sus compañeros
    // vivos y cerca (como en WoW, la caza de uno cuenta para todo el grupo).
    // Cada "bando" (un grupo o alguien solo) se lleva su parte del daño; dentro
    // del grupo se reparte a partes iguales con un 10% extra por cada miembro
    // (agruparse siempre compensa). Curar cuenta como participar para la XP y
    // el oro (o.cura), pero NO para el mTON ni la caza del dia.
    const bandos = new Map();
    const peso = new Map(o.dano);
    for (const [sid, c] of (o.cura || [])) peso.set(sid, (peso.get(sid) || 0) + c);
    const totalPeso = [...peso.values()].reduce((a, b) => a + b, 0) || 1;
    for (const [sid, d] of peso) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.k !== o.cl || s.muerto) continue;
      const clave = s.gid ? 'g' + s.gid : 's' + sid;
      let b = bandos.get(clave);
      if (!b) { b = { dano: 0, miembros: new Set(), g: s.gid ? this.grupoDe(s) : null }; bandos.set(clave, b); }
      b.dano += d;
      b.miembros.add(s);
    }
    for (const b of bandos.values()) {
      if (b.g) for (const x of this.sesionesGrupo(b.g)) if (x.k === o.cl && !x.muerto && Math.abs(x.x - o.x) < 1000) b.miembros.add(x);
    }
    const premios = [];
    const cobraron = new Set();
    for (const b of bandos.values()) {
      const parte = b.dano / totalPeso;
      const n = b.miembros.size;
      // En jefes cada bando se lleva al menos un tercio: pelear juntos compensa.
      const k = (o.jefe ? Math.max(parte, 1 / 3) : parte) * (1 + 0.1 * (n - 1)) / n;
      for (const s of b.miembros) {
        const mult = ((SKINS[s.c.skin].buffs || {}).oroMult) || 1;
        const xp = Math.max(1, Math.round(base.xp * k));
        const oro = Math.max(1, Math.round(base.oro * k * rnd(0.8, 1.2) * mult));
        premios.push([s.id, xp, oro]);
        cobraron.add(s.id);
        // Solo quien peleo de verdad (pego o curo) avanza la caza del dia:
        // un compañero quieto en el grupo no la cumple sin jugar.
        this.dar(s, xp, oro, o, n, o.dano.has(s.id) || !!(o.cura && o.cura.has(s.id)));
        // mTON: como siempre, por la parte PROPIA de daño de cada uno.
        if (o.jefe && !o.mazmorra && (o.dano.get(s.id) || 0) / total >= 0.1) this.darMton(s, 20 * Math.max(0.3, MONSTRUOS[o.k].nivel / 30), 'jefe');
      }
    }
    // Caza cooperativa: quien este cerca y vivo se lleva el 25% de la
    // experiencia aunque no le haya pegado (cazar juntos siempre compensa).
    for (const s of this.sesiones.values()) {
      if (!s.c || s.k !== o.cl || s.muerto || cobraron.has(s.id) || Math.abs(s.x - o.x) > 500) continue;
      const xp = Math.max(1, Math.round(base.xp * 0.25));
      this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro: 0, drops: [], x: Math.round(o.x), y: Math.round(o.y - o.h), coop: true });
      this.actualizarYo(s);
    }
    if (o.jefe && o.mazmorra) this.alMorirJefeMaz(o);
    this.aClave(o.cl, { t: 'md', id: o.id, pr: premios });
    if (o.jefe && !o.mazmorra) {
      this.mundoK(o.cl).jefeEn = Date.now() + JEFE_REAPARECE_MS;
      const quien = premios.map(p => this.sesiones.get(p[0])?.c?.nombre).filter(Boolean).slice(0, 4).join(', ');
      this.aTodos({ t: 'aviso', m: `⚔️ ${MONSTRUOS[o.k].nombre} fue derrotado${quien ? ' por ' + quien : ''}` });
    }
  }

  // Suma experiencia y sube de nivel si toca. Devuelve si subio.
  sumarXp(s, xp) {
    const c = s.c;
    if (c.nivel >= NIVEL_MAX) return false;
    let subio = false;
    c.xp += xp;
    while (c.nivel < NIVEL_MAX && c.xp >= xpParaSubir(c.nivel)) {
      c.xp -= xpParaSubir(c.nivel);
      c.nivel++;
      subio = true;
    }
    if (c.nivel >= NIVEL_MAX) c.xp = 0;
    if (subio) {
      s.st = this.stats(c);
      s.hp = s.st.maxHp;
      const nueva = HABS.find(h => h.clase === c.clase && h.nv === c.nivel);
      if (nueva) this.enviar(s, { t: 'toast', m: `✨ ¡Nueva habilidad: ${nueva.nombre}! Ya está en tu barra de acción.`, ok: true, hab: nueva.id });
      this.revisarLogros(s);
      this.hermSubioNivel(s);
      this.aClave(s.k, { t: 'lv', p: s.id, lv: c.nivel, mx: s.st.maxHp, rmx: s.st.recMax });
      this.actualizarRanking(s);
      this.guardar(s);
    }
    return subio;
  }

  // n = miembros del grupo que cobran esta presa (reparte el botin).
  dar(s, xp, oro, o, n, participo) {
    const c = s.c;
    c.oro += oro;
    c.kills++;
    if (o && o.jefe) c.jefes++;
    // El descanso duplica la experiencia de cada caza hasta gastarse.
    const extra = Math.min(c.descanso || 0, xp);
    if (extra > 0) { c.descanso -= extra; xp += extra; }
    this.sumarXp(s, xp);
    // Drops: pociones y, en jefes, poderes raros.
    const drops = [];
    if (Math.random() < 0.05) { c.pw.pocion = Math.min(99, c.pw.pocion + 1); drops.push('pocion'); }
    if (o && o.jefe) {
      const r = PODERES[1 + Math.floor(Math.random() * 3)].id;
      c.pw[r] = Math.min(99, c.pw[r] + 1); drops.push(r);
    }
    // Equipo: 6% en monstruos de tu nivel (o hasta 10 por debajo); los jefes
    // siempre sueltan uno raro o mejor, y a veces dos.
    let item = null;
    if (o) {
      const nvM = o.nv || MONSTRUOS[o.k].nivel;
      if (o.jefe) {
        item = this.darItem(s, generarItem(nvM, o.final ? 2 : 1));
        if ((n || 1) === 1 && Math.random() < 0.3) this.darItem(s, generarItem(nvM, 0));
      } else if (nvM >= c.nivel - 10 && Math.random() < 0.06 * ((n || 1) > 1 ? 1.2 / n : 1)) {
        item = this.darItem(s, generarItem(nvM, 0));
      }
    }
    // Diaria: monstruos de su nivel o hasta 5 por debajo.
    const d = this.diariaDe(c);
    if (o && participo !== false && !d.ok && d.p < DIARIA.n && (o.nv || MONSTRUOS[o.k].nivel) >= c.nivel - 5) {
      d.p++;
      if (d.p === DIARIA.n) this.enviar(s, { t: 'toast', m: `📅 ¡"${DIARIA.nombre}" cumplida! Cóbrala con el Guardia Tito.`, ok: true });
    }
    // Mision en curso: cuenta si el monstruo es el que pide.
    const q = MISIONES[c.mis.i];
    if (o && q && o.k === q.tipo && c.mis.p < q.n) {
      c.mis.p++;
      if (c.mis.p === q.n) this.enviar(s, { t: 'toast', m: `📜 ¡"${q.nombre}" cumplida! Vuelve con el Guardia Tito del pueblo.`, ok: true });
    }
    s.sucio = true;
    this.enviar(s, { t: 'gana', xp, oro, drops, item, x: Math.round(o ? o.x : s.x), y: Math.round(o ? o.y - o.h : s.y - 60) });
    this.revisarLogros(s);
    this.actualizarYo(s);
  }

  // Entregar la mision (o la diaria) al Guardia Tito.
  mision(s, m) {
    const c = s.c;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'guia');
    if (s.k !== 'pueblo' || !npc || Math.abs(s.x - npc.x) > 200) return this.enviar(s, { t: 'toast', m: 'Habla con el Guardia Tito en el pueblo.' });
    if (m && m.diaria) {
      const d = this.diariaDe(c);
      if (d.ok) return this.enviar(s, { t: 'toast', m: 'Ya cobraste la de hoy. ¡Vuelve mañana!' });
      if (d.p < DIARIA.n) return this.enviar(s, { t: 'toast', m: `Te faltan ${DIARIA.n - d.p} monstruos para la caza del día.` });
      const pr = premioDiaria(c.nivel);
      d.ok = true;
      c.oro += pr.oro;
      c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pr.pocion);
      this.sumarXp(s, pr.xp);
      this.enviar(s, { t: 'toast', m: `✅ Caza del día: +${pr.xp} XP · +${pr.oro} oro · +${pr.pocion} pociones`, ok: true });
      this.darMton(s, 25, 'diaria');
      this.enviar(s, { t: 'gana', xp: pr.xp, oro: pr.oro, drops: [], x: Math.round(s.x), y: Math.round(s.y - 80) });
      this.actualizarYo(s);
      this.guardar(s);
      return;
    }
    const q = MISIONES[c.mis.i];
    if (!q) return this.enviar(s, { t: 'toast', m: 'Ya completaste todas las misiones. ¡Eres una leyenda del Pueblo Duende!' });
    if (c.mis.p < q.n) return this.enviar(s, { t: 'toast', m: `Todavía te faltan ${q.n - c.mis.p} para "${q.nombre}".` });
    c.oro += q.oro;
    for (const k in (q.pw || {})) c.pw[k] = Math.min(99, (c.pw[k] || 0) + q.pw[k]);
    c.mis = { i: c.mis.i + 1, p: 0 };
    this.sumarXp(s, q.xp);
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', m: `✅ Recompensa: +${q.xp} XP · +${q.oro} oro`, ok: true });
    this.enviar(s, { t: 'gana', xp: q.xp, oro: q.oro, drops: Object.keys(q.pw || {}), x: Math.round(s.x), y: Math.round(s.y - 80) });
    this.actualizarYo(s);
    this.guardar(s);
  }

  herir(s, dmg, fuente) {
    if (s.muerto) return;
    const ahora = Date.now();
    const pct = fuente && fuente.pct;
    if ((ahora < s.inv && !pct) || ahora < s.escudo || this.aura(s, 'bloque')) return;
    // Evasion del picaro: esquiva golpes cuerpo a cuerpo (las bolas y las
    // zonas no).
    if (!(fuente && (fuente.bala || fuente.zona)) && this.aura(s, 'evasion') && Math.random() < EVASION) {
      s.inv = ahora + 400;
      this.aClave(s.k, { t: 'ph', p: s.id, d: 0, esq: 1, from: fuente ? fuente.id : 0 });
      return;
    }
    const bruto = dmg * rnd(0.9, 1.1);
    // La defensa resta, pero el golpe nunca baja del 25%: con las clases un
    // guerrero bien equipado llegaba a no recibir daño de nada.
    let real = Math.max(1, Math.round(Math.max(bruto * 0.25, bruto - s.st.def * 0.6)));
    // Jefe mundial: un % de la vida de cada uno, asi todos los niveles
    // pueden pelear juntos (y ninguno muere de un toque).
    if (fuente && fuente.mundial) real = Math.round(s.st.maxHp * (fuente.embiste ? 0.15 : fuente.bala ? 0.06 : 0.04) * rnd(0.9, 1.1));
    // Mecanicas de jefes de mazmorra: un % de TU vida (justo para todos los
    // niveles y clases); se evitan saliendo de la zona o interrumpiendo.
    if (pct) real = Math.round(s.st.maxHp * pct * rnd(0.95, 1.05));
    // Un monstruo comun nunca quita mas de un 30% de la vida de un golpe: en
    // una zona algo alta se sufre, pero ya no se muere en tres toques. Los
    // jefes quedan fuera (su embestida avisada es el peligro de verdad).
    if (!(fuente && fuente.jefe)) real = Math.min(real, Math.ceil(s.st.maxHp * 0.3));
    if (this.aura(s, 'muro')) real = Math.round(real * (1 - REDUCE_MURO));
    if (this.aura(s, 'supresion')) real = Math.round(real * (1 - REDUCE_SUPRESION));
    // El escudo del sacerdote absorbe antes que la vida.
    let abs = 0;
    const esc = this.aura(s, 'escudoPoder');
    if (esc) {
      abs = Math.min(esc.abs, real);
      esc.abs -= abs; real -= abs;
      const de = this.sesiones.get(esc.de);
      if (abs > 0 && de && de.c) this.amenazaCura(de, s, abs);
      if (esc.abs <= 0) this.quitarAura(s, 'escudoPoder');
    }
    s.hp -= real;
    if (!pct) s.inv = ahora + INVULNERABLE_GOLPE_MS;
    s.golpeT = ahora;
    s.combateT = ahora;
    // El guerrero se enfurece al recibir golpes.
    if (CLASES[s.c.clase] && CLASES[s.c.clase].recurso === 'ira' && real > 0) s.rec = Math.min(100, s.rec + 1 + real / s.st.maxHp * 150);
    if (this.aura(s, 'sigilo')) this.quitarAura(s, 'sigilo');
    if (s.montado) this.desmontar(s);
    if (s.cast && (s.cast.h === 'hogar' || s.cast.h === 'montar')) this.cancelarCast(s, 'Te golpearon: se canceló.');
    this.aClave(s.k, { t: 'ph', p: s.id, d: real, ab: abs || undefined, from: fuente ? fuente.id : 0 });
    if (s.hp <= 0) this.morir(s);
    this.actualizarYo(s);
  }

  morir(s) {
    s.hp = 0;
    s.muerto = true;
    s.montado = null;
    s.combo = 0;
    this.cancelarCast(s);
    this.limpiarAuras(s);
    this.olvidar(s);
    this.aClave(s.k, { t: 'pm', p: s.id });
    this.guardar(s);
  }

  revivir(s) {
    if (!s.muerto) return;
    const c = s.c;
    // Castigo suave: se pierde el 5% de la experiencia del nivel actual.
    c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
    s.muerto = false;
    s.hp = s.st.maxHp;
    this.recursoInicial(s);
    s.inv = Date.now() + 2000;
    if (!this.revivirEnInstancia(s)) this.entrarMapa(s, 'pueblo', MAPAS.pueblo.spawn);
    this.actualizarYo(s);
    this.guardar(s);
  }

  // ── PODERES (consumibles) ──
  poder(s, m) {
    if (s.muerto || this.aura(s, 'bloque') || this.aura(s, 'aturdido')) return;
    const def = PODERES[m.i | 0];
    if (!def) return;
    const ahora = Date.now();
    if ((s.c.pw[def.id] || 0) <= 0) return this.enviar(s, { t: 'toast', m: `No te quedan ${def.nombre}s. Cómpralos al Mercader del pueblo.` });
    if (ahora < (s.cdPw[def.id] || 0)) return;
    s.c.pw[def.id]--;
    s.cdPw[def.id] = ahora + def.cd;
    if (def.id === 'rayo' || def.id === 'fuego') this.desmontar(s);
    if (def.id === 'pocion') {
      s.hp = Math.min(s.st.maxHp, s.hp + s.st.maxHp * 0.5);
      if (CLASES[s.c.clase] && CLASES[s.c.clase].recurso === 'mana') s.rec = Math.min(s.st.recMax, s.rec + s.st.recMax * 0.3);
    }
    if (def.id === 'escudo') s.escudo = ahora + ESCUDO_MS;
    if (def.id === 'fuego') s.fuego = ahora + FUEGO_MS;
    if (def.id === 'rayo') {
      const golpes = [];
      for (const o of this.mundoDe(s).mons.values()) {
        if (o.muere || Math.abs(o.x - s.x) > 450) continue;
        const dmg = Math.round(s.st.atk * (o.jefe ? 2 : 4));
        golpes.push([o.id, dmg, 2]);
        this.danar(o, dmg, s);
      }
      this.aClave(s.k, { t: 'at', p: s.id, s: -1, f: s.f, h: golpes });
    }
    s.sucio = true;
    this.aClave(s.k, { t: 'pw', p: s.id, i: m.i | 0 });
    this.enviar(s, { t: 'cd', id: def.id, hasta: def.cd });
    this.actualizarYo(s);
  }

  // ── TIENDA ──
  cercaDelMercader(s) {
    if (s.k !== 'pueblo') return false;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'tienda');
    return npc && Math.abs(s.x - npc.x) < 200;
  }

  comprar(s, m) {
    const c = s.c;
    if (!this.cercaDelMercader(s)) return this.enviar(s, { t: 'toast', m: 'Tienes que estar junto al Mercader del pueblo.' });
    if (m.k === 'pw') {
      const def = PODERES.find(p => p.id === m.id);
      const n = clamp(m.n | 0, 1, 10);
      if (!def) return;
      const costo = def.precio * n;
      if (c.oro < costo) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      if ((c.pw[def.id] || 0) + n > 99) return this.enviar(s, { t: 'toast', m: 'Máximo 99 por poder.' });
      c.oro -= costo; c.pw[def.id] = (c.pw[def.id] || 0) + n;
    } else if (m.k === 'forja') {
      if (typeof m.id !== 'string' || !Object.hasOwn(ARMAS, m.id) || !c.armas.includes(m.id)) return;
      const nv = c.forja[m.id] || 0;
      if (nv >= FORJA_MAX) return this.enviar(s, { t: 'toast', m: 'Esa arma ya está al máximo (+' + FORJA_MAX + ').' });
      const costo = costoForja(nv);
      if (c.oro < costo) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= costo;
      c.forja[m.id] = nv + 1;
    } else if (m.k === 'montura') {
      if (typeof m.id !== 'string' || !Object.hasOwn(MONTURAS, m.id)) return;
      const mo = MONTURAS[m.id];
      c.monturas = c.monturas || [];
      if (c.monturas.includes(m.id)) { c.montura = m.id; this.actualizarYo(s); return this.enviar(s, { t: 'toast', m: `🐎 Ahora usas: ${mo.nombre}.`, ok: true }); }
      if (c.nivel < mo.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${mo.nv} para esa montura.` });
      if (c.oro < mo.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= mo.precio;
      c.monturas.push(m.id);
      c.montura = m.id;
    } else if (m.k === 'arma' || m.k === 'skin') {
      const tabla = m.k === 'arma' ? ARMAS : SKINS;
      const lista = m.k === 'arma' ? c.armas : c.skins;
      // hasOwn y no tabla[id]: '__proto__' o 'constructor' existen en cualquier
      // objeto y dejaban el oro en NaN al "comprarlos".
      if (typeof m.id !== 'string' || !Object.hasOwn(tabla, m.id)) return;
      const def = tabla[m.id];
      if (lista.includes(m.id)) return this.enviar(s, { t: 'toast', m: 'Ya lo tienes.' });
      if (c.oro < def.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= def.precio;
      lista.push(m.id);
      this.equipar(s, { k: m.k, id: m.id });
    } else return;
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', m: m.k === 'forja' ? `⚒️ ¡${ARMAS[m.id].nombre} +${c.forja[m.id]}!` : m.k === 'montura' ? `🐎 ¡${MONTURAS[m.id].nombre} es tuya! Móntala con la tecla Y o el botón 🐎.` : '✅ Compra realizada', ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  }

  equipar(s, m) {
    const c = s.c;
    if (typeof m.id !== 'string') return;
    if (m.k === 'arma' && c.armas.includes(m.id) && Object.hasOwn(ARMAS, m.id)) c.arma = m.id;
    else if (m.k === 'skin' && c.skins.includes(m.id) && Object.hasOwn(SKINS, m.id)) {
      c.skin = m.id;
      const pct = s.hp / s.st.maxHp;
      s.st = this.stats(c);
      s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    } else return;
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.actualizarYo(s);
  }

  // ── RANKING ──
  async actualizarRanking(s) {
    if (UIDS_PRUEBA.has(s.c.uid)) return;
    const r = (await this.state.storage.get('ranking')) || [];
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, lv: s.c.nivel, xp: s.c.xp, k: s.c.kills };
    if (i >= 0) r[i] = fila; else r.push(fila);
    r.sort((a, b) => b.lv - a.lv || b.xp - a.xp);
    await this.state.storage.put('ranking', r.slice(0, 50));
  }

  async enviarRanking(s) {
    const r = ((await this.state.storage.get('ranking')) || []).filter(x => !UIDS_PRUEBA.has(x.uid));
    this.enviar(s, { t: 'ranking', r: r.slice(0, 20).map(x => ({ n: x.n, lv: x.lv, k: x.k, yo: x.uid === s.c.uid })) });
  }

  // ── GUARDADO ──
  async guardar(s) {
    if (!s.c) return;
    s.c.x = Math.round(s.x || s.c.x || 0);
    if (typeof s.hp === 'number') s.c.hp = Math.ceil(s.hp);
    s.c.muerto = !!s.muerto;
    s.c.salida = Date.now();
    s.guardadoT = Date.now();
    s.sucio = false;
    try { await this.state.storage.put('c:' + s.c.uid, s.c); } catch (e) { console.error('[MMO guardar]', e); }
  }

  // ── SIMULACION ──
  tick() {
    const ahora = Date.now();
    if (ahora - (this.onT || 0) > 10000) {
      this.onT = ahora;
      // Una pestaña abierta sin jugar mantiene vivo el objeto (y cobra tiempo
      // de CPU del cupo diario) todo el dia: fuera tras 10 min sin actividad.
      for (const s of [...this.sesiones.values()]) {
        if (s.c && ahora - (s.actT || 0) > INACTIVO_MS) {
          this.enviar(s, { t: 'err', m: 'Te desconectamos por inactividad. Pulsa RECONECTAR para volver.', fatal: true });
          try { s.ws.close(4001, 'inactivo'); } catch (e) {}
          this.cerrar(s);
        }
      }
      this.aTodos({ t: 'on', n: this.contarOnline() });
    }
    this.revisarMundial(ahora);
    this.tickGrupos(ahora);
    const porClave = {};
    for (const s of this.sesiones.values()) {
      if (!s.c) continue;
      (porClave[s.k] = porClave[s.k] || []).push(s);
      if (s.sucio && ahora - s.guardadoT > GUARDAR_CADA_MS) this.guardar(s);
    }
    for (const k in porClave) this.simularMapa(k, porClave[k], ahora);
    // Instancias vacias (todos salieron): se cierran solas.
    if (this.limpiarInstancias) this.limpiarInstancias(porClave, ahora);
  }

  simularMapa(clave, jugadores, ahora) {
    const w = this.mundoK(clave);
    const mapa = MAPAS[w.mapa];
    const dt = TICK_MS / 1000;

    if (w.inst) { if (this.tickMazmorra) this.tickMazmorra(w, jugadores, ahora); }
    else if (mapa.zona && mapa.monstruos.length) {
      // Reponer monstruos poco a poco (no todos de golpe).
      // Mas jugadores en la zona, mas monstruos (hasta el doble), para que no
      // se queden esperando reapariciones peleandose por los mismos.
      const max = Math.min(mapa.max * 2, mapa.max + 4 * (jugadores.length - 1));
      const vivos = [...w.mons.values()].filter(m => !m.jefe).length;
      if (vivos < max && ahora >= w.spawnEn) {
        this.crearMonstruo(clave, mapa.monstruos[Math.floor(Math.random() * mapa.monstruos.length)]);
        w.spawnEn = ahora + (vivos < max / 2 ? 700 : 2500);
      }
      if (mapa.jefe && w.jefeEn && ahora >= w.jefeEn && ![...w.mons.values()].some(m => m.jefe)) {
        w.jefeEn = 0;
        const j = this.crearMonstruo(clave, mapa.jefe, mapa.ancho * 0.62);
        this.aTodos({ t: 'aviso', m: `👑 ¡${MONSTRUOS[j.k].nombre} apareció en ${mapa.nombre}!` });
      }
    }

    // Recursos, lanzamientos, curas en el tiempo; y la vida: rapida en zona
    // segura y en las zonas solo tras 4 s sin recibir golpes (descansar
    // entre peleas en vez de volver al pueblo).
    for (const s of jugadores) {
      this.tickJugador(s, ahora, dt, !mapa.zona);
      if (s.muerto || s.hp >= s.st.maxHp) continue;
      const k = !mapa.zona ? 0.12 : (ahora - (s.golpeT || 0) > 4000 ? 0.04 : 0);
      if (k) s.hp = Math.min(s.st.maxHp, s.hp + s.st.maxHp * k * dt);
    }
    // La Piedra de Hogar pudo sacar a alguien de aqui en este mismo tick.
    jugadores = jugadores.filter(s => s.k === clave && !s.cerrado);

    // Aura de la skin legendaria: quema lo que esta pegado al jugador.
    for (const s of jugadores) {
      if (s.muerto || !(SKINS[s.c.skin].buffs || {}).aura || ahora < s.auraT) continue;
      s.auraT = ahora + 1000;
      const golpes = [];
      for (const o of w.mons.values()) {
        if (o.muere || Math.abs(o.x - s.x) > 75 || Math.abs((o.y - o.h / 2) - (s.y - 30)) > 80) continue;
        const dmg = Math.max(1, Math.round(s.st.atk * 0.3));
        golpes.push([o.id, dmg, 3]);
        this.danar(o, dmg, s);
      }
      if (golpes.length) this.aClave(clave, { t: 'at', p: s.id, s: -2, f: s.f, h: golpes });
    }

    for (const o of [...w.mons.values()]) {
      if (o.muere) { if (ahora >= o.borrarEn) w.mons.delete(o.id); continue; }
      this.tickMonstruo(o, ahora);
      if (!o.muere) this.pensar(o, jugadores, ahora, dt, mapa);
    }

    // Proyectiles: vuelan en linea recta y se esquivan saltando o alejandose.
    w.balas = w.balas.filter(b => {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (ahora > b.hasta || b.x < 0 || b.x > mapa.ancho || b.y > SUELO + 10 || b.y < -50) return false;
      for (const s of jugadores) {
        if (s.muerto) continue;
        if (Math.abs(b.x - s.x) < FIS.jugW / 2 + 6 && b.y > s.y - FIS.jugH && b.y < s.y + 4) {
          this.herir(s, b.dmg, { id: b.dueno, jefe: b.jefe, mundial: b.mundial, bala: true });
          return false;
        }
      }
      return true;
    });

    const snap = {
      t: 's',
      p: jugadores.map(s => [s.id, Math.round(s.x), Math.round(s.y), s.f, s.a, Math.ceil(s.hp), s.st.maxHp, this.banderasJugador(s, ahora), Math.round(s.rec || 0), s.st.recMax, s.combo || 0]),
      m: [...w.mons.values()].map(o => [o.id, Math.round(o.x), Math.round(o.y), o.f, this.codigoEstado(o), Math.max(0, Math.ceil(o.hp)), this.banderasMonstruo(o, ahora)]),
      b: w.balas.map(b => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.jefe ? 1 : 0]),
    };
    // Zonas de peligro en el suelo (jefes de mazmorra): [id, x0, x1, activa, color].
    if (w.zonas && w.zonas.length) snap.z = w.zonas.map(z => [z.id, Math.round(z.x0), Math.round(z.x1), z.act <= ahora ? 1 : 0, z.color || '']);
    const txt = JSON.stringify(snap);
    for (const s of jugadores) this.enviar(s, txt);
  }

  // op (mazmorras): { nv, hpX, atkX, agresivo, mazmorra, ... } se copian al monstruo.
  crearMonstruo(clave, k, xFija, op) {
    const w = this.mundoK(clave);
    const mapa = MAPAS[w.mapa];
    const st = statsMonstruo(k, op && op.nv);
    const def = MONSTRUOS[k];
    // Cada zona va de menos a mas: la lista de monstruos esta ordenada por
    // nivel y cada uno aparece en su tramo del mapa, asi el mas facil queda
    // junto a la entrada y el mas duro al fondo.
    const i = Math.max(0, (mapa.monstruos || []).indexOf(k));
    const n = (mapa.monstruos || [k]).length;
    const tramo = (mapa.ancho - 500) / n;
    const x = xFija || (250 + tramo * i + rnd(0, tramo));
    const alturaVuelo = def.vuela ? rnd(90, 170) : 0;
    const hp = Math.round(st.hp * ((op && op.hpX) || 1));
    const o = {
      id: this.sigMon++, k, mapa: w.mapa, cl: clave, jefe: !!def.jefe, vuela: !!def.vuela,
      x, casaX: x, y: SUELO - alturaVuelo, baseY: SUELO - alturaVuelo, f: Math.random() < 0.5 ? 1 : -1,
      hp, max: hp, atk: Math.round(st.atk * ((op && op.atkX) || 1)), vel: st.vel, w: st.w, h: st.h,
      dano: new Map(), amen: new Map(), au: {}, cast: null, obj: 0, golpeHasta: 0, ataqueEn: 0, pasoEn: 0, dir: 0,
      aviso: false, embiste: false, faseEn: Date.now() + 4000, fase: 0,
    };
    if (op) for (const kk of ['nv', 'agresivo', 'mazmorra', 'radioAgro', 'grupo', 'guion', 'xpX', 'sinEmbestida', 'jefeMaz']) if (op[kk] !== undefined) o[kk] = op[kk];
    w.mons.set(o.id, o);
    this.aClave(clave, { t: 'ms', m: this.infoMonstruo(o) });
    return o;
  }

  pensar(o, jugadores, ahora, dt, mapa) {
    const def = MONSTRUOS[o.k];
    const aturdido = this.auraMon(o, 'aturdido');
    const oveja = this.auraMon(o, 'oveja');
    const raiz = this.auraMon(o, 'raiz');
    // Objetivo: quien le genero mas AMENAZA (el tanque, si hace bien su
    // trabajo; curar y pegar fuerte tambien enoja). Provocar obliga a
    // atacar al guerrero unos segundos.
    // Los normales del mundo abierto son pasivos (como en MapleStory): solo
    // persiguen a quien les pega. Los jefes de zona tienen territorio y los
    // de mazmorra son agresivos: atacan a quien se acerque (salvo sigilo).
    let obj = null;
    const prov = o.au.provoca;
    if (prov && prov.hasta > ahora) {
      const s = this.sesiones.get(prov.sid);
      if (s && s.c && s.k === o.cl && !s.muerto) obj = s;
    }
    if (!obj && o.amen.size) {
      let mejor = 0;
      for (const s of jugadores) {
        if (s.muerto) continue;
        const a = o.amen.get(s.id) || 0;
        if (a <= 0 || Math.abs(s.x - o.x) > 900) continue;
        if (a > mejor) { mejor = a; obj = s; }
      }
      if (!obj) o.amen.clear();
    }
    if (!obj && (o.jefe || o.agresivo) && !oveja && !aturdido) {
      const territorio = o.jefe && !o.mazmorra;
      let md = territorio ? 520 : (o.radioAgro || 230);
      for (const s of jugadores) {
        if (s.muerto || this.aura(s, 'sigilo') || Math.abs(s.y - o.y) > 220) continue;
        const d = Math.abs(s.x - (territorio ? o.casaX : o.x));
        if (d < md) { md = d; obj = s; }
      }
      if (obj) {
        o.amen.set(obj.id, 1);
        if (this.alAgro) this.alAgro(o, obj, ahora);
      }
    }
    o.obj = obj ? obj.id : 0;

    const golpeado = ahora < o.golpeHasta;
    let vx = 0;
    if (aturdido) { o.aviso = false; o.embiste = false; }
    else if (oveja) {
      // Oveja: pasea despacito, sin atacar a nadie.
      if (ahora >= o.pasoEn) { o.dir = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1); o.pasoEn = ahora + rnd(800, 2000); }
      if (o.dir) { o.f = o.dir; vx = o.dir * 0.5 * 60 * dt; }
    } else if (o.cast) {
      // Lanzando un hechizo (jefes de mazmorra): quieto mirando al objetivo.
      if (obj) o.f = obj.x > o.x ? 1 : -1;
    } else if (o.jefe && !obj && Math.abs(o.x - o.casaX) > 20 && !o.embiste) {
      // Sin nadie en su territorio vuelve a la guarida.
      o.aviso = false;
      o.f = o.casaX > o.x ? 1 : -1; vx = o.f * o.vel * 60 * dt;
    } else if (o.jefe && obj) {
      // Jefe: persigue, y cada pocos segundos avisa y embiste.
      if (o.aviso) {
        if (ahora >= o.faseEn) { o.aviso = false; o.embiste = true; o.faseEn = ahora + 750; o.f = obj.x > o.x ? 1 : -1; }
      } else if (o.embiste) {
        vx = o.f * 9 * 60 * dt;
        if (ahora >= o.faseEn) { o.embiste = false; o.faseEn = ahora + rnd(3500, 5500); }
      } else {
        if (ahora >= o.faseEn && !o.sinEmbestida) { o.aviso = true; o.faseEn = ahora + 900; }
        else if (Math.abs(obj.x - o.x) > 30) { o.f = obj.x > o.x ? 1 : -1; vx = o.f * o.vel * 60 * dt; }
      }
    } else if (obj && !golpeado) {
      // Los que disparan guardan la distancia en vez de pegarse.
      const lejos = def.dispara ? 170 : 20;
      o.f = obj.x > o.x ? 1 : -1;
      if (Math.abs(obj.x - o.x) > lejos) vx = o.f * o.vel * 1.35 * 60 * dt;
    } else if (!golpeado && !obj) {
      // Pasear: tramos cortos a un lado y pausas.
      if (ahora >= o.pasoEn) { o.dir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); o.pasoEn = ahora + rnd(1200, 3200); }
      if (o.dir) { o.f = o.dir; vx = o.dir * o.vel * 0.6 * 60 * dt; }
    }
    if (raiz && !o.embiste) vx = 0;
    o.x = clamp(o.x + vx, 30, mapa.ancho - 30);
    if (o.jefe) o.x = clamp(o.x, o.casaX - (o.mazmorra ? 450 : 600), o.casaX + (o.mazmorra ? 450 : 600));   // no se le puede arrastrar a la entrada
    if (o.x <= 30 || o.x >= mapa.ancho - 30) o.dir = -o.dir;
    if (o.vuela) {
      const objetivoY = obj ? clamp(obj.y - 30, SUELO - 200, SUELO - 20) : o.baseY;
      o.y += (objetivoY + Math.sin(ahora / 400 + o.id) * 14 - o.y) * 0.08;
    }
    if (aturdido || oveja || o.cast) return;

    // Disparo: bola de fuego hacia el objetivo (los jefes, tres en abanico).
    if (def.dispara && obj && !o.aviso && !o.embiste && ahora >= (o.disparoEn || 0) && Math.abs(obj.x - o.x) < 430 && !this.auraMon(o, 'silencio')) {
      o.disparoEn = ahora + (o.jefe ? 3200 : 2600) + rnd(0, 600);
      const oy = o.y - o.h * 0.55;
      const base = Math.atan2((obj.y - 30) - oy, obj.x - o.x);
      const angs = o.jefe ? [base - 0.22, base, base + 0.22] : [o.vuela ? base : (obj.x > o.x ? 0 : Math.PI)];
      for (const a of angs) {
        this.mundoK(o.cl).balas.push({
          id: this.sigBala++, x: o.x + Math.cos(a) * 20, y: oy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
          dmg: o.atk * (o.jefe ? 1 : 0.6), hasta: ahora + 2200, dueno: o.id, jefe: o.jefe, mundial: !!def.mundial,
        });
      }
      o.golpeHasta = Math.max(o.golpeHasta, ahora + 200);  // pose de "lanzar" (frame de golpe)
    }

    // Daño por contacto: solo a su objetivo, como en WoW (el tanque recibe y
    // el resto pega tranquilo). La embestida de un jefe arrolla a todos.
    if (ahora >= o.ataqueEn) {
      const victimas = o.embiste ? jugadores : obj ? [obj] : [];
      for (const s of victimas) {
        if (s.muerto) continue;
        const toca = Math.abs(s.x - o.x) < (o.w / 2 + FIS.jugW / 2 - 4) && s.y > o.y - o.h && s.y - FIS.jugH < o.y;
        if (toca) {
          // Jefes: el roce hace poco y el peligro de verdad es la embestida
          // (avisada con el temblor rojo, se esquiva saltando por encima).
          // Con el roce a atk entero cada 0,7 s ningun jugador podia hacer
          // la mision del jefe en solitario, y hoy casi siempre se juega solo.
          const dmg = o.jefe ? (o.embiste ? o.atk * 2.4 : o.atk * (o.mazmorra ? 1 : 0.7)) : o.atk;
          this.herir(s, dmg, { id: o.id, jefe: o.jefe, mundial: !!def.mundial, embiste: o.embiste });
          o.ataqueEn = ahora + (o.jefe ? 1250 : 1300);
          break;
        }
      }
    }
  }
}

// Combate al estilo WoW (clases, habilidades, amenaza, auras): functions/mmo/combate.js
Object.assign(MmoWorld.prototype, Combate);
// Grupos y chat por canales: functions/mmo/social.js
Object.assign(MmoWorld.prototype, Social);
// Mazmorras instanciadas con jefes de guion: functions/mmo/mazmorras.js
Object.assign(MmoWorld.prototype, Mazmorras);
// Hermandades: functions/mmo/hermandades.js
Object.assign(MmoWorld.prototype, Hermandades);
MmoWorld.prototype.generarItem = generarItem;
