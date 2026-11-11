// Traje 3D de la skin «esmeralda» (Duende Esmeralda). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_hero.png teñida (hue 40)
// Qué se ve en la imagen: Sin imagen propia: es el héroe teñido de verde esmeralda. Libertad para diseñar: explorador de jade con capucha y gemas esmeralda.
//
// DISEÑO (11-nov-2026): explorador de jade.
//  - Casco de jade oscuro con cenefa de oro, gema en la frente, cubrenuca con gema y cresta de tres cristales.
//  - Embozo (capucha bajada) al cuello y capa corta de dos puntas con ribete de oro y un rombo esmeralda grande a la espalda.
//  - Peto de jade claro con marco de oro y gema, cinturón de oro, faldar de placas.
//  - Hombreras con cristales, brazales y rodilleras con gema, vuelta de oro en las botas.
//  - Hoja de luz esmeralda (como la espada de cristal del héroe) y tres esquirlas que orbitan (solo en calidad normal).
// El verde del traje es azulado y oscuro a propósito: así no se confunde con la piel lima de la mascota.

/* Colores del cuerpo que arma humano(). */
const base = { ropa: '#0e6b4e', mangas: '#0a4735', pantalon: '#0a3b2c', botas: '#07271d', acento: '#ffcf4a', cinto: '#ffcf4a', hojaNeon: '#2bff8a' };
const OSC = '#0a4735', JADE = '#128a63', CLARO = '#2fc48d', GEMA = '#14c47c', ORO = '#ffcf4a', ORO2 = '#a8791c';
const BRILLO = { e: 0.55 };

