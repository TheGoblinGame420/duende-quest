// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — rituales de la mañana y de la noche
//
// Se mezcla en MmoWorld (Object.assign al final de world.js). Dos motivos
// pequeños y reales para abrir el juego dos veces al dia, sin castigo:
//
//   AMANECER  al primer ingreso de cada dia de juego (medianoche de Lima) el
//             jugador recibe un regalo pequeño y recoge lo que reposo de noche.
//   ANOCHECER de 18:00 a 03:59 (hora de Lima), un ritual de menos de un minuto:
//             dejar la olla de Mama Asiri al fuego y elegir una intencion para
//             mañana. La expedicion nocturna es la de siempre (expediciones.js).
//
// Nada se pierde por faltar: la olla sigue reposando (una racion por dia, hasta
// RITUAL.ollaMax) y la intencion espera al dia en que vuelvas. No hay racha
// propia ni cuenta atras: cada RITUAL.protectorCada rituales se gana un
// protector 🧿 de la racha diaria (el mismo de world.js, maximo 2).
//
// Premios modestos y con tope (ver tools/sim_rituales.mjs): la unica XP nueva
// es la intencion de caza, +3 % de la XP de cada presa con tope diario, asi
// que la subida nunca se acelera mas de un 3 %. Nada de esto se compra.
//
// Estado por personaje (todo opcional: un personaje antiguo no tiene c.rit):
//   c.rit = { am: dia (numero) del ultimo amanecer cobrado,
//             no: noche (numero) del ultimo ritual, n: rituales hechos,
//             olla: { t: ms en que se dejo al fuego },
//             sig: { k, t, nid }        intencion elegida, aun sin madurar
//             int: { k, dia, q, g, f }  intencion del dia: q queda, g dado
//             ini: { d, k, nv, mi }     foto del empezar el dia (tarjeta de cierre) }
// Eleccion de recordatorio (en ret:idx, junto al consentimiento e.si):
//   e.fr = { m: hora de Lima 5-11, n: hora de Lima 18-23 }, e.frd = { m: dia, n: dia }
// ═══════════════════════════════════════════════════════
import { xpParaSubir, NIVEL_MAX, EXPEDICION, DIARIA, MISIONES, MATERIALES, DIA_DESFASE_MS, premioRacha, multLogin, multSemanaRacha, diaRacha } from '../../mmo/js/data.js';
import { MMO_URL, MUNDO_URL } from '../api/telegram-bot.js';

const DIA_MS = 86400000, HORA_MS = 3600000;

export const RITUAL = {
  nv: 3,                              // se abre al salir del tutorial
  nocheDesde: 18, nocheHasta: 4,      // hora de Lima: de 18:00 a 03:59
  ollaMs: 6 * HORA_MS, ollaMax: 3,    // reposa 6 h; despues, una racion por dia hasta 3
  ollaPocion: 2, ollaOro: 10,         // por racion: pociones y oro x nivel
  amPocion: 1, amOro: 12,             // regalo del amanecer: pocion y oro x nivel
  maduraMs: 4 * HORA_MS,              // la intencion madura durmiendo: minimo 4 h
  int: {
    xp: { nombre: 'Caza atenta', pct: 0.03, tope: 0.01 },      // +3 % XP de caza; tope: 1 % de tu nivel al dia
    oro: { nombre: 'Buen trato', pct: 0.15, tope: 60 },        // +15 % oro de misiones; tope: 60 x nivel al dia
    pesca: { nombre: 'Agua mansa', n: 5 },                     // +1 pescado en tus 5 primeras capturas
  },
  protectorCada: 5, protectorMax: 2,
  avisoM: [5, 11], avisoN: [18, 23],  // horas de Lima que se pueden elegir
  avisoVentana: 3,                    // horas de margen si la tanda de esa hora se lleno
  avisoPausa: 3,                      // dias sin entrar: se deja de avisar (ya no madura nada mas)
  avisoTanda: 8,                      // mensajes por alarma (limite de subpeticiones, comparte con recordatorios)
};

