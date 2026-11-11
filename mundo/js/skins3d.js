// GENERADO por tools/unir_skins.mjs a partir de mundo/js/skins/*.js. NO EDITAR A MANO:
// edita mundo/js/skins/<id>.js y vuelve a ejecutar «node tools/unir_skins.mjs».
// Trajes 3D de las skins del duende (los registra mundo/js/modelos.js). Guia: mundo/js/skins/LEEME.md
const _t = f => { try { return f(); } catch (e) { return null; } };

// ── berserker ──
const S_berserker = _t(() => {
const base = { ropa: '#8a36bd', pantalon: '#3d1858', botas: '#2a1040', acento: '#ffd23a', cinto: '#8a36bd' };
const MORADO = '#8a36bd', MORADO2 = '#7029a3', FONDO = '#451672', ORO = '#ffd23a', ORO2 = '#dba31c';
const PELUCA = '#ffffff', PELUCA2 = '#dcdcea', BLANCO = '#ffffff', GEMA = '#a23cf0', RUNA = '#c66bff';

const BRILLO = { [ORO]: 0.32, [ORO2]: 0.2, [PELUCA]: 0.38, [BLANCO]: 0.38, [PELUCA2]: 0.28, [GEMA]: 0.5 };
function pinta(K, padre, partes, escala) {
  const lisas = [], porColor = {};
  for (const p of partes) { if (BRILLO[p[1]]) (porColor[p[1]] = porColor[p[1]] || []).push(p); else lisas.push(p); }
  if (lisas.length) K.MF(padre, lisas, null, null, null, escala);
  for (const c in porColor) K.MF(padre, porColor[c], K.mat(c, { e: BRILLO[c] }), null, null, escala);
}

return {
  id: 'berserker',
  base,
  cabeza(r, K, ctx) {
    const PI = K.PI, lig = ctx.ligero;
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', PELUCA, [0, 0.555, -0.01], [0.57, 0.07, 0.53]],          /* casquete */
      ['cil', PELUCA, [0.14, 0.525, 0.25], [0.05, 0.27, 0.05], [0, 0, PI / 2]],   /* dos rulos sobre la frente, con raya al medio */
      ['cil', PELUCA, [-0.14, 0.525, 0.25], [0.05, 0.27, 0.05], [0, 0, PI / 2]],
      ['caja', PELUCA2, [0, 0.29, -0.27], [0.56, 0.54, 0.05]],          /* nuca (fondo gris: los rulos blancos resaltan) */
    ];
    /* filas de rulos en la nuca (lo que más se ve en el juego) */
    const filas = lig ? [0.42, 0.22, 0.03] : [0.44, 0.30, 0.16, 0.02];
    for (const y of filas) P.push(['cil', PELUCA, [0, y, -0.305], [0.058, y < 0.05 ? 0.62 : 0.57, 0.058], [0, 0, PI / 2]]);
    /* rulos apilados a los lados de la cara, por debajo de las orejas */
    for (const s of [-1, 1]) {
      P.push(['caja', PELUCA, [s * 0.287, 0.43, -0.15], [0.035, 0.2, 0.22]]);
      for (let k = 0; k < 3; k++) {
        const y = 0.2 - k * 0.12, x = s * (0.325 + k * 0.012);
        P.push(['cil', PELUCA, [x, y, -0.03], [0.066, 0.36, 0.066], [PI / 2, 0, 0]]);
        if (!lig) P.push(['caja', PELUCA2, [x, y, 0.153], [0.05, 0.05, 0.014]]);
      }
    }
    /* corona: aro, puntas y gemas. Con halo (sacerdote) las puntas son bajas para no atravesarlo. */
    const bajo = ctx.clase === 'sacerdote', yb = 0.59;
    P.push(['caja', ORO2, [0, yb + 0.015, 0], [0.43, 0.03, 0.43]]);
    P.push(['caja', ORO, [0, yb + 0.06, 0], [0.40, 0.09, 0.40]]);
    P.push(['caja', MORADO2, [0, yb + 0.115, 0], [0.30, 0.05, 0.30]]);
    const yp = yb + 0.10, k = bajo ? 0.3 : 1;
    for (const [x, z, h] of [[0, 0.17, 0.27], [0, -0.17, 0.27], [0.17, 0, 0.22], [-0.17, 0, 0.22], [0.17, 0.17, 0.17], [-0.17, 0.17, 0.17], [0.17, -0.17, 0.17], [-0.17, -0.17, 0.17]]) {
      P.push(['cono4', ORO, [x, yp, z], [0.065, h * k, 0.065], [0, PI / 4, 0]]);
    }
    P.push(['caja', GEMA, [0, yb + 0.06, 0.203], [0.08, 0.055, 0.02]]);
    P.push(['caja', GEMA, [0, yb + 0.06, -0.203], [0.08, 0.055, 0.02]]);
    if (!lig) {
      P.push(['caja', GEMA, [0.203, yb + 0.06, 0], [0.02, 0.055, 0.08]]);
      P.push(['caja', GEMA, [-0.203, yb + 0.06, 0], [0.02, 0.055, 0.08]]);
    }
    pinta(K, g, P, ctx.H);
    return 'peluca';
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, PI = K.PI, lig = ctx.ligero;
    const zc = 0.2 * P + 0.02;
    const C = [
      ['tronco', MORADO, [0, -L + 0.03, 0], [0.31 * W * P, L + 0.12, 0.28 * P]],             /* falda de la toga */
      ['cil', ORO, [0, -L + 0.065, 0], [0.318 * W * P, 0.07, 0.288 * P]],                    /* bajo dorado */
      ['caja', ORO, [0, T * 0.95, 0], [0.4 * W, 0.05, 0.34 * P]],                            /* cuello */
      ['caja', FONDO, [0, T * 0.5, zc - 0.008], [0.15 * W * P, T * 0.7, 0.02]],              /* interior oscuro del pecho */
      ['caja', ORO, [0.09 * W * P, T * 0.52, zc], [0.055, T * 0.72, 0.03], [0, 0, -0.13]],   /* ribete del pecho */
      ['caja', ORO, [-0.09 * W * P, T * 0.52, zc], [0.055, T * 0.72, 0.03], [0, 0, 0.13]],
      ['caja', BLANCO, [0, T * 0.84, zc + 0.012], [0.18, 0.07, 0.04]],                       /* chorrera en tres pisos */
      ['caja', BLANCO, [0, T * 0.71, zc + 0.02], [0.14, 0.09, 0.04]],
      ['caja', BLANCO, [0, T * 0.58, zc + 0.024], [0.09, 0.08, 0.035]],
    ];
    if (!lig) C.push(['caja', PELUCA2, [0, T * 0.7, zc + 0.043], [0.016, 0.2, 0.01]]);
    pinta(K, r.cuerpo, C);
    /* abertura delantera de la falda: sigue la pendiente del tronco */
    const gf = K.G(r.cuerpo, [0, -0.135, 0.222 * P], [-0.22, 0, 0]);
    pinta(K, gf, [
      ['caja', FONDO, [0, 0, 0], [0.2 * W, 0.55, 0.03]],
      ['caja', ORO, [0.105 * W, 0, 0.006], [0.055, 0.56, 0.035], [0, 0, 0.1]],
      ['caja', ORO, [-0.105 * W, 0, 0.006], [0.055, 0.56, 0.035], [0, 0, -0.1]],
    ]);
    /* capa a la espalda con ribete */
    const ge = K.G(r.cuerpo, [0, 0.02, -(0.268 * P + 0.012)], [0.085, 0, 0]);
    pinta(K, ge, [
      ['caja', MORADO2, [0, 0, 0], [0.46 * W, 0.76, 0.03]],
      ['caja', ORO, [0.215 * W, 0, -0.004], [0.045, 0.77, 0.035]],
      ['caja', ORO, [-0.215 * W, 0, -0.004], [0.045, 0.77, 0.035]],
      ['caja', ORO, [0, -0.36, -0.004], [0.46 * W, 0.05, 0.035]],
    ]);
    /* mangas de campana */
    for (const b of [r.bI, r.bD]) {
      pinta(K, b, [
        ['caja', MORADO, [0, -0.01, 0], [0.19, 0.13, 0.22]],
        ['caja', ORO, [0, -0.085, 0], [0.2, 0.03, 0.23]],
        ['caja', MORADO, [0, -A * 0.62, 0], [0.19, 0.2, 0.23]],
        ['caja', ORO, [0, -A + 0.07, 0], [0.23, 0.06, 0.27]],
      ]);
    }
    /* mazo dorado: en la zurda si está libre; si no (escudo o segunda daga), cruzado a la espalda */
    const libre = ctx.clase !== 'guerrero' && ctx.arma !== 'dagas';
    const gm = libre ? K.fuera(K.G(r.manoI, [0.02, 0, 0.02], [-0.8, 0, 0])) : K.G(r.cuerpo, [-0.12, -0.1, -(0.268 * P + 0.08)], [-PI / 2, 0, -0.6]);
    const M = [
      ['caja', ORO2, [0, 0, 0.19], [0.045, 0.045, 0.52]],
      ['cil', ORO, [0, 0, 0.47], [0.105, 0.26, 0.105], [0, 0, PI / 2]],
      ['cil', ORO2, [0.15, 0, 0.47], [0.118, 0.05, 0.118], [0, 0, PI / 2]],
      ['cil', ORO2, [-0.15, 0, 0.47], [0.118, 0.05, 0.118], [0, 0, PI / 2]],
    ];
    pinta(K, gm, M);
    /* anillos de runas que giran (solo en calidad normal) */
    if (!lig) {
      const mr = K.mat(RUNA, { e: 1 }), mo = K.mat(ORO, { e: 0.5 }), ma = K.mat(RUNA, { aura: true, op: 0.13 });
      for (const [y, inc, v, R, aro] of [[0.14, 0.12, 0.9, 0.62, 1], [0.52, -0.22, -1.2, 0.55, 0]]) {
        const g = K.piv(r, K.fuera(K.G(r.raiz, [0, y, 0], [inc, 0, 0])));
        const runas = [];
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * PI * 2, t = i % 3;
          runas.push(['caja', null, [Math.cos(a) * R, 0.085, Math.sin(a) * R], t === 1 ? [0.075, 0.075, 0.02] : [0.03, 0.13, 0.02], [0, PI / 2 - a, t === 1 ? PI / 4 : t === 2 ? 0.6 : 0]]);
        }
        K.MF(g, runas, mr);
        if (aro) K.M(g, 'toro', mo, [0, 0, 0], [R, 0.16, R]);
        K.M(g, 'toro', ma, [0, 0.07, 0], [R + 0.03, 0.55, R + 0.03]).userData.sinFlash = true;
        r.giran.push([g, v]);
      }
    }
  },
};
});

