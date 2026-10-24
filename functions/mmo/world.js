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
  RETIRO_MAX_MTON, RETIRO_CADA_MS, TOPE_DIARIO_PCT, FONDO_PCT_INGRESOS, PAQUETES, estrellasDe, PEDIDO_VIGENCIA_MS, DUENDE_MINT, DUENDE_DECIMALES, DUENDE_DESCUENTO,
  temporadaDe, TEMPORADAS, TEMP_PROB, TEMP_JEFE,
  TINTES, MASCOTAS, enOfertaAmbulante, ambulanteActivo, mundialDe,
  CONJUNTOS, CONJUNTO_PROB,
  semanaUTC, horaFelizActiva, HORA_FELIZ, PASE, MAESTRIA_XP, premioMaestria, afijosSemana, DES_SEM_MIN, premioDesSem, BESTIARIO_HITOS, premioBestiario, talento, TALENTOS, TALENTO_MAX, puntosTalento, costoReinicioTalentos, SUELO, TICK_MS, NIVEL_MAX, FIS, limpiarNombre, CLASES, HABS, MONTURAS, velMontura, descansoGanado, DESCANSO_MAX, limpiarLook, ALAS,
} from '../../mmo/js/data.js';
import { getEnv, verifyInitData, verifySupabaseUser, supabaseQuery, tg, getSolPriceUsd, getDuendePriceUsd, SOL_DEV_WALLET } from '../api/lib.js';
import { MMO_URL } from '../api/telegram-bot.js';
import { Cueva3D } from './cueva3d.js';
import { Eventos3D } from './eventos3d.js';
import { rangoDe } from '../../mmo/js/abismo3d.js';
import { Combate } from './combate.js';
import { Social, pub } from './social.js';
import { Mazmorras } from './mazmorras.js';
import { Hermandades } from './hermandades.js';
import { Tareas } from './tareas.js';
import { Profesiones } from './profesiones.js';
import { Amigos } from './amigos.js';
import { Duelos } from './duelos.js';
import { Chicha } from './chicha.js';
import { Retencion } from './retencion.js';
import { Eventos } from './eventos.js';
import { Pase } from './pase.js';
import { Torre } from './torre.js';
import { Expediciones } from './expediciones.js';
import { Dios } from './dios.js';
import { Viajes } from './viajes.js';
import { Mundo3D } from './mundo3d.js';

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

// Clave publica al azar (32 bytes en base58) para la 'reference' de Solana Pay.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function claveAzar() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let n = 0n; for (const x of b) n = n * 256n + BigInt(x);
  let t = ''; while (n > 0n) { t = B58[Number(n % 58n)] + t; n /= 58n; }
  for (const x of b) { if (x) break; t = '1' + t; }
  return t;
}

// Botones del aviso de un pedido pagado al dueño (el bot los atiende).
const botonesPedido = codigo => [[{ text: '✅ Entregar', callback_data: 'mmoent:' + codigo }, { text: '❌ Anular', callback_data: 'mmoanu:' + codigo }]];

