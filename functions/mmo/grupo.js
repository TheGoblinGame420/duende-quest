// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — el bot en el GRUPO oficial de Telegram del dueño.
// Se mezcla en MmoWorld (Object.assign + instalarGrupo al final de world.js).
//
// Que hace (todo apagable con /grupo, solo el dueño):
//   bienvenida  saludo corto a quien entra (uno solo si entran varios en 2 min;
//               borra el saludo anterior) con el boton Jugar y la regla de seguridad.
//   novedades   al publicarse una version con una entrada nueva de NOVEDADES:
//               un mensaje, 2-3 puntos, nunca de 23:00 a 8:00 (Lima) y sin
//               lineas de cripto, precios ni tienda.
//   hitos       «X llegó al nivel 10/20/…», jefe mundial, primer Nv 60, récords:
//               agrupados (5 min) y con tope de 4 mensajes al dia.
//   manana      8:00 Lima: la caza del dia y el evento de hoy.
//   noche       21:00 Lima: resumen del dia y lo que viene mañana.
//   antiespam   borra (a no administradores) enlaces de fuera, invitaciones,
//               telefonos que no son los dos oficiales y frases de estafa.
//               Avisa una vez al autor (el aviso se borra solo). No expulsa.
//
// Sin grupo vinculado (/grupo aqui, escrito por el dueño DENTRO del grupo) no
// se publica nada. Aqui NO se escribe a nadie por privado, salvo al dueño
// (estado, vistas previas). Solo nombres de personaje; nada de cripto ni precios.
//
// Estado: una sola clave de almacenamiento, 'grupo'. Las horas las marca la
// alarma del Durable Object (retencion.js, cada hora en punto), que este
// modulo adelanta cuando tiene algo pendiente (borrar un aviso, soltar hitos).
// El webhook (functions/api/grupo.js) entra por /interno/grupo.
// ═══════════════════════════════════════════════════════

import { VERSION, NOVEDADES, NIVEL_MAX, MONSTRUOS, DIARIA, TORRE, HORA_FELIZ, diaJuego, temporadaDe, TEMP_DIAS, diaFiesta } from '../../mmo/js/data.js';
import { riesgoEstafa, riesgoContacto, telefonoDisfrazado } from './social.js';

// ── Constantes ──
const SITIO = 'https://duende-quest.alfonso12hc.workers.dev';
export const HOST_OFICIAL = 'duende-quest.alfonso12hc.workers.dev';
export const JUGAR_URL = SITIO + '/jugar/';
const SEGURIDAD_URL = SITIO + '/seguridad.html';
// t.me del proyecto (en minusculas): el bot, el creador, el canal y el grupo publico.
export const TME_OFICIALES = ['duendequest_bot', 'elduendeoficial', 'elduende420peru', 'duendesolana420'];
// Los dos unicos numeros oficiales (seguridad.html#numeros).
export const TEL_OFICIALES = ['51900877863', '51916778731'];
export const FUNCIONES = ['bienvenida', 'novedades', 'hitos', 'manana', 'noche', 'antiespam'];
const NOMBRE_FUNCION = { bienvenida: 'Bienvenida', novedades: 'Novedades', hitos: 'Hitos', manana: 'Buenos días (8:00)', noche: 'Buenas noches (21:00)', antiespam: 'Antiespam' };
export const HITOS_POR_DIA = 4;
export const AGRUPAR_HITOS_MS = 5 * 60000;     // se espera esto por si llegan mas hitos
export const BIENVENIDA_VENTANA_MS = 2 * 60000;
export const AVISO_SPAM_BORRAR_MS = 45000;     // el aviso al autor se borra solo
const AVISO_SPAM_CADA_MS = 24 * 3600000;       // un aviso por autor al dia; el resto se borra en silencio
const ADMINS_CACHE_MS = 10 * 60000;
export const HORA_MANANA = 8, HORA_NOCHE = 21; // hora de Lima
const SILENCIO_DESDE = 23, SILENCIO_HASTA = 8; // sin mensajes del bot de 23:00 a 8:00 (Lima)
const NIVELES_HITO = [10, 20, 30, 40, 50, 60];

// ── Tiempo (Lima = UTC-5, sin horario de verano) ──
export const horaLima = (t = Date.now()) => new Date(t - 5 * 3600000).getUTCHours();
export const enSilencio = (t = Date.now()) => { const h = horaLima(t); return h >= SILENCIO_DESDE || h < SILENCIO_HASTA; };
const diaSemanaLima = t => new Date(t - 5 * 3600000).getUTCDay();   // 0 = domingo
const hora12 = h => { const x = ((h + 11) % 12) + 1; return x + ':00 ' + (h < 12 ? 'a. m.' : 'p. m.'); };

// ── Texto seguro ──
export const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const soloLetras = (t, n) => String(t || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const sospechoso = t => { const x = String(t || ''); return riesgoEstafa(x) || riesgoContacto(x); };
// Nombre de PERSONAJE para el grupo. Nunca datos de la cuenta. Si el jugador
// oculta su nombre (c.ocultarNombre / c.anonimo, por si esa opcion llega a
// existir) o el nombre parece un anuncio, sale «Un duende».
export function nombrePublico(c) {
  if (!c || c.ocultarNombre || c.anonimo) return 'Un duende';
  const n = soloLetras(c.nombre, 20);
  if (!n || sospechoso(c.nombre) || sospechoso(n)) return 'Un duende';
  return n;
}
// Nombre de Telegram de quien entra al grupo (lo eligio el: se limpia igual).
export function nombreVisitante(u) {
  const crudo = u && (u.first_name || u.nombre);
  const n = soloLetras(crudo, 24);
  if (!n || sospechoso(crudo) || sospechoso(n)) return '';
  return n;
}
const lista = (a, max) => {
  const v = a.slice(0, max), resto = a.length - v.length;
  if (resto > 0) return v.join(', ') + ' y ' + resto + ' más';
  return v.length > 1 ? v.slice(0, -1).join(', ') + ' y ' + v[v.length - 1] : (v[0] || '');
};

// ═══════════════ ANTIESPAM (funciones puras) ═══════════════
// TLD que NO son palabras del español: un dominio pelado («gana.xyz») cuenta
// como enlace. Los demas (.me, .es, .co, .pe…) solo con http, www o una ruta,
// para no borrar «listo.me voy» por un espacio que falto.
const TLD_CLAROS = 'com|net|org|xyz|io|ly|gg|app|dev|site|shop|link|top|club|online|info|biz|ru|cn|tk|ml|click|live|vip|fun|store|cc|ws|tv|icu|cyou|lat|bet|win|work|world|website|space|today|life|finance|exchange|money|cash';
const RE_URLS = new RegExp(
  '(?:https?:\\/\\/|tg:\\/\\/|www\\.)[^\\s<>"\']+' +
  '|(?<![\\w@.])(?:t|wa|telegram)\\.(?:me|dog)\\/[^\\s<>"\']*' +
  '|(?<![\\w@.-])(?:[a-z0-9-]+\\.)+(?:' + TLD_CLAROS + ')(?![\\w-])(?:[/?#][^\\s<>"\']*)?' +
  '|(?<![\\w@.-])(?:[a-z0-9-]+\\.)+[a-z]{2,}\\/[^\\s<>"\']+', 'gi');
// Telefono movil del Peru (9 cifras, con o sin +51) o internacional con «+».
const RE_TEL = /(?<![\d+])(?:(?:\+|00)?51[\s.\-]?)?9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}(?!\d)|\+\d[\d\s().\-]{8,16}\d(?!\d)/g;
const telNormal = t => { let d = String(t || '').replace(/\D/g, '').replace(/^00/, ''); if (d.length === 9 && d[0] === '9') d = '51' + d; return d; };
export const telOficial = t => TEL_OFICIALES.includes(telNormal(t));

