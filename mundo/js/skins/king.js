// Traje 3D de la skin «king» (Rey). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_king.png
// Qué se ve en la imagen: Traje azul marino con ribetes de neón celeste y morado, corbata morada, gran corona dorada
// (más ancha arriba, forro morado, gemas verdes, bolas de oro en las puntas), móvil con el gráfico de velas en la
// mano izquierda, hombreras en punta, puños celestes y zapatos oscuros con suela de neón.
//
// Cómo está hecho (11-nov-2026):
// - cabeza(): corona de bloques GRANDE que se abre hacia arriba: aro rojizo, cuerpo de oro, labio claro, cojín morado
//   (se ve desde la cámara del juego, que mira desde arriba) y 8 puntas en escalera con bola. Gemas verdes en las 4 caras.
//   Con sacerdote la corona es más baja y sin el segundo cojín: el halo flota dentro del aro de puntas sin tocarlo.
// - vestir(): solapas moradas con filo celeste, camisa clara y corbata morada, faldón de la chaqueta con bajo de neón,
//   circuito de neón en la ESPALDA (espina morada, canesú y trazas celestes), hombreras en punta, puños, raya morada
//   en mangas y pantalón, rodilleras y suela celeste. Móvil grande con velas verdes y rojas en la zurda; si la zurda
//   lleva escudo o daga, el móvil va en su funda a la espalda del cinturón (pantalla hacia atrás).
// - Calidad baja (ctx.ligero): corona con puntas de un solo escalón y menos gemas, la mitad del circuito y sin rayas ni rodilleras.
//   Todo el neón es opaco con brillo propio, así que se funde: 0 mallas sueltas y 0 pivotes nuevos en ambos modos.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento (cuello y hebilla).
const base = { ropa: '#262a72', pantalon: '#16153f', botas: '#1b1750', acento: '#3fd9e8', cinto: '#16153f' };
const ORO = '#f5a81f', ORO2 = '#ffdc48', ROJIZO = '#c9401c', FORRO = '#6a2278', FORRO2 = '#8a2f9a';
const GEMA = '#25c98a', GEMA2 = '#0f7a6a';
const CIAN = '#3fd9e8', MORADO = '#a24bff', SOLAPA = '#3d2391', FALDON = '#1e2160', CAMISA = '#e3efff', CORBATA = '#8e3fe6';
const MARCO = '#6b8fb5', MARCO2 = '#3f5f85', PANTALLA = '#1c1040', VERDE = '#3ee07a', ROJO = '#ff4d5e';

// Móvil con el gráfico de velas. La pantalla mira a +x del grupo; z es el ancho y «y» el alto.
function movil(K, g, lig) {
  K.MF(g, [
    ['caja', MARCO, [0, 0.1, 0], [0.032, 0.32, 0.185]],
    ['caja', PANTALLA, [0.014, 0.105, 0], [0.012, 0.265, 0.155]],
    ['caja', MARCO2, [-0.019, 0.2, 0.045], [0.012, 0.05, 0.05]],
  ]);
  const v = [
    ['caja', null, [0.022, 0.075, -0.05], [0.006, 0.09, 0.016]],
    ['caja', null, [0.022, 0.1, 0.0], [0.006, 0.07, 0.016]],
    ['caja', null, [0.022, 0.15, 0.027], [0.006, 0.1, 0.016]],
    ['caja', null, [0.022, 0.19, 0.052], [0.006, 0.07, 0.022]],
    ['caja', null, [0.022, 0.0, -0.036], [0.006, 0.026, 0.06]],
  ];
  if (!lig) v.push(['caja', null, [0.022, 0.215, 0.03], [0.006, 0.022, 0.05]]);
  K.MF(g, v, K.mat(VERDE, { e: 0.95 }));
  K.MF(g, [
    ['caja', null, [0.022, 0.06, -0.025], [0.006, 0.07, 0.016]],
    ['caja', null, [0.022, 0.0, 0.036], [0.006, 0.026, 0.06]],
  ], K.mat(ROJO, { e: 0.95 }));
}

