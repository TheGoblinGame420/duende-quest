// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — el mundo abierto en el servidor
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Es el MISMO servidor y el MISMO personaje que el juego 2D: nivel, clase,
// oro, skins, equipo, misiones, diarias, bestiario, chicha y pase avanzan
// igual (las cazas pasan por dar()). Solo cambia el mundo: un mapa continuo
// (mmo/js/mundo3d.js) donde la posicion es (x, z) en metros.
//
// Quien entra con { t: 'hola', modo: '3d' } queda con s.m3 = true y s.k =
// '~3d': sus mensajes van a recibir3d() y el bucle 2D no lo toca (tick()
// lo aparta en tick3d()). La posicion 3D vive en s.p y se guarda en c.p3; la
// del 2D (c.mapa, c.x) no se toca.
//
// Monstruos: viven en campamentos fijos y solo existen cerca de jugadores
// (se crean al acercarse alguien y se retiran si nadie esta cerca), asi un
// mundo grande no gasta CPU. Pasivos como en el 2D salvo los jefes.
// ═══════════════════════════════════════════════════════
import {
  MAPAS, MONSTRUOS, SKINS, ARMAS, CLASES, PODERES, VARA, statsMonstruo, multForja, talento, velMontura, xpParaSubir,
  habPorId, costoHab, GCD_MS, RECURSOS, MELEE, MUNDIAL_CADA_MS, MUNDIAL_DURA_MS, proximoMundial, mundialDe,
} from '../../mmo/js/data.js';
import { MUNDO, NPCS3D, NPC_DIST, SPAWN3D, ARENA3D, campamentos, zonaEn } from '../../mmo/js/mundo3d.js';

export const K3 = '~3d';
const VISTA_MON = 120;          // m: monstruos que ve cada jugador
const ACTIVO = 170;             // m: un campamento se puebla si hay alguien a esta distancia
const RETIRAR = 240;            // m: y se vacia si nadie queda a esta
const REAPARECE_MS = 20000;
const REAPARECE_JEFE_MS = 5 * 60 * 1000;
const CORREA = 50;              // m: un monstruo no se aleja mas de su campamento
const MELEE3D = 3.2;              // m: alcance del golpe cuerpo a cuerpo (x arma.alcance)
const RANGO_VARA = 24;          // m: disparo de vara de magos y sacerdotes
const MON_MELEE = 2.4, MON_DISPARO = 15;
const FOTO_CADA = 2;            // ticks entre fotos (200 ms)
// Jefe mundial del 3D: a las :15 y :45 (el del Coliseo 2D sale a las :00 y :30).
const DESFASE_MUNDIAL3 = 15 * 60 * 1000;
const PISOTON_CADA = 12000, PISOTON_AVISO = 2500, PISOTON_R = 9;
export const proximoMundial3 = ahora => proximoMundial(ahora - DESFASE_MUNDIAL3) + DESFASE_MUNDIAL3;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const r1 = v => Math.round(v * 10) / 10;

