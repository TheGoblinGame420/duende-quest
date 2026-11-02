// ═══════════════════════════════════════════════════════
// LORE DE ORIGINS — La leyenda del Cántaro Eterno (v296, mitos v339)
// Inti y Mama Quilla moldearon el Cántaro con barro que les dio la Pachamama; su
// chicha encendía el sol del bosque. El Rey Goblin lo robó y lo rompió: la Larga Noche.
// Textos revisados a mano (investigación de foros de MMO: una frase fuerte
// por zona, PNJ con voz propia, pistas sueltas que dan metas).
// ═══════════════════════════════════════════════════════

// Al entrar en cada zona (una vez por sesión) y su pedazo del Cántaro.
export const LORE_ZONAS = {
  noche: { intro: 'Desde que se rompió el Cántaro Eterno, aquí nunca amanece. Los goblins rondan entre los árboles y solo brillan las linternas del Pueblo Duende. Mama Quilla, la luna, es la única que aún vela por el bosque.', pedazo: 'El Asa del Cántaro, escondida por los ancianos entre las raíces del Árbol de los Susurros.' },
  amanecer: { intro: 'En las Colinas Rojas el primer rayo de sol aún lucha por salir. Cada piedra guarda la huella de la huida del Rey Goblin.', pedazo: 'El Borde del Cántaro, que cayó cuando el Rey Goblin Caballero tropezó en la Roca del Alba.' },
  selva: { intro: 'La Selva Esmeralda respira, y sus raíces beben la chicha derramada. Aquí el Maíz Morado Sagrado crece silvestre. Si oyes un silbido triste, es el Tunche: no le contestes.', pedazo: 'La Semilla Madre del Maíz Morado, de la que nació la primera chicha.' },
  tormenta: { intro: 'En los Picos Tormenta los rayos caen sin parar desde que el cielo se partió. El Señor de la Guerra forja aquí sus ejércitos.', pedazo: 'La Tapa del Cántaro, atrapada en el Pararrayos Antiguo y cargada de relámpagos.' },
  desierto: { intro: 'Antes, el Desierto Dorado era un valle de maizales. La chicha se secó y quedó solo la arena.', pedazo: 'La Base del Cántaro, enterrada junto al Oasis Perdido, la última gota que no se evaporó.' },
  castillo: { intro: 'Este es el Castillo del Rey Goblin, donde empezó la Larga Noche. Sus muros huelen a chicha robada.', pedazo: 'El secreto del Rey: no quería beber la chicha, sino apagar la luz de los duendes para siempre.' },
  cumbres: { intro: 'En las Cumbres del Ocaso el sol se queda dormido en el horizonte. Aquí cayeron los Guardianes del Éter. Entre las nubes se enrosca el Amaru, la serpiente alada de las tormentas.', pedazo: 'La Panza del Cántaro, congelada en el Pico Helado y custodiada por el Coloso de Hueso.' },
  cavernas: { intro: 'Bajo la tierra, las Cavernas Abisales brillan con cristales morados. Con este barro, regalo de la Pachamama, se moldeó el Cántaro. Cuida tu oro: el Muki, duende minero, ronda los túneles.', pedazo: 'El barro sagrado del Cristal Madre, lo único capaz de volver a unir los pedazos.' },
  abismo: { intro: 'El mar se tragó la mitad del cielo roto. Bajo las olas, el Leviatán canta con voz de tormenta.', pedazo: 'El Pico del Cántaro, que el Leviatán se tragó y que solo la luz del Faro de la Costa puede revelar.' },
  acantilados: { intro: 'En los Acantilados Mágicos el mundo termina y empiezan las islas del Éter. Más allá, Luz y Sombra pelean por el Núcleo.', pedazo: 'El camino al Núcleo, donde espera el último pedazo del Cántaro bajo el ala del Dragón Ancestral.' },
};

