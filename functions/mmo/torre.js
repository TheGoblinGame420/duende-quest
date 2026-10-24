// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — la Torre del Duende
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Desde Nv 10, solo o con tu grupo, por el portal de mazmorras del pueblo.
// Cada piso es una oleada de monstruos de tu nivel que hay que limpiar en
// TORRE.tiempo; cada uno es mas duro que el anterior y cada TORRE.jefeCada
// pisos sale un jefe. Si caeis todos (o se acaba el tiempo) la subida se
// acaba. Tu mejor piso de la semana va al ranking y cada 5 pisos nuevos de
// la semana dan un cofre (oro y equipo). Nunca mTON: sus jefes van marcados
// como de mazmorra para que no cuenten como jefes de zona.
// La instancia es 'torre#xxxx' con w.torre (no w.inst: no es una mazmorra).
// ═══════════════════════════════════════════════════════
import { MAPAS, MONSTRUOS, TORRE, MODS_TORRE, modTorre, atajoTorre, pisoTorre, premioTorre, premioTorreSem, zonaDeNivel, semanaUTC, NIVEL_MAX, PASE } from '../../mmo/js/data.js';
import { getEnv, tg } from '../api/lib.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export const Torre = {
  entrarTorre(s, m = {}) {
    const c = s.c;
    if (s.muerto) return;
    if (!this.cercaDelBuscador(s)) return this.no(s, 'Ve al portal de mazmorras del pueblo.');
    if (c.nivel < TORRE.nv) return this.no(s, `La Torre se abre a nivel ${TORRE.nv}.`);
    const ahora = Date.now();
    this.creadasT = this.creadasT || new Map();
    const hechas = x => (this.creadasT.get(x.c.uid) || []).filter(t => ahora - t < 3600000);
    if (hechas(s).length >= TORRE.porHora) return this.no(s, 'Has subido muchas veces seguidas: descansa un rato.');
    if (Object.values(this.mundo).filter(w => w.torre).length >= TORRE.instancias) return this.no(s, 'La Torre está llena ahora mismo: prueba en unos minutos.');
    // Suben juntos los del grupo que esten junto al portal, vivos, con nivel
    // y sin pasarse de subidas por hora (cuentan para todos, no solo quien pulsa).
    const g = this.grupoDe(s);
    const quienes = g ? this.sesionesGrupo(g).filter(x => x !== s && !x.muerto && this.cercaDelBuscador(x) && x.c.nivel >= TORRE.nv && hechas(x).length < TORRE.porHora) : [];
    quienes.unshift(s);
    quienes.length = Math.min(quienes.length, TORRE.max);
    for (const x of quienes) this.creadasT.set(x.c.uid, [...hechas(x), ahora]);
    this.sigInst = (this.sigInst || 0) + 1;
    const clave = 'torre#' + this.sigInst.toString(36) + Math.random().toString(36).slice(2, 6);
    const w = this.mundoK(clave);
    w.spawnEn = Infinity;
    // Atajo: a lo sumo la marca de la semana - 5.
    // En grupo, solo si TODOS lo tienen (si no, se llevaria a alguien a pisos
    // altos y cobraria cofres de pisos que no subio).
    const d0 = m.desde | 0;
    const desde = d0 > 0 && d0 % 5 === 0 && quienes.every(x => d0 <= atajoTorre(this.torreSem(x.c).max)) ? d0 : 0;
    if (d0 && !desde && quienes.length > 1) this.enviar(s, { t: 'toast', m: '🗼 El atajo solo vale si todos los del grupo tienen esa marca esta semana: suben desde el piso 1.' });
    w.torre = { sem: semanaUTC(), piso: desde, nv: Math.min(NIVEL_MAX, Math.max(...quienes.map(x => x.c.nivel))), n: quienes.length, sigEn: ahora + TORRE.pausa, pisoIni: 0, fin: false, vacioDesde: 0 };
    for (const x of quienes) {
      this.entrarMapa(x, 'torre', 700, false, clave);
      this.enviar(x, { t: 'torre', piso: desde, mejor: this.torreSem(x.c).max, nv: w.torre.nv });
      this.enviar(x, { t: 'toast', ok: true, m: `🗼 Torre del Duende (Nv ${w.torre.nv}). Limpia cada piso en ${Math.floor(TORRE.tiempo / 60000)} min y ${Math.round(TORRE.tiempo % 60000 / 1000)} s. Cada 5 pisos nuevos de la semana, un cofre.` });
    }
    if (g) for (const x of this.sesionesGrupo(g)) if (!quienes.includes(x)) this.enviar(x, { t: 'toast', m: '🗼 Tu grupo subió a la Torre del Duende (solo entran los que están junto al portal).' });
  },

  // Tu marca de esta semana (se reinicia el lunes UTC).
  torreSem(c) {
    const sem = semanaUTC();
    if (!c.torre || c.torre.sem !== sem) c.torre = { sem, max: 0 };
    return c.torre;
  },

  tickTorre(w, jugadores, ahora) {
    const T = w.torre;
    if (T.fin) return;
    const vivos = jugadores.filter(s => !s.muerto);
    if (!vivos.length) return this.acabarTorre(w, jugadores, `La Torre ${jugadores.length > 1 ? 'los' : 'te'} venció en el piso ${T.piso}.`);
    if (T.sigEn) {
      if (ahora >= T.sigEn) this.subirPiso(w, ahora);
      return;
    }
    if (ahora - T.pisoIni > TORRE.tiempo) return this.acabarTorre(w, jugadores, `⏳ Se acabó el tiempo del piso ${T.piso}.`, true);
    for (const o of w.mons.values()) if (!o.muere) return;
    // Piso limpio: cuenta para todos los que siguen en pie.
    // Una subida que cruza el lunes no cuenta para la semana nueva (ni da
    // otra vez los cofres de la anterior).
    if (T.sem === semanaUTC()) for (const s of vivos) this.anotarTorre(s, T.piso);
    for (const s of vivos) this.progresoTarea(s, 'torre');
    this.aClave(w.clave, { t: 'torre', piso: T.piso, limpio: 1 });
    this.aClave(w.clave, { t: 'emote', m: `Piso ${T.piso} superado.${(T.piso + 1) % TORRE.jefeCada === 0 ? ' El siguiente tiene jefe.' : ''}` });
    T.sigEn = ahora + TORRE.pausa;
  },

  subirPiso(w, ahora) {
    const T = w.torre;
    T.piso++;
    T.sigEn = 0;
    T.pisoIni = ahora;
    const P = pisoTorre(T.piso);
    const n = T.n;
    const z = MAPAS[zonaDeNivel(T.nv)];
    const pool = z.monstruos;
    const vida = P.vida * (1 + 0.8 * (n - 1));
    const lados = [260, 1140];
    const mod = modTorre(T.piso);
    for (let i = 0; i < P.n; i++) {
      const x = lados[i % 2] + rnd(-90, 90);
      const elite = mod === 'elite' && i === 0;
      const o = this.crearMonstruo(w.clave, pool[Math.floor(Math.random() * pool.length)], x,
        { nv: T.nv + (i === 0 ? 1 : 0), hpX: vida * (mod === 'blindados' ? 1.3 : elite ? 3 : 1), atkX: P.atk * (mod === 'blindados' ? 0.9 : elite ? 1.3 : 1), agresivo: true, radioAgro: 2000, xpX: TORRE.xp });
      o.torre = true;
      if (elite) { o.ex = { elite: 1, ti: '#facc15', nom: 'Élite' }; this.aClave(w.clave, { t: 'ms', m: this.infoMonstruo(o) }); }
      if (mod === 'veloces') o.vel *= 1.3;
    }
    if (P.jefe) {
      // Jefes de zona de tu tramo, por turnos; sin territorio ni mTON.
      const jefes = Object.keys(MONSTRUOS).filter(k => { const m = MONSTRUOS[k]; return m.jefe && !m.mazmorra && !m.mundial && !m.asedio && m.nivel <= T.nv + 6; })
        .sort((a, b) => MONSTRUOS[b].nivel - MONSTRUOS[a].nivel).slice(0, 3);
      const k = jefes[(T.piso / TORRE.jefeCada) % jefes.length] || z.jefe;
      if (MONSTRUOS[k]) this.crearMonstruo(w.clave, k, 700 + (Math.random() < 0.5 ? -330 : 330),
        { nv: T.nv + 2, hpX: P.vida * TORRE.vidaJefe * (1 + 1.2 * (n - 1)), atkX: P.atk * TORRE.atkJefe, agresivo: true, radioAgro: 2000, mazmorra: true, xpX: TORRE.xp }).torre = true;
    }
    this.aClave(w.clave, { t: 'torre', piso: T.piso, nv: T.nv, en: TORRE.tiempo, mod: mod || '', jefe: P.jefe ? 1 : 0 });
    const M = mod && MODS_TORRE[mod];
    this.aClave(w.clave, { t: 'emote', m: P.jefe ? `Piso ${T.piso} · Jefe` : M ? `🗼 Piso ${T.piso} · ${M.emoji} ${M.nombre}: ${M.desc}` : `🗼 Piso ${T.piso}` });
  },

  // Fin de la subida: los que siguen dentro vuelven al pueblo (los caidos,
  // al revivir). Con fuera=true tambien se saca a los vivos.
  acabarTorre(w, jugadores, txt, fuera) {
    const T = w.torre;
    T.fin = true;
    for (const o of [...w.mons.values()]) { w.mons.delete(o.id); this.aClave(w.clave, { t: 'md', id: o.id, pr: [], fuera: 1 }); }
    for (const s of jugadores) {
      this.enviar(s, { t: 'toast', m: `${txt} Llegaste al piso ${T.piso}. Tu marca de la semana: ${this.torreSem(s.c).max}.` });
      if (fuera && !s.muerto) { this.entrarMapa(s, 'pueblo', 795); this.guardar(s); }
    }
  },

  // Un piso superado: marca de la semana, cofre cada 5 pisos nuevos y ranking.
  anotarTorre(s, piso) {
    const c = s.c;
    const t = this.torreSem(c);
    c.torreMax = Math.max(c.torreMax || 0, piso);
    // Montura que solo da la Torre (piso TORRE.montura, de una vez para siempre).
    c.monturas = c.monturas || [];
    if (c.torreMax >= TORRE.montura && !c.monturas.includes('torre')) {
      c.monturas.push('torre');
      s.sucio = true;
      this.enviar(s, { t: 'toast', ok: true, m: `Nueva montura: Lagarto de la Torre. Mercader → Monturas.` });
      this.aTodos({ t: 'aviso', m: `🦎 ${c.nombre} ganó el Lagarto de la Torre (piso ${TORRE.montura}).` });
    }
    if (piso <= t.max) { this.revisarLogros(s); return; }
    const antes = t.max;
    t.max = piso;
    s.sucio = true;
    for (let p = Math.floor(antes / TORRE.jefeCada + 1) * TORRE.jefeCada; p <= piso; p += TORRE.jefeCada) {
      const pr = premioTorre(p, c.nivel);
      c.oro += pr.oro;
      const it = this.darItem(s, this.generarItem(Math.min(NIVEL_MAX, c.nivel), pr.rMin));
      if (this.puntoPase) this.puntoPase(s, PASE.puntos.torre);
      this.enviar(s, { t: 'toast', ok: true, m: `🎁 Cofre del piso ${p}: +${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro y ${it && it.r >= 2 ? 'un objeto ÉPICO' : 'un objeto raro'}.` });
    }
    this.enviar(s, { t: 'torre', piso, mejor: t.max });
    this.anotarRankTorre(s, piso);
    this.revisarLogros(s);
    this.actualizarYo(s);
  },

  // Ranking semanal de la Torre: en memoria y guardado al momento (pasa poco).
  // Al cambiar la semana se premia a los 3 primeros (cerrarSemanaTorre).
  async cargarRankTorre() {
    if (!this.rt) {
      this.rtP = this.rtP || this.state.storage.get('rankTorre').catch(e => { this.rtP = null; throw e; });
      const r = await this.rtP;
      if (!this.rt) this.rt = r || { sem: semanaUTC(), l: {} };
    }
    if (this.rt.sem !== semanaUTC()) await this.cerrarSemanaTorre();
    return this.rt;
  },
  cerrarSemanaTorre() {
    if (this.cerrandoT) return this.cerrandoT;
    this.cerrandoT = (async () => {
      const vieja = this.rt || (await this.state.storage.get('rankTorre'));
      if (!vieja || vieja.sem === semanaUTC()) { this.rt = vieja || { sem: semanaUTC(), l: {} }; return; }
      this.rt = { sem: semanaUTC(), l: {} };
      await this.state.storage.put('rankTorre', this.rt);
      await this.premiarTorre(vieja);
    })().finally(() => { this.cerrandoT = null; });
    return this.cerrandoT;
  },
  async premiarTorre(rt) {
    const top = Object.entries(rt.l || {}).sort((a, b) => b[1].p - a[1].p || a[1].t - b[1].t).filter(([, f]) => f.p >= TORRE.semMin).slice(0, 3);
    const nombres = [];
    for (let i = 0; i < top.length; i++) {
      const [uid, f] = top[i];
      const { s, c } = await this.pjDe(uid);
      if (!c) continue;
      const oro = premioTorreSem(i);
      c.oro += oro;
      if (i === 0) c.reyTorre = (c.reyTorre || 0) + 1;
      if (s) { this.actualizarYo(s); this.revisarLogros(s); await this.guardar(s); }
      else await this.state.storage.put('c:' + uid, c);
      nombres.push(['🥇', '🥈', '🥉'][i] + ' ' + f.n + ' (piso ' + f.p + ')');
      const txt = `🗼 ¡Quedaste ${['1º', '2º', '3º'][i]} en la Torre del Duende esta semana (piso ${f.p})! Premio: +${oro.toLocaleString('es', { useGrouping: 'always' })} oro${i === 0 ? ' y el título de Rey de la Torre' : ''}. La Torre vuelve a empezar.`;
      if (s) this.enviar(s, { t: 'toast', m: txt, ok: true });
      if (uid.startsWith('tg:') && this.quiereAvisos && await this.quiereAvisos(uid)) { try { const env = getEnv({ env: this.env }); await tg(env.BOT_TOKEN, 'sendMessage', { chat_id: uid.slice(3), text: txt }); } catch (e) {} }
    }
    if (nombres.length) this.aTodos({ t: 'aviso', m: `🗼 Ranking semanal de la Torre: ${nombres.join(' · ')}. Esta semana, de cero.` });
  },
  anotarRankTorre(s, piso) {
    if (this.esPrueba(s.c)) return;
    this.cargarRankTorre().then(rt => {
      const f = rt.l[s.c.uid];
      if (f && f.p >= piso) return;
      // Nuevo record de la semana del servidor (desde el piso semMin, cada 5): a todos.
      const mejor = Math.max(0, ...Object.entries(rt.l).filter(([u]) => u !== s.c.uid).map(([, x]) => x.p));
      if (piso >= TORRE.semMin && piso % 5 === 0 && piso > mejor) this.aTodos({ t: 'aviso', m: `${s.c.nombre} ha llegado al piso ${piso} de la Torre del Duende. Récord de la semana.` });
      rt.l[s.c.uid] = { n: s.c.nombre, p: piso, k: s.c.clase || '', t: Date.now() };
      return this.state.storage.put('rankTorre', rt);
    }).catch(e => console.error('[MMO rankTorre]', e));
  },
  async topTorre() {
    const rt = await this.cargarRankTorre();
    return Object.entries(rt.l).sort((a, b) => b[1].p - a[1].p || a[1].t - b[1].t);
  },

  // Torres vacias (todos salieron o se desconectaron): se cierran.
  limpiarTorres(porClave, ahora) {
    for (const k in this.mundo) {
      const w = this.mundo[k];
      if (!w.torre) continue;
      if (porClave[k] && porClave[k].length) { w.torre.vacioDesde = 0; continue; }
      if (!w.torre.vacioDesde) { w.torre.vacioDesde = ahora; continue; }
      if (ahora - w.torre.vacioDesde > 5000) delete this.mundo[k];
    }
  },
};
