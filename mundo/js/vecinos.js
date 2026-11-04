// ═══════════════════════════════════════════════════════
// LOS VECINOS DE ORIGINS: la gente de carne y hueso de las secundarias.
//
// La Abuela vive en la plaza (la Chichera esta en NPCS3D, por su tienda); cada zona tiene a su narrador junto
// a su hito (el obelisco con la columna celeste), en un sitio llano, seco y a mas
// de 20 m de un campamento (posiciones comprobadas contra alturaEn y campamentos).
// Solo cliente: el servidor no los necesita, ni cambian progreso ni premios.
//
// comenta[n]: lo que dice cuando ya venciste a n jefes de la cadena (0 a 10); vale
// la clave mas alta que no pase de n. Nada de esto adelanta quien abrio la puerta.
// especial: frase que sale una vez si ya cumpliste esa secundaria; despues siguen los comentarios.
// ═══════════════════════════════════════════════════════

export const VECINOS = [
  { id: 'sisa', nombre: 'Abuela Sisa', hoja: 'goblin_peasant', emoji: '👵', rol: '🥖 Horno', zona: 'pueblo', x: 10, z: -13, look: { color: '#a8452f', acc: 'capucha', accC: '#6b2d5c' } },
  { id: 'mallku', nombre: 'Tayta Mallku', hoja: 'goblin_peasant', emoji: '👴', rol: '🌱 Chacra', zona: 'amanecer', x: 176, z: -155, look: { color: '#7a6a48', acc: 'paja', accC: '#b08a4a' } },
  { id: 'amaru', nombre: 'Chamán Amaru', hoja: 'goblin_mage', emoji: '🌿', rol: '🌿 Sanador', zona: 'selva', x: 180, z: 225, look: { color: '#2f855a' } },
  { id: 'coya', nombre: 'Herrera Coya', hoja: 'goblin_guard', emoji: '⚒️', rol: '⚒️ Fragua', zona: 'tormenta', x: -289, z: 210, look: { color: '#c2571a' } },
  { id: 'illari', nombre: 'Viajera Illari', hoja: 'goblin_normal', emoji: '🐪', rol: '🐪 Caravana', zona: 'desierto', x: -485, z: -32, look: { color: '#c9a35e', acc: 'paja', accC: '#e0c080' } },
  { id: 'kantu', nombre: 'Espía Kantu', hoja: 'goblin_assassin', emoji: '🗡️', rol: '🗡️ Espía', zona: 'castillo', x: -12, z: -454 },
  { id: 'inti', nombre: 'Guardián Inti', hoja: 'goblin_guard', emoji: '☀️', rol: '☀️ Guardián', zona: 'cumbres', x: 503, z: -369, look: { color: '#d4a017' } },
  { id: 'nusta', nombre: 'Minera Ñusta', hoja: 'goblin_centurion', emoji: '⛏️', rol: '⛏️ Mina', zona: 'cavernas', x: 422, z: 82, look: { color: '#8a6d3b' } },
  { id: 'quilla', nombre: 'Farera Quilla', hoja: 'goblin_samurai', emoji: '🏮', rol: '🏮 Faro', zona: 'abismo', x: 21, z: 474, look: { color: '#4a7fb5' } },
  { id: 'ocllo', nombre: 'Sabia Mama Ocllo', hoja: 'goblin_mage', emoji: '🦅', rol: '🦅 Mirador', zona: 'acantilados', x: -489, z: 477, look: { color: '#dbeafe' } },
].map(v => ({ ...v, tipo: 'vecino_' + v.id, dist: 4.5 }));

