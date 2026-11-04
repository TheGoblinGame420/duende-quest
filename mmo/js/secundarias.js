// ═══════════════════════════════════════════════════════
// MISIONES SECUNDARIAS DE ORIGINS (27-oct-2026)
//
// Historias cortas por zona, una detras de otra, que cuentan la vida de la gente
// del bosque desde que se rompio el Cantaro, y el arco de la Receta y la Puerta
// (ingredientes del Recetario y pistas del Cuaderno). Se activan solas al entrar en
// la zona (si tienes su nivel) y avanzan con lo que ya haces: cazar un monstruo
// concreto (caza + k), recoger plantas o vetas, pescar, abrir cofres o fabricar
// con la Artesana (fabricar + k opcional). Datos compartidos por el cliente
// (panel de misiones) y el servidor (functions/mmo/secundarias.js).
//
// premio: xp = fraccion de la XP del nivel, oro = por nivel de la zona, mat.
// Opcionales: pista e ingr (solo los lee el cliente; se dan por conseguidos con
// '<id>:ok', sin campos nuevos en el personaje) y minPistas (la frena secundariaDe).
//
// El orden importa: secundariaDe toma la primera sin hacer de la zona y se detiene
// si le falta nivel, asi que dentro de cada zona van de menor a mayor nivel. Los
// ids viejos no se tocan: sus ':ok' y contadores valen en los personajes guardados.
// ═══════════════════════════════════════════════════════

