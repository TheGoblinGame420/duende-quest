// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — hermandades (las "guilds" de WoW)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Se guardan en el almacenamiento del Durable Object:
//   h:<id>    → { id, nombre, motd, creada, miembros: { uid: { n, lv, cl, r, desde } } }
//   hn:<min>  → id   (para que no haya dos con el mismo nombre)
// El personaje lleva su hermandad en c.herm. Rangos: 'lider', 'oficial',
// 'miembro'. Crear una cuesta oro (sale del juego, no de dinero real).
// ═══════════════════════════════════════════════════════
import { HERM_COSTO, HERM_NIVEL, HERM_MAX, HERM_COLORES, GESTA_UMBRALES, GESTA_NOMBRES, GESTA_PUNTOS, GESTA_MIN, GESTA_ANTIG_MS, premioGesta, semanaUTC } from '../../mmo/js/data.js';
import { pub } from './social.js';

const INV_MS = 60000;
// Letras, numeros y espacios; 3-20 caracteres.
export function limpiarNombreHerm(s) {
  const n = String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return n.length >= 3 ? n : '';
}

export const Hermandades = {
  // Cache en memoria; si no esta, se lee del almacenamiento.
  async hermandad(id) {
    if (!id) return null;
    this.herms = this.herms || new Map();
    if (this.herms.has(id)) return this.herms.get(id);
    const h = (await this.state.storage.get('h:' + id)) || null;
    if (h) this.herms.set(id, h);
    return h;
  },
  nombreHermandad(id) { const h = this.herms && this.herms.get(id); return h ? h.nombre : ''; },
  colorHermandad(id) { const h = this.herms && this.herms.get(id); return h ? h.color | 0 : 0; },
  async guardarHerm(h) { await this.state.storage.put('h:' + h.id, h); },
  rangoEn(h, uid) { return h && h.miembros[uid] ? h.miembros[uid].r : null; },
  conectadosHerm(h) { return Object.keys(h.miembros).map(u => this.porUid.get(u)).filter(x => x && x.c && !x.cerrado); },

  // Al entrar: su hermandad se carga y su ficha se actualiza (nivel/clase).
  async cargarHermandadDe(s) {
    const c = s.c;
    if (!c.herm) return;
    const h = await this.hermandad(c.herm);
    if (!h || !h.miembros[c.uid]) { c.herm = null; s.sucio = true; return; }
    const m = h.miembros[c.uid];
    if (m.lv !== c.nivel || m.cl !== (c.clase || '') || m.n !== c.nombre) { m.lv = c.nivel; m.cl = c.clase || ''; m.n = c.nombre; this.guardarHerm(h); }
    this.enviar(s, { t: 'herm', h: this.infoHerm(h) });
    if (h.motd) this.enviar(s, { t: 'chat', canal: 'hermandad', sis: 1, m: `📜 Mensaje del día de <${h.nombre}>: ${h.motd}` });
    this.avisarHerm(h, `🛡️ ${c.nombre} se conectó.`, s);
    this.cobrarGesta(s, h);
  },

  infoHerm(h) {
    const G = this.gestaDe(h);
    const gc = {};
    for (const u in G.c) if (h.miembros[u]) gc[pub(u)] = G.c[u];
    return {
      id: h.id, nombre: h.nombre, motd: h.motd || '', color: h.color | 0, creada: h.creada, gesta: { p: G.p, c: gc },
      m: Object.entries(h.miembros).map(([uid, m]) => ({ uid: pub(uid), n: m.n, lv: m.lv, cl: m.cl, r: m.r, on: this.porUid.has(uid) ? 1 : 0 }))
        .sort((a, b) => b.on - a.on || ({ lider: 0, oficial: 1, miembro: 2 }[a.r] - { lider: 0, oficial: 1, miembro: 2 }[b.r]) || b.lv - a.lv),
    };
  },
  enviarHerm(h) {
    const txt = JSON.stringify({ t: 'herm', h: this.infoHerm(h) });
    for (const x of this.conectadosHerm(h)) this.enviar(x, txt);
  },
  avisarHerm(h, txt, excepto) {
    for (const x of this.conectadosHerm(h)) if (x !== excepto) this.enviar(x, { t: 'chat', canal: 'hermandad', sis: 1, m: txt });
  },
  // El nombre de la hermandad sale bajo el del personaje: se avisa al mapa.
  refrescarApariencia(s) { this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) }); },

  async crearHermandad(s, m) {
    const c = s.c;
    if (c.herm) return this.no(s, 'Ya estás en una hermandad.');
    if (c.nivel < HERM_NIVEL) return this.no(s, `Necesitas nivel ${HERM_NIVEL} para fundar una hermandad.`);
    if (c.oro < HERM_COSTO) return this.no(s, `Fundar una hermandad cuesta ${HERM_COSTO.toLocaleString('es', { useGrouping: 'always' })} oro.`);
    const nombre = limpiarNombreHerm(m.nombre);
    if (!nombre) return this.no(s, 'El nombre debe tener de 3 a 20 letras o números.');
    const clave = 'hn:' + nombre.toLowerCase();
    if (await this.state.storage.get(clave)) return this.no(s, 'Ya existe una hermandad con ese nombre.');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const h = { id, nombre, motd: '', creada: Date.now(), miembros: { [c.uid]: { n: c.nombre, lv: c.nivel, cl: c.clase || '', r: 'lider', desde: Date.now() } } };
    await this.state.storage.put(clave, id);
    await this.guardarHerm(h);
    this.herms = this.herms || new Map();
    this.herms.set(id, h);
    c.oro -= HERM_COSTO;
    c.herm = id;
    await this.guardar(s);
    this.enviar(s, { t: 'herm', h: this.infoHerm(h) });
    this.enviar(s, { t: 'toast', m: `🛡️ ¡Fundaste la hermandad <${nombre}>! Invita a otros desde su marco o desde 👥.`, ok: true });
    this.refrescarApariencia(s);
    this.actualizarYo(s);
    this.revisarLogros(s);
  },

  async invitarHerm(s, m) {
    const h = await this.hermandad(s.c.herm);
    const r = this.rangoEn(h, s.c.uid);
    if (!h || !r) return this.no(s, 'No estás en una hermandad.');
    if (r === 'miembro') return this.no(s, 'Solo el líder y los oficiales pueden invitar.');
    if (Object.keys(h.miembros).length >= HERM_MAX) return this.no(s, `La hermandad ya tiene ${HERM_MAX} miembros.`);
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c || t === s) return;
    if (t.c.herm) return this.no(s, `${t.c.nombre} ya está en una hermandad.`);
    t.invHerm = { id: h.id, de: s.c.nombre, hasta: Date.now() + INV_MS };
    this.enviar(t, { t: 'hermInv', nombre: h.nombre, de: s.c.nombre, ms: INV_MS });
    this.enviar(s, { t: 'toast', m: `📨 Invitaste a ${t.c.nombre} a <${h.nombre}>.` });
  },

  async respuestaHerm(s, m) {
    const inv = s.invHerm;
    s.invHerm = null;
    if (!m.si || !inv || inv.hasta < Date.now()) return;
    if (s.c.herm) return this.no(s, 'Ya estás en una hermandad.');
    const h = await this.hermandad(inv.id);
    if (!h) return this.no(s, 'Esa hermandad ya no existe.');
    if (Object.keys(h.miembros).length >= HERM_MAX) return this.no(s, 'La hermandad está llena.');
    const c = s.c;
    h.miembros[c.uid] = { n: c.nombre, lv: c.nivel, cl: c.clase || '', r: 'miembro', desde: Date.now() };
    c.herm = h.id;
    await this.guardarHerm(h);
    await this.guardar(s);
    this.avisarHerm(h, `🛡️ ¡${c.nombre} se unió a la hermandad!`);
    this.enviarHerm(h);
    this.refrescarApariencia(s);
    this.actualizarYo(s);
    this.revisarLogros(s);
  },

  // Quitar a un miembro (por irse o por expulsion). Si se va el lider, el
  // mando pasa al oficial (o miembro) mas antiguo; si no queda nadie, se
  // disuelve y el nombre queda libre.
  async quitarDeHerm(h, uid, motivo) {
    const m = h.miembros[uid];
    if (!m) return;
    delete h.miembros[uid];
    const t = this.porUid.get(uid);
    if (t) { t.c.herm = null; t.sucio = true; this.enviar(t, { t: 'herm', h: null }); this.refrescarApariencia(t); this.actualizarYo(t); }
    else {
      const c = await this.state.storage.get('c:' + uid);
      if (c && c.herm === h.id) { c.herm = null; await this.state.storage.put('c:' + uid, c); }
    }
    const quedan = Object.entries(h.miembros);
    if (!quedan.length) {
      if (this.hermSucias) this.hermSucias.delete(h);
      await this.state.storage.delete('h:' + h.id);
      await this.state.storage.delete('hn:' + h.nombre.toLowerCase());
      this.herms.delete(h.id);
      this.cargarRankHerm().then(rh => { if (!rh.l[h.id]) return; delete rh.l[h.id]; return this.state.storage.put('rankHerm', rh); }).catch(e => console.error('[MMO rankHerm]', e));
      return;
    }
    if (m.r === 'lider') {
      const nuevo = quedan.sort((a, b) => (a[1].r === 'oficial' ? 0 : 1) - (b[1].r === 'oficial' ? 0 : 1) || a[1].desde - b[1].desde)[0];
      nuevo[1].r = 'lider';
      this.avisarHerm(h, `👑 ${nuevo[1].n} es ahora el líder de la hermandad.`);
    }
    await this.guardarHerm(h);
    this.avisarHerm(h, motivo === 'expulsado' ? `🛡️ ${m.n} fue expulsado de la hermandad.` : `🛡️ ${m.n} dejó la hermandad.`);
    this.enviarHerm(h);
  },

  async salirHerm(s) {
    const h = await this.hermandad(s.c.herm);
    if (!h) return;
    await this.quitarDeHerm(h, s.c.uid, 'salio');
    this.enviar(s, { t: 'toast', m: '🛡️ Dejaste la hermandad.' });
  },

  // Los clientes solo conocen el id publico de cada miembro.
  uidDePub(h, p) { return h ? Object.keys(h.miembros).find(u => pub(u) === p) : null; },

  async expulsarHerm(s, m) {
    const h = await this.hermandad(s.c.herm);
    const r = this.rangoEn(h, s.c.uid);
    const uid = this.uidDePub(h, m.uid);
    if (!h || !uid || uid === s.c.uid) return;
    const rt = h.miembros[uid].r;
    if (r === 'miembro' || rt === 'lider' || (r === 'oficial' && rt === 'oficial')) return this.no(s, 'No tienes rango para expulsar a ese miembro.');
    await this.quitarDeHerm(h, uid, 'expulsado');
  },

  async rangoHerm(s, m) {
    const h = await this.hermandad(s.c.herm);
    const uid = this.uidDePub(h, m.uid);
    if (!h || this.rangoEn(h, s.c.uid) !== 'lider' || !uid || uid === s.c.uid) return;
    if (m.r === 'lider') {
      h.miembros[s.c.uid].r = 'oficial';
      h.miembros[uid].r = 'lider';
      this.avisarHerm(h, `👑 ${h.miembros[uid].n} es ahora el líder de la hermandad.`);
    } else if (m.r === 'oficial' || m.r === 'miembro') {
      h.miembros[uid].r = m.r;
      this.avisarHerm(h, `🛡️ ${h.miembros[uid].n} ahora es ${m.r}.`);
    } else return;
    await this.guardarHerm(h);
    this.enviarHerm(h);
  },

  // Color de la hermandad (solo el lider). Se ve al momento en todos.
  async colorHerm(s, m) {
    const h = await this.hermandad(s.c.herm);
    if (!h || this.rangoEn(h, s.c.uid) !== 'lider') return;
    const i = m.i | 0;
    if (i < 0 || i >= HERM_COLORES.length || i === (h.color | 0)) return;
    h.color = i;
    await this.guardarHerm(h);
    this.enviarHerm(h);
    for (const x of this.conectadosHerm(h)) this.aClave(x.k, { t: 'pa', ...this.infoApariencia(x) });
  },
  async motdHerm(s, m) {
    const h = await this.hermandad(s.c.herm);
    const r = this.rangoEn(h, s.c.uid);
    if (!h || !r || r === 'miembro') return;
    h.motd = String(m.m || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 140);
    await this.guardarHerm(h);
    this.avisarHerm(h, `📜 Nuevo mensaje del día: ${h.motd || '(vacío)'}`);
    this.enviarHerm(h);
  },

  async verHerm(s) {
    const h = await this.hermandad(s.c.herm);
    this.enviar(s, { t: 'herm', h: h ? this.infoHerm(h) : null });
  },

  chatHermandad(s, base) {
    const h = this.herms && this.herms.get(s.c.herm);
    if (!h) return this.no(s, 'No estás en una hermandad.');
    const txt = JSON.stringify({ ...base, canal: 'hermandad' });
    for (const x of this.conectadosHerm(h)) this.enviar(x, txt);
  },

  // ── GESTA SEMANAL ──
  // h.gesta = { sem, p: puntos de todos, c: { uid: puntos propios } }. Vive
  // en memoria y se guarda cada 30 s (guardarHermsSucias) o al pasar un
  // nivel. c.gestaCob = { sem, n }: niveles ya cobrados esa semana.
  gestaDe(h) {
    const sem = semanaUTC();
    if (!h.gesta || h.gesta.sem !== sem) h.gesta = { sem, p: 0, c: {} };
    return h.gesta;
  },
  puntoGesta(s, tipo) {
    const id = s.c.herm;
    const h = id && this.herms && this.herms.get(id);
    if (!h || !h.miembros[s.c.uid]) return;
    const G = this.gestaDe(h);
    const pts = GESTA_PUNTOS[tipo] || 0;
    if (!pts) return;
    const antes = G.p, mioAntes = G.c[s.c.uid] || 0;
    G.p += pts;
    G.c[s.c.uid] = mioAntes + pts;
    (this.hermSucias = this.hermSucias || new Set()).add(h);
    const n0 = GESTA_UMBRALES.filter(u => antes >= u).length, n1 = GESTA_UMBRALES.filter(u => G.p >= u).length;
    if (n1 > n0) {
      this.avisarHerm(h, `🏆 ¡Gesta semanal: ${GESTA_NOMBRES[n1 - 1]} conseguido! Quien aportó ${GESTA_MIN}+ puntos cobra su oro.`);
      for (const x of this.conectadosHerm(h)) this.cobrarGesta(x, h);
      this.guardarHerm(h);
      this.anotarRankHerm([h]);
      this.hermSucias.delete(h);
    } else if (n1 && G.c[s.c.uid] >= GESTA_MIN && (!s.c.gestaCob || s.c.gestaCob.sem !== G.sem || s.c.gestaCob.n < n1)) this.cobrarGesta(s, h);
  },
  // Cobra los niveles de la gesta de esta semana que aun no cobro (si aporto
  // lo minimo). Se mira al pasar un nivel, al llegar al minimo y al entrar.
  cobrarGesta(s, h) {
    const c = s.c;
    if (!h || !h.miembros[c.uid]) return;
    const G = this.gestaDe(h);
    if ((G.c[c.uid] || 0) < GESTA_MIN) return;
    // Hay que llevar un tiempo en la hermandad (si no, entrar a una que ya
    // llego al Oro y aportar 20 puntos cobraba todo). Se cobra mas tarde.
    if (Date.now() - (h.miembros[c.uid].desde || 0) < GESTA_ANTIG_MS) return;
    const n = GESTA_UMBRALES.filter(u => G.p >= u).length;
    if (!c.gestaCob || c.gestaCob.sem !== G.sem) c.gestaCob = { sem: G.sem, n: 0 };
    let oro = 0;
    while (c.gestaCob.n < n) {
      oro += premioGesta(c.gestaCob.n, c.nivel).oro;
      c.gestaCob.n++;
      if (c.gestaCob.n === GESTA_UMBRALES.length) c.gestaOro = (c.gestaOro || 0) + 1;
    }
    if (!oro) return;
    c.oro += oro;
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🏆 Gesta de <${h.nombre}>: +${oro.toLocaleString('es', { useGrouping: 'always' })} oro.` });
    this.revisarLogros(s);
    this.actualizarYo(s);
  },
  guardarHermsSucias(ahora) {
    if (!this.hermSucias || !this.hermSucias.size || ahora - (this.hermGuardT || 0) < 30000) return;
    this.hermGuardT = ahora;
    const vivas = [...this.hermSucias].filter(h => this.herms && this.herms.get(h.id) === h && Object.keys(h.miembros).length);
    for (const h of vivas) this.guardarHerm(h);
    this.hermSucias.clear();
    this.anotarRankHerm(vivas);
  },

  // Ranking semanal de hermandades por puntos de la gesta: 'rankHerm' =
  // { sem, l: { id: { n, p, m } } }. Se pone al dia al guardar las gestas.
  async cargarRankHerm() {
    if (!this.rh) { this.rhP = this.rhP || this.state.storage.get('rankHerm').catch(e => { this.rhP = null; throw e; }); const r = await this.rhP; if (!this.rh) this.rh = r || { sem: semanaUTC(), l: {} }; }
    if (this.rh.sem !== semanaUTC()) this.rh = { sem: semanaUTC(), l: {} };
    return this.rh;
  },
  anotarRankHerm(hs) {
    if (!hs.length) return;
    this.cargarRankHerm().then(rh => {
      for (const h of hs) { const G = this.gestaDe(h); if (G.p > 0) rh.l[h.id] = { n: h.nombre, p: G.p, m: Object.keys(h.miembros).length }; }
      return this.state.storage.put('rankHerm', rh);
    }).catch(e => console.error('[MMO rankHerm]', e));
  },
  async topHerm() {
    const rh = await this.cargarRankHerm();
    return Object.entries(rh.l).sort((a, b) => b[1].p - a[1].p);
  },

  // Nivel nuevo: su ficha en la hermandad se pone al dia.
  hermSubioNivel(s) {
    const h = this.herms && this.herms.get(s.c.herm);
    if (h && h.miembros[s.c.uid]) { h.miembros[s.c.uid].lv = s.c.nivel; this.guardarHerm(h); }
  },
};
