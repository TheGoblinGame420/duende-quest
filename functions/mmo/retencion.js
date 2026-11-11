// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — retencion: estadisticas reales y avisos de vuelta
//
// Se mezcla en MmoWorld (Object.assign al final de world.js).
//
// Por personaje (en el propio c, campo c.ret):
//   { d: [dias UTC jugados, los ultimos 60, como numero de dia], dt: dias
//     distintos en total, ses: sesiones, min: minutos jugados, visto: ultima
//     vez (ms), u: uid con el que se registro, alta: 1 si se conto como alta }
//   La primera vez visto es c.creado (ya existia) y el nivel es c.nivel.
//
// Agregados en el storage del DO (para no recorrer a todos los personajes):
//   ret:dia:<YYYY-MM-DD> → { n: altas, a: activos, ses, min, r1, r7, r30 }
//     r1/r7/r30 = de los que se dieron de alta ESE dia, cuantos volvieron
//     exactamente 1, 7 y 30 dias despues (retencion "dia N" clasica).
//     r8/r14 = igual a los 8 y 14 dias (semanas 2 y 3 de la racha larga).
//   ret:idx → { uid: { v: ultimo dia jugado, l: nivel, a: avisos sin
//     respuesta, ad: dia del ultimo aviso, off: 1 si pidio no recibir avisos,
//     bloq: 1 si bloqueo al bot, hs: hora UTC de su primera entrada de cada
//     dia, las ultimas 10 } }
//     Un solo objeto: con la escala actual (decenas de jugadores) cabe de
//     sobra y evita listar todos los c:<uid> (que pesan bolsa, equipo...)
//     para contar activos o elegir a quien avisar.
//
// Los avisos salen a la HORA HABITUAL de cada uno (la que mas se repite en
// sus primeras entradas del dia; con 1 o 2 dias anotados, la de la ultima;
// sin ninguno, las 17:00 UTC). Las 17:00 las manda el cron (functions/api/cron.js) por la ruta
// interna 'recordatorios'; el resto de horas, la alarma del propio Durable
// Object (alarm(), cada hora en punto), sin gastar otro disparador de cron.
// Reglas para no hacer spam: solo cuentas de Telegram que jugaron en los
// ultimos 14 dias y no entraron hoy, 1 aviso al dia como mucho, y tras 2
// avisos sin volver se pausa hasta que vuelva. Un evento de temporada ya no
// salta la pausa ni amplia la ventana (e.ev solo guarda el ultimo evento
// avisado); off y bloq se respetan siempre.
// ═══════════════════════════════════════════════════════

import { xpParaSubir, premioDiaria, premioMazmorraDia, multLogin, diaRacha, semanaRacha, multSemanaRacha, premioRacha, HABS, CLASES, NIVEL_MAX, DIARIA, horaFelizActiva, TORRE, semanaUTC, temporadaDe, TEMPORADAS, SKINS, precioOro, GESTA_UMBRALES, GESTA_NOMBRES, DIA_DESFASE_MS, hoyUTC, VERSION, NOVEDADES } from '../../mmo/js/data.js';
import { getEnv, tg } from '../api/lib.js';
import { MMO_URL, MUNDO_URL } from '../api/telegram-bot.js';
import { metaEvento } from './meta.js';

const DIA_MS = 86400000;
const DIAS_GUARDADOS = 60;          // dias jugados que se recuerdan por personaje
const VENTANA_AVISO = 14;           // solo se avisa a quien jugo en estos dias
const AVISOS_SIN_RESPUESTA = 2;     // despues de esto, pausa hasta que vuelva
const POR_SEGUNDO = 25;             // Telegram corta a ~30 mensajes/s por bot
const OLVIDAR_DIAS = 35;            // el indice olvida a quien no juega hace mas
const NIVEL_MAZMORRA = 6;           // la primera mazmorra (Madriguera Goblin) pide Nv 6
// Orden de las lineas del aviso diario (las 3 primeras salen). Tambien la lista
// blanca de tipos que se cuentan en ret:dia (avE_<tipo> enviados, avV_<tipo>
// los que volvieron en 24 h) y que /mmostats muestra en avisos.
export const AVISO_ORDEN = ['ev', 'soc', 'racha', 'col', 'exped', 'feliz', 'mazm', 'torre', 'diaria', 'nivel', 'nov'];
// «Avísame por Telegram» para jugadores web e invitados: un codigo de un solo
// uso (10 min, en memoria) atado al personaje; el jugador abre el bot con
// t.me/duendequest_bot?start=av_<cod> y su chat queda en ret:idx[uid].tc.
// Solo quien pulso el boton Y abrio el chat con el bot recibe avisos (con los
// mismos topes que los de Telegram y /avisos off). Premio pequeño, una vez.
export const AVISO_TG_MS = 10 * 60 * 1000;
export const AVISO_TG_ORO = 300;
export const AVISO_TG_NV = 8;   // la oferta sola no sale antes de este nivel; a pedido, siempre
const AV_LETRAS = 'abcdefghjkmnpqrstuvwxyz23456789';

// Dia de juego (medianoche de Lima, como hoyUTC de data.js): diaISO(diaNum(t)) === diaJuego(t).
export const diaNum = (t = Date.now()) => Math.floor((t + DIA_DESFASE_MS) / DIA_MS);
export const diaISO = n => new Date(n * DIA_MS).toISOString().slice(0, 10);
const fmt = n => Math.round(n).toLocaleString('es', { useGrouping: 'always' });
const pct = (x, base) => base ? Math.round(x / base * 1000) / 10 : null;
const vacio = () => ({ n: 0, a: 0, ses: 0, min: 0, r1: 0, r7: 0, r30: 0 });

// Origen del jugador (/js/origen.js lo manda en el 'hola' como src). Lista
// blanca: nadie puede meter claves nuevas en ret:dia. Se guarda UNA vez, en el
// alta (c.ret.src), y la herencia de invitado lo conserva (copia c entero).
// Con el, el alta, el embudo y D1/D7 se suman tambien como <campo>_<src>
// (n_meta, c1_meta, r1_meta...) en el mismo ret:dia.
export const ORIGENES = ['meta', 'tg', 'wa', 'etiqueta', 'ref', 'org'];
const srcDe = v => ORIGENES.includes(v) ? v : 'org';
const conSrc = (c, campos) => {
  const s = c && c.ret && c.ret.src;
  if (!ORIGENES.includes(s)) return campos;
  const o = { ...campos };
  for (const k in campos) o[k + '_' + s] = campos[k];
  return o;
};

// Embudo de COMPRA y retorno de los anuncios (en ret:dia, sumado en memoria con retSumar):
//   tv vio la tienda premium · fa abrio la factura de Stars · fc la cerro sin pagar
//   pq_<metodo> creo un pedido · pg lo pago (Stars o cadena) · en se le entrego
//   cad caduco sin pagar. Una vez por personaje, paso y dia UTC, y tambien <paso>_<origen>.
//   u7 / u7_<origen> / u7~<campaña>: US$ entregados de pedidos hechos en sus 7
//   primeros dias, sumados al DIA DEL ALTA (ARPU D7 y ROAS D7 de esa cohorte).
//   n~<campaña>: altas por campaña (utm_campaign de origen.js, saneada).
// Gasto en anuncios (/gasto del dueño): ret:gasto → [{ f: 'YYYY-MM-DD', src, camp, usd }].
// Las compras del arcade con Stars van por otro lado (Supabase): no entran en el ROAS.
export const COMPRA_PASOS = ['tv', 'fa', 'fc', 'pq_stars', 'pq_sol', 'pq_duende', 'pq_yape', 'pg', 'en', 'cad'];
export const campDe = v => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
const MAX_CAMP_DIA = 30;   // campañas distintas por dia en ret:dia (n~ y u7~)
const campsDe = r => Object.keys(r).filter(k => k.startsWith('n~')).length;
// Anuncio (utm_content de origen.js): n^<anuncio> altas, r1^/r3^ volvieron al D1/D3
// (sumados al dia del alta, solo si ese dia conto su n^). Mismo tope que las campañas.
// Las campañas tambien llevan r1~/r3~. Asi /mmostats ve que video trae gente que vuelve.
export const adDe = v => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
const adsDe = r => Object.keys(r).filter(k => k.startsWith('n^')).length;
// Version publicada (?v= de data.js) con la que se dio de alta: n@<v> altas, r1@/r3@
// volvieron al D1/D3 y s2@ volvio a entrar el mismo dia. Asi /mmostats ve si una
// version subio o bajo el D1. Como mucho 6 versiones por dia (un dia con varias subidas).
const MAX_VERS_DIA = 6;
const versDe = r => Object.keys(r).filter(k => k.startsWith('n@')).length;
// Intervalo de Wilson al 95% de x de n, en puntos enteros: [bajo, alto]. Con poca
// muestra el intervalo es ancho y avisa de que el % aun no dice nada.
export function wilson(x, n) {
  if (!(n > 0)) return [0, 0];
  const z = 1.96, p = Math.min(1, Math.max(0, x / n)), z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margen = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / (1 + z2 / n);
  return [Math.max(0, Math.round((centro - margen) * 100)), Math.min(100, Math.round((centro + margen) * 100))];
}
// r2/r3 y r1~/r3~ se miden desde este dia de alta: las cohortes anteriores no los
// tienen y bajarian el % (en /mmostats salen sin dato, no como 0).
const INI_D23 = diaNum(Date.parse('2026-11-02T12:00:00Z'));
const r2 = n => Math.round(n * 100) / 100;

// Embudo de la carga (antes del alta), por beacon (worker.js → /mmo/ev):
//   ev:dia:<YYYY-MM-DD> → { '<juego>|<evento>|<origen>|<m|p>': [n, b0..b6] }
//   n = sesiones que llegaron a ese paso; b = cuantas en cada tramo de ms
//   (desde que abrio la pagina; 'bienvenido' y 'mover', desde el clic en entrar).
// Se suma en memoria y se vuelca como mucho una vez por minuto.
export const EV_PASOS = ['carga_ini', 'arte_ok', 'form_visto', 'clic_entrar', 'bienvenido', 'mover', 'fallo_webgl', 'oculta', 'oculta_dl', 'oculta_arte', 'oculta_gl', 'oculta_red', 'joy_toque', 't_atk', 't_hab', 't_volar', 't_fin',
  // Primeras misiones y primer jefe (Sabueso, mision 4) de ORIGINS: donde se pierde el novato.
  'mis_0', 'mis_1', 'mis_2', 'mis_3', 'mis_4', 'mis_5', 'jefe1_ver', 'jefe1_muere', 'jefe1_ok',
  // Cueva de los Goblins (hito de Nv 5): entra, ve al Rey, cae dentro y la completa.
  'cueva_entra', 'cueva_rey_ve', 'cueva_muere', 'cueva_ok',
  // Primera caida protegida: cuantos mueren por primera vez y cuantos revivan.
  'muerte1', 'revivir1',
  // Rendimiento de ORIGINS (90 s tras arte_ok): calidad x fluidez y familia de GPU.
  'fps_baja_ok', 'fps_baja_justo', 'fps_baja_lento', 'fps_media_ok', 'fps_media_justo', 'fps_media_lento', 'fps_alta_ok', 'fps_alta_justo', 'fps_alta_lento',
  'gpu_mali', 'gpu_adreno', 'gpu_powervr', 'gpu_apple', 'gpu_intel', 'gpu_swiftshader', 'gpu_otra',
  // Vigias de ORIGINS (mundo.js): fuga de geometrias/texturas en la GPU y posicion rota (NaN).
  'fuga_gpu', 'nan_pos',
  // Primer ataque mandado y primera caza (ms desde el clic en entrar): los dos juegos.
  'golpe1', 'caza1',
  // Bautizo del duende (invitado se pone nombre) y apariencia guardada: ORIGINS.
  'nombre_puesto', 'look_guardado',
  // Paginas de aterrizaje (j='web', sin juego todavia): visita y clic en su boton de jugar, una vez por sesion.
  'ld_portada_ver', 'ld_portada_clic', 'ld_jugar_ver', 'ld_jugar_clic', 'ld_chicha_ver', 'ld_chicha_clic'];
