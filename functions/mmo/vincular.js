// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — vincular cuentas (Telegram + correo = un duende)
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Un personaje vive en 'c:<uid principal>'. Otra cuenta (de otro tipo) puede
// apuntar a el con un alias 'al:<uid secundario>' -> uid principal: entres por
// Telegram o con tu correo, juegas con el mismo duende en CLASSIC y ORIGINS.
//
// Como se vincula (sin tocar el bot ni Supabase): en la cuenta A se pide un
// codigo (6 letras, 10 minutos, solo en memoria); en la cuenta B se escribe.
// Si B ya tenia un personaje con progreso (nivel > 5) hay que confirmarlo: se
// ARCHIVA en 'arch:<uid>' (no se borra; el dueño puede recuperarlo) y B pasa
// a jugar con el duende de A.
// Llevar mi duende: un invitado tambien pide codigo (v.inv). Se escribe en una
// cuenta de Telegram o correo sin progreso (Nv 5 o menos, sin compras); esa
// cuenta vuelve a entrar con hola.vcod y hereda al invitado con la misma herencia
// atomica de world.js (holaCuenta). El token del invitado nunca sale del aparato.
// c.vinc = { tg: 'tg:<id>', web: 'web:<id>' } (las cuentas secundarias).
// ═══════════════════════════════════════════════════════
import { claveNombre, esqueleto } from './dios.js';

const VINC_MS = 10 * 60 * 1000;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tipoUid = uid => String(uid).split(':')[0];
const NOMBRE_TIPO = { tg: 'Telegram', web: 'correo' };