// ── bruja ──
const S_bruja = _t(() => {
const PIEL = '#8fd14f';
const MORADO = '#5b3487', MORADO2 = '#432466', NARANJA = '#f07a1a', NARANJA2 = '#d2540e';
const CUERO = '#5e3a22', CUERO2 = '#3f2615', ORO = '#e0a82e', HOJA = '#4caf3a', HUESO = '#f1ead8', SUELA = '#d9b47a', NEGRO = '#1d1322';

const base = { ropa: MORADO2, pantalon: PIEL, botas: CUERO, acento: NARANJA, cinto: CUERO2, mangas: PIEL };

return {
  id: 'bruja',
  base,
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
});

// ── comun ──
const S_comun = _t(() => {
const PIEL = '#8fd14f';
const base = { ropa: '#2b5fd0', mangas: PIEL, pantalon: PIEL, botas: '#7a4a28', acento: '#e8b923', cinto: '#5a3418' };
const AZUL = '#2b5fd0', MARINO = '#17307a', CELESTE = '#4fb0ee', ORO = '#ffd23f';
const SHORT = '#6b4226', SHORT2 = '#472b18', CUERO = '#7a4a28', CUERO2 = '#4f2e16', SUELA = '#dcbb7c', HEBILLA = '#e8b923';

return {
  id: 'comun',
  base,
  cabeza() { return ''; },
  vestir(r, K, ctx) {
    const { T, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, WP = W * P, lig = ctx.ligero;
    const g = ctx.cpo.grueso * 1.18;
    const zf = 0.2 * P + 0.045;                       /* cara delantera del poncho */
    const yB = T * 0.43, yT = T * 0.985;               /* borde de abajo y de arriba del bloque del poncho */
    const C = [
      ['caja', AZUL, [0, (yB + yT) / 2, 0], [0.57 * WP, yT - yB, zf * 2]],                 /* bloque del poncho */
      ['caja', MARINO, [0, yT + 0.01, 0], [0.36 * WP, 0.03, zf * 1.3]],                     /* cuello */
      ['caja', CUERO2, [0, yB + 0.03, 0], [0.59 * WP, 0.04, zf * 2 + 0.03]],              /* cinturón */
      ['caja', HEBILLA, [0, yB + 0.03, zf + 0.02], [0.075, 0.065, 0.02]],                  /* hebilla */
      ['caja', SHORT, [0, 0.01, 0], [0.38 * W, 0.18, 0.27]],                               /* short: cadera */
    ];
    const filas = [[0.46, yB - 0.03, 0.07], [0.32, yB - 0.095, 0.07], [0.17, yB - 0.16, 0.07]];
    const tan = 0.93, ang = 0.75;
    for (const s of [1, -1]) {
      const z = s * (zf - 0.02);
      for (const [w, y, h] of filas) C.push(['caja', AZUL, [0, y, z], [w * WP, h, 0.04]]);
      const grecas = [[ORO, yB - 0.155, 0.055], [CELESTE, yB - 0.075, 0.05], [ORO, yB + 0.075, 0.05]];
      if (!lig) grecas.push([CELESTE, yB + 0.145, 0.04]);
      for (const [c, y0, gr] of grecas) {
        const dx = Math.min(0.275 * WP, (yT - 0.03 - y0) / tan);
        for (const x of [1, -1]) C.push(['caja', c, [x * dx / 2, y0 + dx * tan / 2, s * (zf + 0.004)], [dx / Math.cos(ang) + 0.02, gr, 0.022], [0, 0, x * ang]]);
      }
      if (!lig) {
        for (const [w, y, h] of filas) for (const x of [1, -1]) C.push(['caja', CELESTE, [x * (w * WP / 2 - 0.025), y - h / 2 - 0.02, z], [0.035, 0.05, 0.03]]);
        C.push(['caja', CELESTE, [0, yB - 0.215, z], [0.035, 0.05, 0.03]]);
      }
    }
    if (!lig) {
      C.push(['caja', MARINO, [0, T * 0.945, zf + 0.002], [0.13, 0.13, 0.02], [0, 0, K.PI / 4]]);
      C.push(['caja', PIEL, [0, T * 0.965, zf + 0.008], [0.085, 0.085, 0.02], [0, 0, K.PI / 4]]);
    }
    const bx = -0.17 * WP, bz = zf + 0.03;
    C.push(['caja', CUERO, [bx, yB - 0.07, bz], [0.13, 0.12, 0.07]]);
    C.push(['caja', CUERO2, [bx, yB - 0.03, bz + 0.005], [0.14, 0.05, 0.075]]);
    if (!lig) C.push(['caja', HEBILLA, [bx, yB - 0.065, bz + 0.04], [0.035, 0.035, 0.02]]);
    K.MF(r.cuerpo, C);
    for (const b of [r.bI, r.bD]) {
      const B = [
        ['caja', AZUL, [0, -0.015, 0], [0.24, 0.22, 0.36]],
        ['caja', ORO, [0, -0.075, 0], [0.255, 0.04, 0.375]],
        ['caja', AZUL, [0, -0.15, 0], [0.24, 0.05, 0.24]],
      ];
      if (!lig) {
        B.push(['caja', CELESTE, [0, -0.02, 0], [0.255, 0.03, 0.375]]);
        for (const z of [-0.15, 0.15]) B.push(['caja', CELESTE, [0, -0.145, z], [0.2, 0.05, 0.035]]);
        B.push(['caja', CELESTE, [0, -0.195, 0], [0.2, 0.05, 0.035]]);
      }
      K.MF(b, B);
    }
    const bw = 0.17 * g, pw = 0.085 * g * 2.4;
    for (const [p, lado] of [[r.pI, 1], [r.pD, -1]]) {
      const Q = [
        ['caja', SHORT, [0, -0.06, 0], [pw, 0.14, pw + 0.02]],
        ['caja', CUERO, [0, -L + 0.155, 0.005], [bw * 0.94, 0.09, 0.2]],
        ['caja', SUELA, [0, -L + 0.02, 0.07], [bw * 1.08, 0.04, 0.35]],
        ['caja', CUERO2, [0, -L + 0.13, 0.02], [bw * 1.05, 0.04, 0.235]],
      ];
      if (!lig) {
        Q.push(['caja', SHORT2, [0, -0.125, 0], [pw + 0.012, 0.03, pw + 0.032]]);
        Q.push(['caja', CUERO2, [0, -L + 0.195, 0.005], [bw * 1.02, 0.035, 0.22]]);
        Q.push(['caja', HEBILLA, [lado * bw * 0.53, -L + 0.13, 0.03], [0.02, 0.065, 0.075]]);
      }
      K.MF(p, Q);
    }
    return '';
  },
};
});

// ── cosmico ──
const S_cosmico = _t(() => {
const base = { ropa: '#14306e', pantalon: '#0d1f4a', botas: '#1f418f', acento: '#38bdf8', cinto: '#38bdf8', hojaNeon: '#f0a6ff' };
const NOCHE = '#0d1b45', PLACA = '#2752b5', PLACA2 = '#3f7be0', CEL = '#38bdf8', HIELO = '#c8f1ff', LILA = '#a78bfa', ROSA = '#f0a6ff', CAPA = '#162a78';

return {
  id: 'cosmico',
  base,
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
    if (!lig && ctx.clase !== 'sacerdote') {
      const o = K.piv(r, K.fuera(K.G(r.cabeza, [0, 1.0 * H, -0.02 * H], [0.3, 0, 0.2])));
      K.MF(o, [['icos', null, [0, 0, 0], 0.085], ['caja', null, [0.25, 0.03, 0], [0.05, 0.05, 0.05]]], LILA, { e: 0.5 }, null, H);
      K.MF(o, [['toro', null, [0, 0, 0], [0.16, 0.16, 0.16]]], CEL, { e: 0.85 }, null, H);
      r.giran.push([o, 1.1]);
    }
    return 'casco';
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.05);
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

    const alto = T * 0.86 + L * 0.62, an = 0.5 * W;
    const c = K.G(r.cuerpo, [0, T * 0.88, zE - 0.01], [0.13, 0, 0]);
    K.MF(c, [
      ['caja', CAPA, [0, -alto * 0.46, 0], [an, alto * 0.92, 0.03]],
      ['caja', CAPA, [0, -alto * 0.96, 0], [an * 0.62, alto * 0.08, 0.03]],                /* pico central del bajo (escalón de píxel) */
      ['caja', NOCHE, [0, -alto * 0.03, -0.004], [an + 0.03, alto * 0.07, 0.035]],         /* cuello de la capa */
      ['caja', NOCHE, [an * 0.5, -alto * 0.5, 0], [0.03, alto * 0.86, 0.036]],             /* orillos */
      ['caja', NOCHE, [-an * 0.5, -alto * 0.5, 0], [0.03, alto * 0.86, 0.036]],
    ]);
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
    for (const p of [r.pI, r.pD]) {
      if (!lig) K.M(p, 'caja', PLACA2, [0, -L * 0.52, 0.065], [0.13, 0.10, 0.05]);
      K.M(p, 'caja', K.mat(CEL, { e: 0.85 }), [0, -L + 0.135, 0.035], [0.19, 0.03, 0.275]);
    }
  },
};
});

