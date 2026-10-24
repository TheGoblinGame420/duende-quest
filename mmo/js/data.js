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
  // ── Jefes de MAZMORRA (ver MAZMORRAS): su nivel lo pone la instancia y su
  // guion son las mecanicas del combate (zonas en el suelo, hechizos que se
  // pueden interrumpir, esbirros, enfurecer...).
  // Madriguera Goblin (Nv 6-16): la primera, para aprender las mecanicas.
  mz_hongo:      { nombre: 'Hongo Ancestral',       hoja: 'hongo',        nivel: 8, jefe: true, mazmorra: true, alto: 125, w: 100, h: 105, tinte: '#a3e635',
    guion: [
      { tipo: 'zona', nombre: 'Nube de Esporas', cada: 12000, primero: 6000, aviso: 2200, ancho: 260, donde: 'jefe', dano: 0.25, color: '#a3e635' },
      { tipo: 'adds', en: [0.5], k: 'goblin_normal', n: 2 },
    ] },
  mz_rana:       { nombre: 'Reina de la Charca',    hoja: 'rana',         nivel: 9, jefe: true, mazmorra: true, alto: 115, w: 110, h: 90, tinte: '#38bdf8',
    guion: [
      { tipo: 'cast', nombre: 'Croar Ensordecedor', cada: 14000, primero: 7000, dura: 2800, int: true, a: 'todos', aturde: 1500, dano: 0.12 },
      { tipo: 'zona', nombre: 'Charco Pegajoso', cada: 13000, primero: 9000, aviso: 2000, ancho: 190, donde: 'azar', n: 2, dano: 0.2, color: '#38bdf8' },
    ] },
  mz_cabecilla:  { nombre: 'Cabecilla de la Madriguera', hoja: 'goblin_centurion', nivel: 10, jefe: true, mazmorra: true, alto: 155, w: 75, h: 135, tinte: '#f97316',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'zona', nombre: 'Pisotón', cada: 11000, primero: 5000, aviso: 2000, ancho: 240, donde: 'jefe', dano: 0.3, color: '#f97316' },
      { tipo: 'enrage', en: 0.3, atkX: 1.4 },
    ] },
  mz_guardian:   { nombre: 'Guardián Óseo',        hoja: 'esqueleto',    nivel: 20, jefe: true, mazmorra: true, alto: 150, w: 70, h: 135, tinte: '#d6d3d1',
    guion: [
      { tipo: 'zona', nombre: 'Golpe Sísmico', cada: 11000, primero: 6000, aviso: 1800, ancho: 300, donde: 'jefe', dano: 0.35, color: '#ff7a1a' },
      { tipo: 'adds', en: [0.5], k: 'esqueleto', n: 2 },
    ] },
  mz_bruja:      { nombre: 'Bruja de la Cripta',    hoja: 'hechicero',    nivel: 20, jefe: true, mazmorra: true, alto: 140, w: 80, h: 125, tinte: '#4ade80', dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Rayo de las Sombras', cada: 9000, primero: 5000, dura: 2500, int: true, a: 'objetivo', dano: 0.55 },
      { tipo: 'zona', nombre: 'Charco Venenoso', cada: 13000, primero: 8000, aviso: 1500, ancho: 200, donde: 'azar', n: 2, dano: 0.25, color: '#4ade80' },
      { tipo: 'adds', en: [0.6, 0.3], k: 'fantasma', n: 2 },
    ] },
  mz_senor:      { nombre: 'Señor de los Huesos',   hoja: 'coloso',       nivel: 22, jefe: true, mazmorra: true, alto: 180, w: 100, h: 160, tinte: '#a8a29e',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'cast', nombre: 'Aplastar', cada: 14000, primero: 7000, dura: 2000, int: false, a: 'objetivo', dano: 0.5 },
      { tipo: 'zona', nombre: 'Lluvia de Huesos', cada: 10000, primero: 4000, aviso: 1600, ancho: 170, donde: 'jugadores', dano: 0.3, color: '#e5e7eb' },
      { tipo: 'enrage', en: 0.3, atkX: 1.5 },
    ] },
  mz_cangrejo:   { nombre: 'Cangrejo Acorazado',    hoja: 'cangrejo',     nivel: 38, jefe: true, mazmorra: true, alto: 140, w: 130, h: 125, tinte: '#60a5fa',
    guion: [
      { tipo: 'escudo', nombre: 'Caparazón', cada: 18000, primero: 9000, dura: 5000, reduce: 0.9 },
      { tipo: 'zona', nombre: 'Marea', cada: 12000, primero: 5000, aviso: 1600, ancho: 340, donde: 'jefe', dano: 0.35, color: '#38bdf8' },
    ] },
  mz_sirena:     { nombre: 'Sirena Abisal',         hoja: 'espectro',     nivel: 38, jefe: true, mazmorra: true, alto: 130, w: 70, h: 120, tinte: '#f0abfc', vuela: true, dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Canto Hipnótico', cada: 13000, primero: 6000, dura: 2500, int: true, a: 'todos', aturde: 2000, dano: 0.15 },
      { tipo: 'adds', en: [0.5], k: 'pez', n: 3 },
    ] },
  mz_kraken:     { nombre: 'Kraken',                hoja: 'pulpo',        nivel: 40, jefe: true, mazmorra: true, alto: 190, w: 150, h: 170, tinte: '#a855f7',
    guion: [
      { tipo: 'zona', nombre: 'Tentáculos', cada: 9000, primero: 4000, aviso: 1500, ancho: 150, donde: 'jugadores', dano: 0.3, color: '#a855f7' },
      { tipo: 'cast', nombre: 'Chorro de Tinta', cada: 13000, primero: 8000, dura: 2200, int: true, a: 'todos', dano: 0.35 },
      { tipo: 'adds', en: [0.7, 0.4], k: 'pulpo', n: 2 },
      { tipo: 'enrage', en: 0.25, atkX: 1.5 },
    ] },
  mz_caballero:  { nombre: 'Caballero Dracónico',   hoja: 'goblin_knight', nivel: 52, jefe: true, mazmorra: true, alto: 150, w: 75, h: 135, tinte: '#ef4444',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'cast', nombre: 'Tajo Brutal', cada: 12000, primero: 6000, dura: 1800, int: false, a: 'objetivo', dano: 0.45 },
      { tipo: 'zona', nombre: 'Estandarte de Fuego', cada: 14000, primero: 9000, aviso: 1600, ancho: 240, donde: 'azar', n: 2, dano: 0.3, color: '#f97316' },
    ] },
  mz_archimago:  { nombre: 'Archimago Traidor',     hoja: 'hechicero',    nivel: 54, jefe: true, mazmorra: true, alto: 140, w: 80, h: 125, tinte: '#8b5cf6', dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Piroexplosión', cada: 9000, primero: 4000, dura: 2500, int: true, a: 'objetivo', dano: 0.5 },
      { tipo: 'zona', nombre: 'Runas Arcanas', cada: 11000, primero: 7000, aviso: 1500, ancho: 170, donde: 'jugadores', dano: 0.3, color: '#c084fc' },
      { tipo: 'adds', en: [0.5], k: 'hechicero_corte', n: 2 },
    ] },
  // Fortaleza Goblin (Nv 20-40)
  mz_capataz:    { nombre: 'Capataz Gruñido',       hoja: 'goblin_battlelord', nivel: 28, jefe: true, mazmorra: true, alto: 150, w: 75, h: 135, tinte: '#eab308',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'zona', nombre: 'Pisotón', cada: 11000, primero: 6000, aviso: 1700, ancho: 280, donde: 'jefe', dano: 0.35, color: '#eab308' },
      { tipo: 'adds', en: [0.6, 0.3], k: 'goblin_peasant', n: 2 },
    ] },
  mz_chaman:     { nombre: 'Chamán de las Brasas',  hoja: 'goblin_mage',  nivel: 28, jefe: true, mazmorra: true, alto: 140, w: 70, h: 125, tinte: '#f97316', dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Bola de Fuego Mayor', cada: 8500, primero: 4500, dura: 2300, int: true, a: 'objetivo', dano: 0.5 },
      { tipo: 'zona', nombre: 'Lluvia de Brasas', cada: 12000, primero: 7000, aviso: 1500, ancho: 160, donde: 'jugadores', dano: 0.25, color: '#f97316' },
      { tipo: 'escudo', nombre: 'Escudo de Llamas', cada: 20000, primero: 12000, dura: 4000, reduce: 0.8 },
    ] },
  mz_rey_goblin: { nombre: 'Rey Goblin Barrigón',   hoja: 'goblin_lord',  nivel: 30, jefe: true, mazmorra: true, alto: 185, w: 100, h: 165, tinte: '#facc15',
    guion: [
      { tipo: 'cast', nombre: 'Grito de Guerra', cada: 15000, primero: 8000, dura: 2500, int: true, a: 'todos', aturde: 1800, dano: 0.15 },
      { tipo: 'zona', nombre: 'Martillazo', cada: 10000, primero: 5000, aviso: 1500, ancho: 260, donde: 'frente', dano: 0.4, color: '#facc15' },
      { tipo: 'adds', en: [0.5], k: 'goblin_samurai', n: 2 },
      { tipo: 'enrage', en: 0.25, atkX: 1.5 },
    ] },
  // Nido de la Reina Araña (Nv 40-58)
  mz_reina:      { nombre: 'Reina Araña',           hoja: 'arana',          nivel: 46, jefe: true, mazmorra: true, alto: 72, w: 110, h: 60, tinte: '#a3e635',
    guion: [
      { tipo: 'zona', nombre: 'Lluvia de Veneno', cada: 10000, primero: 5000, aviso: 1500, ancho: 170, donde: 'jugadores', dano: 0.3, color: '#a3e635' },
      { tipo: 'adds', en: [0.7, 0.4], k: 'arana', n: 2 },
      { tipo: 'escudo', nombre: 'Capullo de Seda', cada: 22000, primero: 12000, dura: 4000, reduce: 0.75 },
    ] },
  mz_liche:      { nombre: 'Liche Errante',         hoja: 'esqueleto_capa', nivel: 48, jefe: true, mazmorra: true, alto: 150, w: 70, h: 135, tinte: '#7dd3fc', dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Descarga de Escarcha', cada: 8000, primero: 4500, dura: 2200, int: true, a: 'objetivo', dano: 0.5 },
      { tipo: 'zona', nombre: 'Ventisca', cada: 13000, primero: 7500, aviso: 1600, ancho: 220, donde: 'azar', n: 3, dano: 0.28, color: '#7dd3fc' },
      { tipo: 'adds', en: [0.5], k: 'murcielago', n: 2 },
    ] },
  mz_cancerbero: { nombre: 'Cancerbero',            hoja: 'hellhound',      nivel: 50, jefe: true, mazmorra: true, alto: 130, w: 160, h: 100, tinte: '#f43f5e',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'zona', nombre: 'Aliento Ígneo', cada: 10000, primero: 5000, aviso: 1500, ancho: 280, donde: 'frente', dano: 0.4, color: '#fb7185' },
      { tipo: 'cast', nombre: 'Aullido Infernal', cada: 15000, primero: 9000, dura: 2400, int: true, a: 'todos', aturde: 1800, dano: 0.15 },
      { tipo: 'enrage', en: 0.25, atkX: 1.5 },
    ] },
  mz_dragon:     { nombre: 'Dragón Carmesí',        hoja: 'dragon',       nivel: 58, jefe: true, mazmorra: true, alto: 200, w: 170, h: 140, tinte: '#dc2626', vuela: true, dispara: true,
    guion: [
      { tipo: 'zona', nombre: 'Aliento de Fuego', cada: 12000, primero: 7000, aviso: 2000, ancho: 560, donde: 'frente', dano: 0.5, color: '#ef4444' },
      { tipo: 'zona', nombre: 'Lluvia de Brasas', cada: 9000, primero: 4000, aviso: 1500, ancho: 160, donde: 'jugadores', dano: 0.25, color: '#f97316' },
      { tipo: 'adds', en: [0.66, 0.33], k: 'aguila', n: 2 },
      { tipo: 'enrage', en: 0.2, atkX: 1.6 },
    ] },
  // Banda: Santuario del Titán (Nv 60, de 1 a 10). 'junta': zona dorada que
  // hay que aguantar JUNTOS: el golpe vale dano x jugadores (hasta `junta`)
  // y se reparte entre los de dentro (bien hecho, cada uno recibe `dano`);
  // si no entra nadie, estalla sobre todos con `dano`. Ver tickMazmorra.
  mz_coloso_ab:  { nombre: 'Coloso Sísmico',        hoja: 'coloso',         nivel: 60, jefe: true, mazmorra: true, alto: 205, w: 110, h: 185, tinte: '#94a3b8',
    guion: [
      { tipo: 'embestida' },
      { tipo: 'zona', nombre: 'Pisotón Sísmico', cada: 11000, primero: 5000, aviso: 1700, ancho: 340, donde: 'jefe', dano: 0.4, color: '#94a3b8' },
      { tipo: 'zona', nombre: 'Roca Gigante', cada: 16000, primero: 9000, aviso: 2600, ancho: 190, donde: 'uno', junta: 3, dano: 0.4, color: '#facc15' },
      { tipo: 'enrage', en: 0.2, atkX: 1.5 },
    ] },
  mz_madre_baba: { nombre: 'Madre Babosa',          hoja: 'baba',           nivel: 60, jefe: true, mazmorra: true, alto: 165, w: 140, h: 145, tinte: '#4ade80',
    guion: [
      { tipo: 'zona', nombre: 'Charcos de Ácido', cada: 10000, primero: 4000, aviso: 1500, ancho: 190, donde: 'azar', n: 4, dano: 0.3, color: '#4ade80' },
      { tipo: 'adds', en: [0.75, 0.5, 0.25], k: 'baba', n: 2 },
      { tipo: 'escudo', nombre: 'Membrana Viscosa', cada: 21000, primero: 12000, dura: 4000, reduce: 0.8 },
    ] },
  mz_serafin:    { nombre: 'Serafín Corrupto',      hoja: 'angel',          nivel: 60, jefe: true, mazmorra: true, alto: 170, w: 120, h: 150, tinte: '#fbbf24', vuela: true, dispara: true,
    guion: [
      { tipo: 'cast', nombre: 'Juicio Final', cada: 14000, primero: 7000, dura: 2600, int: true, a: 'todos', aturde: 1500, dano: 0.4 },
      { tipo: 'zona', nombre: 'Plumas Ardientes', cada: 9000, primero: 4000, aviso: 1500, ancho: 160, donde: 'jugadores', dano: 0.28, color: '#fb923c' },
      { tipo: 'zona', nombre: 'Luz Purificadora', cada: 17000, primero: 11000, aviso: 2600, ancho: 190, donde: 'uno', junta: 3, dano: 0.4, color: '#fde047' },
      { tipo: 'adds', en: [0.5], k: 'fantasma_halo', n: 3 },
    ] },
  mz_titan:      { nombre: 'Titán del Abismo',      hoja: 'goblin_lord',    nivel: 60, jefe: true, mazmorra: true, alto: 250, w: 120, h: 225, tinte: '#4338ca', dispara: true,
    guion: [
      { tipo: 'embestida' },
      { tipo: 'zona', nombre: 'Puño del Abismo', cada: 10000, primero: 5000, aviso: 1500, ancho: 300, donde: 'frente', dano: 0.45, color: '#818cf8' },
      { tipo: 'cast', nombre: 'Ola de Corrupción', cada: 15000, primero: 8000, dura: 2500, int: true, a: 'todos', dano: 0.35 },
      { tipo: 'zona', nombre: 'Meteoro del Vacío', cada: 18000, primero: 12000, aviso: 2600, ancho: 190, donde: 'uno', junta: 3, dano: 0.45, color: '#facc15' },
      { tipo: 'adds', en: [0.66, 0.33], k: 'paladin_goblin', n: 2 },
      { tipo: 'enrage', en: 0.2, atkX: 1.7 },
    ] },
  // Jefe mundial: aparece cada 30 min en el Coliseo para TODOS los niveles.
  // Su daño es un % de la vida de cada jugador (no su ataque), asi un Nv 5 y
  // un Nv 60 pelean juntos; su vida crece con los jugadores conectados.
  jefe_mundial:  { nombre: 'Gran Duende Corrupto',   hoja: 'goblin_lord',       nivel: 30, jefe: true, mundial: true, alto: 230, w: 100, h: 200, tinte: '#5a0f96', dispara: true },
  // Rotan con el Gran Duende cada media hora (MUNDIALES): mismas reglas y premios.
  mundial_tormenta: { nombre: 'Dragón de la Tormenta', hoja: 'dragon',          nivel: 30, jefe: true, mundial: true, alto: 210, w: 170, h: 150, tinte: '#38bdf8', dispara: true },
  mundial_coloso:   { nombre: 'Coloso de Obsidiana',   hoja: 'coloso',          nivel: 30, jefe: true, mundial: true, alto: 240, w: 120, h: 220, tinte: '#7c2d12', dispara: true },
  // Asedio de la Fortaleza del Nucleo (Abismo de Eter, 3D). No van al bestiario
  // ni a la Torre (asedio: true); su vida la pone el asedio.
  puerta_nucleo:    { nombre: 'Puerta del Núcleo',     hoja: 'coloso',          nivel: 50, jefe: true, asedio: true, alto: 165, w: 90, h: 150 },
  guardian_nucleo:  { nombre: 'Guardián del Núcleo',   hoja: 'coloso',          nivel: 50, jefe: true, asedio: true, alto: 165, w: 90, h: 150, tinte: '#a78bfa', atkX: 1.6 },
};

