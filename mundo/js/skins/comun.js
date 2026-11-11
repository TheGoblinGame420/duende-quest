// Traje 3D de la skin «comun» (Duende). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: refs/mascota_brindando.png, refs/mascota_letrero.png, assets/lore/duende-chicha.webp (la mascota de la marca).
// Qué se ve en la imagen: cabeza cubo sin nada encima, poncho andino azul con grecas en V (amarillo, celeste y azul marino)
// y flecos celestes, brazos y piernas desnudos (verdes), cinturón de cuero con bolsa y botón dorado, short marrón,
// botas marrones con correa, hebilla dorada y suela color arena.
//
// (11-nov-2026) Traje rehecho con cajas: poncho en bloques con punta delante y detrás, grecas en V en las dos caras,
// caídas del poncho sobre los hombros (se mueven con los brazos), short, bolsa, botas con suela clara.

const PIEL = '#8fd14f';
// Colores del cuerpo que arma humano(): torso azul (queda bajo el poncho), brazos y piernas de piel.
const base = { ropa: '#2b5fd0', mangas: PIEL, pantalon: PIEL, botas: '#7a4a28', acento: '#e8b923', cinto: '#5a3418' };
const AZUL = '#2b5fd0', MARINO = '#17307a', CELESTE = '#4fb0ee', ORO = '#ffd23f';
const SHORT = '#6b4226', SHORT2 = '#472b18', CUERO = '#7a4a28', CUERO2 = '#4f2e16', SUELA = '#dcbb7c', HEBILLA = '#e8b923';

export default {
  id: 'comun',
  base,
  // La mascota no lleva nada en la cabeza: se ve el peinado del jugador y la clase no le pone gorro encima.
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
    // Punta del poncho, delante y detrás: tres filas en escalera bajo el cinturón.
    const filas = [[0.46, yB - 0.03, 0.07], [0.32, yB - 0.095, 0.07], [0.17, yB - 0.16, 0.07]];
    const tan = 0.93, ang = 0.75;
    for (const s of [1, -1]) {
      const z = s * (zf - 0.02);
      for (const [w, y, h] of filas) C.push(['caja', AZUL, [0, y, z], [w * WP, h, 0.04]]);
      // Grecas en V (de abajo arriba): amarilla, celeste, amarilla y la marina que hace de escote.
      const grecas = [[ORO, yB - 0.155, 0.055], [CELESTE, yB - 0.075, 0.05], [ORO, yB + 0.075, 0.05]];
      if (!lig) grecas.push([CELESTE, yB + 0.145, 0.04]);
      for (const [c, y0, gr] of grecas) {
        const dx = Math.min(0.275 * WP, (yT - 0.03 - y0) / tan);
        for (const x of [1, -1]) C.push(['caja', c, [x * dx / 2, y0 + dx * tan / 2, s * (zf + 0.004)], [dx / Math.cos(ang) + 0.02, gr, 0.022], [0, 0, x * ang]]);
      }
      // Flecos celestes en cada escalón.
      if (!lig) {
        for (const [w, y, h] of filas) for (const x of [1, -1]) C.push(['caja', CELESTE, [x * (w * WP / 2 - 0.025), y - h / 2 - 0.02, z], [0.035, 0.05, 0.03]]);
        C.push(['caja', CELESTE, [0, yB - 0.215, z], [0.035, 0.05, 0.03]]);
      }
    }
    if (!lig) {
      // Escote en pico: un rombo de piel sobre otro marino.
      C.push(['caja', MARINO, [0, T * 0.945, zf + 0.002], [0.13, 0.13, 0.02], [0, 0, K.PI / 4]]);
      C.push(['caja', PIEL, [0, T * 0.965, zf + 0.008], [0.085, 0.085, 0.02], [0, 0, K.PI / 4]]);
    }
    // Bolsa de cuero en la cadera derecha, con solapa y botón dorado.
    const bx = -0.17 * WP, bz = zf + 0.03;
    C.push(['caja', CUERO, [bx, yB - 0.07, bz], [0.13, 0.12, 0.07]]);
    C.push(['caja', CUERO2, [bx, yB - 0.03, bz + 0.005], [0.14, 0.05, 0.075]]);
    if (!lig) C.push(['caja', HEBILLA, [bx, yB - 0.065, bz + 0.04], [0.035, 0.035, 0.02]]);
    K.MF(r.cuerpo, C);
    // Caídas del poncho sobre los hombros: cuelgan de cada brazo y se mueven con él.
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
    // Piernas: pernera del short, bota alta con correa y hebilla, suela clara.
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
