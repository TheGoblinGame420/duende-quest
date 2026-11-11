// ═══════════════════════════════════════════════════════
// COMBATE DE ORIGINS (3D): datos compartidos por el servidor
// (functions/mmo/mundo3d.js) y el cliente (mundo/js/mundo.js).
//
//  - Arquetipos de IA de las presas de campamento (Nv 8+) y de los élites.
//  - Formas de peligro en el suelo (círculo, cono, línea) y su geometría:
//    la misma función decide en el servidor quién recibe el golpe y en el
//    cliente si estabas dentro.
//  - Remates: una habilidad que pega más a un enemigo ya controlado.
//
// Nada de esto cambia XP, oro ni botín. Los ataques especiales OCUPAN el
// hueco de un golpe normal (no se suman) y se pueden evitar saliendo de la
// forma: ver tools/sim_combate3d.mjs para el equilibrio.
// ═══════════════════════════════════════════════════════

// Arquetipo por especie. Lo que no sale aquí es «perseguidor» (como siempre).
//  embestidor: carga en línea recta (línea en el suelo).
//  barredor:   tajo amplio delante de él (cono en el suelo).
//  tirador:    dispara y se aparta de un salto si te le pegas.
//  curandero:  cura a un compañero herido; se corta pegándole o interrumpiéndolo.
export const ARQUETIPOS = {
  goblin_knight: 'embestidor', lagarto: 'embestidor', caballero_negro: 'embestidor', hellgato: 'embestidor',
  saltador: 'embestidor', pez_dardo: 'embestidor', zarigueya: 'embestidor',
  goblin_centurion: 'barredor', goblin_battlelord: 'barredor', goblin_samurai: 'barredor', guardia_real: 'barredor',
  cangrejo: 'barredor', pez_grande: 'barredor', paladin_goblin: 'barredor',
  goblin_mage: 'tirador', hechicero_corte: 'tirador', pulpo: 'tirador', espectro: 'tirador', fantasma_halo: 'tirador',
  hongo: 'curandero', esqueleto_arcano: 'curandero', esqueleto_capa: 'curandero', cosa: 'curandero',
};
export const ARQ_NIVEL_MIN = 8;   // los monstruos de novato (Nv 1-7) no cambian
export const ARQ_NOMBRE = { embestidor: 'Embestidor', barredor: 'Barredor', tirador: 'Tirador', curandero: 'Curandero' };
// Pista corta para el marco del objetivo (cómo se juega contra él).
export const ARQ_PISTA = {
  embestidor: 'Carga en línea: hazte a un lado',
  barredor: 'Tajo en abanico: sal del cono',
  tirador: 'Se aparta si te acercas',
  curandero: 'Cura a los suyos: córtalo',
};

// ── Ataques especiales (ocupan el hueco de un golpe normal) ──
// dano: multiplicador sobre el golpe normal del monstruo.
export const ESPECIAL = {
  embestida: { f: 'l', ms: 1100, w: 2.6, min: 8, max: 16, dano: 1.6, cada: [14000, 18000], nombre: 'Embestida' },
  barrido:   { f: 'k', ms: 1200, r: 4.6, an: 0.9, dano: 1.6, cada: [13000, 17000], nombre: 'Tajo en abanico' },
};
export const TIRADOR = { cerca: 4, salto: 6, cada: [9000, 12000], pausa: 900 };
export const CURANDERO = { ms: 2500, cura: 0.12, bajo: 0.7, radio: 14, cada: [16000, 22000], corte: 0.1, nombre: 'Cántico de Savia' };

// Jefes de zona: en vez de solo el pisotón redondo, alternan formas (misma
// cadencia y mismo daño que el pisotón; el cono y la línea avisan menos
// tiempo porque se sale antes de ellos). Los jefes de novato (Nv <= 10) no.
export const JEFE_FORMAS = ['c', 'k', 'c', 'l'];
export const JEFE_CONO = { r: 10, an: 0.75, k: 0.8 };    // k: fracción del aviso del pisotón
export const JEFE_LINEA = { r: 18, w: 4.4, k: 0.8 };

// ¿Está (px, pz) dentro de la forma? f: 'c' círculo (x, z, r), 'k' cono
// (origen x, z; mira a ry; radio r; medio ángulo an), 'l' línea (origen x, z;
// hacia ry; largo r; ancho w). ry como en three: atan2(dx, dz).
export function dentroForma(F, px, pz) {
  if (!F) return false;
  const dx = px - F.x, dz = pz - F.z;
  if (F.f === 'k') {
    const d = Math.hypot(dx, dz);
    if (d > F.r) return false;
    if (d < 0.6) return true;   // pegado al origen: dentro (no hay ángulo fiable)
    let a = Math.atan2(dx, dz) - F.ry;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) <= F.an;
  }
  if (F.f === 'l') {
    const sx = Math.sin(F.ry), sz = Math.cos(F.ry);
    const lo = dx * sx + dz * sz, la = Math.abs(dx * sz - dz * sx);
    return lo >= -0.5 && lo <= F.r && la <= F.w / 2;
  }
  return Math.hypot(dx, dz) <= F.r;
}

// ── Remates (sinergias) ──
// Estas habilidades pegan un 20 % más a un enemigo aturdido, enraizado o
// silenciado (30 % si el estado lo puso OTRO jugador). Una vez por estado.
export const REMATES = { golpe_heroico: 1, ejecutar: 1, bola_fuego: 1, castigo: 1, siniestro: 1, eviscerar: 1 };
export const ESTADOS_REMATE = ['aturdido', 'raiz', 'silencio'];
export const REMATE_X = 1.2, SINERGIA_X = 1.3;

// Estados de un monstruo que se muestran en el marco del objetivo.
// i: carácter-icono (fuente DQ Iconos), n: nombre, c: color del borde.
export const ESTADOS_MON = {
  aturdido: { i: '⭐', n: 'Aturdido', c: '#facc15' },
  raiz:     { i: '🔒', n: 'Enraizado', c: '#7dd3fc' },
  silencio: { i: '🔇', n: 'Silenciado', c: '#c084fc' },
  oveja:    { i: '✨', n: 'Llamita', c: '#f9a8d4' },
  dolor:    { i: '⏳', n: 'Dolor', c: '#a78bfa' },
  provoca:  { i: '🎯', n: 'Provocado', c: '#fb923c' },
};
