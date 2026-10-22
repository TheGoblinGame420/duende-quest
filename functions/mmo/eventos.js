// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — contenido de mundo abierto
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Tres cosas para que salir del pueblo tenga sorpresas, como en WoW:
//  1. INVASIONES: cada 12-15 min, en una zona abierta con gente, llegan
//     oleadas de monstruos agresivos y al final un Capitan. Meta compartida
//     ("derrotad N invasores") que escala con los presentes; si se cumple a
//     tiempo, todos los que pegaron o curaron a los invasores cobran.
//  2. ELITES RAROS: de vez en cuando aparece en una zona un monstruo con
//     nombre propio y tinte dorado/plateado. Suelta un objeto raro o mejor
//     seguro a cada uno que lo peleo.
//  3. COFRES: 3 por zona en sitios fijos (lo alto de las plataformas y el
//     fondo del mapa). Cada jugador abre cada uno una vez cada 30 min.
//
// Lo que da premio lo decide SIEMPRE el servidor. NADA de esto da mTON: ese
// dinero sale de un fondo limitado y sumar fuentes se habla antes con el dueño.
//
// CPU: todo cuelga del tick (que solo corre con jugadores) y solo mira las
// zonas que tienen gente; nada recorre el storage.
// ═══════════════════════════════════════════════════════
import { MAPAS, MONSTRUOS, SUELO, RAREZAS, statsMonstruo, xpParaSubir, nombreItem } from '../../mmo/js/data.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const azar = l => l[Math.floor(Math.random() * l.length)];

export const EVENTO_DURA_MS = 5 * 60 * 1000;
export const EVENTO_CADA_MIN = [12, 15];          // minutos entre invasiones
const EVENTO_REINTENTO_MS = 60 * 1000;            // si toco y nadie estaba en una zona
const OLEADA_CADA_MS = 6000;
export const RARO_PRIMERO_MIN = [3, 8];           // primera oportunidad tras llegar gente
export const RARO_TIRADA_MS = 60 * 1000;          // una tirada por minuto...
export const RARO_PROB = 0.12;                    // ...con esta probabilidad
export const RARO_REAPARECE_MS = 20 * 60 * 1000;  // tras morir, nada en 20 min
export const COFRE_CADA_MS = 30 * 60 * 1000;
export const COFRE_DIST = 70;

// Nombre de la invasion segun el bestiario de cada zona.
const INVASION = {
  noche: 'Invasión de no muertos', amanecer: 'Invasión goblin', selva: 'Invasión de la selva',
  tormenta: 'Invasión arcana', desierto: 'Invasión del desierto', castillo: 'Asalto de la corte',
  cumbres: 'Invasión del ocaso', cavernas: 'Invasión abisal', abismo: 'Marea abisal', acantilados: 'Tormenta mágica',
};
// Nombres propios de los raros (de ellos vive que valga la pena perseguirlos).
const NOMBRES_RARO = ['Ojoplata', 'Zarpadorada', 'Grishnak el Viejo', 'Morgra', 'Colmillo de Oro', 'Vorgath', 'Lunargenta',
  'Skarn el Errante', 'Brasaviva', 'Ulmo Sombrío', 'Kragga', 'Nébula', 'Torvo Dientefrío', 'Rengo el Codicioso'];
const TINTE_RARO = ['#ffd84a', '#e5e7eb'];       // dorado o plateado

// Premios de cada tipo de cofre: oro = nivel medio de la zona x oro, y
// probabilidades de pocion y de equipo (r = rareza minima).
export const COFRE_TIPOS = {
  comun:      { oro: 8,  pocion: 0.2, pociones: 1, equipo: 0.03, r: 0 },
  epico:      { oro: 15, pocion: 0.4, pociones: 2, equipo: 0.07, r: 0 },
  legendario: { oro: 25, pocion: 0.6, pociones: 2, equipo: 0.12, r: 1 },
};