// ── esmeralda ──
const S_esmeralda = _t(() => {
/* Colores del cuerpo que arma humano(). */
const base = { ropa: '#0e6b4e', mangas: '#0a4735', pantalon: '#0a3b2c', botas: '#07271d', acento: '#ffcf4a', cinto: '#ffcf4a', hojaNeon: '#2bff8a' };
const OSC = '#0a4735', JADE = '#128a63', CLARO = '#2fc48d', GEMA = '#14c47c', ORO = '#ffcf4a', ORO2 = '#a8791c';
const BRILLO = { e: 0.55 };

return {
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
});

// ── esqueleto ──
const S_esqueleto = _t(() => {
const base = { ropa: '#2a2030', pantalon: '#2a2030', botas: '#6e4526', acento: '#efe6cf', cinto: '#8a5a2e' };
const HUESO = '#fff4d6', HUESO2 = '#b9a988', NEGRO = '#17121c', TELA = '#2a2030';
const MORADO = '#8a44c8', MORADO2 = '#6a2fa6', CUERO = '#6e4526', CUERO2 = '#4d2f18', ORO = '#e2a93b', CREMA = '#e6d2a4';

return {
  id: 'esqueleto',
  base,
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
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, gr = ctx.cpo.grueso || 1, lig = ctx.ligero;
    const zP = 0.2 * P + 0.012;                    /* justo delante del pecho */
    const C = [];
    const cost = [[0.70, 0.125], [0.56, 0.135], [0.42, 0.115]];
    for (const [fy, an] of cost) for (const s of [1, -1]) {
      C.push(['caja', HUESO, [s * (0.02 + an * 0.5) * W * P, T * fy, zP - 0.012], [an * W * P, 0.042, 0.04], [0, s * 0.3, -s * 0.22]]);
    }
    C.push(['caja', HUESO, [0, T * 0.58, zP], [0.04, T * 0.42, 0.035]]);                       /* esternón */
    C.push(['caja', MORADO, [0, T * 0.92, -0.01], [0.50 * W * P, 0.06, 0.42 * P]]);
    for (const x of [-0.16, 0, 0.16]) C.push(['cono4', x ? MORADO : MORADO2, [x * W * P, T * 0.9, zP - 0.02], [0.07, 0.09, 0.03], [Math.PI, 0, 0]]);
    C.push(['caja', HUESO, [0, T * 0.81, zP + 0.02], [0.085, 0.075, 0.04]]);
    const yC = T * 0.18, zC = 0.19 * P + 0.03;
    C.push(['caja', HUESO, [0, yC + 0.01, zC], [0.14, 0.11, 0.05]], ['caja', HUESO, [0, yC - 0.06, zC], [0.085, 0.04, 0.05]]);
    C.push(['caja', NEGRO, [0.035, yC + 0.015, zC + 0.02], [0.04, 0.045, 0.02]], ['caja', NEGRO, [-0.035, yC + 0.015, zC + 0.02], [0.04, 0.045, 0.02]]);
    C.push(['caja', CUERO, [-0.19 * W * P, yC - 0.03, 0.13 * P + 0.03], [0.12, 0.13, 0.1]], ['caja', CUERO2, [-0.19 * W * P, yC + 0.02, 0.13 * P + 0.04], [0.13, 0.06, 0.1]]);
    C.push(['caja', MORADO, [0, T * 0.07, 0], [0.50 * W * P, 0.05, 0.42 * P]]);
    const picos = [[-0.17, 1], [0.02, 1], [0.19, 1], [-0.1, -1], [0.12, -1]];
    for (const [x, s] of picos) C.push(['cono4', s > 0 ? MORADO : MORADO2, [x * W * P, T * 0.05, s * 0.2 * P], [0.08, 0.12, 0.035], [Math.PI, 0, 0]]);
    if (!lig) {
      C.push(['caja', NEGRO, [0.02, T * 0.815, zP + 0.035], [0.022, 0.025, 0.02]], ['caja', NEGRO, [-0.02, T * 0.815, zP + 0.035], [0.022, 0.025, 0.02]]);
      C.push(['caja', ORO, [-0.19 * W * P, yC - 0.02, 0.13 * P + 0.09], [0.035, 0.035, 0.02]]);                  /* botón de la bolsa */
      C.push(['cono4', MORADO, [0.26 * W * P, T * 0.05, 0], [0.035, 0.11, 0.08], [Math.PI, 0, 0]], ['cono4', MORADO, [-0.26 * W * P, T * 0.05, 0], [0.035, 0.11, 0.08], [Math.PI, 0, 0]]);
    }
    K.MF(r.cuerpo, C);

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
});

// ── frankenstein ──
const S_frankenstein = _t(() => {
const MARRON = '#8c5529', MARRON_CL = '#ab6d35', MARRON_OS = '#5e391c';
const MORADO = '#573283', MORADO_CL = '#7b4bb0', NARANJA = '#e07a1f';
const CAMISA = '#26242b', NEGRO = '#15131a', PELO = '#17151c', PELO_CL = '#2c2936';
const METAL = '#aeb7c1', METAL_OS = '#6c7580', HILO = '#1d2a14', HILO_CL = '#e9dfc4';
const SUELA = '#d9b98a', BOTA = '#5c3518', BOTA_CL = '#7d4a22', PIEL = '#8fd14f';

const base = { ropa: MARRON, pantalon: PIEL, botas: BOTA, acento: METAL, cinto: NEGRO, mangas: PIEL };

return {
  id: 'frankenstein',
  base,
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza)), lig = ctx.ligero, R = K.PI / 2;
    const P = [
      ['caja', PELO, [0, 0.575, -0.005], [0.59, 0.15, 0.56]],              // bloque de pelo: techo plano y alto
      ['caja', PELO, [0, 0.39, -0.265], [0.57, 0.24, 0.04]],               // nuca
      ['caja', PELO, [0.283, 0.475, -0.01], [0.03, 0.09, 0.53]],           // patillas (por encima de las orejas)
      ['caja', PELO, [-0.283, 0.475, -0.01], [0.03, 0.09, 0.53]],
      ['caja', PELO, [0, 0.465, 0.262], [0.11, 0.09, 0.035]],
      ['caja', PELO, [0.11, 0.487, 0.262], [0.11, 0.045, 0.035]],
      ['caja', PELO, [-0.11, 0.487, 0.262], [0.11, 0.045, 0.035]],
      ['caja', PELO, [0.225, 0.455, 0.262], [0.12, 0.11, 0.035]],
      ['caja', PELO, [-0.225, 0.455, 0.262], [0.12, 0.11, 0.035]],
      ['caja', PELO, [0, 0.235, -0.265], [0.13, 0.09, 0.04]],
      ['caja', PELO, [0.22, 0.225, -0.265], [0.13, 0.11, 0.04]],
      ['caja', PELO, [-0.22, 0.225, -0.265], [0.13, 0.11, 0.04]],
      ['cil', METAL, [0.34, 0.385, 0.12], [0.036, 0.16, 0.036], [0, 0, R]],
      ['cil', METAL, [-0.34, 0.385, 0.12], [0.036, 0.16, 0.036], [0, 0, R]],
      ['cil', METAL_OS, [0.435, 0.385, 0.12], [0.068, 0.05, 0.068], [0, 0, R]],
      ['cil', METAL_OS, [-0.435, 0.385, 0.12], [0.068, 0.05, 0.068], [0, 0, R]],
    ];
    if (!lig) {
      P.push(
        ['caja', PELO_CL, [0, 0.655, -0.005], [0.5, 0.012, 0.46]],          // brillo del techo del pelo
        ['cil', METAL_OS, [0.29, 0.385, 0.12], [0.055, 0.02, 0.055], [0, 0, R]],   // arandelas
        ['cil', METAL_OS, [-0.29, 0.385, 0.12], [0.055, 0.02, 0.055], [0, 0, R]],
        ['caja', HILO, [-0.2, 0.2, 0.256], [0.016, 0.13, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.215, 0.24, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.2, 0.2, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.185, 0.16, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [0.272, 0.16, 0.08], [0.012, 0.016, 0.2]],
        ['caja', HILO, [0.273, 0.16, 0.14], [0.012, 0.06, 0.016]],
        ['caja', HILO, [0.273, 0.16, 0.08], [0.012, 0.06, 0.016]],
        ['caja', HILO, [0.273, 0.16, 0.02], [0.012, 0.06, 0.016]],
      );
    }
    K.MF(g, P, null, null, null, ctx.H);
    return 'peluca';                                 // trae su propio pelo: no se dibuja el del jugador
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const gr = (ctx.cpo.grueso || 1) * 1.18;         // el mismo engorde que aplica humano() a brazos y piernas
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.012), WP = W * P;
    const C = [
      ['caja', CAMISA, [0, T * 0.55, zP], [0.2 * WP, T * 0.62, 0.03]],
      ['caja', MARRON_CL, [0.135 * WP, T * 0.62, zP + 0.004], [0.1 * WP, T * 0.5, 0.045], [0, 0, 0.22]],     // solapas abiertas
      ['caja', MARRON_CL, [-0.135 * WP, T * 0.62, zP + 0.004], [0.1 * WP, T * 0.5, 0.045], [0, 0, -0.22]],
      ['caja', MARRON_OS, [0, T * 0.93, -0.09], [0.36 * W, 0.08, 0.1]],                                      // cuello levantado atrás
      ['cil', NEGRO, [0, T * 0.18, 0], [0.242 * WP, 0.085, 0.197 * P]],
      ['caja', METAL, [0, T * 0.18, 0.2 * P + 0.008], [0.17, 0.125, 0.03]],
      ['caja', NEGRO, [0, T * 0.18, 0.2 * P + 0.014], [0.095, 0.06, 0.03]],
      ['caja', MORADO, [0, 0.015, 0], [0.37 * W, 0.16, 0.25]],
      ['caja', MORADO_CL, [0.09 * WP, T * 0.66, zE], [0.16, 0.14, 0.035], [0, 0, 0.18]],
      ['caja', NARANJA, [-0.1 * WP, T * 0.38, zE + 0.012], [0.13, 0.11, 0.035], [0, 0, -0.15]],
      ['caja', MARRON, [-0.16 * W, 0.02, -0.165 * P], [0.11 * W, 0.13, 0.03]],
      ['caja', MARRON_OS, [-0.055 * W, 0.045, -0.17 * P], [0.11 * W, 0.08, 0.03]],
      ['caja', MARRON, [0.055 * W, 0.005, -0.17 * P], [0.11 * W, 0.16, 0.03]],
      ['caja', MARRON_OS, [0.16 * W, 0.035, -0.165 * P], [0.11 * W, 0.1, 0.03]],
      ['caja', MARRON, [0.2 * WP, 0.03, 0.04], [0.03, 0.12, 0.2 * P]],
      ['caja', MARRON, [-0.2 * WP, 0.045, 0.04], [0.03, 0.09, 0.2 * P]],
    ];
    if (!lig) {
      C.push(
        ['caja', NARANJA, [-0.15 * WP, T * 0.5, zP + 0.03], [0.07, 0.07, 0.02], [0, 0, -0.22]],
        ['caja', MORADO_CL, [0.16 * WP, T * 0.36, zP + 0.012], [0.07, 0.08, 0.03], [0, 0, 0.3]],
        ['caja', HILO_CL, [0.09 * WP, T * 0.66 + 0.085, zE - 0.004], [0.13, 0.014, 0.03], [0, 0, 0.18]],
        ['caja', HILO_CL, [0.09 * WP, T * 0.66 - 0.085, zE - 0.004], [0.13, 0.014, 0.03], [0, 0, 0.18]],
        ['caja', HILO_CL, [-0.1 * WP + 0.078, T * 0.38, zE + 0.008], [0.014, 0.09, 0.03], [0, 0, -0.15]],
        ['caja', HILO_CL, [-0.1 * WP - 0.078, T * 0.38, zE + 0.008], [0.014, 0.09, 0.03], [0, 0, -0.15]],
        ['caja', MARRON_OS, [0, T * 0.52, zE + 0.008], [0.016, T * 0.5, 0.02]],
      );
    }
    K.MF(r.cuerpo, C);

    const am = Math.max(0.215, 0.18 * gr);
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const B = [
        ['caja', MARRON, [0, -0.005, 0], [am, 0.2, am]],                                  // hombro y manga
        ['caja', MARRON_OS, [0, -0.12, 0.5 * am - 0.035], [am * 0.98, 0.05, 0.07]],       // picos del borde roto
        ['caja', MARRON, [0, -0.13, -0.5 * am + 0.04], [am * 0.98, 0.08, 0.08]],
        ['caja', s > 0 ? MORADO_CL : NARANJA, [s * (am * 0.5 + 0.004), -0.02, 0], [0.02, 0.1, 0.11]],   // parche del hombro
      ];
      if (!lig) {
        B.push(
          ['caja', HILO, [0, -A + 0.13, 0], [0.165 * gr, 0.016, 0.165 * gr]],              // costura del antebrazo
          ['caja', HILO, [s * 0.083 * gr, -A + 0.13, 0.03], [0.012, 0.05, 0.016]],
          ['caja', HILO, [s * 0.083 * gr, -A + 0.13, -0.03], [0.012, 0.05, 0.016]],
        );
      }
      K.MF(b, B);
    }

    const pm = 0.215 * gr, bw = 0.17 * gr;
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      const Q = [
        ['caja', MORADO, [0, -0.06, 0], [pm, 0.14, pm]],                                 // pernera
        ['caja', MORADO, [-pm * 0.33, -0.15, 0], [pm * 0.34, 0.07, pm]],                   // picos del bajo roto
        ['caja', MORADO, [0, -0.14, 0], [pm * 0.34, 0.03, pm]],
        ['caja', MORADO, [pm * 0.33, -0.165, 0], [pm * 0.34, 0.1, pm]],
        ['caja', SUELA, [0, -L + 0.016, 0.055], [bw + 0.03, 0.032, 0.33]],                // suela clara
        ['caja', BOTA_CL, [0, -L + 0.135, 0.02], [bw + 0.025, 0.045, 0.25]],              // caña de la bota
      ];
      if (!lig) {
        Q.push(
          ['caja', s > 0 ? NARANJA : MORADO_CL, [s * 0.02, -0.07, pm * 0.5 + 0.002], [0.08, 0.08, 0.016], [0, 0, 0.2 * s]],   // parche de la pernera
          ['caja', HILO, [0, -0.265, 0], [0.18 * gr, 0.016, 0.18 * gr]],
          ['caja', HILO, [s * 0.03, -0.265, 0.09 * gr], [0.016, 0.055, 0.012]],                  // costura de la espinilla
          ['caja', METAL, [0, -L + 0.085, 0.172], [0.05, 0.035, 0.012]],                  // hebilla de la bota
        );
      }
      K.MF(p, Q);
    }
    return 'peluca';
  },
};
});

