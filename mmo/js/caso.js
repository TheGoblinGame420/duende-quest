// ═══════════════════════════════════════════════════════
// EL CASO DEL TRAIDOR (ORIGINS): datos compartidos por el cliente y el servidor.
//
// Las 12 pistas son objetos de historia que se reciben al cumplir su mision
// secundaria (mmo/js/secundarias.js). Cada una da un premio pequeno una sola vez.
// El estado va en el personaje: c.caso = { p: { p1: 1 }, s: 'grumo', sN: 6, res: 1 }.
// Al cumplir la mision final se resuelve: el titulo es para todos, se haya
// acertado o no, y la sospecha no da premio ni castigo.
// ═══════════════════════════════════════════════════════

export const CASO = { minSospecha: 6, misionFinal: 'x4', cierre: 'x3', logro: 'caso', culpable: 'sisa' };

export const SOSPECHOSOS = [
  { id: 'grumo', nombre: 'Mercader Grumo', emoji: '💰', motivo: 'Es zurdo, vende anís y su maíz llegaba al castillo.', indicio: ['p1', 'p2', 'p3'], duda: ['n9'], motivoDuda: 'Medio pueblo le compra anís.', despeja: 'p7', limpio: 'Cada costal pagó la libertad de un preso.' },
  { id: 'sabio', nombre: 'Sabio Hechicero', emoji: '📖', motivo: 'La página arrancada tiene su letra.', indicio: ['p6', 'p8'], duda: ['s7'], motivoDuda: 'Calla mucho, pero callar no es abrir una puerta.', despeja: 'p11', limpio: 'Fue maestro de un niño. Su culpa fue callar.' },
  { id: 'tito', nombre: 'Guardia Tito', emoji: '🛡', motivo: 'Dejó su puesto y tenía el poncho del hilo morado.', indicio: ['p4'], duda: ['s4'], motivoDuda: 'Un testigo mintió sin querer: era el Chullachaqui.', despeja: 'p10', limpio: 'Lo durmieron. Confesó para cubrir a alguien.' },
  { id: 'sisa', nombre: 'Abuela Sisa', emoji: '👵', indicio: [], duda: ['p12', 'x3'], motivoDuda: 'Una madre del pueblo recibió una carta, y en el camposanto una mesa quedó sola.', despeja: '', limpio: '', coartada: 'a8', notaCoartada: 'Dice que esa noche cantaba en el camposanto, con todos.' },
];