// Lo que dice cada PNJ del pueblo al abrir su ventana (una frase al azar).
export const LORE_NPC = {
  guia: ['¡Alto ahí, aventurero! Soy Tito, de la Guardia del Pueblo Duende.', 'Desde que se rompió el Cántaro, los goblins bajan cada noche. Necesitamos manos valientes.', 'Ajústate el poncho y no te alejes de las linternas hasta que seas más fuerte.', 'Si encuentras un pedazo del Cántaro, tráelo al Sabio. ¡Cada uno cuenta!', '¿Perdido? Sigue la luz amarilla, causa. Te lleva derechito a tu misión.', 'Yo hago guardia toda la noche… bueno, toda la Larga Noche. O sea, siempre. Ni un feriado, oe.', 'Si ves «!!» junto al nivel de un monstruo, te gana fácil. Sube un poquito antes o ven con un pata.', 'Mi abuelo decía que el Pishtaco ronda los caminos en noches sin luna. Yo no le creo… pero llevo linterna.'],
  mercader: ['¡Pasa, pasa! Grumo tiene de todo: pociones, ponchos y algún que otro chisme.', 'Ese pedazo de Cántaro no te lo compro, ¡no tengo tanto oro en todo el bosque!', 'Una buena chicha cura el cansancio. Una mala… mejor no preguntes.', '¿Ves a mi Ekeko? Cargadito de cositas. Dicen que trae suerte… a mí me trae clientes.', 'Precio de amigo, pues. Bueno, de amigo que paga bien.', 'Llévate pociones antes de salir, no seas pichiruchi. Muerto no compras nada.', 'Un cliente me pagó con un sapo de la charca. Todavía croa en la caja.', '¿Sin oro? Caza un rato y vuelve, pues. Grumo acepta oro, no excusas.'],
  sabio: ['Hace mucho, el Cántaro Eterno guardaba la chicha que encendía el sol de nuestro bosque.', 'Inti y Mama Quilla lo moldearon con barro que les regaló la Pachamama. Por eso nunca se vaciaba.', 'El Rey Goblin lo robó y lo rompió. Esa misma noche el cielo se partió en islas y nunca volvió a amanecer.', 'Sus pedazos cayeron por todo el mundo. El último está en el Núcleo, donde Luz y Sombra no dejan de luchar.', 'Quien reúna las 10 reliquias y llegue a nivel 60 llenará el Cántaro de nuevo… y se llevará 2 litros de chicha morada de verdad.', 'Cada reliquia la guarda el jefe de su zona. Mira tus encargos 🧭: ahí sabrás a quién buscar.', 'Cuando un jefe junta poder con su barra de hechizo, córtalo a tiempo. El sabio no es el que pega más fuerte, sino el que pega a tiempo.', 'Antes de cada cosecha dejábamos un poquito de chicha en la tierra para la Pachamama. Ella no olvida a los agradecidos.'],
  artesana: ['Soy Lila. Tráeme materiales y te tejo un poncho que hasta los goblins envidiarán.', 'Cada hilo morado está teñido con maíz sagrado. Por eso brillan de noche.', 'Con barro del Cristal Madre podría pegar el Cántaro… si alguien llega tan lejos.', 'Mi abuela tejía mirando a Mama Quilla. Decía que la luna le prestaba el hilo de plata.', '¿Ese poncho tienes? Ay, no, qué roche. Ven que te hago uno bonito.', 'Por el camino hay hierbas 🌿 y minerales ⛏. Recógelos y tráemelos, que todo se aprovecha.', 'Un buen tejido protege más que una armadura fea. Bueno… casi igual. Pero se ve mejor.', 'Tejo tan rápido que una vez le hice chompa a una alpaca sin que se diera cuenta.'],
  // La Abuela del puesto de t'anta wawas (decorado del evento; mundo.js abrirAbuela dice una al tocar el puesto).
  abuela: ['Pasa, hijito, pasa. Hay t\'anta wawa calientita para los que tienen hambre y para los que extrañan.', 'Cada pan lleva su carita. Así recordamos a los que ya no están con nosotros.', 'El 2 de noviembre ponemos la mesa con lo que les gustaba. Ellos vienen a visitar, ya verás.', '¡Esos goblins sinvergüenzas me robaron la hornada entera! Tráemelas, que se enfrían.', 'Mi t\'anta wawa sabe a anís y a canela. La receta me la dio mi mamá, y a ella la suya.', 'Con un pan de estos en la mochila, el camino se hace más corto. Eso dicen.', 'Después viene la Cosecha del Maíz Morado. Sin mazorcas no hay chicha, ni mazamorra, ni nada.'],
};

