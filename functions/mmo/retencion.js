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

import { xpParaSubir, premioDiaria, premioMazmorraDia, LOGIN_PREMIOS, multLogin, HABS, CLASES, NIVEL_MAX, DIARIA, horaFelizActiva, TORRE, semanaUTC, temporadaDe } from '../../mmo/js/data.js';
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
  async retGuardarIdx() {
    try { await this.state.storage.put('ret:idx', await this.retIdx()); } catch (e) { console.error('[MMO ret idx]', e); }
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
  async retSumar(n, campos) {
    const r = await this.retDia(n);
    for (const k in campos) r[k] = Math.round(((r[k] || 0) + campos[k]) * 100) / 100;
    await this.state.storage.put('ret:dia:' + diaISO(n), r);
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
    if (k === 1 || k === 7 || k === 30) await this.retSumar(desde, { ['r' + k]: 1 });
  },

  // ── Ganchos (los llama world.js) ──
  // En hola, con el personaje ya cargado. nuevo = personaje recien creado.
  async retEntrar(s, nuevo) {
    try {
      const c = s.c, ahora = Date.now(), hoy = diaNum(ahora);
      // Solo cuenta como alta un personaje creado ahora: los que ya existian
      // antes de medir no tienen dia de alta fiable y ensuciarian las cohortes.
      if (!c.ret) c.ret = { d: [], dt: 0, ses: 0, min: 0, visto: ahora, u: c.uid, alta: nuevo ? 1 : 0 };
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
      if (nuevo) await this.retSumar(hoy, { n: 1 });
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
        // Cambio de mes con la sesion abierta: lo alcanzado del pase se cobra ya (antes esperaba a reconectar).
        if (this.infoPase) { const ip = this.infoPase(c); if (this.cobrarPasePendiente && c.pasePend) this.cobrarPasePendiente(s); this.enviar(s, { t: 'pase', pase: c.pasePend ? this.infoPase(c) : ip }); }
        this.actualizarYo(s);
      }
    }
    if (this.uidsPrueba.has(c.uid)) return;
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
    if (accion === 'stats') return this.retStats();
    if (accion === 'recordatorios') return this.recordatorios(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    if (accion === 'avisos') return this.ponerAvisos(b || {});
    if (accion === 'avisadosHoy') return this.avisadosHoy(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    return null;
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
      return { dia: diaISO(x.n), n: x.r.n, d1: hace >= 1 ? x.r.r1 : null, d7: hace >= 7 ? x.r.r7 : null, d30: hace >= 30 ? x.r.r30 : null };
    });
    // Retencion total de las ultimas 30 cohortes cuyo dia alta+k ya termino.
    const retencion = {};
    for (const k of [1, 7, 30]) {
      let base = 0, vuelven = 0;
      for (const x of dias) {
        const hace = hoy - x.n;
        if (hace > k && hace <= k + 30) { base += x.r.n; vuelven += x.r['r' + k] || 0; }
      }
      retencion['d' + k] = { pct: pct(vuelven, base), vuelven, base };
    }
    let ses = 0, min = 0;
    for (const x of dias.slice(0, 7)) { ses += x.r.ses || 0; min += x.r.min || 0; }
    const ranking = ((await this.state.storage.get('ranking')) || []).filter(x => !this.uidsPrueba.has(x.uid));
    return {
      ok: true, hoy: diaISO(hoy), activos, tipos30: tipos, niveles30: tramos, altas, cohortes, retencion,
      sesion: { sesiones7: ses, minutos7: Math.round(min), media: ses ? Math.round(min / ses * 10) / 10 : 0 },
      top: ranking.slice(0, 10).map(x => ({ n: x.n, lv: x.lv })),
      online: this.contarOnline(),
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
    // Copia de seguridad diaria (copias.js).
    try { if (this.copiaDiariaSiToca) await this.copiaDiariaSiToca(); } catch (e) { console.error('[MMO copia diaria]', e); }
    await this.programarAlarma();
  },
  async programarAlarma() {
    const st = this.state.storage;
    if (!st.setAlarm) return;
    try { await st.setAlarm((Math.floor(Date.now() / 3600000) + 1) * 3600000 + 30000); } catch (e) { console.error('[MMO setAlarm]', e); }
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
    if (c.exped && c.exped.fin <= Date.now()) lineas.push(`🧭 Tu expedición de ${c.exped.h} h ya volvió con oro y materiales: recógela en el registro de misiones.`);
    if (horaFelizActiva()) lineas.push('⚡ Ahora mismo es la Hora Feliz: +50% de experiencia por caza hasta las 21:00 (hora de Perú).');
    const L = c.login;
    if (L && L.d === diaISO(hoy - 1) && L.racha >= 1 && L.racha < LOGIN_PREMIOS.length) {
      const pr = LOGIN_PREMIOS[L.racha];
      const premio = pr.oro ? `${fmt(pr.oro * multLogin(c.nivel))} oro${pr.item !== undefined ? ' + objeto ÉPICO' : ''}` : pr.txt;
      lineas.push(`🔥 Llevas ${L.racha} ${L.racha === 1 ? 'día seguido' : 'días seguidos'}: si entras hoy cobras el premio del día ${L.racha + 1} (${premio}). Si no, tu racha retrocede.`);
    } else if (L && L.d === diaISO(hoy - 2) && L.racha > 2 && L.racha < LOGIN_PREMIOS.length) {
      // Falto ayer: si entra hoy solo retrocede (o la conserva por el margen de 30 h).
      lineas.push(`🔥 Ayer no entraste: si entras HOY salvas tu racha de ${L.racha} días (como mucho baja a ${L.racha - 1}). Mañana vuelve al día 1.`);
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
    await this.retGuardarIdx();
    return { ok: true, on: !e.off, jugo: e.v > 0 };
  },
};
