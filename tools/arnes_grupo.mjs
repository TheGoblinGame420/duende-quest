// ═══════════════════════════════════════════════════════
// Pruebas del bot en el grupo oficial de Telegram (functions/mmo/grupo.js y
// functions/api/grupo.js). Sin red: Telegram es un doble que apunta lo que
// se le pide, y el reloj se mueve a mano.
//
//   node tools/arnes_grupo.mjs
//
// tools/ no se publica (.assetsignore).
// ═══════════════════════════════════════════════════════
import { MmoWorld } from '../functions/mmo/world.js';
import { VERSION, NOVEDADES, NIVEL_MAX } from '../mmo/js/data.js';
import {
  horaLima, enSilencio, clasificarEnlace, motivoSpam, textoNovedades, lineaNovedadOk, armarHitos, hitoNivel,
  textoBienvenida, textoManana, textoNoche, textoAvisoSpam, nombrePublico, nombreVisitante, telOficial,
  HITOS_POR_DIA, AGRUPAR_HITOS_MS, AVISO_SPAM_BORRAR_MS,
} from '../functions/mmo/grupo.js';
import { grupoWebhook } from '../functions/api/grupo.js';

const H = 3600000;
// 11-nov-2026, 10:00 de Lima (15:00 UTC).
let reloj = Date.UTC(2026, 10, 11, 15, 7, 0);
const dateNowReal = Date.now;
Date.now = () => reloj;
const aLima = (dia, h, min = 0) => { reloj = Date.UTC(2026, 10, dia, h + 5, min, 0); };

let ok = 0, mal = 0;
const chequear = (cond, txt) => { if (cond) ok++; else { mal++; console.log('  ✗', txt); } };
const espera = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

// ── Mundo con almacenamiento falso (con alarma) ──
const TOKEN = '4242:prueba', DUENO = 777, GRUPO = -1001234;
const almacen = new Map();
let alarma = null;
const state = {
  storage: {
    get: async k => (almacen.has(k) ? structuredClone(almacen.get(k)) : undefined),
    put: async (k, v) => { almacen.set(k, structuredClone(v)); },
    delete: async k => almacen.delete(k),
    list: async (o = {}) => new Map([...almacen].filter(([k]) => !o.prefix || k.startsWith(o.prefix))),
    getAlarm: async () => alarma,
    setAlarm: async t => { alarma = t; },
  },
  blockConcurrencyWhile: f => f(),
};
const mundo = new MmoWorld(state, { TELEGRAM_BOT_TOKEN: TOKEN, ADMIN_TG_ID: String(DUENO) });
await espera(20);
if (mundo.bucle) { clearInterval(mundo.bucle); mundo.bucle = 1; }

// ── Telegram falso ──
let tg = [], sigMsg = 100, admins = [DUENO, 555], puedeBorrar = true;
mundo.tgEnviar = async (metodo, b) => {
  tg.push({ metodo, ...b });
  if (metodo === 'sendMessage') return { ok: true, result: { message_id: ++sigMsg } };
  if (metodo === 'getChatAdministrators') return { ok: true, result: admins.map(id => ({ user: { id } })) };
  if (metodo === 'getChatMember') return { ok: true, result: { status: 'administrator', can_delete_messages: true } };
  if (metodo === 'deleteMessage') return puedeBorrar ? { ok: true, result: true } : { ok: false, error_code: 400, description: 'message can\'t be deleted' };
  return { ok: true, result: true };
};
// Los avisos privados a jugadores no son de este modulo: aqui no se manda ninguno.
mundo.recordatorios = async () => ({ ok: true, enviados: 0, bloqueados: 0, fallidos: 0 });
const alGrupo = () => tg.filter(x => x.metodo === 'sendMessage' && x.chat_id === GRUPO);
const alDueno = () => tg.filter(x => x.metodo === 'sendMessage' && String(x.chat_id) === String(DUENO));
const de = m => tg.filter(x => x.metodo === m);
const limpiar = () => { tg = []; };
const interno = async (cuerpo, clave = TOKEN) => {
  const r = await mundo.interno(new Request('https://mmo/interno/grupo', { method: 'POST', headers: { 'x-interno': clave }, body: JSON.stringify(cuerpo) }), 'grupo');
  return r.status === 200 ? r.json() : { status: r.status };
};
// El webhook real, con un Durable Object de mentira que llama al mundo de la prueba.
const contexto = { env: { TELEGRAM_BOT_TOKEN: TOKEN, ADMIN_TG_ID: String(DUENO), MMO: { idFromName: n => n, get: () => ({ fetch: (url, o) => mundo.interno(new Request(url, o), new URL(url).pathname.slice(9)) }) } } };
const webhook = body => grupoWebhook(body, contexto);
const chatG = { id: GRUPO, type: 'supergroup', title: 'LA CUEVA DEL DUENDE' };
const msgG = (id, texto, extra) => ({ message: { message_id: 5000 + id, chat: chatG, from: { id, first_name: 'Vecino' + id }, text: texto, ...(extra || {}) } });
const estado = () => mundo._grupo;