export default {
  id: 'esmeralda',
  base,
  /* CABEZA: casco abierto (cara, orejas y espadas libres). Unidades de cabeza: la escala final es H. */
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', OSC, [0, 0.565, 0], [0.59, 0.09, 0.55]],
      ['caja', ORO, [0, 0.505, 0.005], [0.61, 0.045, 0.565]],
      ['caja', JADE, [0, 0.625, 0], [0.4, 0.05, 0.38]],
      /* cubrenuca: de espaldas la cabeza se ve de jade, no lima */
      ['caja', OSC, [0, 0.27, -0.262], [0.5, 0.43, 0.04]],
      ['caja', ORO, [0, 0.06, -0.266], [0.52, 0.04, 0.045]],
      ['caja', OSC, [0.282, 0.3, -0.17], [0.03, 0.37, 0.17]],
      ['caja', OSC, [-0.282, 0.3, -0.17], [0.03, 0.37, 0.17]],
    ];
    if (!ctx.ligero) {
      P.push(['caja', ORO, [0, 0.5, 0.285], [0.17, 0.17, 0.02], [0, 0, K.PI / 4]]);
      P.push(['caja', ORO, [0, 0.27, -0.285], [0.24, 0.24, 0.02], [0, 0, K.PI / 4]]);
    }
    K.MF(g, P, null, null, null, ctx.H);
    /* el halo del sacerdote flota a 0.8: con él, la cresta va más baja */
    const sac = ctx.clase === 'sacerdote';
    const C = [
      /* cresta de cristales: centro alto y dos inclinados hacia fuera (sacerdote: solo una gema baja) */
      ['cono4', GEMA, [0, 0.64, 0], [0.13, sac ? 0.06 : 0.19, 0.13], [0, K.PI / 4, 0]],
      ['caja', GEMA, [0, 0.5, 0.292], [0.105, 0.105, 0.03], [0, 0, K.PI / 4]],
      ['caja', GEMA, [0, 0.27, -0.292], [0.16, 0.16, 0.03], [0, 0, K.PI / 4]],
    ];
    if (!sac) {
      C.push(['cono4', GEMA, [0.12, 0.63, 0], [0.1, 0.16, 0.1], [0, 0, -0.6]]);
      C.push(['cono4', GEMA, [-0.12, 0.63, 0], [0.1, 0.16, 0.1], [0, 0, 0.6]]);
    }
    K.MF(g, C, GEMA, BRILLO, null, ctx.H);
    return 'peluca';
  },
  /* CUERPO: peto, cinturón, faldar, embozo, capa corta con rombo, hombreras de cristal, brazales y grebas. */
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, WP = W * P;
    const zP = 0.22 * P + 0.015, zB = -(0.22 * P + 0.03), R = K.PI / 4;
    const lig = ctx.ligero;
    const C = [
      /* peto */
      ['caja', CLARO, [0, T * 0.6, zP], [0.3 * WP, T * 0.4, 0.05]],
      ['caja', ORO, [0, T * 0.82, zP + 0.005], [0.34 * WP, 0.04, 0.055]],
      /* cinturón */
      ['caja', ORO, [0, T * 0.17, 0], [0.53 * WP, 0.06, 0.45 * P]],
      /* embozo: la capucha bajada alrededor del cuello */
      ['caja', OSC, [0, T * 0.93, -0.02], [0.44 * W, 0.08, 0.38]],
      /* faldar */
      ['caja', JADE, [0.1 * W, -0.06, 0.125], [0.15 * W, 0.17, 0.03]],
      ['caja', JADE, [-0.1 * W, -0.06, 0.125], [0.15 * W, 0.17, 0.03]],
      ['caja', JADE, [0.19 * W, -0.05, 0], [0.03, 0.15, 0.2]],
      ['caja', JADE, [-0.19 * W, -0.05, 0], [0.03, 0.15, 0.2]],
    ];
    if (!lig) {
      C.push(['caja', ORO, [0.1 * W, -0.15, 0.127], [0.15 * W, 0.03, 0.035]]);
      C.push(['caja', ORO, [-0.1 * W, -0.15, 0.127], [0.15 * W, 0.03, 0.035]]);
      C.push(['caja', ORO, [0, T * 0.6, zP + 0.022], [0.15, 0.15, 0.02], [0, 0, R]]);
      C.push(['caja', ORO2, [0, T * 0.17, 0.225 * P + 0.01], [0.11, 0.09, 0.03]]);
    }
    K.MF(r.cuerpo, C);
    K.MF(r.cuerpo, [
      ['caja', GEMA, [0, T * 0.6, zP + 0.03], [0.095, 0.095, 0.03], [0, 0, R]],
      ['caja', GEMA, [0, T * 0.17, 0.225 * P + 0.025], [0.06, 0.05, 0.02]],
    ], GEMA, BRILLO);

    /* capa corta a la espalda, un poco abierta hacia atrás; dos puntas abajo */
    const capa = K.G(r.cuerpo, [0, T * 0.9, zB], [0.16, 0, 0]);
    const an = 0.52 * WP, al = T * 0.92;
    const Q = [
      ['caja', JADE, [0, -al * 0.5, -0.02], [an, al, 0.035]],
      ['caja', ORO, [0, -0.02, -0.022], [an, 0.04, 0.04]],
      ['caja', JADE, [an * 0.3, -al - 0.05, -0.02], [an * 0.4, 0.12, 0.035]],
      ['caja', JADE, [-an * 0.3, -al - 0.05, -0.02], [an * 0.4, 0.12, 0.035]],
      ['caja', ORO, [an * 0.3, -al - 0.115, -0.022], [an * 0.4, 0.035, 0.04]],
      ['caja', ORO, [-an * 0.3, -al - 0.115, -0.022], [an * 0.4, 0.035, 0.04]],
      ['caja', ORO, [0, -al * 0.5, -0.042], [0.23, 0.23, 0.02], [0, 0, R]],
    ];
    if (!lig) {
      Q.push(['caja', ORO, [an * 0.5, -al * 0.5, -0.022], [0.03, al, 0.04]]);
      Q.push(['caja', ORO, [-an * 0.5, -al * 0.5, -0.022], [0.03, al, 0.04]]);
    }
    K.MF(capa, Q);
    K.MF(capa, [['caja', GEMA, [0, -al * 0.5, -0.05], [0.155, 0.155, 0.03], [0, 0, R]]], GEMA, BRILLO);

    /* hombreras con cristal, brazales */
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const H = [
        ['caja', JADE, [s * 0.02, 0.045, 0], [0.2, 0.09, 0.25]],
        ['caja', ORO, [s * 0.02, -0.01, 0], [0.22, 0.035, 0.27]],
        ['caja', JADE, [0, -A + 0.13, 0], [0.15, 0.1, 0.15]],
        ['caja', ORO, [0, -A + 0.07, 0], [0.16, 0.035, 0.16]],
      ];
      K.MF(b, H);
      const G = [['cono4', GEMA, [s * 0.05, 0.08, 0], [0.1, 0.2, 0.1], [0, 0, -s * 0.6]]];
      if (!lig) {
        G.push(['cono4', GEMA, [s * 0.0, 0.08, 0.07], [0.06, 0.12, 0.06], [0.35, 0, -s * 0.25]]);
        G.push(['caja', GEMA, [s * 0.08, -A + 0.13, 0], [0.02, 0.055, 0.055], [R, 0, 0]]);
      }
      K.MF(b, G, GEMA, BRILLO);
    }
    /* rodilleras y vuelta de la bota */
    for (const p of [r.pI, r.pD]) {
      K.MF(p, [
        ['caja', JADE, [0, -L * 0.5, 0.075], [0.14, 0.13, 0.04]],
        ['caja', ORO, [0, -L + 0.14, 0.03], [0.2, 0.04, 0.28]],
      ]);
      if (!lig) K.MF(p, [['caja', GEMA, [0, -L * 0.5, 0.098], [0.06, 0.06, 0.02], [0, 0, R]]], GEMA, BRILLO);
    }
    /* esquirlas de esmeralda que orbitan a la altura de las rodillas (un pivote, se funden en una malla) */
    if (!lig) {
      const o = K.piv(r, K.G(r.cuerpo, [0, -0.2, 0]));
      const E = [];
      for (let i = 0; i < 3; i++) {
        const a = i * K.PI * 2 / 3, x = Math.sin(a) * 0.5, z = Math.cos(a) * 0.5, y = (i - 1) * 0.07;
        E.push(['cono4', GEMA, [x, y, z], [0.05, 0.1, 0.05]]);
        E.push(['cono4', GEMA, [x, y, z], [0.05, 0.06, 0.05], [K.PI, 0, 0]]);
      }
      K.MF(o, E, GEMA, BRILLO);
      r.giran.push([o, 1.1]);
    }
  },
};
