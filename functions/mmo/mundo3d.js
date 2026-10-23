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
} from '../../mmo/js/data.js';
import { MUNDO, NPCS3D, NPC_DIST, SPAWN3D, campamentos, zonaEn } from '../../mmo/js/mundo3d.js';

export const K3 = '~3d';
const VISTA_MON = 120;          // m: monstruos que ve cada jugador
const ACTIVO = 170;             // m: un campamento se puebla si hay alguien a esta distancia
const RETIRAR = 240;            // m: y se vacia si nadie queda a esta
const REAPARECE_MS = 20000;
const REAPARECE_JEFE_MS = 5 * 60 * 1000;
const CORREA = 50;              // m: un monstruo no se aleja mas de su campamento
const MELEE = 3.2;              // m: alcance del golpe cuerpo a cuerpo (x arma.alcance)
const RANGO_VARA = 24;          // m: disparo de vara de magos y sacerdotes
const MON_MELEE = 2.4, MON_DISPARO = 15;
const FOTO_CADA = 2;            // ticks entre fotos (200 ms)

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
    s.ry = 0; s.a = 0; s.movT = Date.now(); s.movBud = undefined; s.vistos = new Set(); s.atkT = 0;
    const jugadores = this.sesiones3d().filter(x => x !== s).map(x => this.info3d(x));
    this.enviar(s, { t: 'm3', id: s.id, x: r1(s.p.x), z: r1(s.p.z), jugadores });
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
      case 'revivir': return this.revivir3d(s);
      case 'mision': if (this.cerca3d(s, 'guia')) return this.mision(s, m, true); return this.no(s, 'Habla con el Guardia Tito en el pueblo.');
      case 'comprar': return this.comprar(s, m);   // cercaDelMercader() sabe del 3D
      case 'chat': return this.chat(s, m);
      case 'clase': return this.elegirClase(s, m);
      case 'espec': return this.elegirEspec(s, m);
      case 'talento': return this.subirTalento(s, m);
      case 'talentoReset': return this.reiniciarTalentos(s);
      case 'equipar': return this.equipar(s, m);
      case 'item': return this.item(s, m);
      case 'titulo': return this.ponerTitulo(s, m);
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
      const vel = MUNDO.velocidad * velMontura(s.montado) * (1 + talento(s.c, 'agilidad'));
      const tope = vel + 4;
      s.movBud = Math.min(tope, (s.movBud === undefined ? tope : s.movBud) + vel * 1.25 * dt / 1000);
      if (d > s.movBud + 1) { this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) }); return; }
      s.movBud = Math.max(0, s.movBud - d);
    }
    s.p.x = nx; s.p.z = nz;
    s.ry = num(m.r) || 0;
    s.a = clamp(m.a | 0, 0, 4);
    s.c.p3 = { x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10 };
    s.sucio = true;
  },

  // ── COMBATE ──
  // Ataque automatico al objetivo: cuerpo a cuerpo un golpe por segundo (el
  // mismo daño por segundo que el combo del 2D) y la vara a su ritmo.
  atacar3d(s, m) {
    if (s.muerto) return;
    const W = this.iniciar3d();
    const o = W.mons.get(m.tg | 0);
    if (!o || o.muere) return;
    const ahora = Date.now();
    if (ahora < (s.atkT || 0)) return;
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    const vara = !!(CLASES[s.c.clase] && CLASES[s.c.clase].basico === 'vara');
    const rango = vara ? RANGO_VARA : MELEE * (arma.alcance || 1) + (o.jefe ? 1.2 : 0.4);
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
    // Monstruos.
    for (const o of [...W.mons.values()]) {
      if (o.muere) { if (ahora >= o.borrarEn) W.mons.delete(o.id); continue; }
      // Nadie cerca: se retira (vuelve a aparecer cuando alguien se acerque).
      if (!o.obj && !vivos.some(s => dist(s.p, o) < RETIRAR)) {
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
  ia3d(o, vivos, ahora) {
    const dt = 0.1;
    const casa = { x: o.hx, z: o.hz };
    let s = o.obj ? this.sesiones.get(o.obj) : null;
    if (s && (!s.m3 || s.muerto || s.cerrado || dist(s.p, casa) > CORREA + 20)) { s = null; o.obj = 0; o.vuelve = true; }
    if (!s && o.jefe && !o.vuelve) {
      const cerca = vivos.find(x => dist(x.p, o) < 16);
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
      const alcance = o.dispara ? MON_DISPARO : MON_MELEE + (o.jefe ? 1 : 0);
      const d = dist(o, s.p);
      if (d > alcance) { mover(s.p.x, s.p.z, velC); o.st = 1; }
      else {
        o.st = 2;
        o.ry = Math.atan2(s.p.x - o.x, s.p.z - o.z);
        if (ahora >= o.atkEn) {
          o.atkEn = ahora + (o.jefe ? 1250 : 1600);
          const golpe = o.atk * (o.jefe ? 0.7 : 1) * (o.dispara ? 0.9 : 1);
          if (o.dispara) this.aClave(K3, { t: 'b3', de: o.id, a: s.id });
          this.herir(s, golpe, { jefe: o.jefe, bala: o.dispara });
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

  // Cada jugador recibe a los demas jugadores y los monstruos que tiene cerca.
  // Los monstruos nuevos llegan con sus datos completos (n); los que salen
  // de la vista, en q.
  fotos3d(W, jugadores) {
    const pj = jugadores.map(s => [s.id, r1(s.p.x), r1(s.p.z), Math.round((s.ry || 0) * 100) / 100, s.a | 0, Math.ceil(s.hp), s.st.maxHp, s.muerto ? 1 : 0]);
    for (const s of jugadores) {
      const ms = [], n = [], q = [];
      const ve = new Set();
      for (const o of W.mons.values()) {
        if (dist(o, s.p) > VISTA_MON) continue;
        ve.add(o.id);
        if (!s.vistos.has(o.id)) n.push({ id: o.id, k: o.k, nv: o.nv, x: r1(o.x), z: r1(o.z), hp: Math.ceil(o.hp), mx: o.max, j: o.jefe ? 1 : 0 });
        else ms.push([o.id, r1(o.x), r1(o.z), Math.round(o.ry * 100) / 100, Math.ceil(o.hp), o.muere ? 3 : o.st]);
      }
      for (const id of s.vistos) if (!ve.has(id)) q.push(id);
      s.vistos = ve;
      this.enviar(s, { t: 's3', p: pj, m: ms, n: n.length ? n : undefined, q: q.length ? q : undefined, hp: Math.ceil(s.hp), rec: Math.round(s.rec || 0) });
    }
  },
};