export const PISTAS = [
  { id: 'p1', mision: 'n7', zona: 'noche', nv: 5, tipo: 'Carta', emoji: '✉️', titulo: 'Carta que huele a anís', texto: '«La puerta estará sola cuando canten en el camposanto.»', efecto: 'Apunta a Grumo', pregunta: '¿Quién avisó que la puerta estaría sola?', oro: 25, mat: { hierba: 1 } },
  { id: 'p2', mision: 'n8', zona: 'noche', nv: 5, tipo: 'Huella', emoji: '🪢', titulo: 'El nudo zurdo', texto: 'Lo soltó una mano zurda, sin apuro.', efecto: 'Apunta a Grumo', pregunta: '¿Cómo se abrió un nudo que nadie cortó?', oro: 25, mat: { mineral: 1 } },
  { id: 'p3', mision: 'a5', zona: 'amanecer', nv: 9, tipo: 'Recibo', emoji: '🧾', titulo: 'Cuarenta costales', texto: 'Maíz de Grumo, con sello del Rey.', efecto: 'Apunta a Grumo', pregunta: '¿De quién era el maíz que comía el castillo?', oro: 40, mat: { hierba: 1 } },
  { id: 'p4', mision: 'a6', zona: 'amanecer', nv: 10, tipo: 'Huella', emoji: '🧵', titulo: 'Hilo morado', texto: 'Del poncho de la Guardia. Solo Tito lo tuvo.', efecto: 'Apunta a Tito', pregunta: '¿Qué se quedó enganchado en la puerta?', oro: 40, mat: { mineral: 1 } },
  { id: 'p5', mision: 's4', zona: 'selva', nv: 14, tipo: 'Huella', emoji: '👣', titulo: 'Huellas desparejas', texto: 'El testigo vio al Chullachaqui con la cara de Tito.', efecto: 'Ese testigo no vale. El hilo sigue siendo de Tito', pregunta: '¿De verdad vieron a Tito en la cascada?', oro: 50, mat: { hierba: 2 } },
  { id: 'p6', mision: 's6', zona: 'selva', nv: 16, tipo: 'Carta', emoji: '📄', titulo: 'La página arrancada', texto: 'Cómo se rompe el barro, con letra del Sabio.', efecto: 'Apunta al Sabio', pregunta: '¿Quién sabía cómo se rompe el barro del Cántaro?', oro: 55, mat: { mineral: 2 } },
  { id: 'p7', mision: 't4', zona: 'tormenta', nv: 22, tipo: 'Testimonio', emoji: '⛓️', titulo: 'Cuarenta grilletes', texto: 'Cada costal pagó un preso.', efecto: 'Despeja a Grumo', pregunta: '¿Qué se compraba de verdad con esos costales?', oro: 80, mat: { mineral: 2 } },
  { id: 'p8', mision: 'd4', zona: 'desierto', nv: 30, tipo: 'Carta', emoji: '✒️', titulo: 'La «o» con rulito', texto: 'El Hechicero de la Corte escribe como enseña el Sabio.', efecto: 'Apunta al Sabio', pregunta: '¿Quién escribe las órdenes de la corte?', oro: 110, mat: { hierba: 3 } },
  { id: 'p9', mision: 'c4', zona: 'castillo', nv: 38, tipo: 'Objeto', emoji: '🙂', titulo: 'Carita de yeso', texto: 'Gastada, en la torre del primer Hechicero. La sonrisa va trazada al revés.', efecto: 'Apunta al pueblo, sin nombre', pregunta: '¿Qué guardaba en su torre el primer Hechicero?', oro: 150, mat: { cristal: 1 } },
  { id: 'p10', mision: 'u4', zona: 'cumbres', nv: 44, tipo: 'Testimonio', emoji: '🧣', titulo: 'Tito dormía', texto: 'Tapado con manta; miga con anís y hierba del sueño.', efecto: 'Despeja a Tito', pregunta: '¿Dónde estaba Tito cuando se abrió la puerta?', oro: 190, mat: { cristal: 1 } },
  { id: 'p11', mision: 'v3', zona: 'cavernas', nv: 47, tipo: 'Objeto', emoji: '🪨', titulo: 'La pizarra de Sami', texto: '«Sami, nueve años.» El Sabio fue su maestro.', efecto: 'Despeja al Sabio. El Hechicero era duende', pregunta: '¿Quién era el primer Hechicero antes de serlo?', oro: 210, mat: { flor: 1 } },
  { id: 'p12', mision: 'm3', zona: 'abismo', nv: 52, tipo: 'Carta y testimonio', emoji: '🍾', titulo: 'La botella', texto: '«Señora: su hijo vive.» Y una mesa con un sitio vacío, que la noche de la puerta se quedó sin nadie.', efecto: 'Apunta a una madre', pregunta: '¿Qué le prometieron a quien abrió la puerta?', oro: 240, mat: { flor: 1 } },
];

// Apuntes del cuaderno: lo que se oyo en una mision que no da pista. Sin premio y sin campos nuevos:
// se ven con '<mision>:ok'. No cuentan en las 12 pistas.
export const APUNTES = [
  { mision: 'n9', emoji: '🌿', titulo: 'Anís para medio pueblo', texto: 'Grumo le vende a Tito, a Lila, a la Abuela y al Sabio.', efecto: 'El olor a anís no señala solo a Grumo' },
  { mision: 'a8', emoji: '🕯️', titulo: 'Cantaba en el camposanto', texto: 'La Abuela dice que esa noche estaba allí, con todos.', efecto: 'Coartada de la Abuela Sisa', efectoRes: 'Era mentira: esa noche no cantó' },
  { mision: 'x1', emoji: '📒', titulo: 'Anís por costal', texto: 'Las cuentas de Grumo: por puñados compra medio pueblo. Por costal, solo quien hornea para todos.', efecto: 'Apunta a un horno' },
  { mision: 'x2', emoji: '🥖', titulo: 'La sonrisa al revés', texto: 'Los panes del horno de la plaza llevan la sonrisa trazada como la carita de yeso: con la zurda.', efecto: 'Apunta a una mano zurda que no es la de Grumo' },
];

