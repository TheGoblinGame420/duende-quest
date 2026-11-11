// Traje 3D de la skin «lobo» (Duende Lobo). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_lobo.png
// A mayor tamaño: refs/lobo.png
// Qué se ve en la imagen: Hombre lobo: melena marrón despeinada con orejas de lobo, camisa de cuadros roja rota y abierta sobre camiseta blanca, vaqueros azules rotos con cinturón, antebrazos y piernas peludos marrones, patas con garras negras, cola peluda.
//
// Rasgos que se trasladan (11-nov-2026):
//  1. melena marrón despeinada con flequillo ladeado y patillas · 2. orejas de lobo con el interior rosa ·
//  3. camisa de cuadros roja y granate, abierta, de manga corta y con el bajo hecho jirones ·
//  4. camiseta crema debajo · 5. cinturón de cuero con hebilla plateada grande · 6. vaqueros azules cortados
//  con flecos claros y rotos en la rodilla · 7. antebrazos peludos · 8. piernas peludas y patas con garras ·
//  9. cola peluda grande (se menea) · 10. garras oscuras en las manos.

// Colores del cuerpo que arma humano(): ropa (torso), mangas (brazo al aire: piel), pantalon, botas (patas de pelo).
const PELO = '#8a4f24', PELO_O = '#5e3413', PELO_C = '#b06a32';
const ROJO = '#c9282b', GRANATE = '#6a1418', CREMA = '#fbf6ea';
const VAQUERO = '#2b3a66', FLECO = '#cdd2dc', GARRA = '#2b2228', ROSA = '#ef7f6e', PLATA = '#b8bcc4', CUERO = '#6b4226';
const base = { ropa: ROJO, mangas: '#8fd14f', pantalon: VAQUERO, botas: PELO, acento: PLATA, cinto: CUERO };

export default {
  id: 'lobo',
  base,
  // CABEZA: melena de bloques con mechones, flequillo, patillas y orejas de lobo. Unidades de cabeza (escala final H).
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
  // CUERPO: camisa de cuadros abierta sobre camiseta, cinturón, vaqueros rotos, pelo en brazos y piernas, garras y cola.
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
