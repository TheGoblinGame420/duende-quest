// Traje 3D de la skin «sombra» (Duende Sombrío). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_hero.png teñida (hue 200)
// Qué se ve en la imagen: Sin imagen propia: héroe teñido de violeta apagado. Libertad para diseñar: asesino de sombras con capa, ojos lila y humo a los pies.
//
// Rehecho el 11-nov-2026 (sin imagen propia: sale del héroe con casco de cuernos teñido de violeta y de la propuesta de arriba):
// - cabeza(): casco abierto de bloques, violeta noche, con cresta lila de delante a atrás, dos cuernos cortos con la punta
//   lila (el guiño al casco del héroe), luna menguante en la frente y cubrenuca; cara, orejas y espadas de píxeles libres.
//   Ojos lila que brillan.
// - vestir(): peto oscuro con filo lila, hombreras de placas (la izquierda con púa), bufanda violeta con dos colas que se
//   menean a la espalda, capa rasgada en jirones con una luna menguante lila que brilla (la marca que se ve desde atrás),
//   brazales, vuelta de las botas y humo de sombra a los pies que gira. En calidad baja: todo fijo y sin transparencias.

const NOCHE = '#1b1336', TRAJE = '#3d2f78', PLACA = '#7d74b4', PLACA2 = '#544a8c', CAPA = '#5b3fc4', CAPA2 = '#3b2788';
const VIOLETA = '#7c4fe0', LILA = '#a78bfa', LUZ = '#c4b5fd', NUCLEO = '#f3eeff', HUMO = '#7c3aed';

// Colores del cuerpo que arma humano(): violeta apagado y noche; las manos siguen verdes (mascota).
const base = { ropa: TRAJE, pantalon: '#221944', botas: NOCHE, acento: LILA, cinto: NOCHE, mangas: '#221944' };

/* Luna menguante de bloques en un plano z, centrada en (x, y), de tamaño s (abre hacia +x). */
function luna(x, y, z, s) {
  return [
    ['caja', null, [x - 0.05 * s, y, z], [0.045 * s, 0.11 * s, 0.02]],
    ['caja', null, [x - 0.015 * s, y + 0.065 * s, z], [0.05 * s, 0.04 * s, 0.02]],
    ['caja', null, [x - 0.015 * s, y - 0.065 * s, z], [0.05 * s, 0.04 * s, 0.02]],
    ['caja', null, [x + 0.035 * s, y + 0.095 * s, z], [0.045 * s, 0.035 * s, 0.02]],
    ['caja', null, [x + 0.035 * s, y - 0.095 * s, z], [0.045 * s, 0.035 * s, 0.02]],
  ];
}

