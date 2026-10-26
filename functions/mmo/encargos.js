// ═══════════════════════════════════════════════════════
// $DUENDE ORIGINS — encargos de zona (servidor)
//
// Se mezcla en MmoWorld. El progreso llega por progresoTarea (recoger,
// cofre, jefe) y por el movimiento (explorar el hito, sobrevolar la zona):
// todo lo valida el servidor, el cliente solo lo pinta. c.enc guarda el
// progreso de cada encargo (numero) o true si ya esta cumplido.
// ═══════════════════════════════════════════════════════
import { MAPAS, MONSTRUOS, xpParaSubir } from '../../mmo/js/data.js';
import { ZONAS3D, zonaEn, alturaEn } from '../../mmo/js/mundo3d.js';
import { encargosDe, hitoDe, HITO_DIST, VOLAR_ALTO, ZONAS_ENC, oroEncargo, oroZona } from '../../mmo/js/encargos3d.js';
import { enAbismo } from '../../mmo/js/abismo3d.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const Encargos = {
  infoEncargos(c) { return { t: 'enc', l: c.enc || {}, zonas: c.encZonas || 0 }; },
  progresoEncargo(s, tipo, o) {
    if (!s.m3 || s.i3 || !s.c || enAbismo(s.p.x)) return;
    // El jefe cuenta para SU zona aunque pelee junto al borde (antes se perdia la reliquia).
    const zona = tipo === 'jefe' && o ? (Object.keys(ZONAS3D).find(z => MAPAS[z] && MAPAS[z].jefe === o.k) || (o.x !== undefined ? zonaEn(o.x, o.z) : zonaEn(s.p.x, s.p.z))) : zonaEn(s.p.x, s.p.z);
    if (!ZONAS3D[zona]) return;
    // El jefe del encargo es el de la zona (el Capitan de una invasion no cuenta).
    if (tipo === 'jefe' && MAPAS[zona] && MAPAS[zona].jefe && (!o || o.k !== MAPAS[zona].jefe)) return;
    const c = s.c, enc = c.enc || (c.enc = {});
    for (const e of encargosDe(zona, MAPAS, MONSTRUOS)) {
      if (e.tipo !== tipo || enc[e.id] === true) continue;
      enc[e.id] = (enc[e.id] || 0) + 1;
      s.sucio = true;
      if (enc[e.id] >= e.n) this.cumplirEncargo(s, zona, e);
      else this.enviar(s, this.infoEncargos(c));
    }
  },
  cumplirEncargo(s, zona, e) {
    const c = s.c, nvZ = ((MAPAS[zona] || {}).nv || [1])[0];
    c.enc[e.id] = true;
    const xp = Math.max(10, Math.round(xpParaSubir(c.nivel) * 0.06)), oro = oroEncargo(nvZ);
    c.oro += oro;
    const subio = this.sumarXp(s, xp);
    this.enviar(s, { t: 'gana', xp, oro, drops: [] });
    this.enviar(s, { t: 'toast', ok: true, m: `🧭 Encargo cumplido: ${e.txt}. +${xp} XP · +${oro} oro` });
    const todos = encargosDe(zona, MAPAS, MONSTRUOS).every(x => c.enc[x.id] === true);
    if (todos) {
      c.encZonas = ZONAS_ENC.filter(z => encargosDe(z, MAPAS, MONSTRUOS).every(x => c.enc[x.id] === true)).length;
      const extra = oroZona(nvZ);
      c.oro += extra;
      this.enviar(s, { t: 'aviso', m: `🗺 ¡Completaste los encargos de ${MAPAS[zona].nombre}! +${extra} oro. Zonas exploradas: ${c.encZonas}/${ZONAS_ENC.length}.` });
      if (this.revisarLogros) this.revisarLogros(s, true);
    }
    if (this.puntoPase) this.puntoPase(s, 1);
    this.enviar(s, this.infoEncargos(c));
    this.yoLuego ? this.yoLuego(s, subio) : this.actualizarYo(s);
  },
  // Desde mover3d (como mucho una vez por segundo): hito y vuelo alto.
  revisarExploracion(s, ahora) {
    if (ahora - (s.encT || 0) < 1000 || s.i3 || enAbismo(s.p.x)) return;
    s.encT = ahora;
    const zona = zonaEn(s.p.x, s.p.z);
    if (!ZONAS3D[zona]) return;
    const enc = s.c.enc || {};
    const h = hitoDe(zona, ZONAS3D, alturaEn);
    if (h && enc[zona + ':hito'] !== true && dist(s.p, h) < HITO_DIST) this.progresoEncargo(s, 'explorar');
    if (s.a === 3 && (s.h || 0) >= VOLAR_ALTO && enc[zona + ':volar'] !== true) this.progresoEncargo(s, 'volar');
  },
};