// Doble salto: 11,5²/1,2 + 10²/1,2 ≈ 194 px; margen por los fotogramas.
const MAX_SALTO = 215;
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
      this.chichas = (await this.state.storage.get('chichas')) || [];
      this.pedidos = (await this.state.storage.get('pedidos')) || [];
      for (const x of this.pedidos) if (x.estado === 'comprobando') { x.estado = x.antesComp || 'esperando_pago'; x.firma = ''; }
      this.ingresosSol = (await this.state.storage.get('ingresosSol')) || [];
      this.rs = (await this.state.storage.get('rankSem')) || { sem: semanaUTC(), l: {} };
      this.rds = (await this.state.storage.get('rankDesSem')) || { sem: semanaUTC(), l: {} };
      // Primeras victorias del servidor (jefe final de la banda): { idJefe: { t, n } }.
      this.primeros = (await this.state.storage.get('primeros')) || {};
      // Dueño de la Fortaleza del Nucleo (asedio del Abismo, mundo3d.js).
      this.nucleo = (await this.state.storage.get('nucleo')) || { dueno: null, desde: 0 };
      // Avisos de vuelta a la hora habitual de cada uno (retencion.js).
      await this.asegurarAlarma();
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
      // Estado publico para la portada: conectados ahora y jugadores distintos
      // de hoy (este ultimo se recalcula como mucho cada minuto).
      if (!this.hoyCache || Date.now() - this.hoyCache.t > 60000) {
        let h = 0; try { h = await this.contarHoy(); } catch (e) {}
        this.hoyCache = { t: Date.now(), h };
      }
      return new Response(JSON.stringify({ ok: true, online: this.contarOnline(), hoy: this.hoyCache.h }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (this.contarOnline() >= MAX_JUGADORES) return new Response('Servidor lleno', { status: 503 });
    // Sockets que aun no se identifican: tope propio y por IP. Antes 300
    // sockets sin 'hola' llenaban el servidor y dejaban fuera a todos.
    const ip = request.headers.get('CF-Connecting-IP') || '';
    let sinId = 0, deIp = 0;
    for (const x of this.sesiones.values()) { if (!x.c) sinId++; if (ip && x.ip === ip) deIp++; }
    if (sinId >= 40 || (ip && deIp >= 8)) return new Response('Demasiadas conexiones', { status: 429 });
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    this.abrir(servidor, ip);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  contarOnline() { let n = 0; for (const s of this.sesiones.values()) if (s.c) n++; return n; }

  // ── CONEXION ──
  abrir(ws, ip) {
    const s = { id: this.sigSesion++, ws, ip: ip || '', c: null, cuenta: 0, ventana: Date.now(), cerrado: false };
    this.sesiones.set(s.id, s);
    ws.addEventListener('message', ev => {
      this.recibir(s, ev.data).catch(e => { console.error('[MMO]', e); this.enviar(s, { t: 'err', m: 'Error del servidor' }); });
    });
    const cerrar = () => this.cerrar(s);
    ws.addEventListener('close', cerrar);
    ws.addEventListener('error', cerrar);
    setTimeout(() => { if (!s.c && !s.cerrado) this.expulsar(s, 'Sin identificación'); }, 8000);
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
      if (s.m3) this.olvidar3d(s); else this.olvidar(s);
      this.salirDeMundo(s);
      await this.guardar(s);
    }
    if (this.contarOnline() === 0 && this.bucle) { clearInterval(this.bucle); this.bucle = null; this.guardarHermsSucias(Infinity); }
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
    if (s.m3) return this.recibir3d(s, m);
    switch (m.t) {
      case 'mv': return this.mover(s, m);
      case 'atk': return this.atacar(s, m);
      case 'clase': return this.elegirClase(s, m);
      case 'espec': return this.elegirEspec(s, m);
      case 'talento': return this.subirTalento(s, m);
      case 'talentoReset': return this.reiniciarTalentos(s);
      case 'montar': return this.montar(s);
      case 'invitar': return this.invitar(s, m);
      case 'grupoResp': return this.respuestaGrupo(s, m);
      case 'salirGrupo': return this.salirGrupo(s);
      case 'banda': return this.bandaGrupo(s, m);
      case 'runa': return this.grabarRuna(s, m);
      case 'expulsarGrupo': return this.expulsarGrupo(s, m);
      case 'liderGrupo': return this.liderGrupo(s, m);
      case 'lfg': return this.buscarGrupo(s, m);
      case 'contactoAdd': return this.agregarContacto(s, m);
      case 'contactoQuitar': return this.quitarContacto(s, m);
      case 'contactos': return this.enviarContactos(s);
      case 'inspeccionar': return this.inspeccionar(s, m);
      case 'gesto': return this.gesto(s, m);
      case 'pase': return this.cobrarPase(s, m);
      case 'cambiarTarea': return this.cambiarTarea(s, m);
      case 'boveda': return this.elegirBoveda(s, m);
      case 'lfgLista': return this.lfgLista(s);
      case 'lfgQuitar': return this.quitarLfg(s);
      case 'lfgUnir': return this.unirseLfg(s, m);
      case 'quien': return this.quien(s);
      case 'amigos': return this.infoAmigos(s);
      case 'chicha': return this.reclamarChicha(s, m);
      case 'retar': return this.retarDuelo(s, m);
      case 'retoResp': return this.respuestaDuelo(s, m);
      case 'mazmorra': return this.entrarMazmorra(s, m);
      case 'torre': return this.entrarTorre(s, m);
      case 'exped': return this.expedicion(s, m);
      case 'hermCrear': return this.crearHermandad(s, m);
      case 'hermInvitar': return this.invitarHerm(s, m);
      case 'hermResp': return this.respuestaHerm(s, m);
      case 'hermSalir': return this.salirHerm(s);
      case 'hermExpulsar': return this.expulsarHerm(s, m);
      case 'hermRango': return this.rangoHerm(s, m);
      case 'hermMotd': return this.motdHerm(s, m);
      case 'hermColor': return this.colorHerm(s, m);
      case 'herm': return this.verHerm(s);
      case 'cofre': return this.abrirCofre(s, m);
      case 'recolectar': return this.recolectar(s, m);
      case 'pescar': return this.pescar(s);
      case 'tirar': return this.tirar(s);
      case 'fabricar': return this.fabricar(s, m);
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
      case 'pedidoBuscar': return this.pedidoBuscar(s, m);
      case 'ping': return this.enviar(s, { t: 'pong', ts: m.ts });
      case 'dios': return this.dios(s, m);
      case 'viajar': return this.viajar(s, m);
    }
  }

  // ── IDENTIDAD ──
  async hola(s, m) {
    if (s.c || s.autenticando) return;
    s.autenticando = true;
    const env = getEnv({ env: this.env });
    const a = m.auth || {};
    let uid = null, nombre = null, pagadas = null, extra = null;
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
          extra = { email: u.email || '', emailOk: !!u.email_confirmed_at };
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
    const ban = await this.baneado(uid);
    if (ban) { s.autenticando = false; this.expulsar(s, 'Tu cuenta está baneada' + (ban.hasta ? ' hasta el ' + new Date(ban.hasta).toLocaleString('es', { timeZone: 'America/Lima' }) : '') + (ban.motivo ? ': ' + ban.motivo : '.')); return; }
    s.extraAuth = extra;
    // Una cuenta solo puede estar ENTRANDO por una sesion a la vez. Antes, dos
    // pestañas que mandaban el hola juntas pasaban las dos la comprobacion de
    // "misma cuenta abierta" (hay awaits en medio) y quedaban dos copias del
    // personaje: la segunda en guardar pisaba a la primera (se podia retirar
    // mTON y recuperarlo, o contar doble la XP semanal).
    this.entrando = this.entrando || new Map();
    if (this.entrando.has(uid)) { this.expulsar(s, 'Tu cuenta ya está entrando desde otra pestaña. Usa solo una.'); return; }
    this.entrando.set(uid, s);
    try { await this.holaCuenta(s, m, env, uid, nombre, pagadas); }
    finally { if (this.entrando.get(uid) === s) this.entrando.delete(uid); }
  }

  async holaCuenta(s, m, env, uid, nombre, pagadas) {

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
        const antes = previo.nombre;
        c = { ...previo, uid, nombre: await this.nombreLibre(nombre, uid, this.calcularDios({ c: { uid } }, s.extraAuth)) };
        nombre = c.nombre;
        await this.reservarNombre(c, antes);
        await this.state.storage.delete('c:' + uidInv);
        heredado = true;
        this.renombrarContacto(uidInv, uid);
        const r = (await this.state.storage.get('ranking')) || [];
        const fila = r.find(x => x.uid === uidInv);
        if (fila) { fila.uid = uid; fila.n = nombre; await this.state.storage.put('ranking', r); }
      }
    }
    const nuevo = !c;
    if (!c && uid.startsWith('inv:') && s.ip) {
      // Cada invitado nuevo deja un personaje guardado para siempre: como
      // mucho 6 por IP y hora (antes, un bucle llenaba el cupo de escrituras).
      const h = Math.floor(Date.now() / 3600000);
      this.altasIp = this.altasIp && this.altasIp.h === h ? this.altasIp : { h, n: new Map() };
      const n = (this.altasIp.n.get(s.ip) || 0) + 1;
      this.altasIp.n.set(s.ip, n);
      if (n > 6) { this.expulsar(s, 'Demasiados personajes nuevos desde tu conexión. Intenta en una hora o inicia sesión.'); return; }
    }
    if (!c) {
      // Nombre unico y sin imitar al equipo: un invitado ya no puede entrar
      // con el nombre de otro jugador ni como "Admin" o "El Duende".
      const libre = await this.nombreLibre(nombre, uid, this.calcularDios({ c: { uid } }, s.extraAuth));
      c = personajeNuevo(uid, libre);
      await this.anotarInvitacion(c, typeof m.ref === 'string' ? m.ref : '');
    }
    await this.reservarNombre(c);
    c.skins = c.skins || ['comun']; c.armas = c.armas || ['katana']; c.pw = c.pw || {};
    c.mis = c.mis || { i: 0, p: 0 };
    c.forja = c.forja || {};
    c.mton = c.mton || 0; c.mtonTotal = c.mtonTotal || 0; c.wallet = c.wallet || null;
    c.eq = c.eq || {}; c.bolsa = c.bolsa || []; c.logros = c.logros || []; c.titulo = c.titulo || ''; c.mundiales = c.mundiales || 0;
    for (const p of PODERES) if (typeof c.pw[p.id] !== 'number') c.pw[p.id] = 0;
    if (!Object.hasOwn(CLASES, c.clase || '')) c.clase = null;
    // Las mazmorras son instancias que no sobreviven a una desconexion: se
    // vuelve a la puerta (en el pueblo).
    // (Si la instancia sigue abierta se le devuelve a ella mas abajo.)
    const instGuardada = MAPAS[c.mapa] && MAPAS[c.mapa].instancia && !c.muerto ? { mapa: c.mapa, x: c.x || 150 } : null;
    if (!MAPAS[c.mapa] || MAPAS[c.mapa].instancia) { c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn; }

    // Skins pagadas con dinero real en el juego principal: se regalan aqui.
    const extra = pagadas ? await this.skinsPagadas(env, pagadas) : [];
    const regaladas = extra.filter(k => typeof k === 'string' && Object.hasOwn(SKINS, k) && !c.skins.includes(k));
    c.skins.push(...regaladas);

    s.c = c;
    s.dios = this.calcularDios(s, s.extraAuth);
    s.diosModo = {};
    await this.cargarMod();
    s.st = this.stats(c);
    // Se guarda la vida y si estaba muerto: si no, cerrar la pestaña justo
    // antes de morir te devolvia con la vida llena en el mismo sitio.
    if (c.muerto) {
      // Igual que revivir(): hasta Nv 10 sin perder XP y en la entrada de la zona.
      const novato = c.nivel < 10 && MAPAS[c.mapa] && MAPAS[c.mapa].zona && c.mapa !== 'coliseo';
      if (c.nivel >= 10) c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
      c.muerto = false;
      if (novato) c.x = 150; else { c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn; }
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
    if (this.cobrarPasePendiente) this.cobrarPasePendiente(s);
    // XP de descanso por el tiempo fuera (c.salida se pone al guardar).
    const salidaAntes = c.salida || 0;
    let descansado = 0;
    if (c.salida && c.nivel < NIVEL_MAX) {
      const antes = c.descanso || 0;
      c.descanso = Math.min(Math.round(xpParaSubir(c.nivel) * DESCANSO_MAX), antes + descansoGanado(c.nivel, Date.now() - c.salida));
      descansado = c.descanso - antes;
    }
    // Estadisticas de retencion y avisos de vuelta: functions/mmo/retencion.js
    // Sin await: lo que toca al personaje es inmediato y los agregados no
    // deben retrasar la entrada al mundo.
    this.retEntrar(s, nuevo);
    if (nuevo || heredado || login) await this.guardar(s);

    this.enviar(s, { t: 'bienvenido', id: s.id, yo: this.datosPropios(s), nuevo, heredado, regaladas, on: this.contarOnline() });
    if (login) this.enviar(s, { t: 'login', ...login });
    const tp = temporadaDe();
    if (ambulanteActivo() && c.nivel >= 15) this.enviar(s, { t: 'toast', m: 'Mercader ambulante en el pueblo este fin de semana: colores y una mascota exclusivos (pestaña «Ambulante»).', ok: true });
    if (tp) this.enviar(s, { t: 'toast', m: `${tp.nombre}: hasta el ${tp.hasta} los monstruos sueltan ${tp.cosas}; con 50 y 200 hay títulos. Llevas ${c[tp.campo] || 0}.`, ok: true });
    else {
      // Sin evento: si el siguiente empieza en 10 dias o menos, se anuncia
      // (un motivo para volver ese dia).
      const ahora = Date.now();
      const prox = TEMPORADAS.filter(x => x.ini > ahora && x.ini - ahora <= 10 * 86400000).sort((a, b) => a.ini - b.ini)[0];
      if (prox) {
        const dias = Math.ceil((prox.ini - ahora) / 86400000);
        const fecha = new Date(prox.ini).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'America/Lima' }) + ' a las ' + new Date(prox.ini).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }) + ' (hora de Perú)';
        this.enviar(s, { t: 'toast', m: `${prox.emoji} Próximo evento: ${prox.nombre}, desde el ${fecha} (en ${dias} día${dias > 1 ? 's' : ''}). Los monstruos soltarán ${prox.cosas} y habrá dos títulos.` });
      }
    }
    if (descansado > 0) this.enviar(s, { t: 'toast', m: `Descanso: +${c.descanso.toLocaleString('es', { useGrouping: 'always' })} XP extra en tus próximas cazas.`, ok: true });
    this.enviar(s, this.estadoMundial());
    // Duende Quest 3D (/mundo/): el mismo personaje en el mundo abierto.
    if (m.modo === '3d') this.entrar3d(s);
    else this.entrarMapa(s, c.mapa, s.x, true);
    this.reengancharGrupo(s);
    this.avisarContactos(s, salidaAntes);
    if (instGuardada && !s.m3) this.volverAInstancia(s, instGuardada.mapa, instGuardada.x);
    this.reponerElixires(s);
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
      // Cuentas web: ya NO se regalan por profiles.wallet_solana. Ese campo lo
      // escribe el propio usuario sin probar que la wallet es suya, y bastaba
      // con poner la de un comprador (se ve en Solscan) para llevarse sus
      // skins (auditoria del 22-oct). Las ya regaladas siguen en el
      // personaje; las compras web nuevas las entrega el dueño (Modo Dios).
    } catch (e) {}
    return [];
  }

  // ── TALENTOS ──
  subirTalento(s, m) {
    const c = s.c;
    const t = TALENTOS.find(x => x.id === m.id);
    if (!t || s.muerto) return;
    c.tal = c.tal || {};
    const usados = Object.values(c.tal).reduce((a, b) => a + b, 0);
    if (usados >= puntosTalento(c.nivel)) return this.no(s, 'No te quedan puntos de talento: ganas uno por nivel desde el 10.');
    if ((c.tal[t.id] || 0) >= TALENTO_MAX) return this.no(s, 'Ese talento ya está al máximo.');
    c.tal[t.id] = (c.tal[t.id] || 0) + 1;
    this.recalcular(s);
  }
  reiniciarTalentos(s) {
    const c = s.c;
    if (!c.tal || !Object.keys(c.tal).length) return;
    const costo = costoReinicioTalentos(c.nivel);
    if (c.oro < costo) return this.no(s, `Reiniciar los talentos cuesta ${costo.toLocaleString('es', { useGrouping: 'always' })} oro.`);
    c.oro -= costo;
    c.tal = {};
    this.recalcular(s);
    this.enviar(s, { t: 'toast', m: '🌀 Talentos reiniciados: vuelve a repartir tus puntos.', ok: true });
  }
  recalcular(s) {
    const pct = s.hp / s.st.maxHp;
    s.st = this.stats(s.c);
    s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.actualizarYo(s);
  }

  stats(c) { return statsJugador(c.nivel, c.skin, c.eq, c.clase, c.espec, c.tal, c.runas); }
  // Stats sin la skin: en el PvP (duelos y Abismo) las ventajas de combate de
  // las skins no cuentan; ahi todos pelean igual. Se recalcula si cambian.
  statsSinSkin(s) {
    if (s._stBaseDe !== s.st) { s._stBase = statsJugador(s.c.nivel, null, s.c.eq, s.c.clase, s.c.espec, s.c.tal, s.c.runas); s._stBaseDe = s.st; }
    return s._stBase;
  }

  // ── mTON / PLAY TO EARN ──
  // Quien puede ganar: cuenta real (Telegram o web, no invitado), Nv 15+ y
  // personaje con 48 h. Frena granjas de bots con cuentas desechables.
  esPrueba(c) { return UIDS_PRUEBA.has(c.uid); }
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
    if (this.diosActivo(s)) return 0;   // con poderes de dios no se gana mTON
    const el = this.elegibilidad(c);
    const f = this.fondoHoy();
    const total = (f.auto || 0) + (f.extra || 0);
    if (!el.cuenta || !el.nivel || !el.edad) {
      // Una vez por dia se le explica por que no gano mTON.
      if (!f.avisados) f.avisados = {};
      if (el.cuenta && !f.avisados[c.uid]) {
        f.avisados[c.uid] = 1;
        this.enviar(s, { t: 'toast', m: !el.nivel ? `💎 Desde nivel ${MTON_NIVEL_MIN} ganas mTON (TON real) en jefes y misiones, los días que hay fondo (botón mTON).` : '💎 Tu personaje gana mTON a partir de su 2º día de vida.' });
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
    if (c.mton < RETIRO_MIN_MTON) return no(`El retiro mínimo es ${RETIRO_MIN_MTON.toLocaleString('es', { useGrouping: 'always' })} mTON (${RETIRO_MIN_MTON / MTON_POR_TON} TON).`);
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
    // Los que nunca se pagaron caducan. Los pagados o por revisar NUNCA se
    // podan: antes un slice(-300) sobre todos dejaba borrar la compra pagada
    // de otro llenando la lista de pedidos sin pagar (auditoria del 22-oct).
    const ahora = Date.now();
    // Uno que se quedo 'comprobando' (el servidor se reinicio mientras se
    // miraba la cadena) vuelve a esperar el pago.
    for (const x of this.pedidos) if (x.estado === 'comprobando' && ahora - (x.compT || 0) > 120000) { x.estado = x.antesComp || 'esperando_pago'; x.firma = ''; }
    for (const x of this.pedidos) if (x.estado === 'esperando_pago' && ahora - x.creado > PEDIDO_VIGENCIA_MS) x.estado = 'vencido';
    this.pedidos = this.pedidos.filter(x => x.estado !== 'vencido' || ahora - x.creado < 86400000);
    let sobran = this.pedidos.length - 300;
    if (sobran > 0) this.pedidos = this.pedidos.filter(x => !(sobran > 0 && (x.estado === 'entregado' || x.estado === 'anulado' || x.estado === 'vencido') && sobran-- > 0));
    await this.state.storage.put('pedidos', this.pedidos);
  }
  transparencia() {
    const pagados = this.retiros.filter(x => x.estado === 'pagado');
    return { retirosPagados: pagados.length, tonPagados: Math.round(pagados.reduce((a, x) => a + x.ton, 0) * 1000) / 1000, pct: Math.round(FONDO_PCT_INGRESOS * 100) };
  }

  // Un pedido a la vez por sesion: antes, 60 mensajes seguidos pasaban todos
  // el tope de 3 (el push iba tras un await a CoinGecko o a Telegram). El
  // ritmo lo pone el tope de 10 pedidos por hora y cuenta.
  async pedido(s, m) {
    if (s.pidiendo) return this.enviar(s, { t: 'toast', m: 'Espera a que termine tu compra anterior.' });
    s.pidiendo = true;
    try { await this.pedidoUno(s, m); } finally { s.pidiendo = false; }
  }
  async pedidoUno(s, m) {
    const c = s.c;
    const pq = PAQUETES.find(x => x.id === m.id);
    if (!pq) return;
    const metodo = m.metodo === 'sol' || m.metodo === 'duende' ? m.metodo : 'stars';
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (c.uid.startsWith('inv:')) return no('Para comprar entra con tu cuenta de Telegram o inicia sesión en el juego web.');
    if (metodo === 'stars' && !c.uid.startsWith('tg:')) return no('Las Stars solo se pueden usar dentro de Telegram. En la web se paga con SOL o $DUENDE.');
    if (metodo !== 'stars' && c.uid.startsWith('tg:')) return no('Dentro de Telegram se paga con Stars.');
    if (pq.skin && (c.skins || []).includes(pq.skin)) return no('Ya tienes esa skin.');
    if (pq.alas && (c.alas || []).includes(pq.alas)) return no('Ya tienes esas alas.');
    if (pq.skin && this.pedidos.some(x => x.uid === c.uid && x.paquete === pq.id && (x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'comprobando'))) return no('Ya pagaste esa skin: El Duende te la entrega en breve.');
    await this.guardarPedidos();
    if (this.pedidos.filter(x => x.uid === c.uid && (x.estado === 'esperando_pago' || x.estado === 'comprobando' || x.estado === 'por_verificar')).length >= 3) return no('Tienes compras sin pagar: termina o espera 30 minutos.');
    if (this.pedidos.filter(x => x.uid === c.uid && Date.now() - x.creado < 3600000).length >= 10) return no('Has creado muchos pedidos seguidos: espera un rato.');
    if (this.pedidos.filter(x => x.estado === 'esperando_pago').length >= 150) return no('La tienda está muy ocupada: intenta en unos minutos.');
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
          // Las skins se ven en la factura de Telegram.
          ...(pq.img ? { photo_url: new URL('/assets/skins/' + pq.img + '.png', MMO_URL).href, photo_width: 256, photo_height: 256 } : {}),
        });
        link = rsp && rsp.result;
      } catch (e) {}
      if (!link) return no('No se pudo crear el pago con Stars. Intenta de nuevo en un rato.');
      this.pedidos.push(pd);
      await this.guardarPedidos();
      return this.enviar(s, { t: 'factura', codigo: pd.codigo, link });
    }
    if (metodo === 'duende') {
      // Precio real del token (pump.fun / DexScreener); sin precio no se cobra.
      const precioD = await this.precioDuendeSeguro();
      if (!precioD) return no('No se pudo leer el precio de $DUENDE ahora. Intenta en un minuto o paga con SOL.');
      const usd = pq.usd * DUENDE_DESCUENTO;
      // Unidades minimas (6 decimales) con 4 cifras finales propias del pedido.
      const raw = Math.ceil(usd / precioD * 10 ** DUENDE_DECIMALES / 1e4) * 1e4 + 1 + Math.floor(Math.random() * 9998);
      if (!Number.isSafeInteger(raw)) return no('El precio de $DUENDE no permite calcular el monto. Paga con SOL.');
      pd.duendeRaw = raw; pd.precioDuende = precioD;
      this.pedidos.push(pd);
      await this.guardarPedidos();
      return this.enviar(s, { t: 'pedidoSol', metodo: 'duende', codigo: pd.codigo, raw, mint: DUENDE_MINT, dec: DUENDE_DECIMALES, wallet: SOL_DEV_WALLET, usd: Math.round(usd * 100) / 100, nombre: pq.nombre });
    }
    const precio = await getSolPriceUsd();
    if (!precio) return no('No se pudo leer el precio del SOL ahora. Intenta en un minuto.');
    // Monto con 4 cifras finales propias de este pedido: si pagas desde otra
    // wallet, El Duende lo reconoce en Solscan solo por el monto.
    const base = Math.ceil(pq.usd / precio * 1e9 / 1e4) * 1e4;
    const ocupado = l => this.pedidos.some(x => x.metodo === 'sol' && x.lamports === l && x.estado !== 'entregado' && x.estado !== 'anulado');
    for (let i = 0; i < 30; i++) { pd.lamports = base + 1 + Math.floor(Math.random() * 9998); if (!ocupado(pd.lamports)) break; }
    pd.ref = claveAzar();   // 'reference' de Solana Pay: identifica el pago en la cadena
    pd.precioSol = precio;
    this.pedidos.push(pd);
    await this.guardarPedidos();
    this.enviar(s, { t: 'pedidoSol', codigo: pd.codigo, lamports: pd.lamports, wallet: SOL_DEV_WALLET, usd: pq.usd, nombre: pq.nombre, ref: pd.ref });
    this.actualizarYo(s);   // aparece en "Tus compras" para retomar el pago
  }

  // Precio de $DUENDE para cobrar: el MAS BAJO de las ultimas 6 h (una
  // muestra cada 10 min). Con una capitalizacion pequeña alguien podia subir
  // el precio un momento justo antes de pedir y pagar menos tokens.
  async precioDuendeSeguro() {
    const ahora = Date.now();
    const h = (this.preciosD = (this.preciosD || (await this.state.storage.get('preciosD')) || []).filter(x => ahora - x.t < 6 * 3600000));
    const ult = h[h.length - 1];
    if (!ult || ahora - ult.t > 10 * 60000) {
      const p = await getDuendePriceUsd(true);
      if (p) { h.push({ t: ahora, p }); await this.state.storage.put('preciosD', h); }
    }
    return h.length ? Math.min(...h.map(x => x.p)) : null;
  }

  async pedidoFirma(s, m) {
    const c = s.c;
    const pd = this.buscarPedido(m.codigo);
    const firma = String(m.firma || '').trim();
    const no = t => this.enviar(s, { t: 'toast', m: t });
    // 'vencido' tambien: quien paga pasados los 30 min (p. ej. tras abrir el
    // juego dentro de Phantom en el movil) no pierde su pago; la cadena ya
    // rechaza pagos anteriores al pedido.
    if (!pd || pd.uid !== c.uid || (pd.metodo !== 'sol' && pd.metodo !== 'duende') || (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido')) return no('Ese pedido ya no está esperando pago.');
    if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(firma)) return no('Esa firma de transacción no es válida. Cópiala de Phantom o de Solscan.');
    // Una comprobacion cada pocos segundos por cuenta (no por sesion).
    if (!this.ritmoSol(c.uid, 'f', 6000)) return no('Espera unos segundos antes de volver a intentarlo.');
    if (await this.state.storage.get('firma:' + firma)) return no('Esa transacción ya se usó para otro pedido.');
    if (this.verificando && this.verificando.has(firma)) return no('Esa transacción se está comprobando.');
    (this.verificando = this.verificando || new Set()).add(firma);
    const antes = pd.estado;
    let cadena = null;
    try {
      pd.firma = firma; pd.estado = 'comprobando'; pd.compT = Date.now(); pd.antesComp = antes;   // ni /pedidos ni /entregar lo ven hasta confirmar
      // Recien enviada, la transaccion tarda unos segundos en confirmarse.
      for (let i = 0; i < 4; i++) {
        cadena = pd.metodo === 'duende' ? await this.verificarDuende(firma, pd.duendeRaw, pd.creado) : await this.verificarSol(firma, pd.lamports, pd.creado);
        if (!cadena || cadena.ok || !/no existe/.test(cadena.motivo) || i === 3) break;
        await new Promise(r => setTimeout(r, 5000));
      }
      // El dueño pudo entregarlo o anularlo mientras tanto: no se toca.
      if (pd.estado !== 'comprobando' || pd.firma !== firma) return;
      // Solo un pago CONFIRMADO de este pedido gasta la firma y llega al
      // dueño. Si la red falla o aun no se ve, el pedido sigue esperando y
      // la firma queda libre (antes se reservaba: con la red caida, alguien
      // podia atar a su pedido la firma de un pago ajeno visto en Solscan).
      if (!cadena || !cadena.ok || await this.state.storage.get('firma:' + firma)) {
        pd.estado = antes; pd.firma = '';
        this.actualizarYo(s);
        if (!cadena) return no('No pudimos consultar la red de Solana ahora. Vuelve a intentarlo en un minuto: tu pago no se pierde.');
        if (cadena.ok) return no('Esa transacción ya se usó para otro pedido.');
        if (/no existe/.test(cadena.motivo)) return no('Aún no vemos esa transacción confirmada en la red. Espera un minuto y pulsa «Ya pagué» (o vuelve a pegarla).');
        return no('Esa transacción no es el pago de este pedido (' + cadena.motivo + '). Paga el monto exacto que se muestra.');
      }
      await this.state.storage.put('firma:' + firma, pd.codigo);
      pd.estado = 'por_verificar'; pd.cadena = cadena; pd.pagadoEn = Date.now();
      await this.guardarPedidos();
    } finally { this.verificando.delete(firma); }
    no('📨 Recibimos tu pago. El Duende lo revisa y te entrega la compra (te avisamos aquí y por Telegram).');
    this.actualizarYo(s);
    const esD = pd.metodo === 'duende';
    const monto = esD ? (pd.duendeRaw / 10 ** DUENDE_DECIMALES).toLocaleString('es', { maximumFractionDigits: 6 }) + ' $DUENDE' : (pd.lamports / 1e9).toFixed(9) + ' SOL';
    this.avisarAdmin(`${esD ? '🍄' : '◎'} *Pedido #${pd.codigo}* — ${pd.nombre} ($${pd.usd})\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n💰 Debía pagar ${monto} a tu wallet\n✅ En la cadena: llegó exactamente ese monto\n🔗 https://solscan.io/tx/${firma}\n\nSi está bien: /entregar ${pd.codigo} (o desde tu Modo Dios en el juego)\nSi no: /anular ${pd.codigo}`, botonesPedido(pd.codigo));
  }
  // Ritmo de las operaciones con la red de Solana, por cuenta.
  ritmoSol(uid, tipo, ms) {
    this.ritmoSolM = this.ritmoSolM || new Map();
    const k = uid + ':' + tipo, ahora = Date.now();
    if (ahora - (this.ritmoSolM.get(k) || 0) < ms) return false;
    this.ritmoSolM.set(k, ahora);
    if (this.ritmoSolM.size > 5000) for (const [kk, t] of this.ritmoSolM) if (ahora - t > 60000) this.ritmoSolM.delete(kk);
    return true;
  }

  // "Ya pague": busca el pago entre las ultimas transacciones de la wallet
  // (el monto exacto, con su marca de 4 cifras, identifica el pedido) y, si
  // lo encuentra, sigue como si se hubiera pegado su firma. Asi se puede
  // pagar escaneando el QR (Solana Pay) con el movil sin copiar nada.
  async pedidoBuscar(s, m) {
    const c = s.c;
    const pd = this.buscarPedido(m.codigo);
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (!pd || pd.uid !== c.uid || pd.metodo !== 'sol' || (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido')) return no('Ese pedido ya no está esperando pago.');
    if (!this.ritmoSol(c.uid, 'b', 15000)) return no('Espera unos segundos y vuelve a comprobar.');
    // 1) La clave 'reference' de Solana Pay (unica del pedido): la llevan el
    //    QR, el enlace a la wallet y el pago con Phantom.
    // 2) Si no aparece ahi (pago desde otra wallet con el monto exacto, o
    //    alguien lleno de basura la reference): las ultimas de la wallet del
    //    dueño, sin las ya usadas ni las anteriores al pedido.
    const probar = async firmas => {
      const cand = [];
      for (const f of firmas || []) {
        if (!f || f.err || typeof f.signature !== 'string' || (f.blockTime && f.blockTime * 1000 < pd.creado - 30000)) continue;
        if (await this.state.storage.get('firma:' + f.signature)) continue;
        cand.push(f.signature);
        if (cand.length >= 8) break;
      }
      for (const sig of cand) { const v = await this.verificarSol(sig, pd.lamports, pd.creado); if (v && v.ok) return sig; }
      return null;
    };
    const porRef = pd.ref ? await this.firmasRecientesSol(pd.ref, 20) : [];
    let sig = await probar(porRef);
    let porWallet = [];
    if (!sig) { porWallet = await this.firmasRecientesSol(SOL_DEV_WALLET, 50); sig = await probar(porWallet); }
    if (sig) { this.ritmoSolM.delete(c.uid + ':f'); return this.pedidoFirma(s, { codigo: pd.codigo, firma: sig }); }
    if (!porRef && !porWallet) return no('No se pudo consultar la red de Solana ahora. Prueba en un momento (o pega la firma).');
    no('Aún no vemos tu pago en la red. Si acabas de enviarlo, espera unos segundos y vuelve a comprobar.');
  }
  async firmasRecientesSol(direccion, limite) {
    try {
      const key = this.env.HELIUS_API_KEY;
      const url = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [direccion, { limit: limite, commitment: 'confirmed' }] }) });
      if (r.ok === false) return null;
      const d = await r.json();
      return d && !d.error && Array.isArray(d.result) ? d.result : null;
    } catch (e) { return null; }
  }

  // Comprueba en la cadena el pago de un pedido. Es una AYUDA para la
  // revision manual: la decision la toma el dueño (/entregar o Modo Dios).
  async verificarSol(firma, lamports, desde) {
    const tx = await this.leerTx(firma);
    if (tx === null) return null;
    if (!tx.ok) return tx;
    // Una transferencia del System Program a la wallet del dueño por EXACTAMENTE
    // el monto del pedido (con sus 4 cifras propias), hecha despues del pedido.
    const t = tx.instr.find(x => x && x.program === 'system' && x.parsed && x.parsed.type === 'transfer' && x.parsed.info && x.parsed.info.destination === SOL_DEV_WALLET && Number(x.parsed.info.lamports) === Number(lamports));
    if (tx.tiempo && tx.tiempo < desde - 30000) return { ok: false, motivo: 'es un pago anterior al pedido', recibido: tx.recibidoSol };
    if (!t) return { ok: false, motivo: tx.recibidoSol > 0 ? `monto distinto: llegaron ${(tx.recibidoSol / 1e9).toFixed(9)} SOL y el pedido es de ${(lamports / 1e9).toFixed(9)}` : 'no hay una transferencia a tu wallet', recibido: tx.recibidoSol };
    return { ok: true, recibido: lamports, de: t.parsed.info.source };
  }

  // Igual para el token $DUENDE: una transferencia SPL del mint correcto a una
  // cuenta de El Duende por exactamente las unidades del pedido.
  async verificarDuende(firma, raw, desde) {
    const tx = await this.leerTx(firma);
    if (tx === null) return null;
    if (!tx.ok) return tx;
    const dueno = new Set();
    for (const b of tx.post || []) if (b.mint === DUENDE_MINT && b.owner === SOL_DEV_WALLET) dueno.add(tx.cuentas[b.accountIndex]);
    const t = tx.instr.find(x => x.program === 'spl-token' && x.parsed && /^transfer/.test(x.parsed.type) && dueno.has(x.parsed.info.destination)
      && (!x.parsed.info.mint || x.parsed.info.mint === DUENDE_MINT)
      && Number(x.parsed.info.amount || (x.parsed.info.tokenAmount && x.parsed.info.tokenAmount.amount)) === raw);
    if (tx.tiempo && tx.tiempo < desde - 30000) return { ok: false, motivo: 'es un pago anterior al pedido', recibido: 0 };
    if (!t) return { ok: false, motivo: `no hay una transferencia de exactamente ${(raw / 10 ** DUENDE_DECIMALES).toLocaleString('es', { maximumFractionDigits: 6 })} $DUENDE a la wallet de El Duende`, recibido: 0 };
    return { ok: true, recibido: raw, de: t.parsed.info.authority || t.parsed.info.source };
  }

  // Lee una transaccion confirmada (jsonParsed) con todas sus instrucciones,
  // tambien las internas. null = no se pudo consultar la cadena.
  async leerTx(firma) {
    try {
      const key = this.env.HELIUS_API_KEY;
      const url = key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [firma, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
      if (r.ok === false) return null;   // 429, 5xx...: no se sabe (no es "no existe")
      const d = await r.json();
      if (!d || d.error) return null;
      const tx = d.result;
      if (!tx) return { ok: false, motivo: 'la transacción no existe (o aún no se confirma)', recibido: 0 };
      if (tx.meta && tx.meta.err) return { ok: false, motivo: 'la transacción falló', recibido: 0 };
      const instr = [...(tx.transaction.message.instructions || [])];
      for (const g of (tx.meta && tx.meta.innerInstructions) || []) instr.push(...(g.instructions || []));
      const cuentas = (tx.transaction.message.accountKeys || []).map(k => typeof k === 'string' ? k : k.pubkey);
      const i = cuentas.indexOf(SOL_DEV_WALLET);
      const recibidoSol = i >= 0 && tx.meta ? tx.meta.postBalances[i] - tx.meta.preBalances[i] : 0;
      return { ok: true, instr, cuentas, post: tx.meta && tx.meta.postTokenBalances, recibidoSol, tiempo: tx.blockTime ? tx.blockTime * 1000 : 0 };
    } catch (e) { return null; }
  }

  async pedidoPagadoStars(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.metodo !== 'stars') return { ok: false, error: 'pedido desconocido' };
    if (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido') return { ok: true, repetido: true, nombre: pd.nombre };
    if ('tg:' + b.tgId !== pd.uid || (b.stars | 0) < pd.stars) {
      // Ya no se marca como pagado: queda por revisar (el dueño decide).
      pd.estado = 'por_verificar'; pd.charge = String(b.charge || ''); pd.tgPagador = String(b.tgId || ''); pd.starsPagadas = b.stars | 0; pd.pagadoEn = Date.now();
      pd.cadena = { ok: false, motivo: `pagó ${b.stars} Stars (se pedían ${pd.stars}) desde otra cuenta o de menos` };
      await this.guardarPedidos();
      this.avisarAdmin(`⚠️ Pago de Stars raro en el pedido #${pd.codigo}: pagó ${b.stars} (se pedían ${pd.stars}) desde tg ${b.tgId}. Queda por revisar; para devolverlo: /anular ${pd.codigo}`);
      return { ok: true, nombre: pd.nombre };
    }
    pd.estado = 'pagado'; pd.charge = String(b.charge || ''); pd.tgPagador = String(b.tgId || ''); pd.starsPagadas = b.stars | 0; pd.pagadoEn = Date.now();
    await this.guardarPedidos();
    this.avisarAdmin(`⭐ *Pedido #${pd.codigo}* pagado — ${pd.nombre} (${pd.starsPagadas} Stars, ya están en tu bot)\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n\nEntrégalo: /entregar ${pd.codigo}\nO devuelve las Stars: /anular ${pd.codigo}`, botonesPedido(pd.codigo));
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
    // Skin: a sus skins y puesta. Si ya la tenia (la compro con oro mientras
    // tanto), se le devuelve su precio en oro para que no pierda nada.
    let notaSkin = '';
    if (pq.skin && SKINS[pq.skin]) {
      c.skins = c.skins || ['comun'];
      const pOro = typeof SKINS[pq.skin].precio === 'number' ? SKINS[pq.skin].precio : Math.round(pq.usd * 10000);   // las premium no tienen precio en oro
      if (c.skins.includes(pq.skin)) { c.oro += pOro; notaSkin = ` Ya la tenías: te dimos ${pOro.toLocaleString('es', { useGrouping: 'always' })} de oro.`; }
      else { c.skins.push(pq.skin); c.skin = pq.skin; notaSkin = ' Ya la llevas puesta.'; }
      if (s) { s.st = this.stats(c); this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); this.actualizarYo(s); }
    }
    if (pq.alas && ALAS[pq.alas]) {
      c.alas = c.alas || ['aprendiz'];
      if (!c.alas.includes(pq.alas)) c.alas.push(pq.alas);
      c.ala = pq.alas;
      notaSkin = ' Ya las llevas puestas (vuela con V en el mundo 3D).';
      if (s) { this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); this.actualizarYo(s); }
    }
    pd.estado = 'entregado'; pd.entregado = Date.now(); pd.por = b.por || 'bot';
    if (pd.metodo === 'sol' || pd.metodo === 'duende') {
      this.ingresosSol.push({ usd: pd.usd, t: Date.now() });
      this.ingresosSol = this.ingresosSol.filter(x => Date.now() - x.t < 30 * 86400000);
      await this.state.storage.put('ingresosSol', this.ingresosSol);
    }
    if (s) await this.guardar(s); else await this.state.storage.put('c:' + pd.uid, c);
    await this.guardarPedidos();
    await this.avisarJugador(pd.uid, `🎁 ¡Tu compra "${pd.nombre}" ya está en tu personaje!${notaSkin} Gracias por apoyar DUENDE QUEST.`);
    return { ok: true, pedido: pd };
  }

  // /ventas (solo el dueño): lo entregado en 7 y 30 dias, por metodo y lo
  // mas vendido, y lo que queda por entregar. Sale de los ultimos 300 pedidos.
  resumenVentas() {
    const ahora = Date.now();
    const ent = this.pedidos.filter(x => x.estado === 'entregado');
    const tramo = dias => {
      const l = ent.filter(x => ahora - (x.entregado || x.creado) < dias * 86400000);
      const por = {};
      for (const x of l) { const k = x.nombre; por[k] = por[k] || { n: 0, usd: 0 }; por[k].n++; por[k].usd += x.usd; }
      return {
        n: l.length, usd: Math.round(l.reduce((a, x) => a + x.usd, 0) * 100) / 100,
        sol: l.filter(x => x.metodo === 'sol').length, stars: l.filter(x => x.metodo === 'stars').length,
        top: Object.entries(por).sort((a, b) => b[1].usd - a[1].usd).slice(0, 5).map(([nombre, v]) => ({ nombre, ...v })),
      };
    };
    return { ok: true, d7: tramo(7), d30: tramo(30), pendientes: this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar').length, anulados30: this.pedidos.filter(x => x.estado === 'anulado' && ahora - x.creado < 30 * 86400000).length };
  }

  async anularPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.estado === 'entregado' || pd.estado === 'anulado' || pd.estado === 'anulando') return { ok: false, error: 'Ese pedido no se puede anular (no existe, ya se entregó o ya se anuló).' };
    const estadoAntes = pd.estado;
    pd.estado = 'anulando';   // un segundo toque (o /entregar) mientras se devuelven las Stars ya no pasa
    // La firma vuelve a quedar libre (si era de otro pago, su dueño puede usarla).
    if (pd.firma && (await this.state.storage.get('firma:' + pd.firma)) === pd.codigo) await this.state.storage.delete('firma:' + pd.firma);
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

  // botones: teclado en linea opcional (p. ej. Entregar / Anular un pedido).
  async avisarAdmin(texto, botones) {
    try {
      const env = getEnv({ env: this.env });
      if (env.BOT_TOKEN && env.ADMIN_TG_ID) await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: env.ADMIN_TG_ID, text: texto, parse_mode: 'Markdown', ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) });
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
    if (accion === 'chichas' || accion === 'chichaOk' || accion === 'chichaNo') return json(await this.internoChicha(accion, b));
    if (accion === 'retiros') return json({ ok: true, pendientes: this.retiros.filter(x => x.estado === 'pendiente'), fondo: this.infoFondo() });
    if (accion === 'pedidoValido') {
      const pd = this.buscarPedido(b.codigo);
      const ok = !!pd && pd.metodo === 'stars' && pd.estado === 'esperando_pago' && Date.now() - pd.creado < PEDIDO_VIGENCIA_MS;
      return json({ ok });
    }
    if (accion === 'pedidoPagado') return json(await this.pedidoPagadoStars(b));
    if (accion === 'pedidos') return json({ ok: true, pedidos: this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar') });
    if (accion === 'ventas') return json(this.resumenVentas());
    // /yo del bot: el personaje de quien escribe (solo el suyo: el bot manda
    // el id de Telegram del remitente).
    if (accion === 'perfil') {
      const uid = 'tg:' + String(b.tgId || '').replace(/\D/g, '');
      if (uid === 'tg:') return json({ ok: false });
      const s = this.porUid.get(uid);
      const c = s && s.c ? s.c : await this.state.storage.get('c:' + uid);
      if (!c) return json({ ok: true, existe: false });
      const ex = c.exped ? { h: c.exped.h, d: c.exped.d || 'bosque', listo: c.exped.fin <= Date.now(), min: Math.max(0, Math.ceil((c.exped.fin - Date.now()) / 60000)) } : null;
      return json({ ok: true, existe: true, en: !!s, n: c.nombre, lv: c.nivel, cl: c.clase || '', oro: c.oro || 0, mton: c.mton || 0,
        torre: this.torreSem(c).max, torreMax: c.torreMax || 0, peces: c.peces || 0, especies: Object.keys(c.especies || {}).length,
        logros: (c.logros || []).length, mazmorras: c.mazmorras || 0, elo: c.elo || 0, exped: ex, racha: (c.login || {}).racha || 0 });
    }
    // Rankings publicos de la semana (solo nombres y marcas) para /topmmo del bot.
    if (accion === 'tops') {
      const fuera = uid => UIDS_PRUEBA.has(uid);
      const xp = this.topSemana().filter(([uid]) => !fuera(uid)).slice(0, 5).map(([, x]) => ({ n: x.n, lv: x.lv, xp: x.xp }));
      const torre = (await this.topTorre()).filter(([uid]) => !fuera(uid)).slice(0, 5).map(([, x]) => ({ n: x.n, p: x.p }));
      const des = this.topDesSem().filter(([uid]) => !fuera(uid)).slice(0, 3).map(([, x]) => ({ n: x.n, k: x.k }));
      const duel = ((await this.state.storage.get('rankDuelo')) || []).filter(x => !fuera(x.uid)).slice(0, 5).map(x => ({ n: x.n, e: x.e }));
      const herm = (await this.topHerm()).slice(0, 3).map(([, x]) => ({ n: x.n, p: x.p }));
      return json({ ok: true, xp, torre, des, duel, herm, online: this.contarOnline() });
    }
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
    // stats, recordatorios y avisos (functions/mmo/retencion.js)
    const ret = await this.internoRetencion(accion, b);
    if (ret) return json(ret);
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
    const anteayer = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    // Faltar UN dia no borra la racha: retrocede dos dias (antes volvia al 1).
    const racha = L.d === ayer ? (L.racha % LOGIN_PREMIOS.length) + 1 : L.d === anteayer && L.racha < LOGIN_PREMIOS.length ? Math.max(1, (L.racha || 1) - 1) : 1;
    const pr = LOGIN_PREMIOS[racha - 1];
    const oro = Math.round((pr.oro || 0) * multLogin(c.nivel));
    c.oro += oro;
    for (const k in (pr.pw || {})) c.pw[k] = Math.min(99, (c.pw[k] || 0) + pr.pw[k]);
    let item = null;
    if (pr.item !== undefined) item = this.darItem(s, generarItem(c.nivel, pr.item), true);
    c.login = { d: hoy, racha, total: (L.total || 0) + 1 };
    // Regalo de bienvenida al volver tras 3+ dias fuera: que regresar compense.
    let vuelta = null;
    const dias = L.d ? Math.round((Date.parse(hoy) - Date.parse(L.d)) / 86400000) : 0;
    if (dias >= 3) {
      const vOro = Math.round(400 * Math.min(dias, 7) * multLogin(c.nivel));
      c.oro += vOro;
      c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + 5);
      const vIt = this.darItem(s, generarItem(c.nivel, dias >= 7 ? 2 : 1), true);
      vuelta = { dias, oro: vOro, pociones: 5, item: nombreItem(vIt) };
    }
    return { racha, oro, pw: pr.pw || null, item, txt: pr.txt, vuelta };
  }

  // Mete un objeto en la bolsa (si esta llena se vende solo).
  darItem(s, it, silencioso) {
    const c = s.c;
    if (it.r === 3) {
      c.tuvoLegendario = true;
      this.aTodos({ t: 'aviso', m: `${c.nombre} ha encontrado un objeto legendario: ${nombreItem(it)}.` });
    }
    // Una pieza de conjunto no se vende sola: se cambia por la comun mas
    // barata de la bolsa (son de coleccion; perderlas dolia mucho).
    if (c.bolsa.length >= BOLSA_MAX && (it.cj || it.banda)) {
      const i = c.bolsa.reduce((m, x, k) => (!x.cj && !x.banda && (m < 0 || precioVenta(x) < precioVenta(c.bolsa[m])) ? k : m), -1);
      if (i >= 0) { const v0 = precioVenta(c.bolsa[i]); c.oro += v0; c.bolsa.splice(i, 1); if (!silencioso) this.enviar(s, { t: 'toast', m: `🎒 Bolsa llena: se vendió tu objeto más barato (+${v0} oro) para guardar tu pieza de conjunto.` }); }
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
  revisarLogros(s, diferido) {
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
    if (cambio) { s.sucio = true; diferido ? this.yoLuego(s, true) : this.actualizarYo(s); }
  }

  diariaDe(c) {
    const hoy = hoyUTC();
    if (!c.diaria || c.diaria.d !== hoy) c.diaria = { d: hoy, p: 0, ok: false };
    return c.diaria;
  }

  datosPropios(s) {
    const c = s.c;
    this.diariaDe(c);
    if (this.rotarBoveda(c)) s.sucio = true;
    return {
      diaria: c.diaria,
      nombre: c.nombre, nivel: c.nivel, xp: c.nivel >= NIVEL_MAX ? (c.mae || {}).p || 0 : c.xp, xpSig: c.nivel >= NIVEL_MAX ? MAESTRIA_XP : xpParaSubir(c.nivel), mae: (c.mae || {}).n || 0, oro: c.oro,
      hp: Math.ceil(s.hp), maxHp: s.st.maxHp, atk: s.st.atk, def: s.st.def,
      arma: c.arma, armas: c.armas, skin: c.skin, skins: c.skins, pw: c.pw,
      kills: c.kills, jefes: c.jefes, muerto: s.muerto, mis: c.mis, forja: c.forja,
      eq: c.eq, bolsa: c.bolsa, logros: c.logros, titulo: c.titulo, mundiales: c.mundiales, login: c.login, crit: s.st.crit,
      clase: c.clase, rec: Math.round(s.rec || 0), recMax: s.st.recMax, combo: s.combo || 0, mazDia: c.mazDia || null, mazmorras: c.mazmorras || 0, torreSem: this.torreSem(c).max, torreMax: c.torreMax || 0, exped: c.exped || null, nVisitadas: c.nVisitadas || 0, visitadas: c.visitadas || [], especies: c.especies || {}, nEspecies: c.nEspecies || 0, dorados: c.dorados || 0, exped8: c.exped8 || 0, peces: c.peces || 0, expediciones: c.expediciones || 0, duelosG: c.duelosG || 0, desafioMax: c.desafioMax || 0, amigosN: c.amigos || 0, desafio: c.desafio || {}, ...Object.fromEntries(TEMPORADAS.map(t => [t.campo, c[t.campo] || 0])), chicha: this.infoChicha(c), temp: (temporadaDe() || {}).id || '', herm: c.herm || null, pid: pub(c.uid), descanso: c.descanso || 0, tareas: this.infoTareas(c), mat: c.mat || {}, tal: c.tal || {}, best: c.best || {},
      boveda: c.boveda, bovedaOpc: c.bovedaOpc || null, pase: this.infoPase(c), banda: this.infoBanda(c), runas: c.runas || {}, gestaCob: c.gestaCob || null,
      faccion: c.faccion || null, pa: c.pa || 0, bajasPvP: c.bajasPvP || 0, look: c.look || null, alas: c.alas || ['aprendiz'], ala: c.ala || 'aprendiz', espec: c.espec || null, monturas: c.monturas || [], montura: c.montura || null, tintes: c.tintes || [], tinte: c.tinte || '', mascotas: c.mascotas || [], mascota: c.mascota || '', montado: s.montado || null,
      mton: c.mton, wallet: c.wallet ? { a: tonAmigable(c.wallet.a), desde: c.wallet.desde } : null,
      p2e: this.elegibilidad(c), creado: c.creado,
      retiros: this.retiros.filter(x => x.uid === c.uid).slice(-5).map(x => ({ id: x.id, ton: x.ton, estado: x.estado, creado: x.creado })),
      // Los de SOL sin pagar (y sin caducar) tambien, para poder retomar el pago.
      pedidos: this.pedidos.filter(x => x.uid === c.uid && x.estado !== 'vencido' && (x.estado !== 'esperando_pago' || ((x.metodo === 'sol' || x.metodo === 'duende') && Date.now() - x.creado < PEDIDO_VIGENCIA_MS))).slice(-5)
        .map(x => ({ codigo: x.codigo, nombre: x.nombre, metodo: x.metodo, estado: x.estado, creado: x.creado, ...(x.estado === 'esperando_pago' ? (x.metodo === 'duende'
          ? { raw: x.duendeRaw, mint: DUENDE_MINT, dec: DUENDE_DECIMALES, usd: Math.round(x.usd * DUENDE_DESCUENTO * 100) / 100, wallet: SOL_DEV_WALLET }
          : { lamports: x.lamports, usd: x.usd, wallet: SOL_DEV_WALLET, ref: x.ref || '' }) : {}) })),
      transparencia: this.transparencia(),
      dios: s.dios ? 1 : 0, diosModo: s.dios ? s.diosModo || {} : undefined,
    };
  }
  actualizarYo(s) { s.yoPend = null; s.yoT = Date.now(); this.enviar(s, { t: 'yo', yo: this.datosPropios(s) }); }
  // Mundo 3D: tras cada caza no se reenvia el personaje entero (2-8 KB y un
  // repintado en el cliente): se marca y tick3d manda como mucho 1 vez/s lo
  // que cambia al cazar ('yoC', ~250 B). full = hace falta el 'yo' entero
  // (botin, subida de nivel, logro).
  yoLuego(s, full) { if (!s.m3) return this.actualizarYo(s); s.yoPend = full || s.yoPend === 'full' ? 'full' : 'caza'; }
  datosCaza(s) { const c = s.c, max = c.nivel >= NIVEL_MAX; return { nivel: c.nivel, xp: max ? (c.mae || {}).p || 0 : c.xp, xpSig: max ? MAESTRIA_XP : xpParaSubir(c.nivel), mae: (c.mae || {}).n || 0, oro: c.oro, kills: c.kills, jefes: c.jefes, mis: c.mis, diaria: c.diaria, pw: c.pw, descanso: c.descanso || 0, mat: c.mat || {} }; }
  vaciarYo(s, ahora) {
    if (!s.yoPend || ahora - (s.yoT || 0) < 1000) return;
    if (s.yoPend === 'full') return this.actualizarYo(s);
    s.yoPend = null; s.yoT = ahora;
    this.enviar(s, { t: 'yoC', yo: this.datosCaza(s) });
  }

  infoJugador(s) {
    return { ...this.infoApariencia(s), n: s.c.nombre, lv: s.c.nivel, x: Math.round(s.x), y: Math.round(s.y), f: s.f, hp: Math.ceil(s.hp), muerto: s.muerto, au: this.aurasVivas(s.au) };
  }
  // Lo que cambia al equiparse o elegir clase (mensaje 'pa').
  infoApariencia(s) {
    return { p: s.id, id: s.id, sk: s.c.skin, ar: s.c.arma, mx: s.st.maxHp, ti: this.textoTitulo(s.c), cl: s.c.clase || '', rmx: s.st.recMax, hn: this.nombreHermandad(s.c.herm), hc: this.colorHermandad(s.c.herm), mo: s.montado || '', es: s.c.espec || '', lk: s.c.look || undefined, al: s.c.ala && s.c.ala !== 'aprendiz' ? s.c.ala : undefined, fc: s.c.faccion || undefined, ra: s.c.faccion && s.c.pa ? rangoDe(s.c.pa).i || undefined : undefined, tn: s.c.tinte || '', ma: s.c.exped ? '' : s.c.mascota || '', gm: s.dios ? 1 : 0, gi: s.dios && s.diosModo && s.diosModo.inv ? 1 : 0 };
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
    return { id: m.id, k: m.k, x: Math.round(m.x), y: Math.round(m.y), f: m.f, hp: Math.ceil(m.hp), mx: m.max, st: this.codigoEstado(m), au: this.aurasVivas(m.au), nv: m.nv || undefined, ex: m.ex || undefined };
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
    // Quien esta en el mundo 3D no se mueve a un mapa 2D (p. ej. si su grupo
    // entra a una mazmorra o a la Torre desde el 2D).
    if (s.m3) return;
    // Un mapa que no existe (uno guardado que se quito, o una prueba) tumbaba
    // el bucle del mundo en simularMapa: al pueblo.
    if (!Object.hasOwn(MAPAS, mapaId)) { mapaId = 'pueblo'; clave = null; x = 800; }
    const k = clave || mapaId;
    if (!primeraVez) {
      this.cancelarCast(s);
      this.aClave(s.k, { t: 'pl', id: s.id }, s);
      if (s.m3) this.olvidar3d(s); else this.olvidar(s);
      if (s.k !== k) this.salirDeMundo(s, k);
    }
    if (s.montado && (k.includes('#') || mapaId === 'coliseo')) s.montado = null;
    s.c.mapa = mapaId;
    s.k = k;
    // Zonas abiertas visitadas (logro Trotamundos).
    const zm = MAPAS[mapaId];
    if (zm.zona && !zm.instancia && !zm.coliseo && zm.nv) {
      s.c.visitadas = s.c.visitadas || [];
      if (!s.c.visitadas.includes(mapaId)) { s.c.visitadas.push(mapaId); s.c.nVisitadas = s.c.visitadas.length; s.sucio = true; this.revisarLogros(s); }
    }
    s.movBud = undefined;   // tras un viaje el presupuesto de movimiento empieza lleno
    s.x = clamp(x, 20, MAPAS[mapaId].ancho - 20);
    s.y = SUELO;
    s.movT = Date.now();
    s.sucio = true;
    const w = this.mundoK(k);
    if (MAPAS[mapaId].jefe && !w.jefeEn) w.jefeEn = Date.now() + JEFE_PRIMERO_MS;
    const jugadores = [];
    for (const o of this.sesiones.values()) if (o.c && o !== s && o.k === k) jugadores.push(this.infoJugador(o));
    this.enviar(s, { t: 'mapa', mapa: mapaId, clave: k, x: Math.round(s.x), jugadores, mons: [...w.mons.values()].map(m => this.infoMonstruo(m)),
      sc: s.sinCorte ? 1 : undefined,
      muros: w.muros || [], inst: w.inst ? { id: w.inst.id, nv: w.inst.nv, hechos: w.inst.hechos, k: w.inst.k || 0 } : null });
    this.aClave(k, { t: 'pj', p: this.infoJugador(s) }, s);
    this.eventosAlEntrar(s, mapaId);
    this.nodosAlEntrar(s, mapaId);
  }

  portal(s, m) {
    if (s.muerto) return;
    const mapa = MAPAS[s.c.mapa];
    const p = mapa.portales[m.i | 0];
    if (!p || Math.abs(s.x - p.x) > 90) return;
    // El portal de mazmorras abre el buscador (el cliente elige cual).
    if (p.buscador) return this.enviar(s, { t: 'buscador' });
    // Salir de una mazmorra lleva de vuelta a su puerta del mundo abierto.
    // Por el borde (caminando) se cruza sin corte: se aparece junto al borde
    // de entrada de la zona nueva y el cliente sigue andando sin fundido.
    const dest = MAPAS[p.a];
    const borde = !!m.borde && dest && !dest.instancia;
    const x = borde ? (p.ax < dest.ancho / 2 ? 70 : dest.ancho - 70) : p.ax;
    s.sinCorte = borde;
    this.entrarMapa(s, p.a, x);
    s.sinCorte = false;
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
    const ancho = MAPAS[s.c.mapa].ancho;
    // Presupuesto de distancia que se recarga con el tiempo (correr + un dash
    // cada dashCd + margen de latencia). Antes cada mensaje traia un dash
    // entero y 60 px de regalo: mandando muchos 'mv' cortos se cruzaba un
    // mapa de 2600 px en 0,2 s (speed-hack, encontrado en la auditoria).
    // El dios con "velocidad libre" no tiene limite.
    if (!(s.dios && s.diosModo && s.diosModo.vel)) {
      const velPx = FIS.vel * velMontura(s.montado) * (1 + talento(s.c, 'agilidad')) * 60;
      const dashPx = FIS.dashVel * FIS.dashT;
      const tope = velPx + dashPx + 80;
      const recarga = velPx * 1.2 + dashPx / (FIS.dashCd / 60);
      s.movBud = Math.min(tope, (s.movBud === undefined ? tope : s.movBud) + recarga * dt / 1000);
      const dx = Math.abs(x - s.x);
      if (dx > s.movBud + 20) {
        this.enviar(s, { t: 'snap', x: Math.round(s.x), y: Math.round(s.y) });
        s.movT = ahora;
        return;
      }
      s.movBud = Math.max(0, s.movBud - dx);
    }
    // Las barreras de las mazmorras no se cruzan hasta vencer a su jefe.
    const tope = this.topeMuros(s);
    if (x > tope) {
      if (x > tope + 40) this.enviar(s, { t: 'snap', x: Math.round(Math.min(s.x, tope)), y: Math.round(s.y) });
      m = { ...m, x: Math.min(s.x, tope) };
    }
    // Moverse cancela el hechizo que se esta lanzando (como en WoW).
    if (s.cast && (Math.abs(m.x - s.cast.x) > 6 || Math.abs(y - s.cast.y) > 6)) this.cancelarCast(s, s.cast.h === 'hogar' ? 'Te moviste: la Piedra de Hogar se canceló.' : s.cast.h === 'pescar' || s.cast.h === 'pica' ? 'Te moviste: se cortó el sedal.' : '');
    s.x = clamp(m.x, 10, ancho - 10);
    // Altura: como mucho un doble salto (~195 px) sobre el suelo o una
    // plataforma cercana. Antes se aceptaba cualquier y: se podia "volar"
    // (y abrir cofres o esquivar a los monstruos de abajo sin saltar).
    s.y = clamp(Math.max(y, this.techoEn(s.c.mapa, s.x)), 40, SUELO);
    s.f = m.f === -1 ? -1 : 1;
    s.a = clamp(m.a | 0, 0, 6);
    s.movT = ahora;
    s.c.x = Math.round(s.x);
  }

  // y mas alta (mas pequeña) a la que se puede llegar saltando en x: el doble
  // salto desde la superficie mas alta de alrededor (con margen por lo que
  // se avanza en el aire, el dash y la montura).
  techoEn(mapa, x) {
    let base = SUELO;
    for (const [px, py, pw] of MAPAS[mapa].plataformas || []) if (x >= px - 380 && x <= px + pw + 380 && py < base) base = py;
    return base - MAX_SALTO;
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
        if (it.nv > c.nivel && !(it.des && c.nivel >= NIVEL_MAX)) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${it.nv} para usar eso.` });
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
    const vivo = !!(m && m.o && !m.o.muere);
    return { t: 'mundial', vivo, en: m && m.o ? 0 : proximoMundial(Date.now()), k: vivo ? m.o.k : mundialDe(proximoMundial(Date.now()) + 1000) };
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
        const nomHuye = MONSTRUOS[M.o.k].nombre;
        M.o = null;
        this.aTodos({ t: 'aviso', m: `👹 ${nomHuye} escapó del Coliseo… otro jefe llega en 30 minutos.` });
        this.aTodos(this.estadoMundial());
      }
      return;
    }
    // Aviso 2 minutos antes, a todos los conectados.
    if (prox - ahora <= 120000 && prox - ahora > 5000 && M.avisado !== prox) {
      M.avisado = prox;
      this.aTodos({ t: 'aviso', m: `${MONSTRUOS[mundialDe(prox + 1000)].nombre} llega al Coliseo en 2 minutos. Portal del pueblo; todos los niveles reciben premio.` });
    }
    // Aparece en la media hora en punto (con margen de un tick).
    const ult = prox - (prox - ahora > 1000 ? 30 * 60 * 1000 : 0);
    if (ahora >= ult && ahora - ult < 5000 && M.ultimo !== ult) {
      M.ultimo = ult;
      const o = this.crearMonstruo('coliseo', mundialDe(ult + 1000), 800);
      const n = Math.max(1, this.contarOnline());
      o.hp = o.max = 20000 + 15000 * n;
      M.o = o; M.hasta = ahora + MUNDIAL_DURA_MS;
      this.aClave('coliseo', { t: 'ms', m: this.infoMonstruo(o) });
      this.aTodos({ t: 'aviso', m: `${MONSTRUOS[o.k].nombre} ha aparecido en el Coliseo. Tienes 10 minutos.` });
      this.aTodos(this.estadoMundial());
    }
  }

  premiosMundial(o, clave = 'coliseo') {
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const nombres = [];
    for (const [sid, d] of o.dano) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.k !== clave) continue;
      const c = s.c;
      // Hay que haber peleado de verdad (al menos un 0,3 % de su vida).
      if (d < o.max * 0.003) continue;
      const parte = d / total;
      // Como mucho 6 premios completos al dia (Coliseo y 3D juntos); luego, uno pequeño.
      const hoy = hoyUTC();
      if (!c.mundDia || c.mundDia.d !== hoy) c.mundDia = { d: hoy, n: 0 };
      const lleno = c.mundDia.n++ < 6;
      const xp = Math.round(xpParaSubir(c.nivel) * (lleno ? 0.12 + Math.min(0.13, parte) : 0.02));
      const oro = Math.round(80 * c.nivel * (1 + Math.min(1, parte * 3)) * (lleno ? 1 : 0.25));
      c.oro += oro;
      c.mundiales = (c.mundiales || 0) + 1;
      this.progresoTarea(s, 'mundial');
      if (lleno) this.puntoPase(s, PASE.puntos.mundial);
      const it = lleno ? this.darItem(s, generarItem(c.nivel, parte > 0.15 ? 2 : 1)) : null;
      // Premio fijo para todos los que ayudaron: si dependiera del daño, una
      // skin pagada con mas ataque daria mas mTON (y se pagaria para ganar).
      if (parte >= 0.02) this.darMton(s, 80, 'mundial');
      this.sumarXp(s, xp);
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it, x: Math.round(o.x), y: Math.round(o.y - o.h) });
      this.enviar(s, { t: 'toast', m: `Jefe mundial derrotado. +${xp} XP · +${oro} oro` + (it ? ` · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}` : ' (premio pequeño: hoy ya cobraste 6 completos)'), ok: true });
      s.sucio = true;
      this.revisarLogros(s);
      this.actualizarYo(s);
      nombres.push(c.nombre);
    }
    this.aTodos({ t: 'aviso', m: `${MONSTRUOS[o.k].nombre} ha caído. Héroes: ${nombres.slice(0, 6).join(', ')}${nombres.length > 6 ? ' y ' + (nombres.length - 6) + ' más' : ''}` });
  }

  // amen = multiplicador de amenaza de la habilidad (el guerrero ademas
  // genera el doble por ser tanque, ver CLASES[].amenaza).
  danar(o, dmg, s, amen) {
    if (o.muere) return 0;
    const ahora = Date.now();
    o.tocadoT = ahora;
    // Caparazon (jefes de mazmorra): casi no recibe daño mientras dura.
    const cap = this.auraMon(o, 'caparazon');
    if (cap) dmg = Math.max(1, Math.round(dmg * (1 - (cap.reduce || 0.9))));
    if (s && s.dios && s.diosModo && s.diosModo.golpe) dmg = Math.ceil(o.hp);   // Modo Dios: de un golpe
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
        const mult = (((SKINS[s.c.skin].buffs || {}).oroMult) || 1) * (1 + talento(s.c, 'fortuna'));
        const xp = Math.max(1, Math.round(base.xp * k * (1 + talento(s.c, 'erudicion')) * (o.xpX || 1)));
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
      const xp = Math.max(1, Math.round(base.xp * 0.25 * (o.xpX || 1)));
      this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro: 0, drops: [], x: Math.round(o.x), y: Math.round(o.y - o.h), coop: true });
      this.actualizarYo(s);
    }
    if (o.jefe && o.mazmorra) this.alMorirJefeMaz(o);
    if (o.grupo && this.alMorirPack) this.alMorirPack(o);
    // Invasores, capitan y raros (functions/mmo/eventos.js).
    if (o.ex) this.alMorirEspecial(o);
    this.aClave(o.cl, { t: 'md', id: o.id, pr: premios });
    if (o.jefe && !o.mazmorra) {
      this.mundoK(o.cl).jefeEn = Date.now() + JEFE_REAPARECE_MS;
      const quien = premios.map(p => this.sesiones.get(p[0])?.c?.nombre).filter(Boolean).slice(0, 4).join(', ');
      this.aTodos({ t: 'aviso', m: `⚔️ ${MONSTRUOS[o.k].nombre} fue derrotado${quien ? ' por ' + quien : ''}` });
    }
  }

  sumarMaestria(s, xp) {
    const c = s.c;
    if (!(xp > 0)) return;
    const M = c.mae || (c.mae = { n: 0, p: 0 });
    M.p += xp;
    const subidos = [];
    while (M.p >= MAESTRIA_XP) {
      M.p -= MAESTRIA_XP; M.n++;
      const pr = premioMaestria(M.n);
      c.oro += pr.oro;
      if (pr.item) this.darItem(s, this.generarItem(c.nivel, pr.item));
      subidos.push(M.n);
    }
    s.sucio = true;
    if (subidos.length) {
      const n = M.n, pr = premioMaestria(n);
      this.enviar(s, { t: 'mae', n });
      this.enviar(s, { t: 'toast', ok: true, m: `⭐ Maestría ${n}: +${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro${subidos.some(k => premioMaestria(k).item) ? ' y un objeto épico' : ''}.` });
      if (n % 10 === 0) this.aTodos({ t: 'aviso', m: `⭐ ${c.nombre} alcanza la Maestría ${n}.` });
      this.guardar(s);
    }
  }

  // Suma experiencia y sube de nivel si toca. Devuelve si subio.
  sumarXp(s, xp) {
    const c = s.c;
    // En el nivel maximo la XP va a la maestria y sigue contando en el ranking semanal.
    if (c.nivel >= NIVEL_MAX) { this.sumarXpSemana(s, xp); this.sumarMaestria(s, xp); return false; }
    let subio = false;
    c.xp += xp;
    this.sumarXpSemana(s, xp);
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
      if (nueva) this.enviar(s, { t: 'toast', m: `Nueva habilidad: ${nueva.nombre}`, ok: true, hab: nueva.id });
      this.revisarLogros(s);
      this.hermSubioNivel(s);
      this.revisarAmigo(s).catch(e => console.error('[MMO amigo]', e));
      this.aClave(s.k, { t: 'lv', p: s.id, lv: c.nivel, mx: s.st.maxHp, rmx: s.st.recMax });
      this.actualizarRanking(s);
      this.guardar(s);
    }
    return subio;
  }

  // n = miembros del grupo que cobran esta presa (reparte el botin).
  dar(s, xp, oro, o, n, participo) {
    const c = s.c;
    // Ceviche del Duende (pesca + artesania): +10% del oro de caza.
    if (this.elixir(s, 'ceviche')) oro = Math.round(oro * 1.1);
    c.oro += oro;
    c.kills++;
    if (o && o.jefe) c.jefes++;
    // Hora Feliz (cada dia 01-02 UTC): +50% de la XP de caza.
    if (horaFelizActiva()) xp = Math.round(xp * HORA_FELIZ.xp);
    // Elixir de Sabiduria (artesania): +10% de la XP de caza. Skins con xpMult.
    if (this.elixir(s, 'elixirX')) xp = Math.round(xp * 1.1);
    const xpSkin = ((SKINS[c.skin] || {}).buffs || {}).xpMult;
    if (xpSkin) xp = Math.round(xp * xpSkin);
    // El descanso duplica la experiencia de cada caza hasta gastarse.
    const extra = Math.min(c.descanso || 0, xp);
    if (extra > 0) { c.descanso -= extra; xp += extra; }
    const subio = this.sumarXp(s, xp);
    // Drops: pociones y, en jefes, poderes raros.
    const drops = [];
    // Premio de chicha morada: cada caza suma sus puntos (no es al azar).
    const chi = participo !== false ? this.sumarChicha(s, o) : 0;
    // Temporada (Halloween, Navidad...): su objeto para los logros con titulo.
    let cal = 0;
    const tp = o && participo !== false ? temporadaDe() : null;
    if (tp) {
      cal = o.jefe ? TEMP_JEFE : (Math.random() < TEMP_PROB ? 1 : 0);
      if (cal) c[tp.campo] = (c[tp.campo] || 0) + cal;
    }
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
      if (o.jefe && this.esJefeBanda(o)) {
        // Banda: botin propio, una vez por semana y jefe (mazmorras.js).
        item = this.botinBanda(s, o, participo !== false);
      } else if (o.jefe && !o.cueva) {
        const it0 = generarItem(nvM, o.final ? 2 : 1);
        // Jefe de mazmorra: a veces la pieza es de su conjunto.
        const idMaz = o.mazmorra && this.mundo[o.cl] && this.mundo[o.cl].inst && this.mundo[o.cl].inst.id;
        if (idMaz && CONJUNTOS[idMaz] && Math.random() < CONJUNTO_PROB) it0.cj = idMaz;
        item = this.darItem(s, it0);
        if ((n || 1) === 1 && Math.random() < 0.3) this.darItem(s, generarItem(nvM, 0));
      } else if (nvM >= c.nivel - 10 && Math.random() < 0.06 * ((n || 1) > 1 ? 1.2 / n : 1)) {
        item = this.darItem(s, generarItem(nvM, 0));
      }
    }
    // Diaria: monstruos de su nivel o hasta 5 por debajo.
    const d = this.diariaDe(c);
    if (o && participo !== false && !d.ok && d.p < DIARIA.n && (o.nv || MONSTRUOS[o.k].nivel) >= c.nivel - 5) {
      d.p++;
      if (d.p === DIARIA.n) this.enviar(s, { t: 'toast', m: `«${DIARIA.nombre}» cumplida. Cóbrala con el Guardia Tito.`, ok: true });
    }
    // Bestiario: cada tipo cazado suma; los hitos dan oro.
    if (o && participo !== false && !MONSTRUOS[o.k].mundial) {
      c.best = c.best || {};
      const n = c.best[o.k] = (c.best[o.k] || 0) + 1;
      const i = BESTIARIO_HITOS.indexOf(n);
      if (i >= 0) {
        const pr = premioBestiario(MONSTRUOS[o.k].nivel, i);
        c.oro += pr;
        this.enviar(s, { t: 'toast', m: `📖 Bestiario: ${n} × ${MONSTRUOS[o.k].nombre} · +${pr.toLocaleString('es', { useGrouping: 'always' })} oro`, ok: true });
      }
    }
    // Misiones diarias y semanales (solo quien peleo de verdad).
    if (o && participo !== false) {
      if (o.jefe || (o.nv || MONSTRUOS[o.k].nivel) >= c.nivel - 10) this.puntoGesta(s, o.jefe ? 'jefe' : 'caza');
      this.progresoTarea(s, 'caza', o, n || 1);
      if (o.jefe && !o.mazmorra && !o.cueva && !MONSTRUOS[o.k].mundial) this.progresoTarea(s, 'jefe', o);
    }
    // Mision en curso: cuenta si el monstruo es el que pide.
    const q = MISIONES[c.mis.i];
    if (o && q && o.k === q.tipo && !(o.torre && o.jefe) && c.mis.p < q.n) {
      c.mis.p++;
      if (c.mis.p === q.n) this.enviar(s, { t: 'toast', m: `Misión cumplida: «${q.nombre}». Entrégala al Guardia Tito.`, ok: true });
    }
    s.sucio = true;
    this.enviar(s, { t: 'gana', xp, oro, drops, item, cal: cal || undefined, tp: cal ? tp.id : undefined, chi: chi || undefined, x: Math.round(o ? o.x : s.x), y: Math.round(o ? o.y - o.h : s.y - 60) });
    this.revisarLogros(s, true);
    this.yoLuego(s, subio || !!item);
  }

  // Entregar la mision (o la diaria) al Guardia Tito.
  // desde3d: recibir3d() ya comprobo que esta junto al Guardia del pueblo 3D.
  mision(s, m, desde3d) {
    const c = s.c;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'guia');
    if (!(desde3d === true && s.m3) && (s.k !== 'pueblo' || !npc || Math.abs(s.x - npc.x) > 200)) return this.enviar(s, { t: 'toast', m: 'Habla con el Guardia Tito en el pueblo.' });
    if (m && m.diaria) {
      const d = this.diariaDe(c);
      if (d.ok) return this.enviar(s, { t: 'toast', m: 'Ya cobraste la caza de hoy.' });
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
    if (!q) return this.enviar(s, { t: 'toast', m: 'Ya completaste todas las misiones del Guardia Tito.' });
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
    const duelo = fuente && fuente.duelo, pvp = fuente && fuente.pvp;
    if ((ahora < s.inv && !pct && !duelo && !pvp) || ahora < s.escudo || this.aura(s, 'bloque')) return;
    if (s.dios && s.diosModo && s.diosModo.inv) return;   // Modo Dios: invencible
    // Evasion del picaro: esquiva golpes cuerpo a cuerpo (las bolas y las
    // zonas no).
    if (!(fuente && (fuente.bala || fuente.zona)) && this.aura(s, 'evasion') && Math.random() < EVASION) {
      s.inv = ahora + 400;
      this.aDe(s, { t: 'ph', p: s.id, d: 0, esq: 1, from: fuente ? fuente.id : 0 });
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
    // Duelo: la defensa solo amortigua un poco (si no, el guerrero no recibia
    // casi nada); la escala del daño ya la pone golpeDuelo.
    if (duelo || pvp) {
      const sb = this.statsSinSkin(s);
      real = Math.max(1, Math.round(bruto * (1 - sb.def / (sb.def + 120)) * (s.st.maxHp / Math.max(1, sb.maxHp))));
    }
    // Un monstruo comun nunca quita mas de un 30% de la vida de un golpe: en
    // una zona algo alta se sufre, pero ya no se muere en tres toques. Los
    // jefes quedan fuera (su embestida avisada es el peligro de verdad).
    if (!(fuente && fuente.jefe)) real = Math.min(real, Math.ceil(s.st.maxHp * 0.3));
    if (this.aura(s, 'muro')) real = Math.round(real * (1 - REDUCE_MURO));
    if (this.aura(s, 'supresion')) real = Math.round(real * (1 - REDUCE_SUPRESION));
    if (this.elixir(s, 'elixirP')) real = Math.round(real * 0.9);
    if (this.elixir(s, 'sudado')) real = Math.round(real * 0.95);
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
    // En un duelo nadie muere: se queda a 1 y el duelo termina.
    if (duelo) real = Math.min(real, Math.max(0, Math.ceil(s.hp) - 1));
    s.hp -= real;
    // Los ultimos golpes, para explicar la muerte ("te mató...").
    const mo = fuente && fuente.id ? (s.m3 ? this.iniciar3d().mons.get(fuente.id) : this.mundoDe(s).mons.get(fuente.id)) : null;
    s.golpes = (s.golpes || []).filter(x => ahora - x.t < 12000).slice(-4);
    const atacante = pvp ? this.sesiones.get(pvp) : null;
    s.golpes.push({ t: ahora, n: mo ? MONSTRUOS[mo.k].nombre : atacante && atacante.c ? atacante.c.nombre : 'Daño', nv: mo ? (mo.nv || MONSTRUOS[mo.k].nivel) : atacante && atacante.c ? atacante.c.nivel : 0, d: real });
    if (!pct && !duelo && !pvp) s.inv = ahora + INVULNERABLE_GOLPE_MS;
    s.golpeT = ahora;
    s.combateT = ahora;
    // El guerrero se enfurece al recibir golpes.
    if (CLASES[s.c.clase] && CLASES[s.c.clase].recurso === 'ira' && real > 0) s.rec = Math.min(100, s.rec + 1 + real / s.st.maxHp * 150);
    if (this.aura(s, 'sigilo')) this.quitarAura(s, 'sigilo');
    if (s.montado) this.desmontar(s);
    if (s.cast && (s.cast.h === 'hogar' || s.cast.h === 'montar' || s.cast.h === 'recolectar' || s.cast.h === 'pescar' || s.cast.h === 'pica')) this.cancelarCast(s, s.cast.h === 'pescar' || s.cast.h === 'pica' ? 'Te golpearon: se cortó el sedal.' : 'Te golpearon: se canceló.');
    this.aDe(s, { t: 'ph', p: s.id, d: real, ab: abs || undefined, from: fuente ? fuente.id : 0 });
    // La vida ya va en cada foto del mundo: el "yo" entero (bolsa, equipo...)
    // tras cada golpe pesaba en la red y repintaba las ventanas del movil.
    if (s.hp <= 0) { this.morir(s); if (atacante && this.muertePvP) this.muertePvP(atacante, s); this.actualizarYo(s); }
  }

  morir(s) {
    s.hp = 0;
    s.muerto = true;
    s.montado = null;
    s.combo = 0;
    this.cancelarCast(s);
    this.limpiarAuras(s);
    if (s.m3) this.olvidar3d(s); else this.olvidar(s);
    this.aClave(s.k, { t: 'pm', p: s.id });
    this.enviar(s, { t: 'muerte', golpes: (s.golpes || []).map(x => ({ n: x.n, nv: x.nv, d: x.d })), pw: s.c.pw.pocion || 0, inst: !!(this.mundo[s.k] && this.mundo[s.k].inst) });
    s.golpes = [];
    this.guardar(s);
  }

  revivir(s) {
    if (!s.muerto) return;
    const c = s.c;
    // Castigo suave: se pierde el 5% de la experiencia del nivel actual. Hasta
    // nivel 10 no se pierde nada y se revive a la entrada de la misma zona
    // (antes: al pueblo, a 80-100 m, y la espiral de muertes echaba al novato).
    const novato = c.nivel < 10;
    if (!novato) c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
    s.muerto = false;
    s.hp = s.st.maxHp;
    this.recursoInicial(s);
    s.inv = Date.now() + 2000;
    const zona = MAPAS[c.mapa];
    if (!this.revivirEnInstancia(s)) {
      if (novato && zona && zona.zona && !s.k.includes('#') && c.mapa !== 'coliseo') this.entrarMapa(s, c.mapa, 150);
      else this.entrarMapa(s, 'pueblo', MAPAS.pueblo.spawn);
    }
    this.reponerElixires(s);
    this.actualizarYo(s);
    this.guardar(s);
  }

  // ── PODERES (consumibles) ──
  poder(s, m) {
    if (s.muerto || this.aura(s, 'bloque') || this.aura(s, 'aturdido')) return;
    const def = PODERES[m.i | 0];
    if (!def) return;
    const ahora = Date.now();
    if ((s.c.pw[def.id] || 0) <= 0) return this.enviar(s, { t: 'toast', m: `No te quedan ${(def.plural || def.nombre).toLowerCase()}. El Mercader del pueblo las vende.` });
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
    if (s.m3) return this.cerca3d(s, 'tienda');
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
      if ((c.pw[def.id] || 0) + n > 99) return this.enviar(s, { t: 'toast', m: 'Máximo 99 de cada consumible.' });
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
      if (mo.banda) return this.enviar(s, { t: 'toast', m: 'Esa montura no se vende: se gana en la banda del Santuario del Titán.' });
      if (mo.torre) return this.enviar(s, { t: 'toast', m: 'Esa montura no se vende: se gana en la Torre del Duende.' });
      if (c.nivel < mo.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${mo.nv} para esa montura.` });
      if (c.oro < mo.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= mo.precio;
      c.monturas.push(m.id);
      c.montura = m.id;
    } else if (m.k === 'alas') {
      if (typeof m.id !== 'string' || !Object.hasOwn(ALAS, m.id)) return;
      const al = ALAS[m.id];
      c.alas = c.alas || ['aprendiz'];
      if (c.alas.includes(m.id)) { c.ala = m.id; this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); this.actualizarYo(s); return this.enviar(s, { t: 'toast', m: `🪽 Ahora llevas: ${al.nombre}.`, ok: true }); }
      if (al.premium) return this.enviar(s, { t: 'toast', m: 'Esas alas son premium: están en la tienda PREMIUM.' });
      if (al.mazmorras) return this.enviar(s, { t: 'toast', m: `Esas alas no se venden: se ganan completando ${al.mazmorras} mazmorras.` });
      if (c.nivel < al.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${al.nv} para esas alas.` });
      if (c.oro < al.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= al.precio;
      c.alas.push(m.id);
      c.ala = m.id;
      this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    } else if (m.k === 'tinte') {
      // Color del nombre: '' lo quita; si ya lo tienes, solo se cambia.
      c.tintes = c.tintes || [];
      if (m.id === '') { if (!c.tinte) return; c.tinte = ''; }   // sin cambio, sin guardar
      else {
        if (typeof m.id !== 'string' || !Object.hasOwn(TINTES, m.id)) return;
        const tn = TINTES[m.id];
        if (!c.tintes.includes(m.id)) {
          if (tn.amb && !enOfertaAmbulante('tinte', m.id)) return this.enviar(s, { t: 'toast', m: 'Ese color solo lo trae el Mercader ambulante algunos fines de semana.' });
          if (c.nivel < tn.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${tn.nv} para ese color.` });
          if (c.oro < tn.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
          c.oro -= tn.precio;
          c.tintes.push(m.id);
        }
        c.tinte = m.id;
      }
      this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    } else if (m.k === 'mascota') {
      // Mascota: '' la guarda; si ya la tienes, solo se cambia.
      c.mascotas = c.mascotas || [];
      if (m.id === '') { if (!c.mascota) return; c.mascota = ''; }
      else {
        if (typeof m.id !== 'string' || !Object.hasOwn(MASCOTAS, m.id)) return;
        const ma = MASCOTAS[m.id];
        if (!c.mascotas.includes(m.id)) {
          if (ma.pase) return this.enviar(s, { t: 'toast', m: 'Esa mascota solo se gana con el pase de temporada.' });
          if (ma.pesca) return this.enviar(s, { t: 'toast', m: 'Esa mascota solo se consigue pescando.' });
          if (ma.amb && !enOfertaAmbulante('mascota', m.id)) return this.enviar(s, { t: 'toast', m: 'Esa mascota solo la trae el Mercader ambulante algunos fines de semana.' });
          if (c.nivel < ma.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${ma.nv} para esa mascota.` });
          if (c.oro < ma.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
          c.oro -= ma.precio;
          c.mascotas.push(m.id);
        }
        c.mascota = m.id;
      }
      this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    } else if (m.k === 'arma' || m.k === 'skin') {
      const tabla = m.k === 'arma' ? ARMAS : SKINS;
      const lista = m.k === 'arma' ? c.armas : c.skins;
      // hasOwn y no tabla[id]: '__proto__' o 'constructor' existen en cualquier
      // objeto y dejaban el oro en NaN al "comprarlos".
      if (typeof m.id !== 'string' || !Object.hasOwn(tabla, m.id)) return;
      const def = tabla[m.id];
      if (lista.includes(m.id)) return this.enviar(s, { t: 'toast', m: 'Ya lo tienes.' });
      // Las premium no se venden por oro (precio null: c.oro -= null no restaba nada).
      if (typeof def.precio !== 'number') return this.enviar(s, { t: 'toast', m: 'Esta skin solo se consigue en la tienda premium (SOL o $DUENDE).' });
      if (c.oro < def.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= def.precio;
      lista.push(m.id);
      this.equipar(s, { k: m.k, id: m.id });
    } else return;
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', m: m.k === 'forja' ? `${ARMAS[m.id].nombre} mejorada a +${c.forja[m.id]}.` : m.k === 'montura' ? `Nueva montura: ${MONTURAS[m.id].nombre}. Tecla Y o botón de montura.` : m.k === 'tinte' ? (c.tinte ? `🎨 Tu nombre ahora es ${TINTES[c.tinte].nombre}.` : '🎨 Tu nombre vuelve al color de tu clase.') : m.k === 'mascota' ? (c.mascota ? `🐾 ${MASCOTAS[c.mascota].nombre} te acompaña.` : '🐾 Guardaste a tu mascota.') : '✅ Compra realizada', ok: true });
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
    if (UIDS_PRUEBA.has(s.c.uid) || this.diosActivo(s)) return;
    const r = (await this.state.storage.get('ranking')) || [];
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, lv: s.c.nivel, xp: s.c.xp, k: s.c.kills };
    if (i >= 0) r[i] = fila; else r.push(fila);
    r.sort((a, b) => b.lv - a.lv || b.xp - a.xp);
    await this.state.storage.put('ranking', r.slice(0, 50));
  }

  async enviarRanking(s) {
    // Como mucho cada 3 s por jugador (lee el storage y ordena todo).
    if (Date.now() - (s.rankT || 0) < 3000) return;
    s.rankT = Date.now();
    const r = ((await this.state.storage.get('ranking')) || []).filter(x => !UIDS_PRUEBA.has(x.uid));
    const sem = this.topSemana().slice(0, 20).map(([uid, x]) => ({ n: x.n, lv: x.lv, xp: x.xp, yo: uid === s.c.uid }));
    const des = ((await this.state.storage.get('rankDes')) || []).slice(0, 10).map(x => ({ n: x.n, k: x.k, yo: x.uid === s.c.uid }));
    const dsem = this.topDesSem().slice(0, 10).map(([uid, x]) => ({ n: x.n, k: x.k, yo: uid === s.c.uid }));
    const duel = ((await this.state.storage.get('rankDuelo')) || []).slice(0, 10).map(x => ({ n: x.n, e: x.e, g: x.g, yo: x.uid === s.c.uid }));
    const torre = (await this.topTorre()).slice(0, 10).map(([uid, x]) => ({ n: x.n, p: x.p, yo: uid === s.c.uid }));
    const herm = (await this.topHerm()).slice(0, 5).map(([id, x]) => ({ n: x.n, p: x.p, m: x.m, yo: id === s.c.herm }));
    this.enviar(s, { t: 'ranking', r: r.slice(0, 20).map(x => ({ n: x.n, lv: x.lv, k: x.k, yo: x.uid === s.c.uid })), sem, des, dsem, duel, elo: s.c.elo || 0, torre, tmax: this.torreSem(s.c).max, herm, af: afijosSemana(), finSem: Date.parse(this.rs.sem + 'T00:00:00Z') + 7 * 86400000 });
  }

  // Ranking semanal de Desafios: el mejor +k vencido esta semana (con los
  // afijos de la semana). Pasa poco: se guarda al momento. Se premia en
  // revisarSemana al cambiar la semana.
  anotarDesSem(s, k) {
    if (!this.rds || UIDS_PRUEBA.has(s.c.uid) || k <= 0 || this.rds.sem !== semanaUTC()) return;
    const f = this.rds.l[s.c.uid];
    if (f && f.k >= k) return;
    this.rds.l[s.c.uid] = { n: s.c.nombre, k, t: Date.now() };
    this.state.storage.put('rankDesSem', this.rds).catch(e => console.error('[MMO rankDesSem]', e));
  }
  topDesSem(rds = this.rds) { return Object.entries((rds && rds.l) || {}).sort((a, b) => b[1].k - a[1].k || a[1].t - b[1].t); }
  async premiarDesSem(rds) {
    const top = this.topDesSem(rds).filter(([, f]) => f.k >= DES_SEM_MIN).slice(0, 3);
    const nombres = [];
    for (let i = 0; i < top.length; i++) {
      const [uid, f] = top[i];
      const s = this.porUid.get(uid);
      const c = s ? s.c : await this.state.storage.get('c:' + uid);
      if (!c) continue;
      const oro = premioDesSem(i);
      c.oro += oro;
      if (i === 0) c.maestroDes = (c.maestroDes || 0) + 1;
      if (s) { this.actualizarYo(s); this.revisarLogros(s); await this.guardar(s); }
      else await this.state.storage.put('c:' + uid, c);
      nombres.push(['🥇', '🥈', '🥉'][i] + ' ' + f.n + ' (+' + f.k + ')');
      const txt = `⚡ ¡Quedaste ${['1º', '2º', '3º'][i]} en el ranking semanal de Desafíos de DUENDE QUEST ONLINE (+${f.k})! Premio: +${oro.toLocaleString('es', { useGrouping: 'always' })} oro${i === 0 ? ' y el título de Maestro de Desafíos' : ''}. Esta semana cambian los afijos.`;
      if (s) this.enviar(s, { t: 'toast', m: txt, ok: true });
      if (await this.quiereAvisos(uid)) { try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: uid.slice(3), text: txt }); } catch (e) {} }
    }
    if (nombres.length) this.aTodos({ t: 'aviso', m: `⚡ Ranking semanal de Desafíos: ${nombres.join(' · ')}. Nuevos afijos esta semana.` });
  }

  // Ranking de Desafios (final de juego): el mejor +k de cada uno. Se
  // actualiza al batir la marca propia.
  // Ranking de duelos (Elo): los 30 mejores; sube y baja con cada duelo contado.
  async actualizarRankDuelo(s) {
    if (UIDS_PRUEBA.has(s.c.uid) || !s.c.elo) return;
    const r = (await this.state.storage.get('rankDuelo')) || [];
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, e: s.c.elo, g: s.c.duelosG || 0 };
    if (i >= 0) r[i] = fila; else r.push(fila);
    r.sort((a, b) => b.e - a.e);
    await this.state.storage.put('rankDuelo', r.slice(0, 30));
  }

  async actualizarRankDes(s) {
    if (UIDS_PRUEBA.has(s.c.uid) || !s.c.desafioMax) return;
    const r = (await this.state.storage.get('rankDes')) || [];
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, k: s.c.desafioMax, t: Date.now() };
    if (i >= 0) { if (r[i].k >= fila.k) return; r[i] = fila; } else r.push(fila);
    r.sort((a, b) => b.k - a.k || a.t - b.t);
    await this.state.storage.put('rankDes', r.slice(0, 30));
  }

  // ── RANKING SEMANAL ──
  // La experiencia ganada en la semana (lunes a domingo, UTC). Se lleva en
  // memoria y se guarda cada minuto; al cambiar la semana se premia al top 3
  // (oro, un objeto y el titulo de Campeon) y empieza de cero. Cualquiera
  // puede ganarla, no solo los de nivel alto: cuenta lo que juegas.
  sumarXpSemana(s, xp) {
    // Si ya cambio la semana y aun no se roto (pasa en el tick), no se suma a
    // la vieja: si no, se ganaba su premio con XP de la semana nueva.
    if (!this.rs || UIDS_PRUEBA.has(s.c.uid) || xp <= 0 || this.rs.sem !== semanaUTC()) return;
    const f = this.rs.l[s.c.uid] || (this.rs.l[s.c.uid] = { xp: 0 });
    f.xp += xp; f.n = s.c.nombre; f.lv = s.c.nivel;
    this.rsSucio = true;
  }
  topSemana() { return Object.entries((this.rs && this.rs.l) || {}).sort((a, b) => b[1].xp - a[1].xp); }
  async revisarSemana(ahora) {
    if (!this.rs) return;
    const sem = semanaUTC();
    if (this.rds && this.rds.sem !== sem) {
      const vieja = this.rds;
      this.rds = { sem, l: {} };
      await this.state.storage.put('rankDesSem', this.rds);
      await this.premiarDesSem(vieja);
    }
    if (this.rt ? this.rt.sem !== sem : true) await this.cargarRankTorre();
    if (this.rs.sem !== sem) {
      const vieja = this.rs;
      this.rs = { sem, l: {} };
      await this.state.storage.put('rankSem', this.rs);
      await this.premiarSemana(vieja);
      return;
    }
    if (this.rsSucio && ahora - (this.rsT || 0) > 60000) {
      this.rsT = ahora; this.rsSucio = false;
      const top = Object.fromEntries(this.topSemana().slice(0, 100));
      this.rs.l = top;
      await this.state.storage.put('rankSem', this.rs);
    }
  }
  async premiarSemana(rs) {
    const top = Object.entries(rs.l).sort((a, b) => b[1].xp - a[1].xp).slice(0, 3);
    const nombres = [];
    for (let i = 0; i < top.length; i++) {
      const [uid, f] = top[i];
      const s = this.porUid.get(uid);
      const c = s ? s.c : await this.state.storage.get('c:' + uid);
      if (!c) continue;
      const oro = [400, 200, 100][i] * c.nivel;
      c.oro += oro;
      if (i === 0) c.campeon = (c.campeon || 0) + 1;
      const it = generarItem(c.nivel, i === 0 ? 2 : 1);
      if ((c.bolsa || []).length < BOLSA_MAX) c.bolsa.push(it); else c.oro += precioVenta(it);
      if (s) { this.actualizarYo(s); this.revisarLogros(s); await this.guardar(s); }
      else await this.state.storage.put('c:' + uid, c);
      nombres.push(['🥇', '🥈', '🥉'][i] + ' ' + f.n);
      const txt = `🏆 ¡Quedaste ${['1º', '2º', '3º'][i]} en el ranking semanal de DUENDE QUEST ONLINE! Premio: +${oro.toLocaleString('es', { useGrouping: 'always' })} oro y ${RAREZAS[it.r].nombre.toLowerCase()}: ${nombreItem(it)}${i === 0 ? ' y el título de Campeón Semanal' : ''}. Ya empezó la nueva semana: ¡a defenderlo!`;
      // Por Telegram solo a quien no pidio dejar de recibir avisos.
      if (s) this.enviar(s, { t: 'toast', m: txt, ok: true });
      if (await this.quiereAvisos(uid)) { try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: uid.slice(3), text: txt }); } catch (e) {} }
    }
    if (nombres.length) this.aTodos({ t: 'aviso', m: `🏆 Ranking semanal: ${nombres.join(' · ')}. Empieza una semana nueva.` });
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
    this.retAlGuardar(s);
    // Si el guardado falla se reintenta en el siguiente ciclo (no se pierde el progreso).
    try { await this.state.storage.put('c:' + s.c.uid, s.c); } catch (e) { s.sucio = true; console.error('[MMO guardar]', e); }
  }

  // ── SIMULACION ──
  tick() {
    const ahora = Date.now();
    if (ahora - (this.onT || 0) > 10000) {
      this.onT = ahora;
      // Aviso a todos al empezar y al acabar la Hora Feliz.
      const hf = horaFelizActiva(ahora);
      if (this.hfAntes !== undefined && hf !== this.hfAntes) this.aTodos({ t: 'aviso', m: hf ? 'Empieza la Hora Feliz: +50% de experiencia por caza durante una hora.' : '⚡ Terminó la Hora Feliz.' });
      this.hfAntes = hf;
      // Una pestaña abierta sin jugar mantiene vivo el objeto (y cobra tiempo
      // de CPU del cupo diario) todo el dia: fuera tras 10 min sin actividad.
      for (const s of [...this.sesiones.values()]) {
        if (s.c && ahora - (s.actT || 0) > INACTIVO_MS) {
          this.enviar(s, { t: 'err', m: 'Te desconectamos por inactividad. Toca la pantalla o pulsa una tecla para volver.', fatal: true, inactivo: true });
          try { s.ws.close(4001, 'inactivo'); } catch (e) {}
          this.cerrar(s);
        }
      }
      this.contarHoy().then(h => this.aTodos({ t: 'on', n: this.contarOnline(), h }), () => this.aTodos({ t: 'on', n: this.contarOnline() }));
      this.revisarSemana(ahora).catch(e => console.error('[MMO semana]', e));
    }
    this.revisarMundial(ahora);
    this.tickGrupos(ahora);
    this.guardarHermsSucias(ahora);
    this.tickDuelos(ahora);
    const porClave = {}, en3d = [];
    for (const s of this.sesiones.values()) {
      if (!s.c) continue;
      if (s.sucio && ahora - s.guardadoT > GUARDAR_CADA_MS) this.guardar(s);
      if (s.m3) { en3d.push(s); continue; }   // el mundo 3D va aparte
      (porClave[s.k] = porClave[s.k] || []).push(s);
    }
    this.tick3d(ahora, en3d);
    // Invasiones, raros (functions/mmo/eventos.js): solo mira zonas con gente.
    this.tickEventos(ahora, porClave);
    for (const k in porClave) this.simularMapa(k, porClave[k], ahora);
    // Instancias vacias (todos salieron): se cierran solas.
    if (this.limpiarInstancias) this.limpiarInstancias(porClave, ahora);
    this.limpiarTorres(porClave, ahora);
  }

  simularMapa(clave, jugadores, ahora) {
    const w = this.mundoK(clave);
    const mapa = MAPAS[w.mapa];
    const dt = TICK_MS / 1000;

    if (w.torre) this.tickTorre(w, jugadores, ahora);
    else if (w.inst) { if (this.tickMazmorra) this.tickMazmorra(w, jugadores, ahora); }
    else if (mapa.zona && mapa.monstruos.length) {
      // Reponer monstruos poco a poco (no todos de golpe).
      // Mas jugadores en la zona, mas monstruos (hasta el doble), para que no
      // se queden esperando reapariciones peleandose por los mismos.
      const max = Math.min(mapa.max * 2, mapa.max + 4 * (jugadores.length - 1));
      // Los invasores de un evento (o.ex) no cuentan: tienen su propio final.
      const vivos = [...w.mons.values()].filter(m => !m.jefe && !m.ex).length;
      // Lo que piden las misiones de los presentes y no queda vivo en la zona:
      // sin esto, un bosque lleno de tipos que el novato no mata dejaba la
      // mision 1 sin goblins durante minutos (medido por el QA de jugador).
      const faltan = this.tiposQueFaltan(w, mapa, jugadores);
      if (faltan.length && vivos >= max) {
        const lejos = m => jugadores.every(s => Math.abs(s.x - m.x) > 350);
        // Se retiran los que hagan falta (hasta 3 por tick) para abrir hueco.
        const sobran = [...w.mons.values()].filter(m => !m.jefe && !m.ex && !m.muere && !m.amen.size && !faltan.includes(m.k) && lejos(m)).slice(0, Math.min(3, vivos - max + 1));
        for (const m of sobran) { w.mons.delete(m.id); this.aClave(clave, { t: 'md', id: m.id, pr: [], fuera: 1 }); }
        if (sobran.length) w.spawnEn = 0;
      }
      const vivos2 = [...w.mons.values()].filter(m => !m.jefe && !m.ex).length;
      if (vivos2 < max && ahora >= w.spawnEn) {
        this.crearMonstruo(clave, faltan.length ? faltan[Math.floor(Math.random() * faltan.length)] : this.tipoAReponer(w, mapa, jugadores, max));
        w.spawnEn = ahora + (vivos2 < max / 2 ? 700 : 2500);
      }
      // Zona llena de monstruos que nadie toca (p. ej. fantasmas que un
      // novato no alcanza): los que llevan 3 min sin pelear se retiran para
      // dejar sitio a otros.
      if (vivos >= max && ahora >= (w.retiroEn || 0)) {
        w.retiroEn = ahora + 20000;
        const viejo = [...w.mons.values()].find(m => !m.jefe && !m.ex && !m.muere && !m.amen.size && ahora - (m.tocadoT || m.nacio || 0) > 180000);
        if (viejo) { w.mons.delete(viejo.id); this.aClave(clave, { t: 'md', id: viejo.id, pr: [], fuera: 1 }); }
      }
      if (mapa.jefe && w.jefeEn && ahora >= w.jefeEn && ![...w.mons.values()].some(m => m.jefe)) {
        w.jefeEn = 0;
        const j = this.crearMonstruo(clave, mapa.jefe, mapa.jefeX || mapa.ancho * 0.62);
        this.aTodos({ t: 'aviso', m: `${MONSTRUOS[j.k].nombre} ha aparecido en ${mapa.nombre}.` });
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
    if (w.zonas && w.zonas.length) snap.z = w.zonas.map(z => [z.id, Math.round(z.x0), Math.round(z.x1), z.act <= ahora ? 1 : 0, z.color || '', z.junta ? 1 : 0]);
    const txt = JSON.stringify(snap);
    for (const s of jugadores) this.enviar(s, txt);
  }

  // op (mazmorras): { nv, hpX, atkX, agresivo, mazmorra, ... } se copian al monstruo.
  // Que tipo reponer: ninguno pasa de su parte del cupo (si no, la zona se
  // llenaba de un tipo que el novato no mata y dejaban de salir los de su
  // mision), y el que piden las misiones de los presentes sale el doble.
  // Tipos de mision de los presentes que no tienen ningun ejemplar vivo aqui.
  tiposQueFaltan(w, mapa, jugadores) {
    const hay = new Set();
    for (const m of w.mons.values()) if (!m.muere) hay.add(m.k);
    const f = [];
    for (const s of jugadores) {
      const q = MISIONES[s.c.mis && s.c.mis.i];
      if (q && !MONSTRUOS[q.tipo].jefe && mapa.monstruos.includes(q.tipo) && s.c.mis.p < q.n && !hay.has(q.tipo) && !f.includes(q.tipo)) f.push(q.tipo);
    }
    return f;
  }

  tipoAReponer(w, mapa, jugadores, max) {
    const tipos = mapa.monstruos;
    const cuenta = {};
    for (const m of w.mons.values()) if (!m.jefe && !m.muere) cuenta[m.k] = (cuenta[m.k] || 0) + 1;
    const tope = Math.ceil(max / tipos.length) + 1;
    const pedidos = new Set(jugadores.map(s => (MISIONES[s.c.mis && s.c.mis.i] || {}).tipo));
    const bolsa = [];
    for (const k of tipos) {
      if ((cuenta[k] || 0) >= tope) continue;
      bolsa.push(k);
      if (pedidos.has(k)) bolsa.push(k);
    }
    const lista = bolsa.length ? bolsa : tipos;
    return lista[Math.floor(Math.random() * lista.length)];
  }

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
      aviso: false, embiste: false, faseEn: Date.now() + 4000, fase: 0, nacio: Date.now(),
    };
    if (op) for (const kk of ['nv', 'agresivo', 'mazmorra', 'radioAgro', 'grupo', 'guion', 'xpX', 'sinEmbestida', 'jefeMaz', 'ex']) if (op[kk] !== undefined) o[kk] = op[kk];
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
      // El jefe de zona no va a por quien esta 3+ niveles por debajo (salvo
      // que le pegue: entonces entra por la amenaza, arriba).
      const nvJefe = territorio ? (o.nv || MONSTRUOS[o.k].nivel || 0) : 0;
      for (const s of jugadores) {
        if (s.muerto || this.aura(s, 'sigilo') || Math.abs(s.y - o.y) > 220) continue;
        if (territorio && s.c.nivel <= nvJefe - 3) continue;
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
    } else if (o.grupo && !obj && (Math.abs(o.x - o.casaX) > 60 || o.hp < o.max)) {
      // Mazmorra: el pack que pierde a su presa vuelve a su sitio y se cura
      // (como en WoW), tambien la furia del afijo Furioso. Antes se quedaba
      // donde mato y atacaba al revivir.
      if (Math.abs(o.x - o.casaX) > 60) { o.f = o.casaX > o.x ? 1 : -1; vx = o.f * o.vel * 1.35 * 60 * dt; }
      if (o.hp < o.max) { o.hp = o.max; o.dano.clear(); }
      if (o.furia) { o.furia = false; o.atk = Math.round(o.atk / 1.5); }
    } else if (!golpeado && !obj) {
      // Pasear: tramos cortos a un lado y pausas.
      if (ahora >= o.pasoEn) { o.dir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); o.pasoEn = ahora + rnd(1200, 3200); }
      if (o.dir) { o.f = o.dir; vx = o.dir * o.vel * 0.6 * 60 * dt; }
    }
    if (raiz && !o.embiste) vx = 0;
    o.x = clamp(o.x + vx, 30, mapa.ancho - 30);
    if (o.jefe) o.x = clamp(o.x, o.casaX - (o.mazmorra ? 450 : 600), o.casaX + (o.mazmorra ? 450 : 600));   // no se le puede arrastrar a la entrada
    // Mazmorras: ningun monstruo (ni jefe) cruza una barrera cerrada; cada uno
    // se queda en la sala donde nacio (antes los packs del fondo se sumaban
    // al combate del primer jefe).
    const wm = o.cl.includes('#') ? this.mundo[o.cl] : null;
    if (wm && wm.muros && wm.muros.length) {
      let lo = 30, hi = mapa.ancho - 30;
      for (const mu of wm.muros) { if (mu <= o.casaX) lo = Math.max(lo, mu + 25); else hi = Math.min(hi, mu - 25); }
      o.x = clamp(o.x, lo, hi);
    }
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
// Raros, invasiones y cofres del mundo 3D: functions/mmo/eventos3d.js
Object.assign(MmoWorld.prototype, Eventos3D);
// Grupos y chat por canales: functions/mmo/social.js
Object.assign(MmoWorld.prototype, Social);
// Mazmorras instanciadas con jefes de guion: functions/mmo/mazmorras.js
Object.assign(MmoWorld.prototype, Mazmorras);
// Hermandades: functions/mmo/hermandades.js
Object.assign(MmoWorld.prototype, Hermandades);
// Misiones diarias y semanales: functions/mmo/tareas.js
Object.assign(MmoWorld.prototype, Tareas);
// Recoleccion y artesania: functions/mmo/profesiones.js
Object.assign(MmoWorld.prototype, Profesiones);
// Invita a un amigo: functions/mmo/amigos.js
Object.assign(MmoWorld.prototype, Amigos);
// Duelos entre jugadores: functions/mmo/duelos.js
Object.assign(MmoWorld.prototype, Duelos);
// Premio fisico de chicha morada: functions/mmo/chicha.js
Object.assign(MmoWorld.prototype, Chicha);
// Estadisticas de retencion y avisos de vuelta por Telegram: functions/mmo/retencion.js
Object.assign(MmoWorld.prototype, Retencion);
MmoWorld.prototype.uidsPrueba = UIDS_PRUEBA;
// Invasiones, elites raros y cofres del mundo abierto: functions/mmo/eventos.js
Object.assign(MmoWorld.prototype, Eventos);
// Pase de temporada mensual: functions/mmo/pase.js
Object.assign(MmoWorld.prototype, Pase);
// La Torre del Duende: functions/mmo/torre.js
Object.assign(MmoWorld.prototype, Torre);
// Expediciones de la mascota: functions/mmo/expediciones.js
Object.assign(MmoWorld.prototype, Expediciones);
// Modo Dios del dueño (moderacion) y nombres unicos: functions/mmo/dios.js
Object.assign(MmoWorld.prototype, Dios);
// Piedras de viaje entre zonas visitadas: functions/mmo/viajes.js
Object.assign(MmoWorld.prototype, Viajes);
// El mundo abierto 3D (mismo personaje, otro mundo): functions/mmo/mundo3d.js
Object.assign(MmoWorld.prototype, Mundo3D);
Object.assign(MmoWorld.prototype, Cueva3D);
// Pieza de equipo nueva (para los modulos que no ven generarItem).
MmoWorld.prototype.nuevoItem = (nv, r) => generarItem(nv, r);
MmoWorld.prototype.generarItem = generarItem;
