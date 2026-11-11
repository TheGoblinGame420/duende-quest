// Traje 3D de la skin «frankenstein» (Duende Frankenstein). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_frankenstein.png
// Qué se ve en la imagen: Pelo negro plano y recto (flequillo en zigzag), tornillos metálicos en las sienes, costuras en la frente, chaqueta marrón rota con parches, cinturón con hebilla grande, pantalón morado roto, botas marrones.
//
// Cómo está hecho (11-nov-2026):
// - Brazos y piernas se arman del color de la piel (mangas y pantalon = verde) y encima van la manga corta rota
//   de la chaqueta y el pantalón corto morado con el bajo en picos: así asoman antebrazos y espinillas verdes
//   con sus costuras, como en la imagen.
// - Cabeza: bloque de pelo negro de techo plano, flequillo y nuca en zigzag, tornillos en las sienes y cicatriz cosida.
// - Espalda (lo que más se ve en el juego): chaqueta marrón con dos parches grandes (morado y naranja) y faldón en picos.

const MARRON = '#8c5529', MARRON_CL = '#ab6d35', MARRON_OS = '#5e391c';
const MORADO = '#573283', MORADO_CL = '#7b4bb0', NARANJA = '#e07a1f';
const CAMISA = '#26242b', NEGRO = '#15131a', PELO = '#17151c', PELO_CL = '#2c2936';
const METAL = '#aeb7c1', METAL_OS = '#6c7580', HILO = '#1d2a14', HILO_CL = '#e9dfc4';
const SUELA = '#d9b98a', BOTA = '#5c3518', BOTA_CL = '#7d4a22', PIEL = '#8fd14f';

// Colores del cuerpo que arma humano(): el torso es la chaqueta; brazos, piernas y cadera salen de piel y se visten encima.
const base = { ropa: MARRON, pantalon: PIEL, botas: BOTA, acento: METAL, cinto: NEGRO, mangas: PIEL };

