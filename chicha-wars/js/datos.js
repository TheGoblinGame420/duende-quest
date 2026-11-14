// ═══════════════════════════════════════════════════════
// CHICHA WARS — datos del juego (v1, 14-nov-2026)
// Preparas chicha morada en tus ollas, los duendes vienen a robarla y la
// vendes a los clientes de tu puesto. Todo el equilibrio vive aqui.
// ═══════════════════════════════════════════════════════

// Olla: vasos por tanda. Una mejora por olla puesta en la hornilla.
// Seis niveles con el arte del dueño (assets/chicha-wars/olla_1..6): de la olla de barro al caldero celestial.
export const OLLAS = [
  { nombre: 'Olla de barro', vasos: 6, costo: 0 },
  { nombre: 'Olla de hierro', vasos: 10, costo: 150 },
  { nombre: 'Olla de cobre', vasos: 16, costo: 700 },
  { nombre: 'Caldero rúnico', vasos: 24, costo: 2800 },
  { nombre: 'Caldero dorado', vasos: 36, costo: 10000 },
  { nombre: 'Caldero celestial', vasos: 52, costo: 32000 },
];
// Fuego: segundos por tanda (vale para todas las ollas).
export const FUEGOS = [
  { nombre: 'Fogón de leña', seg: 10, costo: 0 },
  { nombre: 'Fuego avivado', seg: 7.5, costo: 250 },
  { nombre: 'Fuego feroz', seg: 5.5, costo: 1400 },
  { nombre: 'Horno mágico', seg: 4, costo: 7000 },
];
// Hornillas: cuantas ollas cocinan a la vez.
export const HORNILLAS = [
  { n: 1, costo: 0 },
  { n: 2, costo: 300 },
  { n: 3, costo: 1800 },
  { n: 4, costo: 8000 },
];
// Receta: precio por vaso (cada nivel suma un ingrediente).
export const RECETAS = [
  { nombre: 'Chicha de maíz morado', ing: 'Maíz morado y agua', precio: 3, costo: 0 },
  { nombre: 'Con canela y clavo', ing: '+ canela y clavo de olor', precio: 4, costo: 250 },
  { nombre: 'Con piña', ing: '+ cáscara de piña', precio: 5, costo: 900 },
  { nombre: 'Con membrillo y manzana', ing: '+ membrillo y manzana', precio: 7, costo: 3200 },
  { nombre: 'Con limón y hielo', ing: '+ limón y hielo picado', precio: 9, costo: 9000 },
  { nombre: 'Receta de la casa', ing: 'El secreto de la abuela', precio: 12, costo: 26000 },
];
// Cucharon: daño por toque a los duendes.
export const CUCHARONES = [
  { nombre: 'Cucharón de palo', dano: 1, costo: 0 },
  { nombre: 'Cucharón tallado', dano: 2, costo: 120 },
  { nombre: 'Cucharón de lloque', dano: 3, costo: 600 },
  { nombre: 'Cucharón de cobre', dano: 5, costo: 2500 },
  { nombre: 'Cucharón encantado', dano: 8, costo: 9000 },
];
// Toldo: cada cuantos segundos llega un cliente.
export const TOLDOS = [
  { nombre: 'Puesto sin toldo', seg: 6, costo: 0 },
  { nombre: 'Toldo de rayas', seg: 4.5, costo: 200 },
  { nombre: 'Toldo con banderines', seg: 3.4, costo: 1100 },
  { nombre: 'Puesto famoso', seg: 2.5, costo: 5000 },
  { nombre: 'La chichería del pueblo', seg: 1.8, costo: 16000 },
];
// Ayudante: recoge ollas solo (nivel 1+) y espanta duendes (dano cada 2 s).
export const AYUDANTES = [
  { nombre: 'Sin ayudante', recoge: false, golpe: 0, costo: 0 },
  { nombre: 'Ayudante que recoge', recoge: true, golpe: 0, costo: 500 },
  { nombre: 'Ayudante con honda', recoge: true, golpe: 1, costo: 2500 },
  { nombre: 'Ayudante campeón', recoge: true, golpe: 3, costo: 9000 },
];

// Maiz morado: cada tanda gasta la mitad de sus vasos en kilos de maiz.
export const MAIZ = { porVaso: 0.5, paquetes: [[10, 12], [40, 44], [120, 120], [400, 360]] };   // [kilos, precio]
export const MAIZ_INICIO = 60, MONEDAS_INICIO = 120;

