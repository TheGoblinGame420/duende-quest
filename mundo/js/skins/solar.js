// Traje 3D de la skin «solar» (Duende Solar). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_hero.png teñida (hue 22)
// Qué se ve en la imagen: Sin imagen propia: héroe teñido de dorado (casco, coraza de escamas y escudo de oro, espada de luz).
// Diseño propio: guerrero del sol inca (Inti) con corona de rayos, capa naranja y oro.
//
// Cómo está hecho (11-nov-2026):
// - cabeza(): casco de oro con llauto rojo (cinta con cuadros de tocapu) y, encima, un gran DISCO SOLAR de pie con 7 rayos
//   en abanico (largos y cortos alternados, puntas claras) y centro naranja por delante y por detrás. Cubrenuca de tela roja
//   con filo de oro y orejeras de oro (discos) bajo las orejas. Con sacerdote el abanico es bajo: el halo flota encima.
// - vestir(): gola y pectoral de oro con un sol en el pecho, faja roja con tocapus, faldellín naranja con bajo de oro y
//   paño delantero; capa naranja que se abre hacia abajo, con cenefa roja y oro y un GRAN SOL de oro en la espalda (lo que
//   más se ve en el juego); hombreras escalonadas, brazaletes y grebas de oro. Un solecito gira junto al hombro derecho.
// - Calidad baja (ctx.ligero): sin el solecito (0 mallas sueltas, 0 pivotes), sin puntas de rayo, tocapus, orejeras ni rodilleras.
//   Todo el oro es opaco con brillo propio (bajo la luz del juego el dorado plano se ve marrón) y se funde con su pivote.

// Colores del cuerpo que arma humano(): ropa (torso), mangas, pantalon, botas, acento, cinto, hojaNeon (hoja de luz de la katana).
const base = { ropa: '#d9730b', mangas: '#c2410c', pantalon: '#7c2d12', botas: '#8a3a0c', acento: '#fbbf24', cinto: '#b91c1c', hojaNeon: '#fde68a' };
const ORO = '#f5a81f', ORO2 = '#ffdc48', NARANJA = '#ea580c', CAPA = '#f0620f', ROJO = '#b91c1c', CREMA = '#fff1c9';

// Sol plano (disco + 8 rayos) mirando a −z del grupo: va en la espalda de la capa. Devuelve [oro, oro claro].
function solPlano(y, z, R, largo) {
  const O = [], O2 = [['cil', null, [0, y, z - 0.012], [R, 0.03, R], [Math.PI / 2, 0, 0]]];
  for (let i = 0; i < 4; i++) O.push(['caja', null, [0, y, z], [(R + largo) * 2, R * 0.42, 0.02], [0, 0, i * Math.PI / 4]]);
  return [O, O2];
}