// ═══════════════ 1. Funciones puras ═══════════════
console.log('Grupo: horario de Lima');
chequear(horaLima(Date.UTC(2026, 10, 11, 13, 0)) === 8 && horaLima(Date.UTC(2026, 10, 11, 2, 0)) === 21, 'las 13:00 UTC son las 8:00 de Lima y las 2:00 UTC las 21:00');
chequear(enSilencio(Date.UTC(2026, 10, 11, 4, 0)) && enSilencio(Date.UTC(2026, 10, 11, 12, 59)) && enSilencio(Date.UTC(2026, 10, 11, 9, 0)), 'de 23:00 a 7:59 de Lima es silencio');
chequear(!enSilencio(Date.UTC(2026, 10, 11, 13, 0)) && !enSilencio(Date.UTC(2026, 10, 11, 3, 59)), 'a las 8:00 y a las 22:59 de Lima se puede escribir');

console.log('Grupo: enlaces');
const E = clasificarEnlace;
chequear(E('https://duende-quest.alfonso12hc.workers.dev/jugar/') === 'ok' && E('duende-quest.alfonso12hc.workers.dev/seguridad.html') === 'ok', 'el sitio oficial pasa');
chequear(E('https://duende-quest.alfonso12hc.workers.dev.otro.com/x') === 'enlace' && E('https://duende-quest.alfonso12hc.workers.dev@otro.com/x') === 'enlace', 'un dominio que imita al oficial no pasa');
chequear(E('https://duende-quest.alfonso12hc.workers.dev/?u=otro.com') === 'enlace', 'otro dominio escondido en la ruta del oficial no pasa');
chequear(E('t.me/duendequest_bot') === 'ok' && E('https://t.me/ElDuendeOficial') === 'ok' && E('https://t.me/elduende420peru/12') === 'ok', 'los t.me del proyecto pasan');
chequear(E('https://t.me/+AbCdEf123') === 'invitacion' && E('t.me/joinchat/xyz') === 'invitacion' && E('t.me/otrogrupo') === 'invitacion' && E('tg://join?invite=abc') === 'invitacion', 'invitaciones y otros t.me no pasan');
chequear(E('t.me/lacueva', { tme: ['lacueva'] }) === 'ok', 'el t.me del propio grupo vinculado pasa');
chequear(E('https://wa.me/51900877863') === 'ok' && E('wa.me/51916778731?text=hola') === 'ok' && E('wa.me/51999888777') === 'telefono', 'wa.me: solo los dos numeros oficiales');
chequear(E('https://chat.whatsapp.com/AbC') === 'invitacion' && E('discord.gg/abc') === 'invitacion', 'invitaciones de WhatsApp y Discord');
chequear(E('https://youtube.com/watch?v=1') === 'enlace' && E('https://m.youtube.com/x', { dominios: ['youtube.com'] }) === 'ok', 'un dominio de fuera solo pasa si el dueño lo permitio');
chequear(telOficial('+51 900 877 863') && telOficial('916778731') && !telOficial('916778732'), 'telOficial reconoce solo los dos numeros');

console.log('Grupo: filtro antiespam');
const S = (texto, extra) => motivoSpam({ text: texto, ...(extra || {}) });
for (const t of ['hola a todos, ¿a qué hora sale el jefe mundial?', 'ya llegué al nivel 20 con mi mago', 'listo.me voy a cazar', 'tengo 15000 de oro y 9000/10000 de vida',
  'entren por https://duende-quest.alfonso12hc.workers.dev/jugar/ que es gratis', 'el bot es t.me/duendequest_bot', 'el WhatsApp del creador es +51 900 877 863', '¿cuál es el whatsapp oficial?',
  'la chicha se pide al 916 778 731', 'mañana 12/11 a las 20:00 hay Hora Feliz', 'gg', '']) chequear(S(t) === null, 'mensaje normal que se queda: «' + t + '» → ' + S(t));
