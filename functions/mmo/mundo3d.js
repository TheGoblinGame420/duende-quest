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
  MATERIALES, NODO_CADA_MS, RECOLECTAR_MS, RARO_ZONA, raroDe, PESCA, hoyUTC, alaDe,
  habPorId, costoHab, GCD_MS, RECURSOS, MELEE, limpiarLook, MUNDIAL_CADA_MS, MUNDIAL_DURA_MS, proximoMundial, mundialDe,
} from '../../mmo/js/data.js';
import { MUNDO, NPCS3D, NPC_DIST, SPAWN3D, ARENA3D, CASAS, campamentos, zonaEn, esNoche, nodos3d, RECOGER_DIST, alturaEn } from '../../mmo/js/mundo3d.js';
import { CUEVA, CUEVA_X0, caminable, enCueva, vistaCueva, pasoCueva } from '../../mmo/js/cueva3d.js';
// Misma instancia (0 = mundo abierto; si no, la cueva de un grupo).
const mismo = (a, b) => (a.i3 || 0) === (b.i3 || 0);

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
// Margen para el jitter de la red: un golpe o una habilidad que llega hasta
// 150 ms antes de su recarga cuenta (la cadencia se mide desde el golpe
// anterior, asi que no se gana dano).
const JITTER_MS = 150;
const VISTA_PJ = 160, SALE_PJ = 190;   // m: a que distancia se ve (y se deja de ver) a otro jugador
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
  // Envio solo a los del 3D cerca de c ({x, z, i3}) y en su misma instancia.
  aCerca3d(c, obj, r = VISTA_MON + 40) {
    const txt = JSON.stringify(obj);
    for (const s of this.sesiones.values()) if (s.c && s.m3 && !s.cerrado && mismo(s, c) && s.p && dist(s.p, c) <= r) this.enviar(s, txt);
  },
  // Un jugador se va o muere: los monstruos del 3D lo olvidan.
  olvidar3d(s) {
    const W = this.m3; if (!W) return;
    for (const o of W.mons.values()) {
      o.amen.delete(s.id);
      if (o.obj === s.id) o.obj = 0;
      if (o.au.provoca && o.au.provoca.sid === s.id) delete o.au.provoca;
    }
    if (s.i3 && W.cuevas) { const inst = W.cuevas.get(s.i3); if (inst) inst.dentro.delete(s.id); }
  },
  sesiones3d() { const l = []; for (const s of this.sesiones.values()) if (s.c && s.m3 && !s.cerrado) l.push(s); return l; },

  // ── ENTRAR ──
  entrar3d(s) {
    this.iniciar3d();
    const c = s.c;
    s.m3 = true;
    s.k = K3;
    const p = c.p3 && num(c.p3.x) !== null && num(c.p3.z) !== null && !enCueva(c.p3.x) ? c.p3 : SPAWN3D;
    s.p = { x: clamp(p.x, -MUNDO.limite, MUNDO.limite), z: clamp(p.z, -MUNDO.limite, MUNDO.limite) };
    s.i3 = 0;
    s.vistosP = new Set();
    s.ry = 0; s.a = 0; s.h = 0; s.movT = Date.now(); s.movBud = undefined; s.vistos = new Set(); s.atkT = 0;
    const jugadores = this.sesiones3d().filter(x => x !== s).map(x => this.info3d(x));
    this.enviar(s, { t: 'm3', id: s.id, x: r1(s.p.x), z: r1(s.p.z), jugadores });
    this.enviar(s, this.estadoMundial3());
    this.nodos3AlEntrar(s);
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
      case 'cueva': return this.entrarCueva(s);
      case 'salirCueva':
        if (s.i3 && !s.muerto && Math.hypot(s.p.x - CUEVA_X0 - CUEVA.salida.x, s.p.z - CUEVA.salida.z) < 6) return this.salirCueva(s);
        return;
      case 'retar': return this.retarDuelo(s, m);
      case 'retoResp': return this.respuestaDuelo(s, m);
      case 'look': return this.cambiarLook(s, m);
      case 'recolectar': return this.recolectar3d(s, m);
      case 'pescar': return this.pescar3d(s);
      case 'tirar': return this.tirar(s);
      case 'fabricar': return this.fabricar(s, m);   // cercaDeArtesana() sabe del 3D
      case 'invitar': return this.invitar(s, m);
      case 'grupoResp': return this.respuestaGrupo(s, m);
      case 'salirGrupo': return this.salirGrupo(s);
      case 'expulsarGrupo': return this.expulsarGrupo(s, m);
      case 'liderGrupo': return this.liderGrupo(s, m);
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
    // Aturdido u oveja o en Bloque de Hielo: no se mueve (como en el 2D).
    if (this.aura(s, 'aturdido') || this.aura(s, 'bloque')) {
      if (Math.hypot(x - s.p.x, z - s.p.z) > 0.3) this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) });
      return;
    }
    const ahora = Date.now();
    const dt = clamp(ahora - s.movT, 0, 1000);
    s.movT = ahora;
    const nx = s.i3 ? x : clamp(x, -MUNDO.limite, MUNDO.limite), nz = s.i3 ? z : clamp(z, -MUNDO.limite, MUNDO.limite);
    // En la cueva solo se camina por salas y pasillos (si ya estas en roca, se
    // acepta el paso que te saca).
    if (s.i3 && !caminable(nx, nz, 0.2) && caminable(s.p.x, s.p.z, 0.2)) { this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) }); return; }
    // Modo de vuelo VALIDADO (no el que diga el cliente): a = 3 vuela, a = 4 planea.
    const dtS = dt / 1000, ala = alaDe(s.c);
    const aire = !s.i3 && zonaEn(nx, nz) !== 'pueblo';
    const prevA = s.a;
    let a = clamp(m.a | 0, 0, 4);
    if (a === 3 && (!aire || (s.vueloS || 0) >= ala.vuelo + 2)) a = (s.h || 0) > 1.2 && !s.i3 ? 4 : 0;
    if (a === 4 && s.i3) a = 0;
    // Altura simulada: subir como mucho 6,5 m/s, planear siempre baja, a pie no se sube.
    const hq = clamp(num(m.h) || 0, 0, 46), h0 = s.h || 0;
    let h;
    if (a === 3) h = clamp(hq, h0 - 7.5 * dtS - 0.5, h0 + 6.5 * dtS + 0.5);
    else if (a === 4) { h = Math.min(hq, Math.max(0, h0 - 1.0 * dtS)); if (h <= 0.3) { h = 0; a = 0; } }
    else h = hq <= 2 ? hq : Math.min(hq, h0);
    // Energia de las alas: se cuenta con el modo que se mantuvo hasta este mensaje.
    if (prevA === 3) s.vueloS = (s.vueloS || 0) + dtS;
    else if (prevA !== 4) s.vueloS = Math.max(0, (s.vueloS || 0) - dtS * 3);
    if ((s.vueloS || 0) > ala.vuelo + 2 && !s.alasAvisadas) { s.alasAvisadas = true; this.enviar(s, { t: 'alasAgotadas' }); }
    if (s.alasAvisadas && (s.vueloS || 0) < ala.vuelo * 0.5) s.alasAvisadas = false;
    const d = Math.hypot(nx - s.p.x, nz - s.p.z);
    if (!(s.dios && s.diosModo && s.diosModo.vel)) {
      const modo = a === 3 ? ala.vel + 0.05 : a === 4 ? 1.4 : velMontura(s.montado);
      const vel = MUNDO.velocidad * modo * (1 + talento(s.c, 'agilidad'));
      const tope = vel + 3;   // ~1 s de margen por huecos de red
      s.movBud = Math.min(tope, (s.movBud === undefined ? tope : s.movBud) + vel * 1.15 * dt / 1000);
      if (d > s.movBud + 1) { this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) }); return; }
      s.movBud = Math.max(0, s.movBud - d);
      // Las casas tampoco se atraviesan en el servidor (salvo volando por encima).
      if (!s.i3 && !(a === 3 && h > 3)) for (const c of CASAS) {
        const dx = nx - c.x, dz = nz - c.z;
        if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;
        const co = Math.cos(c.r), si = Math.sin(c.r), lx = dx * co - dz * si, lz = dx * si + dz * co;
        if (Math.abs(lx) < c.w / 2 - 0.3 && Math.abs(lz) < c.d / 2 - 0.3) { this.enviar(s, { t: 'snap3', x: r1(s.p.x), z: r1(s.p.z) }); return; }
      }
    }
    // Un lanzamiento se corta si te alejas mas de 0,8 m de donde empezo.
    if (s.cast) {
      const c0 = s.cast.p0 || (s.cast.p0 = { x: s.p.x, z: s.p.z });
      if (Math.hypot(nx - c0.x, nz - c0.z) > 0.8) this.cancelarCast(s, s.cast.h === 'montar' ? '' : 'Te moviste: el lanzamiento se canceló.');
    }
    s.p.x = nx; s.p.z = nz;
    s.ry = num(m.r) || 0;
    s.a = a; s.h = Math.max(0, h);
    if (!s.i3) s.c.p3 = { x: Math.round(nx * 10) / 10, z: Math.round(nz * 10) / 10 };
    s.sucio = true;
  },

  // ── COMBATE ──
  // Ataque automatico al objetivo: cuerpo a cuerpo un golpe por segundo (el
  // mismo daño por segundo que el combo del 2D) y la vara a su ritmo.
  atacar3d(s, m) {
    if (s.muerto || this.aura(s, 'aturdido') || this.aura(s, 'bloque')) return;
    if (s.cast && habPorId(s.cast.h)) return;   // no se pega mientras se lanza
    // Para combatir hay que estar en el suelo (o casi).
    if (s.h > 4) return this.no(s, 'Aterriza para combatir.');
    if (m.tp) return this.atacarDuelo3d(s, m);
    const W = this.iniciar3d();
    const o = W.mons.get(m.tg | 0);
    if (!o || o.muere || !mismo(o, s)) return;
    const ahora = Date.now();
    if (ahora < (s.atkT || 0) - JITTER_MS) return;
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    const vara = !!(CLASES[s.c.clase] && CLASES[s.c.clase].basico === 'vara');
    const rango = vara ? RANGO_VARA : MELEE3D * (arma.alcance || 1) + (o.jefe ? 1.2 : 0.4);
    // Fuera de alcance: el cliente reintenta en 150 ms (no pierde el golpe).
    if (dist(s.p, o) > rango + 0.3) { this.enviar(s, { t: 'atkNo' }); return this.no(s, 'Fuera de alcance.'); }
    s.atkT = Math.max(ahora, s.atkT || 0) + (vara ? VARA.cdMs * arma.cd : 1000 * arma.cd);
    if (s.montado) this.desmontar(s);
    // pegar3d: critico, forja, fuego, Grito, elixires y el x2 del Sigilo.
    const r = this.pegar3d(s, o, vara ? VARA.mult : 3.6 * (arma.dano || 1), 1);
    if (!r) return;
    const real = r[1], crit = r[2] === 1;
    this.aCerca3d(o, { t: 'at3', p: s.id, tg: o.id, d: real, c: crit ? 1 : 0, v: vara ? 1 : 0 });
    const robo = ((SKINS[s.c.skin] || {}).buffs || {}).robo || 0;
    if (robo) s.hp = Math.min(s.st.maxHp, s.hp + real * robo);
  },

  // Duelo: el ataque automatico contra el rival (mismo ritmo que contra
  // monstruos; golpeDuelo escala el daño entre jugadores).
  atacarDuelo3d(s, m) {
    if (this.aura(s, 'aturdido') || this.aura(s, 'bloque') || (s.cast && habPorId(s.cast.h))) return;
    const t = this.rivalDuelo(s);
    if (!t || t.id !== (m.tp | 0) || !t.m3) return;
    const ahora = Date.now();
    if (ahora < (s.atkT || 0) - JITTER_MS) return;
    const arma = ARMAS[s.c.arma] || ARMAS.katana;
    const vara = !!(CLASES[s.c.clase] && CLASES[s.c.clase].basico === 'vara');
    if (dist(s.p, t.p) > (vara ? RANGO_VARA : MELEE3D * (arma.alcance || 1) + 0.6) + 0.3) { this.enviar(s, { t: 'atkNo' }); return this.no(s, 'Fuera de alcance.'); }
    s.atkT = Math.max(ahora, s.atkT || 0) + (vara ? VARA.cdMs * arma.cd : 1000 * arma.cd);
    if (s.montado) this.desmontar(s);
    this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'atp3', p: s.id, tg: t.id, v: vara ? 1 : 0 });
    this.golpeDuelo(s, t, vara ? VARA.mult : 3.6 * (arma.dano || 1), true);
  },

  danar3d(o, dmg, s) {
    if (o.muere) return 0;
    if (o.vuelve && !o.mundial3) return 0;
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
      // De noche los monstruos dan un 10% mas de experiencia.
      const xp = Math.max(1, Math.round(base.xp * k * (1 + talento(s.c, 'erudicion')) * (esNoche(Date.now()) ? 1.1 : 1)));
      const oro = Math.max(1, Math.round(base.oro * k * rnd(0.8, 1.2) * mult));
      // dar(): misiones, diarias, bestiario, chicha, pase, botin... lo mismo que el 2D.
      this.dar(s, xp, oro, o, 1, true);
      cobraron.add(sid);
      if (o.jefe && !o.cueva && parte >= 0.1) this.darMton(s, 20 * Math.max(0.3, MONSTRUOS[o.k].nivel / 30), 'jefe');
    }
    // Grupo: los compañeros cerca (60 m) cuentan la caza como suya (misiones,
    // diarias, bestiario) y se llevan el 60% de la experiencia.
    for (const sid of [...cobraron]) {
      const g = this.grupoDe(this.sesiones.get(sid));
      if (!g) continue;
      for (const x of this.sesionesGrupo(g)) {
        if (cobraron.has(x.id) || !x.m3 || x.muerto || !mismo(x, o) || dist(x.p, o) > 60) continue;
        this.dar(x, Math.max(1, Math.round(base.xp * 0.6 * (1 + talento(x.c, 'erudicion')))), Math.max(1, Math.round(base.oro * 0.5)), o, 1, true);
        cobraron.add(x.id);
      }
    }
    // Caza cooperativa: quien este cerca se lleva el 25% de la experiencia.
    for (const s of this.sesiones3d()) {
      if (cobraron.has(s.id) || s.muerto || !mismo(s, o) || dist(s.p, o) > 40) continue;
      const xp = Math.max(1, Math.round(base.xp * 0.25));
      const subio = this.sumarXp(s, xp);
      s.sucio = true;
      this.enviar(s, { t: 'gana', xp, oro: 0, drops: [], coop: true });
      this.yoLuego(s, subio);
    }
    const campo = W.campos[o.campo];
    if (campo) { campo.vivos.delete(o.id); campo.prox = Date.now() + (o.jefe ? REAPARECE_JEFE_MS : REAPARECE_MS); }
    this.aClave(K3, { t: 'md3', id: o.id });
    if (o.cueva && o.jefe) this.premiosCueva(o);
    else if (o.jefe) {
      const quien = [...cobraron].map(id => this.sesiones.get(id)?.c?.nombre).filter(Boolean).slice(0, 4).join(', ');
      this.aTodos({ t: 'aviso', m: `${MONSTRUOS[o.k].nombre} fue derrotado en el mundo 3D${quien ? ' por ' + quien : ''}.` });
    }
  },

  // Consumibles: los mismos efectos; el Rayo golpea todo lo que esta cerca.
  poder3d(s, m) {
    if (s.muerto || this.aura(s, 'aturdido')) return;
    if (s.h > 4) return this.no(s, 'Aterriza primero.');
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
        if (o.muere || !mismo(o, s) || dist(o, s.p) > 14) continue;
        const d = this.danar3d(o, Math.round(s.st.atk * (o.jefe ? 2 : 4)), s);
        this.aCerca3d(o, { t: 'at3', p: s.id, tg: o.id, d, c: 0, rayo: 1 });
      }
    }
    s.sucio = true;
    this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'pw', p: s.id, i: m.i | 0 });
    this.enviar(s, { t: 'cd', id: def.id, hasta: def.cd });
    this.yoLuego(s);
  },

  // Revivir en el cementerio del pueblo (mismo castigo que el 2D).
  revivir3d(s) {
    if (!s.muerto) return;
    const estabaCueva = !!s.i3;
    if (s.i3) { const inst = this.cuevas3().get(s.i3); if (inst) inst.dentro.delete(s.id); s.i3 = 0; }
    s.a = 0; s.h = 0; s.vueloS = 0; s.alasAvisadas = false; s.cast = null;
    const c = s.c;
    if (c.nivel >= 10) c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
    s.muerto = false;
    s.hp = s.st.maxHp;
    this.recursoInicial(s);
    s.inv = Date.now() + 2000;
    s.p = { x: SPAWN3D.x, z: SPAWN3D.z };
    c.p3 = { ...s.p };
    s.movBud = undefined;
    this.enviar(s, { t: 'tp3', x: s.p.x, z: s.p.z, ...(estabaCueva ? { cueva: null } : {}) });
    this.aClave(K3, { t: 'pj3', p: this.info3d(s) }, s);
    if (this.reponerElixires) this.reponerElixires(s);
    this.actualizarYo(s);
    this.guardar(s);
  },

  // ── CADA TICK ──
  tick3d(ahora, jugadores) {
    const W = this.iniciar3d();
    if (!jugadores.length) {
      if (W.mons.size) W.mons.clear();
      for (const c of W.campos) c.vivos.clear();   // si no, los campamentos quedan "llenos" de ids fantasma
      if (W.mundial) W.mundial.o = null;            // el jefe mundial ya no existe
      if (W.cuevas) W.cuevas.clear();   // sus monstruos ya no existen
      return;
    }
    const dt = 0.1;
    // Vida y recurso (rapida en el pueblo y tras 4 s sin golpes en el campo).
    for (const s of jugadores) {
      const seguro = zonaEn(s.p.x, s.p.z) === 'pueblo';
      if (s.cast && habPorId(s.cast.h) && ahora >= s.cast.fin) this.finCast3d(s);
      if (s.yoPend) this.vaciarYo(s, ahora);
      if ((s.a === 3 || s.a === 4) && ahora - (s.movT || 0) > 400) {
        const ala = alaDe(s.c);
        if (s.a === 3) { s.vueloS = (s.vueloS || 0) + dt; if (s.vueloS > ala.vuelo + 2) { s.a = 4; if (!s.alasAvisadas) { s.alasAvisadas = true; this.enviar(s, { t: 'alasAgotadas' }); } } }
        else { s.h = Math.max(0, (s.h || 0) - 2 * dt); if (!s.h) s.a = 0; }
      }
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
    this.tickCuevas(ahora);
    const porI3 = new Map();
    for (const s of vivos) { const k = s.i3 || 0; if (!porI3.has(k)) porI3.set(k, []); porI3.get(k).push(s); }
    // Monstruos.
    for (const o of [...W.mons.values()]) {
      if (o.muere) { if (ahora >= o.borrarEn) W.mons.delete(o.id); continue; }
      // Nadie cerca: se retira (vuelve a aparecer cuando alguien se acerque).
      if (!o.obj && !o.mundial3 && !o.i3 && !vivos.some(s => !s.i3 && dist(s.p, o) < RETIRAR)) {
        W.mons.delete(o.id);
        const c = W.campos[o.campo]; if (c) c.vivos.delete(o.id);
        continue;
      }
      if (o.i3 && !porI3.has(o.i3)) continue;   // cueva sin nadie dentro
      this.ia3d(o, porI3.get(o.i3 || 0) || [], ahora);
    }
    // Fotos del mundo (cada 200 ms).
    if (++W.foto % FOTO_CADA === 0) this.fotos3d(W, jugadores, ahora);
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
  // ── APARIENCIA ──
  // Cara, cuerpo, altura y pelo: gratis, validado con limpiarLook.
  cambiarLook(s, m) {
    const ahora = Date.now();
    if (ahora - (s.lookT || 0) < 1500) return;
    s.lookT = ahora;
    s.c.look = limpiarLook(m.look);
    s.sucio = true;
    this.aClave(K3, { t: 'pa', ...this.infoApariencia(s) });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // ── RECOLECCION ──
  // Las mismas reglas que el 2D (1,5 s quieto, cada punto cada 5 min por
  // jugador, materiales raros en zonas altas); la marca va en c.nodos con la
  // clave '3d:<i>'.
  nodos3AlEntrar(s) {
    const marcas = s.c.nodos || {}, ahora = Date.now(), l = [];
    for (const k in marcas) if (k.startsWith('3d:') && marcas[k] > ahora) l.push([+k.slice(3), marcas[k] - ahora]);
    this.enviar(s, { t: 'nodos3', l });
  },
  recolectar3d(s, m) {
    if (s.muerto || s.cast || this.aura(s, 'aturdido')) return;
    if (s.h > 4) return this.no(s, 'Aterriza primero.');
    const n = nodos3d(MAPAS, MONSTRUOS)[m.i | 0];
    if (!n) return;
    if (dist(s.p, n) > RECOGER_DIST + 1) return this.no(s, 'Acércate más para recoger.');
    if (Date.now() < ((s.c.nodos || {})['3d:' + n.i] || 0)) return this.no(s, 'Ya lo recogiste: vuelve a crecer en unos minutos.');
    this.desmontar(s);
    s.cast = { h: 'recolectar', fin: Date.now() + RECOLECTAR_MS, tg: 0, nodo: n.i };
    this.aClave(K3, { t: 'cast', p: s.id, id: 'recolectar', ms: RECOLECTAR_MS });
  },
  terminarRecoleccion3d(s, ca) {
    const c = s.c;
    const n = nodos3d(MAPAS, MONSTRUOS)[ca.nodo];
    if (!n || dist(s.p, n) > RECOGER_DIST + 2) return;
    const clave = '3d:' + n.i, ahora = Date.now();
    c.nodos = c.nodos || {};
    if (ahora < (c.nodos[clave] || 0)) return;
    for (const k in c.nodos) if (c.nodos[k] < ahora) delete c.nodos[k];
    c.nodos[clave] = ahora + NODO_CADA_MS;
    c.mat = c.mat || {};
    const nv = ((MAPAS[n.zona] || {}).nv || [1])[0];
    const cant = 1 + (Math.random() < 0.5 ? 1 : 0) + (nv >= 30 ? 1 : 0);
    c.mat[n.tipo] = Math.min(999, (c.mat[n.tipo] || 0) + cant);
    let extra = '';
    if (Math.random() < 0.06 + nv / 800) { c.mat.cristal = Math.min(999, (c.mat.cristal || 0) + 1); extra = ' y 1 Cristal Arcano'; }
    let raros = 0;
    for (const [nvMin, p] of RARO_ZONA) if (nv >= nvMin && Math.random() < p) raros++;
    if (raros) { const r = raroDe(n.tipo); c.mat[r] = Math.min(999, (c.mat[r] || 0) + raros); extra += ` y +${raros} ${MATERIALES[r].nombre}`; }
    s.sucio = true;
    this.enviar(s, { t: 'recogido3', i: n.i, en: NODO_CADA_MS, tipo: n.tipo, cant });
    this.enviar(s, { t: 'toast', m: `${n.tipo === 'hierba' ? '🌿' : '⛏'} +${cant} ${MATERIALES[n.tipo].nombre}${extra}`, ok: true });
    this.progresoTarea && this.progresoTarea(s, 'recoger');
    this.actualizarYo(s);
  },

  // ── PESCA ──
  // En cualquier orilla: hace falta agua a menos de 6 m. La zona decide el
  // nivel y la especie (las mismas reglas y premios que el 2D: tirar()).
  aguaCerca3d(p) {
    for (let r = 2; r <= 6; r += 2) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (alturaEn(x, z) < MUNDO.agua - 0.6) return true;
    }
    return false;
  },
  pescar3d(s) {
    const c = s.c;
    if (s.muerto || s.cast || this.aura(s, 'aturdido')) return;
    if (s.i3) return this.no(s, 'En la cueva no hay dónde pescar.');
    if (s.h > 4) return this.no(s, 'Aterriza primero.');
    if (!this.aguaCerca3d(s.p)) return this.no(s, 'Acércate a la orilla para pescar.');
    const hoy = hoyUTC();
    if (c.pescaHoy && c.pescaHoy.d === hoy && c.pescaHoy.n >= PESCA.porDia) return this.no(s, `Hoy ya pescaste ${PESCA.porDia} veces: los peces descansan hasta mañana.`);
    this.desmontar(s);
    const ahora = Date.now();
    s.pesca3 = zonaEn(s.p.x, s.p.z);
    s.cast = { h: 'pescar', fin: ahora + PESCA.min + Math.random() * (PESCA.max - PESCA.min), tg: 0 };
    this.aClave(K3, { t: 'cast', p: s.id, id: 'pescar', ms: PESCA.max + PESCA.ventana });
  },

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
      if (o.muere) { if (o.pisa) { this.aCerca3d(o, { t: 'zona3f', id: o.id }); o.pisa = null; } return; }
      if (ahora > M.hasta) {
        if (o.pisa) { this.aCerca3d(o, { t: 'zona3f', id: o.id }); o.pisa = null; }
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
    // Palabra de Dolor: daño cada 3 s (no mientras vuelve a casa).
    const dol = o.au.dolor;
    if (dol && !o.vuelve && ahora >= dol.prox && ahora <= dol.hasta + 150) {
      dol.prox += 3000;
      const de = this.sesiones.get(dol.de);
      const d = this.danar3d(o, dol.tick, de && de.m3 ? de : null);
      this.aCerca3d(o, { t: 'at3', p: dol.de, tg: o.id, d, c: 0, dot: 1 });
      if (o.muere) return;
    }
    for (const a in o.au) if (o.au[a].hasta < ahora) delete o.au[a];
    if (this.auraMon(o, 'aturdido') || this.auraMon(o, 'oveja')) { o.st = 0; return; }
    const enC = !!o.cueva;
    const ve = (bx, bz) => !enC || vistaCueva(o.x, o.z, bx, bz);
    const valido = x => x && x.m3 && !x.muerto && !x.cerrado && mismo(x, o) && !(x.h > 8) && dist(x.p, casa) < CORREA + 20;
    // Objetivo: Provocar manda; si no, la tabla de amenaza (para quitarle el
    // foco hay que superar el 110 % cuerpo a cuerpo o el 130 % a distancia).
    const teniaObj = !!o.obj || o.amen.size > 0;
    const prov = this.auraMon(o, 'provoca');
    if (prov) o.obj = prov.sid;
    else if (o.amen.size) {
      const act = this.sesiones.get(o.obj);
      let quien = valido(act) ? o.obj : 0, mejor = quien ? (o.amen.get(quien) || 0) : 0;
      for (const [sid, a] of o.amen) {
        if (sid === quien) continue;
        const x = this.sesiones.get(sid);
        if (!valido(x)) { o.amen.delete(sid); continue; }
        const k = quien ? (dist(x.p, o) <= MON_MELEE + 1 ? 1.1 : 1.3) : 1;
        if (a > mejor * k) { mejor = a; quien = sid; }
      }
      o.obj = quien;
    }
    let s = o.obj ? this.sesiones.get(o.obj) : null;
    if (s && !valido(s)) { s = null; o.obj = 0; }
    // Solo se reinicia cuando ya no queda nadie en su lista.
    if (!s && teniaObj && !o.amen.size && !o.vuelve) o.vuelve = true;
    if (!s && (o.jefe || o.cueva) && !o.vuelve) {
      const cerca = vivos.find(x => dist(x.p, o) < (o.jefe ? 16 : 11) && !this.aura(x, 'sigilo') && !(x.h > 8) && ve(x.p.x, x.p.z));
      if (cerca) {
        o.obj = cerca.id; s = cerca;
        // En la cueva acude el grupo entero de esa sala.
        if (o.cueva) for (const x of this.iniciar3d().mons.values()) if (x.i3 === o.i3 && !x.obj && !x.muere && dist(x, o) < 10) x.obj = cerca.id;
      }
    }
    const velC = 4.2 * (o.vel || 1);
    // Paso hacia (tx, tz): en la cueva por las puertas y resbalando por la roca.
    const mover = (tx, tz, v) => {
      if (enC) [tx, tz] = pasoCueva(o.x, o.z, tx, tz);
      const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
      if (d < 0.05) return 0;
      const paso = Math.min(d, v * dt);
      let nx = o.x + dx / d * paso, nz = o.z + dz / d * paso;
      const bloquea = (x, z) => enC ? !caminable(x, z, 0.5) : CASAS.some(c => { const ddx = x - c.x, ddz = z - c.z; if (Math.abs(ddx) > 12 || Math.abs(ddz) > 12) return false;
        const co = Math.cos(c.r), si = Math.sin(c.r); return Math.abs(ddx * co - ddz * si) < c.w / 2 + 0.3 && Math.abs(ddx * si + ddz * co) < c.d / 2 + 0.3; });
      if (bloquea(nx, nz)) { if (!bloquea(nx, o.z)) nz = o.z; else if (!bloquea(o.x, nz)) nx = o.x; else return d; }
      o.ry = Math.atan2(nx - o.x, nz - o.z); o.x = nx; o.z = nz;
      return d - paso;
    };
    if (s) {
      o.vuelve = false;
      const silencio = this.auraMon(o, 'silencio');
      const alcance = o.dispara && !silencio ? MON_DISPARO : MON_MELEE + (o.jefe ? 1 : 0);
      const d = dist(o, s.p);
      const veo = ve(s.p.x, s.p.z);
      if (d > alcance || !veo) {
        // Se acerca por su lado (rodean al jugador en vez de apilarse).
        if (!this.auraMon(o, 'raiz')) {
          const k = d > 0.01 && veo ? (alcance * 0.8) / d : 0;
          mover(s.p.x + (o.x - s.p.x) * k, s.p.z + (o.z - s.p.z) * k, velC);
        }
        o.st = 1;
      } else {
        // Al entrar en combate se prepara un instante (se ve el brazo arriba).
        if (o.st !== 2) o.atkEn = Math.max(o.atkEn, ahora + 400);
        o.st = 2;
        o.ry = Math.atan2(s.p.x - o.x, s.p.z - o.z);
        if (ahora >= o.atkEn) {
          o.atkEn = ahora + (o.jefe ? 1250 : 1600);
          const golpe = o.atk * (o.jefe ? 0.7 : 1) * (o.dispara ? 0.9 : 1);
          if (o.dispara) this.aCerca3d(o, { t: 'b3', de: o.id, a: s.id });
          this.herir(s, golpe, { jefe: o.jefe, bala: o.dispara, mundial: o.mundial3, id: o.id });
        }
      }
      if (dist(o, casa) > CORREA) {
        // Se rompe la correa: vuelve a casa y olvida el combate.
        o.obj = 0; o.vuelve = true; o.amen.clear();
        if (!o.mundial3) o.dano.clear();
        delete o.au.dolor; delete o.au.provoca;
      }
      return;
    }
    if (o.vuelve) {
      o.st = 1;
      if (!o.mundial3) o.hp = Math.min(o.max, o.hp + o.max * 0.15 * dt);   // se cura visiblemente al irse
      if (mover(casa.x, casa.z, velC * 1.3) < 0.5) {
        o.vuelve = false; o.st = 0;
        // El jefe mundial conserva el daño (y su credito para el premio).
        if (!o.mundial3) { o.hp = o.max; o.dano.clear(); o.amen.clear(); }
        if (o.cueva && o.jefe) this.reiniciarJefeCueva(o);
      }
      return;
    }
    // En la cueva son centinelas: no pasean (asi no se meten en la roca).
    if (enC) { o.st = 0; return; }
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
    const ok = o => o && !o.muere && !o.vuelve && dist(o, s.p) <= rango + (o.jefe ? 1.2 : 0.4) && (!min || dist(o, s.p) >= min) && (!s.i3 || vistaCueva(s.p.x, s.p.z, o.x, o.z));
    if (typeof tg === 'number' && tg > 0) { const o = W.mons.get(tg); return ok(o) && mismo(o, s) ? o : null; }
    let mejor = null, md = Infinity;
    for (const o of W.mons.values()) { if (!ok(o) || !mismo(o, s)) continue; const d = dist(o, s.p); if (d < md) { md = d; mejor = o; } }
    return mejor;
  },
  aliado3d(s, tg, rango, muerto) {
    if (typeof tg !== 'number' || tg <= 0 || tg === s.id) {
      if (!muerto) return s;
      return this.sesiones3d().find(a => a !== s && a.muerto && mismo(a, s) && dist(a.p, s.p) <= rango) || null;
    }
    const a = this.sesiones.get(tg);
    if (!a || !a.c || !a.m3 || !!a.muerto !== !!muerto) return null;
    return mismo(a, s) && dist(a.p, s.p) <= rango ? a : null;
  },
  aliadosCerca3d(s, radio) { return this.sesiones3d().filter(a => !a.muerto && mismo(a, s) && dist(a.p, s.p) <= radio); },

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
    if (h.gcd !== false && ahora < (s.gcdHasta || 0) - JITTER_MS) return this.enviar(s, { t: 'habNo', id: h.id });
    const costo = costoHab(h, s.st.recMax, s.c.espec);
    if (s.rec < costo) return this.no(s, `No tienes suficiente ${RECURSOS[CLASES[c.clase].recurso].nombre.toLowerCase()}.`);
    let obj = null;
    const tg = m.tg | 0;
    if (h.obj === 'enemigo' && m.tp) {
      // Contra el rival de un duelo (solo habilidades de un objetivo).
      const t = this.rivalDuelo(s);
      if (!t || t.id !== (m.tp | 0)) return;
      if (h.radio || h.area) return this.no(s, 'En un duelo solo valen las habilidades de un objetivo.');
      if (dist(s.p, t.p) > this.metros(h.rango, s) + 0.5) return this.no(s, 'Tu rival está fuera de alcance.');
      if (h.min && dist(s.p, t.p) < h.min / 17) return this.no(s, 'Estás demasiado cerca.');
      if (h.id === 'eviscerar' && !(s.combo > 0)) return this.no(s, 'Necesitas puntos de combo (usa Golpe Siniestro).');
      if (h.bajo && t.hp / t.st.maxHp > h.bajo) return this.no(s, 'Solo funciona con enemigos casi muertos.');
      this.desmontar(s);
      if (h.gcd !== false) s.gcdHasta = Math.max(ahora, s.gcdHasta || 0) + GCD_MS;
      if (h.cast) {
        s.cast = { h: h.id, fin: ahora + h.cast, tg: t.id, tk: 'd' };
        this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'cast', p: s.id, id: h.id, ms: h.cast, tg: t.id });
        return;
      }
      return this.habDuelo(s, h, t);
    }
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
    if (h.gcd !== false) s.gcdHasta = Math.max(ahora, s.gcdHasta || 0) + GCD_MS;
    if (h.cast) {
      s.cast = { h: h.id, fin: ahora + h.cast, tg: obj ? obj.id : 0, tk: h.obj === 'enemigo' ? 'm' : 'p' };
      this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'cast', p: s.id, id: h.id, ms: h.cast, tg: obj ? obj.id : 0 });
      return;
    }
    this.aplicar3d(s, h, obj);
  },

  // Al terminar el lanzamiento se vuelve a comprobar objetivo y recurso.
  finCast3d(s) {
    const ca = s.cast;
    s.cast = null;
    const h = habPorId(ca.h);
    if (ca.tk === 'd') {
      // Lanzamiento contra el rival de un duelo.
      const riv = this.rivalDuelo(s);
      const ok = riv && riv.id === ca.tg && riv.m3 && !s.muerto && dist(s.p, riv.p) <= this.metros(h.rango, s) + 3.5 && s.rec >= costoHab(h, s.st.recMax, s.c.espec);
      this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'castFin', p: s.id, ok: !!ok });
      if (ok) this.habDuelo(s, h, riv); else if (!s.muerto) this.no(s, 'Tu rival ya no está al alcance.');
      return;
    }
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
      this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'castFin', p: s.id, ok: false });
      if (!s.muerto) this.no(s, necesita && !obj ? 'El objetivo ya no está al alcance.' : 'No tienes suficiente recurso.');
      return;
    }
    this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, { t: 'castFin', p: s.id, ok: true });
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
      * (ahora < s.fuego ? 1.5 : 1) * (this.aura(s, 'grito') ? 1.1 : 1) * (this.elixir(s, 'elixirF') ? 1.1 : 1) * (this.elixir(s, 'sudado') ? 1.05 : 1) * k));
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
    const vivos = () => [...W.mons.values()].filter(o => !o.muere && mismo(o, s));
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
        let cx = obj.x - dx / d * 1.6, cz = obj.z - dz / d * 1.6;
        if (s.i3 && !caminable(cx, cz, 0.4)) {
          let ok = false;
          for (let k = 1.6; k <= d; k += 0.5) { const px = obj.x - dx / d * k, pz = obj.z - dz / d * k; if (caminable(px, pz, 0.4)) { cx = px; cz = pz; ok = true; break; } }
          if (!ok) { cx = s.p.x; cz = s.p.z; }
        }
        s.p = { x: cx, z: cz }; s.movBud = undefined;
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
      case 'polimorfia': this.ponerAuraMon(obj, 'oveja', h.dura); break;
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
    this.aCerca3d({ x: s.p.x, z: s.p.z, i3: s.i3 }, ev);
    if (cdReal) this.enviar(s, { t: 'cd', id: 'h_' + h.id, hasta: cdReal });
  },

  // Cada jugador recibe a los demas jugadores y los monstruos que tiene cerca.
  // Los monstruos nuevos llegan con sus datos completos (n); los que salen
  // de la vista, en q.
  fotos3d(W, jugadores, ahora = Date.now()) {
    // Cada uno ve a los de su misma instancia y a menos de VISTA_PJ (los de su
    // grupo, siempre); al entrar en vista se presentan con pj3.
    const fila = new Map();
    for (const s of jugadores) fila.set(s.id, [s.id, r1(s.p.x), r1(s.p.z), Math.round((s.ry || 0) * 100) / 100, s.a | 0, Math.ceil(s.hp), s.st.maxHp, s.muerto ? 1 : 0, s.h ? r1(s.h) : 0]);
    for (const s of jugadores) {
      const g = this.grupoDe(s), mios = g ? new Set(g.uids) : null;
      const antes = s.vistosP || new Set(), veoP = new Set(), pj = [];
      for (const x of jugadores) {
        if (!mismo(x, s)) continue;
        const ya = antes.has(x.id);
        if (x !== s && !(mios && mios.has(x.c.uid)) && dist(x.p, s.p) > (ya ? SALE_PJ : VISTA_PJ)) continue;
        veoP.add(x.id);
        if (!ya && x !== s) this.enviar(s, { t: 'pj3', p: this.info3d(x) });
        pj.push(fila.get(x.id));
      }
      s.vistosP = veoP;
      const ms = [], n = [], q = [];
      const ve = new Set();
      for (const o of W.mons.values()) {
        if (!mismo(o, s) || dist(o, s.p) > VISTA_MON) continue;
        ve.add(o.id);
        if (!s.vistos.has(o.id)) n.push({ id: o.id, k: o.k, nv: o.nv, x: r1(o.x), z: r1(o.z), hp: Math.ceil(o.hp), mx: o.max, j: o.jefe ? 1 : 0, mu: o.mundial3 ? 1 : undefined });
        else ms.push([o.id, r1(o.x), r1(o.z), Math.round(o.ry * 100) / 100, Math.ceil(o.hp), o.muere ? 3 : o.st]);
      }
      for (const id of s.vistos) if (!ve.has(id)) q.push(id);
      s.vistos = ve;
      this.enviar(s, { t: 's3', ts: ahora, p: pj, m: ms, n: n.length ? n : undefined, q: q.length ? q : undefined, hp: Math.ceil(s.hp), rec: Math.round(s.rec || 0), cb: s.combo || 0 });
    }
  },
};
