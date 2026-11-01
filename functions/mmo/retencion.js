// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — retencion: estadisticas reales y avisos de vuelta
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Por personaje (en el propio c, campo c.ret):
//   { d: [dias UTC jugados, los ultimos 60, como numero de dia], dt: dias
//     distintos en total, ses: sesiones, min: minutos jugados, visto: ultima
//     vez (ms), u: uid con el que se registro, alta: 1 si se conto como alta }
//   La primera vez visto es c.creado (ya existia) y el nivel es c.nivel.
//
// Agregados en el storage del DO (para no recorrer a todos los personajes):
//   ret:dia:<YYYY-MM-DD> → { n: altas, a: activos, ses, min, r1, r7, r30 }
//     r1/r7/r30 = de los que se dieron de alta ESE dia, cuantos volvieron
//     exactamente 1, 7 y 30 dias despues (retencion "dia N" clasica).
//     r8/r14 = igual a los 8 y 14 dias (semanas 2 y 3 de la racha larga).
//   ret:idx → { uid: { v: ultimo dia jugado, l: nivel, a: avisos sin
//     respuesta, ad: dia del ultimo aviso, off: 1 si pidio no recibir avisos,
//     bloq: 1 si bloqueo al bot, hs: hora UTC de su primera entrada de cada
//     dia, las ultimas 10 } }
//     Un solo objeto: con la escala actual (decenas de jugadores) cabe de
//     sobra y evita listar todos los c:<uid> (que pesan bolsa, equipo...)
//     para contar activos o elegir a quien avisar.
//
// Los avisos salen a la HORA HABITUAL de cada uno (la que mas se repite en
// sus primeras entradas del dia; con 1 o 2 dias anotados, la de la ultima;
// sin ninguno, las 17:00 UTC). Las 17:00 las manda el cron (functions/api/cron.js) por la ruta
// interna 'recordatorios'; el resto de horas, la alarma del propio Durable
// Object (alarm(), cada hora en punto), sin gastar otro disparador de cron.
// Reglas para no hacer spam: solo cuentas de Telegram que jugaron en los
// ultimos 14 dias y no entraron hoy, 1 aviso al dia como mucho, y tras 2
// avisos sin volver se pausa hasta que vuelva. Excepcion: al empezar un evento
// de temporada (data TEMPORADAS) se manda UN aviso extra por evento aunque
// este en pausa o lleve hasta OLVIDAR_DIAS sin jugar (e.ev = id del ultimo
// evento avisado); off y bloq se respetan siempre.
// ═══════════════════════════════════════════════════════

import { xpParaSubir, premioDiaria, premioMazmorraDia, multLogin, diaRacha, semanaRacha, multSemanaRacha, premioRacha, HABS, CLASES, NIVEL_MAX, DIARIA, horaFelizActiva, TORRE, semanaUTC, temporadaDe, TEMPORADAS } from '../../mmo/js/data.js';
import { getEnv, tg } from '../api/lib.js';
import { MMO_URL } from '../api/telegram-bot.js';

const DIA_MS = 86400000;
const DIAS_GUARDADOS = 60;          // dias jugados que se recuerdan por personaje
const VENTANA_AVISO = 14;           // solo se avisa a quien jugo en estos dias
const AVISOS_SIN_RESPUESTA = 2;     // despues de esto, pausa hasta que vuelva
const POR_SEGUNDO = 25;             // Telegram corta a ~30 mensajes/s por bot
const OLVIDAR_DIAS = 35;            // el indice olvida a quien no juega hace mas
const NIVEL_MAZMORRA = 6;           // la primera mazmorra (Madriguera Goblin) pide Nv 6

export const diaNum = (t = Date.now()) => Math.floor(t / DIA_MS);
export const diaISO = n => new Date(n * DIA_MS).toISOString().slice(0, 10);
const fmt = n => Math.round(n).toLocaleString('es', { useGrouping: 'always' });
const pct = (x, base) => base ? Math.round(x / base * 1000) / 10 : null;
const vacio = () => ({ n: 0, a: 0, ses: 0, min: 0, r1: 0, r7: 0, r30: 0 });

// Origen del jugador (/js/origen.js lo manda en el 'hola' como src). Lista
// blanca: nadie puede meter claves nuevas en ret:dia. Se guarda UNA vez, en el
// alta (c.ret.src), y la herencia de invitado lo conserva (copia c entero).
// Con el, el alta, el embudo y D1/D7 se suman tambien como <campo>_<src>
// (n_meta, c1_meta, r1_meta...) en el mismo ret:dia.
export const ORIGENES = ['meta', 'tg', 'wa', 'ref', 'org'];
const srcDe = v => ORIGENES.includes(v) ? v : 'org';
const conSrc = (c, campos) => {
  const s = c && c.ret && c.ret.src;
  if (!ORIGENES.includes(s)) return campos;
  const o = { ...campos };
  for (const k in campos) o[k + '_' + s] = campos[k];
  return o;
};

// Embudo de la carga (antes del alta), por beacon (worker.js → /mmo/ev):
//   ev:dia:<YYYY-MM-DD> → { '<juego>|<evento>|<origen>|<m|p>': [n, b0..b6] }
//   n = sesiones que llegaron a ese paso; b = cuantas en cada tramo de ms
//   (desde que abrio la pagina; 'bienvenido' y 'mover', desde el clic en entrar).
// Se suma en memoria y se vuelca como mucho una vez por minuto.
export const EV_PASOS = ['carga_ini', 'arte_ok', 'form_visto', 'clic_entrar', 'bienvenido', 'mover', 'fallo_webgl', 'oculta'];
const EV_TRAMOS = [2000, 5000, 10000, 20000, 40000, 90000];   // el ultimo tramo es "mas de 90 s"
const EV_POR_IP_HORA = 40;      // por /64 de IPv6: un jugador manda ~8; recargas y los dos juegos caben de sobra
const EV_POR_IPV4_HORA = 800;   // IPv4: la comparten cientos de moviles por CGNAT (Claro, Movistar, Entel, Bitel)
const EV_MAX_DIA = 60000;       // tope diario de avisos aceptados (cuida el cupo)
const EV_MAX_CLAVES = 400;      // 2 juegos x 8 pasos x 5 origenes x 2 equipos = 160 posibles
// IPv6: se limita por /64 (un equipo cambia de direccion dentro de su bloque).
const claveIpEv = ip => ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;