chequear(S('gana dinero aquí https://bit.ly/abc') === 'enlace', 'enlace de fuera');
chequear(S('miren gana-premios.xyz') === 'enlace', 'dominio pelado con TLD claro');
chequear(S('únanse a t.me/+Abc123xyz') === 'invitacion' && S('mejor grupo: https://t.me/cripto_senales') === 'invitacion', 'invitacion a otro grupo');
chequear(S('escríbanme al 987 654 321') === 'telefono' && S('mi número +34 612 345 678') === 'telefono' && S('llama al 9 8 7 6 5 4 3 2 1') === 'telefono', 'telefono que no es oficial');
chequear(S('el oficial es 900 877 863 pero escribe al 987654321') === 'telefono', 'un numero oficial no tapa a otro que no lo es');
chequear(S('pásame tu frase semilla para validar tu cuenta') === 'estafa', 'frase semilla');
chequear(S('ganaste el premio, yapea 20 soles por el envío') === 'estafa', 'cobro por un premio');
chequear(S('mira esto', { entities: [{ type: 'text_link', offset: 0, length: 4, url: 'https://estafa.example.com/x' }] }) === 'enlace', 'enlace oculto tras un texto');
chequear(S('visita ejemplo.pe', { entities: [{ type: 'url', offset: 7, length: 10 }] }) === 'enlace', 'lo que Telegram marca como enlace cuenta aunque no lleve http');
chequear(motivoSpam({ caption: 'promo en https://otro.com', photo: [] }) === 'enlace', 'tambien mira el pie de una foto');
chequear(motivoSpam({ contact: { phone_number: '+51987654321' } }) === 'telefono' && motivoSpam({ contact: { phone_number: '+51900877863' } }) === null, 'contacto compartido: solo los oficiales');
chequear(motivoSpam({ text: 'hola', reply_markup: { inline_keyboard: [[{ text: 'x', url: 'https://otro.com' }]] } }) === 'enlace', 'boton con enlace de fuera');
chequear(/borré tu mensaje/.test(textoAvisoSpam('Ana', 'enlace')) && /frases semilla/.test(textoAvisoSpam('', 'telefono')), 'el aviso explica el motivo y repite la regla de seguridad');

console.log('Grupo: novedades sin cripto ni precios');
for (const t of ['Nuevo paquete en la tienda por US$ 5', 'Paga con Yape o Plin', 'Conecta tu wallet de Solana', 'El token $DUENDE sube', 'Retira tus mTON', '20 % de descuento este fin de semana', 'HODL', 'Revisa tu bolsa de tokens', 'Compra con Stars'])
  chequear(!lineaNovedadOk(t), 'linea que NO se publica: «' + t + '»');
chequear(lineaNovedadOk('⚔ Enemigos con carácter: avisan su ataque en el suelo.') && lineaNovedadOk('🎒 El inventario ahora ordena los objetos por rareza.'), 'una linea de juego si se publica');
const tn = textoNovedades({ n: 999, fecha: '1 dic 2026', items: ['🛒 Oferta en la tienda: skin a US$ 2', '⚔ Jefe nuevo en la Cueva.', '🪙 Paga con $DUENDE', '🗺 Zona nueva al norte.', '🎣 Pesca nueva.', '🏆 Ranking nuevo.'] });
chequear(tn && /Jefe nuevo/.test(tn) && /Zona nueva/.test(tn) && /Pesca nueva/.test(tn) && !/Ranking nuevo/.test(tn), 'salen como mucho 3 puntos');
chequear(tn && !/tienda|US\$|DUENDE\b.*Paga|\$DUENDE/.test(tn), 'ninguna linea de pagos o cripto');
chequear(textoNovedades({ n: 1, items: ['Compra con Stars', 'Precio nuevo'] }) === null, 'si no queda ninguna linea, no hay mensaje');
chequear(textoNovedades({ n: 2, gancho: 'Vuelve: hay jefe nuevo.', items: ['Vuelve: hay jefe nuevo.', 'Otra cosa.'] }).split('•').length === 3, 'el gancho va primero y no se repite');
const tnReal = textoNovedades(NOVEDADES[0]);
chequear(tnReal === null || !/\$DUENDE|\bTON\b|\bSOL\b|precio|yape/i.test(tnReal), 'la novedad real de hoy sale limpia');

console.log('Grupo: hitos agrupados');
chequear(hitoNivel(9, 10) === 10 && hitoNivel(10, 11) === 0 && hitoNivel(18, 31) === 30 && hitoNivel(59, 60) === 60 && hitoNivel(1, 9) === 0, 'hitos de nivel: 10, 20, 30… (el mas alto si salta varios)');
chequear(armarHitos([]) === null, 'sin hitos no hay mensaje');
chequear(armarHitos([{ k: 'a', txt: 'uno', pri: 1 }]) === 'uno', 'un hito: su linea sola');
const varios = armarHitos([{ k: 'nv:1', txt: 'Kusi 10', pri: 3 }, { k: 'nv:1', txt: 'Kusi 20', pri: 4 }, { k: 'mund', txt: 'jefe', pri: 2 }, { k: 'nv:2', txt: 'Illa 60', pri: 10 }]);
chequear(/Hitos de la comunidad/.test(varios) && !/Kusi 10/.test(varios) && /Kusi 20/.test(varios), 'varios: un resumen, y un solo hito de nivel por personaje');
chequear(varios.indexOf('Illa 60') < varios.indexOf('Kusi 20') && varios.indexOf('Kusi 20') < varios.indexOf('jefe'), 'lo mas importante va arriba');
chequear(/y 2 más/.test(armarHitos(Array.from({ length: 8 }, (_, i) => ({ k: 'k' + i, txt: 'h' + i, pri: i })))), 'mas de 6: «…y N más»');

