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
import { MAPAS, MONSTRUOS, RAREZAS, statsMonstruo, xpParaSubir, nombreItem, MISIONES, AFIJOS } from '../../mmo/js/data.js';
import { zonaEn, cofres3d, COFRE3D_DIST, alturaEn, MUNDO } from '../../mmo/js/mundo3d.js';
import { COFRE_TIPOS, COFRE_CADA_MS, cuentaCofreDia, AVISO_COFRES_DIA } from './eventos.js';
// Los cofres del 3D estan escondidos (hay que explorar y, el legendario, volar
// hasta lo alto): pagan mas que los del 2D y el legendario siempre trae equipo.
const COFRE3D_X = { comun: { oro: 3, equipo: 0.15 }, epico: { oro: 4, equipo: 0.4 }, legendario: { oro: 5, equipo: 1 } };

const K3 = '~3d';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const azar = l => l[Math.floor(Math.random() * l.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const RARO3D_TIRADA_MS = 60 * 1000, RARO3D_PROB = 0.15, RARO3D_REAPARECE_MS = 15 * 60 * 1000, RARO3D_VIDA_MS = 15 * 60 * 1000;
export const INV3D_CADA_MIN = [14, 18], INV3D_DURA_MS = 5 * 60 * 1000, INV3D_AVISO_MS = 90 * 1000, BENDITA_MS = 15 * 60 * 1000;
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
    for (const o of W.mons.values()) if (o.expira && ahora > o.expira && !o.muere && !o.obj) { W.mons.delete(o.id); this.aClave(K3, { t: 'md3', id: o.id, huye: 1 }); if (o.ex3 && o.ex3.raro) (W.raros || (W.raros = {}))[o.mapa] = { id: 0, prox: ahora + RARO3D_REAPARECE_MS }; }
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
    // Gran Invasion diaria a las 21:00 de Lima (UTC-5): cita fija de la comunidad, meta x1,5.
    const lima = new Date(ahora - 5 * 3600e3), lh = lima.getUTCHours(), lm = lima.getUTCMinutes(), hoyL = lima.toISOString().slice(0, 10);
    const m21 = Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate(), 21) + 5 * 3600e3;   // 21:00 Lima en ms reales
    if (!ev && (lh === 20 && lm >= 57 || lh === 21 && lm < 30) && W.granHoy !== hoyL) {   // hasta 21:29 por si otra invasion seguia en pie a las 20:57
      W.granHoy = hoyL; W.granProx = 1; W.inv3prox = Math.max(m21, ahora + 60000);
      if (W.inv3pre) { W.inv3pre = null; this.aClave(K3, { t: 'inv3', on: false, pre: 0 }); }   // unos tambores sueltos ceden su sitio a la Gran Invasion
    } else if (W.granProx && !ev && !W.inv3pre) {
      if (lh === 21 || (lh === 20 && lm >= 57)) W.inv3prox = Math.min(W.inv3prox, Math.max(m21, ahora + 60000));   // si la reiniciaron, vuelve a su hora
      else W.granProx = 0;   // paso la hora sin nadie: mañana sera
    } else if (!ev && !W.inv3pre && !W.granProx && W.inv3prox > m21 - 15 * 60000 && W.inv3prox < m21 + 15 * 60000) {
      W.inv3prox = m21 + 15 * 60000 + rnd(0, 3) * 60000;   // las aleatorias no caen entre 20:45 y 21:15
    }
    if (ev) this.tickInvasion3d(ev, ahora, porZona[ev.zona] || []);
    else if (!W.inv3pre && W.inv3prox - ahora <= INV3D_AVISO_MS) {
      // Aviso previo: 1:30 antes ya se sabe donde sera (tambores), para que la gente llegue.
      let zona = this.zonaInvasion3d(porZona);
      // La Gran de las 21:00 no se pierde si todos esperan en el pueblo: va al Bosque Nocturno (Nv 1-6).
      if (!zona && W.granProx && jugadores.some(s => !s.i3 && !s.muerto)) zona = 'noche';
      if (zona) this.avisarInvasion3d(zona, ahora);
      else W.inv3prox = Math.max(W.inv3prox, ahora + 60000);
    } else if (W.inv3pre && ahora >= W.inv3prox) {
      let zona = W.inv3pre.zona;
      if (!(porZona[zona] || []).length) {
        // Nadie fue a la zona anunciada: los tambores se mueven a donde hay gente (o se aplaza).
        const otra = this.zonaInvasion3d(porZona);
        if (otra && otra !== zona) { zona = otra; this.aClave(K3, { t: 'aviso', m: `🥁 Los tambores se movieron a ${(MAPAS[zona] || {}).nombre || zona}` }); }
        else if (!W.inv3pre.gran) zona = null;   // la Gran empieza igual en la zona anunciada: la gente llega en camino
      }
      if (zona) this.empezarInvasion3d(zona, porZona, ahora);
      else if ((W.inv3pre.apl = (W.inv3pre.apl || 0) + 1) <= 4) {
        // Sin nadie en ningun lado: se aplaza 30 s (hasta 4 veces) y el contador del cliente se actualiza.
        W.inv3prox = ahora + 30000; W.inv3pre.en = W.inv3prox; this.aClave(K3, this.estadoInvasion3d());
      } else { W.inv3pre = null; W.inv3prox = ahora + 60000; this.aClave(K3, { t: 'inv3', on: false, pre: 0 }); }
    }
  },
  // La zona con mas gente (abierta y con monstruos).
  zonaInvasion3d(porZona) {
    const zonas = Object.keys(porZona);
    return zonas.length ? zonas.sort((a, b) => porZona[b].length - porZona[a].length)[0] : null;
  },
  avisarInvasion3d(zona, ahora) {
    const W = this.iniciar3d(), mp = MAPAS[zona];
    W.inv3prox = Math.max(W.inv3prox, ahora + INV3D_AVISO_MS);   // siempre 1:30 de aviso real
    W.inv3pre = { zona, en: W.inv3prox, gran: W.granProx ? 1 : 0 };
    this.aClave(K3, { t: 'aviso', m: W.granProx ? '🥁 ¡GRAN INVASIÓN de las 21:00! Todos a defender ' + mp.nombre : `🥁 Se oyen tambores en ${mp.nombre}: invasión en 1:30` });
    this.aClave(K3, this.estadoInvasion3d());
  },
  // Zona Bendecida tras ganar una invasion: +10 % de XP de caza un rato.
  zonaBendita3d(zona) {
    const e = (this.iniciar3d().zonaEstado || {})[zona];
    return !!(e && e.tipo === 'bendita' && Date.now() < e.hasta);
  },
  benditas3d() {
    const r = {}, ze = this.iniciar3d().zonaEstado || {}, ahora = Date.now();
    for (const z in ze) if (ze[z].tipo === 'bendita' && ze[z].hasta > ahora) r[z] = ze[z].hasta - ahora;
    return r;
  },

  // ── ELITES RAROS ──
  crearRaro3d(zona, cerca) {
    const W = this.iniciar3d(), mp = MAPAS[zona];
    const k = azar(mp.monstruos), nom = azar(NOMBRES), ti = azar(TINTES);
    const p = cerca ? this.puntoCerca3d(cerca, zona) : { x: 0, z: 0 };
    // Afijo visible: furioso (pega +50 % bajo el 30 % de vida) o sanguinario (se cura al caer sus esbirros).
    const af = azar(['furioso', 'sanguinario']), expira = Date.now() + RARO3D_VIDA_MS;
    const o = this.crearEspecial3d(k, p.x, p.z, { zona, nv: mp.nv[1], hpX: 6, atkX: 1.3, ex: { raro: 1, nom, ti, af }, expira });
    // Dos esbirros normales de su misma especie a su lado (caducan con el).
    for (const lado of [-1, 1]) this.crearEspecial3d(k, p.x + lado * 3, p.z + lado * 1.5, { zona, nv: mp.nv[1], ex: { esb: o.id }, expira });
    (W.raros || (W.raros = {}))[zona] = { id: o.id, prox: Date.now() + RARO3D_TIRADA_MS };
    for (const s of this.sesiones3d()) if (zonaEn(s.p.x, s.p.z) === zona) this.enviar(s, { t: 'aviso', m: `★ ¡${nom} (${MONSTRUOS[k].nombre} raro) ronda ${mp.nombre} con dos esbirros · ${AFIJOS[af].emoji} ${AFIJOS[af].nombre}! Objeto raro seguro para quien lo derrote.` });
    return o;
  },
  premioRaro3d(o) {
    const W = this.iniciar3d();
    (W.raros || (W.raros = {}))[o.mapa] = { id: 0, prox: Date.now() + RARO3D_REAPARECE_MS };
    const base = statsMonstruo(o.k, o.nv), nombres = [];
    // Quien pego o curo a quien lo peleaba (como en el 2D): el sanador del grupo tambien cobra.
    // Solo quien ayudo de verdad (10 % del daño o una cura que se note) y sigue cerca: un golpe suelto no cobra.
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const quienes = new Set([...o.dano.keys(), ...(o.cura ? o.cura.keys() : [])]);
    for (const sid of quienes) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || !s.m3) continue;
      if ((o.dano.get(sid) || 0) < total * 0.1 && !((o.cura && o.cura.get(sid)) >= (o.max || 1) * 0.05)) continue;
      if (dist(s.p, o) > 80) continue;
      // Tambien cuenta para la mision de la cadena si es el monstruo que pide.
      const q = MISIONES[s.c.mis.i];
      if (q && o.k === q.tipo && s.c.mis.p < q.n) { s.c.mis.p++; if (s.c.mis.p === q.n) this.mision(s, null, true); }
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
    W.inv3pre = null;
    const gran = W.granProx ? 1 : 0;   // Gran Invasion de las 21:00: mas invasores (x1,5) y el Capitan al final, mismos premios base
    W.granProx = 0;
    W.inv3 = { id: (W.inv3n = (W.inv3n || 0) + 1), zona, nombre: (gran ? 'GRAN ' : '') + (INVASION[zona] || 'Invasión'), inicio: ahora, fin: ahora + INV3D_DURA_MS,
      meta: Math.round(clamp(10 + 6 * n, 12, 40) * (gran ? 1.5 : 1)), hechos: 0, fase: 'oleadas', oleadaEn: ahora, capitan: 0, part: new Map(), gran };
    this.aClave(K3, { t: 'aviso', m: `⚔️ ${W.inv3.nombre} en ${mp.nombre}: derroten a ${W.inv3.meta} invasores en 5 minutos.` });
    this.aClave(K3, this.estadoInvasion3d());
    return W.inv3;
  },
  estadoInvasion3d() {
    const W = this.iniciar3d(), ev = W.inv3;
    if (!ev && W.inv3pre) return { t: 'inv3', on: false, pre: 1, zona: W.inv3pre.zona, gran: W.inv3pre.gran || 0, ms: Math.max(0, W.inv3pre.en - Date.now()), bend: this.benditas3d() };
    if (!ev) return { t: 'inv3', on: false, bend: this.benditas3d() };
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
    // Sin nadie vivo en la zona (el ultimo invasor cayo al otro lado del borde,
    // o por un Dolor tras morir): en el campamento de la zona mas cercano al
    // pueblo (no en el del jefe). Antes salia en (0, 0), en medio del pueblo.
    const cp = jug.length ? null : this.iniciar3d().campos.find(c => c.zona === ev.zona && !c.jefe);
    const p = jug.length ? this.puntoCerca3d(azar(jug), ev.zona) : cp ? { x: cp.x, z: cp.z } : { x: 0, z: 0 };
    const o = this.crearEspecial3d(k, p.x, p.z, { zona: ev.zona, nv: mp.nv[1], hpX: 9 * (1 + 0.5 * (n - 1)), atkX: 1.25, agresivo: true, jefe: true, ex: { ev: ev.id, cap: 1, nom: 'Capitán ' + MONSTRUOS[k].nombre, ti: '#ff5a1f' } });
    ev.fase = 'capitan'; ev.capitan = o.id;
    ev.fin = Math.max(ev.fin, Date.now() + 3 * 60000);   // al menos 3 minutos para el Capitan
    this.aClave(K3, { t: 'aviso', m: `⚔️ ¡${o.ex3.nom} llega a ${mp.nombre}! Derrótalo para ganar la invasión.` });
    this.aClave(K3, this.estadoInvasion3d());
  },
  muereInvasor3d(o) {
    const ev = this.iniciar3d().inv3;
    if (!ev || o.ex3.ev !== ev.id) return;
    // Pegar o curar a quien pelea cuenta (como en el 2D): el sanador del grupo tambien cobra.
    // Se cuenta en cuantos invasores ayudo cada uno (el capitan vale 3): un golpe suelto no cobra.
    // Con el Capitan solo cuenta quien le hizo el 10 % del daño o curo de verdad (un golpe suelto no).
    // Umbral escalado: con muchos pegando al Capitan el 10 % es imposible; baja a 50 % / pegadores (tope 10 %).
    const ayudo = new Set(), totalD = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const nPel = [...o.dano.values()].filter(v => v > 0).length, umbCap = totalD * Math.min(0.1, 0.5 / Math.max(1, nPel));
    for (const m of [o.dano, o.cura]) if (m) for (const [sid, v] of m) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c) continue;
      if (o.ex3.cap && !(m === o.dano ? v >= umbCap : v >= o.max * 0.03)) continue;
      // En los normales tambien hace falta ayudar de verdad (Dolor sumaba 1 sin daño real).
      if (!o.ex3.cap && !(m === o.dano ? v >= Math.min(totalD * 0.1, (o.max || 1) * 0.03) : v >= (o.max || 1) * 0.03)) continue;
      ayudo.add(s.c.uid);
    }
    for (const uid of ayudo) ev.part.set(uid, (ev.part.get(uid) || 0) + (o.ex3.cap ? 3 : 1));
    if (o.ex3.cap) return this.terminarInvasion3d(true);
    if (ev.fase !== 'oleadas') return;
    ev.hechos++;
    if (ev.hechos >= ev.meta) this.llegaCapitan3d(ev);
    else this.aClave(K3, this.estadoInvasion3d());
  },
  // Premio base de una invasion con tu nivel (tope el de la zona).
  premioBaseInv3d(c, mp) {
    const nv = Math.min(c.nivel, mp.nv[1]);
    return { xp0: Math.round(xpParaSubir(nv) * 0.35), oro0: Math.round(40 * nv * rnd(0.9, 1.1)) };
  },
  terminarInvasion3d(ganada) {
    const W = this.iniciar3d(), ev = W.inv3;
    if (!ev) return;
    W.inv3 = null;
    W.inv3prox = Date.now() + rnd(INV3D_CADA_MIN[0], INV3D_CADA_MIN[1]) * 60000;
    const mp = MAPAS[ev.zona];
    for (const o of [...W.mons.values()]) if (o.ex3 && o.ex3.ev === ev.id) { W.mons.delete(o.id); if (!o.muere) this.aClave(K3, { t: 'md3', id: o.id, huye: 1 }); }
    if (!ganada) {
      // Gran Invasion perdida: premio consuelo (25 % de XP y oro, sin objeto) a quien ayudo y sigue en ORIGINS en la zona.
      if (ev.gran) for (const [uid, n] of ev.part) {
        if (!(n >= 1)) continue;
        const s = this.porUid.get(uid);
        if (!s || !s.c || s.cerrado || !s.m3 || zonaEn(s.p.x, s.p.z) !== ev.zona) continue;
        const b = this.premioBaseInv3d(s.c, mp), xp = Math.round(b.xp0 * 0.25), oro = Math.round(b.oro0 * 0.25);
        s.c.oro += oro;
        this.sumarXp(s, xp);
        s.sucio = true;
        this.enviar(s, { t: 'gana', xp, oro, drops: [], item: null, med: 'b' });
        this.enviar(s, { t: 'toast', ok: true, m: `🥉 Resististe la Gran Invasión: +${xp} XP +${oro} oro · mañana a las 21:00 otra vez` });
        this.revisarLogros(s);
        this.yoLuego(s, true);
      }
      this.aClave(K3, { t: 'aviso', m: ev.gran ? `⌛ La Gran Invasión se retiró de ${mp.nombre} sin caer su Capitán: quien ayudó se lleva un premio consuelo · mañana a las 21:00 otra vez.` : `⌛ Los invasores se retiraron de ${mp.nombre}: la invasión terminó sin premio.` });
      this.aClave(K3, { t: 'inv3', on: false, fin: 'perdida' });
      return;
    }
    // Medallas por aporte (ya no es todo o nada): bronce 1-2 = mitad de XP y oro sin objeto; plata 3-5 = premio
    // de siempre; oro 6+ (o top 3 con al menos plata) = premio + 25 % de oro. 0 aportes: sin premio.
    const orden = [...ev.part].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const top3 = new Set(orden.slice(0, 3).map(([uid]) => uid)), nDef = orden.length;
    // Si antes toca la Gran Invasion de las 21:00 (Lima), esa es la proxima de verdad (las aleatorias no caen entre 20:45 y 21:15).
    const lim = new Date(Date.now() - 5 * 3600e3), m21f = Date.UTC(lim.getUTCFullYear(), lim.getUTCMonth(), lim.getUTCDate(), 21) + 5 * 3600e3;
    const proxT = W.granHoy !== lim.toISOString().slice(0, 10) && Date.now() < m21f && W.inv3prox > m21f - 15 * 60000 ? m21f : W.inv3prox;
    const prox = proxT ? Math.max(1, Math.ceil((proxT - Date.now()) / 60000)) : 0;
    for (const [uid, n] of orden) {
      const s = this.porUid.get(uid);
      if (!s || !s.c || s.cerrado) continue;
      // Solo cobra quien sigue en ORIGINS y en la zona de la invasion.
      if (!s.m3 || zonaEn(s.p.x, s.p.z) !== ev.zona) continue;
      const med = n >= 6 || (n >= 3 && top3.has(uid)) ? 'o' : n >= 3 ? 'p' : 'b';
      // Con tu nivel (tope el de la zona): uno de nivel 1 no cobra la XP de una zona de nivel 40.
      const c = s.c, nv = Math.min(c.nivel, mp.nv[1]);
      const { xp0, oro0 } = this.premioBaseInv3d(c, mp);
      const xp = med === 'b' ? Math.round(xp0 * 0.5) : xp0, oro = med === 'b' ? Math.round(oro0 * 0.5) : med === 'o' ? Math.round(oro0 * 1.25) : oro0;
      c.oro += oro;
      let it = null;
      if (med !== 'b') {
        c.invasiones = (c.invasiones || 0) + 1;
        it = this.darItem(s, this.generarItem(nv, 1));
        this.progresoTarea && this.progresoTarea(s, 'invasion');
      }
      this.sumarXp(s, xp);
      s.sucio = true;
      const ico = { b: '🥉', p: '🥈', o: '🥇' }[med], nomM = { b: 'bronce', p: 'plata', o: 'oro' }[med];
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it, med });
      this.enviar(s, { t: 'toast', ok: true, med, inv: { n: nDef, med, prox }, m: `${ico} Aporte ${nomM}: +${xp} XP +${oro} oro${it ? ` · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}` : ' · Ayuda contra 3 invasores para la plata'}` });
      this.revisarLogros(s);
      this.yoLuego(s, true);
    }
    const topTxt = orden.slice(0, 3).map(([uid, n]) => { const s = this.porUid.get(uid); return s && s.c ? `${s.c.nombre} (${n})` : null; }).filter(Boolean).join(' · ');
    (W.zonaEstado || (W.zonaEstado = {}))[ev.zona] = { tipo: 'bendita', hasta: Date.now() + BENDITA_MS };
    this.aClave(K3, { t: 'aviso', prox, m: `${ev.nombre} rechazada. 🏆 Top: ${topTxt || '—'} · ${nDef} duende${nDef === 1 ? '' : 's'} defendieron ${mp.nombre}. La zona queda Bendecida 15 min: +10% XP al cazar${prox ? ` · Próxima invasión en ~${prox} min` : ''}` });
    this.aClave(K3, { t: 'inv3', on: false, fin: 'ganada', zona: ev.zona, bend: this.benditas3d(), n: nDef, prox });
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
    // Paga segun TU nivel (tope el de la zona): un Nv 1 con alas no saca el tesoro de una zona Nv 55.
    const nvJ = c.nivel || 1, nvP = Math.min(nvZ, nvJ + 3), nvMin = MAPAS[cf.zona].nv[0];
    const bajo = nvJ < nvMin - 5;
    const lleno = cuentaCofreDia(c);
    const oro = Math.max(1, Math.round(nvP * T.oro * X.oro * rnd(0.85, 1.15) * (bajo ? 0.3 : 1) * (lleno ? 1 : 0.2)));
    c.oro += oro;
    let pociones = 0;
    if (lleno && Math.random() < T.pocion) { pociones = T.pociones; c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pociones); }
    let item = null;
    // Rareza minima segun el cofre 3D: el epico suelta Raro o mas y el legendario Epico o mas (muy bajo para la zona: la de siempre).
    const rMin3 = bajo ? T.r : ({ comun: 0, epico: 1, legendario: 2 }[cf.tipo] ?? T.r);
    if (lleno && Math.random() < X.equipo) { const nv = MAPAS[cf.zona].nv; item = this.darItem(s, this.generarItem(Math.min(nvJ, nv[1]), rMin3)); }
    c.cofresAbiertos = (c.cofresAbiertos || 0) + 1;
    this.progresoTarea && this.progresoTarea(s, 'cofre');
    this.enviar(s, { t: 'cofre3A', id: cf.i, ms: COFRE_CADA_MS, oro, pociones, item: item ? { r: item.r, nombre: nombreItem(item), id: item.id, s: item.s, nv: item.nv, b: item.b, cj: item.cj, vendido: item.vendido } : null, tipo: cf.tipo });
    if (bajo) this.enviar(s, { t: 'toast', m: `🧰 Este cofre es de una zona de nivel ${nvMin}: vuelve cuando seas más fuerte para el tesoro completo.` });
    if (!lleno && !c.cofresDia.avisado) { c.cofresDia.avisado = 1; this.enviar(s, { t: 'toast', m: AVISO_COFRES_DIA }); }
    this.revisarLogros(s);
    this.yoLuego(s, true);
    return this.guardar(s);
  },
};