// Duendes ladrones. vel en px logicos/s; roba: vasos por robo.
export const DUENDES = {
  ladron: { nombre: 'Duende ladrón', vida: 1, vel: 70, roba: 2, premio: 2, desde: 1 },
  rapido: { nombre: 'Duende veloz', vida: 1, vel: 135, roba: 1, premio: 3, desde: 3 },
  gordo:  { nombre: 'Duende panzón', vida: 4, vel: 45, roba: 4, premio: 5, desde: 5 },
  gancho: { nombre: 'Duende del gancho', vida: 2, vel: 60, roba: 3, premio: 4, desde: 8, alcance: 140 },
  jefe:   { nombre: 'Rey de los Ladrones', vida: 20, vel: 32, roba: 10, premio: 40, desde: 10, jefe: true },
};
export const OLEADA_SEG = 40;
// Duendes de la oleada n: crecen poco a poco; el jefe cada 10.
export function oleada(n) {
  const l = [], cuantos = Math.min(18, 2 + Math.floor(n * 0.7));
  for (let i = 0; i < cuantos; i++) {
    const tipos = Object.keys(DUENDES).filter(k => !DUENDES[k].jefe && DUENDES[k].desde <= n);
    l.push(tipos[(i * 7 + n) % tipos.length]);
  }
  if (n % 10 === 0) l.push('jefe');
  return l;
}
export const vidaDuende = (k, n) => DUENDES[k].vida + Math.floor(n / (DUENDES[k].jefe ? 1 : 6)) * (DUENDES[k].jefe ? 3 : 1);
export const premioDuende = (k, n) => DUENDES[k].premio + Math.floor(n / 2);

// Sin conexion: las ollas siguen y los clientes compran a la mitad de ritmo, hasta 8 h; los duendes no roban.
export const OFFLINE_MAX_H = 8;

// ── PASE DE BATALLA (temporada 1) ──
export const PASE = { temporada: 'Temporada 1 · La Gran Cosecha', niveles: 30, xpNivel: 120, fin: '2026-12-31' };
// Premio de cada nivel: gratis y premium. tipo: monedas | maiz | skin
export const PREMIOS_PASE = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const gratis = n === 5 ? { tipo: 'skin', id: 'fiesta' } : n === 12 ? { tipo: 'skin', id: 'puna' } : n === 8 ? { tipo: 'skin', id: 'danzante' } : n === 18 ? { tipo: 'skin', id: 'pescador' }
    : n % 3 === 0 ? { tipo: 'maiz', n: 20 + n * 4 } : { tipo: 'monedas', n: 40 + n * 25 };
  const premium = n === 20 ? { tipo: 'skin', id: 'reina' } : n === 25 ? { tipo: 'skin', id: 'pirata' } : n === 30 ? { tipo: 'skin', id: 'dorada' }
    : n % 2 === 0 ? { tipo: 'maiz', n: 40 + n * 8 } : { tipo: 'monedas', n: 120 + n * 60 };
  return { n, gratis, premium };
});
export const XP = { vaso: 1, duende: 3, tanda: 2, mision: 60, jefe: 40 };

// ── MISIONES DIARIAS (3 al dia, se renuevan a medianoche de Peru) ──
export const MISIONES = [
  { id: 'vende', txt: n => `Vende ${n} vasos`, n: [40, 80, 150], premio: 80 },
  { id: 'espanta', txt: n => `Espanta ${n} duendes`, n: [15, 30, 60], premio: 90 },
  { id: 'tanda', txt: n => `Cocina ${n} tandas`, n: [8, 15, 30], premio: 70 },
  { id: 'mejora', txt: n => `Compra ${n} mejoras`, n: [1, 2, 3], premio: 100 },
  { id: 'oleada', txt: n => `Aguanta ${n} oleadas`, n: [5, 10, 15], premio: 90 },
];
// Premio por dias seguidos jugando (se reinicia si faltas un dia).
export const RACHA = [50, 80, 30, 150, 60, 250, 600];   // dia 3 y 5: maiz; el resto, monedas
export const RACHA_MAIZ = [2, 4];

