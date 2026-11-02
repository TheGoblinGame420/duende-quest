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
  MAPAS, MONSTRUOS, statsMonstruo, statsJugador, xpParaSubir, SKINS, precioOro, ARMAS, PODERES, MISIONES, DIARIA, premioDiaria, hoyUTC,
  FORJA_MAX, costoForja, multForja,
  RANURAS, RAREZAS, BOLSA_MAX, baseItem, precioVenta, nombreItem, costoReforja, textoBonos,
  LOGIN_PREMIOS, multLogin, diaRacha, semanaRacha, multSemanaRacha, premioRacha, RACHA_HITOS, LOGROS, MUNDIAL_DURA_MS, proximoMundial,
  MTON_POR_TON, RETIRO_MIN_MTON, MTON_NIVEL_MIN, MTON_EDAD_MIN_MS, WALLET_ESPERA_MS, FONDO_REFERENCIA_MTON, tonAmigable,
  RETIRO_MAX_MTON, RETIRO_CADA_MS, TOPE_DIARIO_PCT, FONDO_PCT_INGRESOS, PAQUETES, estrellasDe, PEDIDO_VIGENCIA_MS, PAGO_LOCAL, pagoLocalActivo, YAPE_VIGENCIA_MS, textoPagoRecibido, DUENDE_MINT, DUENDE_DECIMALES, DUENDE_DESCUENTO,
  temporadaDe, TEMPORADAS, TEMP_PROB, TEMP_JEFE,
  TINTES, MASCOTAS, enOfertaAmbulante, ambulanteActivo, mundialDe,
  CONJUNTOS, CONJUNTO_PROB,
  semanaUTC, horaFelizActiva, HORA_FELIZ, PASE, MAESTRIA_XP, premioMaestria, afijosSemana, DES_SEM_MIN, premioDesSem, BESTIARIO_HITOS, premioBestiario, talento, TALENTOS, TALENTO_MAX, puntosTalento, costoReinicioTalentos, costoReparacion, SUELO, TICK_MS, NIVEL_MAX, FIS, limpiarNombre, CLASES, HABS, MONTURAS, velMontura, descansoGanado, DESCANSO_MAX, limpiarLook, ALAS,
} from '../../mmo/js/data.js';
import { getEnv, verifyInitData, verifySupabaseUser, supabaseQuery, tg, getSolPriceUsd, getDuendePriceSeguro, SOL_DEV_WALLET } from '../api/lib.js';
import { MMO_URL } from '../api/telegram-bot.js';
import { Cueva3D } from './cueva3d.js';
import { Encargos } from './encargos.js';
import { Secundarias } from './secundarias.js';
import { Eventos3D } from './eventos3d.js';
import { Temporada } from './temporada.js';
import { Copias } from './copias.js';
import { VERSION as VERSION_JUEGO } from '../../mmo/js/data.js';   // va en 'bienvenido': el cliente viejo se recarga solo
import { Vincular } from './vincular.js';
import { rangoDe, enAbismo, islaEn } from '../../mmo/js/abismo3d.js';
import { Combate } from './combate.js';
import { Social, pub } from './social.js';
import { Mazmorras } from './mazmorras.js';
import { Hermandades } from './hermandades.js';
import { Tareas } from './tareas.js';
import { Profesiones } from './profesiones.js';
import { Amigos } from './amigos.js';
import { Duelos } from './duelos.js';
import { Chicha } from './chicha.js';
import { Retencion, diaNum } from './retencion.js';
import { metaHola, metaEvento } from './meta.js';
import { Salud } from './salud.js';
import { Eventos } from './eventos.js';
import { Pase } from './pase.js';
import { Torre } from './torre.js';
import { Expediciones } from './expediciones.js';
import { Dios } from './dios.js';
import { Viajes } from './viajes.js';
import { Mundo3D } from './mundo3d.js';
import { zonaEn as zonaEn3d } from '../../mmo/js/mundo3d.js';

const MAX_JUGADORES = 300;
const VISTA_2D = 1100, TOPE_2D = 40, LEJOS_2D = 450;   // px y filas: la foto 2D con mucha gente solo lleva a los cercanos
// Presupuesto de escrituras al storage (cupo diario): el progreso cada 60 s,
// solo la posicion cada 5 min (y siempre al cerrar), y en modo ahorro (salud.js) cada 3 min.
// Un reinicio del DO puede perder hasta 60 s de botin; compras, pedidos, retiros y herencia guardan al momento.
const GUARDAR_CADA_MS = 60000;
const GUARDAR_POS_MS = 5 * 60000;
const GUARDAR_AHORRO_MS = 180000;
const RANKING_CADA_MS = 60000;      // el ranking de niveles vive en memoria y se vuelca como mucho cada minuto
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

