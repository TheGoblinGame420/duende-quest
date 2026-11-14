// ═══════════════════════════════════════════════════════
// CHICHA WARS — la cuenta del juego de la chicha en el servidor de Duende Quest
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo). Habla por HTTP
// (POST /mmo/cw, worker.js) y no por el WebSocket: Chicha Wars no entra al
// mundo, asi que abrirlo no cierra ORIGINS ni CLASSIC y no ocupa plazas.
//
// Misma identidad que Duende Quest (Telegram, correo o invitado) y cuentas
// vinculadas (uidPrincipal). Lo que guarda, en 'cw:<uid>':
//  - est: la partida (el juego es de un jugador: manda el cliente y aqui se
//    guarda para no perderla al cambiar de aparato),
//  - abonos: lo que llega de fuera (ventas del mercado, devoluciones) hasta que
//    el cliente confirma que lo sumo (ack por id),
//  - cambio del dia (monedas → oro de Duende Quest, con tope), pase premium y
//    su codigo de pedido.
// Mercado entre jugadores ('cwm'): maiz y vasos por monedas del juego. Lo
// puesto a la venta sale de la partida guardada al publicarlo (deposito) y la
// comision se pierde. Nada se cambia por dinero real.
// Invitados: se guarda su partida, pero no cambian oro, no venden ni compran
// y no piden el pase (no tienen cuenta que lo conserve).
// ═══════════════════════════════════════════════════════
import { getEnv, verifyInitData, verifySupabaseUser } from '../api/lib.js';

export const CW = {
  oroPorMonedas: 10,      // 10 monedas de Chicha Wars = 1 oro de Duende Quest
  oroDia: 1000,           // tope diario de oro cambiado por cuenta
  comision: 0.05,         // el mercado se queda con el 5 % (sale de la economia)
  maxAnuncios: 5,         // por vendedor
  maxMercado: 300,
  precio: { maiz: [0.5, 5], vasos: [1, 40] },   // monedas por unidad (sin lavar monedas entre cuentas)
  cant: { maiz: [5, 2000], vasos: [5, 1000] },
  temporada: 't1',
  maxEst: 16000,          // bytes de la partida guardada
};

const hoyPeru = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const entero = (v, a, b) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= a && n <= b ? n : null; };

// Partida guardada: solo numeros y listas conocidas, con topes (una partida falsa no rompe nada).
function limpiarEst(e) {
  if (!e || typeof e !== 'object') return null;
  const num = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
  const o = JSON.parse(JSON.stringify(e));
  o.monedas = num(o.monedas, 1e12); o.maiz = num(o.maiz, 1e9); o.stock = num(o.stock, 1e9);
  return JSON.stringify(o).length <= CW.maxEst ? o : null;
}

