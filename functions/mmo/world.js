// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — servidor del mundo (Durable Object)
//
// Un solo objeto lleva todo el mundo: con la escala actual (decenas de
// jugadores a la vez como mucho) es mas simple y barato que repartir mapas
// entre varios objetos, y los mensajes ya van filtrados por mapa por si
// algun dia hay que partirlo.
//
// Autoridad: el servidor decide vida, daño, oro, experiencia, compras y
// monstruos. El cliente solo manda intenciones (moverse, atacar, usar un
// poder). La posicion del jugador la manda el cliente (responde al instante)
// pero se valida contra la velocidad maxima posible.
// ═══════════════════════════════════════════════════════

import {
  MAPAS, MONSTRUOS, statsMonstruo, statsJugador, xpParaSubir, SKINS, ARMAS, PODERES,
  ATAQUE_CD_MS, ALCANCE_BASE, COMBO_MULT, SUELO, TICK_MS, NIVEL_MAX, FIS, limpiarNombre,
} from '../../mmo/js/data.js';
import { getEnv, verifyInitData, verifySupabaseUser, supabaseQuery } from '../api/lib.js';

const MAX_JUGADORES = 300;
const GUARDAR_CADA_MS = 20000;
const JEFE_REAPARECE_MS = 5 * 60 * 1000;
const JEFE_PRIMERO_MS = 60 * 1000;
const ESCUDO_MS = 5000;
const FUEGO_MS = 8000;
const INVULNERABLE_GOLPE_MS = 700;

async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

function personajeNuevo(uid, nombre) {
  return {
    uid, nombre, nivel: 1, xp: 0, oro: 100,
    mapa: 'pueblo', x: MAPAS.pueblo.spawn,
    arma: 'katana', armas: ['katana'],
    skin: 'comun', skins: ['comun'],
    pw: { pocion: 5, escudo: 1, rayo: 1, fuego: 1 },
    kills: 0, jefes: 0, creado: Date.now(),
  };
}

