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
import { TAREAS_DIA, TAREAS_SEMANA, premioTarea, zonaDeNivel, hoyUTC, semanaUTC, MAPAS, MONSTRUOS, NIVEL_MAX } from '../../mmo/js/data.js';

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
    if (!c.tareas || c.tareas.d !== hoy) {
      const zona = zonaDeNivel(c.nivel);
      c.tareas = { d: hoy, bono: false, l: elegir(TAREAS_DIA, 3, c.uid + hoy, c.nivel).map(t => ({ id: t.id, p: 0, ok: false, zona: t.tipo === 'zona' ? zona : undefined })) };
    }
    if (!c.semana || c.semana.d !== sem) {
      c.semana = { d: sem, bono: false, l: elegir(TAREAS_SEMANA, 2, c.uid + 'S' + sem, c.nivel).map(t => ({ id: t.id, p: 0, ok: false })) };
    }
    return { dia: c.tareas, sem: c.semana };
  },

  // Algo que cuenta para las tareas. o = monstruo (si es una caza), n =
  // jugadores del grupo que la cobran.
  progresoTarea(s, tipo, o, n) {
    const c = s.c;
    if (!c) return;
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
        if (t.p >= def.n) { t.ok = true; acabada = true; this.cobrarTarea(s, def, semanal); }
      }
      if (!bloque.bono && bloque.l.length && bloque.l.every(t => t.ok)) {
        bloque.bono = true;
        this.bonoTareas(s, semanal);
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
  },

  cobrarTarea(s, def, semanal) {
    const c = s.c;
    const pr = premioTarea(c.nivel, semanal);
    c.oro += pr.oro;
    if (c.nivel < NIVEL_MAX) this.sumarXp(s, pr.xp);
    this.enviar(s, { t: 'toast', m: `${semanal ? '📆 Semanal' : '☀️ Diaria'} cumplida: "${this.textoTarea(def, c)}" · +${pr.xp.toLocaleString('es')} XP · +${pr.oro.toLocaleString('es')} oro`, ok: true });
    this.enviar(s, { t: 'gana', xp: pr.xp, oro: pr.oro, drops: [], x: Math.round(s.x), y: Math.round(s.y - 80) });
    this.actualizarYo(s);
  },

  bonoTareas(s, semanal) {
    const c = s.c;
    const it = this.darItem(s, this.generarItem(c.nivel, semanal ? 2 : 1));
    c.pw.escudo = Math.min(99, (c.pw.escudo || 0) + (semanal ? 5 : 2));
    c.pw.pocion = Math.min(99, (c.pw.pocion || 0) + (semanal ? 10 : 5));
    this.enviar(s, { t: 'toast', m: `🎁 ¡${semanal ? 'Semana' : 'Día'} completo! Bono: ${it.r >= 2 ? 'objeto ÉPICO' : 'objeto raro'}, ${semanal ? 5 : 2} escudos y ${semanal ? 10 : 5} pociones.`, ok: true });
    c.diasCompletos = (c.diasCompletos || 0) + (semanal ? 0 : 1);
    this.revisarLogros(s);
    this.guardar(s);
  },

  textoTarea(def, c, t) {
    if (def.tipo === 'zona') return def.txt + ((MAPAS[(t && t.zona) || zonaDeNivel(c.nivel)] || {}).nombre || '');
    return def.txt;
  },
  infoTareas(c) {
    const { dia, sem } = this.tareasDe(c);
    const fila = (t, defs) => { const d = defs.find(x => x.id === t.id); return { id: t.id, txt: this.textoTarea(d, c, t), p: Math.min(t.p, d.n), n: d.n, ok: t.ok }; };
    return { dia: { l: dia.l.map(t => fila(t, TAREAS_DIA)), bono: dia.bono }, sem: { l: sem.l.map(t => fila(t, TAREAS_SEMANA)), bono: sem.bono }, premio: premioTarea(c.nivel, false), premioSem: premioTarea(c.nivel, true) };
  },
};
