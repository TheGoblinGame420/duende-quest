// ═══════════════════════════════════════════════════════
// MISIONES SECUNDARIAS DE ORIGINS (27-oct-2026)
//
// Dos historias cortas por zona, una detras de otra, que cuentan la vida de la
// gente del bosque desde que se rompio el Cantaro. Se activan solas al entrar en
// la zona (si tienes su nivel) y avanzan con lo que ya haces: cazar un monstruo
// concreto (caza + k), recoger plantas o vetas, pescar, abrir cofres o fabricar
// con la Artesana (fabricar + k opcional). Datos compartidos por el cliente
// (panel de misiones) y el servidor (functions/mmo/secundarias.js).
//
// premio: xp = fraccion de la XP del nivel, oro = por nivel de la zona, mat.
// ═══════════════════════════════════════════════════════

export const SECUNDARIAS = [
  // ── Bosque de la Larga Noche ──
  { id: 'n1', zona: 'noche', nv: 2, quien: 'Abuela Sisa', nombre: 'Linternas para el pueblo', tipo: 'recoger', n: 4,
    pide: 'Recoge 4 plantas o vetas del bosque', inicio: 'Las linternas del pueblo se apagan una a una. Tráeme lo que encuentres entre los árboles y haré aceite de hierba duende.', fin: 'Las linternas vuelven a brillar. Mientras quede una encendida, los goblins no entran al pueblo.', premio: { xp: 0.4, oro: 40, mat: { hierba: 2 } } },
  { id: 'n2', zona: 'noche', nv: 4, quien: 'Abuela Sisa', nombre: 'El que roba las ollas', tipo: 'caza', k: 'goblin_assassin', n: 5,
    pide: 'Derrota a 5 Goblins Asesinos', inicio: 'Alguien se lleva las ollas de chicha que dejamos al fresco. Huellas pequeñas, cuchillos grandes: asesinos goblin.', fin: 'Encontraste las ollas… vacías, pero enteras. Ya podremos llenarlas otra vez.', premio: { xp: 0.5, oro: 60 } },
  // ── Colinas Rojas del Amanecer ──
  { id: 'a1', zona: 'amanecer', nv: 7, quien: 'Tayta Mallku', nombre: 'Maizales en llamas', tipo: 'caza', k: 'goblin_peasant', n: 6,
    pide: 'Derrota a 6 Goblins Campesinos', inicio: 'Los campesinos goblin queman los últimos maizales. Sin maíz no hay chicha, y sin chicha no hay mañana.', fin: 'El humo se va. Entre la ceniza quedaron mazorcas moradas sanas: guárdalas, valen oro.', premio: { xp: 0.4, oro: 70, mat: { hierba: 3 } } },
  { id: 'a2', zona: 'amanecer', nv: 9, quien: 'Tayta Mallku', nombre: 'Semillas para sembrar', tipo: 'recoger', n: 5,
    pide: 'Recoge 5 plantas o vetas de las colinas', inicio: 'Si volvemos a sembrar, el amanecer volverá. Busca entre las rocas rojas todo lo que crezca.', fin: 'Sembramos al pie de la Roca del Alba. Dicen que esta mañana el sol tardó un poco menos.', premio: { xp: 0.5, oro: 80, mat: { mineral: 3 } } },
  // ── Selva Esmeralda ──
  { id: 's1', zona: 'selva', nv: 13, quien: 'Chamán Amaru', nombre: 'Esporas en la chicha', tipo: 'caza', k: 'hongo', n: 6,
    pide: 'Derrota a 6 Hongos Gigantes', inicio: 'Los hongos beben la chicha derramada y crecen como torres. Sus esporas enferman a los viajeros.', fin: 'El aire se limpia. Con sus sombreros secos preparo un remedio para tus heridas.', premio: { xp: 0.4, oro: 90, mat: { hierba: 4 } } },
  { id: 's2', zona: 'selva', nv: 15, quien: 'Chamán Amaru', nombre: 'La receta perdida', tipo: 'fabricar', n: 1, k: 'chichaE',
    pide: 'Prepara una Chicha Morada del Duende con la Artesana Lila', inicio: 'La Semilla Madre guarda la receta original: maíz morado, hierbas y una flor que brilla de noche. Llévasela a Lila.', fin: 'Es la primera chicha de verdad desde que se rompió el Cántaro. Bébela: hoy cazas con más fuerza.', premio: { xp: 0.6, oro: 120, mat: { flor: 1 } } },
  // ── Picos Tormenta ──
  { id: 't1', zona: 'tormenta', nv: 19, quien: 'Herrera Coya', nombre: 'Rayos robados', tipo: 'caza', k: 'goblin_mage', n: 6,
    pide: 'Derrota a 6 Goblins Magos', inicio: 'Los magos goblin roban rayos del cielo partido para sus bastones. Mi fragua necesita esa chispa.', fin: 'Sin sus bastones, la tormenta amaina un poco. Toma este mineral cargado: forja algo digno.', premio: { xp: 0.4, oro: 140, mat: { mineral: 5 } } },
  { id: 't2', zona: 'tormenta', nv: 21, quien: 'Herrera Coya', nombre: 'Metal del cielo', tipo: 'recoger', n: 6,
    pide: 'Recoge 6 plantas o vetas de los picos', inicio: 'Donde cae el rayo, el hierro se vuelve más duro. Busca vetas entre las rocas quemadas.', fin: 'Este metal canta cuando lo golpeas. Con él se forjan armas que no se rompen.', premio: { xp: 0.5, oro: 160, mat: { cristal: 1 } } },
  // ── Desierto Dorado ──
  { id: 'd1', zona: 'desierto', nv: 25, quien: 'Viajera Illari', nombre: 'Sed en la arena', tipo: 'pescar', n: 3,
    pide: 'Pesca 3 peces en cualquier agua', inicio: 'La caravana no aguanta más. En el Oasis Perdido aún hay agua: tráenos algo que comer.', fin: 'Comimos junto al oasis. El agua aún sabe un poquito a chicha morada… nadie sabe por qué.', premio: { xp: 0.4, oro: 180, mat: { pescado: 2 } } },
  { id: 'd2', zona: 'desierto', nv: 28, quien: 'Viajera Illari', nombre: 'Escamas al sol', tipo: 'caza', k: 'lagarto', n: 8,
    pide: 'Derrota a 8 Lagartos', inicio: 'Los lagartos tomaron las ruinas de los maizales. Debajo de su nido está la Base del Cántaro.', fin: 'Sin lagartos, el viento descubre las ruinas: aquí había un pueblo de duendes.', premio: { xp: 0.5, oro: 200 } },
  // ── Castillo del Rey Goblin ──
  { id: 'c1', zona: 'castillo', nv: 33, quien: 'Espía Kantu', nombre: 'La bodega del Rey', tipo: 'cofre', n: 1,
    pide: 'Abre un cofre del tesoro del castillo', inicio: 'El Rey guarda la chicha robada en cofres. Si abres uno, sabremos cuánta nos queda por recuperar.', fin: 'Dentro había botellas vacías y un mapa del Núcleo con una marca: «el último pedazo».', premio: { xp: 0.5, oro: 260, mat: { cristal: 1 } } },
  { id: 'c2', zona: 'castillo', nv: 36, quien: 'Espía Kantu', nombre: 'La guardia de hierro', tipo: 'caza', k: 'caballero_negro', n: 8,
    pide: 'Derrota a 8 Caballeros Negros', inicio: 'Los caballeros negros juraron por la chicha robada. Sin ellos, el castillo queda abierto.', fin: 'Sus juramentos se rompen con sus armaduras. El trono, por fin, está vacío.', premio: { xp: 0.6, oro: 300 } },
  // ── Cumbres del Ocaso ──
  { id: 'u1', zona: 'cumbres', nv: 41, quien: 'Guardián Inti', nombre: 'Alas en la oscuridad', tipo: 'caza', k: 'murcielago', n: 8,
    pide: 'Derrota a 8 Murciélagos Vampiro', inicio: 'Los murciélagos tapan el último sol de las cumbres. Así no despiertan los Guardianes del Éter.', fin: 'Un rayo rosado toca las tumbas. Algo, muy lejos, se mueve en el cielo.', premio: { xp: 0.5, oro: 340, mat: { mithril: 1 } } },
  { id: 'u2', zona: 'cumbres', nv: 43, quien: 'Guardián Inti', nombre: 'Ofrenda de los Guardianes', tipo: 'fabricar', n: 2,
    pide: 'Fabrica 2 cosas con la Artesana Lila', inicio: 'Los Guardianes aceptaban ofrendas hechas a mano. Fabrica algo con tus materiales y déjalo en sus tumbas.', fin: 'Las tumbas brillan con tu ofrenda. Los Guardianes te recordarán cuando vuelen otra vez.', premio: { xp: 0.6, oro: 380, mat: { flor: 1 } } },
  // ── Cavernas Abisales ──
  { id: 'v1', zona: 'cavernas', nv: 46, quien: 'Minera Ñusta', nombre: 'Barro sagrado', tipo: 'recoger', n: 8,
    pide: 'Recoge 8 plantas o vetas de las cavernas', inicio: 'Con barro del Cristal Madre se moldeó el Cántaro. Si juntamos suficiente, Lila podrá pegar los pedazos.', fin: 'El barro late como un corazón morado. Lila dice que con él, el Cántaro aguantará mil años.', premio: { xp: 0.5, oro: 420, mat: { esencia: 1 } } },
  { id: 'v2', zona: 'cavernas', nv: 48, quien: 'Minera Ñusta', nombre: 'Tinta en el agua', tipo: 'caza', k: 'pulpo', n: 8,
    pide: 'Derrota a 8 Pulpos Brujos', inicio: 'Los pulpos brujos ensucian el agua del Cristal Madre con tinta maldita. Así el barro no sirve.', fin: 'El agua vuelve a ser clara y morada. Ya se puede trabajar el barro sagrado.', premio: { xp: 0.6, oro: 460 } },
  // ── Abismo Marino ──
  { id: 'm1', zona: 'abismo', nv: 51, quien: 'Farera Quilla', nombre: 'Peces para el faro', tipo: 'pescar', n: 5,
    pide: 'Pesca 5 peces', inicio: 'El Faro de la Costa se alimenta con aceite de pez. Sin él, nadie verá el Pico del Cántaro bajo las olas.', fin: 'El faro arde otra vez. Bajo el agua, algo brilla con forma de pico de cántaro.', premio: { xp: 0.5, oro: 500, mat: { pez_dorado: 1 } } },
  { id: 'm2', zona: 'abismo', nv: 53, quien: 'Farera Quilla', nombre: 'Coro de espectros', tipo: 'caza', k: 'espectro', n: 8,
    pide: 'Derrota a 8 Espectros Marinos', inicio: 'Los espectros del naufragio cantan con el Leviatán y apagan el faro cada noche.', fin: 'Silencio en la costa. El Leviatán, sin su coro, sube a respirar: es el momento.', premio: { xp: 0.6, oro: 540 } },
  // ── Acantilados Mágicos ──
  { id: 'x1', zona: 'acantilados', nv: 56, quien: 'Sabia Mama Ocllo', nombre: 'El borde del mundo', tipo: 'caza', k: 'aguila', n: 8,
    pide: 'Derrota a 8 Águilas de Tormenta', inicio: 'Las águilas vigilan el camino al Éter. Hasta que no bajen, ningún duende podrá volar al Núcleo.', fin: 'El cielo queda libre. Desde el borde se ve el Núcleo, y el último pedazo late dentro.', premio: { xp: 0.5, oro: 600, mat: { mithril: 1 } } },
  { id: 'x2', zona: 'acantilados', nv: 58, quien: 'Sabia Mama Ocllo', nombre: 'La chicha del regreso', tipo: 'fabricar', n: 1, k: 'chichaE',
    pide: 'Prepara una Chicha Morada del Duende', inicio: 'Cuando el Cántaro se llene, habrá fiesta en el pueblo. Prepara la primera chicha para el brindis.', fin: 'Guárdala para el día que llegues a nivel 60: ese día, la chicha será de verdad y vendrá a tu casa.', premio: { xp: 0.7, oro: 700, mat: { esencia: 1 } } },
];

// La que toca en una zona: la primera sin hacer de esa zona (si llegas a su nivel).
export function secundariaDe(zona, hechas, nivel) {
  for (const q of SECUNDARIAS) if (q.zona === zona && !(hechas || {})[q.id + ':ok']) return nivel >= q.nv ? q : null;
  return null;
}
