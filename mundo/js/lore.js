// ═══════════════════════════════════════════════════════
// LORE DE ORIGINS — La leyenda del Cántaro Eterno (v296)
// Textos revisados a mano (investigación de foros de MMO: una frase fuerte
// por zona, PNJ con voz propia, pistas sueltas que dan metas).
// ═══════════════════════════════════════════════════════

// Al entrar en cada zona (una vez por sesión) y su pedazo del Cántaro.
export const LORE_ZONAS = {
  noche: { intro: 'Desde que se rompió el Cántaro Eterno, aquí nunca amanece. Los goblins rondan entre los árboles y solo brillan las linternas del Pueblo Duende.', pedazo: 'El Asa del Cántaro, escondida por los ancianos entre las raíces del Árbol de los Susurros.' },
  amanecer: { intro: 'En las Colinas Rojas el primer rayo de sol aún lucha por salir. Cada piedra guarda la huella de la huida del Rey Goblin.', pedazo: 'El Borde del Cántaro, que cayó cuando el Rey Goblin Caballero tropezó en la Roca del Alba.' },
  selva: { intro: 'La Selva Esmeralda respira, y sus raíces beben la chicha derramada. Aquí el Maíz Morado Sagrado crece silvestre y peligroso.', pedazo: 'La Semilla Madre del Maíz Morado, de la que nació la primera chicha.' },
  tormenta: { intro: 'En los Picos Tormenta los rayos caen sin parar desde que el cielo se partió. El Señor de la Guerra forja aquí sus ejércitos.', pedazo: 'La Tapa del Cántaro, atrapada en el Pararrayos Antiguo y cargada de relámpagos.' },
  desierto: { intro: 'Antes, el Desierto Dorado era un valle de maizales. La chicha se secó y quedó solo la arena.', pedazo: 'La Base del Cántaro, enterrada junto al Oasis Perdido, la última gota que no se evaporó.' },
  castillo: { intro: 'Este es el Castillo del Rey Goblin, donde empezó la Larga Noche. Sus muros huelen a chicha robada.', pedazo: 'El secreto del Rey: no quería beber la chicha, sino apagar la luz de los duendes para siempre.' },
  cumbres: { intro: 'En las Cumbres del Ocaso el sol se queda dormido en el horizonte. Aquí cayeron los Guardianes del Éter cuando el cielo se rompió.', pedazo: 'La Panza del Cántaro, congelada en el Pico Helado y custodiada por el Coloso de Hueso.' },
  cavernas: { intro: 'Bajo la tierra, las Cavernas Abisales brillan con cristales morados. Dicen que el Cántaro se moldeó con este barro.', pedazo: 'El barro sagrado del Cristal Madre, lo único capaz de volver a unir los pedazos.' },
  abismo: { intro: 'El mar se tragó la mitad del cielo roto. Bajo las olas, el Leviatán canta con voz de tormenta.', pedazo: 'El Pico del Cántaro, que el Leviatán se tragó y que solo la luz del Faro de la Costa puede revelar.' },
  acantilados: { intro: 'En los Acantilados Mágicos el mundo termina y empiezan las islas del Éter. Más allá, Luz y Sombra pelean por el Núcleo.', pedazo: 'El camino al Núcleo, donde espera el último pedazo del Cántaro bajo el ala del Dragón Ancestral.' },
};

// Lo que dice cada PNJ del pueblo al abrir su ventana (una frase al azar).
export const LORE_NPC = {
  guia: ['¡Alto ahí, aventurero! Soy Tito, de la Guardia del Pueblo Duende.', 'Desde que se rompió el Cántaro, los goblins bajan cada noche. Necesitamos manos valientes.', 'Ajústate el poncho y no te alejes de las linternas hasta que seas más fuerte.', 'Si encuentras un pedazo del Cántaro, tráelo al Sabio. ¡Cada uno cuenta!'],
  mercader: ['¡Pasa, pasa! Grumo tiene de todo: pociones, ponchos y algún que otro chisme.', 'Ese pedazo de Cántaro no te lo compro, ¡no tengo tanto oro en todo el bosque!', 'Una buena chicha cura el cansancio. Una mala… mejor no preguntes.'],
  sabio: ['Hace mucho, el Cántaro Eterno guardaba la chicha que encendía el sol de nuestro bosque.', 'El Rey Goblin lo robó y lo rompió. Esa misma noche el cielo se partió en islas y nunca volvió a amanecer.', 'Sus pedazos cayeron por todo el mundo. El último está en el Núcleo, donde Luz y Sombra no dejan de luchar.', 'Quien llegue a nivel 60 llenará el Cántaro de nuevo… y se llevará 2 litros de chicha morada de verdad.'],
  artesana: ['Soy Lila. Tráeme materiales y te tejo un poncho que hasta los goblins envidiarán.', 'Cada hilo morado está teñido con maíz sagrado. Por eso brillan de noche.', 'Con barro del Cristal Madre podría pegar el Cántaro… si alguien llega tan lejos.'],
};

// Al completar el encargo de explorar el hito de cada zona.
export const LORE_HITOS = {
  noche: 'El Árbol de los Susurros te reconoce y murmura tu nombre.',
  amanecer: 'Desde la Roca del Alba ves, por un instante, un rayo de sol perdido.',
  selva: 'Tras la Cascada Escondida brilla una mazorca morada gigante.',
  tormenta: 'El Pararrayos Antiguo chisporrotea al sentir tu llegada.',
  desierto: 'El Oasis Perdido aún sabe un poquito a chicha morada.',
  castillo: 'Desde la Atalaya en Ruinas se ve el trono vacío del Rey Goblin.',
  cumbres: 'En el Pico Helado el viento trae ecos de los Guardianes del Éter.',
  cavernas: 'El Cristal Madre late como un corazón morado.',
  abismo: 'El Faro de la Costa se enciende y aparta las olas oscuras.',
  acantilados: 'Desde el Mirador Arcano ves el Núcleo flotando entre la Luz y la Sombra.',
};

export const LORE_NIVEL60 = '¡Los pedazos se unen y el Cántaro Eterno vuelve a llenarse de chicha morada! El sol sale sobre el bosque y te has ganado, de verdad, 2 litros de chicha morada.';

// Aventureros del pueblo: PNJ (no son jugadores y no cuentan como conectados).
export const AVENTUREROS = [
  { n: 'Quilla la Arquera', cl: 'picaro' }, { n: 'Inti el Valiente', cl: 'guerrero' }, { n: 'Killa la Curandera', cl: 'sacerdote' },
  { n: 'Pacha el Forzudo', cl: 'guerrero' }, { n: 'Wayra la Veloz', cl: 'picaro' }, { n: 'Tupa el Pícaro', cl: 'picaro' },
  { n: 'Sumaq la Hechicera', cl: 'mago' }, { n: 'Kusi el Risueño', cl: 'sacerdote' }, { n: 'Ccori la Buscatesoros', cl: 'picaro' },
  { n: 'Rumi el Escudero', cl: 'guerrero' },
];
export const FRASES_AVENTUREROS = ['¡Que el maíz te guíe!', '¿Viste algún pedazo del Cántaro?', '¡Cuidado, goblins al norte!', 'Ese poncho te queda de lujo.', 'Voy al pueblo por más chicha.', '¡Hoy sí amanece, lo presiento!', 'Dicen que el Leviatán ronca.', '¿Alguien llegó ya al nivel 60? ¡Dicen que regalan 2 litros de chicha!', 'Grumo me cobró de más otra vez.', '¡Por la Luz y por la chicha!', 'Tengo los pies llenos de barro abisal.', '¡Nos vemos en el Núcleo!'];