// ── king ──
const S_king = _t(() => {
const base = { ropa: '#262a72', pantalon: '#16153f', botas: '#1b1750', acento: '#3fd9e8', cinto: '#16153f' };
const ORO = '#f5a81f', ORO2 = '#ffdc48', ROJIZO = '#c9401c', FORRO = '#6a2278', FORRO2 = '#8a2f9a';
const GEMA = '#25c98a', GEMA2 = '#0f7a6a';
const CIAN = '#3fd9e8', MORADO = '#a24bff', SOLAPA = '#3d2391', FALDON = '#1e2160', CAMISA = '#e3efff', CORBATA = '#8e3fe6';
const MARCO = '#6b8fb5', MARCO2 = '#3f5f85', PANTALLA = '#1c1040', VERDE = '#3ee07a', ROJO = '#ff4d5e';

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

return {
  id: 'king',
  base,
  cabeza(r, K, ctx) {
    const lig = ctx.ligero, halo = ctx.clase === 'sacerdote';
    const k = halo ? 0.45 : 1;                       /* con halo, puntas más bajas */
    const g = K.fuera(K.G(r.cabeza));
    const O = [['caja', null, [0, 0.61, 0], [0.63, 0.11, 0.59]]];
    const O2 = [['caja', null, [0, 0.675, 0], [0.69, 0.03, 0.65]]];
    const P = [
      ['caja', ROJIZO, [0, 0.535, 0], [0.6, 0.05, 0.56]],
      ['caja', FORRO, [0, 0.705, 0], [0.56, 0.05, 0.52]],
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
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const mC = K.mat(CIAN, { e: 0.85 }), mM = K.mat(MORADO, { e: 0.75 });
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
    const C = [
      ['caja', null, [sx + 0.042, T * 0.68, zP], [0.018, 0.3, 0.03], [0, 0, -0.3]],
      ['caja', null, [-sx - 0.042, T * 0.68, zP], [0.018, 0.3, 0.03], [0, 0, 0.3]],
      ['caja', null, [0, -0.05, 0], [0.45 * W * P, 0.022, 0.39 * P]],
      ['caja', null, [0, T * 0.27, zT(0, T * 0.27) + 0.012], [0.035, 0.035, 0.02]],
    ];
    const M2 = [['caja', null, [0, T * 0.5, -(zT(0, T * 0.5) + 0.004)], [0.03, T * 0.62, 0.02]]];
    for (const s of [-1, 1]) {
      const x1 = s * 0.11 * W * P, x2 = s * 0.17 * W * P;
      C.push(['caja', null, [x1, T * 0.6, -(zT(x1, T * 0.6) + 0.004)], [0.022, T * 0.34, 0.02]]);
      C.push(['caja', null, [(x1 + x2) / 2, T * 0.42, -(zT((x1 + x2) / 2, T * 0.42) + 0.002)], [0.08 * W * P, 0.022, 0.03], [0, s * 0.5, 0]]);
      C.push(['caja', null, [x1, T * 0.8, -(zT(x1, T * 0.8) + 0.002)], [0.11 * W * P, 0.022, 0.03], [0, s * 0.45, 0]]);
      if (!lig) {
        C.push(['caja', null, [x2, T * 0.36, -(zT(x2, T * 0.36) + 0.006)], [0.04, 0.04, 0.02], [0, s * 0.7, 0]]);
        M2.push(['caja', null, [s * 0.055 * W * P, T * 0.26, -(zT(s * 0.055, T * 0.26) + 0.004)], [0.075 * W * P, 0.02, 0.02], [0, 0, s * 0.5]]);
        M2.push(['caja', null, [s * 0.2 * W * P, T * 0.62, -(zT(s * 0.2 * W * P, T * 0.62) + 0.002)], [0.02, T * 0.2, 0.03], [0, s * 0.8, 0]]);
        M2.push(['caja', null, [s * 0.14 * W * P, T * 0.3, zT(s * 0.14 * W * P, T * 0.3) + 0.004], [0.08, 0.018, 0.03], [0, s * 0.6, 0]]);
      }
    }
    K.MF(r.cuerpo, C, mC);
    K.MF(r.cuerpo, M2, mM);
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      K.M(b, 'caja', SOLAPA, [s * 0.015, 0.045, 0], [0.2, 0.06, 0.23], [0, 0, s * 0.22]);
      K.M(b, 'caja', mC, [s * 0.03, 0.085, 0], [0.2, 0.022, 0.24], [0, 0, s * 0.22]);
      K.M(b, 'caja', mC, [0, -A + 0.07, 0], [0.165, 0.04, 0.165]);
      if (!lig) {
        K.M(b, 'caja', mM, [s * 0.072, -A * 0.45, 0], [0.016, A * 0.42, 0.035]);
        K.M(b, 'caja', CAMISA, [0, -A + 0.04, 0], [0.15, 0.025, 0.15]);
      }
    }
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      K.M(p, 'caja', mC, [0, -L + 0.014, 0.05], [0.19, 0.026, 0.33]);
      K.M(p, 'caja', mM, [0, -L + 0.125, 0.06], [0.178, 0.022, 0.23]);
      if (!lig) {
        K.M(p, 'caja', mM, [s * 0.078, -L * 0.42, 0], [0.016, L * 0.5, 0.04]);
        K.M(p, 'caja', mC, [0, -L * 0.5, 0.085], [0.1, 0.024, 0.03]);
      }
    }
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
});

// ── legendaria ──
const S_legendaria = _t(() => {
const base = { ropa: '#0e1126', pantalon: '#0b0d1f', botas: '#080a18', acento: '#10f0fa', cinto: '#0b0d1f', hojaNeon: '#7df9ff' };
const CIAN = '#10f0fa', MAG = '#f01dfb', NOCHE = '#14183a', PLACA = '#1d2250', NARANJA = '#ff9a1f';

function pon(K, padre, D, C, G, esc) {
  if (D && D.length) K.MF(padre, D, null, null, null, esc);
  if (C && C.length) K.MF(padre, C, CIAN, { e: 1 }, null, esc);
  if (G && G.length) K.MF(padre, G, MAG, { e: 1 }, null, esc);
}
function aro(a, cx, cy, cz, R, t, lados, salto) {
  const n = lados || 8, largo = 2 * R * Math.tan(Math.PI / n) + t * 0.5;
  for (let i = 0; i < n; i += (salto || 1)) {
    const g = i / n * Math.PI * 2;
    a.push(['caja', null, [cx + Math.cos(g) * R, cy + Math.sin(g) * R, cz], [largo, t, t], [0, 0, g + Math.PI / 2]]);
  }
}

return {
  id: 'legendaria',
  base,
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza)), lig = ctx.ligero, sac = ctx.clase === 'sacerdote';
    const D = [
      ['caja', NOCHE, [0, 0.555, 0], [0.57, 0.07, 0.53]],                 /* casquete sobre el techo del cubo */
      ['caja', PLACA, [0, 0.61, -0.02], [0.3, 0.05, 0.4]],                /* lomo del casquete */
    ];
    const C = [
      ['caja', null, [0, 0.515, 0], [0.59, 0.025, 0.55]],                 /* filete cian que rodea la cabeza */
      ['caja', null, [0, 0.67, 0.04], [0.045, 0.09, 0.36]],               /* cresta, primer escalón */
    ];
    /* segundo escalón y punta de la cresta: el sacerdote no los lleva (ahí flota su halo) */
    if (!sac) C.push(['caja', null, [0, 0.745, -0.05], [0.045, 0.08, 0.24]], ['caja', null, [0, 0.815, -0.12], [0.045, 0.08, 0.13]]);
    const G = [
      ['caja', null, [0, 0.50, 0.262], [0.085, 0.085, 0.03], [0, 0, K.PI / 4]],   /* gema de la frente */
      ['caja', null, [0.215, sac ? 0.635 : 0.66, 0.03], [0.04, sac ? 0.08 : 0.12, 0.26], [0.25, 0, -0.3]],   /* aletas laterales (más bajas con halo) */
      ['caja', null, [-0.215, sac ? 0.635 : 0.66, 0.03], [0.04, sac ? 0.08 : 0.12, 0.26], [0.25, 0, 0.3]],
    ];
    /* nuca: circuito que se ve de espaldas (por dentro del pasillo de las espadas no hay nada) */
    C.push(['caja', null, [0, 0.27, -0.257], [0.03, 0.4, 0.02]]);
    G.push(['caja', null, [0, 0.2, -0.26], [0.09, 0.09, 0.02], [0, 0, K.PI / 4]]);
    if (!lig) {
      C.push(['caja', null, [0.14, 0.12, -0.257], [0.2, 0.025, 0.02]], ['caja', null, [-0.14, 0.12, -0.257], [0.2, 0.025, 0.02]]);
      G.push(['caja', null, [0.275, 0.14, 0.02], [0.02, 0.025, 0.34]], ['caja', null, [-0.275, 0.14, 0.02], [0.02, 0.025, 0.34]]);   /* sienes */
      if (!sac) C.push(['caja', null, [0.215, 0.74, -0.07], [0.03, 0.06, 0.1], [0.25, 0, -0.3]], ['caja', null, [-0.215, 0.74, -0.07], [0.03, 0.06, 0.1], [0.25, 0, 0.3]]);
    }
    pon(K, g, D, C, G, ctx.H);
    /* ojos naranjas encendidos (fundidos: no son mallas sueltas) */
    K.MF(g, [['caja', null, [0.12, 0.305, 0.268], [0.075, 0.075, 0.03]], ['caja', null, [-0.12, 0.305, 0.268], [0.075, 0.075, 0.03]]], NARANJA, { e: 1 }, null, ctx.H);
    return 'peluca';   /* casco cerrado por arriba: no se dibuja el peinado del jugador (taparía el circuito de la nuca) */
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero, k = W * P, PI = K.PI;
    const zf = 0.2 * P + 0.005, zl = zf + 0.03, zb = -zf, zbl = -zl;   /* placa del pecho / espalda y la cara donde va el dibujo */
    const D = [], C = [], G = [];
    D.push(['caja', NOCHE, [0, T * 0.62, zf], [0.36 * k, 0.3, 0.05]]);
    C.push(['caja', null, [0, T * 0.8, zl], [0.075, 0.075, 0.03], [0, 0, PI / 4]]);                       /* núcleo */
    C.push(['caja', null, [0.085 * k, T * 0.9, zl], [0.15 * k, 0.022, 0.02], [0, 0, 0.5]], ['caja', null, [-0.085 * k, T * 0.9, zl], [0.15 * k, 0.022, 0.02], [0, 0, -0.5]]);   /* cuello en V */
    G.push(['caja', null, [0.095 * k, T * 0.68, zl], [0.13 * k, 0.022, 0.02], [0, 0, -0.45]], ['caja', null, [-0.095 * k, T * 0.68, zl], [0.13 * k, 0.022, 0.02], [0, 0, 0.45]]);   /* pectorales */
    C.push(['caja', null, [0, T * 0.55, zl], [0.022, 0.13, 0.02]]);                                        /* esternón */
    if (!lig) G.push(['caja', null, [0.08 * k, T * 0.42, zl], [0.09 * k, 0.02, 0.02], [0, 0, 0.6]], ['caja', null, [-0.08 * k, T * 0.42, zl], [0.09 * k, 0.02, 0.02], [0, 0, -0.6]]);   /* costillas */
    D.push(['caja', NOCHE, [0, T * 0.6, zb], [0.38 * k, 0.34, 0.05]]);
    const yr = T * 0.66, zr = zbl - 0.035;
    D.push(['caja', PLACA, [0, yr, zbl - 0.012], [0.2, 0.2, 0.03], [0, 0, PI / 4]]);
    aro(C, 0, yr, zr, 0.2, 0.035, 8, lig ? 2 : 1);
    G.push(['caja', null, [0, yr, zr], [0.11, 0.11, 0.035], [0, 0, PI / 4]]);
    C.push(['caja', null, [0, T * 0.2, zbl], [0.03, 0.14, 0.02]]);
    C.push(['caja', null, [0, T * 0.17, 0], [0.5 * k, 0.025, 0.43 * P]]);
    G.push(['caja', null, [0, T * 0.17, 0.215 * P + 0.01], [0.07, 0.06, 0.03]]);
    for (const s of [1, -1]) {
      const z = s * 0.135, zz = s * 0.155;
      D.push(['caja', NOCHE, [0, -0.07, z], [0.17, 0.14, 0.03]], ['caja', NOCHE, [0, -0.14, z], [0.12, 0.12, 0.03], [0, 0, PI / 4]]);
      G.push(['caja', null, [0.047, -0.175, zz], [0.13, 0.022, 0.02], [0, 0, 0.785]], ['caja', null, [-0.047, -0.175, zz], [0.13, 0.022, 0.02], [0, 0, -0.785]]);
      if (!lig || s < 0) C.push(['caja', null, [0.03, -0.09, zz], [0.08, 0.02, 0.02], [0, 0, 0.6]], ['caja', null, [-0.03, -0.09, zz], [0.08, 0.02, 0.02], [0, 0, -0.6]]);
    }
    const sx = 0.216 * k + 0.09;
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        const a = 0.4 + i * 0.27, largo = 0.24 + i * 0.07;
        const x = s * (sx - 0.01 + i * 0.08 + Math.sin(a) * largo * 0.5), y = T * 0.9 + i * 0.02 + Math.cos(a) * largo * 0.5;
        (i === 1 ? C : G).push(['caja', null, [x, y, -0.02], [0.04, largo, 0.22 - i * 0.03], [0, 0, -s * a]]);
      }
    }
    pon(K, K.fuera(K.G(r.cuerpo)), D, C, G);
    const gr = (ctx.cpo.grueso || 1);
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const an = 0.15 * gr + 0.03;
      const d = [['caja', NOCHE, [s * 0.01, 0.02, 0], [0.19, 0.1, 0.24]]];
      const c = [['caja', null, [s * 0.01, -0.035, 0], [0.2, 0.022, 0.25]], ['caja', null, [0, -A + 0.07, 0], [an, 0.03, an]]];
      const m = [['caja', null, [0, -A + 0.14, 0], [an, 0.025, an]]];
      if (!lig) m.push(['caja', null, [s * (an * 0.5 - 0.01), -A * 0.42, 0], [0.02, 0.1, 0.03]]);
      pon(K, b, d, c, m);
    }
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      const c = [['caja', null, [0, -L * 0.5, 0], [0.19, 0.03, 0.19]], ['caja', null, [0, -(L - 0.125), 0.045], [0.19, 0.022, 0.28]]];
      const m = [['caja', null, [0, -L * 0.72, 0.09], [0.025, 0.1, 0.02]], ['caja', null, [0, -L * 0.72, -0.09], [0.025, 0.1, 0.02]]];
      if (!lig) m.push(['caja', null, [s * 0.09, -L * 0.28, 0], [0.02, 0.1, 0.03]]);
      pon(K, p, null, c, m);
    }
    const libre = ctx.clase !== 'guerrero' && ctx.arma !== 'dagas';
    if (!lig) {
      const g = K.piv(r, K.fuera(libre ? K.G(r.manoI, [0.03, -0.02, 0.03]) : K.G(ctx.clase === 'guerrero' ? r.bD : r.bI, [0, -A * 0.5, 0])));
      const R = libre ? 0.17 : 0.12, c = [], m = [];
      aro(c, 0, 0, 0, R, 0.03, 8);
      aro(m, 0, 0, 0, R + 0.05, 0.025, 8, 2);
      /* libre: aro de pie que gira como una moneda; ocupada: aro tumbado que gira alrededor del antebrazo (el guerrero, en el derecho: en el izquierdo atravesaría el escudo) */
      pon(K, libre ? g : K.G(g, [0, 0, 0], [PI / 2, 0, 0]), null, c, m);
      r.giran.push([g, libre ? 1.8 : 1.4]);
    } else if (libre) {
      const c = [];
      aro(c, 0, 0, 0, 0.15, 0.03, 4);
      K.MF(K.fuera(K.G(r.manoI, [0.03, -0.02, 0.03], [0, 0, PI / 4])), c, CIAN, { e: 1 });
    }
  },
};
});