// IPv6 se agrupa por /64 (un solo bloque trae miles de direcciones); IPv4 igual.
function claveIp(ip) {
  if (!ip || !ip.includes(':')) return ip || '';
  const [a, b] = ip.toLowerCase().split('::');
  const izq = a ? a.split(':') : [];
  const der = b ? b.split(':') : [];
  const partes = b === undefined ? izq : [...izq, ...Array(Math.max(0, 8 - izq.length - der.length)).fill('0'), ...der];
  return partes.slice(0, 4).map(x => (parseInt(x, 16) || 0).toString(16)).join(':') + '::/64';
}
async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Prueba de trabajo de un invitado nuevo: un 'pow' tal que sha256('dq-pow:' + hora
// + ':' + token + ':' + pow) empiece por POW_CEROS ceros hex (~4000 intentos, unos
// 200 ms en un movil). Se acepta la hora de antes y la de despues (relojes desfasados).
const POW_CEROS = 3;
async function powValida(tok, pow) {
  if (typeof tok !== 'string' || !/^[a-f0-9]{32}$/.test(tok) || !Number.isSafeInteger(pow) || pow < 0) return false;
  const h = Math.floor(Date.now() / 3600000), ceros = '0'.repeat(POW_CEROS);
  for (const d of [0, -1, 1]) if ((await sha256hex('dq-pow:' + (h + d) + ':' + tok + ':' + pow)).startsWith(ceros)) return true;
  return false;
}
// Codigo de invitacion del hola: el ?ref= (o el guardado 14 dias en el navegador) y, si no, el de la cuenta web.
const refHola = (m, s) => typeof m.ref === 'string' && m.ref ? m.ref : (s.extraAuth && typeof s.extraAuth.ref === 'string' ? s.extraAuth.ref : '');
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
  return { id: idItem(), s, nv: Math.max(1, Math.round(nv)), r, b: statsItem(s, nv, r) };
}
// Estadisticas de una pieza: la base por su rareza (siempre igual) y, desde
// Raro, una linea extra al azar. Reforjar vuelve a llamar a esto.
function statsItem(s, nv, r) {
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
  return b;
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
// Segunda fila: avisar al jugador de cuando llega (plantilla, sin escribir nada).
const botonesPedido = codigo => [
  [{ text: '✅ Entregar', callback_data: 'mmoent:' + codigo }, { text: '❌ Anular', callback_data: 'mmoanu:' + codigo }],
  [{ text: '⏳ En 1 h', callback_data: 'mmo1h:' + codigo }, { text: '⏳ Mañana', callback_data: 'mmoman:' + codigo }],
];
// Recordatorios al dueño de un pedido pagado y sin entregar (solo avisos: la
// entrega sigue siendo manual). A los 30 min, 2 h y 6 h del pago.
const RECORDAR_PEDIDO_MS = [30 * 60000, 2 * 3600000, 6 * 3600000];
// Skins pagadas (Supabase) por tgId: se dan al entrar sin esperar a la red.
const SKINS_CACHE_MS = 10 * 60000;

// Doble salto: 11,5²/1,2 + 10²/1,2 ≈ 194 px; margen por los fotogramas.
const MAX_SALTO = 215;
// Pago confirmado mas de 2 min despues de que vencio el pedido (30 min): se pago
// con el precio de entonces y lo revisa el dueño (no se entrega solo).
const pagoTarde = (tx, desde) => !!(tx.tiempo && tx.tiempo > desde + PEDIDO_VIGENCIA_MS + 120000);
// Vigencia de un pedido. Stars pedido desde la web: 3 h, porque quien llega por un anuncio
// tiene que instalar Telegram y comprar Stars antes de pagar (el precio en Stars es fijo).
const vigenciaPd = x => x.metodo === 'yape' ? YAPE_VIGENCIA_MS : (x.metodo === 'stars' && !String(x.uidPago || x.uid || '').startsWith('tg:')) ? 3 * 3600000 : PEDIDO_VIGENCIA_MS;

export class MmoWorld {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.medirStorage();                // cuenta escrituras por prefijo (salud.js)
    this.sesiones = new Map();          // id de sesion -> sesion
    this.porUid = new Map();            // uid -> sesion
    // Cada "clave" es un mundo vivo con sus monstruos: un mapa abierto
    // ('noche') o una instancia privada de mazmorra ('cripta#a1b2'). Los
    // jugadores llevan la suya en s.k y los monstruos en o.cl.
    this.mundo = {};
    for (const id in MAPAS) if (!MAPAS[id].instancia) this.mundoK(id);
    this.sigBala = 1;
    // Los ids de sesion empiezan en un punto al azar en cada arranque: tras un
    // despliegue, el panel de dios con la lista vieja no apunta a otra persona.
    // (Por debajo de 2^31: los mensajes los leen con m.p | 0.)
    this.sigSesion = 1 + Math.floor(Math.random() * 1e6) * 1000;
    // Hora del arranque: los primeros 90 s (tras un despliegue reconectan todos a la vez) no cuenta el tope de entradas por IP.
    this.arranqueT = Date.now();
    // Rechazos por motivo desde el arranque (/interno/stats): para ver a quien dejan fuera los limites.
    this.rechazos = {};
    this.sigMon = 1;
    this.bucle = null;
    this.fondo = null;
    this.retiros = [];
    this.pedidos = [];
    this.ingresosSol = [];
    if (this.state.blockConcurrencyWhile) this.state.blockConcurrencyWhile(() => this.migrar());
  }

  // Migraciones de una sola vez sobre el almacenamiento del mundo.
  async migrar() {
    try {
      // Lo que vive en memoria se vuelve a leer (restaurar una copia tambien pasa por aqui).
      this._rankP = null; this.rankSucio = false; this._retDias = null; this._retSucios = null;
      await this.cargarMet();
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
      // Miembros de cada faccion y Temporada del Abismo (temporada.js).
      await this.cargarFacc();
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
      // Version nueva publicada: copia de todo antes de aceptar sesiones (copias.js; solo si cambio VERSION).
      if (!this.migrado) { this.migrado = true; await this.copiaPorVersion(); }
    } catch (e) { console.error('[MMO migrar]', e); }
  }

  async fetch(request) {
    try { return await this._fetch(request); }
    catch (e) { console.error('[MMO fetch]', e); return new Response('Error del servidor', { status: 500 }); }
  }

  async _fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/interno/')) return this.interno(request, url.pathname.slice(9));
    // Embudo de la carga (beacon ya validado por worker.js): retencion.js
    if (url.pathname === '/mmo/ev' && request.method === 'POST') return this.evRecibir(request);
    if (request.headers.get('Upgrade') !== 'websocket') {
      // Estado publico para la portada: conectados ahora y jugadores distintos
      // de hoy (este ultimo se recalcula como mucho cada minuto).
      if (!this.hoyCache || Date.now() - this.hoyCache.t > 60000) {
        let h = 0; try { h = await this.contarHoy(); } catch (e) {}
        this.hoyCache = { t: Date.now(), h };
      }
      // lag: ms de retraso del bucle; lleno: no entra gente nueva ahora (tope, lag o modo ahorro).
      const online = this.contarOnline();
      return new Response(JSON.stringify({ ok: true, online, hoy: this.hoyCache.h, lag: Math.round(this.lagEwma || 0), max: MAX_JUGADORES, lleno: online >= MAX_JUGADORES || this.lento() || this.degradado() }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (this.contarOnline() >= MAX_JUGADORES) return this.rechazarLleno('lleno', 'lleno');
    // Sockets que aun no se identifican: tope propio y por IP. Antes 300
    // sockets sin 'hola' llenaban el servidor y dejaban fuera a todos.
    const ip = claveIp(request.headers.get('CF-Connecting-IP') || '');
    // IPv6: ademas un tope por /48 (un solo bloque trae 65 536 /64 y con 13 se llenaba el servidor).
    const k48 = ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':' : '';
    let deIp = 0, sinIdIp = 0, de48 = 0; const sinId = [];
    for (const x of this.sesiones.values()) {
      if (!x.c) sinId.push(x);
      if (ip && x.ip === ip) { deIp++; if (!x.c) sinIdIp++; }
      if (k48 && x.ip.startsWith(k48)) de48++;
    }
    // 24 por IP: una casa, un colegio o un grupo de 10 en la misma wifi comparten IP (con 8 el noveno quedaba fuera).
    if (ip && (deIp >= 24 || sinIdIp >= 6 || de48 >= 60)) return this.rechazarLleno('ip', 'conexionesIp');
    if (sinId.length >= 40) {
      // Se echa al socket mudo mas viejo en vez de rechazar al nuevo: un jugador
      // real manda 'hola' nada mas abrir (antes, 40 sockets mudos dejaban fuera a todos).
      let viejo = null;
      for (const x of sinId) if (!x.autenticando && !x.cerrado && (!viejo || x.id < viejo.id)) viejo = x;
      if (!viejo) return this.rechazarLleno('ip', 'sinId');
      // Sin fatal: si era un jugador lento (movil en 3G) su cliente vuelve solo.
      this.rechazarSuave(viejo, 'Sin identificación', 1500, 'sinIdViejo');
    }
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    this.abrir(servidor, ip);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  contarOnline() { let n = 0; for (const s of this.sesiones.values()) if (s.c) n++; return n; }

  // Mundo lleno o demasiadas conexiones desde una red. Antes era un 503/429 sin
  // socket: el navegador solo ve un cierre mudo (1006), el jugador leia «Sin
  // conexion» y reintentaba a ciegas cada pocos segundos. Ahora se acepta el socket
  // solo para decir por que y cuando volver, y se cierra sin registrar sesion
  // (no ocupa plaza ni cuenta como sin identificar). motivo: 'lleno' | 'ip'.
  rechazarLleno(motivo, k) {
    this.contarRechazo(k);
    const on = this.contarOnline();
    // Con azar: los que esperan no vuelven todos en el mismo segundo.
    const ms = Math.round((motivo === 'lleno' ? 25000 : 15000) + Math.random() * 10000);
    const m = motivo === 'lleno' ? 'Servidor lleno (' + on + '/' + MAX_JUGADORES + '). Reintentamos solos en unos segundos.' : 'Muchos jugadores conectados desde tu red. Reintentamos solos en unos segundos.';
    const [cliente, servidor] = Object.values(new WebSocketPair());
    servidor.accept();
    try {
      servidor.send(JSON.stringify({ t: 'err', m, lleno: motivo, on, max: MAX_JUGADORES, reintentar: ms }));
      servidor.close(motivo === 'lleno' ? 4002 : 4429, motivo);
    } catch (e) {}
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // ── CONEXION ──
  abrir(ws, ip) {
    const s = { id: this.sigSesion++, ws, ip: ip || '', c: null, cuenta: 0, ventana: Date.now(), cerrado: false };
    this.sesiones.set(s.id, s);
    ws.addEventListener('message', ev => {
      this.recibir(s, ev.data).catch(e => { console.error('[MMO]', e); this.enviar(s, { t: 'err', m: 'Error del servidor' }); });
    });
    const cerrar = () => this.cerrar(s).catch(e => console.error('[MMO cerrar]', e));
    ws.addEventListener('close', cerrar);
    ws.addEventListener('error', cerrar);
    // A los 8 s se expulsa a quien no mando hola. A quien se esta verificando
    // (Supabase o Telegram lentos) no se le corta, pero tiene un tope de 30 s.
    setTimeout(() => { if (!s.c && !s.cerrado && !s.autenticando) this.rechazarSuave(s, 'Sin identificación', 1500, 'sinHola'); }, 8000);
    setTimeout(() => { if (!s.c && !s.cerrado) this.expulsar(s, 'Sin identificación'); }, 30000);
  }

  expulsar(s, motivo, extra) {
    this.enviar(s, { t: 'err', m: motivo, fatal: true, ...(extra || {}) });
    try { s.ws.close(4000, 'fin'); } catch (e) {}
    this.cerrar(s);
  }
  // Rechazo que no es culpa del jugador (servidor ocupado, otra pestaña entrando,
  // demasiadas entradas seguidas): sin fatal, el cliente reintenta solo pasado
  // 'reintentar' ms (con su propio azar) en vez de quedarse en la pantalla de error.
  rechazarSuave(s, motivo, ms, k, extra) {
    this.contarRechazo(k || 'suave');
    this.enviar(s, { t: 'err', m: motivo, reintentar: Math.max(500, Math.round(ms || 1500)), ...(extra || {}) });
    try { s.ws.close(4002, 'reintentar'); } catch (e) {}
    this.cerrar(s);
  }
  contarRechazo(k) {
    const r = this.rechazos || (this.rechazos = {});
    r[k] = (r[k] || 0) + 1;
  }

  async cerrar(s) {
    if (s.cerrado) return;
    s.cerrado = true;
    this.sesiones.delete(s.id);
    if (s.c) {
      if (this.porUid.get(s.c.uid) === s) this.porUid.delete(s.c.uid);
      // Un fallo al limpiar (grupo, mapa, mundo 3D) no impide guardar al jugador.
      try {
        this.desconectarDeGrupo(s);
        this.aClave(s.k, { t: 'pl', id: s.id }, s);
        this.caidaPorDesconexion(s);
        if (s.m3) this.olvidar3d(s); else this.olvidar(s);
        this.salirDeMundo(s);
      } catch (e) { console.error('[MMO cerrar]', e); }
      await this.guardar(s);
    }
    if (this.contarOnline() === 0 && this.bucle) { clearInterval(this.bucle); this.bucle = null; this.tickPrevT = 0; this.guardarHermsSucias(Infinity); this.volcarMemoria().catch(e => console.error('[MMO volcar]', e)); }
  }

  // Cerrar en el Abismo sobre el vacio o con un golpe enemigo reciente cuenta como caer
  // (antes era una huida gratis al pueblo: sin muerte, sin perder nada).
  caidaPorDesconexion(s) {
    if (s.m3 && !s.i3 && !s.muerto && !s.mant && s.p && enAbismo(s.p.x) && (!islaEn(s.p.x, s.p.z) || Date.now() - (s.pvpT || 0) < 10000)) {
      s.muerto = true;   // guardar() lo pasa a c.muerto: al volver revive en el pueblo con su coste
      if (islaEn(s.p.x, s.p.z)) s.c.muertoPvP = true;   // huida del PvP: como morir ante la otra faccion (sin perder XP)
    }
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
    // Solo el dueño puede mandar un mensaje grande: el archivo de una copia de seguridad.
    if (typeof data !== 'string' || (data.length > 4000 && !(s.dios === 'dueno' && data.length < 1300000 && data.startsWith('{"t":"dios","a":"subirCopia"')))) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    this.contarMsg(m.t, data.length);   // salud.js: mensajes por tipo y bytes

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
      case 'ignorar': return this.ignorar(s, m);
      case 'reportar': return this.reportar(s, m);
      case 'comprar': return this.comprar(s, m);
      case 'equipar': return this.equipar(s, m);
      case 'revivir': return this.revivir(s);
      case 'mision': return this.mision(s, m);
      case 'vincInfo': case 'vincCodigo': case 'vincUsar': case 'vincQuitar': return this.vincular(s, m);
      case 'avisoTgCod': return this.ofrecerAvisoTg(s, true);   // «Avísame por Telegram» (retencion.js)
      case 'regreso': return this.regreso(s);
      case 'ranking': return this.enviarRanking(s);
      case 'hab': return this.habilidad(s, m);
      case 'item': return this.item(s, m);
      case 'titulo': return this.ponerTitulo(s, m);
      case 'miNombre': return this.miNombre(s, m);   // dios.js: el invitado elige su nombre (1 vez)
      case 'wallet': return this.ponerWallet(s, m);
      case 'retirar': return this.retirar(s);
      case 'fondo': return this.enviar(s, { t: 'fondo', ...this.infoFondo() });
      case 'pedido': return this.pedido(s, m);
      case 'pedidoCancelar': return this.pedidoCancelar(s, m);
      case 'pedidoFirma': return this.pedidoFirma(s, m);
      case 'pedidoBuscar': return this.pedidoBuscar(s, m);
      case 'pedidoYapeOk': return this.pedidoYapeOk(s, m);
      case 'reclamoPedido': return this.reclamoPedido(s, m);
      case 'ev': return this.evCompra(s, m);   // pasos del embudo de compra que solo ve el cliente (retencion.js)
      case 'ping': return this.enviar(s, { t: 'pong', ts: m.ts });
      case 'visto': return this.buzonVisto(s, m);
      case 'dios': return this.dios(s, m);
      case 'viajar': return this.viajar(s, m);
      case 'irGrupo': return this.irConGrupo(s, m);
    }
  }

  // ── IDENTIDAD ──
  async hola(s, m) {
    if (s.c || s.autenticando) return;
    s.autenticando = true;
    // Huella del dispositivo (localStorage del cliente): con ella se banea o
    // silencia a un invitado en IPv4 sin tocar al resto de la IP (CGNAT movil).
    s.dev = typeof m.dev === 'string' && /^[a-f0-9]{32}$/.test(m.dev) ? m.dev : '';
    // Tope de entradas por IP: ~200 por minuto (una IP de Claro, Movistar, Entel
    // o Bitel la comparten cientos de moviles). Solo suman los invitados y las
    // identidades que fallan (cada uno puede escribir en el storage); las cuentas
    // verificadas tienen su propio tope por uid mas abajo. Los primeros 90 s tras
    // el arranque no cuentan: tras un despliegue reconectan todos a la vez.
    const ahoraH = Date.now();
    let rIp = null;
    if (s.ip && ahoraH - (this.arranqueT || 0) > 90000) {
      this.holaIp = this.holaIp || new Map();
      rIp = this.holaIp.get(s.ip);
      if (!rIp || ahoraH - rIp.t > 60000) { rIp = { t: ahoraH, n: 0 }; this.holaIp.set(s.ip, rIp); }
      if (rIp.n >= 200) { s.autenticando = false; this.rechazarSuave(s, 'Demasiadas reconexiones desde tu red. Reintentando…', Math.min(20000, Math.max(3000, 60000 - (ahoraH - rIp.t))), 'holaIp'); return; }
      if (this.holaIp.size > 5000) for (const [k, v] of this.holaIp) if (ahoraH - v.t > 60000) this.holaIp.delete(k);
    }
    // El bucle va con lag alto sostenido (salud.js): no entra nadie mas hasta que se alivie.
    // Sin fatal: el cliente reintenta solo en 15-30 s (con azar, para que no vuelvan todos a la vez).
    if (this.lento()) { s.autenticando = false; this.rechazarSuave(s, 'El servidor está muy lleno ahora mismo. Reintentando en unos segundos…', 15000 + Math.random() * 15000, 'lag'); return; }
    // Publicando una version (copias.js, mantenimiento): ya se guardo a todos; se vuelve a entrar con la nueva.
    if (this.mantHasta > ahoraH) { s.autenticando = false; this.rechazarSuave(s, 'Actualizando el mundo… vuelves solo en unos segundos.', 20000 + Math.random() * 10000, 'mant'); return; }
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
          // Codigo de invitacion guardado al registrarse (vale aunque confirme el correo en otro aparato).
          const refMeta = u.user_metadata && u.user_metadata.ref;
          if (typeof refMeta === 'string') extra.ref = refMeta;
          // Token del invitado guardado al crear la cuenta (signUp, dq_inv): confirmar el
          // correo en otro navegador ya no deja atras al duende. Igual se pregunta (heredar).
          const invMeta = u.user_metadata && u.user_metadata.dq_inv;
          if (typeof invMeta === 'string' && /^[a-f0-9]{32}$/.test(invMeta)) extra.inv = invMeta;
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
      if (rIp) rIp.n++;
      this.contarRechazo('auth');
      this.enviar(s, { t: 'err', m: 'No se pudo verificar tu identidad.', fatal: true, auth: String(a.k || '') });
      try { s.ws.close(4000, 'auth'); } catch (e) {}
      this.cerrar(s);
      return;
    }
    if (s.cerrado) return;
    if (rIp && uid.startsWith('inv:')) rIp.n++;
    // Tope por cuenta: 10 entradas por minuto (un bucle de recargas no gasta el
    // cupo de escrituras de todos, y no castiga a la IP compartida).
    // (Solo conexiones reales con IP: el arnes reconecta la misma cuenta muchas veces.)
    this.holaUid = this.holaUid || new Map();
    let rU = this.holaUid.get(uid);
    if (!rU || ahoraH - rU.t > 60000) { rU = { t: ahoraH, n: 0 }; this.holaUid.set(uid, rU); }
    if (s.ip && ++rU.n > 10) { s.autenticando = false; this.rechazarSuave(s, 'Demasiadas reconexiones seguidas. Reintentando…', Math.min(20000, Math.max(3000, 60000 - (ahoraH - rU.t))), 'holaUid'); return; }
    if (this.holaUid.size > 5000) for (const [k, v] of this.holaUid) if (ahoraH - v.t > 60000) this.holaUid.delete(k);
    // Cuentas vinculadas (vincular.js): Telegram y correo entran al mismo duende.
    const prin = await this.uidPrincipal(uid);
    if (prin !== uid) { s.uidAuth = uid; uid = prin; }
    const ban = await this.baneado(uid);
    if (ban) { s.autenticando = false; this.expulsar(s, 'Tu cuenta está baneada' + (ban.hasta ? ' hasta el ' + new Date(ban.hasta).toLocaleString('es', { timeZone: 'America/Lima' }) : '') + (ban.motivo ? ': ' + ban.motivo : '.')); return; }
    if (uid.startsWith('inv:') && s.ip) {
      // Un invitado baneado no vuelve con otro token desde el mismo dispositivo
      // (huella 'dev') ni, en IPv6, desde el mismo /64 (como mucho 24 h, dios.js).
      // En IPv4 ya no se mira la IP: la comparten cientos de moviles por CGNAT.
      const hb = Math.max(0, ...this.clavesBloqueo(s).map(k => (this.mod.banIp && this.mod.banIp[k]) || 0));
      if (hb && hb > Date.now()) { s.autenticando = false; this.expulsar(s, 'Tu conexión está baneada por un rato. Inicia sesión con tu cuenta.'); return; }
      // Cupo de invitados: las ultimas 60 plazas quedan para cuentas de Telegram o correo
      // (antes unos pocos /64 con tokens de invitado llenaban el servidor y nadie mas entraba).
      let invs = 0;
      for (const x of this.sesiones.values()) if (x.c && x.c.uid.startsWith('inv:')) invs++;
      if (invs >= MAX_JUGADORES - 60) { s.autenticando = false; this.expulsar(s, 'El servidor está lleno de invitados. Entra con tu correo o Telegram: las últimas plazas son para cuentas.', { lleno: 'inv', on: this.contarOnline(), max: MAX_JUGADORES }); return; }
    }
    s.extraAuth = extra;
    // Una cuenta solo puede estar ENTRANDO por una sesion a la vez. Antes, dos
    // pestañas que mandaban el hola juntas pasaban las dos la comprobacion de
    // "misma cuenta abierta" (hay awaits en medio) y quedaban dos copias del
    // personaje: la segunda en guardar pisaba a la primera (se podia retirar
    // mTON y recuperarlo, o contar doble la XP semanal).
    this.entrando = this.entrando || new Map();
    // Sin fatal: casi siempre es la misma pestaña reconectando antes de que el servidor cierre la anterior.
    // No gasta el tope por cuenta (no escribe nada): con Supabase lento, los reintentos
    // cada 1,5 s de la misma pestaña llegaban a 10 y la dejaban fuera un minuto.
    if (this.entrando.has(uid)) { if (s.ip && rU.n > 0) rU.n--; s.autenticando = false; this.rechazarSuave(s, 'Tu cuenta ya está entrando. Reintentando…', 1500, 'entrando'); return; }
    this.entrando.set(uid, s);
    // Premios o devoluciones que llegan mientras entra esperan a que termine (pjDe).
    let listo; s.entrandoP = new Promise(r => { listo = r; });
    try { await this.holaCuenta(s, m, env, uid, nombre, pagadas); }
    finally { if (this.entrando.get(uid) === s) this.entrando.delete(uid); listo(); }
  }

  async holaCuenta(s, m, env, uid, nombre, pagadas) {
    // El socket se cerro mientras se verificaba: no se expulsa a la sesion buena que ya esta jugando.
    if (s.cerrado) return;

    // Misma cuenta abierta en otra pestaña: la vieja se cierra.
    const vieja = this.porUid.get(uid);
    // Antes de guardarla se aplica la regla del Abismo: abrir otra pestaña no es una huida gratis.
    if (vieja && vieja !== s) { this.caidaPorDesconexion(vieja); await this.guardar(vieja); vieja.noGuardar = true; this.expulsar(vieja, 'Tu duende se abrió en otro dispositivo o pestaña.', { dup: 1 }); }

    let c = await this.state.storage.get('c:' + uid);
    // Invitado recien creado que aun no se escribio (guardar, diferirT) y vuelve a
    // entrar (red movil, volver de otra app): recupera su duende de la memoria en
    // vez de empezar otro de cero (y sin contar otra alta ni otra invitacion).
    let diferido = 0;
    if (!c && this.diferidos && this.diferidos.has(uid)) {
      const d = this.diferidos.get(uid); this.diferidos.delete(uid);
      if (Date.now() - d.t < 600000) { c = d.c; diferido = d.t; }
    }
    let heredado = false;
    // Quien jugo como invitado y luego entra con su cuenta (web o Telegram)
    // no empieza de cero: si la cuenta aun no tiene personaje, hereda el del
    // invitado (el token es secreto: solo lo tiene quien jugo con el).
    // Nunca en silencio: un enlace con la sesion de Telegram de otro se llevaba
    // el duende. Solo con heredar:true (el jugador lo elige con un boton).
    // Llevar mi duende con codigo (vincular.js): el duende vacio de la cuenta se archiva y hereda sin preguntar otra vez.
    const porCod = !uid.startsWith('inv:') && typeof m.vcod === 'string' && m.vcod ? await this.tomarCodigoInv(s, uid, c, m.vcod) : '';
    if (porCod) c = null;
    if (s.cerrado) return;
    const tokInv = /^[a-f0-9]{32}$/.test(m.inv || '') ? m.inv : (s.extraAuth && s.extraAuth.inv) || '';
    if (!c && !uid.startsWith('inv:') && (porCod || tokInv)) {
      const uidInv = porCod || 'inv:' + (await sha256hex('dq-mmo:' + tokInv)).slice(0, 24);
      // El invitado abierto en otra pestaña se guarda y se saca (antes la herencia fallaba en silencio).
      if (!porCod && uidInv !== uid && this.porUid.has(uidInv) && !this.entrando.has(uidInv)) await this.soltarInvitado(uidInv, 'Entraste con tu cuenta en otra pestaña: allí puedes pasarle este duende.');
      if (s.cerrado) return;
      const previo = uidInv !== uid && await this.state.storage.get('c:' + uidInv);
      // Un invitado baneado no se lava creando una cuenta. Los bots de prueba no se heredan.
      const puede = previo && !UIDS_PRUEBA.has(uidInv) && !this.porUid.has(uidInv) && !this.entrando.has(uidInv) && !(await this.baneado(uidInv));
      // Sin respuesta aun y con progreso: se pregunta y se corta; el cliente vuelve con heredar true o false.
      if (puede && !porCod && typeof m.heredar !== 'boolean' && (previo.nivel || 1) > 1) {
        this.enviar(s, { t: 'heredar', nv: previo.nivel, inv: previo.nombre || '', cuenta: nombre || '', k: uid.split(':')[0] });
        try { s.ws.close(4001, 'heredar'); } catch (e) {}
        this.cerrar(s);
        return;
      }
      if (puede && (porCod || m.heredar === true)) {
        // Mientras se hereda, el invitado no puede entrar (ni otra cuenta heredar):
        // leeria el personaje que se esta moviendo y al guardarlo quedaria duplicado.
        this.entrando.set(uidInv, s);
        try {
          const antes = previo.nombre;
          c = { ...previo, uid, nombre: await this.nombreLibre(nombre, uid, this.calcularDios({ c: { uid } }, s.extraAuth) === 'dueno') };
          nombre = c.nombre;
          await this.reservarNombre(c, antes);
          // Sin await entre las dos: el storage del DO las manda en un solo lote
          // atomico. Antes se borraba el del invitado y el nuevo no se escribia
          // hasta el guardar del final: un fallo o reinicio en medio lo perdia.
          this.state.storage.put('c:' + uid, c);
          await this.state.storage.delete('c:' + uidInv);
          heredado = true;
          // Quien lo invito sigue contando (nadie se invita a si mismo: si el codigo era de esta cuenta, se quita).
          // Sin invitador y con menos de 7 dias de duende: vale el ?ref= que trae ahora.
          if (c.invitadoPor === uid) delete c.invitadoPor;
          if (!c.invitadoPor && Date.now() - (c.creado || 0) < 7 * 86400000) await this.anotarInvitacion(c, refHola(m, s));
          if (c.invitadoPor && this.refContar) this.refContar('refCuenta');
          this.renombrarContacto(uidInv, uid);
          // El silencio del invitado sigue en la cuenta nueva (si no, registrarse lo lavaba).
          const mod = await this.cargarMod();
          if ((mod.mute[uidInv] || 0) > Date.now()) { mod.mute[uid] = Math.max(mod.mute[uid] || 0, mod.mute[uidInv]); this.guardarMod(); }
          // Su ficha de hermandad y su codigo de amigo pasan al uid nuevo
          // (si no, la hermandad quedaba con un miembro o lider fantasma).
          const h = c.herm && await this.hermandad(c.herm);
          if (h && h.miembros[uidInv]) { h.miembros[uid] = h.miembros[uidInv]; delete h.miembros[uidInv]; await this.guardarHerm(h); }
          if (c.ref && (await this.state.storage.get('ref:' + c.ref)) === uidInv) await this.state.storage.put('ref:' + c.ref, uid);
          // «Invita a un amigo» sigue valiendo: sus primos apuntan al uid nuevo (si no, el premio de Nv 10
          // buscaba el 'inv:' borrado) y en «Mis invitados» de quien lo invito tambien (aunque este desconectado).
          try {
            for (const a of (c.invitados || []).slice(-30)) {
              if (!a || !a.u || a.u === uid || a.u === uidInv) continue;
              const { s: o, c: ci } = await this.pjDe(a.u);
              if (ci && ci.invitadoPor === uidInv) { ci.invitadoPor = uid; if (o) o.sucio = true; else await this.state.storage.put('c:' + a.u, ci); }
            }
            if (c.invitadoPor && c.invitadoPor !== uid && c.invitadoPor !== uidInv) {
              const { s: o, c: co } = await this.pjDe(c.invitadoPor);
              if (co && Array.isArray(co.invitados)) { let cambio = false; for (const a of co.invitados) if (a && a.u === uidInv) { a.u = uid; cambio = true; } if (cambio) { if (o) o.sucio = true; else await this.state.storage.put('c:' + c.invitadoPor, co); } }
            }
          } catch (e) { console.error('[MMO herencia invitados]', e); }
          await this.migrarUid(uidInv, uid, nombre);   // rankings (vincular.js); la herencia se guarda al momento
        } finally { if (this.entrando.get(uidInv) === s) this.entrando.delete(uidInv); }
      }
    }
    const nuevo = !c;
    // Modo ahorro (cupo de escrituras al 80%, salud.js): sin invitados nuevos hasta mañana.
    if (!c && uid.startsWith('inv:') && this.degradado()) { this.expulsar(s, 'Hoy el servidor está a tope de invitados nuevos. Inicia sesión con Telegram o tu correo para entrar, o vuelve mañana.'); return; }
    if (!c && uid.startsWith('inv:') && s.ip) {
      // Cada invitado nuevo deja un personaje guardado para siempre: como
      // mucho 30 por IP y hora (antes, un bucle llenaba el cupo de escrituras).
      const h = Math.floor(Date.now() / 3600000);
      this.altasIp = this.altasIp && this.altasIp.h === h ? this.altasIp : { h, n: new Map(), total: 0 };
      const n = (this.altasIp.n.get(s.ip) || 0) + 1;
      // IPv6: ademas un tope por /48 (un solo bloque trae 65 536 /64).
      const k48 = s.ip.includes(':') ? s.ip.split(':').slice(0, 3).join(':') + '::/48' : '';
      const n48 = k48 ? (this.altasIp.n.get(k48) || 0) + 1 : 0;
      // 300 por IP y hora: una IPv4 de operadora movil (CGNAT) la comparten cientos
      // de personas que no se conocen (con 30, y con el antiguo "solo el primero de
      // cada IP pasado 150", el segundo peruano de cada antena quedaba fuera).
      if (n > 300 || n48 > 600) { this.contarRechazo('altasIp'); this.expulsar(s, 'Demasiados personajes nuevos desde tu conexión. Intenta en una hora o inicia sesión.'); return; }
      // Pasadas 30 altas por IP (o 150 en total) se pide una prueba de trabajo
      // ligera (~200 ms una sola vez en el movil): crear invitados en masa cuesta CPU.
      if ((n > 30 || n48 > 60 || this.altasIp.total >= 150) && !(await powValida(m.auth && m.auth.tok, m.pow))) {
        if (s.cerrado) return;
        this.rechazarSuave(s, 'Preparando tu duende…', 300, 'pow', { pow: POW_CEROS });
        return;
      }
      if (s.cerrado) return;
      // Con 1000 por hora se corta del todo (cupo de escrituras de todos).
      if (this.altasIp.total >= 1000) { this.contarRechazo('altasTotal'); this.expulsar(s, 'Hay demasiados personajes nuevos ahora mismo. Intenta en un rato o inicia sesión.'); return; }
      if (k48) this.altasIp.n.set(k48, n48);
      this.altasIp.n.set(s.ip, n);
      this.altasIp.total++;
      // Este invitado no se guarda hasta que llegue a Nv 2 o juegue 2 min (guardar()):
      // quien entra y se va al momento no gasta escrituras ni deja un personaje para siempre.
      s.diferirT = Date.now();
    }
    if (diferido) s.diferirT = diferido;
    if (!c) {
      // Nombre unico y sin imitar al equipo: un invitado ya no puede entrar
      // con el nombre de otro jugador ni como "Admin" o "El Duende".
      const libre = await this.nombreLibre(nombre, uid, this.calcularDios({ c: { uid } }, s.extraAuth) === 'dueno');
      c = personajeNuevo(uid, libre);
      await this.anotarInvitacion(c, refHola(m, s));
      if (c.invitadoPor && this.refContar) { this.refContar('refLlega'); if (!uid.startsWith('inv:')) this.refContar('refCuenta'); }
    }
    await this.reservarNombre(c);
    c.skins = c.skins || ['comun']; c.armas = c.armas || ['katana']; c.pw = c.pw || {};
    c.mis = c.mis || { i: 0, p: 0 };
    c.forja = c.forja || {};
    c.mton = c.mton || 0; c.mtonTotal = c.mtonTotal || 0; c.wallet = c.wallet || null;
    c.eq = c.eq || {}; c.bolsa = c.bolsa || []; c.logros = c.logros || []; c.titulo = c.titulo || ''; c.mundiales = c.mundiales || 0;
    for (const p of PODERES) if (typeof c.pw[p.id] !== 'number') c.pw[p.id] = 0;
    if (!Object.hasOwn(CLASES, c.clase || '')) c.clase = null;
    // Skin o arma que ya no existe en data.js (renombrada, quitada o de una copia vieja): se vuelve a la basica.
    if (!Object.hasOwn(SKINS, c.skin || '')) c.skin = 'comun';
    if (!Object.hasOwn(ARMAS, c.arma || '')) c.arma = 'katana';
    // Las mazmorras son instancias que no sobreviven a una desconexion: se
    // vuelve a la puerta (en el pueblo).
    // (Si la instancia sigue abierta se le devuelve a ella mas abajo.)
    const instGuardada = MAPAS[c.mapa] && MAPAS[c.mapa].instancia && !c.muerto ? { mapa: c.mapa, x: c.x || 150 } : null;
    if (!MAPAS[c.mapa] || MAPAS[c.mapa].instancia) { c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn; }

    // Con cuentas vinculadas, las compras de la cuenta de Telegram cuentan aunque entres con el correo.
    const tgPropio = c.uid.startsWith('tg:');
    const tgDe = tgPropio ? c.uid.slice(3) : c.vinc && c.vinc.tg ? c.vinc.tg.slice(3) : null;
    if (tgDe) pagadas = { ...(pagadas || {}), tgId: tgDe };
    // Skins pagadas con dinero real en el juego principal: se regalan aqui.
    // Ya no se espera a Supabase para entrar (si se colgaba, el "bienvenido"
    // tardaba lo que tardara): con la cache de 10 min por tgId se dan al
    // momento; si no, se piden en segundo plano (tope 2,5 s) y llegan con un aviso.
    const cacheSk = pagadas && pagadas.tgId && this.cacheSkins ? this.cacheSkins.get(pagadas.tgId) : null;
    const edadSk = cacheSk ? Date.now() - cacheSk.t : Infinity;
    const regaladas = edadSk < SKINS_CACHE_MS ? this.darSkinsPagadas(c, cacheSk.l, tgPropio, tgDe) : [];
    // Pasado 1 min se vuelve a preguntar igual (una skin recien entregada no espera 10 min).
    const pSkins = pagadas && edadSk > 60000 ? Promise.race([this.skinsPagadas(env, pagadas), new Promise(r => setTimeout(() => r(null), 2500))]) : null;

    // Antes de la comprobacion de abajo: desde s.c=c hasta porUid.set no puede haber awaits
    // (si se cerrara ahi, cerrar() no lo quita de porUid y quedaria de fantasma).
    await this.cargarMod();
    // Si el socket se cerro durante las esperas de arriba, cerrar() no limpio nada
    // (s.c era null): no se le mete en porUid ni en el mapa (quedaria de fantasma).
    // El personaje nuevo o heredado se guarda igual (el del invitado ya se borro).
    if (s.cerrado) {
      if ((nuevo && !s.diferirT) || heredado) { try { await this.state.storage.put('c:' + uid, c); } catch (e) { console.error('[MMO guardar]', e); } }
      else if (diferido) this.diferidos.set(uid, { c, t: diferido });
      return;
    }
    s.c = c;
    s.dios = this.calcularDios(s, s.extraAuth);
    s.diosModo = {};
    s.st = this.stats(c);
    // Se guarda la vida y si estaba muerto: si no, cerrar la pestaña justo
    // antes de morir te devolvia con la vida llena en el mismo sitio.
    if (c.muerto) {
      // Igual que revivir(): hasta Nv 10 sin perder XP y en la entrada de la zona.
      const novato = c.nivel < 10 && MAPAS[c.mapa] && MAPAS[c.mapa].zona && c.mapa !== 'coliseo';
      if (c.nivel >= 10 && !c.muertoPvP) c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
      delete c.muertoPvP;
      c.oro -= Math.min(c.oro, costoReparacion(c.nivel));   // cerrar estando muerto no se salta la reparacion
      c.muerto = false;
      if (novato) c.x = 150; else { c.mapa = 'pueblo'; c.x = MAPAS.pueblo.spawn; }
      c.p3 = null;   // en ORIGINS tambien: al pueblo, no donde caiste (cerrar Telegram muerto revivia alli gratis)
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
    this.temporadaA(); this.cobrarTemporada(s);   // premios de la temporada del Abismo que cerro
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
    s.iab = m.iab === 1;   // navegador interno de Facebook/Instagram: su alta y su D1 aparte en /mmostats
    // Alta de Telegram que vino de un /start ad_<campaña>: cuenta como 'tg' (salvo meta/ref, mas concretos).
    let srcAlta = m.src, campTg = '';
    if (nuevo && uid && uid.startsWith('tg:') && srcAlta !== 'meta' && srcAlta !== 'ref') {
      // Se usa una vez y se borra (no se acumulan claves tgorg: en el storage).
      try { const k = 'tgorg:' + uid.slice(3), o = await this.state.storage.get(k); if (o) { this.state.storage.delete(k); if (Date.now() - (o.t || 0) < 30 * 86400000) { srcAlta = 'tg'; campTg = o.c; } } } catch (e) {}
    }
    this.retEntrar(s, nuevo, srcAlta, m.camp || campTg);   // src: de donde llego (origen.js); camp: utm_campaign o /start ad_; solo cuentan en el alta
    metaHola(this.env, c, m);   // clic del anuncio de Meta (fbc) si acepto la medicion y hay META_*: functions/mmo/meta.js
    if (nuevo || heredado || login) await this.guardar(s);
    if (s.cerrado) return;   // cerrado durante el guardado: cerrar() ya limpio todo

    c.en3d = m.modo === '3d';   // las tareas que solo existen en CLASSIC (expediciones, Torre) no le tocan en ORIGINS
    this.enviar(s, { t: 'bienvenido', id: s.id, yo: this.datosPropios(s), nuevo, heredado, regaladas, on: this.contarOnline(), ver: VERSION_JUEGO });
    // Las skins pagadas que llegan despues (Supabase lento o sin cache).
    if (pSkins) pSkins.then(l => {
      if (!l || s.cerrado || s.c !== c) return;
      const nuevas = this.darSkinsPagadas(c, l, tgPropio, tgDe);
      if (!nuevas.length) return;
      s.sucio = true;
      this.enviar(s, { t: 'toast', m: '🎁 Skins de tu cuenta desbloqueadas: ' + nuevas.map(k => SKINS[k].nombre || k).join(', '), ok: true });
      this.actualizarYo(s);
      this.refrescarApariencia(s);
    }).catch(e => console.error('[MMO skinsPagadas]', e));
    if (login) { this.enviar(s, { t: 'login', ...login }); this.revisarLogros(s, true); }   // titulos de racha 7/14/21
    if (login && login.racha === 2) this.ofrecerAvisoTg(s).catch(() => {});   // «Avísame por Telegram» (web e invitados)
    this.buzonEnviar(s).catch(e => console.error('[MMO buzon]', e));   // "Mientras no estabas" y compra entregada
    const tp = temporadaDe();
    if (ambulanteActivo() && c.nivel >= 15) this.enviar(s, { t: 'toast', m: 'Mercader ambulante en el pueblo este fin de semana: colores y una mascota exclusivos (pestaña «Ambulante»).', ok: true });
    // Aviso del evento: una vez por dia de Lima (no en cada reconexion).
    // El ultimo dia dice «HOY» y, si el siguiente empieza enseguida, lo anuncia.
    const ahoraT = Date.now();
    const diaT = new Date(ahoraT - 5 * 3600000).toISOString().slice(0, 10);
    if (tp && c.tpAvisoD !== diaT) {
      c.tpAvisoD = diaT; s.sucio = true;
      const ultimo = tp.fin - ahoraT < 86400000;
      const hasta = ultimo ? 'HOY a medianoche (¡último día!)' : 'el ' + tp.hasta;
      const dto = tp.descuento && ultimo ? ` Los disfraces de la mascota cuestan ${Math.round(tp.descuento * 100)}% menos de oro en la tienda solo hasta esta noche.` : '';
      const sig = TEMPORADAS.filter(x => x.ini >= tp.fin - 60000 && x.ini - tp.fin < 3 * 86400000).sort((a, b) => a.ini - b.ini)[0];
      const fechaSig = sig ? new Date(sig.ini).toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'America/Lima' }) : '';
      const tras = sig && tp.fin - ahoraT < 3 * 86400000 ? ` Y desde el ${fechaSig} llega ${sig.emoji} ${sig.nombre}.` : '';
      this.enviar(s, { t: 'toast', m: `${tp.nombre}: hasta ${hasta} los monstruos sueltan ${tp.cosas}; con 50 ganas 3.000 de oro y un título; con 200, 12.000 de oro y otro título. Llevas ${c[tp.campo] || 0}.${dto}${tras}`, ok: true });
    } else if (!tp) {
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
    if (nuevo && c.invitadoPor) this.alLlegarInvitado(s).catch(e => console.error('[MMO invitado]', e));
    // Ya era Nv 10 de invitado (o confirmo su correo despues): el premio de amigo se paga al entrar con su cuenta.
    else if (c.invitadoPor && !c.refPagado) this.revisarAmigo(s).catch(e => console.error('[MMO amigo]', e));
    if (instGuardada && !s.m3) this.volverAInstancia(s, instGuardada.mapa, instGuardada.x);
    this.reponerElixires(s);
    // Lo que se dijo mientras no estaba (social.js), antes del mensaje del dia.
    if (c.herm) await this.hermandad(c.herm);
    if (s.cerrado) return;
    // async: la primera vez carga del storage el historial del general (sobrevive al dormirse el servidor).
    await this.enviarHistorialChat(s, salidaAntes).catch(e => console.error('[MMO chatHist]', e));
    if (s.cerrado) return;
    await this.cargarHermandadDe(s);
    if (s.cerrado) return;
    if (c.herm) this.refrescarApariencia(s);
    this.revisarLogros(s);
    if (!this.bucle) this.bucle = setInterval(() => this.tick(), TICK_MS);
  }

  // Da al personaje las skins de la lista que aun no tiene; devuelve las nuevas.
  darSkinsPagadas(c, extra, tgPropio, tgDe) {
    const regaladas = [...new Set(extra)].filter(k => typeof k === 'string' && Object.hasOwn(SKINS, k) && !c.skins.includes(k));
    c.skins.push(...regaladas);
    // Las que llegan por una cuenta de Telegram VINCULADA (no propia) se apuntan:
    // al desvincularla se retiran (si no, vincular/desvincular las copiaba a infinitos duendes).
    if (!tgPropio && tgDe && regaladas.length) c.skinsTg = [...new Set([...(c.skinsTg || []), ...regaladas])];
    return regaladas;
  }
  // null si Supabase fallo (se cuenta en fallosSupabase, se ve en el Modo Dios).
  async skinsPagadas(env, p) {
    if (!env.HAS_SERVICE_KEY) return [];
    try {
      if (p.tgId) {
        const d = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${encodeURIComponent(p.tgId)}&select=skin_id`);
        if (!Array.isArray(d)) { this.fallosSupabase = (this.fallosSupabase || 0) + 1; return null; }
        const l = d.map(r => r.skin_id);
        this.cacheSkins = this.cacheSkins || new Map();
        this.cacheSkins.set(p.tgId, { t: Date.now(), l });
        if (this.cacheSkins.size > 3000) for (const [k, v] of this.cacheSkins) if (Date.now() - v.t > SKINS_CACHE_MS) this.cacheSkins.delete(k);
        return l;
      }
      // Cuentas web: ya NO se regalan por profiles.wallet_solana. Ese campo lo
      // escribe el propio usuario sin probar que la wallet es suya, y bastaba
      // con poner la de un comprador (se ve en Solscan) para llevarse sus
      // skins (auditoria del 22-oct). Las ya regaladas siguen en el
      // personaje; las compras web nuevas las entrega el dueño (Modo Dios).
    } catch (e) { this.fallosSupabase = (this.fallosSupabase || 0) + 1; return null; }
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
  // Parte del daño de s en o como si nadie llevara skin (el ataque extra de
  // una skin de pago no acerca al umbral de mTON de los jefes).
  parteJusta(o, s) {
    let tot = 0, mio = 0;
    for (const [id, d] of o.dano) {
      const x = this.sesiones.get(id);
      const f = x && x.c && x.st ? Math.max(1, x.st.atk / Math.max(1, this.statsSinSkin(x).atk)) : 1;
      tot += d / f; if (id === s.id) mio = d / f;
    }
    return tot ? mio / tot : 0;
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
    // Cada cambio escribe 3 veces en el storage: como mucho uno cada 10 s por cuenta.
    if (!this.ritmoSol(c.uid, 'w', 10000)) return this.enviar(s, { t: 'toast', m: 'Espera unos segundos antes de cambiar de wallet.' });
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
    for (const x of this.pedidos) if (x.estado === 'esperando_pago' && ahora - x.creado > vigenciaPd(x)) { x.estado = 'vencido'; this.hitoCompra(null, 'cad', x); }   // caducado sin pagar: embudo de compra
    // Yape vence a las 24 h de crearse: se guarda 24 h mas para que quien yapeo al final aun pueda mandar su operacion.
    this.pedidos = this.pedidos.filter(x => x.estado !== 'vencido' || ahora - x.creado < (x.metodo === 'yape' ? YAPE_VIGENCIA_MS + 86400000 : 86400000));
    let sobran = this.pedidos.length - 300;
    if (sobran > 0) this.pedidos = this.pedidos.filter(x => !(sobran > 0 && (x.estado === 'entregado' || x.estado === 'anulado' || x.estado === 'vencido') && sobran-- > 0));
    await this.state.storage.put('pedidos', this.pedidos);
    await this.alarmaPedidos();
  }
  // Cuando toca el proximo recordatorio al dueño de un pedido pagado sin
  // entregar (0 si ninguno). pd.recordado = cuantos de RECORDAR_PEDIDO_MS ya
  // se enviaron; pd.recordarEn = el que pidio el dueño con "⏳ En 1 h / Mañana".
  proximoRecordatorioPedido() {
    let prox = 0;
    for (const x of this.pedidos) {
      if ((x.estado !== 'pagado' && x.estado !== 'por_verificar') || !x.pagadoEn) continue;
      const t = x.recordarEn || ((x.recordado || 0) < RECORDAR_PEDIDO_MS.length ? x.pagadoEn + RECORDAR_PEDIDO_MS[x.recordado || 0] : 0);
      if (t && (!prox || t < prox)) prox = t;
    }
    return prox;
  }
  // Adelanta la alarma del objeto (la de cada hora, retencion.js) si un
  // recordatorio toca antes. alarm() la vuelve a poner con programarAlarma().
  async alarmaPedidos() {
    const st = this.state.storage;
    const prox = this.proximoRecordatorioPedido();
    if (!prox || !st.setAlarm || !st.getAlarm) return;
    try {
      const actual = await st.getAlarm();
      if (!actual || actual > prox) await st.setAlarm(Math.max(prox, Date.now() + 5000));
    } catch (e) { console.error('[MMO alarma pedidos]', e); }
  }
  // Lo llama alarm(): avisa al dueño (solo a el) de los pedidos que siguen sin
  // entregar. Nunca entrega nada: los botones son los mismos del primer aviso.
  async recordarPedidos() {
    const ahora = Date.now();
    let n = 0, cambio = false;
    for (const x of this.pedidos) {
      if ((x.estado !== 'pagado' && x.estado !== 'por_verificar') || !x.pagadoEn) continue;
      const r = x.recordado || 0;
      const pedido = !!x.recordarEn && x.recordarEn <= ahora;
      const toca = pedido || (!x.recordarEn && r < RECORDAR_PEDIDO_MS.length && ahora >= x.pagadoEn + RECORDAR_PEDIDO_MS[r]);
      if (!toca) continue;
      // Pagados hace mas de 24 h sin recordatorio (los de antes de esta version):
      // se marcan sin mensaje, si no al publicar llegaria una rafaga. Siguen en /pedidos.
      if (!pedido && ahora - x.pagadoEn > 86400000) { x.recordado = RECORDAR_PEDIDO_MS.length; cambio = true; continue; }
      if (n >= 5) break;   // tope de mensajes por alarma (subpeticiones: la tanda de avisos ya usa ~40); el resto, en la siguiente
      n++;
      // Se marca antes de enviar: aunque falle, no se repite en bucle. Los
      // tramos que ya pasaron (servidor caido, pedido viejo) no se mandan de golpe.
      if (pedido) delete x.recordarEn;
      else { let k = r; while (k < RECORDAR_PEDIDO_MS.length && ahora >= x.pagadoEn + RECORDAR_PEDIDO_MS[k]) k++; x.recordado = k; }
      cambio = true;
      const min = Math.round((ahora - x.pagadoEn) / 60000);
      const hace = min < 90 ? min + ' min' : Math.round(min / 60) + ' h';
      await this.avisarAdmin(`🔔 *Recordatorio:* el pedido #${x.codigo} sigue sin entregar\n${x.nombre} ($${x.usd}) · pagado hace ${hace}${x.estado === 'por_verificar' ? ' · ⚠️ por verificar' : ''}${pedido ? ' · lo pospusiste' : ''}\n👤 ${String(x.jugador || '').replace(/[^\p{L}\p{N} ]/gu, '')}\n\nEntrégalo: /entregar ${x.codigo} · todos: /pedidos`, botonesPedido(x.codigo));
    }
    if (cambio) await this.guardarPedidos();
  }
  // "⏳ En 1 h / Mañana" del aviso: al jugador le llega una plantilla y al
  // dueño se le vuelve a recordar a esa hora. No entrega nada.
  async posponerPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || (pd.estado !== 'pagado' && pd.estado !== 'por_verificar')) return { ok: false, error: 'No hay un pedido pagado con ese código.' };
    const ahora = Date.now();
    let cuando;
    if (b.cuando === 'man') {
      // Mañana a las 9:00 de Perú (14:00 UTC), al menos 6 h despues.
      cuando = Math.floor(ahora / 86400000) * 86400000 + 14 * 3600000;
      while (cuando < ahora + 6 * 3600000) cuando += 86400000;
    } else cuando = ahora + 3600000;
    pd.recordarEn = cuando;
    pd.recordado = RECORDAR_PEDIDO_MS.length;   // ya no los automaticos: solo el que pidio
    // Al jugador, como mucho un aviso cada 30 min (dos toques no le mandan dos).
    const avisar = ahora - (pd.esperaAvisoT || 0) > 30 * 60000;
    if (avisar) pd.esperaAvisoT = ahora;
    await this.guardarPedidos();
    if (avisar) await this.avisarJugador(pd.uid, b.cuando === 'man'
      ? `⏳ Tu compra "${pd.nombre}" (#${pd.codigo}) está confirmada. El Duende te la entrega mañana; te avisamos aquí apenas esté lista. ¡Gracias por tu paciencia!`
      : `⏳ Tu compra "${pd.nombre}" (#${pd.codigo}) está confirmada. El Duende te la entrega en aproximadamente 1 hora; te avisamos aquí apenas esté lista.`);
    return { ok: true, pedido: { codigo: pd.codigo, nombre: pd.nombre, jugador: pd.jugador }, cuando, avisado: avisar };
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
  // Pack de bienvenida (unaVez): solo si la cuenta nunca pagó nada. Cuenta
  // cualquier pedido pagado, en revisión, comprobándose o ya entregado, y
  // c.compro (marca en el personaje: los pedidos viejos se podan pasado 300).
  puedeBienvenida(uid, c) {
    return !!uid && !uid.startsWith('inv:') && !(c && c.compro) && !this.pedidos.some(x => x.uid === uid && ['pagado', 'por_verificar', 'comprobando', 'entregado'].includes(x.estado));
  }
  async pedidoUno(s, m) {
    const c = s.c;
    const pq = PAQUETES.find(x => x.id === m.id);
    if (!pq) return;
    const metodo = m.metodo === 'sol' || m.metodo === 'duende' || m.metodo === 'yape' ? m.metodo : 'stars';
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (c.uid.startsWith('inv:')) return no('Para comprar entra con tu cuenta de Telegram o inicia sesión en el juego web.');
    // El metodo lo decide la cuenta con la que se ENTRO (con cuentas vinculadas,
    // c.uid es la principal: antes quien entraba por Telegram a un duende de
    // correo no podia pagar con nada). Stars tambien desde la web: solo se crea
    // el enlace de factura y el pago sigue el flujo manual de siempre.
    const auth = s.uidAuth || c.uid;
    if (metodo !== 'stars' && auth.startsWith('tg:')) return no('Dentro de Telegram se paga con Stars.');
    if (metodo === 'yape' && !pagoLocalActivo()) return no('El pago con Yape / Plin aún no está disponible.');
    if (pq.skin && (c.skins || []).includes(pq.skin)) return no('Ya tienes esa skin.');
    if (pq.alas && (c.alas || []).includes(pq.alas)) return no('Ya tienes esas alas.');
    if (pq.skin && this.pedidos.some(x => x.uid === c.uid && x.paquete === pq.id && (x.estado === 'pagado' || x.estado === 'por_verificar' || x.estado === 'comprobando'))) return no('Ya pagaste esa skin: se activa en cuanto se confirme el pago.');
    await this.guardarPedidos();
    if (pq.unaVez && !this.puedeBienvenida(c.uid, c)) return no('El Pack de bienvenida es solo para tu primera compra, y ya compraste antes. ¡Gracias por apoyar el juego!');
    // Stars: si ya hay una factura viva de este paquete (cerrada sin pagar, doble
    // toque...), se reutiliza su enlace en vez de crear otra.
    if (metodo === 'stars') {
      const vivo = this.pedidos.find(x => x.uid === c.uid && x.metodo === 'stars' && x.paquete === pq.id && x.estado === 'esperando_pago' && x.link && Date.now() - x.creado < vigenciaPd(x) - 300000);
      if (vivo) { vivo.cancelado = false; return this.enviar(s, { t: 'factura', codigo: vivo.codigo, link: vivo.link, web: !auth.startsWith('tg:') }); }
    }
    // Yape: el pedido vivo del mismo paquete se reutiliza (dura 24 h y cuenta en el tope de 3).
    if (metodo === 'yape') {
      const vivo = this.pedidos.find(x => x.uid === c.uid && x.metodo === 'yape' && x.paquete === pq.id && x.estado === 'esperando_pago' && Date.now() - x.creado < YAPE_VIGENCIA_MS - 600000);
      if (vivo) return this.enviar(s, this.datosYape(vivo));
    }
    // Las facturas de Stars sin pagar no cuentan en el tope: se terminan pulsando el mismo
    // paquete (reusa la factura viva) y Telegram no cobra una vencida (pedidoValido la frena).
    if (this.pedidos.filter(x => x.uid === c.uid && !(x.metodo === 'stars' && x.estado === 'esperando_pago') &&(x.estado === 'esperando_pago' || x.estado === 'comprobando' || x.estado === 'por_verificar')).length >= 3) return no(this.pedidos.some(x => x.uid === c.uid && x.metodo === 'yape' && x.estado === 'esperando_pago') ? 'Tienes compras sin pagar: termina alguna (Tus compras → «Pagar») o espera a que venzan.' : 'Tienes compras sin pagar: termina o espera 30 minutos.');
    if (this.pedidos.filter(x => x.uid === c.uid && Date.now() - x.creado < 3600000).length >= 10) return no('Has creado muchos pedidos seguidos: espera un rato.');
    if (this.pedidos.filter(x => x.estado === 'esperando_pago').length >= 150) return no('La tienda está muy ocupada: intenta en unos minutos.');
    const env = getEnv({ env: this.env });
    const pd = {
      codigo: Math.random().toString(36).slice(2, 8).toUpperCase(), uid: c.uid, jugador: c.nombre,
      paquete: pq.id, nombre: pq.nombre, usd: pq.usd, metodo, creado: Date.now(), estado: 'esperando_pago',
      uidPago: auth,   // cuenta con la que se entro al pedir (Telegram o correo)
    };
    if (c.vinc && c.vinc.tg) pd.tgVinc = c.vinc.tg;   // Telegram vinculado al pedir (pagador valido)
    // De donde vino la compra (boton TIENDA del HUD, tienda de oro, NPC o enlace del bot): solo informativo para el dueño.
    if (['hud', 'oro', 'npc', 'bot', 'falta', 'bienv'].includes(m.via)) pd.via = m.via;
    // Origen, campaña y dias desde el alta: /ventas y el ROAS D7 de /mmostats (retencion.js).
    if (c.ret) {
      if (c.ret.src) pd.src = c.ret.src;
      if (c.ret.camp) pd.camp = c.ret.camp;
      if (c.ret.alta && c.creado) { pd.alta = diaNum(c.creado); pd.dias = diaNum() - pd.alta; }
    }
    this.hitoCompra(c, 'pq_' + metodo, pd);
    metaEvento(this, c, 'InitiateCheckout', { value: pq.usd, currency: 'USD', content_ids: [pq.id] }, pd.codigo);   // mismo event_id que el pixel (dedup)
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
      pd.link = link;
      this.pedidos.push(pd);
      await this.guardarPedidos();
      return this.enviar(s, { t: 'factura', codigo: pd.codigo, link, web: !auth.startsWith('tg:') });
    }
    if (metodo === 'yape') {
      // Precio redondo en soles (pq.pen) con céntimos propios del pedido: en la
      // app del dueño, el monto y el #codigo de la nota dicen de quien es el yapeo.
      const base = Math.round((pq.pen || 0) * 100);
      if (!base) return no('Ese paquete no tiene precio en soles.');
      const ocupadoY = cts => this.pedidos.some(x => x.metodo === 'yape' && x.centimos === cts && !['entregado', 'anulado', 'vencido'].includes(x.estado));
      const opciones = [1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -2, -3, -4, -5, -6, -7, -8, -9].map(k => base + k).filter(v => v > 0 && !ocupadoY(v));
      if (!opciones.length) return no('Hay muchos pagos con Yape en revisión ahora: intenta en un rato o usa otro método.');
      pd.centimos = opciones[Math.floor(Math.random() * Math.min(opciones.length, 9))];
      pd.pen = pq.pen;
      this.pedidos.push(pd);
      await this.guardarPedidos();
      this.enviar(s, this.datosYape(pd));
      this.actualizarYo(s);   // aparece en "Tus compras" para retomar el pago
      return;
    }
    if (metodo === 'duende') {
      // Precio real del token (pump.fun / DexScreener); sin precio no se cobra.
      const precioD = await this.precioDuendeSeguro();
      if (!precioD) return no('No se pudo leer el precio de $DUENDE ahora. Intenta en un minuto o paga con SOL.');
      const usd = pq.usd * DUENDE_DESCUENTO;
      // Unidades minimas (6 decimales) con 4 cifras finales propias del pedido.
      // Como en SOL, el monto queda reservado: dos pedidos vivos con el mismo
      // monto dejaban que otro se quedara con un pago ajeno (la cadena no dice para quien era).
      const baseD = Math.ceil(usd / precioD * 10 ** DUENDE_DECIMALES / 1e4) * 1e4;
      const ocupadoD = r => this.pedidos.some(x => x.metodo === 'duende' && x.duendeRaw === r && x.estado !== 'entregado' && x.estado !== 'anulado');
      let raw = 0;
      for (let i = 0; i < 30; i++) { const r = baseD + 1 + Math.floor(Math.random() * 9998); if (!ocupadoD(r)) { raw = r; break; } }
      if (!raw) return no('La tienda está muy ocupada ahora mismo: intenta en unos minutos o paga con SOL.');
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
    let libre = false;
    for (let i = 0; i < 30; i++) { pd.lamports = base + 1 + Math.floor(Math.random() * 9998); if (!ocupado(pd.lamports)) { libre = true; break; } }
    if (!libre) return no('La tienda está muy ocupada ahora mismo: intenta en unos minutos.');
    pd.ref = claveAzar();   // 'reference' de Solana Pay: identifica el pago en la cadena
    pd.precioSol = precio;
    this.pedidos.push(pd);
    await this.guardarPedidos();
    this.enviar(s, { t: 'pedidoSol', codigo: pd.codigo, lamports: pd.lamports, wallet: SOL_DEV_WALLET, usd: pq.usd, nombre: pq.nombre, ref: pd.ref });
    this.actualizarYo(s);   // aparece en "Tus compras" para retomar el pago
  }

  // Datos para yapear (ventana del cliente y "Pagar" en Tus compras).
  datosYape(pd) {
    return { t: 'pedidoYape', codigo: pd.codigo, nombre: pd.nombre, monto: (pd.centimos / 100).toFixed(2), numero: PAGO_LOCAL.numero, titular: PAGO_LOCAL.titular, qr: PAGO_LOCAL.qr || '', vence: pd.creado + YAPE_VIGENCIA_MS };
  }
  // «Ya yapeé»: el jugador manda su número de operación. NO entrega nada: queda
  // 'por_verificar' y le llega al dueño con Entregar/Anular; él lo mira en su
  // app de Yape y entrega con /entregar. Cada operación vale para UN pedido.
  async pedidoYapeOk(s, m) {
    const c = s.c;
    const no = t => this.enviar(s, { t: 'toast', m: t });
    const pd = this.buscarPedido(m && m.codigo);
    const op = String((m && m.operacion) || '').replace(/[\s-]/g, '');
    // 'vencido' tambien: quien yapeo justo al final no pierde su pago (lo revisa el dueño).
    if (!pd || !c || pd.uid !== c.uid || pd.metodo !== 'yape' || (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido')) return no('Ese pedido ya no está esperando pago.');
    if (!/^\d{6,12}$/.test(op)) return no('El número de operación son solo cifras (de 6 a 12). Lo ves en el comprobante de Yape o Plin.');
    if (!this.ritmoSol(c.uid, 'y', 5000)) return no('Espera unos segundos antes de volver a intentarlo.');
    const clave = 'firma:yape:' + op;
    if (await this.state.storage.get(clave)) return no('Ese número de operación ya se usó en otro pedido.');
    await this.state.storage.put(clave, pd.codigo);
    const tarde = pd.estado === 'vencido';
    pd.estado = 'por_verificar'; pd.operacion = op; pd.pagadoEn = Date.now();
    this.hitoCompra(c, 'pg', pd);
    await this.guardarPedidos();
    const monto = 'S/ ' + (pd.centimos / 100).toFixed(2);
    this.avisarAdmin(`🟣 *Pedido #${pd.codigo}* — ${pd.nombre} (${monto} por Yape / Plin)${tarde ? ' · ⏰ pasadas las 24 h' : ''}\n👤 ${String(pd.jugador || '').replace(/[^\p{L}\p{N} ]/gu, '')}\n🧾 Operación: ${op}\n\n⚠️ Míralo en tu app: monto *exacto* ${monto} y nota #${pd.codigo}. Si llegó: /entregar ${pd.codigo} · si no: /anular ${pd.codigo}`, botonesPedido(pd.codigo));
    this.enviar(s, { t: 'toast', ok: 1, yapeOk: pd.codigo, m: '✅ Recibimos tu número de operación. ' + textoPagoRecibido() });
    this.actualizarYo(s);
  }

  // Precio de $DUENDE para cobrar: el MAS BAJO de las ultimas 6 h (una
  // muestra cada 10 min). Con una capitalizacion pequeña alguien podia subir
  // el precio un momento justo antes de pedir y pagar menos tokens.
  async precioDuendeSeguro() {
    const ahora = Date.now();
    const h = (this.preciosD = (this.preciosD || (await this.state.storage.get('preciosD')) || []).filter(x => ahora - x.t < 6 * 3600000));
    const ult = h[h.length - 1];
    if (!ult || ahora - ult.t > 10 * 60000) {
      const p = await getDuendePriceSeguro('venta');   // dos fuentes que coincidan; el menor (pagas mas tokens, nunca menos)
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
      this.hitoCompra(c, 'pg', pd);
      await this.guardarPedidos();
    } finally { this.verificando.delete(firma); }
    // Entrega automatica: la verificacion de arriba (monto exacto confirmado en
    // la cadena, firma no usada antes) ya paso; el dueño solo recibe el aviso.
    const esD = pd.metodo === 'duende';
    const monto = esD ? (pd.duendeRaw / 10 ** DUENDE_DECIMALES).toLocaleString('es', { maximumFractionDigits: 6 }) + ' $DUENDE' : (pd.lamports / 1e9).toFixed(9) + ' SOL';
    // Pagado despues del plazo (precio viejo): no se entrega solo, lo revisa el dueño.
    // Asi nadie espera a que baje SOL o $DUENDE para pagar un pedido viejo, y quien pago
    // tarde de buena fe no pierde su dinero.
    if (cadena.tarde) {
      no('📨 Recibimos tu pago, pero llegó después del plazo del pedido (30 min). El equipo lo revisa y te escribe: si el precio cambió mucho te ofrece la entrega o la devolución.');
      this.actualizarYo(s);
      this.avisarAdmin(`⏰ *Pedido #${pd.codigo} pagado FUERA DE PLAZO* — ${pd.nombre} ($${pd.usd})\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n💰 ${monto} al precio de hace más de 30 min\n🔗 https://solscan.io/tx/${firma}\n\nRevisa el precio actual y decide: /entregar ${pd.codigo}, o devuélvelo y /anular ${pd.codigo}`, botonesPedido(pd.codigo));
      return;
    }
    // Entrega MANUAL (27-oct-2026, decision del dueño): el pago verificado le llega por
    // Telegram con los botones Entregar/Anular y el entrega con /entregar o Modo Dios.
    no('📨 Pago confirmado en la cadena. ' + textoPagoRecibido() + (pd.uid.startsWith('tg:') ? ' Te avisamos aquí y por Telegram.' : ' Te avisamos aquí en el juego al entregarlo.'));   // cuenta web: el aviso de entrega no va por Telegram
    this.actualizarYo(s);
    this.avisarAdmin(`${esD ? '🍄' : '◎'} *Pedido #${pd.codigo}* — ${pd.nombre} ($${pd.usd})\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}\n💰 Pagó ${monto} (monto exacto, confirmado en la cadena)\n🔗 https://solscan.io/tx/${firma}\n\nEntrégalo: /entregar ${pd.codigo}`, botonesPedido(pd.codigo));
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

  // «¿Problema?» en Tus compras: el jugador avisa de un pedido suyo y al dueño
  // le llega por Telegram con los datos para revisarlo. No cambia ni entrega
  // nada; un aviso por pedido cada 6 h y uno por cuenta cada 2 min.
  async reclamoPedido(s, m) {
    const c = s.c;
    const pd = this.buscarPedido(m.codigo);
    const no = t => this.enviar(s, { t: 'toast', m: t });
    if (!pd || pd.uid !== c.uid) return no('Ese pedido no es tuyo.');
    if (pd.reclamadoEn && Date.now() - pd.reclamadoEn < 6 * 3600000) return no(`Ya avisamos a El Duende del pedido #${pd.codigo}: lo está revisando. Si quieres dar más datos, escribe a @ElDuendeOficial.`);
    if (!this.ritmoSol(c.uid, 'r', 120000)) return no('Espera un par de minutos antes de otro aviso.');
    pd.reclamadoEn = Date.now();
    await this.guardarPedidos();
    const tgId = c.uid.startsWith('tg:') ? c.uid.slice(3) : '';
    const hace = pd.pagadoEn ? Math.round((Date.now() - pd.pagadoEn) / 60000) + ' min' : 'sin pago registrado';
    const llego = await this.avisarAdmin(`🆘 Reclamo del pedido #${pd.codigo} — ${pd.nombre} ($${pd.usd})\n👤 ${String(pd.jugador || c.nombre).replace(/[^\p{L}\p{N} ]/gu, '')} · Nv ${c.nivel}${tgId ? ' · tg ' + tgId : ' · cuenta web'}\nEstado: ${pd.estado} · método ${pd.metodo} · pagado hace ${hace}${pd.charge ? '\nCargo: ' + pd.charge : ''}${pd.firma ? '\nTx: https://solscan.io/tx/' + pd.firma : ''}\n\nEl jugador dice que tiene un problema con esta compra. Revísalo: /pedidos · /entregar ${pd.codigo} · /anular ${pd.codigo}`, null, true);
    if (!llego) { pd.reclamadoEn = 0; return no('No pudimos avisar ahora. Prueba en unos minutos o escribe a @ElDuendeOficial con el número de pedido.'); }
    this.actualizarYo(s);   // el botón pasa a «Avisado»
    this.enviar(s, { t: 'toast', ok: 1, m: `Listo: El Duende revisará tu pedido #${pd.codigo} y te avisará${tgId ? ' por Telegram' : ' aquí en el juego'}. Si quieres dar más datos, escribe a @ElDuendeOficial.` });
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
    return { ok: true, recibido: lamports, de: t.parsed.info.source, tarde: pagoTarde(tx, desde) };
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
    return { ok: true, recibido: raw, de: t.parsed.info.authority || t.parsed.info.source, tarde: pagoTarde(tx, desde) };
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

  // El jugador cerro la factura de Stars sin pagar: deja de contar en el tope
  // de compras sin pagar. Sigue 'esperando_pago' (el enlace vale si lo reabre o
  // si el pago ya iba en camino); al pedir el mismo paquete se reutiliza.
  pedidoCancelar(s, m) {
    const pd = this.buscarPedido(m && m.codigo);
    if (!pd || !s.c || pd.uid !== s.c.uid || pd.metodo !== 'stars' || pd.estado !== 'esperando_pago' || pd.cancelado) return;
    pd.cancelado = true;
    this.hitoCompra(s.c, 'fc', pd);   // cerro la factura sin pagar (embudo de compra)
  }

  async pedidoPagadoStars(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.metodo !== 'stars') return { ok: false, error: 'pedido desconocido' };
    // Un SEGUNDO cobro (otro cargo) de un pedido ya pagado (la misma factura pagada
    // dos veces, p. ej. desde dos aparatos): no es un reintento, el bot avisa al dueño
    // con el boton Devolver. Antes se contestaba "repetido" y el cobro quedaba huerfano.
    if (pd.estado !== 'esperando_pago' && pd.estado !== 'vencido') {
      if (b.charge && pd.charge !== String(b.charge)) return { ok: false, error: `pago doble: el pedido ya estaba ${pd.estado} con otro cobro` };
      return { ok: true, repetido: true, nombre: pd.nombre };
    }
    // Pagador valido: la cuenta del pedido, la de Telegram con la que se entro o
    // la vinculada al duende. Un pedido hecho desde la web con correo sin Telegram
    // vinculado lo paga quien abra el enlace (la entrega es manual por codigo).
    const pagador = 'tg:' + b.tgId;
    // El vinculo se lee del personaje aunque el jugador no este conectado (si no,
    // cualquier Telegram contaba como pagador valido de un pedido web).
    const cp = this.porUid.get(pd.uid);
    let cv = cp && cp.c;
    if (!cv) { try { cv = await this.state.storage.get('c:' + pd.uid); } catch (e) {} }
    const vincTg = (cv && cv.vinc && cv.vinc.tg) || pd.tgVinc || null;
    const deWeb = !String(pd.uidPago || pd.uid).startsWith('tg:') && !vincTg;
    const cuentaOk = deWeb || pagador === pd.uid || pagador === pd.uidPago || (!!vincTg && pagador === vincTg);
    if (!cuentaOk || (b.stars | 0) < pd.stars) {
      // Ya no se marca como pagado: queda por revisar (el dueño decide).
      pd.estado = 'por_verificar'; pd.charge = String(b.charge || ''); pd.tgPagador = String(b.tgId || ''); pd.starsPagadas = b.stars | 0; pd.pagadoEn = Date.now();
      pd.cadena = { ok: false, motivo: `pagó ${b.stars} Stars (se pedían ${pd.stars}) desde otra cuenta o de menos` };
      await this.guardarPedidos();
      this.avisarAdmin(`⚠️ Pago de Stars raro en el pedido #${pd.codigo}: pagó ${b.stars} (se pedían ${pd.stars}) desde tg ${b.tgId}. Queda por revisar; para devolverlo: /anular ${pd.codigo} o /entregar ${pd.codigo} si está bien`, botonesPedido(pd.codigo));
      return { ok: true, nombre: pd.nombre };
    }
    pd.estado = 'pagado'; pd.charge = String(b.charge || ''); pd.tgPagador = String(b.tgId || ''); pd.starsPagadas = b.stars | 0; pd.pagadoEn = Date.now();
    this.hitoCompra(null, 'pg', pd);
    await this.guardarPedidos();
    // Entrega MANUAL (27-oct-2026, decision del dueño): le llega por Telegram con los
    // botones Entregar/Anular y el entrega con /entregar o Modo Dios.
    this.avisarAdmin(`⭐ *Pedido #${pd.codigo}* — ${pd.nombre} (${pd.starsPagadas} Stars, ya están en tu bot)\n👤 ${pd.jugador.replace(/[^\p{L}\p{N} ]/gu, '')}${pagador !== pd.uid ? `\n💳 Pagó desde tg ${b.tgId}${deWeb ? ' (pedido hecho en la web)' : ''}` : ''}\n\nEntrégalo: /entregar ${pd.codigo}`, botonesPedido(pd.codigo));
    const s = this.porUid.get(pd.uid);
    if (s) this.actualizarYo(s);
    return { ok: true, nombre: pd.nombre };
  }

  // Lo que trae el paquete, al personaje c (s: su sesion si esta conectado, o null).
  // Lo usan /entregar y restaurar una copia (copias.js: lo entregado despues de la
  // copia vuelve a ponerse). Devuelve la nota para el aviso al jugador.
  aplicarPaquete(c, pq, s) {
    c.oro += pq.oro || 0;
    if (pq.pw) c.pw = c.pw || {};
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
    return notaSkin;
  }

  async entregarPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || (pd.estado !== 'pagado' && pd.estado !== 'por_verificar')) return { ok: false, error: 'No hay un pedido pagado con ese código.' };
    const pq = PAQUETES.find(x => x.id === pd.paquete);
    // Cerrojo: entre la comprobacion y 'entregado' hay un await; dos avisos a la vez
    // (bot y entrega automatica) entregaban dos veces.
    if (pd.entregando) return { ok: false, error: 'Ese pedido ya se está entregando.' };
    pd.entregando = true;
    let s, c;
    try { ({ s, c } = await this.pjDe(pd.uid)); } finally { delete pd.entregando; }
    if (pd.estado !== 'pagado' && pd.estado !== 'por_verificar') return { ok: false, error: 'No hay un pedido pagado con ese código.' };
    if (!c || !pq) return { ok: false, error: 'No encontré al jugador o el paquete.' };
    // Dos packs de bienvenida pagados a la vez (dos pedidos abiertos): solo se entrega uno; el otro, anúlalo o devuélvelo.
    if (pq.unaVez && (c.bienvYa || this.pedidos.some(x => x !== pd && x.uid === pd.uid && x.paquete === pq.id && x.estado === 'entregado'))) return { ok: false, error: 'Esa cuenta ya recibió el Pack de bienvenida (es de una sola vez). Anula este pedido o devuelve el pago.' };
    const notaSkin = this.aplicarPaquete(c, pq, s);
    pd.estado = 'entregado'; pd.entregado = Date.now(); pd.por = b.por || 'bot';
    metaEvento(this, c, 'Purchase', { value: pd.usd, currency: 'USD', content_ids: [pd.paquete] }, 'pur_' + pd.codigo);   // sin await: si Meta falla, la entrega sigue
    this.hitoCompra(c, 'en', pd); this.ventaCohorte(pd);   // embudo de compra y ARPU/ROAS D7 (retencion.js)
    c.compro = 1; if (pq.unaVez) c.bienvYa = 1;   // queda en el personaje aunque el pedido se pode
    if (pd.metodo === 'sol' || pd.metodo === 'duende') {
      this.ingresosSol.push({ usd: pd.usd, t: Date.now() });
      this.ingresosSol = this.ingresosSol.filter(x => Date.now() - x.t < 30 * 86400000);
      await this.state.storage.put('ingresosSol', this.ingresosSol);
    }
    // Celebracion en el cliente (ventana con la skin en grande): al momento si
    // esta conectado; si no, queda en c.regaloPend y sale al entrar.
    const regalo = { cod: pd.codigo, nombre: pd.nombre, skin: pq.skin && SKINS[pq.skin] ? pq.skin : '', ala: pq.alas && ALAS[pq.alas] ? pq.alas : '', oro: pq.oro || 0, ya: notaSkin.includes('Ya la tenías') ? 1 : 0 };
    // Dos entregas sin conectarse: la anterior no se pierde, pasa al buzon.
    if (!s && c.regaloPend && c.regaloPend.cod !== regalo.cod) await this.buzonAgregar(pd.uid, `🎁 Tu compra "${c.regaloPend.nombre}" ya está en tu personaje. Gracias por apoyar DUENDE QUEST.`);
    if (!s) c.regaloPend = regalo;
    if (s) await this.guardar(s); else await this.state.storage.put('c:' + pd.uid, c);
    await this.guardarPedidos();
    if (s) this.enviar(s, { t: 'regalo', ...regalo, vivo: 1 });
    await this.avisarJugador(pd.uid, `🎁 ¡Tu compra "${pd.nombre}" ya está en tu personaje!${notaSkin} Gracias por apoyar DUENDE QUEST.`, true);
    // Pago con Stars desde la web (uid no es tg:): el bot le prometio al pagador «Te avisaremos aquí».
    if (pd.tgPagador && !String(pd.uid).startsWith('tg:')) {
      try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: pd.tgPagador, text: '🎁 ¡Tu compra "' + pd.nombre + '" (pedido #' + pd.codigo + ') ya está en tu personaje! Entra al juego para verla.' }); } catch (e) {}
    }
    return { ok: true, pedido: pd };
  }

  // /ventas (solo el dueño): lo entregado en 7 y 30 dias, por metodo y lo
  // mas vendido, y lo que queda por entregar. Sale de los ultimos 300 pedidos.
  // Tambien por metodo, por donde se abrio la tienda (via), por origen y campaña
  // del jugador, la mediana de pagado→entregado y el embudo de compra de 7 dias.
  async resumenVentas() {
    const ahora = Date.now();
    const ent = this.pedidos.filter(x => x.estado === 'entregado');
    const tramo = dias => {
      const l = ent.filter(x => ahora - (x.entregado || x.creado) < dias * 86400000);
      const por = {};
      for (const x of l) { const k = x.nombre; por[k] = por[k] || { n: 0, usd: 0 }; por[k].n++; por[k].usd += x.usd; }
      return {
        n: l.length, usd: Math.round(l.reduce((a, x) => a + x.usd, 0) * 100) / 100,
        sol: l.filter(x => x.metodo === 'sol').length, stars: l.filter(x => x.metodo === 'stars').length,
        yape: l.filter(x => x.metodo === 'yape').length, soles: Math.round(l.filter(x => x.metodo === 'yape').reduce((a, x) => a + (x.centimos || 0), 0)) / 100,
        top: Object.entries(por).sort((a, b) => b[1].usd - a[1].usd).slice(0, 5).map(([nombre, v]) => ({ nombre, ...v })),
        grupos: { metodo: agrupar(l, x => x.metodo), via: agrupar(l, x => x.via || 'otro'), origen: agrupar(l, x => x.src || '?'), campana: agrupar(l.filter(x => x.camp), x => x.camp) },
        // Horas de pagado a entregado (mediana): lo que espera el jugador.
        espera: (() => { const h = l.filter(x => x.pagadoEn && x.entregado >= x.pagadoEn).map(x => (x.entregado - x.pagadoEn) / 3600000).sort((a, b) => a - b); return h.length ? Math.round(h[h.length >> 1] * 10) / 10 : null; })(),
      };
    };
    const agrupar = (l, f) => {
      const g = {};
      for (const x of l) { const k = String(f(x)); g[k] = g[k] || { n: 0, usd: 0 }; g[k].n++; g[k].usd = Math.round((g[k].usd + x.usd) * 100) / 100; }
      return Object.entries(g).sort((a, b) => b[1].usd - a[1].usd).slice(0, 6).map(([k, v]) => ({ k, ...v }));
    };
    let embudo = null;
    try { embudo = await this.embudoCompra(); } catch (e) { console.error('[MMO embudo compra]', e); }
    return { ok: true, embudo, d7: tramo(7), d30: tramo(30), pendientes: this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar').length, anulados30: this.pedidos.filter(x => x.estado === 'anulado' && ahora - x.creado < 30 * 86400000).length };
  }

  async anularPedido(b) {
    const pd = this.buscarPedido(b.codigo);
    if (!pd || pd.estado === 'entregado' || pd.estado === 'anulado' || pd.estado === 'anulando') return { ok: false, error: 'Ese pedido no se puede anular (no existe, ya se entregó o ya se anuló).' };
    const estadoAntes = pd.estado;
    pd.estado = 'anulando';   // un segundo toque (o /entregar) mientras se devuelven las Stars ya no pasa
    // Primero se devuelven las Stars: si Telegram no acepta, el pedido vuelve a
    // su estado (sin liberar firmas ni avisar al jugador) para reintentar /anular.
    let reembolso = '';
    if (pd.metodo === 'stars' && pd.charge && pd.tgPagador) {
      let desc = '';
      try {
        const env = getEnv({ env: this.env });
        const rsp = await tg(env.BOT_TOKEN, 'refundStarPayment', { user_id: Number(pd.tgPagador), telegram_payment_charge_id: pd.charge });
        if (rsp && rsp.ok) reembolso = ' Las Stars se devolvieron solas.';
        else if (/ALREADY_REFUNDED/i.test((rsp && rsp.description) || '')) reembolso = ' Las Stars ya estaban devueltas.';
        else desc = (rsp && rsp.description) || 'sin respuesta';
      } catch (e) { desc = 'no se pudo hablar con Telegram'; }
      if (desc) {
        pd.estado = estadoAntes;
        await this.guardarPedidos();
        return { ok: false, error: 'Telegram no aceptó devolver las Stars: ' + desc + '. El pedido sigue abierto: reintenta /anular ' + pd.codigo + ' más tarde.' };
      }
    }
    // La firma vuelve a quedar libre (si era de otro pago, su dueño puede usarla).
    if (pd.firma && (await this.state.storage.get('firma:' + pd.firma)) === pd.codigo) await this.state.storage.delete('firma:' + pd.firma);
    if (pd.operacion && (await this.state.storage.get('firma:yape:' + pd.operacion)) === pd.codigo) await this.state.storage.delete('firma:yape:' + pd.operacion);
    pd.estado = 'anulado'; pd.motivo = String(b.motivo || '').slice(0, 120);
    await this.guardarPedidos();
    const extraMetodo = pd.metodo === 'stars' && reembolso ? ' Tus Stars fueron devueltas.'
      : pd.metodo === 'yape' ? ' Si ya yapeaste, El Duende te devuelve el monto a tu Yape/Plin; dudas: @ElDuendeOficial.'
      : (pd.metodo === 'sol' || pd.metodo === 'duende') ? ' Si llegó tu pago, se devuelve a tu wallet.' : '';
    await this.avisarJugador(pd.uid, `❌ Tu compra "${pd.nombre}" (#${pd.codigo}) fue anulada${pd.motivo ? ': ' + pd.motivo : ''}.${extraMetodo}`);
    return { ok: true, pedido: pd, reembolso };
  }

  // botones: teclado en linea opcional (p. ej. Entregar / Anular un pedido).
  // plano: texto que escribio un jugador (reportes): sin Markdown y sin vista previa de enlaces.
  // Comprueba la respuesta de Telegram: reintenta y, si el Markdown no se
  // pudo leer (un nombre con _ o *), lo manda en texto plano. Devuelve si llego.
  async avisarAdmin(texto, botones, plano) {
    const env = getEnv({ env: this.env });
    if (!env.BOT_TOKEN || !env.ADMIN_TG_ID) return false;
    for (let i = 0; i < 3; i++) {
      try {
        const formato = plano ? { link_preview_options: { is_disabled: true } } : { parse_mode: 'Markdown' };
        const r = await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: env.ADMIN_TG_ID, text: texto, ...formato, ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) });
        if (r && r.ok) return true;
        console.error('[MMO avisarAdmin]', r && r.description);
        if (r && r.error_code === 400 && !plano) { plano = true; texto = texto.replace(/[*`]/g, ''); continue; }
        if (r && r.error_code === 400) return false;   // reintentar no lo arregla
      } catch (e) { console.error('[MMO avisarAdmin]', e); }
      if (i < 2) await new Promise(res => setTimeout(res, 1500));
    }
    return false;
  }
  // sinBuzon: la entrega de una compra ya tiene su celebracion (c.regaloPend).
  async avisarJugador(uid, texto, sinBuzon) {
    const s = this.porUid.get(uid);
    if (s) { this.enviar(s, { t: 'toast', m: texto, ok: true }); this.actualizarYo(s); }
    else if (!sinBuzon) await this.buzonAgregar(uid, texto);
    if (uid.startsWith('tg:')) {
      try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: uid.slice(3), text: texto }); } catch (e) {}
    }
  }

  // Buzon "Mientras no estabas": avisos para quien no tenia sesion abierta.
  // Clave aparte (bz:uid) para no pisar el personaje; como mucho 10 y sin repetidos.
  // aunInvitado: tambien a jugadores sin cuenta (avisos de sus propios invitados).
  async buzonAgregar(uid, texto, aunInvitado) {
    if (!uid || (uid.startsWith('inv:') && !aunInvitado)) return;
    try {
      const l = (await this.state.storage.get('bz:' + uid)) || [];
      const m = String(texto).slice(0, 300);
      if (l.some(x => x.m === m)) return;
      l.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), m, ts: Date.now() });
      await this.state.storage.put('bz:' + uid, l.slice(-10));
    } catch (e) { console.error('[MMO buzon]', e); }
  }
  async buzonEnviar(s) {
    const c = s.c;
    try {
      const l = await this.state.storage.get('bz:' + c.uid);
      if (s.cerrado || s.c !== c) return;
      if (Array.isArray(l) && l.length) { s.bz = true; this.enviar(s, { t: 'buzon', l }); }
    } catch (e) {}
    if (c.regaloPend) this.enviar(s, { t: 'regalo', ...c.regaloPend });
  }
  // El cliente ya lo mostro: se vacia (q: 'buzon' o 'regalo').
  async buzonVisto(s, m) {
    if (m.q === 'regalo') { if (s.c.regaloPend) { delete s.c.regaloPend; s.sucio = true; } return; }
    // Solo si en esta sesion se le mostro un buzon: cada delete cuenta en el cupo
    // de escrituras y un cliente que repitiera 'visto' en bucle lo gastaba.
    if (!s.bz) return;
    s.bz = false;
    try { await this.state.storage.delete('bz:' + s.c.uid); } catch (e) {}
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
    if (accion === 'mantenimiento') return json(await this.mantenimiento(b));   // antes de publicar (copias.js, tools/deploy.mjs)
    if (accion === 'retiros') return json({ ok: true, pendientes: this.retiros.filter(x => x.estado === 'pendiente'), fondo: this.infoFondo() });
    if (accion === 'pedidoValido') {
      const pd = this.buscarPedido(b.codigo);
      const ok = !!pd && pd.metodo === 'stars' && pd.estado === 'esperando_pago' && Date.now() - pd.creado < vigenciaPd(pd);
      // Pack de bienvenida: si mientras tanto ya se pagó otra compra (otro pack abierto
      // u otro paquete), Telegram no cobra este (antes se cobraba y habia que devolverlo).
      const pq = pd && PAQUETES.find(x => x.id === pd.paquete);
      // El personaje tambien cuenta (c.compro / c.bienvYa: los pedidos viejos se podan).
      let cb = ok && pq && pq.unaVez ? (this.porUid.get(pd.uid) || {}).c : null;
      if (ok && pq && pq.unaVez && !cb) { try { cb = await this.state.storage.get('c:' + pd.uid); } catch (e) {} }
      if (ok && pq && pq.unaVez && (!this.puedeBienvenida(pd.uid, cb || null) || (cb && cb.bienvYa))) return json({ ok: false, motivo: 'bienvenida' });
      return json({ ok });
    }
    if (accion === 'pedidoPagado') return json(await this.pedidoPagadoStars(b));
    // cargos: los de Stars del MMO, para que /pedidos no los cuente como compras del arcade.
    if (accion === 'pedidos') return json({ ok: true, pedidos: this.pedidos.filter(x => x.estado === 'pagado' || x.estado === 'por_verificar'), cargos: this.pedidos.filter(x => x.charge).map(x => x.charge) });
    if (accion === 'posponer') return json(await this.posponerPedido(b));
    if (accion === 'ventas') return json(await this.resumenVentas());
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
    // /miscompras del bot: los pedidos de la tienda de esa cuenta de Telegram
    // (los suyos o los que pagó), sin datos de pago. Solo lectura.
    if (accion === 'misCompras') {
      const id = String(b.tgId || '').replace(/\D/g, '');
      if (!id) return json({ ok: false });
      const suyos = this.pedidos.filter(x => (x.uid === 'tg:' + id || x.tgPagador === id) && x.estado !== 'esperando_pago' && x.estado !== 'vencido');
      const l = suyos.slice(-10)
        .map(x => ({ codigo: x.codigo, nombre: x.nombre, estado: x.estado, metodo: x.metodo, charge: x.charge || '', creado: x.creado || 0, pagadoEn: x.pagadoEn || 0 }));
      // cargos: TODOS sus cobros con Stars del MMO (no solo los 10 ultimos), para que el
      // bot no muestre un pedido viejo ya entregado como compra del arcade «En revisión».
      return json({ ok: true, l, cargos: suyos.map(x => x.charge).filter(Boolean) });
    }
    // /start ad_<campaña> del bot: se anota la campaña de ese Telegram (30 dias) para
    // que su alta cuente como 'tg' aunque abra el juego sin utm. Solo la etiqueta.
    if (accion === 'tgOrigen') {
      const id = String(b.tgId || '').replace(/\D/g, '').slice(0, 20);
      const cmp = String(b.c || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
      if (!id || !cmp) return json({ ok: false });
      // Quien ya tiene duende (propio o vinculado) no es un alta: la clave quedaba para siempre sin usarse.
      if ((await this.state.storage.get('c:tg:' + id)) || (await this.uidPrincipal('tg:' + id)) !== 'tg:' + id) return json({ ok: true, ya: true });
      if (!(await this.state.storage.get('tgorg:' + id))) await this.state.storage.put('tgorg:' + id, { c: cmp, t: Date.now() });
      return json({ ok: true });
    }
    // /start mmo_/m3d_ del bot: solo nombre y nivel de quien invita (publicos), por su codigo.
    if (accion === 'invitador') {
      const cod = String(b.ref || '');
      if (!/^[a-z0-9]{6}$/.test(cod)) return json({ ok: false });
      const uid = await this.state.storage.get('ref:' + cod);
      const s = uid && this.porUid.get(uid);
      const c = uid ? (s && s.c ? s.c : await this.state.storage.get('c:' + uid)) : null;
      return json(c ? { ok: true, n: c.nombre || '', lv: c.nivel || 1 } : { ok: false });
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
      r.cerrado = Date.now(); if (accion === 'rechazar' && b.trampa) r.trampa = true;
      if (b.tx) r.tx = String(b.tx).slice(0, 120);
      if (accion === 'rechazar') {
        // Se le devuelven los mTON (salvo que el dueño lo marque como trampa).
        const { s, c } = await this.pjDe(r.uid);
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
    // Rechazos por motivo desde el ultimo arranque (para ajustar los limites anti-abuso).
    if (ret && accion === 'stats' && typeof ret === 'object') ret.rechazos = { desde: new Date(this.arranqueT || Date.now()).toISOString(), ...(this.rechazos || {}) };
    if (ret) return json(ret);
    return json({ ok: false, error: 'acción desconocida' });
  }

  // Recompensa por entrar: una por dia de juego (medianoche de Lima), racha de 7 (faltar un dia la
  // hace retroceder). Devuelve lo que se dio, o null si hoy ya se cobro.
  procesarLogin(s) {
    const c = s.c;
    const hoy = hoyUTC();
    const L = c.login || { d: null, racha: 0, total: 0 };
    // Dia de juego = medianoche de Lima (hoyUTC en data.js). Una fecha guardada
    // MAYOR que hoy (cobrada con el reloj UTC antiguo) cuenta como ya cobrada.
    if (L.d && L.d >= hoy) return null;
    const ayer = new Date(Date.parse(hoy) - 86400000).toISOString().slice(0, 10);
    const anteayer = new Date(Date.parse(hoy) - 2 * 86400000).toISOString().slice(0, 10);
    // Faltar UN dia no borra la racha: retrocede (antes volvia al 1).
    // Margen de 30 h: quien estuvo conectado hace menos de 30 h (c.salida = ultimo
    // guardado) sigue la racha aunque se salte un dia (quien juega de noche y
    // vuelve al dia siguiente de noche no la pierde por pocas horas).
    const seguido = L.d === ayer || (L.d === anteayer && c.salida > 0 && Date.now() - c.salida < 30 * 3600000);
    // La racha crece sin tope (dia 8 = semana 2, dia 1): una guardada de 7 pasa a 8.
    // Falta UN dia: hasta el 6 retrocede uno; desde el 7 no se pierde la semana
    // cumplida (el 7 pasa al 8, el 14 al 15; si no, vuelve al inicio de su semana, de 10 a 8).
    const r0 = L.racha || 0;
    // El 7 pasa al 8 (y el 14 al 15...: premio del dia 1 de la semana siguiente): no se
    // puede explotar, el premio grande del dia 7 no se repite.
    const racha = seguido ? r0 + 1 : L.d === anteayer && r0 >= 7 && r0 % 7 === 0 ? r0 + 1 : L.d === anteayer && r0 >= 8 ? (semanaRacha(r0) - 1) * 7 + 1 : L.d === anteayer && r0 < 7 ? Math.max(1, r0 - 1) : 1;
    const pr = premioRacha(racha);
    // Oro de la semana 2 x1,25 y desde la 3 x1,5 (tope).
    const oro = Math.round((pr.oro || 0) * multLogin(c.nivel) * multSemanaRacha(racha));
    c.oro += oro;
    for (const k in (pr.pw || {})) c.pw[k] = Math.min(99, (c.pw[k] || 0) + pr.pw[k]);
    let item = null;
    if (pr.item !== undefined) item = this.darItem(s, generarItem(c.nivel, pr.item), true);
    const max = Math.max(L.max || 0, r0, racha);
    c.login = { d: hoy, racha, total: (L.total || 0) + 1, max };
    // Hitos cosmeticos (una sola vez): los titulos son logros (revisarLogros);
    // el color de nombre se entrega aqui.
    const hitos = [];
    for (const H of RACHA_HITOS) {
      if (max < H.dias) continue;
      if (H.tipo === 'tinte') {
        c.tintes = c.tintes || [];
        if (c.tintes.includes(H.id)) continue;
        c.tintes.push(H.id);
        if (racha === H.dias) hitos.push(H.txt);
      } else if (racha === H.dias && Math.max(L.max || 0, r0) < H.dias) hitos.push(H.txt);   // titulo nuevo, no repetido
    }
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
    return { racha, dia: diaRacha(racha), sem: semanaRacha(racha), oro, pw: pr.pw || null, item, itemNom: item ? nombreItem(item) : undefined, txt: pr.txt, vuelta, hitos: hitos.length ? hitos : undefined };
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
    // Lo mismo con un epico o legendario (el del dia 7 se vendia en silencio con la bolsa llena).
    if (c.bolsa.length >= BOLSA_MAX && (it.cj || it.banda || (it.r || 0) >= 2)) {
      const i = c.bolsa.reduce((m, x, k) => (!x.cj && !x.banda && (x.r || 0) < Math.max(2, it.r || 0) && (m < 0 || precioVenta(x) < precioVenta(c.bolsa[m])) ? k : m), -1);
      if (i >= 0) { const v0 = precioVenta(c.bolsa[i]); c.oro += v0; c.bolsa.splice(i, 1); this.enviar(s, { t: 'toast', m: `🎒 Bolsa llena: se vendió tu objeto más barato (+${v0} oro) para guardar ${it.cj || it.banda ? 'tu pieza de conjunto' : nombreItem(it)}.` }); }
    }
    if (c.bolsa.length >= BOLSA_MAX) {
      const v = precioVenta(it);
      c.oro += v;
      if (!silencioso) this.enviar(s, { t: 'toast', m: `🎒 Bolsa llena: ${nombreItem(it)} se vendió solo por ${v} oro.` });
      it.vendido = 1;   // el aviso de botin del cliente lo dice
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
    if (!c.diaria || !(c.diaria.d >= hoy)) c.diaria = { d: hoy, p: 0, ok: false };   // una fecha futura (reloj UTC antiguo) no la reinicia
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
      pedidos: this.pedidos.filter(x => x.uid === c.uid && x.estado !== 'vencido' && (x.estado !== 'esperando_pago' || ((x.metodo === 'sol' || x.metodo === 'duende') && Date.now() - x.creado < PEDIDO_VIGENCIA_MS) || (x.metodo === 'yape' && Date.now() - x.creado < YAPE_VIGENCIA_MS))).slice(-5)
        .map(x => ({ codigo: x.codigo, nombre: x.nombre, metodo: x.metodo, estado: x.estado, creado: x.creado, pagadoEn: x.pagadoEn || undefined, reclamado: x.reclamadoEn && Date.now() - x.reclamadoEn < 6 * 3600000 ? 1 : undefined, ...(x.estado === 'esperando_pago' ? (x.metodo === 'yape' ? { yape: this.datosYape(x) } : x.metodo === 'duende'
          ? { raw: x.duendeRaw, mint: DUENDE_MINT, dec: DUENDE_DECIMALES, usd: Math.round(x.usd * DUENDE_DESCUENTO * 100) / 100, wallet: SOL_DEV_WALLET }
          : { lamports: x.lamports, usd: x.usd, wallet: SOL_DEV_WALLET, ref: x.ref || '' }) : {}) })),
      transparencia: this.transparencia(),
      puedeBienvenida: (c.uid.startsWith('inv:') || this.puedeBienvenida(c.uid, c)) ? 1 : 0,
      dios: s.dios ? 1 : 0, diosNv: s.dios || undefined, diosModo: s.dios ? s.diosModo || {} : undefined,
    };
  }
  actualizarYo(s) { s.yoPend = null; s.yoT = Date.now(); this.enviar(s, { t: 'yo', yo: this.datosPropios(s) }); }
  // Mundo 3D: tras cada caza no se reenvia el personaje entero (2-8 KB y un
  // repintado en el cliente): se marca y tick3d manda como mucho 1 vez/s lo
  // que cambia al cazar ('yoC', ~250 B). full = hace falta el 'yo' entero
  // (botin, subida de nivel, logro).
  // CLASSIC 2D: lo mismo pero al momento (sin tick3d): 'yoC' de ~250 B por
  // caza en vez del 'yo' entero; con AUTO continuo ahorra datos moviles.
  yoLuego(s, full) { if (!s.m3) { if (full) return this.actualizarYo(s); return this.enviar(s, { t: 'yoC', yo: { ...this.datosCaza(s), best: s.c.best || {} } }); } s.yoPend = full || s.yoPend === 'full' ? 'full' : 'caza'; }
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
    return { p: s.id, id: s.id, sk: s.c.skin, ar: s.c.arma, mx: s.st.maxHp, ti: this.textoTitulo(s.c), cl: s.c.clase || '', rmx: s.st.recMax, hn: this.nombreHermandad(s.c.herm), hc: this.colorHermandad(s.c.herm), mo: s.montado || '', es: s.c.espec || '', lk: s.c.look || undefined, al: s.c.ala && s.c.ala !== 'aprendiz' ? s.c.ala : undefined, fc: s.c.faccion || undefined, ra: s.c.faccion && s.c.pa ? rangoDe(s.c.pa).i || undefined : undefined, tn: s.c.tinte || '', ma: s.c.exped ? '' : s.c.mascota || '', gm: s.dios === 'dueno' ? 2 : s.dios ? 1 : 0, gi: s.dios && s.diosModo && s.diosModo.inv ? 1 : 0 };
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
    const ahoraP = Date.now();
    if (ahoraP < (s.portalT || 0)) return;   // como mucho un viaje cada 0,7 s
    s.portalT = ahoraP + 700;
    // Salir de una mazmorra lleva de vuelta a su puerta del mundo abierto.
    // Por el borde (caminando) se cruza sin corte: se aparece junto al borde
    // de entrada de la zona nueva y el cliente sigue andando sin fundido.
    const dest = MAPAS[p.a];
    const borde = !!m.borde && dest && !dest.instancia;
    const x = borde ? (p.ax < dest.ancho / 2 ? 70 : dest.ancho - 70) : p.ax;
    s.sinCorte = borde;
    this.entrarMapa(s, p.a, x);
    s.sinCorte = false;
    this.guardarSuave(s);
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
      s.movBud -= dx;   // el margen es un prestamo unico (antes se regalaba en cada mensaje)
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
    if (m.a === 'reforjar') { if (typeof m.id === 'string') this.reforjar(s, m.id); return; }
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
    this.difundirApariencia(s);
    this.revisarLogros(s);
    this.actualizarYo(s);
  }

  // 'pa' de equipo y cosmeticos: como mucho uno por segundo y sesion (cada 'pa'
  // va a todo el mundo 3D). Si llega antes, se manda el ultimo al vencer el plazo.
  difundirApariencia(s) {
    const espera = 1000 - (Date.now() - (s.paT || 0));
    if (espera <= 0) { s.paT = Date.now(); this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); return; }
    if (s.paPend) return;
    s.paPend = setTimeout(() => {
      s.paPend = null;
      if (s.cerrado || !s.c) return;
      s.paT = Date.now();
      this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    }, espera);
  }

  // Reforjar (Nv 60, junto a la Artesana): vuelve a tirar la linea extra de
  // una pieza rara o mejor (de la bolsa o puesta). La base no cambia: nunca
  // pasa del maximo de su rareza. Cada vez cuesta mas (costoReforja).
  reforjar(s, id) {
    const c = s.c;
    if (s.muerto) return;
    if (c.nivel < NIVEL_MAX) return this.no(s, `Reforjar se desbloquea a nivel ${NIVEL_MAX}.`);
    if (!this.cercaDeArtesana(s)) return this.no(s, 'Habla con la Artesana Lila en el pueblo.');
    const it = c.bolsa.find(x => x.id === id) || Object.values(c.eq || {}).find(x => x && x.id === id);
    if (!it || !(it.r >= 1) || !RAREZAS[it.r]) return this.no(s, 'Solo se reforjan objetos raros o mejores.');
    const costo = costoReforja(it);
    if (c.oro < costo) return this.no(s, `Reforjar cuesta ${costo.toLocaleString('es', { useGrouping: 'always' })} oro.`);
    c.oro -= costo;
    it.b = statsItem(it.s, it.nv, it.r);
    it.rf = (it.rf || 0) + 1;
    this.enviar(s, { t: 'toast', ok: true, m: `🔨 Reforjado: ${nombreItem(it)} ahora da ${textoBonos(it.b)}.` });
    this.recalcular(s);
    this.guardar(s);
  }

  ponerTitulo(s, m) {
    const c = s.c;
    if (m.id !== '' && !(typeof m.id === 'string' && c.logros.includes(m.id))) return;
    // Sin cambio o demasiado seguido: no se difunde (cada 'pa' va a todo el mundo 3D).
    if ((c.titulo || '') === m.id || Date.now() - (s.tituloT || 0) < 1500) return;
    s.tituloT = Date.now();
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
        return;
      }
      // Llegan mas a pelear: mas vida, con el mismo %.
      if (this.escalarMundial(M.o, x => x.k === 'coliseo')) this.aClave('coliseo', { t: 'mmx', id: M.o.id, mx: M.o.max, hp: Math.ceil(M.o.hp) });
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
      // Vida segun quien ya esta en el Coliseo, no segun todos los conectados
      // (con 10 en la beta, los de ORIGINS o de otra zona le subian la vida a
      // quien peleaba solo); si llegan mas a pelear, crece (escalarMundial).
      const n = Math.max(1, this.presentesEn('coliseo').length);
      o.hp = o.max = this.vidaMundial(n);
      o.nEsc = n;
      M.o = o; M.hasta = ahora + MUNDIAL_DURA_MS;
      this.aClave('coliseo', { t: 'ms', m: this.infoMonstruo(o) });
      this.aTodos({ t: 'aviso', m: `${MONSTRUOS[o.k].nombre} ha aparecido en el Coliseo. Tienes 10 minutos.` });
      this.aTodos(this.estadoMundial());
    }
  }

  // Vida del jefe mundial (Coliseo y 3D): 20.000 + 15.000 por cada uno que pelea.
  vidaMundial(n) { return 20000 + 15000 * Math.max(1, n); }
  // Si le pegan mas de los que tenia contados (y siguen alli: enSitio), su
  // vida crece con el mismo %, como los jefes de mazmorra: empezar solo y que
  // lleguen los demas no lo abarata, y quien pelea solo no carga con la vida
  // de los que estan en otra parte.
  escalarMundial(o, enSitio) {
    let n = 0;
    for (const sid of o.dano.keys()) { const s = this.sesiones.get(sid); if (s && s.c && !s.cerrado && enSitio(s)) n++; }
    if (n <= (o.nEsc || 1)) return false;
    const pct = o.hp / o.max;
    o.nEsc = n;
    o.max = this.vidaMundial(n);
    o.hp = Math.max(1, Math.round(o.max * pct));
    return true;
  }

  premiosMundial(o, clave = 'coliseo') {
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const nombres = [];
    // Curar a quien pelea tambien cuenta (como en las invasiones del 2D): en
    // un grupo de 2-3 el sanador ya no se queda sin premio. El mTON sigue
    // siendo solo para quien pega (parte = su daño).
    const quienes = new Set([...o.dano.keys(), ...(o.cura ? o.cura.keys() : [])]);
    for (const sid of quienes) {
      const d = o.dano.get(sid) || 0, cu = (o.cura && o.cura.get(sid)) || 0;
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.k !== clave) continue;
      const c = s.c;
      // Hay que haber peleado de verdad (al menos un 0,3 % de su vida, pegando o curando).
      if (d < o.max * 0.003 && cu < o.max * 0.003) continue;
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
        const mult = ((((SKINS[s.c.skin] || {}).buffs || {}).oroMult) || 1) * (1 + talento(s.c, 'fortuna'));
        const xp = Math.max(1, Math.round(base.xp * k * (1 + talento(s.c, 'erudicion')) * (o.xpX || 1)));
        const oro = Math.max(1, Math.round(base.oro * k * rnd(0.8, 1.2) * mult));
        premios.push([s.id, xp, oro]);
        cobraron.add(s.id);
        // Solo quien peleo de verdad (pego o curo) avanza la caza del dia:
        // un compañero quieto en el grupo no la cumple sin jugar.
        this.dar(s, xp, oro, o, n, o.dano.has(s.id) || !!(o.cura && o.cura.has(s.id)));
        // mTON: como siempre, por la parte PROPIA de daño de cada uno.
        if (o.jefe && !o.mazmorra && this.parteJusta(o, s) >= 0.1) this.darMton(s, 20 * Math.max(0.3, MONSTRUOS[o.k].nivel / 30), 'jefe');
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
      this.guardarSuave(s);
    }
  }

  // Guardado no critico (viajes, cosmeticos): como mucho uno cada 3 s por
  // jugador; si no, queda sucio y lo guarda el tick o cerrar().
  // (Tambien maestria, logros y subidas por debajo de Nv 10: con el guardado
  // periodico de 60 s solo escribe si el ultimo guardado ya es viejo.)
  guardarSuave(s) {
    if (Date.now() - (s.guardadoT || 0) > GUARDAR_CADA_MS) return this.guardar(s);
    s.sucio = true;
  }

  // Suma experiencia y sube de nivel si toca. Devuelve si subio.
  sumarXp(s, xp) {
    const c = s.c;
    // En el nivel maximo la XP va a la maestria y sigue contando en el ranking semanal.
    if (c.nivel >= NIVEL_MAX) { this.sumarXpSemana(s, xp); this.sumarMaestria(s, xp); return false; }
    let subio = false;
    const nivel0 = c.nivel;
    c.xp += xp;
    this.sumarXpSemana(s, xp);
    while (c.nivel < NIVEL_MAX && c.xp >= xpParaSubir(c.nivel)) {
      c.xp -= xpParaSubir(c.nivel);
      c.nivel++;
      subio = true;
    }
    if (c.nivel >= NIVEL_MAX) c.xp = 0;
    // Nv 60: aviso a todo el mundo (un momento para presumir y para que los demas lo vean).
    if (subio && nivel0 < NIVEL_MAX && c.nivel >= NIVEL_MAX) this.aTodos({ t: 'aviso', m: `🏆 ${c.nombre} llegó al nivel ${NIVEL_MAX}, el máximo. ¡Una leyenda del Éter!` });
    if (subio && this.hitoEmbudo) { if (nivel0 < 5 && c.nivel >= 5) this.hitoEmbudo(c, 'n5'); if (nivel0 < 10 && c.nivel >= 10) this.hitoEmbudo(c, 'n10'); }
    if (subio) {
      s.st = this.stats(c);
      s.hp = s.st.maxHp;
      // Todas las aprendidas en este salto: una mision grande (o la Hora
      // Feliz) sube dos niveles de golpe y la del nivel saltado no se avisaba.
      const nuevas = HABS.filter(h => h.clase === c.clase && h.nv > nivel0 && h.nv <= c.nivel).sort((a, b) => a.nv - b.nv);
      if (nuevas.length) this.enviar(s, { t: 'toast', m: `${nuevas.length > 1 ? 'Nuevas habilidades' : 'Nueva habilidad'}: ${nuevas.map(h => h.nombre).join(', ')}`, ok: true, hab: nuevas[nuevas.length - 1].id });
      this.revisarLogros(s);
      this.hermSubioNivel(s);
      this.revisarAmigo(s).catch(e => console.error('[MMO amigo]', e));
      this.aClave(s.k, { t: 'lv', p: s.id, lv: c.nivel, mx: s.st.maxHp, rmx: s.st.recMax });
      this.actualizarRanking(s);
      // Los primeros niveles suben cada pocos minutos: sin escritura propia.
      if (c.nivel < 10) this.guardarSuave(s); else this.guardar(s);
    }
    return subio;
  }

  // n = miembros del grupo que cobran esta presa (reparte el botin).
  dar(s, xp, oro, o, n, participo) {
    const c = s.c;
    // Ceviche del Duende (pesca + artesania): +10% del oro de caza.
    if (this.elixir(s, 'ceviche')) oro = Math.round(oro * 1.1);
    if (this.elixir(s, 'chichaE')) oro = Math.round(oro * 1.1);   // Chicha Morada del Duende
    c.oro += oro;
    c.kills++;
    if (c.kills === 1 && this.hitoEmbudo) this.hitoEmbudo(c, 'c1');
    // Primera caza del personaje (una sola vez): botin garantizado y nivel 2.
    const primero = c.kills === 1 && !!o && participo !== false;
    if (o && o.jefe) c.jefes++;
    // Hora Feliz (cada dia 01-02 UTC): +50% de la XP de caza.
    if (horaFelizActiva()) xp = Math.round(xp * HORA_FELIZ.xp);
    // Elixir de Sabiduria (artesania): +10% de la XP de caza. Skins con xpMult.
    if (this.elixir(s, 'elixirX')) xp = Math.round(xp * 1.1);
    if (this.elixir(s, 'chichaE')) xp = Math.round(xp * 1.05);
    const xpSkin = ((SKINS[c.skin] || {}).buffs || {}).xpMult;
    if (xpSkin) xp = Math.round(xp * xpSkin);
    // Invitado de Nv < 10 en grupo con quien lo invito: +25% (amigos.js).
    if (this.bonoCompanero) xp = Math.round(xp * this.bonoCompanero(s));
    // El descanso duplica la experiencia de cada caza hasta gastarse.
    const extra = Math.min(c.descanso || 0, xp);
    if (extra > 0) { c.descanso -= extra; xp += extra; }
    if (primero && c.nivel === 1) xp = Math.max(xp, xpParaSubir(1) - c.xp);
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
      if (primero && !item) {
        // Se equipa solo si la ranura esta vacia (que se note al instante).
        const it1 = generarItem(Math.min(nvM, c.nivel), 1);
        if (!c.eq[it1.s]) {
          c.eq[it1.s] = it1; item = it1;
          const pct = s.hp / s.st.maxHp;
          s.st = this.stats(c);
          s.hp = Math.max(1, Math.min(s.st.maxHp, Math.round(s.st.maxHp * pct)));
          this.difundirApariencia(s);   // los demas ven su nueva vida maxima
        } else item = this.darItem(s, it1);
      }
    }
    // Diaria: monstruos de su nivel o hasta 5 por debajo.
    const d = this.diariaDe(c);
    if (o && participo !== false && !d.ok && d.p < DIARIA.n && (o.nv || MONSTRUOS[o.k].nivel) >= c.nivel - 5) {
      d.p++;
      if (d.p === DIARIA.n) this.mision(s, { diaria: true }, 'auto');   // se cobra sola al cumplirla
    } else if (o && participo !== false && !d.ok && d.p < DIARIA.n && !s.avisoDiariaNv) {
      s.avisoDiariaNv = 1;   // una sola vez por sesion
      this.enviar(s, { t: 'toast', m: `☀ ${MONSTRUOS[o.k].nombre} es muy débil para la Caza del día: cuentan los de Nv ${c.nivel - 5} o más.` });
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
      if (c.mis.p === q.n) {
        // ORIGINS: se entrega sola al cumplirla (alli ya valia desde cualquier sitio).
        // La primera mision tambien en CLASSIC: el novato cobra sin volver al pueblo.
        if (s.m3 || c.mis.i === 0) { this.enviar(s, { t: 'toast', m: `Misión cumplida: «${q.nombre}».`, ok: true }); this.mision(s, null, true); }
        else this.enviar(s, { t: 'toast', m: `Misión cumplida: «${q.nombre}». Entrégala al Guardia Tito.`, ok: true });
      }
    }
    s.sucio = true;
    this.enviar(s, { t: 'gana', xp, oro, drops, item, primero: primero ? (item && c.eq[item.s] === item ? 2 : 1) : undefined, cal: cal || undefined, tp: cal ? tp.id : undefined, chi: chi || undefined, chl: !chi && this.candadoChicha(c) ? 1 : undefined, x: Math.round(o ? o.x : s.x), y: Math.round(o ? o.y - o.h : s.y - 60) });
    this.revisarLogros(s, true);
    this.yoLuego(s, subio || !!item);
  }

  // Entregar la mision (o la diaria) al Guardia Tito.
  // desde3d: en ORIGINS se entrega desde cualquier sitio (recibir3d o dar() al cumplirla).
  mision(s, m, desde3d) {
    const c = s.c;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'guia');
    if (!(desde3d === 'auto' || (desde3d === true && (s.m3 || c.mis.i === 0))) && (s.k !== 'pueblo' || !npc || Math.abs(s.x - npc.x) > 200)) return this.enviar(s, { t: 'toast', m: 'Habla con el Guardia Tito en el pueblo.' });
    if (m && m.diaria) {
      const d = this.diariaDe(c);
      if (d.ok) return this.enviar(s, { t: 'toast', m: 'Ya cobraste la caza de hoy.' });
      if (d.p < DIARIA.n) return this.enviar(s, { t: 'toast', m: `Te faltan ${DIARIA.n - d.p} monstruos para la caza del día.` });
      const pr = premioDiaria(c.nivel);
      d.ok = true;
      c.oro += pr.oro;
      c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pr.pocion);
      this.sumarXp(s, pr.xp);
      this.enviar(s, { t: 'toast', m: `✅ Caza del día: +${pr.xp} XP · +${pr.oro} oro · +${pr.pocion} pociones. Mañana hay otra.`, ok: true });
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
    if (c.mis.i === 1 && this.hitoEmbudo) this.hitoEmbudo(c, 'm1');
    if (c.mis.i === 1 && this.ofrecerAvisoTg) this.ofrecerAvisoTg(s).catch(() => {});   // «Avísame por Telegram» (web e invitados)
    this.sumarXp(s, q.xp);
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', m: `✅ Recompensa: +${q.xp} XP · +${q.oro} oro`, ok: true });
    // La siguiente de la cadena, dicha en el momento (antes el jugador no sabia que seguia).
    const sig = MISIONES[c.mis.i], ms = sig && MONSTRUOS[sig.tipo];
    if (sig && ms) this.enviar(s, { t: 'toast', m: `📜 Nueva misión: «${sig.nombre}» — caza ${sig.n} × ${ms.nombre} (Nv ${ms.nivel}).${s.m3 ? ' Sigue la luz amarilla.' : ''}` });
    this.enviar(s, { t: 'gana', xp: q.xp, oro: q.oro, drops: Object.keys(q.pw || {}), x: Math.round(s.x), y: Math.round(s.y - 80) });
    this.actualizarYo(s);
    this.guardar(s);
  }

  herir(s, dmg, fuente) {
    if (s.muerto) return;
    const ahora = Date.now();
    const pct = fuente && fuente.pct;
    const duelo = fuente && fuente.duelo, pvp = fuente && fuente.pvp;
    if (pvp) s.pvpT = ahora;   // para no huir del PvP cerrando el juego (cerrar())
    // El Escudo (consumible que se puede comprar) protege de monstruos, no de jugadores.
    if ((ahora < s.inv && !pct && !duelo && !pvp) || (ahora < s.escudo && !duelo && !pvp) || this.aura(s, 'bloque')) return;
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
    if (this.aura(s, 'bendicion')) real = Math.round(real * 0.75);   // Bendicion del Duende (ORIGINS, tras 3 muertes seguidas)
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
    s.golpes.push({ t: ahora, n: mo ? MONSTRUOS[mo.k].nombre : atacante && atacante.c ? atacante.c.nombre : 'Daño', nv: mo ? (mo.nv || MONSTRUOS[mo.k].nivel) : atacante && atacante.c ? atacante.c.nivel : 0, d: real, vi: mo && mo.max > 0 ? Math.max(1, Math.ceil(mo.hp / mo.max * 100)) : undefined });
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
    if (s.hp <= 0) { this.morir(s, !!pvp); if (atacante && this.muertePvP) this.muertePvP(atacante, s); this.actualizarYo(s); }
  }

  // pvp: abatido por la otra faccion (ya paga Puntos del Abismo, no XP).
  morir(s, pvp) {
    s.hp = 0;
    s.muerto = true;
    s.muertoPvP = !!pvp;
    if (s.c) s.c.muertoPvP = !!pvp;   // si cierra estando muerto, al volver tampoco pierde XP
    s.montado = null;
    s.combo = 0;
    this.cancelarCast(s);
    this.limpiarAuras(s);
    if (s.m3) this.olvidar3d(s); else this.olvidar(s);
    this.aClave(s.k, { t: 'pm', p: s.id });
    // ORIGINS: 3 muertes en 10 min (sin PvP) cortan la espiral: se revive sin perder XP
    // y con la Bendicion del Duende (una vez cada 30 min; bendT se guarda en el personaje).
    const ahora = Date.now(), c = s.c;
    s.espiral = false;
    if (s.m3 && !pvp) {
      s.muertesT = (s.muertesT || []).filter(t => ahora - t < 600000);
      s.muertesT.push(ahora);
      s.espiral = s.muertesT.length >= 3 && ahora > (c.bendT || 0);
    }
    // Lo que costara revivir (lo mismo que descuentan revivir y revivir3d).
    const xpPerdida = c.nivel < 10 || (s.m3 && (pvp || s.espiral)) ? 0 : Math.min(c.xp || 0, Math.round(xpParaSubir(c.nivel) * 0.05));
    const gs = s.golpes || [], ult = gs[gs.length - 1];   // el ultimo golpe: a quien le quedaba vida
    this.enviar(s, { t: 'muerte', golpes: (s.golpes || []).map(x => ({ n: x.n, nv: x.nv, d: x.d })), pw: c.pw.pocion || 0, inst: !!(this.mundo[s.k] && this.mundo[s.k].inst), rep: costoReparacion(c.nivel), pvp: pvp ? 1 : undefined,
      xp: xpPerdida, novato: c.nivel < 10 ? 1 : undefined, espiral: s.espiral ? 1 : undefined, vi: ult && ult.vi ? ult.vi : undefined, vn: ult && ult.vi ? ult.n : undefined });
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
    // En el nivel maximo (sin XP que perder) se paga la reparacion del equipo.
    const rep = Math.min(c.oro, costoReparacion(c.nivel));
    if (rep > 0) { c.oro -= rep; this.enviar(s, { t: 'toast', m: `🔧 Reparaste tu equipo: -${rep.toLocaleString('es', { useGrouping: 'always' })} oro.` }); }
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
    // En duelo (ya empezado) no hay pociones: las pociones se compran y el duelo no.
    if (def.id === 'pocion' && s.duelo && ahora >= (s.duelo.ini || 0)) return this.no(s, 'En un duelo no se usan pociones: gana el más hábil.');
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
    if (s.m3) return this.cerca3d(s, 'tienda') || (!s.i3 && zonaEn3d(s.p.x, s.p.z) === 'pueblo');   // ORIGINS: todo el pueblo (el 💎 abre la tienda en cualquier sitio)
    if (s.k !== 'pueblo') return false;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'tienda');
    return npc && Math.abs(s.x - npc.x) < 200;
  }

  comprar(s, m) {
    const c = s.c;
    // Ponerse algo que ya es tuyo (montura, alas, color, mascota) vale en cualquier sitio.
    const lista = { montura: c.monturas, alas: c.alas, tinte: c.tintes, mascota: c.mascotas }[m.k];
    const soloPoner = typeof m.id === 'string' && Array.isArray(lista) && lista.includes(m.id);
    if (!soloPoner && !(s.m3 && m.k === 'skin') && !this.cercaDelMercader(s)) return this.enviar(s, { t: 'toast', m: s.m3 ? 'Para comprar ve al Pueblo Duende (en cualquier punto del pueblo vale).' : 'Tienes que estar junto al Mercader del pueblo.' });
    if (m.k === 'pw') {
      const def = PODERES.find(p => p.id === m.id);
      const n = clamp(m.n | 0, 1, 10);
      if (!def) return;
      const costo = def.precio * n;
      if (c.oro < costo) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(costo - c.oro).toLocaleString('es-PE')}.`, falta: costo - c.oro });
      if ((c.pw[def.id] || 0) + n > 99) return this.enviar(s, { t: 'toast', m: 'Máximo 99 de cada consumible.' });
      c.oro -= costo; c.pw[def.id] = (c.pw[def.id] || 0) + n;
    } else if (m.k === 'forja') {
      if (typeof m.id !== 'string' || !Object.hasOwn(ARMAS, m.id) || !c.armas.includes(m.id)) return;
      const nv = c.forja[m.id] || 0;
      if (nv >= FORJA_MAX) return this.enviar(s, { t: 'toast', m: 'Esa arma ya está al máximo (+' + FORJA_MAX + ').' });
      const costo = costoForja(nv);
      if (c.oro < costo) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(costo - c.oro).toLocaleString('es-PE')}.`, falta: costo - c.oro });
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
      if (c.oro < mo.precio) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(mo.precio - c.oro).toLocaleString('es-PE')}.`, falta: mo.precio - c.oro });
      c.oro -= mo.precio;
      c.monturas.push(m.id);
      c.montura = m.id;
    } else if (m.k === 'alas') {
      if (typeof m.id !== 'string' || !Object.hasOwn(ALAS, m.id)) return;
      const al = ALAS[m.id];
      c.alas = c.alas || ['aprendiz'];
      if (c.alas.includes(m.id)) { if (c.ala === m.id) return; c.ala = m.id; this.difundirApariencia(s); this.actualizarYo(s); return this.enviar(s, { t: 'toast', m: `🪽 Ahora llevas: ${al.nombre}.`, ok: true }); }
      if (al.premium) return this.enviar(s, { t: 'toast', m: 'Esas alas son premium: están en la tienda PREMIUM.' });
      if (al.mazmorras) return this.enviar(s, { t: 'toast', m: `Esas alas no se venden: se ganan completando ${al.mazmorras} mazmorras.` });
      if (c.nivel < al.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${al.nv} para esas alas.` });
      if (c.oro < al.precio) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(al.precio - c.oro).toLocaleString('es-PE')}.`, falta: al.precio - c.oro });
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
          if (tn.racha) return this.enviar(s, { t: 'toast', m: `Ese color no se vende: se gana entrando ${tn.racha} días seguidos.` });
          if (tn.amb &&!enOfertaAmbulante('tinte', m.id)) return this.enviar(s, { t: 'toast', m: 'Ese color solo lo trae el Mercader ambulante algunos fines de semana.' });
          if (c.nivel < tn.nv) return this.enviar(s, { t: 'toast', m: `Necesitas nivel ${tn.nv} para ese color.` });
          if (c.oro < tn.precio) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(tn.precio - c.oro).toLocaleString('es-PE')}.`, falta: tn.precio - c.oro });
          c.oro -= tn.precio;
          c.tintes.push(m.id);
        }
        if (c.tinte === m.id) return;
        c.tinte = m.id;
      }
      this.difundirApariencia(s);
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
          if (c.oro < ma.precio) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(ma.precio - c.oro).toLocaleString('es-PE')}.`, falta: ma.precio - c.oro });
          c.oro -= ma.precio;
          c.mascotas.push(m.id);
        }
        if (c.mascota === m.id) return;
        c.mascota = m.id;
      }
      this.difundirApariencia(s);
    } else if (m.k === 'arma' || m.k === 'skin') {
      const tabla = m.k === 'arma' ? ARMAS : SKINS;
      const lista = m.k === 'arma' ? c.armas : c.skins;
      // hasOwn y no tabla[id]: '__proto__' o 'constructor' existen en cualquier
      // objeto y dejaban el oro en NaN al "comprarlos".
      if (typeof m.id !== 'string' || !Object.hasOwn(tabla, m.id)) return;
      const def = tabla[m.id];
      if (lista.includes(m.id)) return this.enviar(s, { t: 'toast', m: 'Ya lo tienes.' });
      // Las premium no se venden por oro (precio null: c.oro -= null no restaba nada).
      if (typeof def.precio !== 'number') return this.enviar(s, { t: 'toast', m: 'Esta skin solo se consigue en la tienda premium (💎 PAQUETES).' });
      const precio = precioOro(m.k, m.id);
      if (c.oro < precio) return this.enviar(s, { t: 'toast', m: `No te alcanza el oro: te faltan ${(precio - c.oro).toLocaleString('es-PE')}.`, falta: precio - c.oro });
      c.oro -= precio;
      lista.push(m.id);
      this.equipar(s, { k: m.k, id: m.id });
    } else return;
    this.revisarLogros(s);
    this.enviar(s, { t: 'toast', m: m.k === 'forja' ? `${ARMAS[m.id].nombre} mejorada a +${c.forja[m.id]}.` : m.k === 'montura' ? `Nueva montura: ${MONTURAS[m.id].nombre}. Tecla Y o botón de montura.` : m.k === 'tinte' ? (c.tinte ? `🎨 Tu nombre ahora es ${TINTES[c.tinte].nombre}.` : '🎨 Tu nombre vuelve al color de tu clase.') : m.k === 'mascota' ? (c.mascota ? `🐾 ${MASCOTAS[c.mascota].nombre} te acompaña.` : '🐾 Guardaste a tu mascota.') : '✅ Compra realizada', ok: true });
    this.actualizarYo(s);
    if (m.k === 'tinte' || m.k === 'mascota') this.guardarSuave(s); else this.guardar(s);   // cosmeticos: sin escritura por mensaje
  }

  equipar(s, m) {
    const c = s.c;
    if (typeof m.id !== 'string') return;
    // Sin cambio no se difunde nada (antes, repetirlo en bucle inundaba a todo el mundo 3D).
    if ((m.k === 'arma' && c.arma === m.id) || (m.k === 'skin' && c.skin === m.id)) return;
    if (m.k === 'arma' && c.armas.includes(m.id) && Object.hasOwn(ARMAS, m.id)) c.arma = m.id;
    else if (m.k === 'skin' && c.skins.includes(m.id) && Object.hasOwn(SKINS, m.id)) {
      c.skin = m.id;
      const pct = s.hp / s.st.maxHp;
      s.st = this.stats(c);
      s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    } else return;
    s.sucio = true;
    this.difundirApariencia(s);
    this.actualizarYo(s);
  }

  // ── RANKING ──
  async actualizarRanking(s) {
    if (UIDS_PRUEBA.has(s.c.uid) || this.diosActivo(s)) return;
    const r = await this.rankingLeer();
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, lv: s.c.nivel, xp: s.c.xp, k: s.c.kills };
    // Fuera del top 50 y sin estar en el: no cambia nada (ni se escribe).
    const ult = r[r.length - 1];
    if (i < 0 && r.length >= 50 && ult && (fila.lv < ult.lv || (fila.lv === ult.lv && fila.xp <= ult.xp))) return;
    if (i >= 0) r[i] = fila; else r.push(fila);
    r.sort((a, b) => b.lv - a.lv || b.xp - a.xp);
    if (r.length > 50) r.length = 50;
    this.rankSucio = true;   // lo vuelca volcarRanking (tick, cerrar o copia)
  }

  // El ranking de niveles en memoria (una lectura por arranque). Lo cambian
  // actualizarRanking y la herencia; el storage se pone al dia en volcarRanking.
  rankingLeer() {
    if (!this._rankP) {
      const p = this._rankP = this.state.storage.get('ranking').then(r => Array.isArray(r) ? r : []);
      p.catch(() => { if (this._rankP === p) this._rankP = null; });
    }
    return this._rankP;
  }
  async volcarRanking(forzar) {
    if (!this.rankSucio || !this._rankP) return;
    const ahora = Date.now();
    // En modo ahorro (salud.js) los rankings van pausados: cada 10 min.
    if (!forzar && ahora - (this.rankT || 0) < (this.degradado() ? 600000 : RANKING_CADA_MS)) return;
    this.rankT = ahora; this.rankSucio = false;
    try { await this.state.storage.put('ranking', await this._rankP); }
    catch (e) { this.rankSucio = true; console.error('[MMO ranking]', e); }
  }
  // Lo que vive en memoria al storage (al quedar vacio el mundo y antes de una copia).
  async volcarMemoria() {
    await this.volcarRanking(true);
    // XP de la semana pendiente (revisarSemana la vuelca cada minuto solo con gente conectada):
    // al quedar vacio el mundo el DO se puede apagar y se perdia el ultimo minuto.
    if (this.rs && this.rsSucio && this.rs.sem === semanaUTC()) {
      this.rsT = Date.now(); this.rsSucio = false;
      try { await this.state.storage.put('rankSem', { sem: this.rs.sem, l: Object.fromEntries(this.topSemana().slice(0, 1000)) }); } catch (e) { this.rsSucio = true; console.error('[MMO rankSem]', e); }
    }
    if (this.retVolcar) await this.retVolcar();
    if (this.retVolcarDias) await this.retVolcarDias(true);
    // Embudo de carga y contadores de salud: sus temporizadores no llegan si el DO se apaga.
    if (this.evVolcar) { try { await this.evVolcar(); } catch (e) { console.error('[MMO ev volcar]', e); } }
    if (this.volcarMet && Date.now() - (this.metT || 0) > 60000) await this.volcarMet();
  }

  async enviarRanking(s) {
    // Como mucho cada 3 s por jugador (lee el storage y ordena todo).
    if (Date.now() - (s.rankT || 0) < 3000) return;
    s.rankT = Date.now();
    const r = (await this.rankingLeer()).filter(x => !UIDS_PRUEBA.has(x.uid));
    const sem = this.topSemana().slice(0, 20).map(([uid, x]) => ({ n: x.n, lv: x.lv, xp: x.xp, yo: uid === s.c.uid }));
    const des = ((await this.state.storage.get('rankDes')) || []).slice(0, 10).map(x => ({ n: x.n, k: x.k, yo: x.uid === s.c.uid }));
    const dsem = this.topDesSem().slice(0, 10).map(([uid, x]) => ({ n: x.n, k: x.k, yo: uid === s.c.uid }));
    const duel = ((await this.state.storage.get('rankDuelo')) || []).slice(0, 10).map(x => ({ n: x.n, e: x.e, g: x.g, yo: x.uid === s.c.uid }));
    const torre = (await this.topTorre()).slice(0, 10).map(([uid, x]) => ({ n: x.n, p: x.p, yo: uid === s.c.uid }));
    const herm = (await this.topHerm()).slice(0, 5).map(([id, x]) => ({ n: x.n, p: x.p, m: x.m, yo: id === s.c.herm }));
    this.enviar(s, { t: 'ranking', r: r.slice(0, 20).map(x => ({ n: x.n, lv: x.lv, k: x.k, yo: x.uid === s.c.uid })), sem, des, dsem, duel, elo: s.c.elo || 0, torre, tmax: this.torreSem(s.c).max, herm, temp: s.c.faccion || s.c.nivel >= 20 ? this.infoTemp(s.c) : null, af: afijosSemana(), finSem: Date.parse(this.rs.sem + 'T00:00:00Z') + 7 * 86400000 + 5 * 3600000 });   // lunes 00:00 de Lima
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
      const { s, c } = await this.pjDe(uid);
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
    if (this.rds && this.rds.sem < sem) {   // con < : una semana futura (lunes UTC antiguo) no se premia dos veces
      const vieja = this.rds;
      this.rds = { sem, l: {} };
      await this.state.storage.put('rankDesSem', this.rds);
      await this.premiarDesSem(vieja);
    }
    if (this.rt ? this.rt.sem < sem : true) await this.cargarRankTorre();
    if (this.rs.sem < sem) {
      const vieja = this.rs;
      this.rs = { sem, l: {} };
      await this.state.storage.put('rankSem', this.rs);
      await this.premiarSemana(vieja);
      return;
    }
    if (this.rsSucio && ahora - (this.rsT || 0) > (this.degradado() ? 600000 : 60000)) {   // modo ahorro (salud.js): cada 10 min
      this.rsT = ahora; this.rsSucio = false;
      // En memoria se conserva a todos (antes se cortaba al top 100 y el puesto 101
      // perdia su XP de la semana); al storage van como mucho 1000 filas (< 128 KiB).
      const l = Object.fromEntries(this.topSemana().slice(0, 1000));
      // Un fallo del storage no tumba el tick: queda sucio y se reintenta.
      try { await this.state.storage.put('rankSem', { sem: this.rs.sem, l }); } catch (e) { this.rsSucio = true; console.error('[MMO rankSem]', e); }
    }
  }
  async premiarSemana(rs) {
    const top = Object.entries(rs.l).sort((a, b) => b[1].xp - a[1].xp).slice(0, 3);
    const nombres = [];
    for (let i = 0; i < top.length; i++) {
      const [uid, f] = top[i];
      const { s, c } = await this.pjDe(uid);
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

  // El personaje de uid para cambiarlo desde fuera de su sesion (premios,
  // pedidos, devoluciones): el de la sesion si esta conectado y si no el del
  // storage. Si esta ENTRANDO (holaCuenta ya leyo su copia pero aun no esta en
  // porUid) se espera a que termine: escrito en el storage, su guardado lo pisaba.
  async pjDe(uid) {
    for (let i = 0; i < 3; i++) {
      const e = this.entrando && this.entrando.get(uid);
      if (e && e.entrandoP) { let t; await Promise.race([e.entrandoP, new Promise(r => { t = setTimeout(r, 20000); })]); clearTimeout(t); }
      const s = this.porUid.get(uid);
      if (s && s.c) return { s, c: s.c };
      const c = await this.state.storage.get('c:' + uid);
      // Empezo a entrar mientras se leia: otra vuelta (como mucho tres).
      if (i === 2 || (!(this.entrando && this.entrando.has(uid)) && !this.porUid.has(uid))) return { s: null, c };
    }
  }

  // ── GUARDADO ──
  async guardar(s) {
    if (!s.c || s.noGuardar) return;   // noGuardar: se esta restaurando desde una copia
    // Invitado recien creado: no se escribe hasta Nv 2 o 2 min jugados (hola). Sigue
    // 'sucio', asi que el ciclo de guardado lo escribe en cuanto cumple.
    // Invitado que se va tras jugar de verdad (45 s, gano oro: empieza con 100, o vino de un anuncio): se escribe ya.
    if (s.diferirT && s.cerrado && (Date.now() - s.diferirT > 45000 || (s.c.oro || 0) > 100 || (s.c.ret && s.c.ret.fbc))) { s.diferirT = 0; if (this.diferidos) this.diferidos.delete(s.c.uid); }
    if (s.diferirT) {
      if ((s.c.nivel || 1) < 2 && Date.now() - s.diferirT < 120000) {
        s.sucio = true;
        // Se recuerda en memoria (hola lo recupera si reconecta en menos de 10 min).
        const dm = this.diferidos || (this.diferidos = new Map());
        dm.set(s.c.uid, { c: s.c, t: s.diferirT });
        if (dm.size > 3000) for (const [k, v] of dm) if (Date.now() - v.t > 600000) dm.delete(k);
        // Tope duro: si siguen siendo demasiados (oleada de invitados), fuera los mas viejos.
        if (dm.size > 4000) for (const k of [...dm.keys()].slice(0, dm.size - 3000)) if (k !== s.c.uid) dm.delete(k);
        return;
      }
      s.diferirT = 0;
      if (this.diferidos) this.diferidos.delete(s.c.uid);
    }
    s.c.x = Math.round(s.x || s.c.x || 0);
    if (typeof s.hp === 'number') s.c.hp = Math.ceil(s.hp);
    s.c.muerto = !!s.muerto;
    s.c.salida = Date.now();
    s.guardadoT = Date.now();
    s.sucio = false; s.sucioPos = false;
    try { this.retAlGuardar(s); } catch (e) { console.error('[MMO retAlGuardar]', e); }
    // Si el guardado falla se reintenta en el siguiente ciclo, a los 60 s (guardadoT ya
    // es ahora): sin reintentos seguidos que gasten el cupo. No se pierde el progreso.
    try { await this.state.storage.put('c:' + s.c.uid, s.c); } catch (e) { s.sucio = true; console.error('[MMO guardar]', e); }
  }

  // ── SIMULACION ──
  // Cada subsistema y cada mapa va aislado: una excepcion con un monstruo,
  // evento o personaje raro ya no congela el resto del mundo (sale en el log
  // como mucho una vez cada 30 s por subsistema). En el arnes (estricto) se
  // relanza para que la prueba falle en el sitio.
  paso(n, fn) {
    try { fn(); }
    catch (e) {
      if (this.estricto) throw e;
      const t = Date.now();
      this.errT = this.errT || {};
      if (t - (this.errT[n] || 0) > 30000) { this.errT[n] = t; console.error('[MMO tick ' + n + ']', e); }
    }
  }

  tick() {
    const ahora = Date.now();
    this.medirLag(ahora);   // salud.js
    const cadaGuardar = this.degradado() ? GUARDAR_AHORRO_MS : GUARDAR_CADA_MS;
    if (ahora - (this.onT || 0) > 10000) {
      this.onT = ahora;
      this.paso('10s', () => {
        // Aviso a todos al empezar y al acabar la Hora Feliz.
        const hf = horaFelizActiva(ahora);
        if (this.hfAntes !== undefined && hf !== this.hfAntes) this.aTodos({ t: 'aviso', m: hf ? 'Empieza la Hora Feliz: +50% de experiencia por caza durante una hora.' : '⚡ Terminó la Hora Feliz.' });
        this.hfAntes = hf;
        // Una pestaña abierta sin jugar mantiene vivo el objeto (y cobra tiempo
        // de CPU del cupo diario) todo el dia: fuera tras 10 min sin actividad.
        // Minutos jugados de verdad (con actividad en el último minuto): requisito del premio de Nv 60 (chicha.js).
        const dtJ = Math.min(30, Math.round((ahora - (this.onJT || ahora)) / 1000)); this.onJT = ahora;
        for (const s of [...this.sesiones.values()]) {
          if (s.c && dtJ > 0 && ahora - (s.actT || 0) < 60000) this.sumarJugado(s.c, dtJ);
          if (s.c && ahora - (s.actT || 0) > INACTIVO_MS) {
            this.enviar(s, { t: 'err', m: 'Te desconectamos por inactividad. Toca la pantalla o pulsa una tecla para volver.', fatal: true, inactivo: true });
            try { s.ws.close(4001, 'inactivo'); } catch (e) {}
            this.cerrar(s);
          }
        }
        this.contarHoy().then(h => this.aTodos({ t: 'on', n: this.contarOnline(), h }), () => this.aTodos({ t: 'on', n: this.contarOnline() }));
        this.revisarSemana(ahora).catch(e => console.error('[MMO semana]', e));
        this.volcarRanking().catch(e => console.error('[MMO ranking]', e));
        if (this.retVolcarDias) this.retVolcarDias().catch(e => console.error('[MMO ret]', e));
        this.revisarSalud(ahora);
      });
    }
    this.paso('mundial', () => this.revisarMundial(ahora));
    this.paso('grupos', () => this.tickGrupos(ahora));
    this.paso('herms', () => this.guardarHermsSucias(ahora));
    this.paso('duelos', () => this.tickDuelos(ahora));
    const porClave = {}, en3d = [];
    for (const s of this.sesiones.values()) {
      if (!s.c) continue;
      // Progreso cada 60 s (3 min en modo ahorro); si solo se movio, cada 5 min.
      if ((s.sucio && ahora - s.guardadoT > cadaGuardar) || (s.sucioPos && ahora - s.guardadoT > GUARDAR_POS_MS)) this.guardar(s).catch(e => console.error('[MMO guardar]', e));
      if (s.m3) { en3d.push(s); continue; }   // el mundo 3D va aparte
      (porClave[s.k] = porClave[s.k] || []).push(s);
    }
    this.paso('3d', () => this.tick3d(ahora, en3d));
    // Invasiones, raros (functions/mmo/eventos.js): solo mira zonas con gente.
    this.paso('eventos', () => this.tickEventos(ahora, porClave));
    for (const k in porClave) this.paso('mapa:' + k, () => this.simularMapa(k, porClave[k], ahora));
    // Instancias vacias (todos salieron): se cierran solas.
    this.paso('inst', () => { if (this.limpiarInstancias) this.limpiarInstancias(porClave, ahora); });
    this.paso('torres', () => this.limpiarTorres(porClave, ahora));
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
      if (s.muerto || !((SKINS[s.c.skin] || {}).buffs || {}).aura || ahora < s.auraT) continue;
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
    // Pocos jugadores: la misma foto para todos. Muchos (fiesta en el pueblo):
    // cada uno recibe solo las filas a menos de VISTA_2D px, mas su grupo y su
    // rival de duelo, con tope de TOPE_2D; cada fila se serializa una sola vez.
    // Los que quedan fuera de pantalla (a mas de LEJOS_2D px) llegan una foto si y otra no.
    if (jugadores.length <= 12) {
      const txt = JSON.stringify(snap);
      for (const s of jugadores) this.enviar(s, txt);
      return;
    }
    const filas = new Map(jugadores.map((s, i) => [s.id, JSON.stringify(snap.p[i])]));
    snap.p = [];
    const json = JSON.stringify(snap), corte = json.indexOf('"p":[]') + 5;   // justo dentro de los corchetes de p
    const resto = [json.slice(0, corte), json.slice(corte)];
    const par = (w.nSnap = (w.nSnap || 0) + 1) & 1;
    for (const s of jugadores) {
      const fijos = new Set([s.id]);
      const g = this.grupoDe && this.grupoDe(s);
      if (g) for (const x of this.sesionesGrupo(g)) if (filas.has(x.id)) fijos.add(x.id);
      const d = this.rivalDuelo && this.rivalDuelo(s);
      if (d && filas.has(d.id)) fijos.add(d.id);
      const cerca = [];
      for (const x of jugadores) if (!fijos.has(x.id)) { const dx = Math.abs(x.x - s.x); if (dx <= VISTA_2D) cerca.push([x.id, dx]); }
      const cupo = Math.max(0, TOPE_2D - fijos.size);
      if (cerca.length > cupo) { cerca.sort((a, b) => a[1] - b[1]); cerca.length = cupo; }
      const pj = [];
      for (const id of fijos) pj.push(filas.get(id));
      for (const [id, dx] of cerca) if (dx <= LEJOS_2D || ((id + par) & 1)) pj.push(filas.get(id));
      this.enviar(s, resto[0] + pj.join(',') + resto[1]);
    }
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
// Equilibrio de facciones y Temporada del Abismo: functions/mmo/temporada.js
Object.assign(MmoWorld.prototype, Temporada);
// Copias de seguridad diarias (fuera de Cloudflare) y restauracion: functions/mmo/copias.js
Object.assign(MmoWorld.prototype, Copias);
// Vincular Telegram y correo al mismo duende: functions/mmo/vincular.js
Object.assign(MmoWorld.prototype, Vincular);
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
// Cupo de escrituras, lag y modo ahorro: functions/mmo/salud.js
Object.assign(MmoWorld.prototype, Salud);
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
Object.assign(MmoWorld.prototype, Encargos);
Object.assign(MmoWorld.prototype, Secundarias);
// Pieza de equipo nueva (para los modulos que no ven generarItem).
MmoWorld.prototype.nuevoItem = (nv, r) => generarItem(nv, r);
MmoWorld.prototype.generarItem = generarItem;