// Zonas donde pasa todo esto: las abiertas con monstruos (ni el pueblo, ni
// el Coliseo, ni las mazmorras).
export function esZonaAbierta(id) {
  const m = MAPAS[id];
  return !!(m && m.zona && !m.instancia && !m.coliseo && m.monstruos && m.monstruos.length);
}

// Cofres de una zona, siempre en el mismo sitio (el cliente los recibe del
// servidor, asi no hay que tocar data.js): el legendario en la plataforma
// mas alta, el epico en la plataforma mas lejana a esa, y el comun en el
// suelo al fondo del mapa (antes del portal de salida).
const _cofres = {};
export function cofresDe(id) {
  if (_cofres[id]) return _cofres[id];
  const l = [];
  if (esZonaAbierta(id)) {
    const m = MAPAS[id];
    const pl = [...m.plataformas].sort((a, b) => a[1] - b[1]);
    const alta = pl[0];
    const cx = p => p[0] + p[2] / 2;
    l.push({ i: 0, x: Math.round(cx(alta)), y: alta[1], tipo: 'legendario' });
    const lejos = pl.slice(1).sort((a, b) => Math.abs(cx(b) - cx(alta)) - Math.abs(cx(a) - cx(alta)))[0];
    if (lejos) l.push({ i: 1, x: Math.round(cx(lejos)), y: lejos[1], tipo: 'epico' });
    l.push({ i: l.length, x: m.ancho - 170, y: SUELO, tipo: 'comun' });
  }
  return (_cofres[id] = l);
}

const nivelZona = id => { const nv = MAPAS[id].nv; return (nv[0] + nv[1]) / 2; };