// ── lobo ──
const S_lobo = _t(() => {
const PELO = '#8a4f24', PELO_O = '#5e3413', PELO_C = '#b06a32';
const ROJO = '#c9282b', GRANATE = '#6a1418', CREMA = '#fbf6ea';
const VAQUERO = '#2b3a66', FLECO = '#cdd2dc', GARRA = '#2b2228', ROSA = '#ef7f6e', PLATA = '#b8bcc4', CUERO = '#6b4226';
const base = { ropa: ROJO, mangas: '#8fd14f', pantalon: VAQUERO, botas: PELO, acento: PLATA, cinto: CUERO };

return {
  id: 'lobo',
  base,
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const ao = ctx.clase === 'sacerdote' ? 0.17 : 0.3;   /* orejas más bajas bajo el halo del sacerdote (está a 0.8) */
    const P = [
      ['caja', PELO, [0, 0.565, -0.01], [0.6, 0.11, 0.56]],            /* casquete */
      ['caja', PELO_C, [0.03, 0.645, 0.03], [0.42, 0.07, 0.36]],       /* copete */
      ['caja', PELO, [0, 0.38, -0.275], [0.6, 0.38, 0.07]],            /* nuca */
      ['caja', PELO_C, [-0.16, 0.36, -0.3], [0.14, 0.36, 0.05], [0, 0, 0.08]],   /* mechones claros de la melena */
      ['caja', PELO_C, [0.12, 0.4, -0.3], [0.12, 0.3, 0.05], [0, 0, -0.1]],
      ['caja', PELO_O, [0.01, 0.3, -0.305], [0.1, 0.3, 0.05]],
      ['caja', PELO, [0.13, 0.49, 0.262], [0.32, 0.09, 0.04], [0, 0, 0.16]],    /* flequillo ladeado */
      ['caja', PELO_O, [-0.18, 0.505, 0.262], [0.18, 0.05, 0.04], [0, 0, -0.2]],
      ['caja', PELO_C, [0.2, 0.47, 0.27], [0.12, 0.1, 0.04], [0, 0, 0.5]],
    ];
    for (const x of [-1, 1]) {
      P.push(['caja', PELO, [x * 0.288, 0.37, 0.13], [0.045, 0.3, 0.2]]);                               /* patilla */
      P.push(['cono4', PELO, [x * 0.3, 0.2, 0.12], [0.06, 0.16, 0.05], [0, 0, x * 2.2]]);               /* mechón de la mejilla */
      P.push(['cono4', PELO_C, [x * 0.19, 0.6, 0.04], [0.13, ao, 0.07], [0, 0, -x * 0.22]]);           /* oreja de lobo */
      P.push(['cono4', ROSA, [x * 0.19, 0.61, 0.075], [0.08, ao * 0.66, 0.045], [0, 0, -x * 0.22]]);
      P.push(['cono4', PELO_O, [x * 0.2, 0.2, -0.28], [0.1, 0.16, 0.05], [K.PI, 0, x * 0.25]]);         /* puntas de la nuca */
    }
    P.push(['cono4', PELO_O, [0, 0.18, -0.29], [0.11, 0.2, 0.05], [K.PI, 0, 0]]);
    if (!ctx.ligero) {
      P.push(['cono4', PELO_C, [0.02, 0.66, 0.1], [0.08, 0.16, 0.07], [0.5, 0, -0.5]]);                 /* mechones despeinados */
      P.push(['cono4', PELO, [-0.1, 0.64, -0.06], [0.07, 0.14, 0.07], [-0.3, 0, 0.5]]);
      P.push(['cono4', PELO, [0.06, 0.62, -0.26], [0.09, 0.2, 0.06], [-0.9, 0, -0.2]]);
      P.push(['cono4', PELO_O, [-0.14, 0.58, -0.27], [0.08, 0.17, 0.06], [-1.0, 0, 0.3]]);
    }
    K.MF(g, P, null, null, null, ctx.H);
    return 'peluca';
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, G = Math.max(1, ctx.cpo.grueso || 1);
    const fino = !ctx.ligero;
    const s = (y) => Math.sqrt(Math.max(0.05, 1 - Math.pow((y - T * 0.5) / (T * 0.58), 2)));   /* sección del torso a esa altura */
    const C = [
      ['esfera', CREMA, [0, T * 0.5, 0.022], [0.19 * W * P, T * 0.575, 0.22 * P + 0.004]],              /* camiseta */
    ];
    for (const y of [T * 0.34, T * 0.56, T * 0.78]) C.push(['cil', GRANATE, [0, y, 0], [0.27 * W * P * s(y) + 0.008, 0.032, 0.22 * P * s(y) + 0.008]]);
    for (const d of (fino ? [-0.15, 0, 0.15] : [0])) {
      const k = Math.sqrt(1 - Math.pow(d / 0.27, 2));
      C.push(['cil', GRANATE, [d * W * P, T * 0.5, 0], [T * 0.58 * k + 0.008, 0.032, 0.22 * P * k + 0.008], [0, 0, K.PI / 2]]);
    }
    const zc = 0.2 * P + 0.02, yc = T * 0.18;
    for (const x of [-1, 1]) {
      C.push(['caja', ROJO, [x * 0.085 * W * P, T * 0.86, zc - 0.02], [0.11, 0.05, 0.05], [0, 0, x * 0.5]]);     /* cuello de la camisa */
      C.push(['caja', GRANATE, [x * 0.115 * W * P, T * 0.52, zc + 0.012], [0.03, T * 0.5, 0.025], [0, 0, -x * 0.12]]);   /* canto de la camisa abierta */
      /* jirones del bajo, por delante, a los lados y por detrás */
      C.push(['caja', ROJO, [x * 0.17 * W * P, yc - 0.035, 0.15 * P], [0.1, 0.13, 0.04], [0, 0, x * 0.1]]);
      C.push(['caja', ROJO, [x * 0.245 * W * P, yc - 0.02, 0], [0.04, 0.12, 0.2 * P]]);
      C.push(['caja', ROJO, [x * 0.13 * W * P, yc - 0.03, -0.19 * P], [0.11, 0.14, 0.04]]);
      if (fino) {
        C.push(['caja', FLECO, [x * 0.17 * W * P, yc - 0.105, 0.15 * P], [0.07, 0.025, 0.035]]);
        C.push(['caja', GRANATE, [x * 0.13 * W * P, yc - 0.03, -0.19 * P - 0.012], [0.03, 0.14, 0.03]]);
      }
    }
    C.push(['caja', GRANATE, [0, yc - 0.01, -0.2 * P], [0.1, 0.1, 0.04]]);
    C.push(['caja', PLATA, [0, yc, 0.19 * P + 0.02], [0.11, 0.08, 0.03]]);                               /* hebilla */
    C.push(['caja', CUERO, [0, yc, 0.19 * P + 0.03], [0.06, 0.036, 0.02]]);
    K.MF(r.cuerpo, C);

    /* Cola: en calidad normal se menea (1 pivote nuevo); en ligera va fija a la cadera. */
    const gc = K.fuera(K.G(r.cuerpo, [0, 0.07, -0.17 * P], [0, 0, -0.55]));
    if (fino) { K.piv(r, gc); r.cola = gc; }
    const Q = [
      ['caja', PELO, [0, 0.02, -0.08], [0.12, 0.12, 0.18], [0.3, 0, 0]],
      ['caja', PELO, [0, 0.1, -0.21], [0.18, 0.18, 0.2], [0.7, 0, 0]],
      ['caja', PELO_O, [0, 0.24, -0.3], [0.21, 0.22, 0.19], [1.1, 0, 0]],
      ['caja', PELO_C, [0, 0.39, -0.33], [0.14, 0.16, 0.14], [1.4, 0, 0]],
    ];
    if (fino) {
      Q.push(['cono4', PELO_C, [0, 0.46, -0.33], [0.08, 0.13, 0.08]]);
      Q.push(['cono4', PELO, [0, 0.12, -0.33], [0.07, 0.14, 0.07], [-1.9, 0, 0]]);
    }
    K.MF(gc, Q);

    for (const [b, x] of [[r.bI, 1], [r.bD, -1]]) {
      const B = [
        ['caja', ROJO, [0, -0.045, 0], [0.2 * G, 0.15, 0.2 * G]],                                       /* manga corta */
        ['caja', GRANATE, [0, -0.06, 0], [0.208 * G, 0.03, 0.208 * G]],
        ['caja', PELO, [0, -A * 0.74, 0], [0.19 * G, 0.19, 0.19 * G]],                                   /* antebrazo peludo */
        ['cono4', PELO_O, [x * 0.08 * G, -A * 0.56, -0.03], [0.06, 0.13, 0.06], [0, 0, -x * 2.0]],       /* mechón del codo */
      ];
      if (fino) {
        B.push(['caja', FLECO, [x * 0.03, -0.13, 0.06 * G], [0.08, 0.03, 0.09]]);
        B.push(['cono4', PELO_C, [x * 0.085 * G, -A * 0.82, 0.03], [0.05, 0.11, 0.05], [0, 0, -x * 2.2]]);
      }
      K.MF(b, B);
    }
    if (fino) for (const [m, x] of [[r.manoI, 1], [r.manoD, -1]]) {
      const N = [];
      for (const d of [-0.05, 0, 0.05]) N.push(['cono4', GARRA, [d, -0.07, 0.07], [0.022, 0.07, 0.022], [2.4, 0, 0]]);
      K.MF(m, N);
    }
    for (const [p, x] of [[r.pI, 1], [r.pD, -1]]) {
      const J = [
        ['caja', PELO, [0, -L + 0.14, 0.005], [0.19 * G, 0.13, 0.2 * G]],                                 /* pierna peluda */
        ['caja', FLECO, [0, -L + 0.215, 0], [0.2 * G, 0.03, 0.2 * G]],                                   /* flecos del vaquero cortado */
        ['caja', VAQUERO, [x * 0.04, -L + 0.2, 0.02], [0.13 * G, 0.06, 0.21 * G]],
        ['caja', PELO, [0, -L + 0.055, 0.06], [0.22, 0.11, 0.32]],                                       /* pata */
        ['cono4', PELO_O, [x * 0.1 * G, -L + 0.17, -0.04], [0.06, 0.12, 0.06], [0, 0, -x * 2.0]],
      ];
      for (const d of [-0.075, 0, 0.075]) J.push(['cono4', GARRA, [d, -L + 0.035, 0.2], [0.03, 0.1, 0.035], [K.PI / 2, 0, 0]]);
      if (fino) {
        J.push(['caja', '#8fd14f', [-x * 0.02, -L + 0.33, 0.085 * G], [0.08, 0.05, 0.02]]);              /* roto de la rodilla */
        J.push(['caja', FLECO, [-x * 0.02, -L + 0.362, 0.087 * G], [0.1, 0.018, 0.02]]);
        J.push(['cono4', PELO_O, [0, -L + 0.14, -0.1 * G], [0.06, 0.12, 0.05], [-2.0, 0, 0]]);
      }
      K.MF(p, J);
    }
  },
};
});