// Frases del PNJ segun lo que te pasa (fraseNpc en mundo.js las prefiere al azar normal).
export const LORE_NPC_CTX = {
  guia: {
    lista: ['¡Ya está, causa! Entrégamela y cobra.', 'Esa misión ya la tienes lista. Dale a «Entregar» y llévate tu premio.', '¡Bien hecho! El pueblo te debe una. Cobra tranquilo.'],
    noche: ['De noche los goblins salen más bravos. Ten tus pociones a la mano.', 'Ya oscureció, oe. Camina cerca de las linternas si vas solo.'],
  },
  mercader: {
    sinPociones: ['¿Sin pociones? ¡Así no sales de aquí! Llévate unas cuantas.', 'Oye, tu bolsa está sin una sola poción. Grumo te arregla eso al toque.'],
  },
  artesana: {
    conMateriales: ['¡Uy, qué buenos materiales traes! Déjame ver qué te fabrico.', 'Con eso que cargas ya podemos hacer algo bonito. Elige abajo.'],
  },
};

// Al completar el encargo de explorar el hito de cada zona.
export const LORE_HITOS = {
  noche: 'El Árbol de los Susurros te reconoce y murmura tu nombre.',
  amanecer: 'Desde la Roca del Alba ves, por un instante, un rayo de sol perdido.',
  selva: 'Tras la Cascada Escondida brilla una mazorca morada gigante. Junto al agua, unas huellas desparejas: el Chullachaqui pasó por aquí.',
  tormenta: 'El Pararrayos Antiguo chisporrotea al sentir tu llegada.',
  desierto: 'El Oasis Perdido aún sabe un poquito a chicha morada.',
  castillo: 'Desde la Atalaya en Ruinas se ve el trono vacío del Rey Goblin.',
  cumbres: 'En el Pico Helado el viento trae ecos de los Guardianes del Éter.',
  cavernas: 'El Cristal Madre late como un corazón morado.',
  abismo: 'El Faro de la Costa se enciende y aparta las olas oscuras.',
  acantilados: 'Desde el Mirador Arcano ves el Núcleo flotando entre la Luz y la Sombra.',
};

// Lo que cuenta el pueblo de cada evento de temporada (por su `campo` en data
// TEMPORADAS: los eventos anuales repiten la misma historia). Sale una vez por evento.
export const LORE_TEMPORADA = {
  calabazas: 'Cuando cae la noche, los goblins se esconden en calabazas huecas para asustar al pueblo. Rómpelas y quédate con su luz.',
  tantas: 'Por Todos los Santos, la Abuela Duende hornea t\'anta wawas para recordar a los que ya no están. Los goblins se las robaron todas: recupéralas y el pueblo te lo agradecerá.',
  mazorcas: 'Llegó la Cosecha del Maíz Morado: sin mazorcas no hay chicha. Los monstruos se las llevan al monte; tráelas de vuelta.',
  regalos: 'Los goblins asaltaron el taller de regalos del pueblo. Cada monstruo que cae suelta un paquete perdido.',
};