// Clasifica UN enlace: 'ok' (oficial), 'invitacion', 'telefono' o 'enlace'.
// extra = { tme: [usuarios de t.me permitidos], dominios: [dominios que el dueño permitio] }
export function clasificarEnlace(url, extra) {
  let u = String(url || '').trim().toLowerCase();
  if (!u) return 'ok';
  if (u.startsWith('tg://')) return 'invitacion';
  u = u.replace(/^https?:\/\//, '');
  const corte = u.search(/[/?#]/);
  let host = corte < 0 ? u : u.slice(0, corte);
  const ruta = corte < 0 ? '' : u.slice(corte);
  if (host.includes('@')) host = host.slice(host.lastIndexOf('@') + 1);   // «oficial.dev@otro.com» es otro.com
  host = host.replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.+$/, '');
  if (!host || !host.includes('.')) return 'ok';
  // Otro dominio escondido en la ruta del oficial («…workers.dev/?u=otro.com») no pasa.
  if (host === HOST_OFICIAL) return /[a-z0-9-]\.[a-z]{2,}(?:[/?#&]|$)/.test(ruta.replace(/\.html?\b/g, '')) ? 'enlace' : 'ok';
  const seg = ruta.replace(/^\/+/, '').split(/[/?#]/)[0] || '';
  if (host === 't.me' || host === 'telegram.me' || host === 'telegram.dog') {
    if (!seg) return 'ok';
    if (seg.startsWith('+') || seg === 'joinchat' || seg === 'addlist' || seg === 'c' || seg === 's') return 'invitacion';
    const tme = [...TME_OFICIALES, ...((extra && extra.tme) || [])].map(x => String(x || '').toLowerCase()).filter(Boolean);
    return tme.includes(seg) ? 'ok' : 'invitacion';
  }
  if (host === 'chat.whatsapp.com' || host === 'whatsapp.com' && /^\/channel\//.test(ruta) || host === 'discord.gg' || host === 'discord.com' && /^\/invite\//.test(ruta)) return 'invitacion';
  if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'wa.link') {
    const num = host === 'wa.me' ? seg : (ruta.match(/phone=(\+?\d+)/) || [])[1];
    return num && telOficial(num) ? 'ok' : 'telefono';
  }
  const dominios = ((extra && extra.dominios) || []).map(x => String(x || '').toLowerCase()).filter(Boolean);
  if (dominios.some(d => host === d || host.endsWith('.' + d))) return 'ok';
  return 'enlace';
}

// Todo el texto visible de un mensaje de Telegram y sus enlaces (los escritos,
// los que Telegram marco como enlace, los ocultos tras un texto y los botones).
function partesMensaje(msg) {
  const texto = String(msg.text || msg.caption || '');
  const urls = [];
  for (const m of texto.matchAll(RE_URLS)) urls.push(m[0]);
  for (const e of [...(msg.entities || []), ...(msg.caption_entities || [])]) {
    if (e.type === 'text_link' && e.url) urls.push(e.url);
    else if (e.type === 'url') urls.push(texto.slice(e.offset, e.offset + e.length));
  }
  for (const fila of (msg.reply_markup && msg.reply_markup.inline_keyboard) || []) for (const b of fila || []) if (b && b.url) urls.push(b.url);
  return { texto, urls };
}

// ¿Por que se borraria este mensaje? null = se queda.
// 'invitacion' | 'enlace' | 'telefono' | 'estafa' | 'contacto'
export function motivoSpam(msg, extra) {
  if (!msg) return null;
  const { texto, urls } = partesMensaje(msg);
  let peor = null;
  const ORDEN = ['invitacion', 'enlace', 'telefono'];
  let limpio = texto;
  for (const u of urls) {
    const c = clasificarEnlace(u, extra);
    if (c === 'ok') { limpio = limpio.split(u).join(' '); continue; }
    if (!peor || ORDEN.indexOf(c) < ORDEN.indexOf(peor)) peor = c;
  }
  if (peor) return peor;
  // Telefonos: los dos oficiales pasan; cualquier otro, no.
  if (msg.contact && msg.contact.phone_number && !telOficial(msg.contact.phone_number)) return 'telefono';
  let otroTel = false;
  limpio = limpio.replace(RE_TEL, m => { if (telOficial(m)) return ' '; otroTel = true; return m; });
  if (otroTel || telefonoDisfrazado(limpio)) return 'telefono';
  if (!limpio.trim()) return null;
  // Frases de estafa (las mismas reglas del chat del juego: carteras, frases semilla, cobros).
  if (riesgoEstafa(limpio)) return 'estafa';
  // Pedir datos personales o llevarse a alguien a otra red. Nombrar WhatsApp a secas no cuenta
  // (aqui si se puede preguntar «¿cuál es el WhatsApp oficial?»).
  const sinWsp = limpio.replace(/\b(?:whats?\s?app|wasap|watsap|wsp|wpp)\b/gi, ' ');
  if (riesgoContacto(sinWsp)) return 'contacto';
  return null;
}

const MOTIVO_TXT = {
  invitacion: 'aquí no se comparten invitaciones a otros grupos ni canales',
  enlace: 'aquí solo se comparten enlaces del sitio oficial del juego',
  telefono: 'aquí no se comparten teléfonos (los únicos oficiales son +51 900 877 863 y +51 916 778 731)',
  estafa: 'tenía una frase que usan los estafadores (carteras, frases semilla o cobros)',
  contacto: 'aquí no se piden ni se comparten datos personales',
};
export function textoAvisoSpam(nombre, motivo) {
  return `🛡 ${nombre ? '<b>' + esc(nombre) + '</b>, borré' : 'Borré'} tu mensaje: ${MOTIVO_TXT[motivo] || MOTIVO_TXT.enlace}. Si fue un error, avisa a un administrador.\n\n` +
    '🔒 Recuerda: nunca pedimos contraseñas ni frases semilla, y nadie del equipo te escribe primero por privado.';
}

// ═══════════════ TEXTOS (funciones puras) ═══════════════
const BOTON_JUGAR = [[{ text: '🎮 Jugar', url: JUGAR_URL }]];
const BOTONES_BIENVENIDA = [[{ text: '🎮 Jugar gratis', url: JUGAR_URL }], [{ text: '🔒 Seguridad', url: SEGURIDAD_URL }]];

export function textoBienvenida(nombres, titulo) {
  const n = (nombres || []).filter(Boolean);
  const quien = n.length ? ', ' + lista(n.map(x => '<b>' + esc(x) + '</b>'), 5) : '';
  const lugar = titulo ? ' a ' + esc(soloLetras(titulo, 40)) : '';
  return `👋 ¡${n.length > 1 ? 'Bienvenidos' : 'Te damos la bienvenida'}${lugar}${quien}!\n` +
    'DUENDE QUEST es un RPG de duendes gratis y sin descargas: toca Jugar y entra en un minuto.\n\n' +
    '🔒 Regla de seguridad: nunca pedimos contraseñas ni frases semilla, y nadie del equipo te escribe primero por privado.';
}

// Novedades: fuera cualquier linea con cripto, precios, pagos o tienda.
const RE_NO_NOVEDAD = /\bSOL\b|\$\s?DUENDE|\bTON\b|mTON|\bUSDT?\b|\bBTC\b|wallet|billetera|cartera|solana|phantom|solflare|binance|cripto|crypto|\btokens?\b|airdrop|staking|hodl|tu bolsa|memecoin|precio|\bpag[oa]\w*|\bcompra\w*|\bvend\w*|yape|plin|paypal|\bstars\b|S\/\.?\s*\d|US\$|\$\s*\d|\d\s*(?:soles|d[oó]lares|usd)\b|descuento|oferta|tienda|ganancia|inversi[oó]n|rentab/i;
export const lineaNovedadOk = t => !!String(t || '').trim() && !RE_NO_NOVEDAD.test(String(t));
export function textoNovedades(nv) {
  if (!nv) return null;
  const cand = [...(nv.gancho ? [nv.gancho] : []), ...(nv.items || [])].map(x => String(x || '').replace(/️/g, '').trim());
  const vistos = new Set();
  const ok = cand.filter(x => lineaNovedadOk(x) && !vistos.has(x) && vistos.add(x)).slice(0, 3)
    .map(x => (x.length > 190 ? x.slice(0, 189).replace(/\s+\S*$/, '') + '…' : x));
  if (!ok.length) return null;
  return `✨ <b>Novedades de DUENDE QUEST</b>${nv.fecha ? ' · ' + esc(nv.fecha) : ''}\n\n` + ok.map(x => '• ' + esc(x)).join('\n') +
    '\n\nYa está publicado: entra y pruébalo.';
}

// Hitos: de una cola de { tipo, k, txt, pri } a UN mensaje. Un solo hito de
// nivel por personaje (el mas alto) y lo mas importante arriba.
export function armarHitos(cola) {
  const porClave = new Map();
  for (const h of cola || []) {
    if (!h || !h.txt) continue;
    const k = h.k || h.txt, a = porClave.get(k);
    if (!a || (h.pri || 0) >= (a.pri || 0)) porClave.set(k, h);
  }
  const l = [...porClave.values()].sort((a, b) => (b.pri || 0) - (a.pri || 0));
  if (!l.length) return null;
  if (l.length === 1) return l[0].txt;
  const ver = l.slice(0, 6);
  return '🏅 <b>Hitos de la comunidad</b>\n' + ver.map(h => '• ' + h.txt).join('\n') + (l.length > ver.length ? `\n…y ${l.length - ver.length} más.` : '');
}
export const hitoNivel = (nivel0, nivel) => NIVELES_HITO.filter(m => nivel0 < m && nivel >= m).pop() || 0;

const lineasEvento = (t, etiqueta) => {
  const l = [];
  const tp = temporadaDe(t);
  if (tp) {
    const tarea = TEMP_DIAS[((diaFiesta(tp, t) % 7) + 7) % 7];
    l.push(`${tp.emoji || '🎉'} <b>${esc(tp.nombre)}</b> (hasta el ${esc(tp.hasta)}): los monstruos sueltan ${esc(tp.cosas)}.${tarea ? ` Tarea ${etiqueta}: ${esc(tarea.txt.toLowerCase())}.` : ''}`);
  }
  if (diaSemanaLima(t) === 1) l.push('🗼 Semana nueva: la Torre del Duende y los rankings semanales empiezan de cero.');
  const hf = (HORA_FELIZ.ini + 19) % 24;
  l.push(`⚡ Hora Feliz a las ${hora12(hf)}: +${Math.round((HORA_FELIZ.xp - 1) * 100)} % de experiencia por caza durante una hora.`);
  return l;
};

export function textoManana(t = Date.now(), saludo) {
  return [
    saludo ? esc(saludo) : '☀️ <b>¡Buenos días, duendes!</b>',
    '',
    `🎯 <b>${esc(DIARIA.nombre)}:</b> ${DIARIA.n} monstruos de tu nivel y cobras experiencia, oro y 3 pociones.`,
    ...lineasEvento(t, 'de hoy'),
    '🐉 Jefe mundial cada media hora: todos los niveles reciben premio.',
  ].join('\n');
}

export const resVacio = () => ({ sub: {}, mund: 0, mundMax: 0, racha: null, extra: [] });
export function textoNoche(t = Date.now(), res, saludo) {
  const r = res || resVacio();
  const l = [saludo ? esc(saludo) : '🌙 <b>Buenas noches, duendes.</b> Así fue el día en el Éter:', ''];
  const sub = Object.entries(r.sub || {}).sort((a, b) => b[1] - a[1]);
  let algo = false;
  if (sub.length) { algo = true; l.push('⭐ Subieron de nivel: ' + lista(sub.map(([n, nv]) => `${esc(n)} (Nv ${nv})`), 6) + '.'); }
  if (r.mund > 0) { algo = true; l.push(`🐉 El jefe mundial cayó ${r.mund} ${r.mund === 1 ? 'vez' : 'veces'}${r.mundMax > 1 ? ` (hasta ${r.mundMax} cazadores juntos)` : ''}.`); }
  if (r.racha && r.racha.n >= 2) { algo = true; l.push(`🔥 Mejor racha: ${esc(r.racha.nombre)}, ${r.racha.n} días seguidos.`); }
  for (const x of (r.extra || []).slice(0, 3)) { algo = true; l.push(x); }
  if (!algo) l.push('Hoy el pueblo estuvo tranquilo. Mañana, a cazar con calma.');
  // Mañana a las 8:00 de Lima: la tarea de la fiesta y el dia de la semana se miran a esa hora.
  const man = Date.parse(diaJuego(t + 24 * 3600000)) + (HORA_MANANA + 5) * 3600000;
  l.push('', '<b>Mañana:</b>', `🎯 ${esc(DIARIA.nombre)} nueva desde la medianoche.`, ...lineasEvento(man, 'de mañana'), '', 'Descansen. 🧌');
  return l.join('\n');
}

// ═══════════════ ESTADO ═══════════════
const nuevoEstado = () => ({
  chat: null, titulo: '', user: '', desde: 0,
  on: Object.fromEntries(FUNCIONES.map(f => [f, true])),
  txt: {},            // saludos propios del dueño: { manana, noche }
  dom: [],            // dominios que el dueño permitio (/grupo permitir)
  ver: 0, novN: 0,    // ultima VERSION vista y ultima entrada de NOVEDADES anunciada
  dia: '', hitosHoy: 0, spamHoy: 0, mundHito: '',
  cola: [],           // hitos esperando a salir juntos
  res: resVacio(),    // lo que paso desde el ultimo «buenas noches»
  man: '', noc: '',   // dia (Lima) del ultimo buenos dias / buenas noches
  p60: false,         // ya hubo un primer Nv 60
  bienv: null,        // { msg, t, nombres } del ultimo saludo
  ent: {},            // quien entro hace poco (new_chat_members y chat_member llegan los dos)
  spam: {},           // id de Telegram -> cuando se le aviso
  borrar: [],         // avisos que se borran solos: { m, t }
});
function normalizar(x) {
  const g = { ...nuevoEstado(), ...(x && typeof x === 'object' ? x : {}) };
  g.on = { ...nuevoEstado().on, ...(g.on || {}) };
  g.res = { ...resVacio(), ...(g.res || {}) };
  for (const k of ['cola', 'borrar', 'dom']) if (!Array.isArray(g[k])) g[k] = [];
  for (const k of ['txt', 'ent', 'spam']) if (!g[k] || typeof g[k] !== 'object') g[k] = {};
  return g;
}

export const Grupo = {
  async grupoCargar() {
    if (this._grupo) return this._grupo;
    if (!this._grupoP) this._grupoP = this.state.storage.get('grupo').then(x => (this._grupo = normalizar(x)), e => { console.error('[Grupo cargar]', e); return (this._grupo = nuevoEstado()); });
    return this._grupoP;
  },
  async grupoGuardar() {
    this._grupoSucio = false;
    try { await this.state.storage.put('grupo', this._grupo); } catch (e) { console.error('[Grupo guardar]', e); }
  },
  grupoDueno() { return String((this.env && this.env.ADMIN_TG_ID) || ''); },
  // Cambio de dia (Lima): los topes diarios vuelven a cero.
  grupoDia(g, t = Date.now()) {
    const hoy = diaJuego(t);
    if (g.dia !== hoy) { g.dia = hoy; g.hitosHoy = 0; g.spamHoy = 0; this._grupoSucio = true; }
    return hoy;
  },
  async grupoTg(metodo, cuerpo) {
    try { return (await this.tgEnviar(metodo, cuerpo)) || { ok: false }; }
    catch (e) { console.error('[Grupo tg]', metodo, e); return { ok: false, description: String(e) }; }
  },
  // Publica en el grupo vinculado. Devuelve la respuesta de Telegram.
  async grupoPublicar(texto, botones) {
    const g = await this.grupoCargar();
    if (!g.chat || !texto) return { ok: false };
    const r = await this.grupoTg('sendMessage', { chat_id: g.chat, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, disable_notification: false, ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) });
    // Al bot lo sacaron del grupo (o el grupo ya no existe): se suelta y se avisa al dueño.
    if (r && !r.ok && (r.error_code === 403 || /chat not found|bot was kicked|not a member/i.test(String(r.description || '')))) {
      const titulo = g.titulo; g.chat = null; await this.grupoGuardar();
      await this.grupoAlDueno(`⚠️ Ya no puedo escribir en «${esc(titulo)}» (${esc(r.description || 'sin acceso')}). Solté el grupo: para volver a vincularlo, añádeme como administrador y escribe /grupo aqui dentro del grupo.`);
    }
    return r || { ok: false };
  },
  async grupoAlDueno(texto, botones) {
    const id = this.grupoDueno();
    if (!id) return { ok: false };
    return this.grupoTg('sendMessage', { chat_id: id, text: texto, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}) });
  },

  // ── Entrada del webhook (/interno/grupo) ──
  async grupoInterno(b) {
    b = b || {};
    if (b.tipo === 'cmd') return this.grupoCmd(b);
    if (b.tipo === 'cb') return this.grupoBoton(b);
    if (b.tipo === 'entra') return this.grupoEntra(b);
    if (b.tipo === 'msg') return this.grupoMsg(b.msg);
    if (b.tipo === 'bot') return this.grupoBotCambio(b);
    return { ok: false };
  },

  // ── /grupo (solo el dueño) ──
  async grupoCmd(b) {
    const g = await this.grupoCargar();
    const enGrupo = !!b.chat && (b.chat.type === 'group' || b.chat.type === 'supergroup');
    const arg = String(b.txt || '').trim().replace(/\s+/g, ' ');
    const [a0, a1, ...resto] = arg.split(' ');
    const sub = (a0 || 'estado').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (String(b.de) !== this.grupoDueno() || !this.grupoDueno()) {
      // Administrador anonimo: Telegram no dice quien es, asi que no se puede saber si es el dueño.
      if (b.anon && enGrupo && (sub === 'aqui' || sub === 'vincular')) await this.grupoTg('sendMessage', { chat_id: b.chat.id, text: 'Para vincular este grupo, el dueño debe escribir /grupo aqui sin el modo anónimo de administrador.' });
      return { ok: false };
    }
    // Lo escrito dentro de un grupo se borra para no ensuciar el chat (si el bot tiene permiso).
    if (enGrupo && b.msgId) await this.grupoTg('deleteMessage', { chat_id: b.chat.id, message_id: b.msgId });
    if (sub === 'aqui' || sub === 'vincular') {
      if (!enGrupo) { await this.grupoAlDueno('Escribe /grupo aqui DENTRO del grupo que quieres vincular (yo debo ser administrador ahí).'); return { ok: true }; }
      const otro = g.chat && g.chat !== b.chat.id;
      g.chat = b.chat.id; g.titulo = String(b.chat.title || '').slice(0, 80); g.user = String(b.chat.username || '').toLowerCase(); g.desde = Date.now();
      g.on = Object.fromEntries(FUNCIONES.map(f => [f, true]));
      // Lo ya publicado no se anuncia al vincular: solo lo que salga desde ahora.
      g.ver = VERSION; g.novN = (NOVEDADES[0] && NOVEDADES[0].n) || 0;
      const hoy = diaJuego();
      g.dia = hoy; g.hitosHoy = 0; g.spamHoy = 0; g.cola = []; g.res = resVacio(); g.bienv = null; g.ent = {}; g.spam = {}; g.borrar = [];
      // Si se vincula pasada la hora, el saludo de hoy ya no sale (empieza mañana).
      g.man = horaLima() >= HORA_MANANA ? hoy : ''; g.noc = horaLima() >= HORA_NOCHE ? hoy : '';
      try { const rk = (await this.state.storage.get('ranking')) || []; g.p60 = Array.isArray(rk) && rk.some(x => x && (x.lv || x.nivel || 0) >= NIVEL_MAX); } catch (e) {}
      this._grupoAdm = null;
      await this.grupoGuardar();
      const permisos = await this.grupoPermisos(g);
      await this.grupoAlDueno(`✅ Grupo vinculado: «${esc(g.titulo)}»${otro ? ' (se soltó el anterior)' : ''}.\nTodo queda encendido. ${permisos}\n\n` + this.grupoEstadoTxt(g), this.grupoBotones(g));
      return { ok: true, vinculado: true };
    }
    if (sub === 'off' || sub === 'soltar' || sub === 'desvincular') {
      const titulo = g.titulo; g.chat = null; g.cola = []; g.borrar = []; g.bienv = null;
      await this.grupoGuardar();
      await this.grupoAlDueno(titulo ? `Grupo «${esc(titulo)}» soltado. Ya no publico ni modero nada ahí. Para volver: /grupo aqui dentro del grupo.` : 'No había ningún grupo vinculado.');
      return { ok: true, vinculado: false };
    }
    if (FUNCIONES.includes(sub)) {
      const v = (a1 || '').toLowerCase();
      if (v !== 'on' && v !== 'off') { await this.grupoAlDueno(`Uso: /grupo ${sub} on  ·  /grupo ${sub} off`); return { ok: true }; }
      g.on[sub] = v === 'on';
      await this.grupoGuardar();
      await this.grupoAlDueno(`${g.on[sub] ? '✅' : '⏸'} ${NOMBRE_FUNCION[sub]}: ${g.on[sub] ? 'encendido' : 'apagado'}.`, this.grupoBotones(g));
      return { ok: true };
    }
    if (sub === 'ver' || sub === 'previa') { await this.grupoVistaPrevia((a1 || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')); return { ok: true }; }
    if (sub === 'texto') {
      const cual = (a1 || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
      const t = resto.join(' ').trim();
      if ((cual !== 'manana' && cual !== 'noche') || !t) { await this.grupoAlDueno('Uso: /grupo texto manana Tu saludo de la mañana\n/grupo texto noche Tu saludo de la noche\nPara volver al de siempre: /grupo texto manana -'); return { ok: true }; }
      if (t === '-') delete g.txt[cual]; else g.txt[cual] = t.slice(0, 200);
      await this.grupoGuardar();
      await this.grupoAlDueno(t === '-' ? 'Listo: vuelve el saludo de siempre.' : 'Listo. Así queda (solo cambia la primera línea):');
      await this.grupoVistaPrevia(cual);
      return { ok: true };
    }
    if (sub === 'permitir' || sub === 'quitar') {
      const d = String(a1 || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
      if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(d)) { await this.grupoAlDueno('Uso: /grupo permitir youtube.com  ·  /grupo quitar youtube.com'); return { ok: true }; }
      g.dom = g.dom.filter(x => x !== d);
      if (sub === 'permitir') g.dom = [...g.dom, d].slice(-20);
      await this.grupoGuardar();
      await this.grupoAlDueno(`Enlaces permitidos además del sitio oficial: ${g.dom.length ? esc(g.dom.join(', ')) : 'ninguno'}.`);
      return { ok: true };
    }
    if (sub === 'ayuda' || sub === 'help') { await this.grupoAlDueno(AYUDA); return { ok: true }; }
    await this.grupoAlDueno(this.grupoEstadoTxt(g) + (g.chat ? '\n\n' + await this.grupoPermisos(g) : ''), g.chat ? this.grupoBotones(g) : null);
    return { ok: true };
  },
  // ¿El bot puede borrar mensajes en el grupo? (para el antiespam y el saludo anterior)
  async grupoPermisos(g) {
    const bot = String((this.env && this.env.TELEGRAM_BOT_TOKEN) || '').split(':')[0];
    if (!g.chat || !/^\d+$/.test(bot)) return '';
    const r = await this.grupoTg('getChatMember', { chat_id: g.chat, user_id: Number(bot) });
    const m = r && r.ok && r.result;
    if (!m) return '⚠️ No pude comprobar mis permisos en el grupo.';
    if (m.status !== 'administrator') return '⚠️ No soy administrador del grupo: no podré borrar spam ni el saludo anterior.';
    return m.can_delete_messages ? '🛡 Permiso para borrar mensajes: sí.' : '⚠️ Soy administrador pero SIN permiso para «Eliminar mensajes»: actívalo para que funcione el antiespam.';
  },
  grupoEstadoTxt(g) {
    if (!g.chat) return '⚙️ <b>Grupo oficial:</b> ninguno vinculado.\nNo se publica nada. Para vincular: añade el bot como administrador y escribe /grupo aqui dentro del grupo.';
    this.grupoDia(g);
    return `⚙️ <b>Grupo oficial:</b> «${esc(g.titulo)}»\n` +
      FUNCIONES.map(f => `${g.on[f] ? '✅' : '⏸'} ${NOMBRE_FUNCION[f]}`).join('\n') +
      `\n\nHoy: ${g.hitosHoy}/${HITOS_POR_DIA} mensajes de hitos · ${g.spamHoy || 0} mensajes borrados por el antiespam.` +
      `\nNovedades anunciadas hasta la #${g.novN || 0} (versión ${g.ver || 0}).` +
      (g.dom.length ? `\nEnlaces permitidos: ${esc(g.dom.join(', '))}.` : '') +
      '\n\nToca un interruptor para apagar o encender, o 👁 para ver el mensaje (te llega solo a ti). Más: /grupo ayuda';
  },
  grupoBotones(g) {
    return [...FUNCIONES.map(f => [{ text: `${g.on[f] ? '✅' : '⏸'} ${NOMBRE_FUNCION[f]}`, callback_data: 'grp:t:' + f }, { text: '👁 Ver', callback_data: 'grp:v:' + f }])];
  },
  async grupoBoton(b) {
    if (b.id) await this.grupoTg('answerCallbackQuery', { callback_query_id: b.id });
    if (String(b.de) !== this.grupoDueno() || !this.grupoDueno()) return { ok: false };
    const g = await this.grupoCargar();
    const [, accion, f] = String(b.data || '').split(':');
    if (!FUNCIONES.includes(f)) return { ok: false };
    if (accion === 'v') { await this.grupoVistaPrevia(f); return { ok: true }; }
    if (accion === 't') {
      g.on[f] = !g.on[f];
      await this.grupoGuardar();
      // Se actualiza el mismo mensaje del panel (si no se puede, uno nuevo).
      const r = b.chat && b.msg ? await this.grupoTg('editMessageText', { chat_id: b.chat, message_id: b.msg, text: this.grupoEstadoTxt(g), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: this.grupoBotones(g) } }) : null;
      if (!r || !r.ok) await this.grupoAlDueno(this.grupoEstadoTxt(g), this.grupoBotones(g));
      return { ok: true };
    }
    return { ok: false };
  },
  // Vista previa: el mismo texto y los mismos botones, pero SOLO al dueño.
  async grupoVistaPrevia(f) {
    const g = await this.grupoCargar();
    const cab = n => `👁 <i>Vista previa (${n}). Solo la ves tú.</i>\n\n`;
    if (f === 'bienvenida') return this.grupoAlDueno(cab('bienvenida') + textoBienvenida(['Ana', 'Kusi'], g.titulo), BOTONES_BIENVENIDA);
    if (f === 'novedades') {
      const t = textoNovedades(NOVEDADES[0]);
      return this.grupoAlDueno(cab('novedades') + (t || 'La última entrada de novedades no tiene ninguna línea que se pueda publicar (todas hablan de pagos o cripto): no saldría nada.'), t ? BOTON_JUGAR : null);
    }
    if (f === 'hitos') return this.grupoAlDueno(cab('hitos') + armarHitos([
      { k: 'nv:1', pri: 3, txt: '⭐ <b>Kusi</b> llegó al nivel 20.' },
      { k: 'mund', pri: 2, txt: '🐉 Cayó Dragón de la Tormenta, el jefe mundial (4 cazadores).' },
      { k: 'torre', pri: 4, txt: '🗼 <b>Illa</b> llegó al piso 15 de la Torre del Duende: récord de la semana.' },
    ]) + `\n\n<i>Como mucho ${HITOS_POR_DIA} mensajes de hitos al día; si hay varios en 5 minutos salen juntos.</i>`);
    if (f === 'manana') return this.grupoAlDueno(cab('buenos días') + textoManana(Date.now(), g.txt.manana), BOTON_JUGAR);
    if (f === 'noche') return this.grupoAlDueno(cab('buenas noches') + textoNoche(Date.now(), Object.keys(g.res.sub || {}).length || g.res.mund ? g.res : { sub: { Kusi: 21, Illa: 34 }, mund: 5, mundMax: 4, racha: { n: 9, nombre: 'Kusi' }, extra: [] }, g.txt.noche), BOTON_JUGAR);
    if (f === 'antiespam') return this.grupoAlDueno(cab('aviso del antiespam') + textoAvisoSpam('Ana', 'enlace') + '\n\n<i>Se borra solo a los 45 segundos. A cada persona se le avisa una vez al día; no se expulsa a nadie.</i>');
    return this.grupoAlDueno('Uso: /grupo ver bienvenida | novedades | hitos | manana | noche | antiespam');
  },

  // ── Bienvenida ──
  async grupoEntra(b) {
    const g = await this.grupoCargar();
    if (!g.chat || !b.chat || g.chat !== b.chat || !g.on.bienvenida) return { ok: false };
    const ahora = Date.now();
    for (const k in g.ent) if (ahora - g.ent[k] > 10 * 60000) delete g.ent[k];
    const nuevos = (b.users || []).filter(u => u && u.id && !u.is_bot && !g.ent[u.id]);
    if (!nuevos.length) return { ok: true, repetido: true };
    for (const u of nuevos) g.ent[u.id] = ahora;
    const nombres = nuevos.map(nombreVisitante);
    let r;
    const previo = g.bienv;
    if (previo && previo.msg && ahora - previo.t < BIENVENIDA_VENTANA_MS) {
      // Entraron varios seguidos: el mismo mensaje, con todos los nombres.
      const todos = [...(previo.nombres || []), ...nombres];
      r = await this.grupoTg('editMessageText', { chat_id: g.chat, message_id: previo.msg, text: textoBienvenida(todos, g.titulo), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: BOTONES_BIENVENIDA } });
      if (r && r.ok) { previo.nombres = todos.slice(0, 30); await this.grupoGuardar(); return { ok: true, editado: true }; }
    }
    if (previo && previo.msg) await this.grupoTg('deleteMessage', { chat_id: g.chat, message_id: previo.msg });
    const juntos = previo && ahora - previo.t < BIENVENIDA_VENTANA_MS ? [...(previo.nombres || []), ...nombres] : nombres;
    r = await this.grupoPublicar(textoBienvenida(juntos, g.titulo), BOTONES_BIENVENIDA);
    g.bienv = r && r.ok && r.result ? { msg: r.result.message_id, t: previo && ahora - previo.t < BIENVENIDA_VENTANA_MS ? previo.t : ahora, nombres: juntos.slice(0, 30) } : null;
    await this.grupoGuardar();
    return { ok: !!(r && r.ok) };
  },
  // Al bot lo sacaron (o le quitaron el administrador) en el grupo vinculado.
  async grupoBotCambio(b) {
    const g = await this.grupoCargar();
    if (!g.chat || g.chat !== b.chat) return { ok: false };
    this._grupoAdm = null;
    if (b.estado === 'left' || b.estado === 'kicked') {
      const titulo = g.titulo; g.chat = null; await this.grupoGuardar();
      await this.grupoAlDueno(`⚠️ Me sacaron de «${esc(titulo)}». Solté el grupo: ya no publico nada ahí.`);
    } else if (b.estado && b.estado !== 'administrator') {
      await this.grupoAlDueno(`⚠️ Ya no soy administrador de «${esc(g.titulo)}»: no puedo borrar spam ni saludos viejos hasta que me devuelvas el permiso.`);
    }
    return { ok: true };
  },

  // ── Antiespam ──
  async grupoAdmins(g) {
    const c = this._grupoAdm;
    if (c && c.chat === g.chat && Date.now() - c.t < ADMINS_CACHE_MS) return c.ids;
    const r = await this.grupoTg('getChatAdministrators', { chat_id: g.chat });
    if (!r || !r.ok || !Array.isArray(r.result)) return null;   // sin la lista no se borra nada
    const ids = new Set(r.result.map(x => String(x && x.user && x.user.id)));
    this._grupoAdm = { chat: g.chat, t: Date.now(), ids };
    return ids;
  },
  async grupoMsg(msg) {
    const g = await this.grupoCargar();
    if (!msg || !msg.chat || !g.chat || g.chat !== msg.chat.id || !g.on.antiespam) return { ok: false };
    const de = msg.from || {};
    // Lista blanca: el dueño, los administradores (tambien los anonimos, que
    // escriben «como el grupo») y lo que llega del canal enlazado.
    if (String(de.id) === this.grupoDueno()) return { ok: true, blanco: true };
    if (msg.is_automatic_forward || (msg.sender_chat && msg.sender_chat.id === msg.chat.id)) return { ok: true, blanco: true };
    const motivo = motivoSpam(msg, { tme: [g.user], dominios: g.dom });
    if (!motivo) return { ok: true };
    const admins = await this.grupoAdmins(g);
    if (!admins) return { ok: false, sinAdmins: true };
    if (admins.has(String(de.id))) return { ok: true, blanco: true };
    const ahora = Date.now();
    const r = await this.grupoTg('deleteMessage', { chat_id: g.chat, message_id: msg.message_id });
    if (!r || !r.ok) {
      // Sin permiso para borrar: se le dice al dueño (una vez al dia), no al grupo.
      const hoy = diaJuego();
      if (g.sinPermiso !== hoy) { g.sinPermiso = hoy; await this.grupoGuardar(); await this.grupoAlDueno(`⚠️ Vi un mensaje con ${motivo === 'estafa' ? 'una frase de estafa' : 'spam'} en «${esc(g.titulo)}» y no pude borrarlo: dame el permiso «Eliminar mensajes».`); }
      return { ok: false, motivo };
    }
    this.grupoDia(g, ahora);
    g.spamHoy = (g.spamHoy || 0) + 1;
    for (const k in g.spam) if (ahora - g.spam[k] > AVISO_SPAM_CADA_MS) delete g.spam[k];
    let avisado = false;
    if (de.id && !g.spam[de.id]) {
      g.spam[de.id] = ahora;
      const a = await this.grupoPublicar(textoAvisoSpam(nombreVisitante(de), motivo));
      if (a && a.ok && a.result) { avisado = true; g.borrar.push({ m: a.result.message_id, t: ahora + AVISO_SPAM_BORRAR_MS }); g.borrar = g.borrar.slice(-30); }
    }
    await this.grupoGuardar();
    if (avisado) await this.programarAlarma();
    return { ok: true, borrado: true, motivo, avisado };
  },
  async grupoLimpiarAvisos(g, ahora = Date.now()) {
    const toca = g.borrar.filter(x => x.t <= ahora);
    if (!toca.length) return;
    g.borrar = g.borrar.filter(x => x.t > ahora);
    this._grupoSucio = true;
    if (g.chat) for (const x of toca) await this.grupoTg('deleteMessage', { chat_id: g.chat, message_id: x.m });
  },

  // ── Hitos (los llaman los ganchos de instalarGrupo) ──
  // Nunca lanzan ni esperan: el juego no depende de Telegram.
  grupoCon(f) {
    if (this._grupo && !this._grupo.chat) return;            // sin grupo: nada que anotar
    this.grupoCargar().then(g => { if (g.chat) f(g); }).catch(e => console.error('[Grupo hito]', e));
  },
  grupoHito(g, h) {
    if (!g.on.hitos) return;
    const vacia = !g.cola.length;
    g.cola.push({ ...h, t: Date.now() });
    if (g.cola.length > 30) g.cola = g.cola.slice(-30);
    this._grupoSucio = true;
    // El primero de la tanda adelanta la alarma (5 min); los demas se suman a ese mensaje.
    if (vacia) this.grupoGuardar().then(() => this.programarAlarma()).catch(e => console.error('[Grupo hito alarma]', e));
  },
  grupoSubio(s, nivel0) {
    const c = s && s.c;
    if (!c || (this.esPrueba && this.esPrueba(c)) || !(c.nivel > nivel0)) return;
    this.grupoCon(g => {
      const n = nombrePublico(c);
      // Resumen de la noche: el nivel mas alto de cada personaje que subio hoy.
      if (n !== 'Un duende' && (Object.keys(g.res.sub).length < 40 || g.res.sub[n])) { g.res.sub[n] = c.nivel; this._grupoSucio = true; }
      const m = hitoNivel(nivel0, c.nivel);
      if (!m) return;
      if (m >= NIVEL_MAX) {
        const primero = !g.p60;
        g.p60 = true; this._grupoSucio = true;
        this.grupoHito(g, { tipo: 'nv', k: 'nv:' + c.uid, pri: primero ? 10 : 8, txt: primero ? `👑 <b>¡Primer nivel ${NIVEL_MAX} del servidor!</b> ${esc(n)} llegó al máximo.` : `👑 <b>${esc(n)}</b> llegó al nivel ${NIVEL_MAX}, el máximo.` });
      } else this.grupoHito(g, { tipo: 'nv', k: 'nv:' + c.uid, pri: 2 + m / 10, txt: `⭐ <b>${esc(n)}</b> llegó al nivel ${m}.` });
    });
  },
  grupoMundial(nombreJefe, cazadores) {
    if (!(cazadores > 0)) return;
    this.grupoCon(g => {
      g.res.mund = (g.res.mund || 0) + 1;
      g.res.mundMax = Math.max(g.res.mundMax || 0, cazadores);
      this._grupoSucio = true;
      // Sale cada media hora: como hito, solo la primera caida del dia.
      const hoy = diaJuego();
      if (g.mundHito === hoy) return;
      g.mundHito = hoy;
      this.grupoHito(g, { tipo: 'mund', k: 'mund', pri: 2, txt: `🐉 Cayó ${esc(nombreJefe)}, el jefe mundial (${cazadores} ${cazadores === 1 ? 'cazador' : 'cazadores'}).` });
    });
  },
  grupoRacha(c) {
    const n = c && c.login && c.login.racha;
    if (!(n >= 2) || (this.esPrueba && this.esPrueba(c))) return;
    this.grupoCon(g => {
      const nom = nombrePublico(c);
      if (nom === 'Un duende' || (g.res.racha && g.res.racha.n >= n)) return;
      g.res.racha = { n, nombre: nom }; this._grupoSucio = true;
    });
  },
  grupoRecord(c, k, txt) {
    if (!c || (this.esPrueba && this.esPrueba(c))) return;
    this.grupoCon(g => {
      const linea = txt(esc(nombrePublico(c)));
      g.res.extra = [...(g.res.extra || []).filter(x => x.slice(0, 2) !== linea.slice(0, 2)), linea].slice(-3);
      this._grupoSucio = true;
      this.grupoHito(g, { tipo: 'rec', k, pri: 5, txt: linea });
    });
  },

  // Suelta los hitos en cola: uno solo si hay varios, con tope diario y sin
  // escribir de 23:00 a 8:00. Lo que no cabe en el tope queda para el resumen de la noche.
  async grupoSoltarHitos(g, ahora = Date.now()) {
    if (!g.cola.length || !g.chat) return false;
    if (!g.on.hitos) { g.cola = []; this._grupoSucio = true; return false; }
    if (enSilencio(ahora)) return false;
    if (ahora - g.cola[0].t < AGRUPAR_HITOS_MS) return false;
    this.grupoDia(g, ahora);
    const cola = g.cola; g.cola = []; this._grupoSucio = true;
    if (g.hitosHoy >= HITOS_POR_DIA) return false;
    const txt = armarHitos(cola);
    if (!txt) return false;
    g.hitosHoy++;
    await this.grupoGuardar();          // el tope se anota antes de enviar: un fallo no lo repite
    const r = await this.grupoPublicar(txt, BOTON_JUGAR);
    return !!(r && r.ok);
  },

  // ── Novedades ──
  async grupoNovedades(g, ahora = Date.now()) {
    if (!g.chat || VERSION <= (g.ver || 0)) return false;
    const nv = NOVEDADES[0];
    const hayNueva = !!nv && nv.n > (g.novN || 0);
    if (hayNueva && g.on.novedades && enSilencio(ahora)) return false;   // espera a las 8:00
    g.ver = VERSION;
    if (hayNueva) g.novN = nv.n;
    await this.grupoGuardar();          // como mucho uno por version: se anota antes de enviar
    if (!hayNueva || !g.on.novedades) return false;
    const txt = textoNovedades(nv);
    if (!txt) return false;
    const r = await this.grupoPublicar(txt, BOTON_JUGAR);
    return !!(r && r.ok);
  },

  // ── Ritual: buenos dias y buenas noches ──
  async grupoRitual(g, ahora = Date.now()) {
    if (!g.chat) return;
    const h = horaLima(ahora), hoy = diaJuego(ahora);
    if (g.man !== hoy && h >= HORA_MANANA && h < HORA_MANANA + 3) {
      g.man = hoy; await this.grupoGuardar();
      if (g.on.manana) {
        // Los hitos que esperaron a que amaneciera van en el mismo mensaje (no cuentan en el tope).
        let extra = '';
        if (g.cola.length && g.on.hitos) { const t = armarHitos(g.cola); g.cola = []; if (t) extra = '\n\n<b>Mientras dormían:</b>\n' + t.replace(/^🏅 <b>Hitos de la comunidad<\/b>\n/, ''); await this.grupoGuardar(); }
        await this.grupoPublicar(textoManana(ahora, g.txt.manana) + extra, BOTON_JUGAR);
      }
    }
    if (g.noc !== hoy && h >= HORA_NOCHE && h < SILENCIO_DESDE) {
      g.noc = hoy;
      const res = g.res; g.res = resVacio();
      await this.grupoGuardar();
      if (g.on.noche) await this.grupoPublicar(textoNoche(ahora, res, g.txt.noche), BOTON_JUGAR);
    }
  },

  // Lo llama la alarma del Durable Object (cada hora y cuando este modulo la adelanta).
  async grupoAlarma() {
    const g = await this.grupoCargar();
    const ahora = Date.now();
    await this.grupoLimpiarAvisos(g, ahora);
    if (g.chat) {
      await this.grupoNovedades(g, ahora);
      await this.grupoRitual(g, ahora);
      await this.grupoSoltarHitos(g, ahora);
    }
    if (this._grupoSucio) await this.grupoGuardar();
  },
  // Cuando necesita despertar antes de la hora en punto (0 = no hace falta).
  grupoProximo() {
    const g = this._grupo;
    if (!g) return 0;
    let t = 0;
    for (const x of g.borrar) if (!t || x.t < t) t = x.t;
    if (g.chat && g.cola.length && g.on.hitos && !enSilencio(g.cola[0].t + AGRUPAR_HITOS_MS)) { const h = g.cola[0].t + AGRUPAR_HITOS_MS; if (!t || h < t) t = h; }
    return t;
  },
};

const AYUDA = '⚙️ <b>/grupo</b> (solo tú)\n' +
  '/grupo aqui — dentro del grupo: lo vincula como grupo oficial\n' +
  '/grupo off — lo suelta (no se publica nada)\n' +
  '/grupo estado — interruptores y vistas previas\n' +
  '/grupo bienvenida|novedades|hitos|manana|noche|antiespam on|off\n' +
  '/grupo ver bienvenida|novedades|hitos|manana|noche|antiespam — te lo mando solo a ti\n' +
  '/grupo texto manana Tu saludo — cambia la primera línea (con «-» vuelve el de siempre)\n' +
  '/grupo texto noche Tu saludo\n' +
  '/grupo permitir youtube.com — deja pasar enlaces de ese dominio (quitar: /grupo quitar youtube.com)';

// Engancha el modulo SIN tocar el codigo de los demas: envuelve los metodos
// del prototipo ya mezclado. Llamar una vez, al final de world.js.
export function instalarGrupo(proto) {
  Object.assign(proto, Grupo);
  const envolver = (nombre, hacer) => { const orig = proto[nombre]; if (typeof orig === 'function') proto[nombre] = hacer(orig); };
  const seguro = (f) => { try { f(); } catch (e) { console.error('[Grupo gancho]', e); } };

  // Subidas de nivel (hitos 10/20/…/60 y el resumen de la noche).
  envolver('sumarXp', orig => function (s, xp) {
    const nivel0 = s && s.c ? s.c.nivel : 0;
    const subio = orig.call(this, s, xp);
    if (subio) seguro(() => this.grupoSubio(s, nivel0));
    return subio;
  });
  // Jefe mundial (Coliseo y 3D): cuantos cobraron de verdad.
  envolver('premiosMundial', orig => function (o, clave = 'coliseo') {
    let n = 0;
    seguro(() => {
      for (const sid of new Set([...o.dano.keys(), ...(o.cura ? o.cura.keys() : [])])) {
        const s = this.sesiones.get(sid);
        if (!s || !s.c || s.k !== clave || (this.esPrueba && this.esPrueba(s.c))) continue;
        const d = o.dano.get(sid) || 0, cu = (o.cura && o.cura.get(sid)) || 0;
        if (d < o.max * 0.003 && cu < o.max * 0.003) continue;
        n++;
      }
    });
    const r = orig.call(this, o, clave);
    seguro(() => this.grupoMundial((MONSTRUOS[o.k] && MONSTRUOS[o.k].nombre) || 'el jefe mundial', n));
    return r;
  });
  // Racha del dia (para el «mejor racha» de la noche).
  envolver('procesarLogin', orig => function (s) {
    const r = orig.call(this, s);
    if (r) seguro(() => this.grupoRacha(s.c));
    return r;
  });
  // Récord semanal de la Torre del Duende (la misma condicion que su aviso dentro del juego).
  envolver('anotarRankTorre', orig => function (s, piso) {
    seguro(() => {
      if (!s || !s.c || (this.esPrueba && this.esPrueba(s.c)) || !(piso >= TORRE.semMin) || piso % 5 !== 0 || !this.cargarRankTorre) return;
      const c = s.c;
      this.cargarRankTorre().then(rt => {
        const f = rt.l[c.uid];
        if (f && f.p >= piso) return;
        const mejor = Math.max(0, ...Object.entries(rt.l).filter(([u]) => u !== c.uid).map(([, x]) => x.p));
        if (piso > mejor) this.grupoRecord(c, 'torre', n => `🗼 <b>${n}</b> llegó al piso ${piso} de la Torre del Duende: récord de la semana.`);
      }).catch(e => console.error('[Grupo torre]', e));
    });
    return orig.call(this, s, piso);
  });
  // Récord semanal de la Cueva (en solitario): solo si le gana al mejor tiempo de OTRO jugador.
  envolver('anotarCuevaSem', orig => function (s, seg, nvCueva, gente) {
    let previo = 0;
    seguro(() => { const l = (this.rcs && this.rcs.l) || {}; for (const u in l) if (u !== s.c.uid && l[u].seg > 0 && (!previo || l[u].seg < previo)) previo = l[u].seg; });
    const r = orig.call(this, s, seg, nvCueva, gente);
    seguro(() => {
      const f = this.rcs && this.rcs.l && this.rcs.l[s.c.uid];
      if (!previo || !f || f.seg !== seg || !(seg < previo)) return;
      const mmss = `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;
      this.grupoRecord(s.c, 'cueva', n => `⛏ <b>${n}</b> hizo la Cueva de los Goblins en ${mmss}: récord de la semana.`);
    });
    return r;
  });
  // Alarma: primero lo del grupo (asi programarAlarma ya ve lo que queda pendiente).
  envolver('alarm', orig => async function () {
    try { await this.grupoAlarma(); } catch (e) { console.error('[Grupo alarma]', e); }
    return orig.call(this);
  });
  envolver('programarAlarma', orig => async function () {
    await orig.call(this);
    try {
      const st = this.state.storage, p = this.grupoProximo();
      if (!p || !st.setAlarm || !st.getAlarm) return;
      const actual = await st.getAlarm();
      if (!actual || actual > p) await st.setAlarm(Math.max(p, Date.now() + 2000));
    } catch (e) { console.error('[Grupo setAlarm]', e); }
  });
  // /interno/grupo (misma clave que el resto de rutas internas).
  envolver('interno', orig => async function (request, accion) {
    if (accion !== 'grupo') return orig.call(this, request, accion);
    if (!this.env.TELEGRAM_BOT_TOKEN || request.headers.get('x-interno') !== this.env.TELEGRAM_BOT_TOKEN) return new Response('no', { status: 403 });
    let b = {};
    try { b = await request.json(); } catch (e) {}
    let r;
    try { r = await this.grupoInterno(b); } catch (e) { console.error('[Grupo interno]', e); r = { ok: false, error: true }; }
    return new Response(JSON.stringify(r || { ok: false }), { headers: { 'Content-Type': 'application/json' } });
  });
}