console.log('Grupo: textos');
chequear(nombrePublico({ nombre: 'Kusi' }) === 'Kusi' && nombrePublico({ nombre: 'Kusi', ocultarNombre: true }) === 'Un duende' && nombrePublico({ nombre: 'yapea al 987654321' }) === 'Un duende', 'nombre de personaje, oculto o sospechoso');
chequear(nombreVisitante({ first_name: 'Ana <b>' }) === 'Ana b' && nombreVisitante({ first_name: 'Gana en t.me/estafa' }) === '', 'el nombre de quien entra se limpia');
const tb = textoBienvenida(['Ana'], 'LA CUEVA DEL DUENDE');
chequear(/Ana/.test(tb) && /contraseñas ni frases semilla/.test(tb) && /nadie del equipo te escribe primero por privado/.test(tb), 'la bienvenida lleva el nombre y la regla de seguridad');
chequear(/Bienvenidos/.test(textoBienvenida(['Ana', 'Luis', 'Kusi'])) && /y 2 más/.test(textoBienvenida(['a', 'b', 'c', 'd', 'e', 'f', 'g'])), 'varios nombres en un solo saludo');
chequear(!/<script/.test(textoBienvenida(['<script>'])), 'sin HTML del nombre');
const SIN = /\$DUENDE|\bTON\b|HODL|tu bolsa|precio|ganancia/i;
const tm = textoManana(Date.UTC(2026, 10, 11, 13, 0)), tno = textoNoche(Date.UTC(2026, 10, 12, 2, 0), { sub: { Kusi: 21, Illa: 34 }, mund: 5, mundMax: 4, racha: { n: 9, nombre: 'Kusi' }, extra: [] });
chequear(/Buenos días/.test(tm) && /Caza del día/.test(tm) && /Hora Feliz a las 8:00 p\. m\./.test(tm) && !SIN.test(tm), 'buenos dias: caza del dia y evento de hoy, sin cripto');
chequear(/T'anta Wawa/.test(tm) && /Tarea de hoy/.test(tm), 'buenos dias: el evento de temporada activo y su tarea');
chequear(/Semana nueva/.test(textoManana(Date.UTC(2026, 10, 16, 13, 0))) && !/Semana nueva/.test(tm), 'el lunes avisa de la semana nueva');
chequear(/Illa \(Nv 34\), Kusi \(Nv 21\)|Illa \(Nv 34\) y Kusi \(Nv 21\)/.test(tno) && /cayó 5 veces/.test(tno) && /Kusi, 9 días seguidos/.test(tno) && /Mañana/.test(tno) && !SIN.test(tno), 'buenas noches: quien subio, jefe mundial, mejor racha y mañana');
chequear(/estuvo tranquilo/.test(textoNoche(Date.UTC(2026, 10, 12, 2, 0), null)) && !/perd|castig|te lo pierdes|última oportunidad/i.test(tno + tm), 'un dia sin nada no culpa a nadie');
chequear(textoManana(reloj, 'Hola <duendes>').startsWith('Hola &lt;duendes&gt;'), 'el saludo del dueño se escapa');

// ═══════════════ 2. Con el mundo real ═══════════════
console.log('Grupo: sin vincular no se publica nada');
chequear((await interno({ tipo: 'entra', chat: GRUPO, users: [{ id: 1, first_name: 'Ana' }] })).ok === false && !tg.length, 'sin grupo vinculado no hay bienvenida');
mundo.grupoSubio({ c: { uid: 'inv:x1', nombre: 'Kusi', nivel: 20 } }, 19);
await espera();
await mundo.grupoAlarma();
chequear(!tg.length && !estado().cola.length, 'sin grupo vinculado no se anotan ni salen hitos');
chequear((await interno({ tipo: 'cmd', de: 1 }, 'otra-clave')).status === 403, '/interno/grupo pide la clave interna');

console.log('Grupo: /grupo aqui (solo el dueño)');
chequear(await webhook(msgG(31, '/grupo aqui')) === true && !tg.length && !estado().chat, 'un miembro cualquiera no vincula nada (silencio)');
chequear(await webhook({ message: { message_id: 1, chat: { id: 31, type: 'private' }, from: { id: 31 }, text: '/grupo' } }) === false, 'en privado, /grupo de otro sigue el flujo normal del bot');
await webhook({ message: { message_id: 2, chat: chatG, from: { id: 1087968824 }, sender_chat: { id: GRUPO }, text: '/grupo aqui' } });
chequear(!estado().chat && alGrupo().length === 1 && /sin el modo anónimo/.test(alGrupo()[0].text), 'administrador anonimo: no vincula y se le explica');
limpiar();
await webhook({ message: { message_id: 3, chat: { id: DUENO, type: 'private' }, from: { id: DUENO }, text: '/grupo aqui' } });
chequear(!estado().chat && /DENTRO del grupo/.test(alDueno()[0].text), 'en privado no se puede vincular');
limpiar();
chequear(await webhook({ message: { message_id: 4, chat: chatG, from: { id: DUENO }, text: '/grupo@duendequest_bot aquí' } }) === true, 'el webhook atiende /grupo aqui del dueño');
chequear(estado().chat === GRUPO && estado().titulo === 'LA CUEVA DEL DUENDE' && Object.values(estado().on).every(Boolean), 'grupo vinculado y todo encendido');
chequear(!alGrupo().length && alDueno().length === 1 && /Grupo vinculado/.test(alDueno()[0].text) && alDueno()[0].reply_markup.inline_keyboard.length === 6, 'la confirmacion va solo al dueño, con los 6 interruptores');
chequear(de('deleteMessage').some(x => x.message_id === 4), 'el comando se borra del grupo');
chequear(estado().ver === VERSION && estado().novN === NOVEDADES[0].n, 'lo ya publicado no se anuncia al vincular');
chequear(almacen.get('grupo').chat === GRUPO, 'queda guardado');

console.log('Grupo: bienvenida');
limpiar();
await webhook({ message: { message_id: 10, chat: chatG, from: { id: 41 }, new_chat_members: [{ id: 41, first_name: 'Ana' }, { id: 42, first_name: 'RoboBot', is_bot: true }] } });
chequear(alGrupo().length === 1 && /Ana/.test(alGrupo()[0].text) && !/Robo/.test(alGrupo()[0].text), 'saluda a quien entra (a los bots no)');
chequear(alGrupo()[0].reply_markup.inline_keyboard[0][0].url.endsWith('/jugar/') && !JSON.stringify(alGrupo()[0].reply_markup).includes('web_app'), 'boton Jugar con enlace (en grupos no hay web_app)');
const saludo1 = sigMsg;
reloj += 30000;
await webhook({ chat_member: { chat: chatG, from: { id: 41 }, old_chat_member: { status: 'left' }, new_chat_member: { status: 'member', user: { id: 41, first_name: 'Ana' } } } });
chequear(alGrupo().length === 1 && !de('editMessageText').length, 'la misma entrada vista dos veces (message y chat_member) no saluda dos veces');
await webhook({ message: { message_id: 11, chat: chatG, from: { id: 43 }, new_chat_members: [{ id: 43, first_name: 'Luis' }] } });
chequear(alGrupo().length === 1 && de('editMessageText').length === 1 && de('editMessageText')[0].message_id === saludo1 && /Ana/.test(de('editMessageText')[0].text) && /Luis/.test(de('editMessageText')[0].text), 'otro entra antes de 2 min: el mismo mensaje con los dos nombres');
reloj += 3 * 60000;
limpiar();
await webhook({ message: { message_id: 12, chat: chatG, from: { id: 44 }, new_chat_members: [{ id: 44, first_name: 'Kusi' }] } });
chequear(de('deleteMessage').some(x => x.message_id === saludo1) && alGrupo().length === 1 && /Kusi/.test(alGrupo()[0].text) && !/Ana/.test(alGrupo()[0].text), 'pasados 2 min: borra el saludo anterior y manda uno nuevo');
limpiar();
await webhook({ message: { message_id: 13, chat: { id: -999, type: 'group', title: 'Otro' }, from: { id: 45 }, new_chat_members: [{ id: 45, first_name: 'Eva' }] } });
chequear(!tg.length, 'en otro grupo no saluda');

console.log('Grupo: antiespam');
limpiar();
chequear(await webhook(msgG(61, 'hola, ¿cómo entro al juego?')) === false && !tg.length, 'un mensaje normal ni siquiera llega al mundo');
chequear(await webhook(msgG(61, 'gana plata facil https://estafa.example.com')) === true, 'spam de un miembro: atendido');
chequear(de('deleteMessage').some(x => x.message_id === 5061) && alGrupo().length === 1 && /borré tu mensaje/.test(alGrupo()[0].text), 'se borra y se avisa al autor');
chequear(!de('banChatMember').length && !de('kickChatMember').length && !de('restrictChatMember').length, 'no se expulsa ni se silencia a nadie');
const aviso1 = sigMsg;
chequear(alarma && alarma <= reloj + AVISO_SPAM_BORRAR_MS + 1000, 'la alarma se adelanta para borrar el aviso');
limpiar();
await webhook(msgG(61, 'otra vez t.me/+Invitacion99'));
chequear(de('deleteMessage').length === 1 && !alGrupo().length, 'segundo spam del mismo autor: se borra sin repetir el aviso');
limpiar();
chequear(await webhook(msgG(555, 'canal amigo https://youtube.com/x')) === false && !de('deleteMessage').length, 'a un administrador no se le borra');
chequear(await webhook(msgG(DUENO, 'mi canal https://youtube.com/x')) === false, 'al dueño tampoco');
chequear(await webhook({ message: { message_id: 20, chat: chatG, from: { id: 1087968824 }, sender_chat: { id: GRUPO }, text: 'https://otro.com' } }) === false && !de('deleteMessage').length, 'ni a un administrador anonimo');
chequear(await webhook({ edited_message: { message_id: 21, chat: chatG, from: { id: 62, first_name: 'Edu' }, text: 'ahora con enlace https://otro.com' } }) === true && de('deleteMessage').some(x => x.message_id === 21), 'un mensaje editado para meter un enlace tambien cae');
reloj += AVISO_SPAM_BORRAR_MS + 5000;
limpiar();
await mundo.alarm();
chequear(de('deleteMessage').some(x => x.message_id === aviso1) && !estado().borrar.length, 'el aviso se borra solo');
limpiar();
puedeBorrar = false;
await webhook(msgG(63, 'https://otro.com'));
chequear(!alGrupo().length && alDueno().length === 1 && /Eliminar mensajes/.test(alDueno()[0].text), 'sin permiso para borrar: se avisa al dueño, no al grupo');
await webhook(msgG(64, 'https://otro.com'));
chequear(alDueno().length === 1, '…y solo una vez al dia');
puedeBorrar = true;
limpiar();
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'permitir https://www.youtube.com/' });
chequear(estado().dom.includes('youtube.com') && await webhook(msgG(65, 'https://youtube.com/watch?v=1')) === false, '/grupo permitir deja pasar ese dominio');
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'antiespam off' });
limpiar();
chequear(await webhook(msgG(66, 'https://otro.com')) === false && !tg.length, 'antiespam apagado: no toca nada');
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'antiespam on' });

