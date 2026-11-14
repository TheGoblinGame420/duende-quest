// ═══════════════════════════════════════════════════════
// CHICHA WARS — datos del juego (v1, 14-nov-2026)
// Preparas chicha morada en tus ollas, los duendes vienen a robarla y la
// vendes a los clientes de tu puesto. Todo el equilibrio vive aqui.
// ═══════════════════════════════════════════════════════

// Olla: vasos por tanda. Una mejora por olla puesta en la hornilla.
export const OLLAS = [
  { nombre: 'Olla de barro', vasos: 6, costo: 0 },
  { nombre: 'Olla de barro grande', vasos: 10, costo: 150 },
  { nombre: 'Olla de cobre', vasos: 16, costo: 700 },
  { nombre: 'Olla dorada', vasos: 24, costo: 2800 },
  { nombre: 'Olla legendaria', vasos: 36, costo: 10000 },
];
// Fuego: segundos por tanda (vale para todas las ollas).
export const FUEGOS = [
  { nombre: 'Fogón de leña', seg: 30, costo: 0 },
  { nombre: 'Cocina primus', seg: 22, costo: 250 },
  { nombre: 'Cocina a gas', seg: 15, costo: 1400 },
  { nombre: 'Horno mágico', seg: 10, costo: 7000 },
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
  { nombre: 'Sobrina que recoge', recoge: true, golpe: 0, costo: 500 },
  { nombre: 'Sobrina con honda', recoge: true, golpe: 1, costo: 2500 },
  { nombre: 'Sobrina campeona', recoge: true, golpe: 3, costo: 9000 },
];

// Maiz morado: cada tanda gasta la mitad de sus vasos en kilos de maiz.
export const MAIZ = { porVaso: 0.5, paquetes: [[10, 12], [40, 44], [120, 120], [400, 360]] };   // [kilos, precio]
export const MAIZ_INICIO = 30, MONEDAS_INICIO = 60;

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
  fiesta:   { para: 'chichera', nombre: 'Fiesta patronal', paleta: { pollera: '#ff4fa3', franja: '#ffe14a', blusa: '#ffffff', manta: '#1fb5a9', mandil: '#fff4fb', sombrero: '#f2f2f2', cinta: '#ff4fa3' }, de: 'Pase · nivel 5' },
  puna:     { para: 'chichera', nombre: 'Invierno de puna', paleta: { pollera: '#3d5a99', franja: '#e8e1cf', blusa: '#d9c7a8', manta: '#8a3b2c', mandil: '#efe6d4', sombrero: '#5a4636', cinta: '#d9a441' }, de: 'Pase · nivel 12' },
  reina:    { para: 'chichera', nombre: 'Reina de la chicha', paleta: { pollera: '#6a1b9a', franja: '#ffd54a', blusa: '#fff8e1', manta: '#ffd54a', mandil: '#f3e5f5', sombrero: '#4a148c', cinta: '#ffd54a' }, de: 'Pase premium · nivel 20', premium: true },
  dorada:   { para: 'chichera', nombre: 'Chichera dorada', paleta: { pollera: '#d4a017', franja: '#7a1fa2', blusa: '#fffbe6', manta: '#b8860b', mandil: '#fff3c4', sombrero: '#7a5a00', cinta: '#7a1fa2' }, de: 'Pase premium · nivel 30', premium: true },
  clasico:  { para: 'chichero', nombre: 'Clásico', paleta: { poncho: '#b3262e', franja: '#f2c23a', camisa: '#f4efe4', pantalon: '#3b3f58', mandil: '#fffaf0', chullo: '#2f62c0', pompon: '#f2c23a' }, de: 'inicio' },
  danzante: { para: 'chichero', nombre: 'Danzante de tijeras', paleta: { poncho: '#1e88e5', franja: '#ff5252', camisa: '#ffffff', pantalon: '#263238', mandil: '#ffebee', chullo: '#ff5252', pompon: '#ffd740' }, de: 'Pase · nivel 8' },
  pescador: { para: 'chichero', nombre: 'Pescador de Chancay', paleta: { poncho: '#0f6e74', franja: '#f6e7c1', camisa: '#e0f2f1', pantalon: '#37474f', mandil: '#fff', chullo: '#f6e7c1', pompon: '#0f6e74' }, de: 'Pase · nivel 18' },
  pirata:   { para: 'chichero', nombre: 'Pirata del Callao', paleta: { poncho: '#2b2b2b', franja: '#c62828', camisa: '#fafafa', pantalon: '#4e342e', mandil: '#ffebee', chullo: '#c62828', pompon: '#fafafa' }, de: 'Pase premium · nivel 25', premium: true },
};

// Contacto oficial de la chicha real (solo enlace: el juego no regala chicha).
export const WHATSAPP_CHICHA = 'https://wa.me/51916778731';
export const VERSION_CW = 1;
