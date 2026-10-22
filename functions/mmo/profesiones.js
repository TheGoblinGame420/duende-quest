// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — recoleccion y artesania
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Cada zona abierta tiene 4 nodos (plantas y vetas, ver nodosDe en
// data.js). Recoger es un lanzamiento de 1,5 s (moverse o recibir un golpe
// lo corta) y cada jugador puede recoger cada nodo cada 5 min (la marca va
// en el personaje: reiniciar el servidor no la borra). Los materiales van a
// c.mat y la Artesana del pueblo los convierte en consumibles y elixires.
// Nada de esto da mTON.
//
// Nivel alto: en zonas Nv 30+ sale ademas Flor de Luna o Mithril, y con
// ellos (y la Esencia Abisal de los jefes de mazmorra) la Artesana graba
// RUNAS permanentes desde Nv 40 (+2% por rango, 5 rangos).
// ═══════════════════════════════════════════════════════
import { MAPAS, MATERIALES, NODO_CADA_MS, RECOLECTAR_MS, ELIXIR_MS, RECETAS, nodosDe, RARO_ZONA, raroDe, RUNAS, RUNA_NIVEL, RUNA_MAX, costoRuna, PESCA, pesqueroDe, hoyUTC } from '../../mmo/js/data.js';

export const Profesiones = {
  // Al entrar a un mapa: sus nodos y cuando vuelve a estar listo cada uno.
  nodosAlEntrar(s, mapaId) {
    const ns = nodosDe(mapaId);
    if (!ns.length) return this.enviar(s, { t: 'nodos', l: [] });
    const marcas = s.c.nodos || {};
    const ahora = Date.now();
    this.enviar(s, { t: 'nodos', l: ns.map(n => ({ ...n, en: Math.max(0, (marcas[mapaId + ':' + n.i] || 0) - ahora) })) });
  },

  recolectar(s, m) {
    if (s.muerto || s.cast || this.aura(s, 'aturdido')) return;
    const n = nodosDe(s.c.mapa)[m.i | 0];
    if (!n || s.k !== s.c.mapa) return;
    if (Math.abs(s.x - n.x) > 70) return this.no(s, 'Acércate más para recoger.');
    const clave = s.c.mapa + ':' + n.i;
    if (Date.now() < ((s.c.nodos || {})[clave] || 0)) return this.no(s, 'Ya lo recogiste: vuelve a crecer en unos minutos.');
    this.desmontar(s);
    s.cast = { h: 'recolectar', fin: Date.now() + RECOLECTAR_MS, x: s.x, y: s.y, tg: 0, nodo: n.i };
    this.aClave(s.k, { t: 'cast', p: s.id, id: 'recolectar', ms: RECOLECTAR_MS });
  },

  // Llamado desde revisarCast al terminar el lanzamiento.
  terminarRecoleccion(s, ca) {
    const c = s.c;
    const n = nodosDe(c.mapa)[ca.nodo];
    if (!n || Math.abs(s.x - n.x) > 90) return;
    const clave = c.mapa + ':' + n.i;
    const ahora = Date.now();
    c.nodos = c.nodos || {};
    if (ahora < (c.nodos[clave] || 0)) return;
    // Se limpian marcas vencidas para que el personaje no crezca sin fin.
    for (const k in c.nodos) if (c.nodos[k] < ahora) delete c.nodos[k];
    c.nodos[clave] = ahora + NODO_CADA_MS;
    c.mat = c.mat || {};
    const nv = (MAPAS[c.mapa].nv || [1])[0];
    const cant = 1 + (Math.random() < 0.5 ? 1 : 0) + (nv >= 30 ? 1 : 0);
    c.mat[n.tipo] = Math.min(999, (c.mat[n.tipo] || 0) + cant);
    let extra = '';
    // Cristal: raro, algo mas en zonas altas.
    if (Math.random() < 0.06 + nv / 800) { c.mat.cristal = Math.min(999, (c.mat.cristal || 0) + 1); extra = ' y ¡1 Cristal Arcano!'; }
    // Zonas altas: Flor de Luna (plantas) o Mithril (vetas).
    let raros = 0;
    for (const [nvMin, p] of RARO_ZONA) if (nv >= nvMin && Math.random() < p) raros++;
    if (raros) {
      const r = raroDe(n.tipo);
      c.mat[r] = Math.min(999, (c.mat[r] || 0) + raros);
      extra += ` y +${raros} ${MATERIALES[r].nombre}`;
    }
    s.sucio = true;
    this.enviar(s, { t: 'recogido', i: n.i, en: NODO_CADA_MS, tipo: n.tipo, cant, cristal: !!extra });
    this.enviar(s, { t: 'toast', m: `🌿 +${cant} ${MATERIALES[n.tipo].nombre}${extra}`, ok: true });
    this.progresoTarea && this.progresoTarea(s, 'recoger');
    this.actualizarYo(s);
  },

  // ── PESCA ── (ver PESCA en data.js)
  // Lanzar: un "lanzamiento" que acaba cuando pica (el cliente no sabe
  // cuando). Al picar pasa a 'pica' durante PESCA.ventana: hay que tirar.
  pescar(s) {
    const c = s.c;
    if (s.muerto || s.cast || this.aura(s, 'aturdido')) return;
    const p = pesqueroDe(c.mapa);
    if (!p || s.k !== c.mapa) return;
    if (Math.abs(s.x - p.x) > PESCA.radio) return this.no(s, 'Acércate más al agua.');
    const hoy = hoyUTC();
    if (c.pescaHoy && c.pescaHoy.d === hoy && c.pescaHoy.n >= PESCA.porDia) return this.no(s, `Hoy ya pescaste ${PESCA.porDia} veces: los peces descansan hasta mañana.`);
    this.desmontar(s);
    const ahora = Date.now();
    s.cast = { h: 'pescar', fin: ahora + PESCA.min + Math.random() * (PESCA.max - PESCA.min), x: s.x, y: s.y, tg: 0 };
    this.aClave(s.k, { t: 'cast', p: s.id, id: 'pescar', ms: PESCA.max + PESCA.ventana });
  },

  // Llamado desde revisarCast: pico (pasa a 'pica') o se escapo.
  finPesca(s, ca, ahora) {
    if (s.muerto) return this.aClave(s.k, { t: 'castFin', p: s.id, ok: false });
    if (ca.h === 'pescar') {
      s.cast = { h: 'pica', fin: ahora + PESCA.ventana, x: ca.x, y: ca.y, tg: 0 };
      return this.enviar(s, { t: 'pica', ms: PESCA.ventana });
    }
    this.aClave(s.k, { t: 'castFin', p: s.id, ok: false });
    this.enviar(s, { t: 'toast', m: '🐟 Se escapó… tira en cuanto pique.' });
  },

  tirar(s) {
    const ca = s.cast;
    if (!ca) return;
    if (ca.h === 'pescar') return this.cancelarCast(s, 'Tiraste antes de que picara: el pez se asustó.');
    if (ca.h !== 'pica' || s.muerto) return;
    s.cast = null;
    this.aClave(s.k, { t: 'castFin', p: s.id, ok: true });
    const c = s.c;
    const p = pesqueroDe(c.mapa);
    if (!p) return;
    const hoy = hoyUTC();
    if (!c.pescaHoy || c.pescaHoy.d !== hoy) c.pescaHoy = { d: hoy, n: 0 };
    if (c.pescaHoy.n >= PESCA.porDia) return;
    c.pescaHoy.n++;
    c.peces = (c.peces || 0) + 1;
    c.mat = c.mat || {};
    const cant = 1 + (p.nv >= 30 ? 1 : 0);
    c.mat.pescado = Math.min(999, (c.mat.pescado || 0) + cant);
    let txt = `🎣 +${cant} ${MATERIALES.pescado.nombre}`, dorado = false, oro = 0;
    if (Math.random() < PESCA.dorado + p.nv / 1500) { c.mat.pez_dorado = Math.min(999, (c.mat.pez_dorado || 0) + 1); dorado = true; txt += ' y ¡1 Pez Dorado!'; }
    if (Math.random() < PESCA.cofre) { oro = 30 * Math.max(5, p.nv); c.oro += oro; txt += ` y un cofre hundido (+${oro} oro)`; }
    // La mascota que solo se pesca: muy rara, segura a las mascotaSeguro capturas.
    c.mascotas = c.mascotas || [];
    if (!c.mascotas.includes('pececito') && (Math.random() < PESCA.mascota || c.peces >= PESCA.mascotaSeguro)) {
      c.mascotas.push('pececito');
      txt += ' ¡Y un PECECITO DORADO! Ahora es tu mascota (Mercader → MASCOTAS).';
      this.aTodos({ t: 'aviso', m: `🐟 ¡${c.nombre} pescó el Pececito Dorado!` });
    }
    s.sucio = true;
    this.enviar(s, { t: 'pescado', cant, dorado, oro, hoy: c.pescaHoy.n });
    this.enviar(s, { t: 'toast', m: txt, ok: true });
    this.progresoTarea && this.progresoTarea(s, 'pescar');
    this.puntoGesta && this.puntoGesta(s, 'pesca');
    this.revisarLogros(s);
    this.actualizarYo(s);
  },

  cercaDeArtesana(s) {
    const npc = MAPAS.pueblo.npcs.find(x => x.tipo === 'artesania');
    return s.k === 'pueblo' && npc && Math.abs(s.x - npc.x) < 200;
  },

  fabricar(s, m) {
    const c = s.c;
    const r = RECETAS.find(x => x.id === m.id);
    if (!r || s.muerto) return;
    if (!this.cercaDeArtesana(s)) return this.no(s, 'Habla con la Artesana Lila en el pueblo.');
    c.mat = c.mat || {};
    for (const k in r.pide) if ((c.mat[k] || 0) < r.pide[k]) return this.no(s, `Te faltan materiales: ${MATERIALES[k].nombre}.`);
    if (r.da.pw) for (const k in r.da.pw) if ((c.pw[k] || 0) + r.da.pw[k] > 99) return this.no(s, 'Ya llevas el máximo (99) de eso.');
    for (const k in r.pide) c.mat[k] -= r.pide[k];
    if (r.da.pw) for (const k in r.da.pw) c.pw[k] = (c.pw[k] || 0) + r.da.pw[k];
    if (r.da.mat) for (const k in r.da.mat) c.mat[k] = Math.min(999, (c.mat[k] || 0) + r.da.mat[k]);
    if (r.da.elixir) {
      c.elix = c.elix || {};
      c.elix[r.da.elixir] = Date.now() + ELIXIR_MS;
      this.ponerAura(s, r.da.elixir, ELIXIR_MS);
    }
    s.sucio = true;
    this.enviar(s, { t: 'toast', m: `⚗️ Fabricaste: ${r.nombre}`, ok: true });
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Grabar (subir) una runa: rango siguiente con sus materiales y su oro.
  grabarRuna(s, m) {
    const c = s.c;
    const id = typeof m.id === 'string' && Object.hasOwn(RUNAS, m.id) ? m.id : null;
    if (!id || s.muerto) return;
    if (!this.cercaDeArtesana(s)) return this.no(s, 'Habla con la Artesana Lila en el pueblo.');
    if (c.nivel < RUNA_NIVEL) return this.no(s, `Las runas se graban desde nivel ${RUNA_NIVEL}.`);
    c.runas = c.runas || {};
    const r = (c.runas[id] || 0) + 1;
    if (r > RUNA_MAX) return this.no(s, 'Esa runa ya está al máximo.');
    const cos = costoRuna(id, r);
    c.mat = c.mat || {};
    for (const k in cos.mat) if ((c.mat[k] || 0) < cos.mat[k]) return this.no(s, `Te faltan materiales: ${MATERIALES[k].nombre}.`);
    if (c.oro < cos.oro) return this.no(s, 'No te alcanza el oro.');
    for (const k in cos.mat) c.mat[k] -= cos.mat[k];
    c.oro -= cos.oro;
    c.runas[id] = r;
    s.st = this.stats(c);
    s.hp = Math.min(s.hp, s.st.maxHp);
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `✨ ${RUNAS[id].nombre} grabada a rango ${r}: +${r * 2}% de ${RUNAS[id].desc}.` });
    this.revisarLogros(s);
    this.actualizarYo(s);
    this.guardar(s);
  },

  // Elixires activos (se guardan en el personaje): al entrar vuelven a verse.
  reponerElixires(s) {
    const e = s.c.elix || {};
    const ahora = Date.now();
    for (const k in e) { if (e[k] > ahora) this.ponerAura(s, k, e[k] - ahora); else delete e[k]; }
  },
  elixir(s, k) { const e = s.c.elix; return !!(e && e[k] > Date.now()); },
};
