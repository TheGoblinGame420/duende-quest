// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — grupos y chat (al estilo WoW)
//
// Se mezcla en MmoWorld (Object.assign sobre su prototipo).
//
// Grupos de hasta 5 (una banda, hasta 10): se invita desde el marco del objetivo o desde la lista
// de jugadores. Los miembros se guardan por uid (no por sesion), asi quien se
// desconecta un momento vuelve a su grupo al entrar. Viven en memoria: un
// despliegue (que reinicia el Durable Object) los disuelve.
//
// Chat: general (todo el servidor), decir (/d, solo tu mapa), grupo (/g),
// hermandad (/h) y susurro (/s Nombre texto).
//
// Buscar grupo: te anuncias para una mazmorra (10 min) y quien tenga nivel
// se une con un toque, sin esperar a que aceptes (el lider puede expulsar).
// ═══════════════════════════════════════════════════════
import { MAPAS, MAZMORRAS, BANDA_MAX, GESTOS, hoyUTC, statsMonstruo } from '../../mmo/js/data.js';
import { CUEVA } from '../../mmo/js/cueva3d.js';

export const GRUPO_MAX = 5;
// Un grupo convertido en banda (boton del lider o al buscar gente para la
// banda) admite hasta 10.
export const maxGrupo = g => (g && g.banda ? BANDA_MAX : GRUPO_MAX);
// Identificador publico de un personaje: el uid real es "tg:<id de
// Telegram>" o el de la cuenta web, y no debe llegar a otros jugadores.
// Un id al azar por uid, guardado en memoria durante este arranque del
// servidor. Antes era un hash FNV con sal, pero se podia invertir partiendo
// del pid propio y sacar el id de Telegram de otros. Cambia en cada despliegue:
// lo que el cliente recuerda en su navegador usa yo.ck (world.js datosPropios).
const PUB = new Map();
export function pub(uid) {
  let p = PUB.get(uid);
  if (!p) { p = crypto.randomUUID().replace(/-/g, '').slice(0, 12); PUB.set(uid, p); }
  return p;
}
const INVITACION_MS = 60000;
export const CONTACTOS_MAX = 50;      // amigos en la lista de cada personaje
export const LFG_MS = 10 * 60000;       // cuanto dura un anuncio de "busco grupo"
const LFG_CADA_MS = 60000;              // y cada cuanto se puede volver a anunciar
// ORIGINS: buscar grupo para la Cueva de los Goblins (Nv 5+, hasta CUEVA.max).
// Solo se anuncia y se ve entre jugadores del mundo 3D (s.m3).
const LFG_CUEVA = { nombre: CUEVA.nombre, nv: [5], max: CUEVA.max };
const lfgDef = id => (id === 'cueva' ? LFG_CUEVA : MAZMORRAS[id]);
// Fuera tambien los invisibles: ancho cero y marcas bidi (U+202E daba la
// vuelta al texto para disfrazarlo). El U+200D se deja: lo usan los emojis compuestos.
// Fuera tambien los invisibles (U+00AD, U+034F, U+3164…) que partian «www» o una frase semilla y saltaban el filtro.
const limpiar = t => String(t || '').replace(/[\u0000-\u001f\u007f­͏ᅟᅠ᠎​-‏‪-‮⁠-⁯ㅤ﻿]/g, '').replace(/[᠋-᠍ﾠ]|[\u{E0000}-\u{E007F}]/gu, '').trim().slice(0, 120);

