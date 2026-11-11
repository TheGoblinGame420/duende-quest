// Traje 3D de la skin «bruja» (Duende Bruja). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_bruja.png
// A mayor tamaño: refs/bruja.png
// Qué se ve en la imagen: Sombrero de bruja morado torcido con cinta naranja y una calabaza, poncho morado de puntas con calabazas naranjas, short marrón con parches y bolsa con calavera, vendas naranjas en las piernas, botas marrones.
//
// Rehecho el 11-nov-2026 mirando la imagen:
// - cabeza(): sombrero de bloques (ala ancha con filo naranja, copa en escalera torcida hacia su derecha y atrás,
//   cinta naranja, calabaza con hojas al frente). Las espadas de píxeles y las orejas quedan libres.
// - vestir(): poncho morado en escalones con filo naranja en zigzag (pico delante y detrás), forro naranja rasgado
//   a la espalda con una calabaza grande, hombros del poncho colgados de los brazos (se mueven con ellos),
//   brazos y piernas al aire (piel verde), short marrón con parche, bolsa con calavera, medias a rayas y botas.

const PIEL = '#8fd14f';
const MORADO = '#5b3487', MORADO2 = '#432466', NARANJA = '#f07a1a', NARANJA2 = '#d2540e';
const CUERO = '#5e3a22', CUERO2 = '#3f2615', ORO = '#e0a82e', HOJA = '#4caf3a', HUESO = '#f1ead8', SUELA = '#d9b47a', NEGRO = '#1d1322';

// Colores del cuerpo que arma humano(): torso tapado por el poncho; brazos y piernas del color de la piel (van al aire).
const base = { ropa: MORADO2, pantalon: PIEL, botas: CUERO, acento: NARANJA, cinto: CUERO2, mangas: PIEL };