// La leyenda larga de cada evento: una frase al azar al tocar el contador del evento.
export const LORE_TEMPORADA_LEYENDA = {
  calabazas: [
    'En la Noche de Duendes los abuelos cuentan del Pishtaco: un hombre alto, de sombrero y abrigo largo, que ronda los caminos oscuros.',
    'Dicen que el Pishtaco solo se acerca a quien camina sin luz. Por eso el pueblo enciende calabazas.',
    'Los goblins se disfrazan de Pishtaco para asustar. Pero un goblin con sombrero sigue siendo un goblin.',
    'Una calabaza encendida en la puerta espanta al Pishtaco. Una apagada… lo invita a pasar.',
  ],
  tantas: [
    'Del 3 al 12 de noviembre el pueblo recuerda a sus difuntos con t\'anta wawa, el pan con carita.',
    'La Abuela dice que en Todos los Santos las almas vuelven a visitar. Se les deja pan, chicha y flores.',
    'Cada t\'anta wawa lleva una carita de yeso pintada. Es para que el que se fue no olvide su cara.',
    'Mama Quilla alumbra el camino de las almas esa semana. Por eso la luna sale más grande.',
    'Los goblins no tienen a quién recordar. Por eso roban los panes: les da envidia la mesa llena.',
  ],
  mazorcas: [
    'Del 13 al 30 de noviembre se cosecha el Maíz Morado. De la Semilla Madre nació la primera chicha.',
    'Antes de cosechar se hace el pago a la Pachamama: un poquito de chicha y hojas de coca en la tierra.',
    'Inti madura el maíz de día y Mama Quilla le da color de noche. Por eso sale morado.',
    'El Ekeko del pueblo luce una mazorca nueva en su espalda. Pide que la cosecha alcance para todos.',
    'Con mazorcas se hace chicha y mazamorra morada. Con chicha, algún día, se vuelve a llenar el Cántaro.',
  ],
  regalos: [
    'Los goblins asaltaron el taller del pueblo porque nadie les regaló nada nunca. Igual devuélvelos.',
  ],
};

