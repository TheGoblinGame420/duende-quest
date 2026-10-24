// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — piedras de viaje (atajos del mundo abierto)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Las zonas estan unidas por sus bordes y se cruzan caminando sin pantalla
// de carga (portal() con borde). Para no tener que atravesar cinco zonas a
// pie, cada zona abierta tiene una piedra de viaje cerca de la entrada: desde
// ella se salta a cualquier zona que ya hayas pisado (c.visitadas, que se
// anota al entrar en entrarMapa). Fuera de combate y por un poco de oro, para
// que explorar a pie siga valiendo la pena.
// ═══════════════════════════════════════════════════════
import { MAPAS, PIEDRA_X, PIEDRA_DIST, costoViaje, tienePiedra } from '../../mmo/js/data.js';
import { pub } from './social.js';

const VIAJE_CD_MS = 8000;
const COMBATE_MS = 8000;
const IR_GRUPO_CD_MS = 60000;   // "Ir a su zona" del grupo: uno por minuto

export const Viajes = {
  viajar(s, m) {
    const c = s.c;
    const id = typeof m.mapa === 'string' ? m.mapa : '';
    if (s.muerto || s.duelo) return;
    if (!tienePiedra(c.mapa) || s.k.includes('#')) return this.no(s, 'Las piedras de viaje están en las zonas abiertas, cerca de la entrada.');
    if (Math.abs(s.x - PIEDRA_X) > PIEDRA_DIST) return this.no(s, 'Acércate a la piedra de viaje.');
    if (!Object.hasOwn(MAPAS, id) || !tienePiedra(id) || id === c.mapa) return;
    if (!(c.visitadas || []).includes(id)) return this.no(s, 'Solo puedes viajar a zonas que ya visitaste caminando.');
    const ahora = Date.now();
    if (ahora - (s.combateT || 0) < COMBATE_MS) return this.no(s, 'No puedes viajar en combate.');
    if (ahora < (s.viajeCd || 0)) return this.no(s, 'La piedra se está recargando: espera unos segundos.');
    const costo = costoViaje(MAPAS[id].nv[0]);
    if (c.oro < costo) return this.no(s, `Viajar a ${MAPAS[id].nombre} cuesta ${costo.toLocaleString('es')} oro.`);
    c.oro -= costo;
    s.viajeCd = ahora + VIAJE_CD_MS;
    if (s.montado) this.desmontar(s);
    this.entrarMapa(s, id, PIEDRA_X + 50);
    this.enviar(s, { t: 'toast', m: `Viajaste a ${MAPAS[id].nombre} (-${costo.toLocaleString('es')} oro).`, ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Ir con un compañero de grupo: salto gratis a la zona abierta (o al pueblo)
  // donde esta, junto a el. Fuera de combate, de mazmorras y del Coliseo, y
  // con su propia espera (no gasta la de la piedra) para que no la sustituya.
  irConGrupo(s, m) {
    const g = this.grupoDe(s);
    const uid = g && typeof m.uid === 'string' && g.uids.find(u => pub(u) === m.uid);
    const t = uid && this.porUid.get(uid);
    if (!t || !t.c || t === s || t.cerrado) return this.no(s, 'Ese compañero no está conectado.');
    if (t.m3) return this.no(s, `${t.c.nombre} está en ORIGINS: entra al mismo modo.`);
    if (s.muerto || s.duelo) return;
    if (s.k.includes('#') || s.c.mapa === 'coliseo') return this.no(s, 'Sal primero de la mazmorra o del Coliseo.');
    const id = t.c.mapa;
    if (t.k !== id || !(tienePiedra(id) || id === 'pueblo')) return this.no(s, `${t.c.nombre} está en una mazmorra o en una zona cerrada.`);
    if (id === s.c.mapa) return this.no(s, `Ya estás en la zona de ${t.c.nombre}.`);
    const ahora = Date.now();
    if (ahora - (s.combateT || 0) < COMBATE_MS) return this.no(s, 'No puedes viajar en combate.');
    if (ahora < (s.irGrupoT || 0)) return this.no(s, `Espera ${Math.ceil((s.irGrupoT - ahora) / 1000)} s para volver a ir con tu grupo.`);
    s.irGrupoT = ahora + IR_GRUPO_CD_MS;
    if (s.montado) this.desmontar(s);
    this.entrarMapa(s, id, t.x);
    const nv = MAPAS[id].nv;
    const peligro = nv && s.c.nivel < nv[0] - 3;
    this.enviar(s, { t: 'toast', ok: true, m: `👥 Fuiste con ${t.c.nombre} a ${MAPAS[id].nombre}.` + (peligro ? ` Ojo: la zona es de nivel ${nv[0]}.` : '') });
    this.avisarGrupo(g, `👥 ${s.c.nombre} llegó a ${MAPAS[id].nombre}.`, s);
    this.guardarSuave(s);
  },
};