const PISTA_MISION = Object.fromEntries(PISTAS.map(p => [p.mision, p]));
export function pistaDeMision(id) { return PISTA_MISION[id] || null; }

export function estadoCaso(c) {
  const k = c && c.caso && typeof c.caso === 'object' ? c.caso : {};
  const p = k.p && typeof k.p === 'object' ? k.p : {};
  return { p: PISTAS.filter(x => p[x.id]).map(x => x.id), s: SOSPECHOSOS.some(x => x.id === k.s) ? k.s : '', sN: +k.sN || 0, res: k.res ? 1 : 0 };
}

// Estado que se ve en cada cara. `hallada`: el id de una pista o de una mision ya cumplida.
export function estadoSospechoso(q, hallada, res) {
  const esCulpable = q.id === CASO.culpable;
  if (esCulpable && res) return { k: 'culpable', txt: 'Fue ella', nota: 'Desató el nudo con la zurda, por su hijo.' };
  if (res || (q.despeja && hallada(q.despeja))) return { k: 'limpio', txt: 'Despejado', nota: q.limpio };
  if (q.duda.some(hallada)) return { k: 'duda', txt: esCulpable ? 'Sospechosa' : 'Dudoso', nota: q.motivoDuda };
  if (q.coartada && hallada(q.coartada)) return { k: 'nadie', txt: 'Tiene coartada', nota: q.notaCoartada };
  // Sin pista en contra los cuatro se ven igual: la ficha no puede delatar a nadie por su trato.
  if (!q.indicio.some(hallada)) return { k: 'nadie', txt: 'Sabía el nudo', nota: 'Aún no hay pista en su contra.' };
  return { k: 'sospecha', txt: 'Sospechoso', nota: q.motivo };
}

// Lo que se cuenta al resolver el caso. CASO.cierre: tras esa mision la propia Sisa confiesa, asi que la sospecha queda fija.
export const VERDAD = [
  'Fue la Abuela Sisa. Su hijo Sami desapareció de niño en una incursión goblin, y durante años unas cartas sin firma le dijeron: «Su hijo vive. Abra la puerta la noche de las almas».',
  'Las dictaba el Rey y las copiaba un aprendiz de la corte, con la misma «o» de rulito que Sami les enseñó. Por eso ella creyó. Y ella misma avisó a los goblins: su carta olía a anís por su horno, no por la tienda de Grumo.',
  'En Todos los Santos, con el pueblo cantando en el camposanto, su mesa quedó sola. Llevó a su nieto Tito pan con anís y hierba del sueño y lo tapó con una manta. Se puso el poncho de él, que le arrastraba: ahí quedó el hilo morado. Desató el nudo con la zurda.',
  'Sami no volvió. Criado en la corte, fue el primer Hechicero, y le enseñó al Rey a romper el barro con la página que de niño arrancó del libro de su maestro. Le escribió «Mamá: no abras la puerta», pero esa carta nunca salió. Al final robó el último pedazo y voló con él: cayó en el borde, y el Dragón se quedó con el pedazo.',
  'Grumo compraba presos con sus costales. El Sabio solo calló. Tito confesó para protegerla.',
  'Sisa lo dijo delante de todos y paga trabajando: enseña la receta. Ama llulla, no mentir. Ayni, devolver lo recibido.',
];

export function reaccionCaso(s, sN) {
  const q = SOSPECHOSOS.find(x => x.id === s);
  if (!q) return 'No señalaste a nadie. Tampoco el pueblo se atrevía.';
  if (q.id === CASO.culpable) return `Tu sospecha fue ${q.nombre}, con ${sN || CASO.minSospecha} pistas de ${PISTAS.length}. Acertaste cuando nadie la miraba.`;
  return `Tu sospecha fue ${q.nombre}, con ${sN || CASO.minSospecha} pistas de ${PISTAS.length}. Medio pueblo pensó igual: para eso estaba hecho el engaño.`;
}
