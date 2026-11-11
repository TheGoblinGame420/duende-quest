// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — premio físico: un litro de chicha morada
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada monstruo que cazas suelta SIEMPRE su 🥤 con puntos (no es al azar:
// un premio físico por suerte se parece a un sorteo, que en Perú necesita
// autorización). Con CHICHA.niveles[i] puntos se reclama un litro, que el
// dueño envía a mano: el bot le avisa y el jugador coordina por WhatsApp con su
// código de reclamo (o por Telegram si entró por ahí). El juego NO guarda
// direcciones. Frenos contra bots: solo cuentas reales, puntos desde Nv 10,
// tope diario, reclamar desde Nv 15 con 48 h de personaje, cuenta real (no
// invitado), aprobación manual y un tope de litros al mes.
// Contra multicuentas y suplantación: cada reclamo guarda huellas (hash) del dispositivo y
// de la red, para que el dueño vea coincidencias, y una clave de entrega que solo se ve
// dentro de la cuenta del jugador y que el dueño pide por WhatsApp antes de la dirección.
// Los puntos no se compran, no se venden y no se gastan al reclamar.
// ═══════════════════════════════════════════════════════
import { CHICHA, MONSTRUOS, hoyUTC, mesChicha } from '../../mmo/js/data.js';

const mesUTC = () => new Date().toISOString().slice(0, 7);
const sigMes = m => { const a = +m.slice(0, 4), b = +m.slice(5, 7); return b === 12 ? `${a + 1}-01` : `${a}-${String(b + 1).padStart(2, '0')}`; };
const LIBERADO = 'No se coordinó el envío. Puedes volver a reclamarlo.';
// Desde cuándo le toca a un reclamo: quien esperó meses en cola no lleva todo ese tiempo «sin coordinar».
const desdeChicha = x => Math.max(x.creado || 0, x.toca || 0, x.mesEnt ? Date.UTC(+x.mesEnt.slice(0, 4), +x.mesEnt.slice(5, 7) - 1, 1) : 0);
// Desde aqui se miden los minutos jugados (c.tjs): los personajes nuevos empiezan en 0.
const TJS_DESDE = Date.UTC(2026, 10, 2);
// Lo ya reclamado, con los reclamos de los niveles viejos contados como su nivel actual
// (10.000 vale por 25.000 y 50.000 por 100.000): nadie pasa de dos litros por puntos.
const recVigente = ch => {
  const rec = (ch && ch.rec) || [], extra = CHICHA.niveles.filter((n, i) => rec.includes(CHICHA.antes[i]) && !rec.includes(n));
  return extra.length ? [...rec, ...extra] : rec;
};

// Huella corta y síncrona (cyrb53): el reclamo no puede esperar a crypto.subtle entre
// sus comprobaciones y el guardado, porque otro mensaje podría colarse y reclamar dos veces.
const huella = txt => {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (const ch of 'dq-chicha:' + txt) { const k = ch.codePointAt(0); a = Math.imul(a ^ k, 2654435761); b = Math.imul(b ^ k, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
};
// La red de una IP: en IPv6, su /64 (cada casa o celular cambia el resto); en IPv4, la IP entera.
const redDeIp = ip => {
  if (!ip.includes(':')) return ip;
  const [iz, de = ''] = ip.toLowerCase().split('::'), A = iz ? iz.split(':') : [], B = de ? de.split(':') : [];
  return [...A, ...Array(Math.max(0, 8 - A.length - B.length)).fill('0'), ...B].slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
};
// Clave de entrega: sin letras que se confundan al dictarla (0/O, 1/I/L).
const nuevaClave = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[n % 31]).join('');
const nombrePlano = n => String(n || '').replace(/[^\p{L}\p{N} ]/gu, '');

export const Chicha = {
  // La clave de un reclamo; los que ya esperaban sin ella la reciben aquí una sola vez.
  claveChicha(x) {
    if (!x.clave) {
      x.clave = nuevaClave();
      try { const p = this.state.storage.put('chichas', this.chichas); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
    return x.clave;
  },

  // Otras cuentas con el mismo dispositivo, red o teléfono: un dato para el dueño, no una prueba.
  coincidenciasChicha(r) {
    const otros = (this.chichas || []).filter(x => x.uid !== r.uid), out = [];
    const linea = (etiqueta, campo) => {
      if (!r[campo]) return;
      const L = otros.filter(x => x[campo] === r[campo]);
      if (L.length) out.push(`${etiqueta}: ${L.slice(-5).map(x => `#${x.id} ${nombrePlano(x.nombre)} (${x.estado})`).join(', ')}${L.length > 5 ? ` y ${L.length - 5} más` : ''}`);
    };
    linea('⚠️ Mismo dispositivo que', 'hd');
    linea('⚠️ Mismo teléfono que', 'ht');
    linea(r.hv ? '⚠️ Misma red de casa o cabina que' : '🌐 Misma IP (puede ser compartida, sobre todo en datos móviles) que', 'hi');
    // El juego siempre manda su identificador: si llega la red pero no él, no hay con qué cruzarlo (los reclamos de antes no traen ninguno).
    if (r.hi && !r.hd) out.push('❔ Sin huella de dispositivo: navegador muy restringido o cliente alterado.');
    return out;
  },

  infoChicha(c) {
    const ch = c.chicha || {};
    // dj / mj: días y minutos jugados (los requisitos del premio de Nv 60, para la lista del panel).
    // q60: su puesto real entre los reclamos de Nv 60 sin revisar (panel Mis objetivos); solo si ya reclamó.
    if (ch.rc || (ch.rec || []).length) this.planChicha60();
    const q60 = (ch.rec || []).includes('nv60') ? this.puestoChicha60(c.uid) : null;
    // rcl: sus reclamos con su código, para el botón de WhatsApp (solo si alguna vez reclamó).
    const rcl = ch.rc || (ch.rec || []).length ? this.reclamosChicha(c.uid) : null;
    return { p: ch.p || 0, hoy: ch.d === hoyUTC() ? ch.hoy || 0 : 0, rec: recVigente(ch), dj: (c.login || {}).total || 0, mj: Math.floor(this.segJugados(c) / 60), ...(q60 ? { q60 } : {}), ...(rcl && rcl.length ? { rcl } : {}) };
  },

  // El último reclamo de cada premio: lo único que el jugador necesita ver de la lista.
  reclamosChicha(uid) {
    const porMeta = new Map();
    for (const x of this.chichas || []) if (x.uid === uid) { const i = CHICHA.antes.indexOf(x.meta); porMeta.set(i >= 0 ? CHICHA.niveles[i] : x.meta, x); }   // el viejo y el nuevo son el mismo premio
    return [...porMeta.values()].map(x => ({ id: x.id, meta: x.meta, estado: x.estado, l: x.litros || 1, ...(x.estado === 'pendiente' && x.mesEnt ? { me: x.mesEnt, ...(x.mesEnt > mesUTC() ? { cola: 1 } : {}) } : {}), ...(x.estado === 'pendiente' && x.coord ? { coord: 1 } : {}), ...(x.estado === 'pendiente' ? { cl: this.claveChicha(x) } : {}), ...(x.estado === 'rechazado' && x.motivo ? { motivo: x.motivo } : {}) }));
  },

  // Reparte los premios de Nv 60 por mes de entrega (mesEnt, tope CHICHA.mesMax60). Enviados y
  // pendientes cuyo mes ya llegó se quedan en su mes; los que esperan un mes futuro se recolocan
  // por antigüedad en el primero con cupo, y así un cupo liberado lo aprovecha el primero de la
  // cola. Nada caduca solo. Reclamos sin mesEnt (de antes): los normales valen en su mes y los
  // EN COLA entran en este reparto. Es idempotente; devuelve mes -> premios asignados.
  planChicha60() {
    const mes = mesUTC(), uso = new Map(), cola = [];
    for (const x of this.chichas || []) {
      if (x.meta !== 'nv60' || x.estado === 'rechazado') continue;
      if (x.estado === 'pendiente' && (x.mesEnt ? x.mesEnt > mes : x.cola)) { cola.push(x); continue; }
      if (!x.mesEnt) x.mesEnt = x.cola && x.cerrado ? new Date(x.cerrado).toISOString().slice(0, 7) : x.mes;
      uso.set(x.mesEnt, (uso.get(x.mesEnt) || 0) + 1);
    }
    cola.sort((a, b) => (a.creado || 0) - (b.creado || 0));
    for (const x of cola) {
      let m = mes;
      while ((uso.get(m) || 0) >= CHICHA.mesMax60) m = sigMes(m);
      if (m === mes && x.mesEnt > mes) x.toca = Date.now();   // subió de la cola a este mes: le toca desde ahora
      x.mesEnt = m;
      uso.set(m, (uso.get(m) || 0) + 1);
    }
    return uso;
  },

  puestoChicha60(uid) {
    const L = (this.chichas || []).filter(x => x.meta === 'nv60' && x.estado === 'pendiente'), i = L.findIndex(x => x.uid === uid);
    if (i >= 0) return { p: i + 1, n: L.length, id: L[i].id, cola: (L[i].mesEnt || '') > mesUTC(), me: L[i].mesEnt };
    const r = (this.chichas || []).filter(x => x.meta === 'nv60' && x.uid === uid).pop();
    return r ? { estado: r.estado } : null;
  },

  // Segundos de juego activo (los suma el tick de 10 s de world.js). Los personajes de
  // antes de medirlo arrancan con 45 min por día que entraron (tope CHICHA.min60): no se
  // les castiga por un dato que no existía.
  segJugados(c) {
    if (typeof c.tjs !== 'number') c.tjs = (c.creado || 0) >= TJS_DESDE ? 0 : Math.min(CHICHA.min60, ((c.login || {}).total || 0) * 45) * 60;
    return c.tjs;
  },
  sumarJugado(c, seg) { c.tjs = this.segJugados(c) + seg; },
  // Primeras 3 cazas con Nv < 10: el cliente enseña «🔒 🥤 desde Nv 10» (que se sepa desde el minuto 1).
  candadoChicha(c) { return c.nivel < CHICHA.nvPuntos && (c.kills || 0) <= 3; },
  // Lo que falta para el premio de Nv 60 (lista vacía = cumple).
  faltan60(c) {
    const f = [], dj = (c.login || {}).total || 0, mj = Math.floor(this.segJugados(c) / 60);
    if (dj < CHICHA.dias60) f.push(`${CHICHA.dias60} días jugados (llevas ${dj})`);
    if (mj < CHICHA.min60) f.push(`${Math.round(CHICHA.min60 / 60)} horas de juego (llevas ${Math.floor(mj / 60)})`);
    return f;
  },

  // Al cazar (desde dar()): 1 punto, 3 si el monstruo es de tu nivel o más,
  // 25 un jefe. Devuelve los puntos sumados (para el "+N 🥤" del cliente).
  sumarChicha(s, o) {
    const c = s.c;
    if (!o || c.nivel < CHICHA.nvPuntos || !this.elegibilidad(c).cuenta) return 0;
    // Premio real: solo quien pego o curo en esa pelea (el compañero de grupo que mira no suma).
    if (o.dano instanceof Map && !o.dano.has(s.id) && !(o.cura instanceof Map && o.cura.has(s.id))) return 0;
    const ch = c.chicha || (c.chicha = { p: 0, d: '', hoy: 0, rec: [] });
    const hoy = hoyUTC();
    if (ch.d !== hoy) { ch.d = hoy; ch.hoy = 0; }
    const nvM = o.nv || (MONSTRUOS[o.k] && MONSTRUOS[o.k].nivel) || 1;
    let n = o.jefe ? 25 : nvM >= c.nivel ? 3 : 1;
    n = Math.min(n, CHICHA.porDia - ch.hoy);
    if (n <= 0) return 0;
    ch.hoy += n; ch.p = (ch.p || 0) + n;
    if (ch.hoy >= CHICHA.porDia) this.enviar(s, { t: 'toast', m: `🥤 Llegaste al tope de ${CHICHA.porDia} puntos de chicha de hoy. Mañana sigues sumando.` });
    // Aviso al cruzar un nivel de premio.
    for (const meta of CHICHA.niveles) {
      if (ch.p >= meta && ch.p - n < meta && !recVigente(ch).includes(meta)) {
        this.enviar(s, { t: 'toast', m: `${meta.toLocaleString('es', { useGrouping: 'always' })} puntos de chicha. Reclama tu litro de chicha morada en ${s.m3 ? 'la barra morada 🥤 (en el celular, ⋯ → Chicha)' : 'Inventario → «Chicha»'}.`, ok: true });
      }
    }
    return n;
  },

  async reclamarChicha(s, m) {
    const c = s.c;
    // meta: puntos (CHICHA.niveles) o 'nv60' (2 litros por llegar a nivel 60).
    const meta = CHICHA.niveles.includes(m.meta) ? m.meta : m.meta === 'nv60' ? 'nv60' : null;
    if (!meta) return;
    const es60 = meta === 'nv60';
    const ch = c.chicha || {};
    const el = this.elegibilidad(c);
    if (!el.cuenta) return this.no(s, 'Los premios físicos son solo para cuentas: crea la tuya con Telegram o con tu correo.');
    if (c.nivel < CHICHA.nvReclamo) return this.no(s, `Puedes reclamar desde nivel ${CHICHA.nvReclamo}.`);
    if (!el.edad) return this.no(s, 'Tu personaje necesita al menos 2 días de vida para reclamar premios.');
    if (es60 && c.nivel < CHICHA.nv60) return this.no(s, `Los ${CHICHA.litros60} litros de chicha son para quien llega a nivel ${CHICHA.nv60}. ¡Te faltan ${CHICHA.nv60 - c.nivel}!`);
    // Nv 60 blindado: además del nivel, tiempo de juego real (un bot que sube en 3 días no llega).
    const faltan = es60 ? this.faltan60(c) : [];
    if (faltan.length) return this.no(s, '🥤 Para los ' + CHICHA.litros60 + ' litros te falta: ' + faltan.join(' y ') + '. ¡Sigue jugando!');
    if (!es60 && (ch.p || 0) < meta) return this.no(s, `Te faltan puntos: tienes ${(ch.p || 0).toLocaleString('es', { useGrouping: 'always' })} de ${meta.toLocaleString('es', { useGrouping: 'always' })}.`);
    if (recVigente(ch).includes(meta)) return this.no(s, 'Ese premio ya lo reclamaste.');
    this.chichas = this.chichas || [];
    const espera = this.chichas.find(x => x.uid === c.uid && x.estado === 'pendiente');
    if (espera) return this.no(s, `Ya tienes un reclamo esperando (#${espera.id}): coordina el envío por WhatsApp con ese código.`);
    const mes = mesUTC();
    const delMes = this.chichas.filter(x => x.mes === mes && x.meta !== 'nv60' && x.estado !== 'rechazado').length;   // los de Nv 60 llevan su propio tope (mesMax60)
    if (!es60 && delMes >= CHICHA.mesMax) return this.no(s, `Los ${CHICHA.mesMax} litros por puntos de este mes ya están reclamados. Tus puntos no se pierden: reclama el mes que viene, o antes si se libera alguno.`);
    // Nv 60 con su propio tope al mes: toma el primer mes con cupo, contando también la cola. Sin sitio este mes: EN COLA.
    let mesEnt = mes;
    if (es60) { const uso = this.planChicha60(); while ((uso.get(mesEnt) || 0) >= CHICHA.mesMax60) mesEnt = sigMes(mesEnt); }
    const cola = mesEnt > mes, mesTxt = mesChicha(mesEnt);
    ch.rec = [...(ch.rec || []), meta];
    ch.rc = 1;
    c.chicha = ch;
    const r = { id: Math.random().toString(36).slice(2, 7).toUpperCase(), uid: c.uid, nombre: c.nombre, nivel: c.nivel, meta, litros: es60 ? CHICHA.litros60 : 1, puntos: ch.p, mes, creado: Date.now(), estado: 'pendiente', cola: cola || undefined, mesEnt: es60 ? mesEnt : undefined, clave: nuevaClave() };
    // Huellas para que el dueño cruce cuentas: nunca la IP en claro, y nunca salen hacia el cliente.
    if (s.dev) r.hd = huella('d:' + s.dev);
    if (s.ip) { r.hi = huella('i:' + redDeIp(s.ip)); if (s.ip.includes(':')) r.hv = 1; }
    this.chichas.push(r);
    // Recorta lo viejo y cerrado; un pendiente o un enviado que aún cuenta para el cupo no se borra nunca.
    if (this.chichas.length > 300) {
      let sobran = this.chichas.length - 300;
      this.chichas = this.chichas.filter(x => {
        if (sobran <= 0 || x.estado === 'pendiente' || (x.estado === 'enviado' && (x.mesEnt || x.mes) >= mes)) return true;
        sobran--; return false;
      });
    }
    await this.state.storage.put('chichas', this.chichas);
    s.sucio = true;
    await this.guardar(s);
    this.actualizarYo(s);
    this.enviar(s, { t: 'chicha_rec', id: r.id });   // el cliente enseña el código y el botón de WhatsApp
    const enTg = c.uid.startsWith('tg:'), tgId = enTg ? c.uid.slice(3) : '';
    // Para el dueño: horas, días y si subió sospechosamente rápido (menos de 21 días de vida o de 50 h).
    const hJ = Math.floor(this.segJugados(c) / 3600), dJ = (c.login || {}).total || 0, vida = Math.floor((Date.now() - (c.creado || Date.now())) / 86400000);
    const rapido = (es60 ? vida < 21 || hJ < 50 : vida + 1 < Math.ceil(meta / CHICHA.porDia)) ? ' ⚠️ rápido' : '';   // por puntos: menos días de vida de los que da el tope diario
    const alertas = this.coincidenciasChicha(r);
    const queEs = es60 ? `${CHICHA.litros60} litros por llegar a nivel ${CHICHA.nv60}` : `${meta.toLocaleString('es', { useGrouping: 'always' })} puntos`;
    this.avisarAdmin(`🥤 *Premio de chicha #${r.id}* — ${queEs}\n👤 ${c.nombre.replace(/[^\p{L}\p{N} ]/gu, '')} · Nv ${c.nivel} · ${c.kills} cazas\n⏱ ${hJ} h jugadas · ${dJ} días jugados · ${vida} días de vida${rapido}${cola ? `\n⏳ EN COLA: el tope de Nv 60 de este mes está lleno, le toca en ${mesTxt}.` : ''}\n📨 Contacto: ${enTg ? `[abrir chat](tg://user?id=${tgId}) (id ${tgId})` : 'cuenta de correo: te escribe por WhatsApp con su código'}${alertas.length ? '\n' + alertas.join('\n') : ''}\n💬 Te puede escribir al WhatsApp de la chicha con este código.\n🔑 Clave de entrega: *${r.clave}*. Solo la ve el jugador dentro de su cuenta: el nombre y el código no prueban nada.\n\n${enTg ? 'Puedes escribirle a ese chat: ya es su cuenta, ahí no le pidas la clave. Si te escribe por WhatsApp, pídele' : 'Cuando te escriba, pídele'} primero la clave; si no coincide, no tomes la dirección. Anota su teléfono: /chichatel ${r.id} NUMERO. Al coordinar: /chichacoord ${r.id}. Al enviarlo: /chichaok ${r.id}\nSi es trampa o no se puede: /chichano ${r.id} motivo`, null, false, 'chicha');
    if (enTg) try { await this.tgEnviar('sendMessage', { chat_id: tgId, text: `🥤 ¡Reclamaste ${es60 ? `tus ${CHICHA.litros60} litros` : 'tu litro'} de chicha morada (${queEs})! Código #${r.id}. ${cola ? `El cupo de nivel 60 de este mes está lleno: quedas EN COLA, con envío estimado para ${mesTxt}. ` : ''}Para coordinar el envío (solo dentro del Perú) escríbenos por WhatsApp al ${CHICHA.whatsappVer} (https://wa.me/${CHICHA.whatsapp}) con tu código. Por WhatsApp, antes de tomar tu dirección te pediremos tu clave de entrega, que solo ves en el panel de la chicha dentro del juego: dásela únicamente a ese número. Envío gratis: nunca te pediremos pagos ni contraseñas.` }); } catch (e) {}
    this.enviar(s, { t: 'toast', m: `Reclamo #${r.id} enviado${cola ? ` (en cola: envío estimado para ${mesTxt})` : ''}. Coordina el envío por WhatsApp con tu código.`, ok: true });
  },

  // Ordenes del dueño desde el bot: /chicha, /chichasin, /chichacoord, /chichalibera, /chichaok, /chichano, /chichatel.
  async internoChicha(accion, b) {
    this.chichas = this.chichas || [];
    const uso = this.planChicha60(), mesAct = mesUTC();
    const pends = this.chichas.filter(x => x.estado === 'pendiente').sort((a, b) => (a.creado || 0) - (b.creado || 0)).map(x => ({ ...x, cola: (x.mesEnt || '') > mesAct, desde: desdeChicha(x) }));
    if (accion === 'chichas') {
      // meses60: lo debido de Nv 60 por mes: el mes en curso, los futuros con cola y los atrasados con algo sin enviar.
      const meses = [...new Set([mesAct, ...uso.keys()])].filter(m => m >= mesAct || pends.some(x => x.meta === 'nv60' && x.mesEnt === m)).sort();
      const meses60 = meses.map(m => ({ mes: m, n: uso.get(m) || 0, pend: pends.filter(x => x.meta === 'nv60' && x.mesEnt === m).length }));
      return { ok: true, pendientes: pends.map(x => ({ ...x, clave: this.claveChicha(this.chichas.find(y => y.id === x.id)), alertas: this.coincidenciasChicha(x) })), mes: this.chichas.filter(x => x.mes === mesAct && x.meta !== 'nv60' && x.estado !== 'rechazado').length, mesMax: CHICHA.mesMax, mes60: uso.get(mesAct) || 0, mesMax60: CHICHA.mesMax60, meses60 };
    }
    // Los no coordinados a los que ya les toca, del más antiguo al más nuevo (dias: mínimo desde que les toca).
    if (accion === 'chichasSin') {
      const dias = Math.max(0, Number(b.dias) || 0), sin = pends.filter(x => !x.coord);
      return { ok: true, lista: sin.filter(x => !x.cola && (!dias || Date.now() - x.desde >= dias * 86400000)), enCola: sin.filter(x => x.cola).length, dias };
    }
    // /chichatel: se guarda solo la huella del teléfono, para avisar si otro reclamo trae el mismo.
    if (accion === 'chichaTel') {
      const t = this.chichas.filter(x => x.id === String(b.id || '').toUpperCase()).pop();
      if (!t) return { ok: false, error: 'No hay un reclamo con ese código.' };
      const tel = String(b.tel || '').replace(/\D/g, '').replace(/^(?:00)?51(?=\d{9}$)/, '');
      if (tel.length < 7 || tel.length > 15) return { ok: false, error: 'Ese teléfono no parece válido.' };
      t.ht = huella('t:' + tel);
      await this.state.storage.put('chichas', this.chichas);
      return { ok: true, id: t.id, alertas: this.coincidenciasChicha(t) };
    }
    const r = this.chichas.find(x => x.id === String(b.id || '').toUpperCase() && x.estado === 'pendiente');
    if (!r) return { ok: false, error: 'No hay un reclamo pendiente con ese código.' };
    if (accion === 'chichaCoord') {
      r.coord = Date.now();
      await this.state.storage.put('chichas', this.chichas);
      const { s } = await this.pjDe(r.uid);
      if (s) this.actualizarYo(s);
      return { ok: true, chicha: r };
    }
    const libera = accion === 'chichaLibera';
    if (libera && r.coord) return { ok: false, error: `El reclamo #${r.id} ya está coordinado: no se libera. Si de verdad no se puede: /chichano ${r.id} motivo` };
    if (libera && (r.mesEnt || '') > mesAct) return { ok: false, error: `Al reclamo #${r.id} aún no le toca: está en cola para ${mesChicha(r.mesEnt)}.` };
    // Lo reclamado con las cifras viejas se respeta: al liberarlo le pedirían los puntos de la cifra nueva y perdería el premio.
    if (libera && CHICHA.antes.includes(r.meta)) return { ok: false, error: `El reclamo #${r.id} es de la cifra anterior (${r.meta.toLocaleString('es', { useGrouping: 'always' })} puntos): al liberarlo tendría que llegar a la cifra nueva para volver a reclamar. No se libera; decide tú con /chichano ${r.id} motivo.` };
    if (libera) { r.liberado = 1; b = { ...b, motivo: b.motivo || LIBERADO, trampa: false }; }
    r.estado = accion === 'chichaOk' ? 'enviado' : 'rechazado';
    r.cerrado = Date.now();
    if (b.motivo) r.motivo = String(b.motivo).slice(0, 200);
    if (r.estado === 'rechazado') this.planChicha60();   // el cupo liberado pasa al primero de la cola
    // Rechazado sin ser trampa: puede volver a reclamarlo.
    if (r.estado === 'rechazado' && !b.trampa) {
      const { s, c } = await this.pjDe(r.uid);
      if (c && c.chicha) {
        c.chicha.rec = (c.chicha.rec || []).filter(x => x !== r.meta);
        if (s) { s.sucio = true; this.actualizarYo(s); if (libera) this.enviar(s, { t: 'toast', m: `🥤 Tu reclamo #${r.id} se liberó porque no se coordinó el envío. Puedes volver a reclamarlo.` }); } else await this.state.storage.put('c:' + r.uid, c);
      }
    }
    await this.state.storage.put('chichas', this.chichas);
    const txt = r.estado === 'enviado' ? `🥤 ¡${(r.litros || 1) > 1 ? `Tus ${r.litros} litros` : 'Tu litro'} de chicha morada (#${r.id}) va en camino! Gracias por jugar DUENDE QUEST ONLINE.` : `🥤 Tu reclamo de chicha #${r.id} no se pudo completar${r.motivo ? ': ' + r.motivo : ''}.`;
    if (libera) return { ok: true, chicha: r, mesPasado: (r.mesEnt || r.mes) < mesAct };   // liberar no escribe por Telegram: lo ve en su panel
    // Cuenta de correo sin Telegram: se entera dentro del juego si esta conectada; si no, en su panel al volver.
    // avisado le dice al bot que contar al dueño: antes decia «se le avisó» aunque nadie le hubiera escrito.
    let avisado = '';
    if (r.uid.startsWith('tg:')) { avisado = 'telegram'; try { await this.tgEnviar('sendMessage', { chat_id: r.uid.slice(3), text: txt }); } catch (e) { avisado = ''; } }
    const sv = this.porUid && this.porUid.get(r.uid);
    if (sv && sv.c) { this.enviar(sv, { t: 'toast', m: txt, ok: r.estado === 'enviado' }); this.actualizarYo(sv); avisado = avisado || 'juego'; }
    return { ok: true, chicha: r, avisado };
  },
};
