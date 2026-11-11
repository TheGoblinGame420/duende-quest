// Traje 3D de la skin «esqueleto» (Duende Esqueleto). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_esqueleto.png
// A mayor tamaño: refs/esqueleto.png
// Qué se ve en la imagen: Calavera grande como casco (cuencas negras), traje negro con los huesos pintados en blanco (costillas, brazos, piernas), capa morada rota, cinturón con calavera y bolsa, botas marrones con calaveritas.
//
// Rehecho el 11-nov-2026 mirando la imagen. Orden de importancia: calavera de hueso sobre el cubo,
// capa morada hecha jirones (lo que se ve en el juego, de espaldas), huesos blancos sobre negro,
// cinturón de cuerda con calavera y bolsa, botas marrones altas con calaverita, hebilla y suela crema.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento, cinto.
const base = { ropa: '#2a2030', pantalon: '#2a2030', botas: '#6e4526', acento: '#efe6cf', cinto: '#8a5a2e' };
const HUESO = '#fff4d6', HUESO2 = '#b9a988', NEGRO = '#17121c', TELA = '#2a2030';
const MORADO = '#8a44c8', MORADO2 = '#6a2fa6', CUERO = '#6e4526', CUERO2 = '#4d2f18', ORO = '#e2a93b', CREMA = '#e6d2a4';

