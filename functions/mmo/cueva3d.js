// ═══════════════════════════════════════════════════════
// DUENDE QUEST 3D — la Cueva de los Goblins (mazmorra instanciada)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo), junto a Mundo3D.
//
// Cada grupo (o jugador solo) tiene su instancia: s.i3 = id de la instancia y
// cada monstruo de la cueva lleva o.i3. Todas las instancias comparten las
// coordenadas (mmo/js/cueva3d.js, x >= CUEVA_X0); mundo3d.js filtra por i3
// en las fotos, la IA, los objetivos y las areas.
//
// Nivel de la instancia = el del mas alto del grupo al crearla (5-60). El
// Rey Goblin del trono: pisoton avisado en el suelo cada 11 s, llama a su
// guardia al 50 % y se enfurece al 25 %. Al caer, cofre para cada uno de
// los de dentro (pieza de equipo rara o mejor, XP y oro) y cuenta como
// mazmorra completada. Una instancia vacia 5 minutos se borra.
// ═══════════════════════════════════════════════════════
import { MONSTRUOS, statsMonstruo, xpParaSubir, RAREZAS, nombreItem, ALAS, hoyUTC } from '../../mmo/js/data.js';
import { CUEVA, CUEVA_X0, PORTAL_PUEBLO, nivelCueva } from '../../mmo/js/cueva3d.js';

const VACIA_MS = 5 * 60 * 1000;
const PISOTON = { cada: 11000, aviso: 2200, r: 7 };
const rnd = (a, b) => a + Math.random() * (b - a);
const r1 = v => Math.round(v * 10) / 10;

