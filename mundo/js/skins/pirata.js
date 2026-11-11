// Traje 3D de la skin «pirata» (Duende Pirata). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_pirata.png
// A mayor tamaño: refs/pirata.png
// Qué se ve en la imagen: Tricornio negro con calavera y tibias y ribete dorado, pañuelo rojo con nudo al lado, parche en el ojo izquierdo, camisa blanca abullonada, chaleco marrón con botones dorados, faja roja, cinturón ancho con hebilla dorada, garfio en la mano izquierda, botas altas con vuelta y hebilla.
//
// Hecho a partir de la imagen (11-nov-2026): tricornio de bloques (ala triangular, tres solapas con ribete dorado,
// calavera con tibias delante), pañuelo rojo con nudo y colas al lado izquierdo, parche con cinta, camisa crema
// abullonada bajo chaleco marrón, bandolera con hebilla, faja roja con colas a la espalda, cinturón con hebillón,
// bolsa y moneda, pantalón a la rodilla, botas altas con vuelta y garfio en la zurda (si la zurda no lleva escudo ni daga).

// Colores del cuerpo que arma humano(): ropa (torso), mangas (camisa), pantalon, botas, acento, cinto.
const base = { ropa: '#4b2c1b', mangas: '#efe4c8', pantalon: '#4a2d1c', botas: '#7a4526', acento: '#e8a91e', cinto: '#cf1f2a' };
const NEGRO = '#241815', NEGRO2 = '#342a2a', ORO = '#f0b223', HUESO = '#f1e3c2', ROJO = '#d81f2a', ROJO2 = '#a51420';
const CREMA = '#efe4c8', CUERO = '#7a4526', CUERO2 = '#5a3220', SUELA = '#d9a45c', ACERO = '#b9bfc8';

