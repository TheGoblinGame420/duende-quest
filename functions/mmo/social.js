// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — grupos y chat (al estilo WoW)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Grupos de hasta 5: se invita desde el marco del objetivo o desde la lista
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
import { MAPAS, MAZMORRAS } from '../../mmo/js/data.js';

export const GRUPO_MAX = 5;
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
    if (g && g.uids.length >= GRUPO_MAX) return this.no(s, `El grupo ya está lleno (${GRUPO_MAX}).`);
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
    if (g.uids.length >= GRUPO_MAX) return this.no(s, 'El grupo ya está lleno.');
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
    else { g.uids = g.uids.filter(u => u !== uid); this.avisarGrupo(g, '👥 Un miembro desconectado fue expulsado del grupo.'); this.ordenarGrupo(g); }
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
    const info = { id: g.id, lider: pub(g.lider), m: g.uids.map(u => this.infoMiembro(u, excepto)) };
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
    s.chatT = ahora;
    const base = { t: 'chat', p: s.id, n: s.c.nombre, m: txt, mapa: s.c.mapa, cl: s.c.clase || '' };
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
    if (g && g.uids.length >= GRUPO_MAX) return this.no(s, 'Tu grupo ya está lleno.');
    const ahora = Date.now();
    const prev = this.lfg.get(s.c.uid);
    if (prev && ahora - prev.t < LFG_CADA_MS) return this.no(s, 'Ya anunciaste tu búsqueda hace nada: espera un minuto.');
    const e = { id: m.id, t: ahora, hasta: ahora + LFG_MS };
    this.lfg.set(s.c.uid, e);
    const aviso = JSON.stringify({ t: 'lfgAviso', ...this.infoLfg(s.c.uid, e) });
    let n = 0;
    for (const x of this.sesiones.values()) if (x.c && x !== s && !x.gid && x.c.nivel >= mz.nv[0]) { this.enviar(x, aviso); n++; }
    this.enviar(s, { t: 'toast', ok: true, m: `📢 Buscas grupo para ${mz.nombre} (10 min). ` + (n ? `Se avisó a ${n} jugador${n > 1 ? 'es' : ''} con nivel.` : 'Ahora no hay nadie más conectado con nivel: queda en la lista del portal de mazmorras.') });
    this.lfgLista(s);
  },
  infoLfg(uid, e) {
    const x = this.porUid.get(uid);
    const g = x && this.grupoDe(x);
    return { pid: pub(uid), n: x.c.nombre, nv: x.c.nivel, cl: x.c.clase || '', id: e.id, m: g ? g.uids.length : 1 };
  },
  // Las busquedas que siguen en pie (se borran las caducadas, las de quien
  // se fue y las de grupos llenos o que ya no lleva esa persona).
  lfgVigentes() {
    const ahora = Date.now(), r = [];
    for (const [uid, e] of this.lfg || []) {
      const x = this.porUid.get(uid);
      const g = x && this.grupoDe(x);
      if (!x || !x.c || e.hasta < ahora || (g && (g.lider !== uid || g.uids.length >= GRUPO_MAX))) { this.lfg.delete(uid); continue; }
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
    if (!g) {
      g = { id: this.sigGrupo++, lider: uid, uids: [uid] };
      this.grupos.set(g.id, g);
      lider.gid = g.id;
    }
    g.uids.push(s.c.uid);
    s.gid = g.id;
    s.invitacion = null;
    this.avisarGrupo(g, `👥 ${s.c.nombre} se unió al grupo desde el buscador (${mz.nombre}).`);
    this.enviarGrupo(g);
    this.enviar(lider, { t: 'toast', ok: true, m: `📢 ${s.c.nombre} (Nv ${s.c.nivel}) se unió a tu grupo para ${mz.nombre}.` });
    this.enviar(s, { t: 'toast', ok: true, m: `👥 Te uniste al grupo de ${lider.c.nombre} para ${mz.nombre}. Id juntos al portal de mazmorras del pueblo.` });
    if (g.uids.length >= GRUPO_MAX) this.lfg.delete(uid);
  },

  // Lista de quien esta conectado (para invitar o susurrar).
  quien(s) {
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
