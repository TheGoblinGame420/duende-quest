// ═══════════════════════════════════════════════════════
// Pruebas de los rituales de la mañana y de la noche (functions/mmo/rituales.js).
// Las lanza tools/arnes_mmo.mjs al final de pruebas(), con sus mismos ayudantes
// (mundo, reloj falso, sockets falsos). No se ejecuta solo.
// ═══════════════════════════════════════════════════════
import * as R from '../functions/mmo/rituales.js';
import { xpParaSubir, NIVEL_MAX } from '../mmo/js/data.js';

const DIA = 86400000, H = 3600000;

export async function pruebasRituales({ mundo, chequear, entrar3d, entrar, entrarTg, dejar, calma, avanzar, ponerNivel }) {
  const { RITUAL } = R;
  console.log('Rituales: funciones puras (día de Lima, noche, olla, franjas)');
  // Hora de Lima → instante (UTC-5). Solo hacia adelante, como el resto del arnés.
  const irLima = (dia, hora, min = 7) => { const t = dia * DIA + (hora + 5) * H + min * 60000; if (t > Date.now()) avanzar(t - Date.now()); return t; };
  const t0 = 20000 * DIA;
  chequear(R.diaLima(t0 + 4 * H) === 19999 && R.diaLima(t0 + 5 * H) === 20000, 'el día cambia a medianoche de Lima (05:00 UTC)');
  chequear(R.horaLima(t0 + 5 * H) === 0 && R.horaLima(t0) === 19, 'hora de Lima = UTC-5');
  chequear(R.nocheId(t0 + (18 + 5) * H) === 20000 && R.nocheId(t0 + (23 + 5) * H) === 20000, 'de 18:00 a 23:59 es la noche de hoy');
  chequear(R.nocheId(t0 + (24 + 2 + 5) * H) === 20000 && R.nocheId(t0 + (24 + 4 + 5) * H) === null, 'de 00:00 a 03:59 sigue siendo la noche de ayer; a las 04:00 ya no es de noche');
  chequear(R.nocheId(t0 + (10 + 5) * H) === null && R.faltaNoche(t0 + (10 + 5) * H) === 8 * H && R.faltaNoche(t0 + (19 + 5) * H) === 0, 'a las 10:00 faltan 8 h para el ritual; a las 19:00 está abierto');
  const ol = { t: t0 };
  chequear(R.racionesOlla(null, t0) === 0 && R.racionesOlla(ol, t0 + 5 * H) === 0 && R.racionesOlla(ol, t0 + 6 * H) === 1, 'la olla reposa 6 h antes de dar su primera ración');
  chequear(R.racionesOlla(ol, t0 + 29 * H) === 1 && R.racionesOlla(ol, t0 + 30 * H) === 2 && R.racionesOlla(ol, t0 + 54 * H) === 3, 'una ración más por cada día');
  chequear(R.racionesOlla(ol, t0 + 500 * H) === RITUAL.ollaMax && RITUAL.ollaMax === 3, 'tope de 3 días: ni se pierde ni crece más');
  chequear(R.topeIntencion('xp', 20) === Math.round(xpParaSubir(20) * 0.01) && R.topeIntencion('xp', NIVEL_MAX) === 0 && R.topeIntencion('nada', 20) === 0, 'tope de la intención de caza: 1 % del nivel; a nivel máximo no hay');
  chequear(RITUAL.int.xp.pct <= 0.03, 'la intención de caza no pasa del 3 % de la XP de cada presa');
  chequear(R.franjaToca({ fr: { m: 7 } }, 7, 5) === 'm' && R.franjaToca({ fr: { m: 7 } }, 6, 5) === null && R.franjaToca({ fr: { m: 7 }, frd: { m: 5 } }, 7, 5) === null, 'la franja de la mañana toca a su hora y una sola vez al día');
  chequear(R.franjaToca({ fr: { n: 21 } }, 22, 5) === 'n' && R.franjaToca({ fr: { n: 21 } }, 20, 5) === null && R.franjaToca({ fr: { m: 3, n: 30 } }, 3, 5) === null && R.franjaToca({}, 7, 5) === null, 'la de la noche igual; horas fuera de rango o sin elección: nada');
  chequear(!R.consienteAviso('tg:1', { v: 1 }, {}) && R.consienteAviso('tg:1', { v: 1, si: 1 }, {}) && !R.consienteAviso('tg:1', { si: 1, off: 1 }, {}) && !R.consienteAviso('tg:1', { si: 1, bloq: 1 }, {}), 'Telegram: solo con e.si y sin /avisos off ni bloqueo');
  chequear(!R.consienteAviso('inv:a', { v: 1 }, {}) && R.consienteAviso('inv:a', { tc: '77' }, {}) && !R.consienteAviso('inv:a', { tc: '77' }, { 'tg:77': { off: 1 } }), 'web o invitado: solo si abrió su chat con el bot, y respeta el /avisos off de ese chat');

  console.log('Rituales: amanecer (una vez por día de Lima)');
  const d0 = R.diaLima() + 2;
  irLima(d0, 9);
  const a = await entrar3d('Madrugador', 'e7a1'); await calma();
  chequear(a.c.rit === undefined, 'un personaje empieza sin c.rit (los antiguos tampoco lo tienen)');
  a.limpiar(); await a.mandar({ t: 'rit', a: 'am' }); await calma();
  chequear(a.c.rit === undefined && a.ultimos('no').length === 1 && a.ultimos('rit').some(x => x.ab === 0), 'antes del nivel ' + RITUAL.nv + ' no hay ritual ni regalo');
  ponerNivel(a, 20, 'guerrero');
  a.limpiar(); await a.mandar({ t: 'rit', a: 'info' }); await calma();
  let inf = a.ultimos('rit').pop();
  chequear(inf && inf.ab === 1 && inf.am === 1 && inf.amPr.oro === 12 * 20 && inf.noche.ab === 0 && inf.noche.falta > 0 && inf.olla === null && inf.int === null, 'info: amanecer pendiente, noche cerrada a las 9:00, sin olla ni intención');
  chequear(inf.opc.length === 3 && inf.av && inf.av.m === null && inf.av.con === 0, 'ofrece las tres intenciones y dice que no hay recordatorio ni consentimiento');
  const oro0 = a.c.oro, poc0 = a.c.pw.pocion || 0;
  a.limpiar(); await a.mandar({ t: 'rit', a: 'am' }); await calma();
  chequear(a.c.oro - oro0 === 240 && (a.c.pw.pocion || 0) - poc0 === 1 && a.c.rit.am === d0, 'amanecer: +12 de oro por nivel y 1 poción');
  chequear(a.ultimos('rit').some(x => x.gan && x.gan.a === 'am' && x.am === 0), 'el cliente recibe lo ganado y el amanecer ya cobrado');
  const oroAm = a.c.oro;
  await a.mandar({ t: 'rit', a: 'am' }); await a.mandar({ t: 'rit', a: 'am' }); await calma();
  chequear(a.c.oro === oroAm, 'repetir el mensaje no da el regalo dos veces');
  // Dos pestañas: la segunda entra con el mismo personaje y tampoco lo cobra otra vez.
  const a2 = await entrar3d('Madrugador', 'e7a1'); await calma();
  const oro1 = a2.c.oro;
  await a2.mandar({ t: 'rit', a: 'am' }); await calma();
  chequear(a2.c.rit && a2.c.rit.am === d0 && a2.c.oro === oro1, 'con dos pestañas el amanecer se cobra una sola vez');
  const b = a2;

  console.log('Rituales: ritual de la noche');
  b.limpiar(); await b.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
  chequear(!b.c.rit.olla && b.ultimos('no').some(x => /18:00/.test(x.m)), 'de día el ritual de la noche está cerrado');
  irLima(d0, 19);
  b.limpiar(); await b.mandar({ t: 'rit', a: 'noche' }); await b.mandar({ t: 'rit', a: 'noche', i: '__proto__' }); await calma();
  chequear(!b.c.rit.olla && !b.c.rit.sig && b.ultimos('no').length >= 1, 'sin una intención válida no se hace');
  b.limpiar(); await b.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
  chequear(b.c.rit.olla && b.c.rit.sig && b.c.rit.sig.k === 'xp' && b.c.rit.no === d0 && b.c.rit.n === 1, 'deja la olla al fuego y guarda la intención');
  inf = b.ultimos('rit').pop();
  chequear(inf.noche.hecho === 1 && inf.cierre && inf.cierre.n === 1 && inf.sig.k === 'xp' && inf.int === null && inf.olla.r === 0 && inf.olla.ms > 0, 'tarjeta de cierre; la intención aún no vale y la olla reposa');
  const oro2 = b.c.oro;
  await b.mandar({ t: 'rit', a: 'noche', i: 'oro' }); await calma();
  irLima(d0 + 1, 1);   // la 1 de la madrugada: sigue siendo la misma noche
  await b.mandar({ t: 'rit', a: 'noche', i: 'oro' }); await calma();
  chequear(b.c.rit.n === 1 && b.c.rit.sig.k === 'xp' && b.c.oro === oro2, 'una vez por noche (tampoco de madrugada): no cambia ni duplica');
  chequear(mundo.ritualCaza(b, 1000) === 1000, 'la intención no vale la misma noche');

  console.log('Rituales: lo de anoche se cobra por la mañana');
  irLima(d0 + 1, 7);
  b.limpiar(); await b.mandar({ t: 'rit', a: 'info' }); await calma();
  inf = b.ultimos('rit').pop();
  const tope = Math.round(xpParaSubir(20) * 0.01);
  chequear(inf.am === 1 && inf.int && inf.int.k === 'xp' && inf.int.q === tope && inf.sig === null && inf.olla.r === 1, 'al volver: amanecer nuevo, intención madura y una ración en la olla');
  await mundo.guardar(b); await calma();   // el cambio de día con la sesión abierta cobra aquí la racha diaria: fuera de la cuenta
  const oro3 = b.c.oro, poc3 = b.c.pw.pocion || 0;
  await b.mandar({ t: 'rit', a: 'am' }); await calma();
  chequear(b.c.oro - oro3 === 240 + 200 && (b.c.pw.pocion || 0) - poc3 === 3 && b.c.rit.olla === null, 'el amanecer recoge la olla: +10 de oro por nivel y 2 pociones por ración');
  await b.mandar({ t: 'rit', a: 'olla' }); await calma();
  chequear(b.c.oro - oro3 === 440, 'la olla no se recoge dos veces');
  chequear(mundo.ritualCaza(b, 1000) === 1030 && b.c.rit.int.q === tope - 30, 'intención de caza: +3 % de la XP de la presa');
  chequear(mundo.ritualCaza(b, 10) === 10 && mundo.ritualCaza(b, 10) === 10 && mundo.ritualCaza(b, 10) === 10 && mundo.ritualCaza(b, 10) === 11, 'con presas pequeñas el 3 % se acumula sin redondear hacia arriba');
  const xpA = b.c.xp, nvA = b.c.nivel;
  mundo.dar(b, 100, 0, null, 1);
  chequear(b.c.nivel === nvA && b.c.xp - xpA >= 103, 'dar() pasa por la intención (XP +' + (b.c.xp - xpA) + ')');
  const dado = mundo.ritualCaza(b, 10000000) - 10000000;
  chequear(dado > 0 && b.c.rit.int.q === 0 && b.c.rit.int.g === tope, 'tope diario: en total da el 1 % del nivel (' + tope + ' XP) y ni un punto más');
  chequear(mundo.ritualCaza(b, 1000) === 1000 && mundo.ritualOro(b, 1000) === 0 && mundo.ritualPesca(b) === 0, 'agotada, ya no suma; y solo vale la intención elegida');

  console.log('Rituales: nada se pierde por faltar (tope de 3 días)');
  irLima(d0 + 1, 20);
  await b.mandar({ t: 'rit', a: 'noche', i: 'oro' }); await calma();
  chequear(b.c.rit.n === 2 && b.c.rit.sig.k === 'oro', 'segunda noche: intención de misiones');
  await dejar(b);
  irLima(d0 + 11, 15);   // vuelve diez días después, por la tarde
  const c = await entrar3d('Madrugador', 'e7a1'); await calma();
  c.limpiar(); await c.mandar({ t: 'rit', a: 'info' }); await calma();
  inf = c.ultimos('rit').pop();
  chequear(inf.olla && inf.olla.r === 3 && inf.olla.pr.oro === 600 && inf.olla.pr.pocion === 6, 'diez días fuera: la olla guarda 3 raciones (no 10, y tampoco 0)');
  chequear(inf.int && inf.int.k === 'oro' && inf.int.q === 60 * 20 && inf.am === 1, 'la intención esperó al día en que volvió');
  const oro4 = c.c.oro;
  chequear(mundo.ritualOro(c, 1000) === 150 && c.c.oro - oro4 === 150, 'intención de misiones: +15 % del oro de la misión');
  chequear(mundo.ritualOro(c, 100000) === 1200 - 150 && mundo.ritualOro(c, 1000) === 0, 'con tope diario de 60 de oro por nivel');
  c.c.diaria = { d: c.c.diaria && c.c.diaria.d, p: 999, ok: false };
  c.c.rit.int.q = 50; const oro5 = c.c.oro;
  mundo.diariaDe(c.c); c.c.diaria.p = 999;
  await c.mandar({ t: 'mision', diaria: true }); await calma();
  chequear(c.c.diaria.ok && c.c.oro - oro5 === 40 * 20 + 50, 'la caza del día pasa por la intención de misiones (+' + (c.c.oro - oro5) + ' de oro)');
  await c.mandar({ t: 'rit', a: 'olla' }); await calma();
  chequear(c.c.rit.olla === null && c.c.oro - oro5 === 850 + 600, 'la olla también se recoge sola, sin esperar al amanecer');

  console.log('Rituales: pesca, protector y nivel máximo');
  irLima(d0 + 11, 21);
  const mat0 = (c.c.mat || {}).pescado || 0;
  await c.mandar({ t: 'rit', a: 'noche', i: 'pesca' }); await calma();
  irLima(d0 + 12, 8);
  let extra = 0; for (let i = 0; i < 7; i++) extra += mundo.ritualPesca(c);
  chequear(extra === 5 && c.c.mat.pescado - mat0 === 5, 'intención de pesca: +1 pescado en las 5 primeras capturas y nada más');
  c.c.login = c.c.login || { d: null, racha: 1, total: 1 }; c.c.login.amu = 0;
  irLima(d0 + 12, 19); await c.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
  chequear(c.c.rit.n === 4 && c.c.login.amu === 0, 'cuatro rituales: aún sin protector');
  irLima(d0 + 13, 19); c.limpiar(); await c.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
  chequear(c.c.rit.n === 5 && c.c.login.amu === 1 && c.ultimos('rit').some(x => x.cierre && x.cierre.prot === 1), 'al quinto ritual se gana un protector 🧿 de la racha');
  c.c.login.amu = 2; c.c.rit.n = 9;
  irLima(d0 + 14, 19); await c.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
  chequear(c.c.rit.n === 10 && c.c.login.amu === 2, 'el protector no pasa de 2');
  ponerNivel(c, NIVEL_MAX, 'guerrero');
  irLima(d0 + 15, 19); c.limpiar(); await c.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await c.mandar({ t: 'rit', a: 'info' }); await calma();
  chequear(c.c.rit.n === 10 && c.ultimos('no').length === 1 && !c.ultimos('rit').pop().opc.some(x => x.k === 'xp'), 'a nivel máximo no se ofrece la intención de caza');
  await dejar(c);

  console.log('Rituales: recordatorios por Telegram (solo con consentimiento y franja elegida)');
  const tgReal = mundo.tgEnviar, tempReal = mundo.temporadaAviso, dormirReal = mundo.dormir;
  const salidos = []; let modo = 'ok';
  mundo.tgEnviar = async (metodo, cuerpo) => {
    salidos.push(cuerpo);
    if (modo === 'bloq') return { ok: false, error_code: 403 };
    if (modo === 'cae') return { ok: false, error_code: 502 };
    return { ok: true, result: {} };
  };
  mundo.temporadaAviso = () => null; mundo.dormir = async () => {};
  const con = s => { s.ultimos = t => s.ws.rec.filter(m => m.t === t); s.limpiar = () => { s.ws.rec.length = 0; }; return s; };
  try {
    const dA = d0 + 20;
    irLima(dA, 19);
    const p1 = con(await entrarTg('Puntual', 4101)), p2 = con(await entrarTg('SinPermiso', 4102)), p3 = con(await entrarTg('Apagado', 4103)), p4 = con(await entrarTg('SoloNoche', 4104)), p5 = con(await entrarTg('SinFranja', 4105));
    await calma();
    for (const s of [p1, p2, p3, p4, p5]) ponerNivel(s, 12, 'guerrero');
    const idx = await mundo.retIdx();
    for (const id of ['4101', '4103', '4104', '4105']) idx['tg:' + id].si = 1;
    idx['tg:4103'].off = 1;
    p1.limpiar(); await p1.mandar({ t: 'rit', a: 'aviso', m: 7, n: 21 }); await calma();
    chequear(idx['tg:4101'].fr && idx['tg:4101'].fr.m === 7 && idx['tg:4101'].fr.n === 21 && p1.ultimos('rit').some(x => x.av && x.av.m === 7 && x.av.n === 21 && x.av.con === 1 && x.avOk === 1), 'el jugador elige mañana a las 7 y noche a las 21');
    p2.limpiar(); await p2.mandar({ t: 'rit', a: 'aviso', m: 7, n: 21 }); await calma();
    chequear(idx['tg:4102'].fr && p2.ultimos('rit').some(x => x.av && x.av.con === 0), 'sin consentimiento la elección se guarda, pero el cliente sabe que falta el permiso');
    await p3.mandar({ t: 'rit', a: 'aviso', m: 7, n: 21 }); await p4.mandar({ t: 'rit', a: 'aviso', m: 99, n: 21 }); await calma();
    chequear(idx['tg:4104'].fr.m === undefined && idx['tg:4104'].fr.n === 21, 'una hora fuera de su franja no se guarda');
    // Esta noche Puntual hace su ritual; SoloNoche no.
    await p1.mandar({ t: 'rit', a: 'noche', i: 'xp' }); await calma();
    await mundo.avisosRitual();
    chequear(salidos.length === 0, 'a quien está conectado no se le escribe');
    for (const s of [p1, p2, p3, p4, p5]) await dejar(s);
    irLima(dA, 21);
    let r = await mundo.avisosRitual();
    chequear(r.enviados === 1 && String(salidos[0].chat_id) === '4104', 'noche: solo a quien eligió esa franja, consintió y aún no hizo el ritual (' + salidos.map(x => x.chat_id) + ')');
    chequear(/antes de dormir/.test(salidos[0].text) && /olla/.test(salidos[0].text) && /intención/.test(salidos[0].text) && /nada se pierde/.test(salidos[0].text) && !salidos[0].parse_mode, 'el texto dice lo que hay que hacer, sin presión y en texto plano');
    chequear(!/\$|DUENDE|HODL|bolsa|precio|ganancia|SOL\b|TON\b/i.test(salidos[0].text), 'sin cripto ni promesas en el texto');
    const kb = salidos[0].reply_markup.inline_keyboard.flat();
    chequear(kb.some(x => x.web_app) && kb.some(x => x.callback_data === 'mmoavisos:off'), 'botones: abrir el juego y dejar de recibir avisos');
    r = await mundo.avisosRitual(); irLima(dA, 22); r = await mundo.avisosRitual();
    chequear(r.enviados === 0 && salidos.length === 1, 'un solo mensaje por franja y día');
    // A la mañana siguiente.
    salidos.length = 0;
    irLima(dA + 1, 6); r = await mundo.avisosRitual();
    chequear(r.enviados === 0, 'antes de la hora elegida no sale nada');
    irLima(dA + 1, 7); r = await mundo.avisosRitual();
    chequear(r.enviados === 1 && String(salidos[0].chat_id) === '4101', 'mañana: a su hora, solo a Puntual (' + salidos.map(x => x.chat_id) + ')');
    chequear(/Buenos días, Puntual/.test(salidos[0].text) && /olla de Mama Asiri ya reposó: 1 ración/.test(salidos[0].text) && /intención de anoche se cumple hoy: \+3 % de XP de caza/.test(salidos[0].text) && /regalo del amanecer: \+144 de oro/.test(salidos[0].text), 'el mensaje cuenta lo que de verdad le espera (olla, intención y regalo)');
    chequear(idx['tg:4101'].ad === dA + 1 && idx['tg:4101'].frd.m === dA + 1, 'queda anotado: hoy ya no recibe además el aviso de vuelta');
    chequear(!mundo.puedeAvisar('tg:4101', idx['tg:4101'], dA + 1, idx), 'retencion.js no le manda otro el mismo día');
    r = await mundo.avisosRitual();
    chequear(r.enviados === 0, 'no se repite la franja de la mañana');
    // Entra por la mañana: por la noche le toca el de la noche (uno por franja).
    const p1b = con(await entrarTg('Puntual', 4101)); await calma(); await dejar(p1b);
    irLima(dA + 1, 21); salidos.length = 0; r = await mundo.avisosRitual();
    chequear(salidos.some(x => String(x.chat_id) === '4101') && salidos.some(x => String(x.chat_id) === '4104') && r.enviados === 2, 'por la noche, el de la noche (el de la mañana no lo impide)');
    // Quien ya entro hoy no recibe el de la mañana; fallo pasajero se reintenta; bloqueo se recuerda.
    irLima(dA + 2, 7); salidos.length = 0; modo = 'cae'; r = await mundo.avisosRitual();
    chequear(r.fallidos === 1 && idx['tg:4101'].frd.m !== dA + 2, 'si Telegram falla, la franja no queda gastada');
    irLima(dA + 2, 8); modo = 'bloq'; r = await mundo.avisosRitual();
    chequear(r.bloqueados === 1 && idx['tg:4101'].bloq === 1, 'se reintenta en la hora siguiente; si bloqueó al bot, se recuerda');
    irLima(dA + 2, 9); modo = 'ok'; salidos.length = 0; r = await mundo.avisosRitual();
    chequear(r.enviados === 0, 'a quien bloqueó al bot no se le vuelve a escribir');
    // Pausa: SoloNoche lleva mas de 3 dias sin entrar.
    irLima(dA + 3, 21); salidos.length = 0; r = await mundo.avisosRitual();
    chequear(salidos.some(x => String(x.chat_id) === '4104'), 'a los 3 días sin entrar todavía se le recuerda');
    irLima(dA + 4, 21); salidos.length = 0; r = await mundo.avisosRitual();
    chequear(r.enviados === 0 && salidos.length === 0, 'pasados 3 días sin entrar se deja de escribir (pausa hasta que vuelva)');
    // Ninguno: se borra la eleccion.
    const p4b = con(await entrarTg('SoloNoche', 4104)); await calma();
    avanzar(2000); await p4b.mandar({ t: 'rit', a: 'aviso', m: null, n: null }); await calma();
    chequear(idx['tg:4104'].fr === undefined && p4b.ultimos('rit').some(x => x.av && x.av.n === null), '«ninguno» borra la elección');
    await dejar(p4b);
    // Jugador web que abrio su chat con el bot (e.tc): recibe por ese chat con un enlace normal.
    const w = await entrar3d('WebAvisado', 'e7b2'); await calma(); ponerNivel(w, 12, 'mago');
    const uidW = w.c.uid;
    if (!mundo.uidsPrueba.has(uidW)) {
      idx[uidW].tc = '4199';
      await w.mandar({ t: 'rit', a: 'aviso', m: 6 }); await calma();
      await dejar(w);
      irLima(dA + 5, 6); salidos.length = 0; r = await mundo.avisosRitual();
      const mw = salidos.find(x => String(x.chat_id) === '4199');
      chequear(mw && mw.reply_markup.inline_keyboard.flat().some(x => x.url && !x.web_app), 'jugador web con chat abierto: recibe por su chat y con enlace normal');
      idx['tg:4199'] = { v: 1, off: 1 }; idx[uidW].frd = {};
      salidos.length = 0; r = await mundo.avisosRitual();
      chequear(!salidos.some(x => String(x.chat_id) === '4199'), 'y respeta el /avisos off de ese chat');
      delete idx['tg:4199'];
    } else await dejar(w);
    // Por la alarma de cada hora (retencion.js alarm): el elegido va primero y ese día no se suma el aviso de vuelta.
    irLima(R.diaLima(), 21);
    const p6 = con(await entrarTg('PorAlarma', 4106)); await calma(); ponerNivel(p6, 12, 'guerrero');
    idx['tg:4106'].si = 1;
    await p6.mandar({ t: 'rit', a: 'aviso', n: R.horaLima() }); await calma(); await dejar(p6);
    const hA = R.horaLima(), dAl = R.diaLima() + 1;
    irLima(dAl, hA); salidos.length = 0;
    await mundo.alarm();
    const m6 = salidos.filter(x => String(x.chat_id) === '4106');
    chequear(hA >= 18 && m6.length === 1 && /antes de dormir/.test(m6[0].text), 'alarm(): a su hora habitual recibe solo el recordatorio que eligió, no dos mensajes (' + m6.length + ')');
    chequear(R.textoAvisoRitual({ nombre: 'X', nivel: 1 }, 'm') === null && R.textoAvisoRitual({ nombre: 'X', nivel: 20, rit: { am: R.diaLima() } }, 'm') === null, 'sin nada real que decir (novato, o amanecer ya cobrado) no hay texto');
  } finally { mundo.tgEnviar = tgReal; mundo.temporadaAviso = tempReal; mundo.dormir = dormirReal; }
}