export default {
  id: 'frankenstein',
  base,
  // CABEZA: pelo negro de techo plano con flequillo en zigzag, tornillos en las sienes y cicatriz cosida.
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza)), lig = ctx.ligero, R = K.PI / 2;
    const P = [
      ['caja', PELO, [0, 0.575, -0.005], [0.59, 0.15, 0.56]],              // bloque de pelo: techo plano y alto
      ['caja', PELO, [0, 0.39, -0.265], [0.57, 0.24, 0.04]],               // nuca
      ['caja', PELO, [0.283, 0.475, -0.01], [0.03, 0.09, 0.53]],           // patillas (por encima de las orejas)
      ['caja', PELO, [-0.283, 0.475, -0.01], [0.03, 0.09, 0.53]],
      // flequillo en zigzag (picos largos en el centro y en las esquinas, cortos sobre las cejas)
      ['caja', PELO, [0, 0.465, 0.262], [0.11, 0.09, 0.035]],
      ['caja', PELO, [0.11, 0.487, 0.262], [0.11, 0.045, 0.035]],
      ['caja', PELO, [-0.11, 0.487, 0.262], [0.11, 0.045, 0.035]],
      ['caja', PELO, [0.225, 0.455, 0.262], [0.12, 0.11, 0.035]],
      ['caja', PELO, [-0.225, 0.455, 0.262], [0.12, 0.11, 0.035]],
      // nuca en zigzag (se ve desde atrás)
      ['caja', PELO, [0, 0.235, -0.265], [0.13, 0.09, 0.04]],
      ['caja', PELO, [0.22, 0.225, -0.265], [0.13, 0.11, 0.04]],
      ['caja', PELO, [-0.22, 0.225, -0.265], [0.13, 0.11, 0.04]],
      // tornillos de las sienes: vástago y cabeza
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
        // cicatriz cosida en la mejilla derecha del duende (línea y tres puntadas)
        ['caja', HILO, [-0.2, 0.2, 0.256], [0.016, 0.13, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.215, 0.24, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.2, 0.2, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        ['caja', HILO, [-0.185, 0.16, 0.257], [0.05, 0.014, 0.012], [0, 0, 0.35]],
        // cicatriz del costado de la cabeza (lado izquierdo)
        ['caja', HILO, [0.272, 0.16, 0.08], [0.012, 0.016, 0.2]],
        ['caja', HILO, [0.273, 0.16, 0.14], [0.012, 0.06, 0.016]],
        ['caja', HILO, [0.273, 0.16, 0.08], [0.012, 0.06, 0.016]],
        ['caja', HILO, [0.273, 0.16, 0.02], [0.012, 0.06, 0.016]],
      );
    }
    K.MF(g, P, null, null, null, ctx.H);
    return 'peluca';                                 // trae su propio pelo: no se dibuja el del jugador
  },
  // CUERPO: chaqueta marrón rota y abierta sobre camisa oscura, cinturón negro con hebillón, pantalón corto morado roto, botas de trabajo.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero;
    const gr = (ctx.cpo.grueso || 1) * 1.18;         // el mismo engorde que aplica humano() a brazos y piernas
    const zP = 0.2 * P + 0.02, zE = -(0.2 * P + 0.012), WP = W * P;
    const C = [
      // delante: camisa oscura entre las solapas
      ['caja', CAMISA, [0, T * 0.55, zP], [0.2 * WP, T * 0.62, 0.03]],
      ['caja', MARRON_CL, [0.135 * WP, T * 0.62, zP + 0.004], [0.1 * WP, T * 0.5, 0.045], [0, 0, 0.22]],     // solapas abiertas
      ['caja', MARRON_CL, [-0.135 * WP, T * 0.62, zP + 0.004], [0.1 * WP, T * 0.5, 0.045], [0, 0, -0.22]],
      ['caja', MARRON_OS, [0, T * 0.93, -0.09], [0.36 * W, 0.08, 0.1]],                                      // cuello levantado atrás
      // cinturón ancho negro y hebillón plateado
      ['cil', NEGRO, [0, T * 0.18, 0], [0.242 * WP, 0.085, 0.197 * P]],
      ['caja', METAL, [0, T * 0.18, 0.2 * P + 0.008], [0.17, 0.125, 0.03]],
      ['caja', NEGRO, [0, T * 0.18, 0.2 * P + 0.014], [0.095, 0.06, 0.03]],
      // cadera: el pantalón morado (la base la pinta de piel)
      ['caja', MORADO, [0, 0.015, 0], [0.37 * W, 0.16, 0.25]],
      // espalda: dos parches grandes
      ['caja', MORADO_CL, [0.09 * WP, T * 0.66, zE], [0.16, 0.14, 0.035], [0, 0, 0.18]],
      ['caja', NARANJA, [-0.1 * WP, T * 0.38, zE + 0.012], [0.13, 0.11, 0.035], [0, 0, -0.15]],
      // faldón roto de la chaqueta, en picos, por detrás y por los costados
      ['caja', MARRON, [-0.16 * W, 0.02, -0.165 * P], [0.11 * W, 0.13, 0.03]],
      ['caja', MARRON_OS, [-0.055 * W, 0.045, -0.17 * P], [0.11 * W, 0.08, 0.03]],
      ['caja', MARRON, [0.055 * W, 0.005, -0.17 * P], [0.11 * W, 0.16, 0.03]],
      ['caja', MARRON_OS, [0.16 * W, 0.035, -0.165 * P], [0.11 * W, 0.1, 0.03]],
      ['caja', MARRON, [0.2 * WP, 0.03, 0.04], [0.03, 0.12, 0.2 * P]],
      ['caja', MARRON, [-0.2 * WP, 0.045, 0.04], [0.03, 0.09, 0.2 * P]],
    ];
    if (!lig) {
      C.push(
        // parches de delante
        ['caja', NARANJA, [-0.15 * WP, T * 0.5, zP + 0.03], [0.07, 0.07, 0.02], [0, 0, -0.22]],
        ['caja', MORADO_CL, [0.16 * WP, T * 0.36, zP + 0.012], [0.07, 0.08, 0.03], [0, 0, 0.3]],
        // puntadas claras alrededor de los parches de la espalda
        ['caja', HILO_CL, [0.09 * WP, T * 0.66 + 0.085, zE - 0.004], [0.13, 0.014, 0.03], [0, 0, 0.18]],
        ['caja', HILO_CL, [0.09 * WP, T * 0.66 - 0.085, zE - 0.004], [0.13, 0.014, 0.03], [0, 0, 0.18]],
        ['caja', HILO_CL, [-0.1 * WP + 0.078, T * 0.38, zE + 0.008], [0.014, 0.09, 0.03], [0, 0, -0.15]],
        ['caja', HILO_CL, [-0.1 * WP - 0.078, T * 0.38, zE + 0.008], [0.014, 0.09, 0.03], [0, 0, -0.15]],
        // costura central de la espalda
        ['caja', MARRON_OS, [0, T * 0.52, zE + 0.008], [0.016, T * 0.5, 0.02]],
      );
    }
    K.MF(r.cuerpo, C);

    // Brazos: manga corta de la chaqueta con el borde roto; el antebrazo queda verde con una costura.
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

    // Piernas: pantalón corto morado con el bajo en picos, espinilla verde cosida y bota de trabajo con suela clara.
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
