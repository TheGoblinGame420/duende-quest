// Traje 3D de la skin «cosmico» (Duende Cósmico). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_hero.png teñida (hue 150)
// Qué se ve en la imagen: Sin imagen propia: héroe teñido de celeste. Libertad para diseñar: viajero de las estrellas, armadura azul noche con constelaciones y neón celeste y lila.
//
// DISEÑO (11-nov-2026): guerrero de las estrellas.
// - Casco abierto de bloques con dos cuernos claros de punta encendida y cresta de neón (el casco con cuernos de la imagen).
// - Armadura azul noche con filetes celestes: peto con estrella de cuatro puntas, hombreras, brazales, faldar y rodilleras.
// - Capa azul noche con la Cruz del Sur (chakana) encendida a la espalda: es lo que se ve en el juego.
// - Un planeta con anillo y su luna giran sobre el casco (no con el sacerdote: ahí va su halo).
// - La hoja de luz es rosa lila, como la espada de la imagen teñida.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento, cinto y hojaNeon (hoja de luz de la katana).
const base = { ropa: '#14306e', pantalon: '#0d1f4a', botas: '#1f418f', acento: '#38bdf8', cinto: '#38bdf8', hojaNeon: '#f0a6ff' };
const NOCHE = '#0d1b45', PLACA = '#2752b5', PLACA2 = '#3f7be0', CEL = '#38bdf8', HIELO = '#c8f1ff', LILA = '#a78bfa', ROSA = '#f0a6ff', CAPA = '#162a78';