// Una línea del bestiario por monstruo (sale la primera vez que lo marcas).
export const LORE_MONSTRUOS = {
  goblin_normal: 'Goblin raso del Rey. Tiene más hambre que valor: roba linternas para vender el aceite.',
  esqueleto: 'Despertó cuando el Cántaro se rompió. Busca su tumba y no se acuerda dónde la dejó.',
  goblin_assassin: 'Ataca por la espalda y huye. Si lo pierdes de vista, gira la cámara.',
  fantasma: 'Un alma que se quedó sin camino en la Larga Noche. Mama Quilla la busca cada noche.',
  hechicero: 'Aprendiz de brujo goblin. Lanza desde lejos: acércate rápido y no le des tiempo.',
  goblin_peasant: 'Campesino al que el Rey obligó a quemar maizales. Pelea con la hoz y con pena.',
  goblin_guard: 'Guardia roja del Rey. Escudo grande, cabeza dura y cero sentido del humor.',
  pajaro: 'Lleva los mensajes del castillo. Si uno llega, el Rey sabe dónde estás.',
  goblin_knight: 'Juró lealtad al Rey a cambio de una armadura que le queda chica.',
  hongo: 'Bebió chicha derramada y no paró de crecer. Lento, pero pega como costal de papas.',
  rana: 'Croa cuando alguien busca la Semilla Madre. Su canto avisa al Tunche, dicen.',
  goblin_centurion: 'Capitán del ejército del Señor de la Guerra. Grita órdenes que nadie entiende.',
  goblin_battlelord: 'Toca los tambores de guerra en la selva. Sin tambor, el ejército se dispersa.',
  goblin_mage: 'Roba los rayos del cielo partido. Corta su magia antes de que termine el conjuro.',
  esqueleto_arcano: 'Guardián muerto del Pararrayos Antiguo. Brilla morado por el rayo que lo atravesó.',
  ghoul_ardiente: 'Arde por dentro desde que tocó la Tapa del Cántaro. Rápido y rabioso.',
  goblin_samurai: 'Vino de muy lejos a vigilar el oasis. Nadie sabe quién le enseñó la espada.',
  lagarto: 'Se tuesta en las ruinas al sol. Si te ve, corre más que tú.',
  serpiente: 'Dicen que es hija del Amaru que bajó a buscar agua al desierto. Muerde con veneno.',
  conejo: 'Sin chicha hasta los conejos se volvieron salvajes. No te dejes engañar por las orejas.',
  guardia_real: 'Guardia de oro del trono. Nunca durmió desde que empezó la Larga Noche.',
  caballero_negro: 'Juró al Rey sobre su espada negra. Rompe su juramento a golpes.',
  esqueleto_real: 'Viejos nobles de la corte que no aceptan que su rey ya perdió.',
  hechicero_corte: 'Mago de la corte. Fue él quien le enseñó al Rey a romper el Cántaro.',
  murcielago: 'Tapa el último sol con sus alas. Le encanta morder a los que vuelan.',
  arana: 'Teje telas de ceniza sobre las tumbas de los Guardianes del Éter.',
  esqueleto_capa: 'Un Guardián del Éter que perdió el rumbo. Camina las cumbres buscando su ala.',
  hellgato: 'Siete vidas y cero paciencia. Mejor ven con tiempo… y con pociones.',
  cangrejo: 'Guarda el barro sagrado entre las pinzas. Su caparazón de cristal es duro.',
  saltador: 'Sirviente del Muki. Salta de la nada y se lleva lo que brilla.',
  pulpo: 'Brujo de las cavernas. Ensucia el agua del Cristal Madre con tinta maldita.',
  cosa: 'Vive en el lodo y no quiere que el Cántaro se una. Ni el Muki se le acerca.',
  pez: 'Piraña del mar que se tragó el cielo. Donde hay una, hay cien.',
  pez_dardo: 'Cruza el agua como flecha. Si parpadeas, ya te picó.',
  baba: 'Cubre el Faro de la Costa con baba para que su luz no se vea.',
  espectro: 'Marinero que naufragó en la Larga Noche. Canta en el coro del Leviatán.',
  pez_grande: 'Cría del Leviatán. Abre la boca y parece una cueva con dientes.',
  zarigueya: 'Cuida su acantilado como si fuera su casa. Porque lo es.',
  aguila: 'Hija del viento de las islas del Éter. Dicen que vuela con el Amaru.',
  fantasma_halo: 'Un alma que casi llegó al Núcleo. Ahora no deja que nadie más llegue.',
  paladin_goblin: 'La última muralla del camino al Núcleo. Cree que defiende la luz.',
  jefe_sabueso: 'Su aullido cruza la Larga Noche. Guarda el paso a las Colinas Rojas.',
  jefe_caballero: 'Tropezó en la Roca del Alba y perdió el Borde del Cántaro. Todavía le duele el orgullo.',
  jefe_senor: 'Junta ejércitos con sus tambores. Si lo vences, la selva respira tranquila.',
  jefe_ghoul: 'Abrazó la Tapa del Cántaro entre relámpagos y nunca dejó de arder.',
  jefe_angel: 'Fue guardián del cielo. Cayó cuando se partió y ahora vigila la Base del Cántaro.',
  jefe_rey: 'El que robó el Cántaro y apagó el sol. No quería la chicha: quería apagar a los duendes.',
  jefe_coloso: 'Hecho con los huesos de mil batallas. Guarda la Panza del Cántaro en el Pico Helado.',
  jefe_cangrejo: 'Duerme sobre el barro que puede pegar los pedazos. Despiértalo… para siempre.',
  jefe_leviatan: 'Se tragó el Pico del Cántaro y canta con voz de tormenta bajo las olas.',
  jefe_dragon: 'Nieto del Amaru, guarda el último pedazo del Cántaro bajo su ala.',
};

