// Traje 3D de la skin «berserker» (Berserker (el juez)). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_berserker.png
// Qué se ve en la imagen: Juez: toga morada con ribete dorado ancho, peluca blanca de rizos, chorrera blanca, corona dorada alta, mazo dorado grande en alto y anillos de runas moradas alrededor.
//
// Rasgos que se trasladan a la mascota de bloques:
//  1. corona dorada alta de puntas con gemas moradas · 2. peluca de juez blanca: rulos apilados a los lados de la cara
//  y filas de rulos en la nuca · 3. toga morada hasta los pies · 4. ribete dorado ancho (abertura delantera, bajo, puños)
//  5. interior morado oscuro · 6. chorrera blanca · 7. mangas de campana · 8. mazo dorado grande · 9. anillos de runas.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento (cuello y hebilla), cinto.
const base = { ropa: '#8a36bd', pantalon: '#3d1858', botas: '#2a1040', acento: '#ffd23a', cinto: '#8a36bd' };
const MORADO = '#8a36bd', MORADO2 = '#7029a3', FONDO = '#451672', ORO = '#ffd23a', ORO2 = '#dba31c';
const PELUCA = '#ffffff', PELUCA2 = '#dcdcea', BLANCO = '#ffffff', GEMA = '#a23cf0', RUNA = '#c66bff';

// La luz del juego apaga el blanco y el oro: esas piezas llevan un poco de brillo propio (se funden igual).
const BRILLO = { [ORO]: 0.32, [ORO2]: 0.2, [PELUCA]: 0.38, [BLANCO]: 0.38, [PELUCA2]: 0.28, [GEMA]: 0.5 };
// Como K.MF, pero separa las piezas por color para dar brillo propio a las de BRILLO.
function pinta(K, padre, partes, escala) {
  const lisas = [], porColor = {};
  for (const p of partes) { if (BRILLO[p[1]]) (porColor[p[1]] = porColor[p[1]] || []).push(p); else lisas.push(p); }
  if (lisas.length) K.MF(padre, lisas, null, null, null, escala);
  for (const c in porColor) K.MF(padre, porColor[c], K.mat(c, { e: BRILLO[c] }), null, null, escala);
}

export default {
  id: 'berserker',
  base,
  // CABEZA: peluca de juez (propia: el peinado del jugador no se dibuja) y corona alta. Unidades de cabeza (escala final H).
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
  // CUERPO: toga hasta los pies con ribete dorado, chorrera, mangas de campana, capa a la espalda, mazo y runas.
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