// nivel: para las mazmorras, que se ajustan al nivel del grupo.
export function statsMonstruo(key, nivel) {
  const m = MONSTRUOS[key];
  const L = nivel || m.nivel;
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
// XP de descanso (como en WoW): estar fuera del juego acumula experiencia
// extra que duplica la de cada caza hasta gastarse. 8% de tu nivel por hora
// fuera (desde la primera hora), con un tope de 1,5 niveles. Un motivo
// amable para volver al dia siguiente, sin castigar a quien no puede.
export const DESCANSO_POR_HORA = 0.08;
export const DESCANSO_MAX = 1.5;
export function descansoGanado(nivel, msFuera) {
  const horas = msFuera / 3600000;
  return horas < 1 ? 0 : Math.round(xpParaSubir(nivel) * DESCANSO_POR_HORA * horas);
}
export function statsJugador(nivel, skin, eq, clase, espec, tal, runas) {
  const b = (SKINS[skin] && SKINS[skin].buffs) || {};
  const ru = bonoRunas(runas);
  const e = bonoEquipo(eq);
  const cj = bonoConjuntos(eq);
  const cl = CLASES[clase];
  const m = (cl && cl.mod) || { hp: 1, def: 1, atk: 1, crit: 0 };
  const sp = (nivel >= ESPEC_NIVEL && especDe(clase, espec) && especDe(clase, espec).mod) || {};
  const t = { tal };
  return {
    maxHp: Math.round((100 + 30 * (nivel - 1) + (b.bonusHp || 0) * Math.max(1, Math.floor(nivel / 5)) + e.hp) * m.hp * (sp.hp || 1) * (1 + talento(t, 'vida')) * (1 + cj.hp) * (1 + ru.hp)),
    atk: Math.round((10 + 3 * (nivel - 1) + e.atk) * (b.atkMult || 1) * m.atk * (sp.atk || 1) * (1 + talento(t, 'fuerza')) * (1 + cj.atk) * (1 + ru.atk)),
    def: Math.floor((Math.floor(nivel * 1.5) + e.def) * m.def * (sp.def || 1) * (1 + talento(t, 'defensa')) * (1 + cj.def) * (1 + ru.def) * (b.defMult || 1)),
    crit: 0.12 + e.crit + m.crit + (sp.crit || 0) + talento(t, 'critico') + cj.crit + (b.critBonus || 0),
    recMax: recursoMax(clase, nivel),
  };
}

// ── CLASES (al estilo World of Warcraft) ──
// Cada clase tiene su recurso, su papel en el grupo y 7-8 habilidades que se
// aprenden al subir de nivel. El ataque basico (Z) sigue siendo el combo de
// siempre para los de cuerpo a cuerpo; los magos y sacerdotes disparan con
// su vara al objetivo. Las habilidades van APARTE del ataque basico: gastan
// recurso y comparten un tiempo global de reutilizacion (GCD) de 1 s.
export const GCD_MS = 1000;
export const RECURSOS = {
  mana:    { nombre: 'Maná',    color: '#3b82f6' },
  ira:     { nombre: 'Ira',     color: '#ef4444' },
  energia: { nombre: 'Energía', color: '#facc15' },
};
export function recursoMax(clase, nivel) {
  const cl = CLASES[clase];
  if (!cl) return 0;
  return cl.recurso === 'mana' ? 100 + 12 * (nivel - 1) : 100;
}
// mod: multiplicadores de vida, defensa, ataque y critico extra.
// amenaza: cuanto odio genera su daño (el guerrero hace de tanque).
export const CLASES = {
  guerrero: {
    nombre: 'Guerrero', rol: 'Tanque', color: '#c79c6e', recurso: 'ira', icono: 'S_Sword15', basico: 'melee',
    mod: { hp: 1.2, def: 1.25, atk: 1, crit: 0 }, amenaza: 2,
    desc: 'Aguanta los golpes y protege al grupo. Gana Ira al pegar y al recibir daño, y la gasta en golpes brutales.',
  },
  mago: {
    nombre: 'Mago', rol: 'Daño a distancia', color: '#69ccf0', recurso: 'mana', icono: 'S_Fire03', basico: 'vara',
    mod: { hp: 0.85, def: 0.7, atk: 1.12, crit: 0 }, amenaza: 1,
    desc: 'Fuego, escarcha y arcano desde lejos. Frágil, pero nada pega tan fuerte como una Bola de Fuego.',
  },
  sacerdote: {
    nombre: 'Sacerdote', rol: 'Sanador', color: '#f5f5f5', recurso: 'mana', icono: 'S_Holy03', basico: 'vara',
    mod: { hp: 0.95, def: 0.9, atk: 1, crit: 0 }, amenaza: 1,
    desc: 'Cura, protege con escudos y devuelve la vida a los caídos. Ningún grupo sobrevive sin uno.',
  },
  picaro: {
    nombre: 'Pícaro', rol: 'Daño cuerpo a cuerpo', color: '#fff569', recurso: 'energia', icono: 'S_Dagger02', basico: 'melee',
    mod: { hp: 1, def: 1, atk: 1.08, crit: 0.05 }, amenaza: 1,
    desc: 'Sigilo, venenos y puntos de combo. Acumula combos con golpes rápidos y remata con Eviscerar.',
  },
};
// ── ESPECIALIZACIONES ──
// Desde Nv 10 cada clase elige una de dos (como las "specs" de WoW). Se
// cambia gratis, fuera de combate. mod: multiplicadores de vida/defensa/
// ataque y critico extra; hab: daño extra de habilidades concretas; cura:
// multiplicador de curas y escudos; costo: habilidades mas baratas.
export const ESPEC_NIVEL = 10;
export const ESPECS = {
  guerrero: {
    armas:      { nombre: 'Armas',      icono: 'S_Sword17', rol: 'Daño',    desc: '+15% de daño y el Golpe Heroico cuesta 10 de Ira.', mod: { atk: 1.15 }, costo: { golpe_heroico: 10 } },
    proteccion: { nombre: 'Protección', icono: 'E_Metal08', rol: 'Tanque',  desc: '+15% de vida, +20% de defensa y +50% de amenaza: el tanque del grupo.', mod: { hp: 1.15, def: 1.2 }, amenaza: 1.5 },
  },
  mago: {
    fuego:    { nombre: 'Fuego',    icono: 'S_Fire02', rol: 'Daño',    desc: '+8% de crítico; Bola de Fuego y Lluvia de Meteoros hacen +20%.', mod: { crit: 0.08 }, hab: { bola_fuego: 1.2, meteoros: 1.2 } },
    escarcha: { nombre: 'Escarcha', icono: 'S_Ice05',  rol: 'Control', desc: 'La Nova congela el doble y hace +50%; +10% de vida y +15% de defensa.', mod: { hp: 1.1, def: 1.15 }, hab: { nova: 1.5 }, raiz: 2 },
  },
  sacerdote: {
    sagrado: { nombre: 'Sagrado', icono: 'S_Holy04',   rol: 'Sanador', desc: 'Tus curas y escudos son un 25% más fuertes.', cura: 1.25 },
    sombras: { nombre: 'Sombras', icono: 'S_Shadow03', rol: 'Daño',    desc: '+20% de daño y Dolor hace +50%, pero curas un 20% menos.', mod: { atk: 1.2 }, hab: { dolor: 1.5 }, cura: 0.8 },
  },
  picaro: {
    asesinato: { nombre: 'Asesinato', icono: 'S_Poison03', rol: 'Daño', desc: '+5% de crítico y Eviscerar hace +25%.', mod: { crit: 0.05 }, hab: { eviscerar: 1.25 } },
    combate:   { nombre: 'Combate',   icono: 'S_Sword18',  rol: 'Daño', desc: '+10% de daño y la energía vuelve un 25% más rápido.', mod: { atk: 1.1 }, energia: 1.25 },
  },
};
export const especDe = (clase, espec) => (ESPECS[clase] && ESPECS[clase][espec]) || null;

// ── TALENTOS ──
// Desde Nv 10, cada nivel da 1 punto para repartir (51 a Nv 60). Cada
// talento tiene 5 rangos. Reiniciarlos cuesta oro. Pequeños pero suman:
// cada nivel trae una decision propia ademas de la experiencia.
export const TALENTO_NIVEL = 10;
export const TALENTO_MAX = 5;
export const TALENTOS = [
  { id: 'fuerza',    nombre: 'Fuerza',       icono: 'S_Sword19', por: 0.02, txt: '+2% de ataque' },
  { id: 'vida',      nombre: 'Vitalidad',    icono: 'S_Holy10',  por: 0.03, txt: '+3% de vida' },
  { id: 'critico',   nombre: 'Precisión',    icono: 'S_Bow09',   por: 0.01, txt: '+1% de crítico' },
  { id: 'defensa',   nombre: 'Armadura',     icono: 'E_Metal07', por: 0.03, txt: '+3% de defensa' },
  { id: 'celeridad', nombre: 'Celeridad',    icono: 'S_Thunder03', por: 0.03, txt: '-3% de recarga de habilidades' },
  { id: 'sabiduria', nombre: 'Sabiduría',    icono: 'S_Magic03', por: 0.08, txt: '+8% de regeneración de maná, ira o energía' },
  { id: 'sanacion',  nombre: 'Sanación',     icono: 'S_Holy02',  por: 0.04, txt: '+4% a tus curas y escudos' },
  { id: 'fortuna',   nombre: 'Fortuna',      icono: 'I_GoldCoin', por: 0.03, txt: '+3% de oro de los monstruos' },
  { id: 'erudicion', nombre: 'Erudición',    icono: 'I_Book',    por: 0.02, txt: '+2% de experiencia' },
  { id: 'agilidad',  nombre: 'Agilidad',     icono: 'S_Wind03',  por: 0.02, txt: '+2% de velocidad al caminar' },
];
export const puntosTalento = nivel => Math.max(0, nivel - TALENTO_NIVEL + 1);
export const costoReinicioTalentos = nivel => 100 * nivel;
// Bonus de un talento (0 si no tiene rangos).
export function talento(c, id) {
  const t = TALENTOS.find(x => x.id === id);
  return t ? t.por * Math.min(TALENTO_MAX, ((c && c.tal) || {})[id] || 0) : 0;
}

// ── MONTURAS ──
// Se compran con oro al Mercader y se invocan en 1,5 s fuera de combate (no
// en mazmorras ni en el Coliseo). Atacar, usar una habilidad o recibir un
// golpe te baja. dy: cuanto se eleva el jinete sobre la montura.
export const MONTURAS = {
  lagarto:   { nombre: 'Lagarto del Desierto', hoja: 'lagarto',   nv: 20, precio: 8000,   vel: 1.5, alto: 48, dy: 22 },
  conejo:    { nombre: 'Conejo Saltarín',      hoja: 'conejo',    nv: 20, precio: 8000,   vel: 1.5, alto: 40, dy: 24 },
  sapo:      { nombre: 'Sapo Gigante',         hoja: 'rana',      nv: 25, precio: 15000,  vel: 1.55, alto: 74, dy: 30 },
  hellgato:  { nombre: 'Gato Infernal',        hoja: 'hellgato',  nv: 35, precio: 35000,  vel: 1.7, alto: 44, dy: 22 },
  hellhound: { nombre: 'Sabueso de Guerra',    hoja: 'hellhound', nv: 40, precio: 60000,  vel: 1.8, alto: 52, dy: 26 },
  aguila:    { nombre: 'Águila Real',          hoja: 'aguila',    nv: 50, precio: 150000, vel: 1.9, alto: 70, dy: 38, tinte: '#d4a24a' },
  dragon:    { nombre: 'Dragón Ancestral',     hoja: 'dragon',    nv: 60, precio: 300000, vel: 2,   alto: 84, dy: 40 },
  // No se vende: se gana venciendo al Titan de la banda en 3 semanas.
  abismo:    { nombre: 'Murciélago del Abismo', hoja: 'murcielago', nv: 60, precio: 0, banda: true, vel: 2, alto: 76, dy: 30 },
  // No se vende: se gana superando el piso TORRE.montura de la Torre del Duende.
  torre:     { nombre: 'Lagarto de la Torre',   hoja: 'lagarto',   nv: 10, precio: 0, torre: true, vel: 1.8, alto: 52, dy: 23, tinte: '#c084fc' },
};
export const MONTAR_MS = 1500;
// Colores del nombre (solo se ven, no dan nada): metas de oro a largo plazo
// que todos ven sobre tu duende. 'arcoiris' cambia de color.
export const TINTES = {
  oro:       { nombre: 'Oro Duende', color: '#ffd84a', nv: 10, precio: 20000 },
  esmeralda: { nombre: 'Esmeralda',  color: '#34d399', nv: 20, precio: 40000 },
  rubi:      { nombre: 'Rubí',       color: '#fb7185', nv: 30, precio: 60000 },
  amatista:  { nombre: 'Amatista',   color: '#c084fc', nv: 40, precio: 100000 },
  arcoiris:  { nombre: 'Arcoíris',   color: 'arcoiris', nv: 60, precio: 500000 },
};
// Novedades: al entrar, a quien no las vio en este dispositivo se le
// enseñan una vez (lo nuevo para los que vuelven). La mas reciente arriba;
// subir 'n' al añadir una.
// ── APARIENCIA DEL DUENDE (editor del mundo 3D) ──
// Solo cara, cuerpo, altura y pelo (estilo y color): la ropa sale de la skin
// y el casco/sombrero, de la clase. El servidor guarda c.look ya limpio.
export const APARIENCIA = {
  cara: ['Clásica', 'Pecosa', 'Cicatriz', 'Bigotes', 'Barba', 'Ojos grandes'],
  cuerpo: ['Delgado', 'Normal', 'Robusto'],
  altura: { min: 0.9, max: 1.12, paso: 0.01 },
  pelo: ['Calvo', 'Corto', 'Cresta', 'Coleta', 'Melena', 'Moño', 'Rastas', 'Puntas'],
  colorPelo: ['#2b1d14', '#6b3f1f', '#c98a3c', '#e8d27a', '#d9442b', '#f4f4f4', '#3b82f6', '#a855f7'],
};
export const LOOK_BASE = { cara: 0, cuerpo: 1, altura: 1, pelo: 1, colorPelo: 1 };
// Deja solo valores validos (lo que llegue del cliente no se cree tal cual).
export function limpiarLook(l) {
  l = l && typeof l === 'object' ? l : {};
  const ent = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
  const alt = typeof l.altura === 'number' && Number.isFinite(l.altura) ? Math.round(Math.min(APARIENCIA.altura.max, Math.max(APARIENCIA.altura.min, l.altura)) * 100) / 100 : 1;
  return {
    cara: ent(l.cara, APARIENCIA.cara.length, LOOK_BASE.cara),
    cuerpo: ent(l.cuerpo, APARIENCIA.cuerpo.length, LOOK_BASE.cuerpo),
    altura: alt,
    pelo: ent(l.pelo, APARIENCIA.pelo.length, LOOK_BASE.pelo),
    colorPelo: ent(l.colorPelo, APARIENCIA.colorPelo.length, LOOK_BASE.colorPelo),
  };
}

export const NOVEDADES = [
  { n: 39, fecha: '23 oct 2026', items: [
    'Los juegos estrenan nombre: el MMO 2D es $DUENDE CLASSIC y el mundo abierto 3D es $DUENDE ORIGINS. Mismo duende, mismo servidor.',
    'Una skin, dos juegos: lo que compras o ganas (skins, alas, oro, equipo y nivel) vale a la vez en CLASSIC y en ORIGINS.',
    'Portada nueva: elige tu juego con su tráiler, que ahora tiene música y sonido (toca «Activar sonido»).',
  ] },
  { n: 38, fecha: '23 oct 2026', items: [
    'Hermandades en el mundo 3D (botón 🛡): fúndala, invita desde el marco del jugador, ascienda oficiales, cambie el color y el mensaje del día, y siga la gesta semanal.',
    'Chat de hermandad: escribe /h y tu mensaje. El nombre de tu hermandad sale bajo el tuyo, en su color.',
    'Ranking en el 3D (botón 🏅): semana, nivel, duelos, hermandades y torre, con la cuenta atrás del cierre semanal.',
  ] },
  { n: 37, fecha: '23 oct 2026', items: [
    'Recompensa diaria en el mundo 3D: al entrar ves tu racha de 7 días, lo que ganas hoy y lo que te espera mañana (si faltas un día, retrocede).',
    'Pase de temporada en el 3D (botón 🎟): 20 niveles de premios gratis que se reinician cada mes, con un aviso rojo cuando tienes premios por cobrar.',
    'La barra de botones de arriba ya no se sale de la pantalla en ventanas estrechas.',
  ] },
  { n: 36, fecha: '23 oct 2026', items: [
    '¡El mundo abierto 3D ya está a un toque! Botón «🌌 3D» destacado en el juego, aviso con vídeo al entrar y acceso directo en la portada y en el menú de Telegram.',
    'En el 3D: tu mismo duende (nivel, oro, equipo y skins), vuelo con alas, el Abismo de Éter con PvP de facciones y el asedio de la Fortaleza del Núcleo.',
  ] },
  { n: 35, fecha: '23 oct 2026', items: [
    'Tu duende 3D se parece por fin al de los dibujos: nariz ganchuda, ojos ámbar con cejas fruncidas, sonrisa con dientes y orejas grandes. Los ojos grandes y tiernos siguen como opción en el editor de aspecto.',
    'Skins rediseñadas como en su imagen: Táctico con capucha, visor y teclado holográfico; Nigromante con capucha, ojos que brillan, orbe y humo; Rey con corona de gemas, traje con neón y móvil con el gráfico.',
    'Berserker con peluca de juez, corona, toga dorada, chorrera, mazo y anillos de runas; Legendaria con ojos de fuego, hombreras con púas, orbe y katana de neón.',
    'Cuerpo más trabajado: hombros redondos, pulgares, punteras en las botas y manos más grandes.',
  ] },
  { n: 34, fecha: '23 oct 2026', items: [
    'Telegram a pantalla completa en el móvil: el mundo 3D ocupa toda la pantalla y el HUD se aparta de los botones de Telegram.',
    'Vibración al golpear, al recibir daño, en los críticos, al subir de nivel y al abatir a un rival (en Telegram).',
    'Nuevo botón 📣 para invitar amigos: en Telegram publica una historia con una imagen del juego y el enlace del bot.',
    'Al subir de nivel: lluvia de luz dorada y, cada 5 niveles, «Presúmelo en tu historia». El botón Atrás de Telegram cierra las ventanas.',
    'Más fluido al empezar: los gráficos se preparan durante la carga y la música se pausa si minimizas Telegram.',
  ] },
  { n: 33, fecha: '23 oct 2026', items: [
    '¡Asedio de la Fortaleza del Núcleo! Cada 2 horas (a las :25 de las horas pares, hora UTC) hay 20 minutos de asedio en el Abismo de Éter, con aviso 2 minutos antes.',
    'La facción que no es dueña rompe la Puerta del Núcleo. Entonces despierta el Guardián del Núcleo: ondas avisadas en el suelo, guardia real al 50% y furia al 30%. Quien más lo daña se queda la fortaleza.',
    'Máquinas de asedio: en tu bastión, acércate a la catapulta, la balista o el trebuchet y pulsa E para disparar a la puerta desde lejos.',
    'Premios del asedio: Puntos del Abismo y oro para quien aporte (2 completos al día). Si se acaba el tiempo, resisten los defensores. La facción dueña gana +1 PA por cada élite.',
    'El Núcleo y las banderas de la fortaleza muestran el color de la facción dueña; el panel del Abismo enseña el tiempo, la vida de la puerta y la del Guardián.',
  ] },
  { n: 32, fecha: '23 oct 2026', items: [
    'Mundo renovado con arte profesional CC0 de Kenney: nuevos árboles, pinos, palmeras, rocas, flores, setas y tocones, teñidos con los colores de cada zona.',
    'El pueblo, reconstruido: casas de piedra y entramado de madera con ventanas, puertas y chimeneas, una fuente en la plaza, puestos de mercado, carros, faroles y un molino de viento.',
    'Los bastiones del Abismo, ahora fortalezas: torres con estandartes, murallas con puertas y catapultas, balistas y trebuchets.',
    'Sonido nuevo: pasos según el suelo, impactos de golpe y de crítico, voces de los monstruos al atacar y al caer, monedas, alas que se despliegan y libros al abrir ventanas.',
    'Arreglado: en el Abismo ya no aparece «Pescar» ni se flota sobre agua invisible al caer al vacío, y su cielo violeta ya no cambia con la hora.',
  ] },
  { n: 31, fecha: '23 oct 2026', items: [
    'Efectos nuevos: chispas al golpear (doradas en los críticos), estallido de luz al vencer a un monstruo y polvo al aterrizar de un salto alto.',
    'Ambiente vivo: luciérnagas de noche, motas de éter en el Abismo y polvo en la cueva.',
    'Calidad alta: resplandor en cristales, magia y portales, con viñeta y color más vivos.',
    'Más fluido: la resolución se ajusta sola si el dispositivo va justo, los números de daño saltan con fuerza y el campo de visión se abre al galopar o volar rápido.',
  ] },
  { n: 30, fecha: '23 oct 2026', items: [
    '¡PvP de facciones en el Abismo! Selecciona a un jugador de la otra facción (nombre en rojo) y atácalo como a un monstruo. Allí sí se muere.',
    'Puntos del Abismo y 8 rangos, de Recluta a Héroe del Éter. Se ganan abatiendo enemigos (con asistencias para tu grupo) y cazando élites; morir cuesta algunos.',
    'Los bastiones son santuario: dentro nadie pelea contra jugadores.',
    'En Telegram: nuevo botón «Mundo abierto 3D» y el comando /mundo.',
  ] },
  { n: 29, fecha: '23 oct 2026', items: [
    '¡Nuevo: el Abismo de Éter! Un archipiélago de islas flotantes sobre el vacío (desde nivel 20). Se entra por el portal del pueblo.',
    'Elige tu facción para siempre: Guardianes de la Luz o Hijos de la Sombra. Cada una tiene su bastión, y la Fortaleza del Núcleo queda en medio.',
    'Entre las islas solo se pasa volando o planeando: caer al vacío mata. Hay campamentos de élite en las islas y se revive en el bastión propio.',
    'En el Abismo, los nombres de la otra facción se ven en rojo.',
  ] },
  { n: 28, fecha: '23 oct 2026', items: [
    'Lo que tapa a tu duende (árboles, casas, rocas de la cueva) se vuelve transparente, como en WoW.',
    'Luz más viva: el sol marca los volúmenes y el cielo de cada zona tiñe la sombra.',
    'Móvil: la barra de habilidades en dos filas (antes se salía de la pantalla), botones más grandes, botón HABLAR/RECOGER/PESCAR y nada tapa los controles.',
  ] },
  { n: 27, fecha: '23 oct 2026', items: [
    'El doble de fluido: los modelos 3D se dibujan con un tercio de las piezas y el combate va a 1-2 ms por cuadro.',
    'Monstruos más listos: siguen al que más amenaza genera (el tanque puede quitarles el foco), rodean al jugador, no atraviesan casas ni las paredes de la cueva y no se reinician mientras el grupo siga peleando.',
    'Mejor física: caes al salir de un borde, puedes saltar justo después (y si pulsas antes de tocar el suelo), salto corto si sueltas pronto, y planeo automático si se cansan las alas.',
    'Cámara: ya no se pega al duende; sube por encima del hombro en los pasillos de la cueva y esquiva las colinas.',
  ] },
  { n: 26, fecha: '23 oct 2026', items: [
    'Combate sin lag: los golpes ya no se pierden por la red, la vida baja al instante, los monstruos se mueven suaves y la recarga de cada habilidad se ve en su botón.',
    'Cola de hechizos como en WoW: si pulsas una habilidad justo antes de que acabe la recarga global, sale sola.',
    'Mucho menos tráfico: el juego ya no reenvía todo tu personaje con cada monstruo que matas.',
  ] },
  { n: 25, fecha: '23 oct 2026', items: [
    'Física nueva en el mundo 3D: ya no se atraviesan casas, troncos, rocas ni personajes; tu duende se desliza por ellos.',
    'Movimiento con inercia ligera (arranca y frena suave, menos agarre en el aire y en el agua) y giro suave hacia donde caminas.',
  ] },
  { n: 24, fecha: '23 oct 2026', items: [
    'Nada en medio de la pantalla: los avisos van a la izquierda sobre el chat y las ventanas (PNJ, inventario, libro, tienda, logros, ayuda) se abren a un lado y puedes seguir caminando.',
    'La cámara ya no se pega al duende al pasar junto a casas y árboles.',
    'La flecha del minimapa apunta hacia donde mira tu duende (y un cono muestra hacia dónde mira la cámara).',
    'Combates más fluidos: los sonidos ya no causan tirones.',
  ] },
  { n: 23, fecha: '23 oct 2026', items: [
    'Alas como en AION: 8 tipos con su forma (luz, plumas, mariposa, membrana de dragón) y más tiempo y velocidad de vuelo. Mercader → ALAS.',
    'Las Alas del Rey Goblin se ganan completando 5 mazmorras; las de $DUENDE y las Solares son premium (SOL o $DUENDE).',
    'Planeo: mantén Espacio al caer y planeas sin gastar energía de alas.',
  ] },
  { n: 22, fecha: '23 oct 2026', items: [
    'Calidad gráfica en el mundo 3D (botón ?): Baja para móviles lentos, Media o Alta con sombras reales del sol.',
    'Más fluido: lo lejano se anima a medias y lo que queda tras la niebla no se dibuja. En el móvil, botones en dos columnas y paneles que ya no tapan los controles.',
  ] },
  { n: 21, fecha: '23 oct 2026', items: [
    'Los modelos 3D ahora copian a su dibujo 2D: cada monstruo y cada skin con sus colores, su forma y sus accesorios, para reconocerlos al momento.',
    'Duelos en el mundo 3D: haz clic en otro jugador y pulsa «Retar a duelo». Ataque automático y habilidades de un objetivo; nadie muere y cuenta para el Elo.',
    'Pesca en cualquier orilla del 3D: pulsa E junto al agua y otra vez cuando se hunda el corcho. Cada zona tiene su especie; con lluvia pican más dorados.',
  ] },
  { n: 20, fecha: '23 oct 2026', items: [
    '¡Primera mazmorra 3D! La Cueva de los Goblins: entra por el portal del pueblo, solo o con tu grupo (cada grupo tiene su propia cueva).',
    'Salas con goblins que atacan en grupo y el Rey Goblin en su trono: esquiva sus pisotones, aguanta a su guardia y llévate un cofre con equipo raro o mejor.',
    'La cueva se adapta al nivel del más alto del grupo y cuenta como mazmorra completada.',
  ] },
  { n: 19, fecha: '23 oct 2026', items: [
    'Editor de personaje en el mundo 3D (botón 🪞): elige cara, forma del cuerpo, altura, peinado y color de pelo. Todos lo ven.',
    'Seis caras (pecosa, cicatriz, bigotes, barba…), tres cuerpos y ocho peinados que asoman bajo el casco o la capucha de tu clase.',
  ] },
  { n: 18, fecha: '23 oct 2026', items: [
    'Rastreador de misiones en el 3D: tu misión y la caza del día bajo el minimapa, con flecha y distancia.',
    'Una columna de luz marca el campamento al que tienes que ir y el minimapa muestra ! (o ? cuando toca volver con el Guardia).',
  ] },
  { n: 17, fecha: '23 oct 2026', items: [
    'Recolección en el mundo 3D: 228 hierbas y vetas repartidas por las zonas (salen en el minimapa). Acércate y pulsa E.',
    'La Artesana Lila del pueblo 3D ya fabrica pociones, escudos, elixires y recetas de pescado con lo que recojas.',
  ] },
  { n: 16, fecha: '23 oct 2026', items: [
    'Día y noche en el mundo 3D (un día dura 48 minutos): amaneceres, ocasos, estrellas y faroles en el pueblo. De noche los monstruos dan +10% de experiencia.',
    'Clima por zona: lluvia, tormentas con relámpagos, nieve en las cumbres, niebla y tormentas de arena. La hora y el clima salen bajo el minimapa.',
    'Música propia para cada zona, más tranquila de noche, y sonido de lluvia y truenos. Botón 🔊 para silenciar.',
  ] },
  { n: 15, fecha: '23 oct 2026', items: [
    'Grupos en el mundo 3D: haz clic en otro jugador para invitarlo; marcos de grupo con la vida de cada uno.',
    'Cazar en grupo cuenta para todos: los compañeros cerca cobran la caza para sus misiones y diarias.',
    'Chat de grupo con /g y susurros con /s nombre.',
  ] },
  { n: 14, fecha: '23 oct 2026', items: [
    'Mundo 3D con modelos 3D de verdad: tu duende lleva el casco, la capucha o el sombrero de su clase y su arma; más de 70 monstruos con su propio cuerpo y animaciones.',
    'Monturas con jinete, alas a la espalda y una cámara que ya no se queda detrás de los árboles.',
  ] },
  { n: 13, fecha: '23 oct 2026', items: [
    'Jefe mundial del 3D: a las :15 y :45 aparece en el Claro del Titán. ¡Esquiva sus pisotones saliendo del círculo rojo!',
    'Todos los niveles reciben premio: XP, oro, una pieza de equipo y mTON.',
  ] },
  { n: 12, fecha: '23 oct 2026', items: [
    'Mundo 3D: tus habilidades de clase (teclas 2 a 9) con lanzamientos, combos y efectos.',
    '¡Vuela! Pulsa V o salta dos veces para desplegar las alas: Espacio sube y C baja. En el pueblo no se vuela.',
    'Monturas en el 3D (Y) e inventario (I), talentos (P), logros (L) y tienda completa sin salir del mundo.',
  ] },
  { n: 11, fecha: '23 oct 2026', items: [
    'Duende Quest 3D (beta): un mundo abierto en 3D, sin pantallas de carga, con el pueblo y las 10 zonas en un solo mapa. Botón 3D o duende-quest/mundo.',
    'Es tu mismo personaje: nivel, clase, oro, skins, misiones y diarias avanzan en los dos mundos.',
    'Cámara libre, ataque automático que te lleva a tu objetivo, jefes de zona y otros jugadores en tiempo real. En el móvil, joystick y botones.',
  ] },
  { n: 10, fecha: '23 oct 2026', items: [
    'Mundo abierto: las zonas se cruzan caminando por sus bordes, sin pantalla de carga.',
    'Piedras de viaje en cada zona: viaja al instante a las zonas que ya descubriste.',
    'Marcha de invasores: si ganas una invasión, huyen a la zona vecina y la persecución sigue hasta 3 etapas, con más premio en cada una.',
    'Cuenta con correo y contraseña dentro del juego: crea tu cuenta, recupera la contraseña y guarda tu personaje de invitado.',
    'Salto más preciso: margen al caer de un borde, salto memorizado y salto corto al soltar.',
    '4 skins exclusivas animadas (Esmeralda, Sombrío, Solar y Cósmico).',
  ] },
  { n: 9, fecha: '22 oct 2026', items: [
    'Interfaz renovada: iconos dibujados en el HUD, botones táctiles nuevos y avisos más claros.',
    'Guía del juego por secciones y pantalla de carga con consejos.',
    'Marco del objetivo con acciones a la vista: Grupo, Hermandad, Mensaje, Duelo, Amigo y Ver.',
    'Chat en el móvil: panel de gestos y frases rápidas.',
    'La Tienda premium muestra los precios antes de iniciar sesión.',
  ] },
  { n: 8, fecha: '22 oct 2026', items: [
    '🌧️ Clima: algunas horas llueve o nieva en ciertas zonas; con lluvia el Pez Dorado sale el doble.',
    '🐟 Colección de especies de peces: una por pesquero, oro la primera vez y el logro Ictiólogo.',
    '🧭 Expediciones con destino (Bosque, Mina o Lago) y misión diaria nueva; semanal de la Torre.',
    '🗼 Torre: pisos con modificadores (Veloces, Blindados, Élite) y el Lagarto de la Torre al piso 30.',
    '🏰 En las mazmorras revives junto a la última barrera abierta y los packs vuelven a su sitio.',
    '✨ Vitrina de skins junto al Mercader.',
    '💳 En la web, las skins se pueden pagar escaneando un QR con tu wallet.',
  ] },
  { n: 7, fecha: '22 oct 2026', items: [
    '🏰 Madriguera Goblin: una mazmorra nueva desde Nv 6 para aprender las mecánicas (portal de mazmorras del pueblo).',
    '🧭 Expediciones (Nv 5+): manda a tu mascota 1, 4 u 8 horas y vuelve con oro, experiencia y materiales (registro de misiones, L).',
    '🐟 Pececito Dorado: una mascota que solo se consigue pescando (muy rara).',
    '🦎 Lagarto de la Torre: una montura que solo se gana superando el piso 30 de la Torre.',
    '🛡️ Ranking semanal de hermandades y /topmmo en el bot con los rankings de la semana.',
    '📅 Calendario en Novedades y barras de progreso en los logros.',
  ] },
  { n: 6, fecha: '22 oct 2026', items: [
    '🗼 Torre del Duende (Nv 10+, portal de mazmorras): pisos sin fin cada vez más duros, un jefe cada 5, cofres y ranking semanal.',
    '🎣 Pesca: hay un pesquero en el pueblo y en cada zona. Lanza el sedal y TIRA cuando pique.',
    '🍲 La Artesana cocina Ceviche del Duende (+10% oro) y Sudado Dorado (+5% daño y -5% daño recibido) con lo que pesques.',
    '🏅 Logros Pescador y Maestro Pescador, y una misión diaria nueva.',
  ] },
  { n: 5, fecha: '22 oct 2026', items: [
    '🎟️ Pase de temporada mensual y gratis: misiones, mazmorras y jefe mundial dan puntos; 20 niveles de premios y una mascota exclusiva (registro de misiones, L).',
    '👹 Jefes mundiales que rotan: el Gran Duende, el Dragón de la Tormenta y el Coloso de Obsidiana.',
    '🧳 Mercader ambulante los fines de semana: colores y mascotas que no se venden el resto de la semana.',
    '⚔️ Ranking de duelos con Elo (huir cuenta como derrota).',
  ] },
  { n: 4, fecha: '22 oct 2026', items: [
    '⚡ Hora Feliz cada día de 20:00 a 21:00 (hora de Perú): +50% de experiencia por caza.',
    '🎭 Las skins dan más poderes (crítico, defensa, experiencia...) y se pueden probar 10 s en el Mercader.',
    '💳 Skins también con SOL en la web o con Stars en Telegram; El Duende revisa el pago y te la entrega.',
    '👋 Gestos (/saludar, /bailar...), lista de amigos con aviso al conectarse e Inspeccionar.',
    '📊 Tus estadísticas en el inventario.',
  ] },
  { n: 3, fecha: '21 oct 2026', items: [
    '⚔️ Primera BANDA: el Santuario del Titán (Nv 60, de 1 a 10 jugadores), en el portal de mazmorras del pueblo. Cuatro jefes, botín de nivel 64-66 una vez por semana y el Murciélago del Abismo si vences al Titán en 3 semanas.',
    '👥 El líder puede convertir su grupo en banda (hasta 10) desde Social > Grupo.',
    '🟡 Zonas doradas: hay que aguantarlas juntos, el golpe se reparte entre los que estén dentro.',
    '🐸 Monturas nuevas en el Mercader: Sapo Gigante (Nv 25) y Águila Real (Nv 50). Y cuatro mascotas más: Arañita, Cangrejito, Pulpito y Fantasmita.',
    '📅 Temporadas de 2027: Verano Duende (enero), Vendimia (marzo), Lluvia de Estrellas (abril), Fiesta del Sol (junio) y Fiestas Patrias (julio).',
    '🏆 Gesta semanal de hermandad: entre todos suman puntos cazando, venciendo jefes y completando mazmorras; Bronce, Plata y Oro dan oro a quien aportó.',
    '✨ Runas en la Artesana (desde Nv 40): +2% de ataque, defensa o vida por rango, hasta +10%. Piden Flor de Luna y Mithril (zonas Nv 30+) y Esencia Abisal (jefes de mazmorras de Nv 40+).',
  ] },
  { n: 2, fecha: '21 oct 2026', items: [
    '🏰 Dos mazmorras nuevas: la Fortaleza Goblin (Nv 20-40) y el Nido de la Reina Araña (Nv 40-58).',
    '🗝️ Bóveda semanal: cuantas más mazmorras hagas en la semana, más objetos para elegir el lunes.',
    '📢 Buscador de grupo en el portal de mazmorras: anúnciate y otros se unen con un toque.',
    '⚡ Desafíos con afijos que cambian cada lunes y su propio ranking semanal.',
    '🐾 Mascotas y 🎨 colores de nombre en el Mercader (solo estética).',
    '⭐ Lista de amigos (pestaña En línea): ves cuándo se conectan, les susurras o invitas al grupo.',
    '🔍 Inspecciona a otro jugador desde su marco: su equipo, conjuntos y logros.',
    '👋 Gestos: /saludar, /bailar, /reir, /aplaudir… (en el móvil, en el chat rápido).',
    '⚗️ Elixir de Sabiduría en la Artesana: +10% de experiencia por caza durante 30 min.',
    '🎩 Cada clase se distingue: sombrero de mago, aureola de sacerdote, capucha de pícaro.',
    '🌽 Del 13 al 30 de noviembre: Cosecha del Maíz Morado.',
    '📱 El juego va mucho más fluido en el móvil y la música suena en iPhone.',
  ] },
];
// Mascotas (solo se ven, no dan nada): te siguen a todas partes. Otra meta
// de oro a largo plazo. Usan las hojas de los monstruos, en pequeño.
export const MASCOTAS = {
  hongo:      { nombre: 'Hongo Saltarín',    hoja: 'hongo',      alto: 24, nv: 10, precio: 15000 },
  rana:       { nombre: 'Rana Charquera',    hoja: 'rana',       alto: 24, nv: 15, precio: 25000 },
  zarigueya:  { nombre: 'Zarigüeya Ladrona', hoja: 'zarigueya',  alto: 22, nv: 20, precio: 40000 },
  arana:      { nombre: 'Arañita de Seda',   hoja: 'arana',      alto: 18, nv: 25, precio: 30000 },
  pajaro:     { nombre: 'Pájaro Hueso',      hoja: 'pajaro',     alto: 24, nv: 30, precio: 70000, vuela: true },
  cangrejo:   { nombre: 'Cangrejito',        hoja: 'cangrejo',   alto: 22, nv: 35, precio: 55000 },
  pulpo:      { nombre: 'Pulpito Brujo',     hoja: 'pulpo',      alto: 24, nv: 40, precio: 90000, vuela: true },
  murcielago: { nombre: 'Murciélago Real',   hoja: 'murcielago', alto: 30, nv: 45, precio: 150000, vuela: true },
  fantasma:   { nombre: 'Fantasmita',        hoja: 'fantasma',   alto: 28, nv: 50, precio: 200000, vuela: true },
};
export const velMontura = id => (MONTURAS[id] ? MONTURAS[id].vel : 1);

// Cambiar de clase: gratis hasta Nv 10, luego cuesta oro (asi se puede
// probar sin miedo, pero no se cambia por capricho a nivel alto).
export const costoCambioClase = nivel => (nivel < 10 ? 0 : 200 * nivel);

// Habilidades. costo: puntos de ira/energia, o % del mana maximo.
// rango: px desde el jugador al objetivo ('melee' = 100). obj: 'enemigo',
// 'aliado' (otro jugador o uno mismo), 'yo' o 'area' (alrededor).
// mult: daño = ataque × mult (× forja del arma). cura: ataque × cura.
export const MELEE = 105;
export const HABS = [
  // ── GUERRERO ──
  { id: 'golpe_heroico', clase: 'guerrero', nombre: 'Golpe Heroico', nv: 1, icono: 'S_Sword15', costo: 15, cd: 0, rango: MELEE, obj: 'enemigo', mult: 3, amenaza: 2.5,
    desc: 'Un golpe brutal (×3) que genera muchísima amenaza.' },
  { id: 'carga', clase: 'guerrero', nombre: 'Carga', nv: 4, icono: 'S_Dagger03', costo: 0, genera: 20, cd: 12000, rango: 380, min: 60, obj: 'enemigo', aturde: 1500, gcd: false,
    desc: 'Cargas contra el enemigo, lo aturdes 1,5 s y ganas 20 de Ira.' },
  { id: 'provocar', clase: 'guerrero', nombre: 'Provocar', nv: 8, icono: 'S_Buff14', costo: 0, cd: 8000, rango: 320, obj: 'enemigo', gcd: false,
    desc: 'Obligas al enemigo a atacarte a ti durante 3 s y te pones primero en su lista de odio.' },
  { id: 'zurrar', clase: 'guerrero', nombre: 'Zurrar', nv: 12, icono: 'S_Sword07', costo: 10, cd: 12000, rango: MELEE, obj: 'enemigo', mult: 0.6, interrumpe: 4000, gcd: false,
    desc: 'Un golpe seco que interrumpe el hechizo que el enemigo esté lanzando (y no puede lanzar otro en 4 s).' },
  { id: 'torbellino', clase: 'guerrero', nombre: 'Torbellino', nv: 14, icono: 'S_Wind02', costo: 25, cd: 6000, radio: 150, obj: 'area', mult: 2.2, amenaza: 1.5,
    desc: 'Giras con el arma y golpeas a todo lo que te rodea (×2,2).' },
  { id: 'grito', clase: 'guerrero', nombre: 'Grito de Batalla', nv: 20, icono: 'S_Buff08', costo: 10, cd: 30000, radio: 500, obj: 'yo', dura: 120000,
    desc: '+10% de ataque para ti y los aliados cercanos durante 2 minutos.' },
  { id: 'muro', clase: 'guerrero', nombre: 'Muro de Escudo', nv: 28, icono: 'E_Metal06', costo: 0, cd: 45000, obj: 'yo', dura: 8000, reduce: 0.6, gcd: false,
    desc: 'Recibes un 60% menos de daño durante 8 s.' },
  { id: 'ejecutar', clase: 'guerrero', nombre: 'Ejecutar', nv: 36, icono: 'S_Sword10', costo: 30, cd: 0, rango: MELEE, obj: 'enemigo', mult: 9, bajo: 0.25,
    desc: 'Remata a un enemigo con menos del 25% de vida (×9).' },
  // ── MAGO ──
  { id: 'bola_fuego', clase: 'mago', nombre: 'Bola de Fuego', nv: 1, icono: 'S_Fire03', costo: 7, cd: 0, cast: 1500, rango: 430, obj: 'enemigo', mult: 5.5,
    desc: 'Lanzas una bola de fuego (×5,5). 1,5 s de lanzamiento.' },
  { id: 'nova', clase: 'mago', nombre: 'Nova de Escarcha', nv: 4, icono: 'S_Ice02', costo: 9, cd: 14000, radio: 160, obj: 'area', mult: 1.5, raiz: 5000,
    desc: 'Congelas en el sitio a todo lo cercano 5 s (×1,5). ' },
  { id: 'misiles', clase: 'mago', nombre: 'Misiles Arcanos', nv: 8, icono: 'S_Magic02', costo: 10, cd: 6000, rango: 430, obj: 'enemigo', mult: 6, golpes: 3,
    desc: 'Tres misiles al instante (×2 cada uno).' },
  { id: 'polimorfia', clase: 'mago', nombre: 'Polimorfia', nv: 14, icono: 'S_Magic01', costo: 6, cd: 0, cast: 1500, rango: 380, obj: 'enemigo', dura: 15000,
    desc: 'Conviertes al enemigo en oveja 15 s (se rompe si recibe daño). No afecta a jefes.' },
  { id: 'contrahechizo', clase: 'mago', nombre: 'Contrahechizo', nv: 16, icono: 'S_Magic11', costo: 8, cd: 20000, rango: 410, obj: 'enemigo', mult: 0.3, interrumpe: 5000, gcd: false,
    desc: 'Cortas el hechizo que el enemigo esté lanzando, desde lejos (y no puede lanzar otro en 5 s).' },
  { id: 'evocacion', clase: 'mago', nombre: 'Evocación', nv: 20, icono: 'S_Magic04', costo: 0, cd: 60000, cast: 4000, obj: 'yo', gcd: true,
    desc: 'Te concentras 4 s y recuperas el 60% del maná.' },
  { id: 'bloque', clase: 'mago', nombre: 'Bloque de Hielo', nv: 28, icono: 'S_Ice07', costo: 0, cd: 60000, obj: 'yo', dura: 6000, gcd: false,
    desc: 'Te encierras en hielo: inmune a todo 6 s, pero no puedes actuar.' },
  { id: 'meteoros', clase: 'mago', nombre: 'Lluvia de Meteoros', nv: 36, icono: 'S_Fire05', costo: 20, cd: 18000, cast: 2000, radio: 430, obj: 'area', mult: 7, multJefe: 4,
    desc: 'Llueven meteoros sobre todo lo que ves (×7; ×4 a jefes).' },
  // ── SACERDOTE ──
  { id: 'castigo', clase: 'sacerdote', nombre: 'Castigo', nv: 1, icono: 'S_Light01', costo: 6, cd: 0, cast: 1500, rango: 410, obj: 'enemigo', mult: 5.5,
    desc: 'Luz sagrada contra el enemigo (×5,5). 1,5 s de lanzamiento.' },
  { id: 'sanar', clase: 'sacerdote', nombre: 'Sanar', nv: 1, icono: 'S_Holy03', costo: 10, cd: 0, cast: 1800, rango: 420, obj: 'aliado', cura: 3.2,
    desc: 'Curas a un aliado (o a ti) ataque ×3,2. 1,8 s de lanzamiento.' },
  { id: 'escudo_poder', clase: 'sacerdote', nombre: 'Palabra de Poder: Escudo', nv: 4, icono: 'S_Holy09', costo: 12, cd: 4000, rango: 420, obj: 'aliado', absorbe: 4, dura: 15000,
    desc: 'Un escudo que absorbe daño (ataque ×4) durante 15 s. El mismo aliado no puede recibir otro en 12 s.' },
  { id: 'dolor', clase: 'sacerdote', nombre: 'Palabra de las Sombras: Dolor', nv: 8, icono: 'S_Shadow06', costo: 5, cd: 0, rango: 410, obj: 'enemigo', mult: 9, dura: 15000,
    desc: 'Dolor oscuro que hace ataque ×9 en 15 s.' },
  { id: 'renovar', clase: 'sacerdote', nombre: 'Renovar', nv: 14, icono: 'S_Holy01', costo: 9, cd: 0, rango: 420, obj: 'aliado', cura: 4, dura: 12000,
    desc: 'Curación continua: ataque ×4 repartido en 12 s.' },
  { id: 'silencio', clase: 'sacerdote', nombre: 'Silencio', nv: 18, icono: 'S_Shadow07', costo: 6, cd: 30000, rango: 400, obj: 'enemigo', mult: 0.3, interrumpe: 5000, gcd: false,
    desc: 'Silencias al enemigo: interrumpe su hechizo y no puede lanzar ni disparar en 5 s.' },
  { id: 'rezo', clase: 'sacerdote', nombre: 'Rezo de Sanación', nv: 22, icono: 'S_Holy06', costo: 22, cd: 0, cast: 2500, radio: 480, obj: 'yo', cura: 2.6,
    desc: 'Curas a todos los aliados cercanos ataque ×2,6. 2,5 s de lanzamiento.' },
  { id: 'supresion', clase: 'sacerdote', nombre: 'Supresión de Dolor', nv: 32, icono: 'S_Holy08', costo: 8, cd: 60000, rango: 420, obj: 'aliado', dura: 8000, reduce: 0.4, gcd: false,
    desc: 'El aliado recibe un 40% menos de daño durante 8 s.' },
  // Resurreccion: no va en la barra, sale en el boton de accion junto a un
  // aliado caido (como "hablar" o "entrar").
  { id: 'resurreccion', clase: 'sacerdote', nombre: 'Resurrección', nv: 10, icono: 'S_Holy05', costo: 30, cd: 0, cast: 4000, rango: 160, obj: 'muerto', barra: false,
    desc: 'Devuelves la vida a un aliado caído (con la mitad de su vida). Ponte junto a él y pulsa el botón de acción.' },
  // ── PICARO ──
  { id: 'siniestro', clase: 'picaro', nombre: 'Golpe Siniestro', nv: 1, icono: 'S_Dagger02', costo: 40, cd: 0, rango: MELEE, obj: 'enemigo', mult: 2.6, combo: 1,
    desc: 'Una puñalada rápida (×2,6) que suma 1 punto de combo.' },
  { id: 'eviscerar', clase: 'picaro', nombre: 'Eviscerar', nv: 3, icono: 'S_Dagger05', costo: 35, cd: 0, rango: MELEE, obj: 'enemigo', mult: 1.2, porCombo: 1.6, remate: true,
    desc: 'Remate: gasta los puntos de combo (×1,2 + ×1,6 por punto). Con 5 puntos, ×9,2.' },
  { id: 'sigilo', clase: 'picaro', nombre: 'Sigilo', nv: 6, icono: 'S_Buff06', costo: 0, cd: 4000, obj: 'yo', gcd: false,
    desc: 'Te vuelves casi invisible: los monstruos no te ven. Tu primer golpe desde el sigilo hace ×2 y da 2 puntos de combo. Solo fuera de combate.' },
  { id: 'patada', clase: 'picaro', nombre: 'Patada', nv: 10, icono: 'S_Dagger06', costo: 25, cd: 10000, rango: MELEE, obj: 'enemigo', mult: 0.8, interrumpe: 4000, gcd: false,
    desc: 'Interrumpe el hechizo que el enemigo esté lanzando (y no puede volver a lanzarlo en 4 s).' },
  { id: 'abanico', clase: 'picaro', nombre: 'Abanico de Cuchillas', nv: 16, icono: 'S_Dagger04', costo: 50, cd: 0, radio: 150, obj: 'area', mult: 2, combo: 1,
    desc: 'Lanzas cuchillas a todos los enemigos cercanos (×2) y sumas 1 punto de combo.' },
  { id: 'evasion', clase: 'picaro', nombre: 'Evasión', nv: 24, icono: 'S_Wind05', costo: 0, cd: 40000, obj: 'yo', dura: 10000, esquiva: 0.6, gcd: false,
    desc: 'Esquivas el 60% de los golpes durante 10 s.' },
  { id: 'desvanecer', clase: 'picaro', nombre: 'Desvanecerse', nv: 34, icono: 'S_Shadow16', costo: 0, cd: 90000, obj: 'yo', gcd: false,
    desc: 'Desapareces: los monstruos se olvidan de ti y entras en Sigilo aunque estés en combate.' },
];
export const habsDe = clase => HABS.filter(h => h.clase === clase && h.barra !== false);
export const habPorId = id => HABS.find(h => h.id === id);
// Costo real de una habilidad (el mana va en % del maximo; algunas
// especializaciones abaratan habilidades concretas).
export function costoHab(h, recMax, espec) {
  const cl = CLASES[h.clase];
  const sp = especDe(h.clase, espec);
  const base = sp && sp.costo && sp.costo[h.id] !== undefined ? sp.costo[h.id] : h.costo;
  return cl && cl.recurso === 'mana' ? Math.round(base / 100 * recMax) : base;
}
// Ataque basico de vara (magos y sacerdotes): dispara al objetivo.
export const VARA = { rango: 430, cdMs: 700, mult: 1.1 };
// Piedra de hogar: volver al pueblo tras 6 s quieto.
export const HOGAR_MS = 6000;
export const HOGAR_CD_MS = 60000;
// Estados que viajan en cada foto del servidor (bits).
export const FJ = { escudo: 1, fuego: 2, muerto: 4, escudoPoder: 8, renovar: 16, muro: 32, evasion: 64, bloque: 128, sigilo: 256, lanza: 512, grito: 1024, supresion: 2048, aturdido: 4096 };
export const FM = { raiz: 1, aturdido: 2, oveja: 4, dolor: 8, lanza: 16 };
// Auras que se ven en los marcos (icono y si es buena o mala).
export const AURAS = {
  escudo:      { nombre: 'Escudo (invulnerable)', icono: 'item_shield', dir: 'items/' },
  fuego:       { nombre: 'Golpes de fuego', icono: 'skill_fire', dir: 'items/' },
  escudoPoder: { nombre: 'Palabra de Poder: Escudo', icono: 'S_Holy09' },
  almaDebil:   { nombre: 'Alma Debilitada', icono: 'S_Shadow11', mala: true },
  renovar:     { nombre: 'Renovar', icono: 'S_Holy01' },
  muro:        { nombre: 'Muro de Escudo', icono: 'E_Metal06' },
  supresion:   { nombre: 'Supresión de Dolor', icono: 'S_Holy08' },
  evasion:     { nombre: 'Evasión', icono: 'S_Wind05' },
  bloque:      { nombre: 'Bloque de Hielo', icono: 'S_Ice07' },
  sigilo:      { nombre: 'Sigilo', icono: 'S_Buff06' },
  grito:       { nombre: 'Grito de Batalla', icono: 'S_Buff08' },
  raiz:        { nombre: 'Congelado', icono: 'S_Ice02', mala: true },
  aturdido:    { nombre: 'Aturdido', icono: 'S_Dagger03', mala: true },
  oveja:       { nombre: 'Polimorfia', icono: 'S_Magic01', mala: true },
  dolor:       { nombre: 'Dolor', icono: 'S_Shadow06', mala: true },
  silencio:    { nombre: 'Interrumpido', icono: 'S_Dagger06', mala: true },
  provoca:     { nombre: 'Provocado', icono: 'S_Buff14', mala: true },
  caparazon:   { nombre: 'Caparazón (casi inmune)', icono: 'E_Metal05' },
  elixirF:     { nombre: 'Elixir de Fuerza (+10% daño)', icono: 'P_Red03' },
  elixirP:     { nombre: 'Elixir de Piel de Piedra (-10% daño recibido)', icono: 'P_Blue05' },
  elixirX:     { nombre: 'Elixir de Sabiduría (+10% experiencia de caza)', icono: 'I_Book' },
  ceviche:     { nombre: 'Ceviche del Duende (+10% oro de caza)', icono: 'I_C_Fish' },
  sudado:      { nombre: 'Sudado Dorado (+5% daño, -5% daño recibido)', icono: 'I_C_Pie' },
};

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
export function nombreItem(it) { const r = RANURAS[it.s]; return r ? r.nombres[tierItem(it.nv)] + (it.cj && CONJUNTOS[it.cj] ? ' «' + CONJUNTOS[it.cj].nombre + '»' : '') : '?'; }
// ── CONJUNTOS ──
// Cada mazmorra tiene su conjunto: sus jefes (y sus Desafios) a veces sueltan
// piezas marcadas (it.cj = id de la mazmorra). Con 2 piezas del mismo
// conjunto puestas hay un bono pequeño; con 4, uno mayor. Una meta de
// coleccion a largo plazo que obliga a repetir cada mazmorra.
export const CONJUNTOS = {
  madriguera: { nombre: 'Pieles de la Madriguera', color: '#84cc16', b2: { hp: 0.08 }, b4: { atk: 0.06, def: 0.06 } },
  catacumbas: { nombre: 'Huesos del Guardián', color: '#a3e635', b2: { def: 0.08 }, b4: { atk: 0.08, hp: 0.10 } },
  fortaleza:  { nombre: 'Botín del Rey Goblin', color: '#eab308', b2: { crit: 0.03 }, b4: { atk: 0.10, hp: 0.08 } },
  templo:     { nombre: 'Marea Hundida',       color: '#38bdf8', b2: { hp: 0.10 },  b4: { atk: 0.10, crit: 0.04 } },
  nido:       { nombre: 'Seda de la Reina',    color: '#a3e635', b2: { hp: 0.08 },  b4: { crit: 0.04, def: 0.10 } },
  ciudadela:  { nombre: 'Escamas del Dragón',  color: '#f97316', b2: { atk: 0.08 }, b4: { atk: 0.08, def: 0.10, hp: 0.10 } },
  santuario:  { nombre: 'Corona del Titán',    color: '#818cf8', b2: { atk: 0.06, hp: 0.06 }, b4: { atk: 0.08, def: 0.08, crit: 0.04 } },
};
export const CONJUNTO_PROB = 0.25;
export function piezasConjunto(eq) {
  const n = {};
  for (const k in eq || {}) { const it = eq[k]; if (it && it.cj && CONJUNTOS[it.cj]) n[it.cj] = (n[it.cj] || 0) + 1; }
  return n;
}
export function bonoConjuntos(eq) {
  const t = { hp: 0, atk: 0, def: 0, crit: 0 };
  const n = piezasConjunto(eq);
  for (const id in n) {
    const cj = CONJUNTOS[id];
    for (const [min, b] of [[2, cj.b2], [4, cj.b4]]) if (n[id] >= min) for (const k in b) t[k] += b[k];
  }
  return t;
}
export function textoConjunto(cj) {
  const pct = b => Object.entries(b).map(([k, v]) => '+' + Math.round(v * 100) + '% ' + { hp: 'vida', atk: 'ataque', def: 'defensa', crit: 'crítico' }[k]).join(', ');
  return '2 piezas: ' + pct(cj.b2) + ' · 4 piezas (además): ' + pct(cj.b4);
}
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
  { id: 'mundial1',  titulo: 'Azote del Coliseo',  desc: 'Vence al jefe mundial',          oro: 2000,  cond: c => (c.mundiales || 0) >= 1 },
  { id: 'torre10',   titulo: 'Escalador',          desc: 'Supera el piso 10 de la Torre',  oro: 3000,  cond: c => (c.torreMax || 0) >= 10 },
  { id: 'torre25',   titulo: 'Señor de la Torre',  desc: 'Supera el piso 25 de la Torre',  oro: 12000, cond: c => (c.torreMax || 0) >= 25 },
  { id: 'reytorre',  titulo: 'Rey de la Torre',    desc: 'Gana el ranking semanal de la Torre (desde el piso 10)', oro: 10000, cond: c => (c.reyTorre || 0) >= 1 },
  { id: 'zonas10',   titulo: 'Trotamundos',        desc: 'Visita las 10 zonas del mundo',  oro: 5000,  cond: c => (c.nVisitadas || 0) >= 10 },
  { id: 'exped25',   titulo: 'Explorador',         desc: 'Completa 25 expediciones',       oro: 3000,  cond: c => (c.expediciones || 0) >= 25 },
  { id: 'especies',  titulo: 'Ictiólogo',          desc: 'Pesca las 11 especies (una por pesquero)', oro: 10000, cond: c => Object.keys(c.especies || {}).length >= 11 },
  { id: 'dorados25', titulo: 'Buscador de Oro',    desc: 'Pesca 25 Peces Dorados',          oro: 5000,  cond: c => (c.dorados || 0) >= 25 },
  { id: 'exped8',    titulo: 'Gran Viajero',       desc: 'Completa 10 expediciones de 8 horas', oro: 6000, cond: c => (c.exped8 || 0) >= 10 },
  { id: 'pesca50',   titulo: 'Pescador',           desc: 'Pesca 50 peces',                 oro: 1500,  cond: c => (c.peces || 0) >= 50 },
  { id: 'pesca500',  titulo: 'Maestro Pescador',   desc: 'Pesca 500 peces',                oro: 8000,  cond: c => (c.peces || 0) >= 500 },
  { id: 'mundial10', titulo: 'Titán',              desc: 'Vence 10 veces al jefe mundial', oro: 15000, cond: c => (c.mundiales || 0) >= 10 },
  { id: 'legend',    titulo: 'Bendecido',          desc: 'Consigue un objeto legendario',  oro: 3000,  cond: c => !!c.tuvoLegendario },
  { id: 'racha7',    titulo: 'Fiel al Duende',     desc: 'Entra 7 días seguidos',          oro: 3000,  cond: c => ((c.login || {}).racha || 0) >= 7 },
  { id: 'equipo5',   titulo: 'Bien Equipado',      desc: 'Lleva puestas las 5 piezas de equipo', oro: 2000, cond: c => Object.keys(RANURAS).every(k => c.eq && c.eq[k]) },
  { id: 'campeon',   titulo: 'Campeón Semanal',     desc: 'Gana el ranking semanal de experiencia', oro: 5000, cond: c => (c.campeon || 0) >= 1 },
  { id: 'bestiario20', titulo: 'Naturalista',     desc: 'Completa el primer hito de 20 monstruos del bestiario', oro: 4000, cond: c => Object.values(c.best || {}).filter(n => n >= 25).length >= 20 },
  { id: 'duelista',  titulo: 'Duelista',           desc: 'Gana 10 duelos', oro: 3000, cond: c => (c.duelosG || 0) >= 10 },
  { id: 'amigo1',    titulo: 'Buen Compañero',     desc: 'Un amigo que invitaste llegó a nivel 10', oro: 1000, cond: c => (c.amigos || 0) >= 1 },
  { id: 'amigo5',    titulo: 'Líder de la Manada', desc: '5 amigos invitados llegaron a nivel 10', oro: 8000, cond: c => (c.amigos || 0) >= 5 },
  { id: 'gesta',     titulo: 'Gesta Dorada',        desc: 'Ayuda a tu hermandad a llegar al Oro de la gesta semanal', oro: 8000, cond: c => (c.gestaOro || 0) >= 1 },
  { id: 'herm',      titulo: 'Hermano de Armas',    desc: 'Únete a una hermandad (o funda la tuya)', oro: 1000, cond: c => !!c.herm },
  { id: 'mazmorra1', titulo: 'Explorador de Criptas', desc: 'Completa una mazmorra',             oro: 2000,  cond: c => (c.mazmorras || 0) >= 1 },
  { id: 'desafio5',  titulo: 'Desafiante',          desc: 'Vence un Desafío +5',               oro: 8000,  cond: c => (c.desafioMax || 0) >= 5 },
  { id: 'desafio10', titulo: 'Implacable',          desc: 'Vence un Desafío +10',              oro: 20000, cond: c => (c.desafioMax || 0) >= 10 },
  { id: 'desafio20', titulo: 'Leyenda del Duende',  desc: 'Vence un Desafío +20',              oro: 50000, cond: c => (c.desafioMax || 0) >= 20 },
  { id: 'maestrodes', titulo: 'Maestro de Desafíos', desc: 'Gana el ranking semanal de Desafíos (desde el +5)', oro: 10000, cond: c => (c.maestroDes || 0) >= 1 },
  { id: 'calabaza50',  titulo: 'Cazacalabazas',      desc: 'Junta 50 calabazas en la Noche de Duendes',  oro: 3000,  cond: c => (c.calabazas || 0) >= 50 },
  { id: 'calabaza200', titulo: 'Rey de las Calabazas', desc: 'Junta 200 calabazas en la Noche de Duendes', oro: 12000, cond: c => (c.calabazas || 0) >= 200 },
  { id: 'mazorca50',   titulo: 'Cosechador',         desc: 'Junta 50 mazorcas en la Cosecha del Maíz Morado',  oro: 3000,  cond: c => (c.mazorcas || 0) >= 50 },
  { id: 'mazorca200',  titulo: 'Señor del Maíz Morado', desc: 'Junta 200 mazorcas en la Cosecha del Maíz Morado', oro: 12000, cond: c => (c.mazorcas || 0) >= 200 },
  { id: 'regalo50',    titulo: 'Duende Navideño',    desc: 'Junta 50 regalos en la Navidad Duende',      oro: 3000,  cond: c => (c.regalos || 0) >= 50 },
  { id: 'mascara50',   titulo: 'Carnavalero',        desc: 'Junta 50 máscaras en el Carnaval Duende',    oro: 3000,  cond: c => (c.mascaras || 0) >= 50 },
  { id: 'mascara200',  titulo: 'Rey Momo',           desc: 'Junta 200 máscaras en el Carnaval Duende',   oro: 12000, cond: c => (c.mascaras || 0) >= 200 },
  { id: 'concha50',    titulo: 'Bañista Duende',     desc: 'Junta 50 conchas en el Verano Duende',       oro: 3000,  cond: c => (c.conchas || 0) >= 50 },
  { id: 'concha200',   titulo: 'Rey de la Playa',    desc: 'Junta 200 conchas en el Verano Duende',      oro: 12000, cond: c => (c.conchas || 0) >= 200 },
  { id: 'uva50',       titulo: 'Pisador de Uvas',    desc: 'Junta 50 uvas en la Vendimia Duende',        oro: 3000,  cond: c => (c.uvas || 0) >= 50 },
  { id: 'uva200',      titulo: 'Señor de la Vendimia', desc: 'Junta 200 uvas en la Vendimia Duende',     oro: 12000, cond: c => (c.uvas || 0) >= 200 },
  { id: 'estrella50',  titulo: 'Cazaestrellas',      desc: 'Junta 50 estrellas fugaces en la Lluvia de Estrellas',  oro: 3000,  cond: c => (c.estrellas || 0) >= 50 },
  { id: 'estrella200', titulo: 'Guardián del Cielo', desc: 'Junta 200 estrellas fugaces en la Lluvia de Estrellas', oro: 12000, cond: c => (c.estrellas || 0) >= 200 },
  { id: 'cometa50',    titulo: 'Cometero',           desc: 'Junta 50 cometas en el Festival del Viento',   oro: 3000,  cond: c => (c.cometas || 0) >= 50 },
  { id: 'cometa200',   titulo: 'Señor de los Vientos', desc: 'Junta 200 cometas en el Festival del Viento', oro: 12000, cond: c => (c.cometas || 0) >= 200 },
  { id: 'semilla50',   titulo: 'Sembrador',          desc: 'Junta 50 semillas en la Ofrenda a la Pachamama',  oro: 3000,  cond: c => (c.semillas || 0) >= 50 },
  { id: 'semilla200',  titulo: 'Guardián de la Pachamama', desc: 'Junta 200 semillas en la Ofrenda a la Pachamama', oro: 12000, cond: c => (c.semillas || 0) >= 200 },
  { id: 'flor50',      titulo: 'Jardinero',          desc: 'Junta 50 flores en la Primavera Duende',      oro: 3000,  cond: c => (c.flores || 0) >= 50 },
  { id: 'flor200',     titulo: 'Rey de la Primavera', desc: 'Junta 200 flores en la Primavera Duende',    oro: 12000, cond: c => (c.flores || 0) >= 200 },
  { id: 'sol50',       titulo: 'Hijo del Sol',       desc: 'Junta 50 soles de oro en la Fiesta del Sol',  oro: 3000,  cond: c => (c.soles || 0) >= 50 },
  { id: 'sol200',      titulo: 'Señor del Inti',     desc: 'Junta 200 soles de oro en la Fiesta del Sol', oro: 12000, cond: c => (c.soles || 0) >= 200 },
  { id: 'fuego50',     titulo: 'Patriota Duende',    desc: 'Junta 50 fuegos artificiales en las Fiestas Patrias Duende',  oro: 3000,  cond: c => (c.fuegos || 0) >= 50 },
  { id: 'fuego200',    titulo: 'Gran Mariscal',      desc: 'Junta 200 fuegos artificiales en las Fiestas Patrias Duende', oro: 12000, cond: c => (c.fuegos || 0) >= 200 },
  { id: 'regalo200',   titulo: 'Santa Duende',       desc: 'Junta 200 regalos en la Navidad Duende',     oro: 12000, cond: c => (c.regalos || 0) >= 200 },
  { id: 'mazmorra10', titulo: 'Conquistador',       desc: 'Completa 10 mazmorras',             oro: 10000, cond: c => (c.mazmorras || 0) >= 10 },
  { id: 'kraken',    titulo: 'Azote del Abismo',    desc: 'Vence al Kraken del Templo Hundido', oro: 8000,  cond: c => !!(c.mzJefes && c.mzJefes.mz_kraken) },
  { id: 'runas',     titulo: 'Maestro Rúnico',      desc: 'Graba las tres runas de la Artesana a rango 5', oro: 20000, cond: c => !!c.runas && Object.keys(RUNAS).every(k => (c.runas[k] || 0) >= RUNA_MAX) },
  { id: 'mascotas3', titulo: 'Cuidador de Bichos',  desc: 'Consigue 3 mascotas', oro: 3000, cond: c => (c.mascotas || []).length >= 3 },
  { id: 'mascotas8', titulo: 'Domador de Mascotas', desc: 'Consigue 8 mascotas', oro: 15000, cond: c => (c.mascotas || []).length >= 8 },
  { id: 'reygoblin', titulo: 'Azote Goblin',        desc: 'Vence al Rey Goblin Barrigón de la Fortaleza', oro: 6000, cond: c => !!(c.mzJefes && c.mzJefes.mz_rey_goblin) },
  { id: 'cancerbero', titulo: 'Domador del Infierno', desc: 'Vence al Cancerbero del Nido de la Reina Araña', oro: 12000, cond: c => !!(c.mzJefes && c.mzJefes.mz_cancerbero) },
  { id: 'dragon',    titulo: 'Matadragones',        desc: 'Vence al Dragón Carmesí de la Ciudadela', oro: 15000, cond: c => !!(c.mzJefes && c.mzJefes.mz_dragon) },
  { id: 'titan',     titulo: 'Azote del Titán',     desc: 'Vence al Titán del Abismo en la banda del Santuario', oro: 25000, cond: c => !!(c.mzJefes && c.mzJefes.mz_titan) },
  { id: 'pionero',   titulo: 'Pionero del Abismo',  desc: 'Forma parte de la primera victoria del servidor contra el Titán del Abismo', oro: 30000, cond: c => !!c.pionero },
  { id: 'abismo',    titulo: 'Jinete del Abismo',   desc: 'Gana el Murciélago del Abismo (vence al Titán en 3 semanas distintas)', oro: 20000, cond: c => (c.monturas || []).includes('abismo') },
];