export const Vincular = {
  // Alias -> uid principal (lo usa hola() antes de cargar el personaje).
  async uidPrincipal(uid) {
    const al = await this.state.storage.get('al:' + uid);
    return typeof al === 'string' ? al : uid;
  },
  infoVinc(s) {
    const c = s.c, v = c.vinc || {}, prin = tipoUid(c.uid);
    const l = {};
    for (const k of ['tg', 'web']) l[k] = prin === k || !!v[k];
    return { t: 'vincInfo', l, principal: prin, por: tipoUid(s.uidAuth || c.uid) };
  },

  // Llevar mi duende (hola de una cuenta con vcod): devuelve el uid del invitado
  // a heredar, o '' si el codigo no vale. Archiva el duende vacio de la cuenta y
  // saca al invitado si esta conectado (guardandolo antes).
  async tomarCodigoInv(s, uid, c, cod) {
    cod = String(cod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const v = this.vincs && this.vincs.get(cod);
    if (!v || !v.inv || v.para !== uid || v.exp < Date.now() || (this.entrando && this.entrando.has(v.uid))) return '';
    if (c && ((c.nivel || 1) > 5 || c.compro || Object.keys(c.vinc || {}).length)) return '';
    // Un invitado baneado no hereda (holaCuenta lo rechazaria): antes de archivar nada de la cuenta.
    if (await this.baneado(v.uid)) return '';
    this.vincs.delete(cod);
    await this.soltarInvitado(v.uid, 'Tu duende pasó a tu cuenta de ' + (NOMBRE_TIPO[tipoUid(uid)] || 'juego') + '. Entra con ella para seguir jugando.');
    if (!(await this.state.storage.get('c:' + v.uid))) return '';
    if (c) {
      if (c.nivel > 1 || c.oro > 0) await this.state.storage.put('arch:' + uid, { ...c, archivado: Date.now(), por: v.uid });
      await this.state.storage.delete('c:' + uid);
      for (const kn of ['n:' + claveNombre(c.nombre), 'ne:' + esqueleto(c.nombre)]) if ((await this.state.storage.get(kn)) === uid) await this.state.storage.delete(kn);
    }
    console.log('[MMO llevar]', v.uid, '->', uid);
    return v.uid;
  },
  // El invitado esta jugando en otra pestaña o aparato: se guarda y se le saca
  // (antes la herencia fallaba en silencio y la cuenta empezaba de cero).
  async soltarInvitado(uidInv, motivo) {
    const g = this.porUid.get(uidInv);
    if (!g || !g.c) return;
    g.diferirT = 0; g.sucio = true;
    this.caidaPorDesconexion(g);
    await this.guardar(g);
    g.noGuardar = true;
    this.expulsar(g, motivo, { dup: 1 });
  },
  // Rankings que apuntan al uid viejo pasan al nuevo (herencia de invitado).
  async migrarUid(viejo, nuevo, nombre) {
    const mover = l => {
      if (!l || !Object.hasOwn(l, viejo)) return false;
      // Las ligas (rankSemPrem) guardan [liga, puesto, tramo]: un array se mueve tal cual (spread lo volvia objeto).
      l[nuevo] = Array.isArray(l[viejo]) ? l[viejo] : { ...l[viejo], ...('n' in l[viejo] ? { n: nombre } : {}) };
      delete l[viejo];
      return true;
    };
    try {
      const r = await this.rankingLeer();
      const fila = r.find(x => x.uid === viejo);
      if (fila) { fila.uid = nuevo; fila.n = nombre; await this.state.storage.put('ranking', r); }   // la herencia se guarda al momento
      if (this.rs && mover(this.rs.l)) this.rsSucio = true;
      if (this.rds && mover(this.rds.l)) await this.state.storage.put('rankDesSem', this.rds);
      if (this.rcs && mover(this.rcs.l)) { this.rcs.l[nuevo].uid = nuevo; await this.state.storage.put('rankCuevaSem', this.rcs); }
      // Premio de liga de la semana pasada aun sin cobrar: si no, se perdia al vincular la cuenta.
      if (this.rsp && mover(this.rsp.l)) await this.state.storage.put('rankSemPrem', this.rsp);
      if (this.cargarRankTorre) { const rt = await this.cargarRankTorre(); if (rt && mover(rt.l)) await this.state.storage.put('rankTorre', rt); }
    } catch (e) { console.error('[MMO migrarUid]', e); }
  },

  async vincular(s, m) {
    const c = s.c;
    if (!c) return;
    const yoAuth = s.uidAuth || c.uid;
    switch (m.t) {
      case 'vincInfo': return this.enviar(s, this.infoVinc(s));
      case 'vincCodigo': {
        this.vincs = this.vincs || new Map();
        if (c.uid.startsWith('inv:')) {
          // Si ya tiene uno vigente se repite (sin otra escritura): pedir codigos no gasta el cupo.
          for (const [k, x] of this.vincs) if (x.exp < Date.now()) this.vincs.delete(k);
          let cod = [...this.vincs].find(([, x]) => x.uid === c.uid);
          if (!cod) {
            // Se guarda ya (aunque sea Nv 1 recien creado): la otra cuenta lo lee del storage.
            s.diferirT = 0; s.sucio = true; await this.guardar(s);
            if (s.cerrado) return;
            let k;
            do { k = Array.from({ length: 6 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); } while (this.vincs.has(k));
            cod = [k, { uid: c.uid, exp: Date.now() + VINC_MS, nombre: c.nombre, nivel: c.nivel || 1, inv: true }];
            this.vincs.set(cod[0], cod[1]);
          }
          return this.enviar(s, { t: 'vincCod', cod: cod[0], ms: Math.max(0, cod[1].exp - Date.now()), inv: true });
        }
        for (const [k, x] of this.vincs) if (x.uid === c.uid || x.exp < Date.now()) this.vincs.delete(k);
        let cod;
        do { cod = Array.from({ length: 6 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); } while (this.vincs.has(cod));
        this.vincs.set(cod, { uid: c.uid, exp: Date.now() + VINC_MS, nombre: c.nombre });
        return this.enviar(s, { ...this.infoVinc(s), t: 'vincCod', cod, ms: VINC_MS });
      }
      case 'vincUsar': {
        if (yoAuth.startsWith('inv:')) return this.no(s, 'Ese código se escribe en tu cuenta de Telegram o de correo, no aquí.');
        if (s.uidAuth && s.uidAuth !== c.uid) return this.no(s, 'Esta cuenta ya está vinculada a un duende.');
        const cod = String(m.cod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        // Contra la fuerza bruta: 5 fallos por cuenta y 20 por conexion cada 10 min.
        // Los 60 de todo el servidor solo frenan codigos que no existen: antes 12
        // cuentas llenaban ese tope y nadie podia vincular aunque su codigo fuera bueno.
        // (Cada fallo cuenta igual para su cuenta: el tope global no da intentos gratis.)
        const ahoraV = Date.now();
        const demasiados = 'Demasiados intentos con códigos que no existen. Espera unos minutos.';
        this.vincFallos = (this.vincFallos || []).filter(x => ahoraV - x.t < VINC_MS);
        if (this.vincFallos.filter(x => x.u === yoAuth).length >= 5 || (s.ip && this.vincFallos.filter(x => x.ip === s.ip).length >= 20)) return this.no(s, demasiados);
        const v = this.vincs && this.vincs.get(cod);
        if (!v || v.exp < ahoraV) {
          const lleno = this.vincFallos.length >= 60;
          this.vincFallos.push({ u: yoAuth, ip: s.ip || '', t: ahoraV });
          return this.no(s, lleno ? demasiados : 'Ese código no existe o ya caducó (duran 10 minutos).');
        }
        if (v.uid === c.uid) return this.no(s, 'Ese código es de esta misma cuenta: escríbelo en tu OTRA cuenta.');
        if (v.inv) {
          // Llevar mi duende de invitado a esta cuenta: solo si esta cuenta aun no tiene progreso.
          if (s.uidAuth && s.uidAuth !== c.uid) return this.no(s, 'Esta cuenta ya está vinculada a un duende.');
          if ((c.nivel || 1) > 5 || c.compro || Object.keys(c.vinc || {}).length) return this.no(s, `Esta cuenta ya tiene su propio duende (${c.nombre}, Nv ${c.nivel}). Para traer el de invitado usa una cuenta de Telegram o correo que aún no haya jugado.`);
          if ((c.nivel || 1) > 1 && !m.forzar) return this.enviar(s, { t: 'vincConfirmar', cod, nombre: c.nombre, nivel: c.nivel, destino: v.nombre, nivelDestino: v.nivel || 1 });
          v.para = c.uid;
          // La cuenta vuelve a entrar con hola.vcod (holaCuenta -> tomarCodigoInv).
          return this.enviar(s, { t: 'invTraer', cod, nombre: v.nombre });
        }
        const tipo = tipoUid(yoAuth);
        if (tipo === tipoUid(v.uid)) return this.no(s, `Las dos cuentas son de ${NOMBRE_TIPO[tipo] || tipo}: solo se vincula una de Telegram con una de correo.`);
        const otro = this.porUid.get(v.uid);
        const destino = otro ? otro.c : await this.state.storage.get('c:' + v.uid);
        if (!destino) return this.no(s, 'No encuentro el duende de ese código.');
        if ((destino.vinc || {})[tipo]) return this.no(s, `Ese duende ya tiene una cuenta de ${NOMBRE_TIPO[tipo]} vinculada.`);
        if (c.nivel > 5 && !m.forzar) return this.enviar(s, { t: 'vincConfirmar', cod, nombre: c.nombre, nivel: c.nivel, destino: destino.nombre, nivelDestino: destino.nivel });
        this.vincs.delete(cod);
        // El personaje de esta cuenta se archiva (no se borra) y deja libre su nombre.
        s.noGuardar = true;
        if (c.nivel > 1 || c.oro > 0) await this.state.storage.put('arch:' + c.uid, { ...c, archivado: Date.now(), por: v.uid });
        await this.state.storage.delete('c:' + c.uid);
        for (const kn of ['n:' + claveNombre(c.nombre), 'ne:' + esqueleto(c.nombre)]) if ((await this.state.storage.get(kn)) === c.uid) await this.state.storage.delete(kn);
        await this.state.storage.put('al:' + c.uid, v.uid);
        destino.vinc = { ...(destino.vinc || {}), [tipo]: c.uid };
        if (otro) { otro.sucio = true; await this.guardar(otro); this.enviar(otro, { t: 'toast', ok: true, m: `🔗 Cuenta de ${NOMBRE_TIPO[tipo]} vinculada: ya puedes entrar con ella a este mismo duende.` }); this.enviar(otro, this.infoVinc(otro)); }
        else await this.state.storage.put('c:' + v.uid, destino);
        console.log('[MMO vincular]', c.uid, '->', v.uid);
        this.enviar(s, { t: 'vincOk', nombre: destino.nombre });
        setTimeout(() => this.expulsar(s, `Cuenta vinculada con ${destino.nombre}. Vuelve a entrar.`), 300);
        return;
      }
      case 'vincQuitar': {
        // Solo 'tg' o 'web', y con hasOwn: '__proto__' o 'constructor' existen en
        // cualquier objeto y pasaban por cuenta vinculada. Cada mensaje borraba y
        // guardaba en el storage (o fallaba si no habia c.vinc): a 60 por segundo
        // un solo jugador gastaba el cupo diario de escrituras de todos.
        const tipo = m.k === 'tg' || m.k === 'web' ? m.k : '';
        const sec = tipo && c.vinc && Object.hasOwn(c.vinc, tipo) && typeof c.vinc[tipo] === 'string' ? c.vinc[tipo] : '';
        if (!sec) return;
        if (sec === yoAuth) return this.no(s, 'No puedes desvincular la cuenta con la que has entrado: entra con la otra.');
        await this.state.storage.delete('al:' + sec);
        delete c.vinc[tipo];
        // Las skins que trajo esa cuenta de Telegram vuelven solo a ella.
        if (tipo === 'tg' && Array.isArray(c.skinsTg) && c.skinsTg.length) {
          const fuera = new Set(c.skinsTg);
          c.skins = c.skins.filter(k => !fuera.has(k));
          if (fuera.has(c.skin)) this.equipar(s, { k: 'skin', id: 'comun' });
          delete c.skinsTg;
        }
        s.sucio = true; await this.guardar(s);
        this.enviar(s, this.infoVinc(s));
        return this.enviar(s, { t: 'toast', ok: true, m: `Cuenta de ${NOMBRE_TIPO[tipo] || tipo} desvinculada. Si entras con ella empezará un duende nuevo.` });
      }
    }
  },
};
