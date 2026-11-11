// Traje 3D de la skin «necro» (Nigromante). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_necromancer.png
// Qué se ve en la imagen: Silueta de sombra morada casi transparente, capucha, ojos violeta que brillan, llamas y volutas moradas a los pies y un orbe con calavera.
//
// Rehecho el 11-nov-2026 mirando la imagen:
// - cabeza(): capucha de bloques en arco con el filo lila (el contorno punteado de la imagen), pico caído hacia atrás
//   y paño hasta la nuca; deja libres la cara, las orejas y las espadas de píxeles. Ojos magenta que brillan.
// - vestir(): túnica hasta el suelo en escalones con pliegues lila, bajo rasgado, esclavina, mangas de campana,
//   cruz rúnica en el pecho y calavera a la espalda; llamas moradas en S a los pies
//   (parpadean); orbe-llama con calavera (en la zurda si está libre, si no flota tras el hombro); espectro de un
//   ojo sobre el otro hombro y runas lila que giran. En calidad baja: túnica, capucha, ojos y llamas fijas.

const TUNICA = '#34195e', TUNICA2 = '#27114a', NOCHE = '#190b30', VIOLETA = '#7c3aed', LILA = '#b98cff';
const FUEGO = '#5b21b6';
const MAGENTA = '#e24bff', NUCLEO = '#ffe0ff', HUESO = '#a99dab', HUESO2 = '#6f6474', NEGRO = '#0c0614';

// Colores del cuerpo que arma humano(): todo morado noche; las manos siguen verdes (mascota).
const base = { ropa: TUNICA, pantalon: TUNICA2, botas: NOCHE, acento: LILA, cinto: NOCHE };

/* Una llama en S hecha de bloques. Devuelve [base oscura, cuerpo violeta que brilla, punta lila] en (x, z), tamaño s, torcida hacia dx. */
function llama(x, z, s, dx) {
  return [
    [
      ['caja', FUEGO, [x, 0.07 * s, z], [0.16 * s, 0.14 * s, 0.16 * s]],
    ],
    [
      ['caja', null, [x + 0.07 * s * dx, 0.2 * s, z], [0.12 * s, 0.14 * s, 0.12 * s]],
      ['caja', null, [x + 0.01 * s * dx, 0.33 * s, z], [0.085 * s, 0.14 * s, 0.085 * s]],
    ],
    [
      ['caja', null, [x - 0.07 * s * dx, 0.46 * s, z], [0.05 * s, 0.14 * s, 0.05 * s]],
    ],
  ];
}

/* Calavera de bloques centrada en (0, 0, 0), de tamaño s, con cara delante y detrás. */
function calavera(s) {
  return [
    ['caja', HUESO, [0, 0.02 * s, 0], [0.1 * s, 0.08 * s, 0.09 * s]],
    ['caja', HUESO, [0, -0.035 * s, 0], [0.06 * s, 0.04 * s, 0.07 * s]],
    ['caja', NEGRO, [-0.024 * s, 0.015 * s, 0], [0.026 * s, 0.03 * s, 0.1 * s]],
    ['caja', NEGRO, [0.024 * s, 0.015 * s, 0], [0.026 * s, 0.03 * s, 0.1 * s]],
    ['caja', HUESO2, [0, -0.04 * s, 0], [0.012 * s, 0.03 * s, 0.08 * s]],
  ];
}