export const Cueva3D = {
  cuevas3() { const W = this.iniciar3d(); return W.cuevas || (W.cuevas = new Map()); },
  // Sesiones dentro de una instancia (las que siguen conectadas y dentro).
  dentroCueva(inst) { const l = []; for (const id of inst.dentro) { const s = this.sesiones.get(id); if (s && s.c && !s.cerrado && s.i3 === inst.id) l.push(s); } return l; },
  aCueva(inst, m) { const txt = JSON.stringify(m); for (const s of this.dentroCueva(inst)) this.enviar(s, txt); },

  entrarCueva(s) {
    if (s.i3 || s.muerto) return;
    if (Date.now() - (s.cuevaT || 0) < 3000) return this.no(s, 'Espera un momento.');   // entrar/salir en bucle avisaba a todo el 3D
    if (Math.hypot(s.p.x - PORTAL_PUEBLO.x, s.p.z - PORTAL_PUEBLO.z) > 9) return this.no(s, 'Ve al portal del pueblo.');
    if (Date.now() - (s.combateT || 0) < 5000) return this.no(s, 'No puedes entrar en pleno combate.');
    const g = this.grupoDe(s);
    const clave = g ? 'g' + g.id : 'u' + s.c.uid;
    const cuevas = this.cuevas3();
    let inst = [...cuevas.values()].find(i => i.clave === clave);
    // Ya vencido el Rey y sin nadie dentro: se abre una cueva nueva (antes volvias a la misma, vacia).
    if (inst && inst.hecha && !this.dentroCueva(inst).length) { const W = this.iniciar3d(); for (const id of inst.mons) W.mons.delete(id); cuevas.delete(inst.id); inst = null; }
    if (!inst) {
      const ahora = Date.now();
      if (ahora - (s.c.cuevaCreadaT || 0) < 60000) return this.no(s, 'Espera un minuto antes de abrir otra cueva.');
      // Con el tope lleno se libera la vacia mas antigua: si no, crear y abandonar cuevas en bucle las agotaba
      if (cuevas.size >= 40) {
        const vieja = [...cuevas.values()].filter(i => !this.dentroCueva(i).length).sort((a, b) => (a.vacia || a.creada) - (b.vacia || b.creada))[0];
        if (vieja) { const W = this.iniciar3d(); for (const id of vieja.mons) W.mons.delete(id); cuevas.delete(vieja.id); }
      }
      if (cuevas.size >= 40) return this.no(s, 'Las cuevas están llenas: prueba en un momento.');
      s.c.cuevaCreadaT = ahora;
      const del = g ? this.sesionesGrupo(g) : [s];
      inst = this.crearCueva(clave, nivelCueva(Math.max(...del.map(x => x.c.nivel))), del.length);
    }
    if (this.dentroCueva(inst).length >= CUEVA.max) return this.no(s, 'La cueva de tu grupo ya está llena.');
    this.desmontar(s);
    s.cuevaT = Date.now();
    s.i3 = inst.id;
    inst.dentro.add(s.id);
    inst.vacia = 0;
    // Si entra mas gente de la que habia al crearla, el Rey sube su vida en proporcion.
    const jf = this.iniciar3d().mons.get(inst.jefe), nDentro = this.dentroCueva(inst).length;
    if (jf && !jf.muere && nDentro > inst.gente) {
      const k = (1 + 0.7 * (nDentro - 1)) / (1 + 0.7 * (inst.gente - 1));
      jf.max = Math.round(jf.max * k); jf.hp = Math.round(jf.hp * k); inst.gente = nDentro;
    }
    s.p = { x: CUEVA_X0 + CUEVA.entrada.x + rnd(-2, 2), z: CUEVA.entrada.z + rnd(-1, 1) };
    s.h = 0; s.movBud = undefined; s.cast = null;
    this.enviar(s, { t: 'tp3', x: r1(s.p.x), z: r1(s.p.z), cueva: { id: inst.id, nv: inst.nv, hecha: inst.hecha ? 1 : 0 } });
    this.enviar(s, { t: 'toast', m: `⛏ ${CUEVA.nombre} (Nv ${inst.nv}). El Rey Goblin espera en su trono.` });
    if (g) this.avisarGrupo(g, `⛏ ${s.c.nombre} entró a la ${CUEVA.nombre}.`, s);
    this.aDe(s, { t: 'pj3', p: this.info3d(s) });   // a los cercanos; al resto se lo presenta fotos3d
  },

  crearCueva(clave, nv, gente) {
    const W = this.iniciar3d();
    const inst = { id: W.sig++, clave, nv, dentro: new Set(), mons: new Set(), creada: Date.now(), vacia: 0, hecha: false, jefe: 0, gente: Math.max(1, gente), guardias: [] };
    for (const [x, z, k, n] of CUEVA.grupos) for (let i = 0; i < n; i++) this.monCueva(inst, k, x + rnd(-2.5, 2.5), z + rnd(-2.5, 2.5), false);
    inst.jefe = this.monCueva(inst, CUEVA.jefe.k, CUEVA.jefe.x, CUEVA.jefe.z, true).id;
    this.cuevas3().set(inst.id, inst);
    return inst;
  },
  monCueva(inst, k, lx, lz, jefe) {
    const W = this.iniciar3d();
    const def = MONSTRUOS[k];
    const st = statsMonstruo(k, inst.nv);
    // Los de la cueva aguantan un poco mas (es una mazmorra) y el jefe escala con el grupo.
    const hp = Math.round(st.hp * (jefe ? 2.2 * (1 + 0.7 * (inst.gente - 1)) : 1.3));
    const x = CUEVA_X0 + lx, z = lz;
    const o = {
      id: W.sig++, k, nv: inst.nv, campo: -1, i3: inst.id, cueva: true, jefe: !!jefe, dispara: !!def.dispara,
      x, z, hx: x, hz: z, ry: jefe ? -Math.PI / 2 : 0,
      hp, max: hp, atk: st.atk * (jefe ? 0.9 : 1), vel: st.vel, y: 0, h: 0,
      dano: new Map(), amen: new Map(), au: {}, cl: 'cueva', obj: 0, atkEn: 0, golpeT: 0, st: 0, paseo: 0, destino: null,
      pisa: null, pisaProx: 0, llamo: false, enfurecido: false,
    };
    W.mons.set(o.id, o);
    inst.mons.add(o.id);
    return o;
  },

  salirCueva(s, silencio) {
    const inst = this.cuevas3().get(s.i3);
    s.i3 = 0;
    if (inst) {
      inst.dentro.delete(s.id);
      if (!this.dentroCueva(inst).length) inst.vacia = Date.now();
      for (const id of inst.mons) { const o = this.iniciar3d().mons.get(id); if (o) { o.amen.delete(s.id); if (o.obj === s.id) { o.obj = 0; o.vuelve = true; } } }
    }
    s.p = { x: PORTAL_PUEBLO.x + rnd(2, 4), z: PORTAL_PUEBLO.z + rnd(2, 4) };
    s.c.p3 = { x: r1(s.p.x), z: r1(s.p.z) };
    s.movBud = undefined; s.cast = null;
    this.enviar(s, { t: 'tp3', x: r1(s.p.x), z: r1(s.p.z), cueva: null });
    if (!silencio) this.enviar(s, { t: 'toast', m: 'Saliste de la cueva.' });
    this.aDe(s, { t: 'pj3', p: this.info3d(s) });   // a los cercanos; al resto se lo presenta fotos3d
  },

  // Cada tick: instancias vacias, mecanicas del jefe.
  tickCuevas(ahora) {
    const W = this.iniciar3d();
    for (const inst of this.cuevas3().values()) {
      const gente = this.dentroCueva(inst);
      for (const id of [...inst.dentro]) if (!gente.some(x => x.id === id)) inst.dentro.delete(id);
      if (!gente.length) {
        if (!inst.vacia) inst.vacia = ahora;
        else if (ahora - inst.vacia > VACIA_MS) {
          for (const id of inst.mons) W.mons.delete(id);
          this.cuevas3().delete(inst.id);
        }
        continue;
      }
      const o = W.mons.get(inst.jefe);
      if (!o || o.muere) continue;
      // Mientras vuelve al trono no hay pisotones.
      if (o.vuelve) { if (o.pisa) { o.pisa = null; this.aCueva(inst, { t: 'zona3f', id: o.id }); } continue; }
      if (o.pisa && ahora >= o.pisa.en) {
        for (const s of gente) {
          if (s.muerto || Math.hypot(s.p.x - o.pisa.x, s.p.z - o.pisa.z) > PISOTON.r) continue;
          this.herir(s, 1, { zona: true, pct: o.enfurecido ? 0.4 : 0.28, id: o.id });
        }
        this.aCueva(inst, { t: 'zona3f', id: o.id });
        o.pisa = null;
      }
      if (!o.pisa && o.obj && ahora >= o.pisaProx) {
        const t = this.sesiones.get(o.obj);
        if (t && t.i3 === inst.id) {
          o.pisa = { x: t.p.x, z: t.p.z, en: ahora + PISOTON.aviso };
          o.pisaProx = ahora + PISOTON.cada * (o.enfurecido ? 0.65 : 1);
          this.aCueva(inst, { t: 'zona3', id: o.id, x: r1(t.p.x), z: r1(t.p.z), r: PISOTON.r, ms: PISOTON.aviso });
        }
      }
      if (!o.obj) o.pisaProx = ahora + 5000;
      if (!o.llamo && o.hp < o.max * 0.5) {
        o.llamo = true;
        for (let i = 0; i < 2; i++) {
          const a = this.monCueva(inst, 'goblin_guard', CUEVA.jefe.x - 8 + i * 16 - 8, CUEVA.jefe.z + (i ? 12 : -12), false);
          a.obj = o.obj;
          inst.guardias.push(a.id);
        }
        this.aCueva(inst, { t: 'aviso', m: '👑 «¡Guardias, a mí!» El Rey Goblin llama a su guardia.' });
      }
      if (!o.enfurecido && o.hp < o.max * 0.25) {
        o.enfurecido = true;
        o.atk *= 1.3;
        this.aCueva(inst, { t: 'aviso', m: '👑 El Rey Goblin se enfurece: pisotones más rápidos y más fuertes.' });
      }
    }
  },

  // Tras una derrota del grupo, el Rey vuelve a la fase 1 (sin furia ni guardia).
  reiniciarJefeCueva(o) {
    if (o.enfurecido) o.atk /= 1.3;
    o.enfurecido = false; o.llamo = false; o.pisaProx = 0;
    const inst = this.cuevas3().get(o.i3); if (!inst) return;
    if (o.pisa) { o.pisa = null; this.aCueva(inst, { t: 'zona3f', id: o.id }); }
    const W = this.iniciar3d();
    for (const id of inst.guardias || []) { W.mons.delete(id); inst.mons.delete(id); }
    inst.guardias = [];
  },

  // El Rey cae: cofre para cada uno de los de dentro.
  premiosCueva(o) {
    const inst = this.cuevas3().get(o.i3);
    if (!inst || inst.hecha) return;
    inst.hecha = true;
    const nombres = [];
    for (const s of this.dentroCueva(inst)) {
      const c = s.c;
      const peleo = o.dano.has(s.id) || o.amen.has(s.id);
      if (!peleo || s.muerto) { this.enviar(s, { t: 'toast', m: 'Para el cofre hay que pelear contra el Rey (y seguir vivo).' }); continue; }
      const hoy = hoyUTC();
      if (!c.cuevaDia || c.cuevaDia.d !== hoy) c.cuevaDia = { d: hoy, n: 0 };
      const completo = c.cuevaDia.n++ < 3, nvOk = inst.nv >= c.nivel - 10;
      const xp = Math.round(xpParaSubir(c.nivel) * (completo && nvOk ? 0.3 : 0.05));
      const oro = (completo ? 50 : 10) * inst.nv;
      c.oro += oro;
      if (nvOk) c.mazmorras = (c.mazmorras || 0) + 1;
      c.alas = c.alas || ['aprendiz'];
      if (c.mazmorras >= ALAS.cueva.mazmorras && !c.alas.includes('cueva')) {
        c.alas.push('cueva');
        this.enviar(s, { t: 'toast', ok: true, m: `🪽 ¡Ganaste las ${ALAS.cueva.nombre}! Póntelas en el Mercader → ALAS.` });
      }
      const it = completo && nvOk ? this.darItem(s, this.nuevoItem(c.nivel, 2)) : null;
      this.sumarXp(s, xp);
      if (nvOk) this.progresoTarea && this.progresoTarea(s, 'mazmorra');
      if (nvOk && this.puntoGesta) this.puntoGesta(s, 'mazmorra');   // la cueva 3D tambien suma a la gesta de la hermandad
      this.enviar(s, { t: 'gana', xp, oro, drops: [], item: it });
      this.enviar(s, { t: 'toast', ok: true, m: `🏆 ¡${CUEVA.nombre} completada! +${xp} XP · +${oro} oro${it ? ' · ' + RAREZAS[it.r].nombre + ': ' + nombreItem(it) : ''}${completo ? '' : ' (cofre pequeño: hoy ya abriste 3 completos)'}` });
      s.sucio = true;
      this.revisarLogros(s);
      this.actualizarYo(s);
      nombres.push(c.nombre);
    }
    this.aCueva(inst, { t: 'cofre3' });
    if (nombres.length) this.aTodos({ t: 'aviso', m: `👑 El Rey Goblin cayó en la ${CUEVA.nombre}: ${nombres.join(', ')}.` });
  },
};
