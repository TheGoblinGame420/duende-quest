// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — grupos y chat (al estilo WoW)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Grupos de hasta 5 (una banda, hasta 10): se invita desde el marco del objetivo o desde la lista
// de jugadores. Los miembros se guardan por uid (no por sesion), asi quien se
// desconecta un momento vuelve a su grupo al entrar. Viven en memoria: un
// despliegue (que reinicia el Durable Object) los disuelve.
//
// Chat: general (todo el servidor), decir (/d, solo tu mapa), grupo (/g),
// hermandad (/h) y susurro (/s Nombre texto).
//
// Buscar grupo: te anuncias para una mazmorra (10 min) y quien tenga nivel
// se une con un toque, sin esperar a que aceptes (el lider puede expulsar).
// ═══════════════════════════════════════════════════════
import { MAPAS, MAZMORRAS, BANDA_MAX, GESTOS } from '../../mmo/js/data.js';

export const GRUPO_MAX = 5;
// Un grupo convertido en banda (boton del lider o al buscar gente para la
// banda) admite hasta 10.
export const maxGrupo = g => (g && g.banda ? BANDA_MAX : GRUPO_MAX);
// Identificador publico de un personaje: el uid real es "tg:<id de
// Telegram>" o el de la cuenta web, y no debe llegar a otros jugadores.
// FNV-1a de 32 bits con una sal al azar de este arranque del servidor: sin
// la sal no se puede probar ids de Telegram uno a uno hasta dar con el. Los
// clientes no lo guardan, asi que cambiar en cada despliegue no molesta.
let SAL = '';
export function pub(uid) {
  if (!SAL) SAL = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let h = 0x811c9dc5;
  const t = SAL + ':' + uid;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const INVITACION_MS = 60000;
export const CONTACTOS_MAX = 50;      // amigos en la lista de cada personaje
export const LFG_MS = 10 * 60000;       // cuanto dura un anuncio de "busco grupo"
const LFG_CADA_MS = 60000;              // y cada cuanto se puede volver a anunciar
const limpiar = t => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);