const fmt = n => Math.round(n).toLocaleString('es', { useGrouping: 'always' });
// Dia de juego (medianoche de Lima), igual que diaNum de retencion.js.
export const diaLima = (t = Date.now()) => Math.floor((t + DIA_DESFASE_MS) / DIA_MS);
export const horaLima = (t = Date.now()) => new Date(t + DIA_DESFASE_MS).getUTCHours();
// La noche a la que pertenece este momento (numero de dia de su anochecer), o
// null si no es de noche. De 00:00 a 03:59 sigue siendo la noche de ayer.
export function nocheId(t = Date.now()) {
  const h = horaLima(t);
  if (h >= RITUAL.nocheDesde) return diaLima(t);
  if (h < RITUAL.nocheHasta) return diaLima(t) - 1;
  return null;
}
// ms que faltan para que abra el ritual de esta noche (0 si ya esta abierto).
export function faltaNoche(t = Date.now()) {
  if (nocheId(t) !== null) return 0;
  const lima = t + DIA_DESFASE_MS;
  return Math.floor(lima / DIA_MS) * DIA_MS + RITUAL.nocheDesde * HORA_MS - lima;
}
// Raciones que ya reposaron: 0 antes de las 6 h; luego 1, y una mas por cada dia, hasta el tope.
export function racionesOlla(olla, ahora = Date.now()) {
  if (!olla || !(olla.t > 0)) return 0;
  const el = ahora - olla.t;
  if (el < RITUAL.ollaMs) return 0;
  return Math.min(RITUAL.ollaMax, 1 + Math.floor((el - RITUAL.ollaMs) / DIA_MS));
}
export const premioAmanecer = nivel => ({ oro: RITUAL.amOro * Math.max(1, nivel | 0), pocion: RITUAL.amPocion });
export const premioOlla = (nivel, r) => ({ oro: RITUAL.ollaOro * Math.max(1, nivel | 0) * r, pocion: RITUAL.ollaPocion * r });
// Lo que da la intencion k a un personaje de ese nivel durante un dia.
export function topeIntencion(k, nivel) {
  const I = RITUAL.int[k];
  if (!I) return 0;
  if (k === 'xp') return nivel >= NIVEL_MAX ? 0 : Math.max(1, Math.round(xpParaSubir(nivel) * I.tope));
  if (k === 'oro') return I.tope * Math.max(1, nivel | 0);
  return I.n;
}
export function textoIntencion(k, nivel) {
  const I = RITUAL.int[k];
  if (!I) return '';
  if (k === 'xp') return `+${Math.round(I.pct * 100)} % de XP de caza (hasta ${fmt(topeIntencion(k, nivel))} XP)`;
  if (k === 'oro') return `+${Math.round(I.pct * 100)} % de oro de misiones (hasta ${fmt(topeIntencion(k, nivel))} de oro)`;
  return `+1 pescado en tus ${I.n} primeras capturas`;
}
const horaValida = (h, [a, b]) => Number.isInteger(h) && h >= a && h <= b;

// La intencion elegida de noche ya maduro: es otro dia de Lima, esa noche ya
// termino (pasadas las 04:00) y durmio al menos RITUAL.maduraMs.
export function intencionMadura(S, ahora = Date.now()) {
  return !!S && !!RITUAL.int[S.k] && S.nid < diaLima(ahora) && nocheId(ahora) !== S.nid && ahora - (S.t || 0) >= RITUAL.maduraMs;
}
// Madura la pendiente: pasa a ser la intencion del dia. Devuelve true si cambio algo.
export function madurarIntencion(c, ahora = Date.now()) {
  const R = c.rit, S = R && R.sig;
  if (!intencionMadura(S, ahora)) return false;
  const hoy = diaLima(ahora);
  R.int = { k: S.k, dia: hoy, q: topeIntencion(S.k, c.nivel), g: 0 };
  delete R.sig;
  return true;
}
// La intencion que vale ahora mismo (o null). Madura la pendiente si toca.
export function intencionActiva(c, ahora = Date.now()) {
  if (!c.rit) return null;
  madurarIntencion(c, ahora);
  const I = c.rit.int;
  return I && I.dia === diaLima(ahora) && I.q > 0 && RITUAL.int[I.k] ? I : null;
}

