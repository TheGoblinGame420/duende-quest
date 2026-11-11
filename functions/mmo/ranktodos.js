// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — ranking de niveles COMPLETO
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// El ranking viejo ('ranking') guardaba solo el top 50, mandaba el top 20 y
// un personaje no entraba hasta subir de nivel: los de Nv 1 (casi todos los
// invitados) no salian nunca. Este indice lleva a TODOS los personajes con
// nombre, invitados incluidos:
//
// - En memoria: Map uid -> [nombre, nivel, xp, cazas]. Una lectura por
//   arranque (list del prefijo 'rkn:'), nunca los personajes ('c:').
// - En el storage: CUBOS trozos 'rkn:NN' (por hash del uid) para no pasar
//   del tamaño maximo de un valor. Solo se reescriben los trozos que
//   cambiaron y como mucho una vez por minuto (10 min en modo ahorro).
// - Se pone al dia al entrar (reservarNombre), al cambiar de nombre y al
//   subir de nivel (actualizarRanking). Nada por golpe ni por tick.
// - La primera vez (mig:rankTodos) recorre los personajes guardados por
//   paginas para sembrar el indice con los que aun no han vuelto a entrar.
// - Fuera: las cuentas de prueba internas y los baneados (se filtran al
//   armar la vista, asi vuelven solos al acabar el ban).
//
// Mensaje nuevo y opcional: { t:'rankNv', d:desde, q:busqueda } ->
// { t:'rankNv', d, q, tot, n, r:[{p,n,lv,k,inv?,yo?}], mas, mio }.
// Los rankings con premio (semana, ligas, torre, desafios, chicha) no pasan
// por aqui: sus reglas no cambian.
// ═══════════════════════════════════════════════════════
import { claveNombre } from './dios.js';

const CUBOS = 64;
export const RK_PAGINA = 50;
const VOLCAR_MS = 60000;
const VISTA_MIN_MS = 2000;      // tras un cambio, la vista ordenada se rehace como mucho cada 2 s
const VISTA_MAX_MS = 30000;     // sin cambios se rehace cada 30 s (bans que empiezan o acaban)
const PAGINA_MIG = 200;
// Personajes de las verificaciones en produccion del 30-sep-2026 (misma lista que mig:ranking-pruebas).
const NOMBRES_PRUEBA = new Set(['Bot Prueba', 'Probador', 'ClaudeTest', 'Duendecillo Bot', 'Sim']);

const cubo = uid => { let h = 0; for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0; return h % CUBOS; };
const claveCubo = i => 'rkn:' + String(i).padStart(2, '0');
const filaDe = c => [String(c.nombre), Math.max(1, c.nivel | 0), Math.max(0, Math.floor(c.xp || 0)), Math.max(0, c.kills | 0)];