export const SECUNDARIAS = [
  // ── Bosque de la Larga Noche ──
  { id: 'n3', zona: 'noche', nv: 1, quien: 'Mama Asiri', nombre: 'Un poquito para la tierra', tipo: 'recoger', n: 2,
    pide: 'Recoge 2 plantas o vetas del bosque', inicio: 'Soy Mama Asiri, la chichera. Mi banderita está morada, pero mi olla está vacía. Tráeme algo del bosque, wawa.', fin: 'Primero un chorrito para la Pachamama, después para uno. Así se toma en esta casa.', sigue: 'La receta vieja tenía diez ingredientes. Hoy no me queda ni uno. ¿Me ayudas?', premio: { xp: 0.25, oro: 30, mat: { hierba: 1 } } },
  { id: 'n1', zona: 'noche', nv: 2, quien: 'Abuela Sisa', nombre: 'Linternas para el pueblo', tipo: 'recoger', n: 4,
    pide: 'Recoge 4 plantas o vetas del bosque', inicio: 'Las linternas del pueblo se apagan una a una. Tráeme lo que encuentres entre los árboles y haré aceite de hierba duende.', fin: 'Las linternas vuelven a brillar. Mientras quede una encendida, los goblins no entran al pueblo.', sigue: 'Aunque anoche, junto a las ollas de chicha, oí pasos chiquitos… y un cuchillo que brillaba.', premio: { xp: 0.4, oro: 40, mat: { hierba: 2 } } },
  { id: 'n4', zona: 'noche', nv: 2, quien: 'Guardia Tito', nombre: 'La ronda de las linternas', tipo: 'caza', k: 'goblin_normal', n: 6,
    pide: 'Derrota a 6 Goblins', inicio: 'Causa, los goblins me roban el aceite de las linternas. Ronda por mí. Yo de mi puesto no me muevo.', fin: 'Seis menos. ¿Que por qué nunca descanso? Una vez descansé, oe. Una sola. No preguntes.', premio: { xp: 0.25, oro: 35 } },
  { id: 'n5', zona: 'noche', nv: 3, quien: 'Mama Asiri', nombre: 'La hierba que perfuma', tipo: 'recoger', n: 3, ingr: 'luisa',
    pide: 'Recoge 3 plantas o vetas del bosque', inicio: 'Hierba luisa: crece junto al Árbol de los Susurros. Sin ella la olla no huele a casa. Búscala al toque.', fin: '¡Eso, ese olorcito! Ya la anoté en mi recetario. Y toma tu yapa, que así se trabaja en esta casa.', premio: { xp: 0.3, oro: 45, mat: { hierba: 2 } } },
  { id: 'n6', zona: 'noche', nv: 4, quien: 'Abuela Sisa', nombre: 'La tabla de amasar', tipo: 'cofre', n: 1,
    pide: 'Abre un cofre del bosque', inicio: 'Esos sinvergüenzas me escondieron la tabla en un cofre. Búscala, hijito. Estas manos no amasan en cualquier cosa.', fin: 'Aquí está. Carita por carita, un pan por cada uno que se fue.', sigue: 'Siempre hago uno de más. No me preguntes para quién.', premio: { xp: 0.3, oro: 55 } },
  { id: 'n2', zona: 'noche', nv: 4, quien: 'Abuela Sisa', nombre: 'El que roba las ollas', tipo: 'caza', k: 'goblin_assassin', n: 5,
    pide: 'Derrota a 5 Goblins Asesinos', inicio: 'Alguien se lleva las ollas de chicha que dejamos al fresco. Huellas pequeñas, cuchillos grandes: asesinos goblin.', fin: 'Encontraste las ollas… vacías, pero enteras. Ya podremos llenarlas otra vez.', premio: { xp: 0.5, oro: 60 } },
  { id: 'n7', zona: 'noche', nv: 5, quien: 'Mama Asiri', nombre: 'La noche bajo la mesa', tipo: 'caza', k: 'goblin_assassin', n: 4, pista: 'p1',
    pide: 'Derrota a 4 Goblins Asesinos', inicio: 'De niña me escondí bajo la mesa esa noche. El nudo de la puerta no estaba cortado: lo desataron. Esos asesinos cargan cartas. Quítaselas.', fin: '«La puerta estará sola cuando canten en el camposanto.» Sin firma. Huele a anís… como la tienda de Grumo.', premio: { xp: 0.35, oro: 65 } },
  { id: 'n8', zona: 'noche', nv: 5, quien: 'Artesana Lila', nombre: 'Lo que dice un nudo', tipo: 'fabricar', k: 'pociones', n: 1, pista: 'p2',
    pide: 'Fabrica Pociones ×3 con la Artesana Lila', inicio: 'Asiri me trajo la cuerda de esa puerta. Prepara unas pociones conmigo: para leer un nudo necesito las manos ocupadas.', fin: 'Lo soltó una mano zurda, sin apuro. Ese nudo se enseñaba en la Casa del Cántaro, y solo a cuatro: Grumo, el Sabio, Tito y la Abuela. A mí no: yo tejo, no ato.', sigue: '¿Y quién cuenta monedas con la izquierda? Míralo a Grumo, nomás.', premio: { xp: 0.3, oro: 60, mat: { mineral: 2 } } },
  { id: 'n9', zona: 'noche', nv: 6, quien: 'Mercader Grumo', nombre: 'Grumo no conversa gratis', tipo: 'pescar', n: 2,
    pide: 'Pesca 2 peces', inicio: '¿Sospechan de mí? ¡Qué roche! Tráeme dos pescados y hablamos. Grumo no conversa gratis.', fin: 'Sí, soy zurdo y sí, vendo anís. Me compran Tito, Lila, la Abuela, el Sabio… ¡medio pueblo!', sigue: 'Mis cuentas son mías. Y ya no preguntes, que me espantas la clientela.', premio: { xp: 0.3, oro: 70, mat: { pescado: 1 } } },
  // ── Colinas Rojas del Amanecer ──
  { id: 'a1', zona: 'amanecer', nv: 7, quien: 'Tayta Mallku', nombre: 'Maizales en llamas', tipo: 'caza', k: 'goblin_peasant', n: 6,
    pide: 'Derrota a 6 Goblins Campesinos', inicio: 'Los campesinos goblin queman los últimos maizales. Sin maíz no hay chicha, y sin chicha no hay mañana.', fin: 'El humo se va. Entre la ceniza quedaron mazorcas moradas sanas: guárdalas, valen oro.', sigue: 'Pero el maíz quemado ya no se siembra. Pronto necesitaré semillas nuevas para volver a sembrar.', premio: { xp: 0.4, oro: 70, mat: { hierba: 3 } } },
  { id: 'a3', zona: 'amanecer', nv: 7, quien: 'Tayta Mallku', nombre: 'El membrillo de la ladera', tipo: 'recoger', n: 3, ingr: 'membrillo',
    pide: 'Recoge 3 plantas o vetas de las colinas', inicio: 'Asiri quiere mi membrillo. Está duro como mis rodillas, pero perfuma como ninguno. Ayúdame a bajarlo.', fin: 'Llévaselo. Dile que hierva entero, sin apuro, como se hacen las cosas buenas.', premio: { xp: 0.3, oro: 70, mat: { hierba: 2 } } },
  { id: 'a4', zona: 'amanecer', nv: 8, quien: 'Guardia Tito', nombre: 'La otra guardia', tipo: 'caza', k: 'goblin_guard', n: 6,
    pide: 'Derrota a 6 Goblins Guardia', inicio: 'La guardia roja del Rey cierra el camino. Ojo, no me confundas: yo soy de la otra guardia. La que se queda.', fin: 'Bien hecho, pata. Cuida tu poncho. Uno se engancha en una puerta y… nada, nada. Olvídalo.', premio: { xp: 0.3, oro: 80 } },
  { id: 'a2', zona: 'amanecer', nv: 9, quien: 'Tayta Mallku', nombre: 'Semillas para sembrar', tipo: 'recoger', n: 5,
    pide: 'Recoge 5 plantas o vetas de las colinas', inicio: 'Si volvemos a sembrar, el amanecer volverá. Busca entre las rocas rojas todo lo que crezca.', fin: 'Sembramos al pie de la Roca del Alba. Dicen que esta mañana el sol tardó un poco menos.', premio: { xp: 0.5, oro: 80, mat: { mineral: 3 } } },
  { id: 'a5', zona: 'amanecer', nv: 9, quien: 'Tayta Mallku', nombre: 'Plumas con recado', tipo: 'caza', k: 'pajaro', n: 5, pista: 'p3',
    pide: 'Derrota a 5 Pájaros Hueso', inicio: 'Los pájaros hueso cruzan mi chacra con recados al castillo. Baja unos cuantos y a ver qué llevan.', fin: '«Cuarenta costales de maíz de Grumo, recibidos.» Y el sello del Rey. ¡Grumo le daba de comer al enemigo!', premio: { xp: 0.35, oro: 90 } },
  { id: 'a6', zona: 'amanecer', nv: 10, quien: 'Artesana Lila', nombre: 'Hilo morado', tipo: 'recoger', n: 4, pista: 'p4',
    pide: 'Recoge 4 plantas o vetas de las colinas', inicio: 'Tayta Mallku guardó un hilo morado de la puerta de esa noche. Tráeme hierbas de aquí para lavarlo y leer su tinte.', fin: 'Ay, no. Es mío. Lo teñí para la Guardia del pueblo. Ese poncho solo lo tuvo Tito.', premio: { xp: 0.35, oro: 95, mat: { mineral: 3 } } },
  { id: 'a7', zona: 'amanecer', nv: 10, quien: 'Tayta Mallku', nombre: 'Lo que vio el viejo', tipo: 'caza', k: 'goblin_knight', n: 4,
    pide: 'Derrota a 4 Goblins Caballero', inicio: 'Saca a esos caballeros de mi ladera y te cuento lo que vi esa noche. Nunca se lo dije a nadie.', fin: 'Vi a Tito dejar su puesto. Caminaba lento, con la barriga llena. ¿Quién se llena antes de una guardia?', premio: { xp: 0.35, oro: 100 } },
  { id: 'a8', zona: 'amanecer', nv: 11, quien: 'Abuela Sisa', nombre: 'Un plato para mi nieto', tipo: 'pescar', n: 3,
    pide: 'Pesca 3 peces', inicio: 'A mi nieto Tito se le olvida comer desde esa noche. Pesca algo, hijito. Con pescado y pan se cuida a un nieto.', fin: 'Es buen chico. Se carga cosas que no son suyas, igualito a su abuelo. Esa noche yo cantaba en el camposanto, con todos. Si me hubiera quedado con él…', sigue: 'Si algún día te cuenta algo, tú no le creas todo.', premio: { xp: 0.3, oro: 105, mat: { pescado: 2 } } },
  // ── Selva Esmeralda ──
  { id: 's1', zona: 'selva', nv: 13, quien: 'Chamán Amaru', nombre: 'Esporas en la chicha', tipo: 'caza', k: 'hongo', n: 6,
    pide: 'Derrota a 6 Hongos Gigantes', inicio: 'Los hongos beben la chicha derramada y crecen como torres. Sus esporas enferman a los viajeros.', fin: 'El aire se limpia. Con sus sombreros secos preparo un remedio para tus heridas.', sigue: 'Mientras limpiabas, la Semilla Madre brilló un instante. Creo que quiere decirnos algo.', premio: { xp: 0.4, oro: 90, mat: { hierba: 4 } } },
  { id: 's3', zona: 'selva', nv: 13, quien: 'Chamán Amaru', nombre: 'El maíz se pide', tipo: 'recoger', n: 4, ingr: 'maiz',
    pide: 'Recoge 4 plantas o vetas de la selva', inicio: 'El maíz morado no se arranca: se pide. Saluda al monte, recoge con calma y deja lo que no vas a usar.', fin: 'De aquí nace el color. Lleva este maíz a la chichera. Ella sabe que la olla empieza con él.', premio: { xp: 0.3, oro: 95, mat: { hierba: 3 } } },
  { id: 's4', zona: 'selva', nv: 14, quien: 'Chamán Amaru', nombre: 'Huellas desparejas', tipo: 'caza', k: 'rana', n: 6, pista: 'p5',
    pide: 'Derrota a 6 Ranas de Charca', inicio: 'Dicen que vieron a Tito en la cascada esa noche. Calla a las ranas, que sin su coro puedo leer el barro.', fin: 'Un pie de gente y otro de animal. Eso fue el Chullachaqui: cuida el monte y toma la cara de quien conoces.', sigue: 'Ese testigo no vale. Pero el hilo morado sigue siendo de Tito.', premio: { xp: 0.35, oro: 110 } },
  { id: 's5', zona: 'selva', nv: 15, quien: 'Mama Asiri', nombre: 'La flor de la olla', tipo: 'recoger', n: 5,
    pide: 'Recoge 5 plantas o vetas de la selva', inicio: 'El Chamán te va a pedir una chicha vieja y sin Flor de Luna no sale. Tráeme de la selva y yo te destilo una.', fin: 'Toma tu Flor de Luna. Y no me agradezcas: un día me invitas un vaso.', premio: { xp: 0.3, oro: 110, mat: { flor: 1 } } },
  { id: 's2', zona: 'selva', nv: 15, quien: 'Chamán Amaru', nombre: 'La receta perdida', tipo: 'fabricar', n: 1, k: 'chichaE',
    pide: 'Prepara una Chicha Morada del Duende con la Artesana Lila', inicio: 'La Semilla Madre guarda la receta original: maíz morado, hierbas y una flor que brilla de noche. Llévasela a Lila.', fin: 'Es la primera chicha de verdad desde que se rompió el Cántaro. Bébela: hoy cazas con más fuerza.', premio: { xp: 0.6, oro: 120, mat: { flor: 1 } } },
  { id: 's6', zona: 'selva', nv: 16, quien: 'Chamán Amaru', nombre: 'La página arrancada', tipo: 'caza', k: 'goblin_centurion', n: 6, pista: 'p6',
    pide: 'Derrota a 6 Goblins Centurión', inicio: 'Un centurión lleva un papel viejo en el casco. Si es lo que creo, no debe estar en esa cabeza.', fin: 'Es la página que falta del Libro del Cántaro: cómo se rompe su barro. Y la letra… es la del Sabio.', premio: { xp: 0.4, oro: 125 } },
  { id: 's7', zona: 'selva', nv: 17, quien: 'Sabio Hechicero', nombre: 'Tinta y silencio', tipo: 'cofre', n: 1,
    pide: 'Abre un cofre de la selva', inicio: 'Sí, a mi libro le falta una página. No te diré por qué. Trae lo que hay en ese cofre: me pertenece.', fin: 'Gracias. No te ofendas, joven: quien enseña puede ser culpable de otra cosa. Y ahora, déjame solo.', premio: { xp: 0.4, oro: 135, mat: { cristal: 1 } } },
  // ── Picos Tormenta ──
  { id: 't1', zona: 'tormenta', nv: 19, quien: 'Herrera Coya', nombre: 'Rayos robados', tipo: 'caza', k: 'goblin_mage', n: 6,
    pide: 'Derrota a 6 Goblins Magos', inicio: 'Los magos goblin roban rayos del cielo partido para sus bastones. Mi fragua necesita esa chispa.', fin: 'Sin sus bastones, la tormenta amaina un poco. Toma este mineral cargado: forja algo digno.', sigue: 'Esa chispa no basta para algo que dure. Me falta un metal que solo nace donde cae el rayo.', premio: { xp: 0.4, oro: 140, mat: { mineral: 5 } } },
  { id: 't3', zona: 'tormenta', nv: 20, quien: 'Herrera Coya', nombre: 'El clavo que no es de fierro', tipo: 'recoger', n: 5, ingr: 'clavo',
    pide: 'Recoge 5 plantas o vetas de los picos', inicio: 'Asiri me pidió clavo y le mandé uno de fierro. ¡Qué roche! Era clavo de olor. Búscalo en las grietas calientes.', fin: 'Huele a abuela y a dentista. Ya, llévaselo, y dile que el de fierro me lo devuelva.', premio: { xp: 0.4, oro: 150, mat: { mineral: 3 } } },
  { id: 't2', zona: 'tormenta', nv: 21, quien: 'Herrera Coya', nombre: 'Metal del cielo', tipo: 'recoger', n: 6,
    pide: 'Recoge 6 plantas o vetas de los picos', inicio: 'Donde cae el rayo, el hierro se vuelve más duro. Busca vetas entre las rocas quemadas.', fin: 'Este metal canta cuando lo golpeas. Con él se forjan armas que no se rompen.', premio: { xp: 0.5, oro: 160, mat: { cristal: 1 } } },
  { id: 't4', zona: 'tormenta', nv: 22, quien: 'Herrera Coya', nombre: 'Cuarenta grilletes', tipo: 'caza', k: 'ghoul_ardiente', n: 6, pista: 'p7',
    pide: 'Derrota a 6 Ghouls Ardientes', inicio: 'Grumo me pagó por romper cuarenta grilletes. ¿Para qué? Está en mi libro de encargos, y los ghouls me lo quemaron a medias.', fin: 'Cada costal de maíz pagó un preso. Grumo no alimentaba al Rey: le compraba duendes.', sigue: 'Ni le digas que sabes. Se muere de roche.', premio: { xp: 0.5, oro: 170 } },
  // ── Desierto Dorado ──
  { id: 'd1', zona: 'desierto', nv: 25, quien: 'Viajera Illari', nombre: 'Sed en la arena', tipo: 'pescar', n: 3,
    pide: 'Pesca 3 peces en cualquier agua', inicio: 'La caravana no aguanta más. En el Oasis Perdido aún hay agua: tráenos algo que comer.', fin: 'Comimos junto al oasis. El agua aún sabe un poquito a chicha morada… nadie sabe por qué.', premio: { xp: 0.4, oro: 180, mat: { pescado: 2 } } },
  { id: 'd3', zona: 'desierto', nv: 26, quien: 'Viajera Illari', nombre: 'Limón de oasis', tipo: 'recoger', n: 5, ingr: 'limon',
    pide: 'Recoge 5 plantas o vetas del desierto', inicio: 'En el Oasis Perdido aún da limón. Va al final, con la olla ya fría. Si lo echas antes, amarga. Como la verdad.', fin: 'Con esto la chicha despierta y se pone más viva. Llévalo antes de que el sol lo seque.', premio: { xp: 0.4, oro: 190, mat: { hierba: 4 } } },
  { id: 'd2', zona: 'desierto', nv: 28, quien: 'Viajera Illari', nombre: 'Escamas al sol', tipo: 'caza', k: 'lagarto', n: 8,
    pide: 'Derrota a 8 Lagartos', inicio: 'Los lagartos tomaron las ruinas de los maizales. Debajo de su nido está la Base del Cántaro.', fin: 'Sin lagartos, el viento descubre las ruinas: aquí había un pueblo de duendes.', premio: { xp: 0.5, oro: 200 } },
  { id: 'd4', zona: 'desierto', nv: 30, quien: 'Viajera Illari', nombre: 'La letra de la corte', tipo: 'caza', k: 'goblin_samurai', n: 8, pista: 'p8',
    pide: 'Derrota a 8 Goblins Samurái', inicio: 'Los samuráis llevan órdenes del Hechicero de la Corte. Tráeme una: he visto esa letra en otro lado.', fin: 'Mira la «o» con su rulito. Esa letra solo la enseña el Sabio de tu pueblo.', premio: { xp: 0.5, oro: 230 } },
  // ── Castillo del Rey Goblin ──
  { id: 'c1', zona: 'castillo', nv: 33, quien: 'Espía Kantu', nombre: 'La bodega del Rey', tipo: 'cofre', n: 1,
    pide: 'Abre un cofre del tesoro del castillo', inicio: 'El Rey guarda la chicha robada en cofres. Si abres uno, sabremos cuánta nos queda por recuperar.', fin: 'Dentro había botellas vacías y un mapa del Núcleo con una marca: «el último pedazo».', premio: { xp: 0.5, oro: 260, mat: { cristal: 1 } } },
  { id: 'c3', zona: 'castillo', nv: 34, quien: 'Espía Kantu', nombre: 'El dulce del Rey', tipo: 'cofre', n: 1, ingr: 'chancaca',
    pide: 'Abre un cofre del castillo', inicio: 'El Rey no toma chicha, pero acapara la chancaca para que nadie más la prepare. Abre un cofre y saca un bloque.', fin: 'Chancaca de la buena. Un bloque de estos dura más que un rey. Te cubro la salida.', premio: { xp: 0.5, oro: 270, mat: { flor: 1 } } },
  { id: 'c2', zona: 'castillo', nv: 36, quien: 'Espía Kantu', nombre: 'La guardia de hierro', tipo: 'caza', k: 'caballero_negro', n: 8,
    pide: 'Derrota a 8 Caballeros Negros', inicio: 'Los caballeros negros juraron por la chicha robada. Sin ellos, el castillo queda abierto.', fin: 'Sus juramentos se rompen con sus armaduras. El trono, por fin, está vacío.', premio: { xp: 0.6, oro: 300 } },
  { id: 'c4', zona: 'castillo', nv: 38, quien: 'Espía Kantu', nombre: 'La carita de yeso', tipo: 'caza', k: 'hechicero_corte', n: 8, pista: 'p9',
    pide: 'Derrota a 8 Hechiceros de la Corte', inicio: 'Estos son aprendices. Del primer Hechicero nadie habla. Límpiame su torre y entro a mirar.', fin: 'Solo había esto: una carita de yeso de t\'anta wawa, gastada de tanto tocarla, con la sonrisa trazada al revés. En el pueblo cada casa las pinta.', sigue: '¿Quién guarda eso en un castillo de goblins?', premio: { xp: 0.6, oro: 320, mat: { cristal: 1 } } },
  // ── Cumbres del Ocaso ──
  { id: 'u1', zona: 'cumbres', nv: 41, quien: 'Guardián Inti', nombre: 'Alas en la oscuridad', tipo: 'caza', k: 'murcielago', n: 8,
    pide: 'Derrota a 8 Murciélagos Vampiro', inicio: 'Los murciélagos tapan el último sol de las cumbres. Así no despiertan los Guardianes del Éter.', fin: 'Un rayo rosado toca las tumbas. Algo, muy lejos, se mueve en el cielo.', premio: { xp: 0.5, oro: 340, mat: { mithril: 1 } } },
  { id: 'u3', zona: 'cumbres', nv: 42, quien: 'Guardián Inti', nombre: 'Corteza del último sol', tipo: 'recoger', n: 6, ingr: 'canela',
    pide: 'Recoge 6 plantas o vetas de las cumbres', inicio: 'Aquí crece la canela que toma el último sol. Pide permiso a las tumbas y corta solo la corteza.', fin: 'Dale calor a la olla con esto. Los Guardianes también brindaban, aunque ya nadie se acuerde.', premio: { xp: 0.5, oro: 350, mat: { mithril: 1 } } },
  { id: 'u2', zona: 'cumbres', nv: 43, quien: 'Guardián Inti', nombre: 'Ofrenda de los Guardianes', tipo: 'fabricar', n: 2,
    pide: 'Fabrica 2 cosas con la Artesana Lila', inicio: 'Los Guardianes aceptaban ofrendas hechas a mano. Fabrica algo con tus materiales y déjalo en sus tumbas.', fin: 'Las tumbas brillan con tu ofrenda. Los Guardianes te recordarán cuando vuelen otra vez.', premio: { xp: 0.6, oro: 380, mat: { flor: 1 } } },
  { id: 'u4', zona: 'cumbres', nv: 44, quien: 'Guardián Inti', nombre: 'Lo que vieron desde arriba', tipo: 'caza', k: 'esqueleto_capa', n: 8, pista: 'p10',
    pide: 'Derrota a 8 Esqueletos Errantes', inicio: 'Los errantes vieron esa noche desde lo alto. Dales descanso y me dirán lo que saben sus huesos.', fin: 'Tito dormía junto a la fogata, tapado con una manta. Lila guardó su poncho: tiene una miga con anís y hierba del sueño.', sigue: 'Entonces, ¿por qué confesó algo que no hizo?', premio: { xp: 0.6, oro: 400 } },
  // ── Cavernas Abisales ──
  { id: 'v1', zona: 'cavernas', nv: 46, quien: 'Minera Ñusta', nombre: 'Barro sagrado', tipo: 'recoger', n: 8,
    pide: 'Recoge 8 plantas o vetas de las cavernas', inicio: 'Con barro del Cristal Madre se moldeó el Cántaro. Si juntamos suficiente, Lila podrá pegar los pedazos.', fin: 'El barro late como un corazón morado. Lila dice que con él, el Cántaro aguantará mil años.', premio: { xp: 0.5, oro: 420, mat: { esencia: 1 } } },
  { id: 'v3', zona: 'cavernas', nv: 47, quien: 'Minera Ñusta', nombre: 'La alforja de la mina', tipo: 'caza', k: 'saltador', n: 8, ingr: 'manzana', pista: 'p11',
    pide: 'Derrota a 8 Saltarines Abisales', inicio: 'Los saltarines del Muki me robaron la alforja: manzanas de mi tierra y una pizarra vieja que hallé en la veta.', fin: 'Las manzanas, para Asiri. Y la pizarra: «Sami, nueve años. Ya sé leer.» Con la «o» de rulito.', sigue: 'El Sabio la miró y se sentó: «Fui su maestro. No le enseñé al Rey. Le enseñé a un niño».', premio: { xp: 0.6, oro: 440, mat: { esencia: 1 } } },
  { id: 'v2', zona: 'cavernas', nv: 48, quien: 'Minera Ñusta', nombre: 'Tinta en el agua', tipo: 'caza', k: 'pulpo', n: 8,
    pide: 'Derrota a 8 Pulpos Brujos', inicio: 'Los pulpos brujos ensucian el agua del Cristal Madre con tinta maldita. Así el barro no sirve.', fin: 'El agua vuelve a ser clara y morada. Ya se puede trabajar el barro sagrado.', premio: { xp: 0.6, oro: 460 } },
  // ── Abismo Marino ──
  { id: 'm1', zona: 'abismo', nv: 51, quien: 'Farera Quilla', nombre: 'Peces para el faro', tipo: 'pescar', n: 5,
    pide: 'Pesca 5 peces', inicio: 'El Faro de la Costa se alimenta con aceite de pez. Sin él, nadie verá el Pico del Cántaro bajo las olas.', fin: 'El faro arde otra vez. Bajo el agua, algo brilla con forma de pico de cántaro.', premio: { xp: 0.5, oro: 500, mat: { pez_dorado: 1 } } },
  { id: 'm3', zona: 'abismo', nv: 52, quien: 'Farera Quilla', nombre: 'Botellas de la marea', tipo: 'pescar', n: 4, ingr: 'pina', pista: 'p12',
    pide: 'Pesca 4 peces', inicio: 'El río trae cosas de la selva hasta mi faro. Hoy pesca conmigo: piñas, botellas… a ver qué sale.', fin: 'Piña dulce, para la olla. Y esta botella: «Señora: su hijo vive. Abra la puerta la noche de las almas».', sigue: 'De joven iba al camposanto. Cada mesa tenía plato para sus muertos. Una sola guardaba un sitio vacío. Y la noche de la puerta, esa mesa se quedó sin nadie.', premio: { xp: 0.6, oro: 520, mat: { pescado: 3 } } },
  { id: 'm2', zona: 'abismo', nv: 53, quien: 'Farera Quilla', nombre: 'Coro de espectros', tipo: 'caza', k: 'espectro', n: 8,
    pide: 'Derrota a 8 Espectros Marinos', inicio: 'Los espectros del naufragio cantan con el Leviatán y apagan el faro cada noche.', fin: 'Silencio en la costa. El Leviatán, sin su coro, sube a respirar: es el momento.', premio: { xp: 0.6, oro: 540 } },
  // ── Acantilados Mágicos ──
  { id: 'x1', zona: 'acantilados', nv: 56, quien: 'Sabia Mama Ocllo', nombre: 'El borde del mundo', tipo: 'caza', k: 'aguila', n: 8,
    pide: 'Derrota a 8 Águilas de Tormenta', inicio: 'Las águilas vigilan el camino al Éter. Hasta que no bajen, ningún duende podrá volar al Núcleo.', fin: 'El cielo queda libre. Desde el borde se ve el Núcleo. Dicen que el último pedazo late allá dentro.', sigue: 'Grumo me abrió sus cuentas, ya sin roche: el anís se vende por puñados. Por costal, solo se lo lleva quien hornea para todo el pueblo.', premio: { xp: 0.5, oro: 600, mat: { mithril: 1 } } },
  { id: 'x2', zona: 'acantilados', nv: 58, quien: 'Sabia Mama Ocllo', nombre: 'La chicha del regreso', tipo: 'fabricar', n: 1, k: 'chichaE',
    pide: 'Prepara una Chicha Morada del Duende con la Artesana Lila', inicio: 'Cuando el Cántaro se llene, habrá fiesta en el pueblo. Prepara la primera chicha para el brindis.', fin: 'Guárdala para el día que llegues a nivel 60: ese día, la chicha será de verdad y vendrá a tu casa.', sigue: 'Cuando vuelvas, mira los panes del horno de la plaza: la sonrisa de sus caritas va trazada al revés, como la de yeso. Así pinta una mano zurda.', premio: { xp: 0.7, oro: 700, mat: { esencia: 1 } } },
  { id: 'x3', zona: 'acantilados', nv: 58, quien: 'Sabia Mama Ocllo', nombre: 'El alma que casi llegó', tipo: 'caza', k: 'fantasma_halo', n: 8, minPistas: 12,
    pide: 'Derrota a 8 Almas Errantes', inicio: 'Una de estas almas robó el último pedazo al Rey y voló con él al Núcleo. No llegó: cayó en el borde y el Dragón se quedó con el pedazo. Libera a las que la rodean.', fin: 'Tenía una carta que nunca salió: «Mamá: no abras la puerta. El Rey no me va a soltar. Yo le enseñé. Perdóname. Sami».', sigue: 'Mira tu cuaderno: una madre del pueblo. Zurda. Que compra anís por costal. Vuelve al pueblo y búscala.', premio: { xp: 0.7, oro: 720, mat: { flor: 1 } } },
  { id: 'x4', zona: 'acantilados', nv: 59, quien: 'Abuela Sisa', nombre: 'Un plato más', tipo: 'fabricar', k: 'mazamorra', n: 1, ingr: 'agua',
    pide: 'Prepara una Mazamorra Morada con la Artesana Lila', inicio: 'Ya sabes, ¿no, hijito? Esa noche no canté en el camposanto. Fui yo. Le di pan dormido a mi nieto y desaté el nudo con esta mano. Me prometieron a mi Sami. Prepara algo para la mesa.', fin: 'Lo dije delante de todos. Nadie gritó. Asiri me pasó el cucharón: «Amasas y pagas trabajando». Ocllo mandó agua de la primera lluvia, lo último de la receta.', sigue: 'Hoy pongo su plato. Y al lado, uno para ti.', premio: { xp: 0.8, oro: 800, mat: { esencia: 1 } } },
];

