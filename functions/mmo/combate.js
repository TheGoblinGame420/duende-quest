// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — combate al estilo World of Warcraft
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo): todo usa `this`
// como si estuviera escrito dentro de world.js. Aqui viven las clases, el
// ataque basico, las habilidades con tiempo de lanzamiento, el tiempo global
// de reutilizacion (GCD), los recursos (mana/ira/energia), la amenaza de los
// monstruos, las curas y las auras (buenas y malas).
//
// El servidor decide todo: el cliente solo dice "uso tal habilidad sobre tal
// objetivo" y aqui se valida alcance, recurso, tiempos y objetivo.
// ═══════════════════════════════════════════════════════
import {
  MAPAS, CLASES, RECURSOS, habPorId, costoHab, costoCambioClase, GCD_MS, VARA, HOGAR_MS, HOGAR_CD_MS,
  ARMAS, SKINS, ATAQUE_CD_MS, ALCANCE_BASE, COMBO_MULT, multForja, FIS, FJ, FM,
  ESPECS, ESPEC_NIVEL, especDe, MONTURAS, MONTAR_MS, talento,
} from '../../mmo/js/data.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const Combate = {
  // ── CLASE ──
  elegirClase(s, m) {
    const c = s.c;
    if (s.muerto || typeof m.id !== 'string' || !Object.hasOwn(CLASES, m.id) || c.clase === m.id) return;
    if (c.clase && (Date.now() - (s.combateT || 0) < 5000 || s.cast)) return this.no(s, 'No puedes cambiar de clase en pleno combate.');
    const costo = c.clase ? costoCambioClase(c.nivel) : 0;
    if (c.oro < costo) return this.enviar(s, { t: 'toast', m: `Cambiar de clase a tu nivel cuesta ${costo.toLocaleString('es', { useGrouping: 'always' })} oro.` });
    c.oro -= costo;
    c.clase = m.id;
    c.espec = null;
    this.cancelarCast(s);
    this.limpiarAuras(s);
    s.combo = 0;
    const pct = s.hp / s.st.maxHp;
    s.st = this.stats(c);
    s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    this.recursoInicial(s);
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.enviar(s, { t: 'toast', m: `Ahora eres ${CLASES[m.id].nombre}.`, ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // ── ESPECIALIZACION ──
  especDe(s) { return s.c.nivel >= ESPEC_NIVEL ? especDe(s.c.clase, s.c.espec) : null; },
  elegirEspec(s, m) {
    const c = s.c;
    if (s.muerto || !c.clase || typeof m.id !== 'string' || !ESPECS[c.clase] || !Object.hasOwn(ESPECS[c.clase], m.id) || c.espec === m.id) return;
    if (c.nivel < ESPEC_NIVEL) return this.no(s, `Las especializaciones se eligen desde nivel ${ESPEC_NIVEL}.`);
    if (Date.now() - (s.combateT || 0) < 5000 || s.cast) return this.no(s, 'No puedes cambiar de especialización en pleno combate.');
    c.espec = m.id;
    const pct = s.hp / s.st.maxHp;
    s.st = this.stats(c);
    s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    s.sucio = true;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.enviar(s, { t: 'toast', m: `✨ Especialización: ${ESPECS[c.clase][m.id].nombre}. ${ESPECS[c.clase][m.id].desc}`, ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // ── MONTURAS ──
  montar(s) {
    const c = s.c;
    if (s.muerto) return;
    if (s.montado) return this.desmontar(s);
    if (!c.montura || !MONTURAS[c.montura]) return this.no(s, 'No tienes montura: el Mercader del pueblo las vende desde nivel 20.');
    if (s.k.includes('#') || s.k === 'coliseo') return this.no(s, 'Aquí no puedes montar.');
    if (s.cast) return;
    if (Date.now() - (s.combateT || 0) < 4000) return this.no(s, 'No puedes montar en pleno combate.');
    s.cast = { h: 'montar', fin: Date.now() + MONTAR_MS, x: s.x, y: s.y, tg: 0 };
    this.aClave(s.k, { t: 'cast', p: s.id, id: 'montar', ms: MONTAR_MS });
  },
  desmontar(s) {
    if (!s.montado) return;
    s.montado = null;
    this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
    this.actualizarYo(s);
  },

  recursoInicial(s) {
    const cl = CLASES[s.c.clase];
    s.rec = !cl ? 0 : cl.recurso === 'ira' ? 0 : s.st.recMax;
  },

  // Aviso corto de "no se puede" (texto rojo arriba, como en WoW). Con
  // limite: si el jugador aprieta la tecla 10 veces no se le mandan 10.
  no(s, txt) {
    const ahora = Date.now();
    if (ahora - (s.noT || 0) < 400 && s.noTxt === txt) return;
    s.noT = ahora; s.noTxt = txt;
    this.enviar(s, { t: 'no', m: txt });
  },

  // ── DISTANCIAS ──
  // Del centro del duende al BORDE del monstruo: un monstruo grande se
  // alcanza antes que uno pequeño, como pasa al verlos.
  distMon(s, o) {
    const dx = Math.max(0, Math.abs(o.x - s.x) - o.w / 2);
    const dy = Math.max(0, Math.abs((o.y - o.h / 2) - (s.y - FIS.jugH / 2)) - o.h / 2);
    return Math.hypot(dx, dy);
  },
  distJug(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 0.7); },

  // Monstruo objetivo: el que pide el cliente si sigue vivo y al alcance. Si
  // no pidio ninguno, el mas cercano al alcance (mejor si esta delante): en
  // el movil tocar un monstruo pequeño es dificil y asi siempre se pelea.
  enemigoAlAlcance(s, tg, rango, min) {
    const w = this.mundoDe(s);
    const tope = this.topeMuros(s) + 60;
    const ok = o => o && !o.muere && o.x <= tope && this.distMon(s, o) <= rango && (!min || this.distMon(s, o) >= min);
    if (typeof tg === 'number' && tg > 0) {
      const o = w.mons.get(tg);
      return ok(o) ? o : null;
    }
    let mejor = null, md = Infinity;
    for (const o of w.mons.values()) {
      if (!ok(o)) continue;
      const d = this.distMon(s, o) + ((o.x - s.x) * s.f < 0 ? 150 : 0);
      if (d < md) { md = d; mejor = o; }
    }
    return mejor;
  },

  // Aliado: otro jugador del mismo mapa (o instancia), o uno mismo si no se
  // eligio a nadie. muerto = buscar a un caido (para resucitar).
  aliadoAlAlcance(s, tg, rango, muerto) {
    if (typeof tg !== 'number' || tg <= 0 || tg === s.id) return muerto ? this.caidoCercano(s, rango) : s;
    const a = this.sesiones.get(tg);
    if (!a || !a.c || a.k !== s.k || !!a.muerto !== !!muerto) return null;
    return this.distJug(s, a) <= rango ? a : null;
  },
  caidoCercano(s, rango) {
    let mejor = null, md = rango;
    for (const a of this.sesiones.values()) {
      if (!a.c || a === s || a.k !== s.k || !a.muerto) continue;
      const d = this.distJug(s, a);
      if (d <= md) { md = d; mejor = a; }
    }
    return mejor;
  },
  aliadosCerca(s, radio) {
    const r = [];
    for (const a of this.sesiones.values()) if (a.c && a.k === s.k && !a.muerto && Math.abs(a.x - s.x) <= radio) r.push(a);
    return r;
  },

  // ── AURAS ──
  // ms = 0 → dura hasta que se quite (el sigilo). Cada cambio se avisa al
  // mapa para que los marcos muestren el icono con su cuenta atras.
  aura(u, a) { const x = u.au && u.au[a]; return x && x.hasta > Date.now() ? x : null; },
  ponerAura(s, a, ms, extra) {
    s.au = s.au || {};
    if (a === 'aturdido' && s.cast) this.cancelarCast(s, 'Te aturdieron.');
    s.au[a] = { hasta: ms ? Date.now() + ms : Infinity, ...(extra || {}) };
    this.aClave(s.k, { t: 'au', k: 'p', id: s.id, a, ms: ms || -1 });
  },
  quitarAura(s, a) {
    if (!s.au || !s.au[a]) return;
    delete s.au[a];
    this.aClave(s.k, { t: 'au', k: 'p', id: s.id, a, ms: 0 });
  },
  limpiarAuras(s) { for (const a in (s.au || {})) this.quitarAura(s, a); s.au = {}; },
  ponerAuraMon(o, a, ms, extra) {
    o.au[a] = { hasta: Date.now() + ms, ...(extra || {}) };
    this.aClave(o.cl, { t: 'au', k: 'm', id: o.id, a, ms });
  },
  quitarAuraMon(o, a) {
    if (!o.au[a]) return;
    delete o.au[a];
    this.aClave(o.cl, { t: 'au', k: 'm', id: o.id, a, ms: 0 });
  },
  auraMon(o, a) { const x = o.au[a]; return x && x.hasta > Date.now() ? x : null; },

  banderasJugador(s, ahora) {
    const on = k => s.au && s.au[k] && s.au[k].hasta > ahora;
    return (ahora < s.escudo ? FJ.escudo : 0) | (ahora < s.fuego ? FJ.fuego : 0) | (s.muerto ? FJ.muerto : 0)
      | (on('escudoPoder') ? FJ.escudoPoder : 0) | (on('renovar') ? FJ.renovar : 0) | (on('muro') ? FJ.muro : 0)
      | (on('evasion') ? FJ.evasion : 0) | (on('bloque') ? FJ.bloque : 0) | (on('sigilo') ? FJ.sigilo : 0)
      | (s.cast ? FJ.lanza : 0) | (on('grito') ? FJ.grito : 0) | (on('supresion') ? FJ.supresion : 0) | (on('aturdido') ? FJ.aturdido : 0);
  },
  banderasMonstruo(o, ahora) {
    const on = k => o.au[k] && o.au[k].hasta > ahora;
    return (on('raiz') ? FM.raiz : 0) | (on('aturdido') ? FM.aturdido : 0) | (on('oveja') ? FM.oveja : 0)
      | (on('dolor') ? FM.dolor : 0) | (o.cast ? FM.lanza : 0);
  },

  // ── DAÑO Y CURA ──
  // Daño de un jugador a un monstruo. basico = ataque basico (sale en blanco
  // y no en amarillo). Atacar desde el sigilo hace el doble y lo rompe.
  pegar(s, o, mult, amen, basico) {
    if (!o || o.muere) return null;
    const ahora = Date.now();
    let k = 1;
    if (this.aura(s, 'sigilo')) {
      k = 2;
      this.quitarAura(s, 'sigilo');
      if (s.c.clase === 'picaro') this.sumarCombo(s, 2);
    }
    const crit = Math.random() < s.st.crit;
    const forja = multForja((s.c.forja || {})[s.c.arma]);
    const dmg = Math.max(1, Math.round(s.st.atk * mult * forja * rnd(0.9, 1.1) * (crit ? 1.8 : 1)
      * (ahora < s.fuego ? 1.5 : 1) * (this.aura(s, 'grito') ? 1.1 : 1) * (this.elixir(s, 'elixirF') ? 1.1 : 1) * (this.elixir(s, 'sudado') ? 1.05 : 1) * k));
    const real = this.danar(o, dmg, s, amen);
    return [o.id, real || dmg, crit ? 1 : basico ? 0 : 4];
  },

  curar(s, a, cant) {
    if (!a || a.muerto || !a.st) return 0;
    const sp = s && s.c ? this.especDe(s) : null;
    if (sp && sp.cura) cant *= sp.cura;
    if (s && s.c) cant *= 1 + talento(s.c, 'sanacion');
    const crit = Math.random() < ((s && s.st) ? s.st.crit : 0.1);
    const n = Math.max(1, Math.round(cant * rnd(0.92, 1.08) * (crit ? 1.5 : 1)));
    const real = Math.min(n, Math.max(0, a.st.maxHp - a.hp));
    a.hp += real;
    this.aClave(a.k, { t: 'cu', p: a.id, n, c: crit ? 1 : 0 });
    if (real > 0 && s) this.amenazaCura(s, a, real);
    return real;
  },
  // Curar a alguien que pelea enoja a los monstruos que pelean contra el (y
  // cuenta como participar: el sanador tambien cobra su parte del botin).
  amenazaCura(s, a, cant) {
    // En el mundo 3D los monstruos viven en this.m3 (functions/mmo/mundo3d.js).
    const w = a.m3 ? this.iniciar3d() : this.mundoDe(a);
    let pelea = false;
    for (const o of w.mons.values()) {
      if (o.muere || !o.amen.has(a.id)) continue;
      o.amen.set(s.id, (o.amen.get(s.id) || 0) + cant * 0.5);
      o.cura = o.cura || new Map();
      o.cura.set(s.id, (o.cura.get(s.id) || 0) + cant * 0.5);
      pelea = true;
    }
    if (pelea) s.combateT = Date.now();
  },

  sumarCombo(s, n) { s.combo = Math.min(5, (s.combo || 0) + n); },

  robarVida(s, curado) {
    const robo = (SKINS[s.c.skin].buffs || {}).robo || 0;
    if (robo && curado) s.hp = Math.min(s.st.maxHp, s.hp + curado * robo);
  },

  // ── ATAQUE BASICO (Z) ──
  atacar(s, m) {
    if (s.muerto || this.aura(s, 'bloque') || this.aura(s, 'aturdido')) return;
    const cl = CLASES[s.c.clase];
    this.desmontar(s);
    if (cl && cl.basico === 'vara') return this.disparoVara(s, m);
    const ahora = Date.now();
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    if (ahora - s.atkT < ATAQUE_CD_MS * arma.cd * 0.8) return;
    s.atkT = ahora;
    const paso = clamp(m.s | 0, 0, 2);
    const alcance = ALCANCE_BASE[paso] * arma.alcance;
    const alto = 72 * (s.c.arma === 'odachi' ? 1.4 : 1);
    const x0 = s.f > 0 ? s.x - 8 : s.x - 8 - alcance;
    const x1 = s.f > 0 ? s.x + 8 + alcance : s.x + 8;
    const y0 = s.y - alto, y1 = s.y + 8;
    const w = this.mundoDe(s);
    const maxObjetivos = s.c.arma === 'odachi' ? 6 : 4;
    const lista = [...w.mons.values()]
      .filter(o => !o.muere && o.x + o.w / 2 > x0 && o.x - o.w / 2 < x1 && o.y > y0 && o.y - o.h < y1)
      .sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))
      .slice(0, maxObjetivos);
    const golpes = [];
    let curado = 0, crit = false;
    for (const o of lista) {
      const g = this.pegar(s, o, arma.dano * COMBO_MULT[paso], 1, true);
      if (!g) continue;
      golpes.push(g); curado += g[1]; if (g[2] === 1) crit = true;
    }
    // CHISPA: el rayo salta al enemigo mas cercano del primero golpeado.
    if (s.c.arma === 'chispa' && lista.length) {
      const pri = lista[0];
      let otro = null, mejor = 170;
      for (const o of w.mons.values()) {
        if (o === pri || o.muere || lista.includes(o)) continue;
        const d = Math.hypot(o.x - pri.x, o.y - pri.y);
        if (d < mejor) { mejor = d; otro = o; }
      }
      if (otro) {
        const g = this.pegar(s, otro, 0.5 * COMBO_MULT[paso], 1, true);
        if (g) { g[2] = 2; golpes.push(g); }
      }
    }
    // Duelo: el rival tambien recibe el golpe si esta en la caja.
    const riv = this.rivalDuelo(s);
    const pegoRiv = !!riv && riv.x + FIS.jugW / 2 > x0 && riv.x - FIS.jugW / 2 < x1 && riv.y > y0 && riv.y - FIS.jugH < y1;
    if (pegoRiv) this.golpeDuelo(s, riv, arma.dano * COMBO_MULT[paso], true);
    // El guerrero gana Ira con cada golpe que conecta.
    if ((golpes.length || pegoRiv) && cl && cl.recurso === 'ira') s.rec = Math.min(100, s.rec + 3 + (crit ? 2 : 0));
    this.robarVida(s, curado);
    this.aClave(s.k, { t: 'at', p: s.id, s: paso, f: s.f, h: golpes });
  },

  // Magos y sacerdotes: un proyectil de su vara al objetivo.
  disparoVara(s, m) {
    const ahora = Date.now();
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    if (s.cast || ahora - s.atkT < VARA.cdMs * arma.cd * 0.8) return;
    if (m.tk === 'p') {
      const riv = this.rivalDuelo(s);
      if (!riv || riv.id !== m.tg || this.distJug(s, riv) > VARA.rango) return;
      s.atkT = ahora;
      s.f = riv.x >= s.x ? 1 : -1;
      this.golpeDuelo(s, riv, VARA.mult * arma.dano, true);
      this.aClave(s.k, { t: 'at', p: s.id, s: 0, f: s.f, h: [], varaP: riv.id });
      return;
    }
    const o = this.enemigoAlAlcance(s, m.tg, VARA.rango);
    if (!o) return this.no(s, 'No hay ningún enemigo al alcance de tu vara.');
    s.atkT = ahora;
    s.f = o.x >= s.x ? 1 : -1;
    const g = this.pegar(s, o, VARA.mult * arma.dano, 1, true);
    if (g) this.robarVida(s, g[1]);
    this.aClave(s.k, { t: 'at', p: s.id, s: 0, f: s.f, h: g ? [g] : [], vara: o.id });
  },

  // ── HABILIDADES ──
  habilidad(s, m) {
    const c = s.c;
    const h = habPorId(m.id);
    if (!h || h.clase !== c.clase || s.muerto) return;
    if (c.nivel < h.nv) return this.no(s, `Aprendes ${h.nombre} a nivel ${h.nv}.`);
    if (this.aura(s, 'bloque')) return;
    if (this.aura(s, 'aturdido')) return this.no(s, 'Estás aturdido.');
    const ahora = Date.now();
    if (s.cast) return this.no(s, 'Ya estás lanzando otro hechizo.');
    if (ahora < (s.cdHab[h.id] || 0)) return this.no(s, `${h.nombre} todavía no está lista.`);
    // 80 ms de margen: el cliente cuenta su GCD desde que envia y la
    // respuesta del anterior puede llegar con algo de retraso.
    if (h.gcd !== false && ahora < (s.gcdHasta || 0) - 80) return;
    const costo = costoHab(h, s.st.recMax, s.c.espec);
    if (s.rec < costo) return this.no(s, `No tienes suficiente ${RECURSOS[CLASES[c.clase].recurso].nombre.toLowerCase()}.`);
    // Duelo: la habilidad va contra el rival.
    if (h.obj === 'enemigo' && m.tk === 'p') {
      const riv = this.rivalDuelo(s);
      if (!riv || riv.id !== m.tg) return this.no(s, 'Ese jugador no es tu rival de duelo.');
      if (this.distJug(s, riv) > h.rango + 20) return this.no(s, 'Fuera de alcance.');
      if (h.id === 'eviscerar' && !(s.combo > 0)) return this.no(s, 'Necesitas puntos de combo (usa Golpe Siniestro).');
      if (h.bajo && riv.hp / riv.st.maxHp > h.bajo) return this.no(s, 'Solo funciona con enemigos casi muertos.');
      this.desmontar(s);
      if (h.gcd !== false) s.gcdHasta = ahora + GCD_MS;
      if (h.cast) {
        s.cast = { h: h.id, fin: ahora + h.cast, x: s.x, y: s.y, tg: riv.id, tk: 'p' };
        s.f = riv.x >= s.x ? 1 : -1;
        this.aClave(s.k, { t: 'cast', p: s.id, id: h.id, ms: h.cast, tg: riv.id });
        return;
      }
      return this.habDuelo(s, h, riv);
    }
    let obj = null;
    if (h.obj === 'enemigo') {
      obj = this.enemigoAlAlcance(s, m.tg, h.rango, h.min);
      if (!obj) {
        const cerca = h.min && this.enemigoAlAlcance(s, m.tg, h.min);
        return this.no(s, cerca ? 'Estás demasiado cerca.' : 'No hay ningún enemigo al alcance.');
      }
      if (h.bajo && obj.hp / obj.max > h.bajo) return this.no(s, 'Solo funciona con enemigos casi muertos.');
      if (h.id === 'polimorfia' && obj.jefe) return this.no(s, 'Los jefes no se pueden convertir en oveja.');
    } else if (h.obj === 'aliado') {
      obj = this.aliadoAlAlcance(s, m.tg, h.rango, false);
      if (!obj) return this.no(s, 'Tu aliado está demasiado lejos.');
      if (h.id === 'escudo_poder' && this.aura(obj, 'almaDebil')) return this.no(s, 'Ese aliado no puede recibir otro escudo todavía (Alma Debilitada).');
    } else if (h.obj === 'muerto') {
      obj = this.aliadoAlAlcance(s, m.tg, h.rango, true);
      if (!obj) return this.no(s, 'Acércate a un aliado caído para resucitarlo.');
    }
    if (h.id === 'eviscerar' && !(s.combo > 0)) return this.no(s, 'Necesitas puntos de combo (usa Golpe Siniestro).');
    if (h.id === 'sigilo') {
      if (this.aura(s, 'sigilo')) { this.quitarAura(s, 'sigilo'); return; }
      if (ahora - (s.combateT || 0) < 5000) return this.no(s, 'No puedes entrar en sigilo en pleno combate.');
    }
    this.desmontar(s);
    if (h.gcd !== false) s.gcdHasta = ahora + GCD_MS;
    if (h.cast) {
      s.cast = { h: h.id, fin: ahora + h.cast, x: s.x, y: s.y, tg: obj ? obj.id : 0 };
      if (obj && h.obj === 'enemigo') s.f = obj.x >= s.x ? 1 : -1;
      this.aClave(s.k, { t: 'cast', p: s.id, id: h.id, ms: h.cast, tg: obj ? obj.id : 0 });
      return;
    }
    this.aplicarHab(s, h, obj);
  },

  // Al terminar un lanzamiento se vuelve a mirar todo: el objetivo pudo
  // morir o alejarse (con 60 px de margen, el que se le da en WoW).
  revisarCast(s, ahora) {
    const ca = s.cast;
    if (!ca || ahora < ca.fin) return;
    s.cast = null;
    if (ca.h === 'pescar' || ca.h === 'pica') return this.finPesca(s, ca, ahora);
    if (ca.h === 'recolectar') {
      this.aClave(s.k, { t: 'castFin', p: s.id, ok: true });
      if (!s.muerto) { if (s.m3) this.terminarRecoleccion3d(s, ca); else this.terminarRecoleccion(s, ca); }
      return;
    }
    if (ca.h === 'montar') {
      this.aClave(s.k, { t: 'castFin', p: s.id, ok: true });
      if (!s.muerto && s.c.montura && !s.k.includes('#')) {
        s.montado = s.c.montura;
        this.aClave(s.k, { t: 'pa', ...this.infoApariencia(s) });
        this.actualizarYo(s);
      }
      return;
    }
    if (ca.h === 'hogar') {
      this.aClave(s.k, { t: 'castFin', p: s.id, ok: true });
      s.cdHogar = ahora + HOGAR_CD_MS;
      this.enviar(s, { t: 'cd', id: 'hogar', hasta: HOGAR_CD_MS });
      this.entrarMapa(s, 'pueblo', MAPAS.pueblo.spawn);
      this.guardar(s);
      return;
    }
    const h = habPorId(ca.h);
    if (ca.tk === 'p') {
      const riv = this.rivalDuelo(s);
      const ok = riv && riv.id === ca.tg && this.distJug(s, riv) <= h.rango + 60 && s.rec >= costoHab(h, s.st.recMax, s.c.espec) && !s.muerto;
      this.aClave(s.k, { t: 'castFin', p: s.id, ok: !!ok });
      if (ok) this.habDuelo(s, h, riv);
      return;
    }
    let obj = null;
    if (h.obj === 'enemigo') {
      const o = this.mundoDe(s).mons.get(ca.tg);
      obj = o && !o.muere && this.distMon(s, o) <= h.rango + 60 ? o : null;
    } else if (h.obj === 'aliado' || h.obj === 'muerto') {
      const a = ca.tg === s.id ? s : this.sesiones.get(ca.tg);
      obj = a && a.c && a.k === s.k && !!a.muerto === (h.obj === 'muerto') && (a === s || this.distJug(s, a) <= h.rango + 60) ? a : null;
    }
    const necesita = h.obj === 'enemigo' || h.obj === 'aliado' || h.obj === 'muerto';
    if (s.muerto || (necesita && !obj) || s.rec < costoHab(h, s.st.recMax, s.c.espec)) {
      this.aClave(s.k, { t: 'castFin', p: s.id, ok: false });
      if (!s.muerto) this.no(s, necesita && !obj ? 'El objetivo ya no está al alcance.' : 'No tienes suficiente recurso.');
      return;
    }
    this.aClave(s.k, { t: 'castFin', p: s.id, ok: true });
    this.aplicarHab(s, h, obj);
  },

  cancelarCast(s, motivo) {
    if (!s.cast) return;
    s.cast = null;
    this.aClave(s.k, { t: 'castFin', p: s.id, ok: false });
    if (motivo) this.no(s, motivo);
  },

  aplicarHab(s, h, obj) {
    const ahora = Date.now();
    const c = s.c;
    const cl = CLASES[c.clase];
    s.rec = Math.max(0, s.rec - costoHab(h, s.st.recMax, s.c.espec));
    if (cl.recurso === 'mana' && h.costo) s.gastoT = ahora;
    // Celeridad (talento) acorta las recargas.
    const cdReal = h.cd ? Math.round(h.cd * (1 - talento(c, 'celeridad'))) : 0;
    if (cdReal) s.cdHab[h.id] = ahora + cdReal;
    const w = this.mundoDe(s);
    const golpes = [];
    const ev = { t: 'hb', p: s.id, id: h.id, f: s.f, h: golpes };
    if (obj) { ev.tg = obj.id; ev.tk = h.obj === 'enemigo' ? 'm' : 'p'; }
    const vivos = () => [...w.mons.values()].filter(o => !o.muere);
    const enRadio = (o, r) => Math.abs(o.x - s.x) < r + o.w / 2 && Math.abs((o.y - o.h / 2) - (s.y - 30)) < 130;
    const g = x => { if (x) golpes.push(x); return x; };
    // La especializacion potencia algunas habilidades (Fuego, Sombras...).
    const sp = this.especDe(s);
    const mh = (sp && sp.hab && sp.hab[h.id]) || 1;
    const pegar = (o, mult, amen) => this.pegar(s, o, mult * mh, amen);
    switch (h.id) {
      // Guerrero
      case 'golpe_heroico': case 'ejecutar': case 'castigo': case 'bola_fuego':
        g(pegar(obj, h.mult, h.amenaza));
        break;
      case 'carga': {
        // Aparece junto al objetivo: el cliente lo dibuja como una embestida.
        const lado = obj.x > s.x ? -1 : 1;
        s.x = clamp(obj.x + lado * (obj.w / 2 + 22), 10, Math.min(MAPAS[w.mapa].ancho - 10, this.topeMuros(s)));
        s.f = -lado; s.movT = ahora; s.snapHasta = ahora + 300;
        this.enviar(s, { t: 'snap', x: Math.round(s.x), y: Math.round(s.y), f: s.f, carga: 1 });
        s.rec = Math.min(100, s.rec + h.genera);
        g(pegar(obj, 0.6, 2));
        if (!obj.muere && !obj.jefe) this.ponerAuraMon(obj, 'aturdido', h.aturde);
        // A los jefes no se les aturde, pero la carga les corta el hechizo.
        if (!obj.muere && obj.jefe && obj.cast && obj.cast.int) this.interrumpir(obj, 3000);
        ev.x = Math.round(s.x);
        break;
      }
      case 'provocar': {
        const max = Math.max(0, ...obj.amen.values());
        obj.amen.set(s.id, max * 1.1 + 30);
        this.ponerAuraMon(obj, 'provoca', 3000, { sid: s.id });
        break;
      }
      case 'torbellino': case 'abanico':
        for (const o of vivos()) if (enRadio(o, h.radio)) g(pegar(o, h.mult, h.amenaza));
        if (h.combo && golpes.length) this.sumarCombo(s, h.combo);
        break;
      case 'grito':
        for (const a of this.aliadosCerca(s, h.radio)) this.ponerAura(a, 'grito', h.dura);
        break;
      case 'muro': this.ponerAura(s, 'muro', h.dura); break;
      // Mago
      case 'misiles':
        for (let i = 0; i < h.golpes; i++) g(pegar(obj, h.mult / h.golpes));
        break;
      case 'nova':
        for (const o of vivos()) {
          if (!enRadio(o, h.radio)) continue;
          g(pegar(o, h.mult));
          // A los jefes solo los frena un momento (para poder alejarse).
          if (!o.muere) this.ponerAuraMon(o, 'raiz', (o.jefe ? h.raiz * 0.4 : h.raiz) * ((sp && sp.raiz) || 1));
        }
        break;
      case 'polimorfia': this.ponerAuraMon(obj, 'oveja', h.dura); break;
      case 'evocacion': s.rec = Math.min(s.st.recMax, s.rec + s.st.recMax * 0.6); break;
      case 'bloque': this.ponerAura(s, 'bloque', h.dura); break;
      case 'meteoros':
        for (const o of vivos()) if (Math.abs(o.x - s.x) < h.radio) g(pegar(o, o.jefe ? h.multJefe : h.mult));
        break;
      // Sacerdote
      case 'sanar': this.curar(s, obj, s.st.atk * h.cura); break;
      case 'escudo_poder': {
        const abs = Math.round(s.st.atk * h.absorbe * ((sp && sp.cura) || 1) * (1 + talento(c, 'sanacion')));
        // La amenaza y la participacion llegan cuando absorbe (ver herir).
        this.ponerAura(obj, 'escudoPoder', h.dura, { abs, de: s.id });
        this.ponerAura(obj, 'almaDebil', 12000);
        break;
      }
      case 'dolor': {
        const tick = Math.max(1, Math.round(s.st.atk * h.mult * mh / 5 * multForja((c.forja || {})[c.arma])));
        this.ponerAuraMon(obj, 'dolor', h.dura, { de: s.id, tick, prox: ahora + 3000 });
        obj.amen.set(s.id, (obj.amen.get(s.id) || 0) + tick);
        obj.dano.set(s.id, (obj.dano.get(s.id) || 0) + 1);
        s.combateT = ahora;
        break;
      }
      case 'renovar':
        this.ponerAura(obj, 'renovar', h.dura, { de: s.id, cura: Math.round(s.st.atk * h.cura / 4), prox: ahora + 3000 });
        break;
      case 'rezo': for (const a of this.aliadosCerca(s, h.radio)) this.curar(s, a, s.st.atk * h.cura); break;
      case 'supresion': this.ponerAura(obj, 'supresion', h.dura); break;
      case 'resurreccion': this.resucitar(obj, s); break;
      // Picaro
      case 'siniestro':
        if (g(pegar(obj, h.mult, h.amenaza))) this.sumarCombo(s, h.combo);
        break;
      case 'eviscerar': {
        const cp = s.combo || 0;
        s.combo = 0;
        g(pegar(obj, h.mult + h.porCombo * cp));
        ev.cp = cp;
        break;
      }
      case 'sigilo': this.ponerAura(s, 'sigilo', 0); break;
      // Interrupciones (cada clase tiene una).
      case 'patada': case 'zurrar': case 'contrahechizo': case 'silencio':
        g(pegar(obj, h.mult));
        if (obj.cast && obj.cast.int) this.interrumpir(obj, h.interrumpe);
        else if (h.id === 'silencio' && !obj.muere) this.ponerAuraMon(obj, 'silencio', h.interrumpe);
        break;
      case 'evasion': this.ponerAura(s, 'evasion', h.dura); break;
      case 'desvanecer':
        for (const o of w.mons.values()) {
          o.amen.delete(s.id);
          if (o.au.provoca && o.au.provoca.sid === s.id) delete o.au.provoca;
        }
        s.combateT = 0;
        this.ponerAura(s, 'sigilo', 0);
        break;
    }
    this.robarVida(s, golpes.reduce((a, x) => a + x[1], 0));
    if (ahora - (s.combateT || 0) < 5000) this.progresoTarea(s, 'hab');
    s.sucio = true;
    this.aClave(s.k, ev);
    if (cdReal) this.enviar(s, { t: 'cd', id: 'h_' + h.id, hasta: cdReal });
  },

  // Solo los hechizos con barra naranja (int) se pueden cortar.
  interrumpir(o, ms) {
    if (!o.cast || !o.cast.int) return;
    o.cast = null;
    this.ponerAuraMon(o, 'silencio', ms);
    this.aClave(o.cl, { t: 'mcastFin', id: o.id, int: 1 });
  },

  resucitar(a, de) {
    if (!a || !a.muerto) return;
    a.muerto = false;
    a.hp = Math.round(a.st.maxHp * 0.5);
    const cl = CLASES[a.c.clase];
    a.rec = !cl ? 0 : cl.recurso === 'mana' ? a.st.recMax * 0.5 : cl.recurso === 'energia' ? 100 : 0;
    a.inv = Date.now() + 2000;
    a.golpeT = Date.now();
    this.aClave(a.k, { t: 'res', p: a.id, de: de ? de.c.nombre : '' });
    this.reponerElixires(a);
    this.actualizarYo(a);
    this.guardar(a);
  },

  // Piedra de hogar: 6 s quieto y sin recibir golpes para volver al pueblo.
  regreso(s) {
    if (s.muerto || s.cast || (s.k === 'pueblo') || this.aura(s, 'bloque') || this.aura(s, 'aturdido')) return;
    const ahora = Date.now();
    if (ahora < (s.gcdHasta || 0)) return;
    if (ahora < (s.cdHogar || 0)) return this.no(s, `La Piedra de Hogar se recarga en ${Math.ceil((s.cdHogar - ahora) / 1000)} s.`);
    s.gcdHasta = ahora + GCD_MS;
    s.cast = { h: 'hogar', fin: ahora + HOGAR_MS, x: s.x, y: s.y, tg: 0 };
    this.aClave(s.k, { t: 'cast', p: s.id, id: 'hogar', ms: HOGAR_MS });
  },

  // ── CADA TICK ──
  tickJugador(s, ahora, dt, seguro) {
    if (s.cast) this.revisarCast(s, ahora);
    if (s.muerto) return;
    const cl = CLASES[s.c.clase];
    if (cl) {
      const max = s.st.recMax;
      const sab = 1 + talento(s.c, 'sabiduria');
      if (cl.recurso === 'mana') {
        // La regla de los 5 segundos de WoW: el mana vuelve rapido si llevas
        // 5 s sin gastar, y casi nada mientras lanzas sin parar.
        const k = seguro ? 0.1 : (ahora - (s.gastoT || 0) > 5000 ? 0.04 : 0.008);
        s.rec = Math.min(max, s.rec + max * k * sab * dt);
      } else if (cl.recurso === 'energia') { const sp = this.especDe(s); s.rec = Math.min(max, s.rec + 20 * ((sp && sp.energia) || 1) * sab * dt); }
      else if (cl.recurso === 'ira' && ahora - (s.combateT || 0) > 6000) s.rec = Math.max(0, s.rec - 3 * dt);
    }
    const r = s.au && s.au.renovar;
    if (r && ahora >= r.prox && ahora <= r.hasta + 150) {
      r.prox += 3000;
      const de = this.sesiones.get(r.de);
      this.curar(de && de.c ? de : null, s, r.cura);
    }
    if (s.au) for (const a in s.au) if (s.au[a].hasta < ahora) delete s.au[a];
  },

  tickMonstruo(o, ahora) {
    const d = o.au.dolor;
    if (d && !o.muere && ahora >= d.prox && ahora <= d.hasta + 150) {
      d.prox += 3000;
      const s = this.sesiones.get(d.de);
      const quien = s && s.c && s.k === o.cl ? s : null;
      this.aClave(o.cl, { t: 'at', p: d.de, s: -3, f: 1, h: [[o.id, d.tick, 5]] });
      this.danar(o, d.tick, quien, 1);
    }
    for (const a in o.au) if (o.au[a].hasta < ahora) delete o.au[a];
  },
};