export class MmoWorld {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sesiones = new Map();          // id de sesion -> sesion
    this.porUid = new Map();            // uid -> sesion
    this.mundo = {};
    for (const id in MAPAS) this.mundo[id] = { mons: new Map(), jefeEn: 0, spawnEn: 0 };
    this.sigSesion = 1;
    this.sigMon = 1;
    this.bucle = null;
  }

  async fetch(request) {
    try { return await this._fetch(request); }
    catch (e) { console.error('[MMO fetch]', e); return new Response('Error del servidor', { status: 500 }); }
  }

  async _fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(JSON.stringify({ ok: true, online: this.contarOnline() }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (this.sesiones.size >= MAX_JUGADORES) return new Response('Servidor lleno', { status: 503 });
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    servidor.accept();
    this.abrir(servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  contarOnline() { let n = 0; for (const s of this.sesiones.values()) if (s.c) n++; return n; }

  // ── CONEXION ──
  abrir(ws) {
    const s = { id: this.sigSesion++, ws, c: null, cuenta: 0, ventana: Date.now(), cerrado: false };
    this.sesiones.set(s.id, s);
    ws.addEventListener('message', ev => {
      this.recibir(s, ev.data).catch(e => { console.error('[MMO]', e); this.enviar(s, { t: 'err', m: 'Error del servidor' }); });
    });
    const cerrar = () => this.cerrar(s);
    ws.addEventListener('close', cerrar);
    ws.addEventListener('error', cerrar);
    setTimeout(() => { if (!s.c && !s.cerrado) this.expulsar(s, 'Sin identificación'); }, 15000);
  }

  expulsar(s, motivo) {
    this.enviar(s, { t: 'err', m: motivo, fatal: true });
    try { s.ws.close(4000, 'fin'); } catch (e) {}
    this.cerrar(s);
  }

  async cerrar(s) {
    if (s.cerrado) return;
    s.cerrado = true;
    this.sesiones.delete(s.id);
    if (s.c) {
      if (this.porUid.get(s.c.uid) === s) this.porUid.delete(s.c.uid);
      this.aMapa(s.c.mapa, { t: 'pl', id: s.id }, s);
      await this.guardar(s);
    }
    if (this.contarOnline() === 0 && this.bucle) { clearInterval(this.bucle); this.bucle = null; }
  }

  enviar(s, obj) {
    if (s.cerrado) return;
    try { s.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) {}
  }

  aMapa(mapa, obj, excepto) {
    const txt = JSON.stringify(obj);
    for (const s of this.sesiones.values()) if (s.c && s.c.mapa === mapa && s !== excepto) this.enviar(s, txt);
  }

  aTodos(obj) {
    const txt = JSON.stringify(obj);
    for (const s of this.sesiones.values()) if (s.c) this.enviar(s, txt);
  }

  // ── MENSAJES ──
  async recibir(s, data) {
    if (s.cerrado) return;
    const ahora = Date.now();
    if (ahora - s.ventana > 1000) { s.ventana = ahora; s.cuenta = 0; }
    if (++s.cuenta > 60) { if (s.cuenta > 200) this.expulsar(s, 'Demasiados mensajes'); return; }
    if (typeof data !== 'string' || data.length > 4000) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hola') return this.hola(s, m);
    if (!s.c) return;
    switch (m.t) {
      case 'mv': return this.mover(s, m);
      case 'atk': return this.atacar(s, m);
      case 'pw': return this.poder(s, m);
      case 'portal': return this.portal(s, m);
      case 'chat': return this.chat(s, m);
      case 'comprar': return this.comprar(s, m);
      case 'equipar': return this.equipar(s, m);
      case 'revivir': return this.revivir(s);
      case 'ranking': return this.enviarRanking(s);
      case 'ping': return this.enviar(s, { t: 'pong', ts: m.ts });
    }
  }

  // ── IDENTIDAD ──
  async hola(s, m) {
    if (s.c || s.autenticando) return;
    s.autenticando = true;
    const env = getEnv({ env: this.env });
    const a = m.auth || {};
    let uid = null, nombre = null, pagadas = null;
    try {
      if (a.k === 'tg' && typeof a.d === 'string') {
        const u = await verifyInitData(a.d, env.BOT_TOKEN);
        if (u?.id) {
          uid = 'tg:' + u.id;
          nombre = limpiarNombre(u.username || u.first_name) || 'Duende' + String(u.id).slice(-4);
          pagadas = { tgId: String(u.id) };
        }
      } else if (a.k === 'web' && typeof a.tok === 'string') {
        const u = await verifySupabaseUser(env, a.tok);
        if (u?.id) {
          uid = 'web:' + u.id;
          nombre = limpiarNombre(u.user_metadata && u.user_metadata.username) || 'Duende' + u.id.slice(0, 4);
          pagadas = { webId: u.id };
        }
      } else if (a.k === 'inv' && /^[a-f0-9]{32}$/.test(a.tok || '')) {
        uid = 'inv:' + (await sha256hex('dq-mmo:' + a.tok)).slice(0, 24);
        nombre = limpiarNombre(m.nombre) || 'Duende' + Math.floor(1000 + Math.random() * 9000);
      }
    } catch (e) { uid = null; }
    if (!uid) { s.autenticando = false; return this.expulsar(s, 'No se pudo verificar tu identidad. Vuelve a abrir el juego.'); }
    if (s.cerrado) return;

    // Misma cuenta abierta en otra pestaña: la vieja se cierra.
    const vieja = this.porUid.get(uid);
    if (vieja && vieja !== s) { await this.guardar(vieja); this.expulsar(vieja, 'Tu cuenta se abrió en otro dispositivo'); }

    let c = await this.state.storage.get('c:' + uid);
    const nuevo = !c;
    if (!c) c = personajeNuevo(uid, nombre);
    c.skins = c.skins || ['comun']; c.armas = c.armas || ['katana']; c.pw = c.pw || {};
    for (const p of PODERES) if (typeof c.pw[p.id] !== 'number') c.pw[p.id] = 0;
    if (!MAPAS[c.mapa]) c.mapa = 'pueblo';

    // Skins pagadas con dinero real en el juego principal: se regalan aqui.
    const extra = pagadas ? await this.skinsPagadas(env, pagadas) : [];
    const regaladas = extra.filter(k => typeof k === 'string' && Object.hasOwn(SKINS, k) && !c.skins.includes(k));
    c.skins.push(...regaladas);

    s.c = c;
    s.st = statsJugador(c.nivel, c.skin);
    s.hp = s.st.maxHp;
    s.muerto = false;
    s.x = clamp(c.x || 200, 20, MAPAS[c.mapa].ancho - 20);
    s.y = SUELO; s.f = 1; s.a = 0;
    s.movT = Date.now(); s.atkT = 0; s.chatT = 0; s.cdPw = {}; s.inv = 0; s.escudo = 0; s.fuego = 0; s.auraT = 0;
    s.sucio = true; s.guardadoT = Date.now();
    this.porUid.set(uid, s);
    if (nuevo) await this.guardar(s);

    this.enviar(s, { t: 'bienvenido', id: s.id, yo: this.datosPropios(s), nuevo, regaladas });
    this.entrarMapa(s, c.mapa, s.x, true);
    if (!this.bucle) this.bucle = setInterval(() => this.tick(), TICK_MS);
  }

  async skinsPagadas(env, p) {
    if (!env.HAS_SERVICE_KEY) return [];
    try {
      if (p.tgId) {
        const d = await supabaseQuery(env, `skin_purchases?telegram_id=eq.${encodeURIComponent(p.tgId)}&select=skin_id`);
        return Array.isArray(d) ? d.map(r => r.skin_id) : [];
      }
      if (p.webId) {
        const prof = await supabaseQuery(env, `profiles?id=eq.${encodeURIComponent(p.webId)}&select=wallet_solana&limit=1`);
        const w = Array.isArray(prof) && prof[0] && prof[0].wallet_solana;
        if (!w) return [];
        const d = await supabaseQuery(env, `skin_purchases?wallet_address=eq.${encodeURIComponent(w)}&select=skin_id`);
        return Array.isArray(d) ? d.map(r => r.skin_id) : [];
      }
    } catch (e) {}
    return [];
  }

  datosPropios(s) {
    const c = s.c;
    return {
      nombre: c.nombre, nivel: c.nivel, xp: c.xp, xpSig: xpParaSubir(c.nivel), oro: c.oro,
      hp: Math.ceil(s.hp), maxHp: s.st.maxHp, atk: s.st.atk, def: s.st.def,
      arma: c.arma, armas: c.armas, skin: c.skin, skins: c.skins, pw: c.pw,
      kills: c.kills, jefes: c.jefes, muerto: s.muerto,
    };
  }
  actualizarYo(s) { this.enviar(s, { t: 'yo', yo: this.datosPropios(s) }); }

  infoJugador(s) {
    return { id: s.id, n: s.c.nombre, lv: s.c.nivel, sk: s.c.skin, ar: s.c.arma, x: Math.round(s.x), y: Math.round(s.y), f: s.f, hp: Math.ceil(s.hp), mx: s.st.maxHp, muerto: s.muerto };
  }

  infoMonstruo(m) {
    return { id: m.id, k: m.k, x: Math.round(m.x), y: Math.round(m.y), f: m.f, hp: Math.ceil(m.hp), mx: m.max, st: this.codigoEstado(m) };
  }

  codigoEstado(m) {
    if (m.muere) return 2;
    if (m.embiste) return 4;
    if (m.aviso) return 3;
    if (Date.now() < m.golpeHasta) return 1;
    return 0;
  }

  // ── MAPAS ──
  entrarMapa(s, mapaId, x, primeraVez) {
    const antes = s.c.mapa;
    if (!primeraVez) this.aMapa(antes, { t: 'pl', id: s.id }, s);
    s.c.mapa = mapaId;
    s.x = clamp(x, 20, MAPAS[mapaId].ancho - 20);
    s.y = SUELO;
    s.movT = Date.now();
    s.sucio = true;
    const w = this.mundo[mapaId];
    if (MAPAS[mapaId].jefe && !w.jefeEn) w.jefeEn = Date.now() + JEFE_PRIMERO_MS;
    const jugadores = [];
    for (const o of this.sesiones.values()) if (o.c && o !== s && o.c.mapa === mapaId) jugadores.push(this.infoJugador(o));
    this.enviar(s, { t: 'mapa', mapa: mapaId, x: Math.round(s.x), jugadores, mons: [...w.mons.values()].map(m => this.infoMonstruo(m)) });
    this.aMapa(mapaId, { t: 'pj', p: this.infoJugador(s) }, s);
  }

  portal(s, m) {
    if (s.muerto) return;
    const mapa = MAPAS[s.c.mapa];
    const p = mapa.portales[m.i | 0];
    if (!p || Math.abs(s.x - p.x) > 90) return;
    this.entrarMapa(s, p.a, p.ax);
    this.guardar(s);
  }

  // ── MOVIMIENTO ──
  mover(s, m) {
    if (s.muerto) return;
    const x = num(m.x), y = num(m.y);
    if (x === null || y === null) return;
    const ahora = Date.now();
    const dt = Math.max(16, ahora - s.movT);
    // Maximo posible: correr + un dash entero + margen por latencia.
    const maxDx = (FIS.vel * 60 * dt / 1000) + FIS.dashVel * FIS.dashT + 60;
    const ancho = MAPAS[s.c.mapa].ancho;
    if (Math.abs(x - s.x) > maxDx * 1.25) {
      this.enviar(s, { t: 'snap', x: Math.round(s.x), y: Math.round(s.y) });
      s.movT = ahora;
      return;
    }
    s.x = clamp(x, 10, ancho - 10);
    s.y = clamp(y, 40, SUELO);
    s.f = m.f === -1 ? -1 : 1;
    s.a = clamp(m.a | 0, 0, 6);
    s.movT = ahora;
    s.c.x = Math.round(s.x);
  }

  // ── COMBATE ──
  atacar(s, m) {
    if (s.muerto) return;
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
    const w = this.mundo[s.c.mapa];
    const golpes = [];
    const maxObjetivos = s.c.arma === 'odachi' ? 6 : 4;
    const lista = [...w.mons.values()]
      .filter(o => !o.muere && o.x + o.w / 2 > x0 && o.x - o.w / 2 < x1 && o.y > y0 && o.y - o.h < y1)
      .sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))
      .slice(0, maxObjetivos);
    let curado = 0;
    for (const o of lista) {
      const crit = Math.random() < 0.12;
      let dmg = s.st.atk * arma.dano * COMBO_MULT[paso] * rnd(0.9, 1.1) * (crit ? 1.8 : 1) * (ahora < s.fuego ? 1.5 : 1);
      dmg = Math.max(1, Math.round(dmg));
      golpes.push([o.id, dmg, crit ? 1 : 0]);
      curado += dmg;
      this.danar(o, dmg, s);
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
        const dmg = Math.max(1, Math.round(s.st.atk * 0.5 * COMBO_MULT[paso]));
        golpes.push([otro.id, dmg, 2]);
        this.danar(otro, dmg, s);
      }
    }
    const robo = (SKINS[s.c.skin].buffs || {}).robo || 0;
    if (robo && curado) { s.hp = Math.min(s.st.maxHp, s.hp + curado * robo); }
    this.aMapa(s.c.mapa, { t: 'at', p: s.id, s: paso, f: s.f, h: golpes });
  }

  danar(o, dmg, s) {
    if (o.muere) return;
    o.hp -= dmg;
    o.golpeHasta = Date.now() + 280;
    if (s) {
      o.dano.set(s.id, (o.dano.get(s.id) || 0) + dmg);
      o.obj = s.id;
      if (!o.jefe) o.x = clamp(o.x + (o.x > s.x ? 7 : -7), 20, MAPAS[o.mapa].ancho - 20);
    }
    if (o.hp <= 0) this.matar(o);
  }

  matar(o) {
    o.muere = true;
    o.hp = 0;
    o.borrarEn = Date.now() + 1600;
    const base = statsMonstruo(o.k);
    const total = [...o.dano.values()].reduce((a, b) => a + b, 0) || 1;
    const premios = [];
    for (const [sid, d] of o.dano) {
      const s = this.sesiones.get(sid);
      if (!s || !s.c || s.c.mapa !== o.mapa || s.muerto) continue;
      const parte = d / total;
      const mult = ((SKINS[s.c.skin].buffs || {}).oroMult) || 1;
      // En jefes cada participante se lleva al menos un tercio: pelear en grupo compensa.
      const k = o.jefe ? Math.max(parte, 1 / 3) : parte;
      const xp = Math.max(1, Math.round(base.xp * k));
      const oro = Math.max(1, Math.round(base.oro * k * rnd(0.8, 1.2) * mult));
      premios.push([sid, xp, oro]);
      this.dar(s, xp, oro, o);
    }
    this.aMapa(o.mapa, { t: 'md', id: o.id, pr: premios });
    if (o.jefe) {
      this.mundo[o.mapa].jefeEn = Date.now() + JEFE_REAPARECE_MS;
      const quien = premios.map(p => this.sesiones.get(p[0])?.c?.nombre).filter(Boolean).slice(0, 4).join(', ');
      this.aTodos({ t: 'aviso', m: `⚔️ ${MONSTRUOS[o.k].nombre} fue derrotado${quien ? ' por ' + quien : ''}` });
    }
  }

  dar(s, xp, oro, o) {
    const c = s.c;
    c.oro += oro;
    c.kills++;
    if (o && o.jefe) c.jefes++;
    let subio = false;
    if (c.nivel < NIVEL_MAX) {
      c.xp += xp;
      while (c.nivel < NIVEL_MAX && c.xp >= xpParaSubir(c.nivel)) {
        c.xp -= xpParaSubir(c.nivel);
        c.nivel++;
        subio = true;
      }
      if (c.nivel >= NIVEL_MAX) c.xp = 0;
    }
    // Drops: pociones y, en jefes, poderes raros.
    const drops = [];
    if (Math.random() < 0.05) { c.pw.pocion = Math.min(99, c.pw.pocion + 1); drops.push('pocion'); }
    if (o && o.jefe) {
      const r = PODERES[1 + Math.floor(Math.random() * 3)].id;
      c.pw[r] = Math.min(99, c.pw[r] + 1); drops.push(r);
    }
    if (subio) {
      s.st = statsJugador(c.nivel, c.skin);
      s.hp = s.st.maxHp;
      this.aMapa(c.mapa, { t: 'lv', p: s.id, lv: c.nivel });
      this.actualizarRanking(s);
      this.guardar(s);
    }
    s.sucio = true;
    this.enviar(s, { t: 'gana', xp, oro, drops, x: Math.round(o ? o.x : s.x), y: Math.round(o ? o.y - o.h : s.y - 60) });
    this.actualizarYo(s);
  }

  herir(s, dmg, fuente) {
    if (s.muerto) return;
    const ahora = Date.now();
    if (ahora < s.inv || ahora < s.escudo) return;
    const real = Math.max(1, Math.round(dmg * rnd(0.9, 1.1) - s.st.def * 0.5));
    s.hp -= real;
    s.inv = ahora + INVULNERABLE_GOLPE_MS;
    this.aMapa(s.c.mapa, { t: 'ph', p: s.id, d: real, from: fuente ? fuente.id : 0 });
    if (s.hp <= 0) {
      s.hp = 0;
      s.muerto = true;
      this.aMapa(s.c.mapa, { t: 'pm', p: s.id });
    }
    this.actualizarYo(s);
  }

  revivir(s) {
    if (!s.muerto) return;
    const c = s.c;
    // Castigo suave: se pierde el 5% de la experiencia del nivel actual.
    c.xp = Math.max(0, c.xp - Math.round(xpParaSubir(c.nivel) * 0.05));
    s.muerto = false;
    s.hp = s.st.maxHp;
    s.inv = Date.now() + 2000;
    this.entrarMapa(s, 'pueblo', MAPAS.pueblo.spawn);
    this.actualizarYo(s);
    this.guardar(s);
  }

  // ── PODERES ──
  poder(s, m) {
    if (s.muerto) return;
    const def = PODERES[m.i | 0];
    if (!def) return;
    const ahora = Date.now();
    if ((s.c.pw[def.id] || 0) <= 0) return this.enviar(s, { t: 'toast', m: `No te quedan ${def.nombre}s. Cómpralos al Mercader del pueblo.` });
    if (ahora < (s.cdPw[def.id] || 0)) return;
    s.c.pw[def.id]--;
    s.cdPw[def.id] = ahora + def.cd;
    if (def.id === 'pocion') s.hp = Math.min(s.st.maxHp, s.hp + s.st.maxHp * 0.5);
    if (def.id === 'escudo') s.escudo = ahora + ESCUDO_MS;
    if (def.id === 'fuego') s.fuego = ahora + FUEGO_MS;
    if (def.id === 'rayo') {
      const golpes = [];
      for (const o of this.mundo[s.c.mapa].mons.values()) {
        if (o.muere || Math.abs(o.x - s.x) > 450) continue;
        const dmg = Math.round(s.st.atk * (o.jefe ? 2 : 4));
        golpes.push([o.id, dmg, 2]);
        this.danar(o, dmg, s);
      }
      this.aMapa(s.c.mapa, { t: 'at', p: s.id, s: -1, f: s.f, h: golpes });
    }
    s.sucio = true;
    this.aMapa(s.c.mapa, { t: 'pw', p: s.id, i: m.i | 0 });
    this.enviar(s, { t: 'cd', id: def.id, hasta: def.cd });
    this.actualizarYo(s);
  }

  // ── CHAT ──
  chat(s, m) {
    const ahora = Date.now();
    if (ahora - s.chatT < 900) return;
    const txt = String(m.m || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
    if (!txt) return;
    s.chatT = ahora;
    this.aMapa(s.c.mapa, { t: 'chat', p: s.id, n: s.c.nombre, m: txt });
  }

  // ── TIENDA ──
  cercaDelMercader(s) {
    if (s.c.mapa !== 'pueblo') return false;
    const npc = MAPAS.pueblo.npcs.find(n => n.tipo === 'tienda');
    return npc && Math.abs(s.x - npc.x) < 200;
  }

  comprar(s, m) {
    const c = s.c;
    if (!this.cercaDelMercader(s)) return this.enviar(s, { t: 'toast', m: 'Tienes que estar junto al Mercader del pueblo.' });
    if (m.k === 'pw') {
      const def = PODERES.find(p => p.id === m.id);
      const n = clamp(m.n | 0, 1, 10);
      if (!def) return;
      const costo = def.precio * n;
      if (c.oro < costo) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      if ((c.pw[def.id] || 0) + n > 99) return this.enviar(s, { t: 'toast', m: 'Máximo 99 por poder.' });
      c.oro -= costo; c.pw[def.id] = (c.pw[def.id] || 0) + n;
    } else if (m.k === 'arma' || m.k === 'skin') {
      const tabla = m.k === 'arma' ? ARMAS : SKINS;
      const lista = m.k === 'arma' ? c.armas : c.skins;
      // hasOwn y no tabla[id]: '__proto__' o 'constructor' existen en cualquier
      // objeto y dejaban el oro en NaN al "comprarlos".
      if (typeof m.id !== 'string' || !Object.hasOwn(tabla, m.id)) return;
      const def = tabla[m.id];
      if (lista.includes(m.id)) return this.enviar(s, { t: 'toast', m: 'Ya lo tienes.' });
      if (c.oro < def.precio) return this.enviar(s, { t: 'toast', m: 'No te alcanza el oro.' });
      c.oro -= def.precio;
      lista.push(m.id);
      this.equipar(s, { k: m.k, id: m.id });
    } else return;
    this.enviar(s, { t: 'toast', m: '✅ Compra realizada', ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  }

  equipar(s, m) {
    const c = s.c;
    if (typeof m.id !== 'string') return;
    if (m.k === 'arma' && c.armas.includes(m.id) && Object.hasOwn(ARMAS, m.id)) c.arma = m.id;
    else if (m.k === 'skin' && c.skins.includes(m.id) && Object.hasOwn(SKINS, m.id)) {
      c.skin = m.id;
      const pct = s.hp / s.st.maxHp;
      s.st = statsJugador(c.nivel, c.skin);
      s.hp = Math.max(1, Math.round(s.st.maxHp * pct));
    } else return;
    s.sucio = true;
    this.aMapa(c.mapa, { t: 'pa', p: s.id, sk: c.skin, ar: c.arma, mx: s.st.maxHp });
    this.actualizarYo(s);
  }

  // ── RANKING ──
  async actualizarRanking(s) {
    const r = (await this.state.storage.get('ranking')) || [];
    const i = r.findIndex(x => x.uid === s.c.uid);
    const fila = { uid: s.c.uid, n: s.c.nombre, lv: s.c.nivel, xp: s.c.xp, k: s.c.kills };
    if (i >= 0) r[i] = fila; else r.push(fila);
    r.sort((a, b) => b.lv - a.lv || b.xp - a.xp);
    await this.state.storage.put('ranking', r.slice(0, 50));
  }

  async enviarRanking(s) {
    const r = (await this.state.storage.get('ranking')) || [];
    this.enviar(s, { t: 'ranking', r: r.slice(0, 20).map(x => ({ n: x.n, lv: x.lv, k: x.k, yo: x.uid === s.c.uid })) });
  }

  // ── GUARDADO ──
  async guardar(s) {
    if (!s.c) return;
    s.c.x = Math.round(s.x || s.c.x || 0);
    s.guardadoT = Date.now();
    s.sucio = false;
    try { await this.state.storage.put('c:' + s.c.uid, s.c); } catch (e) { console.error('[MMO guardar]', e); }
  }

  // ── SIMULACION ──
  tick() {
    const ahora = Date.now();
    const porMapa = {};
    for (const s of this.sesiones.values()) {
      if (!s.c) continue;
      (porMapa[s.c.mapa] = porMapa[s.c.mapa] || []).push(s);
      if (s.sucio && ahora - s.guardadoT > GUARDAR_CADA_MS) this.guardar(s);
    }
    for (const mapaId in porMapa) this.simularMapa(mapaId, porMapa[mapaId], ahora);
  }

  simularMapa(mapaId, jugadores, ahora) {
    const mapa = MAPAS[mapaId];
    const w = this.mundo[mapaId];
    const dt = TICK_MS / 1000;

    if (mapa.zona) {
      // Reponer monstruos poco a poco (no todos de golpe).
      const vivos = [...w.mons.values()].filter(m => !m.jefe).length;
      if (vivos < mapa.max && ahora >= w.spawnEn) {
        this.crearMonstruo(mapaId, mapa.monstruos[Math.floor(Math.random() * mapa.monstruos.length)]);
        w.spawnEn = ahora + (vivos < mapa.max / 2 ? 700 : 2500);
      }
      if (mapa.jefe && w.jefeEn && ahora >= w.jefeEn && ![...w.mons.values()].some(m => m.jefe)) {
        w.jefeEn = 0;
        const j = this.crearMonstruo(mapaId, mapa.jefe, mapa.ancho * 0.62);
        this.aTodos({ t: 'aviso', m: `👑 ¡${MONSTRUOS[j.k].nombre} apareció en ${mapa.nombre}!` });
      }
    }

    // Aura de la skin legendaria: quema lo que esta pegado al jugador.
    for (const s of jugadores) {
      if (s.muerto || !(SKINS[s.c.skin].buffs || {}).aura || ahora < s.auraT) continue;
      s.auraT = ahora + 1000;
      const golpes = [];
      for (const o of w.mons.values()) {
        if (o.muere || Math.abs(o.x - s.x) > 75 || Math.abs((o.y - o.h / 2) - (s.y - 30)) > 80) continue;
        const dmg = Math.max(1, Math.round(s.st.atk * 0.3));
        golpes.push([o.id, dmg, 3]);
        this.danar(o, dmg, s);
      }
      if (golpes.length) this.aMapa(mapaId, { t: 'at', p: s.id, s: -2, f: s.f, h: golpes });
    }

    for (const o of [...w.mons.values()]) {
      if (o.muere) { if (ahora >= o.borrarEn) w.mons.delete(o.id); continue; }
      this.pensar(o, jugadores, ahora, dt, mapa);
    }

    const snap = {
      t: 's',
      p: jugadores.map(s => [s.id, Math.round(s.x), Math.round(s.y), s.f, s.a, Math.ceil(s.hp), s.st.maxHp, (ahora < s.escudo ? 1 : 0) | (ahora < s.fuego ? 2 : 0) | (s.muerto ? 4 : 0)]),
      m: [...w.mons.values()].map(o => [o.id, Math.round(o.x), Math.round(o.y), o.f, this.codigoEstado(o), Math.max(0, Math.ceil(o.hp))]),
    };
    const txt = JSON.stringify(snap);
    for (const s of jugadores) this.enviar(s, txt);
  }

  crearMonstruo(mapaId, k, xFija) {
    const mapa = MAPAS[mapaId];
    const st = statsMonstruo(k);
    const def = MONSTRUOS[k];
    const x = xFija || rnd(260, mapa.ancho - 260);
    const alturaVuelo = def.vuela ? rnd(90, 170) : 0;
    const o = {
      id: this.sigMon++, k, mapa: mapaId, jefe: !!def.jefe, vuela: !!def.vuela,
      x, y: SUELO - alturaVuelo, baseY: SUELO - alturaVuelo, f: Math.random() < 0.5 ? 1 : -1,
      hp: st.hp, max: st.hp, atk: st.atk, vel: st.vel, w: st.w, h: st.h,
      dano: new Map(), obj: 0, golpeHasta: 0, ataqueEn: 0, pasoEn: 0, dir: 0,
      aviso: false, embiste: false, faseEn: Date.now() + 4000, fase: 0,
    };
    this.mundo[mapaId].mons.set(o.id, o);
    this.aMapa(mapaId, { t: 'ms', m: this.infoMonstruo(o) });
    return o;
  }

  pensar(o, jugadores, ahora, dt, mapa) {
    // Objetivo: quien le pego (si sigue cerca) o el jugador vivo mas cercano
    // dentro del radio de agresion.
    let obj = null;
    const radio = o.jefe ? 700 : (o.obj ? 420 : 170);
    let mejor = radio;
    for (const s of jugadores) {
      if (s.muerto) continue;
      const d = Math.abs(s.x - o.x);
      const bonus = s.id === o.obj ? -120 : 0;
      if (d + bonus < mejor) { mejor = d + bonus; obj = s; }
    }
    if (!obj) o.obj = 0;

    const golpeado = ahora < o.golpeHasta;
    let vx = 0;
    if (o.jefe && obj) {
      // Jefe: persigue, y cada pocos segundos avisa y embiste.
      if (o.aviso) {
        if (ahora >= o.faseEn) { o.aviso = false; o.embiste = true; o.faseEn = ahora + 750; o.f = obj.x > o.x ? 1 : -1; }
      } else if (o.embiste) {
        vx = o.f * 9 * 60 * dt;
        if (ahora >= o.faseEn) { o.embiste = false; o.faseEn = ahora + rnd(3500, 5500); }
      } else {
        if (ahora >= o.faseEn) { o.aviso = true; o.faseEn = ahora + 900; }
        else if (Math.abs(obj.x - o.x) > 30) { o.f = obj.x > o.x ? 1 : -1; vx = o.f * o.vel * 60 * dt; }
      }
    } else if (obj && !golpeado) {
      if (Math.abs(obj.x - o.x) > 20) { o.f = obj.x > o.x ? 1 : -1; vx = o.f * o.vel * 1.35 * 60 * dt; }
    } else if (!golpeado) {
      // Pasear: tramos cortos a un lado y pausas.
      if (ahora >= o.pasoEn) { o.dir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); o.pasoEn = ahora + rnd(1200, 3200); }
      if (o.dir) { o.f = o.dir; vx = o.dir * o.vel * 0.6 * 60 * dt; }
    }
    o.x = clamp(o.x + vx, 30, mapa.ancho - 30);
    if (o.x <= 30 || o.x >= mapa.ancho - 30) o.dir = -o.dir;
    if (o.vuela) {
      const objetivoY = obj ? clamp(obj.y - 30, SUELO - 200, SUELO - 20) : o.baseY;
      o.y += (objetivoY + Math.sin(ahora / 400 + o.id) * 14 - o.y) * 0.08;
    }

    // Daño por contacto.
    if (ahora >= o.ataqueEn) {
      for (const s of jugadores) {
        if (s.muerto) continue;
        const toca = Math.abs(s.x - o.x) < (o.w / 2 + FIS.jugW / 2 - 4) && s.y > o.y - o.h && s.y - FIS.jugH < o.y;
        if (toca) {
          this.herir(s, o.embiste ? o.atk * 1.6 : o.atk, o);
          o.ataqueEn = ahora + (o.jefe ? 700 : 1100);
          break;
        }
      }
    }
  }
}