console.log('Grupo: hitos');
limpiar();
const pj = (uid, nombre, nivel) => ({ c: { uid, nombre, nivel } });
mundo.grupoSubio(pj('inv:a', 'Kusi', 10), 9);
mundo.grupoSubio(pj('inv:b', 'Illa', 7), 6);
await espera();
chequear(estado().cola.length === 1 && estado().res.sub.Kusi === 10 && estado().res.sub.Illa === 7, 'Nv 10 es hito; Nv 7 solo cuenta para el resumen');
await mundo.grupoAlarma();
chequear(!alGrupo().length, 'no sale al instante: espera 5 min por si llegan mas');
mundo.grupoMundial('Dragón de la Tormenta', 4);
mundo.grupoMundial('Coloso de Obsidiana', 2);
await espera();
chequear(estado().cola.length === 2 && estado().res.mund === 2 && estado().res.mundMax === 4, 'jefe mundial: hito solo la primera caida del dia; todas cuentan');
reloj += AGRUPAR_HITOS_MS + 1000;
await mundo.grupoAlarma();
chequear(alGrupo().length === 1 && /Hitos de la comunidad/.test(alGrupo()[0].text) && /Kusi<\/b> llegó al nivel 10/.test(alGrupo()[0].text) && /4 cazadores/.test(alGrupo()[0].text), 'varios hitos: UN mensaje con todos');
chequear(estado().hitosHoy === 1 && !estado().cola.length, 'cuenta uno en el tope del dia');
for (let i = 2; i <= 6; i++) {
  mundo.grupoSubio(pj('inv:c' + i, 'Duende' + i, 20), 19);
  await espera();
  reloj += AGRUPAR_HITOS_MS + 1000;
  await mundo.grupoAlarma();
}
chequear(alGrupo().length === HITOS_POR_DIA && estado().hitosHoy === HITOS_POR_DIA, 'tope: como mucho ' + HITOS_POR_DIA + ' mensajes de hitos al dia (' + alGrupo().length + ')');
chequear(estado().res.sub.Duende6 === 20, 'lo que no cabe queda para el resumen de la noche');
chequear(!alGrupo().some(x => /tg:|inv:|\d{6,}/.test(x.text)), 'solo nombres de personaje: ni uid ni numeros de cuenta');
// Personaje de prueba y nombre oculto
limpiar();
aLima(12, 10);
estado().man = '2026-11-12';   // el buenos dias de hoy ya salio
mundo.grupoSubio({ c: { uid: 'inv:db4c11dc0a66af5e7b009f14', nombre: 'Probador', nivel: 30 } }, 29);
mundo.grupoSubio({ c: { uid: 'inv:o', nombre: 'Secreto', nivel: 30, ocultarNombre: true } }, 29);
await espera();
chequear(estado().cola.length === 1 && /Un duende/.test(estado().cola[0].txt) && !estado().res.sub.Secreto && !estado().res.sub.Probador, 'los personajes de prueba no salen y quien oculta su nombre sale como «Un duende»');
reloj += AGRUPAR_HITOS_MS + 1000;
await mundo.grupoAlarma();
chequear(alGrupo().length === 1 && estado().hitosHoy === 1, 'dia nuevo: el tope vuelve a cero');
// Primer Nv 60
limpiar();
estado().p60 = false;
mundo.grupoSubio(pj('inv:r', 'Rumi', NIVEL_MAX), 59);
mundo.grupoSubio(pj('inv:s', 'Sami', NIVEL_MAX), 59);
await espera();
reloj += AGRUPAR_HITOS_MS + 1000;
await mundo.grupoAlarma();
chequear(alGrupo().length === 1 && /Primer nivel 60 del servidor.*Rumi/.test(alGrupo()[0].text) && /Sami<\/b> llegó al nivel 60/.test(alGrupo()[0].text), 'primer Nv 60 una sola vez; el segundo es un Nv 60 normal');
// De noche se guardan
limpiar();
aLima(13, 2);
mundo.grupoSubio(pj('inv:n', 'Nocturno', 40), 39);
await espera();
reloj += AGRUPAR_HITOS_MS + 1000;
await mundo.grupoAlarma();
chequear(!alGrupo().length && estado().cola.length === 1, 'de 23:00 a 8:00 no se escribe: el hito espera');
chequear(mundo.grupoProximo() === 0, '…y no adelanta la alarma de madrugada');