export const RankTodos = {
  // El indice en memoria (una lectura por arranque).
  rkCargar() {
    if (!this._rkP) {
      const p = this._rkP = (async () => {
        const m = new Map();
        const l = await this.state.storage.list({ prefix: 'rkn:' });
        for (const [, v] of l) {
          if (!v || typeof v !== 'object') continue;
          for (const uid of Object.keys(v)) if (Array.isArray(v[uid]) && typeof v[uid][0] === 'string') m.set(uid, v[uid]);
        }
        this.rk = m; this.rkSucios = new Set(); this.rkVer = 0; this._rkV = null;
        return m;
      })();
      p.catch(() => { if (this._rkP === p) this._rkP = null; });
    }
    return this._rkP;
  },
  // Alta o puesta al dia de un personaje. Sin 'todo' solo escribe si cambio el
  // nombre o el nivel (al entrar: la XP suelta no merece una escritura).
  async rkAnotar(c, todo) {
    if (!c || typeof c.uid !== 'string' || !c.nombre || this.uidsPrueba.has(c.uid)) return;
    const m = await this.rkCargar();
    const f = m.get(c.uid), n = filaDe(c);
    if (f && f[0] === n[0] && f[1] === n[1] && (!todo || (f[2] === n[2] && f[3] === n[3]))) return;
    m.set(c.uid, n);
    this.rkSucios.add(cubo(c.uid)); this.rkVer++;
  },
  async rkQuitar(uid) {
    const m = await this.rkCargar();
    if (!m.delete(uid)) return;
    this.rkSucios.add(cubo(uid)); this.rkVer++;
  },
  // Herencia invitado -> cuenta: la fila pasa al uid nuevo (deja de ser «Invitado»).
  async rkMover(viejo, nuevo, nombre) {
    const m = await this.rkCargar();
    const f = m.get(viejo);
    if (!f) return;
    m.delete(viejo); this.rkSucios.add(cubo(viejo));
    if (!this.uidsPrueba.has(nuevo)) {
      const g = m.get(nuevo);
      // La cuenta ya anotada con el personaje heredado (holaCuenta) manda; si no, la fila del invitado.
      if (!g || g[1] <= f[1]) m.set(nuevo, [nombre || f[0], f[1], f[2], f[3]]);
      this.rkSucios.add(cubo(nuevo));
    }
    this.rkVer++;
  },
  // Solo los trozos que cambiaron, como mucho cada minuto (cada 10 en modo ahorro).
  async rkVolcar(forzar) {
    if (!this.rk || !this.rkSucios || !this.rkSucios.size) return;
    const ahora = Date.now();
    if (!forzar && ahora - (this.rkT || 0) < (this.degradado && this.degradado() ? 600000 : VOLCAR_MS)) return;
    this.rkT = ahora;
    const sucios = this.rkSucios; this.rkSucios = new Set();
    const trozos = new Map();
    for (const i of sucios) trozos.set(i, {});
    for (const [uid, f] of this.rk) { const t = trozos.get(cubo(uid)); if (t) t[uid] = f; }
    for (const [i, t] of trozos) {
      try {
        if (Object.keys(t).length) await this.state.storage.put(claveCubo(i), t);
        else await this.state.storage.delete(claveCubo(i));
      } catch (e) { this.rkSucios.add(i); console.error('[MMO rankTodos]', e); }
    }
  },
  // Una sola vez: siembra el indice con los personajes ya guardados (por paginas).
  async rkMigrar() {
    if (await this.state.storage.get('mig:rankTodos')) return;
    const m = await this.rkCargar();
    for (let desde; ;) {
      const o = { prefix: 'c:', limit: PAGINA_MIG };
      if (desde !== undefined) o.startAfter = desde;
      const p = await this.state.storage.list(o);
      let ultima = desde, nuevas = 0;
      for (const [k, c] of p) {
        if (desde !== undefined && k <= desde) continue;   // un storage de pruebas que no entiende startAfter
        nuevas++; if (ultima === undefined || k > ultima) ultima = k;
        if (!c || typeof c !== 'object' || c.uid !== k.slice(2) || !c.nombre) continue;
        if (this.uidsPrueba.has(c.uid) || NOMBRES_PRUEBA.has(c.nombre) || m.has(c.uid)) continue;
        m.set(c.uid, filaDe(c)); this.rkSucios.add(cubo(c.uid)); this.rkVer++;
      }
      if (!nuevas || p.size < PAGINA_MIG) break;
      desde = ultima;
    }
    await this.rkVolcar(true);
    if (!this.rkSucios.size) await this.state.storage.put('mig:rankTodos', 1);
  },
  // Lista ordenada (nivel, XP y, a igualdad, nombre) sin pruebas ni baneados.
  async rkVista() {
    const m = await this.rkCargar();
    const ahora = Date.now(), v0 = this._rkV;
    if (v0 && ahora - v0.t >= 0 && ahora - v0.t < (v0.ver === this.rkVer ? VISTA_MAX_MS : VISTA_MIN_MS)) return v0;
    const mod = await this.cargarMod();
    const ban = uid => { const b = mod.ban[uid]; return !!b && !(b.hasta && b.hasta < ahora); };
    const l = [];
    for (const [uid, f] of m) if (!this.uidsPrueba.has(uid) && !ban(uid)) l.push({ u: uid, f });
    l.sort((a, b) => b.f[1] - a.f[1] || b.f[2] - a.f[2] || (a.f[0] < b.f[0] ? -1 : a.f[0] > b.f[0] ? 1 : 0));
    const pos = new Map();
    for (let i = 0; i < l.length; i++) pos.set(l[i].u, i);
    return this._rkV = { t: ahora, ver: this.rkVer, l, pos };
  },
  rkFila(x, i, uid) {
    const o = { p: i + 1, n: x.f[0], lv: x.f[1], k: x.f[3] };
    if (x.u.startsWith('inv:')) o.inv = 1;
    if (x.u === uid) o.yo = 1;
    return o;
  },
  // Una pagina del ranking de niveles (o de una busqueda por nombre) y tu puesto.
  async rankNv(s, m) {
    if (!s || !s.c) return;
    const ahora = Date.now();
    if (ahora - (s.rkPagT || 0) < 200) return;
    s.rkPagT = ahora;
    const v = await this.rkVista();
    const q = typeof m.q === 'string' ? claveNombre(m.q.slice(0, 16)) : '';
    let d = Math.max(0, Math.floor(Number(m.d) || 0));
    const r = [];
    let n = v.l.length, mas = false;
    if (q.length >= 2) {
      n = 0;
      for (let i = 0; i < v.l.length; i++) {
        const x = v.l[i];
        if (x.c === undefined) x.c = claveNombre(x.f[0]);
        if (!x.c.includes(q)) continue;
        if (n >= d && r.length < RK_PAGINA) r.push(this.rkFila(x, i, s.c.uid));
        n++;
      }
      mas = n > d + r.length;
    } else {
      if (d > v.l.length) d = v.l.length;
      for (let i = d; i < v.l.length && r.length < RK_PAGINA; i++) r.push(this.rkFila(v.l[i], i, s.c.uid));
      mas = d + r.length < v.l.length;
    }
    const im = v.pos.get(s.c.uid);
    const mio = im === undefined ? { p: 0 } : this.rkFila(v.l[im], im, s.c.uid);
    this.enviar(s, { t: 'rankNv', d, q: q.length >= 2 ? q : '', tot: v.l.length, n, r, mas, mio });
  },
};