export const Mundo3D = {
  iniciar3d() {
    if (this.m3) return this.m3;
    const campos = campamentos(MAPAS, MONSTRUOS).map(c => ({ ...c, vivos: new Set(), prox: 0 }));
    return (this.m3 = { mons: new Map(), campos, sig: 1, foto: 0 });
  },
  sesiones3d() { const l = []; for (const s of this.sesiones.values()) if (s.c && s.m3 && !s.cerrado) l.push(s); return l; },

  // ── ENTRAR ──
  entrar3d(s) {
    this.iniciar3d();
    const c = s.c;
    s.m3 = true;
    s.k = K3;
    const p = c.p3 && num(c.p3.x) !== null && num(c.p3.z) !== null ? c.p3 : SPAWN3D;
    s.p = { x: clamp(p.x, -MUNDO.limite, MUNDO.limite), z: clamp(p.z, -MUNDO.limite, MUNDO.limite) };
    s.ry = 0; s.a = 0; s.h = 0; s.movT = Date.now(); s.movBud = undefined; s.vistos = new Set(); s.atkT = 0;
    const jugadores = this.sesiones3d().filter(x => x !== s).map(x => this.info3d(x));
    this.enviar(s, { t: 'm3', id: s.id, x: r1(s.p.x), z: r1(s.p.z), jugadores });
    this.enviar(s, this.estadoMundial3());
    this.aClave(K3, { t: 'pj3', p: this.info3d(s) }, s);
  },
  info3d(s) {
    return { ...this.infoApariencia(s), n: s.c.nombre, lv: s.c.nivel, x: r1(s.p.x), z: r1(s.p.z), r: s.ry || 0, hp: Math.ceil(s.hp), muerto: !!s.muerto };
  },
  cerca3d(s, tipo) {
    const n = NPCS3D.find(x => x.tipo === tipo);
    return !!(s.m3 && n && !s.muerto && Math.hypot(s.p.x - n.x, s.p.z - n.z) <= NPC_DIST + 2);
  },

  // ── MENSAJES ──
  recibir3d(s, m) {
    switch (m.t) {
      case 'mv3': return this.mover3d(s, m);
      case 'atk3': return this.atacar3d(s, m);
      case 'pw': return this.poder3d(s, m);
      case 'hab3': return this.hab3d(s, m);
      case 'cancelar': return this.cancelarCast(s);
      case 'montar': return this.montar(s);   // mismo lanzamiento de 1,5 s que el 2D
      case 'revivir': return this.revivir3d(s);
      case 'mision': if (this.cerca3d(s, 'guia')) return this.mision(s, m, true); return this.no(s, 'Habla con el Guardia Tito en el pueblo.');
      case 'comprar': return this.comprar(s, m);   // cercaDelMercader() sabe del 3D
      case 'chat':
        // Moderadores: /jefe invoca al jefe mundial del 3D.
        if (String(m.m || '').trim() === '/jefe' && this.esDios(s)) return this.dios(s, { a: 'mundial3' });
        return this.chat(s, m);
      case 'clase': return this.elegirClase(s, m);
      case 'espec': return this.elegirEspec(s, m);
      case 'talento': return this.subirTalento(s, m);
      case 'talentoReset': return this.reiniciarTalentos(s);
      case 'equipar': return this.equipar(s, m);
      case 'item': return this.item(s, m);
      case 'titulo': return this.ponerTitulo(s, m);
      case 'pedido': return this.pedido(s, m);
      case 'pedidoFirma': return this.pedidoFirma(s, m);
      case 'pedidoBuscar': return this.pedidoBuscar(s, m);
      case 'ranking': return this.enviarRanking(s);
      case 'contactos': return this.enviarContactos(s);
      case 'quien': return this.quien(s);
      case 'ping': return this.enviar(s, { t: 'pong', ts: m.ts });
      case 'dios':
        // En el 3D no hay viajes de mapa 2D: el resto del panel funciona igual.
        if (['tp', 'irA', 'traer'].includes(m.a)) return this.no(s, 'En el mundo 3D usa el mapa para moverte.');
        return this.dios(s, m);
    }
  },

  // ── MOVIMIENTO ──
  // Presupuesto de distancia que se recarga con el tiempo (igual que el 2D):
  // correr, la montura y un margen por latencia.
  mover3d(s, m) {
    if (s.muerto) return;
    const x = num(m.x), z = num(m.z);
    if (x === null || z === null) return;
    const ahora = Date.now();
    const dt = Math.max(16, ahora - s.movT);
    s.movT = ahora;
    const nx = clamp(x, -MUNDO.limite, MUNDO.limite), nz = clamp(z, -MUNDO.limite, MUNDO.limite);
    const d = Math.hypot(nx - s.p.x, nz - s.p.z);
    if (!(s.dios && s.diosModo && s.diosModo.vel)) {
      const vel = MUNDO.velocidad * (m.a === 3 ? 1.3 : velMontura(s.montado)) * (1 + talento(s.c, 'agilidad'));
      const tope = vel + 4;
      s.movBud = Math.min(tope, (s.movBud === undefined ? tope : s.movBud) + vel * 1.25 * dt / 1000);
      if (d > s.movBud + 1) { this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) }); return; }
      s.movBud = Math.max(0, s.movBud - d);
    }
    if (s.cast && d > 0.3) this.cancelarCast(s, s.cast.h === 'montar' ? '' : 'Te moviste: el lanzamiento se canceló.');
    s.p.x = nx; s.p.z = nz;
    s.ry = num(m.r) || 0;
    s.a = clamp(m.a | 0, 0, 4);
    // Altura de vuelo (las alas): en el pueblo no se vuela.
    s.h = s.a === 3 && zonaEn(nx, nz) !== 'pueblo' ? clamp(num(m.h) || 0, 0, 50) : 0;
    s.c.p3 = { x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10 };
    s.sucio = true;
  },

  // ── COMBATE ──
  // Ataque automatico al objetivo: cuerpo a cuerpo un golpe por segundo (el
  // mismo daño por segundo que el combo del 2D) y la vara a su ritmo.
  atacar3d(s, m) {
    if (s.muerto) return;
    // Para combatir hay que estar en el suelo (o casi).
    if (s.h > 4) return this.no(s, 'Aterriza para combatir.');
    const W = this.iniciar3d();
    const o = W.mons.get(m.tg | 0);
    if (!o || o.muere) return;
    const ahora = Date.now();
    if (ahora < (s.atkT || 0)) return;
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    const vara = !!(CLASES[s.c.clase] && CLASES[s.c.clase].basico === 'vara');
    const rango = vara ? RANGO_VARA : MELEE3D * (arma.alcance || 1) + (o.jefe ? 1.2 : 0.4);
    if (dist(s.p, o) > rango) return this.no(s, 'Fuera de alcance.');
    s.atkT = ahora + (vara ? VARA.cdMs * arma.cd : 1000 * arma.cd) - 40;
    const crit = Math.random() < s.st.crit;
    const forja = multForja((s.c.forja || {})[s.c.arma]);
    const mult = vara ? VARA.mult : 3.6 * (arma.dano || 1);
    const dmg = Math.max(1, Math.round(s.st.atk * mult * forja * rnd(0.9, 1.1) * (crit ? 1.8 : 1)
      * (ahora < s.fuego ? 1.5 : 1) * (this.elixir(s, 'elixirF') ? 1.1 : 1)));
    if (s.montado) this.desmontar(s);
    const real = this.danar3d(o, dmg, s);
    this.aClave(K3, { t: 'at3', p: s.id, tg: o.id, d: real, c: crit ? 1 : 0, v: vara ? 1 : 0 });
    const robo = ((SKINS[s.c.skin] || {}).buffs || {}).robo || 0;
    if (robo) s.hp = Math.min(s.st.maxHp, s.hp + real * robo);
  },

  danar3d(o, dmg, s) {
    if (o.muere) return 0;
    if (s && s.dios && s.diosModo && s.diosModo.golpe) dmg = Math.ceil(o.hp);
    dmg = Math.min(dmg, Math.ceil(o.hp));
    o.hp -= dmg;
    o.golpeT = Date.now();
    if (o.au.oveja) this.quitarAuraMon(o, 'oveja');
    if (s) {
      o.dano.set(s.id, (o.dano.get(s.id) || 0) + dmg);
      const cl = CLASES[s.c.clase];
      o.amen.set(s.id, (o.amen.get(s.id) || 0) + dmg * (cl ? cl.amenaza : 1));
      s.combateT = Date.now();
      if (!o.obj) o.obj = s.id;
    }
    if (o.hp <= 0) this.matar3d(o);
    return dmg;
  },

  matar3d(o) {
    const W = this.iniciar3d();
    o.muere = true; o.hp = 0; o.borrarEn = Date.now() + 1600;
    if (o.mundial3) {
      this.premiosMundial(o, K3);
      this.aClave(K3, { t: 'md3', id: o.id });
      W.mundial.o = null;
      this.aClave(K3, this.estadoMundial3());
      return;
    }
    const base = statsMonstruo(o.k, o.nv);
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const cobraron = new Set();
    for (const [sid, d] of o.dano) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || !s.m3 || s.muerto) continue;
      const parte = d / total;
      const k = o.jefe ? Math.max(parte, 1 / 3) : parte;
      const mult = (((SKINS[s.c.skin] || {}).buffs || {}).oroMult || 1) * (1 + talento(s.c, 'fortuna'));
      const xp = Math.max(1, Math.round(base.xp * k * (1 + talento(s.c, 'erudicion'))));
      const oro = Math.max(1, Math.round(base.oro * k * rnd(0.8, 1.2) * mult));
      // dar(): misiones, diarias, bestiario, chicha, pase, botin... lo mismo que el 2D.
      this.dar(s, xp, oro, o, 1, true);
      cobraron.add(sid);
      if (o.jefe && parte >= 0.1) this.darMton(s, 20 * Math.max(0.3, MONSTRUOS[o.k].nivel / 30), 'jefe');
    }
    // Caza cooperativa: quien este cerca se lleva el 25% de la experiencia.
    for (const s of this.sesiones3d()) {
      if (cobraron.has(s.id) || s.muerto || dist(s.p, o) > 40) continue;
      const xp = Math.max(1, Math.round(base.xp * 0.25));
      this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro: 0, drops: [], coop: true });
      this.actualizarYo(s);
    }
    const campo = W.campos[o.campo];
    if (campo) { campo.vivos.delete(o.id); campo.prox = Date.now() + (o.jefe ? REAPARECE_JEFE_MS : REAPARECE_MS); }
    this.aClave(K3, { t: 'md3', id: o.id });
    if (o.jefe) {
      const quien = [...cobraron].map(id => this.sesiones.get(id)?.c?.nombre).filter(Boolean).slice(0, 4).join(', ');
      this.aTodos({ t: 'aviso', m: `${MONSTRUOS[o.k].nombre} fue derrotado en el mundo 3D${quien ? ' por ' + quien : ''}.` });
    }
  },

  // Consumibles: los mismos efectos; el Rayo golpea todo lo que esta cerca.
  poder3d(s, m) {
    if (s.muerto) return;
    const def = PODERES[m.i | 0];
    if (!def) return;
    const ahora = Date.now();
    if ((s.c.pw[def.id] || 0) <= 0) return this.enviar(s, { t: 'toast', m: `No te quedan ${def.nombre}s. Cómpralos al Mercader del pueblo.` });
    if (ahora < (s.cdPw[def.id] || 0)) return;
    s.c.pw[def.id]--;
    s.cdPw[def.id] = ahora + def.cd;
    if (def.id === 'pocion') {
      s.hp = Math.min(s.st.maxHp, s.hp + s.st.maxHp * 0.5);
      if (CLASES[s.c.clase] && CLASES[s.c.clase].recurso === 'mana') s.rec = Math.min(s.st.recMax, s.rec + s.st.recMax * 0.3);
    }
    if (def.id === 'escudo') s.escudo = ahora + 5000;
    if (def.id === 'fuego') s.fuego = ahora + 8000;
    if (def.id === 'rayo') {
      for (const o of this.iniciar3d().mons.values()) {
        if (o.muere || dist(o, s.p) > 14) continue;
        const d = this.danar3d(o, Math.round(s.st.atk * (o.jefe ? 2 : 4)), s);
        this.aClave(K3, { t: 'at3', p: s.id, tg: o.id, d, c: 0, rayo: 1 });
      }
    }
    s.sucio = true;
    this.aClave(K3, { t: 'pw', p: s.id, i: m.i | 0 });
    this.enviar(s, { t: 'cd', id: def.id, hasta: def.cd });
    this.actualizarYo(s);
  },

  // Revivir en el cementerio del pueblo (mismo castigo que el 2D).
  revivir3d(s) {
    if (!s.muerto) return;
    const c = s.c;
    if (c.nivel >= 10) c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
    s.muerto = false;
    s.hp = s.st.maxHp;
    this.recursoInicial(s);
    s.inv = Date.now() + 2000;
    s.p = { x: SPAWN3D.x, z: SPAWN3D.z };
    c.p3 = { ...s.p };
    s.movBud = undefined;
    this.enviar(s, { t: 'tp3', x: s.p.x, z: s.p.z });
    this.aClave(K3, { t: 'pj3', p: this.info3d(s) }, s);
    this.actualizarYo(s);
    this.guardar(s);
  },

  // ── CADA TICK ──
  tick3d(ahora, jugadores) {
    const W = this.iniciar3d();
    if (!jugadores.length) {
      if (W.mons.size) W.mons.clear();
      return;
    }
    const dt = 0.1;
    // Vida y recurso (rapida en el pueblo y tras 4 s sin golpes en el campo).
    for (const s of jugadores) {
      const seguro = zonaEn(s.p.x, s.p.z) === 'pueblo';
      if (s.cast && habPorId(s.cast.h) && ahora >= s.cast.fin) this.finCast3d(s);
      this.tickJugador(s, ahora, dt, seguro);
      if (s.muerto || s.hp >= s.st.maxHp) continue;
      const k = seguro ? 0.12 : (ahora - (s.golpeT || 0) > 4000 ? 0.04 : 0);
      if (k) s.hp = Math.min(s.st.maxHp, s.hp + s.st.maxHp * k * dt);
    }
    const vivos = jugadores.filter(s => !s.muerto);
    // Campamentos: se pueblan cerca de alguien.
    for (const c of W.campos) {
      let cerca = Infinity;
      for (const s of jugadores) { const d = dist(s.p, c); if (d < cerca) cerca = d; }
      if (cerca < ACTIVO && c.vivos.size < c.n && ahora >= c.prox) {
        this.crear3d(c);
        c.prox = ahora + 1500;
      }
    }
    this.revisarMundial3(ahora, jugadores);
    // Monstruos.
    for (const o of [...W.mons.values()]) {
      if (o.muere) { if (ahora >= o.borrarEn) W.mons.delete(o.id); continue; }
      // Nadie cerca: se retira (vuelve a aparecer cuando alguien se acerque).
      if (!o.obj && !o.mundial3 && !vivos.some(s => dist(s.p, o) < RETIRAR)) {
        W.mons.delete(o.id);
        const c = W.campos[o.campo]; if (c) c.vivos.delete(o.id);
        continue;
      }
      this.ia3d(o, vivos, ahora);
    }
    // Fotos del mundo (cada 200 ms).
    if (++W.foto % FOTO_CADA === 0) this.fotos3d(W, jugadores);
  },

  crear3d(c) {
    const W = this.iniciar3d();
    const def = MONSTRUOS[c.k];
    const st = statsMonstruo(c.k, def.nivel);
    const ang = Math.random() * Math.PI * 2, r = c.jefe ? 0 : rnd(1, 5);
    const o = {
      id: W.sig++, k: c.k, nv: def.nivel, campo: c.id, jefe: !!c.jefe || !!def.jefe, dispara: !!def.dispara,
      x: c.x + Math.cos(ang) * r, z: c.z + Math.sin(ang) * r, hx: c.x, hz: c.z, ry: 0,
      hp: st.hp, max: st.hp, atk: st.atk, vel: st.vel, y: 0, h: 0,
      dano: new Map(), amen: new Map(), au: {}, cl: K3, obj: 0, atkEn: 0, golpeT: 0, st: 0, paseo: 0, destino: null,
    };
    W.mons.set(o.id, o);
    c.vivos.add(o.id);
    if (o.jefe) this.aTodos({ t: 'aviso', m: `${def.nombre} ha aparecido en el mundo 3D (${MAPAS[c.zona].nombre}).` });
    return o;
  },

  // Inteligencia: pasea por su campamento; si le pegan (o es un jefe y te
  // acercas) persigue y ataca; si se aleja demasiado de casa, vuelve y se cura.
  // ── JEFE MUNDIAL DEL 3D ──
  // Mismo calendario que el del Coliseo pero desfasado 15 min; vida segun
  // los jugadores del 3D; cada golpe quita un % de la vida (todos los niveles
  // pelean juntos) y cada 12 s un pisoton que se ve venir en el suelo.
  estadoMundial3() {
    const M = this.iniciar3d().mundial;
    const vivo = !!(M && M.o && !M.o.muere);
    const en = proximoMundial3(Date.now());
    return { t: 'mundial3', vivo, en: vivo ? 0 : en, k: vivo ? M.o.k : mundialDe(en - DESFASE_MUNDIAL3 + 1000), x: ARENA3D.x, z: ARENA3D.z, hasta: vivo ? M.hasta : 0 };
  },
  revisarMundial3(ahora, jugadores) {
    const W = this.iniciar3d();
    const M = W.mundial || (W.mundial = { avisado: 0, ultimo: 0, o: null, hasta: 0 });
    if (M.o) {
      const o = M.o;
      if (o.muere) return;
      if (ahora > M.hasta) {
        W.mons.delete(o.id);
        this.aClave(K3, { t: 'md3', id: o.id, huye: 1 });
        M.o = null;
        this.aClave(K3, { t: 'aviso', m: `${MONSTRUOS[o.k].nombre} se marchó del ${ARENA3D.nombre}… vuelve en 30 minutos.` });
        this.aClave(K3, this.estadoMundial3());
        return;
      }
      // Pisoton: aviso en el suelo y, 2,5 s despues, daño a quien siga dentro.
      if (o.pisa && ahora >= o.pisa.en) {
        for (const s of jugadores) {
          if (s.muerto || s.h > 4 || Math.hypot(s.p.x - o.pisa.x, s.p.z - o.pisa.z) > PISOTON_R) continue;
          this.herir(s, 1, { zona: true, pct: o.enfurecido ? 0.45 : 0.3, id: o.id });
        }
        this.aClave(K3, { t: 'zona3f', id: o.id });
        o.pisa = null;
      }
      if (!o.pisa && ahora >= o.pisaProx && o.obj) {
        const s = this.sesiones.get(o.obj);
        if (s && s.m3) {
          o.pisa = { x: s.p.x, z: s.p.z, en: ahora + PISOTON_AVISO };
          o.pisaProx = ahora + PISOTON_CADA * (o.enfurecido ? 0.6 : 1);
          this.aClave(K3, { t: 'zona3', id: o.id, x: r1(s.p.x), z: r1(s.p.z), r: PISOTON_R, ms: PISOTON_AVISO });
        }
      }
      if (!o.enfurecido && o.hp < o.max * 0.3) {
        o.enfurecido = true;
        this.aClave(K3, { t: 'aviso', m: `¡${MONSTRUOS[o.k].nombre} se enfurece! Sus pisotones son más rápidos.` });
      }
      return;
    }
    const prox = proximoMundial3(ahora);
    if (prox - ahora <= 120000 && prox - ahora > 5000 && M.avisado !== prox) {
      M.avisado = prox;
      this.aClave(K3, { t: 'aviso', m: `${MONSTRUOS[mundialDe(prox - DESFASE_MUNDIAL3 + 1000)].nombre} llega al ${ARENA3D.nombre} en 2 minutos (marcado en el mapa).` });
    }
    const ult = prox - (prox - ahora > 1000 ? MUNDIAL_CADA_MS : 0);
    if (ahora >= ult && ahora - ult < 5000 && M.ultimo !== ult && jugadores.length) {
      M.ultimo = ult;
      this.aparecerMundial3(mundialDe(ult - DESFASE_MUNDIAL3 + 1000), jugadores.length);
    }
  },
  aparecerMundial3(k, n) {
    const W = this.iniciar3d();
    const M = W.mundial || (W.mundial = { avisado: 0, ultimo: 0, o: null, hasta: 0 });
    const def = MONSTRUOS[k];
    const st = statsMonstruo(k, def.nivel);
    const o = {
      id: W.sig++, k, nv: def.nivel, campo: -1, jefe: true, mundial3: true, dispara: !!def.dispara,
      x: ARENA3D.x, z: ARENA3D.z, hx: ARENA3D.x, hz: ARENA3D.z, ry: 0,
      hp: 20000 + 15000 * Math.max(1, n), max: 0, atk: st.atk, vel: st.vel, y: 0, h: 0,
      dano: new Map(), amen: new Map(), au: {}, cl: K3, obj: 0, atkEn: 0, golpeT: 0, st: 0, paseo: 0, destino: null,
      pisa: null, pisaProx: Date.now() + 8000, enfurecido: false,
    };
    o.max = o.hp;
    W.mons.set(o.id, o);
    M.o = o; M.hasta = Date.now() + MUNDIAL_DURA_MS;
    this.aClave(K3, { t: 'aviso', m: `${def.nombre} ha aparecido en el ${ARENA3D.nombre}. Tienes 10 minutos: ¡todos los niveles reciben premio!` });
    this.aClave(K3, this.estadoMundial3());
    return o;
  },

  ia3d(o, vivos, ahora) {
    const dt = 0.1;
    const casa = { x: o.hx, z: o.hz };
    // Palabra de Dolor: daño cada 3 s.
    const dol = o.au.dolor;
    if (dol && ahora >= dol.prox && ahora <= dol.hasta + 150) {
      dol.prox += 3000;
      const de = this.sesiones.get(dol.de);
      const d = this.danar3d(o, dol.tick, de && de.m3 ? de : null);
      this.aClave(K3, { t: 'at3', p: dol.de, tg: o.id, d, c: 0, dot: 1 });
      if (o.muere) return;
    }
    for (const a in o.au) if (o.au[a].hasta < ahora) delete o.au[a];
    if (this.auraMon(o, 'aturdido') || this.auraMon(o, 'oveja')) { o.st = 0; return; }
    const prov = this.auraMon(o, 'provoca');
    if (o.mundial3 && !prov) {
      let mejor = 0, quien = 0;
      for (const [sid, a] of o.amen) { const x = this.sesiones.get(sid); if (a > mejor && x && x.m3 && !x.muerto && !(x.h > 8) && dist(x.p, casa) < CORREA + 20) { mejor = a; quien = sid; } }
      if (quien) o.obj = quien;
    }
    if (prov) o.obj = prov.sid;
    let s = o.obj ? this.sesiones.get(o.obj) : null;
    if (s && (!s.m3 || s.muerto || s.cerrado || s.h > 8 || dist(s.p, casa) > CORREA + 20)) { s = null; o.obj = 0; o.vuelve = true; }
    if (!s && o.jefe && !o.vuelve) {
      const cerca = vivos.find(x => dist(x.p, o) < 16 && !this.aura(x, 'sigilo') && !(x.h > 8));
      if (cerca) { o.obj = cerca.id; s = cerca; }
    }
    const velC = 4.2 * (o.vel || 1);
    const mover = (tx, tz, v) => {
      const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
      if (d < 0.05) return 0;
      const paso = Math.min(d, v * dt);
      o.x += dx / d * paso; o.z += dz / d * paso; o.ry = Math.atan2(dx, dz);
      return d - paso;
    };
    if (s) {
      o.vuelve = false;
      const silencio = this.auraMon(o, 'silencio');
      const alcance = o.dispara && !silencio ? MON_DISPARO : MON_MELEE + (o.jefe ? 1 : 0);
      const d = dist(o, s.p);
      if (d > alcance) { if (!this.auraMon(o, 'raiz')) mover(s.p.x, s.p.z, velC); o.st = 1; }
      else {
        o.st = 2;
        o.ry = Math.atan2(s.p.x - o.x, s.p.z - o.z);
        if (ahora >= o.atkEn) {
          o.atkEn = ahora + (o.jefe ? 1250 : 1600);
          const golpe = o.atk * (o.jefe ? 0.7 : 1) * (o.dispara ? 0.9 : 1);
          if (o.dispara) this.aClave(K3, { t: 'b3', de: o.id, a: s.id });
          this.herir(s, golpe, { jefe: o.jefe, bala: o.dispara, mundial: o.mundial3, id: o.id });
        }
      }
      if (dist(o, casa) > CORREA) { o.obj = 0; o.vuelve = true; }
      return;
    }
    if (o.vuelve) {
      o.st = 1;
      if (mover(casa.x, casa.z, velC * 1.3) < 0.5) { o.vuelve = false; o.hp = o.max; o.dano.clear(); o.amen.clear(); o.st = 0; }
      return;
    }
    // Paseo tranquilo por el campamento.
    if (!o.destino || ahora >= o.paseo) {
      if (Math.random() < 0.5) o.destino = { x: o.hx + rnd(-7, 7), z: o.hz + rnd(-7, 7) };
      o.paseo = ahora + rnd(3000, 7000);
    }
    if (o.destino) { o.st = mover(o.destino.x, o.destino.z, 1.4) > 0.1 ? 1 : 0; if (!o.st) o.destino = null; }
    else o.st = 0;
  },

  // ── HABILIDADES DE CLASE ──
  // Las mismas de HABS (data.js) con sus costes, recargas, GCD, lanzamientos
  // y efectos; solo cambian las distancias: el 2D media en pixeles en una
  // linea y aqui son metros en el plano (rango / 17; el cuerpo a cuerpo usa
  // el alcance del arma).
  metros(px, s) {
    if (px === MELEE) { const arma = ARMAS[s.c.arma] || ARMAS.katana; return MELEE / 33 * (arma.alcance || 1) + 0.6; }
    return px / 17;
  },
  enemigo3d(s, tg, rango, min) {
    const W = this.iniciar3d();
    const ok = o => o && !o.muere && dist(o, s.p) <= rango + (o.jefe ? 1.2 : 0.4) && (!min || dist(o, s.p) >= min);
    if (typeof tg === 'number' && tg > 0) { const o = W.mons.get(tg); return ok(o) ? o : null; }
    let mejor = null, md = Infinity;
    for (const o of W.mons.values()) { if (!ok(o)) continue; const d = dist(o, s.p); if (d < md) { md = d; mejor = o; } }
    return mejor;
  },
  aliado3d(s, tg, rango, muerto) {
    if (typeof tg !== 'number' || tg <= 0 || tg === s.id) {
      if (!muerto) return s;
      return this.sesiones3d().find(a => a !== s && a.muerto && dist(a.p, s.p) <= rango) || null;
    }
    const a = this.sesiones.get(tg);
    if (!a || !a.c || !a.m3 || !!a.muerto !== !!muerto) return null;
    return dist(a.p, s.p) <= rango ? a : null;
  },
  aliadosCerca3d(s, radio) { return this.sesiones3d().filter(a => !a.muerto && dist(a.p, s.p) <= radio); },

  hab3d(s, m) {
    const c = s.c;
    const h = habPorId(m.id);
    if (!h || h.clase !== c.clase || s.muerto) return;
    if (s.h > 4) return this.no(s, 'Aterriza para combatir.');
    if (c.nivel < h.nv) return this.no(s, `Aprendes ${h.nombre} a nivel ${h.nv}.`);
    if (this.aura(s, 'bloque')) return;
    if (this.aura(s, 'aturdido')) return this.no(s, 'Estás aturdido.');
    const ahora = Date.now();
    if (s.cast) return this.no(s, 'Ya estás lanzando otro hechizo.');
    if (ahora < (s.cdHab[h.id] || 0)) return this.no(s, `${h.nombre} todavía no está lista.`);
    if (h.gcd !== false && ahora < (s.gcdHasta || 0) - 80) return;
    const costo = costoHab(h, s.st.recMax, s.c.espec);
    if (s.rec < costo) return this.no(s, `No tienes suficiente ${RECURSOS[CLASES[c.clase].recurso].nombre.toLowerCase()}.`);
    let obj = null;
    const tg = m.tg | 0;
    if (h.obj === 'enemigo') {
      obj = this.enemigo3d(s, tg, this.metros(h.rango, s), h.min ? h.min / 17 : 0);
      if (!obj) {
        const cerca = h.min && this.enemigo3d(s, tg, h.min / 17);
        return this.no(s, cerca ? 'Estás demasiado cerca.' : 'No hay ningún enemigo al alcance.');
      }
      if (h.bajo && obj.hp / obj.max > h.bajo) return this.no(s, 'Solo funciona con enemigos casi muertos.');
      if (h.id === 'polimorfia' && obj.jefe) return this.no(s, 'Los jefes no se pueden convertir en oveja.');
    } else if (h.obj === 'aliado') {
      obj = this.aliado3d(s, m.tp | 0, this.metros(h.rango, s), false);
      if (!obj) return this.no(s, 'Tu aliado está demasiado lejos.');
      if (h.id === 'escudo_poder' && this.aura(obj, 'almaDebil')) return this.no(s, 'Ese aliado no puede recibir otro escudo todavía (Alma Debilitada).');
    } else if (h.obj === 'muerto') {
      obj = this.aliado3d(s, m.tp | 0, this.metros(h.rango, s) + 2, true);
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
      s.cast = { h: h.id, fin: ahora + h.cast, tg: obj ? obj.id : 0, tk: h.obj === 'enemigo' ? 'm' : 'p' };
      this.aClave(K3, { t: 'cast', p: s.id, id: h.id, ms: h.cast, tg: obj ? obj.id : 0 });
      return;
    }
    this.aplicar3d(s, h, obj);
  },

  // Al terminar el lanzamiento se vuelve a comprobar objetivo y recurso.
  finCast3d(s) {
    const ca = s.cast;
    s.cast = null;
    const h = habPorId(ca.h);
    let obj = null;
    if (h.obj === 'enemigo') {
      const o = this.iniciar3d().mons.get(ca.tg);
      obj = o && !o.muere && dist(o, s.p) <= this.metros(h.rango, s) + 3.5 ? o : null;
    } else if (h.obj === 'aliado' || h.obj === 'muerto') {
      const a = ca.tg === s.id ? s : this.sesiones.get(ca.tg);
      obj = a && a.c && a.m3 && !!a.muerto === (h.obj === 'muerto') && (a === s || dist(a.p, s.p) <= this.metros(h.rango, s) + 3.5) ? a : null;
    }
    const necesita = h.obj === 'enemigo' || h.obj === 'aliado' || h.obj === 'muerto';
    if (s.muerto || (necesita && !obj) || s.rec < costoHab(h, s.st.recMax, s.c.espec)) {
      this.aClave(K3, { t: 'castFin', p: s.id, ok: false });
      if (!s.muerto) this.no(s, necesita && !obj ? 'El objetivo ya no está al alcance.' : 'No tienes suficiente recurso.');
      return;
    }
    this.aClave(K3, { t: 'castFin', p: s.id, ok: true });
    this.aplicar3d(s, h, obj);
  },

  // Daño de jugador a monstruo con todos los modificadores del 2D.
  pegar3d(s, o, mult, amen) {
    if (!o || o.muere) return null;
    const ahora = Date.now();
    let k = 1;
    if (this.aura(s, 'sigilo')) { k = 2; this.quitarAura(s, 'sigilo'); if (s.c.clase === 'picaro') this.sumarCombo(s, 2); }
    const crit = Math.random() < s.st.crit;
    const forja = multForja((s.c.forja || {})[s.c.arma]);
    const dmg = Math.max(1, Math.round(s.st.atk * mult * forja * rnd(0.9, 1.1) * (crit ? 1.8 : 1)
      * (ahora < s.fuego ? 1.5 : 1) * (this.aura(s, 'grito') ? 1.1 : 1) * (this.elixir(s, 'elixirF') ? 1.1 : 1) * k));
    const real = this.danar3d(o, dmg, s);
    if (amen && amen !== 1) o.amen.set(s.id, (o.amen.get(s.id) || 0) + real * (amen - 1));
    return [o.id, real, crit ? 1 : 4];
  },

  aplicar3d(s, h, obj) {
    const ahora = Date.now();
    const c = s.c, cl = CLASES[c.clase];
    s.rec = Math.max(0, s.rec - costoHab(h, s.st.recMax, s.c.espec));
    if (cl.recurso === 'mana' && h.costo) s.gastoT = ahora;
    const cdReal = h.cd ? Math.round(h.cd * (1 - talento(c, 'celeridad'))) : 0;
    if (cdReal) s.cdHab[h.id] = ahora + cdReal;
    const W = this.iniciar3d();
    const golpes = [];
    const ev = { t: 'hb', p: s.id, id: h.id, h: golpes };
    if (obj) { ev.tg = obj.id; ev.tk = h.obj === 'enemigo' ? 'm' : 'p'; }
    const vivos = () => [...W.mons.values()].filter(o => !o.muere);
    const g = x => { if (x) golpes.push(x); return x; };
    const sp = this.especDe(s);
    const mh = (sp && sp.hab && sp.hab[h.id]) || 1;
    const pegar = (o, mult, amen) => this.pegar3d(s, o, mult * mh, amen);
    const radio = h.radio ? h.radio / 17 : 0;
    switch (h.id) {
      case 'golpe_heroico': case 'ejecutar': case 'castigo': case 'bola_fuego':
        g(pegar(obj, h.mult, h.amenaza)); break;
      case 'carga': {
        // Aparece junto al objetivo (embestida).
        const dx = obj.x - s.p.x, dz = obj.z - s.p.z, d = Math.hypot(dx, dz) || 1;
        s.p = { x: obj.x - dx / d * 1.6, z: obj.z - dz / d * 1.6 }; s.movBud = undefined;
        this.enviar(s, { t: 'tp3', x: r1(s.p.x), z: r1(s.p.z), carga: 1 });
        s.rec = Math.min(100, s.rec + h.genera);
        g(pegar(obj, 0.6, 2));
        if (!obj.muere && !obj.jefe) this.ponerAuraMon(obj, 'aturdido', h.aturde);
        break;
      }
      case 'provocar': {
        const max = Math.max(0, ...obj.amen.values());
        obj.amen.set(s.id, max * 1.1 + 30);
        obj.obj = s.id;
        this.ponerAuraMon(obj, 'provoca', 3000, { sid: s.id });
        break;
      }
      case 'torbellino': case 'abanico':
        for (const o of vivos()) if (dist(o, s.p) <= radio + 0.6) g(pegar(o, h.mult, h.amenaza));
        if (h.combo && golpes.length) this.sumarCombo(s, h.combo);
        break;
      case 'grito': for (const a of this.aliadosCerca3d(s, radio)) this.ponerAura(a, 'grito', h.dura); break;
      case 'muro': this.ponerAura(s, 'muro', h.dura); break;
      case 'misiles': for (let i = 0; i < h.golpes; i++) g(pegar(obj, h.mult / h.golpes)); break;
      case 'nova':
        for (const o of vivos()) {
          if (dist(o, s.p) > radio + 0.6) continue;
          g(pegar(o, h.mult));
          if (!o.muere) this.ponerAuraMon(o, 'raiz', (o.jefe ? h.raiz * 0.4 : h.raiz) * ((sp && sp.raiz) || 1));
        }
        break;
      case 'polimorfia': this.ponerAuraMon(obj, 'oveja', h.dura); obj.obj = 0; break;
      case 'evocacion': s.rec = Math.min(s.st.recMax, s.rec + s.st.recMax * 0.6); break;
      case 'bloque': this.ponerAura(s, 'bloque', h.dura); break;
      case 'meteoros': for (const o of vivos()) if (dist(o, s.p) <= radio) g(pegar(o, o.jefe ? h.multJefe : h.mult)); break;
      case 'sanar': this.curar(s, obj, s.st.atk * h.cura); break;
      case 'escudo_poder': {
        const abs = Math.round(s.st.atk * h.absorbe * ((sp && sp.cura) || 1) * (1 + talento(c, 'sanacion')));
        this.ponerAura(obj, 'escudoPoder', h.dura, { abs, de: s.id });
        this.ponerAura(obj, 'almaDebil', 12000);
        break;
      }
      case 'dolor': {
        const tick = Math.max(1, Math.round(s.st.atk * h.mult * mh / 5 * multForja((c.forja || {})[c.arma])));
        this.ponerAuraMon(obj, 'dolor', h.dura, { de: s.id, tick, prox: ahora + 3000 });
        obj.amen.set(s.id, (obj.amen.get(s.id) || 0) + tick);
        obj.dano.set(s.id, (obj.dano.get(s.id) || 0) + 1);
        if (!obj.obj) obj.obj = s.id;
        s.combateT = ahora;
        break;
      }
      case 'renovar': this.ponerAura(obj, 'renovar', h.dura, { de: s.id, cura: Math.round(s.st.atk * h.cura / 4), prox: ahora + 3000 }); break;
      case 'rezo': for (const a of this.aliadosCerca3d(s, radio)) this.curar(s, a, s.st.atk * h.cura); break;
      case 'supresion': this.ponerAura(obj, 'supresion', h.dura); break;
      case 'resurreccion': this.resucitar(obj, s); break;
      case 'siniestro': if (g(pegar(obj, h.mult, h.amenaza))) this.sumarCombo(s, h.combo); break;
      case 'eviscerar': { const cp = s.combo || 0; s.combo = 0; g(pegar(obj, h.mult + h.porCombo * cp)); ev.cp = cp; break; }
      case 'sigilo': this.ponerAura(s, 'sigilo', 0); break;
      case 'patada': case 'zurrar': case 'contrahechizo': case 'silencio':
        g(pegar(obj, h.mult));
        if (!obj.muere) this.ponerAuraMon(obj, 'silencio', h.interrumpe);
        break;
      case 'evasion': this.ponerAura(s, 'evasion', h.dura); break;
      case 'desvanecer':
        for (const o of W.mons.values()) { o.amen.delete(s.id); if (o.obj === s.id) { o.obj = 0; o.vuelve = true; } if (o.au.provoca && o.au.provoca.sid === s.id) delete o.au.provoca; }
        s.combateT = 0;
        this.ponerAura(s, 'sigilo', 0);
        break;
    }
    const robo = ((SKINS[c.skin] || {}).buffs || {}).robo || 0;
    if (robo) s.hp = Math.min(s.st.maxHp, s.hp + golpes.reduce((a, x) => a + x[1], 0) * robo);
    if (ahora - (s.combateT || 0) < 5000) this.progresoTarea(s, 'hab');
    s.sucio = true;
    this.aClave(K3, ev);
    if (cdReal) this.enviar(s, { t: 'cd', id: 'h_' + h.id, hasta: cdReal });
  },

  // Cada jugador recibe a los demas jugadores y los monstruos que tiene cerca.
  // Los monstruos nuevos llegan con sus datos completos (n); los que salen
  // de la vista, en q.
  fotos3d(W, jugadores) {
    const pj = jugadores.map(s => [s.id, r1(s.p.x), r1(s.p.z), Math.round((s.ry || 0) * 100) / 100, s.a | 0, Math.ceil(s.hp), s.st.maxHp, s.muerto ? 1 : 0, s.h ? r1(s.h) : 0]);
    for (const s of jugadores) {
      const ms = [], n = [], q = [];
      const ve = new Set();
      for (const o of W.mons.values()) {
        if (dist(o, s.p) > VISTA_MON) continue;
        ve.add(o.id);
        if (!s.vistos.has(o.id)) n.push({ id: o.id, k: o.k, nv: o.nv, x: r1(o.x), z: r1(o.z), hp: Math.ceil(o.hp), mx: o.max, j: o.jefe ? 1 : 0, mu: o.mundial3 ? 1 : undefined });
        else ms.push([o.id, r1(o.x), r1(o.z), Math.round(o.ry * 100) / 100, Math.ceil(o.hp), o.muere ? 3 : o.st]);
      }
      for (const id of s.vistos) if (!ve.has(id)) q.push(id);
      s.vistos = ve;
      this.enviar(s, { t: 's3', p: pj, m: ms, n: n.length ? n : undefined, q: q.length ? q : undefined, hp: Math.ceil(s.hp), rec: Math.round(s.rec || 0), cb: s.combo || 0 });
    }
  },
};