// ── momia ──
const S_momia = _t(() => {
const base = { ropa: '#8fd14f', pantalon: '#8fd14f', botas: '#fff6dc', acento: '#f0dcb0', cinto: '#fff6dc' };
const V1 = '#fff6dc', V2 = '#f0dcb0', V3 = '#d0b684', MANCHA = '#a98a5c', GARRA = '#17131c';

return {
  id: 'momia',
  base,
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', V1, [0, 0.548, 0], [0.585, 0.07, 0.545]],
      ['caja', V2, [0, 0.49, 0], [0.6, 0.065, 0.56], [0, 0, 0.07]],
      ['caja', V1, [0, 0.385, -0.105], [0.59, 0.1, 0.35], [0, 0, -0.05]],
      ['caja', V2, [0, 0.262, -0.105], [0.6, 0.105, 0.36], [0, 0, 0.045]],
      ['caja', V1, [0, 0.135, -0.105], [0.59, 0.1, 0.35], [0, 0, -0.04]],
      ['caja', V1, [0, 0.03, 0], [0.585, 0.055, 0.545], [0, 0, 0.03]],
      ['caja', V2, [0, -0.012, 0], [0.5, 0.05, 0.46]],
      ['caja', V1, [0.34, 0.575, -0.2], [0.2, 0.055, 0.085], [0, 0, -0.75]],
      ['caja', V1, [-0.34, 0.575, -0.2], [0.2, 0.055, 0.085], [0, 0, 0.75]],
      ['caja', V2, [0.5, 0.735, -0.2], [0.2, 0.055, 0.085], [0, 0, -0.75]],
      ['caja', V2, [-0.5, 0.735, -0.2], [0.2, 0.055, 0.085], [0, 0, 0.75]],
      ['caja', V1, [-0.17, 0.0, -0.3], [0.075, 0.26, 0.02], [0.12, 0, 0.1]],
    ];
    if (!ctx.ligero) {
      P.push(['caja', V2, [0, 0.52, 0.005], [0.61, 0.05, 0.565], [0, 0, -0.16]]);          // venda cruzada sobre la frente
      P.push(['caja', V3, [-0.17, -0.15, -0.318], [0.05, 0.06, 0.02], [0.12, 0, 0.1]]);    // punta rota de la tira de la nuca
      P.push(['caja', V2, [0.295, 0.2, 0.0], [0.02, 0.2, 0.07], [0, 0, -0.12]]);           // tira que cuelga junto a la oreja
      P.push(['caja', MANCHA, [0.1, 0.262, -0.287], [0.1, 0.05, 0.012]]);                  // mancha en la nuca
    }
    K.MF(g, P, null, null, null, ctx.H);
    return 'peluca';   /* una momia no lleva el peinado del jugador asomando entre las vendas */
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, gr = ctx.cpo.grueso || 1;
    const lig = !!ctx.ligero;
    const cy = T * 0.5, ry = T * 0.58;
    const aro = (y, h, c, rz, rx) => {
      const f = Math.sqrt(Math.max(0.12, 1 - ((y - cy) / ry) ** 2));
      return ['cil', c, [0, y, 0], [0.27 * W * P * f + 0.014, h, 0.22 * P * f + 0.014], [rx || 0, 0, rz || 0]];
    };
    const C = lig ? [
      aro(T * 0.12, 0.1, V2, 0.06),
      aro(T * 0.4, 0.13, V1, -0.08),
      aro(T * 0.68, 0.11, V2, 0.07),
      aro(T * 0.9, 0.09, V1, -0.05),
    ] : [
      aro(T * 0.1, 0.075, V2, 0.07),
      aro(T * 0.29, 0.08, V1, -0.1),
      aro(T * 0.48, 0.08, V2, 0.09, 0.05),
      aro(T * 0.67, 0.08, V1, -0.09),
      aro(T * 0.84, 0.07, V2, 0.08),
      aro(T * 0.97, 0.06, V1, -0.04),
    ];
    C.push(['cil', V1, [0, T * 0.56, 0], [0.285 * W * P, 0.07, 0.238 * P], [0, 0, 0.6]]);
    C.push(['cil', V1, [0, T * 0.56, 0], [0.285 * W * P, 0.07, 0.238 * P], [0, 0, -0.6]]);
    C.push(['caja', V1, [0, 0.045, 0], [0.36 * W, 0.075, 0.25]]);
    C.push(['caja', V2, [0, -0.04, 0], [0.355 * W, 0.06, 0.24], [0, 0, 0.05]]);
    C.push(['caja', V1, [0.15 * W, -0.11, 0.125], [0.06, 0.2, 0.014], [-0.12, 0, 0.1]]);
    C.push(['caja', V2, [-0.16 * W, -0.09, -0.125], [0.06, 0.17, 0.014], [0.14, 0, -0.12]]);
    if (!lig) {
      C.push(['caja', V3, [0.165 * W, -0.225, 0.14], [0.04, 0.05, 0.014], [-0.12, 0, 0.1]]);       // punta rota
      C.push(['caja', MANCHA, [-0.07 * W * P, T * 0.3, 0.215 * P + 0.012], [0.07, 0.04, 0.012]]);   // manchas de tierra
      C.push(['caja', MANCHA, [0.09 * W * P, T * 0.47, -(0.215 * P + 0.012)], [0.08, 0.04, 0.012]]);
    } else {
      C.push(['caja', V1, [0.04, -0.14, -0.13], [0.07, 0.3, 0.014], [0.16, 0, -0.06]]);            // la venda larga de la espalda, fija
    }
    K.fuera(K.MF(r.cuerpo, C));

    if (!lig) {
      const g = K.piv(r, K.fuera(K.G(r.cuerpo, [0.04, 0.02, -0.125])));
      K.MF(g, [
        ['caja', V1, [0, -0.13, -0.02], [0.07, 0.26, 0.014], [0.16, 0, 0]],
        ['caja', V2, [0.012, -0.3, -0.06], [0.055, 0.12, 0.014], [0.4, 0, 0.12]],
        ['caja', V3, [0.022, -0.375, -0.09], [0.035, 0.05, 0.014], [0.4, 0, 0.12]],
      ]);
      r.cola = g;
      if (r.colaAmp == null) r.colaAmp = 0.3;
    }

    const rb = 0.068 * gr + 0.016;
    for (const [b, mano, s] of [[r.bI, r.manoI, 1], [r.bD, r.manoD, -1]]) {
      const B = [['esferaB', V1, [0, -0.005, 0], [0.115, 0.1, 0.115]]];
      if (lig) {
        B.push(['cil', V2, [0, -A * 0.36, 0], [rb, 0.12, rb], [0, 0, 0.14 * s]]);
        B.push(['cil', V1, [0, -A * 0.78, 0], [rb, 0.13, rb], [0, 0, -0.12 * s]]);
      } else {
        B.push(['cil', V2, [0, -A * 0.28, 0], [rb, 0.07, rb], [0, 0, 0.2 * s]]);
        B.push(['cil', V1, [0, -A * 0.49, 0], [rb, 0.065, rb], [0.15, 0, -0.18 * s]]);
        B.push(['cil', V2, [0, -A * 0.69, 0], [rb, 0.065, rb], [-0.12, 0, 0.2 * s]]);
        B.push(['cil', V1, [0, -A * 0.89, 0], [rb * 0.96, 0.065, rb * 0.96], [0, 0, -0.14 * s]]);
      }
      B.push(['caja', V1, [s * (rb + 0.045), -A * 0.5 - 0.1, -0.01], [0.016, 0.24, 0.08], [0, 0, 0.32 * s]]);
      if (!lig) {
        B.push(['caja', V3, [s * (rb + 0.09), -A * 0.5 - 0.235, -0.01], [0.016, 0.05, 0.045], [0, 0, 0.32 * s]]);
        B.push(['caja', V2, [0, -A * 0.89 - 0.09, -(rb + 0.01)], [0.065, 0.2, 0.016], [0.14, 0, 0]]);
      }
      K.fuera(K.MF(b, B));
      if (!lig) {
        K.fuera(K.MF(mano, [-0.045, 0, 0.045].map(x => ['cono', GARRA, [x, -0.06, 0.045], [0.02, 0.07, 0.02], [K.PI - 0.45, 0, 0]])));
      }
    }

    const rp = 0.085 * gr + 0.016, wb = 0.17 * gr + 0.02;
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      if (!p) continue;
      const Q = [];
      if (lig) {
        Q.push(['cil', V1, [0, -L * 0.22, 0], [rp, 0.13, rp], [0, 0, 0.1 * s]]);
        Q.push(['cil', V2, [0, -L * 0.58, 0], [rp * 0.94, 0.13, rp * 0.94], [0, 0, -0.1 * s]]);
      } else {
        Q.push(['cil', V1, [0, -L * 0.11, 0], [rp, 0.075, rp], [0, 0, 0.14 * s]]);
        Q.push(['cil', V2, [0, -L * 0.3, 0], [rp * 0.97, 0.07, rp * 0.97], [0.12, 0, -0.16 * s]]);
        Q.push(['cil', V1, [0, -L * 0.48, 0], [rp * 0.94, 0.07, rp * 0.94], [-0.1, 0, 0.15 * s]]);
        Q.push(['cil', V2, [0, -L * 0.66, 0], [rp * 0.9, 0.065, rp * 0.9], [0, 0, -0.12 * s]]);
      }
      Q.push(['caja', V2, [0, -(L - 0.064), 0.0], [wb, 0.122, 0.07], [0, 0.35 * s, 0]]);
      Q.push(['caja', V3, [0, -(L - 0.064), 0.105], [wb, 0.122, 0.05], [0, -0.3 * s, 0]]);
      if (!lig) {
        Q.push(['caja', base.ropa, [0, -(L - 0.118), 0.055], [wb * 0.8, 0.016, 0.03], [0, 0.2 * s, 0]]);
        Q.push(['caja', V1, [s * (rp + 0.03), -L * 0.48 - 0.08, -0.02], [0.016, 0.17, 0.07], [0, 0, 0.28 * s]]);
      }
      K.fuera(K.MF(p, Q));
    }
  },
};
});