console.log('Grupo: buenos dias y buenas noches');
aLima(13, 8, 0);
await mundo.alarm();
chequear(alGrupo().length === 1 && /Buenos días/.test(alGrupo()[0].text) && /Mientras dormían/.test(alGrupo()[0].text) && /Nocturno/.test(alGrupo()[0].text), '8:00: buenos dias, con los hitos que esperaron');
chequear(alGrupo()[0].reply_markup.inline_keyboard[0][0].url.endsWith('/jugar/'), 'con boton Jugar');
aLima(13, 9, 0);
await mundo.alarm();
chequear(alGrupo().length === 1, 'solo uno por dia');
limpiar();
aLima(13, 20, 0);
await mundo.alarm();
chequear(!alGrupo().length, 'a las 20:00 aun no hay buenas noches');
mundo.grupoRacha({ uid: 'inv:a', nombre: 'Kusi', login: { racha: 9 } });
mundo.grupoRacha({ uid: 'inv:b', nombre: 'Illa', login: { racha: 4 } });
await espera();
aLima(13, 21, 0);
await mundo.alarm();
chequear(alGrupo().length === 1 && /Buenas noches/.test(alGrupo()[0].text) && /Nocturno \(Nv 40\)/.test(alGrupo()[0].text) && /Kusi, 9 días seguidos/.test(alGrupo()[0].text), '21:00: resumen del dia con subidas y mejor racha');
chequear(!Object.keys(estado().res.sub).length && !estado().res.racha, 'el resumen empieza de cero');
aLima(13, 22, 0);
await mundo.alarm();
chequear(alGrupo().length === 1, 'buenas noches: solo uno por dia');
limpiar();
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'manana off' });
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'texto noche Hasta mañana, cueva.' });
limpiar();
aLima(14, 8, 0);
await mundo.alarm();
chequear(!alGrupo().length, 'buenos dias apagado: no sale');
aLima(14, 21, 0);
await mundo.alarm();
chequear(alGrupo().length === 1 && alGrupo()[0].text.startsWith('Hasta mañana, cueva.') && /estuvo tranquilo/.test(alGrupo()[0].text), 'el saludo de la noche es editable');
await interno({ tipo: 'cmd', de: DUENO, chat: { id: DUENO, type: 'private' }, txt: 'manana on' });