// ── JEFE MUNDIAL ──
export const MUNDIAL_CADA_MS = 30 * 60 * 1000;   // a las :00 y :30 (UTC)
export const MUNDIAL_DURA_MS = 10 * 60 * 1000;
export const proximoMundial = ahora => Math.ceil(ahora / MUNDIAL_CADA_MS) * MUNDIAL_CADA_MS;

// ── PIEDRAS DE VIAJE (atajos del mundo abierto) ──
// Una en cada zona abierta, cerca de la entrada. Desde cualquiera se viaja a
// las zonas que ya pisaste a pie (c.visitadas), fuera de combate y por un
// poco de oro. Las zonas siguen unidas por sus bordes: se cruza caminando.
export const PIEDRA_X = 230;
export const PIEDRA_DIST = 90;
export const costoViaje = nvZona => 20 * nvZona;
export function tienePiedra(id) {
  const m = MAPAS[id];
  return !!(m && m.zona && !m.instancia && !m.coliseo && !m.torre && m.monstruos && m.monstruos.length);
}

// ── SKINS (las mismas 7 del juego, con sus mismos poderes) ──
// Se compran con oro del MMO. Las que ya se pagaron con dinero real en el
// juego principal se desbloquean solas (ver world.js, skinsPagadas()).
// premium: solo con dinero (SOL, $DUENDE o Stars; precio null = no se vende
// por oro). Las premium usan la hoja animada del duende teñida
// (hue en grados, sat multiplicador) y un aura de su color. Sus ventajas
// suben con el precio pero sin pasar a las de oro de final de juego (la
// Berserker sigue con mas ataque y la Legendaria con mas oro): pagar acelera,
// no gana solo. Ninguna skin cambia lo que se gana en mTON.
export const SKINS = {
  comun:      { nombre: 'Duende',      img: 'skin_hero',           precio: 0,      color: '#00eeff', buffs: null, desc: 'El duende de siempre' },
  // usd: tambien se venden con dinero (SOL o $DUENDE en la web, Stars en
  // Telegram); el pago va a la wallet de El Duende y el la entrega a mano
  // (/entregar o Modo Dios).
  tactico:    { nombre: 'Táctico',     img: 'skin_tactico',        precio: 3000,   usd: 2,  color: '#00ff88', buffs: { oroMult: 1.1, critBonus: .03 }, desc: '+10% oro · +3% crítico' },
  necro:      { nombre: 'Nigromante', img: 'skin_necromancer',    precio: 9000,   usd: 4,  color: '#b44cff', buffs: { oroMult: 1.2, robo: .05, xpMult: 1.05 }, desc: '+20% oro · roba 5% de vida · +5% experiencia' },
  king:       { nombre: 'Rey',        img: 'skin_king',           precio: 20000,  usd: 7,  color: '#ffd84a', buffs: { oroMult: 1.3, bonusHp: 20, defMult: 1.1 }, desc: '+30% oro · +HP extra · +10% defensa' },
  berserker:  { nombre: 'Berserker',   img: 'skin_berserker',      precio: 45000,  usd: 12, color: '#ff3344', buffs: { oroMult: 1.4, atkMult: 1.3, critBonus: .03 }, desc: '+40% oro · +30% ataque · +3% crítico' },
  legendaria: { nombre: 'Legendaria',  img: 'skin_legendariafull', precio: 100000, usd: 20, color: '#ff3cf0', buffs: { oroMult: 1.5, bonusHp: 50, aura: true, atkMult: 1.1, xpMult: 1.1 }, desc: '+50% oro · +HP · +10% ataque · +10% experiencia · aura que quema' },
  esmeralda:  { nombre: 'Duende Esmeralda', img: 'skin_hero', anim: true, hue: 40,  sat: 1.3, precio: null, premium: true, usd: 5,  color: '#34d399', buffs: { oroMult: 1.15, atkMult: 1.06, robo: .02 }, desc: '+15% oro · +6% ataque · roba 2% de vida' },
  sombra:     { nombre: 'Duende Sombrío',   img: 'skin_hero', anim: true, hue: 200, sat: .55, precio: null, premium: true, usd: 10, color: '#a78bfa', buffs: { oroMult: 1.25, atkMult: 1.1, robo: .03, bonusHp: 10 }, desc: '+25% oro · +10% ataque · roba 3% · +HP' },
  solar:      { nombre: 'Duende Solar',     img: 'skin_hero', anim: true, hue: 22, sat: 1.9, precio: null, premium: true, usd: 25, color: '#fbbf24', buffs: { oroMult: 1.3, atkMult: 1.14, bonusHp: 25, aura: true }, desc: '+30% oro · +14% ataque · +HP · aura que quema' },
  cosmico:    { nombre: 'Duende Cósmico',   img: 'skin_hero', anim: true, hue: 150, sat: 1.5, precio: null, premium: true, usd: 50, color: '#38bdf8', buffs: { oroMult: 1.35, atkMult: 1.18, bonusHp: 35, robo: .04, aura: true }, desc: '+35% oro · +18% ataque · +HP · roba 4% · aura' },
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
  { id: 'pocion', nombre: 'Poción', plural: 'Pociones',  icono: 'item_potion', precio: 30,  cd: 3000,  tecla: 'Q', desc: 'Cura el 50% de la vida y el 30% del maná' },
  { id: 'escudo', nombre: 'Escudo', plural: 'Escudos',  icono: 'item_shield', precio: 120, cd: 20000, tecla: 'F', desc: 'Invulnerable 5 segundos' },
  { id: 'rayo',   nombre: 'Rayo',   plural: 'Rayos',  icono: 'item_skill',  precio: 350, cd: 15000, tecla: 'G', desc: 'Fulmina a todo lo que esté cerca' },
  { id: 'fuego',  nombre: 'Fuego',  plural: 'Fuegos',  icono: 'skill_fire',  precio: 200, cd: 20000, tecla: 'T', desc: 'Golpes de fuego (+50%) por 8 s' },
];