export default {
  id: 'solar',
  base,
  // CABEZA: casco de oro, llauto rojo y el disco solar con rayos. Coordenadas en unidades de cabeza (escala final H).
  cabeza(r, K, ctx) {
    const lig = ctx.ligero, halo = ctx.clase === 'sacerdote';
    const mO = K.mat(ORO, { e: 0.4 }), mO2 = K.mat(ORO2, { e: 0.55 }), mN = K.mat(NARANJA, { e: 0.6 });
    const g = K.fuera(K.G(r.cabeza));
    /* con halo: disco y rayos más bajos para que el aro flote por encima */
    const R = halo ? 0.13 : 0.2, yc = halo ? 0.58 : 0.66, lL = halo ? 0.24 : 0.26, lC = 0.15;
    const O = [
      ['caja', null, [0, 0.585, 0], [0.6, 0.09, 0.56]],
      ['caja', null, [0, 0.645, 0], [0.46, 0.05, 0.42]],
      ['caja', null, [0, 0.105, -0.268], [0.52, 0.035, 0.03]],
    ];
    const O2 = [['cil', null, [0, yc, 0], [R, 0.06, R], [K.PI / 2, 0, 0]]];
    const P = [
      ['caja', ROJO, [0, 0.523, 0], [0.62, 0.045, 0.58]],
      ['caja', ROJO, [0, 0.31, -0.262], [0.5, 0.39, 0.025]],
    ];
    const N = [['cil', null, [0, yc, 0], [R * 0.55, 0.1, R * 0.55], [K.PI / 2, 0, 0]]];
    for (let i = -3; i <= 3; i++) {
      const n = Math.abs(i), a = i * 0.42;
      /* normal: largos el central y los ±2; con halo: solo los de los lados son largos (pasan por fuera del aro) */
      const largo = halo ? (n === 3 ? lL : n === 2 ? 0.1 : 0.05) : (n % 2 === 0 ? lL : lC);
      {
        const d = R - 0.03 + largo / 2, s = Math.sin(a), c = Math.cos(a);
        O.push(['caja', null, [s * d, yc + c * d, 0], [0.075, largo, 0.05], [0, 0, -a]]);
        if (!lig && largo === lL) O2.push(['caja', null, [s * (R - 0.03 + largo + 0.02), yc + c * (R - 0.03 + largo + 0.02), 0], [0.05, 0.06, 0.055], [0, 0, -a]]);
      }
    }
    O2.push(['caja', null, [0, 0.33, -0.278], [0.14, 0.14, 0.02], [0, 0, K.PI / 4]]);
    if (!lig) {
      for (const x of [-0.2, 0, 0.2]) {
        O2.push(['caja', null, [x, 0.523, 0.292], [0.07, 0.035, 0.02]], ['caja', null, [x, 0.523, -0.292], [0.07, 0.035, 0.02]]);
      }
      for (const s of [-1, 1]) {
        O.push(['cil', null, [s * 0.285, 0.17, 0.0], [0.075, 0.03, 0.075], [0, 0, K.PI / 2]]);
        N.push(['cil', null, [s * 0.295, 0.17, 0.0], [0.035, 0.03, 0.035], [0, 0, K.PI / 2]]);
      }
    }
    K.MF(g, P, null, null, null, ctx.H);
    K.MF(g, O, mO, null, null, ctx.H);
    K.MF(g, O2, mO2, null, null, ctx.H);
    K.MF(g, N, mN, null, null, ctx.H);
    return 'peluca';                                 /* casco cerrado con cubrenuca: no se dibuja el pelo del jugador */
  },
  // CUERPO: pectoral con sol, faja, faldellín, capa con el gran sol, hombreras, brazaletes y grebas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const mO = K.mat(ORO, { e: 0.4 }), mO2 = K.mat(ORO2, { e: 0.55 }), mN = K.mat(NARANJA, { e: 0.6 });
    const zP = 0.2 * P + 0.02;
    // Torso: tela (faja, faldellín, paño delantero).
    const tela = [
      ['caja', ROJO, [0, T * 0.2, 0], [0.5 * W * P, 0.08, 0.42 * P]],
      ['caja', NARANJA, [0, 0.0, 0], [0.47 * W * P, 0.15, 0.4 * P]],
      ['caja', ROJO, [0, -0.1, zP - 0.005], [0.14, 0.2, 0.025]],
    ];
    // Torso: oro (gola, pectoral, bajo del faldellín, hebilla, remate del paño).
    const O = [
      ['caja', null, [0, T * 0.92, 0], [0.42 * W * P, 0.05, 0.36 * P]],
      ['caja', null, [0, T * 0.62, zP - 0.012], [0.3 * W * P, 0.25, 0.04]],
      ['caja', null, [0, -0.08, 0], [0.49 * W * P, 0.03, 0.42 * P]],
      ['caja', null, [0, -0.2, zP - 0.003], [0.15, 0.035, 0.03]],
    ];
    const O2 = [
      ['cil', null, [0, T * 0.62, zP + 0.012], [0.07, 0.03, 0.07], [K.PI / 2, 0, 0]],
      ['caja', null, [0, T * 0.2, 0.21 * P + 0.006], [0.085, 0.085, 0.02]],
    ];
    const N = [['cil', null, [0, T * 0.62, zP + 0.02], [0.038, 0.03, 0.038], [K.PI / 2, 0, 0]]];
    for (let i = 0; i < 4; i++) O2.push(['caja', null, [0, T * 0.62, zP + 0.008], [0.22, 0.028, 0.012], [0, 0, i * K.PI / 4]]);
    if (!lig) {
      for (const s of [-1, 1]) {
        tela.push(['caja', CREMA, [s * 0.13 * W * P, T * 0.2, 0.21 * P - 0.004], [0.05, 0.05, 0.02]]);
        tela.push(['caja', CREMA, [s * 0.1 * W * P, T * 0.2, -(0.21 * P - 0.004)], [0.05, 0.05, 0.02]]);
      }
      tela.push(['caja', CREMA, [0, T * 0.2, -(0.21 * P + 0.002)], [0.05, 0.05, 0.02]]);
      O2.push(['caja', null, [0, -0.1, zP + 0.01], [0.06, 0.06, 0.012], [0, 0, K.PI / 4]]);
    }
    K.MF(r.cuerpo, tela);
    K.MF(r.cuerpo, O, mO);
    K.MF(r.cuerpo, O2, mO2);
    K.MF(r.cuerpo, N, mN);
    // Capa: cuelga de los hombros, se abre hacia abajo. En su grupo, «y» baja desde el cuello y −z es hacia fuera.
    const Wc = W * (0.7 + 0.3 * P);                  /* la capa ensancha un poco con la panza */
    const gc = K.G(r.cuerpo, [0, T * 0.88, -(0.2 * P + 0.05)], [0.13, 0, 0]);
    K.MF(gc, [
      ['caja', null, [0, -0.2, 0], [0.48 * Wc, 0.4, 0.03]],
      ['caja', null, [0, -0.5, 0], [0.56 * Wc, 0.22, 0.03]],
    ], K.mat(CAPA, { e: 0.3 }));
    K.MF(gc, [['caja', ROJO, [0, -0.625, 0], [0.58 * Wc, 0.04, 0.032]]]);
    const [sO, sO2] = solPlano(-0.28, -0.022, 0.105, 0.11);
    sO.push(['caja', null, [0, -0.665, 0], [0.6 * Wc, 0.045, 0.036]], ['caja', null, [0, -0.005, 0], [0.5 * Wc, 0.04, 0.05]]);
    K.MF(gc, sO, mO);
    K.MF(gc, sO2, mO2);
    K.MF(gc, [['cil', null, [0, -0.28, -0.04], [0.055, 0.03, 0.055], [K.PI / 2, 0, 0]]], mN);
    // Brazos: hombrera escalonada y brazalete.
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      K.M(b, 'caja', mO, [s * 0.02, 0.04, 0], [0.23, 0.065, 0.26], [0, 0, s * 0.2]);
      K.M(b, 'caja', mO2, [s * 0.035, 0.082, 0], [0.15, 0.035, 0.18], [0, 0, s * 0.2]);
      K.M(b, 'caja', mO, [0, -A + 0.095, 0], [0.165, 0.11, 0.165]);
      K.M(b, 'caja', mO2, [0, -A + 0.045, 0], [0.18, 0.025, 0.18]);
      if (!lig) K.M(b, 'caja', ROJO, [s * 0.03, -0.01, 0], [0.19, 0.035, 0.22]);
    }
    // Piernas: greba de oro, rodillera con sol y cinta de la sandalia.
    for (const p of [r.pI, r.pD]) {
      K.M(p, 'caja', mO, [0, -L + 0.2, 0.01], [0.185, 0.15, 0.2]);
      K.M(p, 'caja', mO2, [0, -L + 0.125, 0.04], [0.19, 0.025, 0.28]);
      if (!lig) K.M(p, 'caja', mO2, [0, -L + 0.27, 0.105], [0.09, 0.07, 0.03]);
    }
    // Solecito que gira junto al hombro derecho (una malla suelta y un pivote: solo en calidad normal).
    if (!lig) {
      const g = K.piv(r, K.fuera(K.G(r.cuerpo, [-0.44, T + 0.24, 0.05])));
      const sol = [['icos', null, [0, 0, 0], 0.075]];
      for (let i = 0; i < 4; i++) sol.push(['caja', null, [0, 0, 0], [0.3, 0.035, 0.035], [0, i * K.PI / 4, 0]]);
      K.MF(g, sol, K.mat('#facc15', { e: 1 })).userData.sinFlash = true;
      r.giran.push([g, 1.6]);
    }
  },
};