// ── necro ──
const S_necro = _t(() => {
const TUNICA = '#34195e', TUNICA2 = '#27114a', NOCHE = '#190b30', VIOLETA = '#7c3aed', LILA = '#b98cff';
const FUEGO = '#5b21b6';
const MAGENTA = '#e24bff', NUCLEO = '#ffe0ff', HUESO = '#a99dab', HUESO2 = '#6f6474', NEGRO = '#0c0614';

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

return {
  id: 'necro',
  base,
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
});

// ── pirata ──
const S_pirata = _t(() => {
const base = { ropa: '#4b2c1b', mangas: '#efe4c8', pantalon: '#4a2d1c', botas: '#7a4526', acento: '#e8a91e', cinto: '#cf1f2a' };
const NEGRO = '#241815', NEGRO2 = '#342a2a', ORO = '#f0b223', HUESO = '#f1e3c2', ROJO = '#d81f2a', ROJO2 = '#a51420';
const CREMA = '#efe4c8', CUERO = '#7a4526', CUERO2 = '#5a3220', SUELA = '#d9a45c', ACERO = '#b9bfc8';

return {
  id: 'pirata',
  base,
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const lig = ctx.ligero, a = 1.08;
    const P = [
      ['caja', ROJO, [0, 0.485, 0], [0.575, 0.1, 0.535]],
      ['caja', ROJO, [0.33, 0.47, 0.1], [0.1, 0.11, 0.12]],
      ['caja', ROJO, [0.37, 0.33, 0.13], [0.07, 0.24, 0.09], [0, 0, 0.3]],
      ['caja', ROJO2, [0.44, 0.36, 0.06], [0.06, 0.2, 0.08], [0, 0, 0.75]],
      ['caja', NEGRO, [0, 0.555, 0.2], [0.92, 0.05, 0.32]],
      ['caja', NEGRO, [0, 0.555, -0.1], [0.62, 0.05, 0.3]],
      ['caja', NEGRO, [0, 0.555, -0.36], [0.28, 0.05, 0.24]],
      ['caja', NEGRO, [0, 0.64, -0.03], [0.42, 0.15, 0.4]],
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
      ['caja', NEGRO, [0.23, 0.64, -0.07], [0.96, 0.14, 0.06], [0, -a, 0]],
      ['caja', NEGRO, [-0.23, 0.64, -0.07], [0.96, 0.14, 0.06], [0, a, 0]],
      ['caja', ORO, [0.23, 0.722, -0.07], [0.98, 0.032, 0.075], [0, -a, 0]],
      ['caja', ORO, [-0.23, 0.722, -0.07], [0.98, 0.032, 0.075], [0, a, 0]],
      ['caja', HUESO, [0, 0.745, 0.4], [0.17, 0.13, 0.03]],
      ['caja', HUESO, [0, 0.67, 0.4], [0.1, 0.05, 0.03]],
      ['caja', HUESO, [0, 0.7, 0.395], [0.42, 0.04, 0.02], [0, 0, 0.5]],
      ['caja', HUESO, [0, 0.7, 0.395], [0.42, 0.04, 0.02], [0, 0, -0.5]],
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
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.02), yC = T * 0.19;
    const C = [
      ['caja', CREMA, [0, T * 0.68, zP - 0.005], [0.15 * W * P, T * 0.44, 0.03]],
      ['caja', CREMA, [0, T * 0.95, 0], [0.24, 0.06, 0.22]],
      ['caja', ORO, [0.085 * W * P, T * 0.66, zP], [0.028, T * 0.48, 0.035], [0, 0, -0.12]],
      ['caja', ORO, [-0.085 * W * P, T * 0.66, zP], [0.028, T * 0.48, 0.035], [0, 0, 0.12]],
      ['caja', CUERO, [0, T * 0.62, zP + 0.02], [0.075, 0.42 * W, 0.025], [0, 0, -0.89]],
      ['caja', CUERO, [0, T * 0.62, zE - 0.01], [0.085, 0.44 * W, 0.03], [0, 0, -0.89]],
      ['caja', ORO, [0, T * 0.62, zP + 0.035], [0.11, 0.11, 0.02], [0, 0, -0.89]],
      ['cil', ROJO, [0, yC, 0], [0.252 * W * P, 0.13, 0.206 * P]],
      ['cil', CUERO2, [0, yC, 0], [0.264 * W * P, 0.06, 0.218 * P]],
      ['caja', ORO, [0, yC, 0.218 * P + 0.005], [0.12, 0.1, 0.03]],
      ['caja', CUERO2, [0, yC, 0.218 * P + 0.012], [0.06, 0.045, 0.03]],
      ['caja', ROJO, [-0.2 * W * P, yC, -(0.15 * P + 0.03)], [0.11, 0.1, 0.1]],
      ['caja', ROJO, [-0.15 * W, -0.05, -(0.17 * P + 0.05)], [0.12, 0.32, 0.03], [0.25, 0, 0.12]],
      ['caja', ROJO2, [-0.25 * W, -0.02, -(0.15 * P + 0.05)], [0.11, 0.26, 0.03], [0.25, 0, -0.3]],
    ];
    if (!lig) C.push(
      ['caja', CUERO2, [0, T * 0.62, zP + 0.04], [0.055, 0.055, 0.02], [0, 0, -0.89]],
      ['caja', CUERO, [-0.13 * W, 0.0, 0.14], [0.1, 0.1, 0.06]],
      ['caja', CUERO2, [-0.13 * W, 0.035, 0.145], [0.11, 0.04, 0.065]],
      ['cil', ORO, [-0.02 * W, -0.035, 0.135], [0.042, 0.02, 0.042], [K.PI / 2, 0, 0]],
      ['caja', ORO, [0, T * 0.34, zE + 0.012], [0.36 * W * P, 0.025, 0.02]],
    );
    K.MF(r.cuerpo, C);

    for (const b of [r.bI, r.bD]) {
      K.MF(b, [
        ['caja', CREMA, [0, -A * 0.5, 0], [0.165, A * 0.5, 0.165]],
        ['caja', CREMA, [0, -A + 0.07, 0], [0.19, 0.06, 0.19]],
      ]);
    }

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
});

// ── solar ──
const S_solar = _t(() => {
const base = { ropa: '#d9730b', mangas: '#c2410c', pantalon: '#7c2d12', botas: '#8a3a0c', acento: '#fbbf24', cinto: '#b91c1c', hojaNeon: '#fde68a' };
const ORO = '#f5a81f', ORO2 = '#ffdc48', NARANJA = '#ea580c', CAPA = '#f0620f', ROJO = '#b91c1c', CREMA = '#fff1c9';

function solPlano(y, z, R, largo) {
  const O = [], O2 = [['cil', null, [0, y, z - 0.012], [R, 0.03, R], [Math.PI / 2, 0, 0]]];
  for (let i = 0; i < 4; i++) O.push(['caja', null, [0, y, z], [(R + largo) * 2, R * 0.42, 0.02], [0, 0, i * Math.PI / 4]]);
  return [O, O2];
}

return {
  id: 'solar',
  base,
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
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const mO = K.mat(ORO, { e: 0.4 }), mO2 = K.mat(ORO2, { e: 0.55 }), mN = K.mat(NARANJA, { e: 0.6 });
    const zP = 0.2 * P + 0.02;
    const tela = [
      ['caja', ROJO, [0, T * 0.2, 0], [0.5 * W * P, 0.08, 0.42 * P]],
      ['caja', NARANJA, [0, 0.0, 0], [0.47 * W * P, 0.15, 0.4 * P]],
      ['caja', ROJO, [0, -0.1, zP - 0.005], [0.14, 0.2, 0.025]],
    ];
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
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      K.M(b, 'caja', mO, [s * 0.02, 0.04, 0], [0.23, 0.065, 0.26], [0, 0, s * 0.2]);
      K.M(b, 'caja', mO2, [s * 0.035, 0.082, 0], [0.15, 0.035, 0.18], [0, 0, s * 0.2]);
      K.M(b, 'caja', mO, [0, -A + 0.095, 0], [0.165, 0.11, 0.165]);
      K.M(b, 'caja', mO2, [0, -A + 0.045, 0], [0.18, 0.025, 0.18]);
      if (!lig) K.M(b, 'caja', ROJO, [s * 0.03, -0.01, 0], [0.19, 0.035, 0.22]);
    }
    for (const p of [r.pI, r.pD]) {
      K.M(p, 'caja', mO, [0, -L + 0.2, 0.01], [0.185, 0.15, 0.2]);
      K.M(p, 'caja', mO2, [0, -L + 0.125, 0.04], [0.19, 0.025, 0.28]);
      if (!lig) K.M(p, 'caja', mO2, [0, -L + 0.27, 0.105], [0.09, 0.07, 0.03]);
    }
    if (!lig) {
      const g = K.piv(r, K.fuera(K.G(r.cuerpo, [-0.44, T + 0.24, 0.05])));
      const sol = [['icos', null, [0, 0, 0], 0.075]];
      for (let i = 0; i < 4; i++) sol.push(['caja', null, [0, 0, 0], [0.3, 0.035, 0.035], [0, i * K.PI / 4, 0]]);
      K.MF(g, sol, K.mat('#facc15', { e: 1 })).userData.sinFlash = true;
      r.giran.push([g, 1.6]);
    }
  },
};
});