// ── MISIONES ──
// Una cadena que recorre el mundo en orden: cada zona pide cazar a sus
// criaturas y cierra con su jefe. Se aceptan y entregan al Guardia Tito del
// pueblo. La recompensa ronda lo que da la propia caza, asi que se nota
// pero no reemplaza a jugar. Entre Nv 10 y 30 (misiones 9-23) la XP de las
// de caza va ×1,8 desde el 22-oct-2026: ahi solo daban ~20% de un nivel y
// es donde mas se estancaban los jugadores (auditoria de retencion).
export const MISIONES = [
  { nombre: 'Limpieza nocturna',        tipo: 'goblin_normal',     n: 8,  xp: 60,    oro: 80 },
  { nombre: 'Huesos inquietos',         tipo: 'esqueleto',         n: 10, xp: 130,   oro: 150 },
  { nombre: 'Cazador de sombras',       tipo: 'goblin_assassin',   n: 8,  xp: 170,   oro: 200, pw: { pocion: 3 } },
  { nombre: 'Aullido infernal',         tipo: 'jefe_sabueso',      n: 1,  xp: 500,   oro: 600, pw: { escudo: 2 } },
  { nombre: 'Campesinos rebeldes',      tipo: 'goblin_peasant',    n: 10, xp: 280,   oro: 330 },
  { nombre: 'La guardia roja',          tipo: 'goblin_guard',      n: 10, xp: 330,   oro: 380 },
  { nombre: 'Plumas de hueso',          tipo: 'pajaro',            n: 8,  xp: 340,   oro: 400, pw: { fuego: 1 } },
  { nombre: 'La corona del caballero',  tipo: 'jefe_caballero',    n: 1,  xp: 1200,  oro: 1400, pw: { rayo: 2 } },
  { nombre: 'Esporas gigantes',         tipo: 'hongo',             n: 10, xp: 900,   oro: 560 },
  { nombre: 'Coro de la charca',        tipo: 'rana',              n: 10, xp: 990,   oro: 600 },
  { nombre: 'Tambores de guerra',       tipo: 'goblin_battlelord', n: 8,  xp: 1010,   oro: 650, pw: { pocion: 5 } },
  { nombre: 'El Señor de la Guerra',    tipo: 'jefe_senor',        n: 1,  xp: 2500,  oro: 2800, pw: { escudo: 2, rayo: 1 } },
  { nombre: 'Magia prohibida',          tipo: 'goblin_mage',       n: 10, xp: 1260,   oro: 800 },
  { nombre: 'Huesos arcanos',           tipo: 'esqueleto_arcano',  n: 10, xp: 1370,   oro: 860 },
  { nombre: 'Fuego que camina',         tipo: 'ghoul_ardiente',    n: 8,  xp: 1260,   oro: 900, pw: { fuego: 2 } },
  { nombre: 'El Ghoul Infernal',        tipo: 'jefe_ghoul',        n: 1,  xp: 4000,  oro: 4500, pw: { rayo: 2, escudo: 2 } },
  { nombre: 'Filo del desierto',        tipo: 'goblin_samurai',    n: 10, xp: 1620,   oro: 1100 },
  { nombre: 'Escamas al sol',           tipo: 'lagarto',           n: 10, xp: 1710,   oro: 1150 },
  { nombre: 'Conejos salvajes',         tipo: 'conejo',            n: 10, xp: 1800,  oro: 1200, pw: { pocion: 10 } },
  { nombre: 'La caída del Ángel',       tipo: 'jefe_angel',        n: 1,  xp: 8000,  oro: 10000, pw: { rayo: 3, escudo: 3, fuego: 3 } },
  { nombre: 'Las puertas del castillo', tipo: 'guardia_real',      n: 10, xp: 2340,  oro: 1500 },
  { nombre: 'Armadura negra',           tipo: 'caballero_negro',   n: 10, xp: 2520,  oro: 1600 },
  { nombre: 'Huesos de la corona',      tipo: 'esqueleto_real',    n: 10, xp: 2700,  oro: 1700, pw: { pocion: 10 } },
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
// Semana (lunes UTC) como "AAAA-MM-DD" de su lunes.
export function semanaUTC() {
  const d = new Date(Date.now());
  const dia = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia)).toISOString().slice(0, 10);
}