// ── SKINS (protagonista: chichera o chichero) ──
export const PERSONAJES = { chichera: 'Chichera', chichero: 'Chichero' };
export const SKINS = {
  clasica:  { para: 'chichera', nombre: 'Clásica', paleta: { pollera: '#c0264b', franja: '#f6b52e', blusa: '#f4efe4', manta: '#5b2a86', mandil: '#fffaf0', sombrero: '#3a2b24', cinta: '#e14b2a' }, de: 'inicio' },
  fiesta:   { para: 'chichera', nombre: 'Fiesta patronal', paleta: { pollera: '#ff4fa3', franja: '#ffe14a', blusa: '#ffffff', manta: '#1fb5a9', mandil: '#fff4fb', sombrero: '#f2f2f2', cinta: '#ff4fa3' }, filtro: 'hue-rotate(28deg) saturate(1.35)', de: 'Pase · nivel 5' },
  puna:     { para: 'chichera', nombre: 'Invierno de puna', paleta: { pollera: '#3d5a99', franja: '#e8e1cf', blusa: '#d9c7a8', manta: '#8a3b2c', mandil: '#efe6d4', sombrero: '#5a4636', cinta: '#d9a441' }, filtro: 'hue-rotate(-32deg) saturate(.9) brightness(.97)', de: 'Pase · nivel 12' },
  reina:    { para: 'chichera', nombre: 'Reina de la chicha', paleta: { pollera: '#6a1b9a', franja: '#ffd54a', blusa: '#fff8e1', manta: '#ffd54a', mandil: '#f3e5f5', sombrero: '#4a148c', cinta: '#ffd54a' }, filtro: 'hue-rotate(58deg) saturate(1.25)', de: 'Pase premium · nivel 20', premium: true },
  dorada:   { para: 'chichera', nombre: 'Chichera dorada', paleta: { pollera: '#d4a017', franja: '#7a1fa2', blusa: '#fffbe6', manta: '#b8860b', mandil: '#fff3c4', sombrero: '#7a5a00', cinta: '#7a1fa2' }, filtro: 'sepia(.45) saturate(1.7) brightness(1.06)', de: 'Pase premium · nivel 30', premium: true },
  clasico:  { para: 'chichero', nombre: 'Clásico', paleta: { poncho: '#b3262e', franja: '#f2c23a', camisa: '#f4efe4', pantalon: '#3b3f58', mandil: '#fffaf0', chullo: '#2f62c0', pompon: '#f2c23a' }, de: 'inicio' },
  danzante: { para: 'chichero', nombre: 'Danzante de tijeras', paleta: { poncho: '#1e88e5', franja: '#ff5252', camisa: '#ffffff', pantalon: '#263238', mandil: '#ffebee', chullo: '#ff5252', pompon: '#ffd740' }, filtro: 'hue-rotate(160deg) saturate(1.3)', de: 'Pase · nivel 8' },
  pescador: { para: 'chichero', nombre: 'Pescador de Chancay', paleta: { poncho: '#0f6e74', franja: '#f6e7c1', camisa: '#e0f2f1', pantalon: '#37474f', mandil: '#fff', chullo: '#f6e7c1', pompon: '#0f6e74' }, filtro: 'hue-rotate(120deg) saturate(.9)', de: 'Pase · nivel 18' },
  pirata:   { para: 'chichero', nombre: 'Pirata del Callao', paleta: { poncho: '#2b2b2b', franja: '#c62828', camisa: '#fafafa', pantalon: '#4e342e', mandil: '#ffebee', chullo: '#c62828', pompon: '#fafafa' }, filtro: 'grayscale(.5) contrast(1.15)', de: 'Pase premium · nivel 25', premium: true },
};