export default {
  id: 'king',
  base,
  // CABEZA: la gran corona. Coordenadas en unidades de cabeza (escala final H).
  cabeza(r, K, ctx) {
    const lig = ctx.ligero, halo = ctx.clase === 'sacerdote';
    const k = halo ? 0.45 : 1;                       /* con halo, puntas más bajas */
    const g = K.fuera(K.G(r.cabeza));
    // El oro va en dos mallas con brillo propio (se funden igual): bajo la luz del juego el dorado plano se ve marrón.
    const O = [['caja', null, [0, 0.61, 0], [0.63, 0.11, 0.59]]];
    const O2 = [['caja', null, [0, 0.675, 0], [0.69, 0.03, 0.65]]];
    const P = [
      ['caja', ROJIZO, [0, 0.535, 0], [0.6, 0.05, 0.56]],
      ['caja', FORRO, [0, 0.705, 0], [0.56, 0.05, 0.52]],
      // Gemas: la grande delante y detrás (la espalda es lo que más se ve), y una a cada lado.
      ['caja', GEMA2, [0, 0.61, 0.297], [0.11, 0.09, 0.02]],
      ['caja', GEMA, [0, 0.61, 0.306], [0.075, 0.06, 0.02]],
      ['caja', GEMA2, [0, 0.61, -0.297], [0.11, 0.09, 0.02]],
      ['caja', GEMA, [0, 0.61, -0.306], [0.075, 0.06, 0.02]],
    ];
    if (!halo) P.push(['caja', FORRO2, [0, 0.745, 0], [0.4, 0.04, 0.36]]);
    if (!lig) {
      for (const s of [-1, 1]) {
        P.push(['caja', GEMA, [s * 0.19, 0.61, 0.3], [0.05, 0.05, 0.02]], ['caja', GEMA, [s * 0.19, 0.61, -0.3], [0.05, 0.05, 0.02]]);
        P.push(['caja', GEMA2, [s * 0.317, 0.61, 0], [0.02, 0.09, 0.11]], ['caja', GEMA, [s * 0.326, 0.61, 0], [0.02, 0.06, 0.075]]);
      }
    }
    // Puntas: [x, z, ancho en x, ancho en z, altura relativa]. La de delante es la más alta.
    const puntas = [
      [0, 0.315, 0.2, 0.06, 1.3], [0, -0.32, 0.2, 0.06, 1.15],
      [0.335, 0, 0.06, 0.2, 1.05], [-0.335, 0, 0.06, 0.2, 1.05],
      [0.3, 0.28, 0.12, 0.12, 0.85], [-0.3, 0.28, 0.12, 0.12, 0.85], [0.3, -0.28, 0.12, 0.12, 0.85], [-0.3, -0.28, 0.12, 0.12, 0.85],
    ];
    for (const [x, z, ax, az, h] of puntas) {
      const h1 = (lig ? 0.17 : 0.1) * h * k, h2 = 0.095 * h * k, y0 = 0.69;   /* en calidad baja, un solo escalón más alto */
      const fx = x * 1.05, fz = z * 1.05;              /* la punta se abre un poco hacia fuera */
      O.push(['caja', null, [x, y0 + h1 / 2, z], [ax, h1, az]]);
      if (!lig) O.push(['caja', null, [fx, y0 + h1 + h2 / 2, fz], [ax * 0.55, h2, az * 0.55]]);
      O2.push(['caja', null, [fx, y0 + h1 + (lig ? 0 : h2) + 0.027, fz], [0.07, 0.055, 0.07]]);
    }
    K.MF(g, P, null, null, null, ctx.H);
    K.MF(g, O, K.mat(ORO, { e: 0.4 }), null, null, ctx.H);
    K.MF(g, O2, K.mat(ORO2, { e: 0.5 }), null, null, ctx.H);
    return 'gorra';
  },
  // CUERPO: traje con neón, y el móvil.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const mC = K.mat(CIAN, { e: 0.85 }), mM = K.mat(MORADO, { e: 0.75 });
    // Superficie del torso (elipsoide) en (x, y): para pegar las piezas a su curva.
    const zT = (x, y) => 0.215 * P * Math.sqrt(Math.max(0.06, 1 - (x / (0.27 * W * P)) ** 2 - ((y - T * 0.5) / (T * 0.58)) ** 2));
    const zP = 0.2 * P + 0.02;
    const sx = 0.085 * W * P;
    K.MF(r.cuerpo, [
      ['caja', CAMISA, [0, T * 0.8, zP - 0.012], [0.13, 0.13, 0.03]],
      ['caja', CORBATA, [0, T * 0.82, zP + 0.004], [0.065, 0.055, 0.03]],
      ['caja', CORBATA, [0, T * 0.6, zP + 0.002], [0.06, 0.2, 0.026]],
      ['cono4', CORBATA, [0, T * 0.385, zP + 0.002], [0.043, 0.06, 0.018], [K.PI, 0, 0]],
      ['caja', SOLAPA, [sx, T * 0.68, zP - 0.004], [0.075, 0.3, 0.03], [0, 0, -0.3]],
      ['caja', SOLAPA, [-sx, T * 0.68, zP - 0.004], [0.075, 0.3, 0.03], [0, 0, 0.3]],
      ['caja', FALDON, [0, 0.01, 0], [0.43 * W * P, 0.13, 0.37 * P]],
    ]);
    // Neón celeste del torso: filo de las solapas, botón, bajo del faldón y circuito de la espalda.
    const C = [
      ['caja', null, [sx + 0.042, T * 0.68, zP], [0.018, 0.3, 0.03], [0, 0, -0.3]],
      ['caja', null, [-sx - 0.042, T * 0.68, zP], [0.018, 0.3, 0.03], [0, 0, 0.3]],
      ['caja', null, [0, -0.05, 0], [0.45 * W * P, 0.022, 0.39 * P]],
      ['caja', null, [0, T * 0.27, zT(0, T * 0.27) + 0.012], [0.035, 0.035, 0.02]],
    ];
    const M2 = [['caja', null, [0, T * 0.5, -(zT(0, T * 0.5) + 0.004)], [0.03, T * 0.62, 0.02]]];
    for (const s of [-1, 1]) {
      const x1 = s * 0.11 * W * P, x2 = s * 0.17 * W * P;
      // Traza en L: baja desde el canesú y dobla hacia fuera, con un nodo al final.
      C.push(['caja', null, [x1, T * 0.6, -(zT(x1, T * 0.6) + 0.004)], [0.022, T * 0.34, 0.02]]);
      C.push(['caja', null, [(x1 + x2) / 2, T * 0.42, -(zT((x1 + x2) / 2, T * 0.42) + 0.002)], [0.08 * W * P, 0.022, 0.03], [0, s * 0.5, 0]]);
      C.push(['caja', null, [x1, T * 0.8, -(zT(x1, T * 0.8) + 0.002)], [0.11 * W * P, 0.022, 0.03], [0, s * 0.45, 0]]);
      if (!lig) {
        C.push(['caja', null, [x2, T * 0.36, -(zT(x2, T * 0.36) + 0.006)], [0.04, 0.04, 0.02], [0, s * 0.7, 0]]);
        M2.push(['caja', null, [s * 0.055 * W * P, T * 0.26, -(zT(s * 0.055, T * 0.26) + 0.004)], [0.075 * W * P, 0.02, 0.02], [0, 0, s * 0.5]]);
        M2.push(['caja', null, [s * 0.2 * W * P, T * 0.62, -(zT(s * 0.2 * W * P, T * 0.62) + 0.002)], [0.02, T * 0.2, 0.03], [0, s * 0.8, 0]]);
        // Bolsillos de neón morado delante.
        M2.push(['caja', null, [s * 0.14 * W * P, T * 0.3, zT(s * 0.14 * W * P, T * 0.3) + 0.004], [0.08, 0.018, 0.03], [0, s * 0.6, 0]]);
      }
    }
    K.MF(r.cuerpo, C, mC);
    K.MF(r.cuerpo, M2, mM);
    // Brazos: hombrera en punta con filo celeste, raya morada y puño celeste.
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      K.M(b, 'caja', SOLAPA, [s * 0.015, 0.045, 0], [0.2, 0.06, 0.23], [0, 0, s * 0.22]);
      K.M(b, 'caja', mC, [s * 0.03, 0.085, 0], [0.2, 0.022, 0.24], [0, 0, s * 0.22]);
      K.M(b, 'caja', mC, [0, -A + 0.07, 0], [0.165, 0.04, 0.165]);
      if (!lig) {
        K.M(b, 'caja', mM, [s * 0.072, -A * 0.45, 0], [0.016, A * 0.42, 0.035]);
        K.M(b, 'caja', CAMISA, [0, -A + 0.04, 0], [0.15, 0.025, 0.15]);
      }
    }
    // Piernas: raya morada, rodillera celeste, empeine morado y suela de neón.
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      K.M(p, 'caja', mC, [0, -L + 0.014, 0.05], [0.19, 0.026, 0.33]);
      K.M(p, 'caja', mM, [0, -L + 0.125, 0.06], [0.178, 0.022, 0.23]);
      if (!lig) {
        K.M(p, 'caja', mM, [s * 0.078, -L * 0.42, 0], [0.016, L * 0.5, 0.04]);
        K.M(p, 'caja', mC, [0, -L * 0.5, 0.085], [0.1, 0.024, 0.03]);
      }
    }
    // Móvil: en la zurda; con escudo o daga en esa mano, en su funda a la espalda del cinturón.
    if (ctx.clase === 'guerrero' || ctx.arma === 'dagas') {
      const g = K.G(r.cuerpo, [0.07 * W, T * 0.1, -(0.185 * P + 0.03)], [0, K.PI / 2, 0.12]);
      g.scale.setScalar(0.85);
      movil(K, g, lig);
    } else {
      const g = K.fuera(K.G(r.manoI, [0.035, 0.02, 0.075], [0, -0.75, 0]));
      g.scale.setScalar(1.3);
      movil(K, g, lig);
    }
  },
};
