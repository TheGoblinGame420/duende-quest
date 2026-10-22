// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — duelos entre jugadores
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Un jugador reta a otro (desde su marco); si acepta, tras 3 s pelean con
// ataque basico y habilidades directas hasta que uno queda a 1 de vida, o
// pasan 90 s, o se alejan/cambian de mapa. Nadie muere ni pierde nada: es
// un juego entre amigos. El daño entre jugadores va reducido (con el de los
// monstruos un duelo duraba 3 s): ~20-40 s a igual nivel. Solo en mapas
// abiertos, nunca en mazmorras ni en el Coliseo. No se cura a nadie (ni al
// empezar ni al acabar): si no, retarse servia de cura gratis contra jefes.
// Hay que llevar 5 s fuera de combate para retar y para aceptar.
// ═══════════════════════════════════════════════════════
import { CLASES, costoHab, multForja, talento, hoyUTC } from '../../mmo/js/data.js';

const RETO_MS = 30000, CUENTA_MS = 3000, DUELO_MS = 90000, LEJOS = 900, CALMA_MS = 5000, RETO_CD_MS = 10000;
const mapaDuelo = k => !k.includes('#') && k !== 'coliseo';
// El golpe de espada sale cada ~0,33 s y el disparo de vara cada 0,7 s: la
// vara pega mas por golpe para que ninguna clase gane solo por cadencia.
// 22-oct: con 0,12/0,2 un duelo de magos (vara cada 0,7 s) seguia al ~80% a
// los 25 s; con todo ×2,5 un guerrero contra un picaro (golpe cada 0,33 s)
// acababa en 11 s. Ahora el golpe cuerpo a cuerpo (y las habilidades) ×1,35 y
// la vara ×2,25: ~25-45 s a igual nivel segun las clases (QA de jugador).
const ESCALA = 0.16, ESCALA_VARA = 0.45;
const rnd = (a, b) => a + Math.random() * (b - a);
// Puntuacion Elo de duelos: solo cuentas (no invitados), ambos Nv 10+, y como
// mucho 3 duelos contados al dia por pareja (que dos amigos no se inflen).
export const ELO_BASE = 1000, ELO_K = 32, ELO_PAR_DIA = 3;