// Un paso vale si esta en la lista, con su juego: los ld_* van siempre con 'web' y el resto con origins/classic.
export const evValido = (e, j) => EV_PASOS.includes(e) && (String(e).startsWith('ld_') ? j === 'web' : j === 'origins' || j === 'classic');
const EV_TRAMOS = [2000, 5000, 10000, 20000, 40000, 90000];   // el ultimo tramo es "mas de 90 s"
const EV_POR_IP_HORA = 40;      // por /64 de IPv6: un jugador manda ~11 (8 de carga + 3 del tutorial); recargas y los dos juegos caben de sobra
const EV_POR_IPV4_HORA = 800;   // IPv4: la comparten cientos de moviles por CGNAT (Claro, Movistar, Entel, Bitel)
const EV_MAX_DIA = 60000;       // tope diario de avisos aceptados (cuida el cupo)
const EV_MAX_CLAVES = 900;      // 2 juegos x 11 pasos x 6 origenes x 2 equipos = 264, mas 16 de rendimiento y 9 de misiones/1er jefe (solo origins) x 12 = 564 posibles, 72 de paginas de aterrizaje (6 x 12), y holgura para los pasos de GPU
// IPv6: se limita por /64 (un equipo cambia de direccion dentro de su bloque).
const claveIpEv = ip => ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;

const MAX_ENVIOS = 40;   // avisos por llamada a 'recordatorios' (limite de subpeticiones)
export const HORA_DEFECTO = 17;   // la del cron: para quien aun no tiene hora habitual
const DIAS_PARA_HORA = 3;         // dias con hora anotada para buscar la mas repetida
const horaUTC = (t = Date.now()) => new Date(t).getUTCHours();
// Hora UTC pasada a Lima: «mas tarde hoy» se ordena dentro del dia de juego (00-23 de Lima).
const horaLima = h => (h + 19) % 24;

// La hora (UTC) a la que suele volver: la mas repetida de sus primeras
// entradas del dia; en empate, la mas reciente. Con 1 o 2 dias (el aviso D1
// del jugador nuevo), la de su ultima primera entrada: a la hora que jugo.
export function horaHabitual(e) {
  const hs = (e && e.hs) || [];
  if (!hs.length) return HORA_DEFECTO;
  if (hs.length < DIAS_PARA_HORA) return hs[hs.length - 1];
  const n = {};
  for (const h of hs) n[h] = (n[h] || 0) + 1;
  let mejor = hs[hs.length - 1];
  for (let i = hs.length - 1; i >= 0; i--) if (n[hs[i]] > n[mejor]) mejor = hs[i];
  return mejor;
}