// ── MISIONES DIARIAS Y SEMANALES ──
// Cada dia, 3 tareas al azar segun tu nivel; cada semana, 2 mas grandes. Se
// cobran solas al cumplirse y completar todas da un bono. Solo XP, oro,
// poderes y equipo: NUNCA mTON (eso es solo la Caza del dia del Guardia).
// tipo: lo que cuenta (caza, zona, grupo, jefe, mazmorra, mundial, hab).
export const TAREAS_DIA = [
  { id: 'caza', tipo: 'caza', n: 30, txt: 'Caza 30 monstruos de tu nivel' },
  { id: 'zona', tipo: 'zona', n: 20, txt: 'Caza 20 monstruos en ' },
  { id: 'grupo', tipo: 'grupo', n: 15, txt: 'Caza 15 monstruos en grupo' },
  { id: 'jefe', tipo: 'jefe', n: 1, txt: 'Derrota a un jefe de zona', nv: 6 },
  { id: 'mazmorra', tipo: 'mazmorra', n: 1, txt: 'Completa una mazmorra', nv: 10 },
  { id: 'mundial', tipo: 'mundial', n: 1, txt: 'Vence al jefe mundial del Coliseo', nv: 5 },
  { id: 'hab', tipo: 'hab', n: 50, txt: 'Usa 50 habilidades en combate' },
  { id: 'recoger', tipo: 'recoger', n: 6, txt: 'Recoge 6 plantas o vetas de mineral' },
  { id: 'pescar', tipo: 'pescar', n: 5, txt: 'Pesca 5 peces (pesquero 🎣 del pueblo o de una zona)' },
  { id: 'exped', tipo: 'exped', n: 1, txt: 'Recoge una expedición (registro de misiones)', nv: 5 },
];
export const TAREAS_SEMANA = [
  { id: 'caza300', tipo: 'caza', n: 300, txt: 'Caza 300 monstruos de tu nivel' },
  { id: 'maz3', tipo: 'mazmorra', n: 3, txt: 'Completa 3 mazmorras', nv: 10 },
  { id: 'jefes5', tipo: 'jefe', n: 5, txt: 'Derrota a 5 jefes de zona', nv: 6 },
  { id: 'mundial3', tipo: 'mundial', n: 3, txt: 'Vence 3 veces al jefe mundial', nv: 5 },
  { id: 'recoger30', tipo: 'recoger', n: 30, txt: 'Recoge 30 plantas o vetas de mineral' },
  { id: 'pescar25', tipo: 'pescar', n: 25, txt: 'Pesca 25 peces' },
  { id: 'torre10', tipo: 'torre', n: 10, txt: 'Supera 10 pisos de la Torre del Duende (en total)', nv: 10 },
];
export const premioTarea = (nivel, semanal) => ({ xp: Math.round(xpParaSubir(nivel) * (semanal ? 0.8 : 0.25)), oro: (semanal ? 300 : 40) * nivel });
// La zona "de tu nivel" (para la tarea de zona).
export function zonaDeNivel(nivel) {
  let mejor = 'noche';
  for (const id in MAPAS) {
    const m = MAPAS[id];
    if (!m.zona || m.instancia || m.coliseo || !m.nv) continue;
    if (m.nv[0] <= nivel && m.nv[0] >= MAPAS[mejor].nv[0]) mejor = id;
  }
  return mejor;
}

