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
// a jugar con el duende de A. Los invitados no vinculan: ya heredan su
// personaje al crear cuenta.
// c.vinc = { tg: 'tg:<id>', web: 'web:<id>' } (las cuentas secundarias).
// ═══════════════════════════════════════════════════════
import { claveNombre } from './dios.js';

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

  async vincular(s, m) {
    const c = s.c;
    if (!c) return;
    const yoAuth = s.uidAuth || c.uid;
    switch (m.t) {
      case 'vincInfo': return this.enviar(s, this.infoVinc(s));
      case 'vincCodigo': {
        if (c.uid.startsWith('inv:')) return this.no(s, 'Primero crea tu cuenta (botón 👤): los invitados no pueden vincular.');
        this.vincs = this.vincs || new Map();
        for (const [k, x] of this.vincs) if (x.uid === c.uid || x.exp < Date.now()) this.vincs.delete(k);
        let cod;
        do { cod = Array.from({ length: 6 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''); } while (this.vincs.has(cod));
        this.vincs.set(cod, { uid: c.uid, exp: Date.now() + VINC_MS, nombre: c.nombre });
        return this.enviar(s, { ...this.infoVinc(s), t: 'vincCod', cod, ms: VINC_MS });
      }
      case 'vincUsar': {
        if (yoAuth.startsWith('inv:')) return this.no(s, 'Entra primero con tu cuenta de Telegram o de correo para vincularla.');
        if (s.uidAuth && s.uidAuth !== c.uid) return this.no(s, 'Esta cuenta ya está vinculada a un duende.');
        const cod = String(m.cod || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const v = this.vincs && this.vincs.get(cod);
        if (!v || v.exp < Date.now()) return this.no(s, 'Ese código no existe o ya caducó (duran 10 minutos).');
        if (v.uid === c.uid) return this.no(s, 'Ese código es de esta misma cuenta: escríbelo en tu OTRA cuenta.');
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
        const kn = 'n:' + claveNombre(c.nombre);
        if ((await this.state.storage.get(kn)) === c.uid) await this.state.storage.delete(kn);
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