// Lo que el cliente pinta. No escribe nada (la foto del dia la pone ritualDia).
export function estadoRitual(c, ahora = Date.now()) {
  const R = c.rit || {}, hoy = diaLima(ahora), nid = nocheId(ahora), nv = c.nivel || 1;
  const r = racionesOlla(R.olla, ahora);
  const I = R.int && R.int.dia === hoy && RITUAL.int[R.int.k] ? R.int : null;
  const ini = R.ini && R.ini.d === hoy ? R.ini : null;
  const hechas = (R.n || 0) % RITUAL.protectorCada;
  return {
    ab: nv >= RITUAL.nv ? 1 : 0, nv: RITUAL.nv,
    am: R.am === hoy ? 0 : 1, amPr: premioAmanecer(nv),
    noche: { ab: nid !== null ? 1 : 0, hecho: nid !== null && R.no === nid ? 1 : 0, falta: faltaNoche(ahora) },
    olla: R.olla ? { r, pr: r ? premioOlla(nv, r) : null, ms: Math.max(0, R.olla.t + RITUAL.ollaMs - ahora), max: RITUAL.ollaMax } : null,
    int: I ? { k: I.k, q: I.q, g: I.g || 0, t: topeIntencion(I.k, nv) } : null,
    sig: R.sig && RITUAL.int[R.sig.k] ? { k: R.sig.k } : null,
    opc: Object.keys(RITUAL.int).filter(k => topeIntencion(k, nv) > 0).map(k => ({ k, nombre: RITUAL.int[k].nombre, txt: textoIntencion(k, nv) })),
    n: R.n || 0, prot: RITUAL.protectorCada - hechas,
    log: ini ? { presas: Math.max(0, (c.kills || 0) - ini.k), niveles: Math.max(0, nv - ini.nv), misiones: Math.max(0, ((c.mis || {}).i || 0) - ini.mi) } : null,
  };
}

