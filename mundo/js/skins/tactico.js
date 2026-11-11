// Traje 3D de la skin «tactico» (Táctico). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_tactico.png
// Qué se ve en la imagen: Hacker: sudadera con capucha verde casi negro llena de código verde neón (estilo Matrix),
// visor de realidad virtual gris con haz verde, teclado holográfico verde delante, pantalón oscuro y chispas de neón alrededor.
//
// Cómo está hecho (11-nov-2026):
// - cabeza(): capucha de bloques (deja libres las orejas y la cara) con código neón por detrás, visor gris tipo
//   gafas de RV con cristal translúcido (se siguen viendo los ojos) y el haz verde hacia delante.
// - vestir(): sudadera con columnas de código neón pegadas a la curva del torso (pecho y, sobre todo, ESPALDA),
//   bolsillo canguro, cordones, capucha recogida en la nuca, puños, suelas de neón, teclado holográfico delante
//   (corrido a la zurda para no chocar con el arma; no sale con escudo ni con dagas) y chispas que giran alrededor.
// - Calidad baja (ctx.ligero): sin cristal, sin haz, sin chispas, la mitad de código y teclado opaco. 0 mallas sueltas.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento (cuello y hebilla).
const base = { ropa: '#174a2a', pantalon: '#141d19', botas: '#0d1410', acento: '#39ff6a', cinto: '#0c2414' };
const NEON = '#39ff6a', TELA = '#174a2a', TELA2 = '#0e2e1a', GRIS = '#8a939c', GRIS2 = '#444b54', VIDRIO = '#0c3a1e';

export default {
  id: 'tactico',
  base,
  // CABEZA: capucha de bloques + visor de RV. Coordenadas en unidades de cabeza (escala final H).
  cabeza(r, K, ctx) {
    const H = ctx.H, lig = ctx.ligero;
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      // Capucha: techo con visera, nuca, laterales por DETRÁS de las orejas y pico caído.
      ['caja', TELA, [0, 0.565, -0.02], [0.61, 0.1, 0.56]],
      ['caja', TELA2, [0, 0.535, 0.245], [0.61, 0.05, 0.05]],
      ['caja', TELA, [0, 0.635, -0.07], [0.46, 0.06, 0.4]],
      ['caja', TELA, [0, 0.29, -0.285], [0.6, 0.56, 0.08]],
      ['caja', TELA, [0.292, 0.46, -0.03], [0.045, 0.14, 0.5]],
      ['caja', TELA, [-0.292, 0.46, -0.03], [0.045, 0.14, 0.5]],
      ['caja', TELA, [0.292, 0.2, -0.2], [0.045, 0.38, 0.14]],
      ['caja', TELA, [-0.292, 0.2, -0.2], [0.045, 0.38, 0.14]],
      // Visor de RV: carcasa gris (arriba, abajo, lados, puente) y correa.
      ['caja', GRIS, [0, 0.4, 0.29], [0.52, 0.05, 0.1]],
      ['caja', GRIS, [0, 0.225, 0.29], [0.52, 0.045, 0.1]],
      ['caja', GRIS, [0.25, 0.312, 0.275], [0.06, 0.2, 0.13]],
      ['caja', GRIS, [-0.25, 0.312, 0.275], [0.06, 0.2, 0.13]],
      ['caja', GRIS2, [0, 0.312, 0.285], [0.035, 0.13, 0.08]],
      ['caja', GRIS2, [0.288, 0.4, 0.12], [0.03, 0.06, 0.24]],
      ['caja', GRIS2, [-0.288, 0.4, 0.12], [0.03, 0.06, 0.24]],
    ];
    K.MF(g, P, null, null, null, H);
    // Neón de la cabeza: línea del visor, código en la nuca de la capucha y (calidad normal) el haz.
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
      // Haz verde que sale del visor, en escalones de píxel.
      N.push(['caja', null, [0.06, 0.335, 0.41], [0.3, 0.02, 0.12]]);
      N.push(['caja', null, [-0.05, 0.3, 0.5], [0.2, 0.016, 0.12]]);
      N.push(['caja', null, [0.08, 0.34, 0.61], [0.1, 0.014, 0.08]]);
    }
    K.MF(g, N, K.mat(NEON, { e: 1 }), null, null, H);
    if (!lig) {
      // Cristal translúcido: tiñe de verde pero deja ver los ojos (malla suelta 1).
      const v = K.M(g, 'caja', K.mat(VIDRIO, { e: 0.35, op: 0.5 }), [0, 0.312 * H, 0.315 * H], [0.45 * H, 0.13 * H, 0.03 * H]);
      v.userData.sinFlash = true;
    }
    return 'peluca';   /* la capucha lo tapa todo: no se dibuja el pelo del jugador (el moño asomaba por la nuca) */
  },
  // CUERPO: sudadera con código, bolsillo canguro, teclado holográfico y chispas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const zP = 0.2 * P + 0.02;
    // Superficie del torso (elipsoide): z en función de x e y, para pegar el código a la tela.
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
    // Código neón (fundido en la malla del cuerpo; brilla).
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
    // Mangas: puño y código por fuera y por detrás.
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
    // Suelas de neón (se ven al andar, desde atrás).
    for (const p of [r.pI, r.pD]) K.M(p, 'caja', mN, [0, -L + 0.012, 0.05], [0.185, 0.022, 0.31]);
    // Teclado holográfico: flota delante, corrido a la zurda (la diestra lleva el arma). No con escudo ni dagas.
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
    // Chispas de código que giran alrededor (solo calidad normal; 1 pivote).
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
