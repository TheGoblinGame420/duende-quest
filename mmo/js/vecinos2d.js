// ═══════════════════════════════════════════════════════
// VECINOS DEL MUNDO 2D (CLASSIC) — Fase 2 del mundo vivo (17-nov-2026)
//
// Gente del Éter que vive en las zonas abiertas: dos por zona. Cada uno tiene
// una cadena corta de encargos (como los de un RPG clásico): le hablas, te
// pide algo, cazas y VUELVES a hablarle para cobrar. Después sigue el
// siguiente encargo de su cadena (si tienes nivel).
//
// Datos compartidos por el cliente (dibujo y diálogo) y el servidor
// (functions/mmo/vecinos2d.js, que valida cercanía, progreso y premio).
//
// Encargo: { id, nv, tipo: 'caza' | 'jefe', k?, n, pide, inicio, fin }
//   caza sin k = cualquier monstruo de la zona; caza con k = ese monstruo.
//   jefe = el jefe de la zona (MAPAS[zona].jefe).
// Los ids no se cambian nunca: son el progreso guardado de cada personaje.
// El premio lo calcula el servidor (premioVecino), no está aquí.
// ═══════════════════════════════════════════════════════

export const VECINO_DIST = 110;   // px para hablar (el servidor da un margen extra por la latencia)