export const Retencion = {
  // ── Almacenamiento ──
  // Se cachea la PROMESA y no el valor: dos sesiones que suman a la vez
  // reciben el mismo objeto y ninguna pisa la suma de la otra al guardar.
  // Cuantos jugadores distintos entraron hoy (UTC). Con 1-3 en linea a la
  // vez el mundo parece vacio; "12 jugaron hoy" cuenta la verdad completa.
  async contarHoy() {
    const idx = await this.retIdx(), hoy = diaNum();
    let n = 0;
    for (const u in idx) if (idx[u].v === hoy) n++;
    return n;
  },

  retIdx() {
    if (!this._retIdx) {
      this._retIdx = this.state.storage.get('ret:idx').then(x => x || {});
      this._retIdx.catch(() => { this._retIdx = null; });
    }
    return this._retIdx;
  },
  // Devuelve false si no se pudo guardar. Tope duro de entradas: el indice es una
  // sola clave (unos 2 MB como mucho) y una oleada de invitados lo llenaba; se
  // quitan los invitados que llevan mas tiempo sin jugar (a ellos nunca se les avisa).
  async retGuardarIdx() {
    try {
      const idx = await this.retIdx();
      const uids = Object.keys(idx);
      if (uids.length > 20000) {
        const invs = uids.filter(u => u.startsWith('inv:')).sort((a, b) => (idx[a].v || 0) - (idx[b].v || 0));
        for (const u of invs.slice(0, uids.length - 18000)) delete idx[u];
      }
      await this.state.storage.put('ret:idx', idx);
      return true;
    } catch (e) { console.error('[MMO ret idx]', e); return false; }
  },
  retDia(n) {
    this._retDias = this._retDias || new Map();
    let p = this._retDias.get(n);
    if (!p) {
      p = this.state.storage.get('ret:dia:' + diaISO(n)).then(x => x || vacio());
      p.catch(() => { if (this._retDias && this._retDias.get(n) === p) this._retDias.delete(n); });   // migrar() pudo vaciar el cache
      this._retDias.set(n, p);
      // En memoria solo hacen falta los ultimos ~2 meses (cohortes y /mmostats).
      if (this._retDias.size > 90) for (const k of [...this._retDias.keys()]) if (k < n - 70) this._retDias.delete(k);
    }
    return p;
  },
  // Suma en memoria (el objeto del dia que guarda retDia) y lo vuelca
  // retVolcarDias como mucho cada 60 s: antes cada alta, activo o hito era una escritura.
  async retSumar(n, campos) {
    const r = await this.retDia(n);
    for (const k in campos) r[k] = Math.round(((r[k] || 0) + campos[k]) * 100) / 100;
    (this._retSucios = this._retSucios || new Set()).add(n);
    if (Date.now() - (this._retDiasT || 0) > 60000) await this.retVolcarDias();
  },
  async retVolcarDias(forzar) {
    const sucios = this._retSucios;
    if (!sucios || !sucios.size) return;
    if (!forzar && Date.now() - (this._retDiasT || 0) <= 60000) return;
    this._retDiasT = Date.now();
    this._retSucios = null;
    for (const n of sucios) {
      // Si el cache se vacio (restaurar una copia, pruebas) lo pendiente ya no vale.
      const p = this._retDias && this._retDias.get(n);
      if (!p) continue;
      try { await this.state.storage.put('ret:dia:' + diaISO(n), await p); }
      catch (e) { (this._retSucios = this._retSucios || new Set()).add(n); console.error('[MMO ret dia]', e); }
    }
  },

  // Invitaciones por ?ref= del dia: llegan (personaje nuevo con invitador),
  // cuentan (ya con cuenta real: nuevo o heredado) y se pagan (premio Nv 10).
  refContar(k) {
    this.retSumar(diaNum(), { [k]: 1 }).catch(() => {});
  },

  // Embudo de los nuevos (26-oct): de la cohorte de su alta, cuantos llegan a la
  // primera caza (c1), a entregar la mision 1 (m1), a nivel 5 (n5) y a nivel 10 (n10).
  // Una vez por personaje y solo en sus primeros 30 dias.
  hitoEmbudo(c, k) {
    if (!c || !c.ret || !c.ret.alta || (this.uidsPrueba && this.uidsPrueba.has(c.uid))) return;
    const e = c.ret.emb || (c.ret.emb = {});
    if (e[k]) return;
    e[k] = 1;
    const desde = diaNum(c.creado || Date.now());
    if (diaNum() - desde > 30) return;
    // Referidos (llegaron con ?ref=): n5r / n10r para comparar con el resto (resumen: invitaciones).
    const campos = conSrc(c, { [k]: 1 });
    if (c.invitadoPor && (k === 'n5' || k === 'n10')) campos[k + 'r'] = 1;
    this.retSumar(desde, campos).catch(() => {});
    if (k === 'm1') metaEvento(this, c, 'CompleteRegistration');   // Conversions API (meta.js): solo con fbc y META_*
  },

  // Paso del embudo de compra (COMPRA_PASOS) al dia de hoy. c puede faltar
  // (pago de Stars o entrega con el jugador desconectado): el origen sale de pd.src.
  hitoCompra(c, k, pd) {
    if (!COMPRA_PASOS.includes(k)) return;
    const uid = (c && c.uid) || (pd && pd.uid);
    if (!uid || (this.uidsPrueba && this.uidsPrueba.has(uid))) return;
    const hoy = diaNum();
    if (!this._hitosC || this._hitosC.d !== hoy) this._hitosC = { d: hoy, s: new Set() };
    const clave = uid + '|' + k;
    if (this._hitosC.s.has(clave) || this._hitosC.s.size > 50000) return;
    this._hitosC.s.add(clave);
    const src = (c && c.ret && c.ret.src) || (pd && pd.src);
    this.retSumar(hoy, ORIGENES.includes(src) ? { [k]: 1, [k + '_' + src]: 1 } : { [k]: 1 }).catch(() => {});
  },
  // Del cliente ({ t: 'ev', k }): solo los pasos que el servidor no ve.
  evCompra(s, m) {
    if (s && s.c && m && (m.k === 'tv' || m.k === 'fa')) this.hitoCompra(s.c, m.k);
  },
  // Al entregar: lo cobrado de un pedido hecho en sus primeros 7 dias se suma
  // al dia de su alta (pd.alta, pd.dias, pd.src y pd.camp los pone pedidoUno).
  ventaCohorte(pd) {
    if (!pd || !(pd.usd > 0) || !Number.isInteger(pd.alta) || !(pd.dias >= 0 && pd.dias <= 7)) return;
    if (this.uidsPrueba && this.uidsPrueba.has(pd.uid)) return;
    const campos = { u7: pd.usd };
    if (ORIGENES.includes(pd.src)) campos['u7_' + pd.src] = pd.usd;
    this.retDia(pd.alta).then(r => {
      if (pd.camp && (r['n~' + pd.camp] || campsDe(r) < MAX_CAMP_DIA)) campos['u7~' + pd.camp] = pd.usd;
      return this.retSumar(pd.alta, campos);
    }).catch(() => {});
  },
  // /gasto del dueño: anota (o corrige, misma fecha+origen+campaña; 0 lo borra)
  // lo gastado en anuncios ese dia, en US$. Sin fecha solo lista lo ultimo.
  async gastoAnuncios(b) {
    let l = (await this.state.storage.get('ret:gasto')) || [];
    if (b && b.f !== undefined) {
      const f = String(b.f || ''), src = String(b.src || ''), camp = campDe(b.camp), usd = Number(b.usd);
      const t = Date.parse(f + 'T12:00:00Z');   // mediodia: cae en ese dia de juego (Lima)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !Number.isFinite(t) || diaISO(diaNum(t)) !== f) return { ok: false, error: 'Fecha no válida (usa AAAA-MM-DD, hoy o ayer).' };
      if (diaNum(t) > diaNum() || diaNum(t) < diaNum() - 120) return { ok: false, error: 'La fecha debe ser de los últimos 120 días.' };
      if (!ORIGENES.includes(src) || src === 'org') return { ok: false, error: 'Origen no válido: meta, tg, wa, etiqueta o ref.' };
      if (!(usd >= 0 && usd <= 100000)) return { ok: false, error: 'Monto no válido (US$, entre 0 y 100000).' };
      l = l.filter(x => !(x.f === f && x.src === src && x.camp === camp));
      if (usd > 0) l.push({ f, src, camp, usd: r2(usd) });
      const corte = diaISO(diaNum() - 120);
      l = l.filter(x => x.f >= corte).sort((a, c) => a.f < c.f ? -1 : a.f > c.f ? 1 : 0).slice(-500);
      await this.state.storage.put('ret:gasto', l);
    }
    return { ok: true, l: l.slice(-15) };
  },
  // /mmostats: gasto, altas, CPI, D1, ARPU D7 y ROAS D7 de las altas de los
  // ultimos 7 dias por origen con gasto (Meta siempre) y por campaña. dias = los de retStats.
  async retAnuncios(dias, hoy) {
    const l = (await this.state.storage.get('ret:gasto')) || [];
    const desde = diaISO(hoy - 6), hasta = diaISO(hoy);
    const g = l.filter(x => x.f >= desde && x.f <= hasta);
    const sem = dias.slice(0, 7);
    const fila = (gasto, nK, r1K, u7K, r3K) => {
      let n = 0, base1 = 0, v1 = 0, base3 = 0, v3 = 0, u7 = 0;
      for (const x of sem) {
        n += x.r[nK] || 0; u7 += x.r[u7K] || 0;
        if (r1K && hoy - x.n > 1 && (x.n >= INI_D23 || !r1K.includes('~'))) { base1 += x.r[nK] || 0; v1 += x.r[r1K] || 0; }
        if (r3K && hoy - x.n > 3 && x.n >= INI_D23) { base3 += x.r[nK] || 0; v3 += x.r[r3K] || 0; }
      }
      return { gasto: r2(gasto), altas: n, cpi: n && gasto ? r2(gasto / n) : null, d1: r1K ? pct(v1, base1) : null, d1n: v1, d1base: base1, d1i: wilson(v1, base1), d3: r3K ? pct(v3, base3) : null, d3n: v3, d3base: base3, d3i: wilson(v3, base3), u7: r2(u7), arpu: n ? r2(u7 / n) : null, roas: gasto ? r2(u7 / gasto) : null };
    };
    const suma = f => r2(g.filter(f).reduce((a, x) => a + x.usd, 0));
    const porSrc = {};
    for (const o of ORIGENES) {
      if (o === 'org') continue;
      const gasto = suma(x => x.src === o);
      const e = fila(gasto, 'n_' + o, 'r1_' + o, 'u7_' + o, 'r3_' + o);
      if (gasto || (o === 'meta' && e.altas)) porSrc[o] = e;
    }
    const camps = [...new Set(g.filter(x => x.camp).map(x => x.camp))].slice(0, 10)
      .map(k => ({ camp: k, ...fila(suma(x => x.camp === k), 'n~' + k, 'r1~' + k, 'u7~' + k, 'r3~' + k) }));
    // Por anuncio (utm_content, sin gasto: Meta lo da por campaña): altas de 14 dias y su
    // D1/D3 (solo cohortes con el dia ya cumplido). Los 10 con mas altas.
    const ads = {};
    for (const x of dias.slice(0, 14)) for (const k in x.r) {
      if (!k.startsWith('n^')) continue;
      const id = k.slice(2), e = ads[id] || (ads[id] = { ad: id, altas: 0, b1: 0, v1: 0, b3: 0, v3: 0 });
      const n = x.r[k] || 0, hace = hoy - x.n;
      e.altas += n;
      if (hace > 1) { e.b1 += n; e.v1 += x.r['r1^' + id] || 0; }
      if (hace > 3) { e.b3 += n; e.v3 += x.r['r3^' + id] || 0; }
    }
    const anuncios = Object.values(ads).sort((a, b) => b.altas - a.altas).slice(0, 10)
      .map(e => ({ ad: e.ad, altas: e.altas, d1: pct(e.v1, e.b1), d1n: e.v1, d1base: e.b1, d1i: wilson(e.v1, e.b1), d3: pct(e.v3, e.b3), d3n: e.v3, d3base: e.b3, d3i: wilson(e.v3, e.b3) }));
    return { desde, hasta, porSrc, camps, ads: anuncios };
  },
  // /mmostats: por version publicada (n@), altas de 14 dias, cuantas volvieron a
  // entrar el mismo dia (s2@) y su D1/D3 (solo cohortes con el dia ya cumplido).
  // Las 8 versiones mas nuevas, de la mas nueva a la mas vieja.
  retVersiones(dias, hoy) {
    const vs = {};
    for (const x of dias.slice(0, 14)) for (const k in x.r) {
      if (!k.startsWith('n@')) continue;
      const v = k.slice(2), e = vs[v] || (vs[v] = { v, n: 0, d1n: 0, d1base: 0, d3n: 0, d3base: 0, s2: 0 });
      const n = x.r[k] || 0, hace = hoy - x.n;
      e.n += n;
      e.s2 += x.r['s2@' + v] || 0;
      // El % de «volvió hoy» solo con dias ya cerrados: las altas de hoy aun pueden volver.
      if (hace >= 1) { e.s2base = (e.s2base || 0) + n; e.s2c = (e.s2c || 0) + (x.r['s2@' + v] || 0); }
      if (hace > 1) { e.d1base += n; e.d1n += x.r['r1@' + v] || 0; }
      if (hace > 3) { e.d3base += n; e.d3n += x.r['r3@' + v] || 0; }
    }
    return Object.values(vs).sort((a, b) => (Number(b.v) || 0) - (Number(a.v) || 0)).slice(0, 8)
      .map(e => ({ ...e, d1: pct(e.d1n, e.d1base), d1i: wilson(e.d1n, e.d1base), d3: pct(e.d3n, e.d3base), d3i: wilson(e.d3n, e.d3base), s2pct: pct(e.s2c || 0, e.s2base || 0) }));
  },
  // /ventas: el embudo de compra de los ultimos 7 dias (todos y los de Meta).
  async embudoCompra() {
    const hoy = diaNum(), tot = {}, meta = {};
    for (let i = 0; i < 7; i++) {
      const r = await this.retDia(hoy - i);
      for (const k of COMPRA_PASOS) { tot[k] = (tot[k] || 0) + (r[k] || 0); meta[k] = (meta[k] || 0) + (r[k + '_meta'] || 0); }
    }
    return { tot, meta };
  },

  // Anota el dia en el personaje. true si es su primera vez de ese dia.
  retMarcarDia(c, hoy) {
    const r = c.ret;
    if (r.d.length && r.d[r.d.length - 1] >= hoy) return false;   // uno futuro (dia UTC antiguo) cuenta como hoy
    r.d = r.d.filter(x => x > hoy - DIAS_GUARDADOS && x < hoy);
    r.d.push(hoy);
    r.dt = (r.dt || 0) + 1;
    return true;
  },

  // Primera vez del dia: activos del dia y, si toca, su cohorte (D1/D7/D30).
  async retNuevoDia(c, hoy) {
    await this.retSumar(hoy, { a: 1 });
    if (!c.ret.alta) return;
    const desde = diaNum(c.creado || Date.now());
    const k = hoy - desde;
    // D8 (cruzo a la semana 2 de la racha) y D14 (2 semanas): miden la racha larga.
    // D2/D3: señal temprana para pausar o escalar un anuncio (r2_meta, r3_meta...).
    if (k === 1 || k === 2 || k === 3 || k === 7 || k === 8 || k === 14 || k === 30) await this.retSumar(desde, conSrc(c, { ['r' + k]: 1 }));
    // D1/D3 por campaña (r1~/r3~) y por anuncio (r1^/r3^): solo si su alta se conto ese dia (tope de claves).
    if ((k === 1 || k === 3) && (c.ret.camp || c.ret.ad || c.ret.v)) {
      const rd = await this.retDia(desde), extra = {};
      if (c.ret.camp && rd['n~' + c.ret.camp]) extra['r' + k + '~' + c.ret.camp] = 1;
      if (c.ret.ad && rd['n^' + c.ret.ad]) extra['r' + k + '^' + c.ret.ad] = 1;
      if (c.ret.v && rd['n@' + c.ret.v]) extra['r' + k + '@' + c.ret.v] = 1;
      if (Object.keys(extra).length) await this.retSumar(desde, extra);
    }
    if (k === 1 && c.ret.iab) await this.retSumar(desde, { r1iab: 1 });
    if (k === 1) metaEvento(this, c, 'VolvioD1');   // Conversions API (meta.js): solo con fbc y META_*
  },

  // ── Ganchos (los llama world.js) ──
  // En hola, con el personaje ya cargado. nuevo = personaje recien creado.
  async retEntrar(s, nuevo, src, camp, ad) {
    try {
      const c = s.c, ahora = Date.now(), hoy = diaNum(ahora);
      // Solo cuenta como alta un personaje creado ahora: los que ya existian
      // antes de medir no tienen dia de alta fiable y ensuciarian las cohortes.
      if (!c.ret) c.ret = { d: [], dt: 0, ses: 0, min: 0, visto: ahora, u: c.uid, alta: nuevo ? 1 : 0 };
      // Origen: una sola vez, en el alta (despues nunca se pisa).
      if (nuevo && !c.ret.src) c.ret.src = srcDe(src);
      // Campaña (utm_campaign): tambien solo en el alta; con ella /mmostats saca el ROAS por campaña.
      if (nuevo && !c.ret.camp && campDe(camp)) c.ret.camp = campDe(camp);
      // Anuncio (utm_content): igual, solo en el alta; altas y D1/D3 por anuncio en /mmostats.
      if (nuevo && !c.ret.ad && adDe(ad)) c.ret.ad = adDe(ad);
      // Alta desde el navegador interno de Facebook/Instagram (hola.iab): su D1 aparte.
      if (nuevo && s.iab) c.ret.iab = 1;
      // Version publicada del alta: altas, D1/D3 y «volvió hoy» por version en /mmostats.
      if (nuevo && !c.ret.v) c.ret.v = VERSION;
      const r = c.ret;
      // «Volvió hoy» (s2): su 2a sesion cae el mismo dia de Lima del alta. Una vez por
      // cuenta; una reconexion de menos de 5 min (cambio de app en el celular) no cuenta.
      const s2 = !nuevo && r.alta && !r.s2 && (r.ses || 0) + 1 >= 2 && hoy === diaNum(c.creado || 0) && ahora - (r.visto || 0) >= 5 * 60000;
      if (s2) r.s2 = 1;
      r.ses = (r.ses || 0) + 1;
      r.visto = ahora;
      s.retT = ahora;
      // Invitado que paso a cuenta (hereda el personaje): su entrada vieja del
      // indice se borra para no contarlo dos veces como activo.
      const uidViejo = r.u && r.u !== c.uid ? r.u : null;
      r.u = c.uid;
      const nuevoDia = this.retMarcarDia(c, hoy);
      if (this.uidsPrueba.has(c.uid)) return;
      const idx = await this.retIdx();
      const tcViejo = uidViejo && idx[uidViejo] ? idx[uidViejo].tc : null;   // su chat de avisos pasa a la cuenta
      if (uidViejo) delete idx[uidViejo];
      const e = idx[c.uid] || (idx[c.uid] = { v: 0 });
      if (tcViejo && !e.tc && !c.uid.startsWith('tg:')) e.tc = tcViejo;
      // ret:idx solo se escribe si algo cambia (antes, en cada entrada).
      const cambia = !!uidViejo || nuevoDia || e.v !== hoy || e.l !== c.nivel || e.a !== 0;
      // Volvio dentro de las 24 h del aviso: cuenta para su tipo (una vez por aviso).
      const avVuelta = e.at && e.tipo && AVISO_ORDEN.includes(e.tipo) && ahora - e.at <= DIA_MS ? 'avV_' + e.tipo : null;
      const avBorrar = !!e.at;
      if (avBorrar) { delete e.at; delete e.tipo; }
      e.v = hoy; e.l = c.nivel;
      e.a = 0;   // volvio: se reanudan los avisos
      // Primera entrada del dia: su hora, para avisarle a esa hora.
      if (nuevoDia) e.hs = [...(e.hs || []), horaUTC(ahora)].slice(-10);
      if (cambia || avBorrar) await this.retGuardarIdx();
      if (avVuelta) await this.retSumar(hoy, { [avVuelta]: 1 });
      if (nuevo) await this.retSumar(hoy, conSrc(c, c.ret.iab ? { n: 1, niab: 1 } : { n: 1 }));
      if (nuevo && c.ret.camp) { const rd = await this.retDia(hoy); if (rd['n~' + c.ret.camp] || campsDe(rd) < MAX_CAMP_DIA) await this.retSumar(hoy, { ['n~' + c.ret.camp]: 1 }); }
      if (nuevo && c.ret.ad) { const rd = await this.retDia(hoy); if (rd['n^' + c.ret.ad] || adsDe(rd) < MAX_CAMP_DIA) await this.retSumar(hoy, { ['n^' + c.ret.ad]: 1 }); }
      if (nuevo && c.ret.v) { const rd = await this.retDia(hoy); if (rd['n@' + c.ret.v] || versDe(rd) < MAX_VERS_DIA) await this.retSumar(hoy, { ['n@' + c.ret.v]: 1 }); }
      if (s2) {
        const rd = await this.retDia(hoy), campos = conSrc(c, { s2: 1 });
        if (c.ret.ad && rd['n^' + c.ret.ad]) campos['s2^' + c.ret.ad] = 1;
        if (c.ret.v && rd['n@' + c.ret.v]) campos['s2@' + c.ret.v] = 1;
        await this.retSumar(hoy, campos);
      }
      // Sesiones: en memoria y al storage como mucho una vez por minuto.
      if (this._retMin && this._retMin.d !== hoy) await this.retVolcar();
      this._retMin = this._retMin || { d: hoy, min: 0, ses: 0 };
      this._retMin.ses = (this._retMin.ses || 0) + 1;
      if (ahora - (this._retMinT || 0) > 60000) await this.retVolcar();
      if (nuevoDia) await this.retNuevoDia(c, hoy);
    } catch (e) { console.error('[MMO retEntrar]', e); }
  },

  // En cada guardado (periodico y al cerrar la sesion): suma los minutos
  // jugados desde el ultimo guardado y detecta el cambio de dia de quien
  // sigue conectado pasada la medianoche UTC. Es sincrono en lo que toca a c
  // (guardar escribe c justo despues); los agregados van aparte.
  retAlGuardar(s) {
    const c = s.c;
    if (!c || !c.ret || !s.retT) return;
    const ahora = Date.now();
    // Solo hasta 1 min despues de lo ultimo que hizo: una pestaña olvidada
    // abierta no suma los 10 min que tarda en echarla la inactividad.
    const hasta = Math.min(ahora, (s.actT || ahora) + 60000);
    const min = Math.max(0, hasta - s.retT) / 60000;
    s.retT = ahora;
    c.ret.min = Math.round(((c.ret.min || 0) + min) * 100) / 100;
    // Conversions API (meta.js): 3 min jugados, una vez, solo altas que vinieron de un anuncio y aceptaron medir.
    if (c.ret.fbc && c.ret.alta && !c.ret.j3 && c.ret.min >= 3) { c.ret.j3 = 1; metaEvento(this, c, 'Jugo3Min'); }
    c.ret.visto = ahora;
    const hoy = diaNum(ahora);
    const nuevoDia = this.retMarcarDia(c, hoy);
    // Sigue conectado al cambiar el dia de juego (medianoche de Lima): cobra la diaria y
    // ve las tareas nuevas sin reconectar. Lo que cambia en c entra en el put
    // de guardar(), que viene justo despues. Al cerrar no: lo cobra al volver.
    if (nuevoDia && !s.cerrado && this.procesarLogin) {
      const lg = this.procesarLogin(s);
      if (lg) {
        // En pleno combate no se abre la ventana del premio: solo el aviso.
        if (ahora - (s.combateT || 0) < 5000) this.enviar(s, { t: 'toast', ok: true, m: `☀️ ¡Nuevo día! Recompensa diaria (día ${lg.racha}): ${lg.oro ? '+' + lg.oro.toLocaleString('es', { useGrouping: 'always' }) + ' oro' : lg.txt}. Misiones diarias renovadas.` });
        else { this.enviar(s, { t: 'login', ...lg }); this.enviar(s, { t: 'toast', ok: true, m: '☀️ ¡Nuevo día! Misiones diarias renovadas.' }); }
        if (this.infoTareas) this.enviar(s, { t: 'tareas', ...this.infoTareas(c) });
        if (this.revisarLogros) this.revisarLogros(s, true);   // titulos de racha 7/14/21
        if (lg.racha === 2) this.ofrecerAvisoTg(s).catch(() => {});   // «Avísame por Telegram» (web e invitados)
        // Cambio de mes con la sesion abierta: lo alcanzado del pase se cobra ya (antes esperaba a reconectar).
        if (this.infoPase) { const ip = this.infoPase(c); if (this.cobrarPasePendiente && c.pasePend) this.cobrarPasePendiente(s); this.enviar(s, { t: 'pase', pase: c.pasePend ? this.infoPase(c) : ip }); }
        if (this.puntoPase && lg.pase) this.puntoPase(s, lg.pase);   // entrar suma al pase (1 vez al dia)
        this.actualizarYo(s);
      }
    }
    if (this.uidsPrueba.has(c.uid)) return;
    // Evento de temporada: quien llega a 50 de su objeto (el primer titulo),
    // una vez por evento, y aparte si juega en ORIGINS (3D). Para medir si el
    // evento engancha (/mmostats → evento). En un evento anual que repite
    // contador cuenta tambien quien ya traia 50 del año anterior.
    const tpE = this.temporadaAviso();
    if (tpE && (c[tpE.campo] || 0) >= 50 && c.ret.e50 !== tpE.id) {
      c.ret.e50 = tpE.id;
      this.retSumar(hoy, c.en3d ? { e50: 1, e50_3d: 1 } : { e50: 1 }).catch(() => {});
    }
    // Los minutos del dia se juntan en memoria y se escriben como mucho una
    // vez por minuto: escribir el agregado en CADA guardado doblaba las
    // escrituras al storage (que cuentan en el cupo diario del plan gratis).
    if (min >= 0.01) { const p = (this._retMin && this._retMin.d === hoy) ? this._retMin : { d: hoy, min: 0, ses: 0 }; p.min += min; this._retMin = p; }
    (async () => {
      if (this._retMin && (ahora - (this._retMinT || 0) > 60000 || this._retMin.d !== hoy)) await this.retVolcar();
      if (nuevoDia) {
        const idx = await this.retIdx();
        const e = idx[c.uid] || (idx[c.uid] = { v: 0 });
        e.v = hoy; e.l = c.nivel; e.a = 0;
        await this.retGuardarIdx();
        await this.retNuevoDia(c, hoy);
      }
    })().catch(e => console.error('[MMO retAlGuardar]', e));
  },

  // Escribe los minutos pendientes en el agregado del dia.
  async retVolcar() {
    const pend = this._retMin;
    if (!pend) return;
    this._retMin = null; this._retMinT = Date.now();
    await this.retSumar(pend.d, { min: Math.round(pend.min * 100) / 100, ses: pend.ses || 0 });
  },

  // Rutas internas de este modulo (las llama interno() de world.js).
  async internoRetencion(accion, b) {
    await this.retVolcar();
    try { await this.evVolcar(); } catch (e) { console.error('[MMO ev volcar]', e); }
    if (accion === 'stats') return this.retStats();
    if (accion === 'gasto') return this.gastoAnuncios(b || {});
    if (accion === 'recordatorios') return this.recordatorios(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    if (accion === 'avisos') return this.ponerAvisos(b || {});
    if (accion === 'avisoTg') return this.avisoTgUsar(b || {});
    if (accion === 'avisadosHoy') return this.avisadosHoy(b && Number.isInteger(b.hora) ? b.hora : horaUTC());
    return null;
  },

  // ── EMBUDO DE CARGA (beacon /mmo/ev) ──
  // Llega ya validado por worker.js; aqui se vuelve a validar (lista blanca),
  // se limita por IP y por dia y se suma en memoria. Siempre 204.
  async evRecibir(request) {
    const nada = () => new Response(null, { status: 204 });
    try {
      const b = await request.json();
      if (!b || !evValido(b.e, b.j)) return nada();
      const ahora = Date.now(), hoy = diaNum(ahora), h = Math.floor(ahora / 3600000);
      const ip = claveIpEv(request.headers.get('CF-Connecting-IP') || '');
      this._evIp = this._evIp && this._evIp.h === h ? this._evIp : { h, n: new Map() };
      const n = (this._evIp.n.get(ip) || 0) + 1;
      if (n > (ip.includes(':') ? EV_POR_IP_HORA : EV_POR_IPV4_HORA)) return nada();
      this._evIp.n.set(ip, n);
      this._evHoy = this._evHoy && this._evHoy.d === hoy ? this._evHoy : { d: hoy, n: 0 };
      if (++this._evHoy.n > EV_MAX_DIA) return nada();
      // Cambio de dia con algo pendiente: lo de ayer se escribe en su dia.
      if (this._evPend && this._evPend.d !== hoy) await this.evVolcar();
      const p = this._evPend || (this._evPend = { d: hoy, k: {} });
      const clave = `${b.j}|${b.e}|${srcDe(b.org)}|${b.movil ? 'm' : 'p'}`;
      if (!p.k[clave] && Object.keys(p.k).length >= EV_MAX_CLAVES) return nada();
      const a = p.k[clave] || (p.k[clave] = [0, 0, 0, 0, 0, 0, 0, 0]);
      a[0]++;
      const ms = Number(b.ms);
      if (Number.isFinite(ms) && ms >= 0) { let i = EV_TRAMOS.findIndex(t => ms <= t); if (i < 0) i = EV_TRAMOS.length; a[1 + i]++; }
      if (ahora - (this._evT || 0) > 60000) await this.evVolcar();
      else if (!this._evTimer) this._evTimer = setTimeout(() => { this._evTimer = null; this.evVolcar().catch(e => console.error('[MMO ev volcar]', e)); }, Math.max(1000, 60000 - (ahora - (this._evT || 0))));
    } catch (e) { console.error('[MMO ev]', e); }
    return nada();
  },
  // Uno detras de otro: dos volcados a la vez (temporizador, /mmostats, alarma)
  // leian el mismo ev:dia y el segundo pisaba lo que sumo el primero.
  evVolcar() {
    const p = (this._evVolP || Promise.resolve()).catch(() => {}).then(() => this.evVolcarUno());
    this._evVolP = p;
    return p;
  },
  async evVolcarUno() {
    const p = this._evPend;
    if (!p) return;
    this._evPend = null; this._evT = Date.now();
    const k = 'ev:dia:' + diaISO(p.d);
    try {
      const g = (await this.state.storage.get(k)) || {};
      for (const c in p.k) {
        const a = g[c] || (g[c] = [0, 0, 0, 0, 0, 0, 0, 0]);
        p.k[c].forEach((v, i) => { a[i] = (a[i] || 0) + v; });
      }
      await this.state.storage.put(k, g);
    } catch (e) {
      // No se pudo escribir: lo contado vuelve a lo pendiente (si es del mismo dia).
      const q = this._evPend;
      if (!q) this._evPend = p;
      else if (q.d === p.d) for (const c in p.k) { const a = q.k[c] || (q.k[c] = [0, 0, 0, 0, 0, 0, 0, 0]); p.k[c].forEach((v, i) => { a[i] = (a[i] || 0) + v; }); }
      throw e;
    }
  },
  // Resumen de los ultimos 'dias' por origen: sesiones por paso, y del clic al
  // primer movimiento en el movil cuantas tardaron 20 s o menos y la mediana (por tramo).
  async evStats(dias = 7) {
    const hoy = diaNum(), por = {};
    for (let i = 0; i < dias; i++) {
      const g = (await this.state.storage.get('ev:dia:' + diaISO(hoy - i))) || {};
      for (const c in g) {
        const [, e, org, dev] = c.split('|');
        const o = por[org] || (por[org] = { pasos: {}, moverMovil: [0, 0, 0, 0, 0, 0, 0] });
        o.pasos[e] = (o.pasos[e] || 0) + (g[c][0] || 0);
        if (e === 'mover' && dev === 'm') for (let t = 0; t < 7; t++) o.moverMovil[t] += g[c][1 + t] || 0;
        // 1er golpe y 1ra caza: tramos de todos los equipos (movil y PC) para su mediana.
        if (e === 'golpe1' || e === 'caza1') { const tt = o[e + 'T'] || (o[e + 'T'] = [0, 0, 0, 0, 0, 0, 0]); for (let t = 0; t < 7; t++) tt[t] += g[c][1 + t] || 0; }
      }
    }
    const nombres = ['≤2 s', '≤5 s', '≤10 s', '≤20 s', '≤40 s', '≤90 s', '>90 s'];
    for (const org in por) {
      const b = por[org].moverMovil, tot = b.reduce((x, y) => x + y, 0);
      let acum = 0, med = null;
      for (let t = 0; t < 7 && med === null; t++) { acum += b[t]; if (acum * 2 >= tot && tot) med = nombres[t]; }
      por[org].movil20 = tot ? { pct: pct(b[0] + b[1] + b[2] + b[3], tot), base: tot, mediana: med } : null;
      delete por[org].moverMovil;
      // golpe1Med / caza1Med: mediana (tramo en segundos) desde el clic en entrar; null sin datos.
      for (const e of ['golpe1', 'caza1']) {
        const tb = por[org][e + 'T'] || [], tt = tb.reduce((x, y) => x + y, 0);
        let ac = 0, md = null;
        for (let t = 0; t < 7 && md === null; t++) { ac += tb[t] || 0; if (ac * 2 >= tt && tt) md = nombres[t]; }
        por[org][e + 'Med'] = md;
        delete por[org][e + 'T'];
      }
    }
    return { dias, por };
  },

  // ── ESTADISTICAS (/mmostats) ──
  async retStats() {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const activos = { hoy: 0, d7: 0, d30: 0 };
    const tipos = { tg: 0, web: 0, inv: 0 };
    const tramos = {};
    for (const uid in idx) {
      const e = idx[uid];
      if (!e.v || this.uidsPrueba.has(uid)) continue;
      const hace = hoy - e.v;
      if (hace === 0) activos.hoy++;
      if (hace < 7) activos.d7++;
      if (hace < 30) {
        activos.d30++;
        const t = uid.split(':')[0];
        if (t in tipos) tipos[t]++;
        const de = Math.floor((e.l || 1) / 10) * 10;
        const k = de === 0 ? '1-9' : `${de}-${de + 9}`;
        tramos[k] = (tramos[k] || 0) + 1;
      }
    }
    const dias = [];
    for (let i = 0; i <= 60; i++) dias.push({ n: hoy - i, r: await this.retDia(hoy - i) });
    const altas = dias.slice(0, 14).map(x => ({ dia: diaISO(x.n), n: x.r.n, activos: x.r.a }));
    // Un dato D-k solo existe cuando ya llego el dia alta+k (si no, null).
    const cohortes = dias.slice(0, 35).filter(x => x.r.n > 0).map(x => {
      const hace = hoy - x.n;
      return { dia: diaISO(x.n), n: x.r.n, d1: hace >= 1 ? x.r.r1 : null, d2: hace >= 2 && x.n >= INI_D23 ? x.r.r2 || 0 : null, d3: hace >= 3 && x.n >= INI_D23 ? x.r.r3 || 0 : null, d7: hace >= 7 ? x.r.r7 : null, d8: hace >= 8 ? x.r.r8 || 0 : null, d14: hace >= 14 ? x.r.r14 || 0 : null, d30: hace >= 30 ? x.r.r30 : null };
    });
    // Retencion total de las ultimas 30 cohortes cuyo dia alta+k ya termino.
    const retencion = {};
    for (const k of [1, 2, 3, 7, 8, 14, 30]) {
      let base = 0, vuelven = 0;
      for (const x of dias) {
        const hace = hoy - x.n;
        if (hace > k && hace <= k + 30 && (k > 3 || k < 2 || x.n >= INI_D23)) { base += x.r.n; vuelven += x.r['r' + k] || 0; }
      }
      retencion['d' + k] = { pct: pct(vuelven, base), vuelven, base };
    }
    let ses = 0, min = 0;
    for (const x of dias.slice(0, 7)) { ses += x.r.ses || 0; min += x.r.min || 0; }
    // Embudo de las altas de los ultimos 14 dias.
    const embudo = { n: 0, c1: 0, m1: 0, n5: 0, n10: 0, cl: 0, ex1: 0 };   // ex1: primera expedicion recogida
    for (const x of dias.slice(0, 14)) for (const k in embudo) embudo[k] += x.r[k] || 0;
    // Altas del navegador interno de Facebook/Instagram: cuantas en 14 dias y su D1
    // (ultimas 30 cohortes con el dia ya cumplido), para compararlo con el D1 general.
    const iab = { n: 0, d1: null };
    for (const x of dias.slice(0, 14)) iab.n += x.r.niab || 0;
    { let base = 0, vuelven = 0; for (const x of dias) { const hace = hoy - x.n; if (hace > 1 && hace <= 31) { base += x.r.niab || 0; vuelven += x.r.r1iab || 0; } } iab.d1 = { pct: pct(vuelven, base), vuelven, base }; }
    embudo.iab = iab;
    // «Avísame por Telegram» (web e invitados) activados en 14 dias.
    embudo.avisoTgOk = 0;
    for (const x of dias.slice(0, 14)) embudo.avisoTgOk += x.r.avisoTgOk || 0;
    // Avisos diarios de los ultimos 14 dias por el tipo de su primera linea:
    // enviados y cuantos volvieron en 24 h (la vuelta se anota el dia que vuelve).
    const avisos = {};
    for (const t of AVISO_ORDEN) {
      let env = 0, vuelven = 0;
      for (const x of dias.slice(0, 14)) { env += x.r['avE_' + t] || 0; vuelven += x.r['avV_' + t] || 0; }
      if (env || vuelven) avisos[t] = { env, vuelven, pct: pct(vuelven, env) };
    }
    // Lo mismo por origen (origen.js): altas, embudo de 14 dias y D1/D7 de las
    // ultimas 30 cohortes con el dia ya cumplido. Solo los origenes con altas.
    const origenes = {};
    for (const o of ORIGENES) {
      const e = { n: 0, c1: 0, m1: 0, n5: 0 };
      for (const x of dias.slice(0, 14)) for (const k in e) e[k] += x.r[k + '_' + o] || 0;
      for (const k of [1, 2, 3, 7]) {
        let base = 0, vuelven = 0;
        for (const x of dias) { const hace = hoy - x.n; if (hace > k && hace <= k + 30 && (k > 3 || k < 2 || x.n >= INI_D23)) { base += x.r['n_' + o] || 0; vuelven += x.r['r' + k + '_' + o] || 0; } }
        e['d' + k] = { pct: pct(vuelven, base), vuelven, base };
      }
      if (e.n || e.d1.base) origenes[o] = e;
    }
    let carga = null;
    try { carga = await this.evStats(7); } catch (er) { console.error('[MMO evStats]', er); }
    // Invitaciones de los ultimos 14 dias (por dia en que pasaron).
    const invitaciones = { refLlega: 0, refCuenta: 0, refPagado: 0, n5r: 0, n10r: 0 };
    for (const x of dias.slice(0, 14)) for (const k in invitaciones) invitaciones[k] += x.r[k] || 0;
    // Nv 10 de los referidos frente al resto de altas (mismas cohortes de 14 dias).
    invitaciones.n10pct = pct(invitaciones.n10r, invitaciones.refLlega);
    invitaciones.n10restoPct = pct(Math.max(0, embudo.n10 - invitaciones.n10r), Math.max(0, embudo.n - invitaciones.refLlega));
    // El evento de temporada en curso (o el ultimo, si acabo hace menos de 60
    // dias): altas de sus dias y su D7, y cuantos llegaron a 50 de su objeto.
    const ahoraE = Date.now();
    const tpS = temporadaDe(ahoraE) || TEMPORADAS.filter(x => x.fin <= ahoraE && x.fin > ahoraE - 60 * DIA_MS).sort((a, b) => b.fin - a.fin)[0];
    let evento = null;
    if (tpS) {
      const ev = { id: tpS.id, nombre: tpS.nombre, altas: 0, d7: 0, d7base: 0, llegan50: 0, llegan50_3d: 0 };
      for (const x of dias) {
        if (x.n < diaNum(tpS.ini) || x.n >= diaNum(tpS.fin - 1) + 1) continue;
        ev.altas += x.r.n || 0;
        ev.llegan50 += x.r.e50 || 0; ev.llegan50_3d += x.r.e50_3d || 0;
        if (hoy - x.n >= 7) { ev.d7base += x.r.n || 0; ev.d7 += x.r.r7 || 0; }
      }
      evento = { ...ev, d7pct: pct(ev.d7, ev.d7base) };
    }
    let anuncios = null;
    try { anuncios = await this.retAnuncios(dias, hoy); } catch (er) { console.error('[MMO anuncios]', er); }
    let versiones = [];
    try { versiones = this.retVersiones(dias, hoy); } catch (er) { console.error('[MMO versiones]', er); }
    // «Volvió hoy» de las altas de 14 dias (s2 se suma el mismo dia del alta).
    embudo.s2 = 0;
    for (const x of dias.slice(0, 14)) embudo.s2 += x.r.s2 || 0;
    const ranking = (await (this.rankingLeer ? this.rankingLeer() : this.state.storage.get('ranking').then(r => r || []))).filter(x => !this.uidsPrueba.has(x.uid));
    return {
      ok: true, hoy: diaISO(hoy), activos, tipos30: tipos, niveles30: tramos, altas, cohortes, retencion, evento,
      sesion: { sesiones7: ses, minutos7: Math.round(min), media: ses ? Math.round(min / ses * 10) / 10 : 0 }, embudo, invitaciones, origenes, carga, anuncios, versiones, avisos,
      top: ranking.slice(0, 10).map(x => ({ n: x.n, lv: x.lv })),
      online: this.contarOnline(),
      salud: this.infoSalud ? this.infoSalud() : null,   // cupo de escrituras y lag (salud.js)
    };
  },

  // ── AVISOS DE VUELTA POR TELEGRAM ──
  // Envio y espera separados para que las pruebas los cambien (sin red ni
  // pausas reales).
  async tgEnviar(metodo, cuerpo) {
    const env = getEnv({ env: this.env });
    if (!env.BOT_TOKEN) return { ok: false, description: 'sin token' };
    return tg(env.BOT_TOKEN, metodo, cuerpo);
  },
  dormir(ms) { return new Promise(r => setTimeout(r, ms)); },
  // El evento de temporada activo (aparte para que las pruebas lo fijen).
  temporadaAviso() { return temporadaDe(); },

  // idx: para respetar el /avisos off (o el bloqueo) del chat de un jugador web
  // (e.tc) y no mandarle dos avisos el mismo dia si tambien juega por Telegram.
  puedeAvisar(uid, e, hoy, idx) {
    if (!e || e.off || e.bloq || e.adw === hoy) return false;   // adw: su chat ya recibio hoy el aviso de su personaje web
    if (/^tg:/.test(uid) && !e.si) return false;   // solo con consentimiento explicito (tarjeta, /avisos on, Avisame por Telegram)
    if (!/^tg:\d{1,15}$/.test(uid)) {
      if (uid.startsWith('tg:') || !/^\d{1,15}$/.test(String(e.tc || ''))) return false;
      const t = idx && idx['tg:' + e.tc];
      if (t && (t.off || t.bloq || t.ad === hoy)) return false;
    }
    // Un evento nuevo ya NO salta la pausa ni amplia la ventana: quien ignoro
    // los avisos o se fue hace mucho no recibe mensajes que no pidio.
    return e.v > 0 && e.v < hoy && hoy - e.v <= VENTANA_AVISO
      && e.ad !== hoy && (e.a || 0) < AVISOS_SIN_RESPUESTA
      && !this.porUid.has(uid) && !this.uidsPrueba.has(uid);
  },

  // Avisa a quien le toca a esta hora (UTC). Devuelve tambien a quien no
  // debe escribir hoy el recordatorio del arcade (17:00): los ya avisados
  // hoy y los que se avisaran mas tarde, asi cada uno recibe un solo mensaje.
  async recordatorios(hora = horaUTC()) {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const res = { ok: true, candidatos: 0, enviados: 0, bloqueados: 0, fallidos: 0, ids: [], callar: [] };
    // De paso se poda el indice (quien pidio no recibir avisos o bloqueo al
    // bot se queda, para recordarlo).
    for (const uid of Object.keys(idx)) {
      const e = idx[uid];
      if (!e.off && !e.bloq && (e.v || 0) < hoy - OLVIDAR_DIAS) delete idx[uid];
    }
    let n = 0;
    // Como mucho MAX_ENVIOS por llamada: cada mensaje a Telegram es una
    // subpeticion y el plan gratis permite ~50 por invocacion. El cron llama
    // varias veces; primero van los que hace mas que no reciben aviso.
    const lista = Object.keys(idx).filter(u => this.puedeAvisar(u, idx[u], hoy, idx) && horaHabitual(idx[u]) === hora).sort((a, b) => (idx[a].ad || 0) - (idx[b].ad || 0));
    res.quedan = Math.max(0, lista.length - MAX_ENVIOS);
    const porTipo = {};   // avE_<tipo>: enviados por tipo (una sola suma al final)
    for (const uid of lista.slice(0, MAX_ENVIOS)) {
      const c = await this.state.storage.get('c:' + uid);
      const e = idx[uid];
      // Pudo entrar mientras se leia su personaje.
      if (!c || !this.puedeAvisar(uid, e, hoy, idx)) continue;
      res.candidatos++;
      if (n > 0 && n % POR_SEGUNDO === 0) { await this.retGuardarIdx(); await this.dormir(1100); }
      n++;
      const info = {};
      info.novVisto = e.nov || 0;
      const texto = await this.mensajeAviso(c, hoy, info);
      // Se marca antes de enviar: aunque el envio tarde, nada lo vuelve a
      // elegir hoy. Si falla por algo pasajero se deshace.
      const antes = { ad: e.ad, a: e.a, ev: e.ev };
      e.ad = hoy; e.a = (e.a || 0) + 1;
      const tpA = this.temporadaAviso();
      if (tpA) e.ev = tpA.id;   // un solo aviso extra por evento
      let r = null;
      // Jugador web o invitado: su chat (e.tc) y un enlace normal a su version
      // (web_app lo meteria con su cuenta de Telegram, que es otro personaje).
      const chat = uid.startsWith('tg:') ? uid.slice(3) : String(e.tc);
      const volver = uid.startsWith('tg:') ? { text: '🌍 Volver al mundo', web_app: { url: c.en3d ? MUNDO_URL : MMO_URL } } : { text: '🌍 Volver al mundo', url: c.en3d ? MUNDO_URL : MMO_URL };
      try {
        r = await this.tgEnviar('sendMessage', {
          chat_id: chat, text: texto, disable_web_page_preview: true,
          reply_markup: { inline_keyboard: [
            [volver],
            [{ text: '🔕 No quiero más avisos', callback_data: 'mmoavisos:off' }],
          ] },
        });
      } catch (err) { r = null; }
      if (r && r.ok) {
        res.enviados++; res.ids.push(chat);
        if (info.nov) e.nov = info.nov;   // esa novedad ya no se repite
        if (!uid.startsWith('tg:') && idx['tg:' + chat]) idx['tg:' + chat].adw = hoy;   // su personaje de Telegram no repite hoy
        // Tipo de su primera linea y hora del envio: al volver en 24 h cuenta avV_<tipo>.
        if (AVISO_ORDEN.includes(info.tipo)) { e.tipo = info.tipo; e.at = Date.now(); porTipo['avE_' + info.tipo] = (porTipo['avE_' + info.tipo] || 0) + 1; }
      }
      else if (r && r.error_code === 403) {
        // Bloqueo al bot (o borro su cuenta / nunca abrio el chat): no se le
        // vuelve a escribir hasta que el mismo pida /avisos on.
        e.bloq = 1; e.ad = antes.ad; e.a = antes.a; e.ev = antes.ev;
        res.bloqueados++;
      } else {
        e.ad = antes.ad; e.a = antes.a; e.ev = antes.ev;
        res.fallidos++;
        if (r && r.error_code === 429) await this.dormir(Math.min(30, (r.parameters && r.parameters.retry_after) || 1) * 1000);
      }
    }
    await this.retGuardarIdx();
    if (Object.keys(porTipo).length) { try { await this.retSumar(hoy, porTipo); } catch (er) { console.error('[MMO avisos tipo]', er); } }
    // A todo jugador del MMO/3D solo lo rigen estas reglas (pausa, dia
    // jugado, 14 dias sin entrar): el cron del arcade no le escribe nunca.
    res.callar = Object.keys(idx).filter(u => u.startsWith('tg:') || idx[u].tc).map(u => u.startsWith('tg:') ? u.slice(3) : String(idx[u].tc));
    res.hoy = Object.keys(idx).filter(u => (u.startsWith('tg:') || idx[u].tc) && (idx[u].ad === hoy || (this.puedeAvisar(u, idx[u], hoy, idx) && horaLima(horaHabitual(idx[u])) > horaLima(hora)))).map(u => u.startsWith('tg:') ? u.slice(3) : String(idx[u].tc));
    // Lista de permitidos del recordatorio del arcade: solo quien dio su
    // consentimiento explicito (e.si) y no lo retiro ni bloqueo al bot.
    res.permitidos = Object.keys(idx).filter(u => u.startsWith('tg:') && idx[u].si && !idx[u].off && !idx[u].bloq).map(u => u.slice(3));
    return res;
  },

  // Solo la lista (sin enviar nada): a quien el recordatorio del arcade no
  // debe escribir hoy. El cron la pide si fallo 'recordatorios'.
  async avisadosHoy(hora) {
    const hoy = diaNum();
    const idx = await this.retIdx();
    const tg = Object.keys(idx).filter(u => u.startsWith('tg:'));
    const conTc = Object.keys(idx).filter(u => !u.startsWith('tg:') && idx[u].tc);
    return {
      ok: true,
      callar: [...tg.map(u => u.slice(3)), ...conTc.map(u => String(idx[u].tc))],
      hoy: [...tg, ...conTc].filter(u => idx[u].ad === hoy || (this.puedeAvisar(u, idx[u], hoy, idx) && horaLima(horaHabitual(idx[u])) > horaLima(hora))).map(u => u.startsWith('tg:') ? u.slice(3) : String(idx[u].tc)),
      permitidos: Object.keys(idx).filter(u => u.startsWith('tg:') && idx[u].si && !idx[u].off && !idx[u].bloq).map(u => u.slice(3)),
    };
  },

  // Alarma del Durable Object, cada hora en punto: los avisos de quien
  // tiene su hora habitual en otra hora que las 17:00 (esa la hace el cron).
  // Una tanda por hora (el limite de subpeticiones por invocacion).
  async alarm() {
    // Recordatorios de la mañana y de la noche que el jugador eligio (rituales.js). Van antes: quien
    // recibe el suyo queda marcado (e.ad) y hoy ya no recibe ademas el aviso de vuelta.
    try { if (this.avisosRitual) await this.avisosRitual(); } catch (e) { console.error('[MMO avisos ritual]', e); }
    try {
      const h = horaUTC();
      if (h !== HORA_DEFECTO) {
        const r = await this.recordatorios(h);
        if (r.enviados || r.bloqueados) console.log('[MMO avisos ' + h + 'h]', { enviados: r.enviados, bloqueados: r.bloqueados, fallidos: r.fallidos, quedan: r.quedan });
      }
    } catch (e) { console.error('[MMO alarma]', e); }
    // Lo pendiente del embudo de carga (por si nadie mas lo volco).
    try { await this.evVolcar(); } catch (e) { console.error('[MMO ev volcar]', e); }
    // Copia de seguridad diaria (copias.js).
    try { if (this.copiaDiariaSiToca) await this.copiaDiariaSiToca(); } catch (e) { console.error('[MMO copia diaria]', e); }
    // Recordatorios al dueño de pedidos pagados sin entregar (world.js). Esta
    // alarma tambien salta antes de la hora en punto cuando uno toca; lo de
    // arriba ya no repite nada (avisos y copia van marcados por dia).
    try { if (this.recordarPedidos) await this.recordarPedidos(); } catch (e) { console.error('[MMO recordar pedidos]', e); }
    await this.programarAlarma();
  },
  async programarAlarma() {
    const st = this.state.storage;
    if (!st.setAlarm) return;
    let t = (Math.floor(Date.now() / 3600000) + 1) * 3600000 + 30000;
    const p = this.proximoRecordatorioPedido ? this.proximoRecordatorioPedido() : 0;
    if (p && p < t) t = Math.max(p, Date.now() + 5000);
    try { await st.setAlarm(t); } catch (e) { console.error('[MMO setAlarm]', e); }
  },
  async asegurarAlarma() {
    const st = this.state.storage;
    if (!st.getAlarm) return;
    try { if (!(await st.getAlarm())) await this.programarAlarma(); } catch (e) { console.error('[MMO getAlarm]', e); }
  },

  // El texto se arma con lo que ese jugador tiene pendiente HOY, de lo mas
  // urgente (perder la racha) a lo mas general (cuanto falta para subir).
  // Texto plano, sin Markdown: el nombre lo eligio el jugador.
  // Las lineas se ordenan por lo que mas le importa a cada uno (AVISO_ORDEN):
  // evento, lo social (sus amigos que ya jugaron hoy, su hermandad), su racha,
  // lo que le falta para su proxima skin y despues lo demas. Solo datos que ya
  // estan en memoria (el indice, la hermandad en cache, el propio c). info.tipo
  // = el tipo de la primera linea (para medir la vuelta en 24 h por tipo).
  async mensajeAviso(c, hoy, info) {
    const lineas = [];
    const add = (tipo, t) => lineas.push({ tipo, t });
    // Evento de temporada: primero, para que siempre entre en las 3 lineas.
    const tp = this.temporadaAviso();
    if (tp) {
      const n = c[tp.campo] || 0;
      const tit = n < 50 ? `: con 50 y 200 ganas los títulos «${tp.titulos[0]}» y «${tp.titulos[1]}»` : n < 200 ? `: con 200 ganas el título «${tp.titulos[1]}»` : '';
      add('ev', `${tp.emoji} ¡${tp.nombre}! Hasta el ${tp.hasta} los monstruos sueltan ${tp.cosas}. Llevas ${fmt(n)}${tit}.`);
    }
    // Sus amigos (c.contactos) que ya jugaron hoy, cruzando con el indice (en memoria).
    let idx = null;
    try { idx = await this.retIdx(); } catch (e) {}
    if (idx && Array.isArray(c.contactos)) {
      const nombres = c.contactos.filter(a => a && a.u !== c.uid && a.n && idx[a.u] && idx[a.u].v === hoy).map(a => String(a.n).slice(0, 20));
      if (nombres.length) {
        const ver = nombres.slice(0, 2).join(' y ') + (nombres.length > 2 ? ` y ${nombres.length - 2} más` : '');
        add('soc', `👋 Hoy ya ${nombres.length === 1 ? 'jugó' : 'jugaron'} ${ver}. ¡Entra tú también!`);
      }
    }
    // Expedicion (expediciones.js) que ya volvio y espera a que la recoja.
    if (c.exped && c.exped.fin <= Date.now()) add('exped', `🧭 Tu expedición de ${c.exped.h < 1 ? Math.round(c.exped.h * 60) + ' min' : c.exped.h + ' h'} ya volvió con oro y materiales: recógela en ${c.en3d ? 'la fila 🧭 de tus misiones' : 'el registro de misiones'}.`);
    if (horaFelizActiva()) add('feliz', '⚡ Ahora mismo es la Hora Feliz: +50% de experiencia por caza hasta las 21:00 (hora de Perú).');
    const L = c.login;
    // La racha no tiene tope (semanas de 7 dias): racha%7===0 = semana cumplida,
    // y mañana empieza la siguiente con el oro x1,25/x1,5.
    if (L && L.d === diaISO(hoy - 1) && L.racha >= 1) {
      const sig = L.racha + 1, pr = premioRacha(sig);
      const premio = pr.oro ? `${fmt(Math.round(pr.oro * multLogin(c.nivel) * multSemanaRacha(sig)))} oro${pr.item !== undefined ? ' + objeto ÉPICO' : ''}` : pr.txt;
      // Aviso en positivo (lo que gana hoy), sin amenazas.
      const semTxt = L.racha % 7 === 0 ? `¡cumpliste la semana ${semanaRacha(L.racha)}! Empiezas la semana ${semanaRacha(sig)}${semanaRacha(sig) <= 3 ? ', con más oro' : ''}` : `día ${diaRacha(sig)} de la semana ${semanaRacha(sig)}`;
      add('racha', `🔥 Llevas ${L.racha} ${L.racha === 1 ? 'día seguido' : 'días seguidos'}: hoy te espera ${premio} (${semTxt}).`);
    } else if (L && L.d === diaISO(hoy - 2) && L.racha > 2) {
      // Falto ayer: si entra hoy solo retrocede (o la conserva por el margen de 30 h).
      // Igual que procesarLogin (world.js): semana cumplida (7, 14...) pasa a la siguiente.
      const baja = L.racha >= 7 && L.racha % 7 === 0 ? L.racha + 1 : L.racha >= 8 ? (semanaRacha(L.racha) - 1) * 7 + 1 : L.racha - 1;
      // En positivo: el dia en que sigue si entra hoy (con 🧿 sigue como si no hubiera faltado).
      // Si falta 2+ dias vuelve al inicio de su semana (world.js), no al dia 1 desde la semana 2.
      const conAmu = baja <= L.racha && (L.amu || 0) > 0;
      const diaSig = baja > L.racha ? baja : conAmu ? L.racha + 1 : baja;
      const nota = baja > L.racha ? ' (no pierdes la semana cumplida)' : conAmu ? ' (tu protector 🧿 la cuida)' : L.racha >= 8 ? ' (tus semanas cumplidas están a salvo)' : '';
      add('racha', `🧿 Tu racha te espera: entra hoy y sigue en el día ${diaRacha(diaSig)} de la semana ${semanaRacha(diaSig)}${nota}.`);
    }
    const g = this.grupos && [...this.grupos.values()].find(x => x.uids.includes(c.uid));
    const enGrupo = g ? g.uids.filter(u => u !== c.uid && this.porUid.has(u)).length : 0;
    if (enGrupo) add('soc', `👥 Tu grupo te espera: ${enGrupo} ${enGrupo === 1 ? 'compañero está conectado' : 'compañeros están conectados'} ahora.`);
    let h = null;
    try { h = c.herm ? await this.hermandad(c.herm) : null; } catch (e) {}
    const enHerm = h && h.miembros ? Object.keys(h.miembros).filter(u => u !== c.uid && this.porUid.has(u)).length : 0;
    if (enHerm) add('soc', `🛡️ ${enHerm} de tu hermandad «${h.nombre}» ${enHerm === 1 ? 'está conectado' : 'están conectados'} ahora.`);
    // Gesta semanal de su hermandad (hermandades.js): cuanto le falta al siguiente nivel.
    else if (h && h.gesta && h.gesta.sem === semanaUTC() && h.gesta.p > 0) {
      const p = h.gesta.p, i = GESTA_UMBRALES.findIndex(u => p < u);
      if (i >= 0) add('soc', `🛡️ Tu hermandad «${h.nombre}» va ${fmt(p)}/${fmt(GESTA_UMBRALES[i])} en la gesta semanal: tu ayuda la acerca al nivel ${GESTA_NOMBRES[i]}.`);
    }
    // Coleccion: la skin de oro mas barata que aun no tiene (con el descuento de evento).
    const mias = new Set(c.skins || ['comun']);
    const sk = Object.keys(SKINS).map(id => ({ id, p: precioOro('skin', id) })).filter(x => typeof x.p === 'number' && x.p > 0 && !mias.has(x.id)).sort((a, b) => a.p - b.p)[0];
    const faltaSk = sk ? sk.p - Math.floor(c.oro || 0) : 0;
    // Solo si ya junto al menos la cuarta parte (si no, no motiva: va lo demas).
    if (sk && faltaSk <= sk.p * 0.75) {
      const falta = faltaSk;
      add('col', falta > 0 ? `👕 Te faltan ${fmt(falta)} de oro para la skin «${SKINS[sk.id].nombre}».` : `👕 ¡Ya te alcanza el oro para la skin «${SKINS[sk.id].nombre}»! Está en la tienda.`);
    }
    if (c.en3d) {
      // ORIGINS no tiene la mazmorra 2D: se le recuerda la Cueva de los Goblins (Nv 5+, 3 cofres epicos al dia; cueva3d.js c.cuevaDia).
      const hechas = c.cuevaDia && c.cuevaDia.d === hoyUTC() ? c.cuevaDia.n : 0;
      if (c.nivel >= 5 && hechas < 3) add('mazm', '⛏ Te quedan ' + (3 - hechas) + ' cofres épicos hoy en la Cueva de los Goblins (portal del pueblo).');
    } else if (c.nivel >= NIVEL_MAZMORRA) {
      const pr = premioMazmorraDia(c.nivel);
      add('mazm', `🏰 El premio diario de mazmorra está disponible: +${fmt(pr.xp)} XP, +${fmt(pr.oro)} oro y un objeto ÉPICO.`);
    }
    // Torre del Duende: si esta semana aun no subio (su cofre cada 5 pisos espera).
    if (c.nivel >= TORRE.nv && (!c.torre || c.torre.sem !== semanaUTC() || !c.torre.max)) add('torre', '🗼 Esta semana aún no subiste la Torre del Duende: cada 5 pisos nuevos, un cofre con oro y equipo.');
    const pd = premioDiaria(c.nivel);
    add('diaria', `🎯 ${DIARIA.nombre} sin cobrar: +${fmt(pd.xp)} XP, +${fmt(pd.oro)} oro y ${pd.pocion} pociones.`);
    if (c.nivel < NIVEL_MAX) {
      const falta = Math.max(1, xpParaSubir(c.nivel) - (c.xp || 0));
      const hab = c.clase ? HABS.filter(x => x.clase === c.clase && x.nv > c.nivel).sort((a, b) => a.nv - b.nv)[0] : null;
      let t = `📈 Te faltan ${fmt(falta)} XP para el nivel ${c.nivel + 1}`;
      if (hab) t += hab.nv === c.nivel + 1 ? `, donde aprendes ${hab.nombre}.` : ` (en el ${hab.nv} aprendes ${hab.nombre}).`;
      else if (!c.clase) t += `. Aún no eliges clase: ${Object.values(CLASES).map(x => x.nombre).join(', ')}.`;
      else t += '.';
      add('nivel', t);
    }
    // Orden estable: dentro de cada tipo se respeta el orden de arriba. Una sola
    // linea por tipo (dos sociales no dejan fuera la racha).
    const orden = t => { const i = AVISO_ORDEN.indexOf(t); return i < 0 ? AVISO_ORDEN.length : i; };
    // Novedad del juego (NOVEDADES[0] de data.js): la de menor prioridad, solo
    // si queda sitio (menos de 3 tipos) y nunca sola; una vez por novedad.
    const nv = NOVEDADES && NOVEDADES[0];
    if (nv && lineas.length && new Set(lineas.map(x => x.tipo)).size < 3 && nv.n > ((info && info.novVisto) || 0) && (c.en3d || !nv.solo3d)) {
      const tn = String(nv.gancho || (nv.items && nv.items[0]) || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
      const tn90 = tn.length > 90 ? tn.slice(0, 89).replace(/\s+\S*$/, '') + '…' : tn;
      if (tn90 && !/\bSOL\b|\$DUENDE|\bTON\b|mTON|wallet|solana|phantom|solflare|pago|precio|yape/i.test(tn)) add('nov', '✨ Novedad: ' + tn90);
    }
    const vistos = new Set();
    const top = lineas.map((x, i) => ({ ...x, i })).sort((a, b) => orden(a.tipo) - orden(b.tipo) || a.i - b.i).filter(x => !vistos.has(x.tipo) && vistos.add(x.tipo)).slice(0, 3);
    if (info && top[0]) info.tipo = top[0].tipo;
    if (info && top.some(x => x.tipo === 'nov')) info.nov = nv.n;
    return `🧌 ¡${c.nombre}, el Pueblo Duende te extraña!\n\n${top.map(x => x.t).join('\n\n')}`;
  },

  // ── «AVÍSAME POR TELEGRAM» (web e invitados) ──
  // Se ofrece con el codigo ya hecho (el boton es un enlace normal: el movil no
  // lo bloquea como ventana emergente) al cobrar el dia 2 de la racha o al
  // entregar la mision 1; pedido = el jugador pidio otro ({t:'avisoTgCod'}).
  // Nunca se escribe a nadie desde aqui: el chat se abre solo si el jugador
  // pulsa el enlace e inicia el bot.
  async ofrecerAvisoTg(s, pedido) {
    const c = s && s.c;
    if (!c || s.cerrado) return;
    if (!pedido && (c.nivel || 1) < AVISO_TG_NV) return;   // a un novato no: se la ofrece avisoTgSubio al llegar al nivel
    const yoAuth = s.uidAuth || c.uid;
    if (c.uid.startsWith('tg:') || String(yoAuth).startsWith('tg:') || this.uidsPrueba.has(c.uid)) return;
    const ahora = Date.now();
    if (pedido && ahora - (s.avTgT || 0) < 15000) return;   // un codigo cada 15 s por conexion
    s.avTgT = ahora;
    let e = null;
    try { e = (await this.retIdx())[c.uid]; } catch (er) {}
    if (e && e.tc && !pedido) return;   // ya recibe avisos
    if (s.cerrado || s.c !== c) return;
    const m = this.avCods || (this.avCods = new Map());
    for (const [k, x] of m) if (x.uid === c.uid || x.exp < ahora) m.delete(k);
    if (m.size > 5000) return;   // tope de memoria (una oleada de invitados)
    let cod;
    do {
      const r = crypto.getRandomValues(new Uint8Array(10));
      cod = Array.from(r, x => AV_LETRAS[x % AV_LETRAS.length]).join('');
    } while (m.has(cod));
    m.set(cod, { uid: c.uid, exp: ahora + AVISO_TG_MS });
    this.enviar(s, { t: 'avisoTg', cod, url: 'https://t.me/duendequest_bot?start=av_' + cod, oro: c.avTgOro ? 0 : AVISO_TG_ORO, ya: !!(e && e.tc), ms: AVISO_TG_MS, pedido: !!pedido });
  },
  // Al cruzar AVISO_TG_NV (world.js sumarXp): la oferta que la mision 1 o el dia 2 ya no dan a un novato.
  avisoTgSubio(s, nivel0) {
    if (nivel0 < AVISO_TG_NV && s.c.nivel >= AVISO_TG_NV) this.ofrecerAvisoTg(s).catch(() => {});
  },

  // El bot recibio /start av_<cod> en un chat privado: ese chat avisa a ese
  // personaje (uno por chat: el ultimo que lo pidio). Premio una vez por
  // personaje y por chat. Contador avisoTgOk en el dia.
  async avisoTgUsar(b) {
    const cod = String(b.cod || '').toLowerCase(), chat = String(b.chatId || '');
    if (!/^[a-z0-9]{10}$/.test(cod) || !/^\d{1,15}$/.test(chat)) return { ok: false, error: 'código no válido' };
    const m = this.avCods, v = m && m.get(cod);
    if (!v || v.exp < Date.now()) { if (v) m.delete(cod); return { ok: false, caducado: true }; }
    m.delete(cod);
    const idx = await this.retIdx();
    for (const u in idx) if (u !== v.uid && idx[u].tc === chat) delete idx[u].tc;
    const e = idx[v.uid] || (idx[v.uid] = { v: 0 });
    const nuevo = e.tc !== chat;
    e.tc = chat; delete e.bloq; e.a = 0;
    // Pidio «Avísame por Telegram» desde este chat: es consentimiento tambien para su
    // personaje de Telegram (si existe y no puso /avisos off).
    const tChat = idx['tg:' + chat];
    if (tChat && !tChat.off) tChat.si = 1;
    if (!(await this.retGuardarIdx())) return { ok: false, error: 'No se pudo guardar. Intenta de nuevo en un rato.' };
    let oro = 0, nombre = '', s = null, c = null;
    try { ({ s, c } = await this.pjDe(v.uid)); } catch (er) {}
    if (c) {
      nombre = c.nombre || '';
      if (!c.avTgOro && !(await this.state.storage.get('avtg:' + chat))) {
        c.avTgOro = 1; c.oro = (c.oro || 0) + AVISO_TG_ORO; oro = AVISO_TG_ORO;
        await this.state.storage.put('avtg:' + chat, v.uid);
        if (s) { s.sucio = true; await this.guardar(s); } else await this.state.storage.put('c:' + v.uid, c);
      }
      if (s && !s.cerrado) { this.enviar(s, { t: 'avisoTgOk', oro }); if (oro) this.actualizarYo(s); }
    }
    if (nuevo && !this.uidsPrueba.has(v.uid)) this.retSumar(diaNum(), { avisoTgOk: 1 }).catch(() => {});
    const t = idx['tg:' + chat];
    return { ok: true, nombre, oro, off: !!(t && t.off) };
  },

  // /avisos on|off (y el boton del aviso). Se guarda en el indice y no en el
  // personaje: si el jugador esta conectado, su guardado no lo pisa.
  async quiereAvisos(uid) {
    if (!uid.startsWith('tg:')) return false;
    const e = (await this.retIdx())[uid];
    // Solo con consentimiento explicito (e.si: tarjeta, /avisos on, Avisame por Telegram).
    return !!(e && e.si && !e.off && !e.bloq);
  },

  // Telegram (ORIGINS): «Ahora no» en la tarjeta del permiso (o lo rechazo en la ventana
  // de Telegram). No se le escribe hasta que acepte: off marcado por la tarjeta (offTarjeta),
  // que «Sí, avísame» puede quitar; un /avisos off puesto en el bot no lo quita nada del juego.
  async tarjetaTgNo(uid) {
    if (typeof uid !== 'string' || !/^tg:\d{1,15}$/.test(uid)) return;
    const idx = await this.retIdx();
    const e = idx[uid] || (idx[uid] = { v: 0 });
    if (e.off || e.si) return;   // ya acepto: el «Ahora no» de la tarjeta no lo silencia (para eso esta /avisos off)
    e.off = 1; e.offTarjeta = 1;
    await this.retGuardarIdx();
  },

  async ponerAvisos(b) {
    const id = String(b.tgId || '');
    if (!/^\d{1,15}$/.test(id)) return { ok: false, error: 'id de Telegram no válido' };
    const idx = await this.retIdx();
    const uid = 'tg:' + id;
    // Solo consultar (/avisos sin on/off): no se crea ni se escribe nada.
    if (b.on !== true && b.on !== false) { const e0 = idx[uid] || {}; return { ok: true, on: !!e0.si && !e0.off && !e0.bloq, jugo: (e0.v || 0) > 0 }; }
    const e = idx[uid] || (idx[uid] = { v: 0 });
    if (b.on === true) {
      delete e.off; delete e.bloq; e.a = 0; e.si = 1;
      // Sus personajes web o de invitado que avisan a este chat tambien se reanudan.
      for (const u in idx) if (idx[u].tc === id && idx[u].bloq) { delete idx[u].bloq; idx[u].a = 0; }
    }
    else if (b.on === false) e.off = 1;
    delete e.offTarjeta;   // lo decidio en el bot: la tarjeta del juego ya no lo cambia
    // Si no se guardo, se dice: si no, la baja solo vivia en memoria hasta el siguiente reinicio.
    if (!(await this.retGuardarIdx())) return { ok: false, error: 'No se pudo guardar. Intenta de nuevo en un rato.' };
    return { ok: true, on: !e.off, jugo: e.v > 0 };
  },

  // Telegram (ORIGINS): el jugador acepto en la ventana de Telegram que el bot le
  // escriba (requestWriteAccess). Un 403 anterior (bloq) ya no aplica: se borra y
  // se reinicia la cuenta de avisos, como /avisos on, pero NO se toca un /avisos off
  // (eso lo decide el jugador en el bot). No se envia ningun mensaje aqui.
  // s: la sesion del jugador. La primera vez por personaje recibe el mismo premio que
  // el «Avísame por Telegram» de la web (AVISO_TG_ORO, marca c.avTgOro) y suma avisoTgOk.
  async permisoEscribirTg(uid, s) {
    if (typeof uid !== 'string' || !/^tg:\d{1,15}$/.test(uid)) return false;
    const c = s && s.c;
    // Una vez por chat de Telegram, como la web ('avtg:'+chat): un personaje web ya premiado
    // por este mismo chat no cobra otra vez. avTgOro se marca antes del await (doble envio).
    if (c && c.uid === uid && !s.cerrado && !c.avTgOro && !(this.uidsPrueba && this.uidsPrueba.has(uid))) {
      c.avTgOro = 1; s.sucio = true;
      let yaChat = true; try { yaChat = !!(await this.state.storage.get('avtg:' + uid.slice(3))); } catch (er) {}
      if (yaChat) {
        // Este chat ya cobro el premio: se confirma sin oro (la tarjeta no queda sin respuesta).
        const r = await this.permisoEscribirTg(uid, null);
        // Solo si de verdad quedan activos (un /avisos off del bot sigue mandando).
        try { const e2 = (await this.retIdx())[uid] || {}; if (!e2.off && !s.cerrado) this.enviar(s, { t: 'avisoTgOk', oro: 0 }); } catch (er) {}
        return r;
      }
      c.oro = (c.oro || 0) + AVISO_TG_ORO;
      try { await this.state.storage.put('avtg:' + uid.slice(3), uid); } catch (er) {}
      try { await this.guardar(s); } catch (er) {}
      if (!s.cerrado) { this.enviar(s, { t: 'avisoTgOk', oro: AVISO_TG_ORO }); this.actualizarYo(s); }
      this.retSumar(diaNum(), { avisoTgOk: 1 }).catch(() => {});
    }
    const idx = await this.retIdx(), id = uid.slice(3);
    let cambio = false;
    const e = idx[uid] || (idx[uid] = { v: 0 });
    if (!e.si) { e.si = 1; cambio = true; }   // consentimiento explicito: acepto en la ventana de Telegram
    if (e.offTarjeta) { delete e.off; delete e.offTarjeta; e.a = 0; cambio = true; }   // habia dicho «Ahora no» en la tarjeta
    if (e.bloq) { delete e.bloq; e.a = 0; cambio = true; }
    for (const u in idx) if (idx[u].tc === id && idx[u].bloq) { delete idx[u].bloq; idx[u].a = 0; cambio = true; }
    return cambio ? this.retGuardarIdx() : true;
  },
};