console.log('Grupo: novedades');
limpiar();
aLima(15, 10, 0);
await mundo.alarm();
chequear(!alGrupo().some(x => /Novedades/.test(x.text)), 'misma version: no se anuncia nada');
estado().ver = VERSION - 1; estado().novN = NOVEDADES[0].n - 1;
aLima(16, 2, 0);
await mundo.alarm();
chequear(!alGrupo().some(x => /Novedades/.test(x.text)) && estado().ver === VERSION - 1, 'version nueva de madrugada: espera');
aLima(16, 9, 0);
await mundo.alarm();
const nov = alGrupo().filter(x => /Novedades de DUENDE QUEST/.test(x.text));
chequear((tnReal ? nov.length === 1 : nov.length === 0) && estado().ver === VERSION && estado().novN === NOVEDADES[0].n, 'version nueva de dia: un mensaje de novedades');
chequear(!nov.length || (nov[0].text.split('•').length - 1 <= 3 && !SIN.test(nov[0].text)), '2-3 puntos y sin cripto');
aLima(16, 10, 0);
await mundo.alarm();
chequear(alGrupo().filter(x => /Novedades de DUENDE QUEST/.test(x.text)).length === nov.length, 'como mucho uno por version');
estado().ver = VERSION - 1;
limpiar();
aLima(16, 11, 0);
await mundo.alarm();
chequear(!alGrupo().some(x => /Novedades/.test(x.text)) && estado().ver === VERSION, 'version nueva sin entrada nueva de NOVEDADES: no repite la anterior');