const MAX_ENVIOS = 40;   // avisos por llamada a 'recordatorios' (limite de subpeticiones)
export const HORA_DEFECTO = 17;   // la del cron: para quien aun no tiene hora habitual
const DIAS_PARA_HORA = 3;         // dias con hora anotada para buscar la mas repetida
const horaUTC = (t = Date.now()) => new Date(t).getUTCHours();

// La hora (UTC) a la que suele volver: la mas repetida de sus primeras
// entradas del dia; en empate, la mas reciente. Con 1 o 2 dias (el aviso D1
// del jugador nuevo), la de su ultima primera entrada: a la hora que jugo.
export function horaHabitual(e) {
  const hs = (e && e.hs) || [];
  if (!hs.length) return HORA_DEFECTO;
  if (hs.length < DIAS_PARA_HORA) return hs[hs.length - 1];
  const n = {};
  for (const h of hs) n[h] = (n[h] || 0) + 1;
  let mejor = hs[hs.length - 1];
  for (let i = hs.length - 1; i >= 0; i--) if (n[hs[i]] > n[mejor]) mejor = hs[i];
  return mejor;
}

export const Retencion = {
  // ── Almacenamiento ──
  // Se cachea la PROMESA y no el valor: dos sesiones que suman a la vez
  // reciben el mismo objeto y ninguna pisa la suma de la otra al guardar.
  // Cuantos jugadores distintos entraron hoy (UTC). Con 1-3 en linea a la
  // vez el mundo parece vacio; "12 jugaron hoy" cuenta la verdad completa.
  async contarHoy() {
    const idx = await this.retIdx(), hoy = diaNum();
    let n = 0;
    for (const u in idx) if (idx[u].v === hoy) n++;
    return n;
  },

  retIdx() {
    if (!this._retIdx) {
      this._retIdx = this.state.storage.get('ret:idx').then(x => x || {});
      this._retIdx.catch(() => { this._retIdx = null; });
    }
    return this._retIdx;
  },
  // Devuelve false si no se pudo guardar. Tope duro de entradas: el indice es una
  // sola clave (unos 2 MB como mucho) y una oleada de invitados lo llenaba; se
  // quitan los invitados que llevan mas tiempo sin jugar (a ellos nunca se les avisa).
  async retGuardarIdx() {
    try {
      const idx = await this.retIdx();
      const uids = Object.keys(idx);
      if (uids.length > 20000) {
        const invs = uids.filter(u => u.startsWith('inv:')).sort((a, b) => (idx[a].v || 0) - (idx[b].v || 0));
        for (const u of invs.slice(0, uids.length - 18000)) delete idx[u];
      }
      await this.state.storage.put('ret:idx', idx);
      return true;
    } catch (e) { console.error('[MMO ret idx]', e); return false; }
  },
  retDia(n) {
    this._retDias = this._retDias || new Map();
    let p = this._retDias.get(n);
    if (!p) {
      p = this.state.storage.get('ret:dia:' + diaISO(n)).then(x => x || vacio());
      p.catch(() => this._retDias.delete(n));
      this._retDias.set(n, p);
      // En memoria solo hacen falta los ultimos ~2 meses (cohortes y /mmostats).
      if (this._retDias.size > 90) for (const k of [...this._retDias.keys()]) if (k < n - 70) this._retDias.delete(k);
    }
    return p;
  },
  // Suma en memoria (el objeto del dia que guarda retDia) y lo vuelca
  // retVolcarDias como mucho cada 60 s: antes cada alta, activo o hito era una escritura.
  async retSumar(n, campos) {
    const r = await this.retDia(n);
    for (const k in campos) r[k] = Math.round(((r[k] || 0) + campos[k]) * 100) / 100;
    (this._retSucios = this._retSucios || new Set()).add(n);
    if (Date.now() - (this._retDiasT || 0) > 60000) await this.retVolcarDias();
  },
  async retVolcarDias(forzar) {
    const sucios = this._retSucios;
    if (!sucios || !sucios.size) return;
    if (!forzar && Date.now() - (this._retDiasT || 0) <= 60000) return;
    this._retDiasT = Date.now();
    this._retSucios = null;
    for (const n of sucios) {
      // Si el cache se vacio (restaurar una copia, pruebas) lo pendiente ya no vale.
      const p = this._retDias && this._retDias.get(n);
      if (!p) continue;
      try { await this.state.storage.put('ret:dia:' + diaISO(n), await p); }
      catch (e) { (this._retSucios = this._retSucios || new Set()).add(n); console.error('[MMO ret dia]', e); }
    }
  },

  // Invitaciones por ?ref= del dia: llegan (personaje nuevo con invitador),
  // cuentan (ya con cuenta real: nuevo o heredado) y se pagan (premio Nv 10).
  refContar(k) {
    this.retSumar(diaNum(), { [k]: 1 }).catch(() => {});
  },

  // Embudo de los nuevos (26-oct): de la cohorte de su alta, cuantos llegan a la
  // primera caza (c1), a entregar la mision 1 (m1), a nivel 5 (n5) y a nivel 10 (n10).
  // Una vez por personaje y solo en sus primeros 30 dias.
  hitoEmbudo(c, k) {
    if (!c || !c.ret || !c.ret.alta || (this.uidsPrueba && this.uidsPrueba.has(c.uid))) return;
    const e = c.ret.emb || (c.ret.emb = {});
    if (e[k]) return;
    e[k] = 1;
    const desde = diaNum(c.creado || Date.now());
    if (diaNum() - desde > 30) return;
    this.retSumar(desde, conSrc(c, { [k]: 1 })).catch(() => {});
  },

  // Anota el dia en el personaje. true si es su primera vez de ese dia.
  retMarcarDia(c, hoy) {
    const r = c.ret;
    if (r.d[r.d.length - 1] === hoy) return false;
    r.d = r.d.filter(x => x > hoy - DIAS_GUARDADOS && x < hoy);
    r.d.push(hoy);
    r.dt = (r.dt || 0) + 1;
    return true;
  },

  // Primera vez del dia: activos del dia y, si toca, su cohorte (D1/D7/D30).
  async retNuevoDia(c, hoy) {
    await this.retSumar(hoy, { a: 1 });
    if (!c.ret.alta) return;
    const desde = diaNum(c.creado || Date.now());
    const k = hoy - desde;
    // D8 (cruzo a la semana 2 de la racha) y D14 (2 semanas): miden la racha larga.
    if (k === 1 || k === 7 || k === 8 || k === 14 || k === 30) await this.retSumar(desde, conSrc(c, { ['r' + k]: 1 }));
    if (k === 1 && c.ret.iab) await this.retSumar(desde, { r1iab: 1 });
  },

  // ── Ganchos (los llama world.js) ──
  // En hola, con el personaje ya cargado. nuevo = personaje recien creado.
  async retEntrar(s, nuevo, src) {
    try {
      const c = s.c, ahora = Date.now(), hoy = diaNum(ahora);
      // Solo cuenta como alta un personaje creado ahora: los que ya existian
      // antes de medir no tienen dia de alta fiable y ensuciarian las cohortes.
      if (!c.ret) c.ret = { d: [], dt: 0, ses: 0, min: 0, visto: ahora, u: c.uid, alta: nuevo ? 1 : 0 };
      // Origen: una sola vez, en el alta (despues nunca se pisa).
      if (nuevo && !c.ret.src) c.ret.src = srcDe(src);
      // Alta desde el navegador interno de Facebook/Instagram (hola.iab): su D1 aparte.
      if (nuevo && s.iab) c.ret.iab = 1;
      const r = c.ret;
      r.ses = (r.ses || 0) + 1;
      r.visto = ahora;
      s.retT = ahora;
      // Invitado que paso a cuenta (hereda el personaje): su entrada vieja del
      // indice se borra para no contarlo dos veces como activo.
      const uidViejo = r.u && r.u !== c.uid ? r.u : null;
      r.u = c.uid;
      const nuevoDia = this.retMarcarDia(c, hoy);
      if (this.uidsPrueba.has(c.uid)) return;
      const idx = await this.retIdx();
      if (uidViejo) delete idx[uidViejo];
      const e = idx[c.uid] || (idx[c.uid] = { v: 0 });
      // ret:idx solo se escribe si algo cambia (antes, en cada entrada).
      const cambia = !!uidViejo || nuevoDia || e.v !== hoy || e.l !== c.nivel || e.a !== 0;
      e.v = hoy; e.l = c.nivel;
      e.a = 0;   // volvio: se reanudan los avisos
      // Primera entrada del dia: su hora, para avisarle a esa hora.
      if (nuevoDia) e.hs = [...(e.hs || []), horaUTC(ahora)].slice(-10);
      if (cambia) await this.retGuardarIdx();
      if (nuevo) await this.retSumar(hoy, conSrc(c, c.ret.iab ? { n: 1, niab: 1 } : { n: 1 }));
      // Sesiones: en memoria y al storage como mucho una vez por minuto.
      if (this._retMin && this._retMin.d !== hoy) await this.retVolcar();
      this._retMin = this._retMin || { d: hoy, min: 0, ses: 0 };
      this._retMin.ses = (this._retMin.ses || 0) + 1;
      if (ahora - (this._retMinT || 0) > 60000) await this.retVolcar();
      if (nuevoDia) await this.retNuevoDia(c, hoy);
    } catch (e) { console.error('[MMO retEntrar]', e); }
  },

  // En cada guardado (periodico y al cerrar la sesion): suma los minutos
  // jugados desde el ultimo guardado y detecta el cambio de dia de quien
  // sigue conectado pasada la medianoche UTC. Es sincrono en lo que toca a c
  // (guardar escribe c justo despues); los agregados van aparte.
  retAlGuardar(s) {
    const c = s.c;
    if (!c || !c.ret || !s.retT) return;
    const ahora = Date.now();
    // Solo hasta 1 min despues de lo ultimo que hizo: una pestaña olvidada
    // abierta no suma los 10 min que tarda en echarla la inactividad.
    const hasta = Math.min(ahora, (s.actT || ahora) + 60000);
    const min = Math.max(0, hasta - s.retT) / 60000;
    s.retT = ahora;
    c.ret.min = Math.round(((c.ret.min || 0) + min) * 100) / 100;
    c.ret.visto = ahora;
    const hoy = diaNum(ahora);
    const nuevoDia = this.retMarcarDia(c, hoy);
    // Sigue conectado al cambiar el dia UTC (19:00 en Peru): cobra la diaria y
    // ve las tareas nuevas sin reconectar. Lo que cambia en c entra en el put
    // de guardar(), que viene justo despues. Al cerrar no: lo cobra al volver.
    if (nuevoDia && !s.cerrado && this.procesarLogin) {
      const lg = this.procesarLogin(s);
      if (lg) {
        // En pleno combate no se abre la ventana del premio: solo el aviso.
        if (ahora - (s.combateT || 0) < 5000) this.enviar(s, { t: 'toast', ok: true, m: `☀️ ¡Nuevo día! Recompensa diaria (día ${lg.racha}): ${lg.oro ? '+' + lg.oro.toLocaleString('es', { useGrouping: 'always' }) + ' oro' : lg.txt}. Misiones diarias renovadas.` });
        else { this.enviar(s, { t: 'login', ...lg }); this.enviar(s, { t: 'toast', ok: true, m: '☀️ ¡Nuevo día! Misiones diarias renovadas.' }); }
        if (this.infoTareas) this.enviar(s, { t: 'tareas', ...this.infoTareas(c) });
        if (this.revisarLogros) this.revisarLogros(s, true);   // titulos de racha 7/14/21
        // Cambio de mes con la sesion abierta: lo alcanzado del pase se cobra ya (antes esperaba a reconectar).
        if (this.infoPase) { const ip = this.infoPase(c); if (this.cobrarPasePendiente && c.pasePend) this.cobrarPasePendiente(s); this.enviar(s, { t: 'pase', pase: c.pasePend ? this.infoPase(c) : ip }); }
        this.actualizarYo(s);
      }
    }
    if (this.uidsPrueba.has(c.uid)) return;
    // Evento de temporada: quien llega a 50 de su objeto (el primer titulo),
    // una vez por evento, y aparte si juega en ORIGINS (3D). Para medir si el
    // evento engancha (/mmostats → evento). En un evento anual que repite
    // contador cuenta tambien quien ya traia 50 del año anterior.
    const tpE = this.temporadaAviso();
    if (tpE && (c[tpE.campo] || 0) >= 50 && c.ret.e50 !== tpE.id) {
      c.ret.e50 = tpE.id;
      this.retSumar(hoy, c.en3d ? { e50: 1, e50_3d: 1 } : { e50: 1 }).catch(() => {});
    }
    // Los minutos del dia se juntan en memoria y se escriben como mucho una
    // vez por minuto: escribir el agregado en CADA guardado doblaba las
    // escrituras al storage (que cuentan en el cupo diario del plan gratis).
    if (min >= 0.01) { const p = (this._retMin && this._retMin.d === hoy) ? this._retMin : { d: hoy, min: 0, ses: 0 }; p.min += min; this._retMin = p; }
    (async () => {
      if (this._retMin && (ahora - (this._retMinT || 0) > 60000 || this._retMin.d !== hoy)) await this.retVolcar();
      if (nuevoDia) {
        const idx = await this.retIdx();
        const e = idx[c.uid] || (idx[c.uid] = { v: 0 });
        e.v = hoy; e.l = c.nivel; e.a = 0;
        await this.retGuardarIdx();
        await this.retNuevoDia(c, hoy);
      }
    })().catch(e => console.error('[MMO retAlGuardar]', e));
  },

  // Escribe los minutos pendientes en el agregado del dia.
  async retVolcar() {
    const pend = this._retMin;
    if (!pend) return;
    this._retMin = null; this._retMinT = Date.now();
    await this.retSumar(pend.d, { min: Math.round(pend.min * 100) / 100, ses: pend.ses || 0 });
  },

  // Rutas internas de este modulo (las llama interno() de world.js).
  async internoRetencion(accion, b) {
    await this.retVolcar();
    try { await this.evVolcar(); } catch (e) { console.error('[MMO ev volcar]', e); }
    if (accion === 'stats') return this.retStats();
    if (accion === 'recordatorios') return this.recordatorios(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    if (accion === 'avisos') return this.ponerAvisos(b || {});
    if (accion === 'avisadosHoy') return this.avisadosHoy(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    return null;
  },

  // ── EMBUDO DE CARGA (beacon /mmo/ev) ──
  // Llega ya validado por worker.js; aqui se vuelve a validar (lista blanca),
  // se limita por IP y por dia y se suma en memoria. Siempre 204.
  async evRecibir(request) {
    const nada = () => new Response(null, { status: 204 });
    try {
      const b = await request.json();
      if (!b || !EV_PASOS.includes(b.e) || (b.j !== 'origins' && b.j !== 'classic')) return nada();
      const ahora = Date.now(), hoy = diaNum(ahora), h = Math.floor(ahora / 3600000);
      const ip = claveIpEv(request.headers.get('CF-Connecting-IP') || '');
      this._evIp = this._evIp && this._evIp.h === h ? this._evIp : { h, n: new Map() };
      const n = (this._evIp.n.get(ip) || 0) + 1;
      if (n > (ip.includes(':') ? EV_POR_IP_HORA : EV_POR_IPV4_HORA)) return nada();
      this._evIp.n.set(ip, n);
      this._evHoy = this._evHoy && this._evHoy.d === hoy ? this._evHoy : { d: hoy, n: 0 };
      if (++this._evHoy.n > EV_MAX_DIA) return nada();
      // Cambio de dia con algo pendiente: lo de ayer se escribe en su dia.
      if (this._evPend && this._evPend.d !== hoy) await this.evVolcar();
      const p = this._evPend || (this._evPend = { d: hoy, k: {} });
      const clave = `${b.j}|${b.e}|${srcDe(b.org)}|${b.movil ? 'm' : 'p'}`;
      if (!p.k[clave] && Object.keys(p.k).length >= EV_MAX_CLAVES) return nada();
      const a = p.k[clave] || (p.k[clave] = [0, 0, 0, 0, 0, 0, 0, 0]);
      a[0]++;
      const ms = Number(b.ms);
      if (Number.isFinite(ms) && ms >= 0) { let i = EV_TRAMOS.findIndex(t => ms <= t); if (i < 0) i = EV_TRAMOS.length; a[1 + i]++; }
      if (ahora - (this._evT || 0) > 60000) await this.evVolcar();
      else if (!this._evTimer) this._evTimer = setTimeout(() => { this._evTimer = null; this.evVolcar().catch(e => console.error('[MMO ev volcar]', e)); }, Math.max(1000, 60000 - (ahora - (this._evT || 0))));
    } catch (e) { console.error('[MMO ev]', e); }
    return nada();
  },
  async evVolcar() {
    const p = this._evPend;
    if (!p) return;
    this._evPend = null; this._evT = Date.now();
    const k = 'ev:dia:' + diaISO(p.d);
    const g = (await this.state.storage.get(k)) || {};
    for (const c in p.k) {
      const a = g[c] || (g[c] = [0, 0, 0, 0, 0, 0, 0, 0]);
      p.k[c].forEach((v, i) => { a[i] = (a[i] || 0) + v; });
    }
    await this.state.storage.put(k, g);
  },
  // Resumen de los ultimos 'dias' por origen: sesiones por paso, y del clic al
  // primer movimiento en el movil cuantas tardaron 20 s o menos y la mediana (por tramo).
  async evStats(dias = 7) {
    const hoy = diaNum(), por = {};
    for (let i = 0; i < dias; i++) {
      const g = (await this.state.storage.get('ev:dia:' + diaISO(hoy - i))) || {};
      for (const c in g) {
        const [, e, org, dev] = c.split('|');
        const o = por[org] || (por[org] = { pasos: {}, moverMovil: [0, 0, 0, 0, 0, 0, 0] });
        o.pasos[e] = (o.pasos[e] || 0) + (g[c][0] || 0);
        if (e === 'mover' && dev === 'm') for (let t = 0; t < 7; t++) o.moverMovil[t] += g[c][1 + t] || 0;
      }
    }
    const nombres = ['≤2 s', '≤5 s', '≤10 s', '≤20 s', '≤40 s', '≤90 s', '>90 s'];
    for (const org in por) {
      const b = por[org].moverMovil, tot = b.reduce((x, y) => x + y, 0);
      let acum = 0, med = null;
      for (let t = 0; t < 7 && med === null; t++) { acum += b[t]; if (acum * 2 >= tot && tot) med = nombres[t]; }
      por[org].movil20 = tot ? { pct: pct(b[0] + b[1] + b[2] + b[3], tot), base: tot, mediana: med } : null;
      delete por[org].moverMovil;
    }
    return { dias, por };
  },

  // ── ESTADISTICAS (/mmostats) ──
  async retStats() {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const activos = { hoy: 0, d7: 0, d30: 0 };
    const tipos = { tg: 0, web: 0, inv: 0 };
    const tramos = {};
    for (const uid in idx) {
      const e = idx[uid];
      if (!e.v || this.uidsPrueba.has(uid)) continue;
      const hace = hoy - e.v;
      if (hace === 0) activos.hoy++;
      if (hace < 7) activos.d7++;
      if (hace < 30) {
        activos.d30++;
        const t = uid.split(':')[0];
        if (t in tipos) tipos[t]++;
        const de = Math.floor((e.l || 1) / 10) * 10;
        const k = de === 0 ? '1-9' : `${de}-${de + 9}`;
        tramos[k] = (tramos[k] || 0) + 1;
      }
    }
    const dias = [];
    for (let i = 0; i <= 60; i++) dias.push({ n: hoy - i, r: await this.retDia(hoy - i) });
    const altas = dias.slice(0, 14).map(x => ({ dia: diaISO(x.n), n: x.r.n, activos: x.r.a }));
    // Un dato D-k solo existe cuando ya llego el dia alta+k (si no, null).
    const cohortes = dias.slice(0, 35).filter(x => x.r.n > 0).map(x => {
      const hace = hoy - x.n;
      return { dia: diaISO(x.n), n: x.r.n, d1: hace >= 1 ? x.r.r1 : null, d7: hace >= 7 ? x.r.r7 : null, d8: hace >= 8 ? x.r.r8 || 0 : null, d14: hace >= 14 ? x.r.r14 || 0 : null, d30: hace >= 30 ? x.r.r30 : null };
    });
    // Retencion total de las ultimas 30 cohortes cuyo dia alta+k ya termino.
    const retencion = {};
    for (const k of [1, 7, 8, 14, 30]) {
      let base = 0, vuelven = 0;
      for (const x of dias) {
        const hace = hoy - x.n;
        if (hace > k && hace <= k + 30) { base += x.r.n; vuelven += x.r['r' + k] || 0; }
      }
      retencion['d' + k] = { pct: pct(vuelven, base), vuelven, base };
    }
    let ses = 0, min = 0;
    for (const x of dias.slice(0, 7)) { ses += x.r.ses || 0; min += x.r.min || 0; }
    // Embudo de las altas de los ultimos 14 dias.
    const embudo = { n: 0, c1: 0, m1: 0, n5: 0, n10: 0, cl: 0, ex1: 0 };   // ex1: primera expedicion recogida
    for (const x of dias.slice(0, 14)) for (const k in embudo) embudo[k] += x.r[k] || 0;
    // Altas del navegador interno de Facebook/Instagram: cuantas en 14 dias y su D1
    // (ultimas 30 cohortes con el dia ya cumplido), para compararlo con el D1 general.
    const iab = { n: 0, d1: null };
    for (const x of dias.slice(0, 14)) iab.n += x.r.niab || 0;
    { let base = 0, vuelven = 0; for (const x of dias) { const hace = hoy - x.n; if (hace > 1 && hace <= 31) { base += x.r.niab || 0; vuelven += x.r.r1iab || 0; } } iab.d1 = { pct: pct(vuelven, base), vuelven, base }; }
    embudo.iab = iab;
    // Lo mismo por origen (origen.js): altas, embudo de 14 dias y D1/D7 de las
    // ultimas 30 cohortes con el dia ya cumplido. Solo los origenes con altas.
    const origenes = {};
    for (const o of ORIGENES) {
      const e = { n: 0, c1: 0, m1: 0, n5: 0 };
      for (const x of dias.slice(0, 14)) for (const k in e) e[k] += x.r[k + '_' + o] || 0;
      for (const k of [1, 7]) {
        let base = 0, vuelven = 0;
        for (const x of dias) { const hace = hoy - x.n; if (hace > k && hace <= k + 30) { base += x.r['n_' + o] || 0; vuelven += x.r['r' + k + '_' + o] || 0; } }
        e['d' + k] = { pct: pct(vuelven, base), vuelven, base };
      }
      if (e.n || e.d1.base) origenes[o] = e;
    }
    let carga = null;
    try { carga = await this.evStats(7); } catch (er) { console.error('[MMO evStats]', er); }
    // Invitaciones de los ultimos 14 dias (por dia en que pasaron).
    const invitaciones = { refLlega: 0, refCuenta: 0, refPagado: 0 };
    for (const x of dias.slice(0, 14)) for (const k in invitaciones) invitaciones[k] += x.r[k] || 0;
    // El evento de temporada en curso (o el ultimo, si acabo hace menos de 60
    // dias): altas de sus dias y su D7, y cuantos llegaron a 50 de su objeto.
    const ahoraE = Date.now();
    const tpS = temporadaDe(ahoraE) || TEMPORADAS.filter(x => x.fin <= ahoraE && x.fin > ahoraE - 60 * DIA_MS).sort((a, b) => b.fin - a.fin)[0];
    let evento = null;
    if (tpS) {
      const ev = { id: tpS.id, nombre: tpS.nombre, altas: 0, d7: 0, d7base: 0, llegan50: 0, llegan50_3d: 0 };
      for (const x of dias) {
        if (x.n < diaNum(tpS.ini) || x.n >= diaNum(tpS.fin - 1) + 1) continue;
        ev.altas += x.r.n || 0;
        ev.llegan50 += x.r.e50 || 0; ev.llegan50_3d += x.r.e50_3d || 0;
        if (hoy - x.n >= 7) { ev.d7base += x.r.n || 0; ev.d7 += x.r.r7 || 0; }
      }
      evento = { ...ev, d7pct: pct(ev.d7, ev.d7base) };
    }
    const ranking = (await (this.rankingLeer ? this.rankingLeer() : this.state.storage.get('ranking').then(r => r || []))).filter(x => !this.uidsPrueba.has(x.uid));
    return {
      ok: true, hoy: diaISO(hoy), activos, tipos30: tipos, niveles30: tramos, altas, cohortes, retencion, evento,
      sesion: { sesiones7: ses, minutos7: Math.round(min), media: ses ? Math.round(min / ses * 10) / 10 : 0 }, embudo, invitaciones, origenes, carga,
      top: ranking.slice(0, 10).map(x => ({ n: x.n, lv: x.lv })),
      online: this.contarOnline(),
      salud: this.infoSalud ? this.infoSalud() : null,   // cupo de escrituras y lag (salud.js)
    };
  },

  // ── AVISOS DE VUELTA POR TELEGRAM ──
  // Envio y espera separados para que las pruebas los cambien (sin red ni
  // pausas reales).
  async tgEnviar(metodo, cuerpo) {
    const env = getEnv({ env: this.env });
    if (!env.BOT_TOKEN) return { ok: false, description: 'sin token' };
    return tg(env.BOT_TOKEN, metodo, cuerpo);
  },
  dormir(ms) { return new Promise(r => setTimeout(r, ms)); },
  // El evento de temporada activo (aparte para que las pruebas lo fijen).
  temporadaAviso() { return temporadaDe(); },

  puedeAvisar(uid, e, hoy) {
    if (!/^tg:\d{1,15}$/.test(uid) || !e || e.off || e.bloq) return false;
    // Evento nuevo para el: un aviso extra aunque este en pausa.
    const tp = this.temporadaAviso(), extra = !!tp && e.ev !== tp.id;
    return e.v > 0 && e.v < hoy && hoy - e.v <= (extra ? OLVIDAR_DIAS : VENTANA_AVISO)
      && e.ad !== hoy && ((e.a || 0) < AVISOS_SIN_RESPUESTA || extra)
      && !this.porUid.has(uid) && !this.uidsPrueba.has(uid);
  },

  // Avisa a quien le toca a esta hora (UTC). Devuelve tambien a quien no
  // debe escribir hoy el recordatorio del arcade (17:00): los ya avisados
  // hoy y los que se avisaran mas tarde, asi cada uno recibe un solo mensaje.
  async recordatorios(hora = horaUTC()) {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const res = { ok: true, candidatos: 0, enviados: 0, bloqueados: 0, fallidos: 0, ids: [], callar: [] };
    // De paso se poda el indice (quien pidio no recibir avisos o bloqueo al
    // bot se queda, para recordarlo).
    for (const uid of Object.keys(idx)) {
      const e = idx[uid];
      if (!e.off && !e.bloq && (e.v || 0) < hoy - OLVIDAR_DIAS) delete idx[uid];
    }
    let n = 0;
    // Como mucho MAX_ENVIOS por llamada: cada mensaje a Telegram es una
    // subpeticion y el plan gratis permite ~50 por invocacion. El cron llama
    // varias veces; primero van los que hace mas que no reciben aviso.
    const lista = Object.keys(idx).filter(u => this.puedeAvisar(u, idx[u], hoy) && horaHabitual(idx[u]) === hora).sort((a, b) => (idx[a].ad || 0) - (idx[b].ad || 0));
    res.quedan = Math.max(0, lista.length - MAX_ENVIOS);
    for (const uid of lista.slice(0, MAX_ENVIOS)) {
      const c = await this.state.storage.get('c:' + uid);
      const e = idx[uid];
      // Pudo entrar mientras se leia su personaje.
      if (!c || !this.puedeAvisar(uid, e, hoy)) continue;
      res.candidatos++;
      if (n > 0 && n % POR_SEGUNDO === 0) { await this.retGuardarIdx(); await this.dormir(1100); }
      n++;
      const texto = await this.mensajeAviso(c, hoy);
      // Se marca antes de enviar: aunque el envio tarde, nada lo vuelve a
      // elegir hoy. Si falla por algo pasajero se deshace.
      const antes = { ad: e.ad, a: e.a, ev: e.ev };
      e.ad = hoy; e.a = (e.a || 0) + 1;
      const tpA = this.temporadaAviso();
      if (tpA) e.ev = tpA.id;   // un solo aviso extra por evento
      let r = null;
      try {
        r = await this.tgEnviar('sendMessage', {
          chat_id: uid.slice(3), text: texto, disable_web_page_preview: true,
          reply_markup: { inline_keyboard: [
            [{ text: '🌍 Volver al mundo', web_app: { url: MMO_URL } }],
            [{ text: '🔕 No quiero más avisos', callback_data: 'mmoavisos:off' }],
          ] },
        });
      } catch (err) { r = null; }
      if (r && r.ok) { res.enviados++; res.ids.push(uid.slice(3)); }
      else if (r && r.error_code === 403) {
        // Bloqueo al bot (o borro su cuenta / nunca abrio el chat): no se le
        // vuelve a escribir hasta que el mismo pida /avisos on.
        e.bloq = 1; e.ad = antes.ad; e.a = antes.a; e.ev = antes.ev;
        res.bloqueados++;
      } else {
        e.ad = antes.ad; e.a = antes.a; e.ev = antes.ev;
        res.fallidos++;
        if (r && r.error_code === 429) await this.dormir(Math.min(30, (r.parameters && r.parameters.retry_after) || 1) * 1000);
      }
    }
    await this.retGuardarIdx();
    res.callar = Object.keys(idx).filter(u => u.startsWith('tg:') && (idx[u].off || idx[u].bloq)).map(u => u.slice(3));
    res.hoy = Object.keys(idx).filter(u => u.startsWith('tg:') && (idx[u].ad === hoy || (this.puedeAvisar(u, idx[u], hoy) && horaHabitual(idx[u]) > hora))).map(u => u.slice(3));
    return res;
  },

  // Solo la lista (sin enviar nada): a quien el recordatorio del arcade no
  // debe escribir hoy. El cron la pide si fallo 'recordatorios'.
  async avisadosHoy(hora) {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const tg = Object.keys(idx).filter(u => u.startsWith('tg:'));
    return {
      ok: true,
      callar: tg.filter(u => idx[u].off || idx[u].bloq).map(u => u.slice(3)),
      hoy: tg.filter(u => idx[u].ad === hoy || (this.puedeAvisar(u, idx[u], hoy) && horaHabitual(idx[u]) > hora)).map(u => u.slice(3)),
    };
  },

  // Alarma del Durable Object, cada hora en punto: los avisos de quien
  // tiene su hora habitual en otra hora que las 17:00 (esa la hace el cron).
  // Una tanda por hora (el limite de subpeticiones por invocacion).
  async alarm() {
    try {
      const h = horaUTC();
      if (h !== HORA_DEFECTO) {
        const r = await this.recordatorios(h);
        if (r.enviados || r.bloqueados) console.log('[MMO avisos ' + h + 'h]', { enviados: r.enviados, bloqueados: r.bloqueados, fallidos: r.fallidos, quedan: r.quedan });
      }
    } catch (e) { console.error('[MMO alarma]', e); }
    // Lo pendiente del embudo de carga (por si nadie mas lo volco).
    try { await this.evVolcar(); } catch (e) { console.error('[MMO ev volcar]', e); }
    // Copia de seguridad diaria (copias.js).
    try { if (this.copiaDiariaSiToca) await this.copiaDiariaSiToca(); } catch (e) { console.error('[MMO copia diaria]', e); }
    // Recordatorios al dueño de pedidos pagados sin entregar (world.js). Esta
    // alarma tambien salta antes de la hora en punto cuando uno toca; lo de
    // arriba ya no repite nada (avisos y copia van marcados por dia).
    try { if (this.recordarPedidos) await this.recordarPedidos(); } catch (e) { console.error('[MMO recordar pedidos]', e); }
    await this.programarAlarma();
  },
  async programarAlarma() {
    const st = this.state.storage;
    if (!st.setAlarm) return;
    let t = (Math.floor(Date.now() / 3600000) + 1) * 3600000 + 30000;
    const p = this.proximoRecordatorioPedido ? this.proximoRecordatorioPedido() : 0;
    if (p && p < t) t = Math.max(p, Date.now() + 5000);
    try { await st.setAlarm(t); } catch (e) { console.error('[MMO setAlarm]', e); }
  },
  async asegurarAlarma() {
    const st = this.state.storage;
    if (!st.getAlarm) return;
    try { if (!(await st.getAlarm())) await this.programarAlarma(); } catch (e) { console.error('[MMO getAlarm]', e); }
  },

  // El texto se arma con lo que ese jugador tiene pendiente HOY, de lo mas
  // urgente (perder la racha) a lo mas general (cuanto falta para subir).
  // Texto plano, sin Markdown: el nombre lo eligio el jugador.
  async mensajeAviso(c, hoy) {
    const lineas = [];
    // Evento de temporada: primero, para que siempre entre en las 3 lineas.
    const tp = this.temporadaAviso();
    if (tp) {
      const n = c[tp.campo] || 0;
      const tit = n < 50 ? `: con 50 y 200 ganas los títulos «${tp.titulos[0]}» y «${tp.titulos[1]}»` : n < 200 ? `: con 200 ganas el título «${tp.titulos[1]}»` : '';
      lineas.push(`${tp.emoji} ¡${tp.nombre}! Hasta el ${tp.hasta} los monstruos sueltan ${tp.cosas}. Llevas ${fmt(n)}${tit}.`);
    }
    // Expedicion (expediciones.js) que ya volvio y espera a que la recoja.
    if (c.exped && c.exped.fin <= Date.now()) lineas.push(`🧭 Tu expedición de ${c.exped.h < 1 ? Math.round(c.exped.h * 60) + ' min' : c.exped.h + ' h'} ya volvió con oro y materiales: recógela en ${c.en3d ? 'la fila 🧭 de tus misiones' : 'el registro de misiones'}.`);
    if (horaFelizActiva()) lineas.push('⚡ Ahora mismo es la Hora Feliz: +50% de experiencia por caza hasta las 21:00 (hora de Perú).');
    const L = c.login;
    // La racha no tiene tope (semanas de 7 dias): racha%7===0 = semana cumplida,
    // y mañana empieza la siguiente con el oro x1,25/x1,5.
    if (L && L.d === diaISO(hoy - 1) && L.racha >= 1) {
      const sig = L.racha + 1, pr = premioRacha(sig);
      const premio = pr.oro ? `${fmt(Math.round(pr.oro * multLogin(c.nivel) * multSemanaRacha(sig)))} oro${pr.item !== undefined ? ' + objeto ÉPICO' : ''}` : pr.txt;
      const semTxt = L.racha % 7 === 0 ? `¡cumpliste la semana ${semanaRacha(L.racha)}! Si entras hoy empieza la semana ${semanaRacha(sig)} (${premio}${semanaRacha(sig) <= 3 ? ', con más oro' : ''})` : `si entras hoy cobras el día ${diaRacha(sig)} de la semana ${semanaRacha(sig)} (${premio})`;
      lineas.push(`🔥 Llevas ${L.racha} ${L.racha === 1 ? 'día seguido' : 'días seguidos'}: ${semTxt}. Si no, tu racha retrocede.`);
    } else if (L && L.d === diaISO(hoy - 2) && L.racha > 2) {
      // Falto ayer: si entra hoy solo retrocede (o la conserva por el margen de 30 h).
      const baja = L.racha >= 8 ? (semanaRacha(L.racha) - 1) * 7 + 1 : L.racha === 7 ? 1 : L.racha - 1;
      lineas.push(`🔥 Ayer no entraste: si entras HOY salvas tu racha de ${L.racha} días (como mucho baja a ${baja}). Mañana vuelve al día 1.`);
    }
    const g = this.grupos && [...this.grupos.values()].find(x => x.uids.includes(c.uid));
    const enGrupo = g ? g.uids.filter(u => u !== c.uid && this.porUid.has(u)).length : 0;
    if (enGrupo) lineas.push(`👥 Tu grupo te espera: ${enGrupo} ${enGrupo === 1 ? 'compañero está conectado' : 'compañeros están conectados'} ahora.`);
    let h = null;
    try { h = c.herm ? await this.hermandad(c.herm) : null; } catch (e) {}
    const enHerm = h && h.miembros ? Object.keys(h.miembros).filter(u => u !== c.uid && this.porUid.has(u)).length : 0;
    if (enHerm) lineas.push(`🛡️ ${enHerm} de tu hermandad «${h.nombre}» ${enHerm === 1 ? 'está conectado' : 'están conectados'} ahora.`);
    if (c.nivel >= NIVEL_MAZMORRA) {
      const pr = premioMazmorraDia(c.nivel);
      lineas.push(`🏰 El premio diario de mazmorra está disponible: +${fmt(pr.xp)} XP, +${fmt(pr.oro)} oro y un objeto ÉPICO.`);
    }
    // Torre del Duende: si esta semana aun no subio (su cofre cada 5 pisos espera).
    if (c.nivel >= TORRE.nv && (!c.torre || c.torre.sem !== semanaUTC() || !c.torre.max)) lineas.push('🗼 Esta semana aún no subes la Torre del Duende: cada 5 pisos nuevos, un cofre con oro y equipo.');
    const pd = premioDiaria(c.nivel);
    lineas.push(`🎯 ${DIARIA.nombre} sin cobrar: +${fmt(pd.xp)} XP, +${fmt(pd.oro)} oro y ${pd.pocion} pociones.`);
    if (c.nivel < NIVEL_MAX) {
      const falta = Math.max(1, xpParaSubir(c.nivel) - (c.xp || 0));
      const hab = c.clase ? HABS.filter(x => x.clase === c.clase && x.nv > c.nivel).sort((a, b) => a.nv - b.nv)[0] : null;
      let t = `📈 Te faltan ${fmt(falta)} XP para el nivel ${c.nivel + 1}`;
      if (hab) t += hab.nv === c.nivel + 1 ? `, donde aprendes ${hab.nombre}.` : ` (en el ${hab.nv} aprendes ${hab.nombre}).`;
      else if (!c.clase) t += `. Aún no eliges clase: ${Object.values(CLASES).map(x => x.nombre).join(', ')}.`;
      else t += '.';
      lineas.push(t);
    }
    return `🧌 ¡${c.nombre}, el Pueblo Duende te extraña!\n\n${lineas.slice(0, 3).join('\n\n')}`;
  },

  // /avisos on|off (y el boton del aviso). Se guarda en el indice y no en el
  // personaje: si el jugador esta conectado, su guardado no lo pisa.
  async quiereAvisos(uid) {
    if (!uid.startsWith('tg:')) return false;
    const e = (await this.retIdx())[uid];
    return !(e && (e.off || e.bloq));
  },

  async ponerAvisos(b) {
    const id = String(b.tgId || '');
    if (!/^\d{1,15}$/.test(id)) return { ok: false, error: 'id de Telegram no válido' };
    const idx = await this.retIdx();
    const uid = 'tg:' + id;
    // Solo consultar (/avisos sin on/off): no se crea ni se escribe nada.
    if (b.on !== true && b.on !== false) { const e0 = idx[uid] || {}; return { ok: true, on: !e0.off, jugo: (e0.v || 0) > 0 }; }
    const e = idx[uid] || (idx[uid] = { v: 0 });
    if (b.on === true) { delete e.off; delete e.bloq; e.a = 0; }
    else if (b.on === false) e.off = 1;
    // Si no se guardo, se dice: si no, la baja solo vivia en memoria hasta el siguiente reinicio.
    if (!(await this.retGuardarIdx())) return { ok: false, error: 'No se pudo guardar. Intenta de nuevo en un rato.' };
    return { ok: true, on: !e.off, jugo: e.v > 0 };
  },
};