// Antiestafa (juego con cripto): ni direcciones de cartera, ni enlaces, ni
// frases semilla en el chat. Nadie del equipo pide nunca la frase semilla.
const RE_ESTAFA = [
  /\b(?=[A-Za-z0-9]*\d)[1-9A-HJ-NP-Za-km-z]{32,44}\b/,  // direccion Solana (base58, con algun digito: «jajaja…» no cuenta)
  /\b(?:EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}\b/,               // direccion TON
  /\b0x[a-fA-F0-9]{40}\b/,                              // direccion EVM
  /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|discord\.gg\/)/i,
  /\b[a-z0-9-]{2,}\.(?:com|io|xyz|net|org|app|gg|link|site|online|click|shop|dev|ly|gd|gy|gl|lat|top|vip|club|store|live|info|biz|icu|cfd|sbs|fun|tk|gq|pw|ws|cc|win|bet|cash|money|pro|tv|website|space|page|pages)\b/i,
  // Terminaciones que tambien son palabras («ya.pe», «ok.me»): solo con ruta o en dominios de dos partes.
  /\b[a-z0-9-]{2,}\s*\.\s*(?:me|co|to|pe|es|la|ar|mx|cl|br|ai|in|it|us|be|so|sh)\/[a-z0-9]/i,
  // Sin ruta tambien caen si imitan al premio («chicha.pe», «premio.pe»); «ya.pe» sigue libre.
  /\b[a-z0-9-]*(?:chicha|premio|duende|token|reclam|envio|asiri|yape|plin|sorteo)[a-z0-9-]*\.(?:me|co|to|pe|es|la|ar|mx|cl|br|ai|in|it|us|be|so|sh)\b/i,
  /\b[a-z0-9-]{2,}\.(?:co|gob|edu)\.[a-z]{2}\b/i,
  /(?:^|[^a-z0-9])(?:wa|t)\.me\b/i,
  // Con espacios o en palabras: «bit . ly», «chicha punto com», «chicha(dot)xyz».
  /\b[a-z0-9-]{2,}\s*(?:\.\s+|\s+\.\s*|[([]\s*(?:dot|punto)\s*[)\]]|\s+(?:dot|punto)\s+)\s*(?:com|net|org|xyz|ly|dev|site|shop|link)\b/i,
  /\b[a-z0-9-]{2,}\s*[([]\s*(?:dot|punto|\.)\s*[)\]]\s*[a-z]{2,}\b/i,
  /\b(?:seed phrase|seed|frase semilla|semilla de (?:tu |la )?(?:wallet|cartera|billetera)|mnemonic|clave privada|private key|frase de recuperaci[oó]n|12 palabras|24 palabras)\b/i,
];
// El unico dominio que se puede escribir (con sus rutas). Ni «…workers.dev.otro.com», ni «…workers.dev@otro.com»,
// ni «x-duende-quest…», ni otro dominio escondido en la ruta («…workers.dev/?u=otro.com»): esos siguen bloqueados. Con dominio propio, se añade aqui.
const DOMINIO_OFICIAL = /(?<![\w.@-])(?:https?:\/\/)?duende-quest\.alfonso12hc\.workers\.dev(?:[/?#][\w\-/?=&#%]*(?:\.html)?)?(?![\w@-]|[.:][a-z0-9/])/gi;
// Estafas de la chicha y de cobros por chat: pedir plata por un envio, un deposito, un yape o un premio.
// Hablar del premio, del banco del juego o de pagar con oro NO cae aqui («reclamo mi chicha», «deposita oro en la bóveda»).
// Tambien la forma de escribirlo en Peru («S/. 20»), en palabras («cinco soles») y en dolares.
const PLATA = '(?:\\d+\\s*(?:sol(?:es?)?|lucas|lukas|luquitas|dolares|usd)\\b|(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cincuenta|cien)\\s+(?:soles|lucas|lukas|dolares)\\b|s\\/\\.?\\s*\\d|\\$\\s*\\d)';
// Con el usted y el plural («paguen», «envie», «mande»): quien estafa escribe asi tan a menudo como «paga».
const PAGAR = '(?:pag(?:a|ue)\\w*|abon[ae]\\w*|mand[ae]\\w*|envi[ae]\\w*|transfier\\w*)';
const ENVIO = '(?:envio|flete|delivery|courier)';
const RE_ESTAFA_COBRO = [
  /\b(?:yapea(?:me|le|nos|r)?|yapeo|yapeas|yapeen|plinea(?:me|le|nos|r)?|plineo|plinean)\b/,
  /\b(?:por|al|a mi|mi|tu) (?:yape|plin)\b/,
  /\b(?:yape|plin)\b.{0,40}\b(?:pag(?:a|ue)\w*|pago|abon[ae]\w*|cancel[ae]\w*|deposit\w*|envio|envi[ae]\w*|mand[ae]\w*|premio|chicha|soles|numero|transfer\w*)\b/,
  /\b(?:pag(?:a|ue)\w*|pago|abon[ae]\w*|cancel[ae]\w*|deposit\w*|envio|envi[ae]\w*|mand[ae]\w*|premio|chicha|soles|numero|transfer\w*)\b.{0,40}\b(?:yape|plin)\b/,
  /\b(?:depositame|depositale|depositenme|depositarme)\b/,
  new RegExp('\\bdeposit\\w*\\b.{0,30}(?:' + PLATA + '|\\bsoles\\b|\\blucas\\b|\\bdinero\\b(?!.{0,25}\\b(?:boveda|banco|cofre|alcancia)\\b)|\\bbcp\\b|\\binterbank\\b|\\bbbva\\b|\\bscotiabank\\b|\\b(?:a|en) (?:mi|esta|la siguiente) cuenta\\b)'),
  new RegExp('(?:' + PLATA + '|\\bsoles\\b|\\bbcp\\b|\\binterbank\\b|\\bbbva\\b).{0,30}\\bdeposit\\w*\\b'),
  // «¿quién paga el envío?» y «no pagues el envío» no piden plata: esos pasan.
  new RegExp('(?<!\\bquien (?:se )?|(?:^|[.,;!?¿¡]\\s*)no (?:se )?)\\b(?:pag(?:a|ue)\\w*|pago|abon[ae]\\w*|cancel[ae]\\w*|deposit\\w*|adelant[ae]\\w*|transfier\\w*)\\b(?:\\s+\\S+){0,4}?\\s+(?:el|tu|su|del|por|de|al|mi)\\s+(?:\\S+\\s+){0,2}?' + ENVIO + '\\b'),
  new RegExp('\\b(?:gastos?|costos?|cobro|cargo|pago|precio)\\s+(?:de|del|por)\\s+(?:el\\s+|tu\\s+|su\\s+)?' + ENVIO + '\\b'),
  new RegExp(PLATA + '\\s+(?:de|del|por|para)\\s+(?:el\\s+|tu\\s+)?' + ENVIO + '\\b'),
  new RegExp('\\b' + ENVIO + '\\b.{0,25}' + PLATA),
  // La botella se vende y se habla de su precio: con «chicha» solo cuenta si se pide pagar.
  new RegExp('\\b' + PAGAR + '\\b.{0,20}' + PLATA),
  new RegExp('\\b(?:premio|chicha|litros?|ganaste|sorteo)\\b.{0,40}\\b' + PAGAR + '\\b.{0,30}' + PLATA),
  new RegExp('\\b(?:premio|ganaste|sorteo|ganador\\w*)\\b.{0,40}' + PLATA),
  /\b(?:ganaste|tu premio|te toco|eres (?:el |la )?ganador\w*)\b.{0,50}\b(?:escribe(?:me|nos|le)|escribe (?:a|al|por|en)|contacta\w*|llama(?:me|nos)|comunicate|tus datos|dni)\b/,
  /\b(?:reclam\w*|cobra\w*)\b.{0,30}\b(?:premio|chicha|litros?)\b.{0,30}\b(?:escribe\w*|privado|interno|conmigo|link|enlace|dm|md)\b/,
  /\b(?:escribe(?:me|nos)|hablame|contacta(?:me|nos)|(?:por|al) (?:privado|interno)|dm|md)\b.{0,40}\b(?:premio|chicha|litros?)\b/,
];
// Se mira tambien una copia en NFKC y sin marcas ni invisibles: un selector de
// variacion (U+FE0F) o una etiqueta (U+E0020) dentro de «t.me» o «seed» saltaba el filtro.
const normEstafa = t => String(t || '').normalize('NFKC').replace(/[\p{M}\p{Cf}︀-️᠋-᠍ﾠ⠀ㅤᅟᅠ]|[\u{E0000}-\u{E007F}]/gu, '').replace(/。/g, '.');
// Minusculas y sin tildes. La otra copia deshace letras por numeros y letras sueltas («d3p0sita», «y a p e a m e»).
const llano = t => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const sinLeet = t => t.replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$/g, 's').replace(/\b(\w)[\s._*-]+(?=\w\b)/g, '$1');
export const riesgoEstafa = t => {
  const crudo = String(t || '').replace(DOMINIO_OFICIAL, ' '), n = normEstafa(t).replace(DOMINIO_OFICIAL, ' '), b = llano(n), bl = sinLeet(b);
  return RE_ESTAFA.some(r => r.test(crudo) || r.test(n)) || RE_ESTAFA_COBRO.some(r => r.test(b) || r.test(bl));
};
// Chat seguro para menores: groserias se tapan con asteriscos (tambien vetan nombres en dios.js).
// Sin \w* tras marica/verga: "Maricarmen" y "Vergara" son nombres de verdad.
export const RE_GROSERIA = /\b(?:put[ao]s?|putamadre|mierd[\wáéíóúñ]*|conchatumadre|ctm|csm|huev[oó]n[\wáéíóúñ]*|cojud[\wáéíóúñ]*|pendej[\wáéíóúñ]*|maric(?:as?|[oó]n[\wáéíóúñ]*)|cabr[oó]n[\wáéíóúñ]*|vergas?|pinga[\wáéíóúñ]*|poronga[\wáéíóúñ]*|cach[ae]r[\wáéíóúñ]*|porno[\wáéíóúñ]*|nudes?|violar[\wáéíóúñ]*|ptm[r]?|conchatumare|conchasumadre|conchasumare|concha\s*tu\s*madre|csmr|ctmr|chucha|w[e]b[oó]n|we[oó]n|hdp|mrd|zorra|pajer[oa]s?|marac[oa]s?)(?![\wáéíóúñ])/gi;
// Ni telefonos, ni redes, ni preguntas de datos personales (edad, casa, colegio, fotos).
const RE_CONTACTO = [/(?:(?<!\d)|(?<=(?<!\d)\+?51))9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}(?!\d)/, /\b(?:wsp|whats?app|wasap|watsap|wpp|snap(?:chat)?|n[uú]mero de cel)\b/i, /\b(?:mi|tu|su|dame|pasa(?:me)?|p[aá]same|agr[eé]game|escr[ií]beme|h[aá]blame|s[ií]gueme)\s+(?:al\s+|por\s+|en\s+|el\s+|tu\s+|su\s+)?(?:insta(?:gram)?|tiktok|face(?:book)?|discord|n[uú]mero)\b/i, /\b(?:dame|pasa(?:me)?|p[aá]same|agr[eé]game|escr[ií]beme|h[aá]blame)\s+(?:al\s+|por\s+|en\s+|el\s+|tu\s+|su\s+)?cel(?:ular)?\b/i,/(?:^|\s)@[a-z0-9_.]{3,}/i, /\b(?:cu[aá]ntos a[nñ]os tienes|d[oó]nde vives|tu direcci[oó]n|tu colegio|manda foto)\b/i];
// Preguntas tipicas de grooming y numeros sueltos: se prueban en minusculas y sin tildes.
const RE_CONTACTO2 = [/\b(?:que edad|edad tienes|cual es tu edad)\b/, /\b(?:manda|mandame|pasa|pasame)\s+(?:una\s+|tu\s+|tus\s+)?fotos?\b/, /\b(?:mi|tu|su|al)\s+(?:ig|tg|insta|instagram|telegram|face|facebook|tiktok)\b/, /\b(?:que|cual)\s+colegio\b|\bcolegio\s+estudias\b/, /\b(?:en que distrito|vives en|tienes novi[oa]|eres (?:chica|chico|mujer|hombre))\b/, /\btu\s+cel(?:ular)?\b/, /(?<!\d)9(?:\d{8}|(?:[\s.-]\d){8})(?!\d)/];
// Telefono disfrazado: «9167 78732», «916/778/732», «9l6 778 732», «nueve uno seis siete…».
// No caen una vida («9000/10000») ni cifras redondas seguidas («9000 10000», «9500/12000»).
const NUM_PALABRA = { cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const NUM_LETRA = { l: 1, i: 1, o: 0, z: 2, e: 3, a: 4, s: 5, t: 7, b: 8, g: 9 };
// Separador: cualquier cosa que no sea letra ni cifra («916🔥778🔥732», «916;778;732»).
const RE_TEL_SEPARADO = /(?<!\d)(?:0{0,2}51)?9(?:[^\p{L}\p{N}]{0,3}\d){8}(?!\d)/gu;
// Cualquier forma de escribir WhatsApp, tambien deletreada («w s p», «guasap», «whats4pp»).
const RE_WSP = /\b(?:wh?at?s+app?|w[s5]a?pp?|wpp|guas+ap+|waz+ap+)\b/;
const RE_TEL_LETRAS = /\bnovecient[oa]s(?:\s+(?:y\s+)?(?:[a-z]*cient[oa]s|cien|diez|once|doce|trece|catorce|quince|dieci[a-z]+|veinti[a-z]+|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|cero)\b){3,}/;
export const telefonoDisfrazado = t => {
  const b = llano(normEstafa(t)).replace(/_/g, ' ');
  if (RE_TEL_LETRAS.test(b)) return true;
  const c = b.replace(/\b(?:cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g, x => NUM_PALABRA[x])
    .replace(/\b[0-9a-z]*\d[0-9a-z]*\b/g, x => (/^[0-9lizeastbgo]+$/.test(x) ? x.replace(/[a-z]/g, l => NUM_LETRA[l]) : x))
    .replace(/(?<=\d[\s.,\/-]{1,3})l(?=[\s.,\/-]{1,3}\d)/g, '1');
  for (const m of c.matchAll(RE_TEL_SEPARADO)) {
    const g = m[0].match(/\d+/g);
    if (g.length === 2 && m[0].includes('/')) continue;
    if (g.length >= 2 && g.every(x => x.endsWith('00'))) continue;
    // Tampoco una lista de horas («9:30 10:45 12:00») ni una cuenta seguida («9 10 11 12 13»).
    if (/^\d{1,2}[.:]\d{2}\s+\d{1,2}[.:]\d{2}\s/.test(m[0])) continue;
    if (g.length >= 4 && g.every((x, i) => !i || +x === +g[i - 1] + 1)) continue;
    return true;
  }
  return false;
};
export const riesgoContacto = t => { const n = normEstafa(t); if (RE_CONTACTO.some(r => r.test(t) || r.test(n))) return true; const b = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return RE_CONTACTO2.some(r => r.test(b)) || RE_WSP.test(b) || RE_WSP.test(sinLeet(b)) || telefonoDisfrazado(t); };
// Copia normalizada para pillar letras disfrazadas (put@, p u t a, m1erda).
const normGroseria = t => normEstafa(t).normalize('NFKC').toLowerCase().replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/3/g, 'e').replace(/\$/g, 's').replace(/\b(\w)[\s._*-]+(?=\w\b)/g, '$1');
// Se quitan antes las groserias normales (esas van con asteriscos) para que "puta m1erda" no deje pasar la disfrazada.
export const groseriaDisfrazada = t => { const re = new RegExp(RE_GROSERIA.source, 'i'); return re.test(normGroseria(String(t || '').replace(RE_GROSERIA, ' '))); };
export const IGNORADOS_MAX = 50;
const REPORTE_CADA_MS = 60000;
// No le llega a quien ignora al autor.
export const meIgnora =(x, uid) => !!(x.c && x.c.ignorados && x.c.ignorados.includes(uid));
// Cercanía para gestos y marcas: en el 3D (s.p) misma instancia y distancia al
// cuadrado menor que d2; en el 2D (sin s.p) cuenta como cerca todo el mapa.
const cercaSoc = (a, b, d2) => !(a.p && b.p) || ((a.i3 || 0) === (b.i3 || 0) && (a.p.x - b.p.x) ** 2 + (a.p.z - b.p.z) ** 2 < d2);

export const Social = {
  iniciarSocial() {
    if (!this.grupos) { this.grupos = new Map(); this.sigGrupo = 1; }
  },
  grupoDe(s) { this.iniciarSocial(); return s && s.gid ? this.grupos.get(s.gid) || null : null; },
  // Sesiones conectadas de un grupo (los desconectados no tienen sesion).
  sesionesGrupo(g) { return g ? g.uids.map(u => this.porUid.get(u)).filter(x => x && x.c && !x.cerrado) : []; },
  mismoGrupo(a, b) { return !!(a && b && a.gid && a.gid === b.gid); },

  // ── INVITAR ──
  invitar(s, m) {
    this.iniciarSocial();
    // Por nombre (amigos que llegan por el mismo anuncio, sin enlace) o por id de sesion.
    const nom = typeof m.n === 'string' ? limpiar(m.n).slice(0, 24) : '';
    const t = nom ? [...this.sesiones.values()].find(x => x.c && !x.cerrado && String(x.c.nombre || '').toLowerCase() === nom.toLowerCase()) : this.sesiones.get(m.p | 0);
    if (nom && !t) return this.no(s, `No encontré a «${nom}» conectado. Revisa cómo se escribe su nombre.`);
    if (nom && t === s) return this.no(s, 'Ese es tu nombre: escribe el de tu amigo.');
    if (!t || !t.c || t === s) return;
    const g = this.grupoDe(s);
    if (g && g.lider !== s.c.uid) return this.no(s, 'Solo el líder del grupo puede invitar.');
    if (g && g.uids.length >= maxGrupo(g)) return this.no(s, g.banda ? `La banda ya está llena (${BANDA_MAX}).` : `El grupo ya está lleno (${GRUPO_MAX}). El líder puede convertirlo en banda (hasta ${BANDA_MAX}).`);
    if (t.gid) return this.no(s, `${t.c.nombre} ya está en un grupo.`);
    // Quien te ignora no recibe tus invitaciones (respuesta neutra, sin avisarle).
    if (meIgnora(t, s.c.uid)) return this.no(s, `${t.c.nombre} no acepta invitaciones tuyas.`);
    if (t.invitacion && t.invitacion.hasta > Date.now() && t.invitacion.de !== s.c.uid) return this.no(s, `${t.c.nombre} ya tiene una invitación pendiente.`);
    // Una invitacion cada 10 s a la misma persona (si no, se le inundaba de ventanas).
    s.invT = s.invT || {};
    if (Date.now() - (s.invT[t.id] || 0) < 10000) return this.no(s, 'Espera un poco antes de volver a invitarlo.');
    s.invT[t.id] = Date.now();
    t.invitacion = { de: s.c.uid, hasta: Date.now() + INVITACION_MS };
    this.enviar(t, { t: 'invitacion', de: s.c.nombre, nv: s.c.nivel, cl: s.c.clase || '', ms: INVITACION_MS });
    this.enviar(s, { t: 'toast', m: `📨 Invitaste a ${t.c.nombre} a tu grupo.` });
  },
  // 📲 Enlace «Invitar a mi grupo» (#g=codigo o startapp=g_codigo; codigo = c.ref, amigos.js):
  // quien lo toca recibe la invitacion de grupo del dueño del codigo, con su ventana de
  // Aceptar (nadie entra a un grupo sin querer). Ningun mensaje de Telegram.
  // q: llego por el ?ref= de siempre (enlace del bot): si no se puede, sin avisos.
  async unirmeRef(s, m) {
    this.iniciarSocial();
    if (!s || !s.c || !m) return;
    const ref = String(m.ref || ''), q = !!m.q;
    const no = t => (q ? undefined : this.no(s, t));
    if (!/^[a-z0-9]{6}$/.test(ref)) return;
    if (Date.now() - (s.unirRefT || 0) < 10000) return no('Espera unos segundos antes de volver a usar el enlace.');
    // Freno por cuenta (no por sesion: recargar no lo salta).
    if (!this._unirRefU) this._unirRefU = new Map();
    if (Date.now() - (this._unirRefU.get(s.c.uid) || 0) < 10000) return no('Espera unos segundos antes de volver a usar el enlace.');
    this._unirRefU.set(s.c.uid, Date.now());
    if (this._unirRefU.size > 5000) { const lim = Date.now() - 60000; for (const [k, t] of this._unirRefU) if (t < lim) this._unirRefU.delete(k); }
    s.unirRefT = Date.now();
    const uid = await this.state.storage.get('ref:' + ref);
    if (!uid || s.cerrado) return;
    if (uid === s.c.uid) return no('Ese es tu propio enlace: compártelo con tus amigos.');
    const d = this.porUid.get(uid);
    if (!d || !d.c || d.cerrado) return no('Tu amigo no está conectado ahora. Pídele que entre y vuelve a tocar el enlace.');
    // Solo vale si el dueño armo el enlace hace poco («📲 Invitar a mi grupo», 2 h y 6 usos);
    // el codigo c.ref es publico (marcas de agua): sin esto cualquiera se metia a su grupo.
    // Su propio invitado (llego por su ?ref=) siempre puede.
    const esSuInvitado = s.c.invitadoPor === uid;
    let gl = this._grupoLinkU && this._grupoLinkU.get(uid);   // mundo3d.js 'grupoLink' (por cuenta: sobrevive a reconexiones)
    // Tras un despliegue el Map viene vacio: se recupera de storage (glink:uid).
    if (!gl && !esSuInvitado) {
      let g2 = null;
      try { g2 = await this.state.storage.get('glink:' + uid); } catch (e) {}
      if (s.cerrado || d.cerrado) return;
      if (this._grupoLinkU && this._grupoLinkU.get(uid)) gl = this._grupoLinkU.get(uid);   // el dueño lo armo (o otro mensaje lo cargo) durante la espera
      else if (g2 && typeof g2 === 'object') {
        if (!this._grupoLinkU) this._grupoLinkU = new Map();
        gl = this._grupoLinkU.get(uid) || g2;   // otro mensaje pudo cargarlo mientras se esperaba
        this._grupoLinkU.set(uid, gl);
      }
    }
    if (gl && !(gl.hasta > Date.now())) {   // caducado: fuera de memoria y de storage
      if (this._grupoLinkU && this._grupoLinkU.get(uid) === gl) this._grupoLinkU.delete(uid);
      try { this.state.storage.delete('glink:' + uid); } catch (e) {}
      gl = null;
    }
    if (!esSuInvitado && !(gl && gl.hasta > Date.now() && gl.n < 6)) return no(`El enlace de grupo de ${d.c.nombre} ya no sirve: pídele uno nuevo desde «📲 Invitar a mi grupo».`);
    // Quien te ignora no te mete en su grupo (respuesta neutra); si tu lo ignoras, nada.
    if (meIgnora(s, uid)) return;
    if (meIgnora(d, s.c.uid)) return no(`${d.c.nombre} no acepta invitaciones tuyas.`);
    if (s.gid) {
      const gs = this.grupoDe(s);
      if (gs && gs.uids.includes(uid)) return no(`Ya estás en el grupo de ${d.c.nombre}.`);
      return no('Ya estás en un grupo: sal de él para unirte al de tu amigo.');
    }
    const g = this.grupoDe(d);
    if (g && g.lider !== uid) return no(`${d.c.nombre} está en un grupo y no es el líder: pídele al líder que te invite.`);
    if (g && g.uids.length >= maxGrupo(g)) return no(`El grupo de ${d.c.nombre} ya está lleno.`);
    const wi = g && g.inst && this.mundo[g.inst];
    if (wi && wi.inst && wi.inst.k && !wi.inst.completada) return no('Ese grupo ya está dentro de un Desafío: pide al líder que te invite.');
    // Ya tiene esa misma invitacion (al llegar como invitado nuevo, amigos.js): no se repite la ventana.
    if (s.invitacion && s.invitacion.hasta > Date.now() && s.invitacion.de === uid) return;
    if (!esSuInvitado && gl) {
      gl.n++;   // como mucho 6 escrituras por enlace
      try { this.state.storage.put('glink:' + uid, { hasta: gl.hasta, n: gl.n }); } catch (e) {}
    }
    s.invitacion = { de: uid, hasta: Date.now() + INVITACION_MS };
    this.enviar(s, { t: 'invitacion', de: d.c.nombre, nv: d.c.nivel, cl: d.c.clase || '', ms: INVITACION_MS });
    if (Date.now() - (d.refToastT || 0) > 60000) {
      d.refToastT = Date.now();
      this.enviar(d, { t: 'toast', m: `📲 ${s.c.nombre} entró con tu enlace: le llegó tu invitación de grupo.` });
    }
  },

  respuestaGrupo(s, m) {
    this.iniciarSocial();
    const inv = s.invitacion;
    s.invitacion = null;
    if (!inv || inv.hasta < Date.now()) return this.no(s, 'Esa invitación ya caducó.');
    const lider = this.porUid.get(inv.de);
    if (!m.si) { if (lider) this.enviar(lider, { t: 'toast', m: `${s.c.nombre} rechazó tu invitación.` }); return; }
    if (!lider || !lider.c) return this.no(s, 'Quien te invitó ya no está conectado.');
    if (s.gid) return this.no(s, 'Ya estás en un grupo.');
    let g = this.grupoDe(lider);
    // Una invitacion vieja de quien luego se unio al grupo de otro no vale:
    // solo el lider mete gente (y dentro de un Desafio, solo a quien el elige).
    if (g && g.lider !== inv.de) return this.no(s, 'Quien te invitó ya no es el líder de su grupo.');
    if (!g) {
      g = { id: this.sigGrupo++, lider: lider.c.uid, uids: [lider.c.uid] };
      this.grupos.set(g.id, g);
      lider.gid = g.id;
    }
    if (g.uids.length >= maxGrupo(g)) return this.no(s, 'El grupo ya está lleno.');
    g.uids.push(s.c.uid);
    s.gid = g.id;
    this.avisarGrupo(g, `👥 ${s.c.nombre} se unió al grupo.`);
    this.enviarGrupo(g);
    this.amigosPorGrupo(s, lider);
  },
  // Quien acepta una invitacion y quien invito quedan como amigos mutuos (asi
  // al dia siguiente se ven conectados). No con invitados de nivel < 2 ni si uno ignora al otro.
  amigosPorGrupo(a, b) {
    if (!a || !b || !a.c || !b.c || a === b) return;
    const novato = x => x.c.uid.startsWith('inv:') && (x.c.nivel || 1) < 2;
    if (novato(a) || novato(b) || meIgnora(a, b.c.uid) || meIgnora(b, a.c.uid)) return;
    for (const [x, y] of [[a, b], [b, a]]) {
      const l = x.c.contactos || (x.c.contactos = []);
      if (l.some(c => c.u === y.c.uid) || l.length >= CONTACTOS_MAX) continue;
      l.push({ u: y.c.uid, n: y.c.nombre });
      x.sucio = true;
      this.enviar(x, { t: 'toast', ok: true, m: `⭐ ${y.c.nombre} ya está en tus amigos: verás cuándo se conecta.` });
      if (this.enviarContactos) this.enviarContactos(x);
    }
  },
  // Caza juntos (ORIGINS, matar3d): quien comparte una presa queda en «Jugaste
  // con» del otro (s.recientes: solo en memoria, 10 como mucho, sin uid). Si dos
  // sin grupo que pegaron suman 2 bajas juntos en menos de 3 min, se les ofrece
  // hacer grupo: una vez por pareja cada 30 min, solo dentro del juego.
  cazaJuntos(ses, o) {
    const l = ses.filter(x => x && x.c && !x.cerrado).slice(0, 8);
    if (l.length < 2) return;
    const ahora = Date.now();
    const novato = x => x.c.uid.startsWith('inv:') && (x.c.nivel || 1) < 2;
    const pego = x => !!(o && o.dano && o.dano.has(x.id));
    for (const a of l) for (const b of l) {
      if (a === b || a.c.uid === b.c.uid || meIgnora(a, b.c.uid) || meIgnora(b, a.c.uid)) continue;
      const r = a.recientes || (a.recientes = []), pb = pub(b.c.uid), i = r.findIndex(z => z.pub === pb);
      if (i >= 0) r.splice(i, 1);
      r.unshift({ pub: pb, nombre: b.c.nombre, t: ahora });
      if (r.length > 10) r.length = 10;
      // Ayni: el veterano (a) que caza junto a un novato (b, Nv 12 o menos, 5+ niveles menos) y ambos pegaron.
      if (pego(a) && pego(b) && this.mismoGrupo(a, b) && (a.c.nivel || 1) >= (b.c.nivel || 1) + 5 && (b.c.nivel || 1) <= 12) this.ayniCaza(a, b, o, ahora);
      if (a.gid || b.gid || novato(a) || novato(b) || !pego(a) || !pego(b)) continue;
      const co = a.coop || (a.coop = new Map());
      let e = co.get(b.c.uid);
      if (!e || ahora - e.t > 180000) e = { n: 0, t: ahora };
      e.n++;
      co.delete(b.c.uid); co.set(b.c.uid, e);
      if (co.size > 20) co.delete(co.keys().next().value);
      const of = a.coopOf || (a.coopOf = new Map());
      if (e.n < 2 || ahora - (of.get(b.c.uid) || 0) < 30 * 60000) continue;
      of.set(b.c.uid, ahora);
      if (of.size > 20) of.delete(of.keys().next().value);
      co.delete(b.c.uid);
      // ofreceGrupo: el id de sesion (lo que pide invitar), como en las listas de amigos.
      this.enviar(a, { t: 'toast', ofreceGrupo: b.id, n: b.c.nombre, m: `🤝 Cazaste junto a ${b.c.nombre}. ¿Hacen grupo? (+exp compartida)` });
    }
  },
  // Ayni (ayuda mutua andina): premio al veterano que ayuda a un novato y un empujon de XP al novato.
  // Una vez por pareja cada 10 min; el veterano cobra como mucho 10 al dia (dia de Lima). Solo oro del juego.
  ayniCaza(a, b, o, ahora) {
    // Mismo telefono o misma IPv6: es la misma persona con dos cuentas, no hay ayni.
    const mismoDisp = (a.dev && a.dev === b.dev) || (a.ip && a.ip.includes(':') && a.ip === b.ip);
    if (mismoDisp) return;
    // Un invitado Nv 1 recien creado no es un novato de verdad (anti-farmeo con cuentas de usar y tirar).
    if (b.c.uid.startsWith('inv:') && (b.c.nivel || 1) < 2) return;
    const par = this.ayniPar || (this.ayniPar = new Map());
    const clave = a.c.uid + '|' + b.c.uid;
    if (ahora - (par.get(clave) || 0) < 10 * 60000) return;
    par.set(clave, ahora);
    if (par.size > 2000) for (const [k, t] of par) if (ahora - t >= 10 * 60000) par.delete(k);
    const c = a.c, hoy = hoyUTC();
    if (!c.ayniDia || c.ayniDia.d !== hoy) c.ayniDia = { d: hoy, n: 0, u: [] };
    if (!Array.isArray(c.ayniDia.u)) c.ayniDia.u = [];
    // Ayuda reciente entre los dos: habilita el «gracias» de grupo (gratitud) sin haber resucitado.
    a.ultAyuda = { uid: b.c.uid, t: ahora };
    b.ultAyuda = { uid: a.c.uid, t: ahora };
    if (c.ayniDia.n < 10) {
      c.ayniDia.n++;
      // El logro (c.ayni) solo sube con novatos distintos: 1 por novato y dia, como resucitar (combate.js).
      const cuenta = !c.ayniDia.u.includes(b.c.uid) && c.ayniDia.u.length < 10;
      if (cuenta) { c.ayniDia.u.push(b.c.uid); c.ayni = (c.ayni || 0) + 1; }
      // Oro a la medida del veterano (como dos presas comunes suyas: 2 x (2+2L)), no del novato.
      // Sin el x25 de jefe de statsMonstruo: cazar un jefe con un novato no paga miles de oro.
      const oro = 4 + 4 * (c.nivel || 1);
      c.oro = (c.oro || 0) + oro;
      a.sucio = true;
      if (this.yoLuego) this.yoLuego(a, false);
      this.enviar(a, cuenta
        ? { t: 'toast', ok: true, ayni: c.ayni, m: `🤝 Ayni +1: ayudaste a ${b.c.nombre} (+${oro} oro)` }
        : { t: 'toast', ok: true, m: `🤝 Ayudaste a ${b.c.nombre} (+${oro} oro)` });
      if (cuenta && this.revisarLogros) this.revisarLogros(a, true);   // Mano Amiga / Corazon / Taita del Ayni
    }
    // Al novato: +10 % de la XP de esa presa (minimo 1).
    let xp = 1;
    try { xp = Math.max(1, Math.round(((o && o.k ? statsMonstruo(o.k, o.nv).xp : 0) || 0) * 0.1)); } catch (e) { xp = 1; }
    const subio = this.sumarXp(b, xp);
    b.sucio = true;
    if (this.yoLuego) this.yoLuego(b, subio);
    this.enviar(b, { t: 'toast', ok: true, m: `🤝 ${a.c.nombre} te echó una mano (+${xp} XP)` });
  },

  salirGrupo(s, motivo) {
    const g = this.grupoDe(s);
    if (!g) return;
    g.uids = g.uids.filter(u => u !== s.c.uid);
    s.gid = 0;
    if (g.inst && this.sacarDeInstancia) this.sacarDeInstancia(s, g.inst);
    this.enviar(s, { t: 'grupo', g: null });
    if (motivo !== 'silencio') this.avisarGrupo(g, `👥 ${s.c.nombre} ${motivo === 'expulsado' ? 'fue expulsado del' : 'dejó el'} grupo.`);
    this.ordenarGrupo(g);
  },
  // Lider nuevo si se fue el anterior; disolver si queda uno solo.
  ordenarGrupo(g) {
    if (g.uids.length < 2) {
      for (const x of this.sesionesGrupo(g)) { x.gid = 0; this.enviar(x, { t: 'grupo', g: null }); this.enviar(x, { t: 'toast', m: '👥 El grupo se disolvió.' }); }
      this.grupos.delete(g.id);
      if (this.alDisolverGrupo) this.alDisolverGrupo(g);
      return;
    }
    if (!g.uids.includes(g.lider)) {
      const conectado = g.uids.find(u => this.porUid.has(u)) || g.uids[0];
      g.lider = conectado;
      const l = this.porUid.get(conectado);
      if (l) this.avisarGrupo(g, `👑 ${l.c.nombre} es el nuevo líder del grupo.`);
    }
    this.enviarGrupo(g);
  },
  expulsarGrupo(s, m) {
    const g = this.grupoDe(s);
    const uid = g && g.uids.find(u => pub(u) === m.uid);
    if (!g || g.lider !== s.c.uid || !uid || uid === s.c.uid) return;
    const t = this.porUid.get(uid);
    if (t) { this.salirGrupo(t, 'expulsado'); this.enviar(t, { t: 'toast', m: '👥 Te expulsaron del grupo.' }); }
    else {
      g.uids = g.uids.filter(u => u !== uid);
      if (this.instDe && this.instDe.get(uid) === g.inst) this.instDe.delete(uid);
      this.avisarGrupo(g, '👥 Un miembro desconectado fue expulsado del grupo.'); this.ordenarGrupo(g);
    }
  },
  // Convertir el grupo en banda (hasta 10) o volver a grupo (si son 5 o menos).
  bandaGrupo(s, m) {
    const g = this.grupoDe(s);
    if (!g) return this.no(s, 'Primero forma un grupo: invita a alguien desde su marco.');
    if (g.lider !== s.c.uid) return this.no(s, 'Solo el líder puede convertir el grupo en banda.');
    const si = !!m.si;
    if (!si && g.uids.length > GRUPO_MAX) return this.no(s, `Son más de ${GRUPO_MAX}: no puede volver a ser un grupo.`);
    if (g.banda === si) return;
    const wi = g.inst && this.mundo[g.inst];
    if (wi && wi.inst && !wi.inst.completada && !wi.inst.banda) return this.no(s, 'Tu grupo está en una mazmorra: termínenla o salgan antes de cambiar.');
    g.banda = si;
    this.avisarGrupo(g, si ? `⚔️ El grupo ahora es una BANDA (hasta ${BANDA_MAX}).` : '👥 La banda vuelve a ser un grupo (hasta 5).');
    this.enviarGrupo(g);
  },
  liderGrupo(s, m) {
    const g = this.grupoDe(s);
    const uid = g && g.uids.find(u => pub(u) === m.uid);
    if (!g || g.lider !== s.c.uid || !uid || uid === s.c.uid) return;
    g.lider = uid;
    const l = this.porUid.get(uid);
    this.avisarGrupo(g, `👑 ${l ? l.c.nombre : 'Otro miembro'} es el nuevo líder del grupo.`);
    this.enviarGrupo(g);
  },

  // Al entrar: si el uid sigue en un grupo, vuelve a el.
  reengancharGrupo(s) {
    this.iniciarSocial();
    for (const g of this.grupos.values()) {
      if (!g.uids.includes(s.c.uid)) continue;
      s.gid = g.id;
      this.avisarGrupo(g, `👥 ${s.c.nombre} volvió.`, s);
      this.enviarGrupo(g);
      return;
    }
  },
  // Al salir: el grupo lo espera; si ya no queda nadie conectado, se borra.
  desconectarDeGrupo(s) {
    if (this.lfg) this.lfg.delete(s.c.uid);   // su busqueda de grupo, fuera
    const g = this.grupoDe(s);
    if (!g) return;
    if (!this.sesionesGrupo(g).some(x => x !== s)) { this.grupos.delete(g.id); if (this.alDisolverGrupo) this.alDisolverGrupo(g); return; }
    // Si se va el lider (Telegram en segundo plano), lo pasa a uno conectado: si no, nadie podia invitar ni echar.
    if (g.lider === s.c.uid) { const sig = this.sesionesGrupo(g).find(x => x !== s); if (sig) { g.lider = sig.c.uid; this.avisarGrupo(g, `👑 ${sig.c.nombre} es ahora el líder del grupo.`, s); } }
    this.enviarGrupo(g, s);
  },

  infoMiembro(uid, excepto) {
    const x = this.porUid.get(uid);
    if (!x || !x.c || x === excepto) return { uid: pub(uid), on: 0 };
    return {
      uid: pub(uid), on: 1, id: x.id, n: x.c.nombre, lv: x.c.nivel, cl: x.c.clase || '', sk: x.c.skin,
      hp: Math.ceil(x.hp), mx: x.st.maxHp, rec: Math.round(x.rec || 0), rmx: x.st.recMax, mapa: x.c.mapa, k: x.k, muerto: !!x.muerto,
      p3: x.m3 && x.p ? [Math.round(x.p.x), Math.round(x.p.z)] : undefined,
    };
  },
  // Estado del grupo a todos sus miembros (vida y mana de los que estan en
  // otro mapa no llegan por la foto del mapa: van aqui).
  enviarGrupo(g, excepto) {
    const info = { id: g.id, lider: pub(g.lider), banda: g.banda ? 1 : 0, m: g.uids.map(u => this.infoMiembro(u, excepto)) };
    const nombres = g.nombres || (g.nombres = {});
    for (const x of info.m) if (x.n) nombres[x.uid] = x.n; else x.n = nombres[x.uid] || '?';
    const txt = JSON.stringify({ t: 'grupo', g: info });
    for (const x of this.sesionesGrupo(g)) if (x !== excepto) this.enviar(x, txt);
  },
  avisarGrupo(g, txt, excepto) {
    for (const x of this.sesionesGrupo(g)) if (x !== excepto) this.enviar(x, { t: 'chat', canal: 'grupo', sis: 1, m: txt });
  },
  tickGrupos(ahora) {
    this.iniciarSocial();
    if (ahora - (this.grupoT || 0) < 500) return;
    this.grupoT = ahora;
    for (const g of this.grupos.values()) if (this.sesionesGrupo(g).length) this.enviarGrupo(g);
  },

  // ── CHAT ──
  chat(s, m) {
    const ahora = Date.now();
    if (ahora - s.chatT < 900) return;
    const txt = limpiar(m.m);
    if (!txt) return;
    const mudo = this.silenciado ? this.silenciado(s) : 0;
    if (mudo) return this.no(s, `🔇 Estás silenciado por un moderador ${Math.ceil((mudo - ahora) / 60000)} min más.`);
    // Solo el dueño se salta el filtro: un moderador no publica carteras ni enlaces (nadie se hace pasar por el equipo).
    if (!(this.esDueno && this.esDueno(s)) && riesgoEstafa(txt)) return this.no(s, '🛡 Por seguridad no se permiten carteras, enlaces, cobros ni frases semilla. Nadie del equipo te cobra por aquí ni te pide tu frase.');
    if (!(this.esDueno && this.esDueno(s)) && riesgoContacto(txt)) return this.no(s, '🛡 Por tu seguridad no se comparten teléfonos, redes ni datos personales en el chat. Si alguien te los pide, usa Reportar.');
    if (groseriaDisfrazada(txt)) return this.no(s, 'Ese mensaje tiene palabras no permitidas.');
    const txtF = txt.replace(RE_GROSERIA, x => '*'.repeat(x.length));
    s.chatT = ahora;
    let canal = m.canal;
    // Canal desconocido = general (y pasa por las mismas reglas de invitado).
    if (!['general', 'decir', 'grupo', 'hermandad', 'susurro'].includes(canal)) canal = 'general';
    // General y susurro llegan a cualquiera: un invitado recien creado (token
    // nuevo, gratis) no los usa hasta el nivel 5. Si no, silenciarlo no servia:
    // reconectaba con otro token y seguia.
    // Invitado de menos de nivel 5: lo del general va al chat de su zona (antes se rechazaba y parecia que el chat no funcionaba).
    if (canal === 'general' && s.c.uid.startsWith('inv:') && s.c.nivel < 5) canal = 'decir';
    if (canal === 'susurro' && s.c.uid.startsWith('inv:') && s.c.nivel < 5) return this.no(s, s.m3 ? '🔒 En ORIGINS los invitados usan el chat público y el susurro desde el nivel 5 (el de grupo /g y hermandad /h ya funcionan). Sube un poco o inicia sesión.' : '🔒 Los invitados usan el canal general y el susurro desde el nivel 5. Mientras tanto escribe /d tu mensaje para hablar con los de tu mapa, o inicia sesión.');
    const base = { t: 'chat', p: s.id, n: s.c.nombre, m: txtF, mapa: s.c.mapa, cl: s.c.clase || '', gm: s.dios === 'dueno' ? 2 : s.dios ? 1 : undefined };
    if (canal === 'decir') {
      // Solo los que estan en el mismo mapa (o la misma mazmorra), menos quien lo ignora.
      const txtD = JSON.stringify({ ...base, canal: 'decir' });
      for (const x of this.sesiones.values()) if (x.c && x.k === s.k && !meIgnora(x, s.c.uid)) this.enviar(x, txtD);
      return;
    }
    if (canal === 'grupo') {
      const g = this.grupoDe(s);
      if (!g) return this.no(s, 'No estás en un grupo.');
      const txtG = JSON.stringify({ ...base, canal: 'grupo' });
      for (const x of this.sesionesGrupo(g)) if (!meIgnora(x, s.c.uid)) this.enviar(x, txtG);
      return;
    }
    if (canal === 'hermandad') {
      if (!this.chatHermandad) return this.no(s, 'No estás en una hermandad.');
      return this.chatHermandad(s, base);
    }
    if (canal === 'susurro') {
      const a = limpiar(m.a).toLowerCase();
      const t = [...this.sesiones.values()].find(x => x.c && x.c.nombre.toLowerCase() === a);
      if (!t) return this.no(s, `No hay nadie conectado llamado "${limpiar(m.a)}".`);
      if (t === s) return;
      if (meIgnora(t, s.c.uid)) return this.no(s, `${t.c.nombre} no recibe tus mensajes.`);
      this.enviar(t, { ...base, canal: 'susurro', de: s.c.nombre });
      this.enviar(s, { ...base, canal: 'susurro', a: t.c.nombre });
      return;
    }
    // General: todo el servidor. Las burbujas solo se ven en el mismo mapa.
    this.anotarChat(this.chatHist || (this.chatHist = []), s, base, 'general', 20);
    const txtG = JSON.stringify({ ...base, canal: 'general' });
    for (const x of this.sesiones.values()) if (x.c && !meIgnora(x, s.c.uid)) this.enviar(x, txtG);
  },
  // /ignorar Nombre: deja de ver sus mensajes (otra vez lo deshace). Va con el
  // personaje (sirve en CLASSIC y ORIGINS y en otro dispositivo).
  ignorar(s, m) {
    const n = limpiar(m.n).toLowerCase();
    const t = [...this.sesiones.values()].find(x => x.c && x.c.nombre.toLowerCase() === n);
    if (!t || t === s) return this.no(s, n ? `No hay nadie conectado llamado "${limpiar(m.n)}".` : 'Escribe: /ignorar Nombre');
    const l = s.c.ignorados || (s.c.ignorados = []);
    const i = l.indexOf(t.c.uid);
    if (i >= 0) { l.splice(i, 1); s.sucio = true; return this.enviar(s, { t: 'toast', m: `🔈 Vuelves a ver los mensajes de ${t.c.nombre}.` }); }
    if (l.length >= IGNORADOS_MAX) l.shift();
    l.push(t.c.uid); s.sucio = true;
    if (s.recientes) s.recientes = s.recientes.filter(z => z.pub !== pub(t.c.uid));   // fuera de «Jugaste con»
    this.enviar(s, { t: 'toast', m: `🔇 Ya no ves los mensajes de ${t.c.nombre} (escribe /ignorar ${t.c.nombre} otra vez para deshacerlo).` });
  },
  // /reportar Nombre motivo: queda guardado (con sus ultimas frases del chat)
  // y le llega al dueño por Telegram para que lo revise.
  reportar(s, m) {
    const ahora = Date.now();
    // Limite por cuenta (no por conexion: reconectar no lo reinicia).
    // Un invitado recien creado (gratis) no reporta hasta el nivel 5, como el general.
    if (s.c.uid.startsWith('inv:') && s.c.nivel < 5) return this.no(s, 'Los invitados pueden reportar desde el nivel 5 (o inicia sesión).');
    this.reporteUid = this.reporteUid || new Map();
    // Tambien por conexion, pero solo en IPv6 (su /64): una IPv4 de movil la
    // comparten cientos de personas por CGNAT y el reporte de uno bloqueaba a todos.
    const kIp = s.ip && s.ip.includes(':') ? 'i:' + s.ip : '';
    if (ahora - Math.max(s.reporteT || 0, this.reporteUid.get(s.c.uid) || 0, (kIp && this.reporteUid.get(kIp)) || 0) < REPORTE_CADA_MS) return this.no(s, 'Espera un minuto antes de enviar otro reporte.');
    const n = limpiar(m.n).toLowerCase(), motivo = limpiar(m.motivo).slice(0, 100) || 'sin motivo';
    const t = [...this.sesiones.values()].find(x => x.c && x.c.nombre.toLowerCase() === n);
    if (!t || t === s) return this.no(s, n ? `No hay nadie conectado llamado "${limpiar(m.n)}".` : 'Escribe: /reportar Nombre motivo');
    s.reporteT = ahora; this.reporteUid.set(s.c.uid, ahora);
    if (kIp) this.reporteUid.set(kIp, ahora);
    // Se podan los vencidos (antes un clear() reiniciaba el limite de todos).
    if (this.reporteUid.size > 500) for (const [k, t0] of this.reporteUid) if (ahora - t0 >= REPORTE_CADA_MS) this.reporteUid.delete(k);
    const frases = (this.chatHist || []).filter(x => x.u === t.c.uid).slice(-5).map(x => x.m);
    const r = { t: ahora, de: s.c.uid, deN: s.c.nombre, a: t.c.uid, aN: t.c.nombre, motivo, frases };
    this.reportes = (this.reportes || []).concat(r).slice(-200);
    if (this.state && this.state.storage) this.state.storage.put('reportes', this.reportes).catch(() => {});
    // Al Telegram del dueño sin enlaces, @usuarios ni /comandos clicables. El punto
    // pasa a '·': un dominio suelto («pagos.xyz») salia como enlace con vista previa.
    const plano = x => x.replace(/https?:\/\/\S+|www\.\S+|t\.me\S*/gi, '[enlace]').replace(/[*_`\[\]]/g, '').replace(/[\/@]/g, ' ').replace(/\./g, '·');
    // Al Telegram del dueño como mucho 12 reportes cada 10 min (los demas quedan
    // guardados): asi una oleada de invitados no tapa los avisos de pagos.
    this.reportesAviso = (this.reportesAviso || []).filter(x => ahora - x < 600000);
    const avisar = this.reportesAviso.length < 12;
    if (avisar) this.reportesAviso.push(ahora);
    if (avisar && this.avisarAdmin) this.avisarAdmin(`⚠️ Reporte de ${s.c.nombre.replace(/[^\p{L}\p{N} ]/gu, '')} contra ${t.c.nombre.replace(/[^\p{L}\p{N} ]/gu, '')}: ${plano(motivo)}${frases.length ? '\nÚltimas frases: ' + frases.map(f => '«' + plano(f) + '»').join(' ') : ''}`, null, true).catch(() => {});
    this.enviar(s, { t: 'toast', m: `⚠️ Reporte enviado. Gracias: el equipo lo revisará. Si te molesta, usa /ignorar ${t.c.nombre}.` });
  },
  // Historial corto del general y de cada hermandad. El del general se guarda
  // en el storage (como mucho cada 15 s, con un guardado final diferido) para
  // que sobreviva cuando el servidor se duerme. u: uid del autor, para no
  // repetir lo de un silenciado o baneado; no sale al cliente.
  anotarChat(l, s, base, canal, max) {
    l.push({ ...base, canal, u: s.c.uid, t0: Date.now() });
    if (l.length > max) l.shift();
    if (l === this.chatHist && this.state && this.state.storage) {
      // Antes de guardar se carga lo viejo: si no, el put pisaba el historial
      // guardado y la carga posterior duplicaba los mensajes nuevos.
      const guardar = () => { this.chatHistGuardT = Date.now(); (this.chatHistCargado ? Promise.resolve() : this.cargarChatHist()).then(() => this.state.storage.put('chatHist', this.chatHist)).catch(() => {}); };
      if (Date.now() - (this.chatHistGuardT || 0) > 15000) guardar();
      else if (!this.chatHistPend) this.chatHistPend = setTimeout(() => { this.chatHistPend = null; guardar(); }, 15500 - (Date.now() - (this.chatHistGuardT || 0)));
    }
  },
  // Carga una sola vez el historial del general guardado (una promesa compartida:
  // dos que entran a la vez no lo duplican). Si alguien ya escribio antes de
  // terminar la carga, sus mensajes se suman al final.
  async cargarChatHist() {
    if (this.chatHistCargado || !this.state || !this.state.storage) return;
    this.chatHistP = this.chatHistP || this.state.storage.get('chatHist').then(v => {
      const prev = this.chatHist || [];
      this.chatHist = [...(Array.isArray(v) ? v : []), ...prev].slice(-20);
    }, () => { this.chatHist = this.chatHist || []; }).finally(() => { this.chatHistCargado = true; });
    await this.chatHistP;
  },
  // Al entrar: lo que se dijo mientras no estaba (desde que se guardo al
  // salir, como mucho 24 h): una reconexion no repite lo que ya vio. Los
  // clientes muestran 8 lineas: cabecera, 6 mensajes y el mensaje del dia.
  // Con p: 0 y sin mapa no salen burbujas sobre nadie.
  async enviarHistorialChat(s, desde) {
    if (!this.chatHistCargado) { try { await this.cargarChatHist(); } catch (e) { this.chatHist = this.chatHist || []; } }
    if (s.cerrado || !s.c) return;
    const c = s.c, ahora = Date.now(), mod = this.mod || { ban: {}, mute: {} };
    const lim = Math.max(desde || 0, ahora - 24 * 3600000);
    const h = c.herm && this.herms && this.herms.get(c.herm);
    const deHerm = (h && h.miembros[c.uid] && this.chatHistH && this.chatHistH.get(c.herm)) || [];
    const l = [...(this.chatHist || []), ...deHerm]
      .filter(x => x.t0 > lim && !mod.ban[x.u] && !((mod.mute[x.u] || 0) > ahora) && !(c.ignorados || []).includes(x.u))
      .sort((a, b) => a.t0 - b.t0).slice(-6);
    if (!l.length) return;
    this.enviar(s, { t: 'chat', canal: 'general', sis: 1, m: '— Mensajes recientes del chat —' });
    for (const { t0, u, ...x } of l) this.enviar(s, { ...x, p: 0, mapa: '' });
  },

  // ── BUSCAR GRUPO ──
  buscarGrupo(s, m) {
    this.iniciarSocial();
    this.lfg = this.lfg || new Map();   // uid -> { id de mazmorra, t, hasta }
    const cueva = m.id === 'cueva';
    // La cueva solo existe en ORIGINS y las mazmorras solo en CLASSIC.
    const mz = cueva ? (s.m3 ? LFG_CUEVA : null) : !s.m3 && typeof m.id === 'string' && Object.hasOwn(MAZMORRAS, m.id) ? MAZMORRAS[m.id] : null;
    if (!mz) return;
    if (s.c.nivel < mz.nv[0]) return this.no(s, `Necesitas nivel ${mz.nv[0]} para ${mz.nombre}.`);
    const g = this.grupoDe(s);
    if (g && g.lider !== s.c.uid) return this.no(s, 'Solo el líder del grupo puede buscar más gente.');
    if (g && cueva && g.uids.length >= CUEVA.max) return this.no(s, `Tu grupo ya está completo para la cueva (${CUEVA.max}): ¡entren juntos!`);
    if (g && !cueva && !mz.banda && g.uids.length > GRUPO_MAX) return this.no(s, `Las mazmorras son para ${GRUPO_MAX}: tu banda solo puede buscar gente para la banda.`);
    const wi = g && g.inst && this.mundo[g.inst];
    if (g && mz.banda && !g.banda && wi && wi.inst && !wi.inst.completada) return this.no(s, 'Tu grupo está en una mazmorra: termínenla antes de buscar gente para la banda.');
    if (g && g.uids.length >= (mz.banda ? BANDA_MAX : maxGrupo(g))) return this.no(s, 'Tu grupo ya está lleno.');
    const ahora = Date.now();
    // El limite va aparte: quitar la busqueda no lo reinicia (si no, anunciar
    // y quitar en bucle inundaba de avisos a todos los conectados).
    this.lfgT = this.lfgT || new Map();
    if (ahora - (this.lfgT.get(s.c.uid) || 0) < LFG_CADA_MS) return this.no(s, 'Ya anunciaste tu búsqueda hace nada: espera un minuto.');
    for (const [u, t] of this.lfgT) if (ahora - t >= LFG_CADA_MS) this.lfgT.delete(u);
    this.lfgT.set(s.c.uid, ahora);
    if (g && mz.banda && !g.banda) { g.banda = true; this.avisarGrupo(g, `⚔️ El grupo ahora es una BANDA (hasta ${BANDA_MAX}).`); this.enviarGrupo(g); }
    const e = { id: m.id, t: ahora, hasta: ahora + LFG_MS };
    this.lfg.set(s.c.uid, e);
    const aviso = JSON.stringify({ t: 'lfgAviso', ...this.infoLfg(s.c.uid, e) });
    let n = 0;
    // No a quien esta en una mazmorra, el Coliseo, un duelo o peleando (el
    // aviso salia en mitad de un jefe): la busqueda queda en la lista igual.
    for (const x of this.sesiones.values()) {
      if (!x.c || x === s || x.gid || x.c.nivel < mz.nv[0] || meIgnora(x, s.c.uid)) continue;
      // Cueva: solo a los de ORIGINS que no estan ya dentro de una cueva; mazmorras: solo a CLASSIC.
      if (cueva ? (!x.m3 || x.i3 || x.muerto) : x.m3) continue;
      if (x.k.includes('#') || x.k === 'coliseo' || x.duelo || ahora - (x.combateT || 0) < 8000) continue;
      this.enviar(x, aviso); n++;
    }
    this.enviar(s, { t: 'toast', ok: true, m: `📢 Buscas grupo para ${mz.nombre} (10 min). ` + (n ? `Se avisó a ${n} jugador${n > 1 ? 'es' : ''} con nivel.` : cueva ? 'Ahora no hay nadie libre con Nv 5+ en ORIGINS: prueba otra vez en un minuto o entra solo.' : 'Ahora no hay nadie libre con nivel: queda en la lista del portal de mazmorras.') });
    this.lfgLista(s);
  },
  infoLfg(uid, e) {
    const x = this.porUid.get(uid);
    const g = x && this.grupoDe(x);
    const d = lfgDef(e.id) || {};
    return { pid: pub(uid), n: x.c.nombre, nv: x.c.nivel, cl: x.c.clase || '', id: e.id, nombre: d.nombre || '', m: g ? g.uids.length : 1, mx: e.id === 'cueva' ? CUEVA.max : d.banda ? BANDA_MAX : GRUPO_MAX };
  },
  // Las busquedas que siguen en pie (se borran las caducadas, las de quien
  // se fue y las de grupos llenos o que ya no lleva esa persona).
  lfgVigentes() {
    const ahora = Date.now(), r = [];
    for (const [uid, e] of this.lfg || []) {
      const x = this.porUid.get(uid);
      const g = x && this.grupoDe(x);
      if (!x || !x.c || e.hasta < ahora || (g && (g.lider !== uid || g.uids.length >= (e.id === 'cueva' ? Math.min(CUEVA.max, maxGrupo(g)) : maxGrupo(g))))) { this.lfg.delete(uid); continue; }
      r.push([uid, e]);
    }
    return r;
  },
  // Cada modo ve solo lo suyo (el 2D pinta MAZMORRAS[id].nombre y la cueva no esta ahi).
  lfgLista(s) { this.enviar(s, { t: 'lfg', l: this.lfgVigentes().filter(([, e]) => (e.id === 'cueva') === !!s.m3).map(([u, e]) => ({ ...this.infoLfg(u, e), yo: u === s.c.uid ? 1 : 0 })) }); },
  quitarLfg(s) {
    if (this.lfg && this.lfg.delete(s.c.uid)) this.enviar(s, { t: 'toast', m: 'Dejaste de buscar grupo.' });
    this.lfgLista(s);
  },
  unirseLfg(s, m) {
    this.iniciarSocial();
    const par = this.lfgVigentes().find(([u]) => pub(u) === m.pid);
    if (!par) return this.no(s, 'Esa búsqueda ya terminó (o el grupo se llenó).');
    const [uid, e] = par;
    const lider = this.porUid.get(uid);
    if (lider === s) return;
    const cueva = e.id === 'cueva';
    const mz = lfgDef(e.id);
    if (!mz || cueva !== !!s.m3) return this.no(s, cueva ? 'Esa búsqueda es para ORIGINS (mundo 3D).' : 'Esa búsqueda es para CLASSIC.');
    if (s.gid) return this.no(s, 'Ya estás en un grupo: sal de él para unirte a otro.');
    if (s.c.nivel < mz.nv[0]) return this.no(s, `Necesitas nivel ${mz.nv[0]} para ${mz.nombre}.`);
    let g = this.grupoDe(lider);
    // Dentro de un Desafio abierto solo se entra por invitacion (la lider
    // acepta a quien quiere: el premio del Desafio es grande).
    const wi = g && g.inst && this.mundo[g.inst];
    if (wi && wi.inst && wi.inst.k && !wi.inst.completada) return this.no(s, 'Ese grupo ya está dentro de un Desafío: pide al líder que te invite.');
    if (!g) {
      g = { id: this.sigGrupo++, lider: uid, uids: [uid], banda: !!mz.banda };
      this.grupos.set(g.id, g);
      lider.gid = g.id;
    }
    if (g.uids.length >= Math.min(maxGrupo(g), cueva ? CUEVA.max : mz.banda ? BANDA_MAX : GRUPO_MAX)) return this.no(s, 'Ese grupo ya está lleno.');
    g.uids.push(s.c.uid);
    s.gid = g.id;
    s.invitacion = null;
    this.avisarGrupo(g, `👥 ${s.c.nombre} se unió al grupo desde el buscador (${mz.nombre}).`);
    this.enviarGrupo(g);
    this.enviar(lider, { t: 'toast', ok: true, m: `📢 ${s.c.nombre} (Nv ${s.c.nivel}) se unió a tu grupo para ${mz.nombre}.` });
    this.enviar(s, { t: 'toast', ok: true, m: `👥 Te uniste al grupo de ${lider.c.nombre} para ${mz.nombre}. ` + (cueva ? 'Vayan al portal de la cueva en el pueblo: al entrar, el grupo cae en la misma cueva.' : 'Vayan juntos al portal de mazmorras del pueblo.') });
    if (g.uids.length >= (cueva ? Math.min(CUEVA.max, maxGrupo(g)) : maxGrupo(g))) this.lfg.delete(uid);
  },

  // ── AMIGOS (lista de contactos, como en WoW) ──
  // c.contactos = [{ u: uid, n: ultimo nombre conocido }]. Al cliente solo le
  // llega pub(uid). Avisa cuando un amigo se conecta.
  agregarContacto(s, m) {
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c || t === s) return;
    const l = s.c.contactos || (s.c.contactos = []);
    if (l.some(a => a.u === t.c.uid)) return this.no(s, `${t.c.nombre} ya está en tu lista de amigos.`);
    if (l.length >= CONTACTOS_MAX) return this.no(s, `Tu lista de amigos está llena (${CONTACTOS_MAX}).`);
    l.push({ u: t.c.uid, n: t.c.nombre });
    s.sucio = true;
    this.enviar(s, { t: 'toast', ok: true, m: `⭐ ${t.c.nombre} está en tu lista de amigos: verás cuándo se conecta.` });
    // Una vez por persona y sesion: añadir y quitar en bucle inundaba de avisos.
    t.avisosAmigo = t.avisosAmigo || new Set();
    // A quien te ignora no le llega el aviso.
    if (!t.avisosAmigo.has(s.c.uid) && !meIgnora(t, s.c.uid)) { t.avisosAmigo.add(s.c.uid); this.enviar(t, { t: 'toast', m: `⭐ ${s.c.nombre} te añadió a su lista de amigos.` }); }
    this.enviarContactos(s);
  },
  // Un invitado que pasa a cuenta cambia de uid: en las listas de los
  // conectados se cambia el viejo por el nuevo (los que no estan conectados
  // lo veran "desconectado" hasta que lo quiten y lo vuelvan a añadir).
  renombrarContacto(viejo, nuevo) {
    for (const x of this.sesiones.values()) {
      for (const a of (x.c && x.c.contactos) || []) if (a.u === viejo) { a.u = nuevo; x.sucio = true; }
      for (const a of (x.c && x.c.invitados) || []) if (a.u === viejo) { a.u = nuevo; x.sucio = true; }   // «Mis invitados» (amigos.js)
    }
  },
  quitarContacto(s, m) {
    const l = s.c.contactos || [];
    const i = l.findIndex(a => pub(a.u) === m.uid);
    if (i < 0) return;
    l.splice(i, 1);
    s.sucio = true;
    this.enviarContactos(s);
  },
  enviarContactos(s) {
    const l = (s.c.contactos || []).map(a => {
      const x = this.porUid.get(a.u);
      const on = !!(x && x.c && !x.cerrado);
      if (on) a.n = x.c.nombre;
      return { uid: pub(a.u), n: a.n, on: on ? 1 : 0, id: on ? x.id : 0, lv: on ? x.c.nivel : 0, cl: on ? x.c.clase || '' : '', mapa: on && MAPAS[x.c.mapa] ? MAPAS[x.c.mapa].nombre : '', g: on && x.gid ? 1 : 0, m3: on && x.m3 ? 1 : 0, h: on && x.c.herm ? (this.nombreHermandad ? this.nombreHermandad(x.c.herm) || 1 : 1) : '' };
    }).sort((a, b) => b.on - a.on || a.n.localeCompare(b.n));
    this.enviar(s, { t: 'contactos', l });
  },
  // Al entrar: avisa a quien lo tiene de amigo y esta conectado (solo si
  // llevaba 5+ min fuera: el movil se reconecta a menudo al volver de
  // segundo plano y el aviso se repetia).
  avisarContactos(s, salidaAntes) {
    if (salidaAntes && Date.now() - salidaAntes < 5 * 60000) return;
    for (const x of this.sesiones.values()) {
      if (x === s || !x.c || !(x.c.contactos || []).some(a => a.u === s.c.uid)) continue;
      this.enviar(x, { t: 'toast', m: `👋 Tu amigo ${s.c.nombre} se conectó.` });
    }
  },

  // ── GESTOS ──
  gesto(s, m) {
    const ahora = Date.now();
    if (typeof m.id !== 'string' || !Object.hasOwn(GESTOS, m.id) || ahora - (s.gestoT || 0) < 1500) return;
    if (this.silenciado && this.silenciado(s)) return;   // silenciado por un moderador: tampoco gestos
    s.gestoT = ahora;
    if (this.progresoFiesta) this.progresoFiesta(s, 'gesto', 1);   // calendario de la fiesta (tareas.js)
    // Como el chat: no le llega a quien ignora al autor.
    // En ORIGINS solo lo ven tu grupo y los que están a menos de 60 m (en el 2D, todo el mapa).
    const txt = JSON.stringify({ t: 'gesto', p: s.id, id: m.id });
    for (const x of this.sesiones.values()) if (x.c && x.k === s.k && !meIgnora(x, s.c.uid) && ((s.gid && x.gid === s.gid) || cercaSoc(x, s, 3600))) this.enviar(x, txt);
    if (m.id === 'gracias') this.gratitud(s, ahora);
  },
  // 🙏 «gracias» que cuenta: al que te levanto hace poco (s.ultRes, combate.js) o, si no, al
  // de tu grupo mas cercano (15 m / 150 px) con ayuda mutua reciente (ultAyuda). Desde Nv 5. Sin oro: solo c.gratitud y sus logros.
  // 1 por par y dia de Lima (marcas en el emisor: c.gracDia) y 10 al dia por receptor.
  gratitud(s, ahora) {
    const c = s.c;
    if (!c || !c.uid) return;
    // Anti-farmeo: los invitados y los Nv 1-4 no reparten gracias que cuenten (aviso una vez por sesion).
    if (c.uid.startsWith('inv:') || (c.nivel || 1) < 5) {
      if (!s.gracAviso) { s.gracAviso = 1; this.enviar(s, { t: 'toast', m: '🙏 Tus gracias cuentan desde Nv 5' }); }
      return;
    }
    const valido = x => x && x !== s && x.c && x.c.uid && x.c.uid !== c.uid && x.k === s.k && !x.cerrado
      && !(s.dev && s.dev === x.dev) && !(s.ip && s.ip.includes(':') && s.ip === x.ip) && !meIgnora(x, c.uid);
    let otro = null;
    const ur = s.ultRes;
    if (ur && ahora - ur.t < 10 * 60000) { const x = this.sesiones.get(ur.id); if (valido(x) && x.c.uid === ur.uid) otro = x; }
    if (!otro && s.gid) {
      // Solo al compañero que te ayudó (o al que ayudaste) en los ultimos 10 min (ultAyuda, ayniCaza).
      const ayudo = (x, y) => x.ultAyuda && x.ultAyuda.uid === y.c.uid && ahora - x.ultAyuda.t < 600000;
      // ORIGINS: s.p (x, z) a menos de 15 m; CLASSIC: s.x / s.y en pixeles, a menos de 150 px.
      const sx = s.p ? s.p.x : s.x, sz = s.p ? (s.p.z || 0) : s.y;
      let mejor = s.p ? 225 : 22500;
      for (const x of this.sesiones.values()) {
        if (x.gid !== s.gid || !valido(x) || !!x.p !== !!s.p || (x.i3 || 0) !== (s.i3 || 0)) continue;
        if (!ayudo(x, s) && !ayudo(s, x)) continue;
        const xx = x.p ? x.p.x : x.x, xz = x.p ? (x.p.z || 0) : x.y;
        if (typeof sx !== 'number' || typeof xx !== 'number') continue;
        const d2 = (xx - sx) ** 2 + ((xz || 0) - (sz || 0)) ** 2;
        if (d2 < mejor) { mejor = d2; otro = x; }
      }
    }
    if (!otro) return;
    const hoy = hoyUTC();
    if (!c.gracDia || c.gracDia.d !== hoy || !Array.isArray(c.gracDia.ids)) c.gracDia = { d: hoy, ids: [] };
    if (c.gracDia.ids.includes(otro.c.uid) || c.gracDia.ids.length >= 30) return;
    const oc = otro.c;
    if (!oc.gracRec || oc.gracRec.d !== hoy) oc.gracRec = { d: hoy, n: 0 };
    if (oc.gracRec.n >= 10) return;
    c.gracDia.ids.push(oc.uid);
    oc.gracRec.n++;
    oc.gratitud = (oc.gratitud || 0) + 1;
    s.sucio = true; otro.sucio = true;
    this.enviar(otro, { t: 'toast', ok: true, m: '🙏 ' + c.nombre + ' te agradeció' });
    this.enviar(s, { t: 'toast', ok: true, m: '🙏 Le diste las gracias a ' + oc.nombre });
    if (this.revisarLogros) this.revisarLogros(otro, true);
  },

  // ── MARCAS (📍 sin texto) ──
  // Un pilar de luz en el suelo: «ataquen aquí», «recurso aquí», «vamos aquí» o
  // «caí, ayuda». Solo tipos fijos y posiciones cerca del autor: nada de texto libre.
  marca(s, m) {
    const ahora = Date.now();
    if (!s.c || !s.p || (ahora - (s.marcaT || 0) < 3000 && m && m.k !== 'caido')) return;
    if (this.silenciado && this.silenciado(s)) return;
    const k = m && typeof m.k === 'string' ? m.k : '';
    if (!['ataque', 'recurso', 'ir', 'caido'].includes(k)) return;
    // «Caí, ayuda» solo estando caído y como mucho 1 vez cada 15 s.
    if (k === 'caido' && (!s.muerto || ahora - (s.ayudaT || 0) < 15000)) return;
    const x = Number(m.x), z = Number(m.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || (x - s.p.x) ** 2 + (z - s.p.z) ** 2 > 1600) return;
    s.marcaT = ahora;
    if (k === 'caido') s.ayudaT = ahora;
    const r2 = k === 'caido' ? 3600 : 1600;
    const txt = JSON.stringify({ t: 'marca', p: s.id, k, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
    // Como el gesto: no le llega a quien ignora al autor.
    for (const o of this.sesiones.values()) if (o.c && o.k === s.k && !meIgnora(o, s.c.uid) && ((s.gid && o.gid === s.gid) || cercaSoc(o, s, r2))) this.enviar(o, txt);
  },

  // ── INSPECCIONAR (como en WoW) ──
  // El equipo puesto y lo que se puede presumir de otro jugador conectado.
  // Nada privado: ni uid, ni oro, ni mTON, ni bolsa.
  inspeccionar(s, m) {
    const t = this.sesiones.get(m.p | 0);
    if (!t || !t.c) return this.no(s, 'Ese jugador ya no está conectado.');
    const c = t.c;
    this.enviar(s, { t: 'inspeccion', p: t.id, n: c.nombre, lv: c.nivel, cl: c.clase || '', es: c.espec || '', ti: this.textoTitulo ? this.textoTitulo(c) : '',
      eq: c.eq || {}, logros: (c.logros || []).length, mazmorras: c.mazmorras || 0, desafioMax: c.desafioMax || 0, duelos: c.duelosG || 0,
      runas: c.runas || {}, titanes: c.titanes || 0, pionero: c.pionero ? 1 : 0, torreMax: c.torreMax || 0, peces: c.peces || 0, ayni: c.ayni || 0,
      herm: this.nombreHermandad ? this.nombreHermandad(c.herm) : '' });
  },

  // Lista de quien esta conectado (para invitar o susurrar).
  quien(s) {
    if (Date.now() - (s.quienT || 0) < 2000) return;   // recorre a todos: con limite
    s.quienT = Date.now();
    // Primero quien no tiene grupo y, entre ellos, los de nivel bajo (los recien
    // llegados por el mismo anuncio se encuentran); luego el corte a 100.
    const cand = [...this.sesiones.values()].filter(x => x.c && x !== s)
      .sort((a, b) => (a.gid ? 1 : 0) - (b.gid ? 1 : 0) || (a.gid ? (b.c.nivel | 0) - (a.c.nivel | 0) : (a.c.nivel | 0) - (b.c.nivel | 0))).slice(0, 100);
    const r = cand.map(x => ({ id: x.id, n: x.c.nombre, lv: x.c.nivel, cl: x.c.clase || '', mapa: MAPAS[x.c.mapa] ? MAPAS[x.c.mapa].nombre : '', g: x.gid ? 1 : 0, m3: x.m3 ? 1 : 0, h: x.c.herm ? (this.nombreHermandad ? this.nombreHermandad(x.c.herm) : '') : '' }));
    this.enviar(s, { t: 'quien', r });
  },
};
