// Traje 3D de la skin «vampiro» (Duende Vampiro). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_vampiro.png
// A mayor tamaño: refs/vampiro.png
// Qué se ve en la imagen: Pelo negro engominado con pico de viuda, capa negra de cuello alto con forro rojo y borde en picos, chaleco rojo oscuro con botones dorados, chorrera blanca con gema roja, cadena dorada, puños blancos, botas negras con hebilla dorada, uñas negras.
//
// Rehecho mirando la imagen (11-nov-2026):
//  - cabeza(): tupé negro engominado de bloques (tres pisos, echado hacia atrás), pico de viuda, patillas y brillos.
//  - vestir(): cuello alto negro con forro rojo y puntas, capa en abanico de 5 paños con forro rojo que asoma
//    por los lados y entre los picos del borde, levita negra con ribete dorado, chaleco granate con botones y
//    cadena de oro, chorrera blanca con gema roja, puños blancos, uñas negras, botas con vuelta roja y hebilla.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento (cuello y hebilla).
const base = { ropa: '#262030', pantalon: '#221c2b', botas: '#17121c', acento: '#e3b23c', cinto: '#17121c' };
const NEGRO = '#262030', PELO = '#17131f', BRILLO = '#5d5680', ROJO = '#d3142c', FORRO = '#b40f24';
const PLIEGUE = '#1a1522';
const GRANATE = '#8a1320', GRANATE2 = '#6a0d18', ORO = '#e8b93e', BLANCO = '#f4efe6', HUESO = '#d9d2c4', GEMA = '#ff2b3f';