export default {
  id: 'esqueleto',
  base,
  // CABEZA: una calavera de bloques puesta como casco. Unidades de cabeza (la escala final es H).
  // El cubo acaba en y = 0.52; el halo del sacerdote está en y = 0.8: la calavera termina en 0.74.
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', HUESO, [0, 0.555, -0.005], [0.62, 0.09, 0.58]],    /* cráneo: sobresale un poco del cubo */
      ['caja', HUESO, [0, 0.645, 0.005], [0.57, 0.09, 0.56]],     /* segundo piso, un poco más estrecho */
      ['caja', HUESO, [0, 0.715, -0.01], [0.42, 0.05, 0.40]],     /* coronilla, en escalón */
      ['caja', HUESO, [0.285, 0.44, 0.17], [0.05, 0.16, 0.2]],    /* sienes: enmarcan la cara por delante de las orejas */
      ['caja', HUESO, [-0.285, 0.44, 0.17], [0.05, 0.16, 0.2]],
      ['caja', HUESO, [0, 0.485, 0.265], [0.62, 0.07, 0.05]],     /* borde sobre la frente */
      ['caja', HUESO, [0, 0.43, -0.265], [0.52, 0.18, 0.05]],     /* nuca */
      ['caja', NEGRO, [0.145, 0.595, 0.285], [0.19, 0.13, 0.03]], /* cuencas */
      ['caja', NEGRO, [-0.145, 0.595, 0.285], [0.19, 0.13, 0.03]],
      ['caja', NEGRO, [0, 0.50, 0.285], [0.06, 0.07, 0.03]],      /* nariz */
      ['caja', HUESO, [0, 0.425, 0.27], [0.07, 0.07, 0.05]],      /* dientes que cuelgan sobre la frente */
      ['caja', HUESO, [0.265, 0.425, 0.27], [0.08, 0.07, 0.05]],
      ['caja', HUESO, [-0.265, 0.425, 0.27], [0.08, 0.07, 0.05]],
    ];
    if (!ctx.ligero) P.push(
      ['caja', HUESO2, [0, 0.742, -0.01], [0.03, 0.012, 0.38]],                 /* sutura de la coronilla */
      ['caja', HUESO2, [0.12, 0.64, -0.292], [0.03, 0.1, 0.02], [0, 0, 0.6]],   /* grieta en zigzag de la nuca */
      ['caja', HUESO2, [0.12, 0.57, -0.297], [0.03, 0.1, 0.02], [0, 0, -0.6]],
      ['caja', HUESO2, [0.12, 0.50, -0.297], [0.03, 0.1, 0.02], [0, 0, 0.6]],
    );
    /* El hueso lleva un poco de brillo propio: sin él la calavera sale gris a la sombra. Lo negro va aparte. */
    /* (Ese brillo cuesta una malla más: en calidad baja no se pone y el traje queda con 0 mallas sueltas.) */
    K.MF(g, P.filter(x => x[1] !== NEGRO), null, ctx.ligero ? null : { e: 0.24 }, null, ctx.H);
    K.MF(g, P.filter(x => x[1] === NEGRO), null, null, null, ctx.H);
    return 'casco';
  },
  // CUERPO: costillas, huesos de brazos y piernas, capa rota, cinturón con calavera y bolsa, botas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, gr = ctx.cpo.grueso || 1, lig = ctx.ligero;
    const zP = 0.2 * P + 0.012;                    /* justo delante del pecho */
    const C = [];
    // Costillas: tres pares en V, cada vez más cortas, y el esternón.
    const cost = [[0.70, 0.125], [0.56, 0.135], [0.42, 0.115]];
    for (const [fy, an] of cost) for (const s of [1, -1]) {
      C.push(['caja', HUESO, [s * (0.02 + an * 0.5) * W * P, T * fy, zP - 0.012], [an * W * P, 0.042, 0.04], [0, s * 0.3, -s * 0.22]]);
    }
    C.push(['caja', HUESO, [0, T * 0.58, zP], [0.04, T * 0.42, 0.035]]);                       /* esternón */
    // Cuello de la capa (jirones morados sobre los hombros y el pecho).
    C.push(['caja', MORADO, [0, T * 0.92, -0.01], [0.50 * W * P, 0.06, 0.42 * P]]);
    for (const x of [-0.16, 0, 0.16]) C.push(['cono4', x ? MORADO : MORADO2, [x * W * P, T * 0.9, zP - 0.02], [0.07, 0.09, 0.03], [Math.PI, 0, 0]]);
    // Calaverita del cordón, bajo el cuello.
    C.push(['caja', HUESO, [0, T * 0.81, zP + 0.02], [0.085, 0.075, 0.04]]);
    // Cinturón: hebilla de calavera grande y bolsa de cuero en la cadera derecha.
    const yC = T * 0.18, zC = 0.19 * P + 0.03;
    C.push(['caja', HUESO, [0, yC + 0.01, zC], [0.14, 0.11, 0.05]], ['caja', HUESO, [0, yC - 0.06, zC], [0.085, 0.04, 0.05]]);
    C.push(['caja', NEGRO, [0.035, yC + 0.015, zC + 0.02], [0.04, 0.045, 0.02]], ['caja', NEGRO, [-0.035, yC + 0.015, zC + 0.02], [0.04, 0.045, 0.02]]);
    C.push(['caja', CUERO, [-0.19 * W * P, yC - 0.03, 0.13 * P + 0.03], [0.12, 0.13, 0.1]], ['caja', CUERO2, [-0.19 * W * P, yC + 0.02, 0.13 * P + 0.04], [0.13, 0.06, 0.1]]);
    // Faldón morado roto que asoma bajo el cinturón.
    C.push(['caja', MORADO, [0, T * 0.07, 0], [0.50 * W * P, 0.05, 0.42 * P]]);
    const picos = [[-0.17, 1], [0.02, 1], [0.19, 1], [-0.1, -1], [0.12, -1]];
    for (const [x, s] of picos) C.push(['cono4', s > 0 ? MORADO : MORADO2, [x * W * P, T * 0.05, s * 0.2 * P], [0.08, 0.12, 0.035], [Math.PI, 0, 0]]);
    if (!lig) {
      C.push(['caja', NEGRO, [0.02, T * 0.815, zP + 0.035], [0.022, 0.025, 0.02]], ['caja', NEGRO, [-0.02, T * 0.815, zP + 0.035], [0.022, 0.025, 0.02]]);
      C.push(['caja', ORO, [-0.19 * W * P, yC - 0.02, 0.13 * P + 0.09], [0.035, 0.035, 0.02]]);                  /* botón de la bolsa */
      C.push(['cono4', MORADO, [0.26 * W * P, T * 0.05, 0], [0.035, 0.11, 0.08], [Math.PI, 0, 0]], ['cono4', MORADO, [-0.26 * W * P, T * 0.05, 0], [0.035, 0.11, 0.08], [Math.PI, 0, 0]]);
    }
    K.MF(r.cuerpo, C);

    // Capa morada hecha jirones: tiras de largo distinto (el bajo queda en dientes de sierra).
    const gc = K.fuera(K.G(r.cuerpo, [0, T * 0.9, -(0.2 * P + 0.04)], [0.14, 0, 0]));
    const tiras = lig
      ? [[-0.19, 0.19, 0.50, MORADO], [0, 0.19, 0.64, MORADO2], [0.19, 0.19, 0.55, MORADO]]
      : [[-0.24, 0.12, 0.46, MORADO2], [-0.12, 0.12, 0.60, MORADO], [0, 0.12, 0.52, MORADO2], [0.12, 0.12, 0.66, MORADO], [0.24, 0.12, 0.50, MORADO2]];
    const Cp = [];
    for (const [x, an, la, c] of tiras) {
      Cp.push(['caja', c, [x * W, -la / 2, 0], [an * W + 0.004, la, 0.03]]);
      if (!lig) Cp.push(['cono4', c, [x * W, -la, 0], [an * W * 0.5, 0.09, 0.02], [Math.PI, 0, 0]]);   /* punta del jirón */
    }
    K.MF(gc, Cp);

    // Brazos: hombro de capa, húmero y antebrazo de hueso (atraviesan la manga: se ven delante y detrás), guante.
    const fa = 0.068 * gr * 2 + 0.02;
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const B = [
        ['caja', MORADO, [s * 0.01, -0.005, -0.01], [0.19, 0.08, 0.2]],                   /* jirón sobre el hombro */
        ['cono4', MORADO2, [s * 0.05, -0.03, 0], [0.05, 0.1, 0.09], [Math.PI, 0, 0]],
        ['caja', HUESO, [0, -A * 0.36, 0], [0.05, A * 0.34, fa]],                         /* húmero */
        ['caja', HUESO, [0, -A * 0.76, 0], [0.045, A * 0.26, fa - 0.02]],                 /* antebrazo */
        ['caja', NEGRO, [0, -A + 0.035, 0], [0.15 * gr, 0.06, 0.15 * gr]],                /* puño del guante */
      ];
      if (!lig) B.push(
        ['caja', HUESO, [0, -A * 0.19, 0], [0.08, 0.035, fa + 0.004]], ['caja', HUESO, [0, -A * 0.53, 0], [0.08, 0.035, fa + 0.004]],
        ['caja', HUESO, [0, -A * 0.63, 0], [0.07, 0.03, fa - 0.016]],
      );
      K.MF(b, B);
    }

    // Piernas: fémur y tibia, bajo roto del pantalón, caña de la bota con calaverita, hebilla y suela crema.
    const fp = 0.085 * gr * 2 + 0.02;
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      const yB = -L + 0.12;                         /* borde de arriba de la bota */
      const Q = [
        ['caja', HUESO, [0, -0.125, 0], [0.055, 0.13, fp]],                               /* fémur */
        ['caja', HUESO, [0, -0.265, 0], [0.05, 0.075, fp - 0.02]],                        /* tibia */
        ['caja', CUERO, [0, yB + 0.02, 0.01], [0.21 * gr, 0.08, 0.24]],                   /* caña ancha de la bota */
        ['caja', CUERO2, [0, yB - 0.035, 0.03], [0.195 * gr, 0.035, 0.275]],              /* correa */
        ['caja', HUESO, [0, yB + 0.02, 0.135], [0.1, 0.075, 0.03]],                       /* calaverita */
        ['caja', CREMA, [0, -L + 0.014, 0.05], [0.2 * gr, 0.03, 0.34]],                   /* suela */
        ['caja', ORO, [s * 0.1 * gr, yB - 0.035, 0.04], [0.03, 0.06, 0.07]],              /* hebilla, por fuera */
      ];
      if (!lig) Q.push(
        ['caja', HUESO, [0, -0.055, 0], [0.085, 0.035, fp + 0.004]], ['caja', HUESO, [0, -0.195, 0], [0.085, 0.035, fp + 0.004]],
        ['caja', MORADO, [0, yB + 0.075, 0], [0.2 * gr, 0.03, 0.2 * gr]],                 /* bajo roto del pantalón */
        ['caja', NEGRO, [0.024, yB + 0.028, 0.15], [0.026, 0.028, 0.012]], ['caja', NEGRO, [-0.024, yB + 0.028, 0.15], [0.026, 0.028, 0.012]],
        ['caja', HUESO, [0, yB - 0.02, 0.135], [0.055, 0.03, 0.03]],                      /* mandíbula */
      );
      K.MF(p, Q);
    }
    return ctx.tocado;
  },
};