// Voces: id del PNJ (los cuatro del pueblo usan su id de NPCS3D).
export const VOCES = {
  guia: {
    frases: ['Ni un feriado, oe. Ni que quisiera.', 'Sigue la luz amarilla, causa.', 'Hay cosas que uno cuida porque una vez no las cuidó.'],
    comenta: {
      0: 'Todavía anda suelto el Sabueso Infernal, causa. Empieza por ahí.',
      1: '¿Tumbaste al Sabueso, oe? Bien. El camino sigue por las Colinas Rojas.',
      2: 'Dicen que el Rey Goblin Caballero ya no se levanta. Yo de mi puesto no me muevo, pero te aplaudo.',
      3: 'El Señor de la Guerra cayó en la selva. Me lo contaron. Por aquí nadie descansa igual… o sea, yo.',
      4: 'Ghoul Infernal menos. Ojalá los Picos dejen de oler a quemado, causa.',
      5: '¿El Ángel Caído también? Tú no te cansas, oe. Ni un feriado, igualito a mí.',
      6: 'No me mires así, causa. Haz tu ronda.',
      7: 'Ya te dijeron algo de mí en las cumbres, ¿no? Sigue la luz amarilla. No preguntes.',
      8: 'Ese nombre que traes de las cavernas no lo digas fuerte aquí, oe. Por favor.',
      9: 'El Leviatán, nada menos. Yo solo cuido una puerta, causa. Una sola.',
      10: 'Dragón Ancestral, oe. Y yo aquí, con mi linterna. Te debo una.',
    },
    especial: [{ ok: 'x4', t: 'Hoy Grumo me cubre el puesto y me cobra por hora, causa. Ni un feriado, pero una siesta sí.' }],
  },
  mercader: {
    frases: ['Grumo acepta oro, no excusas.', '¿Rescatar? ¿Yo? Eso no deja ganancia.', 'Precio de amigo. De amigo que paga.'],
    comenta: {
      0: 'Con el Sabueso suelto y la bolsa vacía no llegas lejos. Grumo acepta oro, no excusas.',
      1: '¿Venciste al Sabueso? Eso sube tu fama. Mis precios, no. Todavía.',
      2: 'Caballero caído, armadura perdida. Si encuentras una, Grumo la tasa. Precio de amigo.',
      3: 'Sin el Señor de la Guerra, el camino a la selva vende mejor. Sigue así, que me haces ganar.',
      4: '¿Te hablaron de mí en la fragua? Esa gente conversa mucho y compra poco.',
      5: 'El Ángel Caído, dices. ¿Y las plumas? Grumo paga bien por plumas.',
      6: 'Cayó el Rey y nadie me paga lo que me debe. ¡Qué roche! Bueno, compra algo.',
      7: 'Deja tranquilo a Tito. Yo le vendo el aceite y sé cómo duerme: poco.',
      8: 'En las cavernas hablan mucho. Aquí se compra.',
      9: '¿Botellas del mar? No compro cartas viejas. Esas cobran caro.',
      10: 'Dragón Ancestral, y todavía regateas. Grumo te respeta, pero no te rebaja.',
    },
    especial: [{ ok: 'x4', t: 'Ahora hago guardia yo y le cobro a Tito cada hora. ¿Qué? Negocios.' }, { ok: 't4', t: '¿Quién te contó? ¡Esa Coya! Ya, no le digas a nadie. Me espantas la clientela.' }],
  },
  sabio: {
    frases: ['El sabio no pega más fuerte, pega a tiempo.', 'Un libro abierto no pregunta quién lo lee.', 'Quien enseña no elige lo que harán con lo aprendido.'],
    comenta: {
      0: 'El sabio no pega más fuerte, pega a tiempo. Piénsalo antes de ir por el Sabueso.',
      1: 'Un Sabueso menos. El bosque lo nota, aunque no lo diga.',
      2: 'Caído el Caballero, las Colinas respiran. Sigue leyendo el camino.',
      3: 'Sí, a mi libro le falta una página. Un libro abierto no pregunta quién lo lee. No insistas.',
      4: 'El Ghoul olvidó lo que los Picos recuerdan: todo lo que arde, se apaga.',
      5: '¿Una «o» con rulito? Muchos aprendieron a escribir en este pueblo. Déjame solo un rato.',
      6: 'Cayó el Rey y el Cántaro sigue roto. El que rompe no siempre es el que sabe.',
      7: 'Desde arriba los muertos lo ven todo. Yo, desde aquí, solo callo.',
      8: 'Fui su maestro. Eso no se borra.',
      9: 'El mar devuelve tarde. Yo también debí devolver una respuesta.',
      10: 'Llegaste más lejos que él. Hoy no te voy a decir más que eso.',
    },
    especial: [{ ok: 'v3', t: 'Ya viste la pizarra. No le enseñé al Rey: le enseñé a un niño. Eso tampoco se borra.' }],
  },
  artesana: {
    frases: ['Ay, no, qué roche ese poncho.', 'Un hilo no miente. La gente, sí.', 'Mira el tinte, no al que lo lleva.'],
    comenta: {
      0: 'Con ese poncho no vas ni donde el Sabueso. Ay, no, qué roche.',
      1: 'Traes pelos de Sabueso en el poncho. Ven, te lo limpio.',
      2: 'Ese Caballero tenía mal gusto hasta para caer. Un hilo no miente.',
      3: 'Hueles a selva. Tráeme de esas hierbas, que el morado sale mejor.',
      4: 'El Ghoul te dejó el poncho chamuscado. Eso se zurce; lo otro, ya veremos.',
      5: 'Arena en todas las costuras. Mira el tinte, no al que lo lleva.',
      6: 'Cayó el Rey y su capa ni combinaba. Lo que me quita el sueño es otro hilo.',
      7: 'Tapado con manta, dicen. Un hilo no miente, y esa manta tenía buena mano.',
      8: 'El barro de esas cavernas pega hasta lo que no quiere pegarse.',
      9: 'El agua salada no le hace nada a mi tinte. A la gente, sí.',
      10: 'Un Dragón Ancestral y ese poncho sin un roto. ¡Eso es trabajo bien hecho!',
    },
  },
  chichera: {
    frases: ['Un chorrito para la Pachamama y recién para ti.', 'Sin apuro, wawa. La olla no sabe de relojes.', 'Yo no creo en nadie, pero a todos les sirvo.'],
    comenta: {
      0: 'Anda, vence al Sabueso y me cuentas, wawa. Yo esa noche estaba bajo la mesa.',
      1: 'El nudo no lo cortaron, wawa. Mira bien a quién saludas hoy.',
      2: 'Un Rey Caballero menos. Toma tu yapa de chisme: ese hilo morado no llegó solo a la puerta.',
      3: 'Una página arrancada, ¿no? Yo no creo en nadie, pero a todos les sirvo.',
      4: 'Así que Grumo compraba. Mira al tacaño. Sírvele, pero no se lo digas.',
      5: 'Esa letra te va a quitar el sueño, wawa. A mí la olla me lo quita primero.',
      6: 'Tito no sabe mentir, le suda la oreja. Yo a ese no le creo.',
      7: 'Tito dormía, ¿no? Entonces alguien lo hizo dormir, wawa. Piensa.',
      8: 'Sami. Hace mucho que nadie decía ese nombre en mi puesto. Baja la voz.',
      9: '«Señora: su hijo vive.» Madres hay muchas en este pueblo, wawa. Sírvete y piensa.',
      10: 'Con el Dragón abajo ya casi no queda a quién culpar afuera. Siéntate, wawa.',
    },
    especial: [{ ok: 'x4', t: 'Ahora la Abuela amasa aquí conmigo, wawa. Yo sirvo y tú descansas un rato.' }],
  },
  sisa: {
    frases: ['Pasa, hijito, come primero.', 'Yo solo amaso. ¿Qué voy a saber?', 'Cada pan tiene su carita. Algunas pesan.'],
    comenta: {
      0: 'Pasa, hijito, come primero. El Sabueso puede esperar un ratito.',
      1: '¿Venciste a esa bestia? Toma, hijito, un pan caliente para el camino.',
      2: 'Mi nieto te manda muy lejos. Cuídate, hijito, que ese chico no come.',
      3: 'La selva da hambre, hijito. Siéntate.',
      4: 'Por los Picos no llega ni la harina. Por eso guardo un poquito.',
      5: 'Hasta el desierto, hijito. Ni los pájaros llegan tan lejos.',
      6: '¿Cayó el Rey? Ay, hijito. Yo solo amaso. ¿Qué voy a saber?',
      7: 'No le hagas caso a mi nieto, hijito. Se carga cosas que no son suyas.',
      8: '¿Ese nombre? Hoy me salió mal la masa, hijito. Come, que se enfría.',
      9: 'Cada pan tiene su carita. Algunas pesan.',
      10: 'Siempre hago uno de más, hijito. Ya sabes. No preguntes para quién.',
    },
    especial: [{ ok: 'x4', t: 'Ven, siéntate. Hoy hay plato para todos.' }],
  },
  mallku: {
    frases: ['La tierra no apura.', 'Yo vi lo que vi, pero nadie preguntó.', 'Mis rodillas avisan la lluvia.'],
    comenta: {
      0: 'Tan lejos del bosque, y sin haber vencido al Sabueso. La tierra no apura, pero avisa.',
      1: 'Bien por el Sabueso. Aquí manda el Caballero, y a él no le gusta el maíz.',
      2: 'Cayó el Caballero y mis rodillas ya no avisan lluvia. Avisan siembra.',
      6: 'El Rey también, me dicen. Yo sigo sembrando. Alguien tiene que hacerlo.',
    },
  },
  amaru: {
    frases: ['El monte tiene dueños. Saluda.', 'Si oyes silbar, no contestes.', 'El Chullachaqui no es malo: cuida.'],
    comenta: {
      0: 'Vienes temprano. El monte tiene dueños, y este todavía no te conoce.',
      2: 'Saluda antes de entrar. El Señor de la Guerra no saludó, y por eso el monte lo espera.',
      3: 'Cayó el Señor de la Guerra. El monte ya respira mejor. El maíz recuerda.',
      6: 'Hasta aquí llegó el ruido del Rey cayendo. El monte no se inmutó.',
    },
  },
  coya: {
    frases: ['Si no canta, no es metal.', 'Mandé un clavo. El clavo equivocado.', 'Yo forjo; las dudas, otro día.'],
    comenta: {
      0: '¿Tan pronto por aquí? Si no canta, no es metal. Y tú todavía no cantas.',
      3: 'El Ghoul Infernal me quema los libros y me apaga la fragua. A ver si cantas más fuerte que él.',
      4: '¡Cayó el Ghoul! Eso sí sonó a metal. Yo forjo; las dudas, otro día.',
      6: 'El Rey al suelo. Si su corona no cantó al caer, era falsa como él.',
    },
  },
  illari: {
    frases: ['Una gota es una gota.', 'En la arena todo deja huella un rato.', 'He visto esa letra. Yo no olvido.'],
    comenta: {
      0: 'Si llegaste hasta aquí tan pronto, cuenta bien tu agua.',
      4: 'El Ángel Caído bebe del cielo y deja seca la arena. Mídete con él cuando tengas agua.',
      5: 'Cayó el Ángel. Son dos jornadas de agua menos que la caravana pierde. Gracias.',
      6: 'Las órdenes del castillo ya no llegan. Y aun así, esa letra no se me olvida.',
    },
  },
  kantu: {
    frases: ['Baja la voz.', 'Dos guardias. Tres si cuentas al gato.', 'Yo no estuve aquí. Tú tampoco.'],
    comenta: {
      0: 'Baja la voz. Y vuelve cuando no se te note tanto.',
      5: 'El Rey está en su trono. Dos guardias. Tres si cuentas al gato.',
      6: 'Cayó. Oí lo que dijo. No se lo repitas a nadie en la plaza.',
      7: 'La torre sigue vacía. Yo no estuve aquí. Tú tampoco.',
    },
  },
  inti: {
    frases: ['Te saludan los que ya no pueden.', 'Desde arriba, todo se ve pequeño. Hasta la culpa.', 'Aquí el sol se queda dormido. Es flojo.'],
    comenta: {
      0: 'Te saludan los que ya no pueden. A ti todavía te falta camino para responderles.',
      6: 'El Coloso de Hueso guarda lo que los muertos vieron. Sube cuando quieras saberlo.',
      7: 'Cayó el Coloso. Los huesos ya hablaron. Aquí el sol sigue durmiendo: es flojo.',
    },
  },
  nusta: {
    frases: ['Al Muki se le deja algo. Por las dudas.', 'La veta no regala, se trabaja.', 'Ese barro late, ¿lo oyes?'],
    comenta: {
      0: 'La veta no regala, se trabaja. Y a ti te falta brazo todavía.',
      7: 'El Rey Cangrejo se sienta sobre el barro bueno. Sácalo de ahí.',
      8: 'Se fue el Rey Cangrejo. Ese barro late, ¿lo oyes? Déjale algo al Muki, por las dudas.',
    },
  },
  quilla: {
    frases: ['El mar todo devuelve, pero tarde.', 'Sin faro no hay regreso.', 'Yo solo enciendo. Tú decides adónde vas.'],
    comenta: {
      0: 'Sin faro no hay regreso. No te metas al agua todavía.',
      8: 'El Leviatán se traga las botellas antes de que lleguen. Cuento los días con las que quedan.',
      9: 'El Leviatán ya no canta. Esta noche enciendo el faro más alto.',
    },
  },
  ocllo: {
    frases: ['Del borde se ve todo. Siéntate.', 'Antes de volar, escucha.', 'El que perdona no olvida. Hace otra cosa.'],
    comenta: {
      0: 'Del borde se ve todo, y tú aún no estás para verlo. Vuelve con más camino.',
      9: 'El Dragón Ancestral guarda el último pedazo. Antes de volar, escucha.',
      10: 'Cayó el Dragón. Ahora siéntate, y mira esa alma que no se aleja del borde.',
    },
  },
};

// Lo que dice segun lo que ya hiciste: { clave para no repetirla, texto } o null. Sin sec: solo el comentario del capitulo.
export function comentarioNpc(id, jefes, sec) {
  const V = VOCES[id];
  if (!V) return null;
  for (const e of V.especial || []) if ((sec || {})[e.ok + ':ok']) return { k: 'e' + e.ok, t: e.t };
  let mejor = -1;
  for (const k of Object.keys(V.comenta || {})) if (+k <= jefes && +k > mejor) mejor = +k;
  return mejor < 0 ? null : { k: 'c' + mejor, t: V.comenta[mejor] };
}