export default {
  id: 'vampiro',
  base,
  // CABEZA: tupé engominado (unidades de cabeza; la escala final de MF es H). Deja libres orejas, cara y espadas.
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', PELO, [0, 0.565, -0.01], [0.585, 0.11, 0.565]],       // casquete: tapa el techo del cubo
      ['caja', PELO, [0, 0.655, -0.03], [0.47, 0.1, 0.5]],            // segundo piso del tupé
      ['caja', PELO, [0, 0.36, -0.268], [0.565, 0.38, 0.045]],        // pelo liso que baja por la nuca
      ['caja', PELO, [0, 0.475, 0.262], [0.2, 0.09, 0.03]],           // pico de viuda (parte ancha)
      ['caja', PELO, [0, 0.425, 0.262], [0.09, 0.05, 0.03]],          // pico de viuda (punta)
      ['caja', PELO, [0.245, 0.475, 0.262], [0.075, 0.09, 0.03]],     // entradas a los lados de la frente
      ['caja', PELO, [-0.245, 0.475, 0.262], [0.075, 0.09, 0.03]],
    ];
    /* El halo del sacerdote flota a 0.8: con él, el tupé se queda en dos pisos. */
    if (!ctx.ligero && ctx.clase !== 'sacerdote') P.push(
      ['caja', PELO, [0, 0.725, -0.07], [0.33, 0.07, 0.36]],          // tercer piso (volumen arriba y atrás)
      ['caja', BRILLO, [0.05, 0.763, -0.07], [0.06, 0.012, 0.28]],
    );
    if (!ctx.ligero) P.push(
      ['caja', PELO, [0.282, 0.455, -0.14], [0.03, 0.15, 0.24]],      // patillas por detrás de las orejas
      ['caja', PELO, [-0.282, 0.455, -0.14], [0.03, 0.15, 0.24]],
      ['caja', BRILLO, [0.12, 0.59, 0.268], [0.17, 0.03, 0.02]],     // brillos de gomina
      ['caja', BRILLO, [-0.09, 0.672, 0.215], [0.14, 0.025, 0.02]],
    );
    K.MF(g, P, null, null, null, ctx.H);
    return 'peluca';
  },
  // CUERPO: cuello alto, capa de picos, levita, chaleco, chorrera, puños y botas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, PI = K.PI, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, WP = W * P;

    // ── Pecho ──
    const C = [
      ['caja', GRANATE, [0, T * 0.4, zP], [0.21 * WP, T * 0.5, 0.03]],                       // chaleco
      ['cono4', GRANATE, [0, T * 0.155, zP], [0.105 * WP, 0.07, 0.015], [PI, 0, 0]],         // su pico de abajo
      ['caja', ORO, [0.115 * WP, T * 0.4, zP], [0.022, T * 0.5, 0.036]],                     // ribete dorado de la levita
      ['caja', ORO, [-0.115 * WP, T * 0.4, zP], [0.022, T * 0.5, 0.036]],
      ['caja', ROJO, [0.15 * WP, T * 0.76, zP - 0.015], [0.1, 0.2, 0.035], [0, 0, 0.42]],    // solapas rojas del cuello
      ['caja', ROJO, [-0.15 * WP, T * 0.76, zP - 0.015], [0.1, 0.2, 0.035], [0, 0, -0.42]],
      ['caja', BLANCO, [0, T * 0.8, zP + 0.02], [0.21, 0.075, 0.06]],                        // chorrera (tres volantes)
      ['caja', HUESO, [0, T * 0.67, zP + 0.025], [0.16, 0.07, 0.055]],
      ['caja', BLANCO, [0, T * 0.55, zP + 0.02], [0.1, 0.065, 0.05]],
      ['caja', ORO, [0, T * 0.8, zP + 0.055], [0.085, 0.075, 0.03]],                         // engaste
      ['caja', GEMA, [0, T * 0.8, zP + 0.072], [0.05, 0.045, 0.02]],                         // gema roja
      ['caja', ORO, [0, T * 0.4, zP + 0.02], [0.04, 0.04, 0.025]],                           // botones del chaleco
      ['caja', ORO, [0, T * 0.25, zP + 0.02], [0.04, 0.04, 0.025]],
    ];
    if (!lig) C.push(
      ['caja', ORO, [0.065 * WP, T * 0.345, zP + 0.02], [0.085, 0.018, 0.02], [0, 0, 0.45]],   // cadena (dos tramos en V)
      ['caja', ORO, [-0.065 * WP, T * 0.345, zP + 0.02], [0.085, 0.018, 0.02], [0, 0, -0.45]],
      ['caja', GRANATE2, [0.06 * WP, T * 0.5, zP + 0.006], [0.06, 0.016, 0.03]],               // bolsillos del chaleco
      ['caja', GRANATE2, [-0.06 * WP, T * 0.5, zP + 0.006], [0.06, 0.016, 0.03]],
      ['caja', NEGRO, [0.15 * W, -0.06, 0.105], [0.13, 0.16, 0.03]],                           // faldones de la levita
      ['caja', NEGRO, [-0.15 * W, -0.06, 0.105], [0.13, 0.16, 0.03]],
      ['caja', ORO, [0.09 * W, -0.06, 0.107], [0.018, 0.16, 0.032]],
      ['caja', ORO, [-0.09 * W, -0.06, 0.107], [0.018, 0.16, 0.032]],
    );

    // ── Cuello alto: negro por fuera, rojo por dentro, con puntas (por debajo de las orejas) ──
    const zc = -0.385, xc = Math.max(0.43, 0.216 * WP + 0.19), ab = 0.45, anc = 2 * (xc - 0.06);
    C.push(
      ['caja', NEGRO, [0, T + 0.09, zc], [anc, 0.36, 0.035]],                          // tabla de atrás
      ['caja', ROJO, [0, T + 0.1, zc + 0.027], [anc - 0.04, 0.34, 0.02]],                      // su forro
      ['caja', ROJO, [0, T + 0.29, zc], [anc + 0.02, 0.055, 0.055]],                          // canto rojo (se ve de espaldas)
      ['caja', NEGRO, [xc, T + 0.1, -0.2], [0.035, 0.28, 0.36], [0, ab, 0]],            // alas laterales, abiertas hacia fuera
      ['caja', NEGRO, [-xc, T + 0.1, -0.2], [0.035, 0.28, 0.36], [0, -ab, 0]],
      ['caja', ROJO, [xc - 0.024, T + 0.105, -0.188], [0.02, 0.27, 0.34], [0, ab, 0]],
      ['caja', ROJO, [-xc + 0.024, T + 0.105, -0.188], [0.02, 0.27, 0.34], [0, -ab, 0]],
      ['cono4', ROJO, [xc + 0.04, T + 0.235, -0.11], [0.03, 0.13, 0.1], [0, ab, 0]],     // puntas del cuello
      ['cono4', ROJO, [-xc - 0.04, T + 0.235, -0.11], [0.03, 0.13, 0.1], [0, -ab, 0]],
    );
    K.MF(r.cuerpo, C);

    // ── Capa: paños en abanico, inclinados hacia atrás; forro rojo que asoma por los lados y entre los picos ──
    const gc = K.fuera(K.G(r.cuerpo, [0, T * 0.9, -(0.2 * P + 0.06)], [0.2, 0, 0]));
    const n = lig ? 1 : 2, paso = lig ? 0.2 : 0.12, an = lig ? 0.3 : 0.23, giro = lig ? 0.2 : 0.125, largo = 0.64;
    const X = [];
    for (let i = -n; i <= n; i++) {
      const t = i * giro, s = Math.sin(t), c = Math.cos(t), ax = i * paso * W;
      const f = (v) => Math.round(v * 1000) / 1000;
      X.push(
        ['caja', i % 2 ? PLIEGUE : NEGRO, [f(ax + s * largo / 2), f(-c * largo / 2), 0], [an, largo, 0.03], [0, 0, t]],
        ['cono4', i % 2 ? PLIEGUE : NEGRO, [f(ax + s * largo), f(-c * largo), 0], [an / 2, 0.13, 0.015], [PI, 0, -t]],
        ['caja', FORRO, [f(ax + s * (largo + 0.1) / 2 + i * 0.035), f(-c * (largo + 0.1) / 2), 0.03], [an + 0.02, largo + 0.1, 0.02], [0, 0, t]],
      );
    }
    X.push(['caja', ORO, [0.2 * W, -0.01, 0.035], [0.07, 0.06, 0.05]], ['caja', ORO, [-0.2 * W, -0.01, 0.035], [0.07, 0.06, 0.05]]);
    K.MF(gc, X);

    // ── Brazos: galón dorado, puño blanco de volantes y uñas negras ──
    for (const b of [r.bI, r.bD]) {
      const B = [
        ['caja', BLANCO, [0, -A + 0.085, 0], [0.2, 0.06, 0.2]],
        ['caja', ORO, [0, -A + 0.13, 0], [0.165, 0.025, 0.165]],
      ];
      if (!lig) B.push(['caja', HUESO, [0, -A + 0.045, 0], [0.225, 0.035, 0.225]]);
      K.MF(b, B);
    }
    if (!lig) {
      const U = [];
      for (const x of [-0.055, 0, 0.055]) U.push(['cono4', '#0e0b12', [x, -0.075, 0.07], [0.02, 0.07, 0.02], [2.3, 0, 0]]);
      K.MF(r.manoI, U); K.MF(r.manoD, U);
    }

    // ── Botas: vuelta roja con filo dorado, correa y hebilla ──
    for (const p of [r.pI, r.pD]) {
      const Bt = [
        ['caja', FORRO, [0, -L + 0.2, 0.03], [0.205, 0.07, 0.255]],
        ['caja', ORO, [0, -L + 0.158, 0.03], [0.21, 0.018, 0.26]],
        ['caja', ORO, [0, -L + 0.1, 0.178], [0.11, 0.075, 0.02]],
      ];
      if (!lig) Bt.push(
        ['caja', '#0e0b12', [0, -L + 0.1, 0.184], [0.06, 0.035, 0.02]],
        ['caja', GRANATE2, [0, -L + 0.012, 0.05], [0.185, 0.026, 0.3]],
      );
      K.MF(p, Bt);
    }
    return 'peluca';
  },
};