// ── RECOLECCION Y ARTESANIA ──
// En cada zona hay plantas y vetas para recoger (1,5 s quieto; cada jugador
// puede recoger cada una cada 5 min). Con los materiales, la Artesana Lila
// del pueblo fabrica consumibles y elixires. Otro motivo para recorrer el
// mundo, que no depende de matar.
export const MATERIALES = {
  hierba:  { nombre: 'Hierba Duende',     icono: 'I_Leaf' },
  mineral: { nombre: 'Mineral de Hierro', icono: 'I_Rock01' },
  cristal: { nombre: 'Cristal Arcano',    icono: 'I_Crystal01' },
  // De nivel alto: en las zonas Nv 30+ las plantas dan Flor de Luna y las
  // vetas Mithril; la Esencia la sueltan los jefes de mazmorra y de banda.
  flor:    { nombre: 'Flor de Luna',      icono: 'S_Magic02' },
  mithril: { nombre: 'Mithril',           icono: 'E_Metal07' },
  esencia: { nombre: 'Esencia Abisal',    icono: 'S_Shadow06' },
  // De la pesca (PESCA): el pescado en cualquier pesquero, el dorado a veces.
  pescado:    { nombre: 'Pescado',    icono: 'I_C_RawFish' },
  pez_dorado: { nombre: 'Pez Dorado', icono: 'I_FishTail' },
};
// Material raro de las zonas altas: [nivel minimo de la zona, probabilidad]
// de uno extra por recogida (se tiran los dos).
export const RARO_ZONA = [[30, 0.6], [45, 0.4]];
export const raroDe = tipo => (tipo === 'hierba' ? 'flor' : 'mithril');
// Esencia Abisal por jefe: mazmorra 1 (+1 en Desafio), banda 2. Solo en
// mazmorras de nivel ESENCIA_NV o mas (a Nv 60 las Catacumbas eran una
// fuente sin freno) y para quien pego o curo a ese jefe.
export const ESENCIA_NV = 40;
export const esenciaJefe = (banda, k) => (banda ? 2 : 1 + (k ? 1 : 0));
export const NODO_CADA_MS = 5 * 60000;
export const RECOLECTAR_MS = 1500;
export const ELIXIR_MS = 30 * 60000;
// Vetas y plantas de una zona: posiciones fijas segun su ancho.
export function nodosDe(mapaId) {
  const m = MAPAS[mapaId];
  if (!m || !m.zona || m.instancia || m.coliseo) return [];
  return [0.16, 0.36, 0.57, 0.8].map((k, i) => ({ i, x: Math.round(m.ancho * k + (i % 2 ? 40 : -40)), tipo: i % 2 ? 'mineral' : 'hierba' }));
}
export const RECETAS = [
  { id: 'pociones', nombre: 'Pociones ×3', icono: 'item_potion', dir: 'items/', pide: { hierba: 3 }, da: { pw: { pocion: 3 } }, desc: 'Tres pociones de vida' },
  { id: 'escudos', nombre: 'Escudos ×2', icono: 'item_shield', dir: 'items/', pide: { mineral: 4 }, da: { pw: { escudo: 2 } }, desc: 'Dos escudos de invulnerabilidad' },
  { id: 'fuego', nombre: 'Pólvora de fuego ×2', icono: 'skill_fire', dir: 'items/', pide: { hierba: 2, mineral: 2 }, da: { pw: { fuego: 2 } }, desc: 'Dos golpes de fuego' },
  { id: 'refinar', nombre: 'Refinar cristal', icono: 'I_Crystal01', pide: { mineral: 8 }, da: { mat: { cristal: 1 } }, desc: '8 minerales se funden en 1 Cristal Arcano' },
  { id: 'elixirF', nombre: 'Elixir de Fuerza', icono: 'P_Red03', pide: { hierba: 6, cristal: 1 }, da: { elixir: 'elixirF' }, desc: '+10% de daño durante 30 min (persiste al morir)' },
  { id: 'elixirP', nombre: 'Elixir de Piel de Piedra', icono: 'P_Blue05', pide: { mineral: 6, cristal: 1 }, da: { elixir: 'elixirP' }, desc: 'Recibes un 10% menos de daño durante 30 min' },
  { id: 'destilar', nombre: 'Destilar Flor de Luna', icono: 'S_Magic02', pide: { hierba: 10, cristal: 1 }, da: { mat: { flor: 1 } }, desc: '10 hierbas y un cristal se destilan en 1 Flor de Luna' },
  { id: 'elixirX', nombre: 'Elixir de Sabiduría', icono: 'I_Book', pide: { hierba: 4, mineral: 2, cristal: 1 }, da: { elixir: 'elixirX' }, desc: '+10% de experiencia por caza durante 30 min (persiste al morir)' },
  // Con lo que se pesca (PESCA).
  { id: 'frito', nombre: 'Pescado frito ×3', icono: 'I_C_Fish', pide: { pescado: 3 }, da: { pw: { pocion: 3 } }, desc: 'Tres pociones de vida (como las de hierba)' },
  { id: 'ceviche', nombre: 'Ceviche del Duende', icono: 'I_C_Fish', pide: { pescado: 5, hierba: 2 }, da: { elixir: 'ceviche' }, desc: '+10% de oro por caza durante 30 min (persiste al morir)' },
  { id: 'sudado', nombre: 'Sudado Dorado', icono: 'I_C_Pie', pide: { pescado: 3, pez_dorado: 1 }, da: { elixir: 'sudado' }, desc: '+5% de daño y -5% de daño recibido durante 30 min (persiste al morir)' },
];

// ── PESCA ──
// Un pesquero en el pueblo y uno en cada zona abierta. Lanzas el sedal y, a
// los pocos segundos (al azar), pica: hay que TIRAR a tiempo (2 s). Tirar
// antes de que pique lo asusta; moverse o recibir un golpe corta el sedal.
// Da Pescado (y a veces Pez Dorado o un cofre hundido con un poco de oro)
// para la Artesana. Hasta porDia capturas al dia. Nunca mTON.
export const PESCA = { min: 3000, max: 9000, ventana: 2000, porDia: 80, dorado: 0.05, cofre: 0.02, radio: 80, mascota: 1 / 250, mascotaSeguro: 300 };
// Una especie por pesquero: la primera captura de cada una da oro (ver la
// coleccion en Inventario > BESTIARIO) y completarlas, un logro.
export const ESPECIES = {
  pueblo: 'Carpa del Pueblo', noche: 'Trucha Nocturna', amanecer: 'Perca Roja', selva: 'Pez Esmeralda', tormenta: 'Anguila Eléctrica',
  desierto: 'Pez Arena', castillo: 'Lucio Real', cumbres: 'Salmón de las Cumbres', cavernas: 'Pez Ciego', abismo: 'Rape Abisal', acantilados: 'Pez Arcoíris',
};
export const premioEspecie = nv => 200 + 40 * nv;
export function pesqueroDe(mapaId) {
  if (mapaId === 'pueblo') return { x: 475, nv: 1 };   // entre el portal de las Colinas y el Guardia
  const m = MAPAS[mapaId];
  if (!m || !m.zona || m.instancia || m.coliseo || !m.nv) return null;
  return { x: Math.round(m.ancho * 0.28), nv: m.nv[0] };   // lejos del jefe de zona (62%)
}

// ── RUNAS (artesania de nivel alto) ──
// Mejoras PERMANENTES que graba la Artesana desde Nv 40: cada rango da +2%
// a su estadistica, hasta 5 rangos (+10%). Piden materiales de zonas altas,
// Esencia Abisal de las mazmorras y oro: una meta de semanas, sin azar y
// sin compra.
export const RUNA_NIVEL = 40, RUNA_MAX = 5, RUNA_PCT = 0.02;
export const RUNAS = {
  fuerza: { nombre: 'Runa de Fuerza', icono: 'S_Buff14',  st: 'atk', desc: 'ataque',  pide: r => ({ mithril: 4 * r, esencia: 2 * r, cristal: r }) },
  piedra: { nombre: 'Runa de Piedra', icono: 'E_Metal06', st: 'def', desc: 'defensa', pide: r => ({ mithril: 6 * r, esencia: 2 * r }) },
  vida:   { nombre: 'Runa de Vida',   icono: 'S_Holy01',  st: 'hp',  desc: 'vida máxima', pide: r => ({ flor: 6 * r, esencia: 2 * r }) },
};
// Lo que cuesta subir una runa AL rango r (1..5).
export const costoRuna = (id, r) => ({ mat: RUNAS[id].pide(r), oro: 2500 * r * r });
export const bonoRunas = ru => ({ atk: RUNA_PCT * ((ru && ru.fuerza) || 0), def: RUNA_PCT * ((ru && ru.piedra) || 0), hp: RUNA_PCT * ((ru && ru.vida) || 0) });

// ── TEMPORADAS ──
// Eventos con fecha real: se encienden solos y dan motivo para volver esos
// dias. Premios del juego (oro, titulos) y nada mas. En cada uno los
// monstruos sueltan su objeto (los jefes, varios) y hay dos logros con
// titulo (data LOGROS: `campo` >= 50 y >= 200). Para uno nuevo basta
// añadirlo aqui y sus dos logros.
export const TEMPORADAS = [
  { id: 'noche2026', nombre: 'Noche de Duendes', ini: Date.UTC(2026, 9, 25), fin: Date.UTC(2026, 10, 3), hasta: '2 de noviembre',
    emoji: '🎃', deco: '🎃', cosas: 'calabazas', campo: 'calabazas', color: '#ff9a3c', titulos: ['Cazacalabazas', 'Rey de las Calabazas'] },
  // Cosecha del Maiz Morado: el maiz de la chicha morada (el premio fisico).
  { id: 'cosecha2026', nombre: 'Cosecha del Maíz Morado', ini: Date.UTC(2026, 10, 13), fin: Date.UTC(2026, 11, 1), hasta: '30 de noviembre',
    emoji: '🌽', deco: '🌽', cosas: 'mazorcas', campo: 'mazorcas', color: '#a855f7', titulos: ['Cosechador', 'Señor del Maíz Morado'] },
  { id: 'navidad2026', nombre: 'Navidad Duende', ini: Date.UTC(2026, 11, 18), fin: Date.UTC(2027, 0, 7), hasta: '6 de enero',
    emoji: '🎁', deco: '🎄', cosas: 'regalos', campo: 'regalos', color: '#4ade80', titulos: ['Duende Navideño', 'Santa Duende'] },
  // Verano en Peru (enero): entre la Navidad y el Carnaval.
  { id: 'verano2027', nombre: 'Verano Duende', ini: Date.UTC(2027, 0, 15), fin: Date.UTC(2027, 0, 30), hasta: '29 de enero',
    emoji: '🐚', deco: '🏖️', cosas: 'conchas', campo: 'conchas', color: '#38bdf8', titulos: ['Bañista Duende', 'Rey de la Playa'] },
  { id: 'carnaval2027', nombre: 'Carnaval Duende', ini: Date.UTC(2027, 1, 4), fin: Date.UTC(2027, 1, 15), hasta: '14 de febrero',
    emoji: '🎭', deco: '🎭', cosas: 'máscaras', campo: 'mascaras', color: '#f472b6', titulos: ['Carnavalero', 'Rey Momo'] },
  // La Vendimia de Ica (marzo).
  { id: 'vendimia2027', nombre: 'Vendimia Duende', ini: Date.UTC(2027, 2, 4), fin: Date.UTC(2027, 2, 22), hasta: '21 de marzo',
    emoji: '🍇', deco: '🍇', cosas: 'uvas', campo: 'uvas', color: '#a78bfa', titulos: ['Pisador de Uvas', 'Señor de la Vendimia'] },
  // Las Liridas (lluvia de estrellas de abril).
  { id: 'estrellas2027', nombre: 'Lluvia de Estrellas', ini: Date.UTC(2027, 3, 15), fin: Date.UTC(2027, 4, 3), hasta: '2 de mayo',
    emoji: '🌠', deco: '✨', cosas: 'estrellas fugaces', campo: 'estrellas', color: '#fde047', titulos: ['Cazaestrellas', 'Guardián del Cielo'] },
  // Mayo: cometas en el viento (Festival del Viento).
  { id: 'viento2027', nombre: 'Festival del Viento', ini: Date.UTC(2027, 4, 14), fin: Date.UTC(2027, 4, 29), hasta: '28 de mayo',
    emoji: '🪁', deco: '🪁', cosas: 'cometas', campo: 'cometas', color: '#22d3ee', titulos: ['Cometero', 'Señor de los Vientos'] },
  // Inti Raymi (24 de junio, Cusco).
  { id: 'inti2027', nombre: 'Fiesta del Sol', ini: Date.UTC(2027, 5, 12), fin: Date.UTC(2027, 5, 28), hasta: '27 de junio',
    emoji: '☀️', deco: '🌞', cosas: 'soles de oro', campo: 'soles', color: '#f59e0b', titulos: ['Hijo del Sol', 'Señor del Inti'] },
  // Fiestas Patrias (28 de julio).
  { id: 'patrias2027', nombre: 'Fiestas Patrias Duende', ini: Date.UTC(2027, 6, 20), fin: Date.UTC(2027, 7, 1), hasta: '31 de julio',
    emoji: '🎆', deco: '🎆', cosas: 'fuegos artificiales', campo: 'fuegos', color: '#ef4444', titulos: ['Patriota Duende', 'Gran Mariscal'] },
  // Agosto, mes de la Pachamama (ofrendas a la tierra).
  { id: 'pachamama2027', nombre: 'Ofrenda a la Pachamama', ini: Date.UTC(2027, 7, 6), fin: Date.UTC(2027, 7, 22), hasta: '21 de agosto',
    emoji: '🌱', deco: '🌾', cosas: 'semillas', campo: 'semillas', color: '#84cc16', titulos: ['Sembrador', 'Guardián de la Pachamama'] },
  // Primavera (23 de septiembre en el sur).
  { id: 'primavera2027', nombre: 'Primavera Duende', ini: Date.UTC(2027, 8, 23), fin: Date.UTC(2027, 9, 8), hasta: '7 de octubre',
    emoji: '🌸', deco: '🌸', cosas: 'flores', campo: 'flores', color: '#f9a8d4', titulos: ['Jardinero', 'Rey de la Primavera'] },
  // Las de cada año vuelven con su mismo contador y sus mismos titulos
  // (como los eventos anuales de WoW): quien no los saco, otra oportunidad.
  { id: 'noche2027', nombre: 'Noche de Duendes', ini: Date.UTC(2027, 9, 25), fin: Date.UTC(2027, 10, 3), hasta: '2 de noviembre',
    emoji: '🎃', deco: '🎃', cosas: 'calabazas', campo: 'calabazas', color: '#ff9a3c', titulos: ['Cazacalabazas', 'Rey de las Calabazas'] },
  { id: 'cosecha2027', nombre: 'Cosecha del Maíz Morado', ini: Date.UTC(2027, 10, 13), fin: Date.UTC(2027, 11, 1), hasta: '30 de noviembre',
    emoji: '🌽', deco: '🌽', cosas: 'mazorcas', campo: 'mazorcas', color: '#a855f7', titulos: ['Cosechador', 'Señor del Maíz Morado'] },
  { id: 'navidad2027', nombre: 'Navidad Duende', ini: Date.UTC(2027, 11, 18), fin: Date.UTC(2028, 0, 7), hasta: '6 de enero',
    emoji: '🎁', deco: '🎄', cosas: 'regalos', campo: 'regalos', color: '#4ade80', titulos: ['Duende Navideño', 'Santa Duende'] },
];
export const temporadaDe = (t = Date.now()) => TEMPORADAS.find(x => t >= x.ini && t < x.fin) || null;
export const temporadaActiva = (t = Date.now()) => !!temporadaDe(t);
export const TEMP_PROB = 0.2, TEMP_JEFE = 5;

// ── PREMIO FISICO: CHICHA MORADA (functions/mmo/chicha.js) ──
// niveles: puntos para cada litro (dos premios por jugador como mucho).
// porDia: tope diario de puntos (10.000 = unas semanas de juego, frena bots).
// mesMax: litros al mes para todo el juego (el dueño lo cambia aqui).
export const CHICHA = { niveles: [10000, 50000], porDia: 600, nvPuntos: 10, nvReclamo: 15, mesMax: 10 };

// ── BESTIARIO ──
// Cuantos de cada monstruo has cazado. Cada tipo tiene 3 hitos con premio
// de oro: decenas de colecciones a largo plazo, por todas las zonas.
export const BESTIARIO_HITOS = [25, 100, 300];
export const premioBestiario = (nivelMonstruo, i) => Math.round((60 + nivelMonstruo * 25) * [1, 3, 8][i]);