export default {
  id: 'necro',
  base,
  // Capucha de bloques. Coordenadas en unidades de cabeza (la escala final de MF es H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', TUNICA2, [0, 0.575, -0.01], [0.66, 0.11, 0.62]],         /* techo de la capucha */
      ['caja', TUNICA, [0, 0.665, -0.03], [0.52, 0.08, 0.54]],          /* segundo piso (arco) */
      ['caja', TUNICA2, [0, 0.72, -0.08], [0.34, 0.035, 0.4]],        /* tercer piso */
      ['caja', TUNICA, [0, 0.68, -0.33], [0.2, 0.1, 0.14]],             /* pico que cae hacia atrás */
      ['caja', TUNICA2, [0, 0.58, -0.42], [0.13, 0.12, 0.1]],
      ['caja', TUNICA2, [0.315, 0.4, 0.2], [0.05, 0.3, 0.2]],           /* caídas del arco a los lados de la cara, por delante de las orejas */
      ['caja', TUNICA2, [-0.315, 0.4, 0.2], [0.05, 0.3, 0.2]],
      ['caja', TUNICA2, [0, 0.3, -0.285], [0.62, 0.5, 0.07]],           /* paño de atrás */
      ['caja', TUNICA, [0, 0.03, -0.3], [0.5, 0.1, 0.1]],               /* caída sobre la nuca */
      ['caja', TUNICA2, [0.295, 0.3, -0.2], [0.05, 0.5, 0.14]],         /* laterales: solo por detrás de las orejas */
      ['caja', TUNICA2, [-0.295, 0.3, -0.2], [0.05, 0.5, 0.14]],
      ['caja', LILA, [0, 0.65, 0.29], [0.4, 0.035, 0.035]],             /* filo lila del arco: dintel y dos escalones a cada lado */
      ['caja', LILA, [0.25, 0.6, 0.305], [0.14, 0.035, 0.035]],
      ['caja', LILA, [-0.25, 0.6, 0.305], [0.14, 0.035, 0.035]],
      ['caja', LILA, [0.33, 0.42, 0.305], [0.035, 0.36, 0.035]],
      ['caja', LILA, [-0.33, 0.42, 0.305], [0.035, 0.36, 0.035]],
    ];
    P.push(['caja', LILA, [0, 0.3, -0.325], [0.04, 0.3, 0.02]]);      /* runa en la nuca */
    P.push(['caja', LILA, [0, 0.36, -0.325], [0.16, 0.04, 0.02]]);
    K.MF(g, P, null, null, null, ctx.H);
    /* ojos que brillan: pupila magenta con el centro casi blanco */
    const O = [], N = [];
    for (const s of [-1, 1]) {
      O.push(['caja', null, [s * 0.12, 0.31, 0.292], [0.085, 0.085, 0.03]]);
      N.push(['caja', null, [s * 0.12, 0.31, 0.3], [0.035, 0.035, 0.03]]);
    }
    K.MF(g, O, K.mat(MAGENTA, { e: 1 }), null, null, ctx.H);
    K.MF(g, N, K.mat(NUCLEO, { e: 1 }), null, null, ctx.H);
    return 'peluca';   /* la capucha lo cubre todo: el pelo del jugador no asoma */
  },
  // Túnica, llamas, orbe con calavera, espectro y runas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, WP = W * P;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.02);
    const C = [
      /* esclavina sobre los hombros */
      ['caja', TUNICA2, [0, T * 0.9, -0.01], [0.5 * WP, 0.09, 0.44 * P]],
      ['caja', LILA, [0, T * 0.845, 0], [0.52 * WP, 0.025, 0.46 * P]],
      /* falda de la túnica en tres escalones, hasta el suelo */
      ['caja', TUNICA, [0, -0.07, 0], [0.5 * WP, 0.2, 0.42 * P]],
      ['caja', TUNICA2, [0, -0.23, 0], [0.57 * WP, 0.16, 0.48 * P]],
      ['caja', TUNICA, [0, -0.36, 0], [0.64 * WP, 0.12, 0.54 * P]],
      /* cruz rúnica en el pecho */
      ['caja', LILA, [0, T * 0.52, zP], [0.035, 0.17, 0.02]],
      ['caja', LILA, [0, T * 0.58, zP], [0.12, 0.035, 0.02]],
      /* calavera a la espalda */
      ['caja', HUESO, [0, T * 0.56, zE], [0.2 * W, 0.14, 0.03]],
      ['caja', HUESO, [0, T * 0.36, zE], [0.12 * W, 0.07, 0.03]],
      ['caja', NEGRO, [0.048 * W, T * 0.55, zE - 0.012], [0.05 * W, 0.055, 0.02]],
      ['caja', NEGRO, [-0.048 * W, T * 0.55, zE - 0.012], [0.05 * W, 0.055, 0.02]],
    ];
    /* bajo rasgado: jirones alternos alrededor del último escalón */
    const nj = ctx.ligero ? 4 : 8;
    for (let i = 0; i < nj; i++) {
      const a = (i + 0.5) / nj * K.PI * 2;
      C.push(['caja', i % 2 ? TUNICA2 : NOCHE, [Math.sin(a) * 0.31 * WP, -0.425, Math.cos(a) * 0.26 * P], [0.11, 0.05, 0.11]]);
    }
    if (!ctx.ligero) {
      /* pliegues lila de la túnica, delante y detrás, siguiendo los escalones */
      for (const s of [-1, 1]) {
        for (const [y, h, z] of [[-0.07, 0.2, 0.21], [-0.23, 0.16, 0.24], [-0.36, 0.12, 0.27]]) {
          C.push(['caja', VIOLETA, [s * 0.1 * WP, y, z * P + 0.005], [0.02, h + 0.01, 0.015]]);
        }
      }
      C.push(['caja', HUESO2, [0, T * 0.34, zE - 0.012], [0.015, 0.05, 0.02]]);          /* dientes de la calavera */
      C.push(['caja', HUESO2, [0.03 * W, T * 0.34, zE - 0.012], [0.015, 0.05, 0.02]]);
      C.push(['caja', HUESO2, [-0.03 * W, T * 0.34, zE - 0.012], [0.015, 0.05, 0.02]]);
    }
    K.MF(r.cuerpo, C);
    /* mangas de campana con el filo lila */
    for (const b of [r.bI, r.bD]) {
      K.MF(b, [
        ['caja', TUNICA2, [0, -A + 0.1, 0], [0.17, 0.16, 0.2]],
        ['caja', LILA, [0, -A + 0.025, 0], [0.18, 0.025, 0.21]],
      ]);
    }

    /* llamas moradas a los pies: [x, z, tamaño, hacia dónde se tuerce] */
    const LL = ctx.ligero
      ? [[0.42, 0.1, 1.3, 1], [-0.42, 0.1, 1.3, -1], [0.3, -0.36, 1.2, -1], [-0.3, -0.36, 1.2, 1]]
      : [[0.44, 0.14, 1.4, 1], [-0.44, 0.14, 1.4, -1], [0.32, -0.34, 1.25, -1], [-0.32, -0.34, 1.25, 1], [0, -0.46, 0.95, 1], [0.5, -0.12, 0.9, -1], [-0.5, -0.12, 0.9, 1]];
    const osc = [], med = [], luz = [];
    for (const [x, z, s, dx] of LL) { const [a, b, c] = llama(x * WP, z, s, dx); osc.push(...a); med.push(...b); luz.push(...c); }
    const gl = ctx.ligero ? K.fuera(K.G(r.raiz)) : K.piv(r, K.fuera(K.G(r.raiz)));
    K.MF(gl, osc);
    K.MF(gl, med, K.mat('#7a2ff0', { e: 0.55 }));
    K.MF(gl, luz, K.mat(LILA, { e: 0.9 }));
    if (ctx.ligero) return;
    r.flamas.push(gl);

    /* orbe-llama con calavera: en la zurda si está libre; si no, flota detrás del hombro izquierdo */
    const libre = ctx.clase !== 'guerrero' && ctx.arma !== 'dagas';
    const go = K.piv(r, K.fuera(libre ? K.G(r.manoI, [0.03, -0.02, 0.17]) : K.G(r.cuerpo, [0.5 * WP + 0.06, T * 0.5, -0.3])));
    K.MF(go, [
      ['caja', NEGRO, [0, 0, 0], [0.15, 0.15, 0.13]],
      ...calavera(1).map(p => [p[0], p[1], [p[2][0], p[2][1], p[2][2]], [p[3][0], p[3][1], p[3][2] + 0.07]]),
      ['caja', VIOLETA, [0, -0.095, 0], [0.19, 0.04, 0.17]],          /* marco de llama alrededor */
      ['caja', VIOLETA, [0.095, 0, 0], [0.04, 0.19, 0.17]],
      ['caja', VIOLETA, [-0.095, 0, 0], [0.04, 0.19, 0.17]],
      ['caja', VIOLETA, [0, 0.095, 0], [0.19, 0.04, 0.17]],
      ['caja', TUNICA, [0.04, 0.15, 0], [0.11, 0.08, 0.1]],           /* lengua de la llama, torcida */
    ]);
    K.MF(go, [
      ['caja', null, [0.07, 0.22, 0], [0.07, 0.08, 0.07]],
      ['caja', null, [0.03, 0.29, 0], [0.04, 0.07, 0.04]],
    ], K.mat(LILA, { e: 0.9 }));
    r.brillo.push(go);

    /* espectro de un ojo sobre el hombro derecho, por detrás */
    const ge = K.piv(r, K.fuera(K.G(r.cuerpo, [-(0.5 * WP + 0.1), T * 0.62, -0.3])));
    K.MF(ge, [
      ['caja', VIOLETA, [0, 0, 0], [0.15, 0.14, 0.14]],
      ['caja', TUNICA, [-0.05, 0.1, 0], [0.05, 0.07, 0.05]],          /* dos mechones de humo encima */
      ['caja', TUNICA, [0.045, 0.12, 0], [0.04, 0.11, 0.04]],
      ['caja', TUNICA, [0.02, -0.1, -0.02], [0.1, 0.07, 0.1]],        /* cola que se afina */
      ['caja', TUNICA2, [0.05, -0.17, -0.04], [0.06, 0.07, 0.06]],
      ['caja', TUNICA2, [0.03, -0.235, -0.05], [0.035, 0.06, 0.035]],
    ]);
    K.MF(ge, [
      ['caja', null, [0, 0.005, 0.07], [0.07, 0.07, 0.02]],
      ['caja', null, [0, 0.005, -0.07], [0.07, 0.07, 0.02]],
    ], K.mat(MAGENTA, { e: 1 }));
    r.flamas.push(ge);

    /* runas lila que giran despacio alrededor, a la altura de las rodillas */
    const gr = K.piv(r, K.fuera(K.G(r.cuerpo, [0, -0.12, 0])));
    const R = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * K.PI * 2 + 0.6, x = Math.sin(a) * 0.62, z = Math.cos(a) * 0.62, y = (i % 2) * 0.16;
      R.push(['caja', null, [x, y, z], [0.02, 0.11, 0.02], [0, a, 0]]);                               /* palo de la runa */
      R.push(['caja', null, [x + Math.cos(a) * 0.025, y + 0.035, z - Math.sin(a) * 0.025], [0.06, 0.02, 0.02], [0, a, i % 2 ? 0.5 : -0.5]]);
      if (i % 2) R.push(['caja', null, [x + Math.cos(a) * 0.02, y - 0.02, z - Math.sin(a) * 0.02], [0.05, 0.02, 0.02], [0, a, -0.6]]);
    }
    K.MF(gr, R, K.mat(LILA, { e: 1 }));
    r.giran.push([gr, 0.5]);
  },
};
