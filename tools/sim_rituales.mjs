// ═══════════════════════════════════════════════════════
// Simulación: ¿cuánto acelera la subida a Nv 60 el ciclo de mañana y noche?
// (functions/mmo/rituales.js). Usa las fórmulas REALES de data.js y las
// constantes reales de RITUAL; solo se suponen los hábitos del jugador.
//
//   node tools/sim_rituales.mjs
//
// Modelo de un día: caza `min` minutos a `kpm` presas por minuto, presas de su
// nivel en ORIGINS (statsMonstruo x el premio de dureza desde Nv 5), con la XP
// de descanso que acumuló fuera (data.js), la caza del día si llegó a 25 presas
// y, si la usa, una expedición de 12 h. No cuenta misiones de la historia,
// jefes, eventos ni vasos: como son iguales con y sin ritual, dejarlos fuera
// hace que el ritual pese MÁS de lo real (medida conservadora).
// Con ritual: hace el ritual TODAS las noches y elige SIEMPRE la intención de
// caza (el peor caso para la subida). El amanecer y la olla no dan XP.
// Sale con código 1 si algún perfil pasa del 3 %.  tools/ no se publica.
// ═══════════════════════════════════════════════════════
import { xpParaSubir, statsMonstruo, premioDiaria, premioExpedicion, descansoGanado, DESCANSO_MAX, DIARIA } from '../mmo/js/data.js';
import { RITUAL, topeIntencion, premioAmanecer, premioOlla } from '../functions/mmo/rituales.js';

const META = 60, LIMITE = 3;
const premioDureza = nv => 1 + 0.5 * Math.min(1, Math.max(0, (nv - 5) / 15));   // mundo3d.js durezaPresa3d
const xpPresa = nv => Math.round(statsMonstruo('goblin_normal', nv).xp * premioDureza(nv));

// Devuelve { dias, xpRitual, xpTotal } hasta Nv 60.
function simular({ min, kpm, exped, ritual }) {
  let nv = 3, xp = 0, dias = 0, descanso = 0, xpRitual = 0, xpTotal = 0;
  const sumar = n => { xp += n; xpTotal += n; while (nv < META && xp >= xpParaSubir(nv)) { xp -= xpParaSubir(nv); nv++; } };
  while (nv < META && dias < 5000) {
    dias++;
    // Fuera del juego acumula descanso (tope 1,5 niveles).
    descanso = Math.min(Math.round(xpParaSubir(nv) * DESCANSO_MAX), descanso + descansoGanado(nv, (24 - min / 60) * 3600000));
    if (exped) sumar(premioExpedicion(12, nv, 'bosque').xp);
    let pozo = ritual ? topeIntencion('xp', nv) : 0, frac = 0;
    const presas = Math.round(min * kpm);
    for (let i = 0; i < presas && nv < META; i++) {
      let x = xpPresa(nv);
      const extra = Math.min(descanso, x); descanso -= extra; x += extra;
      if (pozo > 0) { frac += x * RITUAL.int.xp.pct; const b = Math.min(pozo, Math.floor(frac)); frac -= b; pozo -= b; x += b; xpRitual += b; }
      sumar(x);
    }
    if (presas >= DIARIA.n && nv < META) sumar(premioDiaria(nv).xp);
  }
  return { dias, xpRitual, xpTotal };
}

const PERFILES = [
  { nombre: 'Casual 15 min, con expedición', min: 15, kpm: 2, exped: true },
  { nombre: 'Casual 15 min, sin expedición', min: 15, kpm: 2, exped: false },
  { nombre: 'Regular 45 min, con expedición', min: 45, kpm: 2.5, exped: true },
  { nombre: 'Regular 45 min, sin expedición', min: 45, kpm: 2.5, exped: false },
  { nombre: 'Intenso 2 h, con expedición', min: 120, kpm: 3, exped: true },
  { nombre: 'Maratón 5 h, con expedición', min: 300, kpm: 3.5, exped: true },
  { nombre: 'Solo caza 10 presas (ni diaria)', min: 5, kpm: 2, exped: false },
];
const pct = (a, b) => Math.round((1 - b / a) * 1000) / 10;
let peor = 0;
console.log('Ritual de mañana y noche: efecto en la subida a Nv ' + META + ' (todas las noches, siempre intención de caza)\n');
console.log('Perfil'.padEnd(36) + 'Días sin'.padStart(9) + 'Días con'.padStart(9) + 'Más rápido'.padStart(12) + 'XP del ritual'.padStart(15));
for (const p of PERFILES) {
  const a = simular({ ...p, ritual: false }), b = simular({ ...p, ritual: true });
  const ac = pct(a.dias, b.dias), parte = Math.round(b.xpRitual / b.xpTotal * 1000) / 10;
  peor = Math.max(peor, ac, parte);
  console.log(p.nombre.padEnd(36) + String(a.dias).padStart(9) + String(b.dias).padStart(9) + (ac + ' %').padStart(12) + (parte + ' %').padStart(15));
}
console.log('\nPor construcción: la intención da el ' + Math.round(RITUAL.int.xp.pct * 100) + ' % de la XP de cada presa y como mucho el ' + Math.round(RITUAL.int.xp.tope * 100) + ' % de un nivel al día; nunca puede pasar del ' + Math.round(RITUAL.int.xp.pct * 100) + ' % de la XP de un jugador.');

// Aparte y sin maquillar: el ritual invita a usar la expedición de 12 h, que YA existía (no se tocó).
// Quien antes no la mandaba y ahora sí, sube más rápido por esa expedición, no por premios nuevos.
console.log('\nEfecto indirecto (premio que ya existía): un jugador que NO usaba expediciones y empieza a mandar la de 12 h por el ritual');
for (const p of PERFILES.filter(x => !x.exped && x.min >= 15)) {
  const a = simular({ ...p, ritual: false }), b = simular({ ...p, exped: true, ritual: true });
  console.log('  ' + p.nombre.replace(', sin expedición', '').padEnd(34) + String(a.dias).padStart(9) + String(b.dias).padStart(9) + (pct(a.dias, b.dias) + ' %').padStart(12));
}

console.log('\nOro y pociones del ciclo por día (no dan XP), frente a lo que ya da el juego:');
for (const nv of [10, 30, 60]) {
  const am = premioAmanecer(nv), ol = premioOlla(nv, 1), ex = premioExpedicion(12, nv, 'bosque'), di = premioDiaria(nv);
  console.log(`  Nv ${String(nv).padStart(2)}: amanecer ${am.oro} + olla ${ol.oro} = ${am.oro + ol.oro} de oro y ${am.pocion + ol.pocion} pociones; intención de misiones hasta ${topeIntencion('oro', nv)} de oro.  (Ya existían: caza del día ${di.oro}, expedición de 12 h ${ex.oro})`);
}
console.log(peor <= LIMITE ? `\nOK: ningún perfil pasa del ${LIMITE} % (peor: ${peor} %).` : `\nFALLA: algún perfil pasa del ${LIMITE} % (${peor} %).`);
process.exit(peor <= LIMITE ? 0 : 1);