// Recetario de Mama Asiri: los 10 ingredientes de la chicha, uno por zona. No hay campo propio:
// el ingrediente queda ganado con c.sec['<mision>:ok'], que ya se guarda en el personaje y solo se
// escribe una vez. El numero del aviso sale del conteo: un veterano puede hacerlas en desorden.
export const INGREDIENTES = [
  { id: 'luisa', nombre: 'Hierba luisa', emoji: '🌿', zona: 'noche', mision: 'n5', dato: 'Algunas casas la usan para perfumar.' },
  { id: 'membrillo', nombre: 'Membrillo', emoji: '🍐', zona: 'amanecer', mision: 'a3', dato: 'Se hierve entero; da aroma.' },
  { id: 'maiz', nombre: 'Maíz morado', emoji: '🌽', zona: 'selva', mision: 's3', dato: 'Es el corazón: de la coronta y el grano sale el color.' },
  { id: 'clavo', nombre: 'Clavo de olor', emoji: '🌰', zona: 'tormenta', mision: 't3', dato: 'Con pocos basta.' },
  { id: 'limon', nombre: 'Limón', emoji: '🍋', zona: 'desierto', mision: 'd3', dato: 'Va al final, con la olla fría.' },
  { id: 'chancaca', nombre: 'Chancaca', emoji: '🍯', zona: 'castillo', mision: 'c3', dato: 'Dulzor de caña. Se echa al gusto.' },
  { id: 'canela', nombre: 'Canela', emoji: '🍂', zona: 'cumbres', mision: 'u3', dato: 'En rama, para hervir.' },
  { id: 'manzana', nombre: 'Manzana', emoji: '🍎', zona: 'cavernas', mision: 'v3', dato: 'Se hierve con cáscara.' },
  { id: 'pina', nombre: 'Piña', emoji: '🍍', zona: 'abismo', mision: 'm3', dato: 'Se usa también la cáscara, bien lavada.' },
  { id: 'agua', nombre: 'Agua', emoji: '💧', zona: 'acantilados', mision: 'x4', dato: 'Todo se hierve en ella. Sin agua no hay nada.' },
];
// Los ingredientes ya ganados, segun el progreso guardado (c.sec). Sin progreso: lista vacia.
export function ingredientesDe(hechas) {
  return INGREDIENTES.filter(x => !!(hechas || {})[x.mision + ':ok']);
}

// Pistas del Cuaderno que ya tiene: las de las misiones cumplidas.
export function contarPistas(hechas) {
  return SECUNDARIAS.filter(q => q.pista && (hechas || {})[q.id + ':ok']).length;
}

// La que toca en una zona: la primera sin hacer de esa zona (si llegas a su nivel y a sus pistas).
export function secundariaDe(zona, hechas, nivel) {
  for (const q of SECUNDARIAS) {
    if (q.zona !== zona || (hechas || {})[q.id + ':ok']) continue;
    if (nivel < q.nv) return null;
    // Quien ya la empezo cuando pedia menos pistas no la pierde: su contador sigue valiendo.
    if (q.minPistas && !(hechas || {})[q.id] && contarPistas(hechas) < q.minPistas) return null;
    return q;
  }
  return null;
}
