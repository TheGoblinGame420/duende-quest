// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — mazmorras instanciadas (al estilo WoW)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada grupo (o cada jugador solo) entra a su propia copia de la mazmorra:
// un mundo con clave "mapa#id" que solo ven sus jugadores. Packs de
// monstruos agresivos que se avisan entre si, y tres jefes con guion
// (zonas en el suelo que hay que esquivar, hechizos que se pueden
// interrumpir, esbirros, enfurecer, caparazon). Cada jefe abre la barrera
// que guarda; el ultimo completa la mazmorra.
//
// Escala: el nivel de la mazmorra es el del jugador mas alto (dentro del
// tramo de la mazmorra) y la vida de los jefes se ajusta a cuantos hay vivos
// dentro al empezar cada combate. Asi se puede hacer solo o con amigos.
//
// Premios: experiencia, oro y equipo (cada jefe da una pieza a cada uno; el
// ultimo, epica). NUNCA mTON: ese dinero sale de un fondo limitado y sumar
// fuentes nuevas se habla antes con el dueño.
// ═══════════════════════════════════════════════════════
import { MAPAS, MONSTRUOS, MAZMORRAS, escalaMazmorra, premioMazmorraDia, nivelMazmorra, statsMonstruo, SUELO, hoyUTC } from '../../mmo/js/data.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const VACIA_MS = 300000;   // una instancia sin nadie se cierra a los 5 min (en el movil se corta mucho: da tiempo a reconectar)
const MAX_INSTANCIAS = 40;      // en todo el servidor a la vez
const CREAR_POR_HORA = 8;       // instancias nuevas por jugador y hora