// ── INVITA A UN AMIGO ──
export const AMIGO_NIVEL = 10;      // el premio llega cuando el amigo llega aqui
export const AMIGOS_MAX = 20;       // amigos con premio por personaje
export const premioAmigo = nivel => ({ oro: 1500 + 150 * nivel });

// ── HERMANDADES ──
export const HERM_COSTO = 5000;   // oro para fundar una
// Color del nombre de la hermandad bajo cada miembro (lo elige el lider).
export const HERM_COLORES = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#f97316', '#a78bfa', '#f87171', '#2dd4bf'];
export const HERM_NIVEL = 10;
export const HERM_MAX = 50;
// Gesta semanal: toda la hermandad suma puntos (1 por monstruo, 10 por
// jefe, 25 por mazmorra completada) y cada nivel alcanzado (Bronce, Plata,
// Oro) da oro a quien aporto al menos GESTA_MIN puntos esa semana. Se
// reinicia el lunes (UTC). Solo oro y un logro.
export const GESTA_UMBRALES = [500, 1500, 4000];
export const GESTA_NOMBRES = ['Bronce', 'Plata', 'Oro'];
export const GESTA_PUNTOS = { caza: 1, jefe: 10, mazmorra: 25, pesca: 1 };
export const GESTA_MIN = 20;
export const GESTA_ANTIG_MS = 24 * 3600000;   // un dia en la hermandad para cobrar
export const premioGesta = (i, nivel) => ({ oro: [100, 250, 500][i] * Math.max(1, nivel) });