export const Eventos = {
  // ── CADA TICK ──
  // porClave: jugadores por mundo vivo (lo arma tick()).
  tickEventos(ahora, porClave) {
    if (!this.proxEvento) this.proxEvento = ahora + rnd(EVENTO_CADA_MIN[0], EVENTO_CADA_MIN[1]) * 60000;
    const ev = this.evento;
    if (ev) this.tickInvasion(ev, ahora, porClave);
    else if (ahora >= this.proxEvento) {
      const zonas = Object.keys(porClave).filter(k => esZonaAbierta(k) && porClave[k].length);
      if (zonas.length) this.empezarEvento(azar(zonas), ahora);
      else this.proxEvento = ahora + EVENTO_REINTENTO_MS;
    }
    for (const k in porClave) if (esZonaAbierta(k)) this.tickRaro(k, ahora);
  },

  // ── INVASIONES ──
  empezarEvento(mapaId, ahora) {
    ahora = ahora || Date.now();
    if (this.evento || !esZonaAbierta(mapaId)) return null;
    const mp = MAPAS[mapaId];
    const n = Math.max(1, this.presentesEn(mapaId).length);
    this.sigEvento = (this.sigEvento || 0) + 1;
    const ev = this.evento = {
      id: this.sigEvento, mapa: mapaId, nombre: INVASION[mapaId] || 'Invasión',
      inicio: ahora, fin: ahora + EVENTO_DURA_MS, n,
      // Solo: 20 invasores; cada jugador mas suma 8 (hasta 60).
      meta: clamp(12 + 8 * n, 20, 60), hechos: 0, fase: 'oleadas', oleadaEn: ahora,
      capitan: 0, part: new Set(),
    };
    this.aTodos({ t: 'aviso', m: `🔥 ¡${ev.nombre} en ${mp.nombre}! Derrotad ${ev.meta} invasores en 5 minutos.` });
    this.aTodos(this.estadoEvento());
    return ev;
  },

  presentesEn(clave) {
    const r = [];
    for (const s of this.sesiones.values()) if (s.c && s.k === clave && !s.cerrado) r.push(s);
    return r;
  },

  estadoEvento() {
    const ev = this.evento;
    if (!ev) return { t: 'ev', on: false };
    return { t: 'ev', on: true, id: ev.id, mapa: ev.mapa, nombre: ev.nombre, ms: Math.max(0, ev.fin - Date.now()), meta: ev.meta, hechos: ev.hechos, fase: ev.fase };
  },

  tickInvasion(ev, ahora, porClave) {
    if (ahora >= ev.fin) return this.terminarEvento(false);
    if (ev.fase !== 'oleadas' || ahora < ev.oleadaEn) return;
    ev.oleadaEn = ahora + OLEADA_CADA_MS;
    const jug = (porClave[ev.mapa] || []).filter(s => !s.muerto);
    if (!jug.length) return;
    const w = this.mundoK(ev.mapa);
    let vivos = 0;
    for (const o of w.mons.values()) if (o.ex && o.ex.ev === ev.id && !o.muere) vivos++;
    const tope = Math.min(10, 3 + 2 * jug.length);
    const mp = MAPAS[ev.mapa];
    // Del nivel de quienes estan (dentro del tramo de la zona): asi un grupo
    // de nivel bajo no se encuentra con lo mas duro del fondo del mapa.
    const nv = clamp(Math.round(jug.reduce((a, s) => a + s.c.nivel, 0) / jug.length), mp.nv[0], mp.nv[1]);
    const hpX = 1.5 * (1 + 0.1 * (jug.length - 1));
    // Llegan cerca de alguien (si no, la zona es grande y nadie los ve).
    for (let i = Math.min(tope - vivos, 2 + Math.floor(Math.random() * 2)); i > 0; i--) {
      const s = azar(jug);
      const x = clamp(s.x + (Math.random() < 0.5 ? -1 : 1) * rnd(260, 450), 200, mp.ancho - 200);
      this.crearMonstruo(ev.mapa, azar(mp.monstruos), x, { nv, hpX, agresivo: true, radioAgro: 320, ex: { ev: ev.id } });
    }
  },

  // Quien peleo contra un invasor (pego o curo a quien lo peleaba) entra en
  // la lista del evento. Se guarda por uid: si se reconecta no lo pierde.
  anotarParticipantes(ev, o) {
    for (const m of [o.dano, o.cura]) {
      if (!m) continue;
      for (const sid of m.keys()) { const s = this.sesiones.get(sid); if (s && s.c) ev.part.add(s.c.uid); }
    }
  },

  llegaCapitan(ev) {
    const mp = MAPAS[ev.mapa];
    const jug = this.presentesEn(ev.mapa).filter(s => !s.muerto);
    const n = Math.max(1, jug.length);
    const k = mp.monstruos[mp.monstruos.length - 1];
    const nom = 'Capitán ' + MONSTRUOS[k].nombre;
    const cerca = jug.length ? azar(jug).x : mp.ancho / 2;
    const x = clamp(cerca + (Math.random() < 0.5 ? -1 : 1) * 380, 200, mp.ancho - 200);
    const o = this.crearMonstruo(ev.mapa, k, x, {
      nv: mp.nv[1], hpX: 12 * (1 + 0.6 * (n - 1)), atkX: 1.3, agresivo: true, radioAgro: 450,
      ex: { ev: ev.id, cap: 1, nom, ti: '#ff5a1f' },
    });
    ev.fase = 'capitan';
    ev.capitan = o.id;
    this.aClave(ev.mapa, { t: 'emote', m: `⚔️ ¡${nom} llega para vengar a los suyos! Derrótalo para ganar la invasión.` });
    this.aTodos(this.estadoEvento());
  },

  terminarEvento(ganado) {
    const ev = this.evento;
    if (!ev) return;
    this.evento = null;
    this.proxEvento = Date.now() + rnd(EVENTO_CADA_MIN[0], EVENTO_CADA_MIN[1]) * 60000;
    const mp = MAPAS[ev.mapa];
    const w = this.mundoK(ev.mapa);
    // Los invasores que quedan se retiran (sin premio: no pasan por matar()).
    for (const o of [...w.mons.values()]) {
      if (!o.ex || o.ex.ev !== ev.id) continue;
      if (ganado) this.anotarParticipantes(ev, o);
      w.mons.delete(o.id);
      if (!o.muere) this.aClave(ev.mapa, { t: 'md', id: o.id, pr: [] });
    }
    if (!ganado) {
      this.aTodos({ t: 'aviso', m: `⌛ Los invasores se retiraron de ${mp.nombre}: la invasión terminó sin premio.` });
      this.aTodos({ t: 'ev', on: false, fin: 'perdida', mapa: ev.mapa });
      return;
    }
    const nombres = [];
    for (const uid of ev.part) {
      const s = this.porUid.get(uid);
      if (!s || !s.c || s.cerrado) continue;
      const c = s.c;
      // Premio con el nivel de la zona (tope: el tuyo): un Nv 60 ayudando en
      // el Bosque no se lleva el equipo ni la XP de su nivel.
      const nv = clamp(c.nivel, mp.nv[0], mp.nv[1]);
      const xp = Math.round(xpParaSubir(nv) * 0.35);
      const oro = Math.round(40 * nv * rnd(0.9, 1.1));
      c.oro += oro;
      c.invasiones = (c.invasiones || 0) + 1;
      const it = this.darItem(s, this.generarItem(nv, 1));
      this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it, x: Math.round(s.x), y: Math.round(s.y - 80) });
      this.enviar(s, { t: 'toast', m: `🏆 ¡Invasión rechazada! +${xp} XP · +${oro} oro · ${RAREZAS[it.r].nombre}: ${nombreItem(it)}`, ok: true });
      this.revisarLogros(s);
      this.actualizarYo(s);
      nombres.push(c.nombre);
    }
    this.aTodos({ t: 'aviso', m: `🏆 ¡${ev.nombre} rechazada en ${mp.nombre}! Héroes: ${nombres.slice(0, 6).join(', ') || '—'}${nombres.length > 6 ? ' y ' + (nombres.length - 6) + ' más' : ''}` });
    this.aTodos({ t: 'ev', on: false, fin: 'ganada', mapa: ev.mapa });
  },

  // ── ELITES RAROS ──
  tickRaro(clave, ahora) {
    const w = this.mundoK(clave);
    if (!w.raroProx) { w.raroProx = ahora + rnd(RARO_PRIMERO_MIN[0], RARO_PRIMERO_MIN[1]) * 60000; return; }
    if (ahora < w.raroProx) return;
    w.raroProx = ahora + RARO_TIRADA_MS;
    const vivo = w.raroId && w.mons.get(w.raroId);
    if (vivo && !vivo.muere) return;
    if (Math.random() < RARO_PROB) this.crearRaro(clave);
  },

  crearRaro(clave) {
    const w = this.mundoK(clave);
    const vivo = w.raroId && w.mons.get(w.raroId);
    if (vivo && !vivo.muere) return vivo;
    const mp = MAPAS[w.mapa];
    const k = azar(mp.monstruos);
    const nom = azar(NOMBRES_RARO);
    const o = this.crearMonstruo(clave, k, Math.round(rnd(300, mp.ancho - 300)), {
      nv: mp.nv[1], hpX: 6, atkX: 1.3, ex: { raro: 1, nom, ti: azar(TINTE_RARO) },
    });
    w.raroId = o.id;
    // Solo a la zona: es un premio para quien explora, no un aviso del servidor.
    this.aClave(clave, { t: 'emote', m: `★ ¡${nom} (${MONSTRUOS[k].nombre} raro) ronda ${mp.nombre}!` });
    return o;
  },

  // ── MUERTE DE UN MONSTRUO ESPECIAL (llamado desde matar()) ──
  alMorirEspecial(o) {
    const ex = o.ex;
    if (ex.raro) return this.premioRaro(o);
    const ev = this.evento;
    if (!ev || ex.ev !== ev.id) return;
    this.anotarParticipantes(ev, o);
    if (ex.cap) return this.terminarEvento(true);
    if (ev.fase !== 'oleadas') return;
    ev.hechos++;
    if (ev.hechos >= ev.meta) this.llegaCapitan(ev);
    else this.aClave(ev.mapa, this.estadoEvento());
  },

  premioRaro(o) {
    const w = this.mundoK(o.cl);
    w.raroProx = Date.now() + RARO_REAPARECE_MS;
    w.raroId = 0;
    const base = statsMonstruo(o.k, o.nv);
    const quienes = new Set();
    for (const m of [o.dano, o.cura]) if (m) for (const sid of m.keys()) quienes.add(sid);
    const nombres = [];
    for (const sid of quienes) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.k !== o.cl) continue;
      const xp = base.xp * 4, oro = base.oro * 5;
      s.c.oro += oro;
      s.c.raros = (s.c.raros || 0) + 1;
      const it = this.darItem(s, this.generarItem(o.nv, 1));
      this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it, x: Math.round(o.x), y: Math.round(o.y - o.h - 20) });
      this.actualizarYo(s);
      nombres.push(s.c.nombre);
    }
    this.aClave(o.cl, { t: 'emote', m: `★ ${o.ex.nom} cayó${nombres.length ? ' ante ' + nombres.slice(0, 4).join(', ') : ''}.` });
  },

  // ── COFRES ──
  infoCofres(s, mapaId) {
    const c = s.c, ahora = Date.now();
    return cofresDe(mapaId).map(x => {
      const t = (c.cofres || {})[mapaId + ':' + x.i] || 0;
      return [x.i, x.x, x.y, x.tipo, Math.max(0, t + COFRE_CADA_MS - ahora)];
    });
  },

  abrirCofre(s, m) {
    if (s.muerto) return;
    const mapaId = s.k;
    const cf = cofresDe(mapaId).find(x => x.i === (m.id | 0));
    if (!cf || typeof m.id !== 'number') return;
    if (Math.abs(s.x - cf.x) > COFRE_DIST || Math.abs(s.y - cf.y) > COFRE_DIST) return this.no(s, 'Acércate más al cofre.');
    const c = s.c, ahora = Date.now(), clave = mapaId + ':' + cf.i;
    c.cofres = c.cofres || {};
    const t = c.cofres[clave] || 0;
    if (ahora - t < COFRE_CADA_MS) return this.no(s, `Ya abriste este cofre. Vuelve a tener tesoro en ${Math.ceil((t + COFRE_CADA_MS - ahora) / 60000)} min.`);
    // Se limpian las marcas viejas: el personaje no crece sin fin.
    for (const k in c.cofres) if (ahora - c.cofres[k] >= COFRE_CADA_MS) delete c.cofres[k];
    c.cofres[clave] = ahora;
    const T = COFRE_TIPOS[cf.tipo];
    const nvZ = nivelZona(mapaId);
    const oro = Math.max(1, Math.round(nvZ * T.oro * rnd(0.85, 1.15)));
    c.oro += oro;
    let pociones = 0;
    if (Math.random() < T.pocion) { pociones = T.pociones; c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + pociones); }
    let item = null;
    if (Math.random() < T.equipo) {
      const nv = MAPAS[mapaId].nv;
      item = this.darItem(s, this.generarItem(clamp(c.nivel, nv[0], nv[1]), T.r));
    }
    c.cofresAbiertos = (c.cofresAbiertos || 0) + 1;
    this.enviar(s, { t: 'cofreA', id: cf.i, ms: COFRE_CADA_MS, oro, pociones, item, tipo: cf.tipo });
    this.revisarLogros(s);
    this.actualizarYo(s);
    // Se guarda ya (como una compra): asi un cierre del servidor no deja
    // abrir el mismo cofre dos veces.
    return this.guardar(s);
  },

  // Al llegar a un mapa (o al conectarse): sus cofres y la invasion en curso.
  eventosAlEntrar(s, mapaId) {
    this.enviar(s, { t: 'cofres', mapa: mapaId, l: s.k === mapaId ? this.infoCofres(s, mapaId) : [] });
    this.enviar(s, this.estadoEvento());
  },
};