export const ChichaWars = {
  // Identidad de la peticion: la misma verificacion que el 'hola' del mundo, con 10 min de memoria.
  async cwIdentidad(auth) {
    const a = auth || {};
    this._cwAuth = this._cwAuth || new Map();
    const clave = a.k + ':' + String(a.d || a.tok || '').slice(-64);
    const ya = this._cwAuth.get(clave);
    if (ya && Date.now() - ya.t < 600000) return ya;
    const env = getEnv({ env: this.env });
    let uid = null, nombre = '', extra = null;
    try {
      if (a.k === 'tg' && typeof a.d === 'string') { const u = await verifyInitData(a.d, env.BOT_TOKEN, 24 * 3600); if (u?.id) { uid = 'tg:' + u.id; nombre = u.username || u.first_name || ''; } }
      else if (a.k === 'web' && typeof a.tok === 'string') { const u = await verifySupabaseUser(env, a.tok); if (u?.id) { uid = 'web:' + u.id; nombre = (u.user_metadata && u.user_metadata.username) || ''; extra = { email: u.email || '', emailOk: !!u.email_confirmed_at }; } }
      else if (a.k === 'inv' && /^[a-f0-9]{32}$/.test(a.tok || '')) uid = 'inv:' + (await sha256hex('dq-mmo:' + a.tok)).slice(0, 24);
    } catch (e) { uid = null; }
    if (!uid) return null;
    const prin = this.uidPrincipal ? await this.uidPrincipal(uid) : uid;
    const r = { uid: prin, nombre: String(nombre).slice(0, 20), cuenta: !prin.startsWith('inv:'), dueno: this.calcularDios ? this.calcularDios({ c: { uid: prin } }, extra) === 'dueno' : false, t: Date.now() };
    if (this._cwAuth.size > 3000) this._cwAuth.clear();
    this._cwAuth.set(clave, r);
    return r;
  },

  // Ranking de la oleada mas alta (los 50 mejores). La oleada la manda el cliente: sirve para la beta, no es a prueba de trampas.
  async cwRanking(id, est) {
    const o = Math.floor(Number(est.oleada) || 0);
    if (o < 2) return;
    const l = (await this.state.storage.get('cwr')) || [];
    let e = l.find(x => x.uid === id.uid);
    if (e && e.o >= o) return;
    const nombre = (id.nombre || (id.cuenta ? 'Chichera' : 'Invitado')).slice(0, 16) + (id.cuenta ? '' : ' ' + id.uid.slice(-3));
    if (!e) { e = { uid: id.uid, n: nombre, o, t: Date.now() }; l.push(e); } else { e.o = o; e.n = nombre; e.t = Date.now(); }
    l.sort((a, b) => b.o - a.o || a.t - b.t);
    if (l.length > 50) l.length = 50;
    await this.state.storage.put('cwr', l);
  },

  async cwHttp(request) {
    // Tope por IP: 90 peticiones por minuto (guardar cada 30 s + acciones sobra).
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const min = Math.floor(Date.now() / 60000);
    this._cwIp = this._cwIp && this._cwIp.m === min ? this._cwIp : { m: min, n: new Map() };
    const n = (this._cwIp.n.get(ip) || 0) + 1; this._cwIp.n.set(ip, n);
    if (n > 90) return json({ ok: false, m: 'Demasiadas peticiones: espera un momento.' }, 429);
    let b; try { const txt = await request.text(); if (txt.length > CW.maxEst + 2000) return json({ ok: false }, 413); b = JSON.parse(txt); } catch (e) { return json({ ok: false }, 400); }
    const id = await this.cwIdentidad(b && b.auth);
    if (!id) return json({ ok: false, auth: false, m: 'No se pudo verificar tu cuenta.' }, 401);
    const clave = 'cw:' + id.uid;
    const r = (await this.state.storage.get(clave)) || { est: null, abonos: [], cambio: { d: '', oro: 0 }, premium: '', cod: '', sig: 1 };
    const guardar = () => this.state.storage.put(clave, r);
    const no = m => json({ ok: false, m });
    const resp = o => json({ ok: true, cuenta: id.cuenta, dueno: id.dueno, premium: r.premium === CW.temporada, cod: r.cod || '', abonos: r.abonos, cambio: r.cambio.d === hoyPeru() ? r.cambio.oro : 0, ...o });
    const exigirCuenta = () => (id.cuenta ? null : no('Necesitas tu cuenta de Duende Quest (Telegram o correo) para esto.'));
    const a = String(b.a || '');

    // Lo que el cliente ya sumo de los abonos se borra.
    if (Array.isArray(b.ack) && b.ack.length && r.abonos.length) r.abonos = r.abonos.filter(x => !b.ack.includes(x.id));

    if (a === 'cargar') { await guardar(); return resp({ est: r.est }); }
    if (a === 'guardar') {
      const est = limpiarEst(b.est); if (!est) return no('Partida no válida.');
      r.est = est; r.t = Date.now(); await guardar();
      await this.cwRanking(id, est);
      return resp({});
    }
    if (a === 'ranking') {
      const l = (await this.state.storage.get('cwr')) || [];
      const i = l.findIndex(x => x.uid === id.uid);
      return resp({ ranking: l.slice(0, 20).map((x, k) => ({ p: k + 1, n: x.n, o: x.o, yo: x.uid === id.uid })), mio: i >= 0 ? i + 1 : 0 });
    }
    // Las acciones de dinero del juego leen la partida que llega con la peticion (la mas nueva).
    const conEst = () => { const est = limpiarEst(b.est); if (!est) return null; r.est = est; return est; };

    if (a === 'cambiar') {
      const f = exigirCuenta(); if (f) return f;
      const est = conEst(); if (!est) return no('Partida no válida.');
      const oro = entero(b.oro, 1, CW.oroDia); if (!oro) return no('Cantidad no válida.');
      if (r.cambio.d !== hoyPeru()) r.cambio = { d: hoyPeru(), oro: 0 };
      if (r.cambio.oro + oro > CW.oroDia) return no(`Hoy puedes cambiar ${CW.oroDia - r.cambio.oro} oro más (máximo ${CW.oroDia} al día).`);
      const monedas = oro * CW.oroPorMonedas;
      if (est.monedas < monedas) return no('No te alcanzan las monedas.');
      const { s, c } = await this.pjDe(id.uid);
      if (!c) return no('Primero entra una vez a Duende Quest con esta cuenta para tener dónde recibir el oro.');
      c.oro = (c.oro || 0) + oro;
      if (s) { s.sucio = true; this.actualizarYo(s); this.enviar(s, { t: 'toast', m: `🥤 +${oro.toLocaleString('es')} oro desde Chicha Wars`, ok: true }); await this.guardar(s); }
      else await this.state.storage.put('c:' + id.uid, c);
      est.monedas -= monedas; r.cambio.oro += oro; await guardar();
      return resp({ hecho: { monedas: -monedas, oro } });
    }

    if (a === 'mercado') {
      const l = (await this.state.storage.get('cwm')) || [];
      const tipo = b.tipo === 'vasos' ? 'vasos' : 'maiz';
      return resp({ mercado: l.filter(x => x.tipo === tipo).sort((x, y) => x.precio - y.precio).slice(0, 40).map(x => ({ id: x.id, tipo: x.tipo, n: x.n, precio: x.precio, quien: x.nombre, mio: x.uid === id.uid })), mios: l.filter(x => x.uid === id.uid).map(x => ({ id: x.id, tipo: x.tipo, n: x.n, precio: x.precio })) });
    }
    if (a === 'vender') {
      const f = exigirCuenta(); if (f) return f;
      const est = conEst(); if (!est) return no('Partida no válida.');
      const tipo = b.tipo === 'vasos' ? 'vasos' : b.tipo === 'maiz' ? 'maiz' : null; if (!tipo) return no('Eso no se vende aquí.');
      const nn = entero(b.n, CW.cant[tipo][0], CW.cant[tipo][1]); if (!nn) return no(`Entre ${CW.cant[tipo][0]} y ${CW.cant[tipo][1]}.`);
      const precio = Math.round(Number(b.precio) * 10) / 10;
      if (!(precio >= CW.precio[tipo][0] && precio <= CW.precio[tipo][1])) return no(`Precio por unidad entre ${CW.precio[tipo][0]} y ${CW.precio[tipo][1]} monedas.`);
      const tengo = tipo === 'maiz' ? est.maiz : est.stock; if (tengo < nn) return no('No tienes tanto para vender.');
      const l = (await this.state.storage.get('cwm')) || [];
      if (l.filter(x => x.uid === id.uid).length >= CW.maxAnuncios) return no(`Máximo ${CW.maxAnuncios} ventas a la vez.`);
      if (l.length >= CW.maxMercado) return no('El mercado está lleno: prueba en un rato.');
      if (tipo === 'maiz') est.maiz -= nn; else est.stock -= nn;
      const an = { id: (await sha256hex(id.uid + Date.now() + Math.random())).slice(0, 10), uid: id.uid, nombre: id.nombre || 'Chichera', tipo, n: nn, precio, t: Date.now() };
      l.push(an);
      this.state.storage.put('cwm', l); await guardar();
      return resp({ hecho: { [tipo === 'maiz' ? 'maiz' : 'stock']: -nn } });
    }
    if (a === 'comprar' || a === 'retirar') {
      const f = exigirCuenta(); if (f) return f;
      const est = conEst(); if (!est) return no('Partida no válida.');
      const l = (await this.state.storage.get('cwm')) || [];
      const i = l.findIndex(x => x.id === b.id); if (i < 0) return no('Esa venta ya no está.');
      const an = l[i], campo = an.tipo === 'maiz' ? 'maiz' : 'stock';
      if (a === 'retirar') {
        if (an.uid !== id.uid) return no('Esa venta no es tuya.');
        l.splice(i, 1); est[campo] += an.n;
        this.state.storage.put('cwm', l); await guardar();
        return resp({ hecho: { [campo]: an.n } });
      }
      if (an.uid === id.uid) return no('No puedes comprarte a ti mismo.');
      const total = Math.ceil(an.n * an.precio);
      if (est.monedas < total) return no('No te alcanzan las monedas.');
      l.splice(i, 1);
      est.monedas -= total; est[campo] += an.n;
      // Al vendedor le llega como abono (lo suma su juego la proxima vez que guarde o entre).
      const kv = 'cw:' + an.uid, rv = (await this.state.storage.get(kv)) || { est: null, abonos: [], cambio: { d: '', oro: 0 }, premium: '', cod: '', sig: 1 };
      const neto = Math.floor(total * (1 - CW.comision));
      rv.abonos.push({ id: 'v' + (rv.sig = (rv.sig || 1) + 1), monedas: neto, txt: `Vendiste ${an.n} ${an.tipo === 'maiz' ? 'kg de maíz' : 'vasos'} en el mercado: +${neto} monedas` });
      if (rv.abonos.length > 50) rv.abonos.splice(0, rv.abonos.length - 50);
      this.state.storage.put(kv, rv);
      this.state.storage.put('cwm', l); await guardar();
      return resp({ hecho: { monedas: -total, [campo]: an.n } });
    }

    if (a === 'pedirPase') {
      const f = exigirCuenta(); if (f) return f;
      if (r.premium === CW.temporada) return resp({});
      if (!r.cod) {
        r.cod = 'CW-' + (await sha256hex(id.uid + ':cw')).slice(0, 6).toUpperCase();
        await this.state.storage.put('cwcod:' + r.cod, id.uid);
      }
      await guardar();
      return resp({});
    }
    // El dueño activa el pase premium cuando ya cobro (pago manual): por codigo.
    if (a === 'darPase') {
      if (!id.dueno) return no('Solo el dueño puede hacer eso.');
      const cod = String(b.cod || '').trim().toUpperCase();
      const uid = /^CW-[0-9A-F]{6}$/.test(cod) && await this.state.storage.get('cwcod:' + cod);
      if (!uid) return no('No hay un pedido con ese código.');
      const kv = 'cw:' + uid, rv = (await this.state.storage.get(kv)) || { est: null, abonos: [], cambio: { d: '', oro: 0 }, premium: '', cod, sig: 1 };
      if (rv.premium === CW.temporada) return no('Ese jugador ya tiene el pase premium.');
      rv.premium = CW.temporada;
      rv.abonos.push({ id: 'p' + (rv.sig = (rv.sig || 1) + 1), premium: 1, txt: '★ ¡Tu pase premium ya está activo! Reclama tus premios en «Pase».' });
      await this.state.storage.put(kv, rv);
      if (kv === clave) Object.assign(r, rv);
      return resp({ hecho: { ok: 'Pase premium activado para ' + cod } });
    }
    return no('Acción desconocida.');
  },
};
