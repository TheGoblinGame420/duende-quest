// Traje 3D de la skin «momia» (Duende Momia). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_momia.png
// A mayor tamaño: refs/momia.png
// Qué se ve en la imagen: Todo el cuerpo y la cabeza envueltos en vendas crema con tiras sueltas que cuelgan; se ve la cara verde y trozos de piel entre las vendas; las espadas de píxeles asoman vendadas.
//
// CÓMO ESTÁ HECHO (11-nov-2026): el cuerpo que arma humano() es PIEL verde y encima van las vendas,
// en relieve: aros (cil) torcidos a un lado y al otro en torso, brazos y piernas, que dejan rendijas
// verdes en cuña como en la imagen; dos vendas cruzadas en aspa (pecho y espalda); la cabeza cubo
// vendada por arriba, por detrás, por los lados y bajo el mentón, con la CARA y las OREJAS libres;
// las espadas de píxeles con dos vueltas de venda cada una; tiras sueltas que cuelgan de codos,
// muñecas, cintura, rodillas y nuca, y una venda larga a la espalda que se menea (r.cola).
// En ligero: menos aros pero más altos (misma proporción crema/verde), sin garras, manchas ni pivote.

// Colores del cuerpo que arma humano(): la piel verde de la mascota (las vendas van encima); botas ya vendadas.
const base = { ropa: '#8fd14f', pantalon: '#8fd14f', botas: '#fff6dc', acento: '#f0dcb0', cinto: '#fff6dc' };
// Vendas: clara, media (la de debajo), sombra (bordes y puntas rotas) y mancha de tierra.
const V1 = '#fff6dc', V2 = '#f0dcb0', V3 = '#d0b684', MANCHA = '#a98a5c', GARRA = '#17131c';

export default {
  id: 'momia',
  base,
  // Cabeza: vendas alrededor del cubo. Coordenadas en unidades de cabeza (escala final H).
  cabeza(r, K, ctx) {
    const g = K.fuera(K.G(r.cabeza));
    const P = [
      // coronilla y frente (por encima de las cejas)
      ['caja', V1, [0, 0.548, 0], [0.585, 0.07, 0.545]],
      ['caja', V2, [0, 0.49, 0], [0.6, 0.065, 0.56], [0, 0, 0.07]],
      // vueltas por detrás y por los lados (dejan la cara libre: llegan hasta z = +0.06); entre ellas se ve el verde
      ['caja', V1, [0, 0.385, -0.105], [0.59, 0.1, 0.35], [0, 0, -0.05]],
      ['caja', V2, [0, 0.262, -0.105], [0.6, 0.105, 0.36], [0, 0, 0.045]],
      ['caja', V1, [0, 0.135, -0.105], [0.59, 0.1, 0.35], [0, 0, -0.04]],
      // mentón y cuello
      ['caja', V1, [0, 0.03, 0], [0.585, 0.055, 0.545], [0, 0, 0.03]],
      ['caja', V2, [0, -0.012, 0], [0.5, 0.05, 0.46]],
      // vendas de las espadas de píxeles (dos vueltas por espada)
      ['caja', V1, [0.34, 0.575, -0.2], [0.2, 0.055, 0.085], [0, 0, -0.75]],
      ['caja', V1, [-0.34, 0.575, -0.2], [0.2, 0.055, 0.085], [0, 0, 0.75]],
      ['caja', V2, [0.5, 0.735, -0.2], [0.2, 0.055, 0.085], [0, 0, -0.75]],
      ['caja', V2, [-0.5, 0.735, -0.2], [0.2, 0.055, 0.085], [0, 0, 0.75]],
      // tira suelta que cae de la nuca
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
  // Cuerpo: aros de venda torcidos, aspa en el pecho, tiras sueltas.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, gr = ctx.cpo.grueso || 1;
    const lig = !!ctx.ligero;
    const cy = T * 0.5, ry = T * 0.58;
    // Aro de venda alrededor del torso (elipsoide) a la altura y, de alto h.
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
    // Aspa: dos vendas en diagonal que cruzan pecho y espalda.
    C.push(['cil', V1, [0, T * 0.56, 0], [0.285 * W * P, 0.07, 0.238 * P], [0, 0, 0.6]]);
    C.push(['cil', V1, [0, T * 0.56, 0], [0.285 * W * P, 0.07, 0.238 * P], [0, 0, -0.6]]);
    // Cadera vendada (tapa la caja de la cadera) con una rendija.
    C.push(['caja', V1, [0, 0.045, 0], [0.36 * W, 0.075, 0.25]]);
    C.push(['caja', V2, [0, -0.04, 0], [0.355 * W, 0.06, 0.24], [0, 0, 0.05]]);
    // Tiras sueltas de la cintura.
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

    // Venda larga que cuelga a la espalda y se menea como cola (solo en calidad normal).
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

    // Brazos: aros torcidos, hombro vendado, tiras en codo y muñeca, garras.
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
      // tira que cuelga del codo (por fuera) y otra de la muñeca (por detrás)
      B.push(['caja', V1, [s * (rb + 0.045), -A * 0.5 - 0.1, -0.01], [0.016, 0.24, 0.08], [0, 0, 0.32 * s]]);
      if (!lig) {
        B.push(['caja', V3, [s * (rb + 0.09), -A * 0.5 - 0.235, -0.01], [0.016, 0.05, 0.045], [0, 0, 0.32 * s]]);
        B.push(['caja', V2, [0, -A * 0.89 - 0.09, -(rb + 0.01)], [0.065, 0.2, 0.016], [0.14, 0, 0]]);
      }
      K.fuera(K.MF(b, B));
      if (!lig) {
        // garras negras: tres por mano, hacia abajo y un poco adelante
        K.fuera(K.MF(mano, [-0.045, 0, 0.045].map(x => ['cono', GARRA, [x, -0.06, 0.045], [0.02, 0.07, 0.02], [K.PI - 0.45, 0, 0]])));
      }
    }

    // Piernas: aros torcidos, botas vendadas, tira en la rodilla.
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
      // bota: dos vendas cruzadas sobre el empeine y una rendija de piel
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