// ── sombra ──
const S_sombra = _t(() => {
const NOCHE = '#1b1336', TRAJE = '#3d2f78', PLACA = '#7d74b4', PLACA2 = '#544a8c', CAPA = '#5b3fc4', CAPA2 = '#3b2788';
const VIOLETA = '#7c4fe0', LILA = '#a78bfa', LUZ = '#c4b5fd', NUCLEO = '#f3eeff', HUMO = '#7c3aed';

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

return {
  id: 'sombra',
  base,
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
});

// ── tactico ──
const S_tactico = _t(() => {
const base = { ropa: '#174a2a', pantalon: '#141d19', botas: '#0d1410', acento: '#39ff6a', cinto: '#0c2414' };
const NEON = '#39ff6a', TELA = '#174a2a', TELA2 = '#0e2e1a', GRIS = '#8a939c', GRIS2 = '#444b54', VIDRIO = '#0c3a1e';

return {
  id: 'tactico',
  base,
  cabeza(r, K, ctx) {
    const H = ctx.H, lig = ctx.ligero;
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      ['caja', TELA, [0, 0.565, -0.02], [0.61, 0.1, 0.56]],
      ['caja', TELA2, [0, 0.535, 0.245], [0.61, 0.05, 0.05]],
      ['caja', TELA, [0, 0.635, -0.07], [0.46, 0.06, 0.4]],
      ['caja', TELA, [0, 0.29, -0.285], [0.6, 0.56, 0.08]],
      ['caja', TELA, [0.292, 0.46, -0.03], [0.045, 0.14, 0.5]],
      ['caja', TELA, [-0.292, 0.46, -0.03], [0.045, 0.14, 0.5]],
      ['caja', TELA, [0.292, 0.2, -0.2], [0.045, 0.38, 0.14]],
      ['caja', TELA, [-0.292, 0.2, -0.2], [0.045, 0.38, 0.14]],
      ['caja', GRIS, [0, 0.4, 0.29], [0.52, 0.05, 0.1]],
      ['caja', GRIS, [0, 0.225, 0.29], [0.52, 0.045, 0.1]],
      ['caja', GRIS, [0.25, 0.312, 0.275], [0.06, 0.2, 0.13]],
      ['caja', GRIS, [-0.25, 0.312, 0.275], [0.06, 0.2, 0.13]],
      ['caja', GRIS2, [0, 0.312, 0.285], [0.035, 0.13, 0.08]],
      ['caja', GRIS2, [0.288, 0.4, 0.12], [0.03, 0.06, 0.24]],
      ['caja', GRIS2, [-0.288, 0.4, 0.12], [0.03, 0.06, 0.24]],
    ];
    K.MF(g, P, null, null, null, H);
    const N = [
      ['caja', null, [0, 0.4, 0.345], [0.44, 0.018, 0.02]],
      ['caja', null, [0.3, 0.312, 0.3], [0.02, 0.1, 0.05]],
      ['caja', null, [-0.3, 0.312, 0.3], [0.02, 0.1, 0.05]],
    ];
    const cols = lig ? [-0.19, 0, 0.19] : [-0.21, -0.07, 0.07, 0.21];
    cols.forEach((x, c) => {
      for (let f = 0; f < 4; f++) {
        if ((c * 3 + f * 5) % 4 === 0) continue;
        N.push(['caja', null, [x, 0.49 - f * 0.125, -0.33], [0.06, (c + f) % 3 === 0 ? 0.085 : 0.045, 0.02]]);
      }
    });
    if (!lig) {
      N.push(['caja', null, [0.06, 0.335, 0.41], [0.3, 0.02, 0.12]]);
      N.push(['caja', null, [-0.05, 0.3, 0.5], [0.2, 0.016, 0.12]]);
      N.push(['caja', null, [0.08, 0.34, 0.61], [0.1, 0.014, 0.08]]);
    }
    K.MF(g, N, K.mat(NEON, { e: 1 }), null, null, H);
    if (!lig) {
      const v = K.M(g, 'caja', K.mat(VIDRIO, { e: 0.35, op: 0.5 }), [0, 0.312 * H, 0.315 * H], [0.45 * H, 0.13 * H, 0.03 * H]);
      v.userData.sinFlash = true;
    }
    return 'peluca';   /* la capucha lo tapa todo: no se dibuja el pelo del jugador (el moño asomaba por la nuca) */
  },
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02;
    const zs = (x, y) => {
      const a = x / (0.27 * W * P), b = (y - T * 0.5) / (T * 0.58);
      return 0.22 * P * Math.sqrt(Math.max(0.08, 1 - a * a - b * b));
    };
    K.MF(r.cuerpo, [
      ['caja', TELA2, [0, T * 0.1, 0], [0.56 * W * P, 0.07, 0.46 * P]],                    /* bajo elástico */
      ['caja', TELA2, [0, T * 0.3, zP - 0.005], [0.3 * W * P, 0.12, 0.04]],                /* bolsillo canguro */
      ['caja', TELA, [0, T * 0.93, -0.1], [0.4 * W, 0.11, 0.2]],                           /* capucha recogida en la nuca */
      ['caja', TELA, [0.13 * W, T * 0.93, 0.03], [0.1, 0.09, 0.26]],                       /* cuello de la capucha */
      ['caja', TELA, [-0.13 * W, T * 0.93, 0.03], [0.1, 0.09, 0.26]],
    ]);
    const N = [
      ['caja', null, [0.05, T * 0.74, zs(0.05, T * 0.74) + 0.012], [0.016, 0.13, 0.016]],  /* cordones */
      ['caja', null, [-0.05, T * 0.72, zs(0.05, T * 0.72) + 0.012], [0.016, 0.16, 0.016]],
      ['caja', null, [0, T * 0.37, zP + 0.018], [0.3 * W * P, 0.014, 0.012]],              /* filo del bolsillo */
    ];
    const colsF = lig ? [-0.15, 0.15] : [-0.17, -0.105, 0.105, 0.17];
    colsF.forEach((cx, c) => {
      const x = cx * W * P;
      for (let f = 0; f < 4; f++) {
        if ((c * 3 + f * 5) % 4 === 1) continue;
        const y = T * (0.47 + f * 0.105);
        N.push(['caja', null, [x, y, zs(x, y) + 0.004], [0.034, (c + f) % 3 === 0 ? 0.04 : 0.022, 0.02]]);
      }
    });
    const colsB = lig ? [-0.14, 0, 0.14] : [-0.18, -0.09, 0, 0.09, 0.18];
    colsB.forEach((cx, c) => {
      const x = cx * W * P;
      for (let f = 0; f < 5; f++) {
        if ((c * 3 + f * 5) % 4 === 0) continue;
        const y = T * (0.24 + f * 0.125);
        N.push(['caja', null, [x, y, -(zs(x, y) + 0.004)], [lig ? 0.05 : 0.04, (c + f) % 3 === 0 ? 0.045 : 0.025, 0.02]]);
      }
    });
    K.MF(r.cuerpo, N, K.mat(NEON, { e: 1 }));
    const mN = K.mat(NEON, { e: 1 });
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      K.M(b, 'caja', TELA2, [0, -A + 0.06, 0], [0.17, 0.06, 0.17]);
      const M2 = [
        ['caja', null, [s * 0.082, -A * 0.3, 0], [0.02, 0.04, 0.04]],
        ['caja', null, [s * 0.082, -A * 0.6, 0.01], [0.02, 0.025, 0.04]],
      ];
      if (!lig) M2.push(['caja', null, [0, -A * 0.45, -0.082], [0.04, 0.035, 0.02]], ['caja', null, [s * 0.03, -A * 0.18, 0.082], [0.04, 0.022, 0.02]]);
      K.MF(b, M2, mN);
    }
    for (const p of [r.pI, r.pD]) K.M(p, 'caja', mN, [0, -L + 0.012, 0.05], [0.185, 0.022, 0.31]);
    if (ctx.clase !== 'guerrero' && ctx.arma !== 'dagas') {
      const g = K.fuera(K.G(r.cuerpo, [0.14, T * 0.42, 0.2 * P + 0.24], [0.45, 0, 0]));
      const TK = [
        ['caja', null, [0, 0, 0.085], [0.44, 0.02, 0.014]],
        ['caja', null, [0, 0, -0.085], [0.44, 0.02, 0.014]],
        ['caja', null, [0.213, 0, 0], [0.014, 0.02, 0.16]],
        ['caja', null, [-0.213, 0, 0], [0.014, 0.02, 0.16]],
      ];
      if (lig) {
        for (const z of [-0.045, 0, 0.045]) TK.push(['caja', null, [0, 0.008, z], [0.36, 0.012, 0.022]]);
      } else {
        [-0.048, -0.004, 0.04].forEach((z, f) => {
          const n = f === 2 ? 3 : 5, an = f === 2 ? [0.07, 0.2, 0.07] : null;
          for (let k = 0; k < n; k++) {
            const w = an ? an[k] : 0.06, x = an ? [-0.15, 0, 0.15][k] : (k - 2) * 0.078;
            TK.push(['caja', null, [x, 0.008, z], [w, 0.012, 0.026]]);
          }
        });
      }
      K.MF(g, TK, K.mat(NEON, { e: 1 }), null, null, 1.2);
      if (lig) K.M(g, 'caja', K.mat('#0f5a2a', { e: 0.5 }), [0, -0.005, 0], [0.5, 0.012, 0.19]);
      else K.M(g, 'caja', K.mat('#1fae4c', { e: 0.7, op: 0.45 }), [0, -0.005, 0], [0.5, 0.012, 0.19]).userData.sinFlash = true;   /* malla suelta 2 */
    }
    if (!lig) {
      const g = K.piv(r, K.fuera(K.G(r.raiz, [0, 0, 0])));
      const S = [];
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4, rad = 0.5 + (k % 3) * 0.07, y = 0.22 + ((k * 5) % 7) * 0.17;
        S.push(['caja', null, [Math.cos(a) * rad, y, Math.sin(a) * rad], [0.035, k % 2 ? 0.035 : 0.07, 0.035]]);
      }
      K.MF(g, S, K.mat(NEON, { e: 1 }));
      r.giran.push([g, 0.5]);
    }
  },
};
});

// ── vampiro ──
const S_vampiro = _t(() => {
const base = { ropa: '#262030', pantalon: '#221c2b', botas: '#17121c', acento: '#e3b23c', cinto: '#17121c' };
const NEGRO = '#262030', PELO = '#17131f', BRILLO = '#5d5680', ROJO = '#d3142c', FORRO = '#b40f24';
const PLIEGUE = '#1a1522';
const GRANATE = '#8a1320', GRANATE2 = '#6a0d18', ORO = '#e8b93e', BLANCO = '#f4efe6', HUESO = '#d9d2c4', GEMA = '#ff2b3f';

return {
  id: 'vampiro',
  base,
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
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, PI = K.PI, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02, WP = W * P;

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
});

export const SKINS3D = {
  berserker: S_berserker,
  bruja: S_bruja,
  comun: S_comun,
  cosmico: S_cosmico,
  esmeralda: S_esmeralda,
  esqueleto: S_esqueleto,
  frankenstein: S_frankenstein,
  king: S_king,
  legendaria: S_legendaria,
  lobo: S_lobo,
  momia: S_momia,
  necro: S_necro,
  pirata: S_pirata,
  solar: S_solar,
  sombra: S_sombra,
  tactico: S_tactico,
  vampiro: S_vampiro,
};
