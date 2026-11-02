// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — misiones diarias y semanales
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada personaje tiene 3 tareas al dia y 2 a la semana, elegidas al azar
// (pero fijas para ese dia: salen de un hash del uid y la fecha) entre las
// que encajan con su nivel. Se cobran solas al cumplirse y completar todas
// da un bono. Son el "motivo para volver mañana" que faltaba entre la
// cadena de misiones (que se acaba) y el jefe mundial.
// Premios: XP, oro, poderes y equipo. NUNCA mTON.
// ═══════════════════════════════════════════════════════
import { TAREAS_DIA, TAREAS_SEMANA, premioTarea, zonaDeNivel, hoyUTC, semanaUTC, MAPAS, MONSTRUOS, NIVEL_MAX , PASE, temporadaDe, TEMP_DIAS, TEMP_DIA_PREMIO, premioDiaFiesta, esNochebuena, diaFiesta, diasFiesta } from '../../mmo/js/data.js';

// Solo existen en CLASSIC (2D): en ORIGINS no se reparten y, si ya tocaron, se cambian.
// (Las expediciones ya existen tambien en ORIGINS: ventana 🧭 de ventanas.js.)
const SOLO_2D = new Set(['torre']);
// Medidor semanal: puntos para abrir cada uno de los 3 cofres de la semana.
const SEMANA_COFRES = [4, 8, 12];
// Hash entero pequeño y estable (para elegir las tareas del dia).
function hash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
function elegir(lista, n, semilla, nivel) {
  const validas = lista.filter(t => !t.nv || nivel >= t.nv);
  const r = [];
  let h = hash(semilla);
  while (r.length < n && validas.length) {
    const i = h % validas.length;
    r.push(validas.splice(i, 1)[0]);
    h = hash(String(h));
  }
  return r;
}

