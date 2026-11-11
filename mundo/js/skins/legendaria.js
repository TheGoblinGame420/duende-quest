// Traje 3D de la skin «legendaria» (Legendaria). Guía y contrato: LEEME.md (en esta carpeta).
// Sin imports: todo llega por parámetro. K = caja de herramientas, ctx = datos de este duende.
// Imagen del dueño: assets/skins/skin_legendariafull.png
// Qué se ve en la imagen: Armadura oscura casi invisible dibujada con circuitos de neón cian y magenta, espadón enorme de energía celeste con borde magenta y un orbe/anillo de energía en la otra mano.
//
// Cómo está hecho (11-nov-2026):
// - Armadura azul noche casi negra; TODO el dibujo son barras de neón que brillan (cian y magenta), como en la imagen.
// - Cabeza: casquete oscuro con filete cian, gema magenta en la frente, cresta cian en escalera y dos aletas magenta; ojos naranjas encendidos.
// - Pecho: núcleo cian en rombo con cuello en V; espalda: reactor (anillo octogonal cian + rombo magenta) y columna de luz.
// - Hombros: tres costillas de energía por lado (magenta, cian, magenta) abiertas como alas: es la silueta de la skin.
// - Faldón en punta delante y detrás (borde magenta, galón cian), brazaletes, rodilleras y botas con filete.
// - Mano izquierda libre: anillo de energía que gira alrededor del puño (con escudo o dagas, gira tumbado alrededor del antebrazo).
// - El espadón de la imagen es el arma del jugador (hoja de luz por hojaNeon): aquí no se dibuja.
// Todo son piezas opacas que se funden: 0 mallas sueltas. Calidad baja: sin pivotes y con menos barras.

// Colores del cuerpo que arma humano(): ropa (torso y mangas), pantalon, botas, acento (cuello y hebilla), hojaNeon (hoja de luz de la katana).
const base = { ropa: '#0e1126', pantalon: '#0b0d1f', botas: '#080a18', acento: '#10f0fa', cinto: '#0b0d1f', hojaNeon: '#7df9ff' };
const CIAN = '#10f0fa', MAG = '#f01dfb', NOCHE = '#14183a', PLACA = '#1d2250', NARANJA = '#ff9a1f';

// Pone tres listas de piezas en un padre: oscuras (sin brillo), cian y magenta (con brillo propio).
function pon(K, padre, D, C, G, esc) {
  if (D && D.length) K.MF(padre, D, null, null, null, esc);
  if (C && C.length) K.MF(padre, C, CIAN, { e: 1 }, null, esc);
  if (G && G.length) K.MF(padre, G, MAG, { e: 1 }, null, esc);
}
// Aro octogonal de barras (plano XY, mirando a Z) dentro de la lista `a`.
function aro(a, cx, cy, cz, R, t, lados, salto) {
  const n = lados || 8, largo = 2 * R * Math.tan(Math.PI / n) + t * 0.5;
  for (let i = 0; i < n; i += (salto || 1)) {
    const g = i / n * Math.PI * 2;
    a.push(['caja', null, [cx + Math.cos(g) * R, cy + Math.sin(g) * R, cz], [largo, t, t], [0, 0, g + Math.PI / 2]]);
  }
}