export default {
  id: 'sombra',
  base,
  // Casco abierto con cresta y cuernos cortos. Coordenadas en unidades de cabeza (la escala final de MF es H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', PLACA, [0, 0.57, -0.01], [0.6, 0.11, 0.57]],            /* casquete */
      ['caja', PLACA2, [0, 0.655, -0.02], [0.44, 0.07, 0.44]],         /* segundo piso */
      ['caja', NOCHE, [0, 0.505, 0.262], [0.58, 0.045, 0.035]],        /* visera sobre las cejas */
      ['caja', VIOLETA, [0, 0.7, -0.03], [0.07, 0.1, 0.5]],            /* cresta de delante a atrás */
      ['caja', VIOLETA, [0, 0.62, -0.31], [0.07, 0.16, 0.07]],         /* la cresta baja por la nuca */
      ['caja', PLACA2, [0, 0.42, -0.28], [0.6, 0.2, 0.06]],            /* cubrenuca en tres l�minas que se abren hacia abajo */
      ['caja', PLACA, [0, 0.26, -0.29], [0.62, 0.14, 0.06]],
      ['caja', PLACA2, [0, 0.12, -0.3], [0.64, 0.14, 0.06]],
      ['caja', VIOLETA, [0, 0.3, -0.325], [0.07, 0.5, 0.03]],          /* la cresta sigue por el cubrenuca */
      ['caja', PLACA2, [0.295, 0.3, -0.2], [0.05, 0.46, 0.14]],         /* laterales: solo por detrás de las orejas */
      ['caja', PLACA2, [-0.295, 0.3, -0.2], [0.05, 0.46, 0.14]],
    ];
    for (const s of [-1, 1]) {
      P.push(['caja', NOCHE, [s * 0.28, 0.65, 0.17], [0.1, 0.09, 0.1]]);            /* cuernos cortos, abiertos hacia fuera (bajo el halo del sacerdote) */
      P.push(['caja', NOCHE, [s * 0.345, 0.7, 0.17], [0.08, 0.07, 0.08]]);
    }
    if (!ctx.ligero) {
      P.push(['caja', LILA, [0, 0.045, -0.335], [0.64, 0.03, 0.02]]);  /* filo del cubrenuca */
      P.push(['caja', PLACA, [0, 0.46, 0.262], [0.1, 0.05, 0.035]]);   /* pico de la visera */
    }
    K.MF(g, P, null, null, null, ctx.H);
    /* lo que brilla: puntas de los cuernos, luna de la frente y ojos lila con el centro casi blanco */
    const B = [], N = [];
    for (const s of [-1, 1]) {
      B.push(['caja', null, [s * 0.395, 0.745, 0.17], [0.055, 0.06, 0.055]]);
      B.push(['caja', null, [s * 0.12, 0.31, 0.292], [0.085, 0.085, 0.03]]);
      N.push(['caja', null, [s * 0.12, 0.31, 0.3], [0.035, 0.035, 0.03]]);
    }
    B.push(...luna(0, 0.585, 0.29, 0.62));
    K.MF(g, B, K.mat(LILA, { e: 0.9 }), null, null, ctx.H);
    K.MF(g, N, K.mat(NUCLEO, { e: 1 }), null, null, ctx.H);
    return 'peluca';   /* el casco y el cubrenuca lo cubren todo: el pelo del jugador no asoma */
  },
  // Peto, hombreras, bufanda, capa rasgada con la luna, brazales y humo a los pies.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, WP = W * P;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.05);
    const C = [
      /* peto y su filo */
      ['caja', PLACA, [0, T * 0.6, zP - 0.01], [0.3 * WP, T * 0.34, 0.04]],
      ['caja', LILA, [0, T * 0.41, zP], [0.3 * WP, 0.025, 0.03]],
      /* cinturón ancho con hebilla lila */
      ['caja', NOCHE, [0, T * 0.19, 0], [0.47 * WP, 0.08, 0.39 * P]],
      ['caja', LILA, [0, T * 0.19, 0.195 * P + 0.01], [0.08, 0.07, 0.02]],
      /* faldones de la cadera */
      ['caja', TRAJE, [0.16 * W, -0.02, 0.02], [0.16 * W, 0.2, 0.26 * P]],
      ['caja', TRAJE, [-0.16 * W, -0.02, 0.02], [0.16 * W, 0.2, 0.26 * P]],
      /* bufanda: vuelta gruesa al cuello y nudo a la izquierda */
      ['caja', VIOLETA, [0, T * 0.93, 0.01], [0.42 * WP, 0.1, 0.4 * P]],
      ['caja', VIOLETA, [0.14 * WP, T * 0.86, zP], [0.1, 0.1, 0.05]],
      /* capa: paño alto y jirones de largos distintos */
      ['caja', CAPA, [0, T * 0.5, zE], [0.56 * WP, T * 0.76, 0.04]],
    ];
    const J = [[-0.25, 0.34, CAPA2], [-0.125, 0.5, CAPA], [0, 0.4, CAPA2], [0.125, 0.54, CAPA], [0.25, 0.32, CAPA2]];
    for (const [x, largo, c] of J) C.push(['caja', c, [x * WP, T * 0.14 - largo / 2, zE - 0.012], [0.125 * WP, largo, 0.035]]);
    if (!ctx.ligero) {
      C.push(['caja', LILA, [0, T * 0.87, zE - 0.005], [0.54 * WP, 0.025, 0.045]]);        /* filo alto de la capa */
      C.push(['caja', LILA, [0.06 * WP, T * 0.64, zP + 0.012], [0.03, 0.09, 0.02]]);       /* remache en rombo del peto */
      C.push(['caja', LILA, [0.06 * WP, T * 0.64, zP + 0.012], [0.09, 0.03, 0.02]]);
    }
    K.MF(r.cuerpo, C);
    /* luna menguante que brilla en la capa: la marca de la skin vista desde atrás */
    K.MF(r.cuerpo, luna(-0.04 * WP, T * 0.5, zE - 0.03, 1.5).map(p => [p[0], p[1], [-p[2][0], p[2][1], p[2][2]], p[3]]), K.mat(LUZ, { e: 0.9 }));

    /* colas de la bufanda a la espalda, por el lado izquierdo; se menean en calidad normal */
    const gc = K.G(r.cuerpo, [0.17 * WP, T * 0.9, zE - 0.05]);
    if (!ctx.ligero) { K.piv(r, gc); r.cola = gc; r.colaAmp = 0.22; }
    K.MF(gc, [
      ['caja', VIOLETA, [0, -0.05, -0.02], [0.09, 0.14, 0.04], [0.25, 0, 0.1]],
      ['caja', VIOLETA, [0.02, -0.17, -0.06], [0.085, 0.14, 0.035], [0.4, 0, 0.15]],
      ['caja', LILA, [0.045, -0.275, -0.11], [0.08, 0.1, 0.035], [0.5, 0, 0.2]],
      ['caja', VIOLETA, [0.11, -0.04, -0.05], [0.08, 0.12, 0.035], [0.45, 0, 0.45]],
      ['caja', LILA, [0.17, -0.12, -0.1], [0.075, 0.1, 0.035], [0.6, 0, 0.55]],
    ]);

    /* hombreras de placas; la izquierda lleva púa. Brazales con filo lila */
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const H = [
        ['caja', PLACA, [s * 0.02, 0.02, 0], [0.2, 0.09, 0.24]],
        ['caja', NOCHE, [s * 0.05, -0.05, 0], [0.16, 0.06, 0.2]],
        ['caja', LILA, [s * 0.02, -0.022, 0], [0.21, 0.02, 0.25]],
        ['caja', NOCHE, [0, -A + 0.1, 0], [0.15, 0.13, 0.16]],
        ['caja', LILA, [0, -A + 0.045, 0], [0.16, 0.025, 0.17]],
      ];
      if (s > 0) H.push(['caja', VIOLETA, [0.1, 0.075, 0], [0.07, 0.07, 0.08]], ['caja', LILA, [0.14, 0.13, 0], [0.04, 0.06, 0.045]]);
      K.fuera(K.MF(b, H));
    }
    /* vuelta de las botas y rodilleras */
    for (const p of [r.pI, r.pD]) {
      K.MF(p, [
        ['caja', PLACA, [0, -L + 0.18, 0.03], [0.2, 0.06, 0.25]],
        ['caja', LILA, [0, -L + 0.145, 0.03], [0.205, 0.02, 0.255]],
      ]);
    }

    /* humo de sombra a los pies: bloques bajos alrededor */
    const S = [], S2 = [];
    const n = ctx.ligero ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.3) / n * K.PI * 2, rad = (i % 2 ? 0.4 : 0.3) * WP, t = i % 2 ? 0.13 : 0.19;
      S.push(['caja', null, [Math.sin(a) * rad, 0.05 + (i % 3) * 0.035, Math.cos(a) * rad], [t, 0.1 + (i % 2) * 0.05, t], [0, a, 0]]);
      if (i % 2 === 0) S2.push(['caja', null, [Math.sin(a) * rad * 1.05, 0.22 + (i % 3) * 0.04, Math.cos(a) * rad * 1.05], [0.07, 0.08, 0.07], [0, a, 0]]);
    }
    if (ctx.ligero) {
      /* calidad baja: humo opaco y fijo, fundido en una malla */
      K.fuera(K.MF(r.raiz, S.map(p => [p[0], p[1], p[2], [p[3][0] * 0.8, p[3][1] * 0.6, p[3][2] * 0.8], p[4]]), CAPA2));
      return;
    }
    const gh = K.piv(r, K.fuera(K.G(r.raiz)));
    K.MF(gh, S, K.mat(HUMO, { e: 0.35, op: 0.42 })).userData.sinFlash = true;
    K.MF(gh, S2, K.mat(LILA, { e: 0.7, op: 0.45 })).userData.sinFlash = true;
    r.giran.push([gh, 0.5]);
  },
};