export default {
  id: 'bruja',
  base,
  // Sombrero de bruja de bloques. Coordenadas en unidades de cabeza (la escala final de MF es H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const cura = ctx.clase === 'sacerdote';   /* con halo: copa más fina y recta para que el aro la rodee sin tocarla */
    const P = [
      ['caja', NARANJA2, [0, 0.532, 0], [1.0, 0.022, 0.94]],            /* filo naranja del ala (se ve por debajo y en el canto) */
      ['caja', MORADO, [0, 0.553, 0], [0.96, 0.036, 0.9]],              /* ala ancha */
      ['caja', MORADO2, [0, 0.578, 0], [0.62, 0.03, 0.6]],              /* escalón del ala hacia la copa */
      ['caja', NARANJA, [0, 0.625, 0], [0.5, 0.075, 0.48]],             /* cinta naranja */
      ['caja', MORADO, [0, 0.7, 0], [0.46, 0.09, 0.44]],                /* copa, piso 1 */
    ];
    if (cura) {
      P.push(['caja', MORADO, [0, 0.8, -0.05], [0.24, 0.14, 0.24]]);
      P.push(['caja', MORADO2, [-0.02, 0.92, -0.06], [0.2, 0.12, 0.2]]);
      P.push(['caja', MORADO, [-0.07, 1.02, -0.08], [0.15, 0.1, 0.15]]);
      P.push(['caja', MORADO2, [-0.14, 1.09, -0.1], [0.11, 0.08, 0.11]]);
    } else {
      P.push(['caja', MORADO2, [-0.03, 0.8, -0.02], [0.36, 0.13, 0.35]]);     /* piso 2: empieza a torcerse */
      P.push(['caja', MORADO, [-0.08, 0.91, -0.05], [0.27, 0.12, 0.26]]);
      P.push(['caja', MORADO2, [-0.15, 1.01, -0.08], [0.19, 0.1, 0.18]]);
      P.push(['caja', MORADO, [-0.24, 1.08, -0.1], [0.14, 0.08, 0.13]]);
    }
    /* punta rizada: sale hacia su derecha y cae */
    const px = cura ? -0.22 : -0.34, py = cura ? 1.13 : 1.12;
    P.push(['caja', MORADO2, [px, py, -0.1], [0.11, 0.06, 0.09]]);
    P.push(['caja', MORADO, [px - 0.06, py - 0.05, -0.1], [0.06, 0.08, 0.07]]);
    /* calabaza del sombrero, al frente sobre la cinta, con hojas */
    P.push(['caja', NARANJA, [0.08, 0.65, 0.25], [0.2, 0.15, 0.1]]);
    P.push(['caja', NARANJA2, [0.08, 0.65, 0.262], [0.07, 0.16, 0.09]]);          /* gajo central */
    P.push(['caja', HOJA, [-0.06, 0.68, 0.255], [0.1, 0.07, 0.05], [0, 0, 0.5]]);
    P.push(['caja', HOJA, [0.22, 0.68, 0.255], [0.1, 0.07, 0.05], [0, 0, -0.5]]);
    if (!ctx.ligero) {
      P.push(['caja', CUERO, [0.08, 0.745, 0.25], [0.035, 0.05, 0.035]]);         /* rabito */
      P.push(['caja', NEGRO, [0.035, 0.675, 0.305], [0.035, 0.035, 0.012]]);      /* ojos y boca de la calabaza */
      P.push(['caja', NEGRO, [0.125, 0.675, 0.305], [0.035, 0.035, 0.012]]);
      P.push(['caja', NEGRO, [0.08, 0.615, 0.305], [0.11, 0.025, 0.012]]);
      /* jirones del ala */
      P.push(['caja', MORADO2, [0.43, 0.53, 0.3], [0.09, 0.03, 0.1]]);
      P.push(['caja', MORADO2, [-0.4, 0.53, -0.38], [0.12, 0.03, 0.09]]);
    }
    K.MF(g, P, null, null, null, ctx.H);
    return 'sombrero';
  },
  // Poncho de puntas, short, bolsa, medias y botas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, WP = W * P;
    const C = [];
    /* un escalón del poncho: bloque morado y, justo debajo, su filo naranja (asoma donde el siguiente es más estrecho) */
    const piso = (y, h, w, d, c) => {
      C.push(['caja', c, [0, y, 0], [w, h, d]]);
      C.push(['caja', NARANJA, [0, y - h / 2 - 0.016, 0], [w, 0.04, d - 0.012]]);
    };
    C.push(['caja', MORADO2, [0, T * 0.95, 0], [0.34, 0.06, 0.32]]);               /* cuello */
    piso(T * 0.78, 0.15, 0.6 * WP, 0.5 * P, MORADO);
    piso(T * 0.52, 0.13, 0.5 * WP, 0.5 * P, MORADO);
    piso(T * 0.28, 0.11, 0.34 * WP, 0.5 * P, MORADO2);
    piso(T * 0.08, 0.09, 0.18 * WP, 0.5 * P, MORADO);
    const zF = 0.25 * P + 0.012, zB = -(0.25 * P + 0.012), zL = -(0.25 * P - 0.022);
    /* forro naranja rasgado a la espalda (lo que más se ve en el juego) */
    C.push(['caja', NARANJA2, [0, T * 0.25, zL], [0.58 * WP, 0.3, 0.03]]);
    C.push(['caja', NARANJA2, [0.22 * WP, T * 0.25 - 0.18, zL], [0.11, 0.07, 0.03]]);
    C.push(['caja', NARANJA2, [-0.21 * WP, T * 0.25 - 0.17, zL], [0.1, 0.05, 0.03]]);
    C.push(['caja', NARANJA2, [0.33 * WP, T * 0.4, zL + 0.02], [0.07, 0.2, 0.05]]);
    C.push(['caja', NARANJA2, [-0.33 * WP, T * 0.4, zL + 0.02], [0.07, 0.2, 0.05]]);
    /* calabaza grande en la espalda */
    C.push(['caja', NARANJA, [0, T * 0.66, zB], [0.22, 0.17, 0.03]]);
    C.push(['caja', NEGRO, [0.05, T * 0.66 + 0.03, zB - 0.016], [0.04, 0.04, 0.012]]);
    C.push(['caja', NEGRO, [-0.05, T * 0.66 + 0.03, zB - 0.016], [0.04, 0.04, 0.012]]);
    C.push(['caja', NEGRO, [0, T * 0.66 - 0.04, zB - 0.016], [0.13, 0.03, 0.012]]);
    C.push(['caja', HOJA, [0, T * 0.66 + 0.1, zB], [0.05, 0.04, 0.03]]);
    /* calabazas del frente */
    C.push(['caja', NARANJA, [0.2 * WP, T * 0.76, zF], [0.11, 0.1, 0.02]]);
    C.push(['caja', NARANJA, [-0.2 * WP, T * 0.76, zF], [0.11, 0.1, 0.02]]);
    C.push(['caja', NARANJA, [0, T * 0.26, zF], [0.09, 0.08, 0.02]]);
    /* lazo de cuerda con calabaza en el cuello */
    C.push(['caja', NARANJA, [0, T * 0.86, zF + 0.01], [0.085, 0.075, 0.05]]);
    C.push(['caja', CUERO, [0.075, T * 0.87, zF], [0.07, 0.045, 0.03]]);
    C.push(['caja', CUERO, [-0.075, T * 0.87, zF], [0.07, 0.045, 0.03]]);
    C.push(['caja', CUERO, [0.025, T * 0.68, zF + 0.005], [0.028, 0.13, 0.025]]);
    C.push(['caja', CUERO, [-0.025, T * 0.66, zF + 0.005], [0.028, 0.16, 0.025]]);
    /* short marrón: tapa la cadera (que es del color de la piel) */
    C.push(['caja', CUERO, [0, 0.015, 0], [0.37 * W, 0.17, 0.25]]);
    /* bolsa con calavera en su cadera derecha */
    const bx = -(0.17 * W + 0.03);
    C.push(['caja', CUERO2, [bx, -0.03, 0.15], [0.14, 0.14, 0.07]]);
    C.push(['caja', CUERO, [bx, 0.03, 0.155], [0.15, 0.05, 0.075]]);
    C.push(['caja', HUESO, [bx, -0.035, 0.19], [0.075, 0.06, 0.02]]);
    C.push(['caja', HUESO, [bx, -0.075, 0.19], [0.045, 0.03, 0.02]]);
    if (!ctx.ligero) {
      C.push(['caja', HOJA, [0.2 * WP, T * 0.76 + 0.06, zF], [0.035, 0.03, 0.02]]);     /* rabitos de las calabazas del pecho */
      C.push(['caja', HOJA, [-0.2 * WP, T * 0.76 + 0.06, zF], [0.035, 0.03, 0.02]]);
      C.push(['caja', NEGRO, [bx + 0.018, -0.035, 0.202], [0.018, 0.02, 0.008]]);
      C.push(['caja', NEGRO, [bx - 0.018, -0.035, 0.202], [0.018, 0.02, 0.008]]);
    }
    K.MF(r.cuerpo, C);
    /* hombros del poncho: cuelgan de cada brazo y se mueven con él */
    for (const b of [r.bI, r.bD]) {
      K.MF(b, [
        ['caja', MORADO, [0, -0.002, 0], [0.22, 0.19, 0.32]],              /* tapa también la bola del hombro (que es de piel) */
        ['caja', NARANJA, [0, -0.107, 0], [0.2, 0.028, 0.32]],
        ['caja', MORADO2, [0, -0.15, 0], [0.18, 0.08, 0.18]],
        ['caja', NARANJA, [0, -0.2, 0], [0.18, 0.026, 0.18]],
      ]);
    }
    /* piernas: pernera del short con parche, medias a rayas y botas con vuelta, hebilla y suela clara */
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      const Q = [
        ['caja', CUERO, [0, -0.065, 0], [0.2, 0.13, 0.22]],
        ['caja', CUERO2, [0.03 * s, -0.14, 0], [0.12, 0.03, 0.2]],                 /* bajo rasgado */
        ['caja', NEGRO, [0, -L + 0.192, 0], [0.185, 0.025, 0.185]],
        ['caja', NARANJA, [0, -L + 0.165, 0], [0.19, 0.035, 0.19]],
        ['caja', CUERO2, [0, -L + 0.125, 0.01], [0.21, 0.045, 0.24]],              /* vuelta de la bota */
        ['caja', SUELA, [0, -L + 0.012, 0.055], [0.19, 0.026, 0.32]],
        ['caja', ORO, [0.1 * s, -L + 0.1, 0.02], [0.025, 0.07, 0.08]],             /* hebilla, por fuera */
      ];
      if (s > 0) Q.push(['caja', NARANJA, [0.03, -0.07, 0.112], [0.09, 0.07, 0.012]]);   /* parche naranja del short */
      if (!ctx.ligero) Q.push(['caja', NARANJA, [0, -L + 0.075, 0.172], [0.07, 0.06, 0.02]]);   /* calabacita de la bota */
      K.MF(p, Q);
    }
  },
};
