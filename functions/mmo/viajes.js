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

const VIAJE_CD_MS = 8000;
const COMBATE_MS = 8000;

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
};