export const VECINOS2D = {
  noche: [
    { id: 'v_asiri', nombre: 'Mamá Asiri', hoja: 'goblin_peasant', x: 560, oficio: 'Chichera del bosque',
      saludo: 'Pasa, wawa, que la noche es larga y el fogón está prendido.',
      l: [
        { id: 'noc1', nv: 1, tipo: 'caza', k: 'goblin_normal', n: 5, pide: 'Espanta 5 Goblins del camino',
          inicio: 'Los goblins me patean la olla cada noche. Espántame cinco y te invito un poto de chicha.', fin: '¡Ya ni se asoman! Toma, para el camino.' },
        { id: 'noc2', nv: 3, tipo: 'caza', k: 'esqueleto', n: 6, pide: 'Rompe 6 Esqueletos',
          inicio: 'Los esqueletos se llevan mis mazorcas para hacerse dientes nuevos. ¡Seis, wawa!', fin: 'Ahora sí tengo choclo para todo el mes.' },
        { id: 'noc3', nv: 5, tipo: 'jefe', n: 1, pide: 'Vence al Sabueso Infernal',
          inicio: 'Al fondo del bosque aúlla el Sabueso. Mientras viva, nadie duerme tranquilo.', fin: '¡Silencio por fin! El bosque entero te debe una.' },
      ] },
    { id: 'v_tomas', nombre: 'Tomás el Farolero', hoja: 'goblin_guard', x: 1720, oficio: 'Cuida las linternas',
      saludo: 'Sin luz, este bosque se traga a los novatos.',
      l: [
        { id: 'noc4', nv: 2, tipo: 'caza', k: 'fantasma', n: 5, pide: 'Disipa 5 Fantasmas',
          inicio: 'Los fantasmas soplan mis faroles. Disipa cinco y vuelvo a prenderlos.', fin: 'Mira cómo brilla el camino. Gracias, duende.' },
        { id: 'noc5', nv: 4, tipo: 'caza', k: 'hechicero', n: 4, pide: 'Calla a 4 Hechiceros',
          inicio: 'Los hechiceros usan mi aceite para sus conjuros. Cuatro menos y me alcanza.', fin: 'Huele a aceite de verdad otra vez.' },
        { id: 'noc6', nv: 5, tipo: 'caza', n: 15, pide: 'Caza 15 monstruos del bosque',
          inicio: 'Una última ronda, como los guardianes de antes: limpia el bosque entero.', fin: 'Hablas poco y cazas mucho. Así me gusta.' },
      ] },
  ],
  amanecer: [
    { id: 'v_rosa', nombre: 'Tía Rosa', hoja: 'goblin_peasant', x: 560, oficio: 'Siembra en las colinas',
      saludo: 'En las colinas todo crece rojo, hasta el ají.',
      l: [
        { id: 'ama1', nv: 6, tipo: 'caza', k: 'goblin_peasant', n: 6, pide: 'Echa a 6 Goblins Campesinos',
          inicio: 'Esos campesinos goblin me roban el ají antes de que madure. ¡Seis!', fin: 'Mi chacra respira. Llévate esto.' },
        { id: 'ama2', nv: 8, tipo: 'caza', k: 'pajaro', n: 6, pide: 'Ahuyenta 6 Pájaros Hueso',
          inicio: 'Los pájaros hueso picotean las semillas. Ningún espantapájaros les gana.', fin: 'Tú sí que espantas. Gracias.' },
        { id: 'ama3', nv: 11, tipo: 'jefe', n: 1, pide: 'Vence al Rey Goblin Caballero',
          inicio: 'El Rey Caballero cobra diezmo a toda la colina. Ya fue suficiente.', fin: '¡La colina es libre! Esta noche cocino para ti.' },
      ] },
    { id: 'v_justo', nombre: 'Don Justo', hoja: 'goblin_knight', x: 1720, oficio: 'Caballero retirado',
      saludo: 'Yo también tuve espada. Ahora tengo rodillas que crujen.',
      l: [
        { id: 'ama4', nv: 7, tipo: 'caza', k: 'goblin_guard', n: 6, pide: 'Vence a 6 Goblins Guardia',
          inicio: 'Los guardias goblin aprendieron mis viejas técnicas. Demuéstrales las tuyas.', fin: 'Buena guardia, buena estocada. Me recuerdas a mí.' },
        { id: 'ama5', nv: 9, tipo: 'caza', k: 'goblin_knight', n: 5, pide: 'Derrota a 5 Goblins Caballero',
          inicio: 'Esos caballeros llevan mi viejo escudo. Cinco duelos y lo recupero.', fin: 'Mi escudo... huele a goblin, pero es mío.' },
        { id: 'ama6', nv: 10, tipo: 'caza', n: 20, pide: 'Caza 20 monstruos de las colinas',
          inicio: 'Un caballero no descansa hasta que el camino es seguro. Veinte, joven.', fin: 'Ya puedo jubilarme tranquilo. Toma mi parte del botín.' },
      ] },
  ],
  selva: [
    { id: 'v_yaku', nombre: 'Yaku', hoja: 'goblin_mage', x: 560, oficio: 'Curandera de la selva',
      saludo: 'La selva cura y la selva muerde. Depende de cómo la trates.',
      l: [
        { id: 'sel1', nv: 12, tipo: 'caza', k: 'hongo', n: 6, pide: 'Recoge esporas de 6 Hongos Gigantes',
          inicio: 'Con esporas de hongo hago remedio para la tos. Seis bastan.', fin: 'Huele horrible. Funciona de maravilla.' },
        { id: 'sel2', nv: 14, tipo: 'caza', k: 'rana', n: 6, pide: 'Calma a 6 Ranas de Charca',
          inicio: 'Las ranas croan tan fuerte que mis pacientes no duermen.', fin: 'Silencio... solo se oye la lluvia. Perfecto.' },
        { id: 'sel3', nv: 17, tipo: 'jefe', n: 1, pide: 'Vence al Señor de la Guerra',
          inicio: 'El Señor de la Guerra quema la selva para hacer sus campamentos. Detenlo.', fin: 'Los árboles te lo agradecen. Y yo también.' },
      ] },
    { id: 'v_mateo', nombre: 'Mateo el Totorero', hoja: 'goblin_peasant', x: 1720, oficio: 'Teje balsas de totora',
      saludo: 'Con totora se hacen balsas, canastas y hasta casas. Como en mi Chancay.',
      l: [
        { id: 'sel4', nv: 13, tipo: 'caza', k: 'goblin_centurion', n: 6, pide: 'Vence a 6 Goblins Centurión',
          inicio: 'Los centuriones usan mi totora para sus escudos. ¡Qué falta de respeto!', fin: 'Totora recuperada. Te haré una canasta.' },
        { id: 'sel5', nv: 15, tipo: 'caza', k: 'goblin_battlelord', n: 4, pide: 'Derrota a 4 Goblins Señor',
          inicio: 'Los goblins señor cobran peaje en la orilla. Cuatro y se acaba el cobro.', fin: 'Ya puedo bajar al río sin pagar nada.' },
        { id: 'sel6', nv: 16, tipo: 'caza', n: 25, pide: 'Caza 25 monstruos de la selva',
          inicio: 'Voy a armar la balsa más grande del Éter. Necesito la selva tranquila.', fin: 'Cuando esté lista, te llevo de paseo. Palabra.' },
      ] },
  ],
  tormenta: [
    { id: 'v_inti', nombre: 'Inti el Pararrayos', hoja: 'hechicero', x: 560, oficio: 'Atrapa rayos en frascos',
      saludo: '¿Sentiste ese cosquilleo? Va a caer uno grande.',
      l: [
        { id: 'tor1', nv: 18, tipo: 'caza', k: 'goblin_mage', n: 6, pide: 'Vence a 6 Goblins Mago',
          inicio: 'Los magos me roban los rayos de los frascos. ¡Son míos, yo los atrapé!', fin: 'Mis frascos brillan otra vez. Gracias.' },
        { id: 'tor2', nv: 20, tipo: 'caza', k: 'esqueleto_arcano', n: 6, pide: 'Rompe 6 Esqueletos Arcanos',
          inicio: 'Los esqueletos arcanos atraen la tormenta hacia mi casa. Rómpelos.', fin: 'Ya no cae ni una gota en mi techo.' },
        { id: 'tor3', nv: 23, tipo: 'jefe', n: 1, pide: 'Vence al Ghoul Infernal',
          inicio: 'El Ghoul Infernal se come los rayos crudos. Así nunca pasa la tormenta.', fin: '¡Mira! Se abre el cielo. Primera vez en años.' },
      ] },
    { id: 'v_killa', nombre: 'Killa la Pastora', hoja: 'goblin_peasant', x: 1720, oficio: 'Pastorea llamas en los picos',
      saludo: 'Mis llamas se asustan con cada trueno. Y yo también, un poquito.',
      l: [
        { id: 'tor4', nv: 19, tipo: 'caza', k: 'ghoul_ardiente', n: 6, pide: 'Apaga 6 Ghouls Ardientes',
          inicio: 'Los ghouls ardientes queman el pasto. Mis llamas no tienen qué comer.', fin: 'Pasto verde otra vez. Mis llamas te saludan.' },
        { id: 'tor5', nv: 21, tipo: 'caza', n: 20, pide: 'Caza 20 monstruos de los picos',
          inicio: 'Se me escaparon tres llamas. Despeja el camino y las busco yo.', fin: '¡Las encontré! Estaban comiendo nieve, las tontas.' },
        { id: 'tor6', nv: 22, tipo: 'caza', k: 'goblin_mage', n: 10, pide: 'Vence a 10 Goblins Mago',
          inicio: 'Ahora los magos quieren hechizar a mis llamas. Diez, y que no vuelvan.', fin: 'Eres el mejor perro pastor que he tenido. Es un cumplido.' },
      ] },
  ],
  desierto: [
    { id: 'v_wari', nombre: 'Wari el Huaquero Arrepentido', hoja: 'goblin_lord', x: 560, oficio: 'Devuelve lo que robó',
      saludo: 'Antes saqueaba huacas. Ahora devuelvo todo a su sitio.',
      l: [
        { id: 'des1', nv: 24, tipo: 'caza', k: 'serpiente', n: 6, pide: 'Aparta 6 Serpientes de la huaca',
          inicio: 'Las serpientes no me dejan devolver una vasija. Sepárame seis.', fin: 'La vasija volvió a su casa. Me siento más liviano.' },
        { id: 'des2', nv: 27, tipo: 'caza', k: 'goblin_samurai', n: 6, pide: 'Vence a 6 Goblins Samurái',
          inicio: 'Los samuráis goblin vigilan la huaca grande. Algo esconden.', fin: 'Escondían... más vasijas robadas. Todo vuelve.' },
        { id: 'des3', nv: 31, tipo: 'jefe', n: 1, pide: 'Vence al Ángel Caído',
          inicio: 'El Ángel Caído duerme sobre el tesoro del desierto. Ese no es su lugar.', fin: 'El desierto está en paz. Y yo también.' },
      ] },
    { id: 'v_dunas', nombre: 'Doña Duna', hoja: 'goblin_mage', x: 1720, oficio: 'Lee el futuro en la arena',
      saludo: 'La arena me dijo que vendrías. Bueno, me dijo «alguien con orejas».',
      l: [
        { id: 'des4', nv: 25, tipo: 'caza', k: 'lagarto', n: 6, pide: 'Vence a 6 Lagartos',
          inicio: 'Los lagartos borran mis dibujos en la arena. ¡No puedo leer el futuro así!', fin: 'Ahora veo claro: te va a ir muy bien.' },
        { id: 'des5', nv: 28, tipo: 'caza', k: 'conejo', n: 8, pide: 'Atrapa a 8 Conejos Salvajes',
          inicio: 'Los conejos salvajes cavan hoyos en mis profecías. Ocho, rapidito.', fin: 'Los conejos me dijeron otra cosa, pero no les creo.' },
        { id: 'des6', nv: 30, tipo: 'caza', n: 25, pide: 'Caza 25 monstruos del desierto',
          inicio: 'Veo una gran pelea en tu futuro. Mejor empiézala ya.', fin: '¿Ves? Te lo dije. La arena nunca falla.' },
      ] },
  ],
  castillo: [
    { id: 'v_cocinero', nombre: 'Chef Grasiento', hoja: 'goblin_peasant', x: 600, oficio: 'Cocinero del Rey (renunció)',
      saludo: 'Cocinaba para el Rey Goblin. Nunca dijo gracias. Ni una vez.',
      l: [
        { id: 'cas1', nv: 32, tipo: 'caza', k: 'guardia_real', n: 6, pide: 'Vence a 6 Guardias Reales',
          inicio: 'Los guardias no me dejan sacar mis ollas de la cocina. ¡Mis ollas!', fin: 'Mis ollas... las extrañaba tanto.' },
        { id: 'cas2', nv: 35, tipo: 'caza', k: 'hechicero_corte', n: 6, pide: 'Calla a 6 Hechiceros de la Corte',
          inicio: 'Los hechiceros hechizaron mi receta secreta. Ahora sabe a calcetín.', fin: 'Volvió el sabor. Prueba... ¿ves?' },
        { id: 'cas3', nv: 39, tipo: 'jefe', n: 1, pide: 'Vence al Rey Goblin',
          inicio: 'Que el Rey pruebe un plato de humildad. Tú se lo sirves.', fin: '¡Por fin! Abro mi propia picantería. Tú comes gratis.' },
      ] },
    { id: 'v_escudera', nombre: 'Escudera Nina', hoja: 'goblin_guard', x: 1900, oficio: 'Desertó del ejército goblin',
      saludo: 'Me fui del ejército del Rey. Ahora ayudo a los que lo enfrentan.',
      l: [
        { id: 'cas4', nv: 33, tipo: 'caza', k: 'caballero_negro', n: 6, pide: 'Derrota a 6 Caballeros Negros',
          inicio: 'Los caballeros negros me persiguen por desertora. Ayúdame.', fin: 'Ya puedo dormir sin la armadura puesta.' },
        { id: 'cas5', nv: 36, tipo: 'caza', k: 'esqueleto_real', n: 6, pide: 'Rompe 6 Esqueletos Reales',
          inicio: 'Los esqueletos reales eran mis compañeros. Déjalos descansar.', fin: 'Descansen en paz, muchachos.' },
        { id: 'cas6', nv: 38, tipo: 'caza', n: 30, pide: 'Caza 30 monstruos del castillo',
          inicio: 'El castillo entero debe caer. Treinta, y abrimos las puertas.', fin: 'Las puertas están abiertas. El Rey está solo.' },
      ] },
  ],
  cumbres: [
    { id: 'v_apu', nombre: 'Apu Viejo', hoja: 'hechicero', x: 600, oficio: 'Espíritu de la montaña',
      saludo: 'Soy más viejo que estas piedras. Bueno, casi.',
      l: [
        { id: 'cum1', nv: 40, tipo: 'caza', k: 'murcielago', n: 8, pide: 'Espanta 8 Murciélagos Vampiro',
          inicio: 'Los murciélagos me chupan la luz del ocaso. Ocho, y vuelve el atardecer.', fin: 'Mira ese cielo naranja. Por esto vale la pena.' },
        { id: 'cum2', nv: 42, tipo: 'caza', k: 'esqueleto_capa', n: 6, pide: 'Guía a 6 Esqueletos Errantes',
          inicio: 'Los esqueletos errantes se perdieron hace siglos. Libéralos.', fin: 'Ya encontraron el camino. Gracias por ellos.' },
        { id: 'cum3', nv: 44, tipo: 'jefe', n: 1, pide: 'Vence al Coloso de Hueso',
          inicio: 'El Coloso pisa mi montaña y le duelen los huesos a ella.', fin: 'La montaña suspira. Te recordará siempre.' },
      ] },
    { id: 'v_suri', nombre: 'Suri la Escaladora', hoja: 'goblin_assassin', x: 1900, oficio: 'Sube cumbres por diversión',
      saludo: '¿Subes conmigo? Arriba se ve todo el Éter.',
      l: [
        { id: 'cum4', nv: 41, tipo: 'caza', k: 'arana', n: 6, pide: 'Limpia 6 Arañas de Ceniza',
          inicio: 'Las arañas tejen en mis cuerdas. ¡Casi me caigo ayer!', fin: 'Cuerdas limpias, rodillas a salvo.' },
        { id: 'cum5', nv: 43, tipo: 'caza', k: 'hellgato', n: 6, pide: 'Ahuyenta 6 Gatos Infernales',
          inicio: 'Los gatos infernales me roban la merienda en cada descanso.', fin: 'Mi pan con queso, intacto. Eres mi héroe.' },
        { id: 'cum6', nv: 44, tipo: 'caza', n: 30, pide: 'Caza 30 monstruos de las cumbres',
          inicio: 'Quiero llegar a la cima más alta. Ábreme paso.', fin: '¡Llegué! Desde arriba se ve el pueblo chiquitito.' },
      ] },
  ],
  cavernas: [
    { id: 'v_minero', nombre: 'Minero Cholo', hoja: 'goblin_battlelord', x: 600, oficio: 'Pica cristal en la oscuridad',
      saludo: 'Aquí abajo no hay día ni noche. Solo cristal y trabajo.',
      l: [
        { id: 'cav1', nv: 45, tipo: 'caza', k: 'cangrejo', n: 6, pide: 'Vence a 6 Cangrejos de Cristal',
          inicio: 'Los cangrejos de cristal se comen mis vetas. ¡Son de cristal y comen cristal!', fin: 'Veta salvada. Este brillo es para ti.' },
        { id: 'cav2', nv: 47, tipo: 'caza', k: 'pulpo', n: 6, pide: 'Vence a 6 Pulpos Brujos',
          inicio: 'Los pulpos brujos me apagan las lámparas con tinta.', fin: 'Luz otra vez. Ya veo mis propias manos.' },
        { id: 'cav3', nv: 49, tipo: 'jefe', n: 1, pide: 'Vence al Rey Cangrejo',
          inicio: 'El Rey Cangrejo se sentó en la veta más grande. Hay que moverlo.', fin: '¡Qué veta! Hay cristal para cien años.' },
      ] },
    { id: 'v_luz', nombre: 'Luciérnaga Mayor', hoja: 'goblin_mage', x: 1900, oficio: 'Guía en las cavernas',
      saludo: 'Sígueme la luz y no te pierdes. Casi nunca.',
      l: [
        { id: 'cav4', nv: 46, tipo: 'caza', k: 'saltador', n: 8, pide: 'Vence a 8 Saltarines Abisales',
          inicio: 'Los saltarines me asustan y se me apaga la luz. Ocho, por favor.', fin: 'Brillo como nunca. Gracias.' },
        { id: 'cav5', nv: 48, tipo: 'caza', k: 'cosa', n: 6, pide: 'Vence a 6 Cosas del Pantano',
          inicio: 'Algo vive en el pantano de abajo. Varias cosas, en realidad.', fin: 'Ya no sé qué eran, pero ya no están.' },
        { id: 'cav6', nv: 49, tipo: 'caza', n: 30, pide: 'Caza 30 monstruos de las cavernas',
          inicio: 'Hay un túnel hacia el mar que nadie ha cruzado. Ábrelo.', fin: 'Huele a sal. El mar está cerca.' },
      ] },
  ],
  abismo: [
    { id: 'v_pescador', nombre: 'Don Pancho', hoja: 'goblin_peasant', x: 600, oficio: 'Pescador del abismo',
      saludo: 'Pesqué en Chancay cuarenta años. Este mar es más bravo.',
      l: [
        { id: 'abi1', nv: 50, tipo: 'caza', k: 'pez', n: 8, pide: 'Saca 8 Pirañas Abisales',
          inicio: 'Las pirañas me rompen las redes. Ocho y remiendo tranquilo.', fin: 'Redes enteras. Hoy hay cebiche.' },
        { id: 'abi2', nv: 52, tipo: 'caza', k: 'espectro', n: 6, pide: 'Calma a 6 Espectros Marinos',
          inicio: 'Los espectros son de pescadores que no volvieron. Ayúdalos a descansar.', fin: 'Ya volvieron a casa. Gracias, duende.' },
        { id: 'abi3', nv: 54, tipo: 'jefe', n: 1, pide: 'Vence al Leviatán',
          inicio: 'El Leviatán se tragó mi bote. Con bote y todo.', fin: '¡Mi bote! Un poco mordido, pero flota.' },
      ] },
    { id: 'v_marea', nombre: 'Marea', hoja: 'fantasma', x: 1900, oficio: 'Canta para las olas',
      saludo: 'Si cantas bajito, el mar te escucha.',
      l: [
        { id: 'abi4', nv: 51, tipo: 'caza', k: 'baba', n: 6, pide: 'Limpia 6 Babosas Abisales',
          inicio: 'Las babosas ensucian mi roca favorita. Ahí canto yo.', fin: 'Roca limpia, canción nueva. Escucha.' },
        { id: 'abi5', nv: 53, tipo: 'caza', k: 'pez_grande', n: 4, pide: 'Vence a 4 Peces Ogro',
          inicio: 'Los peces ogro se comen a los peces chiquitos que me hacen coro.', fin: 'El coro está completo otra vez.' },
        { id: 'abi6', nv: 54, tipo: 'caza', n: 30, pide: 'Caza 30 monstruos del abismo',
          inicio: 'Quiero cantar la canción más larga del mar. Necesito silencio.', fin: '¿La escuchaste? Era para ti.' },
      ] },
  ],
  acantilados: [
    { id: 'v_condor', nombre: 'Maestro Cóndor', hoja: 'hechicero', x: 640, oficio: 'Vigía de los acantilados',
      saludo: 'Desde aquí arriba veo todo el Éter. Y te vi venir desde el pueblo.',
      l: [
        { id: 'aca1', nv: 55, tipo: 'caza', k: 'aguila', n: 8, pide: 'Vence a 8 Águilas de Tormenta',
          inicio: 'Las águilas de tormenta me disputan el cielo. El cielo es de todos.', fin: 'Cielo compartido, como debe ser.' },
        { id: 'aca2', nv: 57, tipo: 'caza', k: 'paladin_goblin', n: 6, pide: 'Derrota a 6 Paladines Goblin',
          inicio: 'Los paladines goblin dicen que el dragón es su dios. No lo es.', fin: 'Ahora dudan. Eso ya es algo.' },
        { id: 'aca3', nv: 59, tipo: 'jefe', n: 1, pide: 'Vence al Dragón Ancestral',
          inicio: 'El Dragón Ancestral es la última sombra del Éter. Solo tú puedes.', fin: 'Lo hiciste, duende de Chancay. Tu nombre quedará en la piedra.' },
      ] },
    { id: 'v_abuelo', nombre: 'Abuelo Duende', hoja: 'goblin_lord', x: 2050, oficio: 'El primer duende',
      saludo: 'Yo empecé esta aventura hace mucho. Me alegra ver que alguien la termina.',
      l: [
        { id: 'aca4', nv: 56, tipo: 'caza', k: 'zarigueya', n: 8, pide: 'Espanta 8 Zarigüeyas Salvajes',
          inicio: 'Las zarigüeyas se llevan mis lentes. Sin lentes no veo el final.', fin: '¡Mis lentes! Ahora sí veo lo lejos que llegaste.' },
        { id: 'aca5', nv: 58, tipo: 'caza', k: 'fantasma_halo', n: 6, pide: 'Guía a 6 Almas Errantes',
          inicio: 'Las almas errantes son duendes que no terminaron su viaje. Termínalo por ellos.', fin: 'Ya descansan. Gracias por llevarlos contigo.' },
        { id: 'aca6', nv: 59, tipo: 'caza', n: 40, pide: 'Caza 40 monstruos de los acantilados',
          inicio: 'Una última prueba, para que sepas que el camino fue tuyo.', fin: 'Ya no eres un aprendiz. Eres una leyenda.' },
      ] },
  ],
};

export function vecinosDe(zona) { return VECINOS2D[zona] || []; }
export function vecinoPorId(id) {
  for (const z in VECINOS2D) for (const v of VECINOS2D[z]) if (v.id === id) return { v, zona: z };
  return null;
}
// El encargo en curso de un vecino: el primero sin cobrar. null si ya cumpliste
// toda su cadena. { q, bloq } con bloq = true si aún no tienes su nivel.
// v2: progreso del personaje { <idEncargo>: numero (aceptado) | true (cobrado) }.
export function encargoVecino(v, v2, nivel) {
  for (const q of v.l) {
    if (v2 && v2[q.id] === true) continue;
    return { q, bloq: (nivel | 0) < q.nv };
  }
  return null;
}
