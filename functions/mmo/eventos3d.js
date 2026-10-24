// ═══════════════════════════════════════════════════════
// DUENDE QUEST ORIGINS — sorpresas del mundo abierto 3D
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo), como eventos.js
// lo hace para el 2D. Tres cosas:
//  1. ELITES RAROS: en una zona con gente, de vez en cuando aparece un
//     monstruo con nombre propio y tinte dorado o plateado (x6 de vida). A
//     cada uno que lo peleo: objeto raro seguro, mucha XP y oro.
//  2. INVASIONES: cada 14-18 min, en la zona donde hay mas gente, llegan
//     oleadas agresivas cerca de los jugadores. Meta compartida que escala con
//     los presentes; al cumplirla llega un Capitan. Si cae a tiempo, todos los
//     que pelearon cobran (XP, oro y un objeto).
//  3. COFRES: 3 por zona (mmo/js/mundo3d.js cofres3d); cada jugador abre
//     cada uno una vez cada 30 min.
// Lo decide el servidor; nada de esto da mTON.
// ═══════════════════════════════════════════════════════
import { MAPAS, MONSTRUOS, RAREZAS, statsMonstruo, xpParaSubir, nombreItem } from '../../mmo/js/data.js';
import { zonaEn, cofres3d, COFRE3D_DIST, alturaEn, MUNDO } from '../../mmo/js/mundo3d.js';
import { COFRE_TIPOS, COFRE_CADA_MS } from './eventos.js';
// Los cofres del 3D estan escondidos (hay que explorar y, el legendario, volar
// hasta lo alto): pagan mas que los del 2D y el legendario siempre trae equipo.
const COFRE3D_X = { comun: { oro: 3, equipo: 0.15 }, epico: { oro: 4, equipo: 0.4 }, legendario: { oro: 5, equipo: 1 } };