export const LORE_NIVEL60 = '¡Los pedazos se unen y el Cántaro Eterno vuelve a llenarse de chicha morada! El sol sale sobre el bosque y te has ganado, de verdad, 2 litros de chicha morada.';

// Aventureros del pueblo: PNJ (no son jugadores y no cuentan como conectados).
export const AVENTUREROS = [
  { n: 'Quilla la Arquera', cl: 'picaro' }, { n: 'Inti el Valiente', cl: 'guerrero' }, { n: 'Killa la Curandera', cl: 'sacerdote' },
  { n: 'Pacha el Forzudo', cl: 'guerrero' }, { n: 'Wayra la Veloz', cl: 'picaro' }, { n: 'Tupa el Pícaro', cl: 'picaro' },
  { n: 'Sumaq la Hechicera', cl: 'mago' }, { n: 'Kusi el Risueño', cl: 'sacerdote' }, { n: 'Ccori la Buscatesoros', cl: 'picaro' },
  { n: 'Rumi el Escudero', cl: 'guerrero' },
];
export const FRASES_AVENTUREROS = ['¡Que el maíz te guíe!', '¿Viste algún pedazo del Cántaro?', '¡Cuidado, goblins al norte!', 'Ese poncho te queda de lujo.', 'Voy al pueblo por más chicha.', '¡Hoy sí amanece, lo presiento!', 'Dicen que el Leviatán ronca.', '¿Alguien llegó ya al nivel 60? ¡Dicen que regalan 2 litros de chicha!', 'Grumo me cobró de más otra vez.', '¡Por la Luz y por la chicha!', 'Tengo los pies llenos de barro abisal.', '¡Nos vemos en el Núcleo!', 'Anoche oí silbar al Tunche. No contesté, ¿ah?', 'Le dejé chicha al Ekeko a ver si me trae suerte.', 'En la selva un pata me pidió ayuda… cojeaba. Mejor ni volteé.', 'Mama Quilla está grandota hoy, buena noche para cazar.'];