export const Social = {
  iniciarSocial() {
    if (!this.grupos) { this.grupos = new Map(); this.sigGrupo = 1; }
  },
  grupoDe(s) { this.iniciarSocial(); return s && s.gid ? this.grupos.get(s.gid) || null : null; },
  // Sesiones conectadas de un grupo (los desconectados no tienen sesion).
  sesionesGrupo(g) { return g ? g.uids.map(u => this.porUid.get(u)).filter(x => x && x.c && !x.cerrado) : []; },
  mismoGrupo(a, b) { return !!(a && b && a.gid && a.gid === b.gid); },

  // ── INVITAR ──
  invitar(s, m) {
    this.iniciarSocial();
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c || t === s) return;
    const g = this.grupoDe(s);
    if (g && g.lider !== s.c.uid) return this.no(s, 'Solo el líder del grupo puede invitar.');
    if (g && g.uids.length >= maxGrupo(g)) return this.no(s, g.banda ? `La banda ya está llena (${BANDA_MAX}).` : `El grupo ya está lleno (${GRUPO_MAX}). El líder puede convertirlo en banda (hasta ${BANDA_MAX}).`);
    if (t.gid) return this.no(s, `${t.c.nombre} ya está en un grupo.`);
    if (t.invitacion && t.invitacion.hasta > Date.now() && t.invitacion.de !== s.c.uid) return this.no(s, `${t.c.nombre} ya tiene una invitación pendiente.`);
    t.invitacion = { de: s.c.uid, hasta: Date.now() + INVITACION_MS };
    this.enviar(t, { t: 'invitacion', de: s.c.nombre, nv: s.c.nivel, cl: s.c.clase || '', ms: INVITACION_MS });
    this.enviar(s, { t: 'toast', m: `📨 Invitaste a ${t.c.nombre} a tu grupo.` });
  },

  respuestaGrupo(s, m) {
    this.iniciarSocial();
    const inv = s.invitacion;
    s.invitacion = null;
    if (!inv || inv.hasta < Date.now()) return this.no(s, 'Esa invitación ya caducó.');
    const lider = this.porUid.get(inv.de);
    if (!m.si) { if (lider) this.enviar(lider, { t: 'toast', m: `${s.c.nombre} rechazó tu invitación.` }); return; }
    if (!lider || !lider.c) return this.no(s, 'Quien te invitó ya no está conectado.');
    if (s.gid) return this.no(s, 'Ya estás en un grupo.');
    let g = this.grupoDe(lider);
    if (!g) {
      g = { id: this.sigGrupo++, lider: lider.c.uid, uids: [lider.c.uid] };
      this.grupos.set(g.id, g);
      lider.gid = g.id;
    }
    if (g.uids.length >= maxGrupo(g)) return this.no(s, 'El grupo ya está lleno.');
    g.uids.push(s.c.uid);
    s.gid = g.id;
    this.avisarGrupo(g, `👥 ${s.c.nombre} se unió al grupo.`);
    this.enviarGrupo(g);
  },

  salirGrupo(s, motivo) {
    const g = this.grupoDe(s);
    if (!g) return;
    g.uids = g.uids.filter(u => u !== s.c.uid);
    s.gid = 0;
    if (g.inst && this.sacarDeInstancia) this.sacarDeInstancia(s, g.inst);
    this.enviar(s, { t: 'grupo', g: null });
    if (motivo !== 'silencio') this.avisarGrupo(g, `👥 ${s.c.nombre} ${motivo === 'expulsado' ? 'fue expulsado del' : 'dejó el'} grupo.`);
    this.ordenarGrupo(g);
  },
  // Lider nuevo si se fue el anterior; disolver si queda uno solo.
  ordenarGrupo(g) {
    if (g.uids.length < 2) {
      for (const x of this.sesionesGrupo(g)) { x.gid = 0; this.enviar(x, { t: 'grupo', g: null }); this.enviar(x, { t: 'toast', m: '👥 El grupo se disolvió.' }); }
      this.grupos.delete(g.id);
      if (this.alDisolverGrupo) this.alDisolverGrupo(g);
      return;
    }
    if (!g.uids.includes(g.lider)) {
      const conectado = g.uids.find(u => this.porUid.has(u)) || g.uids[0];
      g.lider = conectado;
      const l = this.porUid.get(conectado);
      if (l) this.avisarGrupo(g, `👑 ${l.c.nombre} es el nuevo líder del grupo.`);
    }
    this.enviarGrupo(g);
  },
  expulsarGrupo(s, m) {
    const g = this.grupoDe(s);
    const uid = g && g.uids.find(u => pub(u) === m.uid);
    if (!g || g.lider !== s.c.uid || !uid || uid === s.c.uid) return;
    const t = this.porUid.get(uid);
    if (t) { this.salirGrupo(t, 'expulsado'); this.enviar(t, { t: 'toast', m: '👥 Te expulsaron del grupo.' }); }
    else {
      g.uids = g.uids.filter(u => u !== uid);
      if (this.instDe && this.instDe.get(uid) === g.inst) this.instDe.delete(uid);
      this.avisarGrupo(g, '👥 Un miembro desconectado fue expulsado del grupo.'); this.ordenarGrupo(g);
    }
  },
  // Convertir el grupo en banda (hasta 10) o volver a grupo (si son 5 o menos).
  bandaGrupo(s, m) {
    const g = this.grupoDe(s);
    if (!g) return this.no(s, 'Primero forma un grupo: invita a alguien desde su marco.');
    if (g.lider !== s.c.uid) return this.no(s, 'Solo el líder puede convertir el grupo en banda.');
    const si = !!m.si;
    if (!si && g.uids.length > GRUPO_MAX) return this.no(s, `Son más de ${GRUPO_MAX}: no puede volver a ser un grupo.`);
    if (g.banda === si) return;
    const wi = g.inst && this.mundo[g.inst];
    if (wi && wi.inst && !wi.inst.completada && !wi.inst.banda) return this.no(s, 'Tu grupo está en una mazmorra: termínenla o salgan antes de cambiar.');
    g.banda = si;
    this.avisarGrupo(g, si ? `⚔️ El grupo ahora es una BANDA (hasta ${BANDA_MAX}).` : '👥 La banda vuelve a ser un grupo (hasta 5).');
    this.enviarGrupo(g);
  },
  liderGrupo(s, m) {
    const g = this.grupoDe(s);
    const uid = g && g.uids.find(u => pub(u) === m.uid);
    if (!g || g.lider !== s.c.uid || !uid || uid === s.c.uid) return;
    g.lider = uid;
    const l = this.porUid.get(uid);
    this.avisarGrupo(g, `👑 ${l ? l.c.nombre : 'Otro miembro'} es el nuevo líder del grupo.`);
    this.enviarGrupo(g);
  },

  // Al entrar: si el uid sigue en un grupo, vuelve a el.
  reengancharGrupo(s) {
    this.iniciarSocial();
    for (const g of this.grupos.values()) {
      if (!g.uids.includes(s.c.uid)) continue;
      s.gid = g.id;
      this.avisarGrupo(g, `👥 ${s.c.nombre} volvió.`, s);
      this.enviarGrupo(g);
      return;
    }
  },
  // Al salir: el grupo lo espera; si ya no queda nadie conectado, se borra.
  desconectarDeGrupo(s) {
    if (this.lfg) this.lfg.delete(s.c.uid);   // su busqueda de grupo, fuera
    const g = this.grupoDe(s);
    if (!g) return;
    if (!this.sesionesGrupo(g).some(x => x !== s)) { this.grupos.delete(g.id); if (this.alDisolverGrupo) this.alDisolverGrupo(g); return; }
    this.enviarGrupo(g, s);
  },

  infoMiembro(uid, excepto) {
    const x = this.porUid.get(uid);
    if (!x || !x.c || x === excepto) return { uid: pub(uid), on: 0 };
    return {
      uid: pub(uid), on: 1, id: x.id, n: x.c.nombre, lv: x.c.nivel, cl: x.c.clase || '', sk: x.c.skin,
      hp: Math.ceil(x.hp), mx: x.st.maxHp, rec: Math.round(x.rec || 0), rmx: x.st.recMax, mapa: x.c.mapa, k: x.k, muerto: !!x.muerto,
    };
  },
  // Estado del grupo a todos sus miembros (vida y mana de los que estan en
  // otro mapa no llegan por la foto del mapa: van aqui).
  enviarGrupo(g, excepto) {
    const info = { id: g.id, lider: pub(g.lider), banda: g.banda ? 1 : 0, m: g.uids.map(u => this.infoMiembro(u, excepto)) };
    const nombres = g.nombres || (g.nombres = {});
    for (const x of info.m) if (x.n) nombres[x.uid] = x.n; else x.n = nombres[x.uid] || '?';
    const txt = JSON.stringify({ t: 'grupo', g: info });
    for (const x of this.sesionesGrupo(g)) if (x !== excepto) this.enviar(x, txt);
  },
  avisarGrupo(g, txt, excepto) {
    for (const x of this.sesionesGrupo(g)) if (x !== excepto) this.enviar(x, { t: 'chat', canal: 'grupo', sis: 1, m: txt });
  },
  tickGrupos(ahora) {
    this.iniciarSocial();
    if (ahora - (this.grupoT || 0) < 500) return;
    this.grupoT = ahora;
    for (const g of this.grupos.values()) if (this.sesionesGrupo(g).length) this.enviarGrupo(g);
  },

  // ── CHAT ──
  chat(s, m) {
    const ahora = Date.now();
    if (ahora - s.chatT < 900) return;
    const txt = limpiar(m.m);
    if (!txt) return;
    const mudo = this.silenciado ? this.silenciado(s) : 0;
    if (mudo) return this.no(s, `🔇 Estás silenciado por un moderador ${Math.ceil((mudo - ahora) / 60000)} min más.`);
    s.chatT = ahora;
    const base = { t: 'chat', p: s.id, n: s.c.nombre, m: txt, mapa: s.c.mapa, cl: s.c.clase || '', gm: s.dios ? 1 : undefined };
    const canal = m.canal;
    if (canal === 'decir') {
      // Solo los que estan en el mismo mapa (o la misma mazmorra).
      return this.aClave(s.k, { ...base, canal: 'decir' });
    }
    if (canal === 'grupo') {
      const g = this.grupoDe(s);
      if (!g) return this.no(s, 'No estás en un grupo.');
      const txtG = JSON.stringify({ ...base, canal: 'grupo' });
      for (const x of this.sesionesGrupo(g)) this.enviar(x, txtG);
      return;
    }
    if (canal === 'hermandad') {
      if (!this.chatHermandad) return this.no(s, 'No estás en una hermandad.');
      return this.chatHermandad(s, base);
    }
    if (canal === 'susurro') {
      const a = limpiar(m.a).toLowerCase();
      const t = [...this.sesiones.values()].find(x => x.c && x.c.nombre.toLowerCase() === a);
      if (!t) return this.no(s, `No hay nadie conectado llamado "${limpiar(m.a)}".`);
      if (t === s) return;
      this.enviar(t, { ...base, canal: 'susurro', de: s.c.nombre });
      this.enviar(s, { ...base, canal: 'susurro', a: t.c.nombre });
      return;
    }
    // General: todo el servidor. Las burbujas solo se ven en el mismo mapa.
    this.aTodos({ ...base, canal: 'general' });
  },

  // ── BUSCAR GRUPO ──
  buscarGrupo(s, m) {
    this.iniciarSocial();
    this.lfg = this.lfg || new Map();   // uid -> { id de mazmorra, t, hasta }
    const mz = typeof m.id === 'string' && Object.hasOwn(MAZMORRAS, m.id) ? MAZMORRAS[m.id] : null;
    if (!mz) return;
    if (s.c.nivel < mz.nv[0]) return this.no(s, `Necesitas nivel ${mz.nv[0]} para ${mz.nombre}.`);
    const g = this.grupoDe(s);
    if (g && g.lider !== s.c.uid) return this.no(s, 'Solo el líder del grupo puede buscar más gente.');
    if (g && !mz.banda && g.uids.length > GRUPO_MAX) return this.no(s, `Las mazmorras son para ${GRUPO_MAX}: tu banda solo puede buscar gente para la banda.`);
    const wi = g && g.inst && this.mundo[g.inst];
    if (g && mz.banda && !g.banda && wi && wi.inst && !wi.inst.completada) return this.no(s, 'Tu grupo está en una mazmorra: termínenla antes de buscar gente para la banda.');
    if (g && g.uids.length >= (mz.banda ? BANDA_MAX : maxGrupo(g))) return this.no(s, 'Tu grupo ya está lleno.');
    const ahora = Date.now();
    // El limite va aparte: quitar la busqueda no lo reinicia (si no, anunciar
    // y quitar en bucle inundaba de avisos a todos los conectados).
    this.lfgT = this.lfgT || new Map();
    if (ahora - (this.lfgT.get(s.c.uid) || 0) < LFG_CADA_MS) return this.no(s, 'Ya anunciaste tu búsqueda hace nada: espera un minuto.');
    for (const [u, t] of this.lfgT) if (ahora - t >= LFG_CADA_MS) this.lfgT.delete(u);
    this.lfgT.set(s.c.uid, ahora);
    if (g && mz.banda && !g.banda) { g.banda = true; this.avisarGrupo(g, `⚔️ El grupo ahora es una BANDA (hasta ${BANDA_MAX}).`); this.enviarGrupo(g); }
    const e = { id: m.id, t: ahora, hasta: ahora + LFG_MS };
    this.lfg.set(s.c.uid, e);
    const aviso = JSON.stringify({ t: 'lfgAviso', ...this.infoLfg(s.c.uid, e) });
    let n = 0;
    // No a quien esta en una mazmorra, el Coliseo, un duelo o peleando (el
    // aviso salia en mitad de un jefe): la busqueda queda en la lista igual.
    for (const x of this.sesiones.values()) {
      if (!x.c || x === s || x.gid || x.c.nivel < mz.nv[0]) continue;
      if (x.k.includes('#') || x.k === 'coliseo' || x.duelo || ahora - (x.combateT || 0) < 8000) continue;
      this.enviar(x, aviso); n++;
    }
    this.enviar(s, { t: 'toast', ok: true, m: `📢 Buscas grupo para ${mz.nombre} (10 min). ` + (n ? `Se avisó a ${n} jugador${n > 1 ? 'es' : ''} con nivel.` : 'Ahora no hay nadie libre con nivel: queda en la lista del portal de mazmorras.') });
    this.lfgLista(s);
  },
  infoLfg(uid, e) {
    const x = this.porUid.get(uid);
    const g = x && this.grupoDe(x);
    return { pid: pub(uid), n: x.c.nombre, nv: x.c.nivel, cl: x.c.clase || '', id: e.id, m: g ? g.uids.length : 1, mx: MAZMORRAS[e.id] && MAZMORRAS[e.id].banda ? BANDA_MAX : GRUPO_MAX };
  },
  // Las busquedas que siguen en pie (se borran las caducadas, las de quien
  // se fue y las de grupos llenos o que ya no lleva esa persona).
  lfgVigentes() {
    const ahora = Date.now(), r = [];
    for (const [uid, e] of this.lfg || []) {
      const x = this.porUid.get(uid);
      const g = x && this.grupoDe(x);
      if (!x || !x.c || e.hasta < ahora || (g && (g.lider !== uid || g.uids.length >= maxGrupo(g)))) { this.lfg.delete(uid); continue; }
      r.push([uid, e]);
    }
    return r;
  },
  lfgLista(s) { this.enviar(s, { t: 'lfg', l: this.lfgVigentes().map(([u, e]) => ({ ...this.infoLfg(u, e), yo: u === s.c.uid ? 1 : 0 })) }); },
  quitarLfg(s) {
    if (this.lfg && this.lfg.delete(s.c.uid)) this.enviar(s, { t: 'toast', m: 'Dejaste de buscar grupo.' });
    this.lfgLista(s);
  },
  unirseLfg(s, m) {
    this.iniciarSocial();
    const par = this.lfgVigentes().find(([u]) => pub(u) === m.pid);
    if (!par) return this.no(s, 'Esa búsqueda ya terminó (o el grupo se llenó).');
    const [uid, e] = par;
    const lider = this.porUid.get(uid);
    if (lider === s) return;
    const mz = MAZMORRAS[e.id];
    if (s.gid) return this.no(s, 'Ya estás en un grupo: sal de él para unirte a otro.');
    if (s.c.nivel < mz.nv[0]) return this.no(s, `Necesitas nivel ${mz.nv[0]} para ${mz.nombre}.`);
    let g = this.grupoDe(lider);
    // Dentro de un Desafio abierto solo se entra por invitacion (la lider
    // acepta a quien quiere: el premio del Desafio es grande).
    const wi = g && g.inst && this.mundo[g.inst];
    if (wi && wi.inst && wi.inst.k && !wi.inst.completada) return this.no(s, 'Ese grupo ya está dentro de un Desafío: pide al líder que te invite.');
    if (!g) {
      g = { id: this.sigGrupo++, lider: uid, uids: [uid], banda: !!mz.banda };
      this.grupos.set(g.id, g);
      lider.gid = g.id;
    }
    if (g.uids.length >= Math.min(maxGrupo(g), mz.banda ? BANDA_MAX : GRUPO_MAX)) return this.no(s, 'Ese grupo ya está lleno.');
    g.uids.push(s.c.uid);
    s.gid = g.id;
    s.invitacion = null;
    this.avisarGrupo(g, `👥 ${s.c.nombre} se unió al grupo desde el buscador (${mz.nombre}).`);
    this.enviarGrupo(g);
    this.enviar(lider, { t: 'toast', ok: true, m: `📢 ${s.c.nombre} (Nv ${s.c.nivel}) se unió a tu grupo para ${mz.nombre}.` });
    this.enviar(s, { t: 'toast', ok: true, m: `👥 Te uniste al grupo de ${lider.c.nombre} para ${mz.nombre}. Vayan juntos al portal de mazmorras del pueblo.` });
    if (g.uids.length >= maxGrupo(g)) this.lfg.delete(uid);
  },

  // ── AMIGOS (lista de contactos, como en WoW) ──
  // c.contactos = [{ u: uid, n: ultimo nombre conocido }]. Al cliente solo le
  // llega pub(uid). Avisa cuando un amigo se conecta.
  agregarContacto(s, m) {
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c || t === s) return;
    const l = s.c.contactos || (s.c.contactos = []);
    if (l.some(a => a.u === t.c.uid)) return this.no(s, `${t.c.nombre} ya está en tu lista de amigos.`);
    if (l.length >= CONTACTOS_MAX) return this.no(s, `Tu lista de amigos está llena (${CONTACTOS_MAX}).`);
    l.push({ u: t.c.uid, n: t.c.nombre });
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `⭐ ${t.c.nombre} está en tu lista de amigos: verás cuándo se conecta.` });
    // Una vez por persona y sesion: añadir y quitar en bucle inundaba de avisos.
    t.avisosAmigo = t.avisosAmigo || new Set();
    if (!t.avisosAmigo.has(s.c.uid)) { t.avisosAmigo.add(s.c.uid); this.enviar(t, { t: 'toast', m: `⭐ ${s.c.nombre} te añadió a su lista de amigos.` }); }
    this.enviarContactos(s);
  },
  // Un invitado que pasa a cuenta cambia de uid: en las listas de los
  // conectados se cambia el viejo por el nuevo (los que no estan conectados
  // lo veran "desconectado" hasta que lo quiten y lo vuelvan a añadir).
  renombrarContacto(viejo, nuevo) {
    for (const x of this.sesiones.values()) {
      for (const a of (x.c && x.c.contactos) || []) if (a.u === viejo) { a.u = nuevo; x.sucio = true; }
    }
  },
  quitarContacto(s, m) {
    const l = s.c.contactos || [];
    const i = l.findIndex(a => pub(a.u) === m.uid);
    if (i < 0) return;
    l.splice(i, 1);
    s.sucio = true;
    this.enviarContactos(s);
  },
  enviarContactos(s) {
    const l = (s.c.contactos || []).map(a => {
      const x = this.porUid.get(a.u);
      const on = !!(x && x.c && !x.cerrado);
      if (on) a.n = x.c.nombre;
      return { uid: pub(a.u), n: a.n, on: on ? 1 : 0, id: on ? x.id : 0, lv: on ? x.c.nivel : 0, cl: on ? x.c.clase || '' : '', mapa: on && MAPAS[x.c.mapa] ? MAPAS[x.c.mapa].nombre : '', g: on && x.gid ? 1 : 0 };
    }).sort((a, b) => b.on - a.on || a.n.localeCompare(b.n));
    this.enviar(s, { t: 'contactos', l });
  },
  // Al entrar: avisa a quien lo tiene de amigo y esta conectado (solo si
  // llevaba 5+ min fuera: el movil se reconecta a menudo al volver de
  // segundo plano y el aviso se repetia).
  avisarContactos(s, salidaAntes) {
    if (salidaAntes && Date.now() - salidaAntes < 5 * 60000) return;
    for (const x of this.sesiones.values()) {
      if (x === s || !x.c || !(x.c.contactos || []).some(a => a.u === s.c.uid)) continue;
      this.enviar(x, { t: 'toast', m: `👋 Tu amigo ${s.c.nombre} se conectó.` });
    }
  },

  // ── GESTOS ──
  gesto(s, m) {
    const ahora = Date.now();
    if (typeof m.id !== 'string' || !Object.hasOwn(GESTOS, m.id) || ahora - (s.gestoT || 0) < 1500) return;
    s.gestoT = ahora;
    this.aClave(s.k, { t: 'gesto', p: s.id, id: m.id });
  },

  // ── INSPECCIONAR (como en WoW) ──
  // El equipo puesto y lo que se puede presumir de otro jugador conectado.
  // Nada privado: ni uid, ni oro, ni mTON, ni bolsa.
  inspeccionar(s, m) {
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c) return this.no(s, 'Ese jugador ya no está conectado.');
    const c = t.c;
    this.enviar(s, { t: 'inspeccion', p: t.id, n: c.nombre, lv: c.nivel, cl: c.clase || '', es: c.espec || '', ti: this.textoTitulo ? this.textoTitulo(c) : '',
      eq: c.eq || {}, logros: (c.logros || []).length, mazmorras: c.mazmorras || 0, desafioMax: c.desafioMax || 0, duelos: c.duelosG || 0,
      runas: c.runas || {}, titanes: c.titanes || 0, pionero: c.pionero ? 1 : 0, torreMax: c.torreMax || 0, peces: c.peces || 0,
      herm: this.nombreHermandad ? this.nombreHermandad(c.herm) : '' });
  },

  // Lista de quien esta conectado (para invitar o susurrar).
  quien(s) {
    if (Date.now() - (s.quienT || 0) < 2000) return;   // recorre a todos: con limite
    s.quienT = Date.now();
    const r = [];
    for (const x of this.sesiones.values()) {
      if (!x.c || x === s) continue;
      r.push({ id: x.id, n: x.c.nombre, lv: x.c.nivel, cl: x.c.clase || '', mapa: MAPAS[x.c.mapa] ? MAPAS[x.c.mapa].nombre : '', g: x.gid ? 1 : 0, h: x.c.herm ? (this.nombreHermandad ? this.nombreHermandad(x.c.herm) : '') : '' });
      if (r.length >= 100) break;
    }
    r.sort((a, b) => b.lv - a.lv);
    this.enviar(s, { t: 'quien', r });
  },
};