// ── MAZMORRAS ──
// Instancias privadas: cada grupo (o cada jugador solo) entra a su propia
// copia. El nivel de la mazmorra se ajusta al del grupo dentro de su tramo y
// la vida de los monstruos al numero de jugadores, asi se pueden hacer solo
// o con amigos. Grupos de monstruos ("packs") agresivos y 3 jefes; cada jefe
// abre la barrera que guarda. Dan experiencia, oro y equipo (nunca mTON).
export const MAZMORRAS = {
  madriguera: {
    nombre: 'Madriguera Goblin', mapa: 'madriguera', nv: [6, 16], icono: 'I_Torch01', sinDesafio: true,
    desc: 'La primera mazmorra: los goblins del bosque esconden aquí lo que roban. Ideal para aprender a esquivar las zonas del suelo.',
    packs: [
      { x: 520, k: ['goblin_normal', 'goblin_normal'] }, { x: 900, k: ['goblin_peasant', 'goblin_normal'] }, { x: 1250, k: ['goblin_assassin', 'goblin_peasant', 'goblin_normal'] },
      { x: 2050, k: ['goblin_guard', 'hechicero'] }, { x: 2400, k: ['goblin_peasant', 'goblin_assassin', 'goblin_peasant'] },
      { x: 3250, k: ['goblin_guard', 'goblin_guard'] }, { x: 3550, k: ['hechicero', 'goblin_guard', 'goblin_assassin'] },
    ],
    jefes: [{ k: 'mz_hongo', x: 1620, muro: 1820 }, { k: 'mz_rana', x: 2800, muro: 3000 }, { k: 'mz_cabecilla', x: 3950, muro: 4200, final: true }],
  },
  catacumbas: {
    nombre: 'Catacumbas del Duende', mapa: 'catacumbas', nv: [10, 30], icono: 'E_Bones02',
    desc: 'Bajo el pueblo duerme un ejército de huesos. Tres guardianes custodian la cripta.',
    packs: [
      { x: 520, k: ['esqueleto', 'esqueleto'] }, { x: 900, k: ['fantasma', 'esqueleto'] }, { x: 1250, k: ['goblin_assassin', 'esqueleto', 'fantasma'] },
      { x: 2050, k: ['esqueleto', 'hechicero'] }, { x: 2400, k: ['fantasma', 'fantasma', 'esqueleto'] },
      { x: 3250, k: ['goblin_assassin', 'goblin_assassin'] }, { x: 3550, k: ['esqueleto', 'hechicero', 'esqueleto'] },
    ],
    jefes: [{ k: 'mz_guardian', x: 1620, muro: 1820 }, { k: 'mz_bruja', x: 2800, muro: 3000 }, { k: 'mz_senor', x: 3950, muro: 4200, final: true }],
  },
  fortaleza: {
    nombre: 'Fortaleza Goblin', mapa: 'fortaleza', nv: [20, 40], icono: 'I_GoldBar',
    desc: 'El Rey Goblin guarda aquí todo lo que robó al pueblo. Sus capitanes no lo sueltan sin pelear.',
    packs: [
      { x: 520, k: ['goblin_guard', 'goblin_guard'] }, { x: 900, k: ['goblin_centurion', 'goblin_mage'] }, { x: 1250, k: ['goblin_knight', 'goblin_guard', 'goblin_mage'] },
      { x: 2050, k: ['goblin_battlelord', 'goblin_centurion'] }, { x: 2400, k: ['ghoul_ardiente', 'goblin_mage', 'ghoul_ardiente'] },
      { x: 3250, k: ['goblin_samurai', 'goblin_samurai'] }, { x: 3550, k: ['goblin_battlelord', 'goblin_mage', 'goblin_knight'] },
    ],
    jefes: [{ k: 'mz_capataz', x: 1620, muro: 1820 }, { k: 'mz_chaman', x: 2800, muro: 3000 }, { k: 'mz_rey_goblin', x: 3950, muro: 4200, final: true }],
  },
  templo: {
    nombre: 'Templo Hundido', mapa: 'templo', nv: [30, 48], icono: 'S_Water07',
    desc: 'Un templo tragado por el mar. Algo enorme se mueve entre sus columnas.',
    packs: [
      { x: 520, k: ['cangrejo', 'cangrejo'] }, { x: 900, k: ['pez', 'pez_dardo', 'pez'] }, { x: 1250, k: ['pulpo', 'cosa'] },
      { x: 2050, k: ['baba', 'espectro'] }, { x: 2400, k: ['saltador', 'saltador', 'pulpo'] },
      { x: 3250, k: ['pez_grande', 'espectro'] }, { x: 3550, k: ['cosa', 'baba', 'pulpo'] },
    ],
    jefes: [{ k: 'mz_cangrejo', x: 1620, muro: 1820 }, { k: 'mz_sirena', x: 2800, muro: 3000 }, { k: 'mz_kraken', x: 3950, muro: 4200, final: true }],
  },
  nido: {
    nombre: 'Nido de la Reina Araña', mapa: 'nido', nv: [40, 58], icono: 'S_Poison03',
    desc: 'Bajo los picos, una red de túneles de seda. Algo de tres cabezas guarda la salida.',
    packs: [
      { x: 520, k: ['arana', 'arana'] }, { x: 900, k: ['murcielago', 'esqueleto_capa'] }, { x: 1250, k: ['arana', 'hellgato', 'arana'] },
      { x: 2050, k: ['esqueleto_capa', 'esqueleto_capa'] }, { x: 2400, k: ['murcielago', 'arana', 'murcielago'] },
      { x: 3250, k: ['hellgato', 'hellgato'] }, { x: 3550, k: ['esqueleto_capa', 'arana', 'hellgato'] },
    ],
    jefes: [{ k: 'mz_reina', x: 1620, muro: 1820 }, { k: 'mz_liche', x: 2800, muro: 3000 }, { k: 'mz_cancerbero', x: 3950, muro: 4200, final: true }],
  },
  ciudadela: {
    nombre: 'Ciudadela del Dragón', mapa: 'ciudadela', nv: [45, 60], icono: 'S_Fire06',
    desc: 'La fortaleza del Dragón Carmesí. Solo los duendes más fuertes vuelven a contarlo.',
    packs: [
      { x: 520, k: ['guardia_real', 'guardia_real'] }, { x: 900, k: ['caballero_negro', 'hechicero_corte'] }, { x: 1250, k: ['paladin_goblin', 'guardia_real', 'hechicero_corte'] },
      { x: 2050, k: ['aguila', 'aguila'] }, { x: 2400, k: ['caballero_negro', 'paladin_goblin', 'hechicero_corte'] },
      { x: 3250, k: ['hellgato', 'hellgato'] }, { x: 3550, k: ['paladin_goblin', 'caballero_negro', 'aguila'] },
    ],
    jefes: [{ k: 'mz_caballero', x: 1620, muro: 1820 }, { k: 'mz_archimago', x: 2800, muro: 3000 }, { k: 'mz_dragon', x: 3950, muro: 4200, final: true }],
  },
  // BANDA (como las de WoW): Nv 60, de 1 a 10 jugadores (un grupo se
  // convierte en banda para pasar de 5). Cuatro jefes con mecanicas que se
  // hacen en equipo; su botin (nivel 64-66, epico) se cobra UNA vez por
  // semana y jefe; el Titan, vencido en 3 semanas distintas, da su montura.
  // Sin Desafios. Nunca mTON.
  santuario: {
    nombre: 'Santuario del Titán', mapa: 'santuario', nv: [60, 60], banda: true, icono: 'S_Shadow07',
    dif: { vida: 1.5, atk: 1.2 },
    desc: 'BANDA de 1 a 10 jugadores. Bajo el Coliseo despierta el Titán que corrompió al Gran Duende. Su botín se cobra una vez por semana.',
    packs: [
      { x: 520, k: ['caballero_negro', 'caballero_negro'] }, { x: 900, k: ['paladin_goblin', 'hechicero_corte', 'paladin_goblin'] },
      { x: 2050, k: ['baba', 'baba'] }, { x: 2400, k: ['espectro', 'fantasma_halo', 'espectro'] },
      { x: 3450, k: ['fantasma_halo', 'fantasma_halo'] }, { x: 3800, k: ['aguila', 'paladin_goblin', 'aguila'] },
      { x: 4800, k: ['paladin_goblin', 'caballero_negro', 'hechicero_corte'] },
    ],
    jefes: [{ k: 'mz_coloso_ab', x: 1620, muro: 1820 }, { k: 'mz_madre_baba', x: 2900, muro: 3100 }, { k: 'mz_serafin', x: 4250, muro: 4450 }, { k: 'mz_titan', x: 5300, muro: 5560, final: true }],
  },
};
export const BANDA_MAX = 10;     // jugadores en una banda (un grupo normal: 5)
export const BANDA_MONTURA = 3;  // semanas venciendo al Titan para su montura
export const botinBandaNv = final => NIVEL_MAX + (final ? 6 : 4);
// Escala por jugadores dentro (n): la vida crece con cada uno, el daño poco.
// Medido con tools/sim_mazmorra.mjs: solo, cada jefe dura ~30 s; en grupo
// la vida crece mas que el daño del grupo (uno suele curar) y el combate
// dura ~45-50 s, con tiempo para que sus mecanicas importen.
export const escalaMazmorra = n => ({ vidaPack: 2.2 * (1 + 0.8 * (n - 1)), vidaJefe: 26 * (1 + 1.5 * (n - 1)), atkPack: 1, atkJefe: 1.15 + 0.1 * (n - 1) });
// Primera vez de cada dia que completas una mazmorra: premio extra.
export const premioMazmorraDia = nivel => ({ xp: Math.round(xpParaSubir(nivel) * 0.5), oro: 150 * nivel });
// Desafios (final de juego, Nv 60): cualquier mazmorra a Nv 60 con los
// monstruos mas duros en cada paso. Vencer el +k abre el +k+1. Premio: oro y
// un objeto de nivel 60+k (se equipa a Nv 60). Nunca mTON.
export const DESAFIO_MAX = 30;
export const multDesafio = k => ({ vida: 1 + 0.2 * k, atk: 1 + 0.1 * k });
export const premioDesafio = k => ({ oro: 500 * (k + 4), nvItem: 60 + Math.min(k, DESAFIO_MAX), rMin: k >= 10 ? 2 : 1 });
// Afijos semanales de los Desafios (como las M+ de WoW): cambian cada lunes
// UTC y son los mismos para todos. El primario (Fortificado o Tiranico) desde
// el +2 y el secundario desde el +5. Se fijan al abrir la instancia.
export const AFIJOS = {
  fortificado: { nombre: 'Fortificado', emoji: '🛡️', desde: 2, desc: 'Los monstruos que no son jefes tienen +25% de vida y +15% de daño.' },
  tiranico:    { nombre: 'Tiránico',    emoji: '👑', desde: 2, desc: 'Los jefes tienen +25% de vida y +15% de daño.' },
  furioso:     { nombre: 'Furioso',     emoji: '😡', desde: 5, desc: 'Los monstruos que no son jefes se enfurecen bajo el 30% de vida (+50% de daño): remátalos rápido.' },
  volcanico:   { nombre: 'Volcánico',   emoji: '🌋', desde: 5, desc: 'En combate brotan llamas bajo los pies de cada uno cada pocos segundos: sal de la marca o salta.' },
  sanguinario: { nombre: 'Sanguinario', emoji: '🩸', desde: 5, desc: 'Al morir, un monstruo cura un 20% de su vida a los de su pack que sigan vivos: mátenlos a la vez.' },
};
const AF_PRIM = ['fortificado', 'tiranico'], AF_SEC = ['furioso', 'volcanico', 'sanguinario'];
export function afijosSemana(sem = semanaUTC()) {
  const n = Math.round(Date.parse(sem + 'T00:00:00Z') / (7 * 86400000));
  return [AF_PRIM[n % 2], AF_SEC[n % 3]];
}
export const afijosDe = (k, sem) => (k ? afijosSemana(sem).filter(a => k >= AFIJOS[a].desde) : []);
export const multAfijos = (af = []) => {
  const f = af.includes('fortificado'), t = af.includes('tiranico');
  return { vidaPack: f ? 1.25 : 1, atkPack: f ? 1.15 : 1, vidaJefe: t ? 1.25 : 1, atkJefe: t ? 1.15 : 1 };
};
// Ranking semanal de Desafios: el mejor +k vencido en la semana (con sus
// afijos). Premia al top 3 cada lunes, solo desde el +5 para que no se gane
// con un +1. Solo oro y un titulo.
export const DES_SEM_MIN = 5;
// Boveda semanal (como la Gran Camara de WoW): las mazmorras completadas en
// la semana (lunes a domingo UTC) abren 1, 2 o 3 objetos y el lunes eliges
// UNO. Nivel del objeto: el tuyo o, si venciste Desafios, 60 + tu mejor +k
// de la semana (epico desde el +5). Sin compra ni mTON.
export const BOVEDA_UMBRALES = [1, 4, 8];
export const opcionesBoveda = n => BOVEDA_UMBRALES.filter(u => n >= u).length;
export const premioDesSem = i => [20000, 10000, 5000][i] || 0;
export const nivelMazmorra = (mz, nivelGrupo) => Math.max(mz.nv[0], Math.min(mz.nv[1], nivelGrupo));

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
    plataformas: [[420, 300, 160], [1215, 300, 110], [860, 240, 180]],   // la del medio, sin cruzar el portal del Coliseo
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
      { x: 1400, a: 'coliseo',   ax: 300,  etiqueta: 'Coliseo', nv: 'Jefe mundial' },
      { x: 795,  buscador: 1,             etiqueta: 'Mazmorras', nv: 'Solo o en grupo' },
    ],
    npcs: [
      { id: 'mercader', nombre: 'Mercader Grumo', hoja: 'goblin_peasant', x: 950, tipo: 'tienda' },
      { id: 'guia', nombre: 'Guardia Tito', hoja: 'goblin_guard', x: 640, tipo: 'guia' },
      { id: 'sabio', nombre: 'Sabio Hechicero', hoja: 'hechicero', x: 1180, tipo: 'ranking' },
      { id: 'artesana', nombre: 'Artesana Lila', hoja: 'goblin_mage', x: 1680, tipo: 'artesania' },
    ],
    spawn: 720,
  },
  noche: {
    nombre: 'Bosque Nocturno', fondo: 'noche', ancho: 2600, zona: true, nv: [1, 6],
    paleta: { cielo: ['#010015', '#050520'], suelo: '#0a1a0f', linea: '#00ff88' },
    plataformas: [[500, 300, 200], [900, 240, 160], [1400, 290, 220], [1900, 250, 180]],
    portales: [{ x: 60, a: 'pueblo', ax: 150, etiqueta: 'Pueblo Duende' }, { x: 2540, a: 'amanecer', ax: 150, etiqueta: 'Colinas Rojas', nv: '6-12' }],
    monstruos: ['goblin_normal', 'esqueleto', 'goblin_assassin', 'fantasma', 'hechicero'], max: 12,
    // Guarida al fondo, pasados los hechiceros: en el medio (x 1612) cazaba
    // a los novatos de las misiones 2 y 3 (medido: 75-94 muertes en 40 min).
    jefe: 'jefe_sabueso', jefeX: 2330,
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
  // ── MAZMORRAS (instancias privadas para tu grupo o para ti solo) ──
  // muros: barreras magicas que se abren al vencer al jefe que las guarda.
  madriguera: {
    nombre: 'Madriguera Goblin', fondo: 'noche', ancho: 4400, zona: true, instancia: true, mazmorra: 'madriguera',
    paleta: { cielo: ['#010015', '#08081f'], suelo: '#0a1a0f', linea: '#84cc16' },
    plataformas: [[700, 290, 200], [1250, 250, 180], [2200, 285, 220], [3300, 260, 200]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  catacumbas: {
    nombre: 'Catacumbas del Duende', fondo: 'cavernas', ancho: 4400, zona: true, instancia: true, mazmorra: 'catacumbas',
    paleta: { cielo: ['#12061f', '#3a1450'], suelo: '#120a1c', linea: '#a8a29e' },
    plataformas: [[700, 290, 200], [1250, 250, 180], [2200, 285, 220], [3300, 260, 200]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  fortaleza: {
    nombre: 'Fortaleza Goblin', fondo: 'cumbres', ancho: 4400, zona: true, instancia: true, mazmorra: 'fortaleza',
    paleta: { cielo: ['#2a1630', '#7a4a6a'], suelo: '#1a1307', linea: '#eab308' },
    plataformas: [[680, 285, 210], [1280, 245, 190], [2230, 280, 210], [3320, 255, 210]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  templo: {
    nombre: 'Templo Hundido', fondo: 'abismo', ancho: 4400, zona: true, instancia: true, mazmorra: 'templo',
    paleta: { cielo: ['#02101c', '#0b3550'], suelo: '#06141c', linea: '#38bdf8' },
    plataformas: [[650, 285, 220], [1300, 245, 180], [2250, 280, 200], [3350, 250, 220]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  nido: {
    nombre: 'Nido de la Reina Araña', fondo: 'tormenta', ancho: 4400, zona: true, instancia: true, mazmorra: 'nido',
    paleta: { cielo: ['#0a0a18', '#1c1430'], suelo: '#10141a', linea: '#a3e635' },
    plataformas: [[690, 285, 210], [1270, 245, 190], [2220, 280, 210], [3330, 250, 210]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  santuario: {
    nombre: 'Santuario del Titán', fondo: 'amanecer2', ancho: 5800, zona: true, instancia: true, mazmorra: 'santuario',
    paleta: { cielo: ['#0b0820', '#2a1d5c'], suelo: '#0d0a1f', linea: '#818cf8' },
    plataformas: [[700, 290, 200], [1250, 245, 200], [2230, 280, 220], [3600, 250, 210], [4900, 285, 200]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 5740, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  ciudadela: {
    nombre: 'Ciudadela del Dragón', fondo: 'tormenta2', ancho: 4400, zona: true, instancia: true, mazmorra: 'ciudadela',
    paleta: { cielo: ['#1a0505', '#3a0a0a'], suelo: '#1a0a0a', linea: '#f97316' },
    plataformas: [[700, 290, 200], [1250, 240, 200], [2200, 285, 220], [3300, 245, 200]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }, { x: 4340, a: 'pueblo', ax: 795, etiqueta: 'Salida', fin: 1 }],
    monstruos: [], max: 0,
  },
  // Arena del jefe mundial (para todos los niveles): sin monstruos propios.
  // ── TORRE DEL DUENDE (functions/mmo/torre.js): una sala por piso ──
  torre: {
    nombre: 'Torre del Duende', fondo: 'tormenta2', ancho: 1400, zona: true, instancia: true, torre: true,
    paleta: { cielo: ['#0d0a1a', '#2a1440'], suelo: '#160f22', linea: '#c084fc' },
    plataformas: [[350, 285, 200], [1050, 285, 200], [700, 225, 180]],
    portales: [{ x: 60, a: 'pueblo', ax: 795, etiqueta: 'Salida' }],
    monstruos: [], max: 0,
  },
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
  // Solo letras latinas (con tildes y ñ), cifras, espacio y '_': las letras
  // cirilicas o griegas identicas a las latinas servian para suplantar.
  const n = String(s || '').normalize('NFC').replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ _]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
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
export const FONDO_PCT_INGRESOS = 0;   // el fondo lo aporta solo el creador (/fondo), no los ingresos (22-oct-2026)                // 30% de los ingresos semanales
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

// Limites para que el fondo dure: un retiro cada 7 dias y como mucho 10 TON
// por retiro (lo que sobre se queda en el saldo para el siguiente).
export const RETIRO_MAX_MTON = 10000;
export const RETIRO_CADA_MS = 7 * 86400000;
export const TOPE_DIARIO_PCT = 0.2;    // ningun jugador se lleva mas del 20% del fondo del dia

// ── TIENDA PREMIUM ──
// Con dinero real se compran cosas DEL JUEGO (oro y poderes), NUNCA mTON:
// asi lo que entra sostiene el fondo y nadie paga para "retirar mas". Se paga
// con Stars dentro de Telegram y con SOL en la web (Telegram no permite otras
// cadenas en sus Mini Apps). El dueño revisa cada pago y entrega a mano con
// /entregar en el bot: con pocos jugadores es lo mas transparente.
export const STAR_USD = 0.013;   // lo mismo que usa el bot para las skins
// ── ALAS (el vuelo de AION) ──
// vuelo: segundos de energia; vel: velocidad en el aire (multiplica la de a
// pie). Las de oro se compran al Mercader; las del Rey Goblin se ganan con 5
// mazmorras completadas; las de $DUENDE y Solares son premium (pago con SOL o
// $DUENDE): algo mejores, nada que rompa el juego.
export const ALAS = {
  aprendiz: { nombre: 'Alas de Aprendiz',    forma: 'luz',      color: '#c4b5fd', vuelo: 60,  vel: 1.25, nv: 1,  precio: 0, icono: 'S_Wind02' },
  pluma:    { nombre: 'Alas de Pluma Blanca', forma: 'pluma',   color: '#f5f5f4', vuelo: 80,  vel: 1.3,  nv: 15, precio: 6000, icono: 'S_Holy01' },
  hada:     { nombre: 'Alas de Hada',         forma: 'mariposa', color: '#f0abfc', vuelo: 95,  vel: 1.33, nv: 25, precio: 20000, icono: 'S_Magic02' },
  fenix:    { nombre: 'Alas de Fénix',        forma: 'pluma',   color: '#fb923c', vuelo: 110, vel: 1.36, nv: 35, precio: 50000, brillo: true, icono: 'S_Fire02' },
  dragon:   { nombre: 'Alas de Dragón',       forma: 'membrana', color: '#7c3aed', vuelo: 130, vel: 1.4,  nv: 45, precio: 120000, icono: 'S_Shadow06' },
  cueva:    { nombre: 'Alas del Rey Goblin',  forma: 'membrana', color: '#ffd84a', vuelo: 100, vel: 1.35, nv: 1,  precio: 0, mazmorras: 5, icono: 'S_Buff14' },
  duende:   { nombre: 'Alas de $DUENDE',      forma: 'luz',      color: '#22d3ee', vuelo: 120, vel: 1.4,  nv: 1,  usd: 4, brillo: true, premium: true, icono: 'I_Crystal01' },
  solar:    { nombre: 'Alas Solares',         forma: 'pluma',    color: '#facc15', vuelo: 140, vel: 1.42, nv: 1,  usd: 8, brillo: true, premium: true, icono: 'S_Fire02' },
};
export const alaDe = c => ALAS[c && c.ala] || ALAS.aprendiz;
export const PAQUETES = [
  { id: 'oro1',  nombre: 'Bolsita de oro',     usd: 1,  oro: 5000,   icono: 'I_GoldCoin',  desc: '5.000 oro' },
  { id: 'kit',   nombre: 'Kit del aventurero', usd: 3,  pw: { pocion: 20, escudo: 8, rayo: 8, fuego: 8 }, icono: 'I_Chest01', desc: '20 pociones, 8 escudos, 8 rayos y 8 fuegos' },
  { id: 'oro5',  nombre: 'Saco de oro',        usd: 5,  oro: 30000,  icono: 'I_GoldBar',  desc: '30.000 oro (+20% de regalo)' },
  { id: 'oro20', nombre: 'Cofre de oro',       usd: 20, oro: 140000, icono: 'I_Chest02', desc: '140.000 oro (+40% de regalo)' },
];
// Las skins con precio en dolares tambien son paquetes de la tienda premium
// (id 'skin_<id>'); al entregarlas se añaden a tus skins.
for (const [id, sk] of Object.entries(SKINS)) {
  if (sk.usd) PAQUETES.push({ id: 'skin_' + id, nombre: 'Skin ' + sk.nombre, usd: sk.usd, skin: id, img: sk.img, desc: sk.desc + (sk.premium ? ' · exclusiva' : '') });
}
// Alas premium (mundo 3D).
for (const [id, al] of Object.entries(ALAS)) {
  if (al.usd) PAQUETES.push({ id: 'alas_' + id, nombre: al.nombre, usd: al.usd, alas: id, icono: al.icono, desc: `${al.vuelo} s de vuelo y +${Math.round((al.vel - 1) * 100)}% de velocidad en el aire · exclusivas` });
}
// $DUENDE: el token del juego (SPL de pump.fun, 6 decimales). Pagar con el
// token tiene un 10% de descuento sobre el precio en dolares.
export const DUENDE_MINT = 'HtkZy2a4bVKX8v1JNuCB9PHJygbcRjbTpX1FXrFTpump';
export const DUENDE_DECIMALES = 6;
export const DUENDE_DESCUENTO = 0.9;
export const estrellasDe = usd => Math.ceil(usd / STAR_USD);
export const PEDIDO_VIGENCIA_MS = 30 * 60 * 1000;   // 30 min para pagar

// ── GESTOS (/saludar, /bailar...): un emoji grande sobre tu duende que ven
// los de tu mapa. Solo social.
export const GESTOS = {
  saludar:  { e: '👋', txt: 'saluda' },
  bailar:   { e: '💃', txt: 'baila' },
  reir:     { e: '😂', txt: 'se ríe' },
  aplaudir: { e: '👏', txt: 'aplaude' },
  gracias:  { e: '🙏', txt: 'da las gracias' },
  si:       { e: '👍', txt: 'dice que sí' },
  enojo:    { e: '😡', txt: 'se enfada' },
  llorar:   { e: '😭', txt: 'llora' },
};

// ── HORA FELIZ ──
// Cada dia de 01:00 a 02:00 UTC (20:00-21:00 en Peru) la experiencia de caza
// sube un 50%. Un motivo para volver cada dia a la misma hora. Sin mTON.
export const HORA_FELIZ = { ini: 1, fin: 2, xp: 1.5 };
export function horaFelizActiva(t = Date.now()) { const h = new Date(t).getUTCHours(); return h >= HORA_FELIZ.ini && h < HORA_FELIZ.fin; }
// ms que faltan para que empiece (0 si esta activa) y para que acabe.
export function horaFelizTiempos(t = Date.now()) {
  const d = new Date(t);
  const hoyIni = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HORA_FELIZ.ini);
  const hoyFin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HORA_FELIZ.fin);
  if (t >= hoyIni && t < hoyFin) return { activa: true, falta: 0, acaba: hoyFin - t };
  const prox = t < hoyIni ? hoyIni : hoyIni + 86400000;
  return { activa: false, falta: prox - t, acaba: 0 };
}

// ── MERCADER AMBULANTE (viernes a domingo UTC) ──
// Cada fin de semana el Mercader trae 2 colores de nombre y 1 mascota que no
// vende el resto de la semana; la oferta rota cada semana. Solo estetica y
// con oro. Lo que compras es tuyo para siempre.
Object.assign(TINTES, {
  coral:  { nombre: 'Coral Marino',     color: '#ff7f6e', nv: 15, precio: 35000, amb: true },
  hielo:  { nombre: 'Hielo Eterno',     color: '#a5f3fc', nv: 15, precio: 35000, amb: true },
  sombra: { nombre: 'Sombra Violeta',   color: '#8b5cf6', nv: 25, precio: 50000, amb: true },
  lima:   { nombre: 'Lima Ácida',       color: '#bef264', nv: 25, precio: 50000, amb: true },
  sangre: { nombre: 'Sangre de Dragón', color: '#dc2626', nv: 40, precio: 80000, amb: true },
  aurora: { nombre: 'Aurora',           color: '#5eead4', nv: 40, precio: 80000, amb: true },
});
Object.assign(MASCOTAS, {
  hongo_dorado:  { nombre: 'Hongo Dorado',    hoja: 'hongo',    alto: 24, nv: 15, precio: 60000,  tinte: '#facc15', amb: true },
  rana_azul:     { nombre: 'Rana Azul',       hoja: 'rana',     alto: 24, nv: 20, precio: 70000,  tinte: '#38bdf8', amb: true },
  pajaro_fuego:  { nombre: 'Pájaro de Fuego', hoja: 'pajaro',   alto: 24, nv: 30, precio: 110000, tinte: '#f97316', vuela: true, amb: true },
  fantasma_rosa: { nombre: 'Fantasmita Rosa', hoja: 'fantasma', alto: 28, nv: 40, precio: 160000, tinte: '#f472b6', vuela: true, amb: true },
});
export const AMB_TINTES = ['coral', 'hielo', 'sombra', 'lima', 'sangre', 'aurora'];
export const AMB_MASCOTAS = ['hongo_dorado', 'rana_azul', 'pajaro_fuego', 'fantasma_rosa'];
export const ambulanteActivo = (t = Date.now()) => [5, 6, 0].includes(new Date(t).getUTCDay());
export function ambulanteOferta(sem = semanaUTC()) {
  const n = Math.round(Date.parse(sem + 'T00:00:00Z') / (7 * 86400000));
  return { tintes: [AMB_TINTES[(2 * n) % 6], AMB_TINTES[(2 * n + 1) % 6]], mascotas: [AMB_MASCOTAS[n % 4]] };
}
export const enOfertaAmbulante = (k, id) => ambulanteActivo() && ambulanteOferta()[k === 'tinte' ? 'tintes' : 'mascotas'].includes(id);

// ── JEFES MUNDIALES QUE ROTAN ──
// Cada media hora sale otro (el que toca en el instante t).
export const MUNDIALES = ['jefe_mundial', 'mundial_tormenta', 'mundial_coloso'];
export const mundialDe = t => MUNDIALES[Math.floor(t / 1800000) % MUNDIALES.length];

// ── PASE DE TEMPORADA (gratis, se renueva cada mes UTC) ──
// Jugar da puntos (misiones diarias y semanales, su bono, mazmorras y jefe
// mundial); cada 75 puntos, un nivel con premio que se cobra a mano en el
// registro de misiones (L). Al nivel 20, una mascota que no se vende. Sin
// compra y sin mTON.
export const PASE = { niveles: 20, porNivel: 75, puntos: { diaria: 10, semanal: 30, bono: 15, mazmorra: 6, mundial: 10, torre: 4, exped: 3 } };
export const paseMes = (t = Date.now()) => new Date(t).toISOString().slice(0, 7);
export function premioPase(n, nivel) {
  const oro = k => Math.round(k * Math.max(1, nivel));
  if (n === PASE.niveles) return { mascota: 'duende_pase', oro: oro(600), txt: 'la mascota Duendecillo Dorado y ' + oro(600).toLocaleString('es', { useGrouping: 'always' }) + ' de oro' };
  if (n === 10) return { item: 2, oro: oro(300), txt: 'un objeto épico y ' + oro(300).toLocaleString('es', { useGrouping: 'always' }) + ' de oro' };
  if (n % 5 === 0) return { item: 1, oro: oro(200), txt: 'un objeto raro y ' + oro(200).toLocaleString('es', { useGrouping: 'always' }) + ' de oro' };
  if (n % 3 === 0) return { pw: { pocion: 5, escudo: 2 }, txt: '5 pociones y 2 escudos' };
  if (n % 3 === 2) return { pw: { rayo: 2, fuego: 2 }, txt: '2 rayos y 2 fuegos' };
  return { oro: oro(60 + 15 * n), txt: oro(60 + 15 * n).toLocaleString('es', { useGrouping: 'always' }) + ' de oro' };
}
MASCOTAS.duende_pase = { nombre: 'Duendecillo Dorado', hoja: 'goblin_normal', alto: 26, nv: 1, precio: 0, tinte: '#facc15', pase: true };
// Solo pescando (PESCA.mascota por captura; segura a las mascotaSeguro capturas).
MASCOTAS.pececito = { nombre: 'Pececito Dorado', hoja: 'pez', alto: 22, nv: 1, precio: 0, tinte: '#facc15', vuela: true, pesca: true };
LOGROS.push(
  { id: 'pase10', titulo: 'Aventurero del Pase', desc: 'Llega al nivel 10 del pase de temporada', oro: 2000, cond: c => (c.paseMax || 0) >= 10 },
  { id: 'pase20', titulo: 'Leyenda del Pase',    desc: 'Completa los 20 niveles del pase de temporada', oro: 5000, cond: c => (c.paseMax || 0) >= 20 },
);

// ── TORRE DEL DUENDE ── (functions/mmo/torre.js)
// Pisos con oleadas de monstruos de tu nivel, cada uno mas duro; un jefe
// cada jefeCada. tiempo por piso; porHora subidas por jugador; max por grupo.
export const TORRE = { nv: 10, max: 5, jefeCada: 5, pausa: 3500, tiempo: 150000, porHora: 12, instancias: 30, vidaJefe: 0.35, atkJefe: 0.8, semMin: 10, montura: 30, xp: 0.6 };
// Premio del ranking semanal (desde el piso semMin): 1º, 2º y 3º.
export const premioTorreSem = i => [15000, 7500, 3500][i] || 0;
// Atajo: con marca semanal de 10+, se puede empezar 5 pisos por debajo de
// ella (en multiplos de 5). Los cofres siguen siendo por marca nueva.
export const atajoTorre = max => (max >= 10 ? Math.floor(max / 5) * 5 - 5 : 0);
// Modificador de cada piso (no en los de jefe): variedad entre subidas.
export const MODS_TORRE = {
  veloces:   { emoji: '💨', nombre: 'Veloces',   desc: 'se mueven un 30% más rápido' },
  blindados: { emoji: '🛡️', nombre: 'Blindados', desc: '+30% de vida, -10% de daño' },
  elite:     { emoji: '⭐', nombre: 'Élite',     desc: 'uno de ellos tiene el triple de vida y +30% de daño' },
};
export const modTorre = p => (p % 5 === 0 ? null : p % 7 === 0 ? 'elite' : p % 4 === 2 ? 'veloces' : p % 4 === 3 ? 'blindados' : null);
export const pisoTorre = p => ({ n: Math.min(6, 2 + Math.floor((p - 1) / 3)), vida: 1.2 * Math.pow(1.07, p - 1), atk: Math.pow(1.045, p - 1), jefe: p % 5 === 0 });
// Cofre de cada 5 pisos nuevos de la semana: oro (hasta el piso 50) y equipo (epico desde el 15).
export const premioTorre = (p, nivel) => ({ oro: Math.round(40 * nivel * Math.min(10, p / 5)), rMin: p >= 15 ? 2 : 1 });

// ── EXPEDICIONES ── (functions/mmo/expediciones.js)
// Tu mascota (o un duendecillo) sale 1, 4 u 8 horas y vuelve con oro, algo
// de experiencia y materiales. Da menos que jugar esas horas. Nunca mTON.
export const EXPEDICION = { nv: 5, horas: [1, 4, 8],
  // Cada destino trae el doble de su material.
  destinos: { bosque: { nombre: 'Bosque', a: 'al Bosque', emoji: '🌲', mat: 'hierba' }, mina: { nombre: 'Mina', a: 'a la Mina', emoji: '⛏️', mat: 'mineral' }, lago: { nombre: 'Lago', a: 'al Lago', emoji: '🎣', mat: 'pescado' } } };
export const premioExpedicion = (h, nv, dest) => {
  const k = Math.pow(h, 0.75);
  const mat = { hierba: Math.ceil(h * 1.5), mineral: Math.ceil(h * 1.5), pescado: h };
  const d = EXPEDICION.destinos[dest];
  if (d) mat[d.mat] *= d.mat === 'pescado' ? 3 : 2;
  if (h >= 8) mat.cristal = 1;
  return { oro: Math.round(40 * nv * k), xp: Math.round(xpParaSubir(nv) * 0.02 * k), mat };
};

// Progreso de los logros que se cuentan (para la barra de la ventana de
// logros): id -> [campo del personaje, meta]. Los de temporada usan su campo.
const PROG_LOGRO = {
  caza100: ['kills', 100], caza1000: ['kills', 1000], caza5000: ['kills', 5000], jefe1: ['jefes', 1], jefe25: ['jefes', 25],
  nv20: ['nivel', 20], nv40: ['nivel', 40], nv60: ['nivel', 60], mundial1: ['mundiales', 1], mundial10: ['mundiales', 10],
  duelista: ['duelosG', 10], mazmorra1: ['mazmorras', 1], desafio5: ['desafioMax', 5], desafio10: ['desafioMax', 10], desafio20: ['desafioMax', 20],
  pesca50: ['peces', 50], pesca500: ['peces', 500], torre10: ['torreMax', 10], torre25: ['torreMax', 25], exped25: ['expediciones', 25],
  amigo1: ['amigos', 1], amigo5: ['amigos', 5], zonas10: ['nVisitadas', 10], especies: ['nEspecies', 11], dorados25: ['dorados', 25], exped8: ['exped8', 10],
};
export function progresoLogro(id, c) {
  let p = PROG_LOGRO[id];
  if (!p) {
    // Los de temporada: el primer titulo pide 50 de su objeto y el segundo 200.
    const L = LOGROS.find(x => x.id === id);
    const t = L && TEMPORADAS.find(x => (x.titulos || []).includes(L.titulo));
    if (t) p = [t.campo, t.titulos.indexOf(L.titulo) ? 200 : 50];
  }
  if (!p) return null;
  return [Math.min(c[p[0]] || 0, p[1]), p[1]];
}

// ── CLIMA ── Algunas horas llueve o nieva en ciertas zonas; cambia cada
// hora y es igual para todos. Con lluvia el Pez Dorado sale el doble.
export const CLIMA = { selva: 'lluvia', tormenta: 'lluvia', abismo: 'lluvia', acantilados: 'lluvia', cumbres: 'nieve' };
export function climaDe(id, t = Date.now()) {
  const c = CLIMA[id];
  return c && (Math.floor(t / 3600000) + [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % 3 === 0 ? c : null;
}