export const Tareas = {
  // Las tareas del dia y de la semana (se crean al pedirlas por primera vez).
  tareasDe(c) {
    const hoy = hoyUTC(), sem = semanaUTC();
    if (!c.tareas || !(c.tareas.d >= hoy)) {   // una fecha futura (reloj UTC antiguo) no las renueva otra vez
      const zona = zonaDeNivel(c.nivel);
      c.tareas = { d: hoy, bono: false, cambio: false, l: elegir(this.tareasPosibles().filter(t => !c.en3d || !SOLO_2D.has(t.tipo)), 3, c.uid + hoy, c.nivel).map(t => ({ id: t.id, p: 0, ok: false, zona: t.tipo === 'zona' ? zona : undefined })) };
    }
    if (!c.semana || !(c.semana.d >= sem)) {
      c.semana = { d: sem, bono: false, pts: 0, cof: 0, l: elegir(c.en3d ? TAREAS_SEMANA.filter(t => !SOLO_2D.has(t.tipo)) : TAREAS_SEMANA, 2, c.uid + 'S' + sem, c.nivel).map(t => ({ id: t.id, p: 0, ok: false })) };
    }
    if (c.en3d) this.quitarSolo2d(c);
    return { dia: c.tareas, sem: c.semana };
  },
  // Jugando en ORIGINS: una tarea de solo CLASSIC sin hacer se cambia por otra (no gasta el cambio gratis).
  quitarSolo2d(c) {
    for (const [bloque, defs, sem] of [[c.tareas, TAREAS_DIA, false], [c.semana, TAREAS_SEMANA, true]]) {
      const usadas = new Set(bloque.l.map(x => x.id));
      bloque.l.forEach((t, i) => {
        const def = defs.find(d => d.id === t.id);
        if (!def || t.ok || !SOLO_2D.has(def.tipo)) return;
        const pos = (sem ? TAREAS_SEMANA : this.tareasPosibles()).filter(x => !usadas.has(x.id) && !SOLO_2D.has(x.tipo));
        const nueva = elegir(pos, 1, c.uid + bloque.d + 'O3' + i, c.nivel)[0];
        if (!nueva) return;
        usadas.add(nueva.id);
        bloque.l[i] = { id: nueva.id, p: 0, ok: false, zona: nueva.tipo === 'zona' ? zonaDeNivel(c.nivel) : undefined };
      });
    }
  },

  // Con menos de 6 jugadores conectados no se reparten tareas que piden a otros
  // (cazar en grupo) ni la del jefe mundial: con pocos se quedaban bloqueadas.
  tareasPosibles() {
    let on = 0;
    for (const x of (this.sesiones || new Map()).values()) if (x.c) on++;
    return on < 6 ? TAREAS_DIA.filter(t => t.tipo !== 'grupo' && t.tipo !== 'mundial') : TAREAS_DIA;
  },
  // Un cambio gratis al dia: una diaria sin cumplir por otra que no este ya.
  cambiarTarea(s, m) {
    const c = s.c, { dia } = this.tareasDe(c), i = m.i | 0, t = dia.l[i];
    if (!t || t.ok) return;
    if (dia.cambio) return this.no(s, 'Hoy ya cambiaste una tarea. Mañana tendrás otro cambio gratis.');
    const usadas = new Set(dia.l.map(x => x.id));
    const nueva = elegir(this.tareasPosibles().filter(x => !usadas.has(x.id)), 1, c.uid + hoyUTC() + 'R', c.nivel)[0];
    if (!nueva) return this.no(s, 'No hay otra tarea disponible para tu nivel.');
    dia.l[i] = { id: nueva.id, p: 0, ok: false, zona: nueva.tipo === 'zona' ? zonaDeNivel(c.nivel) : undefined };
    dia.cambio = true;
    s.sucio = true;
    this.enviar(s, { t: 'tareas', ...this.infoTareas(c) });
    this.enviar(s, { t: 'toast', ok: true, m: `🔄 Nueva tarea: ${this.textoTarea(nueva, c, dia.l[i])}` });
  },

  // Algo que cuenta para las tareas. o = monstruo (si es una caza), n =
  // jugadores del grupo que la cobran.
  progresoTarea(s, tipo, o, n) {
    const c = s.c;
    if (!c) return;
    if (s.m3 && this.progresoEncargo) this.progresoEncargo(s, tipo, o);   // encargos de zona de ORIGINS
    if (s.m3 && this.progresoSecundaria) this.progresoSecundaria(s, tipo, o);   // misiones secundarias
    const { dia, sem } = this.tareasDe(c);
    let cambio = false, acabada = false;
    const revisar = (bloque, defs, semanal) => {
      for (const t of bloque.l) {
        if (t.ok) continue;
        const def = defs.find(d => d.id === t.id);
        if (!def) continue;
        let vale = false;
        if (tipo === 'caza' && o) {
          // Cazar: monstruos de tu nivel o hasta 5 por debajo (no vale
          // granjear la primera zona con un personaje alto).
          const nivelOk = (o.nv || MONSTRUOS[o.k].nivel) >= c.nivel - 5;
          if (def.tipo === 'caza') vale = nivelOk;
          else if (def.tipo === 'zona') vale = o.mapa === t.zona;
          else if (def.tipo === 'grupo') vale = nivelOk && n > 1;
        } else vale = def.tipo === tipo;
        if (!vale) continue;
        t.p++;
        cambio = true;
        if (t.p >= def.n) { t.ok = true; acabada = true; this.cobrarTarea(s, def, semanal); if (!semanal) this.puntoSemana(s, 1); }
      }
      // Diarias con margen: el bono del día sale al cumplir 2 de 3 (la
      // tercera sigue pagando su premio propio). La semanal pide todas.
      const listas = semanal ? bloque.l.every(t => t.ok) : bloque.l.filter(t => t.ok).length >= Math.min(2, bloque.l.length);
      if (!bloque.bono && bloque.l.length && listas) {
        bloque.bono = true;
        this.bonoTareas(s, semanal);
        if (!semanal) this.puntoSemana(s, 1);
      }
    };
    revisar(dia, TAREAS_DIA, false);
    revisar(sem, TAREAS_SEMANA, true);
    // El progreso se manda como mucho cada 3 s (la de "usa 50 habilidades"
    // lo mandaba con cada una); al cumplirse una, al momento.
    if (cambio) {
      s.sucio = true;
      const ahora = Date.now();
      if (acabada || ahora - (s.tareasT || 0) >= 3000) { s.tareasT = ahora; this.enviar(s, { t: 'tareas', ...this.infoTareas(c) }); }
    }
    if (tipo === 'caza' && o && (o.nv || (MONSTRUOS[o.k] || {}).nivel || 0) < c.nivel - 5) return;   // fiesta: caza de tu nivel
    this.progresoFiesta(s, tipo, 1);
  },

  // Calendario de la fiesta (data TEMP_DIAS): una tarea por dia. Suma a todos
  // los dias ya abiertos (hoy y los pasados sin cumplir: puesta al dia); nunca
  // a dias futuros. Cada dia cumplido paga premioDiaFiesta (data.js) del objeto de la fiesta.
  progresoFiesta(s, tipo, cant) {
    const c = s && s.c, tp = c && temporadaDe();
    if (!tp || !(cant > 0)) return;
    if (!c.fiestaDias || c.fiestaDias.id !== tp.id) c.fiestaDias = { id: tp.id, p: {}, ok: [] };
    const fd = c.fiestaDias, hoy = Math.min(diaFiesta(tp), diasFiesta(tp) - 1);
    let cambio = false;
    // Lo hecho se reparte del dia mas antiguo al mas nuevo (una accion no cumple dos dias a la vez).
    for (let d = 0, resto = cant; d <= hoy && resto > 0; d++) {
      const def = TEMP_DIAS[d % TEMP_DIAS.length];
      if (def.tipo !== tipo || fd.ok.includes(d)) continue;
      const usa = Math.max(0, Math.min(resto, def.n - (fd.p[d] || 0)));
      resto -= usa;
      fd.p[d] = (fd.p[d] || 0) + usa;
      cambio = true;
      if (fd.p[d] < def.n) continue;
      fd.ok.push(d);
      if (this.edicionTemp) this.edicionTemp(c, tp);
      const premio = premioDiaFiesta(tp, d);
      c[tp.campo] = (c[tp.campo] || 0) + premio;
      if (this.sumarTempGlobal) this.sumarTempGlobal(tp, premio);
      this.enviar(s, { t: 'toast', ok: true, m: `${tp.emoji} Día ${d + 1} de ${tp.nombre}${esNochebuena(tp, d) ? ' (⭐ Nochebuena, premio doble)' : ''} cumplido: "${def.txt}" · +${premio} ${tp.cosas}` });
      if (this.yoLuego) this.yoLuego(s, true);   // el 'yo' lleva fiestaDias (world.js datosPropios)
      if (this.tiendaTemp) this.tiendaTemp(s, {});   // saldo nuevo para la tienda de la fiesta
    }
    if (cambio) s.sucio = true;
  },

  cobrarTarea(s, def, semanal) {
    const c = s.c;
    if (this.puntoPase) this.puntoPase(s, semanal ? PASE.puntos.semanal : PASE.puntos.diaria);
    const pr = premioTarea(c.nivel, semanal);
    c.oro += pr.oro;
    this.sumarXp(s, pr.xp);   // en el nivel maximo va a la maestria
    this.enviar(s, { t: 'toast', m: `${semanal ? '📆 Semanal' : '☀️ Diaria'} cumplida: "${this.textoTarea(def, c)}" · +${pr.xp.toLocaleString('es', { useGrouping: 'always' })} XP · +${pr.oro.toLocaleString('es', { useGrouping: 'always' })} oro`, ok: true });
    this.enviar(s, { t: 'gana', xp: pr.xp, oro: pr.oro, drops: [], x: Math.round(s.x), y: Math.round(s.y - 80) });
    this.actualizarYo(s);
  },

  bonoTareas(s, semanal) {
    const c = s.c;
    if (this.puntoPase) this.puntoPase(s, PASE.puntos.bono);
    const it = this.darItem(s, this.generarItem(c.nivel, semanal ? 2 : 1));
    c.pw.escudo = Math.min(99, (c.pw.escudo || 0) + (semanal ? 5 : 2));
    c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + (semanal ? 10 : 5));
    this.enviar(s, { t: 'toast', m: `${semanal ? 'Semana' : 'Día'} completo. Bono: ${it.r >= 2 ? 'objeto ÉPICO' : 'objeto raro'}, ${semanal ? 5 : 2} escudos y ${semanal ? 10 : 5} pociones.`, ok: true });
    this.enviar(s, { t: 'cofreSem', tipo: semanal ? 'semana' : 'dia', item: it });   // ORIGINS: cofre que se abre con un toque
    c.diasCompletos = (c.diasCompletos || 0) + (semanal ? 0 : 1);
    // Bono semanal: un protector de racha 🧿 (maximo 2) que salva un dia faltado.
    if (semanal) {
      c.login = c.login || { d: null, racha: 0, total: 0 };
      const antes = c.login.amu || 0;
      c.login.amu = Math.min(2, antes + 1);
      if (c.login.amu > antes) this.enviar(s, { t: 'toast', ok: true, m: `🧿 Ganaste un protector de racha (tienes ${c.login.amu}). Si faltas un día, salva tu racha.` });
    }
    this.revisarLogros(s);
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Medidor semanal: +1 por diaria cumplida y +1 por bono del día. Con 4/8/12
  // puntos se abre un cofre con el mismo premio que el bono diario (objeto,
  // escudos y pociones). Así quien entra 4 de 7 días también se lleva algo.
  puntoSemana(s, n) {
    const c = s.c, sem = c && c.semana;
    if (!sem) return;
    sem.pts = (sem.pts || 0) + n;
    sem.cof = sem.cof || 0;
    while (sem.cof < 3 && sem.pts >= SEMANA_COFRES[sem.cof]) {
      sem.cof++;
      const it = this.darItem(s, this.generarItem(c.nivel, 1));
      c.pw.escudo = Math.min(99, (c.pw.escudo || 0) + 2);
      c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + 5);
      this.enviar(s, { t: 'toast', ok: true, m: `📦 Cofre semanal ${sem.cof}/3 abierto: ${it && it.r >= 2 ? 'objeto ÉPICO' : 'objeto raro'}, 2 escudos y 5 pociones.` });
      this.enviar(s, { t: 'cofreSem', tipo: 'semana', n: sem.cof, item: it });
      this.actualizarYo(s);
      this.guardar(s);
    }
    s.sucio = true;
  },

  textoTarea(def, c, t) {
    if (def.tipo === 'zona') return def.txt + ((MAPAS[(t && t.zona) || zonaDeNivel(c.nivel)] || {}).nombre || '');
    if (def.tipo === 'mazmorra' && c && c.en3d) return def.txt + ' (la Cueva del pueblo cuenta)';   // ORIGINS: la cueva 3D suma a esta tarea (cueva3d.js progresoTarea)
    return def.txt;
  },
  infoTareas(c) {
    const { dia, sem } = this.tareasDe(c);
    const fila = (t, defs) => { const d = defs.find(x => x.id === t.id); return { id: t.id, txt: this.textoTarea(d, c, t), p: Math.min(t.p, d.n), n: d.n, ok: t.ok }; };
    return { dia: { l: dia.l.map(t => fila(t, TAREAS_DIA)), bono: dia.bono, cambio: !!dia.cambio }, sem: { l: sem.l.map(t => fila(t, TAREAS_SEMANA)), bono: sem.bono, pts: sem.pts || 0, cof: sem.cof || 0 }, premio: premioTarea(c.nivel, false), premioSem: premioTarea(c.nivel, true) };
  },
};