// ── RECORDATORIOS POR TELEGRAM (solo con consentimiento y franja elegida) ──
// La franja que toca a esta hora de Lima para esta entrada del indice, o null.
export function franjaToca(e, hL, hoy) {
  const fr = e && e.fr, ya = (e && e.frd) || {};
  if (!fr) return null;
  if (horaValida(fr.m, RITUAL.avisoM) && hL >= fr.m && hL < fr.m + RITUAL.avisoVentana && hL < 12 && ya.m !== hoy) return 'm';
  if (horaValida(fr.n, RITUAL.avisoN) && hL >= fr.n && hL < fr.n + RITUAL.avisoVentana && ya.n !== hoy) return 'n';
  return null;
}
// El mismo consentimiento que los avisos de vuelta (retencion.js puedeAvisar):
// cuenta de Telegram con e.si, o jugador web que abrio su chat con el bot (e.tc);
// nunca con /avisos off ni tras un bloqueo.
export function consienteAviso(uid, e, idx) {
  if (!e || e.off || e.bloq) return false;
  if (/^tg:\d{1,15}$/.test(uid)) return !!e.si;
  if (String(uid).startsWith('tg:') || !/^\d{1,15}$/.test(String(e.tc || ''))) return false;
  const t = idx && idx['tg:' + e.tc];
  return !(t && (t.off || t.bloq));
}
export const chatDe = (uid, e) => (/^tg:\d{1,15}$/.test(uid) ? uid.slice(3) : String((e && e.tc) || ''));
// Puede recibir el de esta franja hoy: consintio, entro en los ultimos dias, y
// ese dia no lleva ya un aviso de vuelta (retencion.js) ocupando su sitio.
export function puedeFranja(uid, e, idx, fr, hoy) {
  if (!consienteAviso(uid, e, idx)) return false;
  if (!(e.v > 0) || hoy - e.v > RITUAL.avisoPausa) return false;
  if (fr === 'm') return e.v < hoy && e.ad !== hoy;                     // por la mañana solo si aun no entro hoy
  return e.ad !== hoy || (e.frd || {}).m === hoy;                       // de noche: el de la mañana no lo impide; un aviso de vuelta de hoy si
}
// El texto del recordatorio con lo que de verdad le espera, o null si no hay
// nada que decir (entonces no se envia). Texto plano: el nombre lo eligio el jugador.
export function textoAvisoRitual(c, fr, ahora = Date.now(), evento) {
  if (!c || (c.nivel || 1) < RITUAL.nv) return null;
  const R = c.rit || {}, hoy = diaLima(ahora), nv = c.nivel || 1, L = [];
  const r = racionesOlla(R.olla, ahora);
  const ex = c.exped, exVolvio = ex && ex.fin <= ahora;
  if (fr === 'm') {
    if (R.am === hoy) return null;
    if (r) { const p = premioOlla(nv, r); L.push(`🍲 La olla de Mama Asiri ya reposó: ${r} ${r === 1 ? 'ración' : 'raciones'} (+${p.pocion} pociones y +${fmt(p.oro)} de oro).`); }
    const S = R.sig;
    if (intencionMadura(S, ahora)) L.push(`✨ Tu intención de anoche se cumple hoy: ${textoIntencion(S.k, nv)}.`);
    if (exVolvio) L.push('🧭 Tu expedición ya volvió con oro y materiales.');
    const a = premioAmanecer(nv);
    L.push(`🎁 El regalo del amanecer: +${fmt(a.oro)} de oro y ${a.pocion} poción.`);
    const lg = c.login;
    if (lg && lg.d === new Date((hoy - 1) * DIA_MS).toISOString().slice(0, 10) && lg.racha >= 1) {
      const sig = lg.racha + 1, pr = premioRacha(sig);
      const premio = pr.oro ? `${fmt(Math.round(pr.oro * multLogin(nv) * multSemanaRacha(sig)))} de oro` : pr.txt;
      L.push(`🔥 Día ${diaRacha(sig)} de tu racha: ${premio}.`);
    }
    if (evento) L.push(`${evento.emoji || '🎉'} ${evento.nombre}: sigue hasta el ${evento.hasta}.`);
    L.push(`🎯 Hay ${DIARIA.nombre.toLowerCase()} nueva.`);
    return `☀️ Buenos días, ${c.nombre}. Hoy te espera en el Pueblo Duende:\n\n${L.slice(0, 5).join('\n')}`;
  }
  const nid = nocheId(ahora);
  if (nid === null || R.no === nid) return null;   // ya hizo el ritual de esta noche
  L.push(r ? '🍲 Recoge la olla que ya reposó y déjala otra vez al fuego.' : '🍲 Deja la olla de Mama Asiri al fuego: amanece con pociones y oro.');
  if (nv >= EXPEDICION.nv) {
    if (!ex) L.push('🧭 Manda a tu mascota de expedición nocturna: vuelve por la mañana.');
    else if (exVolvio) L.push('🧭 Tu expedición ya volvió: recógela y mándala de nuevo.');
  }
  L.push('✨ Elige tu intención para mañana: caza, misiones o pesca.');
  const d = c.diaria;
  if (d && !d.ok && (d.p || 0) >= DIARIA.n) L.push(`🎯 Tienes la ${DIARIA.nombre.toLowerCase()} lista para cobrar.`);
  const q = MISIONES[(c.mis || {}).i];
  if (q && (c.mis.p || 0) >= q.n) L.push(`📜 «${q.nombre}» está lista para entregar.`);
  return `🌙 ${c.nombre}, antes de dormir: tu ritual de la noche (menos de un minuto).\n\n${L.slice(0, 5).join('\n')}\n\nSi hoy no puedes, no pasa nada: nada se pierde.`;
}

