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
import { MAPAS, MONSTRUOS, MAZMORRAS, MONTURAS, MATERIALES, esenciaJefe, ESENCIA_NV, escalaMazmorra, premioMazmorraDia, nivelMazmorra, statsMonstruo, SUELO, hoyUTC, NIVEL_MAX, DESAFIO_MAX, multDesafio, premioDesafio, AFIJOS, afijosDe, multAfijos, opcionesBoveda, semanaUTC, nombreItem, BANDA_MONTURA, botinBandaNv, CONJUNTO_PROB, BANDA_MAX, BOLSA_MAX , PASE } from '../../mmo/js/data.js';
import { GRUPO_MAX } from './social.js';

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
    // La del grupo, si sigue abierta y es esta mazmorra: se entra a ella
    // (tambien a su Desafio, con nivel 60) sin mirar lo que pide el cliente.
    const gi = this.grupoDe(s);
    if (gi && !mz.banda && gi.uids.length > GRUPO_MAX) return this.no(s, `Las mazmorras son para grupos de hasta ${GRUPO_MAX} (son ${gi.uids.length}). Para más, conviertan el grupo en banda (hasta ${BANDA_MAX}).`);
    const wg = gi && gi.inst && this.mundo[gi.inst];
    if (wg && wg.inst && !wg.inst.completada && wg.inst.id === id) {
      if (wg.inst.k && s.c.nivel < NIVEL_MAX) return this.no(s, `Tu grupo está en un Desafío: hace falta nivel ${NIVEL_MAX}.`);
      if (this.llenaInst(wg, s)) return this.no(s, `${mz.nombre} ya tiene ${this.capInst(wg)} jugadores dentro.`);
      return this.unirAInstancia(s, wg);
    }
    // Desafio +k: solo a Nv 60 y hasta uno mas que el mejor vencido.
    const k = mz.banda || mz.sinDesafio ? 0 : Math.max(0, Math.min(DESAFIO_MAX, m.k | 0));
    if (k && s.c.nivel < NIVEL_MAX) return this.no(s, `Los Desafíos se abren a nivel ${NIVEL_MAX}.`);
    if (k > ((s.c.desafio || {})[id] || 0) + 1) return this.no(s, `Primero vence el Desafío +${k - 1} de ${mz.nombre}.`);
    const g = this.grupoDe(s);
    this.instDe = this.instDe || new Map();   // uid -> clave de su instancia (jugando solo)
    // El grupo (o el jugador solo) vuelve a SU instancia si sigue abierta:
    // salir y entrar no crea otra (ni reaparecen los jefes ya vencidos).
    const previa = g ? g.inst : this.instDe.get(s.c.uid);
    const wp = previa && this.mundo[previa] && this.mundo[previa].inst ? this.mundo[previa] : null;
    if (wp && !wp.inst.completada) {
      if (wp.inst.id === id && (wp.inst.k || 0) === k) return this.llenaInst(wp, s) ? this.no(s, `${mz.nombre} ya tiene ${this.capInst(wp)} jugadores dentro.`) : this.unirAInstancia(s, wp);
      if (g) return this.no(s, `Tu grupo está en ${MAZMORRAS[wp.inst.id].nombre}${wp.inst.k ? ' (Desafío +' + wp.inst.k + ')' : ''}: entra a esa o sal del grupo.`);
      if (this.jugadoresEn(previa)) return this.no(s, 'Todavía tienes otra mazmorra abierta.');
      this.cerrarInstancia(previa);
    } else if (wp && wp.inst.completada) {
      if (this.jugadoresEn(previa)) return this.no(s, 'Tu grupo acaba de completarla. Esperen unos segundos a que se cierre.');
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
    const quienes = g ? this.sesionesGrupo(g).filter(x => x !== s && !x.muerto && this.cercaDelBuscador(x) && x.c.nivel >= (k ? NIVEL_MAX : mz.nv[0])) : [];
    quienes.unshift(s);
    quienes.length = Math.min(quienes.length, mz.banda ? BANDA_MAX : GRUPO_MAX);
    const nivel = k ? NIVEL_MAX : nivelMazmorra(mz, Math.max(...quienes.map(x => x.c.nivel)));
    const w = this.crearInstancia(id, nivel, quienes.length, k);
    if (g) g.inst = w.clave; else this.instDe.set(s.c.uid, w.clave);
    for (const x of quienes) this.unirAInstancia(x, w);
    if (g) for (const x of this.sesionesGrupo(g)) {
      if (!quienes.includes(x)) this.enviar(x, { t: 'toast', m: `🏰 Tu grupo entró a ${mz.nombre}. Para unirte, entra por el portal de mazmorras del pueblo.` });
    }
  },

  crearInstancia(id, nivel, n, k = 0) {
    const mz = MAZMORRAS[id];
    this.sigInst = (this.sigInst || 0) + 1;
    const clave = mz.mapa + '#' + this.sigInst.toString(36) + Math.random().toString(36).slice(2, 6);
    const w = this.mundoK(clave);
    w.spawnEn = Infinity;
    w.zonas = [];
    const md = multDesafio(k);
    // Afijos de la semana: se fijan al abrirla (un cambio de semana a mitad
    // de la partida no la cambia).
    const af = afijosDe(k);
    const ma = multAfijos(af);
    // La banda es mas dura de por si (se hace con el mejor equipo).
    const dv = (mz.dif && mz.dif.vida) || 1, da = (mz.dif && mz.dif.atk) || 1;
    w.inst = { id, nv: nivel, creado: Date.now(), vacioDesde: 0, hechos: 0, completada: false, k, mv: md.vida, ma: md.atk, af, banda: !!mz.banda,
      mvP: md.vida * ma.vidaPack * dv, maP: md.atk * ma.atkPack * da, mvJ: md.vida * ma.vidaJefe * dv, maJ: md.atk * ma.atkJefe * da };
    const I = w.inst;
    w.muros = mz.jefes.map(j => j.muro);
    const esc = escalaMazmorra(n);
    mz.packs.forEach((pk, ip) => {
      const grupo = clave + ':' + ip;
      pk.k.forEach((k, i) => this.crearMonstruo(clave, k, pk.x + i * 48 - (pk.k.length - 1) * 24,
        { nv: nivel + (i === 0 ? 1 : 0), hpX: esc.vidaPack * I.mvP, atkX: esc.atkPack * I.maP, agresivo: true, radioAgro: 230, grupo }));
    });
    mz.jefes.forEach((j, i) => {
      const o = this.crearMonstruo(clave, j.k, j.x, { nv: nivel + 2, hpX: esc.vidaJefe * I.mvJ, atkX: esc.atkJefe * I.maJ, agresivo: true, radioAgro: 260, mazmorra: true, jefeMaz: i });
      o.final = !!j.final;
      o.atk0 = statsMonstruo(j.k, nivel + 2).atk;
      o.vel0 = o.vel;
      o.sinEmbestida = !(MONSTRUOS[j.k].guion || []).some(g => g.tipo === 'embestida');
    });
    return w;
  },

  unirAInstancia(s, w) {
    const mz = MAZMORRAS[w.inst.id];
    s.c.inst = w.clave;   // para volver a ESTA (y no a otra del mismo mapa) al reconectar
    this.entrarMapa(s, mz.mapa, 150, false, w.clave);
    w.inst.vacioDesde = 0;
    const af = (w.inst.af || []).map(a => AFIJOS[a].emoji + ' ' + AFIJOS[a].nombre).join(', ');
    if (w.inst.banda) return this.enviar(s, { t: 'toast', ok: true, m: `⚔️ ${mz.nombre} (banda, Nv ${w.inst.nv}). Las zonas DORADAS se aguantan juntos: entren todos para repartir el golpe.` });
    this.enviar(s, { t: 'toast', m: w.inst.k ? `⚡ ${mz.nombre} — Desafío +${w.inst.k}: monstruos con ${Math.round(w.inst.mv * 100)}% de vida y ${Math.round(w.inst.ma * 100)}% de daño.${af ? ' Afijos: ' + af + '.' : ''}` : `${mz.nombre} (Nv ${w.inst.nv}). Los monstruos atacan en grupo.`, ok: true });
  },

  // Tope de jugadores dentro de una instancia (5, o 10 la banda).
  capInst(w) { return w.inst.banda ? BANDA_MAX : GRUPO_MAX; },
  llenaInst(w, s) {
    let n = 0;
    for (const x of this.sesiones.values()) if (x.c && x !== s && x.k === w.clave) n++;
    return n >= this.capInst(w);
  },
  // Un grupo que se disuelve (o se queda sin nadie conectado) deja su
  // instancia a cada uno de sus miembros, para volver a ella al reconectar.
  alDisolverGrupo(g) {
    if (!g.inst || !this.mundo[g.inst]) return;
    this.instDe = this.instDe || new Map();
    for (const u of g.uids) this.instDe.set(u, g.inst);
  },
  // Quien sale de un grupo (o es expulsado) estando en su instancia, al
  // pueblo: si no, seguia dentro y se podia meter a mas gente.
  sacarDeInstancia(s, clave) {
    const w = clave && this.mundo[clave];
    if (!w || !w.inst || s.k !== clave) return;
    if (s.c.inst === clave) s.c.inst = null;
    if (this.instDe && this.instDe.get(s.c.uid) === clave) this.instDe.delete(s.c.uid);
    this.entrarMapa(s, 'pueblo', 795);
    this.enviar(s, { t: 'toast', m: '🏰 Saliste del grupo: vuelves al pueblo.' });
  },

  // Al reconectar: si estaba en una mazmorra que sigue abierta (la suya o la
  // de su grupo), vuelve a ella donde estaba en vez de aparecer en el pueblo.
  volverAInstancia(s, mapa, x) {
    const w = s.c.inst && this.mundo[s.c.inst];
    if (!w || !w.inst || w.inst.completada || w.mapa !== mapa) return false;
    if (s.c.nivel < (w.inst.k ? NIVEL_MAX : MAZMORRAS[w.inst.id].nv[0])) return false;
    // Solo a la de tu grupo o a la tuya (no a la de un grupo que dejaste).
    const g = this.grupoDe(s);
    if (!((g && g.inst === w.clave) || (this.instDe && this.instDe.get(s.c.uid) === w.clave))) return false;
    if (this.llenaInst(w, s)) return false;
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
    // Solo en una mazmorra de verdad (los jefes de la Torre van marcados
    // mazmorra para no dar mTON, pero no tienen guion ni su escala).
    if (o.mazmorra && o.jefe && !o.combateDesde && w.inst) this.empezarJefe(o, w, ahora);
  },
  // Lo mismo si el primer contacto es un golpe (un mago desde lejos).
  alPegar(o, s) { if (s && (o.grupo || (o.mazmorra && !o.combateDesde))) this.alAgro(o, s, Date.now()); },

  empezarJefe(o, w, ahora) {
    const n = [...this.sesiones.values()].filter(s => s.c && s.k === o.cl && !s.muerto).length || 1;
    const esc = escalaMazmorra(n);
    const pct = o.hp / o.max;
    const I = (w && w.inst) || {};
    o.max = Math.round(statsMonstruo(o.k, o.nv).hp * esc.vidaJefe * (I.mvJ || I.mv || 1));
    o.hp = Math.max(1, Math.round(o.max * pct));
    o.atk = Math.round(o.atk0 * esc.atkJefe * (I.maJ || I.ma || 1));
    o.nEsc = n;
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
        const dentro = jugadores.filter(s => !s.muerto && s.x >= z.x0 - 8 && s.x <= z.x1 + 8 && s.y > SUELO - 150);
        if (z.junta) {
          // Hay que aguantarla juntos: el golpe vale `dano` por cada uno de los
          // que hacen falta (los de la sala, hasta `junta`) y se reparte entre
          // los de dentro: con los justos o mas, cada uno recibe `dano` o menos;
          // con menos, mas. Si no entra nadie, estalla sobre todos con el doble
          // (asi entrar compensa siempre, tambien jugando solo).
          const jf = w.mons.get(z.de);
          const vivos = jugadores.filter(s => !s.muerto && (!jf || Math.abs(s.x - jf.casaX) < 900));
          const total = z.dano * Math.min(Math.max(1, vivos.length), z.junta);
          if (dentro.length) for (const s of dentro) this.herir(s, 0, { id: z.de, jefe: true, pct: total / dentro.length, zona: true });
          else {
            for (const s of vivos) this.herir(s, 0, { id: z.de, jefe: true, pct: z.dano * 2, zona: true });
            this.aClave(w.clave, { t: 'emote', m: '💥 ¡Nadie la aguantó y estalla sobre todos con el doble de fuerza!' });
          }
        } else for (const s of dentro) this.herir(s, 0, { id: z.de, jefe: true, pct: z.dano, zona: true });
      }
      return ahora < z.fin;
    });
    for (const o of [...w.mons.values()]) if (!o.muere && o.jefe && o.mazmorra && o.combateDesde) this.guionJefe(o, w, jugadores, ahora);
    const af = (w.inst && w.inst.af) || [];
    if (af.includes('furioso')) this.afijoFurioso(w);
    if (af.includes('volcanico')) this.afijoVolcanico(w, jugadores, ahora);
  },

  // ── AFIJOS DE LOS DESAFIOS ──
  // Furioso: los que no son jefes se enfurecen bajo el 30% de vida.
  afijoFurioso(w) {
    for (const o of w.mons.values()) {
      if (o.jefe || o.muere || o.furia || o.hp / o.max >= 0.3) continue;
      o.furia = true;
      o.atk = Math.round(o.atk * 1.5);
      this.aClave(o.cl, { t: 'emote', m: `😡 ¡${MONSTRUOS[o.k].nombre} se enfurece! Remátalo.` });
    }
  },
  // Volcanico: mientras haya combate, cada 10 s una llama bajo cada jugador
  // (aviso de 2 s, 10% de la vida; medido con sim_mazmorra EQ=1: a 8 s/1,6 s/12%
  // la semana Tiranico+Volcanico era mucho mas dura que las demas; se esquiva saliendo de la marca o saltando).
  afijoVolcanico(w, jugadores, ahora) {
    const peleando = [...w.mons.values()].find(o => !o.muere && o.amen.size);
    if (!peleando) { w.volcEn = 0; return; }
    if (!w.volcEn) { w.volcEn = ahora + 4000; return; }
    if (ahora < w.volcEn) return;
    // No a la vez que una zona del jefe: sin sitio seguro, era la que mas mataba.
    if (w.zonas.some(z => !z.hecho && !z.volc)) { w.volcEn = ahora + 1500; return; }
    w.volcEn = ahora + 10000;
    w.sigZona = w.sigZona || 1;
    for (const s of jugadores) if (!s.muerto) w.zonas.push({ id: w.sigZona++, x0: s.x - 55, x1: s.x + 55, act: ahora + 2000, fin: ahora + 2500, dano: 0.1, color: '#ff5a1f', de: peleando.id, volc: true });
    if (!w.volcAviso) { w.volcAviso = true; this.aClave(w.clave, { t: 'emote', m: '🌋 ¡El suelo arde bajo tus pies! Sal de la marca naranja.' }); }
  },
  // Sanguinario (llamado desde matar): al morir uno de un pack, cura un 20%
  // de su vida a los de su pack que sigan vivos.
  alMorirPack(o) {
    const w = this.mundo[o.cl];
    if (!w || !w.inst || !(w.inst.af || []).includes('sanguinario') || o.jefe) return;
    let n = 0;
    for (const x of w.mons.values()) {
      if (x === o || x.muere || x.grupo !== o.grupo || x.hp >= x.max) continue;
      x.hp = Math.min(x.max, x.hp + x.max * 0.2);
      n++;
    }
    if (n) this.aClave(o.cl, { t: 'emote', m: '🩸 Su pack se cura con su sangre: ¡mátenlos a la vez!' });
  },

  guionJefe(o, w, jugadores, ahora) {
    const def = MONSTRUOS[o.k];
    // Si no queda nadie vivo en su sala, se recupera y todo vuelve a empezar
    // (el "wipe" de WoW: se revive en la entrada y se intenta otra vez).
    if (!jugadores.some(s => !s.muerto)) { o.soloDesde = 0; this.reiniciarJefe(o, w); return; }
    if (!jugadores.some(s => !s.muerto && Math.abs(s.x - o.casaX) < 1300)) {
      if (!o.soloDesde) o.soloDesde = ahora;
      else if (ahora - o.soloDesde > 3000) this.reiniciarJefe(o, w);
      return;
    }
    o.soloDesde = 0;
    // Si llegan mas a la sala con el combate empezado, su vida crece (con el
    // mismo %): tirar del jefe solo y que entren los demas no lo abarata.
    const nSala = jugadores.filter(s => !s.muerto && Math.abs(s.x - o.casaX) < 1300).length;
    if (nSala > (o.nEsc || 1)) {
      const esc = escalaMazmorra(nSala), I = w.inst || {};
      const pct = o.hp / o.max;
      o.max = Math.round(statsMonstruo(o.k, o.nv).hp * esc.vidaJefe * (I.mvJ || I.mv || 1));
      o.hp = Math.max(1, Math.round(o.max * pct));
      o.atk = Math.round(o.atk0 * esc.atkJefe * (I.maJ || I.ma || 1) * (o.enfurecido ? o.enfX || 1.5 : 1));
      o.nEsc = nSala;
      this.aClave(o.cl, { t: 'mmx', id: o.id, mx: o.max, hp: Math.ceil(o.hp) });
    }
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
        o.enfX = m.atkX;
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
    else if (m.donde === 'uno') {
      // Bajo un jugador al azar (sin salirse de la sala del jefe).
      const vivos = jugadores.filter(s => !s.muerto && Math.abs(s.x - o.casaX) < 900);
      const t = vivos[Math.floor(Math.random() * vivos.length)];
      cs.push(t ? t.x : o.x);
    }
    else for (let i = 0; i < (m.n || 1); i++) cs.push(o.casaX + rnd(-420, 420));
    w.sigZona = w.sigZona || 1;
    for (const c of cs) w.zonas.push({ id: w.sigZona++, x0: c - m.ancho / 2, x1: c + m.ancho / 2, act: ahora + m.aviso, fin: ahora + m.aviso + 500, dano: m.dano, color: m.color, de: o.id, junta: m.junta || 0 });
    this.aClave(o.cl, { t: 'emote', m: m.junta ? `⚠️ ${MONSTRUOS[o.k].nombre} lanza ${m.nombre}: ¡reúnanse en la marca dorada!` : `⚠️ ${MONSTRUOS[o.k].nombre} prepara ${m.nombre}: ¡sal de la zona marcada!` });
  },

  invocarEsbirros(o, m) {
    const vivos = [...this.sesiones.values()].filter(s => s.c && s.k === o.cl && !s.muerto);
    const esc = escalaMazmorra(Math.max(1, vivos.length));
    const I = (this.mundo[o.cl] && this.mundo[o.cl].inst) || {};
    for (let i = 0; i < m.n; i++) {
      const a = this.crearMonstruo(o.cl, m.k, o.x + (i % 2 ? 1 : -1) * (90 + i * 30), { nv: o.nv - 2, hpX: esc.vidaPack * 0.5 * (I.mvP || I.mv || 1), atkX: I.maP || I.ma || 1, agresivo: true, radioAgro: 700 });
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
    o.combateDesde = 0; o.gs = {}; o.cast = null; o.soloDesde = 0; o.enfurecido = false; o.enfX = 1;
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
    const es = esenciaJefe(I.banda, I.k);
    const peleo = s => o.dano.has(s.id) || !!(o.cura && o.cura.has(s.id));
    for (const s of jugadores) {
      s.c.mzJefes = s.c.mzJefes || {}; s.c.mzJefes[o.k] = (s.c.mzJefes[o.k] || 0) + 1;
      // Esencia Abisal (para las runas de la Artesana): mazmorras de nivel
      // alto y solo a quien peleo.
      if (I.nv < ESENCIA_NV || !peleo(s)) continue;
      s.c.mat = s.c.mat || {};
      s.c.mat.esencia = Math.min(999, (s.c.mat.esencia || 0) + es);
      s.sucio = true;
      if (!j.final) { this.enviar(s, { t: 'toast', ok: true, m: `🟣 +${es} ${MATERIALES.esencia.nombre}` }); this.actualizarYo(s); }
      else s.esenciaFin = es;   // va en el mensaje de completada
    }
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
      if (this.puntoPase) this.puntoPase(s, PASE.puntos.mazmorra);
      this.progresoTarea(s, 'mazmorra');
      if (peleo(s) && I.nv >= c.nivel - 10) this.puntoGesta(s, 'mazmorra');
      if (!c.mazDia || c.mazDia.d !== hoy) c.mazDia = { d: hoy, hechas: [] };
      let extra = '';
      let kBoveda = 0;
      // La primera vez del dia en cada mazmorra trae un premio extra.
      if (!c.mazDia.hechas.includes(I.id)) {
        c.mazDia.hechas.push(I.id);
        const pr = premioMazmorraDia(Math.min(c.nivel, I.nv + 10));   // una muy por debajo de tu nivel da menos
        c.oro += pr.oro;
        this.sumarXp(s, pr.xp);
        const it = this.darItem(s, this.generarItem(Math.min(I.nv, c.nivel), 2));   // I.nv va con el mas alto del grupo: el resto tambien puede equiparlo
        extra = ` Premio del día: ${c.nivel < NIVEL_MAX ? '+' + pr.xp.toLocaleString('es', { useGrouping: 'always' }) + ' XP, ' : ''}+${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro y ${it.r >= 3 ? 'un LEGENDARIO' : 'un objeto ÉPICO'}.`;
      }
      // Desafio vencido: abre el siguiente y da su premio (oro y un objeto
      // de nivel 60+k que se puede equipar a Nv 60).
      if (I.k) {
        c.desafio = c.desafio || {};
        // Quien va "llevado" por su grupo avanza de uno en uno (no salta del
        // +0 al +20 en una partida); el premio completo es al batir tu marca
        // o, como mucho, una vez al dia por mazmorra.
        const antes = c.desafio[I.id] || 0;
        const nuevo = Math.min(I.k, antes + 1);
        const marca = nuevo > antes;
        c.desafio[I.id] = Math.max(antes, nuevo);
        this.anotarDesSem(s, nuevo);
        kBoveda = nuevo;
        const maxAntes = c.desafioMax || 0;
        c.desafioMax = Math.max(maxAntes, c.desafio[I.id]);
        if (c.desafioMax > maxAntes) this.actualizarRankDes(s).catch(e => console.error('[MMO rankDes]', e));
        if (!c.desDia || c.desDia.d !== hoy) c.desDia = { d: hoy, hechas: [] };
        if (marca || !c.desDia.hechas.includes(I.id)) {
          if (!c.desDia.hechas.includes(I.id)) c.desDia.hechas.push(I.id);
          // Se paga el +k que TU bates (el llevado cobra su escalon, no el de la instancia)
          const pd = premioDesafio(nuevo);
          c.oro += pd.oro;
          const it = this.generarItem(pd.nvItem, pd.rMin);
          it.des = 1;
          it.cj = I.id;   // el premio del Desafio siempre es del conjunto de su mazmorra
          this.darItem(s, it);
          extra += ` Desafío +${nuevo} vencido: +${pd.oro.toLocaleString('es', { useGrouping: 'always' })} oro y un objeto de nivel ${pd.nvItem}.`;
        } else extra += ` Desafío +${I.k} vencido (el premio de esta mazmorra ya lo cobraste hoy: bate tu marca para otro).`;
        extra += ` Tu marca aquí: +${c.desafio[I.id]}.`;
      }
      if (I.banda) { const b = this.bloqueoBanda(c); kBoveda = b.bov ? 0 : 5; b.bov = 1; }
      this.progresoBoveda(s, kBoveda);
      if (s.esenciaFin) { extra += ` +${s.esenciaFin} ${MATERIALES.esencia.nombre}.`; s.esenciaFin = 0; }
      s.sucio = true;
      this.enviar(s, { t: 'completada', id: I.id, txt: `${mz.nombre}${I.k ? ' +' + I.k : ''} completada.${extra}` });
      this.revisarLogros(s);
      this.actualizarYo(s);
      this.guardar(s);
      nombres.push(c.nombre);
    }
    this.aTodos({ t: 'aviso', m: `🏰 ${nombres.join(', ')} ${nombres.length > 1 ? 'completaron' : 'completó'} ${mz.nombre} ${I.k ? '— ⚡ Desafío +' + I.k : '(Nv ' + I.nv + ')'}.` });
    // Primera victoria del servidor contra el jefe final de la banda: queda
    // escrita para siempre y da el titulo «Pionero del Abismo».
    this.primeros = this.primeros || {};
    const reales = jugadores.filter(s => !this.esPrueba(s.c) && (o.dano.has(s.id) || !!(o.cura && o.cura.has(s.id))));
    if (I.banda && !this.primeros[o.k] && reales.length) {
      this.primeros[o.k] = { t: Date.now(), n: reales.map(s => s.c.nombre) };
      this.state.storage.put('primeros', this.primeros);
      for (const s of reales) { s.c.pionero = 1; this.revisarLogros(s); this.actualizarYo(s); }
      this.aTodos({ t: 'aviso', m: `Primera victoria del servidor: ${reales.map(s => s.c.nombre).join(', ')} ${reales.length > 1 ? 'vencieron' : 'venció'} a ${MONSTRUOS[o.k].nombre} por primera vez.` });
    }
  },

  // ── BANDA ──
  // c.bandaSem = { sem, j: { idJefe: 1 } }: los jefes de la banda cuyo botin
  // ya cobraste esta semana (lunes a domingo UTC). c.titanes = semanas que
  // venciste al jefe final cobrando su botin: a BANDA_MONTURA, su montura.
  bloqueoBanda(c) {
    const sem = semanaUTC();
    if (!c.bandaSem || c.bandaSem.sem !== sem) c.bandaSem = { sem, j: {} };
    return c.bandaSem;
  },
  infoBanda(c) { const b = this.bloqueoBanda(c); return { j: Object.keys(b.j), t: c.titanes || 0 }; },
  esJefeBanda(o) { const w = o.mazmorra && this.mundo[o.cl]; return !!(w && w.inst && w.inst.banda); },
  // Llamado desde dar() al caer un jefe de la banda, para cada uno que cobra.
  botinBanda(s, o, participo) {
    const c = s.c;
    const b = this.bloqueoBanda(c);
    if (b.j[o.k]) { this.enviar(s, { t: 'toast', m: `🔒 Ya cobraste el botín de ${MONSTRUOS[o.k].nombre} esta semana (vuelve el lunes).` }); return null; }
    // Solo quien pego o curo; y sin bolsa llena (no se vende solo ni se
    // gasta la semana): asi se puede volver a intentar.
    if (!participo) { this.enviar(s, { t: 'toast', m: `Para el botín de ${MONSTRUOS[o.k].nombre} hay que pelear (golpear o curar).` }); return null; }
    if ((c.bolsa || []).length >= BOLSA_MAX && !(c.bolsa || []).some(x => !x.cj && !x.banda)) { this.enviar(s, { t: 'toast', m: '🎒 Bolsa llena: haz sitio para cobrar el botín de la banda (sigue disponible esta semana).' }); return null; }
    b.j[o.k] = 1;
    const it = this.generarItem(botinBandaNv(o.final), o.final && Math.random() < 0.15 ? 3 : 2);
    it.des = 1;
    it.banda = 1;   // como las de conjunto: con la bolsa llena no se vende sola
    if (Math.random() < CONJUNTO_PROB * 2) it.cj = this.mundo[o.cl].inst.id;
    const dado = this.darItem(s, it);
    if (o.final) {
      c.titanes = (c.titanes || 0) + 1;
      c.monturas = c.monturas || [];
      if (c.titanes >= BANDA_MONTURA && !c.monturas.includes('abismo')) {
        c.monturas.push('abismo');
        this.enviar(s, { t: 'toast', ok: true, m: `Nueva montura: ${MONTURAS.abismo.nombre}. Mercader → Monturas.` });
        this.aTodos({ t: 'aviso', m: `🦇 ${c.nombre} ganó el ${MONTURAS.abismo.nombre} en la banda del Santuario.` });
      } else if (c.titanes < BANDA_MONTURA) this.enviar(s, { t: 'toast', m: `🦇 Titán vencido ${c.titanes}/${BANDA_MONTURA} semanas: a la ${BANDA_MONTURA}ª te llevas su montura.` });
    }
    return dado;
  },

  // ── BOVEDA SEMANAL ──
  // c.boveda = { sem, n: mazmorras completadas, k: mejor +k } de la semana en
  // curso; c.bovedaOpc = los objetos por elegir de una semana pasada. Al
  // cambiar la semana (se mira en datosPropios, al entrar o jugando) se
  // generan las opciones; si aun no elegiste las anteriores, esa semana se
  // pierde (como en WoW). Devuelve true si roto.
  rotarBoveda(c) {
    const sem = semanaUTC();
    const b = c.boveda;
    if (b && b.sem === sem) return false;
    if (b && b.n > 0 && !(c.bovedaOpc && c.bovedaOpc.length)) {
      const nv = b.k ? NIVEL_MAX + Math.min(b.k, DESAFIO_MAX) : Math.min(NIVEL_MAX, c.nivel);
      c.bovedaOpc = [];
      for (let i = 0; i < opcionesBoveda(b.n); i++) {
        const it = this.generarItem(nv, b.k >= 5 ? 2 : 1);
        if (b.k) it.des = 1;
        c.bovedaOpc.push(it);
      }
    }
    c.boveda = { sem, n: 0, k: 0 };
    return true;
  },
  progresoBoveda(s, k) {
    const c = s.c;
    this.rotarBoveda(c);
    c.boveda.n++;
    c.boveda.k = Math.max(c.boveda.k, k || 0);
  },
  elegirBoveda(s, m) {
    const c = s.c, opc = c.bovedaOpc;
    if (!opc || !opc.length) return this.no(s, 'No tienes nada en la Bóveda.');
    const it = opc[m.i | 0];
    if (!it) return;
    c.bovedaOpc = null;
    this.darItem(s, it);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `🗝️ Te llevas ${nombreItem(it)} de la Bóveda semanal.` });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Morir en una mazmorra: se revive en su entrada (si sigue abierta).
  revivirEnInstancia(s) {
    const w = this.mundo[s.k];
    if (!w || !w.inst) return false;
    // Junto a la ultima barrera ya abierta (un punto de control): antes se
    // volvia a la entrada y habia que cruzar toda la mazmorra otra vez.
    const mz = MAZMORRAS[w.inst.id];
    const abiertas = mz ? mz.jefes.map(j => j.muro).filter(mu => !(w.muros || []).includes(mu)) : [];
    // Dentro de la sala ya limpia (antes de la barrera): pasada la barrera el
    // siguiente pack quedaba a menos de su radio de agro.
    const x = abiertas.length ? Math.max(...abiertas) - 120 : 150;
    this.entrarMapa(s, w.mapa, x, false, s.k);
    return true;
  },

  // Barreras: nadie pasa de la primera que siga cerrada.
  topeMuros(s) {
    const w = this.mundo[s.k];
    return w && w.muros && w.muros.length ? Math.min(...w.muros) - 22 : Infinity;
  },
};