export default {
  id: 'legendaria',
  base,
  // CABEZA (unidades de cabeza): casquete con cresta de neón. La cara, las orejas y las espadas quedan libres.
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
  // CUERPO: placas oscuras con el circuito de neón, costillas de energía en los hombros, reactor en la espalda y anillo en la mano.
  vestir(r, K, ctx) {
    const { T, A, L } = ctx, W = ctx.cpo.ancho, P = ctx.cpo.panza, lig = ctx.ligero, k = W * P, PI = K.PI;
    const zf = 0.2 * P + 0.005, zl = zf + 0.03, zb = -zf, zbl = -zl;   /* placa del pecho / espalda y la cara donde va el dibujo */
    const D = [], C = [], G = [];
    // Pecho.
    D.push(['caja', NOCHE, [0, T * 0.62, zf], [0.36 * k, 0.3, 0.05]]);
    C.push(['caja', null, [0, T * 0.8, zl], [0.075, 0.075, 0.03], [0, 0, PI / 4]]);                       /* núcleo */
    C.push(['caja', null, [0.085 * k, T * 0.9, zl], [0.15 * k, 0.022, 0.02], [0, 0, 0.5]], ['caja', null, [-0.085 * k, T * 0.9, zl], [0.15 * k, 0.022, 0.02], [0, 0, -0.5]]);   /* cuello en V */
    G.push(['caja', null, [0.095 * k, T * 0.68, zl], [0.13 * k, 0.022, 0.02], [0, 0, -0.45]], ['caja', null, [-0.095 * k, T * 0.68, zl], [0.13 * k, 0.022, 0.02], [0, 0, 0.45]]);   /* pectorales */
    C.push(['caja', null, [0, T * 0.55, zl], [0.022, 0.13, 0.02]]);                                        /* esternón */
    if (!lig) G.push(['caja', null, [0.08 * k, T * 0.42, zl], [0.09 * k, 0.02, 0.02], [0, 0, 0.6]], ['caja', null, [-0.08 * k, T * 0.42, zl], [0.09 * k, 0.02, 0.02], [0, 0, -0.6]]);   /* costillas */
    // Espalda: placa, columna y reactor (aro cian + rombo magenta).
    D.push(['caja', NOCHE, [0, T * 0.6, zb], [0.38 * k, 0.34, 0.05]]);
    const yr = T * 0.66, zr = zbl - 0.035;
    D.push(['caja', PLACA, [0, yr, zbl - 0.012], [0.2, 0.2, 0.03], [0, 0, PI / 4]]);
    aro(C, 0, yr, zr, 0.2, 0.035, 8, lig ? 2 : 1);
    G.push(['caja', null, [0, yr, zr], [0.11, 0.11, 0.035], [0, 0, PI / 4]]);
    C.push(['caja', null, [0, T * 0.2, zbl], [0.03, 0.14, 0.02]]);
    // Cinturón de luz y hebilla.
    C.push(['caja', null, [0, T * 0.17, 0], [0.5 * k, 0.025, 0.43 * P]]);
    G.push(['caja', null, [0, T * 0.17, 0.215 * P + 0.01], [0.07, 0.06, 0.03]]);
    // Faldón en punta, delante y detrás.
    for (const s of [1, -1]) {
      const z = s * 0.135, zz = s * 0.155;
      D.push(['caja', NOCHE, [0, -0.07, z], [0.17, 0.14, 0.03]], ['caja', NOCHE, [0, -0.14, z], [0.12, 0.12, 0.03], [0, 0, PI / 4]]);
      G.push(['caja', null, [0.047, -0.175, zz], [0.13, 0.022, 0.02], [0, 0, 0.785]], ['caja', null, [-0.047, -0.175, zz], [0.13, 0.022, 0.02], [0, 0, -0.785]]);
      if (!lig || s < 0) C.push(['caja', null, [0.03, -0.09, zz], [0.08, 0.02, 0.02], [0, 0, 0.6]], ['caja', null, [-0.03, -0.09, zz], [0.08, 0.02, 0.02], [0, 0, -0.6]]);
    }
    // Costillas de energía sobre los hombros (la silueta): magenta, cian, magenta, cada una más abierta y larga.
    const sx = 0.216 * k + 0.09;
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        const a = 0.4 + i * 0.27, largo = 0.24 + i * 0.07;
        const x = s * (sx - 0.01 + i * 0.08 + Math.sin(a) * largo * 0.5), y = T * 0.9 + i * 0.02 + Math.cos(a) * largo * 0.5;
        (i === 1 ? C : G).push(['caja', null, [x, y, -0.02], [0.04, largo, 0.22 - i * 0.03], [0, 0, -s * a]]);
      }
    }
    pon(K, K.fuera(K.G(r.cuerpo)), D, C, G);
    // Brazos: hombrera oscura con filo, brazalete doble y nervio exterior.
    const gr = (ctx.cpo.grueso || 1);
    for (const [b, s] of [[r.bI, 1], [r.bD, -1]]) {
      const an = 0.15 * gr + 0.03;
      const d = [['caja', NOCHE, [s * 0.01, 0.02, 0], [0.19, 0.1, 0.24]]];
      const c = [['caja', null, [s * 0.01, -0.035, 0], [0.2, 0.022, 0.25]], ['caja', null, [0, -A + 0.07, 0], [an, 0.03, an]]];
      const m = [['caja', null, [0, -A + 0.14, 0], [an, 0.025, an]]];
      if (!lig) m.push(['caja', null, [s * (an * 0.5 - 0.01), -A * 0.42, 0], [0.02, 0.1, 0.03]]);
      pon(K, b, d, c, m);
    }
    // Piernas: rodillera, nervio de la espinilla y filete de la bota.
    for (const [p, s] of [[r.pI, 1], [r.pD, -1]]) {
      const c = [['caja', null, [0, -L * 0.5, 0], [0.19, 0.03, 0.19]], ['caja', null, [0, -(L - 0.125), 0.045], [0.19, 0.022, 0.28]]];
      const m = [['caja', null, [0, -L * 0.72, 0.09], [0.025, 0.1, 0.02]], ['caja', null, [0, -L * 0.72, -0.09], [0.025, 0.1, 0.02]]];
      if (!lig) m.push(['caja', null, [s * 0.09, -L * 0.28, 0], [0.02, 0.1, 0.03]]);
      pon(K, p, null, c, m);
    }
    // Anillo de energía: alrededor del puño izquierdo si está libre; con escudo o dagas rodea el antebrazo.
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