export const Rituales = {
  // Foto del empezar el dia (para «lo logrado hoy»). Devuelve c.rit.
  ritualDia(s) {
    const c = s.c, hoy = diaLima();
    const R = c.rit || (c.rit = {});
    if (!R.ini || R.ini.d !== hoy) { R.ini = { d: hoy, k: c.kills || 0, nv: c.nivel || 1, mi: (c.mis || {}).i || 0 }; s.sucio = true; }
    if (madurarIntencion(c)) s.sucio = true;
    return R;
  },

  async ritualEnviar(s, extra) {
    const c = s.c;
    let av = null;
    try {
      const idx = await this.retIdx(), e = idx[c.uid];
      av = { m: e && e.fr && horaValida(e.fr.m, RITUAL.avisoM) ? e.fr.m : null, n: e && e.fr && horaValida(e.fr.n, RITUAL.avisoN) ? e.fr.n : null, con: consienteAviso(c.uid, e, idx) ? 1 : 0, tg: /^tg:/.test(c.uid) ? 1 : 0, off: e && e.off && !e.offTarjeta ? 1 : 0 };
    } catch (er) {}
    if (s.cerrado || s.c !== c) return;
    this.enviar(s, { t: 'rit', ...estadoRitual(c), av, ...(extra || {}) });
  },

  // { t:'rit', a:'info' | 'am' | 'olla' | 'noche' | 'aviso' }
  ritual(s, m) {
    const c = s.c;
    if (!c || !m) return;
    const ahora = Date.now();
    if (m.a === 'aviso') return this.ritualAviso(s, m);
    if ((c.nivel || 1) < RITUAL.nv) { if (m.a !== 'info') this.no(s, `Los rituales del día se abren a nivel ${RITUAL.nv}.`); return this.ritualEnviar(s); }
    const R = this.ritualDia(s);
    if (m.a === 'am') return this.ritualAmanecer(s, R, ahora);
    if (m.a === 'olla') return this.ritualOlla(s, R, ahora);
    if (m.a === 'noche') return this.ritualNoche(s, R, m, ahora);
    return this.ritualEnviar(s);
  },

  // Recoge la olla si ya reposo. Devuelve lo ganado o null. No avisa ni guarda.
  ritualRecogerOlla(s, R, ahora) {
    const c = s.c, r = racionesOlla(R.olla, ahora);
    if (!r) return null;
    const p = premioOlla(c.nivel, r);
    R.olla = null;
    c.oro = (c.oro || 0) + p.oro;
    c.pw = c.pw || {};
    c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + p.pocion);
    return { r, ...p };
  },

  // AMANECER: una vez por dia de Lima. Regalo pequeño y, si ya reposo, la olla.
  ritualAmanecer(s, R, ahora) {
    const c = s.c, hoy = diaLima(ahora);
    if (R.am === hoy) return this.ritualEnviar(s);   // dos pestañas o doble toque: ya esta cobrado
    R.am = hoy;
    const a = premioAmanecer(c.nivel);
    c.oro = (c.oro || 0) + a.oro;
    c.pw = c.pw || {};
    c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + a.pocion);
    const olla = this.ritualRecogerOlla(s, R, ahora);
    const I = intencionActiva(c, ahora);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `☀ Amanecer: +${fmt(a.oro + (olla ? olla.oro : 0))} de oro y ${a.pocion + (olla ? olla.pocion : 0)} ${a.pocion + (olla ? olla.pocion : 0) === 1 ? 'poción' : 'pociones'}${olla ? ' (con lo que reposó en la olla)' : ''}.` });
    this.actualizarYo(s);
    this.guardar(s);
    return this.ritualEnviar(s, { gan: { a: 'am', oro: a.oro, pocion: a.pocion, olla, int: I ? I.k : null } });
  },

  ritualOlla(s, R, ahora) {
    const olla = this.ritualRecogerOlla(s, R, ahora);
    if (!olla) return R.olla ? this.no(s, 'La olla aún reposa: Mama Asiri dice que no se destapa antes de tiempo.') : this.ritualEnviar(s);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🥤 De la olla de Mama Asiri: +${olla.pocion} pociones y +${fmt(olla.oro)} de oro${olla.r > 1 ? ` (${olla.r} raciones)` : ''}.` });
    this.actualizarYo(s);
    this.guardar(s);
    return this.ritualEnviar(s, { gan: { a: 'olla', olla } });
  },

  // ANOCHECER: una vez por noche. Deja la olla al fuego y guarda la intencion.
  ritualNoche(s, R, m, ahora) {
    const c = s.c, nid = nocheId(ahora);
    if (nid === null) return this.no(s, `El ritual de la noche se abre a las ${RITUAL.nocheDesde}:00 (hora de Perú).`);
    if (R.no === nid) return this.ritualEnviar(s);   // ya hecho esta noche (otra pestaña o doble toque)
    const k = typeof m.i === 'string' && Object.hasOwn(RITUAL.int, m.i) && topeIntencion(m.i, c.nivel) > 0 ? m.i : null;
    if (!k) return this.no(s, 'Elige una intención para mañana.');
    const olla = this.ritualRecogerOlla(s, R, ahora);   // la de ayer no se pierde al volver a encender
    R.olla = { t: ahora };
    R.sig = { k, t: ahora, nid };
    R.no = nid;
    R.n = (R.n || 0) + 1;
    // Protector 🧿 de la racha diaria, ganado jugando (el mismo de procesarLogin).
    let prot = 0;
    if (R.n % RITUAL.protectorCada === 0 && c.login && (c.login.amu || 0) < RITUAL.protectorMax) { c.login.amu = (c.login.amu || 0) + 1; prot = 1; }
    s.sucio = true;
    if (olla) this.enviar(s, { t: 'toast', ok: true, m: `🥤 Recogiste la olla de ayer: +${olla.pocion} pociones y +${fmt(olla.oro)} de oro.` });
    if (olla || prot) this.actualizarYo(s);
    this.guardar(s);
    const st = estadoRitual(c, ahora);
    const d = c.diaria || {};
    return this.ritualEnviar(s, { gan: { a: 'noche', k, olla, prot }, cierre: { ...(st.log || { presas: 0, niveles: 0, misiones: 0 }), diaria: d.ok ? 1 : 0, exped: c.exped && c.exped.fin > ahora ? 1 : 0, n: R.n, prot } });
  },

  // Eleccion de recordatorio: se guarda siempre (es una preferencia), pero solo
  // se envia con consentimiento (consienteAviso); sin el, el cliente lo pide por
  // el camino de siempre (tarjeta de Telegram o «Avísame por Telegram»).
  async ritualAviso(s, m) {
    const c = s.c, ahora = Date.now();
    if (ahora - (s.ritAvT || 0) < 1500) return;
    s.ritAvT = ahora;
    if (this.uidsPrueba && this.uidsPrueba.has(c.uid)) return this.ritualEnviar(s);
    const hm = horaValida(m.m, RITUAL.avisoM) ? m.m : null, hn = horaValida(m.n, RITUAL.avisoN) ? m.n : null;
    const idx = await this.retIdx();
    const e = idx[c.uid] || (idx[c.uid] = { v: 0 });
    if (hm === null && hn === null) { delete e.fr; delete e.frd; }
    else { e.fr = {}; if (hm !== null) e.fr.m = hm; if (hn !== null) e.fr.n = hn; }
    const okG = await this.retGuardarIdx();
    if (!okG) this.no(s, 'No se pudo guardar tu recordatorio. Intenta de nuevo en un rato.');
    return this.ritualEnviar(s, { avOk: okG ? 1 : 0 });
  },

  // ── Ganchos de la intencion del dia (los llaman world.js y profesiones.js) ──
  // Caza: +3 % de la XP de esta presa, hasta el tope del dia. Devuelve la XP final.
  ritualCaza(s, xp) {
    const c = s.c;
    if (!c.rit || !(xp > 0) || c.nivel >= NIVEL_MAX) return xp;
    const I = intencionActiva(c);
    if (!I || I.k !== 'xp') return xp;
    I.f = (I.f || 0) + xp * RITUAL.int.xp.pct;
    const b = Math.min(I.q, Math.floor(I.f));
    if (b <= 0) return xp;
    I.f -= b; I.q -= b; I.g = (I.g || 0) + b;
    s.sucio = true;
    if (I.q <= 0) this.enviar(s, { t: 'toast', ok: true, m: `🌙 Tu intención de caza dio todo su fruto por hoy: +${fmt(I.g)} XP.` });
    return xp + b;
  },
  // Misiones (cadena de Tito y caza del dia): +15 % del oro, hasta el tope del dia.
  ritualOro(s, oro) {
    const c = s.c;
    if (!c.rit || !(oro > 0)) return 0;
    const I = intencionActiva(c);
    if (!I || I.k !== 'oro') return 0;
    const b = Math.min(I.q, Math.round(oro * RITUAL.int.oro.pct));
    if (b <= 0) return 0;
    I.q -= b; I.g = (I.g || 0) + b;
    c.oro = (c.oro || 0) + b;
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🌙 Tu intención de anoche: +${fmt(b)} de oro extra por esta misión.` });
    return b;
  },
  // Pesca: +1 pescado en las primeras capturas del dia.
  ritualPesca(s) {
    const c = s.c;
    if (!c.rit) return 0;
    const I = intencionActiva(c);
    if (!I || I.k !== 'pesca') return 0;
    I.q -= 1; I.g = (I.g || 0) + 1;
    c.mat = c.mat || {};
    c.mat.pescado = Math.min(999, (c.mat.pescado || 0) + 1);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🌙 Tu intención de anoche: +1 ${MATERIALES.pescado.nombre}${I.q > 0 ? ` (te quedan ${I.q})` : ' (era la última de hoy)'}.` });
    return 1;
  },

  // ── Envio de los recordatorios elegidos (lo llama alarm() de retencion.js, cada hora) ──
  // Como mucho uno por franja y dia, solo a quien eligio esa franja y consintio,
  // con lo que de verdad le espera. Nunca a quien esta conectado.
  async avisosRitual(ahora = Date.now()) {
    const res = { ok: true, enviados: 0, bloqueados: 0, fallidos: 0, quedan: 0, ids: [] };
    const idx = await this.retIdx(), hoy = diaLima(ahora), hL = horaLima(ahora);
    let cambio = false;
    // Un chat no recibe dos de la misma franja aunque tenga personaje web y de Telegram.
    const yaChat = { m: new Set(), n: new Set() };
    for (const u in idx) { const f = idx[u].frd; if (f) for (const k of ['m', 'n']) if (f[k] === hoy) yaChat[k].add(chatDe(u, idx[u])); }
    const evento = this.temporadaAviso ? this.temporadaAviso() : null;
    for (const uid of Object.keys(idx)) {
      const e = idx[uid], fr = franjaToca(e, hL, hoy);
      if (!fr || !puedeFranja(uid, e, idx, fr, hoy)) continue;
      if (this.porUid.has(uid) || (this.uidsPrueba && this.uidsPrueba.has(uid))) continue;
      const chat = chatDe(uid, e);
      if (yaChat[fr].has(chat)) continue;
      if (res.enviados + res.fallidos + res.bloqueados >= RITUAL.avisoTanda) { res.quedan++; continue; }
      const c = await this.state.storage.get('c:' + uid);
      if (!c || !franjaToca(e, hL, hoy) || !puedeFranja(uid, e, idx, fr, hoy) || this.porUid.has(uid)) continue;   // pudo entrar mientras se leia
      const frd0 = e.frd ? { ...e.frd } : null;
      e.frd = { ...(e.frd || {}), [fr]: hoy }; cambio = true;   // se marca antes de enviar: nada lo repite hoy
      const texto = textoAvisoRitual(c, fr, ahora, evento);
      if (!texto) continue;   // nada real que decir: hoy no se le escribe en esta franja
      const url = c.en3d ? MUNDO_URL : MMO_URL;
      const abrir = uid.startsWith('tg:') ? { text: '🌍 Abrir el juego', web_app: { url } } : { text: '🌍 Abrir el juego', url };
      let r = null;
      try {
        r = await this.tgEnviar('sendMessage', { chat_id: chat, text: texto, disable_web_page_preview: true, reply_markup: { inline_keyboard: [[abrir], [{ text: '🔕 No quiero más avisos', callback_data: 'mmoavisos:off' }]] } });
      } catch (er) { r = null; }
      if (r && r.ok) {
        res.enviados++; res.ids.push(chat); yaChat[fr].add(chat);
        e.ad = hoy;   // hoy ya no le toca tambien el aviso de vuelta
        if (!uid.startsWith('tg:') && idx['tg:' + chat]) idx['tg:' + chat].adw = hoy;
      } else if (r && r.error_code === 403) { e.bloq = 1; res.bloqueados++; }
      else { if (frd0) e.frd = frd0; else delete e.frd; res.fallidos++; }   // fallo pasajero: se reintenta en la hora siguiente
    }
    if (cambio) await this.retGuardarIdx();
    if (res.enviados || res.bloqueados || res.fallidos) console.log('[MMO avisos ritual ' + hL + 'h Lima]', { enviados: res.enviados, bloqueados: res.bloqueados, fallidos: res.fallidos, quedan: res.quedan });
    return res;
  },
};