export const Duelos = {
  // El rival de s si el duelo ya empezo (pasada la cuenta atras).
  rivalDuelo(s) {
    const d = s.duelo;
    if (!d || Date.now() < d.ini) return null;
    const t = this.sesiones.get(d.con);
    return t && t.c && t.duelo && t.duelo.con === s.id && t.k === s.k && !t.muerto ? t : null;
  },

  retarDuelo(s, m) {
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c || t === s || s.muerto || t.muerto) return;
    if (!mapaDuelo(s.k) || s.k !== t.k) return this.no(s, 'Solo podéis batiros en el mismo mapa (y no en mazmorras ni en el Coliseo).');
    if (s.duelo || t.duelo) return this.no(s, 'Uno de los dos ya está en un duelo.');
    if (Math.abs(s.x - t.x) > 600) return this.no(s, 'Acércate más para retarlo.');
    const ahora = Date.now();
    if (ahora - (s.combateT || 0) < CALMA_MS) return this.no(s, 'No puedes retar a nadie en mitad de un combate.');
    // Un reto cada 10 s a la misma persona (si no, se le inundaba de ventanas).
    s.retosT = s.retosT || {};
    if (ahora - (s.retosT[t.id] || 0) < RETO_CD_MS) return this.no(s, 'Espera un poco antes de volver a retarlo.');
    s.retosT[t.id] = ahora;
    t.retoDuelo = { de: s.id, hasta: Date.now() + RETO_MS };
    this.enviar(t, { t: 'reto', de: s.c.nombre, nv: s.c.nivel, cl: s.c.clase || '', ms: RETO_MS });
    this.enviar(s, { t: 'toast', m: `⚔️ Retaste a ${t.c.nombre} a un duelo.` });
  },

  respuestaDuelo(s, m) {
    const r = s.retoDuelo;
    s.retoDuelo = null;
    const t = r && r.hasta > Date.now() ? this.sesiones.get(r.de) : null;
    if (!m.si) { if (t) this.enviar(t, { t: 'toast', m: `${s.c.nombre} rechazó el duelo.` }); return; }
    if (!t || !t.c || t.k !== s.k || !mapaDuelo(s.k) || Math.abs(s.x - t.x) > 600 || t.muerto || s.muerto || t.duelo || s.duelo) return this.no(s, 'El duelo ya no es posible.');
    const ahora = Date.now();
    if (ahora - (s.combateT || 0) < CALMA_MS || ahora - (t.combateT || 0) < CALMA_MS) return this.no(s, 'Ahora no: uno de los dos está en combate.');
    const ini = ahora + CUENTA_MS;
    // Donde empezo (para saber quien huyo) y el uid del rival (por si se desconecta).
    const x0 = (s.x + t.x) / 2, k0 = s.k;
    s.duelo = { con: t.id, ini, fin: ini + DUELO_MS, x0, k0, uid: t.c.uid };
    t.duelo = { con: s.id, ini, fin: ini + DUELO_MS, x0, k0, uid: s.c.uid };
    this.aClave(s.k, { t: 'duelo', a: s.id, b: t.id, en: CUENTA_MS, ms: DUELO_MS });
  },

  terminarDuelo(s, ganador, motivo) {
    const t = this.sesiones.get(s.duelo && s.duelo.con);
    const a = s, b = t && t.duelo && t.duelo.con === s.id ? t : null;
    a.duelo = null;
    if (b) b.duelo = null;
    const g = ganador && ganador.c ? ganador : null;
    let elo = '';
    if (g) {
      g.c.duelosG = (g.c.duelosG || 0) + 1;
      g.sucio = true;
      this.revisarLogros(g);
      const r = this.puntuarDuelo(g, g === a ? b : a);
      if (r && !r.sin) elo = ` Elo: ${g.c.nombre} ${r.g} (+${r.d}).`;
    }
    for (const x of [a, b]) if (x && !x.muerto) x.inv = Date.now() + 1500;
    const txt = g ? `⚔️ ${g.c.nombre} gana el duelo${motivo ? ' (' + motivo + ')' : ''}.${elo}` : `⚔️ El duelo terminó en empate${motivo ? ' (' + motivo + ')' : ''}.`;
    const fin = { t: 'dueloFin', a: a.id, b: b ? b.id : 0, g: g ? g.id : 0, m: txt };
    this.aClave(a.k, fin);
    // Si ya estaban en mapas distintos, el otro tambien debe enterarse.
    if (b && b.k !== a.k) this.enviar(b, fin);
  },

  // Elo del que se desconecto en mitad del duelo: se carga su personaje (o su
  // sesion, si ya volvio) y pierde como si hubiera perdido el duelo.
  async eloPorAbandono(g, uid) {
    const vuelto = this.porUid.get(uid);
    if (vuelto && vuelto.c) { this.puntuarDuelo(g, vuelto); return; }
    const c = await this.state.storage.get('c:' + uid);
    if (!c) return;
    const r = this.puntuarDuelo(g, { c });
    if (r && !r.sin && !this.porUid.get(uid)) await this.state.storage.put('c:' + uid, c);
  },

  puntuarDuelo(g, p) {
    if (!g || !p || !g.c || !p.c) return null;
    if (g.c.uid.startsWith('inv:') || p.c.uid.startsWith('inv:') || g.c.nivel < 10 || p.c.nivel < 10) return null;
    if (this.esPrueba && (this.esPrueba(g.c) || this.esPrueba(p.c))) return null;
    const hoy = hoyUTC(), par = [g.c.uid, p.c.uid].sort().join('|');
    if (!this.dueloPares || this.dueloPares.d !== hoy) this.dueloPares = { d: hoy, l: {} };
    if ((this.dueloPares.l[par] || 0) >= ELO_PAR_DIA) return { sin: true };
    this.dueloPares.l[par] = (this.dueloPares.l[par] || 0) + 1;
    const rg = g.c.elo || ELO_BASE, rp = p.c.elo || ELO_BASE;
    const d = Math.max(1, Math.round(ELO_K * (1 - 1 / (1 + Math.pow(10, (rp - rg) / 400)))));
    g.c.elo = rg + d; p.c.elo = Math.max(100, rp - d);
    g.sucio = p.sucio = true;
    // Uno tras otro (y en cola con los anteriores): a la vez, el segundo
    // guardado pisaba al primero.
    this.colaRankDuelo = (this.colaRankDuelo || Promise.resolve()).then(() => this.actualizarRankDuelo(g)).then(() => this.actualizarRankDuelo(p)).catch(e => console.error('[MMO rankDuelo]', e));
    return { d, g: g.c.elo, p: p.c.elo };
  },

  // Cada tick: fin por tiempo, distancia o desconexion.
  tickDuelos(ahora) {
    for (const s of this.sesiones.values()) {
      const d = s.duelo;
      if (!d) continue;
      const t = this.sesiones.get(d.con);
      if (!t || !t.c || t.cerrado || !t.duelo) {
        // El rival se desconecto: gana el que se quedo (tambien en el Elo, si
        // el duelo ya habia empezado; si no, huir no costaba nada).
        s.duelo = null;
        let txt = '⚔️ Tu rival se fue: ganas el duelo.';
        if (ahora >= d.ini && d.uid) { s.c.duelosG = (s.c.duelosG || 0) + 1; s.sucio = true; this.revisarLogros(s); this.eloPorAbandono(s, d.uid).catch(e => console.error('[MMO elo abandono]', e)); }
        this.enviar(s, { t: 'dueloFin', a: s.id, b: 0, g: s.id, m: txt });
        continue;
      }
      if (s.id > t.id) continue;   // cada pareja se mira una vez
      if (s.muerto || t.muerto) this.terminarDuelo(s, s.muerto ? (t.muerto ? null : t) : s, 'cayó en combate');
      else if (t.k !== s.k || Math.abs(t.x - s.x) > LEJOS) {
        // Pierde el que se fue (cambio de mapa o se alejo mas del punto de inicio).
        if (ahora < d.ini) this.terminarDuelo(s, null, 'se alejaron');
        else {
          const fuera = x => (x.k !== d.k0 ? 1e9 : Math.abs(x.x - d.x0));
          this.terminarDuelo(s, fuera(s) > fuera(t) ? t : s, (fuera(s) > fuera(t) ? s : t).c.nombre + ' huyó');
        }
      }
      else if (ahora > d.fin) this.terminarDuelo(s, s.hp / s.st.maxHp > t.hp / t.st.maxHp ? s : t.hp / t.st.maxHp > s.hp / s.st.maxHp ? t : null, 'se acabó el tiempo');
    }
  },

  // Golpe de s a su rival de duelo. mult como en pegar().
  golpeDuelo(s, t, mult, basico) {
    const ahora = Date.now();
    const crit = Math.random() < s.st.crit;
    const forja = multForja((s.c.forja || {})[s.c.arma]);
    let dmg = s.st.atk * mult * forja * rnd(0.9, 1.1) * (crit ? 1.8 : 1) * (ahora < s.fuego ? 1.5 : 1) * (this.aura(s, 'grito') ? 1.1 : 1) * (this.elixir(s, 'elixirF') ? 1.1 : 1) * (this.elixir(s, 'sudado') ? 1.05 : 1);
    if (this.aura(s, 'sigilo')) { dmg *= 2; this.quitarAura(s, 'sigilo'); }
    const vara = basico && CLASES[s.c.clase] && CLASES[s.c.clase].basico === 'vara';
    dmg = Math.max(1, Math.round(dmg * (vara ? ESCALA_VARA : ESCALA)));
    s.combateT = ahora;
    this.herir(t, dmg, { id: 0, duelo: s.id, bala: !basico });
    if (crit) this.aClave(s.k, { t: 'critDuelo', p: t.id });
    if (t.hp <= 1 && s.duelo) this.terminarDuelo(s, s, '');
  },

  // Habilidad usada contra el rival (version simple: daño directo y sus
  // efectos sobre jugadores; las de area y las de monstruos no aplican).
  habDuelo(s, h, t) {
    const ahora = Date.now();
    const cl = CLASES[s.c.clase];
    s.rec = Math.max(0, s.rec - costoHab(h, s.st.recMax, s.c.espec));
    if (cl.recurso === 'mana' && h.costo) s.gastoT = ahora;
    const cdReal = h.cd ? Math.round(h.cd * (1 - talento(s.c, 'celeridad'))) : 0;
    if (cdReal) { s.cdHab[h.id] = ahora + cdReal; this.enviar(s, { t: 'cd', id: 'h_' + h.id, hasta: cdReal }); }
    let mult = h.mult || 0.6;
    if (h.id === 'eviscerar') { mult = h.mult + h.porCombo * (s.combo || 0); s.combo = 0; }
    if (h.id === 'dolor') mult = h.mult * 0.4;
    if (h.id === 'siniestro' || h.id === 'abanico') this.sumarCombo(s, 1);
    if (h.genera) s.rec = Math.min(100, s.rec + h.genera);
    // Aturdir: tras cada aturdimiento el rival es inmune 4 s (si no, un mago
    // encadenaba Polimorfia y el otro no podia ni moverse).
    if ((h.aturde || h.id === 'polimorfia') && !this.aura(t, 'aturdido') && ahora >= (t.inmuneAtur || 0)) {
      const ms = h.id === 'polimorfia' ? 2500 : 1000;
      this.ponerAura(t, 'aturdido', ms);
      t.inmuneAtur = ahora + ms + 4000;
    }
    if (h.interrumpe && t.cast) this.cancelarCast(t, '¡Te interrumpieron!');
    this.aClave(s.k, { t: 'hb', p: s.id, id: h.id, f: s.f, h: [], tg: t.id, tk: 'p' });
    this.golpeDuelo(s, t, mult, false);
  },
};