export default {
  id: 'cosmico',
  base,
  // CABEZA: casco abierto con cuernos (deja ver la cara, las orejas y las espadas de píxeles). Unidades de cabeza.
  cabeza(r, K, ctx) {
    const H = ctx.H, lig = ctx.ligero;
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', PLACA2, [0, 0.585, 0], [0.61, 0.13, 0.57]],            /* casquete */
      ['caja', PLACA, [0, 0.68, -0.01], [0.42, 0.06, 0.42]],        /* segundo piso */
      ['caja', PLACA, [0, 0.33, -0.275], [0.57, 0.40, 0.05]],        /* cubrenuca */
      ['caja', NOCHE, [0, 0.33, -0.305], [0.36, 0.24, 0.02]],        /* recuadro oscuro de la nuca (fondo de la estrella) */
      ['caja', PLACA, [0.292, 0.37, 0.14], [0.035, 0.30, 0.20]],     /* carrillera izquierda, por delante de la oreja */
      ['caja', PLACA, [-0.292, 0.37, 0.14], [0.035, 0.30, 0.20]],
    ];
    const C = [];   /* cuernos en escalera, claros */
    for (const s of [1, -1]) {
      C.push(['caja', null, [s * 0.35, 0.62, 0.03], [0.14, 0.12, 0.13]],
        ['caja', null, [s * 0.43, 0.72, 0.03], [0.11, 0.13, 0.11]],
        ['caja', null, [s * 0.445, 0.84, 0.03], [0.09, 0.13, 0.09]]);
    }
    const N = [   /* neón celeste */
      ['caja', null, [0, 0.505, 0], [0.63, 0.035, 0.59]],            /* filete de la frente y la nuca */
      ctx.clase === 'sacerdote' ? ['caja', null, [0, 0.70, -0.02], [0.07, 0.035, 0.58]] : ['caja', null, [0, 0.715, -0.02], [0.07, 0.07, 0.58]],   /* cresta de adelante a atrás (más baja bajo el halo del sacerdote) */
      ['caja', null, [0.41, 0.94, 0.03], [0.065, 0.10, 0.065]],      /* puntas de los cuernos */
      ['caja', null, [-0.41, 0.94, 0.03], [0.065, 0.10, 0.065]],
      ['caja', null, [0, 0.14, -0.28], [0.59, 0.035, 0.05]],         /* borde de abajo del cubrenuca */
    ];
    const R = [   /* estrella rosa lila: frente y nuca */
      ['caja', null, [0, 0.585, 0.29], [0.09, 0.09, 0.02], [0, 0, 0.785]],
      ['caja', null, [0, 0.33, -0.32], [0.11, 0.11, 0.02], [0, 0, 0.785]],
    ];
    if (!lig) {
      N.push(['caja', null, [0.292, 0.215, 0.14], [0.04, 0.03, 0.21]], ['caja', null, [-0.292, 0.215, 0.14], [0.04, 0.03, 0.21]]);   /* filo de las carrilleras */
      R.push(['caja', null, [0, 0.33, -0.318], [0.035, 0.22, 0.015]], ['caja', null, [0, 0.33, -0.318], [0.30, 0.035, 0.015]]);   /* rayos de la estrella de la nuca */
    }
    K.MF(g, P, null, null, null, H);
    K.MF(g, C, HIELO, { e: 0.35 }, null, H);
    K.MF(g, N, CEL, { e: 0.85 }, null, H);
    K.MF(g, R, ROSA, { e: 0.8 }, null, H);
    // Planeta con anillo y luna que giran sobre el casco (solo calidad normal; el sacerdote lleva ahí su halo).
    if (!lig && ctx.clase !== 'sacerdote') {
      const o = K.piv(r, K.fuera(K.G(r.cabeza, [0, 1.0 * H, -0.02 * H], [0.3, 0, 0.2])));
      K.MF(o, [['icos', null, [0, 0, 0], 0.085], ['caja', null, [0.25, 0.03, 0], [0.05, 0.05, 0.05]]], LILA, { e: 0.5 }, null, H);
      K.MF(o, [['toro', null, [0, 0, 0], [0.16, 0.16, 0.16]]], CEL, { e: 0.85 }, null, H);
      r.giran.push([o, 1.1]);
    }
    return 'casco';
  },
  // CUERPO: armadura azul noche con neón, faldar, y capa con la Cruz del Sur.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.05);
    // Torso: peto, gorguera, faldar.
    const B = [
      ['caja', PLACA, [0, T * 0.63, zP], [0.38 * W * P, T * 0.44, 0.05]],                  /* peto */
      ['caja', PLACA2, [0, T * 0.80, zP + 0.012], [0.30 * W * P, T * 0.12, 0.04]],         /* pectoral alto */
      ['caja', PLACA, [0, T * 0.60, zE + 0.03], [0.40 * W * P, T * 0.5, 0.04]],            /* espaldar (bajo la capa) */
      ['caja', PLACA, [0, -0.05, 0.135], [0.20 * W, 0.20, 0.035]],                         /* faldar delantero */
      ['caja', PLACA, [0.2 * W, -0.03, 0], [0.045, 0.20, 0.25]],                           /* escarcelas */
      ['caja', PLACA, [-0.2 * W, -0.03, 0], [0.045, 0.20, 0.25]],
    ];
    const N = [
      ['caja', null, [0, T * 0.955, 0], [0.30, 0.05, 0.27]],                               /* gorguera */
      ['caja', null, [0, T * 0.40, zP + 0.005], [0.39 * W * P, 0.025, 0.05]],              /* filo de abajo del peto */
      ['caja', null, [0, -0.145, 0.137], [0.21 * W, 0.03, 0.04]],                          /* filo del faldar */
      ['caja', null, [0.202 * W, -0.125, 0], [0.05, 0.03, 0.26]],
      ['caja', null, [-0.202 * W, -0.125, 0], [0.05, 0.03, 0.26]],
      ['caja', null, [0, T * 0.63, zP + 0.03], [0.085, 0.085, 0.02], [0, 0, 0.785]],       /* corazón de la estrella del peto */
    ];
    const R = [];
    if (!lig) R.push(['caja', null, [0, T * 0.63, zP + 0.028], [0.03, 0.22, 0.015]], ['caja', null, [0, T * 0.63, zP + 0.028], [0.22 * W * P, 0.03, 0.015]]);   /* rayos de la estrella */
    K.MF(r.cuerpo, B);
    K.MF(r.cuerpo, N, CEL, { e: 0.85 });
    if (R.length) K.MF(r.cuerpo, R, ROSA, { e: 0.8 });

    // Capa con la Cruz del Sur. Cuelga del cuello hasta media pierna, un poco abierta hacia atrás.
    const alto = T * 0.86 + L * 0.62, an = 0.5 * W;
    const c = K.G(r.cuerpo, [0, T * 0.88, zE - 0.01], [0.13, 0, 0]);
    K.MF(c, [
      ['caja', CAPA, [0, -alto * 0.46, 0], [an, alto * 0.92, 0.03]],
      ['caja', CAPA, [0, -alto * 0.96, 0], [an * 0.62, alto * 0.08, 0.03]],                /* pico central del bajo (escalón de píxel) */
      ['caja', NOCHE, [0, -alto * 0.03, -0.004], [an + 0.03, alto * 0.07, 0.035]],         /* cuello de la capa */
      ['caja', NOCHE, [an * 0.5, -alto * 0.5, 0], [0.03, alto * 0.86, 0.036]],             /* orillos */
      ['caja', NOCHE, [-an * 0.5, -alto * 0.5, 0], [0.03, alto * 0.86, 0.036]],
    ]);
    // Estrellas (x positivo = izquierda del personaje; de espaldas se ve a la derecha).
    const e1 = [0.0, -alto * 0.17], e2 = [0.0, -alto * 0.80], e3 = [0.15 * W, -alto * 0.40], e4 = [-0.14 * W, -alto * 0.47];
    const E = [e1, e2, e3, e4].map((e, i) => ['caja', null, [e[0], e[1], -0.022], i < 2 ? [0.075, 0.075, 0.02] : [0.06, 0.06, 0.02], [0, 0, 0.785]]);
    if (!lig) E.push(['caja', null, [-0.07 * W, -alto * 0.62, -0.022], [0.035, 0.035, 0.02]], ['caja', null, [0.17 * W, -alto * 0.72, -0.022], [0.025, 0.025, 0.02]], ['caja', null, [-0.17 * W, -alto * 0.2, -0.022], [0.025, 0.025, 0.02]]);
    K.MF(c, E, HIELO, { e: 0.95 });
    const Lc = [['caja', null, [0, -alto * 0.905, -0.019], [an * 0.9, 0.022, 0.01]]];      /* cenefa del bajo */
    if (!lig) {
      Lc.push(['caja', null, [0, (e1[1] + e2[1]) / 2, -0.019], [0.014, e1[1] - e2[1], 0.008]]);   /* palo largo de la cruz */
      const dx = e3[0] - e4[0], dy = e3[1] - e4[1];
      Lc.push(['caja', null, [(e3[0] + e4[0]) / 2, (e3[1] + e4[1]) / 2, -0.019], [Math.hypot(dx, dy), 0.014, 0.008], [0, 0, Math.atan2(dy, dx)]]);   /* travesaño */
    }
    K.MF(c, Lc, LILA, { e: 0.7 });

    // Brazos: hombreras en dos pisos con punta de neón hacia fuera, y brazales.
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const Q = [
        ['caja', PLACA, [s * 0.05, 0.005, 0], [0.19, 0.10, 0.25]],
        ['caja', PLACA2, [s * 0.07, 0.065, 0], [0.13, 0.04, 0.17]],
        ['caja', PLACA, [0, -A + 0.115, 0], [0.155, 0.13, 0.155]],
      ];
      K.MF(b, Q);
      const QN = [['caja', null, [s * 0.05, -0.055, 0], [0.205, 0.03, 0.265]], ['caja', null, [0, -A + 0.05, 0], [0.165, 0.03, 0.165]]];
      if (!lig) QN.push(['caja', null, [s * 0.165, 0.02, 0], [0.05, 0.05, 0.05]]);
      K.MF(b, QN, CEL, { e: 0.85 });
    }
    // Piernas: rodilleras y vuelta de neón en las botas.
    for (const p of [r.pI, r.pD]) {
      if (!lig) K.M(p, 'caja', PLACA2, [0, -L * 0.52, 0.065], [0.13, 0.10, 0.05]);
      K.M(p, 'caja', K.mat(CEL, { e: 0.85 }), [0, -L + 0.135, 0.035], [0.19, 0.03, 0.275]);
    }
  },
};