const K3 = '~3d';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const azar = l => l[Math.floor(Math.random() * l.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const RARO3D_TIRADA_MS = 60 * 1000, RARO3D_PROB = 0.15, RARO3D_REAPARECE_MS = 15 * 60 * 1000, RARO3D_VIDA_MS = 15 * 60 * 1000;
export const INV3D_CADA_MIN = [14, 18], INV3D_DURA_MS = 5 * 60 * 1000;
const NOMBRES = ['Ojoplata', 'Zarpadorada', 'Grishnak el Viejo', 'Morgra', 'Colmillo de Oro', 'Vorgath', 'Lunargenta',
  'Skarn el Errante', 'Brasaviva', 'Ulmo Sombrío', 'Kragga', 'Nébula', 'Torvo Dientefrío', 'Rengo el Codicioso'];
const TINTES = ['#ffd84a', '#e5e7eb'];
const INVASION = {
  noche: 'Invasión de no muertos', amanecer: 'Invasión goblin', selva: 'Invasión de la selva', tormenta: 'Invasión arcana',
  desierto: 'Invasión del desierto', castillo: 'Asalto de la corte', cumbres: 'Invasión del ocaso', cavernas: 'Invasión abisal',
  abismo: 'Marea abisal', acantilados: 'Tormenta mágica',
};
const zonaAbierta = z => !!(MAPAS[z] && MAPAS[z].zona && MAPAS[z].monstruos && MAPAS[z].monstruos.length);

export const Eventos3D = {
  // Un monstruo especial (sin campamento): raro, invasor o capitan.
  crearEspecial3d(k, x, z, o2) {
    const W = this.iniciar3d(), def = MONSTRUOS[k], nv = o2.nv || def.nivel, st = statsMonstruo(k, nv);
    const hp = Math.round(st.hp * (o2.hpX || 1));
    const o = {
      id: W.sig++, k, nv, campo: -1, mapa: o2.zona, jefe: !!o2.jefe, dispara: !!def.dispara, persiste: true, agresivo: !!o2.agresivo,
      x, z, hx: x, hz: z, ry: 0, hp, max: hp, atk: Math.round(st.atk * (o2.atkX || 1)), vel: st.vel, y: 0, h: 0,
      dano: new Map(), amen: new Map(), au: {}, cl: K3, obj: 0, atkEn: 0, golpeT: 0, st: 0, paseo: 0, destino: null,
      ex3: o2.ex || null, expira: o2.expira || 0,
    };
    W.mons.set(o.id, o);
    return o;
  },
  // Donde aparece algo cerca de un jugador: a 18-30 m, en tierra y en la misma zona.
  puntoCerca3d(s, zona) {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(18, 30), x = s.p.x + Math.cos(a) * d, z = s.p.z + Math.sin(a) * d;
      if (zonaEn(x, z) === zona && alturaEn(x, z) > MUNDO.agua + 0.5) return { x, z };
    }
    return { x: s.p.x + 10, z: s.p.z };
  },

  tickEventos3d(ahora, jugadores) {
    const W = this.iniciar3d();
    const porZona = {};
    for (const s of jugadores) {
      if (s.i3 || s.muerto) continue;
      const z = zonaEn(s.p.x, s.p.z);
      if (zonaAbierta(z)) (porZona[z] = porZona[z] || []).push(s);
    }
    // Monstruos especiales que caducan sin pelear (un raro que nadie encontro).
    for (const o of W.mons.values()) if (o.expira && ahora > o.expira && !o.muere && !o.obj) { W.mons.delete(o.id); this.aClave(K3, { t: 'md3', id: o.id }); if (o.ex3 && o.ex3.raro) (W.raros || (W.raros = {}))[o.mapa] = { id: 0, prox: ahora + RARO3D_REAPARECE_MS }; }
    // Raros: una tirada por minuto en cada zona con gente.
    W.raros = W.raros || {};
    for (const z in porZona) {
      const R = W.raros[z] || (W.raros[z] = { id: 0, prox: ahora + rnd(2, 5) * 60000 });
      if (ahora < R.prox) continue;
      R.prox = ahora + RARO3D_TIRADA_MS;
      const vivo = R.id && W.mons.get(R.id);
      if (vivo && !vivo.muere) continue;
      if (Math.random() < RARO3D_PROB) this.crearRaro3d(z, azar(porZona[z]));
    }
    // Invasiones.
    if (!W.inv3prox) W.inv3prox = ahora + rnd(INV3D_CADA_MIN[0], INV3D_CADA_MIN[1]) * 60000;
    const ev = W.inv3;
    if (ev) this.tickInvasion3d(ev, ahora, porZona[ev.zona] || []);
    else if (ahora >= W.inv3prox) {
      const zonas = Object.keys(porZona);
      if (zonas.length) this.empezarInvasion3d(zonas.sort((a, b) => porZona[b].length - porZona[a].length)[0], porZona, ahora);
      else W.inv3prox = ahora + 60000;
    }
  },

  // ── ELITES RAROS ──
  crearRaro3d(zona, cerca) {
    const W = this.iniciar3d(), mp = MAPAS[zona];
    const k = azar(mp.monstruos), nom = azar(NOMBRES), ti = azar(TINTES);
    const p = cerca ? this.puntoCerca3d(cerca, zona) : { x: 0, z: 0 };
    const o = this.crearEspecial3d(k, p.x, p.z, { zona, nv: mp.nv[1], hpX: 6, atkX: 1.3, ex: { raro: 1, nom, ti }, expira: Date.now() + RARO3D_VIDA_MS });
    (W.raros || (W.raros = {}))[zona] = { id: o.id, prox: Date.now() + RARO3D_TIRADA_MS };
    for (const s of this.sesiones3d()) if (zonaEn(s.p.x, s.p.z) === zona) this.enviar(s, { t: 'aviso', m: `★ ¡${nom} (${MONSTRUOS[k].nombre} raro) ronda ${mp.nombre}! Objeto raro seguro para quien lo derrote.` });
    return o;
  },
  premioRaro3d(o) {
    const W = this.iniciar3d();
    (W.raros || (W.raros = {}))[o.mapa] = { id: 0, prox: Date.now() + RARO3D_REAPARECE_MS };
    const base = statsMonstruo(o.k, o.nv), nombres = [];
    for (const sid of o.dano.keys()) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || !s.m3) continue;
      const xp = base.xp * 4, oro = base.oro * 5;
      s.c.oro += oro;
      s.c.raros = (s.c.raros || 0) + 1;
      const it = this.darItem(s, this.generarItem(Math.min(o.nv, s.c.nivel), 1));   // nunca por encima de tu nivel: que se pueda equipar ya
      this.sumarXp(s, xp);
      this.progresoTarea && this.progresoTarea(s, 'raro');
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it });
      this.enviar(s, { t: 'toast', ok: true, m: `★ ${o.ex3.nom} derrotado: +${xp} XP · +${oro} oro · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}` });
      this.revisarLogros(s);
      this.yoLuego(s, true);
      nombres.push(s.c.nombre);
    }
    this.aClave(K3, { t: 'aviso', m: `★ ${o.ex3.nom} cayó${nombres.length ? ' ante ' + nombres.slice(0, 4).join(', ') : ''}.` });
  },

  // ── INVASIONES ──
  empezarInvasion3d(zona, porZona, ahora) {
    const W = this.iniciar3d(), mp = MAPAS[zona], n = Math.max(1, (porZona[zona] || []).length);
    W.inv3 = { id: (W.inv3n = (W.inv3n || 0) + 1), zona, nombre: INVASION[zona] || 'Invasión', inicio: ahora, fin: ahora + INV3D_DURA_MS,
      meta: clamp(10 + 6 * n, 12, 40), hechos: 0, fase: 'oleadas', oleadaEn: ahora, capitan: 0, part: new Set() };
    this.aClave(K3, { t: 'aviso', m: `⚔️ ${W.inv3.nombre} en ${mp.nombre}: derroten a ${W.inv3.meta} invasores en 5 minutos.` });
    this.aClave(K3, this.estadoInvasion3d());
    return W.inv3;
  },
  estadoInvasion3d() {
    const ev = this.iniciar3d().inv3;
    if (!ev) return { t: 'inv3', on: false };
    return { t: 'inv3', on: true, nombre: ev.nombre, zona: ev.zona, hechos: ev.hechos, meta: ev.meta, fase: ev.fase, ms: Math.max(0, ev.fin - Date.now()) };
  },
  tickInvasion3d(ev, ahora, jug) {
    if (ahora >= ev.fin) return this.terminarInvasion3d(false);
    if (ev.fase !== 'oleadas' || ahora < ev.oleadaEn) return;
    ev.oleadaEn = ahora + 6000;
    if (!jug.length) return;
    const W = this.iniciar3d(), mp = MAPAS[ev.zona];
    let vivos = 0;
    for (const o of W.mons.values()) if (o.ex3 && o.ex3.ev === ev.id && !o.muere) vivos++;
    const tope = Math.min(10, 3 + 2 * jug.length);
    const nv = clamp(Math.round(jug.reduce((a, s) => a + s.c.nivel, 0) / jug.length), mp.nv[0], mp.nv[1]);
    for (let i = Math.min(tope - vivos, 2 + Math.floor(Math.random() * 2)); i > 0; i--) {
      const p = this.puntoCerca3d(azar(jug), ev.zona);
      this.crearEspecial3d(azar(mp.monstruos), p.x, p.z, { zona: ev.zona, nv, hpX: 1.4, agresivo: true, ex: { ev: ev.id } });
    }
  },
  llegaCapitan3d(ev) {
    const mp = MAPAS[ev.zona], jug = this.sesiones3d().filter(s => !s.muerto && zonaEn(s.p.x, s.p.z) === ev.zona);
    const k = mp.monstruos[mp.monstruos.length - 1], n = Math.max(1, jug.length);
    const p = jug.length ? this.puntoCerca3d(azar(jug), ev.zona) : { x: 0, z: 0 };
    const o = this.crearEspecial3d(k, p.x, p.z, { zona: ev.zona, nv: mp.nv[1], hpX: 9 * (1 + 0.5 * (n - 1)), atkX: 1.25, agresivo: true, jefe: true, ex: { ev: ev.id, cap: 1, nom: 'Capitán ' + MONSTRUOS[k].nombre, ti: '#ff5a1f' } });
    ev.fase = 'capitan'; ev.capitan = o.id;
    this.aClave(K3, { t: 'aviso', m: `⚔️ ¡${o.ex3.nom} llega a ${mp.nombre}! Derrótalo para ganar la invasión.` });
    this.aClave(K3, this.estadoInvasion3d());
  },
  muereInvasor3d(o) {
    const ev = this.iniciar3d().inv3;
    if (!ev || o.ex3.ev !== ev.id) return;
    for (const sid of o.dano.keys()) { const s = this.sesiones.get(sid); if (s && s.c) ev.part.add(s.c.uid); }
    if (o.ex3.cap) return this.terminarInvasion3d(true);
    if (ev.fase !== 'oleadas') return;
    ev.hechos++;
    if (ev.hechos >= ev.meta) this.llegaCapitan3d(ev);
    else this.aClave(K3, this.estadoInvasion3d());
  },
  terminarInvasion3d(ganada) {
    const W = this.iniciar3d(), ev = W.inv3;
    if (!ev) return;
    W.inv3 = null;
    W.inv3prox = Date.now() + rnd(INV3D_CADA_MIN[0], INV3D_CADA_MIN[1]) * 60000;
    const mp = MAPAS[ev.zona];
    for (const o of [...W.mons.values()]) if (o.ex3 && o.ex3.ev === ev.id) { W.mons.delete(o.id); if (!o.muere) this.aClave(K3, { t: 'md3', id: o.id }); }
    if (!ganada) {
      this.aClave(K3, { t: 'aviso', m: `⌛ Los invasores se retiraron de ${mp.nombre}: la invasión terminó sin premio.` });
      this.aClave(K3, { t: 'inv3', on: false, fin: 'perdida' });
      return;
    }
    const nombres = [];
    for (const uid of ev.part) {
      const s = this.porUid.get(uid);
      if (!s || !s.c || s.cerrado) continue;
      const c = s.c, nv = clamp(c.nivel, mp.nv[0], mp.nv[1]);
      const xp = Math.round(xpParaSubir(nv) * 0.35), oro = Math.round(40 * nv * rnd(0.9, 1.1));
      c.oro += oro;
      c.invasiones = (c.invasiones || 0) + 1;
      const it = this.darItem(s, this.generarItem(nv, 1));
      this.sumarXp(s, xp);
      this.progresoTarea && this.progresoTarea(s, 'invasion');
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it });
      this.enviar(s, { t: 'toast', ok: true, m: `⚔️ Invasión rechazada: +${xp} XP · +${oro} oro · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}` });
      this.revisarLogros(s);
      this.yoLuego(s, true);
      nombres.push(c.nombre);
    }
    this.aClave(K3, { t: 'aviso', m: `${ev.nombre} rechazada en ${mp.nombre}. Héroes: ${nombres.slice(0, 6).join(', ') || '—'}.` });
    this.aClave(K3, { t: 'inv3', on: false, fin: 'ganada' });
  },

  // ── COFRES ──
  infoCofres3d(c) {
    const ahora = Date.now(), m = c.cofres3 || {};
    return cofres3d(MAPAS, MONSTRUOS).map(x => Math.max(0, (m[x.i] || 0) + COFRE_CADA_MS - ahora));
  },
  abrirCofre3d(s, m) {
    if (s.muerto || s.i3) return;
    const cf = cofres3d(MAPAS, MONSTRUOS)[m.id | 0];
    if (!cf || typeof m.id !== 'number') return;
    if (dist(s.p, cf) > COFRE3D_DIST + 1) return this.no(s, 'Acércate más al cofre.');
    const c = s.c, ahora = Date.now();
    c.cofres3 = c.cofres3 || {};
    const t = c.cofres3[cf.i] || 0;
    if (ahora - t < COFRE_CADA_MS) return this.no(s, `Ya abriste este cofre. Vuelve a tener tesoro en ${Math.ceil((t + COFRE_CADA_MS - ahora) / 60000)} min.`);
    for (const k in c.cofres3) if (ahora - c.cofres3[k] >= COFRE_CADA_MS) delete c.cofres3[k];
    c.cofres3[cf.i] = ahora;
    const T = COFRE_TIPOS[cf.tipo], nvZ = (MAPAS[cf.zona].nv[0] + MAPAS[cf.zona].nv[1]) / 2;
    const X = COFRE3D_X[cf.tipo];
    const oro = Math.max(1, Math.round(nvZ * T.oro * X.oro * rnd(0.85, 1.15)));
    c.oro += oro;
    let pociones = 0;
    if (Math.random() < T.pocion) { pociones = T.pociones; c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pociones); }
    let item = null;
    if (Math.random() < X.equipo) { const nv = MAPAS[cf.zona].nv; item = this.darItem(s, this.generarItem(clamp(c.nivel, nv[0], nv[1]), T.r)); }
    c.cofresAbiertos = (c.cofresAbiertos || 0) + 1;
    this.progresoTarea && this.progresoTarea(s, 'cofre');
    this.enviar(s, { t: 'cofre3A', id: cf.i, ms: COFRE_CADA_MS, oro, pociones, item: item ? nombreItem(item) : null, tipo: cf.tipo });
    this.revisarLogros(s);
    this.yoLuego(s, true);
    return this.guardar(s);
  },
};