export default {
  id: 'pirata',
  base,
  // CABEZA: tricornio + pañuelo + parche. Unidades de cabeza (la escala final de MF es H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const lig = ctx.ligero, a = 1.08;
    const P = [
      // pañuelo rojo: banda que rodea la cabeza por debajo del sombrero, nudo y colas al lado izquierdo (+x)
      ['caja', ROJO, [0, 0.485, 0], [0.575, 0.1, 0.535]],
      ['caja', ROJO, [0.33, 0.47, 0.1], [0.1, 0.11, 0.12]],
      ['caja', ROJO, [0.37, 0.33, 0.13], [0.07, 0.24, 0.09], [0, 0, 0.3]],
      ['caja', ROJO2, [0.44, 0.36, 0.06], [0.06, 0.2, 0.08], [0, 0, 0.75]],
      // ala del tricornio: triángulo con la punta atrás (deja libre el pasillo de las espadas de píxeles)
      ['caja', NEGRO, [0, 0.555, 0.2], [0.92, 0.05, 0.32]],
      ['caja', NEGRO, [0, 0.555, -0.1], [0.62, 0.05, 0.3]],
      ['caja', NEGRO, [0, 0.555, -0.36], [0.28, 0.05, 0.24]],
      // copa
      ['caja', NEGRO, [0, 0.64, -0.03], [0.42, 0.15, 0.4]],
      // solapa delantera levantada, en escalera: pico en el centro y puntas vueltas a los lados
      ['caja', NEGRO, [0, 0.64, 0.36], [0.92, 0.14, 0.06]],
      ['caja', NEGRO, [0, 0.755, 0.36], [0.62, 0.09, 0.06]],
      ['caja', NEGRO, [0, 0.835, 0.36], [0.34, 0.07, 0.06]],
      ['caja', ORO, [0, 0.885, 0.36], [0.36, 0.032, 0.075]],
      ['caja', ORO, [0.245, 0.815, 0.36], [0.15, 0.032, 0.075]],
      ['caja', ORO, [-0.245, 0.815, 0.36], [0.15, 0.032, 0.075]],
      ['caja', ORO, [0.39, 0.725, 0.36], [0.16, 0.032, 0.075]],
      ['caja', ORO, [-0.39, 0.725, 0.36], [0.16, 0.032, 0.075]],
      ['caja', NEGRO, [0.5, 0.69, 0.34], [0.1, 0.2, 0.08], [0, 0, -0.45]],
      ['caja', NEGRO, [-0.5, 0.69, 0.34], [0.1, 0.2, 0.08], [0, 0, 0.45]],
      // solapas traseras: se juntan en la punta de atrás
      ['caja', NEGRO, [0.23, 0.64, -0.07], [0.96, 0.14, 0.06], [0, -a, 0]],
      ['caja', NEGRO, [-0.23, 0.64, -0.07], [0.96, 0.14, 0.06], [0, a, 0]],
      ['caja', ORO, [0.23, 0.722, -0.07], [0.98, 0.032, 0.075], [0, -a, 0]],
      ['caja', ORO, [-0.23, 0.722, -0.07], [0.98, 0.032, 0.075], [0, a, 0]],
      // calavera y tibias en la solapa delantera
      ['caja', HUESO, [0, 0.745, 0.4], [0.17, 0.13, 0.03]],
      ['caja', HUESO, [0, 0.67, 0.4], [0.1, 0.05, 0.03]],
      ['caja', HUESO, [0, 0.7, 0.395], [0.42, 0.04, 0.02], [0, 0, 0.5]],
      ['caja', HUESO, [0, 0.7, 0.395], [0.42, 0.04, 0.02], [0, 0, -0.5]],
      // parche en el ojo izquierdo (+x)
      ['caja', NEGRO, [0.12, 0.31, 0.275], [0.18, 0.17, 0.045]],
    ];
    if (!lig) P.push(
      ['caja', ORO, [0.55, 0.79, 0.34], [0.12, 0.035, 0.09], [0, 0, -0.45]],
      ['caja', ORO, [-0.55, 0.79, 0.34], [0.12, 0.035, 0.09], [0, 0, 0.45]],
      ['caja', NEGRO, [0.04, 0.75, 0.412], [0.04, 0.045, 0.02]],
      ['caja', NEGRO, [-0.04, 0.75, 0.412], [0.04, 0.045, 0.02]],
      ['caja', NEGRO, [0, 0.415, 0.262], [0.3, 0.03, 0.02], [0, 0, -0.75]],
      ['caja', NEGRO, [0.24, 0.24, 0.262], [0.1, 0.03, 0.02], [0, 0, -0.75]],
      ['caja', ROJO2, [0, 0.47, -0.275], [0.2, 0.08, 0.03]],
    );
    K.MF(g, P, null, null, null, ctx.H);
    return 'sombrero';
  },
  // CUERPO: chaleco sobre camisa, bandolera, faja y cinturón, pantalón a la rodilla, botas altas y garfio.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.02), yC = T * 0.19;
    const C = [
      // camisa a la vista entre las solapas del chaleco, y su cuello
      ['caja', CREMA, [0, T * 0.68, zP - 0.005], [0.15 * W * P, T * 0.44, 0.03]],
      ['caja', CREMA, [0, T * 0.95, 0], [0.24, 0.06, 0.22]],
      ['caja', ORO, [0.085 * W * P, T * 0.66, zP], [0.028, T * 0.48, 0.035], [0, 0, -0.12]],
      ['caja', ORO, [-0.085 * W * P, T * 0.66, zP], [0.028, T * 0.48, 0.035], [0, 0, 0.12]],
      // bandolera: del hombro izquierdo a la cadera derecha, por delante y por detrás
      ['caja', CUERO, [0, T * 0.62, zP + 0.02], [0.075, 0.42 * W, 0.025], [0, 0, -0.89]],
      ['caja', CUERO, [0, T * 0.62, zE - 0.01], [0.085, 0.44 * W, 0.03], [0, 0, -0.89]],
      ['caja', ORO, [0, T * 0.62, zP + 0.035], [0.11, 0.11, 0.02], [0, 0, -0.89]],
      // faja roja ancha y cinturón de cuero encima
      ['cil', ROJO, [0, yC, 0], [0.252 * W * P, 0.13, 0.206 * P]],
      ['cil', CUERO2, [0, yC, 0], [0.264 * W * P, 0.06, 0.218 * P]],
      ['caja', ORO, [0, yC, 0.218 * P + 0.005], [0.12, 0.1, 0.03]],
      ['caja', CUERO2, [0, yC, 0.218 * P + 0.012], [0.06, 0.045, 0.03]],
      // nudo de la faja en la cadera derecha y colas que cuelgan por detrás
      ['caja', ROJO, [-0.2 * W * P, yC, -(0.15 * P + 0.03)], [0.11, 0.1, 0.1]],
      ['caja', ROJO, [-0.15 * W, -0.05, -(0.17 * P + 0.05)], [0.12, 0.32, 0.03], [0.25, 0, 0.12]],
      ['caja', ROJO2, [-0.25 * W, -0.02, -(0.15 * P + 0.05)], [0.11, 0.26, 0.03], [0.25, 0, -0.3]],
    ];
    if (!lig) C.push(
      ['caja', CUERO2, [0, T * 0.62, zP + 0.04], [0.055, 0.055, 0.02], [0, 0, -0.89]],
      // bolsa y moneda de oro en la cadera derecha
      ['caja', CUERO, [-0.13 * W, 0.0, 0.14], [0.1, 0.1, 0.06]],
      ['caja', CUERO2, [-0.13 * W, 0.035, 0.145], [0.11, 0.04, 0.065]],
      ['cil', ORO, [-0.02 * W, -0.035, 0.135], [0.042, 0.02, 0.042], [K.PI / 2, 0, 0]],
      // ribete dorado en el bajo del chaleco, por la espalda
      ['caja', ORO, [0, T * 0.34, zE + 0.012], [0.36 * W * P, 0.025, 0.02]],
    );
    K.MF(r.cuerpo, C);

    // mangas abullonadas de la camisa
    for (const b of [r.bI, r.bD]) {
      K.MF(b, [
        ['caja', CREMA, [0, -A * 0.5, 0], [0.165, A * 0.5, 0.165]],
        ['caja', CREMA, [0, -A + 0.07, 0], [0.19, 0.06, 0.19]],
      ]);
    }

    // pantalón a la rodilla (ribete), rodilla verde y bota alta con vuelta, hebilla y suela clara
    for (const p of [r.pI, r.pD]) {
      const B = [
        ['caja', base.pantalon, [0, -0.06, 0], [0.165, 0.12, 0.18]],
        ['caja', ORO, [0, -0.128, 0], [0.17, 0.022, 0.185]],
        ['caja', K.PIEL, [0, -0.175, 0], [0.16, 0.075, 0.175]],
        ['caja', CUERO, [0, -L + 0.15, 0.01], [0.16, 0.1, 0.19]],
        ['caja', CUERO, [0, -L + 0.2, 0.01], [0.195, 0.06, 0.23]],
        ['caja', ORO, [0, -L + 0.238, 0.01], [0.2, 0.02, 0.235]],
        ['caja', SUELA, [0, -L + 0.012, 0.06], [0.185, 0.03, 0.33]],
      ];
      if (!lig) B.push(
        ['caja', ORO, [0, -L + 0.11, 0.11], [0.09, 0.07, 0.02]],
        ['caja', CUERO2, [0, -L + 0.11, 0.115], [0.045, 0.03, 0.02]],
      );
      K.MF(p, B);
    }

    // garfio en la zurda, salvo que esa mano lleve el escudo del guerrero o la segunda daga
    if (ctx.clase !== 'guerrero' && ctx.arma !== 'dagas') {
      const m = K.fuera(K.G(r.manoI));
      K.MF(m, [
        ['caja', CUERO2, [0, 0.0, 0], [0.24, 0.21, 0.24]],
        ['caja', ORO, [0, 0.105, 0], [0.26, 0.035, 0.26]],
        ['caja', ORO, [0, -0.115, 0], [0.18, 0.03, 0.18]],
        ['caja', ACERO, [0, -0.18, 0], [0.055, 0.12, 0.055]],
        ['caja', ACERO, [0.055, -0.245, 0], [0.165, 0.055, 0.055]],
        ['caja', ACERO, [0.125, -0.19, 0], [0.055, 0.1, 0.055]],
      ]);
    }
  },
};
