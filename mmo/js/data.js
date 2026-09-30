// ═══════════════════════════════════════════════════════
// DUENDE QUEST ONLINE — datos compartidos cliente/servidor
// Lo importan mmo/js/client.js (navegador) y functions/mmo/world.js
// (Durable Object): un solo lugar para mapas, monstruos, precios y
// formulas, asi el servidor valida exactamente lo que el cliente muestra.
// ═══════════════════════════════════════════════════════

export const VW = 800;          // ancho logico de la vista
export const VH = 450;          // alto logico de la vista
export const SUELO = 400;       // y de los pies sobre el suelo, en todos los mapas
export const NIVEL_MAX = 40;
export const TICK_MS = 100;     // simulacion del servidor a 10 Hz

// Fisica del jugador (por fotograma a 60 fps). El servidor solo la usa para
// validar que nadie se mueva mas rapido de lo posible.
export const FIS = {
  grav: 0.6, salto: -11.5, dobleSalto: -10, vel: 3.6, dashVel: 11, dashT: 10, dashCd: 50,
  jugW: 36, jugH: 58,
};

// ── HOJAS DE ANIMACION (mismas celdas que js/engine.js) ──
// fila 0 = caminar, fila 1 = [golpe..., muerte...]
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
  hellhound:         { fw: 67, fh: 39, ideal: 39, mov: [0, 0, 5], golpe: [1, 0, 2], muerte: [2, 1] },
  // Solo del MMO: el rey goblin (tools/generar_goblin_lord_cc0.py).
  goblin_lord:       { fw: 32, fh: 64, ideal: 35, mov: [0, 1, 6], golpe: [1, 1, 2], muerte: [6, 2] },
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
  // Jefes: uno por zona, reaparecen solos cada cierto tiempo.
  jefe_sabueso:  { nombre: 'Sabueso Infernal',       hoja: 'hellhound',         nivel: 8,  jefe: true, alto: 110, hpX: 14, atkX: 1.4, w: 150, h: 70 },
  jefe_caballero:{ nombre: 'Rey Goblin Caballero',   hoja: 'goblin_knight',     nivel: 14, jefe: true, alto: 130, hpX: 16, atkX: 1.4, w: 70, h: 120, tinte: '#ff6444' },
  jefe_senor:    { nombre: 'Señor de la Guerra',     hoja: 'goblin_battlelord', nivel: 20, jefe: true, alto: 135, hpX: 18, atkX: 1.5, w: 70, h: 125, tinte: '#00ffcc' },
  jefe_ghoul:    { nombre: 'Ghoul Infernal',         hoja: 'ghoul_ardiente',    nivel: 26, jefe: true, alto: 130, hpX: 20, atkX: 1.5, w: 110, h: 120, tinte: '#ff9900', dispara: true },
  jefe_angel:    { nombre: 'Ángel Caído',            hoja: 'angel',             nivel: 32, jefe: true, alto: 150, hpX: 24, atkX: 1.6, w: 110, h: 140, vuela: true, dispara: true },
  jefe_rey:      { nombre: 'Rey Goblin',             hoja: 'goblin_lord',       nivel: 42, jefe: true, alto: 150, hpX: 26, atkX: 1.6, w: 70, h: 135, tinte: '#ffd84a', dispara: true },
};

export function statsMonstruo(key) {
  const m = MONSTRUOS[key];
  const L = m.nivel;
  const hp = Math.round((30 + 15 * L) * (m.hpX || 1));
  // 6+4L mataba a un nivel 1 en 6 golpes de un Nv3: con 4+3L un monstruo de
  // tu nivel necesita ~15 golpes y uno 2 niveles arriba ~8.
  const atk = Math.round((4 + 3 * L) * (m.atkX || 1));
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
export function statsJugador(nivel, skin) {
  const b = (SKINS[skin] && SKINS[skin].buffs) || {};
  return {
    maxHp: 100 + 25 * (nivel - 1) + (b.bonusHp || 0) * Math.max(1, Math.floor(nivel / 5)),
    atk: Math.round((10 + 3 * (nivel - 1)) * (b.atkMult || 1)),
    def: Math.floor(nivel * 1.5),
  };
}

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
    nombre: 'Pueblo Duende', fondo: 'amanecer2', ancho: 2400, zona: false,
    paleta: { cielo: ['#1a0b2e', '#3a1a3a'], suelo: '#1c1426', linea: '#ffd84a' },
    plataformas: [[420, 300, 160], [1320, 300, 160], [860, 240, 180]],
    portales: [
      { x: 90,   a: 'noche',     ax: 150,  etiqueta: 'Bosque Nocturno', nv: '1-6' },
      { x: 330,  a: 'amanecer',  ax: 150,  etiqueta: 'Colinas Rojas', nv: '6-12' },
      { x: 1560, a: 'selva',     ax: 150,  etiqueta: 'Selva Esmeralda', nv: '12-18' },
      { x: 1800, a: 'tormenta',  ax: 150,  etiqueta: 'Picos Tormenta', nv: '18-24' },
      { x: 2040, a: 'desierto',  ax: 150,  etiqueta: 'Desierto Dorado', nv: '24-32' },
      { x: 2280, a: 'castillo',  ax: 150,  etiqueta: 'Castillo del Rey', nv: '32-40' },
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
    portales: [{ x: 60, a: 'desierto', ax: 2450, etiqueta: 'Desierto Dorado', nv: '24-32' }, { x: 2740, a: 'pueblo', ax: 950, etiqueta: 'Pueblo Duende' }],
    monstruos: ['guardia_real', 'caballero_negro', 'esqueleto_real', 'hechicero_corte'], max: 12,
    jefe: 'jefe_rey',
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
