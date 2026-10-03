// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — datos compartidos cliente/servidor
// Lo importan mmo/js/client.js (navegador) y functions/mmo/world.js
// (Durable Object): un solo lugar para mapas, monstruos, precios y
// formulas, asi el servidor valida exactamente lo que el cliente muestra.
// ═══════════════════════════════════════════════════════

export const VW = 800;          // ancho logico de la vista
export const VH = 450;          // alto logico de la vista
export const SUELO = 400;       // y de los pies sobre el suelo, en todos los mapas
export const NIVEL_MAX = 60;
export const TICK_MS = 100;     // simulacion del servidor a 10 Hz

// Fisica del jugador (por fotograma a 60 fps). El servidor solo la usa para
// validar que nadie se mueva mas rapido de lo posible.
export const FIS = {
  grav: 0.6, salto: -11.5, dobleSalto: -10, vel: 3.6, dashVel: 11, dashT: 10, dashCd: 50,
  jugW: 36, jugH: 58,
};

// ── HOJAS DE ANIMACION (mismas celdas que js/engine.js) ──
// fila 0 = caminar, fila 1 = [golpe..., muerte...]
// izq: 1 = el dibujo original mira a la izquierda (se espeja al reves).
export const HOJAS = {
  goblin_normal:     { fw: 32, fh: 64, ideal: 33, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  esqueleto:         { fw: 32, fh: 64, ideal: 45, mov: [0, 0, 6], golpe: [1, 0, 2], muerte: [2, 3] },
  goblin_samurai:    { fw: 32, fh: 64, ideal: 34, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  goblin_mage:       { fw: 32, fh: 64, ideal: 36, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  hongo:             { fw: 29, fh: 28, ideal: 24, mov: [0, 0, 6], golpe: [1, 0, 1], muerte: [1, 6] },
  goblin_peasant:    { fw: 32, fh: 64, ideal: 35, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  goblin_assassin:   { fw: 32, fh: 64, ideal: 33, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  lagarto:           { fw: 64, fh: 32, ideal: 17, mov: [0, 0, 6], golpe: [1, 0, 3], muerte: [3, 1] },
  goblin_centurion:  { fw: 32, fh: 64, ideal: 38, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  goblin_battlelord: { fw: 32, fh: 64, ideal: 35, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  serpiente:         { fw: 27, fh: 20, ideal: 18, mov: [0, 0, 4], golpe: [1, 0, 3], muerte: [3, 1] },
  ghoul_ardiente:    { fw: 57, fh: 60, ideal: 47, mov: [0, 0, 7], golpe: [1, 0, 2], muerte: [2, 1] },
  hechicero:         { fw: 81, fh: 66, ideal: 53, mov: [0, 0, 5], golpe: [1, 0, 3], muerte: [3, 1] },
  angel:             { fw: 122, fh: 117, ideal: 85, mov: [0, 0, 8], golpe: [1, 0, 2], muerte: [2, 1] },
  goblin_guard:      { fw: 32, fh: 64, ideal: 35, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  goblin_knight:     { fw: 32, fh: 64, ideal: 38, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  rana:              { fw: 53, fh: 42, ideal: 34, mov: [0, 0, 10], golpe: [1, 0, 2], muerte: [2, 1] },
  fantasma:          { fw: 64, fh: 64, ideal: 36, mov: [0, 0, 6], golpe: [1, 0, 2], muerte: [2, 1] },
  pajaro:            { fw: 32, fh: 32, ideal: 25, mov: [0, 0, 7], golpe: [1, 0, 2], muerte: [2, 1] },
  conejo:            { fw: 34, fh: 44, ideal: 38, mov: [0, 0, 6], golpe: [1, 0, 2], muerte: [2, 1] },
  hellhound:         { fw: 67, fh: 39, ideal: 39, mov: [0, 0, 5], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  // Solo del MMO: el rey goblin (tools/generar_goblin_lord_cc0.py).
  goblin_lord:       { fw: 32, fh: 64, ideal: 35, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
  // Gran expansion Nv 40-60 (tools/generar_mmo_expansion_cc0.py)
  murcielago:        { fw: 117, fh: 128, ideal: 128, mov: [0, 0, 3], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  arana:             { fw: 29, fh: 19, ideal: 19, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  hellgato:          { fw: 85, fh: 36, ideal: 36, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  esqueleto_capa:    { fw: 32, fh: 45, ideal: 45, mov: [0, 0, 8], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  coloso:            { fw: 84, fh: 121, ideal: 121, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  cangrejo:          { fw: 28, fh: 30, ideal: 30, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  saltador:          { fw: 35, fh: 28, ideal: 28, mov: [0, 0, 5], golpe: [1, 0, 2], muerte: [2, 1] },
  pulpo:             { fw: 25, fh: 31, ideal: 31, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  cosa:              { fw: 24, fh: 38, ideal: 38, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  pez:               { fw: 27, fh: 20, ideal: 20, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  pez_dardo:         { fw: 34, fh: 13, ideal: 13, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  pez_grande:        { fw: 47, fh: 40, ideal: 40, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  espectro:          { fw: 27, fh: 44, ideal: 44, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  baba:              { fw: 64, fh: 76, ideal: 76, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  aguila:            { fw: 36, fh: 39, ideal: 39, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  zarigueya:         { fw: 35, fh: 26, ideal: 26, mov: [0, 0, 6], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
  fantasma_halo:     { fw: 35, fh: 58, ideal: 58, mov: [0, 0, 4], golpe: [1, 0, 2], muerte: [2, 1] },
  dragon:            { fw: 180, fh: 161, ideal: 161, mov: [0, 0, 9], golpe: [1, 0, 2], muerte: [2, 1], izq: 1 },
};

// ── MONSTRUOS ──
// Las estadisticas salen de stats(nivel) salvo que se indiquen; alto = altura
// en pantalla del dibujo (no de la caja de choque).
export const MONSTRUOS = {
  goblin_normal:     { nombre: 'Goblin',            hoja: 'goblin_normal',     nivel: 1 },
  esqueleto:         { nombre: 'Esqueleto',         hoja: 'esqueleto',         nivel: 2 },
  goblin_assassin:   { nombre: 'Goblin Asesino',    hoja: 'goblin_assassin',   nivel: 3, vel: 1.3 },
  fantasma:          { nombre: 'Fantasma',          hoja: 'fantasma',          nivel: 4, vuela: true },
  hechicero:         { nombre: 'Hechicero',         hoja: 'hechicero',         nivel: 5, dispara: true },
  goblin_peasant:    { nombre: 'Goblin Campesino',  hoja: 'goblin_peasant',    nivel: 7 },
  goblin_guard:      { nombre: 'Goblin Guardia',    hoja: 'goblin_guard',      nivel: 8 },
  pajaro:            { nombre: 'Pájaro Hueso',      hoja: 'pajaro',            nivel: 9, vuela: true },
  goblin_knight:     { nombre: 'Goblin Caballero',  hoja: 'goblin_knight',     nivel: 11 },
  hongo:             { nombre: 'Hongo Gigante',     hoja: 'hongo',             nivel: 13, vel: .7 },
  rana:              { nombre: 'Rana de Charca',    hoja: 'rana',              nivel: 14 },
  goblin_centurion:  { nombre: 'Goblin Centurión',  hoja: 'goblin_centurion',  nivel: 15 },
  goblin_battlelord: { nombre: 'Goblin Señor',      hoja: 'goblin_battlelord', nivel: 17 },
  goblin_mage:       { nombre: 'Goblin Mago',       hoja: 'goblin_mage',       nivel: 19, dispara: true },
  esqueleto_arcano:  { nombre: 'Esqueleto Arcano',  hoja: 'esqueleto',         nivel: 20, tinte: '#c084fc' },
  ghoul_ardiente:    { nombre: 'Ghoul Ardiente',    hoja: 'ghoul_ardiente',    nivel: 22, vel: 1.2 },
  goblin_samurai:    { nombre: 'Goblin Samurái',    hoja: 'goblin_samurai',    nivel: 25 },
  lagarto:           { nombre: 'Lagarto',           hoja: 'lagarto',           nivel: 26, vel: 1.2 },
  serpiente:         { nombre: 'Serpiente',         hoja: 'serpiente',         nivel: 27 },
  conejo:            { nombre: 'Conejo Salvaje',    hoja: 'conejo',            nivel: 28, vel: 1.4 },
  // Castillo del Rey Goblin (final de juego): el bestiario de siempre con
  // armaduras de la corte (tintes propios).
  guardia_real:      { nombre: 'Guardia Real',      hoja: 'goblin_guard',      nivel: 33, tinte: '#ffd84a' },
  caballero_negro:   { nombre: 'Caballero Negro',   hoja: 'goblin_knight',     nivel: 35, tinte: '#6b21a8', vel: 1.2 },
  esqueleto_real:    { nombre: 'Esqueleto Real',    hoja: 'esqueleto',         nivel: 36, tinte: '#ffd84a' },
  hechicero_corte:   { nombre: 'Hechicero de la Corte', hoja: 'hechicero',     nivel: 38, tinte: '#00eeff', dispara: true },
  // Cumbres del Ocaso (Nv 40-45)
  murcielago:        { nombre: 'Murciélago Vampiro', hoja: 'murcielago',     nivel: 41, vuela: true, alto: 58 },
  arana:             { nombre: 'Araña de Ceniza',    hoja: 'arana',          nivel: 42, vel: 1.25, alto: 40 },
  esqueleto_capa:    { nombre: 'Esqueleto Errante',  hoja: 'esqueleto_capa', nivel: 43 },
  hellgato:          { nombre: 'Gato Infernal',      hoja: 'hellgato',       nivel: 44, vel: 1.45, alto: 50 },
  // Cavernas Abisales (Nv 45-50)
  cangrejo:          { nombre: 'Cangrejo de Cristal', hoja: 'cangrejo',      nivel: 46, alto: 54 },
  saltador:          { nombre: 'Saltarín Abisal',    hoja: 'saltador',       nivel: 47, vel: 1.3, alto: 50 },
  pulpo:             { nombre: 'Pulpo Brujo',        hoja: 'pulpo',          nivel: 48, vuela: true, dispara: true, alto: 56 },
  cosa:              { nombre: 'Cosa del Pantano',   hoja: 'cosa',           nivel: 49 },
  // Abismo Marino (Nv 50-55)
  pez:               { nombre: 'Piraña Abisal',      hoja: 'pez',            nivel: 51, vuela: true, alto: 40 },
  pez_dardo:         { nombre: 'Pez Dardo',          hoja: 'pez_dardo',      nivel: 52, vuela: true, vel: 1.5, alto: 28 },
  baba:              { nombre: 'Babosa Abisal',      hoja: 'baba',           nivel: 53, vel: .8, alto: 58 },
  espectro:          { nombre: 'Espectro Marino',    hoja: 'espectro',       nivel: 54, vuela: true, dispara: true },
  pez_grande:        { nombre: 'Pez Ogro',           hoja: 'pez_grande',     nivel: 55, vuela: true, alto: 60 },
  // Acantilados Magicos (Nv 55-60)
  zarigueya:         { nombre: 'Zarigüeya Salvaje',  hoja: 'zarigueya',      nivel: 56, vel: 1.35, alto: 46 },
  aguila:            { nombre: 'Águila de Tormenta', hoja: 'aguila',         nivel: 57, vuela: true, alto: 56 },
  fantasma_halo:     { nombre: 'Alma Errante',       hoja: 'fantasma_halo',  nivel: 58, vuela: true, dispara: true },
  paladin_goblin:    { nombre: 'Paladín Goblin',     hoja: 'goblin_lord',    nivel: 59, tinte: '#00eeff' },
  // Jefes: uno por zona, reaparecen solos cada cierto tiempo.
  jefe_sabueso:  { nombre: 'Sabueso Infernal',       hoja: 'hellhound',         nivel: 8,  jefe: true, alto: 110, hpX: 14, atkX: 1.4, w: 150, h: 70 },
  jefe_caballero:{ nombre: 'Rey Goblin Caballero',   hoja: 'goblin_knight',     nivel: 14, jefe: true, alto: 130, hpX: 16, atkX: 1.4, w: 70, h: 120, tinte: '#ff6444' },
  jefe_senor:    { nombre: 'Señor de la Guerra',     hoja: 'goblin_battlelord', nivel: 20, jefe: true, alto: 135, hpX: 18, atkX: 1.5, w: 70, h: 125, tinte: '#00ffcc' },
  jefe_ghoul:    { nombre: 'Ghoul Infernal',         hoja: 'ghoul_ardiente',    nivel: 26, jefe: true, alto: 130, hpX: 20, atkX: 1.5, w: 110, h: 120, tinte: '#ff9900', dispara: true },
  jefe_angel:    { nombre: 'Ángel Caído',            hoja: 'angel',             nivel: 32, jefe: true, alto: 150, hpX: 24, atkX: 1.6, w: 110, h: 140, vuela: true, dispara: true },
  jefe_rey:      { nombre: 'Rey Goblin',             hoja: 'goblin_lord',       nivel: 42, jefe: true, alto: 150, hpX: 26, atkX: 1.6, w: 70, h: 135, tinte: '#ffd84a', dispara: true },
  jefe_coloso:   { nombre: 'Coloso de Hueso',        hoja: 'coloso',            nivel: 48, jefe: true, alto: 165, hpX: 28, atkX: 1.6, w: 90, h: 150 },
  jefe_cangrejo: { nombre: 'Rey Cangrejo',           hoja: 'cangrejo',          nivel: 53, jefe: true, alto: 140, hpX: 30, atkX: 1.65, w: 130, h: 125, tinte: '#ff3cf0', dispara: true },
  jefe_leviatan: { nombre: 'Leviatán',               hoja: 'pez_grande',        nivel: 58, jefe: true, alto: 150, hpX: 32, atkX: 1.7, w: 170, h: 120, vuela: true, tinte: '#00eeff', dispara: true },
  jefe_dragon:   { nombre: 'Dragón Ancestral',       hoja: 'dragon',            nivel: 64, jefe: true, alto: 175, hpX: 36, atkX: 1.8, w: 170, h: 130, vuela: true, dispara: true },
  // Jefe mundial: aparece cada 30 min en el Coliseo para TODOS los niveles.
  // Su daño es un % de la vida de cada jugador (no su ataque), asi un Nv 5 y
  // un Nv 60 pelean juntos; su vida crece con los jugadores conectados.
  jefe_mundial:  { nombre: 'Gran Duende Corrupto',   hoja: 'goblin_lord',       nivel: 30, jefe: true, mundial: true, alto: 230, w: 100, h: 200, tinte: '#5a0f96', dispara: true },
};

export function statsMonstruo(key) {
  const m = MONSTRUOS[key];
  const L = m.nivel;
  const hp = Math.round((30 + 15 * L) * (m.hpX || 1));
  // 6+4L mataba a un nivel 1 en 6 golpes de un Nv3. Con 4+3L seguia siendo
  // facil morir: el ataque crecia mas rapido que la vida del jugador y desde
  // Nv 20 un monstruo de tu nivel te tumbaba en ~10 golpes. Con 4+2,4L (y la
  // vida a +30/nivel) uno de tu nivel necesita ~20 golpes en todo el juego.
  const atk = Math.round((4 + 2.4 * L) * (m.atkX || 1));
  const xp = Math.round((5 + 4 * L) * (m.jefe ? 12 : 1));
  const oro = Math.round((2 + 2 * L) * (m.jefe ? 25 : 1));
  return {
    hp, atk, xp, oro,
    vel: (m.vel || 1) * (m.jefe ? 1.5 : 1.1),
    w: m.w || (m.vuela ? 40 : 38), h: m.h || (m.vuela ? 40 : 56),
    alto: m.alto || 62,
  };
}

// ── PROGRESION DEL JUGADOR ──
export function xpParaSubir(nivel) { return Math.round(40 * Math.pow(nivel, 1.5)); }
export function statsJugador(nivel, skin, eq) {
  const b = (SKINS[skin] && SKINS[skin].buffs) || {};
  const e = bonoEquipo(eq);
  return {
    maxHp: 100 + 30 * (nivel - 1) + (b.bonusHp || 0) * Math.max(1, Math.floor(nivel / 5)) + e.hp,
    atk: Math.round((10 + 3 * (nivel - 1) + e.atk) * (b.atkMult || 1)),
    def: Math.floor(nivel * 1.5) + e.def,
    crit: 0.12 + e.crit,
  };
}

// ── EQUIPO ──
// Cinco ranuras. Los objetos los sueltan los monstruos (los jefes siempre) y
// los genera el servidor: el cliente solo los muestra. La rareza sale al
// azar al soltarse, pero NUNCA se compra con dinero ni con oro (nada de
// cajas de pago): se consigue jugando.
export const RANURAS = {
  casco:    { nombre: 'Casco',    iconos: ['C_Hat01', 'C_Hat02', 'C_Elm01', 'C_Elm03', 'C_Elm04'],
              nombres: ['Gorro de Tela', 'Gorro de Cuero', 'Yelmo de Hierro', 'Yelmo Rúnico', 'Yelmo Dracónico'] },
  armadura: { nombre: 'Armadura', iconos: ['A_Clothing01', 'A_Armour01', 'A_Armour02', 'A_Armor04', 'A_Armor05'],
              nombres: ['Túnica de Duende', 'Coraza de Cuero', 'Cota de Malla', 'Armadura Rúnica', 'Armadura Dracónica'] },
  botas:    { nombre: 'Botas',    iconos: ['A_Shoes01', 'A_Shoes03', 'A_Shoes05', 'A_Shoes06', 'A_Shoes07'],
              nombres: ['Sandalias', 'Botas de Cuero', 'Grebas de Hierro', 'Botas Rúnicas', 'Botas Dracónicas'] },
  anillo:   { nombre: 'Anillo',   iconos: ['Ac_Ring01', 'Ac_Ring02', 'Ac_Medal01', 'Ac_Medal02', 'Ac_Medal04'],
              nombres: ['Anillo de Cobre', 'Anillo de Plata', 'Sello de Oro', 'Sello Rúnico', 'Sello Dracónico'] },
  amuleto:  { nombre: 'Amuleto',  iconos: ['Ac_Necklace01', 'Ac_Necklace03', 'Ac_Necklace05', 'Ac_Necklace07', 'Ac_Necklace08'],
              nombres: ['Colgante de Hueso', 'Amuleto de Jade', 'Amuleto de Rubí', 'Amuleto Rúnico', 'Amuleto Dracónico'] },
};
export const RAREZAS = [
  { nombre: 'Común',      color: '#d0d0d0', mult: 1,    peso: 64 },
  { nombre: 'Raro',       color: '#33aaff', mult: 1.35, peso: 26 },
  { nombre: 'Épico',      color: '#c084fc', mult: 1.8,  peso: 8.5 },
  { nombre: 'Legendario', color: '#ffae00', mult: 2.5,  peso: 1.5 },
];
export const BOLSA_MAX = 40;
export const tierItem = nv => Math.max(0, Math.min(4, Math.floor((nv - 1) / 12)));
// Estadisticas base por ranura (antes de rareza y bonus).
export function baseItem(ranura, nv) {
  switch (ranura) {
    // Medido a Nv 40: un juego completo comun suma ~36 DEF, ~360 VIDA y ~23
    // ATQ (un +25-30%); uno epico casi el doble. Mas que eso volvia al
    // jugador inmune (la defensa resta 0,6x al golpe de los monstruos).
    case 'casco':    return { def: 1 + nv * 0.25, hp: nv * 2 };
    case 'armadura': return { def: 2 + nv * 0.4, hp: nv * 3 };
    case 'botas':    return { def: 1 + nv * 0.15, hp: nv * 1.5 };
    case 'anillo':   return { atk: 1 + nv * 0.35 };
    case 'amuleto':  return { atk: nv * 0.2, hp: nv * 2.5, crit: 0.01 };
  }
  return {};
}
export function nombreItem(it) { const r = RANURAS[it.s]; return r ? r.nombres[tierItem(it.nv)] : '?'; }
export function iconoItem(it) { const r = RANURAS[it.s]; return r ? r.iconos[tierItem(it.nv)] : 'I_Chest01'; }
export function precioVenta(it) { return Math.round((20 + it.nv * 6) * Math.pow(RAREZAS[it.r].mult, 2)); }
export function bonoEquipo(eq) {
  const t = { hp: 0, atk: 0, def: 0, crit: 0 };
  if (!eq) return t;
  for (const k in eq) {
    const it = eq[k];
    if (!it || !it.b) continue;
    t.hp += it.b.hp || 0; t.atk += it.b.atk || 0; t.def += it.b.def || 0; t.crit += it.b.crit || 0;
  }
  t.crit = Math.min(0.35, t.crit);
  return t;
}
export function textoBonos(b) {
  const l = [];
  if (b.atk) l.push('+' + b.atk + ' ATQ');
  if (b.def) l.push('+' + b.def + ' DEF');
  if (b.hp) l.push('+' + b.hp + ' VIDA');
  if (b.crit) l.push('+' + Math.round(b.crit * 100) + '% CRÍT');
  return l.join(' · ');
}

// ── HABILIDADES (se aprenden solas al subir de nivel) ──
export const HABILIDADES = [
  { id: 'torbellino', nombre: 'Torbellino',         nv: 10, cd: 6000,  icono: 'S_Wind02',   tecla: 'C', desc: 'Giras con la espada y dañas a todo lo que te rodea (x2,2).' },
  { id: 'estocada',   nombre: 'Estocada Fantasma',  nv: 20, cd: 9000,  icono: 'S_Shadow05', tecla: 'V', desc: 'Un tajo enorme atraviesa a los enemigos de delante (x3).' },
  { id: 'meteoro',    nombre: 'Lluvia de Meteoros', nv: 30, cd: 18000, icono: 'S_Fire05',   tecla: 'B', desc: 'Llueven meteoros sobre todo lo que ves (x3,5).' },
  { id: 'furia',      nombre: 'Furia del Duende',   nv: 45, cd: 45000, icono: 'S_Buff03',   tecla: 'N', desc: '10 s con +50% de ataque y robo de vida del 15%.' },
];
export const FURIA_MS = 10000;

// ── RECOMPENSA DIARIA (racha de 7 dias; si faltas un dia vuelve al 1) ──
export const LOGIN_PREMIOS = [
  { oro: 300, txt: '300 oro' },
  { pw: { pocion: 5 }, txt: '5 pociones' },
  { oro: 800, txt: '800 oro' },
  { pw: { escudo: 2, rayo: 1 }, txt: '2 escudos y 1 rayo' },
  { oro: 1500, txt: '1.500 oro' },
  { pw: { fuego: 2, rayo: 2 }, txt: '2 fuegos y 2 rayos' },
  { oro: 3000, item: 2, txt: '3.000 oro + objeto ÉPICO' },
];
// El oro de la racha crece con el nivel (a Nv 40 vale x4).
export const multLogin = nivel => Math.max(1, Math.floor(nivel / 10));

// ── LOGROS Y TITULOS ──
// El titulo elegido se ve sobre el nombre del duende.
export const LOGROS = [
  { id: 'caza100',   titulo: 'Cazador',            desc: 'Caza 100 monstruos',             oro: 500,   cond: c => c.kills >= 100 },
  { id: 'caza1000',  titulo: 'Exterminador',       desc: 'Caza 1.000 monstruos',           oro: 3000,  cond: c => c.kills >= 1000 },
  { id: 'caza5000',  titulo: 'Leyenda de la Caza', desc: 'Caza 5.000 monstruos',           oro: 12000, cond: c => c.kills >= 5000 },
  { id: 'jefe1',     titulo: 'Matajefes',          desc: 'Derrota a tu primer jefe',       oro: 500,   cond: c => c.jefes >= 1 },
  { id: 'jefe25',    titulo: 'Azote de Jefes',     desc: 'Derrota 25 jefes',               oro: 6000,  cond: c => c.jefes >= 25 },
  { id: 'nv20',      titulo: 'Aventurero',         desc: 'Llega a nivel 20',               oro: 1500,  cond: c => c.nivel >= 20 },
  { id: 'nv40',      titulo: 'Héroe del Reino',    desc: 'Llega a nivel 40',               oro: 6000,  cond: c => c.nivel >= 40 },
  { id: 'nv60',      titulo: 'Duende Supremo',     desc: 'Llega a nivel 60 (el máximo)',   oro: 25000, cond: c => c.nivel >= 60 },
  { id: 'forja10',   titulo: 'Herrero Maestro',    desc: 'Forja un arma a +10',            oro: 5000,  cond: c => Object.values(c.forja || {}).some(n => n >= 10) },
  { id: 'skins',     titulo: 'Coleccionista',      desc: 'Consigue las 6 skins',           oro: 10000, cond: c => (c.skins || []).length >= 6 },
  { id: 'misiones',  titulo: 'Leyenda del Pueblo', desc: 'Completa todas las misiones',    oro: 20000, cond: c => ((c.mis || {}).i || 0) >= MISIONES.length },
  { id: 'mundial1',  titulo: 'Cazador de Titanes', desc: 'Vence al jefe mundial',          oro: 2000,  cond: c => (c.mundiales || 0) >= 1 },
  { id: 'mundial10', titulo: 'Titán',              desc: 'Vence 10 veces al jefe mundial', oro: 15000, cond: c => (c.mundiales || 0) >= 10 },
  { id: 'legend',    titulo: 'Bendecido',          desc: 'Consigue un objeto legendario',  oro: 3000,  cond: c => !!c.tuvoLegendario },
  { id: 'racha7',    titulo: 'Fiel al Duende',     desc: 'Entra 7 días seguidos',          oro: 3000,  cond: c => ((c.login || {}).racha || 0) >= 7 },
  { id: 'equipo5',   titulo: 'Bien Equipado',      desc: 'Lleva puestas las 5 piezas de equipo', oro: 2000, cond: c => Object.keys(RANURAS).every(k => c.eq && c.eq[k]) },
];

// ── JEFE MUNDIAL ──
export const MUNDIAL_CADA_MS = 30 * 60 * 1000;   // a las :00 y :30 (UTC)
export const MUNDIAL_DURA_MS = 10 * 60 * 1000;
export const proximoMundial = ahora => Math.ceil(ahora / MUNDIAL_CADA_MS) * MUNDIAL_CADA_MS;

// ── SKINS (las mismas 7 del juego, con sus mismos poderes) ──
// Se compran con oro del MMO. Las que ya se pagaron con dinero real en el
// juego principal se desbloquean solas (ver world.js, skinsPagadas()).
export const SKINS = {
  comun:      { nombre: 'Duende',      img: 'skin_hero',           precio: 0,      color: '#00eeff', buffs: null, desc: 'El duende de siempre' },
  tactico:    { nombre: 'Táctico',     img: 'skin_tactico',        precio: 3000,   color: '#00ff88', buffs: { oroMult: 1.1 }, desc: '+10% oro' },
  necro:      { nombre: 'Necromancer', img: 'skin_necromancer',    precio: 9000,   color: '#b44cff', buffs: { oroMult: 1.2, robo: .05 }, desc: '+20% oro · roba 5% de vida' },
  king:       { nombre: 'King',        img: 'skin_king',           precio: 20000,  color: '#ffd84a', buffs: { oroMult: 1.3, bonusHp: 20 }, desc: '+30% oro · +HP extra' },
  berserker:  { nombre: 'Berserker',   img: 'skin_berserker',      precio: 45000,  color: '#ff3344', buffs: { oroMult: 1.4, atkMult: 1.3 }, desc: '+40% oro · +30% ataque' },
  legendaria: { nombre: 'Legendaria',  img: 'skin_legendariafull', precio: 100000, color: '#ff3cf0', buffs: { oroMult: 1.5, bonusHp: 50, aura: true }, desc: '+50% oro · +HP · aura que quema' },
};

// ── ARMAS (las 4 del juego, mismos multiplicadores) ──
export const ARMAS = {
  katana: { nombre: 'Katana', precio: 0,    alcance: 1,   cd: 1,   dano: 1,   color: '#ffe600', icono: 'katana_comun', desc: 'Equilibrada' },
  // dano/cd = daño por segundo relativo: katana 1, dagas .96, odachi 1.21 (pero
  // lenta), chispa 1.05 + 50% al segundo enemigo. Mismo reparto que el arcade.
  dagas:  { nombre: 'Dagas',  precio: 600,  alcance: .8,  cd: .5,  dano: .48, color: '#c084fc', icono: 'katana_comun', desc: 'Rapidísimas' },
  odachi: { nombre: 'Odachi', precio: 2000, alcance: 1.5, cd: 1.4, dano: 1.7, color: '#ffffff', icono: 'katana_comun', desc: 'Lenta, alcance enorme' },
  chispa: { nombre: 'Chispa', precio: 5000, alcance: 1,   cd: 1,   dano: 1.05, color: '#00eeff', icono: 'katana_spark', desc: 'El rayo salta a otro enemigo' },
};
// Forja: cada arma sube de +0 a +10 pagando oro, +7% de daño por nivel.
// Siempre sale bien (nada de azar ni de perder el arma): es una meta de oro
// a largo plazo, no una apuesta.
export const FORJA_MAX = 10;
export const costoForja = n => Math.round(150 * Math.pow(1.7, n));   // de +n a +n+1
export const multForja = n => 1 + 0.07 * (n || 0);
export const ATAQUE_CD_MS = 330;          // x arma.cd
export const ALCANCE_BASE = [55, 65, 85]; // por paso de combo, x arma.alcance
export const COMBO_MULT = [1, 1.15, 1.45];

// ── PODERES (los 4 objetos del juego) ──
export const PODERES = [
  { id: 'pocion', nombre: 'Poción',  icono: 'item_potion', precio: 30,  cd: 3000,  desc: 'Cura el 50% de la vida' },
  { id: 'escudo', nombre: 'Escudo',  icono: 'item_shield', precio: 120, cd: 20000, desc: 'Invulnerable 5 segundos' },
  { id: 'rayo',   nombre: 'Rayo',    icono: 'item_skill',  precio: 350, cd: 15000, desc: 'Fulmina a todo lo que esté cerca' },
  { id: 'fuego',  nombre: 'Fuego',   icono: 'skill_fire',  precio: 200, cd: 20000, desc: 'Golpes de fuego (+50%) por 8 s' },
];

// ── MISIONES ──
// Una cadena que recorre el mundo en orden: cada zona pide cazar a sus
// criaturas y cierra con su jefe. Se aceptan y entregan al Guardia Tito del
// pueblo. La recompensa ronda lo que da la propia caza, asi que se nota
// pero no reemplaza a jugar.
export const MISIONES = [
  { nombre: 'Limpieza nocturna',        tipo: 'goblin_normal',     n: 8,  xp: 60,    oro: 80 },
  { nombre: 'Huesos inquietos',         tipo: 'esqueleto',         n: 10, xp: 130,   oro: 150 },
  { nombre: 'Cazador de sombras',       tipo: 'goblin_assassin',   n: 8,  xp: 170,   oro: 200, pw: { pocion: 3 } },
  { nombre: 'Aullido infernal',         tipo: 'jefe_sabueso',      n: 1,  xp: 500,   oro: 600, pw: { escudo: 2 } },
  { nombre: 'Campesinos rebeldes',      tipo: 'goblin_peasant',    n: 10, xp: 280,   oro: 330 },
  { nombre: 'La guardia roja',          tipo: 'goblin_guard',      n: 10, xp: 330,   oro: 380 },
  { nombre: 'Plumas de hueso',          tipo: 'pajaro',            n: 8,  xp: 340,   oro: 400, pw: { fuego: 1 } },
  { nombre: 'La corona del caballero',  tipo: 'jefe_caballero',    n: 1,  xp: 1200,  oro: 1400, pw: { rayo: 2 } },
  { nombre: 'Esporas gigantes',         tipo: 'hongo',             n: 10, xp: 500,   oro: 560 },
  { nombre: 'Coro de la charca',        tipo: 'rana',              n: 10, xp: 550,   oro: 600 },
  { nombre: 'Tambores de guerra',       tipo: 'goblin_battlelord', n: 8,  xp: 560,   oro: 650, pw: { pocion: 5 } },
  { nombre: 'El Señor de la Guerra',    tipo: 'jefe_senor',        n: 1,  xp: 2500,  oro: 2800, pw: { escudo: 2, rayo: 1 } },
  { nombre: 'Magia prohibida',          tipo: 'goblin_mage',       n: 10, xp: 700,   oro: 800 },
  { nombre: 'Huesos arcanos',           tipo: 'esqueleto_arcano',  n: 10, xp: 760,   oro: 860 },
  { nombre: 'Fuego que camina',         tipo: 'ghoul_ardiente',    n: 8,  xp: 700,   oro: 900, pw: { fuego: 2 } },
  { nombre: 'El Ghoul Infernal',        tipo: 'jefe_ghoul',        n: 1,  xp: 4000,  oro: 4500, pw: { rayo: 2, escudo: 2 } },
  { nombre: 'Filo del desierto',        tipo: 'goblin_samurai',    n: 10, xp: 900,   oro: 1100 },
  { nombre: 'Escamas al sol',           tipo: 'lagarto',           n: 10, xp: 950,   oro: 1150 },
  { nombre: 'Conejos salvajes',         tipo: 'conejo',            n: 10, xp: 1000,  oro: 1200, pw: { pocion: 10 } },
  { nombre: 'La caída del Ángel',       tipo: 'jefe_angel',        n: 1,  xp: 8000,  oro: 10000, pw: { rayo: 3, escudo: 3, fuego: 3 } },
  { nombre: 'Las puertas del castillo', tipo: 'guardia_real',      n: 10, xp: 1300,  oro: 1500 },
  { nombre: 'Armadura negra',           tipo: 'caballero_negro',   n: 10, xp: 1400,  oro: 1600 },
  { nombre: 'Huesos de la corona',      tipo: 'esqueleto_real',    n: 10, xp: 1500,  oro: 1700, pw: { pocion: 10 } },
  { nombre: 'El Rey Goblin',            tipo: 'jefe_rey',          n: 1,  xp: 15000, oro: 20000, pw: { rayo: 5, escudo: 5, fuego: 5 } },
  { nombre: 'Alas en el ocaso',         tipo: 'murcielago',        n: 12, xp: 2600,  oro: 2200 },
  { nombre: 'Telarañas de ceniza',      tipo: 'arana',             n: 12, xp: 2800,  oro: 2300 },
  { nombre: 'Siete vidas infernales',   tipo: 'hellgato',          n: 12, xp: 3000,  oro: 2500, pw: { pocion: 10 } },
  { nombre: 'El Coloso de Hueso',       tipo: 'jefe_coloso',       n: 1,  xp: 20000, oro: 24000, pw: { rayo: 4, escudo: 4 } },
  { nombre: 'Cristales vivientes',      tipo: 'cangrejo',          n: 12, xp: 3600,  oro: 2800 },
  { nombre: 'Tinta maldita',            tipo: 'pulpo',             n: 12, xp: 3900,  oro: 3000 },
  { nombre: 'Lo que vive en el lodo',   tipo: 'cosa',              n: 12, xp: 4200,  oro: 3200, pw: { fuego: 3 } },
  { nombre: 'El Rey Cangrejo',          tipo: 'jefe_cangrejo',     n: 1,  xp: 26000, oro: 30000, pw: { rayo: 5, escudo: 5 } },
  { nombre: 'Dientes en la oscuridad',  tipo: 'pez',               n: 14, xp: 4800,  oro: 3500 },
  { nombre: 'Baba de las profundidades', tipo: 'baba',             n: 14, xp: 5200,  oro: 3800 },
  { nombre: 'Almas del naufragio',      tipo: 'espectro',          n: 14, xp: 5600,  oro: 4000, pw: { pocion: 15 } },
  { nombre: 'El Leviatán',              tipo: 'jefe_leviatan',     n: 1,  xp: 34000, oro: 38000, pw: { rayo: 6, escudo: 6, fuego: 6 } },
  { nombre: 'Garras del acantilado',    tipo: 'zarigueya',         n: 15, xp: 6400,  oro: 4500 },
  { nombre: 'Señoras del viento',       tipo: 'aguila',            n: 15, xp: 6900,  oro: 4800 },
  { nombre: 'La orden del paladín',     tipo: 'paladin_goblin',    n: 15, xp: 7500,  oro: 5200, pw: { pocion: 20 } },
  { nombre: 'El Dragón Ancestral',      tipo: 'jefe_dragon',       n: 1,  xp: 50000, oro: 60000, pw: { rayo: 10, escudo: 10, fuego: 10 } },
];
// Mision diaria repetible (se reinicia cada dia UTC). Solo cuentan monstruos
// de tu nivel o hasta 5 por debajo, para que no se cumpla farmeando la
// primera zona con un personaje alto.
export const DIARIA = { nombre: 'Caza del día', n: 25 };
export function premioDiaria(nivel) { return { xp: Math.round(xpParaSubir(nivel) * 0.3), oro: 40 * nivel, pocion: 3 }; }
export const hoyUTC = () => new Date(Date.now()).toISOString().slice(0, 10);

export function zonaDe(tipoMonstruo) {
  for (const id in MAPAS) if (MAPAS[id].monstruos && (MAPAS[id].monstruos.includes(tipoMonstruo) || MAPAS[id].jefe === tipoMonstruo)) return id;
  return null;
}

// ── MAPAS ──
// plataformas: [x, y, ancho] (y = cara superior). portales: x del centro.
export const MAPAS = {
  pueblo: {
    nombre: 'Pueblo Duende', fondo: 'amanecer2', ancho: 3300, zona: false,
    paleta: { cielo: ['#1a0b2e', '#3a1a3a'], suelo: '#1c1426', linea: '#ffd84a' },
    plataformas: [[420, 300, 160], [1320, 300, 160], [860, 240, 180]],
    portales: [
      { x: 90,   a: 'noche',     ax: 150,  etiqueta: 'Bosque Nocturno', nv: '1-6' },
      { x: 330,  a: 'amanecer',  ax: 150,  etiqueta: 'Colinas Rojas', nv: '6-12' },
      { x: 1560, a: 'selva',     ax: 150,  etiqueta: 'Selva Esmeralda', nv: '12-18' },
      { x: 1800, a: 'tormenta',  ax: 150,  etiqueta: 'Picos Tormenta', nv: '18-24' },
      { x: 2040, a: 'desierto',  ax: 150,  etiqueta: 'Desierto Dorado', nv: '24-32' },
      { x: 2280, a: 'castillo',  ax: 150,  etiqueta: 'Castillo del Rey', nv: '32-40' },
      { x: 2520, a: 'cumbres',   ax: 150,  etiqueta: 'Cumbres del Ocaso', nv: '40-45' },
      { x: 2760, a: 'cavernas',  ax: 150,  etiqueta: 'Cavernas Abisales', nv: '45-50' },
      { x: 3000, a: 'abismo',    ax: 150,  etiqueta: 'Abismo Marino', nv: '50-55' },
      { x: 3240, a: 'acantilados', ax: 150, etiqueta: 'Acantilados Mágicos', nv: '55-60' },
      { x: 1400, a: 'coliseo',   ax: 300,  etiqueta: '👹 Coliseo', nv: 'Jefe mundial' },
    ],
    npcs: [
      { id: 'mercader', nombre: 'Mercader Grumo', hoja: 'goblin_peasant', x: 950, tipo: 'tienda' },
      { id: 'guia', nombre: 'Guardia Tito', hoja: 'goblin_guard', x: 640, tipo: 'guia' },
      { id: 'sabio', nombre: 'Sabio Hechicero', hoja: 'hechicero', x: 1180, tipo: 'ranking' },
    ],
    spawn: 950,
  },
  noche: {
    nombre: 'Bosque Nocturno', fondo: 'noche', ancho: 2600, zona: true, nv: [1, 6],
    paleta: { cielo: ['#010015', '#050520'], suelo: '#0a1a0f', linea: '#00ff88' },
    plataformas: [[500, 300, 200], [900, 240, 160], [1400, 290, 220], [1900, 250, 180]],
    portales: [{ x: 60, a: 'pueblo', ax: 150, etiqueta: 'Pueblo Duende' }, { x: 2540, a: 'amanecer', ax: 150, etiqueta: 'Colinas Rojas', nv: '6-12' }],
    monstruos: ['goblin_normal', 'esqueleto', 'goblin_assassin', 'fantasma', 'hechicero'], max: 12,
    jefe: 'jefe_sabueso',
  },
  amanecer: {
    nombre: 'Colinas Rojas', fondo: 'amanecer', ancho: 2600, zona: true, nv: [6, 12],
    paleta: { cielo: ['#150005', '#2a0510'], suelo: '#1a0a0a', linea: '#ff6444' },
    plataformas: [[450, 290, 200], [1000, 250, 220], [1600, 300, 200], [2050, 240, 160]],
    portales: [{ x: 60, a: 'noche', ax: 2450, etiqueta: 'Bosque Nocturno', nv: '1-6' }, { x: 2540, a: 'selva', ax: 150, etiqueta: 'Selva Esmeralda', nv: '12-18' }],
    monstruos: ['goblin_peasant', 'goblin_guard', 'pajaro', 'goblin_knight'], max: 12,
    jefe: 'jefe_caballero',
  },
  selva: {
    nombre: 'Selva Esmeralda', fondo: 'selva', ancho: 2600, zona: true, nv: [12, 18],
    paleta: { cielo: ['#001512', '#03251c'], suelo: '#06140f', linea: '#00ffcc' },
    plataformas: [[550, 280, 240], [1150, 230, 200], [1700, 290, 220], [2150, 250, 180]],
    portales: [{ x: 60, a: 'amanecer', ax: 2450, etiqueta: 'Colinas Rojas', nv: '6-12' }, { x: 2540, a: 'tormenta', ax: 150, etiqueta: 'Picos Tormenta', nv: '18-24' }],
    monstruos: ['hongo', 'rana', 'goblin_centurion', 'goblin_battlelord'], max: 12,
    jefe: 'jefe_senor',
  },
  tormenta: {
    nombre: 'Picos Tormenta', fondo: 'tormenta', ancho: 2600, zona: true, nv: [18, 24],
    paleta: { cielo: ['#0a0a18', '#1c1430'], suelo: '#120a1f', linea: '#c084fc' },
    plataformas: [[480, 300, 180], [950, 240, 200], [1500, 280, 240], [2050, 230, 200]],
    portales: [{ x: 60, a: 'selva', ax: 2450, etiqueta: 'Selva Esmeralda', nv: '12-18' }, { x: 2540, a: 'desierto', ax: 150, etiqueta: 'Desierto Dorado', nv: '24-32' }],
    monstruos: ['goblin_mage', 'esqueleto_arcano', 'ghoul_ardiente'], max: 12,
    jefe: 'jefe_ghoul',
  },
  desierto: {
    nombre: 'Desierto Dorado', fondo: 'desierto', ancho: 2600, zona: true, nv: [24, 32],
    paleta: { cielo: ['#181000', '#2e2004'], suelo: '#1a140a', linea: '#ffe600' },
    plataformas: [[520, 290, 220], [1100, 240, 200], [1650, 300, 200], [2150, 250, 200]],
    portales: [{ x: 60, a: 'tormenta', ax: 2450, etiqueta: 'Picos Tormenta', nv: '18-24' }, { x: 2540, a: 'castillo', ax: 150, etiqueta: 'Castillo del Rey', nv: '32-40' }],
    monstruos: ['goblin_samurai', 'lagarto', 'serpiente', 'conejo'], max: 12,
    jefe: 'jefe_angel',
  },
  // Final de juego (Nv 32-40, hasta el tope): el rey goblin en su castillo.
  // Fondo del pack de castillo que ya usaba el arcade (tormenta2).
  castillo: {
    nombre: 'Castillo del Rey Goblin', fondo: 'tormenta2', ancho: 2800, zona: true, nv: [32, 40],
    paleta: { cielo: ['#0d0a1a', '#241838'], suelo: '#1a1424', linea: '#ffd84a' },
    plataformas: [[450, 290, 220], [950, 230, 180], [1450, 290, 240], [2000, 240, 200], [2400, 300, 160]],
    portales: [{ x: 60, a: 'desierto', ax: 2450, etiqueta: 'Desierto Dorado', nv: '24-32' }, { x: 2740, a: 'cumbres', ax: 150, etiqueta: 'Cumbres del Ocaso', nv: '40-45' }],
    monstruos: ['guardia_real', 'caballero_negro', 'esqueleto_real', 'hechicero_corte'], max: 12,
jefe: 'jefe_rey',
  },
  // ── Gran expansion: Nv 40-60 (fondos de ansimuz, ver CREDITOS.md) ──
  cumbres: {
    nombre: 'Cumbres del Ocaso', fondo: 'cumbres', ancho: 2800, zona: true, nv: [40, 45],
    paleta: { cielo: ['#2a1630', '#7a4a6a'], suelo: '#1e1220', linea: '#ff9a7a' },
    plataformas: [[480, 290, 220], [1000, 235, 200], [1500, 290, 220], [2050, 245, 200], [2450, 300, 160]],
    portales: [{ x: 60, a: 'castillo', ax: 2650, etiqueta: 'Castillo del Rey', nv: '32-40' }, { x: 2740, a: 'cavernas', ax: 150, etiqueta: 'Cavernas Abisales', nv: '45-50' }],
    monstruos: ['murcielago', 'arana', 'esqueleto_capa', 'hellgato'], max: 12,
    jefe: 'jefe_coloso',
  },
  cavernas: {
    nombre: 'Cavernas Abisales', fondo: 'cavernas', ancho: 2800, zona: true, nv: [45, 50],
    paleta: { cielo: ['#12061f', '#3a1450'], suelo: '#1a0a26', linea: '#ff6ad5' },
    plataformas: [[450, 285, 200], [950, 240, 220], [1450, 290, 200], [1950, 235, 220], [2400, 290, 180]],
    portales: [{ x: 60, a: 'cumbres', ax: 2650, etiqueta: 'Cumbres del Ocaso', nv: '40-45' }, { x: 2740, a: 'abismo', ax: 150, etiqueta: 'Abismo Marino', nv: '50-55' }],
    monstruos: ['cangrejo', 'saltador', 'pulpo', 'cosa'], max: 12,
    jefe: 'jefe_cangrejo',
  },
  abismo: {
    nombre: 'Abismo Marino', fondo: 'abismo', ancho: 2800, zona: true, nv: [50, 55],
    paleta: { cielo: ['#04121f', '#0d3550'], suelo: '#06141c', linea: '#00eeff' },
    plataformas: [[500, 290, 220], [1050, 240, 200], [1550, 285, 220], [2100, 240, 200]],
    portales: [{ x: 60, a: 'cavernas', ax: 2650, etiqueta: 'Cavernas Abisales', nv: '45-50' }, { x: 2740, a: 'acantilados', ax: 150, etiqueta: 'Acantilados Mágicos', nv: '55-60' }],
    monstruos: ['pez', 'pez_dardo', 'baba', 'espectro', 'pez_grande'], max: 13,
    jefe: 'jefe_leviatan',
  },
  acantilados: {
    nombre: 'Acantilados Mágicos', fondo: 'acantilados', ancho: 3000, zona: true, nv: [55, 60],
    paleta: { cielo: ['#3aa8c8', '#b8f0e0'], suelo: '#1f2a18', linea: '#9cff5a' },
    plataformas: [[450, 290, 220], [950, 230, 200], [1450, 285, 240], [2000, 235, 200], [2500, 290, 200]],
    portales: [{ x: 60, a: 'abismo', ax: 2650, etiqueta: 'Abismo Marino', nv: '50-55' }, { x: 2940, a: 'pueblo', ax: 950, etiqueta: 'Pueblo Duende' }],
    monstruos: ['zarigueya', 'aguila', 'fantasma_halo', 'paladin_goblin'], max: 13,
    jefe: 'jefe_dragon',
  },
  // Arena del jefe mundial (para todos los niveles): sin monstruos propios.
  coliseo: {
    nombre: 'Coliseo del Duende', fondo: 'tormenta2', ancho: 1600, zona: true, coliseo: true, nv: [1, 60],
    paleta: { cielo: ['#14051f', '#3a0a3a'], suelo: '#1a0a1a', linea: '#ff3cf0' },
    plataformas: [[250, 290, 200], [1150, 290, 200], [700, 230, 200]],
    portales: [{ x: 60, a: 'pueblo', ax: 1400, etiqueta: 'Pueblo Duende' }],
    monstruos: [], max: 0,
  },
};

// Suelo bajo un punto: la plataforma mas alta que tenga debajo (o el suelo).
export function sueloEn(mapa, x, yPies, cayendo) {
  let mejor = SUELO;
  for (const [px, py, pw] of mapa.plataformas) {
    if (x >= px && x <= px + pw && yPies <= py + (cayendo ? 14 : 2) && py < mejor) mejor = py;
  }
  return mejor;
}

// Nombre visible: letras, numeros, espacio y _ ; 3-16 caracteres.
export function limpiarNombre(s) {
  const n = String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} _]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return n.length >= 3 ? n : '';
}

// ── mTON (play to earn) ──
// 1.000 mTON = 1 TON. Solo salen de jefes, del jefe mundial y de la caza del
// dia, y nunca mas de lo que hay en el FONDO DIARIO (un % de lo que entro la
// semana anterior por Stars y TON, mas lo que el dueño agregue a mano). Los
// retiros los aprueba el dueño desde el bot (/retiros). Nada que se compre
// (skins, Stars) aumenta lo que se gana en mTON.
export const MTON_POR_TON = 1000;
export const RETIRO_MIN_MTON = 5000;          // 5 TON
export const MTON_NIVEL_MIN = 15;
export const MTON_EDAD_MIN_MS = 48 * 3600 * 1000;     // personaje con 2 dias o mas
export const WALLET_ESPERA_MS = 72 * 3600 * 1000;     // wallet fija 3 dias antes de retirar
export const FONDO_PCT_INGRESOS = 0.3;                // 30% de los ingresos semanales
export const FONDO_REFERENCIA_MTON = 2000;            // con un fondo de 2 TON/dia, los premios valen su base

// Direccion TON "amigable" (UQ..., no rebotable) a partir de la cruda "0:hex".
export function tonAmigable(cruda) {
  const m = /^(-1|0):([0-9a-f]{64})$/i.exec(String(cruda || ''));
  if (!m) return '';
  const b = new Uint8Array(36);
  b[0] = 0x51; b[1] = m[1] === '-1' ? 0xff : 0;
  for (let i = 0; i < 32; i++) b[2 + i] = parseInt(m[2].substr(i * 2, 2), 16);
  let crc = 0;
  for (let i = 0; i < 34; i++) {
    crc ^= b[i] << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  b[34] = crc >> 8; b[35] = crc & 0xff;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
}