// Contacto oficial de la chicha real (solo enlace: el juego no regala chicha).
export const WHATSAPP_CHICHA = 'https://wa.me/51916778731';
// ── HERRAMIENTAS (tablas del dueño, 14-nov-2026): 5 rarezas cada una, con el arte de assets/chicha-wars/<id>_1..5 ──
export const RAREZAS = [
  { nombre: 'Común', color: '#b9b9b9' }, { nombre: 'Poco común', color: '#5fd068' }, { nombre: 'Raro', color: '#4fa8ff' },
  { nombre: 'Épico', color: '#c06cf0' }, { nombre: 'Legendario', color: '#ffb52e' },
];
const COSTO_R = [0, 300, 1800, 9000, 45000];
export const HERRAMIENTAS = {
  cucharon: { nombre: 'Cucharón', que: 'Velocidad de cocción y producción', f: 1, niv: [
    { d: 'Madera rústica tallada', coccion: 0.10, prod: 0, dano: 1, txt: '' },
    { d: 'Madera dura con bandas de cobre', coccion: 0.25, prod: 0.05, dano: 2, txt: '+5 % de vasos por tanda' },
    { d: 'Plata labrada con gema de jade', coccion: 0.50, prod: 0.15, dano: 3, txt: '+15 % de vasos por tanda; la olla no se rebalsa' },
    { d: 'Filigrana de oro con amatistas', coccion: 1.00, prod: 0.35, dano: 5, duplica: 0.10, txt: '+35 % de vasos; 10 % de duplicar la tanda' },
    { d: 'Reliquia celestial de oro y obsidiana', coccion: 2.20, prod: 0.80, dano: 8, hervor: true, txt: '+80 % de vasos; Hervor Cósmico: ×3 de velocidad 10 s cada minuto' },
  ] },
  tabla: { nombre: 'Tabla y cuchillo', que: 'Velocidad de corte y ahorro de insumos', f: 0.8, niv: [
    { d: 'Tabla de pino y cuchillo de acero', corte: 0.10, ahorro: 0, txt: '' },
    { d: 'Roble con esquineros de cobre', corte: 0.25, ahorro: 0.08, txt: '8 % de maíz ahorrado' },
    { d: 'Ébano, plata y hoja de Damasco', corte: 0.55, ahorro: 0.18, txt: '18 % de maíz ahorrado' },
    { d: 'Oro ornamentado y hoja de amatista', corte: 1.10, ahorro: 0.30, txt: '30 % de maíz ahorrado' },
    { d: 'Altar rúnico y hoja de fuego azul', corte: 2.50, ahorro: 0.50, txt: '50 % de maíz ahorrado' },
  ] },
  exprimidor: { nombre: 'Exprimidor', que: 'Tandas críticas (valen más)', f: 1, niv: [
    { d: 'Madera tallada con bisagra simple', crit: 0.05, mult: 1.5, txt: 'crítico ×1,5' },
    { d: 'Madera reforzada con bisagra de cobre', crit: 0.10, mult: 2.0, txt: 'crítico ×2' },
    { d: 'Plata grabada con esmeraldas', crit: 0.18, mult: 2.8, txt: 'crítico ×2,8' },
    { d: 'Oro real con gemas de amatista', crit: 0.28, mult: 4.0, txt: 'crítico ×4' },
    { d: 'Artefacto rúnico de energía cósmica', crit: 0.45, mult: 6.5, rafaga: true, txt: 'crítico ×6,5; Ráfaga Cítrica: 5 críticos seguidos cada 20 tandas' },
  ] },
  colador: { nombre: 'Colador', que: 'Calidad de la chicha y reputación', f: 1.2, niv: [
    { d: 'Malla de hierro y mango de madera', calidad: 0.12, rep: 0, txt: '' },
    { d: 'Aro de cobre pulido y remaches', calidad: 0.30, rep: 0.10, txt: '+10 % de reputación (más clientes)' },
    { d: 'Filigrana de plata y malla de mitril', calidad: 0.65, rep: 0.25, txt: '+25 % de reputación' },
    { d: 'Oro labrado y malla de cristal violeta', calidad: 1.30, rep: 0.50, txt: '+50 % de reputación' },
    { d: 'Reliquia solar con malla estelar', calidad: 3.00, rep: 1.20, nectar: true, txt: '+120 % de reputación; Néctar Ancestral: ×2 al valor de todo' },
  ] },
  vaso: { nombre: 'Vaso', que: 'Monedas por venta y propinas', f: 1, niv: [
    { d: 'Jarra de vidrio simple con limón', venta: 0.15, propina: [0.05, 0.20], txt: '5 % de propina (+20 %)' },
    { d: 'Vaso facetado con base de cobre', venta: 0.35, propina: [0.12, 0.35], txt: '12 % de propina (+35 %)' },
    { d: 'Copa de cristal con borde de plata y jade', venta: 0.75, propina: [0.22, 0.60], txt: '22 % de propina (+60 %); llegan aventureros' },
    { d: 'Cáliz de oro y amatista resplandeciente', venta: 1.60, propina: [0.35, 1.00], txt: '35 % de propina (+100 %)' },
    { d: 'Kero ceremonial de cristal y oro rúnico', venta: 4.00, propina: [0.55, 2.00], txt: '55 % de propina (+200 %)' },
  ] },
  jarra: { nombre: 'Jarra', que: 'Reserva de vasos y producción sin conexión', f: 0.8, niv: [
    { d: 'Jarra rústica de barro cocido', cap: 0.25, offH: 2, efic: 0.5, txt: '2 h sin conexión' },
    { d: 'Cerámica vidriada con aros de cobre', cap: 0.60, offH: 4, efic: 0.6, txt: '4 h sin conexión; +10 % de eficiencia' },
    { d: 'Ánfora de plata con turquesas', cap: 1.40, offH: 8, efic: 0.75, txt: '8 h sin conexión; +25 % de eficiencia' },
    { d: 'Jarra real de oro y amatistas', cap: 3.00, offH: 16, efic: 0.75, temp: 0.20, txt: '16 h sin conexión; temperatura ideal (+20 % de precio)' },
    { d: 'Vasija sagrada de obsidiana y cóndor', cap: 7.50, offH: 24, efic: 1, autoventa: true, txt: '24 h sin conexión al 100 %; se vende sola al llenarse' },
  ] },
};
export const costoHerr = (id, r) => Math.round(COSTO_R[r] * HERRAMIENTAS[id].f);
export const STOCK_BASE = 40;   // vasos en reserva sin mejorar la jarra
export const VERSION_CW = 2;