console.log('Grupo: panel del dueño');
limpiar();
await webhook({ message: { message_id: 30, chat: { id: DUENO, type: 'private' }, from: { id: DUENO }, text: '/grupo' } });
chequear(alDueno().length === 1 && /Grupo oficial/.test(alDueno()[0].text) && !alGrupo().length, '/grupo estado: solo al dueño');
limpiar();
chequear(await webhook({ callback_query: { id: 'c1', from: { id: DUENO }, data: 'grp:t:hitos', message: { message_id: 900, chat: { id: DUENO } } } }) === true && estado().on.hitos === false, 'interruptor: apaga los hitos');
chequear(de('editMessageText').length === 1 && de('editMessageText')[0].message_id === 900 && de('answerCallbackQuery').length === 1, 'el panel se actualiza en el mismo mensaje');
mundo.grupoSubio(pj('inv:z', 'Zoe', 50), 49);
await espera();
chequear(!estado().cola.length && estado().res.sub.Zoe === 50, 'hitos apagados: no hay cola, pero el resumen de la noche sigue');
await webhook({ callback_query: { id: 'c2', from: { id: 31 }, data: 'grp:t:hitos', message: { message_id: 900, chat: { id: 31 } } } });
chequear(estado().on.hitos === false, 'otro usuario no puede tocar los interruptores');
await webhook({ callback_query: { id: 'c3', from: { id: DUENO }, data: 'grp:t:hitos', message: { message_id: 900, chat: { id: DUENO } } } });
chequear(estado().on.hitos === true, 'interruptor: los vuelve a encender');
chequear(await webhook({ callback_query: { id: 'c4', from: { id: DUENO }, data: 'buy_1', message: { message_id: 1, chat: { id: DUENO } } } }) === false, 'los demas botones del bot no son de este modulo');
for (const f of ['bienvenida', 'novedades', 'hitos', 'manana', 'noche', 'antiespam']) {
  limpiar();
  await webhook({ callback_query: { id: 'v', from: { id: DUENO }, data: 'grp:v:' + f, message: { message_id: 900, chat: { id: DUENO } } } });
  chequear(alDueno().length === 1 && /Vista previa/.test(alDueno()[0].text) && !alGrupo().length, 'vista previa de ' + f + ': solo al dueño');
}

console.log('Grupo: ganchos en el juego real');
// Un jugador de verdad (invitado) sube de nivel con sumarXp: el gancho anota el hito.
class WsFalso { constructor() { this.l = {}; } accept() {} addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } send() {} close() {} emitir(t, ev) { for (const f of this.l[t] || []) f(ev); } }
const ws = new WsFalso();
mundo.abrir(ws);
const s = [...mundo.sesiones.values()].pop();
ws.emitir('message', { data: JSON.stringify({ t: 'hola', auth: { k: 'inv', tok: 'ab12'.repeat(8) }, nombre: 'Wayra' }) });
for (let i = 0; i < 300 && !s.c; i++) await new Promise(r => setTimeout(r, 10));
if (mundo.bucle && mundo.bucle !== 1) { clearInterval(mundo.bucle); mundo.bucle = 1; }
chequear(!!s.c, 'entra un jugador de verdad');
if (s.c) {
  limpiar();
  const xp0 = s.c.xp, oro0 = s.c.oro;
  s.c.nivel = 9; s.c.xp = 0;
  const { xpParaSubir } = await import('../mmo/js/data.js');
  const subio = mundo.sumarXp(s, xpParaSubir(9) + 5);
  await espera();
  chequear(subio === true && s.c.nivel === 10 && s.c.xp === 5, 'sumarXp sigue igual: sube a Nv 10 con la misma XP (sin premio extra)');
  chequear(s.c.oro === oro0, 'el modulo no da oro ni XP');
  chequear(estado().cola.some(h => /Wayra<\/b> llegó al nivel 10/.test(h.txt)), 'el gancho de sumarXp anota el hito');
  void xp0;
}
chequear(typeof mundo.premiosMundial === 'function' && typeof mundo.anotarRankTorre === 'function' && typeof mundo.anotarCuevaSem === 'function' && typeof mundo.procesarLogin === 'function', 'los metodos envueltos existen');

console.log('Grupo: soltar el grupo');
limpiar();
await webhook({ my_chat_member: { chat: chatG, from: { id: 9 }, new_chat_member: { status: 'kicked', user: { id: 4242 } } } });
chequear(!estado().chat && alDueno().length === 1 && /Me sacaron/.test(alDueno()[0].text), 'si sacan al bot, suelta el grupo y avisa al dueño');
await webhook({ message: { message_id: 40, chat: chatG, from: { id: DUENO }, text: '/grupo aqui' } });
chequear(estado().chat === GRUPO, 'se puede volver a vincular');
limpiar();
await webhook({ message: { message_id: 41, chat: { id: DUENO, type: 'private' }, from: { id: DUENO }, text: '/grupo off' } });
chequear(!estado().chat && /soltado/.test(alDueno()[0].text), '/grupo off lo suelta');
limpiar();
await webhook({ message: { message_id: 50, chat: chatG, from: { id: 70 }, new_chat_members: [{ id: 70, first_name: 'Eva' }] } });
await webhook(msgG(71, 'https://otro.com'));
aLima(17, 8, 0);
await mundo.alarm();
chequear(!alGrupo().length && !de('deleteMessage').length, 'soltado: ni bienvenida, ni antiespam, ni buenos dias');

console.log(`\n${ok} bien, ${mal} mal`);
Date.now = dateNowReal;
process.exit(mal ? 1 : 0);