export const Mazmorras = {
  cercaDelBuscador(s) {
    const p = MAPAS.pueblo.portales.find(x => x.buscador);
    return s.k === 'pueblo' && p && Math.abs(s.x - p.x) < 140;
  },

  entrarMazmorra(s, m) {
    const id = typeof m.id === 'string' && Object.hasOwn(MAZMORRAS, m.id) ? m.id : null;
    if (!id || s.muerto) return;
    const mz = MAZMORRAS[id];
    if (!this.cercaDelBuscador(s)) return this.no(s, 'Ve al portal de mazmorras del pueblo.');
    if (s.c.nivel < mz.nv[0]) return this.no(s, `Necesitas nivel ${mz.nv[0]} para ${mz.nombre}.`);
    const g = this.grupoDe(s);
    this.instDe = this.instDe || new Map();   // uid -> clave de su instancia (jugando solo)
    // El grupo (o el jugador solo) vuelve a SU instancia si sigue abierta:
    // salir y entrar no crea otra (ni reaparecen los jefes ya vencidos).
    const previa = g ? g.inst : this.instDe.get(s.c.uid);
    const wp = previa && this.mundo[previa] && this.mundo[previa].inst ? this.mundo[previa] : null;
    if (wp && !wp.inst.completada) {
      if (wp.inst.id === id) return this.unirAInstancia(s, wp);
      if (g) return this.no(s, `Tu grupo está en ${MAZMORRAS[wp.inst.id].nombre}: entra a esa o sal del grupo.`);
      if (this.jugadoresEn(previa)) return this.no(s, 'Todavía tienes otra mazmorra abierta.');
      this.cerrarInstancia(previa);
    } else if (wp && wp.inst.completada) {
      if (this.jugadoresEn(previa)) return this.no(s, 'Tu grupo acaba de completarla: esperad a que se cierre (unos segundos).');
      this.cerrarInstancia(previa);
    }
    // Limites: cada instancia son ~20 monstruos en memoria.
    const ahora = Date.now();
    this.creadas = this.creadas || new Map();
    const hechas = (this.creadas.get(s.c.uid) || []).filter(t => ahora - t < 3600000);
    if (hechas.length >= CREAR_POR_HORA) return this.no(s, 'Has abierto muchas mazmorras seguidas: espera un rato.');
    if (Object.values(this.mundo).filter(w => w.inst).length >= MAX_INSTANCIAS) return this.no(s, 'Las mazmorras están llenas ahora mismo: prueba en unos minutos.');
    hechas.push(ahora);
    this.creadas.set(s.c.uid, hechas);
    // Entran juntos los del grupo que estan junto al portal, vivos y con nivel.
    const quienes = g ? this.sesionesGrupo(g).filter(x => !x.muerto && this.cercaDelBuscador(x) && x.c.nivel >= mz.nv[0]) : [];
    if (!quienes.includes(s)) quienes.push(s);
    const nivel = nivelMazmorra(mz, Math.max(...quienes.map(x => x.c.nivel)));
    const w = this.crearInstancia(id, nivel, quienes.length);
    if (g) g.inst = w.clave; else this.instDe.set(s.c.uid, w.clave);
    for (const x of quienes) this.unirAInstancia(x, w);
    if (g) for (const x of this.sesionesGrupo(g)) {
      if (!quienes.includes(x)) this.enviar(x, { t: 'toast', m: `🏰 Tu grupo entró a ${mz.nombre}. Para unirte, entra por el portal de mazmorras del pueblo.` });
    }
  },

  crearInstancia(id, nivel, n) {
    const mz = MAZMORRAS[id];
    this.sigInst = (this.sigInst || 0) + 1;
    const clave = mz.mapa + '#' + this.sigInst.toString(36) + Math.random().toString(36).slice(2, 6);
    const w = this.mundoK(clave);
    w.spawnEn = Infinity;
    w.zonas = [];
    w.inst = { id, nv: nivel, creado: Date.now(), vacioDesde: 0, hechos: 0, completada: false };
    w.muros = mz.jefes.map(j => j.muro);
    const esc = escalaMazmorra(n);
    mz.packs.forEach((pk, ip) => {
      const grupo = clave + ':' + ip;
      pk.k.forEach((k, i) => this.crearMonstruo(clave, k, pk.x + i * 48 - (pk.k.length - 1) * 24,
        { nv: nivel + (i === 0 ? 1 : 0), hpX: esc.vidaPack, atkX: esc.atkPack, agresivo: true, radioAgro: 230, grupo }));
    });
    mz.jefes.forEach((j, i) => {
      const o = this.crearMonstruo(clave, j.k, j.x, { nv: nivel + 2, hpX: esc.vidaJefe, atkX: esc.atkJefe, agresivo: true, radioAgro: 260, mazmorra: true, jefeMaz: i });
      o.final = !!j.final;
      o.atk0 = statsMonstruo(j.k, nivel + 2).atk;
      o.vel0 = o.vel;
      o.sinEmbestida = !(MONSTRUOS[j.k].guion || []).some(g => g.tipo === 'embestida');
    });
    return w;
  },

  unirAInstancia(s, w) {
    const mz = MAZMORRAS[w.inst.id];
    this.entrarMapa(s, mz.mapa, 150, false, w.clave);
    w.inst.vacioDesde = 0;
    this.enviar(s, { t: 'toast', m: `🏰 ${mz.nombre} (Nv ${w.inst.nv}). Aquí los monstruos atacan solos y en grupo: ¡con cuidado!`, ok: true });
  },

  // Al reconectar: si estaba en una mazmorra que sigue abierta (la suya o la
  // de su grupo), vuelve a ella donde estaba en vez de aparecer en el pueblo.
  volverAInstancia(s, mapa, x) {
    const g = this.grupoDe(s);
    const previa = g ? g.inst : this.instDe && this.instDe.get(s.c.uid);
    const w = previa && this.mundo[previa];
    if (!w || !w.inst || w.inst.completada || w.mapa !== mapa) return false;
    this.entrarMapa(s, mapa, x, false, w.clave);
    w.inst.vacioDesde = 0;
    this.enviar(s, { t: 'toast', m: `🏰 Volviste a ${MAZMORRAS[w.inst.id].nombre}.`, ok: true });
    return true;
  },

  jugadoresEn(clave) { for (const x of this.sesiones.values()) if (x.c && x.k === clave) return true; return false; },
  cerrarInstancia(clave) {
    delete this.mundo[clave];
    if (this.grupos) for (const g of this.grupos.values()) if (g.inst === clave) g.inst = null;
    if (this.instDe) for (const [u, k] of this.instDe) if (k === clave) this.instDe.delete(u);
  },

  // Instancias sin nadie dentro: se cierran (antes, si ya estaba completada).
  limpiarInstancias(porClave, ahora) {
    for (const k in this.mundo) {
      const w = this.mundo[k];
      if (!w.inst) continue;
      if (porClave[k] && porClave[k].length) { w.inst.vacioDesde = 0; continue; }
      if (!w.inst.vacioDesde) { w.inst.vacioDesde = ahora; continue; }
      if (ahora - w.inst.vacioDesde > (w.inst.completada ? 5000 : VACIA_MS)) this.cerrarInstancia(k);
    }
  },

  // Un monstruo de pack ve a alguien: todo su pack va por el. Un jefe de
  // mazmorra empieza su combate (y su guion).
  alAgro(o, obj, ahora) {
    const w = this.mundoK(o.cl);
    if (o.grupo) for (const x of w.mons.values()) if (x !== o && x.grupo === o.grupo && !x.muere && !x.amen.size) x.amen.set(obj.id, 1);
    if (o.mazmorra && o.jefe && !o.combateDesde) this.empezarJefe(o, w, ahora);
  },
  // Lo mismo si el primer contacto es un golpe (un mago desde lejos).
  alPegar(o, s) { if (s && (o.grupo || (o.mazmorra && !o.combateDesde))) this.alAgro(o, s, Date.now()); },

  empezarJefe(o, w, ahora) {
    const n = [...this.sesiones.values()].filter(s => s.c && s.k === o.cl && !s.muerto).length || 1;
    const esc = escalaMazmorra(n);
    const pct = o.hp / o.max;
    o.max = Math.round(statsMonstruo(o.k, o.nv).hp * esc.vidaJefe);
    o.hp = Math.max(1, Math.round(o.max * pct));
    o.atk = Math.round(o.atk0 * esc.atkJefe);
    o.combateDesde = ahora;
    o.gs = {};
    this.aClave(o.cl, { t: 'mmx', id: o.id, mx: o.max, hp: Math.ceil(o.hp) });
    this.aClave(o.cl, { t: 'emote', m: `⚔️ ¡${MONSTRUOS[o.k].nombre} se lanza al combate!` });
  },

  tickMazmorra(w, jugadores, ahora) {
    // Zonas: al terminar el aviso, golpean a quien siga dentro.
    w.zonas = w.zonas.filter(z => {
      if (!z.hecho && ahora >= z.act) {
        z.hecho = true;
        for (const s of jugadores) {
          if (!s.muerto && s.x >= z.x0 - 8 && s.x <= z.x1 + 8 && s.y > SUELO - 150) this.herir(s, 0, { id: z.de, jefe: true, pct: z.dano, zona: true });
        }
      }
      return ahora < z.fin;
    });
    for (const o of [...w.mons.values()]) if (!o.muere && o.jefe && o.mazmorra && o.combateDesde) this.guionJefe(o, w, jugadores, ahora);
  },

  guionJefe(o, w, jugadores, ahora) {
    const def = MONSTRUOS[o.k];
    // Si no queda nadie vivo en su sala, se recupera y todo vuelve a empezar
    // (el "wipe" de WoW: se revive en la entrada y se intenta otra vez).
    if (!jugadores.some(s => !s.muerto && Math.abs(s.x - o.casaX) < 1300)) {
      if (!o.soloDesde) o.soloDesde = ahora;
      else if (ahora - o.soloDesde > 3000) this.reiniciarJefe(o, w);
      return;
    }
    o.soloDesde = 0;
    if (o.cast && ahora >= o.cast.fin) this.terminarCastJefe(o, jugadores);
    const G = def.guion || [];
    o.gs = o.gs || {};
    G.forEach((m, i) => {
      const st = o.gs[i] || (o.gs[i] = { prox: o.combateDesde + (m.primero || m.cada || 0), hechos: [] });
      const libre = !o.cast && !this.auraMon(o, 'aturdido');
      if (m.tipo === 'zona' && libre && ahora >= st.prox) {
        st.prox = ahora + m.cada;
        this.crearZonas(o, w, jugadores, m, ahora);
      } else if (m.tipo === 'cast' && libre && ahora >= st.prox && !this.auraMon(o, 'silencio')) {
        st.prox = ahora + m.cada;
        o.cast = { nombre: m.nombre, fin: ahora + m.dura, int: !!m.int, m, tg: o.obj };
        this.aClave(o.cl, { t: 'mcast', id: o.id, nombre: m.nombre, ms: m.dura, int: !!m.int });
        const t = this.sesiones.get(o.obj);
        if (m.a === 'objetivo' && t) this.enviar(t, { t: 'emote', m: `🎯 ¡${def.nombre} lanza ${m.nombre} contra ti!` });
        else if (m.a === 'todos') this.aClave(o.cl, { t: 'emote', m: `⚠️ ¡${def.nombre} lanza ${m.nombre}!${m.int ? ' ¡Interrúmpelo!' : ''}` });
      } else if (m.tipo === 'adds') {
        for (const u of m.en) if (o.hp / o.max <= u && !st.hechos.includes(u)) { st.hechos.push(u); this.invocarEsbirros(o, m); }
      } else if (m.tipo === 'enrage' && !o.enfurecido && o.hp / o.max <= m.en) {
        o.enfurecido = true;
        o.atk = Math.round(o.atk * m.atkX);
        o.vel = o.vel0 * 1.3;
        this.aClave(o.cl, { t: 'emote', m: `😡 ¡${def.nombre} se enfurece!` });
      } else if (m.tipo === 'escudo' && libre && ahora >= st.prox) {
        st.prox = ahora + m.cada;
        this.ponerAuraMon(o, 'caparazon', m.dura, { reduce: m.reduce });
        this.aClave(o.cl, { t: 'emote', m: `🛡️ ${def.nombre} se esconde en su ${m.nombre}: ¡casi no recibe daño!` });
      }
    });
  },

  terminarCastJefe(o, jugadores) {
    const m = o.cast.m;
    const tg = o.cast.tg;
    o.cast = null;
    this.aClave(o.cl, { t: 'mcastFin', id: o.id });
    const vivos = jugadores.filter(s => !s.muerto);
    const blancos = m.a === 'todos' ? vivos.filter(s => Math.abs(s.x - o.x) < 900) : vivos.filter(s => s.id === (o.obj || tg));
    for (const s of blancos) {
      this.herir(s, 0, { id: o.id, jefe: true, pct: m.dano, zona: true });
      if (m.aturde && !s.muerto) this.ponerAura(s, 'aturdido', m.aturde);
    }
  },

  crearZonas(o, w, jugadores, m, ahora) {
    const cs = [];
    if (m.donde === 'jefe') cs.push(o.x);
    else if (m.donde === 'frente') {
      const t = this.sesiones.get(o.obj);
      const f = t ? (t.x >= o.x ? 1 : -1) : o.f;
      cs.push(o.x + f * (m.ancho / 2 + 10));
    } else if (m.donde === 'jugadores') { for (const s of jugadores) if (!s.muerto) cs.push(s.x); }
    else for (let i = 0; i < (m.n || 1); i++) cs.push(o.casaX + rnd(-420, 420));
    w.sigZona = w.sigZona || 1;
    for (const c of cs) w.zonas.push({ id: w.sigZona++, x0: c - m.ancho / 2, x1: c + m.ancho / 2, act: ahora + m.aviso, fin: ahora + m.aviso + 500, dano: m.dano, color: m.color, de: o.id });
    this.aClave(o.cl, { t: 'emote', m: `⚠️ ${MONSTRUOS[o.k].nombre} prepara ${m.nombre}: ¡sal de la zona marcada!` });
  },

  invocarEsbirros(o, m) {
    const vivos = [...this.sesiones.values()].filter(s => s.c && s.k === o.cl && !s.muerto);
    const esc = escalaMazmorra(Math.max(1, vivos.length));
    for (let i = 0; i < m.n; i++) {
      const a = this.crearMonstruo(o.cl, m.k, o.x + (i % 2 ? 1 : -1) * (90 + i * 30), { nv: o.nv - 2, hpX: esc.vidaPack * 0.5, atkX: 1, agresivo: true, radioAgro: 700 });
      a.esbirroDe = o.id;
      const t = vivos[Math.floor(Math.random() * vivos.length)];
      if (t) a.amen.set(t.id, 1);
    }
    this.aClave(o.cl, { t: 'emote', m: `👥 ¡${MONSTRUOS[o.k].nombre} llama a sus esbirros!` });
  },

  quitarEsbirros(o, w) {
    for (const x of [...w.mons.values()]) {
      if (x.esbirroDe !== o.id || x.muere) continue;
      x.muere = true; x.hp = 0; x.borrarEn = Date.now() + 800;
      this.aClave(o.cl, { t: 'md', id: x.id, pr: [] });
    }
  },

  reiniciarJefe(o, w) {
    if (o.cast) this.aClave(o.cl, { t: 'mcastFin', id: o.id });
    for (const a of Object.keys(o.au)) this.quitarAuraMon(o, a);
    o.hp = o.max;
    o.amen.clear(); o.dano.clear();
    o.combateDesde = 0; o.gs = {}; o.cast = null; o.soloDesde = 0; o.enfurecido = false;
    o.atk = o.atk0; o.vel = o.vel0; o.x = o.casaX; o.au = {};
    this.quitarEsbirros(o, w);
    w.zonas = [];
    this.aClave(o.cl, { t: 'emote', m: `💤 ${MONSTRUOS[o.k].nombre} se recupera por completo.` });
  },

  // Llamado desde matar(): cae un jefe de mazmorra.
  alMorirJefeMaz(o) {
    const w = this.mundo[o.cl];
    if (!w || !w.inst) return;
    const I = w.inst;
    const mz = MAZMORRAS[I.id];
    const j = mz.jefes[o.jefeMaz];
    I.hechos++;
    w.muros = w.muros.filter(x => x !== j.muro);
    w.zonas = [];
    this.quitarEsbirros(o, w);
    this.aClave(o.cl, { t: 'muros', muros: w.muros, hechos: I.hechos });
    const jugadores = [...this.sesiones.values()].filter(s => s.c && s.k === o.cl);
    for (const s of jugadores) { s.c.mzJefes = s.c.mzJefes || {}; s.c.mzJefes[o.k] = (s.c.mzJefes[o.k] || 0) + 1; }
    if (!j.final) {
      this.aClave(o.cl, { t: 'emote', m: `✨ ¡${MONSTRUOS[o.k].nombre} cae! La barrera se abre.` });
      return;
    }
    I.completada = true;
    const hoy = hoyUTC();
    const nombres = [];
    for (const s of jugadores) {
      const c = s.c;
      c.mazmorras = (c.mazmorras || 0) + 1;
      this.progresoTarea(s, 'mazmorra');
      if (!c.mazDia || c.mazDia.d !== hoy) c.mazDia = { d: hoy, hechas: [] };
      let extra = '';
      // La primera vez del dia en cada mazmorra trae un premio extra.
      if (!c.mazDia.hechas.includes(I.id)) {
        c.mazDia.hechas.push(I.id);
        const pr = premioMazmorraDia(c.nivel);
        c.oro += pr.oro;
        this.sumarXp(s, pr.xp);
        const it = this.darItem(s, this.generarItem(I.nv, 2));
        extra = ` Premio del día: +${pr.xp.toLocaleString('es')} XP, +${pr.oro.toLocaleString('es')} oro y ${it.r >= 3 ? 'un LEGENDARIO' : 'un objeto ÉPICO'}.`;
      }
      s.sucio = true;
      this.enviar(s, { t: 'completada', id: I.id, txt: `🏆 ¡${mz.nombre} completada!${extra}` });
      this.revisarLogros(s);
      this.actualizarYo(s);
      this.guardar(s);
      nombres.push(c.nombre);
    }
    this.aTodos({ t: 'aviso', m: `🏰 ${nombres.join(', ')} ${nombres.length > 1 ? 'completaron' : 'completó'} ${mz.nombre} (Nv ${I.nv}).` });
  },

  // Morir en una mazmorra: se revive en su entrada (si sigue abierta).
  revivirEnInstancia(s) {
    const w = this.mundo[s.k];
    if (!w || !w.inst) return false;
    this.entrarMapa(s, w.mapa, 150, false, s.k);
    return true;
  },

  // Barreras: nadie pasa de la primera que siga cerrada.
  topeMuros(s) {
    const w = this.mundo[s.k];
    return w && w.muros && w.muros.length ? Math.min(...w.muros) - 22 : Infinity;
  },
};