// La cadena del Guardia Tito contada como historia: una frase por mision (mismo orden que MISIONES).
export const LORE_MISIONES = [
  'Los goblins rondan las linternas del pueblo. Échalos antes de que apaguen la última.',
  'Algo despertó a los muertos del bosque cuando el Cántaro se rompió. Devuélvelos a la tierra.',
  'Los asesinos goblin se esconden entre las raíces del Árbol de los Susurros. Que no te vean venir.',
  'Un aullido cruza la Larga Noche: el Sabueso Infernal guarda el paso a las colinas. Derríbalo.',
  'En las Colinas Rojas los campesinos goblin queman maizales. Sin maíz no hay chicha: detenlos.',
  'La guardia roja del Rey custodia el camino de su huida. Rompe sus filas.',
  'Los pájaros hueso llevan mensajes al castillo. Que ninguno llegue.',
  'El Rey Goblin Caballero tropezó en la Roca del Alba y perdió el Borde del Cántaro. Quítale la corona.',
  'Los hongos de la Selva Esmeralda beben chicha derramada y crecen sin control. Pódalos.',
  'Las ranas de la charca croan cuando alguien busca la Semilla Madre. Que callen.',
  'Retumban tambores en la selva: el Señor de la Guerra junta un ejército. Rompe sus tambores.',
  'El Señor de la Guerra marcha hacia el pueblo. Es el momento: enfréntalo.',
  'En los Picos Tormenta los magos goblin roban los rayos del cielo partido. Corta su magia.',
  'Esqueletos arcanos custodian el Pararrayos Antiguo. Abre paso hasta la Tapa del Cántaro.',
  'Los ghouls ardientes queman todo lo que pisan. Apágalos antes de que lleguen al bosque.',
  'El Ghoul Infernal guarda la Tapa del Cántaro entre relámpagos. Recupérala.',
  'En el Desierto Dorado, donde hubo maizales, los samuráis goblin vigilan el Oasis Perdido.',
  'Los lagartos tomaron las ruinas al sol. Despeja el camino al oasis.',
  'Hasta los conejos se volvieron salvajes sin chicha. Ve con cuidado… y con fuerza.',
  'El Ángel Caído vigila la Base del Cántaro enterrada junto al oasis. Que caiga del todo.',
  'Las puertas del castillo del Rey Goblin se abren. Su guardia real no dejará pasar a nadie.',
  'Los caballeros negros juraron al Rey. Rompe su juramento a golpes.',
  'Hasta los huesos de la corona se levantan para defender el trono. Devuélvelos al polvo.',
  'El Rey Goblin en persona: el que robó el Cántaro y apagó el sol. Termina la Larga Noche.',
  'En las Cumbres del Ocaso los murciélagos tapan el último sol. Ábrele el cielo.',
  'Arañas de ceniza tejen sobre las tumbas de los Guardianes del Éter. Quema sus telas.',
  'Los gatos infernales tienen siete vidas. Tú tienes paciencia: quítaselas todas.',
  'El Coloso de Hueso custodia la Panza del Cántaro congelada en el Pico Helado. Rómpelo.',
  'En las Cavernas Abisales los cangrejos de cristal guardan el barro sagrado. Ábrete paso.',
  'Un pulpo brujo enturbia las aguas del Cristal Madre con tinta maldita. Límpialas.',
  'Algo vive en el lodo de las cavernas y no quiere que el Cántaro se una. Sácalo a la luz.',
  'El Rey Cangrejo duerme sobre el barro que puede pegar los pedazos. Despiértalo… para siempre.',
  'En el mar que se tragó el cielo, pirañas abisales rodean el Faro de la Costa.',
  'Las babosas abisales cubren el faro de baba. Sin su luz no se verá el Pico del Cántaro.',
  'Los espectros del naufragio cantan con el Leviatán. Calla su coro.',
  'El Leviatán se tragó el Pico del Cántaro. Con el faro encendido, es hora de recuperarlo.',
  'En los Acantilados Mágicos el mundo se acaba. Las zarigüeyas salvajes no te dejarán asomarte.',
  'Las águilas de tormenta vigilan las islas del Éter. Gánate el cielo.',
  'La orden del paladín goblin protege el camino al Núcleo. Es la última muralla.',
  'El Dragón Ancestral guarda el último pedazo del Cántaro. Vence y la chicha volverá a correr.',
];

// La cadena de Tito en capitulos (40 misiones, un capitulo cada 4: uno por zona, mismo orden).
// `desde` = indice de LORE_MISIONES donde empieza; `z` = su zona de LORE_ZONAS.
export const CAPITULOS = [
  { n: 1, titulo: 'La Larga Noche', desde: 0, z: 'noche' },
  { n: 2, titulo: 'El Rayo Perdido del Alba', desde: 4, z: 'amanecer' },
  { n: 3, titulo: 'La Selva que Respira', desde: 8, z: 'selva' },
  { n: 4, titulo: 'El Cielo Partido', desde: 12, z: 'tormenta' },
  { n: 5, titulo: 'La Última Gota del Oasis', desde: 16, z: 'desierto' },
  { n: 6, titulo: 'El Trono de la Chicha Robada', desde: 20, z: 'castillo' },
  { n: 7, titulo: 'Donde Duerme el Sol', desde: 24, z: 'cumbres' },
  { n: 8, titulo: 'El Barro de la Pachamama', desde: 28, z: 'cavernas' },
  { n: 9, titulo: 'El Mar que se Tragó el Cielo', desde: 32, z: 'abismo' },
  { n: 10, titulo: 'Entre la Luz y la Sombra', desde: 36, z: 'acantilados' },
];
// El capitulo de la mision i (el ultimo con desde <= i).
export function capituloDe(i) {
  let c = CAPITULOS[0];
  for (const x of CAPITULOS) if (x.desde <= (+i || 0)) c = x;
  return c;
}
